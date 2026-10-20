'use strict';
/* Board (Masterplan 3.0, C7a): Aufgaben aus TODO.md je Arbeitsbereich und aus
   Jira in vier Spalten, mit Zeit und Wert aus c2invoice. Gerechnet wird hier
   nichts: Werte, Summen und der offene Betrag kommen fertig aus /api/board.
   Status aendern per Ziehen (C7b) oder per Menue im Detail (Tastatur und ein
   Zeiger reichen). „▶ in Claude“ fuellt nur den Startdialog der Sitzungen vor,
   „abrechnen“ stellt im Cockpit die Frage nach dem Rechnungsentwurf. */

Object.assign(EN, {
  'Board': 'Board', 'Alle Quellen': 'All sources', 'Lokal': 'Local', 'Alle': 'All', 'Quelle': 'Source', 'Arbeitsbereich wählen': 'Choose workspace',
  'In Arbeit': 'In progress', 'Review': 'Review', 'Erledigt · nicht abgerechnet': 'Done · not billed',
  'gesamt': 'total', 'offen': 'open', 'Sitzung läuft': 'Session running', 'Status ändern': 'Change status',
  'Typ': 'Type', 'Zugewiesen': 'Assignee', 'Gemeldet von': 'Reporter', 'Sprint': 'Sprint', 'Story Points': 'Story points', 'Labels': 'Labels',
  'Priorität': 'Priority', 'Synchronisiert': 'Synced', 'Beschreibung': 'Description', 'Akzeptanzkriterien': 'Acceptance criteria',
  'Kommentare aus Jira': 'Comments from Jira', 'Keine Kommentare.': 'No comments.', 'Kommentar an Jira …': 'Comment to Jira …',
  'Kommentar gesendet': 'Comment sent', 'Kommentar fehlgeschlagen': 'Comment failed', 'In Jira öffnen ↗': 'Open in Jira ↗',
  'Ort kopieren': 'Copy location', 'Ort kopiert': 'Location copied', 'Zeit · gesamt': 'Time · total', 'Wert · gesamt': 'Value · total', 'Token · gesamt': 'Tokens · total',
  'Status geändert': 'Status changed', 'Status nicht geändert': 'Status not changed', 'Übergang wählen': 'Choose transition',
  'Jira bietet diese Übergänge an:': 'Jira offers these transitions:', 'Kriterium nicht gespeichert': 'Criterion not saved',
  'Keine Aufgaben': 'No tasks', 'Kein Arbeitsbereich hat eine Aufgabendatei oder ein Jira-Projekt. Pfade und Jira-Projekt stehen in config.json; Einstellungen → Arbeitsbereiche zeigt den Stand.':
    'No workspace has a task file or a Jira project. Paths and Jira project live in config.json; Settings → Workspaces shows the state.',
  'Board nicht geladen': 'Board not loaded', 'Jira-Fehler': 'Jira error', 'Jira': 'Jira', 'vor': 'ago', 'keine Aufgaben': 'no tasks', 'Schließen': 'Close',
  'Aufgabendatei': 'Task file', 'Zeile': 'line', 'Keine Beschreibung.': 'No description.', 'Detail nicht geladen': 'Detail not loaded', 'Aufgabe': 'Task',
  'Leer': 'Empty', 'ohne ID': 'no ID', 'Übernehmen': 'Apply', 'Stand nicht aktualisiert': 'Not refreshed',
  'gezeigt wird der letzte geladene Stand.': 'showing the last loaded state.', 'Offener Betrag nicht bestimmbar': 'Open amount not available',
  'Aufgabe nicht mehr da': 'Task no longer there', 'h gesamt': 'h total', 'lädt …': 'loading …',
  '▶ in Claude': '▶ in Claude', 'abrechnen': 'bill', '▶ Sitzung starten': '▶ Start session', 'Cira fragen': 'Ask Cira',
  'Als Jira-Ticket anlegen': 'Create Jira ticket', 'Anlegen': 'Create', 'Keine ID vergeben': 'No ID assigned',
  'Jira-Ticket nicht angelegt': 'Jira ticket not created', 'Jira-Ticket angelegt': 'Jira ticket created', 'Verstanden': 'Got it',
  'Diese Aufgabe hat keinen gültigen Vorgangsschlüssel.': 'This task has no valid key.',
  'Alle Sprints': 'All sprints', 'Aktiver Sprint': 'Active sprint', 'Backlog': 'Backlog', 'Gruppieren': 'Group by', 'Keine': 'None', 'Epic': 'Epic',
  'Bearbeiter': 'Assignee', 'Arbeitsbereich': 'Workspace', 'Ohne Epic': 'No epic', 'Nicht zugewiesen': 'Unassigned', 'Ohne Priorität': 'No priority',
  'Ohne Arbeitsbereich': 'No workspace', 'nicht abgerechnet': 'not billed', 'Story Points der nicht abgerechneten Karten': 'Story points of unbilled cards',
  'Kein aktiver Sprint gefunden — Kanban-Projekt, Sprint-Feld unbekannt oder Abgleich läuft noch.': 'No active sprint found — Kanban project, unknown sprint field, or sync still running.', 'Sprints gibt es nur mit Jira — lokale Aufgaben zählen zum Backlog.': 'Sprints exist only with Jira — local tasks count as backlog.', 'Jira-Ticket {k} angelegt': 'Jira ticket {k} created',
  'Legt im Jira-Projekt {p} ein Ticket „{t}“ an.': 'Creates a ticket “{t}” in Jira project {p}.',
  '{n} Akzeptanzkriterien gehen als Aufgabenliste mit.': '{n} acceptance criteria go along as a task list.',
  'Die auf {id} gebuchte Zeit geht auf das neue Ticket über. Danach zählt nur noch der Jira-Schlüssel.':
    'Time booked on {id} moves to the new ticket. From then on only the Jira key counts.',
});

