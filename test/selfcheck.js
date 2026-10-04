'use strict';
// Prueft die Stellen, an denen falsche Zahlen entstehen wuerden, ohne dass man
// es der Ausgabe ansieht: Dedup, Cache-Aufteilung, Aktivzeit, Ticket-Erkennung.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Die Module lesen config.json beim Laden. Fehlt sie, bricht schon der Import
// mit MODULE_NOT_FOUND ab — das sieht nach einem kaputten Test aus, ist aber
// ein vergessener Einrichtungsschritt. Lieber hier sagen, was zu tun ist.
if (!fs.existsSync(path.join(__dirname, '..', 'config.json'))) {
  console.error('config.json fehlt. Zum Einrichten die Vorlage kopieren:\n'
    + '  copy config.example.json config.json   (Windows)\n'
    + '  cp config.example.json config.json     (macOS/Linux)');
  process.exit(1);
}

const dbmod = require('../db');
const ingest = require('../ingest');
const metrics = require('../metrics');
const pricing = require('../pricing');

let failed = 0;
// Offene In-Memory-Datenbanken. Bleiben sie beim Prozessende offen, bricht
// libuv unter Windows mit einer Assertion ab und der Exitcode wird unbrauchbar.
const openDbs = [];

function test(name, fn) {
  try {
    fn();
    console.log('  ok   ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + err.message);
  }
}

// --- Dedup -----------------------------------------------------------------
// Ein Request, dreimal ins Log geschrieben, muss einmal zaehlen.
function testDedup() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const stmt = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(request_id) DO UPDATE SET
      output_tokens = excluded.output_tokens, cost_usd = excluded.cost_usd
  `);
  for (let i = 0; i < 3; i++) {
    stmt.run('req_A', '2026-08-18T10:00:00Z', 's1', 'P', 'claude-opus-5',
      100, 653, 0, 0, 0, 0, 0.05, 0, '2026-08-18');
  }
  const row = db.prepare('SELECT COUNT(*) c, SUM(output_tokens) o FROM events').get();
  assert.strictEqual(row.c, 1, 'drei Kopien ergaben ' + row.c + ' Zeilen statt 1');
  assert.strictEqual(row.o, 653, 'Summe ' + row.o + ' statt 653 (Kopien wurden addiert)');
  db.close();
}

// --- Cache-Aufteilung ------------------------------------------------------
function testUsageSplit() {
  const withSplit = ingest.extractUsage({
    input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 300,
    cache_read_input_tokens: 40,
    cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
  });
  assert.strictEqual(withSplit.cache_w_5m, 100);
  assert.strictEqual(withSplit.cache_w_1h, 200);
  assert.strictEqual(withSplit.cache_read, 40);

  // Aeltere Zeilen ohne Aufschluesselung duerfen nichts verlieren.
  const noSplit = ingest.extractUsage({
    input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 500,
    cache_read_input_tokens: 0,
  });
  assert.strictEqual(noSplit.cache_w_5m + noSplit.cache_w_1h, 500,
    'Cache-Writes gingen verloren');
}

// --- Ticket-Erkennung ------------------------------------------------------
function testTicket() {
  assert.strictEqual(ingest.ticketOf('feature/PROJ-107-welcome-mail'), 'PROJ-107');
  assert.strictEqual(ingest.ticketOf('PROJ-12'), 'PROJ-12');
  assert.strictEqual(ingest.ticketOf('bugfix/ABC-9'), 'ABC-9');
  assert.strictEqual(ingest.ticketOf('main'), null);
  assert.strictEqual(ingest.ticketOf('dev'), null);
  assert.strictEqual(ingest.ticketOf(null), null);
  // Kein Ticket aus Datumsangaben oder Versionsnummern erfinden.
  assert.strictEqual(ingest.ticketOf('release/2026-08'), null);
}

// --- Projekt aus Pfad ------------------------------------------------------
function testProject() {
  const home = process.env.USERPROFILE || process.env.HOME;
  assert.strictEqual(ingest.projectOf(home + '\\Dev\\Beispiel - App'), 'Beispiel - App');
  // Unterordner duerfen kein eigenes Projekt werden.
  assert.strictEqual(ingest.projectOf(home + '\\Dev\\Beispiel - App\\src\\lib'), 'Beispiel - App');
  assert.strictEqual(ingest.projectOf(home + '\\Notizbuch\\.obsidian\\plugins\\x'), 'Notizbuch');
  // Ordner ausserhalb der bekannten Wurzeln: der letzte Pfadbestandteil.
  assert.strictEqual(ingest.projectOf('D:\\Kunden\\Auftrag 7'), 'Auftrag 7');
  // Die Wurzeln kommen aus der Konfiguration; fehlt der Eintrag, gilt
  // weiterhin ~/Dev und das Benutzerverzeichnis. Genau dieser Fall laeuft
  // hier, weil config.json den Schluessel nicht setzt — die Zeilen darueber
  // sind damit zugleich die Probe auf die Rueckfallebene.
  assert.ok(Array.isArray(ingest.PROJECT_ROOTS) && ingest.PROJECT_ROOTS.length >= 2,
    'Projektwurzeln nicht aufgeloest');
  assert.ok(!ingest.PROJECT_ROOTS.some((p) => p.includes('~')),
    'Tilde wurde nicht zum Benutzerverzeichnis aufgeloest: ' + ingest.PROJECT_ROOTS.join(', '));
}

// --- Aktivzeit -------------------------------------------------------------
// Der Kaffee-Fall: eine lange Pause darf nicht als Arbeitszeit zaehlen.
function testActiveTime() {
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  // 0,2,4 Min zusammenhaengend; dann 15 Min Pause; dann 19,21 Min.
  const stamps = [t(0), t(2), t(4), t(19), t(21)];
  const active = metrics.activeSecondsFromTimestamps(stamps, 5);
  // Erwartet: 2+2 Min + 2 Min = 6 Min. Die 15-Min-Luecke zaehlt nicht.
  assert.strictEqual(active, 6 * 60, 'Aktivzeit ' + active + 's statt 360s');

  // Ohne Pausenfilter waeren es 21 Minuten.
  const naive = (new Date(t(21)) - new Date(t(0))) / 1000;
  assert.strictEqual(naive, 21 * 60);

  // Einzelnes Ereignis ergibt keine Arbeitszeit.
  assert.strictEqual(metrics.activeSecondsFromTimestamps([t(0)], 5), 0);
  assert.strictEqual(metrics.activeSecondsFromTimestamps([], 5), 0);

  // Genau an der Schwelle zaehlt die Luecke noch.
  assert.strictEqual(metrics.activeSecondsFromTimestamps([t(0), t(5)], 5), 5 * 60);
  // Eine Sekunde darueber nicht mehr.
  const justOver = [t(0), new Date(Date.UTC(2026, 7, 18, 10, 5, 1)).toISOString()];
  assert.strictEqual(metrics.activeSecondsFromTimestamps(justOver, 5), 0);
}

// --- Zeitmodell ------------------------------------------------------------
// Datenbank fuer die Zeitpruefungen. zeile() schreibt Ereignis und Aktivitaet
// gemeinsam, weil byTicket() seine Zeilen aus events holt und die Zeit aus
// activity. `eingabe` bleibt weg, solange ein Test den Altbestand meint.
function zeitDb(basis = Date.UTC(2026, 7, 18, 10, 0, 0)) {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const insE = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insA = db.prepare(
    'INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)'
  );
  let n = 0;
  const t = (min) => new Date(basis + min * 60000).toISOString();
  // Nur das Aktivitaetssignal, ohne Request — so sehen Logzeilen aus, die
  // keine Antwort des Modells sind.
  const aktiv = (session, min, projekt, ticket, eingabe = null) => {
    const ts = t(min);
    insA.run(session, ts, projekt, 'main', ticket, ts.slice(0, 10), eingabe);
  };
  const zeile = (session, min, projekt, ticket, eingabe = null) => {
    const ts = t(min);
    insE.run('z' + (n++), ts, session, projekt, 'main', ticket, 'claude-opus-5',
      10, 10, 0, 0, 0, 0, 0.1, 0, ts.slice(0, 10));
    aktiv(session, min, projekt, ticket, eingabe);
  };
  return { db, zeile, aktiv, t };
}

// Setzt Pausenschwelle und Zeitmodell fuer die Dauer eines Tests. Kein Test
// darf sich auf den Wert verlassen, der zufaellig in config.json steht.
function mitZeitmodell(gapMinutes, zeitmodell, fn) {
  const cfg = require('../config.json');
  const vorher = { gapMinutes: cfg.gapMinutes, zeitmodell: cfg.zeitmodell };
  cfg.gapMinutes = gapMinutes;
  cfg.zeitmodell = zeitmodell;
  try {
    return fn();
  } finally {
    cfg.gapMinutes = vorher.gapMinutes;
    if (vorher.zeitmodell === undefined) delete cfg.zeitmodell;
    else cfg.zeitmodell = vorher.zeitmodell;
  }
}

const summe = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

// Zwei Sitzungen laufen gleichzeitig. Eine Stunde auf der Uhr ist eine Stunde
// auf der Rechnung, nicht zwei — wer je Sitzung summiert, stellt dem Kunden
// mehr als 60 Minuten je Stunde in Rechnung.
function testZeitParallel() {
  mitZeitmodell(5, 'aktivitaet', () => {
    const { db, zeile } = zeitDb();
    // 10:00-11:00 beide Sitzungen, danach laeuft B noch 30 Minuten allein.
    for (let min = 0; min <= 60; min += 2) zeile('sA', min, 'Projekt A', 'PROJ-1');
    for (let min = 0; min <= 90; min += 2) zeile('sB', min, 'Projekt B', 'PROJ-2');

    const gesamt = metrics.summary(db, {}).active_seconds;
    assert.strictEqual(gesamt, 90 * 60,
      'Gesamtzeit ' + gesamt + 's statt 5400s — 90 Minuten auf der Uhr');

    const tickets = Object.fromEntries(metrics.byTicket(db, {}).map((x) => [x.ticket, x.active_seconds]));
    assert.strictEqual(tickets['PROJ-1'], 30 * 60,
      'PROJ-1 traegt ' + tickets['PROJ-1'] + 's statt 1800s (halbe gemeinsame Stunde)');
    assert.strictEqual(tickets['PROJ-2'], 60 * 60,
      'PROJ-2 traegt ' + tickets['PROJ-2'] + 's statt 3600s (halbe Stunde geteilt, halbe allein)');

    // Ein Filter auf einen Vorgang darf die parallele Sitzung des anderen nicht
    // aus dem Blick verlieren: sonst traegt derselbe Vorgang je nach Ansicht
    // verschiedene Zeiten.
    const einzeln = metrics.byTicket(db, { ticket: 'PROJ-1' })[0].active_seconds;
    assert.strictEqual(einzeln, 30 * 60,
      'gefiltert traegt PROJ-1 ' + einzeln + 's statt 1800s — vereinigt wurde erst nach dem Filter');

    const projekte = metrics.byProject(db, {}).reduce((a, p) => a + p.active_seconds, 0);
    assert.strictEqual(projekte, gesamt, 'Summe der Projekte weicht vom Gesamtwert ab');

    // Gegenprobe: die Laufzeit je Sitzung zaehlt beide voll. Das ist die Zahl,
    // die bisher auf der Rechnung stand.
    const agent = summe(metrics.agentSecondsByGroup(db, {}, { groupBy: 'ticket' }));
    assert.strictEqual(agent, 150 * 60, 'Laufzeit je Sitzung ' + agent + 's statt 9000s');
    db.close();
  });
}

// Was beim Einlesen als eigene Eingabe gilt. Davon haengt die abgerechnete Zeit
// ab: zaehlt ein Werkzeugergebnis als Eingabe, ist jeder Agentenlauf wieder
// Arbeitszeit — genau der Fehler, den das Zeitmodell beheben soll.
function testIstEingabe() {
  const zeile = (extra) => ({
    type: 'user', timestamp: '2026-08-18T10:00:00.000Z', sessionId: 's1',
    entrypoint: 'cli', message: { role: 'user', content: 'Bau das um' }, ...extra,
  });
  const werkzeug = (toolUseResult) => zeile({
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'x' }] },
    toolUseResult,
  });
  const ja = (o, was) => assert.strictEqual(ingest.istEingabe(o), true, was + ' gilt nicht als Eingabe');
  const nein = (o, was) => assert.strictEqual(ingest.istEingabe(o), false, was + ' gilt als Eingabe');

  ja(zeile(), 'getippter Prompt');
  ja(zeile({ message: { content: [{ type: 'text', text: 'mit Bild' }, { type: 'image' }] } }), 'Prompt als Liste');
  ja(zeile({ message: { content: [{ type: 'image' }] } }), 'Prompt nur aus einem Bild');
  ja(zeile({ message: { content: '<command-name>/plan</command-name>' } }), 'Slash-Befehl');
  ja(zeile({ message: { content: '<bash-input>git status</bash-input>' } }), 'eigener Shell-Befehl');
  ja(zeile({ message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } }), 'Abbruch');
  ja(werkzeug({ questions: [], answers: { 'Welche?': 'A' } }), 'Antwort auf eine Rueckfrage');
  ja(werkzeug({ plan: '# Plan', isAgent: false }), 'Plan-Freigabe');
  ja(werkzeug("Error: The user doesn't want to proceed with this tool use. The tool use was rejected"),
    'abgelehnter Werkzeugaufruf');

  nein(werkzeug({ stdout: 'ok', stderr: '' }), 'Werkzeugergebnis');
  nein(werkzeug('Error: Exit code 1'), 'Werkzeugfehler');
  nein(werkzeug(undefined), 'Werkzeugergebnis ohne Zusatz');
  nein(zeile({ isSidechain: true }), 'Subagent');
  nein(zeile({ isMeta: true }), 'Meta-Zeile');
  nein(zeile({ isCompactSummary: true }), 'Zusammenfassung nach dem Verdichten');
  nein(zeile({ entrypoint: 'sdk-cli' }), 'programmatischer Aufruf (claude -p)');
  nein(zeile({ message: { content: '<task-notification>fertig</task-notification>' } }), 'Task-Benachrichtigung');
  nein(zeile({ message: { content: '<local-command-stdout>Set model</local-command-stdout>' } }), 'Befehlsausgabe');
  nein(zeile({ message: { content: '<bash-stdout>x</bash-stdout>' } }), 'Shell-Ausgabe');
  nein(zeile({ promptSource: 'system' }), 'vom System eingespielte Zeile');
  nein({ type: 'assistant', message: { content: [{ type: 'text', text: 'Antwort' }] } }, 'Antwort des Modells');
  nein(null, 'leere Zeile');
}

// Bestandsnutzer haben Aktivitaetszeilen aus der Zeit vor der Eingabe-Kennung.
// Solange die Logs noch liegen, muss der naechste Lauf sie nachtragen — ohne
// dabei Kosten neu zu bepreisen oder eine gebuchte Zuordnung zurueckzusetzen.
function testEingabeNachtrag() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-'));
  const projDir = path.join(tmp, 'C--Users-Test-Dev-Demo');
  fs.mkdirSync(projDir, { recursive: true });
  const kopf = (ts) => ({
    timestamp: ts, sessionId: 'sess-n', cwd: 'C:\\Users\\Test\\Dev\\Demo',
    gitBranch: 'main', entrypoint: 'cli',
  });
  const antwort = (reqId, ts) => JSON.stringify({
    ...kopf(ts), type: 'assistant', requestId: reqId,
    message: { id: 'msg_' + reqId, model: 'claude-opus-5', usage: { input_tokens: 10, output_tokens: 20 } },
  });
  fs.writeFileSync(path.join(projDir, 'sess.jsonl'), [
    JSON.stringify({ ...kopf('2026-08-18T10:00:00.000Z'), type: 'user', message: { content: 'Bau das um' } }),
    antwort('n1', '2026-08-18T10:00:05.000Z'),
    JSON.stringify({
      ...kopf('2026-08-18T10:00:10.000Z'), type: 'user', toolUseResult: { stdout: 'ok' },
      message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] },
    }),
    antwort('n2', '2026-08-18T10:00:15.000Z'),
  ].join('\n') + '\n');

  const cfg = require('../config.json');
  const origDir = cfg.jsonlDir;
  cfg.jsonlDir = tmp;
  if (!cfg.lokaleModelle) cfg.lokaleModelle = {};
  const origLokal = cfg.lokaleModelle.protokollDir;
  cfg.lokaleModelle.protokollDir = path.join(tmp, 'lokal-leer');

  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const stand = () => db.prepare(
    'SELECT COUNT(*) AS c, SUM(eingabe) AS e, SUM(eingabe IS NULL) AS offen FROM activity'
  ).get();

  return ingest.run({ db }).then(() => {
    const s = stand();
    assert.strictEqual(s.c, 4, 'erwartet 4 Aktivitaetszeilen, bekam ' + s.c);
    assert.strictEqual(s.e, 1, 'frisch eingelesen: ' + s.e + ' Eingaben statt 1');
    assert.strictEqual(s.offen, 0, 'frisch eingelesen blieben Zeilen ohne Kennung');

    // Altbestand nachstellen: Kennung weg, Merker weg. Dazu ein Betrag und
    // eine Zuordnung, die der Nachtrag nicht anfassen darf.
    db.exec(`
      UPDATE activity SET eingabe = NULL, ticket = 'PROJ-7';
      UPDATE events SET cost_usd = 99, ticket = 'PROJ-7';
      DELETE FROM meta WHERE key = 'eingabe_nachgetragen';
    `);
    // Erst ein Lauf, bei dem das Logverzeichnis nicht erreichbar ist (falscher
    // Pfad, Laufwerk nicht eingehaengt). Er darf den Nachtrag nicht als
    // erledigt vermerken — sonst bleibt der Altbestand fuer immer ohne Kennung.
    cfg.jsonlDir = path.join(tmp, 'gibt-es-nicht');
    // Der Lauf meldet das zu Recht als Warnung; in der Ausgabe der
    // Selbstpruefung saehe sie wie ein Fehler aus.
    const warn = console.warn;
    console.warn = () => {};
    return ingest.run({ db }).finally(() => { console.warn = warn; });
  }).then(() => {
    assert.strictEqual(stand().offen, 4, 'Testaufbau: Nachtrag lief trotz fehlendem Verzeichnis');
    assert.ok(!dbmod.getMeta(db, 'eingabe_nachgetragen'),
      'Nachtrag ohne lesbare Logs als erledigt vermerkt — er wird nie wiederholt');
    cfg.jsonlDir = tmp;
    return ingest.run({ db });
  }).then(() => {
    const s = stand();
    assert.strictEqual(s.offen, 0, 'Nachtrag liess ' + s.offen + ' Zeilen ohne Kennung');
    assert.strictEqual(s.e, 1, 'Nachtrag ergab ' + s.e + ' Eingaben statt 1');
    const e = db.prepare('SELECT SUM(cost_usd) AS usd, COUNT(DISTINCT ticket) AS t, MIN(ticket) AS ticket FROM events').get();
    assert.strictEqual(e.usd, 198, 'Nachtrag hat Kosten neu bepreist: ' + e.usd);
    assert.strictEqual(e.ticket, 'PROJ-7', 'Nachtrag hat die Zuordnung der Requests zurueckgesetzt');
    const a = db.prepare('SELECT COUNT(DISTINCT ticket) AS t, MIN(ticket) AS ticket FROM activity').get();
    assert.ok(a.t === 1 && a.ticket === 'PROJ-7', 'Nachtrag hat die Zuordnung der Aktivitaet zurueckgesetzt');
    assert.ok(dbmod.getMeta(db, 'eingabe_nachgetragen'), 'Merker fehlt — der Nachtrag liefe bei jedem Start erneut');
  }).finally(() => {
    try { db.close(); } catch { /* bereits geschlossen */ }
    cfg.jsonlDir = origDir;
    cfg.lokaleModelle.protokollDir = origLokal;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

// Abgerechnet wird die eigene Zeit: das Fenster um die eigenen Eingaben. Ein
// Agent, der zwanzig Minuten allein arbeitet, ist Maschinenzeit — sie wird
// ausgewiesen, steht aber nicht im Arbeitswert.
function testZeitEingaben() {
  mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile } = zeitDb();
    // Eingaben bei 0, 2 und 20; dazwischen arbeitet der Agent im Minutentakt.
    for (let min = 0; min <= 20; min++) {
      zeile('s1', min, 'Projekt A', 'PROJ-1', [0, 2, 20].includes(min) ? 1 : 0);
    }
    const p1 = metrics.byTicket(db, {})[0];
    // Fenster je +-2,5 Min: [-2,5..4,5] sind 7 Minuten, [17,5..22,5] sind 5.
    assert.strictEqual(p1.active_seconds, 12 * 60,
      'eigene Zeit ' + p1.active_seconds + 's statt 720s');
    assert.strictEqual(p1.agent_seconds, 20 * 60,
      'Agentenzeit ' + p1.agent_seconds + 's statt 1200s');
    assert.ok(Math.abs(p1.agent_hours - 20 / 60) < 1e-9, 'agent_hours passt nicht zu agent_seconds');
    // Der Arbeitswert folgt der eigenen Zeit, nicht der Laufzeit.
    const erwartet = (12 / 60) * p1.stundensatz;
    assert.ok(Math.abs(p1.arbeitswert - erwartet) < 1e-9,
      'Arbeitswert ' + p1.arbeitswert + ' statt ' + erwartet + ' — er rechnet mit der Agentenzeit');
    const s = metrics.summary(db, {});
    assert.strictEqual(s.active_seconds, 12 * 60, 'summary: eigene Zeit ' + s.active_seconds + 's');
    assert.strictEqual(s.agent_seconds, 20 * 60, 'summary: Agentenzeit ' + s.agent_seconds + 's');
    db.close();

    // Zwei Sitzungen, abwechselnd bedient: 0, 4, 8 hier und 2, 6, 10 dort.
    // Auf der Uhr sind das 10 Minuten plus ein halbes Fenster an jedem Rand.
    const zwei = zeitDb();
    [0, 4, 8].forEach((min) => zwei.zeile('sA', min, 'Projekt A', 'PROJ-1', 1));
    [2, 6, 10].forEach((min) => zwei.zeile('sB', min, 'Projekt B', 'PROJ-2', 1));
    const gesamt = metrics.summary(zwei.db, {}).active_seconds;
    assert.strictEqual(gesamt, 15 * 60, 'abwechselnd bedient: ' + gesamt + 's statt 900s');
    const je = Object.fromEntries(metrics.byTicket(zwei.db, {}).map((x) => [x.ticket, x.active_seconds]));
    assert.strictEqual(je['PROJ-1'], 450, 'PROJ-1 traegt ' + je['PROJ-1'] + 's statt 450s');
    assert.strictEqual(je['PROJ-2'], 450, 'PROJ-2 traegt ' + je['PROJ-2'] + 's statt 450s');
    zwei.db.close();
  });
}

// Zwei Faelle, in denen NICHT ueber die Eingaben gerechnet wird: Zeilen aus der
// Zeit vor der Eingabe-Kennung (die Logs dazu sind laengst geloescht) und das
// bewusst gewaehlte Modell "aktivitaet". Beide duerfen weder 0 ergeben noch
// doppelt zaehlen.
function testZeitAltbestand() {
  const fuellen = (mitKennung) => {
    const z = zeitDb();
    for (let min = 0; min <= 20; min++) {
      z.zeile('s1', min, 'Projekt A', 'PROJ-1', mitKennung ? ([0, 20].includes(min) ? 1 : 0) : null);
    }
    return z.db;
  };
  mitZeitmodell(5, 'eingaben', () => {
    const alt = fuellen(false);
    assert.strictEqual(metrics.summary(alt, {}).active_seconds, 20 * 60,
      'Altbestand ohne Kennung ergibt nicht die vereinigte Aktivitaet');
    alt.close();

    const neu = fuellen(true);
    assert.strictEqual(metrics.summary(neu, {}).active_seconds, 10 * 60,
      'zwei Eingaben ergeben nicht zwei Fenster von je 5 Minuten');
    neu.close();

    // Eine Sitzung ganz ohne eigene Eingabe (claude -p) ist keine Arbeitszeit.
    const z = zeitDb();
    for (let min = 0; min <= 10; min++) z.zeile('sdk', min, 'Projekt A', 'PROJ-1', 0);
    assert.strictEqual(metrics.summary(z.db, {}).active_seconds, 0,
      'Sitzung ohne eigene Eingabe traegt abrechenbare Zeit');
    z.db.close();
  });
  mitZeitmodell(5, 'aktivitaet', () => {
    const neu = fuellen(true);
    assert.strictEqual(metrics.summary(neu, {}).active_seconds, 20 * 60,
      'Modell "aktivitaet" rechnet trotzdem ueber die Eingaben');
    neu.close();

    // Claude Code schreibt mitten in eine Sitzung Zeilen ohne Arbeits-
    // verzeichnis. Sie tragen das Projekt "(unbekannt)" und keinen Vorgang.
    // Bekaemen sie die Zeit selbst, verschwaende sie: zu "(unbekannt)" gibt es
    // keine Requests und damit nirgends eine Zeile, die sie ausweist.
    const z = zeitDb();
    z.zeile('s1', 0, 'Projekt A', 'PROJ-1');
    z.aktiv('s1', 1, '(unbekannt)', null);
    z.aktiv('s1', 2, '(unbekannt)', null);
    z.zeile('s1', 3, 'Projekt A', 'PROJ-1');
    const p1 = metrics.byTicket(z.db, {})[0];
    assert.strictEqual(p1.active_seconds, 3 * 60,
      'PROJ-1 traegt ' + p1.active_seconds + 's statt 180s — Zeilen ohne Verzeichnis nehmen Zeit mit');
    assert.strictEqual(p1.agent_seconds, 3 * 60,
      'Agentenzeit ' + p1.agent_seconds + 's statt 180s');
    assert.strictEqual(metrics.byProject(z.db, {})[0].active_seconds, 3 * 60,
      'Projekt A verliert Zeit an Zeilen ohne Verzeichnis');
    z.db.close();
  });
}

// Das Zeitmodell laesst sich in den Einstellungen umschalten. Der Schalter
// entscheidet, welche Stunden auf einer Rechnung stehen — er muss sofort
// wirken, in der Datei ankommen und einen Tippfehler abweisen.
function testZeitmodellSchalter() {
  const { setzeEinstellungen } = require('../server');
  const cfg = require('../config.json');
  const pfad = path.join(__dirname, '..', 'config.json');
  const datei = fs.readFileSync(pfad, 'utf8');
  const vorher = { zeitmodell: cfg.zeitmodell, gapMinutes: cfg.gapMinutes };
  try {
    cfg.gapMinutes = 5;
    const { db, zeile } = zeitDb();
    // Eingaben bei 0 und 20, dazwischen arbeitet der Agent im Minutentakt.
    for (let min = 0; min <= 20; min++) zeile('s1', min, 'Projekt A', 'PROJ-1', [0, 20].includes(min) ? 1 : 0);
    const stunden = () => metrics.summary(db, {}).active_seconds;

    assert.deepStrictEqual(setzeEinstellungen({ zeitmodell: 'aktivitaet' }), { zeitmodell: 'aktivitaet' });
    assert.strictEqual(stunden(), 20 * 60, 'nach dem Umschalten auf "aktivitaet" zaehlt nicht jede Logzeile');
    assert.strictEqual(JSON.parse(fs.readFileSync(pfad, 'utf8')).zeitmodell, 'aktivitaet',
      'der Schalter steht nicht in config.json — nach einem Neustart gaelte wieder das alte Modell');

    setzeEinstellungen({ zeitmodell: 'eingaben' });
    assert.strictEqual(stunden(), 10 * 60, 'nach dem Umschalten auf "eingaben" zaehlen nicht nur die Eingabefenster');

    assert.throws(() => setzeEinstellungen({ zeitmodell: 'activity' }), /Zeitmodell/, 'unbekanntes Zeitmodell angenommen');
    // Scheitert ein anderes Feld derselben Eingabe, bleibt das Modell stehen.
    assert.throws(() => setzeEinstellungen({ zeitmodell: 'aktivitaet', gapMinutes: 0 }));
    assert.strictEqual(cfg.zeitmodell, 'eingaben', 'abgelehnte Eingabe hat das Zeitmodell trotzdem umgestellt');
    db.close();
  } finally {
    cfg.gapMinutes = vorher.gapMinutes;
    if (vorher.zeitmodell === undefined) delete cfg.zeitmodell; else cfg.zeitmodell = vorher.zeitmodell;
    fs.writeFileSync(pfad, datei, 'utf8');
  }
}

// Das Zeitmodell gilt nicht nur global. Ein Projekt, ein Vorgang oder eine
// einzelne Sitzung kann es ueberschreiben, in dieser Reihenfolge:
// Sitzung vor Vorgang vor Projekt vor Standard. Jede Sitzung hat Eingaben bei
// 0 und 20, dazwischen arbeitet der Agent: "eingaben" ergibt 10 Minuten,
// "aktivitaet" 20. Die Sitzungen liegen zeitlich getrennt, damit keine die
// Zeit einer anderen teilt.
function testZeitmodellEbenen() {
  const cfg = require('../config.json');
  const merk = cfg.projektSaetze;
  try {
    cfg.projektSaetze = { P: { zeitmodell: 'aktivitaet' } };
    mitZeitmodell(5, 'eingaben', () => {
      const { db, zeile } = zeitDb();
      const sitzung = (sid, start, projekt, ticket) => {
        for (let min = 0; min <= 20; min++) {
          zeile(sid, start + min, projekt, ticket, [0, 20].includes(min) ? 1 : 0);
        }
      };
      sitzung('s1', 0, 'P', 'T1');     // Projekt P: aktivitaet
      sitzung('s2', 100, 'P', 'T2');   // Vorgang T2: eingaben schlaegt Projekt
      sitzung('s3', 200, 'P', 'T3');   // Vorgang T3: eingaben, Sitzung s3: aktivitaet
      sitzung('s4', 300, 'Q', null);   // lose Sitzung, Standard: eingaben
      sitzung('s5', 400, 'Q', null);   // lose Sitzung mit eigener Wahl: aktivitaet
      const wahl = db.prepare('INSERT INTO zeitmodell_wahl (art, schluessel, zeitmodell) VALUES (?,?,?)');
      wahl.run('vorgang', 'T2', 'eingaben');
      wahl.run('vorgang', 'T3', 'eingaben');
      wahl.run('sitzung', 's3', 'aktivitaet');
      wahl.run('sitzung', 's5', 'aktivitaet');

      const je = Object.fromEntries(metrics.byTicket(db, {}).map((x) => [x.ticket, x]));
      assert.strictEqual(je.T1.active_seconds, 20 * 60, 'T1: Projekt-Wahl greift nicht (' + je.T1.active_seconds + 's)');
      assert.strictEqual(je.T2.active_seconds, 10 * 60, 'T2: Vorgang schlaegt Projekt nicht (' + je.T2.active_seconds + 's)');
      assert.strictEqual(je.T3.active_seconds, 20 * 60, 'T3: Sitzung schlaegt Vorgang nicht (' + je.T3.active_seconds + 's)');
      assert.strictEqual(je.T1.zeitmodell, 'aktivitaet');
      assert.strictEqual(je.T2.zeitmodell, 'eingaben');
      assert.strictEqual(je.T2.zeitmodell_wahl, 'eingaben', 'eigene Wahl des Vorgangs fehlt');
      assert.strictEqual(je.T2.zeitmodell_erbt, 'aktivitaet', 'geerbtes Modell des Vorgangs falsch');
      assert.strictEqual(je.T1.zeitmodell_wahl, null, 'Vorgang ohne eigene Wahl meldet eine');

      const q = metrics.ohneTicket(db, {}).find((x) => x.gruppe === 'Q');
      assert.strictEqual(q.active_seconds, 30 * 60, 'lose Sitzungen: ' + q.active_seconds + 's statt 1800s');
      assert.strictEqual(q.zeitmodell, 'gemischt', 'zwei Modelle in einer Gruppe werden nicht als gemischt gemeldet');

      // Die Summenregel gilt auch, wenn die Modelle gemischt sind.
      const gesamt = metrics.summary(db, {}).active_seconds;
      assert.strictEqual(gesamt, (20 + 10 + 20 + 30) * 60, 'Gesamtzeit ' + gesamt + 's');
      db.close();

      // Der Live-Tab zeigt die Wahl je Sitzung, auch ohne Vorgang.
      const live = zeitDb(Date.now() - 30 * 60000);
      live.zeile('sL', 0, 'Q', null, 1);
      live.db.prepare("INSERT INTO zeitmodell_wahl VALUES ('sitzung','sL','aktivitaet')").run();
      const s = metrics.live(live.db).sessions.find((x) => x.session_id === 'sL');
      assert.ok(s, 'Sitzung fehlt im Live-Tab');
      assert.strictEqual(s.zeitmodell_wahl, 'aktivitaet', 'Live: Wahl der Sitzung fehlt');
      assert.strictEqual(s.zeitmodell, 'aktivitaet', 'Live: geltendes Modell falsch');
      live.db.close();

      // Zwei Modelle in einer Sitzung (Branch-Wechsel): TA rechnet nach
      // Aktivitaet, TB nach Eingaben. Eine Luecke gehoert der Zeile, an der sie
      // beginnt — die Minuten 5 bis 9 also TA, auch wenn bei 9 eine Eingabe
      // von TB steht. TA [0,9], TB-Fenster [6,5..11,5], Ueberlappung geteilt.
      const w = zeitDb();
      for (let min = 0; min <= 5; min++) w.zeile('sW', min, 'P', 'TA', 0);
      w.zeile('sW', 9, 'P', 'TB', 1);
      w.db.prepare("INSERT INTO zeitmodell_wahl VALUES ('vorgang','TB','eingaben')").run();
      const wj = Object.fromEntries(metrics.byTicket(w.db, {}).map((x) => [x.ticket, x.active_seconds]));
      assert.strictEqual(metrics.summary(w.db, {}).active_seconds, 690,
        'Modellwechsel in der Sitzung verliert Zeit: ' + metrics.summary(w.db, {}).active_seconds + 's statt 690s');
      assert.strictEqual(wj.TA, 465, 'TA: ' + wj.TA + 's statt 465s');
      assert.strictEqual(wj.TB, 225, 'TB: ' + wj.TB + 's statt 225s');
      w.db.close();
    });
  } finally {
    cfg.projektSaetze = merk;
  }
}

// Die Wahl wird ueber die Oberflaeche gesetzt. Sie bestimmt Stunden auf
// Rechnungen, deshalb wird jeder Wert geprueft. Und ein Projekt ohne eigenen
// Satz darf seine Wahl nicht verlieren — setzeSatz() loeschte bisher jeden
// Eintrag ohne Betrag.
function testZeitmodellWahl() {
  const { setzeZeitmodell, setzeSatz } = require('../server');
  const cfg = require('../config.json');
  const pfad = path.join(__dirname, '..', 'config.json');
  const datei = fs.readFileSync(pfad, 'utf8');
  const merk = cfg.projektSaetze;
  try {
    const { db, zeile } = zeitDb();
    zeile('s1', 0, 'P', 'T1', 1);
    const gespeichert = (art, k) => {
      const r = db.prepare('SELECT zeitmodell FROM zeitmodell_wahl WHERE art = ? AND schluessel = ?').get(art, k);
      return r ? r.zeitmodell : null;
    };

    assert.throws(() => setzeZeitmodell(db, { art: 'projekt', schluessel: 'P', zeitmodell: 'eingaben' }), /Art/);
    assert.throws(() => setzeZeitmodell(db, { art: 'sitzung', schluessel: 's1', zeitmodell: 'activity' }), /Zeitmodell/);
    assert.throws(() => setzeZeitmodell(db, { art: 'sitzung', schluessel: 'gibtsnicht', zeitmodell: 'eingaben' }), /Unbekannte Sitzung/);
    assert.throws(() => setzeZeitmodell(db, { art: 'vorgang', schluessel: 'T9', zeitmodell: 'eingaben' }), /Unbekannter Vorgang/);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM zeitmodell_wahl').get().n, 0, 'abgelehnte Wahl wurde gespeichert');

    setzeZeitmodell(db, { art: 'sitzung', schluessel: 's1', zeitmodell: 'aktivitaet' });
    setzeZeitmodell(db, { art: 'vorgang', schluessel: 'T1', zeitmodell: 'eingaben' });
    assert.strictEqual(gespeichert('sitzung', 's1'), 'aktivitaet');
    assert.strictEqual(gespeichert('vorgang', 'T1'), 'eingaben');
    setzeZeitmodell(db, { art: 'sitzung', schluessel: 's1', zeitmodell: 'eingaben' });
    assert.strictEqual(gespeichert('sitzung', 's1'), 'eingaben', 'zweite Wahl ueberschreibt die erste nicht');
    setzeZeitmodell(db, { art: 'sitzung', schluessel: 's1', zeitmodell: '' });
    assert.strictEqual(gespeichert('sitzung', 's1'), null, 'leere Wahl setzt nicht auf "erbt" zurueck');

    cfg.projektSaetze = {};
    setzeSatz({ projekt: 'P', zeitmodell: 'aktivitaet' });
    assert.deepStrictEqual(cfg.projektSaetze.P, { zeitmodell: 'aktivitaet' },
      'Projekt ohne Satz verliert seine Zeitmodell-Wahl');
    assert.strictEqual(JSON.parse(fs.readFileSync(pfad, 'utf8')).projektSaetze.P.zeitmodell, 'aktivitaet',
      'Zeitmodell des Projekts steht nicht in config.json');
    assert.throws(() => setzeSatz({ projekt: 'P', zeitmodell: 'activity' }), /Zeitmodell/);
    assert.strictEqual(cfg.projektSaetze.P.zeitmodell, 'aktivitaet', 'abgelehnte Eingabe hat das Projekt veraendert');
    // Fehlt das Feld ganz (aeltere Oberflaeche, Laden fehlgeschlagen), bleibt
    // die Wahl stehen. Erst ein ausdrueckliches Leer setzt sie zurueck.
    setzeSatz({ projekt: 'P', satz: 90 });
    assert.deepStrictEqual(cfg.projektSaetze.P, { zeitmodell: 'aktivitaet', satz: 90 },
      'Satzaenderung ohne Zeitmodell-Feld loescht die Wahl des Projekts');
    setzeSatz({ projekt: 'P', zeitmodell: '' });
    // Ein Projektname darf das Objekt selbst nicht verbiegen.
    for (const boese of ['__proto__', 'constructor', 'prototype']) {
      assert.throws(() => setzeSatz({ projekt: boese, satz: 1 }), /Projektname/, boese + ' wurde angenommen');
    }
    assert.strictEqual(Object.getPrototypeOf(cfg.projektSaetze), Object.prototype, 'projektSaetze wurde verbogen');
    setzeSatz({ projekt: 'P', zeitmodell: '' });
    assert.strictEqual(cfg.projektSaetze.P, undefined, 'leere Wahl ohne Satz laesst einen leeren Eintrag stehen');
    db.close();
  } finally {
    cfg.projektSaetze = merk;
    fs.writeFileSync(pfad, datei, 'utf8');
  }
}

// Eine gestellte Rechnung wird nie nachgerechnet. Damit spaeter erkennbar
// bleibt, wie ihre Stunden entstanden sind, steht das Zeitmodell in der Position.
function testRechnungZeitmodell() {
  rechnungsUmgebung(() => mitZeitmodell(5, 'eingaben', () => {
    const rechnung = require('../rechnung');
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };
    const ohne = rechnungsDb();
    assert.strictEqual(rechnung.erstelle(ohne, daten).positionen[0].zeitmodell, 'eingaben',
      'Position ohne eigene Wahl nennt nicht das Standardmodell');
    const mit = rechnungsDb();
    mit.prepare("INSERT INTO zeitmodell_wahl VALUES ('vorgang','PROJ-500','aktivitaet')").run();
    assert.strictEqual(rechnung.erstelle(mit, daten).positionen[0].zeitmodell, 'aktivitaet',
      'Position nennt nicht das Modell des Vorgangs');
  }));
}

// Dieselbe Zeit darf nicht davon abhaengen, wie man sie ansieht: alle Vorgaenge
// plus die ticketlose Arbeit ergeben den Gesamtwert, und die Monate ergeben
// zusammen den ganzen Zeitraum — auch wenn sich zwei Fenster ueber Mitternacht
// am Monatsende ueberlappen.
function testZeitSummen() {
  mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile } = zeitDb(Date.UTC(2026, 7, 31, 23, 50, 0));
    zeile('sA', 8, 'Projekt A', 'PROJ-1', 1);   // 31.08. 23:58
    zeile('sB', 11, 'Projekt B', null, 1);      // 01.09. 00:01
    zeile('sA', 40, 'Projekt A', 'PROJ-1', 1);  // 01.09. 00:30, steht fuer sich

    const gesamt = metrics.summary(db, {}).active_seconds;
    // Zwei Fenster von 5 Min, die sich 2 Min ueberlappen, plus ein freies.
    assert.strictEqual(gesamt, 13 * 60, 'Gesamtzeit ' + gesamt + 's statt 780s');

    const mitTicket = metrics.byTicket(db, {}).reduce((a, x) => a + x.active_seconds, 0);
    const ohne = metrics.ohneTicket(db, {}).reduce((a, x) => a + x.active_seconds, 0);
    assert.strictEqual(mitTicket + ohne, gesamt,
      'Vorgaenge (' + mitTicket + 's) plus ticketlos (' + ohne + 's) ergeben nicht ' + gesamt + 's');

    const august = metrics.summary(db, { month: '2026-08' }).active_seconds;
    const september = metrics.summary(db, { month: '2026-09' }).active_seconds;
    assert.strictEqual(august, 4 * 60, 'August traegt ' + august + 's statt 240s');
    assert.strictEqual(august + september, gesamt,
      'August (' + august + 's) plus September (' + september + 's) ergeben nicht ' + gesamt + 's');

    // Dasselbe ueber from/to, so wie eine Rechnung ihren Zeitraum waehlt.
    const bisEnde = metrics.byTicket(db, { from: '2026-08-01', to: '2026-08-31' })[0].active_seconds;
    assert.strictEqual(bisEnde, 4 * 60, 'Rechnungszeitraum August traegt ' + bisEnde + 's statt 240s');
    db.close();
  });
}

// --- Preise ----------------------------------------------------------------
function testPricing() {
  // Synthetische Eintraege sind keine echten Aufrufe und muessen 0 kosten.
  assert.strictEqual(pricing.costOf('<synthetic>', { input_tokens: 1e6, output_tokens: 1e6 }), 0);
  assert.ok(pricing.isSynthetic('<synthetic>'));

  const cost = pricing.costOf('claude-opus-5', {
    input_tokens: 1_000_000, output_tokens: 0, cache_w_5m: 0, cache_w_1h: 0, cache_read: 0,
  });
  assert.ok(cost > 10 && cost < 20, 'Opus-Preis pro Mio Input unplausibel: ' + cost);

  // Haiku muss deutlich billiger sein als Opus, sonst stimmt die Zuordnung nicht.
  const haiku = pricing.costOf('claude-haiku-4-5-20251001', { input_tokens: 1_000_000 });
  assert.ok(haiku < cost / 5, 'Haiku nicht billiger als Opus: ' + haiku + ' vs ' + cost);

  // Unbekanntes Modell darf nicht stillschweigend 0 kosten, wenn es Claude ist.
  const unknown = pricing.costOf('claude-opus-5-preview-99', { input_tokens: 1_000_000 });
  assert.ok(unknown > 0, 'unbekannte Opus-Variante ergab 0 Kosten');
}

// Ein Modell, das die Preisliste nicht kennt, kostete bisher still 0 — oder
// bekam ueber den Namensanfang den Preis eines aehnlichen Modells, ohne dass
// es jemand sah. Beides muss sichtbar sein, und sobald der echte Preis da ist,
// muss der Betrag nachgezogen werden.
function testPreisLuecken() {
  assert.strictEqual(pricing.preisArt('claude-opus-5'), 'exakt');
  assert.strictEqual(pricing.preisArt('claude-opus-5-preview-99'), 'geschaetzt',
    'Treffer ueber den Namensanfang gilt als exakter Preis');
  assert.strictEqual(pricing.preisArt('gpt-9-turbo'), 'ohne', 'unbekanntes Modell gilt als bepreist');
  assert.strictEqual(pricing.preisArt('<synthetic>'), 'frei');
  assert.strictEqual(pricing.preisArt('ollama/qwen3:8b'), 'frei', 'lokales Modell erscheint als Preisluecke');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-'));
  const projDir = path.join(tmp, 'C--Users-Test-Dev-Demo');
  fs.mkdirSync(projDir, { recursive: true });
  const mk = (reqId, model, sek) => JSON.stringify({
    type: 'assistant', timestamp: '2026-08-18T10:00:0' + sek + '.000Z', sessionId: 'sess-p',
    cwd: 'C:\\Users\\Test\\Dev\\Demo', gitBranch: 'main', requestId: reqId,
    message: { id: 'msg_' + reqId, model, usage: { input_tokens: 1_000_000, output_tokens: 0 } },
  });
  fs.writeFileSync(path.join(projDir, 'sess.jsonl'), [
    mk('p1', 'claude-opus-5', 1),
    mk('p2', 'claude-opus-5-preview-99', 2),
    mk('p3', 'gpt-9-turbo', 3),
    mk('p4', '<synthetic>', 4),
  ].join('\n') + '\n');

  const cfg = require('../config.json');
  const origDir = cfg.jsonlDir;
  cfg.jsonlDir = tmp;
  if (!cfg.lokaleModelle) cfg.lokaleModelle = {};
  const origLokal = cfg.lokaleModelle.protokollDir;
  cfg.lokaleModelle.protokollDir = path.join(tmp, 'lokal-leer');

  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const zeile = (id) => db.prepare('SELECT cost_usd, preis_art FROM events WHERE request_id = ?').get(id);

  return ingest.run({ db }).then(() => {
    assert.strictEqual(zeile('p1').preis_art, null, 'exakt bepreistes Modell ist markiert');
    assert.strictEqual(zeile('p2').preis_art, 'geschaetzt');
    assert.ok(zeile('p2').cost_usd > 0, 'geschaetztes Modell kostet 0');
    assert.strictEqual(zeile('p3').preis_art, 'ohne');
    assert.strictEqual(zeile('p3').cost_usd, 0, 'Modell ohne Preis traegt einen erfundenen Betrag');
    assert.strictEqual(zeile('p4').preis_art, null, 'synthetisches Modell erscheint als Preisluecke');

    const luecken = metrics.preisLuecken(db, {});
    assert.deepStrictEqual(luecken.map((l) => l.model + ':' + l.preis_art).sort(),
      ['claude-opus-5-preview-99:geschaetzt', 'gpt-9-turbo:ohne'], 'Liste der Preisluecken stimmt nicht');
    assert.strictEqual(luecken.find((l) => l.model === 'gpt-9-turbo').total_tokens, 1_000_000);
    const jeModell = Object.fromEntries(metrics.byModel(db, {}).map((m) => [m.model, m.preis_art]));
    assert.strictEqual(jeModell['gpt-9-turbo'], 'ohne', 'byModel traegt die Kennzeichnung nicht');
    assert.strictEqual(jeModell['claude-opus-5'], null);
    // Der Zeitraumfilter gilt auch hier.
    assert.strictEqual(metrics.preisLuecken(db, { from: '2026-09-01' }).length, 0);

    // Der Preis wird bekannt. Der naechste Lauf muss den Betrag aus den
    // gespeicherten Tokens nachziehen und die Markierung loeschen.
    pricing.FALLBACK['gpt-9-turbo'] = { in: 2e-6, out: 8e-6, cw5m: 2.5e-6, cw1h: 4e-6, cr: 0.2e-6 };
    return ingest.run({ db });
  }).then(() => {
    // Abgeglichen wird nur mit geladener Preisliste. Ohne Netz und ohne
    // Zwischenspeicher kennt die eingebaute Tabelle zu wenige Modelle — der
    // Rest dieser Pruefung braucht deshalb die Liste.
    if (pricing.info().source === 'fallback') return null;
    assert.strictEqual(zeile('p3').preis_art, null, 'Markierung bleibt, obwohl der Preis jetzt bekannt ist');
    assert.ok(Math.abs(zeile('p3').cost_usd - 2.0) < 1e-9,
      'nachbepreist mit ' + zeile('p3').cost_usd + ' statt 2,00 USD');
    assert.strictEqual(metrics.preisLuecken(db, {}).length, 1, 'nur die Schaetzung darf uebrig bleiben');

    // Bestandszeilen aus der Zeit vor der Kennzeichnung werden markiert, ohne
    // ihren Betrag anzufassen.
    db.exec("UPDATE events SET preis_art = NULL, cost_usd = 7 WHERE request_id = 'p2'");
    return ingest.run({ db });
  }).then(() => {
    assert.strictEqual(zeile('p2').cost_usd, 7, 'Markieren hat den Betrag der Bestandszeile veraendert');
    // Nachtraeglich markiert wird nur mit geladener Preisliste. Ohne Netz und
    // ohne Zwischenspeicher kennt die eingebaute Tabelle zu wenige Modelle,
    // um eine Luecke von einem bekannten Modell zu unterscheiden.
    if (pricing.info().source !== 'fallback') {
      assert.strictEqual(zeile('p2').preis_art, 'geschaetzt', 'Bestandszeile wurde nicht markiert');
    }
  }).finally(() => {
    delete pricing.FALLBACK['gpt-9-turbo'];
    try { db.close(); } catch { /* bereits geschlossen */ }
    cfg.jsonlDir = origDir;
    cfg.lokaleModelle.protokollDir = origLokal;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

// --- Ingest gegen echte Datei ---------------------------------------------
// Baut eine kleine Logdatei mit bekannten Werten und prueft das Ergebnis.
function testIngestRoundtrip() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-'));
  const projDir = path.join(tmp, 'C--Users-Test-Dev-Demo');
  fs.mkdirSync(projDir, { recursive: true });
  const file = path.join(projDir, 'sess.jsonl');

  const mk = (reqId, ts, out) => JSON.stringify({
    type: 'assistant', timestamp: ts, sessionId: 'sess-1',
    cwd: 'C:\\Users\\Test\\Dev\\Demo', gitBranch: 'feature/PROJ-999-demo',
    requestId: reqId,
    message: {
      id: 'msg_' + reqId, model: 'claude-opus-5',
      usage: {
        input_tokens: 10, output_tokens: out, cache_creation_input_tokens: 0,
        cache_read_input_tokens: 5,
      },
    },
  });

  // Zwei Requests, der erste dreifach geschrieben (Streaming-Kopien).
  const lines = [
    mk('r1', '2026-08-18T10:00:00.000Z', 100),
    mk('r1', '2026-08-18T10:00:01.000Z', 100),
    mk('r1', '2026-08-18T10:00:02.000Z', 100),
    mk('r2', '2026-08-18T10:01:00.000Z', 50),
  ];
  fs.writeFileSync(file, lines.join('\n') + '\n');

  const cfg = require('../config.json');
  const origDir = cfg.jsonlDir;
  cfg.jsonlDir = tmp;
  // Auch die zweite Quelle umbiegen. Sonst liest der Lauf die echten
  // Protokollzeilen der lokalen Modelle mit, und der Test zaehlt Ereignisse,
  // die mit ihm nichts zu tun haben — je nach Rechner mal gruen, mal rot.
  if (!cfg.lokaleModelle) cfg.lokaleModelle = {};
  const origLokal = cfg.lokaleModelle.protokollDir;
  cfg.lokaleModelle.protokollDir = path.join(tmp, 'lokal-leer');

  const db = dbmod.open(':memory:');
  openDbs.push(db);
  return ingest.run({ db }).then(() => {
    const row = db.prepare('SELECT COUNT(*) c, SUM(output_tokens) o FROM events').get();
    assert.strictEqual(row.c, 2, 'erwartet 2 Requests, bekam ' + row.c);
    assert.strictEqual(row.o, 150, 'erwartet 150 Output-Tokens, bekam ' + row.o);

    const tick = db.prepare('SELECT DISTINCT ticket FROM events').all();
    assert.strictEqual(tick.length, 1);
    assert.strictEqual(tick[0].ticket, 'PROJ-999');

    // Alle vier Zeilen sind Aktivitaetssignale mit vier verschiedenen Zeiten.
    const act = db.prepare('SELECT COUNT(*) c FROM activity').get();
    assert.strictEqual(act.c, 4, 'erwartet 4 Aktivitaetsmarken, bekam ' + act.c);

    // Zweiter Lauf ohne Aenderung darf nichts verdoppeln.
    return ingest.run({ db }).then(() => {
      const again = db.prepare('SELECT COUNT(*) c, SUM(output_tokens) o FROM events').get();
      assert.strictEqual(again.c, 2, 'zweiter Lauf erzeugte Duplikate: ' + again.c);
      assert.strictEqual(again.o, 150, 'zweiter Lauf veraenderte Summen: ' + again.o);
    });
  }).finally(() => {
    // Muss auch bei fehlgeschlagener Pruefung laufen, sonst bleibt der
    // umgebogene Pfad stehen und der Temp-Ordner liegen.
    try { db.close(); } catch { /* bereits geschlossen */ }
    cfg.jsonlDir = origDir;
    cfg.lokaleModelle.protokollDir = origLokal;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

// --- Waehrung und Mehrwert --------------------------------------------------
// Arbeitswert steht in Euro, API-Kosten in Dollar. Werden sie ohne Umrechnung
// addiert, ist der ausgewiesene Mehrwert zu hoch.
function testMehrwert() {
  const config = require('../config.json');
  const kurs = config.usdToEur;
  assert.ok(kurs > 0 && kurs < 2, 'Kurs unplausibel: ' + kurs);
  // Das Abo laeuft nicht zwangslaeufig in Dollar: steht aboWaehrung auf EUR,
  // entfaellt die Umrechnung. Der Faktor kommt deshalb aus der Konfiguration
  // und nicht als feste Annahme in den Test.
  const aboKurs = String(config.aboWaehrung).toUpperCase() === 'EUR' ? 1 : kurs;

  const row = {
    arbeitswert: 1000,        // EUR
    api_gegenwert_usd: 500,   // USD
    abo_anteil_usd: 100,      // in aboWaehrung
  };
  const w = metrics.mehrwert(row, 1200);

  assert.strictEqual(w.arbeitswert, 1000);
  assert.ok(Math.abs(w.api_gegenwert - 500 * kurs) < 0.001,
    'API-Gegenwert nicht umgerechnet: ' + w.api_gegenwert);
  assert.ok(Math.abs(w.gegenwert - (1000 + 500 * kurs)) < 0.001);
  assert.ok(Math.abs(w.mehrwert - (1000 + 500 * kurs - 1200)) < 0.001);
  assert.ok(Math.abs(w.eigene_kosten - 100 * aboKurs) < 0.001,
    'Abokosten nicht in der Abo-Waehrung gerechnet: ' + w.eigene_kosten);
  // Der ungewandelte Vergleichswert muss abweichen, sonst greift die Umrechnung nicht.
  assert.notStrictEqual(w.gegenwert, 1500, 'Betraege wurden ohne Umrechnung addiert');

  // Deckungsbeitrag laesst die eigene Arbeitszeit bewusst aussen vor.
  const kosten = 100 * aboKurs;
  assert.ok(Math.abs(w.deckungsbeitrag - (1200 - kosten)) < 0.001,
    'Deckungsbeitrag falsch: ' + w.deckungsbeitrag);
  assert.ok(Math.abs(w.deckungsbeitrag_prozent - ((1200 - kosten) / 1200) * 100) < 0.001,
    'Deckungsbeitrag in Prozent falsch: ' + w.deckungsbeitrag_prozent);

  // Ohne gestellte Rechnung ist die Marge trotzdem bekannt: der Erloes ist
  // dann der Arbeitswert (Aktivstunden mal Satz), den die Rechnung spaeter nur
  // bestaetigt. Frueher stand hier "keine Marge", obwohl alle Groessen feststanden.
  const ohne = metrics.mehrwert(row, 0);
  assert.strictEqual(ohne.rechnungsbetrag, 0, 'ohne Rechnung darf kein Betrag erscheinen');
  assert.strictEqual(ohne.erloes_ist_rechnung, false, 'Erloes darf nicht als Rechnung gelten');
  assert.ok(Math.abs(ohne.erloes - 1000) < 0.001, 'Erloes muss der Arbeitswert sein: ' + ohne.erloes);
  assert.ok(Math.abs(ohne.deckungsbeitrag - (1000 - 100 * aboKurs)) < 0.001,
    'Deckungsbeitrag ohne Rechnung muss aus dem Arbeitswert folgen: ' + ohne.deckungsbeitrag);
  assert.ok(Math.abs(ohne.deckungsbeitrag_prozent - ((1000 - 100 * aboKurs) / 1000) * 100) < 0.001,
    'Deckungsbeitrag in Prozent ohne Rechnung falsch: ' + ohne.deckungsbeitrag_prozent);
  assert.ok(ohne.eigene_kosten > 0, 'eigene Kosten muessen weiterhin ausgewiesen werden');

  // Ist abgerechnet, schlaegt der tatsaechlich gestellte Betrag den geplanten
  // Arbeitswert — sonst wuerde ein Rabatt in der Marge untergehen.
  assert.strictEqual(w.erloes_ist_rechnung, true, 'gestellte Rechnung muss den Erloes setzen');
  assert.ok(Math.abs(w.erloes - 1200) < 0.001, 'Erloes muss der Rechnungsbetrag sein: ' + w.erloes);

  // Ohne Arbeitszeit und ohne Rechnung gibt es keinen Bezugswert.
  const leer = metrics.mehrwert({ arbeitswert: 0, api_gegenwert_usd: 0, abo_anteil_usd: 10 }, 0);
  assert.strictEqual(leer.deckungsbeitrag, null, 'ohne Erloes darf kein Deckungsbeitrag entstehen');
  assert.strictEqual(leer.marge, null, 'ohne Erloes darf keine Marge entstehen');
  assert.strictEqual(leer.marge_prozent, null, 'ohne Erloes darf keine Spanne entstehen');
}

// Die eigene Arbeitszeit ist keine kostenlose Zutat: im Stundensatz steckt sie
// bereits drin. Wird sie nicht abgezogen, weist das Dashboard Margen um 90 %
// aus, obwohl der tatsaechliche Gewinn ein Bruchteil davon ist.
function testMargeZiehtEigeneZeitAb() {
  const config = require('../config.json');
  const kurs = config.usdToEur;
  const aboKurs = String(config.aboWaehrung).toUpperCase() === 'EUR' ? 1 : kurs;
  const merkSatz = config.selbstkostenStunde;
  const merkZiel = config.zielmargeProzent;

  try {
    // 10 Stunden zu 85 EUR = 850 Erloes, Sachkosten 100 EUR. Der Rohwert wird
    // so gewaehlt, dass nach der Umrechnung genau 100 EUR herauskommen — bei
    // einem Euro-Abo ist das derselbe Betrag.
    const row = {
      arbeitswert: 850, active_hours: 10,
      api_gegenwert_usd: 0, abo_anteil_usd: 100 / aboKurs,
    };

    // Ohne hinterlegten Selbstkostensatz bleibt die Marge leer — lieber keine
    // Zahl als eine, die den eigenen Aufwand verschweigt.
    config.selbstkostenStunde = 0;
    config.zielmargeProzent = 0;
    const ohne = metrics.mehrwert(row, 0);
    assert.ok(Math.abs(ohne.deckungsbeitrag - 750) < 0.001,
      'Deckungsbeitrag muss 850 - 100 = 750 sein: ' + ohne.deckungsbeitrag);
    assert.strictEqual(ohne.marge, null, 'ohne Selbstkostensatz darf keine Marge erscheinen');
    assert.strictEqual(ohne.zeitkosten, null, 'ohne Selbstkostensatz keine Zeitkosten');
    assert.strictEqual(ohne.zielmarge_prozent, null, 'ohne Zielwert keine Zielmarge');

    // Mit 45 EUR Selbstkosten: 10 h = 450 EUR eigener Aufwand.
    // Gewinn = 850 - 100 - 450 = 300, das sind 35,3 % von 850.
    config.selbstkostenStunde = 45;
    const mit = metrics.mehrwert(row, 0);
    assert.ok(Math.abs(mit.zeitkosten - 450) < 0.001, 'Zeitkosten falsch: ' + mit.zeitkosten);
    assert.ok(Math.abs(mit.marge - 300) < 0.001, 'Marge muss 300 sein: ' + mit.marge);
    assert.ok(Math.abs(mit.marge_prozent - (300 / 850) * 100) < 0.01,
      'Marge in Prozent falsch: ' + mit.marge_prozent);
    // Der Deckungsbeitrag bleibt davon unberuehrt — beide Ebenen nebeneinander.
    assert.ok(Math.abs(mit.deckungsbeitrag - 750) < 0.001, 'Deckungsbeitrag darf sich nicht aendern');
    // Die Marge muss deutlich unter dem Deckungsbeitrag liegen, sonst wurde der
    // eigene Aufwand nicht abgezogen. Genau das war der gemeldete Fehler.
    assert.ok(mit.marge < mit.deckungsbeitrag,
      'Marge ignoriert die eigene Arbeitszeit: ' + mit.marge + ' vs. ' + mit.deckungsbeitrag);
    assert.ok(mit.marge_prozent < 50,
      'unplausibel hohe Marge, eigener Aufwand fehlt: ' + mit.marge_prozent);

    // Aufschlag bezieht sich auf die Vollkosten (Sach- plus Zeitkosten).
    assert.ok(Math.abs(mit.aufschlag_prozent - (300 / 550) * 100) < 0.01,
      'Aufschlag muss auf Vollkosten rechnen: ' + mit.aufschlag_prozent);

    // Zielmarge: reiner Soll/Ist-Vergleich, aendert die Marge nicht.
    config.zielmargeProzent = 30;
    const ziel = metrics.mehrwert(row, 0);
    assert.strictEqual(ziel.zielmarge_prozent, 30, 'Zielmarge nicht uebernommen');
    assert.ok(Math.abs(ziel.zielmarge_abweichung - ((300 / 850) * 100 - 30)) < 0.01,
      'Abweichung zur Zielmarge falsch: ' + ziel.zielmarge_abweichung);
    assert.ok(ziel.zielmarge_abweichung > 0, 'bei 35,3 % vs. Ziel 30 % muss die Abweichung positiv sein');
    assert.ok(Math.abs(ziel.marge - 300) < 0.001, 'Zielmarge darf die Marge nicht veraendern');

    // Ist abgerechnet, ersetzt der gestellte Betrag den geplanten Erloes —
    // ein Rabatt schlaegt dann voll auf die Marge durch.
    const rabattiert = metrics.mehrwert(row, 700);
    assert.ok(Math.abs(rabattiert.marge - (700 - 100 - 450)) < 0.001,
      'Rabatt schlaegt nicht auf die Marge durch: ' + rabattiert.marge);
  } finally {
    config.selbstkostenStunde = merkSatz;
    config.zielmargeProzent = merkZiel;
  }
}

// Das Abo wird in Euro abgerechnet (Anthropic Ireland), der API-Gegenwert
// stammt dagegen aus Dollar-Preislisten. Wird ein Euro-Abo trotzdem durch den
// Dollarkurs gedreht, erscheinen die Abokosten um den Kursfaktor zu niedrig und
// die Marge entsprechend zu gut.
function testAboWaehrung() {
  const config = require('../config.json');
  const merk = config.aboWaehrung;
  const kurs = config.usdToEur;
  assert.ok(kurs > 0 && kurs !== 1, 'Test braucht einen Kurs ungleich 1: ' + kurs);

  try {
    const row = { arbeitswert: 1000, api_gegenwert_usd: 0, abo_anteil_usd: 100 };

    config.aboWaehrung = 'EUR';
    const inEuro = metrics.mehrwert(row, 0);
    assert.ok(Math.abs(inEuro.eigene_kosten - 100) < 0.001,
      'Euro-Abo darf nicht umgerechnet werden: ' + inEuro.eigene_kosten);

    config.aboWaehrung = 'USD';
    const inDollar = metrics.mehrwert(row, 0);
    assert.ok(Math.abs(inDollar.eigene_kosten - 100 * kurs) < 0.001,
      'Dollar-Abo muss umgerechnet werden: ' + inDollar.eigene_kosten);

    // Der eigentliche Punkt: die beiden Faelle muessen sich unterscheiden.
    assert.notStrictEqual(inEuro.eigene_kosten, inDollar.eigene_kosten,
      'aboWaehrung bleibt wirkungslos, die Umrechnung laeuft in beiden Faellen gleich');

    // Kleinschreibung und unbekannte Werte duerfen nicht still auf 1 fallen —
    // sonst wuerde ein Tippfehler die Kosten unbemerkt schrumpfen lassen.
    config.aboWaehrung = 'eur';
    assert.ok(Math.abs(metrics.mehrwert(row, 0).eigene_kosten - 100) < 0.001,
      'Waehrung muss unabhaengig von Gross-/Kleinschreibung erkannt werden');
    config.aboWaehrung = 'CHF';
    assert.ok(Math.abs(metrics.mehrwert(row, 0).eigene_kosten - 100 * kurs) < 0.001,
      'unbekannte Waehrung muss beim Dollarkurs bleiben, nicht bei 1');
  } finally {
    config.aboWaehrung = merk;
  }
}

// Die Abo-Kachel im Ueberblick ist die echte Gegenzahl zum API-Gegenwert.
// Zwei Fehler waeren still: volle Monate ergaeben nicht genau den Abopreis,
// oder ein angeschnittener Monat zaehlte trotzdem voll.
function testAboKostenZeitraum() {
  const config = require('../config.json');
  const merk = config.aboPreisMonat;
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const ev = (id, tag, usd) => ins.run(id, tag + 'T10:00:00.000Z', 's1', 'Beispiel - App',
    'main', null, 'claude-opus-5', 1, 1, 0, 0, 0, 0, usd, 0, tag);
  ev('a1', '2026-07-05', 30);
  ev('a2', '2026-07-20', 10);
  ev('b1', '2026-08-03', 25);
  ev('b2', '2026-08-25', 75);

  try {
    config.aboPreisMonat = 100;
    const voll = metrics.aboKosten(db);
    assert.ok(Math.abs(voll - 200) < 0.001,
      'zwei volle Monate muessen genau zweimal den Abopreis ergeben: ' + voll);

    // Ab 10.07.: Juli nur noch 10 von 40 USD = 25, August voll = 100.
    const teil = metrics.aboKosten(db, { from: '2026-07-10' });
    assert.ok(Math.abs(teil - 125) < 0.001,
      'angeschnittener Monat muss anteilig zaehlen: ' + teil);

    config.aboPreisMonat = 0;
    assert.strictEqual(metrics.aboKosten(db), 0, 'ohne Abopreis keine Abokosten');
  } finally {
    config.aboPreisMonat = merk;
  }
}

function testOverhead() {
  const config = require('../config.json');
  assert.ok(Array.isArray(config.overheadProjekte) && config.overheadProjekte.length > 0,
    'keine Overhead-Projekte konfiguriert');
  assert.ok(metrics.isOverhead(config.overheadProjekte[0]), 'Overhead nicht erkannt');
  assert.ok(!metrics.isOverhead('Beispiel - App'), 'Kundenprojekt faelschlich als Overhead');
}

// --- Lokale Modelle --------------------------------------------------------
// Diese Modelle laufen auf eigener Hardware. Sie duerfen deshalb nie einen
// Dollarbetrag erben: eine Preisliste kennt "qwen3:8b" nicht, aber die
// Praefix-Suche in priceFor() findet frueher oder spaeter etwas Aehnliches —
// und dann steht ein erfundener Betrag auf einer Rechnung.
function testLokalOhnePreis() {
  assert.strictEqual(pricing.priceFor('ollama/qwen3:8b'), null,
    'lokales Modell bekam einen Preis');
  assert.strictEqual(pricing.costOf('ollama/qwen2.5-coder:7b',
    { input_tokens: 1e6, output_tokens: 1e6 }), 0,
    'lokales Modell erzeugte Kosten');
  assert.ok(pricing.isSynthetic('ollama/deepseek-r1:8b'),
    'lokales Modell nicht als kostenfrei erkannt');

  // Der eigentliche Beweis. Die Pruefung oben haengt sonst nur daran, dass
  // die Preisliste heute zufaellig keinen Eintrag "qwen3:8b" kennt: der
  // Herkunftsteil wird vor der Suche abgeschnitten, und LiteLLM fuehrt sehr
  // wohl Modelle unter genau diesen Namen. Nimmt die Liste morgen einen auf,
  // erbte das lokale Modell klaglos dessen Preis — und der Betrag stuende auf
  // einer Rechnung. Deshalb hier ein Name, den die Tabelle garantiert kennt:
  // Faellt die Ausnahme fuer lokale Modelle weg, wird dieser Test rot.
  const bekannt = Object.keys(pricing.FALLBACK)[0];
  assert.ok(pricing.costOf(bekannt, { input_tokens: 1e6 }) > 0,
    'Testannahme kaputt: ' + bekannt + ' hat selbst keinen Preis');
  assert.strictEqual(pricing.priceFor('ollama/' + bekannt), null,
    'lokales Modell erbte den Preis von ' + bekannt
    + ' — die Herkunft wird bei der Preissuche ignoriert');
  assert.strictEqual(pricing.costOf('ollama/' + bekannt, { input_tokens: 1e6 }), 0,
    'lokales Modell erzeugte Kosten ueber den geerbten Preis von ' + bekannt);

  // Gegenprobe: ein echtes Modell muss weiterhin kosten, sonst prueft der
  // Test nur, dass alles null ist.
  assert.ok(pricing.costOf('claude-opus-5', { input_tokens: 1e6 }) > 0,
    'Cloud-Modell kostet nichts mehr — die Ausnahme greift zu weit');
}

// Zuordnung ueber die Zeit: eine lokale Anfrage traegt weder Projekt noch
// Vorgang, gehoert aber zu dem Vorgang, an dem ringsum gearbeitet wurde.
function testLokalZuordnung() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  const tag = '2026-08-18';

  // Claude-Arbeit an PROJ-1 um 10:00, an PROJ-2 um 13:00.
  ins.run('c1', t(0), 's-1', 'Demo', 'PROJ-1', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 1, 0, tag, 'claude');
  ins.run('c2', t(180), 's-2', 'Demo', 'PROJ-2', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 1, 0, tag, 'claude');
  // Lokale Vorarbeit 20 Minuten VOR PROJ-1, also im 30-Minuten-Fenster.
  ins.run('l1', t(-20), 'lokal:' + tag, '(lokal)', null, 'ollama/qwen3:8b',
    600000, 400000, 0, 0, 0, 0, 0, 0, tag, 'lokal');
  // Lokale Anfrage um 11:30 — 90 Minuten von beiden Vorgaengen entfernt,
  // also ausserhalb jedes Fensters.
  ins.run('l2', t(90), 'lokal:' + tag, '(lokal)', null, 'ollama/llama3.2:3b',
    1000, 1000, 0, 0, 0, 0, 0, 0, tag, 'lokal');

  const zeilen = metrics.byTicket(db);
  const eins = zeilen.find((z) => z.ticket === 'PROJ-1');
  const zwei = zeilen.find((z) => z.ticket === 'PROJ-2');
  assert.ok(eins, 'PROJ-1 fehlt in der Auswertung');
  assert.strictEqual(eins.lokal_tokens, 1000000,
    'PROJ-1 bekam ' + eins.lokal_tokens + ' statt 1000000 lokale Tokens');
  assert.deepStrictEqual(eins.lokal_modelle, ['ollama/qwen3:8b']);
  // Gegenprobe: die weit entfernte Anfrage darf NICHT zugeordnet werden.
  assert.strictEqual(zwei.lokal_tokens, 0,
    'weit entfernte lokale Anfrage wurde PROJ-2 zugeschlagen');

  // Lokale Ereignisse duerfen nicht als eigener abrechenbarer Vorgang
  // erscheinen — sonst stuende "(lokal)" als Leistung auf einer Rechnung.
  const ohne = metrics.ohneTicket(db);
  assert.ok(!ohne.some((z) => z.gruppe === '(lokal)'),
    '(lokal) erscheint als eigener Vorgang');

  db.close();
}

// Die Pauschale: Tokens mal Preis, mit demselben Rabatt wie der Stundensatz.
// Genau einmal — die Rechnung uebernimmt den Betrag, statt ihn nachzurechnen.
function testLokalPauschale() {
  // Preis im Test setzen statt aus der config.json lesen: eine frische
  // Installation hat noch keine Pauschale, und dann waere jedes Ergebnis 0 —
  // der Test also gruen, ohne irgendetwas geprueft zu haben.
  const EUR = 0.5;
  const preis = metrics.lokalBetrag(1e6, 0, EUR);
  const halb = metrics.lokalBetrag(500000, 0, EUR);
  assert.ok(Math.abs(preis - EUR) < 1e-9,
    'eine Million Tokens ergab ' + preis + ' statt ' + EUR);
  assert.ok(Math.abs(preis - 2 * halb) < 1e-9, 'Betrag nicht linear zur Tokenzahl');

  const mitRabatt = metrics.lokalBetrag(1e6, 10, EUR);
  assert.ok(Math.abs(mitRabatt - preis * 0.9) < 1e-9,
    'Rabatt wirkt nicht: ' + mitRabatt + ' statt ' + (preis * 0.9));

  // Gegenprobe: ohne Tokens kein Betrag, und ein unsinniger Rabatt wird
  // begrenzt, statt einen negativen Betrag zu erzeugen.
  assert.strictEqual(metrics.lokalBetrag(0, 0, EUR), 0, 'Betrag ohne Tokens');
  assert.ok(metrics.lokalBetrag(1e6, 500, EUR) >= 0,
    'negativer Betrag bei einem Rabatt ueber 100 Prozent');

  // Ohne Pauschale darf kein Betrag entstehen — sonst stuende auf der Rechnung
  // ein erfundener Preis fuer Rechenzeit, die nichts gekostet hat.
  assert.strictEqual(metrics.lokalBetrag(5e6, 0, 0), 0,
    'ohne Pauschale entstand trotzdem ein Betrag');
}

// Plausibilitaet statt Formelnachbau: eine gruene Formel beweist nicht, dass
// der Preis stimmt. Eine Pauschale in der Groessenordnung der Arbeitszeit
// bedeutet einen falschen Preis je Million — und das faellt sonst erst beim
// Kunden auf.
function testLokalRechnungsposition() {
  const zeile = {
    ticket: 'PROJ-9', first_day: '2026-08-18', last_day: '2026-08-18',
    active_hours: 1, stundensatz: 100, stundensatz_standard: 100,
    rabatt_prozent: 0, arbeitswert: 100, gesamt_tokens: 0,
    lokal_tokens: 2500000, lokal_eur_pro_mio: 0.5, lokal_betrag_eur: 1.25,
  };
  assert.ok(
    Math.abs(zeile.lokal_betrag_eur - (zeile.lokal_tokens / 1e6) * zeile.lokal_eur_pro_mio) < 1e-9,
    'Beispielzeile ist in sich unstimmig'
  );
  assert.ok(zeile.lokal_betrag_eur < zeile.arbeitswert * 0.5,
    'Pauschale uebersteigt die halbe Zeitposition: '
    + zeile.lokal_betrag_eur + ' zu ' + zeile.arbeitswert);
}

// Die Marge muss beide Seiten kennen: die Pauschale als Erloes und die
// Rechenzeit als Sachkosten. Fehlt eine Seite, ist die Zahl geschoent.
function testLokalMarge() {
  const cfg = require('../config.json');
  const m = metrics.mehrwert({
    arbeitswert: 100, api_gegenwert_usd: 0, abo_anteil_usd: 0,
    active_hours: 1, lokal_betrag_eur: 10, lokal_stunden: 2,
  });
  assert.ok(Math.abs(m.erloes - 110) < 1e-9,
    'Pauschale fehlt im Erloes: ' + m.erloes + ' statt 110');
  const erwartet = 2 * ((cfg.lokaleModelle || {}).selbstkostenEurProStunde || 0);
  assert.ok(Math.abs(m.lokal_kosten - erwartet) < 1e-9,
    'Rechenzeit fehlt in den Kosten: ' + m.lokal_kosten + ' statt ' + erwartet);
  assert.ok(Math.abs(m.deckungsbeitrag - (110 - erwartet)) < 1e-9,
    'Deckungsbeitrag rechnet die lokale Rechenzeit nicht ab');

  // Gegenprobe: ohne lokale Nutzung darf sich nichts verschieben.
  const ohne = metrics.mehrwert({
    arbeitswert: 100, api_gegenwert_usd: 0, abo_anteil_usd: 0, active_hours: 1,
  });
  assert.ok(Math.abs(ohne.erloes - 100) < 1e-9, 'Erloes ohne lokale Nutzung verschoben');
  assert.strictEqual(ohne.lokal_kosten, 0, 'Kosten ohne lokale Nutzung');
}

// Der Proxy liest die Nutzungszahlen aus der Antwort. Beim Streaming stehen
// sie nur im letzten Block — und nur, wenn die Anfrage sie angefordert hat.
function testProxyUsage() {
  const proxy = require('../ollama-proxy');
  const strom = [
    'data: {"choices":[{"delta":{"content":"ok"}}]}',
    'data: {"choices":[],"usage":{"prompt_tokens":15,"completion_tokens":5,"total_tokens":20}}',
    'data: [DONE]',
  ].join('\n\n');
  const u = proxy.usageAusText(strom, true);
  assert.ok(u, 'Nutzungszahlen im Datenstrom nicht gefunden');
  assert.strictEqual(u.prompt_tokens, 15);
  assert.strictEqual(u.completion_tokens, 5);

  // Gegenprobe: derselbe Strom ohne Nutzungsblock. Ohne diesen Fall wuerde
  // ein leeres Ergebnis als Erfolg durchgehen und Nullzeilen protokollieren.
  const ohne = proxy.usageAusText(
    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]', true);
  assert.strictEqual(ohne, null, 'ohne Nutzungsblock kam trotzdem ein Ergebnis');

  // Gewoehnliche Antwort ohne Strom.
  const einfach = proxy.usageAusText('{"usage":{"prompt_tokens":3,"completion_tokens":4}}', false);
  assert.strictEqual(einfach.completion_tokens, 4);
  assert.strictEqual(proxy.usageAusText('kein json', false), null);

  // Nur Endpunkte anfassen, die ueberhaupt Nutzung melden.
  assert.ok(proxy.istChatPfad('/v1/chat/completions'));
  assert.ok(!proxy.istChatPfad('/api/tags'), 'Modell-Liste wird faelschlich mitgelesen');
}

// --- Werkzeug-Zuordnung ----------------------------------------------------
// Werkzeuge begleiten eine Arbeitssitzung. Ihre Kosten muessen dem Projekt
// zufallen, an dem zur selben Zeit gearbeitet wurde.
function testWerkzeugZuordnung() {
  const config = require('../config.json');
  const werkzeugName = config.overheadProjekte[0];
  const db = dbmod.open(':memory:');
  openDbs.push(db);

  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  const tag = '2026-08-18';

  // Arbeit an Projekt A um 10:00, an Projekt B um 11:00 (weit auseinander).
  ins.run('a1', t(0), 's-a', 'Projekt A', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 1.0, 0, tag);
  ins.run('b1', t(60), 's-b', 'Projekt B', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 1.0, 0, tag);
  // Werkzeug direkt neben A (2 Min) und direkt neben B (61 Min).
  ins.run('w1', t(2), 's-w1', werkzeugName, 'claude-haiku-4-5-20251001', 5, 5, 0, 0, 0, 0, 0.5, 0, tag);
  ins.run('w2', t(61), 's-w2', werkzeugName, 'claude-haiku-4-5-20251001', 5, 5, 0, 0, 0, 0, 0.25, 0, tag);

  const w = metrics.werkzeuge(db);
  assert.strictEqual(w.summe.requests, 2, 'erwartet 2 Werkzeug-Aufrufe');
  assert.ok(Math.abs(w.summe.cost_usd - 0.75) < 1e-9, 'Werkzeugkosten falsch: ' + w.summe.cost_usd);
  assert.strictEqual(w.summe.ohne_zuordnung, 0, 'Aufrufe blieben ohne Zuordnung');

  const proProjekt = Object.fromEntries(w.nach_projekt.map((x) => [x.projekt, x.cost_usd]));
  assert.ok(Math.abs(proProjekt['Projekt A'] - 0.5) < 1e-9,
    'Projekt A bekam ' + proProjekt['Projekt A'] + ' statt 0.5');
  assert.ok(Math.abs(proProjekt['Projekt B'] - 0.25) < 1e-9,
    'Projekt B bekam ' + proProjekt['Projekt B'] + ' statt 0.25');

  // Live darf das Werkzeug nicht als eigene Sitzung auffuehren.
  const l = metrics.live(db, { minutes: 60 * 24 * 365 });
  const werkzeugZeilen = l.sessions.filter((s) => s.project === werkzeugName);
  assert.strictEqual(werkzeugZeilen.length, 0,
    'Werkzeug erscheint als eigene Zeile in der Live-Ansicht');
  assert.ok(l.sessions.length >= 2, 'echte Sitzungen fehlen in der Live-Ansicht');
}

// --- Vorgaenge ohne Ticketnummer -------------------------------------------
// Arbeit ohne Vorgangsnummer muss abrechenbar sein, ohne die ticketbasierte
// Abrechnung zu beruehren. Drei Dinge sind hier teuer, wenn sie kippen:
// doppelt gezaehlter Werkzeugbetrieb, ein Projektname im Feld "ticket" (der
// woertlich auf einer Rechnung landen wuerde) und ein veraendertes byTicket().
function testOhneTicket() {
  const config = require('../config.json');
  const werkzeugName = config.overheadProjekte[0];
  const db = dbmod.open(':memory:');
  openDbs.push(db);

  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const akt = db.prepare(
    'INSERT INTO activity (session_id, ts, project, ticket, day) VALUES (?,?,?,?,?)'
  );
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  const tag = '2026-08-18';

  // Mit Ticket: PROJ-1. Ohne Ticket: "Kundenprojekt X". Plus Werkzeugbetrieb.
  ins.run('e1', t(0), 's1', 'Beispiel - App', 'feature/PROJ-1', 'PROJ-1', 'claude-opus-5',
    10, 10, 0, 0, 0, 0, 1.0, 0, tag);
  ins.run('e2', t(30), 's2', 'Kundenprojekt X', 'main', null, 'claude-opus-5',
    10, 10, 0, 0, 0, 0, 2.0, 0, tag);
  ins.run('e3', t(31), 's2', 'Kundenprojekt X', 'main', null, 'claude-opus-5',
    10, 10, 0, 0, 0, 0, 0.5, 0, tag);
  ins.run('w1', t(1), 's-w', werkzeugName, null, null, 'claude-haiku-4-5-20251001',
    5, 5, 0, 0, 0, 0, 0.4, 0, tag);

  // Aktivzeit: 6 Minuten am ticketlosen Projekt. Zwei Abstaende von 3 Minuten,
  // beide unter der Pausenschwelle (config.gapMinutes) — eine einzelne
  // 6-Minuten-Luecke waere als Pause gewertet worden und haette 0 ergeben.
  akt.run('s2', t(30), 'Kundenprojekt X', null, tag);
  akt.run('s2', t(33), 'Kundenprojekt X', null, tag);
  akt.run('s2', t(36), 'Kundenprojekt X', null, tag);
  akt.run('s1', t(0), 'Beispiel - App', 'PROJ-1', tag);
  akt.run('s1', t(4), 'Beispiel - App', 'PROJ-1', tag);

  const ohne = metrics.ohneTicket(db, { from: tag, to: tag });
  const namen = ohne.map((z) => z.gruppe);

  // 1. Das ticketlose Projekt taucht auf.
  assert.ok(namen.includes('Kundenprojekt X'),
    'ticketloser Vorgang fehlt, gefunden: ' + namen.join(', '));

  // 2. Der Werkzeugbetrieb NICHT — seine Kosten liegen ueber die Zuordnung
  //    bereits anteilig auf den echten Vorgaengen. Zweimal waere doppelt.
  assert.ok(!namen.includes(werkzeugName),
    'Werkzeugprojekt "' + werkzeugName + '" erscheint als eigener abrechenbarer Vorgang');

  // 3. Ein Vorgang MIT Ticket darf hier nicht doppelt erscheinen.
  assert.ok(!namen.includes('Beispiel - App'),
    'Projekt mit Ticketbezug erscheint zusaetzlich als ticketlose Zeile');

  const x = ohne.find((z) => z.gruppe === 'Kundenprojekt X');

  // 4. Kein Feld "ticket". Es ginge sonst ungeprueft durch rechnung.js und
  //    stuende als Projektname auf einem Dokument nach § 14 UStG.
  assert.strictEqual(x.ticket, undefined,
    'ticketlose Zeile traegt ein Feld "ticket" (' + x.ticket + ') und wuerde als Vorgangsnummer gedruckt');
  assert.strictEqual(x.art, 'projekt', 'Herkunft der Zeile ist nicht gekennzeichnet');

  // 5. Zahlen stimmen: 6 Minuten Aktivzeit, Kosten beider Ereignisse.
  assert.ok(Math.abs(x.active_hours - 0.1) < 1e-9,
    'Aktivzeit ' + x.active_hours + ' h statt 0,1 h');
  assert.ok(Math.abs(x.cost_usd - 2.5) < 1e-9,
    'Kosten ' + x.cost_usd + ' statt 2,5 USD');
  const erwartet = 0.1 * metrics.satzFuerProjekt('Kundenprojekt X').satz;
  assert.ok(Math.abs(x.arbeitswert - erwartet) < 1e-9,
    'Arbeitswert ' + x.arbeitswert + ' statt ' + erwartet);

  // 6. Plausibilitaet statt reiner Formelprobe: ein Vorgang von sechs Minuten
  //    darf keinen dreistelligen Arbeitswert tragen.
  assert.ok(x.arbeitswert > 0 && x.arbeitswert < 100,
    'Arbeitswert ' + x.arbeitswert + ' EUR fuer 6 Minuten ist unplausibel');

  // 7. byTicket() bleibt unberuehrt — dort haengen Rechnung, Angebot und
  //    der Jira-Abgleich dran, die einen echten Schluessel voraussetzen.
  const mit = metrics.byTicket(db, { from: tag, to: tag });
  assert.strictEqual(mit.length, 1, 'byTicket lieferte ' + mit.length + ' Zeilen statt 1');
  assert.strictEqual(mit[0].ticket, 'PROJ-1');
  assert.ok(mit.every((z) => z.ticket), 'byTicket enthaelt eine Zeile ohne Ticketschluessel');

  // 8. Eine Rechnung ueber den ticketlosen Vorgang muss entstehen — und zwar
  //    nur ueber den eigenen Parameter. Steht der Projektname in "tickets",
  //    darf nichts gefunden werden, sonst waere die Trennung wirkungslos.
  const rechnung = require('../rechnung');
  const empf = { name: 'Testkunde GmbH', anschrift: ['Teststr. 1', '12345 Teststadt'] };
  // Stammdaten setzen, sonst bricht das Erstellen schon an der Par.-14-Pruefung
  // ab und der Test belegt nur diese — nicht die Trennung, um die es hier geht.
  rechnungsUmgebung(() => {
    assert.throws(
      () => rechnung.erstelle(db, { from: tag, to: tag, tickets: ['Kundenprojekt X'], empfaenger: empf }),
      /keine Daten/i,
      'Projektname wurde als Vorgangsnummer akzeptiert');

    const inv = rechnung.erstelle(db, {
      from: tag, to: tag, projekte: ['Kundenprojekt X'], empfaenger: empf,
    });
    const pos = JSON.parse(db.prepare('SELECT positionen FROM invoices WHERE nr = ?')
      .get(inv.nr).positionen);
    assert.strictEqual(pos.length, 1, 'Rechnung enthaelt ' + pos.length + ' Positionen statt 1');
    assert.strictEqual(pos[0].ticket, 'Kundenprojekt X',
      'Leistungsbezeichnung fehlt oder ist leer: ' + pos[0].ticket);
    assert.strictEqual(pos[0].ohne_vorgangsnummer, true,
      'Position ist nicht als "ohne Vorgangsnummer" gekennzeichnet');
    assert.ok(pos[0].betrag_eur > 0 && pos[0].betrag_eur < 100,
      'Betrag ' + pos[0].betrag_eur + ' EUR fuer 6 Minuten ist unplausibel');
    assert.ok(Math.abs(inv.netto_eur - pos[0].betrag_eur) < 1e-9,
      'Rechnungsnetto ' + inv.netto_eur + ' weicht von der Position ab');
  });
}

// --- Abrechnungssumme je Ticket --------------------------------------------
// Ein Ticket muss die eigene Arbeit UND die begleitenden Werkzeuge enthalten,
// sonst wird zu wenig abgerechnet.
function testTicketGesamtsumme() {
  const config = require('../config.json');
  const werkzeugName = config.overheadProjekte[0];
  const db = dbmod.open(':memory:');
  openDbs.push(db);

  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  const tag = '2026-08-18';

  // Arbeit an PROJ-500, zwei Aufrufe.
  ins.run('a1', t(0), 's-a', 'Projekt A', 'feature/PROJ-500-x', 'PROJ-500',
    'claude-opus-5', 100, 100, 0, 0, 0, 0, 2.0, 0, tag);
  ins.run('a2', t(3), 's-a', 'Projekt A', 'feature/PROJ-500-x', 'PROJ-500',
    'claude-opus-5', 100, 100, 0, 0, 0, 0, 1.0, 0, tag);
  // Werkzeug laeuft waehrenddessen mit.
  ins.run('w1', t(1), 's-w', werkzeugName, null, null,
    'claude-haiku-4-5-20251001', 50, 50, 0, 0, 0, 0, 0.5, 0, tag);
  // Werkzeug weit ausserhalb: darf dem Ticket NICHT zufallen.
  ins.run('w2', t(300), 's-w2', werkzeugName, null, null,
    'claude-haiku-4-5-20251001', 50, 50, 0, 0, 0, 0, 0.9, 0, tag);

  const reihe = metrics.byTicket(db).find((x) => x.ticket === 'PROJ-500');
  assert.ok(reihe, 'PROJ-500 fehlt in der Auswertung');

  assert.ok(Math.abs(reihe.cost_usd - 3.0) < 1e-9,
    'eigene Kosten falsch: ' + reihe.cost_usd);
  assert.ok(Math.abs(reihe.werkzeug_cost_usd - 0.5) < 1e-9,
    'Werkzeuganteil falsch (weit entferntes Ereignis faelschlich zugerechnet?): ' + reihe.werkzeug_cost_usd);
  assert.ok(Math.abs(reihe.api_gegenwert_usd - 3.5) < 1e-9,
    'Abrechnungssumme ist nicht Arbeit + Werkzeug: ' + reihe.api_gegenwert_usd);

  // Tokens muessen ebenso zusammengefasst sein.
  assert.strictEqual(reihe.total_tokens, 400, 'eigene Tokens falsch');
  assert.strictEqual(reihe.werkzeug_tokens, 100, 'Werkzeug-Tokens falsch');
  assert.strictEqual(reihe.gesamt_tokens, 500, 'Gesamttokens sind nicht die Summe');

  // Der Gegenwert muss auf der Gesamtsumme beruhen, nicht nur auf der Arbeit.
  const erwartet = reihe.arbeitswert + metrics.usdToEur(3.5);
  assert.ok(Math.abs(reihe.gegenwert_eur - erwartet) < 1e-9,
    'Gegenwert rechnet ohne Werkzeuganteil');

  // Entscheidend fuer die Abrechnung: Die Einzelabfrage eines Tickets muss
  // dieselben Zahlen liefern wie die Sammelansicht. Wird der Ticketfilter
  // versehentlich auch auf die Werkzeuge angewandt, verschwinden deren
  // Kosten, und Dashboard und Jira weisen verschiedene Betraege aus.
  const gefiltert = metrics.byTicket(db, { ticket: 'PROJ-500' })[0];
  assert.ok(gefiltert, 'PROJ-500 fehlt bei gefilterter Abfrage');
  assert.ok(Math.abs(gefiltert.werkzeug_cost_usd - reihe.werkzeug_cost_usd) < 1e-9,
    `Werkzeugkosten weichen ab: gefiltert ${gefiltert.werkzeug_cost_usd}, ungefiltert ${reihe.werkzeug_cost_usd}`);
  assert.ok(Math.abs(gefiltert.api_gegenwert_usd - reihe.api_gegenwert_usd) < 1e-9,
    `Abrechnungssumme weicht ab: gefiltert ${gefiltert.api_gegenwert_usd}, ungefiltert ${reihe.api_gegenwert_usd}`);
  assert.strictEqual(gefiltert.gesamt_tokens, reihe.gesamt_tokens,
    'Gesamttokens weichen zwischen gefilterter und ungefilterter Abfrage ab');
}

// --- Stundensaetze je Projekt ----------------------------------------------
// Kunden haben unterschiedliche Preise. Ein falsch aufgeloester Satz faellt
// niemandem auf, landet aber direkt im Angebot.
function testStundensaetze() {
  const config = require('../config.json');
  const standard = config.stundensatz;
  const original = config.projektSaetze;
  try {
    config.projektSaetze = {
      'Eigener': { satz: 120, kunde: 'A' },
      'Rabattiert': { rabatt: 25 },
      'Zuviel': { rabatt: 150 },
      'Negativ': { rabatt: -10 },
      'Kombiniert': { satz: 150, rabatt: 50 },
      'Kaputt': { satz: 'abc' },
    };
    const s = (p) => metrics.satzFuerProjekt(p);

    assert.strictEqual(s('Eigener').satz, 120, 'eigener Satz nicht uebernommen');
    assert.strictEqual(s('Eigener').kunde, 'A');
    assert.ok(Math.abs(s('Rabattiert').satz - standard * 0.75) < 1e-9,
      'Rabatt falsch gerechnet: ' + s('Rabattiert').satz);
    assert.strictEqual(s('Unbekannt').satz, standard, 'Standardsatz greift nicht');

    // Grenzwerte duerfen keine unsinnigen Saetze erzeugen.
    assert.strictEqual(s('Zuviel').satz, 0, 'Rabatt ueber 100 % ergibt negativen Satz');
    assert.strictEqual(s('Negativ').satz, standard, 'negativer Rabatt erhoeht den Satz');
    // Satz und Rabatt zusammen: der Rabatt wirkt auf den eigenen Satz,
    // damit sich ein Kundenpreis zusaetzlich nachlassen laesst.
    assert.strictEqual(s('Kombiniert').satz, 75,
      'Rabatt muss auf den eigenen Satz wirken: 150 minus 50 % = 75');
    assert.strictEqual(s('Kombiniert').basissatz, 150, 'Basissatz falsch ausgewiesen');
    assert.strictEqual(s('Kombiniert').rabatt, 50, 'Rabatt falsch ausgewiesen');
    assert.strictEqual(s('Kaputt').satz, standard, 'ungueltiger Satz faellt nicht auf Standard zurueck');
  } finally {
    config.projektSaetze = original;
  }
}

// --- Backfill: nachtraegliche Ticket-Zuordnung ------------------------------
// Hier entsteht Falschabrechnung, wenn die Zuordnung zu grosszuegig ist:
// fremde Arbeit landet auf einem Ticket, ohne dass es jemand sieht.
// Geprueft wird deshalb beides — was zugeordnet werden MUSS und was NICHT.
function backfillDb() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, cwd, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insAkt = db.prepare(
    'INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)'
  );
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  const tag = '2026-08-18';
  const ereignis = (id, min, session, projekt, cwd, branch, ticket) => {
    ins.run(id, t(min), session, projekt, cwd, branch, ticket, 'claude-opus-5',
      10, 10, 0, 0, 0, 0, 1.0, 0, tag);
    insAkt.run(session, t(min), projekt, branch, ticket, tag);
  };
  return { db, ereignis, t };
}

function testBackfillCwd() {
  const backfill = require('../backfill');
  const { db, ereignis } = backfillDb();
  // Worktree mit abgeloestem HEAD: der Schluessel steht nur im Pfad.
  ereignis('e1', 0, 's1', 'Beispiel - App', 'C:\\Dev\\worktrees\\PROJ-777-feature', 'HEAD', null);
  // Ohne Schluessel im Pfad bleibt es ticketlos.
  ereignis('e2', 1, 's2', 'Beispiel - App', 'C:\\Dev\\Beispiel - App', 'dev', null);

  backfill.stufeCwd(db);
  const z = db.prepare('SELECT ticket, ticket_quelle FROM events WHERE request_id = ?').get('e1');
  assert.strictEqual(z.ticket, 'PROJ-777', 'Ticket aus dem Worktree-Pfad nicht erkannt');
  assert.strictEqual(z.ticket_quelle, 'cwd', 'Herkunft der Zuordnung nicht vermerkt');
  assert.strictEqual(
    db.prepare('SELECT ticket FROM events WHERE request_id = ?').get('e2').ticket, null,
    'Pfad ohne Ticket-Schluessel wurde faelschlich zugeordnet');
}

function testBackfillSessionKonsens() {
  const backfill = require('../backfill');
  const { db, ereignis } = backfillDb();
  // Eine Sitzung, Branch-Wechsel mittendrin: alles gehoert zusammen.
  ereignis('a1', 0, 's-mix', 'Beispiel - App', 'C:\\Dev\\Beispiel - App', 'feature/PROJ-500', 'PROJ-500');
  ereignis('a2', 2, 's-mix', 'Beispiel - App', 'C:\\Dev\\Beispiel - App', 'dev', null);
  // Sitzung mit ZWEI Tickets: uneindeutig, darf nicht raten.
  ereignis('b1', 0, 's-zwei', 'Beispiel - App', null, 'feature/PROJ-1', 'PROJ-1');
  ereignis('b2', 1, 's-zwei', 'Beispiel - App', null, 'feature/PROJ-2', 'PROJ-2');
  ereignis('b3', 2, 's-zwei', 'Beispiel - App', null, 'dev', null);

  backfill.stufeSessionKonsens(db);
  const a2 = db.prepare('SELECT ticket, ticket_quelle FROM events WHERE request_id = ?').get('a2');
  assert.strictEqual(a2.ticket, 'PROJ-500', 'ticketloses Ereignis der Sitzung nicht geerbt');
  assert.strictEqual(a2.ticket_quelle, 'session');
  // Die Aktivzeit muss mitwandern, sonst passen Arbeitswert und Kosten nicht zusammen.
  const akt = db.prepare(
    'SELECT ticket FROM activity WHERE session_id = ? AND ticket IS NOT NULL'
  ).all('s-mix');
  assert.strictEqual(akt.length, 2, 'Aktivzeit wurde nicht mit zugeordnet');
  assert.strictEqual(
    db.prepare('SELECT ticket FROM events WHERE request_id = ?').get('b3').ticket, null,
    'Sitzung mit zwei Tickets wurde geraten statt ausgelassen');
}

function testBackfillZeitfenster() {
  const backfill = require('../backfill');
  const config = require('../config.json');
  const werkzeugName = config.overheadProjekte[0];
  const { db, ereignis } = backfillDb();

  // Ticket-Arbeit im Projekt A.
  ereignis('t1', 0, 's-ticket', 'Projekt A', null, 'feature/PROJ-900', 'PROJ-900');
  ereignis('t2', 2, 's-ticket', 'Projekt A', null, 'feature/PROJ-900', 'PROJ-900');
  // Ticketlose Sitzung direkt daneben, gleiches Projekt: gehoert dazu.
  ereignis('n1', 1, 's-nah', 'Projekt A', null, 'dev', null);
  // Ticketlose Sitzung im ANDEREN Projekt, zeitgleich: darf nicht wandern.
  ereignis('f1', 1, 's-fremd', 'Projekt B', null, 'dev', null);
  // Ticketlose Sitzung weit ausserhalb des Fensters: bleibt ticketlos.
  ereignis('w1', 600, 's-weit', 'Projekt A', null, 'dev', null);
  // Werkzeug-Projekt: wird bereits ueber werkzeugeJeTicket zugeordnet,
  // hier anzufassen hiesse denselben Betrag zweimal abzurechnen.
  ereignis('o1', 1, 's-werkzeug', werkzeugName, null, null, null);

  // Lange Sitzung, die nur an EINER Stelle zufaellig neben Ticket-Arbeit
  // liegt: 1 von 5 Ereignissen hat einen Nachbarn, das ist keine Mehrheit.
  // Ohne Quorum wuerde ein Streifschuss die ganze Sitzung abrechnen.
  ereignis('q1', 2, 's-quorum', 'Projekt A', null, 'dev', null);
  for (let i = 0; i < 4; i++) {
    ereignis('q' + (i + 2), 120 + i * 2, 's-quorum', 'Projekt A', null, 'dev', null);
  }

  backfill.stufeZeitfenster(db);
  const ticketVon = (id) => db.prepare('SELECT ticket FROM events WHERE request_id = ?').get(id).ticket;
  assert.strictEqual(ticketVon('n1'), 'PROJ-900', 'benachbarte Sitzung im selben Projekt nicht zugeordnet');
  assert.strictEqual(ticketVon('f1'), null, 'fremdes Projekt wurde faelschlich zugeordnet');
  assert.strictEqual(ticketVon('w1'), null, 'Sitzung ausserhalb des Zeitfensters wurde zugeordnet');
  assert.strictEqual(ticketVon('o1'), null, 'Werkzeug-Projekt wurde angefasst (Doppelzaehlung)');
  assert.strictEqual(ticketVon('q1'), null,
    'Sitzung ohne Mehrheit wurde zugeordnet — ein einzelner Nachbar reicht nicht (Quorum)');
  assert.strictEqual(ticketVon('q5'), null, 'Quorum-Sitzung teilweise zugeordnet');
}

function testBackfillOverrideUndIdempotenz() {
  const backfill = require('../backfill');
  const { db, ereignis } = backfillDb();
  ereignis('x1', 0, 's-x', 'Projekt A', null, 'feature/PROJ-1', 'PROJ-1');
  ereignis('x2', 1, 's-x', 'Projekt A', null, 'dev', null);
  db.prepare('INSERT INTO overrides (session_id, ticket, note, created_at) VALUES (?,?,?,?)')
    .run('s-x', 'PROJ-999', 'manuell', '2026-08-18T10:00:00Z');

  const erster = backfill.run({ db });
  const z = db.prepare('SELECT ticket, ticket_quelle FROM events WHERE request_id = ?').get('x1');
  assert.strictEqual(z.ticket, 'PROJ-999', 'Override schlaegt die Branch-Zuordnung nicht');
  assert.strictEqual(z.ticket_quelle, 'override');
  assert.ok(erster.gesamt > 0, 'erster Lauf ordnete nichts zu');

  // Zweiter Lauf darf nichts mehr aendern, sonst waere der Backfill nicht
  // gefahrlos wiederholbar — er laeuft nach jedem Einlesen erneut.
  const zweiter = backfill.run({ db });
  assert.strictEqual(zweiter.gesamt, 0,
    'Backfill ist nicht idempotent, zweiter Lauf aenderte ' + zweiter.gesamt + ' Zeilen');
}

// --- Sitzung von Hand auf einen Vorgang buchen -----------------------------
// Der gebuchte Name steht spaeter woertlich auf einer Rechnung. Was hier
// durchrutscht, faellt erst beim Kunden auf.
function testBuchenSchreibtDurch() {
  const { bucheVorgang } = require('../server');
  const { db, ereignis } = backfillDb();
  ereignis('b1', 0, 's-frei', 'Eigenes Projekt', null, 'dev', null);
  // Eigenes Projekt, damit die Zeitfenster-Stufe sie nicht an die gebuchte
  // Sitzung anheftet — geprueft wird die Buchung, nicht der Backfill.
  ereignis('b2', 1, 's-andere', 'Anderes Projekt', null, 'dev', null);

  const r = bucheVorgang(db, { session_id: 's-frei', vorgang: '  webshop-relaunch  ' });
  assert.strictEqual(r.ticket, 'WEBSHOP-RELAUNCH',
    'Vorgang nicht gross geschrieben: sonst stehen webshop-1 und WEBSHOP-1 als zwei Vorgaenge nebeneinander');

  const z = db.prepare('SELECT ticket, ticket_quelle FROM events WHERE request_id = ?').get('b1');
  assert.strictEqual(z.ticket, 'WEBSHOP-RELAUNCH', 'Buchung wirkt nicht sofort in events');
  assert.strictEqual(z.ticket_quelle, 'override', 'Herkunft der Buchung nicht vermerkt');
  assert.strictEqual(
    db.prepare('SELECT ticket FROM activity WHERE session_id = ?').get('s-frei').ticket,
    'WEBSHOP-RELAUNCH',
    'activity nicht mitgezogen: Arbeitswert und Kosten lagen dann auf verschiedenen Vorgaengen');

  // Gegenprobe: fremde Sitzung bleibt unberuehrt.
  assert.strictEqual(
    db.prepare('SELECT ticket FROM events WHERE request_id = ?').get('b2').ticket, null,
    'Buchung griff auf eine fremde Sitzung durch');

  // Gegenprobe: der Backfill bleibt danach wiederholbar.
  const backfill = require('../backfill');
  assert.strictEqual(backfill.run({ db }).gesamt, 0,
    'Backfill nach der Buchung nicht mehr idempotent');
}

function testBuchenGrenzen() {
  const { bucheVorgang } = require('../server');
  const { db, ereignis } = backfillDb();
  ereignis('g1', 0, 's-g', 'Projekt', null, 'dev', null);

  const schlecht = ['A', 'a b', '../x', '-abc', 'x'.repeat(41), 'Größe', 'a;drop'];
  for (const v of schlecht) {
    assert.throws(() => bucheVorgang(db, { session_id: 's-g', vorgang: v }),
      'Vorgang "' + v + '" wurde angenommen, gehoert aber nicht auf ein Dokument nach § 14 UStG');
  }
  // Kein halber Schreibvorgang: abgelehnt heisst unveraendert.
  assert.strictEqual(
    db.prepare('SELECT COUNT(*) AS n FROM overrides').get().n, 0,
    'abgelehnter Vorgang hinterliess trotzdem einen Eintrag');
  assert.strictEqual(
    db.prepare('SELECT ticket FROM events WHERE request_id = ?').get('g1').ticket, null,
    'abgelehnter Vorgang wurde trotzdem zugeordnet');
}

function testBuchenUnbekannteSitzung() {
  const { bucheVorgang } = require('../server');
  const { db, ereignis } = backfillDb();
  ereignis('u1', 0, 's-u', 'Projekt', null, 'dev', null);

  assert.throws(() => bucheVorgang(db, { session_id: 'gibt-es-nicht', vorgang: 'PROJ-1' }),
    'unbekannte Sitzung wurde gebucht');
  // Ein Tippfehler im Vorgang darf nicht als Sitzungsproblem gemeldet werden,
  // sonst sucht der Benutzer an der falschen Stelle.
  assert.throws(
    () => bucheVorgang(db, { session_id: 's-u', vorgang: 'a b' }),
    /Vorgang/,
    'falscher Vorgangsname wird nicht als solcher gemeldet');
  assert.throws(() => bucheVorgang(db, { session_id: '', vorgang: 'PROJ-1' }),
    'leere Sitzungskennung wurde angenommen');
  // Ein Override auf eine Sitzung, die es nicht gibt, waere fuer immer wirkungslos
  // und im Bestand nicht mehr erklaerbar.
  assert.strictEqual(
    db.prepare('SELECT COUNT(*) AS n FROM overrides').get().n, 0,
    'Waisen-Override angelegt');
}

function testBuchenUmbuchen() {
  const { bucheVorgang } = require('../server');
  const { db, ereignis } = backfillDb();
  ereignis('m1', 0, 's-m', 'Projekt', null, 'dev', null);

  bucheVorgang(db, { session_id: 's-m', vorgang: 'PROJ-1' });
  bucheVorgang(db, { session_id: 's-m', vorgang: 'PROJ-2' });

  assert.strictEqual(
    db.prepare('SELECT COUNT(*) AS n FROM overrides WHERE session_id = ?').get('s-m').n, 1,
    'Umbuchen legte einen zweiten Eintrag an statt den vorhandenen zu aendern');
  assert.strictEqual(
    db.prepare('SELECT ticket FROM events WHERE request_id = ?').get('m1').ticket, 'PROJ-2',
    'Umbuchung wirkte nicht: die Arbeit haengt noch am alten Vorgang');
}

function testBuchenAufheben() {
  const { bucheVorgang } = require('../server');
  const { db, ereignis } = backfillDb();
  // Sitzung mit erkennbarem Branch: nach dem Aufheben muss die automatische
  // Zuordnung wieder greifen.
  ereignis('l1', 0, 's-l', 'Projekt', null, 'feature/PROJ-1', 'PROJ-1');
  // Sitzung ohne erkennbaren Branch, in einem eigenen Projekt: nach dem
  // Aufheben ist sie wieder ticketlos. Eigenes Projekt, weil die
  // Zeitfenster-Stufe sie sonst an den Nachbarn PROJ-1 haengt — dann pruefte
  // der Test den Backfill statt das Aufheben.
  ereignis('l2', 1, 's-leer', 'Anderes Projekt', null, 'dev', null);

  bucheVorgang(db, { session_id: 's-l', vorgang: 'X-99' });
  bucheVorgang(db, { session_id: 's-leer', vorgang: 'X-98' });

  const r = bucheVorgang(db, { session_id: 's-l', vorgang: '' });
  assert.strictEqual(
    db.prepare('SELECT COUNT(*) AS n FROM overrides WHERE session_id = ?').get('s-l').n, 0,
    'Aufheben loeschte den Eintrag nicht');
  // Das Einlesen merkt sich die Leseposition je Datei und schreibt bereits
  // gelesene Ereignisse nie erneut. Wer sich darauf verlaesst, behaelt den
  // aufgehobenen Vorgang fuer immer im Bestand.
  assert.strictEqual(
    db.prepare('SELECT ticket FROM events WHERE request_id = ?').get('l1').ticket, 'PROJ-1',
    'nach dem Aufheben steht nicht wieder die Branch-Zuordnung da');
  assert.strictEqual(r.ticket, 'PROJ-1', 'Antwort meldet die wiederhergestellte Zuordnung nicht');

  // Gegenprobe: ohne erkennbaren Branch darf nichts stehen bleiben, schon gar
  // nicht der aufgehobene Vorgang.
  bucheVorgang(db, { session_id: 's-leer', vorgang: '' });
  assert.strictEqual(
    db.prepare('SELECT ticket FROM events WHERE request_id = ?').get('l2').ticket, null,
    'aufgehobener Vorgang blieb stehen, obwohl es keine automatische Zuordnung gibt');
  assert.strictEqual(
    db.prepare('SELECT ticket FROM activity WHERE session_id = ?').get('s-leer').ticket, null,
    'activity behielt den aufgehobenen Vorgang');
}

// Frei benannte Vorgaenge duerfen nicht nach Jira laufen: dort gibt es sie
// nicht, jeder Aufruf waere ein Fehlschlag gegen ein fremdes System.
function testIstJiraKey() {
  const jira = require('../jira-sync');
  assert.ok(jira.istJiraKey('PROJ-123', ['PROJ']), 'echter Schluessel nicht erkannt');
  assert.ok(!jira.istJiraKey('PROJ-RELAUNCH', ['PROJ']),
    'frei benannter Vorgang wuerde nach Jira geschickt');
  assert.ok(!jira.istJiraKey('PROJX-1', ['PROJ']), 'fremdes Projekt als eigenes erkannt');
  assert.ok(!jira.istJiraKey('ABC-1', ['PROJ']), 'unbekanntes Projekt durchgelassen');
  assert.ok(!jira.istJiraKey('PROJ-', ['PROJ']), 'Schluessel ohne Nummer durchgelassen');
  assert.ok(!jira.istJiraKey(null, ['PROJ']), 'fehlender Vorgang nicht abgefangen');
}

// Die Live-Ansicht unterscheidet "automatisch erkannt" von "von Hand gebucht".
// Ohne die Herkunft sieht eine fertige Zuordnung aus wie eine offene Aufgabe,
// und der Benutzer bucht nach, was laengst zugeordnet ist.
function testLiveHerkunft() {
  const metrics = require('../metrics');
  const { bucheVorgang } = require('../server');
  const { db, ereignis } = backfillDb();
  const jetzt = new Date().toISOString();
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, cwd, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  // Aus dem Branch erkannt.
  ins.run('lv1', jetzt, 's-auto', 'Projekt', null, 'feature/PROJ-9', 'PROJ-9', 'claude-opus-5',
    10, 10, 0, 0, 0, 0, 1.0, 0, jetzt.slice(0, 10));
  // Ticketlos, wird gleich von Hand gebucht.
  ins.run('lv2', jetzt, 's-hand', 'Anderes Projekt', null, 'dev', null, 'claude-opus-5',
    10, 10, 0, 0, 0, 0, 1.0, 0, jetzt.slice(0, 10));
  bucheVorgang(db, { session_id: 's-hand', vorgang: 'FREI-1' });

  const zeilen = metrics.live(db, { minutes: 60 }).sessions;
  const auto = zeilen.find((z) => z.session_id === 's-auto');
  const hand = zeilen.find((z) => z.session_id === 's-hand');

  assert.ok(auto && hand, 'Live-Ansicht liefert die Sitzungen nicht');
  assert.strictEqual(auto.ticket, 'PROJ-9');
  assert.strictEqual(auto.ticket_quelle, null,
    'Branch-Zuordnung traegt eine Herkunft, obwohl sie die Standardquelle ist');
  assert.strictEqual(hand.ticket, 'FREI-1');
  assert.strictEqual(hand.ticket_quelle, 'override',
    'von Hand gebuchte Sitzung ist in der Live-Ansicht nicht als solche erkennbar');
}

// Ein Subagent laeuft unter der session_id seiner Hauptsitzung, oft mit
// demselben Modell. Ohne eigene Zeile verschwindet er in der Hauptsitzung,
// mit eigener Zeile ohne Kennzeichen sieht er aus wie eine fremde Sitzung.
function testLiveSubagent() {
  const metrics = require('../metrics');
  const { db } = backfillDb();
  const jetzt = new Date().toISOString();
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  ins.run('sa1', jetzt, 's-haupt', 'Projekt', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 1.0, 0, jetzt.slice(0, 10));
  ins.run('sa2', jetzt, 's-haupt', 'Projekt', 'claude-opus-5', 10, 10, 0, 0, 0, 0, 2.0, 1, jetzt.slice(0, 10));

  const zeilen = metrics.live(db, { minutes: 60 }).sessions.filter((z) => z.session_id === 's-haupt');
  assert.strictEqual(zeilen.length, 2, 'Subagent verschwindet in der Zeile seiner Hauptsitzung');
  const haupt = zeilen.find((z) => !z.is_sidechain);
  const sub = zeilen.find((z) => z.is_sidechain);
  assert.ok(haupt && sub, 'Subagent-Zeile ist nicht als solche gekennzeichnet');
  assert.strictEqual(haupt.cost_usd, 1.0);
  assert.strictEqual(sub.cost_usd, 2.0);
}

// --- Jira: Tickets ohne Rohdaten -------------------------------------------
// Ein Ticket faelschlich als "keine Daten" zu markieren, obwohl Zahlen
// vorliegen, wuerde eine Rechnungsposition unsichtbar machen.
function testTicketsOhneDaten() {
  const jira = require('../jira-sync');
  const alle = ['PROJ-1', 'PROJ-2', 'PROJ-3'];
  const mitDaten = [{ ticket: 'PROJ-2' }];
  assert.deepStrictEqual(jira.ticketsOhneDaten(alle, mitDaten), ['PROJ-1', 'PROJ-3'],
    'Tickets mit Daten wurden nicht ausgenommen');
  assert.deepStrictEqual(jira.ticketsOhneDaten([], mitDaten), []);
  assert.deepStrictEqual(jira.ticketsOhneDaten(alle, []), alle,
    'ohne jede Datenzeile muessen alle Tickets markiert werden');

  // Der Marker muss im Kommentartext stehen, sonst findet ihn ein spaeterer
  // Lauf nicht wieder und schreibt denselben Hinweis erneut.
  const adf = JSON.stringify(jira.nodataKommentar('2026-07-19'));
  assert.ok(adf.includes(jira.MARKER_NODATA), 'Marker fehlt im Kommentar');
  assert.ok(adf.includes('2026-07-19'), 'Startdatum fehlt im Kommentar');
  assert.notStrictEqual(jira.MARKER_NODATA, jira.MARKER,
    'no-data-Marker darf nicht mit dem Ledger-Marker uebereinstimmen');
}

// --- Rechnungen -------------------------------------------------------------
// Rechnungen sind der Punkt, an dem ein Rechenfehler nach aussen geht. Geprueft
// wird deshalb: fortlaufende Nummer, Unveraenderlichkeit, beide Steuermodi und
// dass Nutzereingaben nicht als HTML im Dokument landen.
function rechnungsUmgebung(fn) {
  const config = require('../config.json');
  const original = JSON.parse(JSON.stringify(config.rechnung || {}));
  config.rechnung = {
    aussteller: {
      name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'],
      steuernummer: '123/456/78910', ustIdNr: '',
      bank: 'Testbank', iban: 'DE00 0000 0000 0000 0000 00', bic: 'TESTDEFF',
    },
    kleinunternehmer: true, ustSatz: 19, zahlungszielTage: 14, chromePfad: '',
  };
  // Auch den Vergleichsfaktor festnageln: sonst haengt das Ergebnis eines
  // Rechnungstests davon ab, was in der echten config.json steht, und der
  // Test wird je nach Rechner rot oder gruen.
  const merkFaktor = config.vergleichsFaktor;
  config.vergleichsFaktor = 0;
  try {
    return fn(config);
  } finally {
    config.rechnung = original;
    config.vergleichsFaktor = merkFaktor;
  }
}

function rechnungsDb() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insAkt = db.prepare(
    'INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)'
  );
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  // Zwei Stunden Arbeit an PROJ-500: 0 und 120 Minuten waeren eine Pause,
  // deshalb in Minutenschritten, damit die Aktivzeit zusammenhaengend zaehlt.
  for (let m = 0; m <= 120; m += 2) {
    insAkt.run('s-r', t(m), 'Beispiel - App', 'feature/PROJ-500', 'PROJ-500', '2026-08-18');
  }
  ins.run('r1', t(0), 's-r', 'Beispiel - App', 'feature/PROJ-500', 'PROJ-500',
    'claude-opus-5', 1000, 1000, 0, 0, 0, 0, 2.0, 0, '2026-08-18');
  return db;
}

function testRechnungNummernkreis() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const jahr = new Date().getFullYear();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };

    const a = rechnung.erstelle(db, daten);
    const b = rechnung.erstelle(db, daten);
    assert.strictEqual(a.nr, `${jahr}-0001`, 'erste Nummer falsch: ' + a.nr);
    assert.strictEqual(b.nr, `${jahr}-0002`, 'Nummer laeuft nicht fort: ' + b.nr);

    // Eine Nummer darf es nur einmal geben — sonst waere die Reihe wertlos.
    assert.throws(
      () => db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von,
        leistung_bis, empfaenger, aussteller, positionen, netto_eur, ust_prozent,
        ust_eur, brutto_eur, kleinunternehmer, status)
        VALUES ('X',?,1,'','','','{}','{}','[]',0,0,0,0,0,'erstellt')`).run(jahr),
      'doppelte laufende Nummer im selben Jahr wurde zugelassen');

    // Die Nummer landet spaeter in einem Dateipfad und einer URL. Der Test
    // darf sich nicht damit begnuegen, dass lade() nichts findet — genau das
    // taete es auch ohne Formatpruefung. Geprueft wird deshalb, dass eine
    // Nummer mit Pfadanteilen NICHT bis zur PDF-Erzeugung durchkommt, also
    // kein Schreibziel ausserhalb von data/rechnungen entstehen kann.
    // Entscheidend ist der Fall, in dem die Nummer eine ECHTE Zeile trifft und
    // trotzdem Pfadanteile mitbringt. Wird nur auf "lade() findet nichts"
    // geprueft, bleibt der Test gruen, auch wenn die Formatpruefung fehlt —
    // denn eine unbekannte Nummer liefert ohnehin nichts. Deshalb wird hier
    // eine Zeile mit boesartigem Schluessel direkt in die Tabelle gelegt.
    const jetzt = new Date().toISOString();
    const boesartig = '../../../windows/system32/beute';
    db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von,
      leistung_bis, empfaenger, aussteller, positionen, netto_eur, ust_prozent,
      ust_eur, brutto_eur, kleinunternehmer, status)
      VALUES (?,?,?,?,'2026-08-01','2026-08-31','{"name":"X"}','{}','[]',0,0,0,0,1,'erstellt')`)
      .run(boesartig, 1999, 9999, jetzt);

    assert.strictEqual(rechnung.lade(db, boesartig), null,
      'Rechnungsnummer mit Pfadanteilen wurde geladen — sie landet spaeter in einem Dateipfad');

    for (const boes of ['../config.json', '2026-0001/../../x', '', 'abc', '2026-1', '2026-00011']) {
      assert.strictEqual(rechnung.lade(db, boes), null,
        'unzulaessige Rechnungsnummer wurde angenommen: ' + JSON.stringify(boes));
    }
    assert.ok(rechnung.lade(db, a.nr), 'gueltige Nummer wurde abgelehnt');
    db.prepare('DELETE FROM invoices WHERE nr = ?').run(boesartig);

    // Ohne Pflichtangaben darf gar nichts entstehen.
    const config = require('../config.json');
    const merk = config.rechnung.aussteller.steuernummer;
    config.rechnung.aussteller.steuernummer = '';
    try {
      assert.throws(() => rechnung.erstelle(db, daten), /Par. 14|Stammdaten/,
        'Rechnung ohne Steuernummer wurde erstellt');
    } finally {
      config.rechnung.aussteller.steuernummer = merk;
    }
  });
}

function testRechnungUnveraenderlich() {
  rechnungsUmgebung((config) => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const inv = rechnung.erstelle(db, {
      from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' },
    });
    const vorher = rechnung.renderHtml(rechnung.lade(db, inv.nr));

    // Stundensatz nachtraeglich aendern: eine bereits gestellte Rechnung darf
    // das nicht mitbekommen.
    const merk = config.projektSaetze;
    try {
      config.projektSaetze = { 'Beispiel - App': { satz: 999, kunde: 'Beispielkunde' } };
      const nachher = rechnung.renderHtml(rechnung.lade(db, inv.nr));
      assert.strictEqual(nachher, vorher,
        'gestellte Rechnung aendert sich, wenn der Stundensatz nachtraeglich geaendert wird');
    } finally {
      config.projektSaetze = merk;
    }

    // Storno: Original bleibt bestehen, Korrektur bekommt eigene Nummer.
    const storno = rechnung.storniere(db, inv.nr);
    assert.strictEqual(rechnung.lade(db, inv.nr).status, 'storniert');
    assert.strictEqual(storno.status, 'storno');
    assert.strictEqual(storno.storno_von, inv.nr);
    assert.ok(storno.brutto_eur < 0, 'Storno hat keinen negativen Betrag');
    assert.notStrictEqual(storno.nr, inv.nr, 'Storno benutzt dieselbe Nummer');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM invoices').get().n, 2,
      'es wurde geloescht statt storniert');
    // Zweimal stornieren waere eine zweite Gutschrift fuer dieselbe Leistung.
    assert.throws(() => rechnung.storniere(db, inv.nr), /bereits/,
      'bereits stornierte Rechnung liess sich erneut stornieren');
  });
}

// --- E-Rechnung --------------------------------------------------------------
// Alle Werte eines Elements, in Dokumentreihenfolge.
function xmlWerte(xml, tag) {
  const re = new RegExp('<' + tag + '(?: [^>]*)?>([^<]*)</' + tag + '>', 'g');
  return [...xml.matchAll(re)].map((m) => m[1]);
}

// Wohlgeformtheit ohne Parser-Abhaengigkeit: jedes oeffnende Element muss in
// umgekehrter Reihenfolge wieder geschlossen werden, und im Text darf kein
// rohes "<" oder "&" stehen.
function xmlWohlgeformt(xml) {
  const rumpf = xml.replace(/^<\?xml[^?]*\?>\s*/, '');
  const stapel = [];
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/g;
  let pos = 0;
  let m;
  while ((m = re.exec(rumpf))) {
    if (m.index !== pos) return 'unlesbar bei Zeichen ' + pos;
    pos = re.lastIndex;
    if (m[5] !== undefined) {
      if (/&(?!(amp|lt|gt|quot|apos);)/.test(m[5])) return 'rohes & im Text: ' + m[5].slice(0, 30);
      continue;
    }
    if (m[4]) continue;
    if (!m[1]) { stapel.push(m[2]); continue; }
    const offen = stapel.pop();
    if (offen !== m[2]) return 'schliesst ' + m[2] + ', offen war ' + offen;
  }
  if (pos !== rumpf.length) return 'unlesbar bei Zeichen ' + pos;
  return stapel.length ? 'nicht geschlossen: ' + stapel.join(', ') : '';
}

// Die E-Rechnung ist das Rechnungsoriginal, das der Empfaenger maschinell
// verarbeitet. Ein falscher Betrag oder ein fehlendes Pflichtfeld fuehrt dort
// zur Zurueckweisung — oder zur Zahlung der falschen Summe.
function testERechnung() {
  rechnungsUmgebung((config) => {
    const rechnung = require('../rechnung');
    const erechnung = require('../erechnung');
    const kontakte = require('../kontakte');
    const db = rechnungsDb();
    const zeitraum = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'] };
    const kunde = {
      name: 'Kunde & Söhne GmbH', anschrift: ['Hauptstr. 1', '50667 Köln'],
      email: 'eingang@kunde.example', kaeufer_referenz: 'KST-4711', bestellnummer: 'PO-42',
    };
    const zahl = (xml, tag, i = 0) => Number(xmlWerte(xml, tag)[i]);

    // 1. Dem Aussteller fehlen E-Mail und Telefon: abgelehnt, mit Namen der
    //    fehlenden Angaben. Ein XML mit leerem Pflichtfeld waere schlimmer als
    //    keines — es sieht fertig aus und wird beim Empfaenger zurueckgewiesen.
    const unvollstaendig = rechnung.erstelle(db, { ...zeitraum, empfaenger: kunde });
    assert.deepStrictEqual(erechnung.pruefe(unvollstaendig), ['Aussteller: E-Mail', 'Aussteller: Telefon'],
      'fehlende Angaben falsch benannt: ' + erechnung.pruefe(unvollstaendig).join(', '));
    assert.throws(() => erechnung.alsXml(unvollstaendig), /Aussteller: E-Mail, Aussteller: Telefon/,
      'unvollstaendige Abschrift wurde exportiert');

    Object.assign(config.rechnung.aussteller, { email: 'rechnung@testfirma.example', telefon: '+49 221 123456' });

    // 2. Kleinunternehmer: steuerbefreit mit Begruendung, Summen aus der Abschrift.
    const klein = rechnung.erstelle(db, { ...zeitraum, empfaenger: kunde });
    assert.deepStrictEqual(erechnung.pruefe(klein), [], 'vollstaendige Abschrift gilt als lueckenhaft');
    let xml = erechnung.alsXml(klein);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML-Kopf fehlt');
    assert.strictEqual(xmlWohlgeformt(xml), '', 'XML nicht wohlgeformt');
    assert.ok(xml.includes('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'),
      'Kennung der Spezifikation fehlt');
    assert.ok(xml.includes('<ram:ID>' + klein.nr + '</ram:ID>'), 'Rechnungsnummer fehlt');
    assert.strictEqual(xmlWerte(xml, 'ram:TypeCode')[0], '380', 'Rechnungsart ist nicht 380');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:BuyerReference'), ['KST-4711']);
    assert.ok(xml.includes('<ram:Name>Kunde &amp; Söhne GmbH</ram:Name>'), 'Name des Empfaengers nicht maskiert');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:PostcodeCode'), ['50667', '50667'], 'Postleitzahlen nicht erkannt');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:CityName'), ['Koeln', 'Köln'], 'Orte nicht erkannt');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:CountryID'), ['DE', 'DE']);
    assert.ok(xml.includes('<ram:IBANID>DE00000000000000000000</ram:IBANID>'), 'IBAN fehlt oder traegt Leerzeichen');
    assert.ok(xml.includes('<ram:ID schemeID="FC">123/456/78910</ram:ID>'), 'Steuernummer fehlt');
    // Regel BR-CO-26 der EN 16931: ohne USt-IdNr. braucht der Aussteller eine
    // Kennung, an der ihn der Empfaenger maschinell erkennt. Aufgefallen erst
    // an den amtlichen Pruefregeln — Kleinunternehmer haben meist keine USt-IdNr.
    assert.ok(/<ram:SellerTradeParty>\s*<ram:ID>123\/456\/78910<\/ram:ID>/.test(xml),
      'Aussteller ohne USt-IdNr. traegt keine Kennung (BR-CO-26)');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:URIID'),
      ['rechnung@testfirma.example', 'rechnung@testfirma.example', 'eingang@kunde.example'],
      'elektronische Adressen stimmen nicht');
    assert.ok(/<ram:BuyerOrderReferencedDocument>\s*<ram:IssuerAssignedID>PO-42</.test(xml), 'Bestellnummer fehlt');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:CategoryCode'), ['E', 'E'], 'Kleinunternehmer ist nicht steuerbefreit');
    assert.ok(xmlWerte(xml, 'ram:ExemptionReason')[0].includes('§ 19 UStG'), 'Befreiungsgrund fehlt');
    assert.ok(xml.includes('unitCode="HUR"'), 'Stunden tragen nicht die Einheit HUR');

    // Summen: nichts wird neu gerechnet, alles stammt aus der Abschrift.
    assert.ok(klein.netto_eur > 0, 'Testaufbau: Rechnung ohne Betrag');
    assert.strictEqual(zahl(xml, 'ram:TaxBasisTotalAmount'), klein.netto_eur);
    assert.strictEqual(zahl(xml, 'ram:TaxTotalAmount'), 0);
    assert.strictEqual(zahl(xml, 'ram:GrandTotalAmount'), klein.brutto_eur);
    assert.strictEqual(zahl(xml, 'ram:DuePayableAmount'), klein.brutto_eur);
    const zeilenSummen = xmlWerte(xml, 'ram:LineTotalAmount').map(Number);
    // Letzter Wert ist die Kopfsumme, davor steht je Position einer.
    assert.strictEqual(zeilenSummen.pop(), klein.netto_eur, 'Summe der Positionen im Kopf weicht ab');
    assert.strictEqual(zeilenSummen.length, klein.positionen.length);
    assert.ok(Math.abs(zeilenSummen.reduce((a, b) => a + b, 0) - klein.netto_eur) < 0.005,
      'Positionen ergeben nicht den Nettobetrag');
    // Menge mal Preis muss die Position ergeben, sonst weist der Empfaenger ab.
    const menge = zahl(xml, 'ram:BilledQuantity');
    const preis = zahl(xml, 'ram:ChargeAmount');
    assert.strictEqual(preis, klein.positionen[0].satz, 'Preis ist nicht der vereinbarte Satz');
    assert.ok(Math.abs(Math.round(menge * preis * 100) / 100 - klein.positionen[0].betrag_eur) < 0.005,
      'Menge ' + menge + ' x Preis ' + preis + ' ergibt nicht ' + klein.positionen[0].betrag_eur);
    // Faelligkeit steht in der Abschrift und im XML, nicht nur in der Config.
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(klein.faellig_am), 'Faelligkeit fehlt in der Abschrift');
    assert.ok(xml.includes('<udt:DateTimeString format="102">' + klein.faellig_am.replace(/-/g, '') + '<'),
      'Faelligkeit fehlt im XML');
    config.rechnung.zahlungszielTage = 90;
    assert.strictEqual(erechnung.alsXml(klein), xml, 'ein geaendertes Zahlungsziel veraendert eine gestellte Rechnung');
    config.rechnung.zahlungszielTage = 14;

    // 3. Regelbesteuerung.
    config.rechnung.kleinunternehmer = false;
    const regel = rechnung.erstelle(db, { ...zeitraum, empfaenger: kunde });
    xml = erechnung.alsXml(regel);
    assert.strictEqual(xmlWohlgeformt(xml), '');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:CategoryCode'), ['S', 'S']);
    assert.deepStrictEqual(xmlWerte(xml, 'ram:RateApplicablePercent').map(Number), [19, 19]);
    assert.strictEqual(xmlWerte(xml, 'ram:ExemptionReason').length, 0, 'Befreiungsgrund trotz Regelbesteuerung');
    assert.ok(regel.ust_eur > 0, 'Testaufbau: keine Umsatzsteuer');
    assert.strictEqual(zahl(xml, 'ram:CalculatedAmount'), regel.ust_eur);
    assert.strictEqual(zahl(xml, 'ram:TaxTotalAmount'), regel.ust_eur);
    assert.strictEqual(zahl(xml, 'ram:GrandTotalAmount'), regel.brutto_eur);

    // 4. Storno: Rechnungsart 384 mit Verweis, Betraege negativ, Preis bleibt positiv.
    const storno = rechnung.storniere(db, regel.nr);
    xml = erechnung.alsXml(storno);
    assert.strictEqual(xmlWohlgeformt(xml), '');
    assert.strictEqual(xmlWerte(xml, 'ram:TypeCode')[0], '384', 'Storno ist nicht als 384 gekennzeichnet');
    assert.ok(new RegExp('<ram:InvoiceReferencedDocument>\\s*<ram:IssuerAssignedID>' + regel.nr + '<').test(xml),
      'Verweis auf die stornierte Rechnung fehlt');
    assert.strictEqual(zahl(xml, 'ram:GrandTotalAmount'), -regel.brutto_eur);
    assert.ok(zahl(xml, 'ram:BilledQuantity') < 0, 'Storno mit positiver Menge');
    assert.ok(zahl(xml, 'ram:ChargeAmount') > 0, 'Storno mit negativem Preis');

    // 5. Pauschalposition: Menge 1, Einheit Stueck, Bezeichnung maskiert.
    const pauschal = rechnung.ausPositionen(db, {
      positionen: [{ typ: 'pauschal', bezeichnung: 'Festpreis <Paket A>', stunden: null, satz: null, betrag_eur: 500 }],
      empfaenger: kunde, von: '2026-08-01', bis: '2026-08-31',
    });
    xml = erechnung.alsXml(pauschal);
    assert.strictEqual(xmlWohlgeformt(xml), '');
    assert.ok(xml.includes('<ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity>'), 'Pauschale ohne Menge 1 Stueck');
    assert.strictEqual(zahl(xml, 'ram:ChargeAmount'), 500);
    assert.ok(xml.includes('Festpreis &lt;Paket A&gt;'), 'Bezeichnung nicht maskiert');

    // 6. Ohne Kaeuferreferenz und ohne elektronische Adresse: abgelehnt.
    const karg = rechnung.erstelle(db, { ...zeitraum, empfaenger: { name: 'Kunde', anschrift: ['Weg 2', '10115 Berlin'] } });
    assert.deepStrictEqual(erechnung.pruefe(karg),
      ['Empfänger: Käuferreferenz', 'Empfänger: E-Mail oder Leitweg-ID']);
    const ohneOrt = rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, anschrift: ['irgendwo'] } });
    assert.deepStrictEqual(erechnung.pruefe(ohneOrt), ['Empfänger: Anschrift mit Postleitzahl und Ort in der letzten Zeile']);

    // 7. Behoerde: die Leitweg-ID ist Kaeuferreferenz und elektronische Adresse.
    const amt = rechnung.erstelle(db, {
      ...zeitraum,
      empfaenger: { name: 'Bundesamt', anschrift: ['Amtsweg 1', '53113 Bonn'], kaeufer_referenz: '04011000-12345-03' },
    });
    xml = erechnung.alsXml(amt);
    assert.ok(xml.includes('<ram:URIID schemeID="0204">04011000-12345-03</ram:URIID>'),
      'Leitweg-ID steht nicht als elektronische Adresse');

    // 8. Die Abschrift nimmt nur bekannte Felder an.
    const fremd = rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, boese: '<script>', anschrift: ['A 1', '50667 Köln'] } });
    assert.strictEqual(fremd.empfaenger.boese, undefined, 'fremdes Feld ging in die Abschrift');

    // 8a. Angaben in falscher Form werden abgelehnt, nicht zurechtgeschnitten.
    //     Aus "Niederlande" wuerde sonst still "NI" — Nicaragua, unwiderruflich
    //     in einer gestellten Rechnung.
    const vorher = db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;
    assert.throws(() => rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, land: 'Niederlande' } }),
      /Land/, 'ausgeschriebener Laendername wurde angenommen');
    assert.throws(() => rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, email: 'keine-adresse' } }),
      /E-Mail/, 'E-Mail ohne @ wurde angenommen');
    assert.throws(() => rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, kaeufer_referenz: 'x'.repeat(81) } }),
      /Käuferreferenz/, 'ueberlange Kaeuferreferenz wurde abgeschnitten statt abgelehnt');
    // Der Leistungszeitraum geht als Datum in die E-Rechnung.
    assert.throws(() => rechnung.erstelle(db, { ...zeitraum, from: '1', to: '3', empfaenger: kunde }),
      /Leistungszeitraum/, 'Zeitraum ohne Datumsform wurde angenommen');
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, vorher,
      'eine abgelehnte Anfrage hat eine Rechnungsnummer verbraucht');
    assert.strictEqual(rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, land: 'nl' } }).empfaenger.land, 'NL');
    // Eine Angabe, die kein Text ist, wird abgelehnt statt still durch den
    // Kontaktwert ersetzt; ein Datum muss es im Kalender geben.
    assert.throws(() => rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, email: 123 } }),
      /E-Mail/, 'Zahl als E-Mail wurde still uebergangen');
    assert.throws(() => rechnung.erstelle(db, { ...zeitraum, to: '2026-13-45', empfaenger: kunde }),
      /Leistungszeitraum/, 'Datum, das es nicht gibt, wurde angenommen');
    // Ein Kontakt aus der Zeit vor der Formpruefung traegt das Land als Wort.
    // Fiele es still weg, stuende "DE" in der Rechnung — bei einer
    // fuenfstelligen Postleitzahl (Frankreich, Italien, Spanien) merkt das
    // niemand mehr. Deshalb: ablehnen und den Kontakt als Quelle nennen.
    const altKontakt = kontakte.speichere(db, {
      firma: 'Client SARL', anschrift: ['Rue 1', '75001 Paris'], email: 'a@client.example', kaeuferReferenz: 'R-FR',
    });
    const anAlt = { ...zeitraum, kontaktId: altKontakt.id, empfaenger: { name: 'Client SARL', anschrift: ['Rue 1', '75001 Paris'] } };
    db.prepare('UPDATE kontakte SET land = ? WHERE id = ?').run('Frankreich', altKontakt.id);
    assert.throws(() => rechnung.erstelle(db, anAlt), /Land im Kontakt/,
      'ungueltiges Land im Kontakt wurde still zu DE');
    // Eine andere unbrauchbare Altangabe blockiert dagegen nichts: sie fehlt
    // dann in der Abschrift, und die E-Rechnung meldet sie.
    db.prepare('UPDATE kontakte SET land = ?, email = ? WHERE id = ?').run('FR', 'ohne-at', altKontakt.id);
    const ohneMail = rechnung.erstelle(db, anAlt);
    assert.strictEqual(ohneMail.empfaenger.land, 'FR');
    assert.strictEqual(ohneMail.empfaenger.email, undefined, 'unbrauchbare E-Mail aus dem Kontakt ging in die Abschrift');
    assert.ok(erechnung.pruefe(ohneMail).includes('Empfänger: E-Mail oder Leitweg-ID'));
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, vorher + 2,
      'abgelehnte Anfragen haben Rechnungsnummern verbraucht');

    // 8b. Zeichen, die XML 1.0 nicht kennt, duerfen die Datei nicht zerstoeren.
    const schmutz = rechnung.erstelle(db, { ...zeitraum, empfaenger: { ...kunde, bestellnummer: 'PO\uFFFF-\uD800x' } });
    xml = erechnung.alsXml(schmutz);
    assert.ok(!/[\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(xml), 'ungueltiges XML-Zeichen in der Datei');
    assert.ok(xml.includes('<ram:IssuerAssignedID>PO-x</ram:IssuerAssignedID>'), 'bereinigte Bestellnummer fehlt');

    // 8c. Mengen stehen immer als Dezimalzahl in der Datei, nie in
    //     Exponentialschreibweise (das ist kein gueltiger XML-Dezimalwert).
    const winzig = erechnung.mengeUndPreis({ stunden: 1, satz: 500000, betrag_eur: 0.05 });
    assert.ok(/^-?\d+(\.\d+)?$/.test(winzig.menge), 'Menge "' + winzig.menge + '" ist keine Dezimalzahl');
    assert.strictEqual(erechnung.mengeUndPreis({ stunden: 2, satz: 85, betrag_eur: 170 }).menge, '2');
    assert.strictEqual(erechnung.mengeUndPreis({ stunden: 2, satz: 85, betrag_eur: -170 }).menge, '-2');
    assert.strictEqual(erechnung.mengeUndPreis({ stunden: 0, satz: 85, betrag_eur: 0 }).menge, '0');

    // 8d. Alte Abschrift mit unbrauchbarem Zeitraum oder Steuersatz: abgelehnt.
    assert.ok(erechnung.pruefe({ ...klein, leistung_von: '1' }).includes('Leistungszeitraum als Datum'),
      'unbrauchbarer Leistungszeitraum faellt bei der Pruefung nicht auf');
    assert.ok(erechnung.pruefe({ ...regel, ust_prozent: Infinity }).length > 0,
      'unendlicher Steuersatz faellt bei der Pruefung nicht auf');
    // Summen, die nicht aufgehen, duerfen nicht als Datei hinausgehen.
    assert.ok(erechnung.pruefe({ ...regel, brutto_eur: regel.brutto_eur + 1 }).includes('Summen der Rechnung'),
      'Brutto ungleich Netto plus Steuer faellt nicht auf');
    assert.ok(erechnung.pruefe({ ...regel, netto_eur: regel.netto_eur + 1, brutto_eur: regel.brutto_eur + 1 })
      .includes('Summen der Rechnung'), 'Netto ungleich Summe der Positionen faellt nicht auf');
    // Deutsche Postleitzahl hat fuenf Ziffern; "D-50667" ginge so in die Datei.
    const mitD = { ...klein, empfaenger: { ...klein.empfaenger, anschrift: ['Weg 1', 'D-50667 Köln'] } };
    assert.ok(erechnung.pruefe(mitD).some((f) => f.startsWith('Empfänger: Anschrift')),
      'Postleitzahl mit Laenderkennung wird als gueltig angenommen');
    assert.ok(erechnung.pruefe({ ...klein, empfaenger: { ...klein.empfaenger, ust_id_nr: '123456789' } })
      .includes('Empfänger: USt-IdNr. mit Länderkürzel'), 'USt-IdNr. des Empfaengers ohne Laenderkuerzel faellt nicht auf');

    // 8e. Eine abgelehnte Stammdaten-Eingabe darf nichts veraendern — auch nicht
    //     die Felder, die vor dem fehlerhaften Feld geprueft wurden. Sie stuenden
    //     sonst im Speicher und gingen in die naechste Rechnung.
    const { setzeStammdaten } = require('../server');
    const bankVorher = config.rechnung.aussteller.bank;
    assert.throws(() => setzeStammdaten({ bank: 'Halb gespeichert', land: 'Deutschland' }), /Land/);
    assert.strictEqual(config.rechnung.aussteller.bank, bankVorher,
      'abgelehnte Eingabe hat ein anderes Feld bereits veraendert');

    // 9. Angaben fuer die E-Rechnung kommen aus dem Kontakt, wenn die Anfrage
    //    sie nicht mitbringt. Aendert sich der Kontakt spaeter, bleibt die
    //    Abschrift stehen.
    const k = kontakte.speichere(db, {
      firma: 'Stammkunde AG', anschrift: ['Allee 5', '80331 München'], email: 'ap@stammkunde.example',
      kaeuferReferenz: 'REF-9', lieferantennummer: 'L-123', land: 'at',
    });
    assert.strictEqual(k.land, 'AT', 'Landeskuerzel wird nicht vereinheitlicht');
    assert.throws(() => kontakte.speichere(db, { firma: 'X', land: 'Deutschland' }), /Land/,
      'ungueltiges Landeskuerzel angenommen');
    const ausKontakt = rechnung.erstelle(db, {
      ...zeitraum, kontaktId: k.id,
      empfaenger: { name: 'Stammkunde AG', anschrift: ['Allee 5', '80331 München'] },
    });
    assert.strictEqual(ausKontakt.empfaenger.email, 'ap@stammkunde.example');
    assert.strictEqual(ausKontakt.empfaenger.kaeufer_referenz, 'REF-9');
    xml = erechnung.alsXml(ausKontakt);
    assert.ok(/<ram:SellerTradeParty>\s*<ram:ID>L-123<\/ram:ID>/.test(xml), 'Lieferantennummer fehlt');
    assert.deepStrictEqual(xmlWerte(xml, 'ram:CountryID'), ['DE', 'AT']);
    kontakte.speichere(db, { id: k.id, email: 'neu@stammkunde.example' });
    assert.strictEqual(erechnung.alsXml(rechnung.lade(db, ausKontakt.nr)), xml,
      'geaenderter Kontakt veraendert eine gestellte Rechnung');
    db.close();
  });
}

// Die Auslieferung als Datei. Erzeugt wird die Antwort in einer eigenen
// Funktion, damit sie sich gegen eine Testdatenbank pruefen laesst — der
// laufende Server haengt an der echten, und dort legt kein Test Rechnungen an.
async function testERechnungRoute() {
  const srv = require('../server');
  const rechnung = require('../rechnung');
  rechnungsUmgebung((config) => {
    Object.assign(config.rechnung.aussteller, { email: 'rechnung@testfirma.example', telefon: '+49 221 123456' });
    const db = rechnungsDb();
    const basis = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'] };
    const gut = rechnung.erstelle(db, {
      ...basis,
      empfaenger: { name: 'Kunde', anschrift: ['Weg 2', '10115 Berlin'], email: 'a@kunde.example', kaeufer_referenz: 'R-1' },
    });
    const karg = rechnung.erstelle(db, { ...basis, empfaenger: { name: 'Kunde' } });

    const ok = srv.eRechnungAntwort(db, gut.nr);
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.kopf['content-type'], 'application/xml; charset=utf-8');
    assert.strictEqual(ok.kopf['content-disposition'], 'attachment; filename="Rechnung-' + gut.nr + '.xml"');
    assert.ok(ok.inhalt.startsWith('<?xml'), 'Inhalt ist kein XML');

    const abgelehnt = srv.eRechnungAntwort(db, karg.nr);
    assert.strictEqual(abgelehnt.status, 422, 'unvollstaendige Rechnung wird ausgeliefert');
    assert.ok(/Käuferreferenz/.test(JSON.parse(abgelehnt.inhalt).error), 'Ablehnung nennt die fehlende Angabe nicht');

    assert.strictEqual(srv.eRechnungAntwort(db, '1234-5678').status, 404, 'unbekannte Nummer liefert nicht 404');
    for (const boese of ['../../config', 'abcd-efgh', '99999-9999', gut.nr + '/../x']) {
      assert.strictEqual(srv.eRechnungAntwort(db, boese).status, 404, '"' + boese + '" wurde bedient');
    }
    db.close();
  });

  // Ueber echtes HTTP: die Route existiert und weist fremde Pfade ab. Eine
  // Nummer in gueltiger Form, die es nicht gibt, beantwortet die Route selbst
  // (als JSON) — fehlte sie, kaeme die Absage der Dateiauslieferung als Text.
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const port = srv.server.address().port;
  try {
    for (const pfad of ['9999-9998', '9999-9998.xml']) {
      const r = await fetch(`http://127.0.0.1:${port}/rechnung-xml/${pfad}`);
      assert.strictEqual(r.status, 404, 'Pfad "' + pfad + '" liefert ' + r.status + ' statt 404');
      assert.ok((r.headers.get('content-type') || '').includes('application/json'),
        'Route fehlt: "' + pfad + '" fiel bis zur Dateiauslieferung durch');
    }
    for (const pfad of ['..%2f..%2fconfig.json', 'abcd-efgh']) {
      const r = await fetch(`http://127.0.0.1:${port}/rechnung-xml/${pfad}`);
      assert.strictEqual(r.status, 404, 'Pfad "' + pfad + '" liefert ' + r.status + ' statt 404');
    }
  } finally {
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

function testRechnungSteuerUndEscaping() {
  rechnungsUmgebung((config) => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };

    // Kleinunternehmer: keine Steuer, dafuer der Hinweis im Dokument.
    const klein = rechnung.erstelle(db, daten);
    assert.strictEqual(klein.ust_eur, 0, 'Kleinunternehmer weist Umsatzsteuer aus');
    assert.strictEqual(klein.brutto_eur, klein.netto_eur, 'Brutto weicht vom Netto ab');
    assert.ok(rechnung.renderHtml(klein).includes('§ 19 UStG'), 'Par.-19-Hinweis fehlt');

    // Regelbesteuerung: 19 % kommen oben drauf.
    config.rechnung.kleinunternehmer = false;
    const regel = rechnung.erstelle(db, daten);
    assert.ok(Math.abs(regel.ust_eur - Math.round(regel.netto_eur * 19) / 100) < 0.011,
      'Umsatzsteuer falsch gerechnet: ' + regel.ust_eur);
    assert.ok(Math.abs(regel.brutto_eur - (regel.netto_eur + regel.ust_eur)) < 1e-9,
      'Brutto ist nicht Netto plus Steuer');

    // Positionssumme muss die ausgewiesene Nettosumme ergeben, sonst weicht
    // die Rechnung von ihren eigenen Zeilen ab.
    const summe = regel.positionen.reduce((s, p) => s + p.betrag_eur, 0);
    assert.ok(Math.abs(summe - regel.netto_eur) < 1e-9,
      'Positionen summieren sich nicht auf den Nettobetrag');

    // Empfaengername ist Nutzereingabe und landet im HTML.
    const boes = rechnung.erstelle(db, { ...daten, empfaenger: { name: '<script>alert(1)</script>' } });
    const html = rechnung.renderHtml(boes);
    assert.ok(!html.includes('<script>alert(1)</script>'), 'Empfaengername wurde nicht escapt');
    assert.ok(html.includes('&lt;script&gt;'), 'Escaping fehlt im Dokument');

    // Werkzeuge duerfen auf der Rechnung nicht aufgeschluesselt werden.
    // Geprueft wird die Aufschluesselung, nicht das Wort: "Werkzeug" darf in
    // erlaeuterndem Text vorkommen (etwa im Hinweis zu KI-Werkzeugen), nur
    // eben nicht als Posten oder Name eines Hintergrunddienstes.
    assert.ok(!/claude-mem/i.test(html), 'Werkzeugname steht auf der Rechnung');
    assert.ok(!/Werkzeugbetrieb|Werkzeug-Anteil|Werkzeugkosten/i.test(html),
      'Werkzeug-Aufschluesselung steht auf der Rechnung');

    // Ersatzzeichen aus kaputt uebertragenen Umlauten duerfen nicht auf die Rechnung.
    assert.throws(() => rechnung.erstelle(db, { ...daten, empfaenger: { name: 'Werftstra�e GmbH' } }),
      /Kodierung/, 'Ersatzzeichen im Rechnungsempfaenger angenommen');
    // Nicht-String-Name darf keinen rohen TypeError werfen, sondern eine Fachmeldung.
    assert.throws(() => rechnung.erstelle(db, { ...daten, empfaenger: { name: 12345 } }),
      /Text/, 'Zahl als Empfaengername ergab keine Fachmeldung');
    // Pflichtangaben nach Par. 14 UStG.
    for (const pflicht of [boes.nr, 'Testfirma', '50667 Koeln', '123/456/78910', 'Leistungszeitraum']) {
      assert.ok(html.includes(rechnung.esc(pflicht)), 'Pflichtangabe fehlt: ' + pflicht);
    }
  });
}

