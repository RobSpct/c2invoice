'use strict';
// C8 Werkzeuge (Plan design/cira/C8-PLAN.md, Spec design/cira/C8-WERKZEUGE.md):
// Claude-Code-Konfiguration lesen, genau einen Schluessel schreiben, Kontext
// per /context messen, Inventar, Nutzung und Vorschlag, Schalten und Lager.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = ({ dbmod, openDbs }) => {
  const wz = require('../../werkzeuge');
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c8-'));
  const baks = (ordner) => fs.readdirSync(ordner).filter((f) => f.includes('.bak-'));
  const fixture = () => fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'context-c8.md'), 'utf8');
  // Kindprozess-Attrappe: gibt `aus` (Objekt → JSON) auf stdout und endet mit `code`.
  const falscherSpawn = (aus, sieh = () => {}, code = 0) => (exe, args, opts) => {
    sieh(args, opts);
    const { EventEmitter } = require('node:events');
    const k = new EventEmitter();
    k.stdout = new EventEmitter();
    k.stderr = new EventEmitter();
    k.kill = () => {};
    setImmediate(() => {
      k.stdout.emit('data', Buffer.from(typeof aus === 'string' ? aus : JSON.stringify(aus)));
      k.emit('close', code);
    });
    return k;
  };

  // Heim mit Claude-Konfiguration und ein Arbeitsbereich „Proj“ (Pfad p).
  // Liefert { heim, p, lager, bereiche }.
  function fixtureHeim() {
    const heim = tmp();
    const p = path.join(heim, 'proj');
    const lager = path.join(heim, 'lager');
    const schreib = (rel, inhalt) => {
      const f = path.join(heim, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt, null, 2));
    };
    const skill = (rel, name, beschr) => schreib(rel + '/' + name + '/SKILL.md', '---\nname: ' + name + '\ndescription: ' + beschr + '\n---\n# x\n');
    skill('.claude/skills', 'aufraeumen', 'Raeumt auf');
    skill('.claude/skills', 'notiz', 'Schreibt Notizen in den Ordner der Wahl');
    skill('proj/.claude/skills', 'bauen', 'Baut das Projekt');
    skill('lager', 'recherche', 'Recherche mit Quellen');
    skill('lager', 'notiz', 'Doppelt im Lager');
    schreib('.claude/agents/pruefer.md', '---\nname: pruefer\ndescription: Prueft Code\n---\nText');
    schreib('.claude/commands/uebergabe.md', '---\ndescription: Uebergabe schreiben\n---\nText');
    schreib('.claude/settings.json', {
      skillOverrides: { notiz: 'off' },
      enabledPlugins: { 'helfer@markt': true, 'regel@eigene': true, 'alt@markt': false },
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: 'node C:/x/start-hook.mjs' }] }],
        Stop: [{ hooks: [{ type: 'command', command: '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\a b\\.claude\\stop-hook.mjs" --v2' }] }],
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'rtk hook claude' }] }],
      },
    });
    schreib('.claude/plugins/installed_plugins.json', { version: 2, plugins: {
      'helfer@markt': [{ scope: 'user', installPath: path.join(heim, 'cache', 'helfer') }],
      'regel@eigene': [{ scope: 'user', installPath: path.join(heim, 'mods', 'regel') }],
      'alt@markt': [{ scope: 'user', installPath: path.join(heim, 'cache', 'alt') }],
    } });
    schreib('cache/helfer/.claude-plugin/plugin.json', { name: 'helfer', description: 'Hilft' });
    schreib('.claude/plugins/known_marketplaces.json', {
      markt: { source: { source: 'github', repo: 'x/y' } },
      eigene: { source: { source: 'directory', path: path.join(heim, 'mods') } },
    });
    schreib('.claude.json', {
      mcpServers: { suche: { command: 'x' } },
      projects: { [p.replace(/\\/g, '/')]: { mcpServers: { lokal: { command: 'y' } }, disabledMcpServers: ['suche'] } },
    });
    schreib('proj/.mcp.json', { mcpServers: { team: { command: 'z' }, zweit: { command: 'z' } } });
    schreib('proj/.claude/settings.local.json', { skillOverrides: { aufraeumen: 'off' }, enabledPlugins: { 'alt@markt': true }, disabledMcpjsonServers: ['zweit'] });
    return { heim, p, lager, bereiche: [{ name: 'Proj', pfad: p }, { name: 'Ohne', pfad: null }] };
  }
  const zeile = (inv, art, name) => inv.arten[art].find((e) => e.name === name);
  const metrics = require('../../metrics');
  const pricing = require('../../pricing');

  // Proj: 3 Sitzungen, 10 Requests (opus 9, haiku 1); Skill s in a, Plugin-Skill
  // helfer:eins in b, MCP m in a und b (je 0,15 $), Plugin-Server in c.
  // Dazu eine Sitzung in einem anderen Projekt und eine vor dem Zeitraum.
  function nutzungsDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const ins = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, skill, mcp_server) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let i = 0;
    const r = (sitzung, projekt, tag, { modell = 'claude-opus-5-5', skill = null, mcp = null, kosten = 0.05 } = {}) =>
      ins.run('n' + i++, tag + 'T10:00:00Z', sitzung, projekt, modell, 100, 50, 0, 0, 1000, 0, kosten, 0, tag, skill, mcp);
    r('a', 'Proj', '2026-10-05', { skill: 's' }); r('a', 'Proj', '2026-10-05', { mcp: 'm', kosten: 0.15 }); r('a', 'Proj', '2026-10-05');
    r('b', 'Proj', '2026-10-10', { skill: 'helfer:eins' }); r('b', 'Proj', '2026-10-10', { mcp: 'm', kosten: 0.15 }); r('b', 'Proj', '2026-10-10');
    r('c', 'Proj', '2026-10-12', { mcp: 'plugin:helfer:dienst' }); r('c', 'Proj', '2026-10-12'); r('c', 'Proj', '2026-10-12');
    r('c', 'Proj', '2026-10-12', { modell: 'claude-haiku-5-5' });
    r('x', 'Anders', '2026-10-12');
    r('alt', 'Proj', '2026-09-01', { skill: 's' });
    return db;
  }

  // Dienst auf dem Fixture-Heim mit der Nutzungs-DB, falschem claude und ohne Wartezeit.
  function dienst(o = {}) {
    const f = fixtureHeim();
    const db = nutzungsDb();
    const d = wz.erzeuge({
      db,
      bereiche: () => [{ name: 'Proj', pfad: f.p, projekt: 'Proj' }, { name: 'Ohne', pfad: null, projekt: null }],
      heim: () => f.heim,
      lager: () => f.lager,
      exe: o.exe || (() => 'claude.exe'),
      spawnFn: falscherSpawn({ result: fixture() }),
      jetzt: o.jetzt || Date.now,
      warte: o.warte || (async () => {}),
    });
    return { d, f, db };
  }

  return [
    ['C8 aendere: nur ein Schluessel, BOM/CRLF/Tab bleiben, Sicherung byte-gleich', () => {
      const d = tmp();
      const f = path.join(d, 'settings.json');
      const alt = '\uFEFF' + JSON.stringify({ a: 1, enabledPlugins: { 'x@m': true }, z: [1] }, null, '\t').replace(/\n/g, '\r\n') + '\r\n';
      fs.writeFileSync(f, alt);
      const r = wz.aendere(f, (o) => wz.setzeSchluessel(o, ['enabledPlugins', 'x@m'], false), { jetzt: () => Date.UTC(2026, 9, 20, 22, 1, 2) });
      assert.strictEqual(r.geaendert, true);
      const neu = fs.readFileSync(f, 'utf8');
      assert.ok(neu.startsWith('\uFEFF'), 'BOM fehlt');
      assert.ok(neu.includes('\r\n') && !/[^\r]\n/.test(neu), 'Zeilenende nicht CRLF');
      assert.ok(neu.endsWith('\r\n'), 'Zeilenende am Dateiende fehlt');
      assert.ok(/\r\n\t"a"/.test(neu), 'Einzug nicht Tab');
      assert.deepStrictEqual(JSON.parse(neu.slice(1)), { a: 1, enabledPlugins: { 'x@m': false }, z: [1] });
      const b = baks(d);
      assert.strictEqual(b.length, 1);
      assert.strictEqual(path.join(d, b[0]), r.bak);
      assert.strictEqual(fs.readFileSync(r.bak, 'utf8'), alt);
      assert.deepStrictEqual([r.vorher, r.nachher], [true, false]);
    }],
    ['C8 aendere: Datei und Ordner fehlen → angelegt, keine Sicherung', () => {
      const d = tmp();
      const f = path.join(d, '.claude', 'settings.local.json');
      const r = wz.aendere(f, (o) => wz.setzeSchluessel(o, ['skillOverrides', 's'], 'off'));
      assert.strictEqual(r.bak, null);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { skillOverrides: { s: 'off' } });
      assert.deepStrictEqual([r.vorher, r.nachher], [undefined, 'off']);
    }],
    ['C8 aendere: kaputtes JSON → 409, Datei byte-gleich, keine Sicherung', () => {
      const d = tmp();
      const f = path.join(d, 'settings.json');
      fs.writeFileSync(f, '{"a": 1,');
      assert.throws(() => wz.aendere(f, (o) => wz.setzeSchluessel(o, ['b'], 1)), (e) => e.status === 409);
      assert.strictEqual(fs.readFileSync(f, 'utf8'), '{"a": 1,');
      assert.deepStrictEqual(baks(d), []);
    }],
    ['C8 aendere: ohne Aenderung wird nichts geschrieben', () => {
      const d = tmp();
      const f = path.join(d, 'settings.json');
      fs.writeFileSync(f, '{\n  "skillOverrides": {\n    "s": "off"\n  }\n}\n');
      const vor = fs.statSync(f).mtimeMs;
      const r = wz.aendere(f, (o) => wz.setzeSchluessel(o, ['skillOverrides', 's'], 'off'));
      assert.strictEqual(r.geaendert, false);
      assert.deepStrictEqual(baks(d), []);
      assert.strictEqual(fs.statSync(f).mtimeMs, vor);
    }],
    ['C8 setzeSchluessel undefined entfernt, Eltern bleiben', () => {
      const o = { skillOverrides: { s: 'off' } };
      const r = wz.setzeSchluessel(o, ['skillOverrides', 's'], undefined);
      assert.deepStrictEqual(o, { skillOverrides: {} });
      assert.deepStrictEqual(r, { vorher: 'off', nachher: undefined });
    }],
    ['C8 listeSetzen idempotent, Reihenfolge bleibt', () => {
      const o = { projects: { '/p': { disabledMcpServers: ['a', 'b'] } } };
      const pf = ['projects', '/p', 'disabledMcpServers'];
      wz.listeSetzen(o, pf, 'c', true);
      wz.listeSetzen(o, pf, 'c', true);
      assert.deepStrictEqual(o.projects['/p'].disabledMcpServers, ['a', 'b', 'c']);
      const r = wz.listeSetzen(o, pf, 'a', false);
      assert.deepStrictEqual(o.projects['/p'].disabledMcpServers, ['b', 'c']);
      assert.deepStrictEqual(r, { vorher: true, nachher: false });
      wz.listeSetzen(o, ['projects', '/q', 'disabledMcpServers'], 'x', true);
      assert.deepStrictEqual(o.projects['/q'], { disabledMcpServers: ['x'] });
    }],
    ['C8 aendere: fremder Schreiber zwischen zwei Aufrufen bleibt erhalten', () => {
      const d = tmp();
      const f = path.join(d, '.claude.json');
      fs.writeFileSync(f, JSON.stringify({ projects: {} }, null, 2));
      wz.aendere(f, (o) => wz.listeSetzen(o, ['projects', '/p', 'disabledMcpServers'], 'a', true));
      const o = JSON.parse(fs.readFileSync(f, 'utf8'));
      o.neu = 1;
      fs.writeFileSync(f, JSON.stringify(o, null, 2));
      wz.aendere(f, (x) => wz.listeSetzen(x, ['projects', '/p', 'disabledMcpServers'], 'b', true));
      const ende = JSON.parse(fs.readFileSync(f, 'utf8'));
      assert.strictEqual(ende.neu, 1);
      assert.deepStrictEqual(ende.projects['/p'].disabledMcpServers, ['a', 'b']);
    }],

    ['C8 parseKontext: echte Ausgabe (Fixture)', () => {
      const k = wz.parseKontext(fixture());
      assert.strictEqual(k.deferred, true);
      assert.strictEqual(k.kategorien['Skills'], 21600);
      assert.strictEqual(k.kategorien['MCP tools'], 630);
      assert.strictEqual(k.mcp['chrome-devtools'], 252 + 151 + 241);
      assert.deepStrictEqual(k.skills['agent-reach'], { quelle: 'User', tokens: 280 });
      assert.deepStrictEqual(k.skills['caveman:caveman'], { quelle: 'Plugin (caveman)', tokens: 80 });
      assert.deepStrictEqual(k.skills['dataviz'], { quelle: 'Built-in', tokens: 480 });
      // „< 20“ steht fuer sehr kleine Skills; gezaehlt wird die Obergrenze.
      assert.deepStrictEqual(k.skills['bm:help'], { quelle: 'Plugin (bm)', tokens: 20 });
      assert.deepStrictEqual(k.agents['bm:gsd-ai-researcher'], { quelle: 'Plugin', tokens: 136 });
      assert.deepStrictEqual(k.agents['database-reviewer'], { quelle: 'User', tokens: 94 });
    }],
    ['C8 parseKontext: fremdes Format → Messung nicht lesbar', () => {
      assert.throws(() => wz.parseKontext('## Context Usage\n\nnichts'), /Messung nicht lesbar/);
      const ohneTokens = fixture().replace('| Tool | Server | Tokens |', '| Tool | Server | Menge |');
      assert.throws(() => wz.parseKontext(ohneTokens), /Messung nicht lesbar/);
      const ohneKategorie = fixture().replace('| Category | Tokens | Percentage |', '| Kategorie | Anzahl | Anteil |');
      assert.throws(() => wz.parseKontext(ohneKategorie), /Messung nicht lesbar/);
    }],
    ['C8 misseKontext: Argumente ohne Shell, Ergebnis = Parser, Fehler werfen', async () => {
      let gesehen = null;
      const k = await wz.misseKontext({ exe: 'claude.exe', cwd: os.tmpdir(), spawnFn: falscherSpawn({ result: fixture() }, (a, o) => { gesehen = { a, o }; }) });
      assert.deepStrictEqual(k, wz.parseKontext(fixture()));
      assert.deepStrictEqual(gesehen.a.slice(0, 2), ['-p', '/context']);
      assert.ok(gesehen.a.includes('--no-session-persistence'));
      assert.ok(!gesehen.o.shell, 'ohne Shell starten');
      assert.strictEqual(gesehen.o.cwd, os.tmpdir());
      await assert.rejects(wz.misseKontext({ exe: 'x', cwd: os.tmpdir(), spawnFn: falscherSpawn({ is_error: true, result: 'kaputt' }) }), (e) => e.status === 502);
      await assert.rejects(wz.misseKontext({ exe: 'x', cwd: os.tmpdir(), spawnFn: falscherSpawn('kein json', undefined, 1) }), (e) => e.status === 502);
    }],

    ['C8 Inventar: Zellen je Ebene (an/aus/erbt), Herkunft, Schaltbarkeit', () => {
      const f = fixtureHeim();
      const inv = wz.inventar({ heim: f.heim, bereiche: f.bereiche, lager: f.lager, kontext: {} });
      assert.deepStrictEqual(inv.spalten, ['global', 'Proj', 'Ohne']);
      assert.deepStrictEqual(inv.ebenenFehler, []);
      // Skills: global an, im Bereich lokal aus; global aus, im Bereich erbt.
      assert.deepStrictEqual(zeile(inv, 'skills', 'aufraeumen').zellen, { global: 'an', Proj: 'aus', Ohne: '—' });
      assert.deepStrictEqual(zeile(inv, 'skills', 'notiz').zellen, { global: 'aus', Proj: 'erbt', Ohne: '—' });
      assert.strictEqual(zeile(inv, 'skills', 'notiz').wirksam.Proj, false);
      const bauen = zeile(inv, 'skills', 'bauen');
      assert.deepStrictEqual([bauen.herkunft, bauen.zellen.global, bauen.zellen.Proj], ['projekt', '—', 'erbt']);
      assert.strictEqual(bauen.wirksam.Proj, true);
      // Lager: nur, was nirgends installiert ist; notiz ist global schon da.
      const rech = zeile(inv, 'skills', 'recherche');
      assert.deepStrictEqual([rech.herkunft, rech.schaltbar], ['lager', false]);
      assert.deepStrictEqual(rech.installierbarIn, ['global', 'Proj']);
      assert.strictEqual(inv.arten.skills.filter((e) => e.name === 'notiz').length, 1);
      // Plugins und Mods.
      const helfer = zeile(inv, 'plugins', 'helfer@markt');
      assert.deepStrictEqual([helfer.schaltbar, helfer.beschreibung, helfer.zellen.global, helfer.zellen.Proj], [true, 'Hilft', 'an', 'erbt']);
      assert.deepStrictEqual(zeile(inv, 'plugins', 'alt@markt').zellen, { global: 'aus', Proj: 'an', Ohne: '—' });
      assert.ok(zeile(inv, 'mods', 'regel@eigene'), 'Plugin aus Verzeichnis-Marktplatz ist ein Mod');
      assert.ok(!zeile(inv, 'plugins', 'regel@eigene'));
      assert.deepStrictEqual(inv.arten.mods.filter((e) => !e.schaltbar).map((e) => e.name).sort(),
        ['PreToolUse: rtk', 'SessionStart: start-hook.mjs', 'Stop: stop-hook.mjs']);
      const hook = inv.arten.mods.find((e) => e.name.startsWith('SessionStart:'));
      assert.deepStrictEqual([hook.schaltbar, /einzelne Hooks/.test(hook.grund)], [false, true]);
      // Agents und Commands nur Anzeige.
      assert.deepStrictEqual([zeile(inv, 'agents', 'pruefer').schaltbar, zeile(inv, 'commands', 'uebergabe').schaltbar], [false, false]);
      assert.ok(/Agents/.test(zeile(inv, 'agents', 'pruefer').grund));
      // MCP: global nur Anzeige, im Bereich ueber disabledMcpServers; .mcp.json ueber die Listen.
      assert.deepStrictEqual(zeile(inv, 'mcps', 'suche').zellen, { global: 'an', Proj: 'aus', Ohne: '—' });
      assert.deepStrictEqual([zeile(inv, 'mcps', 'lokal').herkunft, zeile(inv, 'mcps', 'lokal').zellen.Proj], ['projekt', 'an']);
      assert.deepStrictEqual([zeile(inv, 'mcps', 'team').herkunft, zeile(inv, 'mcps', 'team').zellen.Proj], ['mcpjson', 'erbt']);
      assert.strictEqual(zeile(inv, 'mcps', 'zweit').zellen.Proj, 'aus');
    }],
    ['C8 Inventar: Kontext aus Messung, deferred, Plugin-Summe, claude.ai-Server', () => {
      const f = fixtureHeim();
      const k = {
        kategorien: { 'MCP tools (deferred)': 5000 }, deferred: true,
        mcp: { suche: 1200, claude_ai_Google_Calendar: 900 },
        skills: { aufraeumen: { quelle: 'User', tokens: 150 }, 'helfer:eins': { quelle: 'Plugin (helfer)', tokens: 40 }, 'helfer:zwei': { quelle: 'Plugin (helfer)', tokens: 60 } },
        agents: { 'helfer:pruef': { quelle: 'Plugin', tokens: 25 } },
      };
      const inv = wz.inventar({ heim: f.heim, bereiche: f.bereiche, lager: f.lager, kontext: { global: k } });
      assert.deepStrictEqual(zeile(inv, 'skills', 'aufraeumen').kontext.global, { tokens: 150, geschaetzt: false, deferred: false });
      assert.deepStrictEqual(zeile(inv, 'mcps', 'suche').kontext.global, { tokens: 0, voll: 1200, geschaetzt: false, deferred: true });
      assert.strictEqual(zeile(inv, 'plugins', 'helfer@markt').kontext.global.tokens, 125);
      const cal = zeile(inv, 'mcps', 'claude.ai Google Calendar');
      assert.deepStrictEqual([cal.herkunft, cal.zellen.global, cal.schaltbar], ['claude.ai', 'an', true]);
      // Ohne Messung: Schaetzung aus der Beschreibung.
      const notiz = zeile(inv, 'skills', 'notiz').kontext.Proj;
      assert.deepStrictEqual([notiz.geschaetzt, notiz.tokens > 0], [true, true]);
    }],
    ['C8 Inventar: ohne ~/.claude → leer, kein Fehler', () => {
      const inv = wz.inventar({ heim: tmp(), bereiche: [], lager: null, kontext: {} });
      for (const art of ['skills', 'agents', 'commands', 'plugins', 'mods', 'mcps']) assert.deepStrictEqual(inv.arten[art], []);
      assert.deepStrictEqual(inv.ebenenFehler, []);
    }],
    ['C8 Inventar: kaputte Settings → ebenenFehler, Rest gelesen', () => {
      const f = fixtureHeim();
      fs.writeFileSync(path.join(f.p, '.claude', 'settings.local.json'), '{kaputt');
      const inv = wz.inventar({ heim: f.heim, bereiche: f.bereiche, lager: f.lager, kontext: {} });
      assert.strictEqual(inv.ebenenFehler.length, 1);
      assert.ok(inv.ebenenFehler[0].datei.endsWith('settings.local.json'));
      assert.strictEqual(zeile(inv, 'skills', 'aufraeumen').zellen.global, 'an');
      assert.strictEqual(zeile(inv, 'skills', 'aufraeumen').gesperrt.Proj, true, 'Ebene mit kaputter Datei ist nicht schaltbar');
    }],

    ['C8 Nutzung: Sitzungen, Requests, Modell, je Skill/MCP/Plugin', () => {
      const db = nutzungsDb();
      const n = metrics.werkzeugNutzung(db, { project: 'Proj', from: '2026-10-01', to: '2026-10-20' });
      assert.deepStrictEqual([n.sitzungen, n.requests, n.modell], [3, 10, 'claude-opus-5-5']);
      assert.deepStrictEqual(n.skill, { s: 1, 'helfer:eins': 1 });
      assert.deepStrictEqual(Object.keys(n.mcp).sort(), ['m', 'plugin:helfer:dienst']);
      assert.strictEqual(n.mcp.m.sitzungen, 2);
      assert.ok(Math.abs(n.mcp.m.cost_eur - metrics.usdToEur(0.3)) < 1e-9);
      assert.deepStrictEqual(n.plugin, { helfer: 2 });
      // Anderes Projekt und ausserhalb des Zeitraums zaehlen nicht; ohne Projekt alles im Zeitraum.
      assert.strictEqual(metrics.werkzeugNutzung(db, { project: null, from: '2026-10-01', to: '2026-10-20' }).sitzungen, 4);
    }],
    ['C8 Vorschlag Regel: Schwellen und Ersparnis auf den Cent', () => {
      const nutzung = { requests: 100, sitzungen: 10 };
      const preis = { cr: 0.5e-6, cw5m: 6.25e-6 };
      const k = (tokens, sitzungen) => [{ art: 'mcps', name: 'x', ws: 'Proj', tokens, sitzungen }];
      assert.strictEqual(metrics.werkzeugVorschlag({ kandidaten: k(999, 0), nutzung, preis }), null);
      assert.strictEqual(metrics.werkzeugVorschlag({ kandidaten: k(1500, 3), nutzung, preis }), null);
      const v = metrics.werkzeugVorschlag({ kandidaten: [...k(1500, 2), { art: 'skills', name: 'y', ws: 'Proj', tokens: 1200, sitzungen: 0 }], nutzung, preis });
      assert.strictEqual(v.name, 'x');
      assert.ok(Math.abs(v.ersparnis_usd - 0.16875) < 1e-12, String(v.ersparnis_usd));
      assert.ok(Math.abs(v.ersparnis_eur - metrics.usdToEur(0.16875)) < 1e-9);
      assert.deepStrictEqual(v.grundlage, { requests: 100, sitzungen: 10, cr: 0.5e-6, cw5m: 6.25e-6 });
    }],
    ['C8 Vorschlag Plausibilitaet: Ersparnis unter den Gesamtkosten, Requests zaehlen', () => {
      const db = nutzungsDb();
      const n = metrics.werkzeugNutzung(db, { project: 'Proj', from: '2026-10-01', to: '2026-10-20' });
      const preis = pricing.priceFor(n.modell);
      const v = metrics.werkzeugVorschlag({ kandidaten: [{ art: 'mcps', name: 'm', ws: 'Proj', tokens: 2000, sitzungen: 2 }], nutzung: n, preis });
      const kosten = db.prepare("SELECT SUM(cost_usd) k FROM events WHERE project = 'Proj'").get().k;
      assert.ok(v.ersparnis_usd > 0 && v.ersparnis_usd <= kosten, v.ersparnis_usd + ' > ' + kosten);
      // Viele Requests je Sitzung (Alltag: Dutzende): dann traegt das Cache-Lesen
      // die Ersparnis, nicht das einmalige Schreiben je Sitzung.
      const viel = metrics.werkzeugVorschlag({ kandidaten: [{ art: 'mcps', name: 'm', ws: 'Proj', tokens: 2000, sitzungen: 2 }], nutzung: { ...n, requests: 2000, kosten_usd: 100 }, preis });
      assert.ok(viel.ersparnis_usd > 2 * v.ersparnis_usd, 'Requests fehlen in der Ersparnis: ' + viel.ersparnis_usd + ' vs ' + v.ersparnis_usd);
    }],
    ['C8 Dienst: schalte Skill im Bereich (aus, erbt), Protokoll', async () => {
      const { d, f, db } = dienst();
      const r = await d.schalte({ ws: 'Proj', art: 'skills', name: 'notiz', wert: 'aus' });
      const lokal = path.join(f.p, '.claude', 'settings.local.json');
      assert.strictEqual(r.datei, lokal);
      assert.strictEqual(JSON.parse(fs.readFileSync(lokal, 'utf8')).skillOverrides.notiz, 'off');
      assert.strictEqual(zeile(d.liste('Proj'), 'skills', 'notiz').zellen.Proj, 'aus');
      await d.schalte({ ws: 'Proj', art: 'skills', name: 'notiz', wert: 'erbt' });
      assert.ok(!Object.hasOwn(JSON.parse(fs.readFileSync(lokal, 'utf8')).skillOverrides, 'notiz'));
      const log = db.prepare("SELECT art, objekt FROM aktion_log WHERE quelle = 'werkzeuge' ORDER BY id").all().map((x) => x.art + ' ' + x.objekt);
      assert.deepStrictEqual(log, ['schalten skills:notiz@Proj', 'schalten skills:notiz@Proj']);
    }],
    ['C8 Dienst: schalte Plugin global, erbt auf Global → 400', async () => {
      const { d, f } = dienst();
      await d.schalte({ ws: 'global', art: 'plugins', name: 'helfer@markt', wert: 'aus' });
      assert.strictEqual(JSON.parse(fs.readFileSync(path.join(f.heim, '.claude', 'settings.json'), 'utf8')).enabledPlugins['helfer@markt'], false);
      await assert.rejects(d.schalte({ ws: 'global', art: 'plugins', name: 'helfer@markt', wert: 'erbt' }), (e) => e.status === 400);
    }],
    ['C8 Dienst: schalte MCP .mcp.json ueber die Listen', async () => {
      const { d, f } = dienst();
      await d.schalte({ ws: 'Proj', art: 'mcps', name: 'zweit', wert: 'erbt' });
      const o = JSON.parse(fs.readFileSync(path.join(f.p, '.claude', 'settings.local.json'), 'utf8'));
      assert.deepStrictEqual([o.enabledMcpjsonServers, o.disabledMcpjsonServers], [undefined, []]);
      await d.schalte({ ws: 'Proj', art: 'mcps', name: 'team', wert: 'aus' });
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(f.p, '.claude', 'settings.local.json'), 'utf8')).disabledMcpjsonServers, ['team']);
    }],
    ['C8 Dienst: schalte MCP in ~/.claude.json, Nachpruefung gehalten', async () => {
      const { d, f } = dienst();
      const r = await d.schalte({ ws: 'Proj', art: 'mcps', name: 'lokal', wert: 'aus' });
      assert.strictEqual(r.gehalten, true);
      const cj = JSON.parse(fs.readFileSync(path.join(f.heim, '.claude.json'), 'utf8'));
      assert.deepStrictEqual(cj.projects[f.p.replace(/\\/g, '/')].disabledMcpServers, ['suche', 'lokal']);
    }],
    ['C8 Dienst: schalte MCP ueberschrieben → gehalten false', async () => {
      const cjDatei = (f) => path.join(f.heim, '.claude.json');
      let fx;
      const { d, f } = dienst({ warte: async () => {
        // Eine laufende Sitzung schreibt ihren alten Stand zurueck.
        const o = JSON.parse(fs.readFileSync(cjDatei(fx), 'utf8'));
        o.projects[fx.p.replace(/\\/g, '/')].disabledMcpServers = ['suche'];
        fs.writeFileSync(cjDatei(fx), JSON.stringify(o));
      } });
      fx = f;
      const r = await d.schalte({ ws: 'Proj', art: 'mcps', name: 'lokal', wert: 'aus' });
      assert.strictEqual(r.gehalten, false);
    }],
    ['C8 Dienst: unbekannt 404, nicht schaltbar 409, Global-MCP 409, Dateien unveraendert', async () => {
      const { d, f } = dienst();
      const vorher = [path.join(f.heim, '.claude', 'settings.json'), path.join(f.heim, '.claude.json')].map((x) => fs.readFileSync(x, 'utf8'));
      await assert.rejects(d.schalte({ ws: 'Proj', art: 'skills', name: 'gibtsnicht', wert: 'aus' }), (e) => e.status === 404);
      await assert.rejects(d.schalte({ ws: 'Proj', art: 'agents', name: 'pruefer', wert: 'aus' }), (e) => e.status === 409 && /Agents/.test(e.message));
      await assert.rejects(d.schalte({ ws: 'global', art: 'mcps', name: 'suche', wert: 'aus' }), (e) => e.status === 409);
      await assert.rejects(d.schalte({ ws: 'Ohne', art: 'skills', name: 'notiz', wert: 'aus' }), (e) => e.status === 409);
      await assert.rejects(d.schalte({ ws: 'Proj', art: 'skills', name: 'notiz', wert: 'vielleicht' }), (e) => e.status === 400);
      await assert.rejects(d.schalte({ ws: 'Fremd', art: 'skills', name: 'notiz', wert: 'aus' }), (e) => e.status === 404);
      const nachher = [path.join(f.heim, '.claude', 'settings.json'), path.join(f.heim, '.claude.json')].map((x) => fs.readFileSync(x, 'utf8'));
      assert.deepStrictEqual(nachher, vorher);
    }],
    ['C8 Dienst: installiere aus dem Lager, kein Ueberschreiben, kein Pfad', async () => {
      const { d, f } = dienst();
      const r = await d.installiere({ ws: 'Proj', name: 'recherche' });
      assert.strictEqual(r.ziel, path.join(f.p, '.claude', 'skills', 'recherche'));
      assert.ok(fs.existsSync(path.join(r.ziel, 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(f.lager, 'recherche', 'SKILL.md')), 'Lager bleibt');
      await assert.rejects(d.installiere({ ws: 'Proj', name: 'recherche' }), (e) => e.status === 409);
      await assert.rejects(d.installiere({ ws: 'Proj', name: '../lager/recherche' }), (e) => e.status === 404);
      await assert.rejects(d.installiere({ ws: 'Proj', name: 'aufraeumen' }), (e) => e.status === 404);
    }],
    ['C8 Dienst: messe speichert, alt nach 24 h, ohne Pfad 409, ohne Claude 503', async () => {
      let uhr = Date.UTC(2026, 9, 20, 12);
      const { d, db } = dienst({ jetzt: () => uhr });
      assert.strictEqual(d.liste('Proj').kontext.alt, true);
      await d.messe('Proj');
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM werkzeug_kontext WHERE bereich = 'Proj'").get().n, 1);
      const l = d.liste('Proj');
      assert.strictEqual(l.kontext.alt, false);
      assert.strictEqual(zeile(l, 'skills', 'aufraeumen').kontext.Proj.tokens, null, 'Fixture kennt aufraeumen nicht: gemessen, kein Wert');
      uhr += 25 * 3600e3;
      assert.strictEqual(d.liste('Proj').kontext.alt, true);
      await assert.rejects(d.messe('Ohne'), (e) => e.status === 409);
      const ohne = dienst({ exe: () => null }).d;
      await assert.rejects(ohne.messe('Proj'), (e) => e.status === 503);
    }],
    ['C8 Dienst: liste mit Kacheln, Nutzung, Vorschlag, Werkzeugbetrieb', async () => {
      const { d, db } = dienst({ jetzt: () => Date.UTC(2026, 9, 20, 12) });
      // Messung mit geladenem (nicht aufgeschobenem) MCP „lokal“ von 2000 Tokens.
      db.prepare('INSERT INTO werkzeug_kontext (bereich, gemessen_am, json) VALUES (?,?,?)').run('Proj', new Date(Date.UTC(2026, 9, 20, 11)).toISOString(),
        JSON.stringify({ kategorien: {}, deferred: false, mcp: { lokal: 2000 }, skills: {}, agents: {} }));
      const l = d.liste('Proj');
      assert.strictEqual(l.ws, 'Proj');
      assert.deepStrictEqual(l.spalten, ['global', 'Proj', 'Ohne']);
      assert.strictEqual(l.kacheln.mcps, l.arten.mcps.filter((e) => e.wirksam.Proj).length);
      assert.strictEqual(zeile(l, 'mcps', 'm') === undefined, true);
      assert.strictEqual(zeile(l, 'skills', 's') === undefined, true);
      assert.ok(l.vorschlag && l.vorschlag.name === 'lokal' && l.vorschlag.art === 'mcps', JSON.stringify(l.vorschlag));
      assert.ok(l.vorschlag.ersparnis_eur > 0);
      assert.strictEqual(typeof l.werkzeugbetrieb_eur_30t, 'number');
      assert.strictEqual(l.kontext_summe.tokens >= 2000, true);
      // Lager ist nicht installiert: keine Nutzungszahl statt „0 Sitzungen“.
      assert.strictEqual(zeile(l, 'skills', 'recherche').sitzungen30, null);
    }],
    ['C8 Dienst: Plugin mit Hooks ist nie ein Vorschlag (Nutzung nicht messbar)', async () => {
      const { d, db, f } = dienst({ jetzt: () => Date.UTC(2026, 9, 20, 12) });
      fs.mkdirSync(path.join(f.heim, 'cache', 'helfer', 'hooks'), { recursive: true });
      fs.writeFileSync(path.join(f.heim, 'cache', 'helfer', 'hooks', 'hooks.json'), '{"hooks":{}}');
      db.prepare('INSERT INTO werkzeug_kontext (bereich, gemessen_am, json) VALUES (?,?,?)').run('Proj', new Date(Date.UTC(2026, 9, 20, 11)).toISOString(),
        JSON.stringify({ kategorien: {}, deferred: false, mcp: { lokal: 2000 }, skills: { 'helfer:eins': { quelle: 'Plugin (helfer)', tokens: 3000 } }, agents: {} }));
      const l = d.liste('Proj');
      assert.strictEqual(zeile(l, 'plugins', 'helfer@markt').hooks, true);
      assert.strictEqual(l.vorschlag.name, 'lokal');
    }],
    // --- Fix-Durchgang nach den Reviews (20./21.10.) ---
    ['C8 Review: Matrix-Ziel je Zelle vom Server, kein Zyklus in Sackgassen', () => {
      const f = fixtureHeim();
      // Projekt-Datei setzt notiz an: erbt waere wirkungslos.
      fs.writeFileSync(path.join(f.p, '.claude', 'settings.json'), JSON.stringify({ skillOverrides: { notiz: 'on' } }));
      const inv = wz.inventar({ heim: f.heim, bereiche: f.bereiche, lager: f.lager, kontext: {} });
      const z = (art, name) => zeile(inv, art, name);
      assert.deepStrictEqual(z('skills', 'aufraeumen').erlaubt.Proj, ['an', 'aus', 'erbt']);
      assert.deepStrictEqual(z('skills', 'notiz').erlaubt.Proj, ['an', 'aus'], 'Wert aus Projekt-Datei: erbt aendert nichts');
      assert.deepStrictEqual(z('skills', 'aufraeumen').erlaubt.global, ['an', 'aus']);
      assert.deepStrictEqual(z('mcps', 'suche').erlaubt.Proj, ['an', 'aus'], '~/.claude.json: erbt == an');
      assert.deepStrictEqual(z('mcps', 'suche').erlaubt.global, []);
      assert.deepStrictEqual(z('mcps', 'team').erlaubt.Proj, ['aus', 'erbt'], '.mcp.json: an waere eine Freigabe fremden Codes');
      assert.strictEqual(z('mcps', 'suche').naechst.Proj, 'an');
      assert.strictEqual(z('mcps', 'lokal').naechst.Proj, 'aus');
      assert.strictEqual(z('skills', 'notiz').naechst.Proj, 'aus');
      assert.strictEqual(z('mcps', 'team').naechst.Proj, 'aus');
      assert.strictEqual(z('mcps', 'zweit').naechst.Proj, 'erbt');
    }],
    ['C8 Review: schalte lehnt nicht erlaubten Wert ab, meldet geaendert, kein Protokoll ohne Aenderung', async () => {
      const { d, f, db } = dienst();
      await assert.rejects(d.schalte({ ws: 'Proj', art: 'mcps', name: 'team', wert: 'an' }), (e) => e.status === 409);
      const r = await d.schalte({ ws: 'Proj', art: 'skills', name: 'notiz', wert: 'erbt' });
      assert.strictEqual(r.geaendert, false);
      assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM aktion_log WHERE quelle = 'werkzeuge'").get().n, 0);
      assert.ok(!fs.readFileSync(path.join(f.p, '.claude', 'settings.local.json'), 'utf8').includes('"notiz"'));
    }],
    ['C8 Review: Entfernen legt keine leeren Eltern an', () => {
      const o = {};
      assert.deepStrictEqual(wz.setzeSchluessel(o, ['skillOverrides', 'x'], undefined), { vorher: undefined, nachher: undefined });
      wz.listeSetzen(o, ['projects', '/p', 'disabledMcpServers'], 'x', false);
      assert.deepStrictEqual(o, {});
    }],
    ['C8 Review: MCP gleichen Namens global und in .mcp.json = zwei Zeilen, jede schaltet ihre Datei', async () => {
      const { d, f } = dienst();
      fs.writeFileSync(path.join(f.p, '.mcp.json'), JSON.stringify({ mcpServers: { suche: { command: 'z' } } }));
      const l = d.liste('Proj');
      const zeilen = l.arten.mcps.filter((e) => (e.server || e.name) === 'suche');
      assert.deepStrictEqual(zeilen.map((e) => e.herkunft).sort(), ['global', 'mcpjson']);
      const pj = zeilen.find((e) => e.herkunft === 'mcpjson');
      await d.schalte({ ws: 'Proj', art: 'mcps', name: pj.name, wert: 'aus' });
      const lokal = JSON.parse(fs.readFileSync(path.join(f.p, '.claude', 'settings.local.json'), 'utf8'));
      assert.ok(lokal.disabledMcpjsonServers.includes('suche'));
    }],
    ['C8 Review: Skills und Agents ueber Verzeichnis-Verknuepfung erscheinen', () => {
      const f = fixtureHeim();
      const quelle = path.join(f.heim, 'woanders', 'verlinkt');
      fs.mkdirSync(quelle, { recursive: true });
      fs.writeFileSync(path.join(quelle, 'SKILL.md'), '---\ndescription: Verlinkt\n---\n');
      fs.symlinkSync(quelle, path.join(f.heim, '.claude', 'skills', 'verlinkt'), 'junction');
      const inv = wz.inventar({ heim: f.heim, bereiche: f.bereiche, lager: f.lager, kontext: {} });
      assert.ok(zeile(inv, 'skills', 'verlinkt'), 'Skill hinter Junction fehlt');
    }],
    ['C8 Review: /context mit fehlender Einzeltabelle → Messung nicht lesbar', () => {
      const ohneSkills = fixture().replace('### Skills', '### Faehigkeiten');
      assert.throws(() => wz.parseKontext(ohneSkills), /Messung nicht lesbar/);
      const ohneAgents = fixture().replace('### Custom Agents', '### Helfer');
      assert.throws(() => wz.parseKontext(ohneAgents), /Messung nicht lesbar/);
      const ohneMcp = fixture().replace('### MCP Tools', '### Server');
      assert.throws(() => wz.parseKontext(ohneMcp), /Messung nicht lesbar/);
      // Namen wie __proto__ verbiegen nichts.
      const k = wz.parseKontext(fixture().replace('| agent-reach | User |', '| __proto__ | User |'));
      assert.deepStrictEqual(k.skills.__proto__, { quelle: 'User', tokens: 280 });
    }],
    ['C8 Review: kaputte Ebene zeigt unbekannt statt eines Zustands', () => {
      const f = fixtureHeim();
      fs.writeFileSync(path.join(f.heim, '.claude', 'settings.json'), '{kaputt');
      const inv = wz.inventar({ heim: f.heim, bereiche: f.bereiche, lager: f.lager, kontext: {} });
      const e = zeile(inv, 'skills', 'notiz');
      assert.deepStrictEqual([e.zellen.global, e.wirksam.global, e.wirksam.Proj], ['?', null, null]);
      assert.strictEqual(zeile(inv, 'plugins', 'helfer@markt').zellen.global, '?');
    }],
    ['C8 Review: Fehler nach dem Schreiben → geschrieben, gehalten null, Warnung', async () => {
      const { d, db } = dienst();
      db.exec('DROP TABLE aktion_log');
      const r = await d.schalte({ ws: 'Proj', art: 'skills', name: 'notiz', wert: 'aus' });
      assert.strictEqual(r.geaendert, true);
      assert.ok(/Protokoll/.test(r.warnung), String(r.warnung));
    }],
    ['C8 Review: Sicherung zentral, eindeutig je Aufruf, hoechstens 20 je Datei, Temp weg bei Fehler', () => {
      const d = tmp();
      const ordner = path.join(d, 'sicherung');
      const f = path.join(d, 'settings.json');
      fs.writeFileSync(f, '{"a":0}');
      for (let i = 1; i <= 23; i++) wz.aendere(f, (o) => wz.setzeSchluessel(o, ['a'], i), { jetzt: () => 1000, sicherung: ordner });
      const liste = fs.readdirSync(ordner);
      assert.strictEqual(liste.length, 20);
      assert.ok(!fs.readdirSync(d).some((x) => x.includes('.bak-')), 'keine Sicherung neben der Datei');
      // rename scheitert (Ziel ist ein Ordner): Temp-Datei bleibt nicht liegen, Meldung klar.
      const g = path.join(d, 'gesperrt.json');
      fs.writeFileSync(g, '{}');
      const orig = fs.renameSync;
      fs.renameSync = () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); };
      try { assert.throws(() => wz.aendere(g, (o) => wz.setzeSchluessel(o, ['b'], 1)), (e) => e.status === 409 && /gesperrt/.test(e.message)); } finally { fs.renameSync = orig; }
      assert.ok(!fs.existsSync(g + '.c2i-tmp'));
    }],
    ['C8 Review: Lager ohne Symlinks, reservierte Namen abgewiesen', async () => {
      const { d, f } = dienst();
      const geheim = path.join(f.heim, 'geheim');
      fs.mkdirSync(geheim);
      fs.writeFileSync(path.join(geheim, 'key.txt'), 'x');
      fs.symlinkSync(geheim, path.join(f.lager, 'recherche', 'link'), 'junction');
      const r = await d.installiere({ ws: 'Proj', name: 'recherche' });
      assert.ok(!fs.existsSync(path.join(r.ziel, 'link')), 'Verknuepfung aus dem Lager kopiert');
      fs.mkdirSync(path.join(f.lager, 'con'));
      fs.writeFileSync(path.join(f.lager, 'con', 'SKILL.md'), 'x');
      await assert.rejects(d.installiere({ ws: 'Proj', name: 'con' }), (e) => e.status === 404);
    }],
    ['C8 Review: misseKontext lehnt Nicht-Objekt ab, Hook-Name ohne Geheimnis', async () => {
      await assert.rejects(wz.misseKontext({ exe: 'x', cwd: os.tmpdir(), spawnFn: falscherSpawn('null') }), (e) => e.status === 502);
      const f = fixtureHeim();
      const s = JSON.parse(fs.readFileSync(path.join(f.heim, '.claude', 'settings.json'), 'utf8'));
      s.hooks.Notification = [{ hooks: [{ type: 'command', command: 'API_KEY=geheim123 tool --x' }] }];
      fs.writeFileSync(path.join(f.heim, '.claude', 'settings.json'), JSON.stringify(s));
      const inv = wz.inventar({ heim: f.heim, bereiche: [], lager: null, kontext: {} });
      assert.ok(!JSON.stringify(inv).includes('geheim123'));
      assert.ok(zeile(inv, 'mods', 'Notification: tool'));
    }],
    ['C8 Review: Vorschlag nie ueber den Gesamtkosten, Selten-Merkmal vom Server', async () => {
      const v = metrics.werkzeugVorschlag({ kandidaten: [{ art: 'mcps', name: 'x', ws: 'P', tokens: 1e6, sitzungen: 0 }],
        nutzung: { requests: 1000, sitzungen: 10, kosten_usd: 5 }, preis: { cr: 1e-6, cw5m: 1e-5 } });
      assert.strictEqual(v, null);
      const n = metrics.werkzeugNutzung(nutzungsDb(), { project: 'Proj', from: '2026-10-01', to: '2026-10-20' });
      assert.ok(Math.abs(n.kosten_usd - 0.7) < 1e-9, String(n.kosten_usd));
      const { d } = dienst({ jetzt: () => Date.UTC(2026, 9, 20, 12) });
      const l = d.liste('Proj');
      assert.strictEqual(zeile(l, 'mcps', 'lokal').selten, true);
      assert.strictEqual(zeile(l, 'skills', 'recherche').selten, false);
    }],
    ['C8 Vorschlag ohne Preis → null', () => {
      assert.strictEqual(metrics.werkzeugVorschlag({ kandidaten: [{ art: 'mcps', name: 'x', ws: 'P', tokens: 5000, sitzungen: 0 }], nutzung: { requests: 5, sitzungen: 1 }, preis: null }), null);
    }],
  ];
};