const BD_SPALTEN = [['offen', 'Offen'], ['arbeit', 'In Arbeit'], ['review', 'Review'], ['erledigt', 'Erledigt · nicht abgerechnet']];
const bdZustand = { daten: null, fehler: null, lauf: 0, laedt: false, detail: null, detailFehler: null, detailLauf: 0, zu: new Set() };
const bdBereich = () => lies('board.bereich', 'alle');
const bdQuelle = () => lies('board.quelle', 'alle');
// Scrum-Sicht (nur lesen): Sprint-Filter und Gruppierung als Zeilen; gefiltert und gezaehlt wird auf dem Server.
const BD_SPRINT = [['alle', 'Alle Sprints'], ['aktiv', 'Aktiver Sprint'], ['backlog', 'Backlog']];
const BD_GRUPPE = [['keine', 'Keine'], ['epic', 'Epic'], ['bearbeiter', 'Bearbeiter'], ['prio', 'Priorität'], ['bereich', 'Arbeitsbereich']];
const bdSprint = () => { const w = lies('board.sprint', 'alle'); return BD_SPRINT.some(([k]) => k === w) ? w : 'alle'; };
const bdGruppe = () => { const w = lies('board.gruppe', 'keine'); return BD_GRUPPE.some(([k]) => k === w) ? w : 'keine'; };
const bdGewaehlt = () => liesJson('board.gewaehlt', null);

async function bdLaden() {
  const lauf = ++bdZustand.lauf;
  bdZustand.laedt = true;
  try {
    const d = await hole('/api/board?' + abfrage({ bereich: bdBereich(), quelle: bdQuelle(), sprint: bdSprint(), gruppe: bdGruppe() }));
    if (lauf !== bdZustand.lauf) return;
    bdZustand.daten = d; bdZustand.fehler = null; bdZustand.laedt = false;
  } catch (e) {
    if (lauf !== bdZustand.lauf) return;
    bdZustand.laedt = false;
    // Gewaehlter Bereich steht nicht mehr in config.json: zurueck auf alle.
    if (e.message === 'HTTP 404' && bdBereich() !== 'alle') { merke('board.bereich', 'alle'); return bdLaden(); }
    bdZustand.fehler = e.grund || e.message; console.error('Board laden:', e);
  }
  if (route().name === 'board') bdZeichnen(document.getElementById('ansicht'));
}

async function bdDetailLaden() {
  const g = bdGewaehlt();
  const lauf = ++bdZustand.detailLauf;
  if (!g) { bdZustand.detail = null; return; }
  try {
    const d = await hole('/api/board/' + encodeURIComponent(g.schluessel) + '?' + abfrage({ bereich: g.bereich }));
    if (lauf !== bdZustand.detailLauf) return;
    bdZustand.detail = d; bdZustand.detailFehler = null;
  } catch (e) {
    if (lauf !== bdZustand.detailLauf) return;
    // Aufgabe gibt es nicht mehr (erledigt ohne offene Zeit, Datei geaendert): Auswahl weg.
    if (e.status === 404) { merke('board.gewaehlt', null); bdZustand.detail = null; toast(uebersetze('Aufgabe nicht mehr da') + (e.grund ? ': ' + e.grund : ''), 'err'); }
    else { bdZustand.detailFehler = e.grund || e.message; console.error('Board-Detail:', e); }
  }
  if (route().name === 'board') bdZeichnen(document.getElementById('ansicht'));
}

const bdAlle = () => (bdZustand.daten ? Object.values(bdZustand.daten.spalten).flatMap((s) => s.karten) : []);
const bdFarbe = (name) => { const b = bdZustand.daten && bdZustand.daten.bereiche.find((x) => x.name === name); return b && b.farbe ? ' style="--ab-farbe:' + esc(b.farbe) + '"' : ''; };
const bdKuerzel = (name) => { const b = bdZustand.daten && bdZustand.daten.bereiche.find((x) => x.name === name); return (b && b.kuerzel) || String(name).slice(0, 3).toUpperCase(); };
const bdBereichJira = (name) => !!(bdZustand.daten && bdZustand.daten.bereiche.some((b) => b.name === name && b.jira));
const bdQuelleMarke = (q) => '<span class="bd-quelle ' + (q === 'md' ? 'md' : 'jira') + '">' + (q === 'md' ? 'MD' : q === 'jira+md' ? 'JIRA · MD' : 'JIRA') + '</span>';

