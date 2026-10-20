'use strict';
// Masterplan 3.0, Block C1: Shell v2. Zaehler fuer die Navigation, Dienst-
// Status im Kopf, 5-h-Block in der Cira-Karte, Grenze fuer das Token-Limit.
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');

const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ configGeschuetzt, dbmod, openDbs }) => {
  const metrics = require('../../metrics');
  const H = 3600000;
  const T0 = Date.UTC(2026, 9, 15, 10, 0, 0);
  function db5h(zeilen) {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const ein = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, cost_usd, day, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    zeilen.forEach(([ms, tokens, quelle = 'claude', projekt = 'P', sitzung = 's1'], i) =>
      ein.run('r' + i, new Date(ms).toISOString(), sitzung, projekt, 'claude-opus-5', tokens, 0, 0, 0, 0, 0.01, new Date(ms).toISOString().slice(0, 10), quelle));
    return db;
  }

  // Fenster wie Claude: beginnt mit der ersten Anfrage nach Ablauf des vorigen,
  // auf die volle Stunde abgerundet, dauert 5 h.
  function block5hFenster() {
    const db = db5h([
      [T0 + 20 * 60000, 100], [T0 + H, 200],            // Fenster 10:00–15:00
      [T0 + 6 * H + 10 * 60000, 300],                   // 16:10 -> neues Fenster ab 16:00
      [T0 + 6 * H + 30 * 60000, 50, 'lokal'],            // lokale Modelle zaehlen nicht
      [T0 + 6 * H + 40 * 60000, 1000, 'claude', 'P', 's2'],
    ]);
    const b = metrics.block5h(db, { limit: 2600, jetzt: T0 + 7 * H });
    assert.strictEqual(b.tokens, 1300, 'Tokens im laufenden Fenster: ' + b.tokens);
    assert.strictEqual(b.anteil, 0.5);
    assert.strictEqual(b.ende, new Date(T0 + 11 * H).toISOString(), 'Fensterende: ' + b.ende);
    // Im ersten Fenster zaehlt die spaetere Anfrage noch nicht mit.
    const frueh = metrics.block5h(db, { limit: 1000, jetzt: T0 + 2 * H });
    assert.deepStrictEqual([frueh.tokens, frueh.ende], [300, new Date(T0 + 5 * H).toISOString()]);
    // Abgelaufen: kein Fenster, kein erfundener Wert.
    assert.deepStrictEqual(metrics.block5h(db, { limit: 1000, jetzt: T0 + 12 * H }), { anteil: 0, tokens: 0, limit: 1000, ende: null });
    // Ohne Limit gibt es nichts zu zeigen.
    for (const limit of [0, null, undefined, -5, NaN]) assert.strictEqual(metrics.block5h(db, { limit, jetzt: T0 + 7 * H }), null, 'Limit ' + limit);
    // Plausibilitaet: nie negativ, und kein Fenster aus der Zukunft.
    assert.strictEqual(metrics.block5h(db, { limit: 10, jetzt: T0 - H }).tokens, 0);
  }

  function liveZahl() {
    const jetzt = T0 + 3 * H;
    const db = db5h([
      [jetzt - 30000, 1, 'claude', 'P', 'a'], [jetzt - 90000, 1, 'claude', 'P', 'a'],
      [jetzt - 60000, 1, 'claude', 'Q', 'b'],
      [jetzt - 5 * 60000, 1, 'claude', 'P', 'alt'],           // zu alt
      [jetzt - 20000, 1, 'lokal', '(lokal)', 'lok'],      // keine Claude-Sitzung
    ]);
    assert.strictEqual(metrics.liveSitzungen(db, { jetzt }), 2);
    const werkzeug = [...metrics.OVERHEAD][0];
    if (werkzeug) {
      db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, day) VALUES ('w', ?, 'w', ?, 'm', '2026-10-15')`)
        .run(new Date(jetzt - 10000).toISOString(), werkzeug);
      assert.strictEqual(metrics.liveSitzungen(db, { jetzt }), 2, 'Werkzeug-Sitzung zaehlt als live');
    }
  }

  function limitGrenze() {
    configGeschuetzt(() => {
      const srv = require('../../server');
      assert.ok(srv.EINSTELLUNGEN.limit5hTokens, 'limit5hTokens fehlt in EINSTELLUNGEN');
      for (const boese of [50, -1, 1e13, 1.5e6 + 0.5]) assert.throws(() => srv.setzeEinstellungen({ limit5hTokens: boese }), Error, 'nimmt ' + boese);
      assert.strictEqual(srv.setzeEinstellungen({ limit5hTokens: 0 }).limit5hTokens, 0, '0 schaltet ab');
      assert.strictEqual(srv.setzeEinstellungen({ limit5hTokens: 5000000 }).limit5hTokens, 5000000);
    });
  }

  async function mitServer(fn) {
    const srv = require('../../server');
    const lauscht = srv.server.listening;
    if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
    try { return await fn((p) => `http://127.0.0.1:${srv.server.address().port}${p}`); } finally {
      if (!lauscht) await new Promise((ok) => srv.server.close(ok));
    }
  }
  // Wie configGeschuetzt, aber fuer asynchrone Tests (nur Speicher, die Datei wird nicht geschrieben).
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    Object.assign(cfg, werte);
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }

  async function zaehlerRoute() {
    await mitServer(async (url) => {
      const z = await (await fetch(url('/api/zaehler'))).json();
      // Felder kommen je Block dazu (C2: freigaben, C5: sitzungen), nie als Platzhalter vorab.
      assert.deepStrictEqual(Object.keys(z), ['live', 'freigaben', 'sitzungen'], 'Felder: ' + Object.keys(z));
      assert.ok(Number.isInteger(z.live) && z.live >= 0);
      assert.ok(Number.isInteger(z.sitzungen) && z.sitzungen >= 0);
      await mitConfig({ limit5hTokens: 1000000 }, async () => {
        const l = await (await fetch(url('/api/live?minutes=5'))).json();
        assert.ok('block5h' in l && l.block5h && typeof l.block5h.anteil === 'number', 'block5h fehlt: ' + JSON.stringify(l.block5h));
      });
      await mitConfig({ limit5hTokens: 0 }, async () => {
        assert.strictEqual((await (await fetch(url('/api/live?minutes=5'))).json()).block5h, null);
      });
    });
  }

  // Dienst-Punkte muessen rot werden koennen: ein abgeschalteter Modellserver ist
  // ok:false, ein laufender ok:true. Nicht Eingerichtetes erscheint nicht.
  async function diensteRoute() {
    let ollamaAufrufe = 0;
    const ollama = http.createServer((req, res) => {
      ollamaAufrufe++;
      // Unbekannte Pfade 404: ein JSON auf /v1/system-info hiesse sonst "Lemonade".
      const v = { '/v1/models': { data: [{ id: 'mini:1b' }] }, '/api/version': { version: '0.12.0' } }[req.url];
      res.writeHead(v ? 200 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(v || {}));
    });
    await new Promise((ok) => ollama.listen(0, '127.0.0.1', ok));
    const an = 'http://127.0.0.1:' + ollama.address().port;
    try {
      await mitServer(async (url) => {
        // Der Server haelt das Ergebnis 10 s; jede Config-Variante fragt frisch.
        const hole = async () => { require('../../server').diensteCacheLeeren(); return (await (await fetch(url('/api/dienste'))).json()).dienste; };
        const lm = require(CFG).lokaleModelle || {};
        // Proxy-Port 1: geschlossen, unabhaengig davon, ob auf diesem Rechner ein echter Proxy laeuft.
        await mitConfig({ lokaleModelle: { ...lm, upstreamUrl: an, proxyPort: 1 }, jira: { enabled: false }, dienste: {} }, async () => {
          const d = await hole();
          assert.deepStrictEqual(d.map((x) => x.name), ['Modellserver', 'Modell-Proxy', 'Claude', 'Ledger'], 'Dienste: ' + JSON.stringify(d));
          assert.deepStrictEqual([d[0].ok, d[0].detail], [true, 'Ollama · 1 Modell'], JSON.stringify(d[0]));
          assert.strictEqual(d[1].ok, false, 'geschlossener Proxy-Port gruen');
          assert.strictEqual(d[3].ok, true);
          assert.ok(d.every((x) => typeof x.detail === 'string' && typeof x.ok === 'boolean'));
          // Zwischenspeicher: ein zweiter Abruf binnen 10 s fragt Ollama nicht erneut.
          const vorher = ollamaAufrufe;
          await fetch(url('/api/dienste'));
          assert.strictEqual(ollamaAufrufe, vorher, 'Dienst-Status ohne Zwischenspeicher');
        });
        await mitConfig({ lokaleModelle: { ...lm, upstreamUrl: 'http://127.0.0.1:1', proxyPort: 1 }, jira: { enabled: true }, dienste: { n8nUrl: 'http://127.0.0.1:1' } }, async () => {
          const d = await hole();
          const o = d.find((x) => x.name === 'Modellserver'), n = d.find((x) => x.name === 'n8n');
          assert.strictEqual(o.ok, false, 'abgeschalteter Modellserver gilt als verbunden');
          assert.ok(n && n.ok === false, 'n8n fehlt oder gruen: ' + JSON.stringify(n));
          assert.ok(d.some((x) => x.name === 'Jira'), 'Jira fehlt trotz enabled');
          // Kein Zugang, kein Pfad, keine Adresse mit Zugangsdaten in der Antwort.
          assert.ok(!/token|password|passwort|@/i.test(JSON.stringify(d)), JSON.stringify(d));
        });
        await mitConfig({ lokaleModelle: undefined }, async () => {
          assert.ok(!(await hole()).some((x) => x.name === 'Modellserver' || x.name === 'Modell-Proxy'), 'Modellserver ohne Einrichtung angezeigt');
        });
      });
    } finally {
      await new Promise((ok) => ollama.close(ok));
    }
  }

  return [
    ['Cira C1: 5-h-Block folgt dem Claude-Fenster, ohne Limit nichts', block5hFenster],
    ['Cira C1: Live-Zaehler zaehlt Claude-Sitzungen der letzten zwei Minuten', liveZahl],
    ['Cira C1: Token-Limit je 5-h-Fenster hat serverseitige Grenzen', limitGrenze],
    ['Cira C1: /api/zaehler und block5h in /api/live', zaehlerRoute],
    ['Cira C1: /api/dienste wird rot, wenn ein Dienst aus ist', diensteRoute],
  ];
};