// Der Abrechnungsstand steuert im Dashboard die Anzeige "abgerechnet ja/nein"
// und speist den Rechnungsbetrag in die Marge. Faellt hier die Storno-Behandlung
// aus, weist die Oberflaeche stornierte Arbeit weiter als bezahlt aus.
function testAbrechnungsStatus() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };

    // Bewusst ueber die Schluesselzahl statt deepStrictEqual gegen {}: die
    // Ablage hat absichtlich keinen Prototyp, damit ein Vorgang "__proto__"
    // ein normaler Schluessel bleibt.
    assert.strictEqual(Object.keys(rechnung.abrechnung(db)).length, 0,
      'ohne gestellte Rechnung darf kein Vorgang als abgerechnet gelten');

    const a = rechnung.erstelle(db, daten);
    const nach1 = rechnung.abrechnung(db)['PROJ-500'];
    assert.ok(nach1, 'abgerechneter Vorgang fehlt');
    assert.ok(Math.abs(nach1.betrag_eur - a.positionen[0].betrag_eur) < 1e-9,
      'Betrag weicht von der Rechnungsposition ab: ' + nach1.betrag_eur);
    assert.deepStrictEqual(nach1.nummern, [a.nr], 'Rechnungsnummer fehlt oder ist doppelt');

    // Zweite Rechnung ueber denselben Vorgang: Betraege summieren sich.
    const b = rechnung.erstelle(db, daten);
    const nach2 = rechnung.abrechnung(db)['PROJ-500'];
    assert.strictEqual(nach2.nummern.length, 2, 'zweite Rechnung nicht erfasst');
    assert.ok(Math.abs(nach2.betrag_eur - (a.positionen[0].betrag_eur + b.positionen[0].betrag_eur)) < 1e-9,
      'Betraege zweier Rechnungen summieren sich nicht: ' + nach2.betrag_eur);
    // Gerundet auf Cent, sonst stehen Fliesskomma-Reste in der Oberflaeche.
    assert.strictEqual(nach2.betrag_eur, Math.round(nach2.betrag_eur * 100) / 100,
      'Summe ist nicht auf Cent gerundet: ' + nach2.betrag_eur);

    // Storno: Original und Gegenrechnung fallen beide heraus.
    const storno = rechnung.storniere(db, a.nr);
    const nach3 = rechnung.abrechnung(db)['PROJ-500'];
    assert.deepStrictEqual(nach3.nummern, [b.nr],
      'stornierte Rechnung oder Storno-Beleg steht weiter im Abrechnungsstand');
    assert.ok(!nach3.nummern.includes(storno.nr), 'Storno-Beleg wird mitgezaehlt');
    assert.ok(Math.abs(nach3.betrag_eur - b.positionen[0].betrag_eur) < 1e-9,
      'Betrag nach Storno falsch: ' + nach3.betrag_eur);

    // Alles storniert: Vorgang gilt wieder als nicht abgerechnet.
    rechnung.storniere(db, b.nr);
    assert.strictEqual(rechnung.abrechnung(db)['PROJ-500'], undefined,
      'vollstaendig stornierter Vorgang gilt weiter als abgerechnet');

    // Ein unbekannter Schluessel muss leer bleiben — auch "__proto__", das bei
    // einer Ablage mit Prototyp das Prototyp-Objekt statt undefined liefert.
    for (const fremd of ['PROJ-999', '__proto__', 'constructor']) {
      assert.strictEqual(rechnung.abrechnung(db)[fremd], undefined,
        'unbekannter Schluessel liefert einen Wert: ' + fremd);
    }
  });
}

