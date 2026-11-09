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
  'Zeiteinträge nicht geladen — „Manuelle Zeit“ öffnen lädt sie neu.': 'Time entries not loaded — opening “Manual time” reloads them.',
  'offene Stunden liegen in bereits berechneten Tagen — Zeitmodell oder Einlesen geändert?': 'open hours fall on days already billed — time model or import changed?',
  '{liste} steht schon auf einer Rechnung. Nur dazunehmen, wenn im Leistungszeitraum neue Arbeit liegt — sonst wird sie doppelt berechnet.': '{liste} is already on an invoice. Only add it if there is new work in the service period — otherwise it is billed twice.', 'Empfänger vorgeschlagen': 'Recipient suggested',
  'Das Projekt ist keinem Kunden zugeordnet — unter Kontakte → Projekte & Sätze nachtragen.': 'The project is not assigned to a customer — add it under Contacts → Projects & rates.',
  'Die Arbeit beginnt am oder vor dem Starttag — frühere Anteile sind nicht enthalten.': 'Work starts on or before the first day — earlier parts are not included.',
  'Ohne Kundenzuordnung: {liste}. Diese Arbeit lässt sich abrechnen, folgt aber keiner Kundenauswahl — unter Kontakte → Projekte & Sätze das Projekt beim Kunden eintragen.': 'No customer assigned: {liste}. This work can be invoiced but follows no customer selection — assign the project to the customer under Contacts → Projects & rates.',
  'Bei {liste} beginnt die Arbeit am oder vor dem {tag}. Enthalten ist nur der Anteil ab diesem Tag — Leistungszeitraum weiter zurücklegen, wenn frühere Arbeit mit abgerechnet werden soll.': 'For {liste}, work starts on or before {tag}. Only the part from that day is included — move the service period back if earlier work should be invoiced too.',
  'Neue Rechnung': 'New invoice', 'Neues Angebot': 'New quote', 'Belegart': 'Document type',
  'Kontakt nicht vorbelegt — bitte im Formular wählen': 'Contact not prefilled — please pick it in the form',
  'Lead nicht vorbelegt — bitte im Formular wählen': 'Lead not prefilled — please pick it in the form', 'Leads (offen)': 'Leads (open)',
  'Lead ist nicht mehr offen — Empfänger bitte neu wählen': 'Lead is no longer open — please pick the recipient again',
  'Leads nicht geladen — Lead bitte im Formular wählen': 'Leads not loaded — please pick the lead in the form',
  'Rechnungen gehen nur an Kunden — Lead entfernt, Empfänger bleibt als Freitext': 'Invoices go to customers only — lead removed, recipient kept as free text',
  'Nummer beim Erstellen': 'Number on creation', 'ENTWURF': 'DRAFT',
  'Formular': 'Form', 'Vorschau': 'Preview', 'Ansicht im Editor': 'Editor view',
  'Erstellung abbrechen?': 'Cancel creation?', 'Beleg wird gerade erstellt …': 'Document is being created …',
  'Der Entwurf konnte nicht gespeichert werden (Browser-Speicher voll oder gesperrt). Beim Verwerfen geht der Beleg verloren.': 'The draft could not be saved (browser storage full or blocked). Discarding loses the document.',
  'Der Entwurf konnte nicht gespeichert werden — Browser-Speicher voll oder gesperrt.': 'The draft could not be saved — browser storage full or blocked.', 'Als Entwurf behalten': 'Keep as draft', 'Weiter bearbeiten': 'Keep editing',
  'Der Beleg hat Inhalt. Als Entwurf bleibt er in diesem Browser erhalten und lässt sich später fortsetzen.': 'The document has content. As a draft it stays in this browser and can be continued later.',
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
  // Projektkonto und Teilmenge (Block B)
  'offen {offen} h von {geleistet} h geleistet': '{offen} h open of {geleistet} h worked',
  '{h} h mehr berechnet als geleistet': '{h} h billed beyond the time worked',
  'berechnet {z} h · bleiben offen {r} h': 'billing {z} h · {r} h stay open',
  ' · davon Kulanz {k} h': ' · of which goodwill {k} h',
  'Leistungszeitraum auf der Rechnung: {von} – {bis}, wegen Positionen außerhalb des gewählten Zeitraums': 'Service period on the invoice: {von} – {bis}, because of items outside the selected period',
  'Rest als Kulanz': 'Rest as goodwill', 'Einheit': 'Unit', 'Projektstunden': 'Project hours',
  '{name} hat nichts Offenes bis {tag}': '{name} has nothing open up to {tag}', 'Vorbelegung für {name} fehlt, Auswertung nicht geladen. Leer heißt alles Offene.': 'No pre-fill for {name}, analysis not loaded. Empty means everything open.',
  'Offene Stunden ohne Vorgang, auch aus früheren Zeiträumen': 'Open hours without a job, including earlier periods', 'Keine offenen Projektstunden.': 'No open project hours.',
  'Prozent vom Offenen': 'Percent of the open hours', 'Betrag in Euro': 'Amount in euros',
  'Menge eines Projekts: Zahl über 0 (Prozent höchstens 100)': 'Project quantity: a number above 0 (percent at most 100)',
  'Manuelle Zeit eines Projekts läuft über die Projektzeile — aus „Manuelle Zeit“ entfernt:': 'Manual time of a project goes through the project line — removed from “Manual time”:',
  'Die Zahl legt fest, wie viel dieser Rechnung zugeschrieben wird: Stunden, Prozent der noch offenen Stunden oder ein Eurobetrag. Leer heißt alles Offene. Der Server rundet auf 0,01 Stunden ab und begrenzt auf das Offene. Was übrig bleibt, wird auf einer späteren Rechnung abgerechnet — oder hier als Kulanz (0 €) sichtbar gemacht.': 'The number sets how much goes on this invoice: hours, percent of the open hours or an amount in euros. Empty means everything open. The server rounds down to 0.01 hours and caps at what is open. What is left is billed on a later invoice — or shown here as goodwill (€0).',
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
  quelle: null,          // offene Schublade: 'vorgaenge' | 'projekte' | 'zeit' | 'vorlagen'
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
  return { art, kontaktId: null, leadId: null, name: '', anschrift: '', bestellnummer: '', frist: '', from: z.von, to: z.bis, tickets: [], projekte: [], posten: [],
    zeit: { ids: [], gruppierung: 'taetigkeit' } };
}
// Aus Entwurf oder Adresse: nur bekannte Felder in fester Form.
function belegAus(d, art) {
  const s = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const liste = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x && x.length <= 200).slice(0, 200) : []);
  const b = leererBeleg(art);
  if (!d || typeof d !== 'object') return b;
  b.kontaktId = Number.isInteger(d.kontaktId) && d.kontaktId > 0 ? d.kontaktId : null;
  // Lead (C12) nur auf Angeboten und nie neben einem Kunden.
  b.leadId = art === 'angebot' && !b.kontaktId && Number.isInteger(d.leadId) && d.leadId > 0 ? d.leadId : null;
  b.name = s(d.name, 200); b.anschrift = s(d.anschrift, 800); b.bestellnummer = s(d.bestellnummer, 60); b.frist = s(d.frist, 4);
  if (IST_TAG.test(d.from) && IST_TAG.test(d.to)) { b.from = d.from; b.to = d.to; }
  b.tickets = liste(d.tickets);
  // Projekte: alte Entwuerfe und Adressen kennen nur den Namen, neue tragen Wunsch (Einheit h/p/e, Zahl als Text) und Kulanz-Rest.
  const projekt = (v) => {
    const o = typeof v === 'string' ? { name: v } : v && typeof v === 'object' ? v : null;
    if (!o || typeof o.name !== 'string' || !o.name || o.name.length > 200) return null;
    return { name: o.name, einheit: ['h', 'p', 'e'].includes(o.einheit) ? o.einheit : 'h', wert: s(o.wert, 20), kulanzRest: o.kulanzRest === true };
  };
  const projekte = art === 'rechnung' && Array.isArray(d.projekte) ? d.projekte.map(projekt).filter(Boolean) : [];
  b.projekte = projekte.filter((p, i) => projekte.findIndex((x) => x.name === p.name) === i).slice(0, 200);
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
// Nur Zeilen mit refs sind Eintraege aus der Zeiterfassung. Die Kulanz-Zeile einer Projektposition hat typ kulanz, aber keine refs.
const zeitPositionenAus = (V) => (V ? V.positionen.filter((p) => istZeitPos(p) && Array.isArray(p.refs)) : null);
const istRechnung = () => ed.b.art === 'rechnung';

