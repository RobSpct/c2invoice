'use strict';
/* Angebote und Rechnungen (Block 4a). Free zeigt beide als Tabelle mit
   Filtern; Kanban ist noch nicht gebaut und erscheint bei offenem Schalter
   nicht (R16). Gerechnet wird hier
   nichts: Status, gezahlt, Rest und die Kennzahlen kommen vom Server
   (rechnung.liste, rechnung.kennzahlen, angebot.liste). Im Browser entstehen
   nur Filter, Sortierung, die Summe der angezeigten Zeilen und Formatierung. */

Object.assign(EN, {
  'Offen gesamt': 'Open total', 'gestellt, abzüglich Zahlungen': 'issued, minus payments',
  'Rechnung mit offenem Rest': 'invoice with an open balance', 'Rechnungen mit offenem Rest': 'invoices with an open balance',
  'Bezahlt im Zeitraum': 'Paid in period', 'Zahlungseingänge nach Eingangstag': 'payments by date received',
  'Ø Zahlungsdauer': 'Ø time to pay', 'Tage': 'days', 'Rechnungsdatum bis letzte Zahlung': 'invoice date to last payment',
  'noch keine bezahlte Rechnung im Zeitraum': 'no paid invoice in period yet',
  'Gestellt im Zeitraum': 'Issued in period', 'storniert': 'cancelled', 'Überfällig': 'Overdue',
  'Fälligkeits-Ampel mit der Pro-Version': 'Due-date traffic light with Pro',
  'nichts überfällig': 'nothing overdue', 'überfällig': 'overdue', 'älteste seit {n} Tagen': 'oldest {n} days',
  'älteste seit 1 Tag': 'oldest 1 day', 'überfällig seit 1 Tag': 'overdue 1 day', 'überfällig seit {n} Tagen': 'overdue {n} days',
  'Rechnung überfällig': 'invoice overdue', 'Rechnungen überfällig': 'invoices overdue',
  'Alle': 'All', 'Offen': 'Open', 'Teilbezahlt': 'Partly paid', 'Bezahlt': 'Paid', 'Storniert': 'Cancelled',
  'Angenommen': 'Accepted', 'Abgelehnt / Abgelaufen': 'Declined / expired', 'Abgerechnet': 'Invoiced',
  'Tabelle': 'Table', 'Kanban': 'Kanban', 'Ansicht': 'View',
  'Suchen: Nummer, Kunde, Leistung': 'Search: number, customer, service', 'Suchen: Nummer, Kunde': 'Search: number, customer',
  '+ Rechnung': '+ Invoice', '+ Angebot': '+ Quote', 'Alle Kunden': 'All customers',
  'Nummer': 'Number', 'Kunde · Leistung': 'Customer · service', 'Datum': 'Date', 'Brutto €': 'Gross €', 'Fällig': 'Due',
  'Status': 'Status', 'Aktion': 'Action', 'Kunde': 'Customer', 'Erstellt': 'Created', 'Gültig bis': 'Valid until',
  'Nach Datum sortieren': 'Sort by date', 'Nach Betrag sortieren': 'Sort by amount', 'Nach Fälligkeit sortieren': 'Sort by due date',
  'heute': 'today', 'in 1 Tag': 'in 1 day', 'in {n} Tagen': 'in {n} days', 'seit 1 Tag': 'since 1 day', 'seit {n} Tagen': 'since {n} days',
  'Gegenrechnung zu': 'Credit note for', 'storniert durch': 'cancelled by',
  'vollständig': 'in full', 'noch nichts': 'nothing yet', 'von': 'of',
  'Zahlung': 'Payment', 'Weitere Aktionen': 'More actions', 'Dokument ansehen': 'View document', 'PDF laden': 'Load PDF',
  'PDF erzeugen': 'Create PDF', 'XRechnung laden': 'Load XRechnung', 'Stornieren …': 'Cancel …', 'Stornieren': 'Cancel invoice',
  'Abbrechen': 'Abort',
  'Storno erzeugt eine Gegenrechnung über {b} mit der nächsten Nummer. Die Rechnung bleibt erhalten – gelöscht wird nie (§ 14 UStG).':
    'Cancelling creates a credit note of {b} with the next number. The invoice stays — nothing is ever deleted (§ 14 UStG).',
  'Positionen': 'Items', 'Zahlungen': 'Payments', 'Verlauf': 'History', 'netto': 'net', 'USt': 'VAT',
  'Dokument ansehen →': 'View document →', 'Noch kein Zahlungseingang.': 'No payment yet.', 'Rest': 'Balance',
  'ausgeglichen': 'settled', '+ Zahlung erfassen': '+ Record payment', 'Zahlung entfernen': 'Remove payment',
  'gestellt': 'issued', 'Zahlung über': 'Payment of', 'Storno': 'Credit note', 'Positionen laden …': 'Loading items …',
  'Rechnung nicht geladen': 'Invoice not loaded', 'pauschal': 'flat',
  'Mahnen, Versand und Kontoauszug': 'Reminders, sending and bank statement',
  'Zahlungserinnerung und Mahnung, Versand per E-Mail, Zahlungen aus dem Kontoauszug zuordnen — mit der Pro-Version.':
    'Payment reminders and dunning, sending by e-mail, matching payments from the bank statement — with Pro.',
  'Kanban-Ansicht': 'Kanban view', 'Belege als Spalten nach Stand, Karten ziehen — mit der Pro-Version.': 'Documents as columns by state, drag cards — with Pro.',
  'Noch keine Rechnung gestellt': 'No invoice issued yet', 'Keine Rechnung passt zu Filter oder Suche': 'No invoice matches filter or search',
  'Noch kein Angebot': 'No quote yet', 'Kein Angebot passt zu Filter oder Suche': 'No quote matches filter or search',
  'Belege nicht geladen': 'Documents not loaded', 'Belege nicht aktualisiert': 'Documents not refreshed',
  'Zahlung erfassen': 'Record payment', 'bisher bezahlt': 'paid so far', 'offen': 'open', 'Betrag €': 'Amount €', 'Eingang am': 'Received on',
  'Notiz, z. B. Abschlag oder Verwendungszweck': 'Note, e.g. instalment or reference', 'Zahlung buchen': 'Book payment',
  'Danach offen': 'Open afterwards', 'Danach bezahlt': 'Paid in full afterwards', 'Keine gültige Zahl': 'Not a valid number',
  'Mehr als der offene Rest': 'More than the open balance', 'Hälfte': 'Half',
  'Zahlung gebucht': 'Payment booked', 'Rückgängig': 'Undo', 'Zahlung entfernt': 'Payment removed',
  'Zahlung nicht gebucht': 'Payment not booked', 'Zahlung nicht entfernt': 'Payment not removed',
  'Storno erzeugt': 'Credit note created', 'Storno fehlgeschlagen': 'Cancellation failed',
  'PDF erzeugt': 'PDF created', 'Öffnen': 'Open', 'PDF fehlgeschlagen': 'PDF failed',
  'E-Rechnung noch nicht vollständig': 'E-invoice not complete yet', 'XRechnung fehlgeschlagen': 'XRechnung failed',
  'Diese Angaben fehlen für die E-Rechnung. Ergänze sie im Kontakt oder in den Stammdaten und lade die Datei dann erneut.':
    'These details are missing for the e-invoice. Add them to the contact or the master data, then load the file again.',
  'Kontakte öffnen': 'Open contacts', 'Stammdaten öffnen': 'Open master data', 'Schließen': 'Close',
  'Angebote im Filter': 'quotes in filter', 'Angebot im Filter': 'quote in filter', 'brutto': 'gross',
  'Rechnungen im Filter': 'invoices in filter', 'Rechnung im Filter': 'invoice in filter',
  'läuft heute ab': 'expires today', 'noch {n} Tage': '{n} days left', 'noch 1 Tag': '1 day left', 'abgelaufen': 'expired',
  'Abrechenbare Angebote': 'Quotes ready to invoice', 'Abrechnen': 'Invoice', 'PDF neu erzeugen': 'Regenerate PDF', 'In Rechnung …': 'Invoice …',
  'Lead': 'Lead', 'In Rechnung →': 'Invoice →', 'Ansehen': 'View', 'Annehmen': 'Accept', 'Ablehnen': 'Decline',
  'Wieder öffnen': 'Reopen', 'Löschen …': 'Delete …', 'Löschen': 'Delete',
  'Erzeugt eine Rechnung über {b} mit der nächsten Nummer. Das Angebot bleibt, wie es ist.':
    'Creates an invoice of {b} with the next number. The quote stays as it is.',
  'Rechnung erstellen': 'Create invoice',
  'Das Angebot wird gelöscht. Angebote sind kein Steuerdokument; die Nummer bleibt frei.':
    'The quote will be deleted. Quotes are not tax documents; the number stays unused.',
  'Status geändert': 'Status changed', 'Status nicht geändert': 'Status not changed', 'Angebot gelöscht': 'Quote deleted',
  'Löschen fehlgeschlagen': 'Delete failed', 'Rechnung erstellt': 'Invoice created', 'Rechnung nicht erstellt': 'Invoice not created',
  'angenommen': 'accepted', 'abgelehnt': 'declined', 'abgerechnet': 'invoiced', 'Gutschrift': 'credit note',
  'teilbezahlt': 'partly paid', 'bezahlt': 'paid', 'Belege laden …': 'Loading documents …', 'Brutto': 'Gross',
  'Anzeige nicht aktualisiert': 'View not refreshed',
  'Keine Antwort vom Server — die Zahlung ist vielleicht gebucht. Bitte die Zeile prüfen, bevor du erneut buchst.':
    'No answer from the server — the payment may have been booked. Check the row before booking again.',
});

