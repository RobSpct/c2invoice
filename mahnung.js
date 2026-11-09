'use strict';
// C11b Mahnwesen: die eine Formel fuer die naechste Mahnstufe. Zahlen kommen aus
// rechnung.detail (nie neu gerechnet); mahnStand ruft dieselbe Pruefung auf.
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');
const rechnung = require('./rechnung');
const mail = require('./mail');

// Entspricht den `standard`-Werten in EINSTELLUNGEN (server.js); dort nicht
// importierbar (Zirkel), daher hier einmal gespiegelt.
const STANDARD = { erinnerungNachTagen: 7, mahnung1NachTagen: 14, mahnung2NachTagen: 14, neueFristTage: 7 };

const STUFEN = {
  1: { art: 'erinnerung', titel: 'Zahlungserinnerung' },
  2: { art: 'mahnung1', titel: '1. Mahnung' },
  3: { art: 'mahnung2', titel: '2. Mahnung' },
};

// Kalendertage in Ortszeit (rechnung.tagNach), kein 86400000-ms-Rechnen:
// "T00:00:00" ohne Z wird lokal gelesen, die Zeitumstellung verschiebt nichts.
function plusTage(tag, n) { return rechnung.tagNach(tag + 'T00:00:00', n); }

function tageAus(cfg, feld) {
  const w = cfg && cfg[feld];
  return Number.isInteger(w) && w >= 1 && w <= 90 ? w : STANDARD[feld];
}

const tagVon = (s) => (String(s).length === 10 ? String(s) : rechnung.tagNach(s, 0));
// Zustellung unklar (mail.js schreibt den Fehlertext so): vielleicht beim Kunden. Eine Stelle fuer Stand, Sperre und Antwort.
const UNKLAR_SQL = "status = 'fehler' AND fehler LIKE 'Zustellung unklar:%'";
const istUnklar = (z) => z.status === 'fehler' && String(z.fehler || '').startsWith('Zustellung unklar:');

function pruefe(db, nr, heute, cfg) {
  // Nur ein Kalendertag: eine volle ISO-Zeit ist groesser als faellig_am und zaehlte den Faelligkeitstag als ueberfaellig.
  if (!rechnung.istTag(heute)) throw Object.assign(new Error('heute: Kalendertag JJJJ-MM-TT erwartet'), { status: 400 });
  const leer = { gesendet: 0, zuletzt: null, naechste: null, grund: null, pause_bis: null };
  const inv = rechnung.detail(db, nr, { heute });
  if (!inv) return leer;
  const k = inv.kontakt_id ? db.prepare('SELECT mahnpause_bis FROM kontakte WHERE id = ?').get(inv.kontakt_id) : null;
  const pause_bis = (k && k.mahnpause_bis) || null;
  const rows = db.prepare("SELECT stufe, gesendet_am, kanal FROM mahnung WHERE rechnung_nr = ? AND status = 'gesendet' ORDER BY stufe")
    .all(String(nr));
  const z = rows[rows.length - 1];
  const r = { ...leer, gesendet: rows.length, pause_bis,
    zuletzt: z ? { stufe: z.stufe, gesendet_am: z.gesendet_am, kanal: z.kanal } : null };
  if (inv.status !== 'erstellt') return { ...r, grund: 'storniert' };
  if (!(inv.rest_eur > 0)) return { ...r, grund: 'bezahlt' };
  if (heute <= inv.faellig_am) return { ...r, grund: 'nicht_faellig' };
  if (z && z.stufe >= 3) return { ...r, grund: 'ausgeschoepft' };
  if (pause_bis && pause_bis >= heute) return { ...r, grund: 'pause' };
  const stufe = z ? z.stufe + 1 : 1;
  // F1 (R11): eine unklar zugestellte Mahnung dieser Stufe sperrt sie, bis C11c "als gesendet bestaetigen" bringt;
  // sonst entstuende beim neuen Oeffnen ein Entwurf mit neuem Mail-Schluessel und die Mahnung ginge ein zweites Mal raus.
  if (db.prepare('SELECT 1 FROM mahnung WHERE rechnung_nr = ? AND stufe = ? AND ' + UNKLAR_SQL + ' LIMIT 1').get(String(nr), stufe)) {
    return { ...r, grund: 'unklar', unklar_stufe: stufe };
  }
  const faellig_ab = !z ? plusTage(inv.faellig_am, tageAus(cfg, 'erinnerungNachTagen'))
    : plusTage(tagVon(z.gesendet_am), tageAus(cfg, stufe === 2 ? 'mahnung1NachTagen' : 'mahnung2NachTagen'));
  return { ...r, naechste: { stufe, faellig_ab } };
}

