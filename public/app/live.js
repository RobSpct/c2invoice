'use strict';
/* Live: was gerade laeuft. Verbrauchsrate, Token-Strom der letzten Stunde,
   Modelle der laufenden Stunde, Sitzungen mit Spur (abrechenbare Fenster und
   Agentenzeit), Buchen auf einen Vorgang und Zeitmodell je Sitzung. */

Object.assign(EN, {
  'Listenpreis, letzte 60 Min hochgerechnet — kein Stundenpreis': 'List price, last 60 min extrapolated — not an hourly price',
  'Token-Strom': 'Token stream', 'Tokens je Minute, letzte 60 Min — neue Minute schiebt von rechts ein': 'Tokens per minute, last 60 min — each new minute enters from the right',
  'Tokens heute': 'Tokens today', 'API-Gegenwert heute': 'API equivalent today', 'Requests heute': 'Requests today', 'Aktiv heute': 'Active today',
  'Modelle, laufende Stunde': 'Models, current hour', 'Aktive Sitzungen': 'Active sessions', 'letzte 60 Minuten': 'last 60 minutes',
  'abrechenbar — Fenster um deine Eingaben': 'billable — window around your inputs', 'Agentenzeit — nicht abgerechnet': 'agent time — not billed',
  'Arbeit ohne Ticket-Branch trägt keinen Vorgang und bleibt damit unabrechenbar. Im Feld Vorgang lässt sich eine Sitzung von Hand buchen — ein Jira-Schlüssel oder ein frei gewählter Name. In der Spalte Zeitmodell legst du je Sitzung fest, wie ihre Zeit zählt. Gedrückt ist, was gilt; ohne eigene Wahl ist das der Standard aus Vorgang, Projekt oder Einstellungen.':
    'Work without a ticket branch carries no job and cannot be billed. In the Job field you can book a session by hand — a Jira key or any name. In the time model column you decide per session how its time counts. The pressed button is what applies; without your own choice that is the default from job, project or settings.',
  'ohne Vorgang': 'no job', 'Buchen': 'Book', 'Modell': 'Model', 'Tokens': 'Tokens', 'Agent': 'Agent', 'zuletzt': 'last',
  'Keine Sitzung in der letzten Stunde': 'No session in the last hour', 'Starte eine Claude-Code-Sitzung — sie erscheint hier nach dem nächsten Abgleich.': 'Start a Claude Code session — it appears here after the next sync.',
  'Gebucht auf': 'Booked to', 'Buchung aufgehoben': 'Booking removed', 'Buchen fehlgeschlagen': 'Booking failed', 'Vorgang ändern': 'Change job',
  'aus Branch': 'from branch', 'von Hand': 'by hand', 'zugeordnet': 'assigned', 'Werkzeuge im Hintergrund': 'Background tools', 'Subagent': 'Subagent',
  'Du': 'You', 'Kein Timer — Zeit läuft nur über Claude': 'No timer — time runs only through Claude', '∥ parallel zu Claude': '∥ parallel to Claude', 'Regel': 'rule',
  'Zeitmodell gespeichert': 'Time model saved', 'Zeitmodell nicht gespeichert': 'Time model not saved', 'Eigene Wahl': 'Own choice', 'Standard wäre': 'default would be',
  'Geerbt aus Vorgang, Projekt oder Einstellungen': 'Inherited from job, project or settings', 'Eigene Zeit': 'Own time',
});

const liveZustand = { bearbeiten: {} };   // Sitzungen, deren Vorgangsfeld offen ist

// Zeilen je Sitzung zusammenfassen (der Server liefert je Sitzung und Modell).
function sitzungenGruppiert(L) {
  const m = new Map();
  for (const r of L.sessions) {
    let s = m.get(r.session_id);
    if (!s) { s = { ...r, modelle: [], teile: [], total_tokens: 0, cost_usd: 0, subagent: false }; m.set(r.session_id, s); }
    // Je Modell (und Subagent) eigene Kosten, wie die Zeilen der bisherigen Ansicht.
    s.teile.push({ modell: kurzModell(r.model), sub: !!r.is_sidechain, tokens: r.total_tokens, usd: r.cost_usd });
    if (!s.modelle.includes(kurzModell(r.model))) s.modelle.push(kurzModell(r.model));
    s.total_tokens += r.total_tokens;
    s.cost_usd += r.cost_usd;
    s.subagent = s.subagent || r.is_sidechain;
    if (r.last_ts > s.last_ts) s.last_ts = r.last_ts;
  }
  return [...m.values()];
}

