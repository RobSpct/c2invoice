'use strict';
// Budget je Vorgang (Owner 20.10.2026): manuell in Euro, verbraucht = Arbeitswert
// des ganzen Vorgangs inkl. manueller Zeit. Ampel < 60 ok · 60–80 warn ·
// 80–100 acc · > 100 bad; Hinweis 80 und 100. Plan design/cira/BUDGET-PLAN.md.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = ({ dbmod, openDbs }) => {
  const metrics = require('../../metrics');
  const board = require('../../board');
  const zeit = require('../../zeit');

  function arbeitsDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const insE = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, cwd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insA = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)');
    let n = 0;
    // Eine Stunde Arbeit ab `beginn` (ms), alle drei Minuten eine Eingabe.
    const stunde = (session, beginn, ticket) => {
      for (let m = 0; m <= 60; m += 3) {
        const ts = new Date(beginn + m * 60000).toISOString();
        insE.run('bu-' + n++, ts, session, 'Proj', 'main', ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, ts.slice(0, 10), null);
        insA.run(session, ts, 'Proj', 'main', ticket, ts.slice(0, 10), 1);
      }
    };
    return { db, stunde };
  }
  const wert = (db, key) => metrics.byTicket(db, {}).find((t) => t.ticket === key).arbeitswert;

  return [
    ['Budget budgetStand: Grenzen 60/80/100, Rest, Balken, Hinweis', () => {
      const s = (v) => metrics.budgetStand(1000, v);
      // Stufe und Hinweis folgen der angezeigten (gerundeten) Zahl: „60 %“ ist nie gruen.
      assert.deepStrictEqual([s(594).stufe, s(595).stufe, s(794).stufe, s(795).stufe, s(1000).stufe, s(1004).stufe, s(1006).stufe],
        ['ok', 'warn', 'warn', 'acc', 'acc', 'acc', 'bad']);
      assert.deepStrictEqual([s(794).hinweis, s(795).hinweis, s(994).hinweis, s(995).hinweis, s(1500).hinweis], [null, 80, 80, 100, 100]);
      // Beispiel aus PLAN-2.0 Block 11: 4.100 von 5.000 = 82 %, orange, Hinweis 80.
      const b = metrics.budgetStand(5000, 4100);
      assert.deepStrictEqual(b, { budget_eur: 5000, verbraucht_eur: 4100, rest_eur: 900, prozent: 82, balken: 82, stufe: 'acc', hinweis: 80 });
      const u = metrics.budgetStand(200, 300.456);
      assert.deepStrictEqual([u.verbraucht_eur, u.rest_eur, u.prozent, u.balken, u.stufe], [300.46, -100.46, 150, 100, 'bad']);
      assert.strictEqual(metrics.budgetStand(100, 0).prozent, 0);
    }],

    ['Budget setzen: Vorgang ohne Gross-/Kleinschreibung, verbraucht inkl. manueller Zeit, null entfernt', () => {
      const { db, stunde } = arbeitsDb();
      stunde('s-1', Date.now() - 5 * 3600e3, 'ABC-5');
      const ohneManuell = wert(db, 'ABC-5');
      assert.ok(ohneManuell > 0, 'Saat ohne Arbeitswert');
      zeit.speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'ABC-5', start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T16:00:00.000Z',
        pause_min: 0, taetigkeit: 'Entwicklung', notiz: '', abrechenbar: true });
      const mitManuell = wert(db, 'ABC-5');
      assert.ok(mitManuell > ohneManuell, 'manuelle Zeit fehlt im Arbeitswert');
      const r = metrics.setzeBudget(db, { vorgang: ' abc-5 ', budget_eur: 1234.567 });
      assert.strictEqual(r.vorgang, 'ABC-5', 'Schluessel wie in der Auswertung gespeichert');
      assert.strictEqual(r.budget.budget_eur, 1234.57);
      const liste = metrics.budgets(db);
      assert.strictEqual(liste.length, 1);
      assert.strictEqual(liste[0].vorgang, 'ABC-5');
      assert.strictEqual(liste[0].verbraucht_eur, Math.round(mitManuell * 100) / 100, 'verbraucht ist nicht der Arbeitswert inkl. manueller Zeit');
      assert.deepStrictEqual(metrics.budgetFuer(db, 'abc-5'), liste[0]);
      assert.deepStrictEqual(metrics.setzeBudget(db, { vorgang: 'ABC-5', budget_eur: null }), { vorgang: 'ABC-5', budget: null });
      assert.deepStrictEqual(metrics.budgets(db), []);
      assert.strictEqual(metrics.budgetFuer(db, 'ABC-5'), null);
    }],

    ['Budget setzen: ungueltige Werte und unbekannter Vorgang → Fehler, nichts gespeichert', () => {
      const { db, stunde } = arbeitsDb();
      stunde('s-1', Date.now() - 5 * 3600e3, 'ABC-5');
      metrics.setzeBudget(db, { vorgang: 'ABC-5', budget_eur: 300 });
      // 0.001 besteht „> 0“, auf Cent gerundet bliebe 0 und die Prozentrechnung teilte durch 0 (Security-Review).
      for (const v of [0, 0.001, 0.004, -5, 'abc', '100', 1e9, NaN, Infinity, undefined]) {
        assert.throws(() => metrics.setzeBudget(db, { vorgang: 'ABC-5', budget_eur: v }), /Budget/, 'angenommen: ' + v);
      }
      for (const k of ['', '   ', null, 5, 'x'.repeat(201)]) {
        assert.throws(() => metrics.setzeBudget(db, { vorgang: k, budget_eur: 100 }), /Vorgang/, 'Vorgang angenommen: ' + k);
      }
      assert.throws(() => metrics.setzeBudget(db, { vorgang: 'XYZ-1', budget_eur: 100 }), /Unbekannter Vorgang/);
      assert.strictEqual(metrics.budgetFuer(db, 'ABC-5').budget_eur, 300, 'ungueltige Eingabe hat das Budget veraendert');
      assert.strictEqual(metrics.setzeBudget(db, { vorgang: 'ABC-5', budget_eur: 10000000 }).budget.budget_eur, 10000000);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM vorgang_budget').get().n, 1);
    }],

    ['Budget Review: Schreibweisen desselben Vorgangs werden addiert, nicht ueberschrieben', () => {
      const { db, stunde } = arbeitsDb();
      stunde('s-1', Date.now() - 6 * 3600e3, 'ABC-9');
      stunde('s-2', Date.now() - 4 * 3600e3, 'abc-9');
      const rows = metrics.byTicket(db, {}).filter((t) => t.ticket.toUpperCase() === 'ABC-9');
      assert.strictEqual(rows.length, 2, 'Saat: zwei Schreibweisen');
      metrics.setzeBudget(db, { vorgang: 'ABC-9', budget_eur: 1000 });
      const summe = Math.round((rows[0].arbeitswert + rows[1].arbeitswert) * 100) / 100;
      assert.strictEqual(metrics.budgetFuer(db, 'abc-9').verbraucht_eur, summe);
    }],

    ['Budget Hinweise kommen aus allen Budgets, nicht aus dem Zeitraum', () => {
      const { db, stunde } = arbeitsDb();
      // Arbeit vor 40 Tagen: im laufenden Monat keine Zeile, das Budget gilt trotzdem.
      stunde('s-alt', Date.now() - 40 * 86400e3, 'ALT-1');
      stunde('s-neu', Date.now() - 5 * 3600e3, 'NEU-1');
      metrics.setzeBudget(db, { vorgang: 'ALT-1', budget_eur: 1 });
      metrics.setzeBudget(db, { vorgang: 'NEU-1', budget_eur: 1e6 });
      const h = new Date();
      const monat = { from: h.toISOString().slice(0, 8) + '01', to: h.toISOString().slice(0, 10) };
      assert.ok(!metrics.byTicket(db, monat).some((t) => t.ticket === 'ALT-1'), 'Saat: ALT-1 liegt im Zeitraum');
      const b = metrics.budgets(db);
      assert.deepStrictEqual(b.map((x) => [x.vorgang, x.hinweis]).sort(), [['ALT-1', 100], ['NEU-1', null]]);
    }],

    ['Budget Board-Karte traegt den Stand, ohne Budget null', async () => {
      const { db, stunde } = arbeitsDb();
      stunde('s-1', Date.now() - 5 * 3600e3, 'P-1');
      stunde('s-2', Date.now() - 3 * 3600e3, 'P-2');
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-budget-'));
      fs.writeFileSync(path.join(d, 'TODO.md'), '# Proj\n- [ ] Eins @id:P-1 @status:in-progress\n- [ ] Zwei @id:P-2 @status:in-progress\n');
      const x = board.erzeuge({ db, bereiche: () => [{ name: 'Proj', pfad: d, kuerzel: 'PR' }], loeseHeim: (p) => p, gesperrt: () => [], jetzt: () => Date.now() });
      metrics.setzeBudget(db, { vorgang: 'p-1', budget_eur: 50 });
      const karten = (await x.board('alle', 'lokal')).spalten.arbeit.karten;
      const k1 = karten.find((k) => k.schluessel === 'P-1');
      const k2 = karten.find((k) => k.schluessel === 'P-2');
      assert.deepStrictEqual(k1.budget, metrics.budgetFuer(db, 'P-1'));
      assert.strictEqual(k1.budget.verbraucht_eur, Math.round(k1.wert_eur * 100) / 100, 'Karte und Budget rechnen mit verschiedenem Verbrauch');
      assert.strictEqual(k2.budget, null);
    }],

    ['Budget wandert bei Als Jira mit, ein Budget des Ziels gewinnt', () => {
      const { db, stunde } = arbeitsDb();
      stunde('s-1', Date.now() - 5 * 3600e3, 'P-7');
      stunde('s-2', Date.now() - 3 * 3600e3, 'P-8');
      stunde('s-3', Date.now() - 2 * 3600e3, 'DEV-8');
      metrics.setzeBudget(db, { vorgang: 'P-7', budget_eur: 700 });
      board.uebernehmeZeit(db, 'p-7', 'DEV-7');
      assert.strictEqual(metrics.budgetFuer(db, 'DEV-7').budget_eur, 700);
      assert.strictEqual(metrics.budgetFuer(db, 'P-7'), null);
      metrics.setzeBudget(db, { vorgang: 'P-8', budget_eur: 800 });
      metrics.setzeBudget(db, { vorgang: 'DEV-8', budget_eur: 900 });
      board.uebernehmeZeit(db, 'P-8', 'DEV-8');
      assert.strictEqual(metrics.budgetFuer(db, 'DEV-8').budget_eur, 900);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM vorgang_budget').get().n, 2, 'altes Budget bleibt als Leiche stehen');
    }],
  ];
};
