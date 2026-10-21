'use strict';
// C9a Briefings (Plan design/cira/C9-PLAN.md Task 6–7): Liste mit Datum und
// Quelle, Startstand „gelesen“, To-do-Rueckschreiben byte-genau, Vault-Health
// gesperrt, Kurzfassung mit Cache, Monatsbericht als Freigabe, Kontext fuer Cira.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FIX = path.join(__dirname, '..', 'fixtures', 'vault');
const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ dbmod, openDbs }) => {
  const briefings = require('../../briefings');
  const freigaben = require('../../freigaben');
  const metrics = require('../../metrics');

  const kopie = () => {
    const ziel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-c9a-')), 'vault');
    fs.cpSync(FIX, ziel, { recursive: true });
    return ziel;
  };
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  const status = async (fn) => { try { await fn(); } catch (e) { return e.status; } return 200; };
  const dienst = (v, db, mehr = {}) => briefings.erzeuge({ db, vaultPfad: () => v, ...mehr });
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, w] of Object.entries(werte)) { if (w === undefined) delete cfg[k]; else cfg[k] = JSON.parse(JSON.stringify(w)); }
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }

  async function liste() {
    const v = kopie();
    const b = dienst(v, neueDb());
    const l = b.liste();
    assert.strictEqual(l.vault, 'vault');
    const je = Object.fromEntries(l.briefings.map((x) => [x.name, x]));
    assert.deepStrictEqual(Object.keys(je).sort(), ['2026-06-11', '2026-09-c2invoice', 'notizen-2026-09-01', 'ohne-datum', 'vault-health-2026-07-09']);
    assert.strictEqual(je['2026-06-11'].quelle.name, 'Posteingang');
    assert.strictEqual(je['vault-health-2026-07-09'].quelle.name, 'Vault');
    assert.strictEqual(je['vault-health-2026-07-09'].schutz, true);
    assert.strictEqual(je['vault-health-2026-07-09'].offen, 2, 'eingerueckte Zeile zaehlt mit');
    assert.strictEqual(je['2026-09-c2invoice'].quelle.name, 'c2invoice');
    assert.strictEqual(je['2026-09-c2invoice'].pfad, 'Briefings/reports/2026-09-c2invoice.md');
    assert.strictEqual(je['2026-09-c2invoice'].datum, '2026-10-01', 'Monatsbericht erscheint am 1. danach');
    assert.strictEqual(je['notizen-2026-09-01'].quelle.name, 'notizen');
    assert.strictEqual(je['ohne-datum'].datum, '2026-09-08', 'Datum aus dem H1 fehlt');
    assert.strictEqual(je['ohne-datum'].quelle.name, 'ohne-datum');
    assert.strictEqual(je['2026-06-11'].titel, 'Posteingang-Briefing — Donnerstag, 11.06.2026');
    assert.deepStrictEqual(l.briefings.map((x) => x.datum), ['2026-10-01', '2026-09-08', '2026-09-01', '2026-07-09', '2026-06-11']);
    // Eigene Regeln ersetzen die eingebauten.
    const eigen = dienst(v, neueDb(), { quellenEigen: () => [{ muster: 'notizen-*', name: 'Woche', farbe: '#123456' }] }).liste();
    assert.deepStrictEqual(eigen.briefings.find((x) => x.name === 'notizen-2026-09-01').quelle, { name: 'Woche', farbe: '#123456' });
    // Ohne Vault, ohne Ordner: leer statt Fehler.
    assert.deepStrictEqual(briefings.erzeuge({ db: neueDb(), vaultPfad: () => null }).liste().briefings, []);
    fs.rmSync(path.join(v, 'Briefings'), { recursive: true });
    assert.strictEqual(dienst(v, neueDb()).liste().fehlt, true);
  }

  async function startstand() {
    const v = kopie();
    const db = neueDb();
    const b = dienst(v, db);
    assert.strictEqual(b.ungelesen(), 0, 'Altbestand zaehlt als ungelesen');
    fs.writeFileSync(path.join(v, 'Briefings', '2026-10-21.md'), '# Neu\n');
    assert.strictEqual(b.ungelesen(), 1);
    fs.appendFileSync(path.join(v, 'Briefings', '2026-06-11.md'), '\n- noch etwas\n');
    assert.strictEqual(b.ungelesen(), 2, 'geaenderte Datei nicht ungelesen');
    const neu = b.lies('Briefings/2026-10-21.md');
    assert.strictEqual(neu.gelesen, false);
    b.gelesen({ pfad: neu.pfad, hash: neu.hash });
    assert.strictEqual(b.ungelesen(), 1);
  }

  async function todo() {
    const v = kopie();
    const db = neueDb();
    const b = dienst(v, db);
    const f = path.join(v, 'Briefings', 'notizen-2026-09-01.md');
    const vorher = '﻿' + fs.readFileSync(f, 'utf8').replace(/\n/g, '\r\n');
    fs.writeFileSync(f, vorher);
    const l = b.lies('Briefings/notizen-2026-09-01.md');
    assert.deepStrictEqual(l.todos.map((t) => [t.zeile, t.erledigt]), [[2, false]]);
    b.liste();
    b.gelesen({ pfad: l.pfad, hash: l.hash });
    const r = b.todo({ pfad: l.pfad, zeile: 2, roh: l.todos[0].roh, erledigt: true });
    assert.strictEqual(r.todo.erledigt, true);
    assert.strictEqual(fs.readFileSync(f, 'utf8'), vorher.replace('- [ ] Angebot', '- [x] Angebot'), 'mehr als die eine Zeile geaendert, BOM oder CRLF weg');
    assert.strictEqual(b.lies(l.pfad).gelesen, true, 'eigenes Abhaken macht das Briefing ungelesen');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM aktion_log WHERE art = 'briefing_todo'").get().n, 1);
    // Veraltete Zeile: 409, Datei unveraendert.
    const jetzt = fs.readFileSync(f);
    assert.strictEqual(await status(() => b.todo({ pfad: l.pfad, zeile: 2, roh: l.todos[0].roh, erledigt: true })), 409);
    assert.ok(fs.readFileSync(f).equals(jetzt));
    // Vault-Health: gesperrt (E8).
    const vh = b.lies('Briefings/vault-health-2026-07-09.md');
    const vhVorher = fs.readFileSync(path.join(v, 'Briefings', 'vault-health-2026-07-09.md'));
    assert.strictEqual(await status(() => b.todo({ pfad: vh.pfad, zeile: vh.todos[0].zeile, roh: vh.todos[0].roh, erledigt: true })), 409);
    assert.ok(fs.readFileSync(path.join(v, 'Briefings', 'vault-health-2026-07-09.md')).equals(vhVorher));
    assert.strictEqual(vh.todos.length, 3, 'eingerueckte Zeile gilt als To-do');
    // Kein To-do in roh: 400.
    assert.strictEqual(await status(() => b.todo({ pfad: l.pfad, zeile: 0, roh: '# Notizen zur Woche', erledigt: true })), 400);
  }

  async function pfad() {
    const v = kopie();
    const b = dienst(v, neueDb());
    for (const p of ['wiki/kasse-runden.md', 'Briefings/../wiki/kasse-runden.md', 'Briefings/x/y/z.md', 'Briefings/anders/x.md', '../x.md']) {
      assert.strictEqual(await status(() => b.lies(p)), 400, 'nicht abgewiesen: ' + p);
    }
    assert.strictEqual(await status(() => b.lies('Briefings/fehlt.md')), 404);
  }

  async function kurz() {
    const v = kopie();
    const db = neueDb();
    let aufrufe = 0;
    const ausText = async () => { aufrufe++; return { text: 'Zwei Punkte sind offen.', modell: 'text:1b', tokens: 30 }; };
    const b = dienst(v, db, { ausText });
    const a = await b.kurz({ pfad: 'Briefings/2026-06-11.md' });
    assert.strictEqual(a.cache, false);
    const c = await b.kurz({ pfad: 'Briefings/2026-06-11.md' });
    assert.strictEqual(c.cache, true);
    assert.strictEqual(c.text, 'Zwei Punkte sind offen.');
    assert.strictEqual(aufrufe, 1, 'zweiter Aufruf nicht aus dem Cache');
    fs.appendFileSync(path.join(v, 'Briefings', '2026-06-11.md'), '\nNeu.\n');
    await b.kurz({ pfad: 'Briefings/2026-06-11.md' });
    assert.strictEqual(aufrufe, 2, 'geaenderte Datei aus altem Cache');
    // Modell gibt ab: nichts gecacht.
    const d = dienst(v, db, { ausText: async () => ({ fehlt: 'nicht erreichbar' }) });
    assert.strictEqual((await d.kurz({ pfad: 'Briefings/ohne-datum.md' })).fehlt, 'nicht erreichbar');
    assert.ok(!db.prepare('SELECT 1 FROM briefing_kurz WHERE hash = ?').get(d.lies('Briefings/ohne-datum.md').hash));
  }

  async function monatsbericht() {
    const v = kopie();
    const db = neueDb();
    const rechnung = require('../../rechnung');
    const alt = rechnung.liste;
    rechnung.liste = () => [
      { nr: 'R-2026-0042', empfaenger: 'Muster Handel GmbH', status: 'erstellt', erstellt_am: '2026-10-15', brutto_eur: 119, rest_eur: 119, ueberfaellig_tage: 3 },
      { nr: 'R-2026-0043', empfaenger: 'Muster Handel GmbH', status: 'storniert', erstellt_am: '2026-10-16', brutto_eur: 50, rest_eur: 0, ueberfaellig_tage: 0 },
      { nr: 'R-2026-0044', empfaenger: 'Muster Handel GmbH', status: 'erstellt', erstellt_am: '2026-11-03', brutto_eur: 60, rest_eur: 0, ueberfaellig_tage: 0 },
    ];
    try {
      let uhr = new Date(2026, 10, 1, 6, 59);
      const b = dienst(v, db, { jetzt: () => uhr, bereiche: () => [{ projekt: 'Shop', kuerzel: 'SH' }] });
      const anzahl = () => db.prepare("SELECT COUNT(*) AS n FROM freigabe WHERE art = 'monatsbericht'").get().n;
      assert.strictEqual(b.takt(uhr), null);
      assert.strictEqual(anzahl(), 0, 'vor 07:00 angelegt');
      uhr = new Date(2026, 10, 1, 7, 0);
      const f = b.takt(uhr);
      assert.strictEqual(anzahl(), 1);
      assert.strictEqual(f.bezug, '2026-10');
      assert.strictEqual(f.nutzlast.pfad, 'Briefings/reports/2026-10-c2invoice.md');
      assert.match(f.nutzlast.text, /Gestellt im Oktober: 1, zusammen 119,00 EUR/);
      assert.ok(!/R-2026|Muster/.test(f.nutzlast.text), 'Rechnungsnummer oder Empfaenger im Bericht');
      // Nachholen am 5.: keine zweite.
      b.takt(new Date(2026, 10, 5, 12, 0));
      assert.strictEqual(anzahl(), 1, 'Nachholen legt eine zweite Freigabe an');
      // Ablehnen schreibt nichts, und es kommt keine neue.
      await freigaben.entscheide(db, f.id, { wahl: 'ablehnen' });
      b.takt(new Date(2026, 10, 6, 8, 0));
      assert.strictEqual(anzahl(), 1);
      assert.ok(!fs.existsSync(path.join(v, 'Briefings', 'reports', '2026-10-c2invoice.md')));
      // Naechster Monat: freigeben schreibt die Datei.
      const g = b.takt(new Date(2026, 11, 1, 9, 0));
      await freigaben.entscheide(db, g.id, { wahl: 'ok' });
      const datei = path.join(v, 'Briefings', 'reports', '2026-11-c2invoice.md');
      assert.strictEqual(fs.readFileSync(datei, 'utf8'), g.nutzlast.text);
      // Liegt die Datei schon da: 409 beim Freigeben, Datei bleibt.
      db.prepare("DELETE FROM freigabe WHERE bezug = '2026-11'").run();
      const h = freigaben.anlegen(db, { art: 'monatsbericht', bezug: '2026-11', quelle: 'cira', titel: 'x', nutzlast: { ...g.nutzlast, text: 'anders' } });
      assert.strictEqual(await status(() => freigaben.entscheide(db, h.id, { wahl: 'ok' })), 409);
      assert.strictEqual(fs.readFileSync(datei, 'utf8'), g.nutzlast.text);
      // Monat ganz ohne Arbeit und Rechnungen (frische Installation): kein leerer Bericht.
      assert.strictEqual(b.takt(new Date(2027, 1, 1, 8, 0)), null);
      assert.ok(!db.prepare("SELECT 1 FROM freigabe WHERE bezug = '2027-01'").get(), 'leerer Monatsbericht angelegt');
    } finally { rechnung.liste = alt; }
  }

  async function summen() {
    const r = metrics.rechnungsSummen([
      { status: 'erstellt', erstellt_am: '2026-10-02T09:00:00Z', brutto_eur: 100, rest_eur: 40, ueberfaellig_tage: 0 },
      { status: 'erstellt', erstellt_am: '2026-09-30', brutto_eur: 200, rest_eur: 200, ueberfaellig_tage: 5 },
      { status: 'storniert', erstellt_am: '2026-10-05', brutto_eur: 999, rest_eur: 999, ueberfaellig_tage: 9 },
    ], { von: '2026-10-01', bis: '2026-10-31' });
    assert.deepStrictEqual(r, { gestellt: { n: 1, brutto: 100 }, offen: { n: 2, rest: 240 }, ueberfaellig: { n: 1, rest: 200 } });
    // Plausibilitaet: offen nie mehr als alles nicht Stornierte brutto.
    assert.ok(r.offen.rest <= 300);
  }

  async function kontext() {
    const v = kopie();
    const db = neueDb();
    const b = dienst(v, db);
    const cira = require('../../cira');
    const anfragen = [];
    const fetchFn = async (url, init) => { anfragen.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Zwei Punkte.' } }], usage: { total_tokens: 5 } }) }; };
    await mitConfig({ lokaleModelle: { upstreamUrl: 'http://127.0.0.1:11434', proxyPort: 11435 }, cira: { modellLokal: 'k:1b', modellText: 'k:1b', modellDenken: 'k:1b' } }, async () => {
      const d = cira.erzeuge({ db, bucheVorgang: () => {}, fetchFn, claudeExe: 'nie.exe', kontextQuellen: { briefing: b.kontextFakten } });
      await d.frage({ text: 'Was steht da drin?', kontext: { art: 'briefing', id: 'Briefings/2026-06-11.md', titel: 'Posteingang' } });
    });
    assert.ok(anfragen.length, 'kein T1-Aufruf');
    assert.match(anfragen[0].messages[0].content, /Posteingang-Briefing/, 'Briefing fehlt in den Fakten');
    assert.match(anfragen[0].messages[0].content, /Rechnung von Lieferant pruefen/);
    // Unbekanntes Briefing: Frage laeuft trotzdem.
    assert.deepStrictEqual(await (async () => { try { return b.kontextFakten('Briefings/fehlt.md'); } catch (e) { return e.status; } })(), 404);
  }

  return [
    ['C9a Liste: Datum aus Name und H1, Quellen, undatiert, reports', liste],
    ['C9a Startstand: erster Lauf 0 ungelesen, neue Datei 1, geaenderte Datei 1', startstand],
    ['C9a To-do: genau eine Zeile, BOM und CRLF bleiben, 409 bei Abweichung, Vault-Health gesperrt', todo],
    ['C9a Pfad: Datei ausserhalb des Briefings-Ordners -> 400', pfad],
    ['C9a Kurzfassung: zweiter Aufruf aus dem Cache', kurz],
    ['C9a Monatsbericht: genau eine Freigabe, Nachholen erzeugt keine zweite, Ausfuehren schreibt, Ablehnen nicht', monatsbericht],
    ['C9a rechnungsSummen: storniert zaehlt nicht, Plausibilitaet', summen],
    ['C9a Kontext briefing: Fakten erreichen T1', kontext],
  ];
};
