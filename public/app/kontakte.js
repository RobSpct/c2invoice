'use strict';
/* Kontakte (Block 4c): Pipeline, Liste und Akte. Die Kennzahlen der Akte kommen
   fertig vom Server (kennzahlen je Kontakt aus rechnung.jeKontakt, R10); hier
   wird nur gefiltert, sortiert und beschriftet. Felder speichern einzeln beim
   Verlassen (Blur oder Enter); scheitert das, bleibt die Eingabe stehen und der
   Fehler steht am Feld. Die Satz-Tabelle unten teilen sich Akte und
   Einstellungen. */

Object.assign(EN, {
  'Mahnpause bis': 'Dunning pause until', 'keine Erinnerung und Mahnung bis einschließlich diesem Tag': 'no reminder or dunning up to and including this day',
  'Rundung Min': 'Rounding min', 'Rundung manueller Zeit · leer = Standard': 'Rounding of manual time · empty = default',
  'Kontakte': 'Contacts', 'Leads': 'Leads', 'Angebot offen': 'Quote open',
  'Kunden und offene Leads': 'Customers and open leads', 'Neu anlegen': 'Create new', 'Was legst du an?': 'What do you want to create?',
  'Eine Firma oder Person, der du Angebote und Rechnungen stellst.': 'A company or person you issue quotes and invoices to.',
  'Ein Interessent, noch ohne Kundennummer — mit Herkunft, bis er Kunde wird.': 'A prospect without a customer number yet — with its source, until it becomes a customer.',
  'Kunden': 'Customers', 'mit Kundennummer': 'with customer number', 'offen, noch kein Kunde': 'open, not a customer yet',
  'Firma, Person, E-Mail': 'Company, person, e-mail', 'Neuer Kontakt': 'New contact', 'Freitext aus der bisherigen Ansicht — unter Kontakte einem Kunden zuordnen': 'Free text from the previous view — assign to a customer under Contacts', 'Name': 'Name', 'Umsatz': 'Revenue',
  'Zuletzt': 'Recent', 'Sortierung': 'Sorting', 'Kein Kontakt passt.': 'No contact matches.', 'Kontakte laden …': 'Loading contacts …',
  'Noch keine Kontakte': 'No contacts yet',
  '+ Kontakt': '+ Contact', '€ offen': '€ open', 'seit': 'since', '← Kontakte': '← Contacts',
  // Leads (C12)
  '+ Lead': '+ Lead', 'Neuer Lead': 'New lead', 'Kein Lead passt.': 'No lead matches.', 'Leads nicht geladen': 'Leads not loaded',
  'Antwort ohne Leads': 'Response without leads', 'Antwort ohne Kunden': 'Response without customers',
  'Noch keine Leads': 'No leads yet', 'Kein Lead in dieser Auswahl': 'No lead in this selection',
  'Interessenten legst du als Lead mit Herkunft an. Aus einem Lead wird ein Kunde, wenn er ein Angebot annimmt oder du ihn umwandelst.':
    'Add prospects as a lead with their source. A lead becomes a customer when it accepts a quote or you convert it.', 'Lead nicht gefunden': 'Lead not found', 'Lead nicht angelegt': 'Lead not created',
  'Lead angelegt': 'Lead created', 'mögliche Dublette': 'possible duplicate', 'Mögliche Dubletten': 'Possible duplicates',
  'umgewandelt': 'converted', 'verloren': 'lost', 'Leadquelle': 'Lead source', 'Leads je Quelle': 'Leads by source',
  'Gehört zu Kunde': 'Belongs to customer', 'Vorschläge aus E-Mail und Firma zuerst': 'suggestions from e-mail and company first',
  '— kein Kunde —': '— no customer —', 'Vorschläge': 'Suggestions', 'Alle Kunden': 'All customers',
  'Umwandeln …': 'Convert …', 'Verloren …': 'Lost …', 'Lead umwandeln': 'Convert lead', 'Lead als verloren schließen': 'Close lead as lost',
  'Neuer Kunde': 'New customer', 'bekommt die nächste Kundennummer': 'gets the next customer number',
  'Zusammenführen mit': 'Merge with', 'Umwandeln': 'Convert', 'Als verloren schließen': 'Close as lost',
  'Kunde fehlt.': 'Customer missing.', 'Grund fehlt.': 'Reason missing.', 'Lead nicht umgewandelt': 'Lead not converted',
  'Lead nicht geändert': 'Lead not changed', 'Kunde angelegt': 'Customer created', 'Lead zusammengeführt mit': 'Lead merged with', 'Kontaktliste nicht aktualisiert, bitte neu laden': 'Contact list not refreshed, please reload',
  'Umgewandelt am': 'Converted on', 'Verloren am': 'Lost on', 'Zusammengeführt': 'Merged', 'Kunde gelöscht': 'Customer deleted',
  'Abgeschlossene Leads bleiben für die Auswertung erhalten und lassen sich nicht mehr bearbeiten.':
    'Closed leads stay for the analysis and can no longer be edited.',
  'Ein Lead wird zum Kunden, wenn er ein Angebot annimmt oder du ihn umwandelst. Ist ein Kunde zugeordnet, führt schon der Versand eines Angebots zusammen. Leads werden nicht gelöscht — Fehler mit „verloren · Dublette“ schließen.':
    'A lead becomes a customer when it accepts a quote or you convert it. With a customer assigned, sending a quote already merges it. Leads are not deleted — close mistakes as “lost · duplicate”.',
  'Firma, Name oder E-Mail fehlt.': 'Company, name or e-mail missing.',
  'Umsatz bezahlt': 'Revenue paid', 'Zahlungseingänge, brutto, gesamt': 'payments received, gross, all time',
  'Offene Posten': 'Open items', 'Angebote offen': 'Open quotes', 'nicht angenommen, nicht abgelaufen': 'not accepted, not expired',
  'Übersicht': 'Overview', 'Ansprechpartner': 'Contact persons', 'Belege': 'Documents', 'Projekte & Sätze': 'Projects & rates',
  'Vorgänge': 'Jobs', 'Akte': 'Record',
  'Firma oder Name': 'Company or name', 'Vorname': 'First name', 'Nachname': 'Last name', 'Person auf dem Beleg': 'person on the document',
  'Anschrift': 'Address', 'eine Zeile je Adresszeile': 'one line per address line', 'E-Mail für Rechnungen': 'E-mail for invoices',
  'USt-IdNr.': 'VAT ID', 'Steuernummer': 'Tax number',
  'Käuferreferenz (Leitweg-ID)': 'Buyer reference (Leitweg-ID)', 'für die XRechnung (BT-10)': 'for the XRechnung (BT-10)',
  'Lieferantennummer': 'Supplier number', 'deine Nummer beim Kunden': 'your number at the customer',
  'Land': 'Country', 'zweistelliges Kürzel, leer = DE': 'two-letter code, empty = DE', 'Notiz': 'Note', 'nur intern': 'internal only',
  'Felder speichern beim Verlassen.': 'Fields save when you leave them.', 'Gespeichert ✓': 'Saved ✓', 'Speichert …': 'Saving …',
  'Alles bezahlt.': 'All paid.', 'fällig': 'due', 'Rolle': 'Role', 'Telefon': 'Phone', 'E-Mail': 'E-mail', 'Entfernen': 'Remove',
  '+ Ansprechpartner': '+ Contact person', 'Ansprechpartner nicht geladen': 'Contact persons not loaded',
  'Ansprechpartner entfernt': 'Contact person removed', 'Ansprechpartner nicht entfernt': 'Contact person not removed',
  'Noch keine Belege. Oben „+ Angebot“ oder „+ Rechnung“.': 'No documents yet. Use “+ Quote” or “+ Invoice” above.',
  'Rechnung': 'Invoice', 'Angebot': 'Quote',
  'Projekt': 'Project', 'Satz €/h': 'Rate €/h', 'Rabatt %': 'Discount %', 'ergibt': 'effective', 'Zeitmodell': 'Time model',
  'Standard': 'Default', 'Eigene Zeit': 'Own time', 'Aktivität': 'Activity',
  'Noch kein Projekt zugeordnet. Ohne Projekt gilt der Standard-Stundensatz.': 'No project assigned yet. Without a project the default rate applies.',
  'Projekt zuordnen …': 'Assign project …', 'Projekt vom Kunden lösen': 'Detach project from customer',
  'gehört jetzt zu': 'now belongs to', 'gelöst von': 'detached from', 'Zuordnung nicht gespeichert': 'Assignment not saved',
  'Satz nicht gespeichert': 'Rate not saved', 'Projekte nicht geladen': 'Projects not loaded',
  'leer = Standard': 'empty = default', 'Keine gültige Zahl': 'Not a valid number', 'Kunde': 'Customer',
  'Alle Projekte sind vergeben.': 'All projects are assigned.',
  'Vorgänge der zugeordneten Projekte, alle Zeiträume': 'Jobs of the assigned projects, all periods',
  'Keine Vorgänge in den zugeordneten Projekten.': 'No jobs in the assigned projects.', 'Vorgänge nicht geladen': 'Jobs not loaded',
  'zuletzt': 'last', 'Firma fehlt.': 'Company missing.', 'Anlegen': 'Create', 'Kontakt nicht angelegt': 'Contact not created',
  'Kontakt löschen?': 'Delete contact?', 'Kontakt löschen': 'Delete contact', 'Kontakt gelöscht': 'Contact deleted',
  'Kontakt nicht gelöscht': 'Contact not deleted',
  'Ansprechpartner und Projektzuordnungen gehen mit. Gestellte Belege bleiben unverändert — sie tragen eine Abschrift der Anschrift.':
    'Contact persons and project assignments go with it. Issued documents stay unchanged — they carry a copy of the address.',
  'Lead': 'Lead', 'Kontakt nicht gefunden': 'Contact not found', 'Wiederherstellen fehlgeschlagen': 'Restore failed',
  'Antwort ohne Ansprechpartner': 'Response without contact persons', 'Antwort ohne Vorgänge': 'Response without jobs',
  'Antwort ohne Projekte': 'Response without projects',
});

// Reiter Alle | Kunden | Leads; der Chip "Angebot offen" filtert im aktiven Reiter.
const K_TABS = [['alle', 'Alle', 'Kunden und offene Leads'], ['kunden', 'Kunden', 'mit Kundennummer'], ['leads', 'Leads', 'offen, noch kein Kunde']];
const L_STATUS = [['offen', 'offen'], ['umgewandelt', 'umgewandelt'], ['verloren', 'verloren'], ['alle', 'Alle']];
const kPasst = (k) => !kz.angebot || (!!k.kennzahlen && k.kennzahlen.angebote_offen > 0);
const lAlle = (l) => l.status === 'offen' && (!kz.angebot || l.angebote_offen > 0);
const lPasst = (l) => (kz.ls === 'alle' || l.status === kz.ls) && (!kz.angebot || l.angebote_offen > 0);
const K_SORT = [['name', 'Name'], ['umsatz', 'Umsatz'], ['zuletzt', 'Zuletzt']];
const K_REITER = ['uebersicht', 'ap', 'belege', 'projekte', 'vorgaenge'];
const K_FELDER = [
  ['firma', 'Firma oder Name'], ['vorname', 'Vorname', 'Person auf dem Beleg'], ['nachname', 'Nachname'],
  ['anschrift', 'Anschrift', 'eine Zeile je Adresszeile', 'area'], ['email', 'E-Mail für Rechnungen'],
  ['ustIdNr', 'USt-IdNr.'], ['steuernummer', 'Steuernummer'],
  ['kaeuferReferenz', 'Käuferreferenz (Leitweg-ID)', 'für die XRechnung (BT-10)'],
  ['lieferantennummer', 'Lieferantennummer', 'deine Nummer beim Kunden'], ['land', 'Land', 'zweistelliges Kürzel, leer = DE'],
  ['mahnpauseBis', 'Mahnpause bis', 'keine Erinnerung und Mahnung bis einschließlich diesem Tag', 'date'],
  ['notiz', 'Notiz', 'nur intern', 'area'],
];
const AP_FELDER = ['name', 'rolle', 'email', 'telefon'];

