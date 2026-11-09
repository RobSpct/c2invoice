'use strict';
// C11b Mahnwesen (design/cira/C11-FLOWS.md): Tabelle mahnung, Mahnpause je Kontakt, Fristen-Einstellungen.
const assert = require('node:assert');

module.exports = ({ dbmod, openDbs, configGeschuetzt }) => {
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };

  function tabelleMahnung() {
    const db = neueDb();
    const ein = db.prepare(`INSERT INTO mahnung (rechnung_nr, stufe, erstellt, frist, offen_eur, betreff, text, status)
      VALUES ('2026-0001', ?, '2026-10-28', '2026-11-04', 100, 'b', 't', ?)`);
    ein.run(1, 'erzeugt'); ein.run(1, 'erzeugt'); // mehrere Entwuerfe duerfen sein
    ein.run(1, 'gesendet');
    assert.throws(() => ein.run(1, 'gesendet'), /UNIQUE/);
    ein.run(2, 'gesendet'); // andere Stufe ist frei
    ein.run(1, 'test'); ein.run(1, 'fehler'); // Test und Fehler sperren nicht
    assert.throws(() => ein.run(4, 'erzeugt'), /CHECK/);
    assert.throws(() => ein.run(0, 'erzeugt'), /CHECK/);
    assert.throws(() => ein.run(1, 'kaputt'), /CHECK/);
    assert.throws(() => db.prepare(`INSERT INTO mahnung (rechnung_nr, stufe, erstellt, frist, offen_eur, betreff, text, status, kanal)
      VALUES ('x', 1, 'a', 'b', 1, 'b', 't', 'erzeugt', 'fax')`).run(), /CHECK/);
    assert.strictEqual(db.prepare("SELECT gebuehr_eur FROM mahnung WHERE status = 'fehler'").get().gebuehr_eur, 0);
  }

  function mahnpauseFeld() {
    const kontakte = require('../../kontakte');
    assert.deepStrictEqual(kontakte.FELDER.mahnpauseBis, { typ: 'tag', label: 'Mahnpause bis' });
    const db = neueDb();
    const k = kontakte.speichere(db, { firma: 'Muster GmbH' });
    for (const w of ['2026-13-01', '2026-02-30', 'morgen', '2026-1-1', '2026-11-30x', 5]) {
      assert.throws(() => kontakte.speichere(db, { id: k.id, mahnpauseBis: w }), /Mahnpause bis/, JSON.stringify(w));
    }
    assert.strictEqual(kontakte.lade(db, k.id).mahnpauseBis, '');
    assert.strictEqual(kontakte.speichere(db, { id: k.id, mahnpauseBis: '2026-11-30' }).mahnpauseBis, '2026-11-30');
    assert.strictEqual(db.prepare('SELECT mahnpause_bis FROM kontakte WHERE id = ?').get(k.id).mahnpause_bis, '2026-11-30');
    // leer loescht: NULL in der Spalte, '' in der Ausgabe
    assert.strictEqual(kontakte.speichere(db, { id: k.id, mahnpauseBis: ' ' }).mahnpauseBis, '');
    assert.strictEqual(db.prepare('SELECT mahnpause_bis FROM kontakte WHERE id = ?').get(k.id).mahnpause_bis, null);
    // beim Anlegen
    assert.strictEqual(kontakte.speichere(db, { firma: 'B', mahnpauseBis: '2027-02-28' }).mahnpauseBis, '2027-02-28');
    // eine Teileingabe laesst die Pause stehen
    kontakte.speichere(db, { id: k.id, mahnpauseBis: '2026-12-01' });
    assert.strictEqual(kontakte.speichere(db, { id: k.id, notiz: 'n' }).mahnpauseBis, '2026-12-01');
  }

  function mahnwesenGrenzen() {
    configGeschuetzt(() => {
      const { setzeEinstellungen, EINSTELLUNGEN } = require('../../server');
      const config = require('../../config.json');
      const ganz = ['erinnerungNachTagen', 'mahnung1NachTagen', 'mahnung2NachTagen', 'neueFristTage'];
      const standard = { erinnerungNachTagen: 7, mahnung1NachTagen: 14, mahnung2NachTagen: 14, neueFristTage: 7 };
      for (const f of ganz) {
        assert.strictEqual(EINSTELLUNGEN[f].standard, standard[f], f);
        assert.strictEqual(EINSTELLUNGEN[f].pfad, 'mahnwesen.' + f);
        for (const w of [0, 91, 2.5, -1, 'x']) assert.throws(() => setzeEinstellungen({ [f]: w }), /Tage|Zahlungsfrist|Zahl/, f + ' ' + JSON.stringify(w));
        for (const w of [1, 90]) setzeEinstellungen({ [f]: w });
        assert.strictEqual(config.mahnwesen[f], 90);
      }
      assert.deepStrictEqual([EINSTELLUNGEN.gebuehrStufe2Eur.standard, EINSTELLUNGEN.gebuehrStufe2Eur.pfad], [0, 'mahnwesen.gebuehrStufe2Eur']);
      for (const w of [41, -0.01, 'x']) assert.throws(() => setzeEinstellungen({ gebuehrStufe2Eur: w }), /Mahngebühr/, JSON.stringify(w));
      setzeEinstellungen({ gebuehrStufe2Eur: 3 });
      assert.strictEqual(config.mahnwesen.gebuehrStufe2Eur, 3);
      setzeEinstellungen({ gebuehrStufe2Eur: 40 });
      setzeEinstellungen({ gebuehrStufe2Eur: 0 });
      // ein Fehler im zweiten Feld laesst das erste unveraendert
      const vorher = config.mahnwesen.neueFristTage;
      assert.throws(() => setzeEinstellungen({ neueFristTage: 30, erinnerungNachTagen: 0 }));
      assert.strictEqual(config.mahnwesen.neueFristTage, vorher);
      // und es landet in der Datei (SCHREIBBAR)
      const datei = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', 'config.json'), 'utf8'));
      assert.strictEqual(datei.mahnwesen.gebuehrStufe2Eur, 0);
    });
  }

  // --- Task 2: naechsteStufe / mahnStand --------------------------------------
  // Rechnung 1.190 EUR, faellig 2026-10-01, direkt eingefuegt (kein Zeitmodell noetig).
  function rechnungMit(db, { nr = '2026-0001', faellig = '2026-10-01', brutto = 1190, status = 'erstellt', kontakt = null } = {}) {
    const [, laufnr] = nr.split('-');
    db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis, empfaenger, aussteller, positionen,
      netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, status, faellig_am, kontakt_id)
      VALUES (?, 2026, ?, '2026-09-17', '2026-09-01', '2026-09-16', '{}', '{}', '[]', ?, 19, 0, ?, 0, ?, ?, ?)`)
      .run(nr, Number(laufnr), brutto, brutto, status, faellig, kontakt);
    return nr;
  }
  const sende = (db, nr, stufe, am, status = 'gesendet') => db.prepare(`INSERT INTO mahnung (rechnung_nr, stufe, erstellt, frist, offen_eur,
    betreff, text, status, gesendet_am, kanal) VALUES (?, ?, ?, ?, 1190, 'b', 't', ?, ?, 'mail')`).run(nr, stufe, am, am, status, am);
  const CFG = { erinnerungNachTagen: 7, mahnung1NachTagen: 14, mahnung2NachTagen: 14 };

  function stufe1AbFaelligkeit() {
    const { naechsteStufe } = require('../../mahnung');
    const db = neueDb(); const nr = rechnungMit(db);
    assert.strictEqual(naechsteStufe(db, nr, '2026-09-30', CFG), null);
    assert.strictEqual(naechsteStufe(db, nr, '2026-10-01', CFG), null, 'am Faelligkeitstag noch nicht');
    assert.deepStrictEqual(naechsteStufe(db, nr, '2026-10-02', CFG), { stufe: 1, faellig_ab: '2026-10-08' });
    assert.deepStrictEqual(naechsteStufe(db, nr, '2026-12-31', CFG), { stufe: 1, faellig_ab: '2026-10-08' });
    assert.strictEqual(naechsteStufe(db, 'gibt-es-nicht', '2026-10-02', CFG), null);
  }

  function fristenAusEinstellungen() {
    const { naechsteStufe } = require('../../mahnung');
    const db = neueDb(); const nr = rechnungMit(db);
    assert.deepStrictEqual(naechsteStufe(db, nr, '2026-10-02', { ...CFG, erinnerungNachTagen: 3 }), { stufe: 1, faellig_ab: '2026-10-04' });
    // fehlend/ungueltig -> Standard 7
    for (const c of [undefined, {}, { erinnerungNachTagen: 0 }, { erinnerungNachTagen: 'x' }, { erinnerungNachTagen: 2.5 }, { erinnerungNachTagen: 91 }]) {
      assert.strictEqual(naechsteStufe(db, nr, '2026-10-02', c).faellig_ab, '2026-10-08', JSON.stringify(c));
    }
    sende(db, nr, 1, '2026-10-10');
    assert.strictEqual(naechsteStufe(db, nr, '2026-10-12', { ...CFG, mahnung1NachTagen: 5 }).faellig_ab, '2026-10-15');
    sende(db, nr, 2, '2026-10-24');
    assert.strictEqual(naechsteStufe(db, nr, '2026-10-26', { ...CFG, mahnung2NachTagen: 3 }).faellig_ab, '2026-10-27');
  }

  function folgestufeAbVersandtag() {
    const { naechsteStufe } = require('../../mahnung');
    const db = neueDb(); const nr = rechnungMit(db);
    sende(db, nr, 1, '2026-10-10');
    assert.deepStrictEqual(naechsteStufe(db, nr, '2026-10-11', CFG), { stufe: 2, faellig_ab: '2026-10-24' });
    sende(db, nr, 2, '2026-10-24');
    assert.deepStrictEqual(naechsteStufe(db, nr, '2026-10-25', CFG), { stufe: 3, faellig_ab: '2026-11-07' });
    // Testversand und Fehler zaehlen nie
    const db2 = neueDb(); const n2 = rechnungMit(db2);
    sende(db2, n2, 1, '2026-10-10', 'test'); sende(db2, n2, 1, '2026-10-10', 'fehler'); sende(db2, n2, 1, '2026-10-10', 'erzeugt');
    assert.deepStrictEqual(naechsteStufe(db2, n2, '2026-10-12', CFG), { stufe: 1, faellig_ab: '2026-10-08' });
    // gesendet_am als volle Zeitangabe zaehlt als Ortstag
    const db3 = neueDb(); const n3 = rechnungMit(db3);
    sende(db3, n3, 1, '2026-10-10T12:00:00');
    assert.strictEqual(naechsteStufe(db3, n3, '2026-10-12', CFG).faellig_ab, '2026-10-24');
  }

  function ausgeschoepft() {
    const { naechsteStufe, mahnStand } = require('../../mahnung');
    const db = neueDb(); const nr = rechnungMit(db);
    sende(db, nr, 1, '2026-10-10'); sende(db, nr, 2, '2026-10-24'); sende(db, nr, 3, '2026-11-07');
    assert.strictEqual(naechsteStufe(db, nr, '2026-12-01', CFG), null);
    const s = mahnStand(db, [nr], '2026-12-01', CFG)[nr];
    assert.strictEqual(s.grund, 'ausgeschoepft');
    assert.strictEqual(s.gesendet, 3);
    assert.deepStrictEqual(s.zuletzt, { stufe: 3, gesendet_am: '2026-11-07', kanal: 'mail' });
    assert.strictEqual(s.naechste, null);
  }

  function offenUndBezahlt() {
    const { naechsteStufe, mahnStand } = require('../../mahnung');
    const rechnung = require('../../rechnung');
    const db = neueDb(); const nr = rechnungMit(db);
    rechnung.bucheZahlung(db, { nr, datum: '2026-10-05', betrag_eur: 190 });
    assert.deepStrictEqual(naechsteStufe(db, nr, '2026-10-10', CFG), { stufe: 1, faellig_ab: '2026-10-08' }, 'Teilzahlung mahnt weiter');
    rechnung.bucheZahlung(db, { nr, datum: '2026-10-06', betrag_eur: 1000 });
    assert.strictEqual(naechsteStufe(db, nr, '2026-10-10', CFG), null);
    assert.strictEqual(mahnStand(db, [nr], '2026-10-10', CFG)[nr].grund, 'bezahlt');
    const st = rechnungMit(db, { nr: '2026-0002', status: 'storniert' });
    assert.strictEqual(naechsteStufe(db, st, '2026-10-10', CFG), null);
    assert.strictEqual(mahnStand(db, [st], '2026-10-10', CFG)[st].grund, 'storniert');
    const frisch = rechnungMit(db, { nr: '2026-0003' });
    const s = mahnStand(db, [frisch, st, 'x'], '2026-10-01', CFG);
    assert.strictEqual(s[frisch].grund, 'nicht_faellig');
    assert.deepStrictEqual(s.x, { gesendet: 0, zuletzt: null, naechste: null, grund: null, pause_bis: null });
  }

  function mahnpauseWirkt() {
    const { naechsteStufe, mahnStand } = require('../../mahnung');
    const kontakte = require('../../kontakte');
    const db = neueDb();
    const k = kontakte.speichere(db, { firma: 'Muster GmbH', mahnpauseBis: '2026-10-10' });
    const nr = rechnungMit(db, { kontakt: k.id });
    assert.strictEqual(naechsteStufe(db, nr, '2026-10-10', CFG), null, 'Pause bis heute');
    const s = mahnStand(db, [nr], '2026-10-10', CFG)[nr];
    assert.strictEqual(s.grund, 'pause'); assert.strictEqual(s.pause_bis, '2026-10-10');
    assert.deepStrictEqual(naechsteStufe(db, nr, '2026-10-11', CFG), { stufe: 1, faellig_ab: '2026-10-08' }, 'Pause bis gestern');
    kontakte.speichere(db, { id: k.id, mahnpauseBis: ' ' });
    assert.ok(naechsteStufe(db, nr, '2026-10-10', CFG), 'Pause geloescht (NULL)');
    const ohne = rechnungMit(db, { nr: '2026-0002' });
    assert.ok(naechsteStufe(db, ohne, '2026-10-10', CFG), 'ohne Kontakt');
  }

  function zeitumstellung() {
    const { plusTage, naechsteStufe } = require('../../mahnung');
    assert.strictEqual(plusTage('2026-10-20', 7), '2026-10-27', 'ueber den 25.10. (Ende Sommerzeit)');
    assert.strictEqual(plusTage('2026-03-25', 7), '2026-04-01', 'ueber den 29.03. (Beginn Sommerzeit)');
    assert.strictEqual(plusTage('2026-12-28', 7), '2027-01-04');
    const db = neueDb(); const nr = rechnungMit(db, { faellig: '2026-10-20' });
    assert.strictEqual(naechsteStufe(db, nr, '2026-10-21', CFG).faellig_ab, '2026-10-27');
  }

  // Review Task 2: heute nur als Kalendertag (eine volle ISO-Zeit zaehlte den Faelligkeitstag als ueberfaellig),
  // und ausgeschoepft vor Pause (die Anzeige sagt sonst "Pause", obwohl nichts mehr kommt).
  function heuteStreng() {
    const { naechsteStufe, mahnStand } = require('../../mahnung');
    const kontakte = require('../../kontakte');
    const db = neueDb(); const nr = rechnungMit(db);
    for (const h of ['2026-10-01T10:00:00', '2026-10-01T10:00:00.000Z', '2026-13-01', '', undefined, 20261002]) {
      assert.throws(() => naechsteStufe(db, nr, h, CFG), /heute/, JSON.stringify(h));
    }
    const k = kontakte.speichere(db, { firma: 'Muster GmbH', mahnpauseBis: '2026-12-31' });
    const n2 = rechnungMit(db, { nr: '2026-0002', kontakt: k.id });
    sende(db, n2, 1, '2026-10-10'); sende(db, n2, 2, '2026-10-24'); sende(db, n2, 3, '2026-11-07');
    assert.strictEqual(mahnStand(db, [n2], '2026-12-01', CFG)[n2].grund, 'ausgeschoepft');
  }

  // --- Task 3: Abschrift, Druck, Senden, Post --------------------------------
  // Versand-Attrappe: echter Dienst (empfaengerVon, status), sende zaehlt nur. Druck-Attrappen, kein Chrome.
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const AUSSTELLER = { name: 'Büro Test', anschrift: ['Weg 1', '50667 Köln'], steuernummer: '111/222/33333', email: 'a@example.org',
    iban: 'DE89370400440532013000', bank: 'Testbank', bic: 'COBADEFFXXX' };
  const EMPF = { name: 'Kunde GmbH', anschrift: ['Hauptstr. 1', '50667 Köln'] };
  const MAILCFG = { absender: { name: 'Büro', adresse: 'a@example.org' } };
  async function mitMahnDienst(opt, fn) {
    const mail = require('../../mail');
    const { erzeugeDienst } = require('../../mahnung');
    const db = neueDb(), aufrufe = [], druck = [];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-mahn-'));
    const kid = Number(db.prepare("INSERT INTO kontakte (firma, email, erstellt_am) VALUES ('Kunde GmbH', 'fallback@example.org', 'x')").run().lastInsertRowid);
    const nr = rechnungMit(db, { kontakt: kid });
    db.prepare("UPDATE invoices SET aussteller = ?, empfaenger = ?, erstellt_am = '2026-09-17T10:00:00.000Z'").run(JSON.stringify(AUSSTELLER), JSON.stringify(EMPF));
    const st = { heute: '2026-10-10', antworten: [], mahnCfg: { ...CFG, neueFristTage: 7, gebuehrStufe2Eur: 0, ...(opt.mahnCfg || {}) }, mailCfg: { ...MAILCFG, ...(opt.mailCfg || {}) } };
    const echt = mail.erzeuge({ db, mailCfg: () => st.mailCfg });
    let vid = 100;
    const mailDienst = { ...echt, sende: async (n, o) => {
      aufrufe.push({ n, o });
      await new Promise((ok) => setImmediate(ok));
      if (st.waehrend) { const w = st.waehrend; st.waehrend = null; await w(); }
      return { id: ++vid, test: false, ...(st.antworten.shift() || { status: 'ok' }) };
    } };
    const pdfFn = async (id, ziel) => {
      druck.push(id);
      if (st.druckKaputt) throw new Error('Weder Chrome noch Edge gefunden.');
      fs.mkdirSync(path.dirname(ziel), { recursive: true }); fs.writeFileSync(ziel, '%PDF-mahnung ' + id); return ziel;
    };
    const rechnungPdfFn = async (n) => { const p = path.join(tmp, n + '.pdf'); fs.writeFileSync(p, '%PDF-rechnung ' + n); return { nr: n, pdf: p }; };
    const d = erzeugeDienst({ db, mailDienst, mahnCfg: () => st.mahnCfg, mailCfg: () => st.mailCfg, heute: () => st.heute, pdfFn, rechnungPdfFn,
      ordner: path.join(tmp, 'mahnungen') });
    // F2: erzeuge verlangt Betrag und Frist aus der Vorschau (wie der Dialog). Tests ohne eigene Werte nehmen die
    // aktuelle Vorschau; erzeugeRoh ist die Funktion ohne diese Hilfe.
    const erzeugeRoh = d.erzeuge;
    d.erzeuge = (n, o = {}) => {
      let v = {};
      try { v = d.vorschau(n); } catch { /* den Fehler meldet erzeuge selbst */ }
      return erzeugeRoh(n, { offen_eur: v.offen_eur, frist: v.frist, ...o });
    };
    try {
      await fn({ d, db, nr, kid, st, aufrufe, druck, tmp, erzeugeRoh, zeile: (id) => db.prepare('SELECT * FROM mahnung WHERE id = ?').get(id) });
      // Plausibilitaet (Projektregel) fuer jede Zeile, die irgendein Test erzeugt hat.
      for (const z of db.prepare('SELECT m.*, i.brutto_eur FROM mahnung m JOIN invoices i ON i.nr = m.rechnung_nr').all()) {
        assert.ok(z.offen_eur > 0 && z.offen_eur <= z.brutto_eur, 'offen_eur ' + z.offen_eur);
        assert.ok(z.gebuehr_eur >= 0 && z.gebuehr_eur <= 40, 'gebuehr_eur ' + z.gebuehr_eur);
        assert.ok(z.gebuehr_eur === 0 || z.stufe === 3, 'Gebuehr auf Stufe ' + z.stufe);
      }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  const mit409 = (muster) => (e) => e.status === 409 && muster.test(e.message);
  // Gesendete Vorstufen direkt eintragen (wie oben sende()).
  const vorstufen = (db, nr, n) => { if (n >= 1) sende(db, nr, 1, '2026-10-10'); if (n >= 2) sende(db, nr, 2, '2026-10-24'); };

  async function offenerBetrag() {
    const rechnung = require('../../rechnung');
    await mitMahnDienst({}, async ({ d, db, nr, druck, tmp, zeile }) => {
      rechnung.bucheZahlung(db, { nr, datum: '2026-10-05', betrag_eur: 190 });
      const m = await d.erzeuge(nr, { stufe: 1 });
      assert.deepStrictEqual([m.stufe, m.offen_eur, m.gebuehr_eur, m.frist, m.erstellt, m.status], [1, 1000, 0, '2026-10-17', '2026-10-10', 'erzeugt']);
      assert.strictEqual(m.betreff, 'Zahlungserinnerung zur Rechnung ' + nr);
      assert.strictEqual(m.text, 'Guten Tag,\n\nsicher ist es Ihnen im Alltag entgangen: Die Rechnung ' + nr + ' vom ' + rechnung.datum('2026-09-17T10:00:00.000Z')
        + ' war am ' + rechnung.datum('2026-10-01T12:00:00') + ' fällig. Offen sind noch ' + rechnung.eur(1000) + '.\n\nBitte überweisen Sie den Betrag bis '
        + rechnung.datum('2026-10-17T12:00:00') + '. Haben Sie bereits gezahlt, betrachten Sie dieses Schreiben bitte als gegenstandslos.\n\nViele Grüße\nBüro');
      assert.ok(m.text.includes('1.000,00 EUR'), m.text);
      assert.strictEqual(zeile(m.id).pdf_pfad, path.join(tmp, 'mahnungen', nr + '-1-' + m.id + '.pdf'));
      // F5: der lokale Pfad steht in keiner Antwort, nur ob es ein PDF gibt.
      assert.ok(!Object.hasOwn(m, 'pdf_pfad'));
      assert.strictEqual(m.pdf, true);
      assert.deepStrictEqual(druck, [m.id]);
      // Vorschau rechnet dasselbe, speichert nichts.
      const v = d.vorschau(nr);
      assert.deepStrictEqual([v.stufe, v.titel, v.faellig_ab, v.offen_eur, v.frist, v.betreff, v.text], [1, 'Zahlungserinnerung', '2026-10-08', 1000, '2026-10-17', m.betreff, m.text]);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 1);
      // Druck scheitert: Zeile bleibt erzeugt ohne PDF, Antwort mit Warnung.
    });
    await mitMahnDienst({}, async ({ d, nr, st }) => {
      st.druckKaputt = true;
      const m = await d.erzeuge(nr, { stufe: 1 });
      assert.deepStrictEqual([m.status, m.pdf], ['erzeugt', false]);
      assert.match(m.warnung, /PDF/);
    });
  }

  async function keinUeberspringen() {
    await mitMahnDienst({}, async ({ d, nr, db }) => {
      for (const s of [2, 3, 0, '1', null]) await assert.rejects(d.erzeuge(nr, { stufe: s }), mit409(/nur Stufe 1 möglich/), String(s));
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 0);
      await assert.rejects(d.erzeuge('2026-0099', { stufe: 1 }), (e) => e.status === 404);
      await assert.rejects(d.erzeuge('../x', { stufe: 1 }), (e) => e.status === 400);
    });
  }

  async function gebuehrNurStufe3() {
    const rechnung = require('../../rechnung');
    await mitMahnDienst({ mahnCfg: { gebuehrStufe2Eur: 5 } }, async ({ d, db, nr, st }) => {
      const m1 = await d.erzeuge(nr, { stufe: 1 });
      assert.strictEqual(m1.gebuehr_eur, 0);
      assert.ok(!m1.text.includes('Mahngebühr'));
      sende(db, nr, 1, '2026-10-10');
      st.heute = '2026-10-25';
      const m2 = await d.erzeuge(nr, { stufe: 2 });
      assert.strictEqual(m2.gebuehr_eur, 0);
      assert.strictEqual(m2.betreff, '1. Mahnung zur Rechnung ' + nr);
      sende(db, nr, 2, '2026-10-24');
      const m3 = await d.erzeuge(nr, { stufe: 3 });
      assert.strictEqual(m3.gebuehr_eur, 5);
      assert.strictEqual(m3.betreff, '2. Mahnung zur Rechnung ' + nr);
      assert.ok(m3.text.includes('weiterhin offen: ' + rechnung.eur(1190) + ', zuzüglich Mahngebühr von ' + rechnung.eur(5) + '.'), m3.text);
      st.mahnCfg.gebuehrStufe2Eur = 0;
      const m3b = await d.erzeuge(nr, { stufe: 3 });
      assert.strictEqual(m3b.gebuehr_eur, 0);
      assert.ok(m3b.text.includes('weiterhin offen: ' + rechnung.eur(1190) + '.'), m3b.text);
      assert.ok(!m3b.text.includes('Mahngebühr'));
      // Werte ausserhalb 0-40 aus der Datei gelten nicht.
      for (const g of [41, -1, 'x']) { st.mahnCfg.gebuehrStufe2Eur = g; assert.strictEqual((await d.erzeuge(nr, { stufe: 3 })).gebuehr_eur, 0, String(g)); }
    });
  }

  // Zu zahlen kommt vom Server (eine Formel): Stufe 3 mit Gebuehr 5 auf 1.000 offen = 1.005, in Vorschau, Zeile und Liste.
  async function gesamtVomServer() {
    const rechnung = require('../../rechnung');
    await mitMahnDienst({ mahnCfg: { gebuehrStufe2Eur: 5 } }, async ({ d, db, nr, st }) => {
      rechnung.bucheZahlung(db, { nr, datum: '2026-10-05', betrag_eur: 190 });
      sende(db, nr, 1, '2026-10-10'); sende(db, nr, 2, '2026-10-24');
      st.heute = '2026-11-10';
      const v = d.vorschau(nr);
      assert.deepStrictEqual([v.stufe, v.offen_eur, v.gebuehr_eur, v.gesamt_eur], [3, 1000, 5, 1005]);
      const m = await d.erzeuge(nr, { stufe: 3 });
      assert.deepStrictEqual([m.offen_eur, m.gebuehr_eur, m.gesamt_eur], [1000, 5, 1005]);
      assert.strictEqual(d.liste(nr)[0].gesamt_eur, 1005);
      // PDF und Antworten rechnen dieselbe Summe.
      assert.ok(d.renderHtml(m, rechnung.detail(db, nr, { heute: st.heute })).includes(rechnung.eur(1005)));
      // Ohne Gebuehr: Summe = offen.
      st.mahnCfg.gebuehrStufe2Eur = 0;
      assert.strictEqual(d.vorschau(nr).gesamt_eur, 1000);
    });
  }
  // frueh kommt vom Server: Stufe 1 ist ab 2026-10-08 regulaer; am 04.10. mahnt der Owner frueher.
  async function fruehVomServer() {
    await mitMahnDienst({}, async ({ d, nr, st }) => {
      st.heute = '2026-10-04';
      assert.deepStrictEqual([d.vorschau(nr).faellig_ab, d.vorschau(nr).frueh], ['2026-10-08', true]);
      st.heute = '2026-10-08';
      assert.strictEqual(d.vorschau(nr).frueh, false);
    });
  }

  async function stufeNachVersand() {
    const { naechsteStufe } = require('../../mahnung');
    await mitMahnDienst({}, async ({ d, db, nr, st, aufrufe }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      st.antworten.push({ status: 'fehler', fehler: 'SMTP: 550 abgelehnt' });
      const r = await d.sende(m.id, { an: ['kunde@example.org'] });
      assert.deepStrictEqual([r.mahnung.status, r.mahnung.fehler, r.mahnung.gesendet_am, r.versand.status], ['fehler', 'SMTP: 550 abgelehnt', null, 'fehler']);
      assert.strictEqual(naechsteStufe(db, nr, '2026-10-10', st.mahnCfg).stufe, 1);
      const a = aufrufe[0];
      assert.deepStrictEqual([a.n.an, a.n.betreff, a.n.text], [['kunde@example.org'], m.betreff, m.text]);
      assert.deepStrictEqual(a.o, { art: 'erinnerung', bezug: nr, schluessel: 'mahnung-' + m.id });
      assert.deepStrictEqual(a.n.anhaenge.map((x) => [x.name, x.typ, x.daten.toString()]), [
        ['Zahlungserinnerung-' + nr + '.pdf', 'application/pdf', '%PDF-mahnung ' + m.id],
        ['Rechnung-' + nr + '.pdf', 'application/pdf', '%PDF-rechnung ' + nr]]);
      const r2 = await d.sende(m.id, { an: ['kunde@example.org'] });
      assert.deepStrictEqual([r2.mahnung.status, r2.mahnung.kanal, r2.mahnung.gesendet_am, r2.mahnung.versand_id, r2.mahnung.fehler, r2.mahnung.an],
        ['gesendet', 'mail', '2026-10-10', r2.versand.id, null, 'kunde@example.org']);
      assert.deepStrictEqual(naechsteStufe(db, nr, '2026-10-10', st.mahnCfg), { stufe: 2, faellig_ab: '2026-10-24' });
    });
  }

  async function testmodusZaehltNicht() {
    const { naechsteStufe } = require('../../mahnung');
    await mitMahnDienst({}, async ({ d, db, nr, st }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      st.antworten.push({ status: 'ok', test: true });
      const r = await d.sende(m.id, { an: ['kunde@example.org'] });
      assert.deepStrictEqual([r.mahnung.status, r.mahnung.kanal, r.mahnung.gesendet_am], ['test', 'mail', null]);
      assert.strictEqual(naechsteStufe(db, nr, '2026-10-10', st.mahnCfg).stufe, 1);
      // unklar: fehler, Stufe zaehlt nicht und ist gesperrt (F1, Test unklarSperrt)
      const u = await d.erzeuge(nr, { stufe: 1 });
      st.antworten.push({ status: 'fehler', fehler: 'Zustellung unklar: x', unklar: true });
      assert.strictEqual((await d.sende(u.id, { an: ['kunde@example.org'] })).mahnung.status, 'fehler');
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM mahnung WHERE status = 'gesendet'").get().n, 0);
    });
  }

  async function doppelt() {
    await mitMahnDienst({}, async ({ d, db, nr, st, aufrufe }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      st.antworten.push({ status: 'fehler', fehler: 'SMTP: 421' });
      await d.sende(m.id, { an: ['kunde@example.org'] });
      await d.sende(m.id, { an: ['kunde@example.org'] });
      assert.deepStrictEqual(aufrufe.map((a) => a.o.schluessel), ['mahnung-' + m.id, 'mahnung-' + m.id]);
      // R3: nach gesendet kein zweiter Versand
      await assert.rejects(d.sende(m.id, { an: ['kunde@example.org'] }), (e) => e.status === 409);
      assert.strictEqual(aufrufe.length, 2);
      await assert.rejects(d.erzeuge(nr, { stufe: 1 }), mit409(/nur Stufe 2 möglich/));
    });
    // Zwei Entwuerfe derselben Stufe: der zweite geht nach dem ersten nicht mehr raus.
    await mitMahnDienst({}, async ({ d, db, nr, aufrufe }) => {
      const a = await d.erzeuge(nr, { stufe: 1 }), b = await d.erzeuge(nr, { stufe: 1 });
      await d.sende(a.id, { an: ['kunde@example.org'] });
      await assert.rejects(d.sende(b.id, { an: ['kunde@example.org'] }), mit409(/Stufe bereits gesendet/));
      assert.throws(() => d.markierePost(b.id), mit409(/Stufe bereits gesendet/));
      assert.strictEqual(aufrufe.length, 1);
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM mahnung WHERE status = 'gesendet'").get().n, 1);
    });
    // Doppelklick / zwei Tabs: eine Mail, eine gesendet-Zeile.
    await mitMahnDienst({}, async ({ d, db, nr, aufrufe }) => {
      const a = await d.erzeuge(nr, { stufe: 1 });
      const r = await Promise.allSettled([d.sende(a.id, { an: ['kunde@example.org'] }), d.sende(a.id, { an: ['kunde@example.org'] }), (async () => d.markierePost(a.id))()]);
      assert.deepStrictEqual(r.map((x) => x.status), ['fulfilled', 'rejected', 'rejected']);
      assert.strictEqual(r[1].reason.status, 409); assert.strictEqual(r[2].reason.status, 409);
      assert.strictEqual(aufrufe.length, 1);
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM mahnung WHERE status = 'gesendet'").get().n, 1);
    });
    // I1: Sperre je Stufe der Rechnung. Zwei Entwuerfe derselben Stufe parallel senden: eine Mail, der zweite 409.
    await mitMahnDienst({}, async ({ d, db, nr, aufrufe }) => {
      const a = await d.erzeuge(nr, { stufe: 1 }), b = await d.erzeuge(nr, { stufe: 1 });
      const r = await Promise.allSettled([d.sende(a.id, { an: ['kunde@example.org'] }), d.sende(b.id, { an: ['kunde@example.org'] })]);
      assert.deepStrictEqual(r.map((x) => x.status), ['fulfilled', 'rejected']);
      assert.ok(mit409(/Versand läuft bereits/)(r[1].reason), r[1].reason && r[1].reason.message);
      assert.strictEqual(aufrufe.length, 1);
      assert.deepStrictEqual(db.prepare("SELECT id FROM mahnung WHERE status = 'gesendet'").all().map((z) => z.id), [a.id]);
    });
    // Post fuer einen zweiten Entwurf, waehrend die Mail des ersten laeuft: 409 fuer die Post, eine Mail.
    await mitMahnDienst({}, async ({ d, db, nr, st, aufrufe, zeile }) => {
      const a = await d.erzeuge(nr, { stufe: 1 }), b = await d.erzeuge(nr, { stufe: 1 });
      let postFehler = null;
      st.waehrend = () => { try { d.markierePost(b.id); } catch (e) { postFehler = e; } };
      assert.strictEqual((await d.sende(a.id, { an: ['kunde@example.org'] })).mahnung.status, 'gesendet');
      assert.ok(postFehler && mit409(/Versand läuft bereits/)(postFehler), postFehler && postFehler.message);
      assert.strictEqual(aufrufe.length, 1);
      assert.strictEqual(zeile(b.id).status, 'erzeugt');
    });
    // M1: UNIQUE erst beim UPDATE (Rennen zweier Prozesse, hier per Direkt-INSERT nachgestellt): 409, Vermerk in der Zeile.
    await mitMahnDienst({}, async ({ d, db, nr, st, zeile }) => {
      const a = await d.erzeuge(nr, { stufe: 1 });
      st.waehrend = () => sende(db, nr, 1, '2026-10-10');
      await assert.rejects(d.sende(a.id, { an: ['kunde@example.org'] }), mit409(/Stufe bereits gesendet/));
      const z = zeile(a.id);
      assert.deepStrictEqual([z.status, z.fehler, z.versand_id, z.kanal], ['fehler', 'Mail ging raus, Stufe war bereits gesendet', 101, 'mail']);
      await assert.rejects(d.sende(a.id, { an: ['kunde@example.org'] }), mit409(/Stufe bereits gesendet/));
    });
  }

  async function vorSendenGeaendert() {
    const rechnung = require('../../rechnung');
    const fall = async (aendere, muster) => mitMahnDienst({}, async ({ d, db, nr, st, aufrufe, zeile }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      aendere({ db, nr, st });
      await assert.rejects(d.sende(m.id, { an: ['kunde@example.org'] }), mit409(muster));
      assert.throws(() => d.markierePost(m.id), mit409(muster));
      assert.strictEqual(aufrufe.length, 0);
      assert.strictEqual(zeile(m.id).status, 'erzeugt');
    });
    await fall(({ db, nr }) => rechnung.bucheZahlung(db, { nr, datum: '2026-10-10', betrag_eur: 1190 }), /^Rechnung inzwischen bezahlt$/);
    await fall(({ db, nr }) => rechnung.bucheZahlung(db, { nr, datum: '2026-10-10', betrag_eur: 100 }), /^Betrag hat sich geändert — neu erzeugen$/);
    await fall(({ st }) => { st.heute = '2026-10-18'; }, /^Frist abgelaufen — neu erzeugen$/);
    // I2 (R5): Rest groesser als die Abschrift (Zahlung geloescht) ist ebenso ein geaenderter Betrag.
    await mitMahnDienst({}, async ({ d, db, nr, aufrufe, zeile }) => {
      const z = rechnung.bucheZahlung(db, { nr, datum: '2026-10-05', betrag_eur: 190 });
      const m = await d.erzeuge(nr, { stufe: 1 });
      assert.strictEqual(m.offen_eur, 1000);
      rechnung.loescheZahlung(db, z.id);
      await assert.rejects(d.sende(m.id, { an: ['kunde@example.org'] }), mit409(/^Betrag hat sich geändert — neu erzeugen$/));
      assert.throws(() => d.markierePost(m.id), mit409(/^Betrag hat sich geändert — neu erzeugen$/));
      assert.strictEqual(aufrufe.length, 0);
      assert.strictEqual(zeile(m.id).status, 'erzeugt');
    });
    await fall(({ db, nr }) => db.prepare("UPDATE invoices SET status = 'storniert' WHERE nr = ?").run(nr), /storniert/);
    // Mahnpause nach dem Erzeugen
    await fall(({ db, st }) => db.prepare("UPDATE kontakte SET mahnpause_bis = '2026-10-10'").run(), /Mahnpause/);
    // Grenzen: Frist heute gilt noch (Post; die Mail verlangt seit F3 ein Schreiben von heute); ein Cent Rundung ist kein geaenderter Betrag.
    await mitMahnDienst({}, async ({ d, db, nr, st }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      rechnung.bucheZahlung(db, { nr, datum: '2026-10-10', betrag_eur: 0.01 });
      st.heute = '2026-10-17';
      assert.strictEqual(d.markierePost(m.id).status, 'gesendet');
    });
    await mitMahnDienst({}, async ({ d, db, nr }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      rechnung.bucheZahlung(db, { nr, datum: '2026-10-10', betrag_eur: 0.01 });
      assert.strictEqual((await d.sende(m.id, { an: ['kunde@example.org'] })).mahnung.status, 'gesendet');
    });
  }

  async function post() {
    await mitMahnDienst({}, async ({ d, nr, aufrufe, st }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      const p = d.markierePost(m.id);
      assert.deepStrictEqual([p.status, p.kanal, p.versand_id, p.gesendet_am], ['gesendet', 'post', null, '2026-10-10']);
      assert.strictEqual(aufrufe.length, 0);
      assert.throws(() => d.markierePost(m.id), (e) => e.status === 409);
      await assert.rejects(d.sende(m.id, { an: ['kunde@example.org'] }), (e) => e.status === 409);
      assert.throws(() => d.markierePost(99999), (e) => e.status === 404);
      // nur 'erzeugt': ein Fehlversuch per Mail wird nicht nachtraeglich zur Post
      st.heute = '2026-10-25';
      const f = await d.erzeuge(nr, { stufe: 2 });
      st.antworten.push({ status: 'fehler', fehler: 'x' });
      await d.sende(f.id, { an: ['kunde@example.org'] });
      assert.throws(() => d.markierePost(f.id), (e) => e.status === 409);
      assert.deepStrictEqual(d.liste(nr).map((z) => [z.stufe, z.status]), [[2, 'fehler'], [1, 'gesendet']]);
    });
  }

  async function empfaengerAusVersand() {
    await mitMahnDienst({}, async ({ d, db, nr }) => {
      const v = db.prepare("INSERT INTO versand (zeit, art, bezug, an, betreff, status, test) VALUES (?, ?, ?, ?, 'b', ?, ?)");
      assert.deepStrictEqual(d.vorschau(nr).an, ['fallback@example.org']);
      v.run('2026-09-18T10:00:00.000Z', 'rechnung', nr, 'umleitung@example.org', 'ok', 1);
      v.run('2026-09-18T11:00:00.000Z', 'rechnung', nr, 'falsch@example.org', 'fehler', 0);
      v.run('2026-09-18T12:00:00.000Z', 'angebot', nr, 'angebot@example.org', 'ok', 0);
      v.run('2026-09-18T13:00:00.000Z', 'rechnung', '2026-0002', 'andere@example.org', 'ok', 0);
      assert.deepStrictEqual(d.vorschau(nr).an, ['fallback@example.org'], 'nur Testversand: Rueckfall empfaengerVon');
      v.run('2026-09-18T09:00:00.000Z', 'rechnung', nr, 'kunde@example.org, buchhaltung@example.org', 'ok', 0);
      assert.deepStrictEqual(d.vorschau(nr).an, ['kunde@example.org', 'buchhaltung@example.org']);
      assert.strictEqual(typeof d.vorschau(nr).bereit, 'object');
    });
  }

  async function druckansicht() {
    const rechnung = require('../../rechnung');
    await mitMahnDienst({ mahnCfg: { gebuehrStufe2Eur: 5 } }, async ({ d, db, nr, st }) => {
      rechnung.bucheZahlung(db, { nr, datum: '2026-10-05', betrag_eur: 190 });
      vorstufen(db, nr, 2); st.heute = '2026-11-08';
      const m = await d.erzeuge(nr, { stufe: 3, text: 'Hallo <b>Kunde</b>\nzweite Zeile' });
      const html = d.renderHtml(m, rechnung.lade(db, nr));
      for (const s of ['<h1>2. Mahnung</h1>', rechnung.datum(m.frist + 'T12:00:00'), rechnung.eur(1000), rechnung.eur(5), rechnung.eur(1005), rechnung.eur(1190),
        'Hallo &lt;b&gt;Kunde&lt;/b&gt;', 'DE89370400440532013000', 'Kunde GmbH', 'Büro Test', rechnung.PAPIER_CSS]) assert.ok(html.includes(s), s);
      assert.ok(!html.includes('<b>Kunde'));
    });
    const srv = require('../../server'), lauscht = srv.server.listening;
    try {
      if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
      for (const p of ['/mahnung/abc', '/mahnung/999999999', '/mahnung/1234567890', '/mahnung/1/x', '/mahnung/']) {
        assert.strictEqual((await fetch('http://127.0.0.1:' + srv.server.address().port + p)).status, 404, p);
      }
    } finally { if (!lauscht) await new Promise((ok) => srv.server.close(ok)); }
  }

  function vorlagenSpeichern() {
    configGeschuetzt(() => {
      const { setzeMail } = require('../../server');
      for (const art of ['erinnerung', 'mahnung1', 'mahnung2']) {
        const r = setzeMail({ vorlagen: { [art]: { betreff: 'x {{frist}}', text: '{{offen}}{{gebuehr}} {{faellig}}' } } });
        assert.deepStrictEqual(r.werte.vorlagen[art], { betreff: 'x {{frist}}', text: '{{offen}}{{gebuehr}} {{faellig}}' });
        assert.ok(r.standard[art].betreff, art);
        assert.throws(() => setzeMail({ vorlagen: { [art]: { betreff: 'x', text: '{{zins}}' } } }), (e) => e.status === 400 && /zins/.test(e.message));
      }
      // M3: Platzhalter je Art — Mahn-Platzhalter in Rechnung/Angebot kaemen beim Kunden leer an.
      for (const art of ['rechnung', 'angebot']) {
        for (const p of ['frist', 'offen', 'gebuehr']) {
          assert.throws(() => setzeMail({ vorlagen: { [art]: { betreff: 'x', text: 'bis {{' + p + '}}' } } }),
            (e) => e.status === 400 && e.message.includes('{{' + p + '}}') && !/erlaubt:.*frist/.test(e.message), art + ' ' + p);
        }
      }
      assert.strictEqual(setzeMail({ vorlagen: { rechnung: { betreff: 'R {{nr}}', text: '{{brutto}} bis {{faellig}}' } } }).werte.vorlagen.rechnung.betreff, 'R {{nr}}');
      assert.ok(/erlaubt:.*frist/.test((() => { try { setzeMail({ vorlagen: { erinnerung: { betreff: 'x', text: '{{zins}}' } } }); } catch (e) { return e.message; } })()));
    });
  }

  async function vorlageWirkt() {
    const rechnung = require('../../rechnung');
    await mitMahnDienst({ mailCfg: { vorlagen: { erinnerung: { betreff: 'x {{frist}}', text: '{{offen}}' } } } }, async ({ d, nr }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      assert.deepStrictEqual([m.betreff, m.text], ['x ' + rechnung.datum('2026-10-17T12:00:00'), rechnung.eur(1190)]);
      // Dialog-Texte gehen vor; geprueft wie pruefeSenden.
      const e = await d.erzeuge(nr, { stufe: 1, betreff: 'Eigener Betreff', text: 'Eigener Text' });
      assert.deepStrictEqual([e.betreff, e.text], ['Eigener Betreff', 'Eigener Text']);
      for (const k of [{ betreff: 'a\r\nBcc: x@example.org' }, { betreff: 'x'.repeat(201) }, { text: 'x'.repeat(4001) }, { betreff: 5 }, { text: '' }]) {
        await assert.rejects(d.erzeuge(nr, { stufe: 1, ...k }), (x) => x.status === 400, JSON.stringify(k));
      }
    });
  }

  const HASHES = ['33d1a16cc9e8f22d3989f3a6aa936036783d68c98b9cd7b2862c63273e66981d', 'f5abe538cab4a5de2eb8816fdd81da73d3a6419e6e05a1b898a403928b21f4c9'];
  function rechnungsdruckUnveraendert() {
    const rechnung = require('../../rechnung');
    const crypto = require('node:crypto');
    const inv = { nr: '2026-0007', erstellt_am: '2026-10-20T10:00:00.000Z', leistung_von: '2026-10-01', leistung_bis: '2026-10-31', faellig_am: '2026-11-03',
      aussteller: AUSSTELLER, empfaenger: { name: 'Kunde GmbH', anschrift: ['Hauptstr. 1', '50667 Köln'], kundennummer: 'K-0001' },
      positionen: [{ bezeichnung: 'Pauschal', typ: 'pauschal', betrag_eur: 1000 }, { ticket: 'X-1', stunden: 2, satz: 90, betrag_eur: 180, tage: ['2026-10-02'], vergleich_stunden: 6, tokens_gesamt: 1234 }],
      netto_eur: 1180, ust_prozent: 19, ust_eur: 224.2, brutto_eur: 1404.2, kleinunternehmer: false, status: 'erstellt' };
    const h = (v) => crypto.createHash('sha256').update(rechnung.renderHtml(v)).digest('hex');
    // Hash vor dem Herausloesen von PAPIER_CSS (043b448) festgehalten; AUSSTELLER hier mit email, sonst gleich.
    assert.deepStrictEqual([h(inv), h({ ...inv, kleinunternehmer: true, status: 'storno', storno_von: '2026-0001' })], HASHES);
    assert.ok(rechnung.renderHtml(inv).includes('<style>\n' + rechnung.PAPIER_CSS + '</style>'));
  }

  async function routen() {
    const { Readable } = require('node:stream');
    const anfrage = (d, methode, pfad, koerper) => new Promise((ok) => {
      const req = Readable.from(koerper === undefined ? [] : [JSON.stringify(koerper)]);
      req.method = methode; req.headers = {};
      const u = new URL('http://127.0.0.1' + pfad);
      const sendJson = (res, data, status = 200) => ok({ status, data });
      const leseKoerper = (r, fertig) => { let s = ''; r.on('data', (x) => { s += x; }); r.on('end', () => fertig(null, JSON.parse(s || '{}'))); };
      if (!d.routen(req, {}, u.pathname, u, { sendJson, leseKoerper })) ok(null);
    });
    await mitMahnDienst({}, async ({ d, db, nr, aufrufe }) => {
      const st = await anfrage(d, 'GET', '/api/mahnung/stand?nr=' + nr + ',2026-0099,x');
      assert.strictEqual(st.status, 200);
      assert.deepStrictEqual(Object.keys(st.data.stand), [nr, '2026-0099']);
      assert.deepStrictEqual(st.data.stand[nr].naechste, { stufe: 1, faellig_ab: '2026-10-08' });
      for (const k of [{}, { nr: '../x' }, { nr: 5 }]) assert.strictEqual((await anfrage(d, 'POST', '/api/mahnung/vorschau', k)).status, 400, JSON.stringify(k));
      const v = await anfrage(d, 'POST', '/api/mahnung/vorschau', { nr });
      assert.deepStrictEqual([v.status, v.data.stufe, v.data.offen_eur], [200, 1, 1190]);
      assert.deepStrictEqual(await anfrage(d, 'POST', '/api/mahnung/erzeugen', { nr, stufe: 2 }), { status: 409, data: { error: 'nur Stufe 1 möglich' } });
      assert.deepStrictEqual(await anfrage(d, 'POST', '/api/mahnung/erzeugen', { nr, stufe: 1, betreff: 'B', text: 'T' }),
        { status: 409, data: { error: 'Betrag oder Frist hat sich geändert — neu erzeugen' } });
      const e = await anfrage(d, 'POST', '/api/mahnung/erzeugen', { nr, stufe: 1, betreff: 'B', text: 'T', offen_eur: v.data.offen_eur, frist: v.data.frist });
      assert.deepStrictEqual([e.status, e.data.status, e.data.betreff], [200, 'erzeugt', 'B']);
      const sechs = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => x + '@example.org');
      for (const k of [{ an: [] }, { an: sechs }, { an: 'kunde@example.org' }, { an: ['kündé@example.org'] }, { an: ['a@b.c\r\nx'] }, { id: 'x' }, { id: 0 }, { id: 1.5 }]) {
        const r = await anfrage(d, 'POST', '/api/mahnung/senden', { id: e.data.id, an: ['kunde@example.org'], ...k });
        assert.strictEqual(r.status, 400, JSON.stringify(k) + ' ' + JSON.stringify(r));
      }
      assert.strictEqual(aufrufe.length, 0);
      assert.strictEqual((await anfrage(d, 'POST', '/api/mahnung/senden', { id: 99999, an: ['kunde@example.org'] })).status, 404);
      const s = await anfrage(d, 'POST', '/api/mahnung/senden', { id: e.data.id, an: ['kunde@example.org'] });
      assert.deepStrictEqual([s.status, s.data.mahnung.status, s.data.versand.status], [200, 'gesendet', 'ok']);
      assert.strictEqual((await anfrage(d, 'POST', '/api/mahnung/post', { id: e.data.id })).status, 409);
      const l = await anfrage(d, 'GET', '/api/mahnung/liste?nr=' + nr);
      assert.deepStrictEqual([l.status, l.data.liste.length, l.data.liste[0].id, l.data.liste[0].pdf], [200, 1, e.data.id, true]);
      // F5: kein lokaler Pfad in Antworten (liste ist ohne Geraet lesbar).
      for (const x of [e, s, l]) assert.ok(!/pdf_pfad|[\\/]mahnungen[\\/]/.test(JSON.stringify(x.data)), JSON.stringify(x.data));
      assert.strictEqual((await anfrage(d, 'GET', '/api/mahnung/liste?nr=x')).status, 400);
      assert.strictEqual(await anfrage(d, 'GET', '/api/mail/status'), null);
    });
  }

  // --- Fixwelle nach Gesamtreview (final-fix-funde.md) -----------------------
  const AN = ['kunde@example.org'];
  async function mitProtokoll(fn) {
    const vorher = console.error, protokoll = [];
    console.error = (...a) => protokoll.push(a.map((x) => (x && x.message) || String(x)).join(' '));
    try { return await fn(protokoll); } finally { console.error = vorher; }
  }

  // F1 (R11): nach "Zustellung unklar" ist die Stufe gesperrt — kein neuer Entwurf, kein aelterer Entwurf, keine Post.
  async function unklarSperrt() {
    const { naechsteStufe, mahnStand } = require('../../mahnung');
    const UNKLAR = /^Zustellung unklar — erst unter Gesendet prüfen$/;
    await mitMahnDienst({}, async ({ d, db, nr, st, aufrufe }) => {
      const alt = await d.erzeuge(nr, { stufe: 1 }), u = await d.erzeuge(nr, { stufe: 1 });
      st.antworten.push({ status: 'fehler', fehler: 'Zustellung unklar: Datenende ohne Antwort', unklar: true });
      assert.strictEqual((await d.sende(u.id, { an: AN })).mahnung.status, 'fehler');
      assert.strictEqual(naechsteStufe(db, nr, st.heute, st.mahnCfg), null);
      const s = mahnStand(db, [nr], st.heute, st.mahnCfg)[nr];
      assert.deepStrictEqual([s.grund, s.naechste, s.unklar_stufe], ['unklar', null, 1]);
      await assert.rejects(d.erzeuge(nr, { stufe: 1 }), mit409(UNKLAR));
      assert.throws(() => d.vorschau(nr), mit409(UNKLAR));
      await assert.rejects(d.sende(alt.id, { an: AN }), mit409(UNKLAR));
      assert.throws(() => d.markierePost(alt.id), mit409(UNKLAR));
      await assert.rejects(d.sende(u.id, { an: AN }), mit409(UNKLAR));
      assert.strictEqual(aufrufe.length, 1);
      assert.deepStrictEqual(d.liste(nr).map((z) => [z.id, z.unklar]), [[u.id, true], [alt.id, false]]);
    });
    // Ein klarer Fehler sperrt nicht.
    await mitMahnDienst({}, async ({ d, db, nr, st }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      st.antworten.push({ status: 'fehler', fehler: 'SMTP: 550 abgelehnt' });
      await d.sende(m.id, { an: AN });
      assert.strictEqual(naechsteStufe(db, nr, st.heute, st.mahnCfg).stufe, 1);
      assert.strictEqual(d.liste(nr)[0].unklar, false);
    });
  }

  // F2: Betrag und Frist der Vorschau muessen beim Erzeugen noch stimmen, sonst nennt der Text andere Zahlen als die Aufstellung.
  async function vorschauVeraltet() {
    const rechnung = require('../../rechnung');
    const MSG = /^Betrag oder Frist hat sich geändert — neu erzeugen$/;
    await mitMahnDienst({}, async ({ d, db, nr, st, erzeugeRoh }) => {
      const v = d.vorschau(nr);
      for (const k of [{}, { offen_eur: v.offen_eur }, { frist: v.frist }, { offen_eur: String(v.offen_eur), frist: v.frist }, { offen_eur: NaN, frist: v.frist }]) {
        await assert.rejects(erzeugeRoh(nr, { stufe: 1, ...k }), mit409(MSG), JSON.stringify(k));
      }
      // Zahlung zwischen Vorschau und Klick
      rechnung.bucheZahlung(db, { nr, datum: '2026-10-10', betrag_eur: 100 });
      await assert.rejects(erzeugeRoh(nr, { stufe: 1, offen_eur: v.offen_eur, frist: v.frist }), mit409(MSG));
      // Mitternacht dazwischen
      const v2 = d.vorschau(nr);
      st.heute = '2026-10-11';
      await assert.rejects(erzeugeRoh(nr, { stufe: 1, offen_eur: v2.offen_eur, frist: v2.frist }), mit409(MSG));
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 0);
      // Ein Cent Toleranz wie vorpruefe; gespeichert wird der frisch gerechnete Betrag.
      const v3 = d.vorschau(nr);
      const m = await erzeugeRoh(nr, { stufe: 1, offen_eur: v3.offen_eur + 0.01, frist: v3.frist });
      assert.deepStrictEqual([m.offen_eur, m.frist], [1090, '2026-10-18']);
      await assert.rejects(erzeugeRoh(nr, { stufe: 1, offen_eur: v3.offen_eur + 0.02, frist: v3.frist }), mit409(MSG));
    });
  }

  // F3: ein wiederaufgenommener Entwurf von gestern geht nicht per Mail raus (alte Frist im Text); Post bleibt wie bisher.
  async function entwurfVonGestern() {
    await mitMahnDienst({}, async ({ d, nr, st, aufrufe, zeile }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      st.heute = '2026-10-11';
      await assert.rejects(d.sende(m.id, { an: AN }), mit409(/^Schreiben ist nicht von heute — neu erzeugen$/));
      assert.strictEqual(aufrufe.length, 0);
      assert.strictEqual(zeile(m.id).status, 'erzeugt');
      assert.strictEqual(d.markierePost(m.id).status, 'gesendet');
    });
    // Auch eine Fehlzeile von gestern wird nicht erneut gesendet.
    await mitMahnDienst({}, async ({ d, nr, st, aufrufe }) => {
      const m = await d.erzeuge(nr, { stufe: 1 });
      st.antworten.push({ status: 'fehler', fehler: 'SMTP: 421' });
      await d.sende(m.id, { an: AN });
      st.heute = '2026-10-12';
      await assert.rejects(d.sende(m.id, { an: AN }), mit409(/nicht von heute/));
      assert.strictEqual(aufrufe.length, 1);
    });
  }

  // F4: Erinnerung/Mahnung zur Rechnung setzt keine Versandmarke an der Rechnung — weder mit Zeile noch ohne (INSERT gescheitert).
  async function versandmarkeNurBelege() {
    const mail = require('../../mail');
    const db = neueDb();
    const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-mahn-versand-'));
    const cfg = { smtp: { host: 'smtp.example.org', port: 465, sicher: 'tls', benutzer: 'a@example.org', passwortEnvVar: 'C2I_SMTP_PASSWORT' },
      absender: { name: 'Büro', adresse: 'a@example.org' }, transport: 'smtp', umleitenAn: '', tagesgrenze: 100 };
    const d = mail.erzeuge({ db, mailCfg: () => cfg, env: { C2I_SMTP_PASSWORT: 'x-geheim' }, versandOrdner: ordner, transporte: { smtp: async () => ({ antwort: '250 ok' }) } });
    const n = { an: AN, betreff: 'Zahlungserinnerung', text: 't' };
    try {
      assert.strictEqual((await d.sende(n, { art: 'erinnerung', bezug: '2026-0001', schluessel: 'mahnung-1' })).status, 'ok');
      assert.deepStrictEqual(d.letzte(['2026-0001']), {});
      await mitProtokoll(async () => {
        db.exec("CREATE TRIGGER kaputt BEFORE INSERT ON versand BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
        const r = await d.sende(n, { art: 'mahnung1', bezug: '2026-0001', schluessel: 'mahnung-2' });
        assert.deepStrictEqual([r.status, r.id], ['ok', null]);
        db.exec('DROP TRIGGER kaputt');
      });
      assert.deepStrictEqual(d.letzte(['2026-0001']), {});
      // Die Rechnung selbst setzt die Marke weiter.
      await d.sende(n, { art: 'rechnung', bezug: '2026-0001' });
      assert.deepStrictEqual(Object.keys(d.letzte(['2026-0001'])), ['2026-0001']);
    } finally { fs.rmSync(ordner, { recursive: true, force: true }); }
  }

  // F6: Mail ist raus, das Status-UPDATE scheitert (nicht UNIQUE): 200 mit Warnung, Stufe im Speicher gesperrt.
  async function statusNichtGespeichert() {
    const WARN = 'Mail ging raus, Status nicht gespeichert — nicht erneut senden, nicht als Post markieren';
    await mitProtokoll(async (protokoll) => mitMahnDienst({}, async ({ d, db, nr, st, aufrufe, zeile }) => {
      const a = await d.erzeuge(nr, { stufe: 1 }), b = await d.erzeuge(nr, { stufe: 1 });
      st.waehrend = () => db.exec("CREATE TRIGGER kaputt BEFORE UPDATE ON mahnung BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
      const r = await d.sende(a.id, { an: AN });
      assert.deepStrictEqual([r.warnung, r.versand.status, r.mahnung.id], [WARN, 'ok', a.id]);
      assert.ok(protokoll.some((z) => z.includes('Mahnung ' + a.id) && z.includes('Versand 101') && z.includes('Stufe 1')), protokoll.join('\n'));
      db.exec('DROP TRIGGER kaputt');
      assert.strictEqual(zeile(a.id).status, 'erzeugt');
      for (const id of [a.id, b.id]) {
        await assert.rejects(d.sende(id, { an: AN }), mit409(/nicht erneut senden/), String(id));
        assert.throws(() => d.markierePost(id), mit409(/nicht erneut senden/), String(id));
      }
      assert.strictEqual(aufrufe.length, 1);
    }));
  }

  // F9: auch der Betreff aus der Vorlage (Datei-Weg) wird vor dem INSERT geprueft.
  async function vorlagenBetreffGeprueft() {
    await mitMahnDienst({ mailCfg: { vorlagen: { erinnerung: { betreff: 'Erinnerung\r\nBcc: x@example.org', text: '{{offen}}' } } } }, async ({ d, db, nr }) => {
      await assert.rejects(d.erzeuge(nr, { stufe: 1 }), (e) => e.status === 400 && /Betreff/.test(e.message));
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 0);
      // Die Vorschau scheitert ebenso (der Dialog nennt den Grund); ein eigener Betreff aus dem Dialog geht vor.
      assert.throws(() => d.vorschau(nr), (e) => e.status === 400 && /Betreff/.test(e.message));
      const m = await d.erzeuge(nr, { stufe: 1, betreff: 'Eigener Betreff', offen_eur: 1190, frist: '2026-10-17' });
      assert.strictEqual(m.betreff, 'Eigener Betreff');
    });
  }

  return [
    ['C11b: Unklar sperrt die Stufe', unklarSperrt],
    ['C11b: Vorschau veraltet', vorschauVeraltet],
    ['C11b: Entwurf von gestern', entwurfVonGestern],
    ['C11b: Versandmarke nur für Belege', versandmarkeNurBelege],
    ['C11b: Status nicht gespeichert', statusNichtGespeichert],
    ['C11b: Vorlagen-Betreff geprüft', vorlagenBetreffGeprueft],
    ['C11b: heute streng, ausgeschoepft vor Pause', heuteStreng],
    ['C11b: Offener Betrag', offenerBetrag],
    ['C11b: Kein Überspringen', keinUeberspringen],
    ['C11b: Gebühr nur Stufe 3', gebuehrNurStufe3],
    ['C11b: Summe vom Server', gesamtVomServer],
    ['C11b: frueh vom Server', fruehVomServer],
    ['C11b: Stufe steigt erst nach Versand', stufeNachVersand],
    ['C11b: Testmodus zählt nicht', testmodusZaehltNicht],
    ['C11b: Doppelt', doppelt],
    ['C11b: Bezahlt/Betrag/Frist/Storniert vor Senden', vorSendenGeaendert],
    ['C11b: Post', post],
    ['C11b: Empfänger aus letztem Versand', empfaengerAusVersand],
    ['C11b: Druckansicht', druckansicht],
    ['C11b: Vorlagen speichern', vorlagenSpeichern],
    ['C11b: Vorlage und Dialogtext', vorlageWirkt],
    ['C11b: Rechnungsdruck unverändert', rechnungsdruckUnveraendert],
    ['C11b: Routen', routen],
    ['C11b: Tabelle mahnung', tabelleMahnung],
    ['C11b: Mahnpause Feld', mahnpauseFeld],
    ['C11b: Mahnwesen Grenzen', mahnwesenGrenzen],
    ['C11b: Stufe 1 ab Faelligkeit + 7', stufe1AbFaelligkeit],
    ['C11b: Fristen aus Einstellungen', fristenAusEinstellungen],
    ['C11b: Folgestufe ab Versandtag', folgestufeAbVersandtag],
    ['C11b: Ausgeschoepft', ausgeschoepft],
    ['C11b: Offen und bezahlt', offenUndBezahlt],
    ['C11b: Mahnpause', mahnpauseWirkt],
    ['C11b: Zeitumstellung', zeitumstellung],
  ];
};