// Zahl aus einem Feld: leer = fehlt (undefined), sonst betragAus (deutsch/englisch).
const zahlAus = (t) => (String(t).trim() === '' ? undefined : betragAus(t));

function postenFuerServer(p) {
  const bezeichnung = p.bezeichnung.trim();
  if (p.typ === 'pauschal') return { bezeichnung, typ: 'pauschal', betrag_eur: zahlAus(p.preis) ?? NaN };
  const rabatt = zahlAus(p.rabatt);
  return { bezeichnung, stunden: zahlAus(p.menge) ?? NaN, satz: zahlAus(p.preis), rabatt_prozent: rabatt === undefined ? 0 : rabatt };
}
// Projektposition: die Zahl ist nur der Wunsch; was daraus wird, rechnet der Server (Vorschau, projekt_zeilen).
const PROJEKT_FELD = { h: 'stunden', p: 'prozent', e: 'betrag' };
const projektFuerServer = (p) => ({ name: p.name, [PROJEKT_FELD[p.einheit]]: zahlAus(p.wert), kulanzRest: p.kulanzRest || undefined });
// Leer = alles Offene. Sonst muss es eine Zahl ueber 0 sein; die Obergrenzen haelt der Server.
const projektWertFalsch = (p) => { const w = zahlAus(p.wert); return w !== undefined && !(w > 0); };
const fristZahl = () => (ed.b.frist.trim() === '' ? undefined : Number(ed.b.frist.trim()));

function nutzlast() {
  const b = ed.b;
  const anschrift = b.anschrift.split('\n').map((z) => z.trim()).filter(Boolean);
  const frist = fristZahl();
  const basis = { kontaktId: b.kontaktId || undefined, posten: b.posten.map(postenFuerServer) };
  if (istRechnung()) {
    return { ...basis, empfaenger: { name: b.name.trim(), anschrift, bestellnummer: b.bestellnummer.trim() },
      from: b.from, to: b.to, tickets: b.tickets, projekte: b.projekte.map(projektFuerServer), zahlungszielTage: frist,
      ...(b.zeit.ids.length ? { eintraege: b.zeit.ids, gruppierung: b.zeit.gruppierung } : {}) };
  }
  return { ...basis, leadId: b.leadId || undefined, empfaenger: { name: b.name.trim(), anschrift }, gueltigTage: frist,
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
  if (b.projekte.some(projektWertFalsch)) aus.push({ t: 'Menge eines Projekts: Zahl über 0 (Prozent höchstens 100)', b: true });
  if (zeitPruefungFehlt(b, ed.zeitDaten)) aus.push({ t: 'Zeiteinträge nicht geladen — „Manuelle Zeit“ öffnen lädt sie neu.', b: true });
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
    quellDaten: { schluessel: null, d: null, fehler: null }, vorlagen: null, zeitDaten: null, zeitVorwahl: false, kontaktWunsch: null, leadWunsch: null, vorbelegen: null });
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
  // Ein Projekt je Adresse (kein Komma-Trennen: ein Komma im Namen buchte sonst still auf ein anderes Projekt).
  const projekt = p.get('projekt');
  if (projekt) vorgabe.projekte = [{ name: projekt, einheit: 'h', wert: '', kulanzRest: false }];
  ed.b = belegAus({ ...leererBeleg(art), ...vorgabe }, art);
  // Stunden erst aus der Antwort fuer from|to (belegeProjektVor), nicht aus state.summary: die gilt fuer einen anderen Zeitraum.
  if (ed.b.projekte.length) { ed.vorbelegen = projekt; ladeQuellDaten(); }
  if (p.get('quelle') === 'vorgaenge') ed.quelle = 'vorgaenge';
  else if (p.get('quelle') === 'projekte' && art === 'rechnung') ed.quelle = 'projekte';
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
  // Aus der Lead-Akte (#/beleg/neu?art=angebot&lead=ID): wie oben, nur fuer Angebote.
  if (art === 'angebot' && p.get('lead')) {
    const l = offeneLeads().find((x) => String(x.id) === p.get('lead'));
    if (l) fuelleLead(l);
    else if (state.leads) toast(uebersetze('Lead nicht vorbelegt — bitte im Formular wählen'), 'err');
    else ed.leadWunsch = p.get('lead');
  }
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