// Gemerkte Wahl nur in bekannter Form uebernehmen.
const kz = {
  f: lies('kontakte.liste', 'alle'),
  ls: lies('kontakte.leadstatus', 'offen'),
  angebot: false,
  leads: { d: null, fehler: null, laedt: false, bezug: undefined, nochmal: false },  // /api/leads
  dub: Object.create(null),       // lid -> { s, d } Dubletten-Vorschlaege fuer "Gehoert zu Kunde"
  hinweis: Object.create(null),   // lid -> Dubletten aus der Anlage-Antwort
  q: '',
  sort: lies('kontakte.sort', 'name'),
  reiter: lies('kontakte.reiter', 'uebersicht'),
  entwurf: Object.create(null),   // Schluessel -> Eingabe, bis sie gespeichert ist
  fehler: Object.create(null),    // Schluessel -> Meldung vom Server
  ok: Object.create(null),        // Schluessel -> Zeitpunkt fuer "Gespeichert ✓"
  laeuft: Object.create(null),    // Schluessel -> POST unterwegs
  nochmal: Object.create(null),   // Schluessel -> waehrend des POST erneut verlassen
  ap: Object.create(null),        // kid -> { d, fehler, laedt }
  apNeu: Object.create(null),     // kid -> [tmp-Id] noch nicht gespeicherter Karten
  vorgaenge: { d: null, fehler: null, laedt: false, zeit: 0 },
};
if (!K_TABS.some(([w]) => w === kz.f)) kz.f = 'alle';
if (!L_STATUS.some(([w]) => w === kz.ls)) kz.ls = 'offen';
if (!K_SORT.some(([w]) => w === kz.sort)) kz.sort = 'name';
if (!K_REITER.includes(kz.reiter)) kz.reiter = 'uebersicht';

const kFinde = (id) => (state.kontakte || []).find((k) => k.id === id) || null;
const initialen = (s) => String(s || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
const kOrt = (k) => { const z = (k.anschrift || []).slice(-1)[0] || ''; return z.replace(/^\d{4,5}\s+/, ''); };

// Letzte Bewegung: Aenderung am Kontakt oder juengster Beleg.
function kZuletzt(k) {
  let t = k.geaendert_am || k.erstellt_am || '';
  for (const b of [...(state.rechnungen || []), ...(state.angebote || [])]) if (b.kontakt_id === k.id && b.erstellt_am > t) t = b.erstellt_am;
  return t;
}

/* ---------- Nachladen ---------- */
function ladeAp(kid) {
  const e = kz.ap[kid] || (kz.ap[kid] = { d: null, fehler: null, laedt: false });
  if (e.laedt || e.d || e.fehler) return e;     // Fehler: erst "Erneut versuchen" laedt wieder
  e.laedt = true;
  hole('/api/ansprechpartner?' + abfrage({ kontakt: kid })).then((d) => {
    if (!Array.isArray(d.ansprechpartner)) throw new Error('Antwort ohne Ansprechpartner');
    e.d = d.ansprechpartner; e.fehler = null;
  }).catch(
(err) => { e.fehler = err.message; }).then(() => { e.laedt = false; if (route().name === 'kontakte') zeichneAnsicht(); });
  return e;
}
function ladeVorgaengeAlle() {
  const e = kz.vorgaenge;
  if (e.laedt || e.fehler || (e.d && Date.now() - e.zeit < 120000)) return e;
  e.laedt = true;
  hole('/api/tickets').then((d) => {
    if (!Array.isArray(d)) throw new Error('Antwort ohne Vorgänge');
    e.d = d; e.fehler = null;
  }).catch((err) => {
    // Mit altem Stand: sagen und den Stand behalten; der naechste Versuch erst nach der Frist.
    if (e.d) toast(uebersetze('Vorgänge nicht geladen') + ': ' + err.message, 'err'); else e.fehler = err.message;
  }).then(() => { e.zeit = Date.now(); e.laedt = false; if (route().name === 'kontakte') zeichneAnsicht(); });
  return e;
}
aktion('k-vg-neu', () => { kz.vorgaenge.fehler = null; kz.vorgaenge.zeit = 0; zeichneAnsicht(); });

/* ---------- Leads (C12) ----------
   Liste, Bericht je Quelle und die festen Listen (Quellen, Gruende) kommen
   fertig von /api/leads; hier wird nur gefiltert und beschriftet. Neu geholt
   wird, wenn ladeBelege die Angebote ersetzt hat (angebote_offen) oder nach
   einer eigenen Aenderung. */
function ladeLeads(frisch) {
  const e = kz.leads;
  if (e.laedt) { if (frisch) e.nochmal = true; return e; }
  if (!frisch && (e.fehler || (e.d && e.bezug === state.angebote))) return e;
  e.laedt = true;
  e.bezug = state.angebote;
  hole('/api/leads').then((d) => {
    if (!d || !Array.isArray(d.leads) || !Array.isArray(d.bericht)) throw new Error('Antwort ohne Leads');
    e.d = d; e.fehler = null;
    state.leads = d.leads;   // Suche und Angebots-Editor (shell.js)
  }).catch((err) => {
    if (e.d) toast(uebersetze('Leads nicht geladen') + ': ' + err.message, 'err'); else e.fehler = err.message;
  }).then(() => {
    e.laedt = false;
    if (e.nochmal) { e.nochmal = false; ladeLeads(true); return; }
    if (route().name === 'kontakte') zeichneAnsicht();
  });
  return e;
}
aktion('l-neuladen', () => { kz.leads.fehler = null; ladeLeads(true); });
const lFinde = (id) => (kz.leads.d && kz.leads.d.leads.find((l) => l.id === id)) || null;
const leadName = (l) => l.firma || [l.vorname, l.nachname].filter(Boolean).join(' ') || l.email || l.lead_nr;
const listenLabel = (liste, w) => { const x = (liste || []).find((q) => q.wert === w); return x ? (istDE() ? x.de : x.en) : String(w || ''); };
const quelleLabel = (w) => listenLabel(kz.leads.d && kz.leads.d.quellen, w);
const grundLabel = (w) => listenLabel(kz.leads.d && kz.leads.d.gruende, w);

// Dubletten-Vorschlaege je Lead (E-Mail, Firma, Domain). Ohne Antwort bleibt
// nur die Liste aller Kunden; der Fehler steht am Feld.
function ladeDubletten(l) {
  const s = (l.email || '') + '|' + (l.firma || '');
  const alt = kz.dub[l.id];
  if (alt && alt.s === s) return alt;
  const e = kz.dub[l.id] = { s, d: null, fehler: null };
  if (!l.email && !l.firma) { e.d = { leads: [], kunden: [] }; return e; }
  hole('/api/lead-dubletten?' + abfrage({ email: l.email, firma: l.firma })).then((d) => {
    if (!d || !Array.isArray(d.kunden)) throw new Error('Antwort ohne Kunden');
    e.d = d;
  }).catch((err) => { e.d = { leads: [], kunden: [] }; e.fehler = err.message; })
    .then(() => { if (kz.dub[l.id] === e && route().name === 'kontakte') zeichneAnsicht(); });
  return e;
}
// Kunden fuer "Gehoert zu Kunde" und den Umwandeln-Dialog: Vorschlaege zuerst.
// Die Suche laeuft ueber Name, Nummer und E-Mail (kontaktSuche in bauteile.js).
function kundenOptionen(l) {
  const vor = ((ladeDubletten(l).d || {}).kunden || []).filter((k) => kFinde(k.id));
  const ids = new Set(vor.map((k) => k.id));
  const opt = (k) => ({ wert: String(k.id), text: [k.kundennummer, kontaktName(k)].filter(Boolean).join(' · '), such: [k.kundennummer, kontaktName(k), k.email].filter(Boolean).join(' ') });
  const rest = (state.kontakte || []).filter((k) => !ids.has(k.id))
    .sort((a, b) => kontaktName(a).localeCompare(kontaktName(b), istDE() ? 'de' : 'en'));
  return [{ gruppe: 'Vorschläge', liste: vor.map((k) => opt(kFinde(k.id))) }, { gruppe: 'Alle Kunden', liste: rest.map(opt) }].filter((g) => g.liste.length);
}

/* ---------- Saetze je Projekt (Akte + Einstellungen) ----------
   Satz und Rabatt kommen aus /api/saetze, der wirksame Satz ("ergibt") aus
   /api/projects — gerechnet wird er nur im Server (satzFuerProjekt). */
const sz = { d: null, fehler: null, laedt: false, zeit: 0, nochmal: false };
function ladeSaetze(frisch) {
  // Laeuft schon ein Abruf, holt ein ausdruecklich frischer danach noch einmal —
  // sonst ueberschriebe die aeltere Antwort den gerade gespeicherten Satz.
  if (sz.laedt) { if (frisch) sz.nochmal = true; return sz; }
  if (!frisch && (sz.fehler || (sz.d && Date.now() - sz.zeit < 120000))) return sz;
  sz.laedt = true;
  Promise.all([hole('/api/projects'), hole('/api/saetze')]).then(([p, s]) => {
    if (!Array.isArray(p) || !s || typeof s.projekte !== 'object') throw new Error('Antwort ohne Projekte');
    // Werkzeugbetrieb und lokale Modelle gehoeren keinem Kunden (wie 1.4.0).
    sz.d = { projekte: p.filter((x) => x.project && !x.overhead && x.project !== '(lokal)'), saetze: s };
    sz.fehler = null;
  }).catch((err) => { if (!sz.d) sz.fehler = err.message; else toast(uebersetze('Projekte nicht geladen') + ': ' + err.message, 'err'); })
    .then(() => {
      sz.zeit = Date.now(); sz.laedt = false;
      if (sz.nochmal) { sz.nochmal = false; ladeSaetze(true); return; }
      if (['kontakte', 'einstellungen', 'projekte'].includes(route().name)) { zeichneAnsicht(); ergibtNeu(); }
    });
  return sz;
}
// Zeitmodell-Knoepfe einer Zeile auf den gespeicherten Stand (nach Fehlschlag).
function zmAnzeigen(n) {
  const gilt = sz.d ? (sz.d.saetze.projekte[n] || {}).zeitmodell || '' : '';
  for (const b of document.querySelectorAll('[data-aktion="satz-zm"]')) {
    try { const x = JSON.parse(b.dataset.wert); if (x[0] === n) b.setAttribute('aria-pressed', String(x[1] === gilt)); } catch { /* fremd */ }
  }
}
// Steht der Fokus nach Enter noch im Feld, zeichnet die Seite nicht neu — der
// wirksame Satz kommt dann direkt in seine Zelle.
function ergibtNeu() {
  if (!sz.d) return;
  const jeProjekt = new Map(sz.d.projekte.map((p) => [p.project, p]));
  for (const z of document.querySelectorAll('[data-satzzeile]')) {
    const p = jeProjekt.get(z.dataset.satzzeile), el = z.querySelector('.fett');
    if (el) el.textContent = p ? nf2.format(p.stundensatz) : '–';
  }
}
const zahlText = (v) => (v == null || v === '' ? '' : istDE() ? String(v).replace('.', ',') : String(v));
const ZM_WAHL = [['', 'Standard'], ['eingaben', 'Eigene Zeit'], ['aktivitaet', 'Aktivität']];

function satzTabelle(namen, mitKunde, loesen) {
  if (sz.fehler) return leer('liste', 'Projekte nicht geladen', sz.fehler, '<button type="button" class="knopf klein" data-aktion="satz-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>');
  if (!sz.d) return '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  const jeProjekt = new Map(sz.d.projekte.map((p) => [p.project, p]));
  const kunde = new Map();
  for (const k of state.kontakte || []) for (const p of k.projekte || []) kunde.set(p, kontaktName(k));
  return '<div class="tabelle-huelle"><div class="satz-tabelle' + (mitKunde ? ' mit-kunde' : '') + (loesen ? ' mit-loesen' : '') + '">' +
    '<div class="satz-kopf"><span>' + esc(uebersetze('Projekt')) + '</span>' + (mitKunde ? '<span>' + esc(uebersetze('Kunde')) + '</span>' : '') +
      '<span class="rechts">' + esc(uebersetze('Satz €/h')) + '</span><span class="rechts">' + esc(uebersetze('Rabatt %')) + '</span>' +
      '<span class="rechts" title="' + esc(uebersetze('Rundung manueller Zeit · leer = Standard')) + '">' + esc(uebersetze('Rundung Min')) + '</span>' +
      '<span class="rechts">' + esc(uebersetze('ergibt')) + '</span><span>' + esc(uebersetze('Zeitmodell')) + '</span>' + (loesen ? '<span></span>' : '') + '</div>' +
    namen.map((n) => {
      const e = sz.d.saetze.projekte[n] || {};
      const p = jeProjekt.get(n);
      const key = 'satz:' + n;
      const wert = (f) => (kz.entwurf[key + ':' + f] != null ? kz.entwurf[key + ':' + f] : zahlText(e[f]));
      const m = kz.fehler[key] ? '<span class="feld-meldung fehler" id="m-' + esc(key) + '">' + esc(kz.fehler[key]) + '</span>'
        : '<span class="feld-meldung ok" id="m-' + esc(key) + '">' + (kz.ok[key] ? esc(uebersetze('Gespeichert ✓')) : '') + '</span>';
      const inp = (f, lab, ph) => '<input class="eingabe zahl" inputmode="decimal" data-satz="' + esc(n) + '" data-satzfeld="' + f + '" name="satz-' + f + '" value="' + esc(wert(f)) + '"' +
        ' placeholder="' + esc(ph) + '" aria-label="' + esc(uebersetze(lab) + ' · ' + n) + '" aria-describedby="m-' + esc(key) + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '') + '>';
      return '<div class="satz-zeile" data-satzzeile="' + esc(n) + '">' +
        '<span class="satz-name"><a class="ell" href="#/projekte/p/' + encodeURIComponent(n) + '">' + esc(n) + '</a>' + m + '</span>' +
        // Ohne Kontakt-Zuordnung steht der alte Freitext da, damit er nicht unsichtbar weiterwirkt.
        (mitKunde ? '<span class="dim ell"' + (!kunde.get(n) && e.kunde ? ' title="' + esc(uebersetze('Freitext aus der bisherigen Ansicht — unter Kontakte einem Kunden zuordnen')) + '"' : '') + '>' + esc(kunde.get(n) || e.kunde || '—') + '</span>' : '') +
        inp('satz', 'Satz €/h', zahlText(sz.d.saetze.standard)) + inp('rabatt', 'Rabatt %', '0') + inp('rundung', 'Rundung Min', uebersetze('Standard')) +
        '<span class="mono rechts fett">' + (p ? nf2.format(p.stundensatz) : '–') + '</span>' +
        '<span class="segment" role="group" aria-label="' + esc(uebersetze('Zeitmodell') + ' · ' + n) + '">' + ZM_WAHL.map(([w, l]) =>
          '<button type="button" data-aktion="satz-zm" data-wert="' + esc(JSON.stringify([n, w])) + '" aria-pressed="' + ((e.zeitmodell || '') === w) + '">' + esc(uebersetze(l)) + '</button>').join('') + '</span>' +
        (loesen ? '<button type="button" class="mini-knopf" data-aktion="k-projekt-weg" data-wert="' + esc(n) + '" title="' + esc(uebersetze('Projekt vom Kunden lösen')) + '" aria-label="' + esc(uebersetze('Projekt vom Kunden lösen') + ' · ' + n) + '">×</button>' : '') +
      '</div>';
    }).join('') + '</div></div>';
}
aktion('satz-neu', () => { sz.fehler = null; ladeSaetze(true); });

