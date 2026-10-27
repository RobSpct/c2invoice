'use strict';
// C10 Sprache lokal (design/cira/C10-SPRACHE.md §3, Gates 1–10): Status ohne
// Einrichtung, Erkennen ueber whisper-server (Stub), Rohkoerper-Grenzen, Start
// und Leerlauf des Servers, Kind-Umgebung ohne Geheimnisse, ElevenLabs mit
// Cache, Monatslimit und Rueckfall auf die Browser-Stimme, Whitelist, T0.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');

const KEY = 'sk_c10_geheim_1234567890';
const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ dbmod, openDbs, configGeschuetzt }) => {
  const sprache = require('../../sprache');
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  const cacheOrdner = () => fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c10-'));
  const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const status = async (fn) => { try { await fn(); } catch (e) { return e.status; } return 200; };

  // fetch-Attrappe: antwortet je URL-Teil mit einer frischen Response (kein clone():
  // body.cancel() eines geteilten Stroms wartet auf den zweiten Zweig); merkt sich jeden Aufruf.
  function fetchStub(regeln) {
    const aufrufe = [];
    const fn = async (url, opt = {}) => {
      aufrufe.push({ url: String(url), opt });
      for (const [teil, antwort] of regeln) if (String(url).includes(teil)) return antwort(url, opt);
      throw new Error('kein Stub fuer ' + url);
    };
    fn.aufrufe = aufrufe;
    return fn;
  }
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
  const mp3 = (n = 64) => new Response(new Uint8Array(n).fill(7), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  // spawn-Attrappe: ein Prozess je Aufruf, kill() endet mit exit.
  function spawnStub() {
    const procs = [];
    const fn = (exe, args, opt) => {
      const p = new EventEmitter();
      p.stderr = new EventEmitter();
      p.exe = exe; p.args = args; p.opt = opt; p.getoetet = false;
      p.kill = () => { p.getoetet = true; setImmediate(() => p.emit('exit', 0)); return true; };
      procs.push(p);
      return p;
    };
    fn.procs = procs;
    return fn;
  }
  const dienst = (db, o = {}) => sprache.erzeuge({
    db, cacheOrdner: o.cacheOrdner || cacheOrdner(), env: o.env || {},
    sprachCfg: () => o.cfg || {}, einstellungen: () => ({ stimmeAnbieter: 'browser', antwortenVorlesen: 'auto', stimmeElevenlabs: '',
      stimmeModellKurz: 'eleven_flash_v2_5', stimmeModellLang: 'eleven_multilingual_v2', stimmeMonatslimitZeichen: 10000, ...(o.ein || {}) }),
    fetchFn: o.fetchFn || fetchStub([]), spawnFn: o.spawnFn || spawnStub(), existiert: o.existiert || (() => false),
    pollMs: 5, bereitMs: o.bereitMs || 500,
  });
  const eleven = (db, fetchFn, mehr = {}) => dienst(db, { fetchFn, env: { ELEVENLABS_API_KEY: KEY }, ...mehr,
    ein: { stimmeAnbieter: 'elevenlabs', stimmeElevenlabs: 'Voice123', ...(mehr.ein || {}) } });
  const wav = (bytes = 1000) => Buffer.alloc(bytes, 1);
  const zeilen = (db, art) => db.prepare('SELECT * FROM sprache_lauf WHERE art = ? ORDER BY id').all(art);

  // Route aufrufen: Anfrage als Strom, Antwort sammelt Status und Koerper.
  async function rufe(d, methode, p, typ, koerper) {
    // Wie bei http: der Strom liefert Buffer, nie Strings.
    const req = Readable.from(koerper.length ? [Buffer.from(koerper)] : []);
    req.method = methode; req.headers = typ ? { 'content-type': typ } : {};
    let res;
    const fertig = new Promise((ok) => {
      res = { status: 0, kopf: {}, koerper: null };
      res.writeHead = (s, k) => { res.status = s; res.kopf = k || {}; };
      res.end = (b) => { if (b !== undefined && res.koerper === null) res.koerper = b; ok(); };
    });
    const sendJson = (r, o, s = 200) => { r.status = s; r.koerper = o; r.end(); };
    const leseKoerper = (rq, cb) => { let s = ''; rq.on('data', (c) => { s += c; }); rq.on('end', () => cb(null, JSON.parse(s || '{}'))); };
    const u = new URL('http://x' + p);
    assert.ok(d.routen(req, res, u.pathname, u, { sendJson, leseKoerper }), 'Route nicht bedient: ' + p);
    await fertig;
    return res;
  }

  async function ohneEinrichtung() {
    const db = neueDb();
    const d = dienst(db);
    const s = d.status();
    assert.strictEqual(s.stt.bereit, false);
    assert.match(s.stt.grund, /nicht eingerichtet/);
    assert.strictEqual(s.tts.anbieter, 'browser');
    assert.strictEqual(s.tts.bereit, true);
    assert.strictEqual(await status(() => d.erkenne(wav())), 503);
    assert.deepStrictEqual(await d.sprich({ text: '**Hallo**' }), { fallback: 'browser', grund: null, text: 'Hallo' }, 'Rueckfall ohne bereinigten Text');
    assert.strictEqual(s.tts.vorlesen, 'auto');
    const r = await rufe(d, 'POST', '/api/sprache/sprechen', 'application/json', JSON.stringify({ text: 'Hallo' }));
    assert.strictEqual(r.status, 200, 'Rueckfall ist kein Fehler');
    assert.strictEqual(r.koerper.fallback, 'browser');
    const e = await rufe(d, 'POST', '/api/sprache/erkennen', 'audio/wav', wav());
    assert.strictEqual(e.status, 503);
    const st = await rufe(d, 'GET', '/api/sprache/status', null, '');
    assert.strictEqual(st.koerper.stt.bereit, false);
    // Adresse ausserhalb des Rechners: Audio verliesse ihn — nicht bereit, kein Aufruf.
    const f = fetchStub([]);
    const fern = dienst(db, { cfg: { stt: { url: 'http://192.168.1.5:8178' } }, fetchFn: f });
    assert.match(fern.status().stt.grund, /lokal/);
    assert.strictEqual(await status(() => fern.erkenne(wav())), 503);
    assert.strictEqual(f.aufrufe.length, 0);
  }

  async function erkennen() {
    const db = neueDb();
    let form = null;
    const f = fetchStub([['/inference', async (url, opt) => { form = opt.body; return json({ text: ' Wie lief der Monat? \n' }); }]]);
    const d = dienst(db, { cfg: { stt: { url: 'http://127.0.0.1:9999' } }, fetchFn: f });
    assert.strictEqual(d.status().stt.bereit, true);
    const r = await d.erkenne(wav(), 'en');
    assert.strictEqual(r.text, 'Wie lief der Monat?');
    assert.ok(form instanceof FormData, 'kein multipart');
    assert.strictEqual(form.get('language'), 'en');
    assert.strictEqual(form.get('response_format'), 'json');
    assert.strictEqual(form.get('file').size, 1000);
    assert.strictEqual(f.aufrufe[0].url, 'http://127.0.0.1:9999/inference');
    await d.erkenne(wav(), 'xx');
    assert.strictEqual(form.get('language'), 'de', 'unbekannte Sprache nicht auf de');
    const z = zeilen(db, 'stt');
    assert.strictEqual(z.length, 2);
    assert.strictEqual(z[0].anbieter, 'whisper');
    assert.strictEqual(z[0].fehler, null);
    // whisper antwortet mit Fehler: 502, Zeile mit Fehler.
    const kaputt = dienst(db, { cfg: { stt: { url: 'http://127.0.0.1:9999' } }, fetchFn: fetchStub([['/inference', () => json({ error: 'x' }, 500)]]) });
    assert.strictEqual(await status(() => kaputt.erkenne(wav())), 502);
    assert.ok(zeilen(db, 'stt').pop().fehler);
    // 200 mit { error } statt text: Fehler, kein leeres „nichts verstanden“.
    const fehlerJson = dienst(db, { cfg: { stt: { url: 'http://127.0.0.1:9999' } }, fetchFn: fetchStub([['/inference', () => json({ error: 'failed to read WAV' })]]) });
    assert.strictEqual(await status(() => fehlerJson.erkenne(wav())), 502, 'Fehler-JSON als Erfolg');
    assert.match(zeilen(db, 'stt').pop().fehler, /failed to read WAV/);
  }

  async function rohkoerper() {
    const db = neueDb();
    const f = fetchStub([['/inference', () => json({ text: 'ok' })]]);
    const d = dienst(db, { cfg: { stt: { url: 'http://127.0.0.1:9999' } }, fetchFn: f });
    const gross = await rufe(d, 'POST', '/api/sprache/erkennen', 'audio/wav', Buffer.alloc(2 * 1024 * 1024 + 1, 1));
    assert.strictEqual(gross.status, 413);
    const genau = await rufe(d, 'POST', '/api/sprache/erkennen', 'audio/wav', Buffer.alloc(2 * 1024 * 1024, 1));
    assert.strictEqual(genau.status, 200, '2 MB muessen durchgehen');
    assert.strictEqual(genau.koerper.text, 'ok');
    const typ = await rufe(d, 'POST', '/api/sprache/erkennen', 'application/json', '{"a":1}');
    assert.strictEqual(typ.status, 415);
    const ohne = await rufe(d, 'POST', '/api/sprache/erkennen', null, wav());
    assert.strictEqual(ohne.status, 415);
    const leer = await rufe(d, 'POST', '/api/sprache/erkennen', 'audio/wav', Buffer.alloc(0));
    assert.strictEqual(leer.status, 400);
    assert.strictEqual(f.aufrufe.length, 1, 'abgewiesene Anfragen erreichen whisper');
  }

  async function serverStart() {
    const db = neueDb();
    let laeuft = false;
    const f = fetchStub([
      ['/inference', () => json({ text: 'ja' })],
      [':8178/', async () => { if (!laeuft) throw new Error('ECONNREFUSED'); return new Response('<html>', { status: 200 }); }],
    ]);
    const sp = spawnStub();
    const start = (...a) => { const p = sp(...a); setTimeout(() => { laeuft = true; }, 20); p.on('exit', () => { laeuft = false; }); return p; };
    const cfg = { stt: { exe: 'D:/w/whisper-server.exe', modell: 'D:/w/m.bin', port: 8178, leerlaufMinuten: 0.003 } };
    const d = dienst(db, { cfg, fetchFn: f, spawnFn: start, existiert: () => true, env: { PATH: 'p', ELEVENLABS_API_KEY: KEY, GITHUB_TOKEN: 't' } });
    assert.strictEqual(d.status().stt.bereit, true);
    assert.strictEqual(d.status().stt.laeuft, false);
    const [a, b] = await Promise.all([d.erkenne(wav()), d.erkenne(wav())]);
    assert.strictEqual(a.text, 'ja'); assert.strictEqual(b.text, 'ja');
    assert.strictEqual(sp.procs.length, 1, 'zwei gleichzeitige Aufrufe starten zwei Server');
    const p = sp.procs[0];
    assert.strictEqual(p.exe, 'D:/w/whisper-server.exe');
    assert.deepStrictEqual(p.args, ['-m', 'D:/w/m.bin', '-l', 'de', '--host', '127.0.0.1', '--port', '8178']);
    assert.strictEqual(p.opt.windowsHide, true);
    assert.ok(!p.opt.shell, 'Start ueber eine Shell');
    // Kind-Umgebung ohne Geheimnisse.
    assert.strictEqual(p.opt.env.PATH, 'p');
    assert.ok(!('ELEVENLABS_API_KEY' in p.opt.env) && !('GITHUB_TOKEN' in p.opt.env), 'Geheimnis in der Kind-Umgebung');
    assert.strictEqual(d.status().stt.laeuft, true);
    await d.erkenne(wav());
    assert.strictEqual(sp.procs.length, 1, 'laufender Server wird neu gestartet');
    // Leerlauf (0,003 min = 180 ms) beendet ihn, der naechste Aufruf startet neu.
    await warte(320);
    assert.strictEqual(p.getoetet, true, 'Leerlauf beendet den Server nicht');
    assert.strictEqual(d.status().stt.laeuft, false);
    await d.erkenne(wav());
    assert.strictEqual(sp.procs.length, 2, 'nach exit kein Neustart');
    d.stoppe();
    assert.strictEqual(sp.procs[1].getoetet, true, 'stoppe() beendet den Server nicht');
    // exe fehlt: Grund nennt den Pfad, kein Start.
    const sp2 = spawnStub();
    const ohne = dienst(db, { cfg, spawnFn: sp2, existiert: (x) => x !== cfg.stt.exe });
    assert.match(ohne.status().stt.grund, /whisper-server nicht gefunden/);
    assert.ok(!JSON.stringify(ohne.status()).includes('D:/w'), 'Pfad im frei lesbaren Status');
    assert.strictEqual(await status(() => ohne.erkenne(wav())), 503);
    assert.strictEqual(sp2.procs.length, 0);
    // Server wird nie bereit: 502, Prozess beendet.
    const sp3 = spawnStub();
    const nie = dienst(db, { cfg, fetchFn: fetchStub([[':8178/', async () => { throw new Error('ECONNREFUSED'); }]]), spawnFn: sp3, existiert: () => true, bereitMs: 60 });
    assert.strictEqual(await status(() => nie.erkenne(wav())), 502);
    assert.strictEqual(sp3.procs[0].getoetet, true, 'haengender Start bleibt liegen');
  }

  async function cache() {
    const db = neueDb();
    const f = fetchStub([['api.elevenlabs.io', () => mp3(64)]]);
    const ordner = cacheOrdner();
    const d = eleven(db, f, { cacheOrdner: ordner });
    const a = await d.sprich({ text: 'Der Monat lief gut.' });
    assert.strictEqual(a.aus, 'elevenlabs');
    assert.strictEqual(a.audio.length, 64);
    const b = await d.sprich({ text: 'Der Monat lief gut.' });
    assert.strictEqual(b.aus, 'cache');
    assert.strictEqual(b.audio.length, 64);
    assert.strictEqual(f.aufrufe.length, 1, 'Cache-Treffer ruft ElevenLabs');
    assert.strictEqual(d.status().tts.verbraucht, 'Der Monat lief gut.'.length, 'Cache-Treffer bucht Zeichen');
    // Andere Stimme: eigener Eintrag.
    await eleven(db, f, { cacheOrdner: ordner, ein: { stimmeElevenlabs: 'Voice999' } }).sprich({ text: 'Der Monat lief gut.' });
    assert.strictEqual(f.aufrufe.length, 2, 'Stimme fehlt im Cache-Schluessel');
    // Anfrage: Stimme in der URL, Key im Kopf, Text im Koerper.
    const o = f.aufrufe[0];
    assert.match(o.url, /\/v1\/text-to-speech\/Voice123\/stream\?output_format=mp3_44100_128$/);
    assert.strictEqual(o.opt.headers['xi-api-key'], KEY);
    assert.strictEqual(JSON.parse(o.opt.body).text, 'Der Monat lief gut.');
    assert.ok(o.opt.signal, 'ohne Zeitgrenze');
  }

  async function limit() {
    const db = neueDb();
    const f = fetchStub([['api.elevenlabs.io', () => mp3()]]);
    db.prepare("INSERT INTO sprache_lauf (zeit, art, anbieter, zeichen, ms, cache, fehler) VALUES (?, 'tts', 'elevenlabs', 995, 1, 0, NULL)").run(new Date().toISOString());
    const d = eleven(db, f, { ein: { stimmeMonatslimitZeichen: 1000 } });
    assert.strictEqual(d.status().tts.verbraucht, 995);
    assert.strictEqual(d.status().tts.limit, 1000);
    const r = await d.sprich({ text: 'Zehn Zeichen' });
    assert.strictEqual(r.fallback, 'browser');
    assert.match(r.grund, /Monatslimit/);
    assert.strictEqual(f.aufrufe.length, 0);
    // Parallel: reserviert vor dem Aufruf — bei 1000 Zeichen gehen zwei von drei 400ern durch.
    const dbP = neueDb();
    const langsam = fetchStub([['api.elevenlabs.io', async () => { await warte(30); return mp3(); }]]);
    const p = eleven(dbP, langsam, { ein: { stimmeMonatslimitZeichen: 1000 } });
    const drei = await Promise.all(['a', 'b', 'c'].map((x) => p.sprich({ text: x.repeat(400) })));
    assert.strictEqual(drei.filter((x) => x.aus === 'elevenlabs').length, 2, 'Limit per Parallelitaet ueberschritten');
    assert.strictEqual(langsam.aufrufe.length, 2);
    // Vormonat zaehlt nicht.
    const db2 = neueDb();
    db2.prepare("INSERT INTO sprache_lauf (zeit, art, anbieter, zeichen, ms, cache, fehler) VALUES ('2000-01-15T10:00:00.000Z', 'tts', 'elevenlabs', 5000, 1, 0, NULL)").run();
    assert.strictEqual((await eleven(db2, f, { ein: { stimmeMonatslimitZeichen: 1000 } }).sprich({ text: 'Zehn Zeichen' })).aus, 'elevenlabs');
  }

  async function fehlerFaelle() {
    const db = neueDb();
    const faelle = [
      ['401', () => new Response('{"detail":"invalid key ' + KEY + '"}', { status: 401 }), /Schlüssel/],
      ['429', () => new Response('quota', { status: 429 }), /Kontingent/],
      // Owner-Test 27.10.: Library-Stimme im Free-Plan → 402 paid_plan_required.
      ['402', () => new Response('{"detail":{"code":"paid_plan_required"}}', { status: 402 }), /bezahltes Abo.*Voice Library/],
      ['503', () => new Response('x', { status: 503 }), /HTTP 503/],
      ['Netz', () => { throw new TypeError('fetch failed ' + KEY); }, /nicht erreichbar/],
      ['Zeit', () => { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; }, /nicht erreichbar/],
    ];
    for (const [name, antwortFn, grund] of faelle) {
      const d = eleven(db, fetchStub([['api.elevenlabs.io', antwortFn]]));
      const r = await d.sprich({ text: 'Fall ' + name });
      assert.strictEqual(r.fallback, 'browser', name);
      assert.match(r.grund, grund, name);
      assert.ok(!JSON.stringify(r).includes(KEY), name + ': Key in der Antwort');
      const res = await rufe(d, 'POST', '/api/sprache/sprechen', 'application/json', JSON.stringify({ text: 'Fall ' + name + ' Route' }));
      assert.strictEqual(res.status, 200, name);
      assert.strictEqual(res.koerper.fallback, 'browser', name);
      assert.ok(!JSON.stringify(res.koerper).includes(KEY), name + ': Key in der Route');
      assert.ok(!JSON.stringify(d.status()).includes(KEY), name + ': Key im Status');
    }
    const f = zeilen(db, 'tts');
    assert.ok(f.length >= 5 && f.every((z) => z.fehler && !z.fehler.includes(KEY)), 'Fehlschlag ohne Grund oder mit Key im Protokoll');
    // Der letzte Fehlschlag steht im Status (Einstellungen zeigen ihn), ein Erfolg loescht ihn.
    const nach402 = eleven(db, fetchStub([['api.elevenlabs.io', () => new Response('x', { status: 402 })]]));
    await nach402.sprich({ text: 'Library-Stimme' });
    assert.match(nach402.status().tts.letzterFehler.grund, /bezahltes Abo/, 'letzter Fehlschlag fehlt im Status');
    await eleven(db, fetchStub([['api.elevenlabs.io', () => mp3()]])).sprich({ text: 'Jetzt klappt es' });
    assert.strictEqual(nach402.status().tts.letzterFehler, null, 'Erfolg loescht den letzten Fehler nicht');
    assert.ok(f.every((z) => (z.fehler === 'Zeitüberschreitung' ? z.zeichen > 0 : z.zeichen === 0)), 'Zeitueberschreitung nicht vorsichtshalber gebucht oder anderer Fehler bucht');
    // 200 ohne Audio: Rueckfall, nichts im Cache; ein leerer Cache-Eintrag zaehlt nicht als Treffer.
    const ordner = cacheOrdner();
    const ohneAudio = eleven(db, fetchStub([['api.elevenlabs.io', () => json({ detail: 'x' })]]), { cacheOrdner: ordner });
    assert.strictEqual((await ohneAudio.sprich({ text: 'Kein Audio' })).fallback, 'browser');
    assert.strictEqual(fs.readdirSync(ordner).length, 0, 'Nicht-Audio im Cache');
    // Buchung scheitert (DB zu): das bezahlte Audio geht trotzdem raus.
    const dbZu = neueDb();
    const zu = eleven(dbZu, fetchStub([['api.elevenlabs.io', () => mp3(32)]]));
    zu.status();
    dbZu.exec('DROP TABLE sprache_lauf; CREATE TABLE sprache_lauf (id INTEGER PRIMARY KEY, zeit TEXT NOT NULL, art TEXT NOT NULL, anbieter TEXT NOT NULL, zeichen INTEGER NOT NULL, ms INTEGER, cache INTEGER NOT NULL, fehler TEXT, CHECK (0))');
    assert.strictEqual((await zu.sprich({ text: 'Trotzdem hoerbar' })).audio.length, 32, 'Buchungsfehler kippt das Vorlesen');
    // Ohne Key oder ohne Stimme: nicht bereit, Rueckfall ohne Aufruf.
    const leer = fetchStub([]);
    const ohneKey = dienst(db, { fetchFn: leer, ein: { stimmeAnbieter: 'elevenlabs', stimmeElevenlabs: 'Voice123' } });
    assert.strictEqual(ohneKey.status().tts.bereit, false);
    assert.match(ohneKey.status().tts.grund, /ELEVENLABS_API_KEY/);
    assert.strictEqual((await ohneKey.sprich({ text: 'x x' })).fallback, 'browser');
    const ohneStimme = dienst(db, { fetchFn: leer, env: { ELEVENLABS_API_KEY: KEY }, ein: { stimmeAnbieter: 'elevenlabs' } });
    assert.match(ohneStimme.status().tts.grund, /Stimme/);
    assert.strictEqual(leer.aufrufe.length, 0);
    // Eigener Variablenname aus config.sprache.
    const eigen = dienst(db, { cfg: { tts: { elevenlabs: { apiKeyEnvVar: 'MEIN_EL_API_KEY' } } }, env: { MEIN_EL_API_KEY: KEY }, ein: { stimmeAnbieter: 'elevenlabs', stimmeElevenlabs: 'V1' } });
    assert.strictEqual(eigen.status().tts.bereit, true);
    // Ein Name, den kindUmgebung() nicht als Geheimnis erkennt, gilt nicht (der Key liefe sonst in Kindprozesse).
    const tarn = dienst(db, { cfg: { tts: { elevenlabs: { apiKeyEnvVar: 'XI_LABS' } } }, env: { XI_LABS: KEY }, ein: { stimmeAnbieter: 'elevenlabs', stimmeElevenlabs: 'V1' } });
    assert.match(tarn.status().tts.grund, /ELEVENLABS_API_KEY/);
  }

  async function textRegeln() {
    const md = sprache.ohneMarkdown;
    assert.strictEqual(md('## Monat\n**Fett** und `code`, [Link](https://x.de) und [[wiki/a|Alias]].\n- Punkt eins\n- Punkt zwei'), 'Monat. Fett und code, Link und Alias. Punkt eins. Punkt zwei');
    assert.strictEqual(md('| a | b |\n|---|---|\n| 1 | 2 |'), 'a, b. 1, 2');
    assert.strictEqual(md('```js\nconst x = 1;\n```\nDanach'), 'Danach');
    const db = neueDb();
    const f = fetchStub([['api.elevenlabs.io', () => mp3()]]);
    const d = eleven(db, f);
    assert.strictEqual(await status(() => d.sprich({ text: 'a'.repeat(5001) })), 413);
    // Sehr lang: abgewiesen, bevor die Regexe laufen (Review: 60 000 eckige Klammern blockierten 6 s).
    const t1 = Date.now();
    assert.strictEqual(await status(() => d.sprich({ text: '!['.repeat(30000) })), 413);
    assert.ok(Date.now() - t1 < 500, 'Markdown-Entfernung vor der Laengenpruefung');
    assert.strictEqual(await status(() => d.sprich({ text: '  ' })), 400);
    assert.strictEqual(await status(() => d.sprich({ text: 5 })), 400);
    await d.sprich({ text: 'k'.repeat(399) });
    await d.sprich({ text: 'l'.repeat(400) });
    const modelle = f.aufrufe.map((a) => JSON.parse(a.opt.body).model_id);
    assert.deepStrictEqual(modelle, ['eleven_flash_v2_5', 'eleven_multilingual_v2']);
    // Gemessen wird der gesprochene Text, nicht das Markdown.
    await d.sprich({ text: '**Fett**' });
    assert.strictEqual(JSON.parse(f.aufrufe[2].opt.body).text, 'Fett');
    assert.strictEqual(zeilen(db, 'tts').pop().zeichen, 4);
  }

  function whitelist() {
    configGeschuetzt(() => {
      const S = require('../../server');
      const cfg = require(CFG);
      const alt = cfg.cira;
      cfg.cira = { ...(alt || {}) };
      try {
        for (const boese of [{ stimmeElevenlabs: 'abc!' }, { stimmeElevenlabs: 'a'.repeat(41) }, { stimmeElevenlabs: 'a/b' }, { stimmeAnbieter: 'piper' },
          { antwortenVorlesen: 'manchmal' }, { stimmeModellKurz: 'gpt' }, { stimmeMonatslimitZeichen: 999 }, { stimmeMonatslimitZeichen: 1000001 }, { stimmeMonatslimitZeichen: 'x' }]) {
          assert.throws(() => S.setzeCira(boese), Error, 'nimmt ' + JSON.stringify(boese));
        }
        const r = S.setzeCira({ stimmeAnbieter: 'elevenlabs', stimmeElevenlabs: 'AbC123', antwortenVorlesen: 'immer', stimmeModellKurz: 'eleven_v4_turbo', stimmeMonatslimitZeichen: 30000 });
        assert.strictEqual(r.stimmeElevenlabs, 'AbC123');
        assert.strictEqual(r.stimmeMonatslimitZeichen, 30000);
        assert.strictEqual(S.setzeCira({ stimmeElevenlabs: '' }).stimmeElevenlabs, '', 'leere Stimme nicht moeglich');
        assert.ok(!Object.keys(S.CIRA_FELDER).some((k) => /key|exe|pfad/i.test(k)), 'Zugang in der Whitelist');
      } finally { cfg.cira = alt; }
    });
  }

  async function t0Vorlesen() {
    const cira = require('../../cira');
    const db = neueDb();
    const c = cira.erzeuge({ db, bucheVorgang: () => {} });
    const r = await c.frage({ text: 'Tagesbericht', kanal: 'cockpit', gesprochen: true });
    assert.strictEqual(r.stufe, 'T0');
    assert.strictEqual(r.vorlesen, true, 'Tagesbericht ohne vorlesen');
    const v = c.verlauf('cockpit');
    assert.strictEqual(v[0].rolle, 'ich');
    assert.strictEqual(v[0].gesprochen, true, 'gesprochen fehlt im Verlauf');
    assert.strictEqual(v[1].gesprochen, false);
    const r2 = await c.frage({ text: 'Was ist überfällig?', kanal: 'cockpit' });
    assert.strictEqual(r2.vorlesen, false);
    assert.strictEqual(c.verlauf('cockpit')[2].gesprochen, false);
    // Die Route reicht beides durch (fertig-Zeile, Frage aus dem Koerper).
    const aus = [];
    await new Promise((ok) => {
      const req = Readable.from([JSON.stringify({ text: 'Tagesbericht', kanal: 'dock', gesprochen: true })]);
      req.method = 'POST'; req.headers = {};
      const res = new EventEmitter();
      res.writeHead = () => {}; res.write = (s) => { aus.push(s); }; res.end = () => { res.writableEnded = true; ok(); };
      const leseKoerper = (rq, cb) => { let s = ''; rq.on('data', (x) => { s += x; }); rq.on('end', () => cb(null, JSON.parse(s))); };
      c.routen(req, res, '/api/cira/frage', new URL('http://x/api/cira/frage'), { sendJson: () => ok(), leseKoerper });
    });
    const fertig = aus.map((s) => JSON.parse(s)).find((z) => z.typ === 'fertig');
    assert.ok(fertig, 'keine fertig-Zeile');
    assert.strictEqual(fertig.vorlesen, true, 'fertig-Zeile ohne vorlesen');
    assert.strictEqual(c.verlauf('dock')[0].gesprochen, true, 'Route verliert gesprochen');
  }

  return [
    ['C10 ohne Einrichtung: Erkennen 503, Sprechen faellt auf Browser zurueck, ferne Adresse nicht bereit', ohneEinrichtung],
    ['C10 Erkennen: Text getrimmt, Sprache im Formular, Zeile in sprache_lauf, whisper-Fehler 502', erkennen],
    ['C10 Rohkoerper: ueber 2 MB 413, falscher Typ 415, leer 400', rohkoerper],
    ['C10 whisper-server: ein Start, Kind-Umgebung ohne Geheimnisse, Leerlauf-Stopp, Neustart, fehlende exe', serverStart],
    ['C10 ElevenLabs: Cache-Treffer ohne Aufruf und ohne Zeichen, Schluessel mit Stimme', cache],
    ['C10 Monatslimit: erreicht -> Browser ohne Aufruf, Vormonat zaehlt nicht', limit],
    ['C10 Fehler: 401/429/503/Netz/Zeit -> Browser mit Grund, Key nirgends', fehlerFaelle],
    ['C10 Text: Markdown raus, Laengengrenze, Modell kurz/lang', textRegeln],
    ['C10 Whitelist Stimme: Muster, Grenzen, kein Zugang', whitelist],
    ['C10 T0: Tagesbericht vorlesen, gesprochen im Verlauf und in der Route', t0Vorlesen],
  ];
};
