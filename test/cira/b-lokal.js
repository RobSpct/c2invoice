'use strict';
// Pauschale fuer lokale Modelle je Projekt (Block B) mit ECHTEN source='lokal'-Events.
// Laeuft als eigener Prozess: der Preis je Million Tokens wird beim Laden von metrics.js
// aus config.json gelesen, im Selfcheck ist das Modul schon geladen. Aufruf aus test/cira/b.js.
// B_MUTANT (JSON {datei, von, nach}): Mutant des Gate-Skripts, wird vor dem Laden eingesetzt.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const W = path.join(__dirname, '..', '..');
const config = require(path.join(W, 'config.json'));
config.lokaleModelle = { ...(config.lokaleModelle || {}), eurProMioTokens: 2.5 };
if (process.env.B_MUTANT) {
  const m = JSON.parse(process.env.B_MUTANT);
  const datei = path.join(W, m.datei);
  const mod = new Module(datei, module);
  mod.filename = datei; mod.paths = Module._nodeModulePaths(W);
  mod._compile(fs.readFileSync(datei, 'utf8').replace(/\r\n/g, '\n').split(m.von).join(m.nach), datei);
  require.cache[datei] = mod;
}
const dbmod = require(path.join(W, 'db.js'));
const rechnung = require(path.join(W, 'rechnung.js'));
config.rechnung = {
  aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '', bank: 'Testbank', iban: 'DE00 0000 0000 0000 0000 00', bic: 'TESTDEFF' },
  kleinunternehmer: true, ustSatz: 19, zahlungszielTage: 14, chromePfad: '',
};
config.vergleichsFaktor = 0; config.stundensatz = 85; config.projektSaetze = {}; config.rundungMinuten = 5;

const P = 'Konto-Projekt';
const EV = 'INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, source) VALUES (?,?,?,?,?,?,?,?,?,0,0,0,0,0,0,?,?)';
let n = 0;
function claude(db, tag, stunden = 3) {
  const ein = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
  for (let m = 0; m <= stunden * 60; m += 2) ein.run('s-' + tag, new Date(Date.parse(tag + 'T08:00:00Z') + m * 60000).toISOString(), P, 'main', null, tag);
  db.prepare(EV).run('r-' + tag, tag + 'T08:00:00.000Z', 's-' + tag, P, 'main', null, 'claude-opus-5', 10, 10, tag, 'claude');
}
// 2 Mio. Tokens = 5 EUR; Zeit knapp neben einem Claude-Event des Projekts, damit sie ihm zugeordnet wird
const lokal = (db, ts) => db.prepare(EV).run('l-' + (++n), ts, 'sl', '(lokal)', null, null, 'ollama/x', 2000000, 0, ts.slice(0, 10), 'lokal');
function standard() {
  const db = dbmod.open(':memory:');
  claude(db, '2026-08-18'); claude(db, '2026-08-19');
  db.prepare(`INSERT INTO zeit_eintrag (ziel_art, ziel_schluessel, start, ende, tag, taetigkeit, abrechenbar, rohzeit_min, gezaehlt_min, created_at)
    VALUES ('projekt', ?, '2026-08-20T12:00:00.000Z', '2026-08-20T14:00:00.000Z', '2026-08-20', 'Beratung', 1, 120, 120, '2026-08-20')`).run(P);
  return db;
}
const daten = (projekte) => ({ from: '2026-08-01', to: '2026-08-31', projekte, empfaenger: { name: 'Kunde' } });
const pauschalen = (inv) => inv.positionen.filter((p) => p.typ === 'pauschal');

