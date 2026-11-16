'use strict';
/* Projekte: Uebersicht der Projekte mit Konto (Stunden ohne Vorgang) und Verbrauch im
   Zeitraum (#/projekte, #/projekte/board, #/projekte/p/<name>). Gerechnet wird
   hier nichts: Konto und Kunde kommen aus /api/projekte, der Zeitraum aus
   /api/summary, offene Aufgaben aus /api/board. Im Browser entsteht nur
   Sortierung und Formatierung. */

Object.assign(EN, {
  'Projekte': 'Projects', 'Übersicht': 'Overview', 'Konto, Aufgaben und Rechnungen je Projekt': 'Account, tasks and invoices per project',
  'Konto: Stunden ohne Vorgang bis heute. Aktiv h, API USD und Arbeitswert: alle Arbeit im gewählten Zeitraum.': 'Account: hours without a job to date. Active h, API USD and billable value: all work in the selected period.',
  'ohne Vorgang, bis heute': 'without job, to date', 'im Zeitraum': 'in period', 'Kunde': 'Customer', 'Projekt': 'Project', 'Rechnungen': 'Invoices',
  'geleistet h': 'done h', 'berechnet h': 'billed h', 'offen h': 'open h', 'Aktiv h': 'Active h', 'API USD': 'API USD',
  'Aufgaben offen': 'Open tasks', 'Abrechnen': 'Invoice', 'mit offenen Stunden': 'with open hours', 'ohne Kunde': 'no customer',
  'Noch keine Projekte': 'No projects yet', 'Sobald Arbeit einem Projekt zugeordnet ist, erscheint es hier.': 'As soon as work is assigned to a project, it appears here.',
  'Kein Projekt passt zum Filter': 'No project matches the filter', 'Projekte nicht geladen': 'Projects not loaded',
  'Aufgaben nicht geladen': 'Tasks not loaded', 'Werkzeug': 'Tool', 'Zur Projektübersicht': 'Back to projects',
  '← Projekte': '← Projects', 'Vorgänge': 'Jobs', 'Zeit ohne Vorgang': 'Time without job', 'Kunde & Satz': 'Customer & rate', 'Konto': 'Account',
  'Stunden ohne Vorgang, bis Zeitraumende': 'hours without a job, to end of period', 'über h': 'over h',
  'Überhang nur im Stand bis heute sichtbar': 'Excess only shown in the status to date', 'Werkzeugprojekt: kein Konto.': 'Tool project: no account.',
  'Stundensatz und Rundung': 'Hourly rate and rounding', 'Rundung Min': 'Rounding min', 'Zeitmodell': 'Time model', 'In Jira öffnen': 'Open in Jira',
  'Vorgänge im Zeitraum': 'jobs in period', 'Vorgang': 'Job', 'Arbeitswert': 'Billable value', 'Status': 'Status', 'Keine Vorgänge im Zeitraum': 'No jobs in this period',
  'Kein Arbeitsbereich': 'No workspace', 'Diesem Projekt ist kein Arbeitsbereich zugeordnet; Aufgaben gibt es erst mit einem.': 'This project has no workspace; tasks need one.',
  'Arbeitsbereiche öffnen': 'Open workspaces', 'Einheiten': 'Units', 'Tag': 'Day', 'Art': 'Type', 'Stunden': 'Hours', 'Claude': 'Claude', 'manuell': 'manual',
  'Keine Einheiten im Zeitraum': 'No units in the period', 'Manuelle Einträge': 'Manual entries', 'Zeit öffnen': 'Open time', 'Datum': 'Date', 'Tätigkeit': 'Activity',
  'Minuten': 'Minutes', 'Keine manuellen Einträge im Zeitraum': 'No manual entries in the period', 'Laufzeit, alle Status; Storno mit negativem Betrag': 'All time, all statuses; reversals carry a negative amount',
  'Nr': 'No.', 'Netto EUR': 'Net EUR', 'Claude-Zeit': 'Claude time', 'manuelle Zeit': 'manual time', 'gemischt': 'mixed', 'Noch keine Rechnungen auf dieses Projekt': 'No invoices for this project yet', 'Folgt.': 'Coming.',
  'Projekt nicht gefunden': 'Project not found', 'Zu diesem Namen gibt es keine Arbeit und keinen Kunden.': 'There is no work and no customer under this name.',
  'Stunden im Zeitraum': 'hours in period', 'Projekt in Rechnung stellen': 'Invoice project', 'weitere': 'more',
  'aktueller Stand': 'current state', 'Filter': 'Filter', 'Aufgaben': 'Tasks',
  'Werkzeugprojekt: wird nicht abgerechnet, daher ohne Kunde und Satz.': 'Tool project: not invoiced, so no customer and no rate.', 'Kein Kunde': 'No customer',
  'Kunde nicht gewechselt': 'Customer not changed', 'bleibt beim bisherigen Kunden.': 'stays with the previous customer.',
  'hat jetzt keinen Kunden — die Zuordnung zum neuen Kunden ist gescheitert.': 'now has no customer — assigning the new customer failed.',
  'Kontakte nicht geladen': 'Contacts not loaded', 'Die Antwort enthält keine Projektliste.': 'The response contains no project list.',
});

