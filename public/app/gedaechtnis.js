'use strict';
/* Gedaechtnis (C9b, README §6.10): der Vault als Graph. Knoten = Notizen,
   Kanten = Wikilinks, Farbe = Gruppe (aus .obsidian/graph.json oder
   Einstellungen -> Vault). Kraftsimulation wie im Mockup, mehrere Schritte je
   Frame bis 12 ms; ab alpha < 0,01 steht sie und es wird nur noch bei Bedienung
   gezeichnet. Bei reduzierter Bewegung schwingt sie vor dem ersten Bild ein.
   Bedienung ohne Maus: Suche oben links (Treffer sind Knoepfe), Pfeiltasten und
   + / − / 0 auf dem Graph, Legende als Schalter. Gerechnet wird hier nichts
   ausser der Lage der Punkte. */

Object.assign(EN, {
  'Gedächtnis': 'Memory', 'Gedächtnis durchsuchen …': 'Search memory …', 'Gedächtnis durchsuchen': 'Search memory',
  'Cira fragen': 'Ask Cira', 'Keine Notiz passt.': 'No note matches.', 'Cira denkt nach …': 'Cira is thinking …',
  '{n} Notizen · {m} Links · {k} ohne Link': '{n} notes · {m} links · {k} without link', 'Wurzel': 'Root',
  'Graph der Notizen. Pfeiltasten verschieben, Plus und Minus zoomen, 0 zeigt alles. Notizen öffnest du über die Suche oder die Legende.': 'Graph of notes. Arrow keys pan, plus and minus zoom, 0 shows everything. Open notes via search or the legend.',
  'Vergrößern': 'Zoom in', 'Verkleinern': 'Zoom out', 'Alles zeigen': 'Show all', 'Gruppen': 'Groups',
  'Kein Vault eingerichtet': 'No vault set up', 'Trag in config.json einen Arbeitsbereich mit art „vault“ und pfad ein.': 'Add a workspace with art "vault" and a pfad in config.json.',
  'Der Vault ist leer.': 'The vault is empty.', 'Noch keine Notizen im Index. Er läuft alle 30 Sekunden.': 'No notes indexed yet. The index runs every 30 seconds.',
  'Gedächtnis nicht geladen': 'Memory not loaded', 'Notiz schließen': 'Close note', 'Notiz lädt …': 'Loading note …',
  'Entstanden in · aus c2invoice': 'Created in · from c2invoice', 'Sitzung': 'Session', 'Vorgang': 'Job', 'Projekt': 'Project',
  'Zeitraum': 'Period', 'Tokens': 'Tokens', 'API-Gegenwert': 'API equivalent', 'abgerechnet': 'invoiced',
  'Diese Sitzung kennt der Ledger nicht (älter als die Logs oder anderer Rechner).': 'The ledger does not know this session (older than the logs or another machine).',
  'Verlinkt': 'Links to', 'Verweist hierher': 'Linked from', 'In Obsidian öffnen': 'Open in Obsidian', '{n} Wörter': '{n} words',
  'Beschreibung': 'Description', 'Art': 'Type', 'Geändert': 'Changed', 'Erstellt': 'Created', 'Notiz nicht gefunden.': 'Note not found.',
  'lokal': 'local',
});

const gd = { daten: null, fehler: null, laedt: false, sim: null, V: { s: 1, tx: 0, ty: 0 }, auto: true, hover: -1, gewaehlt: -1,
  notiz: null, notizPfad: null, notizFehler: null, aus: new Set(liesJson('gd.aus', [])), q: '', treffer: null, antwort: null, fragt: false,
  sucheLauf: 0, raf: 0, malt: 0, zieh: null, farben: null };

function gdLade(zwingend) {
  if (gd.laedt) return;
  gd.laedt = true;
  hole('/api/gedaechtnis/graph').then((d) => {
    gd.fehler = null;
    if (zwingend || !gd.daten || d.stand !== gd.daten.stand || d.knoten.length !== gd.daten.knoten.length) { gd.daten = d; gdBaue(); }
  }, (e) => { gd.fehler = e.grund || e.message; }).then(() => { gd.laedt = false; if (route().name === 'gedaechtnis') zeichneAnsicht(); });
}