// 1. Lokale Tokens an einem Tag, an dem nur Vorgangsarbeit lief (keine ticketlose Zeile):
//    das Pauschalenfenster reicht bis zum Ende der Position, die naechste Rechnung rechnet sie nicht noch einmal.
{
  const db = standard();
  db.prepare(EV).run('v-1', '2026-08-20T10:00:00.000Z', 's-v', P, 'main', 'XY-1', 'claude-opus-5', 10, 10, '2026-08-20', 'claude');
  lokal(db, '2026-08-20T10:00:10.000Z');
  const a = rechnung.erstelle(db, daten([P]));
  assert.strictEqual(pauschalen(a).length, 1, 'erste Pauschale');
  assert.strictEqual(pauschalen(a)[0].betrag_eur, 5);
  assert.strictEqual(pauschalen(a)[0].bis, '2026-08-20', 'Pauschale endet mit der Position');
  claude(db, '2026-08-21');
  const b = rechnung.erstelle(db, daten([P]));
  assert.strictEqual(pauschalen(b).length, 0, 'zweite Pauschale fuer dieselben Tokens');
  assert.strictEqual(b.positionen.find((p) => p.projekt && p.typ !== 'pauschal').stunden, 3);
  // Storno: die Pauschale ist wieder offen (ein Storno zaehlt nicht als gestellt)
  rechnung.storniere(db, b.nr); rechnung.storniere(db, a.nr);
  assert.strictEqual(pauschalen(rechnung.erstelle(db, daten([P]))).length, 1, 'Pauschale nach Storno verloren');
}

// 2. Eine gestellte Projektposition blockiert die erste Pauschale nicht.
{
  const db = standard();
  const a = rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
  assert.strictEqual(pauschalen(a).length, 0);
  lokal(db, '2026-08-18T08:00:30.000Z');   // Log kam spaeter
  const b = rechnung.erstelle(db, daten([P]));
  assert.strictEqual(pauschalen(b).length, 1);
}

// 3. Projektzeile ohne Stunden, nur mit lokalen Modellen: die Pauschale geht auf die Rechnung.
{
  const db = dbmod.open(':memory:');
  db.prepare(EV).run('r-x', '2026-08-18T08:00:00.000Z', 's-x', P, 'main', null, 'claude-opus-5', 10, 10, '2026-08-18', 'claude');
  lokal(db, '2026-08-18T08:00:20.000Z');
  const od = rechnung.offeneDaten(db, { projekte: [P] });
  assert.ok(od.daten && od.daten.projekte && od.daten.projekte.includes(P), 'offeneDaten ohne Projekt mit nur lokalen Modellen');
  const inv = rechnung.erstelle(db, daten([P]));
  assert.strictEqual(inv.positionen.length, 1);
  assert.strictEqual(pauschalen(inv)[0].betrag_eur, 5);
  assert.strictEqual(pauschalen(inv)[0].projekt, P);
  // Block B R11: auf dem Projektweg steht kein "Vorgang" im Belegtext
  assert.ok(pauschalen(inv)[0].bezeichnung.includes('Projekt ' + P) && !/Vorgang/.test(pauschalen(inv)[0].bezeichnung), pauschalen(inv)[0].bezeichnung);
  assert.ok(!/Token-Verbrauch/.test(rechnung.renderHtml(inv)), 'Token-Zeile bei reiner Pauschalrechnung');
  // die Pauschale zaehlt nicht im Konto, auch mit projekt-Feld
  assert.strictEqual(rechnung.projektKonto(db, P).berechnet_h, 0);
  // Pauschale gestellt (bis 31.08.): das Projekt wird nicht wieder angeboten, bis neue lokale Nutzung dazukommt
  const od2 = rechnung.offeneDaten(db, { projekte: [P] });
  assert.strictEqual(od2.daten, null, 'gestellte Pauschale wird wieder angeboten');
  db.prepare(EV).run('r-y', '2026-09-05T08:00:00.000Z', 's-x', P, 'main', null, 'claude-opus-5', 10, 10, '2026-09-05', 'claude');
  lokal(db, '2026-09-05T08:00:20.000Z');
  const od3 = rechnung.offeneDaten(db, { projekte: [P] });
  assert.ok(od3.daten && od3.daten.projekte.includes(P), 'neue lokale Nutzung wird nicht angeboten');
}
console.log('B-LOKAL-OK');