function liveGauge(b) {
  const a = Math.max(0, Math.min(1, b / 30));
  const L = Math.PI * 90;
  const nadel = -90 + a * 180;
  return '<svg viewBox="0 0 240 140" class="live-gauge" aria-hidden="true">' +
    '<path d="M30,120 A90,90 0 0 1 210,120" fill="none" stroke="var(--line-soft)" stroke-width="16"/>' +
    '<path d="M30,120 A90,90 0 0 1 210,120" fill="none" stroke="var(--ok)" stroke-opacity=".28" stroke-width="16" stroke-dasharray="94.2 400"/>' +
    '<path d="M30,120 A90,90 0 0 1 210,120" fill="none" stroke="var(--warn)" stroke-opacity=".28" stroke-width="16" stroke-dasharray="0 94.2 94.2 400"/>' +
    '<path d="M30,120 A90,90 0 0 1 210,120" fill="none" stroke="var(--bad)" stroke-opacity=".28" stroke-width="16" stroke-dasharray="0 188.4 94.4 400"/>' +
    '<path d="M30,120 A90,90 0 0 1 210,120" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (a * L).toFixed(1) + ' 400" class="gauge-bogen"/>' +
    '<g class="nadel" style="transform-origin:120px 120px;transform:rotate(' + nadel.toFixed(1) + 'deg)"><path d="M118,120 L120,42 L122,120 Z" fill="var(--text)"/></g>' +
    '<circle cx="120" cy="120" r="8" fill="var(--bg)" stroke="var(--text)" stroke-width="3"/>' +
    '<text x="30" y="138" text-anchor="middle" fill="var(--text-gruppe)" font-size="11">0</text>' +
    '<text x="210" y="138" text-anchor="middle" fill="var(--text-gruppe)" font-size="11">30</text></svg>';
}

function spurHtml(s) {
  const sp = s.spur || { fenster: [], agent: [] };
  // Das Fenster um eine Eingabe reicht ueber "jetzt" hinaus — gezeichnet wird bis jetzt (60).
  const seg = (a, b, klasse) => '<span class="' + klasse + '" style="left:' + (a / 60 * 100).toFixed(2) + '%;width:' + Math.max(0.4, (Math.min(b, 60) - a) / 60 * 100).toFixed(2) + '%"></span>';
  const ende = sp.agent.length ? sp.agent[sp.agent.length - 1][1] : null;
  return '<div class="spur">' + sp.agent.map(([a, b]) => seg(a, b, 'agent')).join('') + sp.fenster.map(([a, b]) => seg(a, b, 'fenster')).join('') +
    (istAktiv(s.last_ts) && ende != null ? '<span class="puls" style="left:calc(' + (ende / 60 * 100).toFixed(2) + '% - 4px)"></span>' : '') + '</div>';
}

const QUELLE = { branch: 'aus Branch', override: 'von Hand', session: 'zugeordnet', fenster: 'zugeordnet', cwd: 'zugeordnet' };