const PJ_REITER = [['', 'Übersicht'], ['board', 'Board']];
const pj = {
  sort: liesJson('projekte.sort', { k: 'offen_h', dir: -1 }),
  filter: lies('projekte.filter', 'alle'),
};
// [Schluessel, Beschriftung, Zahl (null = nicht sortierbar), Untertitel]
const PJ_SPALTEN = [
  ['name', 'Projekt', false], ['kunde', 'Kunde', false],
  ['geleistet_h', 'geleistet h', true, 'ohne Vorgang, bis heute'], ['berechnet_h', 'berechnet h', true, 'ohne Vorgang, bis heute'], ['offen_h', 'offen h', true, 'ohne Vorgang, bis heute'], ['rechnungen', 'Rechnungen', null, 'ohne Vorgang, bis heute'],
  ['aktiv', 'Aktiv h', true, 'im Zeitraum'], ['api', 'API USD', true, 'im Zeitraum'], ['wert', 'Arbeitswert', true, 'im Zeitraum'], ['verlauf', 'Verlauf', null, 'im Zeitraum'],
  ['offen_n', 'Aufgaben offen', true, 'aktueller Stand'], ['abrechnen', '', null],
];
// M1: Spalten und Filter ausgeschalteter Module fehlen (Kunde ohne Kontakte, Konto und Rechnungen ohne Abrechnung).
const PJ_SPALTE_MODUL = { kunde: 'kontakte', berechnet_h: 'abrechnung', offen_h: 'abrechnung', rechnungen: 'abrechnung', abrechnen: 'abrechnung' };
const pjSpalten = () => PJ_SPALTEN.filter(([key]) => modulAktiv(PJ_SPALTE_MODUL[key]));
const PJ_FILTER = [['alle', 'alle'], ['offen', 'mit offenen Stunden', 'abrechnung'], ['ohnekunde', 'ohne Kunde', 'kontakte']];
const pjFilter = () => (PJ_FILTER.some((f) => f[0] === pj.filter && modulAktiv(f[2])) ? pj.filter : 'alle');
if (!PJ_SPALTEN.some(([key, , zahl]) => key === pj.sort.k && zahl != null) || ![1, -1].includes(pj.sort.dir)) pj.sort = { k: 'offen_h', dir: -1 };
if (!['alle', 'offen', 'ohnekunde'].includes(pj.filter)) pj.filter = 'alle';

function pjReiter(reiter) {
  return '<div class="abschnitt-kopf"><div class="links"><div class="segment ana-reiter" role="tablist">' +
    PJ_REITER.map(([k, l]) => '<a role="tab" href="#/projekte' + (k ? '/' + k : '') + '" aria-selected="' + (k === reiter) + '"' + (k === reiter ? ' aria-current="page"' : '') + '>' + esc(uebersetze(l)) + '</a>').join('') +
    '</div></div></div>';
}

// Offene Aufgaben je Projekt: offen_n des Arbeitsbereichs, der dieses Projekt traegt.
function pjAufgaben(name, e) {
  if (!e.d) return e.fehler ? { text: '–', titel: uebersetze('Aufgaben nicht geladen') + ': ' + e.fehler } : { text: '…', titel: uebersetze('Lädt …') };
  const b = (e.d.bereiche || []).find((x) => x.projekt === name);
  return b && b.offen_n != null ? { text: num(b.offen_n), n: b.offen_n } : { text: '–', titel: '' };
}

// Abrechnen bis zum letzten Arbeitstag des Kontos: der Rechnungskopf verkuerzt `to` nie, ein spaeteres stuende als
// leistung_bis auf der unveraenderlichen Rechnung. Das Konto bis dorthin ist dieselbe Zahl wie die angezeigte.
// from nie hinter to (ISO-Tage, reiner Textvergleich). Die Stunden belegt der Editor selbst vor.
const pjAbrechnen = (name, k, kontaktId, z) => (!modulAktiv('abrechnung') ? '' : '<a class="knopf klein" href="#/beleg/neu?' + esc(abfrage({ art: 'rechnung', projekt: name, from: z.von > k.letzter_tag ? k.letzter_tag : z.von, to: k.letzter_tag, quelle: 'projekte', kontakt: kontaktId })) +
  '" title="' + esc(uebersetze('Projekt in Rechnung stellen')) + '">' + esc(uebersetze('Abrechnen')) + '</a>');