function bdKopf(d) {
  const mit = new Set(bdAlle().map((k) => k.bereich));
  const chips = [['alle', 'Alle']].concat((d ? d.bereiche : []).filter((b) => b.jira || mit.has(b.name) || b.name === bdBereich()).map((b) => [b.name, b.name]));
  const sync = d && d.sync;
  let stand = '';
  if (sync && sync.jira) {
    stand = sync.jira.fehler
      ? '<span class="bd-sync fehler" title="' + esc(sync.jira.fehler) + '">' + esc(uebersetze('Jira-Fehler')) + ': ' + esc(sync.jira.fehler.slice(0, 80)) + '</span>'
      : '<span class="bd-sync">' + esc(uebersetze('Jira')) + ' · ' + esc(sync.jira.host || '') + (sync.jira.geholt ? ' · ' + esc(vor(sync.jira.geholt)) : '') + '</span>';
  }
  // Konfigurierte Datei fehlt oder ist gesperrt: sagen, nicht still leer zeigen.
  for (const x of sync ? sync.dateien.filter((y) => y.datei && y.hinweis) : []) stand += '<span class="bd-sync fehler" title="' + esc(x.datei) + '">' + esc(bdKuerzel(x.bereich)) + ': ' + esc(x.hinweis) + '</span>';
  for (const h of (sync && sync.hinweise) || []) stand += '<span class="bd-sync fehler">' + esc(h) + '</span>';
  if (d && d.scrum && d.scrum.sprint) stand = '<span class="bd-sync">' + esc(uebersetze('Sprint')) + ': ' + esc(d.scrum.sprint) + '</span>' + stand;
  const dateien = sync ? sync.dateien.filter((x) => x.datei && !x.hinweis) : [];
  if (dateien.length) stand += '<span class="bd-sync" title="' + esc(dateien.map((x) => x.datei).join('\n')) + '">' + esc(dateien.map((x) => bdKuerzel(x.bereich)).join(', ')) + ' · TODO.md</span>';
  return '<div class="bd-kopf">' +
    '<div class="bd-chips" role="group" aria-label="' + esc(uebersetze('Arbeitsbereich wählen')) + '">' +
      chips.map(([w, l]) => '<button type="button" class="chip" data-aktion="bd-bereich" data-wert="' + esc(w) + '" aria-pressed="' + (w === bdBereich()) + '">' + esc(uebersetze(l)) + '</button>').join('') +
    '</div>' +
    segment('bd-quelle', [['alle', 'Alle Quellen'], ['jira', 'Jira'], ['lokal', 'Lokal']], bdQuelle(), 'Quelle') +
    segment('bd-sprint', BD_SPRINT, bdSprint(), 'Sprint') +
    '<label class="bd-statuswahl">' + esc(uebersetze('Gruppieren')) + ' <select id="bd-gruppe">' +
      BD_GRUPPE.map(([w, l]) => '<option value="' + w + '"' + (w === bdGruppe() ? ' selected' : '') + '>' + esc(uebersetze(l)) + '</option>').join('') + '</select></label>' +
    '<div class="bd-stand">' + stand + '</div>' +
  '</div>';
}

// Karte = Flaeche mit eigenen Knoepfen (Titel waehlt, ▶ und abrechnen handeln),
// keine Knoepfe in einem Knopf. Ziehen ist die Maus-Abkuerzung; derselbe Wechsel
// geht per Tastatur und mit einem Zeiger ueber „Status ändern“ im Detail.
function bdKarte(k) {
  const g = bdGewaehlt();
  const an = g && g.schluessel === k.schluessel && g.bereich === k.bereich;
  const wichtig = /^(wichtig|high|highest|hoch)$/i.test(k.prio || '');
  const wert = esc(JSON.stringify({ schluessel: k.schluessel, bereich: k.bereich }));
  const name = k.id || k.titel || k.schluessel;
  const tat = k.spalte === 'offen' ? '<button type="button" class="bd-tat" data-aktion="bd-claude" data-wert="' + wert + '" aria-label="' + esc(uebersetze('▶ in Claude') + ': ' + name) + '">' + esc(uebersetze('▶ in Claude')) + '</button>'
    : k.spalte === 'erledigt' ? '<button type="button" class="bd-tat ok" data-aktion="bd-abrechnen" data-wert="' + wert + '" aria-label="' + esc(uebersetze('abrechnen') + ': ' + name) + '">' + esc(uebersetze('abrechnen')) + '</button>' : '';
  return '<div class="bd-karte' + (an ? ' an' : '') + (k.sitzung_laeuft ? ' laeuft' : '') + '" draggable="true" data-aktion="bd-karte" data-wert="' + wert + '">' +
    '<span class="bd-zeile1"><span class="bd-marke"' + bdFarbe(k.bereich) + '>' + esc(bdKuerzel(k.bereich)) + '</span>' +
      (k.id ? '<span class="bd-id">' + esc(k.id) + '</span>' : '<span class="bd-id ohne">' + esc(uebersetze('ohne ID')) + '</span>') + bdQuelleMarke(k.quelle) +
      (k.prio ? '<span class="bd-prio' + (wichtig ? ' wichtig' : '') + '">' + esc(k.prio) + '</span>' : '') + '</span>' +
    '<button type="button" class="bd-titel" data-aktion="bd-karte" data-wert="' + wert + '" aria-pressed="' + !!an + '">' + esc(k.titel || '–') + '</button>' +
    '<span class="bd-zeile2"><span>' + esc(hrs(k.stunden)) + (k.wert_art === 'offen' ? ' <small>' + esc(uebersetze('h gesamt').replace(/^h /, '')) + '</small>' : '') + '</span><span class="bd-wert ' + k.wert_art + '">' + esc(eur(k.wert_eur)) + '</span>' +
      (k.sitzung_laeuft ? '<span class="bd-live">' + esc(uebersetze('Sitzung läuft')) + '</span>' : '') + tat + '</span>' +
    // Budget nur, wenn eins gesetzt ist (Stand vom Server, budgetBand aus vorgaenge.js).
    (k.budget ? '<span class="bd-budget">' + budgetBand(k.budget, true) + '</span>' : '') +
  '</div>';
}