// Leads (C12) stehen nur auf Angeboten zur Wahl; Rechnungen gehen immer an Kunden.
const offeneLeads = () => (state.leads || []).filter((l) => l.status === 'offen');
const edLeadName = (l) => kontaktName(l) === '–' ? l.email || l.lead_nr : kontaktName(l);
const kontaktWahlen = () => (state.kontakte || []).length + (istRechnung() ? 0 : offeneLeads().length);
// Kontakt-Suchfeld (kontaktSuche in bauteile.js): Kunden, bei Angeboten auch offene Leads.
const kontaktSucheWert = () => (ed.b.kontaktId ? String(ed.b.kontaktId) : ed.b.leadId && !istRechnung() ? 'L:' + ed.b.leadId : '');
function kontaktSucheHtml() {
  const leads = istRechnung() ? [] : offeneLeads();
  const wert = kontaktSucheWert();
  return kontaktSuche({
    attr: ' id="ed-kontakt"', leerText: '— frei eingeben —', label: 'Kontakt', wert,
    gruppen: [
      { gruppe: 'Kunden', liste: (state.kontakte || []).map((k) => ({ wert: String(k.id), text: kontaktName(k) + (k.kundennummer ? ' · ' + k.kundennummer : ''), such: [kontaktName(k), k.kundennummer, k.email].filter(Boolean).join(' ') })) },
      { gruppe: 'Leads (offen)', liste: leads.map((l) => ({ wert: 'L:' + l.id, text: edLeadName(l) + ' · ' + l.lead_nr, such: [edLeadName(l), l.lead_nr, l.email].filter(Boolean).join(' ') })) },
    ].filter((g) => g.liste.length),
  });
}
// Nachkommende Kontakte/Leads: das Suchfeld neu bauen und das neue versteckte Feld liefern.
function baueKontaktSuche(feld) {
  feld.closest('.ksuche').outerHTML = kontaktSucheHtml();
  return document.getElementById('ed-kontakt');
}

