'use strict';
// M1 Module und Ansichten (Owner 09.11.2026, GATES-M1.md): Ableitung der Module
// aus der Ansicht, Routen-Zuordnung, Sperre 409, Whitelist, stiller Hintergrund,
// Navigation und Startseite. Ein ausgeschaltetes Modul loescht nichts.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const T = {
  ableitung: 'M1: moduleAktiv — Ansicht ergibt Module, flows nur mit abrechnung',
  routen: 'M1: modulVon — Routen je Modul, zeitmodell und cira/skills bleiben Kern',
  sperre: 'M1: Sperre — ausgeschaltetes Modul antwortet 409, Kern und eingeschaltetes nicht',
  setzen: 'M1: setzeOberflaeche — Whitelist, schreibt nur modus und module',
  hintergrund: 'M1: Hintergrund — Kalender, Erinnerung, Vault und Flows still bei Modul aus',
  freigabe: 'M1: Freigaben — Karten ausgeschalteter Module unsichtbar, 409, nichts ausgefuehrt',
  nav: 'M1: navSeiten — Modulfilter, Gruppenkopf wandert zur naechsten Seite',
  start: 'M1: startseite — Erststart, gemerkte Seite, Vorgabe je Ansicht',
  vorlage: 'M1: Vorlage fragt beim ersten Start, kennt alle Module, Gruppe schreibbar',
};