function bdSpaltenKopf(s, t, sp) {
  return '<header><span class="bd-punkt"></span><h2>' + esc(uebersetze(t)) + '</h2><span class="bd-n">' + sp.karten.length + '</span>' +
      // Erledigt zeigt nur Nicht-Abgerechnetes: das Label sagt es, sonst laese es sich wie Velocity.
      (sp.summe_punkte ? '<span class="bd-n" title="' + esc(uebersetze(s === 'erledigt' ? 'Story Points der nicht abgerechneten Karten' : 'Story Points')) + '">· ' + esc(String(sp.summe_punkte).replace('.', ',')) + ' SP' +
        (s === 'erledigt' ? ' <small>' + esc(uebersetze('nicht abgerechnet')) + '</small>' : '') + '</span>' : '') +
      '<span class="bd-summe">' + esc(eur(sp.summe_eur)) + ' <small>' + esc(uebersetze(s === 'erledigt' ? 'offen' : 'gesamt')) + '</small></span></header>' +
    (sp.fehler ? '<p class="bd-sync fehler" role="alert">' + esc(uebersetze('Offener Betrag nicht bestimmbar')) + ': ' + esc(sp.fehler) + '</p>' : '');
}
const bdListe = (karten, fehler) => '<div class="bd-liste">' + (karten.length ? karten.map(bdKarte).join('') : fehler ? '' : '<p class="bd-leer">' + esc(uebersetze('Leer')) + '</p>') + '</div>';

function bdSpalten(d) {
  const busy = bdZustand.laedt ? ' aria-busy="true"' : '';
  const gruppen = (d.scrum && d.scrum.gruppen) || [];
  if (!gruppen.length) {
    return '<div class="bd-spalten"' + busy + '>' + BD_SPALTEN.map(([s, t]) => '<section class="bd-spalte ' + s + '" data-spalte="' + s + '" aria-label="' + esc(uebersetze(t)) + '">' +
      bdSpaltenKopf(s, t, d.spalten[s]) + bdListe(d.spalten[s].karten, d.spalten[s].fehler) + '</section>').join('') + '</div>';
  }
  // Gruppiert: Spaltenkoepfe mit den Summen einmal oben, darunter je Gruppe eine
  // einklappbare Zeile mit vier Zellen (Ziehen geht in jeder Zelle).
  const name = (g) => (g.schluessel ? g.titel : uebersetze(g.titel));
  return '<div class="bd-gruppen"' + busy + '>' +
    '<div class="bd-spalten bd-koepfe">' + BD_SPALTEN.map(([s, t]) => '<div class="bd-spalte ' + s + '">' + bdSpaltenKopf(s, t, d.spalten[s]) + '</div>').join('') + '</div>' +
    gruppen.map((g) => '<details class="bd-bahn" data-gruppe="' + esc(bdGruppe() + ':' + g.schluessel) + '"' + (bdZustand.zu.has(bdGruppe() + ':' + g.schluessel) ? '' : ' open') + '>' +
      '<summary><span class="bd-bahn-titel">' + esc(name(g)) + '</span> <span class="bd-n">' + g.n + '</span></summary>' +
      '<div class="bd-spalten">' + BD_SPALTEN.map(([s, t]) => '<section class="bd-spalte ' + s + '" data-spalte="' + s + '" aria-label="' + esc(name(g) + ' · ' + uebersetze(t)) + '">' +
        bdListe(d.spalten[s].karten.filter((k) => k.gruppe && k.gruppe.schluessel === g.schluessel), true) + '</section>').join('') + '</div>' +
    '</details>').join('') +
  '</div>';
}