// C11c: Rechnungen, fuer die der Tages-Scan heute eine Erinnerung/Mahnung ausloesen darf (E10).
// Nur Rechnungen, die c2invoice scharf zugestellt hat; im Testmodus zaehlt auch ein Testversand (Owner P1),
// und eine Testmahnung derselben Stufe sperrt. Aelteste Faelligkeit zuerst; nur die naechste Stufe je Rechnung (nachholen).
// Ein Urteil je Rechnung: Kandidat oder Grund. kandidaten und ausgeschlossen lesen dieselbe Regel (eine Formel, ein Ort).
function urteil(db, nr, heute, testmodus, cfg) {
  // MIN(test): 0 = mindestens ein scharfer Versand, 1 = nur Testversand, null = nie per Mail
  const t = db.prepare("SELECT MIN(test) AS t FROM versand WHERE art = 'rechnung' AND bezug = ? AND status = 'ok'").get(nr).t;
  if (t == null) return { grund: 'nie per Mail aus c2invoice versendet' };
  if (t === 1 && !testmodus) return { grund: 'nur als Test versendet, Testmodus ist aus' };
  const s = pruefe(db, nr, heute, cfg);
  const n = s.naechste;
  if (!n) return { grund: s.grund === 'pause' ? 'Mahnpause bis ' + s.pause_bis : (GRUND_TEXT[s.grund] || String(s.grund)) };
  if (n.faellig_ab > heute) return { grund: `Stufe ${n.stufe} erst ab ${n.faellig_ab} fällig` };
  if (testmodus && db.prepare("SELECT 1 FROM mahnung WHERE rechnung_nr = ? AND stufe = ? AND status = 'test' LIMIT 1").get(nr, n.stufe)) {
    return { grund: `Testschreiben Stufe ${n.stufe} schon verschickt (Testmodus: eins je Stufe)` };
  }
  return { kandidat: { nr, tage: rechnung.tageZwischen(rechnung.faelligAm(rechnung.lade(db, nr)), heute), stufe_faellig: n.stufe, faellig_am: n.faellig_ab } };
}

function kandidaten(db, heute, { testmodus = false } = {}, cfg = config.mahnwesen) {
  const aus = [];
  for (const { nr } of db.prepare("SELECT nr FROM invoices WHERE status = 'erstellt'").all()) {
    try {
      const u = urteil(db, nr, heute, testmodus, cfg);
      if (u.kandidat) aus.push(u.kandidat);
    } catch (e) { console.error('Mahnung-Kandidat ' + nr + ':', e); } // eine kaputte Rechnung bremst die anderen nicht
  }
  return aus.sort((a, b) => (a.faellig_am < b.faellig_am ? -1 : a.faellig_am > b.faellig_am ? 1 : a.nr < b.nr ? -1 : 1));
}

// Probelauf ohne Kandidat (Owner 04.11.): ueberfaellige offene Rechnungen mit dem Grund, warum f1 sie heute nicht nimmt.
function ausgeschlossen(db, heute, { testmodus = false } = {}, cfg = config.mahnwesen) {
  const aus = [];
  for (const { nr } of db.prepare("SELECT nr FROM invoices WHERE status = 'erstellt' AND faellig_am < ? ORDER BY faellig_am, nr").all(heute)) {
    try {
      const u = urteil(db, nr, heute, testmodus, cfg);
      if (u.grund) aus.push({ nr, grund: u.grund });
    } catch (e) { console.error('Mahnung-Kandidat ' + nr + ':', e); aus.push({ nr, grund: 'Rechnung nicht lesbar (siehe Protokoll)' }); }
  }
  return aus;
}

// P9: Stufe 3 ist gesendet, ihre Frist ist um und es ist noch etwas offen. Kein Mahnschreiben mehr, nur der Hinweis fuer den Menschen.
function ausgeschoepft(db, heute) {
  return db.prepare("SELECT DISTINCT rechnung_nr nr FROM mahnung WHERE stufe = 3 AND status = 'gesendet' AND frist < ? ORDER BY rechnung_nr").all(heute)
    .filter(({ nr }) => {
      try { return pruefe(db, nr, heute, null).grund === 'ausgeschoepft'; } catch (e) { console.error('Mahnung-Ausgeschoepft ' + nr + ':', e); return false; } // wie kandidaten: eine kaputte Rechnung stoppt den Scan nicht
    })
    .map(({ nr }) => ({ nr }));
}

function naechsteStufe(db, nr, heute, cfg = config.mahnwesen) {
  return pruefe(db, nr, heute, cfg).naechste;
}

function mahnStand(db, nrs, heute, cfg = config.mahnwesen) {
  const aus = {};
  for (const nr of nrs) aus[nr] = pruefe(db, nr, heute, cfg);
  return aus;
}

