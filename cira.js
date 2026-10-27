'use strict';
// Cira, der Assistent (Masterplan 3.0, C2; BACKEND §2.1). Router in fester
// Reihenfolge: T0 erkennt die Absicht ohne Modell und antwortet aus
// metrics.js/rechnung.js, T1 formuliert lokal (Ollama ueber den Proxy) nur aus
// vorab geholten Fakten, T2 (Claude headless) nur wenn erlaubt, unter dem
// Monatslimit und wenn T1 abgibt oder ausdruecklich gefragt.
//
// Zahlen kommen nur aus den Fakten: der Validator streicht jeden Satz eines
// Modells mit einer Zahl, die weder in den Fakten noch in der Frage steht.
// Gerechnet wird hier nichts — alle Werte stammen aus den bestehenden Modulen.
const fs = require('node:fs');
const config = require('./config.json');
const metrics = require('./metrics');
const rechnung = require('./rechnung');
const kontakte = require('./kontakte');
const zeit = require('./zeit');
const claude = require('./claude');
const { CIRA_ORDNER } = require('./ingest');
const freigaben = require('./freigaben');
const ereignisse = require('./ereignisse');
const herleitung = require('./herleitung');

const KANAELE = ['dock', 'cockpit'];
const QUELLE_DATEN = 'Zahlen aus c2invoice';
// Standards der Einstellungen -> Cira. Eine Quelle: server.js (CIRA_FELDER)
// zeigt sie an, hier wird mit ihnen gerechnet, wenn config.json nichts sagt.
// modellLokal ist seit dem Modell-Block die Rolle "Schnell" (alter Schluessel, bleibt gueltig).
const STANDARD = { anrede: '', modellLokal: '', modellText: '', modellDenken: '', modellCode: '',
  woerterSchnell: '', woerterText: '', woerterDenken: '', woerterCode: '', claudeErlaubt: false, claudeModell: 'sonnet', claudeMonatslimitEur: 5, nichtStoerenAb: '22:00', nichtStoerenBis: '07:00', orbStil: 'partikel', benachrichtigungDesktop: false,
  // C10: Stimme (sprache.js). Browser spricht ohne Einrichtung; ElevenLabs nur auf Wunsch (E2).
  stimmeAnbieter: 'browser', antwortenVorlesen: 'auto', stimmeElevenlabs: '', stimmeModellKurz: 'eleven_flash_v2_5', stimmeModellLang: 'eleven_multilingual_v2', stimmeMonatslimitZeichen: 10000 };
const ciraCfg = () => ({ ...STANDARD, ...(config.cira && typeof config.cira === 'object' ? config.cira : {}) });

/* ---------- Formate (Antworttext, deutsch) ---------- */
const nf = (stellen) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
const eur = (v) => nf(2).format(Number(v) || 0) + ' EUR';
const usd = (v) => nf(2).format(Number(v) || 0) + ' USD';
const std = (v) => nf(1).format(Number(v) || 0) + ' h';
const proz = (v) => nf(1).format(Number(v) || 0) + ' %';
const tag = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ---------- Zeitraum aus dem Satz ---------- */
const MONATE = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
const MONAT_RE = new RegExp('\\b(' + MONATE.join('|') + '|maerz)\\b', 'i');
function zeitraumAus(text, heute = new Date()) {
  const s = String(text).toLowerCase();
  const j = heute.getFullYear(), m = heute.getMonth();
  const monatsName = (y, mm) => MONATE[mm][0].toUpperCase() + MONATE[mm].slice(1) + ' ' + y;
  const monat = (y, mm, label) => ({ von: tag(new Date(y, mm, 1)), bis: tag(new Date(y, mm + 1, 0)), label: label || monatsName(y, mm) });
  if (/\bheute\b/.test(s)) return { von: tag(heute), bis: tag(heute), label: 'Heute' };
  if (/\b(gestern)\b/.test(s)) { const g = new Date(j, m, heute.getDate() - 1); return { von: tag(g), bis: tag(g), label: 'Gestern' }; }
  if (/\bwoche\b/.test(s)) {
    const mo = new Date(j, m, heute.getDate() - ((heute.getDay() + 6) % 7));
    return { von: tag(mo), bis: tag(heute), label: 'Diese Woche' };
  }
  if (/\bquartal\b/.test(s)) { const q = Math.floor(m / 3); return { von: tag(new Date(j, q * 3, 1)), bis: tag(new Date(j, q * 3 + 3, 0)), label: 'Q' + (q + 1) + ' ' + j }; }
  if (/\bjahr\b/.test(s)) return { von: j + '-01-01', bis: j + '-12-31', label: String(j) };
  if (/\b(letzte[nrm]?|vor(ige[nrm]?|monat))\b/.test(s) && /monat/.test(s)) return monat(m === 0 ? j - 1 : j, (m + 11) % 12);
  const mn = s.match(MONAT_RE);
  if (mn) {
    const i = mn[1] === 'maerz' ? 2 : MONATE.indexOf(mn[1]);
    return monat(i > m ? j - 1 : j, i);   // genannter Monat in der Zukunft = Vorjahr
  }
  return monat(j, m);
}
const zeitraumOpts = (z) => ({ from: z.von, to: z.bis });