/* ---------- Simulation ---------- */
// Feste Zufallsfolge: dieselben Daten ergeben dasselbe Bild.
function gdZufall(saat) { let s = saat | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gdBaue() {
  const d = gd.daten;
  const rnd = gdZufall(7);
  const gIndex = new Map(d.gruppen.map((g, i) => [g.id, i]));
  const N = d.knoten.map((k, i) => ({ ...k, i, x: 0, y: 0, vx: 0, vy: 0, nb: [], r: k.waise ? 2.2 : Math.min(16, 2.4 + Math.sqrt(k.grad) * 1.05), q: 1 + Math.sqrt(k.grad) * 0.35 }));
  for (const [a, b] of d.kanten) { N[a].nb.push(b); N[b].nb.push(a); }
  const winkel = (g) => (gIndex.get(g) || 0) / Math.max(1, d.gruppen.length) * Math.PI * 2;
  const waisen = N.filter((n) => n.waise);
  waisen.forEach((n, i) => { n.a = i / Math.max(1, waisen.length) * Math.PI * 2 + rnd() * 0.05; n.rj = 0.96 + rnd() * 0.12; });
  const hubsJe = new Map();
  for (const n of N) {
    if (n.waise) continue;
    const w = winkel(n.g);
    n.x = Math.cos(w) * 120 + (rnd() - 0.5) * 200;
    n.y = Math.sin(w) * 120 + (rnd() - 0.5) * 200;
    // Hubs (Grad >= 22) haengen an einem festen Winkel ihrer Gruppe.
    // Mehrere Hubs einer Gruppe faechern um ihren Winkel auf, sonst liegen ihre Namen uebereinander.
    if (n.grad >= 22) { const k = (hubsJe.get(n.g) || 0); hubsJe.set(n.g, k + 1); const wh = w + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45; n.hub = true; n.ax = Math.cos(wh) * (150 + k * 25); n.ay = Math.sin(wh) * (150 + k * 25); }
  }
  if (gd.sim && gd.sim.raf) cancelAnimationFrame(gd.sim.raf);
  gd.sim = { N, E: d.kanten, live: N.filter((n) => !n.waise), alpha: 1, ringR: 300, start: performance.now(), fertigMs: null, raf: 0 };
  gd.auto = true;
  gd.gewaehlt = gd.notizPfad ? N.findIndex((n) => n.id === gd.notizPfad) : -1;
}
function gdTick() {
  const s = gd.sim, a = s.alpha, live = s.live, L = live.length;
  for (let i = 0; i < L; i++) {
    const p = live[i];
    for (let j = i + 1; j < L; j++) {
      const q = live[j];
      const dx = p.x - q.x, dy = p.y - q.y, d2 = Math.max(dx * dx + dy * dy, 36), qq = p.q * q.q;
      if (d2 > 40000 && qq < 4) continue;
      const f = 60 * a * qq / d2;
      p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f;
    }
  }
  for (const [i, j] of s.E) {
    const p = s.N[i], q = s.N[j];
    const dx = q.x - p.x, dy = q.y - p.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
    const k = (dd - 28) / dd * 0.06 * a / Math.sqrt(Math.max(1, Math.max(p.grad, q.grad) / 6));
    p.vx += dx * k; p.vy += dy * k; q.vx -= dx * k; q.vy -= dy * k;
  }
  const rs = [];
  for (const p of live) {
    p.vx -= p.x * 0.006 * a; p.vy -= p.y * 0.006 * a;
    p.vx *= 0.55; p.vy *= 0.55;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 8) { p.vx *= 8 / sp; p.vy *= 8 / sp; }
    p.x += p.vx; p.y += p.vy;
    if (p.hub) { p.x += (p.ax - p.x) * 0.2; p.y += (p.ay - p.y) * 0.2; p.vx = 0; p.vy = 0; }
    rs.push(Math.hypot(p.x, p.y));
  }
  rs.sort((u, v) => u - v);
  s.ringR = Math.max(120, (rs[Math.floor(rs.length * 0.95)] || 0) * 1.3);
  for (const n of s.N) if (n.waise) { n.x = Math.cos(n.a) * s.ringR * n.rj; n.y = Math.sin(n.a) * s.ringR * n.rj * 0.92; }
  s.alpha *= 0.988;
}
function gdLauf() {
  const s = gd.sim;
  s.raf = 0;
  if (!s || !document.getElementById('gd-canvas')) return;   // Seite verlassen: anhalten
  const t0 = performance.now();
  while (s.alpha >= 0.01 && performance.now() - t0 < 12) gdTick();
  gdMale();
  if (s.alpha >= 0.01) s.raf = requestAnimationFrame(gdLauf);
  else if (s.fertigMs === null) s.fertigMs = Math.round(performance.now() - s.start);
}
function gdStarte() {
  const s = gd.sim;
  if (!s) return;
  if (s.alpha >= 0.01 && wenigerBewegung()) {
    while (s.alpha >= 0.01) gdTick();
    s.fertigMs = Math.round(performance.now() - s.start);
  }
  if (s.alpha >= 0.01) { if (!s.raf) s.raf = requestAnimationFrame(gdLauf); } else gdMaleBald();
}