// Eine Zeile als Ganzes speichern: setzeSatz ersetzt den Eintrag, deshalb gehen
// Satz, Rabatt und der bisherige Kunde immer mit; das Zeitmodell nur, wenn gewaehlt.
async function speichereSatz(n, zeitmodell) {
  const key = 'satz:' + n;
  if (!sz.d) return;
  if (kz.laeuft[key]) { kz.nochmal[key] = zeitmodell === undefined ? (kz.nochmal[key] || true) : { zeitmodell }; return; }
  const e = sz.d.saetze.projekte[n] || {};
  const roh = (f) => (kz.entwurf[key + ':' + f] != null ? kz.entwurf[key + ':' + f] : zahlText(e[f]));
  const daten = { projekt: n, kunde: e.kunde };
  // Rundung: ganze Minuten, Grenzen prueft der Server (setzeSatz).
  const FELDER = ['satz', 'rabatt', 'rundung'];
  for (const f of FELDER) {
    const s = String(roh(f)).trim();
    if (!s) { daten[f] = ''; continue; }
    const z = betragAus(s);
    if (!Number.isFinite(z)) { kz.fehler[key] = uebersetze('Keine gültige Zahl') + ': ' + s; delete kz.ok[key]; satzMeldung(n); zmAnzeigen(n); return; }
    daten[f] = z;
  }
  const unveraendert = FELDER.every((f) => (daten[f] === '' ? e[f] == null : daten[f] === e[f]));
  if (zeitmodell === undefined && unveraendert) {
    for (const f of FELDER) delete kz.entwurf[key + ':' + f];
    delete kz.fehler[key]; satzMeldung(n); return;
  }
  if (zeitmodell !== undefined) daten.zeitmodell = zeitmodell || null;
  kz.laeuft[key] = true;
  const gesendet = { satz: roh('satz'), rabatt: roh('rabatt'), rundung: roh('rundung') };
  try {
    await sende('/api/saetze', daten);
    // Den gespeicherten Eintrag gleich uebernehmen (setzeSatz: leer = weg, Zeitmodell bleibt ohne Angabe).
    const neu = {};
    const zm = zeitmodell === undefined ? e.zeitmodell : zeitmodell;
    if (zm) neu.zeitmodell = zm;
    if (daten.satz !== '') neu.satz = Math.round(daten.satz * 100) / 100;
    if (daten.rabatt !== '') neu.rabatt = Math.round(daten.rabatt * 100) / 100;
    if (daten.rundung !== '') neu.rundung = daten.rundung;
    if (typeof e.kunde === 'string' && e.kunde.trim()) neu.kunde = e.kunde.trim();
    if (Object.keys(neu).length) sz.d.saetze.projekte[n] = neu; else delete sz.d.saetze.projekte[n];
    for (const f of FELDER) if (kz.entwurf[key + ':' + f] === gesendet[f]) delete kz.entwurf[key + ':' + f];
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => satzMeldung(n));
    ladeSaetze(true);
    neuLaden();
  } catch (err) {
    kz.fehler[key] = err.message;
    delete kz.ok[key];
    zmAnzeigen(n);
  } finally {
    delete kz.laeuft[key];
  }
  pjNeu(n);   // Projektseite und Uebersicht neu holen; hinter dem try, sonst meldete ein Fehler hier "nicht gespeichert"
  satzMeldung(n);
  const weiter = kz.nochmal[key];
  delete kz.nochmal[key];
  if (weiter) speichereSatz(n, typeof weiter === 'object' ? weiter.zeitmodell : undefined);
}
function satzMeldung(n) {
  const key = 'satz:' + n;
  zeigeMeldung('m-' + key, key);
  for (const i of document.querySelectorAll('input[data-satz]')) {
    if (i.dataset.satz !== n) continue;
    if (kz.fehler[key]) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }
}
aktion('satz-zm', (wert) => {
  let w;
  try { w = JSON.parse(wert); } catch { return; }
  if (!Array.isArray(w) || !ZM_WAHL.some(([x]) => x === w[1])) return;
  // Die Wahl gleich zeigen; scheitert das Speichern, setzt zmAnzeigen den gespeicherten Stand zurueck.
  for (const b of document.querySelectorAll('[data-aktion="satz-zm"]')) {
    try { const x = JSON.parse(b.dataset.wert); if (x[0] === w[0]) b.setAttribute('aria-pressed', String(x[1] === w[1])); } catch { /* fremd */ }
  }
  speichereSatz(w[0], w[1]);
});

// Gemeinsame Feld-Verdrahtung fuer Satz-Zeilen: Entwurf bei jeder Eingabe,
// Speichern beim Verlassen der Zeile oder mit Enter.
function verdrahteSaetze(wurzel) {
  wurzel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.satzfeld) kz.entwurf['satz:' + t.dataset.satz + ':' + t.dataset.satzfeld] = t.value;
  });
  wurzel.addEventListener('focusout', (e) => {
    const t = e.target;
    if (!t.dataset.satzfeld) return;
    const zeile = t.closest('[data-satzzeile]');
    if (zeile && e.relatedTarget && zeile.contains(e.relatedTarget) && e.relatedTarget.dataset.satzfeld) return;
    speichereSatz(t.dataset.satz);
  });
  wurzel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.satzfeld) { e.preventDefault(); speichereSatz(e.target.dataset.satz); }
  });
}

/* ---------- Meldungen am Feld ---------- */
// Nur das Meldungs-Element wird ersetzt, nie das Formular: sonst verloere die
// naechste Eingabe Fokus und Cursor.
function zeigeMeldung(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'feld-meldung ' + (kz.fehler[key] ? 'fehler' : 'ok');
  el.textContent = kz.fehler[key] || (kz.laeuft[key] ? uebersetze('Speichert …') : kz.ok[key] ? uebersetze('Gespeichert ✓') : '');
}
function blendeOkAus(key, danach) {
  const t = kz.ok[key];
  setTimeout(() => { if (kz.ok[key] === t) { delete kz.ok[key]; danach(); } }, 2600);
}

/* ---------- Liste ---------- */
function listeHtml(L, selId, still) {
  const q = kz.q.trim().toLowerCase();
  const zeilen = L.filter(kPasst).filter((k) => !q || [kontaktName(k), k.vorname, k.nachname, k.email, k.kundennummer, kOrt(k)]
    .join(' ').toLowerCase().includes(q));
  const um = (k) => (k.kennzahlen ? k.kennzahlen.umsatz_bezahlt_eur : 0);
  if (kz.sort === 'umsatz') zeilen.sort((a, b) => um(b) - um(a));
  else if (kz.sort === 'zuletzt') { const z = new Map(zeilen.map((k) => [k.id, kZuletzt(k)])); zeilen.sort((a, b) => (z.get(a.id) < z.get(b.id) ? 1 : -1)); }
  else zeilen.sort((a, b) => kontaktName(a).localeCompare(kontaktName(b), istDE() ? 'de' : 'en'));
  if (!zeilen.length) return still ? '' : '<div class="kon-keiner">' + esc(uebersetze('Kein Kontakt passt.')) + '</div>';
  return zeilen.map((k) => {
    const offen = k.kennzahlen && k.kennzahlen.offen_eur > 0.005;
    const person = [k.vorname, k.nachname].filter(Boolean).join(' ');
    return '<a class="kon-eintrag" href="#/kontakte/' + k.id + '"' + (k.id === selId ? ' aria-current="true"' : '') + '>' +
      '<span class="kon-av" aria-hidden="true">' + esc(initialen(kontaktName(k))) + '</span>' +
      '<span class="tx"><span class="ell">' + esc(kontaktName(k)) + '</span><span class="s ell">' + esc([k.firma ? person : '', kOrt(k)].filter(Boolean).join(' · ') || '—') + '</span></span>' +
      '<span class="r' + (offen ? ' offen' : '') + '">' + (offen ? nf0.format(k.kennzahlen.offen_eur) + ' ' + esc(uebersetze('€ offen')) : esc(k.kundennummer || '')) + '</span></a>';
  }).join('');
}

