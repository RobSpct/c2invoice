'use strict';
/* Briefings (C9a, README §6.9): Berichte aus dem Vault als Posteingang. Liste
   links mit Filter nach Quelle und Gruppen nach Datum, rechts das Briefing mit
   Kurzfassung auf Klick (T1, gecacht), To-dos zum Abhaken und dem Text.
   Vault-Health-To-dos sind nur Anzeige (E8). Vorlesen (C10) liest die
   Kurzfassung, sonst den Text; die Stimme waehlt sprache.js. */

Object.assign(EN, {
  'Briefings': 'Briefings', 'Alle': 'All', 'Heute': 'Today', 'Diese Woche': 'This week', 'Früher': 'Earlier', 'Ohne Datum': 'Undated',
  '{n} offen': '{n} open', 'Quelle: {o}/ im Vault · geschrieben von n8n, Skills und c2invoice': 'Source: {o}/ in the vault · written by n8n, skills and c2invoice',
  'Kein Briefing gewählt': 'No briefing selected', 'Links ein Briefing öffnen.': 'Open a briefing on the left.',
  'Keine Briefings': 'No briefings', 'Im Ordner {o}/ des Vaults liegt noch nichts.': 'Nothing in the vault folder {o}/ yet.',
  'Ordner {o}/ fehlt im Vault.': 'Folder {o}/ is missing in the vault.', 'Briefings nicht geladen': 'Briefings not loaded',
  'Cira · Kurzfassung': 'Cira · Summary', 'Kurzfassung erstellen': 'Create summary', 'Kurzfassung entsteht …': 'Creating summary …',
  'lokal · {m} · {t} Tokens': 'local · {m} · {t} tokens', 'aus dem Cache': 'from cache', 'Im Gespräch nachfragen': 'Ask in the conversation',
  'Braucht dich': 'Needs you', 'Vault-Health-To-dos hakt der Skill vault-health-abarbeiten ab, zusammen mit der Änderung dazu.': 'Vault health to-dos are ticked off by the vault-health-abarbeiten skill, together with the change.',
  'Briefing lädt …': 'Loading briefing …', 'Briefing nicht gefunden.': 'Briefing not found.', 'Zum Briefing': 'About the briefing',
  'To-do nicht gespeichert': 'To-do not saved', 'Vorlesen': 'Read aloud', 'Vorlesen stoppen': 'Stop reading', 'ungelesen': 'unread', 'Filter nach Quelle': 'Filter by source', 'Nichts Neues im Vault.': 'Nothing new in the vault.',
});

const bf = { daten: null, fehler: null, laedt: false, filter: lies('bf.filter', 'alle'), pfad: null, offen: null, offenFehler: null, kurz: Object.create(null), kurzLaeuft: false };

function bfLade() {
  if (bf.laedt) return;
  bf.laedt = true;
  const vorher = JSON.stringify(bf.daten);
  hole('/api/briefings').then((d) => { bf.daten = d; bf.fehler = null; }, (e) => { if (!bf.daten) bf.fehler = e.grund || e.message; else console.error('/api/briefings:', e.message); })
    .then(() => { bf.laedt = false; if (route().name === 'briefings' && JSON.stringify(bf.daten) !== vorher) zeichneAnsicht(); });
}
function bfGruppe(d) {
  if (!d) return 'Ohne Datum';
  const h = new Date();
  const heute = isoTag(h);
  const montag = isoTag(new Date(h.getFullYear(), h.getMonth(), h.getDate() - ((h.getDay() + 6) % 7)));
  return d === heute ? 'Heute' : d >= montag && d <= heute ? 'Diese Woche' : 'Früher';
}
const bfFarbe = (q) => (q && q.farbe ? q.farbe : 'var(--text-faint)');