function pjNummern(k) {
  const n = (k && k.nummern) || [];
  if (!n.length) return '<span class="faint">–</span>';
  const mehr = n.slice(2);
  return n.slice(0, 2).map((x) => '<a class="mono" href="#/rechnungen">' + esc(x) + '</a>').join(', ') +
    (mehr.length ? ' <span class="faint" title="' + esc(mehr.join(', ')) + '">+' + mehr.length + '</span>' : '');
}

/* ---------- Detailseite #/projekte/p/<name>/<reiter> ----------
   Alles kommt aus /api/projekt (Zeitraum: von|bis im Schluessel). Summen bildet nur der Server. */
const PJ_DREITER_ALLE = [['vorgaenge', 'Vorgänge'], ['aufgaben', 'Aufgaben'], ['zeit', 'Zeit ohne Vorgang'], ['rechnungen', 'Rechnungen', 'abrechnung'], ['kunde', 'Kunde & Satz']];
// M1: Reiter ausgeschalteter Module fehlen (Rechnungen ohne Abrechnung).
const pjDReiter = () => PJ_DREITER_ALLE.filter((r) => modulAktiv(r[2]));

function pjDetailKopf(d, name, z) {
  const c = (state.summary && state.summary.config) || {};
  const ab = d.arbeitsbereich, k = d.kontakt, kt = d.konto, s = d.saetze && d.saetze.wirksam;
  const eintrag = d.saetze && d.saetze.eintrag;
  const zm = d.zeitraum.ohne_vorgang[0]?.zeitmodell;
  const jira = ab && ab.jiraProjekt && /^https?:\/\//i.test(c.jiraBaseUrl || '') && /^[A-Z][A-Z0-9]*$/.test(ab.jiraProjekt)
    ? String(c.jiraBaseUrl).replace(/\/+$/, '') + '/browse/' + encodeURIComponent(ab.jiraProjekt) : null;
  const abr = !d.overhead && kt && kt.offen_h > 0 && kt.letzter_tag ? pjAbrechnen(name, kt, k ? k.id : '', z) : '';
  return '<div class="karte weit detail-kopf">' +
    '<a class="textknopf" href="#/projekte">' + esc(uebersetze('← Projekte')) + '</a>' +
    '<div class="detail-titel"><b>' + esc(name) + '</b>' +
      (d.overhead ? '<span class="pille">' + esc(uebersetze('Werkzeug')) + '</span>' : '') + '<span class="rechts">' + abr + '</span></div>' +
    '<div class="detail-chips">' +
      (d.overhead ? '' : k ? '<a class="chip" href="#/kontakte/' + encodeURIComponent(k.id) + '" title="' + esc(uebersetze('Kunde')) + '">' + esc(k.firma || '–') + '</a>'
        : '<span class="chip faint">' + esc(uebersetze('ohne Kunde')) + '</span>') +
      (s ? '<a class="chip" href="#/projekte/p/' + encodeURIComponent(name) + '/kunde" title="' + esc(uebersetze('Stundensatz und Rundung') + (s.quelle ? ' · ' + s.quelle : '')) + '"><span class="mono">' + nf2.format(s.satz) + ' EUR/h</span>' +
        (s.rabatt > 0 ? '<span class="mono">−' + nf1.format(s.rabatt) + ' %</span>' : '') +
        (eintrag && eintrag.rundung != null ? '<span class="mono">' + esc(uebersetze('Rundung Min')) + ' ' + num(eintrag.rundung) + '</span>' : '') + '</a>' : '') +
      (zm ? '<span class="chip" title="' + esc(uebersetze('Zeitmodell')) + '">' + esc(uebersetze(ZEITMODELL_NAME[zm] || (zm === 'gemischt' ? 'gemischt' : zm))) + '</span>' : '') +
      (ab ? '<span class="chip"><span class="bd-marke"' + (ab.farbe ? ' style="--ab-farbe:' + esc(ab.farbe) + '"' : '') + '>' + esc(ab.kuerzel || ab.name.slice(0, 3).toUpperCase()) + '</span>' + esc(ab.name) + '</span>' : '') +
      (jira ? '<a class="chip" href="' + esc(jira) + '" target="_blank" rel="noopener" title="' + esc(uebersetze('In Jira öffnen')) + '"><span class="mono">' + esc(ab.jiraProjekt) + '</span><span>Jira ↗</span></a>' : '') +
    '</div></div>';
}

