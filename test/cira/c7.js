'use strict';
// Masterplan 3.0, Block C7a (Board). Entwurf design/cira/C7-BOARD.md, Plan
// design/cira/C7A-PLAN.md. Owner 20.10.2026: TODO.md im Einzeiler-Format,
// @id nur bei Aktion, Lesen schreibt nie, Jira ist die Wahrheit.
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = ({ dbmod, openDbs } = {}) => {
  const board = require('../../board');
  const metrics = require('../../metrics');
  const rechnung = require('../../rechnung');
  const kontakte = require('../../kontakte');
  const zeit = require('../../zeit');
  const cira = require('../../cira');

  const tagVon = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const nah = (a, b, text) => assert.ok(Math.abs(a - b) < 0.005, text + ': ' + a + ' statt ' + b);
  // Wie test/cira/c4.js: eine Stunde Arbeit je Aufruf, Projekt "Kunde".
  function arbeitsDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const insE = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, cwd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insA = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)');
    let n = 0;
    const stunde = (session, beginn, ticket) => {
      for (let m = 0; m <= 60; m += 3) {
        const ts = new Date(beginn + m * 60000).toISOString();
        insE.run('c7-' + n++, ts, session, 'Kunde', 'main', ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, ts.slice(0, 10), null);
        insA.run(session, ts, 'Kunde', 'main', ticket, ts.slice(0, 10), 1);
      }
    };
    const h = new Date();
    const um = (stundeNr, tage = 0) => new Date(h.getFullYear(), h.getMonth(), h.getDate() - tage, stundeNr, 0).getTime();
    return { db, stunde, um };
  }
  const RECHNUNG = {
    rechnung: { aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '' },
      kleinunternehmer: false, ustSatz: 19, zahlungszielTage: 14, chromePfad: '' },
    vergleichsFaktor: 0, selbstkostenStunde: 30,
  };
  async function mitConfig(werte, fn) {
    const cfg = require('../../config.json');
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, v] of Object.entries(werte)) cfg[k] = JSON.parse(JSON.stringify(v));
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  const mitKunde = (db) => kontakte.speichere(db, { firma: 'Testkunde GmbH', anschrift: ['Weg 1', '12345 Ort'], projekte: ['Kunde'] });
  // Jira-Attrappe: antwortet je Pfad aus routen, protokolliert jeden Aufruf.
  // Jeder Test bekommt eine eigene Basis-URL (Feld-IDs werden je URL gemerkt).
  let jiraNr = 0;
  async function mitJira(routen, fn) {
    const altFetch = globalThis.fetch;
    const altToken = process.env.JIRA_API_TOKEN;
    const aufrufe = [];
    const basis = 'https://jira' + (++jiraNr) + '.test';
    globalThis.fetch = async (url, opt = {}) => {
      const u = new URL(url);
      const body = opt.body ? JSON.parse(opt.body) : null;
      aufrufe.push({ methode: opt.method || 'GET', pfad: u.pathname, query: Object.fromEntries(u.searchParams), body });
      const r = routen(opt.method || 'GET', u.pathname, u.searchParams, body);
      if (r instanceof Error) throw r;
      const status = r && r.status ? r.status : 200;
      const daten = r && r.status ? r.daten : r;
      return { ok: status < 400, status, json: async () => daten, text: async () => JSON.stringify(daten || '') };
    };
    process.env.JIRA_API_TOKEN = 'test-token';
    try {
      return await mitConfig({ jira: { enabled: true, baseUrl: basis, email: 'a@b.test', tokenEnvVar: 'C2I_TEST_UNGESETZT', projectKeys: ['DEV'] } }, () => fn(aufrufe, basis));
    } finally {
      globalThis.fetch = altFetch;
      if (altToken === undefined) delete process.env.JIRA_API_TOKEN; else process.env.JIRA_API_TOKEN = altToken;
    }
  }
  const FELDER = [{ id: 'customfield_10020', name: 'Sprint' }, { id: 'customfield_10016', name: 'Story point estimate' }, { id: 'summary', name: 'Summary' }];
  const issue = (key, status, kat, extra = {}) => ({ key, fields: {
    summary: 'Titel ' + key, status: { name: status, statusCategory: { key: kat } }, issuetype: { name: 'Task' },
    assignee: { displayName: 'Ada Lind' }, reporter: { displayName: 'Bo Berg' }, priority: { name: 'High' }, labels: ['x'], updated: '2026-10-19T10:00:00.000+0200',
    customfield_10020: [{ name: 'Sprint 7', state: 'active' }], customfield_10016: 3,
    description: { type: 'doc', version: 1, content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Beschreibung ' + key }] },
      { type: 'taskList', content: [
        { type: 'taskItem', attrs: { state: 'DONE' }, content: [{ type: 'text', text: 'Krit A' }] },
        { type: 'taskItem', attrs: { state: 'TODO' }, content: [{ type: 'text', text: 'Krit B' }] }] }] },
    ...extra } });
  const jiraDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  const jiraDienst = (db, uhr) => board.erzeuge({ db, bereiche: () => [], loeseHeim: (p) => p, gesperrt: () => ['DEV'], jetzt: () => uhr.t });

  // Board-Fixture: Arbeitsbereich "Proj" mit TODO.md und Jira-Projekt DEV,
  // Arbeit auf P-1 (In Arbeit), P-2 (erledigt, offen), DEV-1 und DEV-9 (Done, offen).
  const TODO = '# Proj\r\n- [ ] Lokal eins @id:P-1 @status:in-progress\r\n- [x] Lokal fertig @id:P-2\r\n- [x] Alt fertig @id:P-3\r\n- [ ] Ohne ID\r\n  - [ ] Krit X\r\n- [ ] Mit Jira @jira:DEV-1 @id:P-4\r\n';
  function boardFixture(uhr = { t: Date.now() }) {
    const { db, stunde } = arbeitsDb();
    const t0 = Date.now() - 30 * 3600e3;
    stunde('b-1', t0, 'P-1');
    stunde('b-2', t0 + 2 * 3600e3, 'P-2');
    stunde('b-3', t0 + 4 * 3600e3, 'DEV-1');
    stunde('b-4', t0 + 6 * 3600e3, 'DEV-9');
    const d = ordner();
    const datei = path.join(d, 'TODO.md');
    fs.writeFileSync(datei, TODO);
    const x = board.erzeuge({ db, bereiche: () => [{ name: 'Proj', pfad: d, kuerzel: 'PR', jiraProjekt: 'DEV' }], loeseHeim: (p) => p, gesperrt: () => ['DEV'], jetzt: () => uhr.t });
    return { db, x, datei, uhr, stunde };
  }
  // Jira mit DEV-1 (To Do), DEV-2 (In Progress), DEV-9 (Done); Transitions und Kommentare.
  const jiraRouten = (stand = {}) => (m, p, q, body) => {
    if (p === '/rest/api/3/field') return FELDER;
    if (p === '/rest/api/3/search/jql') {
      if (/statusCategory != Done/.test(q.get('jql'))) return { issues: [issue('DEV-1', stand['DEV-1'] || 'To Do', 'new'), issue('DEV-2', 'In Progress', 'indeterminate')] };
      return { issues: /DEV-9/.test(q.get('jql')) ? [issue('DEV-9', 'Done', 'done')] : [] };
    }
    const t = p.match(/^\/rest\/api\/3\/issue\/(DEV-\d+)\/transitions$/);
    if (t && m === 'GET') return { transitions: stand.transitions || [
      { id: '11', name: 'Start', to: { name: 'In Progress', statusCategory: { key: 'indeterminate' } } },
      { id: '21', name: 'Review', to: { name: 'In Review', statusCategory: { key: 'indeterminate' } } },
      { id: '31', name: 'Fertig', to: { name: 'Done', statusCategory: { key: 'done' } } }] };
    if (t && m === 'POST') return { status: 204, daten: null };
    if (/^\/rest\/api\/3\/issue\/DEV-\d+\/comment$/.test(p) && m === 'POST') return { id: '9001' };
    return { status: 404, daten: {} };
  };
  const karteVon = (b, key) => Object.values(b.spalten).flatMap((s) => s.karten).find((k) => k.schluessel === key);
  const posts = (aufrufe) => aufrufe.filter((a) => a.methode === 'POST');

  const ciraNetto = async (db, key) => {
    const d = cira.erzeuge({ db, bucheVorgang: () => {}, fetchFn: () => { throw new Error('kein Modell'); }, spawnFn: () => { throw new Error('kein Claude'); }, claudeExe: 'x.exe' });
    const a = await d.frage({ text: 'Rechnung für ' + key, kanal: 'cockpit' });
    return a.szene ? a.szene.netto : 0;
  };
  const ordner = () => fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c7-'));
  const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  // Dienst nur mit Dateien: Pfade gelten wie eingetragen, Jira aus.
  const dienstMit = (bereiche) => board.erzeuge({ db: null, bereiche: () => bereiche, loeseHeim: (p) => p || null, gesperrt: () => ['DEV'] });

  const FIX = [
    '# Projekt',
    '',
    '## Kopf',
    '- [ ] A @id:JRV-1 @status:in-progress @prio:wichtig',
    '  - [x] Krit 1',
    '  - [ ] Krit 2',
    '- [x] B @status:done',
    '- [ ] C @status:blocked',
    'freier Text',
    '',
  ].join('\n');

  const fehlerStatus = (fn) => { try { fn(); } catch (e) { return e.status; } return null; };

  return [
    ['C7 parse: Einzeiler mit Tags, Kriterien, Ueberschriften sind keine Karten', () => {
      const p = board.parseTodo(FIX);
      assert.strictEqual(p.karten.length, 3);
      const [a, b, c] = p.karten;
      assert.strictEqual(a.text, 'A');
      assert.strictEqual(a.id, 'JRV-1');
      assert.strictEqual(a.spalte, 'arbeit');
      assert.strictEqual(a.prio, 'wichtig');
      assert.strictEqual(a.zeile, 3);
      assert.deepStrictEqual(a.kriterien.map((k) => [k.text, k.erledigt, k.zeile]), [['Krit 1', true, 4], ['Krit 2', false, 5]]);
      assert.strictEqual(b.spalte, 'erledigt');
      assert.strictEqual(c.spalte, 'offen');
      assert.strictEqual(c.status, 'blocked');
      assert.strictEqual(p.eol, '\n');
      assert.strictEqual(p.bom, false);
    }],

    ['C7 parse: @jira, review, [x] ohne Tag', () => {
      const p = board.parseTodo('- [ ] X @status:review @jira:DEV-5\n- [x] Y\n');
      assert.strictEqual(p.karten[0].spalte, 'review');
      assert.strictEqual(p.karten[0].jira, 'DEV-5');
      assert.strictEqual(p.karten[0].text, 'X');
      assert.strictEqual(p.karten[1].spalte, 'erledigt');
    }],

    ['C7 setzeStatus: CRLF + BOM + fremde Zeilen byte-gleich, gleichlautende Zeile trifft die gemeinte', () => {
      const fix = '\uFEFF# T\r\n\tfremd\r\n- [ ] A @status:todo\r\n- [ ] A\r\n';
      const p = board.parseTodo(fix);
      assert.strictEqual(p.bom, true);
      assert.strictEqual(p.eol, '\r\n');
      const zweite = p.karten[1];
      assert.strictEqual(zweite.zeile, 3);
      const neu = board.setzeStatus(fix, zweite, 'erledigt');
      assert.strictEqual(neu, '\uFEFF# T\r\n\tfremd\r\n- [ ] A @status:todo\r\n- [x] A @status:done\r\n');
      // Zurueck nach Offen: Haken weg, Tag ersetzt.
      const zurueck = board.setzeStatus(neu, board.parseTodo(neu).karten[1], 'offen');
      assert.strictEqual(zurueck, '\uFEFF# T\r\n\tfremd\r\n- [ ] A @status:todo\r\n- [ ] A @status:todo\r\n');
    }],

    ['C7 setzeStatus: vorhandenes @status ersetzt, Rest der Zeile unveraendert', () => {
      const t = '- [ ] A @id:JRV-1 @status:in-progress @prio:wichtig\n';
      assert.strictEqual(board.setzeStatus(t, board.parseTodo(t).karten[0], 'review'), '- [ ] A @id:JRV-1 @status:review @prio:wichtig\n');
    }],

    ['C7 setzeStatus: Zeile geaendert → 409', () => {
      const p = board.parseTodo(FIX);
      assert.strictEqual(fehlerStatus(() => board.setzeStatus(FIX, { ...p.karten[0], roh: '- [ ] anders' }, 'review')), 409);
      assert.strictEqual(fehlerStatus(() => board.setzeStatus(FIX, { ...p.karten[0], zeile: 99 }, 'review')), 409);
      assert.strictEqual(fehlerStatus(() => board.setzeStatus(FIX, p.karten[0], 'quatsch')), 400);
    }],

    ['C7 setzeKriterium: schaltet nur die Unterzeile', () => {
      const p = board.parseTodo(FIX);
      const k = p.karten[0].kriterien[1];
      const neu = board.setzeKriterium(FIX, k, true);
      const z = FIX.split('\n');
      z[5] = '  - [x] Krit 2';
      assert.strictEqual(neu, z.join('\n'));
      assert.strictEqual(fehlerStatus(() => board.setzeKriterium(FIX, { ...k, roh: 'x' }, true)), 409);
    }],

    ['C7 vergibId: Praefix, Nummer, Jira-Sperre', () => {
      const t = '- [ ] a @id:JRV-3\n- [ ] b @id:JRV-7\n- [ ] c\n';
      const c = board.parseTodo(t).karten[2];
      const r = board.vergibId(t, c, { kuerzel: 'JV', gesperrt: [] });
      assert.strictEqual(r.id, 'JRV-8');
      assert.strictEqual(r.text, '- [ ] a @id:JRV-3\n- [ ] b @id:JRV-7\n- [ ] c @id:JRV-8\n');
      assert.strictEqual(board.vergibId(t, c, { kuerzel: 'JV', gesperrt: ['JRV'] }).id, 'JV-1');
      assert.strictEqual(fehlerStatus(() => board.vergibId(t, c, { kuerzel: 'JV', gesperrt: ['JRV', 'JV'] })), 409);
      assert.strictEqual(fehlerStatus(() => board.vergibId('- [ ] c\n', board.parseTodo('- [ ] c\n').karten[0], { kuerzel: '', gesperrt: [] })), 409);
      // Hat die Zeile schon eine @id: unveraendert.
      const a = board.parseTodo(t).karten[0];
      assert.deepStrictEqual(board.vergibId(t, a, { kuerzel: 'JV', gesperrt: [] }), { text: t, id: 'JRV-3' });
    }],

    ['C7 Lesen schreibt nie', () => {
      const d = ordner();
      const f = path.join(d, 'TODO.md');
      fs.writeFileSync(f, FIX);
      const vorher = [hash(f), fs.statSync(f).mtimeMs];
      const x = dienstMit([{ name: 'P', pfad: d, kuerzel: 'P' }]);
      for (let i = 0; i < 3; i++) assert.strictEqual(x.lokal('P').karten.length, 3);
      assert.deepStrictEqual([hash(f), fs.statSync(f).mtimeMs], vorher);
    }],

    ['C7 Standardpfad <pfad>/TODO.md, todo ueberschreibt, Schluessel und Quelle', () => {
      const d = ordner();
      fs.writeFileSync(path.join(d, 'TODO.md'), '- [ ] eins @id:P-1\n- [ ] zwei\n- [ ] drei @jira:DEV-9 @id:P-2\n');
      fs.writeFileSync(path.join(d, 'Aufgaben.md'), '- [ ] anders\n');
      const x = dienstMit([{ name: 'P', pfad: d }, { name: 'Q', pfad: d, todo: path.join(d, 'Aufgaben.md') }]);
      const p = x.lokal('P');
      assert.strictEqual(p.datei, path.join(d, 'TODO.md'));
      assert.deepStrictEqual(p.karten.map((k) => [k.schluessel, k.quelle, k.bereich]), [['P-1', 'md', 'P'], ['P:1', 'md', 'P'], ['DEV-9', 'md', 'P']]);
      assert.deepStrictEqual(x.lokal('Q').karten.map((k) => k.text), ['anders']);
    }],

    ['C7 Bereich ohne Pfad / ohne Datei → leer mit Hinweis, unbekannt → 404', () => {
      const d = ordner();
      const x = dienstMit([{ name: 'Ohne' }, { name: 'Leer', pfad: d }, { name: 'Falsch', pfad: d, todo: path.join(d, 'Tippfehler.md') }]);
      for (const n of ['Ohne', 'Falsch']) {
        const r = x.lokal(n);
        assert.deepStrictEqual(r.karten, []);
        assert.ok(r.hinweis && r.hinweis.length > 5, n + ': Hinweis fehlt');
      }
      // Standardpfad ohne Datei ist normal (nicht jeder Ordner fuehrt eine TODO.md): kein Hinweis,
      // sonst stuende fuer jeden Arbeitsbereich ein roter Fehler im Kopf. Eingetragenes todo fehlt = Fehler.
      const leer = x.lokal('Leer');
      assert.deepStrictEqual([leer.karten, leer.hinweis, leer.datei], [[], null, null]);
      assert.strictEqual(fehlerStatus(() => x.lokal('Gibtsnicht')), 404);
    }],

    ['C7 schreibeZeile: genau eine Zeile, Datei extern geaendert → 409 und unveraendert', () => {
      const d = ordner();
      const f = path.join(d, 'TODO.md');
      fs.writeFileSync(f, '\uFEFF# T\r\n- [ ] A\r\n- [ ] B\r\n');
      const x = dienstMit([{ name: 'P', pfad: d }]);
      const b = x.lokal('P').karten[1];
      x.schreibeZeile('P', b, (text) => board.setzeStatus(text, b, 'arbeit'));
      assert.strictEqual(fs.readFileSync(f, 'utf8'), '\uFEFF# T\r\n- [ ] A\r\n- [ ] B @status:in-progress\r\n');
      assert.deepStrictEqual(fs.readdirSync(d), ['TODO.md'], 'Temp-Datei liegt noch herum');
      // Extern eine Zeile oben eingefuegt: die alte Zeilennummer zeigt jetzt woanders hin.
      const alt = x.lokal('P').karten[0];
      fs.writeFileSync(f, '# neu\r\n' + fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
      const extern = hash(f);
      assert.strictEqual(fehlerStatus(() => x.schreibeZeile('P', alt, (text) => board.setzeStatus(text, alt, 'review'))), 409);
      assert.strictEqual(hash(f), extern);
    }],

    ['C7 offen: ungestellt = Cira-Entwurf, voll gestellt = 0, unbekannt = 0', async () => {
      const { db, stunde, um } = arbeitsDb();
      await mitConfig(RECHNUNG, async () => {
        stunde('s-1', Date.now() - 6 * 3600e3, 'ABC-1');
        const k = mitKunde(db);
        const o = rechnung.offenJeVorgang(db, ['ABC-1', 'XYZ-9']);
        assert.ok(o['ABC-1'] > 0, 'nichts offen');
        nah(o['ABC-1'], await ciraNetto(db, 'ABC-1'), 'offen = Cira-Entwurf');
        assert.strictEqual(o['XYZ-9'], 0);
        const t = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-1');
        rechnung.erstelle(db, { from: t.first_day, to: t.last_day, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
        assert.strictEqual(rechnung.offenJeVorgang(db, ['ABC-1'])['ABC-1'], 0);
      });
    }],

    ['C7 offen: teilweise gestellt = nur die neue Zeit, offene manuelle Zeit zaehlt mit', async () => {
      const { db, stunde, um } = arbeitsDb();
      await mitConfig(RECHNUNG, async () => {
        stunde('s-alt', um(9, 3), 'ABC-1');
        stunde('s-neu', Date.now() - 6 * 3600e3, 'ABC-1');
        const k = mitKunde(db);
        const bis = tagVon(new Date(um(9, 3)));
        const t = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-1');
        const gesamt = rechnung.offenJeVorgang(db, ['ABC-1'])['ABC-1'];
        rechnung.erstelle(db, { from: t.first_day, to: bis, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
        const teil = rechnung.offenJeVorgang(db, ['ABC-1'])['ABC-1'];
        assert.ok(teil > 0 && teil < gesamt - 1, 'teilweise: ' + teil + ' von ' + gesamt);
        nah(teil, await ciraNetto(db, 'ABC-1'), 'offen = Cira-Entwurf (teilweise)');
        // Manuelle Zeit, 1,5 h bis vor 3 h (nie in der Zukunft, auch kurz nach Mitternacht): kommt dazu.
        const von = new Date(Date.now() - 3 * 3600e3 - 90 * 60000);
        zeit.speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'ABC-1', start: von.toISOString(), ende: new Date(von.getTime() + 90 * 60000).toISOString(),
          pause_min: 0, taetigkeit: 'Entwicklung', notiz: 'x', abrechenbar: true });
        const mit = rechnung.offenJeVorgang(db, ['ABC-1'])['ABC-1'];
        assert.ok(mit > teil, 'manuelle Zeit fehlt: ' + mit);
        nah(mit, await ciraNetto(db, 'ABC-1'), 'offen = Cira-Entwurf (mit manueller Zeit)');
      });
    }],

    ['C7 Jira: JQL offen + Done-Keys, Paging, Feld-IDs nach Namen, Abbildung', async () => {
      const jira = require('../../jira-sync');
      await mitJira((m, p, q) => {
        if (p === '/rest/api/3/field') return FELDER;
        if (p === '/rest/api/3/search/jql') {
          if (/statusCategory != Done/.test(q.get('jql'))) {
            return q.get('nextPageToken') ? { issues: [issue('DEV-2', 'In Review', 'indeterminate')] } : { issues: [issue('DEV-1', 'To Do', 'new')], nextPageToken: 'n2' };
          }
          return { issues: [issue('DEV-9', 'Done', 'done')] };
        }
        return { status: 404, daten: {} };
      }, async (aufrufe) => {
        const liste = await jira.holeIssues('DEV', { doneKeys: ['DEV-9'] });
        assert.deepStrictEqual(liste.map((i) => [i.key, i.status, i.statusKat]), [['DEV-1', 'To Do', 'new'], ['DEV-2', 'In Review', 'indeterminate'], ['DEV-9', 'Done', 'done']]);
        const s = aufrufe.filter((a) => a.pfad === '/rest/api/3/search/jql');
        assert.strictEqual(s.length, 3);
        assert.ok(/^project = "DEV" AND statusCategory != Done/.test(s[0].query.jql), s[0].query.jql);
        assert.strictEqual(s[1].query.nextPageToken, 'n2');
        assert.ok(/key in \(DEV-9\)/.test(s[2].query.jql), s[2].query.jql);
        assert.ok(s[0].query.fields.includes('customfield_10020') && s[0].query.fields.includes('customfield_10016'), s[0].query.fields);
        const a = liste[0];
        assert.deepStrictEqual([a.titel, a.typ, a.zugewiesen, a.gemeldet, a.prio, a.sprint, a.punkte, a.projekt], ['Titel DEV-1', 'Task', 'Ada Lind', 'Bo Berg', 'High', 'Sprint 7', 3, 'DEV']);
        assert.deepStrictEqual(a.kriterien, [{ text: 'Krit A', erledigt: true }, { text: 'Krit B', erledigt: false }]);
        assert.strictEqual(a.beschreibung, 'Beschreibung DEV-1');
        // Feld-IDs nur einmal je Jira-Instanz.
        await jira.holeIssues('DEV', { doneKeys: [] });
        assert.strictEqual(aufrufe.filter((x) => x.pfad === '/rest/api/3/field').length, 1);
      });
    }],

    ['C7 Jira: Spalten-Abbildung nach Name, sonst Kategorie', () => {
      assert.deepStrictEqual([['To Do', 'new'], ['In Progress', 'indeterminate'], ['In Review', 'indeterminate'], ['Code Review', 'indeterminate'], ['Blocked', 'indeterminate'], ['Done', 'done'], ['Backlog', 'new']]
        .map(([s, k]) => board.jiraSpalte(s, k)), ['offen', 'arbeit', 'review', 'review', 'arbeit', 'erledigt', 'offen']);
    }],

    ['C7 Jira: Cache 120 s, danach neu; Statuswechsel sendet jira_status', async () => {
      const ereignisse = require('../../ereignisse');
      let status = 'To Do';
      await mitJira((m, p) => (p === '/rest/api/3/field' ? FELDER : { issues: [issue('DEV-1', status, status === 'To Do' ? 'new' : 'indeterminate')] }), async (aufrufe) => {
        const db = jiraDb();
        const uhr = { t: 1_000_000 };
        const x = jiraDienst(db, uhr);
        const gesehen = [];
        const hoerer = (e) => { if (e.art === 'jira_status') gesehen.push(e.daten); };
        ereignisse.bus.on('ereignis', hoerer);
        try {
          const suche = () => aufrufe.filter((a) => a.pfad === '/rest/api/3/search/jql').length;
          const r1 = await x.jiraKarten('DEV', []);
          assert.strictEqual(r1.karten[0].spalte, 'offen');
          assert.strictEqual(r1.stand.fehler, null);
          assert.strictEqual(suche(), 1);
          status = 'In Progress';
          uhr.t += 60_000;
          const r2 = await x.jiraKarten('DEV', []);
          assert.strictEqual(suche(), 1, 'innerhalb 120 s neu geholt');
          assert.strictEqual(r2.karten[0].spalte, 'offen', 'Cache liefert alten Stand');
          assert.deepStrictEqual(gesehen, []);
          uhr.t += 61_000;
          const r3 = await x.jiraKarten('DEV', []);
          assert.strictEqual(suche(), 2);
          assert.strictEqual(r3.karten[0].spalte, 'arbeit');
          assert.deepStrictEqual(gesehen, [{ key: 'DEV-1', von: 'To Do', nach: 'In Progress' }]);
          assert.strictEqual(db.prepare('SELECT status FROM jira_issue WHERE key = ?').get('DEV-1').status, 'In Progress');
        } finally { ereignisse.bus.off('ereignis', hoerer); }
      });
    }],

    // Block L (Owner 20.10.): das Board wartet nicht auf Jira, wenn es einen Stand hat.
    ['C7 Jira: Board zeigt veralteten Cache sofort, Abgleich im Hintergrund meldet jira_cache', async () => {
      const ereignisse = require('../../ereignisse');
      let status = 'To Do';
      await mitJira((m, p) => (p === '/rest/api/3/field' ? FELDER : { issues: [issue('DEV-1', status, status === 'To Do' ? 'new' : 'indeterminate')] }), async (aufrufe) => {
        const db = jiraDb();
        const uhr = { t: 2_000_000 };
        const x = jiraDienst(db, uhr);
        const gesehen = [];
        const hoerer = (e) => { if (e.art === 'jira_cache') gesehen.push(e.daten); };
        ereignisse.bus.on('ereignis', hoerer);
        try {
          await x.jiraKarten('DEV', [], { hintergrund: true });
          assert.strictEqual(gesehen.length, 0, 'erster Abruf ohne Cache wartet und meldet nichts');
          status = 'In Progress';
          uhr.t += 200_000;
          const r = await x.jiraKarten('DEV', [], { hintergrund: true });
          assert.strictEqual(r.karten[0].spalte, 'offen', 'Board wartet auf Jira statt den Cache zu zeigen');
          assert.ok(r.nachzug, 'kein Abgleich im Hintergrund gestartet');
          const zweiter = await x.jiraKarten('DEV', [], { hintergrund: true });
          assert.strictEqual(zweiter.nachzug, r.nachzug, 'zweiter Abgleich parallel gestartet');
          await r.nachzug;
          assert.deepStrictEqual(gesehen, [{ projekt: 'DEV' }]);
          assert.strictEqual((await x.jiraKarten('DEV', [], { hintergrund: true })).karten[0].spalte, 'arbeit');
          assert.strictEqual(aufrufe.filter((a) => a.pfad === '/rest/api/3/search/jql').length, 2);
        } finally { ereignisse.bus.off('ereignis', hoerer); }
      });
    }],

    ['C7 Jira: Abgleich ohne Aenderung schreibt nichts und gilt danach als frisch', async () => {
      const ereignisse = require('../../ereignisse');
      await mitJira((m, p) => (p === '/rest/api/3/field' ? FELDER : { issues: [issue('DEV-1', 'To Do', 'new')] }), async (aufrufe) => {
        const db = jiraDb();
        const uhr = { t: 3_000_000 };
        const x = jiraDienst(db, uhr);
        const gesehen = [];
        const hoerer = (e) => { if (e.art === 'jira_cache') gesehen.push(e.daten); };
        ereignisse.bus.on('ereignis', hoerer);
        try {
          await x.jiraKarten('DEV', []);
          const vor = db.prepare('SELECT total_changes() AS n').get().n;
          uhr.t += 200_000;
          const r = await x.jiraKarten('DEV', [], { hintergrund: true });
          await r.nachzug;
          assert.strictEqual(db.prepare('SELECT total_changes() AS n').get().n - vor, 0, 'unveraenderter Jira-Stand neu geschrieben');
          assert.deepStrictEqual(gesehen, [], 'jira_cache ohne Aenderung');
          uhr.t += 60_000;
          const n = aufrufe.filter((a) => a.pfad === '/rest/api/3/search/jql').length;
          const r2 = await x.jiraKarten('DEV', [], { hintergrund: true });
          assert.strictEqual(aufrufe.filter((a) => a.pfad === '/rest/api/3/search/jql').length, n, 'innerhalb 120 s nach dem Abgleich erneut gefragt');
          assert.strictEqual(r2.stand.geholt, new Date(3_200_000).toISOString(), 'Stand zeigt den alten Abrufzeitpunkt');
        } finally { ereignisse.bus.off('ereignis', hoerer); }
      });
    }],

    ['C7 Jira: Ticket faellt aus der Abfrage (erledigt ohne offene Zeit) → verschwindet aus dem Cache', async () => {
      let liste = [issue('DEV-1', 'To Do', 'new'), issue('DEV-2', 'To Do', 'new')];
      await mitJira((m, p) => (p === '/rest/api/3/field' ? FELDER : { issues: liste }), async () => {
        const uhr = { t: 9_000_000 };
        const x = jiraDienst(jiraDb(), uhr);
        assert.strictEqual((await x.jiraKarten('DEV', [])).karten.length, 2);
        liste = [issue('DEV-2', 'To Do', 'new')];
        uhr.t += 200_000;
        assert.deepStrictEqual((await x.jiraKarten('DEV', [])).karten.map((k) => k.key), ['DEV-2']);
      });
    }],

    ['C7 Jira: Fehler laesst den Cache stehen, stand.fehler gesetzt, kein Wurf', async () => {
      let kaputt = false;
      await mitJira((m, p) => {
        if (kaputt) return p === '/rest/api/3/field' ? FELDER : { status: 500, daten: { errorMessages: ['kaputt'] } };
        return p === '/rest/api/3/field' ? FELDER : { issues: [issue('DEV-1', 'To Do', 'new')] };
      }, async () => {
        const db = jiraDb();
        const uhr = { t: 5_000_000 };
        const x = jiraDienst(db, uhr);
        await x.jiraKarten('DEV', []);
        kaputt = true;
        uhr.t += 200_000;
        const r = await x.jiraKarten('DEV', []);
        assert.deepStrictEqual(r.karten.map((k) => k.key), ['DEV-1'], 'Cache weg');
        assert.ok(/500/.test(r.stand.fehler), String(r.stand.fehler));
        // Auch Netzfehler (Timeout) wirft nicht.
        const y = jiraDienst(jiraDb(), { t: 1 });
        const altFetch = globalThis.fetch;
        globalThis.fetch = async () => { throw new Error('The operation was aborted due to timeout'); };
        try {
          const z = await y.jiraKarten('DEV', []);
          assert.deepStrictEqual(z.karten, []);
          assert.ok(/timeout/i.test(z.stand.fehler));
        } finally { globalThis.fetch = altFetch; }
      });
    }],

    ['C7 Board: Spalten, Summen, Werte = byTicket, Quellen und Filter', async () => {
      await mitJira(jiraRouten(), async () => {
        const { db, x } = boardFixture();
        const b = await x.board('alle', 'alle');
        const zeile = (k) => metrics.byTicket(db, {}).find((r) => r.ticket === k);
        const p1 = karteVon(b, 'P-1');
        assert.deepStrictEqual([p1.quelle, p1.spalte, p1.bereich, p1.wert_art, p1.titel], ['md', 'arbeit', 'Proj', 'gesamt', 'Lokal eins']);
        nah(p1.wert_eur, zeile('P-1').arbeitswert, 'Wert P-1');
        nah(p1.stunden, zeile('P-1').active_hours, 'Stunden P-1');
        const h2 = karteVon(b, 'DEV-2');
        assert.deepStrictEqual([h2.quelle, h2.spalte, h2.wert_eur], ['jira', 'arbeit', 0]);
        for (const [n, s] of Object.entries(b.spalten)) nah(s.summe_eur, s.karten.reduce((a, k) => a + k.wert_eur, 0), 'Summe ' + n);
        assert.strictEqual(karteVon(b, 'Proj:4').titel, 'Ohne ID');
        assert.deepStrictEqual(karteVon(b, 'Proj:4').kriterien.map((k) => k.text), ['Krit X']);
        assert.deepStrictEqual(b.bereiche.map((a) => [a.name, a.jira]), [['Proj', true]]);
        assert.strictEqual(b.sync.jira.fehler, null);
        const nurLokal = await x.board('alle', 'lokal');
        assert.ok(Object.values(nurLokal.spalten).flatMap((s) => s.karten).every((k) => k.quelle !== 'jira'), 'Filter lokal');
        const nurJira = await x.board('Proj', 'jira');
        assert.ok(Object.values(nurJira.spalten).flatMap((s) => s.karten).every((k) => k.quelle !== 'md'), 'Filter jira');
        await assert.rejects(() => x.board('Gibtsnicht', 'alle'), (e) => e.status === 404);
      });
    }],

    ['C7 Board: Erledigt nur mit offener Zeit, Wert offen, Done-Keys an Jira', async () => {
      await mitJira(jiraRouten(), async (aufrufe) => {
        const { db, x } = boardFixture();
        const b = await x.board('alle', 'alle');
        const erl = b.spalten.erledigt.karten.map((k) => k.schluessel).sort();
        assert.deepStrictEqual(erl, ['DEV-9', 'P-2'], 'P-3 ohne Zeit darf nicht erscheinen');
        const p2 = karteVon(b, 'P-2');
        assert.strictEqual(p2.wert_art, 'offen');
        nah(p2.wert_eur, rechnung.offenJeVorgang(db, ['P-2'])['P-2'], 'offen P-2');
        assert.ok(aufrufe.some((a) => a.pfad === '/rest/api/3/search/jql' && /key in \([^)]*\bDEV-9\b[^)]*\) AND statusCategory = Done/.test(a.query.jql)), 'DEV-9 nicht gezielt geholt');
      });
    }],

    ['C7 Board: Erledigt teilweise gestellt zeigt nur den offenen Teil, nicht den Gesamtwert', async () => {
      await mitJira(jiraRouten(), async () => {
        await mitConfig(RECHNUNG, async () => {
          const uhr = { t: Date.now() };
          const { db, x, stunde } = boardFixture(uhr);
          const k = mitKunde(db);
          // P-2 hatte schon vor vier Tagen Arbeit; die ist gestellt.
          const vier = Date.now() - 4 * 86400e3;
          stunde('alt', vier, 'P-2');
          const t = metrics.byTicket(db, {}).find((r) => r.ticket === 'P-2');
          rechnung.erstelle(db, { from: t.first_day, to: tagVon(new Date(vier)), tickets: ['P-2'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
          const p2 = karteVon(await x.board('alle', 'lokal'), 'P-2');
          const gesamt = metrics.byTicket(db, {}).find((r) => r.ticket === 'P-2').arbeitswert;
          assert.ok(p2.wert_eur > 0 && p2.wert_eur < gesamt - 1, 'offen ' + p2.wert_eur + ' gesamt ' + gesamt);
          nah(p2.wert_eur, rechnung.offenJeVorgang(db, ['P-2'])['P-2'], 'offen P-2');
        });
      });
    }],

    ['C7 Board: Jira aus → nur lokale Karten, Jira-Aktionen 409', async () => {
      await mitConfig({ jira: { enabled: false, baseUrl: 'https://aus.test', projectKeys: ['DEV'] } }, async () => {
        const altFetch = globalThis.fetch;
        globalThis.fetch = async () => { throw new Error('Jira darf nicht gefragt werden'); };
        try {
          const { x } = boardFixture();
          const b = await x.board('alle', 'alle');
          assert.ok(Object.values(b.spalten).flatMap((s) => s.karten).every((k) => k.quelle === 'md'));
          assert.strictEqual(b.sync.jira, null);
          assert.strictEqual(b.bereiche[0].jira, false);
          await assert.rejects(() => x.kommentar('DEV-1', { bereich: 'Proj', text: 'x' }), (e) => e.status === 409);
          await assert.rejects(() => x.status('DEV-1', { bereich: 'Proj', spalte: 'arbeit' }), (e) => e.status === 409);
        } finally { globalThis.fetch = altFetch; }
      });
    }],

    ['C7 Board: Transition genau ein POST, mehrdeutig → 409 mit Liste, Cache nachgefuehrt', async () => {
      const stand = {};
      await mitJira(jiraRouten(stand), async (aufrufe) => {
        const { db, x } = boardFixture();
        await x.board('alle', 'alle');
        const r = await x.status('DEV-2', { bereich: 'Proj', spalte: 'review' });
        const p = posts(aufrufe);
        assert.strictEqual(p.length, 1);
        assert.deepStrictEqual([p[0].pfad, p[0].body], ['/rest/api/3/issue/DEV-2/transitions', { transition: { id: '21' } }]);
        assert.strictEqual(r.karte.spalte, 'review');
        assert.strictEqual(db.prepare('SELECT status FROM jira_issue WHERE key = ?').get('DEV-2').status, 'In Review');
        // Zwei passende Uebergaenge nach "Erledigt": 409 mit Liste, kein POST.
        // Zwei Erledigt-Ziele ohne Standardnamen (wie Abgebrochen/Declined bei DEV): Nutzer waehlt.
        stand.transitions = [{ id: '31', name: 'Canceled', to: { name: 'Abgebrochen', statusCategory: { key: 'done' } } }, { id: '41', name: 'Declined', to: { name: 'Declined', statusCategory: { key: 'done' } } }];
        await assert.rejects(() => x.status('DEV-2', { bereich: 'Proj', spalte: 'erledigt' }), (e) => e.status === 409 && e.daten.uebergaenge.length === 2);
        assert.strictEqual(posts(aufrufe).length, 1);
        await x.status('DEV-2', { bereich: 'Proj', spalte: 'erledigt', transition: '41' });
        assert.deepStrictEqual(posts(aufrufe)[1].body, { transition: { id: '41' } });
        // Kein Uebergang in die Spalte: ebenfalls 409 mit Liste, kein POST.
        await assert.rejects(() => x.status('DEV-2', { bereich: 'Proj', spalte: 'offen' }), (e) => e.status === 409 && e.daten.uebergaenge.length === 2);
        assert.strictEqual(posts(aufrufe).length, 2);
        // Unbekannter Uebergang: 400, kein POST.
        await assert.rejects(() => x.status('DEV-2', { bereich: 'Proj', spalte: 'erledigt', transition: '99' }), (e) => e.status === 400);
        assert.strictEqual(posts(aufrufe).length, 2);
      });
    }],

    ['C7 Board: deutsches Jira (echter DEV-Workflow) — Review erkannt, Standard-Uebergang gewinnt', async () => {
      assert.strictEqual(board.jiraSpalte('Wird überprüft', 'indeterminate'), 'review');
      assert.strictEqual(board.jiraSpalte('In Arbeit', 'indeterminate'), 'arbeit');
      assert.strictEqual(board.jiraSpalte('Zu erledigen', 'new'), 'offen');
      // Uebergaenge wie bei DEV-182 am 20.10.2026.
      const t = (id, name, nach, kat) => ({ id, name, to: { name: nach, statusCategory: { key: kat } } });
      const stand = { transitions: [t('2', 'Waiting for approval', 'Waiting for approval', 'new'), t('3', 'In Review', 'Wird überprüft', 'indeterminate'),
        t('4', 'Backlog', 'Backlog', 'new'), t('5', 'Escalated', 'Escalated', 'indeterminate'), t('6', 'Canceled', 'Abgebrochen', 'done'), t('7', 'Declined', 'Declined', 'done'),
        t('11', 'Zu erledigen', 'Zu erledigen', 'new'), t('21', 'In Arbeit', 'In Arbeit', 'indeterminate'), t('31', 'Fertig', 'Fertig', 'done'), t('41', 'Hold', 'Hold', 'indeterminate')] };
      await mitJira(jiraRouten(stand), async (aufrufe) => {
        const { x } = boardFixture();
        await x.board('alle', 'alle');
        for (const [spalte, id] of [['arbeit', '21'], ['review', '3'], ['erledigt', '31'], ['offen', '11']]) {
          await x.status('DEV-2', { bereich: 'Proj', spalte });
          assert.deepStrictEqual(posts(aufrufe).pop().body, { transition: { id } }, spalte);
        }
      });
    }],

    ['C7 Board: Kommentar genau ein POST mit ADF-Form, leer → 400', async () => {
      await mitJira(jiraRouten(), async (aufrufe) => {
        const { x } = boardFixture();
        await x.kommentar('DEV-2', { bereich: 'Proj', text: 'Zeile eins\nZeile zwei' });
        const p = posts(aufrufe);
        assert.strictEqual(p.length, 1);
        assert.strictEqual(p[0].pfad, '/rest/api/3/issue/DEV-2/comment');
        assert.deepStrictEqual(p[0].body, { body: { type: 'doc', version: 1, content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Zeile eins' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Zeile zwei' }] }] } });
        await assert.rejects(() => x.kommentar('DEV-2', { bereich: 'Proj', text: '   ' }), (e) => e.status === 400);
        await assert.rejects(() => x.kommentar('DEV-2', { bereich: 'Proj', text: 'x'.repeat(4001) }), (e) => e.status === 400);
        await assert.rejects(() => x.kommentar('P-1', { bereich: 'Proj', text: 'lokal' }), (e) => e.status === 409);
        assert.strictEqual(posts(aufrufe).length, 1);
      });
    }],

    ['C7 Board: Status lokal ohne @id vergibt ID und setzt Status in einer Zeile', async () => {
      await mitJira(jiraRouten(), async (aufrufe) => {
        const { x, datei } = boardFixture();
        const k = karteVon(await x.board('alle', 'lokal'), 'Proj:4');
        const r = await x.status('Proj:4', { bereich: 'Proj', spalte: 'review', zeile: k.zeile, roh: k.roh });
        assert.strictEqual(r.karte.schluessel, 'P-5');
        assert.strictEqual(fs.readFileSync(datei, 'utf8'), TODO.replace('- [ ] Ohne ID\r\n', '- [ ] Ohne ID @id:P-5 @status:review\r\n'));
        // Mit @id: gefunden ueber die ID, auch wenn sich die Zeilennummer verschoben hat.
        fs.writeFileSync(datei, '# oben neu\r\n' + fs.readFileSync(datei, 'utf8'));
        await x.status('P-1', { bereich: 'Proj', spalte: 'erledigt' });
        assert.ok(fs.readFileSync(datei, 'utf8').includes('- [x] Lokal eins @id:P-1 @status:done\r\n'));
        assert.strictEqual(posts(aufrufe).length, 0, 'lokale Aktion schrieb nach Jira');
      });
    }],

    ['C7 Board: Kriterium haken nur in der Datei, nur Kriterien-Zeilen', async () => {
      await mitJira(jiraRouten(), async () => {
        const { x, datei } = boardFixture();
        const karte = karteVon(await x.board('alle', 'lokal'), 'Proj:4');
        const k = karte.kriterien[0];
        await x.kriterium('Proj:4', { bereich: 'Proj', zeile: k.zeile, roh: k.roh, karte: { zeile: karte.zeile, roh: karte.roh }, erledigt: true });
        assert.strictEqual(fs.readFileSync(datei, 'utf8'), TODO.replace('  - [ ] Krit X', '  - [x] Krit X'));
        const p1 = karteVon(await x.board('alle', 'lokal'), 'P-1');
        await assert.rejects(() => x.kriterium('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh, karte: { zeile: p1.zeile, roh: p1.roh }, erledigt: true }), (e) => e.status === 400);
      });
    }],

    ['C7 Board: jira+md eine Karte; Verschieben = Transition + @status nachgezogen', async () => {
      await mitJira(jiraRouten(), async (aufrufe) => {
        const { x, datei } = boardFixture();
        const b = await x.board('alle', 'alle');
        const alle = Object.values(b.spalten).flatMap((s) => s.karten).filter((k) => k.schluessel === 'DEV-1');
        assert.strictEqual(alle.length, 1, 'DEV-1 doppelt');
        assert.deepStrictEqual([alle[0].quelle, alle[0].titel, alle[0].spalte], ['jira+md', 'Titel DEV-1', 'offen']);
        await x.status('DEV-1', { bereich: 'Proj', spalte: 'arbeit' });
        assert.strictEqual(posts(aufrufe).length, 1);
        assert.ok(fs.readFileSync(datei, 'utf8').includes('- [ ] Mit Jira @jira:DEV-1 @id:P-4 @status:in-progress\r\n'), fs.readFileSync(datei, 'utf8'));
      });
    }],

    ['C7 Board: POST ohne Same-Origin-Kopfzeilen → 403, GET liefert', async () => {
      const { PassThrough } = require('node:stream');
      await mitJira(jiraRouten(), async () => {
        const { x } = boardFixture();
        const rufe = (methode, url, kopf = {}, koerper = '') => new Promise((ok) => {
          const req = new PassThrough();
          Object.assign(req, { method: methode, url, headers: { host: '127.0.0.1:4747', ...kopf } });
          const u = new URL(url, 'http://127.0.0.1:4747');
          const mittel = {
            sendJson: (res, daten, status = 200) => ok({ status, daten }),
            leseKoerper: (r, fertig) => { let s = ''; r.on('data', (c) => { s += c; }); r.on('end', () => fertig(null, s ? JSON.parse(s) : {})); },
          };
          const genommen = x.routen(req, {}, u.pathname, u, mittel);
          if (!genommen) ok({ status: 'nicht genommen' });
          req.end(koerper);
        });
        const g = await rufe('GET', '/api/board?bereich=alle&quelle=alle');
        assert.strictEqual(g.status, 200);
        assert.ok(g.daten.spalten.arbeit.karten.length > 0);
        const ohne = await rufe('POST', '/api/board/DEV-2/kommentar', {}, JSON.stringify({ bereich: 'Proj', text: 'x' }));
        assert.strictEqual(ohne.status, 403);
        const mit = await rufe('POST', '/api/board/DEV-2/kommentar', { 'sec-fetch-site': 'same-origin' }, JSON.stringify({ bereich: 'Proj', text: 'x' }));
        assert.strictEqual(mit.status, 200, JSON.stringify(mit.daten));
        assert.strictEqual((await rufe('GET', '/api/boardx')).status, 'nicht genommen');
      });
    }],

    ['C7 Board: Freigabe jira_kommentar fuehrt genau einen Kommentar aus', async () => {
      const freigaben = require('../../freigaben');
      require('../../server');
      await mitJira(jiraRouten(), async (aufrufe) => {
        const db = jiraDb();
        const f = freigaben.anlegen(db, { art: 'jira_kommentar', bezug: 'DEV-2', titel: 'Kommentar an DEV-2', text: 'Entwurf', nutzlast: { key: 'DEV-2', text: 'Von Cira entworfen' }, quelle: 'cira' });
        assert.strictEqual(posts(aufrufe).length, 0, 'vor der Freigabe geschrieben');
        await freigaben.entscheide(db, f.id, { wahl: 'ok' });
        const p = posts(aufrufe);
        assert.strictEqual(p.length, 1);
        assert.strictEqual(p[0].pfad, '/rest/api/3/issue/DEV-2/comment');
      });
    }],

    ['C7 Jira: Detail mit Kommentaren als Klartext und Initialen', async () => {
      const jira = require('../../jira-sync');
      await mitJira((m, p) => {
        if (p === '/rest/api/3/field') return FELDER;
        if (p === '/rest/api/3/issue/DEV-1') return issue('DEV-1', 'To Do', 'new');
        if (p === '/rest/api/3/issue/DEV-1/comment') return { comments: [{ author: { displayName: 'Ada Lind' }, created: '2026-10-19T09:00:00.000+0200',
          body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hallo ' }, { type: 'text', text: 'Welt' }] }] } }] };
        return { status: 404, daten: {} };
      }, async () => {
        const d = await jira.holeIssue('DEV-1');
        assert.strictEqual(d.key, 'DEV-1');
        assert.deepStrictEqual(d.kommentare, [{ autor: 'Ada Lind', initialen: 'AL', zeit: '2026-10-19T09:00:00.000+0200', text: 'Hallo Welt' }]);
        await assert.rejects(() => jira.holeIssue('../x'), /Schlüssel/);
      });
    }],

    /* ---------- Review-Befunde (20.10.) ---------- */

    ['C7 Review: Done-Kategorie schlaegt den Namen ("Review abgeschlossen" ist erledigt)', () => {
      assert.strictEqual(board.jiraSpalte('Review abgeschlossen', 'done'), 'erledigt');
      assert.strictEqual(board.jiraSpalte('Geprüft', 'done'), 'erledigt');
      assert.strictEqual(board.jiraSpalte('Wird überprüft', 'indeterminate'), 'review');
    }],

    ['C7 Review: Jira nicht erreichbar → 120 s Pause, lokale Aktion fragt Jira nicht', async () => {
      let kaputt = true;
      await mitJira((m, p) => (kaputt ? new Error('The operation was aborted due to timeout') : jiraRouten()(m, p, new URLSearchParams(), null)), async (aufrufe) => {
        const uhr = { t: Date.now() };
        const { x, datei } = boardFixture(uhr);
        const b1 = await x.board('alle', 'alle');
        assert.ok(/timeout/i.test(b1.sync.jira.fehler));
        const n = aufrufe.length;
        uhr.t += 60_000;
        const b2 = await x.board('alle', 'alle');
        assert.strictEqual(aufrufe.length, n, 'Jira innerhalb der Pause erneut gefragt');
        assert.ok(/timeout/i.test(b2.sync.jira.fehler), 'Fehler in der Pause nicht mehr sichtbar');
        // Lokale Karte ohne @jira: kein einziger Jira-Aufruf, auch nach der Pause.
        uhr.t += 200_000;
        await x.status('P-1', { bereich: 'Proj', spalte: 'review' });
        assert.strictEqual(aufrufe.length, n, 'lokale Aktion fragte Jira');
        assert.ok(fs.readFileSync(datei, 'utf8').includes('@id:P-1 @status:review'));
        // Nach der Pause wieder versuchen.
        kaputt = false;
        const b3 = await x.board('alle', 'alle');
        assert.strictEqual(b3.sync.jira.fehler, null);
      });
    }],

    ['C7 Review: Jira aus dem Takt und Karte nicht im Cache → Jira-Fehler statt "nicht gefunden"', async () => {
      await mitJira(() => ({ status: 500, daten: { errorMessages: ['kaputt'] } }), async () => {
        const { x } = boardFixture();
        await assert.rejects(() => x.kommentar('DEV-2', { bereich: 'Proj', text: 'x' }), (e) => e.status === 503 && /500/.test(e.message));
      });
    }],

    ['C7 Review: Fehler beim offenen Betrag kippt nicht das ganze Board', async () => {
      await mitJira(jiraRouten(), async () => {
        const { x } = boardFixture();
        const alt = rechnung.offenJeVorgang;
        rechnung.offenJeVorgang = () => { throw new Error('2000 oder mehr offene Zeiteinträge — offener Betrag nicht bestimmbar.'); };
        try {
          const b = await x.board('alle', 'alle');
          assert.ok(b.spalten.arbeit.karten.length > 0, 'andere Spalten fehlen');
          assert.deepStrictEqual(b.spalten.erledigt.karten, []);
          assert.ok(/2000/.test(b.spalten.erledigt.fehler || ''), 'Erledigt ohne sichtbaren Fehler');
        } finally { rechnung.offenJeVorgang = alt; }
      });
    }],

    ['C7 Review: Fehler bei den Done-Kandidaten heisst nicht "Jira-Fehler"', async () => {
      await mitJira(jiraRouten(), async () => {
        const { x } = boardFixture();
        const alt = rechnung.mitOffenem;
        rechnung.mitOffenem = () => { throw new Error('DB weg'); };
        try {
          const b = await x.board('alle', 'alle');
          assert.strictEqual(b.sync.jira.fehler, null, 'lokaler Fehler als Jira-Fehler');
          assert.ok(b.sync.hinweise.some((h) => /DB weg/.test(h)), JSON.stringify(b.sync.hinweise));
        } finally { rechnung.mitOffenem = alt; }
      });
    }],

    ['C7 Review: Schreiben scheitert → keine .c2i-tmp liegt herum; kaputtes UTF-8 → 409, Datei unveraendert', async () => {
      const d = ordner();
      const f = path.join(d, 'TODO.md');
      fs.writeFileSync(f, '- [ ] A\n');
      const x = dienstMit([{ name: 'P', pfad: d }]);
      const k = x.lokal('P').karten[0];
      const alt = fs.renameSync;
      fs.renameSync = () => { const e = new Error('EPERM: operation not permitted'); e.code = 'EPERM'; throw e; };
      try { assert.throws(() => x.schreibeZeile('P', k, (t) => board.setzeStatus(t, k, 'arbeit')), /EPERM/); } finally { fs.renameSync = alt; }
      assert.deepStrictEqual(fs.readdirSync(d), ['TODO.md']);
      const kaputt = Buffer.concat([Buffer.from('- [ ] A\n- [ ] B '), Buffer.from([0xff, 0xfe]), Buffer.from('\n')]);
      fs.writeFileSync(f, kaputt);
      const k2 = x.lokal('P').karten[0];
      assert.strictEqual(fehlerStatus(() => x.schreibeZeile('P', k2, (t) => board.setzeStatus(t, k2, 'arbeit'))), 409);
      assert.ok(fs.readFileSync(f).equals(kaputt), 'Datei mit kaputtem UTF-8 veraendert');
    }],

    ['C7 Review: Kriterium nur unter der genannten Karte (gleichlautende Kriterien)', async () => {
      await mitJira(jiraRouten(), async () => {
        const { x, datei } = boardFixture();
        fs.writeFileSync(datei, '- [ ] Eins @id:P-1\n  - [ ] Tests gruen\n- [ ] Zwei @id:P-2\n  - [ ] Tests gruen\n');
        const zwei = karteVon(await x.board('alle', 'lokal'), 'P-2');
        const k = zwei.kriterien[0];
        // Extern: unter "Eins" kommt ein Kriterium dazu, die Zeilen verschieben sich.
        fs.writeFileSync(datei, '- [ ] Eins @id:P-1\n  - [ ] Neu\n  - [ ] Tests gruen\n- [ ] Zwei @id:P-2\n  - [ ] Tests gruen\n');
        await assert.rejects(() => x.kriterium('P-2', { bereich: 'Proj', zeile: k.zeile, roh: k.roh, karte: { zeile: zwei.zeile, roh: zwei.roh }, erledigt: true }), (e) => e.status === 409);
        assert.ok(!fs.readFileSync(datei, 'utf8').includes('[x]'), 'falsches Kriterium abgehakt');
        await assert.rejects(() => x.kriterium('P-2', { bereich: 'Proj', zeile: k.zeile, roh: k.roh, erledigt: true }), (e) => e.status === 400);
      });
    }],

    ['C7 Review: Cache-Nachzug scheitert nach gesetztem Uebergang → Erfolg mit Hinweis, nicht "nicht geaendert"', async () => {
      await mitJira(jiraRouten(), async (aufrufe) => {
        const ereignisse = require('../../ereignisse');
        const { x } = boardFixture();
        await x.board('alle', 'alle');
        const alt = ereignisse.sende;
        ereignisse.sende = () => { throw new Error('Bus kaputt'); };
        let r;
        try { r = await x.status('DEV-2', { bereich: 'Proj', spalte: 'review' }); } finally { ereignisse.sende = alt; }
        assert.strictEqual(posts(aufrufe).length, 1);
        assert.strictEqual(r.karte.spalte, 'review');
        assert.ok(r.hinweis && /Cache/.test(r.hinweis), String(r.hinweis));
      });
    }],

    ['C7 Review: offener Betrag fuer viele Vorgaenge = je Vorgang einzeln (gebuendelter Aufbau)', async () => {
      const { db, stunde } = arbeitsDb();
      await mitConfig(RECHNUNG, async () => {
        const t0 = Date.now() - 50 * 3600e3;
        stunde('m-1', t0, 'ABC-1');
        stunde('m-2', t0 + 3 * 86400e3 / 2, 'ABC-2');
        stunde('m-3', t0 + 4 * 3600e3, 'ABC-3');
        const von = new Date(Date.now() - 5 * 3600e3);
        zeit.speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'ABC-2', start: von.toISOString(), ende: new Date(von.getTime() + 45 * 60000).toISOString(),
          pause_min: 0, taetigkeit: 'Entwicklung', notiz: 'x', abrechenbar: true });
        const k = mitKunde(db);
        // ABC-3 bis gestern gestellt, danach nichts: 0. Die anderen nie gestellt.
        const t3 = metrics.byTicket(db, {}).find((r) => r.ticket === 'ABC-3');
        rechnung.erstelle(db, { from: t3.first_day, to: t3.last_day, tickets: ['ABC-3'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
        // ABC-4 teilweise gestellt: alte Zeit vor 30 h gestellt (nach dem Beginn von ABC-1), neue vor 1 h —
        // 29 h Abstand, also sicher ein anderer Tag. Im Buendel mit ABC-1 zaehlte die gestellte Zeit sonst mit.
        const vier = Date.now() - 30 * 3600e3;
        stunde('m-4a', vier, 'ABC-4');
        stunde('m-4b', Date.now() - 1 * 3600e3, 'ABC-4');
        rechnung.erstelle(db, { from: tagVon(new Date(vier)), to: tagVon(new Date(vier)), tickets: ['ABC-4'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
        const alle = rechnung.offenJeVorgang(db, ['ABC-1', 'ABC-2', 'ABC-3', 'ABC-4', 'XYZ-9']);
        // Gegen den unabhaengigen Weg: die Rechnungsvorschau je Vorgang (wie ein Entwurf fuer genau ihn).
        const zeilen = metrics.byTicket(db, {});
        for (const key of ['ABC-1', 'ABC-2', 'ABC-3', 'ABC-4', 'XYZ-9']) {
          const od = rechnung.offeneDaten(db, { vorgaenge: zeilen.filter((r) => r.ticket === key) });
          const soll = od.daten ? rechnung.vorschau(db, { ...od.daten, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } }).netto_eur : 0;
          nah(alle[key], soll, key);
        }
        assert.ok(alle['ABC-2'] > alle['ABC-1'], 'manuelle Zeit an ABC-2 fehlt');
        assert.strictEqual(alle['ABC-3'], 0);
      });
    }],

    // --- C7b: ID vergeben, Als Jira anlegen mit Zeitübernahme -----------------
    ['C7b id: vergibt @id ohne Status, zweiter Aufruf gleiche ID ohne Schreiben', async () => {
      await mitConfig({ jira: { enabled: false } }, async () => {
        const { x, datei } = boardFixture();
        const k = karteVon(await x.board('alle', 'lokal'), 'Proj:4');
        assert.deepStrictEqual(x.idVergeben('Proj:4', { bereich: 'Proj', zeile: k.zeile, roh: k.roh }), { schluessel: 'P-5' });
        assert.strictEqual(fs.readFileSync(datei, 'utf8'), TODO.replace('- [ ] Ohne ID\r\n', '- [ ] Ohne ID @id:P-5\r\n'));
        // Zaehlen statt mtime vergleichen: zwei schnelle Schreibvorgaenge koennen dieselbe mtime tragen.
        const altRename = fs.renameSync;
        let geschrieben = 0;
        fs.renameSync = (...a) => { geschrieben++; return altRename(...a); };
        try {
          assert.deepStrictEqual(x.idVergeben('P-5', { bereich: 'Proj', zeile: k.zeile, roh: '- [ ] Ohne ID @id:P-5' }), { schluessel: 'P-5' });
        } finally { fs.renameSync = altRename; }
        assert.strictEqual(geschrieben, 0, 'Datei ohne Aenderung neu geschrieben');
        assert.throws(() => x.idVergeben('Proj:4', { bereich: 'Proj', zeile: k.zeile, roh: k.roh }), (e) => e.status === 409);
      });
    }],

    ['C7b gestelltAuf: Vorgangsposition und abgerechneter Zeiteintrag, sonst false', async () => {
      const { db, stunde } = arbeitsDb();
      await mitConfig(RECHNUNG, async () => {
        stunde('g-1', Date.now() - 30 * 3600e3, 'ABC-1');
        stunde('g-2', Date.now() - 26 * 3600e3, 'ABC-2');
        const k = mitKunde(db);
        const t = metrics.byTicket(db, {}).find((r) => r.ticket === 'ABC-1');
        rechnung.erstelle(db, { from: t.first_day, to: t.last_day, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
        const von = new Date(Date.now() - 5 * 3600e3);
        const e = zeit.speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'ABC-3', start: von.toISOString(), ende: new Date(von.getTime() + 30 * 60000).toISOString(),
          pause_min: 0, taetigkeit: 'Entwicklung', notiz: 'x', abrechenbar: true });
        assert.strictEqual(rechnung.gestelltAuf(db, 'ABC-3'), false);
        db.prepare("UPDATE zeit_eintrag SET status = 'abgerechnet' WHERE id = ?").run(e.id);
        assert.deepStrictEqual(['ABC-1', 'ABC-2', 'ABC-3'].map((key) => rechnung.gestelltAuf(db, key)), [true, false, true]);
      });
    }],

    ['C7b uebernehmeZeit: alle Tabellen umgebucht, Werte gleich, alter Schluessel leer', async () => {
      const { db, stunde } = arbeitsDb();
      await mitConfig(RECHNUNG, async () => {
        stunde('u-1', Date.now() - 30 * 3600e3, 'JRV-1');
        const jetzt = new Date().toISOString();
        db.prepare('INSERT INTO overrides (session_id, ticket, note, created_at) VALUES (?,?,?,?)').run('u-1', 'JRV-1', 'x', jetzt);
        const von = new Date(Date.now() - 5 * 3600e3);
        zeit.speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'JRV-1', start: von.toISOString(), ende: new Date(von.getTime() + 30 * 60000).toISOString(),
          pause_min: 0, taetigkeit: 'Entwicklung', notiz: 'x', abrechenbar: true });
        db.prepare("INSERT INTO termin (kalender_id, uid, titel, start, ende, art, quelle, ziel_art, ziel_schluessel, aktualisiert_am) VALUES ('k','u','T',?,?,'meeting','lokal','vorgang','JRV-1',?)").run(jetzt, jetzt, jetzt);
        db.prepare("INSERT INTO sitzung (id, quelle, vorgang, status, gestartet) VALUES ('s1','c2invoice','jrv-1','beendet',?)").run(jetzt);
        db.prepare("INSERT INTO vorgang_log (vorgang, zeit, quelle, text) VALUES ('JRV-1',?,'cira','x')").run(jetzt);
        db.prepare("INSERT INTO ablauf (vorgang, arbeitsbereich, sitzung, schritte_json, status, erstellt, aktualisiert) VALUES ('JRV-1','A','s1','[]','done',?,?)").run(jetzt, jetzt);
        db.prepare("INSERT INTO zeitmodell_wahl (art, schluessel, zeitmodell) VALUES ('vorgang','JRV-1','aktivitaet')").run();
        const vorher = metrics.byTicket(db, {}).find((r) => r.ticket === 'JRV-1');
        const n = board.uebernehmeZeit(db, 'JRV-1', 'DEV-77');
        for (const t of ['events', 'activity', 'overrides', 'zeit_eintrag', 'termin', 'sitzung', 'vorgang_log', 'ablauf', 'zeitmodell_wahl']) assert.ok(n[t] >= 1, t + ' nicht umgebucht');
        const zeilen = metrics.byTicket(db, {});
        assert.ok(!zeilen.some((r) => r.ticket === 'JRV-1'), 'JRV-1 noch da');
        const nachher = zeilen.find((r) => r.ticket === 'DEV-77');
        nah(nachher.active_hours, vorher.active_hours, 'Stunden');
        nah(nachher.arbeitswert, vorher.arbeitswert, 'Wert');
        assert.strictEqual(db.prepare("SELECT vorgang FROM sitzung WHERE id = 's1'").get().vorgang, 'DEV-77');
        assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM zeitmodell_wahl WHERE schluessel = 'JRV-1'").get().n, 0);
      });
    }],

    ['C7b uebernehmeZeit: auf der ID gestellt → 409, nichts umgebucht', async () => {
      const { db, stunde } = arbeitsDb();
      await mitConfig(RECHNUNG, async () => {
        stunde('u-2', Date.now() - 30 * 3600e3, 'JRV-2');
        const k = mitKunde(db);
        const t = metrics.byTicket(db, {}).find((r) => r.ticket === 'JRV-2');
        rechnung.erstelle(db, { from: t.first_day, to: t.last_day, tickets: ['JRV-2'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
        const zaehl = () => db.prepare("SELECT COUNT(*) AS n FROM events WHERE ticket = 'JRV-2'").get().n;
        const vorher = zaehl();
        assert.throws(() => board.uebernehmeZeit(db, 'JRV-2', 'DEV-78'), (e) => e.status === 409);
        assert.strictEqual(zaehl(), vorher);
      });
    }],

    // Jira-Attrappe fuer das Anlegen: Projekt mit lokalisierten Typen, fortlaufende Keys.
    ...(() => {
      const anlageRouten = (zaehler, vorPost = () => {}) => {
        const basis = jiraRouten();
        return (m, p, q, body) => {
          if (p === '/rest/api/3/project/DEV') return { issueTypes: [{ id: '10001', name: 'Epic', hierarchyLevel: 1 }, { id: '10002', name: 'Unteraufgabe', subtask: true, hierarchyLevel: -1 }, { id: '10003', name: 'Aufgabe', hierarchyLevel: 0 }] };
          if (p === '/rest/api/3/issue' && m === 'POST') { vorPost(); return { id: '1', key: 'DEV-' + (50 + zaehler.n++) }; }
          return basis(m, p, q, body);
        };
      };
      const anlagen = (aufrufe) => aufrufe.filter((a) => a.methode === 'POST' && a.pfad === '/rest/api/3/issue');
      return [
        ['C7b alsJira: ein POST mit Projekt, Typ aus dem Projekt, Titel ohne Tags, Aufgabenliste; @jira in der Zeile; Zeit umgebucht', async () => {
          await mitJira(anlageRouten({ n: 0 }), async (aufrufe) => {
            const { x, db, datei } = boardFixture();
            const b = await x.board('alle', 'lokal');
            const p1 = karteVon(b, 'P-1');
            const vorher = metrics.byTicket(db, {}).find((r) => r.ticket === 'P-1');
            const r = await x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh });
            assert.deepStrictEqual([r.key, r.hinweis], ['DEV-50', null]);
            assert.ok(r.umgebucht.events > 0);
            const [a] = anlagen(aufrufe);
            assert.deepStrictEqual(a.body.fields.project, { key: 'DEV' });
            assert.deepStrictEqual(a.body.fields.issuetype, { id: '10003' });
            assert.strictEqual(a.body.fields.summary, 'Lokal eins');
            assert.deepStrictEqual(a.body.fields.description, { type: 'doc', version: 1, content: [] });
            assert.ok(fs.readFileSync(datei, 'utf8').includes('- [ ] Lokal eins @id:P-1 @status:in-progress @jira:DEV-50\r\n'));
            const nachher = metrics.byTicket(db, {}).find((t) => t.ticket === 'DEV-50');
            nah(nachher.active_hours, vorher.active_hours, 'Stunden');
            // Ohne @id: nichts umzubuchen, Kriterien als Aufgabenliste.
            const ohne = karteVon(await x.board('alle', 'lokal'), 'Proj:4');
            const r2 = await x.alsJira('Proj:4', { bereich: 'Proj', zeile: ohne.zeile, roh: ohne.roh });
            assert.deepStrictEqual([r2.key, r2.umgebucht], ['DEV-51', {}]);
            const tl = anlagen(aufrufe)[1].body.fields.description.content[0];
            assert.strictEqual(tl.type, 'taskList');
            assert.deepStrictEqual(tl.content.map((i) => [i.attrs.state, i.content[0].text]), [['TODO', 'Krit X']]);
            assert.ok(tl.attrs.localId && tl.content[0].attrs.localId, 'localId fehlt');
            assert.strictEqual(anlagen(aufrufe).length, 2);
          });
        }],

        ['C7b alsJira: zwei gleichzeitige Aufrufe → ein Ticket, der zweite 409', async () => {
          await mitJira(anlageRouten({ n: 0 }), async (aufrufe) => {
            const { x } = boardFixture();
            const p1 = karteVon(await x.board('alle', 'lokal'), 'P-1');
            const d = { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh };
            const [a, b] = await Promise.allSettled([x.alsJira('P-1', d), x.alsJira('P-1', d)]);
            assert.strictEqual(a.status, 'fulfilled');
            assert.ok(b.status === 'rejected' && b.reason.status === 409, String(b.reason && b.reason.message));
            assert.strictEqual(anlagen(aufrufe).length, 1);
          });
        }],

        ['C7b alsJira: Zeile geaendert, schon @jira, gestellt, Jira aus → 409 ohne POST', async () => {
          await mitJira(anlageRouten({ n: 0 }), async (aufrufe) => {
            const { x, db } = boardFixture();
            const b = await x.board('alle', 'lokal');
            const p1 = karteVon(b, 'P-1');
            await assert.rejects(() => x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh + ' alt' }), (e) => e.status === 409);
            const mitJ = karteVon(await x.board('alle', 'alle'), 'DEV-1');
            await assert.rejects(() => x.alsJira('DEV-1', { bereich: 'Proj', zeile: mitJ.zeile, roh: mitJ.roh }), (e) => e.status === 409 && /DEV-1/.test(e.message));
            await mitConfig(RECHNUNG, async () => {
              const k = mitKunde(db);
              const t = metrics.byTicket(db, {}).find((r) => r.ticket === 'P-1');
              rechnung.erstelle(db, { from: t.first_day, to: t.last_day, tickets: ['P-1'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
            });
            await assert.rejects(() => x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh }), (e) => e.status === 409 && /Rechnung/.test(e.message));
            assert.strictEqual(anlagen(aufrufe).length, 0);
          });
          await mitConfig({ jira: { enabled: false } }, async () => {
            const { x } = boardFixture();
            const p1 = karteVon(await x.board('alle', 'lokal'), 'P-1');
            await assert.rejects(() => x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh }), (e) => e.status === 409);
          });
        }],

        ['C7b alsJira: Zeile nach dem POST nicht schreibbar → Key + Hinweis, Zeit trotzdem umgebucht', async () => {
          const altRename = fs.renameSync;
          try {
            await mitJira(anlageRouten({ n: 0 }, () => { fs.renameSync = () => { throw Object.assign(new Error('EBUSY: Datei gesperrt'), { code: 'EBUSY' }); }; }), async () => {
              const { x, db, datei } = boardFixture();
              const p1 = karteVon(await x.board('alle', 'lokal'), 'P-1');
              const r = await x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh });
              fs.renameSync = altRename;
              assert.strictEqual(r.key, 'DEV-50');
              assert.ok(/@jira:DEV-50 von Hand/.test(r.hinweis || ''), r.hinweis);
              assert.strictEqual(fs.readFileSync(datei, 'utf8'), TODO);
              assert.ok(!fs.existsSync(datei + '.c2i-tmp'), 'Temp-Datei liegen geblieben');
              assert.ok(metrics.byTicket(db, {}).some((t) => t.ticket === 'DEV-50'), 'Zeit nicht umgebucht');
            });
          } finally { fs.renameSync = altRename; }
        }],

        ['C7b Review: gestelltAuf unabhaengig von Gross-/Kleinschreibung', async () => {
          const { db, stunde } = arbeitsDb();
          await mitConfig(RECHNUNG, async () => {
            stunde('r-1', Date.now() - 30 * 3600e3, 'ABC-1');
            const k = mitKunde(db);
            const t = metrics.byTicket(db, {}).find((r) => r.ticket === 'ABC-1');
            rechnung.erstelle(db, { from: t.first_day, to: t.last_day, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Testkunde GmbH', anschrift: ['Weg 1'] } });
            assert.strictEqual(rechnung.gestelltAuf(db, 'abc-1'), true);
            assert.throws(() => board.uebernehmeZeit(db, 'abc-1', 'DEV-90'), (e) => e.status === 409);
          });
        }],

        ['C7b Review: alsJira lehnt @id mit Jira-Praefix und doppelte @id ab, ohne POST', async () => {
          await mitJira(anlageRouten({ n: 0 }), async (aufrufe) => {
            const { x, datei } = boardFixture();
            fs.appendFileSync(datei, '- [ ] Fremd @id:DEV-55\r\n- [ ] Doppelt @id:P-1\r\n');
            const b = await x.board('alle', 'lokal');
            const fremd = karteVon(b, 'DEV-55');
            await assert.rejects(() => x.alsJira('DEV-55', { bereich: 'Proj', zeile: fremd.zeile, roh: fremd.roh }), (e) => e.status === 409 && /DEV/.test(e.message));
            const p1 = Object.values(b.spalten).flatMap((s) => s.karten).find((k) => k.schluessel === 'P-1' && /Lokal eins/.test(k.titel));
            await assert.rejects(() => x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh }), (e) => e.status === 409 && /mehrfach/.test(e.message));
            assert.strictEqual(anlagen(aufrufe).length, 0);
          });
        }],

        ['C7b Review: nach Schreibfehler kein zweites Ticket fuer dieselbe Zeile', async () => {
          const altRename = fs.renameSync;
          try {
            await mitJira(anlageRouten({ n: 0 }, () => { fs.renameSync = () => { throw Object.assign(new Error('EBUSY: Datei gesperrt'), { code: 'EBUSY' }); }; }), async (aufrufe) => {
              const { x } = boardFixture();
              const p1 = karteVon(await x.board('alle', 'lokal'), 'P-1');
              const r = await x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh });
              fs.renameSync = altRename;
              assert.strictEqual(r.zeileOk, false);
              await assert.rejects(() => x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh }), (e) => e.status === 409 && /DEV-50/.test(e.message));
              assert.strictEqual(anlagen(aufrufe).length, 1);
            });
          } finally { fs.renameSync = altRename; }
        }],

        ['C7b Review: Zeitueberschreitung beim Anlegen sagt „Ergebnis unklar“', async () => {
          await mitJira((m, p, q, body) => (p === '/rest/api/3/issue' && m === 'POST' ? new Error('The operation was aborted due to timeout') : anlageRouten({ n: 0 })(m, p, q, body)), async () => {
            const { x } = boardFixture();
            const p1 = karteVon(await x.board('alle', 'lokal'), 'P-1');
            await assert.rejects(() => x.alsJira('P-1', { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh }), (e) => /unklar/.test(e.message));
          });
        }],

        // --- Scrum-Sicht (Setzung 20.10., nur lesen) --------------------------------
        ...(() => {
          const sprint = (name, state) => ({ customfield_10020: [{ name, state }] });
          const epicA = { parent: { key: 'DEV-10', fields: { summary: 'Epic A', issuetype: { name: 'Epic', hierarchyLevel: 1 } } } };
          // DEV-1 aktiver Sprint mit Epic, DEV-2 kuenftiger Sprint, DEV-9 erledigt im aktiven Sprint.
          const scrumRouten = () => {
            const basis = jiraRouten();
            return (m, p, q, body) => {
              if (p === '/rest/api/3/search/jql') {
                if (/statusCategory != Done/.test(q.get('jql'))) return { issues: [issue('DEV-1', 'To Do', 'new', { ...sprint('Sprint 7', 'active'), ...epicA }), issue('DEV-2', 'In Progress', 'indeterminate', sprint('Sprint 8', 'future'))] };
                return { issues: /DEV-9/.test(q.get('jql')) ? [issue('DEV-9', 'Done', 'done', sprint('Sprint 7', 'active'))] : [] };
              }
              return basis(m, p, q, body);
            };
          };
          const schluessel = (b) => Object.fromEntries(Object.entries(b.spalten).map(([s, v]) => [s, v.karten.map((k) => k.schluessel).sort()]));
          return [
            ['C7s issueAus: sprintStatus, Epic nur aus Elternvorgang der Ebene 1', async () => {
              const jira = require('../../jira-sync');
              await mitJira((m, p) => {
                if (p === '/rest/api/3/field') return FELDER;
                if (p === '/rest/api/3/search/jql') return { issues: [issue('DEV-1', 'To Do', 'new', { ...sprint('Sprint 8', 'future'), ...epicA }),
                  issue('DEV-3', 'To Do', 'new', { parent: { key: 'DEV-1', fields: { summary: 'Story', issuetype: { name: 'Story', hierarchyLevel: 0 } } } })] };
                return { status: 404, daten: {} };
              }, async (aufrufe) => {
                const l = await jira.holeIssues('DEV', { doneKeys: [] });
                assert.deepStrictEqual(l.map((i) => [i.key, i.sprintStatus, i.epic]), [['DEV-1', 'future', { key: 'DEV-10', titel: 'Epic A' }], ['DEV-3', 'active', null]]);
                assert.ok(aufrufe.find((a) => a.pfad === '/rest/api/3/search/jql').query.fields.split(',').includes('parent'), 'parent nicht angefragt');
              });
            }],

            ['C7s Filter aktiv/backlog: lokale Karten im Backlog, Summen nur ueber Gefiltertes', async () => {
              await mitJira(scrumRouten(), async () => {
                const { x } = boardFixture();
                const alle = await x.board('alle', 'alle');
                const aktiv = await x.board('alle', 'alle', 'aktiv');
                const backlog = await x.board('alle', 'alle', 'backlog');
                assert.deepStrictEqual(schluessel(aktiv), { offen: ['DEV-1'], arbeit: [], review: [], erledigt: ['DEV-9'] });
                assert.deepStrictEqual(schluessel(backlog), { offen: ['Proj:4'], arbeit: ['DEV-2', 'P-1'], review: [], erledigt: ['P-2'] });
                for (const s of ['offen', 'arbeit', 'erledigt']) nah(aktiv.spalten[s].summe_eur + backlog.spalten[s].summe_eur, alle.spalten[s].summe_eur, s);
                assert.strictEqual(aktiv.spalten.arbeit.summe_eur, 0);
                assert.ok(alle.spalten.arbeit.summe_eur > 0, 'Fixture ohne Wert in Arbeit');
                assert.deepStrictEqual([aktiv.scrum.sprint, backlog.scrum.sprint], ['Sprint 7', null]);
                assert.deepStrictEqual([alle.spalten.offen.summe_punkte, alle.spalten.arbeit.summe_punkte, aktiv.spalten.arbeit.summe_punkte], [3, 3, 0]);
              });
            }],

            ['C7s Gruppe je Art, „Ohne …“ zuletzt, ohne Gruppierung keine Gruppe', async () => {
              await mitJira(scrumRouten(), async () => {
                const { x } = boardFixture();
                const g = async (art) => (await x.board('alle', 'alle', 'alle', art)).scrum.gruppen.map((y) => [y.schluessel, y.titel, y.n]);
                assert.deepStrictEqual(await g('epic'), [['DEV-10', 'DEV-10 · Epic A', 1], ['', 'Ohne Epic', 5]]);
                assert.deepStrictEqual(await g('bearbeiter'), [['Ada Lind', 'Ada Lind', 3], ['', 'Nicht zugewiesen', 3]]);
                assert.deepStrictEqual(await g('prio'), [['high', 'High', 3], ['', 'Ohne Priorität', 3]]);
                assert.deepStrictEqual(await g('bereich'), [['Proj', 'Proj', 6]]);
                const ohne = await x.board('alle', 'alle');
                assert.deepStrictEqual(ohne.scrum.gruppen, []);
                assert.ok(Object.values(ohne.spalten).flatMap((s) => s.karten).every((k) => k.gruppe === null));
                const mit = await x.board('alle', 'alle', 'alle', 'epic');
                assert.deepStrictEqual(karteVon(mit, 'DEV-1').gruppe, { schluessel: 'DEV-10', titel: 'DEV-10 · Epic A' });
              });
            }],

            ['C7s Review: leere Schaetzung ist keine 0, kein aktiver Sprint wird gemeldet', async () => {
              const jira = require('../../jira-sync');
              await mitJira((m, p) => {
                if (p === '/rest/api/3/field') return FELDER;
                if (p === '/rest/api/3/search/jql') return { issues: [issue('DEV-1', 'To Do', 'new', { customfield_10016: null, customfield_10020: [] }), issue('DEV-2', 'To Do', 'new', { customfield_10016: '' })] };
                return { status: 404, daten: {} };
              }, async () => {
                const l = await jira.holeIssues('DEV', { doneKeys: [] });
                assert.deepStrictEqual(l.map((i) => i.punkte), [null, null]);
              });
              await mitJira((m, p, q) => (p === '/rest/api/3/search/jql' ? { issues: /statusCategory != Done/.test(q.get('jql')) ? [issue('DEV-1', 'To Do', 'new', { customfield_10020: [] })] : [] } : jiraRouten()(m, p, q)), async () => {
                const { x } = boardFixture();
                const r = await x.board('alle', 'alle', 'aktiv');
                assert.strictEqual(r.scrum.aktivVorhanden, false);
              });
              await mitJira(scrumRouten(), async () => {
                const { x } = boardFixture();
                assert.strictEqual((await x.board('alle', 'alle', 'backlog')).scrum.aktivVorhanden, true);
              });
            }],

            ['C7s ungueltiger Sprint oder Gruppe → 400', async () => {
              await mitConfig({ jira: { enabled: false } }, async () => {
                const { x } = boardFixture();
                await assert.rejects(() => x.board('alle', 'alle', 'jetzt'), (e) => e.status === 400);
                await assert.rejects(() => x.board('alle', 'alle', 'alle', 'kunde'), (e) => e.status === 400);
              });
            }],
          ];
        })(),

        ['C7b Routen: id und als-jira ohne Same-Origin → 403, mit → 200', async () => {
          const { PassThrough } = require('node:stream');
          await mitJira(anlageRouten({ n: 0 }), async (aufrufe) => {
            const { x } = boardFixture();
            const rufe = (url, kopf, koerper) => new Promise((ok) => {
              const req = new PassThrough();
              Object.assign(req, { method: 'POST', url, headers: { host: '127.0.0.1:4747', ...kopf } });
              const u = new URL(url, 'http://127.0.0.1:4747');
              const mittel = {
                sendJson: (res, daten, status = 200) => ok({ status, daten }),
                leseKoerper: (r, fertig) => { let s = ''; r.on('data', (c) => { s += c; }); r.on('end', () => fertig(null, s ? JSON.parse(s) : {})); },
              };
              if (!x.routen(req, {}, u.pathname, u, mittel)) ok({ status: 'nicht genommen' });
              req.end(JSON.stringify(koerper));
            });
            const p1 = karteVon(await x.board('alle', 'lokal'), 'P-1');
            const d = { bereich: 'Proj', zeile: p1.zeile, roh: p1.roh };
            assert.strictEqual((await rufe('/api/board/P-1/id', {}, d)).status, 403);
            assert.strictEqual((await rufe('/api/board/P-1/als-jira', {}, d)).status, 403);
            assert.strictEqual(anlagen(aufrufe).length, 0);
            const so = { 'sec-fetch-site': 'same-origin' };
            const idr = await rufe('/api/board/P-1/id', so, d);
            assert.deepStrictEqual([idr.status, idr.daten.schluessel], [200, 'P-1']);
            const r = await rufe('/api/board/P-1/als-jira', so, d);
            assert.strictEqual(r.status, 200, JSON.stringify(r.daten));
            assert.strictEqual(r.daten.key, 'DEV-50');
          });
        }],
      ];
    })(),
  ];
};