function leadListeHtml(selId, passt = lPasst, still) {
  const e = kz.leads;
  if (e.fehler) return leer('liste', 'Leads nicht geladen', e.fehler, '<button type="button" class="knopf klein" data-aktion="l-neuladen">' + esc(uebersetze('Erneut versuchen')) + '</button>');
  if (!e.d) return '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  const q = kz.q.trim().toLowerCase();
  const zeilen = e.d.leads.filter(passt).filter((l) => !q || [leadName(l), l.vorname, l.nachname, l.email, l.lead_nr, quelleLabel(l.quelle)]
    .join(' ').toLowerCase().includes(q));
  if (!zeilen.length) return still ? '' : '<div class="kon-keiner">' + esc(uebersetze('Kein Lead passt.')) + '</div>';
  return zeilen.map((l) => '<a class="kon-eintrag" href="#/kontakte/lead/' + l.id + '"' + (l.id === selId ? ' aria-current="true"' : '') + '>' +
    '<span class="kon-av" aria-hidden="true">' + esc(initialen(leadName(l))) + '</span>' +
    '<span class="tx"><span class="ell">' + esc(leadName(l)) + '</span><span class="s ell">' + esc(l.lead_nr + ' · ' + quelleLabel(l.quelle)) + '</span></span>' +
    '<span class="r">' + esc(kz.ls === 'alle' ? uebersetze(l.status) : '') + '</span></a>').join('');
}

// Reiter Alle: erst die Kunden, darunter unter "Leads" die offenen Leads.
function alleListeHtml(kid, lid) {
  const k = listeHtml(state.kontakte || [], kid, true), l = leadListeHtml(lid, lAlle, true);
  if (!k && !l) return '<div class="kon-keiner">' + esc(uebersetze('Kein Kontakt passt.')) + '</div>';
  return k + (l ? '<span class="ueberzeile kon-gruppe">' + esc(uebersetze('Leads')) + '</span>' + l : '');
}
// Liste des gewaehlten Reiters; kid/lid markieren die geoeffnete Akte.
function listeSeite(kid, lid) {
  return kz.f === 'leads' ? leadListeHtml(lid) : kz.f === 'alle' ? alleListeHtml(kid, lid) : listeHtml(state.kontakte || [], kid);
}
// Reine Zaehlwerte aus /api/leads (GROUP BY im Server).
function berichtHtml() {
  const d = kz.leads.d;
  if (!d || !d.bericht.length) return '';
  const th = (t) => '<th scope="col">' + esc(uebersetze(t)) + '</th>';
  return '<div class="kon-bericht"><span class="ueberzeile" id="kon-bericht-t">' + esc(uebersetze('Leads je Quelle')) + '</span>' +
    '<table aria-labelledby="kon-bericht-t"><thead><tr>' + th('Quelle') + th('offen') + th('umgewandelt') + th('verloren') + '</tr></thead><tbody>' +
    d.bericht.map((b) => '<tr><th scope="row">' + esc(quelleLabel(b.quelle)) + '</th><td>' + num(b.offen) + '</td><td>' + num(b.umgewandelt) + '</td><td>' + num(b.verloren) + '</td></tr>').join('') +
    '</tbody></table></div>';
}

/* ---------- Akte ---------- */
const kWert = (k, feld) => (feld === 'anschrift' ? (k.anschrift || []).join('\n')
  : (k[feld] == null ? '' : String(k[feld])));

function kopfHtml(k) {
  const z = k.kennzahlen || {};
  const kpi = (l, v, s, farbe) => '<div class="kon-kpi"><span class="l">' + esc(uebersetze(l)) + '</span><span class="v"' + (farbe ? ' style="color:' + farbe + '"' : '') + '>' + v + '</span><span class="s">' + esc(uebersetze(s)) + '</span></div>';
  const ap = kz.ap[k.id] && kz.ap[k.id].d;
  const zahl = {
    ap: ap ? ap.length : '', belege: belegeVon(k.id).length, projekte: (k.projekte || []).length,
    vorgaenge: kz.vorgaenge.d ? kz.vorgaenge.d.filter((t) => (k.projekte || []).includes(t.project)).length : '',
  };
  const REITER = [['uebersicht', 'Übersicht'], ['ap', 'Ansprechpartner'], ['belege', 'Belege'], ['projekte', 'Projekte & Sätze'], ['vorgaenge', 'Vorgänge']];
  return '<div class="kon-kopf">' +
    '<a class="knopf klein kon-zurueck" href="#/kontakte">' + esc(uebersetze('← Kontakte')) + '</a>' +
    '<div class="kon-titel">' +
      '<span class="kon-av gross" aria-hidden="true">' + esc(initialen(kontaktName(k))) + '</span>' +
      '<div class="name"><div class="zeile"><h2 id="kon-name">' + esc(kontaktName(k)) + '</h2>' + pille('kunde') + '</div>' +
        '<span class="sub">' + esc([k.kundennummer, kOrt(k), k.erstellt_am ? uebersetze('seit') + ' ' + datum(ortsTag(k.erstellt_am)) : ''].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="kon-taten">' +
        // M1: Belege nur mit Modul Abrechnung.
        (!modulAktiv('abrechnung') ? '' :
        '<a class="knopf klein" href="#/beleg/neu?art=angebot&amp;kontakt=' + k.id + '">' + esc(uebersetze('+ Angebot')) + '</a>' +
        '<a class="knopf klein" href="#/beleg/neu?art=rechnung&amp;kontakt=' + k.id + '">' + esc(uebersetze('+ Rechnung')) + '</a>') +
        '<button type="button" class="knopf klein geist kon-loeschen" data-aktion="k-loeschen-frage" data-wert="' + k.id + '">' + esc(uebersetze('Löschen')) + '</button>' +
      '</div></div>' +
    '<div class="kon-kpis">' +
      kpi('Umsatz bezahlt', nf2.format(z.umsatz_bezahlt_eur || 0) + ' €', 'Zahlungseingänge, brutto, gesamt') +
      kpi('Offene Posten', nf2.format(z.offen_eur || 0) + ' €', 'gestellt, abzüglich Zahlungen', z.offen_eur > 0.005 ? 'var(--accent-blass)' : '') +
      kpi('Ø Zahlungsdauer', z.zahlungsdauer_tage == null ? '–' : nf1.format(z.zahlungsdauer_tage) + ' ' + esc(uebersetze('Tage')), 'Rechnungsdatum bis letzte Zahlung') +
      kpi('Angebote offen', num(z.angebote_offen || 0), 'nicht angenommen, nicht abgelaufen') +
    '</div>' +
    '<div class="kon-reiter" role="tablist" aria-label="' + esc(uebersetze('Akte')) + '">' + REITER.map(([id, l]) =>
      '<button type="button" role="tab" data-aktion="k-reiter" data-wert="' + id + '" aria-selected="' + (kz.reiter === id) + '">' + esc(uebersetze(l)) +
        (zahl[id] !== undefined && zahl[id] !== '' ? '<span class="n">' + num(zahl[id]) + '</span>' : '') + '</button>').join('') + '</div>' +
  '</div>';
}

const belegeVon = (kid) => [
  ...(state.rechnungen || []).filter((r) => r.kontakt_id === kid).map((r) => ({ art: 'Rechnung', r })),
  ...(state.angebote || []).filter((a) => a.kontakt_id === kid).map((a) => ({ art: 'Angebot', r: a })),
].sort((a, b) => (a.r.erstellt_am < b.r.erstellt_am ? 1 : -1));

function feldMeldung(key) {
  return '<span class="feld-meldung ' + (kz.fehler[key] ? 'fehler' : 'ok') + '" id="m-' + esc(key) + '">' +
    esc(kz.fehler[key] || (kz.ok[key] ? uebersetze('Gespeichert ✓') : '')) + '</span>';
}

function uebersichtHtml(k) {
  const felder = K_FELDER.map(([f, l, h, typ]) => {
    const key = 'k:' + k.id + ':' + f;
    const wert = kz.entwurf[key] != null ? kz.entwurf[key] : kWert(k, f);
    const attr = ' id="kf-' + f + '" class="inline-eingabe" data-kfeld="' + f + '" aria-describedby="m-' + esc(key) + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '');
    return '<div class="kon-feld"><label class="l" for="kf-' + f + '">' + esc(uebersetze(l)) + (h ? '<small>' + esc(uebersetze(h)) + '</small>' : '') + '</label>' +
      '<span class="w">' + (typ === 'area' ? '<textarea rows="3"' + attr + '>' + esc(wert) + '</textarea>' : '<input' + (typ === 'date' ? ' type="date"' : '') + attr + ' value="' + esc(wert) + '">') +
      feldMeldung(key) + '</span></div>';
  }).join('');
  const offene = (state.rechnungen || []).filter((r) => r.kontakt_id === k.id && r.status === 'erstellt' && r.rest_eur > 0.005);
  return '<div class="kon-ueber">' +
    '<div class="kon-felder" data-kid="' + k.id + '">' + felder + '<span class="kon-fuss">' + esc(uebersetze('Felder speichern beim Verlassen.')) + '</span></div>' +
    '<div class="kon-box"><span class="ueberzeile">' + esc(uebersetze('Offene Posten')) + '</span>' +
      (offene.length ? offene.map((r) => '<button type="button" class="kon-posten" data-aktion="k-beleg" data-wert="' + esc('r:' + r.nr) + '">' +
        '<span class="mono">' + esc(r.nr) + '</span><span class="mono rechts" style="color:var(--accent-blass)">' + nf2.format(r.rest_eur) + ' €</span>' +
        '<span class="s ell">' + esc(r.leistung_von ? datum(r.leistung_von) + ' – ' + datum(r.leistung_bis) : '') + '</span>' +
        '<span class="s rechts">' + esc(uebersetze('fällig') + ' ' + datum(r.faellig_am)) + '</span></button>').join('')
        : '<span class="dim">' + esc(uebersetze('Alles bezahlt.')) + '</span>') +
    '</div></div>';
}

function apHtml(k) {
  const e = ladeAp(k.id);
  if (e.fehler) return leer('person', 'Ansprechpartner nicht geladen', e.fehler, '<button type="button" class="knopf klein" data-aktion="k-ap-neuladen" data-wert="' + k.id + '">' + esc(uebersetze('Erneut versuchen')) + '</button>');
  if (!e.d) return '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  const karten = [...e.d.map((a) => ({ id: String(a.id), a })), ...(kz.apNeu[k.id] || []).map((t) => ({ id: t, a: {} }))];
  const PH = { name: 'Name', rolle: 'Rolle', email: 'E-Mail', telefon: 'Telefon' };
  return '<div class="kon-aps">' + karten.map(({ id, a }) => {
    const key = 'ap:' + k.id + ':' + id;
    const inp = (f) => {
      const v = kz.entwurf[key + ':' + f] != null ? kz.entwurf[key + ':' + f] : (a[f] || '');
      return '<input class="' + (f === 'name' ? 'inline-eingabe gross' : 'eingabe') + '" data-ap="' + esc(id) + '" data-apfeld="' + f + '" name="ap-' + f + '" value="' + esc(v) + '"' +
        ' placeholder="' + esc(uebersetze(PH[f])) + '" aria-label="' + esc(uebersetze(PH[f])) + '" aria-describedby="m-' + esc(key) + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '') +
        (f === 'email' ? ' type="email"' : f === 'telefon' ? ' type="tel"' : '') + '>';
    };
    return '<div class="kon-ap" data-apkarte="' + esc(id) + '">' +
      '<div class="kopfz"><span class="kon-av" aria-hidden="true">' + esc(initialen(a.name || '?')) + '</span>' + inp('name') +
        '<button type="button" class="mini-knopf" data-aktion="k-ap-weg" data-wert="' + esc(k.id + ':' + id) + '" title="' + esc(uebersetze('Entfernen')) + '" aria-label="' + esc(uebersetze('Entfernen') + ' · ' + (a.name || '')) + '">×</button></div>' +
      inp('rolle') + inp('email') + inp('telefon') + feldMeldung(key) + '</div>';
  }).join('') +
  '<button type="button" class="kon-ap-neu" data-aktion="k-ap-plus" data-wert="' + k.id + '">' + esc(uebersetze('+ Ansprechpartner')) + '</button></div>';
}

