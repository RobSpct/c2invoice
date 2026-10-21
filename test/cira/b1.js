'use strict';
// Block B1 (Owner 21.10.2026): wartende Sitzungen aus dem eigenen Terminal
// erscheinen in „Braucht dich“ als Hinweis-Karte. „Wartet“ heisst nur eine echte
// Anfrage (Rechte, Formular), nicht der Leerlauf-Hinweis 60 s nach jedem Zug.
// Die Karte fuehrt nur zur Sitzung; ein zweiter Prozess per --resume auf eine
// noch offene Sitzung wird abgewiesen.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const W = path.join(__dirname, '..', '..');

module.exports = ({ dbmod, openDbs }) => {
  const sitzungen = require('../../sitzungen');
  const ereignisse = require('../../ereignisse');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-b1-'));
  const ordner = path.join(tmp, 'projekt');
  fs.mkdirSync(ordner, { recursive: true });

  function dienst() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const terminals = [];
    const d = sitzungen.erzeuge({
      db, exe: () => 'C:/claude.exe', arbeitsbereiche: () => [], vormerken: () => null, beenden: () => {},
      terminalBefehl: () => 'wt -d "{pfad}" "{claude}" --resume {sitzung}',
      spawnTerminal: (exe, args) => { terminals.push(args); const k = new EventEmitter(); k.unref = () => {}; setImmediate(() => k.emit('spawn')); return k; },
      terminalWarteMs: 5,
    });
    return { db, d, terminals, zu: () => d.schliesse() };
  }
  const vor = (min) => new Date(Date.now() - min * 60000).toISOString();
  // Fremde Sitzung, wie der Abgleich sie aus der JSONL kennt: Eingabe und letzte Antwort.
  function fremd(db, sid, { eingabeVorMin = 3, letzteVorMin = 3 } = {}) {
    const e = vor(eingabeVorMin);
    db.prepare('INSERT INTO activity (session_id, ts, project, ticket, day, eingabe) VALUES (?,?,?,?,?,1)').run(sid, e, 'Fremd', null, e.slice(0, 10));
    const l = vor(letzteVorMin);
    db.prepare("INSERT INTO events (request_id, ts, session_id, project, cwd, ticket, model, cost_usd, day) VALUES (?, ?, ?, 'Fremd', ?, 'ABC-7', 'claude-opus-5', 0.1, ?)")
      .run(sid + '-' + letzteVorMin, l, sid, ordner, l.slice(0, 10));
  }
  const status = (db, sid) => (db.prepare('SELECT status FROM sitzung WHERE id = ?').get(sid) || {}).status;
  const fragen = (db, sid) => db.prepare("SELECT titel, meta FROM sitzung_ereignis WHERE session_id = ? AND art = 'frage' ORDER BY id").all(sid);
  const eintrag = (d, sid) => d.liste({ offen: true }).sitzungen.find((s) => s.id === sid);
  const code = (fn) => { try { fn(); } catch (e) { return e.status; } return 200; };
  const A = 'b1b1b1b1-2222-4333-8444-555555555555';

  async function typFilter() {
    const { db, d, zu } = dienst();
    const gesendet = [];
    const hoer = (e) => { if (e.art === 'sitzung') gesendet.push(e.daten); };
    ereignisse.bus.on('ereignis', hoer);
    try {
      fremd(db, A);
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' });
      assert.strictEqual(status(db, A), 'wartet', 'permission_prompt nicht wartet');
      assert.deepStrictEqual(fragen(db, A).map((f) => f.meta), ['hook:permission_prompt'], 'Typ fehlt im Ereignis');
      const e = eintrag(d, A);
      assert.ok(e && e.status === 'wartet', 'wartende Sitzung fehlt in der Liste');
      assert.strictEqual(e.frage, 'Claude needs your permission to use Bash', 'Liste ohne Hook-Meldung');
      assert.ok(e.seit && Date.parse(e.seit) > Date.now() - 60000, 'Liste ohne seit');
      assert.ok(gesendet.some((g) => g.id === A && g.status === 'wartet' && g.fremd === true && g.frage === 'Claude needs your permission to use Bash'),
        'SSE ohne fremd/frage — keine Meldung im Browser');
      // Leerlauf-Hinweis waehrend einer offenen Anfrage: die Anfrage bleibt offen.
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude is waiting for your input', notification_type: 'idle_prompt' });
      assert.strictEqual(status(db, A), 'wartet', 'idle_prompt hat eine offene Anfrage ueberschrieben');
      d.hook({ hook_event_name: 'Stop', session_id: A });
      assert.strictEqual(status(db, A), 'bereit');
      const b = eintrag(d, A);
      assert.ok(b && b.status === 'bereit' && b.frage === undefined, 'bereite Sitzung traegt noch eine Frage');
      // Leerlauf nach dem Zug: bereit, keine Frage, kein Ereignis.
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude is waiting for your input', notification_type: 'idle_prompt' });
      assert.strictEqual(status(db, A), 'bereit', 'idle_prompt ist wartet');
      assert.strictEqual(fragen(db, A).length, 1, 'idle_prompt legt eine Frage an');
      for (const typ of ['elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input']) {
        d.hook({ hook_event_name: 'Notification', session_id: A, message: 'x', notification_type: typ });
        assert.strictEqual(status(db, A), 'wartet', typ + ' nicht wartet');
        d.hook({ hook_event_name: 'Stop', session_id: A });
      }
      // Andere Typen aendern nichts.
      for (const typ of ['auth_success', 'agent_completed', 'plugin_notification', 'erfunden']) {
        assert.deepStrictEqual(d.hook({ hook_event_name: 'Notification', session_id: A, message: 'x', notification_type: typ }), { ignoriert: true }, typ + ' nicht ignoriert');
      }
      assert.strictEqual(status(db, A), 'bereit');
      assert.strictEqual(fragen(db, A).length, 4);
    } finally { ereignisse.bus.off('ereignis', hoer); zu(); }
  }

  // Hook-Skript aelterer Fassung ohne notification_type: der Text entscheidet.
  async function ohneTyp() {
    const { db, d, zu } = dienst();
    try {
      fremd(db, A);
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude is waiting for your input' });
      assert.strictEqual(status(db, A), 'bereit', 'Leerlauf ohne Typ ist wartet');
      assert.strictEqual(fragen(db, A).length, 0);
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude needs your permission' });
      assert.strictEqual(status(db, A), 'wartet', 'Rechte-Anfrage ohne Typ nicht wartet');
      assert.strictEqual(fragen(db, A)[0].meta, 'hook');
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude is waiting for your input' });
      assert.strictEqual(status(db, A), 'wartet', 'Leerlauf ohne Typ hat eine offene Anfrage ueberschrieben');
      // Typ kein Text: wie ohne Typ.
      d.hook({ hook_event_name: 'Stop', session_id: A });
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude needs your permission', notification_type: 42 });
      assert.strictEqual(status(db, A), 'wartet');
      assert.strictEqual(fragen(db, A)[1].meta, 'hook', 'Typ ohne Pruefung in meta');
    } finally { zu(); }
  }

  // Eigene c2invoice-Sitzung: der Strom weiss es schon (Freigabe), keine zweite Karte.
  async function eigene() {
    const { db, d, zu } = dienst();
    try {
      db.prepare("INSERT INTO sitzung (id, quelle, status, gestartet, aktualisiert) VALUES (?, 'c2invoice', 'laeuft', ?, ?)").run(A, vor(1), vor(1));
      assert.deepStrictEqual(d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude needs your permission', notification_type: 'permission_prompt' }), { ignoriert: true });
      assert.strictEqual(status(db, A), 'laeuft');
      assert.strictEqual(fragen(db, A).length, 0);
      assert.ok(!d.liste({ offen: true }).sitzungen.some((s) => s.id === A && s.quelle === 'fremd'), 'eigene Sitzung als fremde gelistet');
    } finally { zu(); }
  }

  // Wartet oder laeuft die Sitzung im eigenen Terminal, startet „Im Terminal fortsetzen“
  // keinen zweiten Prozess auf dieselbe Sitzungsdatei.
  async function terminalSchutz() {
    const { db, d, terminals, zu } = dienst();
    try {
      fremd(db, A, { eingabeVorMin: 1, letzteVorMin: 0.5 });
      assert.strictEqual(code(() => d.terminal(A)), 409, 'laufende fremde Sitzung im zweiten Terminal fortgesetzt');
      d.hook({ hook_event_name: 'Notification', session_id: A, message: 'Claude needs your permission', notification_type: 'permission_prompt' });
      let meldung = '';
      try { d.terminal(A); } catch (e) { meldung = e.message; }
      assert.match(meldung, /Terminal/, 'Grund fehlt');
      assert.strictEqual(terminals.length, 0, 'Prozess trotz Abweisung gestartet');
      // Bereit (Stop): wie bisher erlaubt.
      d.hook({ hook_event_name: 'Stop', session_id: A });
      db.prepare('UPDATE sitzung SET aktualisiert = ? WHERE id = ?').run(new Date(Date.now() + 1000).toISOString(), A);
      assert.strictEqual((await d.terminal(A)).pfad, ordner);
      assert.deepStrictEqual(terminals[0].slice(-2), ['--resume', A]);
      // Beendet (SessionEnd): erlaubt.
      const B = 'b2b2b2b2-2222-4333-8444-555555555555';
      fremd(db, B, { eingabeVorMin: 1, letzteVorMin: 0.5 });
      d.hook({ hook_event_name: 'SessionEnd', session_id: B, reason: 'prompt_input_exit' });
      db.prepare('UPDATE sitzung SET aktualisiert = ? WHERE id = ?').run(new Date(Date.now() + 1000).toISOString(), B);
      assert.strictEqual((await d.terminal(B)).pfad, ordner);
    } finally { zu(); }
  }

  // Das Hook-Skript reicht den Typ an c2invoice weiter.
  async function hookSkript() {
    const src = fs.readFileSync(path.join(W, 'integration', 'claude-hook.mjs'), 'utf8');
    const body = (src.match(/body: JSON\.stringify\(\{([^}]*)\}\)/) || [])[1] || '';
    assert.match(body, /notification_type: e\.notification_type \|\| null/, 'Hook-Skript sendet notification_type nicht');
  }

  return [
    ['B1 Hook: nur echte Anfragen sind wartet, Leerlauf bereit, andere Typen ignoriert, Liste mit Frage und seit, SSE mit fremd', typFilter],
    ['B1 Hook ohne notification_type: der Text entscheidet, Leerlauf ueberschreibt keine offene Anfrage', ohneTyp],
    ['B1 Eigene c2invoice-Sitzung: Hook ignoriert, keine Terminal-Karte', eigene],
    ['B1 Im Terminal fortsetzen: wartende oder laufende fremde Sitzung 409, bereit und beendet erlaubt', terminalSchutz],
    ['B1 Hook-Skript sendet notification_type', hookSkript],
  ];
};