function pjKonto(d) {
  const k = d.konto;
  if (!k) return '<div class="karte weit"><span class="hinweis">' + esc(uebersetze('Werkzeugprojekt: kein Konto.')) + '</span></div>';
  const kachel = (l, v) => '<div><small>' + esc(uebersetze(l)) + '</small><b>' + esc(hrs(v)) + '</b></div>';
  // M1: ohne Abrechnung gibt es nichts Berechnetes oder Offenes, nur die geleistete Zeit.
  if (!modulAktiv('abrechnung')) {
    return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Konto')) + '</h2>' +
      '<span class="hinweis">' + esc(uebersetze('Stunden ohne Vorgang, bis Zeitraumende')) + '</span></div>' +
      '<div class="bd-kacheln">' + kachel('geleistet h', k.geleistet_h) + '</div></div>';
  }
  return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Konto')) + '</h2>' +
      '<span class="hinweis">' + esc(uebersetze('Stunden ohne Vorgang, bis Zeitraumende')) + '</span></div>' +
    '<div class="bd-kacheln' + (d.konto_bis_heute ? ' vier' : '') + '">' + kachel('geleistet h', k.geleistet_h) + kachel('berechnet h', k.berechnet_h) + kachel('offen h', k.offen_h) +
      (d.konto_bis_heute ? kachel('über h', k.ueber_h) : '') + '</div>' +
    (d.konto_bis_heute ? '' : '<p class="hinweis">' + esc(uebersetze('Überhang nur im Stand bis heute sichtbar')) + '</p>') +
    (k.hinweis ? '<p class="hinweis">' + esc(k.hinweis) + '</p>' : '') +
    '<p class="hinweis">' + esc(uebersetze('Rechnungen')) + ': ' + pjNummern(k) + '</p></div>';
}

const pjTabelle = (kopf, zeilen, leerText) => (zeilen.length
  ? '<div class="tabelle-huelle"><table class="tabelle"><thead><tr>' + kopf.map(([l, z]) => '<th scope="col"' + (z ? ' class="z"' : '') + '>' + esc(uebersetze(l)) + '</th>').join('') +
    '</tr></thead><tbody>' + zeilen.join('') + '</tbody></table></div>'
  : leer('liste', leerText));

function pjReiterInhalt(d, reiter) {
  if (reiter === 'vorgaenge') {
    const abr = d.abrechnung || {};
    return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Vorgänge im Zeitraum')) + '</h2></div>' +
      pjTabelle([['Vorgang'], ['Aktiv h', true], ['Arbeitswert', true], ['Status']], d.vorgaenge.map((t) =>
        '<tr class="klickbar" data-aktion="pj-vorgang" data-wert="' + esc(t.ticket) + '"><td><a class="mono" href="#/vorgaenge/' + encodeURIComponent(t.ticket) + '"><b>' + esc(t.ticket) + '</b></a></td>' +
        '<td class="z">' + hrs(t.active_hours) + '</td><td class="z">' + nf2.format(t.arbeitswert) + '</td><td>' + pille(abr[t.ticket] ? 'abgerechnet' : 'offen') + '</td></tr>'), 'Keine Vorgänge im Zeitraum') + '</div>';
  }
  if (reiter === 'aufgaben') {
    return d.arbeitsbereich
      ? '<div id="bd-wurzel" data-fest="' + esc(d.arbeitsbereich.name) + '"></div>'
      : '<div class="karte weit">' + leer('liste', 'Kein Arbeitsbereich', 'Diesem Projekt ist kein Arbeitsbereich zugeordnet; Aufgaben gibt es erst mit einem.',
        '<a class="knopf klein" href="#/einstellungen/arbeitsbereiche">' + esc(uebersetze('Arbeitsbereiche öffnen')) + '</a>') + '</div>';
  }
  if (reiter === 'zeit') {
    const o = (d.zeitraum && d.zeitraum.ohne_vorgang && d.zeitraum.ohne_vorgang[0]) || null;
    return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Zeit ohne Vorgang')) + '</h2>' +
        '<span class="hinweis">' + esc(uebersetze('im Zeitraum') + ': ' + (o ? uebersetze('Claude-Zeit') + ' ' + hrs(o.active_hours) + ' · ' + nf2.format(o.arbeitswert_claude) + ' EUR  |  ' +
          uebersetze('manuelle Zeit') + ' ' + hrs(o.manuell_hours) + ' · ' + nf2.format(o.arbeitswert_manuell) + ' EUR' : '–')) + '</span></div>' +
      '<h3 class="titel-klein">' + esc(uebersetze('Einheiten')) + '</h3>' +
      pjTabelle([['Tag'], ['Art'], ['Stunden', true]], d.einheiten.map((e) =>
        '<tr><td>' + esc(datum(e.tag)) + '</td><td>' + esc(uebersetze(e.art === 'claude' ? 'Claude' : 'manuell')) + '</td><td class="z">' + hrs(e.stunden) + '</td></tr>'), 'Keine Einheiten im Zeitraum') +
      '<h3 class="titel-klein">' + esc(uebersetze('Manuelle Einträge')) + ' · <a href="#/zeit">' + esc(uebersetze('Zeit öffnen')) + '</a></h3>' +
      pjTabelle([['Datum'], ['Tätigkeit'], ['Minuten', true], ['Status']], d.zeit_eintraege.map((e) =>
        '<tr><td>' + esc(datum(e.tag)) + '</td><td>' + esc(e.taetigkeit) + '</td><td class="z">' + num(e.gezaehlt_min) + '</td><td>' + pille(e.status) + '</td></tr>'), 'Keine manuellen Einträge im Zeitraum') + '</div>';
  }
  if (reiter === 'rechnungen') {
    return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Rechnungen')) + '</h2>' +
        '<span class="hinweis">' + esc(uebersetze('Laufzeit, alle Status; Storno mit negativem Betrag')) + '</span></div>' +
      pjTabelle([['Nr'], ['Datum'], ['Stunden', true], ['Netto EUR', true], ['Status']], d.rechnungen.map((r) =>
        '<tr><td><a class="mono" href="#/rechnungen">' + esc(r.nr) + '</a></td><td>' + esc(datum(r.erstellt_am)) + '</td><td class="z">' + hrs(r.stunden) + '</td><td class="z">' + nf2.format(r.betrag_eur) +
        '</td><td>' + pille(r.status) + '</td></tr>'), 'Noch keine Rechnungen auf dieses Projekt') + '</div>';
  }
  return pjKundeKarte(d);
}