// Fuellt {n}/{b} nach der Uebersetzung ein — sonst braeuchte jede Zahl einen eigenen Eintrag.
const fuelle = (text, werte) => uebersetze(text).replace(/\{(\w+)\}/g, (m, k) => (k in werte ? werte[k] : m));

const R_FILTER = [['alle', 'Alle'], ['offen', 'Offen'], ['ueberfaellig', 'Überfällig'], ['teilbezahlt', 'Teilbezahlt'], ['bezahlt', 'Bezahlt'], ['storniert', 'Storniert']];
const R_PASST = {
  alle: () => true,
  offen: (r) => r.status_abgeleitet === 'offen',
  // Vom Server: Tage seit der Faelligkeit, solange etwas offen ist (rechnung.mitAmpel).
  ueberfaellig: (r) => r.ueberfaellig_tage > 0,
  teilbezahlt: (r) => r.status_abgeleitet === 'teilbezahlt',
  bezahlt: (r) => r.status_abgeleitet === 'bezahlt',
  storniert: (r) => r.status_abgeleitet === 'storniert' || r.status_abgeleitet === 'storno',
};
const A_FILTER = [['alle', 'Alle'], ['offen', 'Offen'], ['angenommen', 'Angenommen'], ['abgelehnt', 'Abgelehnt / Abgelaufen'], ['abgerechnet', 'Abgerechnet']];
const A_PASST = {
  alle: () => true,
  offen: (a) => a.status_abgeleitet === 'offen',
  angenommen: (a) => a.status_abgeleitet === 'angenommen',
  abgelehnt: (a) => a.status_abgeleitet === 'abgelehnt' || a.status_abgeleitet === 'abgelaufen',
  abgerechnet: (a) => a.status_abgeleitet === 'abgerechnet',
};
const R_SORT = ['datum', 'brutto', 'faellig'];

// Gemerkte Wahl aus dem Browser-Speicher nur in bekannter Form uebernehmen.
const bz = {
  rf: lies('rechnungen.filter', 'alle'),
  rq: '',
  rsort: liesJson('rechnungen.sort', { k: 'datum', dir: -1 }),
  af: lies('angebote.filter', 'alle'),
  aq: '',
  akunde: '',
  ansicht: { rechnungen: 'tabelle', angebote: 'tabelle' },
  auf: Object.create(null),     // nr -> { d, fehler, lauf } der aufgeklappten Rechnung
  menu: null,                   // Nummer mit offenem ⋯-Menue
  frage: null,                  // { art, nr } Rueckfrage in der Zeile
};
if (!R_PASST[bz.rf]) bz.rf = 'alle';
if (!A_PASST[bz.af]) bz.af = 'alle';
if (!bz.rsort || !R_SORT.includes(bz.rsort.k) || ![1, -1].includes(bz.rsort.dir)) bz.rsort = { k: 'datum', dir: -1 };

// Tag in Ortszeit: erstellt_am ist ein UTC-Zeitstempel.
const ortsTag = (iso) => isoTag(new Date(iso));
const heuteTag = () => isoTag(new Date());

