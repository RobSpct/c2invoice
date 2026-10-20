'use strict';
/* Beleg-Editor (Block 4b): Rechnung oder Angebot mit Vorschau wie im PDF.
   Route #/beleg/neu?art=rechnung&tickets=A,B&from=…&to=…&quelle=vorgaenge
   oder #/beleg/entwurf?id=…

   Gerechnet wird hier nichts. Summen und Betraege je Position kommen aus
   /api/beleg-vorschau — derselben Funktion, die das Dokument druckt (R6).
   Erstellt wird erst, wenn die Vorschau zum aktuellen Stand passt: was
   gestellt wird, ist das, was zu sehen war.
   Entwuerfe liegen im Browser (R5, kern.entwuerfeAus) und sehen nie wie
   eine Rechnung aus: eigene Liste, keine Tabellenzeile. */

Object.assign(EN, {
  'ohne Kunde': 'no customer', 'angeschnitten': 'cut off',
  '{liste} steht schon auf einer Rechnung. Nur dazunehmen, wenn im Leistungszeitraum neue Arbeit liegt — sonst wird sie doppelt berechnet.': '{liste} is already on an invoice. Only add it if there is new work in the service period — otherwise it is billed twice.', 'Empfänger vorgeschlagen': 'Recipient suggested',
  'Das Projekt ist keinem Kunden zugeordnet — unter Kontakte → Projekte & Sätze nachtragen.': 'The project is not assigned to a customer — add it under Contacts → Projects & rates.',
  'Die Arbeit beginnt am oder vor dem Starttag — frühere Anteile sind nicht enthalten.': 'Work starts on or before the first day — earlier parts are not included.',
  'Ohne Kundenzuordnung: {liste}. Diese Arbeit lässt sich abrechnen, folgt aber keiner Kundenauswahl — unter Kontakte → Projekte & Sätze das Projekt beim Kunden eintragen.': 'No customer assigned: {liste}. This work can be invoiced but follows no customer selection — assign the project to the customer under Contacts → Projects & rates.',
  'Bei {liste} beginnt die Arbeit am oder vor dem {tag}. Enthalten ist nur der Anteil ab diesem Tag — Leistungszeitraum weiter zurücklegen, wenn frühere Arbeit mit abgerechnet werden soll.': 'For {liste}, work starts on or before {tag}. Only the part from that day is included — move the service period back if earlier work should be invoiced too.',
  'Neue Rechnung': 'New invoice', 'Neues Angebot': 'New quote', 'Belegart': 'Document type',
  'Kontakt nicht vorbelegt — bitte im Formular wählen': 'Contact not prefilled — please pick it in the form',
  'Nummer beim Erstellen': 'Number on creation', 'ENTWURF': 'DRAFT',
  'Formular': 'Form', 'Vorschau': 'Preview', 'Ansicht im Editor': 'Editor view',
  'Entwurf verwerfen': 'Discard draft', 'Schließen ×': 'Close ×', 'Esc schließt, der Entwurf bleibt': 'Esc closes, the draft stays', 'Entwurf gespeichert': 'Draft saved', 'noch nicht gespeichert': 'not saved yet',
  'Kontakt': 'Contact', '— frei eingeben —': '— enter manually —', 'Empfänger': 'Recipient', 'Name oder Firma': 'Name or company',
  'Anschrift': 'Address', 'Straße Nr.\nPLZ Ort': 'Street no.\nPostcode city', 'Datum': 'Date', 'heute, beim Erstellen gesetzt': 'today, set on creation',
  'Zahlungsziel': 'Payment term', 'Gültig': 'Valid for', 'Tage': 'days', 'Standard': 'Default',
  'fällig am': 'due on', 'gültig bis': 'valid until',
  'Leistungszeitraum': 'Service period', 'Zeitraum der Vorgänge': 'Period of the jobs', 'von': 'from', 'bis': 'to',
  'Bestellnummer (optional)': 'Purchase order no. (optional)',
  'Positionen': 'Line items', '+ hinzufügen aus': '+ add from', 'Vorgänge': 'Jobs', 'Vorlage': 'Template', 'Freie Position': 'Free item', 'Pauschale': 'Flat fee',
  'Leistung': 'Service', 'Std.': 'Hrs', 'Preis €': 'Price €', 'Rab. %': 'Disc. %', 'Betrag': 'Amount', 'Beschreibung': 'Description',
  'Position entfernen': 'Remove item', 'pauschal': 'flat', 'Vorgang': 'Job', 'ohne Vorgang': 'without job', 'aus der Auswertung': 'from tracked time',
  'Stunden': 'Hours', 'Stundensatz': 'Hourly rate', 'Festpreis': 'Fixed price', 'Rabatt in Prozent': 'Discount in percent',
  'Noch keine Position. Wähle unten eine Quelle — Vorgänge übernehmen Zeit und Satz aus der Auswertung.': 'No line item yet. Pick a source below — jobs take time and rate from tracked data.',
  'Vorgänge im Leistungszeitraum': 'Jobs in the service period', 'Zeit und Satz aus der Auswertung, Rabatt aus dem Projekt': 'Time and rate from tracked data, discount from the project',
  'Positionsvorlagen': 'Line item templates', 'Gepflegt in den Einstellungen': 'Maintained in settings',
  'übernommen': 'added', 'abgerechnet in': 'invoiced in', 'Nichts im Zeitraum.': 'Nothing in this period.', 'Noch keine Vorlage.': 'No template yet.',
  'Schließen': 'Close', 'übernehmen': 'add', 'Auswählen': 'Select', 'lädt …': 'loading …', 'Nicht geladen': 'Not loaded',
  'Vorschau · wie im PDF': 'Preview · as in the PDF', 'Zoom': 'Zoom', 'aktualisiert …': 'updating …', 'aktuell': 'up to date',
  'Vorschau des Belegs': 'Document preview',
  'Vorschau erscheint, sobald ein Empfänger eingetragen ist.': 'The preview appears once a recipient is entered.',
  'Vorschau erscheint mit der ersten Position.': 'The preview appears with the first line item.',
  'Leistungszeitraum fehlt.': 'Service period missing.',
  'Stammdaten unvollständig — sie stehen auf jedem Beleg:': 'Company details incomplete — they appear on every document:',
  'Einstellungen öffnen': 'Open settings',
  'Empfänger fehlt': 'Recipient missing', 'Anschrift des Empfängers fehlt (Pflichtangabe nach § 14 UStG)': 'Recipient address missing (required by § 14 UStG)',
  'Mindestens eine Position': 'At least one line item', 'Leistungszeitraum fehlt oder endet vor dem Beginn': 'Service period missing or ends before it starts',
  'Eine Position hat keine Beschreibung': 'A line item has no description', 'Menge, Preis oder Rabatt ist keine Zahl': 'Quantity, price or discount is not a number',
  'Frist: ganze Tage': 'Term: whole days', 'Vorschau wartet, bis jede Position eine Beschreibung und gültige Zahlen hat.': 'The preview waits until every line item has a description and valid numbers.', 'Vorschau wird aktualisiert': 'Preview is updating',
  'Marge im Zeitraum — nach Sachkosten und eigener Zeit': 'Margin in period — after material costs and own time',
  'Kennzahl des gewählten Zeitraums aller Vorgänge, nicht dieses Belegs': 'Figure for the selected period across all jobs, not this document',
  'Ziel': 'Target', 'kein Ziel': 'no target', 'Marge —': 'Margin —',
  'Netto': 'Net', 'USt': 'VAT', '§ 19 UStG': '§ 19 UStG', 'Brutto': 'Gross',
  'Rechnung erstellen': 'Create invoice', 'Angebot erstellen': 'Create quote', 'Erstellen & senden': 'Create & send',
  'E-Mail-Versand kommt mit der Pro-Version.': 'Sending by e-mail comes with Pro.',
  'Trotzdem erneut erstellen': 'Create again anyway', 'Entwurf nicht gespeichert — Browser-Speicher voll oder gesperrt': 'Draft not saved — browser storage full or blocked', 'Server nicht erreichbar — Vorschau nicht aktualisiert.': 'Server not reachable — preview not updated.', 'Erneut versuchen': 'Try again',
  'Keine Antwort vom Server — der Beleg ist vielleicht erstellt. Bitte die Liste prüfen, bevor du erneut erstellst.': 'No response from the server — the document may have been created. Please check the list before creating it again.',
  'Nicht erstellt': 'Not created', 'Rechnung erstellt': 'Invoice created', 'Angebot erstellt': 'Quote created',
  'Als E-Rechnung noch nicht exportierbar, es fehlen:': 'Not yet exportable as e-invoice, missing:',
  'Entwurf vom': 'Draft from', 'fortsetzen?': 'continue?', 'Fortsetzen': 'Continue', 'Verwerfen': 'Discard',
  'Entwurf nicht gefunden': 'Draft not found', 'Entwurf verworfen': 'Draft discarded', 'Rückgängig': 'Undo',
  'Entwürfe': 'Drafts', 'Öffnen': 'Open', 'Löschen': 'Delete', 'Keine Entwürfe': 'No drafts', 'Rechnung': 'Invoice', 'Angebot': 'Quote',
  'Entwürfe liegen nur in diesem Browser und sind keine Belege.': 'Drafts live only in this browser and are not documents.',
  'Projekte ohne Vorgang gibt es nur auf Rechnungen — entfernt:': 'Projects without a job exist only on invoices — removed:',
  'Beleg-Editor': 'Document editor', 'Aus Vorgängen': 'From jobs', 'ohne Empfänger': 'without recipient', 'Position': 'item', 'Positionen ': 'items ',
  'Kulanz 0 €': 'Goodwill €0', 'nicht berechnet': 'not charged', 'aus der Zeiterfassung': 'from time tracking',
  'Offene, abrechenbare Einträge aus der Zeiterfassung': 'Open, billable entries from time tracking', 'Erst Empfänger wählen.': 'Choose a recipient first.',
  'je Eintrag': 'per entry', 'je Tätigkeit': 'per activity', 'Gruppierung': 'Grouping', 'Nichts Offenes für {name}.': 'Nothing open for {name}.', 'diesen Kontakt': 'this contact',
  'Leistungszeitraum oben erweitern, um ihn abzurechnen.': 'Extend the service period above to invoice it.', 'außerhalb des Leistungszeitraums': 'outside the service period',
  'Manuelle Zeit gibt es nur auf Rechnungen — entfernt:': 'Manual time exists only on invoices — removed:',
  'Antwort ohne Einträge': 'Response without entries', 'Manuelle Zeit des vorigen Empfängers entfernt:': 'Manual time of the previous recipient removed:', '{n} offene ohne Kunden-Zuordnung': '{n} open without customer',
  'Projekt unter Kontakte → Projekte & Sätze einem Kunden zuordnen oder den Eintrag auf einen Kunden buchen.': 'Assign the project to a customer under Contacts → Projects & rates, or book the entry to a customer.',
});

