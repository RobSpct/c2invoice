'use strict';
// Cira-Modell-Block (Owner 15.10.2026): Rollen-Modelle aus der Liste des
// Modellservers, Routing mit Eskalation und Zahlen-Guard, Modellordner und Laden.
// Der Modellserver ist gespielt: eine fetch-Funktion, die je Pfad antwortet.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ configGeschuetzt, dbmod, openDbs }) => {
  const cira = require('../../cira');
  const modelle = require('../../modelle');
  const srv = () => require('../../server');

  const LOKAL = { lokaleModelle: { upstreamUrl: 'http://127.0.0.1:11434', proxyPort: 11435 } };
  const nie = (name) => () => { throw new Error(name + ' darf hier nicht laufen'); };
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, v] of Object.entries(werte)) cfg[k] = JSON.parse(JSON.stringify(v));
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  // Gespielter Server: routen[pfad] = Objekt (JSON), Error (Netzfehler), { zeilen } (NDJSON-Strom)
  // oder Funktion(init) -> eines davon. Unbekannte Pfade: 404.
  function server(routen) {
    const aufrufe = [];
    const fn = async (url, init = {}) => {
      const u = new URL(url);
      aufrufe.push({ pfad: u.pathname, port: u.port, body: init.body ? JSON.parse(init.body) : null });
      let v = routen[u.pathname];
      if (typeof v === 'function') v = await v(init.body ? JSON.parse(init.body) : null);
      if (v === undefined) return { ok: false, status: 404, json: async () => ({}), body: null };
      if (v instanceof Error) throw v;
      if (v.zeilen) {
        return { ok: true, status: 200, body: (async function* () {
          for (const z of v.zeilen) { if (v.warte) await v.warte; yield new TextEncoder().encode(JSON.stringify(z) + '\n'); }
        })() };
      }
      return { ok: true, status: 200, json: async () => v };
    };
    return { fn, aufrufe };
  }
  const ollama = (mehr = {}) => server({
    '/v1/models': { object: 'list', data: [{ id: 'qwen3:8b' }, { id: 'llama3.2:3b' }, { id: 'qwen3:8b' }] },
    '/api/version': { version: '0.12.0' },
    '/api/tags': { models: [{ name: 'qwen3:8b', size: 5.2e9 }, { name: 'llama3.2:3b', size: 2.0e9 }] },
    ...mehr,
  });
  // Antworten je Modell auf /v1/chat/completions (ueber den Proxy, Port 11435).
  const chat = (je) => ({ '/v1/chat/completions': (b) => {
    const a = je[b.model];
    if (a === undefined) throw new Error('unerwartetes Modell ' + b.model);
    return a instanceof Error ? a : { choices: [{ message: { content: a } }], usage: { total_tokens: 10 } };
  } });

  async function liste() {
    const o = ollama();
    const l = await modelle.liste({ cfg: LOKAL, fetchFn: o.fn });
    assert.strictEqual(l.laufzeit, 'ollama');
    assert.deepStrictEqual(l.modelle, [{ id: 'llama3.2:3b', groesse_gb: 2 }, { id: 'qwen3:8b', groesse_gb: 5.2 }]);
    assert.ok(o.aufrufe.every((a) => a.port === '11434'), 'Liste ueber den Proxy statt direkt');
    // LM Studio: eigener Endpunkt, kein /api/version.
    const lm = server({ '/v1/models': { data: [{ id: 'gemma' }] }, '/api/v1/models': { models: [] } });
    assert.strictEqual((await modelle.liste({ cfg: LOKAL, fetchFn: lm.fn })).laufzeit, 'lmstudio');
    // Falle aus der Recherche: Lemonade beantwortet auch /api/version wie Ollama.
    const lem = server({ '/v1/models': { data: [] }, '/v1/system-info': { model_storage: {} }, '/api/version': { version: '1' } });
    assert.strictEqual((await modelle.liste({ cfg: LOKAL, fetchFn: lem.fn })).laufzeit, 'lemonade');
    const lc = server({ '/v1/models': { data: [] }, '/props': { build_info: 'b1' } });
    assert.strictEqual((await modelle.liste({ cfg: LOKAL, fetchFn: lc.fn })).laufzeit, 'llamacpp');
    const weg = await modelle.liste({ cfg: LOKAL, fetchFn: server({ '/v1/models': new Error('ECONNREFUSED') }).fn });
    assert.ok(!weg.erreichbar && /nicht erreichbar/.test(weg.fehler) && weg.modelle.length === 0, JSON.stringify(weg));
    const aus = await modelle.liste({ cfg: {}, fetchFn: nie('fetch') });
    assert.ok(!aus.eingerichtet && /nicht eingerichtet/.test(aus.fehler));
  }

  async function speichern() {
    await configGeschuetzt(async () => {
      const S = srv();
      const r = S.setzeCira({ modellDenken: 'qwen3:8b', modellText: '' }, ['qwen3:8b', 'llama3.2:3b']);
      assert.strictEqual(r.modellDenken, 'qwen3:8b');
      for (const falsch of ['qwen3:8', 'Qwen3:8b', 'qwen3:8b ', 'x']) {
        if (falsch.trim() === 'qwen3:8b') continue;
        assert.throws(() => S.setzeCira({ modellCode: falsch }, ['qwen3:8b']), /kennt der Modellserver nicht/, falsch);
      }
      // Ohne Liste geht nur leer (Rolle abschalten).
      assert.throws(() => S.setzeCira({ modellCode: 'qwen3:8b' }), /kennt der Modellserver nicht/);
      assert.strictEqual(S.setzeCira({ modellCode: '' }).modellCode, '');
      assert.strictEqual(S.setzeCira({ woerterCode: 'n8n, Zapier-Flow' }).woerterCode, 'n8n, Zapier-Flow');
      for (const w of ['<b>x</b>', 'a', 'x'.repeat(41)]) assert.throws(() => S.setzeCira({ woerterText: w }), Error, w);
    });
    // bekannteModelle fragt den Server; nicht erreichbar -> Fehler statt leerer Liste.
    const o = ollama();
    await modelle.liste({ cfg: LOKAL, fetchFn: o.fn });
    assert.ok((await modelle.bekannteModelle({ cfg: LOKAL, fetchFn: nie('fetch') })).includes('qwen3:8b'), 'frische Liste nicht genutzt');
  }

  function routing() {
    const c = { ...cira.STANDARD };
    const fall = (text, rolle, grund) => {
      const w = cira.waehleRolle(text, c);
      assert.strictEqual(w.rolle, rolle, text + ' -> ' + JSON.stringify(w));
      if (grund) assert.ok(grund.test(w.grund), text + ': Grund ' + w.grund);
    };
    fall('Warum ist der Umsatz im September gesunken?', 'denken', /warum/);
    fall('Entwirf eine freundliche Mail an Nordlicht', 'text', /entwirf/);
    fall('Was bedeutet diese Fehlermeldung: TypeError undefined', 'code', /fehlermeldung/);
    fall('Wie viel ist offen?', 'schnell', /wie viel/);
    fall('Hallo', 'schnell', /hallo/);
    fall('Moin Cira', 'schnell', /sehr kurz/);
    fall('Schreib eine Regex für ein Datum', 'code', /regex/);
    fall('Kannst du mir beim Thema Steuern bitte etwas helfen', 'denken', /kein klares Signal/);
    fall('Entwirf Code', 'denken', /mehrdeutig/);
    fall('Schreib ein Python Skript', 'code');
    fall('Wie viel ' + 'und noch mehr Kontext '.repeat(12), 'denken', /lange Frage/);
    // Woerter nur am Wortanfang: "Kontext" ist kein "text".
    fall('Welche Kontextfenster gibt es', 'schnell');
    // Eigene Woerter wirken und werden im Grund genannt.
    fall('Was macht mein n8n Knoten', 'denken');
    c.woerterCode = 'n8n';
    fall('Was macht mein n8n Knoten', 'code', /eigene Wörter/);
    // Modell je Rolle mit Ersatz.
    assert.strictEqual(cira.modellFuer('code', { modellLokal: '', modellDenken: 'g' }).modell, 'g');
    assert.deepStrictEqual(cira.modellFuer('text', { modellLokal: 'k', modellText: 't' }), { modell: 't', ersatz: null });
    assert.strictEqual(cira.modellFuer('text', { modellLokal: '' }), null);
  }

  const dienst = (db, fetchFn) => cira.erzeuge({ db, bucheVorgang: srv().bucheVorgang, fetchFn, spawnFn: nie('Claude'), claudeExe: 'claude-test.exe' });
  const MIT = (mehr = {}) => ({ cira: { modellLokal: 'klein:1b', modellDenken: 'gross:8b', claudeErlaubt: true, claudeMonatslimitEur: 5, ...mehr }, ...LOKAL });

  async function eskalation() {
    await mitConfig(MIT(), async () => {
      // Schnell gibt ab -> Denken antwortet.
      let s = server(chat({ 'klein:1b': '[T2]', 'gross:8b': 'Das hängt vom Kunden ab.' }));
      let n = await dienst(neueDb(), s.fn).frage({ text: 'Wie viel ist offen?' });
      assert.ok(n.stufe === 'T1' && n.text === 'Das hängt vom Kunden ab.' && n.route.modell === 'gross:8b', JSON.stringify(n));
      assert.deepStrictEqual(n.route.versuche.map((v) => [v.rolle, v.modell, v.ergebnis]), [['schnell', 'klein:1b', 'zu schwer'], ['denken', 'gross:8b', 'ok']]);
      assert.ok(n.quelle.includes('gross:8b'));
      // Fremde Zahl -> Denken; Netzfehler -> Denken.
      s = server(chat({ 'klein:1b': 'Du hast 4711 Kunden.', 'gross:8b': 'Dazu liegen mir keine Zahlen vor.' }));
      n = await dienst(neueDb(), s.fn).frage({ text: 'Wie viel Kunden habe ich?' });
      assert.ok(!n.text.includes('4711') && /Zahlen verworfen/.test(n.route.versuche[0].ergebnis) && n.route.versuche[1].ergebnis === 'ok', JSON.stringify(n));
      s = server(chat({ 'klein:1b': new Error('ECONNRESET'), 'gross:8b': 'Antwort.' }));
      n = await dienst(neueDb(), s.fn).frage({ text: 'Wie viel ist offen?' });
      assert.ok(n.route.versuche[0].ergebnis === 'nicht erreichbar' && n.text === 'Antwort.', JSON.stringify(n.route));
      // Beide geben ab -> nur ein Angebot, Claude startet nicht (spawnFn wirft).
      s = server(chat({ 'klein:1b': '[T2]', 'gross:8b': '<think>hm</think>[T2]' }));
      n = await dienst(neueDb(), s.fn).frage({ text: 'Wie viel ist offen?' });
      assert.ok(n.angebot && n.angebot.frage === 'claude: Wie viel ist offen?' && /kostet/.test(n.text), JSON.stringify(n));
      // Leere Antwort (nur Nachdenken) zaehlt als Fehlschlag.
      s = server(chat({ 'klein:1b': '<think>lange</think>', 'gross:8b': 'Gut.' }));
      n = await dienst(neueDb(), s.fn).frage({ text: 'Wie viel ist offen?' });
      assert.ok(n.route.versuche[0].ergebnis === 'nur nachgedacht, keine Antwort' && n.text === 'Gut.', JSON.stringify(n.route));
      // Abgeschnitten (finish_reason length) ist keine Antwort; HTTP-Fehler heisst nicht "nicht erreichbar".
      const lang = { '/v1/chat/completions': (b) => (b.model === 'klein:1b' ? { choices: [{ message: { content: 'Der Monat lief' }, finish_reason: 'length' }] } : { choices: [{ message: { content: 'Gut.' } }] }) };
      n = await dienst(neueDb(), server(lang).fn).frage({ text: 'Wie viel ist offen?' });
      assert.ok(/Token-Grenze/.test(n.route.versuche[0].ergebnis) && n.text === 'Gut.', JSON.stringify(n.route));
      const fehl = { '/v1/chat/completions': () => ({ fehlerStatus: 404 }) };
      const s404 = server(fehl);
      const f404 = async (url, init) => { const r = await s404.fn(url, init); return { ok: false, status: 404, json: async () => ({ error: { message: 'model "klein:1b" not found' } }) }; };
      n = await dienst(neueDb(), f404).frage({ text: 'Wie viel ist offen?' });
      assert.ok(/Fehler 404 \(model "klein:1b" not found\)/.test(n.route.versuche[0].ergebnis) && !/nicht erreichbar/.test(n.text), JSON.stringify(n));
      // Rest-Antwort traegt einen sichtbaren Hinweis (kein stilles Kuerzen).
      n = await dienst(neueDb(), server(chat({ 'klein:1b': 'Alles gut. Du hast 4711 Kunden.', 'gross:8b': '[T2]' })).fn).frage({ text: 'Wie viel ist offen?' });
      assert.ok(n.text.startsWith('Alles gut.') && /nicht belegten Zahlen habe ich entfernt/.test(n.text) && !n.text.includes('4711'), n.text);
      // Abbruch durch den Browser endet die Kette sofort.
      const ac = new AbortController();
      const haengt = async (url, init) => new Promise((_, nein) => init.signal.addEventListener('abort', () => nein(Object.assign(new Error('ab'), { name: 'AbortError' }))));
      const pr = cira.erzeuge({ db: neueDb(), bucheVorgang: srv().bucheVorgang, fetchFn: haengt, spawnFn: nie('Claude'), claudeExe: 'x' }).frage({ text: 'Wie viel ist offen?', signal: ac.signal });
      setTimeout(() => ac.abort(), 20);
      n = await pr;
      assert.ok(n.route.versuche.length === 1 && n.route.versuche[0].ergebnis === 'abgebrochen', JSON.stringify(n.route));
    });
    await mitConfig(MIT({ claudeErlaubt: false }), async () => {
      const s = server(chat({ 'klein:1b': '[T2]', 'gross:8b': '[T2]' }));
      const n = await dienst(neueDb(), s.fn).frage({ text: 'Wie viel ist offen?' });
      assert.ok(n.angebot === null && /ausgeschaltet/.test(n.text), JSON.stringify(n));
    });
    // Nur ein Modell eingestellt: dieselbe Antwort wird nicht zweimal erfragt.
    await mitConfig(MIT({ modellDenken: '' }), async () => {
      const s = server(chat({ 'klein:1b': '[T2]' }));
      await dienst(neueDb(), s.fn).frage({ text: 'Wie viel ist offen?' });
      assert.strictEqual(s.aufrufe.filter((a) => a.pfad === '/v1/chat/completions').length, 1);
    });
    // Rolle Code: Zahlen im Codeblock sind kein Betrag; im Fliesstext gilt der Guard weiter.
    await mitConfig(MIT({ modellCode: 'coder:7b' }), async () => {
      const s = server(chat({ 'coder:7b': 'So geht es:\n```js\nconst re = /\\d{4}-\\d{2}/;\n```\nFertig.' }));
      const n = await dienst(neueDb(), s.fn).frage({ text: 'Schreib eine Regex für ein Datum' });
      assert.ok(n.route.rolle === 'code' && n.text.includes('\\d{4}') && n.route.versuche.length === 1, JSON.stringify(n));
      const sys = s.aufrufe[0].body.messages[0].content;
      assert.ok(/Codeblöcken/.test(sys) && sys.includes('FAKTEN: '), sys);
    });
  }

  async function route() {
    await mitConfig(MIT(), async () => {
      const db = neueDb();
      const d = dienst(db, server(chat({ 'klein:1b': 'Alles im Plan.' })).fn);
      const n = await d.frage({ text: 'Wie viel ist offen?', kanal: 'cockpit' });
      assert.ok(Number.isInteger(n.id) && n.route.rolle === 'schnell' && /wie viel/.test(n.route.grund), JSON.stringify(n));
      const v = d.verlauf('cockpit').pop();
      assert.ok(v.id === n.id && v.route.modell === 'klein:1b' && v.falsch === false, JSON.stringify(v));
      // Routen: falsch markieren, Liste mit der Frage dazu.
      const antw = [];
      const res = (r) => r;
      const send = (_res, o, status = 200) => antw.push({ o, status });
      d.routen({ method: 'POST', headers: {} }, res({}), '/api/cira/nachricht/' + n.id + '/falsch', new URL('http://x/'), { sendJson: send });
      d.routen({ method: 'POST', headers: {} }, res({}), '/api/cira/nachricht/999999/falsch', new URL('http://x/'), { sendJson: send });
      d.routen({ method: 'GET', headers: {} }, res({}), '/api/cira/falsch', new URL('http://x/'), { sendJson: send });
      assert.strictEqual(antw[0].status, 200);
      assert.strictEqual(antw[1].status, 404);
      assert.deepStrictEqual(antw[2].o.falsch.map((f) => [f.id, f.frage, f.rolle]), [[n.id, 'Wie viel ist offen?', 'schnell']]);
      assert.strictEqual(d.verlauf('cockpit').pop().falsch, true);
      // Ein Angebot ueberlebt das Neuladen des Verlaufs.
      const d2 = dienst(db, server(chat({ 'klein:1b': '[T2]', 'gross:8b': '[T2]' })).fn);
      await d2.frage({ text: 'Wie viel noch?', kanal: 'cockpit' });
      assert.strictEqual(d2.verlauf('cockpit').pop().angebot.frage, 'claude: Wie viel noch?');
    });
  }

  async function ordner() {
    const lies = (wert) => () => (wert ? { wert, quelle: 'benutzer' } : null);
    const o = modelle.ordner({ cfg: LOKAL, lies: lies('D:\\Ollama\\models'), plattform: 'win32' });
    assert.ok(o.lokal && o.pfad === 'D:\\Ollama\\models' && o.quelle === 'benutzer' && o.systemlaufwerk === false && o.aendern, JSON.stringify(o));
    const sysLw = String(process.env.SystemDrive || 'C:');
    assert.strictEqual(modelle.ordner({ cfg: LOKAL, lies: lies(sysLw + '\\m'), plattform: 'win32' }).systemlaufwerk, true);
    const std = modelle.ordner({ cfg: LOKAL, lies: lies(null), plattform: 'win32', heim: 'C:\\Users\\x' });
    assert.ok(std.pfad === path.join('C:\\Users\\x', '.ollama', 'models') && std.quelle === 'standard');
    const fern = { lokaleModelle: { upstreamUrl: 'http://192.168.1.5:11434' } };
    assert.deepStrictEqual(modelle.ordner({ cfg: fern, lies: lies('D:\\x'), plattform: 'win32' }), { lokal: false });
    // Aendern: Pfad, Plattform, Ort, Bestaetigung, Probe.
    const gesetzt = [];
    const setze = async (n, w) => { gesetzt.push([n, w]); };
    for (const boese of ['relativ\\x', '\\\\server\\share', 'D:\\a\\..\\b', 'D:\\a"b', 'D:\\%TEMP%', '', 'D:\\' + 'x'.repeat(200),
      'D:\\CON', 'D:\\m\\nul.txt', 'D:\\x.', 'D:\\x \\y', 'D:\\a:b', 'C:\\Windows\\m', 'C:\\Program Files\\m']) {
      await assert.rejects(modelle.setzeOrdner({ cfg: LOKAL, pfad: boese, bestaetigt: true, plattform: 'win32', setze, probe: false }), Error, boese);
    }
    await assert.rejects(modelle.setzeOrdner({ cfg: LOKAL, pfad: 'D:\\x', bestaetigt: true, plattform: 'linux', setze, probe: false }), /nur unter Windows/i);
    await assert.rejects(modelle.setzeOrdner({ cfg: fern, pfad: 'D:\\x', bestaetigt: true, plattform: 'win32', setze, probe: false }), /nicht auf diesem Rechner/);
    const frage = await modelle.setzeOrdner({ cfg: LOKAL, pfad: 'D:\\Modelle\\', plattform: 'win32', setze, probe: false });
    assert.ok(frage.bestaetigen && frage.ziel.pfad === 'D:\\Modelle' && gesetzt.length === 0, JSON.stringify(frage));
    const probe = await modelle.setzeOrdner({ cfg: LOKAL, pfad: 'D:\\Modelle', bestaetigt: true, plattform: 'win32', setze, probe: true });
    assert.ok(probe.probe && gesetzt.length === 0);
    const ziel = path.join(os.tmpdir(), 'c2i-modelle-test-' + process.pid);
    try {
      const ok = await modelle.setzeOrdner({ cfg: LOKAL, pfad: ziel, bestaetigt: true, plattform: 'win32', setze, probe: false, lies: lies(ziel) });
      assert.ok(ok.ok && fs.existsSync(ziel) && /Neustart von Ollama/.test(ok.hinweis), JSON.stringify(ok));
      assert.deepStrictEqual(gesetzt, [['OLLAMA_MODELS', ziel]]);
    } finally { fs.rmSync(ziel, { recursive: true, force: true }); }
  }

  async function laden() {
    const zeilen = [{ status: 'pulling manifest' }, { status: 'pulling abc', total: 100, completed: 40 }, { status: 'pulling abc', total: 100, completed: 100 }, { status: 'success' }];
    const o = ollama({ '/api/pull': (b) => (b.model && b.stream === true ? { zeilen } : new Error('falscher Aufruf')) });
    for (const boese of ['../x', 'a b', 'hf.co/../x', 'x:'.repeat(50), '', 'C:\\modelle\\a.gguf']) {
      await assert.rejects(modelle.lade({ cfg: LOKAL, name: boese, fetchFn: o.fn }), /ungueltig/, boese);
    }
    const frage = await modelle.lade({ cfg: LOKAL, name: 'hf.co/nutzer/repo:Q4_K_M', fetchFn: o.fn, lies: () => ({ wert: 'D:\\Ollama\\models', quelle: 'benutzer' }) });
    assert.ok(frage.bestaetigen && frage.name === 'hf.co/nutzer/repo:Q4_K_M' && frage.ziel.pfad === 'D:\\Ollama\\models', JSON.stringify(frage));
    assert.ok(!o.aufrufe.some((a) => a.pfad === '/api/pull'), 'ohne Bestaetigung geladen');
    const fort = [];
    const r = await modelle.lade({ cfg: LOKAL, name: 'qwen3:8b', bestaetigt: true, fetchFn: o.fn, melde: (f) => fort.push(f) });
    assert.ok(r.ok && fort.length === 4 && fort[1].gesamt === 100 && fort[1].fertig === 40 && fort[3].status === 'success', JSON.stringify(fort));
    assert.strictEqual(o.aufrufe.find((a) => a.pfad === '/api/pull').port, '11434');
    // Fehlerzeile und abgebrochener Strom sind kein Erfolg.
    const kaputt = ollama({ '/api/pull': { zeilen: [{ status: 'pulling' }, { error: 'pull model manifest: file does not exist' }] } });
    await assert.rejects(modelle.lade({ cfg: LOKAL, name: 'gibtsnicht:1b', bestaetigt: true, fetchFn: kaputt.fn }), /file does not exist/);
    const halb = ollama({ '/api/pull': { zeilen: [{ status: 'pulling', total: 9, completed: 3 }] } });
    await assert.rejects(modelle.lade({ cfg: LOKAL, name: 'x:1b', bestaetigt: true, fetchFn: halb.fn }), /nicht abgeschlossen/);
    // Zu wenig Platz: keine Rueckfrage, sondern Abbruch.
    await assert.rejects(modelle.lade({ cfg: LOKAL, name: 'qwen3:8b', fetchFn: o.fn, lies: () => ({ wert: 'D:m', quelle: 'benutzer' }), frei: () => 1.2 }), /Zu wenig Platz/);
    // hf.co ist als fremdes Repo markiert.
    assert.strictEqual(frage.fremd, true);
    // Laufzeit nicht erkannt (alle Sonden stumm): nicht als "kein Ollama" melden.
    const stumm = server({ '/v1/models': { data: [{ id: 'a' }] } });
    const lu = await modelle.liste({ cfg: LOKAL, fetchFn: stumm.fn });
    assert.ok(lu.laufzeit === 'unbekannt' && /nicht erkannt/.test(lu.fehler), JSON.stringify(lu));
    await assert.rejects(modelle.lade({ cfg: LOKAL, name: 'qwen3:8b', fetchFn: stumm.fn }), /nicht erkannt/);
    // Antwortform falsch: Fehler statt "0 Modelle".
    const form = await modelle.liste({ cfg: LOKAL, fetchFn: server({ '/v1/models': { models: [] } }).fn });
    assert.ok(!form.erreichbar && /unerwartete Antwort/.test(form.fehler), JSON.stringify(form));
    // Strom steht still: Leerlauf-Wecker bricht ab, Sperre wird frei.
    const nie2 = new Promise(() => {});
    const still = ollama({ '/api/pull': { zeilen: [{ status: 'pulling' }, { status: 'success' }], warte: nie2 } });
    await assert.rejects(modelle.lade({ cfg: LOKAL, name: 's:1b', bestaetigt: true, fetchFn: still.fn, stillMs: 50 }), /Download hängt/);
    const nachher = ollama({ '/api/pull': { zeilen: [{ status: 'success' }] } });
    assert.ok((await modelle.lade({ cfg: LOKAL, name: 't:1b', bestaetigt: true, fetchFn: nachher.fn })).ok, 'Sperre nach Haenger nicht frei');
    // Nicht Ollama: kein Laden.
    const lm = server({ '/v1/models': { data: [] }, '/api/v1/models': { models: [] } });
    await assert.rejects(modelle.lade({ cfg: LOKAL, name: 'qwen3:8b', fetchFn: lm.fn }), /nur mit Ollama/);
    // Nur ein Download gleichzeitig.
    let los;
    const warte = new Promise((r) => { los = r; });
    const lang = ollama({ '/api/pull': { zeilen: [{ status: 'pulling' }, { status: 'success' }], warte } });
    const erster = modelle.lade({ cfg: LOKAL, name: 'a:1b', bestaetigt: true, fetchFn: lang.fn });
    await new Promise((r) => setTimeout(r, 20));
    await assert.rejects(modelle.lade({ cfg: LOKAL, name: 'b:1b', bestaetigt: true, fetchFn: lang.fn }), /schon ein Modell/);
    los();
    assert.ok((await erster).ok);
  }

  return [
    ['Cira Modelle Liste: /v1/models, Laufzeit erkannt (Ollama, LM Studio, Lemonade, llama.cpp)', liste],
    ['Cira Modelle Speichern: nur Modelle aus der Liste, eigene Woerter mit Grenze', speichern],
    ['Cira Modelle Routing: Rolle aus Woertern, Laenge, eigenen Woertern; unklar -> Denken', routing],
    ['Cira Modelle Eskalation: Stufe hoeher bei Abgabe, Fehler, fremden Zahlen; Claude nur Angebot', eskalation],
    ['Cira Modelle Route: Rolle, Modell, Grund gespeichert, falsch zugeordnet markiert', route],
    ['Cira Modelle Ordner: OLLAMA_MODELS, Systemlaufwerk, Aendern nur geprueft und bestaetigt', ordner],
    ['Cira Modelle Laden: Name geprueft, Bestaetigung, Fortschritt, nur Ollama, einer zur Zeit', laden],
  ];
};