function belegeWarte(liste, titel) {
  if (liste) return null;
  return state.fehler.belege
    ? leer('beleg', 'Belege nicht geladen', '', '<button type="button" class="knopf klein" data-aktion="belege-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
    : '<div class="leer">' + esc(uebersetze(titel)) + '</div>';
}
aktion('belege-neu', () => ladeBelege());

function chips(aktionName, liste, aktuell, zaehle) {
  return liste.map(([w, l]) => '<button type="button" class="chip" data-aktion="' + aktionName + '" data-wert="' + w + '" aria-pressed="' + (w === aktuell) + '">' +
    esc(uebersetze(l)) + '<span class="n">' + num(zaehle(w)) + '</span></button>').join('');
}

function ansichtWahl(seite) {
  if (proAktiv()) return '';
  const a = bz.ansicht[seite];
  return '<span class="segment" role="group" aria-label="' + esc(uebersetze('Ansicht')) + '">' +
    '<button type="button" data-aktion="beleg-ansicht" data-wert="' + seite + ':tabelle" aria-pressed="' + (a === 'tabelle') + '">' + esc(uebersetze('Tabelle')) + '</button>' +
    '<button type="button" data-aktion="beleg-ansicht" data-wert="' + seite + ':kanban" aria-pressed="' + (a === 'kanban') + '">' + esc(uebersetze('Kanban')) + ' <span class="pille pro">Pro</span></button></span>';
}
aktion('beleg-ansicht', (wert) => {
  const [seite, a] = String(wert).split(':');
  if (!(seite in bz.ansicht) || !['tabelle', 'kanban'].includes(a)) return;
  bz.ansicht[seite] = a;
  zeichneAnsicht();
});
const kanbanSperre = () => '<div class="karte eingelassen sperre-huelle">' + sperre('Kanban-Ansicht', 'Belege als Spalten nach Stand, Karten ziehen — mit der Pro-Version.') + '</div>';

// Neue Belege entstehen im Beleg-Editor (editor.js). Entwuerfe stehen als
// eigener Knopf daneben, nie als Tabellenzeile (R5).
const neuKnopf = (text, art) => entwuerfeKnopf() +
  (art === 'rechnung' ? '<a class="knopf" href="#/beleg/neu?art=rechnung&amp;quelle=vorgaenge">' + esc(uebersetze('Aus Vorgängen')) + '</a>' : '') +
  '<a class="knopf primaer" href="#/beleg/neu?art=' + art + '">' + esc(uebersetze(text)) + '</a>';

function suchFeld(id, wert, platzhalter) {
  return '<input type="search" class="suche-feld" id="' + id + '" value="' + esc(wert) + '" placeholder="' + esc(uebersetze(platzhalter)) + '" aria-label="' + esc(uebersetze(platzhalter)) + '">';
}

function menue(nr, eintraege) {
  const auf = bz.menu === nr;
  return '<span class="zeilen-menue"><button type="button" class="mini-knopf" data-aktion="beleg-menue" data-wert="' + esc(nr) + '" aria-haspopup="menu" aria-expanded="' + auf + '" title="' + esc(uebersetze('Weitere Aktionen')) + '">⋯</button>' +
    (auf ? '<span class="menue" role="menu">' + eintraege.join('') + '</span>' : '') + '</span>';
}
const menueLink = (href, text, neuesFenster) => '<a role="menuitem" href="' + esc(href) + '"' + (neuesFenster ? ' target="_blank" rel="noopener"' : '') + '>' + esc(uebersetze(text)) + '</a>';
const menueKnopf = (aktionName, wert, text, gefahr) => '<button type="button" role="menuitem"' + (gefahr ? ' class="gefahr"' : '') + ' data-aktion="' + aktionName + '" data-wert="' + esc(wert) + '">' + esc(uebersetze(text)) + '</button>';
aktion('beleg-menue', (nr) => { bz.menu = bz.menu === nr ? null : nr; bz.frage = null; zeichneAnsicht(); });
// Klick ausserhalb schliesst das Menue. Nur das Menue-Element geht weg, kein
// Neuzeichnen: sonst traefe der Klick ein schon ersetztes Element und ginge verloren.
function menueZu() {
  bz.menu = null;
  for (const m of document.querySelectorAll('.zeilen-menue .menue')) m.remove();
  for (const k of document.querySelectorAll('.zeilen-menue [aria-expanded="true"]')) k.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', (e) => {
  if (!bz.menu) return;
  // Link im Menue (Dokument, PDF): erst oeffnen lassen, dann schliessen.
  if (e.target.closest('.zeilen-menue .menue a')) { setTimeout(menueZu, 0); return; }
  if (!e.target.closest('.zeilen-menue')) menueZu();
}, true);

function frageZeile(text, aktionName, nr, knopfText, gefahr) {
  return '<div class="b-frage' + (gefahr ? '' : ' neutral') + '" role="alert"><span>' + esc(text) + '</span>' +
    '<button type="button" class="knopf klein" data-aktion="beleg-frage-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
    '<button type="button" class="knopf klein ' + (gefahr ? 'gefahr' : 'primaer') + '" data-aktion="' + aktionName + '" data-wert="' + esc(nr) + '">' + esc(uebersetze(knopfText)) + '</button></div>';
}
aktion('beleg-frage-zu', () => { bz.frage = null; zeichneAnsicht(); });
const frageAuf = (art, nr) => { bz.frage = { art, nr }; bz.menu = null; zeichneAnsicht(); };
const frageIst = (art, nr) => bz.frage && bz.frage.art === art && bz.frage.nr === nr;

// Nach einer Aenderung: Listen, Kennzahlen und eine aufgeklappte Zeile neu holen.
// Faengt selbst: ein Fehler beim Neuzeichnen darf nicht als gescheiterte
// Aktion erscheinen — die Aktion ist dann schon auf dem Server passiert.
async function belegeNeu(nr) {
  try {
    await ladeBelege();
    ladeSummary();
    if (nr && bz.auf[nr]) ladeDetail(nr);
  } catch (e) {
    console.error(e);
    toast(uebersetze('Anzeige nicht aktualisiert') + ': ' + e.message, 'err');
  }
}

/* ---------- Rechnungen ---------- */

// Zweiter Einstieg in denselben Weg wie im Angebote-Reiter: wer abrechnen will,
// sucht hier. Leer erscheint die Karte nicht — sie waere nur Rauschen.
function abrechenbareAngebote() {
  const liste = (state.angebote || []).filter((a) => a.status_abgeleitet === 'angenommen' && !a.rechnung_nr);
  if (!liste.length) return '';
  return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Abrechenbare Angebote')) + '</h2>' +
      '<span class="hinweis">' + esc(uebersetze('angenommen und noch nicht abgerechnet')) + '</span></div>' +
    liste.map((a) => '<div class="b-eintrag"><div class="b-zeile ohne-klick abr-angebot">' +
      '<span class="mono">' + esc(a.nr) + '</span>' +
      '<span class="t ell">' + esc(a.empfaenger || '—') + '</span>' +
      '<span class="mono dim">' + esc(datum(ortsTag(a.erstellt_am))) + '</span>' +
      '<span class="mono rechts">' + nf2.format(a.brutto_eur) + '</span>' +
      '<span class="b-aktion"><a class="mini-aktion" href="/angebot/' + encodeURIComponent(a.nr) + '" target="_blank" rel="noopener">' + esc(uebersetze('Ansehen')) + '</a>' +
        '<button type="button" class="mini-aktion akzent" data-aktion="a-rechnung-frage" data-wert="' + esc(a.nr) + '">' + esc(uebersetze('Abrechnen')) + '</button></span></div>' +
      (frageIst('rechnung', a.nr) ? frageZeile(fuelle('Erzeugt eine Rechnung über {b} mit der nächsten Nummer. Das Angebot bleibt, wie es ist.', { b: eur(a.brutto_eur) }), 'a-rechnung', a.nr, 'Rechnung erstellen') : '') +
    '</div>').join('') + '</div>';
}

function faelligText(r) {
  if (r.status_abgeleitet === 'storno' || r.status_abgeleitet === 'storniert') return { t: '—', s: '' };
  if (r.status_abgeleitet === 'bezahlt') return { t: datumKurz(r.faellig_am), s: uebersetze('bezahlt') };
  if (r.ueberfaellig_tage > 0) {
    const n = r.ueberfaellig_tage;
    return { t: datumKurz(r.faellig_am), s: n === 1 ? uebersetze('überfällig seit 1 Tag') : fuelle('überfällig seit {n} Tagen', { n }), ton: 'ueber' };
  }
  const d = tageZwischen(ausIso(heuteTag()), ausIso(r.faellig_am));
  const s = d === 0 ? uebersetze('heute') : d > 0 ? (d === 1 ? uebersetze('in 1 Tag') : fuelle('in {n} Tagen', { n: d }))
    : (d === -1 ? uebersetze('seit 1 Tag') : fuelle('seit {n} Tagen', { n: -d }));
  return { t: datumKurz(r.faellig_am), s, ton: d === 0 ? 'heute' : '' };
}