const ED_ZOOM = [['0.7', '70 %'], ['0.9', '90 %'], ['1.15', '115 %']];
// Ein A4-Blatt in CSS-Pixeln (96 dpi). Die Zoomstufen beziehen sich wie im
// Mockup auf 595 px Breite (A4 in Punkt).
const A4 = { w: 794, h: 1123 };
const IST_TAG = /^\d{4}-\d{2}-\d{2}$/;
const VERLOREN = ['TypeError', 'TimeoutError', 'AbortError'];

const ed = {
  schluessel: null,      // location.hash, fuer das der Editor aufgebaut ist
  id: null,              // Entwurf-Id, sobald gespeichert
  b: null,               // der Beleg in Arbeit (Rohtexte, wie eingegeben)
  stand: 0,              // zaehlt jede Aenderung
  gespeichert: null,     // Zeitpunkt des letzten Entwurf-Speicherns
  vorschau: { lauf: 0, stand: -1, d: null, fehler: null, fehlt: null, laedt: false },
  quelle: null,          // offene Schublade: 'vorgaenge' | 'vorlagen'
  auswahl: new Set(),
  quellDaten: { schluessel: null, d: null, fehler: null },
  vorlagen: null,
  reiter: 'formular',
  zoom: '0.9',
  meldung: '',
  verloren: false,
  angebotEntwurf: null,  // Entwurf, der beim Oeffnen zum Fortsetzen angeboten wird
};
{
  // Ohne gemerkte Wahl: auf breiten Bildschirmen groesser (K1).
  const z = lies('editor.zoom', window.innerWidth >= 1600 ? '1.15' : '0.9');
  ed.zoom = ED_ZOOM.some(([w]) => w === z) ? z : '0.9';
}

/* ---------- Beleg-Modell ---------- */
function leererBeleg(art) {
  const z = aktuellerZeitraum();
  return { art, kontaktId: null, name: '', anschrift: '', bestellnummer: '', frist: '', from: z.von, to: z.bis, tickets: [], projekte: [], posten: [],
    zeit: { ids: [], gruppierung: 'taetigkeit' } };
}
// Aus Entwurf oder Adresse: nur bekannte Felder in fester Form.
function belegAus(d, art) {
  const s = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const liste = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x && x.length <= 200).slice(0, 200) : []);
  const b = leererBeleg(art);
  if (!d || typeof d !== 'object') return b;
  b.kontaktId = Number.isInteger(d.kontaktId) && d.kontaktId > 0 ? d.kontaktId : null;
  b.name = s(d.name, 200); b.anschrift = s(d.anschrift, 800); b.bestellnummer = s(d.bestellnummer, 60); b.frist = s(d.frist, 4);
  if (IST_TAG.test(d.from) && IST_TAG.test(d.to)) { b.from = d.from; b.to = d.to; }
  b.tickets = liste(d.tickets);
  b.projekte = art === 'rechnung' ? liste(d.projekte) : [];
  b.posten = (Array.isArray(d.posten) ? d.posten : []).filter((p) => p && typeof p === 'object').slice(0, 100).map((p) => ({
    typ: p.typ === 'pauschal' ? 'pauschal' : 'stunden',
    bezeichnung: s(p.bezeichnung, 200), menge: s(p.menge, 20), preis: s(p.preis, 20), rabatt: s(p.rabatt, 10),
  }));
  // Manuelle Zeit (Zeiterfassung) nur auf Rechnungen: Eintrags-Ids, gestellt werden sie vom Server.
  const z = d.zeit && typeof d.zeit === 'object' ? d.zeit : {};
  b.zeit = {
    ids: art === 'rechnung' && Array.isArray(z.ids) ? [...new Set(z.ids.filter((i) => Number.isInteger(i) && i > 0))].slice(0, 500) : [],
    gruppierung: z.gruppierung === 'eintrag' ? 'eintrag' : 'taetigkeit',
  };
  return b;
}
const hatInhalt = (b) => !!(b.name.trim() || b.anschrift.trim() || b.tickets.length || b.projekte.length || b.posten.length || b.zeit.ids.length);
// Positionen aus der Zeiterfassung (Server, typ zeit/kulanz) sind keine freien Posten.
const istZeitPos = (p) => p.typ === 'zeit' || p.typ === 'kulanz';
const istRechnung = () => ed.b.art === 'rechnung';

// Zahl aus einem Feld: leer = fehlt (undefined), sonst betragAus (deutsch/englisch).
const zahlAus = (t) => (String(t).trim() === '' ? undefined : betragAus(t));

function postenFuerServer(p) {
  const bezeichnung = p.bezeichnung.trim();
  if (p.typ === 'pauschal') return { bezeichnung, typ: 'pauschal', betrag_eur: zahlAus(p.preis) ?? NaN };
  const rabatt = zahlAus(p.rabatt);
  return { bezeichnung, stunden: zahlAus(p.menge) ?? NaN, satz: zahlAus(p.preis), rabatt_prozent: rabatt === undefined ? 0 : rabatt };
}
const fristZahl = () => (ed.b.frist.trim() === '' ? undefined : Number(ed.b.frist.trim()));

function nutzlast() {
  const b = ed.b;
  const anschrift = b.anschrift.split('\n').map((z) => z.trim()).filter(Boolean);
  const frist = fristZahl();
  const basis = { kontaktId: b.kontaktId || undefined, posten: b.posten.map(postenFuerServer) };
  if (istRechnung()) {
    return { ...basis, empfaenger: { name: b.name.trim(), anschrift, bestellnummer: b.bestellnummer.trim() },
      from: b.from, to: b.to, tickets: b.tickets, projekte: b.projekte, zahlungszielTage: frist,
      ...(b.zeit.ids.length ? { eintraege: b.zeit.ids, gruppierung: b.zeit.gruppierung } : {}) };
  }
  return { ...basis, empfaenger: { name: b.name.trim(), anschrift }, gueltigTage: frist,
    tickets: b.tickets, ...(b.tickets.length ? { from: b.from, to: b.to } : {}) };
}

/* Was vor dem Erstellen fehlt. b = blockiert. Geld wird hier nicht gerechnet,
   nur Form geprueft — die Grenzen haelt der Server. */
function befunde() {
  const b = ed.b, aus = [];
  if (!b.name.trim()) aus.push({ t: 'Empfänger fehlt', b: true });
  if (istRechnung() && !b.anschrift.trim()) aus.push({ t: 'Anschrift des Empfängers fehlt (Pflichtangabe nach § 14 UStG)', b: true });
  if (!b.tickets.length && !b.projekte.length && !b.posten.length && !b.zeit.ids.length) aus.push({ t: 'Mindestens eine Position', b: true });
  if ((istRechnung() || b.tickets.length) && (!IST_TAG.test(b.from) || !IST_TAG.test(b.to) || b.from > b.to)) aus.push({ t: 'Leistungszeitraum fehlt oder endet vor dem Beginn', b: true });
  if (b.posten.some((p) => !p.bezeichnung.trim())) aus.push({ t: 'Eine Position hat keine Beschreibung', b: true });
  if (b.posten.some((p) => postenFalsch(p).length)) aus.push({ t: 'Menge, Preis oder Rabatt ist keine Zahl', b: true });
  const f = fristZahl();
  if (f !== undefined && !Number.isInteger(f)) aus.push({ t: 'Frist: ganze Tage', b: true });
  return aus;
}
function postenFalsch(p) {
  const falsch = [];
  const z = (feld, pflicht) => { const v = zahlAus(p[feld]); if ((v === undefined && pflicht) || Number.isNaN(v)) falsch.push(feld); };
  if (p.typ === 'pauschal') z('preis', true);
  else { z('menge', true); z('preis', false); z('rabatt', false); }
  return falsch;
}

/* ---------- Entwuerfe (R5) ---------- */
const ladeEntwuerfe = () => entwuerfeAus(liesJson('entwuerfe', []));
function speichereEntwurf() {
  if (!ed.b || !hatInhalt(ed.b)) return;
  if (!ed.id) ed.id = 'e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const alle = ladeEntwuerfe().filter((e) => e.id !== ed.id);
  alle.unshift({ id: ed.id, art: ed.b.art, stand: new Date().toISOString(), daten: ed.b });
  // Nur "gespeichert" melden, was wirklich lag: Speicher voll oder gesperrt,
  // oder ein Entwurf ueber der Grenze, die entwuerfeAus beim Lesen zieht.
  const ok = JSON.stringify(ed.b).length <= 50000 && merke('entwuerfe', alle.slice(0, ENTWUERFE_MAX));
  ed.gespeichert = ok ? new Date() : null;
  ed.speicherFehler = !ok;
  const el = document.getElementById('ed-stand');
  if (el) el.innerHTML = standHtml();
}
function loescheEntwurf(id) {
  const alle = ladeEntwuerfe();
  const weg = alle.find((e) => e.id === id) || null;
  if (weg) merke('entwuerfe', alle.filter((e) => e.id !== id));
  return weg;
}
function stelleWiederHer(e) {
  if (!e) return;
  merke('entwuerfe', [e, ...ladeEntwuerfe().filter((x) => x.id !== e.id)].slice(0, ENTWUERFE_MAX));
  zeichneAnsicht();
}
const entwurfTitel = (e) => uebersetze(e.art === 'rechnung' ? 'Rechnung' : 'Angebot') + ' · ' +
  (belegAus(e.daten, e.art).name.trim() || uebersetze('ohne Empfänger'));