function bdDetail() {
  const g = bdGewaehlt();
  if (!g) return '';
  const d = bdZustand.detail;
  const zu = '<button type="button" class="knopf klein" data-aktion="bd-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button>';
  if (bdZustand.detailFehler) return '<aside class="bd-detail"><div class="bd-dkopf">' + zu + '</div><p class="fehler">' + esc(uebersetze('Detail nicht geladen')) + ': ' + esc(bdZustand.detailFehler) + '</p></aside>';
  if (!d || d.karte.schluessel !== g.schluessel) return '<aside class="bd-detail"><div class="bd-dkopf">' + zu + '</div><p class="bd-leer">' + esc(uebersetze('lädt …')) + '</p></aside>';
  const k = d.karte;
  const m = d.meta || {};
  const zeile = (l, v) => (v == null || v === '' || (Array.isArray(v) && !v.length) ? '' : '<dt>' + esc(uebersetze(l)) + '</dt><dd>' + esc(Array.isArray(v) ? v.join(', ') : v) + '</dd>');
  const datei = k.quelle !== 'jira' && Number.isInteger(k.zeile);
  const krit = k.kriterien || [];
  const erledigt = krit.filter((x) => x.erledigt).length;
  const jira = k.quelle !== 'md';
  return '<aside class="bd-detail" aria-label="' + esc(uebersetze('Aufgabe')) + ' ' + esc(k.id || k.schluessel) + '">' +
    '<div class="bd-dkopf">' + bdQuelleMarke(k.quelle) + '<span class="bd-id">' + esc(k.id || k.schluessel) + '</span>' +
      '<span class="bd-st ' + k.spalte + '">' + esc(k.quelle !== 'md' && k.statusRoh ? k.statusRoh : uebersetze(BD_SPALTEN.find(([s]) => s === k.spalte)[1])) + '</span>' +
      (d.ort ? '<span class="bd-ort" title="' + esc(d.ort.datei) + '">' + esc(String(d.ort.datei).split(/[\\/]/).pop()) + ':' + d.ort.zeile + '</span>' : '') + zu + '</div>' +
    '<h2 class="bd-dtitel">' + esc(k.titel || '–') + '</h2>' +
    '<dl class="bd-meta">' + zeile('Typ', m.typ) + zeile('Zugewiesen', m.zugewiesen) + zeile('Gemeldet von', m.gemeldet) + zeile('Sprint', m.sprint) +
      zeile('Story Points', m.punkte) + zeile('Labels', m.labels) + zeile('Priorität', m.prio) + zeile('Synchronisiert', m.synchronisiert ? vor(m.synchronisiert) : null) + '</dl>' +
    (jira ? '<h3>' + esc(uebersetze('Beschreibung')) + '</h3><p class="bd-text">' + (d.beschreibung ? esc(d.beschreibung) : esc(uebersetze('Keine Beschreibung.'))) + '</p>' : '') +
    (krit.length ? '<h3>' + esc(uebersetze('Akzeptanzkriterien')) + ' <span class="bd-n">' + erledigt + ' / ' + krit.length + '</span></h3><ul class="bd-krit">' +
      krit.map((x) => '<li><label><input type="checkbox"' + (x.erledigt ? ' checked' : '') + (datei && typeof x.roh === 'string' ? ' data-krit="' + esc(JSON.stringify({ zeile: x.zeile, roh: x.roh })) + '"' : ' disabled') + '> ' + esc(x.text) + '</label></li>').join('') + '</ul>' : '') +
    (jira ? '<h3>' + esc(uebersetze('Kommentare aus Jira')) + '</h3>' + (d.kommentare.length ? '<ul class="bd-komm">' + d.kommentare.map((c) =>
      '<li><span class="bd-avatar" aria-hidden="true">' + esc(c.initialen) + '</span><div><strong>' + esc(c.autor) + '</strong> <small>' + esc(c.zeit ? datum(c.zeit) : '') + '</small><p>' + esc(c.text) + '</p></div></li>').join('') + '</ul>'
      : '<p class="bd-leer">' + esc(uebersetze('Keine Kommentare.')) + '</p>') : '') +
    '<div class="bd-kacheln"><div><small>' + esc(uebersetze('Zeit · gesamt')) + '</small><b>' + esc(hrs(d.ticket.stunden)) + '</b></div>' +
      '<div><small>' + esc(uebersetze('Wert · gesamt')) + '</small><b>' + esc(eur(d.ticket.wert_eur)) + '</b></div>' +
      '<div><small>' + esc(uebersetze('Token · gesamt')) + '</small><b>' + esc(kurz(d.ticket.tokens)) + '</b></div></div>' +
    '<div class="bd-fuss">' +
      (jira ? '<form id="bd-kommentar" class="bd-kform"><label class="sr-only" for="bd-ktext">' + esc(uebersetze('Kommentar an Jira …')) + '</label>' +
        '<textarea id="bd-ktext" rows="2" maxlength="4000" placeholder="' + esc(uebersetze('Kommentar an Jira …')) + '"></textarea>' +
        '<button type="submit" class="knopf klein primaer">' + esc(uebersetze('Senden')) + '</button></form>' : '') +
      '<div class="bd-aktionen"><label class="bd-statuswahl">' + esc(uebersetze('Status ändern')) +
        ' <select id="bd-status">' + BD_SPALTEN.map(([s, t]) => '<option value="' + s + '"' + (s === k.spalte ? ' selected' : '') + '>' + esc(uebersetze(t)) + '</option>').join('') + '</select></label>' +
        '<button type="button" class="knopf klein" data-aktion="bd-status-setzen">' + esc(uebersetze('Übernehmen')) + '</button>' +
        (d.link ? '<a class="knopf klein" href="' + esc(d.link) + '" target="_blank" rel="noopener noreferrer">' + esc(uebersetze('In Jira öffnen ↗')) + '</a>' : '') +
        (d.ort ? '<button type="button" class="knopf klein" data-aktion="bd-ort">' + esc(uebersetze('Ort kopieren')) + '</button>' : '') +
      '</div><div class="bd-aktionen">' +
        '<button type="button" class="knopf klein primaer" data-aktion="bd-claude" data-wert="' + esc(JSON.stringify({ schluessel: k.schluessel, bereich: k.bereich })) + '">' + esc(uebersetze('▶ Sitzung starten')) + '</button>' +
        '<button type="button" class="knopf klein" data-aktion="bd-cira">' + esc(uebersetze('Cira fragen')) + '</button>' +
        (k.quelle === 'md' && bdBereichJira(k.bereich) ? '<button type="button" class="knopf klein" data-aktion="bd-als-jira">' + esc(uebersetze('Als Jira-Ticket anlegen')) + '</button>' : '') +
      '</div></div>' +
  '</aside>';
}