function editorHtml() {
  const b = ed.b, R = istRechnung();
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
      '<button type="button" class="knopf ed-weg" data-aktion="ed-verwerfen">' + esc(uebersetze('Entwurf verwerfen')) + '</button>' +
      '<button type="button" class="knopf ed-zu" data-aktion="ed-zu" title="' + esc(uebersetze('Esc schließt, der Entwurf bleibt')) + '">' + esc(uebersetze('Schließen ×')) + '<span class="taste" aria-hidden="true">Esc</span></button>' +
    '</div>' +
    '<div class="ed-koerper">' +
      '<div class="ed-form">' + fortsetzen +
        '<div class="karte ed-felder">' +
          feld('Kontakt', kontaktSucheHtml()) +
          feld('Empfänger', '<input id="ed-name" value="' + esc(b.name) + '" maxlength="200" placeholder="' + esc(uebersetze('Name oder Firma')) + '" autocomplete="off">') +
          feld('Anschrift', '<textarea id="ed-anschrift" rows="3" maxlength="800" placeholder="' + esc(uebersetze('Straße Nr.\nPLZ Ort')) + '">' + esc(b.anschrift) + '</textarea>', true) +
          '<div class="feld"><span class="label">' + esc(uebersetze('Datum')) + '</span><span class="ed-wert faint">' + esc(uebersetze('heute, beim Erstellen gesetzt')) + '</span></div>' +
          feld(R ? 'Zahlungsziel' : 'Gültig', '<span class="ed-tage"><input id="ed-frist" inputmode="numeric" maxlength="3" value="' + esc(b.frist) + '" placeholder="' +
            esc(uebersetze(R ? 'Standard' : '30')) + '"><span>' + esc(uebersetze('Tage')) + '</span><span class="faint" id="ed-frist-bis"></span></span>') +
          '<div class="feld breit"><span class="label" id="ed-zeitraum-l">' + esc(uebersetze(R ? 'Leistungszeitraum' : 'Zeitraum der Vorgänge')) + '</span>' +
            '<span class="ed-zeitraum" role="group" aria-labelledby="ed-zeitraum-l"><input type="date" id="ed-von" value="' + esc(b.from) + '" aria-label="' + esc(uebersetze('von')) + '">' +
            '<span class="faint">–</span><input type="date" id="ed-bis" value="' + esc(b.to) + '" aria-label="' + esc(uebersetze('bis')) + '"></span>' +
            '<span class="ed-kopfzeitraum" id="ed-kopfzeitraum" role="status" hidden></span></div>' +
          (R ? feld('Bestellnummer (optional)', '<input id="ed-bestell" maxlength="60" value="' + esc(b.bestellnummer) + '" autocomplete="off">') : '') +
        '</div>' +
        '<div class="karte ed-positionen">' +
          '<div class="karten-kopf"><h3 class="titel-klein">' + esc(uebersetze('Positionen')) + '</h3></div>' +
          '<div id="ed-zeilen"></div>' +
          '<div class="ed-hinzu"><span class="faint">' + esc(uebersetze('+ hinzufügen aus')) + '</span>' +
            '<button type="button" class="chip" data-aktion="ed-quelle" data-wert="vorgaenge" aria-pressed="' + (ed.quelle === 'vorgaenge') + '">' + esc(uebersetze('Vorgänge')) + '</button>' +
            (R ? '<button type="button" class="chip" data-aktion="ed-quelle" data-wert="projekte" aria-pressed="' + (ed.quelle === 'projekte') + '">' + esc(uebersetze('Projektstunden')) + '</button>' : '') +
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
    ...b.projekte.map((p, i) => ({ k: p.name, art: 'p', name: p.name, unter: 'Projektstunden', i })),
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
      '<button type="button" class="mini-knopf" data-aktion="ed-quelle-weg" data-wert="' + esc(q.art + ':' + q.k) + '" aria-label="' + esc(uebersetze('Position entfernen') + ' ' + q.name) + '">×</button>' +
      (q.art === 'p' ? projektZeile(q.i, V) : '') + '</div>';
  };
  // Manuelle Zeit: Positionen so, wie der Server sie bildet (je Taetigkeit oder je Eintrag, Kulanz 0,00).
  // Vor der ersten Vorschau eine Sammelzeile, damit die Auswahl nicht unsichtbar ist.
  const zeitPos = zeitPositionenAus(V);
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
  // Das Neuzeichnen nach der Vorschau darf eine laufende Eingabe nicht aus dem Feld werfen.
  const af = document.activeElement;
  const fokus = af && el.contains(af) && fokusSelektor(af) ? { k: fokusSelektor(af), s: af.selectionStart, e: af.selectionEnd } : null;
  el.innerHTML = leerText
    ? '<div class="ed-leer">' + esc(uebersetze('Noch keine Position. Wähle unten eine Quelle — Vorgänge übernehmen Zeit und Satz aus der Auswertung.')) + '</div>'
    : '<div class="ed-zeile kopf" aria-hidden="true"><span></span><span>' + esc(uebersetze('Leistung')) + '</span><span class="r">' + esc(uebersetze('Std.')) +
        '</span><span class="r">' + esc(uebersetze('Preis €')) + '</span><span class="r">' + esc(uebersetze('Rab. %')) + '</span><span class="r">' + esc(uebersetze('Betrag')) + '</span><span></span></div>' +
      quelle.map(quellZeile).join('') + zeitHtml + b.posten.map(freiZeile).join('');
  const neu = fokus && el.querySelector(fokus.k);
  if (neu) { neu.focus(); try { neu.setSelectionRange(fokus.s, fokus.e); } catch { /* Feldtyp ohne Auswahl */ } }
  aktualisiereBetraege();
}
// Merkmal eines Elements, an dem es nach dem Neuzeichnen wiedergefunden wird: name, sonst Aktion und Wert (Knoepfe).
const esk = (t) => String(t).replace(/(["\\])/g, '\\$1');
function fokusSelektor(x) {
  if (x.name) return '[name="' + esk(x.name) + '"]';
  return x.dataset && x.dataset.aktion ? '[data-aktion="' + esk(x.dataset.aktion) + '"][data-wert="' + esk(x.dataset.wert || '') + '"]' : null;
}
// Projekte der Auswahl: die Projektzeilen des Zeitraums, dazu jedes Konto mit offenen Stunden (R12).
const projektNamen = (d, konten) => {
  const imZeitraum = (d.ohne_ticket || []).filter((t) => (t.art || 'projekt') === 'projekt').map((t) => t.gruppe);
  return [...new Set([...imZeitraum, ...Object.keys(konten).filter((n) => konten[n].offen_h > 0)])];
};
// Schublade Projektstunden: nur was offen ist, zu viel berechnet oder schon im Beleg steht;
// Projekte des gewaehlten Kontakts zuerst, dann nach offenen Stunden.
const projektWahl = (eintraege, kontaktId) => {
  const eigen = (e) => (kontaktId && e.kid === kontaktId ? 1 : 0);
  const offen = (e) => (e.konto ? e.konto.offen_h : 0);
  return eintraege.filter((e) => e.drin || offen(e) > 0 || (e.konto && e.konto.ueber_h > 0))
    .sort((x, y) => eigen(y) - eigen(x) || offen(y) - offen(x));
};
// Nur eigene Schluessel: ein Projekt namens "constructor" faende sonst eine geerbte Funktion.
const kontoAus = (konten, name) => (konten && Object.hasOwn(konten, name) ? konten[name] : null);
// Konto des Projekts aus der Summary des gewaehlten Zeitraums (null: noch nicht geladen oder unbekannt).
function projektKontoVon(name) {
  const Q = ed.quellDaten, kt = Q.d && Q.schluessel === ed.b.from + '|' + ed.b.to && Q.d.projekt_konto;
  return kontoAus(kt, name);
}
// Wunschzeile unter einer Projektposition: Zahl mit Einheit h | % | €, Rest als Kulanz.
// Gerechnet wird hier nichts: "berechnet … bleiben offen …" liefert der Server (projekt_zeilen der Vorschau).
function projektZeile(i, V) {
  const p = ed.b.projekte[i];
  const k = projektKontoVon(p.name);
  const z = V && Array.isArray(V.projekt_zeilen) ? V.projekt_zeilen.find((x) => x.projekt === p.name) : null;
  const wort = { h: 'Stunden', p: 'Prozent vom Offenen', e: 'Betrag in Euro' }[p.einheit];
  const platz = p.einheit === 'h' && k ? nf2.format(k.offen_h) : p.einheit === 'p' ? '100' : '';
  const text = z
    ? fuelle('berechnet {z} h · bleiben offen {r} h', { z: nf2.format(z.berechnet_h), r: nf2.format(z.offen_h) }) +
      (z.kulanz_h > 0 ? fuelle(' · davon Kulanz {k} h', { k: nf2.format(z.kulanz_h) }) : '')
    : V ? '' : '…';
  return '<div class="ed-pwunsch">' +
    '<input name="pw' + i + '" data-pi="' + i + '" class="zahl" inputmode="decimal" value="' + esc(p.wert) + '" placeholder="' + esc(platz) + '"' +
      ' aria-label="' + esc(uebersetze(wort) + ' · ' + p.name) + '"' + (projektWertFalsch(p) ? ' aria-invalid="true"' : '') + '>' +
    segment('ed-peinheit', [[i + ':h', 'h'], [i + ':p', '%'], [i + ':e', '€']], i + ':' + p.einheit, uebersetze('Einheit') + ' · ' + p.name) +
    '<label class="ed-kulanz"><input type="checkbox" name="pk' + i + '" data-pk="' + i + '"' + (p.kulanzRest ? ' checked' : '') + '><span>' + esc(uebersetze('Rest als Kulanz')) + '</span></label>' +
    (i === 0 ? infoI('ed-projekt') : '') +
    '<span class="ed-ptext" aria-live="polite">' + esc(text) + '</span>' +
    (i === 0 ? infoText('ed-projekt', 'Die Zahl legt fest, wie viel dieser Rechnung zugeschrieben wird: Stunden, Prozent der noch offenen Stunden oder ein Eurobetrag. Leer heißt alles Offene. Der Server rundet auf 0,01 Stunden ab und begrenzt auf das Offene. Was übrig bleibt, wird auf einer späteren Rechnung abgerechnet — oder hier als Kulanz (0 €) sichtbar gemacht.') : '') +
  '</div>';
}
// Entwuerfe aus der Zeit vor dem Projektkonto koennen manuelle Projekt-Eintraege in zeit.ids tragen. Sie laufen jetzt
// ueber die Projektzeile; blieben sie stehen, scheiterte die Rechnung erst beim Stellen oder mit einem irrefuehrenden
// "nur noch x h offen".
function zeitIdsOhneProjekt(ids, eintraege) {
  const projekt = new Set(eintraege.filter((e) => e.ziel_art === 'projekt').map((e) => e.id));
  return { ids: ids.filter((id) => !projekt.has(id)), weg: ids.filter((id) => projekt.has(id)) };
}
// Projekte und manuelle Zeit zusammen, aber die Eintraege fehlen: bereinigeZeitIds konnte nicht pruefen, ob eine Id
// zu einem Projekt gehoert. Dann wird nicht gestellt.
function zeitPruefungFehlt(b, zeitDaten) {
  return b.projekte.length > 0 && b.zeit.ids.length > 0 && !(zeitDaten && zeitDaten.d);
}
function bereinigeZeitIds() {
  const b = ed.b;
  if (!b || !b.zeit.ids.length || !ed.zeitDaten || !ed.zeitDaten.d) return;
  const { ids, weg } = zeitIdsOhneProjekt(b.zeit.ids, ed.zeitDaten.d);
  if (!weg.length) return;
  const namen = [...new Set(ed.zeitDaten.d.filter((e) => weg.includes(e.id)).map((e) => e.ziel_schluessel))];
  b.zeit.ids = ids;
  toast(uebersetze('Manuelle Zeit eines Projekts läuft über die Projektzeile — aus „Manuelle Zeit“ entfernt:') + ' ' + anzahl(weg.length, 'Eintrag', 'Einträge') + ' (' + namen.join(', ') + ')', 'err');
  zeichneZeilen();
  zeichneZeitZahl();
  geaendert();
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
  }).then(() => { belegeProjektVor(Q); zeichneSchublade(); });
}
// Projekt aus der Adresse: Stunden aus dem Konto der Quelle. Nichts offen oder unbekannt: keine Zeile, denn leer hiesse
// still "alles Offene". Eingabe waehrend des Ladens bleibt stehen.
function belegeProjektVor(Q) {
  const name = ed.vorbelegen;
  if (!name || !ed.b || Q !== ed.quellDaten || Q.laedt) return;
  ed.vorbelegen = null;
  const i = ed.b.projekte.findIndex((p) => p.name === name);
  if (i < 0) return;
  if (!Q.d) { toast(fuelle('Vorbelegung für {name} fehlt, Auswertung nicht geladen. Leer heißt alles Offene.', { name }), 'err'); return; }
  const k = kontoAus(Q.d.projekt_konto, name), p = ed.b.projekte[i];
  if (k && k.offen_h > 0) {
    if (p.wert || p.einheit !== 'h') return;
    p.wert = nf2.format(k.offen_h);
  } else {
    ed.b.projekte.splice(i, 1);
    toast(fuelle('{name} hat nichts Offenes bis {tag}', { name, tag: datum(ed.b.to) }), 'err');
  }
  zeichneZeilen();
  geaendert();
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
    .then(() => { bereinigeZeitIds(); zeichneSchublade(); zeichneZeitZahl(); zeichneFuss(); });
}
// Manuelle Projekt-Eintraege stecken im Projektkonto und laufen ueber die Projektzeile, nicht einzeln.
const zeitOffen = () => ed.zeitDaten.d.filter((e) => e.abrechenbar && e.ziel_art !== 'intern' && e.ziel_art !== 'projekt');
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
  } else if (ed.quelle === 'vorgaenge' || ed.quelle === 'projekte') {
    ladeQuellDaten();
    const Q = ed.quellDaten;
    const P = ed.quelle === 'projekte';
    titel = P ? 'Projektstunden' : 'Vorgänge im Leistungszeitraum';
    hinweis = P ? 'Offene Stunden ohne Vorgang, auch aus früheren Zeiträumen' : 'Zeit und Satz aus der Auswertung, Rabatt aus dem Projekt';
    // Nur der Stand des aktuellen Zeitraums ist waehlbar, nie ein alter.
    const aktuell = Q.schluessel === b.from + '|' + b.to;
    fehler = !IST_TAG.test(b.from) || !IST_TAG.test(b.to) ? uebersetze('Leistungszeitraum fehlt.') : aktuell ? Q.fehler : null;
    if (Q.d && aktuell) {
      const abr = Q.d.abrechnung || {};
      const konten = Q.d.projekt_konto || {};
      // Kunde je Projekt (Kontakte → Projekte & Sätze). Wie in der bisherigen
      // Ansicht: der gewaehlte Kontakt bestimmt die Vorwahl, fremde und
      // unzugeordnete Vorgaenge bleiben sichtbar, nur abgesetzt.
      const pk = Q.d.projekt_kontakt || {};
      const kundeVon = (projekt) => (Object.hasOwn(pk, projekt) ? pk[projekt].id : null);
      // Begann die Arbeit am oder vor dem Starttag, fehlt womoeglich ein frueherer Teil.
      const schnitt = (t) => !!t.first_day && t.first_day <= b.from;
      // Betrag = Claude-Stunden x Satz, wie ihn die Position bucht. Manuelle
      // Zeit ist eine eigene Quelle und steht hier nicht mit drin.
      eintraege = P ? [] : (Q.d.tickets || []).map((t) => ({ id: 't:' + t.ticket, l: t.ticket, t: t.project || '', h: t.active_hours, eur: t.arbeitswert_claude ?? t.arbeitswert,
          drin: b.tickets.includes(t.ticket), abr: abr[t.ticket] ? abr[t.ticket].nummern : null, kid: kundeVon(t.project), schnitt: schnitt(t) }));
      // Nur Projektzeilen: Kundenzeilen (nur manuelle Zeit) nimmt der Server nicht als Projekt an.
      // Projekte tragen ihr Konto (Server): offen von geleistet, in welchen Rechnungen schon berechnet. Kein h/eur
      // der Zeile: das waere nur die Claude-Zeit des Zeitraums, nicht das, was noch offen ist.
      // Dazu Projekte mit offenen Stunden ohne Zeile im Zeitraum (Rest einer Teilrechnung): der Server nennt sie in projekt_konto.
      if (P && istRechnung()) eintraege = projektWahl(projektNamen(Q.d, konten).map((name) => ({ id: 'p:' + name, l: name, t: Object.hasOwn(pk, name) ? pk[name].firma : '',
        drin: b.projekte.some((p) => p.name === name), abr: null, kid: kundeVon(name), schnitt: false, konto: kontoAus(konten, name) })), b.kontaktId);   // schnitt: das Konto zaehlt frueheres mit (FIFO)
      // Neue Vorwahl nur, wenn sich Kontakt oder Zeitraum aendern — eigene Haken
      // bleiben sonst beim Neuzeichnen stehen.
      const vorwahl = ed.quelle + '|' + b.kontaktId + '|' + Q.schluessel;
      // Bereits abgerechnete Vorgaenge nicht vorhaken: ihre Arbeit stuende sonst doppelt
      // auf einer Rechnung. Sie bleiben waehlbar (neue Arbeit in einem spaeteren Zeitraum).
      if (ed.vorwahl !== vorwahl && (b.kontaktId || ed.vorwahl)) {
        ed.auswahl.clear();
        // Ein Projekt nur mit offenen Stunden (Konto); ein Vorgang wie bisher nur, wenn noch nichts gestellt ist.
        if (b.kontaktId) for (const e of eintraege) if (!e.drin && !e.abr && e.kid === b.kontaktId && (!e.id.startsWith('p:') || (e.konto && e.konto.offen_h > 0))) ed.auswahl.add(e.id);
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
  const zeitQuelle = ed.quelle === 'vorgaenge' || ed.quelle === 'projekte';
  const fremd = (e) => zeitQuelle && b.kontaktId && e.kid !== b.kontaktId;
  const zeile = (e) => '<label class="ed-wahl' + (e.drin ? ' drin' : '') + (fremd(e) || e.aussen ? ' fremd' : '') + '"><input type="checkbox" name="wahl" data-wahl="' + esc(e.id) + '"' +
      (e.drin ? ' disabled checked' : e.aussen ? ' disabled' : ed.auswahl.has(e.id) ? ' checked' : '') + '>' +
    '<span class="mono l">' + esc(e.l) + '</span><span class="t">' + esc(e.t) +
      (e.h != null ? '<span class="faint">' + esc(hrs(e.h) + ' · ' + eur(e.eur)) + '</span>' : '') +
      (e.konto ? '<span class="faint">' + esc(fuelle('offen {offen} h von {geleistet} h geleistet', { offen: nf2.format(e.konto.offen_h), geleistet: nf2.format(e.konto.geleistet_h) })) + '</span>' : '') +
      (e.konto && e.konto.hinweis ? '<span class="faint">' + esc(uebersetze(e.konto.hinweis)) + '</span>' : '') +
      (e.unter ? '<span class="faint">' + esc(e.unter) + '</span>' : '') + '</span>' +
    (e.konto && e.konto.ueber_h > 0 ? '<span class="pille warn">' + esc(fuelle('{h} h mehr berechnet als geleistet', { h: nf2.format(e.konto.ueber_h) })) + '</span>' : '') +
    (e.konto && e.konto.nummern.length ? '<span class="pille st-abgerechnet st" title="' + esc(e.konto.nummern.join(', ')) + '">' + esc(uebersetze('abgerechnet in') + ' ' + e.konto.nummern.join(', ')) + '</span>' : '') +
    (e.aussen ? '<span class="pille warn" title="' + esc(uebersetze('Leistungszeitraum oben erweitern, um ihn abzurechnen.')) + '">' + esc(uebersetze('außerhalb des Leistungszeitraums')) + '</span>' : '') +
    (zeitQuelle && !e.kid ? '<span class="pille warn" title="' + esc(uebersetze('Das Projekt ist keinem Kunden zugeordnet — unter Kontakte → Projekte & Sätze nachtragen.')) + '">' + esc(uebersetze('ohne Kunde')) + '</span>' : '') +
    (e.schnitt ? '<span class="pille warn" title="' + esc(uebersetze('Die Arbeit beginnt am oder vor dem Starttag — frühere Anteile sind nicht enthalten.')) + '">' + esc(uebersetze('angeschnitten')) + '</span>' : '') +
    (e.abr ? '<span class="pille st-abgerechnet st" title="' + esc(e.abr.join(', ')) + '">' + esc(uebersetze('abgerechnet in') + ' ' + e.abr.join(', ')) + '</span>' : '') +
    (e.drin ? '<span class="faint">' + esc(uebersetze('übernommen')) + '</span>' : '') + '</label>';
  el.innerHTML = '<div class="ed-schublade">' +
    '<div class="k"><span class="t"><b>' + esc(uebersetze(titel)) + '</b><span class="faint">' + esc(uebersetze(hinweis)) + '</span></span>' + kopfRechts + '</div>' +
    (fehler ? leer('liste', 'Nicht geladen', fehler) : !eintraege ? '<div class="leer">' + esc(uebersetze('lädt …')) + '</div>'
      : !eintraege.length ? (ed.quelle === 'zeit' && !b.kontaktId ? '' : '<span class="faint">' + esc(leerText || uebersetze(ed.quelle === 'vorgaenge' ? 'Nichts im Zeitraum.' : ed.quelle === 'projekte' ? 'Keine offenen Projektstunden.' : 'Noch keine Vorlage.')) + '</span>')
      : '<div class="ed-wahlen">' + eintraege.map(zeile).join('') + '</div>' + quellWarnungen(eintraege)) +
    '<div class="dialog-fuss"><button type="button" class="knopf klein" data-aktion="ed-quelle" data-wert="' + ed.quelle + '">' + esc(uebersetze('Schließen')) + '</button>' +
      '<button type="button" class="knopf klein' + (n ? ' primaer' : '') + '" data-aktion="ed-uebernehmen"' + (n ? '' : ' disabled') + '>' +
        esc(n ? n + ' ' + uebersetze('übernehmen') : uebersetze('Auswählen')) + '</button></div>' +
  '</div>';
}

// Unter der Liste, wie in der bisherigen Ansicht: was keiner Kundenauswahl
// folgt, und wo frueherer Aufwand fehlen kann. Beides kostet sonst still Geld.
function quellWarnungen(eintraege) {
  if (ed.quelle !== 'vorgaenge' && ed.quelle !== 'projekte') return '';
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
  if (b.posten.some((p) => !p.bezeichnung.trim() || postenFalsch(p).length) || b.projekte.some(projektWertFalsch)) return 'Vorschau wartet, bis jede Position eine Beschreibung und gültige Zahlen hat.';
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
  // Der Kopf der Rechnung kann weiter reichen als der gewaehlte Zeitraum (offene Stunden eines Projekts, entwurf() in rechnung.js).
  // Die Felder bleiben, was gewaehlt wurde; der Server sagt, was auf der Rechnung steht.
  const kopf = document.getElementById('ed-kopfzeitraum'), A = aktuelleVorschau();
  if (kopf) {
    const weicht = !!(A && A.leistung_von && (A.leistung_von !== ed.b.from || A.leistung_bis !== ed.b.to));
    kopf.hidden = !weicht;
    kopf.textContent = weicht ? fuelle('Leistungszeitraum auf der Rechnung: {von} – {bis}, wegen Positionen außerhalb des gewählten Zeitraums', { von: datum(A.leistung_von), bis: datum(A.leistung_bis) }) : '';
  }
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
  // Hinweise des Servers (z. B. "auf die offenen 8 h begrenzt"): Warnung, kein Stopp.
  for (const h of V && Array.isArray(V.hinweise) ? V.hinweise : []) liste.push({ t: h, b: false, roh: true });
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
      // Nur mit eingerichtetem Versandkonto (C11a); erstellt und oeffnet danach den E-Mail-Dialog.
      (mailBereit(zeichneFuss) ? '<button type="button" class="knopf" data-aktion="ed-senden"' + (blockiert ? ' disabled' : '') + '>' + esc(uebersetze('Erstellen & senden')) + '</button>' : '') +
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
  // Entwurf oder ?lead= mit einem inzwischen umgewandelten/verlorenen Lead: nicht unsichtbar weitertragen.
  if (ed.b.leadId && state.leads && !offeneLeads().some((l) => l.id === ed.b.leadId)) {
    ed.b.leadId = null;
    const sel = w.querySelector('#ed-kontakt');
    if (sel) kontaktSucheSetze(sel, '');
    speichereEntwurf();
    toast(uebersetze('Lead ist nicht mehr offen — Empfänger bitte neu wählen'), 'err');
  }
  // /api/leads beim ersten Laden gescheitert: der Wunsch loest sich sonst nie auf.
  if (ed.leadWunsch && !state.leads && state.fehler.leads) {
    ed.leadWunsch = null;
    toast(uebersetze('Leads nicht geladen — Lead bitte im Formular wählen'), 'err');
  }
  // Hintergrund-Nachladen (Summary 60 s, Belege 120 s) baut das Formular nicht
  // neu — sonst verloere die Eingabe Fokus und Cursor. Nur was von den Daten abhaengt.
  if (w.querySelector('#editor')) {
    // Direkt geladener Editor: die Kontakte kommen erst nach dem ersten Zeichnen.
    let sel = w.querySelector('#ed-kontakt');
    const ksW = sel && sel.closest('.ksuche');
    // Bei Fokus im Feld aufgeschoben; danach holt der Abgleich mit ed.b nach, was inzwischen gesetzt wurde.
    if (ksW && !ksW.contains(document.activeElement) && (ksW.querySelectorAll('[role="option"]').length !== kontaktWahlen() + 1 || sel.value !== kontaktSucheWert())) sel = baueKontaktSuche(sel);
    if (ed.leadWunsch && state.leads) {
      const l = offeneLeads().find((x) => String(x.id) === ed.leadWunsch);
      ed.leadWunsch = null;
      if (!l) toast(uebersetze('Lead nicht vorbelegt — bitte im Formular wählen'), 'err');
      else if (!ed.b.kontaktId && !ed.b.leadId && !ed.b.name.trim()) {
        fuelleLead(l);
        if (sel) { sel = baueKontaktSuche(sel); kontaktSucheSetze(sel, 'L:' + l.id); }
        document.getElementById('ed-name').value = ed.b.name;
        document.getElementById('ed-anschrift').value = ed.b.anschrift;
        geaendert();
      }
    }
    if (ed.kontaktWunsch && state.kontakte) {
      const k = state.kontakte.find((x) => String(x.id) === ed.kontaktWunsch);
      ed.kontaktWunsch = null;
      if (!k) toast(uebersetze('Kontakt nicht vorbelegt — bitte im Formular wählen'), 'err');
      else if (!ed.b.kontaktId && !ed.b.name.trim()) {
        fuelleKontakt(k);
        if (sel) kontaktSucheSetze(sel, String(k.id));
        document.getElementById('ed-name').value = ed.b.name;
        document.getElementById('ed-anschrift').value = ed.b.anschrift;
        geaendert();
        zeichneSchublade();
      }
    }
    zeichneFuss(); if (ed.quelle === 'vorgaenge' || ed.quelle === 'projekte') zeichneSchublade(); return;
  }
  w.innerHTML = editorHtml();
  zeichneLeiste(); zeichneKopf();   // Titel und aktiver Bereich folgen der Belegart
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
    if (t.id === 'ed-name' && (b.kontaktId || b.leadId)) { b.kontaktId = null; b.leadId = null; const sel = document.getElementById('ed-kontakt'); if (sel) kontaktSucheSetze(sel, ''); }
    // Neuer Zeitraum: die Vorgaenge der Schublade gelten fuer den alten.
    if ((t.id === 'ed-von' || t.id === 'ed-bis') && (ed.quelle === 'vorgaenge' || ed.quelle === 'projekte' || ed.quelle === 'zeit')) zeichneSchublade();
  } else if (t.dataset.pi && b.projekte[Number(t.dataset.pi)]) {
    const p = b.projekte[Number(t.dataset.pi)];
    p.wert = t.value;
    if (projektWertFalsch(p)) t.setAttribute('aria-invalid', 'true'); else t.removeAttribute('aria-invalid');
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
  ed.b.leadId = null;
  ed.b.name = kontaktName(k);
  ed.b.anschrift = [k.firma ? person : '', ...(k.anschrift || [])].filter(Boolean).join('\n');
}
function fuelleLead(l) {
  ed.b.leadId = l.id;
  ed.b.kontaktId = null;
  ed.b.name = edLeadName(l);
  ed.b.anschrift = [l.firma ? [l.vorname, l.nachname].filter(Boolean).join(' ') : '', ...(l.anschrift || [])].filter(Boolean).join('\n');
}
function wahl(e) {
  const t = e.target;
  if (t.id === 'ed-kontakt') {
    const k = (state.kontakte || []).find((x) => String(x.id) === t.value);
    const l = !istRechnung() && offeneLeads().find((x) => 'L:' + x.id === t.value);
    ed.b.kontaktId = k ? k.id : null;
    ed.b.leadId = null;
    if (l) {
      fuelleLead(l);
      document.getElementById('ed-name').value = ed.b.name;
      document.getElementById('ed-anschrift').value = ed.b.anschrift;
    } else if (k) {
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
  } else if (t.dataset.pk && ed.b.projekte[Number(t.dataset.pk)]) {
    ed.b.projekte[Number(t.dataset.pk)].kulanzRest = t.checked;
    geaendert();
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
    toast(uebersetze('Projekte ohne Vorgang gibt es nur auf Rechnungen — entfernt:') + ' ' + ed.b.projekte.map((p) => p.name).join(', '), 'err');
    ed.b.projekte = [];
  }
  if (art === 'angebot' && ed.b.zeit.ids.length) {
    toast(uebersetze('Manuelle Zeit gibt es nur auf Rechnungen — entfernt:') + ' ' + anzahl(ed.b.zeit.ids.length, 'Eintrag', 'Einträge'), 'err');
    ed.b.zeit.ids = [];
  }
  if (art === 'angebot' && (ed.quelle === 'zeit' || ed.quelle === 'projekte')) ed.quelle = null;
  // Rechnung immer an einen Kunden (C12): der Lead faellt heraus, Name und Anschrift bleiben als Freitext.
  if (art === 'rechnung' && ed.b.leadId) {
    toast(uebersetze('Rechnungen gehen nur an Kunden — Lead entfernt, Empfänger bleibt als Freitext'), 'err');
    ed.b.leadId = null;
  }
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
    else if (art === 'p' && istRechnung() && !b.projekte.some((p) => p.name === k) && b.projekte.length < 200) {
      // Vorbelegt mit dem, was der Server als offen meldet (Standard h); nichts selbst gerechnet.
      const kt = projektKontoVon(k);
      b.projekte.push({ name: k, einheit: 'h', wert: kt && kt.offen_h > 0 ? nf2.format(kt.offen_h) : '', kulanzRest: false });
    }
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
    if (sel) kontaktSucheSetze(sel, String(vorschlag.id));
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
// Einheit der Projektzahl: h (vorbelegt mit offen aus dem Konto), % oder € (leer = alles Offene). Die Zahl der alten Einheit passt nicht mehr.
aktion('ed-peinheit', (wert) => {
  const [i, einheit] = String(wert).split(':');
  const p = ed.b.projekte[Number(i)];
  if (!p || !PROJEKT_FELD[einheit] || p.einheit === einheit) return;
  const kt = projektKontoVon(p.name);
  p.einheit = einheit;
  p.wert = einheit === 'h' && kt && kt.offen_h > 0 ? nf2.format(kt.offen_h) : '';
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
  if (art === 'p') ed.b.projekte = ed.b.projekte.filter((x) => x.name !== k);
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
// Zustand des Editors abbauen (nach speichern oder loeschen); danach zeigt die Route nichts mehr an.
function raeumeEditorAuf() {
  clearTimeout(vorschauUhr);
  ed.vorschau.lauf++;
  ed.schluessel = null;
  ed.b = null;
}
// Editor verlassen: mit Entwurf (speichern) oder ohne (loeschen, mit Rueckgaengig). ziel leer = Liste der Belegart.
// ed.b ist danach null — damit bremst belegBremse bei diesen eigenen Wegen nie.
function verlasseEditor(verwerfen, ziel) {
  if (!verwerfen) speichereEntwurf();
  const weg = verwerfen && ed.id ? loescheEntwurf(ed.id) : null;
  const angebot = ed.b && ed.b.art === 'angebot';
  if (verwerfen) ed.id = null;
  raeumeEditorAuf();
  geheZu(ziel || (angebot ? 'angebote' : 'rechnungen'));
  if (weg) toast(uebersetze('Entwurf verworfen'), 'ok', { text: uebersetze('Rückgängig'), tu: () => stelleWiederHer(weg) });
}
aktion('ed-zu', () => verlasseEditor(false));
aktion('ed-verwerfen', () => verlasseEditor(true));

/* Rueckfrage beim Wegklicken (A2), Abfang VOR dem Adresswechsel — so entsteht kein Verlaufseintrag,
   der zurueckgesetzt werden muesste. Zwei Stellen rufen belegBremse(ziel): ein Klick auf einen
   App-Link (Capture-Phase, unten) und geheZu() in shell.js (Strg+K, Aktionen). Sie liefert true,
   wenn die Navigation nicht stattfinden soll: waehrend des Erstellens (Hinweis) oder mit Inhalt
   (Dialog; "Behalten"/"Verwerfen" navigieren danach normal). Ein Ziel in beleg und ein leerer
   Editor bremsen nicht. */
let abbruch = null;   // { ziel, grund } des offenen Dialogs
const belegHash = (h) => String(h || '').replace(/^#\/?/, '').split(/[/?]/)[0] === 'beleg';
function belegBremse(ziel) {
  if (!ed.b || route().name !== 'beleg' || belegHash(ziel)) return false;
  if (ed.sendet) { toast(uebersetze('Beleg wird gerade erstellt …'), 'err'); return true; }
  if (!hatInhalt(ed.b)) return false;
  speichereEntwurf();
  const kopf = (satz) => '<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Erstellung abbrechen?')) + '</h2><span class="faint">' + esc(uebersetze(satz)) + '</span></div></div>';
  const weiter = (primaer) => '<button type="button" class="knopf' + (primaer ? ' primaer" autofocus' : '"') + ' data-aktion="dialog-zu">' + esc(uebersetze('Weiter bearbeiten')) + '</button>';
  const weg = '<button type="button" class="knopf gefahr" data-aktion="ed-abbruch-verwerfen">' + esc(uebersetze('Verwerfen')) + '</button>';
  const grund = ed.speicherFehler
    ? dialog(kopf('Der Entwurf konnte nicht gespeichert werden (Browser-Speicher voll oder gesperrt). Beim Verwerfen geht der Beleg verloren.') +
        '<div class="dialog-fuss">' + weiter(true) + weg + '</div>', 'Erstellung abbrechen?', 480)
    : dialog(kopf('Der Beleg hat Inhalt. Als Entwurf bleibt er in diesem Browser erhalten und lässt sich später fortsetzen.') +
        '<div class="dialog-fuss">' + weiter(false) + weg +
        '<button type="button" class="knopf primaer" data-aktion="ed-abbruch-behalten" autofocus>' + esc(uebersetze('Als Entwurf behalten')) + '</button></div>', 'Erstellung abbrechen?', 480);
  abbruch = { ziel, grund };
  // Esc und Klick auf den Hintergrund schliessen den Dialog ohne Wahl ("Weiter bearbeiten"): das Ziel verfaellt.
  const mo = new MutationObserver(() => {
    if (grund.isConnected) return;
    if (abbruch && abbruch.grund === grund) abbruch = null;
    mo.disconnect();
  });
  mo.observe(document.body, { childList: true });
  return true;
}
const abbruchWeg = (verwerfen) => { const z = abbruch && abbruch.ziel; abbruch = null; schliesseDialog(); if (z && ed.b) verlasseEditor(verwerfen, z); };
aktion('ed-abbruch-behalten', () => abbruchWeg(false));
aktion('ed-abbruch-verwerfen', () => abbruchWeg(true));
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target !== '_self')) return;
    if (belegBremse(a.getAttribute('href'))) e.preventDefault();
  }, true);
}
/* Browser-Zurueck/-Vor (und von Hand geaenderte Adresse): der Wechsel ist schon passiert, es wird
   nicht gefragt. Entwurf sichern, Editor abbauen, durchlassen, Hinweis mit "Fortsetzen". Waehrend
   des Erstellens bleibt der Zustand stehen (kein neuer Entwurf), erstelleBeleg schliesst ab. */