// Die Einstellungen sind ueber die Oberflaeche aenderbar. Ohne Grenzen wuerde
// ein Tippfehler (8500 statt 85) jede Auswertung unbrauchbar machen, und das
// faellt erst Wochen spaeter auf. Der Test schreibt in die echte config.json,
// deshalb wird sie vorher gesichert und danach zurueckgelegt.
function testEinstellungenGrenzen() {
  const pfad = path.join(__dirname, '..', 'config.json');
  const sicherung = fs.readFileSync(pfad, 'utf8');
  const config = require('../config.json');
  const merk = JSON.parse(JSON.stringify(config));

  try {
    const { setzeEinstellungen } = require('../server');

    // Gueltige Werte kommen an und landen in der Datei.
    const geaendert = setzeEinstellungen({ stundensatz: 95, zielmargeProzent: 40 });
    assert.strictEqual(geaendert.stundensatz, 95, 'Stundensatz nicht uebernommen');
    assert.strictEqual(config.stundensatz, 95, 'Modul-Cache nicht aktualisiert');
    const geschrieben = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    assert.strictEqual(geschrieben.stundensatz, 95, 'Wert steht nicht in der Datei');
    assert.strictEqual(geschrieben.zielmargeProzent, 40, 'Zielmarge steht nicht in der Datei');

    // Andere Einstellungen duerfen dabei nicht verloren gehen.
    assert.ok(geschrieben.jira, 'Jira-Block beim Schreiben verloren');
    assert.ok(geschrieben.rechnung, 'Rechnungs-Stammdaten beim Schreiben verloren');

    // Ausreisser muessen abprallen — das ist der eigentliche Zweck.
    for (const [feld, wert] of [
      ['stundensatz', 99999],        // Tippfehler nach oben
      ['stundensatz', -5],           // negativ
      ['stundensatz', 'abc'],        // keine Zahl
      ['zielmargeProzent', 150],     // ueber 100 %
      ['usdToEur', 0],               // Division/Nullkurs
      ['gapMinutes', 0],             // Aktivzeit waere immer 0
    ]) {
      assert.throws(() => setzeEinstellungen({ [feld]: wert }),
        'unzulaessiger Wert wurde angenommen: ' + feld + '=' + wert);
    }

    // Unbekannte Felder werden ignoriert, nicht durchgereicht. Verglichen wird
    // gegen den Stand davor, nicht gegen einen festen Wert: sonst behauptet der
    // Test bei einer Installation, die Jira ohnehin ausgeschaltet hat, einen
    // Fehler, den es nicht gibt.
    const vorher = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    assert.throws(() => setzeEinstellungen({ jira: { enabled: !vorher.jira.enabled } }),
      'unbekanntes Feld wurde angenommen');
    const nachher = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    assert.strictEqual(nachher.jira.enabled, vorher.jira.enabled,
      'fremdes Feld wurde doch geschrieben');

    // Leere Angaben lassen den bestehenden Wert stehen.
    setzeEinstellungen({ stundensatz: 88, zielmargeProzent: '' });
    assert.strictEqual(config.zielmargeProzent, 40, 'leerer Wert hat den Bestand ueberschrieben');
  } finally {
    fs.writeFileSync(pfad, sicherung, 'utf8');
    for (const k of Object.keys(merk)) config[k] = merk[k];
  }
}

