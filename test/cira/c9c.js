'use strict';
// C9c „Merke dir …“ (Plan design/cira/C9-PLAN.md Task 9–10): Entwurf als
// Freigabe vault_notiz, Projekt-Tag nach E12, Claude (T2) nur in einer Kopie von
// memory/ und wiki/, Speichern prueft alle Dateien vor dem ersten Schreiben.
// Der Vault bleibt bis „Freigeben“ byte-gleich.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const FIX = path.join(__dirname, '..', 'fixtures', 'vault');
const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ dbmod, openDbs }) => {
  const gedaechtnis = require('../../gedaechtnis');
  const merken = require('../../merken');
  const freigaben = require('../../freigaben');
  const cira = require('../../cira');

  const kopie = () => {
    const ziel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c9c-')), 'vault');
    fs.cpSync(FIX, ziel, { recursive: true });
    return ziel;
  };
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  // Fingerabdruck aller Dateien des Vaults.
  const abdruck = (v) => {
    const h = crypto.createHash('sha1');
    const geh = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const f = path.join(d, e.name); if (e.isDirectory()) geh(f); else h.update(f + '\0').update(fs.readFileSync(f)); } };
    geh(v);
    return h.digest('hex');
  };
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, w] of Object.entries(werte)) { if (w === undefined) delete cfg[k]; else cfg[k] = JSON.parse(JSON.stringify(w)); }
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  // Claude-Attrappe: tu(cwd) spielt die Aenderungen von Claude in der Kopie.
  function attrappe(tu) {
    const aufrufe = [];
    const spawnFn = (exe, args, opts) => {
      aufrufe.push({ args, cwd: opts.cwd });
      const k = new EventEmitter();
      k.stdout = new EventEmitter(); k.stderr = new EventEmitter();
      k.stdout.setEncoding = () => {}; k.stderr.setEncoding = () => {};
      k.exitCode = null; k.kill = () => {};
      setImmediate(() => {
        tu(opts.cwd);
        k.stdout.emit('data', JSON.stringify({ type: 'result', result: 'Notiz ergänzt.', total_cost_usd: 0.01, usage: { input_tokens: 10, output_tokens: 5 }, session_id: 's-1' }) + '\n');
        k.exitCode = 0;
        k.emit('close', 0);
      });
      return k;
    };
    return { spawnFn, aufrufe };
  }
  const CLAUDE = { cira: { claudeErlaubt: true, claudeMonatslimitEur: 5, claudeModell: 'haiku' } };
  function aufbau({ bereiche = () => [], tu = () => {}, ausText = null } = {}) {
    const v = kopie();
    const db = neueDb();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c9c-tmp-'));
    const g = gedaechtnis.erzeuge({ db, vaultPfad: () => v });
    const a = attrappe(tu);
    const c = cira.erzeuge({ db, bucheVorgang: () => {}, spawnFn: a.spawnFn, claudeExe: 'claude-test.exe' });
    const m = merken.erzeuge({ db, vaultPfad: () => v, gedaechtnis: g, ausText, t2Lauf: c.t2Lauf, bereiche, tmp });
    return { v, db, g, m, a, tmp, c };
  }
  const status = async (fn) => { try { await fn(); } catch (e) { return e.status; } return 200; };
  const offen = (db, id) => db.prepare('SELECT status FROM freigabe WHERE id = ?').get(id).status;

  async function neu() {
    const { v, m } = aufbau({ bereiche: () => [{ name: 'Shop', tag: 'shop' }] });
    const vorher = abdruck(v);
    const r = await m.entwirf({ art: 'neu', satz: 'Die Kasse rundet je Position, nicht auf die Summe.', arbeitsbereich: 'Shop' });
    assert.ok(r.freigabe, r.fehlt);
    const n = r.freigabe.nutzlast;
    assert.strictEqual(r.freigabe.art, 'vault_notiz');
    assert.strictEqual(n.tag, 'shop');
    assert.match(n.text, /\ntags:\n {2}- shop\n/, 'tags nicht auf Spalte 0 mit Projekt-Tag');
    assert.match(n.pfad, /^memory\/project_die_kasse_rundet[a-z0-9_]*\.md$/);
    assert.ok(merken.pruefeNotiz(n.text, { pfad: n.pfad }).ok);
    assert.match(n.text, /\[\[project_shop_kasse\]\]|\[\[kasse-runden\]\]/, 'keine Verwandt-Links');
    assert.deepStrictEqual(n.memory && n.memory.abschnitt, '## Projekt Shop');
    assert.strictEqual(abdruck(v), vorher, 'Vault vor der Freigabe veraendert');
  }

  async function pruefung() {
    const gut = '---\nname: x\ndescription: "y"\ntags:\n  - shop\nmetadata:\n  type: project\n---\n\nText\n';
    assert.ok(merken.pruefeNotiz(gut, { pfad: 'memory/project_x.md' }).ok);
    const verschachtelt = '---\nname: x\ndescription: "y"\nmetadata:\n  type: project\n  tags:\n    - shop\n---\n\nText\n';
    const r = merken.pruefeNotiz(verschachtelt, { pfad: 'memory/project_x.md' });
    assert.strictEqual(r.ok, false, 'nur verschachtelte Tags durchgelassen');
    assert.match(r.grund, /Spalte 0/);
    assert.strictEqual(merken.pruefeNotiz(gut, { pfad: 'memory/Projekt X.md' }).ok, false, 'Dateiname nicht geprueft');
    assert.strictEqual(merken.pruefeNotiz('Text ohne Frontmatter', { pfad: 'wiki/x.md' }).ok, false);
    assert.strictEqual(merken.pruefeNotiz('---\ntags: [a]\n---\nx', { pfad: 'wiki/neu.md' }).ok, false, 'Wiki ohne title');
  }

  async function tagQuelle() {
    const { m } = aufbau();
    const a = await m.entwirf({ art: 'neu', satz: 'Gutscheine gelten zwei Jahre.', tagWort: 'Shop' });
    assert.strictEqual(a.freigabe.nutzlast.tag, 'shop', '„für shop“ nicht gegen Index-Tags erkannt');
    const b = await m.entwirf({ art: 'neu', satz: 'Etwas ganz anderes ohne Tag.' });
    assert.strictEqual(b.freigabe.nutzlast.tag, null);
    assert.ok(b.freigabe.nutzlast.tagWahl.includes('shop') && b.freigabe.nutzlast.tagWahl.includes('cross-projekt'));
    assert.ok(b.freigabe.nutzlast.text.includes(merken.PLATZHALTER));
  }

  async function t2Kopie() {
    // Fall 1: Claude schreibt auch ausserhalb memory/wiki -> verworfen.
    const x = aufbau({ tu: (cwd) => {
      fs.mkdirSync(path.join(cwd, 'Briefings'), { recursive: true });
      fs.writeFileSync(path.join(cwd, 'Briefings', 'x.md'), '# x\n');
      fs.appendFileSync(path.join(cwd, 'wiki', 'kasse-runden.md'), '\nNeu.\n');
    } });
    const vorher = abdruck(x.v);
    await mitConfig(CLAUDE, async () => {
      const r = await x.m.entwirf({ art: 'wiki', satz: 'Rabatte werden vor der Rundung abgezogen.' });
      assert.match(r.fehlt || '', /außerhalb von memory\/ und wiki\/.*Briefings\/x\.md/, 'Schreiben ausserhalb nicht erkannt');
    });
    assert.strictEqual(x.db.prepare('SELECT COUNT(*) AS n FROM freigabe').get().n, 0);
    assert.strictEqual(abdruck(x.v), vorher, 'Vault veraendert');
    const args = x.a.aufrufe[0].args;
    const verbot = args[args.indexOf('--disallowedTools') + 1];
    for (const muster of ['Write(./Briefings/**)', 'Write(./CLAUDE.md)', 'Edit(./raw/**)', 'Write(./index.md)']) assert.ok(verbot.includes(muster), 'Deny fehlt: ' + muster);
    assert.ok(!verbot.includes('Write(./memory'), 'memory gesperrt');
    assert.ok(args.includes('acceptEdits'));
    assert.match(path.basename(x.a.aufrufe[0].cwd), /^c2i-merken-/);
    assert.ok(!fs.existsSync(path.join(x.a.aufrufe[0].cwd, 'CLAUDE.md')), 'Kopie enthaelt CLAUDE.md');
    assert.deepStrictEqual(fs.readdirSync(x.tmp), [], 'Kopie nicht entfernt');
    // Fall 2: nur wiki -> Freigabe mit einer Datei und Vorschau.
    const y = aufbau({ tu: (cwd) => fs.appendFileSync(path.join(cwd, 'wiki', 'kasse-runden.md'), '\nRabatte vor der Rundung.\n') });
    await mitConfig(CLAUDE, async () => {
      const r = await y.m.entwirf({ art: 'ergaenze', ziel: 'kasse-runden', satz: 'Rabatte vor der Rundung.' });
      assert.ok(r.freigabe, r.fehlt);
      assert.deepStrictEqual(r.freigabe.nutzlast.dateien.map((d) => d.pfad), ['wiki/kasse-runden.md']);
      assert.match(r.freigabe.nutzlast.vorschau, /\+ Rabatte vor der Rundung\./);
      assert.match(y.a.aufrufe[0].args[y.a.aufrufe[0].args.length - 1], /wiki\/kasse-runden\.md/);
    });
    assert.deepStrictEqual(fs.readdirSync(y.tmp), []);
    // Fall 3: neue Wiki-Notiz ohne tags -> verworfen.
    const z = aufbau({ tu: (cwd) => fs.writeFileSync(path.join(cwd, 'wiki', 'neu.md'), '---\ntitle: Neu\n---\n\nText\n') });
    await mitConfig(CLAUDE, async () => {
      assert.match((await z.m.entwirf({ art: 'wiki', satz: 'Neue Regel.' })).fehlt || '', /Spalte 0/);
    });
  }

  async function speichernNeu() {
    const { v, db, m } = aufbau({ bereiche: () => [{ name: 'Shop', tag: 'shop' }] });
    const r = await m.entwirf({ art: 'neu', satz: 'Die Kasse rundet je Position.', arbeitsbereich: 'Shop' });
    const memVorher = fs.readFileSync(path.join(v, 'memory', 'MEMORY.md'), 'utf8');
    await freigaben.entscheide(db, r.freigabe.id, { wahl: 'ok' });
    const text = fs.readFileSync(path.join(v, ...r.pfad.split('/')), 'utf8');
    assert.ok(merken.pruefeNotiz(text, { pfad: r.pfad }).ok);
    assert.match(text, /\ntags:\n {2}- shop\n/);
    const mem = fs.readFileSync(path.join(v, 'memory', 'MEMORY.md'), 'utf8').split('\n');
    assert.strictEqual(mem.length, memVorher.split('\n').length + 1, 'nicht genau eine Zeile in MEMORY.md');
    const i = mem.findIndex((z) => z.includes(path.basename(r.pfad)));
    assert.ok(i > mem.indexOf('## Projekt Shop') && i < mem.indexOf('## Cross-Projekt'), 'Zeile im falschen Abschnitt');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM aktion_log WHERE art = 'vault_notiz'").get().n, 1);
    // Zweites Mal dieselbe Datei: 409.
    const zweit = freigaben.anlegen(db, { art: 'vault_notiz', bezug: r.pfad, quelle: 'cira', titel: 'x', nutzlast: r.freigabe.nutzlast });
    assert.strictEqual(await status(() => freigaben.entscheide(db, zweit.id, { wahl: 'ok' })), 409);
  }

  async function tagWahl() {
    const { v, db, m } = aufbau();
    const r = await m.entwirf({ art: 'neu', satz: 'Etwas ohne Tag merken.' });
    assert.strictEqual(await status(() => freigaben.entscheide(db, r.freigabe.id, { wahl: 'ok' })), 409, 'ohne Tag gespeichert');
    assert.strictEqual(await status(() => freigaben.entscheide(db, r.freigabe.id, { wahl: 'ok', hinweis: 'tag:erfunden' })), 409, 'Tag ausserhalb der Auswahl angenommen');
    assert.ok(!fs.existsSync(path.join(v, ...r.pfad.split('/'))));
    await freigaben.entscheide(db, r.freigabe.id, { wahl: 'ok', hinweis: 'tag:cross-projekt' });
    const text = fs.readFileSync(path.join(v, ...r.pfad.split('/')), 'utf8');
    assert.match(text, /\ntags:\n {2}- cross-projekt\n/);
    assert.ok(!text.includes(merken.PLATZHALTER));
  }

  async function fremdaenderung() {
    const { v, db, m } = aufbau({ tu: (cwd) => {
      fs.appendFileSync(path.join(cwd, 'wiki', 'kasse-runden.md'), '\nA.\n');
      fs.appendFileSync(path.join(cwd, 'wiki', 'zahlen-pruefen.md'), '\nB.\n');
    } });
    let r;
    await mitConfig(CLAUDE, async () => { r = await m.entwirf({ art: 'wiki', satz: 'Zwei Ergaenzungen.' }); });
    assert.ok(r.freigabe, r.fehlt);
    const kasse = fs.readFileSync(path.join(v, 'wiki', 'kasse-runden.md'));
    fs.appendFileSync(path.join(v, 'wiki', 'zahlen-pruefen.md'), '\nObsidian war schneller.\n');
    assert.strictEqual(await status(() => freigaben.entscheide(db, r.freigabe.id, { wahl: 'ok' })), 409);
    assert.ok(fs.readFileSync(path.join(v, 'wiki', 'kasse-runden.md')).equals(kasse), 'erste Datei trotz 409 geschrieben');
    assert.strictEqual(offen(db, r.freigabe.id), 'offen');
    assert.ok(!fs.readdirSync(path.join(v, 'wiki')).some((f) => f.endsWith('.c2i-tmp')), 'Temp-Datei liegen geblieben');
  }

  async function ablehnen() {
    const { v, db, m, tmp } = aufbau({ tu: (cwd) => fs.appendFileSync(path.join(cwd, 'wiki', 'kasse-runden.md'), '\nA.\n') });
    const vorher = abdruck(v);
    let r;
    await mitConfig(CLAUDE, async () => { r = await m.entwirf({ art: 'wiki', satz: 'Etwas.' }); });
    await freigaben.entscheide(db, r.freigabe.id, { wahl: 'ablehnen' });
    assert.strictEqual(abdruck(v), vorher);
    assert.deepStrictEqual(fs.readdirSync(tmp), []);
  }

  async function memoryVoll() {
    const { v, db, m } = aufbau({ bereiche: () => [{ name: 'Shop', tag: 'shop' }] });
    const f = path.join(v, 'memory', 'MEMORY.md');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8') + Array.from({ length: 140 }, (_, i) => '- [x' + i + '](x' + i + '.md) — y').join('\n') + '\n');
    const r = await m.entwirf({ art: 'neu', satz: 'Voll ist voll.', arbeitsbereich: 'Shop' });
    assert.strictEqual(r.freigabe.nutzlast.memory, null);
    assert.match(r.freigabe.text, /Grenze 140/);
    const vorher = fs.readFileSync(f);
    await freigaben.entscheide(db, r.freigabe.id, { wahl: 'ok' });
    assert.ok(fs.readFileSync(f).equals(vorher), 'MEMORY.md trotz Grenze ergaenzt');
  }

  async function crlf() {
    const { v, db, m } = aufbau({ tu: (cwd) => fs.appendFileSync(path.join(cwd, 'wiki', 'kasse-runden.md'), '\r\nNeu in CRLF.\r\n') });
    const f = path.join(v, 'wiki', 'kasse-runden.md');
    fs.writeFileSync(f, '﻿' + fs.readFileSync(f, 'utf8').replace(/\n/g, '\r\n'));
    let r;
    await mitConfig(CLAUDE, async () => { r = await m.entwirf({ art: 'ergaenze', ziel: 'Kasse rundet je Position', satz: 'Neu in CRLF.' }); });
    assert.ok(r.freigabe, r.fehlt);
    await freigaben.entscheide(db, r.freigabe.id, { wahl: 'ok' });
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(t.startsWith('﻿'), 'BOM weg');
    assert.ok(t.includes('Neu in CRLF.') && !/[^\r]\n/.test(t), 'nackte LF in einer CRLF-Datei');
  }

  async function absicht() {
    const v = kopie();
    const db = neueDb();
    const g = gedaechtnis.erzeuge({ db, vaultPfad: () => v });
    const m = merken.erzeuge({ db, vaultPfad: () => v, gedaechtnis: g, bereiche: () => [] });
    const c = cira.erzeuge({ db, bucheVorgang: () => {}, claudeExe: 'nie.exe', merken: m });
    const a = await c.frage({ text: 'Merke dir für shop: Die Kasse rundet je Position.', kanal: 'dock' });
    assert.strictEqual(a.stufe, 'T0');
    assert.match(a.text, /Braucht dich/);
    for (let i = 0; i < 50 && !db.prepare("SELECT 1 FROM freigabe WHERE art = 'vault_notiz'").get(); i++) await new Promise((ok) => setTimeout(ok, 10));
    const f = db.prepare("SELECT nutzlast_json FROM freigabe WHERE art = 'vault_notiz'").get();
    assert.ok(f, 'keine Freigabe angelegt');
    assert.strictEqual(JSON.parse(f.nutzlast_json).tag, 'shop');
    for (let i = 0; i < 50 && db.prepare("SELECT COUNT(*) AS n FROM cira_nachricht WHERE rolle = 'cira'").get().n < 2; i++) await new Promise((ok) => setTimeout(ok, 10));
    assert.match(db.prepare("SELECT text FROM cira_nachricht WHERE rolle = 'cira' ORDER BY id DESC LIMIT 1").get().text, /Entwurf liegt unter/, 'Ergebnis nicht als Nachricht');
    // Ergaenzen ohne „Claude:“: nur ein Angebot, kein Lauf.
    const b = await c.frage({ text: 'Ergänze in kasse-runden: Rabatte zuerst.', kanal: 'dock' });
    assert.ok(b.angebot && /^claude: /.test(b.angebot.frage), 'kein Angebot fuer Claude');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM freigabe WHERE art = 'vault_notiz'").get().n, 1);
  }

  return [
    ['C9c merke dir: Freigabe mit tags auf Spalte 0 und Projekt-Tag, Vault unveraendert', neu],
    ['C9c pruefeNotiz: nur verschachtelte Tags -> Fehler', pruefung],
    ['C9c Tag-Quelle: fuer X gegen Index-Tags, sonst Auswahl', tagQuelle],
    ['C9c T2-Kopie: Schreiben ausserhalb memory/wiki wird erkannt, Deny-Regeln, Kopie weg', t2Kopie],
    ['C9c Speichern: Datei mit Projekt-Tag, MEMORY.md-Zeile im richtigen Abschnitt', speichernNeu],
    ['C9c Tag-Auswahl: ohne Wahl 409, Wahl ausserhalb 409, gewaehlter Tag steht in der Datei', tagWahl],
    ['C9c Speichern nach Fremdaenderung -> 409, nichts geschrieben, Freigabe offen', fremdaenderung],
    ['C9c Ablehnen: Vault unveraendert, keine Kopie uebrig', ablehnen],
    ['C9c MEMORY.md ab 140 Zeilen: keine Zeile, Hinweis', memoryVoll],
    ['C9c CRLF- und BOM-Ziel bleibt so', crlf],
    ['C9c Absicht: Antwort sofort, Freigabe und Nachricht danach, Ergaenzen nur als Angebot', absicht],
  ];
};