// ---- Mahnschreiben (Task 3) ----
// Eine Mahnung ist eine Abschrift: Betreff, Text, offen_eur, frist, gebuehr_eur werden beim Erzeugen
// festgeschrieben und nie neu gerechnet; sie bekommt keine Belegnummer aus dem Rechnungskreis.
// Kein BEGIN ueber ein await: erst pruefen, dann drucken/senden, danach genau ein UPDATE.
const NR_RE = /^\d{4}-\d{4}$/;
// Zu zahlen = offen + Gebuehr: eine Formel fuer PDF und alle Antworten (Frontend rechnet nicht).
const gesamtEur = (offen, gebuehr) => rechnung.rund2(offen + gebuehr);
// Jede Antwort: ohne pdf_pfad (lokaler Pfad mit Benutzername, auch ueber das ungekoppelte GET /api/mahnung/liste), nur pdf ja/nein.
function aus(z) {
  if (!z) return z;
  const { pdf_pfad: pfad, ...r } = z;
  return { ...r, pdf: !!pfad, unklar: istUnklar(z), gesamt_eur: gesamtEur(z.offen_eur, z.gebuehr_eur) };
}
const mitStatus = (status, text) => Object.assign(new Error(text), { status });
const GRUND_TEXT = { storniert: 'Rechnung ist storniert', bezahlt: 'Rechnung ist bezahlt', nicht_faellig: 'Rechnung ist noch nicht fällig',
  ausgeschoepft: 'Mahnstufen ausgeschöpft', unklar: 'Zustellung unklar — erst unter Gesendet prüfen' };
// C11c C1: Marke in `fehler`, solange das SMTP-Gespraech laeuft (Status bleibt). Stirbt der Server darin, gibt es keine
// Versandzeile; heile() macht daraus "Zustellung unklar", damit die Stufe gesperrt ist und P6 klaert.
const IM_VERSAND = 'Versand begonnen, Ergebnis offen';
const ABBRUCH_UNKLAR = 'Zustellung unklar: Server während des Versands beendet';
// F6: Mail ging raus, aber der Status liess sich nicht speichern.
const OHNE_STATUS = 'Mail ging raus, Status nicht gespeichert — nicht erneut senden, nicht als Post markieren';
// Gebuehr nur in den Grenzen aus EINSTELLUNGEN (0-40); was von Hand in der Datei steht und nicht passt, gilt als 0.
const gebuehrVon = (cfg) => { const g = cfg && cfg.gebuehrStufe2Eur; return typeof g === 'number' && g >= 0 && g <= 40 ? rechnung.rund2(g) : 0; };
// Druck- und Dateifehler nennen lokale Pfade: die nur ins Protokoll.
function sicher(e, wo) {
  if (!e || e.code || e.path || !e.message) { console.error('Mahnung: ' + wo + ':', e); return 'Details im Serverprotokoll.'; }
  return String(e.message);
}

function pruefeAn(an) {
  if (!Array.isArray(an) || !an.length || an.length > 5) throw mitStatus(400, 'an: 1 bis 5 Adressen');
  for (const a of an) mail.pruefeUmschlag(a, 'Empfaenger');
}
const pruefeId = (id) => { if (!Number.isInteger(id) || id < 1) throw mitStatus(400, 'id: ganze Zahl erwartet'); };