// Knopf ueber den Tabellen der Rechnungen- und Angebote-Seite.
function entwuerfeKnopf() {
  const n = ladeEntwuerfe().length;
  if (!n) return '';
  return '<button type="button" class="knopf" data-aktion="entwuerfe">' + esc(uebersetze('Entwürfe')) + ' <span class="mono faint">' + num(n) + '</span></button>';
}
function entwuerfeDialog() {
  const alle = ladeEntwuerfe();
  // Ueber belegAus gelesen: ein alter oder veraenderter Entwurf ohne Listen
  // bringt den Dialog nicht zum Absturz.
  const zaehle = (e) => { const b = belegAus(e.daten, e.art); return b.posten.length + b.tickets.length + b.projekte.length; };
  const zeilen = alle.map((e) => '<div class="ed-entwurf">' +
    '<span class="t"><b>' + esc(entwurfTitel(e)) + '</b><span class="faint">' + esc(datum(e.stand)) + ' · ' + esc(vor(e.stand)) + ' · ' +
      num(zaehle(e)) + ' ' + esc(uebersetze('Positionen ')) + '</span></span>' +
    // Knopf statt Link: die Klick-Delegation unterbindet den Standard-Klick.
    '<button type="button" class="knopf klein" data-aktion="entwurf-oeffnen" data-wert="' + esc(e.id) + '">' + esc(uebersetze('Öffnen')) + '</button>' +
    '<button type="button" class="knopf klein geist" data-aktion="entwurf-loeschen" data-wert="' + esc(e.id) + '">' + esc(uebersetze('Löschen')) + '</button></div>').join('');
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Entwürfe')) + '</h2><span class="faint">' + esc(uebersetze('Entwürfe liegen nur in diesem Browser und sind keine Belege.')) + '</span></div>' +
    '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    (zeilen ? '<div class="ed-entwuerfe">' + zeilen + '</div>' : leer('beleg', 'Keine Entwürfe')), 'Entwürfe', 560);
}
aktion('entwuerfe', () => entwuerfeDialog());
aktion('entwurf-oeffnen', (id) => { schliesseDialog(); geheZu('beleg/entwurf?id=' + id); });
aktion('entwurf-loeschen', (id) => {
  const weg = loescheEntwurf(id);
  entwuerfeDialog();
  zeichneAnsicht();
  if (weg) toast(uebersetze('Entwurf verworfen'), 'ok', { text: uebersetze('Rückgängig'), tu: () => stelleWiederHer(weg) });
});

/* ---------- Oeffnen ---------- */
function oeffne(teile) {
  const [was, q] = String(teile[0] || 'neu').split('?');
  const p = new URLSearchParams(q || '');
  // Ein noch wartender Vorschau-Zeitgeber gehoert zum alten Beleg.
  clearTimeout(vorschauUhr);
  // Schubladen frisch: nach einer gestellten Rechnung muss "abgerechnet in" stimmen.
  Object.assign(ed, { id: null, stand: 0, gespeichert: null, speicherFehler: false, quelle: null, auswahl: new Set(), sichtbar: new Set(), vorwahl: null,
    reiter: 'formular', meldung: '', verloren: false, sendet: false, angebotEntwurf: null,
    quellDaten: { schluessel: null, d: null, fehler: null }, vorlagen: null, zeitDaten: null, zeitVorwahl: false, kontaktWunsch: null });
  ed.vorschau = { lauf: ed.vorschau.lauf + 1, stand: -1, d: null, fehler: null, fehlt: null, laedt: false };
  if (was === 'entwurf') {
    const e = ladeEntwuerfe().find((x) => x.id === p.get('id'));
    if (e) { ed.id = e.id; ed.b = belegAus(e.daten, e.art); ed.gespeichert = new Date(e.stand); return; }
    toast(uebersetze('Entwurf nicht gefunden'), 'err');
  }
  const art = p.get('art') === 'angebot' ? 'angebot' : 'rechnung';
  const vorgabe = {};
  if (IST_TAG.test(p.get('from') || '') && IST_TAG.test(p.get('to') || '')) { vorgabe.from = p.get('from'); vorgabe.to = p.get('to'); }
  vorgabe.tickets = (p.get('tickets') || '').split(',').map((s) => s.trim()).filter(Boolean);
  vorgabe.projekte = (p.get('projekte') || '').split(',').map((s) => s.trim()).filter(Boolean);
  ed.b = belegAus({ ...leererBeleg(art), ...vorgabe }, art);
  if (p.get('quelle') === 'vorgaenge') ed.quelle = 'vorgaenge';
  // Aus der Zeiterfassung ("Offene abrechnen →"): Schublade offen, offene Eintraege des Kontakts vorgewaehlt.
  // Vorwahl nur mit Kontakt (sofort oder nachbelegt): ohne ihn bliebe das Flag scharf und legte
  // spaeter beim Waehlen eines Empfaengers still den Leistungszeitraum um.
  if (p.get('zeit') === 'offen' && art === 'rechnung') { ed.quelle = 'zeit'; ed.zeitVorwahl = !!p.get('kontakt'); }
  // Aus der Kontakt-Akte: Kontakt vorbelegen wie bei der Auswahl im Formular.
  const k = (state.kontakte || []).find((x) => String(x.id) === p.get('kontakt'));
  if (k) fuelleKontakt(k);
  // Nur wenn die Kontakte geladen sind: sonst existiert er womoeglich und der Hinweis waere falsch.
  else if (p.get('kontakt') && state.kontakte) toast(uebersetze('Kontakt nicht vorbelegt — bitte im Formular wählen'), 'err');
  // Direkt geladen: die Kontakte kommen erst nach dem ersten Zeichnen — dann nachbelegen.
  else if (p.get('kontakt')) ed.kontaktWunsch = p.get('kontakt');
  // Nur bei einem leeren neuen Beleg anbieten, den letzten Entwurf fortzusetzen.
  if (!hatInhalt(ed.b)) ed.angebotEntwurf = ladeEntwuerfe().find((e) => e.art === art) || null;
}