// Der Verlauf laesst sich zwischen Tag, Monat und Jahr umschalten. Alle drei
// muessen dieselbe Summe ergeben — eine groebere Koernung fasst nur zusammen.
// Waere das nicht so, zeigte die Monatsansicht stillschweigend andere Zahlen
// als die Tagesansicht, und niemand haette einen Anlass nachzurechnen.
function testZeitreihenKoernung() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  // Ueber zwei Jahre und drei Monate verteilt, damit alle Ebenen greifen.
  const tage = ['2025-12-30', '2025-12-31', '2026-01-05', '2026-01-06', '2026-02-01'];
  tage.forEach((tag, i) => {
    ins.run('r' + i, tag + 'T10:00:00Z', 's1', 'P', 'claude-opus-5',
      100, 50, 0, 0, 0, 0, (i + 1) * 1.5, 0, tag);
  });

  const tage_ = metrics.byDay(db, {});
  const monate = metrics.byMonth(db, {});
  const jahre = metrics.byYear(db, {});

  assert.strictEqual(tage_.length, 5, 'Tagesreihe unerwartet: ' + tage_.length);
  assert.strictEqual(monate.length, 3, 'Monatsreihe unerwartet: ' + monate.length);
  assert.strictEqual(jahre.length, 2, 'Jahresreihe unerwartet: ' + jahre.length);

  const summe = (reihe) => Math.round(reihe.reduce((a, b) => a + b.cost_usd, 0) * 100) / 100;
  assert.strictEqual(summe(monate), summe(tage_), 'Monatssumme weicht von der Tagessumme ab');
  assert.strictEqual(summe(jahre), summe(tage_), 'Jahressumme weicht von der Tagessumme ab');
  assert.strictEqual(summe(tage_), 22.5, 'Gesamtsumme falsch: ' + summe(tage_));

  // Die Beschriftung muss die Koernung tragen, sonst laesst sich eine
  // Monatszeile nicht von einer Tageszeile unterscheiden.
  assert.strictEqual(monate[0].day, '2025-12', 'Monatsschluessel falsch: ' + monate[0].day);
  assert.strictEqual(jahre[0].day, '2025', 'Jahresschluessel falsch: ' + jahre[0].day);
  // Auch die Tokenzahlen muessen mitwandern, nicht nur die Kosten.
  assert.strictEqual(monate.reduce((a, b) => a + b.total_tokens, 0),
    tage_.reduce((a, b) => a + b.total_tokens, 0), 'Tokensumme weicht ab');
  db.close();
}