function sitzungHtml(s) {
  const offen = liveZustand.bearbeiten[s.session_id] || !s.ticket;
  const vorgang = offen
    ? '<form class="buchen" data-session="' + esc(s.session_id) + '"><input name="vorgang" value="' + esc(s.ticket || '') + '" placeholder="' + esc(uebersetze('ohne Vorgang')) + '" maxlength="40" aria-label="' + esc(uebersetze('Vorgang')) + '">' +
      '<button type="submit" class="knopf klein akzent-rand">' + esc(uebersetze('Buchen')) + '</button>' +
      (s.ticket ? '<button type="button" class="knopf klein geist" data-aktion="live-abbrechen" data-wert="' + esc(s.session_id) + '">' + esc(uebersetze('Abbrechen')) + '</button>' : '') + '</form>'
    : '<button type="button" class="gebucht" data-aktion="live-bearbeiten" data-wert="' + esc(s.session_id) + '" title="' + esc(uebersetze('Vorgang ändern')) + '"><b class="mono">' + esc(s.ticket) + '</b><span>' + esc(uebersetze(QUELLE[s.ticket_quelle] || 'zugeordnet')) + '</span></button>';
  const stat = (wert, label) => '<span><span class="mono">' + wert + '</span><span class="faint">' + esc(label) + '</span></span>';
  const laeuft = istAktiv(s.last_ts);
  return '<div class="sitzung' + (laeuft ? ' laeuft' : '') + '">' +
    '<div class="sitzung-kopf">' +
      '<div class="wer"><span class="punkt' + (laeuft ? ' an' : '') + '" aria-hidden="true"></span><div><span class="ell"><b>' + esc(s.project || '–') + '</b></span><span class="faint ell mono">' + esc(s.branch || '') + '</span></div></div>' +
      '<div class="vorgang">' + vorgang + '</div>' +
      zeitmodellSchalter('sitzung', s.session_id, s.zeitmodell_wahl, s.zeitmodell_erbt) +
      '<div class="werte">' + stat(esc(s.modelle.join(', ')) + (s.subagent ? ' <span class="pille">' + esc(uebersetze('Subagent')) + '</span>' : ''), uebersetze('Modell')) +
        stat(kurz(s.total_tokens), uebersetze('Tokens')) + stat(nf2.format(s.cost_usd), 'USD') +
        stat(hrs(s.active_seconds / 3600), uebersetze('Agent') + ' ' + hrs(s.agent_seconds / 3600)) +
        '<span class="zuletzt"><span class="mono' + (laeuft ? ' ok' : '') + '">' + esc(vor(s.last_ts)) + '</span><span class="faint">' + esc(uebersetze('zuletzt')) + '</span></span></div>' +
    '</div>' + zSitzWahl(s.session_id, s.wahl) + (s.teile.length > 1 ? '<div class="sitzung-modelle">' + s.teile.map((t) =>
      '<span><span class="mono">' + esc(t.modell) + '</span>' + (t.sub ? ' <span class="pille">' + esc(uebersetze('Subagent')) + '</span>' : '') +
      ' <span class="faint">' + kurz(t.tokens) + ' · ' + nf2.format(t.usd) + ' USD</span></span>').join('') + '</div>' : '') +
    spurHtml(s) + '</div>';
}

// Werkzeuge begleiten die Sitzungen und stehen nicht als eigene Zeilen da;
// ihr Verbrauch wird gesammelt genannt, damit er nicht unsichtbar wird.
function werkzeugZeile(L) {
  const wz = Array.isArray(L.werkzeuge) ? L.werkzeuge : [];
  if (!wz.length) return '';
  const usdSumme = wz.reduce((a, x) => a + (x.cost_usd || 0), 0);
  const tok = wz.reduce((a, x) => a + (x.total_tokens || 0), 0);
  return '<div class="sitzung werkzeug-zeile"><div class="sitzung-kopf"><div class="wer"><span class="punkt" aria-hidden="true"></span><div>' +
    '<b>' + esc(uebersetze('Werkzeuge im Hintergrund')) + ' · ' + esc(uebersetze('heute')) + '</b><span class="faint ell">' + esc(wz.map((x) => x.projekt).join(', ')) + '</span></div></div>' +
    '<div class="werte"><span><span class="mono">' + kurz(tok) + '</span><span class="faint">' + esc(uebersetze('Tokens')) + '</span></span>' +
    '<span><span class="mono">' + nf2.format(usdSumme) + '</span><span class="faint">USD</span></span>' +
    '<span class="faint">' + esc(uebersetze('nicht abrechenbar')) + '</span></div></div></div>';
}

// Karte „Du“ (Mockup Z. 904–922): Timer, Arbeitszeit heute, als Naechstes heute und
// Restkapazitaet (zNaechsteHeute in zeit.js, Zahl vom Server).
function liveDu() {
  zHeuteLaden();
  const t = zTimer();
  const v = t && zHeute.d && zHeute.d.timer && zHeute.d.timer.vorschau;
  let ov = '';
  if (v && v.sitzungen.length) {
    const [wert, klasse] = zTimerUeberlappung(v);
    const eff = t.wahlen && Object.keys(t.wahlen).length ? zEffWahl(v.sitzungen) : null;
    ov = '<span class="du-ov">' + esc(uebersetze('∥ parallel zu Claude')) + '<b class="mono ' + klasse + '">' + esc(wert) + '</b><span class="faint">· ' + esc(uebersetze(eff ? ZWL[eff] : 'Regel')) + '</span></span>';
  }
  return '<section class="karte du-reihe">' +
    '<div class="zh-spalte"><div class="du-status' + (t ? ' laeuft' : '') + '"><span class="zt-punkt"></span><span class="label">' + esc(uebersetze('Du') + ' · ' + uebersetze(t ? 'Timer läuft' : 'Kein Timer aktiv')) + '</span></div>' +
      '<span class="du-uhr mono zeit-uhr">' + (t ? uhrText(Date.now() - Date.parse(t.start)) : '00:00:00') + '</span>' +
      '<span class="hinweis">' + esc(t ? zielKurz(t.ziel_art, t.ziel_schluessel) + ' · ' + t.taetigkeit + ' · ' + uebersetze('seit') + ' ' + zhm(t.start) + ' ' + uebersetze('Uhr') : uebersetze('Kein Timer — Zeit läuft nur über Claude')).trim() + '</span>' +
      ov + '<a class="knopf klein du-link" href="#/zeit">' + esc(uebersetze('Zur Zeiterfassung')) + ' →</a></div>' +
    zArbeitHeute(false) + zNaechsteHeute() +
  '</section>';
}

