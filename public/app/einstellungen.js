'use strict';
/* Einstellungen (Block 4c): Unternavigation mit Suche, ein Abschnitt zur Zeit.
   Autosave (R12): Blur oder Enter schickt den ganzen Abschnitt an den
   bestehenden POST — die Server pruefen alles-oder-nichts. Scheitert es, steht
   der Fehler am Feld und die Eingabe bleibt. Grenzen (min/max/aus) kommen aus
   GET /api/einstellungen bzw. /api/stammdaten, der Server bleibt die Instanz.
   Keine Pro-Abschnitte (R16); nicht Gebautes erscheint nicht. */

Object.assign(EN, {
  'Einstellung suchen …': 'Search settings …', 'Treffer': 'Results', 'Nichts gefunden.': 'Nothing found.',
  'Allgemein': 'General', 'Zeitmodell und Ziel': 'Time model and target', 'Abrechnung': 'Billing',
  'Sätze & Kosten': 'Rates & costs', 'gelten, wenn Projekt oder Kunde nichts Eigenes haben': 'apply when project or customer have nothing of their own',
  'Stundensätze je Projekt': 'Hourly rates per project', 'Satz, Rabatt und Zeitmodell · auch in der Kontakt-Akte': 'Rate, discount and time model · also in the contact record',
  'Positionsvorlagen': 'Item templates', 'füllen eine Position im Beleg-Editor vor': 'prefill an item in the document editor',
  'Belege': 'Documents', 'Stammdaten': 'Master data', 'stehen auf jedem Beleg · Name und Anschrift sind Pflicht': 'appear on every document · name and address are required',
  'System': 'System', 'Darstellung': 'Appearance', 'Sprache und Bewegung': 'Language and motion',
  'Termine aus Google, Outlook, Apple · nur lesen': 'Events from Google, Outlook, Apple · read-only',
  'Lokale Modelle': 'Local models', 'Gegenwert für Modelle ohne API-Preis': 'Equivalent value for models without an API price',
  'Daten & Export': 'Data & export', 'Export, Abgleich und Speicherort': 'Export, sync and storage location',
  'Änderungen speichern sofort': 'Changes save immediately',
  'Eigene Zeit: Fenster um deine Eingaben. Aktivität: Laufzeit des Agenten. Projekte, Vorgänge und Sitzungen können abweichen.':
    'Own time: window around your inputs. Activity: agent runtime. Projects, jobs and sessions can differ.',
  'nach Sachkosten und eigener Zeit · steuert die Margen-Ampel': 'after material costs and own time · drives the margin traffic light',
  'deine eigene Zeit als Kosten · Grundlage der Marge': 'your own time as cost · basis of the margin',
  'wird auf die aktive Zeit verteilt': 'spread over the active time', 'Lücke, ab der eine Sitzung als unterbrochen gilt': 'gap after which a session counts as interrupted',
  '0 schaltet die Kennzahl ab · höchstens 1,5': '0 switches the metric off · at most 1.5',
  'Erlaubt: {min} bis {max}': 'Allowed: {min} to {max}', 'oder {aus} zum Abschalten': 'or {aus} to switch off', 'Wert fehlt': 'Value missing',
  'Zeitmodell': 'Time model', 'Standard-Stundensatz': 'Default hourly rate', 'Selbstkostensatz je Stunde': 'Cost rate per hour',
  'Zielmarge in Prozent': 'Target margin in percent', 'Abo-Preis je Monat': 'Subscription price per month',
  'Umrechnungskurs USD zu EUR': 'Exchange rate USD to EUR', 'Pausenschwelle in Minuten': 'Pause threshold in minutes',
  'Vergleichsfaktor klassische Entwicklung': 'Comparison factor classic development',
  'Pauschale je Million Tokens (lokale Modelle)': 'Flat rate per million tokens (local models)',
  'Selbstkosten je Stunde lokaler Rechenzeit': 'Cost per hour of local compute', 'Zuordnungsfenster lokaler Modelle in Minuten': 'Assignment window of local models in minutes',
  'Name oder Firma': 'Name or company', 'Bank': 'Bank', 'IBAN': 'IBAN', 'BIC': 'BIC', 'E-Mail': 'E-mail', 'Telefon': 'Phone', 'Land': 'Country',
  'Kleinunternehmer nach Par. 19 UStG': 'Small business under § 19 UStG', 'Umsatzsteuersatz in Prozent': 'VAT rate in percent',
  'Zahlungsziel in Tagen': 'Payment term in days', 'Für Rechnungen fehlt noch': 'Still missing for invoices',
  'Kontaktstelle für die E-Rechnung': 'contact point for the e-invoice', 'zweistelliges Kürzel, z. B. DE': 'two-letter code, e.g. DE',
  'Belege ohne Umsatzsteuer, mit Hinweis': 'documents without VAT, with a note', 'für neue Rechnungen · gestellte behalten ihr Fälligkeitsdatum': 'for new invoices · issued ones keep their due date',
  'Bezeichnung': 'Description', 'Satz €/h': 'Rate €/h', 'leer = Projektsatz': 'empty = project rate', '+ Vorlage': '+ Template',
  'Vorlage entfernt': 'Template removed', 'Vorlage nicht entfernt': 'Template not removed', 'Vorlagen nicht geladen': 'Templates not loaded',
  'Noch keine Vorlage.': 'No template yet.',
  'Sprache': 'Language', 'Oberfläche; Belege bleiben deutsch': 'interface; documents stay German', 'Deutsch': 'German', 'Englisch': 'English',
  'Bewegung reduzieren': 'Reduce motion', 'keine Einblendungen und Zähl-Animationen': 'no fade-ins and counting animations',
  'CSV-Export': 'CSV export', 'Vorgänge mit Stunden, Arbeitswert und Kosten im gewählten Zeitraum': 'Jobs with hours, work value and cost in the chosen period',
  'CSV laden': 'Download CSV', 'Jira-Abgleich': 'Jira sync', 'Arbeitswert und Status der Vorgänge nach Jira schreiben': 'Write work value and status of jobs to Jira',
  'Jetzt abgleichen': 'Sync now', 'Jira-Abgleich gelaufen': 'Jira sync done', 'Jira-Abgleich fehlgeschlagen': 'Jira sync failed',
  'Jira ist in config.json nicht eingeschaltet.': 'Jira is not enabled in config.json.',
  'Datenbank': 'Database', 'Zugänge und Pfade nur in': 'Access data and paths only in',
  'Einstellungen nicht geladen': 'Settings not loaded', 'Stammdaten nicht geladen': 'Master data not loaded', 'von': 'from', 'bis': 'to',
  'an': 'on', 'aus': 'off', 'Antwort ohne Daten': 'Response without data',
  'Tätigkeitsarten & Rundung': 'Activities & rounding', 'für manuelle Zeit · eigener Satz optional': 'for manual time · own rate optional',
  'Satz, Rabatt, Zeitmodell und Rundung · auch in der Kontakt-Akte': 'Rate, discount, time model and rounding · also in the contact file',
  'Grundlage für Arbeitszeit heute und Workload': 'Basis for working time today and workload', 'Tagessoll in Stunden': 'Daily target in hours',
  'Standard-Rundung': 'Default rounding', 'für Projekte ohne eigene Rundung · die Rohzeit bleibt gespeichert': 'for projects without own rounding · raw time stays stored',
  'aktuell {n} Min (aus config.json)': 'currently {n} min (from config.json)', 'Tätigkeiten nicht geladen': 'Activities not loaded',
  'eigener Satz €/h': 'own rate €/h', 'Name': 'Name', 'Projektsatz': 'project rate', 'Wird verwendet und kann nicht gelöscht werden.': 'In use and cannot be deleted.',
  '+ Tätigkeit': '+ Activity', 'Leer = Projektsatz inkl. Rabatt. Begleiten zählt als Fokusarbeit.': 'Empty = project rate incl. discount. Accompanying counts as focus work.',
  'Tätigkeit entfernt': 'Activity removed', 'Tätigkeit nicht entfernt': 'Activity not removed',
  'Rundung manueller Zeit in Minuten': 'Rounding of manual time in minutes',
});