// Ein Klick auf ein Modell schraenkt die Projekttabelle ein. Dabei darf die
// Aktivzeit NICHT mitgefiltert werden: sie ist eine Zeitspanne zwischen zwei
// Ereignissen, keine Eigenschaft eines Requests. Wuerde sie mitschrumpfen,
// stuende in der Modellansicht ein anteiliger Arbeitswert, der so nie
// abgerechnet wird — ein Geldfehler, den niemand bemerkt.
function testModellFilterLaesstZeitUnberuehrt() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insAkt = db.prepare(
    'INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)'
  );
  const tag = '2026-08-18';
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  // Eine Sitzung, zwei Modelle, vier Minuten durchgehende Arbeit.
  [['a', 0, 'claude-opus-5', 3.0], ['b', 2, 'claude-haiku-4-5', 1.0],
   ['c', 4, 'claude-opus-5', 2.0]].forEach(([id, min, modell, kosten]) => {
    ins.run(id, t(min), 's1', 'P', modell, 100, 50, 0, 0, 0, 0, kosten, 0, tag);
    insAkt.run('s1', t(min), 'P', 'main', null, tag);
  });

  const alle = metrics.byProject(db, {})[0];
  const nurOpus = metrics.byProject(db, { model: 'claude-opus-5' })[0];

  assert.strictEqual(alle.cost_usd, 6.0, 'Gesamtkosten falsch: ' + alle.cost_usd);
  assert.strictEqual(nurOpus.cost_usd, 5.0, 'Modellfilter greift nicht auf die Kosten');
  assert.strictEqual(nurOpus.active_seconds, alle.active_seconds,
    'Aktivzeit wurde mitgefiltert (' + nurOpus.active_seconds + ' statt ' + alle.active_seconds + ')');
  assert.strictEqual(nurOpus.arbeitswert, alle.arbeitswert,
    'Arbeitswert wurde mitgefiltert — er folgt der Zeit, nicht dem Modell');

  // Dieselbe Regel gilt fuer die Gesamtuebersicht und die Vorgangsliste:
  // beide bekommen den Filter durchgereicht und duerfen nicht abstuerzen.
  assert.strictEqual(metrics.summary(db, { model: 'claude-opus-5' }).cost_usd, 5.0,
    'summary rechnet den Modellfilter nicht mit');
  assert.strictEqual(metrics.summary(db, { model: 'claude-opus-5' }).active_seconds,
    metrics.summary(db, {}).active_seconds, 'summary filtert die Aktivzeit mit');
  assert.doesNotThrow(() => metrics.byTicket(db, { model: 'claude-opus-5' }),
    'byTicket bricht mit Modellfilter ab');
  db.close();
}