function bfListe() {
  const d = bf.daten;
  const quellen = [...new Set(d.briefings.map((b) => b.quelle.name))];
  if (bf.filter !== 'alle' && !quellen.includes(bf.filter)) bf.filter = 'alle';
  const sicht = d.briefings.filter((b) => bf.filter === 'alle' || b.quelle.name === bf.filter);
  const gruppen = ['Heute', 'Diese Woche', 'Früher', 'Ohne Datum'].map((g) => [g, sicht.filter((b) => bfGruppe(b.datum) === g)]).filter(([, l]) => l.length);
  return '<div class="bf-filter" role="group" aria-label="' + esc(uebersetze('Filter nach Quelle')) + '">' +
      ['alle'].concat(quellen).map((q) => '<button type="button" class="spur-pille" data-aktion="bf-filter" data-wert="' + esc(q) + '" aria-pressed="' + (bf.filter === q) + '">' + esc(q === 'alle' ? uebersetze('Alle') : q) + '</button>').join('') + '</div>' +
    '<nav class="bf-zeilen" aria-label="' + esc(uebersetze('Briefings')) + '">' + gruppen.map(([g, l]) => '<div class="bf-gruppe">' + esc(uebersetze(g)) + '</div>' + l.map((b) =>
      '<a class="bf-zeile' + (b.gelesen ? '' : ' neu') + '" href="#/briefings/' + esc(encodeURIComponent(b.pfad)) + '"' + (b.pfad === bf.pfad ? ' aria-current="page"' : '') + '>' +
        '<span class="punkt" aria-hidden="true"></span><span class="t">' + esc(b.titel) + (b.gelesen ? '' : '<span class="nur-sr"> · ' + esc(uebersetze('ungelesen')) + '</span>') + '</span>' +
        '<span class="z mono">' + esc(b.datum ? datumKurz(b.datum) : '–') + '</span>' +
        '<span class="q"><span class="quadrat" style="background:' + esc(bfFarbe(b.quelle)) + '" aria-hidden="true"></span>' + esc(b.quelle.name) +
          (b.offen ? '<span class="pille">' + esc(fuelle('{n} offen', { n: b.offen })) + '</span>' : '') + '</span></a>').join('')).join('') + '</nav>' +
    '<div class="bf-fuss">' + esc(fuelle('Quelle: {o}/ im Vault · geschrieben von n8n, Skills und c2invoice', { o: d.ordner })) + '</div>';
}

function bfLies(pfad) {
  bf.pfad = pfad;
  bf.offen = null;
  bf.offenFehler = null;
  hole('/api/briefing?' + abfrage({ pfad })).then((b) => {
    if (bf.pfad !== pfad) return;
    bf.offen = b;
    if (!b.gelesen) {
      // Gelesen ist ein Schreibvorgang: ohne Kopplung bleibt es ungelesen, sonst nichts.
      sende('/api/briefing/gelesen', { pfad, hash: b.hash }).then(() => {
        b.gelesen = true;
        const e = bf.daten && bf.daten.briefings.find((x) => x.pfad === pfad);
        if (e) e.gelesen = true;
        if (state.zaehler && state.zaehler.briefings > 0) { state.zaehler.briefings--; zeigeSitzungenZaehler(); }
        if (route().name === 'briefings') zeichneAnsicht();
      }, (err) => console.error('Briefing gelesen:', err.message));
    }
  }, (e) => { if (bf.pfad === pfad) bf.offenFehler = e.status === 404 ? uebersetze('Briefing nicht gefunden.') : (e.grund || e.message); })
    .then(() => { if (bf.pfad === pfad && route().name === 'briefings') zeichneAnsicht(); });
}