function belegeHtml(k) {
  const B = belegeVon(k.id);
  if (!B.length) return '<div class="kon-zeilen"><div class="kon-keiner">' + esc(uebersetze('Noch keine Belege. Oben „+ Angebot“ oder „+ Rechnung“.')) + '</div></div>';
  return '<div class="kon-zeilen">' + B.map(({ art, r }) => '<button type="button" class="kon-zeile beleg" data-aktion="k-beleg" data-wert="' + esc((art === 'Rechnung' ? 'r:' : 'a:') + r.nr) + '">' +
    '<span class="art">' + esc(uebersetze(art)) + '</span><span class="mono">' + esc(r.nr) + '</span>' +
    '<span class="ell">' + esc(r.empfaenger || '') + '</span><span class="mono dim">' + esc(datum(ortsTag(r.erstellt_am))) + '</span>' +
    '<span class="mono rechts">' + nf2.format(r.brutto_eur) + '</span><span>' + pille(r.status_abgeleitet) + '</span></button>').join('') + '</div>';
}

function projekteHtml(k) {
  ladeSaetze();
  const eigene = k.projekte || [];
  const vergeben = new Set();
  for (const x of state.kontakte || []) for (const p of x.projekte || []) vergeben.add(p);
  const frei = sz.d ? sz.d.projekte.map((p) => p.project).filter((p) => !vergeben.has(p)).sort() : [];
  return '<div class="kon-box">' +
    (eigene.length ? satzTabelle(eigene, false, true) : '<span class="dim">' + esc(uebersetze('Noch kein Projekt zugeordnet. Ohne Projekt gilt der Standard-Stundensatz.')) + '</span>') +
    (sz.d ? (frei.length ? '<select class="eingabe kon-zuordnen" id="k-zuordnen" aria-label="' + esc(uebersetze('Projekt zuordnen …')) + '"><option value="">' + esc(uebersetze('Projekt zuordnen …')) + '</option>' +
      frei.map((p) => '<option value="' + esc(p) + '">' + esc(p) + '</option>').join('') + '</select>'
      : '<span class="faint">' + esc(uebersetze('Alle Projekte sind vergeben.')) + '</span>') : '') +
  '</div>';
}

function vorgaengeHtml(k) {
  const e = ladeVorgaengeAlle();
  if (e.fehler) return leer('liste', 'Vorgänge nicht geladen', e.fehler, '<button type="button" class="knopf klein" data-aktion="k-vg-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>');
  if (!e.d) return '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  const abr = (state.summary && state.summary.abrechnung) || {};
  const V = e.d.filter((t) => (k.projekte || []).includes(t.project)).sort((a, b) => (a.last_day < b.last_day ? 1 : -1));
  return '<div class="kon-zeilen"><span class="ueberzeile">' + esc(uebersetze('Vorgänge der zugeordneten Projekte, alle Zeiträume')) + '</span>' +
    (V.length ? V.map((t) => '<a class="kon-zeile vorgang" href="#/vorgaenge/' + encodeURIComponent(t.ticket) + '">' +
      '<span class="mono">' + esc(t.ticket) + '</span><span class="ell dim">' + esc(t.project) + '</span>' +
      '<span class="mono rechts">' + hrs(t.active_hours) + '</span><span class="mono dim">' + esc(uebersetze('zuletzt') + ' ' + datum(t.last_day)) + '</span>' +
      '<span>' + pille(Object.prototype.hasOwnProperty.call(abr, t.ticket) ? 'abgerechnet' : 'offen') + '</span></a>').join('')
      : '<div class="kon-keiner">' + esc(uebersetze('Keine Vorgänge in den zugeordneten Projekten.')) + '</div>') + '</div>';
}

const REITER_HTML = { uebersicht: uebersichtHtml, ap: apHtml, belege: belegeHtml, projekte: projekteHtml, vorgaenge: vorgaengeHtml };

/* ---------- Lead-Akte ---------- */
const L_FELDER = [
  ['firma', 'Firma'], ['vorname', 'Vorname'], ['nachname', 'Nachname'], ['email', 'E-Mail'], ['telefon', 'Telefon'],
  ['anschrift', 'Anschrift', 'eine Zeile je Adresszeile', 'area'], ['notiz', 'Notiz', 'nur intern', 'area'],
];
const lWert = (l, feld) => (feld === 'anschrift' ? (l.anschrift || []).join('\n')
  : feld === 'kunde_id' ? (l.kunde_id ? String(l.kunde_id) : '') : (l[feld] == null ? '' : String(l[feld])));