module.exports = ({ dbmod, openDbs, configGeschuetzt }) => {
  const srv = () => require('../../server');
  const kern = () => require('../../public/app/kern.js');
  const cfg = () => require('../../config.json');
  // Ansicht nur im Speicher setzen, danach zurueck (auch bei rotem Test).
  async function mitOberflaeche(o, fn) {
    const c = cfg();
    const had = Object.hasOwn(c, 'oberflaeche'), alt = c.oberflaeche;
    c.oberflaeche = o;
    try { return await fn(); } finally { if (had) c.oberflaeche = alt; else delete c.oberflaeche; }
  }

  function ableitung() {
    const { moduleAktiv, MODULE } = srv();
    const l = (o) => [...moduleAktiv(o)].sort().join(',');
    const alle = [...MODULE].sort().join(',');
    for (const o of [null, {}, { modus: 'wahl' }, { modus: 'full' }, { modus: 'quatsch' }, { modus: 'constructor' }, { modus: '__proto__' }, { modus: 'toString' }, 'basic']) assert.strictEqual(l(o), alle, 'alle bei ' + JSON.stringify(o));
    assert.strictEqual(l({ modus: 'basic' }), '');
    assert.strictEqual(l({ modus: 'advanced' }), 'abrechnung,kontakte,zeit');
    assert.strictEqual(l({ modus: 'modular' }), '', 'modular ohne module');
    assert.strictEqual(l({ modus: 'modular', module: { zeit: true, kontakte: false } }), 'zeit');
    assert.strictEqual(l({ modus: 'modular', module: { zeit: 'true', assistent: 1 } }), '', 'nur echtes true zaehlt');
    assert.strictEqual(l({ modus: 'modular', module: { flows: true } }), '', 'flows ohne abrechnung');
    assert.strictEqual(l({ modus: 'modular', module: { flows: true, abrechnung: true } }), 'abrechnung,flows');
    // Die Ansicht in der Datei wirkt ohne Argument.
    return mitOberflaeche({ modus: 'basic' }, () => assert.strictEqual([...moduleAktiv()].length, 0));
  }

  function routen() {
    const { modulVon } = srv();
    const erwartet = {
      '/api/zeitmodell': null, '/api/zeit': 'zeit', '/api/zeit-loeschen': 'zeit', '/api/zeit/timer-start': 'zeit', '/api/zeit-hinweise': 'zeit',
      '/api/taetigkeitsart-loeschen': 'zeit', '/api/termine': 'zeit', '/api/kalender-sync': 'zeit',
      '/api/rechnungen': 'abrechnung', '/api/rechnung-pdf': 'abrechnung', '/api/beleg-vorschau': 'abrechnung', '/api/angebot-rechnung': 'abrechnung',
      '/api/mail/einstellungen': 'abrechnung', '/api/mahnung/senden': 'abrechnung', '/api/stammdaten': 'abrechnung', '/api/vorlage-loeschen': 'abrechnung',
      '/api/kontakte': 'kontakte', '/api/lead-umwandeln': 'kontakte', '/api/ansprechpartner': 'kontakte',
      '/api/flows': 'flows', '/api/flows/3/laeufe': 'flows',
      '/api/cira/frage': 'assistent', '/api/cira/einstellungen': 'assistent', '/api/briefings': 'assistent', '/api/gedaechtnis/graph': 'assistent',
      '/api/sprache/status': 'assistent', '/api/ablauf': 'assistent', '/api/vault': 'assistent',
      '/api/cira/skills': null, '/api/summary': null, '/api/freigaben': null, '/api/freigaben/3/ok': null, '/api/ereignisse': null,
      '/api/sitzungen': null, '/api/projekte': null, '/api/ticket': null, '/api/einstellungen': null, '/api/oberflaeche': null,
      '/api/v1/models': null, '/api/geraete': null, '/api/kopplung/status': null, '/api/constructor': null, '/api/__proto__': null,
    };
    for (const [p, m] of Object.entries(erwartet)) assert.strictEqual(modulVon(p), m, p);
  }

  async function sperre() {
    const s = srv();
    const lauscht = s.server.listening;
    if (!lauscht) await new Promise((ok) => s.server.listen(0, '127.0.0.1', ok));
    const url = (p) => `http://127.0.0.1:${s.server.address().port}${p}`;
    const hol = async (p, body) => {
      const r = await fetch(url(p), body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return [r.status, await r.json()];
    };
    try {
      await mitOberflaeche({ modus: 'basic' }, async () => {
        for (const [p, body, m] of [['/api/rechnungen', undefined, 'abrechnung'], ['/api/zeit', { ziel_art: 'xx' }, 'zeit'], ['/api/kontakte', undefined, 'kontakte'],
          ['/api/flows', undefined, 'flows'], ['/api/cira/verlauf?kanal=dock', undefined, 'assistent'], ['/api/mahnung/liste', undefined, 'abrechnung']]) {
          const [st, j] = await hol(p, body);
          assert.deepStrictEqual([st, j.modul, /ausgeschaltet/.test(j.error)], [409, m, true], p + ': ' + st + ' ' + JSON.stringify(j).slice(0, 120));
        }
        const [st, j] = await hol('/api/summary');
        assert.strictEqual(st, 200, '/api/summary bei basic');
        assert.deepStrictEqual(j.config.oberflaeche, { modus: 'basic', module: { zeit: false, abrechnung: false, kontakte: false, flows: false, assistent: false }, aktiv: [] });
        const [so] = await hol('/api/oberflaeche');
        assert.strictEqual(so, 200, '/api/oberflaeche ist Kern');
      });
      await mitOberflaeche({ modus: 'modular', module: { kontakte: true } }, async () => {
        assert.strictEqual((await hol('/api/kontakte'))[0], 200, 'eingeschaltet: kontakte');
        assert.strictEqual((await hol('/api/rechnungen'))[0], 409, 'modular ohne abrechnung');
      });
      await mitOberflaeche({ modus: 'full' }, async () => {
        assert.strictEqual((await hol('/api/rechnungen'))[0], 200, 'full: rechnungen');
      });
    } finally {
      if (!lauscht) await new Promise((ok) => s.server.close(ok));
    }
  }

  function setzen() {
    configGeschuetzt(() => {
      const { setzeOberflaeche } = srv();
      const c = cfg();
      const pfad = path.join(__dirname, '..', '..', 'config.json');
      const dateiVorher = JSON.parse(fs.readFileSync(pfad, 'utf8'));
      const speicherVorher = JSON.stringify(c.oberflaeche);
      for (const [d, re] of [
        [{ modus: 'admin' }, /Ansicht/], [{ modus: 'wahl' }, /Ansicht/], [{}, /Ansicht/], [{ modus: ['basic'] }, /Ansicht/],
        [{ modus: 'basic', module: { zeit: 'ja' } }, /an oder aus/], [{ modus: 'basic', module: { zeit: 1 } }, /an oder aus/],
        [{ modus: 'basic', module: { kern: false } }, /Unbekanntes Modul/], [{ modus: 'basic', module: { geplanteBereiche: true } }, /Unbekanntes Modul/],
        [{ modus: 'modular', module: JSON.parse('{"__proto__":true}') }, /Unbekanntes Modul/], [JSON.parse('{"modus":"basic","__proto__":{"x":1}}'), /Unbekanntes Feld/],
        [{ modus: 'modular', module: [] }, /Objekt/], [{ modus: 'modular', module: null }, /Objekt/],
        [{ modus: 'basic', geplanteBereiche: true }, /Unbekanntes Feld/],
      ]) {
        assert.throws(() => setzeOberflaeche(d), re, JSON.stringify(d));
        assert.strictEqual(JSON.stringify(c.oberflaeche), speicherVorher, 'nach Ablehnung veraendert: ' + JSON.stringify(d));
      }
      // Alle Schalter ausdruecklich: setzeOberflaeche behaelt nicht genannte aus der Config (Vorlage hat alle an).
      const r = setzeOberflaeche({ modus: 'modular', module: { zeit: true, abrechnung: false, kontakte: false, flows: true, assistent: false } });
      assert.deepStrictEqual(r.oberflaeche.aktiv, ['zeit'], 'flows ohne abrechnung nicht aktiv');
      const datei = JSON.parse(fs.readFileSync(pfad, 'utf8'));
      assert.strictEqual(datei.oberflaeche.modus, 'modular');
      assert.strictEqual(datei.oberflaeche.module.zeit, true);
      assert.strictEqual(datei.oberflaeche.module.flows, true, 'Wunsch bleibt gespeichert, wirkt erst mit abrechnung');
      assert.strictEqual(datei.oberflaeche.geplanteBereiche, (dateiVorher.oberflaeche || {}).geplanteBereiche, 'geplanteBereiche bleibt');
      // Laufender Timer: Zeit laesst sich nicht ausschalten (er buchte sonst unsichtbar weiter).
      const zeitmod = require('../../zeit');
      const merkTimer = zeitmod.timerAktuell;
      zeitmod.timerAktuell = () => ({ start: '2026-11-09T08:00:00.000Z' });
      try {
        assert.throws(() => setzeOberflaeche({ modus: 'basic' }), /Timer stoppen/);
        assert.strictEqual(c.oberflaeche.modus, 'modular', 'trotz Timer umgeschaltet');
        setzeOberflaeche({ modus: 'modular', module: { zeit: true, kontakte: true } });   // Zeit bleibt an: erlaubt
      } finally { zeitmod.timerAktuell = merkTimer; }
      // Ohne module: die bisherigen Schalter bleiben.
      setzeOberflaeche({ modus: 'basic' });
      assert.strictEqual(JSON.parse(fs.readFileSync(pfad, 'utf8')).oberflaeche.module.zeit, true);
      assert.strictEqual(c.oberflaeche.modus, 'basic');
    });
  }

  async function hintergrund() {
    const s = srv();
    const kalender = require('../../kalender');
    const zaehler = { takt: 0, erinnerungen: 0, indexiere: 0, monat: 0, flowTakt: 0, ausloesen: 0 };
    const merk = { takt: kalender.takt, erinnerungen: kalender.erinnerungen, indexiere: s.gedaechtnisDienst.indexiere,
      monat: s.briefingDienst.takt, flowTakt: s.flowDienst.takt, ausloesen: s.flowDienst.ausloesen };
    kalender.takt = async () => { zaehler.takt++; };
    kalender.erinnerungen = () => { zaehler.erinnerungen++; };
    s.gedaechtnisDienst.indexiere = () => { zaehler.indexiere++; };
    s.briefingDienst.takt = () => { zaehler.monat++; };
    s.flowDienst.takt = async () => { zaehler.flowTakt++; };
    s.flowDienst.ausloesen = async () => { zaehler.ausloesen++; return []; };
    const alles = async () => {
      await s.kalenderTakt();
      s.erinnern();
      s.vaultTakt();
      await s.flowHintergrund.takt();
      await s.flowHintergrund.ausloesen('jira_status', {});
    };
    try {
      await mitOberflaeche({ modus: 'basic' }, alles);
      assert.deepStrictEqual(zaehler, { takt: 0, erinnerungen: 0, indexiere: 0, monat: 0, flowTakt: 0, ausloesen: 0 }, 'basic: ' + JSON.stringify(zaehler));
      await mitOberflaeche({ modus: 'modular', module: { flows: true } }, alles);
      assert.strictEqual(zaehler.flowTakt + zaehler.ausloesen, 0, 'flows ohne abrechnung laeuft');
      await mitOberflaeche({ modus: 'full' }, alles);
      assert.deepStrictEqual(zaehler, { takt: 1, erinnerungen: 1, indexiere: 1, monat: 1, flowTakt: 1, ausloesen: 1 }, 'full: ' + JSON.stringify(zaehler));
    } finally {
      kalender.takt = merk.takt; kalender.erinnerungen = merk.erinnerungen;
      s.gedaechtnisDienst.indexiere = merk.indexiere; s.briefingDienst.takt = merk.monat;
      s.flowDienst.takt = merk.flowTakt; s.flowDienst.ausloesen = merk.ausloesen;
    }
  }

  // Alte Karten eines ausgeschalteten Moduls: unsichtbar, fuehren nichts aus, Ablehnen geht (Security-Review H1).
  async function freigabe() {
    srv();
    const freigaben = require('../../freigaben');
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const rechnungen = () => db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;
    const n = rechnungen();
    const karte = (art) => freigaben.anlegen(db, { art, titel: 'M1 ' + art, nutzlast: { erwartetBrutto: 1, from: '2026-08-01', to: '2026-08-31' }, quelle: 'cira' }).id;
    const r = karte('rechnung'), f = karte('flow_fehler'), v = karte('vault_notiz'), s = karte('sitzung_frage');
    const status = (id) => db.prepare('SELECT status FROM freigabe WHERE id = ?').get(id).status;
    await mitOberflaeche({ modus: 'basic' }, async () => {
      assert.deepStrictEqual(freigaben.liste(db).map((x) => x.id), [s], 'Liste zeigt Karten ausgeschalteter Module');
      assert.strictEqual(freigaben.offenAnzahl(db), 1, 'Zaehler zaehlt Karten ausgeschalteter Module');
      for (const id of [r, f, v]) {
        await assert.rejects(freigaben.entscheide(db, id, { wahl: 'ok' }), (e) => e.status === 409 && /ausgeschaltet/.test(e.message), 'Karte ' + id);
        assert.strictEqual(status(id), 'offen', 'Karte ' + id + ' nicht mehr offen');
      }
      await freigaben.entscheide(db, v, { wahl: 'ablehnen' });
      assert.strictEqual(status(v), 'abgelehnt', 'Ablehnen muss gehen');
    });
    assert.strictEqual(rechnungen(), n, 'Rechnung gestellt');
    await mitOberflaeche({ modus: 'full' }, async () => {
      assert.deepStrictEqual(freigaben.liste(db).map((x) => x.id).sort(), [r, f, s].sort());
      // Eingeschaltet laeuft die Aktion an: die Rechnung scheitert dann an ihren eigenen Pruefungen, nicht am Modul.
      await assert.rejects(freigaben.entscheide(db, r, { wahl: 'ok' }), (e) => !/ausgeschaltet/.test(e.message));
    });
  }

  function nav() {
    const { navSeiten } = kern();
    const seiten = [{ k: 'cockpit', gruppe: 'Assistent' }, { k: 'sitzungen' }, { k: 'hub', gruppe: 'Auswertung' }, { k: 'analyse' },
      { k: 'angebote', gruppe: 'Abrechnung' }, { k: 'rechnungen' }, { k: 'kontakte' }, { k: 'postfach', block: 'C15' }];
    const sicht = (aktiv, g = false) => navSeiten(seiten, g, aktiv).map((s) => s.k + (s.gruppe ? '|' + s.gruppe : '')).join(',');
    assert.strictEqual(sicht([]), 'sitzungen|Assistent,analyse|Auswertung');
    assert.strictEqual(sicht(['kontakte']), 'sitzungen|Assistent,analyse|Auswertung,kontakte|Abrechnung');
    assert.strictEqual(sicht(null), 'cockpit|Assistent,sitzungen,hub|Auswertung,analyse,angebote|Abrechnung,rechnungen,kontakte');
    assert.strictEqual(sicht(['abrechnung', 'kontakte', 'assistent']), sicht(null), 'alles an = wie bisher');
    assert.strictEqual(sicht([], true), 'sitzungen|Assistent,analyse|Auswertung', 'geplanter Bereich eines ausgeschalteten Moduls bleibt weg');
    assert.strictEqual(seiten[1].gruppe, undefined, 'Eingabe veraendert');
  }

  function start() {
    const { startseite } = kern();
    const nur = (...ks) => (k) => ks.includes(k);
    assert.strictEqual(startseite('wahl', nur('cockpit', 'analyse'), 'cockpit'), 'start');
    assert.strictEqual(startseite('basic', nur('analyse', 'sitzungen'), 'cockpit'), 'analyse');
    assert.strictEqual(startseite('basic', nur('analyse', 'sitzungen'), 'sitzungen'), 'sitzungen');
    assert.strictEqual(startseite('advanced', nur('analyse', 'hub', 'cockpit'), null), 'hub');
    assert.strictEqual(startseite('full', nur('analyse', 'hub', 'cockpit'), 'board'), 'cockpit');
    assert.strictEqual(startseite('modular', nur('analyse', 'hub'), null), 'analyse');
    assert.strictEqual(startseite('quatsch', nur('analyse'), null), 'analyse');
  }

  function vorlage() {
    const { MODULE, SCHREIBBAR } = srv();
    const { SEITE_MODUL } = kern();
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.example.json'), 'utf8')).oberflaeche || {};
    assert.strictEqual(v.modus, 'wahl', 'Vorlage fragt nicht beim ersten Start');
    assert.deepStrictEqual(Object.keys(v.module || {}).sort(), [...MODULE].sort());
    assert.ok(SCHREIBBAR.includes('oberflaeche'), 'oberflaeche nicht schreibbar');
    for (const [k, m] of Object.entries(SEITE_MODUL)) assert.ok(MODULE.includes(m), 'SEITE_MODUL.' + k + ' = ' + m);
  }

  return [[T.ableitung, ableitung], [T.routen, routen], [T.sperre, sperre], [T.setzen, setzen], [T.hintergrund, hintergrund],
    [T.freigabe, freigabe], [T.nav, nav], [T.start, start], [T.vorlage, vorlage]];
};
module.exports.T = T;