function bfLesen() {
  if (!bf.pfad) return leer('liste', 'Kein Briefing gewählt', 'Links ein Briefing öffnen.');
  const b = bf.offen;
  if (!b) return '<div class="leer">' + esc(bf.offenFehler || uebersetze('Briefing lädt …')) + '</div>';
  const k = bf.kurz[b.hash];
  const obsidian = 'obsidian://open?vault=' + encodeURIComponent(bf.daten ? bf.daten.vault || '' : '') + '&file=' + encodeURIComponent(b.pfad.replace(/\.md$/i, ''));
  return '<article class="bf-artikel">' +
    '<div class="bf-kopf"><span class="q"><span class="quadrat" style="background:' + esc(bfFarbe(b.quelle)) + '" aria-hidden="true"></span>' + esc(b.quelle.name) + '</span>' +
      '<span>' + esc(b.datum ? datum(b.datum) : uebersetze('Ohne Datum')) + '</span><span class="mono faint">' + esc(b.pfad) + '</span></div>' +
    '<h2 class="bf-titel">' + esc(b.titel) + '</h2>' +
    '<section class="bf-kurz"><span class="ueberzeile">' + esc(uebersetze('Cira · Kurzfassung')) + '</span>' +
      (k && k.text ? '<p>' + esc(k.text) + '</p><span class="faint mono">' + esc(k.cache ? uebersetze('aus dem Cache') : fuelle('lokal · {m} · {t} Tokens', { m: k.modell || '–', t: k.tokens || 0 })) + '</span>'
        : k && k.fehlt ? '<p class="dim">' + esc(k.fehlt) + '</p>' : '') +
      '<div class="bf-knoepfe">' + (k && k.text ? '' : '<button type="button" class="knopf klein primaer" data-aktion="bf-kurz"' + (bf.kurzLaeuft ? ' disabled' : '') + '>' + esc(uebersetze(bf.kurzLaeuft ? 'Kurzfassung entsteht …' : 'Kurzfassung erstellen')) + '</button>') +
        bfVorlesenKnopf(b) +
        '<button type="button" class="knopf klein" data-aktion="bf-frage">' + esc(uebersetze('Im Gespräch nachfragen')) + '</button>' +
        '<a class="knopf klein" href="' + esc(obsidian) + '">' + esc(uebersetze('In Obsidian öffnen')) + '</a></div></section>' +
    (b.todos.length ? '<section class="bf-todos"><div class="bf-todos-kopf"><span>' + esc(uebersetze('Braucht dich')) + '</span><span class="mono faint">' + b.todos.filter((t) => !t.erledigt).length + '/' + b.todos.length + '</span></div>' +
      (b.schutz ? '<p class="faint bf-schutz">' + esc(uebersetze('Vault-Health-To-dos hakt der Skill vault-health-abarbeiten ab, zusammen mit der Änderung dazu.')) + '</p>' : '') +
      b.todos.map((t, i) => '<div class="bf-todo' + (t.erledigt ? ' erledigt' : '') + '">' +
        '<button type="button" class="bf-haken" data-aktion="bf-todo" data-wert="' + i + '" aria-pressed="' + t.erledigt + '"' + (b.schutz ? ' disabled' : '') + ' aria-label="' + esc(t.text) + '"></button>' +
        '<span>' + md(t.text).replace(/^<div>|<\/div>$/g, '') + '</span></div>').join('') + '</section>' : '') +
    '<div class="bf-text">' + md(ohneTitel(b.text)) + '</div></article>';
}

// Vorlesen (C10): solange dieses Briefing spricht, stoppt der Knopf und zeigt die Restzeit.
function bfVorlesenKnopf(b) {
  const an = sprache.quelle === 'briefing:' + b.hash;
  return '<button type="button" class="knopf klein" id="bf-vorlesen" data-aktion="bf-vorlesen" aria-pressed="' + an + '">' + esc(bfVorlesenText(an, null)) + '</button>';
}
function bfVorlesenText(an, rest) {
  return uebersetze(an ? 'Vorlesen stoppen' : 'Vorlesen') + (an && rest != null ? ' · ' + Math.floor(rest / 60) + ':' + String(rest % 60).padStart(2, '0') : '');
}
document.addEventListener('c2i-sprache', (e) => {
  const k = document.getElementById('bf-vorlesen');
  if (!k || !bf.offen) return;
  const an = e.detail.quelle === 'briefing:' + bf.offen.hash;
  k.textContent = bfVorlesenText(an, e.detail.rest);
  k.setAttribute('aria-pressed', String(an));
});

