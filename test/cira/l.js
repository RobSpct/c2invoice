'use strict';
// Block L (Ladezeiten): Zwischenspeicher der Zeitrechnung in metrics.js. Plan
// design/cira/LEISTUNG-PLAN.md. Der Speicher rechnet nichts, er darf also nie
// ein anderes Ergebnis liefern als eine frische Rechnung — und muss sich nach
// jedem Schreiben, jeder Zeitmodell-Wahl und jeder Pausenschwelle selbst
// verwerfen. Gegenprobe: design/werkzeuge/l-gates.js mutation.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = ({ dbmod, openDbs } = {}) => {
  const metrics = require('../../metrics');

  // Eine Sitzung je Aufruf: eine eigene Eingabe zu Beginn, danach 20 Zeilen
  // des Agenten im Abstand von 3 Minuten. Im Modell "eingaben" zaehlt davon
  // nur das Fenster um die Eingabe, im Modell "aktivitaet" die volle Stunde.
  const BEGINN = Date.UTC(2026, 8, 15, 8, 0);
  function fuelle(db) {
    const insA = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)');
    const insE = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, cwd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let n = 0;
    return (session, stundeNr, ticket = 'L-1') => {
      for (let m = 0; m <= 60; m += 3) {
        const ts = new Date(BEGINN + stundeNr * 3600e3 + m * 60000).toISOString();
        insA.run(session, ts, 'Kunde', 'main', ticket, ts.slice(0, 10), m === 0 ? 1 : 0);
        insE.run(session + '-' + n++, ts, session, 'Kunde', 'main', ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, ts.slice(0, 10), null);
      }
    };
  }
  function neueDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    return { db, sitzung: fuelle(db) };
  }
  // Datei-DB fuer zwei Verbindungen (Server + backfill.js/jira-sync.js).
  function dateiDb() {
    const pfad = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-l-')), 'l.db');
    const a = dbmod.open(pfad);
    const b = dbmod.open(pfad);
    openDbs.push(a, b);
    return { a, pfad, sitzungB: fuelle(b) };
  }
  // Zeitmodell und Pausenschwelle fest, gleich was in config.json steht (die
  // echte Installation rechnet nach "aktivitaet").
  async function mitConfig(werte, fn) {
    const cfg = require('../../config.json');
    const alt = JSON.parse(JSON.stringify(cfg));
    Object.assign(cfg, { zeitmodell: 'eingaben', gapMinutes: 10, projektSaetze: {} }, werte);
    try { return await fn(cfg); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  const sek = (db, ticket = 'L-1') => (metrics.byTicket(db, {}).find((t) => t.ticket === ticket) || {}).active_seconds || 0;
  const agent = (db) => metrics.agentSecondsByGroup(db, {}, { groupBy: 'ticket' })['L-1'] || 0;
  // Zaehlt Abfragen auf activity waehrend fn.
  function leseZaehler(db, fn) {
    const prepare = db.prepare;
    let gelesen = 0;
    db.prepare = (sql) => { if (/FROM activity/.test(sql)) gelesen++; return prepare.call(db, sql); };
    try { fn(); } finally { delete db.prepare; }
    return gelesen;
  }
  // Was /api/summary aus der Zeitrechnung zieht, als ein Vergleichswert.
  const satz = (db) => JSON.stringify([metrics.byTicket(db, {}), metrics.summary(db, {}), metrics.ohneTicket(db, {}),
    metrics.byProject(db, {}), metrics.byDay(db, {}), metrics.byPeriod(db, {}, 'woche')]);

  return [
    ['L1 Memo: zweiter Aufruf liest activity nicht neu', () => mitConfig({}, () => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0);
      metrics.byTicket(db, {});
      const prepare = db.prepare;
      let gelesen = 0;
      db.prepare = (sql) => { if (/FROM activity/.test(sql)) gelesen++; return prepare.call(db, sql); };
      try {
        metrics.byTicket(db, {});
        metrics.summary(db, {});
      } finally { delete db.prepare; }
      assert.strictEqual(gelesen, 0, 'activity ' + gelesen + '-mal neu gelesen');
    })],

    ['L1 Memo: Ergebnis gleich einer frischen Verbindung', () => mitConfig({}, () => {
      const { a, pfad, sitzungB } = dateiDb();
      sitzungB('s1', 0); sitzungB('s2', 0, 'L-2'); sitzungB('s3', 30);
      satz(a);
      const ausSpeicher = satz(a);
      const frisch = dbmod.open(pfad);
      openDbs.push(frisch);
      assert.strictEqual(ausSpeicher, satz(frisch), 'Speicher weicht von frischer Rechnung ab');
    })],

    ['L1 Memo: Insert, Zeitmodell-Wahl und gapMinutes verwerfen den Speicher', () => mitConfig({}, (cfg) => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0);
      // Eingabefenster: je eine halbe Pausenschwelle vor und nach der Eingabe.
      assert.strictEqual(sek(db), 600, 'Ausgangswert');
      sitzung('s2', 5);
      assert.strictEqual(sek(db), 1200, 'nach Insert');
      db.prepare("INSERT INTO zeitmodell_wahl (art, schluessel, zeitmodell) VALUES ('vorgang', 'L-1', 'aktivitaet')").run();
      assert.strictEqual(sek(db), 7200, 'nach Zeitmodell-Wahl');
      db.prepare('DELETE FROM zeitmodell_wahl').run();
      assert.strictEqual(sek(db), 1200, 'nach Loeschen der Wahl');
      cfg.gapMinutes = 20;
      assert.strictEqual(sek(db), 2400, 'nach gapMinutes');
      cfg.projektSaetze = { Kunde: { zeitmodell: 'aktivitaet' } };
      assert.strictEqual(sek(db), 7200, 'nach Zeitmodell im Projektsatz');
      cfg.projektSaetze = {};
      cfg.zeitmodell = 'aktivitaet';
      assert.strictEqual(sek(db), 7200, 'nach config.zeitmodell');
    })],

    ['L1 Memo: Rollback hinterlaesst keinen falschen Eintrag', () => mitConfig({}, () => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0);
      assert.strictEqual(sek(db), 600, 'Ausgangswert');
      db.exec('BEGIN');
      try {
        sitzung('s2', 5);
        assert.strictEqual(sek(db), 1200, 'in der Transaktion');
      } finally { db.exec('ROLLBACK'); }
      assert.strictEqual(sek(db), 600, 'nach Rollback');
    })],

    ['L1 Memo: Schreiben einer fremden Verbindung verwirft den Speicher', () => mitConfig({}, () => {
      const { a, sitzungB } = dateiDb();
      sitzungB('s1', 0);
      assert.strictEqual(sek(a), 600, 'Ausgangswert');
      assert.strictEqual(agent(a), 3600, 'Laufzeit Ausgangswert');
      sitzungB('s2', 5);
      assert.strictEqual(sek(a), 1200, 'nach Insert der anderen Verbindung');
      assert.strictEqual(agent(a), 7200, 'Laufzeit nach Insert der anderen Verbindung');
    })],

    ['L1 Memo: Laufzeit je Gruppe gleich und nach Insert neu', () => mitConfig({}, () => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0);
      // Zeile ohne Arbeitsverzeichnis mitten in der Sitzung: erbt Projekt und Vorgang.
      db.prepare("INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES ('s1', ?, '(unbekannt)', NULL, NULL, ?, 0)")
        .run(new Date(BEGINN + 61.5 * 60000).toISOString(), '2026-09-15');
      const erst = agent(db);
      assert.strictEqual(erst, 3690, 'Ausgangswert mit geerbter Zeile');
      assert.strictEqual(agent(db), erst, 'zweiter Aufruf');
      sitzung('s2', 5);
      assert.strictEqual(agent(db), erst + 3600, 'nach Insert');
    })],

    // Runde 2 (Owner-Test 20.10.): eine Rechnung ueber alle Tage, jede Ansicht filtert daraus.
    ['L1 Memo: Zeitraum nach Gesamtrechnung liest activity nicht neu', () => mitConfig({}, () => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0); sitzung('s2', 30);
      metrics.byTicket(db, {});
      const gelesen = leseZaehler(db, () => {
        metrics.byTicket(db, { month: '2026-09' });
        metrics.byDay(db, { from: '2026-09-16', to: '2026-09-16' });
        metrics.ohneTicket(db, { from: '2026-09-15', to: '2026-09-15' });
      });
      assert.strictEqual(gelesen, 0, 'activity ' + gelesen + '-mal neu gelesen');
      assert.strictEqual(sek(db), 1200, 'gesamt');
      assert.strictEqual((metrics.byTicket(db, { from: '2026-09-16', to: '2026-09-16' })[0] || {}).active_seconds, 600, 'ein Tag');
    })],

    ['L1 Memo: Laufzeit eines Zeitraums gleich, ob vorher gesamt gerechnet wurde oder nicht', () => mitConfig({}, () => {
      // Zeile ohne Arbeitsverzeichnis als erste Zeile des zweiten Tages: im
      // Zeitraum "nur Tag 2" hat sie keinen Vorgaenger und erbt nichts — auch
      // dann nicht, wenn die Gesamtrechnung sie vorher geerbt hat.
      const baue = () => {
        const { db } = neueDb();
        const ins = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,0)');
        ins.run('s1', '2026-09-15T23:50:00.000Z', 'Kunde', 'main', 'L-1', '2026-09-15');
        ins.run('s1', '2026-09-15T23:55:00.000Z', 'Kunde', 'main', 'L-1', '2026-09-15');
        ins.run('s1', '2026-09-16T00:01:00.000Z', '(unbekannt)', null, null, '2026-09-16');
        ins.run('s1', '2026-09-16T00:05:00.000Z', 'Kunde', 'main', 'L-1', '2026-09-16');
        return db;
      };
      const tag2 = { from: '2026-09-16', to: '2026-09-16' };
      const frisch = metrics.agentSecondsByGroup(baue(), tag2, { groupBy: 'ticket' });
      const db = baue();
      metrics.agentSecondsByGroup(db, {}, { groupBy: 'ticket' });
      assert.deepStrictEqual(metrics.agentSecondsByGroup(db, tag2, { groupBy: 'ticket' }), frisch, 'Gesamtrechnung hat die gespeicherten Zeilen veraendert');
      assert.deepStrictEqual(frisch, { '(ohne)': 240 }, 'Testaufbau');
    })],

    ['L1 Memo: ohne isTransaction wird nicht gespeichert', () => mitConfig({}, () => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0);
      // Aeltere Node-Versionen kennen db.isTransaction nicht: dann lieber rechnen als falsch merken.
      const alt = new Proxy(db, { get: (t, k) => (k === 'isTransaction' ? undefined : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
      assert.strictEqual(sek(alt), 600, 'Ausgangswert');
      db.exec('BEGIN');
      try {
        sitzung('s2', 5);
        assert.strictEqual(sek(alt), 1200, 'in der Transaktion');
      } finally { db.exec('ROLLBACK'); }
      assert.strictEqual(sek(alt), 600, 'nach Rollback');
    })],

    ['L2 Vorrechnen: danach liest die Uebersicht activity nicht neu', () => mitConfig({}, () => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0);
      metrics.vorrechnen(db);
      const gelesen = leseZaehler(db, () => { metrics.byTicket(db, {}); metrics.summary(db, { month: '2026-09' }); });
      assert.strictEqual(gelesen, 0, 'activity ' + gelesen + '-mal neu gelesen');
    })],

    ['L2 Abo-Anteil: neue Kosten im Monat aendern den Anteil', () => mitConfig({ aboPreisMonat: 100 }, () => {
      const { db, sitzung } = neueDb();
      sitzung('s1', 0, 'L-1');
      sitzung('s2', 2, 'L-2');
      // Gleiche Kosten je Vorgang: jeder traegt die Haelfte des Abos.
      assert.strictEqual(metrics.aboKosten(db, { month: '2026-09' }), 100, 'Abo im Monat');
      const anteil = () => metrics.aboKosten(db, { month: '2026-09', ticket: 'L-1' });
      assert.ok(Math.abs(anteil() - 50) < 1e-9, 'Ausgangswert ' + anteil());
      sitzung('s3', 4, 'L-2');
      assert.ok(Math.abs(anteil() - 100 / 3) < 1e-9, 'nach neuen Kosten ' + anteil());
    })],

    ['L2 Einlesen: zweiter Lauf ohne neue Zeilen schreibt nichts', async () => {
      const ingest = require('../../ingest');
      const cfg = require('../../config.json');
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-l-ingest-'));
      const proj = path.join(tmp, 'C--Users-Test-Dev-Demo');
      fs.mkdirSync(proj);
      const datei = path.join(proj, 's.jsonl');
      const kopf = (ts) => ({ timestamp: ts, sessionId: 's-l', cwd: 'C:\\Users\\Test\\Dev\\Demo', gitBranch: 'main', entrypoint: 'cli' });
      fs.writeFileSync(datei, [
        JSON.stringify({ ...kopf('2026-09-15T10:00:00.000Z'), type: 'user', message: { content: 'los' } }),
        JSON.stringify({ ...kopf('2026-09-15T10:00:05.000Z'), type: 'assistant', requestId: 'r1', message: { id: 'm1', model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 } } }),
      ].join('\n') + '\n');
      // Windows liefert mtimeMs mit Nachkommastellen; gespeichert wird abgerundet.
      fs.utimesSync(datei, new Date(), Date.UTC(2026, 8, 15, 10, 1, 0) / 1000 + 0.0004321);
      assert.ok(fs.statSync(datei).mtimeMs % 1 !== 0 || process.platform !== 'win32', 'Testaufbau: mtime ohne Nachkomma');
      const alt = { jsonl: cfg.jsonlDir, lokal: cfg.lokaleModelle && cfg.lokaleModelle.protokollDir };
      cfg.jsonlDir = tmp;
      if (!cfg.lokaleModelle) cfg.lokaleModelle = {};
      cfg.lokaleModelle.protokollDir = path.join(tmp, 'lokal-leer');
      const db = dbmod.open(':memory:');
      openDbs.push(db);
      try {
        await ingest.run({ db });
        const vor = db.prepare('SELECT total_changes() AS n').get().n;
        const r = await ingest.run({ db });
        assert.strictEqual(r.touched, 0, r.touched + ' Datei(en) erneut gelesen');
        assert.strictEqual(db.prepare('SELECT total_changes() AS n').get().n - vor, 0, 'Lauf ohne neue Zeilen hat geschrieben');
      } finally {
        cfg.jsonlDir = alt.jsonl;
        cfg.lokaleModelle.protokollDir = alt.lokal;
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }],
  ];
};