/* Reiter Kunde & Satz: schreibt nur ueber vorhandene, geraetegeschuetzte Routen
   (/api/saetze via speichereSatz, /api/kontakt via ordneZu). Der Server ersetzt die
   Projektliste eines Kontakts und weist ein vergebenes Projekt ab; ein Kundenwechsel
   ist deshalb loesen, dann zuordnen — zwei Schritte, nicht atomar. */
function pjKundeKarte(d) {
  const kopf = '<div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Kunde & Satz')) + '</h2></div>';
  if (d.overhead) return '<div class="karte weit" id="pj-kunde">' + kopf + '<span class="hinweis">' + esc(uebersetze('Werkzeugprojekt: wird nicht abgerechnet, daher ohne Kunde und Satz.')) + '</span></div>';
  ladeSaetze();
  const name = d.name, k = d.kontakt;
  const liste = (state.kontakte || []).slice().sort((a, b) => kontaktName(a).localeCompare(kontaktName(b), istDE() ? 'de' : 'en'));
  // M1: ohne Modul Kontakte keine Kundenwahl (POST /api/kontakt antwortet 409), Satz und Zeitmodell bleiben.
  const wahl = !modulAktiv('kontakte') ? (k ? '<p class="dim">' + esc(uebersetze('Kunde')) + ': ' + esc(kontaktName(k)) + '</p>' : '') : state.kontakte
    ? '<p><label>' + esc(uebersetze('Kunde')) + ' <select class="eingabe" id="pj-kunde-wahl" aria-label="' + esc(uebersetze('Kunde') + ' · ' + name) + '">' +
      '<option value="">' + esc(uebersetze('Kein Kunde')) + '</option>' +
      liste.map((x) => '<option value="' + esc(String(x.id)) + '"' + (k && k.id === x.id ? ' selected' : '') + '>' + esc(kontaktName(x)) + '</option>').join('') + '</select></label></p>'
    : state.fehler.belege
      ? leer('liste', 'Kontakte nicht geladen', '', '<button type="button" class="knopf klein" data-aktion="belege-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  return '<div class="karte weit" id="pj-kunde" data-projekt="' + esc(name) + '">' + kopf + wahl + satzTabelle([name], false, false) + '</div>';
}

// Zwischenspeicher dieses Projekts und der Uebersicht verwerfen: der alte Stand bleibt bis zur Antwort stehen (kein Flackern).
function pjNeu(name) {
  for (const s of Object.keys(bereichDaten)) {
    if (s === 'projekte' || s.startsWith('projekt:' + name + '|')) { bereichDaten[s].bezug = null; bereichDaten[s].zeit = 0; }
  }
}