/* ---------- Zeichnen ---------- */
// Canvas kennt kein var(): Farben einmal aus den Tokens lesen (Theme-Wechsel: beim naechsten Aufbau neu).
function gdFarben() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const ersatz = ['--text-dim', '--m-1', '--m-2', '--m-3', '--m-4', '--m-5', '--info', '--vault'].map(v).filter(Boolean);
  return { kante: v('--text-faint'), hell: v('--accent'), text: v('--text'), schatten: v('--bg'), ersatz };
}
function gdFarbeVon(gid) {
  const g = gd.daten.gruppen.find((x) => x.id === gid);
  if (g && g.farbe) return g.farbe;
  const i = Math.max(0, gd.daten.gruppen.filter((x) => !x.farbe).findIndex((x) => x.id === gid));
  return gd.farben.ersatz[i % gd.farben.ersatz.length] || gd.farben.text;
}
function gdMaleBald() { if (!gd.malt) gd.malt = requestAnimationFrame(() => { gd.malt = 0; gdMale(); }); }
function gdMale() {
  const c = document.getElementById('gd-canvas');
  const s = gd.sim;
  if (!c || !s) return;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  const d = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
  if (!gd.farben) gd.farben = gdFarben();
  const V = gd.V;
  // Offenes Panel (520 px) verdeckt rechts: dann in der freien Flaeche zentrieren.
  const frei = gd.notizPfad && w > 1000 ? w - 520 : w;
  if (gd.auto) { V.s = Math.min(frei, h) / (s.ringR * 2.25); V.tx = frei / 2; V.ty = h / 2; }
  const x = c.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0);
  x.clearRect(0, 0, w, h);
  const sichtbar = (n) => !gd.aus.has(n.g);
  const hv = gd.hover;
  const treffer = gd.treffer && gd.treffer.length ? new Set(gd.treffer.map((t) => s.N.findIndex((n) => n.id === t.pfad)).filter((i) => i >= 0)) : null;
  const nb = new Set();
  if (hv >= 0) { nb.add(hv); for (const k of s.N[hv].nb) nb.add(k); }
  x.save();
  x.translate(V.tx, V.ty);
  x.scale(V.s, V.s);
  x.lineWidth = 0.7 / V.s;
  for (const [i, j] of s.E) {
    const p = s.N[i], q = s.N[j];
    if (!sichtbar(p) || !sichtbar(q)) continue;
    const an = hv >= 0 && (i === hv || j === hv);
    x.globalAlpha = hv >= 0 ? (an ? 0.6 : 0.04) : treffer ? (treffer.has(i) || treffer.has(j) ? 0.25 : 0.04) : 0.12;
    x.strokeStyle = an ? gd.farben.hell : gd.farben.kante;
    x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke();
  }
  for (const n of s.N) {
    if (!sichtbar(n)) continue;
    x.globalAlpha = hv >= 0 ? (nb.has(n.i) ? 1 : 0.18) : treffer ? (treffer.has(n.i) ? 1 : 0.15) : 1;
    x.fillStyle = gdFarbeVon(n.g);
    x.beginPath(); x.arc(n.x, n.y, n.r, 0, Math.PI * 2); x.fill();
    if (n.i === gd.gewaehlt) { x.globalAlpha = 1; x.strokeStyle = gd.farben.hell; x.lineWidth = 2 / V.s; x.beginPath(); x.arc(n.x, n.y, n.r + 3 / V.s, 0, Math.PI * 2); x.stroke(); x.lineWidth = 0.7 / V.s; }
  }
  x.restore();
  x.globalAlpha = 1;
  x.font = '500 11.5px "Fira Sans", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'top';
  for (const n of s.N) {
    if (!sichtbar(n)) continue;
    const zeig = n.i === gd.gewaehlt || n.i === hv || (hv >= 0 && nb.has(n.i) && s.N[hv].nb.length < 40) || (treffer && treffer.has(n.i))
      || (hv < 0 && !treffer && (n.r >= 9 || (V.s > 2.2 && n.grad > 3) || V.s > 3.4));
    if (!zeig) continue;
    const sx = n.x * V.s + V.tx, sy = n.y * V.s + V.ty + n.r * V.s + 3;
    if (sx < -100 || sx > w + 100 || sy < -20 || sy > h + 20) continue;
    const t = n.l.length > 42 ? n.l.slice(0, 40) + '…' : n.l;
    x.lineWidth = 3; x.strokeStyle = gd.farben.schatten; x.strokeText(t, sx, sy);
    x.fillStyle = gd.farben.text; x.fillText(t, sx, sy);
  }
}
function gdTreffe(ev) {
  const c = document.getElementById('gd-canvas');
  const s = gd.sim;
  if (!c || !s) return -1;
  const b = c.getBoundingClientRect();
  const wx = (ev.clientX - b.left - gd.V.tx) / gd.V.s, wy = (ev.clientY - b.top - gd.V.ty) / gd.V.s;
  let best = -1, bestD = Infinity;
  for (const n of s.N) {
    if (gd.aus.has(n.g)) continue;
    const dd = Math.hypot(n.x - wx, n.y - wy);
    if (dd < n.r + 4 / gd.V.s && dd < bestD) { best = n.i; bestD = dd; }
  }
  return best;
}
function gdZoom(faktor, mx, my) {
  const c = document.getElementById('gd-canvas');
  if (!c) return;
  const V = gd.V;
  if (mx == null) { mx = c.clientWidth / 2; my = c.clientHeight / 2; }
  const neu = Math.min(12, Math.max(0.05, V.s * faktor));
  V.tx = mx - (mx - V.tx) * neu / V.s;
  V.ty = my - (my - V.ty) * neu / V.s;
  V.s = neu;
  gd.auto = false;
  gdMaleBald();
}