// Felder je Abschnitt; Grenzen und Label kommen vom Server.
const E_ABSCHNITTE = [
  { id: 'allgemein', l: 'Allgemein', g: '', sub: 'Zeitmodell und Ziel', felder: ['zeitmodell', 'tagessollStunden', 'zielmargeProzent'] },
  { id: 'saetze', l: 'Sätze & Kosten', g: 'Abrechnung', sub: 'gelten, wenn Projekt oder Kunde nichts Eigenes haben',
    felder: ['stundensatz', 'selbstkostenStunde', 'aboPreisMonat', 'usdToEur', 'gapMinutes', 'vergleichsFaktor'] },
  { id: 'projekte', l: 'Stundensätze je Projekt', g: '', sub: 'Satz, Rabatt, Zeitmodell und Rundung · auch in der Kontakt-Akte', kw: 'satz rabatt zeitmodell rundung projekt rate discount rounding' },
  // Rundung als Segment, nicht als Feld: speichern wie das Zeitmodell (e-rundung).
  { id: 'taet', l: 'Tätigkeitsarten & Rundung', g: '', sub: 'für manuelle Zeit · eigener Satz optional', kw: 'tätigkeit meeting konzept review rundung activity rounding' },
  { id: 'vorlagen', l: 'Positionsvorlagen', g: '', sub: 'füllen eine Position im Beleg-Editor vor', kw: 'vorlage position template' },
  { id: 'stammdaten', l: 'Stammdaten', g: 'Belege', sub: 'stehen auf jedem Beleg · Name und Anschrift sind Pflicht', stamm: true },
  { id: 'darstellung', l: 'Darstellung', g: 'System', sub: 'Sprache und Bewegung', kw: 'sprache englisch deutsch bewegung animation language motion' },
  // Dieselbe Ansicht wie der Kalender-Dialog der Zeiterfassung (zeit.js, zKalZeichnen).
  { id: 'kalender', l: 'Kalender', g: '', sub: 'Termine aus Google, Outlook, Apple · nur lesen', kw: 'kalender ics caldav google outlook apple nextcloud termine abo calendar events' },
  { id: 'lokal', l: 'Lokale Modelle', g: '', sub: 'Gegenwert für Modelle ohne API-Preis', felder: ['lokalEurProMioTokens', 'lokalSelbstkostenStunde', 'lokalZuordnungsfenster'] },
  { id: 'daten', l: 'Daten & Export', g: '', sub: 'Export, Abgleich und Speicherort', kw: 'csv export jira datenbank database' },
];
const E_HINWEIS = {
  zeitmodell: 'Eigene Zeit: Fenster um deine Eingaben. Aktivität: Laufzeit des Agenten. Projekte, Vorgänge und Sitzungen können abweichen.',
  zielmargeProzent: 'nach Sachkosten und eigener Zeit · steuert die Margen-Ampel',
  selbstkostenStunde: 'deine eigene Zeit als Kosten · Grundlage der Marge', aboPreisMonat: 'wird auf die aktive Zeit verteilt',
  gapMinutes: 'Lücke, ab der eine Sitzung als unterbrochen gilt', vergleichsFaktor: '0 schaltet die Kennzahl ab · höchstens 1,5',
  email: 'Kontaktstelle für die E-Rechnung', land: 'zweistelliges Kürzel, z. B. DE', kleinunternehmer: 'Belege ohne Umsatzsteuer, mit Hinweis',
  zahlungszielTage: 'für neue Rechnungen · gestellte behalten ihr Fälligkeitsdatum',
  tagessollStunden: 'Grundlage für Arbeitszeit heute und Workload',
};
const E_EINHEIT = {
  stundensatz: 'EUR/h', selbstkostenStunde: 'EUR/h', zielmargeProzent: '%', aboPreisMonat: 'EUR', gapMinutes: 'Min', vergleichsFaktor: '×',
  lokalEurProMioTokens: 'EUR', lokalSelbstkostenStunde: 'EUR/h', lokalZuordnungsfenster: 'Min', ustSatz: '%', zahlungszielTage: 'Tage',
  tagessollStunden: 'h',
};

const ez = {
  e: { d: null, fehler: null, laedt: false },     // /api/einstellungen
  s: { d: null, fehler: null, laedt: false },     // /api/stammdaten
  v: { d: null, fehler: null, laedt: false },     // /api/vorlagen
  vNeu: [],                                       // tmp-Ids neuer Vorlagen
  t: { d: null, fehler: null, laedt: false },     // /api/taetigkeitsarten
  tNeu: [],                                       // tmp-Ids neuer Taetigkeiten
  q: '',
  hl: null,                                       // hervorgehobenes Feld nach einem Suchtreffer
  csv: null,                                      // { von, bis } fuer den Export
  fokus: null,                                    // Feld, das nach dem Zeichnen den Fokus bekommt
  kette: Object.create(null),                     // Abschnitt -> Promise des laufenden Speicherns
};
// Entwuerfe, Fehler und "Gespeichert" teilen sich den Speicher mit der Akte (kz in kontakte.js).
const eKey = (f) => 'e:' + f;

