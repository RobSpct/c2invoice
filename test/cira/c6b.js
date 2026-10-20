'use strict';
// Masterplan 3.0, Block C6b (Skill-Ablauf). Owner 19.10.2026: ein Ablauf ist
// eine Sitzung, jeder Schritt die naechste Eingabe darin; Schritte nur per
// Kachel; Ergebnis = letzte Antwort + geschriebene Dateien. Prozess wie in
// C5/C6a als Attrappe.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');

module.exports = ({ dbmod, openDbs }) => {
  const sitzungen = require('../../sitzungen');
  const ablauf = require('../../ablauf');
  const freigaben = require('../../freigaben');
  const cira = require('../../cira');

  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c6b-'));
  const SKILLS = ['plan-mode', 'council-review'];

  function dienst() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const kinder = [];
    const spawnFn = (exe, args) => {
      const k = new EventEmitter();
      k.args = args;
      k.pid = 7000 + kinder.length;
      k.stdin = new PassThrough(); k.stdout = new PassThrough(); k.stderr = new PassThrough();
      k.geschrieben = [];
      k.stdin.on('data', (b) => { for (const z of String(b).split('\n')) if (z.trim()) k.geschrieben.push(JSON.parse(z)); });
      k.sag = (o) => k.stdout.write(JSON.stringify(o) + '\n');
      k.ende = (code = 0) => k.emit('close', code);
      kinder.push(k);
      return k;
    };
    const sz = sitzungen.erzeuge({
      db, exe: () => 'C:/claude.exe', spawnFn, arbeitsbereiche: () => [{ name: 'Proj', pfad: ordner, art: 'projekt' }],
      vormerken: (sid, v) => (v ? v.toUpperCase() : null), beenden: () => {}, stoppWarteMs: 5,
    });
    const ab = ablauf.erzeuge({ db, sitzungen: sz, skills: (name) => { if (name !== 'Proj') throw new Error('Arbeitsbereich unbekannt.'); return SKILLS; } });
    return { db, sz, ab, kinder, zu: () => { ab.schliesse(); sz.schliesse(); } };
  }
  const warte = () => new Promise((ok) => setImmediate(ok));
  const INIT = { type: 'system', subtype: 'init', model: 'claude-haiku', permissionMode: 'default', tools: [], mcp_servers: [], plugins: [], agents: [], skills: SKILLS };
  // Ein Zug: Antwort, optional eine geschriebene Datei, Ergebnis mit kumulierten Kosten.
  async function zug(k, { text = 'Plan steht.', datei = null, kosten = 0.4, init = false } = {}) {
    if (init) k.sag(INIT);
    const inhalt = [{ type: 'text', text }];
    if (datei) inhalt.push({ type: 'tool_use', id: 't' + Math.random(), name: 'Write', input: { file_path: datei, content: 'x' } });
    k.sag({ type: 'assistant', message: { content: inhalt } });
    k.sag({ type: 'result', subtype: 'success', total_cost_usd: kosten, num_turns: 1 });
    await warte(); await warte();
  }
  const eingaben = (k) => k.geschrieben.filter((m) => m.type === 'user').map((m) => m.message.content);
  const offeneFreigaben = (db) => db.prepare("SELECT * FROM freigabe WHERE art = 'ablauf' AND status = 'offen'").all();
  const log = (db) => db.prepare('SELECT * FROM vorgang_log ORDER BY id').all();
  const status = async (fn) => { try { await fn(); } catch (e) { return e.status || 400; } return 200; };
  // Ein laufender Ablauf, Schritt 1 wartet.
  async function wartend(x, d = {}) {
    const a = x.ab.starte({ arbeitsbereich: 'Proj', befehl: '/plan-mode', vorgang: 'abc-1', ziel: 'Validator planen', ...d });
    const k = x.kinder[x.kinder.length - 1];
    await zug(k, { init: true, text: 'Erste Zeile\nZweite Zeile', datei: 'PLAN.md', kosten: 0.4 });
    return { id: a.id, k };
  }

  return [
    ['C6b Start nur mit bekanntem Skill und Arbeitsbereich, Schritt 1 geht als Slash-Befehl in die Sitzung', async () => {
      const x = dienst();
      try {
        assert.strictEqual(await status(() => x.ab.starte({ arbeitsbereich: 'Proj', befehl: 'gibtsnicht' })), 400);
        assert.strictEqual(await status(() => x.ab.starte({ arbeitsbereich: 'Fremd', befehl: 'plan-mode' })), 400);
        assert.strictEqual(await status(() => x.ab.starte({ arbeitsbereich: 'Proj', befehl: '../x' })), 400);
        assert.strictEqual(await status(() => x.ab.starte({ arbeitsbereich: 'Proj', befehl: '.versteckt' })), 400);
        assert.strictEqual(x.kinder.length, 0, 'Prozess trotz Fehler gestartet');
        const a = x.ab.starte({ arbeitsbereich: 'Proj', befehl: '/plan-mode', vorgang: 'abc-1', ziel: 'Validator\u0007 planen' });
        assert.strictEqual(a.status, 'run');
        assert.strictEqual(a.vorgang, 'ABC-1');
        assert.deepStrictEqual(eingaben(x.kinder[0]), ['/plan-mode Validator  planen']);
        assert.strictEqual(x.db.prepare('SELECT COUNT(*) AS n FROM ablauf').get().n, 1);
        assert.ok(!x.kinder[0].args.includes('--permission-mode'), 'ohne Wahl gelten die Claude-Settings');
        // Rechte-Modus aus dem Entwurf ("Immer fragen" = manual) geht an die Sitzung, Unbekanntes nicht.
        assert.strictEqual(await status(() => x.ab.starte({ arbeitsbereich: 'Proj', befehl: 'plan-mode', modus: 'bypassPermissions' })), 400);
        x.ab.starte({ arbeitsbereich: 'Proj', befehl: 'plan-mode', modus: 'manual' });
        const args = x.kinder[x.kinder.length - 1].args;
        assert.strictEqual(args[args.indexOf('--permission-mode') + 1], 'manual');
      } finally { x.zu(); }
    }],

    ['C6b Schritt wartet nach dem Zug, Ergebnis aus Antwort, Dateien und Kosten, genau eine Freigabe', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        const a = x.ab.details(id);
        assert.strictEqual(a.status, 'wait');
        assert.strictEqual(a.schritte[0].status, 'wait');
        const e = a.schritte[0].ergebnis;
        assert.strictEqual(e.antwort, 'Erste Zeile\nZweite Zeile');
        assert.deepStrictEqual(e.dateien, ['PLAN.md']);
        assert.strictEqual(e.kosten_usd, 0.4);
        const f = offeneFreigaben(x.db);
        assert.strictEqual(f.length, 1);
        assert.strictEqual(f[0].bezug, 'ABC-1');
        assert.deepStrictEqual(JSON.parse(f[0].nutzlast_json), { ablauf: id, schritt: 0 });
        // Ein zweites "bereit" (z. B. Eingabe aus der Sitzungsansicht) legt keine zweite Karte an.
        await zug(k, { text: 'Nebenbei', kosten: 0.5 });
        assert.strictEqual(offeneFreigaben(x.db).length, 1);
      } finally { x.zu(); }
    }],

    ['C6b Freigeben mit Hinweis startet den angehaengten Schritt, Ergebnis nur aus dem eigenen Schritt', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        assert.strictEqual(await status(() => x.ab.anhaengen(id, { befehl: 'gibtsnicht' })), 400);
        x.ab.anhaengen(id, { befehl: 'council-review' });
        assert.strictEqual(x.ab.details(id).schritte[1].status, 'idle');
        const fid = offeneFreigaben(x.db)[0].id;
        const r = await x.ab.weiter(id, { hinweis: 'Kostenstelle beachten' });
        assert.strictEqual(r.status, 'run');
        assert.strictEqual(eingaben(k).pop(), '/council-review\n\nHinweis: Kostenstelle beachten');
        assert.strictEqual(x.db.prepare('SELECT status FROM freigabe WHERE id = ?').get(fid).status, 'erledigt');
        let a = x.ab.details(id);
        assert.deepStrictEqual(a.schritte.map((s) => s.status), ['done', 'run']);
        assert.strictEqual(a.hinweise.length, 1);
        await zug(k, { text: 'Review fertig', kosten: 0.75 });
        a = x.ab.details(id);
        assert.strictEqual(a.status, 'wait');
        assert.strictEqual(a.schritt, 1);
        assert.deepStrictEqual(a.schritte[1].ergebnis.dateien, [], 'Datei aus Schritt 1 im Ergebnis von Schritt 2');
        assert.strictEqual(a.schritte[1].ergebnis.kosten_usd, 0.35);
        assert.strictEqual(a.schritte[1].ergebnis.antwort, 'Review fertig');
        // Hoechstens 10 Schritte je Ablauf.
        for (let i = 2; i < 10; i++) x.ab.anhaengen(id, { befehl: 'plan-mode' });
        assert.strictEqual(await status(() => x.ab.anhaengen(id, { befehl: 'plan-mode' })), 409);
        // Schritt 1 behaelt sein Ergebnis.
        assert.deepStrictEqual(a.schritte[0].ergebnis.dateien, ['PLAN.md']);
      } finally { x.zu(); }
    }],

    ['C6b Freigeben ohne naechsten Schritt schliesst ab, ein Hinweis geht als Eingabe in die Sitzung', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        const vorher = eingaben(k).length;
        assert.strictEqual((await x.ab.weiter(id, {})).status, 'done');
        assert.strictEqual(eingaben(k).length, vorher, 'Eingabe ohne Hinweis');
        assert.strictEqual(x.sz.laufend.has(x.ab.details(id).sitzung), true, 'Sitzung beendet');
        const y = await wartend(x);
        assert.strictEqual((await x.ab.weiter(y.id, { hinweis: 'Dann umsetzen' })).status, 'done');
        // Mit Vorsatz: ein Hinweis "/x" startet keinen ungeprueften Befehl.
        assert.strictEqual(eingaben(y.k).pop(), 'Hinweis: Dann umsetzen');
        assert.strictEqual(await status(() => x.ab.weiter(y.id, {})), 409);
      } finally { x.zu(); }
    }],

    ['C6b Neu bauen schickt denselben Befehl mit Hinweis, zieht die Karte zurueck und stoppt nicht', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        assert.strictEqual(await status(() => x.ab.neu(id, { hinweis: '  ' })), 400);
        const fid = offeneFreigaben(x.db)[0].id;
        assert.strictEqual(x.ab.neu(id, { hinweis: 'Kleiner schneiden' }).status, 'run');
        assert.strictEqual(eingaben(k).pop(), '/plan-mode Validator planen\n\nÜberarbeite das Ergebnis mit diesem Hinweis: Kleiner schneiden');
        const f = x.db.prepare('SELECT status, hinweis FROM freigabe WHERE id = ?').get(fid);
        assert.strictEqual(f.status, 'abgelehnt');
        assert.strictEqual(x.ab.details(id).status, 'run', 'Zurueckgezogene Karte hat gestoppt');
        assert.strictEqual(log(x.db).length, 0);
        await zug(k, { text: 'Neuer Plan', kosten: 0.6 });
        const a = x.ab.details(id);
        assert.strictEqual(a.status, 'wait');
        assert.strictEqual(a.schritte[0].ergebnis.antwort, 'Neuer Plan');
        assert.strictEqual(offeneFreigaben(x.db).length, 1);
        assert.notStrictEqual(offeneFreigaben(x.db)[0].id, fid);
      } finally { x.zu(); }
    }],

    ['C6b Stopp mit Grund schreibt genau eine Zeile ins Vorgangs-Log und beendet die Sitzung', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        assert.strictEqual(await status(() => x.ab.stopp(id, {})), 400);
        const fid = offeneFreigaben(x.db)[0].id;
        assert.strictEqual(x.ab.stopp(id, { grund: 'Zu teuer' }).status, 'stopped');
        const l = log(x.db);
        assert.strictEqual(l.length, 1);
        assert.strictEqual(l[0].vorgang, 'ABC-1');
        assert.strictEqual(l[0].quelle, 'ablauf:' + id);
        assert.match(l[0].text, /Schritt 1 \(\/plan-mode\): Zu teuer$/);
        assert.ok(k.geschrieben.some((m) => m.type === 'control_request' && m.request.subtype === 'interrupt'), 'Sitzung nicht gestoppt');
        assert.strictEqual(x.db.prepare('SELECT status FROM freigabe WHERE id = ?').get(fid).status, 'abgelehnt');
        const a = x.ab.details(id);
        assert.strictEqual(a.stop_grund, 'Zu teuer');
        assert.strictEqual(a.schritte[0].status, 'stopped');
        assert.strictEqual(await status(() => x.ab.stopp(id, { grund: 'nochmal' })), 409);
        k.ende(0); await warte();
        assert.strictEqual(log(x.db).length, 1, 'Sitzungsende schrieb ein zweites Mal');
      } finally { x.zu(); }
    }],

    ['C6b Stopp bei kaputtem Vorgangs-Log zieht trotzdem Karte und Sitzung zurueck und meldet den Fehler', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        x.db.exec("CREATE TRIGGER log_kaputt BEFORE INSERT ON vorgang_log BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
        assert.strictEqual(await status(() => x.ab.stopp(id, { grund: 'Test' })), 500);
        assert.strictEqual(x.ab.details(id).status, 'stopped');
        assert.strictEqual(offeneFreigaben(x.db).length, 0, 'Karte blieb offen');
        assert.ok(k.geschrieben.some((m) => m.type === 'control_request' && m.request.subtype === 'interrupt'), 'Sitzung lief weiter');
      } finally { x.zu(); }
    }],

    ['C6b Freigeben geht auch, wenn die Karte verwaist oder schon abgelehnt ist', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        const fid = offeneFreigaben(x.db)[0].id;
        // Karte abgelehnt, ohne dass der Ablauf es mitbekam (z. B. Hoerer scheiterte).
        x.db.prepare("UPDATE freigabe SET status = 'abgelehnt' WHERE id = ?").run(fid);
        assert.strictEqual((await x.ab.weiter(id, { hinweis: 'los' })).status, 'done');
        assert.strictEqual(eingaben(k).pop(), 'Hinweis: los');
        // Laeuft die Freigabe gerade (Doppelklick), bleibt es bei 409.
        const y = await wartend(x);
        x.db.prepare("UPDATE freigabe SET status = 'laeuft' WHERE id = ?").run(offeneFreigaben(x.db)[0].id);
        assert.strictEqual(await status(() => x.ab.weiter(y.id, {})), 409);
      } finally { x.zu(); }
    }],

    ['C6b Stopp aus einem laufenden Schritt: spaetere Antworten gehoeren nicht mehr zum Schritt', async () => {
      const x = dienst();
      try {
        const a = x.ab.starte({ arbeitsbereich: 'Proj', befehl: 'plan-mode', vorgang: 'abc-2' });
        const k = x.kinder[0];
        k.sag(INIT); await warte();
        x.ab.stopp(a.id, { grund: 'Doch nicht' });
        await zug(k, { text: 'Spaete Antwort', datei: 'SPAET.md' });
        const e = x.ab.details(a.id).schritte[0].ergebnis;
        assert.strictEqual(e.antwort, null);
        assert.deepStrictEqual(e.dateien, []);
        assert.strictEqual(x.ab.details(a.id).status, 'stopped');
      } finally { x.zu(); }
    }],

    ['C6b Ablehnen in Braucht dich stoppt mit dem Hinweis als Grund', async () => {
      const x = dienst();
      try {
        const { id } = await wartend(x);
        const fid = offeneFreigaben(x.db)[0].id;
        await freigaben.entscheide(x.db, fid, { wahl: 'ablehnen', hinweis: 'Mache ich selbst' });
        const a = x.ab.details(id);
        assert.strictEqual(a.status, 'stopped');
        assert.strictEqual(a.stop_grund, 'Mache ich selbst');
        assert.strictEqual(log(x.db).length, 1);
        // Freigeben ueber die Karte = weiter.
        const y = await wartend(x);
        await freigaben.entscheide(x.db, offeneFreigaben(x.db)[0].id, { wahl: 'ok' });
        assert.strictEqual(x.ab.details(y.id).status, 'done');
      } finally { x.zu(); }
    }],

    ['C6b Sitzungsende waehrend des Laufs stoppt mit Grund, ohne Vorgang kein Log', async () => {
      const x = dienst();
      try {
        const a = x.ab.starte({ arbeitsbereich: 'Proj', befehl: 'plan-mode' });
        const k = x.kinder[0];
        k.sag(INIT); await warte();
        k.ende(1); await warte();
        const d = x.ab.details(a.id);
        assert.strictEqual(d.status, 'stopped');
        assert.match(d.stop_grund, /Sitzung/);
        assert.strictEqual(log(x.db).length, 0);
        const y = await wartend(x);
        y.k.ende(1); await warte();
        assert.strictEqual(x.ab.details(y.id).status, 'stopped');
        assert.strictEqual(log(x.db).length, 1);
        assert.strictEqual(offeneFreigaben(x.db).length, 0, 'Karte bleibt nach Sitzungsende offen');
      } finally { x.zu(); }
    }],

    ['C6b Neustart stoppt offene Ablaeufe und zieht ihre Karten zurueck', async () => {
      const x = dienst();
      try {
        const { id } = await wartend(x);
        x.sz.laufend.clear();
        assert.strictEqual(x.ab.aufraeumen(), 1);
        const a = x.ab.details(id);
        assert.strictEqual(a.status, 'stopped');
        assert.strictEqual(a.stop_grund, 'Server wurde neu gestartet.');
        assert.strictEqual(offeneFreigaben(x.db).length, 0);
        assert.strictEqual(x.ab.aufraeumen(), 0);
      } finally { x.zu(); }
    }],

    ['C6b Doppelklick auf Freigeben fuehrt den naechsten Schritt nur einmal aus', async () => {
      const x = dienst();
      try {
        const { id, k } = await wartend(x);
        x.ab.anhaengen(id, { befehl: 'council-review' });
        const vorher = eingaben(k).length;
        const r = await Promise.allSettled([x.ab.weiter(id, {}), x.ab.weiter(id, {})]);
        assert.strictEqual(r.filter((z) => z.status === 'fulfilled').length, 1);
        assert.strictEqual(r.find((z) => z.status === 'rejected').reason.status, 409);
        assert.strictEqual(eingaben(k).length, vorher + 1);
      } finally { x.zu(); }
    }],

    ['C6b Routen nur aus der eigenen Seite, Liste der offenen Ablaeufe', async () => {
      const x = dienst();
      try {
        const antworten = [];
        const sendJson = (res, d, s = 200) => antworten.push({ s, d });
        const req = { method: 'POST', headers: { host: '127.0.0.1:4747' } };
        assert.strictEqual(x.ab.routen(req, {}, '/api/ablauf', new URL('http://x/api/ablauf'), { sendJson, leseKoerper: () => assert.fail('Koerper gelesen') }), true);
        assert.strictEqual(antworten[0].s, 403);
        await wartend(x);
        x.ab.routen({ method: 'GET', headers: {} }, {}, '/api/ablaeufe', new URL('http://x/api/ablaeufe?offen=1'), { sendJson });
        assert.strictEqual(antworten[1].d.ablaeufe.length, 1);
        x.ab.routen({ method: 'GET', headers: {} }, {}, '/api/ablauf/999', new URL('http://x/api/ablauf/999'), { sendJson });
        assert.strictEqual(antworten[2].s, 404);
      } finally { x.zu(); }
    }],

    ['C6b T0 "starte" bereitet die Szene vor, unbekannter Skill ohne Szene', async () => {
      const t = cira.t0('Starte /plan-mode für shop-14: Validator planen');
      assert.ok(t && t.absicht.name === 'skill');
      const r = t.absicht.tu({ m: t.m, skillOrte: (b) => (b === 'plan-mode' ? ['Shop', 'Global'] : []) });
      assert.deepStrictEqual(r.szene.entwurf, { befehl: 'plan-mode', vorgang: 'SHOP-14', ziel: 'Validator planen', arbeitsbereiche: ['Shop', 'Global'] });
      assert.strictEqual(r.szene.typ, 'skill');
      const t2 = cira.t0('starte debug für ABC-1.');
      assert.strictEqual(t2.absicht.tu({ m: t2.m, skillOrte: () => [] }).szene, undefined);
      assert.strictEqual(t2.m[2].replace(/\.+$/, ''), 'ABC-1');
    }],
  ];
};