/* ---------- Zeichnen ---------- */
function standHtml() {
  if (ed.speicherFehler) return '<span class="punkt fehler"></span>' + esc(uebersetze('Entwurf nicht gespeichert — Browser-Speicher voll oder gesperrt'));
  return '<span class="punkt' + (ed.gespeichert ? ' ok' : '') + '"></span>' + esc(ed.gespeichert
    ? uebersetze('Entwurf gespeichert') + ' · ' + ed.gespeichert.toLocaleTimeString(istDE() ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    : uebersetze('noch nicht gespeichert'));
}

function kontaktName(k) {
  const person = [k.vorname, k.nachname].filter(Boolean).join(' ');
  return k.firma || person || '–';
}

function feld(label, inhalt, breit) {
  return '<label class="feld' + (breit ? ' breit' : '') + '"><span class="label">' + esc(uebersetze(label)) + '</span>' + inhalt + '</label>';
}

function kontaktOptionen() {
  return '<option value="">' + esc(uebersetze('— frei eingeben —')) + '</option>' + (state.kontakte || []).map((k) =>
    '<option value="' + k.id + '"' + (k.id === ed.b.kontaktId ? ' selected' : '') + '>' + esc(kontaktName(k) + (k.status === 'lead' ? ' (Lead)' : '')) + '</option>').join('');
}

function editorHtml() {
  const b = ed.b, R = istRechnung();
  const optionen = kontaktOptionen();
  const fortsetzen = ed.angebotEntwurf
    ? '<div class="ed-fortsetzen" role="status"><span class="t"><b>' + esc(uebersetze('Entwurf vom') + ' ' + datum(ed.angebotEntwurf.stand) + ' ' + uebersetze('fortsetzen?')) + '</b>' +
        '<span class="faint">' + esc(entwurfTitel(ed.angebotEntwurf)) + '</span></span>' +
        '<button type="button" class="knopf klein geist" data-aktion="ed-angebot-weg">' + esc(uebersetze('Verwerfen')) + '</button>' +
        '<a class="knopf klein primaer" href="#/beleg/entwurf?id=' + esc(ed.angebotEntwurf.id) + '">' + esc(uebersetze('Fortsetzen')) + '</a></div>'
    : '';
  return '<div id="editor" class="editor" data-reiter="' + ed.reiter + '" role="region" aria-label="' + esc(uebersetze(R ? 'Neue Rechnung' : 'Neues Angebot')) + '">' +
    '<div class="ed-kopf">' +
      '<h2>' + esc(uebersetze(R ? 'Neue Rechnung' : 'Neues Angebot')) + '</h2>' +
      segment('ed-art', [['angebot', 'Angebot'], ['rechnung', 'Rechnung']], b.art, 'Belegart') +
      '<span class="ed-nr"><span class="mono">' + esc(uebersetze('ENTWURF')) + '</span><span class="faint">' + esc(uebersetze('Nummer beim Erstellen')) + '</span></span>' +
      '<span class="ed-reiter">' + segment('ed-reiter', [['formular', 'Formular'], ['vorschau', 'Vorschau']], ed.reiter, 'Ansicht im Editor') + '</span>' +
      '<span class="ed-stand" id="ed-stand">' + standHtml() + '</span>' +
      '<button type="button" class="knopf klein geist" data-aktion="ed-verwerfen">' + esc(uebersetze('Entwurf verwerfen')) + '</button>' +
      '<button type="button" class="knopf klein" data-aktion="ed-zu" title="' + esc(uebersetze('Esc schließt, der Entwurf bleibt')) + '">' + esc(uebersetze('Schließen ×')) + '</button>' +
    '</div>' +
    '<div class="ed-koerper">' +
      '<div class="ed-form">' + fortsetzen +
        '<div class="karte ed-felder">' +
          feld('Kontakt', '<select id="ed-kontakt">' + optionen + '</select>') +
          feld('Empfänger', '<input id="ed-name" value="' + esc(b.name) + '" maxlength="200" placeholder="' + esc(uebersetze('Name oder Firma')) + '" autocomplete="off">') +
          feld('Anschrift', '<textarea id="ed-anschrift" rows="3" maxlength="800" placeholder="' + esc(uebersetze('Straße Nr.\nPLZ Ort')) + '">' + esc(b.anschrift) + '</textarea>', true) +
          '<div class="feld"><span class="label">' + esc(uebersetze('Datum')) + '</span><span class="ed-wert faint">' + esc(uebersetze('heute, beim Erstellen gesetzt')) + '</span></div>' +
          feld(R ? 'Zahlungsziel' : 'Gültig', '<span class="ed-tage"><input id="ed-frist" inputmode="numeric" maxlength="3" value="' + esc(b.frist) + '" placeholder="' +
            esc(uebersetze(R ? 'Standard' : '30')) + '"><span>' + esc(uebersetze('Tage')) + '</span><span class="faint" id="ed-frist-bis"></span></span>') +
          '<div class="feld breit"><span class="label" id="ed-zeitraum-l">' + esc(uebersetze(R ? 'Leistungszeitraum' : 'Zeitraum der Vorgänge')) + '</span>' +
            '<span class="ed-zeitraum" role="group" aria-labelledby="ed-zeitraum-l"><input type="date" id="ed-von" value="' + esc(b.from) + '" aria-label="' + esc(uebersetze('von')) + '">' +
            '<span class="faint">–</span><input type="date" id="ed-bis" value="' + esc(b.to) + '" aria-label="' + esc(uebersetze('bis')) + '"></span></div>' +
          (R ? feld('Bestellnummer (optional)', '<input id="ed-bestell" maxlength="60" value="' + esc(b.bestellnummer) + '" autocomplete="off">') : '') +
        '</div>' +
        '<div class="karte ed-positionen">' +
          '<div class="karten-kopf"><h3 class="titel-klein">' + esc(uebersetze('Positionen')) + '</h3></div>' +
          '<div id="ed-zeilen"></div>' +
          '<div class="ed-hinzu"><span class="faint">' + esc(uebersetze('+ hinzufügen aus')) + '</span>' +
            '<button type="button" class="chip" data-aktion="ed-quelle" data-wert="vorgaenge" aria-pressed="' + (ed.quelle === 'vorgaenge') + '">' + esc(uebersetze('Vorgänge')) + '</button>' +
            (R ? '<button type="button" class="chip" data-aktion="ed-quelle" data-wert="zeit" aria-pressed="' + (ed.quelle === 'zeit') + '">' + esc(uebersetze('Manuelle Zeit')) + '<span class="ed-n-zeit mono" id="ed-n-zeit"></span></button>' : '') +
            '<button type="button" class="chip" data-aktion="ed-quelle" data-wert="vorlagen" aria-pressed="' + (ed.quelle === 'vorlagen') + '">' + esc(uebersetze('Vorlage')) + '</button>' +
            '<button type="button" class="chip" data-aktion="ed-neu" data-wert="stunden">' + esc(uebersetze('Freie Position')) + '</button>' +
            '<button type="button" class="chip" data-aktion="ed-neu" data-wert="pauschal">' + esc(uebersetze('Pauschale')) + '</button>' +
            '<button type="button" class="chip" data-aktion="ed-neu" data-wert="kulanz">' + esc(uebersetze('Kulanz 0 €')) + '</button>' +
          '</div>' +
          '<div id="ed-schublade"></div>' +
        '</div>' +
      '</div>' +
      '<div class="ed-vorschau">' +
        '<div class="ed-vorschau-kopf"><span class="label">' + esc(uebersetze('Vorschau · wie im PDF')) + '</span>' +
          '<span class="faint" id="ed-vorschau-stand" aria-live="polite"></span>' +
          '<span class="rechts">' + segment('ed-zoom', ED_ZOOM, ed.zoom, 'Zoom') + '</span></div>' +
        '<div class="ed-blatt" id="ed-blatt"><iframe id="ed-iframe" sandbox="" title="' + esc(uebersetze('Vorschau des Belegs')) + '"></iframe>' +
          '<div class="ed-blatt-hinweis" id="ed-blatt-hinweis" hidden></div></div>' +
      '</div>' +
    '</div>' +
    '<div class="ed-fuss" id="ed-fuss"></div>' +
  '</div>';
}

// Positionen: zuerst was aus der Auswertung kommt (Vorgaenge, Projekte),
// dann die freien Posten — dieselbe Reihenfolge wie auf dem Dokument.
function zeichneZeilen() {
  const el = document.getElementById('ed-zeilen');
  if (!el) return;
  const b = ed.b;
  const V = aktuelleVorschau();
  const ausServer = V ? V.positionen.filter((p) => p.ticket) : null;
  const quelle = [
    ...b.tickets.map((k) => ({ k, art: 't', name: k, unter: 'Vorgang' })),
    ...b.projekte.map((k) => ({ k, art: 'p', name: k, unter: 'ohne Vorgang' })),
  ];
  const quellZeile = (q) => {
    const ps = ausServer ? ausServer.filter((p) => p.ticket === q.k && !!p.ohne_vorgangsnummer === (q.art === 'p')) : null;
    const std = ps ? ps.reduce((s, p) => s + (typeof p.stunden === 'number' && p.typ !== 'pauschal' ? p.stunden : 0), 0) : null;
    const betrag = ps ? ps.reduce((s, p) => s + p.betrag_eur, 0) : null;
    return '<div class="ed-zeile quelle">' +
      '<span class="ed-n" aria-hidden="true">·</span>' +
      '<span class="ed-leistung"><b class="mono">' + esc(q.name) + '</b><span class="faint">' + esc(uebersetze(q.unter) + ' · ' + uebersetze('aus der Auswertung')) + '</span></span>' +
      '<span class="mono r">' + (std == null ? '…' : esc(nf2.format(std))) + '</span>' +
      '<span class="mono r faint">' + (ps && ps[0] && ps[0].satz != null ? esc(nf2.format(ps[0].satz)) : '') + '</span>' +
      '<span class="mono r faint">' + (ps && ps[0] && ps[0].rabatt_prozent ? esc(nf1.format(ps[0].rabatt_prozent)) : '') + '</span>' +
      '<span class="mono r">' + (betrag == null ? '…' : esc(nf2.format(betrag))) + '</span>' +
      '<button type="button" class="mini-knopf" data-aktion="ed-quelle-weg" data-wert="' + esc(q.art + ':' + q.k) + '" aria-label="' + esc(uebersetze('Position entfernen') + ' ' + q.name) + '">×</button></div>';
  };
  // Manuelle Zeit: Positionen so, wie der Server sie bildet (je Taetigkeit oder je Eintrag, Kulanz 0,00).
  // Vor der ersten Vorschau eine Sammelzeile, damit die Auswahl nicht unsichtbar ist.
  const zeitPos = V ? V.positionen.filter(istZeitPos) : null;
  const zeitZeile = (p) => '<div class="ed-zeile quelle zeit">' +
      '<span class="ed-n" aria-hidden="true">·</span>' +
      '<span class="ed-leistung"><b>' + esc(p.bezeichnung) + '</b><span class="faint">' + esc(uebersetze(p.typ === 'kulanz' ? 'nicht berechnet' : 'aus der Zeiterfassung') + ' · ' +
        anzahl(p.refs.length, 'Eintrag', 'Einträge')) + '</span></span>' +
      '<span class="mono r">' + esc(nf2.format(p.stunden)) + '</span>' +
      '<span class="mono r faint">' + esc(nf2.format(p.satz)) + '</span>' +
      '<span class="mono r faint">' + (p.rabatt_prozent ? esc(nf1.format(p.rabatt_prozent)) : '') + '</span>' +
      '<span class="mono r">' + esc(nf2.format(p.betrag_eur)) + '</span>' +
      '<button type="button" class="mini-knopf" data-aktion="ed-quelle-weg" data-wert="' + esc('z:' + p.refs.join(',')) + '" aria-label="' + esc(uebersetze('Position entfernen') + ' ' + p.bezeichnung) + '">×</button></div>';
  const zeitHtml = !b.zeit.ids.length ? '' : zeitPos
    ? zeitPos.map(zeitZeile).join('')
    : '<div class="ed-zeile quelle zeit"><span class="ed-n" aria-hidden="true">·</span><span class="ed-leistung"><b>' + esc(uebersetze('Manuelle Zeit')) + '</b><span class="faint">' +
        esc(anzahl(b.zeit.ids.length, 'Eintrag', 'Einträge') + ' · ' + uebersetze('aus der Zeiterfassung')) + '</span></span>' +
      '<span class="mono r">…</span><span></span><span></span><span class="mono r">…</span>' +
      '<button type="button" class="mini-knopf" data-aktion="ed-quelle-weg" data-wert="' + esc('z:' + b.zeit.ids.join(',')) + '" aria-label="' + esc(uebersetze('Position entfernen') + ' ' + uebersetze('Manuelle Zeit')) + '">×</button></div>';
  const nZeit = zeitPos ? zeitPos.length : b.zeit.ids.length ? 1 : 0;
  const freiZeile = (p, i) => {
    const falsch = postenFalsch(p);
    const ein = (f, wert, label, extra) => '<input name="p' + i + '-' + f + '" data-i="' + i + '" data-f="' + f + '" value="' + esc(wert) + '" aria-label="' + esc(uebersetze(label)) + '"' +
      (falsch.includes(f) ? ' aria-invalid="true"' : '') + (extra || '') + '>';
    const pauschal = p.typ === 'pauschal';
    const satzStd = state.summary && state.summary.config ? nf2.format(state.summary.config.stundensatz) : '';
    return '<div class="ed-zeile">' +
      '<span class="ed-n mono faint">' + (b.tickets.length + b.projekte.length + nZeit + i + 1) + '</span>' +
      '<span class="ed-leistung">' + ein('bezeichnung', p.bezeichnung, 'Beschreibung', ' maxlength="200" placeholder="' + esc(uebersetze('Beschreibung')) + '"' + (p.bezeichnung.trim() ? '' : ' aria-invalid="true"')) +
        '<span class="faint">' + esc(uebersetze(pauschal ? 'Pauschale' : 'Freie Position')) + '</span></span>' +
      (pauschal ? '<span class="r faint">' + esc(uebersetze('pauschal')) + '</span>' : ein('menge', p.menge, 'Stunden', ' inputmode="decimal" class="zahl"')) +
      ein('preis', p.preis, pauschal ? 'Festpreis' : 'Stundensatz', ' inputmode="decimal" class="zahl"' + (pauschal ? '' : ' placeholder="' + esc(satzStd) + '"')) +
      (pauschal ? '<span class="r faint">–</span>' : ein('rabatt', p.rabatt, 'Rabatt in Prozent', ' inputmode="decimal" class="zahl" placeholder="–"')) +
      '<span class="mono r" data-betrag="' + i + '">…</span>' +
      '<button type="button" class="mini-knopf" data-aktion="ed-weg" data-wert="' + i + '" aria-label="' + esc(uebersetze('Position entfernen')) + '">×</button></div>';
  };
  const leerText = !quelle.length && !b.posten.length && !b.zeit.ids.length;
  el.innerHTML = leerText
    ? '<div class="ed-leer">' + esc(uebersetze('Noch keine Position. Wähle unten eine Quelle — Vorgänge übernehmen Zeit und Satz aus der Auswertung.')) + '</div>'
    : '<div class="ed-zeile kopf" aria-hidden="true"><span></span><span>' + esc(uebersetze('Leistung')) + '</span><span class="r">' + esc(uebersetze('Std.')) +
        '</span><span class="r">' + esc(uebersetze('Preis €')) + '</span><span class="r">' + esc(uebersetze('Rab. %')) + '</span><span class="r">' + esc(uebersetze('Betrag')) + '</span><span></span></div>' +
      quelle.map(quellZeile).join('') + zeitHtml + b.posten.map(freiZeile).join('');
  aktualisiereBetraege();
}
// Betraege der freien Zeilen aus der Vorschau, ohne die Eingabefelder neu zu bauen.
// Zeitpositionen stehen vor den freien in der Antwort und gehoeren nicht zu ihnen.
function aktualisiereBetraege() {
  const V = aktuelleVorschau();
  const frei = V ? V.positionen.filter((p) => !p.ticket && !istZeitPos(p)) : null;
  document.querySelectorAll('#ed-zeilen [data-betrag]').forEach((el) => {
    const p = frei && frei[Number(el.dataset.betrag)];
    el.textContent = p ? nf2.format(p.betrag_eur) : '…';
  });
}
// Die Vorschau gilt nur fuer den Stand, aus dem sie entstand.
const aktuelleVorschau = () => (ed.vorschau.d && ed.vorschau.stand === ed.stand ? ed.vorschau.d : null);

/* ---------- Schublade: Vorgaenge und Vorlagen ---------- */
function ladeQuellDaten() {
  const b = ed.b, Q = ed.quellDaten;
  const schluessel = b.from + '|' + b.to;
  if (Q.schluessel === schluessel && (Q.d || Q.fehler || Q.laedt)) return;
  if (!IST_TAG.test(b.from) || !IST_TAG.test(b.to)) return;
  Object.assign(Q, { schluessel, d: null, fehler: null, laedt: true });
  hole('/api/summary?' + abfrage({ from: b.from, to: b.to })).then((d) => {
    if (Q.schluessel === schluessel) Object.assign(Q, { d, laedt: false });
  }, (e) => {
    if (Q.schluessel === schluessel) Object.assign(Q, { fehler: e.message || 'Fehler', laedt: false });
  }).then(() => zeichneSchublade());
}
function ladeVorlagen() {
  if (ed.vorlagen) return;
  ed.vorlagen = { d: null, fehler: null };
  hole('/api/vorlagen').then((d) => { ed.vorlagen.d = d.vorlagen || []; }, (e) => { ed.vorlagen.fehler = e.message || 'Fehler'; })
    .then(() => zeichneSchublade());
}

// Offene Eintraege der Zeiterfassung (alle Zeitraeume). Neu geladen je Editor-Oeffnen.
function ladeZeitDaten() {
  if (ed.zeitDaten) return;
  ed.zeitDaten = { d: null, fehler: null };
  hole('/api/zeit?status=offen').then((d) => {
    if (!d || !Array.isArray(d.eintraege)) throw new Error(uebersetze('Antwort ohne Einträge'));
    ed.zeitDaten.d = d.eintraege;
  }).catch((e) => { ed.zeitDaten.fehler = e.message || 'Fehler'; })
    .then(() => { zeichneSchublade(); zeichneZeitZahl(); });
}
const zeitOffen = () => ed.zeitDaten.d.filter((e) => e.abrechenbar && e.ziel_art !== 'intern');
// Abrechenbare, offene Eintraege des gewaehlten Kontakts (Kunde direkt oder ueber das Projekt).
// null = noch nicht geladen (Eintraege oder die Projekt-Kunden-Zuordnung aus der Summary).
function zeitDesKontakts() {
  const b = ed.b;
  if (!b.kontaktId || !ed.zeitDaten || !ed.zeitDaten.d || !state.summary) return null;
  return zeitOffen().filter((e) => zKontaktVon(e) === b.kontaktId);
}
// Offene Eintraege ohne Kunden-Zuordnung folgen keiner Kontaktauswahl — sonst fielen sie still heraus.
const zeitOhneKunde = () => (ed.zeitDaten && ed.zeitDaten.d && state.summary ? zeitOffen().filter((e) => zKontaktVon(e) === null) : []);
const imZeitraum = (e) => IST_TAG.test(ed.b.from) && IST_TAG.test(ed.b.to) && e.tag >= ed.b.from && e.tag <= ed.b.to;
function zeichneZeitZahl() {
  const el = document.getElementById('ed-n-zeit');
  if (!el) return;
  const z = zeitDesKontakts();
  el.textContent = z ? ' (' + z.filter((e) => !ed.b.zeit.ids.includes(e.id)).length + ')' : '';
}

function zeichneSchublade() {
  const el = document.getElementById('ed-schublade');
  if (!el) return;
  if (istRechnung()) { ladeZeitDaten(); zeichneZeitZahl(); }
  if (!ed.quelle) { el.innerHTML = ''; return; }
  const b = ed.b;
  let titel, hinweis, eintraege = null, fehler = null, leerText = null, kopfRechts = '';
  if (ed.quelle === 'zeit') {
    titel = 'Manuelle Zeit';
    hinweis = b.kontaktId ? 'Offene, abrechenbare Einträge aus der Zeiterfassung' : 'Erst Empfänger wählen.';
    kopfRechts = segment('ed-zgruppe', [['eintrag', 'je Eintrag'], ['taetigkeit', 'je Tätigkeit']], b.zeit.gruppierung, 'Gruppierung');
    fehler = ed.zeitDaten && ed.zeitDaten.fehler;
    const z = zeitDesKontakts();
    if (!b.kontaktId) eintraege = [];
    else if (z) {
      // Aus der Zeiterfassung: Leistungszeitraum auf die offenen Eintraege legen (nur ohne
      // Vorgaenge — deren Stunden haengen am Zeitraum), dann alle vorwaehlen.
      if (ed.zeitVorwahl) {
        ed.zeitVorwahl = false;
        const offen = z.filter((e) => !b.zeit.ids.includes(e.id));
        if (offen.length && !b.tickets.length && !b.projekte.length) {
          const tage = offen.map((e) => e.tag).sort();
          b.from = tage[0]; b.to = tage[tage.length - 1];
          const von = document.getElementById('ed-von'), bis = document.getElementById('ed-bis');
          if (von) von.value = b.from;
          if (bis) bis.value = b.to;
          geaendert();
        }
        for (const e of offen) if (imZeitraum(e)) ed.auswahl.add('z:' + e.id);
      }
      eintraege = z.map((e) => ({ id: 'z:' + e.id, l: datumKurz(e.tag), t: e.taetigkeit + ' · ' + (e.notiz || e.name || e.ziel_schluessel),
        unter: (e.projekt || e.name || '') + ' · ' + hrs(e.gezaehlt_min / 60) + ' · ' + eur(e.eur), drin: b.zeit.ids.includes(e.id), aussen: !imZeitraum(e) }));
    }
    leerText = fuelle('Nichts Offenes für {name}.', { name: b.name.trim() || uebersetze('diesen Kontakt') });
    const ohne = zeitOhneKunde();
    if (ohne.length) kopfRechts = '<span class="pille warn" title="' + esc(uebersetze('Projekt unter Kontakte → Projekte & Sätze einem Kunden zuordnen oder den Eintrag auf einen Kunden buchen.')) + '">' +
      esc(fuelle('{n} offene ohne Kunden-Zuordnung', { n: ohne.length })) + '</span>' + kopfRechts;
  } else if (ed.quelle === 'vorgaenge') {
    ladeQuellDaten();
    const Q = ed.quellDaten;
    titel = 'Vorgänge im Leistungszeitraum'; hinweis = 'Zeit und Satz aus der Auswertung, Rabatt aus dem Projekt';
    // Nur der Stand des aktuellen Zeitraums ist waehlbar, nie ein alter.
    const aktuell = Q.schluessel === b.from + '|' + b.to;
    fehler = !IST_TAG.test(b.from) || !IST_TAG.test(b.to) ? uebersetze('Leistungszeitraum fehlt.') : aktuell ? Q.fehler : null;
    if (Q.d && aktuell) {
      const abr = Q.d.abrechnung || {};
      // Kunde je Projekt (Kontakte → Projekte & Sätze). Wie in der bisherigen
      // Ansicht: der gewaehlte Kontakt bestimmt die Vorwahl, fremde und
      // unzugeordnete Vorgaenge bleiben sichtbar, nur abgesetzt.
      const pk = Q.d.projekt_kontakt || {};
      const kundeVon = (projekt) => (Object.hasOwn(pk, projekt) ? pk[projekt].id : null);
      // Begann die Arbeit am oder vor dem Starttag, fehlt womoeglich ein frueherer Teil.
      const schnitt = (t) => !!t.first_day && t.first_day <= b.from;
      // Betrag = Claude-Stunden x Satz, wie ihn die Position bucht. Manuelle
      // Zeit ist eine eigene Quelle und steht hier nicht mit drin.
      eintraege = [
        ...(Q.d.tickets || []).map((t) => ({ id: 't:' + t.ticket, l: t.ticket, t: t.project || '', h: t.active_hours, eur: t.arbeitswert_claude ?? t.arbeitswert,
          drin: b.tickets.includes(t.ticket), abr: abr[t.ticket] ? abr[t.ticket].nummern : null, kid: kundeVon(t.project), schnitt: schnitt(t) })),
        // Nur Projektzeilen: Kundenzeilen (nur manuelle Zeit) nimmt der Server nicht als Projekt an.
        ...(istRechnung() ? (Q.d.ohne_ticket || []).filter((t) => (t.art || 'projekt') === 'projekt').map((t) => ({ id: 'p:' + t.gruppe, l: t.gruppe, t: uebersetze('ohne Vorgang'), h: t.active_hours, eur: t.arbeitswert_claude ?? t.arbeitswert,
          drin: b.projekte.includes(t.gruppe), abr: null, kid: kundeVon(t.gruppe), schnitt: schnitt(t) })) : []),
      ];
      // Neue Vorwahl nur, wenn sich Kontakt oder Zeitraum aendern — eigene Haken
      // bleiben sonst beim Neuzeichnen stehen.
      const vorwahl = b.kontaktId + '|' + Q.schluessel;
      // Bereits abgerechnete Vorgaenge nicht vorhaken: ihre Arbeit stuende sonst doppelt
      // auf einer Rechnung. Sie bleiben waehlbar (neue Arbeit in einem spaeteren Zeitraum).
      if (ed.vorwahl !== vorwahl && (b.kontaktId || ed.vorwahl)) {
        ed.auswahl.clear();
        if (b.kontaktId) for (const e of eintraege) if (!e.drin && !e.abr && e.kid === b.kontaktId) ed.auswahl.add(e.id);
      }
      ed.vorwahl = vorwahl;
    }
  } else {
    ladeVorlagen();
    titel = 'Positionsvorlagen'; hinweis = 'Gepflegt in den Einstellungen';
    fehler = ed.vorlagen.fehler;
    if (ed.vorlagen.d) eintraege = ed.vorlagen.d.map((v) => ({ id: 'v:' + v.id, l: v.satz == null ? '–' : nf2.format(v.satz) + ' €', t: v.bezeichnung, drin: false }));
  }
  // Uebernommen wird nur, was gerade zu sehen ist (manuelle Zeit nur im Leistungszeitraum, § 14 UStG).
  ed.sichtbar = new Set((eintraege || []).filter((e) => !e.drin && !e.aussen).map((e) => e.id));
  ed.kundeJe = new Map((eintraege || []).map((e) => [e.id, e.kid || null]));
  ed.abrJe = new Map((eintraege || []).filter((e) => e.abr).map((e) => [e.id, e.l]));
  for (const id of ed.auswahl) if (!ed.sichtbar.has(id)) ed.auswahl.delete(id);
  const n = ed.auswahl.size;
  const fremd = (e) => ed.quelle === 'vorgaenge' && b.kontaktId && e.kid !== b.kontaktId;
  const zeile = (e) => '<label class="ed-wahl' + (e.drin ? ' drin' : '') + (fremd(e) || e.aussen ? ' fremd' : '') + '"><input type="checkbox" name="wahl" data-wahl="' + esc(e.id) + '"' +
      (e.drin ? ' disabled checked' : e.aussen ? ' disabled' : ed.auswahl.has(e.id) ? ' checked' : '') + '>' +
    '<span class="mono l">' + esc(e.l) + '</span><span class="t">' + esc(e.t) +
      (e.h != null ? '<span class="faint">' + esc(hrs(e.h) + ' · ' + eur(e.eur)) + '</span>' : '') +
      (e.unter ? '<span class="faint">' + esc(e.unter) + '</span>' : '') + '</span>' +
    (e.aussen ? '<span class="pille warn" title="' + esc(uebersetze('Leistungszeitraum oben erweitern, um ihn abzurechnen.')) + '">' + esc(uebersetze('außerhalb des Leistungszeitraums')) + '</span>' : '') +
    (ed.quelle === 'vorgaenge' && !e.kid ? '<span class="pille warn" title="' + esc(uebersetze('Das Projekt ist keinem Kunden zugeordnet — unter Kontakte → Projekte & Sätze nachtragen.')) + '">' + esc(uebersetze('ohne Kunde')) + '</span>' : '') +
    (e.schnitt ? '<span class="pille warn" title="' + esc(uebersetze('Die Arbeit beginnt am oder vor dem Starttag — frühere Anteile sind nicht enthalten.')) + '">' + esc(uebersetze('angeschnitten')) + '</span>' : '') +
    (e.abr ? '<span class="pille st-abgerechnet st" title="' + esc(e.abr.join(', ')) + '">' + esc(uebersetze('abgerechnet in') + ' ' + e.abr.join(', ')) + '</span>' : '') +
    (e.drin ? '<span class="faint">' + esc(uebersetze('übernommen')) + '</span>' : '') + '</label>';
  el.innerHTML = '<div class="ed-schublade">' +
    '<div class="k"><span class="t"><b>' + esc(uebersetze(titel)) + '</b><span class="faint">' + esc(uebersetze(hinweis)) + '</span></span>' + kopfRechts + '</div>' +
    (fehler ? leer('liste', 'Nicht geladen', fehler) : !eintraege ? '<div class="leer">' + esc(uebersetze('lädt …')) + '</div>'
      : !eintraege.length ? (ed.quelle === 'zeit' && !b.kontaktId ? '' : '<span class="faint">' + esc(leerText || uebersetze(ed.quelle === 'vorgaenge' ? 'Nichts im Zeitraum.' : 'Noch keine Vorlage.')) + '</span>')
      : '<div class="ed-wahlen">' + eintraege.map(zeile).join('') + '</div>' + quellWarnungen(eintraege)) +
    '<div class="dialog-fuss"><button type="button" class="knopf klein" data-aktion="ed-quelle" data-wert="' + ed.quelle + '">' + esc(uebersetze('Schließen')) + '</button>' +
      '<button type="button" class="knopf klein' + (n ? ' primaer' : '') + '" data-aktion="ed-uebernehmen"' + (n ? '' : ' disabled') + '>' +
        esc(n ? n + ' ' + uebersetze('übernehmen') : uebersetze('Auswählen')) + '</button></div>' +
  '</div>';
}

// Unter der Liste, wie in der bisherigen Ansicht: was keiner Kundenauswahl
// folgt, und wo frueherer Aufwand fehlen kann. Beides kostet sonst still Geld.
function quellWarnungen(eintraege) {
  if (ed.quelle !== 'vorgaenge') return '';
  const ohneKunde = eintraege.filter((e) => !e.kid && !e.drin).map((e) => e.l);
  const doppelt = eintraege.filter((e) => e.abr && ed.auswahl.has(e.id)).map((e) => e.l);
  const schnitt = eintraege.filter((e) => e.schnitt && !e.drin).map((e) => e.l);
  return (ohneKunde.length ? '<div class="ed-warnung">' + esc(fuelle('Ohne Kundenzuordnung: {liste}. Diese Arbeit lässt sich abrechnen, folgt aber keiner Kundenauswahl — unter Kontakte → Projekte & Sätze das Projekt beim Kunden eintragen.', { liste: ohneKunde.join(', ') })) + '</div>' : '') +
    (doppelt.length ? '<div class="ed-warnung">' + esc(fuelle('{liste} steht schon auf einer Rechnung. Nur dazunehmen, wenn im Leistungszeitraum neue Arbeit liegt — sonst wird sie doppelt berechnet.', { liste: doppelt.join(', ') })) + '</div>' : '') +
    (schnitt.length ? '<div class="ed-warnung">' + esc(fuelle('Bei {liste} beginnt die Arbeit am oder vor dem {tag}. Enthalten ist nur der Anteil ab diesem Tag — Leistungszeitraum weiter zurücklegen, wenn frühere Arbeit mit abgerechnet werden soll.', { liste: schnitt.join(', '), tag: datum(ed.b.from) })) + '</div>' : '');
}

/* ---------- Vorschau ---------- */
let vorschauUhr = null;
function planeVorschau(ms = 400) {
  clearTimeout(vorschauUhr);
  vorschauUhr = setTimeout(holeVorschau, ms);
  zeichneVorschauStand();
}
function vorschauFehlt() {
  const b = ed.b;
  if (!b.name.trim()) return 'Vorschau erscheint, sobald ein Empfänger eingetragen ist.';
  if (!b.tickets.length && !b.projekte.length && !b.posten.length && !b.zeit.ids.length) return 'Vorschau erscheint mit der ersten Position.';
  if ((istRechnung() || b.tickets.length) && (!IST_TAG.test(b.from) || !IST_TAG.test(b.to))) return 'Leistungszeitraum fehlt.';
  // Was das Formular schon als falsch kennt, muss der Server nicht erst ablehnen.
  if (b.posten.some((p) => !p.bezeichnung.trim() || postenFalsch(p).length)) return 'Vorschau wartet, bis jede Position eine Beschreibung und gültige Zahlen hat.';
  const f = fristZahl();
  if (f !== undefined && !Number.isInteger(f)) return 'Frist: ganze Tage';
  return null;
}
async function sendeVorschau(daten) {
  const r = await fetch('/api/beleg-vorschau', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(daten), signal: AbortSignal.timeout(30000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = new Error(d.error || 'HTTP ' + r.status);
    e.fehlt = Array.isArray(d.fehlt) ? d.fehlt : null;
    throw e;
  }
  return d;
}
async function holeVorschau() {
  if (!document.getElementById('editor')) return;
  const V = ed.vorschau, stand = ed.stand;
  const lauf = ++V.lauf;
  const fehlt = vorschauFehlt();
  if (fehlt) {
    Object.assign(V, { d: null, fehler: uebersetze(fehlt), fehlt: null, stand, laedt: false });
  } else {
    V.laedt = true;
    zeichneVorschauStand();
    let d = null, fehler = null, fehltListe = null;
    try { d = await sendeVorschau({ art: ed.b.art, ...nutzlast() }); } catch (e) {
      fehler = VERLOREN.includes(e.name) ? uebersetze('Server nicht erreichbar — Vorschau nicht aktualisiert.') : e.message || 'Fehler';
      fehltListe = e.fehlt || null;
    }
    // Nur die zuletzt gestartete Abfrage zaehlt; der Editor kann inzwischen zu sein.
    if (lauf !== V.lauf || !document.getElementById('editor')) return;
    Object.assign(V, { d, fehler, fehlt: fehltListe, stand, laedt: false });
  }
  zeichneVorschau();
  zeichneZeilen();
  zeichneFuss();
}
function zeichneVorschauStand() {
  const el = document.getElementById('ed-vorschau-stand');
  if (!el) return;
  const aktuell = ed.vorschau.stand === ed.stand && !ed.vorschau.laedt;
  el.textContent = uebersetze(aktuell ? (ed.vorschau.d ? 'aktuell' : '') : 'aktualisiert …');
  const blatt = document.getElementById('ed-blatt');
  if (blatt) blatt.classList.toggle('laeuft', !aktuell);
}
function zeichneVorschau() {
  const iframe = document.getElementById('ed-iframe'), hinweis = document.getElementById('ed-blatt-hinweis'), blatt = document.getElementById('ed-blatt');
  if (!iframe) return;
  const s = Number(ed.zoom) * 595 / A4.w;
  blatt.style.width = Math.round(A4.w * s) + 'px';
  blatt.style.height = Math.round(A4.h * s) + 'px';
  iframe.style.transform = 'scale(' + s + ')';
  const V = ed.vorschau;
  if (V.d) {
    if (iframe.srcdoc !== V.d.html) iframe.srcdoc = V.d.html;
    hinweis.hidden = true;
  } else {
    iframe.srcdoc = '';
    hinweis.hidden = false;
    hinweis.innerHTML = V.fehlt
      ? '<b>' + esc(uebersetze('Stammdaten unvollständig — sie stehen auf jedem Beleg:')) + '</b><span>' + esc(fehltNamen(V.fehlt)) + '</span>' +
        '<a class="knopf klein" href="#/einstellungen">' + esc(uebersetze('Einstellungen öffnen')) + '</a>'
      : '<span>' + esc(V.fehler || '') + '</span>' +
        (V.fehler && !vorschauFehlt() ? '<button type="button" class="knopf klein" data-aktion="ed-vorschau-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>' : '');
  }
  zeichneVorschauStand();
  const bis = document.getElementById('ed-frist-bis');
  if (bis) bis.textContent = V.d && (V.d.faellig_am || V.d.gueltig_bis)
    ? '· ' + uebersetze(istRechnung() ? 'fällig am' : 'gültig bis') + ' ' + datum(V.d.faellig_am || ortsTagAus(V.d.gueltig_bis)) : '';
}
const ortsTagAus = (iso) => isoTag(new Date(iso));

/* ---------- Fusszeile ---------- */
function zeichneFuss() {
  const el = document.getElementById('ed-fuss');
  if (!el) return;
  const R = istRechnung();
  const V = aktuelleVorschau();
  const liste = befunde();
  // Die Absage des Servers nur, wenn das Formular selbst nichts meldet — sonst steht derselbe Fehler zweimal da.
  if (!liste.some((x) => x.b) && ed.vorschau.stand === ed.stand && ed.vorschau.fehler && !ed.vorschau.fehlt && !vorschauFehlt()) liste.push({ t: ed.vorschau.fehler, b: true, roh: true });
  if (ed.vorschau.fehlt) liste.push({ t: 'Stammdaten unvollständig — sie stehen auf jedem Beleg:', b: true, zusatz: fehltNamen(ed.vorschau.fehlt) });
  const blockiert = liste.some((x) => x.b) || !V || ed.sendet;
  const K = state.summary && state.summary.kennzahlen && state.summary.kennzahlen.wert;
  const marge = K && K.marge_prozent != null
    ? '<span style="color:' + margeFarbe(K.marge_prozent, K.zielmarge_prozent) + '">' + esc(nf1.format(K.marge_prozent)) + ' %</span><span class="faint"> · ' +
      esc(K.zielmarge_prozent != null ? uebersetze('Ziel') + ' ' + nf1.format(K.zielmarge_prozent) + ' %' : uebersetze('kein Ziel')) + '</span>'
    : '<span class="faint">–</span>';
  const summe = (n) => (V ? esc(nf2.format(n)) : '–');
  el.innerHTML =
    '<div class="ed-befunde" aria-live="polite">' +
      (ed.meldung ? '<span class="bad">● ' + esc(ed.meldung) + '</span>' : '') +
      liste.map((x) => '<span class="' + (x.b ? 'bad' : 'warn') + '">' + (x.b ? '● ' : '○ ') + esc(x.roh ? x.t : uebersetze(x.t)) + (x.zusatz ? ' ' + esc(x.zusatz) : '') + '</span>').join('') +
      '<span class="ed-marge" title="' + esc(uebersetze('Kennzahl des gewählten Zeitraums aller Vorgänge, nicht dieses Belegs')) + '">' +
        esc(uebersetze('Marge im Zeitraum — nach Sachkosten und eigener Zeit')) + ': ' + marge + '</span>' +
    '</div>' +
    '<div class="ed-summen"><span>' + esc(uebersetze('Netto')) + '</span><span class="mono">' + summe(V && V.netto_eur) + '</span>' +
      '<span>' + esc(V && V.kleinunternehmer ? uebersetze('§ 19 UStG') : uebersetze('USt') + (V ? ' ' + nf1.format(V.ust_prozent) + ' %' : '')) + '</span><span class="mono">' + summe(V && V.ust_eur) + '</span></div>' +
    '<div class="ed-brutto"><span class="label">' + esc(uebersetze('Brutto')) + '</span><span class="mono">' + summe(V && V.brutto_eur) + ' €</span></div>' +
    '<div class="ed-knoepfe">' +
      '<button type="button" class="knopf primaer" id="ed-erstellen" data-aktion="ed-erstellen"' + (blockiert ? ' disabled' : '') + (ed.sendet ? ' aria-busy="true"' : '') + '>' + (ed.sendet ? '<span class="spinner" aria-hidden="true"></span>' : '') +
        esc(uebersetze(ed.verloren ? 'Trotzdem erneut erstellen' : R ? 'Rechnung erstellen' : 'Angebot erstellen')) + '</button>' +
      (proAktiv() ? '' : '<button type="button" class="knopf" data-aktion="ed-senden" title="' + esc(uebersetze('E-Mail-Versand kommt mit der Pro-Version.')) + '">' +
        esc(uebersetze('Erstellen & senden')) + ' <span class="pille pro">Pro</span></button>') +
    '</div>';
}

/* ---------- Seite ---------- */
function zeichneEditor(w, teile) {
  if (location.hash !== ed.schluessel || !ed.b) {
    oeffne(teile);
    ed.schluessel = location.hash;
    w.innerHTML = '';
  }
  document.title = uebersetze(istRechnung() ? 'Neue Rechnung' : 'Neues Angebot') + ' · c2invoice';
  ciraKontext({ art: 'beleg', id: ed.b.art, titel: uebersetze(istRechnung() ? 'Neue Rechnung' : 'Neues Angebot') });
  // Hintergrund-Nachladen (Summary 60 s, Belege 120 s) baut das Formular nicht
  // neu — sonst verloere die Eingabe Fokus und Cursor. Nur was von den Daten abhaengt.
  if (w.querySelector('#editor')) {
    // Direkt geladener Editor: die Kontakte kommen erst nach dem ersten Zeichnen.
    const sel = w.querySelector('#ed-kontakt');
    if (sel && document.activeElement !== sel && sel.options.length !== (state.kontakte || []).length + 1) sel.innerHTML = kontaktOptionen();
    if (ed.kontaktWunsch && state.kontakte) {
      const k = state.kontakte.find((x) => String(x.id) === ed.kontaktWunsch);
      ed.kontaktWunsch = null;
      if (!k) toast(uebersetze('Kontakt nicht vorbelegt — bitte im Formular wählen'), 'err');
      else if (!ed.b.kontaktId && !ed.b.name.trim()) {
        fuelleKontakt(k);
        if (sel) sel.value = String(k.id);
        document.getElementById('ed-name').value = ed.b.name;
        document.getElementById('ed-anschrift').value = ed.b.anschrift;
        geaendert();
        zeichneSchublade();
      }
    }
    zeichneFuss(); if (ed.quelle === 'vorgaenge') zeichneSchublade(); return;
  }
  w.innerHTML = editorHtml();
  const wurzel = w.querySelector('#editor');
  wurzel.addEventListener('input', eingabe);
  wurzel.addEventListener('change', wahl);
  // Esc schliesst wie im Mockup; der Entwurf bleibt. Ein offener Dialog faengt Esc selbst.
  wurzel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('dialog') && !e.defaultPrevented) { e.preventDefault(); AKTIONEN['ed-zu'](); }
  });
  zeichneZeilen();
  zeichneSchublade();
  zeichneVorschau();
  zeichneFuss();
  planeVorschau(0);
}