function eLade(e, pfad, nimm) {
  if (e.laedt || e.fehler) return;              // Fehler: erst "Erneut versuchen" laedt wieder
  e.laedt = true;
  hole(pfad).then((d) => {
    const x = nimm(d);
    if (x == null) throw new Error(uebersetze('Antwort ohne Daten'));
    e.d = x; e.fehler = null;
  }).catch((err) => { if (!e.d) e.fehler = err.message; else toast(err.message, 'err'); })
    .then(() => { e.laedt = false; if (route().name === 'einstellungen') zeichneAnsicht(); });
}
const ladeEinst = () => eLade(ez.e, '/api/einstellungen', (d) => (d && d.werte ? d : null));
const ladeStamm = () => eLade(ez.s, '/api/stammdaten', (d) => (d && d.werte ? d : null));
const ladeVorlagenListe = () => eLade(ez.v, '/api/vorlagen', (d) => (d && Array.isArray(d.vorlagen) ? d.vorlagen : null));

/* ---------- Felder ---------- */
const eWerte = () => (ez.e.d ? ez.e.d.werte : {});
const sWerte = () => (ez.s.d ? ez.s.d.werte : {});
function eAnzeige(f, stamm) {
  const r = (stamm ? sWerte() : eWerte())[f];
  if (!r) return '';
  if (Array.isArray(r.wert)) return r.wert.join('\n');
  return typeof r.wert === 'number' ? zahlText(r.wert) : String(r.wert == null ? '' : r.wert);
}
const eWert = (f, stamm) => (kz.entwurf[eKey(f)] != null ? kz.entwurf[eKey(f)] : eAnzeige(f, stamm));

function grenzText(r) {
  return fuelle('Erlaubt: {min} bis {max}', { min: zahlText(r.min), max: zahlText(r.max) }) +
    (r.aus !== undefined ? ' ' + fuelle('oder {aus} zum Abschalten', { aus: zahlText(r.aus) }) : '');
}

function feldZeile(f, stamm) {
  const r = (stamm ? sWerte() : eWerte())[f];
  if (!r) return '';
  const key = eKey(f);
  const hint = E_HINWEIS[f];
  const aria = ' aria-describedby="m-' + key + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '');
  let w;
  if (f === 'zeitmodell') {
    w = '<span class="segment" role="group" aria-label="' + esc(uebersetze('Zeitmodell')) + '">' + r.wahl.map((m) =>
      '<button type="button" data-aktion="e-zeitmodell" data-wert="' + esc(m) + '" aria-pressed="' + (r.wert === m) + '">' + esc(uebersetze(ZEITMODELL_NAME[m] || m)) + '</button>').join('') + '</span>';
  } else if (r.typ === 'schalter') {
    w = '<button type="button" class="kippschalter" role="switch" data-aktion="e-schalter" data-wert="' + esc(f) + '" aria-checked="' + schalterAn(f) + '" aria-labelledby="el-' + esc(f) + '"' + aria + '>' +
      '<span class="spur"></span>' + esc(uebersetze(schalterAn(f) ? 'an' : 'aus')) + '</button>';
  } else if (r.typ === 'zeilen') {
    w = '<textarea class="eingabe text" id="ef-' + f + '" data-efeld="' + f + '" rows="' + Math.min(6, r.zeilen || 4) + '"' + aria + '>' + esc(eWert(f, stamm)) + '</textarea>';
  } else {
    const zahl = !stamm || r.typ === 'zahl';
    // Nach § 19 UStG gibt es keinen Steuersatz. Das Feld bleibt sichtbar (der Wert
    // gilt nach dem Zurueckschalten wieder), nimmt aber keine Eingabe an.
    const gesperrt = stamm && f === 'ustSatz' && schalterAn('kleinunternehmer');
    w = '<input class="eingabe ' + (zahl ? 'zahl' : 'text') + '" id="ef-' + f + '" data-efeld="' + f + '" value="' + esc(eWert(f, stamm)) + '"' +
      (zahl ? ' inputmode="decimal" title="' + esc(gesperrt ? uebersetze('Nach § 19 UStG wird keine Umsatzsteuer ausgewiesen.') : grenzText(r)) + '"' : r.max ? ' maxlength="' + Number(r.max) + '"' : '') +
      (r.typ === 'email' ? ' type="email"' : '') + (r.typ === 'land' ? ' autocapitalize="characters"' : '') +
      (gesperrt ? ' disabled' : '') + aria + '>';
  }
  // Leere Einheit haelt die Flucht der Eingabefelder.
  const ohneFeld = r.typ === 'schalter' || f === 'zeitmodell';
  const einheit = ohneFeld ? '' : '<span class="einheit">' + esc(uebersetze(E_EINHEIT[f] || '')) + '</span>';
  return '<div class="einst-feld' + (ez.hl === f ? ' hl' : '') + '" data-feldzeile="' + f + '">' +
    // Schalter und Zeitmodell sind Knoepfe, kein Formularfeld: dort kein <label> ohne Ziel,
    // sondern eine Beschriftung, auf die der Schalter per aria-labelledby zeigt.
    (ohneFeld ? '<span class="l" id="el-' + f + '">' : '<label class="l" for="ef-' + f + '">') + esc(uebersetze(r.label)) + (r.pflicht ? ' *' : '') +
      (hint ? '<small>' + esc(uebersetze(hint)) + '</small>' : '') + (ohneFeld ? '</span>' : '</label>') +
    '<div class="w"><div class="zeile">' + w + einheit + '</div>' + feldMeldung(key) + '</div></div>';
}

/* ---------- Speichern ---------- */
const abschnittVon = (f) => E_ABSCHNITTE.find((a) => (a.felder || []).includes(f)) || (sWerte()[f] ? E_ABSCHNITTE.find((a) => a.stamm) : null);