function bezahltZelle(r) {
  if (r.status_abgeleitet === 'storno' || r.status_abgeleitet === 'storniert') return '<span class="faint">—</span>';
  const anteil = r.brutto_eur > 0 ? Math.min(1, r.gezahlt_eur / r.brutto_eur) : 0;
  const text = r.gezahlt_eur <= 0 ? uebersetze('noch nichts') : r.rest_eur > 0
    ? nf2.format(r.gezahlt_eur) + ' ' + uebersetze('von') + ' ' + nf2.format(r.brutto_eur) : uebersetze('vollständig');
  return '<span class="b-bezahlt"><span class="spur"><span style="width:' + (anteil * 100).toFixed(1) + '%" class="' + (r.rest_eur > 0 ? 'teil' : 'voll') + '"></span></span>' +
    '<span class="s ell">' + esc(text) + '</span></span>';
}

function rechnungZeile(r) {
  const auf = !!bz.auf[r.nr];
  const weg = r.status_abgeleitet === 'storniert' || r.status_abgeleitet === 'storno';
  const f = faelligText(r);
  const sub = r.storno_von ? uebersetze('Gegenrechnung zu') + ' ' + r.storno_von
    : r.leistung_von ? datum(r.leistung_von) + ' – ' + datum(r.leistung_bis) : '';
  const eintraege = [menueLink('/rechnung/' + encodeURIComponent(r.nr), 'Dokument ansehen', true),
    ...(r.hat_pdf ? [menueLink('/rechnung-pdf/' + encodeURIComponent(r.nr), 'PDF laden', true), menueKnopf('r-pdf', r.nr, 'PDF neu erzeugen')] : [menueKnopf('r-pdf', r.nr, 'PDF erzeugen')]),
    menueKnopf('r-xml', r.nr, 'XRechnung laden')];
  if (r.status === 'erstellt') eintraege.push(menueKnopf('r-storno-frage', r.nr, 'Stornieren …', true));
  return '<div class="b-eintrag' + (auf ? ' auf' : '') + (weg ? ' weg' : '') + '">' +
    '<div class="b-zeile" data-aktion="r-auf" data-wert="' + esc(r.nr) + '" aria-expanded="' + auf + '">' +
      '<span class="b-nr"><span class="pfeil" aria-hidden="true">' + (auf ? '▾' : '▸') + '</span><span class="mono strich">' + esc(r.nr) + '</span></span>' +
      '<span class="b-wer"><span class="t ell">' + esc(r.empfaenger || '—') + '</span><span class="s ell">' + esc(sub) + '</span></span>' +
      '<span class="mono dim">' + esc(datum(ortsTag(r.erstellt_am))) + '</span>' +
      '<span class="mono rechts strich">' + nf2.format(r.brutto_eur) + '</span>' +
      '<span class="b-faellig' + (f.ton ? ' ' + f.ton : '') + '"><span class="mono">' + esc(f.t) + '</span><span class="s">' + esc(f.s) + '</span></span>' +
      bezahltZelle(r) +
      '<span>' + pille(r.status_abgeleitet) + '</span>' +
      '<span class="b-aktion">' + (r.rest_eur > 0 ? '<button type="button" class="mini-aktion zahlung" data-aktion="r-zahlung" data-wert="' + esc(r.nr) + '">' + esc(uebersetze('Zahlung')) + '</button>' : '') +
        menue(r.nr, eintraege) + '</span>' +
    '</div>' +
    (frageIst('storno', r.nr) ? frageZeile(fuelle('Storno erzeugt eine Gegenrechnung über {b} mit der nächsten Nummer. Die Rechnung bleibt erhalten – gelöscht wird nie (§ 14 UStG).', { b: '−' + eur(r.brutto_eur) }),
      'r-storno', r.nr, 'Stornieren', true) : '') +
    (auf ? rechnungDetail(r) : '') +
  '</div>';
}

function ladeDetail(nr) {
  const e = bz.auf[nr] || (bz.auf[nr] = { d: null, fehler: null, lauf: 0 });
  const lauf = ++e.lauf;
  hole('/api/rechnung/' + encodeURIComponent(nr)).then((d) => {
    if (lauf !== e.lauf || bz.auf[nr] !== e) return;
    e.d = d; e.fehler = null;
  }, (err) => {
    if (lauf !== e.lauf || bz.auf[nr] !== e) return;
    if (e.d) toast(uebersetze('Rechnung nicht geladen') + ': ' + err.message, 'err'); else e.fehler = err.message;
  }).then(() => { if (route().name === 'rechnungen') zeichneAnsicht(); });
}
aktion('r-auf', (nr) => {
  if (bz.auf[nr]) delete bz.auf[nr]; else ladeDetail(nr);
  bz.menu = null;
  zeichneAnsicht();
});

function rechnungDetail(r) {
  const e = bz.auf[r.nr];
  if (!e.d) {
    return '<div class="b-detail">' + (e.fehler ? leer('beleg', 'Rechnung nicht geladen', e.fehler) : '<div class="leer">' + esc(uebersetze('Positionen laden …')) + '</div>') + '</div>';
  }
  const d = e.d;
  const pos = (d.positionen || []).map((p) => {
    const pauschal = p.typ === 'pauschal' || typeof p.stunden !== 'number';
    const menge = pauschal ? uebersetze('pauschal') : nf2.format(p.stunden) + ' h × ' + nf2.format(p.satz);
    return '<div class="b-pos"><span>' + esc(p.bezeichnung || (uebersetze('Vorgang') + ' ' + (p.ticket || ''))) + '</span><span class="mono rechts">' + nf2.format(p.betrag_eur) + '</span>' +
      '<span class="s mono">' + esc(menge) + '</span><span class="s rechts">' + esc(p.ticket || '') + '</span></div>';
  }).join('');
  const kannZahlen = d.status === 'erstellt' && d.rest_eur > 0;
  const zahlungen = (d.zahlungen || []).map((z) => '<div class="b-zahl"><span class="mono dim">' + esc(datum(z.datum)) + '</span><span class="s ell">' + esc(z.notiz || '') + '</span>' +
    '<span class="mono ok">' + nf2.format(z.betrag_eur) + '</span>' +
    '<button type="button" class="b-weg" data-aktion="r-zahlung-weg" data-wert="' + esc(JSON.stringify({ id: z.id, nr: r.nr })) + '" title="' + esc(uebersetze('Zahlung entfernen')) + '" aria-label="' + esc(uebersetze('Zahlung entfernen')) + '">×</button></div>').join('');
  const storno = (state.rechnungen || []).find((x) => x.storno_von === r.nr);
  const verlauf = [{ tag: ortsTag(d.erstellt_am), t: uebersetze('gestellt') + ' · ' + eur(d.brutto_eur), c: 'var(--text-dim)' }]
    .concat((d.zahlungen || []).map((z) => ({ tag: z.datum, t: uebersetze('Zahlung über') + ' ' + eur(z.betrag_eur), c: 'var(--ok)' })))
    .concat(storno ? [{ tag: ortsTag(storno.erstellt_am), t: uebersetze('storniert durch') + ' ' + storno.nr, c: 'var(--text-faint)' }] : [])
    .sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  return '<div class="b-detail">' +
    '<div class="b-spalte"><span class="label">' + esc(uebersetze('Positionen')) + '</span>' + pos +
      '<div class="b-fuss"><span>' + esc(uebersetze('netto')) + ' ' + nf2.format(d.netto_eur) + ' · ' + esc(uebersetze('USt')) + ' ' + nf2.format(d.ust_eur) + '</span>' +
      '<a class="textknopf akzent" href="/rechnung/' + encodeURIComponent(d.nr) + '" target="_blank" rel="noopener">' + esc(uebersetze('Dokument ansehen →')) + '</a></div></div>' +
    '<div class="b-spalte"><span class="label">' + esc(uebersetze('Zahlungen')) + '</span>' +
      (zahlungen || '<span class="hinweis">' + esc(uebersetze('Noch kein Zahlungseingang.')) + '</span>') +
      '<div class="b-fuss"><span class="mono ' + (d.rest_eur > 0 ? 'teil' : 'ok') + '">' +
        esc(d.status !== 'erstellt' ? uebersetze(STATUS_TEXT[d.status_abgeleitet] || d.status) : d.rest_eur > 0 ? uebersetze('Rest') + ' ' + eur(d.rest_eur) : uebersetze('ausgeglichen')) + '</span>' +
        (kannZahlen ? '<button type="button" class="textknopf akzent" data-aktion="r-zahlung" data-wert="' + esc(r.nr) + '">' + esc(uebersetze('+ Zahlung erfassen')) + '</button>' : '') + '</div></div>' +
    '<div class="b-spalte"><span class="label">' + esc(uebersetze('Verlauf')) + '</span><div class="b-verlauf">' +
      verlauf.map((v) => '<div><i style="background:' + v.c + '"></i><span class="mono s">' + esc(datumKurz(v.tag)) + '</span><span>' + esc(v.t) + '</span></div>').join('') + '</div></div>' +
  '</div>';
}