function renderHtml(m, inv) {
  const { esc, eur, datum } = rechnung;
  const a = inv.aussteller || {}, e = inv.empfaenger || {};
  const titel = STUFEN[m.stufe].titel;
  // Aufstellung (P4) nur aus der Abschrift der Mahnung und der Rechnung.
  const gezahlt = rechnung.rund2(inv.brutto_eur - m.offen_eur);
  return `<!doctype html>
<meta charset="utf-8">
<title>${esc(titel)} zur Rechnung ${esc(m.rechnung_nr)}</title>
<style>
${rechnung.PAPIER_CSS}  .brief { white-space: pre-line; margin: 24px 0; }
</style>
<div class="kopf">
  <div>
    <div class="klein">${esc(a.name)}, ${esc((a.anschrift || []).join(', '))}</div>
    <p><strong>${esc(e.name)}</strong><br>${(e.anschrift || []).map(esc).join('<br>')}</p>
  </div>
  <div class="klein">
    <strong>${esc(a.name)}</strong><br>
    ${(a.anschrift || []).map(esc).join('<br>')}<br>
    ${a.steuernummer ? 'Steuernummer: ' + esc(a.steuernummer) + '<br>' : ''}
    ${a.ustIdNr ? 'USt-IdNr.: ' + esc(a.ustIdNr) + '<br>' : ''}
  </div>
</div>

<h1>${esc(titel)}</h1>
<p class="klein">Datum: ${esc(datum(m.erstellt + 'T12:00:00'))} &middot; Rechnung ${esc(m.rechnung_nr)} vom ${esc(datum(inv.erstellt_am))}</p>

<div class="brief">${esc(m.text)}</div>

<table>
  <tbody>
    <tr><td>Rechnungsbetrag (Rechnung ${esc(m.rechnung_nr)}, fällig am ${esc(datum(rechnung.faelligAm(inv) + 'T12:00:00'))})</td><td class="r">${esc(eur(inv.brutto_eur))}</td></tr>
    ${gezahlt > 0 ? `<tr><td>abzüglich Zahlungen bis ${esc(datum(m.erstellt + 'T12:00:00'))}</td><td class="r">${esc(eur(gezahlt))}</td></tr>` : ''}
    <tr><td>Offener Betrag der Rechnung</td><td class="r">${esc(eur(m.offen_eur))}</td></tr>
    ${m.gebuehr_eur > 0 ? `<tr><td>Mahngebühr</td><td class="r">${esc(eur(m.gebuehr_eur))}</td></tr>` : ''}
  </tbody>
  <tfoot>
    <tr class="gesamt"><td>Zu zahlen bis ${esc(datum(m.frist + 'T12:00:00'))}</td><td class="r">${esc(eur(gesamtEur(m.offen_eur, m.gebuehr_eur)))}</td></tr>
  </tfoot>
</table>

<div class="fuss">
  <p>Bitte geben Sie bei der Zahlung die Rechnungsnummer ${esc(m.rechnung_nr)} an.</p>
  ${a.iban ? `<p>${esc(a.bank)}<br>IBAN: ${esc(a.iban)}${a.bic ? ' &middot; BIC: ' + esc(a.bic) : ''}</p>` : ''}
</div>
`;
}