function zeichneBriefings(w, teile) {
  const pfad = teile[0] || null;
  if (!bf.daten && !bf.fehler) { bfLade(); w.innerHTML = '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>'; return; }
  if (bf.fehler && !bf.daten) { w.innerHTML = leer('liste', 'Briefings nicht geladen', bf.fehler, '<button type="button" class="knopf klein" data-aktion="bf-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>'); return; }
  const d = bf.daten;
  if (!d.vault) { w.innerHTML = leer('liste', 'Kein Vault eingerichtet', 'Trag in config.json einen Arbeitsbereich mit art „vault“ und pfad ein.'); return; }
  if (!d.briefings.length) { w.innerHTML = leer('liste', 'Keine Briefings', fuelle(d.fehlt ? 'Ordner {o}/ fehlt im Vault.' : 'Im Ordner {o}/ des Vaults liegt noch nichts.', { o: d.ordner })); return; }
  if (pfad !== bf.pfad) { if (pfad) bfLies(pfad); else { bf.pfad = null; bf.offen = null; } }
  const fv = fokusMerken(w);
  const scroll = w.querySelector('.bf-lesen') ? w.querySelector('.bf-lesen').scrollTop : 0;
  const listeScroll = w.querySelector('.bf-zeilen') ? w.querySelector('.bf-zeilen').scrollTop : 0;
  w.innerHTML = '<div class="bf" data-screen-label="' + esc(uebersetze('Briefings')) + '"><div class="bf-liste">' + bfListe() + '</div><div class="bf-lesen" id="bf-lesen">' + bfLesen() + '</div></div>';
  if (pfad && pfad === bf.pfad && scroll) w.querySelector('.bf-lesen').scrollTop = scroll;
  if (listeScroll) w.querySelector('.bf-zeilen').scrollTop = listeScroll;
  fokusZurueck(w, fv);
}

aktion('bf-neu', () => { bf.fehler = null; bfLade(); });
aktion('bf-vorlesen', () => {
  const b = bf.offen;
  if (!b) return;
  if (sprache.quelle === 'briefing:' + b.hash) { stoppeSprechen(); return; }
  const k = bf.kurz[b.hash];
  sprich(k && k.text ? k.text : ohneTitel(b.text), 'briefing:' + b.hash);
});
aktion('bf-filter', (q) => { bf.filter = q; merke('bf.filter', q); zeichneAnsicht(); });
aktion('bf-kurz', async () => {
  const b = bf.offen;
  if (!b || bf.kurzLaeuft) return;
  bf.kurzLaeuft = true;
  zeichneAnsicht();
  try { bf.kurz[b.hash] = await sende('/api/briefing/kurz', { pfad: b.pfad }); } catch (e) { bf.kurz[b.hash] = { fehlt: e.message }; }
  bf.kurzLaeuft = false;
  if (route().name === 'briefings') zeichneAnsicht();
});
aktion('bf-todo', async (i, el) => {
  const b = bf.offen;
  const t = b && b.todos[Number(i)];
  if (!t || b.schutz) return;
  await mitLauf(el, async () => {
    try {
      const r = await sende('/api/briefing/todo', { pfad: b.pfad, zeile: t.zeile, roh: t.roh, erledigt: !t.erledigt });
      Object.assign(t, { roh: r.todo.roh, erledigt: r.todo.erledigt });
      if (r.hash) b.hash = r.hash;
      const e = bf.daten.briefings.find((x) => x.pfad === b.pfad);
      if (e) e.offen = b.todos.filter((x) => !x.erledigt).length;
    } catch (err) {
      toast(uebersetze('To-do nicht gespeichert') + ': ' + err.message, 'err');
      if (err.status === 409) bfLies(b.pfad);
    }
  });
  zeichneAnsicht();
  const k = document.querySelector('[data-aktion="bf-todo"][data-wert="' + Number(i) + '"]');
  if (k) k.focus();
});
// „Im Gespraech nachfragen“: Cockpit mit dem Briefing als Kontext (cira.js kontextQuellen.briefing).
aktion('bf-frage', () => {
  const b = bf.offen;
  if (!b) return;
  ckKontextAusstehend = { art: 'briefing', id: b.pfad, titel: b.titel };
  geheZu('cockpit');
});

registriere('briefings', {
  zeichne: zeichneBriefings,
  live() { if (route().name === 'briefings') bfLade(); },
});
// Das H1 steht schon als Titel ueber dem Briefing.
function ohneTitel(text) { return String(text).replace(/^\uFEFF?#[ \t]+[^\n]*\r?\n/, ''); }
