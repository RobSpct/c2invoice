'use strict';
// C9b Gedaechtnis (Plan design/cira/C9-PLAN.md Task 1–3, 5): Frontmatter in
// beiden Schemata, Wikilinks, Pfadpruefung, Gruppen, Index, Graph, Suche,
// Ledger-Bezug, Einstellungen Vault. Fixture: test/fixtures/vault (Kopie je Test).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIX = path.join(__dirname, '..', 'fixtures', 'vault');
const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ dbmod, openDbs, configGeschuetzt }) => {
  const vault = require('../../vault');
  const gedaechtnis = require('../../gedaechtnis');
  const { getMeta } = require('../../db');

  const kopie = () => {
    const ziel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c9b-')), 'vault');
    fs.cpSync(FIX, ziel, { recursive: true });
    return ziel;
  };
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  const lies = (v, rel) => fs.readFileSync(path.join(v, rel), 'utf8');
  const status = (fn) => { try { fn(); } catch (e) { return e.status; } return 200; };
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, v] of Object.entries(werte)) { if (v === undefined) delete cfg[k]; else cfg[k] = JSON.parse(JSON.stringify(v)); }
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  // Gespielter Modellserver (wie m2.js): antwortet mit `antwort`, merkt sich die Anfragen.
  function chat(antwort) {
    const anfragen = [];
    const fn = async (url, init = {}) => {
      anfragen.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof antwort === 'function' ? antwort() : antwort } }], usage: { total_tokens: 12 } }) };
    };
    return { fn, anfragen };
  }
  const LOKAL = { lokaleModelle: { upstreamUrl: 'http://127.0.0.1:11434', proxyPort: 11435 } };

  async function frontmatterTest() {
    const v = kopie();
    const k = vault.frontmatter(lies(v, 'memory/project_shop_kasse.md'));
    assert.ok(k.ok);
    assert.deepStrictEqual(vault.tagsAus(k.daten), ['shop', 'kasse'], 'Tags auf Spalte 0 gewinnen nicht');
    assert.strictEqual(k.daten.metadata.originSessionId, '11111111-2222-4333-8444-555555555555');
    assert.strictEqual(k.daten.description, 'Kasse rundet je Position, nicht auf die Summe');
    assert.deepStrictEqual(vault.tagsAus(vault.frontmatter(lies(v, 'memory/feedback_nur_verschachtelt.md')).daten), ['alt', 'cross-projekt'], 'verschachtelte Tags fehlen');
    const w = vault.frontmatter(lies(v, 'wiki/kasse-runden.md'));
    assert.deepStrictEqual(vault.tagsAus(w.daten), ['cross-projekt', 'shop']);
    assert.strictEqual(vault.titelAus(w.daten, w.rumpf, 'wiki/kasse-runden.md'), 'Kasse rundet je Position');
    // Ohne schliessendes ---: kein Wurf, Titel aus dem Dateinamen.
    const kaputt = vault.frontmatter('---\nname: x\ntags:\n\t- y\n');
    assert.strictEqual(kaputt.ok, false);
    assert.strictEqual(vault.parse('memory/kaputt.md', '---\nname: x\n').titel, 'kaputt');
    // BOM + CRLF: dieselben Daten.
    const crlf = '\uFEFF' + lies(v, 'memory/project_shop_kasse.md').replace(/\n/g, '\r\n');
    assert.deepStrictEqual(vault.frontmatter(crlf).daten, k.daten, 'CRLF/BOM aendert das Frontmatter');
    assert.strictEqual(vault.parse('raw/quelle.md', lies(v, 'raw/quelle.md')).titel, 'quelle');
  }

  async function wikilinks() {
    assert.deepStrictEqual(vault.wikilinksAus('[[a|b]] und [[wiki/c#h]] ```\n[[nein]]\n``` `[[auch-nein]]` [[a]] [[d.md]]'), ['a', 'wiki/c', 'd']);
    assert.deepStrictEqual(vault.wikilinksAus(lies(FIX, 'wiki/kasse-runden.md')), ['project_shop_kasse', 'wiki/zahlen-pruefen']);
  }

  async function pfade() {
    const v = kopie();
    for (const p of ['../x.md', 'wiki/../../x.md', 'C:/x.md', '\\\\server\\x.md', '/etc/x.md', '.obsidian/x.md', 'wiki/.git/x.md', 'wiki/kasse-runden.txt', 'wiki/x\u0000.md', '', 'wiki//x.md']) {
      assert.strictEqual(status(() => vault.sicher(v, p)), 400, 'nicht abgewiesen: ' + JSON.stringify(p));
    }
    assert.ok(vault.sicher(v, 'wiki/kasse-runden.md').endsWith(path.join('wiki', 'kasse-runden.md')));
    assert.ok(vault.sicher(v, 'wiki\\kasse-runden.md').endsWith('kasse-runden.md'));
  }

  async function gruppen() {
    const v = kopie();
    const g = vault.gruppenAus(v, []);
    assert.strictEqual(g.quelle, 'obsidian');
    assert.deepStrictEqual(g.gruppen.map((x) => x.query), ['tag:#shop', 'path:wiki']);
    assert.ok(g.gruppen.every((x) => /^#[0-9a-f]{6}$/.test(x.farbe)));
    // Erste Regel gewinnt: Wiki-Notiz mit Tag shop -> tag:#shop.
    assert.strictEqual(vault.gruppeVon({ pfad: 'wiki/kasse-runden.md', ordner: 'wiki', tags: ['shop'] }, g.gruppen).id, 'tag:#shop');
    assert.strictEqual(vault.gruppeVon({ pfad: 'wiki/zahlen-pruefen.md', ordner: 'wiki', tags: [] }, g.gruppen).id, 'path:wiki');
    assert.deepStrictEqual(vault.gruppeVon({ pfad: 'raw/quelle.md', ordner: 'raw', tags: [] }, g.gruppen), { id: 'ordner:raw', farbe: null });
    assert.strictEqual(vault.gruppenAus(v, [{ query: 'path:raw', farbe: '#112233' }]).quelle, 'eigene');
    fs.rmSync(path.join(v, '.obsidian'), { recursive: true });
    assert.deepStrictEqual(vault.gruppenAus(v, []), { quelle: 'ordner', gruppen: [] });
  }

  async function quellenGlob() {
    assert.ok(vault.regel('vault-health-JJJJ-MM-TT').test('vault-health-2026-07-09'));
    assert.ok(!vault.regel('vault-health-JJJJ-MM-TT').test('vault-health-x'));
    assert.ok(vault.regel('reports/*-c2invoice').test('reports/2026-09-c2invoice'));
    assert.ok(!vault.regel('*-c2invoice').test('reports/2026-09-c2invoice'), '* darf kein / ueberspringen');
    assert.ok(vault.regel('a.b').test('a.b') && !vault.regel('a.b').test('axb'), 'Punkt nicht woertlich');
    assert.strictEqual(status(() => vault.regel('a*b*c*d*')), 400);
    assert.strictEqual(status(() => vault.regel('')), 400);
  }

  async function index() {
    const v = kopie();
    const db = neueDb();
    const r = vault.indexiere(db, v);
    // 13 .md im Fixture, ohne scripts/ und docs/.
    assert.deepStrictEqual(r, { neu: 13, geaendert: 0, entfernt: 0, gesamt: 13 });
    const pfade = vault.notizen(db).map((n) => n.pfad);
    assert.ok(pfade.includes('Briefings/reports/2026-09-c2invoice.md') && pfade.includes('index.md'));
    assert.ok(!pfade.some((p) => /^(scripts|docs|\.obsidian)\//.test(p)), 'Ausschluss greift nicht');
    const stand = getMeta(db, 'vault_index_stand');
    assert.deepStrictEqual(vault.indexiere(db, v), { neu: 0, geaendert: 0, entfernt: 0, gesamt: 13 });
    assert.strictEqual(getMeta(db, 'vault_index_stand'), stand, 'zweiter Lauf ohne Aenderung zaehlt den Stand hoch');
  }

  async function indexAenderung() {
    const v = kopie();
    const db = neueDb();
    const f = path.join(v, 'wiki', 'zahlen-pruefen.md');
    // Ganze Sekunden: so laesst sich dieselbe mtime nach dem Schreiben exakt wiederherstellen.
    fs.utimesSync(f, 1790000000, 1790000000);
    vault.indexiere(db, v);
    const vorher = fs.statSync(f).mtimeMs;
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8') + '\nNeu: [[kasse-runden]]\n');
    fs.utimesSync(f, 1790000000, 1790000000);
    assert.strictEqual(fs.statSync(f).mtimeMs, vorher, 'Testaufbau: mtime nicht zurueckgesetzt');
    assert.strictEqual(vault.indexiere(db, v).geaendert, 1, 'andere Groesse bei gleicher mtime nicht erkannt');
    assert.ok(vault.notizen(db).find((n) => n.pfad === 'wiki/zahlen-pruefen.md').links.includes('kasse-runden'));
    fs.rmSync(path.join(v, 'raw', 'quelle.md'));
    assert.strictEqual(vault.indexiere(db, v).entfernt, 1);
    assert.ok(!vault.notizen(db).some((n) => n.pfad === 'raw/quelle.md'));
  }

  const dienst = (v, db, mehr = {}) => gedaechtnis.erzeuge({ db, vaultPfad: () => v, abrechnung: () => ({}), ...mehr });

  async function graph() {
    const v = kopie();
    const db = neueDb();
    const g = dienst(v, db);
    g.indexiere();
    const r = g.graph();
    assert.strictEqual(r.vault, 'vault');
    const id = (p) => r.knoten.findIndex((k) => k.id === p);
    const hat = (a, b) => r.kanten.some(([x, y]) => (x === id(a) && y === id(b)) || (x === id(b) && y === id(a)));
    assert.ok(hat('wiki/kasse-runden.md', 'memory/project_shop_kasse.md'), 'Alias-Link fehlt');
    assert.ok(hat('wiki/kasse-runden.md', 'wiki/zahlen-pruefen.md'), 'Praefix-Link fehlt');
    assert.ok(hat('index.md', 'wiki/kasse-runden.md'));
    assert.strictEqual(r.knoten[id('raw/quelle.md')].waise, true);
    assert.strictEqual(r.knoten[id('memory/project_shop_kasse.md')].g, 'tag:#shop');
    assert.strictEqual(r.gruppen[0].id, 'tag:#shop', 'Regeln nicht in ihrer Reihenfolge');
    assert.ok(r.gruppen.some((x) => x.id === 'ordner:raw' && x.farbe === null));
    assert.strictEqual(g.graph(), r, 'Graph nicht gecacht');
  }

  async function suche() {
    const v = kopie();
    const db = neueDb();
    // Tag + Text ohne Titel (3 Punkte) muss hinter einem Titeltreffer mit Text (4) stehen.
    fs.writeFileSync(path.join(v, 'raw', 'viel-text.md'), ['---', 'tags: [kasse]', '---', '', 'Notiz mit kasse nur im Text.', ''].join('\n'));
    const g = dienst(v, db);
    g.indexiere();
    const r = await g.suche('kasse');
    assert.ok(r.treffer.length >= 2);
    // „kasse“ steht in zahlen-pruefen nur im Text: Titeltreffer muessen davor stehen.
    const imTitel = r.treffer.map((t) => /kasse/i.test(t.titel));
    assert.ok(imTitel[0] && imTitel[1], 'Titeltreffer nicht vorn');
    assert.ok(imTitel.indexOf(false) > imTitel.lastIndexOf(true), 'Texttreffer vor einem Titeltreffer');
    assert.ok(r.treffer.some((t) => t.pfad === 'wiki/zahlen-pruefen.md'), 'Texttreffer fehlt');
    assert.ok(r.treffer.length <= 7);
    assert.deepStrictEqual((await g.suche('x')).treffer, []);
    assert.strictEqual(r.antwort, null);
  }

  async function notiz() {
    const v = kopie();
    const db = neueDb();
    db.prepare(`INSERT INTO events (request_id, ts, session_id, project, ticket, model, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, cost_usd, day)
      VALUES ('r1', '2026-10-01T10:00:00Z', '11111111-2222-4333-8444-555555555555', 'Shop', 'SHOP-7', 'claude-opus-5', 1000, 200, 0, 0, 500, 0.5, '2026-10-01')`).run();
    const g = dienst(v, db, { abrechnung: () => ({ 'SHOP-7': { nummern: ['R-2026-001'] } }) });
    g.indexiere();
    const n = g.notiz('memory/project_shop_kasse.md');
    assert.strictEqual(n.titel, 'project-shop-kasse');
    assert.deepStrictEqual(n.tags, ['shop', 'kasse']);
    assert.strictEqual(n.bezug.vorgang, 'SHOP-7');
    assert.deepStrictEqual(n.bezug.rechnungen, ['R-2026-001']);
    assert.strictEqual(n.bezug.tokens, 1700);
    assert.ok(n.bezug.kosten_eur > 0 && n.bezug.kosten_eur < 1, 'Kosten unplausibel');
    assert.deepStrictEqual(n.links.map((x) => x.pfad), ['wiki/kasse-runden.md']);
    assert.deepStrictEqual(n.rueck.map((x) => x.pfad), ['wiki/kasse-runden.md']);
    assert.ok(n.obsidian.startsWith('obsidian://open?vault=vault&file=memory%2Fproject_shop_kasse'));
    assert.strictEqual(status(() => g.notiz('../x.md')), 400);
    assert.strictEqual(status(() => g.notiz('wiki/fehlt.md')), 404);
    assert.strictEqual(g.notiz('wiki/zahlen-pruefen.md').bezug, null);
  }

  async function ohneVault() {
    const db = neueDb();
    const g = gedaechtnis.erzeuge({ db, vaultPfad: () => null });
    assert.deepStrictEqual(g.indexiere(), { neu: 0, geaendert: 0, entfernt: 0, gesamt: 0 });
    assert.strictEqual(g.graph().vault, null);
    assert.deepStrictEqual(g.graph().knoten, []);
    assert.deepStrictEqual((await g.suche('kasse')).treffer, []);
    assert.strictEqual(status(() => g.notiz('wiki/kasse-runden.md')), 404);
  }

  async function ausText() {
    const cira = require('../../cira');
    const db = neueDb();
    await mitConfig({ ...LOKAL, cira: { modellText: 'text:1b' } }, async () => {
      const c = chat('Es sind 42 Einträge.\nDie Kasse rundet je Position.');
      const d = cira.erzeuge({ db, bucheVorgang: () => {}, fetchFn: c.fn, claudeExe: 'nie.exe' });
      const r = await d.ausText({ auftrag: 'Fasse zusammen.', text: 'Die Kasse rundet je Position. Drei Positionen.' });
      assert.strictEqual(r.text, 'Die Kasse rundet je Position.', 'Satz mit fremder Zahl nicht gestrichen');
      assert.strictEqual(r.gestrichen, 1);
      assert.match(c.anfragen[0].messages[1].content, /TEXT:\nDie Kasse/);
      assert.match(c.anfragen[0].messages[0].content, /nur, was im TEXT steht/);
    });
    await mitConfig({ ...LOKAL, cira: {} }, async () => {
      const d = cira.erzeuge({ db, bucheVorgang: () => {}, fetchFn: () => { throw new Error('nie'); }, claudeExe: 'nie.exe' });
      assert.ok((await d.ausText({ auftrag: 'x', text: 'y' })).fehlt);
    });
  }

  async function einstellungen() {
    const srv = require('../../server.js');
    await configGeschuetzt(() => {
      const datei = () => fs.readFileSync(CFG, 'utf8');
      const vorher = datei();
      for (const [d, re] of [
        [{ gruppen: 'tag:#shop rot' }, /Gruppen, Zeile 1/],
        [{ gruppen: Array.from({ length: 31 }, (_, i) => 'path:p' + i + ' #112233').join('\n') }, /höchstens 30/],
        [{ quellen: 'a*b*c*d* | X' }, /Quellen, Zeile 1/],
        [{ quellen: 'x | ' }, /Name/],
        [{ quellen: 'x | Y | blau' }, /Farbe/],
        [{ briefingsOrdner: 'Anders' }, /nur in config\.json/],
        [{ unbekannt: 1 }, /Unbekanntes Feld/],
        [{ gruppen: 'x'.repeat(4001) }, /4000/],
      ]) {
        assert.throws(() => srv.setzeVault(d), re);
        assert.strictEqual(datei(), vorher, 'config.json trotz Fehler geaendert: ' + JSON.stringify(d).slice(0, 40));
      }
      const r = srv.setzeVault({ gruppen: 'tag:#shop #CD7713\n\npath:wiki #52e0b1', quellen: 'notizen-* | Woche | #123456\nvault-health-JJJJ-MM-TT | Vault' });
      assert.strictEqual(r.gruppen, 'tag:#shop #cd7713\npath:wiki #52e0b1');
      const roh = JSON.parse(datei());
      assert.deepStrictEqual(roh.vault.gruppen, [{ query: 'tag:#shop', farbe: '#cd7713' }, { query: 'path:wiki', farbe: '#52e0b1' }]);
      assert.deepStrictEqual(roh.vault.quellen[1], { muster: 'vault-health-JJJJ-MM-TT', name: 'Vault', farbe: null });
      // Leer = Standard.
      srv.setzeVault({ gruppen: '' });
      assert.deepStrictEqual(JSON.parse(datei()).vault.gruppen, []);
    });
  }

  async function arbeitsbereichTag() {
    const srv = require('../../server.js');
    const cfg = require(CFG);
    await configGeschuetzt(() => {
      cfg.arbeitsbereiche = [{ name: 'Shop', kuerzel: 'SH', farbe: '#112233', art: 'projekt', pfad: '~/x' }];
      fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2));
      assert.throws(() => srv.setzeArbeitsbereich({ name: 'Shop', tag: 'mit leerzeichen' }), /Tag: ungueltig/);
      assert.strictEqual(srv.setzeArbeitsbereich({ name: 'Shop', tag: 'shop/kasse' }).arbeitsbereich.tag, 'shop/kasse');
      assert.strictEqual(JSON.parse(fs.readFileSync(CFG, 'utf8')).arbeitsbereiche[0].tag, 'shop/kasse');
      assert.strictEqual(srv.setzeArbeitsbereich({ name: 'Shop', tag: '' }).arbeitsbereich.tag, null);
      assert.ok(!('tag' in JSON.parse(fs.readFileSync(CFG, 'utf8')).arbeitsbereiche[0]));
    });
  }

  return [
    ['C9b Einstellungen Vault: Grenzen, Format, Rueckweg', einstellungen],
    ['C9b Arbeitsbereich-Tag: Leerzeichen abgelehnt, leer loescht', arbeitsbereichTag],
    ['C9b Frontmatter: beide Schemata, Tags Spalte 0 vor verschachtelt, kaputtes Frontmatter wirft nicht', frontmatterTest],
    ['C9b Wikilinks: Alias, Teil, Ordner-Praefix, Codeblock', wikilinks],
    ['C9b Pfade: .., Laufwerk, UNC, .obsidian, ohne .md -> 400', pfade],
    ['C9b Gruppen aus graph.json, erste Regel gewinnt', gruppen],
    ['C9b Quellen-Glob', quellenGlob],
    ['C9b Index: alle .md ausser Ausschluss, zweiter Lauf schreibt nichts', index],
    ['C9b Index: gleiche mtime, andere Groesse wird erkannt; geloeschte Datei fliegt raus', indexAenderung],
    ['C9b Graph: Kanten ueber Alias und Praefix, Waise, Gruppe', graph],
    ['C9b Suche: Titeltreffer schlaegt Texttreffer', suche],
    ['C9b Notiz: Ledger-Bezug ueber originSessionId, ../ -> 400, fehlt -> 404', notiz],
    ['C9b Ohne Vault-Arbeitsbereich: Leerzustand, keine Route wirft', ohneVault],
    ['C9b ausText: Zahl nicht im Text wird gestrichen, ohne Modell fehlt', ausText],
  ];
};
