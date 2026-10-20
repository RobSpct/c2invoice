'use strict';
// Masterplan 3.0, Block C2: Cira-Kern (Router T0 -> T1 -> T2, Validator),
// Freigaben mit Registry und Protokoll, Ereignis-Strom, Einstellungen -> Cira.
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ configGeschuetzt, dbmod, openDbs }) => {
  const cira = require('../../cira');
  const metrics = require('../../metrics');
  const rechnung = require('../../rechnung');
  const zeit = require('../../zeit');
  const ingest = require('../../ingest');
  const freigaben = require('../../freigaben');
  const ereignisse = require('../../ereignisse');
  const srv = () => require('../../server');
  const ZIFFER = /\d/;

  function neueDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    return db;
  }
  // Arbeit im laufenden Monat: zwei Sitzungen mit Eingaben, damit Stunden und Arbeitswert > 0 sind.
  function arbeitsDb(jetzt = Date.now()) {
    const db = neueDb();
    const insE = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, cwd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insA = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)');
    let n = 0;
    const zeile = (session, ms, projekt, ticket, usd = 0.1) => {
      const ts = new Date(ms).toISOString();
      insE.run('c2-' + n++, ts, session, projekt, 'main', ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, usd, 0, ts.slice(0, 10), null);
      insA.run(session, ts, projekt, 'main', ticket, ts.slice(0, 10), 1);
    };
    // Heute frueh, damit alles im laufenden Monat liegt.
    const h = new Date(jetzt);
    const basis = new Date(h.getFullYear(), h.getMonth(), h.getDate(), 0, 30).getTime();
    for (let m = 0; m <= 60; m += 3) zeile('s-arbeit', basis + m * 60000, 'Kunde', 'ABC-1');
    return { db, zeile, basis };
  }
  const nie = (name) => () => { throw new Error(name + ' darf hier nicht laufen'); };
  function dienst(db, mehr = {}) {
    return cira.erzeuge({ db, bucheVorgang: srv().bucheVorgang, fetchFn: nie('Ollama'), spawnFn: nie('Claude'), claudeExe: 'claude-test.exe', ...mehr });
  }
  // Config nur im Speicher aendern (die Datei bleibt unberuehrt).
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, v] of Object.entries(werte)) cfg[k] = v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  const lmAn = () => ({ ...(require(CFG).lokaleModelle || {}), upstreamUrl: 'http://127.0.0.1:11434', proxyPort: 11435 });
  function ollamaAntwort(text) {
    const aufrufe = [];
    const fn = async (url, init) => {
      aufrufe.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }], usage: { total_tokens: 42 } }) };
    };
    return { fn, aufrufe };
  }
  // Ein claude -p, das die gegebenen Stream-Zeilen ausgibt.
  function fakeClaude(zeilen, { haengt = false } = {}) {
    const aufrufe = [];
    let getoetet = 0;
    const fn = (exe, args, opts) => {
      aufrufe.push({ exe, args, opts });
      const k = new EventEmitter();
      k.stdout = new PassThrough(); k.stderr = new PassThrough(); k.exitCode = null;
      k.kill = () => { getoetet++; k.stdout.end(); k.stderr.end(); };
      k.stdout.on('end', () => setImmediate(() => { k.exitCode = 0; k.emit('close', 0, null); }));
      setImmediate(() => { for (const z of zeilen) k.stdout.write(JSON.stringify(z) + '\n'); if (!haengt) { k.stdout.end(); k.stderr.end(); } });
      return k;
    };
    return { fn, aufrufe, getoetet: () => getoetet };
  }
  const monatOpts = (d = new Date()) => {
    const t = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    return { from: t(new Date(d.getFullYear(), d.getMonth(), 1)), to: t(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  };
  const de = (v) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' EUR';

  async function t0Monat() {
    const { db } = arbeitsDb();
    const o = monatOpts();
    // Dieselben Aufrufe wie GET /api/kennzahlen.
    const k = metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
    assert.ok(k.wert.arbeitswert > 0 && k.aktive_stunden > 0 && k.aktive_stunden < 24, 'Saat ohne plausible Arbeit: ' + JSON.stringify([k.wert.arbeitswert, k.aktive_stunden]));
    const n = await dienst(db).frage({ text: 'Wie lief der Monat?' });
    assert.strictEqual(n.stufe, 'T0');
    assert.strictEqual(n.kosten_eur, 0);
    assert.strictEqual(n.quelle, 'Zahlen aus c2invoice');
    assert.ok(n.text.includes('Arbeitswert ' + de(k.wert.arbeitswert)), n.text);
    assert.ok(n.text.includes('Noch nicht abgerechnet ' + de(k.offen_eur)), n.text);
    assert.ok(n.text.includes('Abgerechnet ' + de(k.abgerechnet_eur + k.abgerechnet_manuell_eur)), n.text);
    // "Warum …" ist keine Kennzahlen-Abfrage, sondern geht an T1.
    assert.strictEqual(cira.t0('Warum ist die Marge gestiegen?'), null);
    for (const [frage, absicht] of [['Wie lief das Quartal?', 'kennzahlen'], ['Was ist überfällig?', 'ueberfaellig'], ['Wo gehen die Token hin?', 'verbrauch'],
      ['Timer stoppen', 'timer'], ['Tagesbericht', 'tagesbericht'], ['Buch das auf ABC-12', 'buchen'], ['Starte debug für ABC-1', 'skill']]) {
      const t = cira.t0(frage);
      assert.ok(t && t.absicht.name === absicht, frage + ' -> ' + (t && t.absicht.name));
    }
    // Ein genannter Monat in der Zukunft meint das Vorjahr.
    const z = cira.zeitraumAus('Wie lief der Dezember?', new Date(2026, 9, 15));
    assert.deepStrictEqual([z.von, z.bis], ['2025-12-01', '2025-12-31']);
  }

  async function t1OhneOllama() {
    const { db } = arbeitsDb();
    await mitConfig({ cira: { modellLokal: 'mini:1b' }, lokaleModelle: lmAn() }, async () => {
      const fetchFn = async () => { throw new Error('ECONNREFUSED'); };
      const n = await dienst(db, { fetchFn }).frage({ text: 'Was denkst du über meinen Monat?' });
      assert.strictEqual(n.stufe, 'T1');
      assert.strictEqual(n.quelle, 'lokal nicht erreichbar');
      assert.ok(/nicht erreichbar/.test(n.text), n.text);
      assert.ok(!ZIFFER.test(n.text), 'Ziffer ohne Fakten-Antwort: ' + n.text);
    });
    await mitConfig({ cira: { modellLokal: '' }, lokaleModelle: lmAn() }, async () => {
      const n = await dienst(db).frage({ text: 'Was denkst du über meinen Monat?' });
      assert.ok(n.stufe === 'T1' && /Kein lokales Modell/.test(n.text) && !ZIFFER.test(n.text), n.text);
    });
  }

  async function validator() {
    // Ohne Fakten bleibt keine Ziffer stehen.
    const leer = cira.pruefeZahlen('Du hast 12 Rechnungen. Das ist gut. Am 3. Mai war mehr los.', [], 'Wie läuft es?');
    assert.ok(!ZIFFER.test(leer.text) && leer.gestrichen === 2, JSON.stringify(leer));
    // Fakten-Zahlen und Zahlen aus der Frage bleiben, in deutscher Schreibweise wie gerundet.
    const f = [{ k: 'Arbeitswert', v: 1234.567, t: '1.234,57 EUR' }];
    assert.strictEqual(cira.pruefeZahlen('Arbeitswert 1.234,57 EUR. Rund 1235 EUR. R-2026-041 ist offen.', f, 'Was ist mit R-2026-041?').gestrichen, 0);
    // Durch die Kette: Fake-Ollama erfindet eine Zahl, sie erreicht die Antwort nicht.
    const { db } = arbeitsDb();
    const o = monatOpts();
    const k = metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
    const echt = de(k.wert.arbeitswert);
    await mitConfig({ cira: { modellLokal: 'mini:1b' }, lokaleModelle: lmAn() }, async () => {
      const ol = ollamaAntwort('Dein Arbeitswert liegt bei ' + echt + '. Du hast 4711 Kunden betreut.');
      const n = await dienst(db, { fetchFn: ol.fn }).frage({ text: 'Erzähl mir was über den Monat' });
      assert.strictEqual(n.stufe, 'T1');
      assert.ok(n.text.includes(echt), 'echte Zahl gestrichen: ' + n.text);
      assert.ok(!n.text.includes('4711'), 'erfundene Zahl durchgekommen: ' + n.text);
      assert.strictEqual(n.gestrichen, 1);
      // T1 bekommt nur die Fakten, keine Rohdaten.
      const sys = ol.aufrufe[0].body.messages[0].content;
      assert.ok(sys.includes('FAKTEN: ') && sys.includes(echt) && !sys.includes('s-arbeit'), sys);
      assert.strictEqual(ol.aufrufe[0].url, 'http://127.0.0.1:11435/v1/chat/completions');
    });
  }

  const T2_ZEILEN = [
    { type: 'system', subtype: 'init', session_id: 'sess-c2' },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Ich habe die Fakten gelesen. ' } } },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Es sind 4711 Kunden.' } } },
    { type: 'result', result: 'Ich habe die Fakten gelesen. Es sind 4711 Kunden.', session_id: 'sess-c2', total_cost_usd: 0.12, usage: { input_tokens: 100, output_tokens: 20 } },
  ];
  async function t2() {
    const { db } = arbeitsDb();
    const cl = fakeClaude(T2_ZEILEN);
    // Aus: kein Prozess.
    await mitConfig({ cira: { claudeErlaubt: false, claudeMonatslimitEur: 5 } }, async () => {
      const n = await dienst(db, { spawnFn: cl.fn }).frage({ text: 'claude: schreib mir einen Satz' });
      assert.ok(n.stufe === 'T2' && /ausgeschaltet/.test(n.text) && cl.aufrufe.length === 0, n.text);
    });
    await mitConfig({ cira: { claudeErlaubt: true, claudeMonatslimitEur: 5, claudeModell: 'sonnet' } }, async () => {
      const deltas = [];
      process.env.C2_TEST_TOKEN = 'geheim';
      let n;
      try { n = await dienst(db, { spawnFn: cl.fn }).frage({ text: 'claude: schreib mir einen Satz' }, (e) => { if (e.typ === 'text') deltas.push(e.text); }); } finally { delete process.env.C2_TEST_TOKEN; }
      assert.strictEqual(cl.aufrufe.length, 1);
      const a = cl.aufrufe[0];
      assert.strictEqual(a.opts.cwd, ingest.CIRA_ORDNER);
      assert.ok(!('C2_TEST_TOKEN' in a.opts.env), 'Geheimnis im Kindprozess');
      const i = a.args.indexOf('--tools');
      assert.strictEqual(a.args[i + 1], 'Read,Glob,Grep');
      assert.ok(a.args.includes('--setting-sources') && a.args[a.args.indexOf('--disallowedTools') + 1].includes('Bash') && a.args.includes('sonnet'), a.args.join(' '));
      assert.strictEqual(a.args[a.args.length - 2], '--');
      // T2 darf entwerfen (dafuer ist es da); nur Zahlen bleiben an die Fakten gebunden.
      const prompt = a.args[a.args.length - 1];
      assert.ok(!prompt.includes('[T2]') && /Texte entwerfen/.test(prompt) && prompt.includes('FAKTEN: ') && prompt.endsWith('FRAGE: schreib mir einen Satz'), prompt);
      assert.ok(!a.args.includes('--permission-mode'), 'Lese-Profil darf nicht schreiben');
      assert.ok(a.args.includes('--strict-mcp-config'), 'MCP-Server des Nutzers geladen');
      // Budget je Lauf = Rest des Monatslimits in USD (Limit 5 EUR, noch nichts verbraucht).
      const budget = Number(a.args[a.args.indexOf('--max-budget-usd') + 1]);
      assert.ok(Math.abs(budget - 5 / metrics.usdToEur(1)) < 0.011, 'Budget ' + budget);
      assert.strictEqual(n.stufe, 'T2');
      assert.ok(!n.text.includes('4711') && n.text.includes('Fakten gelesen'), n.text);
      assert.ok(!deltas.join('').includes('4711') && deltas.join('').includes('Fakten gelesen'), 'Strom: ' + deltas.join('|'));
      assert.strictEqual(n.kosten_eur, Math.round(metrics.usdToEur(0.12) * 10000) / 10000);
      const lauf = db.prepare('SELECT * FROM cira_lauf').all();
      assert.deepStrictEqual(lauf.map((l) => [l.session_id, l.ok, l.kosten_usd, l.profil]), [['sess-c2', 1, 0.12, 'lesen']]);
    });
    // Ohne Eintraege in config.json gelten dieselben Standards wie in der Oberflaeche (5 EUR, sonnet).
    const db5 = arbeitsDb().db;
    const cl5 = fakeClaude(T2_ZEILEN);
    await mitConfig({ cira: { claudeErlaubt: true } }, async () => {
      await dienst(db5, { spawnFn: cl5.fn }).frage({ text: 'claude: schreib mir einen Satz' });
      const a5 = cl5.aufrufe[0] && cl5.aufrufe[0].args;
      assert.ok(a5 && a5[a5.indexOf('--model') + 1] === 'sonnet', 'Modell: ' + (a5 && a5.join(' ')));
      assert.ok(Math.abs(Number(a5[a5.indexOf('--max-budget-usd') + 1]) - 5 / metrics.usdToEur(1)) < 0.011);
      assert.strictEqual(srv().ciraEinstellungen().claudeMonatslimitEur, 5);
    });
    // Monatslimit erreicht: kein weiterer Lauf.
    db.prepare("INSERT INTO cira_lauf (zeit, session_id, profil, ok, kosten_usd, tokens) VALUES (?, 'alt', 'lesen', 1, 50, 0)").run(new Date().toISOString());
    await mitConfig({ cira: { claudeErlaubt: true, claudeMonatslimitEur: 5 } }, async () => {
      const n = await dienst(db, { spawnFn: cl.fn }).frage({ text: 'claude: noch einer' });
      assert.ok(/Monatslimit/.test(n.text) && cl.aufrufe.length === 1, n.text);
    });
    // Haengt der Lauf, beendet ihn die Zeitgrenze; bis zum Ergebnis zaehlt das Budget als verbraucht.
    const db3 = arbeitsDb().db;
    const cl3 = fakeClaude([{ type: 'system', subtype: 'init', session_id: 'sess-haengt' }], { haengt: true });
    await mitConfig({ cira: { claudeErlaubt: true, claudeMonatslimitEur: 5 } }, async () => {
      const d3 = dienst(db3, { spawnFn: cl3.fn, t2MaxMs: 50 });
      // Eigene Uhr: ohne Zeitgrenze im Code hinge der Test, und Node endete still ohne Befund.
      let wecker;
      const n = await Promise.race([d3.frage({ text: 'claude: haeng dich auf' }),
        new Promise((_, nein) => { wecker = setTimeout(() => nein(new Error('T2 haengt ohne Zeitgrenze')), 3000); })]).finally(() => clearTimeout(wecker));
      assert.ok(cl3.getoetet() === 1 && /abgebrochen/.test(n.text), n.text);
      const l = db3.prepare('SELECT ok, kosten_usd, fehler FROM cira_lauf').all();
      assert.ok(l.length === 1 && l[0].ok === 0 && l[0].kosten_usd > 5 && /Obergrenze/.test(l[0].fehler), JSON.stringify(l));
      // Danach ist T2 wieder frei (nicht dauerhaft "arbeitet noch"): das Limit ist jetzt erschoepft.
      assert.ok(/Monatslimit/.test((await d3.frage({ text: 'claude: nochmal' })).text));
      // Bricht der Browser ab, endet der Lauf sofort.
      const db4 = arbeitsDb().db;
      const cl4 = fakeClaude([], { haengt: true });
      const ac = new AbortController();
      const p4 = dienst(db4, { spawnFn: cl4.fn, t2MaxMs: 60000 }).frage({ text: 'claude: lange Frage', signal: ac.signal });
      const t4 = Date.now();
      setTimeout(() => ac.abort(), 30);
      const n4 = await p4;
      // Sofort, nicht erst ueber die Zeitgrenze von 60 s.
      assert.ok(cl4.getoetet() === 1 && /abgebrochen/.test(n4.text) && Date.now() - t4 < 2000, n4.text + ' nach ' + (Date.now() - t4) + ' ms');
    });
    // T1 gibt mit der Marke ab -> Claude nur als Angebot (Owner 15.10., Modell-Block), erst der Klick startet T2.
    const db2 = arbeitsDb().db;
    const cl2 = fakeClaude(T2_ZEILEN);
    await mitConfig({ cira: { claudeErlaubt: true, claudeMonatslimitEur: 5, modellLokal: 'mini:1b' }, lokaleModelle: lmAn() }, async () => {
      const d2 = dienst(db2, { spawnFn: cl2.fn, fetchFn: ollamaAntwort('[T2]').fn });
      const n = await d2.frage({ text: 'Entwirf eine Mahnung im freundlichen Ton' });
      assert.ok(n.stufe === 'T1' && cl2.aufrufe.length === 0 && n.angebot && n.angebot.frage === 'claude: Entwirf eine Mahnung im freundlichen Ton', JSON.stringify(n));
      const n2 = await d2.frage({ text: n.angebot.frage });
      assert.ok(n2.stufe === 'T2' && cl2.aufrufe.length === 1, n2.stufe);
    });
  }

  function ciraOrdner() {
    assert.strictEqual(ingest.projectOf(ingest.CIRA_ORDNER), '(cira)');
    assert.strictEqual(ingest.projectOf(ingest.CIRA_ORDNER.replace(/\\/g, '/') + '/'), '(cira)');
    assert.notStrictEqual(ingest.projectOf(path.join(ingest.CIRA_ORDNER, '..')), '(cira)');
    assert.ok(metrics.isOverhead('(cira)'));
    // Ein Cira-Lauf neben der Arbeit nimmt dem Vorgang keine Zeit und keine Kosten.
    const { db, zeile, basis } = arbeitsDb();
    const vorher = metrics.byTicket(db, {}).find((t) => t.ticket === 'ABC-1');
    for (let m = 10; m <= 20; m += 2) zeile('s-cira', basis + m * 60000, '(cira)', null, 0.05);
    const nachher = metrics.byTicket(db, {}).find((t) => t.ticket === 'ABC-1');
    assert.strictEqual(nachher.active_hours, vorher.active_hours, 'Cira nimmt dem Vorgang Zeit');
    assert.strictEqual(nachher.cost_usd, vorher.cost_usd);
    const je = metrics.werkzeugeJeTicket(db, {});
    assert.ok(![...je.values()].some((w) => JSON.stringify(w).includes('cira')), 'Cira-Kosten auf einem Vorgang');
    const projekt = metrics.byProject(db, {}).find((p) => p.project === '(cira)');
    assert.ok(projekt && projekt.overhead && Math.abs(projekt.cost_usd - 0.3) < 1e-9, JSON.stringify(projekt));
  }

  async function schreibend() {
    // Buchen: dieselbe Zeile wie bucheVorgang direkt.
    const jetzt = Date.now();
    // Hintergrund-Arbeit 3 h frueher: arbeitsDb() legt sie auf heute 00:30–01:30,
    // kurz nach Mitternacht laege sie in der Zukunft und zaehlte als laufende Sitzung.
    const frueher = jetzt - 3 * 3600000;
    const a = arbeitsDb(frueher); const b = arbeitsDb(frueher);
    for (const x of [a, b]) x.zeile('s-live', jetzt - 30000, 'Kunde', null);
    const n = await dienst(a.db).frage({ text: 'Buch das auf abc-12' });
    assert.ok(/gebucht/.test(n.text), n.text);
    srv().bucheVorgang(b.db, { session_id: 's-live', vorgang: 'abc-12' });
    const zeileVon = (db) => db.prepare('SELECT session_id, ticket, note FROM overrides').all();
    assert.deepStrictEqual(zeileVon(a.db), zeileVon(b.db));
    assert.strictEqual(a.db.prepare("SELECT COUNT(*) AS n FROM events WHERE session_id = 's-live' AND ticket = 'ABC-12'").get().n, 1);
    const log = a.db.prepare("SELECT * FROM aktion_log WHERE art = 'buchen'").all();
    assert.ok(log.length === 1 && log[0].quelle === 'cira' && JSON.parse(log[0].nachher_json).ticket === 'ABC-12', JSON.stringify(log));
    // Zwei laufende Sitzungen: Rueckfrage statt Raten.
    const c = arbeitsDb(frueher);
    c.zeile('s-1', jetzt - 20000, 'Kunde', null); c.zeile('s-2', jetzt - 10000, 'Kunde', null);
    const r = await dienst(c.db).frage({ text: 'buch das auf ABC-9' });
    assert.ok(/welche meinst du/.test(r.text) && c.db.prepare('SELECT COUNT(*) AS n FROM overrides').get().n === 0, r.text);
    // Mit gewaehlter Sitzung im Kontext gilt diese.
    const r2 = await dienst(c.db).frage({ text: 'buch das auf ABC-9', kontext: { art: 'sitzung', id: 's-1' } });
    assert.ok(/gebucht/.test(r2.text) && c.db.prepare("SELECT ticket FROM overrides WHERE session_id = 's-1'").get().ticket === 'ABC-9', r2.text);

    // Timer: dieselbe Zeile wie zeit.timerStop direkt.
    const d1 = neueDb(), d2 = neueDb();
    const start = jetzt - 30 * 60000;
    for (const d of [d1, d2]) zeit.timerStart(d, { ziel_art: 'intern', ziel_schluessel: 'Planung', taetigkeit: 'Konzept' }, start);
    const t = await dienst(d1).frage({ text: 'Timer stoppen' });
    assert.ok(/Timer gestoppt/.test(t.text), t.text);
    zeit.timerStop(d2);
    const ez = (d) => d.prepare('SELECT ziel_art, ziel_schluessel, taetigkeit, start, rohzeit_min, gezaehlt_min, abrechenbar FROM zeit_eintrag').all();
    assert.deepStrictEqual(ez(d1), ez(d2));
    assert.strictEqual(ez(d1).length, 1);
    assert.strictEqual(zeit.timerAktuell(d1), null);
    assert.strictEqual(d1.prepare("SELECT COUNT(*) AS n FROM aktion_log WHERE art = 'timer_stopp'").get().n, 1);
    const ohne = await dienst(d1).frage({ text: 'Timer stoppen' });
    assert.strictEqual(ohne.text, 'Es läuft kein Timer.');
  }

  async function freigabe() {
    const db = neueDb();
    const gesehen = [];
    const hoer = (e) => gesehen.push(e);
    ereignisse.bus.on('ereignis', hoer);
    try {
      const lauf = [];
      freigaben.registriere('test_c2', async (d, nutzlast, { hinweis }) => { lauf.push({ nutzlast, hinweis }); return { gemacht: true }; });
      const f = freigaben.anlegen(db, { art: 'test_c2', bezug: 'R-1', titel: 'Testaktion', text: 'Vorschau', nutzlast: { a: 1 }, quelle: 'cira' });
      assert.strictEqual(freigaben.offenAnzahl(db), 1);
      assert.ok(gesehen.some((e) => e.art === 'freigabe' && e.daten.id === f.id) && gesehen.some((e) => e.art === 'zaehler' && e.daten.freigaben === 1));
      const ok = await freigaben.entscheide(db, f.id, { wahl: 'ok', hinweis: 'passt' });
      assert.deepStrictEqual(lauf, [{ nutzlast: { a: 1 }, hinweis: 'passt' }]);
      assert.strictEqual(ok.status, 'erledigt');
      assert.deepStrictEqual(ok.ergebnis, { gemacht: true });
      const log = db.prepare('SELECT * FROM aktion_log').all();
      assert.ok(log.length === 1 && log[0].art === 'test_c2:ok' && log[0].quelle === 'freigabe:' + f.id && log[0].objekt === 'R-1', JSON.stringify(log));
      // Zweiter Klick: nichts passiert.
      await assert.rejects(freigaben.entscheide(db, f.id, { wahl: 'ok' }), (e) => e.status === 409);
      assert.strictEqual(lauf.length, 1);
      // Ablehnen fuehrt nichts aus.
      const g = freigaben.anlegen(db, { art: 'test_c2', titel: 'Zweite', quelle: 'cira' });
      assert.strictEqual((await freigaben.entscheide(db, g.id, { wahl: 'ablehnen' })).status, 'abgelehnt');
      assert.strictEqual(lauf.length, 1);
      // Scheitert die Aktion, bleibt die Freigabe offen.
      freigaben.registriere('test_c2_kaputt', () => { throw new Error('SMTP weg'); });
      const k = freigaben.anlegen(db, { art: 'test_c2_kaputt', titel: 'Kaputt', quelle: 'cira' });
      await assert.rejects(freigaben.entscheide(db, k.id, { wahl: 'ok' }), /SMTP weg/);
      assert.strictEqual(db.prepare('SELECT status FROM freigabe WHERE id = ?').get(k.id).status, 'offen');
      // Art ohne Aktion: nur ablehnen.
      const u = freigaben.anlegen(db, { art: 'gibt_es_nicht', titel: 'Ohne Aktion', quelle: 'cira' });
      assert.strictEqual(u.ausfuehrbar, false);
      await assert.rejects(freigaben.entscheide(db, u.id, { wahl: 'ok' }), (e) => e.status === 409);
      assert.strictEqual(db.prepare('SELECT status FROM freigabe WHERE id = ?').get(u.id).status, 'offen');
      // Eingaben ausserhalb der Form.
      for (const boese of [{ art: 'A B', titel: 'x', quelle: 'cira' }, { art: 'test_c2', titel: '', quelle: 'cira' }, { art: 'test_c2', titel: 'x', quelle: 'irgendwer' }]) {
        assert.throws(() => freigaben.anlegen(db, boese), Error, JSON.stringify(boese));
      }
      await assert.rejects(freigaben.entscheide(db, f.id, { wahl: 'vielleicht' }));
      assert.strictEqual(freigaben.offenAnzahl(db), 2);
      // Absturz waehrend einer Aktion: beim Start wird "laeuft" sichtbar zu "fehler".
      const h = freigaben.anlegen(db, { art: 'test_c2', titel: 'Haengt', quelle: 'cira' });
      db.prepare("UPDATE freigabe SET status = 'laeuft' WHERE id = ?").run(h.id);
      dienst(db);
      assert.strictEqual(db.prepare('SELECT status FROM freigabe WHERE id = ?').get(h.id).status, 'fehler');
      assert.ok(freigaben.liste(db, { status: 'fehler' }).some((x) => x.id === h.id));
    } finally {
      ereignisse.bus.off('ereignis', hoer);
      freigaben.REGISTRY.delete('test_c2'); freigaben.REGISTRY.delete('test_c2_kaputt');
    }
  }

  // Wie server.js: Koerper bis 64 KB, JSON.
  function leseKoerper(req, fertig) {
    let roh = '';
    req.on('data', (s) => { roh += s; });
    req.on('end', () => { try { fertig(null, JSON.parse(roh || '{}')); } catch { fertig('Ungueltige Daten'); } });
  }
  const sendJson = (res, d, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(d)); };
  async function routen() {
    const { db } = arbeitsDb();
    const d = dienst(db);
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (!d.routen(req, res, u.pathname, u, { sendJson, leseKoerper })) sendJson(res, { error: 'nicht hier' }, 404);
    });
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    const url = (p) => 'http://127.0.0.1:' + s.address().port + p;
    const post = (p, body) => fetch(url(p), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    try {
      const r = await post('/api/cira/frage', { text: 'Wie lief der Monat?', kanal: 'dock', kontext: { screen: 'hub', titel: 'Finanzen' } });
      assert.strictEqual(r.headers.get('content-type'), 'application/x-ndjson; charset=utf-8');
      const zeilen = (await r.text()).trim().split('\n').map((z) => JSON.parse(z));
      assert.deepStrictEqual(zeilen[0], { typ: 'stufe', stufe: 'T0' });
      const f = zeilen[zeilen.length - 1];
      assert.ok(f.typ === 'fertig' && f.stufe === 'T0' && f.quelle === 'Zahlen aus c2invoice' && f.antwort.includes('Arbeitswert') && Array.isArray(f.sprung), JSON.stringify(f));
      for (const k of ['kosten_eur', 'tokens', 'szene', 'herleitung_id', 'freigabe_id']) assert.ok(k in f, k + ' fehlt');
      assert.strictEqual((await post('/api/cira/frage', { text: '' })).status, 400);
      assert.strictEqual((await post('/api/cira/frage', { text: 'x'.repeat(2001) })).status, 400);
      const v = await (await fetch(url('/api/cira/verlauf?kanal=dock'))).json();
      assert.deepStrictEqual(v.verlauf.map((x) => x.rolle), ['ich', 'cira']);
      assert.strictEqual(v.verlauf[1].stufe, 'T0');
      const vs = await (await fetch(url('/api/cira/vorschlaege?screen=hub'))).json();
      assert.ok(Array.isArray(vs.vorschlaege) && vs.vorschlaege.length >= 1 && vs.vorschlaege.length <= 4 && vs.vorschlaege.every((x) => cira.t0(x)), JSON.stringify(vs));
      // SSE: ein Bus-Ereignis erreicht den offenen Strom.
      const ctrl = new AbortController();
      const strom = await fetch(url('/api/ereignisse'), { signal: ctrl.signal });
      assert.strictEqual(strom.headers.get('content-type'), 'text/event-stream; charset=utf-8');
      const leser = strom.body.getReader();
      const fg = freigaben.anlegen(db, { art: 'test_sse', titel: 'SSE', quelle: 'cira' });
      let text = '';
      const bis = Date.now() + 3000;
      while (!text.includes('event: freigabe') && Date.now() < bis) text += new TextDecoder().decode((await leser.read()).value || new Uint8Array());
      ctrl.abort();
      assert.ok(text.includes('event: freigabe') && text.includes('"id":' + fg.id), text);
      const liste = await (await fetch(url('/api/freigaben'))).json();
      assert.ok(liste.freigaben.some((x) => x.id === fg.id && x.ausfuehrbar === false));
      // Entscheiden nur aus der eigenen Seite: ohne Browser-Herkunft 403, auch fuer curl.
      const ent = (body, kopf = {}) => fetch(url('/api/freigaben/' + fg.id + '/entscheide'), { method: 'POST', headers: { 'content-type': 'application/json', ...kopf }, body: JSON.stringify(body) });
      assert.strictEqual((await ent({ wahl: 'ablehnen' })).status, 403);
      assert.strictEqual((await ent({ wahl: 'ablehnen' }, { 'sec-fetch-site': 'cross-site' })).status, 403);
      assert.strictEqual((await ent({ wahl: 'ok' }, { 'sec-fetch-site': 'same-origin' })).status, 409);
      assert.strictEqual((await (await ent({ wahl: 'ablehnen' }, { origin: 'http://127.0.0.1:' + s.address().port })).json()).freigabe.status, 'abgelehnt');
      // SSE nur fuer die eigene Seite und begrenzt.
      assert.strictEqual((await fetch(url('/api/ereignisse'), { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
      const offen = [];
      try {
        for (let i = 0; i < ereignisse.MAX_VERBINDUNGEN; i++) { const c = new AbortController(); const r2 = await fetch(url('/api/ereignisse'), { signal: c.signal }); offen.push(c); assert.strictEqual(r2.status, 200); }
        assert.strictEqual((await fetch(url('/api/ereignisse'))).status, 429);
      } finally { for (const c of offen) c.abort(); }
      assert.strictEqual((await fetch(url('/api/freigaben?status=quatsch'))).status, 400);
    } finally {
      await new Promise((ok) => { s.closeAllConnections(); s.close(ok); });
    }
    // /api/zaehler traegt die offenen Freigaben (echter Server, nur lesend).
    const S = srv();
    const lauscht = S.server.listening;
    if (!lauscht) await new Promise((ok) => S.server.listen(0, '127.0.0.1', ok));
    try {
      const z = await (await fetch('http://127.0.0.1:' + S.server.address().port + '/api/zaehler')).json();
      assert.ok(Number.isInteger(z.freigaben) && z.freigaben >= 0 && Number.isInteger(z.live), JSON.stringify(z));
    } finally { if (!lauscht) await new Promise((ok) => S.server.close(ok)); }
  }

  function einstellungenCira() {
    configGeschuetzt(() => {
      const S = srv();
      const ex = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.example.json'), 'utf8'));
      for (const k of Object.keys(S.CIRA_FELDER)) assert.ok(ex.cira && Object.hasOwn(ex.cira, k), 'config.example.json ohne cira.' + k);
      assert.ok(S.SCHREIBBAR.includes('cira'));
      for (const boese of [{ anrede: '<b>Hi</b>' }, { modellLokal: 'a b' }, { claudeErlaubt: 'ja' }, { claudeModell: 'gpt' },
        { claudeMonatslimitEur: 0 }, { claudeMonatslimitEur: 1000 }, { claudeMonatslimitEur: 'x' }, { nichtStoerenAb: '25:00' },
        { claudeExe: 'C:/x.exe' }, { name: 'Bob' }, { unbekannt: 1 }, {}, { modellLokal: '../x' }, { modellLokal: '-x' }, { modellLokal: 'a/b/c' }]) {
        assert.throws(() => S.setzeCira(boese), Error, 'nimmt ' + JSON.stringify(boese));
      }
      assert.throws(() => S.setzeCira({ claudeExe: 'x' }), /nur in config.json/);
      const vorher = JSON.parse(fs.readFileSync(CFG, 'utf8'));
      // Modelle nur aus der Liste des Modellservers (Modell-Block); die Liste kommt hier als Parameter.
      const r = S.setzeCira({ anrede: 'Alex', modellLokal: 'llama3.2:3b', claudeErlaubt: true, claudeModell: 'haiku', claudeMonatslimitEur: '12.5', nichtStoerenAb: '21:30', nichtStoerenBis: '' }, ['llama3.2:3b']);
      assert.deepStrictEqual([r.anrede, r.modellLokal, r.claudeErlaubt, r.claudeModell, r.claudeMonatslimitEur, r.nichtStoerenAb, r.nichtStoerenBis],
        ['Alex', 'llama3.2:3b', true, 'haiku', 12.5, '21:30', '']);
      const nachher = JSON.parse(fs.readFileSync(CFG, 'utf8'));
      assert.strictEqual(nachher.cira.claudeModell, 'haiku');
      // Nur die Cira-Felder aendern sich; name und claudeExe bleiben, wie sie in der Datei stehen.
      const ohneCira = (c) => JSON.stringify({ ...c, cira: undefined });
      assert.strictEqual(ohneCira(nachher), ohneCira(vorher));
      assert.strictEqual((nachher.cira || {}).name, (vorher.cira || {}).name);
      assert.strictEqual((nachher.cira || {}).claudeExe, (vorher.cira || {}).claudeExe);
    });
  }

  return [
    ['Cira C2: T0 Monat ohne Modell, Zahlen wie metrics.kennzahlen', t0Monat],
    ['Cira C2: T1 ohne Ollama meldet lokal nicht erreichbar, keine Ziffer', t1OhneOllama],
    ['Cira C2: Validator streicht erfundene Zahlen, Fakten bleiben', validator],
    ['Cira C2: T2 nur mit Erlaubnis und unter Monatslimit, Lauf mit Kosten', t2],
    ['Cira C2: Cira-Ordner wird Projekt (cira), Werkzeugbetrieb ohne Vorgang', ciraOrdner],
    ['Cira C2: schreibend — Buchen und Timer wie die bestehenden Endpunkte', schreibend],
    ['Cira C2: Freigabe — Registry, Protokoll, Ereignis, Sperre', freigabe],
    ['Cira C2: Routen — NDJSON, Verlauf, Vorschlaege, SSE, Zaehler', routen],
    ['Cira C2: Einstellungen Cira mit Grenzen, nur Cira-Felder in der Datei', einstellungenCira],
  ];
};