function erzeugeDienst({
  db, mailDienst, mahnCfg = () => config.mahnwesen, mailCfg = () => config.mail, port = config.port,
  heute = () => rechnung.tagNach(new Date(), 0), ordner = path.join(__dirname, 'data', 'mahnungen'),
  // Druck ueber die Druckansicht /mahnung/<id> dieses Servers; Tests setzen Attrappen ein (kein Chrome).
  pdfFn = (id, ziel) => rechnung.druckePdf('http://127.0.0.1:' + port + '/mahnung/' + id, ziel),
  rechnungPdfFn = (nr) => rechnung.erzeugePdf(db, nr, port),
}) {
  const cfg = () => mahnCfg() || {};
  const roh = (id) => db.prepare('SELECT * FROM mahnung WHERE id = ?').get(id);
  const zeile = (id) => aus(roh(id));
  // Stufen je Rechnung ('nr:stufe'), deren Versand gerade laeuft (Doppelklick, zwei Tabs, zwei Entwuerfe
  // derselben Stufe): Pruefen und Eintragen ohne await dazwischen. Je Stufe, nicht je id — sonst gingen zwei
  // Entwuerfe derselben Stufe mit verschiedenen Mail-Schluesseln beide raus.
  // ponytail: nur dieser Prozess; ein zweiter Prozess faellt auf den UNIQUE-Index zurueck (Vermerk in der Zeile).
  const laeuft = new Set();
  // F6: Stufen, deren Mail raus ist, deren Status-UPDATE aber scheiterte.
  // ponytail: nur im Speicher dieses Prozesses; nach einem Neustart ist die Stufe wieder frei (Hinweis steht im Protokoll).
  const ohneStatus = new Set();
  const pruefeGesperrt = (sperre) => {
    if (laeuft.has(sperre)) throw mitStatus(409, 'Versand läuft bereits');
    if (ohneStatus.has(sperre)) throw mitStatus(409, OHNE_STATUS);
  };
  const sperreVon = (id) => { const z = roh(id); return z ? z.rechnung_nr + ':' + z.stufe : null; };
  const pruefeNr = (nr) => { if (typeof nr !== 'string' || !NR_RE.test(nr)) throw mitStatus(400, 'nr: keine gueltige Rechnungsnummer'); };

  // Die Stufe geht jetzt (naechste Stufe zurueck) oder es gibt den Grund als 409.
  function stufeFrei(nr, stufe, tag, beimSenden) {
    const s = pruefe(db, nr, tag, cfg());
    if (s.naechste && s.naechste.stufe === stufe) return s.naechste;
    if (beimSenden && s.zuletzt && s.zuletzt.stufe >= stufe) throw mitStatus(409, 'Stufe bereits gesendet');
    if (s.grund === 'pause') throw mitStatus(409, 'Mahnpause bis ' + rechnung.datum(s.pause_bis + 'T12:00:00'));
    if (s.grund) throw mitStatus(409, GRUND_TEXT[s.grund]);
    throw s.naechste ? mitStatus(409, 'nur Stufe ' + s.naechste.stufe + ' möglich') : mitStatus(404, 'Rechnung nicht gefunden');
  }

  // P3: an die Adresse, an die die Rechnung zuletzt scharf ging; sonst wie C11a.
  function empfaenger(inv) {
    const v = db.prepare("SELECT an FROM versand WHERE bezug = ? AND art = 'rechnung' AND status = 'ok' AND test = 0 ORDER BY zeit DESC, id DESC LIMIT 1").get(inv.nr);
    const e = mailDienst.empfaengerVon(inv.kontakt_id, inv.lead_id);
    return { an: v && v.an ? v.an.split(/,\s*/).filter(Boolean) : e.an, name: e.name };
  }

  function entwurf(nr, stufe, d, tag) {
    pruefeNr(nr);
    const inv = rechnung.detail(db, nr, { heute: tag });
    if (!inv) throw mitStatus(404, 'Rechnung nicht gefunden');
    const naechste = stufeFrei(nr, stufe, tag, false);
    // R1: der offene Betrag kommt aus rechnung.detail, nie neu gerechnet.
    const offen = inv.rest_eur;
    if (!(offen > 0 && offen <= inv.brutto_eur)) throw mitStatus(409, 'Offener Betrag unplausibel');
    const frist = plusTage(tag, tageAus(cfg(), 'neueFristTage'));
    const gebuehr = stufe === 3 ? gebuehrVon(cfg()) : 0;
    const art = STUFEN[stufe].art, e = empfaenger(inv), m = mailCfg() || {};
    const werte = {
      nr, datum: rechnung.datum(inv.erstellt_am), brutto: rechnung.eur(inv.brutto_eur), faellig: rechnung.datum(inv.faellig_am + 'T12:00:00'),
      anrede: e.name ? 'Guten Tag ' + e.name + ',' : 'Guten Tag,', absender: (m.absender && m.absender.name) || (inv.aussteller && inv.aussteller.name) || '',
      offen: rechnung.eur(offen), frist: rechnung.datum(frist + 'T12:00:00'), gebuehr: gebuehr > 0 ? ', zuzüglich Mahngebühr von ' + rechnung.eur(gebuehr) : '',
    };
    // Gespeicherte Vorlage vor dem Standard, je Feld und nur nicht-leer (wie mail.belegNachricht).
    const g = (m.vorlagen && m.vorlagen[art]) || {};
    const feld = (k) => (typeof g[k] === 'string' && g[k].trim() ? g[k] : mail.STANDARD_VORLAGEN[art][k]);
    // Texte aus dem Dialog: Pruefung wie mail.pruefeSenden.
    let betreff = mail.fuelle(feld('betreff'), werte), text = mail.fuelle(feld('text'), werte);
    if (d.betreff != null) {
      if (typeof d.betreff !== 'string' || !d.betreff.trim() || d.betreff.length > 200) throw mitStatus(400, 'Betreff: Text bis 200 Zeichen');
      betreff = d.betreff;
    }
    // Auch der Betreff aus der Vorlage (Datei-Weg, Kontaktname im Platzhalter) geht in die Kopfzeile.
    betreff = mail.pruefeKopf(betreff, 'Betreff');
    if (d.text != null) {
      if (typeof d.text !== 'string' || !d.text.trim() || d.text.length > 4000) throw mitStatus(400, 'Text: bis 4000 Zeichen');
      text = d.text;
    }
    // frueh: die Stufe ist noch nicht regulaer faellig (Owner mahnt frueher); der Browser vergleicht keine Daten.
    return { stufe, titel: STUFEN[stufe].titel, faellig_ab: naechste.faellig_ab, frueh: naechste.faellig_ab > tag, an: e.an, betreff, text,
      offen_eur: offen, gebuehr_eur: gebuehr, gesamt_eur: gesamtEur(offen, gebuehr), frist };
  }

  function vorschau(nr) {
    pruefeNr(nr);
    const tag = heute();
    const n = pruefe(db, nr, tag, cfg()).naechste;
    return { ...entwurf(nr, n ? n.stufe : 0, {}, tag), bereit: mailDienst.status() };
  }

  async function drucke(m) {
    const ziel = path.join(ordner, m.rechnung_nr + '-' + m.stufe + '-' + m.id + '.pdf');
    try {
      await pdfFn(m.id, ziel);
      db.prepare('UPDATE mahnung SET pdf_pfad = ? WHERE id = ?').run(ziel, m.id);
      return { pfad: ziel };
    } catch (e) {
      return { warnung: 'PDF nicht erstellt: ' + sicher(e, 'Druck ' + m.id) };
    }
  }

  async function erzeuge(nr, d = {}) {
    const tag = heute();
    const e = entwurf(nr, d.stufe ?? null, d, tag);
    // F2: Text und Aufstellung muessen dieselben Zahlen nennen. Der Dialog schickt Betrag und Frist seiner Vorschau mit;
    // eine Zahlung oder Mitternacht dazwischen macht den Text falsch. Ein Cent Toleranz wie in vorpruefe.
    if (!(Number.isFinite(d.offen_eur) && Math.abs(d.offen_eur - e.offen_eur) <= 0.01 + 1e-9 && d.frist === e.frist)) {
      throw mitStatus(409, 'Betrag oder Frist hat sich geändert — neu erzeugen');
    }
    if (d.an !== undefined) pruefeAn(d.an);
    const r = db.prepare(`INSERT INTO mahnung (rechnung_nr, stufe, erstellt, frist, offen_eur, gebuehr_eur, betreff, text, an, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'erzeugt')`).run(nr, e.stufe, tag, e.frist, e.offen_eur, e.gebuehr_eur, e.betreff, e.text, d.an ? d.an.join(', ') : null);
    const id = Number(r.lastInsertRowid);
    const w = await drucke(zeile(id));
    return w.warnung ? { ...zeile(id), warnung: w.warnung } : zeile(id);
  }

  // Vor Senden und Post: hat sich seit dem Erzeugen etwas geaendert, das die Abschrift falsch macht?
  function vorpruefe(id, tag, erlaubt) {
    const m = roh(id);
    if (!m) throw mitStatus(404, 'Mahnung nicht gefunden');
    if (!erlaubt.includes(m.status)) {
      throw mitStatus(409, m.status === 'gesendet' ? 'Mahnung bereits gesendet'
        : m.status === 'test' ? 'Mahnung ging im Testmodus raus — für den Versand neu erzeugen'
          : 'Nur eine erzeugte Mahnung lässt sich als per Post versendet markieren');
    }
    const inv = rechnung.detail(db, m.rechnung_nr, { heute: tag });
    if (!inv) throw mitStatus(404, 'Rechnung nicht gefunden');
    if (inv.status !== 'erstellt') throw mitStatus(409, 'Rechnung ist storniert');
    if (!(inv.rest_eur > 0)) throw mitStatus(409, 'Rechnung inzwischen bezahlt');
    // Ein Cent Toleranz wie rechnung.statusOf; 1e-9 gegen Gleitkomma-Reste.
    // R5: in beide Richtungen — eine geloeschte Zahlung macht den Betrag im Schreiben ebenso falsch.
    if (Math.abs(inv.rest_eur - m.offen_eur) > 0.01 + 1e-9) throw mitStatus(409, 'Betrag hat sich geändert — neu erzeugen');
    if (m.frist < tag) throw mitStatus(409, 'Frist abgelaufen — neu erzeugen');
    stufeFrei(m.rechnung_nr, m.stufe, tag, true);
    return m;
  }

  async function sende(id, { an } = {}) {
    pruefeId(id);
    pruefeAn(an);
    const sperre = sperreVon(id);
    pruefeGesperrt(sperre);
    const tag = heute();
    const m = vorpruefe(id, tag, ['erzeugt', 'fehler']);
    // F3: der Text nennt die Frist vom Tag des Erzeugens; per Mail geht nur ein Schreiben von heute raus (Post: Regel in vorpruefe).
    if (tagVon(m.erstellt) !== tag) throw mitStatus(409, 'Schreiben ist nicht von heute — neu erzeugen');
    laeuft.add(sperre);
    try {
      let mpdf, rpdf;
      if (!(m.pdf_pfad && fs.existsSync(m.pdf_pfad))) {
        const w = await drucke(m);
        if (!w.pfad) throw mitStatus(422, w.warnung);
      }
      try { mpdf = fs.readFileSync(roh(id).pdf_pfad); } catch (e) { throw mitStatus(422, 'PDF fehlt: ' + sicher(e, 'PDF ' + id)); }
      try {
        const inv = rechnung.lade(db, m.rechnung_nr);
        rpdf = fs.readFileSync(inv.pdf_pfad && fs.existsSync(inv.pdf_pfad) ? inv.pdf_pfad : (await rechnungPdfFn(inv.nr)).pdf);
      } catch (e) { throw mitStatus(422, 'Rechnungs-PDF fehlt: ' + sicher(e, 'Rechnungs-PDF ' + m.rechnung_nr)); }
      const anhaenge = [
        { name: STUFEN[m.stufe].titel.replace('. ', '-') + '-' + m.rechnung_nr + '.pdf', typ: 'application/pdf', daten: mpdf },
        { name: 'Rechnung-' + m.rechnung_nr + '.pdf', typ: 'application/pdf', daten: rpdf },
      ];
      const vorher = roh(id).fehler;
      db.prepare('UPDATE mahnung SET fehler = ? WHERE id = ?').run(IM_VERSAND, id);
      let v;
      try {
        v = await mailDienst.sende({ an, betreff: m.betreff, text: m.text, anhaenge },
          { art: STUFEN[m.stufe].art, bezug: m.rechnung_nr, schluessel: 'mahnung-' + id });
      } catch (e) {
        // mail.sende wirft nur, wenn nichts rausging (sonst kommt eine Antwort mit status/warnung): Marke zurueck.
        db.prepare('UPDATE mahnung SET fehler = ? WHERE id = ? AND fehler = ?').run(vorher, id, IM_VERSAND);
        throw e;
      }
      // Erst jetzt zaehlt die Stufe: ok scharf -> gesendet, Testmodus -> test, fehler/unklar -> fehler.
      const status = v.status === 'ok' ? (v.test ? 'test' : 'gesendet') : 'fehler';
      try {
        db.prepare(`UPDATE mahnung SET status = ?, kanal = 'mail', an = ?, versand_id = ?, fehler = ?, gesendet_am = ?
          WHERE id = ? AND status IN ('erzeugt', 'fehler')`).run(status, an.join(', '), v.id ?? null,
          status === 'fehler' ? String(v.fehler || 'Versand fehlgeschlagen') : null, status === 'gesendet' ? heute() : null, id);
      } catch (e) {
        if (!/UNIQUE/.test(e.message)) {
          if (v.status !== 'ok') throw e;
          // F6: die Mail ist raus (auch "doppelt"), nur der Status fehlt. Keine 500, sonst klickt jemand erneut oder markiert Post.
          ohneStatus.add(sperre);
          console.error('Mahnung ' + id + ': Mail ging raus (Versand ' + v.id + '), Status fuer Stufe ' + m.stufe + ' nicht gespeichert', e);
          return { mahnung: zeile(id), versand: v, warnung: OHNE_STATUS };
        }
        // Nur noch im Rennen zweier Prozesse: die Mail ist raus, dieselbe Stufe war schon gesendet.
        // Vermerk in der Zeile (R6), damit niemand sie fuer ungesendet haelt.
        console.error('Mahnung ' + id + ': Mail ging raus, Stufe ' + m.stufe + ' war inzwischen schon gesendet', v);
        db.prepare("UPDATE mahnung SET status = 'fehler', fehler = 'Mail ging raus, Stufe war bereits gesendet', versand_id = ?, kanal = 'mail', an = ? WHERE id = ?")
          .run(v.id ?? null, an.join(', '), id);
        throw mitStatus(409, 'Stufe bereits gesendet');
      }
      return { mahnung: zeile(id), versand: v };
    } finally {
      laeuft.delete(sperre);
    }
  }

  function markierePost(id) {
    pruefeId(id);
    pruefeGesperrt(sperreVon(id));
    const tag = heute();
    vorpruefe(id, tag, ['erzeugt']);
    try {
      db.prepare(`UPDATE mahnung SET status = 'gesendet', kanal = 'post', versand_id = NULL, fehler = NULL, gesendet_am = ?
        WHERE id = ? AND status = 'erzeugt'`).run(tag, id);
    } catch (e) {
      if (/UNIQUE/.test(e.message)) throw mitStatus(409, 'Stufe bereits gesendet');
      throw e;
    }
    return zeile(id);
  }

  // P6: eine unklar zugestellte Mahnung, nachdem ein Mensch unter Gesendet im Mailkonto nachgesehen hat.
  // Mahnung und Versandzeile zusammen (kein await dazwischen).
  function klaere(id, ergebnis) {
    pruefeId(id);
    if (ergebnis !== 'gesendet' && ergebnis !== 'nicht_gesendet') throw mitStatus(400, "ergebnis: 'gesendet' oder 'nicht_gesendet' erwartet");
    const m = roh(id);
    if (!m) throw mitStatus(404, 'Mahnung nicht gefunden');
    if (!istUnklar(m)) throw mitStatus(409, 'Nur eine Mahnung mit unklarer Zustellung lässt sich klären');
    const v = m.versand_id ? db.prepare('SELECT zeit FROM versand WHERE id = ?').get(m.versand_id) : null;
    db.exec('BEGIN');
    try {
      if (m.versand_id) mailDienst.klaere(m.versand_id, ergebnis);
      if (ergebnis === 'gesendet') {
        db.prepare("UPDATE mahnung SET status = 'gesendet', kanal = 'mail', fehler = NULL, gesendet_am = ? WHERE id = ?").run(tagVon(v ? v.zeit : m.erstellt), id);
      } else {
        db.prepare('UPDATE mahnung SET fehler = ? WHERE id = ?').run(m.fehler.replace(/^Zustellung unklar:\s*/, '') + ' (als nicht zugestellt bestätigt)', id);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      if (/UNIQUE/.test(e.message)) throw mitStatus(409, 'Stufe bereits gesendet');
      throw e;
    }
    return zeile(id);
  }

  // P7: nach einem Neustart ist die Sperre "Mail raus, Status fehlt" (ohneStatus) weg. Genau dieser Fall: Zeile 'erzeugt' oder 'fehler' (Wiederholen nach Fehlversuch),
  // dazu eine scharfe, zugestellte Versandzeile mit dem Mail-Schluessel -> gesendet. Testversand (test=1) bleibt.
  function heile() {
    let n = 0;
    const offene = db.prepare(`SELECT m.id, m.rechnung_nr, m.stufe, v.id vid, v.zeit, v.an FROM mahnung m
      JOIN versand v ON v.schluessel = 'mahnung-' || m.id WHERE m.status IN ('erzeugt', 'fehler') AND v.status = 'ok' AND v.test = 0
      AND NOT EXISTS (SELECT 1 FROM mahnung g WHERE g.rechnung_nr = m.rechnung_nr AND g.stufe = m.stufe AND g.status = 'gesendet')`).all();
    for (const o of offene) {
      if (laeuft.has(o.rechnung_nr + ':' + o.stufe)) continue;
      try {
        db.prepare(`UPDATE mahnung SET status = 'gesendet', kanal = 'mail', an = ?, versand_id = ?, fehler = NULL, gesendet_am = ?
          WHERE id = ? AND status IN ('erzeugt', 'fehler')`).run(o.an, o.vid, tagVon(o.zeit), o.id);
        n++;
      } catch (e) { console.error('Mahnung ' + o.id + ': Status nicht geheilt', e); }
    }
    // Marke ohne Versandzeile: der Server starb im SMTP-Gespraech, das Schreiben ist vielleicht beim Kunden.
    for (const o of db.prepare("SELECT id, rechnung_nr, stufe FROM mahnung WHERE status IN ('erzeugt', 'fehler') AND fehler = ?").all(IM_VERSAND)) {
      if (laeuft.has(o.rechnung_nr + ':' + o.stufe)) continue;
      try {
        n += db.prepare("UPDATE mahnung SET status = 'fehler', fehler = ? WHERE id = ? AND fehler = ?").run(ABBRUCH_UNKLAR, o.id, IM_VERSAND).changes;
      } catch (e) { console.error('Mahnung ' + o.id + ': Abbruch nicht als unklar markiert', e); }
    }
    return n;
  }

  function liste(nr) {
    pruefeNr(nr);
    return db.prepare('SELECT * FROM mahnung WHERE rechnung_nr = ? ORDER BY id DESC').all(nr).map(aus);
  }

  const POST = {
    '/api/mahnung/vorschau': (d) => vorschau(d.nr),
    '/api/mahnung/erzeugen': (d) => erzeuge(d.nr, { stufe: d.stufe, betreff: d.betreff, text: d.text, offen_eur: d.offen_eur, frist: d.frist }),
    '/api/mahnung/senden': (d) => sende(d.id, { an: d.an }),
    '/api/mahnung/post': (d) => markierePost(d.id),
    '/api/mahnung/klaeren': (d) => klaere(d.id, d.ergebnis),
  };
  function routen(req, res, p, u, { sendJson, leseKoerper }) {
    if (req.method === 'POST' && Object.hasOwn(POST, p)) {
      leseKoerper(req, (fehlerText, roh) => {
        if (fehlerText) return sendJson(res, { error: fehlerText }, 400);
        const d = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {};
        mail.antwort(res, sendJson, () => POST[p](d));
      });
      return true;
    }
    if (req.method !== 'GET') return false;
    if (p === '/api/mahnung/stand') {
      mail.antwort(res, sendJson, () => {
        const nrs = String(u.searchParams.get('nr') || '').split(',').filter((n) => NR_RE.test(n)).slice(0, 1000);
        return { stand: mahnStand(db, nrs, heute(), cfg()) };
      });
      return true;
    }
    if (p === '/api/mahnung/liste') { mail.antwort(res, sendJson, () => ({ liste: liste(u.searchParams.get('nr')) })); return true; }
    return false;
  }

  // C11c: laeuft fuer diese Stufe gerade ein Versand (oder ist eine Mail ohne Status raus)? 409 wie sende(), ohne Entwurf anzulegen.
  const sperrePruefen = (nr, stufe) => pruefeGesperrt(nr + ':' + stufe);
  return { vorschau, erzeuge, sende, markierePost, klaere, heile, liste, renderHtml, zeile, routen, sperrePruefen };
}

module.exports = { naechsteStufe, kandidaten, ausgeschlossen, ausgeschoepft, mahnStand, STUFEN, STANDARD, plusTage, renderHtml, erzeugeDienst };
