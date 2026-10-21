'use strict';
// Masterplan 3.0, Block C5 (Sitzungen I — Engine): Claude Code als Kindprozess
// im Stream-Protokoll. Die Tests ersetzen den Prozess durch eine Attrappe mit
// stdin/stdout; was die echte CLI sendet, ist dem Spike G0 (19.10.) entnommen.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');

const W = path.join(__dirname, '..', '..');
const CFG = path.join(W, 'config.json');

module.exports = ({ dbmod, openDbs }) => {
  const sitzungen = require('../../sitzungen');
  const freigaben = require('../../freigaben');
  const ereignisse = require('../../ereignisse');
  const backfill = require('../../backfill');
  const srv = () => require('../../server');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c5-'));
  const ordner = path.join(tmp, 'projekt');
  fs.mkdirSync(ordner, { recursive: true });

  // Attrappe fuer claude.exe: merkt sich Aufruf und alles auf stdin.
  function attrappe() {
    const aufrufe = [];
    const spawnFn = (exe, args, opt) => {
      const k = new EventEmitter();
      k.pid = 4242 + aufrufe.length;
      k.stdin = new PassThrough(); k.stdout = new PassThrough(); k.stderr = new PassThrough();
      k.geschrieben = [];
      k.stdin.on('data', (b) => { for (const z of String(b).split('\n')) if (z.trim()) k.geschrieben.push(JSON.parse(z)); });
      k.sag = (o) => k.stdout.write(JSON.stringify(o) + '\n');
      k.ende = (code = 0) => k.emit('close', code);
      aufrufe.push({ exe, args, opt, kind: k });
      return k;
    };
    return { aufrufe, spawnFn };
  }
  const warte = () => new Promise((ok) => setImmediate(ok));
  function dienst(extra = {}) {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const a = attrappe();
    const beendet = [];
    const vorgemerkt = [];
    const d = sitzungen.erzeuge({
      db, exe: () => 'C:/claude.exe', spawnFn: a.spawnFn,
      arbeitsbereiche: () => [{ name: 'Proj', pfad: ordner, art: 'projekt' }, { name: 'Weg', pfad: path.join(tmp, 'fehlt'), art: 'neutral' }],
      vormerken: (sid, v) => { if (v && !/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(v)) throw new Error('Vorgang ungueltig'); vorgemerkt.push([sid, v]); return v ? v.toUpperCase() : null; },
      beenden: (pid) => beendet.push(pid), stoppWarteMs: 5, ...extra,
    });
    return { db, d, a, beendet, vorgemerkt, zu: () => d.schliesse() };
  }
  const INIT = { type: 'system', subtype: 'init', model: 'claude-haiku-5-5', permissionMode: 'default', claude_code_version: '2.1.303', cwd: ordner,
    tools: ['Read', 'Write'], mcp_servers: [{ name: 'github', status: 'connected' }], plugins: [{ name: 'superpowers' }], agents: [], skills: [] };

  /* ---------- Start ---------- */
  async function start() {
    const { db, d, a, vorgemerkt, zu } = dienst();
    try {
      const s = d.starte({ arbeitsbereich: 'Proj', prompt: 'Hallo', vorgang: 'abc-7', modell: 'haiku' });
      assert.ok(sitzungen.SID_RE.test(s.id), 'id ist keine session_id');
      const { exe, args, opt, kind } = a.aufrufe[0];
      assert.strictEqual(exe, 'C:/claude.exe');
      for (const x of ['-p', '--input-format', '--output-format', '--verbose']) assert.ok(args.includes(x), x + ' fehlt');
      assert.strictEqual(args[args.indexOf('--permission-prompt-tool') + 1], 'stdio', 'Rechte-Anfragen nicht ueber stdio');
      assert.strictEqual(args[args.indexOf('--session-id') + 1], s.id, 'session-id fehlt');
      assert.strictEqual(args[args.indexOf('--model') + 1], 'haiku');
      // Entwickler-Sitzung: keine Sandbox wie Cira-T2, aber auch keine Shell.
      assert.ok(!args.includes('--tools') && !args.includes('--setting-sources'), 'Sitzung laeuft sandboxed');
      assert.ok(!opt.shell, 'mit Shell gestartet');
      assert.strictEqual(opt.cwd, ordner, 'cwd ist nicht der Arbeitsbereich');
      assert.ok(!Object.keys(opt.env).some((k) => /TOKEN|SECRET|API_?KEY/i.test(k)), 'Geheimnis in der Kind-Umgebung');
      await warte();
      assert.deepStrictEqual(kind.geschrieben[0], { type: 'user', message: { role: 'user', content: 'Hallo' } }, 'erste Eingabe fehlt');
      const z = db.prepare('SELECT * FROM sitzung WHERE id = ?').get(s.id);
      assert.strictEqual(z.status, 'startet'); assert.strictEqual(z.pid, kind.pid); assert.strictEqual(z.vorgang, 'ABC-7'); assert.strictEqual(z.arbeitsbereich, 'Proj');
      assert.deepStrictEqual(vorgemerkt, [[s.id, 'abc-7']]);
      const n = a.aufrufe.length;
      assert.throws(() => d.starte({ arbeitsbereich: 'Gibts', prompt: 'x' }), /Arbeitsbereich unbekannt/);
      assert.throws(() => d.starte({ arbeitsbereich: 'Weg', prompt: 'x' }), /nicht erreichbar/);
      assert.throws(() => d.starte({ arbeitsbereich: 'Proj', prompt: '' }), /Auftrag/);
      assert.throws(() => d.starte({ arbeitsbereich: 'Proj', prompt: 'x', agent: '--dangerously-skip-permissions' }), /Agent/);
      assert.throws(() => d.starte({ arbeitsbereich: 'Proj', prompt: 'x', modell: '-x' }), /Modell/);
      assert.throws(() => d.starte({ arbeitsbereich: 'Proj', prompt: 'x', vorgang: 'a b' }), /Vorgang/);
      assert.throws(() => d.starte({ arbeitsbereich: 'Proj', prompt: 'x', modus: 'bypassPermissions' }), /Modus/, 'bypassPermissions erlaubt');
      assert.ok(!args.includes('--permission-mode'), 'ohne Wahl ein Rechte-Modus gesetzt (Nutzer-Settings gelten)');
      assert.strictEqual(a.aufrufe.length, n, 'ungueltiger Start hat einen Prozess erzeugt');
      d.starte({ arbeitsbereich: 'Proj', prompt: 'x', agent: 'bm:gsd-planner', modus: 'manual' });
      assert.ok(a.aufrufe[n].args.includes('--agent=bm:gsd-planner'), 'Agent nicht als ein Argument');
      assert.strictEqual(a.aufrufe[n].args[a.aufrufe[n].args.indexOf('--permission-mode') + 1], 'manual');
    } finally { zu(); }
  }

  /* ---------- Ereignisse aus dem Strom ---------- */
  async function strom() {
    const { db, d, a, zu } = dienst();
    const gesehen = [];
    const h = (e) => gesehen.push(e);
    ereignisse.bus.on('ereignis', h);
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'Los' });
      const k = a.aufrufe[0].kind;
      k.sag(INIT);
      k.sag({ type: 'system', subtype: 'hook_started' });
      k.sag({ type: 'assistant', message: { usage: { input_tokens: 10, cache_read_input_tokens: 19990, cache_creation_input_tokens: 0 }, content: [
        { type: 'thinking', thinking: 'geheim' },
        { type: 'text', text: 'Ich schaue nach.' },
        { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'C:/x/a.js' } },
        { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: 'C:/x/a.js', old_string: 'a', new_string: 'b' } },
        { type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'git status' } },
        { type: 'tool_use', id: 't4', name: 'mcp__github__get_issue', input: {} },
        { type: 'tool_use', id: 't5', name: 'Skill', input: { skill: 'plan-mode' } },
        { type: 'tool_use', id: 't6', name: 'TodoWrite', input: {} },
      ] } });
      k.stdout.write('kein json\n');
      k.sag({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.25, num_turns: 2, duration_ms: 900, modelUsage: { 'claude-haiku-5-5': { contextWindow: 200000 } } });
      k.sag({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.4 });
      await warte();
      const z = db.prepare('SELECT * FROM sitzung WHERE id = ?').get(id);
      assert.strictEqual(z.model, 'claude-haiku-5-5'); assert.strictEqual(z.mode, 'default');
      assert.strictEqual(z.status, 'bereit', 'nach dem Zug nicht bereit');
      assert.strictEqual(z.kosten_usd, 0.4);
      assert.strictEqual(z.ctx_pct, 10, 'Kontext-Fuellstand');
      const g = JSON.parse(z.init_json);
      assert.deepStrictEqual([g.version, g.werkzeuge, g.mcp[0].name, g.plugins[0]], ['2.1.303', 2, 'github', 'superpowers']);
      const ev = db.prepare('SELECT art, titel, meta, kosten_usd FROM sitzung_ereignis WHERE session_id = ? ORDER BY id').all(id);
      assert.deepStrictEqual(ev.map((e) => e.art), ['eingabe', 'say', 'read', 'edit', 'bash', 'mcp', 'skill', 'werkzeug', 'zug', 'zug']);
      assert.strictEqual(ev[2].titel, 'Read: C:/x/a.js'); assert.strictEqual(ev[4].titel, 'Bash: git status'); assert.strictEqual(ev[6].titel, 'Skill: plan-mode');
      // Kosten je Zug als Differenz der kumulierten CLI-Summe.
      assert.deepStrictEqual(ev.filter((e) => e.art === 'zug').map((e) => e.kosten_usd), [0.25, 0.15]);
      assert.ok(!ev.some((e) => /geheim/.test(e.titel || '')), 'Denkblock als Ereignis');
      assert.ok(gesehen.some((e) => e.art === 'sitzung' && e.daten.id === id && e.daten.ereignis && e.daten.ereignis.art === 'read'), 'Ereignis nicht auf dem Bus');
      assert.ok(gesehen.some((e) => e.art === 'sitzung' && e.daten.status === 'laeuft'), 'Status laeuft nicht gemeldet');
    } finally { ereignisse.bus.off('ereignis', h); zu(); }
  }

  /* ---------- Rechte: Anfrage -> Freigabe -> Antwort ---------- */
  const ANFRAGE = (rid, name = 'Write', input = { file_path: 'C:/x/probe.txt', content: 'hallo' }) =>
    ({ type: 'control_request', request_id: rid, request: { subtype: 'can_use_tool', tool_name: name, input, tool_use_id: 'tu' } });

  async function rechteErlaubt() {
    const { db, d, a, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'Schreib' });
      const k = a.aufrufe[0].kind;
      k.sag(INIT); k.sag(ANFRAGE('r1'));
      await warte();
      const f = freigaben.liste(db).find((x) => x.art === 'sitzung_frage');
      assert.ok(f, 'keine Freigabe');
      assert.strictEqual(f.bezug, id); assert.strictEqual(f.quelle, 'sitzung:' + id); assert.ok(f.ausfuehrbar, 'Art nicht in der Registry');
      assert.match(f.titel, /Write: C:\/x\/probe\.txt/);
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(id).status, 'wartet');
      assert.ok(!k.geschrieben.some((m) => m.type === 'control_response'), 'Antwort vor der Entscheidung');
      await freigaben.entscheide(db, f.id, { wahl: 'ok' });
      await warte();
      const antwort = k.geschrieben.find((m) => m.type === 'control_response');
      assert.deepStrictEqual(antwort, { type: 'control_response', response: { subtype: 'success', request_id: 'r1', response: { behavior: 'allow', updatedInput: { file_path: 'C:/x/probe.txt', content: 'hallo' } } } });
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(id).status, 'laeuft');
      // Zweimal entscheiden geht nicht; eine erledigte Anfrage bekommt keine zweite Antwort.
      await assert.rejects(freigaben.entscheide(db, f.id, { wahl: 'ok' }), /schon entschieden/);
    } finally { zu(); }
  }

  async function rechteAbgelehnt() {
    const { db, d, a, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'Schreib' });
      const k = a.aufrufe[0].kind;
      k.sag(ANFRAGE('r2', 'Bash', { command: 'rm -rf /' }));
      await warte();
      const f = freigaben.liste(db).find((x) => x.art === 'sitzung_frage');
      await freigaben.entscheide(db, f.id, { wahl: 'ablehnen', hinweis: 'nicht loeschen' });
      await warte();
      const antwort = k.geschrieben.find((m) => m.type === 'control_response');
      assert.ok(antwort, 'Ablehnung nicht an den Prozess');
      assert.strictEqual(antwort.response.request_id, 'r2');
      assert.strictEqual(antwort.response.response.behavior, 'deny');
      assert.match(antwort.response.response.message, /nicht loeschen/);
      assert.ok(db.prepare("SELECT 1 FROM sitzung_ereignis WHERE session_id = ? AND art = 'rechte' AND meta = 'abgelehnt'").get(id));
    } finally { zu(); }
  }

  async function rueckfrage() {
    const { db, d, a, zu } = dienst();
    try {
      d.starte({ arbeitsbereich: 'Proj', prompt: 'Frag mich' });
      const k = a.aufrufe[0].kind;
      const input = { questions: [{ question: 'Welche Farbe?', header: 'Farbe', options: [{ label: 'Rot' }, { label: 'Blau' }], multiSelect: false }] };
      k.sag(ANFRAGE('r3', 'AskUserQuestion', input));
      await warte();
      const f = freigaben.liste(db).find((x) => x.art === 'sitzung_frage');
      assert.match(f.titel, /Claude fragt: Welche Farbe\?/);
      await assert.rejects(freigaben.entscheide(db, f.id, { wahl: 'ok' }), /Antwort fehlt/);
      assert.strictEqual(freigaben.liste(db).find((x) => x.id === f.id).status, 'offen', 'Freigabe nach fehlender Antwort nicht wieder offen');
      await freigaben.entscheide(db, f.id, { wahl: 'ok', hinweis: 'Blau' });
      await warte();
      const antwort = k.geschrieben.find((m) => m.type === 'control_response');
      assert.deepStrictEqual(antwort.response.response.updatedInput.answers, { 'Welche Farbe?': 'Blau' });
    } finally { zu(); }
  }

  /* ---------- Eingabe, Ende, Stopp ---------- */
  async function eingabeUndEnde() {
    const { db, d, a, zu } = dienst();
    const gesehen = [];
    const h = (e) => gesehen.push(e);
    ereignisse.bus.on('ereignis', h);
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'Eins', vorgang: 'ABC-1' });
      const k = a.aufrufe[0].kind;
      k.sag(INIT);
      d.eingabe(id, { text: 'Zwei' });
      await warte();
      assert.deepStrictEqual(k.geschrieben.map((m) => m.message.content), ['Eins', 'Zwei']);
      assert.throws(() => d.eingabe(id, { text: '' }), /Eingabe/);
      k.sag(ANFRAGE('r4'));
      await warte();
      assert.strictEqual(d.anzahlOffen(), 1);
      k.ende(0);
      const z = db.prepare('SELECT * FROM sitzung WHERE id = ?').get(id);
      assert.strictEqual(z.status, 'beendet'); assert.strictEqual(z.pid, null); assert.ok(z.beendet);
      assert.strictEqual(d.laufend.size, 0);
      assert.strictEqual(freigaben.liste(db, { status: 'offen' }).length, 0, 'offene Rechte-Anfrage nach dem Ende');
      assert.ok(gesehen.some((e) => e.art === 'sitzung_beendet' && e.daten.id === id && e.daten.vorgang === 'ABC-1'), 'sitzung_beendet fehlt');
      assert.throws(() => d.eingabe(id, { text: 'Drei' }), (e) => e.status === 409);
      assert.throws(() => d.stopp(id), (e) => e.status === 409);
      // Absturz: Code ungleich 0 ohne Stopp ist ein Fehler mit stderr.
      const b = d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k2 = a.aufrufe[1].kind;
      k2.sag(INIT);
      k2.stderr.write('Error: kaputt\n');
      await warte();
      k2.ende(1);
      const z2 = db.prepare('SELECT status, fehler FROM sitzung WHERE id = ?').get(b.id);
      assert.strictEqual(z2.status, 'fehler'); assert.match(z2.fehler, /kaputt/);
    } finally { ereignisse.bus.off('ereignis', h); zu(); }
  }

  async function stopp() {
    const { db, d, a, beendet, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k = a.aufrufe[0].kind;
      d.stopp(id);
      await warte();
      assert.ok(k.geschrieben.some((m) => m.type === 'control_request' && m.request.subtype === 'interrupt'), 'kein Unterbrechen');
      assert.ok(k.stdin.writableEnded, 'stdin nicht geschlossen');
      await new Promise((ok) => setTimeout(ok, 30));
      assert.deepStrictEqual(beendet, [k.pid], 'Prozessbaum nicht beendet');
      k.ende(1);
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(id).status, 'beendet', 'gestoppt zaehlt als Fehler');
      // Endet der Prozess vor Ablauf der Wartezeit, wird nichts mehr beendet.
      const b = d.starte({ arbeitsbereich: 'Proj', prompt: 'y' });
      d.stopp(b.id); a.aufrufe[1].kind.ende(0);
      await new Promise((ok) => setTimeout(ok, 30));
      assert.deepStrictEqual(beendet, [k.pid], 'beendeter Prozess wurde nochmals beendet (PID kann neu vergeben sein)');
    } finally { zu(); }
  }

  // Owner 20.10.: /exit in einer c2invoice-Sitzung. Die CLI ohne Terminal kennt den
  // Befehl nicht ("/exit isn't available in this environment"), also beendet c2invoice.
  async function exitEingabe() {
    const { db, d, a, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k = a.aufrufe[0].kind;
      await warte();
      const n = k.geschrieben.length;
      assert.deepStrictEqual(d.eingabe(id, { text: ' /EXIT \n' }), { id, status: 'stoppt' });
      await warte();
      assert.ok(!k.geschrieben.slice(n).some((m) => m.type === 'user'), '/exit an die CLI geschickt');
      assert.ok(k.geschrieben.some((m) => m.type === 'control_request' && m.request.subtype === 'interrupt'), 'nicht gestoppt');
      k.ende(0);
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(id).status, 'beendet');
      // Nur der Befehl allein beendet; "/exit bitte" ist eine normale Eingabe.
      const b = d.starte({ arbeitsbereich: 'Proj', prompt: 'y' });
      await warte();
      assert.deepStrictEqual(d.eingabe(b.id, { text: '/exit bitte' }), { id: b.id });
      assert.deepStrictEqual(d.eingabe(b.id, { text: '/quit' }), { id: b.id, status: 'stoppt' });
    } finally { zu(); }
  }

  // Owner 20.10.: /clear gibt der CLI eine neue Sitzungs-ID (Spike: neue init mit
  // anderer session_id). c2invoice fuehrt sie als Fortsetzung derselben Sitzung.
  async function clearFolge() {
    const { db, d, a, vorgemerkt, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x', vorgang: 'ABC-1' });
      const k = a.aufrufe[0].kind;
      k.sag({ ...INIT, session_id: id, slash_commands: ['clear', 'compact', 'caveman:caveman-help'] });
      await warte();
      assert.deepStrictEqual(d.details(id).geladen.befehle.map((b) => b.name), ['clear', 'compact', 'caveman:caveman-help'], 'Befehlsliste nicht gespeichert');
      k.sag({ type: 'system', subtype: 'commands_changed', commands: [{ name: 'clear', description: 'Verlauf leeren' }, { name: 'neu-skill', description: 'x'.repeat(400) }] });
      await warte();
      const befehle = d.details(id).geladen.befehle;
      assert.deepStrictEqual(befehle.map((b) => b.name), ['clear', 'neu-skill']);
      assert.strictEqual(befehle[0].text, 'Verlauf leeren');
      assert.ok(befehle[1].text.length <= 160, 'Beschreibung nicht gekappt');
      const NEU = '0fa22940-147d-4063-b92d-cfe1abd8e61e';
      k.sag({ ...INIT, session_id: NEU });
      await warte();
      assert.deepStrictEqual(vorgemerkt.filter(([s]) => s === NEU), [[NEU, 'ABC-1']], 'Vorgang nicht auf die neue ID vorgemerkt');
      assert.strictEqual(d.aktuelleId(id), NEU, 'Fortsetzen nimmt nicht die neueste ID');
      // Die neue ID ist keine zweite, fremde Sitzung in der Liste.
      db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, cost_usd, day) VALUES ('n1', ?, ?, 'Proj', 'claude-opus-5', 0.1, ?)`).run(new Date().toISOString(), NEU, new Date().toISOString().slice(0, 10));
      assert.ok(!d.liste().sitzungen.some((s) => s.id === NEU), 'Fortsetzung als fremde Sitzung gelistet');
      // Neuer Vorgang gilt fuer alle IDs der Sitzung.
      d.zuordnung(id, { vorgang: 'XYZ-2' });
      assert.ok(vorgemerkt.some(([s, v]) => s === NEU && v === 'XYZ-2'), 'Umbuchung erreicht die Fortsetzung nicht');
      // Ein zweites /clear: Kette, neueste gewinnt; dieselbe init doppelt legt nichts doppelt an.
      const NEU2 = '1fa22940-147d-4063-b92d-cfe1abd8e61e';
      k.sag({ ...INIT, session_id: NEU2 }); k.sag({ ...INIT, session_id: NEU2 });
      await warte();
      assert.strictEqual(d.aktuelleId(id), NEU2);
      assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM sitzung_folge WHERE sitzung = ?').get(id).n, 2);
    } finally { zu(); }
  }

  // Owner 20.10.: sichtbar, dass Claude arbeitet (Laufzeit, Tokens), wie in Claude Code.
  async function zugAnzeige() {
    const { d, a, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k = a.aufrufe[0].kind;
      k.sag({ ...INIT, session_id: id });
      await warte();
      const z1 = d.details(id).zug;
      assert.ok(z1 && Date.parse(z1.seit) <= Date.now() && z1.tokens === 0, 'Zug nach dem Start fehlt: ' + JSON.stringify(z1));
      // Spike 20.10.: die assistant-Nachricht traegt den Platzhalter vom Antwortbeginn (2, 3, 6),
      // erst message_delta (--include-partial-messages) die endgueltige Zahl = result = JSONL.
      const antwort = (mid, platzhalter, endgueltig) => {
        k.sag({ type: 'stream_event', event: { type: 'message_start', message: { id: mid, usage: { output_tokens: platzhalter } } } });
        k.sag({ type: 'assistant', message: { id: mid, content: [{ type: 'text', text: 'x' }], usage: { input_tokens: 5, output_tokens: platzhalter } } });
        k.sag({ type: 'stream_event', event: { type: 'message_delta', usage: { output_tokens: endgueltig } } });
      };
      antwort('m1', 2, 122); antwort('m2', 6, 18);
      // Subagent zaehlt nicht mit (wie die Kontextanzeige).
      k.sag({ type: 'stream_event', parent_tool_use_id: 't1', event: { type: 'message_start', message: { id: 's1' } } });
      k.sag({ type: 'stream_event', parent_tool_use_id: 't1', event: { type: 'message_delta', usage: { output_tokens: 999 } } });
      await warte();
      assert.strictEqual(d.details(id).zug.tokens, 140, 'Tokens nicht aus message_delta (Spike: 122 + 18 = result.usage)');
      assert.ok(a.aufrufe[0].args.includes('--include-partial-messages'), 'ohne --include-partial-messages kein message_delta');
      k.sag({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.01, duration_ms: 10, num_turns: 1 });
      await warte();
      assert.strictEqual(d.details(id).zug, null, 'Zug nach dem Ende noch da');
      d.eingabe(id, { text: 'weiter' });
      assert.ok(d.details(id).zug && d.details(id).zug.tokens === 0, 'neuer Zug nach Eingabe fehlt');
    } finally { zu(); }
  }

  /* ---------- Befunde aus den Reviews (Security + Silent Failure) ---------- */
  // Exit 0 ohne init (z. B. nicht angemeldet) ist ein Fehler mit dem Klartext
  // von stdout; die letzte Zeile ohne Zeilenende zaehlt; Vormerkung faellt weg.
  async function endeOhneInit() {
    const { db, d, a, vorgemerkt, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x', vorgang: 'ABC-5' });
      const k = a.aufrufe[0].kind;
      k.stdout.write('Not logged in · Please run /login\n');
      k.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Invalid API key', total_cost_usd: 0 }));
      await warte();
      k.ende(0);
      const z = db.prepare('SELECT status, fehler, vorgang FROM sitzung WHERE id = ?').get(id);
      assert.strictEqual(z.status, 'fehler', 'Exit 0 ohne init als beendet');
      assert.match(z.fehler, /Invalid API key/, 'letzte Zeile ohne Zeilenende nicht verarbeitet');
      assert.deepStrictEqual(vorgemerkt.at(-1), [id, ''], 'Vormerkung nicht zurueckgenommen');
      assert.strictEqual(z.vorgang, null);
      // Ohne Fehler-result, nur Klartext: der steht im Fehlertext.
      const b = d.starte({ arbeitsbereich: 'Proj', prompt: 'y' });
      a.aufrufe[1].kind.stdout.write('Not logged in\n');
      await warte();
      a.aufrufe[1].kind.ende(0);
      assert.match(db.prepare('SELECT fehler FROM sitzung WHERE id = ?').get(b.id).fehler, /Not logged in/);
    } finally { zu(); }
  }

  // Scheitert das Ablegen einer Rechte-Anfrage, bekommt die CLI ein deny statt ewig zu warten.
  async function anfrageScheitert() {
    const { db, d, a, zu } = dienst();
    const orig = freigaben.anlegen;
    try {
      d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k = a.aufrufe[0].kind;
      freigaben.anlegen = () => { throw new Error('DB voll'); };
      k.sag(ANFRAGE('r9'));
      await warte();
      freigaben.anlegen = orig;
      const antwort = k.geschrieben.find((m) => m.type === 'control_response');
      assert.ok(antwort && antwort.response.request_id === 'r9' && antwort.response.response.behavior === 'deny', 'keine Antwort an die CLI');
      assert.ok(db.prepare("SELECT 1 FROM sitzung_ereignis WHERE art = 'fehler' AND titel LIKE 'Interner Fehler%'").get(), 'Fehler nicht sichtbar');
    } finally { freigaben.anlegen = orig; zu(); }
  }

  // Zu grosse Eingabe: nur ablehnbar. Doppelte request_id ersetzt die alte Karte.
  // Zurueckgezogene Anfrage setzt "wartet" zurueck. Ablehnung, die nicht ankommt, steht da.
  async function anfrageGrenzen() {
    const { db, d, a, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k = a.aufrufe[0].kind;
      k.sag(INIT);
      k.sag(ANFRAGE('g1', 'Write', { file_path: 'a', content: 'x'.repeat(20000) }));
      await warte();
      const g = freigaben.liste(db).find((x) => x.art === 'sitzung_frage');
      assert.match(g.text, /zu groß zum Prüfen/);
      await assert.rejects(freigaben.entscheide(db, g.id, { wahl: 'ok' }), /zu groß/);
      assert.ok(!k.geschrieben.some((m) => m.type === 'control_response' && m.response.response.behavior === 'allow'), 'zu grosse Eingabe erlaubt');
      await freigaben.entscheide(db, g.id, { wahl: 'ablehnen' });
      await warte();
      k.sag(ANFRAGE('d1')); k.sag(ANFRAGE('d1', 'Bash', { command: 'ls' }));
      await warte();
      const offen = freigaben.liste(db).filter((x) => x.art === 'sitzung_frage');
      assert.strictEqual(offen.length, 1, 'doppelte request_id: zwei offene Karten');
      assert.match(offen[0].titel, /Bash/);
      k.sag({ type: 'control_cancel_request', request_id: 'd1' });
      await warte();
      assert.strictEqual(freigaben.liste(db).filter((x) => x.art === 'sitzung_frage').length, 0);
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(id).status, 'laeuft', 'wartet nach Rueckzug');
      // Ablehnen, waehrend die Sitzung stoppt (stdin zu): sichtbar statt "Abgelehnt".
      k.sag(ANFRAGE('s1'));
      await warte();
      const s1 = freigaben.liste(db).find((x) => x.art === 'sitzung_frage');
      k.stdin.end();
      await freigaben.entscheide(db, s1.id, { wahl: 'ablehnen' });
      await warte();
      assert.ok(db.prepare("SELECT 1 FROM sitzung_ereignis WHERE session_id = ? AND art = 'fehler' AND titel LIKE 'Ablehnung nicht zugestellt%'").get(id), 'nicht zugestellte Ablehnung unsichtbar');
    } finally { zu(); }
  }

  // bypassPermissions aus den Settings: Sitzung wird gestoppt. Kosten ohne total_cost_usd bleiben null.
  async function modusUndKosten() {
    const { db, d, a, beendet, zu } = dienst();
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k = a.aufrufe[0].kind;
      k.sag({ ...INIT, permissionMode: 'bypassPermissions' });
      await new Promise((ok) => setTimeout(ok, 30));
      assert.ok(k.stdin.writableEnded && beendet.includes(k.pid), 'bypassPermissions nicht gestoppt');
      k.ende(0);
      const z = db.prepare('SELECT status, fehler FROM sitzung WHERE id = ?').get(id);
      assert.strictEqual(z.status, 'fehler'); assert.match(z.fehler, /bypassPermissions/);
      const b = d.starte({ arbeitsbereich: 'Proj', prompt: 'y' });
      const k2 = a.aufrufe[1].kind;
      k2.sag(INIT); k2.sag({ type: 'result', subtype: 'success', is_error: false });
      await warte();
      assert.strictEqual(db.prepare('SELECT kosten_usd FROM sitzung WHERE id = ?').get(b.id).kosten_usd, null, 'fehlende Kosten als 0');
      k2.sag({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.3 });
      k2.sag({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.1 });
      await warte();
      assert.strictEqual(db.prepare('SELECT kosten_usd FROM sitzung WHERE id = ?').get(b.id).kosten_usd, 0.3, 'kleinere Summe uebernommen');
      assert.ok(!db.prepare('SELECT kosten_usd FROM sitzung_ereignis WHERE session_id = ? AND kosten_usd < 0').get(b.id), 'negatives Kosten-Delta');
    } finally { zu(); }
  }

  // exit ohne close (ein MCP-Kind haelt die Pipes): Sitzung endet trotzdem, die alte PID wird nicht beendet.
  async function exitOhneClose() {
    const { db, d, a, beendet, zu } = dienst({ stoppWarteMs: 2500 });
    try {
      const { id } = d.starte({ arbeitsbereich: 'Proj', prompt: 'x' });
      const k = a.aufrufe[0].kind;
      k.sag(INIT);
      await warte();
      d.stopp(id);
      k.emit('exit', 0, null);
      await new Promise((ok) => setTimeout(ok, 2700));
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(id).status, 'beendet', 'Sitzung haengt ohne close');
      assert.deepStrictEqual(beendet, [], 'beendete PID nochmals beendet');
      assert.strictEqual(d.laufend.size, 0);
    } finally { zu(); }
  }

  // Hook-Status einer fremden Sitzung gilt, bis 5 h ohne Lebenszeichen vergangen sind (Owner 20.10., vorher 15 Minuten).
  async function hookAblauf() {
    const { db, d, zu } = dienst();
    try {
      const sid = '77777777-2222-4333-8444-555555555555';
      d.hook({ hook_event_name: 'Notification', session_id: sid, message: 'Frage', notification_type: 'permission_prompt' });
      db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, cost_usd, day) VALUES ('h1', '2026-10-19T08:00:00Z', ?, 'Fremd', 'claude-opus-5', 0.2, '2026-10-19')`).run(sid);
      assert.strictEqual(d.details(sid).status, 'wartet');
      db.prepare('UPDATE sitzung SET aktualisiert = ? WHERE id = ?').run(new Date(Date.now() - 20 * 60000).toISOString(), sid);
      assert.strictEqual(d.details(sid).status, 'wartet', 'nach 20 Minuten schon beendet');
      db.prepare('UPDATE sitzung SET aktualisiert = ? WHERE id = ?').run(new Date(Date.now() - 301 * 60000).toISOString(), sid);
      assert.strictEqual(d.details(sid).status, 'beendet', 'alter Hook-Status haengt fest');
      assert.ok(!d.liste({ offen: true }).sitzungen.some((s) => s.id === sid), 'alte Hook-Zeile als offen gelistet');
      // Nur der Hook, noch kein Ledger-Ereignis: Kosten unbekannt (null), nicht 0.
      const neu = '88888888-2222-4333-8444-555555555555';
      d.hook({ hook_event_name: 'Stop', session_id: neu });
      assert.strictEqual(d.details(neu).kosten_usd, null, 'Kosten ohne Ledger-Zeile als 0');
    } finally { zu(); }
  }

  /* ---------- Fremde Sitzung, Hook, Vormerken, Aufraeumen ---------- */
  async function fremd() {
    const { db, d, zu } = dienst({ werkzeug: (p) => p === 'Werkzeug' });
    try {
      const sid = '11111111-2222-4333-8444-555555555555';
      const datei = path.join(tmp, sid + '.jsonl');
      const zeilen = [
        { type: 'user', timestamp: '2026-10-19T10:00:00Z', message: { role: 'user', content: 'Bitte pruefen' } },
        { type: 'user', isMeta: true, message: { role: 'user', content: 'Caveat' } },
        { type: 'assistant', timestamp: '2026-10-19T10:00:05Z', message: { content: [{ type: 'text', text: 'Mache ich.' }, { type: 'tool_use', name: 'Grep', input: { pattern: 'TODO' } }] } },
        { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'treffer' }] } },
        { type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'Subagent' }] } },
        // Terminal-Ansicht (20.10.): voller Text statt 200 Zeichen, Diff auch fuer fremde Sitzungen.
        { type: 'assistant', timestamp: '2026-10-19T10:00:09Z', message: { content: [{ type: 'text', text: '**Fertig.** ' + 'x'.repeat(300) }, { type: 'tool_use', name: 'Edit', input: { file_path: 'a.js', old_string: 'alt', new_string: 'neu' } }] } },
      ];
      fs.writeFileSync(datei, zeilen.map((z) => JSON.stringify(z)).join('\n') + '\nkaputt\n');
      db.prepare('INSERT INTO files (path, offset, size, mtime_ms) VALUES (?,0,0,0)').run(datei);
      db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, cost_usd, day) VALUES ('f1', ?, ?, 'Fremd', 'ABC-3', 'ABC-3', 'claude-opus-5', 0.5, '2026-10-19')`).run(new Date().toISOString(), sid);
      // Werkzeugbetrieb (claude-mem …) ist keine fremde Sitzung, wie im Live-Tab.
      db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, cost_usd, day) VALUES ('f2', ?, '66666666-2222-4333-8444-555555555555', 'Werkzeug', 'claude-haiku-5', 0.1, '2026-10-19')`).run(new Date().toISOString());
      const r = d.details(sid);
      assert.strictEqual(r.quelle, 'fremd'); assert.strictEqual(r.nurLesen, true);
      assert.deepStrictEqual(r.ereignisse.slice(0, 3).map((e) => e.art + ':' + e.titel), ['eingabe:Bitte pruefen', 'say:Mache ich.', 'read:Grep: TODO']);
      const lang = r.ereignisse[3];
      assert.strictEqual(lang.titel.length, 200, 'Titel nicht gekappt');
      assert.strictEqual(lang.text, '**Fertig.** ' + 'x'.repeat(300), 'voller Text fehlt');
      assert.deepStrictEqual(r.ereignisse[4].diff, [{ z: '-', t: 'alt' }, { z: '+', t: 'neu' }], 'Diff fehlt im fremden Transkript');
      assert.strictEqual(r.ereignisse[0].text, 'Bitte pruefen');
      assert.strictEqual(r.vorgang, 'ABC-3'); assert.strictEqual(r.kosten_usd, 0.5);
      const l = d.liste({ offen: true });
      assert.ok(l.sitzungen.some((s) => s.id === sid && s.quelle === 'fremd' && s.live), 'fremde Live-Sitzung fehlt in der Liste');
      assert.strictEqual(d.anzahlOffen(), 1, 'zaehler.sitzungen zaehlt fremde Live-Sitzung nicht oder Werkzeugbetrieb mit');
      assert.ok(!l.sitzungen.some((s) => s.projekt === 'Werkzeug'), 'Werkzeugbetrieb als fremde Sitzung gelistet');
      assert.throws(() => d.details('../../etc'), (e) => e.status === 404);
      assert.throws(() => d.details('99999999-2222-4333-8444-555555555555'), (e) => e.status === 404);
      // Hook: wartet auf dich (Geheimnis prueft der Server, siehe hookRoute).
      d.hook({ hook_event_name: 'Notification', session_id: sid, message: 'Claude needs your permission' });
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(sid).status, 'wartet');
      assert.strictEqual(d.details(sid).hinweise[0].titel, 'Claude needs your permission');
      d.hook({ hook_event_name: 'Stop', session_id: sid });
      assert.strictEqual(db.prepare('SELECT status FROM sitzung WHERE id = ?').get(sid).status, 'bereit');
      assert.deepStrictEqual(d.hook({ hook_event_name: 'PreToolUse', session_id: sid }), { ignoriert: true });
      assert.throws(() => d.hook({ hook_event_name: 'Stop', session_id: 'x' }), /session_id/);
    } finally { zu(); }
  }

  // Owner 20.10.: offen, bis 5 h lang keine eigene Eingabe kam oder /exit (SessionEnd) sie beendet.
  async function fremdOffen() {
    const { db, d, zu } = dienst();
    try {
      const vor = (min) => new Date(Date.now() - min * 60000).toISOString();
      const sitzung = (sid, eingabeVorMin, letzteVorMin) => {
        const e = vor(eingabeVorMin);
        db.prepare('INSERT INTO activity (session_id, ts, project, ticket, day, eingabe) VALUES (?,?,?,?,?,1)').run(sid, e, 'Fremd', null, e.slice(0, 10));
        const l = vor(letzteVorMin);
        db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, cost_usd, day) VALUES (?, ?, ?, 'Fremd', 'claude-opus-5', 0.1, ?)`).run(sid + '-' + letzteVorMin, l, sid, l.slice(0, 10));
      };
      const A = 'aaaaaaaa-2222-4333-8444-555555555555';   // Eingabe vor 3 h, wartet seitdem
      const B = 'bbbbbbbb-2222-4333-8444-555555555555';   // Eingabe vor 6 h
      const C = 'cccccccc-2222-4333-8444-555555555555';   // Eingabe vor 6 h, Agent arbeitet noch
      sitzung(A, 180, 179);
      sitzung(B, 360, 359);
      sitzung(C, 360, 1);
      const offen = () => d.liste({ offen: true }).sitzungen.filter((s) => s.quelle === 'fremd').map((s) => s.id[0] + ':' + s.status).sort();
      assert.deepStrictEqual(offen(), ['a:bereit', 'c:laeuft'], 'offen nach 5-h-Regel');
      assert.strictEqual(d.details(B).status, 'beendet');
      assert.strictEqual(d.details(A).status, 'bereit');
      // /exit: SessionEnd beendet sofort.
      d.hook({ hook_event_name: 'SessionEnd', session_id: A, reason: 'prompt_input_exit' });
      assert.deepStrictEqual(offen(), ['c:laeuft'], '/exit beendet nicht');
      assert.strictEqual(d.details(A).status, 'beendet');
      // Fortgesetzt (claude --resume): neue Eingabe nach dem Ende oeffnet wieder.
      sitzung(A, -1, -1);
      assert.deepStrictEqual(offen(), ['a:laeuft', 'c:laeuft'], 'fortgesetzte Sitzung bleibt beendet');
      // Stop-Hook nach dem letzten Zug: bereit, auch nach mehr als 15 Minuten.
      d.hook({ hook_event_name: 'Stop', session_id: A });
      db.prepare("UPDATE sitzung SET aktualisiert = ? WHERE id = ?").run(new Date(Date.now() + 120000).toISOString(), A);
      assert.strictEqual(d.details(A).status, 'bereit');
    } finally { zu(); }
  }

  async function hookRoute() {
    const s = srv();
    const cfg = require(CFG);
    const alt = cfg.hook;
    cfg.hook = { geheimnis: 'g'.repeat(43) };
    const req = (h) => ({ headers: h });
    try {
      assert.strictEqual(s.hookErlaubt(req({})), false, 'ohne Geheimnis erlaubt');
      assert.strictEqual(s.hookErlaubt(req({ 'x-c2invoice-geheimnis': 'falsch' })), false, 'falsches Geheimnis erlaubt');
      assert.strictEqual(s.hookErlaubt(req({ 'x-c2invoice-geheimnis': 'g'.repeat(43) })), true, 'richtiges Geheimnis abgelehnt');
      cfg.hook = { geheimnis: 'kurz' };
      assert.strictEqual(s.hookErlaubt(req({ 'x-c2invoice-geheimnis': 'kurz' })), false, 'zu kurzes Geheimnis gilt');
      cfg.hook = { geheimnis: 'g'.repeat(43) };
      // Ueber HTTP: 401 vor dem Lesen des Koerpers (es entsteht keine Zeile).
      await new Promise((ok) => s.server.listen(0, '127.0.0.1', ok));
      try {
        const url = 'http://127.0.0.1:' + s.server.address().port + '/api/hook';
        const koerper = JSON.stringify({ hook_event_name: 'Notification', session_id: '11111111-2222-4333-8444-555555555555' });
        assert.strictEqual((await fetch(url, { method: 'POST', body: koerper })).status, 401);
        assert.strictEqual((await fetch(url, { method: 'POST', body: koerper, headers: { 'x-c2invoice-geheimnis': 'falsch' } })).status, 401);
      } finally { await new Promise((ok) => { s.server.closeAllConnections(); s.server.close(ok); }); }
    } finally { if (alt === undefined) delete cfg.hook; else cfg.hook = alt; }
  }

  // Starten/Eingeben/Stoppen nur aus der Oberflaeche; Lesen frei.
  async function routenHerkunft() {
    const http = require('node:http');
    const { d, a, zu } = dienst();
    const sendJson = (res, o, st = 200) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const leseKoerper = (req, fertig) => { let r = ''; req.on('data', (x) => { r += x; }); req.on('end', () => fertig(null, JSON.parse(r || '{}'))); };
    const s = http.createServer((req, res) => { const u = new URL(req.url, 'http://127.0.0.1'); if (!d.routen(req, res, u.pathname, u, { sendJson, leseKoerper })) sendJson(res, { error: 'nicht hier' }, 404); });
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    const basis = 'http://127.0.0.1:' + s.address().port;
    const post = (p, d2, kopf) => fetch(basis + p, { method: 'POST', headers: kopf, body: JSON.stringify(d2) });
    try {
      const start = { arbeitsbereich: 'Proj', prompt: 'x' };
      assert.strictEqual((await post('/api/sitzung', start, {})).status, 403, 'ohne Herkunft (curl) gestartet');
      assert.strictEqual((await post('/api/sitzung', start, { 'sec-fetch-site': 'cross-site' })).status, 403);
      assert.strictEqual((await post('/api/sitzung', start, { origin: 'http://127.0.0.1:1' })).status, 403, 'fremde Herkunft gestartet');
      assert.strictEqual(a.aufrufe.length, 0, 'abgewiesener Start hat einen Prozess erzeugt');
      const r = await post('/api/sitzung', start, { 'sec-fetch-site': 'same-origin' });
      assert.strictEqual(r.status, 200);
      const { id } = await r.json();
      assert.strictEqual((await post('/api/sitzung/' + id + '/eingabe', { text: 'y' }, {})).status, 403);
      assert.strictEqual((await post('/api/sitzung/' + id + '/stopp', {}, {})).status, 403);
      assert.strictEqual((await fetch(basis + '/api/sitzung/' + id)).status, 200, 'Lesen gesperrt');
      assert.strictEqual((await fetch(basis + '/api/sitzungen?offen=1')).status, 200);
    } finally { await new Promise((ok) => { s.closeAllConnections(); s.close(ok); }); zu(); }
  }

  async function vormerken() {
    const s = srv();
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const sid = '22222222-2222-4333-8444-555555555555';
    // Vor dem ersten Ereignis: nur der Override, der Backfill bucht beim Abgleich.
    assert.strictEqual(s.vormerkeVorgang(db, sid, 'abc-9'), 'ABC-9');
    assert.throws(() => s.vormerkeVorgang(db, sid, 'a b'), /Vorgang/);
    db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, model, cost_usd, day) VALUES ('v1', '2026-10-19T10:00:00Z', ?, 'P', 'main', 'claude-opus-5', 0.3, '2026-10-19')`).run(sid);
    backfill.run({ db });
    assert.deepStrictEqual({ ...db.prepare('SELECT ticket, ticket_quelle FROM events WHERE session_id = ?').get(sid) }, { ticket: 'ABC-9', ticket_quelle: 'override' });
    // Mit Ereignis: derselbe Weg wie /api/buchen; leer nimmt zurueck.
    assert.strictEqual(s.vormerkeVorgang(db, sid, ''), null);
    assert.strictEqual(db.prepare('SELECT ticket FROM events WHERE session_id = ?').get(sid).ticket, null);
  }

  async function aufraeumen() {
    const { db, d, zu } = dienst();
    try {
      db.prepare("INSERT INTO sitzung (id, quelle, status, pid, gestartet) VALUES ('33333333-2222-4333-8444-555555555555', 'c2invoice', 'laeuft', 999, '2026-10-19T10:00:00Z')").run();
      db.prepare("INSERT INTO sitzung (id, quelle, status, gestartet) VALUES ('44444444-2222-4333-8444-555555555555', 'fremd', 'wartet', '2026-10-19T10:00:00Z')").run();
      freigaben.anlegen(db, { art: 'sitzung_frage', bezug: '33333333-2222-4333-8444-555555555555', titel: 'alt', quelle: 'sitzung:33333333-2222-4333-8444-555555555555' });
      assert.strictEqual(d.aufraeumen(), 1);
      const z = db.prepare("SELECT status, pid FROM sitzung WHERE id LIKE '3333%'").get();
      assert.deepStrictEqual({ ...z }, { status: 'beendet', pid: null });
      assert.strictEqual(db.prepare("SELECT status FROM sitzung WHERE id LIKE '4444%'").get().status, 'wartet', 'fremde Sitzung angefasst');
      assert.strictEqual(freigaben.liste(db).length, 0, 'alte Rechte-Anfrage offen');
    } finally { zu(); }
  }

  return [
    ['C5 Start: Argumente, Arbeitsbereich-Ordner, keine Shell und keine Sandbox, erste Eingabe, Pruefung vor dem Prozess', start],
    ['C5 Ereignisse aus dem Strom: init, Text, Werkzeuge je Art, Zug mit Kosten und Kontext, Bus', strom],
    ['C5 Rechte-Anfrage wird Freigabe, Erlauben schickt control_response allow mit der Eingabe', rechteErlaubt],
    ['C5 Rechte-Anfrage abgelehnt: deny mit Hinweis an den Prozess', rechteAbgelehnt],
    ['C5 Rueckfrage (AskUserQuestion): Antwort aus dem Hinweis', rueckfrage],
    ['C5 Zweite Eingabe, Ende raeumt auf (Status, PID, offene Freigaben, sitzung_beendet), Absturz mit stderr', eingabeUndEnde],
    ['C5 Stopp: Unterbrechen, stdin zu, Prozessbaum nach Wartezeit, nicht nach dem Ende', stopp],
    ['C5 /exit oder /quit als Eingabe beendet die eigene Sitzung wie Stopp', exitEingabe],
    ['C5 Laufender Zug: seit und Tokens je Antwort, weg nach result, neu nach Eingabe', zugAnzeige],
    ['C5 /clear: neue Sitzungs-ID wird Fortsetzung (Vorgang, Liste, Fortsetzen), Befehlsliste gespeichert', clearFolge],
    ['C5 Exit 0 ohne init ist ein Fehler mit Klartext, letzte Zeile ohne Zeilenende zaehlt, Vormerkung faellt weg', endeOhneInit],
    ['C5 Scheitert das Ablegen einer Rechte-Anfrage, bekommt die CLI ein deny', anfrageScheitert],
    ['C5 Rechte-Anfrage: zu gross nur ablehnbar, doppelte request_id, Rueckzug, nicht zugestellte Ablehnung', anfrageGrenzen],
    ['C5 bypassPermissions aus den Settings stoppt die Sitzung; fehlende oder kleinere CLI-Kosten', modusUndKosten],
    ['C5 exit ohne close: Sitzung endet, alte PID wird nicht beendet', exitOhneClose],
    ['C5 Hook-Status einer fremden Sitzung gilt bis 5 h ohne Lebenszeichen; ohne Ledger Kosten null', hookAblauf],
    ['C5 Fremde Sitzung aus der JSONL (nur lesen), Liste und Zaehler, Hook-Status', fremd],
    ['C5 Fremde Sitzung offen bis 5 h ohne Eingabe, /exit beendet, Fortsetzen oeffnet wieder', fremdOffen],
    ['C5 Hook-Route: ohne oder mit falschem Geheimnis 401', hookRoute],
    ['C5 Routen: Starten, Eingeben, Stoppen nur aus der Oberflaeche, Lesen frei', routenHerkunft],
    ['C5 Vorgang vormerken vor dem ersten Ereignis, Backfill bucht', vormerken],
    ['C5 Aufraeumen beim Start: eigene offene Sitzungen beendet, fremde unberuehrt', aufraeumen],
  ];
};