function zeichneRechnungen(w) {
  const suche = sucheVorher('r-suche');
  const L = state.rechnungen;
  const warte = belegeWarte(L, 'Belege laden …');
  if (warte) { w.innerHTML = warte; return; }
  const K = state.summary && state.summary.belege_kennzahlen;
  const mitRest = L.filter((r) => r.rest_eur > 0).length;
  // Karten mit Filter sind Knoepfe (Klick filtert die Tabelle), die anderen nur Anzeige.
  const kpi = (filter, label, wert, einheit, unter, ton) => {
    const tag = filter ? 'button' : 'div';
    return '<' + tag + (filter ? ' type="button" data-aktion="r-filter" data-wert="' + (bz.rf === filter ? 'alle' : filter) + '" aria-pressed="' + (bz.rf === filter) + '"' : '') +
      ' class="beleg-kpi' + (filter ? ' klickbar' : '') + (filter && bz.rf === filter ? ' an' : '') + '">' +
      '<span class="label">' + esc(uebersetze(label)) + '</span><span class="v' + (ton ? ' ' + ton : '') + '">' + wert + (einheit ? '<span class="u">' + esc(uebersetze(einheit)) + '</span>' : '') + '</span>' +
      '<span class="s">' + esc(unter) + '</span></' + tag + '>';
  };
  // Reihenfolge wie im Mockup: Offen, Ueberfaellig, Bezahlt, Zahlungsdauer; dazu Gestellt (R4).
  // Ueberfaellig ist ein Bestand wie Offen, gerechnet in rechnung.kennzahlen().
  const ueberfaellig = proAktiv() ? (K ? kpi('ueberfaellig', 'Überfällig', nf2.format(K.ueberfaellig_eur), 'EUR',
      K.ueberfaellig_anzahl ? num(K.ueberfaellig_anzahl) + ' ' + uebersetze(K.ueberfaellig_anzahl === 1 ? 'Rechnung überfällig' : 'Rechnungen überfällig') + ' · ' +
        (K.ueberfaellig_aeltester_tage === 1 ? uebersetze('älteste seit 1 Tag') : fuelle('älteste seit {n} Tagen', { n: K.ueberfaellig_aeltester_tage }))
        : uebersetze('nichts überfällig'), K.ueberfaellig_anzahl ? 'schlecht' : 'gut') : '') :
    '<div class="beleg-kpi gesperrt"><span class="label">' + esc(uebersetze('Überfällig')) + ' <span class="pille pro">Pro</span></span><span class="v faint">—</span>' +
    '<span class="s">' + esc(uebersetze('Fälligkeits-Ampel mit der Pro-Version')) + '</span></div>';
  const kpis = '<div class="beleg-kpis">' +
    (K ? kpi('offen', 'Offen gesamt', nf2.format(K.offen_eur), 'EUR', uebersetze('gestellt, abzüglich Zahlungen') + ' · ' + num(mitRest) + ' ' + uebersetze(mitRest === 1 ? 'Rechnung mit offenem Rest' : 'Rechnungen mit offenem Rest')) +
      ueberfaellig +
      kpi('bezahlt', 'Bezahlt im Zeitraum', nf2.format(K.bezahlt_eur), 'EUR', uebersetze('Zahlungseingänge nach Eingangstag')) +
      kpi(null, 'Ø Zahlungsdauer', K.zahlungsdauer_tage == null ? '–' : nf1.format(K.zahlungsdauer_tage), K.zahlungsdauer_tage == null ? '' : 'Tage',
        uebersetze(K.zahlungsdauer_tage == null ? 'noch keine bezahlte Rechnung im Zeitraum' : 'Rechnungsdatum bis letzte Zahlung')) +
      kpi(null, 'Gestellt im Zeitraum', nf2.format(K.gestellt_brutto), 'EUR', num(K.gestellt_anzahl) + ' ' + uebersetze(K.gestellt_anzahl === 1 ? 'Rechnung' : 'Rechnungen') + ' · ' + num(K.storniert_anzahl) + ' ' + uebersetze('storniert'))
      : '<div class="leer">…</div>' + ueberfaellig) +
  '</div>';

  const q = bz.rq.trim().toLowerCase();
  const passt = R_PASST[bz.rf];
  const { k, dir } = bz.rsort;
  const schluessel = { datum: (r) => r.erstellt_am, brutto: (r) => r.brutto_eur, faellig: (r) => r.faellig_am || '' }[k];
  const zeilen = L.filter(passt)
    .filter((r) => !q || (r.nr + ' ' + (r.empfaenger || '') + ' ' + (r.leistung_von || '') + ' ' + (r.storno_von || '')).toLowerCase().includes(q))
    .sort((a, b) => { const x = schluessel(a), y = schluessel(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || (a.nr < b.nr ? 1 : -1); });
  const sortKnopf = (key, text, titel, rechts) => '<button type="button" class="th-knopf' + (rechts ? ' rechts' : '') + '" data-aktion="r-sort" data-wert="' + key + '" title="' + esc(uebersetze(titel)) + '"' +
    ' aria-sort="' + (k === key ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + esc(uebersetze(text)) + (k === key ? (dir > 0 ? ' ↑' : ' ↓') : '') + '</button>';
  const summe = zeilen.filter((r) => r.status === 'erstellt').reduce((s, r) => s + r.brutto_eur, 0);

  const tabelle = !L.length ? leer('beleg', 'Noch keine Rechnung gestellt')
    : !zeilen.length ? leer('beleg', 'Keine Rechnung passt zu Filter oder Suche')
    : '<div class="b-huelle"><div class="b-tabelle rech" role="table">' +
      '<div class="b-kopf" role="row"><span>' + esc(uebersetze('Nummer')) + '</span><span>' + esc(uebersetze('Kunde · Leistung')) + '</span>' +
        sortKnopf('datum', 'Datum', 'Nach Datum sortieren') + sortKnopf('brutto', 'Brutto €', 'Nach Betrag sortieren', true) + sortKnopf('faellig', 'Fällig', 'Nach Fälligkeit sortieren') +
        '<span>' + esc(uebersetze('Bezahlt')) + '</span><span>' + esc(uebersetze('Status')) + '</span><span class="rechts">' + esc(uebersetze('Aktion')) + '</span></div>' +
      zeilen.map(rechnungZeile).join('') + '</div></div>' +
      '<div class="b-summe hinweis">' + num(zeilen.length) + ' ' + esc(uebersetze(zeilen.length === 1 ? 'Rechnung im Filter' : 'Rechnungen im Filter')) + ' · ' + eur(summe) + ' ' + esc(uebersetze('brutto')) + '</div>';

  w.innerHTML = '<div class="beleg-seite">' + kpis + abrechenbareAngebote() +
    '<div class="karte weit"><div class="beleg-leiste">' +
      chips('r-filter', R_FILTER, bz.rf, (f) => L.filter(R_PASST[f]).length) +
      '<span class="luecke"></span>' + ansichtWahl('rechnungen') +
      suchFeld('r-suche', bz.rq, 'Suchen: Nummer, Kunde, Leistung') + neuKnopf('+ Rechnung', 'rechnung') +
      (state.fehler.belege ? '<span class="hinweis warn">' + esc(uebersetze('Belege nicht aktualisiert')) + '</span>' : '') +
    '</div>' +
    (bz.ansicht.rechnungen === 'kanban' && !proAktiv() ? kanbanSperre() : tabelle) +
    '</div>' +
    (proAktiv() ? '' : '<div class="karte eingelassen sperre-huelle">' + sperre('Mahnen, Versand und Kontoauszug', 'Zahlungserinnerung und Mahnung, Versand per E-Mail, Zahlungen aus dem Kontoauszug zuordnen — mit der Pro-Version.') + '</div>') +
  '</div>';
  verdrahteSuche(w, 'r-suche', (v) => { bz.rq = v; }, suche);
}

// Suche: Eingabe filtert sofort. Fokus und Cursor bleiben auch, wenn das
// Nachladen im Hintergrund (60/120 s) neu zeichnet; waehrend einer IME-
// Eingabe wird nicht neu gezeichnet. `vorher` kommt aus sucheVorher().
const sucheVorher = (id) => { const a = document.activeElement; return a && a.id === id ? [a.selectionStart, a.selectionEnd] : null; };
function verdrahteSuche(w, id, setze, vorher) {
  const feld = w.querySelector('#' + id);
  if (!feld) return;
  if (vorher) { feld.focus(); try { feld.setSelectionRange(vorher[0], vorher[1]); } catch { /* ohne Auswahl */ } }
  const tu = (e) => { if (e.isComposing) return; setze(feld.value); zeichneAnsicht(); };
  feld.addEventListener('input', tu);
  feld.addEventListener('compositionend', tu);
}

aktion('r-filter', (f) => { if (!R_PASST[f]) return; bz.rf = f; merke('rechnungen.filter', f); zeichneAnsicht(); });
aktion('r-sort', (key) => {
  if (!R_SORT.includes(key)) return;
  bz.rsort = { k: key, dir: bz.rsort.k === key ? -bz.rsort.dir : (key === 'faellig' ? 1 : -1) };
  merke('rechnungen.sort', bz.rsort);
  zeichneAnsicht();
});
aktion('r-storno-frage', (nr) => frageAuf('storno', nr));
aktion('r-storno', (nr, el) => mitLauf(el, async () => {
  let r;
  try { r = await sende('/api/rechnung-storno', { nr }); }
  catch (e) { toast(uebersetze('Storno fehlgeschlagen') + ': ' + e.message, 'err'); return; }
  bz.frage = null;
  toast(uebersetze('Storno erzeugt') + ': ' + r.nr, 'ok');
  await belegeNeu(nr);
}));
aktion('r-pdf', (nr, el) => mitLauf(el, async () => {
  menueZu();
  try { await sende('/api/rechnung-pdf', { nr }); }
  catch (e) { toast(uebersetze('PDF fehlgeschlagen') + ': ' + e.message, 'err'); return; }
  toast(uebersetze('PDF erzeugt') + ': ' + nr, 'ok', { text: uebersetze('Öffnen'), tu: () => window.open('/rechnung-pdf/' + encodeURIComponent(nr), '_blank', 'noopener') });
  await belegeNeu();
}));
aktion('r-xml', (nr, el) => mitLauf(el, async () => {
  menueZu();
  let r;
  try { r = await fetch('/rechnung-xml/' + encodeURIComponent(nr)); }
  catch (e) { toast(uebersetze('XRechnung fehlgeschlagen') + ': ' + e.message, 'err'); return; }
  if (r.ok) {
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = 'Rechnung-' + nr + '.xml';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    zeichneAnsicht();
    return;
  }
  let text = 'HTTP ' + r.status;
  try { text = (await r.json()).error || text; } catch { /* kein JSON */ }
  if (r.status !== 422) { toast(uebersetze('XRechnung fehlgeschlagen') + ': ' + text, 'err'); return; }
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('E-Rechnung noch nicht vollständig')) + '</h2><span class="hinweis mono">' + esc(nr) + '</span></div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<p class="dialog-text">' + esc(uebersetze('Diese Angaben fehlen für die E-Rechnung. Ergänze sie im Kontakt oder in den Stammdaten und lade die Datei dann erneut.')) + '</p>' +
    '<p class="dialog-fehler">' + esc(text) + '</p>' +
    '<div class="dialog-fuss"><a class="knopf" href="#/kontakte" data-aktion="dialog-zu">' + esc(uebersetze('Kontakte öffnen')) + '</a>' +
      '<a class="knopf" href="#/einstellungen" data-aktion="dialog-zu">' + esc(uebersetze('Stammdaten öffnen')) + '</a>' +
      '<button type="button" class="knopf primaer" data-aktion="dialog-zu">' + esc(uebersetze('Schließen')) + '</button></div>',
  'E-Rechnung noch nicht vollständig', 480);
}));