function leadAkteHtml(l) {
  const offen = l.status === 'offen';
  const kopf = '<div class="kon-kopf ohne-reiter">' +
    '<a class="knopf klein kon-zurueck" href="#/kontakte">' + esc(uebersetze('← Kontakte')) + '</a>' +
    '<div class="kon-titel">' +
      '<span class="kon-av gross" aria-hidden="true">' + esc(initialen(leadName(l))) + '</span>' +
      '<div class="name"><div class="zeile"><h2 id="kon-name">' + esc(leadName(l)) + '</h2>' + pille(l.status) + '</div>' +
        '<span class="sub">' + esc([l.lead_nr, quelleLabel(l.quelle), uebersetze('seit') + ' ' + datum(ortsTag(l.erstellt_am))].join(' · ')) + '</span></div>' +
      '<div class="kon-taten">' +
        (offen && modulAktiv('abrechnung') ? '<a class="knopf klein" href="#/beleg/neu?art=angebot&amp;lead=' + l.id + '">' + esc(uebersetze('+ Angebot')) + '</a>' : '') +
        // Ein verlorener Lead darf noch umgewandelt werden (gewonnen schlaegt verloren).
        (l.status !== 'umgewandelt' ? '<button type="button" class="knopf klein kon-kunde" data-aktion="l-umwandeln-frage" data-wert="' + l.id + '">' + esc(uebersetze('Umwandeln …')) + '</button>' : '') +
        (offen ? '<button type="button" class="knopf klein geist" data-aktion="l-verloren-frage" data-wert="' + l.id + '">' + esc(uebersetze('Verloren …')) + '</button>' : '') +
      '</div></div></div>';
  const zu = offen ? '' : ' readonly';
  const feld = (f, label, hilfe, inhalt) => {
    const key = 'l:' + l.id + ':' + f;
    return '<div class="kon-feld"><label class="l" for="lf-' + f + '">' + esc(uebersetze(label)) + (hilfe ? '<small>' + esc(hilfe.t || uebersetze(hilfe)) + '</small>' : '') + '</label>' +
      '<span class="w">' + inhalt(' id="lf-' + f + '" data-lfeld="' + f + '" aria-describedby="m-' + esc(key) + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '')) + feldMeldung(key) + '</span></div>';
  };
  const wert = (f) => { const key = 'l:' + l.id + ':' + f; return kz.entwurf[key] != null ? kz.entwurf[key] : lWert(l, f); };
  const quellen = (kz.leads.d.quellen || []).map((q) => '<option value="' + esc(q.wert) + '"' + (q.wert === wert('quelle') ? ' selected' : '') + '>' + esc(quelleLabel(q.wert)) + '</option>').join('');
  // Auch fuer verlorene Leads: der Umwandeln-Dialog zeigt die Vorschlaege sonst erst beim zweiten Oeffnen.
  const dub = l.status !== 'umgewandelt' ? ladeDubletten(l) : null;
  const felder = L_FELDER.map(([f, lab, h, typ]) => feld(f, lab, h, (attr) => (typ === 'area'
      ? '<textarea rows="3" class="inline-eingabe"' + attr + zu + '>' + esc(wert(f)) + '</textarea>'
      : '<input class="inline-eingabe"' + attr + zu + ' value="' + esc(wert(f)) + '"' + (f === 'email' ? ' type="email"' : f === 'telefon' ? ' type="tel"' : '') + '>'))).join('') +
    feld('quelle', 'Leadquelle', '', (attr) => '<select class="eingabe"' + attr + (offen ? '' : ' disabled') + '>' + quellen + '</select>') +
    (offen ? feld('kunde_id', 'Gehört zu Kunde', dub.fehler ? { t: uebersetze('Vorschläge') + ': ' + uebersetze(dub.fehler) } : 'Vorschläge aus E-Mail und Firma zuerst',
      (attr) => kontaktSuche({ attr: ' id="lf-kunde_id-h" data-lfeld="kunde_id"', textAttr: attr.replace(/ data-lfeld="[^"]*"/, ''), gruppen: kundenOptionen(l), leerText: '— kein Kunde —', wert: Number(wert('kunde_id')) || '', label: 'Gehört zu Kunde' })) : '');
  return kopf + '<div class="kon-inhalt"><div class="kon-ueber">' +
    '<div class="kon-felder" data-lid="' + l.id + '">' + felder + '<span class="kon-fuss">' +
      esc(uebersetze(offen ? 'Felder speichern beim Verlassen.' : 'Abgeschlossene Leads bleiben für die Auswertung erhalten und lassen sich nicht mehr bearbeiten.')) + '</span></div>' +
    leadBoxHtml(l) + '</div></div>';
}

function leadBoxHtml(l) {
  const zeile = (lab, inhalt) => '<div class="kon-wert"><span class="dim">' + esc(uebersetze(lab)) + '</span><span>' + inhalt + '</span></div>';
  let inhalt = '';
  if (l.status === 'umgewandelt') {
    const k = l.kunde_id && kFinde(l.kunde_id);
    inhalt = zeile('Umgewandelt am', esc(datum(ortsTag(l.umgewandelt_am)))) +
      zeile('Art', esc(uebersetze(l.umwandlung_art === 'neu' ? 'Neuer Kunde' : 'Zusammengeführt'))) +
      zeile('Kunde', k ? '<a href="#/kontakte/' + k.id + '">' + esc([k.kundennummer, kontaktName(k)].filter(Boolean).join(' · ')) + '</a>' : esc(uebersetze('Kunde gelöscht')));
  } else if (l.status === 'verloren') {
    inhalt = zeile('Verloren am', esc(datum(ortsTag(l.verloren_am)))) + zeile('Grund', esc(grundLabel(l.verloren_grund)));
  }
  const h = kz.hinweis[l.id];
  const dubletten = h && (h.leads.length || h.kunden.length) ? '<span class="ueberzeile">' + esc(uebersetze('Mögliche Dubletten')) + '</span>' +
    h.kunden.map((k) => '<a class="kon-wert" href="#/kontakte/' + k.id + '">' + esc([k.kundennummer, k.firma].filter(Boolean).join(' · ')) + '<span class="dim">' + esc(uebersetze('Kunde')) + '</span></a>').join('') +
    h.leads.map((x) => '<a class="kon-wert" href="#/kontakte/lead/' + x.id + '">' + esc(x.lead_nr + ' · ' + leadName(x)) + '<span class="dim">' + esc(uebersetze(x.status)) + '</span></a>').join('') : '';
  return '<div class="kon-box"><div class="kon-box-kopf"><span class="ueberzeile">' + esc(uebersetze('Status')) + '</span>' + infoI('lead-ablauf') + '</div>' +
    infoText('lead-ablauf', 'Ein Lead wird zum Kunden, wenn er ein Angebot annimmt oder du ihn umwandelst. Ist ein Kunde zugeordnet, führt schon der Versand eines Angebots zusammen. Leads werden nicht gelöscht — Fehler mit „verloren · Dublette“ schließen.') +
    zeile('Status', pille(l.status)) + inhalt + dubletten + '</div>';
}

/* ---------- Seite ---------- */
function zeichneKontakte(w, teile) {
  const L = state.kontakte;
  const warte = belegeWarte(L, 'Kontakte laden …');
  if (warte) { w.innerHTML = warte; return; }
  const ld = ladeLeads();
  // Die Route bestimmt den Reiter: #/kontakte/ID = Kunde, #/kontakte/lead/ID = Lead. In "Alle" bestimmt sie nur die Akte.
  const lRoute = teile[0] === 'lead';
  const explizit = lRoute ? (Number(teile[1]) || null) : teile[0] ? Number(teile[0]) : null;
  if (explizit && kz.f !== 'alle') kz.f = lRoute ? 'leads' : 'kunden';
  const leads = kz.f === 'leads', alle = kz.f === 'alle';
  const lAkte = leads || (alle && lRoute);
  // Breit ohne Auswahl: erster Treffer der Liste (Mockup). Schmal zeigt dann nur die Liste.
  let sel = null, selL = null;
  if (alle) {
    if (explizit && lRoute) selL = ld.d ? lFinde(explizit) : null;
    else if (explizit) sel = kFinde(explizit);
    else {
      sel = L.filter(kPasst)[0] || null;
      if (!sel && ld.d) selL = ld.d.leads.filter(lAlle)[0] || null;
    }
  } else if (leads) selL = ld.d ? (explizit ? lFinde(explizit) : ld.d.leads.filter(lPasst)[0] || null) : null;
  else sel = explizit ? kFinde(explizit) : (L.filter(kPasst)[0] || L[0] || null);
  if (sel) ciraKontext({ art: 'kontakt', id: sel.id, titel: sel.firma || sel.name || '' });
  const selKey = sel ? String(sel.id) : selL ? 'l' + selL.id : '';
  // Hintergrund-Nachladen unterbricht keine Eingabe in der Akte; die Entwuerfe
  // stehen ohnehin im Zustand und ueberleben jedes spaetere Neuzeichnen.
  const a = document.activeElement;
  if (a && w.contains(a) && a.matches('.kon-akte input, .kon-akte textarea, .kon-akte select') && w.dataset.kid === selKey && w.dataset.reiter === kz.reiter) return;
  const suche = sucheVorher('k-suche');
  const fv = fokusMerken(w);
  if (sel) { ladeAp(sel.id); ladeVorgaengeAlle(); }
  w.dataset.kid = selKey;
  w.dataset.reiter = kz.reiter;
  const nOffen = ld.d ? ld.d.leads.filter((l) => l.status === 'offen').length : null;
  const zahl = { alle: nOffen == null ? '–' : num(L.length + nOffen), kunden: num(L.length), leads: nOffen == null ? '–' : num(nOffen) };
  const zahlFarbe = { alle: 'var(--text)', kunden: 'var(--ok)', leads: 'var(--text-dim)' };
  const pipe = '<div class="kon-pipe" role="group" aria-label="' + esc(uebersetze('Kontakte')) + '">' + K_TABS.map(([id, l, h]) =>
    '<button type="button" data-aktion="k-filter" data-wert="' + id + '" aria-pressed="' + (kz.f === id) + '">' +
      '<span class="n mono" style="color:' + zahlFarbe[id] + '">' + zahl[id] + '</span>' +
      '<span class="t">' + esc(uebersetze(l)) + '<small>' + esc(uebersetze(h)) + '</small></span></button>').join('') + '</div>';
  const neuKnopf = (cls) => '<button type="button" class="knopf ' + cls + '" data-aktion="k-neu">' + esc(uebersetze('+ Kontakt')) + '</button>' +
    '<button type="button" class="knopf ' + cls + '" data-aktion="l-neu">' + esc(uebersetze('+ Lead')) + '</button>';
  if (!L.length && ld.d && !ld.d.leads.length) {
    w.innerHTML = '<div class="kon">' + pipe + leer('person', 'Noch keine Kontakte',
      'Kunden legst du direkt an, Interessenten als Lead mit Herkunft. Aus einem Lead wird ein Kunde, wenn er ein Angebot annimmt oder du ihn umwandelst.',
      '<div class="kon-taten">' + neuKnopf('primaer') + '</div>') + '</div>';
    return;
  }
  const nKunden = L.filter((k) => k.kennzahlen && k.kennzahlen.angebote_offen > 0).length;
  const nLeads = ld.d ? ld.d.leads.filter((l) => (alle ? l.status === 'offen' : kz.ls === 'alle' || l.status === kz.ls) && l.angebote_offen > 0).length : 0;
  const nAngebot = alle ? nKunden + nLeads : leads ? nLeads : nKunden;
  const akteHtml = sel ? kopfHtml(sel) + '<div class="kon-inhalt" role="tabpanel">' + REITER_HTML[kz.reiter](sel) + '</div>'
    : selL ? leadAkteHtml(selL)
    : lAkte && explizit && !ld.d ? '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>'
    : leads && ld.d && !explizit ? leer('person', ld.d.leads.length ? 'Kein Lead in dieser Auswahl' : 'Noch keine Leads',
      'Interessenten legst du als Lead mit Herkunft an. Aus einem Lead wird ein Kunde, wenn er ein Angebot annimmt oder du ihn umwandelst.',
      '<div class="kon-taten"><button type="button" class="knopf primaer" data-aktion="l-neu">' + esc(uebersetze('+ Lead')) + '</button></div>')
    : explizit ? leer('person', lAkte ? 'Lead nicht gefunden' : 'Kontakt nicht gefunden', '', '<a class="knopf klein" href="#/kontakte">' + esc(uebersetze('← Kontakte')) + '</a>') : '';
  w.innerHTML = '<div class="kon">' + pipe +
    // Nicht "gewaehlt": das ist die globale Auswahl-Optik (app.css) und faerbte das ganze Raster.
    '<div class="kon-raster' + (explizit ? ' mit-akte' : '') + '">' +
      '<div class="kon-liste"><div class="kon-liste-kopf"><div class="zeile">' +
          '<input type="search" class="suche-feld" id="k-suche" value="' + esc(kz.q) + '" placeholder="' + esc(uebersetze('Firma, Person, E-Mail')) + '" aria-label="' + esc(uebersetze('Firma, Person, E-Mail')) + '">' +
          '<button type="button" class="knopf primaer kon-plus" data-aktion="k-plus" title="' + esc(uebersetze('Neu anlegen')) + '" aria-label="' + esc(uebersetze('Neu anlegen')) + '">+</button></div>' +
        (leads ? segment('l-status', L_STATUS, kz.ls, 'Status') : segment('k-sort', K_SORT, kz.sort, 'Sortierung')) +
        '<button type="button" class="chip" data-aktion="k-angebot" aria-pressed="' + kz.angebot + '">' + esc(uebersetze('Angebot offen')) + '<span class="n">' + num(nAngebot) + '</span></button></div>' +
        '<div class="kon-eintraege" id="k-eintraege">' + listeSeite(sel && sel.id, selL && selL.id) + '</div>' +
        (leads ? berichtHtml() : '') + '</div>' +
      '<div class="kon-akte">' + akteHtml + '</div>' +
    '</div></div>';
  verdrahteSuche(w, 'k-suche', (v) => { kz.q = v; }, suche);
  fokusZurueck(w, fv);
  const akte = w.querySelector('.kon-akte');
  if (akte && selL) { verdrahteLead(akte, selL.id); return; }
  if (!akte || !sel) return;
  verdrahteSaetze(akte);
  akte.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.kfeld) kz.entwurf['k:' + sel.id + ':' + t.dataset.kfeld] = t.value;
    else if (t.dataset.apfeld) kz.entwurf['ap:' + sel.id + ':' + t.dataset.ap + ':' + t.dataset.apfeld] = t.value;
  });
  akte.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t.dataset.kfeld) speichereFeld(sel.id, t.dataset.kfeld);
    else if (t.dataset.apfeld) {
      // Erst speichern, wenn der Fokus die Karte verlaesst — eine Person ist ein Datensatz.
      const karte = t.closest('[data-apkarte]');
      if (e.relatedTarget && karte && karte.contains(e.relatedTarget)) return;
      speichereAp(sel.id, t.dataset.ap);
    }
  });
  akte.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || t.tagName === 'TEXTAREA') return;
    if (t.dataset.kfeld) { e.preventDefault(); speichereFeld(sel.id, t.dataset.kfeld); }
    else if (t.dataset.apfeld) { e.preventDefault(); speichereAp(sel.id, t.dataset.ap); }
  });
  akte.addEventListener('change', (e) => { if (e.target.id === 'k-zuordnen' && e.target.value) { const p = e.target.value; e.target.blur(); ordneZu(sel.id, p); } });
  if (kz.fokus) { const f = akte.querySelector(kz.fokus); kz.fokus = null; if (f) f.focus(); }
}

/* ---------- Speichern ---------- */
async function speichereFeld(kid, feld) {
  const key = 'k:' + kid + ':' + feld;
  if (!(key in kz.entwurf)) return;
  if (kz.laeuft[key]) { kz.nochmal[key] = true; return; }
  const k = kFinde(kid);
  if (!k) return;
  const wert = kz.entwurf[key];
  if (wert === kWert(k, feld)) { delete kz.entwurf[key]; if (kz.fehler[key]) { delete kz.fehler[key]; feldStatus(key); } return; }
  kz.laeuft[key] = true;
  feldStatus(key);
  try {
    const r = await sende('/api/kontakt', { id: kid, [feld]: wert });
    const k2 = kFinde(kid) || k;         // ladeBelege kann die Liste inzwischen ersetzt haben
    Object.assign(k2, r.kontakt);        // Kennzahlen bleiben, sie aendern sich hier nicht
    if (feld === 'mahnpauseBis') mzStand.stand = undefined;   // Mahnstufe in der Rechnungsliste neu holen
    if (kz.entwurf[key] === wert) delete kz.entwurf[key];
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => feldStatus(key));
    aktualisiereNamen(k2);
  } catch (err) {
    kz.fehler[key] = err.message;
    delete kz.ok[key];
  } finally {
    delete kz.laeuft[key];
  }
  feldStatus(key);
  if (kz.nochmal[key]) { delete kz.nochmal[key]; speichereFeld(kid, feld); }
}
const zeigtKontakt = (kid) => document.getElementById('ansicht').dataset.kid === String(kid);
function feldStatus(key) {
  zeigeMeldung('m-' + key, key);
  const [, kid, feld] = key.split(':');
  // Die Feld-Id traegt keinen Kontakt: nur anfassen, wenn noch derselbe offen ist.
  const el = zeigtKontakt(kid) && document.getElementById('kf-' + feld);
  if (el) { if (kz.fehler[key]) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
}
// Lead-Felder: wie beim Kunden einzeln beim Verlassen, Auswahlfelder sofort.
function verdrahteLead(akte, lid) {
  const key = (t) => 'l:' + lid + ':' + t.dataset.lfeld;
  akte.addEventListener('input', (e) => { if (e.target.dataset.lfeld) kz.entwurf[key(e.target)] = e.target.value; });
  akte.addEventListener('focusout', (e) => { const t = e.target; if (t.dataset.lfeld && t.tagName !== 'SELECT') speichereLeadFeld(lid, t.dataset.lfeld); });
  akte.addEventListener('change', (e) => {
    const t = e.target;
    if ((t.tagName !== 'SELECT' && t.type !== 'hidden') || !t.dataset.lfeld) return;
    kz.entwurf[key(t)] = t.value;
    speichereLeadFeld(lid, t.dataset.lfeld);
  });
  akte.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Enter' && t.tagName === 'INPUT' && t.dataset.lfeld) { e.preventDefault(); speichereLeadFeld(lid, t.dataset.lfeld); }
  });
}
async function speichereLeadFeld(lid, feld) {
  const key = 'l:' + lid + ':' + feld;
  if (!(key in kz.entwurf)) return;
  if (kz.laeuft[key]) { kz.nochmal[key] = true; return; }
  const l = lFinde(lid);
  if (!l || l.status !== 'offen') return;
  const wert = kz.entwurf[key];
  const status = () => {
    zeigeMeldung('m-' + key, key);
    const el = document.getElementById('ansicht').dataset.kid === 'l' + lid && document.getElementById('lf-' + feld);
    if (el) { if (kz.fehler[key]) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
  };
  if (wert === lWert(l, feld)) { delete kz.entwurf[key]; if (kz.fehler[key]) { delete kz.fehler[key]; status(); } return; }
  kz.laeuft[key] = true;
  status();
  try {
    const r = await sende('/api/lead', { id: lid, [feld]: wert });
    Object.assign(lFinde(lid) || l, r.lead);
    if (kz.entwurf[key] === wert) delete kz.entwurf[key];
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, status);
    const h = document.getElementById('kon-name');
    if (h && document.getElementById('ansicht').dataset.kid === 'l' + lid) h.textContent = leadName(lFinde(lid) || l);
    const liste = document.getElementById('k-eintraege');
    // Markiert wird der angezeigte Lead, nicht der gespeicherte: die Antwort kann nach einem Wechsel kommen.
    const gezeigt = document.getElementById('ansicht').dataset.kid || '';
    if (liste && kz.f !== 'kunden') liste.innerHTML = listeSeite(gezeigt[0] === 'l' ? null : Number(gezeigt) || null, gezeigt[0] === 'l' ? Number(gezeigt.slice(1)) : null);
    ladeLeads(true);   // Bericht je Quelle, Kundenname
  } catch (err) {
    kz.fehler[key] = err.message;
    delete kz.ok[key];
  } finally {
    delete kz.laeuft[key];
  }
  status();
  if (kz.nochmal[key]) { delete kz.nochmal[key]; speichereLeadFeld(lid, feld); }
}