function bdZeichnen(w) {
  if (!w) return;
  if (bdZustand.ziehtGerade) { bdZustand.nachZiehen = true; return; }
  const d = bdZustand.daten;
  if (!d) {
    w.innerHTML = bdZustand.fehler ? leer('liste', uebersetze('Board nicht geladen'), bdZustand.fehler, '') : '<p class="bd-leer">' + esc(uebersetze('lädt …')) + '</p>';
    return;
  }
  // Leer = keine Karte, kein Jira und keine lesbare Aufgabendatei (fehlende Standard-TODO.md hat datei null).
  const leerBoard = !bdAlle().length && !d.bereiche.some((b) => b.jira) && d.sync.dateien.every((x) => !x.datei || x.hinweis);
  const fokus = document.activeElement && document.activeElement.id;
  const entwurf = w.querySelector('#bd-ktext');
  const entwurfText = entwurf ? entwurf.value : '';
  // Ohne Jira in der Auswahl (Bereich, Quelle) gibt es keine Sprints; mit Jira, aber
  // ohne aktiven Sprint (Kanban, Sprint-Feld unbekannt) waere „Aktiver Sprint“ still leer.
  const ohneJira = bdSprint() === 'alle' ? ''
    : !d.sync.jira ? '<p class="bd-sync">' + esc(uebersetze('Sprints gibt es nur mit Jira — lokale Aufgaben zählen zum Backlog.')) + '</p>'
      : bdSprint() === 'aktiv' && d.scrum && !d.scrum.aktivVorhanden ? '<p class="bd-sync">' + esc(uebersetze('Kein aktiver Sprint gefunden — Kanban-Projekt, Sprint-Feld unbekannt oder Abgleich läuft noch.')) + '</p>' : '';
  const veraltet = ohneJira + (bdZustand.fehler ? '<p class="bd-sync fehler" role="alert">' + esc(uebersetze('Stand nicht aktualisiert')) + ': ' + esc(bdZustand.fehler) + ' — ' + esc(uebersetze('gezeigt wird der letzte geladene Stand.')) + '</p>' : '');
  w.innerHTML = '<div class="bd' + (bdGewaehlt() ? ' mit-detail' : '') + '">' + bdKopf(d) + veraltet +
    (leerBoard ? leer('liste', uebersetze('Keine Aufgaben'), uebersetze('Kein Arbeitsbereich hat eine Aufgabendatei oder ein Jira-Projekt. Pfade und Jira-Projekt stehen in config.json; Einstellungen → Arbeitsbereiche zeigt den Stand.'),
      '<a class="knopf klein" href="#/einstellungen">' + esc(uebersetze('Zu den Einstellungen')) + '</a>')
      : '<div class="bd-rumpf">' + bdSpalten(d) + bdDetail() + '</div>') + '</div>';
  bdVerdrahten(w);
  const neuEntwurf = w.querySelector('#bd-ktext');
  if (neuEntwurf && entwurfText) neuEntwurf.value = entwurfText;
  if (fokus && document.getElementById(fokus)) document.getElementById(fokus).focus();
}

function bdVerdrahten(w) {
  const f = w.querySelector('#bd-kommentar');
  if (f) {
    f.addEventListener('submit', bdKommentar);
    w.querySelector('#bd-ktext').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } });
  }
  for (const c of w.querySelectorAll('input[data-krit]')) c.addEventListener('change', () => bdKriterium(c));
  const gw = w.querySelector('#bd-gruppe');
  if (gw) gw.addEventListener('change', () => bdWechsel('board.gruppe', gw.value));
  // Eingeklappte Gruppen bleiben beim Neuzeichnen eingeklappt.
  for (const z of w.querySelectorAll('details.bd-bahn')) z.addEventListener('toggle', () => { if (z.open) bdZustand.zu.delete(z.dataset.gruppe); else bdZustand.zu.add(z.dataset.gruppe); });
  // Ziehen zwischen Spalten (natives HTML5-DnD). Waehrend gezogen wird, zeichnet
  // das Board nicht neu (das liesse die Karte unter dem Zeiger verschwinden).
  for (const el of w.querySelectorAll('.bd-karte[draggable]')) {
    el.addEventListener('dragstart', (e) => {
      if (bdZustand.zieht) { e.preventDefault(); return; }
      e.dataTransfer.setData(BD_ZIEH, el.dataset.wert);
      e.dataTransfer.effectAllowed = 'move';
      bdZustand.ziehtGerade = true;
      el.classList.add('gezogen');
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('gezogen');
      bdZustand.ziehtGerade = false;
      if (bdZustand.nachZiehen) { bdZustand.nachZiehen = false; bdZeichnen(document.getElementById('ansicht')); }
    });
  }
  for (const sp of w.querySelectorAll('.bd-spalte[data-spalte]')) {
    sp.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes(BD_ZIEH)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; sp.classList.add('ziel'); } });
    sp.addEventListener('dragleave', (e) => { if (!sp.contains(e.relatedTarget)) sp.classList.remove('ziel'); });
    sp.addEventListener('drop', (e) => {
      sp.classList.remove('ziel');
      bdZustand.ziehtGerade = false;
      const roh = e.dataTransfer.getData(BD_ZIEH);
      if (!roh) return;
      e.preventDefault();
      const k = bdKarteVon(roh);
      // Gleiche Spalte oder ein Wechsel laeuft noch: nichts schicken.
      if (!k || k.spalte === sp.dataset.spalte || bdZustand.zieht) return;
      bdZustand.zieht = true;
      bdStatus(sp.dataset.spalte, null, k).finally(() => { bdZustand.zieht = false; });
    });
  }
}
const BD_ZIEH = 'application/x-c2i-karte';

const bdKarteJetzt = () => { const g = bdGewaehlt(); return g && bdAlle().find((k) => k.schluessel === g.schluessel && k.bereich === g.bereich); };
// Karte zu data-wert { schluessel, bereich }: aus dem Board, sonst die im Detail.
const bdKarteVon = (w) => {
  const g = JSON.parse(w);
  const d = bdZustand.detail && bdZustand.detail.karte;
  return bdAlle().find((k) => k.schluessel === g.schluessel && k.bereich === g.bereich) || (d && d.schluessel === g.schluessel && d.bereich === g.bereich ? d : null);
};
// Neuer Schluessel (lokale Karte bekam eine @id): eine gewaehlte Karte folgt ihm.
function bdFolge(k, neu) {
  const g = bdGewaehlt();
  if (neu && neu !== k.schluessel && g && g.schluessel === k.schluessel && g.bereich === k.bereich) merke('board.gewaehlt', JSON.stringify({ schluessel: neu, bereich: k.bereich }));
}