function belegAbfang(e) {
  if (!ed.b || ed.sendet || !hatInhalt(ed.b) || !belegHash(new URL(e.oldURL).hash) || belegHash(location.hash)) return false;
  speichereEntwurf();
  const id = ed.id, fehler = ed.speicherFehler;
  raeumeEditorAuf();
  if (fehler || !id) toast(uebersetze('Der Entwurf konnte nicht gespeichert werden — Browser-Speicher voll oder gesperrt.'), 'err');
  else toast(uebersetze('Entwurf gespeichert'), 'ok', { text: uebersetze('Fortsetzen'), tu: () => geheZu('beleg/entwurf?id=' + id) });
  return false;
}
// Kein mitLauf: zeichneFuss() baut den Knopf waehrend des POST neu, ein
// frischer Knopf waere wieder klickbar. Das Flag ueberlebt das Neuzeichnen.
aktion('ed-erstellen', () => erstelleBeleg(false));
aktion('ed-senden', () => erstelleBeleg(true));
async function erstelleBeleg(senden) {
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
    // erwartetBrutto, erwartetStunden: gestellt wird nur, was die Vorschau zeigte (sonst 409).
    d = await sende(art === 'rechnung' ? '/api/rechnung' : '/api/angebot', { ...nutzlast(), erwartetBrutto: V.brutto_eur, erwartetStunden: V.stunden_summe });
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
  if (route().name === 'beleg') geheZu(art === 'rechnung' ? 'rechnungen' : 'angebote');   // nach Browser-Zurueck waehrend des Sendens nicht mehr
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
  if (senden) oeffneVersand(art, d.nr);
}

aktion('ed-vorschau-neu', () => planeVorschau(0));

registriere('beleg', { zeichne: zeichneEditor });
