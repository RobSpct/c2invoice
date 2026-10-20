'use strict';
// Masterplan 3.0, Block C6a (Sitzungen II — Oberflaeche + Aktionen). Owner
// 19.10.2026: Vorgangs-Log als eigene Tabelle, Zusammenfassung durch das
// lokale Modell (ohne Modell keine Zeile), Uebergabe nur in einer laufenden
// eigenen Sitzung, "Zum Terminal" ohne Shell. Prozess wie in C5 als Attrappe.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');

const W = path.join(__dirname, '..', '..');

module.exports = ({ dbmod, openDbs }) => {
  const sitzungen = require('../../sitzungen');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c6-'));
  const ordner = path.join(tmp, 'mit leerzeichen');
  fs.mkdirSync(ordner, { recursive: true });
  const BEFEHL = 'wt -d "{pfad}" "{claude}" --resume {sitzung}';

  function dienst(extra = {}) {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const kinder = [];
    const spawnFn = (exe, args, opt) => {
      const k = new EventEmitter();
      k.pid = 5000 + kinder.length;
      k.stdin = new PassThrough(); k.stdout = new PassThrough(); k.stderr = new PassThrough();
      k.geschrieben = [];
      k.stdin.on('data', (b) => { for (const z of String(b).split('\n')) if (z.trim()) k.geschrieben.push(JSON.parse(z)); });
      k.sag = (o) => k.stdout.write(JSON.stringify(o) + '\n');
      k.ende = (code = 0) => k.emit('close', code);
      kinder.push(k);
      return k;
    };
    const verlaeufe = [];
    const terminals = [];
    let antwort = { text: 'Checkout auf drei Schritte umgebaut. Tests laufen. Offen: Major-Version.' };
    const d = sitzungen.erzeuge({
      db, exe: () => 'C:/claude.exe', spawnFn,
      arbeitsbereiche: () => [{ name: 'Proj', pfad: ordner, art: 'projekt' }],
      vormerken: (sid, v) => (v ? v.toUpperCase() : null),
      beenden: () => {}, stoppWarteMs: 5,
      zusammenfassen: async (verlauf) => { verlaeufe.push(verlauf); if (antwort === 'wirf') throw new TypeError('kaputt'); return antwort; },
      terminalBefehl: () => BEFEHL,
      spawnTerminal: (exe, args, opt) => { terminals.push({ exe, args, opt }); const k = new EventEmitter(); k.unref = () => {}; setImmediate(() => { if (exe === 'gibtsnicht') return k.emit('error', new Error('ENOENT')); k.emit('spawn'); if (exe === 'scheitert') k.emit('exit', 1); }); return k; },
      terminalWarteMs: 20,
      ...extra,
    });
    return { db, d, kinder, verlaeufe, terminals, setzeAntwort: (a) => { antwort = a; }, zu: () => d.schliesse() };
  }
  const warte = () => new Promise((ok) => setImmediate(ok));
  const INIT = { type: 'system', subtype: 'init', model: 'claude-opus-5-5', permissionMode: 'acceptEdits', claude_code_version: '2.1.303', cwd: ordner,
    tools: ['Read', 'Edit'], mcp_servers: [{ name: 'github', status: 'connected' }], plugins: [{ name: 'superpowers' }], agents: [], skills: [] };
  async function laufend(x, vorgang = 'abc-1', prompt = 'Baue den Checkout um') {
    const r = x.d.starte({ arbeitsbereich: 'Proj', prompt, vorgang });
    const k = x.kinder[x.kinder.length - 1];
    k.sag(INIT);
    k.sag({ type: 'assistant', message: { content: [{ type: 'text', text: 'Ich lese zuerst den Checkout.' },
      { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: 'src/Steps.tsx', old_string: 'alt eins\nalt zwei', new_string: 'neu eins' } }] } });
    k.sag({ type: 'result', subtype: 'success', total_cost_usd: 0.4, num_turns: 1 });
    await warte(); await warte();
    return { id: r.id, k };
  }
  const status = (fn) => { try { fn(); } catch (e) { return e.status; } return 200; };
  const statusAsync = async (p) => { try { await p; } catch (e) { return e.status; } return 200; };

  /* ---------- Zusammenfassung ins Vorgangs-Log ---------- */
  async function zusammenfassung() {
    const x = dienst();
    try {
      const { id } = await laufend(x);
      const r = await x.d.zusammenfassung(id);
      assert.strictEqual(r.vorgang, 'ABC-1');
      const v = x.verlaeufe[0];
      assert.ok(v.includes('Baue den Checkout um') && v.includes('Ich lese zuerst den Checkout.') && v.includes('src/Steps.tsx'), 'Verlauf unvollstaendig: ' + v);
      const zeilen = sitzungen.vorgangLog(x.db, 'ABC-1');
      assert.strictEqual(zeilen.length, 1);
      assert.deepStrictEqual({ quelle: zeilen[0].quelle, text: zeilen[0].text }, { quelle: 'sitzung:' + id, text: 'Checkout auf drei Schritte umgebaut. Tests laufen. Offen: Major-Version.' });
      // Doppelklick: die zweite Zusammenfassung waehrend der ersten ist 409, nur eine Zeile.
      const [a1, a2] = await Promise.allSettled([x.d.zusammenfassung(id), x.d.zusammenfassung(id)]);
      assert.ok(a1.status === 'fulfilled' && a2.status === 'rejected' && a2.reason.status === 409, 'parallele Zusammenfassung nicht abgewiesen');
      x.db.prepare('DELETE FROM vorgang_log WHERE id = ?').run(a1.value.id);
      // Ohne Modell: klare Meldung (503), keine Zeile, nichts erfunden.
      x.setzeAntwort({ fehlt: 'nicht erreichbar' });
      await assert.rejects(x.d.zusammenfassung(id), (e) => e.status === 503 && /nicht erreichbar/.test(e.message));
      assert.strictEqual(sitzungen.vorgangLog(x.db, 'ABC-1').length, 1, 'Zeile ohne Modell geschrieben');
      // Leere Antwort ist keine Zusammenfassung.
      x.setzeAntwort({ text: '   ' });
      assert.strictEqual(await statusAsync(x.d.zusammenfassung(id)), 503);
      // Ohne Vorgang: 409; unbekannte Sitzung: 404.
      x.setzeAntwort({ text: 'ok' });
      const ohne = await laufend(x, '');
      assert.strictEqual(await statusAsync(x.d.zusammenfassung(ohne.id)), 409);
      assert.strictEqual(await statusAsync(x.d.zusammenfassung('99999999-2222-4333-8444-555555555555')), 404);
      assert.strictEqual(await statusAsync(x.d.zusammenfassung('../x')), 404);
      // Langer Verlauf: der erste Auftrag bleibt, die Mitte faellt sichtbar weg.
      const k0 = x.kinder[0];
      for (let i = 0; i < 80; i++) k0.sag({ type: 'assistant', message: { content: [{ type: 'text', text: 'Zwischenstand ' + i + ' ' + 'y'.repeat(190) }] } });
      await warte(); await warte();
      await x.d.zusammenfassung(id);
      const lang = x.verlaeufe[x.verlaeufe.length - 1];
      assert.ok(lang.length <= 12000 && lang.startsWith('Auftrag: Baue den Checkout um') && lang.includes('ausgelassen') && lang.includes('Zwischenstand 79'), 'Kuerzung verliert die Aufgabe oder das Ende');
      x.db.prepare('DELETE FROM vorgang_log WHERE id = (SELECT MAX(id) FROM vorgang_log)').run();
      // Neueste zuerst, nur der eigene Vorgang.
      x.db.prepare("INSERT INTO vorgang_log (vorgang, zeit, quelle, text) VALUES ('ABC-1', '2099-01-01T00:00:00Z', 'cira', 'spaeter'), ('XYZ-2', '2099-01-01T00:00:00Z', 'cira', 'fremd')").run();
      assert.deepStrictEqual(sitzungen.vorgangLog(x.db, 'ABC-1').map((z) => z.text), ['spaeter', 'Checkout auf drei Schritte umgebaut. Tests laufen. Offen: Major-Version.']);
    } finally { x.zu(); }
  }

  /* ---------- Uebergabe nur in laufender eigener Sitzung ---------- */
  async function uebergabe() {
    const x = dienst();
    try {
      const { id, k } = await laufend(x);
      const r = x.d.uebergabe(id);
      assert.match(r.datei, /^handoffs\/HANDOFF-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.md$/);
      const letzte = k.geschrieben[k.geschrieben.length - 1];
      assert.strictEqual(letzte.type, 'user');
      assert.ok(letzte.message.content.includes(r.datei), 'Auftrag nennt die Datei nicht');
      assert.ok(x.db.prepare("SELECT 1 FROM sitzung_ereignis WHERE session_id = ? AND art = 'eingabe' AND titel LIKE '%Übergabe%'").get(id), 'Auftrag nicht im Verlauf');
      // Rechte-Anfrage mit langem Pfad (Probe 19.10.: Titel 201 Zeichen, Freigabe erlaubt 200 -> nie angelegt).
      k.sag({ type: 'control_request', request_id: 'lang', request: { subtype: 'can_use_tool', tool_name: 'Write', input: { file_path: 'C:/' + 'x'.repeat(300) + '/HANDOFF.md', content: 'x' } } });
      await warte(); await warte();
      const f = x.db.prepare("SELECT titel FROM freigabe WHERE art = 'sitzung_frage' AND bezug = ?").get(id);
      assert.ok(f && f.titel.length <= 200, 'Rechte-Anfrage mit langem Pfad nicht als Freigabe angelegt');
      k.ende(0); await warte();
      assert.throws(() => x.d.uebergabe(id), (e) => e.status === 409 && /Übergabe nur in einer laufenden Sitzung/.test(e.message), 'Uebergabe in beendeter Sitzung');
    } finally { x.zu(); }
  }

  /* ---------- Zum Terminal ---------- */
  async function terminal() {
    const x = dienst();
    try {
      const { id, k } = await laufend(x);
      // Laeuft noch in c2invoice: ein zweiter Prozess auf derselben Sitzung kollidierte.
      assert.strictEqual(status(() => x.d.terminal(id)), 409);
      k.ende(0); await warte();
      assert.strictEqual((await x.d.terminal(id)).pfad, ordner);
      const t = x.terminals[0];
      assert.strictEqual(t.exe, 'wt');
      assert.deepStrictEqual(t.args, ['-d', ordner, 'C:/claude.exe', '--resume', id], 'Platzhalter falsch ersetzt (claude.exe statt npm-Shim)');
      assert.ok(!t.opt.shell, 'mit Shell gestartet');
      // Fremde Sitzung: Ordner aus dem Ledger; fehlt der Ordner, 409.
      const fremd = '66666666-2222-4333-8444-555555555555';
      x.db.prepare("INSERT INTO events (request_id, ts, session_id, project, cwd, model, cost_usd, day) VALUES ('f1', '2026-10-19T10:00:00Z', ?, 'P', ?, 'claude-opus-5', 0.1, '2026-10-19')").run(fremd, ordner);
      await x.d.terminal(fremd);
      assert.deepStrictEqual(x.terminals[1].args, ['-d', ordner, 'C:/claude.exe', '--resume', fremd]);
      const weg = '77777777-2222-4333-8444-555555555555';
      x.db.prepare("INSERT INTO events (request_id, ts, session_id, project, cwd, model, cost_usd, day) VALUES ('f2', '2026-10-19T10:00:00Z', ?, 'P', ?, 'claude-opus-5', 0.1, '2026-10-19')").run(weg, path.join(tmp, 'fehlt'));
      assert.strictEqual(status(() => x.d.terminal(weg)), 409);
      assert.strictEqual(status(() => x.d.terminal('x; calc')), 404);
      // wt liest ";" als Subcommand-Trenner, auch in Anfuehrungszeichen (Security-Review C6a):
      // ein Ordner "a; new-tab cmd /c calc" aus dem Ledger darf nie in die Kommandozeile.
      const boese = path.join(tmp, 'a; new-tab cmd');
      fs.mkdirSync(boese, { recursive: true });
      const sb = '88888888-2222-4333-8444-555555555555';
      x.db.prepare("INSERT INTO events (request_id, ts, session_id, project, cwd, model, cost_usd, day) VALUES ('f3', '2026-10-19T10:00:00Z', ?, 'P', ?, 'claude-opus-5', 0.1, '2026-10-19')").run(sb, boese);
      assert.strictEqual(status(() => x.d.terminal(sb)), 409, 'Pfad mit ; an wt gegeben');
      assert.strictEqual(x.terminals.length, 2, 'abgewiesener Aufruf hat einen Prozess gestartet');
      // Ohne Befehl: klare Meldung statt Start.
      const fremdIn = (db) => db.prepare("INSERT INTO events (request_id, ts, session_id, project, cwd, model, cost_usd, day) VALUES ('f1', '2026-10-19T10:00:00Z', ?, 'P', ?, 'claude-opus-5', 0.1, '2026-10-19')").run(fremd, ordner);
      const y = dienst({ terminalBefehl: () => '' });
      try { fremdIn(y.db); assert.strictEqual(status(() => y.d.terminal(fremd)), 409); } finally { y.zu(); }
      // Falscher Befehl: Fehler statt "Terminal offen".
      const z = dienst({ terminalBefehl: () => 'gibtsnicht {pfad}' });
      try { fremdIn(z.db); assert.strictEqual(await statusAsync(z.d.terminal(fremd)), 500, 'falscher Befehl als Erfolg gemeldet'); } finally { z.zu(); }
      // Laeuft an, endet aber sofort mit Fehlercode: kein Terminal offen.
      const z2 = dienst({ terminalBefehl: () => 'scheitert {pfad}' });
      try { fremdIn(z2.db); assert.strictEqual(await statusAsync(z2.d.terminal(fremd)), 500, 'Exit-Code 1 als Erfolg gemeldet'); } finally { z2.zu(); }
      // Befehl mit Anfuehrungszeichen um ein Argument: bleibt ein Argument.
      assert.deepStrictEqual(sitzungen.befehlArgumente('a "b {pfad} c" {sitzung}', { pfad: 'X Y', sitzung: 'S' }), ['a', 'b X Y c', 'S']);
      // Auch ohne Anfuehrungszeichen: erst zerlegen, dann einsetzen.
      assert.deepStrictEqual(sitzungen.befehlArgumente('open -a Terminal {pfad}', { pfad: 'C:/a b' }), ['open', '-a', 'Terminal', 'C:/a b']);
    } finally { x.zu(); }
  }

  /* ---------- Details: Diff fuer edit-Ereignisse, Titel und Nummer ---------- */
  async function details() {
    const x = dienst();
    try {
      const { id } = await laufend(x);
      const d = x.d.details(id);
      const e = d.ereignisse.find((z) => z.art === 'edit');
      assert.deepStrictEqual(e.diff, [{ z: '-', t: 'alt eins' }, { z: '-', t: 'alt zwei' }, { z: '+', t: 'neu eins' }]);
      assert.ok(d.ereignisse.filter((z) => z.art !== 'edit').every((z) => z.diff === undefined), 'Diff an anderen Ereignissen');
      // Beim Speichern gekuerzte Eingabe: Hinweis statt stillem Fehlen.
      assert.deepStrictEqual(sitzungen.diffAus(JSON.stringify({ gekuerzt: true, anfang: '{' })), [{ z: '~', t: 'Eingabe zu groß, Diff ausgelassen' }]);
      // Begrenzt: hoechstens 12 Zeilen, je 200 Zeichen.
      const k = x.kinder[0];
      k.sag({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'Write', input: { file_path: 'gross.txt', content: Array.from({ length: 50 }, (_, i) => 'z' + i + 'x'.repeat(300)).join('\n') } }] } });
      await warte(); await warte();
      const g = x.d.details(id).ereignisse.filter((z) => z.art === 'edit').pop();
      assert.strictEqual(g.diff.length, 12);
      assert.ok(g.diff.every((z) => z.z === '+' && z.t.length <= 200), 'Diff nicht begrenzt');
      // Liste: Titel aus dem Auftrag, Nummer fortlaufend.
      await laufend(x, '', 'Zweiter Auftrag');
      const l = x.d.liste().sitzungen.filter((s) => s.quelle === 'c2invoice');
      assert.deepStrictEqual(l.map((s) => s.titel).sort(), ['Baue den Checkout um', 'Zweiter Auftrag']);
      assert.ok(l.every((s) => Number.isInteger(s.nr) && s.nr > 0) && new Set(l.map((s) => s.nr)).size === 2, 'Nummern fehlen');
    } finally { x.zu(); }
  }

  /* ---------- Routen: Aktionen nur aus der Oberflaeche ---------- */
  async function routen() {
    const http = require('node:http');
    const x = dienst();
    const sendJson = (res, o, st = 200) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const leseKoerper = (req, fertig) => { let r = ''; req.on('data', (c) => { r += c; }); req.on('end', () => fertig(null, JSON.parse(r || '{}'))); };
    const s = http.createServer((req, res) => { const u = new URL(req.url, 'http://127.0.0.1'); if (!x.d.routen(req, res, u.pathname, u, { sendJson, leseKoerper })) sendJson(res, { error: 'nicht hier' }, 404); });
    await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
    const basis = 'http://127.0.0.1:' + s.address().port;
    try {
      const { id } = await laufend(x);
      for (const a of ['zusammenfassung', 'uebergabe', 'terminal']) {
        assert.strictEqual((await fetch(basis + '/api/sitzung/' + id + '/' + a, { method: 'POST', body: '{}' })).status, 403, a + ' ohne Herkunft');
      }
      const r = await fetch(basis + '/api/sitzung/' + id + '/zusammenfassung', { method: 'POST', body: '{}', headers: { 'sec-fetch-site': 'same-origin' } });
      assert.strictEqual(r.status, 200, await r.clone().text());
      assert.strictEqual((await r.json()).vorgang, 'ABC-1');
      const t = await fetch(basis + '/api/sitzung/' + id + '/terminal', { method: 'POST', body: '{}', headers: { 'sec-fetch-site': 'same-origin' } });
      assert.strictEqual(t.status, 409, 'Terminal fuer laufende Sitzung');
      // Programmfehler (TypeError) ist 500, nicht wie eine falsche Eingabe 400.
      x.setzeAntwort(null);
      const orig = console.error; console.error = () => {};
      try {
        const p = await fetch(basis + '/api/sitzung/' + id + '/zusammenfassung', { method: 'POST', body: '{}', headers: { 'sec-fetch-site': 'same-origin' } });
        assert.strictEqual(p.status, 503, 'leere Modellantwort');
        x.setzeAntwort('wirf');
        const q = await fetch(basis + '/api/sitzung/' + id + '/zusammenfassung', { method: 'POST', body: '{}', headers: { 'sec-fetch-site': 'same-origin' } });
        assert.strictEqual(q.status, 500, 'Programmfehler als Eingabefehler gemeldet');
      } finally { console.error = orig; }
      // Eingabefehler bleibt 400.
      assert.strictEqual((await fetch(basis + '/api/sitzung', { method: 'POST', body: JSON.stringify({ arbeitsbereich: 'Proj', prompt: '' }), headers: { 'sec-fetch-site': 'same-origin' } })).status, 400, 'Eingabefehler nicht 400');
    } finally { await new Promise((ok) => { s.closeAllConnections(); s.close(ok); }); x.zu(); }
  }

  /* ---------- Oberflaeche: Terminal und Karten aus denselben Ereignissen ---------- */
  function ansichten() {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ctx = { EN: {}, window: { addEventListener() {} }, registriere() {}, aktion() {}, usd: (v) => v + ' USD', uebersetze: (s) => s, esc, setInterval: () => 0, console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(W, 'public/app/sitzungen.js'), 'utf8'), ctx);
    const ev = [
      { id: 1, art: 'eingabe', titel: 'Baue um' },
      { id: 2, art: 'say', titel: 'Ich lese zuerst.' },
      { id: 3, art: 'read', titel: 'Read: a.ts', meta: 'Read' },
      { id: 4, art: 'edit', titel: 'Edit: b.ts', meta: 'Edit', kosten_usd: null, diff: [{ z: '-', t: 'x' }, { z: '+', t: 'y' }] },
      { id: 5, art: 'mcp', titel: 'mcp__github__get', meta: 'mcp__github__get' },
      { id: 6, art: 'rechte', titel: 'Claude möchte Bash: ls', meta: 'Bash' },
      { id: 7, art: 'zug', titel: 'Zug fertig', kosten_usd: 0.12 },
    ];
    // JSON: Arrays aus dem vm-Kontext haben einen fremden Prototyp (deepStrictEqual).
    const hier = (v) => JSON.parse(JSON.stringify(v));
    const zeilen = hier(ctx.szTerminalZeilen(ev));
    // Wartet die Sitzung, ist die letzte Rechte-Anfrage die offene.
    const karten = hier(ctx.szKarten(ev, { wartet: true }));
    assert.ok(!ctx.szKarten(ev, { wartet: false }).some((k) => k.wartet), 'Karte wartet, obwohl die Sitzung nicht wartet');
    // Jedes Ereignis erscheint im Terminal; Karten nur fuer Werkzeuge, Claude-Text und Rueckfragen.
    for (const e of ev) assert.ok(zeilen.some((z) => z.ev === e.id), 'Terminal ohne Ereignis ' + e.art);
    // Owner 20.10.: Karten zeigen dasselbe wie das Terminal (auch die Eingaben), nur den Zug-Abschluss nicht.
    assert.deepStrictEqual(karten.map((k) => k.ev), [1, 2, 3, 4, 5, 6]);
    assert.ok(zeilen.find((z) => z.ev === 1).t.startsWith('›'), 'Eingabe ohne Prompt-Zeichen');
    assert.deepStrictEqual(zeilen.filter((z) => z.ev === 4 && z.diff).map((z) => z.diff), ['-', '+'], 'Diff fehlt im Terminal');
    assert.deepStrictEqual(karten.find((k) => k.ev === 4).diff.map((d) => d.z), ['-', '+'], 'Diff fehlt in der Karte');
    assert.deepStrictEqual(karten.filter((k) => k.wartet).map((k) => k.ev), [6], 'nicht genau die letzte Rechte-Anfrage wartet');
    // Werkzeugnamen ohne den Praefix "Read: " im Kartentitel.
    assert.strictEqual(karten.find((k) => k.ev === 3).t, 'a.ts');

    // Terminal wie Claude Code (20.10.): voller Text, Werkzeugfolgen gruppiert, Edit als Update(datei).
    const lang = 'x'.repeat(300);
    const ev2 = [
      { id: 1, art: 'eingabe', titel: 'kurz…', text: 'Frage ' + lang },
      { id: 2, art: 'say', titel: 'kurz…', text: '**Fertig.** ' + lang },
      { id: 3, art: 'bash', titel: 'Bash: ls', meta: 'Bash' },
      { id: 4, art: 'bash', titel: 'Bash: pwd', meta: 'Bash' },
      { id: 5, art: 'read', titel: 'Grep: x', meta: 'Grep' },
      { id: 6, art: 'edit', titel: 'Edit: b.ts', meta: 'Edit', diff: [{ z: '-', t: 'x' }] },
      { id: 7, art: 'mcp', titel: 'mcp__github__get', meta: 'mcp__github__get' },
    ];
    const z2 = hier(ctx.szTerminalZeilen(ev2));
    assert.strictEqual(z2.find((z) => z.ev === 1).t, '› Frage ' + lang, 'Eingabe gekuerzt');
    assert.ok(z2.find((z) => z.ev === 2).md && z2.find((z) => z.ev === 2).t === '**Fertig.** ' + lang, 'Antwort gekuerzt oder ohne Markdown');
    const gruppen = z2.filter((z) => z.k === 'gruppe');
    assert.deepStrictEqual(gruppen.map((g) => g.t), ['Bash ×2 · Lesen ×1', 'MCP ×1'], 'Werkzeugfolgen nicht gruppiert');
    assert.deepStrictEqual(z2.filter((z) => z.g === gruppen[0].g && z.k === 'tool').map((z) => z.ev), [3, 4, 5]);
    assert.strictEqual(z2.find((z) => z.ev === 6 && z.k === 'tool').t, '● Update(b.ts)');
    // Karten: dieselben Texte voll, Antwort als Markdown.
    const k2 = hier(ctx.szKarten(ev2));
    assert.strictEqual(k2.find((k) => k.ev === 1).t, 'Frage ' + lang, 'Eingabe fehlt oder gekuerzt in den Karten');
    assert.ok(k2.find((k) => k.ev === 2).md && k2.find((k) => k.ev === 2).t === '**Fertig.** ' + lang, 'Antwort gekuerzt in den Karten');
    // !-Befehle aus Claude Code: Tags weg, wie im Terminal "! befehl" und die Ausgabe.
    const bash = [{ id: 1, art: 'eingabe', titel: 'x', text: '<bash-input>node a.js</bash-input>' }, { id: 2, art: 'eingabe', titel: 'y', text: '<bash-stdout>fertig\nzwei</bash-stdout><bash-stderr></bash-stderr>' }];
    assert.deepStrictEqual(hier(ctx.szTerminalZeilen(bash)).map((z) => z.t), ['› ! node a.js', '⎿ fertig\nzwei']);
    assert.deepStrictEqual(hier(ctx.szKarten(bash)).map((k) => k.t), ['! node a.js', 'fertig\nzwei']);
    // Arbeitszeile wie in Claude Code (Owner 20.10.): nur waehrend Claude arbeitet.
    ctx.kurz = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : String(n));
    const seit = new Date(Date.now() - 75000).toISOString();
    const zl = ctx.szZugHtml({ status: 'laeuft', zug: { seit, tokens: 1234 } });
    assert.ok(/id="sz-zug"/.test(zl) && zl.includes('1,2k') && zl.includes('1 min 15 s') && zl.includes('data-seit="' + seit + '"'), zl);
    assert.strictEqual(ctx.szZugHtml({ status: 'bereit', zug: null }), '', 'Arbeitszeile ohne laufenden Zug');
    assert.strictEqual(ctx.szZugHtml({ status: 'wartet', zug: { seit, tokens: 1 } }), '', 'Arbeitszeile waehrend Rueckfrage');
    assert.strictEqual(ctx.szDauer(9), '9 s');
    assert.strictEqual(ctx.szDauer(3725), '62 min 05 s');
    // Slash-Vorschlaege aus der Befehlsliste der Sitzung (Owner 20.10.).
    const befehle = [{ name: 'clear', text: 'Verlauf leeren' }, { name: 'compact' }, { name: 'context' }, { name: 'plugin-authoring' }, { name: 'caveman:caveman-help' }];
    const vor = (t) => hier(ctx.szVorschlaege(t, befehle));
    assert.deepStrictEqual(vor('/c').liste.map((b) => b.name), ['clear', 'compact', 'context', 'caveman:caveman-help'], 'Praefix zuerst');
    assert.deepStrictEqual(vor('/help').liste.map((b) => b.name), ['caveman:caveman-help'], 'enthaelt-Treffer fehlen');
    assert.ok(vor('/ex').liste.some((b) => b.name === 'exit'), '/exit (c2invoice) fehlt in den Vorschlaegen');
    assert.deepStrictEqual(vor('Hallo /c'), { liste: [], hinweis: null }, 'Vorschlag mitten im Text');
    assert.deepStrictEqual(vor('/clear jetzt').liste, [], 'nach dem Leerzeichen noch Vorschlaege');
    assert.strictEqual(vor('/clear jetzt').hinweis, null);
    assert.strictEqual(vor('/plugin install x').hinweis, '/plugin', 'unbekannter Befehl ohne Hinweis');
    assert.strictEqual(vor('/zzz').hinweis, '/zzz');
    assert.deepStrictEqual(hier(ctx.szVorschlaege('/c', [])), { liste: [], hinweis: null }, 'ohne Befehlsliste (alte Sitzung) Hinweise geraten');
    // Eingefuegter Text (Claude Code markiert ihn mit <pasted_content id="…">): als Zitat, Tags weg.
    const paste = [{ id: 1, art: 'eingabe', titel: 'x', text: 'Deine Antwort "\n\n<pasted_content id="4ad4">\nZeile eins\nZeile zwei\n</pasted_content id="4ad4">\n\n" fehlt' }];
    assert.strictEqual(hier(ctx.szKarten(paste))[0].t, 'Deine Antwort "\n│ Zeile eins\n│ Zeile zwei\n" fehlt');
    // Markdown: HTML bleibt Text, fett/code/Tabelle werden gesetzt.
    const md = ctx.szMd('<img src=x onerror=1> **fett** `code`\n| a | b |\n|---|---|\n| 1 | <i>2</i> |\n```\n<script>\n```');
    assert.ok(!/<img|<script|<i>/.test(md), 'HTML aus der Antwort ausgefuehrt: ' + md);
    assert.ok(md.includes('<b>fett</b>') && md.includes('<code>code</code>') && md.includes('<td>1</td>') && md.includes('<pre class="tz-code">&lt;script&gt;</pre>'), md);
  }

  return [
    ['C6 Zusammenfassung ins Vorgangs-Log: lokales Modell, ohne Modell 503 ohne Zeile, ohne Vorgang 409, neueste zuerst', zusammenfassung],
    ['C6 Uebergabe: fester Auftrag mit Datei unter handoffs/ an die laufende Sitzung, beendet 409', uebergabe],
    ['C6 Zum Terminal: Befehl ohne Shell, Platzhalter je Argument, Ordner muss existieren, laufend 409', terminal],
    ['C6 Details: Diff fuer edit begrenzt, Titel und Nummer in der Liste', details],
    ['C6 Routen der Aktionen nur aus der Oberflaeche', routen],
    ['C6 Terminal- und Kartenansicht aus denselben Ereignissen', ansichten],
  ];
};