// Name und Liste ohne das Formular neu: der Fokus steht vielleicht schon im naechsten Feld.
function aktualisiereNamen(k) {
  const h = document.getElementById('kon-name');
  if (h && zeigtKontakt(k.id)) h.textContent = kontaktName(k);
  const liste = document.getElementById('k-eintraege');
  if (liste) liste.innerHTML = listeSeite(Number(document.getElementById('ansicht').dataset.kid) || null, null);
}

async function speichereAp(kid, id) {
  const key = 'ap:' + kid + ':' + id;
  const tmp = !/^\d+$/.test(id);
  const e = kz.ap[kid];
  if (!e || !e.d) return;
  const alt = tmp ? {} : e.d.find((a) => String(a.id) === id);
  if (!alt) return;
  const werte = {};
  for (const f of AP_FELDER) werte[f] = kz.entwurf[key + ':' + f] != null ? kz.entwurf[key + ':' + f] : (alt[f] || '');
  const geaendert = AP_FELDER.some((f) => werte[f] !== (alt[f] || ''));
  if (!geaendert) { if (kz.fehler[key]) { delete kz.fehler[key]; zeigeMeldung('m-' + key, key); } return; }
  if (kz.laeuft[key]) { kz.nochmal[key] = true; return; }
  kz.laeuft[key] = true;
  zeigeMeldung('m-' + key, key);
  try {
    const r = await sende('/api/ansprechpartner', { ...werte, kontakt_id: kid, ...(tmp ? {} : { id: Number(id) }) });
    const neu = r.ansprechpartner;
    for (const f of AP_FELDER) if (kz.entwurf[key + ':' + f] === werte[f]) delete kz.entwurf[key + ':' + f];
    delete kz.fehler[key];
    if (tmp) {
      // Die Karte bekommt ihre echte Id; was waehrend des Speicherns getippt wurde, zieht mit.
      e.d.push(neu);
      kz.apNeu[kid] = (kz.apNeu[kid] || []).filter((t) => t !== id);
      const neuId = String(neu.id), neuKey = 'ap:' + kid + ':' + neuId;
      for (const f of AP_FELDER) if (kz.entwurf[key + ':' + f] != null) { kz.entwurf[neuKey + ':' + f] = kz.entwurf[key + ':' + f]; delete kz.entwurf[key + ':' + f]; }
      befoerdere(key, neuKey, [['data-ap', id, neuId], ['data-apkarte', id, neuId], ['data-wert', kid + ':' + id, kid + ':' + neuId]]);
      kz.ok[neuKey] = Date.now();
      blendeOkAus(neuKey, () => zeigeMeldung('m-' + neuKey, neuKey));
      delete kz.laeuft[key];
      zeigeMeldung('m-' + neuKey, neuKey);
      const weiter = kz.nochmal[key];
      delete kz.nochmal[key];
      if (weiter || AP_FELDER.some((f) => kz.entwurf[neuKey + ':' + f] != null)) speichereAp(kid, neuId);
      zeichneAnsicht();
      return;
    }
    Object.assign(alt, neu);
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
  } catch (err) {
    kz.fehler[key] = err.message;
    delete kz.ok[key];
  }
  delete kz.laeuft[key];
  zeigeMeldung('m-' + key, key);
  for (const i of document.querySelectorAll('[data-ap]')) {
    if (i.dataset.ap !== id) continue;
    if (kz.fehler[key]) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }
  if (kz.nochmal[key]) { delete kz.nochmal[key]; speichereAp(kid, id); }
}

/* Temporaere Id (neu…) einer gerade gespeicherten Zeile im DOM auf die echte
   umschreiben: Attribute [name, alt, neu] und die Meldungs-Id. */
function befoerdere(altKey, neuKey, attribute) {
  for (const [a, alt, neu] of attribute) for (const el of document.querySelectorAll('[' + a + '="' + CSS.escape(alt) + '"]')) el.setAttribute(a, neu);
  const m = document.getElementById('m-' + altKey);
  if (m) m.id = 'm-' + neuKey;
  for (const el of document.querySelectorAll('[aria-describedby="m-' + CSS.escape(altKey) + '"]')) el.setAttribute('aria-describedby', 'm-' + neuKey);
}

// Nacheinander je Kontakt: der Server ersetzt die ganze Liste, zwei gleichzeitige
// Aenderungen rechneten beide vom alten Stand und eine ginge verloren.
const zuordnungKette = Object.create(null);
function ordneZu(kid, projekt, rueck) {
  const p = (zuordnungKette[kid] || Promise.resolve()).then(() => ordneZuJetzt(kid, projekt, rueck));
  zuordnungKette[kid] = p;
  return p;
}
async function ordneZuJetzt(kid, projekt, rueck) {
  const k = kFinde(kid);
  if (!k) { toast(uebersetze('Zuordnung nicht gespeichert') + ': ' + uebersetze('Kontakt nicht gefunden'), 'err'); return; }
  const vorher = (k.projekte || []).slice();
  if (rueck ? !vorher.includes(projekt) : vorher.includes(projekt)) { zeichneAnsicht(); return; }
  const neu = rueck ? vorher.filter((p) => p !== projekt) : [...vorher, projekt];
  try {
    const r = await sende('/api/kontakt', { id: kid, projekte: neu });
    const k2 = kFinde(kid) || k;
    Object.assign(k2, r.kontakt);
    toast(projekt + ' ' + uebersetze(rueck ? 'gelöst von' : 'gehört jetzt zu') + ' ' + kontaktName(k2), 'ok',
      { text: uebersetze('Rückgängig'), tu: () => ordneZu(kid, projekt, !rueck) });
    neuLaden();
  } catch (err) {
    toast(uebersetze('Zuordnung nicht gespeichert') + ': ' + err.message, 'err');
  }
  zeichneAnsicht();
}

/* ---------- Aktionen ---------- */
// Reiterwechsel verlaesst eine gewaehlte Akte, sonst holte die Route den Reiter zurueck.
aktion('k-filter', (f) => {
  if (!K_TABS.some(([w]) => w === f)) return;
  kz.f = f; merke('kontakte.liste', f);
  if (route().teile.length) geheZu('kontakte'); else zeichneAnsicht();
});
aktion('k-angebot', () => { kz.angebot = !kz.angebot; zeichneAnsicht(); });
aktion('l-status', (s) => { if (!L_STATUS.some(([w]) => w === s)) return; kz.ls = s; merke('kontakte.leadstatus', s); zeichneAnsicht(); });
aktion('k-sort', (s) => { if (!K_SORT.some(([w]) => w === s)) return; kz.sort = s; merke('kontakte.sort', s); zeichneAnsicht(); });
aktion('k-reiter', (r, el) => {
  if (!K_REITER.includes(r)) return;
  kz.reiter = r; merke('kontakte.reiter', r);
  zeichneAnsicht();
  const neu = document.querySelector('[data-aktion="k-reiter"][data-wert="' + r + '"]');
  if (neu && el) neu.focus();
});
aktion('k-ap-neuladen', (kid) => { delete kz.ap[Number(kid)]; zeichneAnsicht(); });
aktion('k-projekt-weg', (p) => { const kid = Number(document.getElementById('ansicht').dataset.kid); if (kid) ordneZu(kid, p, true); });
aktion('k-beleg', (wert) => {
  const [art, nr] = [String(wert).slice(0, 1), String(wert).slice(2)];
  // Landeplatz ist die Belegliste, gefiltert auf diese Nummer.
  if (art === 'r') { bz.rf = 'alle'; bz.rq = nr; if (!bz.auf[nr]) ladeDetail(nr); geheZu('rechnungen'); }
  else if (art === 'a') { bz.af = 'alle'; bz.akunde = ''; bz.aq = nr; geheZu('angebote'); }
});
aktion('k-ap-plus', (kid) => {
  const id = Number(kid);
  const t = 'neu' + Date.now().toString(36);
  kz.apNeu[id] = [...(kz.apNeu[id] || []), t];
  kz.fokus = '[data-ap="' + t + '"][data-apfeld="name"]';
  zeichneAnsicht();
});
aktion('k-ap-weg', async (wert, el) => {
  const [kid, id] = [Number(String(wert).split(':')[0]), String(wert).split(':')[1]];
  if (!/^\d+$/.test(id)) { kz.apNeu[kid] = (kz.apNeu[kid] || []).filter((t) => t !== id); zeichneAnsicht(); return; }
  const e = kz.ap[kid];
  const alt = e && e.d && e.d.find((a) => String(a.id) === id);
  if (!alt) return;
  await mitLauf(el, async () => {
    try {
      await sende('/api/ansprechpartner-loeschen', { id: Number(id) });
      e.d = e.d.filter((a) => a !== alt);
      toast(uebersetze('Ansprechpartner entfernt'), 'ok', { text: uebersetze('Rückgängig'), tu: async () => {
        try {
          const r = await sende('/api/ansprechpartner', { kontakt_id: kid, name: alt.name, email: alt.email, telefon: alt.telefon, rolle: alt.rolle });
          if (kz.ap[kid] && kz.ap[kid].d) kz.ap[kid].d.push(r.ansprechpartner);
        } catch (err) { toast(uebersetze('Wiederherstellen fehlgeschlagen') + ': ' + err.message, 'err'); }
        zeichneAnsicht();
      } });
    } catch (err) {
      toast(uebersetze('Ansprechpartner nicht entfernt') + ': ' + err.message, 'err');
    }
  });
  zeichneAnsicht();
});
/* ---------- Lead-Aktionen ---------- */
const dlgKopf = (titel, unter) => '<div class="dialog-kopf"><div><h2>' + esc(uebersetze(titel)) + '</h2>' + (unter ? '<span class="dim">' + esc(unter) + '</span>' : '') + '</div>' +
  '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>';
const dlgFuss = (aktionName, wert, text, art) => '<p class="dialog-fehler" id="l-dlg-fehler" role="alert"></p>' +
  '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
  '<button type="button" class="knopf ' + (art || 'primaer') + '" data-aktion="' + aktionName + '" data-wert="' + esc(wert) + '">' + esc(uebersetze(text)) + '</button></div>';
