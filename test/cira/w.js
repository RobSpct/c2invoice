'use strict';
// Block W (Issue #2): Interaktionszeit auf den Menschen. Nach einer Uebergabe
// (Zug-Ende, Rueckfrage, Plan zur Freigabe) zaehlt die Luecke bis zur naechsten
// eigenen Eingabe bis `interaktionMinuten` ganz — in beiden Zeitmodellen. Darueber,
// oder wenn der Agent dazwischen arbeitet, rechnet alles wie vorher.
// Gegenprobe: design/werkzeuge/w-gates.js mutation.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = ({ dbmod, openDbs } = {}) => {
  const metrics = require('../../metrics');
  const ingest = require('../../ingest');
  const cfg = require('../../config.json');

  // Setzt Pausenschwelle, Zeitmodell und Interaktionszeit fuer die Dauer eines Tests.
  // Kein Test darf sich auf den Wert in config.json verlassen.
  function mit(gapMinutes, zeitmodell, interaktionMinuten, fn) {
    const vorher = { gapMinutes: cfg.gapMinutes, zeitmodell: cfg.zeitmodell, interaktionMinuten: cfg.interaktionMinuten };
    cfg.gapMinutes = gapMinutes;
    cfg.zeitmodell = zeitmodell;
    if (interaktionMinuten === undefined) delete cfg.interaktionMinuten; else cfg.interaktionMinuten = interaktionMinuten;
    try {
      return fn();
    } finally {
      for (const [k, v] of Object.entries(vorher)) {
        if (v === undefined) delete cfg[k]; else cfg[k] = v;
      }
    }
  }

  const BASIS = Date.UTC(2026, 10, 18, 9, 0, 0);
  const ts = (min) => new Date(BASIS + min * 60000).toISOString();
  // Zeilenarten wie ingest.js sie schreibt: [eingabe, warte].
  const ART = {
    eingabe: [1, 0], arbeit: [0, 0], uebergabe: [0, 2], neutral: [0, 1], alt: [null, null], altEingabe: [1, null],
  };
  // zeilen: [[sitzung, minute, art, ticket?, projekt?], ...]. Je Sitzung und
  // Vorgang ein Request, damit die Auswertungen beide kennen.
  function db(zeilen, { wahl = [] } = {}) {
    const d = dbmod.open(':memory:');
    openDbs.push(d);
    const insA = d.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe, warte) VALUES (?,?,?,?,?,?,?,?)');
    const insE = d.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const gesehen = new Set();
    for (const [s, min, art, ticket = 'W-1', projekt = 'Projekt W'] of zeilen) {
      if (!ART[art]) throw new Error('unbekannte Art ' + art);
      const [eingabe, w] = ART[art];
      const t = ts(min);
      insA.run(s, t, projekt, 'main', ticket, t.slice(0, 10), eingabe, w);
      if (!gesehen.has(s + ticket)) {
        gesehen.add(s + ticket);
        insE.run('w-' + s + ticket, t, s, projekt, 'main', ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, t.slice(0, 10));
      }
    }
    for (const [art, schluessel, modell] of wahl) {
      d.prepare('INSERT INTO zeitmodell_wahl (art, schluessel, zeitmodell) VALUES (?,?,?)').run(art, schluessel, modell);
    }
    return d;
  }
  const sek = (d) => metrics.summary(d, {}).active_seconds;
  // Rechnet dieselben Zeilen mit einer anderen Interaktionszeit (frische DB, kein Speicher).
  const mitWarten = (gap, modell, warten, zeilen, opt) => mit(gap, modell, warten, () => sek(db(zeilen, opt)));

  // Plan-Runde: Eingabe 0, Agent arbeitet bis 3 und uebergibt, Claude Code
  // schreibt bei 6 die Zusammenfassung (neutral), Antwort bei 20, danach Arbeit
  // bis zur naechsten Uebergabe bei 22.
  const PLAN = [
    ['s1', 0, 'eingabe'], ['s1', 1, 'arbeit'], ['s1', 2, 'arbeit'], ['s1', 3, 'uebergabe'],
    ['s1', 6, 'neutral'], ['s1', 20, 'eingabe'], ['s1', 21, 'arbeit'], ['s1', 22, 'uebergabe'],
  ];
  // Erzwingt die Abfrage ueber alle Zeilen: eine fremde Sitzung waehlt "aktivitaet".
  const ALLE_ZEILEN = { wahl: [['sitzung', 'fremd', 'aktivitaet']] };

  return [
    ['W warteArt: Uebergabe, neutral und Arbeit an echten Zeilenformen', () => {
      const a = (extra, message) => ({ type: 'assistant', timestamp: ts(0), sessionId: 's', message, ...extra });
      const w = (o, soll, was) => assert.strictEqual(ingest.warteArt(o), soll, was + ': ' + ingest.warteArt(o) + ' statt ' + soll);
      w(a({}, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Fertig.' }] }), 2, 'Zug-Ende');
      w(a({}, { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] }), 2, 'Rueckfrage');
      w(a({}, { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'ExitPlanMode', input: {} }] }), 2, 'Plan zur Freigabe');
      w(a({}, { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'Bash', input: {} }] }), 0, 'Werkzeugaufruf');
      w(a({}, { stop_reason: null, content: [{ type: 'thinking', thinking: '...' }] }), 0, 'Denkblock');
      w(a({ isSidechain: true }, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'x' }] }), 0, 'Zug-Ende eines Unteragenten');
      w(a({ isSidechain: true }, { content: [{ type: 'tool_use', name: 'AskUserQuestion' }] }), 0, 'Rueckfrage eines Unteragenten');
      w({ type: 'system', subtype: 'away_summary', timestamp: ts(0) }, 1, 'Zusammenfassung waehrend des Wartens');
      w({ type: 'system', subtype: 'turn_duration', timestamp: ts(0) }, 1, 'Zugdauer');
      w({ type: 'attachment', timestamp: ts(0) }, 1, 'Anhang');
      w({ type: 'user', isMeta: true, message: { content: 'x' } }, 1, 'Meta-Zeile');
      w({ type: 'user', message: { content: 'Weiter' } }, 0, 'eigene Eingabe');
      w({ type: 'queue-operation', timestamp: ts(0) }, 1, 'Warteschlange');
      // Unbekannt heisst Arbeit: die Interaktionszeit endet, es gilt die alte Rechnung.
      w({ type: 'api-request', timestamp: ts(0) }, 0, 'API-Anfrage');
      w({ type: 'system', subtype: 'scheduled_task_fire', timestamp: ts(0) }, 0, 'geplante Aufgabe startet');
      w({ type: 'system', subtype: 'neu_in_claude_code', timestamp: ts(0) }, 0, 'unbekannte Systemzeile');
      w({ type: 'neuer-typ', timestamp: ts(0) }, 0, 'unbekannter Zeilentyp');
      w({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } }, 0, 'Werkzeugergebnis');
      w(null, 0, 'leere Zeile');
    }],

    ['W aktivitaet: Interaktionszeit nach der Uebergabe zaehlt bis zur Schwelle ganz', () => {
      // Ohne Regel: 0-3, 3-6 und 20-22 = 8 Minuten. Mit Regel: 0-22 durchgehend.
      assert.strictEqual(mitWarten(5, 'aktivitaet', 0, PLAN), 8 * 60, 'Ausgangslage ohne Interaktionszeit');
      assert.strictEqual(mitWarten(5, 'aktivitaet', 30, PLAN), 22 * 60, 'Interaktionszeit 3-20 fehlt');
      // Vorgabe ohne Eintrag in config.json: 30 Minuten.
      assert.strictEqual(mitWarten(5, 'aktivitaet', undefined, PLAN), 22 * 60, 'Vorgabe greift nicht');
      // Genau an der Schwelle zaehlt sie noch, eine Minute darueber nicht mehr.
      assert.strictEqual(mitWarten(5, 'aktivitaet', 17, PLAN), 22 * 60, 'an der Schwelle verloren');
      assert.strictEqual(mitWarten(5, 'aktivitaet', 16, PLAN), 8 * 60, 'ueber der Schwelle trotzdem gezaehlt');
      mit(5, 'aktivitaet', 30, () => {
        const d = db(PLAN);
        const projekte = metrics.byProject(d, {}).reduce((a, p) => a + p.active_seconds, 0);
        assert.strictEqual(projekte, sek(d), 'Summe der Projekte weicht vom Gesamtwert ab');
        const vorgang = metrics.byTicket(d, {})[0];
        assert.strictEqual(vorgang.active_seconds, 22 * 60, 'Vorgang traegt die Interaktionszeit nicht');
        // Interaktionszeit ist keine Maschinenzeit.
        assert.strictEqual(vorgang.agent_seconds, 8 * 60, 'Agentenzeit enthaelt die Interaktionszeit');
      });
    }],

    ['W eingaben: Fenster beginnt an der Uebergabe statt eine halbe Schwelle vorher', () => {
      // Ohne Regel: [-2,5..2,5] und [17,5..22,5] = 10 Minuten.
      // Mit Regel: [-2,5..2,5] und [3..22,5] = 24,5 Minuten.
      for (const opt of [undefined, ALLE_ZEILEN]) {
        const wie = opt ? ' (Abfrage ueber alle Zeilen)' : ' (Abfrage nur Eingaben)';
        assert.strictEqual(mitWarten(5, 'eingaben', 0, PLAN, opt), 10 * 60, 'Ausgangslage' + wie);
        assert.strictEqual(mitWarten(5, 'eingaben', 30, PLAN, opt), 24.5 * 60, 'Interaktionszeit fehlt' + wie);
        assert.strictEqual(mitWarten(5, 'eingaben', 16, PLAN, opt), 10 * 60, 'ueber der Schwelle gezaehlt' + wie);
      }
      // Uebergabe kurz nach der Eingabe: das Fenster waechst zusammen, die Sitzung
      // zaehlt beim Verteilen als ein Teilnehmer. [-2,5..12,5] = 15 Minuten.
      const kurz = [['s1', 0, 'eingabe'], ['s1', 1, 'uebergabe'], ['s1', 10, 'eingabe']];
      mit(5, 'eingaben', 30, () => {
        const abschnitte = metrics.zeitAbschnitte(db(kurz), { von: null, bis: null });
        assert.strictEqual(abschnitte.length, 1, abschnitte.length + ' Abschnitte statt einem zusammengewachsenen');
      });
      assert.strictEqual(mitWarten(5, 'eingaben', 30, kurz), 15 * 60, 'zusammengewachsenes Fenster');
    }],

    ['W neutrale Zeilen lassen die Interaktionszeit offen', () => {
      const viele = [['s1', 0, 'eingabe'], ['s1', 3, 'uebergabe'], ['s1', 6, 'neutral'], ['s1', 12, 'neutral'],
        ['s1', 14, 'neutral'], ['s1', 20, 'eingabe']];
      assert.strictEqual(mitWarten(5, 'aktivitaet', 30, viele), 20 * 60, 'aktivitaet');
      assert.strictEqual(mitWarten(5, 'eingaben', 30, viele), 24.5 * 60, 'eingaben');
    }],

    ['W Agentenarbeit zwischen Uebergabe und Eingabe beendet die Interaktionszeit', () => {
      // Bei 8 arbeitet der Agent wieder (z. B. ein Hintergrund-Agent meldet sich).
      const arbeit = [['s1', 0, 'eingabe'], ['s1', 3, 'uebergabe'], ['s1', 6, 'neutral'], ['s1', 8, 'arbeit'],
        ['s1', 20, 'eingabe'], ['s1', 22, 'arbeit']];
      for (const modell of ['aktivitaet', 'eingaben']) {
        for (const opt of [undefined, ALLE_ZEILEN]) {
          assert.strictEqual(mitWarten(5, modell, 30, arbeit, opt), mitWarten(5, modell, 0, arbeit, opt),
            modell + (opt ? ' (alle Zeilen)' : '') + ': Interaktionszeit trotz Arbeit dazwischen gezaehlt');
        }
      }
    }],

    ['W Luecke ohne Uebergabe davor bleibt bei der Pausenschwelle', () => {
      // Der Agent arbeitet bis 3 und verstummt ohne Zug-Ende (Rechteanfrage,
      // Absturz): kein Fall fuer die Interaktionszeit.
      const still = [['s1', 0, 'eingabe'], ['s1', 1, 'arbeit'], ['s1', 3, 'arbeit'], ['s1', 6, 'neutral'], ['s1', 20, 'eingabe']];
      for (const modell of ['aktivitaet', 'eingaben']) {
        assert.strictEqual(mitWarten(5, modell, 30, still), mitWarten(5, modell, 0, still), modell);
      }
    }],

    ['W ueber der Schwelle rechnet alles wie vorher, auch die neutralen Zeilen', () => {
      // Mittagspause: Uebergabe 3, Zusammenfassung 6, Antwort erst bei 60.
      const pause = [['s1', 0, 'eingabe'], ['s1', 3, 'uebergabe'], ['s1', 6, 'neutral'], ['s1', 60, 'eingabe'], ['s1', 61, 'arbeit']];
      // aktivitaet: 0-3, 3-6 (neutral zaehlt wie bisher als Signal), 60-61 = 7 Minuten.
      assert.strictEqual(mitWarten(5, 'aktivitaet', 30, pause), 7 * 60, 'aktivitaet');
      assert.strictEqual(mitWarten(5, 'eingaben', 30, pause), mitWarten(5, 'eingaben', 0, pause), 'eingaben');
      // Wechsel der Sitzung beendet eine offene Interaktionszeit ebenso.
      const wechsel = [['s1', 0, 'eingabe'], ['s1', 3, 'uebergabe'], ['s1', 6, 'neutral'], ['s2', 10, 'eingabe']];
      assert.strictEqual(mitWarten(5, 'aktivitaet', 30, wechsel), mitWarten(5, 'aktivitaet', 0, wechsel), 'Sitzungswechsel');
    }],

    ['W parallele Sitzungen: die Interaktionszeit zaehlt jede Minute hoechstens einmal', () => {
      const zwei = PLAN.concat(PLAN.map(([, m, a]) => ['s2', m, a, 'W-2']));
      for (const modell of ['aktivitaet', 'eingaben']) {
        mit(5, modell, 30, () => {
          const d = db(zwei);
          const gesamt = sek(d);
          // Auf der Uhr: aktivitaet 0-22, eingaben [-2,5..2,5] und [3..22,5].
          assert.strictEqual(gesamt, { aktivitaet: 22 * 60, eingaben: 24.5 * 60 }[modell],
            modell + ': ' + gesamt + 's — zwei gleiche Sitzungen ergeben nicht die Uhrzeit einer');
          const je = Object.fromEntries(metrics.byTicket(d, {}).map((x) => [x.ticket, x.active_seconds]));
          assert.strictEqual(je['W-1'] + je['W-2'], gesamt, modell + ': Vorgaenge ergeben nicht den Gesamtwert');
          assert.strictEqual(je['W-1'], je['W-2'], modell + ': ungleich verteilt');
        });
      }
    }],

    ['W Interaktionszeit zaehlt am Tag und Vorgang der Uebergabe, nie Zeit davor', () => {
      // Uebergabe 23:50 am 18., Antwort 00:10 am 19. (BASIS 09:00, Minute 890/910).
      const nacht = [['s1', 870, 'eingabe'], ['s1', 871, 'arbeit'], ['s1', 890, 'uebergabe'], ['s1', 910, 'eingabe']];
      const jeTag = (modell) => mit(5, modell, 30, () => Object.fromEntries(metrics.byDay(db(nacht), {}).map((x) => [x.day, x.active_seconds])));
      // eingaben: [867,5..872,5] und [890..907,5] am 18., [907,5..912,5] am 19.
      assert.deepStrictEqual(jeTag('eingaben'), { '2026-11-18': 22.5 * 60, '2026-11-19': 5 * 60 }, 'eingaben');
      // aktivitaet: 870-871 und die Luecke 890-910 gehoeren dem 18.
      assert.deepStrictEqual(jeTag('aktivitaet'), { '2026-11-18': 21 * 60 }, 'aktivitaet');
      // Uebergabe bei einem anderen Vorgang: die Interaktionszeit traegt jener Vorgang.
      const wechsel = [['s1', 0, 'eingabe', 'W-1'], ['s1', 3, 'uebergabe', 'W-1'], ['s1', 20, 'eingabe', 'W-2']];
      mit(5, 'eingaben', 30, () => {
        const je = Object.fromEntries(metrics.byTicket(db(wechsel), {}).map((x) => [x.ticket, x.active_seconds]));
        // W-1: Fenster [-2,5..2,5] und Interaktionszeit [3..17,5]; W-2: Fenster [17,5..22,5].
        assert.deepStrictEqual(je, { 'W-1': 19.5 * 60, 'W-2': 5 * 60 }, JSON.stringify(je));
      });
      // Modellwechsel: Projekt A rechnet "aktivitaet", die Uebergabe kommt aus
      // Projekt B mit "eingaben" (zaehlt dort nicht als Zeile). Die Luecke von
      // A@0 bis A@20 enthielte Zeit vor der Uebergabe — sie darf nicht zaehlen.
      const saetze = cfg.projektSaetze;
      cfg.projektSaetze = { A: { zeitmodell: 'aktivitaet' } };
      try {
        const misch = [['s1', 0, 'arbeit', 'W-1', 'A'], ['s1', 3, 'uebergabe', 'W-1', 'B'], ['s1', 20, 'eingabe', 'W-1', 'A']];
        assert.strictEqual(mitWarten(5, 'eingaben', 30, misch), mitWarten(5, 'eingaben', 0, misch), 'Zeit vor der Uebergabe gezaehlt');
        // Dasselbe, die Antwort kommt in Projekt B: die Interaktionszeit beginnt an der
        // Uebergabe [3..22,5], nicht schon bei A@0.
        const misch2 = [['s1', 0, 'arbeit', 'W-1', 'A'], ['s1', 3, 'uebergabe', 'W-1', 'B'], ['s1', 20, 'eingabe', 'W-1', 'B']];
        const s2 = mitWarten(5, 'eingaben', 30, misch2);
        assert.strictEqual(s2, 19.5 * 60, 'Antwort in B: ' + s2 + 's statt 1170s');
      } finally {
        if (saetze === undefined) delete cfg.projektSaetze; else cfg.projektSaetze = saetze;
      }
    }],

    ['W Altbestand ohne Kennung und interaktionMinuten 0 rechnen wie vorher', () => {
      // Zeilen ohne Warte-Kennung (geloeschte Logs): keine Uebergabe bekannt.
      const alt = [['s1', 0, 'altEingabe'], ['s1', 3, 'alt'], ['s1', 6, 'alt'], ['s1', 20, 'altEingabe']];
      for (const modell of ['aktivitaet', 'eingaben']) {
        assert.strictEqual(mitWarten(5, modell, 30, alt), mitWarten(5, modell, 0, alt), modell + ': Altbestand');
      }
      // interaktionMinuten 0 ergibt exakt die Abschnitte von vorher (Ausgangslagen oben).
      assert.strictEqual(mitWarten(5, 'aktivitaet', 0, PLAN), 8 * 60);
      assert.strictEqual(mitWarten(5, 'eingaben', 0, PLAN), 10 * 60);
    }],

    ['W Zwischenspeicher verwirft sich bei geaenderter Interaktionszeit', () => {
      const d = mit(5, 'aktivitaet', 30, () => db(PLAN));
      const mit30 = mit(5, 'aktivitaet', 30, () => sek(d));
      const mit0 = mit(5, 'aktivitaet', 0, () => sek(d));
      assert.strictEqual(mit30, 22 * 60);
      assert.strictEqual(mit0, 8 * 60, 'gespeichertes Ergebnis mit alter Interaktionszeit geliefert');
    }],

    ['W Einstellung: 0 schaltet ab, Grenzen greifen, Wert landet in config.json und wirkt sofort', () => {
      const { setzeEinstellungen } = require('../../server');
      const pfad = path.join(__dirname, '..', '..', 'config.json');
      const datei = fs.readFileSync(pfad, 'utf8');
      const vorher = { gapMinutes: cfg.gapMinutes, zeitmodell: cfg.zeitmodell, interaktionMinuten: cfg.interaktionMinuten };
      try {
        cfg.gapMinutes = 5;
        cfg.zeitmodell = 'aktivitaet';
        const d = db(PLAN);
        setzeEinstellungen({ interaktionMinuten: 30 });
        assert.strictEqual(sek(d), 22 * 60, 'mit 30 Minuten');
        assert.deepStrictEqual(setzeEinstellungen({ interaktionMinuten: 0 }), { interaktionMinuten: 0 }, '0 nicht angenommen');
        assert.strictEqual(sek(d), 8 * 60, 'Abschalten wirkt nicht sofort');
        assert.strictEqual(JSON.parse(fs.readFileSync(pfad, 'utf8')).interaktionMinuten, 0, 'Wert steht nicht in config.json');
        assert.throws(() => setzeEinstellungen({ interaktionMinuten: 300 }), /Interaktionszeit/, '300 Minuten angenommen');
        assert.throws(() => setzeEinstellungen({ interaktionMinuten: 2.5 }), /ganze Zahl/, 'Bruchteil angenommen');
        assert.strictEqual(cfg.interaktionMinuten, 0, 'abgelehnte Eingabe hat den Wert trotzdem geaendert');
      } finally {
        for (const [k, v] of Object.entries(vorher)) {
          if (v === undefined) delete cfg[k]; else cfg[k] = v;
        }
        fs.writeFileSync(pfad, datei, 'utf8');
      }
    }],

    ['W Einlesen und Nachtrag setzen die Warte-Kennung, ohne Kosten oder Zuordnung anzufassen', async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-w-'));
      const projDir = path.join(tmp, 'C--Users-Test-Dev-Demo');
      fs.mkdirSync(projDir, { recursive: true });
      const kopf = (t) => ({ timestamp: t, sessionId: 'sess-w', cwd: 'C:\\Users\\Test\\Dev\\Demo', gitBranch: 'main', entrypoint: 'cli' });
      const antwort = (id, t, message) => JSON.stringify({ ...kopf(t), type: 'assistant', requestId: id,
        message: { id: 'msg_' + id, model: 'claude-opus-5', usage: { input_tokens: 10, output_tokens: 20 }, ...message } });
      fs.writeFileSync(path.join(projDir, 'sess.jsonl'), [
        JSON.stringify({ ...kopf(ts(0)), type: 'user', message: { content: 'Plan bitte' } }),
        antwort('w1', ts(1), { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'ExitPlanMode', input: {} }] }),
        JSON.stringify({ ...kopf(ts(4)), type: 'system', subtype: 'away_summary', content: 'x' }),
        JSON.stringify({ ...kopf(ts(15)), type: 'user', toolUseResult: { plan: '# Plan' },
          message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } }),
        antwort('w2', ts(16), { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Fertig' }] }),
      ].join('\n') + '\n');

      const origDir = cfg.jsonlDir;
      if (!cfg.lokaleModelle) cfg.lokaleModelle = {};
      const origLokal = cfg.lokaleModelle.protokollDir;
      cfg.jsonlDir = tmp;
      cfg.lokaleModelle.protokollDir = path.join(tmp, 'lokal-leer');
      const d = dbmod.open(':memory:');
      openDbs.push(d);
      const kennung = () => d.prepare('SELECT warte FROM activity ORDER BY ts').all().map((r) => r.warte).join(',');
      try {
        await ingest.run({ db: d });
        assert.strictEqual(kennung(), '0,2,1,0,2', 'frisch eingelesen: ' + kennung());
        assert.ok(dbmod.getMeta(d, 'warte_nachgetragen'), 'Merker fehlt nach frischem Einlesen');
        d.exec(`
          UPDATE activity SET warte = NULL, ticket = 'W-7';
          UPDATE events SET cost_usd = 99, ticket = 'W-7';
          DELETE FROM meta WHERE key = 'warte_nachgetragen';
        `);
        await ingest.run({ db: d });
        assert.strictEqual(kennung(), '0,2,1,0,2', 'Nachtrag: ' + kennung());
        assert.ok(dbmod.getMeta(d, 'warte_nachgetragen'), 'Merker fehlt — der Nachtrag liefe bei jedem Start erneut');
        assert.ok(dbmod.getMeta(d, 'eingabe_nachgetragen'), 'Eingabe-Merker fehlt');
        const e = d.prepare('SELECT SUM(cost_usd) AS usd, MIN(ticket) AS t FROM events').get();
        assert.strictEqual(e.usd, 198, 'Nachtrag hat Kosten neu bepreist: ' + e.usd);
        assert.strictEqual(e.t, 'W-7', 'Nachtrag hat die Zuordnung der Requests zurueckgesetzt');
        assert.strictEqual(d.prepare("SELECT COUNT(*) AS n FROM activity WHERE ticket = 'W-7'").get().n, 5,
          'Nachtrag hat die Zuordnung der Aktivitaet zurueckgesetzt');
        // Die Plan-Freigabe bei 15 zaehlt im Modell "eingaben" ab der Uebergabe bei 1;
        // das Fenster waechst mit dem der ersten Eingabe zusammen: [-2,5..17,5].
        mit(5, 'eingaben', 30, () => {
          assert.strictEqual(sek(d), 20 * 60, 'eingelesene Sitzung: ' + sek(d) + 's');
        });
      } finally {
        cfg.jsonlDir = origDir;
        cfg.lokaleModelle.protokollDir = origLokal;
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }],
  ];
};
