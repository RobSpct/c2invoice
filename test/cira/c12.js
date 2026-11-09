'use strict';
// C12 Leads als eigene Datensaetze, feste Kundennummer.
const assert = require('node:assert');

module.exports = ({ dbmod, openDbs, rechnungsUmgebung, rechnungsDb }) => {
  const neueDb = () => {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    db.exec('CREATE TABLE t (x)');
    return db;
  };
  const zeilen = (db) => db.prepare('SELECT x FROM t ORDER BY x').all().map((r) => r.x);
  const { inTransaktion } = require('../../kontakte');
  const ein = (db, x) => db.prepare('INSERT INTO t (x) VALUES (?)').run(x);

  function inTransaktionVerschachtelt() {
    const db = neueDb();
    const r = inTransaktion(db, () => {
      ein(db, 'aussen');
      assert.throws(() => inTransaktion(db, () => { ein(db, 'innen'); throw new Error('innen kaputt'); }), /innen kaputt/);
      return 'ok';
    });
    assert.strictEqual(r, 'ok');
    assert.deepStrictEqual(zeilen(db), ['aussen']);
    // innerer Erfolg bleibt, wenn aussen scheitert? Nein: aussen rollt alles zurueck.
    assert.throws(() => inTransaktion(db, () => {
      ein(db, 'a2');
      inTransaktion(db, () => ein(db, 'i2'));
      throw new Error('aussen kaputt');
    }), /aussen kaputt/);
    assert.deepStrictEqual(zeilen(db), ['aussen']);
    assert.strictEqual(db.isTransaction, false, 'Transaktion blieb offen');
  }

  function inTransaktionInOffenemBegin() {
    const db = neueDb();
    db.exec('BEGIN');
    try {
      inTransaktion(db, () => ein(db, 'a'));
      assert.throws(() => inTransaktion(db, () => { ein(db, 'b'); throw new Error('x'); }), /x/);
      assert.strictEqual(db.isTransaction, true, 'fremdes BEGIN wurde beendet');
    } finally { db.exec('COMMIT'); }
    assert.deepStrictEqual(zeilen(db), ['a']);
  }

  // R15: scheitert ROLLBACK TO aussen aus anderem Grund, bleibt keine Transaktion offen.
  function inTransaktionRollbackToScheitert() {
    const db = neueDb();
    const exec = db.exec.bind(db);
    let einmal = true;
    db.exec = (sql) => {
      if (einmal && sql === 'ROLLBACK TO tx') { einmal = false; throw new Error('disk I/O error'); }
      return exec(sql);
    };
    assert.throws(() => inTransaktion(db, () => { ein(db, 'x'); throw new Error('echt kaputt'); }), /echt kaputt/);
    assert.strictEqual(db.isTransaction, false, 'Transaktion blieb nach gescheitertem ROLLBACK TO offen');
    assert.deepStrictEqual(zeilen(db), []);
  }

  // Alt-DB nachstellen: Migration hat auf der leeren DB schon gelaufen, also
  // Meta, Zaehler und Index weg, dann Zeilen wie vor C12, dann migrate erneut.
  const altDb = () => {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    db.exec("DELETE FROM meta WHERE key IN ('c12_leads_umzug','kundennummer_zaehler'); DROP INDEX IF EXISTS kontakte_kundennummer");
    return db;
  };
  const kontakt = (db, { status = 'kunde', firma = 'F', email = '', erstellt = '2026-01-01T00:00:00Z', nummer = null, notiz = '' } = {}) =>
    Number(db.prepare(`INSERT INTO kontakte (status, firma, vorname, nachname, anschrift, email, notiz, erstellt_am, kundennummer)
      VALUES (?, ?, 'Vor', 'Nach', '["Weg 1"]', ?, ?, ?, ?)`).run(status, firma, email, notiz, erstellt, nummer).lastInsertRowid);
  const angebot = (db, nr, kontaktId) => db.prepare(`INSERT INTO angebote (nr, jahr, laufnr, erstellt_am, gueltig_bis, empfaenger, aussteller,
      positionen, netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, kontakt_id)
      VALUES (?, 2026, ?, '2026-01-01', '2026-02-01', '{}', '{}', '[]', 1, 0, 0, 1, 1, ?)`).run(nr, Number(nr.slice(-3)), kontaktId);
  const rechnungAn = (db, nr, kontaktId, empf, erstellt = '2026-01-01T00:00:00Z') => db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am,
      leistung_von, leistung_bis, empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, kontakt_id)
      VALUES (?, 2026, ?, ?, '2026-01-01', '2026-01-31', ?, '{}', '[]', 1, 0, 0, 1, 1, ?)`).run(nr, Number(nr.slice(-3)), erstellt, JSON.stringify(empf), kontaktId);
  const nummern = (db) => Object.fromEntries(db.prepare('SELECT firma, kundennummer FROM kontakte').all().map((r) => [r.firma, r.kundennummer]));

  function freierLeadZiehtUm() {
    const db = altDb();
    const id = kontakt(db, { status: 'lead', firma: 'Lead GmbH', notiz: 'kalt', erstellt: '2026-03-01T00:00:00Z' });
    db.prepare("INSERT INTO ansprechpartner (kontakt_id, name, email, telefon, erstellt_am) VALUES (?, 'P', 'p@lead.example', '0221 1', 'x')").run(id);
    angebot(db, 'A-2026-001', id);
    dbmod.migrate(db);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM kontakte').get().n, 0, 'Lead blieb in kontakte');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM ansprechpartner').get().n, 0, 'Ansprechpartner des Leads blieb');
    const l = db.prepare('SELECT * FROM leads').get();
    assert.ok(l, 'kein Lead angelegt');
    assert.deepStrictEqual([l.firma, l.vorname, l.nachname, l.anschrift, l.notiz.split('\n')[0], l.email, l.telefon, l.quelle, l.status, l.erstellt_am],
      ['Lead GmbH', 'Vor', 'Nach', '["Weg 1"]', 'kalt', 'p@lead.example', '0221 1', 'sonstiges', 'offen', '2026-03-01T00:00:00Z']);
    const a = db.prepare("SELECT lead_id, kontakt_id FROM angebote WHERE nr = 'A-2026-001'").get();
    assert.deepStrictEqual([a.lead_id, a.kontakt_id], [l.id, null], 'Angebot nicht auf den Lead umgehaengt');
  }

  // R4: was leads nicht als Spalte hat, steht danach in der Notiz.
  function leadUmzugVerliertNichts() {
    const db = altDb();
    const id = kontakt(db, { status: 'lead', firma: 'Voll', notiz: 'kalt' });
    db.prepare(`UPDATE kontakte SET steuernummer = '12/345/67890', ust_id_nr = 'DE123456789', kaeufer_referenz = '991-1-2',
      land = 'AT', lieferantennummer = 'L-77', geaendert_am = '2026-04-01T00:00:00Z' WHERE id = ?`).run(id);
    db.prepare(`INSERT INTO ansprechpartner (kontakt_id, name, email, telefon, rolle, erstellt_am) VALUES
      (?, 'Anna Eins', 'anna@voll.example', '0221 1', 'Einkauf', 'x'), (?, 'Bert Zwei', '', '0221 2', '', 'x')`).run(id, id);
    dbmod.migrate(db);
    const l = db.prepare('SELECT notiz, geaendert_am FROM leads').get();
    assert.ok(l.notiz.startsWith('kalt\n'), 'alte Notiz nicht zuerst: ' + l.notiz);
    for (const t of ['Aus Kontakt übernommen:', 'Steuernummer: 12/345/67890', 'USt-IdNr.: DE123456789', 'Käuferreferenz: 991-1-2',
      'Land: AT', 'Lieferantennummer: L-77', 'Ansprechpartner: Anna Eins (Einkauf), anna@voll.example, 0221 1',
      'Ansprechpartner: Bert Zwei, 0221 2']) {
      assert.ok(l.notiz.split('\n').includes(t), 'fehlt in der Notiz: ' + t + '\n' + l.notiz);
    }
    assert.strictEqual(l.geaendert_am, '2026-04-01T00:00:00Z', 'geaendert_am = Migrationszeit');
  }

  // Scheitert der Umzug mittendrin, bleibt alles wie vorher, und der naechste Start holt ihn nach.
  function umzugRolltZurueck() {
    const db = altDb();
    kontakt(db, { status: 'lead', firma: 'L1' });
    kontakt(db, { status: 'lead', firma: 'L2' });
    db.exec("CREATE TRIGGER kaputt AFTER INSERT ON leads WHEN NEW.firma = 'L2' BEGIN SELECT RAISE(ABORT, 'kaputt'); END");
    assert.throws(() => dbmod.migrate(db), /kaputt/);
    assert.strictEqual(db.isTransaction, false, 'Transaktion blieb offen');
    assert.strictEqual(dbmod.getMeta(db, 'c12_leads_umzug'), null, 'Waechter trotz Fehler gesetzt');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM leads').get().n, 0, 'halber Umzug blieb stehen');
    assert.deepStrictEqual(db.prepare('SELECT status FROM kontakte').all().map((r) => r.status), ['lead', 'lead']);
    db.exec('DROP TRIGGER kaputt');
    dbmod.migrate(db);
    assert.ok(dbmod.getMeta(db, 'c12_leads_umzug'));
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM leads').get().n, 2);
  }

  function leadMitBindungBleibtKunde() {
    const db = altDb();
    const mitRechnung = kontakt(db, { status: 'lead', firma: 'Rechnung' });
    rechnungAn(db, 'R-2026-001', mitRechnung, { name: 'Rechnung' });
    const mitProjekt = kontakt(db, { status: 'lead', firma: 'Projekt' });
    db.prepare("INSERT INTO projekt_kontakt (projekt, kontakt_id) VALUES ('p1', ?)").run(mitProjekt);
    const mitZeit = kontakt(db, { status: 'lead', firma: 'Zeit' });
    db.prepare(`INSERT INTO zeit_eintrag (ziel_art, ziel_schluessel, start, ende, tag, taetigkeit, rohzeit_min, gezaehlt_min, created_at)
      VALUES ('kunde', ?, 'a', 'b', '2026-01-01', 'Meeting', 1, 1, 'x')`).run(String(mitZeit));
    const mitTermin = kontakt(db, { status: 'lead', firma: 'Termin' });
    db.prepare(`INSERT INTO termin (kalender_id, uid, titel, start, ende, art, quelle, ziel_art, ziel_schluessel, aktualisiert_am)
      VALUES ('lokal', 'u1', 't', 'a', 'b', 'meeting', 'lokal', 'kunde', ?, 'x')`).run(String(mitTermin));
    dbmod.migrate(db);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM leads').get().n, 0, 'gebundener Lead zog um');
    const st = db.prepare('SELECT firma, status FROM kontakte ORDER BY id').all().map((r) => r.firma + ':' + r.status);
    assert.deepStrictEqual(st, ['Rechnung:kunde', 'Projekt:kunde', 'Zeit:kunde', 'Termin:kunde']);
  }

  function nummernNachErstelltAm() {
    const db = altDb();
    kontakt(db, { firma: 'Spaet', erstellt: '2026-05-01T00:00:00Z' });
    kontakt(db, { firma: 'Frueh', erstellt: '2026-01-01T00:00:00Z' });
    dbmod.migrate(db);
    assert.deepStrictEqual(nummern(db), { Frueh: 'K-0001', Spaet: 'K-0002' });
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '2');
  }

  function nummerAusAbschriftBleibt() {
    const db = altDb();
    const eigen = kontakt(db, { firma: 'Eigen', nummer: '10023', erstellt: '2026-01-01T00:00:00Z' });
    const beleg = kontakt(db, { firma: 'Beleg', erstellt: '2026-02-01T00:00:00Z' });
    rechnungAn(db, 'R-2026-001', beleg, { name: 'Beleg', kundennummer: 'K-0001' }, '2026-02-02T00:00:00Z');
    rechnungAn(db, 'R-2026-002', beleg, { name: 'Beleg', kundennummer: 'K-0007' }, '2026-03-02T00:00:00Z');
    rechnungAn(db, 'R-2026-003', beleg, { name: 'Beleg' }, '2026-04-02T00:00:00Z'); // neueste ohne Nummer
    kontakt(db, { firma: 'Neu', erstellt: '2026-01-15T00:00:00Z' });
    dbmod.migrate(db);
    assert.ok(eigen);
    // Neu liegt zeitlich vor Beleg, bekommt aber trotzdem eine Nummer oberhalb der behaltenen.
    assert.deepStrictEqual(nummern(db), { Eigen: '10023', Beleg: 'K-0007', Neu: 'K-0008' });
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '8');
  }

  function dublettenBrickenStartNicht() {
    const db = altDb();
    kontakt(db, { firma: 'Erst', nummer: 'K-0003', erstellt: '2026-01-01T00:00:00Z' });
    kontakt(db, { firma: 'Zweit', nummer: 'k-0003', erstellt: '2026-02-01T00:00:00Z' });
    kontakt(db, { firma: 'Leer', nummer: '  ', erstellt: '2026-03-01T00:00:00Z' });
    const warn = console.warn; const meldungen = [];
    console.warn = (...a) => meldungen.push(a.join(' '));
    try { dbmod.migrate(db); } finally { console.warn = warn; }
    assert.deepStrictEqual(nummern(db), { Erst: 'K-0003', Zweit: 'K-0004', Leer: 'K-0005' });
    assert.ok(meldungen.some((m) => /k-0003/.test(m)), 'Dublette nicht gemeldet');
    assert.throws(() => db.prepare("UPDATE kontakte SET kundennummer = 'k-0004' WHERE firma = 'Erst'").run(), /UNIQUE/,
      'Unique-Index fehlt');
    // Leere Nummer bleibt erlaubt, auch mehrfach (Teil-Index).
    db.prepare("INSERT INTO kontakte (status, firma, erstellt_am, kundennummer) VALUES ('kunde', 'X', 'x', ''), ('kunde', 'Y', 'x', '')").run();
  }

  function zweiterLaufAendertNichts() {
    const db = altDb();
    kontakt(db, { firma: 'Eins', erstellt: '2026-01-01T00:00:00Z' });
    kontakt(db, { firma: 'Zwei', erstellt: '2026-02-01T00:00:00Z' });
    dbmod.migrate(db);
    // Danach: hoechste Nummer wird geloescht, ein neuer Kontakt ohne Nummer kommt hinzu.
    db.prepare("DELETE FROM kontakte WHERE firma = 'Zwei'").run();
    kontakt(db, { status: 'lead', firma: 'Spaeter' });
    dbmod.migrate(db);
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '2', 'Zaehler zurueckgesetzt (K-0002 kaeme wieder)');
    assert.deepStrictEqual(nummern(db), { Eins: 'K-0001', Spaeter: null });
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM leads').get().n, 0);
  }

  function frischeDb() {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    assert.ok(dbmod.getMeta(db, 'c12_leads_umzug'), 'Wächter fehlt auf frischer DB');
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '0');
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'kontakte_kundennummer'").get(), 'Index fehlt');
    assert.ok(db.prepare('PRAGMA table_info(angebote)').all().some((s) => s.name === 'lead_id'), 'angebote.lead_id fehlt');
  }

  // --- Kundennummer: fest vergeben, Zaehler in meta, nicht eingebbar ---------
  const kontakte = require('../../kontakte');
  const gespeichert = (db, id) => db.prepare('SELECT kundennummer FROM kontakte WHERE id = ?').get(id).kundennummer;

  // Rot gegen 'K-'+pad4(id): die IDs liegen hier bewusst weit vor dem Zaehler.
  function nummerAusZaehler() {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    db.prepare(`INSERT INTO kontakte (id, status, firma, erstellt_am, kundennummer) VALUES
      (7, 'kunde', 'A', 'x', 'K-0001'), (8, 'kunde', 'B', 'x', 'K-0002')`).run();
    dbmod.setMeta(db, 'kundennummer_zaehler', 2);
    const k = kontakte.speichere(db, { firma: 'Neu GmbH' });
    assert.strictEqual(k.kundennummer, 'K-0003');
    assert.strictEqual(gespeichert(db, k.id), 'K-0003', 'Nummer nicht gespeichert');
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '3');
  }

  // Rot gegen MAX(kundennummer)+1: K-0002 kaeme nach dem Loeschen wieder.
  function geloeschteNummerNieWieder() {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    const a = kontakte.speichere(db, { firma: 'Eins' });
    const b = kontakte.speichere(db, { firma: 'Zwei' });
    assert.deepStrictEqual([a.kundennummer, b.kundennummer], ['K-0001', 'K-0002']);
    kontakte.loesche(db, b.id);
    assert.strictEqual(kontakte.speichere(db, { firma: 'Drei' }).kundennummer, 'K-0003', 'geloeschte Nummer neu vergeben');
  }

  // Rot, wenn kundennummer in FELDER bleibt: dann landet 'X' in der Datenbank.
  function mitgeschickteNummerWirkungslos() {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    const k = kontakte.speichere(db, { firma: 'Eins', kundennummer: 'X' });
    assert.strictEqual(gespeichert(db, k.id), 'K-0001', 'mitgeschickte Nummer beim Anlegen uebernommen');
    const n = kontakte.speichere(db, { id: k.id, firma: 'Eins neu', kundennummer: 'X' });
    assert.strictEqual(n.firma, 'Eins neu');
    assert.strictEqual(gespeichert(db, k.id), 'K-0001', 'mitgeschickte Nummer beim Aendern uebernommen');
    assert.ok(!('kundennummer' in kontakte.FELDER), 'kundennummer noch in FELDER');
  }

  // § 14 UStG: die Abschrift traegt die gespeicherte Nummer und bleibt danach stehen.
  function abschriftTraegtGespeicherteNummer() {
    rechnungsUmgebung(() => {
      const rechnung = require('../../rechnung');
      const db = rechnungsDb();
      dbmod.setMeta(db, 'kundennummer_zaehler', 41); // Nummer weicht von der ID ab
      const k = kontakte.speichere(db, { firma: 'Kunde GmbH', anschrift: ['Weg 1', '10115 Berlin'] });
      assert.strictEqual(k.kundennummer, 'K-0042');
      const inv = rechnung.erstelle(db, { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'],
        empfaenger: { name: 'Kunde GmbH', anschrift: ['Weg 1', '10115 Berlin'] }, kontaktId: k.id });
      assert.strictEqual(inv.empfaenger.kundennummer, 'K-0042', 'Abschrift traegt nicht die gespeicherte Nummer');
      kontakte.speichere(db, { id: k.id, firma: 'Umbenannt AG', kundennummer: 'K-9999' });
      db.prepare("UPDATE kontakte SET kundennummer = 'K-0777' WHERE id = ?").run(k.id);
      const spaeter = rechnung.lade(db, inv.nr);
      assert.strictEqual(spaeter.empfaenger.kundennummer, 'K-0042', 'gestellte Rechnung folgt dem Kontakt');
      assert.strictEqual(spaeter.empfaenger.name, 'Kunde GmbH');
    });
  }

  // R6/R7: die Abschrift nimmt die Nummer nur aus dem verknuepften Kontakt; eine
  // mitgeschickte wird ignoriert, ohne Kontakt traegt die Rechnung keine.
  function rechnungNimmtNummerNurAusKontakt() {
    rechnungsUmgebung(() => {
      const rechnung = require('../../rechnung');
      const db = rechnungsDb();
      const k = kontakte.speichere(db, { firma: 'Kunde GmbH', anschrift: ['Weg 1'] });
      const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'],
        empfaenger: { name: 'Kunde GmbH', anschrift: ['Weg 1'], kundennummer: 'X' } };
      const mit = rechnung.erstelle(db, { ...daten, kontaktId: k.id });
      assert.strictEqual(mit.empfaenger.kundennummer, 'K-0001', 'mitgeschickte Nummer schlaegt den Kontakt');
      const ohne = rechnung.erstelle(db, daten);
      assert.ok(!('kundennummer' in ohne.empfaenger), 'Rechnung ohne Kontakt traegt eine Kundennummer: ' + ohne.empfaenger.kundennummer);
    });
  }

  // Scheitert das Anlegen, bleibt der Zaehler stehen (rot, wenn die Nummer vor der Transaktion vergeben wird).
  function abgebrochenesAnlegenLaesstZaehler() {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    assert.throws(() => kontakte.speichere(db, { firma: 'Eins', projekte: ['gibt-es-nicht'] }), /Unbekanntes Projekt/);
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '0', 'Zaehler trotz Abbruch erhoeht');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM kontakte').get().n, 0);
  }

  // Zaehler unter dem Bestand: der Unique-Index haelt, der Zaehler bleibt.
  function zaehlerUnterBestandWirft() {
    const db = dbmod.open(':memory:'); openDbs.push(db);
    db.prepare("INSERT INTO kontakte (status, firma, erstellt_am, kundennummer) VALUES ('kunde', 'A', 'x', 'K-0005')").run();
    dbmod.setMeta(db, 'kundennummer_zaehler', 4);
    assert.throws(() => kontakte.speichere(db, { firma: 'Neu' }), /UNIQUE/);
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '4', 'Zaehler trotz Fehler erhoeht');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM kontakte').get().n, 1);
  }

  // --- Leads (Task 4) ---------------------------------------------------------
  const leads = require('../../leads');
  const leadDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  const anzahl = (db, t) => db.prepare('SELECT COUNT(*) n FROM ' + t).get().n;
  const angebotAnLead = (db, nr, leadId) => {
    angebot(db, nr, null);
    db.prepare('UPDATE angebote SET lead_id = ?, gueltig_bis = ? WHERE nr = ?').run(leadId, '2999-01-01', nr);
  };

  // Rot ohne die Listenpruefung: 'tiktok' bzw. 'egal' landeten in der DB.
  function quelleUndGrundNurAusListe() {
    const db = leadDb();
    assert.throws(() => leads.anlegen(db, { firma: 'A', quelle: 'tiktok' }), /Leadquelle/);
    assert.strictEqual(anzahl(db, 'leads'), 0, 'Lead mit fremder Quelle angelegt');
    const { lead } = leads.anlegen(db, { firma: 'A', quelle: 'event' });
    assert.throws(() => leads.aendern(db, { id: lead.id, quelle: 'tiktok' }), /Leadquelle/);
    assert.throws(() => leads.verloren(db, { id: lead.id, grund: 'egal' }), /Grund/);
    const l = leads.lade(db, lead.id);
    assert.strictEqual(l.quelle, 'event');
    assert.strictEqual(l.status, 'offen');
    assert.strictEqual(l.verloren_grund, null);
    // Gueltiger Grund und Undo (grund null).
    assert.strictEqual(leads.verloren(db, { id: lead.id, grund: 'preis' }).status, 'verloren');
    const zurueck = leads.verloren(db, { id: lead.id, grund: null });
    assert.strictEqual(zurueck.status, 'offen');
    assert.strictEqual(zurueck.verloren_am, null);
    assert.strictEqual(lead.lead_nr, 'L-' + String(lead.id).padStart(4, '0'));
  }

  // Rot ohne Angebots-Umzug bzw. ohne Kunden-Anlage.
  function umwandelnNeuLegtKundeAn() {
    const db = leadDb();
    const { lead } = leads.anlegen(db, { firma: 'Acme', vorname: 'Ada', nachname: 'Lovelace', email: 'ada@acme.de', telefon: '0221 1', quelle: 'event' });
    angebotAnLead(db, 'A-2026-001', lead.id);
    leads.verloren(db, { id: lead.id, grund: 'zeitpunkt' });
    const u = leads.umwandeln(db, { id: lead.id, art: 'neu' });
    assert.match(u.kundennummer, /^K-\d{4}$/, 'keine Kundennummer');
    const k = kontakte.lade(db, u.kontakt_id);
    assert.strictEqual(k.firma, 'Acme');
    assert.strictEqual(k.kundennummer, u.kundennummer);
    assert.strictEqual(db.prepare('SELECT status FROM kontakte WHERE id = ?').get(k.id).status, 'kunde');
    assert.strictEqual(db.prepare("SELECT kontakt_id FROM angebote WHERE nr = 'A-2026-001'").get().kontakt_id, k.id, 'Angebot nicht umgehaengt');
    const ap = kontakte.ansprechpartnerVon(db, k.id);
    assert.deepStrictEqual(ap.map((a) => [a.name, a.email, a.telefon]), [['Ada Lovelace', 'ada@acme.de', '0221 1']]);
    const l = leads.lade(db, lead.id);
    assert.strictEqual(l.status, 'umgewandelt');
    assert.strictEqual(l.umwandlung_art, 'neu');
    assert.strictEqual(l.kunde_id, k.id);
    assert.ok(l.umgewandelt_am, 'umgewandelt_am fehlt');
    assert.strictEqual(l.verloren_grund, null, 'Verloren-Grund bleibt nach Umwandlung');
    assert.throws(() => leads.aendern(db, { id: lead.id, firma: 'X' }), (e) => e.status === 409);
  }

  // Rot ohne die Pflichtpruefung: Lead stuende als umgewandelt ohne Kunde da.
  function zusammenfuehrenBrauchtKunde() {
    const db = leadDb();
    const { lead } = leads.anlegen(db, { firma: 'B' });
    assert.throws(() => leads.umwandeln(db, { id: lead.id, art: 'zusammengefuehrt' }), /Kunde fehlt/);
    assert.strictEqual(leads.lade(db, lead.id).status, 'offen');
    // Mit Kunde (aus dem Bezug des Leads) klappt es, ohne neuen Kunden.
    const k = kontakte.speichere(db, { firma: 'Bestand' });
    leads.aendern(db, { id: lead.id, kunde_id: k.id });
    angebotAnLead(db, 'A-2026-002', lead.id);
    const u = leads.umwandeln(db, { id: lead.id, art: 'zusammengefuehrt' });
    assert.strictEqual(u.kontakt_id, k.id);
    assert.strictEqual(anzahl(db, 'kontakte'), 1);
    assert.strictEqual(db.prepare("SELECT kontakt_id FROM angebote WHERE nr = 'A-2026-002'").get().kontakt_id, k.id);
  }

  // Rot ohne Statuspruefung: zweiter Kunde, zweite Nummer.
  function doppelteUmwandlungWirft() {
    const db = leadDb();
    const { lead } = leads.anlegen(db, { firma: 'C' });
    leads.umwandeln(db, { id: lead.id, art: 'neu' });
    assert.throws(() => leads.umwandeln(db, { id: lead.id, art: 'neu' }), (e) => e.status === 409 && /bereits/.test(e.message));
    assert.strictEqual(anzahl(db, 'kontakte'), 1);
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '1');
    assert.strictEqual(leads.beiAnnahme(db, lead.id), null, 'beiAnnahme wandelt erneut um');
  }

  // Rot ohne inTransaktion in umwandeln: Kunde + Zaehlerschritt blieben stehen.
  function fehlgeschlageneUmwandlungHinterlaesstNichts() {
    const db = leadDb();
    // Ein ueberlanges Telefon gibt es regulaer nicht (Oberflaeche und Umzug halten
    // die 40 Zeichen ein), nur per SQL: es scheitert erst beim Ansprechpartner,
    // also nach Kunde und Zaehlerschritt.
    const id = Number(db.prepare("INSERT INTO leads (firma, vorname, telefon, erstellt_am) VALUES ('D', 'Dora', ?, 'x')").run('1'.repeat(50)).lastInsertRowid);
    assert.throws(() => leads.umwandeln(db, { id, art: 'neu' }), /Telefon/);
    assert.strictEqual(anzahl(db, 'kontakte'), 0, 'Kunde blieb trotz Fehler');
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '0', 'Zaehler trotz Fehler erhoeht');
    assert.strictEqual(leads.lade(db, id).status, 'offen');
  }

  // Rot ohne Kuerzung: der Umzug haengt Felder an die Notiz, ueber die
  // Kontaktgrenze hinaus; die Umwandlung scheiterte an kontakte.speichere.
  function langeNotizBleibtVollstaendig() {
    const db = leadDb();
    const notiz = Array.from({ length: 90 }, (_, i) => 'Zeile' + String(i).padStart(4, '0')).join('\n').slice(0, 800);
    assert.strictEqual(notiz.length, 800);
    const id = Number(db.prepare("INSERT INTO leads (firma, notiz, erstellt_am) VALUES ('N', ?, 'x')").run(notiz).lastInsertRowid);
    const u = leads.umwandeln(db, { id, art: 'neu' });
    const k = kontakte.lade(db, u.kontakt_id);
    assert.ok(k.notiz.length <= kontakte.FELDER.notiz.max, 'Kundennotiz ueber der Grenze: ' + k.notiz.length);
    assert.ok(k.notiz.endsWith('(vollständig in L-' + String(id).padStart(4, '0') + ')'), 'Verweis fehlt: ' + k.notiz.slice(-40));
    assert.ok(notiz.startsWith(k.notiz.slice(0, 100)), 'Anfang der Notiz fehlt');
    assert.strictEqual(leads.lade(db, id).notiz, notiz, 'Lead verliert Notiztext');
    // Kurze Notiz bleibt unveraendert.
    const kurz = leads.anlegen(db, { firma: 'K', notiz: 'kurz' }).lead;
    assert.strictEqual(kontakte.lade(db, leads.umwandeln(db, { id: kurz.id, art: 'neu' }).kontakt_id).notiz, 'kurz');
  }

  // Rot gegen "Ansprechpartner nur mit Person": das Telefon ging verloren.
  function telefonOhnePersonBleibt() {
    const db = leadDb();
    const { lead } = leads.anlegen(db, { firma: 'T GmbH', telefon: '0221 9' });
    const u = leads.umwandeln(db, { id: lead.id, art: 'neu' });
    assert.deepStrictEqual(kontakte.ansprechpartnerVon(db, u.kontakt_id).map((a) => [a.name, a.telefon]), [['T GmbH', '0221 9']]);
    // Nur E-Mail, keine Firma, keine Person: Name aus der E-Mail.
    const nurMail = leads.anlegen(db, { email: 'x@y.de', telefon: '1' }).lead;
    const u2 = leads.umwandeln(db, { id: nurMail.id, art: 'neu' });
    assert.deepStrictEqual(kontakte.ansprechpartnerVon(db, u2.kontakt_id).map((a) => [a.name, a.email, a.telefon]), [['x@y.de', 'x@y.de', '1']]);
    // Ohne Person und ohne Telefon kein leerer Ansprechpartner.
    const leer = leads.anlegen(db, { firma: 'Leer' }).lead;
    assert.strictEqual(kontakte.ansprechpartnerVon(db, leads.umwandeln(db, { id: leer.id, art: 'neu' }).kontakt_id).length, 0);
  }

  // Rot gegen falsch zugeordnete Zaehlung (z.B. GROUP BY status).
  function berichtJeQuelle() {
    const db = leadDb();
    const a = leads.anlegen(db, { firma: 'E1', quelle: 'event' }).lead;
    leads.anlegen(db, { firma: 'E2', quelle: 'event' });
    const w = leads.anlegen(db, { firma: 'W', quelle: 'website' }).lead;
    leads.anlegen(db, { firma: 'S' });
    leads.umwandeln(db, { id: a.id, art: 'neu' });
    leads.verloren(db, { id: w.id, grund: 'dublette' });
    const { leads: liste, bericht } = leads.liste(db);
    assert.deepStrictEqual(bericht, [
      { quelle: 'event', offen: 1, umgewandelt: 1, verloren: 0 },
      { quelle: 'sonstiges', offen: 1, umgewandelt: 0, verloren: 0 },
      { quelle: 'website', offen: 0, umgewandelt: 0, verloren: 1 },
    ]);
    assert.strictEqual(liste.length, 4);
    const e1 = liste.find((l) => l.id === a.id);
    assert.strictEqual(e1.kunde_firma, 'E1');
    assert.match(e1.kunde_nr, /^K-/);
  }

  // angebote_offen nach der Regel aus rechnung.jeKontakt.
  function angeboteOffenJeLead() {
    const db = leadDb();
    const { lead } = leads.anlegen(db, { firma: 'O' });
    angebotAnLead(db, 'A-2026-003', lead.id);
    angebotAnLead(db, 'A-2026-004', lead.id);
    angebotAnLead(db, 'A-2026-005', lead.id);
    db.prepare("UPDATE angebote SET gueltig_bis = '2000-01-01' WHERE nr = 'A-2026-004'").run();
    db.prepare("UPDATE angebote SET status = 'angenommen' WHERE nr = 'A-2026-005'").run();
    assert.strictEqual(leads.liste(db).leads[0].angebote_offen, 1);
    // Nach der Umwandlung zaehlt der Kunde dieselben Angebote nach derselben Regel.
    const u = leads.umwandeln(db, { id: lead.id, art: 'neu' });
    assert.strictEqual(require('../../rechnung').jeKontakt(db).get(u.kontakt_id).angebote_offen, 1, 'Kunde zaehlt anders als Lead');
  }

  // Rot ohne COLLATE NOCASE.
  function dublettePerEmailOhneGrossKlein() {
    const db = leadDb();
    leads.anlegen(db, { firma: 'Firma GmbH', email: 'Max@Firma.de' });
    const k = kontakte.speichere(db, { firma: 'Kunde AG', email: 'info@kunde.de' });
    kontakte.speichereAnsprechpartner(db, { kontakt_id: k.id, name: 'Eva', email: 'Eva@Partner.DE' });
    const r = leads.anlegen(db, { firma: 'Neu', email: 'max@firma.DE' });
    assert.strictEqual(r.lead.firma, 'Neu', 'Dublette blockt das Anlegen');
    assert.deepStrictEqual(r.dubletten.leads.map((l) => l.firma), ['Firma GmbH']);
    assert.deepStrictEqual(leads.dublettenKandidaten(db, { email: 'eva@partner.de' }).kunden.map((x) => x.id), [k.id]);
    assert.deepStrictEqual(leads.dublettenKandidaten(db, { email: 'chef@KUNDE.de' }).kunden.map((x) => x.id), [k.id], 'Domain');
    assert.deepStrictEqual(leads.dublettenKandidaten(db, { firma: 'kunde ag' }).kunden.map((x) => x.id), [k.id], 'Firma');
    assert.deepStrictEqual(leads.dublettenKandidaten(db, {}), { leads: [], kunden: [] });
    assert.throws(() => leads.dublettenKandidaten(db, { email: 'x'.repeat(121) }), /hoechstens/);
  }

  // Annahme: ohne Bezug neu, mit Bezug zusammengefuehrt. Versand: nur offen + Bezug.
  function annahmeUndVersand() {
    const db = leadDb();
    assert.strictEqual(leads.beiAnnahme(db, null), null);
    const ohne = leads.anlegen(db, { firma: 'Ohne' }).lead;
    assert.strictEqual(leads.beiAnnahme(db, ohne.id).art, 'neu');
    const k = kontakte.speichere(db, { firma: 'Bestand' });
    const mit = leads.anlegen(db, { firma: 'Mit', kunde_id: k.id }).lead;
    const u = leads.beiAnnahme(db, mit.id);
    assert.deepStrictEqual([u.art, u.kontakt_id], ['zusammengefuehrt', k.id]);
    // Versand
    const v1 = leads.anlegen(db, { firma: 'V1', kunde_id: k.id }).lead;
    const v2 = leads.anlegen(db, { firma: 'V2' }).lead;
    angebotAnLead(db, 'A-2026-006', v1.id);
    angebotAnLead(db, 'A-2026-007', v2.id);
    assert.strictEqual(leads.nachVersand(db, 'A-2026-007'), null, 'Lead ohne Bezug beim Versand umgewandelt');
    assert.strictEqual(leads.lade(db, v2.id).status, 'offen');
    assert.strictEqual(leads.nachVersand(db, 'A-2026-006').art, 'zusammengefuehrt');
    assert.strictEqual(db.prepare("SELECT kontakt_id FROM angebote WHERE nr = 'A-2026-006'").get().kontakt_id, k.id);
    assert.strictEqual(leads.nachVersand(db, 'A-2026-006'), null, 'zweiter Versand wandelt erneut um');
  }

  // Rot ohne das UPDATE in kontakte.loesche: der offene Lead zeigte auf einen geloeschten Kunden.
  function kundeLoeschenLoestBezug() {
    const db = leadDb();
    const k = kontakte.speichere(db, { firma: 'Weg' });
    const offen = leads.anlegen(db, { firma: 'L1', kunde_id: k.id }).lead;
    const um = leads.anlegen(db, { firma: 'L2', kunde_id: k.id }).lead;
    leads.umwandeln(db, { id: um.id, art: 'zusammengefuehrt' });
    kontakte.loesche(db, k.id);
    assert.strictEqual(leads.lade(db, offen.id).kunde_id, null);
    assert.strictEqual(leads.lade(db, um.id).kunde_id, k.id, 'umgewandelter Lead verliert sein Ziel');
    assert.throws(() => leads.aendern(db, { id: offen.id, kunde_id: 999 }), /Unbekannter Kontakt/);
  }

  // Rot, wenn eine der Routen in OHNE_GERAET stuende.
  async function leadRoutenBrauchenGeraet() {
    const s = require('../../server');
    s.setzeGeraeteSchutz(true);
    await new Promise((ok) => s.server.listen(0, '127.0.0.1', ok));
    const basis = 'http://127.0.0.1:' + s.server.address().port;
    try {
      for (const p of ['/api/lead', '/api/lead-umwandeln', '/api/lead-verloren']) {
        const r = await fetch(basis + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"firma":"X"}' });
        await r.text();
        assert.strictEqual(r.status, 401, p + ' ohne Geraet: ' + r.status);
        assert.strictEqual(r.headers.get('x-c2invoice-kopplung'), 'noetig');
      }
      const g = await fetch(basis + '/api/leads');
      const j = await g.json();
      assert.strictEqual(g.status, 200);
      assert.ok(Array.isArray(j.leads) && Array.isArray(j.bericht) && j.quellen.length === 8 && j.gruende.length === 8);
      const d = await fetch(basis + '/api/lead-dubletten?email=' + 'x'.repeat(200));
      await d.text();
      assert.strictEqual(d.status, 400, 'ueberlange Abfrage angenommen');
    } finally {
      s.setzeGeraeteSchutz(false);
      await new Promise((ok) => { s.server.closeAllConnections(); s.server.close(ok); });
    }
  }

  // ---- Task 5: Angebote an Leads, Annahme, Rechnung, Versand ----
  const POS = [{ bezeichnung: 'X', stunden: 1 }];
  const EMPF = { name: 'Lead GmbH', anschrift: ['Weg 1'] };
  const zaehler = (db) => dbmod.getMeta(db, 'kundennummer_zaehler');

  // Rot ohne leads.beiAnnahme in setzeStatus.
  function annahmeLeadLegtKundeAn() {
    rechnungsUmgebung(() => {
      const angebotMod = require('../../angebot');
      const db = rechnungsDb();
      const { lead } = leads.anlegen(db, { firma: 'Lead GmbH', email: 'l@lead.example' });
      const a = angebotMod.erstelle(db, { posten: POS, empfaenger: EMPF, leadId: lead.id });
      assert.deepStrictEqual([a.lead_id, a.kontakt_id], [lead.id, null]);
      assert.strictEqual(angebotMod.liste(db)[0].lead_id, lead.id, 'liste ohne lead_id');
      const r = angebotMod.setzeStatus(db, a.nr, 'angenommen');
      assert.strictEqual(anzahl(db, 'kontakte'), 1, 'kein Kunde angelegt');
      const k = kontakte.liste(db)[0];
      assert.strictEqual(r.kunde_geworden, true);
      assert.deepStrictEqual(r.umwandlung, { lead_id: lead.id, art: 'neu', kontakt_id: k.id, kundennummer: 'K-0001' });
      assert.strictEqual(r.kontakt_id, k.id, 'Angebot nicht an den neuen Kunden gehaengt');
      assert.strictEqual(leads.lade(db, lead.id).status, 'umgewandelt');
    });
  }

  function annahmeLeadMitKundeFuehrtZusammen() {
    rechnungsUmgebung(() => {
      const angebotMod = require('../../angebot');
      const db = rechnungsDb();
      const k = kontakte.speichere(db, { firma: 'Bestand AG' });
      const { lead } = leads.anlegen(db, { firma: 'Neu', kunde_id: k.id });
      const a = angebotMod.erstelle(db, { posten: POS, empfaenger: EMPF, leadId: lead.id });
      const r = angebotMod.setzeStatus(db, a.nr, 'angenommen');
      assert.strictEqual(anzahl(db, 'kontakte'), 1, 'neuer Kunde trotz Bezug');
      assert.strictEqual(zaehler(db), '1', 'Zaehler weitergezaehlt');
      assert.deepStrictEqual(r.umwandlung, { lead_id: lead.id, art: 'zusammengefuehrt', kontakt_id: k.id, kundennummer: k.kundennummer });
      assert.strictEqual(r.kunde_geworden, false, 'Zusammenfuehrung als neuer Kunde gemeldet');
      assert.strictEqual(r.kontakt_id, k.id);
    });
  }

  // Rot mit der Umwandlung ausserhalb der Transaktion von inRechnung.
  function inRechnungLeadAngebot() {
    rechnungsUmgebung((config) => {
      const angebotMod = require('../../angebot');
      const db = rechnungsDb();
      const l1 = leads.anlegen(db, { firma: 'Eins' }).lead;
      const l2 = leads.anlegen(db, { firma: 'Zwei' }).lead;
      const a1 = angebotMod.erstelle(db, { posten: POS, empfaenger: EMPF, leadId: l1.id });
      const a2 = angebotMod.erstelle(db, { posten: POS, empfaenger: EMPF, leadId: l2.id });
      const { rechnung: inv } = angebotMod.inRechnung(db, a1.nr);
      const k = kontakte.liste(db)[0];
      assert.strictEqual(inv.kontakt_id, k.id, 'Rechnung nicht am Kunden');
      assert.strictEqual(inv.empfaenger.kundennummer, 'K-0001', 'Rechnung ohne Kundennummer');
      // Stammdaten fehlen: keine Rechnung, kein Kunde, kein Zaehlerschritt, Lead offen.
      config.rechnung.aussteller.name = '';
      assert.throws(() => angebotMod.inRechnung(db, a2.nr), /Stammdaten/);
      assert.strictEqual(anzahl(db, 'kontakte'), 1, 'Kunde trotz gescheiterter Rechnung');
      assert.strictEqual(zaehler(db), '1', 'Zaehler trotz gescheiterter Rechnung');
      assert.strictEqual(leads.lade(db, l2.id).status, 'offen');
      assert.strictEqual(angebotMod.lade(db, a2.nr).kontakt_id, null);
      assert.strictEqual(anzahl(db, 'invoices'), 1);
    });
  }

  // Versanddienst mit Transport- und Druck-Attrappe (wie mitDienst in test/cira/c11a.js).
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  async function mitVersand(cfg, fn) {
    const { erzeuge } = require('../../mail');
    const db = leadDb(), aufrufe = [];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c12-'));
    const mailCfg = {
      smtp: { host: 'smtp.example.org', port: 465, sicher: 'tls', benutzer: 'a@example.org', passwortEnvVar: 'C2I_SMTP_PASSWORT' },
      absender: { name: 'Büro', adresse: 'a@example.org' }, transport: 'smtp', umleitenAn: '', tagesgrenze: 100, ...cfg,
    };
    try {
      const d = erzeuge({
        db, mailCfg: () => mailCfg, env: { C2I_SMTP_PASSWORT: 'pw-geheim' }, versandOrdner: path.join(tmp, 'versand'),
        pdfFn: async (art, nr) => { const pdf = path.join(tmp, nr + '.pdf'); fs.writeFileSync(pdf, '%PDF'); return { nr, pdf }; },
        transporte: { smtp: async (a) => { aufrufe.push(a); return { antwort: '250 ok' }; } },
      });
      await fn({ d, db, aufrufe });
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  // POST /api/mail/senden ueber d.routen, wie der Server.
  const sendeAngebot = (d, nr, schluessel) => new Promise((ok) => {
    const { Readable } = require('node:stream');
    const req = Readable.from([JSON.stringify({ art: 'angebot', nr, an: ['l@lead.example'], betreff: 'Angebot', text: 'Hallo', schluessel })]);
    req.method = 'POST'; req.headers = {};
    const leseKoerper = (r, fertig) => { let s = ''; r.on('data', (x) => { s += x; }); r.on('end', () => fertig(null, JSON.parse(s))); };
    d.routen(req, {}, '/api/mail/senden', new URL('http://127.0.0.1/api/mail/senden'), { sendJson: (res, data, status = 200) => ok({ status, data }), leseKoerper });
  });

  // Rot ohne die !test-Pruefung in sendeBeleg.
  async function testversandFuehrtNichtZusammen() {
    await mitVersand({ umleitenAn: 'test@example.org' }, async ({ d, db, aufrufe }) => {
      const k = kontakte.speichere(db, { firma: 'Bestand' });
      const { lead } = leads.anlegen(db, { firma: 'L', email: 'l@lead.example', kunde_id: k.id });
      angebotAnLead(db, 'AN-2026-0011', lead.id);
      const r = await sendeAngebot(d, 'AN-2026-0011', 'c12-test-0001');
      assert.deepStrictEqual([r.status, r.data.status, r.data.test], [200, 'ok', true], JSON.stringify(r));
      assert.strictEqual(aufrufe.length, 1);
      assert.strictEqual(leads.lade(db, lead.id).status, 'offen', 'Testversand hat zusammengefuehrt');
    });
  }

  async function scharferVersandFuehrtZusammen() {
    await mitVersand({}, async ({ d, db }) => {
      const k = kontakte.speichere(db, { firma: 'Bestand' });
      const mit = leads.anlegen(db, { firma: 'L', email: 'l@lead.example', kunde_id: k.id }).lead;
      const ohne = leads.anlegen(db, { firma: 'O', email: 'o@lead.example' }).lead;
      angebotAnLead(db, 'AN-2026-0012', mit.id);
      angebotAnLead(db, 'AN-2026-0013', ohne.id);
      const r = await sendeAngebot(d, 'AN-2026-0012', 'c12-scharf-0001');
      assert.deepStrictEqual([r.status, r.data.status, r.data.test], [200, 'ok', false], JSON.stringify(r));
      const l = leads.lade(db, mit.id);
      assert.deepStrictEqual([l.status, l.umwandlung_art, l.kunde_id], ['umgewandelt', 'zusammengefuehrt', k.id]);
      assert.strictEqual(db.prepare("SELECT kontakt_id FROM angebote WHERE nr = 'AN-2026-0012'").get().kontakt_id, k.id);
      // Ohne Kundenbezug fuehrt erst die Annahme um, nicht der Versand.
      assert.strictEqual((await sendeAngebot(d, 'AN-2026-0013', 'c12-scharf-0002')).data.status, 'ok');
      assert.strictEqual(leads.lade(db, ohne.id).status, 'offen');
      assert.strictEqual(anzahl(db, 'kontakte'), 1);
    });
  }

  // Rot ohne Warnung: die Mail ist raus, das Zusammenfuehren aber still gescheitert.
  async function versandMeldetGescheitertesZusammenfuehren() {
    await mitVersand({}, async ({ d, db }) => {
      const k = kontakte.speichere(db, { firma: 'Bestand' });
      const l = leads.anlegen(db, { firma: 'L', email: 'l@lead.example', kunde_id: k.id }).lead;
      angebotAnLead(db, 'AN-2026-0015', l.id);
      const alt = leads.nachVersand, altLog = console.error;
      leads.nachVersand = () => { throw new Error('kaputt'); };
      console.error = () => {};
      try {
        const r = await sendeAngebot(d, 'AN-2026-0015', 'c12-warn-0001');
        assert.deepStrictEqual([r.status, r.data.status], [200, 'ok'], JSON.stringify(r));
        assert.match(r.data.warnung || '', /Lead nicht zusammengeführt — siehe Serverprotokoll/);
      } finally { leads.nachVersand = alt; console.error = altLog; }
      assert.strictEqual(leads.lade(db, l.id).status, 'offen');
    });
  }

  // Rot ohne den Lead-Zweig in empfaengerVon: an war leer.
  async function empfaengerFaelltAufLeadZurueck() {
    await mitVersand({}, async ({ d, db }) => {
      const { lead } = leads.anlegen(db, { firma: 'L', vorname: 'Lea', nachname: 'Lind', email: 'l@lead.example' });
      angebotAnLead(db, 'AN-2026-0014', lead.id);
      const n = await d.belegNachricht('angebot', 'AN-2026-0014');
      assert.deepStrictEqual(n.an, ['l@lead.example']);
      assert.ok(n.text.startsWith('Guten Tag Lea Lind,'), n.text);
      // Mit Kunde gilt der Kunde, nicht der Lead.
      const k = kontakte.speichere(db, { firma: 'K', email: 'k@kunde.example' });
      db.prepare("UPDATE angebote SET kontakt_id = ? WHERE nr = 'AN-2026-0014'").run(k.id);
      assert.deepStrictEqual((await d.belegNachricht('angebot', 'AN-2026-0014')).an, ['k@kunde.example']);
    });
  }

  // Rot ohne status='kunde' im INSERT von kontakte.speichere (Spaltenvorgabe ist 'lead').
  function keinKontaktMitStatusLead() {
    rechnungsUmgebung(() => {
      const angebotMod = require('../../angebot');
      const db = rechnungsDb();
      kontakte.speichere(db, { firma: 'Direkt', status: 'lead' });
      leads.umwandeln(db, { id: leads.anlegen(db, { firma: 'U' }).lead.id, art: 'neu' });
      const a = angebotMod.erstelle(db, { posten: POS, empfaenger: EMPF, leadId: leads.anlegen(db, { firma: 'A' }).lead.id });
      angebotMod.setzeStatus(db, a.nr, 'angenommen');
      assert.strictEqual(anzahl(db, 'kontakte'), 3);
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM kontakte WHERE status <> 'kunde'").get().n, 0, 'Kontakt mit Status lead');
    });
  }

  // Rot gegen ein Rueckgaengig, das die Umwandlung zuruecknimmt (altes stand.lead/macheLead).
  function rueckgaengigLaesstKundeStehen() {
    rechnungsUmgebung(() => {
      const angebotMod = require('../../angebot');
      const db = rechnungsDb();
      const { lead } = leads.anlegen(db, { firma: 'R' });
      const a = angebotMod.erstelle(db, { posten: POS, empfaenger: EMPF, leadId: lead.id });
      const r = angebotMod.setzeStatus(db, a.nr, 'angenommen');
      const zurueck = angebotMod.setzeStatus(db, a.nr, 'offen', { gueltig_bis: a.gueltig_bis, angenommen_am: null, abgelehnt_am: null, lead: true });
      assert.deepStrictEqual([zurueck.status, zurueck.angenommen_am, zurueck.umwandlung], ['offen', null, null]);
      assert.strictEqual(zurueck.kontakt_id, r.umwandlung.kontakt_id, 'Angebot verliert den Kunden');
      assert.strictEqual(kontakte.lade(db, r.umwandlung.kontakt_id).kundennummer, 'K-0001', 'Kunde weg');
      const l = leads.lade(db, lead.id);
      assert.deepStrictEqual([l.status, l.kunde_id], ['umgewandelt', r.umwandlung.kontakt_id], 'Umwandlung zurueckgenommen');
      // Erneute Annahme wandelt nicht ein zweites Mal um.
      assert.strictEqual(angebotMod.setzeStatus(db, a.nr, 'angenommen').umwandlung, null);
      assert.strictEqual(anzahl(db, 'kontakte'), 1);
    });
  }

  // ---- G7-Fixwelle ----
  // SF1: RAISE(ROLLBACK) beendet die ganze Transaktion samt Savepoint. Rot, solange
  // ROLLBACK TO ungeschuetzt laeuft: dann kommt "no such savepoint" statt des Fehlers.
  function inTransaktionZeigtEchtenFehler() {
    const db = neueDb();
    db.exec("CREATE TRIGGER boom BEFORE INSERT ON t WHEN NEW.x = 'boom' BEGIN SELECT RAISE(ROLLBACK, 'echter Fehler'); END");
    assert.throws(() => inTransaktion(db, () => ein(db, 'boom')), /echter Fehler/);
    assert.throws(() => inTransaktion(db, () => { ein(db, 'a'); inTransaktion(db, () => ein(db, 'boom')); }), /echter Fehler/, 'verschachtelt');
    assert.strictEqual(db.isTransaction, false, 'Transaktion blieb offen');
    assert.deepStrictEqual(zeilen(db), []);
  }

  // S1/R13: die Nummer eines geloeschten Kunden steht noch auf seinen Rechnungen.
  // Rot, solange der Zaehler nur behaltene Nummern kennt (Neu bekaeme K-0004).
  function zaehlerUeberBelegnummern() {
    const db = altDb();
    kontakt(db, { firma: 'Bleibt', nummer: 'K-0003', erstellt: '2026-01-01T00:00:00Z' });
    rechnungAn(db, 'R-2026-001', 999, { name: 'Geloescht', kundennummer: 'K-0012' });
    rechnungAn(db, 'R-2026-002', null, { name: 'Frei', kundennummer: 'k-0010' });
    kontakt(db, { firma: 'Neu', erstellt: '2026-02-01T00:00:00Z' });
    dbmod.migrate(db);
    assert.deepStrictEqual(nummern(db), { Bleibt: 'K-0003', Neu: 'K-0013' }, 'Nummer eines geloeschten Kunden neu vergeben');
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '13');
  }

  // S2: eine riesige K-Nummer (Kontakt oder Abschrift) zaehlt nicht. Rot, solange
  // \d+ gilt: Zaehler 1e25, zwei neue Kunden bekamen 'K-1e+25', der Index brach den Start.
  function riesigeNummerZaehltNicht() {
    const db = altDb();
    kontakt(db, { firma: 'Riesig', nummer: 'K-9999999999999999999999999', erstellt: '2026-01-01T00:00:00Z' });
    rechnungAn(db, 'R-2026-001', 999, { name: 'X', kundennummer: 'K-1234567890' });
    kontakt(db, { firma: 'A', erstellt: '2026-02-01T00:00:00Z' });
    kontakt(db, { firma: 'B', erstellt: '2026-03-01T00:00:00Z' });
    dbmod.migrate(db);
    assert.deepStrictEqual(nummern(db), { Riesig: 'K-9999999999999999999999999', A: 'K-0001', B: 'K-0002' });
    assert.strictEqual(dbmod.getMeta(db, 'kundennummer_zaehler'), '2');
    // Kaputter Zaehler in meta: Anlegen wirft statt 'K-1e+27' zu vergeben.
    dbmod.setMeta(db, 'kundennummer_zaehler', '1e27');
    assert.throws(() => kontakte.speichere(db, { firma: 'C' }), /Zaehler/);
    assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM kontakte WHERE firma = 'C'").get().n, 0);
  }

  // SF2/R12: umnummerierte Dubletten stehen dauerhaft in meta. Rot ohne das Protokoll.
  function umnummerierungProtokolliert() {
    const db = altDb();
    kontakt(db, { firma: 'Erst', nummer: 'K-0003', erstellt: '2026-01-01T00:00:00Z' });
    const zweit = kontakt(db, { firma: 'Zweit', nummer: 'k-0003', erstellt: '2026-02-01T00:00:00Z' });
    kontakt(db, { firma: 'Leer', nummer: '  ', erstellt: '2026-03-01T00:00:00Z' });
    const warn = console.warn; console.warn = () => {};
    try { dbmod.migrate(db); } finally { console.warn = warn; }
    assert.deepStrictEqual(JSON.parse(dbmod.getMeta(db, 'c12_umnummeriert') || 'null'), [{ kontakt_id: zweit, alt: 'k-0003', neu: 'K-0004' }]);
    // Ohne Dublette kein Eintrag.
    const ohne = altDb();
    kontakt(ohne, { firma: 'Eins' });
    dbmod.migrate(ohne);
    assert.strictEqual(dbmod.getMeta(ohne, 'c12_umnummeriert'), null);
  }

  // SF3: Annahme per Rueckgaengig-Stand an einem nicht umgewandelten Lead haette
  // beiAnnahme uebersprungen. Rot ohne die Pruefung: Angebot angenommen, kein Kunde.
  function standAngenommenBeiOffenemLeadWirft() {
    rechnungsUmgebung(() => {
      const angebotMod = require('../../angebot');
      const db = rechnungsDb();
      const { lead } = leads.anlegen(db, { firma: 'S' });
      const a = angebotMod.erstelle(db, { posten: POS, empfaenger: EMPF, leadId: lead.id });
      const stand = { gueltig_bis: a.gueltig_bis, angenommen_am: new Date().toISOString(), abgelehnt_am: null };
      assert.throws(() => angebotMod.setzeStatus(db, a.nr, 'angenommen', stand), /Lead/);
      assert.strictEqual(angebotMod.lade(db, a.nr).status, 'offen');
      assert.strictEqual(anzahl(db, 'kontakte'), 0);
      // Nach echter Annahme (Lead umgewandelt) bleibt das Wiederherstellen erlaubt.
      angebotMod.setzeStatus(db, a.nr, 'angenommen');
      angebotMod.setzeStatus(db, a.nr, 'offen', { gueltig_bis: a.gueltig_bis, angenommen_am: null, abgelehnt_am: null });
      assert.strictEqual(angebotMod.setzeStatus(db, a.nr, 'angenommen', stand).status, 'angenommen');
    });
  }

  // S3: einzeilige Lead-Felder ohne CR/LF/TAB, E-Mail nach mail.EMAIL_RE. Notiz und
  // Anschrift bleiben mehrzeilig; die Kontaktseite bleibt unveraendert.
  function leadFelderEinzeilig() {
    const db = leadDb();
    for (const [feld, wert] of [['firma', 'A\nB'], ['vorname', 'A\tB'], ['nachname', 'A\rB'], ['telefon', '0221\n1'], ['email', 'a@b.de\nBcc: x@y.de']]) {
      assert.throws(() => leads.anlegen(db, { firma: 'F', [feld]: wert }), /eine Zeile|E-Mail/, feld);
    }
    for (const e of ['a@b', 'a b@c.de', 'a@b@c.de']) assert.throws(() => leads.anlegen(db, { firma: 'F', email: e }), /E-Mail/, e);
    assert.strictEqual(anzahl(db, 'leads'), 0);
    const { lead } = leads.anlegen(db, { firma: 'F', email: 'a@b.de', notiz: 'eins\nzwei\tdrei', anschrift: ['Weg 1', '10115 Berlin'] });
    assert.strictEqual(lead.notiz, 'eins\nzwei\tdrei');
    assert.throws(() => leads.aendern(db, { id: lead.id, firma: 'X\nY' }), /eine Zeile/);
    assert.strictEqual(kontakte.speichere(db, { firma: 'K', notiz: 'eins\nzwei' }).notiz, 'eins\nzwei', 'Kontakt-Notiz nicht mehr mehrzeilig');
  }

  return [
    ['C12: G7 SF1 — inTransaktion zeigt den echten Fehler nach Auto-Rollback', inTransaktionZeigtEchtenFehler],
    ['C12: G7 S1 — Zaehler liegt ueber allen K-Nummern in Rechnungsabschriften', zaehlerUeberBelegnummern],
    ['C12: G7 S2 — riesige K-Nummer zaehlt nicht, kaputter Zaehler wirft', riesigeNummerZaehltNicht],
    ['C12: G7 SF2 — umnummerierte Dubletten in meta c12_umnummeriert', umnummerierungProtokolliert],
    ['C12: G7 SF3 — Stand angenommen bei nicht umgewandeltem Lead wirft', standAngenommenBeiOffenemLeadWirft],
    ['C12: G7 S3 — Lead-Felder einzeilig, E-Mail nach EMAIL_RE', leadFelderEinzeilig],
    ['C12: Kundennummer — Rechnung nimmt sie nur aus dem Kontakt', rechnungNimmtNummerNurAusKontakt],
    ['C12: Kundennummer — abgebrochenes Anlegen laesst den Zaehler stehen', abgebrochenesAnlegenLaesstZaehler],
    ['C12: Kundennummer — Zaehler unter Bestand wirft, Zaehler bleibt', zaehlerUnterBestandWirft],
    ['C12: Kundennummer — naechste aus dem Zaehler, nicht aus der ID', nummerAusZaehler],
    ['C12: Kundennummer — geloeschte wird nie neu vergeben', geloeschteNummerNieWieder],
    ['C12: Kundennummer — mitgeschickte Nummer bleibt wirkungslos', mitgeschickteNummerWirkungslos],
    ['C12: Kundennummer — Rechnungsabschrift traegt sie unveraenderlich', abschriftTraegtGespeicherteNummer],
    ['C12: inTransaktion verschachtelbar', inTransaktionVerschachtelt],
    ['C12: inTransaktion in offenem BEGIN', inTransaktionInOffenemBegin],
    ['C12: inTransaktion, ROLLBACK TO scheitert aussen', inTransaktionRollbackToScheitert],
    ['C12: Migration — freier Lead zieht nach leads um', freierLeadZiehtUm],
    ['C12: Migration — Lead-Umzug behaelt alle Angaben in der Notiz', leadUmzugVerliertNichts],
    ['C12: Migration — Fehler mittendrin rollt zurueck', umzugRolltZurueck],
    ['C12: Migration — Lead mit Bindung bleibt Kunde', leadMitBindungBleibtKunde],
    ['C12: Migration — Kundennummern nach erstellt_am', nummernNachErstelltAm],
    ['C12: Migration — Nummer aus Rechnungsabschrift bleibt', nummerAusAbschriftBleibt],
    ['C12: Migration — Dubletten bekommen neue Nummer', dublettenBrickenStartNicht],
    ['C12: Migration — zweiter Lauf aendert nichts', zweiterLaufAendertNichts],
    ['C12: frische DB — Schema und Waechter', frischeDb],
    ['C12: Leads — Quelle und Grund nur aus der Liste', quelleUndGrundNurAusListe],
    ['C12: Leads — umwandeln neu legt Kunde mit Nummer an, haengt Angebote um', umwandelnNeuLegtKundeAn],
    ['C12: Leads — zusammenfuehren ohne Kunde wirft', zusammenfuehrenBrauchtKunde],
    ['C12: Leads — doppelte Umwandlung wirft', doppelteUmwandlungWirft],
    ['C12: Leads — gescheiterte Umwandlung hinterlaesst keinen Kunden, keinen Zaehlerschritt', fehlgeschlageneUmwandlungHinterlaesstNichts],
    ['C12: Leads — lange Notiz: Kunde gekuerzt mit Verweis, Lead vollstaendig', langeNotizBleibtVollstaendig],
    ['C12: Leads — Telefon ohne Person landet im Ansprechpartner', telefonOhnePersonBleibt],
    ['C12: Leads — bericht zaehlt je Quelle', berichtJeQuelle],
    ['C12: Leads — angebote_offen wie rechnung.jeKontakt', angeboteOffenJeLead],
    ['C12: Leads — Dublette per E-Mail ohne Gross/Klein, blockt nicht', dublettePerEmailOhneGrossKlein],
    ['C12: Leads — beiAnnahme und nachVersand', annahmeUndVersand],
    ['C12: Leads — Kunde loeschen loest Bezug offener Leads', kundeLoeschenLoestBezug],
    ['C12: Leads — Schreibrouten ohne Geraet 401, Lesen frei', leadRoutenBrauchenGeraet],
    ['C12: Angebot — Annahme Lead ohne Kunde legt Kunden an', annahmeLeadLegtKundeAn],
    ['C12: Angebot — Annahme Lead mit Kunde fuehrt zusammen, kein neuer Kunde', annahmeLeadMitKundeFuehrtZusammen],
    ['C12: Angebot — inRechnung am Kunden mit Nummer, gescheiterte Rechnung hinterlaesst nichts', inRechnungLeadAngebot],
    ['C12: Versand — Testmodus fuehrt nicht zusammen', testversandFuehrtNichtZusammen],
    ['C12: Versand — scharfer Versand fuehrt Lead mit Kunde zusammen', scharferVersandFuehrtZusammen],
    ['C12: Versand — gescheitertes Zusammenfuehren meldet Warnung', versandMeldetGescheitertesZusammenfuehren],
    ['C12: Versand — Empfaenger faellt auf Lead-E-Mail zurueck', empfaengerFaelltAufLeadZurueck],
    ['C12: Kontakte — kein Kontakt mit Status lead', keinKontaktMitStatusLead],
    ['C12: Angebot — Rueckgaengig der Annahme laesst Kunde und Umwandlung stehen', rueckgaengigLaesstKundeStehen],
  ];
};
