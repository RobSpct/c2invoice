'use strict';
// C11c Flows: Engine (design/cira/C11-FLOWS.md E1-E11). Aktionen sind hier Attrappen.
const assert = require('node:assert');

module.exports = ({ dbmod, openDbs, configGeschuetzt }) => {
  const flows = require('../../flows');
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  const JETZT = () => '2026-11-04T10:00:00.000Z';

  // Linearer Flow aus Aktionsnamen: trigger -> a0 -> a1 ...
  function legeFlow(db, namen, extra = {}) {
    const knoten = [{ id: 't', typ: 'trigger', titel: 'Start', parameter: {}, outs: { weiter: namen.length ? 'a0' : null } }];
    namen.forEach((n, i) => knoten.push({ id: 'a' + i, typ: 'action', titel: n, parameter: { aktion: n }, outs: { weiter: i + 1 < namen.length ? 'a' + (i + 1) : null } }));
    return Number(db.prepare('INSERT INTO flow (titel, aktiv, ausloeser_json, knoten_json) VALUES (?, 1, ?, ?)')
      .run(extra.titel || 'T', JSON.stringify({ art: extra.art || 'x' }), JSON.stringify(knoten)).lastInsertRowid);
  }
  const dienst = (db, aktionen) => flows.erzeugeDienst({ db, aktionen, jetzt: JETZT });
  const attrappe = (log, f) => ({ pruefe: () => 'pruefe', fuehreAus: async (ctx) => { log.push(ctx); return f ? f(ctx) : { ausgang: { ...ctx.eingang, ok: 1 }, meldung: 'ok' }; } });

  async function laufZweiSchritte() {
    const db = neueDb(); const log = [];
    const d = dienst(db, { a: attrappe(log, () => ({ ausgang: { rechnung: '2026-0001' }, meldung: 'getan' })) });
    const id = legeFlow(db, ['a']);
    const l = await d.lauf(id, { betreff: 'hallo' }, {});
    const lauf = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(l);
    assert.strictEqual(lauf.status, 'ok');
    assert.strictEqual(lauf.wurzel_id, l);
    const s = db.prepare('SELECT * FROM flow_schritt WHERE lauf_id = ? ORDER BY nr').all(l);
    assert.strictEqual(s.length, 2);
    assert.deepStrictEqual(s.map((x) => x.status), ['ok', 'ok']);
    assert.strictEqual(s[1].eingang_json, s[0].ausgang_json);
    assert.deepStrictEqual(JSON.parse(s[1].ausgang_json), { rechnung: '2026-0001' });
    assert.strictEqual(log[0].lauf.nr, 2);
    assert.strictEqual(log[0].test, false);
  }

  async function condVerzweigt() {
    const db = neueDb(); const log = [];
    const d = dienst(db, { ja: attrappe(log), nein: attrappe(log) });
    const bau = (op, wert) => Number(db.prepare('INSERT INTO flow (titel, aktiv, ausloeser_json, knoten_json) VALUES (?,1,?,?)').run('C', '{}', JSON.stringify([
      { id: 't', typ: 'trigger', parameter: {}, outs: { weiter: 'c' } },
      { id: 'c', typ: 'cond', parameter: { feld: 'a.b', op, wert }, outs: { ja: 'j', nein: 'n' } },
      { id: 'j', typ: 'action', parameter: { aktion: 'ja' }, outs: {} },
      { id: 'n', typ: 'action', parameter: { aktion: 'nein' }, outs: {} },
    ])).lastInsertRowid);
    const port = async (op, wert, ereignis) => {
      const l = await d.lauf(bau(op, wert), ereignis, {});
      assert.strictEqual(db.prepare('SELECT status FROM flow_lauf WHERE id = ?').get(l).status, 'ok');
      return db.prepare("SELECT node_id FROM flow_schritt WHERE lauf_id = ? AND typ = 'action'").get(l).node_id;
    };
    assert.strictEqual(await port('gleich', 5, { a: { b: 5 } }), 'j');
    assert.strictEqual(await port('gleich', 5, { a: { b: 6 } }), 'n');
    assert.strictEqual(await port('ungleich', 5, { a: { b: 6 } }), 'j');
    assert.strictEqual(await port('groesser', 5, { a: { b: 6 } }), 'j');
    assert.strictEqual(await port('groesser', 5, { a: { b: 5 } }), 'n');
    assert.strictEqual(await port('gesetzt', null, { a: { b: 0 } }), 'j');
    assert.strictEqual(await port('gesetzt', null, { a: { b: '' } }), 'n');
    // fehlendes Feld: immer "nein", nie Exception
    for (const op of ['gleich', 'ungleich', 'groesser', 'gesetzt']) {
      assert.strictEqual(await port(op, 5, {}), 'n', op);
      assert.strictEqual(await port(op, 5, { a: null }), 'n', op);
      assert.strictEqual(await port(op, 5, { a: 'text' }), 'n', op);
    }
  }

  async function schluesselEinmal() {
    const db = neueDb(); const log = [];
    const d = dienst(db, { a: attrappe(log) });
    const id = legeFlow(db, ['a']);
    assert.ok(await d.lauf(id, {}, { schluessel: 'k1' }));
    assert.strictEqual(await d.lauf(id, {}, { schluessel: 'k1' }), null);
    assert.ok(await d.lauf(id, {}, { schluessel: 'k2' }));
    assert.ok(await d.lauf(id, {}, {}));
    assert.ok(await d.lauf(id, {}, {})); // ohne Schluessel beliebig oft
    assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM flow_lauf WHERE schluessel = 'k1'").get().n, 1);
    assert.strictEqual(log.length, 4);
  }

  async function seriell() {
    const db = neueDb(); const ereignisse = [];
    const d = dienst(db, { a: { pruefe: () => '', fuehreAus: async (ctx) => {
      ereignisse.push('start' + ctx.eingang.n); await warte(15); ereignisse.push('ende' + ctx.eingang.n); return { ausgang: {}, meldung: '' };
    } } });
    legeFlow(db, ['a'], { art: 'ev' });
    await Promise.all([d.ausloesen('ev', { n: 1 }), d.ausloesen('ev', { n: 2 })]);
    assert.deepStrictEqual(ereignisse, ['start1', 'ende1', 'start2', 'ende2']);
    // inaktiver Flow und fremde Art loesen nichts aus
    const id = legeFlow(db, ['a'], { art: 'ev' }); d.setzeAktiv(id, false);
    ereignisse.length = 0;
    await d.ausloesen('ev', { n: 3 }); await d.ausloesen('anders', { n: 4 });
    assert.deepStrictEqual(ereignisse, ['start3', 'ende3']);
  }

  async function wiederholenAbSchritt() {
    const db = neueDb(); const zaehler = { a: 0, b: 0, c: 0 }; let kaputt = true;
    const mk = (n, f) => ({ pruefe: () => '', fuehreAus: async (ctx) => { zaehler[n]++; if (f) f(); return { ausgang: { ...ctx.eingang, [n]: 1 }, meldung: n }; } });
    const d = dienst(db, { a: mk('a'), b: mk('b'), c: mk('c', () => { if (kaputt) throw new Error('boom'); }) });
    const id = legeFlow(db, ['a', 'b', 'c']);
    const l1 = await d.lauf(id, { start: 1 }, {});
    const l1z = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(l1);
    assert.strictEqual(l1z.status, 'err');
    assert.strictEqual(l1z.fehler_schritt, 4); // trigger=1, a=2, b=3, c=4
    kaputt = false;
    const l2 = await d.wiederholen(l1, 4);
    assert.notStrictEqual(l2, l1);
    assert.deepStrictEqual(zaehler, { a: 1, b: 1, c: 2 });
    const z2 = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(l2);
    assert.strictEqual(z2.status, 'ok');
    assert.strictEqual(z2.wurzel_id, l1);
    const s = db.prepare('SELECT nr, status FROM flow_schritt WHERE lauf_id = ? ORDER BY nr').all(l2);
    assert.deepStrictEqual(s.map((x) => x.status), ['uebernommen', 'uebernommen', 'uebernommen', 'ok']);
    // Wiederholung der Wiederholung bleibt an der Wurzel
    const l3 = await d.wiederholen(l2, 4);
    assert.strictEqual(db.prepare('SELECT wurzel_id FROM flow_lauf WHERE id = ?').get(l3).wurzel_id, l1);
    await assert.rejects(() => d.wiederholen(l1, 9), /Schritt/);
  }

  async function trockenlauf() {
    const db = neueDb(); let echt = 0; const geprueft = [];
    const d = dienst(db, { a: { pruefe: (ctx) => { geprueft.push(ctx.test); return 'wuerde senden'; }, fuehreAus: async () => { echt++; return { ausgang: {}, meldung: '' }; } } });
    const id = legeFlow(db, ['a']);
    const l = await d.lauf(id, { x: 1 }, { test: true });
    assert.strictEqual(echt, 0);
    assert.deepStrictEqual(geprueft, [true]);
    const z = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(l);
    assert.strictEqual(z.status, 'skip');
    assert.strictEqual(z.test, 1);
    const s = db.prepare('SELECT * FROM flow_schritt WHERE lauf_id = ? ORDER BY nr').all(l);
    assert.deepStrictEqual(s.map((x) => x.status), ['ok', 'skip']);
    assert.strictEqual(s[1].meldung, 'wuerde senden');
    // cond laeuft im Test echt
    const cid = Number(db.prepare('INSERT INTO flow (titel, aktiv, ausloeser_json, knoten_json) VALUES (?,1,?,?)').run('C', '{}', JSON.stringify([
      { id: 't', typ: 'trigger', parameter: {}, outs: { weiter: 'c' } },
      { id: 'c', typ: 'cond', parameter: { feld: 'x', op: 'gleich', wert: 1 }, outs: { ja: 'a', nein: null } },
      { id: 'a', typ: 'action', parameter: { aktion: 'a' }, outs: {} },
    ])).lastInsertRowid);
    const l2 = await d.lauf(cid, { x: 2 }, { test: true });
    assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM flow_schritt WHERE lauf_id = ? AND typ = 'action'").get(l2).n, 0);
    assert.strictEqual(echt, 0);
  }

  async function aufraeumen() {
    const db = neueDb();
    const d = dienst(db, {});
    const id = legeFlow(db, []);
    const l = Number(db.prepare("INSERT INTO flow_lauf (flow_id, start, status) VALUES (?, 'x', 'laeuft')").run(id).lastInsertRowid);
    db.prepare("INSERT INTO flow_schritt (lauf_id, nr, node_id, typ, status) VALUES (?, 1, 't', 'trigger', 'laeuft')").run(l);
    const ok = Number(db.prepare("INSERT INTO flow_lauf (flow_id, start, status) VALUES (?, 'x', 'ok')").run(id).lastInsertRowid);
    assert.deepStrictEqual(d.aufraeumen(), [{ id: l, fehler_schritt: 1, ohneWiederholen: false }]);
    assert.deepStrictEqual(d.aufraeumen(), []);
    const z = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(l);
    assert.strictEqual(z.status, 'err');
    assert.ok(z.ende);
    assert.strictEqual(z.fehler, 'Server wurde während des Laufs beendet; Ergebnis prüfen');
    assert.strictEqual(z.fehler_schritt, 1);
    assert.strictEqual(db.prepare('SELECT status FROM flow_schritt WHERE lauf_id = ?').get(l).status, 'err');
    assert.strictEqual(db.prepare('SELECT status FROM flow_lauf WHERE id = ?').get(ok).status, 'ok');
  }

  async function vorlagenEinmal() {
    const db = neueDb();
    const vorlagen = [{ titel: 'V', ausloeser: { art: 'x' }, knoten: [], vorlage: 'v1' }];
    const d = flows.erzeugeDienst({ db, aktionen: {}, vorlagen });
    assert.strictEqual(d.vorlagenAnlegen(), 1);
    assert.strictEqual(d.liste().length, 1);
    db.prepare('DELETE FROM flow').run();
    assert.strictEqual(d.vorlagenAnlegen(), 0);
    assert.strictEqual(flows.erzeugeDienst({ db, aktionen: {}, vorlagen }).vorlagenAnlegen(), 0);
    assert.strictEqual(d.liste().length, 0);
  }

  async function fehlerhafteAktion() {
    const db = neueDb(); const folge = [];
    const d = dienst(db, {
      boese: { pruefe: () => '', fuehreAus: async () => { throw new Error('kaputt'); } },
      skipt: { pruefe: () => '', fuehreAus: async () => { throw Object.assign(new Error('schon da'), { lauf_status: 'skip' }); } },
      warnt: { pruefe: () => '', fuehreAus: async () => { throw Object.assign(new Error('hm'), { lauf_status: 'warn' }); } },
      danach: attrappe(folge),
    });
    const lauf = async (namen) => db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(await d.lauf(legeFlow(db, namen), {}, {}));
    const e = await lauf(['boese', 'danach']);
    assert.strictEqual(e.status, 'err'); assert.strictEqual(e.fehler, 'kaputt'); assert.strictEqual(e.fehler_schritt, 2);
    const s = await lauf(['skipt', 'danach']);
    assert.strictEqual(s.status, 'skip'); assert.strictEqual(s.fehler, null);
    const w = await lauf(['warnt', 'danach']);
    assert.strictEqual(w.status, 'warn');
    assert.strictEqual(folge.length, 0);
    assert.strictEqual(db.prepare('SELECT status FROM flow_schritt WHERE lauf_id = ? AND nr = 2').get(e.id).status, 'err');
    // unbekannte Aktion ist ein Fehler des Laufs, kein Absturz
    assert.strictEqual((await lauf(['gibtsnicht'])).status, 'err');
    // Kreis im Knotenmodell: hoechstens 50 Schritte
    const kid = Number(db.prepare('INSERT INTO flow (titel, aktiv, ausloeser_json, knoten_json) VALUES (?,1,?,?)').run('K', '{}', JSON.stringify([
      { id: 't', typ: 'trigger', parameter: {}, outs: { weiter: 't' } }])).lastInsertRowid);
    const k = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(await d.lauf(kid, {}, {}));
    assert.strictEqual(k.status, 'err');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_schritt WHERE lauf_id = ?').get(k.id).n, 50);
  }


  // --- Task 2: Kandidaten und Tages-Scan -------------------------------------
  const mahnung = require('../../mahnung');
  const angebot = require('../../angebot');
  const CFG = { erinnerungNachTagen: 7, mahnung1NachTagen: 14, mahnung2NachTagen: 14 };
  // Rechnung 1.190 EUR, faellig 2026-10-01 (wie c11b).
  function rechnungMit(db, { nr = '2026-0001', faellig = '2026-10-01', status = 'erstellt', kontakt = null, empfaenger = '{}' } = {}) {
    db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis, empfaenger, aussteller, positionen,
      netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, status, faellig_am, kontakt_id)
      VALUES (?, 2026, ?, '2026-09-17', '2026-09-01', '2026-09-16', ?, '{}', '[]', 1190, 19, 0, 1190, 0, ?, ?, ?)`)
      .run(nr, Number(nr.split('-')[1]), empfaenger, status, faellig, kontakt);
    return nr;
  }
  const versandZeile = (db, bezug, { art = 'rechnung', test = 0, status = 'ok' } = {}) =>
    db.prepare("INSERT INTO versand (zeit, art, bezug, status, test) VALUES ('2026-09-17T10:00:00', ?, ?, ?, ?)").run(art, bezug, status, test);
  const scharf = (db, nr) => { rechnungMit(db, { nr }); versandZeile(db, nr); return nr; };
  const mahnZeile = (db, nr, stufe, am, status = 'gesendet', fehler = null) => db.prepare(`INSERT INTO mahnung (rechnung_nr, stufe, erstellt, frist, offen_eur,
    betreff, text, status, gesendet_am, kanal, fehler) VALUES (?, ?, ?, ?, 1190, 'b', 't', ?, ?, 'mail', ?)`).run(nr, stufe, am, am, status, status === 'gesendet' ? am : null, fehler);
  const nrs = (l) => l.map((k) => k.nr);
  // console.error abfangen: die Meldung wird geprueft statt ins Selfcheck-Protokoll geschrieben.
  async function stumm(f) {
    const alt = console.error, meldungen = [];
    console.error = (...a) => meldungen.push(a.map(String).join(' '));
    try { await f(); } finally { console.error = alt; }
    return meldungen;
  }

  function kandidatE10() {
    const db = neueDb(); rechnungMit(db);
    assert.deepStrictEqual(mahnung.kandidaten(db, '2026-12-01', { testmodus: false }, CFG), [], 'ohne scharfen Versand kein Kandidat');
    versandZeile(db, '2026-0001');
    assert.deepStrictEqual(mahnung.kandidaten(db, '2026-10-07', { testmodus: false }, CFG), []);
    assert.deepStrictEqual(mahnung.kandidaten(db, '2026-10-08', { testmodus: false }, CFG), [{ nr: '2026-0001', tage: 7, stufe_faellig: 1, faellig_am: '2026-10-08' }]);
    // nur Rechnung/ok zaehlt als Zustellung
    const d2 = neueDb(); rechnungMit(d2);
    versandZeile(d2, '2026-0001', { status: 'fehler' }); versandZeile(d2, '2026-0001', { art: 'angebot' }); versandZeile(d2, '2026-0001', { art: 'erinnerung' });
    assert.deepStrictEqual(mahnung.kandidaten(d2, '2026-12-01', { testmodus: false }, CFG), []);
  }

  function kandidatFristEinstellbar() {
    const db = neueDb(); scharf(db, '2026-0001');
    const c3 = { ...CFG, erinnerungNachTagen: 3 };
    assert.deepStrictEqual(mahnung.kandidaten(db, '2026-10-03', { testmodus: false }, c3), []);
    assert.deepStrictEqual(nrs(mahnung.kandidaten(db, '2026-10-04', { testmodus: false }, c3)), ['2026-0001']);
    assert.deepStrictEqual(mahnung.kandidaten(db, '2026-10-04', { testmodus: false }, CFG), []);
  }

  function kandidatTestmodus() {
    const db = neueDb(); rechnungMit(db); versandZeile(db, '2026-0001', { test: 1 });
    assert.deepStrictEqual(mahnung.kandidaten(db, '2026-11-01', { testmodus: false }, CFG), [], 'test=1 zaehlt ohne Testmodus nie');
    assert.deepStrictEqual(nrs(mahnung.kandidaten(db, '2026-11-01', { testmodus: true }, CFG)), ['2026-0001']);
    mahnZeile(db, '2026-0001', 1, '2026-11-01', 'test');
    assert.deepStrictEqual(mahnung.kandidaten(db, '2026-11-02', { testmodus: true }, CFG), [], 'Testmahnung derselben Stufe sperrt');
    // ohne Testmodus sperrt die Testzeile nicht
    const d2 = neueDb(); scharf(d2, '2026-0001'); mahnZeile(d2, '2026-0001', 1, '2026-11-01', 'test');
    assert.deepStrictEqual(nrs(mahnung.kandidaten(d2, '2026-11-02', { testmodus: false }, CFG)), ['2026-0001']);
    // naechsteStufe zaehlt weiter nur gesendet
    assert.deepStrictEqual(mahnung.naechsteStufe(d2, '2026-0001', '2026-11-02', CFG), { stufe: 1, faellig_ab: '2026-10-08' });
  }

  // Probelauf ohne Kandidat: jede ueberfaellige offene Rechnung nennt ihren Grund (Owner 04.11.).
  function kandidatGruende() {
    const db = neueDb();
    rechnungMit(db, { nr: '2026-0001' });                                                     // nie per Mail versendet
    rechnungMit(db, { nr: '2026-0002' }); versandZeile(db, '2026-0002', { test: 1 });         // nur Testversand
    mahnZeile(db, '2026-0002', 1, '2026-10-28', 'test');
    rechnungMit(db, { nr: '2026-0003', faellig: '2026-11-25' }); versandZeile(db, '2026-0003'); // noch nicht faellig: nicht gelistet
    scharf(db, '2026-0004');                                                                   // Kandidat: nicht gelistet
    rechnungMit(db, { nr: '2026-0005', faellig: '2026-11-15' }); versandZeile(db, '2026-0005'); // ueberfaellig, Erinnerung erst spaeter
    const aus = mahnung.ausgeschlossen(db, '2026-11-20', { testmodus: false }, CFG);
    assert.deepStrictEqual(aus, [
      { nr: '2026-0001', grund: 'nie per Mail aus c2invoice versendet' },
      { nr: '2026-0002', grund: 'nur als Test versendet, Testmodus ist aus' },
      { nr: '2026-0005', grund: 'Stufe 1 erst ab 2026-11-22 fällig' },
    ]);
    const tm = mahnung.ausgeschlossen(db, '2026-11-20', { testmodus: true }, CFG);
    assert.deepStrictEqual(tm.find((x) => x.nr === '2026-0002'), { nr: '2026-0002', grund: 'Testschreiben Stufe 1 schon verschickt (Testmodus: eins je Stufe)' });
    assert.deepStrictEqual(nrs(mahnung.kandidaten(db, '2026-11-20', { testmodus: false }, CFG)), ['2026-0004'], 'Kandidatenregel unveraendert');
    // Sperrgruende aus pruefe
    const d2 = neueDb(); scharf(d2, '2026-0001'); mahnZeile(d2, '2026-0001', 1, '2026-10-10', 'fehler', 'Zustellung unklar: x');
    assert.match(mahnung.ausgeschlossen(d2, '2026-11-20', { testmodus: false }, CFG)[0].grund, /unklar/i);
  }

  async function kandidatSperren() {
    const k = (vorbereite) => { const db = neueDb(); vorbereite(db); return mahnung.kandidaten(db, '2026-11-20', { testmodus: false }, CFG); };
    assert.deepStrictEqual(nrs(k((db) => scharf(db, '2026-0001'))), ['2026-0001'], 'Gegenprobe: ohne Sperre ein Kandidat');
    assert.deepStrictEqual(k((db) => { scharf(db, '2026-0001'); db.prepare("INSERT INTO zahlungen (rechnung_nr, datum, betrag_eur, erstellt_am) VALUES ('2026-0001','2026-10-05',1190,'x')").run(); }), [], 'bezahlt');
    assert.deepStrictEqual(k((db) => { scharf(db, '2026-0001'); db.prepare("UPDATE invoices SET status = 'storniert'").run(); }), [], 'storniert');
    assert.deepStrictEqual(k((db) => {
      const kt = require('../../kontakte').speichere(db, { firma: 'K', mahnpauseBis: '2026-11-20' }).id;
      rechnungMit(db, { kontakt: kt }); versandZeile(db, '2026-0001');
    }), [], 'Mahnpause bis heute');
    assert.deepStrictEqual(k((db) => { scharf(db, '2026-0001'); mahnZeile(db, '2026-0001', 1, '2026-10-10', 'fehler', 'Zustellung unklar: x'); }), [], 'unklar');
    assert.deepStrictEqual(k((db) => { scharf(db, '2026-0001'); [1, 2, 3].forEach((s) => mahnZeile(db, '2026-0001', s, '2026-10-0' + s)); }), [], 'ausgeschoepft');
    let heil;
    const m = await stumm(() => { heil = nrs(k((db) => { rechnungMit(db, { nr: '2026-0001', empfaenger: '{kaputt' }); versandZeile(db, '2026-0001'); scharf(db, '2026-0002'); })); });
    assert.deepStrictEqual(heil, ['2026-0002'], 'kaputte Rechnung bremst die anderen nicht');
    assert.strictEqual(m.length, 1);
    assert.match(m[0], /Mahnung-Kandidat 2026-0001/);
  }

  function kandidatNachholen() {
    const db = neueDb(); scharf(db, '2026-0001');
    mahnZeile(db, '2026-0001', 1, '2026-10-01');
    const l = mahnung.kandidaten(db, '2026-12-01', { testmodus: false }, CFG);
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].stufe_faellig, 2);
    assert.strictEqual(l[0].faellig_am, '2026-10-15');
  }

  // Zwei Rechnungen, die aeltere hat die hoehere Nummer.
  function zweiRechnungen(db) { scharf(db, '2026-0001'); db.prepare("UPDATE invoices SET faellig_am = '2026-10-05'").run(); scharf(db, '2026-0002'); }
  function kandidatReihenfolge() {
    const db = neueDb(); zweiRechnungen(db);
    assert.deepStrictEqual(nrs(mahnung.kandidaten(db, '2026-10-20', { testmodus: false }, CFG)), ['2026-0002', '2026-0001']);
  }

  const MONTAG = (std, min = 0) => new Date(2026, 10, 2, std, min);
  const TAG = (d, std = 10) => new Date(2026, 10, d, std, 0);
  function scanDienst(db, { status = { bereit: true, umgeleitet: false, heute: 0, grenze: 100 }, aktionen, cfgW = { mahnwesen: CFG }, uhr = JETZT } = {}) {
    return flows.erzeugeDienst({ db, aktionen, jetzt: uhr, mail: { status: () => status }, cfg: () => cfgW });
  }
  // Attrappe "sendet" die Erinnerung: danach ist die Rechnung kein Kandidat mehr.
  const sendeAttrappe = (log) => attrappe(log, (ctx) => { mahnZeile(ctx.db, ctx.eingang.nr, ctx.eingang.stufe_faellig, '2026-11-02'); return { ausgang: ctx.eingang }; });

  async function kandidatTagesgrenze() {
    const db = neueDb(); zweiRechnungen(db); const log = [];
    const d = scanDienst(db, { status: { bereit: true, umgeleitet: false, heute: 0, grenze: 1 }, aktionen: { s: sendeAttrappe(log) } });
    legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    assert.deepStrictEqual(await d.takt(MONTAG(9)), { kandidaten: 1 });
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0002'], 'die aelteste zuerst');
    await d.takt(TAG(3));
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0002', '2026-0001'], 'die andere am naechsten Werktag');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM freigabe').get().n, 0, 'ohne Karte');
  }

  function angebotMit(db, { nr = 'AN-2026-0001', bis = '2026-11-05T12:00:00', status = 'offen', versand = true } = {}) {
    db.prepare(`INSERT INTO angebote (nr, jahr, laufnr, erstellt_am, gueltig_bis, empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, status)
      VALUES (?, 2026, ?, '2026-10-06T10:00:00', ?, '{}', '{}', '[]', 100, 19, 19, 119, 0, ?)`).run(nr, Number(nr.slice(-4)), bis, status);
    if (versand) versandZeile(db, nr, { art: 'angebot' });
    return nr;
  }
  function nachfassenEinmal() {
    const o = { testmodus: false, tageVorAblauf: 3 };
    const db = neueDb(); angebotMit(db);
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-02', o), [{ nr: 'AN-2026-0001', tage: 3 }]);
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-01', o), [], 'noch 4 Tage');
    assert.strictEqual(angebot.kandidaten(db, '2026-11-01', { ...o, tageVorAblauf: 4 }).length, 1, 'Frist einstellbar');
    assert.strictEqual(angebot.kandidaten(db, '2026-11-05', o).length, 1, 'am letzten Gueltigkeitstag');
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-06', o), [], 'abgelaufen');
    versandZeile(db, 'AN-2026-0001', { art: 'nachfassen', test: 1 });
    assert.strictEqual(angebot.kandidaten(db, '2026-11-02', o).length, 1, 'Test-Nachfassen sperrt ohne Testmodus nicht');
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-02', { ...o, testmodus: true }), [], 'im Testmodus schon');
    versandZeile(db, 'AN-2026-0001', { art: 'nachfassen' });
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-02', o), [], 'einmal');
    const d2 = neueDb(); angebotMit(d2, { status: 'angenommen' });
    assert.deepStrictEqual(angebot.kandidaten(d2, '2026-11-02', o), []);
    const d3 = neueDb(); angebotMit(d3, { versand: false });
    assert.deepStrictEqual(angebot.kandidaten(d3, '2026-11-02', o), [], 'nie versendet');
    const d4 = neueDb(); angebotMit(d4, { versand: false }); versandZeile(d4, 'AN-2026-0001', { art: 'angebot', test: 1 });
    assert.deepStrictEqual(angebot.kandidaten(d4, '2026-11-02', o), []);
    assert.strictEqual(angebot.kandidaten(d4, '2026-11-02', { ...o, testmodus: true }).length, 1);
  }

  async function ausgeschoepftEinmal() {
    const db = neueDb(); scharf(db, '2026-0001');
    [1, 2, 3].forEach((s) => mahnZeile(db, '2026-0001', s, '2026-10-0' + s));
    assert.deepStrictEqual(mahnung.ausgeschoepft(db, '2026-10-03'), [], 'Frist der Stufe 3 noch nicht vorbei');
    assert.deepStrictEqual(mahnung.ausgeschoepft(db, '2026-10-04'), [{ nr: '2026-0001' }]);
    const d = scanDienst(db);
    await d.takt(MONTAG(9)); await d.takt(TAG(3));
    const k = db.prepare("SELECT * FROM freigabe WHERE art = 'mahnung_ausgeschoepft'").all();
    assert.strictEqual(k.length, 1);
    assert.strictEqual(k[0].bezug, '2026-0001');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow').get().n, 0, 'laeuft ohne aktiven Flow');
  }

  async function taktAusgeschoepftKaputt() {
    const db = neueDb(); const log = [];
    rechnungMit(db, { nr: '2026-0001', empfaenger: '{kaputt' }); mahnZeile(db, '2026-0001', 3, '2026-10-03');
    scharf(db, '2026-0002'); [1, 2, 3].forEach((s) => mahnZeile(db, '2026-0002', s, '2026-10-0' + s));
    scharf(db, '2026-0003');
    const d = scanDienst(db, { aktionen: { s: attrappe(log) } });
    legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    let r;
    const m = await stumm(async () => { r = await d.takt(MONTAG(9)); });
    assert.deepStrictEqual(r, { kandidaten: 1 });
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0003'], 'Kandidat laeuft trotz kaputter Stufe-3-Rechnung');
    assert.deepStrictEqual(db.prepare("SELECT bezug FROM freigabe WHERE art = 'mahnung_ausgeschoepft'").all().map((x) => x.bezug), ['2026-0002']);
    assert.ok(m.some((x) => /Mahnung-Ausgeschoepft 2026-0001/.test(x)));
  }

  function tageZwischenDirekt() {
    const z = require('../../rechnung').tageZwischen;
    assert.strictEqual(z('2026-10-01', '2026-10-01'), 0);
    assert.strictEqual(z('2026-10-01', '2026-10-08'), 7);
    assert.strictEqual(z('2026-10-08', '2026-10-01'), -7);
    assert.strictEqual(z('2026-12-30', '2027-01-02'), 3);
    assert.strictEqual(z('2028-02-28', '2028-03-01'), 2, 'Schaltjahr');
    assert.strictEqual(z('2026-03-28', '2026-03-30'), 2, 'Zeitumstellung Maerz');
    assert.strictEqual(z('2026-10-24', '2026-10-26'), 2, 'Zeitumstellung Oktober');
  }

  async function taktWerktag() {
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) } });
    legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    assert.strictEqual(await d.takt(TAG(7)), null, 'Samstag');
    assert.strictEqual(await d.takt(TAG(8)), null, 'Sonntag');
    assert.strictEqual(await d.takt(MONTAG(8, 59)), null);
    assert.strictEqual(log.length, 0);
    assert.deepStrictEqual(await d.takt(MONTAG(9)), { kandidaten: 1 });
    assert.strictEqual(await d.takt(MONTAG(9, 30)), null);
    assert.strictEqual(log.length, 1);
    // Schluessel allein haelt es auch ohne Tagesmarke bei einem Lauf je Rechnung
    db.prepare("DELETE FROM meta WHERE key = 'flows_scan_tag'").run();
    await d.takt(MONTAG(10));
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, 1);
    assert.strictEqual(db.prepare('SELECT schluessel FROM flow_lauf').get().schluessel, 'rechnung:2026-0001|2026-11-02');
    assert.strictEqual(log[0].eingang.stufe_faellig, 1);
    // Nachholen: Server war Di-Do aus, Fr laeuft der naechste Tag (nur naechste Stufe je Rechnung)
    mahnZeile(db, '2026-0001', 1, '2026-10-15');
    await d.takt(TAG(6));
    assert.strictEqual(log.length, 2);
    assert.strictEqual(log[1].eingang.stufe_faellig, 2);
  }

  async function taktNichtBereit() {
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const d = scanDienst(db, { status: { bereit: false, grund: 'mail.smtp.host fehlt', umgeleitet: false, heute: 0, grenze: 100 }, aktionen: { s: attrappe(log) } });
    legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    await d.takt(MONTAG(9)); await d.takt(TAG(3));
    assert.strictEqual(log.length, 0);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, 0);
    const k = db.prepare('SELECT * FROM freigabe').all();
    assert.strictEqual(k.length, 1);
    assert.deepStrictEqual([k[0].art, k[0].bezug, k[0].status], ['flow_fehler', 'versand-nicht-bereit', 'offen']);
    assert.match(k[0].text, /smtp\.host/);
  }

  async function taktEinKandidatKaputt() {
    const db = neueDb(); zweiRechnungen(db); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) } });
    // erster Flow: kaputtes knoten_json, lade() wirft; zweiter laeuft normal
    db.prepare("INSERT INTO flow (titel, aktiv, ausloeser_json, knoten_json) VALUES ('K', 1, ?, '{kaputt')").run(JSON.stringify({ art: 'rechnung_ueberfaellig' }));
    legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    let r;
    const m = await stumm(async () => { r = await d.takt(MONTAG(9)); });
    assert.deepStrictEqual(r, { kandidaten: 2 });
    assert.deepStrictEqual(log.map((c) => c.eingang.nr).sort(), ['2026-0001', '2026-0002']);
    assert.strictEqual(m.filter((x) => /^Flow-Scan rechnung:/.test(x)).length, 2);
  }

  async function taktAngebot() {
    const db = neueDb(); angebotMit(db, { bis: '2026-11-04T12:00:00' }); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) }, cfgW: { mahnwesen: CFG, angebot: { nachfassenTageVorAblauf: 2 } } });
    legeFlow(db, ['s'], { art: 'angebot_laeuft_ab' });
    await d.takt(MONTAG(9));
    assert.strictEqual(log.length, 1);
    assert.deepStrictEqual([log[0].eingang.nr, log[0].eingang.tage], ['AN-2026-0001', 2]);
  }

  // C2: "Versand nicht bereit" nur, wenn ein Scan-Flow aktiv ist, hoechstens eine Karte je Tag, zu, sobald der Versand bereit ist.
  async function nichtBereitEinmalJeTag() {
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const status = { bereit: false, grund: 'mail.smtp.host fehlt', umgeleitet: false, heute: 0, grenze: 100 };
    const d = scanDienst(db, { status, aktionen: { s: attrappe(log) } });
    const offen = () => db.prepare("SELECT * FROM freigabe WHERE bezug = 'versand-nicht-bereit' AND status = 'offen'").all();
    const alle = () => db.prepare("SELECT COUNT(*) n FROM freigabe WHERE bezug = 'versand-nicht-bereit'").get().n;
    d.setzeAktiv(legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' }), false);
    legeFlow(db, ['s'], { art: 'jira_status' });
    await d.takt(MONTAG(9));
    assert.strictEqual(alle(), 0, 'frische Installation, kein Scan-Flow aktiv: keine Karte');
    legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    await d.takt(MONTAG(10));
    assert.strictEqual(offen().length, 1);
    await freigaben.entscheide(db, offen()[0].id, { wahl: 'ablehnen' });
    await d.takt(MONTAG(10, 1)); await d.takt(MONTAG(11));
    assert.strictEqual(alle(), 1, 'weggeklickt: heute keine neue Karte');
    await d.takt(TAG(3));
    assert.strictEqual(offen().length, 1, 'am naechsten Werktag wieder');
    Object.assign(status, { bereit: true, grund: null });
    await d.takt(TAG(3, 11));
    assert.strictEqual(offen().length, 0, 'bereit: Karte zu');
    assert.strictEqual(log.length, 1, 'und der Scan laeuft');
  }

  // I1: ein pausierter Flow verbraucht kein Tageskontingent.
  async function pausiertVerbrauchtNichts() {
    const db = neueDb(); scharf(db, '2026-0001'); angebotMit(db); const log = [];
    const d = scanDienst(db, { status: { bereit: true, umgeleitet: false, heute: 0, grenze: 1 }, aktionen: { s: attrappe(log) } });
    d.setzeAktiv(legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' }), false);
    legeFlow(db, ['s'], { art: 'angebot_laeuft_ab' });
    assert.deepStrictEqual(await d.takt(MONTAG(9)), { kandidaten: 1 });
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['AN-2026-0001'], 'Nachfassen geht raus');
  }

  // I3: Laeufe tragen den Beleg als Betreff.
  async function betreffJeBeleg() {
    const { EventEmitter } = require('node:events');
    const db = neueDb(); scharf(db, '2026-0001'); angebotMit(db); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) } });
    for (const art of ['rechnung_ueberfaellig', 'angebot_laeuft_ab', 'jira_status']) legeFlow(db, ['s'], { art });
    await d.takt(MONTAG(9));
    const bus = new EventEmitter(), aus = flows.verbinde(d, bus);
    bus.emit('ereignis', { art: 'jira_status', daten: { key: 'ABC-1', nach: 'Fertig', kat: 'done' }, zeit: 'z' });
    await warte(30); aus();
    assert.deepStrictEqual(db.prepare('SELECT betreff FROM flow_lauf ORDER BY id').all().map((x) => x.betreff), ['Rechnung 2026-0001', 'Angebot AN-2026-0001', 'Vorgang ABC-1']);
  }

  // M3: Ablauf am Wochenende kommt am Freitag dran (der naechste Scan kaeme zu spaet); ein reines Datum ist ein Ortstag, kein UTC-Zeitpunkt.
  function nachfassenVorDemWochenende() {
    const o = { testmodus: false, tageVorAblauf: 1 };
    const db = neueDb(); angebotMit(db, { bis: '2026-11-08T12:00:00' }); // Sonntag
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-05', o), [], 'Donnerstag: noch zu frueh');
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-06', o), [{ nr: 'AN-2026-0001', tage: 2 }], 'Freitag: Montag waere abgelaufen');
    const d2 = neueDb(); angebotMit(d2, { bis: '2026-11-09T12:00:00' }); // Montag
    assert.deepStrictEqual(angebot.kandidaten(d2, '2026-11-06', o), [], 'Ablauf Montag: Freitag noch nicht');
    assert.strictEqual(angebot.kandidaten(d2, '2026-11-09', o).length, 1);
    const sys = Intl.DateTimeFormat().resolvedOptions().timeZone, alt = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const d3 = neueDb(); angebotMit(d3, { bis: '2026-11-04' });
      assert.deepStrictEqual(angebot.kandidaten(d3, '2026-11-03', o), [{ nr: 'AN-2026-0001', tage: 1 }], 'reines Datum, westlich von UTC');
    } finally { process.env.TZ = alt === undefined ? sys : alt; }
  }

  // M4: ein Fehler ausserhalb eines Kandidaten wird eine Karte je Tag, der Rest des Scans laeuft.
  async function scanFehlerKarte() {
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) } });
    legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' }); legeFlow(db, ['s'], { art: 'angebot_laeuft_ab' });
    db.exec('ALTER TABLE angebote RENAME TO angebote_weg');
    await stumm(async () => { await d.takt(MONTAG(9)); await d.takt(MONTAG(9, 1)); });
    const k = db.prepare("SELECT * FROM freigabe WHERE art = 'flow_fehler'").all();
    assert.deepStrictEqual(k.map((x) => [x.bezug, x.status]), [['scan:2026-11-02', 'offen']], 'eine Karte je Tag');
    assert.match(k[0].text, /angebote/);
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0001'], 'Mahnungen laufen trotzdem, einmal');
  }

  function stammdatenQuerpruefung() {
    configGeschuetzt(() => {
      const { setzeStammdaten } = require('../../server');
      const config = require('../../config.json');
      if (!config.rechnung) config.rechnung = {};
      config.angebot = { nachfassenTageVorAblauf: 5 };
      assert.throws(() => setzeStammdaten({ angebotGueltigTage: 5 }), /Nachfassen muss weniger Tage/);
      assert.throws(() => setzeStammdaten({ angebotGueltigTage: 4 }), /Nachfassen muss weniger Tage/);
      setzeStammdaten({ angebotGueltigTage: 6 });
      assert.strictEqual(config.rechnung.angebotGueltigTage, 6);
    });
  }

  function einstellungNachfassen() {
    configGeschuetzt(() => {
      const { setzeEinstellungen, EINSTELLUNGEN } = require('../../server');
      const config = require('../../config.json');
      assert.deepStrictEqual([EINSTELLUNGEN.nachfassenTageVorAblauf.standard, EINSTELLUNGEN.nachfassenTageVorAblauf.pfad], [3, 'angebot.nachfassenTageVorAblauf']);
      for (const w of [0, 61, 2.5, -1, 'x']) assert.throws(() => setzeEinstellungen({ nachfassenTageVorAblauf: w }), /Nachfassen|Tage|Zahl/, JSON.stringify(w));
      setzeEinstellungen({ nachfassenTageVorAblauf: 5 });
      assert.strictEqual(config.angebot.nachfassenTageVorAblauf, 5);
      if (!config.rechnung) config.rechnung = {};
      config.rechnung.angebotGueltigTage = 10;
      assert.throws(() => setzeEinstellungen({ nachfassenTageVorAblauf: 10 }), /Gültigkeit/);
      assert.throws(() => setzeEinstellungen({ nachfassenTageVorAblauf: 11 }), /Gültigkeit/);
      setzeEinstellungen({ nachfassenTageVorAblauf: 9 });
      assert.strictEqual(config.angebot.nachfassenTageVorAblauf, 9);
      assert.throws(() => setzeEinstellungen({ nachfassenTageVorAblauf: 10 }), /Gültigkeit/);
      assert.strictEqual(config.angebot.nachfassenTageVorAblauf, 9, 'abgelehnt aendert nichts');
    });
  }


  // --- Task 3: Aktionen, Vorlagen, Fehlerweg ----------------------------------
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const mailmod = require('../../mail');
  const freigaben = require('../../freigaben');
  const rechnungsmodul = require('../../rechnung');
  const KUNDE = 'kunde@example.org', TESTADR = 'test@example.org', MELDEADR = 'ich@example.org';
  // Echter Mail- und Mahndienst; nur Transport (kein Netz) und Druck (kein Chrome) sind Attrappen.
  // st.modus: ok | fehler (Server lehnt ab) | unklar (Mail kommt an, die Antwort bleibt aus).
  async function mitAktionen(opt, fn) {
    const db = neueDb();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-flowakt-'));
    const st = { modus: 'ok', mails: [], sende429: false, meldungKaputt: false,
      cfg: { smtp: { host: 'smtp.example.org', port: 465, sicher: 'tls', benutzer: 'a@example.org', passwortEnvVar: 'C2I_SMTP_PASSWORT' },
        absender: { name: 'Büro', adresse: 'a@example.org' }, transport: 'smtp', umleitenAn: opt.umleitenAn || '', tagesgrenze: opt.tagesgrenze || 100,
        benachrichtigungAn: opt.benachrichtigungAn || '' },
      jira: opt.jira || { enabled: true } };
    const pdf = (name) => { const p = path.join(tmp, name); fs.writeFileSync(p, '%PDF-attrappe ' + name); return p; };
    const echt = mailmod.erzeuge({ db, mailCfg: () => st.cfg, env: { C2I_SMTP_PASSWORT: 'x-geheim' }, versandOrdner: tmp, pdfFn: async (art, nr) => ({ nr, pdf: pdf(art + '-' + nr + '.pdf') }),
      transporte: { smtp: async (o) => {
        const meldung = o.an.includes(MELDEADR);
        if (meldung && st.meldungKaputt) throw new Error('550 Meldeadresse abgelehnt');
        if (st.modus === 'fehler' && !meldung) throw new Error('550 abgelehnt');
        if (st.halte) await st.halte;
        st.mails.push({ an: o.an, daten: o.daten.toString() });
        if (st.modus === 'unklar' && !meldung) throw Object.assign(new Error('Verbindung getrennt'), { unklar: true });
        return { antwort: '250 ok' };
      } } });
    // 429 so, wie mail.sende ihn wirft (Tagesgrenze, Fehlversuche), ohne die Zaehlung nachzubauen.
    const mailDienst = { ...echt, sende: (...a) => (st.sende429 ? Promise.reject(Object.assign(new Error('Tagesgrenze erreicht (1 Mails)'), { status: 429 })) : echt.sende(...a)) };
    const mahnDienst = mahnung.erzeugeDienst({ db, mailDienst, mahnCfg: () => ({ ...CFG, neueFristTage: 7, gebuehrStufe2Eur: 0 }), mailCfg: () => st.cfg, heute: () => '2026-11-02',
      ordner: path.join(tmp, 'mahnungen'),
      pdfFn: async (id, ziel) => { fs.mkdirSync(path.dirname(ziel), { recursive: true }); fs.writeFileSync(ziel, '%PDF-mahnung ' + id); return ziel; },
      rechnungPdfFn: async (n) => ({ nr: n, pdf: pdf('Rechnung-' + n + '.pdf') }) });
    const kid = opt.ohneMail ? null : Number(db.prepare("INSERT INTO kontakte (firma, email, erstellt_am) VALUES ('Kunde GmbH', ?, 'x')").run(KUNDE).lastInsertRowid);
    const nr = scharf(db, '2026-0001');
    db.prepare("UPDATE invoices SET kontakt_id = ?, erstellt_am = '2026-09-17T10:00:00.000Z'").run(kid);
    const aktionen = opt.aktionen || flows.erzeugeAktionen({ db, mahnDienst, mailDienst });
    const d = flows.erzeugeDienst({ db, aktionen, jetzt: JETZT, mail: mailDienst, cfg: () => ({ mahnwesen: CFG, mail: st.cfg, jira: st.jira, flows: opt.flows }) });
    d.vorlagenAnlegen();
    const f = Object.fromEntries(db.prepare('SELECT id, vorlage FROM flow').all().map((r) => [r.vorlage, r.id]));
    let n = 0;
    const eingang = (extra = {}) => ({ nr, tage: 32, stufe_faellig: 1, faellig_am: '2026-10-08', bezug: 'rechnung:' + nr, schluessel: 'k' + (++n), ...extra });
    const lauf = (id) => db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(id);
    try { await fn({ db, d, st, f, nr, eingang, lauf, mahnDienst, mailDienst, tmp }); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  const mahnLauf = async (d, e) => (await d.ausloesen('rechnung_ueberfaellig', e))[0];
  const karten = (db, art = 'flow_fehler') => db.prepare('SELECT * FROM freigabe WHERE art = ?').all(art);
  const meldungVon = (db, id, nr) => db.prepare('SELECT meldung FROM flow_schritt WHERE lauf_id = ? AND nr = ?').get(id, nr).meldung;

  async function aktionMahnungOk() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'ok', lauf(id).fehler);
      assert.deepStrictEqual(st.mails.map((m) => m.an), [[KUNDE]]);
      const m = db.prepare('SELECT * FROM mahnung').all();
      assert.deepStrictEqual(m.map((x) => [x.stufe, x.status]), [[1, 'gesendet']]);
      const s = db.prepare('SELECT * FROM flow_schritt WHERE lauf_id = ? AND nr = 2').get(id);
      assert.deepStrictEqual(JSON.parse(s.ausgang_json), { mahnung_id: m[0].id, stufe: 1 });
      assert.strictEqual(db.prepare("SELECT art FROM versand WHERE bezug = ? AND art <> 'rechnung'").get(nr).art, 'erinnerung');
      assert.strictEqual(mahnung.naechsteStufe(db, nr, '2026-11-02', CFG).stufe, 2);
      assert.strictEqual(karten(db).length, 0);
    });
  }

  async function aktionMahnungTest() {
    await mitAktionen({ umleitenAn: TESTADR }, async ({ db, d, st, f, nr, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'ok', lauf(id).fehler);
      assert.match(meldungVon(db, id, 2), /Test/);
      assert.deepStrictEqual(st.mails.map((m) => m.an), [[TESTADR]]);
      assert.deepStrictEqual(db.prepare('SELECT stufe, status FROM mahnung').all().map((x) => [x.stufe, x.status]), [[1, 'test']]);
      assert.strictEqual(mahnung.naechsteStufe(db, nr, '2026-11-02', CFG).stufe, 1, 'Testversand zaehlt nicht als Stufe');
    });
  }

  async function aktionTrockenlauf() {
    await mitAktionen({}, async ({ db, d, st, f, eingang, lauf }) => {
      const id = await d.lauf(f.ueberfaellig_mahnung, eingang(), { test: true });
      assert.strictEqual(lauf(id).status, 'skip', lauf(id).fehler);
      assert.match(meldungVon(db, id, 2), /Zahlungserinnerung.*kunde@example\.org/);
      assert.strictEqual(st.mails.length, 0);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 0);
    });
  }

  async function aktionMahnungBezahlt() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      rechnungsmodul.bucheZahlung(db, { nr, datum: '2026-11-01', betrag_eur: 1190 }); // nach dem Scan
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'skip');
      assert.match(meldungVon(db, id, 2), /bezahlt/);
      assert.strictEqual(st.mails.length, 0);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM freigabe').get().n, 0, 'keine Karte');
    });
  }

  async function aktionMahnungDoppelt() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      mahnZeile(db, nr, 1, '2026-11-02'); // von Hand gesendet, nach dem Scan
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'skip');
      assert.match(meldungVon(db, id, 2), /Stufe 1 bereits gesendet/);
      assert.strictEqual(st.mails.length, 0, 'Stufe 2 geht nicht an Stelle von Stufe 1 raus');
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 1);
    });
  }

  async function aktionMahnungOhneAn() {
    await mitAktionen({ ohneMail: true }, async ({ db, d, st, f, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'err');
      assert.match(lauf(id).fehler, /Keine Empfängeradresse/);
      assert.strictEqual(st.mails.length, 0);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 0, 'kein Entwurf auf Vorrat');
    });
  }

  async function aktionTagesgrenze() {
    await mitAktionen({ tagesgrenze: 1 }, async ({ db, d, st, f, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      db.prepare("INSERT INTO versand (zeit, art, bezug, status, test) VALUES (?, 'test', 'test', 'ok', 0)").run(new Date().toISOString()); // Grenze heute erreicht
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'warn', lauf(id).fehler);
      assert.match(meldungVon(db, id, 2), /Tagesgrenze/);
      assert.strictEqual(karten(db).length, 0, 'keine Karte');
      assert.strictEqual(st.mails.length, 0);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM mahnung').get().n, 0);
      // 429 erst beim Senden (z. B. Fehlversuche des Tages): ebenfalls warn
      st.cfg.tagesgrenze = 100; st.sende429 = true;
      const id2 = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id2).status, 'warn', lauf(id2).fehler);
      assert.strictEqual(karten(db).length, 0);
      // naechster Tag: derselbe Kandidat laeuft, die Stufe ist unveraendert
      st.sende429 = false;
      const id3 = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id3).status, 'ok', lauf(id3).fehler);
      assert.strictEqual(st.mails.length, 1);
    });
  }

  async function aktionSmtpFehler() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      assert.strictEqual(flows.fehlerAnzahl(db), 0);
      st.modus = 'fehler';
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'err');
      assert.match(lauf(id).fehler, /550 abgelehnt/);
      assert.strictEqual(lauf(id).fehler_schritt, 2);
      const k = karten(db);
      assert.strictEqual(k.length, 1);
      assert.strictEqual(k[0].status, 'offen');
      assert.match(k[0].text, /Schritt 2.*550 abgelehnt/);
      assert.deepStrictEqual(JSON.parse(k[0].nutzlast_json), { lauf_id: id, ab_schritt: 2 });
      assert.strictEqual(k[0].quelle, 'flow:' + f.ueberfaellig_mahnung);
      assert.strictEqual(flows.fehlerAnzahl(db), 1, 'zaehler.flows_fehler steigt');
      assert.strictEqual(mahnung.naechsteStufe(db, nr, '2026-11-02', CFG).stufe, 1, 'Stufe unveraendert');
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM mahnung WHERE status = 'gesendet'").get().n, 0);
    });
  }

  async function wiederholenUnklar() {
    await mitAktionen({}, async ({ st, d, f, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      st.modus = 'unklar';
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'err');
      assert.match(lauf(id).fehler, /Zustellung unklar/);
      st.modus = 'ok';
      const neu = await d.wiederholen(id, lauf(id).fehler_schritt);
      assert.strictEqual(lauf(neu).status, 'err', 'eine unklar zugestellte Mail geht nie von selbst ein zweites Mal raus');
      assert.match(lauf(neu).fehler, /unklar/);
      assert.strictEqual(st.mails.length, 1, 'der Test-Server sieht genau eine Mail');
    });
  }

  // P5: das Nachfassen geht ueber lauf_id + nr direkt an mail.sende; die Wiederholung ist eine neue Laufzeile,
  // der Schluessel muss der des ersten Laufs bleiben (wurzel_id), sonst ginge die unklar zugestellte Mail noch einmal raus.
  async function wiederholenWurzel() {
    await mitAktionen({}, async ({ db, d, st, f, lauf }) => {
      d.setzeAktiv(f.angebot_nachfassen, true);
      angebotMit(db, { versand: false });
      angebotVersand(db, KUNDE, '2026-10-07T10:00:00');
      st.modus = 'unklar';
      const id = (await d.ausloesen('angebot_laeuft_ab', { nr: 'AN-2026-0001', tage: 3, bezug: 'angebot:AN-2026-0001', schluessel: 'x1' }))[0];
      assert.strictEqual(lauf(id).status, 'err');
      st.modus = 'ok';
      const neu = await d.wiederholen(id, lauf(id).fehler_schritt);
      assert.notStrictEqual(neu, id);
      assert.strictEqual(lauf(neu).wurzel_id, id);
      assert.strictEqual(lauf(neu).status, 'err');
      assert.match(lauf(neu).fehler, /Zustellung unklar/);
      assert.strictEqual(st.mails.length, 1, 'keine zweite Mail');
      const z = db.prepare("SELECT lauf_id, nr, status FROM versand WHERE art = 'nachfassen'").all();
      assert.deepStrictEqual(z.map((x) => [x.lauf_id, x.nr, x.status]), [[id, 2, 'fehler']], 'Versand haengt an der Wurzel');
      // naechster Tag, neuer Kandidat: das unklar zugestellte Nachfassen aus dem alten Lauf sperrt auch ihn
      st.modus = 'ok';
      const tag2 = (await d.ausloesen('angebot_laeuft_ab', { nr: 'AN-2026-0001', tage: 2, bezug: 'angebot:AN-2026-0001', schluessel: 'x2' }))[0];
      assert.strictEqual(lauf(tag2).status, 'err');
      assert.match(lauf(tag2).fehler, /unklar zugestellt/);
      assert.strictEqual(st.mails.length, 1);
    });
  }

  async function wiederholenPerKarte() {
    await mitAktionen({}, async ({ db, d, st, f, eingang }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      st.modus = 'fehler';
      const id = await mahnLauf(d, eingang());
      const k = karten(db)[0];
      st.modus = 'ok';
      const r = await freigaben.entscheide(db, k.id, { wahl: 'ok' });
      assert.strictEqual(r.status, 'erledigt');
      const neu = db.prepare('SELECT * FROM flow_lauf WHERE id > ? ORDER BY id').all(id);
      assert.strictEqual(neu.length, 1);
      assert.deepStrictEqual([neu[0].status, neu[0].wurzel_id], ['ok', id]);
      assert.strictEqual(st.mails.length, 1);
      assert.strictEqual(flows.fehlerAnzahl(db), 0);
      // Hinweis-Karten bestaetigen sich ohne Wirkung
      freigaben.anlegen(db, { art: 'mahnung_ausgeschoepft', bezug: '2026-0001', titel: 'x', quelle: 'cira' });
      const h = karten(db, 'mahnung_ausgeschoepft')[0];
      assert.strictEqual((await freigaben.entscheide(db, h.id, { wahl: 'ok' })).status, 'erledigt');
      assert.strictEqual(st.mails.length, 1);
      // die Karte "Versand nicht bereit" hat keinen Lauf: Bestaetigen tut nichts
      freigaben.anlegen(db, { art: 'flow_fehler', bezug: 'versand-nicht-bereit', titel: 'y', quelle: 'cira' });
      const v = db.prepare("SELECT id FROM freigabe WHERE bezug = 'versand-nicht-bereit'").get();
      assert.strictEqual((await freigaben.entscheide(db, v.id, { wahl: 'ok' })).status, 'erledigt');
    });
  }


  async function aktionMahnungParallelVonHand() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf, mahnDienst }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      const v = mahnDienst.vorschau(nr);
      const m = await mahnDienst.erzeuge(nr, { stufe: 1, offen_eur: v.offen_eur, frist: v.frist });
      st.halte = new Promise((frei) => { st.frei = frei; });
      const hand = mahnDienst.sende(m.id, { an: [KUNDE] }); // haengt im Transport und haelt die Sperre
      const id = await mahnLauf(d, eingang());
      st.frei();
      assert.strictEqual(lauf(id).status, 'skip', lauf(id).fehler);
      assert.match(meldungVon(db, id, 2), /Versand läuft bereits/);
      await hand;
      assert.strictEqual(st.mails.length, 1, 'genau eine Mail');
      assert.strictEqual(karten(db).length, 0, 'keine Karte');
      assert.deepStrictEqual(db.prepare('SELECT status FROM mahnung').all().map((x) => x.status), ['gesendet'], 'kein verwaister Entwurf');
    });
  }

  async function aktionOhneStatusKeinWiederholen() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      db.exec("CREATE TRIGGER kaputt BEFORE UPDATE OF status ON mahnung BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
      let id;
      await stumm(async () => { id = await mahnLauf(d, eingang()); });
      assert.strictEqual(lauf(id).status, 'err');
      assert.strictEqual(st.mails.length, 1, 'die Mail ist raus');
      const k = karten(db);
      assert.strictEqual(k.length, 1);
      assert.deepStrictEqual(JSON.parse(k[0].nutzlast_json), { lauf_id: id, ab_schritt: 2, kein_retry: true }, 'Lauf zum Ansehen, kein Wiederholen');
      assert.match(k[0].text, /NICHT erneut senden/);
      assert.match(k[0].text, /Gesendet/);
      assert.doesNotMatch(k[0].text, /wiederholt den Lauf/);
      const vorher = db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n;
      assert.strictEqual((await freigaben.entscheide(db, k[0].id, { wahl: 'ok' })).status, 'erledigt');
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, vorher, 'startet keinen Lauf');
      assert.strictEqual(st.mails.length, 1);
      // Auch nach der bestaetigten Karte (und einem Neustart) darf die Route den Lauf nicht wiederholen: sonst ginge die Mahnung doppelt raus.
      assert.strictEqual(db.prepare('SELECT kein_retry FROM flow_lauf WHERE id = ?').get(id).kein_retry, 1);
      await assert.rejects(() => d.wiederholen(id, lauf(id).fehler_schritt), /nicht wiederholen/);
      await mitHttp(d, async (ruf) => {
        const g = await ruf('GET', '/api/flows/lauf/' + id);
        assert.deepStrictEqual([g.json.kein_retry, g.json.wiederholbar], [true, false]);
        const r = await ruf('POST', '/api/flows/lauf/' + id + '/wiederholen', { ab_schritt: lauf(id).fehler_schritt });
        assert.strictEqual(r.status, 409, r.text);
        assert.match(r.json.error, /Mail ist vermutlich schon raus/);
      });
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, vorher, 'kein neuer Lauf');
      assert.strictEqual(st.mails.length, 1, 'keine zweite Mail');
    });
  }

  // Task 4: unklar zugestellte Mahnung (Mail kam vielleicht an) klaeren, Status nach Absturz heilen (P6, P7).
  async function unklareMahnung(mahnDienst, st, nr) {
    st.modus = 'unklar';
    const v = mahnDienst.vorschau(nr);
    const m = await mahnDienst.erzeuge(nr, { stufe: 1, offen_eur: v.offen_eur, frist: v.frist });
    await mahnDienst.sende(m.id, { an: [KUNDE] });
    st.modus = 'ok';
    return m.id;
  }
  const statusEnde = (e) => e && e.status;

  async function klaerenGesendet() {
    await mitAktionen({}, async ({ db, st, nr, mahnDienst }) => {
      const id = await unklareMahnung(mahnDienst, st, nr);
      assert.match(mahnDienst.zeile(id).fehler, /^Zustellung unklar:/);
      const z = mahnDienst.klaere(id, 'gesendet');
      const v = db.prepare('SELECT * FROM versand WHERE schluessel = ?').get('mahnung-' + id);
      assert.deepStrictEqual([z.status, z.fehler, z.kanal, z.versand_id], ['gesendet', null, 'mail', v.id]);
      assert.deepStrictEqual([v.status, v.fehler], ['ok', null]);
      assert.strictEqual(z.gesendet_am, rechnungsmodul.tagNach(v.zeit, 0), 'Tag des Versuchs');
      const n = mahnung.naechsteStufe(db, nr, '2027-06-01', CFG);
      assert.deepStrictEqual([n.stufe, n.faellig_ab], [2, mahnung.plusTage(z.gesendet_am, 14)], 'naechste Stufe rechnet ab dem Versuchstag');
      assert.throws(() => mahnDienst.klaere(id, 'gesendet'), (e) => statusEnde(e) === 409, 'zweimal geht nicht');
    });
  }

  async function klaerenNichtGesendet() {
    await mitAktionen({}, async ({ db, st, nr, mahnDienst }) => {
      const id = await unklareMahnung(mahnDienst, st, nr);
      assert.strictEqual(mahnung.mahnStand(db, [nr], '2026-11-02', CFG)[nr].grund, 'unklar');
      const z = mahnDienst.klaere(id, 'nicht_gesendet');
      assert.strictEqual(z.status, 'fehler');
      assert.ok(z.fehler && !z.fehler.startsWith('Zustellung unklar:'), z.fehler);
      assert.strictEqual(z.unklar, false);
      const v = db.prepare("SELECT * FROM versand WHERE id = (SELECT versand_id FROM mahnung WHERE id = ?)").get(id);
      assert.deepStrictEqual([v.schluessel, v.lauf_id, v.nr, v.status], [null, null, null, 'fehler'], 'Schluessel frei');
      const s = mahnung.mahnStand(db, [nr], '2026-11-02', CFG)[nr];
      assert.deepStrictEqual([s.grund, s.naechste && s.naechste.stufe], [null, 1], 'Stufe wieder erzeugbar');
      // dieselbe Zeile geht jetzt noch einmal raus (gleicher Mail-Schluessel, jetzt frei)
      const r = await mahnDienst.sende(id, { an: [KUNDE] });
      assert.strictEqual(r.mahnung.status, 'gesendet');
    });
  }

  async function klaerenNurUnklar() {
    await mitAktionen({}, async ({ db, st, nr, mahnDienst }) => {
      const v = mahnDienst.vorschau(nr);
      const m = await mahnDienst.erzeuge(nr, { stufe: 1, offen_eur: v.offen_eur, frist: v.frist });
      for (const e of ['gesendet', 'nicht_gesendet']) assert.throws(() => mahnDienst.klaere(m.id, e), (x) => statusEnde(x) === 409, 'erzeugt ' + e);
      st.modus = 'fehler';
      await mahnDienst.sende(m.id, { an: [KUNDE] }).catch(() => {});
      assert.strictEqual(mahnDienst.zeile(m.id).status, 'fehler');
      for (const e of ['gesendet', 'nicht_gesendet']) assert.throws(() => mahnDienst.klaere(m.id, e), (x) => statusEnde(x) === 409, 'klarer Fehler ' + e);
      st.modus = 'ok';
      await mahnDienst.sende(m.id, { an: [KUNDE] });
      assert.strictEqual(mahnDienst.zeile(m.id).status, 'gesendet');
      for (const e of ['gesendet', 'nicht_gesendet']) assert.throws(() => mahnDienst.klaere(m.id, e), (x) => statusEnde(x) === 409, 'gesendet ' + e);
      assert.throws(() => mahnDienst.klaere(m.id, 'vielleicht'), (x) => statusEnde(x) === 400);
      assert.throws(() => mahnDienst.klaere('1', 'gesendet'), (x) => statusEnde(x) === 400);
      assert.throws(() => mahnDienst.klaere(9999, 'gesendet'), (x) => statusEnde(x) === 404);
    });
  }

  async function heileNachAbsturz() {
    await mitAktionen({}, async ({ db, mahnDienst }) => {
      // je Fall eine eigene Rechnung: derselbe Stufen-Index (rechnung, stufe) liesse eine zweite Heilung sonst am UNIQUE scheitern
      const fall = (nr, { test = 0, status = 'ok', zeit = '2026-10-30T10:00:00', schluessel = true, mahn = 'erzeugt' } = {}) => {
        rechnungMit(db, { nr });
        const id = Number(mahnZeile(db, nr, 1, '2026-10-30', mahn, mahn === 'fehler' ? 'Mail ging raus' : null).lastInsertRowid);
        db.prepare("INSERT INTO versand (zeit, art, bezug, an, status, test, schluessel) VALUES (?, 'mahnung1', ?, 'kunde@example.org', ?, ?, ?)")
          .run(zeit, nr, status, test, schluessel ? 'mahnung-' + id : 'fremd-' + id);
        return id;
      };
      const scharfId = fall('2026-0011', { zeit: '2026-10-30T22:30:00' });
      const ids = [fall('2026-0012', { test: 1 }), fall('2026-0013', { status: 'fehler' }), fall('2026-0014', { schluessel: false })];
      // Wiederholen einer fehler-Zeile: Mail raus, Status-UPDATE scheiterte -> nach Neustart darf keine zweite Mahnung rausgehen
      const fehlerId = fall('2026-0015', { mahn: 'fehler' });
      // fehler-Zeile, deren Stufe schon gesendet ist: bleibt, ohne Fehlerprotokoll
      const dopp = fall('2026-0016', { mahn: 'fehler' });
      mahnZeile(db, '2026-0016', 1, '2026-10-29', 'gesendet');
      let n;
      const log = await stumm(async () => { n = mahnDienst.heile(); });
      assert.strictEqual(n, 2);
      assert.deepStrictEqual(log, [], 'kein console.error');
      assert.deepStrictEqual([mahnDienst.zeile(fehlerId).status, mahnDienst.zeile(fehlerId).fehler, mahnDienst.zeile(dopp).status], ['gesendet', null, 'fehler']);
      const z = mahnDienst.zeile(scharfId);
      assert.deepStrictEqual([z.status, z.kanal, z.gesendet_am, z.an], ['gesendet', 'mail', rechnungsmodul.tagNach('2026-10-30T22:30:00', 0), 'kunde@example.org']);
      assert.ok(z.versand_id > 0);
      assert.deepStrictEqual(ids.map((i) => mahnDienst.zeile(i).status), ['erzeugt', 'erzeugt', 'erzeugt'], 'test=1, Fehlzeile und fremder Schluessel bleiben');
      assert.strictEqual(mahnDienst.heile(), 0, 'zweiter Lauf tut nichts');
      assert.strictEqual(mahnDienst.zeile(dopp).status, 'fehler');
    });
  }

  // I2: eine Fehlerkarte je Beleg (Bezug des Laufs), mit der Belegnummer im Titel; ein spaeterer Lauf, der durchlaeuft, schliesst sie.
  async function karteJeBeleg() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      st.modus = 'fehler';
      await mahnLauf(d, eingang());
      const b = await mahnLauf(d, eingang());
      const zuBeleg = () => karten(db).filter((k) => k.bezug === 'rechnung:' + nr);
      const offen = () => zuBeleg().filter((k) => k.status === 'offen');
      assert.strictEqual(offen().length, 1, 'zwei gescheiterte Laeufe zu einer Rechnung: eine Karte');
      assert.match(offen()[0].titel, /fehlgeschlagen: Rechnung 2026-0001$/);
      assert.deepStrictEqual(JSON.parse(offen()[0].nutzlast_json), { lauf_id: b, ab_schritt: 2 });
      // ohne Bezug: eine Karte je Wurzel-Lauf wie bisher
      const ohne = await d.lauf(f.ueberfaellig_mahnung, { nr }, {});
      assert.strictEqual(karten(db).filter((k) => k.bezug === 'lauf:' + ohne && k.status === 'offen').length, 1);
      // ein Probelauf schliesst nichts
      const t = await d.lauf(f.ueberfaellig_mahnung, eingang(), { test: true, bezug: 'rechnung:' + nr });
      assert.strictEqual(lauf(t).status, 'skip');
      assert.strictEqual(offen().length, 1);
      st.modus = 'ok';
      const c = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(c).status, 'ok', lauf(c).fehler);
      assert.deepStrictEqual(zuBeleg().map((k) => k.status), ['abgelehnt', 'erledigt'], 'spaeterer Lauf lief durch: Karte zu');
    });
  }

  // I4: ein gescheiterter Probelauf meldet sich nicht (Gate 9: ein Testlauf sendet nichts, auch keine Benachrichtigung).
  async function probelaufFehlerStill() {
    await mitAktionen({ benachrichtigungAn: MELDEADR, ohneMail: true }, async ({ db, d, st, f, eingang, lauf }) => {
      const id = await d.lauf(f.ueberfaellig_mahnung, eingang(), { test: true });
      assert.strictEqual(lauf(id).status, 'err');
      assert.match(lauf(id).fehler, /Keine Empfängeradresse/);
      assert.strictEqual(karten(db).length, 0, 'keine Karte');
      assert.strictEqual(st.mails.length, 0, 'keine Benachrichtigung');
    });
  }

  // M2: 409 "Zustellung unklar" im Flow: Wiederholen fuehrte wieder hierher, die Karte schickt in den Mahn-Dialog.
  async function unklarImFlowOhneWiederholen() {
    await mitAktionen({}, async ({ db, d, st, f, nr, eingang, lauf, mahnDienst }) => {
      await unklareMahnung(mahnDienst, st, nr);
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'err');
      assert.strictEqual(lauf(id).kein_retry, 1);
      const [k] = karten(db);
      assert.strictEqual(JSON.parse(k.nutzlast_json).kein_retry, true);
      assert.match(k.text, /im Dialog „Mahnen“ klären/);
      assert.doesNotMatch(k.text, /wiederholt den Lauf/);
      assert.strictEqual(st.mails.length, 1, 'nur der unklare Versuch von Hand');
    });
  }

  // M5: absolute Pfade verlassen den Server auch ueber Fehlermeldungen nicht; Laenge gekappt.
  async function redaktPfade() {
    const r = flows.redakt;
    assert.strictEqual(r("ENOENT: no such file or directory, open 'C:\\Users\\Erika Muster\\Dev\\x.pdf'"), "ENOENT: no such file or directory, open '<Pfad>'");
    assert.strictEqual(r('Chrome fehlt: C:\\Program Files\\Google\\chrome.exe nicht gefunden'), 'Chrome fehlt: <Pfad> nicht gefunden');
    assert.strictEqual(r('kaputt: /home/nutzer/c2i/data/a.pdf'), 'kaputt: <Pfad>');
    assert.strictEqual(r('\\\\server\\freigabe\\a.pdf fehlt'), '<Pfad> fehlt');
    for (const s of ['Keine Empfängeradresse für Rechnung 2026-0001 (Ansprechpartner oder Kontakt ohne E-Mail)', 'http://127.0.0.1:4747/mahnung/1 antwortet nicht',
      '550 5.1.1 Ansprechpartner/Kontakt unbekannt', 'Zustellung unklar — erst unter Gesendet prüfen', 'Schritt 2: 1/2 erledigt']) assert.strictEqual(r(s), s);
    assert.strictEqual(r('x'.repeat(900)).length, 500);
    const db = neueDb();
    const d = dienst(db, { a: { pruefe: () => '', fuehreAus: async () => { throw new Error("open 'C:\\Users\\Erika Muster\\geheim.pdf'"); } } });
    const id = await d.lauf(legeFlow(db, ['a']), {}, {});
    assert.strictEqual(db.prepare('SELECT fehler FROM flow_lauf WHERE id = ?').get(id).fehler, "open '<Pfad>'");
    assert.strictEqual(db.prepare('SELECT meldung FROM flow_schritt WHERE lauf_id = ? AND nr = 2').get(id).meldung, "open '<Pfad>'");
    assert.ok(!karten(db)[0].text.includes('Erika Muster'), karten(db)[0].text);
  }

  function angebotVersand(db, an, zeit, { test = 0, original = null } = {}) {
    db.prepare("INSERT INTO versand (zeit, art, bezug, an, an_original, status, test) VALUES (?, 'angebot', 'AN-2026-0001', ?, ?, 'ok', ?)").run(zeit, an, original, test);
  }
  async function nachfassenPdf() {
    await mitAktionen({}, async ({ db, d, st, f, lauf }) => {
      d.setzeAktiv(f.angebot_nachfassen, true);
      angebotMit(db, { versand: false });
      angebotVersand(db, 'alt@example.org', '2026-10-06T10:00:00');
      angebotVersand(db, KUNDE, '2026-10-07T10:00:00');
      angebotVersand(db, TESTADR, '2026-10-08T10:00:00', { test: 1, original: 'andere@example.org' });
      const id = (await d.ausloesen('angebot_laeuft_ab', { nr: 'AN-2026-0001', tage: 3, bezug: 'angebot:AN-2026-0001', schluessel: 'x1' }))[0];
      assert.strictEqual(lauf(id).status, 'ok', lauf(id).fehler);
      assert.deepStrictEqual(st.mails.map((m) => m.an), [[KUNDE]], 'letzter scharfer Versand');
      assert.match(st.mails[0].daten, /Angebot-AN-2026-0001\.pdf/);
      const v = db.prepare("SELECT * FROM versand WHERE art = 'nachfassen'").get();
      assert.deepStrictEqual([v.bezug, v.an, v.status, v.test, v.lauf_id, v.nr], ['AN-2026-0001', KUNDE, 'ok', 0, id, 2]);
      assert.strictEqual(v.betreff, 'Ihr Angebot AN-2026-0001 läuft am ' + rechnungsmodul.datum('2026-11-05T12:00:00') + ' ab');
      // einmal: ein zweiter Lauf von Hand tut nichts
      const zw = await d.lauf(f.angebot_nachfassen, { nr: 'AN-2026-0001', tage: 3 }, {});
      assert.strictEqual(lauf(zw).status, 'skip');
      assert.strictEqual(st.mails.length, 1);
    });
  }

  async function entwurfJeVorgang() {
    const config = require('../../config.json');
    const merk = { rechnung: config.rechnung, faktor: config.vergleichsFaktor, satz: config.stundensatz, saetze: config.projektSaetze, rundung: config.rundungMinuten };
    config.rechnung = { aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '', bank: 'Testbank', iban: 'DE00 0000 0000 0000 0000 00', bic: 'TESTDEFF' },
      kleinunternehmer: true, ustSatz: 19, zahlungszielTage: 14, chromePfad: '' };
    config.vergleichsFaktor = 0; config.stundensatz = 85; config.projektSaetze = {}; config.rundungMinuten = 5;
    try {
      await mitAktionen({}, async ({ db, d, f, lauf }) => {
        const P = 'Konto-Projekt', tag = '2026-08-18', T = 'ABC-1';
        const ein = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
        for (let m = 0; m <= 180; m += 2) ein.run('s-' + tag, new Date(Date.parse(tag + 'T08:00:00Z') + m * 60000).toISOString(), P, 'main', T, tag);
        db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
          VALUES (?,?,?,?,?,?,?,10,10,0,0,0,0,0.1,0,?)`).run('r-' + tag, tag + 'T08:00:00.000Z', 's-' + tag, P, 'main', T, 'claude-opus-5', tag);
        const kid = Number(db.prepare("INSERT INTO kontakte (firma, email, erstellt_am) VALUES ('Kunde', 'a@example.org', 'x')").run().lastInsertRowid);
        require('../../kontakte').setzeProjekte(db, kid, [P]);
        d.setzeAktiv(f.rechnung_entwurf, true);
        const e = (extra = {}) => ({ key: T, vorgang: T, von: 'In Arbeit', nach: 'Fertig', kat: 'done', ...extra });
        const id1 = (await d.ausloesen('jira_status', e({ schluessel: 'a' })))[0];
        assert.strictEqual(lauf(id1).status, 'ok', lauf(id1).fehler);
        const offen = () => db.prepare("SELECT * FROM freigabe WHERE art = 'rechnung' ORDER BY id").all();
        assert.deepStrictEqual(offen().map((x) => [x.quelle, x.bezug, x.status]), [['flow:' + f.rechnung_entwurf, T, 'offen']]);
        const id2 = (await d.ausloesen('jira_status', e({ schluessel: 'b' })))[0];
        assert.strictEqual(lauf(id2).status, 'ok');
        assert.deepStrictEqual(offen().map((x) => x.status), ['abgelehnt', 'offen'], 'zweiter Lauf ersetzt die offene Freigabe');
        assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM invoices WHERE nr <> '2026-0001'").get().n, 0, 'stellt nie selbst');
        // nichts offen / unbekannter Vorgang: warn mit dem Antworttext, keine Karte
        const vor = offen().length;
        const id3 = (await d.ausloesen('jira_status', e({ key: 'ZZZ-9', vorgang: 'ZZZ-9', schluessel: 'c' })))[0];
        assert.strictEqual(lauf(id3).status, 'warn');
        assert.match(meldungVon(db, id3, 3), /ZZZ-9.*kenne ich nicht/);
        assert.strictEqual(offen().length, vor);
        assert.strictEqual(karten(db).length, 0);
      });
    } finally { Object.assign(config, { rechnung: merk.rechnung, vergleichsFaktor: merk.faktor, stundensatz: merk.satz, projektSaetze: merk.saetze, rundungMinuten: merk.rundung }); }
  }

  async function f3NurDone() {
    const log = [];
    await mitAktionen({ aktionen: { rechnung_entwurf: attrappe(log) } }, async ({ db, d, f, lauf }) => {
      d.setzeAktiv(f.rechnung_entwurf, true);
      const e = (kat, s) => ({ key: 'ABC-1', vorgang: 'ABC-1', von: 'a', nach: 'b', kat, schluessel: s });
      const id = (await d.ausloesen('jira_status', e('indeterminate', 'a')))[0];
      assert.strictEqual(lauf(id).status, 'skip');
      assert.deepStrictEqual(db.prepare('SELECT node_id, status FROM flow_schritt WHERE lauf_id = ? ORDER BY nr').all(id).map((s) => [s.node_id, s.status]), [['t', 'ok'], ['c', 'ok']]);
      assert.strictEqual(log.length, 0);
      const ok = (await d.ausloesen('jira_status', e('done', 'b')))[0];
      assert.strictEqual(lauf(ok).status, 'ok');
      assert.strictEqual(log.length, 1);
    });
  }

  async function vorlagenPausiert() {
    const db = neueDb();
    const d = flows.erzeugeDienst({ db, aktionen: {} });
    assert.strictEqual(d.vorlagenAnlegen(), 3);
    const l = d.liste();
    assert.strictEqual(l.length, 3);
    assert.deepStrictEqual(l.map((x) => x.aktiv), [0, 0, 0], 'alle pausiert');
    assert.deepStrictEqual(l.map((x) => JSON.parse(x.ausloeser_json).art), ['rechnung_ueberfaellig', 'angebot_laeuft_ab', 'jira_status']);
    // feste Titel der Vorlagen: kein Projekt-, Kunden- oder Mockup-Name (die Titel sind veroeffentlicht)
    assert.deepStrictEqual(l.map((x) => x.titel), ['Überfällige Rechnung → Mahnung', 'Angebot läuft ab → Nachfassen', 'Vorgang erledigt → Rechnungsentwurf']);
    // zweiter Start, auch mit neuem Dienst: nichts neu angelegt, ein geloeschter Flow bleibt weg
    db.prepare('DELETE FROM flow WHERE id = 1').run();
    assert.strictEqual(flows.erzeugeDienst({ db, aktionen: {} }).vorlagenAnlegen(), 0);
    assert.strictEqual(d.liste().length, 2);
    // pausiert heisst: ein Ereignis startet nichts
    assert.deepStrictEqual(await d.ausloesen('angebot_laeuft_ab', { nr: 'x', schluessel: 'k' }), []);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, 0);
  }

  async function f3OhneJira() {
    await mitAktionen({ jira: { enabled: false } }, async ({ db, d, f }) => {
      assert.throws(() => d.setzeAktiv(f.rechnung_entwurf, true), (e) => e.status === 409 && /Jira/.test(e.message));
      assert.strictEqual(db.prepare('SELECT aktiv FROM flow WHERE id = ?').get(f.rechnung_entwurf).aktiv, 0);
      assert.strictEqual(d.setzeAktiv(f.ueberfaellig_mahnung, true), true, 'die anderen Vorlagen brauchen kein Jira');
      assert.strictEqual(d.setzeAktiv(f.rechnung_entwurf, false), true, 'ausschalten geht immer');
    });
    await mitAktionen({}, async ({ d, f }) => { assert.strictEqual(d.setzeAktiv(f.rechnung_entwurf, true), true); });
  }

  async function benachrichtigungMail() {
    await mitAktionen({ benachrichtigungAn: MELDEADR }, async ({ db, d, st, f, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      st.modus = 'fehler';
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'err');
      const meld = () => db.prepare("SELECT * FROM versand WHERE art = 'benachrichtigung'").all();
      assert.deepStrictEqual(meld().map((x) => [x.schluessel, x.an, x.status]), [['flow-fehler-' + id, MELDEADR, 'ok']]);
      assert.deepStrictEqual(st.mails.map((m) => m.an), [[MELDEADR]]);
      // Wiederholung scheitert wieder: dieselbe Wurzel, keine zweite Mail
      const neu = await d.wiederholen(id, 2);
      assert.strictEqual(lauf(neu).status, 'err');
      assert.strictEqual(meld().length, 1);
      assert.strictEqual(st.mails.length, 1);
    });
    // Die Meldung scheitert: Lauf und Karte bleiben, wie sie sind; der Fehlschlag steht im Protokoll
    await mitAktionen({ benachrichtigungAn: MELDEADR }, async ({ db, d, st, f, eingang, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      st.modus = 'fehler'; st.meldungKaputt = true;
      let id;
      const m = await stumm(async () => { id = await mahnLauf(d, eingang()); });
      assert.strictEqual(lauf(id).status, 'err');
      assert.match(lauf(id).fehler, /550 abgelehnt/);
      assert.strictEqual(karten(db).length, 1);
      assert.ok(m.some((x) => /Benachrichtigung/.test(x) && /Meldeadresse abgelehnt/.test(x)), m.join('|'));
    });
    // ohne Adresse keine Mail
    await mitAktionen({}, async ({ db, d, st, f, eingang }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      st.modus = 'fehler';
      await mahnLauf(d, eingang());
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM versand WHERE art = 'benachrichtigung'").get().n, 0);
    });
  }

  // C1: Absturz mitten im Versand. mail.sende schreibt `versand` erst nach SMTP; ein haengender Aktionsschritt ist also
  // vielleicht beim Kunden. Kein Wiederholen, und der Tages-Scan laesst den Beleg aus, bis die Karte bestaetigt ist.
  async function abbruchImVersand() {
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) } });
    const fid = legeFlow(db, ['s'], { titel: 'Abgebrochen', art: 'rechnung_ueberfaellig' });
    const haengt = (bezug, typ, test = 0) => {
      const id = Number(db.prepare("INSERT INTO flow_lauf (flow_id, start, status, bezug, test) VALUES (?, ?, 'laeuft', ?, ?)").run(fid, JETZT(), bezug, test).lastInsertRowid);
      db.prepare('UPDATE flow_lauf SET wurzel_id = id WHERE id = ?').run(id);
      db.prepare("INSERT INTO flow_schritt (lauf_id, nr, node_id, typ, status) VALUES (?, 1, 't', 'trigger', ?)").run(id, typ === 'trigger' ? 'laeuft' : 'ok');
      if (typ === 'action') db.prepare("INSERT INTO flow_schritt (lauf_id, nr, node_id, typ, status) VALUES (?, 2, 'a0', 'action', 'laeuft')").run(id);
      return id;
    };
    const imVersand = haengt('rechnung:2026-0001', 'action'), amStart = haengt('rechnung:2026-0009', 'trigger'), probe = haengt('rechnung:2026-0008', 'action', 1);
    const aus = d.aufraeumen();
    assert.deepStrictEqual(aus, [{ id: imVersand, fehler_schritt: 2, ohneWiederholen: true }, { id: amStart, fehler_schritt: 1, ohneWiederholen: false },
      { id: probe, fehler_schritt: 2, ohneWiederholen: false }]);
    for (const l of aus) await d.meldeFehler(l.id, l);
    const k = (b) => db.prepare("SELECT * FROM freigabe WHERE art = 'flow_fehler' AND bezug = ? ORDER BY id").all(b);
    const [v] = k('rechnung:2026-0001');
    assert.deepStrictEqual(JSON.parse(v.nutzlast_json), { lauf_id: imVersand, ab_schritt: 2, kein_retry: true }, 'Karte ohne Wiederholen');
    assert.match(v.text, /Server wurde während des Laufs beendet/);
    assert.match(v.text, /NICHT erneut senden/); assert.match(v.text, /Gesendet-Ordner/); assert.doesNotMatch(v.text, /wiederholt den Lauf/);
    assert.strictEqual(db.prepare('SELECT kein_retry FROM flow_lauf WHERE id = ?').get(imVersand).kein_retry, 1, 'auch die Route verweigert');
    await assert.rejects(() => d.wiederholen(imVersand, 2), /nicht wiederholen/);
    assert.deepStrictEqual(JSON.parse(k('rechnung:2026-0009')[0].nutzlast_json), { lauf_id: amStart, ab_schritt: 1 }, 'vor der Aktion haengen geblieben: Wiederholen bleibt');
    assert.strictEqual(k('rechnung:2026-0008').length, 0, 'Probelauf: keine Karte (I4)');
    // Der Tages-Scan laesst den Beleg aus, solange die Karte offen ist ...
    assert.deepStrictEqual(await d.takt(MONTAG(9)), { kandidaten: 0 });
    assert.strictEqual(log.length, 0, 'kein zweiter Brief');
    await d.meldeFehler(imVersand);
    const offen = k('rechnung:2026-0001').filter((x) => x.status === 'offen');
    assert.strictEqual(offen.length, 1, 'ersetzt statt zu verdoppeln');
    // ... nach dem Bestaetigen wieder; Bestaetigen selbst startet nichts
    assert.strictEqual((await freigaben.entscheide(db, offen[0].id, { wahl: 'ok' })).status, 'erledigt');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf WHERE id > ?').get(probe).n, 0, 'Bestaetigen startet keinen Lauf');
    await d.takt(TAG(3));
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0001']);
  }

  // C1 (3): der Server stirbt im SMTP-Gespraech einer Mahnung. Nach dem Neustart ist sie "Zustellung unklar" und P6 klaert sie;
  // ohne Marke bliebe sie `erzeugt`, und der naechste Scan schickte die Stufe ein zweites Mal.
  async function abbruchMahnungUnklar() {
    await mitAktionen({}, async ({ db, st, nr, mahnDienst, mailDienst }) => {
      const v = mahnDienst.vorschau(nr);
      const m = await mahnDienst.erzeuge(nr, { stufe: 1, offen_eur: v.offen_eur, frist: v.frist });
      // Ein Wurf aus mail.sende heisst: nichts ging raus. Die Zeile bleibt, wie sie war.
      st.sende429 = true;
      await assert.rejects(() => mahnDienst.sende(m.id, { an: [KUNDE] }), (e) => e.status === 429);
      assert.deepStrictEqual([mahnDienst.zeile(m.id).status, mahnDienst.zeile(m.id).fehler], ['erzeugt', null]);
      st.sende429 = false;
      // Der Transport antwortet nicht: der Prozess stirbt mittendrin. Am Ende frei, sonst hielte die Sperre in mail.js (je Prozess) spaetere Tests auf.
      let frei; st.halte = new Promise((ok) => { frei = ok; });
      const tot = mahnDienst.sende(m.id, { an: [KUNDE] });
      try {
        await warte(20);
        assert.strictEqual(mahnung.mahnStand(db, [nr], '2026-11-02', CFG)[nr].grund, null, 'waehrend des Versands nicht unklar (die Sperre im Speicher haelt)');
        const neu = mahnung.erzeugeDienst({ db, mailDienst, heute: () => '2026-11-02' }); // Neustart
        assert.strictEqual(neu.heile(), 1);
        const z = neu.zeile(m.id);
        assert.deepStrictEqual([z.status, z.unklar, z.fehler], ['fehler', true, 'Zustellung unklar: Server während des Versands beendet']);
        assert.strictEqual(mahnung.mahnStand(db, [nr], '2026-11-02', CFG)[nr].grund, 'unklar', 'Stufe gesperrt');
        assert.deepStrictEqual(mahnung.kandidaten(db, '2026-11-02', {}, CFG), [], 'kein Scan-Kandidat');
        assert.strictEqual(neu.heile(), 0, 'zweiter Lauf tut nichts');
        assert.strictEqual(neu.klaere(m.id, 'gesendet').status, 'gesendet', 'P6 greift');
      } finally { st.halte = null; frei(); await tot.catch(() => {}); }
    });
  }

  // M1: beim Start erst heilen, dann abgebrochene Laeufe melden; die Meldung blockiert den Start nicht.
  function startReihenfolge() {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    const h = src.indexOf('mahnDienst.heile()'), a = src.indexOf('flowDienst.aufraeumen()');
    assert.ok(h > 0 && a > h, 'heile() vor aufraeumen()');
    assert.doesNotMatch(src, /await flowDienst\.meldeFehler/);
  }

  async function busHoerer() {
    const { EventEmitter } = require('node:events');
    const bus = new EventEmitter();
    const db = neueDb(); const log = [];
    const d = dienst(db, { a: attrappe(log) });
    legeFlow(db, ['a'], { art: 'jira_status' });
    const aus = flows.verbinde(d, bus);
    bus.emit('ereignis', { art: 'zaehler', daten: {}, zeit: 'z0' });
    bus.emit('ereignis', { art: 'jira_status', daten: { key: 'ABC-1', von: 'a', nach: 'Fertig', kat: 'done' }, zeit: 'z1' });
    bus.emit('ereignis', { art: 'jira_status', daten: { key: 'ABC-1', von: 'a', nach: 'Fertig', kat: 'done' }, zeit: 'z1' });
    await warte(50);
    assert.strictEqual(log.length, 1, 'ein Ereignis, ein Lauf');
    assert.deepStrictEqual([log[0].eingang.vorgang, log[0].eingang.kat], ['ABC-1', 'done']);
    aus();
    bus.emit('ereignis', { art: 'jira_status', daten: { key: 'ABC-2', nach: 'x' }, zeit: 'z2' });
    await warte(30);
    assert.strictEqual(log.length, 1, 'abgemeldet');
    // ein kaputter Dienst darf den Sender nie treffen
    const boese = { ausloesen: () => Promise.reject(new Error('Flow kaputt')) };
    flows.verbinde(boese, bus);
    const m = await stumm(async () => {
      assert.doesNotThrow(() => bus.emit('ereignis', { art: 'jira_status', daten: { key: 'ABC-3', nach: 'x' }, zeit: 'z3' }));
      await warte(30);
    });
    assert.ok(m.some((x) => /jira_status.*Flow kaputt/.test(x)), m.join('|'));
  }

  function jiraStatusTraegtKat() {
    const q = fs.readFileSync(path.join(__dirname, '..', '..', 'board.js'), 'utf8');
    const alle = q.match(/sende\('jira_status', \{[^}]*\}\)/g) || [];
    assert.strictEqual(alle.length, 2);
    for (const z of alle) assert.match(z, /kat: i\.statusKat/, z);
  }


  // ---- Task 5: Routen und Verdrahtung ----
  // Mini-Server mit denselben Hilfen wie server.js (sendJson, leseKoerper); der Geraeteschutz ist ein eigener Test.
  async function mitHttp(d, fn) {
    const http = require('node:http');
    const sendJson = (res, data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    const leseKoerper = (req, fertig) => { let r = ''; req.on('data', (c) => { r += c; }); req.on('end', () => { try { fertig(null, JSON.parse(r || '{}')); } catch { fertig('Ungültiges JSON'); } }); };
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      if (!d.routen(req, res, u.pathname, u, { sendJson, leseKoerper })) { res.writeHead(404); res.end(); }
    });
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
    const basis = 'http://127.0.0.1:' + srv.address().port;
    const ruf = async (m, p, b) => {
      const r = await fetch(basis + p, { method: m, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* kein JSON */ }
      return { status: r.status, text, json };
    };
    try { await fn(ruf); } finally { srv.closeAllConnections(); await new Promise((ok) => srv.close(ok)); }
  }

  async function routeGrenzen() {
    await mitAktionen({}, async ({ d, f }) => {
      await mitHttp(d, async (ruf) => {
        const id = f.ueberfaellig_mahnung;
        for (const [m, p, b] of [
          ['GET', '/api/flows/abc'], ['GET', '/api/flows/1x/kandidaten'], ['GET', '/api/flows/lauf/abc'],
          ['GET', '/api/flows/laeufe?filter=alles'], ['GET', '/api/flows/laeufe?flow=abc'],
          ['POST', '/api/flows/abc/aktiv', { aktiv: true }], ['POST', '/api/flows/' + id + '/aktiv', { aktiv: 'ja' }], ['POST', '/api/flows/' + id + '/aktiv', {}],
          ['POST', '/api/flows/' + id + '/test', { vorgang: 'a b' }], ['POST', '/api/flows/lauf/abc/wiederholen', { ab_schritt: 1 }],
        ]) { const r = await ruf(m, p, b); assert.strictEqual(r.status, 400, m + ' ' + p + ' -> ' + r.status + ' ' + r.text); assert.ok(r.json.error); }
        assert.strictEqual((await ruf('GET', '/api/flows/9999')).status, 404);
        assert.strictEqual((await ruf('GET', '/api/flows/lauf/9999')).status, 404);
        assert.strictEqual((await ruf('POST', '/api/flows/9999/aktiv', { aktiv: true })).status, 404);
        // Keine Anlege-/Aendern-/Loesch-Route (Owner P2).
        for (const m of ['POST', 'PUT', 'DELETE']) assert.strictEqual((await ruf(m, '/api/flows', {})).status, 404, m + ' /api/flows');
        assert.strictEqual((await ruf('DELETE', '/api/flows/' + id)).status, 404);
        // Gueltig geht durch.
        assert.strictEqual((await ruf('GET', '/api/flows/laeufe?filter=fehler')).status, 200);
        const an = await ruf('POST', '/api/flows/' + id + '/aktiv', { aktiv: true });
        assert.strictEqual(an.status, 200); assert.strictEqual(an.json.aktiv, true);
        assert.strictEqual((await ruf('GET', '/api/flows/' + id)).json.aktiv, 1);
        assert.strictEqual((await ruf('GET', '/api/flows')).json.flows.length, 3);
      });
    });
  }

  async function routeWiederholen() {
    await mitAktionen({}, async ({ db, d, st, f, lauf }) => {
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      st.modus = 'unklar';
      const alt = await mahnLauf(d, { nr: '2026-0001', tage: 32, stufe_faellig: 1, faellig_am: '2026-10-08', bezug: 'rechnung:2026-0001', schluessel: 'r1' });
      assert.strictEqual(lauf(alt).status, 'err');
      const n = db.prepare('SELECT COUNT(*) AS n FROM flow_schritt WHERE lauf_id = ?').get(alt).n;
      await mitHttp(d, async (ruf) => {
        for (const ab of [0, n + 1, 1.5, '2', null]) {
          const r = await ruf('POST', '/api/flows/lauf/' + alt + '/wiederholen', { ab_schritt: ab });
          assert.strictEqual(r.status, 400, 'ab_schritt ' + ab + ' -> ' + r.status);
        }
        assert.strictEqual((await ruf('POST', '/api/flows/lauf/9999/wiederholen', { ab_schritt: 1 })).status, 404);
        // R9: unklare Zustellung wird in den neuen Lauf geschrieben, die Route antwortet mit dessen Id und Status.
        const r = await ruf('POST', '/api/flows/lauf/' + alt + '/wiederholen', { ab_schritt: lauf(alt).fehler_schritt });
        assert.strictEqual(r.status, 200, r.text);
        assert.ok(r.json.id > alt); assert.strictEqual(r.json.status, 'err'); assert.match(r.json.fehler, /unklar/);
        assert.strictEqual(lauf(r.json.id).status, 'err');
        assert.strictEqual(st.mails.length, 1, 'keine zweite Mail');
        // wiederholbar: der alte Lauf hat jetzt einen Nachfolger; der neue traf die Sperre "Zustellung unklar" (409) und bietet kein Wiederholen an (M2)
        assert.deepStrictEqual((await ruf('GET', '/api/flows/lauf/' + alt)).json.wiederholbar, false, 'Nachfolger vorhanden');
        assert.deepStrictEqual(((j) => [j.wiederholbar, j.kein_retry])((await ruf('GET', '/api/flows/lauf/' + r.json.id)).json), [false, true]);
        assert.deepStrictEqual((await ruf('GET', '/api/flows/laeufe')).json.laeufe.map((x) => [x.id, x.wiederholbar]), [[r.json.id, false], [alt, false]]);
        // ein klarer Fehler ohne Nachfolger bleibt wiederholbar
        st.modus = 'fehler';
        db.prepare('UPDATE mahnung SET fehler = NULL').run();
        const klar = await mahnLauf(d, { nr: '2026-0001', tage: 32, stufe_faellig: 1, faellig_am: '2026-10-08', bezug: 'rechnung:2026-0001', schluessel: 'r2' });
        assert.strictEqual((await ruf('GET', '/api/flows/lauf/' + klar)).json.wiederholbar, true, lauf(klar).fehler);
        // Nur gescheiterte Laeufe lassen sich wiederholen.
        db.prepare("UPDATE flow_lauf SET status = 'ok' WHERE id = ?").run(alt);
        assert.strictEqual((await ruf('POST', '/api/flows/lauf/' + alt + '/wiederholen', { ab_schritt: 1 })).status, 409);
      });
    });
  }

  async function routeKandidaten() {
    await mitAktionen({}, async ({ db, d, f }) => {
      await mitHttp(d, async (ruf) => {
        const m = await ruf('GET', '/api/flows/' + f.ueberfaellig_mahnung + '/kandidaten');
        assert.deepStrictEqual(m.json, { art: 'rechnung_ueberfaellig', anzahl: 1, scan_sofort: true }, 'Werktag nach 9 Uhr, heute noch nicht gescannt');
        // Der Server sagt, ob der Tagesscan heute schon lief: dann geht nichts binnen einer Minute raus.
        require('../../db').setMeta(db, 'flows_scan_tag', rechnungsmodul.tagNach(new Date(JETZT()), 0));
        assert.strictEqual((await ruf('GET', '/api/flows/' + f.ueberfaellig_mahnung + '/kandidaten')).json.scan_sofort, false, 'Scan lief heute');
        assert.strictEqual((await ruf('GET', '/api/flows')).json.jira, true);
        assert.strictEqual((await ruf('GET', '/api/flows/' + f.angebot_nachfassen + '/kandidaten')).json.anzahl, 0);
        assert.strictEqual((await ruf('GET', '/api/flows/' + f.rechnung_entwurf + '/kandidaten')).json.anzahl, 0);
      });
    });
  }

  async function testlaufOhneKandidat() {
    await mitAktionen({}, async ({ db, d, st, f, lauf }) => {
      await mitHttp(d, async (ruf) => {
        const r = await ruf('POST', '/api/flows/' + f.angebot_nachfassen + '/test', {});
        assert.strictEqual(r.status, 200, r.text);
        assert.strictEqual(r.json.status, 'skip');
        assert.strictEqual(lauf(r.json.id).test, 1);
        assert.strictEqual(meldungVon(db, r.json.id, 1), 'Kein Kandidat');
        // f1 ohne Kandidat nennt die ueberfaelligen Rechnungen mit Grund (Testmodus aus: der Testversand zaehlt nicht)
        db.prepare("UPDATE versand SET test = 1 WHERE bezug = '2026-0001'").run();
        rechnungMit(db, { nr: '2026-0009', faellig: '2026-01-05' });
        const g = await ruf('POST', '/api/flows/' + f.ueberfaellig_mahnung + '/test', {});
        assert.strictEqual(g.json.status, 'skip');
        assert.strictEqual(meldungVon(db, g.json.id, 1), 'Kein Kandidat: 2026-0009 nie per Mail aus c2invoice versendet; 2026-0001 nur als Test versendet, Testmodus ist aus');
        assert.deepStrictEqual(JSON.parse(db.prepare('SELECT ausgang_json FROM flow_schritt WHERE lauf_id = ? AND nr = 1').get(g.json.id).ausgang_json).ausgeschlossen.map((x) => x.nr), ['2026-0009', '2026-0001']);
        db.prepare("DELETE FROM invoices WHERE nr = '2026-0009'").run();
        db.prepare("UPDATE versand SET test = 0 WHERE bezug = '2026-0001'").run();
        // Mit Kandidat: Probelauf prueft nur, sendet nichts.
        const vorher = db.prepare('SELECT COUNT(*) AS n FROM versand').get().n;
        const t = await ruf('POST', '/api/flows/' + f.ueberfaellig_mahnung + '/test', {});
        assert.strictEqual(t.json.status, 'skip');
        assert.match(db.prepare("SELECT meldung FROM flow_schritt WHERE lauf_id = ? AND typ = 'action'").get(t.json.id).meldung, /Zahlungserinnerung an kunde@example.org/);
        assert.strictEqual(st.mails.length, 0, 'ein Probelauf sendet nie');
        assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM versand').get().n, vorher, 'kein neuer Versand');
      });
    });
  }

  async function antwortOhneGeheimnis() {
    await mitAktionen({}, async ({ db, d, f }) => {
      // Ein Ereignis, das Pfade und Zugaenge mittraegt, darf sie nicht ausliefern.
      const id = Number(db.prepare("INSERT INTO flow_lauf (flow_id, start, status, ausloeser_json) VALUES (?, 'x', 'ok', ?)").run(f.ueberfaellig_mahnung,
        JSON.stringify({ nr: 'N', pdf_pfad: 'C:\\geheim\\a.pdf', eml_pfad: 'C:\\geheim\\a.eml', smtp: { passwort: 'sehr-geheim', token: 'tok-123' } })).lastInsertRowid);
      db.prepare("INSERT INTO flow_schritt (lauf_id, nr, node_id, typ, status, eingang_json, ausgang_json) VALUES (?, 1, 't', 'trigger', 'ok', ?, ?)").run(id,
        JSON.stringify({ pdf_pfad: 'C:\\geheim\\a.pdf', liste: [{ passwort: 'x', ok: 1 }] }), JSON.stringify({ eml_pfad: 'E:\\a.eml', nr: 'N' }));
      await mitHttp(d, async (ruf) => {
        for (const p of ['/api/flows/lauf/' + id, '/api/flows/laeufe', '/api/flows/' + f.ueberfaellig_mahnung, '/api/flows']) {
          const r = await ruf('GET', p);
          assert.strictEqual(r.status, 200);
          for (const verboten of ['pdf_pfad', 'eml_pfad', 'passwort', 'sehr-geheim', 'tok-123', 'a.pdf', 'a.eml', 'x-geheim']) assert.ok(!r.text.includes(verboten), p + ' enthaelt ' + verboten);
        }
        const r = await ruf('GET', '/api/flows/lauf/' + id);
        assert.strictEqual(r.json.ausloeser.nr, 'N');
        assert.strictEqual(r.json.schritte[0].ausgang.nr, 'N');
        assert.strictEqual(r.json.schritte[0].eingang.liste[0].ok, 1);
      });
    });
  }

  // Rot, wenn eine Flow-Route in OHNE_GERAET stuende oder gar nicht hinter dem Schutz laege.
  async function routeBrauchtGeraet() {
    const sv = require('../../server');
    sv.setzeGeraeteSchutz(true);
    await new Promise((ok) => sv.server.listen(0, '127.0.0.1', ok));
    const basis = 'http://127.0.0.1:' + sv.server.address().port;
    try {
      for (const p of ['/api/flows/1/aktiv', '/api/flows/1/test', '/api/flows/1/jetzt', '/api/flows/lauf/1/wiederholen']) {
        const r = await fetch(basis + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"aktiv":true,"ab_schritt":1}' });
        await r.text();
        assert.strictEqual(r.status, 401, p + ' ohne Geraet: ' + r.status);
        assert.strictEqual(r.headers.get('x-c2invoice-kopplung'), 'noetig');
      }
      const g = await fetch(basis + '/api/flows'); const j = await g.json();
      assert.strictEqual(g.status, 200); assert.ok(Array.isArray(j.flows));
      const l = await fetch(basis + '/api/flows/laeufe'); await l.text();
      assert.strictEqual(l.status, 200);
    } finally {
      sv.setzeGeraeteSchutz(false);
      await new Promise((ok) => { sv.server.closeAllConnections(); sv.server.close(ok); });
    }
  }

  // R8: ein Mahn-Dienst, ein Mail-Dienst. Eine zweite Instanz haette eigene Sperren im Speicher und liesse eine Mahnung doppelt raus.
  function einDienstEineInstanz() {
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../server.js'), 'utf8');
    assert.strictEqual(src.match(/mahnung\.erzeugeDienst\(/g).length, 1, 'genau ein Mahn-Dienst in server.js');
    assert.strictEqual(src.match(/\bmail\.erzeuge\(/g).length, 1, 'genau ein Mail-Dienst in server.js');
    assert.match(src, /flows\.erzeugeAktionen\(\{ mahnDienst, mailDienst \}\)/);
    assert.match(src, /flows\.erzeugeDienst\(.*mail: mailDienst/);
  }

  // R7: ein langsamer Tick blockiert den naechsten, ein Fehler wird gemeldet statt geworfen, danach laeuft der Takt weiter.
  async function taktUeberlappt() {
    let aufrufe = 0, gleichzeitig = 0, spitze = 0, fehlerGemeldet = 0;
    const d = { takt: async () => { aufrufe++; gleichzeitig++; spitze = Math.max(spitze, gleichzeitig); await warte(60); gleichzeitig--; if (aufrufe === 1) throw new Error('kaputt'); } };
    const alt = console.error; console.error = () => { fehlerGemeldet++; };
    const t = flows.planeTakt(d, 10);
    try { await warte(200); } finally { clearInterval(t); console.error = alt; }
    assert.strictEqual(spitze, 1, 'Takt ueberlappt sich: ' + spitze);
    assert.ok(aufrufe >= 2, 'nach einem Fehler laeuft der Takt weiter: ' + aufrufe);
    assert.ok(aufrufe < 15, 'Ticks waehrend eines Laufs fallen aus: ' + aufrufe);
    assert.strictEqual(fehlerGemeldet, 1);
    assert.strictEqual(t.hasRef(), false, 'unref: haelt den Prozess nicht offen');
    // Synchrones Werfen zaehlt auch.
    const e2 = console.error; let n2 = 0; console.error = () => { n2++; };
    const t2 = flows.planeTakt({ takt: () => { throw new Error('sync'); } }, 10);
    try { await warte(50); } finally { clearInterval(t2); console.error = e2; }
    assert.ok(n2 >= 1);
  }

  // --- Nachtrag 04.11.: "Jetzt ausfuehren", Versandzeit, R17 ------------------
  const { getMeta } = require('../../db');
  // Tag und Takt aus der injizierten Uhr (JETZT), nicht aus dem echten Datum; abStunde 0 + Wochenende: das Fenster ist in jeder Zeitzone offen.
  const heuteUm = () => new Date(JETZT());
  const heuteTag = () => rechnungsmodul.tagNach(new Date(JETZT()), 0);
  const OFFEN = { abStunde: 0, wochenende: 1 };

  // A: derselbe Schluessel bezug|tag wie der Scan; zweiter Druck und Scan am selben Tag starten nichts Neues.
  async function jetztWieScan() {
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) }, cfgW: { mahnwesen: CFG, flows: OFFEN } });
    const id = legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    await mitHttp(d, async (ruf) => {
      assert.strictEqual((await ruf('GET', '/api/flows/' + id + '/kandidaten')).json.anzahl, 1);
      const r = await ruf('POST', '/api/flows/' + id + '/jetzt', {});
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.gestartet, 1);
      assert.strictEqual(r.json.laeufe.length, 1);
      const l = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(r.json.laeufe[0]);
      assert.deepStrictEqual([l.test, l.schluessel, l.status], [0, 'rechnung:2026-0001|' + heuteTag(), 'ok']);
      // Die Rueckfrage zaehlt nur, was heute noch nicht lief (gleicher Schluessel wie der Lauf).
      assert.strictEqual((await ruf('GET', '/api/flows/' + id + '/kandidaten')).json.anzahl, 0, 'nach dem Druck: nichts mehr offen');
      const z = await ruf('POST', '/api/flows/' + id + '/jetzt', {});
      assert.deepStrictEqual(z.json, { gestartet: 0, laeufe: [] }, 'zweiter Druck am selben Tag');
    });
    assert.deepStrictEqual(await d.takt(heuteUm()), { kandidaten: 1 }, 'Scan laeuft trotzdem (keine Tagesmarke)');
    assert.strictEqual(log.length, 1, 'Scan am selben Tag sendet nicht doppelt');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, 1);
  }

  // A: keine Scan-Tagesmarke; der Scan fuer die andere Ausloeser-Art laeuft danach.
  async function jetztOhneScanMarke() {
    const db = neueDb(); scharf(db, '2026-0001'); angebotMit(db, { bis: rechnungsmodul.tagNach(new Date(JETZT()), 1) + 'T12:00:00' }); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) }, cfgW: { mahnwesen: CFG, flows: OFFEN } });
    const id = legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' }); legeFlow(db, ['s'], { art: 'angebot_laeuft_ab' });
    await mitHttp(d, async (ruf) => { assert.strictEqual((await ruf('POST', '/api/flows/' + id + '/jetzt', {})).json.gestartet, 1); });
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0001'], 'nur die Art dieses Flows');
    assert.strictEqual(getMeta(db, 'flows_scan_tag'), null);
    await d.takt(heuteUm());
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0001', 'AN-2026-0001'], 'Angebot kommt mit dem Scan');
  }

  // A: Tagesgrenze schneidet wie beim Scan, aelteste zuerst.
  async function jetztTagesgrenze() {
    const db = neueDb(); zweiRechnungen(db); const log = [];
    const d = scanDienst(db, { status: { bereit: true, umgeleitet: false, heute: 0, grenze: 1 }, aktionen: { s: attrappe(log) } });
    const id = legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    await mitHttp(d, async (ruf) => { assert.strictEqual((await ruf('POST', '/api/flows/' + id + '/jetzt', {})).json.gestartet, 1); });
    assert.deepStrictEqual(log.map((c) => c.eingang.nr), ['2026-0002']);
  }

  // A: Versand nicht bereit: 409 mit Klartext, kein Lauf, keine Karte.
  async function jetztNichtBereit() {
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const d = scanDienst(db, { status: { bereit: false, grund: 'mail.smtp.host fehlt', umgeleitet: false, heute: 0, grenze: 100 }, aktionen: { s: attrappe(log) } });
    const id = legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    await mitHttp(d, async (ruf) => {
      const r = await ruf('POST', '/api/flows/' + id + '/jetzt', {});
      assert.strictEqual(r.status, 409, r.text);
      assert.match(r.json.error, /Versand nicht bereit: mail\.smtp\.host fehlt/);
    });
    assert.strictEqual(log.length, 0);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, 0);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM freigabe').get().n, 0, 'keine Karte');
  }

  // A: echte Aktion: der aktive f1 sendet die faellige Erinnerung; pausiert und f3 bekommen 409, ungueltige Id 400/404.
  async function jetztEchtUndGesperrt() {
    await mitAktionen({}, async ({ db, d, st, f, lauf }) => {
      await mitHttp(d, async (ruf) => {
        const p = await ruf('POST', '/api/flows/' + f.ueberfaellig_mahnung + '/jetzt', {});
        assert.strictEqual(p.status, 409, p.text);
        assert.strictEqual(p.json.error, 'Flow ist pausiert — erst scharf schalten');
        d.setzeAktiv(f.rechnung_entwurf, true);
        const j = await ruf('POST', '/api/flows/' + f.rechnung_entwurf + '/jetzt', {});
        assert.strictEqual(j.status, 409, j.text);
        assert.strictEqual(j.json.error, 'Dieser Flow startet nur über den Jira-Abgleich');
        assert.strictEqual((await ruf('POST', '/api/flows/abc/jetzt', {})).status, 400);
        assert.strictEqual((await ruf('POST', '/api/flows/9999/jetzt', {})).status, 404);
        assert.strictEqual(st.mails.length, 0);
        assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM flow_lauf').get().n, 0);
        d.setzeAktiv(f.ueberfaellig_mahnung, true);
        const r = await ruf('POST', '/api/flows/' + f.ueberfaellig_mahnung + '/jetzt', {});
        assert.strictEqual(r.status, 200, r.text);
        assert.strictEqual(r.json.gestartet, 1);
        assert.strictEqual(lauf(r.json.laeufe[0]).status, 'ok', lauf(r.json.laeufe[0]).fehler);
        assert.deepStrictEqual(st.mails.map((m) => m.an), [[KUNDE]]);
      });
    });
  }

  // B: Versandzeit aus Einstellungen -> Flows; ohne Einstellung Mo-Fr ab 9 wie bisher, Ungueltiges faellt auf den Standard.
  async function taktVersandzeit() {
    const takt = async (flowsCfg, h) => {
      const db = neueDb(); scharf(db, '2026-0001'); const log = [];
      const d = scanDienst(db, { aktionen: { s: attrappe(log) }, cfgW: { mahnwesen: CFG, ...(flowsCfg && { flows: flowsCfg }) } });
      legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
      await d.takt(h);
      return log.length;
    };
    assert.strictEqual(await takt({ abStunde: 7 }, MONTAG(7)), 1, 'abStunde 7: 7:00 laeuft');
    assert.strictEqual(await takt({ abStunde: 7 }, MONTAG(6, 59)), 0, 'abStunde 7: 6:59 nicht');
    assert.strictEqual(await takt(null, MONTAG(8, 59)), 0, 'Standard 9');
    assert.strictEqual(await takt(null, MONTAG(9)), 1);
    for (const kaputt of [24, -1, 7.5, '7', null]) assert.strictEqual(await takt({ abStunde: kaputt }, MONTAG(8)), 0, 'ungueltig ' + kaputt + ' = 9');
    assert.strictEqual(await takt({ wochenende: 1 }, TAG(7)), 1, 'Wochenende an: Samstag laeuft');
    assert.strictEqual(await takt({ wochenende: 1 }, TAG(8, 8)), 0, 'auch am Wochenende erst ab der Stunde');
    assert.strictEqual(await takt({ wochenende: 0 }, TAG(7)), 0, 'Wochenende aus: Samstag nicht');
    // Die Oberflaeche bekommt beides vom Server, statt "werktags ab 9 Uhr" fest zu sagen.
    const db = neueDb();
    const d = scanDienst(db, { cfgW: { mahnwesen: CFG, flows: { abStunde: 23, wochenende: 1 } } });
    await mitHttp(d, async (ruf) => {
      assert.deepStrictEqual((await ruf('GET', '/api/flows')).json.versand, { ab_stunde: 23, wochenende: true });
    });
    await mitHttp(scanDienst(neueDb()), async (ruf) => {
      assert.deepStrictEqual((await ruf('GET', '/api/flows')).json.versand, { ab_stunde: 9, wochenende: false });
    });
  }

  function einstellungVersandzeit() {
    configGeschuetzt(() => {
      const { setzeEinstellungen, EINSTELLUNGEN } = require('../../server');
      const config = require('../../config.json');
      assert.deepStrictEqual([EINSTELLUNGEN.flowsAbStunde.standard, EINSTELLUNGEN.flowsAbStunde.pfad], [9, 'flows.abStunde']);
      assert.deepStrictEqual([EINSTELLUNGEN.flowsWochenende.standard, EINSTELLUNGEN.flowsWochenende.pfad], [0, 'flows.wochenende']);
      for (const w of [24, -1, 7.5, 'x']) assert.throws(() => setzeEinstellungen({ flowsAbStunde: w }), /Automatische Schreiben ab/, JSON.stringify(w));
      for (const w of [2, -1, 0.5]) assert.throws(() => setzeEinstellungen({ flowsWochenende: w }), /Wochenende/, JSON.stringify(w));
      setzeEinstellungen({ flowsAbStunde: 7, flowsWochenende: 1 });
      assert.deepStrictEqual([config.flows.abStunde, config.flows.wochenende], [7, 1]);
      setzeEinstellungen({ flowsAbStunde: 0, flowsWochenende: 0 });
      assert.deepStrictEqual([config.flows.abStunde, config.flows.wochenende], [0, 0]);
    });
  }

  // C/R17: eine kein_retry-Karte zu einem Angebot haelt den Scan fuer dieses Angebot dauerhaft an; bei Rechnungen nur, solange sie offen ist.
  async function r17NachfassenGesperrt() {
    const scan = async (bezug, wahl) => {
      const db = neueDb(); scharf(db, '2026-0001'); angebotMit(db, { bis: '2026-11-04T12:00:00' }); const log = [];
      const d = scanDienst(db, { aktionen: { s: attrappe(log) }, cfgW: { mahnwesen: CFG, angebot: { nachfassenTageVorAblauf: 2 } } });
      legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' }); legeFlow(db, ['s'], { art: 'angebot_laeuft_ab' });
      const k = freigaben.anlegen(db, { art: 'flow_fehler', bezug, titel: 'x', text: 'x', nutzlast: { lauf_id: 1, ab_schritt: 2, kein_retry: true }, quelle: 'flow:1' });
      if (wahl) await freigaben.entscheide(db, k.id, { wahl });
      await d.takt(MONTAG(9));
      return log.map((c) => c.eingang.nr);
    };
    for (const wahl of [null, 'ok', 'ablehnen']) assert.deepStrictEqual(await scan('angebot:AN-2026-0001', wahl), ['2026-0001'], 'Angebot gesperrt, Karte ' + (wahl || 'offen'));
    assert.deepStrictEqual(await scan('rechnung:2026-0001', null), ['AN-2026-0001'], 'Rechnung wartet, solange die Karte offen ist');
    assert.deepStrictEqual(await scan('rechnung:2026-0001', 'ok'), ['2026-0001', 'AN-2026-0001'], 'bestaetigt: Rechnung wieder dabei');
  }

  // C/R17: Kartentext fuer ein Nachfassen ohne Wiederholen.
  async function r17Kartentext() {
    const db = neueDb();
    const d = dienst(db, { boese: { pruefe: () => '', fuehreAus: async () => { throw Object.assign(new Error('weg'), { kein_retry: true }); } } });
    const id = legeFlow(db, ['boese']);
    await d.lauf(id, {}, { bezug: 'angebot:AN-2026-0001' });
    await d.lauf(id, {}, { bezug: 'rechnung:2026-0001' });
    const text = (b) => db.prepare("SELECT text FROM freigabe WHERE art = 'flow_fehler' AND bezug = ?").get(b).text;
    assert.strictEqual(text('angebot:AN-2026-0001'), 'Schritt 2 (boese): weg Im Gesendet-Ordner prüfen. Ging das Nachfassen nicht raus, bitte von Hand senden — der Flow fasst dieses Angebot nicht noch einmal nach.');
    assert.match(text('rechnung:2026-0001'), /Bis dahin lässt der Tages-Scan diesen Beleg aus\.$/);
  }

  // Fix-Runde 1 (M7): "Jetzt" rechnet mit der injizierten Uhr und ignoriert Wochentag und Stunde (Sonntag 06:00, Standard-Versandzeit).
  async function jetztIgnoriertUhr() {
    const sonntag = new Date(2026, 10, 8, 6, 0).toISOString();
    const db = neueDb(); scharf(db, '2026-0001'); const log = [];
    const d = scanDienst(db, { aktionen: { s: attrappe(log) }, uhr: () => sonntag });
    const id = legeFlow(db, ['s'], { art: 'rechnung_ueberfaellig' });
    assert.strictEqual(await d.takt(new Date(sonntag)), null, 'der Scan laeuft sonntags um 6 nicht');
    await mitHttp(d, async (ruf) => {
      const r = await ruf('POST', '/api/flows/' + id + '/jetzt', {});
      assert.strictEqual(r.status, 200, r.text);
      assert.strictEqual(r.json.gestartet, 1);
    });
    assert.strictEqual(db.prepare('SELECT schluessel FROM flow_lauf').get().schluessel, 'rechnung:2026-0001|2026-11-08', 'Tag aus der injizierten Uhr');
  }

  // Fix-Runde 1: scanSofort liest die Versandzeit live; die Einstellungs-Antwort traegt es nur, wenn ein Flows-Feld geaendert wurde.
  async function scanSofortNachEinstellung() {
    const sonntag = new Date(2026, 10, 8, 10, 0).toISOString();
    const cfgW = { mahnwesen: CFG, flows: { wochenende: 0 } };
    const db = neueDb();
    const d = scanDienst(db, { cfgW, uhr: () => sonntag });
    assert.strictEqual(d.scanSofort(), false, 'Sonntag ohne Wochenende');
    cfgW.flows.wochenende = 1;
    assert.strictEqual(d.scanSofort(), true, 'Wochenende eben eingeschaltet: Scan binnen einer Minute');
    require('../../db').setMeta(db, 'flows_scan_tag', '2026-11-08');
    assert.strictEqual(d.scanSofort(), false, 'heute schon gelaufen');
    const sv = require('../../server');
    assert.strictEqual(typeof sv.einstellungSofort({ flowsWochenende: 1 }).scan_sofort, 'boolean');
    assert.strictEqual(typeof sv.einstellungSofort({ flowsAbStunde: 7 }).scan_sofort, 'boolean');
    assert.deepStrictEqual(sv.einstellungSofort({ stundensatz: 90 }), {}, 'andere Felder: kein Hinweis');
  }

  // ---- C11e: Restpunkte vor Release 3.2 ----
  const HINWEIS = (wann) => ' · Probelauf, nichts gesendet. Gesendet wird beim Scan (' + wann + ') oder mit „Jetzt ausführen“';

  // Testmodus: Lauf und Probelauf nennen die Testadresse, an die die Mail wirklich geht (wiki leerer-probelauf-braucht-grund-je-fall, Punkt 2).
  async function testadresseInMeldung() {
    await mitAktionen({ umleitenAn: TESTADR }, async ({ db, d, st, f, eingang, lauf }) => {
      // Die Testadresse aendert sich waehrend des SMTP-Gespraechs: die Meldung nennt trotzdem die, an die die Mail ging (Versandzeile).
      st.halte = { then(weiter) { st.cfg.umleitenAn = 'neu@example.org'; st.halte = null; weiter(); } };
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      const p = await d.lauf(f.ueberfaellig_mahnung, eingang(), { test: true });
      assert.strictEqual(meldungVon(db, p, 2), 'Zahlungserinnerung an die Testadresse ' + TESTADR + ' (statt an ' + KUNDE + ') über 1.190,00 EUR' + HINWEIS('werktags ab 9 Uhr'));
      const id = await mahnLauf(d, eingang());
      assert.strictEqual(lauf(id).status, 'ok', lauf(id).fehler);
      assert.strictEqual(meldungVon(db, id, 2), 'Test: Zahlungserinnerung ging an die Testadresse ' + TESTADR + ' statt an ' + KUNDE + ', zählt nicht als Stufe');
    });
    await mitAktionen({ umleitenAn: TESTADR }, async ({ db, d, f }) => {
      angebotMit(db, { versand: false });
      angebotVersand(db, TESTADR, '2026-10-08T10:00:00', { test: 1, original: KUNDE });
      d.setzeAktiv(f.angebot_nachfassen, true);
      const p = await d.lauf(f.angebot_nachfassen, { nr: 'AN-2026-0001', tage: 1 }, { test: true });
      assert.strictEqual(meldungVon(db, p, 2), 'Nachfassen zu AN-2026-0001 an die Testadresse ' + TESTADR + ' (statt an ' + KUNDE + ')' + HINWEIS('werktags ab 9 Uhr'));
      const id = (await d.ausloesen('angebot_laeuft_ab', { nr: 'AN-2026-0001', tage: 1, bezug: 'angebot:AN-2026-0001', schluessel: 'n1' }))[0];
      assert.strictEqual(meldungVon(db, id, 2), 'Test: Nachfassen ging an die Testadresse ' + TESTADR + ' statt an ' + KUNDE);
    });
  }

  // Probelauf sagt, dass nichts rausging und wann es rausgeht (Versandzeit aus der Config); scharf ohne Testadresse; f3 ohne Scan-Hinweis.
  async function probelaufHinweis() {
    await mitAktionen({ flows: { abStunde: 7, wochenende: 1 } }, async ({ db, d, st, f, eingang }) => {
      const pausiert = await d.lauf(f.ueberfaellig_mahnung, eingang(), { test: true });
      assert.strictEqual(meldungVon(db, pausiert, 2), 'Zahlungserinnerung an ' + KUNDE + ' über 1.190,00 EUR · Probelauf, nichts gesendet. Der Flow ist pausiert: gesendet wird erst nach dem Scharfschalten');
      d.setzeAktiv(f.ueberfaellig_mahnung, true);
      const p = await d.lauf(f.ueberfaellig_mahnung, eingang(), { test: true });
      assert.strictEqual(meldungVon(db, p, 2), 'Zahlungserinnerung an ' + KUNDE + ' über 1.190,00 EUR' + HINWEIS('täglich ab 7 Uhr'));
      const e = await d.lauf(f.rechnung_entwurf, { key: 'ABC-1', vorgang: 'ABC-1', kat: 'done' }, { test: true });
      assert.ok(!/Probelauf/.test(meldungVon(db, e, 2) || ''), 'f3 sendet nie: kein Scan-Hinweis');
      assert.strictEqual(st.mails.length, 0);
    });
  }

  // f2: je offenem Angebot Kandidat oder Grund, aus einer Regel (angebot.urteil); Kandidatenliste unveraendert.
  async function nachfassenGruende() {
    const o = { testmodus: false, tageVorAblauf: 3 };
    const db = neueDb();
    angebotMit(db, { nr: 'AN-2026-0001', versand: false });                                         // nie per Mail
    angebotMit(db, { nr: 'AN-2026-0002', versand: false }); versandZeile(db, 'AN-2026-0002', { art: 'angebot', test: 1 }); // nur Test
    angebotMit(db, { nr: 'AN-2026-0003' }); versandZeile(db, 'AN-2026-0003', { art: 'nachfassen' });   // schon nachgefasst
    angebotMit(db, { nr: 'AN-2026-0004', bis: '2026-10-30T12:00:00' });                               // abgelaufen
    angebotMit(db, { nr: 'AN-2026-0005', bis: '2026-11-20T12:00:00' });                               // erst spaeter
    angebotMit(db, { nr: 'AN-2026-0006', bis: '2026-11-15T12:00:00' });                               // So: Freitag davor (13.)
    angebotMit(db, { nr: 'AN-2026-0007' });                                                           // Kandidat
    angebotMit(db, { nr: 'AN-2026-0008', status: 'angenommen' });                                    // nicht offen: nicht gelistet
    assert.deepStrictEqual(angebot.ausgeschlossen(db, '2026-11-02', o), [
      { nr: 'AN-2026-0004', grund: 'abgelaufen am 2026-10-30' },
      { nr: 'AN-2026-0001', grund: 'nie per Mail aus c2invoice versendet' },
      { nr: 'AN-2026-0002', grund: 'nur als Test versendet, Testmodus ist aus' },
      { nr: 'AN-2026-0003', grund: 'Nachfassen schon gesendet' },
      { nr: 'AN-2026-0006', grund: 'Nachfassen erst ab 2026-11-12' },
      { nr: 'AN-2026-0005', grund: 'Nachfassen erst ab 2026-11-17' },
    ]);
    assert.deepStrictEqual(angebot.ausgeschlossen(db, '2026-11-02', { ...o, tageVorAblauf: 1 }).find((x) => x.nr === 'AN-2026-0006'),
      { nr: 'AN-2026-0006', grund: 'Nachfassen erst ab 2026-11-13' }, 'Freitagsregel: Ablauf Sonntag, nachgefasst am Freitag');
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-02', o), [{ nr: 'AN-2026-0007', tage: 3 }], 'Kandidatenregel unveraendert');
    const tm = angebot.ausgeschlossen(db, '2026-11-02', { ...o, testmodus: true });
    assert.ok(!tm.some((x) => x.nr === 'AN-2026-0002'), 'im Testmodus zaehlt der Testversand');
    // Erst-ab-Datum ist der erste Tag, an dem kandidaten() das Angebot liefert (eine Regel, kein zweiter Ausdruck).
    assert.deepStrictEqual(angebot.kandidaten(db, '2026-11-16', o).map((k) => k.nr), [], '16.: AN-0005 noch nicht');
    assert.ok(angebot.kandidaten(db, '2026-11-17', o).some((k) => k.nr === 'AN-2026-0005'), '17.: AN-0005 dran');
    // Unlesbares Datum: ein Grund statt einer Endlosschleife (ohne Schutz haengt dieser Test, deshalb keine Mutante dafuer).
    const kaputt = neueDb(); angebotMit(kaputt, { bis: '' });
    assert.deepStrictEqual(angebot.ausgeschlossen(kaputt, '2026-11-02', o), [{ nr: 'AN-2026-0001', grund: 'Gültigkeitsdatum unlesbar' }]);
    kaputt.prepare("UPDATE angebote SET gueltig_bis = 'kaputt1234'").run();
    assert.deepStrictEqual(angebot.ausgeschlossen(kaputt, '2026-11-02', o), [{ nr: 'AN-2026-0001', grund: 'Gültigkeitsdatum unlesbar' }], '10 Zeichen, kein Datum');
    kaputt.prepare("UPDATE angebote SET gueltig_bis = '9999-12-31'").run();
    const t0 = Date.now();
    assert.deepStrictEqual(angebot.ausgeschlossen(kaputt, '2026-11-02', o), [{ nr: 'AN-2026-0001', grund: 'Nachfassen erst ab 9999-12-28' }]);
    assert.ok(Date.now() - t0 < 200, 'ferner Ablauf zaehlt nicht Tag fuer Tag');
    // Probelauf f2 ohne Kandidat nennt die Gruende; ein Angebot mit kein_retry-Karte ist gesperrt (R17).
    await mitAktionen({}, async ({ db: db2, d, f }) => {
      angebotMit(db2, { nr: 'AN-2026-0001', bis: '2026-11-20T12:00:00' });
      angebotMit(db2, { nr: 'AN-2026-0002' });
      require('../../freigaben').anlegen(db2, { art: 'flow_fehler', bezug: 'angebot:AN-2026-0002', titel: 't', text: 'x', nutzlast: { lauf_id: 1, ab_schritt: 2, kein_retry: true }, quelle: 'cira' });
      db2.prepare("UPDATE freigabe SET status = 'erledigt'").run();
      await mitHttp(d, async (ruf) => {
        const r = await ruf('POST', '/api/flows/' + f.angebot_nachfassen + '/test', {});
        assert.strictEqual(r.json.status, 'skip', r.text);
        assert.strictEqual(meldungVon(db2, r.json.id, 1), 'Kein Kandidat: AN-2026-0001 Nachfassen erst ab 2026-11-17; AN-2026-0002 gesperrt durch eine Fehlerkarte (Nachfassen nur einmal)');
      });
    });
  }

  // Wochenende als Schalter: true/false (Oberflaeche) und 0/1 (API, alte Config) werden 0/1; GET beschreibt das Feld als Schalter;
  // die echte Route POST /api/einstellungen liefert scan_sofort mit (Verdrahtung einstellungSofort).
  async function wochenendeSchalterUndRoute() {
    // configGeschuetzt stellt synchron zurueck; hier laeuft HTTP dazwischen, also eigener Schnappschuss (Datei schreibt config-kopie weg).
    const config = require('../../config.json');
    const vorher = JSON.parse(JSON.stringify(config));
    try {
      const sv = require('../../server');
      assert.strictEqual(sv.EINSTELLUNGEN.flowsWochenende.typ, 'schalter');
      sv.setzeEinstellungen({ flowsWochenende: true });
      assert.strictEqual(config.flows.wochenende, 1);
      sv.setzeEinstellungen({ flowsWochenende: false });
      assert.strictEqual(config.flows.wochenende, 0);
      sv.setzeEinstellungen({ flowsWochenende: 1 });
      assert.strictEqual(config.flows.wochenende, 1, '0/1 per API weiter gueltig');
      for (const w of ['ja', 2, 'true']) assert.throws(() => sv.setzeEinstellungen({ flowsWochenende: w }), /Wochenende/, JSON.stringify(w));
      assert.throws(() => sv.setzeEinstellungen({ flowsAbStunde: true }), /Automatische Schreiben ab/, 'nur Schalter nehmen true/false');
      await new Promise((ok) => sv.server.listen(0, '127.0.0.1', ok));
      const basis = 'http://127.0.0.1:' + sv.server.address().port;
      const kopf = { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', origin: basis };
      try {
        const g = await (await fetch(basis + '/api/einstellungen')).json();
        assert.deepStrictEqual([g.werte.flowsWochenende.typ, g.werte.flowsWochenende.wert], ['schalter', 1]);
        assert.strictEqual(g.werte.flowsAbStunde.typ, undefined, 'Zahlfeld bleibt Zahlfeld');
        const r = await fetch(basis + '/api/einstellungen', { method: 'POST', headers: kopf, body: JSON.stringify({ flowsWochenende: false }) });
        const j = await r.json();
        assert.strictEqual(r.status, 200, JSON.stringify(j));
        assert.strictEqual(j.geaendert.flowsWochenende, 0);
        assert.strictEqual(typeof j.scan_sofort, 'boolean', 'Route ohne scan_sofort');
        const s = await (await fetch(basis + '/api/einstellungen', { method: 'POST', headers: kopf, body: JSON.stringify({ stundensatz: 90 }) })).json();
        assert.ok(!('scan_sofort' in s), 'andere Felder: kein Hinweis');
      } finally { sv.server.closeAllConnections(); await new Promise((ok) => sv.server.close(ok)); }
    } finally { for (const k of Object.keys(config)) delete config[k]; Object.assign(config, vorher); }
  }

  return [
    ['C11c: Lauf mit zwei Schritten', laufZweiSchritte],
    ['C11c: cond verzweigt', condVerzweigt],
    ['C11c: Schluessel einmal', schluesselEinmal],
    ['C11c: Seriell', seriell],
    ['C11c: Wiederholen ab Schritt', wiederholenAbSchritt],
    ['C11c: Trockenlauf', trockenlauf],
    ['C11c: Aufraeumen', aufraeumen],
    ['C11c: Vorlagen einmal', vorlagenEinmal],
    ['C11c: Fehlerhafte Aktion', fehlerhafteAktion],
    ['C11c: Kandidat E10 (scharf versendet)', kandidatE10],
    ['C11c: Kandidat Frist einstellbar', kandidatFristEinstellbar],
    ['C11c: Kandidat Testmodus (P1)', kandidatTestmodus],
    ['C11c: Kandidat Gruende im Probelauf', kandidatGruende],
    ['C11c: Kandidat Sperren', kandidatSperren],
    ['C11c: Kandidat nachholen', kandidatNachholen],
    ['C11c: Kandidat Reihenfolge', kandidatReihenfolge],
    ['C11c: Tagesgrenze, aelteste zuerst', kandidatTagesgrenze],
    ['C11c: Nachfassen einmal (E4)', nachfassenEinmal],
    ['C11c: Ausgeschoepft einmal (P9)', ausgeschoepftEinmal],
    ['C11c: Takt Werktag ab 9:00', taktWerktag],
    ['C11c: Takt Versand nicht bereit (P8)', taktNichtBereit],
    ['C11c: Takt Ausgeschoepft-Rechnung kaputt', taktAusgeschoepftKaputt],
    ['C11c: tageZwischen', tageZwischenDirekt],
    ['C11c: Stammdaten Querpruefung Gueltigkeit', stammdatenQuerpruefung],
    ['C11c: Takt ein Kandidat kaputt', taktEinKandidatKaputt],
    ['C11c: Takt Angebot', taktAngebot],
    ['C11c: Versand nicht bereit nur mit Flow, einmal je Tag (C2)', nichtBereitEinmalJeTag],
    ['C11c: Pausierter Flow verbraucht kein Kontingent (I1)', pausiertVerbrauchtNichts],
    ['C11c: Betreff je Beleg (I3)', betreffJeBeleg],
    ['C11c: Nachfassen vor dem Wochenende (M3)', nachfassenVorDemWochenende],
    ['C11c: Scan-Fehler als Karte je Tag (M4)', scanFehlerKarte],
    ['C11c: Einstellung Nachfassen', einstellungNachfassen],
    ['C11c: Aktion Mahnung gesendet', aktionMahnungOk],
    ['C11c: Aktion Mahnung im Testmodus zaehlt nicht', aktionMahnungTest],
    ['C11c: Aktion Trockenlauf sendet nichts', aktionTrockenlauf],
    ['C11c: Aktion Mahnung bezahlt nach dem Scan', aktionMahnungBezahlt],
    ['C11c: Aktion Mahnung von Hand schon gesendet', aktionMahnungDoppelt],
    ['C11c: Aktion Mahnung ohne Empfaenger', aktionMahnungOhneAn],
    ['C11c: Aktion Tagesgrenze ist warn', aktionTagesgrenze],
    ['C11c: Aktion SMTP-Fehler (Gate 11)', aktionSmtpFehler],
    ['C11c: Wiederholen unklar (P5)', wiederholenUnklar],
    ['C11c: Wiederholen haengt an der Wurzel (P5)', wiederholenWurzel],
    ['C11c: Wiederholen per Karte', wiederholenPerKarte],
    ['C11c: Aktion Mahnung waehrend Versand von Hand', aktionMahnungParallelVonHand],
    ['C11c: Mail raus ohne Status: Karte ohne Wiederholen', aktionOhneStatusKeinWiederholen],
    ['C11c: Mahnung klaeren: Kam an (P6)', klaerenGesendet],
    ['C11c: Mahnung klaeren: Kam nicht an (P6)', klaerenNichtGesendet],
    ['C11c: Mahnung klaeren nur bei unklar (P6)', klaerenNurUnklar],
    ['C11c: Mahnung heilen nach Absturz (P7)', heileNachAbsturz],
    ['C11c: Fehlerkarte je Beleg (I2)', karteJeBeleg],
    ['C11c: Probelauf-Fehler ohne Karte und Mail (I4)', probelaufFehlerStill],
    ['C11c: Unklar im Flow ohne Wiederholen (M2)', unklarImFlowOhneWiederholen],
    ['C11c: Pfade aus Fehlermeldungen (M5)', redaktPfade],
    ['C11c: Absturz im SMTP-Gespraech: Mahnung unklar (C1)', abbruchMahnungUnklar],
    ['C11c: Nachfassen mit PDF', nachfassenPdf],
    ['C11c: Entwurf je Vorgang (E11)', entwurfJeVorgang],
    ['C11c: f3 nur bei Done', f3NurDone],
    ['C11c: Vorlagen pausiert (Gate 12)', vorlagenPausiert],
    ['C11c: f3 ohne Jira', f3OhneJira],
    ['C11c: Benachrichtigung per Mail (E7)', benachrichtigungMail],
    ['C11c: Absturz im Versand: kein Wiederholen, Scan wartet (C1)', abbruchImVersand],
    ['C11c: Startreihenfolge heile vor aufraeumen (M1)', startReihenfolge],
    ['C11c: Bus-Hoerer jira_status', busHoerer],
    ['C11c: jira_status traegt kat', jiraStatusTraegtKat],
    ['C11c: Routen Grenzen', routeGrenzen],
    ['C11c: Route Wiederholen (R9)', routeWiederholen],
    ['C11c: Route Kandidaten (E10)', routeKandidaten],
    ['C11c: Probelauf ohne Kandidat', testlaufOhneKandidat],
    ['C11c: Antworten ohne Geheimnisse', antwortOhneGeheimnis],
    ['C11c: Flow-Routen brauchen ein Geraet', routeBrauchtGeraet],
    ['C11c: Ein Mahn-/Mail-Dienst (R8)', einDienstEineInstanz],
    ['C11c: Takt ueberlappt nicht (R7)', taktUeberlappt],
    ['C11c: Jetzt ausfuehren wie der Scan (bezug|tag)', jetztWieScan],
    ['C11c: Jetzt ausfuehren ohne Scan-Marke', jetztOhneScanMarke],
    ['C11c: Jetzt ausfuehren mit Tagesgrenze', jetztTagesgrenze],
    ['C11c: Jetzt ausfuehren Versand nicht bereit', jetztNichtBereit],
    ['C11c: Jetzt ausfuehren echt, pausiert, f3', jetztEchtUndGesperrt],
    ['C11c: Takt Versandzeit (abStunde, Wochenende)', taktVersandzeit],
    ['C11c: Einstellung Versandzeit', einstellungVersandzeit],
    ['C11c: R17 Nachfassen dauerhaft gesperrt', r17NachfassenGesperrt],
    ['C11c: R17 Kartentext Nachfassen', r17Kartentext],
    ['C11c: Jetzt ausfuehren ignoriert Uhr (M7)', jetztIgnoriertUhr],
    ['C11c: scanSofort nach Einstellung', scanSofortNachEinstellung],
    ['C11e: Testadresse in Lauf- und Probelauf-Meldung', testadresseInMeldung],
    ['C11e: Probelauf sagt nichts gesendet', probelaufHinweis],
    ['C11e: Nachfassen Gruende im Probelauf', nachfassenGruende],
    ['C11e: Wochenende als Schalter, Route mit scan_sofort', wochenendeSchalterUndRoute],
  ];
};