function geaendert() {
  ed.stand++;
  // Die Warnung nach verlorener Antwort bleibt, bis erstellt oder der Editor neu geoeffnet wird.
  if (!ed.verloren) ed.meldung = '';
  // Sofort sichern, nicht erst mit der Vorschau: wer innerhalb von 400 ms
  // weg navigiert, verliert sonst die letzte Eingabe.
  speichereEntwurf();
  zeichneFuss();
  planeVorschau();
}
function eingabe(e) {
  const t = e.target, b = ed.b;
  const felder = { 'ed-name': 'name', 'ed-anschrift': 'anschrift', 'ed-frist': 'frist', 'ed-bestell': 'bestellnummer', 'ed-von': 'from', 'ed-bis': 'to' };
  if (felder[t.id]) {
    b[felder[t.id]] = t.value;
    // Wie 1.4.0: ein umgetippter Name ist ein anderer Empfaenger, der Kontakt
    // (E-Rechnungsangaben, Lead -> Kunde) gehoert dann nicht mehr dazu.
    if (t.id === 'ed-name' && b.kontaktId) { b.kontaktId = null; const sel = document.getElementById('ed-kontakt'); if (sel) sel.value = ''; }
    // Neuer Zeitraum: die Vorgaenge der Schublade gelten fuer den alten.
    if ((t.id === 'ed-von' || t.id === 'ed-bis') && (ed.quelle === 'vorgaenge' || ed.quelle === 'zeit')) zeichneSchublade();
  } else if (t.dataset.f && b.posten[Number(t.dataset.i)]) {
    const p = b.posten[Number(t.dataset.i)];
    p[t.dataset.f] = t.value;
    const falsch = t.dataset.f === 'bezeichnung' ? !t.value.trim() : postenFalsch(p).includes(t.dataset.f);
    if (falsch) t.setAttribute('aria-invalid', 'true'); else t.removeAttribute('aria-invalid');
  } else return;
  geaendert();
}
// Wie in der bisherigen Ansicht: Firma als Name, Person als erste Anschriftzeile.
function fuelleKontakt(k) {
  const person = [k.vorname, k.nachname].filter(Boolean).join(' ');
  ed.b.kontaktId = k.id;
  ed.b.name = kontaktName(k);
  ed.b.anschrift = [k.firma ? person : '', ...(k.anschrift || [])].filter(Boolean).join('\n');
}
function wahl(e) {
  const t = e.target;
  if (t.id === 'ed-kontakt') {
    const k = (state.kontakte || []).find((x) => String(x.id) === t.value);
    ed.b.kontaktId = k ? k.id : null;
    if (k) {
      fuelleKontakt(k);
      document.getElementById('ed-name').value = ed.b.name;
      document.getElementById('ed-anschrift').value = ed.b.anschrift;
    }
    // Manuelle Zeit gehoert einem Kontakt: beim Wechsel faellt sie heraus, sonst stuende
    // Zeit des vorigen Kunden unsichtbar (Schublade filtert neu) auf der Rechnung.
    if (ed.b.zeit.ids.length) {
      toast(uebersetze('Manuelle Zeit des vorigen Empfängers entfernt:') + ' ' + anzahl(ed.b.zeit.ids.length, 'Eintrag', 'Einträge'), 'err');
      ed.b.zeit.ids = [];
      zeichneZeilen();
    }
    geaendert();
    zeichneSchublade();
  } else if (t.dataset.wahl) {
    if (t.checked) ed.auswahl.add(t.dataset.wahl); else ed.auswahl.delete(t.dataset.wahl);
    const k = document.querySelector('[data-aktion="ed-uebernehmen"]');
    const n = ed.auswahl.size;
    if (k) { k.disabled = !n; k.classList.toggle('primaer', !!n); k.textContent = n ? n + ' ' + uebersetze('übernehmen') : uebersetze('Auswählen'); }
  }
}