/* ---------- Zahlung erfassen ---------- */

function zahlungDialog(nr) {
  const r = (state.rechnungen || []).find((x) => x.nr === nr);
  if (!r || r.rest_eur <= 0) return;
  const min = ortsTag(r.erstellt_am), max = heuteTag();
  const box = (l, v, k) => '<div class="mini-wert"><span>' + esc(uebersetze(l)) + '</span><span class="mono ' + k + '">' + nf2.format(v) + '</span></div>';
  const grund = dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Zahlung erfassen')) + '</h2><span class="hinweis">' + esc(nr + ' · ' + (r.empfaenger || '')) + '</span></div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<div class="mini-werte">' + box('Brutto', r.brutto_eur, '') + box('bisher bezahlt', r.gezahlt_eur, 'ok') + box('offen', r.rest_eur, 'teil') + '</div>' +
    '<div class="felder-2"><label class="feld"><span class="label">' + esc(uebersetze('Betrag €')) + '</span>' +
        '<input id="z-betrag" class="eingabe-zahl" inputmode="decimal" autocomplete="off" autofocus value="' + esc(nf2.format(r.rest_eur)) + '"></label>' +
      '<label class="feld"><span class="label">' + esc(uebersetze('Eingang am')) + '</span><input id="z-datum" type="date" value="' + max + '" min="' + min + '" max="' + max + '"></label></div>' +
    '<div class="schnell"><button type="button" class="chip" data-aktion="z-schnell" data-wert="' + r.rest_eur + '">' + esc(uebersetze('Rest')) + ' ' + nf2.format(r.rest_eur) + '</button>' +
      '<button type="button" class="chip" data-aktion="z-schnell" data-wert="' + Math.round(r.rest_eur * 50) / 100 + '">' + esc(uebersetze('Hälfte')) + '</button></div>' +
    '<input id="z-notiz" maxlength="200" placeholder="' + esc(uebersetze('Notiz, z. B. Abschlag oder Verwendungszweck')) + '" aria-label="' + esc(uebersetze('Notiz, z. B. Abschlag oder Verwendungszweck')) + '">' +
    '<span class="mono danach" id="z-danach"></span><span class="dialog-fehler" id="z-fehler" role="alert"></span>' +
    '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
      '<button type="button" class="knopf primaer" id="z-buchen" data-aktion="z-buchen" data-wert="' + esc(nr) + '">' + esc(uebersetze('Zahlung buchen')) + '</button></div>',
  'Zahlung erfassen', 440);
  const danach = () => {
    const b = betragAus(grund.querySelector('#z-betrag').value);
    const el = grund.querySelector('#z-danach');
    const rest = Math.round((r.rest_eur - b) * 100) / 100;
    if (!Number.isFinite(b) || b <= 0) { el.textContent = uebersetze('Keine gültige Zahl'); el.className = 'mono danach bad'; return false; }
    if (rest < -0.01) { el.textContent = uebersetze('Mehr als der offene Rest'); el.className = 'mono danach bad'; return false; }
    el.textContent = rest <= 0.01 ? uebersetze('Danach bezahlt') + ' · ' + eur(b) : uebersetze('Danach offen') + ': ' + eur(rest) + ' · ' + uebersetze('Zahlung') + ' ' + eur(b);
    el.className = 'mono danach ' + (rest <= 0.01 ? 'ok' : 'teil');
    return true;
  };
  grund.addEventListener('input', danach);
  grund.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); grund.querySelector('#z-buchen').click(); } });
  danach();
}
aktion('r-zahlung', (nr) => { bz.menu = null; zahlungDialog(nr); });
aktion('z-schnell', (wert) => {
  const feld = document.getElementById('z-betrag');
  if (!feld) return;
  feld.value = nf2.format(Number(wert));
  feld.dispatchEvent(new Event('input', { bubbles: true }));
  feld.focus();
});
aktion('z-buchen', (nr, el) => mitLauf(el, async () => {
  const g = document.getElementById('dialog');
  if (!g) return;
  const fehler = g.querySelector('#z-fehler');
  const betrag = betragAus(g.querySelector('#z-betrag').value);
  if (!Number.isFinite(betrag) || betrag <= 0) { fehler.textContent = uebersetze('Keine gültige Zahl'); return; }
  let antwort;
  try {
    antwort = await sende('/api/zahlung', { nr, betrag_eur: betrag, datum: g.querySelector('#z-datum').value, notiz: g.querySelector('#z-notiz').value });
  } catch (e) {
    // Antwort verloren (Netz, Zeitlimit): die Zahlung kann trotzdem gebucht
    // sein. Liste neu holen und das sagen — ein zweiter Klick buchte doppelt.
    if (e.name === 'TypeError' || e.name === 'TimeoutError' || e.name === 'AbortError') {
      fehler.textContent = uebersetze('Keine Antwort vom Server — die Zahlung ist vielleicht gebucht. Bitte die Zeile prüfen, bevor du erneut buchst.');
      await belegeNeu(nr);
      return;
    }
    // Sonst bleibt der Dialog offen, die Eingaben auch — der Server sagt, was nicht passt.
    fehler.textContent = uebersetze('Zahlung nicht gebucht') + ': ' + e.message;
    return;
  }
  schliesseDialog();
  const id = antwort.zahlung.id;
  toast(uebersetze('Zahlung gebucht') + ': ' + eur(antwort.zahlung.betrag_eur) + ' · ' + nr, 'ok', { text: uebersetze('Rückgängig'), tu: () => zahlungWeg(id, nr) });
  await belegeNeu(nr);
}));
async function zahlungWeg(id, nr) {
  try {
    await sende('/api/zahlung-loeschen', { id });
    toast(uebersetze('Zahlung entfernt'), 'ok');
  } catch (e) { toast(uebersetze('Zahlung nicht entfernt') + ': ' + e.message, 'err'); }
  await belegeNeu(nr);
}
aktion('r-zahlung-weg', (wert, el) => {
  let w;
  try { w = JSON.parse(wert); } catch { return; }
  if (!Number.isInteger(w.id)) return;
  return mitLauf(el, () => zahlungWeg(w.id, w.nr));
});