/* ---------- Validator ---------- */
// Zahlen eines Textes, je Fundstelle alle Lesarten (1.234,5 = 1234.5; 1,234 = 1234 oder 1.234).
function lesarten(token) {
  const t = token.replace(/[.,]$/, '');
  const out = new Set();
  const de = Number(t.replace(/\./g, '').replace(',', '.'));
  const en = Number(t.replace(/,/g, ''));
  if (Number.isFinite(de)) out.add(de);
  if (Number.isFinite(en)) out.add(en);
  return [...out];
}
// Ein volles Datum (01.09.2026) sind drei Zahlen, nicht 1092026: jeder Teil muss belegt sein.
const zahlen = (text) => (String(text).replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, '$1 $2 $3').match(/\d[\d.,]*/g) || []).map(lesarten);
function erlaubteZahlen(fakten, frage) {
  const s = new Set();
  const dazu = (v) => { const n = Number(v); if (!Number.isFinite(n)) return; for (const st of [0, 1, 2]) s.add(Math.round(n * 10 ** st) / 10 ** st); s.add(Math.abs(n)); };
  // Auch die Bezeichnung: eine Rechnungsnummer steht dort, nicht im Wert.
  for (const f of fakten) { dazu(f.v); for (const ls of zahlen(f.t).concat(zahlen(f.k))) ls.forEach(dazu); }
  for (const ls of zahlen(frage || '')) ls.forEach(dazu);
  return s;
}
// Steht unter jeder Antwort, aus der Saetze mit fremden Zahlen entfernt wurden (Silent-Failure H3).
const GESTRICHEN = ' (Hinweis: Sätze mit nicht belegten Zahlen habe ich entfernt.)';
const passt = (erlaubt, kandidaten) => kandidaten.some((k) => [...erlaubt].some((e) => Math.abs(e - k) < 0.005));
// Satzweise: ein Satz mit einer fremden Zahl faellt ganz weg, statt die Zahl
// nur zu loeschen — ein Satz ohne seine Zahl sagt meist etwas anderes.
// Mit codeFrei (Rolle Code) bleiben Codebloecke unangetastet: \d{2} oder eine
// Zeilennummer sind dort keine Geldbetraege. Gezaehlt wird nur der Fliesstext.
function pruefeZahlen(text, fakten, frage, { codeFrei = false } = {}) {
  const erlaubt = erlaubteZahlen(fakten, frage);
  const teile = codeFrei ? String(text).split(/(```[\s\S]*?```)/) : [String(text)];
  let gesamt = 0, gestrichen = 0;
  const aus = teile.map((teil) => {
    if (codeFrei && teil.startsWith('```')) return teil;
    const saetze = teil.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    const pruef = (satz) => (codeFrei ? satz.replace(/`[^`]*`/g, '') : satz);
    const bleibt = saetze.filter((satz) => zahlen(pruef(satz)).every((k) => passt(erlaubt, k)));
    gesamt += saetze.length; gestrichen += saetze.length - bleibt.length;
    return bleibt.join(' ');
  }).filter((x) => x.trim());
  return { text: aus.join(codeFrei ? '\n' : ' '), gestrichen, saetze: gesamt };
}

/* ---------- Fakten (T0) ---------- */
// Ein Fakt: k Bezeichnung, v Wert, t Text fuer Antwort und Prompt, e Einheit
// (eur|usd|h|proz|n) fuer die Buehne, die im Browser formatiert.
function kennzahlenFakten(db, z) {
  const o = zeitraumOpts(z);
  const k = metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
  const f = [
    { k: 'Arbeitswert', v: k.wert.arbeitswert, t: eur(k.wert.arbeitswert), e: 'eur', u: 'eigene Zeit zum Stundensatz' },
    { k: 'Stunden', v: k.aktive_stunden + k.manuell_stunden, t: std(k.aktive_stunden + k.manuell_stunden), e: 'h', u: 'Claude-Arbeit und manuell' },
    { k: 'Abgerechnet', v: k.abgerechnet_eur + k.abgerechnet_manuell_eur, t: eur(k.abgerechnet_eur + k.abgerechnet_manuell_eur), e: 'eur', u: 'auf gestellten Rechnungen' },
    { k: 'Noch nicht abgerechnet', v: k.offen_eur, t: eur(k.offen_eur), e: 'eur', u: 'Arbeitswert noch ohne Rechnung' },
  ];
  if (k.wert.marge_prozent != null) f.push({ k: 'Marge — nach Sachkosten und eigener Zeit', v: k.wert.marge_prozent, t: proz(k.wert.marge_prozent), e: 'proz', ton: k.wert.marge_prozent < 0 ? 'rot' : 'gruen' });
  return { k, fakten: f };
}
function ueberfaelligFakten(db) {
  const posten = rechnung.liste(db).filter((r) => r.status === 'erstellt' && r.ueberfaellig_tage > 0)
    .sort((a, b) => b.ueberfaellig_tage - a.ueberfaellig_tage);
  const summe = posten.reduce((a, r) => a + (Number(r.rest_eur) || 0), 0);
  return { posten, summe, fakten: [{ k: 'Überfällige Rechnungen', v: posten.length, t: String(posten.length), e: 'n' }, { k: 'Überfällig gesamt', v: summe, t: eur(summe), e: 'eur' }]
    // Nummer, Datum und Faelligkeit stehen auch im Text: der geht in den Prompt, die Bezeichnung allein reichte T1 nicht.
    .concat(posten.slice(0, 5).map((r) => ({ k: r.nr + ' ' + r.empfaenger, v: r.rest_eur, t: r.nr + ' vom ' + String(r.erstellt_am).slice(0, 10) + ', fällig ' + r.faellig_am + ', offen ' + eur(r.rest_eur) + ', ' + r.ueberfaellig_tage + ' Tage über Ziel', e: 'eur', u: r.ueberfaellig_tage + ' Tage über Ziel', ton: 'rot' }))) };
}
// Fakten zum Objekt, das der Nutzer gerade ausgewaehlt hat (Dock "Sieht gerade").
// Werte aus rechnung.liste, metrics.byTicket und kontakte.lade; gerechnet wird nur die Summe offener Posten.
function faktenFuerKontext(db, kontext) {
  const id = kontext && typeof kontext.id === 'string' ? kontext.id : '';
  if (!id) return [];
  if (kontext.art === 'rechnung') {
    const r = rechnung.liste(db).find((x) => x.nr === id);
    if (!r) return [];
    // Status vorneweg: "offen 0,00 EUR" heisst bei einer Stornierten nicht "bezahlt".
    return [{ k: 'Ausgewählte Rechnung', t: r.nr }, { k: 'Rechnung Status', t: r.status_abgeleitet || r.status }, { k: 'Rechnung an', t: r.empfaenger }, { k: 'Rechnungsdatum', t: String(r.erstellt_am).slice(0, 10) },
      { k: 'Rechnung fällig am', t: r.faellig_am }, { k: 'Rechnung brutto', v: r.brutto_eur, t: eur(r.brutto_eur), e: 'eur' }, { k: 'Rechnung offen', v: r.rest_eur, t: eur(r.rest_eur), e: 'eur' }];
  }
  if (kontext.art === 'vorgang') {
    const t = metrics.byTicket(db, {}).find((x) => x.ticket === id);
    if (!t) return [];
    const h = t.active_hours + (t.manuell_hours || 0);
    return [{ k: 'Ausgewählter Vorgang', t: t.ticket }, { k: 'Vorgang Stunden — Claude und manuell', v: h, t: std(h), e: 'h' },
      { k: 'Vorgang Arbeitswert — eigene Zeit zum Stundensatz', v: t.arbeitswert, t: eur(t.arbeitswert), e: 'eur' }, { k: 'Vorgang Zeitraum', t: t.first_day + ' bis ' + t.last_day }];
  }
  if (kontext.art === 'kontakt') {
    const k = /^\d{1,9}$/.test(id) ? kontakte.lade(db, Number(id)) : null;
    if (!k) return [];
    const offen = rechnung.liste(db).filter((r) => r.kontakt_id === k.id && r.status === 'erstellt' && r.rest_eur > 0);
    const summe = offen.reduce((a, r) => a + (Number(r.rest_eur) || 0), 0);
    return [{ k: 'Ausgewählter Kontakt', t: k.firma || [k.vorname, k.nachname].filter(Boolean).join(' ') },
      { k: 'Kontakt offene Rechnungen', v: offen.length, t: String(offen.length), e: 'n' }, { k: 'Kontakt offen gesamt', v: summe, t: eur(summe), e: 'eur' }];
  }
  return [];
}

/* ---------- Szenen (Cockpit, README §5.3) ---------- */
// Die Buehne zeigt dieselben Fakten wie der Antworttext, nur als Kacheln,
// Balken oder Kurve. Hier wird nichts gerechnet; Bruchteile fuer die
// Balkenbreite bildet der Browser aus den Werten.
const kachel = (f) => ({ l: f.k, v: Number(f.v) || 0, e: f.e, ...(f.u ? { u: f.u } : {}), ...(f.ton ? { ton: f.ton } : {}) });
function szeneZahlen(titel, fakten, unter) {
  return { typ: 'numbers', titel, gross: kachel(fakten[0]), ...(unter ? { unter } : {}), kacheln: fakten.slice(1).map(kachel) };
}

/* ---------- Rechnungsentwurf (C4) ---------- */
// Wen "Rechnung fuer X" meint: einen Vorgang, eine Liste ("ABC-1, ABC-2 und
// ABC-4"), einen Bereich ("ABC-11 bis 13"), ein Projekt oder einen Kunden
// (Firma oder Name). Liefert die Vorgaenge und Projekte, die in Frage kommen.
const SCHLUESSEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
function rechnungsZiel(db, roh) {
  const x = sauber(roh).trim();
  const zeilen = metrics.byTicket(db, {});
  const je = new Map(zeilen.map((t) => [t.ticket.toLowerCase(), t]));
  const bereich = /^([A-Za-z][A-Za-z0-9]*-)(\d{1,6})\s+bis\s+([A-Za-z][A-Za-z0-9]*-)?(\d{1,6})$/i.exec(x);
  let keys = null;
  if (bereich) {
    // "ABC-11 bis XYZ-13" ist kein Bereich: welches Praefix gemeint ist, bliebe geraten.
    if (bereich[3] && bereich[3].toLowerCase() !== bereich[1].toLowerCase()) return { fehlt: 'Ein Bereich bleibt in einem Kürzel („ABC-11 bis 13“ oder „ABC-11 bis ABC-13“).' };
    const a = Number(bereich[2]), b = Number(bereich[4]);
    if (b < a || b - a > 49) return { fehlt: 'Ein Bereich umfasst höchstens 50 Vorgänge, aufsteigend („ABC-11 bis 13“).' };
    keys = Array.from({ length: b - a + 1 }, (_, i) => bereich[1] + (a + i));
  } else {
    const teile = x.split(/\s*(?:,|\bund\b|&)\s*/i).filter(Boolean);
    if (teile.length > 1 && teile.every((t) => SCHLUESSEL_RE.test(t))) keys = teile;
    else if (je.has(x.toLowerCase())) keys = [x];
  }
  if (keys) {
    const gefunden = keys.map((k) => je.get(k.toLowerCase())).filter(Boolean);
    const fehlen = keys.filter((k) => !je.has(k.toLowerCase()));
    // Im Bereich duerfen Luecken sein; in einer Liste ist jeder genannte Vorgang gemeint.
    if (!gefunden.length || (!bereich && fehlen.length)) return { fehlt: 'Einen Vorgang „' + (fehlen[0] || x) + '“ kenne ich nicht.', sprung: [{ l: 'Vorgänge öffnen', ziel: '#/vorgaenge' }] };
    const liste = gefunden.map((t) => t.ticket).join(', ');
    // Der Bezug ersetzt gleichnamige offene Entwuerfe und ist auf 120 Zeichen begrenzt: lange Listen kurz, aber eindeutig genug.
    const bezug = bereich ? gefunden[0].ticket + ' bis ' + gefunden[gefunden.length - 1].ticket
      : liste.length <= 120 ? liste : gefunden.length + ' Vorgänge ' + gefunden[0].ticket + ' … ' + gefunden[gefunden.length - 1].ticket;
    return { bezug, vorgaenge: gefunden, projekte: [], art: 'vorgang', ...(bereich && fehlen.length ? { luecken: fehlen } : {}) };
  }
  const zu = kontakte.kontaktJeProjekt(db);
  const projekt = [...new Set(zeilen.map((t) => t.project).concat(Object.keys(zu)))].find((p) => p && p.toLowerCase() === x.toLowerCase());
  // Der Kunde haengt am Projekt, auch wenn es nur ticketlose Arbeit hat.
  if (projekt) return { bezug: projekt, vorgaenge: zeilen.filter((t) => t.project === projekt), projekte: [projekt], art: 'projekt', ...(zu[projekt] ? { kontaktId: zu[projekt].id } : {}) };
  const name = (k) => [k.firma, [k.vorname, k.nachname].filter(Boolean).join(' ')].filter(Boolean).map((s) => s.toLowerCase());
  const kunde = kontakte.liste(db).find((k) => name(k).includes(x.toLowerCase()));
  if (kunde) {
    const ps = Object.keys(zu).filter((p) => zu[p].id === kunde.id);
    return { bezug: kunde.firma || [kunde.vorname, kunde.nachname].filter(Boolean).join(' '), vorgaenge: zeilen.filter((t) => ps.includes(t.project)), projekte: ps, kontaktId: kunde.id, art: 'kunde' };
  }
  return { fehlt: '„' + x + '“ kenne ich nicht, weder als Vorgang noch als Projekt oder Kunde.', sprung: [{ l: 'Vorgänge öffnen', ziel: '#/vorgaenge' }] };
}

// Baut die Nutzlast, die rechnung.erstelle spaeter genau so bekommt:
// Claude-Zeit offener Vorgaenge (und ticketloser Projektarbeit), dazu die
// offenen abrechenbaren Zeiteintraege desselben Ziels. Der Leistungszeitraum
// umspannt alles davon. Gerechnet wird hier nichts; die Summen kommen aus
// rechnung.vorschau.
function rechnungsEntwurf(db, roh) {
  const ziel = rechnungsZiel(db, roh);
  if (ziel.fehlt) return { antwort: ziel.fehlt, quelle: QUELLE_DATEN, sprung: ziel.sprung || [] };
  const fehlt = rechnung.fehlendeStammdaten();
  if (fehlt.length) return { antwort: 'Für einen Entwurf fehlen deine Rechnungs-Stammdaten: ' + fehlt.join(', ') + '.', quelle: QUELLE_DATEN, sprung: [{ l: 'Einstellungen öffnen', ziel: '#/einstellungen' }] };
  // Was offen ist (gestellt, teilweise gestellt, offene Zeiteintraege) steht
  // an einer Stelle in rechnung.js; das Board (C7a) rechnet damit genauso.
  const od = rechnung.offeneDaten(db, { vorgaenge: ziel.vorgaenge, projekte: ziel.projekte, kundeId: ziel.art === 'kunde' ? ziel.kontaktId : null });
  const { gestellt, schon, vorgaenge, ausgelassen } = od;
  const zu = kontakte.kontaktJeProjekt(db);
  const kid = ziel.kontaktId || [...new Set(vorgaenge.concat(ziel.vorgaenge).map((t) => zu[t.project] && zu[t.project].id).filter(Boolean))];
  if (Array.isArray(kid) && kid.length > 1) return { antwort: 'Die Vorgänge gehören zu verschiedenen Kunden. Eine Rechnung geht an genau einen.', quelle: QUELLE_DATEN, sprung: [{ l: 'Kontakte öffnen', ziel: '#/kontakte' }] };
  const k = kontakte.lade(db, Array.isArray(kid) ? kid[0] : kid);
  const ohne = vorgaenge.find((t) => !zu[t.project]);
  if (!k || ohne) {
    const p = ohne ? ohne.project : (ziel.vorgaenge[0] || {}).project;
    return { antwort: 'Projekt ' + sauber(p || ziel.bezug) + ' hat keinen Kunden. Ordne es unter Kontakte zu, dann entwerfe ich die Rechnung.', quelle: QUELLE_DATEN, sprung: [{ l: 'Kontakte öffnen', ziel: '#/kontakte' }] };
  }
  if (od.zuViele) return { antwort: 'Es gibt 2000 oder mehr offene Zeiteinträge. Das rechne ich nicht im Ganzen ab, nimm den Beleg-Editor.', quelle: QUELLE_DATEN, sprung: [{ l: 'Zu den Rechnungen', ziel: '#/rechnungen' }] };
  const nichts =(schon.length ? ' ' + schon.map((t) => t.ticket).join(', ') + ' steht schon auf ' + [...new Set(schon.flatMap((t) => gestellt[t.ticket].nummern))].join(', ') + '.' : '') +
    (ausgelassen.length ? ' Nicht enthalten: ' + ausgelassen.join('; ') + '.' : '') + (ziel.luecken && ziel.luecken.length ? ' Ohne Daten: ' + ziel.luecken.join(', ') + '.' : '');
  if (!od.daten) return { antwort: sauber(ziel.bezug) + ' hat nichts Offenes zum Abrechnen.' + nichts, quelle: QUELLE_DATEN, sprung: schon.length ? [{ l: 'Zu den Rechnungen', ziel: '#/rechnungen' }] : [] };
  // Wie der Beleg-Editor: Firma als Name, Person als erste Anschriftzeile.
  const person = [k.vorname, k.nachname].filter(Boolean).join(' ');
  const empfaenger = { name: k.firma || person, anschrift: [k.firma ? person : '', ...(k.anschrift || [])].filter(Boolean) };
  const daten = { ...od.daten, empfaenger, kontaktId: k.id };
  const v = rechnung.vorschau(db, daten);
  if (!(v.brutto_eur > 0)) return { antwort: sauber(ziel.bezug) + ' hat nichts Offenes zum Abrechnen.' + nichts, quelle: QUELLE_DATEN, sprung: [] };
  // Gestellt wird nur, was zu sehen war: aendert sich der Betrag bis zur Freigabe, bricht sie ab (409).
  const f = freigaben.ersetze(db, {
    art: 'rechnung', bezug: ziel.bezug, quelle: 'cira',
    // anlegen() nimmt hoechstens 200 Zeichen Titel; eine lange Liste darf den Entwurf nicht verhindern.
    titel: ('Rechnungsentwurf ' + ziel.bezug + ' an ' + sauber(empfaenger.name)).slice(0, 200),
    text: v.positionen.length + (v.positionen.length === 1 ? ' Position' : ' Positionen') + ' · netto ' + eur(v.netto_eur) + ' · brutto ' + eur(v.brutto_eur) +
      ' · Leistungszeitraum ' + daten.from + ' bis ' + daten.to + '.' + nichts + ' Freigeben stellt die Rechnung mit fortlaufender Nummer, danach geht nur noch Storno.',
    nutzlast: { ...daten, erwartetBrutto: v.brutto_eur },
  });
  const fakten = [{ k: 'Netto', v: v.netto_eur, t: eur(v.netto_eur) }, { k: 'Brutto', v: v.brutto_eur, t: eur(v.brutto_eur) }, { k: 'Positionen', v: v.positionen.length, t: String(v.positionen.length) }];
  return {
    antwort: 'Entwurf für ' + sauber(ziel.bezug) + ' an ' + sauber(empfaenger.name) + ': ' + satzFakten(fakten) + '.' + nichts +
      ' Gestellt ist noch nichts — „Freigeben“ unter „Braucht dich“ stellt sie, im Beleg-Editor kannst du sie vorher anpassen.',
    fakten, quelle: 'Rechnungsvorschau · ' + QUELLE_DATEN, freigabe_id: f.id,
    sprung: ziel.art === 'vorgang' && vorgaenge.length === 1 ? [{ l: 'Vorgang öffnen', ziel: '#/vorgaenge/' + encodeURIComponent(vorgaenge[0].ticket) }] : [{ l: 'Zu den Rechnungen', ziel: '#/rechnungen' }],
    szene: {
      typ: 'invoice', titel: 'Rechnung · Entwurf', empfaenger: empfaenger.name, vorgang: ziel.bezug, zeitraum: { von: daten.from, bis: daten.to },
      // Vorgangspositionen tragen keine Bezeichnung, sondern Vorgang, Stunden und Satz (rechnung.baueMitSperre).
      positionen: v.positionen.slice(0, 8).map((p) => ({ l: String(p.bezeichnung || (p.ticket ? (p.ohne_vorgangsnummer ? 'Projekt ' : 'Vorgang ') + p.ticket : '')),
        h: Number.isFinite(p.stunden) ? p.stunden : null, satz: Number.isFinite(p.satz) ? p.satz : null, v: Number(p.betrag_eur) || 0 })),
      ...(v.positionen.length > 8 ? { unter: (v.positionen.length - 8) + ' weitere Positionen' } : {}),
      hinweis: 'Entwurf — Freigeben stellt die Rechnung',
      netto: v.netto_eur, ust_prozent: v.ust_prozent, ust: v.ust_eur, brutto: v.brutto_eur, kleinunternehmer: !!v.kleinunternehmer,
      herleitung: { art: 'rechnung', id: 'F' + f.id },
    },
  };
}

/* ---------- T0: Absichten ---------- */
// Fakten gehen als Fliesstext in Antworten und Prompts: ohne Steuerzeichen, gekuerzt.
const sauber = (s) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 120);
const satzFakten = (fakten) => fakten.map((f) => sauber(f.k) + ' ' + sauber(f.t)).join(', ');
// Fuer Modelle mit Bezug (u): "Offen" allein verwechselte llama3.2 mit "Überfällig gesamt" (echter Lauf M2).
const promptFakten = (fakten) => fakten.map((f) => sauber(f.k) + (f.u ? ' — ' + sauber(f.u) : '') + ' ' + sauber(f.t)).join(', ');
// „Claude:“ vor einer Absicht = ausdruecklich mit Claude (Angebot angenommen).
const CLAUDE_VORSATZ = /^(?:(?:frag(?:e)?\s+(?:mal\s+)?)?claude\s*[,:]?\s+)/i;
const T0 = [
  {
    // C9c: Entwurf fuer den Vault. Antwortet sofort; der Entwurf kommt als Freigabe
    // unter „Braucht dich“, das Ergebnis als Nachricht im selben Kanal (spaeter).
    // Ergaenzen und Wiki laufen ueber Claude (T2): erst auf Knopfdruck (Owner 15.10.).
    name: 'merken', re: /^(?:(?:frag(?:e)?\s+(?:mal\s+)?)?claude\s*[,:]?\s+)?(?:merke?\s+dir\b|notier(?:e)?\b|erg(?:ä|ae)nze\s+in\s|schreib(?:e)?\s+(?:das\s+)?ins\s+wiki\b)/i,
    tu: ({ text, kontext, merken, spaeter }) => {
      const mitClaude = CLAUDE_VORSATZ.test(text);
      const t = text.replace(CLAUDE_VORSATZ, '');
      let art, satz, ziel = null, tagWort = null, m;
      if ((m = /^erg(?:ä|ae)nze\s+in\s+(.{1,120}?)\s*:\s*([\s\S]{3,2000})$/i.exec(t))) { art = 'ergaenze'; ziel = m[1]; satz = m[2]; }
      else if ((m = /^schreib(?:e)?\s+(?:das\s+)?ins\s+wiki\s*:?\s*([\s\S]{3,2000})$/i.exec(t))) { art = 'wiki'; satz = m[1]; }
      else if ((m = /^(?:merke?\s+dir|notier(?:e)?(?:\s+dir)?)\b/i.exec(t))) {
        art = 'neu';
        let rest = t.slice(m[0].length).trim();
        const f = /^f(?:ü|ue)r\s+([\p{L}\p{N}_/-]{1,40})\s*[,:]?\s*/iu.exec(rest);
        if (f) { tagWort = f[1]; rest = rest.slice(f[0].length); }
        satz = rest.replace(/^[,:]\s*/, '').replace(/^dass\s+/i, '');
      }
      if (!art || !satz || satz.trim().length < 3) return { antwort: 'Was soll ich mir merken? Zum Beispiel: „Merke dir für <Tag>: …“, „Ergänze in <Notiz>: …“ oder „Schreib ins Wiki: …“.', quelle: ciraName() };
      if (!merken) return { antwort: 'Merken geht erst mit einem Vault (Arbeitsbereich mit art „vault“ in config.json).', quelle: ciraName() };
      if (art !== 'neu' && !mitClaude) {
        return { antwort: 'Dafür entwirft Claude die Änderung in einer Kopie von memory/ und wiki/. Das kostet Claude-Nutzung; in den Vault kommt sie erst nach deiner Freigabe.', quelle: ciraName(),
          angebot: { l: 'Mit Claude entwerfen', frage: 'claude: ' + t } };
      }
      merken.entwirf({ art, satz, ziel, tagWort, arbeitsbereich: kontext && kontext.arbeitsbereich }).then((r) => spaeter(r.fehlt
        ? { text: 'Nicht gemerkt: ' + r.fehlt, stufe: 'T0', quelle: ciraName() }
        : { text: 'Entwurf liegt unter „Braucht dich“: ' + r.freigabe.titel + '. In den Vault kommt er erst mit „Freigeben“.', stufe: art === 'neu' ? 'T1' : 'T2', quelle: 'Vault · Entwurf' }), (err) => {
        console.error('Cira merken:', err);
        spaeter({ text: 'Nicht gemerkt: interner Fehler, Details im Serverprotokoll.', stufe: 'T0', quelle: ciraName() });
      });
      return { antwort: art === 'neu' ? 'Ich entwerfe die Notiz. Sie erscheint gleich unter „Braucht dich“; in den Vault kommt sie erst nach deiner Freigabe.'
        : 'Claude entwirft die Änderung in einer Kopie des Vaults. Das kann eine Minute dauern; danach liegt sie unter „Braucht dich“.', quelle: ciraName() };
    },
  },
  {
    name: 'gruss', re: /^(hallo|hi|hey|moin|servus|guten (morgen|tag|abend))\b[\s!.,]*\S{0,20}[\s!.]*$/i,
    tu: () => ({ antwort: 'Hallo. Frag mich nach Zahlen („Wie lief der Monat?“), Überfälligem, Verbrauch, einem Tagesbericht — oder sag „Timer stoppen“.', quelle: ciraName() }),
  },
  {
    name: 'hilfe', re: /^(hilfe|was kannst du|wobei hilfst du)/i,
    tu: () => ({ antwort: 'Direkt, ohne Modell: Kennzahlen eines Zeitraums, Überfälliges, Verbrauch je Projekt, Tagesbericht, Timer stoppen, eine Sitzung auf einen Vorgang buchen. Alles andere formuliere ich lokal oder — wenn erlaubt — mit Claude.', quelle: ciraName() }),
  },
  {
    name: 'tagesbericht', re: /(tagesbericht|bericht (f(ü|ue)r |von )?heute|was hab(e)? ich heute)/i,
    tu: ({ db, heute }) => {
      const z = { von: tag(heute), bis: tag(heute), label: 'Heute' };
      const { fakten } = kennzahlenFakten(db, z);
      const top = metrics.byTicket(db, zeitraumOpts(z)).filter((t) => t.active_hours > 0).sort((a, b) => b.active_hours - a.active_hours).slice(0, 3);
      const zusatz = top.map((t) => ({ k: t.ticket, v: t.active_hours, t: std(t.active_hours) }));
      return {
        antwort: 'Heute: ' + satzFakten(fakten.slice(0, 2)) + '.' + (zusatz.length ? ' Meiste Zeit: ' + zusatz.map((x) => x.k + ' (' + x.t + ')').join(', ') + '.' : ''),
        fakten: fakten.concat(zusatz), quelle: QUELLE_DATEN, sprung: [{ l: 'Zeiterfassung öffnen', ziel: '#/zeit' }],
        szene: szeneZahlen('Heute', fakten), vorlesen: true,
      };
    },
  },
  {
    name: 'ueberfaellig', re: /(überfällig|ueberfaellig|überfaellig|offene posten|nicht bezahlt|wer schuldet)/i,
    tu: ({ db }) => {
      const u = ueberfaelligFakten(db);
      if (!u.posten.length) return { antwort: 'Nichts überfällig.', fakten: u.fakten, quelle: QUELLE_DATEN };
      const liste = u.posten.slice(0, 5).map((r) => r.nr + ' (' + r.empfaenger + ', ' + eur(r.rest_eur) + ', ' + r.ueberfaellig_tage + ' Tage)').join('; ');
      return {
        antwort: u.posten.length + (u.posten.length === 1 ? ' Rechnung ist' : ' Rechnungen sind') + ' überfällig, zusammen ' + eur(u.summe) + ': ' + liste + '.',
        fakten: u.fakten, quelle: QUELLE_DATEN, sprung: [{ l: 'Zu den Rechnungen', ziel: '#/rechnungen' }],
        szene: { ...szeneZahlen('Überfällig', u.fakten.slice(1), u.posten.length + (u.posten.length === 1 ? ' Rechnung' : ' Rechnungen') + ' über dem Zahlungsziel'), herleitung: { art: 'offene-posten', id: '' } },
        zustand: 'overdue',
      };
    },
  },
  {
    name: 'verbrauch', re: /(wo gehen (die )?tokens?|verbrauch|welches projekt (verbraucht|kostet)|tokens? (je|pro) projekt)/i,
    tu: ({ db, text, heute }) => {
      const z = zeitraumAus(text, heute);
      const p = metrics.byProject(db, zeitraumOpts(z)).filter((x) => x.cost_usd > 0).sort((a, b) => b.cost_usd - a.cost_usd);
      const gesamt = p.reduce((a, x) => a + x.cost_usd, 0);
      if (!gesamt) return { antwort: z.label + ': kein Verbrauch erfasst.', quelle: QUELLE_DATEN };
      const top = p.slice(0, 3).map((x) => ({ k: x.project, v: x.cost_usd, t: usd(x.cost_usd) + ' (' + proz(x.cost_usd / gesamt * 100) + ')' }));
      return {
        antwort: 'Verbrauch ' + z.label + ', API-Gegenwert: ' + top.map((x) => x.k + ' ' + x.t).join(', ') + '; gesamt ' + usd(gesamt) + '.',
        fakten: top.concat([{ k: 'gesamt', v: gesamt, t: usd(gesamt) }]), quelle: QUELLE_DATEN, sprung: [{ l: 'Verbrauch öffnen', ziel: '#/analyse' }],
        szene: {
          typ: 'bars', titel: 'Verbrauch ' + z.label + ' — API-Gegenwert', gross: { l: 'gesamt', v: gesamt, e: 'usd' },
          zeilen: p.slice(0, 6).map((x) => ({ l: x.project, v: x.cost_usd, e: 'usd' })),
          ...(p.length > 6 ? { unter: (p.length - 6) + ' weitere Projekte nicht gezeigt' } : {}),
        },
        zustand: 'warn',
      };
    },
  },
  {
    name: 'timer', re: /^(timer (stoppen|anhalten|aus|beenden)|stopp?e? (den |meinen )?timer|halt(e)? (den )?timer an)\b/i,
    tu: ({ db }) => {
      const vorher = zeit.timerAktuell(db);
      if (!vorher) return { antwort: 'Es läuft kein Timer.', quelle: QUELLE_DATEN };
      // Dieselbe Funktion wie POST /api/zeit/timer-stop — keine zweite Schreiblogik.
      const r = zeit.timerStop(db);
      freigaben.protokoll(db, { quelle: 'cira', art: 'timer_stopp', objekt: vorher.ziel_art + ':' + vorher.ziel_schluessel, vorher, nachher: r });
      if (r.verworfen) return { antwort: 'Timer verworfen: unter einer Minute zählt nicht als Arbeit.', quelle: QUELLE_DATEN };
      const min = r.eintrag && Number(r.eintrag.gezaehlt_min);
      return {
        antwort: 'Timer gestoppt und auf ' + vorher.ziel_schluessel + ' gebucht' + (Number.isFinite(min) ? ' (' + std(min / 60) + ').' : '.'),
        fakten: Number.isFinite(min) ? [{ k: 'gebucht', v: min / 60, t: std(min / 60) }] : [], quelle: QUELLE_DATEN, sprung: [{ l: 'Zeiterfassung öffnen', ziel: '#/zeit' }],
      };
    },
  },
  {
    name: 'buchen', re: /^buch(e)?\s+(das|die sitzung|sie|diese sitzung)?\s*(auf|zu)\s+([A-Za-z0-9][A-Za-z0-9._-]{1,39})\s*[.!]?$/i,
    tu: ({ db, m, kontext, bucheVorgang, heute }) => {
      let sid = kontext && kontext.art === 'sitzung' ? kontext.id : null;
      if (!sid) {
        // Ohne gewaehlte Sitzung nur, wenn genau eine Claude-Sitzung gerade laeuft.
        const live = db.prepare(`SELECT DISTINCT session_id FROM events WHERE ts >= ? AND COALESCE(source, '') <> 'lokal' AND project <> ?`)
          .all(new Date(heute.getTime() - 120000).toISOString(), metrics.CIRA_PROJEKT).map((r) => r.session_id);
        if (live.length !== 1) return { antwort: live.length ? 'Es laufen ' + live.length + ' Sitzungen — welche meinst du? Wähle sie in der Live-Ansicht und frag dort noch einmal.' : 'Gerade läuft keine Sitzung, die ich buchen könnte.', quelle: QUELLE_DATEN };
        sid = live[0];
      }
      const alt = db.prepare('SELECT ticket FROM overrides WHERE session_id = ?').get(sid);
      // Dieselbe Funktion wie POST /api/buchen.
      const r = bucheVorgang(db, { session_id: sid, vorgang: m[4] });
      freigaben.protokoll(db, { quelle: 'cira', art: 'buchen', objekt: sid, vorher: { ticket: alt ? alt.ticket : null }, nachher: { ticket: r.ticket } });
      return { antwort: 'Sitzung ' + sid.slice(0, 8) + ' auf ' + r.ticket + ' gebucht.', quelle: QUELLE_DATEN, sprung: [{ l: 'Vorgang öffnen', ziel: '#/vorgaenge/' + encodeURIComponent(r.ticket) }] };
    },
  },
  {
    // C6b: nur vorbereiten. Gestartet wird in der Szene per Klick — eine Sitzung kostet Claude-Nutzung.
    name: 'skill', re: /^starte?\s+(?:den\s+|das\s+|die\s+)?(?:skill\s+)?\/?([\w.:-]{1,80})\s+(?:f(?:ü|ue)r|auf)\s+([A-Za-z0-9][A-Za-z0-9._-]{1,39})(?:\s*[:,–-]\s*(.{1,2000}?))?\s*[.!]?$/i,
    tu: ({ m, skillOrte }) => {
      const befehl = m[1];
      const vorgang = m[2].replace(/\.+$/, '').toUpperCase();
      const orte = skillOrte(befehl);
      if (!orte.length) return { antwort: 'Den Skill /' + befehl + ' finde ich in keinem Arbeitsbereich (~/.claude/skills oder .claude/skills im Ordner).', quelle: ciraName() };
      return {
        antwort: 'Ablauf vorbereitet: /' + befehl + ' für ' + vorgang + '. Starten kostet Claude-Nutzung, deshalb erst auf Klick.', quelle: ciraName(),
        szene: { typ: 'skill', titel: 'Skill-Ablauf · ' + vorgang, entwurf: { befehl, vorgang, ziel: (m[3] || '').trim(), arbeitsbereiche: orte } },
      };
    },
  },
  {
    // Kurve der abgeschlossenen Wochen, wie die Marge-Kachel in Finanzen.
    // Ein „warum“ verlangt eine Begruendung und geht wie bei den Kennzahlen an das Modell.
    name: 'marge', re: /\bmarge\b/i, nicht: /^(warum|wieso|weshalb)\b/i,
    tu: ({ db, heute }) => {
      const wochen = metrics.margeJeWoche(db, { bis: tag(heute), wochen: 12 }, rechnung.abrechnung(db));
      // Eine Woche ohne Marge traegt ihren Grund, sonst sieht die Luecke im Chart wie ein Fehler aus.
      const grund = (k) => (k.erloes > 0 ? 'kein Selbstkostensatz' : k.eigene_stunden > 0 ? 'kein Erlös' : 'keine Arbeit');
      const punkte = wochen.map((w) => (w.kennzahlen.wert.marge_prozent == null
        ? { x: w.montag, v: null, grund: grund(w.kennzahlen.wert) } : { x: w.montag, v: w.kennzahlen.wert.marge_prozent }));
      const mit = punkte.filter((p) => p.v != null);
      if (!mit.length) return { antwort: 'Für die letzten zwölf abgeschlossenen Wochen liegt keine Marge vor (kein Arbeitswert).', quelle: QUELLE_DATEN, sprung: [{ l: 'Finanzen öffnen', ziel: '#/hub' }] };
      const letzte = mit[mit.length - 1], davor = mit.length > 1 ? mit[mit.length - 2] : null;
      const fakten = [{ k: 'Marge Woche ab ' + letzte.x, v: letzte.v, t: proz(letzte.v), e: 'proz' }]
        .concat(davor ? [{ k: 'Marge Woche ab ' + davor.x, v: davor.v, t: proz(davor.v), e: 'proz' }] : []);
      return {
        antwort: 'Marge nach Sachkosten und eigener Zeit, je abgeschlossene Woche: ' + satzFakten(fakten) + '. Den Verlauf der letzten zwölf Wochen zeige ich dir.' +
          (punkte.some((p) => p.v == null) ? ' Ohne Marge: ' + punkte.filter((p) => p.v == null).map((p) => 'Woche ab ' + p.x + ' (' + p.grund + ')').join(', ') + '.' : ''),
        fakten, quelle: QUELLE_DATEN, sprung: [{ l: 'Finanzen öffnen', ziel: '#/hub' }],
        szene: { typ: 'chart', titel: 'Marge je Woche — nach Sachkosten und eigener Zeit', gross: { l: 'letzte Woche', v: letzte.v, e: 'proz' }, punkte, e: 'proz',
          // Rechenweg der letzten Woche mit Marge, Montag bis Sonntag.
          herleitung: { art: 'marge', id: letzte.x + '_' + tag(new Date(new Date(letzte.x + 'T12:00:00').getTime() + 6 * 864e5)) } },
        zustand: letzte.v < 0 ? 'warn' : 'paid',
      };
    },
  },
  {
    // Entwurf plus Freigabe (C4): rechnung.vorschau stellt nichts und vergibt
    // keine Nummer; gestellt wird erst, wenn die Freigabe "rechnung" bestaetigt
    // ist (Registry in server.js, derselbe Weg wie POST /api/rechnung).
    name: 'rechnung', re: /^(?:rechnung|rechnungsentwurf|entwurf)\s+(?:f(?:ü|ue)r|zu|an)\s+(.{2,80}?)\s*[.!?]?$/i,
    tu: ({ db, m }) => rechnungsEntwurf(db, m[1]),
  },
  {
    name: 'kennzahlen', re: /(wie (lief|läuft|laeuft|war|steht|sieht)\b|kennzahlen|\bzahlen (f(ü|ue)r|vom|von|des|der|im)\b|^(umsatz|arbeitswert)\b)/i,
    nicht: /^(warum|wieso|weshalb)\b/i,
    tu: ({ db, text, heute }) => {
      const z = zeitraumAus(text, heute);
      const { fakten } = kennzahlenFakten(db, z);
      return { antwort: z.label + ': ' + satzFakten(fakten) + '.', fakten, quelle: QUELLE_DATEN, sprung: [{ l: 'Finanzen öffnen', ziel: '#/hub' }], szene: { ...szeneZahlen(z.label, fakten), zeitraum: { von: z.von, bis: z.bis }, herleitung: { art: 'marge', id: z.von + '_' + z.bis } } };
    },
  },
];
const ciraName = () => (typeof ciraCfg().name === 'string' && ciraCfg().name.trim()) || 'Cira';

function t0(text) {
  for (const a of T0) {
    const m = text.match(a.re);
    if (m && !(a.nicht && a.nicht.test(text))) return { absicht: a, m };
  }
  return null;
}

/* ---------- T1: lokal ---------- */
const T2_MARKE = '[T2]';
// T1 gibt ab, sobald mehr als eine Antwort aus den Fakten verlangt ist; T2 ist
// genau dafuer da und darf entwerfen. Zahlen sind fuer beide an die Fakten gebunden.
// Je Rolle ein Auftrag; die Zahlenregel gilt fuer alle. Gibt ein Modell mit der
// Marke ab, fragt Cira die naechste Stufe (eskaliere), Claude nur auf Knopfdruck.
const ROLLEN = ['schnell', 'text', 'denken', 'code'];
const ROLLEN_NAME = { schnell: 'Schnell', text: 'Text', denken: 'Denken', code: 'Code' };
const AUFTRAG = {
  schnell: 'Antworte in höchstens drei kurzen Sätzen. Wenn die Aufgabe mehr verlangt als eine Antwort aus den Fakten (einen Text entwerfen, eine Begründung, Code), antworte nur mit ' + T2_MARKE + '.',
  text: 'Du darfst Texte entwerfen, umformulieren und zusammenfassen. Was nach außen gehen soll, gibst du nur als Entwurf zurück; senden kannst du nichts. Brauchst du Dateien oder Daten, die dir fehlen, antworte nur mit ' + T2_MARKE + '.',
  denken: 'Begründe knapp und nachvollziehbar, Schritt für Schritt. Wenn du die Frage ohne weitere Daten nicht verlässlich beantworten kannst, antworte nur mit ' + T2_MARKE + '.',
  code: 'Erkläre Fehlermeldungen oder schreibe kurzen Code in Codeblöcken. Dateien des Nutzers siehst du nicht; brauchst du sie, antworte nur mit ' + T2_MARKE + '.',
};
function systemPrompt(fakten, kontext, stufe = 'schnell') {
  return [
    'Du bist ' + ciraName() + ', die Assistentin in c2invoice, einem Abrechnungswerkzeug für Claude-Code-Arbeit. Antworte auf Deutsch' + (stufe === 'T2' ? ', knapp.' : '.'),
    'Verwende Zahlen ausschließlich aus den FAKTEN. Rechne nichts nach und schätze nichts. Fehlt eine Zahl, sag, dass sie dir nicht vorliegt.',
    // Echter Lauf 15.10.: ohne diesen Satz verweigerte deepseek-r1 jede allgemeine Frage ("FAKTEN enthalten keine Informationen").
    stufe === 'schnell' ? '' : 'Allgemeines Wissen und Begründungen darfst du nutzen; nur Zahlen über den Nutzer und sein Geschäft müssen aus den FAKTEN stammen.',
    // Die Oberflaeche zeigt Text, kein Markdown (echter Lauf: **Betrag** stand roh da).
    'Schreibe reinen Text ohne Markdown-Hervorhebungen; nur Code gehört in Codeblöcke.',
    stufe === 'T2' ? 'Du darfst Texte entwerfen, formulieren und erklären. Was nach außen gehen soll, gibst du nur als Entwurf zurück; senden kannst du nichts.' : AUFTRAG[stufe] || AUFTRAG.schnell,
    kontext && kontext.titel ? 'Der Nutzer sieht gerade: ' + sauber(kontext.titel) + '.' : '',
    'FAKTEN: ' + (fakten.length ? promptFakten(fakten) : 'keine'),
  ].filter(Boolean).join('\n');
}

// Woerter je Rolle (Wortanfang, klein). Eigene Woerter aus den Einstellungen kommen dazu.
const ROLLEN_WOERTER = {
  code: ['code', 'skript', 'script', 'regex', 'regulär', 'funktion', 'fehlermeldung', 'stacktrace', 'stack trace', 'exception', 'bug', 'javascript', 'typescript', 'python', 'sql', 'json', 'powershell', 'bash', 'syntax', 'kompilier', 'programmier'],
  text: ['entwirf', 'entwurf', 'formulier', 'umformulier', 'schreib', 'mail', 'e-mail', 'brief', 'anschreiben', 'nachricht', 'zusammenfass', 'übersetz', 'uebersetz', 'text', 'freundlich', 'höflich', 'mahnung'],
  denken: ['warum', 'wieso', 'weshalb', 'vergleich', 'analys', 'begründ', 'erklär', 'bewert', 'abwäg', 'soll ich', 'sollte ich', 'lohnt', 'strategie', 'ursache', 'was wäre', 'was waere', 'vor- und nachteil', 'vorteil', 'nachteil', 'empfiehl', 'empfehl', 'plan'],
  schnell: ['wie viel', 'wieviel', 'wie hoch', 'wann', 'wer ', 'welche', 'zeig', 'nenn', 'stand ', 'status', 'hallo', 'danke'],
};
// Allgemeine Woerter zaehlen halb: "Schreib eine Regex" ist Code, nicht Text.
const SCHWACH = new Set(['schreib', 'text', 'erklär', 'plan', 'nachricht', 'zeig', 'stand']);
const eigeneWoerter = (c, rolle) => String(c['woerter' + ROLLEN_NAME[rolle]] || '').split(',').map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 2);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Rolle einer Frage: Woerter sind ein Signal, Laenge und Satzzahl ein zweites.
// Ohne klares Signal antwortet "Denken" — lieber langsamer als falsch.
function waehleRolle(text, c = ciraCfg()) {
  const t = String(text).toLowerCase();
  const woerter = t.split(/\s+/).filter(Boolean).length;
  const saetze = t.split(/[.!?]+\s/).filter((s) => s.trim()).length;
  const treffer = {};
  for (const r of ROLLEN) {
    const eigen = eigeneWoerter(c, r);
    const hits = [...new Set(ROLLEN_WOERTER[r].concat(eigen))].filter((w) => new RegExp('(^|[^\\p{L}])' + reEsc(w.trim()) + (w.endsWith(' ') ? '(?![\\p{L}])' : ''), 'u').test(t)).map((w) => w.trim());
    treffer[r] = { hits, eigen: hits.filter((w) => eigen.includes(w)), wert: hits.reduce((n, w) => n + (SCHWACH.has(w) && !eigen.includes(w) ? 0.5 : 1), 0) };
  }
  const nenne = (r) => '„' + treffer[r].hits.slice(0, 2).join('“, „') + '“' + (treffer[r].eigen.length ? ' (eigene Wörter)' : '');
  const fach = ['code', 'text', 'denken'].filter((r) => treffer[r].hits.length).sort((a, b) => treffer[b].wert - treffer[a].wert);
  if (fach.length) {
    if (fach.length > 1 && treffer[fach[0]].wert === treffer[fach[1]].wert) return { rolle: 'denken', grund: 'mehrdeutig: ' + nenne(fach[0]) + ' und ' + nenne(fach[1]) };
    return { rolle: fach[0], grund: nenne(fach[0]) };
  }
  const lang = woerter > 40 || saetze >= 3;
  if (treffer.schnell.hits.length && !lang) return { rolle: 'schnell', grund: nenne('schnell') + ', kurze Frage' };
  if (woerter <= 4 && !lang) return { rolle: 'schnell', grund: 'sehr kurz, kein anderes Signal' };
  return { rolle: 'denken', grund: lang ? 'lange Frage (' + woerter + ' Wörter, ' + saetze + ' Sätze)' : 'kein klares Signal' };
}
// Welches Modell eine Rolle bekommt: das eigene, sonst das naechste eingestellte.
function modellFuer(rolle, c = ciraCfg()) {
  const von = (r) => String((r === 'schnell' ? c.modellLokal : c['modell' + ROLLEN_NAME[r]]) || '').trim();
  for (const r of [rolle, 'schnell', 'denken', 'text', 'code']) if (von(r)) return { modell: von(r), ersatz: r !== rolle ? r : null };
  return null;
}
// Gesprochene Laenge und Zeit je Rolle: Denken braucht laenger (Reasoning-Modelle denken vorher).
// Tokens inklusive Nachdenken: qwen3/deepseek-r1 denken vorher, 300 reichten dafuer nicht.
const GRENZE = { schnell: { tokens: 800, ms: 45000 }, text: { tokens: 1500, ms: 90000 }, denken: { tokens: 2500, ms: 120000 }, code: { tokens: 1500, ms: 90000 } };
// Fehlerursachen getrennt (Silent-Failure M1): nur ein Netzfehler heisst "nicht
// erreichbar"; ein HTTP-Fehler meist falscher Modellname oder zu wenig Speicher.
// system: eigener Systemprompt (C9 ausText), sonst der aus den Fakten.
async function t1(text, fakten, kontext, fetchFn, modell, rolle = 'schnell', signal = null, system = null) {
  const lm = config.lokaleModelle || {};
  if (!lm.upstreamUrl) return { fehlt: 'Lokale Modelle sind nicht eingerichtet (lokaleModelle in config.json).' };
  // Ueber den Proxy, damit die Nutzung wie jede lokale Anfrage erfasst wird.
  const url = 'http://127.0.0.1:' + (Number(lm.proxyPort) || 11435) + '/v1/chat/completions';
  const g = GRENZE[rolle] || GRENZE.schnell;
  let r;
  try {
    r = await fetchFn(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      // qwen3 denkt sonst vor jeder Antwort; nur die Rolle Denken soll das (M-9). deepseek-r1 kennt keinen Schalter.
      body: JSON.stringify({ model: modell, temperature: 0.2, max_tokens: g.tokens, stream: false, messages: [{ role: 'system', content: system || systemPrompt(fakten, kontext, rolle) },
        { role: 'user', content: text + (rolle !== 'denken' && /^qwen3/i.test(modell) ? ' /no_think' : '') }] }),
      // Schliesst der Browser, endet auch die lokale Anfrage (Silent-Failure M2).
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(g.ms)]) : AbortSignal.timeout(g.ms),
    });
  } catch (err) {
    if (err && err.name === 'TimeoutError') return { fehlt: 'Zeitgrenze überschritten' };
    if (err && err.name === 'AbortError') return { fehlt: 'abgebrochen', abbruch: true };
    console.error('Cira T1 ' + modell + ':', err && err.message);
    return { fehlt: 'nicht erreichbar' };
  }
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    const grund = d && d.error ? String(d.error.message || d.error).slice(0, 120) : '';
    console.error('Cira T1 ' + modell + ': HTTP ' + r.status + ' ' + grund);
    return { fehlt: 'Modellserver meldet Fehler ' + r.status + (grund ? ' (' + grund + ')' : '') };
  }
  const j = await r.json().catch(() => null);
  if (!j) return { fehlt: 'ungültige Serverantwort' };
  const wahl = j.choices && j.choices[0];
  // Reasoning-Modelle (deepseek-r1, qwen3) schreiben ihr Nachdenken teils in <think>…</think>.
  const roh = wahl && wahl.message ? String(wahl.message.content || '') : '';
  const inhalt = roh.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim();
  // Abgeschnitten ist keine Antwort: der letzte Satz koennte genau das Gegenteil sagen.
  if (wahl && wahl.finish_reason === 'length') return { fehlt: inhalt ? 'Token-Grenze erreicht, Antwort abgeschnitten' : 'Token-Grenze beim Nachdenken erreicht' };
  if (!inhalt) return { fehlt: roh.trim() ? 'nur nachgedacht, keine Antwort' : 'leere Antwort' };
  return { text: inhalt, tokens: (j.usage && j.usage.total_tokens) || 0 };
}
// Nach Rolle die Kette der Versuche: Fachrolle, dann Denken. Claude bietet die Antwort nur an.
const KETTE = { schnell: ['schnell', 'denken'], text: ['text', 'denken'], code: ['code', 'denken'], denken: ['denken'] };

/* ---------- Dienst ---------- */
// kontextQuellen: { art: (id) => fakten[] } fuer Objekte anderer Module (C9: briefing).
// merken: Dienst aus merken.js (C9c), fuer die Absicht „merke dir“.
function erzeuge({ db, bucheVorgang, spawnFn, fetchFn = fetch, claudeExe, jetzt = () => new Date(), t2MaxMs = 120000, skillOrte = () => [], kontextQuellen = {}, merken = null }) {
  let t2Laeuft = false;
  freigaben.aufraeumen(db);

  function speichere(kanal, rolle, n, kontext) {
    // route_json traegt Rolle, Modell, Grund, Versuche und ein Claude-Angebot (Modell-Block).
    const route = n.route ? { ...n.route, ...(n.angebot ? { angebot: n.angebot } : {}) } : null;
    return Number(db.prepare(`INSERT INTO cira_nachricht (zeit, kanal, rolle, text, stufe, kosten_eur, quelle, szene_json, sprung_json, kontext_json, route_json, gesprochen)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(jetzt().toISOString(), kanal, rolle, n.text, n.stufe || null, n.kosten_eur ?? null, n.quelle || null,
      n.szene ? JSON.stringify(n.szene) : null, n.sprung && n.sprung.length ? JSON.stringify(n.sprung) : null, kontext ? JSON.stringify(kontext) : null,
      route ? JSON.stringify(route) : null, n.gesprochen === true ? 1 : null).lastInsertRowid);
  }

  // Ein Claude-Lauf unter Monatslimit, Budget und Sperre (C9c braucht Profil und Ordner).
  // pruefe(satz) filtert den Textstrom satzweise; ohne pruefe geht er ungefiltert durch.
  async function t2Lauf({ prompt, profil = 'lesen', cwd = CIRA_ORDNER, zusatzVerbot = [], onText = () => {}, pruefe = null, signal = null }) {
    const c = ciraCfg();
    if (c.claudeErlaubt !== true) return { fehlt: 'Dafür bräuchte ich Claude (T2). Das ist ausgeschaltet (Einstellungen → Cira).' };
    const limit = Number(c.claudeMonatslimitEur) || 0;
    const verbraucht = metrics.ciraKostenMonatEur(db, { jetzt: jetzt() });
    if (!(limit > 0) || verbraucht >= limit) return { fehlt: 'Das Monatslimit für Claude ist erreicht (' + eur(verbraucht) + ' von ' + eur(limit) + ').' };
    if (t2Laeuft) return { fehlt: 'Claude arbeitet noch an der letzten Frage.' };
    t2Laeuft = true;
    // Ein Lauf darf hoechstens den Rest des Monatslimits kosten (--max-budget-usd).
    // Bis sein Ergebnis da ist, zaehlt genau dieser Rest als verbraucht — so
    // bleibt das Limit auch nach Absturz oder Abbruch ohne Kostenangabe dicht.
    const budgetUsd = (limit - verbraucht) / metrics.usdToEur(1);
    const laufId = db.prepare('INSERT INTO cira_lauf (zeit, profil, ok, kosten_usd, tokens, fehler) VALUES (?,?,0,?,0,?)')
      .run(jetzt().toISOString(), profil, budgetUsd, 'laeuft; Kosten bis zum Ergebnis als Obergrenze gebucht').lastInsertRowid;
    let uhr = null, abbruch = null;
    try {
      if (cwd === CIRA_ORDNER) fs.mkdirSync(CIRA_ORDNER, { recursive: true });
      // Satzweise weiterreichen, erst nach der Pruefung: was im Strom steht, steht auch in der Antwort.
      let puffer = '';
      const weiter = (ende) => {
        const teile = puffer.split(/(?<=[.!?])\s+/);
        puffer = ende ? '' : teile.pop();
        for (const s of teile) { const t = pruefe ? pruefe(s) : s; if (t) onText(t + ' '); }
      };
      const l = claude.lauf({
        exe: claudeExe === undefined ? claude.findeClaude(c.claudeExe) : claudeExe, cwd, profil, zusatzVerbot,
        modell: String(c.claudeModell || ''), prompt,
        maxBudgetUsd: budgetUsd, onText: (d) => { puffer += d; weiter(false); }, ...(spawnFn ? { spawnFn } : {}),
      });
      // Zeitgrenze und Abbruch durch den Browser beenden den Prozess; t2Laeuft wird im finally frei.
      uhr = setTimeout(() => l.stopp(), t2MaxMs);
      if (signal) { abbruch = () => l.stopp(); if (signal.aborted) abbruch(); else signal.addEventListener('abort', abbruch, { once: true }); }
      const r = await l.fertig;
      weiter(true);
      // Ohne Kostenangabe bleibt die Obergrenze stehen.
      const kosten = r.kostenUsd != null ? r.kostenUsd : budgetUsd;
      const fehler = r.ok ? null : String(r.fehler || '').slice(0, 240) + (r.kostenUsd == null ? ' · Kosten unbekannt, Obergrenze gebucht' : '');
      db.prepare('UPDATE cira_lauf SET session_id = ?, ok = ?, kosten_usd = ?, tokens = ?, fehler = ? WHERE id = ?')
        .run(r.sessionId || null, r.ok ? 1 : 0, kosten, r.tokens || 0, fehler, laufId);
      if (!r.ok) return { fehlt: 'Claude: ' + r.fehler, kostenUsd: r.kostenUsd };
      return { text: r.text, kostenUsd: r.kostenUsd, tokens: r.tokens };
    } finally {
      clearTimeout(uhr);
      if (abbruch) signal.removeEventListener('abort', abbruch);
      t2Laeuft = false;
    }
  }
  const t2 = (text, fakten, kontext, onText, signal) => t2Lauf({
    prompt: systemPrompt(fakten, kontext, 'T2') + '\n\nFRAGE: ' + text, onText, signal,
    pruefe: (s) => pruefeZahlen(s, fakten, text).text,
  });

  // T1 aus einem Text statt aus Fakten (C9: Kurzfassung, Suche, Notiz-Entwurf).
  // Der Text steht in der Nutzernachricht; Zahlen der Antwort muessen im Text
  // oder im Auftrag stehen, sonst faellt der Satz weg.
  const systemText = () => 'Du bist ' + ciraName() + ', die Assistentin in c2invoice. Antworte auf Deutsch, knapp, als reiner Text ohne Markdown-Hervorhebungen. ' +
    'Verwende nur, was im TEXT steht. Erfinde nichts, rechne nichts nach; fehlt etwas, sag es.';
  async function ausText({ auftrag, text, rolle = 'text', signal = null }) {
    const m = modellFuer(rolle);
    if (!m) return { fehlt: 'Kein lokales Modell eingestellt (Einstellungen → Cira).' };
    const quelle = String(text || '').slice(0, 12000);
    const r = await t1(String(auftrag) + '\n\nTEXT:\n' + quelle, [], null, fetchFn, m.modell, rolle, signal, systemText());
    if (r.fehlt) return { fehlt: r.fehlt, modell: m.modell };
    // Zeilen bleiben: ein Entwurf (Titel, Beschreibung, Text) braucht sie.
    const zeilen = r.text.split('\n').map((z) => (z.trim() ? pruefeZahlen(z, [{ k: 'Text', t: quelle }], auftrag) : { text: '', gestrichen: 0 }));
    const text2 = zeilen.map((z) => z.text).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text2) return { fehlt: 'Antwort nannte nur Zahlen, die nicht im Text stehen.', modell: m.modell };
    return { text: text2, tokens: r.tokens, modell: m.modell, gestrichen: zeilen.reduce((n, z) => n + z.gestrichen, 0) };
  }

  // Fakten aus anderen Modulen (C9: Briefing). Ein Fehler dort kostet die Frage nicht.
  function fremdeFakten(kontext) {
    const q = kontext && kontext.art && Object.hasOwn(kontextQuellen, kontext.art) ? kontextQuellen[kontext.art] : null;
    if (!q || !kontext.id) return [];
    try { return q(kontext.id) || []; } catch (err) { console.error('Cira Kontext ' + kontext.art + ':', err && err.message); return []; }
  }

  // Beantwortet eine Frage. melde(ereignis) bekommt { typ: 'stufe'|'text', … }
  // waehrend der Arbeit; das Ergebnis ist die vollstaendige Antwort.
  // gesprochen: die Frage kam per Push-to-Talk (C10), Marke im Verlauf.
  async function frage({ text, kontext = null, kanal = 'dock', signal = null, gesprochen = false }, melde = () => {}) {
    const heute = jetzt();
    // Nach einem Abbruch liest niemand die Antwort: nur die Frage bleibt im Verlauf.
    const fertig = (n) => { if (signal && signal.aborted) return { ...n, abgebrochen: true }; n.id = speichere(kanal, 'cira', n, null); return n; };
    speichere(kanal, 'ich', { text, gesprochen }, kontext);

    const treffer = t0(text);
    if (treffer) {
      melde({ typ: 'stufe', stufe: 'T0' });
      let r;
      // spaeter: Ergebnis einer Absicht, die nach der Antwort weiterarbeitet (C9c), als eigene Nachricht.
      const spaeter = (n) => { try { speichere(kanal, 'cira', n, null); ereignisse.sende('cira', { kanal }); } catch (err) { console.error('Cira: spaete Nachricht nicht gespeichert:', err.message); } };
      try { r = treffer.absicht.tu({ db, text, m: treffer.m, kontext, bucheVorgang, heute, skillOrte, merken, spaeter }); } catch (err) {
        // Fachliche Absagen (z. B. aus rechnung.js) gehen als Antwort; ins Protokoll kommt jeder Fehler.
        console.error('Cira T0 ' + treffer.absicht.name + ':', err && err.message);
        r = { antwort: err.message, quelle: QUELLE_DATEN };
      }
      return fertig({ text: r.antwort, stufe: 'T0', kosten_eur: 0, tokens: 0, quelle: r.quelle, sprung: r.sprung || [], szene: r.szene || null, zustand: r.zustand || null, absicht: treffer.absicht.name, freigabe_id: r.freigabe_id || null, angebot: r.angebot || null, vorlesen: r.vorlesen === true });
    }

    // Fakten fuer T1/T2: Datum, Kennzahlen des gefragten Zeitraums, Ueberfaelliges, ausgewaehltes Objekt.
    const z = zeitraumAus(text, heute);
    const fakten = [{ k: 'Heute', t: tag(heute) }]
      .concat(kennzahlenFakten(db, z).fakten.map((f) => ({ ...f, k: f.k + ' (' + z.label + ')' })), ueberfaelligFakten(db).fakten, faktenFuerKontext(db, kontext), fremdeFakten(kontext));
    const direktT2 = /^(frag(e)?\s+(mal\s+)?claude|claude)\s*[,:]?\s+/i.test(text);
    if (!direktT2) {
      melde({ typ: 'stufe', stufe: 'T1' });
      const c = ciraCfg();
      const wahl = waehleRolle(text, c);
      const route = { rolle: wahl.rolle, grund: wahl.grund, modell: null, versuche: [] };
      const KEINE = ' Direkt beantworte ich: Kennzahlen eines Zeitraums, Überfälliges, Verbrauch, Tagesbericht.';
      const angebot = c.claudeErlaubt === true ? { l: 'An Claude geben', frage: 'claude: ' + text } : null;
      const nachClaude = angebot ? ' Claude kann es versuchen — das kostet.' : ' Claude ist ausgeschaltet (Einstellungen → Cira).';
      // Einmal sagen statt je Stufe der Kette.
      if (!(config.lokaleModelle && config.lokaleModelle.upstreamUrl)) return fertig({ text: 'Lokale Modelle sind nicht eingerichtet (lokaleModelle in config.json).' + KEINE + (angebot ? nachClaude : ''), stufe: 'T1', kosten_eur: 0, tokens: 0, quelle: 'lokal nicht eingerichtet', sprung: [], route, angebot });
      if (!modellFuer(wahl.rolle, c)) return fertig({ text: 'Kein lokales Modell eingestellt (Einstellungen → Cira).' + KEINE + (angebot ? nachClaude : ''), stufe: 'T1', kosten_eur: 0, tokens: 0, quelle: 'lokal nicht eingestellt', sprung: [], route, angebot });
      // Guards nach jeder Antwort: leer/Fehler/Zeitgrenze/Token-Grenze, Marke "zu schwer",
      // Zahlen-Guard (schon ein Satz mit fremder Zahl fragt die naechste Stufe).
      // Jeder Fehlschlag fragt die naechste Stufe; dasselbe Modell nie zweimal.
      const gefragt = new Set();
      let tokens = 0, rest = null;
      for (const rolle of KETTE[wahl.rolle]) {
        const m = modellFuer(rolle, c);
        if (!m || gefragt.has(m.modell)) continue;
        gefragt.add(m.modell);
        melde({ typ: 'rolle', rolle, modell: m.modell });
        const r1 = await t1(text, fakten, kontext, fetchFn, m.modell, rolle, signal);
        const versuch = { rolle, modell: m.modell, ...(m.ersatz ? { ersatz: m.ersatz } : {}) };
        route.versuche.push(versuch);
        if (r1.fehlt) { versuch.ergebnis = r1.fehlt; if (r1.abbruch) break; continue; }
        tokens += r1.tokens;
        if (r1.text.includes(T2_MARKE)) { versuch.ergebnis = 'zu schwer'; continue; }
        const p = pruefeZahlen(r1.text, fakten, text, { codeFrei: rolle === 'code' });
        const antwort = (q) => { route.modell = q.modell; return fertig({ text: q.p.text, stufe: 'T1', kosten_eur: 0, tokens, quelle: 'lokal · ' + q.modell + ' · ' + QUELLE_DATEN, sprung: [], gestrichen: q.p.gestrichen, route }); };
        if (!p.gestrichen) { versuch.ergebnis = 'ok'; return antwort({ p, modell: m.modell }); }
        // Eine fremde Zahl: die naechste Stufe versucht es. Bleibt keine, gilt die
        // Antwort ohne die Saetze mit fremden Zahlen (wie vor dem Modell-Block).
        versuch.ergebnis = 'Zahlen verworfen (' + p.gestrichen + ' von ' + p.saetze + ' Sätzen)';
        // Der beste Rest gewinnt: weniger gestrichene Saetze.
        if (p.text && (!rest || p.gestrichen < rest.p.gestrichen)) rest = { p, modell: m.modell, versuch };
      }
      if (rest) { rest.versuch.ergebnis += ', Rest verwendet'; route.modell = rest.modell; return fertig({ text: rest.p.text + GESTRICHEN, stufe: 'T1', kosten_eur: 0, tokens, quelle: 'lokal · ' + rest.modell + ' · ' + QUELLE_DATEN, sprung: [], gestrichen: rest.p.gestrichen, route }); }
      // Lokal nichts Verlaessliches: Claude nur anbieten, nie selbst starten (Owner 15.10.).
      if (route.versuche.every((v) => /^nicht erreichbar/.test(v.ergebnis))) {
        return fertig({ text: 'Lokales Modell nicht erreichbar.' + KEINE + nachClaude, stufe: 'T1', kosten_eur: 0, tokens, quelle: 'lokal nicht erreichbar', sprung: [], route, angebot });
      }
      return fertig({
        text: 'Lokal kam keine verlässliche Antwort (' + route.versuche.map((v) => ROLLEN_NAME[v.rolle] + ': ' + v.ergebnis).join('; ') + ').' + nachClaude,
        stufe: 'T1', kosten_eur: 0, tokens, quelle: 'lokal ohne Ergebnis', sprung: [], route, angebot,
      });
    }
    melde({ typ: 'stufe', stufe: 'T2' });
    const frageT2 = direktT2 ? text.replace(/^(frag(e)?\s+(mal\s+)?claude|claude)\s*[,:]?\s+/i, '') : text;
    const r2 = await t2(frageT2, fakten, kontext, (d) => melde({ typ: 'text', text: d }), signal);
    const kostenEur = r2.kostenUsd != null ? Math.round(metrics.usdToEur(r2.kostenUsd) * 10000) / 10000 : 0;
    if (r2.fehlt) return fertig({ text: r2.fehlt, stufe: 'T2', kosten_eur: kostenEur, tokens: 0, quelle: 'Claude', sprung: [] });
    const p = pruefeZahlen(r2.text, fakten, frageT2);
    return fertig({ text: p.text ? p.text + (p.gestrichen ? GESTRICHEN : '') : 'Dazu liegen mir keine Zahlen vor.', stufe: 'T2', kosten_eur: kostenEur, tokens: r2.tokens, quelle: 'Claude · ' + QUELLE_DATEN, sprung: [], gestrichen: p.gestrichen });
  }

  function jsonOder(s, sonst, id) {
    if (!s) return sonst;
    try { return JSON.parse(s); } catch (err) { console.error('Cira: Nachricht ' + id + ' unlesbar:', err.message); return sonst; }
  }
  function verlauf(kanal) {
    const h = jetzt();
    const ab = new Date(h.getFullYear(), h.getMonth(), h.getDate()).toISOString();
    return db.prepare('SELECT id, zeit, rolle, text, stufe, kosten_eur, quelle, sprung_json, szene_json, route_json, falsch, gesprochen FROM cira_nachricht WHERE kanal = ? AND zeit >= ? ORDER BY id DESC LIMIT 100')
      .all(kanal, ab).reverse().map((r) => {
        const route = jsonOder(r.route_json, null, r.id);
        return { id: r.id, zeit: r.zeit, rolle: r.rolle, text: r.text, stufe: r.stufe, kosten_eur: r.kosten_eur, quelle: r.quelle,
          sprung: jsonOder(r.sprung_json, [], r.id), szene: jsonOder(r.szene_json, null, r.id),
          route, angebot: route && route.angebot ? route.angebot : null, falsch: r.falsch === 1, gesprochen: r.gesprochen === 1 };
      });
  }

  // Vorschlaege je Bereich, vorne was die Daten gerade nahelegen.
  const BASIS = {
    hub: ['Wie lief der Monat?', 'Wie lief das Quartal?', 'Tagesbericht'],
    analyse: ['Wo gehen die Token hin?', 'Wie lief die Woche?'],
    live: ['Wo gehen die Token hin?', 'Tagesbericht'],
    zeit: ['Tagesbericht', 'Wie lief die Woche?'],
    vorgaenge: ['Wie lief der Monat?', 'Wo gehen die Token hin?'],
    rechnungen: ['Was ist überfällig?', 'Wie lief der Monat?'],
    angebote: ['Wie lief der Monat?', 'Was ist überfällig?'],
    kontakte: ['Was ist überfällig?', 'Wie lief das Quartal?'],
    cockpit: ['Wie lief der Monat?', 'Wie entwickelt sich die Marge?', 'Wo gehen die Token hin?', 'Tagesbericht'],
  };
  function vorschlaege(screen) {
    const liste = [];
    if (zeit.timerAktuell(db)) liste.push('Timer stoppen');
    if (ueberfaelligFakten(db).posten.length) liste.push('Was ist überfällig?');
    if (screen === 'cockpit') {
      // Vorgang mit dem groessten Arbeitswert dieses Monats, der noch auf keiner
      // Rechnung steht und einen Kunden hat (ohne Kunden gibt es keinen Entwurf).
      const h = jetzt(), gestellt = rechnung.abrechnung(db), kunde = kontakte.kontaktJeProjekt(db);
      const offen = metrics.byTicket(db, { from: tag(new Date(h.getFullYear(), h.getMonth(), 1)), to: tag(h) })
        // Nur Schluessel, die die Absicht "rechnung" auch erkennt — sonst liefe der Klick in T1/T2.
        .filter((t) => t.arbeitswert > 0 && !gestellt[t.ticket] && Object.hasOwn(kunde, t.project) && /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(t.ticket)).sort((a, b) => b.arbeitswert - a.arbeitswert)[0];
      if (offen) liste.push('Rechnung für ' + offen.ticket);
    }
    for (const s of BASIS[screen] || ['Wie lief der Monat?', 'Was ist überfällig?', 'Wo gehen die Token hin?']) if (!liste.includes(s)) liste.push(s);
    return liste.slice(0, screen === 'cockpit' ? 6 : 4);
  }

  /* ---------- Routen ---------- */
  const text200 = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) : null);
  function pruefeFrage(d) {
    const text = typeof d.text === 'string' ? d.text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim() : '';
    if (!text || text.length > 2000) throw new Error('Frage: 1 bis 2000 Zeichen.');
    const kanal = KANAELE.includes(d.kanal) ? d.kanal : 'dock';
    const k = d.kontext && typeof d.kontext === 'object' && !Array.isArray(d.kontext) ? d.kontext : null;
    const kontext = k ? { screen: text200(k.screen), art: text200(k.art), id: text200(k.id), titel: text200(k.titel), arbeitsbereich: text200(k.arbeitsbereich) } : null;
    return { text, kanal, kontext, gesprochen: d.gesprochen === true };
  }

  // Liefert true, wenn die Route bedient wurde.
  function routen(req, res, p, u, { sendJson, leseKoerper }) {
    if (p === '/api/ereignisse' && req.method === 'GET') { ereignisse.sse(req, res); return true; }
    if (p === '/api/cira/frage' && req.method === 'POST') {
      leseKoerper(req, (fehler, d) => {
        let f;
        try { if (fehler) throw new Error(fehler); f = pruefeFrage(d && typeof d === 'object' ? d : {}); } catch (err) { return sendJson(res, { error: err.message }, 400); }
        // NDJSON: eine Zeile je Ereignis, die letzte traegt die ganze Antwort.
        res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
        const zeile = (o) => { if (!res.writableEnded) res.write(JSON.stringify(o) + '\n'); };
        // Schliesst der Browser die Verbindung, endet ein laufender Claude-Lauf mit.
        const ac = new AbortController();
        res.on('close', () => { if (!res.writableEnded) ac.abort(); });
        frage({ ...f, signal: ac.signal }, zeile).then((n) => {
          if (n.abgebrochen) { res.end(); return; }
          zeile({ typ: 'fertig', id: n.id, antwort: n.text, stufe: n.stufe, kosten_eur: n.kosten_eur, tokens: n.tokens || 0, quelle: n.quelle, szene: n.szene || null, zustand: n.zustand || null, sprung: n.sprung || [], herleitung_id: n.szene && n.szene.herleitung ? n.szene.herleitung : null, freigabe_id: n.freigabe_id || null, gestrichen: n.gestrichen || 0, route: n.route || null, angebot: n.angebot || null, vorlesen: n.vorlesen === true });
          ereignisse.sende('cira', { kanal: f.kanal });
          res.end();
        }, (err) => {
          console.error('Cira:', err);
          // Sonst stuende im Verlauf eine Frage ohne Antwort.
          try { speichere(f.kanal, 'cira', { text: 'Interner Fehler, Details im Serverprotokoll.' }, null); } catch (e2) { console.error('Cira: Fehlerantwort nicht gespeichert:', e2.message); }
          zeile({ typ: 'fehler', error: 'Interner Fehler, Details im Serverprotokoll' });
          res.end();
        });
      });
      return true;
    }
    if (p === '/api/cira/verlauf' && req.method === 'GET') {
      const k = u.searchParams.get('kanal');
      sendJson(res, { verlauf: verlauf(KANAELE.includes(k) ? k : 'dock') });
      return true;
    }
    // "Falsch zugeordnet": markiert eine lokale Antwort; die Liste in Einstellungen → Cira hilft beim Nachschaerfen der Woerter.
    const mf = req.method === 'POST' && p.match(/^\/api\/cira\/nachricht\/(\d{1,9})\/falsch$/);
    if (mf) {
      const r = db.prepare("UPDATE cira_nachricht SET falsch = 1 WHERE id = ? AND rolle = 'cira' AND route_json IS NOT NULL").run(Number(mf[1]));
      sendJson(res, r.changes ? { ok: true } : { error: 'Keine lokale Antwort mit dieser Nummer.' }, r.changes ? 200 : 404);
      return true;
    }
    if (p === '/api/cira/falsch' && req.method === 'GET') {
      // Die Frage steht in der Nachricht davor (rolle ich, gleicher Kanal).
      const zeilen = db.prepare(`SELECT a.id, a.zeit, a.route_json, (SELECT f.text FROM cira_nachricht f WHERE f.kanal = a.kanal AND f.id < a.id AND f.rolle = 'ich' ORDER BY f.id DESC LIMIT 1) AS frage
        FROM cira_nachricht a WHERE a.falsch = 1 ORDER BY a.id DESC LIMIT 20`).all();
      sendJson(res, { falsch: zeilen.map((z) => { const r = jsonOder(z.route_json, { grund: 'Route unlesbar' }, z.id); return { id: z.id, zeit: z.zeit, frage: z.frage, rolle: r.rolle, grund: r.grund }; }) });
      return true;
    }
    if (p === '/api/cira/vorschlaege' && req.method === 'GET') {
      sendJson(res, { vorschlaege: vorschlaege(String(u.searchParams.get('screen') || '').slice(0, 40)) });
      return true;
    }
    // Rechenweg ohne Modell (C4): Quellen -> Teilbetraege -> Ergebnis.
    if (p === '/api/cira/herleitung' && req.method === 'GET') {
      try { sendJson(res, herleitung.herleitung(db, String(u.searchParams.get('art') || ''), String(u.searchParams.get('id') || ''))); } catch (err) {
        // Ohne Status ist es kein Eingabefehler, sondern einer im Rechenweg: ins Protokoll, nach aussen nur der Hinweis.
        if (!err.status) console.error('Herleitung:', err);
        sendJson(res, { error: err.status ? err.message : 'Herleitung fehlgeschlagen, Details im Serverprotokoll.' }, err.status || 500);
      }
      return true;
    }
    if (p === '/api/freigaben' && req.method === 'GET') {
      try { sendJson(res, { freigaben: freigaben.liste(db, { status: u.searchParams.get('status') || 'offen' }) }); } catch (err) { sendJson(res, { error: err.message }, 400); }
      return true;
    }
    const m = req.method === 'POST' && p.match(/^\/api\/freigaben\/(\d{1,9})\/entscheide$/);
    if (m) {
      // Strenger als der allgemeine Herkunfts-Check: auch ohne Browser-Header (curl,
      // ein Skript aus einer Agenten-Sitzung) wird nichts freigegeben. Restrisiko:
      // ein lokaler Prozess kann Header faelschen — ohne Anmeldung gibt es keine
      // echte Grenze zum eigenen Rechner.
      const site = req.headers['sec-fetch-site'];
      const origin = req.headers.origin;
      if (site !== 'same-origin' && !(origin && origin === 'http://' + req.headers.host)) { sendJson(res, { error: 'Freigaben nur aus der Oberfläche' }, 403); return true; }
      leseKoerper(req, (fehler, d) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        const b = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
        freigaben.entscheide(db, Number(m[1]), { wahl: b.wahl, hinweis: b.hinweis }).then(
          (f) => sendJson(res, { ok: true, freigabe: f }),
          (err) => {
            // Fachliche Absagen tragen ihren Status oder sind Eingabefehler; alles andere ist ein Programmfehler.
            if (!err.status) console.error('Freigabe ' + m[1] + ':', err);
            sendJson(res, { error: err.message }, err.status || (err instanceof TypeError || err instanceof ReferenceError ? 500 : 400));
          });
      });
      return true;
    }
    return false;
  }

  // Zusammenfassung einer Sitzung fuers Vorgangs-Log (C6): lokal, Rolle Text.
  // Nur was im Verlauf steht; ohne Modell { fehlt }, der Aufrufer schreibt dann nichts.
  async function zusammenfassen(verlauf) {
    const m = modellFuer('text');
    if (!m) return { fehlt: 'nicht eingestellt (Einstellungen → Cira)' };
    return t1('Fasse diese Claude-Code-Sitzung für das Vorgangs-Log in drei bis sechs Sätzen zusammen: Aufgabe, was geändert wurde, was offen ist. ' +
      'Nur was im Verlauf steht, nichts ergänzen.\n\nVERLAUF:\n' + verlauf, [], null, fetchFn, m.modell, 'text');
  }

  return { frage, verlauf, vorschlaege, routen, zusammenfassen, ausText, t2Lauf, speichere };
}

module.exports = { erzeuge, pruefeZahlen, zeitraumAus, t0, T0, STANDARD, waehleRolle, modellFuer, ROLLEN, ueberfaelligFakten, faktenFuerKontext };