// Die Kachel "Aktive Stunden" im Ueberblick zeigt die Projektarbeit, nicht die
// Gesamtzeit: letztere enthaelt auch die Hintergrundsitzungen der Werkzeuge.
// Der Fehler faellt sonst nur auf, wenn jemand die Tabelle darunter zusammen-
// rechnet — dort stand 64 h, in der Kachel 120 h. Geprueft wird die Zutat, aus
// der die Kachel gebaut wird (split.arbeit), inklusive der Trennschaerfe.
function testAktivstundenOhneWerkzeuge() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insAkt = db.prepare(
    'INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)'
  );
  const tag = '2026-08-18';
  const t = (min) => new Date(Date.UTC(2026, 7, 18, 10, min, 0)).toISOString();
  // Kundenprojekt: 4 Minuten. Werkzeug: 6 Minuten, laeuft parallel.
  const schreibe = (session, projekt, minuten) => {
    minuten.forEach((min, i) => {
      ins.run(session + '-' + i, t(min), session, projekt, 'claude-opus-5',
        100, 50, 0, 0, 0, 0, 1.0, 0, tag);
      insAkt.run(session, t(min), projekt, 'main', null, tag);
    });
  };
  schreibe('s1', 'Kundenprojekt', [0, 2, 4]);
  schreibe('s2', '.claude-mem', [0, 2, 4, 6]);

  const gesamt = metrics.summary(db, {}).active_seconds;
  const split = metrics.splitOverhead(db, {});

  assert.strictEqual(split.arbeit.active_seconds, 4 * 60,
    'Projektarbeit-Zeit falsch: ' + split.arbeit.active_seconds + 's statt 240s');
  // Das Werkzeug laeuft sechs Minuten, vier davon neben der Arbeit. Dort
  // bekommt die Arbeit die Zeit ganz; dem Werkzeug bleiben die zwei Minuten,
  // in denen sonst nichts lief. Frueher standen hier 360s — dieselben vier
  // Minuten zaehlten zweimal.
  assert.strictEqual(split.overhead.active_seconds, 2 * 60,
    'Werkzeug-Zeit falsch: ' + split.overhead.active_seconds + 's statt 120s');
  // Das ist der Kern: die Gesamtzeit ist groesser als die abrechenbare. Wer
  // sie in die Kachel schreibt, weist Werkzeugbetrieb als Arbeitszeit aus.
  assert.strictEqual(gesamt, 6 * 60, 'Gesamtzeit falsch: ' + gesamt + 's statt 360s (sechs Minuten auf der Uhr)');
  assert.ok(split.arbeit.active_seconds < gesamt,
    'Projektarbeit und Gesamtzeit sind gleich — die Trennung greift nicht');
  assert.strictEqual(split.arbeit.active_seconds + split.overhead.active_seconds, gesamt,
    'Projektarbeit plus Werkzeugbetrieb ergibt nicht die Gesamtzeit');

  // Der Arbeitswert darf ebenfalls keinen Werkzeugbetrieb enthalten.
  assert.ok(split.overhead.arbeitswert > 0, 'Testaufbau: Werkzeug ohne Arbeitswert');
  assert.ok(split.arbeit.arbeitswert < split.arbeit.arbeitswert + split.overhead.arbeitswert,
    'Arbeitswert trennt Werkzeugbetrieb nicht ab');
  db.close();
}

// Der Vergleichsaufwand ist eine Schaetzung, die beim Kunden landet. Zwei
// Dinge muss der Test festhalten: dass sie ohne hinterlegten Faktor LEER
// bleibt (statt 0 oder den Istwert auszugeben), und dass sie keinen einzigen
// Abrechnungswert veraendert. Ausserdem darf hier bewusst KEIN Eurobetrag
// entstehen — ein hypothetischer Preis neben einem echten ist der Punkt, an
// dem aus einer Information eine angreifbare Werbeaussage wird.
function testVergleichsaufwand() {
  const config = require('../config.json');
  const merk = config.vergleichsFaktor;
  const zeile = {
    ticket: 'PROJ-1', active_hours: 10, arbeitswert: 850,
    api_gegenwert_usd: 20, abo_anteil_usd: 5,
  };

  try {
    // Ohne Faktor: alle drei Felder leer, keine Ersatzwerte.
    config.vergleichsFaktor = 0;
    const ohne = metrics.mehrwert(zeile);
    assert.strictEqual(ohne.vergleich_faktor, null, 'Faktor nicht leer ohne Konfiguration');
    assert.strictEqual(ohne.vergleich_stunden, null, 'Vergleichsstunden nicht leer');
    assert.strictEqual(ohne.vergleich_mehrstunden, null, 'Mehrstunden nicht leer');

    // Mit Faktor: 10 h * 1,2 = 12 h, davon 2 h Mehraufwand.
    config.vergleichsFaktor = 1.2;
    const mit = metrics.mehrwert(zeile);
    assert.strictEqual(mit.vergleich_stunden, 12, 'Vergleichsstunden falsch: ' + mit.vergleich_stunden);
    assert.ok(Math.abs(mit.vergleich_mehrstunden - 2) < 1e-9,
      'Mehrstunden falsch: ' + mit.vergleich_mehrstunden);

    // Plausibilitaetsgrenzen — dieselbe Lehre wie bei der Marge: der Test
    // sichert nicht nur die Formel, sondern auch die Groessenordnung.
    assert.ok(mit.vergleich_stunden > zeile.active_hours,
      'Vergleich liegt nicht ueber der erfassten Zeit');
    assert.ok(mit.vergleich_stunden <= zeile.active_hours * 1.5,
      'Vergleich ueber der vertretbaren Obergrenze (Faktor 1,5)');

    // Kein Eurofeld: was nicht existiert, kann nicht gerendert werden.
    const felder = Object.keys(mit).filter((k) => k.startsWith('vergleich_'));
    assert.deepStrictEqual(felder.sort(),
      ['vergleich_faktor', 'vergleich_mehrstunden', 'vergleich_stunden'],
      'unerwartetes Vergleichsfeld (Eurobetrag?): ' + felder.join(', '));

    // Und der eigentliche Punkt: die Abrechnung bleibt unberuehrt.
    for (const feld of ['arbeitswert', 'erloes', 'deckungsbeitrag', 'marge',
                        'marge_prozent', 'eigene_kosten', 'gegenwert', 'rechnungsbetrag']) {
      assert.deepStrictEqual(mit[feld], ohne[feld],
        'Vergleichsfaktor veraendert den Abrechnungswert ' + feld);
    }

    // Ohne erfasste Zeit gibt es nichts zu vergleichen.
    const leer = metrics.mehrwert({ ...zeile, active_hours: 0, arbeitswert: 0 });
    assert.strictEqual(leer.vergleich_stunden, null, 'Vergleich ohne Arbeitszeit nicht leer');
  } finally {
    config.vergleichsFaktor = merk;
  }
}

// Der Vergleich auf der Rechnung ist der heikelste Teil: dort wird aus einer
// internen Kennzahl eine Aussage gegenueber dem Kunden. Drei Dinge muessen
// stimmen — kein Eurobetrag, ein einordnender Hinweis, und der Wert muss in
// der Abschrift stehen, damit eine spaetere Faktoraenderung ein gestelltes
// Dokument nicht rueckwirkend veraendert.
function testVergleichAufRechnung() {
  rechnungsUmgebung((config) => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const merk = config.vergleichsFaktor;
    try {
      config.vergleichsFaktor = 1.2;
      const inv = rechnung.erstelle(db, {
        from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'],
        empfaenger: { name: 'Testkunde' },
      });
      const pos = inv.positionen[0];
      assert.ok(pos.vergleich_stunden > pos.stunden,
        'Vergleichsstunden nicht in der Abschrift: ' + pos.vergleich_stunden);
      assert.ok(Math.abs(pos.vergleich_stunden - pos.stunden * 1.2) < 0.02,
        'Vergleichsstunden falsch gerechnet');

      const html = rechnung.renderHtml(inv);
      assert.ok(/klassische Entwicklung gesch/.test(html), 'Vergleich fehlt im Dokument');
      assert.ok(/rechnerische Sch/.test(html), 'einordnender Hinweis fehlt');

      // Der entscheidende Punkt: kein Eurobetrag in der Vergleichsangabe.
      const stelle = html.match(/klassische Entwicklung gesch[^<]*/);
      assert.ok(stelle, 'Vergleichstext nicht gefunden');
      assert.ok(!/EUR|&euro;|€/.test(stelle[0]),
        'Vergleich enthaelt einen Betrag: ' + stelle[0]);

      // Unveraenderlichkeit: Faktor aendern darf das gestellte Dokument nicht
      // beruehren — die Druckansicht liest nur die Abschrift.
      config.vergleichsFaktor = 1.5;
      const nachher = rechnung.renderHtml(rechnung.lade(db, inv.nr));
      assert.strictEqual(nachher, html, 'Faktoraenderung veraendert eine gestellte Rechnung');

      // Ohne Faktor: weder Angabe noch Hinweis, und kein leerer Rest.
      config.vergleichsFaktor = 0;
      const ohne = rechnung.erstelle(db, {
        from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'],
        empfaenger: { name: 'Testkunde' },
      });
      assert.strictEqual(ohne.positionen[0].vergleich_stunden, null,
        'Vergleichswert trotz abgeschaltetem Faktor');
      const htmlOhne = rechnung.renderHtml(ohne);
      assert.ok(!/klassische Entwicklung/.test(htmlOhne), 'Vergleich erscheint ohne Faktor');
      assert.ok(!/rechnerische Sch/.test(htmlOhne), 'Hinweis erscheint ohne Vergleich');
    } finally {
      config.vergleichsFaktor = merk;
      db.close();
    }
  });
}