// Ein Abschnitt zur Zeit unterwegs; wer waehrenddessen ein Feld verlaesst,
// loest danach einen weiteren Lauf mit dem dann aktuellen Stand aus.
async function speichereAbschnitt(a) {
  const lauf = 'e:' + a.id;
  // Laeuft schon einer: danach noch einmal; wer wartet, wartet auf beide Laeufe.
  if (kz.laeuft[lauf]) { kz.nochmal[lauf] = true; return ez.kette[lauf]; }
  const stamm = !!a.stamm;
  const W = stamm ? sWerte() : eWerte();
  const felder = stamm ? Object.keys(W) : a.felder.filter((f) => f !== 'zeitmodell');
  const geaendert = felder.filter((f) => kz.entwurf[eKey(f)] != null && kz.entwurf[eKey(f)] !== eAnzeige(f, stamm));
  // Unveraenderte Entwuerfe (zurueckgetippt) raeumen.
  for (const f of felder) if (kz.entwurf[eKey(f)] != null && !geaendert.includes(f)) { delete kz.entwurf[eKey(f)]; delete kz.fehler[eKey(f)]; }
  if (!geaendert.length) { eMeldungen(felder); return; }

  // Zahlen vorab lesen und gegen die Grenzen aus dem GET halten — so stehen alle
  // falschen Felder auf einmal da. Entscheiden tut der Server.
  const daten = {};
  let fehler = false;
  for (const f of geaendert) {
    const r = W[f];
    const roh = eWert(f, stamm);
    delete kz.fehler[eKey(f)];
    if (r.typ === 'schalter') { daten[f] = schalterAn(f); continue; }
    if (stamm && r.typ !== 'zahl') { daten[f] = roh; continue; }
    const s = String(roh).trim();
    // Leer heisst beim Server "unveraendert" — hier also ein Fehler, sonst stuende "Gespeichert" da.
    if (!s) { kz.fehler[eKey(f)] = uebersetze('Wert fehlt'); fehler = true; continue; }
    const n = betragAus(s);
    if (!Number.isFinite(n)) { kz.fehler[eKey(f)] = uebersetze('Keine gültige Zahl'); fehler = true; continue; }
    if ((n < r.min || n > r.max) && !(r.aus !== undefined && n === r.aus)) { kz.fehler[eKey(f)] = grenzText(r); fehler = true; continue; }
    daten[f] = n;
  }
  if (fehler) { eMeldungen(felder); return; }

  kz.laeuft[lauf] = true;
  let fertig;
  ez.kette[lauf] = new Promise((x) => { fertig = x; });
  for (const f of geaendert) kz.laeuft[eKey(f)] = true;
  eMeldungen(geaendert);
  const gesendet = Object.fromEntries(geaendert.map((f) => [f, kz.entwurf[eKey(f)]]));
  try {
    if (stamm) {
      await sende('/api/stammdaten', daten);
      // Gespeichert ist gespeichert: scheitert nur das Nachladen, bleibt der Erfolg stehen.
      try { ez.s.d = await hole('/api/stammdaten'); }
      catch (err) {
        for (const f of geaendert) if (W[f]) W[f].wert = W[f].typ === 'zeilen' ? String(daten[f]).split('\n').map((z) => z.trim()).filter(Boolean) : daten[f];
        toast(uebersetze('Stammdaten nicht geladen') + ': ' + err.message, 'err');
      }
    } else {
      const r = await sende('/api/einstellungen', daten);
      for (const [f, v] of Object.entries(r.geaendert || {})) if (W[f]) W[f].wert = v;
    }
    for (const f of geaendert) {
      if (kz.entwurf[eKey(f)] === gesendet[f]) delete kz.entwurf[eKey(f)];
      kz.ok[eKey(f)] = Date.now();
      const key = eKey(f);
      blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
    }
    neuLaden();
  } catch (err) {
    // Die Meldung beginnt mit dem Label des Feldes (server.js); sonst traegt
    // sie das erste geaenderte Feld.
    const f = felder.find((x) => W[x] && String(err.message).startsWith(W[x].label)) || geaendert[0];
    kz.fehler[eKey(f)] = err.message;
    for (const g of geaendert) delete kz.ok[eKey(g)];
  } finally {
    delete kz.laeuft[lauf];
    for (const f of geaendert) delete kz.laeuft[eKey(f)];
  }
  eMeldungen(felder);
  // Stammdaten: die Liste "fehlt noch" haengt am gespeicherten Stand.
  if (stamm) { const h = document.getElementById('e-fehlt'); if (h) h.outerHTML = fehltHtml(); }
  if (kz.nochmal[lauf]) { delete kz.nochmal[lauf]; await speichereAbschnitt(a); }
  fertig();
}
function eMeldungen(felder) {
  for (const f of felder) {
    const key = eKey(f);
    zeigeMeldung('m-' + key, key);
    const el = document.getElementById('ef-' + f);
    if (el) { if (kz.fehler[key]) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
  }
}

aktion('e-zeitmodell', async (m, el) => {
  const r = eWerte().zeitmodell;
  const key = eKey('zeitmodell');
  if (!r || !r.wahl.includes(m) || kz.laeuft[key]) return;
  if (r.wert === m) { if (kz.fehler[key]) { delete kz.fehler[key]; zeigeMeldung('m-' + key, key); } return; }
  kz.laeuft[key] = true;
  try {
    await sende('/api/einstellungen', { zeitmodell: m });
    r.wert = m;
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
    neuLaden();
  } catch (err) { kz.fehler[key] = err.message; delete kz.ok[key]; }
  delete kz.laeuft[key];
  zeichneAnsicht();
  const neu = document.querySelector('[data-aktion="e-zeitmodell"][data-wert="' + m + '"]');
  if (neu && el) neu.focus();
});
// Der Schalter ist ein Entwurf wie jedes Feld; scheitert das Speichern an ihm, springt er zurueck.
const schalterAn = (f) => (kz.entwurf[eKey(f)] != null ? kz.entwurf[eKey(f)] === 'true' : !!(sWerte()[f] || {}).wert);
aktion('e-schalter', (f) => {
  const r = sWerte()[f];
  if (!r || r.typ !== 'schalter') return;
  kz.entwurf[eKey(f)] = String(!schalterAn(f));
  zeichneAnsicht();
  const a = E_ABSCHNITTE.find((x) => x.stamm);
  speichereAbschnitt(a).then(() => {
    // Scheitert der Abschnitt (an welchem Feld auch immer), springt der Schalter zurueck.
    if (Object.keys(sWerte()).some((x) => kz.fehler[eKey(x)])) delete kz.entwurf[eKey(f)];
    zeichneAnsicht();
    const k = document.querySelector('[data-aktion="e-schalter"][data-wert="' + f + '"]');
    if (k) k.focus();
  });
});

/* ---------- Abschnitte ---------- */
function fehltHtml() {
  const fehlt = ez.s.d && ez.s.d.fehlt || [];
  return '<span id="e-fehlt" class="e-fehlt">' + (fehlt.length ? esc(uebersetze('Für Rechnungen fehlt noch') + ': ' + fehltNamen(fehlt)) : '') + '</span>';
}

function vorlagenHtml() {
  if (!ez.v.d) {
    ladeVorlagenListe();
    return ez.v.fehler ? leer('liste', 'Vorlagen nicht geladen', ez.v.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  }
  const zeilen = [...ez.v.d.map((v) => ({ id: String(v.id), v })), ...ez.vNeu.map((t) => ({ id: t, v: {} }))];
  return '<div class="vorl-tabelle"><div class="vorl-kopf"><span>' + esc(uebersetze('Bezeichnung')) + '</span><span class="rechts">' + esc(uebersetze('Satz €/h')) + '</span><span></span></div>' +
    (zeilen.length ? zeilen.map(({ id, v }) => {
      const key = 'v:' + id;
      const wert = (f) => (kz.entwurf[key + ':' + f] != null ? kz.entwurf[key + ':' + f] : f === 'satz' ? zahlText(v.satz) : (v[f] || ''));
      const aria = ' aria-describedby="m-' + key + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '');
      return '<div class="vorl-zeile" data-vorlzeile="' + esc(id) + '">' +
        '<input class="eingabe" data-vorl="' + esc(id) + '" data-vorlfeld="bezeichnung" name="vorl-bezeichnung" maxlength="200" value="' + esc(wert('bezeichnung')) + '" placeholder="' + esc(uebersetze('Bezeichnung')) + '" aria-label="' + esc(uebersetze('Bezeichnung')) + '"' + aria + '>' +
        '<input class="eingabe zahl" inputmode="decimal" data-vorl="' + esc(id) + '" data-vorlfeld="satz" name="vorl-satz" value="' + esc(wert('satz')) + '" placeholder="' + esc(uebersetze('leer = Projektsatz')) + '" aria-label="' + esc(uebersetze('Satz €/h')) + '"' + aria + '>' +
        '<button type="button" class="mini-knopf" data-aktion="e-vorl-weg" data-wert="' + esc(id) + '" title="' + esc(uebersetze('Entfernen')) + '" aria-label="' + esc(uebersetze('Entfernen') + ' · ' + (v.bezeichnung || '')) + '">×</button>' +
        feldMeldung(key) + '</div>';
    }).join('') : '<span class="dim">' + esc(uebersetze('Noch keine Vorlage.')) + '</span>') +
    '<button type="button" class="knopf klein geist e-plus" data-aktion="e-vorl-plus">' + esc(uebersetze('+ Vorlage')) + '</button></div>';
}

async function speichereVorlage(id) {
  const key = 'v:' + id;
  const tmp = !/^\d+$/.test(id);
  const alt = tmp ? {} : (ez.v.d || []).find((v) => String(v.id) === id);
  if (!alt) return;
  const bez = kz.entwurf[key + ':bezeichnung'] != null ? kz.entwurf[key + ':bezeichnung'] : (alt.bezeichnung || '');
  const satzRoh = kz.entwurf[key + ':satz'] != null ? kz.entwurf[key + ':satz'] : zahlText(alt.satz);
  if (tmp && !bez.trim() && !String(satzRoh).trim()) return;      // leere neue Zeile: nichts zu tun
  if (!tmp && bez === alt.bezeichnung && satzRoh === zahlText(alt.satz)) { delete kz.fehler[key]; zeigeMeldung('m-' + key, key); return; }
  const s = String(satzRoh).trim();
  const satz = s ? betragAus(s) : '';
  if (s && !Number.isFinite(satz)) { kz.fehler[key] = uebersetze('Keine gültige Zahl'); zeigeMeldung('m-' + key, key); return; }
  if (kz.laeuft[key]) { kz.nochmal[key] = true; return; }
  kz.laeuft[key] = true;
  zeigeMeldung('m-' + key, key);
  try {
    const r = await sende('/api/vorlage', { bezeichnung: bez, satz, ...(tmp ? {} : { id: Number(id) }) });
    if (kz.entwurf[key + ':bezeichnung'] === bez) delete kz.entwurf[key + ':bezeichnung'];
    if (kz.entwurf[key + ':satz'] === satzRoh) delete kz.entwurf[key + ':satz'];
    delete kz.fehler[key];
    if (tmp) {
      ez.v.d.push(r.vorlage);
      ez.vNeu = ez.vNeu.filter((t) => t !== id);
      const neuId = String(r.vorlage.id), neuKey = 'v:' + neuId;
      for (const f of ['bezeichnung', 'satz']) if (kz.entwurf[key + ':' + f] != null) { kz.entwurf[neuKey + ':' + f] = kz.entwurf[key + ':' + f]; delete kz.entwurf[key + ':' + f]; }
      befoerdere(key, neuKey, [['data-vorl', id, neuId], ['data-vorlzeile', id, neuId], ['data-wert', id, neuId]]);
      kz.ok[neuKey] = Date.now();
      blendeOkAus(neuKey, () => zeigeMeldung('m-' + neuKey, neuKey));
      delete kz.laeuft[key];
      zeigeMeldung('m-' + neuKey, neuKey);
      const weiter = kz.nochmal[key];
      delete kz.nochmal[key];
      if (weiter || ['bezeichnung', 'satz'].some((f) => kz.entwurf[neuKey + ':' + f] != null)) speichereVorlage(neuId);
      zeichneAnsicht();
      return;
    }
    Object.assign(alt, r.vorlage);
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
  } catch (err) {
    kz.fehler[key] = err.message;
    delete kz.ok[key];
  }
  delete kz.laeuft[key];
  zeigeMeldung('m-' + key, key);
  for (const i of document.querySelectorAll('[data-vorl]')) {
    if (i.dataset.vorl !== id) continue;
    if (kz.fehler[key]) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }
  if (kz.nochmal[key]) { delete kz.nochmal[key]; speichereVorlage(id); }
}
aktion('e-vorl-plus', () => {
  const t = 'neu' + Date.now().toString(36);
  ez.vNeu.push(t);
  zeichneAnsicht();
  const f = document.querySelector('[data-vorl="' + t + '"][data-vorlfeld="bezeichnung"]');
  if (f) f.focus();
});
aktion('e-vorl-weg', (id, el) => {
  if (!/^\d+$/.test(id)) { ez.vNeu = ez.vNeu.filter((t) => t !== id); zeichneAnsicht(); return; }
  const alt = (ez.v.d || []).find((v) => String(v.id) === id);
  if (!alt) return;
  return mitLauf(el, async () => {
    try {
      await sende('/api/vorlage-loeschen', { id: alt.id });
      ez.v.d = ez.v.d.filter((v) => v !== alt);
      toast(uebersetze('Vorlage entfernt') + ': ' + alt.bezeichnung, 'ok', { text: uebersetze('Rückgängig'), tu: async () => {
        try { const r = await sende('/api/vorlage', { bezeichnung: alt.bezeichnung, satz: alt.satz == null ? '' : alt.satz }); ez.v.d.push(r.vorlage); }
        catch (err) { toast(uebersetze('Wiederherstellen fehlgeschlagen') + ': ' + err.message, 'err'); }
        zeichneAnsicht();
      } });
    } catch (err) { toast(uebersetze('Vorlage nicht entfernt') + ': ' + err.message, 'err'); }
    zeichneAnsicht();
  });
});

/* ---------- Taetigkeitsarten & Rundung (Mockup Abrechnung Z. 1203–1212) ---------- */
const ladeTaet = () => eLade(ez.t, '/api/taetigkeitsarten', (d) => (Array.isArray(d) ? d : null));
function taetHtml() {
  const r = eWerte().rundungMinuten;
  const rk = eKey('rundungMinuten');
  const rundung = !r ? '' : '<div class="einst-feld" data-feldzeile="rundungMinuten"><span class="l" id="el-rundungMinuten">' + esc(uebersetze('Standard-Rundung')) +
      '<small>' + esc(uebersetze('für Projekte ohne eigene Rundung · die Rohzeit bleibt gespeichert')) + '</small></span>' +
    '<div class="w"><div class="zeile"><span class="segment" role="group" aria-labelledby="el-rundungMinuten">' + [1, 5, 15].map((m) =>
      '<button type="button" data-aktion="e-rundung" data-wert="' + m + '" aria-pressed="' + (r.wert === m) + '">' + m + ' Min</button>').join('') + '</span>' +
      ([1, 5, 15].includes(r.wert) ? '' : '<span class="hinweis">' + esc(fuelle('aktuell {n} Min (aus config.json)', { n: zahlText(r.wert) })) + '</span>') + '</div>' + feldMeldung(rk) + '</div></div>';
  if (!ez.t.d) {
    ladeTaet();
    return rundung + (ez.t.fehler ? leer('liste', 'Tätigkeiten nicht geladen', ez.t.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>');
  }
  // Bestehende Namen bleiben fest: ein umbenannter Name liesse die Eintraege mit dem alten zurueck.
  const zeilen = [...ez.t.d.map((t) => ({ id: t.name, t })), ...ez.tNeu.map((x) => ({ id: x, t: null }))];
  return rundung + '<div class="vorl-tabelle taet-tabelle"><div class="vorl-kopf"><span>' + esc(uebersetze('Tätigkeit')) + '</span><span class="rechts">' + esc(uebersetze('eigener Satz €/h')) + '</span><span></span></div>' +
    zeilen.map(({ id, t }) => {
      const key = 'ta:' + id;
      const satz = kz.entwurf[key + ':satz'] != null ? kz.entwurf[key + ':satz'] : t ? zahlText(t.satz) : '';
      const aria = ' aria-describedby="m-' + esc(key) + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '');
      const name = t ? '<span class="taet-name">' + esc(t.name) + (t.verwendet ? '<small class="faint">' + esc(anzahl(t.verwendet, 'Eintrag', 'Einträge')) + '</small>' : '') + '</span>'
        : '<input class="eingabe" data-taet="' + esc(id) + '" data-taetfeld="name" maxlength="40" value="' + esc(kz.entwurf[key + ':name'] || '') + '" placeholder="' + esc(uebersetze('Name')) + '" aria-label="' + esc(uebersetze('Tätigkeit')) + '"' + aria + '>';
      return '<div class="vorl-zeile" data-taetzeile="' + esc(id) + '">' + name +
        '<input class="eingabe zahl" inputmode="decimal" data-taet="' + esc(id) + '" data-taetfeld="satz" value="' + esc(satz) + '" placeholder="' + esc(uebersetze('Projektsatz')) + '" aria-label="' + esc(uebersetze('eigener Satz €/h') + (t ? ' · ' + t.name : '')) + '"' + aria + '>' +
        '<button type="button" class="mini-knopf" data-aktion="e-taet-weg" data-wert="' + esc(id) + '"' + (t && t.verwendet ? ' disabled title="' + esc(uebersetze('Wird verwendet und kann nicht gelöscht werden.')) + '"' : ' title="' + esc(uebersetze('Entfernen')) + '"') +
          ' aria-label="' + esc(uebersetze('Entfernen') + (t ? ' · ' + t.name : '')) + '">×</button>' + feldMeldung(key) + '</div>';
    }).join('') +
    '<button type="button" class="knopf klein geist e-plus" data-aktion="e-taet-plus">' + esc(uebersetze('+ Tätigkeit')) + '</button>' +
    '<span class="hinweis">' + esc(uebersetze('Leer = Projektsatz inkl. Rabatt. Begleiten zählt als Fokusarbeit.')) + '</span></div>';
}
aktion('e-rundung', async (m) => {
  const r = eWerte().rundungMinuten, key = eKey('rundungMinuten');
  const n = Number(m);
  if (!r || ![1, 5, 15].includes(n) || r.wert === n || kz.laeuft[key]) return;
  kz.laeuft[key] = true;
  try {
    const x = await sende('/api/einstellungen', { rundungMinuten: n });
    r.wert = (x.geaendert && x.geaendert.rundungMinuten) || n;
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
    neuLaden();
  } catch (err) { kz.fehler[key] = err.message; delete kz.ok[key]; }
  delete kz.laeuft[key];
  zeichneAnsicht();
});
async function speichereTaet(id) {
  const key = 'ta:' + id;
  const alt = (ez.t.d || []).find((t) => t.name === id);
  const name = alt ? alt.name : String(kz.entwurf[key + ':name'] || '').trim();
  const satzRoh = kz.entwurf[key + ':satz'] != null ? kz.entwurf[key + ':satz'] : alt ? zahlText(alt.satz) : '';
  if (!alt && !name) return;                                   // leere neue Zeile: nichts zu tun
  if (alt && satzRoh === zahlText(alt.satz)) { delete kz.entwurf[key + ':satz']; delete kz.fehler[key]; zeigeMeldung('m-' + key, key); return; }
  const s = String(satzRoh).trim();
  const satz = s ? betragAus(s) : '';
  if (s && !Number.isFinite(satz)) { kz.fehler[key] = uebersetze('Keine gültige Zahl'); zeigeMeldung('m-' + key, key); return; }
  if (kz.laeuft[key]) { kz.nochmal[key] = true; return; }
  kz.laeuft[key] = true;
  zeigeMeldung('m-' + key, key);
  try {
    const r = await sende('/api/taetigkeitsarten', { name, satz: satz === '' ? null : satz });
    delete kz.entwurf[key + ':satz']; delete kz.entwurf[key + ':name']; delete kz.fehler[key];
    // Neuer Name gleich einem bestehenden: der Server ueberschreibt (Upsert) — keine zweite Zeile.
    const da = alt || ez.t.d.find((t) => t.name === r.taetigkeit.name);
    if (da) Object.assign(da, r.taetigkeit); else ez.t.d.push({ ...r.taetigkeit, verwendet: 0 });
    if (!alt) ez.tNeu = ez.tNeu.filter((x) => x !== id);
    const neuKey = 'ta:' + r.taetigkeit.name;
    kz.ok[neuKey] = Date.now();
    blendeOkAus(neuKey, () => zeigeMeldung('m-' + neuKey, neuKey));
    // Neue Saetze wirken auf offene Eintraege (Server rechnet nach): Zeiterfassung nachladen.
    zeitNachAenderung();
  } catch (err) { kz.fehler[key] = err.message; delete kz.ok[key]; }
  delete kz.laeuft[key];
  if (!alt && !kz.fehler[key]) {
    // Die Seite zeichnet nicht neu, solange ein Feld den Fokus hat (Schutz laufender
    // Eingaben) — die gespeicherte neue Zeile muss aber zur festen Zeile werden.
    const a = document.activeElement;
    if (a && a.closest && a.closest('[data-taetzeile="' + CSS.escape(id) + '"]')) a.blur();
    zeichneAnsicht();
  } else zeigeMeldung('m-' + key, key);
  if (kz.nochmal[key]) { delete kz.nochmal[key]; speichereTaet(id); }
}
aktion('e-taet-plus', () => {
  const t = 'neu' + Date.now().toString(36);
  ez.tNeu.push(t);
  zeichneAnsicht();
  const f = document.querySelector('[data-taet="' + t + '"][data-taetfeld="name"]');
  if (f) f.focus();
});
aktion('e-taet-weg', (id, el) => {
  const alt = (ez.t.d || []).find((t) => t.name === id);
  if (!alt) { ez.tNeu = ez.tNeu.filter((x) => x !== id); zeichneAnsicht(); return; }
  return mitLauf(el, async () => {
    try {
      await sende('/api/taetigkeitsart-loeschen', { name: alt.name });
      ez.t.d = ez.t.d.filter((t) => t !== alt);
      toast(uebersetze('Tätigkeit entfernt') + ': ' + alt.name, 'ok', { text: uebersetze('Rückgängig'), tu: async () => {
        try { const r = await sende('/api/taetigkeitsarten', { name: alt.name, satz: alt.satz, parallel: !!alt.parallel }); if (!ez.t.d.some((t) => t.name === r.taetigkeit.name)) ez.t.d.push({ ...r.taetigkeit, verwendet: 0 }); zeitNachAenderung(); }
        catch (err) { toast(uebersetze('Wiederherstellen fehlgeschlagen') + ': ' + err.message, 'err'); }
        zeichneAnsicht();
      } });
    } catch (err) { toast(uebersetze('Tätigkeit nicht entfernt') + ': ' + err.message, 'err'); }
    zeichneAnsicht();
  });
});

function darstellungHtml() {
  const reduziert = document.documentElement.dataset.motion === 'off';
  return '<div class="einst-feld"><span class="l">' + esc(uebersetze('Sprache')) + '<small>' + esc(uebersetze('Oberfläche; Belege bleiben deutsch')) + '</small></span>' +
      '<div class="w"><div class="zeile">' + segment('e-sprache', [['de', 'Deutsch'], ['en', 'Englisch']], SPRACHE, 'Sprache') + '</div></div></div>' +
    '<div class="einst-feld"><span class="l">' + esc(uebersetze('Bewegung reduzieren')) + '<small>' + esc(uebersetze('keine Einblendungen und Zähl-Animationen')) + '</small></span>' +
      '<div class="w"><div class="zeile"><button type="button" class="kippschalter" role="switch" data-aktion="e-bewegung" aria-checked="' + reduziert + '" aria-label="' + esc(uebersetze('Bewegung reduzieren')) + '">' +
        '<span class="spur"></span>' + esc(uebersetze(reduziert ? 'an' : 'aus')) + '</button></div></div></div>';
}
aktion('e-sprache', (s) => setzeSprache(s));
aktion('e-bewegung', () => {
  const neu = document.documentElement.dataset.motion === 'off' ? 'on' : 'off';
  merke('motion', neu);
  setzeBewegung();
  zeichneAnsicht();
  const k = document.querySelector('[data-aktion="e-bewegung"]');
  if (k) k.focus();
});

function datenHtml() {
  const z = ez.csv || (ez.csv = { von: aktuellerZeitraum().von, bis: aktuellerZeitraum().bis });
  const jira = !!(state.summary && state.summary.config && state.summary.config.jiraBaseUrl);
  const zeile = (titel, unter, rechts) => '<div class="daten-zeile"><span class="l">' + esc(uebersetze(titel)) + '<small>' + unter + '</small></span><div class="r">' + rechts + '</div></div>';
  return zeile('CSV-Export', esc(uebersetze('Vorgänge mit Stunden, Arbeitswert und Kosten im gewählten Zeitraum')),
      '<input type="date" class="eingabe" id="e-csv-von" value="' + esc(z.von) + '" aria-label="' + esc(uebersetze('von')) + '">' +
      '<input type="date" class="eingabe" id="e-csv-bis" value="' + esc(z.bis) + '" aria-label="' + esc(uebersetze('bis')) + '">' +
      '<a class="knopf" id="e-csv" href="/api/export.csv?' + esc(abfrage({ from: z.von, to: z.bis })) + '" download>' + esc(uebersetze('CSV laden')) + '</a>') +
    zeile('Jira-Abgleich', esc(uebersetze(jira ? 'Arbeitswert und Status der Vorgänge nach Jira schreiben' : 'Jira ist in config.json nicht eingeschaltet.')),
      jira ? '<button type="button" class="knopf" data-aktion="e-jira">' + esc(uebersetze('Jetzt abgleichen')) + '</button>' : '') +
    zeile('Datenbank', '<span class="mono">data/ledger.db</span> · ' + esc(uebersetze('Zugänge und Pfade nur in')) + ' <span class="mono">' + esc((ez.e.d && ez.e.d.pfad) || 'config.json') + '</span>', '');
}
aktion('e-jira', (_, el) => mitLauf(el, async () => {
  try {
    const r = await sende('/api/jira-sync', {});
    toast(uebersetze('Jira-Abgleich gelaufen') + (r.aktualisiert != null ? ': ' + r.aktualisiert : ''), 'ok');
    neuLaden();
  } catch (err) { toast(uebersetze('Jira-Abgleich fehlgeschlagen') + ': ' + err.message, 'err'); }
}));

/* ---------- Suche ---------- */
function suchTreffer(q) {
  const qq = falte(q.trim());
  if (!qq) return [];
  const T = [];
  for (const a of E_ABSCHNITTE) {
    const W = a.stamm ? sWerte() : eWerte();
    for (const f of a.stamm ? Object.keys(W) : a.felder || []) {
      const r = W[f];
      if (!r) continue;
      const text = [uebersetze(r.label), r.label, uebersetze(E_HINWEIS[f] || '')].join(' ');
      if (falte(text).includes(qq)) T.push({ a, f, l: uebersetze(r.label), h: uebersetze(E_HINWEIS[f] || '') });
    }
    if (a.kw && falte([uebersetze(a.l), a.l, a.kw].join(' ')).includes(qq)) T.push({ a, f: '', l: uebersetze(a.l), h: uebersetze(a.sub) });
  }
  return T;
}
aktion('e-springe', (wert) => {
  const [id, f] = String(wert).split(':');
  if (!E_ABSCHNITTE.some((a) => a.id === id)) return;
  ez.q = '';
  ez.hl = f || null;
  ez.fokus = f || null;
  geheZu('einstellungen/' + id);
  const hl = ez.hl;
  setTimeout(() => { if (ez.hl === hl) { ez.hl = null; const z = document.querySelector('.einst-feld.hl'); if (z) z.classList.remove('hl'); } }, 2600);
});

/* ---------- Seite ---------- */
function zeichneEinstellungen(w, teile) {
  const gemerkt = lies('einstellungen.abschnitt', 'allgemein');
  const A = E_ABSCHNITTE.find((a) => a.id === teile[0]) || E_ABSCHNITTE.find((a) => a.id === gemerkt) || E_ABSCHNITTE[0];
  merke('einstellungen.abschnitt', A.id);
  // Hintergrund-Nachladen unterbricht keine Eingabe; die Entwuerfe stehen im Zustand.
  const a = document.activeElement;
  if (a && w.contains(a) && a.matches('.einst-inhalt input, .einst-inhalt textarea') && w.dataset.abschnitt === A.id) return;
  w.dataset.abschnitt = A.id;
  if (!ez.e.d && !ez.e.fehler) ladeEinst();
  // Beide immer: die Suche reicht ueber alle Abschnitte.
  if (!ez.s.d && !ez.s.fehler) ladeStamm();
  if (A.id === 'projekte') ladeSaetze();
  const suche = sucheVorher('e-suche');
  const fv = fokusMerken(w);
  let gruppe = null;
  const nav = '<nav aria-label="' + esc(uebersetze('Einstellungen')) + '">' + E_ABSCHNITTE.map((x) => {
    const g = x.g !== '' && x.g !== gruppe ? (gruppe = x.g, '<span class="g">' + esc(uebersetze(x.g)) + '</span>') : '';
    return g + '<a href="#/einstellungen/' + x.id + '"' + (x.id === A.id && !ez.q ? ' aria-current="page"' : '') + '>' + esc(uebersetze(x.l)) + '</a>';
  }).join('') + '</nav>';

  let inhalt;
  if (ez.q.trim()) {
    const T = suchTreffer(ez.q);
    inhalt = '<div class="einst-karte"><span class="ueberzeile">' + esc(uebersetze('Treffer')) + '</span>' +
      (T.length ? T.map((t) => '<button type="button" class="e-treffer" data-aktion="e-springe" data-wert="' + esc(t.a.id + ':' + t.f) + '">' +
        '<span class="faint">' + esc(uebersetze(t.a.l)) + '</span><span><b>' + esc(t.l) + '</b>' + (t.h ? '<small>' + esc(t.h) + '</small>' : '') + '</span></button>').join('')
        : '<span class="dim">' + esc(uebersetze('Nichts gefunden.')) + '</span>') + '</div>';
  } else {
    let k;
    if (A.felder) {
      k = ez.e.fehler ? leer('liste', 'Einstellungen nicht geladen', ez.e.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
        : !ez.e.d ? '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>' : A.felder.map((f) => feldZeile(f, false)).join('');
    } else if (A.stamm) {
      k = ez.s.fehler ? leer('liste', 'Stammdaten nicht geladen', ez.s.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
        : !ez.s.d ? '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>' : fehltHtml() + Object.keys(sWerte()).map((f) => feldZeile(f, true)).join('');
    } else if (A.id === 'projekte') {
      k = sz.d ? satzTabelle(sz.d.projekte.map((p) => p.project).sort((x, y) => x.localeCompare(y)), true, false) : satzTabelle([], true, false);
    } else if (A.id === 'vorlagen') k = vorlagenHtml();
    else if (A.id === 'taet') k = taetHtml();
    else if (A.id === 'darstellung') k = darstellungHtml();
    else if (A.id === 'kalender') k = '<div id="e-zkal" class="zkal"></div>';
    else k = datenHtml();
    inhalt = '<div class="einst-karte"><div class="einst-kopf"><h2>' + esc(uebersetze(A.l)) + '</h2><span class="sub">' + esc(uebersetze(A.sub)) + '</span>' +
      '<span class="rechts">' + esc(uebersetze('Änderungen speichern sofort')) + '</span></div>' + k + '</div>';
  }
  w.innerHTML = '<div class="einst"><div class="einst-nav">' +
      '<input type="search" class="suche-feld" id="e-suche" value="' + esc(ez.q) + '" placeholder="' + esc(uebersetze('Einstellung suchen …')) + '" aria-label="' + esc(uebersetze('Einstellung suchen …')) + '">' + nav +
    '</div><div class="einst-inhalt">' + inhalt + '</div></div>';
  verdrahteSuche(w, 'e-suche', (v) => { ez.q = v; }, suche);
  fokusZurueck(w, fv);
  if (!ez.q.trim() && A.id === 'kalender') zKalLaden();
  // Sprung aus der Suche: erst nach dem Zeichnen gibt es das Feld.
  if (ez.fokus) {
    const el = w.querySelector('#ef-' + CSS.escape(ez.fokus)) || w.querySelector('[data-feldzeile="' + CSS.escape(ez.fokus) + '"] button');
    ez.fokus = null;
    if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
  }
  const wurzel = w.querySelector('.einst-inhalt');
  verdrahteSaetze(wurzel);
  wurzel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.efeld) kz.entwurf[eKey(t.dataset.efeld)] = t.value;
    else if (t.dataset.vorlfeld) kz.entwurf['v:' + t.dataset.vorl + ':' + t.dataset.vorlfeld] = t.value;
    else if (t.dataset.taetfeld) kz.entwurf['ta:' + t.dataset.taet + ':' + t.dataset.taetfeld] = t.value;
  });
  wurzel.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t.dataset.efeld) {
      const x = abschnittVon(t.dataset.efeld);
      if (x) speichereAbschnitt(x);
    } else if (t.dataset.vorlfeld) {
      const zeile = t.closest('[data-vorlzeile]');
      if (e.relatedTarget && zeile && zeile.contains(e.relatedTarget)) return;
      speichereVorlage(t.dataset.vorl);
    } else if (t.dataset.taetfeld) {
      const zeile = t.closest('[data-taetzeile]');
      if (e.relatedTarget && zeile && zeile.contains(e.relatedTarget)) return;
      speichereTaet(t.dataset.taet);
    }
  });
  wurzel.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || t.tagName === 'TEXTAREA') return;
    if (t.dataset.efeld) { e.preventDefault(); const x = abschnittVon(t.dataset.efeld); if (x) speichereAbschnitt(x); }
    else if (t.dataset.vorlfeld) { e.preventDefault(); speichereVorlage(t.dataset.vorl); }
    else if (t.dataset.taetfeld) { e.preventDefault(); speichereTaet(t.dataset.taet); }
  });
  wurzel.addEventListener('change', (e) => {
    if (e.target.id !== 'e-csv-von' && e.target.id !== 'e-csv-bis') return;
    const von = document.getElementById('e-csv-von').value, bis = document.getElementById('e-csv-bis').value;
    if (!von || !bis) return;
    ez.csv = { von, bis };
    document.getElementById('e-csv').href = '/api/export.csv?' + abfrage({ from: von, to: bis });
  });
}
aktion('e-neu', () => { ez.e.fehler = null; ez.s.fehler = null; ez.v.fehler = null; ez.t.fehler = null; zeichneAnsicht(); });

registriere('einstellungen', { zeichne: zeichneEinstellungen });