/* ---------- Angebote ---------- */

function gueltigText(a) {
  if (a.status_abgeleitet === 'abgerechnet') return { t: '→ ' + a.rechnung_nr, s: '', warn: false, link: true };
  if (a.status_abgeleitet === 'abgelaufen') return { t: datumKurz(ortsTag(a.gueltig_bis)), s: uebersetze('abgelaufen'), warn: true };
  if (a.status_abgeleitet !== 'offen') return { t: datumKurz(ortsTag(a.gueltig_bis)), s: '' };
  const d = tageZwischen(ausIso(heuteTag()), ausIso(ortsTag(a.gueltig_bis)));
  return { t: datumKurz(ortsTag(a.gueltig_bis)), s: d <= 0 ? uebersetze('läuft heute ab') : d === 1 ? uebersetze('noch 1 Tag') : fuelle('noch {n} Tage', { n: d }), warn: d <= 7 };
}

function angebotZeile(a) {
  const kontakt = a.kontakt_id && (state.kontakte || []).find((k) => k.id === a.kontakt_id);
  const g = gueltigText(a);
  const st = a.status_abgeleitet;
  const eintraege = [menueLink('/angebot/' + encodeURIComponent(a.nr), 'Ansehen', true)];
  // Abgelaufen ist abgeleitet, nicht gesetzt: eine spaete Zusage laesst sich trotzdem erfassen (R17).
  if (st === 'offen' || st === 'abgelaufen') eintraege.push(menueKnopf('a-status', a.nr + ':angenommen', 'Annehmen'), menueKnopf('a-status', a.nr + ':abgelehnt', 'Ablehnen'));
  if (st === 'angenommen') eintraege.push(menueKnopf('a-status', a.nr + ':offen', 'Wieder öffnen'), menueKnopf('a-status', a.nr + ':abgelehnt', 'Ablehnen'));
  if (st === 'abgelehnt') eintraege.push(menueKnopf('a-status', a.nr + ':offen', 'Wieder öffnen'));
  // Wie in der bisherigen Ansicht: abrechnen geht aus jedem Stand, der Server setzt dabei "angenommen".
  if (!a.rechnung_nr && st !== 'angenommen') eintraege.push(menueKnopf('a-rechnung-frage', a.nr, 'In Rechnung …'));
  if (!a.rechnung_nr) eintraege.push(menueKnopf('a-loeschen-frage', a.nr, 'Löschen …', true));
  return '<div class="b-eintrag">' +
    '<div class="b-zeile ohne-klick">' +
      '<span class="b-nr"><span class="mono">' + esc(a.nr) + '</span></span>' +
      '<span class="b-wer"><span class="t ell">' + esc(a.empfaenger || '—') + (kontakt && kontakt.status === 'lead' ? ' ' + pille('lead') : '') + '</span></span>' +
      '<span class="mono dim">' + esc(datum(ortsTag(a.erstellt_am))) + '</span>' +
      '<span class="b-faellig"><span class="mono">' + (g.link ? '<a href="#/rechnungen" class="akzent">' + esc(g.t) + '</a>' : esc(g.t)) + '</span>' +
        '<span class="s' + (g.warn ? ' warn' : '') + '">' + esc(g.s) + '</span></span>' +
      '<span class="mono rechts">' + nf2.format(a.brutto_eur) + '</span>' +
      '<span>' + pille(st) + '</span>' +
      '<span class="b-aktion">' + (st === 'angenommen' ? '<button type="button" class="mini-aktion akzent" data-aktion="a-rechnung-frage" data-wert="' + esc(a.nr) + '">' + esc(uebersetze('In Rechnung →')) + '</button>' : '') +
        menue(a.nr, eintraege) + '</span>' +
    '</div>' +
    (frageIst('rechnung', a.nr) ? frageZeile(fuelle('Erzeugt eine Rechnung über {b} mit der nächsten Nummer. Das Angebot bleibt, wie es ist.', { b: eur(a.brutto_eur) }), 'a-rechnung', a.nr, 'Rechnung erstellen') : '') +
    (frageIst('loeschen', a.nr) ? frageZeile(uebersetze('Das Angebot wird gelöscht. Angebote sind kein Steuerdokument; die Nummer bleibt frei.'), 'a-loeschen', a.nr, 'Löschen', true) : '') +
  '</div>';
}

