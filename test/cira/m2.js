'use strict';
// Masterplan 3.0, Block M2 (Modell-Block II, Nachtrag §13): Fakten je Frage und
// Kontext, Zahlen-Guard mit Bezeichnung und Datum, Zwischenstufe im Strom,
// Dienste "Modellserver"/"Modell-Proxy", Proxy-Start durch den Server, Kette.
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');

const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ dbmod, openDbs }) => {
  const cira = require('../../cira');
  const metrics = require('../../metrics');
  const rechnung = require('../../rechnung');
  const kontakte = require('../../kontakte');
  const srv = () => require('../../server');

  const tag = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const eur = (v) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' EUR';
  const nie = (name) => () => { throw new Error(name + ' darf hier nicht laufen'); };

  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, v] of Object.entries(werte)) { if (v === undefined) delete cfg[k]; else cfg[k] = JSON.parse(JSON.stringify(v)); }
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  // Eine Stunde Arbeit an ABC-1 (Projekt "Kunde") heute um 10 Uhr, wie test/cira/c3.js.
  function arbeitsDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const insE = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, cwd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insA = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)');
    const h = new Date();
    const beginn = new Date(h.getFullYear(), h.getMonth(), h.getDate(), 10, 0).getTime();
    for (let m = 0; m <= 60; m += 3) {
      const ts = new Date(beginn + m * 60000).toISOString();
      insE.run('m2-' + m, ts, 's-kunde', 'Kunde', 'main', 'ABC-1', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, ts.slice(0, 10), null);
      insA.run('s-kunde', ts, 'Kunde', 'main', 'ABC-1', ts.slice(0, 10), 1);
    }
    return db;
  }
  const RECHNUNG = {
    rechnung: { aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '' },
      kleinunternehmer: false, ustSatz: 19, zahlungszielTage: 14, chromePfad: '' },
    vergleichsFaktor: 0,
  };
  // Kunde mit ueberfaelliger Rechnung ueber ABC-1.
  function mitRechnung(db) {
    const k = kontakte.speichere(db, { firma: 'Nordwind GmbH', vorname: 'Ada', nachname: 'Lind', anschrift: ['Hafen 1', '20457 Hamburg'], email: 'a@nordwind.example', projekte: ['Kunde'] });
    const h = new Date();
    const r = rechnung.erstelle(db, { from: tag(new Date(h.getFullYear(), h.getMonth(), 1)), to: tag(h), tickets: ['ABC-1'], empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1', '20457 Hamburg'] }, kontaktId: k.id });
    db.prepare('UPDATE invoices SET faellig_am = ? WHERE nr = ?').run('2026-01-02', r.nr);
    // Teilzahlung: offen und brutto unterscheiden sich, eine Verwechslung faellt auf.
    rechnung.bucheZahlung(db, { nr: r.nr, datum: tag(h), betrag_eur: 10 });
    return { k, r: rechnung.liste(db).find((x) => x.nr === r.nr) };
  }
  const LOKAL = { lokaleModelle: { upstreamUrl: 'http://127.0.0.1:11434', proxyPort: 11435 } };
  const MIT = (mehr = {}) => ({ cira: { modellLokal: 'klein:1b', claudeErlaubt: false, claudeMonatslimitEur: 5, ...mehr }, ...LOKAL, ...RECHNUNG });
  // Gespielter Modellserver: antwortet je Modell, merkt sich jede Anfrage.
  function chat(je) {
    const anfragen = [];
    const fn = async (url, init = {}) => {
      const b = JSON.parse(init.body);
      anfragen.push(b);
      const a = typeof je === 'function' ? je(b) : je[b.model];
      if (a === undefined) throw new Error('unerwartetes Modell ' + b.model);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: a } }], usage: { total_tokens: 10 } }) };
    };
    return { fn, anfragen, system: () => anfragen.map((b) => b.messages[0].content).join('\n') };
  }
  const dienst = (db, fetchFn, mehr = {}) => cira.erzeuge({ db, bucheVorgang: srv().bucheVorgang, fetchFn, spawnFn: nie('Claude'), claudeExe: 'claude-test.exe', ...mehr });
  const zaehle = (db) => db.prepare('SELECT rolle, COUNT(*) AS n FROM cira_nachricht GROUP BY rolle').all().reduce((a, r) => ({ ...a, [r.rolle]: r.n }), { ich: 0, cira: 0 });
  const httpServer = async (handler) => {
    const s = http.createServer(handler);
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    return { s, port: s.address().port, zu: () => new Promise((ok) => { s.closeAllConnections(); s.close(ok); }) };
  };

  // M-1: eine Rechnungsnummer steht in der Bezeichnung (k), nicht im Wert.
  function guard() {
    const f = [{ k: '2026-0003 Nordlicht', t: '120,00 EUR' }, { k: 'Fällig am', t: '2026-09-01' }];
    const p = (text) => cira.pruefeZahlen(text, f, 'Was ist offen?');
    assert.strictEqual(p('Die Rechnung 2026-0003 ist offen.').gestrichen, 0, 'Nummer aus f.k gestrichen');
    assert.strictEqual(p('Offen sind 120,00 EUR.').gestrichen, 0);
    // Volles Datum aus den Fakten bleibt, auch deutsch geschrieben; fremdes Datum und fremde Zahl fallen.
    assert.strictEqual(p('Sie ist seit 01.09.2026 fällig.').gestrichen, 0, 'Datum aus den Fakten gestrichen');
    assert.strictEqual(p('Sie ist seit 05.09.2026 fällig.').gestrichen, 1, 'fremdes Datum durchgelassen');
    assert.strictEqual(p('Offen sind 999,00 EUR.').gestrichen, 1, 'fremder Betrag durchgelassen');
    assert.strictEqual(p('Die Rechnung 2026-0004 ist offen.').gestrichen, 1, 'fremde Nummer durchgelassen');
  }

  // M-2: Fakten zum gefragten Zeitraum, "Heute", Ueberfaelliges mit Nummer im Text; T2 dieselben.
  async function fakten() {
    const db = arbeitsDb();
    await mitConfig(MIT(), async () => {
      const { r } = mitRechnung(db);
      const s = chat(() => 'Das liegt an weniger Arbeit.');
      await dienst(db, s.fn).frage({ text: 'Warum war der September so schwach?' });
      const sys = s.system();
      assert.ok(/\(September 20\d\d\)/.test(sys), 'Fakten tragen nicht September: ' + sys);
      assert.ok(!/\(Monat\)/.test(sys), 'noch Monatsfakten: ' + sys);
      // Werte des gefragten Zeitraums, nicht nur dessen Name: die Saat-Arbeit liegt heute, im September ist nichts.
      assert.ok(new Date().getMonth() !== 8, 'Test setzt voraus, dass heute nicht September ist');
      assert.ok(/Arbeitswert \(September 20\d\d\) — eigene Zeit zum Stundensatz 0,00 EUR/.test(sys), 'Arbeitswert nicht aus dem September: ' + sys);
      // Der Bezug (u) geht mit: "Offen" allein verwechselte llama3.2 im echten Lauf mit "Überfällig gesamt".
      assert.ok(/Noch nicht abgerechnet \(September 20\d\d\) — Arbeitswert noch ohne Rechnung /.test(sys), 'Bezug fehlt im Prompt: ' + sys);
      assert.ok(sys.includes('Heute ' + tag(new Date())), 'Fakt Heute fehlt: ' + sys);
      for (const teil of [r.nr, r.erstellt_am.slice(0, 10), '2026-01-02', eur(r.rest_eur)]) assert.ok(sys.includes(teil), 'Ueberfaellig ohne ' + teil + ': ' + sys);
      // Gegenprobe: dieselben Werte wie rechnung.liste.
      const f = cira.ueberfaelligFakten(db).fakten;
      assert.ok(f.some((x) => x.t.includes(r.nr) && x.v === r.rest_eur), JSON.stringify(f));
    });
    // T2 bekommt dieselben Fakten (Prompt ist das letzte Argument an claude).
    await mitConfig(MIT({ claudeErlaubt: true }), async () => {
      let prompt = null;
      const spawnFn = (exe, args) => { prompt = args[args.length - 1]; throw new Error('kein Claude im Test'); };
      await dienst(db, nie('Ollama'), { spawnFn }).frage({ text: 'claude: Warum war der September so schwach?' });
      assert.ok(prompt && /\(September 20\d\d\)/.test(prompt) && prompt.includes('Heute ' + tag(new Date())), 'T2 ohne dieselben Fakten: ' + prompt);
    });
  }

  // Kontext-Fakten: Werte nur aus rechnung.liste, metrics.byTicket, kontakte.lade.
  async function kontext() {
    const db = arbeitsDb();
    await mitConfig(MIT(), async () => {
      const { k, r } = mitRechnung(db);
      const wert = (f, k2) => { const x = f.find((y) => y.k === k2); assert.ok(x, k2 + ' fehlt: ' + JSON.stringify(f)); return x; };
      let f = cira.faktenFuerKontext(db, { art: 'rechnung', id: r.nr });
      // Jede Zahl traegt ihren Bezug im Label: neben den Zeitraum-Kennzahlen ist "Offen" allein mehrdeutig.
      assert.strictEqual(wert(f, 'Ausgewählte Rechnung').t, r.nr);
      assert.strictEqual(wert(f, 'Rechnung an').t, 'Nordwind GmbH');
      assert.strictEqual(wert(f, 'Rechnungsdatum').t, r.erstellt_am.slice(0, 10));
      assert.strictEqual(wert(f, 'Rechnung fällig am').t, r.faellig_am);
      assert.strictEqual(wert(f, 'Rechnung brutto').v, r.brutto_eur);
      assert.strictEqual(wert(f, 'Rechnung offen').v, r.rest_eur);
      // Ohne Status hiesse "offen 0,00 EUR" bei einer Stornierten "bezahlt" (Silent-Failure-Review M2).
      assert.strictEqual(wert(f, 'Rechnung Status').t, r.status_abgeleitet || r.status);
      assert.ok(r.rest_eur > 0 && Math.abs(r.brutto_eur - r.rest_eur - 10) < 0.005, 'Saat: Teilzahlung ' + r.brutto_eur + ' / ' + r.rest_eur);
      const t = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-1');
      f = cira.faktenFuerKontext(db, { art: 'vorgang', id: 'ABC-1' });
      assert.strictEqual(wert(f, 'Ausgewählter Vorgang').t, 'ABC-1');
      assert.strictEqual(wert(f, 'Vorgang Stunden — Claude und manuell').v, t.active_hours + (t.manuell_hours || 0));
      assert.strictEqual(wert(f, 'Vorgang Arbeitswert — eigene Zeit zum Stundensatz').v, t.arbeitswert);
      assert.strictEqual(wert(f, 'Vorgang Zeitraum').t, t.first_day + ' bis ' + t.last_day);
      // Plausibel statt nur gleich: eine Stunde Arbeit.
      assert.ok(t.active_hours > 0.5 && t.active_hours < 2, 'Saat: ' + t.active_hours);
      f = cira.faktenFuerKontext(db, { art: 'kontakt', id: String(k.id) });
      assert.strictEqual(wert(f, 'Ausgewählter Kontakt').t, 'Nordwind GmbH');
      assert.strictEqual(wert(f, 'Kontakt offene Rechnungen').v, 1);
      assert.strictEqual(wert(f, 'Kontakt offen gesamt').v, r.rest_eur);
      for (const x of [{ art: 'rechnung', id: '2099-9999' }, { art: 'vorgang', id: 'XYZ-9' }, { art: 'kontakt', id: '999' }, { art: 'kontakt', id: 'abc' }, { art: 'zeit', id: 'timer' }, null]) {
        assert.deepStrictEqual(cira.faktenFuerKontext(db, x), [], 'Fakten fuer ' + JSON.stringify(x));
      }
      // Im Prompt angekommen.
      const s = chat(() => 'Die ist offen.');
      await dienst(db, s.fn).frage({ text: 'Was ist mit dieser Rechnung los?', kontext: { art: 'rechnung', id: r.nr, titel: r.nr + ' ausgewählt' } });
      assert.ok(s.system().includes('Ausgewählte Rechnung ' + r.nr), s.system());
    });
  }

  // Wie server.js: Koerper bis 64 KB, JSON.
  function leseKoerper(req, fertig) {
    let roh = '';
    req.on('data', (x) => { roh += x; });
    req.on('end', () => { try { fertig(null, JSON.parse(roh || '{}')); } catch { fertig('Ungueltige Daten'); } });
  }
  const sendJson = (res, d, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(d)); };
  const ciraServer = (d) => httpServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    try { if (!d.routen(req, res, u.pathname, u, { sendJson, leseKoerper })) sendJson(res, { error: 'nicht hier' }, 404); } catch (err) { sendJson(res, { error: err.message }, 500); }
  });

  // Zwischenstufe: die Route schreibt "rolle" (Rolle, Modell) vor "fertig".
  async function strom() {
    const db = arbeitsDb();
    await mitConfig(MIT({ modellDenken: 'gross:8b' }), async () => {
      const d = dienst(db, chat({ 'klein:1b': '[T2]', 'gross:8b': 'Gut.' }).fn);
      const h = await ciraServer(d);
      try {
        const r = await fetch('http://127.0.0.1:' + h.port + '/api/cira/frage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Wie viel ist offen?' }) });
        const zeilen = (await r.text()).trim().split('\n').map((z) => JSON.parse(z));
        const typen = zeilen.map((z) => z.typ);
        const rollen = zeilen.filter((z) => z.typ === 'rolle');
        assert.deepStrictEqual(rollen.map((z) => [z.rolle, z.modell]), [['schnell', 'klein:1b'], ['denken', 'gross:8b']], JSON.stringify(zeilen));
        assert.ok(typen.indexOf('rolle') < typen.indexOf('fertig') && typen[typen.length - 1] === 'fertig', typen.join(','));
      } finally { await h.zu(); }
    });
  }

  // Dienste: "Modellserver" aus modelle.liste (Laufzeit, Anzahl), "Modell-Proxy" ueber /v1/models am Proxy-Port.
  async function dienste() {
    const json = (routen, kopf = {}) => httpServer((req, res) => {
      const v = routen[req.url];
      res.writeHead(v ? 200 : 404, { 'content-type': 'application/json', ...kopf });
      res.end(JSON.stringify(v || {}));
    });
    const KENNUNG = { 'x-c2i-proxy': '1' };
    const lmstudio = await json({ '/v1/models': { data: [{ id: 'qwen3-8b' }, { id: 'gemma-3' }] }, '/api/v1/models': { models: [{}, {}] } });
    const ollama = await json({ '/v1/models': { data: [{ id: 'qwen3:8b' }] }, '/api/version': { version: '0.12.0' }, '/api/tags': { models: [] } });
    const leer = await json({ '/v1/models': { data: [] }, '/api/version': { version: '0.12.0' }, '/api/tags': { models: [] } });
    const proxy = await json({ '/v1/models': { data: [] } }, KENNUNG);
    const kaputt = await httpServer((req, res) => { res.writeHead(502, { 'content-type': 'application/json', ...KENNUNG }); res.end('{"error":"Modellserver nicht erreichbar"}'); });
    // Fremdes Programm auf dem Proxy-Port: antwortet, traegt aber keine Kennung.
    const fremd = await json({ '/v1/models': { data: [] } });
    const lauscht = srv().server.listening;
    try {
      if (!lauscht) await new Promise((ok) => srv().server.listen(0, '127.0.0.1', ok));
      const url = 'http://127.0.0.1:' + srv().server.address().port + '/api/dienste';
      const hole = async () => { srv().diensteCacheLeeren(); return (await (await fetch(url)).json()).dienste; };
      const zeile = (d, name) => d.find((x) => x.name === name);
      await mitConfig({ lokaleModelle: { upstreamUrl: 'http://127.0.0.1:' + lmstudio.port, proxyPort: proxy.port }, jira: { enabled: false }, dienste: {} }, async () => {
        const d = await hole();
        assert.deepStrictEqual(d.map((x) => x.name), ['Modellserver', 'Modell-Proxy', 'Claude', 'Ledger'], JSON.stringify(d));
        assert.deepStrictEqual([zeile(d, 'Modellserver').ok, zeile(d, 'Modellserver').detail], [true, 'LM Studio · 2 Modelle']);
        assert.deepStrictEqual([zeile(d, 'Modell-Proxy').ok, zeile(d, 'Modell-Proxy').detail], [true, 'Port ' + proxy.port]);
      });
      await mitConfig({ lokaleModelle: { upstreamUrl: 'http://127.0.0.1:' + ollama.port, proxyPort: 1 }, jira: { enabled: false }, dienste: {} }, async () => {
        const d = await hole();
        assert.deepStrictEqual([zeile(d, 'Modellserver').ok, zeile(d, 'Modellserver').detail], [true, 'Ollama · 1 Modell']);
        assert.strictEqual(zeile(d, 'Modell-Proxy').ok, false, 'geschlossener Proxy-Port gruen');
        assert.ok(/nicht erreichbar/.test(zeile(d, 'Modell-Proxy').detail));
      });
      await mitConfig({ lokaleModelle: { upstreamUrl: 'http://127.0.0.1:1', proxyPort: proxy.port }, jira: { enabled: false }, dienste: {} }, async () => {
        const m = zeile(await hole(), 'Modellserver');
        assert.ok(m.ok === false && /nicht erreichbar · 127\.0\.0\.1:1$/.test(m.detail), JSON.stringify(m));
      });
      // Proxy laeuft, der Modellserver dahinter nicht (502): der Proxy ist gruen, rot ist der Modellserver.
      await mitConfig({ lokaleModelle: { upstreamUrl: 'http://127.0.0.1:1', proxyPort: kaputt.port }, jira: { enabled: false }, dienste: {} }, async () => {
        const d = await hole();
        assert.deepStrictEqual([zeile(d, 'Modell-Proxy').ok, zeile(d, 'Modell-Proxy').detail], [true, 'Port ' + kaputt.port + ' · Modellserver antwortet nicht'], JSON.stringify(d));
        assert.strictEqual(zeile(d, 'Modellserver').ok, false);
      });
      // Fremdes Programm auf dem Port (Silent-Failure-Review M2): kein gruener Proxy.
      await mitConfig({ lokaleModelle: { upstreamUrl: 'http://127.0.0.1:' + ollama.port, proxyPort: fremd.port }, jira: { enabled: false }, dienste: {} }, async () => {
        const p = zeile(await hole(), 'Modell-Proxy');
        assert.deepStrictEqual([p.ok, p.detail], [false, 'Port ' + fremd.port + ' belegt, kein c2invoice-Proxy'], JSON.stringify(p));
      });
      // Erreichbar, aber kein Modell: Cira kann nichts beantworten.
      await mitConfig({ lokaleModelle: { upstreamUrl: 'http://127.0.0.1:' + leer.port, proxyPort: proxy.port }, jira: { enabled: false }, dienste: {} }, async () => {
        const m = zeile(await hole(), 'Modellserver');
        assert.deepStrictEqual([m.ok, m.detail], [false, 'Ollama · kein Modell'], JSON.stringify(m));
      });
      await mitConfig({ lokaleModelle: undefined }, async () => {
        const d = await hole();
        assert.ok(!zeile(d, 'Modellserver') && !zeile(d, 'Modell-Proxy'), JSON.stringify(d));
      });
    } finally {
      if (!lauscht && srv().server.listening) await new Promise((ok) => srv().server.close(ok));
      for (const h of [lmstudio, ollama, leer, proxy, kaputt, fremd]) await h.zu();
    }
  }

  // Der Server startet den Proxy selbst; belegt = laeuft extern; Probe und fehlende Einrichtung starten nicht.
  async function proxyStart() {
    let aufrufe = 0;
    const gut = async () => { aufrufe++; };
    const belegt = async () => { aufrufe++; throw Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' }); };
    await mitConfig(LOKAL, async () => {
      assert.strictEqual(await srv().starteModellProxy({ start: gut }), 'eigen');
      assert.strictEqual(await srv().starteModellProxy({ start: belegt }), 'extern');
      const alt = process.env.C2I_PROBE;
      process.env.C2I_PROBE = '1';
      try { assert.strictEqual(await srv().starteModellProxy({ start: gut }), null); } finally { if (alt === undefined) delete process.env.C2I_PROBE; else process.env.C2I_PROBE = alt; }
    });
    await mitConfig({ lokaleModelle: undefined }, async () => {
      assert.strictEqual(await srv().starteModellProxy({ start: gut }), null);
    });
    assert.strictEqual(aufrufe, 2, 'Start trotz Probe oder ohne Einrichtung');
    // Der echte Proxy meldet einen belegten Port, statt mit einem unbehandelten 'error' abzustuerzen.
    const proxyMod = require('../../ollama-proxy');
    const block = await httpServer((req, res) => res.end());
    try {
      await assert.rejects(proxyMod.start(block.port), (e) => e.code === 'EADDRINUSE');
    } finally { await block.zu(); }
    // Echter Proxy auf freiem Port: Kennung auf jeder Antwort; eine fremde Seite
    // kommt mit einem "einfachen" POST (ohne Preflight) nicht durch (Security-Review M2).
    // Pfade so gewaehlt, dass auch ein laufender Modellserver nichts tut.
    const s = await proxyMod.start(0);
    const url = 'http://127.0.0.1:' + s.address().port;
    try {
      const r = await fetch(url + '/m2-test-unbekannt');
      assert.strictEqual(r.headers.get('x-c2i-proxy'), '1', 'Kennung fehlt bei ' + r.status);
      await r.arrayBuffer();
      const fremdePost = await fetch(url + '/api/pull', { method: 'POST', headers: { origin: 'https://fremd.example', 'content-type': 'text/plain' }, body: 'x' });
      // Am Text erkennbar, dass der Proxy abweist — Ollama selbst antwortet fremden Origins ebenfalls 403.
      const abgewiesen = await fremdePost.text();
      assert.ok(fremdePost.status === 403 && /nur als JSON/.test(abgewiesen), 'einfacher Cross-Origin-POST durchgereicht: ' + fremdePost.status + ' ' + abgewiesen.slice(0, 80));
      assert.strictEqual(fremdePost.headers.get('x-c2i-proxy'), '1');
      // JSON aus dem Browser (braucht Preflight) und alles ohne Origin (CLI) gehen weiter.
      for (const kopf of [{ origin: 'http://localhost:8765', 'content-type': 'application/json' }, { 'content-type': 'text/plain' }]) {
        const w = await fetch(url + '/m2-test-unbekannt', { method: 'POST', headers: kopf, body: '{}' });
        assert.notStrictEqual(w.status, 403, 'faelschlich abgewiesen: ' + JSON.stringify(kopf));
        await w.arrayBuffer();
      }
    } finally { await new Promise((ok) => { s.closeAllConnections(); s.close(ok); }); }
  }

  async function kette() {
    // Nicht eingerichtet: einmal gesagt, kein Versuch, kein Aufruf.
    await mitConfig({ ...MIT({ modellDenken: 'gross:8b' }), lokaleModelle: undefined }, async () => {
      const n = await dienst(arbeitsDb(), nie('Ollama')).frage({ text: 'Wie viel ist offen?' });
      assert.strictEqual(n.route.versuche.length, 0, JSON.stringify(n.route));
      assert.strictEqual((n.text.match(/nicht eingerichtet/g) || []).length, 1, n.text);
    });
    // Abbruch: die Frage bleibt gespeichert, eine Antwort nicht.
    await mitConfig(MIT({ modellDenken: 'gross:8b' }), async () => {
      const db = arbeitsDb();
      const ac = new AbortController();
      const haengt = (url, init) => new Promise((_, nein) => init.signal.addEventListener('abort', () => nein(Object.assign(new Error('ab'), { name: 'AbortError' }))));
      const pr = dienst(db, haengt).frage({ text: 'Wie viel ist offen?', signal: ac.signal });
      setTimeout(() => ac.abort(), 20);
      const n = await pr;
      assert.ok(n.abgebrochen === true && !n.id, JSON.stringify(n));
      assert.deepStrictEqual(zaehle(db), { ich: 1, cira: 0 }, 'Antwort nach Abbruch gespeichert');
      // Liste "falsch zugeordnet" uebersteht ein kaputtes route_json.
      db.prepare("INSERT INTO cira_nachricht (zeit, kanal, rolle, text, route_json, falsch) VALUES (?, 'dock', 'cira', 'x', '{kaputt', 1)").run(new Date().toISOString());
      const h = await ciraServer(dienst(db, nie('Ollama')));
      try {
        const r = await fetch('http://127.0.0.1:' + h.port + '/api/cira/falsch');
        const roh = await r.text();
        assert.strictEqual(r.status, 200, 'kaputtes route_json: ' + roh);
        assert.deepStrictEqual(JSON.parse(roh).falsch.map((x) => x.grund), ['Route unlesbar']);
      } finally { await h.zu(); }
    });
  }

  // qwen3 denkt ohne Schalter vor jeder Antwort; ausser in der Rolle Denken schaltet /no_think das ab.
  async function noThink() {
    const fall = async (mehr, text) => {
      let n = null;
      await mitConfig(MIT(mehr), async () => {
        const s = chat(() => 'Gut.');
        await dienst(arbeitsDb(), s.fn).frage({ text });
        n = s.anfragen[0].messages[1].content;
      });
      return n;
    };
    assert.strictEqual(await fall({ modellLokal: 'qwen3:8b' }, 'Wie viel ist offen?'), 'Wie viel ist offen? /no_think');
    assert.strictEqual(await fall({ modellLokal: 'qwen3:8b', modellText: 'qwen3:4b' }, 'Entwirf eine freundliche Mail an Nordlicht'), 'Entwirf eine freundliche Mail an Nordlicht /no_think');
    assert.strictEqual(await fall({ modellLokal: '', modellDenken: 'qwen3:8b' }, 'Warum ist der Umsatz gesunken?'), 'Warum ist der Umsatz gesunken?');
    assert.strictEqual(await fall({ modellLokal: 'llama3.2:3b' }, 'Wie viel ist offen?'), 'Wie viel ist offen?');
  }

  return [
    ['Cira M2 Guard: Zahl aus f.k bleibt, Datum aus den Fakten bleibt, fremdes faellt', guard],
    ['Cira M2 Fakten: Zeitraum der Frage, Heute, Ueberfaelliges mit Nummer; T2 dieselben', fakten],
    ['Cira M2 Kontext: Rechnung, Vorgang, Kontakt aus den bestehenden Modulen', kontext],
    ['Cira M2 Strom: NDJSON rolle vor fertig', strom],
    ['Cira M2 Dienste: Modellserver mit Laufzeit, Modell-Proxy rot/gruen', dienste],
    ['Cira M2 Proxy: Server startet den Proxy, belegt = extern, Probe nie', proxyStart],
    ['Cira M2 Kette: nicht eingerichtet einmal, Abbruch ohne Antwort, falsch-Liste robust', kette],
    ['Cira M2 NoThink: /no_think fuer qwen3 ausser Rolle Denken', noThink],
  ];
};