function zeichneLive(w) {
  const L = state.live;
  if (!L) { w.innerHTML = state.fehler.live ? leer('liste', 'Server nicht erreichbar', 'Es wird weiter versucht.') : '<div class="leer">…</div>'; return; }
  // Laufende Eingabe beim Neuzeichnen (alle 15 s) nicht verlieren.
  const aktivFeld = document.activeElement && document.activeElement.closest && document.activeElement.closest('form.buchen');
  const merk = aktivFeld ? { id: aktivFeld.dataset.session, wert: aktivFeld.vorgang.value } : null;
  ladeHubDaten();
  const b = L.burn_usd_per_hour;
  const m = L.minuten || [];
  const mmax = Math.max(...m, 1);
  const T = L.today;
  const heuteH = (stundenJeTag()[isoTag(new Date())] || 0);
  // Modelle der laufenden Stunde: Anteile am API-Gegenwert der Sitzungszeilen.
  const jeModell = new Map();
  for (const r of L.sessions) jeModell.set(kurzModell(r.model), (jeModell.get(kurzModell(r.model)) || 0) + r.cost_usd);
  const ringDaten = ring([...jeModell].sort((a, c) => c[1] - a[1]).map(([n, v], i) => ({ n, v, c: modellFarbe(i) })), 40, 0.012);
  const S = sitzungenGruppiert(L);

  w.innerHTML =
    '<div class="live-reihe">' +
      '<div class="karte weit live-rate-karte"><div class="live-rate-kopf"><span class="puls"' + (S.some((s) => istAktiv(s.last_ts)) ? '' : ' style="animation:none;background:var(--text-gruppe)"') + '></span>' +
        '<span class="label">' + esc(uebersetze('Verbrauchsrate')) + '</span><span class="hinweis">' + esc(uebersetze('Listenpreis, letzte 60 Min hochgerechnet — kein Stundenpreis')) + '</span></div>' +
        liveGauge(b) + '<div class="live-rate-zahl"><span class="mono akzent">' + nf2.format(b) + '</span><span class="faint">USD /h</span></div></div>' +
      '<div class="karte weit live-strom"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Token-Strom')) + '</h2>' +
          '<span class="hinweis">' + esc(uebersetze('Tokens je Minute, letzte 60 Min — neue Minute schiebt von rechts ein')) + '</span></div>' +
        '<div class="live-kpis">' +
          '<div><span class="label">' + esc(uebersetze('Tokens heute')) + '</span><span class="instr-wert">' + nf1.format(T.total_tokens / 1e6) + '<span>Mio</span></span></div>' +
          '<div><span class="label">' + esc(uebersetze('API-Gegenwert heute')) + '</span><span class="instr-wert akzent">' + nf2.format(T.cost_usd) + '<span>USD</span></span></div>' +
          '<div><span class="label">' + esc(uebersetze('Requests heute')) + '</span><span class="instr-wert">' + num(T.requests) + '</span></div>' +
          '<div><span class="label">' + esc(uebersetze('Aktiv heute')) + '</span><span class="instr-wert">' + nf1.format(heuteH) + '<span>h</span></span></div>' +
        '</div>' +
        '<div class="strom gross">' + m.map((v, i) => '<span title="' + esc('−' + (59 - i) + ' Min · ' + num(v) + ' Tokens') + '" style="height:' + (v ? Math.max(3, v / mmax * 100) : 1.5).toFixed(1) + '%;background:' +
          (i === 59 ? 'var(--text)' : i >= 54 ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 55%, transparent)') + '"></span>').join('') + '</div>' +
        '<div class="strom-achse"><span>−60</span><span>−45</span><span>−30</span><span>−15</span><span class="ok">' + esc(uebersetze('jetzt')) + '</span></div></div>' +
      '<div class="karte weit live-ring"><span class="label">' + esc(uebersetze('Modelle, laufende Stunde')) + '</span>' +
        (ringDaten.length ? ringSvg(ringDaten, 140, 14) +
          '<div class="live-ring-legende">' + ringDaten.map((x) => '<span><span class="leg-p" style="background:' + x.c + '"></span><span class="mono">' + esc(x.n) + '</span><b>' + nf1.format(x.anteil * 100) + ' %</b></span>').join('') + '</div>'
          : leer('liste', 'Keine Modelle im Zeitraum')) + '</div>' +
    '</div>' +
    liveDu() +
    '<div class="karte weit">' +
      '<div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Aktive Sitzungen')) + '</h2><span class="hinweis">' + esc(uebersetze('letzte 60 Minuten')) + '</span>' + infoI('live') +
        '<span class="rechts spur-legende"><span><span class="leg-p" style="width:14px;height:6px;background:var(--accent)"></span>' + esc(uebersetze('abrechenbar — Fenster um deine Eingaben')) + '</span>' +
        '<span><span class="leg-p" style="width:14px;height:2px;vertical-align:middle;background:var(--spur-agent)"></span>' + esc(uebersetze('Agentenzeit — nicht abgerechnet')) + '</span></span></div>' +
      infoText('live', 'Arbeit ohne Ticket-Branch trägt keinen Vorgang und bleibt damit unabrechenbar. Im Feld Vorgang lässt sich eine Sitzung von Hand buchen — ein Jira-Schlüssel oder ein frei gewählter Name. In der Spalte Zeitmodell legst du je Sitzung fest, wie ihre Zeit zählt. Gedrückt ist, was gilt; ohne eigene Wahl ist das der Standard aus Vorgang, Projekt oder Einstellungen.') +
      (S.length ? '<div class="sitzungen">' + S.map(sitzungHtml).join('') + werkzeugZeile(L) + '</div><div class="strom-achse"><span>−60 Min</span><span>−30</span><span>' + esc(uebersetze('jetzt')) + '</span></div>'
        : leer('uhr', 'Keine Sitzung in der letzten Stunde', 'Starte eine Claude-Code-Sitzung — sie erscheint hier nach dem nächsten Abgleich.') +
          (werkzeugZeile(L) ? '<div class="sitzungen">' + werkzeugZeile(L) + '</div>' : '')) +
    '</div>';

  if (merk) {
    const f = w.querySelector('form.buchen[data-session="' + CSS.escape(merk.id) + '"] input');
    if (f) { f.value = merk.wert; f.focus(); }
  }
}