/* ---------- Seite ---------- */
function gdSeite(w) {
  w.innerHTML = '<div class="gd" data-screen-label="' + esc(uebersetze('Gedächtnis')) + '">' +
    '<canvas class="gd-canvas" id="gd-canvas" tabindex="0" role="img" aria-label="' + esc(uebersetze('Graph der Notizen. Pfeiltasten verschieben, Plus und Minus zoomen, 0 zeigt alles. Notizen öffnest du über die Suche oder die Legende.')) + '"></canvas>' +
    '<div class="gd-oben"><form class="gd-suche" id="gd-suche" role="search">' +
      '<input type="search" id="gd-q" autocomplete="off" maxlength="200" placeholder="' + esc(uebersetze('Gedächtnis durchsuchen …')) + '" aria-label="' + esc(uebersetze('Gedächtnis durchsuchen')) + '">' +
      '<button type="submit" class="knopf klein" id="gd-frag">' + esc(uebersetze('Cira fragen')) + '</button></form>' +
      '<div class="gd-treffer" id="gd-treffer" aria-live="polite"></div></div>' +
    '<div class="gd-unten"><div class="gd-legende" id="gd-legende" role="group" aria-label="' + esc(uebersetze('Gruppen')) + '"></div><span class="gd-statistik mono" id="gd-statistik"></span></div>' +
    '<div class="gd-zoom">' +
      '<button type="button" data-aktion="gd-zoom" data-wert="rein" aria-label="' + esc(uebersetze('Vergrößern')) + '">+</button>' +
      '<button type="button" data-aktion="gd-zoom" data-wert="raus" aria-label="' + esc(uebersetze('Verkleinern')) + '">−</button>' +
      '<button type="button" data-aktion="gd-zoom" data-wert="alles" aria-label="' + esc(uebersetze('Alles zeigen')) + '">⤢</button></div>' +
    '<aside class="gd-panel" id="gd-panel" hidden aria-label="Notiz"></aside>' +
  '</div>';
  const c = w.querySelector('#gd-canvas');
  c.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    c.setPointerCapture(e.pointerId);
    gd.zieh = { x: e.clientX, y: e.clientY, tx: gd.V.tx, ty: gd.V.ty, bewegt: false };
  });
  c.addEventListener('pointermove', (e) => {
    if (gd.zieh) {
      const dx = e.clientX - gd.zieh.x, dy = e.clientY - gd.zieh.y;
      if (!gd.zieh.bewegt && Math.hypot(dx, dy) < 4) return;
      gd.zieh.bewegt = true;
      gd.auto = false;
      gd.V.tx = gd.zieh.tx + dx; gd.V.ty = gd.zieh.ty + dy;
      gdMaleBald();
      return;
    }
    const h = gdTreffe(e);
    if (h !== gd.hover) { gd.hover = h; c.style.cursor = h >= 0 ? 'pointer' : ''; gdMaleBald(); }
  });
  c.addEventListener('pointerup', (e) => {
    const z = gd.zieh;
    gd.zieh = null;
    if (z && !z.bewegt) { const h = gdTreffe(e); if (h >= 0) gdOeffne(gd.sim.N[h].id); }
  });
  c.addEventListener('pointerleave', () => { if (gd.hover !== -1 && !gd.zieh) { gd.hover = -1; gdMaleBald(); } });
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    const b = c.getBoundingClientRect();
    gdZoom(Math.exp(-e.deltaY * 0.0015), e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });
  c.addEventListener('keydown', (e) => {
    const schritt = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (schritt) { e.preventDefault(); gd.auto = false; gd.V.tx += schritt[0]; gd.V.ty += schritt[1]; gdMaleBald(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); gdZoom(1.25); }
    else if (e.key === '-') { e.preventDefault(); gdZoom(0.8); }
    else if (e.key === '0') { e.preventDefault(); gd.auto = true; gdMaleBald(); }
  });
  let uhr = null;
  const q = w.querySelector('#gd-q');
  q.value = gd.q;
  q.addEventListener('input', () => { clearTimeout(uhr); uhr = setTimeout(() => gdSuche(q.value, false), 250); });
  w.querySelector('#gd-suche').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(uhr); gdSuche(q.value, true); });
  w.querySelector('.gd').addEventListener('keydown', (e) => { if (e.key === 'Escape' && gd.notizPfad) { e.preventDefault(); gdSchliesse(); } });
}
window.addEventListener('resize', () => { if (route().name === 'gedaechtnis') gdMaleBald(); });