// karte: die gezogene Karte; ohne = die im Detail gewaehlte.
async function bdStatus(spalte, transition, karte) {
  const k = karte || (bdZustand.detail && bdZustand.detail.karte) || bdKarteJetzt();
  if (!k) return;
  try {
    const r = await sende('/api/board/' + encodeURIComponent(k.schluessel) + '/status', { bereich: k.bereich, spalte, zeile: k.zeile, roh: k.roh, ...(transition ? { transition } : {}) });
    bdFolge(k, r.karte && r.karte.schluessel);
    toast(uebersetze('Status geändert') + (r.hinweis ? ' — ' + r.hinweis : ''), r.hinweis ? 'err' : undefined);
  } catch (e) {
    if (e.status === 409 && e.daten && Array.isArray(e.daten.uebergaenge)) return bdUebergangWaehlen(e.message, e.daten.uebergaenge, k);
    toast(uebersetze('Status nicht geändert') + ': ' + e.message, 'err');
  }
  bdLaden(); bdDetailLaden();
}

function bdUebergangWaehlen(text, liste, karte) {
  bdZustand.uebergangKarte = karte;
  dialog('<h2>' + esc(uebersetze('Übergang wählen')) + '</h2><p>' + esc(text) + '</p><p>' + esc(uebersetze('Jira bietet diese Übergänge an:')) + '</p>' +
    '<div class="bd-uebergaenge">' + liste.map((t) => '<button type="button" class="knopf klein" data-aktion="bd-uebergang" data-wert="' + esc(JSON.stringify({ id: t.id, spalte: t.spalte })) + '">' +
      esc(t.name) + ' → ' + esc(t.nach) + '</button>').join('') + '</div>' +
    '<div class="knoepfe"><button type="button" class="knopf klein" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button></div>', 'Übergang wählen', 420);
  bdLaden(); bdDetailLaden();
}