function zeichneAngebote(w) {
  const suche = sucheVorher('a-suche');
  const L = state.angebote;
  const warte = belegeWarte(L, 'Belege laden …');
  if (warte) { w.innerHTML = warte; return; }
  const kunden = [...new Set(L.map((a) => a.empfaenger).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'de'));
  if (bz.akunde && !kunden.includes(bz.akunde)) bz.akunde = '';
  const q = bz.aq.trim().toLowerCase();
  const vorFilter = L.filter((a) => (!bz.akunde || a.empfaenger === bz.akunde) && (!q || (a.nr + ' ' + (a.empfaenger || '')).toLowerCase().includes(q)));
  const zeilen = vorFilter.filter(A_PASST[bz.af]);
  const summe = zeilen.reduce((s, a) => s + a.brutto_eur, 0);
  const tabelle = !L.length ? leer('beleg', 'Noch kein Angebot')
    : !zeilen.length ? leer('beleg', 'Kein Angebot passt zu Filter oder Suche')
    : '<div class="b-huelle"><div class="b-tabelle ang" role="table">' +
      '<div class="b-kopf" role="row">' + ['Nummer', 'Kunde', 'Erstellt', 'Gültig bis'].map((t) => '<span>' + esc(uebersetze(t)) + '</span>').join('') +
        '<span class="rechts">' + esc(uebersetze('Brutto €')) + '</span><span>' + esc(uebersetze('Status')) + '</span><span class="rechts">' + esc(uebersetze('Aktion')) + '</span></div>' +
      zeilen.map(angebotZeile).join('') + '</div></div>' +
      '<div class="b-summe hinweis">' + num(zeilen.length) + ' ' + esc(uebersetze(zeilen.length === 1 ? 'Angebot im Filter' : 'Angebote im Filter')) + ' · ' + eur(summe) + ' ' + esc(uebersetze('brutto')) + '</div>';
  w.innerHTML = '<div class="beleg-seite"><div class="karte weit"><div class="beleg-leiste">' +
      chips('a-filter', A_FILTER, bz.af, (f) => vorFilter.filter(A_PASST[f]).length) +
      '<span class="luecke"></span>' + ansichtWahl('angebote') +
      '<select class="suche-feld schmal" id="a-kunde" aria-label="' + esc(uebersetze('Kunde')) + '"><option value="">' + esc(uebersetze('Alle Kunden')) + '</option>' +
        kunden.map((k) => '<option value="' + esc(k) + '"' + (k === bz.akunde ? ' selected' : '') + '>' + esc(k) + '</option>').join('') + '</select>' +
      suchFeld('a-suche', bz.aq, 'Suchen: Nummer, Kunde') + neuKnopf('+ Angebot', 'angebot') +
      (state.fehler.belege ? '<span class="hinweis warn">' + esc(uebersetze('Belege nicht aktualisiert')) + '</span>' : '') +
    '</div>' +
    (bz.ansicht.angebote === 'kanban' && !proAktiv() ? kanbanSperre() : tabelle) +
  '</div></div>';
  verdrahteSuche(w, 'a-suche', (v) => { bz.aq = v; }, suche);
  const sel = w.querySelector('#a-kunde');
  if (sel) sel.addEventListener('change', () => { bz.akunde = sel.value; zeichneAnsicht(); });
}

aktion('a-filter', (f) => { if (!A_PASST[f]) return; bz.af = f; merke('angebote.filter', f); zeichneAnsicht(); });
aktion('a-status', (wert, el) => {
  const [nr, status] = String(wert).split(':');
  const a = (state.angebote || []).find((x) => x.nr === nr);
  if (!a || !['offen', 'angenommen', 'abgelehnt'].includes(status)) return;
  // Zurueck auf den gespeicherten Stand: "abgelaufen" ist abgeleitet und nicht setzbar (R17).
  const vorher = a.status === 'abgelaufen' ? 'offen' : a.status;
  bz.menu = null;
  return mitLauf(el, async () => {
    try { await sende('/api/angebot-status', { nr, status }); }
    catch (e) { toast(uebersetze('Status nicht geändert') + ': ' + e.message, 'err'); zeichneAnsicht(); return; }
    // Annehmen macht den Lead zum Kunden (Server). Das liesse sich nicht
    // zuruecknehmen — deshalb gibt es dort kein "Rueckgaengig".
    toast(uebersetze('Status geändert') + ': ' + nr + ' · ' + uebersetze(STATUS_TEXT[status]), 'ok', status === 'angenommen' ? undefined : {
      text: uebersetze('Rückgängig'),
      tu: async () => {
        try { await sende('/api/angebot-status', { nr, status: vorher }); }
        catch (e) { toast(uebersetze('Status nicht geändert') + ': ' + e.message, 'err'); }
        await belegeNeu();
      },
    });
    await belegeNeu();
  });
});
aktion('a-rechnung-frage', (nr) => frageAuf('rechnung', nr));
aktion('a-rechnung', (nr, el) => mitLauf(el, async () => {
  let r;
  try { r = await sende('/api/angebot-rechnung', { nr }); }
  catch (e) { toast(uebersetze('Rechnung nicht erstellt') + ': ' + e.message, 'err'); await belegeNeu(); return; }
  bz.frage = null;
  toast(uebersetze('Rechnung erstellt') + ': ' + r.nr + ' · ' + eur(r.brutto_eur), 'ok', { text: uebersetze('Öffnen'), tu: () => geheZu('rechnungen') });
  await belegeNeu();
}));
aktion('a-loeschen-frage', (nr) => frageAuf('loeschen', nr));
aktion('a-loeschen', (nr, el) => mitLauf(el, async () => {
  try { await sende('/api/angebot-loeschen', { nr }); }
  catch (e) { toast(uebersetze('Löschen fehlgeschlagen') + ': ' + e.message, 'err'); return; }
  bz.frage = null;
  toast(uebersetze('Angebot gelöscht') + ': ' + nr, 'ok');
  await belegeNeu();
}));

registriere('rechnungen', { zeichne: zeichneRechnungen });
registriere('angebote', { zeichne: zeichneAngebote });