async function pjKundeWechsel(name, neu) {
  const hat = (id) => { const x = kFinde(id); return !!x && (x.projekte || []).includes(name); };
  // Bisheriger Kunde aus den Kontakten, nicht aus dem Abruf: ein zweiter Wechsel vor dem frischen Abruf sieht sonst den alten Stand.
  const bisher = (state.kontakte || []).find((x) => (x.projekte || []).includes(name));
  const alt = bisher ? bisher.id : 0;
  if (alt) {
    await ordneZu(alt, name, true);
    if (hat(alt)) { toast(uebersetze('Kunde nicht gewechselt') + ': ' + name + ' ' + uebersetze('bleibt beim bisherigen Kunden.'), 'err'); return; }
  }
  if (neu) {
    await ordneZu(neu, name);
    if (!hat(neu)) toast(name + ' ' + uebersetze('hat jetzt keinen Kunden — die Zuordnung zum neuen Kunden ist gescheitert.'), 'err');
  }
}

// Ein Eingabefeld des Reiters behaelt den Fokus: der Takt der Shell zeichnet dann nicht neu, erst beim Verlassen.
document.addEventListener('focusout', (e) => {
  const p = e.target.closest && e.target.closest('#pj-kunde');
  if (p && !(e.relatedTarget && p.contains(e.relatedTarget))) setTimeout(zeichneAnsicht, 0);
});

function zeichneProjektDetail(w, name, wunsch) {
  const S = state.summary;
  if (!S) { w.innerHTML = state.fehler.summary ? leer('liste', 'Server nicht erreichbar') : '<div class="leer">…</div>'; return; }
  const z = aktuellerZeitraum();
  const e = ladeBereich('projekt:' + name + '|' + z.von + '|' + z.bis, '/api/projekt?' + abfrage({ name, from: z.von, to: z.bis }), 60000);
  const zurueck = '<a class="knopf klein" href="#/projekte">' + esc(uebersetze('Zur Projektübersicht')) + '</a>';
  if (!e.d && e.fehler === 'HTTP 404') { w.innerHTML = leer('liste', 'Projekt nicht gefunden', 'Zu diesem Namen gibt es keine Arbeit und keinen Kunden.', zurueck); return; }
  const warte = bereichWarte(e);
  if (warte) { w.innerHTML = '<div class="karte weit">' + zurueck + '</div>' + warte; return; }
  const d = e.d;
  const gueltig = (k) => pjDReiter().some(([x]) => x === k);
  if (gueltig(wunsch)) merke('projekte.reiter', wunsch);
  const reiter = gueltig(wunsch) ? wunsch : (gueltig(lies('projekte.reiter', '')) ? lies('projekte.reiter', '') : 'vorgaenge');
  // Steht das Board des Reiters schon, ersetzt der Takt der Shell nichts (sonst bricht Ziehen ab): nur nachladen.
  const wz = w.querySelector('#bd-wurzel');
  if (reiter === 'aufgaben' && d.arbeitsbereich && wz && wz.dataset.fest === d.arbeitsbereich.name) { bdAuffrischen(); return; }
  // Tippt jemand im Reiter Kunde & Satz, bleibt das Feld stehen; gezeichnet wird beim Verlassen (focusout oben).
  const fa = document.activeElement;
  if (reiter === 'kunde' && w.querySelector('#pj-kunde') && fa && fa.closest('#pj-kunde') && /^(INPUT|SELECT)$/.test(fa.tagName)) return;
  const fv = fokusMerken(w);
  const basis = '#/projekte/p/' + encodeURIComponent(name) + '/';
  w.innerHTML = pjDetailKopf(d, name, z) + pjKonto(d) +
    '<div class="abschnitt-kopf"><div class="links"><div class="segment ana-reiter" role="tablist">' +
    pjDReiter().map(([k, l]) => '<a role="tab" href="' + basis + k + '" aria-selected="' + (k === reiter) + '"' + (k === reiter ? ' aria-current="page"' : '') + '>' + esc(uebersetze(l)) + '</a>').join('') +
    '</div></div></div>' + pjReiterInhalt(d, reiter);
  if (reiter === 'aufgaben' && d.arbeitsbereich) bdStart(document.getElementById('bd-wurzel'), d.arbeitsbereich.name);
  const pane = w.querySelector('#pj-kunde[data-projekt]');
  if (pane) {
    verdrahteSaetze(pane);   // frisches Element je Zeichnen: keine doppelten Listener
    pane.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.satzfeld) e.target.blur(); });
    pane.addEventListener('change', (e) => {
      const s = e.target;
      if (s.id !== 'pj-kunde-wahl') return;
      s.disabled = true;
      // Freigeben vor dem Zeichnen: steht das Select noch im Fokus, blockt die Fokus-Sperre oben den Neuaufbau.
      pjKundeWechsel(name, Number(s.value) || 0).finally(() => { s.disabled = false; pjNeu(name); zeichneAnsicht(); });
    });
  }
  fokusZurueck(w, fv);
}