async function bdKommentar(e) {
  e.preventDefault();
  const g = bdGewaehlt();
  const feld = document.getElementById('bd-ktext');
  const text = feld.value;
  if (!g || !text.trim()) return;
  await mitLauf(e.submitter, async () => {
    try {
      await sende('/api/board/' + encodeURIComponent(g.schluessel) + '/kommentar', { bereich: g.bereich, text });
      feld.value = '';
      toast(uebersetze('Kommentar gesendet'));
      bdDetailLaden();
    } catch (err) { toast(uebersetze('Kommentar fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
}

async function bdKriterium(c) {
  const g = bdGewaehlt();
  const k = JSON.parse(c.dataset.krit);
  c.disabled = true;
  try {
    const karte = bdZustand.detail && bdZustand.detail.karte;
    await sende('/api/board/' + encodeURIComponent(g.schluessel) + '/kriterium', { bereich: g.bereich, zeile: k.zeile, roh: k.roh, karte: karte ? { zeile: karte.zeile, roh: karte.roh } : null, erledigt: c.checked });
  } catch (err) { c.checked = !c.checked; toast(uebersetze('Kriterium nicht gespeichert') + ': ' + err.message, 'err'); }
  bdLaden(); bdDetailLaden();
}

// Erst zeichnen, dann laden: der Knopf steht sofort auf der Wahl und die
// Spalten dimmen ab, statt bis zur Antwort wie nicht gedrueckt zu wirken.
const bdWechsel = (schluessel, w) => { merke(schluessel, w); const p = bdLaden(); bdZeichnen(document.getElementById('ansicht')); return p; };
aktion('bd-bereich', (w) => bdWechsel('board.bereich', w));
aktion('bd-quelle', (w) => bdWechsel('board.quelle', w));
aktion('bd-sprint', (w) => bdWechsel('board.sprint', w));
aktion('bd-karte', (w) => {
  const g = JSON.parse(w);
  merke('board.gewaehlt', JSON.stringify(g));
  bdZustand.detail = null;
  const k = bdAlle().find((x) => x.schluessel === g.schluessel && x.bereich === g.bereich);
  if (k) ciraKontext({ art: 'vorgang', id: k.schluessel, titel: k.titel });
  bdZeichnen(document.getElementById('ansicht'));
  bdDetailLaden();
});
aktion('bd-status-setzen', async (w, el) => {
  const sel = document.getElementById('bd-status');
  if (!sel) return;
  sel.disabled = true; el.disabled = true;
  try { await bdStatus(sel.value); } finally { if (sel.isConnected) { sel.disabled = false; el.disabled = false; } }
});
aktion('bd-zu', () => { merke('board.gewaehlt', null); bdZustand.detail = null; bdZeichnen(document.getElementById('ansicht')); });
aktion('bd-uebergang', (w) => { const t = JSON.parse(w); schliesseDialog(); bdStatus(t.spalte, t.id, bdZustand.uebergangKarte); });

// „▶ in Claude“: Startdialog der Sitzungen vorbefuellen, gestartet wird erst dort.
// Eine lokale Karte ohne @id bekommt vorher eine, sonst buchte die Sitzung auf nichts.
aktion('bd-claude', (w, el) => mitLauf(el, async () => {
  const k = bdKarteVon(w);
  if (!k) return;
  let vorgang = k.schluessel;
  if (k.quelle === 'md' && !k.id) {
    try { vorgang = (await sende('/api/board/' + encodeURIComponent(k.schluessel) + '/id', { bereich: k.bereich, zeile: k.zeile, roh: k.roh })).schluessel; } catch (e) {
      toast(uebersetze('Keine ID vergeben') + ': ' + e.message, 'err');
      return;
    }
    bdFolge(k, vorgang);
  }
  const krit = (k.kriterien || []).map((x) => '- [' + (x.erledigt ? 'x' : ' ') + '] ' + x.text).join('\n');
  szVorlage = { arbeitsbereich: k.bereich, vorgang, prompt: (k.titel || '') + (krit ? '\n\n' + uebersetze('Akzeptanzkriterien') + ':\n' + krit : '') };
  location.hash = '#/sitzungen';
}));
// „abrechnen“: Cockpit mit der Frage, die den Rechnungsentwurf fuer genau diesen Vorgang baut.
aktion('bd-abrechnen', (w) => {
  const k = bdKarteVon(w);
  if (!k) return;
  // Der Schluessel stammt aus einer Datei und geht ungesehen an Cira: nur Vorgangs-IDs.
  if (!/^[A-Za-z][A-Za-z0-9]{0,19}-\d{1,9}$/.test(k.schluessel)) { toast(uebersetze('Diese Aufgabe hat keinen gültigen Vorgangsschlüssel.'), 'err'); return; }
  ckAusstehend = 'Rechnung für ' + k.schluessel;
  location.hash = '#/cockpit';
});
aktion('bd-cira', () => {
  const k = bdZustand.detail && bdZustand.detail.karte;
  if (!k) return;
  ciraKontext({ art: 'vorgang', id: k.schluessel, titel: k.titel });
  oeffneDock(true);
});
// Als Jira-Ticket anlegen: schreibt nach aussen, deshalb erst bestaetigen.
aktion('bd-als-jira', () => {
  const k = bdZustand.detail && bdZustand.detail.karte;
  const b = k && bdZustand.daten && bdZustand.daten.bereiche.find((x) => x.name === k.bereich);
  if (!k || !b) return;
  bdZustand.anlageKarte = k;
  const n = (k.kriterien || []).length;
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Als Jira-Ticket anlegen')) + '</h2></div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<div class="bd-dtext"><p>' + esc(fuelle('Legt im Jira-Projekt {p} ein Ticket „{t}“ an.', { p: b.jiraProjekt || '', t: k.titel || '' })) + '</p>' +
    (n ? '<p>' + esc(fuelle('{n} Akzeptanzkriterien gehen als Aufgabenliste mit.', { n })) + '</p>' : '') +
    (k.id ? '<p>' + esc(fuelle('Die auf {id} gebuchte Zeit geht auf das neue Ticket über. Danach zählt nur noch der Jira-Schlüssel.', { id: k.id })) + '</p>' : '') + '</div>' +
    '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
    '<button type="button" class="knopf primaer" data-aktion="bd-als-jira-ok">' + esc(uebersetze('Anlegen')) + '</button></div>', 'Als Jira-Ticket anlegen', 460);
});
function bdHinweis(text) {
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Jira-Ticket angelegt')) + '</h2></div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<div class="bd-dtext"><p role="alert">' + esc(text) + '</p></div>' +
    '<div class="dialog-fuss"><button type="button" class="knopf primaer" data-aktion="dialog-zu">' + esc(uebersetze('Verstanden')) + '</button></div>', 'Jira-Ticket angelegt', 460);
}
aktion('bd-als-jira-ok', (w, el) => mitLauf(el, async () => {
  const k = bdZustand.anlageKarte;
  if (!k) return;
  try {
    const r = await sende('/api/board/' + encodeURIComponent(k.schluessel) + '/als-jira', { bereich: k.bereich, zeile: k.zeile, roh: k.roh });
    schliesseDialog();
    // Ohne @jira in der Zeile heisst die Karte weiter wie vorher: Auswahl bleibt.
    if (r.zeileOk) bdFolge(k, r.key);
    // Hinweis braucht eine Handlung (Key von Hand eintragen): Dialog statt fluechtigem Toast.
    if (r.hinweis) bdHinweis(r.hinweis);
    else toast(fuelle('Jira-Ticket {k} angelegt', { k: r.key }));
  } catch (e) {
    schliesseDialog();
    toast(uebersetze('Jira-Ticket nicht angelegt') + ': ' + e.message, 'err');
  }
  bdLaden(); bdDetailLaden();
}));
aktion('bd-ort', async () => {
  const o = bdZustand.detail && bdZustand.detail.ort;
  if (!o) return;
  try { await navigator.clipboard.writeText(o.datei + ':' + o.zeile); toast(uebersetze('Ort kopiert')); } catch (e) { toast(o.datei + ':' + o.zeile); }
});

// Jira meldet einen neuen Status (Abgleich oder eigene Aktion): nachladen.
window.addEventListener('c2-jira', () => { if (route().name === 'board') { bdLaden(); if (bdGewaehlt()) bdDetailLaden(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && route().name === 'board') bdLaden(); });

registriere('board', {
  zeichne(w) {
    // Frischer Aufruf der Seite: ein Ziehen ohne dragend (Quelle verschwand) haelt das Board nicht fest.
    bdZustand.ziehtGerade = false; bdZustand.nachZiehen = false;
    bdZeichnen(w);
    // Die Shell zeichnet beim Start zweimal; ein laufender Abruf zeichnet selbst nach.
    if (!bdZustand.laedt) bdLaden();
    if (bdGewaehlt()) bdDetailLaden();
  },
});