aktion('live-abbrechen', (id) => { delete liveZustand.bearbeiten[id]; zeichneAnsicht(); });
document.addEventListener('keydown', (e) => {
  const form = e.key === 'Escape' && e.target.closest && e.target.closest('form.buchen');
  if (!form || !liveZustand.bearbeiten[form.dataset.session]) return;
  e.preventDefault();
  e.target.blur();
  AKTIONEN['live-abbrechen'](form.dataset.session);
});
aktion('live-bearbeiten', (id) => {
  liveZustand.bearbeiten[id] = true;
  zeichneAnsicht();
  const f = document.querySelector('form.buchen[data-session="' + CSS.escape(id) + '"] input');
  if (f) f.focus();
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest && e.target.closest('form.buchen');
  if (!form) return;
  e.preventDefault();
  const knopf = form.querySelector('button');
  const id = form.dataset.session;
  const vorgang = form.vorgang.value.trim();
  await mitLauf(knopf, async () => {
    try {
      const a = await sende('/api/buchen', { session_id: id, vorgang });
      toast(a.ticket ? uebersetze('Gebucht auf') + ' ' + a.ticket : uebersetze('Buchung aufgehoben'), 'ok');
      delete liveZustand.bearbeiten[id];
      neuLaden();
    } catch (err) { toast(uebersetze('Buchen fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
});

registriere('live', { zeichne: zeichneLive, live() { if (route().name === 'live') zeichneAnsicht(); } });