aktion('ed-art', (art) => {
  if (!['rechnung', 'angebot'].includes(art) || art === ed.b.art) return;
  ed.b.art = art;
  if (art === 'angebot' && ed.b.projekte.length) {
    toast(uebersetze('Projekte ohne Vorgang gibt es nur auf Rechnungen — entfernt:') + ' ' + ed.b.projekte.join(', '), 'err');
    ed.b.projekte = [];
  }
  if (art === 'angebot' && ed.b.zeit.ids.length) {
    toast(uebersetze('Manuelle Zeit gibt es nur auf Rechnungen — entfernt:') + ' ' + anzahl(ed.b.zeit.ids.length, 'Eintrag', 'Einträge'), 'err');
    ed.b.zeit.ids = [];
  }
  if (art === 'angebot' && ed.quelle === 'zeit') ed.quelle = null;
  const w = document.getElementById('ansicht');
  w.innerHTML = '';
  ed.stand++;
  zeichneEditor(w, []);
});
aktion('ed-reiter', (r) => {
  if (!['formular', 'vorschau'].includes(r)) return;
  ed.reiter = r;
  const el = document.getElementById('editor');
  el.dataset.reiter = r;
  el.querySelectorAll('[data-aktion="ed-reiter"]').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.wert === r)));
});
aktion('ed-zoom', (z) => {
  if (!ED_ZOOM.some(([w]) => w === z)) return;
  ed.zoom = z;
  merke('editor.zoom', z);
  document.querySelectorAll('[data-aktion="ed-zoom"]').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.wert === z)));
  zeichneVorschau();
});
aktion('ed-quelle', (q) => {
  ed.quelle = ed.quelle === q ? null : q;
  ed.auswahl = new Set();
  // Ein Ladefehler bleibt nicht kleben: Oeffnen versucht es erneut.
  if (ed.quellDaten.fehler) ed.quellDaten = { schluessel: null, d: null, fehler: null };
  if (ed.vorlagen && ed.vorlagen.fehler) ed.vorlagen = null;
  if (ed.zeitDaten && ed.zeitDaten.fehler) ed.zeitDaten = null;
  document.querySelectorAll('[data-aktion="ed-quelle"].chip').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.wert === ed.quelle)));
  zeichneSchublade();
});
aktion('ed-uebernehmen', () => {
  const b = ed.b;
  // Wie in der bisherigen Ansicht: gehoeren alle gewaehlten Vorgaenge einem Kunden
  // und ist noch kein Empfaenger eingetragen, wird dieser Kunde vorgeschlagen.
  const kunden = new Set([...ed.auswahl].filter((id) => /^[tp]:/.test(id)).map((id) => ed.kundeJe && ed.kundeJe.get(id)));
  const vorschlag = !b.kontaktId && !b.name.trim() && kunden.size === 1 && !kunden.has(null) && !kunden.has(undefined)
    ? (state.kontakte || []).find((k) => k.id === [...kunden][0]) : null;
  for (const id of ed.auswahl) {
    if (!ed.sichtbar.has(id)) continue;
    const [art, ...rest] = id.split(':');
    const k = rest.join(':');
    if (art === 'z' && istRechnung() && !b.zeit.ids.includes(Number(k)) && b.zeit.ids.length < 500) b.zeit.ids.push(Number(k));
    else if (art === 't' && !b.tickets.includes(k)) b.tickets.push(k);
    else if (art === 'p' && istRechnung() && !b.projekte.includes(k)) b.projekte.push(k);
    else if (art === 'v' && ed.vorlagen && ed.vorlagen.d) {
      const v = ed.vorlagen.d.find((x) => String(x.id) === k);
      if (v && b.posten.length < 100) b.posten.push({ typ: 'stunden', bezeichnung: v.bezeichnung, menge: '1', preis: v.satz == null ? '' : nf2.format(v.satz), rabatt: '' });
    }
  }
  const doppelt = [...ed.auswahl].filter((id) => ed.abrJe && ed.abrJe.has(id)).map((id) => ed.abrJe.get(id));
  if (doppelt.length) toast(fuelle('{liste} steht schon auf einer Rechnung. Nur dazunehmen, wenn im Leistungszeitraum neue Arbeit liegt — sonst wird sie doppelt berechnet.', { liste: doppelt.join(', ') }), 'err');
  if (vorschlag) {
    fuelleKontakt(vorschlag);
    const sel = document.getElementById('ed-kontakt');
    if (sel) sel.value = String(vorschlag.id);
    document.getElementById('ed-name').value = b.name;
    document.getElementById('ed-anschrift').value = b.anschrift;
    toast(uebersetze('Empfänger vorgeschlagen') + ': ' + b.name, 'ok');
  }
  ed.quelle = null;
  ed.auswahl = new Set();
  document.querySelectorAll('[data-aktion="ed-quelle"].chip').forEach((k) => k.setAttribute('aria-pressed', 'false'));
  zeichneSchublade();
  zeichneZeilen();
  geaendert();
});
aktion('ed-neu', (typ) => {
  if (ed.b.posten.length >= 100) return;
  // "Kulanz 0 €" (Mockup): sichtbar erbrachte, nicht berechnete Stunde — eine freie Position zu 0 €.
  // Belege bleiben deutsch: die Bezeichnung nicht uebersetzen.
  ed.b.posten.push(typ === 'kulanz' ? { typ: 'stunden', bezeichnung: 'Kulanz', menge: '1', preis: '0', rabatt: '' }
    : { typ: typ === 'pauschal' ? 'pauschal' : 'stunden', bezeichnung: '', menge: typ === 'pauschal' ? '' : '1', preis: '', rabatt: '' });
  if (typ === 'kulanz') { zeichneZeilen(); geaendert(); return; }
  zeichneZeilen();
  geaendert();
  const felder = document.querySelectorAll('#ed-zeilen input[data-f="bezeichnung"]');
  if (felder.length) felder[felder.length - 1].focus();
});
// Gruppierung der Zeitpositionen: gilt fuer alle Eintraege des Belegs (der Server bildet die Zeilen).
aktion('ed-zgruppe', (g) => {
  if (!['eintrag', 'taetigkeit'].includes(g) || g === ed.b.zeit.gruppierung) return;
  ed.b.zeit.gruppierung = g;
  zeichneSchublade();
  zeichneZeilen();
  geaendert();
});
aktion('ed-weg', (i) => {
  ed.b.posten.splice(Number(i), 1);
  zeichneZeilen();
  geaendert();
});
aktion('ed-quelle-weg', (wert) => {
  const [art, ...rest] = String(wert).split(':');
  const k = rest.join(':');
  if (art === 't') ed.b.tickets = ed.b.tickets.filter((x) => x !== k);
  if (art === 'p') ed.b.projekte = ed.b.projekte.filter((x) => x !== k);
  if (art === 'z') { const weg = new Set(k.split(',').map(Number)); ed.b.zeit.ids = ed.b.zeit.ids.filter((i) => !weg.has(i)); zeichneZeitZahl(); }
  zeichneZeilen();
  if (ed.quelle) zeichneSchublade();
  geaendert();
});
aktion('ed-angebot-weg', () => {
  const weg = loescheEntwurf(ed.angebotEntwurf && ed.angebotEntwurf.id);
  ed.angebotEntwurf = null;
  document.querySelector('.ed-fortsetzen')?.remove();
  if (weg) toast(uebersetze('Entwurf verworfen'), 'ok', { text: uebersetze('Rückgängig'), tu: () => stelleWiederHer(weg) });
});
aktion('ed-zu', () => {
  speichereEntwurf();
  const angebot = ed.b && ed.b.art === 'angebot';
  clearTimeout(vorschauUhr);
  ed.vorschau.lauf++;
  ed.schluessel = null;
  ed.b = null;
  geheZu(angebot ? 'angebote' : 'rechnungen');
});
aktion('ed-verwerfen', () => {
  const weg = ed.id ? loescheEntwurf(ed.id) : null;
  const angebot = ed.b && ed.b.art === 'angebot';
  ed.id = null;
  clearTimeout(vorschauUhr);
  ed.vorschau.lauf++;
  ed.schluessel = null;
  ed.b = null;
  geheZu(angebot ? 'angebote' : 'rechnungen');
  if (weg) toast(uebersetze('Entwurf verworfen'), 'ok', { text: uebersetze('Rückgängig'), tu: () => stelleWiederHer(weg) });
});
aktion('ed-senden', () => toast(uebersetze('E-Mail-Versand kommt mit der Pro-Version.')));