const dlgFehler = (text) => { const f = document.getElementById('l-dlg-fehler'); if (f) f.textContent = text; };

// "+" fragt immer, egal in welchem Reiter; die Anlege-Dialoge bleiben, wie sie sind.
aktion('k-plus', () => {
  const wahl = (a, t, s) => '<button type="button" class="knopf kon-wahl" data-aktion="' + a + '"><b>' + esc(uebersetze(t)) + '</b><span>' + esc(uebersetze(s)) + '</span></button>';
  dialog(dlgKopf('Was legst du an?') +
    '<div class="kon-wahlen">' +
      wahl('k-neu', 'Kunde', 'Eine Firma oder Person, der du Angebote und Rechnungen stellst.') +
      wahl('l-neu', 'Lead', 'Ein Interessent, noch ohne Kundennummer — mit Herkunft, bis er Kunde wird.') +
    '</div>', 'Was legst du an?', 460);
});
aktion('l-neu', () => {
  const d = kz.leads.d;
  if (!d) { toast(uebersetze('Leads nicht geladen'), 'err'); ladeLeads(true); return; }
  const inp = (id, label, typ) => '<label class="feld"><span class="label">' + esc(uebersetze(label)) + '</span><input id="l-neu-' + id + '"' + (typ ? ' type="' + typ + '"' : '') + ' maxlength="200" autocomplete="off"' + (id === 'firma' ? ' autofocus' : '') + '></label>';
  dialog(dlgKopf('Neuer Lead') + inp('firma', 'Firma') +
    '<div class="felder-2">' + inp('vorname', 'Vorname') + inp('nachname', 'Nachname') + '</div>' + inp('email', 'E-Mail', 'email') +
    '<label class="feld"><span class="label">' + esc(uebersetze('Leadquelle')) + '</span><select class="eingabe" id="l-neu-quelle">' +
      d.quellen.map((q) => '<option value="' + esc(q.wert) + '"' + (q.wert === 'sonstiges' ? ' selected' : '') + '>' + esc(quelleLabel(q.wert)) + '</option>').join('') + '</select></label>' +
    dlgFuss('l-neu-ok', '', 'Anlegen'), 'Neuer Lead');
  document.getElementById('dialog').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); AKTIONEN['l-neu-ok'](null, document.querySelector('[data-aktion="l-neu-ok"]')); }
  });
});
aktion('l-neu-ok', (_, el) => mitLauf(el, async () => {
  const v = (id) => { const x = document.getElementById('l-neu-' + id); return x ? x.value : ''; };
  const daten = { firma: v('firma'), vorname: v('vorname'), nachname: v('nachname'), email: v('email'), quelle: v('quelle') };
  if (![daten.firma, daten.vorname, daten.nachname, daten.email].some((x) => x.trim())) { dlgFehler(uebersetze('Firma, Name oder E-Mail fehlt.')); return; }
  let r;
  try { r = await sende('/api/lead', daten); }
  catch (err) { dlgFehler(uebersetze('Lead nicht angelegt') + ': ' + err.message); return; }
  schliesseDialog();
  const dub = r.dubletten || { leads: [], kunden: [] };
  const n = dub.leads.length + dub.kunden.length;
  if (n) kz.hinweis[r.lead.id] = dub;
  if (kz.leads.d) kz.leads.d.leads.unshift({ ...r.lead, kunde_firma: '', kunde_nr: '', angebote_offen: 0 });
  toast(uebersetze('Lead angelegt') + ': ' + r.lead.lead_nr + (n ? ' · ' + num(n) + ' ' + uebersetze('mögliche Dublette') : ''), n ? 'warn' : 'ok');
  if (kz.f !== 'alle') kz.f = 'leads';
  kz.ls = 'offen'; kz.q = ''; kz.angebot = false;
  ladeLeads(true);
  geheZu('kontakte/lead/' + r.lead.id);
}));

aktion('l-umwandeln-frage', (lid) => {
  const l = lFinde(Number(lid));
  if (!l) return;
  const vor = l.kunde_id ? 'zusammengefuehrt' : 'neu';
  const radio = (w, text, extra) => '<label class="l-radio"><input type="radio" name="l-art" value="' + w + '"' + (w === vor ? ' checked' : '') + '>' +
    '<span>' + esc(uebersetze(text)) + (extra ? ' <small>' + esc(uebersetze(extra)) + '</small>' : '') + '</span></label>';
  dialog(dlgKopf('Lead umwandeln', l.lead_nr + ' · ' + leadName(l)) +
    '<fieldset class="l-wahl"><legend class="label">' + esc(uebersetze('Umwandeln')) + '</legend>' +
      radio('neu', 'Neuer Kunde', 'bekommt die nächste Kundennummer') + radio('zusammengefuehrt', 'Zusammenführen mit') +
      kontaktSuche({ attr: ' id="l-ziel"', gruppen: kundenOptionen(l), leerText: '— kein Kunde —', wert: l.kunde_id || '', label: 'Zusammenführen mit' }) + '</fieldset>' +
    dlgFuss('l-umwandeln', l.id, 'Umwandeln'), 'Lead umwandeln');
  // Wer einen Kunden waehlt, meint Zusammenfuehren.
  document.getElementById('l-ziel').addEventListener('change', (e) => {
    if (e.target.value) document.querySelector('input[name="l-art"][value="zusammengefuehrt"]').checked = true;
  });
});
aktion('l-umwandeln', (lid, el) => mitLauf(el, async () => {
  const art = (document.querySelector('input[name="l-art"]:checked') || {}).value;
  const ziel = (document.getElementById('l-ziel') || {}).value;
  if (art === 'zusammengefuehrt' && !ziel) { dlgFehler(uebersetze('Kunde fehlt.')); return; }
  let r;
  try { r = await sende('/api/lead-umwandeln', { id: Number(lid), art, ...(art === 'zusammengefuehrt' ? { kunde_id: Number(ziel) } : {}) }); }
  catch (err) { dlgFehler(uebersetze('Lead nicht umgewandelt') + ': ' + err.message); return; }
  schliesseDialog();
  const u = r.umwandlung;
  Object.assign(lFinde(Number(lid)) || {}, r.lead);
  ladeLeads(true);
  await ladeBelege();   // neuer Kunde und umgehaengte Angebote
  const k = kFinde(u.kontakt_id);
  // ladeBelege schluckt Fehler: ohne neuen Stand fuehrte 'Öffnen' ins Leere.
  if (!k) toast(uebersetze('Kontaktliste nicht aktualisiert, bitte neu laden'), 'warn');
  const wer = [u.kundennummer, k ? kontaktName(k) : ''].filter(Boolean).join(' · ');
  toast(uebersetze(art === 'neu' ? 'Kunde angelegt' : 'Lead zusammengeführt mit') + (art === 'neu' ? ': ' : ' ') + wer,
    'ok', { text: uebersetze('Öffnen'), tu: () => geheZu('kontakte/' + u.kontakt_id) });
}));

aktion('l-verloren-frage', (lid) => {
  const l = lFinde(Number(lid));
  if (!l || !kz.leads.d) return;
  dialog(dlgKopf('Lead als verloren schließen', l.lead_nr + ' · ' + leadName(l)) +
    '<fieldset class="l-wahl"><legend class="label">' + esc(uebersetze('Grund')) + '</legend>' +
      kz.leads.d.gruende.map((g) => '<label class="l-radio"><input type="radio" name="l-grund" value="' + esc(g.wert) + '"><span>' + esc(grundLabel(g.wert)) + '</span></label>').join('') +
    '</fieldset>' + dlgFuss('l-verloren', l.id, 'Als verloren schließen', 'gefahr'), 'Lead als verloren schließen');
});
const setzeVerloren = async (lid, grund) => {
  const r = await sende('/api/lead-verloren', { id: lid, grund });
  Object.assign(lFinde(lid) || {}, r.lead);
  ladeLeads(true);
  return r.lead;
};
aktion('l-verloren', (lid, el) => mitLauf(el, async () => {
  const grund = (document.querySelector('input[name="l-grund"]:checked') || {}).value;
  if (!grund) { dlgFehler(uebersetze('Grund fehlt.')); return; }
  let l;
  try { l = await setzeVerloren(Number(lid), grund); }
  catch (err) { dlgFehler(uebersetze('Lead nicht geändert') + ': ' + err.message); return; }
  schliesseDialog();
  zeichneAnsicht();
  toast(l.lead_nr + ' ' + uebersetze('verloren') + ': ' + grundLabel(grund), 'ok', { text: uebersetze('Rückgängig'), tu: async () => {
    try { await setzeVerloren(l.id, null); } catch (err) { toast(uebersetze('Wiederherstellen fehlgeschlagen') + ': ' + err.message, 'err'); }
    zeichneAnsicht();
  } });
}));

aktion('k-neu', () => {
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Neuer Kontakt')) + '</h2></div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<label class="feld"><span class="label">' + esc(uebersetze('Firma oder Name')) + '</span><input id="k-neu-firma" autofocus maxlength="200" autocomplete="off" aria-describedby="k-neu-fehler"></label>' +
    '<p class="dialog-fehler" id="k-neu-fehler" role="alert"></p>' +
    '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
      '<button type="button" class="knopf primaer" data-aktion="k-neu-ok">' + esc(uebersetze('Anlegen')) + '</button></div>', 'Neuer Kontakt');
  const inp = document.getElementById('k-neu-firma');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); AKTIONEN['k-neu-ok'](null, document.querySelector('[data-aktion="k-neu-ok"]')); } });
});
aktion('k-neu-ok', (_, el) => mitLauf(el, async () => {
  const inp = document.getElementById('k-neu-firma'), fehler = document.getElementById('k-neu-fehler');
  if (!inp) return;
  if (!inp.value.trim()) { fehler.textContent = uebersetze('Firma fehlt.'); inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
  let r;
  try { r = await sende('/api/kontakt', { firma: inp.value }); }
  catch (err) { fehler.textContent = uebersetze('Kontakt nicht angelegt') + ': ' + err.message; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
  schliesseDialog();
  kz.reiter = 'uebersicht'; if (kz.f !== 'alle') kz.f = 'kunden';
  kz.q = ''; kz.angebot = false;
  await ladeBelege();
  geheZu('kontakte/' + r.kontakt.id);
}));

aktion('k-loeschen-frage', (kid) => {
  const k = kFinde(Number(kid));
  if (!k) return;
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Kontakt löschen?')) + '</h2><span class="dim">' + esc(kontaktName(k)) + '</span></div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<p class="dialog-text">' + esc(uebersetze('Ansprechpartner und Projektzuordnungen gehen mit. Gestellte Belege bleiben unverändert — sie tragen eine Abschrift der Anschrift.')) + '</p>' +
    '<p class="dialog-fehler" id="k-weg-fehler" role="alert"></p>' +
    '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu" autofocus>' + esc(uebersetze('Abbrechen')) + '</button>' +
      '<button type="button" class="knopf gefahr" data-aktion="k-loeschen" data-wert="' + k.id + '">' + esc(uebersetze('Kontakt löschen')) + '</button></div>', 'Kontakt löschen');
});
aktion('k-loeschen', (kid, el) => mitLauf(el, async () => {
  const k = kFinde(Number(kid));
  if (!k) return;
  try { await sende('/api/kontakt-loeschen', { id: k.id }); }
  catch (err) { const f = document.getElementById('k-weg-fehler'); if (f) f.textContent = uebersetze('Kontakt nicht gelöscht') + ': ' + err.message; return; }
  schliesseDialog();
  toast(uebersetze('Kontakt gelöscht') + ': ' + kontaktName(k), 'ok');
  delete kz.ap[k.id];
  await ladeBelege();
  neuLaden();
  geheZu('kontakte');
}));

registriere('kontakte', { zeichne: zeichneKontakte });