// Angebote laufen neben den Rechnungen her. Der gefaehrlichste Fehler waere,
// beide aus demselben Nummernkreis zu bedienen: ein nie angenommenes Angebot
// hinterliesse dann eine Luecke in der fortlaufenden Rechnungsnummer, und das
// faellt erst beim Pruefer auf. Ausserdem muss ein zugesagter Preis stehen
// bleiben, auch wenn sich Saetze aendern.
function testAngebote() {
  rechnungsUmgebung((config) => {
    const angebot = require('../angebot');
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const merk = config.vergleichsFaktor;
    const empf = { name: 'Kunde GmbH', anschrift: ['Weg 1', '40210 D'] };

    try {
      config.vergleichsFaktor = 1.2;

      // Freie Posten: Satz faellt auf den Standard zurueck, wenn keiner kommt.
      const ang = angebot.erstelle(db, {
        posten: [
          { bezeichnung: 'Konzept', stunden: 10, satz: 95 },
          { bezeichnung: 'Einweisung', stunden: 2 },
        ],
        empfaenger: empf, gueltigTage: 30,
      });
      assert.ok(/^AN-\d{4}-0001$/.test(ang.nr), 'Angebotsnummer unerwartet: ' + ang.nr);
      assert.strictEqual(ang.positionen.length, 2, 'Positionen fehlen');
      assert.strictEqual(ang.positionen[1].satz, config.stundensatz,
        'Standardsatz greift nicht bei fehlender Angabe');
      assert.strictEqual(ang.netto_eur, 10 * 95 + 2 * config.stundensatz, 'Summe falsch');
      assert.strictEqual(ang.positionen[0].vergleich_stunden, 12,
        'Vergleichszeit im Angebot falsch');

      // Der Nummernkreis muss getrennt sein — das ist der Kern.
      const vorher = rechnung.liste(db).length;
      angebot.erstelle(db, { posten: [{ bezeichnung: 'Zweites', stunden: 1 }], empfaenger: empf });
      assert.strictEqual(rechnung.liste(db).length, vorher,
        'Ein Angebot hat eine Rechnung erzeugt');
      const inv = rechnung.erstelle(db, {
        from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: empf,
      });
      assert.ok(/^\d{4}-0001$/.test(inv.nr),
        'Angebote haben den Rechnungs-Nummernkreis verschoben: ' + inv.nr);

      // Ungueltige Eingaben prallen ab: das Dokument geht nach aussen.
      for (const p of [
        { bezeichnung: '', stunden: 5 },
        { bezeichnung: 'X', stunden: 0 },
        { bezeichnung: 'X', stunden: -3 },
        { bezeichnung: 'X', stunden: 99999 },
        { bezeichnung: 'X', stunden: 5, satz: -1 },
        { bezeichnung: 'x'.repeat(300), stunden: 5 },
        // Kein String: wuerde sonst als "[object Object]" auf dem Dokument
        // landen bzw. ein Array stillschweigend zusammengefuegt.
        { bezeichnung: {}, stunden: 5 },
        { bezeichnung: ['a', 'b'], stunden: 5 },
        { bezeichnung: 'X', stunden: 'viel' },
      ]) {
        assert.throws(() => angebot.erstelle(db, { posten: [p], empfaenger: empf }),
          'unzulaessige Position angenommen: ' + JSON.stringify(p));
      }
      // Die Abschrift darf nicht ins Uferlose wachsen.
      assert.throws(() => angebot.erstelle(db, {
        posten: Array.from({ length: 200 }, (_, i) => ({ bezeichnung: 'P' + i, stunden: 1 })),
        empfaenger: empf,
      }), /100 Positionen/, 'unbegrenzt viele Positionen angenommen');

      // Der Empfaenger kommt aus dem Anfragekoerper und geht in die Abschrift:
      // nur bekannte Felder, und die begrenzt.
      const geprueft = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }],
        empfaenger: {
          name: 'K'.repeat(400), anschrift: Array.from({ length: 20 }, () => 'Zeile'),
          heimlich: 'sollte verschwinden',
        },
      });
      assert.strictEqual(geprueft.empfaenger.name.length, 200, 'Empfaengername nicht begrenzt');
      assert.ok(geprueft.empfaenger.anschrift.length <= 6, 'Anschrift nicht begrenzt');
      assert.strictEqual(geprueft.empfaenger.heimlich, undefined,
        'unbekanntes Empfaengerfeld wurde uebernommen');
      assert.throws(() => angebot.erstelle(db, { posten: [], empfaenger: empf }),
        'leeres Angebot angenommen');
      assert.throws(() => angebot.erstelle(db, { posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: {} }),
        'Angebot ohne Empfaengernamen angenommen');

      // Ersatzzeichen aus kaputt uebertragenen Umlauten duerfen nicht aufs Dokument.
      assert.throws(() => angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }],
        empfaenger: { name: 'Werftstra�e GmbH', anschrift: ['Kiel'] },
      }), /Kodierung/, 'Ersatzzeichen im Empfaengernamen angenommen');
      assert.throws(() => angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }],
        empfaenger: { name: 'X', anschrift: ['Werftstra�e 12'] },
      }), /Kodierung/, 'Ersatzzeichen in der Empfaenger-Anschrift angenommen');

      // Uebernahme in eine Rechnung: Angebot bleibt, Rechnung entsteht.
      const uebernahme = angebot.inRechnung(db, ang.nr);
      assert.strictEqual(uebernahme.angebot.status, 'angenommen', 'Status nicht gesetzt');
      assert.strictEqual(uebernahme.angebot.rechnung_nr, uebernahme.rechnung.nr,
        'Rechnungsnummer nicht am Angebot vermerkt');
      assert.deepStrictEqual(uebernahme.angebot.positionen, ang.positionen,
        'Uebernahme hat das Angebot veraendert');
      assert.strictEqual(uebernahme.rechnung.netto_eur, ang.netto_eur,
        'Rechnungsbetrag weicht vom Angebot ab');
      assert.throws(() => angebot.inRechnung(db, ang.nr), /bereits Rechnung/,
        'zweite Uebernahme wurde erlaubt');
      assert.throws(() => angebot.loesche(db, ang.nr), /Rechnung/,
        'Angebot mit Rechnung liess sich loeschen');

      // Loeschen ist erlaubt, solange keine Rechnung daran haengt — der
      // Unterschied zur Rechnung, die nur storniert werden darf.
      const weg = angebot.erstelle(db, { posten: [{ bezeichnung: 'Weg', stunden: 1 }], empfaenger: empf });
      angebot.loesche(db, weg.nr);
      assert.strictEqual(angebot.lade(db, weg.nr), null, 'Angebot wurde nicht geloescht');

      // Dokument: freibleibend, Vergleich nur als Zeit.
      const html = angebot.renderHtml(uebernahme.angebot);
      assert.ok(/Freibleibendes Angebot/.test(html), 'Freibleiblichkeit fehlt');
      assert.ok(/klassische Entwicklung gesch/.test(html), 'Vergleich fehlt im Angebot');
      const stelle = html.match(/(kalkuliert|erfasst)[^<]*klassische Entwicklung gesch[^<]*/);
      assert.ok(stelle, 'Vergleichstext im Angebot nicht gefunden');
      assert.ok(!/EUR|&euro;|€/.test(stelle[0]), 'Vergleich enthaelt einen Betrag: ' + stelle[0]);
      // Im Angebot ist nichts erfasst, sondern kalkuliert — sonst behauptet
      // ein Angebot gemessene Zeiten, die es noch gar nicht geben kann.
      assert.ok(/kalkuliert/.test(stelle[0]),
        'Angebot spricht von erfasster statt kalkulierter Zeit: ' + stelle[0]);
      // Und keine leere Trennung, wenn der Zeitraum fehlt (freie Posten).
      assert.ok(!/class="klein">\s*&middot;/.test(html),
        'Unterzeile beginnt mit einem Trennzeichen');

      // Steuerlogik identisch zur Rechnung — eine Formel, ein Ort.
      config.rechnung.kleinunternehmer = false;
      const mitUst = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'Mit Steuer', stunden: 10, satz: 100 }], empfaenger: empf,
      });
      assert.strictEqual(mitUst.ust_eur, 190, 'Umsatzsteuer im Angebot falsch: ' + mitUst.ust_eur);
      assert.strictEqual(mitUst.brutto_eur, 1190, 'Bruttobetrag im Angebot falsch');
    } finally {
      config.vergleichsFaktor = merk;
      db.close();
    }
  });
}

// --- Kontakte ----------------------------------------------------------------
// Die Angaben gehen ueber den Angebots-Empfaenger nach aussen. Was hier
// ungeprueft hereinkommt, steht spaeter auf einem Dokument beim Kunden.
function testKontakte() {
  const kontakte = require('../kontakte');
  const db = dbmod.open(':memory:');
  openDbs.push(db);

  // Anlegen: Pflichtfeld Firma, alles andere optional.
  const k = kontakte.speichere(db, {
    firma: 'Muster GmbH', vorname: 'Erika', nachname: 'Muster',
    anschrift: ['Musterweg 1', '40210 Duesseldorf'], email: 'kontakt@muster.de',
  });
  assert.ok(k.id > 0, 'Kontakt bekam keine id');
  assert.strictEqual(k.status, 'lead', 'Neuer Kontakt ist nicht als Lead angelegt');
  assert.deepStrictEqual(k.anschrift, ['Musterweg 1', '40210 Duesseldorf'],
    'Anschrift nicht als Liste gespeichert');

  // Teileingabe darf die uebrigen Angaben nicht leeren.
  const geaendert = kontakte.speichere(db, { id: k.id, notiz: 'Ruft zurueck' });
  assert.strictEqual(geaendert.notiz, 'Ruft zurueck', 'Notiz nicht gespeichert');
  assert.strictEqual(geaendert.firma, 'Muster GmbH', 'Teileingabe hat die Firma geleert');
  assert.deepStrictEqual(geaendert.anschrift, k.anschrift, 'Teileingabe hat die Anschrift geleert');

  // Nur bekannte Felder: der Anfragekoerper darf nicht in die Datenbank durchgereicht werden.
  const gefiltert = kontakte.speichere(db, { firma: 'Zweite AG', heimlich: 'weg damit' });
  assert.strictEqual(gefiltert.heimlich, undefined, 'unbekanntes Feld wurde uebernommen');

  // Grenzen halten.
  assert.throws(() => kontakte.speichere(db, {}), /Firma/, 'Kontakt ohne Firma angenommen');
  assert.throws(() => kontakte.speichere(db, { firma: '   ' }), /Firma/,
    'Kontakt mit leerer Firma angenommen');
  assert.throws(() => kontakte.speichere(db, { firma: 'F'.repeat(400) }), /200/,
    'ueberlange Firma angenommen');
  assert.throws(() => kontakte.speichere(db, { firma: {} }), /Text/,
    'Objekt als Firma angenommen');
  assert.throws(() => kontakte.speichere(db, { firma: 'X', status: 'interessent' }),
    /lead oder kunde/, 'unbekannter Status angenommen');
  assert.throws(() => kontakte.speichere(db, { firma: 'X', email: 'keine-adresse' }),
    /E-Mail/, 'Adresse ohne @ angenommen');
  assert.throws(() => kontakte.speichere(db, {
    firma: 'X', anschrift: Array.from({ length: 20 }, () => 'Zeile'),
  }), /6 Zeilen/, 'unbegrenzte Anschrift angenommen');
  assert.throws(() => kontakte.speichere(db, { firma: 'X', anschrift: ['z'.repeat(300)] }),
    /120 Zeichen/, 'ueberlange Anschriftzeile angenommen');
  assert.throws(() => kontakte.speichere(db, { id: 9999, notiz: 'x' }), /Unbekannter Kontakt/,
    'Aenderung an nicht vorhandenem Kontakt angenommen');

  // Ersatzzeichen (U+FFFD) entsteht bei kaputt uebertragenen Umlauten (z.B.
  // PowerShell Invoke-RestMethod) und darf nicht unbemerkt aufs Dokument.
  assert.throws(() => kontakte.speichere(db, { firma: 'Werftstra�e GmbH' }),
    /Kodierung/, 'Ersatzzeichen in der Firma angenommen');
  assert.throws(() => kontakte.speichere(db, {
    firma: 'X', anschrift: ['Werftstra�e 12'],
  }), /Kodierung/, 'Ersatzzeichen in der Anschrift angenommen');

  // Umwandlung Lead -> Kunde, wiederholbar und ohne Wirkung auf Kunden.
  assert.strictEqual(kontakte.macheKunde(db, k.id), true, 'Lead wurde nicht zum Kunden');
  assert.strictEqual(kontakte.lade(db, k.id).status, 'kunde', 'Status nicht gesetzt');
  assert.strictEqual(kontakte.macheKunde(db, k.id), false, 'Zweiter Aufruf hat erneut geaendert');
  assert.strictEqual(kontakte.macheKunde(db, 9999), false,
    'Umwandlung eines unbekannten Kontakts meldete Erfolg');
  assert.doesNotThrow(() => kontakte.macheKunde(db, null),
    'Umwandlung ohne Kontakt hat geworfen');

  // Beim Erstellen eines Dokuments dagegen hart: ein Tippfehler soll auffallen.
  assert.strictEqual(kontakte.pruefeId(db, undefined), null, 'fehlende id nicht toleriert');
  assert.strictEqual(kontakte.pruefeId(db, k.id), k.id, 'gueltige id nicht durchgelassen');
  assert.throws(() => kontakte.pruefeId(db, 9999), /Unbekannter Kontakt/,
    'unbekannte Kontakt-id beim Erstellen angenommen');

  // Loeschen.
  kontakte.loesche(db, gefiltert.id);
  assert.strictEqual(kontakte.lade(db, gefiltert.id), null, 'Kontakt wurde nicht geloescht');
  assert.throws(() => kontakte.loesche(db, gefiltert.id), /Unbekannter Kontakt/,
    'zweites Loeschen meldete Erfolg');
}

// --- Kunde und Projekt -------------------------------------------------------
// Ueber diese Kante wird Arbeit abrechenbar: der Vorgang traegt ein Projekt,
// das Projekt einen Kunden. Eine falsche Zuordnung setzt Vorgaenge auf die
// Rechnung des falschen Empfaengers.

// Legt Events mit Projekten und Tickets an, damit die Existenzpruefung in
// setzeProjekte() etwas vorfindet und byTicket() Zeilen liefert.
function projektDb(zeilen) {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  zeilen.forEach(([projekt, ticket], i) => {
    ins.run('r' + i, new Date(Date.UTC(2026, 7, 18, 10, i, 0)).toISOString(),
      's-' + i, projekt, ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, 1, 0, '2026-08-18');
  });
  return db;
}

// Satz UND Projekt einer Vorgangszeile muessen aus derselben Wahl stammen.
// Liefen sie auseinander, bekaeme eine Zeile ihren Preis vom einen und ihren
// Kunden vom anderen Projekt — und niemand saehe es der Rechnung an.
function testTicketProjekt() {
  const config = require('../config.json');
  const merk = config.projektSaetze;
  const db = projektDb([
    ['Viel', 'PROJ-900'], ['Viel', 'PROJ-900'], ['Viel', 'PROJ-900'],
    ['Wenig', 'PROJ-900'],
  ]);
  try {
    config.projektSaetze = { Viel: { satz: 111 }, Wenig: { satz: 222 } };
    const zeile = metrics.byTicket(db).find((t) => t.ticket === 'PROJ-900');
    assert.ok(zeile, 'Vorgangszeile fehlt');
    assert.strictEqual(zeile.project, 'Viel',
      'Vorgang traegt nicht das mehrheitlich beteiligte Projekt');
    assert.strictEqual(zeile.stundensatz, 111,
      'Stundensatz stammt aus einem anderen Projekt als die Kundenzuordnung');
  } finally {
    config.projektSaetze = merk;
  }

  // Arbeit ohne Vorgangsnummer traegt ihr Projekt schon laenger — der
  // Kundenfilter haengt an beiden Sichten gleichermassen.
  const ohne = metrics.ohneTicket(projektDb([['Soloprojekt', null]]))
    .find((t) => t.gruppe === 'Soloprojekt');
  assert.ok(ohne, 'Zeile ohne Vorgangsnummer fehlt');
  assert.strictEqual(ohne.project, 'Soloprojekt', 'Projekt fehlt bei Arbeit ohne Vorgangsnummer');
}

// Ein Projekt gehoert genau einem Kunden. Ein zweiter darf es weder daneben
// noch stillschweigend statt seiner bekommen: im ersten Fall erschiene der
// Vorgang doppelt abrechenbar, im zweiten fiele er aus der Rechnung des
// bisherigen Kunden heraus, ohne dass es jemandem auffaellt.
function testProjektKontakt() {
  const kontakte = require('../kontakte');
  const db = projektDb([['P1', null], ['P2', null], ['P3', null]]);

  const k1 = kontakte.speichere(db, { firma: 'Alpha GmbH' });
  const k2 = kontakte.speichere(db, { firma: 'Beta AG' });

  kontakte.setzeProjekte(db, k1.id, ['P1', 'P2']);
  assert.deepStrictEqual(kontakte.projekteVon(db, k1.id), ['P1', 'P2'],
    'Zuordnung nicht gespeichert');

  // Ein vergebenes Projekt darf sich kein zweiter Kunde nehmen: sonst fielen
  // Alphas Vorgaenge stillschweigend aus Alphas Rechnung.
  assert.throws(() => kontakte.setzeProjekte(db, k2.id, ['P2']),
    /gehoert bereits/, 'Projekt liess sich einem zweiten Kunden zuweisen');
  assert.deepStrictEqual(kontakte.projekteVon(db, k1.id), ['P1', 'P2'],
    'abgewiesener Zugriff hat die bestehende Zuordnung veraendert');
  assert.deepStrictEqual(kontakte.projekteVon(db, k2.id), [],
    'abgewiesener Zugriff hat trotzdem geschrieben');

  // Umhaengen geht ueber den bisherigen Kunden — erst dort weg, dann frei.
  kontakte.setzeProjekte(db, k1.id, ['P1']);
  kontakte.setzeProjekte(db, k2.id, ['P2']);
  assert.deepStrictEqual(kontakte.kontaktJeProjekt(db), {
    P1: { id: k1.id, firma: 'Alpha GmbH' },
    P2: { id: k2.id, firma: 'Beta AG' },
  }, 'Gesamtzuordnung stimmt nicht');

  // Die eigenen Projekte erneut zu setzen ist kein Fremdbesitz.
  assert.doesNotThrow(() => kontakte.setzeProjekte(db, k2.id, ['P2']),
    'eigenes Projekt wurde als fremd abgewiesen');

  // Leeren muss wirken, sonst laesst sich eine Fehlzuordnung nie zuruecknehmen.
  kontakte.setzeProjekte(db, k1.id, []);
  assert.deepStrictEqual(kontakte.projekteVon(db, k1.id), [], 'Leeren wirkte nicht');

  // Doppelte Namen kommen aus einer Mehrfachauswahl und sind kein Fehler.
  kontakte.setzeProjekte(db, k1.id, ['P3', 'P3']);
  assert.deepStrictEqual(kontakte.projekteVon(db, k1.id), ['P3'], 'Doppelte nicht zusammengefasst');
}

// Die Grenzen sitzen im Modul, nicht im Formular: wer den Endpunkt direkt
// aufruft, kommt an ihnen nicht vorbei.
function testProjektKontaktGrenzen() {
  const kontakte = require('../kontakte');
  const db = projektDb([['P1', null]]);
  const k = kontakte.speichere(db, { firma: 'Gamma KG' });

  assert.throws(() => kontakte.setzeProjekte(db, k.id, ['Gibt-Es-Nicht']),
    /Unbekanntes Projekt/, 'erfundener Projektname wurde angenommen');
  assert.throws(() => kontakte.setzeProjekte(db, k.id, 'P1'),
    /Liste/, 'Zeichenkette statt Liste angenommen');
  assert.throws(() => kontakte.setzeProjekte(db, k.id, [{}]),
    /Text/, 'Objekt als Projektname angenommen');
  assert.throws(() => kontakte.setzeProjekte(db, k.id, ['P'.repeat(300)]),
    /200/, 'ueberlanger Projektname angenommen');
  assert.throws(() => kontakte.setzeProjekte(db, k.id, ['Werftstra�e']),
    /Kodierung/, 'Ersatzzeichen im Projektnamen angenommen');
  assert.throws(() => kontakte.setzeProjekte(db, k.id, new Array(300).fill('P1')),
    /200/, 'zu viele Eintraege angenommen');
  assert.throws(() => kontakte.setzeProjekte(db, 9999, ['P1']),
    /Unbekannter Kontakt/, 'unbekannter Kontakt angenommen');

  // Werkzeugbetrieb und lokale Modelle sind keinem Kunden zurechenbar: ihre
  // Kosten liegen ueber die Zeitzuordnung bereits anteilig auf den echten
  // Vorgaengen und stuenden zugeordnet ein zweites Mal auf einer Rechnung.
  db.prepare("INSERT INTO events (request_id,ts,session_id,project,model,input_tokens,output_tokens,cache_w_5m,cache_w_1h,cache_read,web_search,cost_usd,is_sidechain,day) VALUES ('rl','2026-08-18T10:00:00Z','sl','(lokal)','m',1,1,0,0,0,0,0,0,'2026-08-18')").run();
  assert.throws(() => kontakte.setzeProjekte(db, k.id, ['(lokal)']),
    /Hintergrund/, 'lokales Pseudo-Projekt liess sich einem Kunden zuweisen');

  // Nach lauter abgewiesenen Versuchen darf nichts geschrieben sein.
  assert.deepStrictEqual(kontakte.projekteVon(db, k.id), [],
    'abgewiesener Aufruf hat trotzdem geschrieben');
}

// Eine Zuordnung ist lebendes Stammdatum und geht mit dem Kontakt. Eine
// gestellte Rechnung ist das Gegenteil — sie bleibt unveraendert stehen.
function testProjektKontaktLoeschen() {
  const kontakte = require('../kontakte');
  const rechnung = require('../rechnung');
  rechnungsUmgebung(() => {
    const db = rechnungsDb();
    db.prepare("INSERT INTO events (request_id, ts, session_id, project, model, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day) VALUES ('rx','2026-08-18T10:00:00Z','s-x','Beispiel - App','claude-opus-5',1,1,0,0,0,0,1,0,'2026-08-18')").run();

    const k = kontakte.speichere(db, { firma: 'Delta GmbH' });
    kontakte.setzeProjekte(db, k.id, ['Beispiel - App']);

    const inv = rechnung.erstelle(db, {
      from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'],
      empfaenger: { name: 'Delta GmbH', anschrift: ['Weg 1'] }, kontaktId: k.id,
    });
    const vorher = JSON.stringify(rechnung.lade(db, inv.nr));

    kontakte.loesche(db, k.id);

    assert.deepStrictEqual(kontakte.kontaktJeProjekt(db), {},
      'Zuordnung ueberlebt den geloeschten Kontakt und bietet einen Kunden an, den es nicht gibt');
    assert.strictEqual(JSON.stringify(rechnung.lade(db, inv.nr)), vorher,
      'gestellte Rechnung wurde beim Loeschen des Kontakts veraendert');
  });
}

// Dieselbe Zusicherung wie bei den uebrigen Angaben: wer nur eine Notiz
// aendert, verliert seine Projekte nicht.
function testProjekteTeileingabe() {
  const kontakte = require('../kontakte');
  const db = projektDb([['P1', null]]);

  const k = kontakte.speichere(db, { firma: 'Epsilon GmbH', projekte: ['P1'] });
  assert.deepStrictEqual(k.projekte, ['P1'], 'Projekte beim Anlegen nicht uebernommen');
  assert.deepStrictEqual(kontakte.liste(db)[0].projekte, ['P1'], 'Projekte fehlen in der Liste');

  const nur = kontakte.speichere(db, { id: k.id, notiz: 'Ruft zurueck' });
  assert.deepStrictEqual(nur.projekte, ['P1'], 'Teileingabe hat die Projekte geleert');

  // Nur Projekte aendern ist eine gueltige Aenderung, auch ohne weiteres Feld.
  const geleert = kontakte.speichere(db, { id: k.id, projekte: [] });
  assert.deepStrictEqual(geleert.projekte, [], 'Aenderung nur der Projekte wirkte nicht');
  assert.strictEqual(geleert.notiz, 'Ruft zurueck', 'Notiz ging beim Projektwechsel verloren');
}

// --- Herkunft der Requests ---------------------------------------------------
// Reine Selbstauskunft, keine Abrechnungsgroesse. Trotzdem geprueft: eine
// falsche Summe hier fuehrt zu falschen Schluessen darueber, was Geld kostet.
function testHerkunft() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const ins = db.prepare(`
    INSERT INTO events (request_id, ts, session_id, project, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
      web_search, cost_usd, is_sidechain, day, source, mcp_server, mcp_tool, skill)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const t = '2026-08-18T10:00:00Z', tag = '2026-08-18';
  const zeile = (id, tok, server, werkzeug, skill) =>
    ins.run(id, t, 's', 'P', 'm', tok, 0, 0, 0, 0, 0, 1, 0, tag, 'claude', server, werkzeug, skill);

  // Bewusst kein Gleichstand zwischen den Servern: sonst haengt die
  // erwartete Reihenfolge am Zufall und der Test wird mal gruen, mal rot.
  zeile('a', 100, 'context-mode', 'ctx_execute', null);
  zeile('b', 250, 'context-mode', 'ctx_search', null);
  zeile('c', 300, 'chrome-devtools', 'click', null);
  zeile('d', 400, null, null, 'superpowers:brainstorming');
  zeile('e', 500, null, null, null);          // ohne Herkunft
  zeile('f', 700, null, null, null);
  db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model,
    input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search,
    cost_usd, is_sidechain, day, source) VALUES ('g',?,'sl','(lokal)','ollama/x',
    900,0,0,0,0,0,0,0,?,'lokal')`).run(t, tag);

  const h = metrics.herkunft(db);

  // Die Bezugsgroesse zaehlt nur Claude-Requests: ein lokales Modell kennt
  // weder MCP noch Skills, es wuerde den Anteil kuenstlich kleinrechnen.
  assert.strictEqual(h.gesamt.total_tokens, 2250,
    'Bezugsgroesse falsch — lokale Modelle gehoeren nicht hinein');

  assert.strictEqual(h.mcp_tokens, 650, 'MCP-Summe falsch');
  assert.strictEqual(h.skill_tokens, 400, 'Skill-Summe falsch');

  // Server absteigend, Werkzeuge darunter ebenfalls.
  assert.deepStrictEqual(h.nach_mcp.map((s) => s.server), ['context-mode', 'chrome-devtools'],
    'Server nicht nach Verbrauch sortiert');
  const cm = h.nach_mcp[0];
  assert.strictEqual(cm.total_tokens, 350, 'Serversumme stimmt nicht mit den Werkzeugen ueberein');
  assert.strictEqual(cm.requests, 2, 'Requests je Server falsch gezaehlt');
  assert.deepStrictEqual(cm.werkzeuge.map((w) => w.werkzeug), ['ctx_search', 'ctx_execute'],
    'Werkzeuge nicht nach Verbrauch sortiert');
  assert.strictEqual(cm.werkzeuge.reduce((s, w) => s + w.total_tokens, 0), cm.total_tokens,
    'Werkzeugsummen ergeben nicht die Serversumme');

  assert.deepStrictEqual(h.nach_skill.map((s) => s.skill), ['superpowers:brainstorming'],
    'Skill-Liste falsch');

  // Requests ohne Herkunft tauchen in keiner der beiden Listen auf — sie sind
  // die Differenz zur Bezugsgroesse, nicht eine eigene Zeile.
  assert.ok(h.mcp_tokens + h.skill_tokens < h.gesamt.total_tokens,
    'Herkunftssummen duerfen die Bezugsgroesse nicht ausschoepfen');

  // Zeitfilter greift auch hier.
  const leer = metrics.herkunft(db, { from: '2026-09-01', to: '2026-09-30' });
  assert.strictEqual(leer.mcp_tokens, 0, 'Zeitfilter wirkt nicht auf die Herkunft');
  assert.strictEqual(leer.gesamt.total_tokens, 0, 'Zeitfilter wirkt nicht auf die Bezugsgroesse');
}

// --- Positionsvorlagen -------------------------------------------------------
// Eine Vorlage fuellt eine Angebotszeile vor. Ein hier durchgerutschter
// Unsinn steht damit in jedem Angebot, das die Vorlage benutzt.
function testVorlagen() {
  const server = require('../server');
  const db = dbmod.open(':memory:');
  openDbs.push(db);

  const v = server.setzeVorlage(db, { bezeichnung: 'Debugging', satz: 95 });
  assert.ok(v.id > 0, 'Vorlage bekam keine id');
  assert.strictEqual(v.satz, 95, 'Satz nicht uebernommen');

  // Ohne Satzangabe greift spaeter der Standardsatz. Das muss NULL bleiben:
  // eine 0 wuerde stillschweigend Nullzeilen ins Angebot schreiben.
  const ohne = server.setzeVorlage(db, { bezeichnung: 'Konzept' });
  assert.strictEqual(ohne.satz, null, 'fehlender Satz wurde zu einem Wert');
  const leer = server.setzeVorlage(db, { bezeichnung: 'Abstimmung', satz: '' });
  assert.strictEqual(leer.satz, null, 'leerer Satz wurde zu 0');

  const geaendert = server.setzeVorlage(db, { id: v.id, bezeichnung: 'Fehlersuche', satz: 100 });
  assert.strictEqual(geaendert.bezeichnung, 'Fehlersuche', 'Bezeichnung nicht geaendert');
  assert.strictEqual(server.vorlagenListe(db).length, 3, 'Aenderung hat eine Vorlage angelegt');

  for (const d of [
    { bezeichnung: '' },
    { bezeichnung: '   ' },
    { bezeichnung: {} },
    { bezeichnung: 'x'.repeat(300) },
    { bezeichnung: 'X', satz: -1 },
    { bezeichnung: 'X', satz: 99999 },
    { bezeichnung: 'X', satz: 'viel' },
    { id: 9999, bezeichnung: 'X' },
  ]) {
    assert.throws(() => server.setzeVorlage(db, d),
      'unzulaessige Vorlage angenommen: ' + JSON.stringify(d));
  }

  server.loescheVorlage(db, v.id);
  assert.strictEqual(server.vorlagenListe(db).length, 2, 'Vorlage wurde nicht geloescht');
  assert.throws(() => server.loescheVorlage(db, v.id), /Unbekannte Vorlage/,
    'zweites Loeschen meldete Erfolg');
}