function gdSuche(text, fragen) {
  gd.q = String(text || '').trim();
  const lauf = ++gd.sucheLauf;
  if (!gd.q) { gd.treffer = null; gd.antwort = null; gd.fragt = false; gdZeichneTreffer(); gdMaleBald(); return; }
  gd.fragt = !!fragen;
  if (fragen) gd.antwort = null;
  gdZeichneTreffer();
  hole('/api/gedaechtnis/suche?' + abfrage({ q: gd.q, antwort: fragen ? 1 : null })).then((r) => {
    if (lauf !== gd.sucheLauf) return;
    gd.treffer = r.treffer;
    if (fragen) gd.antwort = r.antwort ? { text: r.antwort.text, modell: r.antwort.modell } : r.fehlt ? { fehlt: r.fehlt } : null;
  }, (e) => { if (lauf === gd.sucheLauf) { gd.treffer = []; gd.antwort = { fehlt: e.grund || e.message }; } })
    .then(() => { if (lauf === gd.sucheLauf) { gd.fragt = false; gdZeichneTreffer(); gdMaleBald(); } });
}
function gdZeichneTreffer() {
  const el = document.getElementById('gd-treffer');
  if (!el) return;
  if (!gd.q) { el.innerHTML = ''; return; }
  const a = gd.antwort;
  el.innerHTML = (gd.fragt ? '<div class="gd-antwort dim">' + esc(uebersetze('Cira denkt nach …')) + '</div>'
    : a ? '<div class="gd-antwort">' + (a.fehlt ? '<span class="dim">' + esc(a.fehlt) + '</span>' : esc(a.text) + '<span class="gd-quelle mono">' + esc(uebersetze('lokal') + ' · ' + a.modell + ' · 0 €') + '</span>') + '</div>' : '') +
    (gd.treffer && !gd.treffer.length ? '<div class="dim gd-keine">' + esc(uebersetze('Keine Notiz passt.')) + '</div>' : '') +
    (gd.treffer || []).map((t) => '<button type="button" class="gd-zeile" data-aktion="gd-oeffne" data-wert="' + esc(t.pfad) + '">' +
      '<span class="punkt" style="background:' + esc(gdPunkt(t.pfad)) + '" aria-hidden="true"></span><span class="t">' + esc(t.titel) + '</span><span class="o mono">' + esc(t.ordner || uebersetze('Wurzel')) + '</span></button>').join('');
}
function gdPunkt(pfad) {
  const n = gd.sim && gd.sim.N.find((k) => k.id === pfad);
  if (!n) return 'var(--text-faint)';
  if (!gd.farben) gd.farben = gdFarben();
  return gdFarbeVon(n.g);
}
function gdGruppenName(id) {
  if (id.startsWith('tag:')) return id.slice(4);
  if (id.startsWith('path:')) return id.slice(5) + '/';
  const o = id.replace(/^ordner:/, '');
  return o ? o + '/' : uebersetze('Wurzel');
}
function gdZeichneLegende() {
  const el = document.getElementById('gd-legende');
  const st = document.getElementById('gd-statistik');
  if (!el || !gd.daten) return;
  if (!gd.farben) gd.farben = gdFarben();
  el.innerHTML = gd.daten.gruppen.map((g) => '<button type="button" class="gd-gruppe" data-aktion="gd-gruppe" data-wert="' + esc(g.id) + '" aria-pressed="' + !gd.aus.has(g.id) + '">' +
    '<span class="punkt" style="background:' + esc(gdFarbeVon(g.id)) + '" aria-hidden="true"></span>' + esc(gdGruppenName(g.id)) + '<span class="n mono">' + g.n + '</span></button>').join('');
  if (st) st.textContent = fuelle('{n} Notizen · {m} Links · {k} ohne Link', { n: gd.daten.knoten.length, m: gd.daten.kanten.length, k: gd.daten.knoten.filter((k) => k.waise).length });
}