function zeichneProjekte(w, teile) {
  const sub = teile[0];
  if (sub === 'board') {
    // Steht das Board schon, ersetzt der Takt der Shell nichts (sonst bricht Ziehen ab): nur nachladen.
    // data-fest leer = Gesamt-Board; das Board eines Projekt-Reiters (data-fest = Name) wird ersetzt.
    const wz = w.querySelector('#bd-wurzel');
    if (wz && wz.dataset.fest === '') { bdAuffrischen(); return; }
    w.innerHTML = pjReiter('board') + '<div id="bd-wurzel" data-fest=""></div>';
    bdStart(document.getElementById('bd-wurzel'), null);
    return;
  }
  if (sub === 'p') { zeichneProjektDetail(w, teile[1] || '', teile[2]); return; }
  const S = state.summary;
  if (!S) { w.innerHTML = pjReiter('') + (state.fehler.summary ? leer('liste', 'Server nicht erreichbar') : '<div class="leer">…</div>'); return; }
  const e = ladeBereich('projekte', '/api/projekte', 60000);
  const eb = ladeBereich('board-alle', '/api/board?bereich=alle&quelle=alle', 60000);
  const warte = bereichWarte(e);
  if (warte) { w.innerHTML = pjReiter('') + warte; return; }
  const liste = Array.isArray(e.d) ? e.d : (e.d && Array.isArray(e.d.projekte) ? e.d.projekte : null);
  if (!liste) { w.innerHTML = pjReiter('') + leer('liste', 'Projekte nicht geladen', 'Die Antwort enthält keine Projektliste.'); return; }
  const zeitraum = new Map((S.projects || []).map((p) => [p.project, p]));
  const verlauf = S.projekt_verlauf || {};
  const tage = tageDesZeitraums(S);
  const z = aktuellerZeitraum();

  const zeilen = liste.map((p) => {
    const t = zeitraum.get(p.name), k = p.konto;
    return { p, t, k, name: p.name, kunde: p.kontakt ? p.kontakt.firma || '' : '',
      geleistet_h: k ? k.geleistet_h : null, berechnet_h: k ? k.berechnet_h : null, offen_h: k ? k.offen_h : null,
      aktiv: t ? t.active_seconds / 3600 : null, api: t ? t.cost_usd : null, wert: t && !p.overhead ? t.arbeitswert : null, offen_n: pjAufgaben(p.name, eb).n };
  });
  const passt = {
    alle: () => true,
    offen: (r) => r.k && r.k.offen_h > 0,
    ohnekunde: (r) => !r.p.overhead && !r.p.kontakt,
  }[pjFilter()];
  // Sortierung nach einer ausgeblendeten Spalte faellt auf geleistet h zurueck.
  const { k: sk, dir } = pjSpalten().some(([key, , zahl]) => key === pj.sort.k && zahl != null) ? pj.sort : { k: 'geleistet_h', dir: -1 };
  const gezeigt = zeilen.filter(passt).sort((a, b) => {
    if (a.p.overhead !== b.p.overhead) return a.p.overhead ? 1 : -1;   // Werkzeug immer unten
    const xv = a[sk], yv = b[sk];
    if (xv == null && yv == null) return a.p.name.localeCompare(b.p.name, 'de');
    if (xv == null || xv === '') return 1;
    if (yv == null || yv === '') return -1;
    return (typeof xv === 'string' ? xv.localeCompare(yv, 'de') : xv - yv) * dir || a.p.name.localeCompare(b.p.name, 'de');
  });

  const kopf = pjSpalten().map(([key, label, zahl, unter]) => {
    if (zahl == null) return '<th scope="col">' + (label ? esc(uebersetze(label)) + (unter ? '<span class="unter">' + esc(uebersetze(unter)) + '</span>' : '') : '<span class="nur-sr">' + esc(uebersetze('Abrechnen')) + '</span>') + '</th>';
    const aktiv = sk === key;
    return '<th scope="col"' + (zahl ? ' class="z"' : '') + ' aria-sort="' + (aktiv ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
      '<button type="button" class="th-knopf" data-aktion="pj-sort" data-wert="' + key + '">' + esc(uebersetze(label)) +
        (unter ? '<span class="unter">' + esc(uebersetze(unter)) + '</span>' : '') + '</button></th>';
  }).join('');

  const h = (v) => (v == null ? '<span class="faint">–</span>' : nf1.format(v));
  const zeile = (r) => {
    const { p, k, t } = r;
    const a = pjAufgaben(p.name, eb);
    const abr = !p.overhead && k && k.offen_h > 0 && k.letzter_tag ? pjAbrechnen(p.name, k, p.kontakt ? p.kontakt.id : '', z) : '';
    const zelle = {
      name: '<td class="ana-name"><span class="bd-marke"' + (p.arbeitsbereich && p.arbeitsbereich.farbe ? ' style="--ab-farbe:' + esc(p.arbeitsbereich.farbe) + '"' : '') + '>' +
        esc((p.arbeitsbereich && p.arbeitsbereich.kuerzel) || p.name.slice(0, 3).toUpperCase()) + '</span> ' +
        '<a href="#/projekte/p/' + encodeURIComponent(p.name) + '">' + esc(p.name) + '</a>' +
        (p.arbeitsbereich && p.arbeitsbereich.jiraProjekt ? ' <span class="pille">' + esc(p.arbeitsbereich.jiraProjekt) + '</span>' : '') +
        (p.overhead ? ' <span class="pille">' + esc(uebersetze('Werkzeug')) + '</span>' : '') + '</td>',
      kunde: '<td class="dim ell">' + esc(p.overhead ? '–' : r.kunde || '–') + '</td>',
      geleistet_h: '<td class="z">' + h(r.geleistet_h) + '</td>', berechnet_h: '<td class="z">' + h(r.berechnet_h) + '</td>',
      offen_h: '<td class="z"' + (k && k.hinweis ? ' title="' + esc(k.hinweis) + '"' : '') + '>' + (k && k.ueber_h > 0 ? '<span class="schlecht">' : '<span>') + h(r.offen_h) + '</span></td>',
      rechnungen: '<td class="nowrap">' + (p.overhead ? '<span class="faint">–</span>' : pjNummern(k)) + '</td>',
      aktiv: '<td class="z">' + h(r.aktiv) + '</td>', api: '<td class="z akzent">' + (r.api == null ? '<span class="faint">–</span>' : nf2.format(r.api)) + '</td>',
      wert: '<td class="z">' + (r.wert == null ? '<span class="faint">–</span>' : nf2.format(r.wert)) + '</td>',
      verlauf: '<td>' + (t ? projektSpark(verlauf[p.name], tage) : '<span class="faint">–</span>') + '</td>',
      offen_n: '<td class="z"' + (a.titel ? ' title="' + esc(a.titel) + '"' : '') + '>' + (a.n == null ? '<span class="faint">' + esc(a.text) + '</span>' : esc(a.text)) + '</td>',
      abrechnen: '<td class="z">' + abr + '</td>',
    };
    // Dieselbe Spaltenliste wie der Kopf, sonst verrutschen die Zellen.
    return '<tr class="klickbar' + (p.overhead ? ' gedaempft' : '') + '" data-aktion="pj-oeffnen" data-wert="' + esc(p.name) + '">' +
      pjSpalten().map(([key]) => zelle[key]).join('') + '</tr>';
  };

  w.innerHTML = pjReiter('') + '<div class="karte weit">' +
    '<div class="karten-kopf"><h2 class="titel-klein">' + num(liste.length) + ' ' + esc(uebersetze('Projekte')) + '</h2>' +
      '<span class="hinweis">' + esc(uebersetze('Konto: Stunden ohne Vorgang bis heute. Aktiv h, API USD und Arbeitswert: alle Arbeit im gewählten Zeitraum.')) + '</span>' +
      '<span class="rechts">' + (PJ_FILTER.filter((f) => modulAktiv(f[2])).length > 1 ? segment('pj-filter', PJ_FILTER.filter((f) => modulAktiv(f[2])), pjFilter(), 'Filter') : '') + '</span></div>' +
    (eb.fehler ? '<p class="hinweis warn" role="alert">' + esc(uebersetze('Aufgaben nicht geladen') + ': ' + eb.fehler) + '</p>' : '') +
    (!liste.length ? leer('liste', 'Noch keine Projekte', 'Sobald Arbeit einem Projekt zugeordnet ist, erscheint es hier.')
      : !gezeigt.length ? leer('liste', 'Kein Projekt passt zum Filter')
      : '<div class="tabelle-huelle"><table class="tabelle pj-tabelle"><thead><tr>' + kopf + '</tr></thead><tbody>' + gezeigt.map(zeile).join('') + '</tbody></table></div>') +
  '</div>';
}

aktion('pj-sort', (k) => {
  pj.sort = { k, dir: pj.sort.k === k ? -pj.sort.dir : (k === 'name' || k === 'kunde' ? 1 : -1) };
  merke('projekte.sort', pj.sort);
  zeichneAnsicht();
});
aktion('pj-filter', (f) => { pj.filter = f; merke('projekte.filter', f); zeichneAnsicht(); });
aktion('pj-vorgang', (t) => geheZu('vorgaenge/' + encodeURIComponent(t)));
aktion('pj-oeffnen',(name) => geheZu('projekte/p/' + encodeURIComponent(name)));

registriere('projekte', { zeichne: zeichneProjekte });