// --- Umwandlung Lead zu Kunde ------------------------------------------------
// Der Verweis vom Dokument auf den Kontakt ist die einzige Verbindung. Bricht
// sie, bleibt ein zahlender Kunde in der Lead-Liste stehen — und wird weiter
// als offene Gelegenheit gezaehlt.
function testKontaktKonversion() {
  rechnungsUmgebung(() => {
    const angebot = require('../angebot');
    const kontakte = require('../kontakte');
    const db = rechnungsDb();
    const empf = { name: 'Muster GmbH', anschrift: ['Weg 1'] };

    try {
      // Annahme macht aus dem Lead einen Kunden.
      const lead = kontakte.speichere(db, { firma: 'Muster GmbH' });
      const a = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf, kontaktId: lead.id,
      });
      assert.strictEqual(a.kontakt_id, lead.id, 'Verweis nicht am Angebot gespeichert');
      angebot.setzeStatus(db, a.nr, 'angenommen');
      assert.strictEqual(kontakte.lade(db, lead.id).status, 'kunde',
        'Annahme hat den Lead nicht zum Kunden gemacht');

      // Ablehnung dagegen nicht.
      const lead2 = kontakte.speichere(db, { firma: 'Zweite AG' });
      const b = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf, kontaktId: lead2.id,
      });
      angebot.setzeStatus(db, b.nr, 'abgelehnt');
      assert.strictEqual(kontakte.lade(db, lead2.id).status, 'lead',
        'Ablehnung hat den Lead zum Kunden gemacht');

      // Auch die Uebernahme in eine Rechnung wandelt um.
      const lead3 = kontakte.speichere(db, { firma: 'Dritte KG' });
      const c = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf, kontaktId: lead3.id,
      });
      const uebernahme = angebot.inRechnung(db, c.nr);
      assert.strictEqual(kontakte.lade(db, lead3.id).status, 'kunde',
        'Rechnungsuebernahme hat den Lead nicht umgewandelt');
      assert.strictEqual(uebernahme.rechnung.kontakt_id, lead3.id,
        'Verweis nicht an die Rechnung uebergegangen');

      // Ein geloeschter Kontakt darf die Annahme nicht scheitern lassen: das
      // Dokument traegt seine eigene Abschrift und bleibt gueltig.
      const weg = kontakte.speichere(db, { firma: 'Verschwunden GmbH' });
      const d = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf, kontaktId: weg.id,
      });
      kontakte.loesche(db, weg.id);
      assert.doesNotThrow(() => angebot.setzeStatus(db, d.nr, 'angenommen'),
        'Annahme scheiterte an einem geloeschten Kontakt');
      assert.strictEqual(angebot.lade(db, d.nr).empfaenger.name, 'Muster GmbH',
        'Abschrift des Angebots haengt am Kontakt');

      // Ohne Verweis bleibt alles wie bisher.
      const ohne = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf,
      });
      assert.strictEqual(ohne.kontakt_id, null, 'Angebot ohne Kontakt traegt einen Verweis');
      assert.doesNotThrow(() => angebot.setzeStatus(db, ohne.nr, 'angenommen'),
        'Annahme ohne Kontakt scheiterte');

      // Ein Tippfehler in der id soll dagegen sofort auffallen.
      assert.throws(() => angebot.erstelle(db, {
        posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf, kontaktId: 9999,
      }), /Unbekannter Kontakt/, 'Angebot mit unbekanntem Kontakt angenommen');
    } finally {
      db.close();
    }
  });
}

// --- Pauschalpositionen ------------------------------------------------------
// Eine Pauschalposition hat keine Stunden. Die Druckansicht rechnete bisher
// fest mit einer Stundenzahl — ohne Absicherung stirbt sie mit TypeError, und
// mit ihr die PDF-Erzeugung, die dieselbe Ansicht abholt.
function testPauschalPositionen() {
  rechnungsUmgebung((config) => {
    const angebot = require('../angebot');
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const merk = config.vergleichsFaktor;
    const empf = { name: 'Kunde GmbH', anschrift: ['Weg 1', '40210 D'] };

    try {
      config.vergleichsFaktor = 1.2;

      // Gemischtes Angebot: Stundenposition und Festpreis nebeneinander.
      const gemischt = angebot.erstelle(db, {
        posten: [
          { bezeichnung: 'Umsetzung', stunden: 10, satz: 100 },
          { bezeichnung: 'Konzeptpaket', typ: 'pauschal', betrag_eur: 1500 },
        ],
        empfaenger: empf,
      });
      assert.strictEqual(gemischt.netto_eur, 1000 + 1500,
        'Summe mit Pauschalposition falsch: ' + gemischt.netto_eur);
      const pos = gemischt.positionen[1];
      assert.strictEqual(pos.typ, 'pauschal', 'Typ nicht in der Abschrift');
      assert.strictEqual(pos.stunden, null, 'Pauschalposition traegt Stunden');
      assert.strictEqual(pos.satz, null, 'Pauschalposition traegt einen Satz');
      assert.strictEqual(pos.vergleich_stunden, null,
        'Pauschalposition traegt eine Vergleichszeit');

      // Der eigentliche Kern: die Druckansicht darf nicht sterben.
      const html = angebot.renderHtml(gemischt);
      assert.ok(/pauschal/.test(html), 'Pauschalkennzeichnung fehlt im Angebot');
      assert.ok(/Festpreise/.test(html), 'Fusstext nennt die Festpreise nicht');
      assert.ok(/nach tats/.test(html),
        'Fusstext verschweigt die Aufwandsabrechnung der Stundenposition');

      // Uebernahme in die Rechnung: Betrag gleich, Rechnungsansicht traegt.
      const uebernahme = angebot.inRechnung(db, gemischt.nr);
      assert.strictEqual(uebernahme.rechnung.netto_eur, gemischt.netto_eur,
        'Rechnungsbetrag weicht vom Pauschalangebot ab');
      const rHtml = rechnung.renderHtml(uebernahme.rechnung);
      assert.ok(/pauschal/.test(rHtml), 'Pauschalkennzeichnung fehlt in der Rechnung');

      // Storno negiert auch eine Pauschale.
      const storno = rechnung.storniere(db, uebernahme.rechnung.nr);
      assert.strictEqual(storno.netto_eur, -gemischt.netto_eur,
        'Storno einer Pauschalrechnung falsch: ' + storno.netto_eur);
      assert.ok(rechnung.renderHtml(storno), 'Stornoansicht der Pauschale gestorben');

      // Reines Pauschalangebot: keine Aufwandszeile, reiner Festpreistext.
      const nurPauschal = angebot.erstelle(db, {
        posten: [{ bezeichnung: 'Komplettpaket', typ: 'pauschal', betrag_eur: 4000 }],
        empfaenger: empf,
      });
      const pHtml = angebot.renderHtml(nurPauschal);
      assert.ok(!/Kalkulierter Aufwand/.test(pHtml),
        'Reines Pauschalangebot weist einen Stundenaufwand aus');
      assert.ok(!/nach tats/.test(pHtml),
        'Reines Pauschalangebot behauptet Abrechnung nach Aufwand');

      // Grenzen: ein vertippter Festpreis geht sonst ungeprueft nach aussen.
      for (const p of [
        { bezeichnung: 'X', typ: 'pauschal' },
        { bezeichnung: 'X', typ: 'pauschal', betrag_eur: 0 },
        { bezeichnung: 'X', typ: 'pauschal', betrag_eur: -100 },
        { bezeichnung: 'X', typ: 'pauschal', betrag_eur: 2000000 },
        { bezeichnung: 'X', typ: 'pauschal', betrag_eur: 'viel' },
      ]) {
        assert.throws(() => angebot.erstelle(db, { posten: [p], empfaenger: empf }),
          'unzulaessiger Festpreis angenommen: ' + JSON.stringify(p));
      }

      // Bestandsdaten: Positionen ohne typ-Feld sind Stundenpositionen und
      // muessen unveraendert rendern — sonst braeche jedes alte Dokument.
      const alt = [{
        bezeichnung: 'Alte Form', stunden: 4, satz: 90, basissatz: 90,
        rabatt_prozent: 0, betrag_eur: 360, vergleich_stunden: null, vergleich_faktor: null,
      }];
      const altHtml = angebot.renderHtml({
        nr: 'AN-2026-9999', aussteller: {}, empfaenger: empf, positionen: alt,
        netto_eur: 360, ust_prozent: 0, ust_eur: 0, brutto_eur: 360,
        kleinunternehmer: 1, erstellt_am: '2026-08-01', gueltig_bis: '2026-08-31',
      });
      assert.ok(/4,00/.test(altHtml), 'Altform-Position rendert die Stunden nicht mehr');
      assert.ok(!/pauschal/.test(altHtml), 'Altform-Position gilt faelschlich als pauschal');
    } finally {
      config.vergleichsFaktor = merk;
      db.close();
    }
  });
}

// Stammdaten stehen auf einem Dokument, das beim Kunden landet. Anders als die
// Zahlen duerfen sie unvollstaendig gespeichert werden — die harte Pruefung
// sitzt beim Erstellen der Rechnung. Getestet wird beides: dass Grenzen halten
// und dass der verschachtelte Block wirklich in der Datei ankommt, ohne die
// uebrigen Bloecke (vor allem den Jira-Zugang) zu zerstoeren.
function testStammdatenGrenzen() {
  const pfad = path.join(__dirname, '..', 'config.json');
  const sicherung = fs.readFileSync(pfad, 'utf8');
  const config = require('../config.json');
  const merk = JSON.parse(JSON.stringify(config));

  try {
    const { setzeStammdaten } = require('../server');
    const rechnung = require('../rechnung');

    // Gueltige Angaben landen verschachtelt in der Datei.
    const r1 = setzeStammdaten({
      name: 'Testfirma GmbH',
      anschrift: 'Teststrasse 1\n12345 Teststadt',
      steuernummer: '111/222/33333',
      iban: 'de89 3704 0044 0532 0130 00',
      kleinunternehmer: true,
    });
    assert.strictEqual(r1.geaendert.name, 'Testfirma GmbH', 'Name nicht uebernommen');
    assert.deepStrictEqual(r1.geaendert.anschrift, ['Teststrasse 1', '12345 Teststadt'],
      'Anschrift nicht in Zeilen zerlegt');
    assert.strictEqual(r1.geaendert.iban, 'DE89370400440532013000',
      'IBAN nicht vereinheitlicht (Leerzeichen/Kleinschreibung)');
    assert.strictEqual(config.rechnung.aussteller.name, 'Testfirma GmbH', 'Modul-Cache nicht aktualisiert');
    assert.strictEqual(config.rechnung.kleinunternehmer, true, 'Steuerschalter nicht am Rechnungsblock');

    const geschrieben = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    assert.strictEqual(geschrieben.rechnung.aussteller.name, 'Testfirma GmbH',
      'Stammdaten stehen nicht in der Datei');
    assert.deepStrictEqual(geschrieben.rechnung.aussteller.anschrift,
      ['Teststrasse 1', '12345 Teststadt'], 'Anschrift steht nicht in der Datei');
    // Der Nachbarblock darf beim verschachtelten Schreiben nicht verloren gehen.
    assert.ok(geschrieben.jira, 'Jira-Block beim Schreiben verloren');
    assert.ok(geschrieben.stundensatz !== undefined, 'flache Einstellungen beim Schreiben verloren');

    // Vollstaendige Angaben: nichts fehlt mehr.
    assert.deepStrictEqual(r1.fehlt, [], 'Pflichtangaben faelschlich als fehlend gemeldet');
    assert.deepStrictEqual(rechnung.fehlendeStammdaten(), [], 'rechnung.js sieht andere Stammdaten');

    // Teileingabe ist erlaubt, wird aber als unvollstaendig gemeldet — sonst
    // liesse sich das Formular nicht schrittweise ausfuellen.
    setzeStammdaten({ steuernummer: '', ustIdNr: '' });
    const r2 = setzeStammdaten({ name: 'Nur der Name' });
    assert.ok(r2.fehlt.some((f) => /steuernummer/.test(f)),
      'fehlende Steuernummer wurde nicht gemeldet');
    assert.throws(() => rechnung.pruefeStammdaten(), /Par\. 14|Stammdaten/,
      'Rechnung liesse sich trotz fehlender Pflichtangabe erstellen');

    // Ausreisser prallen ab.
    for (const [feld, wert] of [
      ['name', 'x'.repeat(200)],                     // zu lang
      ['anschrift', 'a\nb\nc\nd\ne\nf\ng'],          // zu viele Zeilen
      ['anschrift', 'x'.repeat(200)],                // Zeile zu lang
      ['iban', 'DE12'],                              // zu kurz fuer eine IBAN
      ['iban', 'nicht-eine-iban!!'],                 // unzulaessige Zeichen
      ['ustSatz', 80],                               // ueber der Grenze
      ['ustSatz', -1],                               // negativ
      ['zahlungszielTage', 999],                     // Tippfehler
    ]) {
      assert.throws(() => setzeStammdaten({ [feld]: wert }),
        'unzulaessiger Wert wurde angenommen: ' + feld + '=' + wert);
    }

    // Fremde Felder werden nicht durchgereicht. Verglichen wird gegen den
    // Stand davor, nicht gegen einen festen Wert (siehe testEinstellungenGrenzen).
    const vorher = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    assert.throws(() => setzeStammdaten({ jira: { enabled: !vorher.jira.enabled } }),
      'unbekanntes Feld wurde angenommen');
    const nachher = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    assert.strictEqual(nachher.jira.enabled, vorher.jira.enabled,
      'fremdes Feld wurde doch geschrieben');

    // Der Steuerschalter ist ein Schalter: false muss ankommen, nicht als
    // "leer, also unveraendert" durchrutschen.
    setzeStammdaten({ kleinunternehmer: false });
    assert.strictEqual(config.rechnung.kleinunternehmer, false, 'Schalter laesst sich nicht ausschalten');
  } finally {
    fs.writeFileSync(pfad, sicherung, 'utf8');
    for (const k of Object.keys(merk)) config[k] = merk[k];
  }
}

// Das erzeugte PDF muss ueber den Server abrufbar sein. Fehlt die Route,
// entsteht die Datei zwar im Datenordner, die Oberflaeche kann sie aber nicht
// zeigen — der Knopf sieht dann wirkungslos aus, genau der gemeldete Fehler.
// Geprueft wird ueber echtes HTTP, weil nur die Route selbst der Streitpunkt
// ist; die Erzeugung des PDF bleibt aussen vor (sie braucht einen Browser).
async function testPdfRoute() {
  const { server } = require('../server');
  const dir = path.join(__dirname, '..', 'data', 'rechnungen');
  const nr = '9999-9999';
  const datei = path.join(dir, nr + '.pdf');
  // Minimale, gueltige PDF-Datei — der Inhalt ist fuer die Route unerheblich.
  const inhalt = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(datei, inhalt);

  const lauscht = server.listening;
  if (!lauscht) await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  const hole = async (pfad) => {
    const r = await fetch(`http://127.0.0.1:${port}${pfad}`);
    return { status: r.status, typ: r.headers.get('content-type'),
             disp: r.headers.get('content-disposition'),
             buf: Buffer.from(await r.arrayBuffer()) };
  };

  try {
    const ok = await hole('/rechnung-pdf/' + nr);
    assert.strictEqual(ok.status, 200, 'PDF wird nicht ausgeliefert (HTTP ' + ok.status + ')');
    assert.strictEqual(ok.typ, 'application/pdf', 'falscher Inhaltstyp: ' + ok.typ);
    assert.ok(/Rechnung-9999-9999\.pdf/.test(ok.disp || ''), 'Dateiname fehlt: ' + ok.disp);
    assert.ok(ok.buf.equals(inhalt), 'ausgelieferter Inhalt weicht ab');

    // Mit .pdf-Endung in der Adresse ebenfalls, sonst haengt es am Aufrufer.
    assert.strictEqual((await hole('/rechnung-pdf/' + nr + '.pdf')).status, 200,
      'Adresse mit .pdf-Endung wird nicht bedient');

    // Nicht vorhanden -> 404, kein Serverfehler.
    assert.strictEqual((await hole('/rechnung-pdf/1234-5678')).status, 404,
      'fehlende Datei liefert nicht 404');

    // Ueber den Pfad darf nichts anderes erreichbar sein: die Nummer wird
    // zu einem Dateipfad, also muss die Form streng geprueft bleiben.
    for (const boese of ['../../config', '..%2f..%2fconfig.json', 'abcd-efgh', '99999-9999']) {
      const r = await hole('/rechnung-pdf/' + boese);
      assert.strictEqual(r.status, 404, 'Pfad "' + boese + '" wurde bedient statt abgewiesen');
    }
  } finally {
    try { fs.unlinkSync(datei); } catch { /* schon weg */ }
    if (!lauscht) await new Promise((ok) => server.close(ok));
  }
}

// Der Server haelt seinen Code im Speicher. Wird server.js geaendert, laeuft
// der alte Stand weiter, bis der Dienst neu startet — die Oberflaeche fordert
// dann Endpunkte an, die es dort noch nicht gibt, und meldet 404 an einer
// Stelle, die eben noch ging. Genau das ist passiert. Die Kennung aus
// /api/summary erlaubt der Oberflaeche, den Versionssprung zu erkennen.
async function testCodeStandKennung() {
  const { server } = require('../server');
  const lauscht = server.listening;
  if (!lauscht) await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  try {
    const d = await (await fetch(`http://127.0.0.1:${port}/api/summary`)).json();
    assert.ok(d.codeStand, 'codeStand fehlt in /api/summary');
    assert.ok(/^\d+$/.test(d.codeStand), 'codeStand ist keine Zahl: ' + d.codeStand);

    // Zweiter Abruf desselben Servers: unveraendert, sonst warnte die
    // Oberflaeche bei jedem Takt grundlos.
    const d2 = await (await fetch(`http://127.0.0.1:${port}/api/summary`)).json();
    assert.strictEqual(d2.codeStand, d.codeStand, 'Kennung wechselt ohne Codeaenderung');

    // Und sie muss sich an den Programmdateien orientieren: der Wert ist der
    // juengste Aenderungszeitpunkt, also nicht aelter als server.js selbst.
    const mtime = Math.round(fs.statSync(path.join(__dirname, '..', 'server.js')).mtimeMs);
    assert.ok(Number(d.codeStand) >= mtime,
      'Kennung (' + d.codeStand + ') ist aelter als server.js (' + mtime + ')');
  } finally {
    if (!lauscht) await new Promise((ok) => server.close(ok));
  }
}

// --- Logverzeichnis --------------------------------------------------------
// Die Vorlage nennt '~/.claude/projects'. Bliebe die Tilde stehen, faende das Einlesen
// nichts und der Server meldete stumm 0 Requests — ein Einrichtungsfehler, der
// wie Feierabend aussieht. Der Test sichert, dass aufgeloest wird und nicht der
// rohe Eintrag durchgereicht.
function testJsonlDirTilde() {
  const heim = process.env.USERPROFILE || process.env.HOME;
  const cfg = require('../config.json');
  const vorher = cfg.jsonlDir;
  try {
    cfg.jsonlDir = '~/.claude/projects';
    const auf = ingest.jsonlDir();
    assert.ok(!auf.includes('~'), 'Tilde blieb stehen: ' + auf);
    assert.ok(auf.startsWith(heim), 'nicht im Benutzerverzeichnis: ' + auf);
    assert.ok(auf.endsWith(path.join('.claude', 'projects')), 'Endstueck fehlt: ' + auf);

    // Ein absoluter Pfad muss unveraendert durchgehen.
    const abs = path.join(heim, 'woanders');
    cfg.jsonlDir = abs;
    assert.strictEqual(ingest.jsonlDir(), abs);
  } finally {
    cfg.jsonlDir = vorher;
  }
}

async function main() {
  console.log('c2invoice Selbstpruefung\n');
  test('Dedup: Kopien desselben Requests zaehlen einmal', testDedup);
  test('Cache-Tokens werden nach 5m/1h getrennt und gehen nicht verloren', testUsageSplit);
  test('Ticket wird aus dem Branch gelesen', testTicket);
  test('Projekt wird aus dem Arbeitsverzeichnis abgeleitet', testProject);
  test('Aktivzeit ignoriert Pausen ueber der Schwelle', testActiveTime);
  test('Zeit: parallele Sitzungen zaehlen jede Minute nur einmal', testZeitParallel);
  test('Eingaben: nur eigene Eingaben zaehlen, keine Werkzeugergebnisse', testIstEingabe);
  test('Zeit: abgerechnet wird das Fenster um eigene Eingaben, Agentenzeit getrennt', testZeitEingaben);
  test('Zeit: Altbestand und Modell aktivitaet rechnen ueber die vereinigte Aktivitaet', testZeitAltbestand);
  test('Zeit: Summe der Vorgaenge ergibt den Gesamtwert, auch ueber die Monatsgrenze', testZeitSummen);
  test('Zeit: das Zeitmodell laesst sich in den Einstellungen umschalten', testZeitmodellSchalter);
  test('Zeit: Zeitmodell je Sitzung, Vorgang und Projekt ueberschreibt den Standard', testZeitmodellEbenen);
  test('Zeitmodell: Wahl je Vorgang, Sitzung und Projekt wird geprueft und gespeichert', testZeitmodellWahl);
  test('Rechnung: Position nennt das Zeitmodell ihrer Stunden', testRechnungZeitmodell);
  test('Preise: synthetisch = 0, Haiku < Opus, unbekannte Variante > 0', testPricing);
  test('Mehrwert rechnet Dollar in Euro um, bevor addiert wird', testMehrwert);
  test('Marge zieht die eigene Arbeitszeit ab, Zielmarge nur als Vergleich', testMargeZiehtEigeneZeitAb);
  test('Abo in Euro wird nicht durch den Dollarkurs gedreht', testAboWaehrung);
  test('Abokosten im Zeitraum: volle Monate voll, angeschnittene anteilig', testAboKostenZeitraum);
  test('Werkzeug-Overhead wird von Kundenprojekten getrennt', testOverhead);
  test('Werkzeuge werden dem parallel bearbeiteten Projekt zugeordnet', testWerkzeugZuordnung);
  test('Ticket rechnet eigene Arbeit plus begleitende Werkzeuge ab', testTicketGesamtsumme);
  test('Vorgaenge ohne Ticket: abrechenbar, ohne Werkzeuge doppelt und ohne byTicket zu aendern',
    () => mitZeitmodell(5, 'eingaben', testOhneTicket));
  test('Stundensatz je Projekt: eigener Satz, Rabatt, Grenzwerte', testStundensaetze);
  test('Backfill: Ticket aus dem Worktree-Pfad, sonst ticketlos', testBackfillCwd);
  test('Backfill: Sitzungs-Konsens erbt, uneindeutige Sitzung bleibt offen', testBackfillSessionKonsens);
  test('Backfill: Zeitfenster nur gleiches Projekt, nicht Werkzeuge', testBackfillZeitfenster);
  test('Backfill: Override schlaegt Branch, zweiter Lauf aendert nichts', testBackfillOverrideUndIdempotenz);
  test('Buchen: Sitzung wirkt sofort in events und activity', testBuchenSchreibtDurch);
  test('Buchen: unzulaessige Vorgangsnamen prallen ab', testBuchenGrenzen);
  test('Buchen: unbekannte Sitzung legt keinen Waisen-Eintrag an', testBuchenUnbekannteSitzung);
  test('Buchen: Umbuchen ersetzt statt zu haeufen', testBuchenUmbuchen);
  test('Buchen: Aufheben stellt die automatische Zuordnung wieder her', testBuchenAufheben);
  test('Live: erkannte und gebuchte Zuordnung sind unterscheidbar', testLiveHerkunft);
  test('Live: Subagent steht als eigene, gekennzeichnete Zeile', testLiveSubagent);
  test('Jira: nur echte Schluessel gehen nach Jira', testIstJiraKey);
  test('Jira: Tickets ohne Daten korrekt bestimmt und markiert', testTicketsOhneDaten);
  test('Rechnung: Nummer laeuft fort, Pflichtangaben erzwungen', testRechnungNummernkreis);
  test('Rechnung: Abschrift bleibt unveraendert, Storno statt Loeschen', testRechnungUnveraenderlich);
  test('Rechnung: beide Steuermodi, Escaping, keine Werkzeugdaten', testRechnungSteuerUndEscaping);
  test('E-Rechnung: Pflichtfelder, Summen, Steuerarten und Storno', testERechnung);
  test('Abrechnungsstand: Betrag je Vorgang aus gestellten Rechnungen, Storno faellt raus', testAbrechnungsStatus);
  test('Einstellungen: Grenzen halten, fremde Felder prallen ab, Datei bleibt vollstaendig', testEinstellungenGrenzen);
  test('Stammdaten: Grenzen halten, Teileingabe meldet Fehlendes, Nachbarbloecke bleiben', testStammdatenGrenzen);
  test('Verlauf: Tag, Monat und Jahr ergeben dieselbe Summe', testZeitreihenKoernung);
  test('Modellfilter greift auf Geldwerte, nicht auf die Aktivzeit', testModellFilterLaesstZeitUnberuehrt);
  test('Aktive Stunden im Ueberblick zaehlen den Werkzeugbetrieb nicht mit', testAktivstundenOhneWerkzeuge);
  test('Vergleichsaufwand: leer ohne Faktor, nur Zeit, aendert keine Abrechnung', testVergleichsaufwand);
  test('Vergleich auf der Rechnung: nur Zeit, mit Hinweis, in der Abschrift', testVergleichAufRechnung);
  test('Angebote: eigener Nummernkreis, Grenzen, Uebernahme laesst das Angebot stehen', testAngebote);
  test('Pauschalpositionen: Festpreis ohne Stunden, Druckansicht traegt beide Formen', testPauschalPositionen);
  test('Kontakte: Grenzen halten, Teileingabe bleibt harmlos, Lead wird einmal zum Kunden', testKontakte);
  test('Vorlagen: Grenzen halten, fehlender Satz bleibt leer statt null Euro', testVorlagen);
  test('Vorgang traegt Satz und Projekt aus derselben Wahl', testTicketProjekt);
  test('Herkunft: Summen stimmen, Bezugsgroesse ohne lokale Modelle', testHerkunft);
  test('Projekt gehoert genau einem Kunden, ein zweiter bekommt es nicht', testProjektKontakt);
  test('Projektzuordnung: Grenzen sitzen im Modul, nicht im Formular', testProjektKontaktGrenzen);
  test('Geloeschter Kontakt nimmt die Zuordnung mit, die Rechnung bleibt', testProjektKontaktLoeschen);
  test('Projekte bleiben bei Teileingabe stehen, lassen sich einzeln aendern', testProjekteTeileingabe);
  test('Umwandlung: Annahme macht den Lead zum Kunden, geloeschter Kontakt bricht nichts', testKontaktKonversion);
  test('Lokale Modelle: kein Preis, keine erfundenen Kosten', testLokalOhnePreis);
  test('Lokale Modelle: Zuordnung ueber die Zeit, kein eigener Vorgang', testLokalZuordnung);
  test('Lokale Modelle: Pauschale linear, Rabatt genau einmal', testLokalPauschale);
  test('Lokale Modelle: Rechnungsposition bleibt im Verhaeltnis zur Zeit', testLokalRechnungsposition);
  test('Lokale Modelle: Marge kennt Pauschale und Rechenzeit', testLokalMarge);
  test('Proxy: Nutzungszahlen aus Strom und Antwort, sonst nichts', testProxyUsage);
  test('Logverzeichnis: Tilde wird aufgeloest, absoluter Pfad bleibt', testJsonlDirTilde);

  try {
    await testIngestRoundtrip();
    console.log('  ok   Ingest: echte Datei, Dedup und Wiederholungslauf');
  } catch (err) {
    failed++;
    console.log('  FAIL Ingest: echte Datei, Dedup und Wiederholungslauf\n       ' + err.message);
  }

  try {
    await testPreisLuecken();
    console.log('  ok   Preise: Modelle ohne exakten Preis werden gekennzeichnet und nachbepreist');
  } catch (err) {
    failed++;
    console.log('  FAIL Preise: Modelle ohne exakten Preis werden gekennzeichnet und nachbepreist\n       ' + err.message);
  }

  try {
    await testEingabeNachtrag();
    console.log('  ok   Eingaben: Altbestand wird einmal nachgetragen, Kosten und Zuordnung bleiben');
  } catch (err) {
    failed++;
    console.log('  FAIL Eingaben: Altbestand wird einmal nachgetragen, Kosten und Zuordnung bleiben\n       ' + err.message);
  }

  try {
    await testPdfRoute();
    console.log('  ok   PDF: Datei wird ausgeliefert, fremde Pfade prallen ab');
  } catch (err) {
    failed++;
    console.log('  FAIL PDF: Datei wird ausgeliefert, fremde Pfade prallen ab\n       ' + err.message);
  }

  try {
    await testERechnungRoute();
    console.log('  ok   E-Rechnung: Datei wird ausgeliefert, fremde Pfade prallen ab');
  } catch (err) {
    failed++;
    console.log('  FAIL E-Rechnung: Datei wird ausgeliefert, fremde Pfade prallen ab\n       ' + err.message);
  }

  try {
    await testCodeStandKennung();
    console.log('  ok   Programmstand: Kennung erlaubt das Erkennen eines Neustarts');
  } catch (err) {
    failed++;
    console.log('  FAIL Programmstand: Kennung erlaubt das Erkennen eines Neustarts\n       ' + err.message);
  }

  for (const db of openDbs) {
    try { db.close(); } catch { /* bereits geschlossen */ }
  }

  console.log(failed === 0 ? '\nAlle Pruefungen bestanden.' : `\n${failed} Pruefung(en) fehlgeschlagen.`);
  // Exitcode setzen statt den Prozess abzuschiessen: so laufen offene Handles
  // geordnet aus und der Code bleibt fuer Automatisierung verwertbar.
  process.exitCode = failed === 0 ? 0 : 1;
}

main();