// Kein mitLauf: zeichneFuss() baut den Knopf waehrend des POST neu, ein
// frischer Knopf waere wieder klickbar. Das Flag ueberlebt das Neuzeichnen.
aktion('ed-erstellen', async () => {
  if (ed.sendet || befunde().some((x) => x.b)) return;
  const V = aktuelleVorschau();
  if (!V) return;
  const art = ed.b.art, id = ed.id, mitZeit = ed.b.zeit.ids.length > 0;
  ed.sendet = true;
  zeichneFuss();
  let d;
  // Nur der POST entscheidet ueber "nicht erstellt" (Wiki: Geld-POST ohne
  // Antwort ist nicht gescheitert). Eine Absage mit Grund heisst: nichts
  // geschrieben. Keine Antwort oder ein Serverfehler heisst: vielleicht.
  try {
    // erwartetBrutto: gestellt wird nur, was die Vorschau zeigte (sonst 409).
    d = await sende(art === 'rechnung' ? '/api/rechnung' : '/api/angebot', { ...nutzlast(), erwartetBrutto: V.brutto_eur });
  } catch (e) {
    ed.sendet = false;
    if (!ed.b) return;
    ed.verloren = VERLOREN.includes(e.name) || e.status >= 500;
    ed.meldung = ed.verloren
      ? uebersetze('Keine Antwort vom Server — der Beleg ist vielleicht erstellt. Bitte die Liste prüfen, bevor du erneut erstellst.')
      : uebersetze('Nicht erstellt') + ': ' + e.message;
    // Abweichung: Vorschau neu holen, damit zu sehen ist, was jetzt gestellt wuerde.
    if (e.status === 409) { ed.stand++; planeVorschau(0); }
    zeichneFuss();
    if (ed.verloren) ladeBelege();
    return;
  }
  // Ab hier ist der Beleg gestellt. Zuerst den Editor schliessen — was danach
  // scheitert, darf keinen klickbaren Erstellen-Knopf zuruecklassen.
  clearTimeout(vorschauUhr);
  ed.vorschau.lauf++;
  Object.assign(ed, { id: null, schluessel: null, b: null, meldung: '', verloren: false, sendet: false });
  geheZu(art === 'rechnung' ? 'rechnungen' : 'angebote');
  try {
    loescheEntwurf(id);
    // Gesperrt sind die Eintraege, die der Server auf das Dokument gesetzt hat (refs der Zeitpositionen).
    const gesperrt = new Set((Array.isArray(d.positionen) ? d.positionen : []).filter(istZeitPos).flatMap((p) => p.refs || [])).size;
    toast(uebersetze(art === 'rechnung' ? 'Rechnung erstellt' : 'Angebot erstellt') + ': ' + d.nr + ' · ' + eur(d.brutto_eur) +
      (gesperrt ? ' · ' + anzahl(gesperrt, 'Eintrag', 'Einträge') + ' ' + uebersetze('gesperrt') : ''), 'ok');
    // Gesperrte Eintraege: Zeiterfassung, Live und Hub nachladen.
    if (mitZeit) zeitNachAenderung();
    const fehlt = Array.isArray(d.erechnung_fehlt) ? d.erechnung_fehlt : [];
    if (fehlt.length) toast(uebersetze('Als E-Rechnung noch nicht exportierbar, es fehlen:') + ' ' + fehlt.join(', '), 'err');
    ladeBelege();
    ladeSummary();
  } catch (e) {
    console.error('Nach dem Erstellen:', e);
  }
});

aktion('ed-vorschau-neu', () => planeVorschau(0));

registriere('beleg', { zeichne: zeichneEditor });