/* ---------- Notiz ---------- */
function gdOeffne(pfad) {
  if (!pfad) return;
  // Wikilink-Ziel (ohne .md, ohne oder mit Ordner) -> Pfad einer Notiz.
  let p = pfad;
  if (gd.sim && !gd.sim.N.some((n) => n.id === p)) {
    const z = String(pfad).toLowerCase().replace(/\.md$/, '');
    const n = gd.sim.N.find((k) => k.id.toLowerCase().replace(/\.md$/, '') === z) || gd.sim.N.find((k) => k.id.toLowerCase().replace(/\.md$/, '').split('/').pop() === z.split('/').pop());
    if (n) p = n.id;
  }
  geheZu('gedaechtnis/' + encodeURIComponent(p));
}
aktion('gd-oeffne', (wert) => gdOeffne(wert));
aktion('gd-schliessen', () => gdSchliesse());
function gdSchliesse() { geheZu('gedaechtnis'); }
aktion('gd-zoom', (w) => { if (w === 'rein') gdZoom(1.25); else if (w === 'raus') gdZoom(0.8); else { gd.auto = true; gdMaleBald(); } });
aktion('gd-gruppe', (id, el) => {
  if (gd.aus.has(id)) gd.aus.delete(id); else gd.aus.add(id);
  merke('gd.aus', [...gd.aus]);
  el.setAttribute('aria-pressed', String(!gd.aus.has(id)));
  gdMaleBald();
});
function gdLadeNotiz(pfad) {
  gd.notizPfad = pfad;
  gd.notiz = null;
  gd.notizFehler = null;
  gd.gewaehlt = gd.sim ? gd.sim.N.findIndex((n) => n.id === pfad) : -1;
  gdZeichnePanel();
  gdMaleBald();
  hole('/api/gedaechtnis/notiz?' + abfrage({ pfad })).then((n) => { if (gd.notizPfad === pfad) gd.notiz = n; },
    (e) => { if (gd.notizPfad === pfad) gd.notizFehler = e.status === 404 ? uebersetze('Notiz nicht gefunden.') : (e.grund || e.message); })
    .then(() => { if (gd.notizPfad === pfad) gdZeichnePanel(); });
}
function gdZeichnePanel() {
  const el = document.getElementById('gd-panel');
  if (!el) return;
  if (!gd.notizPfad) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const zu = '<button type="button" class="mini-knopf gd-zu" data-aktion="gd-schliessen" aria-label="' + esc(uebersetze('Notiz schließen')) + '">×</button>';
  const n = gd.notiz;
  if (!n) { el.innerHTML = zu + '<div class="gd-pfad mono">' + esc(gd.notizPfad) + '</div><p class="dim">' + esc(gd.notizFehler || uebersetze('Notiz lädt …')) + '</p>'; return; }
  const fm = n.frontmatter || {};
  const meta = fm.metadata && typeof fm.metadata === 'object' ? fm.metadata : {};
  const eig = [['Beschreibung', fm.description], ['Art', meta.type || fm.type], ['Erstellt', fm.created || meta.created], ['Geändert', meta.modified || fm.modified]]
    .filter(([, v]) => typeof v === 'string' && v.trim());
  const b = n.bezug;
  const bezug = n.sitzung ? '<section class="gd-bezug"><span class="ueberzeile">' + esc(uebersetze('Entstanden in · aus c2invoice')) + '</span>' + (b
    ? '<dl>' + [['Vorgang', b.vorgang], ['Projekt', b.projekt], ['Zeitraum', b.von ? datum(b.von) + (b.bis && b.bis.slice(0, 10) !== b.von.slice(0, 10) ? ' – ' + datum(b.bis) : '') : null],
      ['Tokens', kurz(b.tokens)], ['API-Gegenwert', eur(b.kosten_eur)], ['Sitzung', n.sitzung.slice(0, 8)]].filter(([, v]) => v).map(([k, v]) => '<dt>' + esc(uebersetze(k)) + '</dt><dd class="mono">' + esc(v) + '</dd>').join('') + '</dl>' +
      (b.vorgang ? '<div class="gd-bezug-knoepfe"><a class="knopf klein" href="#/vorgaenge/' + esc(encodeURIComponent(b.vorgang)) + '">' + esc(b.vorgang) + '</a>' +
        (b.rechnungen || []).map((r) => '<a class="pille" href="#/rechnungen">' + esc(uebersetze('abgerechnet') + ' ' + r) + '</a>').join('') + '</div>' : '')
    : '<p class="dim">' + esc(uebersetze('Diese Sitzung kennt der Ledger nicht (älter als die Logs oder anderer Rechner).')) + '</p>') + '</section>' : '';
  const liste = (titel, l) => (l.length ? '<section><span class="ueberzeile">' + esc(uebersetze(titel)) + ' · ' + l.length + '</span><div class="gd-links">' +
    l.map((x) => '<button type="button" class="spur-pille" data-aktion="gd-oeffne" data-wert="' + esc(x.pfad) + '">' + esc(x.titel || x.pfad) + '</button>').join('') + '</div></section>' : '');
  el.innerHTML = zu + '<div class="gd-pfad mono">' + esc(n.pfad) + '</div><h2 class="gd-titel">' + esc(n.titel) + '</h2>' +
    (eig.length ? '<dl class="gd-eig">' + eig.map(([k, v]) => '<dt>' + esc(uebersetze(k)) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl>' : '') +
    (n.tags.length ? '<div class="gd-tags">' + n.tags.map((t) => '<span class="gd-tag">#' + esc(t) + '</span>').join('') + '</div>' : '') +
    bezug + '<div class="gd-text">' + md(n.rumpf, { wiki: true }) + '</div>' + liste('Verlinkt', n.links) + liste('Verweist hierher', n.rueck) +
    '<div class="gd-fuss"><a class="knopf klein" href="' + esc(n.obsidian) + '">' + esc(uebersetze('In Obsidian öffnen')) + '</a><span class="faint mono">' + esc(fuelle('{n} Wörter', { n: n.worte })) + '</span></div>';
}

function zeichneGedaechtnis(w, teile, neu) {
  const pfad = teile[0] || null;
  if (!gd.daten && !gd.fehler) { gdLade(); w.innerHTML = '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>'; return; }
  if (gd.fehler && !gd.daten) {
    w.innerHTML = leer('liste', 'Gedächtnis nicht geladen', gd.fehler, '<button type="button" class="knopf klein" data-aktion="gd-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>');
    return;
  }
  if (!gd.daten.vault) { w.innerHTML = leer('liste', 'Kein Vault eingerichtet', 'Trag in config.json einen Arbeitsbereich mit art „vault“ und pfad ein.'); return; }
  if (!gd.daten.knoten.length) { w.innerHTML = leer('liste', 'Der Vault ist leer.', 'Noch keine Notizen im Index. Er läuft alle 30 Sekunden.'); return; }
  // Seite steht schon (15-s-Takt, Notizwechsel): nur Teile neu, der Graph laeuft weiter.
  if (neu || !w.querySelector('.gd') || w.querySelector('.gd').dataset.sprache !== SPRACHE) {
    gdSeite(w);
    w.querySelector('.gd').dataset.sprache = SPRACHE;
    gd.farben = null;
  }
  gdZeichneLegende();
  gdZeichneTreffer();
  if (pfad !== gd.notizPfad) { if (pfad) gdLadeNotiz(pfad); else { gd.notizPfad = null; gd.notiz = null; gd.gewaehlt = -1; gdZeichnePanel(); } }
  else gdZeichnePanel();
  gdStarte();
}
aktion('gd-neu', () => { gd.fehler = null; gdLade(true); });
registriere('gedaechtnis', {
  zeichne: zeichneGedaechtnis,
  // 15-s-Takt: neuer Index-Stand -> neuer Graph.
  live() { if (route().name === 'gedaechtnis') gdLade(); },
});
