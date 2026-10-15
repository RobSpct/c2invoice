'use strict';
// Hotfix 2.0.2: Befunde aus einem externen Review (15.10.2026). Jeder Test ist
// einmal gegen den alten Code rot gelaufen.
const assert = require('node:assert');
const http = require('node:http');

module.exports = ({ dbmod, openDbs, rechnungsUmgebung, rechnungsDb, configGeschuetzt }) => {
  const rechnung = require('../rechnung');
  const angebot = require('../angebot');
  const erechnung = require('../erechnung');
  const kontakte = require('../kontakte');
  const pricing = require('../pricing');
  const ingest = require('../ingest');

  const regel = (config) => { config.rechnung.kleinunternehmer = false; config.rechnung.ustSatz = 19; };
  const frei = (betrag) => ({ bezeichnung: 'Leistung', typ: 'pauschal', betrag_eur: betrag });
  const tag = { from: '2026-08-01', to: '2026-08-31' };

  /* H1 — USt in ganzen Cent */
  function h1() {
    // Die Rundung selbst: halbe Cent vom Null weg, auch wo die Gleitkommazahl knapp darunter liegt.
    for (const [ein, aus] of [[8.075, 8.08], [0.285, 0.29], [1.005, 1.01], [126.635, 126.64], [-8.075, -8.08], [2.675, 2.68], [0.004, 0], [1e-7, 0]]) {
      assert.strictEqual(rechnung.rund2(ein), aus, 'rund2(' + ein + ') = ' + rechnung.rund2(ein));
    }
    rechnungsUmgebung((config) => {
      regel(config);
      assert.deepStrictEqual(rechnung.steuer(42.5), { klein: false, satz: 19, ust: 8.08, brutto: 50.58 }, '42,50 EUR bei 19 %');
      assert.strictEqual(rechnung.steuer(1.5).ust, 0.29, '1,50 EUR bei 19 %');
      // Ende zu Ende: Rechnung und Angebot aus derselben Steuerformel.
      const db = rechnungsDb();
      const inv = rechnung.erstelle(db, { ...tag, posten: [frei(42.5)], empfaenger: { name: 'Kunde' } });
      assert.ok(inv.ust_eur === 8.08 && inv.brutto_eur === 50.58, 'Rechnung: ' + inv.ust_eur + ' / ' + inv.brutto_eur);
      const an = angebot.erstelle(db, { posten: [frei(1.5)], empfaenger: { name: 'Kunde' } });
      assert.strictEqual(an.ust_eur, 0.29, 'Angebot 1,50 EUR: ' + an.ust_eur);
    });
  }

  /* H2 — Betrag = gedruckte Stunden x gedruckter Satz */
  function h2() {
    rechnungsUmgebung((config) => {
      const merk = { satz: config.stundensatz, ps: config.projektSaetze };
      config.stundensatz = 95;
      config.projektSaetze = {};
      try {
        // 80 Minuten Arbeit = 1,333 h.
        const db = dbmod.open(':memory:');
        openDbs.push(db);
        const akt = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
        const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
        for (let m = 0; m <= 80; m += 2) akt.run('s-h2', t(m), 'H2 - App', 'feature/H2-1', 'H2-1', '2026-08-18');
        db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
          cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day) VALUES ('h2', ?, 's-h2', 'H2 - App', 'feature/H2-1', 'H2-1',
          'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, '2026-08-18')`).run(t(0));
        const inv = rechnung.erstelle(db, { ...tag, tickets: ['H2-1'], empfaenger: { name: 'Kunde' } });
        const p = inv.positionen[0];
        assert.strictEqual(p.stunden, 1.33, 'Stunden ' + p.stunden);
        assert.strictEqual(p.satz, 95);
        assert.strictEqual(p.betrag_eur, 126.35, 'Betrag ' + p.betrag_eur + ' statt 1,33 x 95 = 126,35');
        // Freie Position mit 1,333 h genauso.
        const f = rechnung.freiePosition({ bezeichnung: 'Frei', stunden: 1.333, satz: 95 }, 0);
        assert.ok(f.stunden === 1.33 && f.betrag_eur === 126.35, 'freie Position ' + JSON.stringify(f));
        // E-Rechnung: Menge x Preis = Betrag mit genau den gedruckten Stunden.
        regel(config);
        const inv2 = rechnung.erstelle(db, { ...tag, posten: [{ bezeichnung: 'Frei', stunden: 1.333, satz: 95 }], empfaenger: { name: 'Kunde', email: 'k@example.org' } });
        const mp = erechnung.mengeUndPreis(inv2.positionen[0]);
        assert.ok(mp.menge === '1.33' && mp.preis === '95.00', 'E-Rechnung ' + JSON.stringify(mp));
        assert.ok(rechnung.renderHtml(inv2).includes('126,35'), 'Druck zeigt den Betrag nicht');
      } finally {
        config.stundensatz = merk.satz;
        config.projektSaetze = merk.ps;
      }
    });
  }

  /* H3 — Ersatzpreise, Rang, Staffel, Nachbepreisung */
  function h3() {
    const orig = { t: pricing.tabelle(), i: pricing.info() };
    try {
      // Ohne Liste: Ersatztabelle mit Listenpreis, aber als "fallback" gekennzeichnet.
      pricing.setzeTabelle(null, 'fallback', null);
      assert.strictEqual(pricing.preisArt('claude-opus-5'), 'fallback');
      assert.ok(Math.abs(pricing.costOf('claude-opus-5', { input_tokens: 1e6 }) - 5) < 1e-9, 'Opus 5 nicht 5 USD/Mio');
      assert.ok(Math.abs(pricing.costOf('claude-fable-5', { input_tokens: 1e6 }) - 10) < 1e-9, 'Fable 5 nicht 10 USD/Mio');

      // Rang: ohne Praefix vor anthropic/ vor dem Rest, unabhaengig von der Reihenfolge.
      const e = (inp) => ({ litellm_provider: 'x', input_cost_per_token: inp, output_cost_per_token: inp * 5 });
      for (const reihe of [['aihubmix/claude-x', 'claude-x'], ['claude-x', 'aihubmix/claude-x']]) {
        const roh = Object.fromEntries(reihe.map((n) => [n, e(n.includes('/') ? 11e-6 : 10e-6)]));
        assert.strictEqual(pricing.normalizeLiteLLM(roh)['claude-x'].in, 10e-6, 'Reihenfolge ' + reihe.join(','));
      }
      const y = pricing.normalizeLiteLLM({ 'vertex_ai/claude-y': e(3e-6), 'anthropic/claude-y': e(2e-6), 'zz/claude-y': e(4e-6) });
      assert.strictEqual(y['claude-y'].in, 2e-6, 'anthropic/ gewinnt nicht');
      // Vergiftete Liste: unendliche, negative oder Text-Preise fallen raus; Objektnamen sind keine Modelle.
      const gift = pricing.normalizeLiteLLM(JSON.parse('{"claude-inf": {"litellm_provider":"anthropic","input_cost_per_token":1e-6,"output_cost_per_token":5e-6,"cache_read_input_token_cost":1e999},' +
        '"claude-neg": {"litellm_provider":"anthropic","input_cost_per_token":-1e-6,"output_cost_per_token":5e-6},' +
        '"claude-txt": {"litellm_provider":"anthropic","input_cost_per_token":1e-6,"output_cost_per_token":5e-6,"cache_creation_input_token_cost":"1"},' +
        '"__proto__": {"litellm_provider":"anthropic","input_cost_per_token":1e-6,"output_cost_per_token":5e-6}}'));
      assert.deepStrictEqual(Object.keys(gift), [], 'ungueltige Preise uebernommen: ' + Object.keys(gift).join(','));
      pricing.setzeTabelle(pricing.normalizeLiteLLM({ 'claude-x': e(1e-6) }), 'test');
      for (const m of ['constructor', 'toString', '__proto__']) assert.strictEqual(pricing.preisArt(m), 'ohne', m + ' gilt als bepreist');

      // Staffel: ueber 200k Eingabe gilt fuer den ganzen Request der hoehere Preis.
      const st = pricing.normalizeLiteLLM({ 'claude-s': { ...e(3e-6), input_cost_per_token_above_200k_tokens: 6e-6, output_cost_per_token_above_200k_tokens: 22.5e-6 } });
      pricing.setzeTabelle(st, 'test');
      assert.ok(Math.abs(pricing.costOf('claude-s', { input_tokens: 150000, output_tokens: 1000 }) - (150000 * 3e-6 + 1000 * 15e-6)) < 1e-12, 'unter 200k');
      assert.ok(Math.abs(pricing.costOf('claude-s', { input_tokens: 50000, cache_read: 200000, output_tokens: 1000 }) - (50000 * 6e-6 + 200000 * 0.6e-6 + 1000 * 22.5e-6)) < 1e-12, 'ueber 200k (mit Cache)');

      // Nachbepreisung: "fallback"-Zeilen bekommen den Listenpreis, sobald die Liste da ist;
      // exakte Zeilen einmal je Listen-Version neu aus den Tokens.
      const db = dbmod.open(':memory:');
      openDbs.push(db);
      const ins = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
        web_search, cost_usd, is_sidechain, day, source, preis_art) VALUES (?, '2026-08-18T10:00:00Z', 's', 'P', ?, 1000000, 0, 0, 0, 0, 0, ?, 0, '2026-08-18', 'claude', ?)`);
      ins.run('f1', 'claude-opus-5', 15, 'fallback');
      ins.run('x1', 'claude-fable-5', 11, null);
      pricing.setzeTabelle({ 'claude-opus-5': { in: 5e-6, out: 25e-6, cw5m: 6.25e-6, cw1h: 10e-6, cr: 0.5e-6 }, 'claude-fable-5': { in: 10e-6, out: 50e-6, cw5m: 12.5e-6, cw1h: 20e-6, cr: 1e-6 } }, 'test', 2);
      const z = (id) => db.prepare('SELECT cost_usd, preis_art FROM events WHERE request_id = ?').get(id);
      assert.ok(ingest.gleichePreiseAb(db) >= 2);
      assert.deepStrictEqual({ ...z('f1') }, { cost_usd: 5, preis_art: null }, 'fallback-Zeile nicht nachbepreist');
      assert.strictEqual(z('x1').cost_usd, 10, 'exakte Zeile mit Kollisionspreis nicht neu gerechnet');
      // Nur einmal je Version: ein spaeter abweichender Betrag bleibt.
      db.exec("UPDATE events SET cost_usd = 11 WHERE request_id = 'x1'");
      ingest.gleichePreiseAb(db);
      assert.strictEqual(z('x1').cost_usd, 11, 'zweiter Lauf hat erneut neu gerechnet');
      // Ohne Liste geschieht nichts.
      pricing.setzeTabelle(null, 'fallback', null);
      ins.run('f2', 'claude-opus-5', 15, 'fallback');
      assert.strictEqual(ingest.gleichePreiseAb(db), 0);
      assert.strictEqual(z('f2').cost_usd, 15);
    } finally {
      pricing.setzeTabelle(orig.t, orig.i.source, orig.i.version);
    }
  }

  /* H4 — keine doppelte Abrechnung im selben Zeitraum */
  function h4() {
    rechnungsUmgebung(() => {
      const db = rechnungsDb();
      // Zweiter Arbeitstag im September.
      db.prepare(`INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES ('s-r', '2026-09-18T10:00:00Z', 'Beispiel - App', 'feature/PROJ-500', 'PROJ-500', '2026-09-18')`).run();
      db.prepare(`INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES ('s-r', '2026-09-18T10:02:00Z', 'Beispiel - App', 'feature/PROJ-500', 'PROJ-500', '2026-09-18')`).run();
      db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
        web_search, cost_usd, is_sidechain, day) VALUES ('r9', '2026-09-18T10:00:00Z', 's-r', 'Beispiel - App', 'feature/PROJ-500', 'PROJ-500', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, '2026-09-18')`).run();
      const d = (from, to) => ({ from, to, tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } });
      const aug = rechnung.erstelle(db, d('2026-08-01', '2026-08-31'));
      const doppelt = (from, to, wie) => {
        let fehler = null;
        try { wie(d(from, to)); } catch (e) { fehler = e; }
        assert.ok(fehler && fehler.abweichung === true && /schon auf Rechnung/.test(fehler.message), from + '–' + to + ': ' + (fehler && fehler.message));
      };
      doppelt('2026-08-01', '2026-08-31', (x) => rechnung.erstelle(db, x));
      doppelt('2026-08-15', '2026-09-30', (x) => rechnung.erstelle(db, x));
      doppelt('2026-08-01', '2026-08-31', (x) => rechnung.vorschau(db, x));
      // Getrennter Zeitraum (Teilabrechnung je Monat) bleibt erlaubt.
      const sep = rechnung.erstelle(db, d('2026-09-01', '2026-09-30'));
      assert.ok(sep.nr && sep.positionen[0].von === '2026-09-18');
      // Nach dem Storno ist der August wieder abrechenbar.
      rechnung.storniere(db, aug.nr);
      assert.ok(rechnung.erstelle(db, d('2026-08-01', '2026-08-31')).nr, 'nach Storno weiter gesperrt');
      // Auch der Weg ueber ein Angebot mit gemessenem Vorgang ist gesperrt.
      const an = angebot.erstelle(db, { ...d('2026-09-01', '2026-09-30'), empfaenger: { name: 'Kunde' } });
      let fa = null;
      try { angebot.inRechnung(db, an.nr); } catch (e) { fa = e; }
      assert.ok(fa && fa.abweichung && /schon auf Rechnung/.test(fa.message), 'Angebot rechnet doppelt ab: ' + (fa && fa.message));
      assert.strictEqual(angebot.lade(db, an.nr).rechnung_nr, null);
      // Manuelle Zeitpositionen und freie Posten sperren nichts.
      assert.ok(rechnung.erstelle(db, { ...tag, posten: [frei(10)], empfaenger: { name: 'Kunde' } }).nr);
    }, { doppeltPruefen: true });
  }

  /* H5 — keine Rechnung ohne Steuerangabe */
  function h5() {
    rechnungsUmgebung((config) => {
      config.rechnung.kleinunternehmer = false;
      config.rechnung.ustSatz = 0;
      assert.ok(rechnung.fehlendeStammdaten().includes('rechnung.ustSatz oder kleinunternehmer'), 'Luecke nicht gemeldet');
      const db = rechnungsDb();
      assert.throws(() => rechnung.erstelle(db, { ...tag, posten: [frei(10)], empfaenger: { name: 'Kunde' } }), /Stammdaten unvollstaendig/);
      config.rechnung.kleinunternehmer = true;
      assert.ok(!rechnung.fehlendeStammdaten().length, 'Kleinunternehmer mit Satz 0 gilt als unvollstaendig');
      config.rechnung.kleinunternehmer = false;
      config.rechnung.ustSatz = 19;
      assert.ok(!rechnung.fehlendeStammdaten().length);
    });
    // Speichern ueber die Einstellungen meldet die Luecke zurueck (Spiegel der Pruefung).
    configGeschuetzt(() => rechnungsUmgebung(() => {
      const r = require('../server').setzeStammdaten({ kleinunternehmer: false, ustSatz: 0 });
      assert.ok(r.fehlt.includes('rechnung.ustSatz oder kleinunternehmer'), JSON.stringify(r));
    }));
  }

  /* H6 — Storno gibt das Angebot frei, Uebernahme atomar */
  function h6() {
    rechnungsUmgebung(() => {
      const db = rechnungsDb();
      const k = kontakte.speichere(db, { firma: 'Angebot GmbH', status: 'lead' });
      const an = angebot.erstelle(db, { posten: [frei(100)], empfaenger: { name: 'Angebot GmbH' }, kontaktId: k.id });
      const r1 = angebot.inRechnung(db, an.nr);
      rechnung.storniere(db, r1.rechnung.nr);
      assert.strictEqual(angebot.lade(db, an.nr).rechnung_nr, null, 'Angebot nach Storno weiter gesperrt');
      const r2 = angebot.inRechnung(db, an.nr);
      assert.ok(r2.rechnung.nr !== r1.rechnung.nr && angebot.lade(db, an.nr).rechnung_nr === r2.rechnung.nr);
      // Scheitert das Nachziehen am Angebot, entsteht auch keine Rechnung.
      rechnung.storniere(db, r2.rechnung.nr);
      const zaehle = () => db.prepare('SELECT COUNT(*) n FROM invoices').get().n;
      const vorher = zaehle();
      const echt = kontakte.macheKunde;
      kontakte.macheKunde = () => { throw new Error('Kontakt kaputt'); };
      try {
        assert.throws(() => angebot.inRechnung(db, an.nr), /Kontakt kaputt/);
      } finally { kontakte.macheKunde = echt; }
      assert.strictEqual(zaehle(), vorher, 'Rechnung ohne Angebotsvermerk geschrieben');
      assert.strictEqual(angebot.lade(db, an.nr).rechnung_nr, null);
    });
  }

  /* H7 — Proxy und CORS */
  async function h7() {
    const proxy = require('../ollama-proxy');
    assert.ok(proxy.hostErlaubt('127.0.0.1:11435') && proxy.hostErlaubt('localhost') && proxy.hostErlaubt(undefined));
    assert.ok(!proxy.hostErlaubt('boese.example:11435') && !proxy.hostErlaubt('127.0.0.1.boese.example'));
    assert.ok(proxy.hostErlaubt('host.docker.internal:11435', ['host.docker.internal']), 'konfigurierter Name abgewiesen');
    // Eigene Verbindung je Anfrage und eine Zeitgrenze: eine wiederverwendete,
    // ruhende Keep-Alive-Verbindung haelt den Prozess nicht am Leben, und Node
    // endete sonst still mitten im Test (wiki: haengender-test-beendet-node-still).
    const frage = (server, headers) => new Promise((ok, nein) => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/v1/models', headers, agent: false }, (r) => { r.resume(); r.on('end', () => ok(r)); });
      req.setTimeout(5000, () => req.destroy(new Error('Zeitgrenze bei ' + JSON.stringify(headers))));
      req.on('error', nein);
      req.end();
    });
    await new Promise((ok) => proxy.server.listen(0, '127.0.0.1', ok));
    try {
      // Der eigene Host ginge an den echten Modellserver weiter; das deckt hostErlaubt oben ab.
      assert.strictEqual((await frage(proxy.server, { host: 'boese.example' })).statusCode, 421, 'Proxy bedient fremden Host');
    } finally { proxy.server.closeAllConnections(); await new Promise((ok) => proxy.server.close(ok)); }

    const srv = require('../server');
    const lauscht = srv.server.listening;
    if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
    try {
      const port = srv.server.address().port;
      const fremd = await frage(srv.server, { host: '127.0.0.1:' + port, origin: 'http://127.0.0.1:9999' });
      assert.strictEqual(fremd.headers['access-control-allow-origin'], undefined, 'anderer lokaler Port darf lesen');
      const eigen = await frage(srv.server, { host: '127.0.0.1:' + port, origin: 'http://127.0.0.1:' + port });
      assert.strictEqual(eigen.headers['access-control-allow-origin'], 'http://127.0.0.1:' + port);
      const obs = await frage(srv.server, { host: '127.0.0.1:' + port, origin: 'app://obsidian.md' });
      assert.strictEqual(obs.headers['access-control-allow-origin'], 'app://obsidian.md');
    } finally {
      if (!lauscht) { srv.server.closeAllConnections(); await new Promise((ok) => srv.server.close(ok)); }
    }
  }

  return [
    ['H1 USt in ganzen Cent: 42,50 -> 8,08, 1,50 -> 0,29, Rechnung und Angebot', h1],
    ['H2 Positionsbetrag aus gedruckten Stunden x Satz, Druck und E-Rechnung', h2],
    ['H3 Ersatzpreise als fallback, Rang je Anbieter, Staffel, Nachbepreisung', h3],
    ['H4 Vorgang im selben Zeitraum nicht doppelt abrechenbar (409), getrennt erlaubt', h4],
    ['H5 Keine Rechnung ohne Kleinunternehmer und ohne USt-Satz', h5],
    ['H6 Storno gibt Angebot frei, Uebernahme schreibt alles oder nichts', h6],
    ['H7 Proxy weist fremden Host ab, CORS nur eigene Herkunft', h7],
  ];
};
