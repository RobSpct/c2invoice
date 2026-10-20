'use strict';
// Masterplan 3.0, Block C3: Szenen fuer die Buehne des Cockpits. Jede Szene
// zeigt dieselben Werte wie die bestehenden Auswertungen — geprueft gegen
// genau die Aufrufe, die Finanzen und Verbrauch fuer denselben Zeitraum machen.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CFG = path.join(__dirname, '..', '..', 'config.json');

module.exports = ({ configGeschuetzt, dbmod, openDbs }) => {
  const cira = require('../../cira');
  const metrics = require('../../metrics');
  const rechnung = require('../../rechnung');
  const kontakte = require('../../kontakte');
  const zeit = require('../../zeit');
  const srv = () => require('../../server');

  const tag = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const monatOpts = (d = new Date()) => ({ from: tag(new Date(d.getFullYear(), d.getMonth(), 1)), to: tag(new Date(d.getFullYear(), d.getMonth() + 1, 0)) });
  const nah = (a, b, text) => assert.ok(Math.abs(a - b) < 0.005, text + ': ' + a + ' statt ' + b);

  // Arbeit mit Eingaben, damit Stunden, Arbeitswert und Marge entstehen.
  function arbeitsDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const insE = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, cwd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insA = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)');
    let n = 0;
    // Eine Stunde Arbeit ab `beginn` (ms), alle drei Minuten eine Eingabe.
    const stunde = (session, beginn, projekt, ticket, usd = 0.1) => {
      for (let m = 0; m <= 60; m += 3) {
        const ts = new Date(beginn + m * 60000).toISOString();
        insE.run('c3-' + n++, ts, session, projekt, 'main', ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, usd, 0, ts.slice(0, 10), null);
        insA.run(session, ts, projekt, 'main', ticket, ts.slice(0, 10), 1);
      }
    };
    // 10 Uhr Ortszeit: `day` ist das UTC-Datum (ingest.dayOf), kurz nach
    // Mitternacht laege die Arbeit sonst auf „gestern“.
    const h = new Date();
    stunde('s-kunde', new Date(h.getFullYear(), h.getMonth(), h.getDate(), 10, 0).getTime(), 'Kunde', 'ABC-1');
    return { db, stunde };
  }
  const dienst = (db) => cira.erzeuge({ db, bucheVorgang: srv().bucheVorgang, fetchFn: () => { throw new Error('Ollama darf nicht laufen'); },
    spawnFn: () => { throw new Error('Claude darf nicht laufen'); }, claudeExe: 'claude-test.exe' });
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, v] of Object.entries(werte)) cfg[k] = JSON.parse(JSON.stringify(v));
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  const RECHNUNG = {
    rechnung: { aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '' },
      kleinunternehmer: false, ustSatz: 19, zahlungszielTage: 14, chromePfad: '' },
    vergleichsFaktor: 0,
  };
  // Marge gibt es nur mit Selbstkosten; die Vorlage hat 0, die eigene Datei nicht.
  const MARGE = { selbstkostenStunde: 60 };
  const wert = (szene, label) => {
    const k = [szene.gross, ...(szene.kacheln || [])].find((x) => x.l === label);
    assert.ok(k, 'Kachel "' + label + '" fehlt: ' + JSON.stringify(szene));
    return k.v;
  };

  async function szeneMonat() {
    const { db } = arbeitsDb();
    const o = monatOpts();
    // Dieselben Aufrufe wie GET /api/kennzahlen.
    const k = metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
    // Plausibel statt nur gleich: eine Stunde Arbeit, Marge einer Dienstleistung.
    assert.ok(k.aktive_stunden > 0.5 && k.aktive_stunden < 2, 'Saat: ' + k.aktive_stunden + ' h');
    assert.ok(k.wert.marge_prozent != null && k.wert.marge_prozent < 100, 'Saat-Marge: ' + k.wert.marge_prozent);
    const n = await dienst(db).frage({ text: 'Wie lief der Monat?', kanal: 'cockpit' });
    const s = n.szene;
    assert.strictEqual(n.stufe, 'T0');
    assert.strictEqual(s.typ, 'numbers');
    assert.deepStrictEqual([s.zeitraum.von, s.zeitraum.bis], [o.from, o.to]);
    assert.strictEqual(s.gross.l, 'Arbeitswert');
    nah(s.gross.v, k.wert.arbeitswert, 'Arbeitswert');
    nah(wert(s, 'Stunden'), k.aktive_stunden + k.manuell_stunden, 'Stunden');
    nah(wert(s, 'Abgerechnet'), k.abgerechnet_eur + k.abgerechnet_manuell_eur, 'Abgerechnet');
    nah(wert(s, 'Noch nicht abgerechnet'), k.offen_eur, 'Noch nicht abgerechnet');
    nah(wert(s, 'Marge — nach Sachkosten und eigener Zeit'), k.wert.marge_prozent, 'Marge');
    for (const x of [s.gross, ...s.kacheln]) assert.ok(['eur', 'h', 'proz'].includes(x.e), 'Einheit fehlt: ' + JSON.stringify(x));
    // Tagesbericht: dieselbe Kachelform fuer heute.
    const t = await dienst(db).frage({ text: 'Tagesbericht', kanal: 'cockpit' });
    assert.strictEqual(t.szene.typ, 'numbers');
    nah(t.szene.gross.v, k.wert.arbeitswert, 'Tagesbericht Arbeitswert (alle Arbeit liegt heute)');
  }

  async function szeneVerbrauch() {
    const { db, stunde } = arbeitsDb();
    const h = new Date();
    stunde('s-zwei', new Date(h.getFullYear(), h.getMonth(), h.getDate(), 2, 0).getTime(), 'Zwei', null, 0.5);
    const o = monatOpts();
    const p = metrics.byProject(db, o).filter((x) => x.cost_usd > 0).sort((a, b) => b.cost_usd - a.cost_usd);
    assert.strictEqual(p.length, 2, 'Saat: zwei Projekte');
    const n = await dienst(db).frage({ text: 'Wo gehen die Token hin?', kanal: 'cockpit' });
    const s = n.szene;
    assert.strictEqual(s.typ, 'bars');
    assert.deepStrictEqual(s.zeilen.map((z) => z.l), p.map((x) => x.project));
    s.zeilen.forEach((z, i) => nah(z.v, p[i].cost_usd, 'Projekt ' + z.l));
    nah(s.gross.v, p.reduce((a, x) => a + x.cost_usd, 0), 'gesamt');
    assert.ok(/API-Gegenwert/.test(s.titel), 'Bezugsgroesse fehlt im Titel: ' + s.titel);
    assert.strictEqual(n.zustand, 'warn');
  }

  async function szeneMarge() {
    const { db, stunde } = arbeitsDb();
    // Arbeit in zwei abgeschlossenen Wochen.
    const h = new Date();
    for (const tage of [10, 17]) stunde('s-w' + tage, new Date(h.getFullYear(), h.getMonth(), h.getDate() - tage, 9, 0).getTime(), 'Kunde', 'ABC-2');
    const erwartet = metrics.margeJeWoche(db, { bis: tag(h), wochen: 12 }, rechnung.abrechnung(db));
    const mit = erwartet.filter((w) => w.kennzahlen.wert.marge_prozent != null);
    assert.ok(mit.length >= 2, 'Saat: zwei Wochen mit Marge');
    const n = await dienst(db).frage({ text: 'Wie entwickelt sich die Marge?', kanal: 'cockpit' });
    const s = n.szene;
    assert.strictEqual(s.typ, 'chart');
    assert.strictEqual(s.punkte.length, 12);
    s.punkte.forEach((pt, i) => {
      assert.strictEqual(pt.x, erwartet[i].montag);
      const e = erwartet[i].kennzahlen.wert.marge_prozent;
      if (e == null) { assert.strictEqual(pt.v, null); assert.strictEqual(pt.grund, 'keine Arbeit', 'Woche ' + pt.x + ' ohne Grund'); }
      else { nah(pt.v, e, 'Woche ' + pt.x); assert.strictEqual(pt.grund, undefined, 'Woche ' + pt.x + ' mit Marge traegt einen Grund'); }
    });
    // Die Luecke steht auch im Antworttext, nicht nur im Chart.
    const leer = s.punkte.filter((pt) => pt.v == null);
    assert.ok(leer.length && leer.every((pt) => n.text.includes('Woche ab ' + pt.x + ' (keine Arbeit)')), n.text);
    nah(s.gross.v, mit[mit.length - 1].kennzahlen.wert.marge_prozent, 'letzte Woche');
    assert.ok(/nach Sachkosten und eigener Zeit/.test(s.titel), s.titel);
    // "Warum …" bleibt beim Modell (Ruling C2).
    assert.strictEqual(cira.t0('Warum ist die Marge gestiegen?'), null);
  }

  // Rechnung ueber die Arbeit an ABC-1, Kunde mit Projekt "Kunde".
  function mitKunde(db) {
    return kontakte.speichere(db, { firma: 'Nordwind GmbH', vorname: 'Ada', nachname: 'Lind', anschrift: ['Hafen 1', '20457 Hamburg'], email: 'a@nordwind.example', projekte: ['Kunde'] });
  }

  async function szeneUeberfaellig() {
    const { db } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      const k = mitKunde(db);
      const o = monatOpts();
      const r = rechnung.erstelle(db, { from: o.from, to: o.to, tickets: ['ABC-1'], empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1', '20457 Hamburg'] }, kontaktId: k.id });
      db.prepare('UPDATE invoices SET faellig_am = ? WHERE nr = ?').run('2026-01-02', r.nr);
      const offen = rechnung.liste(db).filter((x) => x.status === 'erstellt' && x.ueberfaellig_tage > 0);
      assert.strictEqual(offen.length, 1, 'Saat: eine ueberfaellige Rechnung');
      const n = await dienst(db).frage({ text: 'Was ist überfällig?', kanal: 'cockpit' });
      const s = n.szene;
      assert.strictEqual(s.typ, 'numbers');
      nah(s.gross.v, offen[0].rest_eur, 'Ueberfaellig gesamt');
      assert.ok(s.gross.v > 0);
      assert.strictEqual(s.kacheln.length, 1);
      assert.strictEqual(s.kacheln[0].ton, 'rot');
      assert.ok(s.kacheln[0].l.startsWith(r.nr), s.kacheln[0].l);
      assert.strictEqual(n.zustand, 'overdue');
    });
  }

  async function szeneRechnung() {
    const { db } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      const d = dienst(db);
      // Ohne Kunden: ehrliche Antwort, keine Szene.
      const ohne = await d.frage({ text: 'Rechnung für ABC-1', kanal: 'cockpit' });
      assert.strictEqual(ohne.szene, null);
      assert.ok(/keinen Kunden/.test(ohne.text), ohne.text);
      assert.ok(/kenne ich nicht/.test((await d.frage({ text: 'Rechnung für XYZ-9' })).text));
      const k = mitKunde(db);
      const zahl = () => db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;
      const vorher = zahl();
      const n = await d.frage({ text: 'Rechnung für abc-1', kanal: 'cockpit' });
      const s = n.szene;
      assert.strictEqual(s && s.typ, 'invoice', n.text);
      assert.strictEqual(zahl(), vorher, 'Die Szene darf keine Rechnung schreiben');
      const t = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-1');
      const v = rechnung.vorschau(db, { from: t.first_day, to: t.last_day, tickets: ['ABC-1'], kontaktId: k.id,
        empfaenger: { name: 'Nordwind GmbH', anschrift: ['Ada Lind', 'Hafen 1', '20457 Hamburg'] } });
      nah(s.brutto, v.brutto_eur, 'Brutto');
      nah(s.netto, v.netto_eur, 'Netto');
      nah(s.ust, v.ust_eur, 'USt');
      nah(s.positionen.reduce((a, p) => a + p.v, 0), v.netto_eur, 'Summe der Positionen');
      // Jede Zeile hat eine Bezeichnung; Vorgangspositionen tragen Stunden und Satz wie auf der Rechnung.
      assert.ok(s.positionen.every((p) => p.l.trim()), 'Position ohne Bezeichnung: ' + JSON.stringify(s.positionen));
      s.positionen.forEach((p, i) => { assert.strictEqual(p.h, v.positionen[i].stunden); assert.strictEqual(p.satz, v.positionen[i].satz); });
      assert.ok(s.brutto > s.netto && s.ust_prozent === 19, 'USt 19 % erwartet: ' + JSON.stringify([s.netto, s.brutto]));
      assert.strictEqual(s.empfaenger, 'Nordwind GmbH');
      // Gestellt: kein zweiter Entwurf derselben Positionen.
      const r = rechnung.erstelle(db, { from: t.first_day, to: t.last_day, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1', '20457 Hamburg'] } });
      const danach = await d.frage({ text: 'Rechnung für ABC-1', kanal: 'cockpit' });
      assert.strictEqual(danach.szene, null);
      assert.ok(danach.text.includes(r.nr), danach.text);
    });
  }

  async function verlaufSzene() {
    const { db } = arbeitsDb();
    const d = dienst(db);
    const n = await d.frage({ text: 'Wie lief der Monat?', kanal: 'cockpit' });
    await d.frage({ text: 'Wie lief der Monat?', kanal: 'dock' });
    const v = d.verlauf('cockpit');
    assert.strictEqual(v.length, 2, 'nur das Cockpit-Gespraech');
    assert.strictEqual(v[0].rolle, 'ich');
    assert.strictEqual(v[0].szene, null);
    assert.deepStrictEqual(v[1].szene, n.szene);
    // Eine Antwort ohne Szene bleibt ohne.
    await d.frage({ text: 'Hallo', kanal: 'cockpit' });
    assert.strictEqual(d.verlauf('cockpit')[3].szene, null);
    // Vorschlaege fuer das Cockpit: bis zu sechs, ohne Doppelte.
    const vs = d.vorschlaege('cockpit');
    assert.ok(vs.length >= 3 && vs.length <= 6 && new Set(vs).size === vs.length, JSON.stringify(vs));
  }

  function orbStil() {
    configGeschuetzt(() => {
      const S = srv();
      const cfg = require(CFG);
      const altCira = cfg.cira;
      cfg.cira = { ...(altCira || {}) };
      delete cfg.cira.orbStil;
      try {
        assert.strictEqual(S.ciraEinstellungen().orbStil, 'partikel');
        for (const boese of ['kugel', '', 1, null]) assert.throws(() => S.setzeCira({ orbStil: boese }), /Orb-Stil: partikel, flaeche\.$/, 'nimmt ' + JSON.stringify(boese));
        assert.strictEqual(S.setzeCira({ orbStil: 'flaeche' }).orbStil, 'flaeche');
        assert.strictEqual(JSON.parse(fs.readFileSync(CFG, 'utf8')).cira.orbStil, 'flaeche');
      } finally { cfg.cira = altCira; }
    });
  }

  return [
    ['Cira C3: Szene Monat — numbers wie /api/kennzahlen', () => mitConfig(MARGE, szeneMonat)],
    ['Cira C3: Szene Verbrauch — bars wie metrics.byProject', szeneVerbrauch],
    ['Cira C3: Szene Marge — chart wie metrics.margeJeWoche', () => mitConfig(MARGE, szeneMarge)],
    ['Cira C3: Szene Ueberfaellig — numbers wie die Rechnungsliste', szeneUeberfaellig],
    ['Cira C3: Szene Rechnung — invoice wie rechnung.vorschau, schreibt nichts', szeneRechnung],
    ['Cira C3: Verlauf Szene — Antwort traegt ihre Szene zurueck', verlaufSzene],
    ['Cira C3: Orb-Stil partikel|flaeche mit Grenze', orbStil],
  ];
};
