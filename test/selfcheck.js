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

// Die aelteren HTTP-Tests schreiben ohne gekoppeltes Geraet (S1). Ausdruecklich
// nur hier abgeschaltet; test/cira/s1.js schaltet den Schutz fuer sich wieder ein.
process.env.C2I_GERAETESCHUTZ = 'aus';

// Die Tests schreiben ueber schreibeConfig() und configGeschuetzt() in die
// Konfiguration. Das landet in einer Kopie: bricht der Lauf mittendrin ab,
// bleibt die echte config.json unberuehrt (Toolcheck 15.10., H8). Lesen geht
// ebenfalls an die Kopie, sonst saehen Tests ihr eigenes Schreiben nicht.
// Dasselbe Verfahren wie design/werkzeuge/probe.js.
{
  const echt = path.join(__dirname, '..', 'config.json');
  const kopie = path.join(os.tmpdir(), 'c2invoice-selfcheck-' + process.pid + '-config.json');
  fs.copyFileSync(echt, kopie);
  const norm = (p) => (typeof p === 'string' || p instanceof URL ? path.resolve(String(p)).toLowerCase() : null);
  const um = (p) => (norm(p) === echt.toLowerCase() ? kopie : norm(p) === (echt + '.tmp').toLowerCase() ? kopie + '.tmp' : p);
  for (const name of ['readFileSync', 'writeFileSync', 'existsSync', 'rmSync', 'statSync']) {
    const orig = fs[name];
    fs[name] = (p, ...r) => orig(um(p), ...r);
  }
  const benenne = fs.renameSync;
  fs.renameSync = (a, b) => benenne(um(a), um(b));
  process.on('exit', () => { for (const f of [kopie, kopie + '.tmp']) try { fs.unlinkSync(f); } catch { /* weg */ } });
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

// Der Live-Tab zeigt je Sitzung, wie viel Zeit sie bisher traegt: abgerechnet
// nach ihrem Zeitmodell und daneben die Agentenzeit — ueber die ganze Sitzung,
// nicht nur das 60-Minuten-Fenster der Ansicht.
function testLiveSitzungszeit() {
  mitZeitmodell(5, 'eingaben', () => {
    const z = zeitDb(Date.now() - 180 * 60000);
    // Eingaben bei 0 und 20, dazwischen der Agent; spaeter eine Eingabe bei 170.
    for (let min = 0; min <= 20; min++) z.zeile('sZ', min, 'Q', null, [0, 20].includes(min) ? 1 : 0);
    z.zeile('sZ', 170, 'Q', null, 1);
    const s = metrics.live(z.db).sessions.find((x) => x.session_id === 'sZ');
    assert.ok(s, 'Sitzung fehlt im Live-Tab');
    // Drei Fenster von je 5 Minuten; Agent: 20 Minuten am Stueck, die Pause zaehlt nicht.
    assert.strictEqual(s.active_seconds, 15 * 60, 'abgerechnet ' + s.active_seconds + 's statt 900s');
    assert.strictEqual(s.agent_seconds, 20 * 60, 'Agentenzeit ' + s.agent_seconds + 's statt 1200s');
    z.db.close();
  });
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
    // Name und Kunde landen als Schluessel bzw. Text in config.json und auf Belegen: Laenge begrenzt.
    assert.throws(() => setzeSatz({ projekt: 'x'.repeat(201), satz: 1 }), /Projektname/, 'ueberlanger Projektname angenommen');
    assert.throws(() => setzeSatz({ projekt: 'P', satz: 1, kunde: 'k'.repeat(201) }), /Kunde/, 'ueberlanger Kunde angenommen');
    setzeSatz({ projekt: 'x'.repeat(200), satz: 1 });
    setzeSatz({ projekt: 'x'.repeat(200), zeitmodell: '' });
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

    // Je Tag (Hub: heute/Woche, Heatmap): dieselbe Zeit, nur nach Tagen geteilt.
    const tage = metrics.byDay(db, {});
    const jeTag = Object.fromEntries(tage.map((t) => [t.day, t.active_seconds]));
    assert.strictEqual(jeTag['2026-08-31'], 4 * 60, '31.08. traegt ' + jeTag['2026-08-31'] + 's statt 240s');
    assert.strictEqual(tage.reduce((a, t) => a + t.active_seconds, 0), gesamt, 'Tage ergeben nicht die Gesamtzeit');
    const monate = metrics.byMonth(db, {});
    assert.strictEqual(monate.reduce((a, t) => a + t.active_seconds, 0), gesamt, 'Monate ergeben nicht die Gesamtzeit');
    // Woche Montag bis Sonntag, benannt nach ihrem Montag: Mo 31.08. und
    // Di 01.09. liegen in derselben Woche, obwohl der Monat wechselt.
    const wochen = metrics.byPeriod(db, {}, 'woche');
    assert.deepStrictEqual(wochen.map((w) => w.day), ['2026-08-31'], 'Wochen: ' + wochen.map((w) => w.day));
    assert.strictEqual(wochen[0].active_seconds, gesamt, 'Woche traegt nicht die Gesamtzeit');
    assert.strictEqual(wochen[0].requests, 3, 'Woche zaehlt nicht alle Requests');
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
  // Listenpreis Opus 5: 5 USD je Mio. Eingabe (LiteLLM, Anthropic). Bis 2.0.1
  // stand hier 15 — die alte Ersatztabelle (Toolcheck 15.10., H3).
  assert.ok(Math.abs(cost - 5) < 1e-9, 'Opus-5-Preis pro Mio Input falsch: ' + cost);

  // Haiku muss deutlich billiger sein als Opus, sonst stimmt die Zuordnung nicht.
  const haiku = pricing.costOf('claude-haiku-4-5-20251001', { input_tokens: 1_000_000 });
  assert.ok(haiku < cost / 4, 'Haiku nicht billiger als Opus: ' + haiku + ' vs ' + cost);

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
  const echtRefresh = pricing.refresh;

  return ingest.run({ db }).then(() => {
    // Ohne Liste traegt auch ein bekanntes Modell die Ersatztabelle (H3).
    assert.strictEqual(zeile('p1').preis_art, pricing.info().source === 'fallback' ? 'fallback' : null, 'exakt bepreistes Modell ist markiert');
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
    // In die geladene Liste, nicht in die Ersatztabelle: ein Treffer dort gilt
    // seit H3 selbst als "fallback" und bleibt markiert.
    // ingest.run laedt die Liste jedes Mal neu, also nach dem Laden ergaenzen.
    pricing.refresh = async (...a) => {
      await echtRefresh(...a);
      const i = pricing.info();
      pricing.setzeTabelle({ ...(pricing.tabelle() || {}), 'gpt-9-turbo': { in: 2e-6, out: 8e-6, cw5m: 2.5e-6, cw1h: 4e-6, cr: 0.2e-6 } }, i.source, i.version);
      return pricing.tabelle();
    };
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
    pricing.refresh = echtRefresh;
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

// Der Server bedient Anfragen ueber dieselbe Verbindung, waehrend der Ingest
// Logdateien liest. Haelt der Ingest dabei eine Transaktion ueber ein await
// offen, scheitert jedes BEGIN einer Anfrage (Storno, Kontakt speichern) mit
// "cannot start a transaction within a transaction". Simuliert wird die
// Anfrage durch BEGIN/COMMIT in jeder Pause des Laufs.
function testIngestOhneOffeneTransaktion() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-'));
  const projDir = path.join(tmp, 'C--Users-Test-Dev-Demo');
  fs.mkdirSync(projDir, { recursive: true });
  // Mehrere MB, damit der Zeilenleser mehrfach auf die Platte wartet.
  const zeilen = [];
  for (let i = 0; i < 12000; i++) {
    zeilen.push(JSON.stringify({
      type: 'assistant', timestamp: new Date(Date.UTC(2026, 7, 18, 10) + i * 1000).toISOString(), sessionId: 'sess-tx',
      cwd: 'C:\\Users\\Test\\Dev\\Demo', gitBranch: 'feature/PROJ-1-demo', requestId: 'tx' + i,
      message: { id: 'msg_tx' + i, model: 'claude-opus-5', content: [{ type: 'text', text: 'x'.repeat(400) }],
        usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
    }));
  }
  fs.writeFileSync(path.join(projDir, 'gross.jsonl'), zeilen.join('\n') + '\n');

  const cfg = require('../config.json');
  const origDir = cfg.jsonlDir;
  cfg.jsonlDir = tmp;
  if (!cfg.lokaleModelle) cfg.lokaleModelle = {};
  const origLokal = cfg.lokaleModelle.protokollDir;
  cfg.lokaleModelle.protokollDir = path.join(tmp, 'lokal-leer');

  const db = dbmod.open(':memory:');
  openDbs.push(db);
  let proben = 0, fehler = null, laeuft = true;
  const probe = () => {
    if (!laeuft) return;
    proben++;
    try { db.exec('BEGIN'); db.exec('COMMIT'); } catch (e) { fehler = fehler || e.message; }
    setImmediate(probe);
  };
  setImmediate(probe);
  return ingest.run({ db }).then(() => {
    laeuft = false;
    assert.ok(proben > 3, 'Probe lief nicht waehrend des Ingests (' + proben + ') — Test kann nicht rot werden');
    assert.strictEqual(fehler, null, 'Anfrage-Transaktion scheiterte waehrend des Ingests: ' + fehler);
    assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM events').get().c, 12000, 'nicht alle Requests eingelesen');
    assert.strictEqual(db.prepare('SELECT COUNT(*) c FROM files').get().c, 1, 'Dateiposition nicht gespeichert');
  }).finally(() => {
    laeuft = false;
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

  // Leerer Zeitraum: der letzte Werkzeug-Request steht trotzdem da, damit die
  // Oberflaeche "seit wann still" sagen kann (claude-mem 13.18 schrieb keine Logs mehr).
  // Gegenprobe: zuletzt aus dem gefilterten Zeitraum lesen -> null, Test rot.
  const still = metrics.werkzeuge(db, { from: '2026-09-01', to: '2026-09-30' });
  assert.strictEqual(still.summe.requests, 0, 'September hat keine Werkzeug-Aufrufe');
  assert.strictEqual(still.summe.zuletzt, t(61), 'letzter Werkzeug-Request fehlt: ' + still.summe.zuletzt);
  assert.deepStrictEqual(still.summe.projekte, config.overheadProjekte, 'konfigurierte Werkzeug-Projekte fehlen');

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
function rechnungsUmgebung(fn, { doppeltPruefen = false } = {}) {
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
  // Diese Tests stellen dieselbe Rechnung mehrfach; die Sperre gegen doppelte
  // Abrechnung pruefen die H4-Tests in test/hotfix.js mit eigener Umgebung.
  const rechnung = require('../rechnung');
  const merkDoppelt = rechnung.pruefung.doppelt;
  rechnung.pruefung.doppelt = doppeltPruefen;
  try {
    return fn(config);
  } finally {
    config.rechnung = original;
    config.vergleichsFaktor = merkFaktor;
    rechnung.pruefung.doppelt = merkDoppelt;
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
      ['Empfänger: Käuferreferenz oder Kundennummer', 'Empfänger: E-Mail oder Leitweg-ID']);
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

// Kundennummer: jeder Kontakt hat eine, ohne dass jemand sie vergeben muss.
// Kleine Kunden nennen keine Referenz; die E-Rechnung verlangt aber eine
// Kaeuferreferenz (BT-10). Die Kundennummer fuellt sie dann aus und steht
// ausserdem als Kaeuferkennung (BT-46) in der Datei und auf dem Dokument.
function testKundennummer() {
  rechnungsUmgebung((config) => {
    const rechnung = require('../rechnung');
    const erechnung = require('../erechnung');
    const kontakte = require('../kontakte');
    Object.assign(config.rechnung.aussteller, { email: 'rechnung@testfirma.example', telefon: '+49 221 123456' });
    const auto = (id) => 'K-' + String(id).padStart(4, '0');

    // 1. Automatisch, ueberschreibbar, eindeutig.
    const db = rechnungsDb();
    const a = kontakte.speichere(db, { firma: 'Kleine Firma', anschrift: ['Weg 2', '10115 Berlin'], email: 'info@klein.example' });
    assert.strictEqual(a.kundennummer, auto(a.id), 'keine automatische Kundennummer');
    assert.strictEqual(a.kundennummer_eigen, false);
    const b = kontakte.speichere(db, { firma: 'Zweite GmbH', kundennummer: '10023' });
    assert.strictEqual(b.kundennummer, '10023', 'eigene Kundennummer nicht uebernommen');
    assert.strictEqual(b.kundennummer_eigen, true);
    assert.throws(() => kontakte.speichere(db, { firma: 'Dritte', kundennummer: '10023' }), /Kundennummer/,
      'doppelte Kundennummer angenommen');
    // Das automatische Muster ist reserviert: K-0099 bekaeme spaeter der 99. Kontakt.
    assert.throws(() => kontakte.speichere(db, { firma: 'Vierte', kundennummer: 'K-0099' }), /Kundennummer/,
      'Kundennummer im automatischen Muster angenommen');
    assert.strictEqual(kontakte.speichere(db, { id: a.id, kundennummer: a.kundennummer }).kundennummer, a.kundennummer,
      'die eigene automatische Nummer laesst sich nicht bestaetigen');
    assert.strictEqual(kontakte.speichere(db, { id: b.id, kundennummer: '' }).kundennummer, auto(b.id),
      'leere Kundennummer faellt nicht auf die automatische zurueck');

    // 2. Ohne Kaeuferreferenz: die Kundennummer traegt BT-10 und BT-46.
    const daten = {
      from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'],
      empfaenger: { name: 'Kleine Firma', anschrift: ['Weg 2', '10115 Berlin'] }, kontaktId: a.id,
    };
    const inv = rechnung.erstelle(db, daten);
    assert.strictEqual(inv.empfaenger.kundennummer, a.kundennummer, 'Kundennummer fehlt in der Abschrift');
    assert.deepStrictEqual(erechnung.pruefe(inv), [], 'E-Rechnung verlangt trotz Kundennummer eine Kaeuferreferenz');
    const xml = erechnung.alsXml(inv);
    assert.deepStrictEqual(xmlWerte(xml, 'ram:BuyerReference'), [a.kundennummer], 'BT-10 nicht mit der Kundennummer gefuellt');
    assert.ok(new RegExp('<ram:BuyerTradeParty>\\s*<ram:ID>' + a.kundennummer + '</ram:ID>').test(xml),
      'Kundennummer steht nicht als Kaeuferkennung (BT-46) in der Datei');
    assert.ok(rechnung.renderHtml(inv).includes('Kundennummer: ' + a.kundennummer), 'Kundennummer fehlt auf dem Dokument');

    // 3. Gibt der Kunde eine Referenz vor, gilt seine.
    const db2 = rechnungsDb();
    const c = kontakte.speichere(db2, {
      firma: 'Amt', anschrift: ['Platz 1', '10115 Berlin'], email: 'x@amt.example', kaeuferReferenz: '991-12345-67',
    });
    const xml2 = erechnung.alsXml(rechnung.erstelle(db2, { ...daten, kontaktId: c.id }));
    assert.deepStrictEqual(xmlWerte(xml2, 'ram:BuyerReference'), ['991-12345-67'], 'Vorgabe des Kunden wurde ueberschrieben');

    // 4. Ohne Kontakt und ohne Referenz bleibt es eine Luecke, und sie wird benannt.
    const db3 = rechnungsDb();
    const frei = rechnung.erstelle(db3, { ...daten, kontaktId: undefined,
      empfaenger: { name: 'Frei', anschrift: ['Weg 3', '10115 Berlin'], email: 'f@frei.example' } });
    assert.deepStrictEqual(erechnung.pruefe(frei), ['Empfänger: Käuferreferenz oder Kundennummer'],
      'fehlende Referenz falsch benannt: ' + erechnung.pruefe(frei).join(', '));
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

// DNS-Rebinding: eine fremde Webseite laesst ihren Namen auf 127.0.0.1 zeigen
// und liest dann als "same-origin" alle Abrechnungsdaten. Der Browser schickt
// dabei aber ihren Namen im Host-Header — der Server bedient nur die eigenen.
async function testHostHeader() {
  const http = require('node:http');
  const srv = require('../server');
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const port = srv.server.address().port;
  const frage = (host) => new Promise((ok, fehler) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/saetze', headers: { host } }, (r) => {
      r.resume();
      r.on('end', () => ok(r.statusCode));
    });
    req.on('error', fehler);
    req.end();
  });
  try {
    for (const host of ['127.0.0.1:' + port, 'localhost:' + port, '127.0.0.1', '[::1]:' + port]) {
      assert.strictEqual(await frage(host), 200, 'eigener Host "' + host + '" abgewiesen');
    }
    for (const host of ['boese.example', 'boese.example:' + port, '127.0.0.1.boese.example', 'localhost.boese.example:' + port]) {
      assert.strictEqual(await frage(host), 421, 'fremder Host "' + host + '" wurde bedient');
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

    // Alles oder nichts: scheitert ein Feld, bleibt auch das gueltige davor unveraendert —
    // im Speicher, nicht nur in der Datei (sonst rechnet der laufende Server mit halben Werten).
    assert.throws(() => setzeEinstellungen({ stundensatz: 51, gapMinutes: 9999 }), /Pausenschwelle/);
    assert.strictEqual(config.stundensatz, 95, 'gueltiges Feld trotz abgelehnter Eingabe uebernommen');

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
  // Die Tageszeit im Hub ist Projektarbeit, kein Werkzeugbetrieb.
  const tagZeit = metrics.byDay(db, {})[0].active_seconds;
  assert.strictEqual(tagZeit, split.arbeit.active_seconds,
    'Tageszeit ' + tagZeit + 's enthaelt Werkzeugbetrieb (Projektarbeit: ' + split.arbeit.active_seconds + 's)');

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

      // Kanban (Nacharbeit 14.10.): Zeitpunkte, Wiederoeffnen, Rueckgaengig.
      const lead4 = kontakte.speichere(db, { firma: 'Vierte GmbH' });
      const e = angebot.erstelle(db, { posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf, kontaktId: lead4.id });
      const vorE = angebot.lade(db, e.nr);
      const zu = angebot.setzeStatus(db, e.nr, 'angenommen');
      assert.ok(zu.angenommen_am && Math.abs(Date.parse(zu.angenommen_am) - Date.now()) < 60000, 'angenommen_am nicht jetzt');
      assert.strictEqual(zu.abgelehnt_am, null, 'abgelehnt_am bei Annahme gesetzt');
      assert.strictEqual(zu.kunde_geworden, true, 'kunde_geworden fehlt, obwohl der Lead umgewandelt wurde');
      assert.strictEqual(angebot.setzeStatus(db, ohne.nr, 'angenommen').kunde_geworden, false, 'ohne Kontakt als Kunde gemeldet');
      // Rueckgaengig stellt Angebot und Kontakt her — in einem Schritt.
      angebot.setzeStatus(db, e.nr, 'offen', { gueltig_bis: vorE.gueltig_bis, angenommen_am: null, abgelehnt_am: null, lead: true });
      const zurueck = angebot.lade(db, e.nr);
      assert.deepStrictEqual([zurueck.status, zurueck.gueltig_bis, zurueck.angenommen_am, zurueck.abgelehnt_am],
        ['offen', vorE.gueltig_bis, null, null], 'Rueckgaengig stellt das Angebot nicht her');
      assert.strictEqual(kontakte.lade(db, lead4.id).status, 'lead', 'Rueckgaengig macht den Kunden nicht wieder zum Lead');
      // Ein Kunde, der nicht durch diese Annahme Kunde wurde, bleibt Kunde (lead fehlt im Stand).
      angebot.setzeStatus(db, a.nr, 'offen', { gueltig_bis: a.gueltig_bis, angenommen_am: null, abgelehnt_am: null });
      assert.strictEqual(kontakte.lade(db, lead.id).status, 'kunde', 'Rueckgaengig ohne lead hat einen Kunden zurueckgestuft');
      // Ablehnung haelt ihren Zeitpunkt fest und loescht den der Annahme.
      angebot.setzeStatus(db, e.nr, 'angenommen');
      const ab = angebot.setzeStatus(db, e.nr, 'abgelehnt');
      assert.ok(ab.abgelehnt_am && ab.angenommen_am === null, 'abgelehnt_am/angenommen_am falsch: ' + ab.abgelehnt_am + ' / ' + ab.angenommen_am);
      // Abgelaufen wieder oeffnen: gueltig bis heute + 30 Tage; nicht abgelaufen: unveraendert.
      db.prepare('UPDATE angebote SET gueltig_bis = ? WHERE nr = ?').run(new Date(Date.now() - 2 * 86400000).toISOString(), e.nr);
      const auf = angebot.setzeStatus(db, e.nr, 'offen');
      const tage = (Date.parse(auf.gueltig_bis) - Date.now()) / 86400000;
      assert.ok(tage > 29.9 && tage < 30.1, 'Wiederoeffnen verlaengert nicht um 30 Tage: ' + tage);
      assert.strictEqual(angebot.liste(db).find((x) => x.nr === e.nr).status_abgeleitet, 'offen', 'wiedergeoeffnet, aber weiter abgelaufen');
      const vorher = angebot.lade(db, ohne.nr).gueltig_bis;
      assert.strictEqual(angebot.setzeStatus(db, ohne.nr, 'offen').gueltig_bis, vorher, 'gueltiges Angebot beim Wiederoeffnen verlaengert');
      // Liste traegt die Zeitpunkte fuer die Karte.
      assert.ok('angenommen_am' in angebot.liste(db)[0] && 'abgelehnt_am' in angebot.liste(db)[0], 'Liste ohne Zeitpunkte');
      // Uebernahme in eine Rechnung setzt angenommen_am, wenn es fehlt.
      const f2 = angebot.erstelle(db, { posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf });
      assert.ok(angebot.inRechnung(db, f2.nr).angebot.angenommen_am, 'inRechnung ohne angenommen_am');
      // Der Ingest haelt eine Transaktion ueber ein await offen; ein Statuswechsel
      // in diesem Fenster darf nicht an einem eigenen BEGIN scheitern.
      db.exec('BEGIN');
      try {
        assert.doesNotThrow(() => angebot.setzeStatus(db, e.nr, 'abgelehnt'), 'Statuswechsel scheitert bei offener Ingest-Transaktion');
      } finally { db.exec('COMMIT'); }
      angebot.setzeStatus(db, e.nr, 'offen');
      // Ein kaputter Stand wird abgewiesen, ohne etwas zu schreiben.
      assert.throws(() => angebot.setzeStatus(db, e.nr, 'abgelehnt', { gueltig_bis: 'gestern' }), /kein gueltiger Zeitpunkt/, 'kaputter Stand angenommen');
      assert.strictEqual(angebot.lade(db, e.nr).status, 'offen', 'kaputter Stand hat den Status geaendert');
      assert.throws(() => angebot.setzeStatus(db, e.nr, 'offen', { gueltig_bis: '+275760-09-13T00:00:00.000Z' }), /erlaubten Bereichs/, 'Jahr ausserhalb angenommen');
      assert.throws(() => angebot.setzeStatus(db, e.nr, 'offen', { gueltig_bis: vorE.gueltig_bis, angenommen_am: vorE.gueltig_bis }), /passt nicht/, 'Zeitpunkt zum falschen Status angenommen');
      // lead wirkt nur als Rueckgaengig einer Annahme: auf einem offenen Angebot bleibt der Kunde Kunde.
      const kunde5 = kontakte.speichere(db, { firma: 'Fuenfte GmbH' });
      const g5 = angebot.erstelle(db, { posten: [{ bezeichnung: 'X', stunden: 1 }], empfaenger: empf, kontaktId: kunde5.id });
      kontakte.macheKunde(db, kunde5.id);
      angebot.setzeStatus(db, g5.nr, 'abgelehnt', { gueltig_bis: g5.gueltig_bis, abgelehnt_am: g5.gueltig_bis, lead: true });
      assert.strictEqual(kontakte.lade(db, kunde5.id).status, 'kunde', 'lead ohne vorherige Annahme hat einen Kunden zurueckgestuft');

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
    // Der Schalter nimmt nur true/false: aus dem Text 'false' wuerde sonst !!'false' = an.
    for (const roh of ['false', '0', 1]) assert.throws(() => setzeStammdaten({ kleinunternehmer: roh }), /Kleinunternehmer/, JSON.stringify(roh) + ' als Schalter angenommen');
    assert.strictEqual(config.rechnung.kleinunternehmer, true, 'abgelehnter Schalter hat den Wert veraendert');

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

    // Die Oberflaeche kommt ohne Neustart aus public/: eine dort geaenderte
    // Datei muss die Kennung sofort verschieben, sonst bleibt ein alter Tab
    // unbemerkt auf dem alten Stand.
    const probe = path.join(__dirname, '..', 'public', 'app', '.stand-probe.tmp');
    try {
      fs.writeFileSync(probe, '');
      const spaeter = Date.now() / 1000 + 3600;
      fs.utimesSync(probe, spaeter, spaeter);
      const d3 = await (await fetch(`http://127.0.0.1:${port}/api/summary`)).json();
      assert.notStrictEqual(d3.codeStand, d.codeStand, 'Oberflaechen-Aenderung ohne Neustart verschiebt die Kennung nicht');
    } finally { fs.rmSync(probe, { force: true }); }
    const d4 = await (await fetch(`http://127.0.0.1:${port}/api/summary`)).json();
    assert.strictEqual(d4.codeStand, d.codeStand, 'Kennung kehrt nach Entfernen der Probe nicht zurueck');
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

// --- Diagramm-Bausteine der neuen Oberflaeche ------------------------------
// Die Builder liefern SVG-Pfade aus Zahlen. Ein NaN im Pfad laesst den Browser
// das ganze Element stumm verwerfen — die Karte ist dann leer, ohne Fehler.
function testChartBausteine() {
  const C = require('../public/app/charts.js');
  const ohneNaN = (s, wo) => assert.ok(!/NaN|Infinity/.test(String(s)), wo + ': ' + s);

  assert.strictEqual(C.smooth([[0, 10], [10, 0]]), 'M0.0,10.0 C5.0,10.0 5.0,0.0 10.0,0.0');

  const a = C.area([0, 10], 100, 50, 6);
  assert.ok(a.line.startsWith('M0.0,50.0'), 'Fläche beginnt nicht auf der Grundlinie: ' + a.line);
  assert.ok(a.line.endsWith('100.0,6.0'), 'Höchster Wert liegt nicht am oberen Rand: ' + a.line);
  assert.ok(a.fill.endsWith(' L100,50 L0,50 Z'), 'Fläche wird nicht geschlossen: ' + a.fill);
  ohneNaN(C.area([0, 0, 0], 100, 50).fill, 'Fläche nur Nullen');
  ohneNaN(C.area([5], 100, 50).fill, 'Fläche ein Wert');
  ohneNaN(C.area([], 100, 50).fill, 'Fläche ohne Werte');

  // Ring: Anteile stimmen, Laengen plus Luecken ergeben je den Umfang.
  const r = C.ring([{ v: 1 }, { v: 3 }], 10);
  const U = 2 * Math.PI * 10;
  assert.strictEqual(r[0].anteil, 0.25);
  assert.strictEqual(r[1].anteil, 0.75);
  for (const s of r) {
    const [len, rest] = s.dash.split(' ').map(Number);
    assert.ok(Math.abs(len + rest - U) < 0.02, 'Strich+Lücke ≠ Umfang: ' + s.dash);
  }
  assert.ok(Math.abs(Number(r[1].off) + 0.25 * U) < 0.02, 'zweites Segment beginnt nicht nach dem ersten');
  for (const s of C.ring([{ v: 0 }, { v: 0 }], 10)) ohneNaN(s.dash + s.off, 'Ring ohne Werte');

  const p0 = C.arcPt(0, 0, 10, 0), p5 = C.arcPt(0, 0, 10, 0.5), p1 = C.arcPt(0, 0, 10, 1);
  assert.ok(Math.abs(p0[0] + 10) < 1e-9 && Math.abs(p0[1]) < 1e-9, 'Bogen 0 liegt nicht links');
  assert.ok(Math.abs(p5[0]) < 1e-9 && Math.abs(p5[1] + 10) < 1e-9, 'Bogen 0,5 liegt nicht oben');
  assert.ok(Math.abs(p1[0] - 10) < 1e-9, 'Bogen 1 liegt nicht rechts');

  // Gauge (Marge im Detail): klemmt, bleibt ohne Wert leer, Ziel auf dem Bogen.
  const g = C.gauge(30, 60, 30);
  assert.ok(/^M24\.0,112\.0 A86,86 0 0 1 196\.0,112\.0$/.test(g.bahn), 'Gauge-Bahn ' + g.bahn);
  assert.ok(g.wert.endsWith('110.0,26.0'), 'Gauge bei Hälfte nicht oben: ' + g.wert);
  assert.deepStrictEqual(g.zielPt, [110, 26]);
  assert.strictEqual(C.gauge(null).wert, '', 'ohne Marge kein Zeiger');
  assert.ok(C.gauge(-20).wert.endsWith('24.0,112.0') && C.gauge(500).wert.endsWith('196.0,112.0'), 'Gauge klemmt nicht');
  assert.strictEqual(C.gauge(10, 60, null).zielPt, null);

  // Wasserfall: jede Abzugsstufe endet dort, wo die naechste beginnt.
  const wf = C.wasserfall([{ l: 'Erlös', v: 100, summe: true }, { l: 'Abo', v: 10, neg: true },
    { l: 'Zeit', v: 50, neg: true }, { l: 'Marge', v: 40, summe: true }], 400, 216);
  for (const b of wf) ohneNaN(b.x + b.y + b.h + b.w, 'Wasserfall');
  const unten = (b) => Number(b.y) + Number(b.h);
  assert.ok(Math.abs(Number(wf[0].y) - 16) < 0.05 && Math.abs(unten(wf[0]) - 216) < 0.05, 'Erlös füllt nicht die Höhe');
  assert.ok(Math.abs(Number(wf[1].y) - Number(wf[0].y)) < 0.05, 'Abo beginnt nicht oben am Erlös');
  assert.ok(Math.abs(unten(wf[1]) - Number(wf[2].y)) < 0.05, 'Zeit beginnt nicht unter Abo');
  assert.ok(Math.abs(unten(wf[2]) - Number(wf[3].y)) < 0.05, 'Marge endet nicht unter Zeit');
  assert.ok(Math.abs(Number(wf[3].h) - 80) < 0.05, 'Marge-Höhe ' + wf[3].h + ' statt 80');
  const wfNeg = C.wasserfall([{ l: 'E', v: 10, summe: true }, { l: 'K', v: 30, neg: true }, { l: 'M', v: -20, summe: true }], 300, 116);
  for (const b of wfNeg) ohneNaN(b.y + b.h, 'Wasserfall negativ');
  assert.ok(Math.abs(unten(wfNeg[2]) - 116) < 0.05, 'negative Marge reicht nicht bis unten');
  for (const b of C.wasserfall([{ l: 'x', v: 0, summe: true }], 400, 200)) ohneNaN(b.y + b.h, 'Wasserfall nur 0');

  // heatmap (Analyse, Aktivitaet): 12 Wochen x 7 Tage, Montag oben, Stufen nach Werten.
  const tage84 = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 6, 13 + i));                    // Mo 13.07.2026 …
    return { day: d.toISOString().slice(0, 10), v: i % 7 === 6 ? 0 : (i % 5) + 1 };
  });
  const hm = C.heatmap(tage84, { wochen: 12, bis: '2026-10-04' });   // So 04.10.
  assert.strictEqual(hm.zellen.length, 84, 'Zellen ' + hm.zellen.length);
  assert.strictEqual(hm.zellen[0].day, '2026-07-13', 'erste Zelle ist nicht der Montag');
  assert.strictEqual(hm.zellen[6].day, '2026-07-19', 'Spalte endet nicht am Sonntag');
  assert.strictEqual(hm.zellen[6].stufe, 0, 'leerer Tag nicht Stufe 0');
  assert.ok(hm.zellen.every((z) => z.stufe == null || (z.stufe >= 0 && z.stufe <= 4)), 'Stufe ausserhalb 0–4');
  assert.strictEqual(Math.max(...hm.zellen.map((z) => z.stufe || 0)), 4, 'Hoechstwert nicht Stufe 4');
  assert.strictEqual(hm.monate.length, 12);
  assert.strictEqual(hm.monate[0], 6, 'erste Spalte nennt den Juli nicht');
  const hmZukunft = C.heatmap(tage84.slice(0, 80), { wochen: 12, bis: '2026-10-01' });   // Do
  assert.strictEqual(hmZukunft.zellen[83].stufe, null, 'Tag nach "bis" ist nicht leer markiert');
  assert.ok(C.heatmap([], { wochen: 2, bis: '2026-10-04' }).zellen.every((z) => z.stufe === 0), 'ohne Daten nicht alles Stufe 0');
  // Gleiche Werte bekommen den hoechsten Rang ihrer Gruppe: lauter gleiche Tage sind voll, nicht blass.
  const gleich = C.heatmap([{ day: '2026-09-28', v: 2 }, { day: '2026-09-29', v: 2 }], { wochen: 1, bis: '2026-10-04' });
  assert.deepStrictEqual(gleich.zellen.slice(0, 2).map((z) => z.stufe), [4, 4], 'gleiche Werte nicht Stufe 4');

  // Gestapelt: Obergrenze ueber der hoechsten Tagessumme, eine Schicht je Reihe.
  const st = C.stacked([{ vals: [1, 2, 3] }, { vals: [3, 2, 1] }], 300, 100);
  assert.strictEqual(st.layers.length, 2);
  assert.ok(Math.abs(st.max - 4 * 1.05) < 1e-9, 'Obergrenze ' + st.max);
  for (const l of st.layers) ohneNaN(l.d, 'Stapel');
  for (const l of C.stacked([{ vals: [2] }], 300, 100).layers) ohneNaN(l.d, 'Stapel mit einem Tag');
  for (const l of C.stacked([{ vals: [0, 0] }], 300, 100).layers) ohneNaN(l.d, 'Stapel nur Nullen');

  // Sankey: was links hineinfliesst, kommt rechts in derselben Hoehe an.
  const sk = C.sankey(
    [[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], [{ id: 'z', label: 'Z' }]],
    [{ s: 'a', t: 'z', v: 30 }, { s: 'b', t: 'z', v: 10 }], 960, 340, 10, 8);
  const h = (id) => Number(sk.nodes.find((n) => n.label === id).h);
  assert.ok(Math.abs(h('A') + h('B') - h('Z')) < 0.2, 'Zufluss ' + (h('A') + h('B')) + ' ≠ Knoten ' + h('Z'));
  assert.ok(Math.abs(h('A') / h('B') - 3) < 0.01, 'Verhältnis 30:10 nicht erhalten');
  assert.strictEqual(sk.paths.length, 2);
  for (const pa of sk.paths) ohneNaN(pa.d, 'Sankey');
  ohneNaN(JSON.stringify(C.sankey([[{ id: 'a', label: 'A' }], [{ id: 'z', label: 'Z' }]], [], 960, 340, 10, 8)), 'Sankey ohne Fluss');
  // Beschriftungen kleiner Knoten liegen mindestens 17 Einheiten (eine Zeile) auseinander
  // und bleiben im Bild; ein grosser Knoten behaelt seine Mitte.
  const klein = C.sankey([[{ id: 'g', label: 'G' }, { id: 'k1', label: 'K1' }, { id: 'k2', label: 'K2' }, { id: 'k3', label: 'K3' }], [{ id: 'z', label: 'Z' }]],
    [{ s: 'g', t: 'z', v: 1000 }, { s: 'k1', t: 'z', v: 1 }, { s: 'k2', t: 'z', v: 1 }, { s: 'k3', t: 'z', v: 1 }], 960, 340, 10, 2);
  const ly = (id) => Number(klein.nodes.find((n) => n.label === id).ly);
  const mitte = (id) => { const n = klein.nodes.find((x) => x.label === id); return Number(n.y) + Number(n.h) / 2; };
  assert.ok(Math.abs(ly('G') - mitte('G')) < 0.2, 'grosser Knoten verschoben');
  for (const [a, b] of [['G', 'K1'], ['K1', 'K2'], ['K2', 'K3']]) assert.ok(ly(b) - ly(a) >= 17 - 0.1, a + '/' + b + ' zu dicht: ' + ly(a) + ' ' + ly(b));
  assert.ok(ly('K3') <= 340 - 9, 'unten aus dem Bild: ' + ly('K3'));
  // dieselben kleinen Knoten oben in der Spalte: Abstand nach unten, nicht ueber den Rand
  const oben = C.sankey([[{ id: 'k1', label: 'K1' }, { id: 'k2', label: 'K2' }, { id: 'k3', label: 'K3' }, { id: 'g', label: 'G' }], [{ id: 'z', label: 'Z' }]],
    [{ s: 'g', t: 'z', v: 1000 }, { s: 'k1', t: 'z', v: 1 }, { s: 'k2', t: 'z', v: 1 }, { s: 'k3', t: 'z', v: 1 }], 960, 340, 10, 2);
  const lo = (id) => Number(oben.nodes.find((n) => n.label === id).ly);
  assert.ok(lo('K1') >= 9, 'oben aus dem Bild: ' + lo('K1'));
  for (const [a, b] of [['K1', 'K2'], ['K2', 'K3'], ['K3', 'G']]) assert.ok(lo(b) - lo(a) >= 17 - 0.1, 'oben ' + a + '/' + b + ' zu dicht: ' + lo(a) + ' ' + lo(b));

  // Margen-Ampel: dieselben Stufen wie in der bisherigen Oberflaeche.
  const k = (p) => C.margeKlasse(p, 32);
  // Je Stufe ein Wert an beiden Kanten, sonst faellt eine verschobene Grenze nicht auf.
  assert.deepStrictEqual(
    [k(40), k(32.1), k(32.03), k(32), k(31.9), k(30), k(29.9), k(28), k(27.9), k(25.1), k(25), k(null)],
    ['m-top', 'm-top', 'm-ok', 'm-ok', 'm-fast', 'm-fast', 'm-knapp', 'm-knapp', 'm-schwach', 'm-schwach', 'm-bad', '']);
  assert.strictEqual(C.margeKlasse(5, 0), 'pos');
}

// Globaler Zeitraum der neuen Oberflaeche. Die Vorperiode ist gleich lang
// ("bis heute" gegen "bis zum selben Tag davor"), sonst vergleicht der
// Delta-Pfeil fuenf Oktobertage mit dem ganzen September und zeigt immer rot.
function testZeitraum() {
  const { zeitraum } = require('../public/app/kern.js');
  const heute = new Date(2026, 9, 5); // Montag, 05.10.2026
  const z = (art, extra) => {
    const r = zeitraum(art, heute, extra);
    return [r.von, r.bis, r.vorVon, r.vorBis].join(' ');
  };
  assert.strictEqual(z('heute'), '2026-10-05 2026-10-05 2026-10-04 2026-10-04');
  assert.strictEqual(z('woche'), '2026-10-05 2026-10-05 2026-09-28 2026-09-28');
  assert.strictEqual(z('monat'), '2026-10-01 2026-10-05 2026-09-01 2026-09-05');
  assert.strictEqual(z('letzter'), '2026-09-01 2026-09-30 2026-08-01 2026-08-31');
  assert.strictEqual(z('quartal'), '2026-10-01 2026-10-05 2026-07-01 2026-07-05');
  assert.strictEqual(z('jahr'), '2026-01-01 2026-10-05 2025-01-01 2025-10-05');
  assert.strictEqual(z('frei', { von: '2026-09-10', bis: '2026-09-19' }),
    '2026-09-10 2026-09-19 2026-08-31 2026-09-09');
  // Monatsende: der 31.03. vergleicht mit dem ganzen Februar, nicht mit dem 03.03.
  const r = zeitraum('monat', new Date(2026, 2, 31));
  assert.strictEqual(r.vorVon + ' ' + r.vorBis, '2026-02-01 2026-02-28');
  // Sonntag gehoert zur laufenden Woche (Montag bis Sonntag).
  const so = zeitraum('woche', new Date(2026, 9, 4));
  assert.strictEqual(so.von + ' ' + so.bis, '2026-09-28 2026-10-04');
  // Unbekannte Art faellt auf den Monat zurueck statt auf "alles".
  assert.strictEqual(zeitraum('quatsch', heute).von, '2026-10-01');
  // Gesamt: vom ersten Tag mit Daten bis heute, ohne Vorperiode (es gibt keine davor).
  const g = zeitraum('gesamt', heute, {}, '2026-08-17');
  assert.deepStrictEqual([g.von, g.bis, g.vorVon, g.vorBis], ['2026-08-17', '2026-10-05', null, null]);
  // Vor dem ersten Laden ist der erste Tag unbekannt: Jahresanfang statt Absturz.
  assert.strictEqual(zeitraum('gesamt', heute, {}).von, '2026-01-01');
  assert.strictEqual(zeitraum('gesamt', heute, {}, 'kaputt').von, '2026-01-01', 'kaputter erster Tag angenommen');
}

// Sparkline "Nach Projekt" (Analyse): Dollar je Tag und Projekt, mit und ohne
// Vorgang. Summe je Projekt = byProject, sonst zeigt die Linie andere Kosten
// als die Zeile daneben.
function testVerlaufJeProjekt() {
  const { db, zeile } = zeitDb();
  zeile('s1', 0, 'P', 'ABC-1'); zeile('s1', 24 * 60, 'P', null); zeile('s2', 0, 'Q', 'XYZ-9'); zeile('s2', 5, 'Q', 'XYZ-9');
  const v = metrics.verlaufJeProjekt(db, {});
  assert.deepStrictEqual(v.P.map((x) => x[0]), ['2026-08-18', '2026-08-19'], 'ticketlose Arbeit zaehlt mit');
  assert.deepStrictEqual(v.Q.map((x) => x[0]), ['2026-08-18'], 'ein Eintrag je Tag');
  for (const p of metrics.byProject(db, {})) {
    assert.ok(Math.abs(v[p.project].reduce((a, x) => a + x[1], 0) - p.cost_usd) < 1e-9, 'Summe ' + p.project);
  }
  assert.strictEqual(metrics.verlaufJeProjekt(db, { from: '2026-08-19' }).Q, undefined, 'Zeitfilter');
  db.close();
}

// Kosten je aktive Stunde ueber mehrere Wochen: Summe USD durch Summe Stunden,
// nicht Mittel der Wochenwerte. Wochen ohne Zeit zaehlen ihre Kosten mit.
function testUsdJeStunde() {
  const w = [{ cost_usd: 10, active_seconds: 3600 }, { cost_usd: 30, active_seconds: 7200 }, { cost_usd: 5, active_seconds: 0 }];
  assert.ok(Math.abs(metrics.usdJeStunde(w) - 15) < 1e-9, 'Schnitt ' + metrics.usdJeStunde(w));
  assert.strictEqual(metrics.usdJeStunde([{ cost_usd: 5, active_seconds: 0 }]), null, 'ohne Zeit kein Wert');
  assert.strictEqual(metrics.usdJeStunde([]), null);
  assert.ok(Math.abs(metrics.usdJeStunde([w[1]]) - 15) < 1e-9, 'eine Periode = ihr eigener Wert');
}

// Freie Kachelgroesse (Hub + Analyse): Breite und Hoehe kommen aus dem
// Browser-Speicher und landen im style-Attribut. Nur ganze Zahlen in festen
// Grenzen kommen durch, alles andere heisst Auto.
// Wochen-Marge als Zeichnung: Balken = Abstand zur Zielmarge in Pp, eine
// Woche ohne Marge (kein Erloes oder Selbstkostensatz) hat keinen Balken
// statt einer 0-%-Saeule. Analyse-Karte und Hub-Widget nutzen dieselbe.
function testMargeWochenZeichnung() {
  const C = require('../public/app/charts.js');
  const wo = (montag, marge, ziel = 30) => ({ montag, kennzahlen: { wert: { marge_prozent: marge, zielmarge_prozent: ziel } } });
  const M = C.margeWochen([wo('2025-12-29', 40), wo('2026-01-05', null), wo('2026-01-12', 20)]);
  assert.strictEqual(M.ziel, 30);
  assert.strictEqual(M.leer, false);
  assert.strictEqual(M.balken.length, 2, 'Woche ohne Marge hat einen Balken: ' + JSON.stringify(M.balken));
  // +10 und −10 Pp: gleich hoch, einer endet an der Ziellinie (y 110) von oben, einer beginnt dort.
  assert.deepStrictEqual([M.balken[0].y, M.balken[0].h, M.balken[0].farbe], [10, 100, 'var(--ok)']);
  assert.deepStrictEqual([M.balken[1].y, M.balken[1].h, M.balken[1].farbe], [110, 100, 'var(--bad)']);
  assert.deepStrictEqual(M.achse.map((a) => a.v), [10, null, -10]);
  assert.deepStrictEqual(M.achse.map((a) => a.text), ['+10', '–', '-10']);
  // Knapp unter Ziel (−0,3 Pp) gerundet ist 0, nicht „-0“.
  assert.deepStrictEqual(C.margeWochen([wo('2026-01-05', 29.7), wo('2026-01-12', 40)]).achse.map((a) => a.text), ['0', '+10']);
  assert.deepStrictEqual(M.achse.map((a) => a.kw), [1, 2, 3], 'ISO-KW über den Jahreswechsel');
  assert.strictEqual(C.kw('2026-12-28'), 53, '2026 hat 53 ISO-Wochen');
  assert.ok(M.linie.startsWith('M'), 'Linie fehlt');

  // Ohne Zielmarge wird die Marge selbst gezeichnet.
  const O = C.margeWochen([wo('2026-01-05', 12, null), wo('2026-01-12', -3, null)]);
  assert.strictEqual(O.ziel, null);
  assert.deepStrictEqual(O.achse.map((a) => a.v), [12, -3]);

  // Keine Woche mit Marge: leer, keine Balken, kein NaN.
  const L = C.margeWochen([wo('2026-01-05', null), wo('2026-01-12', null)]);
  assert.strictEqual(L.leer, true);
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(L)), JSON.stringify(L));
  assert.strictEqual(C.margeWochen([]).leer, true);
}

function testKachelGroesse() {
  const { kachelGroesse } = require('../public/app/kern.js');
  assert.deepStrictEqual(kachelGroesse({ w: 480, h: 300 }), { w: 480, h: 300 });
  assert.deepStrictEqual(kachelGroesse({ w: 480 }), { w: 480 });
  assert.deepStrictEqual(kachelGroesse({ h: 300 }), { h: 300 });
  assert.deepStrictEqual(kachelGroesse({ w: 120, h: 80 }), { w: 120, h: 80 });
  assert.deepStrictEqual(kachelGroesse({ w: 2000, h: 1600 }), { w: 2000, h: 1600 });
  // ungueltige Achse faellt einzeln weg, die gueltige bleibt
  assert.deepStrictEqual(kachelGroesse({ w: 119, h: 300 }), { h: 300 });
  assert.deepStrictEqual(kachelGroesse({ w: 480, h: 1601 }), { w: 480 });
  for (const roh of [null, undefined, 3, 'x', [], {}, { w: '480' }, { w: NaN }, { w: 480.5 },
    { w: -480 }, { w: Infinity }, { w: 2001, h: 79 }, { w: '1px;background:url(x)' }, { h: '<b>' }]) {
    assert.strictEqual(kachelGroesse(roh), null, JSON.stringify(roh));
  }
}

// Betrag aus einem Eingabefeld (Zahlung buchen). Deutsch wie englisch getippt,
// mit Euro-Zeichen und Leerzeichen; alles andere ist keine Zahl.
function testBetragAus() {
  const { betragAus } = require('../public/app/kern.js');
  for (const [ein, aus] of [
    ['1.234,56', 1234.56], ['1234,56', 1234.56], ['1234.56', 1234.56], ['12', 12], ['12,5', 12.5],
    [' 99,90 € ', 99.9], ['1.234', 1234], ['1.234.567,8', 1234567.8], ['0,01', 0.01], ['1,234.56', 1234.56],
  ]) assert.strictEqual(betragAus(ein), aus, JSON.stringify(ein) + ' → ' + betragAus(ein));
  for (const ein of ['', 'abc', '12,3,4', '1.2.3', '--5', '5-', null, undefined, '1e5', '0x10']) {
    assert.ok(Number.isNaN(betragAus(ein)), JSON.stringify(ein) + ' ergab ' + betragAus(ein));
  }
}

// Verschieben im Raster: nach links landet die Kachel vor dem Ziel, nach rechts
// dahinter — sonst bleibt sie beim Ziehen nach rechts auf ihrem Platz.
function testVerschiebe() {
  const { verschiebe } = require('../public/app/kern.js');
  const L = ['a', 'b', 'c', 'd'];
  assert.deepStrictEqual(verschiebe(L, 'c', 'a'), ['c', 'a', 'b', 'd'], 'nach links');
  assert.deepStrictEqual(verschiebe(L, 'a', 'b'), ['b', 'a', 'c', 'd'], 'Nachbar rechts');
  assert.deepStrictEqual(verschiebe(L, 'a', 'd'), ['b', 'c', 'd', 'a'], 'ganz nach rechts');
  assert.deepStrictEqual(verschiebe(L, 'b', null), ['a', 'c', 'd', 'b'], 'ans Ende (+-Kachel)');
  assert.deepStrictEqual(verschiebe(L, 'x', 'b'), ['a', 'x', 'b', 'c', 'd'], 'aus dem Katalog vor das Ziel');
  assert.deepStrictEqual(verschiebe(L, 'b', 'b'), L, 'auf sich selbst');
  assert.deepStrictEqual(L, ['a', 'b', 'c', 'd'], 'Eingabe veraendert');
}

// Kennzahlen des Zeitraums (Hub): Summe ueber Vorgaenge und ticketlose Arbeit,
// gerechnet mit derselben mehrwert()-Formel wie je Vorgang. Abgerechnet und
// offen teilen den Arbeitswert ohne Rest auf.
function testKennzahlenZeitraum() {
  const config = require('../config.json');
  const aboKurs = String(config.aboWaehrung).toUpperCase() === 'EUR' ? 1 : config.usdToEur;
  const merk = { s: config.selbstkostenStunde, z: config.zielmargeProzent };
  try {
    config.selbstkostenStunde = 50;
    config.zielmargeProzent = 32;
    const zeilen = [
      { ticket: 'A-1', arbeitswert: 600, active_hours: 6, agent_hours: 9, api_gegenwert_usd: 0, abo_anteil_usd: 60 / aboKurs },
      { ticket: 'A-2', arbeitswert: 300, active_hours: 3, agent_hours: 4, api_gegenwert_usd: 0, abo_anteil_usd: 30 / aboKurs },
      { gruppe: 'Projekt X', arbeitswert: 100, active_hours: 1, agent_hours: 2, api_gegenwert_usd: 0, abo_anteil_usd: 10 / aboKurs },
    ];
    const abrechnung = Object.create(null);
    abrechnung['A-1'] = { betrag_eur: 999, nummern: ['2026-0001'] };
    const k = metrics.kennzahlen(zeilen, abrechnung);

    // Gesamt wie ein einziger Vorgang mit den Summen.
    const ref = metrics.mehrwert({ arbeitswert: 1000, active_hours: 10, api_gegenwert_usd: 0, abo_anteil_usd: 100 / aboKurs }, 0);
    assert.ok(Math.abs(k.wert.marge - ref.marge) < 1e-9, 'Marge ' + k.wert.marge + ' ≠ ' + ref.marge);
    // 1000 − 100 Abo − 10 h × 50 = 400 → 40 %
    assert.ok(Math.abs(k.wert.marge - 400) < 1e-6, 'Marge muss 400 sein: ' + k.wert.marge);
    assert.ok(Math.abs(k.wert.marge_prozent - 40) < 1e-6);
    // Der Rechnungsbetrag (999) ersetzt NICHT den Arbeitswert im Zeitraum:
    // die Rechnung kann Zeit ausserhalb des Zeitraums enthalten.
    assert.strictEqual(k.wert.erloes_ist_rechnung, false);
    // Abgerechnet = Arbeitswert der Vorgaenge mit Rechnung; offen = Rest.
    assert.strictEqual(k.abgerechnet_eur, 600);
    assert.strictEqual(k.offen_eur, 400);
    assert.strictEqual(k.offen_vorgaenge, 1, 'nur A-2 ist ein offener Vorgang (Projekt X hat keinen)');
    assert.strictEqual(k.abgerechnet_vorgaenge, 1, 'nur A-1 ist abgerechnet');
    // "Offen" teilt sich in Vorgaenge und ticketlose Arbeit (Status-Bereich).
    assert.strictEqual(k.offen_vorgang_eur, 300, 'offen auf Vorgaengen');
    assert.strictEqual(k.ohne_vorgang_eur, 100, 'ohne Vorgang');
    assert.strictEqual(k.offen_vorgang_eur + k.ohne_vorgang_eur, k.offen_eur, 'Teile ergeben offen');
    assert.strictEqual(k.aktive_stunden, 10);
    assert.strictEqual(k.agent_stunden, 15);

    // Ein Vorgang namens __proto__ ist ein normaler Schluessel, kein Treffer.
    const k2 = metrics.kennzahlen([{ ticket: '__proto__', arbeitswert: 5, active_hours: 0 }], {});
    assert.strictEqual(k2.abgerechnet_eur, 0);
    // Ohne Zeilen: Nullen statt NaN.
    const leer = metrics.kennzahlen([], Object.create(null));
    assert.strictEqual(leer.offen_eur, 0);
    assert.strictEqual(leer.wert.marge, null, 'ohne Erlös keine Marge');
  } finally {
    config.selbstkostenStunde = merk.s;
    config.zielmargeProzent = merk.z;
  }
}

// Live-Strom (Hub, Seitenleiste, Live): Tokens je Minute der letzten Stunde,
// aelteste zuerst, die laufende Minute zuletzt.
function testLiveMinuten() {
  const jetzt = Date.now();
  const { db, zeile } = zeitDb(jetzt - 60 * 60000);
  zeile('s1', 60, 'P', null);         // laufende Minute
  zeile('s1', 55, 'P', null);         // vor 5 Minuten
  zeile('s2', 55, 'P', null);         // gleiche Minute, zweite Sitzung
  zeile('s1', -30, 'P', null);        // vor 90 Minuten: ausserhalb
  const m = metrics.live(db, { minutes: 60 }).minuten;
  assert.strictEqual(m.length, 60, 'nicht 60 Minuten: ' + m.length);
  assert.strictEqual(m[59], 20, 'laufende Minute ' + m[59] + ' statt 20 Tokens');
  assert.strictEqual(m[54], 40, 'vor 5 Min ' + m[54] + ' statt 40 Tokens');
  assert.strictEqual(m.reduce((a, b) => a + b, 0), 60, 'Summe enthaelt Requests ausserhalb der Stunde');
  db.close();
}

// Cache-Ersparnis: was die gelesenen Cache-Tokens als normale Eingabe gekostet
// haetten, minus was sie als Cache-Lesen kosten. Je Modell mit dessen Preis.
function testCacheErsparnis() {
  const voll = pricing.costOf('claude-opus-5', { input_tokens: 1e6 });
  const cache = pricing.costOf('claude-opus-5', { cache_read: 1e6 });
  const e = metrics.cacheErsparnis([{ model: 'claude-opus-5', cache_read_tokens: 1e6 }]);
  assert.ok(Math.abs(e - (voll - cache)) < 1e-9, 'Ersparnis ' + e + ' ≠ ' + (voll - cache));
  assert.ok(e > 0 && e < voll, 'Ersparnis unplausibel: ' + e);
  assert.strictEqual(metrics.cacheErsparnis([]), 0);
}

// Spuren je Sitzung (Live): abrechenbare Fenster um eigene Eingaben und
// Agentenzeit, in Minuten seit Beginn der letzten Stunde.
function testLiveSpuren() {
  mitZeitmodell(5, 'eingaben', () => {
    const jetzt = Date.now();
    const { db, zeile, aktiv } = zeitDb(jetzt - 60 * 60000);
    zeile('s1', 30, 'P', null, 1);        // Eingabe bei Minute 30 -> Fenster 27,5..32,5
    aktiv('s1', 31, 'P', null, 0);        // Agent arbeitet weiter (keine Eingabe)
    aktiv('s1', 34, 'P', null, 0);
    aktiv('s1', 50, 'P', null, 0);        // nach 16 Min Pause: neue Spanne
    const s = metrics.live(db, { minutes: 60 }).sessions.find((x) => x.session_id === 's1');
    const f = s.spur.fenster, a = s.spur.agent;
    assert.strictEqual(f.length, 1, 'Fenster: ' + JSON.stringify(f));
    assert.ok(Math.abs(f[0][0] - 27.5) < 0.05 && Math.abs(f[0][1] - 32.5) < 0.05, 'Fenster ' + JSON.stringify(f));
    assert.strictEqual(a.length, 2, 'Agentenspannen: ' + JSON.stringify(a));
    assert.ok(Math.abs(a[0][0] - 30) < 0.05 && Math.abs(a[0][1] - 34) < 0.05, 'Agent ' + JSON.stringify(a));
    db.close();
  });
}

// Cache-Schreiben 5m/1h getrennt bis in die Auswertung: kostet unterschiedlich
// und wird im Detail je Zeile mit Preis gezeigt.
function testCacheGetrenntJeModell() {
  const { db } = zeitDb();
  db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
    input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
    VALUES ('c1','2026-08-18T10:00:00Z','s','P','main','ABC-1','claude-opus-5',0,0,700,300,0,0,0,0,'2026-08-18')`).run();
  const m = metrics.byModel(db, { ticket: 'ABC-1' })[0];
  assert.strictEqual(m.cache_w_5m, 700, '5m ' + m.cache_w_5m);
  assert.strictEqual(m.cache_w_1h, 300, '1h ' + m.cache_w_1h);
  assert.strictEqual(m.cache_write_tokens, 1000, 'Summe ' + m.cache_write_tokens);
  db.close();
}

// Tokens im Detail: Betrag je Art aus der Preisliste des jeweiligen Modells.
// Weicht die Summe von der erfassten ab (Preis geaendert, Modell ohne Preis),
// steht die Differenz offen da statt hochskaliert zu werden.
function testTokenArten() {
  const opus = pricing.priceFor('claude-opus-5');
  const z = metrics.tokenArten([
    { model: 'claude-opus-5', input_tokens: 1e6, output_tokens: 0, cache_w_5m: 1e6, cache_w_1h: 1e6, cache_read_tokens: 0,
      cost_usd: 1e6 * (opus.in + opus.cw5m + opus.cw1h) + 2 },
    { model: 'gibt-es-nicht-xyz', input_tokens: 5, output_tokens: 0, cache_w_5m: 0, cache_w_1h: 0, cache_read_tokens: 0, cost_usd: 0 },
  ]);
  const je = Object.fromEntries(z.zeilen.map((r) => [r.art, r]));
  assert.deepStrictEqual(z.zeilen.map((r) => r.art), ['input', 'output', 'cache_5m', 'cache_1h', 'cache_lesen']);
  assert.ok(Math.abs(je.cache_5m.usd - 1e6 * opus.cw5m) < 1e-9, '5m ' + je.cache_5m.usd);
  assert.ok(Math.abs(je.cache_1h.usd - 1e6 * opus.cw1h) < 1e-9, '1h ' + je.cache_1h.usd);
  assert.ok(je.cache_1h.usd > je.cache_5m.usd, '1h muss teurer sein als 5m');
  assert.strictEqual(je.input.tokens, 1e6 + 5);
  assert.strictEqual(z.tokens, 3e6 + 5);
  assert.ok(Math.abs(z.abweichung_usd - 2) < 1e-9, 'Abweichung ' + z.abweichung_usd);
  assert.ok(Math.abs(z.usd + z.abweichung_usd - z.erfasst_usd) < 1e-9, 'Summe + Abweichung ≠ erfasst');
  assert.deepStrictEqual(metrics.tokenArten([]).zeilen.map((r) => r.usd), [0, 0, 0, 0, 0]);
}

// Sitzungsliste im Detail: Zeit und Dollar je Sitzung ergeben in Summe genau
// die Werte des Vorgangs — sonst zeigt die Liste etwas anderes als der Kopf.
function testSitzungenJeVorgang() {
  mitZeitmodell(5, 'aktivitaet', () => {
    const { db, zeile } = zeitDb();
    zeile('s1', 0, 'P', 'ABC-1'); zeile('s1', 3, 'P', 'ABC-1');
    zeile('s2', 60, 'P', 'ABC-1'); zeile('s2', 64, 'P', 'ABC-1');
    zeile('s3', 0, 'P', 'XYZ-9'); zeile('s3', 2, 'P', 'XYZ-9');      // fremder Vorgang, parallel zu s1
    db.prepare("UPDATE events SET is_sidechain = 1, web_search = 2 WHERE session_id = 's2'").run();
    const liste = metrics.sitzungenJeVorgang(db, 'ABC-1');
    const row = metrics.byTicket(db, { ticket: 'ABC-1' })[0];
    assert.deepStrictEqual(liste.map((s) => s.session_id), ['s1', 's2']);
    assert.ok(row.active_seconds > 0, 'Vorgang ohne Zeit — Test sagt nichts');
    assert.strictEqual(liste.reduce((a, s) => a + s.active_seconds, 0), row.active_seconds, 'Zeit-Summe');
    assert.ok(Math.abs(liste.reduce((a, s) => a + s.cost_usd, 0) - row.cost_usd) < 1e-9, 'USD-Summe');
    assert.strictEqual(liste[0].subagent, false);
    assert.strictEqual(liste[1].subagent, true);
    assert.strictEqual(liste[1].web_suchen, 4);
    assert.deepStrictEqual(liste[0].modelle, ['claude-opus-5']);
    // Sitzung nur mit Aktivitaet (kein Request auf dem Vorgang): Start und
    // Branch kommen aus der Aktivitaet, sonst stuende sie undatiert ganz oben.
    const aktiv = (s, min) => db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)')
      .run(s, new Date(Date.UTC(2026, 7, 18, 10, 0, 0) + min * 60000).toISOString(), 'P', 'feature/ABC-1', 'ABC-1', '2026-08-18', null);
    aktiv('s4', 120); aktiv('s4', 123);
    const mitAktiv = metrics.sitzungenJeVorgang(db, 'ABC-1');
    const s4 = mitAktiv.find((s) => s.session_id === 's4');
    assert.ok(s4 && s4.active_seconds > 0, 's4 fehlt oder ohne Zeit');
    assert.strictEqual(s4.start, '2026-08-18T12:00:00.000Z', 'Start aus Aktivitaet: ' + (s4 && s4.start));
    assert.strictEqual(s4.branch, 'feature/ABC-1');
    assert.deepStrictEqual(mitAktiv.map((s) => s.session_id), ['s1', 's2', 's4'], 'Reihenfolge nach Start');
    db.close();
  });
}

// Sparkline der Vorgangstabelle: Dollar je Tag und Vorgang, Summe = Vorgang.
function testVerlaufJeVorgang() {
  const { db, zeile } = zeitDb();
  zeile('s1', 0, 'P', 'ABC-1'); zeile('s1', 24 * 60, 'P', 'ABC-1'); zeile('s2', 0, 'P', 'XYZ-9');
  const v = metrics.verlaufJeVorgang(db, {});
  assert.deepStrictEqual(v['ABC-1'].map((x) => x[0]), ['2026-08-18', '2026-08-19']);
  const row = metrics.byTicket(db, { ticket: 'ABC-1' })[0];
  assert.ok(Math.abs(v['ABC-1'].reduce((a, x) => a + x[1], 0) - row.cost_usd) < 1e-9, 'Summe');
  assert.strictEqual(metrics.verlaufJeVorgang(db, { from: '2026-08-19' })['XYZ-9'], undefined, 'Zeitfilter');
  db.close();
}

// Ein Request mit frei waehlbarem Modell und Betrag (Analyse-Tests).
function ereignis(db, id, ts, { model = 'claude-opus-5', ticket = null, project = 'P', usd = 1 } = {}) {
  db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
    input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
    VALUES (?,?,?,?,?,?,?,10,10,0,0,0,0,?,0,?)`).run(id, ts, 's-' + id, project, 'main', ticket, model, usd, ts.slice(0, 10));
}

// Perioden mit aktiver Zeit, aber ohne Request fehlten in days/weeks/months.
function testByPeriodNurZeit() {
  mitZeitmodell(5, 'aktivitaet', () => {
    const { db, zeile, aktiv } = zeitDb();
    zeile('s1', 0, 'P', 'ABC-1'); zeile('s1', 2, 'P', 'ABC-1');            // 18.08. mit Request
    aktiv('s2', 24 * 60, 'P', 'ABC-1'); aktiv('s2', 24 * 60 + 3, 'P', 'ABC-1');   // 19.08. nur Aktivitaet
    const tage = metrics.byPeriod(db, {}, 'tag');
    const t19 = tage.find((t) => t.day === '2026-08-19');
    assert.ok(t19, '19.08. fehlt: ' + JSON.stringify(tage.map((t) => t.day)));
    assert.strictEqual(t19.cost_usd, 0);
    assert.ok(t19.active_seconds > 0);
    assert.deepStrictEqual(tage.map((t) => t.day), ['2026-08-18', '2026-08-19'], 'Reihenfolge');
    assert.strictEqual(tage.reduce((a, t) => a + t.active_seconds, 0), metrics.summary(db, {}).active_seconds, 'Zeit-Summe');
    const w = metrics.byPeriod(db, {}, 'woche')[0];
    assert.ok(w.usd_je_stunde > 0 && Math.abs(w.usd_je_stunde - w.cost_usd / (w.active_seconds / 3600)) < 1e-9, 'usd_je_stunde ' + w.usd_je_stunde);
    assert.strictEqual(t19.usd_je_stunde, 0, 'Tag ohne Kosten: 0 USD je Stunde');
    db.close();
  });
}

// Verlauf je Modell: je Periode ergeben die Modellreihen die Periodensumme,
// ab dem fuenften Modell wird zu "andere" zusammengefasst.
function testVerlaufJeModell() {
  const { db } = zeitDb();
  const modelle = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-fable-5', 'claude-opus-4-1', 'gibt-es-nicht-xyz'];
  modelle.forEach((m, i) => {
    ereignis(db, 'a' + i, '2026-08-18T10:0' + i + ':00Z', { model: m, usd: 10 - i });
    ereignis(db, 'b' + i, '2026-08-19T10:0' + i + ':00Z', { model: m, usd: 1 });
  });
  const v = metrics.verlaufJeModell(db, {}, 'tag');
  assert.deepStrictEqual(v.perioden, ['2026-08-18', '2026-08-19']);
  assert.strictEqual(v.modelle.length, 5, 'vier Modelle + andere: ' + v.modelle.length);
  assert.strictEqual(v.modelle[4].model, null, 'Rest heisst nicht null');
  assert.strictEqual(v.modelle[0].model, 'claude-opus-5', 'nicht nach Kosten sortiert');
  const tage = metrics.byPeriod(db, {}, 'tag');
  v.perioden.forEach((d, i) => {
    const s = v.modelle.reduce((a, m) => a + m.werte[i], 0);
    assert.ok(Math.abs(s - tage[i].cost_usd) < 1e-9 && Math.abs(v.summe[i] - s) < 1e-9, d + ': ' + s + ' ≠ ' + tage[i].cost_usd);
  });
  assert.ok(Math.abs(v.summe.reduce((a, x) => a + x, 0) - metrics.summary(db, {}).cost_usd) < 1e-9, 'Gesamtsumme');
  db.close();
}

// Sankey: Modell -> Projekt -> Vorgang. Jede Spalte traegt dieselbe Summe,
// Werkzeugbetrieb faellt heraus, ticketlose Arbeit landet bei "ohne Vorgang".
function testFluss() {
  const { db } = zeitDb();
  ereignis(db, 'f1', '2026-08-18T10:00:00Z', { ticket: 'ABC-1', usd: 5 });
  ereignis(db, 'f2', '2026-08-18T10:01:00Z', { ticket: null, usd: 3 });
  ereignis(db, 'f3', '2026-08-18T10:02:00Z', { project: '(lokal)', model: 'claude-sonnet-5', usd: 7 });
  const f = metrics.fluss(db, {});
  const summe = (praefix) => f.links.filter((l) => l.s.startsWith(praefix)).reduce((a, l) => a + l.v, 0);
  assert.ok(Math.abs(f.summe_usd - 8) < 1e-9, 'Summe ' + f.summe_usd);
  assert.ok(Math.abs(summe('m:') - 8) < 1e-9 && Math.abs(summe('p:') - 8) < 1e-9, 'Spalten ' + summe('m:') + '/' + summe('p:'));
  assert.ok(Math.abs(f.summe_usd - metrics.splitOverhead(db, {}).arbeit.cost_usd) < 1e-9, '≠ Projektarbeit');
  assert.ok(!f.links.some((l) => /lokal|sonnet/.test(l.s + l.t)), 'Werkzeugbetrieb im Fluss');
  assert.ok(f.links.some((l) => l.s === 'p:P' && l.t === 'v:ohne:P' && Math.abs(l.v - 3) < 1e-9), 'ticketlos fehlt');
  db.close();
}

// Marge je Woche: dieselbe Formel wie die Hub-Kennzahlen, Woche Mo–So.
function testMargeJeWoche() {
  const { db } = zeitDb();
  ereignis(db, 'w1', '2026-08-18T10:00:00Z', { ticket: 'ABC-1', usd: 5 });   // Di, Woche 17.08.
  ereignis(db, 'w2', '2026-08-23T10:00:00Z', { ticket: 'ABC-1', usd: 2 });   // So, Woche 17.08.
  ereignis(db, 'w3', '2026-08-24T10:00:00Z', { ticket: 'XYZ-9', usd: 4 });   // Mo, Woche 24.08.
  // Nur abgeschlossene Wochen (Owner 06.10., Variante A): am Mittwoch 26.08.
  // endet die Reihe mit der Woche 17.08.; am Sonntag 30.08. ist 24.08. dabei.
  assert.deepStrictEqual(metrics.margeJeWoche(db, { bis: '2026-08-26', wochen: 3 }, {}).map((w) => w.montag),
    ['2026-08-03', '2026-08-10', '2026-08-17'], 'angebrochene Woche gezeigt');
  assert.deepStrictEqual(metrics.margeJeWoche(db, { bis: '2026-08-29', wochen: 1 }, {}).map((w) => w.montag), ['2026-08-17'], 'Samstag');
  const W = metrics.margeJeWoche(db, { bis: '2026-08-30', wochen: 3 }, {});
  assert.deepStrictEqual(W.map((w) => w.montag), ['2026-08-10', '2026-08-17', '2026-08-24'], 'Sonntag schliesst die Woche ab');
  const erwartet = (von, bis) => {
    const o = { from: von, to: bis };
    return metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), {});
  };
  assert.deepStrictEqual(W[1].kennzahlen, erwartet('2026-08-17', '2026-08-23'), 'Woche 17.08.');
  assert.deepStrictEqual(W[2].kennzahlen, erwartet('2026-08-24', '2026-08-30'), 'Woche 24.08.');
  assert.ok(Math.abs(W[1].kennzahlen.wert.api_gegenwert - metrics.usdToEur(7)) < 1e-9, 'Sonntag fehlt in der Woche');
  assert.strictEqual(W[0].kennzahlen.wert.marge_prozent, null, 'leere Woche muss null sein, nicht 0');
  db.close();
}

// --- Zahlungen (Block 4a, Owner 06.10.: Free) --------------------------------
// Eine Zahlung ist kein Dokument: sie haengt an der Rechnung, aendert deren
// Abschrift nie und darf geloescht werden. Was auf dem Konto ankam, bestimmt
// den Status — deshalb wird jede Zahlung an der Rechnung gegengeprueft.
function heuteLokal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function testZahlungen() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };
    const inv = rechnung.erstelle(db, daten);
    const heute = heuteLokal();
    const brutto = inv.brutto_eur;
    assert.ok(brutto > 20, 'Testrechnung zu klein: ' + brutto);
    const anzahlRechnungen = rechnung.liste(db).length;

    const z1 = rechnung.bucheZahlung(db, { nr: inv.nr, datum: heute, betrag_eur: 10.005, notiz: 'Anzahlung' });
    assert.strictEqual(z1.betrag_eur, 10.01, 'Betrag nicht auf Cent gerundet: ' + z1.betrag_eur);
    assert.ok(Number.isInteger(z1.id) && z1.id > 0, 'Zahlung ohne Id');
    assert.strictEqual(rechnung.zahlungenZu(db, inv.nr).length, 1);

    // Ungueltige Eingaben prallen ab und hinterlassen nichts.
    const fehlschlag = [
      [{ betrag_eur: 0 }, 'Betrag 0'],
      [{ betrag_eur: -5 }, 'negativer Betrag'],
      [{ betrag_eur: 'viel' }, 'Text als Betrag'],
      [{ betrag_eur: NaN }, 'NaN'],
      [{ betrag_eur: brutto }, 'Ueberzahlung (Rest ist kleiner)'],
      [{ datum: '2026-13-45' }, 'kein Kalendertag'],
      [{ datum: '06.10.2026' }, 'falsches Format'],
      [{ datum: '2020-01-01' }, 'vor dem Rechnungsdatum'],
      [{ datum: '2999-01-01' }, 'in der Zukunft'],
      [{ notiz: 'x'.repeat(201) }, 'Notiz zu lang'],
      [{ notiz: {} }, 'Notiz kein Text'],
      [{ nr: '../../x' }, 'Nummer mit Pfadanteilen'],
      [{ nr: '1999-9999' }, 'unbekannte Rechnung'],
      [{ nr: [inv.nr] }, 'Nummer als Array (String(["…"]) passt auf die Regex)'],
    ];
    for (const [abw, grund] of fehlschlag) {
      assert.throws(() => rechnung.bucheZahlung(db, { nr: inv.nr, datum: heute, betrag_eur: 5, ...abw }),
        'angenommen: ' + grund);
    }
    assert.strictEqual(rechnung.zahlungenZu(db, inv.nr).length, 1, 'abgelehnte Zahlung wurde trotzdem gespeichert');
    // Nur Text ist eine Nummer: String(["2026-0001"]) passt sonst auf die Regex.
    let geladen;
    try { geladen = rechnung.lade(db, [inv.nr]); } catch (e) { geladen = 'warf: ' + e.message; }
    assert.strictEqual(geladen, null, 'Nummer als Array nicht sauber abgewiesen');

    // Genau der Rest geht, ein Cent Toleranz fuer Rundung auch.
    const rest = Math.round((brutto - 10.01) * 100) / 100;
    rechnung.bucheZahlung(db, { nr: inv.nr, datum: heute, betrag_eur: rest + 0.01 });
    assert.throws(() => rechnung.bucheZahlung(db, { nr: inv.nr, datum: heute, betrag_eur: 0.01 }),
      'Zahlung auf bezahlte Rechnung angenommen');

    // Loeschen: nur bekannte Id, und danach ist der Rest wieder offen.
    const alle = rechnung.zahlungenZu(db, inv.nr);
    rechnung.loescheZahlung(db, alle[1].id);
    assert.strictEqual(rechnung.zahlungenZu(db, inv.nr).length, 1, 'Zahlung nicht geloescht');
    for (const id of [alle[1].id, 99999, 'abc', -1, 1.5]) {
      assert.throws(() => rechnung.loescheZahlung(db, id), 'unbekannte Zahlung geloescht: ' + id);
    }

    // Stornierte Rechnung und Gegenrechnung nehmen keine Zahlung an.
    const storno = rechnung.storniere(db, inv.nr);
    assert.throws(() => rechnung.bucheZahlung(db, { nr: inv.nr, datum: heute, betrag_eur: 1 }), 'Zahlung auf stornierte Rechnung');
    assert.throws(() => rechnung.bucheZahlung(db, { nr: storno.nr, datum: heute, betrag_eur: 1 }), 'Zahlung auf Gegenrechnung');

    // Die Abschrift bleibt unberuehrt, der Nummernkreis auch.
    assert.strictEqual(rechnung.lade(db, inv.nr).brutto_eur, brutto, 'Zahlung hat die Rechnung veraendert');
    assert.strictEqual(rechnung.liste(db).length, anzahlRechnungen + 1, 'Zahlung hat eine Rechnungsnummer verbraucht');
    db.close();
  });
}

function testStatusAusZahlungen() {
  const { statusOf } = require('../rechnung');
  const r = (status, brutto) => ({ status, brutto_eur: brutto });
  assert.strictEqual(statusOf(r('erstellt', 100), 0), 'offen');
  assert.strictEqual(statusOf(r('erstellt', 100), 40), 'teilbezahlt');
  assert.strictEqual(statusOf(r('erstellt', 100), 100), 'bezahlt');
  assert.strictEqual(statusOf(r('erstellt', 100), 99.995), 'bezahlt', 'Rundungscent kippt nicht auf bezahlt');
  assert.strictEqual(statusOf(r('erstellt', 100), 99.98), 'teilbezahlt', 'zwei Cent Rest gelten als bezahlt');
  assert.strictEqual(statusOf(r('storniert', 100), 0), 'storniert');
  assert.strictEqual(statusOf(r('storniert', 100), 100), 'storniert', 'bezahlte, dann stornierte Rechnung steht als bezahlt');
  assert.strictEqual(statusOf(r('storno', -100), 0), 'storno');
  // Ohne Zahlungsdaten (alte Aufrufer) ist eine gestellte Rechnung offen.
  assert.strictEqual(statusOf(r('erstellt', 100)), 'offen');
}

function testRechnungsListe() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };
    const a = rechnung.erstelle(db, daten);
    const b = rechnung.erstelle(db, daten);
    rechnung.bucheZahlung(db, { nr: a.nr, datum: heuteLokal(), betrag_eur: 20 });
    rechnung.bucheZahlung(db, { nr: a.nr, datum: heuteLokal(), betrag_eur: 5.5 });
    const st = rechnung.storniere(db, b.nr);
    // Alte Rechnung ohne gespeicherte Faelligkeit (vor 1.3): wird wie frueher gerechnet.
    db.prepare('UPDATE invoices SET faellig_am = NULL WHERE nr = ?').run(b.nr);

    const L = rechnung.liste(db);
    const zeile = (nr) => L.find((x) => x.nr === nr);
    const za = zeile(a.nr), zb = zeile(b.nr), zs = zeile(st.nr);
    // Felder der 1.4-Liste bleiben (alte Oberflaeche liest sie bis zum Cutover).
    for (const f of ['nr', 'erstellt_am', 'empfaenger', 'brutto_eur', 'status', 'hat_pdf']) {
      assert.ok(f in za, 'Feld fehlt: ' + f);
    }
    assert.strictEqual(za.faellig_am, a.faellig_am);
    assert.strictEqual(zb.faellig_am, rechnung.faelligAm({ ...b, faellig_am: null }), 'Faelligkeit alter Rechnung fehlt');
    assert.strictEqual(za.leistung_von, '2026-08-01');
    assert.strictEqual(za.leistung_bis, '2026-08-31');
    assert.strictEqual(za.netto_eur, a.netto_eur);
    assert.strictEqual(za.gezahlt_eur, 25.5, 'Summe der Zahlungen falsch: ' + za.gezahlt_eur);
    assert.strictEqual(za.rest_eur, Math.round((a.brutto_eur - 25.5) * 100) / 100, 'Rest falsch');
    assert.strictEqual(za.status_abgeleitet, 'teilbezahlt');
    assert.strictEqual(zb.status_abgeleitet, 'storniert');
    assert.strictEqual(zb.rest_eur, 0, 'stornierte Rechnung hat offenen Rest');
    assert.strictEqual(zs.status_abgeleitet, 'storno');
    assert.strictEqual(zs.storno_von, b.nr);
    assert.strictEqual(zs.rest_eur, 0, 'Gegenrechnung hat offenen Rest');
    db.close();
  });
}

function testBelegKennzahlen() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };
    const a = rechnung.erstelle(db, daten);   // wird voll bezahlt
    const b = rechnung.erstelle(db, daten);   // teilbezahlt
    const c = rechnung.erstelle(db, daten);   // offen
    const d = rechnung.erstelle(db, daten);   // storniert
    const heute = heuteLokal();
    rechnung.bucheZahlung(db, { nr: a.nr, datum: heute, betrag_eur: a.brutto_eur });
    rechnung.bucheZahlung(db, { nr: b.nr, datum: heute, betrag_eur: 10 });
    rechnung.storniere(db, d.nr);
    // a ist laut Abschrift 3 Tage vor der Zahlung gestellt worden.
    const vor3 = new Date(Date.now() - 3 * 86400000).toISOString();
    db.prepare('UPDATE invoices SET erstellt_am = ? WHERE nr = ?').run(vor3, a.nr);

    const K = rechnung.kennzahlen(db, { from: '2000-01-01', to: '2999-12-31' });
    const r2 = (n) => Math.round(n * 100) / 100;
    assert.strictEqual(K.gestellt_anzahl, 3, 'Gestellt zaehlt Storno oder Stornierte mit: ' + K.gestellt_anzahl);
    assert.strictEqual(K.gestellt_brutto, r2(a.brutto_eur + b.brutto_eur + c.brutto_eur), 'Gestellt brutto');
    assert.strictEqual(K.offen_eur, r2(b.brutto_eur - 10 + c.brutto_eur), 'Offen gesamt');
    assert.strictEqual(K.bezahlt_eur, r2(a.brutto_eur + 10), 'Bezahlt im Zeitraum');
    assert.strictEqual(K.zahlungsdauer_tage, 3, 'Zahlungsdauer: ' + K.zahlungsdauer_tage);
    assert.strictEqual(K.storniert_anzahl, 1);
    // Plausibel: offen nie negativ und nie groesser als gestellt.
    assert.ok(K.offen_eur >= 0 && K.offen_eur <= K.gestellt_brutto, 'Offen ausserhalb der Grenzen');

    // Zeitraum: Zahlungen nach ihrem Datum, Rechnungen nach dem Tag der Ausstellung.
    // Zeitstempel als Grenze: der Tag selbst gehoert dazu.
    const tag = heuteLokal();
    assert.strictEqual(rechnung.kennzahlen(db, { from: tag + 'T00:00:00', to: tag + 'T00:00:00' }).bezahlt_eur, r2(a.brutto_eur + 10),
      'Zeitstempel als Grenze laesst den Tag fallen');
    const leer = rechnung.kennzahlen(db, { from: '2000-01-01', to: '2000-12-31' });
    assert.strictEqual(leer.gestellt_anzahl, 0);
    assert.strictEqual(leer.bezahlt_eur, 0);
    assert.strictEqual(leer.zahlungsdauer_tage, null, 'ohne bezahlte Rechnung muss die Dauer leer sein, nicht 0');
    assert.strictEqual(leer.offen_eur, K.offen_eur, 'Offene Posten sind ein Bestand und haengen nicht am Zeitraum');
    db.close();
  });
}

async function testRechnungEinzelabruf() {
  const srv = require('../server');
  const rechnung = require('../rechnung');
  rechnungsUmgebung(() => {
    const db = rechnungsDb();
    const inv = rechnung.erstelle(db, { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } });
    rechnung.bucheZahlung(db, { nr: inv.nr, datum: heuteLokal(), betrag_eur: 12 });
    const d = rechnung.detail(db, inv.nr);
    assert.strictEqual(d.nr, inv.nr);
    assert.ok(Array.isArray(d.positionen) && d.positionen.length > 0, 'Positionen fehlen');
    assert.strictEqual(d.zahlungen.length, 1);
    assert.strictEqual(d.gezahlt_eur, 12);
    assert.strictEqual(d.status_abgeleitet, 'teilbezahlt');
    for (const boese of ['../../config', '1999-9999', '', 'abcd-efgh']) {
      assert.strictEqual(rechnung.detail(db, boese), null, '"' + boese + '" geliefert');
    }
    db.close();
  });
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const port = srv.server.address().port;
  try {
    for (const pfad of ['9999-9998', '..%2f..%2fconfig.json', 'abcd-efgh', '%E0%A4%A']) {
      const r = await fetch(`http://127.0.0.1:${port}/api/rechnung/${pfad}`);
      assert.strictEqual(r.status, 404, 'Pfad "' + pfad + '" liefert ' + r.status + ' statt 404');
      // Unbekannte /api/-Pfade antworten auch mit JSON 404 ("Unbekannter
      // Endpunkt") — nur der Text der Route beweist, dass sie geantwortet hat.
      assert.strictEqual((await r.json()).error, 'Rechnung nicht gefunden.', 'Route fehlt oder warf: "' + pfad + '"');
    }
  } finally {
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

// Die Route laeuft gegen die Datenbank des Servers — deshalb hier nur die
// Ablehnungen; der Erfolgsweg ist oben am Modul geprueft (In-Memory).
async function testVorschauRoute() {
  const srv = require('../server');
  const config = require('../config.json');
  const merk = config.rechnung;
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const port = srv.server.address().port;
  const post = async (body) => {
    const r = await fetch(`http://127.0.0.1:${port}/api/beleg-vorschau`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: r.status, d: await r.json() };
  };
  try {
    let a = await post({ art: 'storno' });
    assert.deepStrictEqual([a.status, a.d.error], [400, 'Belegart unbekannt.'], 'unbekannte Belegart: ' + JSON.stringify(a));
    config.rechnung = { ...merk, aussteller: { name: 'Testfirma' } };
    a = await post({ art: 'rechnung' });
    assert.strictEqual(a.status, 422, 'fehlende Stammdaten: ' + a.status);
    assert.ok(Array.isArray(a.d.fehlt) && a.d.fehlt.length === 2, 'fehlt nennt nicht beide Angaben: ' + JSON.stringify(a.d));
    config.rechnung = { ...merk, aussteller: { name: 'Testfirma', anschrift: ['Weg 1'], steuernummer: '1/2/3' } };
    a = await post({ art: 'rechnung', from: '2026-08-01', to: '2026-08-31', empfaenger: { name: 'K' }, posten: [] });
    assert.deepStrictEqual([a.status, a.d.error], [400, 'Keine Vorgaenge oder Positionen gewaehlt.'], 'leere Rechnung: ' + JSON.stringify(a));
    // Gueltige Posten, nur der Kontaktverweis ist kaputt: ohne Pruefung kaeme 200.
    a = await post({ art: 'rechnung', kontaktId: 'x', from: '2026-08-01', to: '2026-08-31',
      empfaenger: { name: 'K' }, posten: [{ bezeichnung: 'X', stunden: 1 }] });
    assert.strictEqual(a.status, 400, 'kaputter Kontaktverweis angenommen: ' + JSON.stringify(a));
  } finally {
    config.rechnung = merk;
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

function testAngebotStatusAbgeleitet() {
  rechnungsUmgebung(() => {
    const angebot = require('../angebot');
    const db = rechnungsDb();
    const empf = { name: 'Kunde' };
    const p = [{ bezeichnung: 'X', stunden: 1, satz: 100 }];
    const offen = angebot.erstelle(db, { posten: p, empfaenger: empf });
    const alt = angebot.erstelle(db, { posten: p, empfaenger: empf });
    const gerade = angebot.erstelle(db, { posten: p, empfaenger: empf });
    const abger = angebot.erstelle(db, { posten: p, empfaenger: empf });
    const abgel = angebot.erstelle(db, { posten: p, empfaenger: empf });
    db.prepare('UPDATE angebote SET gueltig_bis = ? WHERE nr = ?').run(new Date(Date.now() - 60000).toISOString(), alt.nr);
    db.prepare('UPDATE angebote SET gueltig_bis = ? WHERE nr = ?').run(new Date(Date.now() + 60000).toISOString(), gerade.nr);
    angebot.inRechnung(db, abger.nr);
    angebot.setzeStatus(db, abgel.nr, 'abgelehnt');
    const L = angebot.liste(db);
    const s = (nr) => L.find((x) => x.nr === nr).status_abgeleitet;
    assert.strictEqual(s(offen.nr), 'offen');
    assert.strictEqual(s(alt.nr), 'abgelaufen');
    assert.strictEqual(s(gerade.nr), 'offen', 'Angebot vor Ablauf schon abgelaufen');
    assert.strictEqual(s(abger.nr), 'abgerechnet');
    assert.strictEqual(s(abgel.nr), 'abgelehnt');
    // Ein abgerechnetes Angebot laeuft nicht mehr ab.
    db.prepare('UPDATE angebote SET gueltig_bis = ? WHERE nr = ?').run(new Date(Date.now() - 60000).toISOString(), abger.nr);
    assert.strictEqual(angebot.liste(db).find((x) => x.nr === abger.nr).status_abgeleitet, 'abgerechnet');
    // Das alte Feld bleibt fuer die alte Oberflaeche wie es war.
    assert.strictEqual(L.find((x) => x.nr === abger.nr).status, 'angenommen');
    // Kontaktverweis fuer Kundenfilter und Lead-Kennzeichen.
    const k = require('../kontakte').speichere(db, { firma: 'Kunde' });
    const mitKontakt = angebot.erstelle(db, { posten: p, empfaenger: empf, kontaktId: k.id });
    assert.strictEqual(angebot.liste(db).find((x) => x.nr === mitKontakt.nr).kontakt_id, k.id, 'kontakt_id fehlt in der Liste');
    db.close();
  });
}

// --- Beleg-Editor (Block 4b) ---------------------------------------------------
// baue() ist der Unterbau von erstelle() und der Vorschau. Dieselben Positionen
// in beiden Wegen, sonst zeigt die Vorschau etwas anderes als das Dokument.
const zaehleBelege = (db) => db.prepare(
  'SELECT (SELECT COUNT(*) FROM invoices) + (SELECT COUNT(*) FROM angebote) AS n').get().n;

function testBaue() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const metrics = require('../metrics');
    const db = rechnungsDb();
    // Sieben Minuten an einem zweiten Vorgang: Stunden und Betrag haben dann
    // mehr als zwei Nachkommastellen, die Rundung wird sichtbar.
    const t = (min) => new Date(Date.UTC(2026, 7, 19, 9, min, 0)).toISOString();
    const insAkt = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
    for (let m = 0; m <= 7; m++) insAkt.run('s-u', t(m), 'Beispiel - App', 'feature/PROJ-501', 'PROJ-501', '2026-08-19');
    db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model,
      input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
      VALUES ('r-u',?,'s-u','Beispiel - App','feature/PROJ-501','PROJ-501','claude-opus-5',10,10,0,0,0,0,0.1,0,'2026-08-19')`).run(t(0));
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500', 'PROJ-501'], empfaenger: { name: 'Kunde' } };
    const roh = metrics.byTicket(db, { from: daten.from, to: daten.to }).find((r) => r.ticket === 'PROJ-501');
    assert.ok(roh && Math.round(roh.arbeitswert * 100) / 100 !== roh.arbeitswert,
      'Testdaten zeigen keine Rundung: ' + (roh && roh.arbeitswert));

    const pos = rechnung.baue(db, daten);
    assert.strictEqual(zaehleBelege(db), 0, 'baue() hat geschrieben');
    assert.strictEqual(pos.length, 2, 'Positionen fehlen');
    const zweiStellen = (n) => n == null || Math.round(n * 100) / 100 === n;
    for (const p of pos) {
      for (const f of ['stunden', 'satz', 'basissatz', 'betrag_eur']) {
        assert.ok(zweiStellen(p[f]), `${p.ticket}.${f} ungerundet: ${p[f]}`);
      }
    }
    const inv = rechnung.erstelle(db, daten);
    assert.deepStrictEqual(rechnung.lade(db, inv.nr).positionen, JSON.parse(JSON.stringify(pos)),
      'erstelle() schreibt andere Positionen als baue() liefert');
    db.close();
  });
}

function lokalerTag(iso, plus) {
  const d = new Date(iso);
  d.setDate(d.getDate() + plus);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function testRechnungFreiePosten() {
  rechnungsUmgebung((config) => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const basis = { from: '2026-08-01', to: '2026-08-31', empfaenger: { name: 'Kunde' } };

    // Gemischt: Vorgang zuerst, freie Posten in der gegebenen Reihenfolge.
    const inv = rechnung.erstelle(db, {
      ...basis, tickets: ['PROJ-500'], zahlungszielTage: 30,
      posten: [
        { bezeichnung: 'Einrichtung', typ: 'pauschal', betrag_eur: 0.1 },
        { bezeichnung: 'Schulung', stunden: 0.7, satz: 0.3, rabatt_prozent: 10 },
        { bezeichnung: 'Doku', typ: 'pauschal', betrag_eur: 0.2 },
      ],
    });
    const p = inv.positionen;
    assert.strictEqual(p.length, 4, 'Positionen fehlen');
    assert.strictEqual(p[0].ticket, 'PROJ-500', 'Vorgang steht nicht vorn');
    assert.deepStrictEqual([p[1].typ, p[1].stunden, p[1].betrag_eur], ['pauschal', null, 0.1], 'Pauschale falsch');
    assert.deepStrictEqual([p[2].basissatz, p[2].rabatt_prozent, p[2].satz, p[2].betrag_eur], [0.3, 10, 0.27, 0.19],
      'Rabatt je Position falsch');
    assert.strictEqual(inv.netto_eur, Math.round(p.reduce((s, x) => s + x.betrag_eur, 0) * 100) / 100,
      'Netto ist nicht die Summe der Positionen');
    assert.strictEqual(Math.round(inv.netto_eur * 100) / 100, inv.netto_eur, 'Netto ungerundet: ' + inv.netto_eur);
    assert.strictEqual(inv.faellig_am, lokalerTag(inv.erstellt_am, 30), 'Zahlungsziel je Beleg greift nicht');

    // Von Hand eingetragene Stunden sind nicht "erfasst": keine Vergleichsangabe.
    const merkFaktor = config.vergleichsFaktor;
    config.vergleichsFaktor = 1.5;
    try {
      const mitFaktor = rechnung.baue(db, { ...basis, posten: [{ bezeichnung: 'Schulung', stunden: 2, satz: 50 }] });
      assert.strictEqual(mitFaktor[0].vergleich_stunden, null, 'freie Stunden tragen eine Vergleichsangabe');
    } finally {
      config.vergleichsFaktor = merkFaktor;
    }

    // Nur freie Posten, ohne Ziel: Einstellung (14 Tage).
    const frei = rechnung.erstelle(db, { ...basis, posten: [{ bezeichnung: 'Wartung', typ: 'pauschal', betrag_eur: 99 }] });
    assert.strictEqual(frei.netto_eur, 99);
    assert.strictEqual(frei.faellig_am, lokalerTag(frei.erstellt_am, 14), 'ohne Angabe gilt die Einstellung nicht');
    const sofort = rechnung.erstelle(db, { ...basis, posten: [{ bezeichnung: 'X', stunden: 1, satz: 10 }], zahlungszielTage: 0 });
    assert.strictEqual(sofort.faellig_am, lokalerTag(sofort.erstellt_am, 0), 'Ziel 0 Tage nicht angenommen');

    // Abgelehnt, und keine Nummer verbraucht.
    const vorher = zaehleBelege(db);
    const ok = [{ bezeichnung: 'X', stunden: 1 }];
    for (const [abw, grund] of [
      [{ posten: [] }, 'weder Vorgaenge noch Posten'],
      [{ posten: undefined }, 'gar keine Quelle'],
      [{ posten: ok, zahlungszielTage: -1 }, 'Ziel negativ'],
      [{ posten: ok, zahlungszielTage: 121 }, 'Ziel ueber 120'],
      [{ posten: ok, zahlungszielTage: 1.5 }, 'Ziel kein ganzer Tag'],
      [{ posten: ok, zahlungszielTage: '30' }, 'Ziel als Text'],
      [{ posten: [{ bezeichnung: 'X', stunden: 1, rabatt_prozent: 101 }] }, 'Rabatt ueber 100'],
      [{ posten: [{ bezeichnung: 'X', stunden: 1, rabatt_prozent: -1 }] }, 'Rabatt negativ'],
      [{ posten: [{ bezeichnung: 'X', stunden: 1, rabatt_prozent: 'viel' }] }, 'Rabatt als Text'],
      [{ posten: [{ bezeichnung: 'X', typ: 'pauschal', betrag_eur: 50, rabatt_prozent: 10 }] }, 'Rabatt auf Festpreis'],
      [{ posten: [{ bezeichnung: '', stunden: 1 }] }, 'leere Bezeichnung'],
      [{ posten: Array.from({ length: 101 }, () => ({ bezeichnung: 'P', stunden: 1 })) }, 'ueber 100 Posten'],
      [{ posten: 'Wartung' }, 'Posten kein Array'],
      // Security-Review 4b: Number() machte aus null 0, aus true 1, aus [5] 5.
      [{ posten: [{ bezeichnung: 'X', stunden: 1, satz: null }] }, 'Satz null (wurde 0 EUR)'],
      [{ posten: [{ bezeichnung: 'X', stunden: [5] }] }, 'Stunden als Array'],
      [{ posten: [{ bezeichnung: 'X', stunden: true }] }, 'Stunden als Wahrheitswert'],
      [{ posten: [{ bezeichnung: 'X', typ: 'pauschal', betrag_eur: true }] }, 'Festpreis als Wahrheitswert'],
      [{ posten: [{ bezeichnung: 'X', typ: 'pauschal', betrag_eur: null }] }, 'Festpreis null'],
      // Nach dem Runden nichts mehr uebrig: Zeile mit 0 Std. und 0 EUR.
      [{ posten: [{ bezeichnung: 'X', stunden: 0.001 }] }, 'Stunden runden auf 0'],
      [{ posten: [{ bezeichnung: 'X', typ: 'pauschal', betrag_eur: 0.004 }] }, 'Festpreis rundet auf 0'],
    ]) {
      assert.throws(() => rechnung.erstelle(db, { ...basis, ...abw }), 'angenommen: ' + grund);
    }
    // Eigene Pruefung: ohne Grenze wuerfe es erst spaeter (keine Daten) — die Meldung zeigt, wer abgelehnt hat.
    assert.throws(() => rechnung.erstelle(db, { ...basis, tickets: Array.from({ length: 201 }, (_, i) => 'T-' + i) }), /200 Vorgaenge/,
      'ueber 200 Vorgaenge angenommen');
    assert.strictEqual(zaehleBelege(db), vorher, 'abgelehnte Rechnung hat eine Nummer verbraucht');
    // Die bisherige Ansicht schickt Feldinhalte als Text — das bleibt erlaubt.
    const alt = rechnung.baue(db, { ...basis, posten: [{ bezeichnung: 'X', stunden: '2', satz: '50' }, { bezeichnung: 'Y', typ: 'pauschal', betrag_eur: '30' }] });
    assert.deepStrictEqual(alt.map((p) => p.betrag_eur), [100, 30], 'Zahlen als Text nicht mehr angenommen');
    db.close();
  });
}

// R6/R7: die Vorschau ist dieselbe Funktion wie der Druck, nur ohne Nummer und
// ohne Schreiben. Byte-gleiche PDFs sind nicht pruefbar (Datum, Metadaten) —
// gleich sein muss das HTML, sobald die Nummer eingesetzt ist.
function testBelegVorschau() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const angebot = require('../angebot');
    const db = rechnungsDb();
    const empfaenger = { name: 'Kunde GmbH', anschrift: ['Weg 1', '50667 Koeln'] };
    const daten = {
      from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger, zahlungszielTage: 21,
      posten: [{ bezeichnung: 'Einrichtung', typ: 'pauschal', betrag_eur: 250 }],
    };
    const v = rechnung.vorschau(db, daten);
    const a = angebot.vorschau(db, { posten: daten.posten, empfaenger, gueltigTage: 10 });
    assert.strictEqual(zaehleBelege(db), 0, 'Vorschau hat einen Beleg geschrieben');
    assert.ok(v.html.includes('Rechnung ENTWURF'), 'Rechnungsvorschau ohne ENTWURF');
    assert.ok(a.html.includes('Angebot ENTWURF'), 'Angebotsvorschau ohne ENTWURF');

    const inv = rechnung.erstelle(db, daten);
    assert.deepStrictEqual([v.netto_eur, v.ust_eur, v.brutto_eur], [inv.netto_eur, inv.ust_eur, inv.brutto_eur],
      'Summen der Vorschau weichen ab');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(v.positionen)), inv.positionen, 'Positionen der Vorschau weichen ab');
    assert.strictEqual(v.html.split('ENTWURF').join(inv.nr), rechnung.renderHtml(rechnung.lade(db, inv.nr)),
      'Vorschau gleicht der gestellten Rechnung nicht');
    const ang = angebot.erstelle(db, { posten: daten.posten, empfaenger, gueltigTage: 10 });
    assert.strictEqual(a.html.split('ENTWURF').join(ang.nr), angebot.renderHtml(angebot.lade(db, ang.nr)),
      'Vorschau gleicht dem gestellten Angebot nicht');

    // Silent-Failure-Review 4b: gestellt wird nur, was zu sehen war. Weicht der
    // Betrag inzwischen ab (Zeit laeuft auf), entsteht nichts.
    const n0 = zaehleBelege(db);
    const v2 = rechnung.vorschau(db, daten);
    for (const falsch of [v2.brutto_eur + 0.01, 0, -1]) {
      assert.throws(() => rechnung.erstelle(db, { ...daten, erwartetBrutto: falsch }), (e) => e.abweichung === true,
        'abweichender Betrag gestellt: ' + falsch);
    }
    assert.throws(() => angebot.erstelle(db, { posten: daten.posten, empfaenger, erwartetBrutto: 1 }), (e) => e.abweichung === true,
      'abweichendes Angebot gestellt');
    assert.strictEqual(zaehleBelege(db), n0, 'Abweichung hat geschrieben');
    assert.strictEqual(rechnung.erstelle(db, { ...daten, erwartetBrutto: v2.brutto_eur }).brutto_eur, v2.brutto_eur);
    assert.throws(() => rechnung.erstelle(db, { ...daten, erwartetBrutto: String(v2.brutto_eur) }), 'erwartetBrutto als Text angenommen');

    // Ungueltiges prallt ab wie beim Erstellen, und es entsteht nichts.
    const vorher = zaehleBelege(db);
    assert.throws(() => rechnung.vorschau(db, { ...daten, tickets: [], posten: [] }), 'leere Vorschau angenommen');
    assert.throws(() => angebot.vorschau(db, { posten: [], empfaenger }), 'leere Angebotsvorschau angenommen');
    // Security-Review 4b: Gueltigkeit streng wie das Zahlungsziel, Zeitraum als echter Tag.
    for (const [abw, grund] of [
      [{ gueltigTage: 'abc' }, 'Gueltigkeit als Text'], [{ gueltigTage: 0.5 }, 'Gueltigkeit gebrochen'],
      [{ gueltigTage: 0 }, 'Gueltigkeit 0'], [{ gueltigTage: 366 }, 'Gueltigkeit ueber 365'], [{ gueltigTage: [30] }, 'Gueltigkeit als Array'],
      [{ tickets: ['PROJ-500'], from: '2026-02-30', to: '2026-08-31' }, 'Zeitraum kein Kalendertag'],
    ]) {
      assert.throws(() => angebot.vorschau(db, { posten: daten.posten, empfaenger, ...abw }), 'Angebot angenommen: ' + grund);
    }
    assert.ok(angebot.vorschau(db, { posten: daten.posten, empfaenger, gueltigTage: null }).html, 'ohne Gueltigkeit gilt der Standard nicht');
    assert.strictEqual(zaehleBelege(db), vorher, 'abgelehnte Vorschau hat geschrieben');
    db.close();
  });
}

// R5: Entwuerfe liegen im Browser. Was dort steht, kann jeder aendern — gelesen
// wird nur, was die feste Form hat.
function testEntwuerfeAus() {
  const { entwuerfeAus } = require('../public/app/kern.js');
  const gut = { id: 'e-1', art: 'rechnung', stand: '2026-10-06T10:00:00.000Z', daten: { posten: [] } };
  assert.deepStrictEqual(entwuerfeAus([gut]), [gut]);
  assert.deepStrictEqual(entwuerfeAus([{ ...gut, art: 'angebot' }]).length, 1);
  for (const roh of [null, undefined, 'x', 3, {}, { length: 1, 0: gut }]) {
    assert.deepStrictEqual(entwuerfeAus(roh), [], 'kein Array: ' + JSON.stringify(roh));
  }
  for (const boes of [
    { ...gut, art: 'storno' }, { ...gut, id: '<img src=x>' }, { ...gut, id: '' }, { ...gut, id: 5 },
    { ...gut, stand: 'gestern' }, { ...gut, stand: 5 }, { ...gut, daten: [] }, { ...gut, daten: null },
    { ...gut, daten: 'x' }, { ...gut, daten: { x: 'y'.repeat(60000) } }, null, 'e-1',
  ]) {
    assert.deepStrictEqual(entwuerfeAus([boes, gut]), [gut], 'durchgelassen: ' + JSON.stringify(boes).slice(0, 80));
  }
  const viele = Array.from({ length: 25 }, (_, i) => ({ ...gut, id: 'e-' + i }));
  assert.strictEqual(entwuerfeAus(viele).length, 20, 'mehr als 20 Entwuerfe gelesen');
}

// --- Kontakte + Einstellungen (Block 4c) ----------------------------------------
// R11: Ansprechpartner je Kontakt. Die E-Mail am Kontakt bleibt (E-Rechnung
// liest sie); beim Umstieg wird sie einmal als Ansprechpartner uebernommen.
function testAnsprechpartner() {
  const kontakte = require('../kontakte');
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const a = kontakte.speichere(db, { firma: 'Alpha GmbH', vorname: 'Anna', nachname: 'Berg', email: 'anna@alpha.de' });
  const b = kontakte.speichere(db, { firma: 'Beta AG' });
  const c = kontakte.speichere(db, { firma: 'Gamma', email: 'info@gamma.de' });
  // Bestand wie vor dem Umstieg: die Uebernahme ist noch nicht gelaufen.
  db.prepare("DELETE FROM meta WHERE key = 'ansprechpartner_uebernommen'").run();
  db.prepare('DELETE FROM ansprechpartner').run();
  dbmod.migrate(db);
  dbmod.migrate(db);
  const zeilen = db.prepare('SELECT kontakt_id, name, email FROM ansprechpartner ORDER BY kontakt_id').all().map((r) => ({ ...r }));
  assert.deepStrictEqual(zeilen, [
    { kontakt_id: a.id, name: 'Anna Berg', email: 'anna@alpha.de' },
    { kontakt_id: c.id, name: 'Gamma', email: 'info@gamma.de' },
  ], 'Uebernahme nicht genau einmal je Kontakt mit E-Mail: ' + JSON.stringify(zeilen));
  // Wer den uebernommenen Eintrag loescht, bekommt ihn beim naechsten Start nicht zurueck.
  kontakte.loescheAnsprechpartner(db, kontakte.ansprechpartnerVon(db, c.id)[0].id);
  dbmod.migrate(db);
  assert.strictEqual(kontakte.ansprechpartnerVon(db, c.id).length, 0, 'geloeschter Ansprechpartner kam zurueck');
  // Neue Kontakte nach dem Umstieg: ihre E-Mail bleibt am Kontakt, kein Ansprechpartner.
  const d = kontakte.speichere(db, { firma: 'Delta', email: 'x@delta.de' });
  dbmod.migrate(db);
  assert.strictEqual(kontakte.ansprechpartnerVon(db, d.id).length, 0, 'Uebernahme lief erneut');

  const neu = kontakte.speichereAnsprechpartner(db, { kontakt_id: b.id, name: '  Bert Beta ', email: 'bert@beta.de', telefon: '0221 1', rolle: 'Buchhaltung' });
  assert.deepStrictEqual([neu.name, neu.rolle, neu.kontakt_id], ['Bert Beta', 'Buchhaltung', b.id]);
  const geaendert = kontakte.speichereAnsprechpartner(db, { id: neu.id, kontakt_id: b.id, name: 'Bert B.', email: '', telefon: '', rolle: '' });
  assert.strictEqual(geaendert.name, 'Bert B.');
  assert.strictEqual(kontakte.ansprechpartnerVon(db, b.id).length, 1, 'Aendern hat einen zweiten angelegt');
  const vorher = db.prepare('SELECT COUNT(*) n FROM ansprechpartner').get().n;
  for (const [daten, grund] of [
    [{ kontakt_id: 99999, name: 'X' }, 'unbekannter Kontakt'],
    [{ kontakt_id: 'abc', name: 'X' }, 'Kontakt kein Wert'],
    [{ kontakt_id: b.id, name: '' }, 'leerer Name'],
    [{ kontakt_id: b.id, name: 'x'.repeat(201) }, 'Name zu lang'],
    [{ kontakt_id: b.id, name: ['a'] }, 'Name kein Text'],
    [{ kontakt_id: b.id, name: 'X', email: 'keine-mail' }, 'E-Mail ohne @'],
    [{ kontakt_id: b.id, name: 'X', telefon: '1'.repeat(41) }, 'Telefon zu lang'],
    [{ kontakt_id: b.id, name: 'X', rolle: 'r'.repeat(81) }, 'Rolle zu lang'],
    [{ kontakt_id: b.id, name: 'Werftstra�e' }, 'Ersatzzeichen'],
    [{ id: 99999, kontakt_id: b.id, name: 'X' }, 'unbekannter Ansprechpartner'],
    [{ id: neu.id, kontakt_id: a.id, name: 'X' }, 'Ansprechpartner eines anderen Kontakts'],
  ]) {
    assert.throws(() => kontakte.speichereAnsprechpartner(db, daten), 'angenommen: ' + grund);
  }
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM ansprechpartner').get().n, vorher, 'Abgelehntes wurde gespeichert');
  for (const id of [99999, 'x', -1, 1.5]) assert.throws(() => kontakte.loescheAnsprechpartner(db, id), 'geloescht: ' + id);
  // Ein geloeschter Kontakt nimmt seine Ansprechpartner mit.
  kontakte.loesche(db, b.id);
  assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM ansprechpartner WHERE kontakt_id = ?').get(b.id).n, 0, 'Ansprechpartner blieben verwaist');
  db.close();
}

// R10: Kennzahlen der Kontakt-Akte, vom Server. Nur gestellte Rechnungen:
// eine stornierte und ihre Gegenrechnung zaehlen weder als Umsatz noch offen.
function testKennzahlenJeKontakt() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const angebot = require('../angebot');
    const kontakte = require('../kontakte');
    const db = rechnungsDb();
    const k1 = kontakte.speichere(db, { firma: 'Eins' });
    const k2 = kontakte.speichere(db, { firma: 'Zwei' });
    const basis = { from: '2026-08-01', to: '2026-08-31', empfaenger: { name: 'Eins' } };
    const pausch = (b) => [{ bezeichnung: 'P', typ: 'pauschal', betrag_eur: b }];
    const heute = heuteLokal();
    const r1 = rechnung.erstelle(db, { ...basis, kontaktId: k1.id, posten: pausch(100) });
    const r2 = rechnung.erstelle(db, { ...basis, kontaktId: k1.id, posten: pausch(50) });
    rechnung.erstelle(db, { ...basis, kontaktId: k2.id, posten: pausch(200) });
    rechnung.bucheZahlung(db, { nr: r1.nr, datum: heute, betrag_eur: 60 });
    rechnung.bucheZahlung(db, { nr: r2.nr, datum: heute, betrag_eur: 20 });
    rechnung.storniere(db, r2.nr);
    const p = [{ bezeichnung: 'X', stunden: 1, satz: 100 }];
    angebot.erstelle(db, { posten: p, empfaenger: { name: 'Eins' }, kontaktId: k1.id });
    const alt = angebot.erstelle(db, { posten: p, empfaenger: { name: 'Eins' }, kontaktId: k1.id });
    db.prepare('UPDATE angebote SET gueltig_bis = ? WHERE nr = ?').run(new Date(Date.now() - 60000).toISOString(), alt.nr);
    const abger = angebot.erstelle(db, { posten: p, empfaenger: { name: 'Eins' }, kontaktId: k1.id });
    angebot.inRechnung(db, abger.nr);

    let K = rechnung.jeKontakt(db);
    assert.deepStrictEqual(K.get(k1.id), { umsatz_bezahlt_eur: 60, offen_eur: 140, zahlungsdauer_tage: null, angebote_offen: 1, rechnungen: 2 },
      'Kontakt 1: ' + JSON.stringify(K.get(k1.id)));
    assert.deepStrictEqual(K.get(k2.id), { umsatz_bezahlt_eur: 0, offen_eur: 200, zahlungsdauer_tage: null, angebote_offen: 0, rechnungen: 1 });
    rechnung.bucheZahlung(db, { nr: r1.nr, datum: heute, betrag_eur: 40 });
    K = rechnung.jeKontakt(db);
    assert.strictEqual(K.get(k1.id).umsatz_bezahlt_eur, 100);
    assert.strictEqual(K.get(k1.id).zahlungsdauer_tage, 0, 'Zahlungsdauer der bezahlten Rechnung fehlt');
    db.close();
  });
}

// Routen gegen die Datenbank des Servers: nur Ablehnungen und Lesen.
async function testAnsprechpartnerRoute() {
  const srv = require('../server');
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const port = srv.server.address().port;
  const url = (p) => `http://127.0.0.1:${port}${p}`;
  const post = async (p, body) => {
    const r = await fetch(url(p), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, d: await r.json() };
  };
  try {
    let a = await post('/api/ansprechpartner', { kontakt_id: 'x', name: 'X' });
    assert.deepStrictEqual([a.status, a.d.error], [400, 'Unbekannter Kontakt.'], 'POST: ' + JSON.stringify(a));
    a = await post('/api/ansprechpartner-loeschen', { id: 'x' });
    assert.deepStrictEqual([a.status, a.d.error], [400, 'Unbekannter Ansprechpartner.'], 'Loeschen: ' + JSON.stringify(a));
    const g = await fetch(url('/api/ansprechpartner?kontakt=abc'));
    assert.deepStrictEqual([g.status, (await g.json()).error], [400, 'Unbekannter Kontakt.'], 'GET mit kaputter Id');
    const k = await (await fetch(url('/api/kontakte'))).json();
    assert.ok(k.kontakte.every((x) => x.kennzahlen && typeof x.kennzahlen.offen_eur === 'number'), 'Kennzahlen fehlen in /api/kontakte');
  } finally {
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

// R16: Ueberfaellig-Ampel frei. Ueberfaellig = gestellt, Rest offen, Faelligkeit
// vor heute. Gerechnet nur im Server; die Oberflaeche zeigt die Felder an.
function testUeberfaellig() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };
    const a = rechnung.erstelle(db, daten);   // bezahlt, Faelligkeit vorbei -> nicht ueberfaellig
    const b = rechnung.erstelle(db, daten);   // teilbezahlt, seit 7 Tagen faellig (aelter als c, steht aber vorn)
    const c = rechnung.erstelle(db, daten);   // offen, seit 5 Tagen faellig
    const d = rechnung.erstelle(db, daten);   // storniert, Faelligkeit vorbei
    const e = rechnung.erstelle(db, daten);   // offen, heute faellig -> noch nicht ueberfaellig
    const heute = '2026-10-06';
    rechnung.bucheZahlung(db, { nr: a.nr, datum: heuteLokal(), betrag_eur: a.brutto_eur });
    rechnung.bucheZahlung(db, { nr: b.nr, datum: heuteLokal(), betrag_eur: 10 });
    rechnung.storniere(db, d.nr);
    const setze = (nr, tag) => db.prepare('UPDATE invoices SET faellig_am = ? WHERE nr = ?').run(tag, nr);
    setze(a.nr, '2026-09-01'); setze(b.nr, '2026-09-29'); setze(c.nr, '2026-10-01'); setze(d.nr, '2026-09-01'); setze(e.nr, heute);

    const r2 = (n) => Math.round(n * 100) / 100;
    const L = Object.fromEntries(rechnung.liste(db, { heute }).map((r) => [r.nr, r.ueberfaellig_tage]));
    assert.deepStrictEqual([L[a.nr], L[b.nr], L[c.nr], L[d.nr], L[e.nr]], [0, 7, 5, 0, 0], 'Liste: ' + JSON.stringify(L));
    assert.strictEqual(rechnung.detail(db, c.nr, { heute }).ueberfaellig_tage, 5, 'Detail');

    const K = rechnung.kennzahlen(db, { from: '2000-01-01', to: '2999-12-31', heute });
    assert.strictEqual(K.ueberfaellig_anzahl, 2, 'Anzahl: ' + K.ueberfaellig_anzahl);
    assert.strictEqual(K.ueberfaellig_eur, r2(b.brutto_eur - 10 + c.brutto_eur), 'Betrag = Rest, nicht Brutto');
    assert.strictEqual(K.ueberfaellig_aeltester_tage, 7, 'aelteste');
    // Plausibel: Ueberfaelliges ist ein Teil des Offenen, nie mehr.
    assert.ok(K.ueberfaellig_eur > 0 && K.ueberfaellig_eur < K.offen_eur, 'Ueberfaellig ausserhalb des Offenen');
    // Bestand, kein Zeitraum: ein anderer Ausschnitt aendert nichts.
    assert.strictEqual(rechnung.kennzahlen(db, { from: '2000-01-01', to: '2000-12-31', heute }).ueberfaellig_eur, K.ueberfaellig_eur);
    const nichts = rechnung.kennzahlen(db, { heute: '2026-09-29' });
    assert.deepStrictEqual([nichts.ueberfaellig_anzahl, nichts.ueberfaellig_eur, nichts.ueberfaellig_aeltester_tage], [0, 0, null], 'vor allen Faelligkeiten');
    db.close();
  });
}

// Gesamtreview 4d: Storno nimmt die Zahlungen aus "bezahlt" (wie jeKontakt),
// "bezahlt" heisst Rest 0 (Toleranz-Cent), Storno ist alles oder nichts.
function testStornoUndZahlungen() {
  rechnungsUmgebung(() => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };
    const r2 = (n) => Math.round(n * 100) / 100;
    const voll = rechnung.erstelle(db, daten);
    const knapp = rechnung.erstelle(db, daten);
    const heute = heuteLokal();
    rechnung.bucheZahlung(db, { nr: voll.nr, datum: heute, betrag_eur: voll.brutto_eur });
    rechnung.bucheZahlung(db, { nr: knapp.nr, datum: heute, betrag_eur: r2(knapp.brutto_eur - 0.01) });
    const vorher = rechnung.kennzahlen(db, { from: '2000-01-01', to: '2999-12-31' });
    assert.strictEqual(vorher.bezahlt_eur, r2(voll.brutto_eur * 2 - 0.01), 'bezahlt vor dem Storno');
    // Toleranz-Cent: Status bezahlt, dann auch kein Rest — sonst stuende 0,01 in "Offen gesamt".
    const z = rechnung.liste(db).find((x) => x.nr === knapp.nr);
    assert.deepStrictEqual([z.status_abgeleitet, z.rest_eur], ['bezahlt', 0], 'Toleranz-Cent: ' + JSON.stringify(z));
    assert.strictEqual(vorher.offen_eur, 0, 'Toleranz-Cent in Offen gesamt');

    rechnung.storniere(db, voll.nr);
    const K = rechnung.kennzahlen(db, { from: '2000-01-01', to: '2999-12-31' });
    assert.strictEqual(K.bezahlt_eur, r2(knapp.brutto_eur - 0.01), 'Zahlung der stornierten Rechnung zaehlt noch: ' + K.bezahlt_eur);

    // Storno: scheitert der zweite Schritt, bleibt auch der erste nicht stehen.
    const dritte = rechnung.erstelle(db, daten);
    const anzahl = () => db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;
    const n0 = anzahl();
    const prepare = db.prepare.bind(db);
    db.prepare = (sql) => { if (/UPDATE invoices SET status = 'storniert'/.test(sql)) throw new Error('Platte voll'); return prepare(sql); };
    try { assert.throws(() => rechnung.storniere(db, dritte.nr), /Platte voll/); }
    finally { db.prepare = prepare; }
    assert.strictEqual(anzahl(), n0, 'Gegenrechnung ohne Storno des Originals stehen geblieben');
    assert.strictEqual(rechnung.lade(db, dritte.nr).status, 'erstellt');
    db.close();
  });
}

// Altrechnungen (vor 1.3) tragen keinen Faelligkeitstag. Er wird einmal
// festgeschrieben, damit Ampel und Druck nicht mit der Einstellung wandern;
// Zahlungsziel 0 heisst sofort faellig, nicht 14 Tage.
function testFaelligAltrechnung() {
  rechnungsUmgebung((config) => {
    const rechnung = require('../rechnung');
    const db = rechnungsDb();
    const daten = { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'], empfaenger: { name: 'Kunde' } };
    const alt = rechnung.erstelle(db, daten);
    const neu = rechnung.erstelle(db, daten);
    db.prepare('UPDATE invoices SET faellig_am = NULL, erstellt_am = ? WHERE nr = ?').run('2026-09-01T10:00:00.000Z', alt.nr);
    config.rechnung.zahlungszielTage = 0;
    assert.strictEqual(rechnung.faelligAm({ erstellt_am: '2026-09-01T10:00:00.000Z', faellig_am: null }), '2026-09-01', 'Ziel 0 wird zu 14');
    config.rechnung.zahlungszielTage = 14;
    assert.strictEqual(rechnung.faelligFestschreiben(db), 1, 'genau die Altrechnung');
    const tag = db.prepare('SELECT faellig_am FROM invoices WHERE nr = ?').get(alt.nr).faellig_am;
    assert.strictEqual(tag, '2026-09-15');
    assert.strictEqual(db.prepare('SELECT faellig_am FROM invoices WHERE nr = ?').get(neu.nr).faellig_am, neu.faellig_am, 'neue Rechnung angefasst');
    config.rechnung.zahlungszielTage = 30;
    assert.strictEqual(rechnung.liste(db).find((x) => x.nr === alt.nr).faellig_am, '2026-09-15', 'Faelligkeit wandert mit der Einstellung');
    assert.strictEqual(rechnung.faelligFestschreiben(db), 0, 'zweiter Lauf schreibt erneut');
    db.close();
  });
}

// Texte, die auf einem Dokument landen: keine Steuerzeichen, keine
// Bidi-Steuerung (U+202E dreht die Schreibrichtung im PDF), kein U+FFFD.
// Zeilenwechsel und Tab bleiben erlaubt (Notizen).
function testTextZeichen() {
  const kontakte = require('../kontakte');
  for (const boese of ['A‮B', 'A\u0000B', 'A⁦B', 'A B', 'A�B', 'A\u001bB']) {
    assert.throws(() => kontakte.ohneErsatzzeichen(boese, 'Feld'), /Feld/, 'durchgelassen: ' + JSON.stringify(boese));
  }
  for (const gut of ['Müller & Söhne', 'Zeile 1\nZeile 2', 'a\tb', 'Ελλάδα']) kontakte.ohneErsatzzeichen(gut, 'Feld');
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const k = kontakte.speichere(db, { firma: 'Echt GmbH' });
  for (const id of [true, '1e0', [k.id], '0x1', ' ']) {
    assert.throws(() => kontakte.pruefeId(db, id), /Unbekannter Kontakt/, 'Kontakt-Id angenommen: ' + JSON.stringify(id));
  }
  assert.strictEqual(kontakte.pruefeId(db, String(k.id)), k.id);
  assert.strictEqual(kontakte.pruefeId(db, k.id), k.id);
}

// Fuer Tests, die abzulehnende Eingaben an Setter schicken: solange die Pruefung
// fehlt (rot vor dem Fix), wuerden sie in die echte config.json geschrieben.
// Datei und Speicherstand werden deshalb vorher gesichert und danach
// zurueckgesetzt, gleich wie der Test ausgeht.
function configGeschuetzt(fn) {
  const pfad = path.join(__dirname, '..', 'config.json');
  const datei = fs.readFileSync(pfad, 'utf8');
  const cfg = require('../config.json');
  const speicher = JSON.parse(JSON.stringify(cfg));
  try {
    return fn();
  } finally {
    fs.writeFileSync(pfad, datei, 'utf8');
    for (const k of Object.keys(cfg)) delete cfg[k];
    Object.assign(cfg, speicher);
  }
}

// Zahlen aus dem Netz: Number(' '), Number([]) und Number(true) ergaeben 0 bzw. 1
// und laegen in jeder Grenze.
function testEchteZahlen() {
  configGeschuetzt(echteZahlen);
}
function echteZahlen() {
  const srv = require('../server');
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  for (const boese of [' ', [], [5], true, false, {}, '1e', '12,5', '0x10', '1e3', 'Infinity']) {
    const t = JSON.stringify(boese);
    assert.throws(() => srv.setzeEinstellungen({ stundensatz: boese }), /keine gueltige Zahl/, 'Einstellung nimmt ' + t);
    assert.throws(() => srv.setzeStammdaten({ zahlungszielTage: boese }), /keine gueltige Zahl/, 'Stammdaten nehmen ' + t);
    assert.throws(() => srv.setzeSatz({ projekt: 'P', satz: boese }), /Stundensatz/, 'Satz nimmt ' + t);
    assert.throws(() => srv.setzeSatz({ projekt: 'P', rabatt: boese }), /Rabatt/, 'Rabatt nimmt ' + t);
    assert.throws(() => srv.setzeVorlage(db, { bezeichnung: 'V', satz: boese }), /Stundensatz/, 'Vorlage nimmt ' + t);
  }
  // Zahl und Zahltext bleiben gueltig.
  assert.strictEqual(srv.setzeVorlage(db, { bezeichnung: 'V', satz: ' 12.5 ' }).satz, 12.5);
  assert.strictEqual(srv.setzeVorlage(db, { bezeichnung: 'W', satz: 80 }).satz, 80);
}

// Stammdaten landen auf jeder Rechnung: ein Steuerzeichen oder das Ersatzzeichen
// U+FFFD (kaputte Kodierung beim Einfuegen) stuende sonst im Dokument.
function testStammdatenSteuerzeichen() {
  configGeschuetzt(stammdatenSteuerzeichen);
}
function stammdatenSteuerzeichen() {
  const { setzeStammdaten } = require('../server');
  for (const [feld, wert] of [['name', 'Firma\u0007 GmbH'], ['name', 'M�ller'], ['bank', 'Bank\u0000'],
    ['anschrift', 'Weg 1\nK\u0001ln'], ['anschrift', ['Weg 1', '50667 K�ln']], ['email', 'a\u001b@b.de']]) {
    assert.throws(() => setzeStammdaten({ [feld]: wert }), /Steuerzeichen|Ersatzzeichen/, feld + ' nimmt ' + JSON.stringify(wert));
  }
  // Kein Text wird nicht zu Text gemacht: sonst stuende [object Object] auf jeder Rechnung.
  for (const wert of [{ a: 1 }, ['a', 'b'], 5, true]) {
    assert.throws(() => setzeStammdaten({ name: wert }), /Text erwartet/, 'name nimmt ' + JSON.stringify(wert));
  }
}

// Sicherheits-Header: nosniff ueberall, CSP auf der Seite. Das eine Inline-Skript
// der Seite ist per Hash erlaubt — aendert es sich, muss der Hash mit.
async function testSicherheitsHeader() {
  const srv = require('../server');
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const url = (p) => `http://127.0.0.1:${srv.server.address().port}${p}`;
  try {
    const seite = await fetch(url('/'));
    const html = await seite.text();
    assert.strictEqual(seite.headers.get('x-content-type-options'), 'nosniff', 'Seite ohne nosniff');
    const csp = seite.headers.get('content-security-policy') || '';
    assert.ok(/script-src 'self'/.test(csp) && /object-src 'none'/.test(csp), 'CSP fehlt oder zu weit: ' + csp);
    assert.ok(!/unsafe-(inline|eval)'[^;]*;?/.test((csp.match(/script-src[^;]*/) || [''])[0]), 'script-src erlaubt Inline/Eval');
    // Einbetten nur selbst und in Obsidian: sonst koppelt eine fremde Seite per Frame (Clickjacking, Review 1008786).
    assert.strictEqual((csp.match(/frame-ancestors[^;]*/) || [''])[0].trim(), "frame-ancestors 'self' app://obsidian.md capacitor://localhost", 'frame-ancestors fehlt oder zu weit: ' + csp);
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(inline.length >= 1, 'kein Inline-Skript gefunden, Muster kaputt?');
    for (const code of inline) {
      const h = "'sha256-" + require('crypto').createHash('sha256').update(code).digest('base64') + "'";
      assert.ok(csp.includes(h), 'Inline-Skript nicht in der CSP erlaubt: ' + code.slice(0, 40));
    }
    // Fremde Stylesheets der Seite (Schriften) muessen erlaubt sein, sonst faellt die Schrift still weg.
    const styleSrc = (csp.match(/style-src[^;]*/) || [''])[0];
    for (const [, href] of html.matchAll(/<link rel="stylesheet" href="(https:[^"]+)"/g)) {
      assert.ok(styleSrc.includes(new URL(href).origin), 'Stylesheet von der CSP blockiert: ' + new URL(href).origin);
    }
    if (/fonts\.googleapis\.com/.test(html)) assert.ok(/font-src[^;]*https:\/\/fonts\.gstatic\.com/.test(csp), 'Schriftdateien blockiert');
    assert.strictEqual((await fetch(url('/api/kontakte'))).headers.get('x-content-type-options'), 'nosniff', 'API ohne nosniff');
    // POST einer fremden Seite: Browser ohne Sec-Fetch-Site schicken trotzdem Origin.
    const post = (p, body, origin) => fetch(url(p), { method: 'POST', headers: { 'content-type': 'text/plain', ...(origin ? { origin } : {}) }, body });
    let a = await post('/api/rechnung-storno', '{"nr":"2099-0001"}', 'http://evil.example');
    assert.strictEqual(a.status, 403, 'fremde Herkunft durchgelassen: ' + a.status);
    a = await post('/api/rechnung-storno', 'null', 'http://127.0.0.1:' + srv.server.address().port);
    const ad = await a.json();
    assert.ok(a.status === 400 && !/Cannot read/.test(ad.error), 'eigene Herkunft / null-Koerper: ' + a.status + ' ' + ad.error);
    // Alter Einstieg (R15): Lesezeichen auf /app.html landen auf /.
    const alt = await fetch(url('/app.html?x=1'), { redirect: 'manual' });
    assert.deepStrictEqual([alt.status, alt.headers.get('location')], [301, '/'], 'app.html leitet nicht um');
  } finally {
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

// R13: "Bewegung reduzieren" aus dem Browser-Speicher nur als on/off.
function testBewegung() {
  const { bewegungAus } = require('../public/app/kern.js');
  assert.strictEqual(bewegungAus('off'), 'off');
  for (const roh of ['on', null, undefined, '', 'OFF', ' off', '<img>', 1, {}, ['off']]) {
    assert.strictEqual(bewegungAus(roh), 'on', 'durchgelassen: ' + JSON.stringify(roh));
  }
}

// Release 3.0.0: geplante Bereiche nur mit oberflaeche.geplanteBereiche === true.
function testNavGeplant() {
  const { navSeiten } = require('../public/app/kern.js');
  const seiten = [{ k: 'cockpit' }, { k: 'flows', block: 'C11' }, { k: 'board' }];
  const ks = (g) => navSeiten(seiten, g).map((s) => s.k).join(',');
  assert.strictEqual(ks(true), 'cockpit,flows,board');
  for (const g of [false, undefined, null, 'true', 1]) assert.strictEqual(ks(g), 'cockpit,board', 'durchgelassen: ' + JSON.stringify(g));
  // Die Vorlage blendet aus: ein frischer Nutzer sieht keine leeren Bereiche.
  const vorlage = require('../config.example.json');
  assert.notStrictEqual((vorlage.oberflaeche || {}).geplanteBereiche, true, 'config.example.json zeigt geplante Bereiche');
  // Die Shell filtert ueber navSeiten, nicht an ihr vorbei.
  const shell = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public', 'app', 'shell.js'), 'utf8');
  assert.match(shell, /const sichtbareSeiten = \(\) => navSeiten\(SEITEN, /);
}

// --- Zeiterfassung (Block Z1) ----------------------------------------------
// Manuelle Zeit ist eine zweite Zeitquelle neben Claude. Sie geht in den
// Arbeitswert, nie in die Claude-Stunden, und nie unbemerkt auf einen Beleg.

// Setzt die Standard-Rundung fuer die Dauer eines Tests.
function mitRundung(minuten, fn) {
  const cfg = require('../config.json');
  const vorher = cfg.rundungMinuten;
  cfg.rundungMinuten = minuten;
  try {
    return fn();
  } finally {
    if (vorher === undefined) delete cfg.rundungMinuten; else cfg.rundungMinuten = vorher;
  }
}

// Oberste Config-Werte fuer die Dauer eines Tests — kein Test verlaesst sich
// auf das, was zufaellig in der eigenen config.json steht.
function mitConfig(werte, fn) {
  const cfg = require('../config.json');
  const vorher = Object.fromEntries(Object.keys(werte).map((k) => [k, [Object.hasOwn(cfg, k), cfg[k]]]));
  Object.assign(cfg, werte);
  try {
    return fn();
  } finally {
    for (const [k, [hatte, w]] of Object.entries(vorher)) if (hatte) cfg[k] = w; else delete cfg[k];
  }
}

// Ein Projekteintrag in config.projektSaetze nur fuer die Dauer eines Tests.
function mitProjektSatz(projekt, eintrag, fn) {
  const cfg = require('../config.json');
  if (!cfg.projektSaetze) cfg.projektSaetze = {};
  const hatte = Object.hasOwn(cfg.projektSaetze, projekt);
  const vorher = cfg.projektSaetze[projekt];
  cfg.projektSaetze[projekt] = eintrag;
  try {
    return fn();
  } finally {
    if (hatte) cfg.projektSaetze[projekt] = vorher; else delete cfg.projektSaetze[projekt];
  }
}

// Ein Eintrag mit sinnvollen Vorgaben; Tests ueberschreiben nur, was sie pruefen.
function eintrag(db, d = {}) {
  const zeit = require('../zeit');
  return zeit.speichere(db, {
    ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1',
    start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T15:30:00.000Z',
    pause_min: 0, taetigkeit: 'Entwicklung', notiz: '', abrechenbar: true, ...d,
  });
}

function testZeitRundung() {
  mitRundung(5, () => {
    const { db } = zeitDb();
    // 14:00–15:00 mit 13 Min Pause = 47 Min roh; auf 5 Min aufgerundet 50.
    const e = eintrag(db, { ende: '2026-08-18T15:00:00.000Z', pause_min: 13 });
    assert.strictEqual(e.rohzeit_min, 47, 'Rohzeit ' + e.rohzeit_min + ' statt 47 (Pause nicht abgezogen?)');
    assert.strictEqual(e.gezaehlt_min, 50, 'gezaehlt ' + e.gezaehlt_min + ' statt 50 (Rundung fehlt?)');
    // Genau auf dem Raster bleibt es, wie es ist.
    assert.strictEqual(eintrag(db, { ende: '2026-08-18T15:00:00.000Z' }).gezaehlt_min, 60);
    // Feste Dauer zaehlt ab Beginn, das Ende folgt daraus.
    const f = eintrag(db, { ende: undefined, dauer_fest_min: 90 });
    assert.strictEqual(f.rohzeit_min, 90);
    assert.strictEqual(f.ende, '2026-08-18T15:30:00.000Z', 'Ende aus fester Dauer falsch: ' + f.ende);
    // Projekt-Rundung schlaegt den Standard: 47 Min auf 15 Min = 60.
    mitProjektSatz('Projekt R', { rundung: 15 }, () => {
      const p = eintrag(db, { ziel_art: 'projekt', ziel_schluessel: 'Projekt R', ende: '2026-08-18T15:00:00.000Z', pause_min: 13 });
      assert.strictEqual(p.gezaehlt_min, 60, 'Projekt-Rundung ignoriert: ' + p.gezaehlt_min);
    });
  });
  // Rundung 1 laesst die Rohzeit stehen.
  mitRundung(1, () => {
    const { db } = zeitDb();
    assert.strictEqual(eintrag(db, { ende: '2026-08-18T15:00:00.000Z', pause_min: 13 }).gezaehlt_min, 47);
  });
}

function testZeitGrenzen() {
  const zeit = require('../zeit');
  const { db } = zeitDb();
  const fall = (d, muster, was) => assert.throws(() => eintrag(db, d), muster, was + ' angenommen');
  fall({ ziel_art: 'xx' }, /Zielart unbekannt/, 'fremde Zielart');
  fall({ ziel_schluessel: ' ' }, /Ziel fehlt/, 'leeres Ziel');
  fall({ ziel_schluessel: 'PROJ 1' }, /Vorgang:/, 'Vorgang mit Leerzeichen');
  fall({ ziel_art: 'projekt', ziel_schluessel: '__proto__' }, /nicht zulaessig/, 'Projekt __proto__');
  fall({ ziel_art: 'intern', ziel_schluessel: 'Urlaub' }, /Interne Tätigkeit/, 'unbekannte interne Tätigkeit');
  fall({ ziel_art: 'kunde', ziel_schluessel: '999' }, /Unbekannter Kontakt/, 'unbekannter Kunde');
  fall({ ende: '2026-08-18T13:00:00.000Z' }, /Ende liegt vor/, 'Ende vor Start');
  fall({ start: 'gestern' }, /Zeitpunkt/, 'Start ohne Datum');
  fall({ pause_min: 120 }, /Pause/, 'Pause laenger als Eintrag');
  fall({ pause_min: -5 }, /Pause/, 'negative Pause');
  fall({ taetigkeit: 'Kaffee' }, /Tätigkeit unbekannt/, 'unbekannte Tätigkeit');
  fall({ notiz: 'x'.repeat(501) }, /Notiz/, 'Notiz zu lang');
  fall({ notiz: 'a\u0007b' }, /Steuerzeichen/, 'Steuerzeichen in der Notiz');
  fall({ ende: '2026-08-19T15:00:00.000Z' }, /24 Stunden/, 'Eintrag ueber 24 h');
  const morgen = new Date(Date.now() + 2 * 3600e3).toISOString();
  fall({ start: morgen, ende: undefined, dauer_fest_min: 30 }, /Zukunft/, 'Beginn in der Zukunft');
  for (const boese of [true, '1e2', [30], ' ', 'abc']) {
    fall({ pause_min: boese }, /Pause/, 'Pause ' + JSON.stringify(boese));
  }
  // Ohne Zeitzone haengt der Tag an der Server-Uhr; unsinnige Jahre sind Tippfehler.
  fall({ start: '2026-08-18T14:00:00', ende: '2026-08-18T15:00:00' }, /Zeitpunkt/, 'Zeitpunkt ohne Zeitzone');
  fall({ start: '1999-08-18T14:00:00.000Z', ende: '1999-08-18T15:00:00.000Z' }, /Zeitpunkt/, 'Jahr 1999');
  assert.strictEqual(eintrag(db, { start: '2026-08-18T16:00:00+02:00', ende: '2026-08-18T17:00:00+02:00' }).start,
    '2026-08-18T14:00:00.000Z', 'Zeitpunkt mit Versatz falsch umgerechnet');
  // Namen landen auf Belegen: kein Zeilenwechsel, keine unsichtbaren Zeichen.
  // (Ein BOM am Rand entfernt trim() schon; geprueft wird das mitten im Namen.)
  for (const name of ['Acme\nIBAN DE00', 'Acme\tB', 'Ac​me', 'Acme‎', 'Ac﻿me']) {
    fall({ ziel_art: 'projekt', ziel_schluessel: name }, /Zeichen/, 'Projektname ' + JSON.stringify(name));
    assert.throws(() => zeit.setzeTaetigkeit(db, { name }), /Zeichen/, 'Tätigkeit ' + JSON.stringify(name));
  }
  // Ein Projekt namens toString bekommt den Standardsatz, keinen geerbten Funktionswert.
  assert.strictEqual(metrics.satzFuerProjekt('toString').quelle, 'standard', 'geerbter Schluessel als Projektsatz');
  assert.strictEqual(metrics.satzFuerProjekt('hasOwnProperty').satz, require('../config.json').stundensatz);
  // Intern ist nie abrechenbar, gleich was mitgeschickt wird.
  const i = eintrag(db, { ziel_art: 'intern', ziel_schluessel: 'Planung', abrechenbar: true });
  assert.strictEqual(i.abrechenbar, 0, 'interner Eintrag abrechenbar');
  // Kunde ueber die Kontakt-Id.
  const k = require('../kontakte').speichere(db, { firma: 'Kunde GmbH' });
  assert.strictEqual(eintrag(db, { ziel_art: 'kunde', ziel_schluessel: String(k.id) }).ziel_schluessel, String(k.id));
  // Vorgaenge werden gross geschrieben wie beim Buchen.
  assert.strictEqual(eintrag(db, { ziel_schluessel: 'proj-9' }).ziel_schluessel, 'PROJ-9');
  // Aendern und Loeschen.
  const e = eintrag(db);
  const g = zeit.speichere(db, { ...e, notiz: 'neu' }, e.id);
  assert.strictEqual(g.id, e.id);
  assert.strictEqual(g.notiz, 'neu');
  zeit.loesche(db, e.id);
  assert.throws(() => zeit.loesche(db, e.id), /nicht gefunden/, 'Loeschen eines fehlenden Eintrags still');
}

// CSV-Export: der Arbeitswert enthaelt manuelle Zeit, also muss die CSV sie
// zeigen — sonst geht Stunden x Satz beim Nachrechnen nicht auf. Neue Spalten
// am Ende, damit bestehende Auswertungen nicht verrutschen.
function testCsvManuelleZeit() {
  const { csvExport } = require('../server');
  mitZeitmodell(5, 'aktivitaet', () => mitRundung(5, () => {
    const { db, zeile } = zeitDb();
    for (let min = 0; min <= 60; min += 2) zeile('s1', min, 'Projekt A', 'PROJ-1');
    eintrag(db);
    eintrag(db, { start: '2026-08-18T16:00:00.000Z', ende: '2026-08-18T17:00:00.000Z', abrechenbar: false });
    const t = metrics.byTicket(db, {})[0];
    const [kopf, werte] = csvExport([t], () => '').map((l) => l.split(';'));
    const zahl = (name) => {
      const i = kopf.findIndex((k) => k.startsWith(name));
      assert.ok(i >= 0, 'CSV-Spalte fehlt: ' + name);
      return Number(werte[i].replace(',', '.'));
    };
    assert.strictEqual(zahl('Manuelle Stunden'), 1.5, 'Manuelle Stunden ohne die nicht abrechenbare Stunde');
    assert.ok(Math.abs(zahl('davon Arbeitswert manuell') - t.arbeitswert_manuell) < 0.01, 'davon Arbeitswert manuell');
    assert.ok(t.arbeitswert_manuell > 0 && zahl('davon Arbeitswert manuell') < zahl('Arbeitswert'), 'manueller Anteil nicht kleiner als der Arbeitswert');
    assert.ok(kopf.indexOf('Abo-Anteil USD') < kopf.findIndex((k) => k.startsWith('Manuelle Stunden')), 'neue Spalten nicht am Ende');
  }));
}

// 60 Min Claude auf PROJ-1, dazu 90 Min manuell (nicht ueberlappend): der
// Arbeitswert waechst um 1,5 h x Satz, die Claude-Stunden bleiben.
function testManuellImArbeitswert() {
  mitConfig({ selbstkostenStunde: 40, vergleichsFaktor: 1.2 }, () => mitZeitmodell(5, 'aktivitaet', () => mitRundung(5, () => {
    const { db, zeile } = zeitDb();
    for (let min = 0; min <= 60; min += 2) zeile('s1', min, 'Projekt A', 'PROJ-1');
    const vorher = metrics.byTicket(db, {})[0];
    eintrag(db);
    eintrag(db, { start: '2026-08-18T16:00:00.000Z', ende: '2026-08-18T17:00:00.000Z', abrechenbar: false });
    const t = metrics.byTicket(db, {})[0];
    assert.strictEqual(t.active_seconds, vorher.active_seconds, 'Claude-Zeit veraendert');
    assert.strictEqual(t.manuell_hours, 1.5, 'manuell_hours ' + t.manuell_hours);
    assert.strictEqual(t.manuell_nicht_hours, 1, 'nicht abrechenbare Stunden ' + t.manuell_nicht_hours);
    assert.ok(Math.abs(t.arbeitswert_claude - vorher.arbeitswert) < 1e-9, 'Claude-Anteil veraendert');
    assert.ok(Math.abs(t.arbeitswert - (vorher.arbeitswert + 1.5 * t.stundensatz)) < 1e-9,
      'Arbeitswert ' + t.arbeitswert + ' statt Claude + 1,5 h (nicht abrechenbare Zeit mitgezaehlt?)');
    // Eigene Zeit fuer die Marge: Claude + manuell + nicht abrechenbar.
    const w = metrics.mehrwert(t, 0);
    assert.ok(Math.abs(w.zeitkosten - (t.active_hours + 1.5 + 1) * 40) < 1e-9, 'Zeitkosten ohne manuelle Zeit: ' + w.zeitkosten);
    // Vergleichsaufwand bleibt bei der KI-Zeit.
    assert.ok(Math.abs(w.vergleich_stunden - t.active_hours * 1.2) < 1e-9, 'Vergleichsaufwand zaehlt manuelle Zeit');
    // Projekt-Sicht zaehlt die Vorgangszeit ihres Projekts mit.
    const p = metrics.byProject(db, {}).find((r) => r.project === 'Projekt A');
    assert.strictEqual(p.manuell_hours, 1.5, 'Projekt ohne manuelle Vorgangszeit');
    assert.ok(Math.abs(p.arbeitswert - t.arbeitswert) < 1e-9);
    // Hub: Summe wie je Vorgang, manuelle Stunden getrennt ausgewiesen.
    const k = metrics.kennzahlen(metrics.byTicket(db, {}).concat(metrics.ohneTicket(db, {})), {});
    assert.ok(Math.abs(k.wert.arbeitswert - t.arbeitswert) < 1e-9, 'Hub-Arbeitswert ohne manuelle Zeit');
    assert.strictEqual(k.manuell_stunden, 1.5);
    assert.strictEqual(k.aktive_stunden, t.active_hours, 'aktive Stunden enthalten manuelle Zeit');
    // Gestellte Rechnung: nur der Claude-Anteil ist abgerechnet, die manuelle Zeit bleibt offen.
    const ka = metrics.kennzahlen(metrics.byTicket(db, {}), { 'PROJ-1': { betrag_eur: 1, nummern: ['2026-0001'] } });
    assert.ok(Math.abs(ka.abgerechnet_eur - t.arbeitswert_claude) < 1e-9, 'manuelle Zeit gilt als abgerechnet');
    assert.ok(Math.abs(ka.offen_eur - 1.5 * t.stundensatz) < 1e-9, 'offen ohne manuelle Zeit');
    // Zeitraum ausserhalb: nichts.
    assert.strictEqual(metrics.byTicket(db, { from: '2026-09-01', to: '2026-09-30' }).length, 0, 'Eintrag ausserhalb des Zeitraums gezaehlt');
    // Modellfilter: manuelle Zeit gehoert keinem Modell, auch nicht der vorhandenen Zeile.
    assert.strictEqual(metrics.byTicket(db, { model: 'claude-opus-5' })[0].manuell_hours, 0, 'manuelle Zeit unter Modellfilter');
    // Jira: neuer Eintrag aendert den Fingerabdruck, ohne Eintrag bleibt er wie bisher.
    const jira = require('../jira-sync');
    assert.notStrictEqual(jira.fingerprint(t), jira.fingerprint(vorher), 'Jira sieht manuelle Zeit nicht');
    assert.ok(!jira.fingerprint(vorher).endsWith('|0|0'), 'Fingerabdruck ohne Eintrag veraendert');
  })));
}

// Ziele ohne einen Claude-Request erscheinen trotzdem: Vorgang, Projekt, Kunde.
// Interne Zeit erscheint nirgends als Wert, nur als Kosten.
function testManuellOhneEvents() {
  mitConfig({ selbstkostenStunde: 40 }, () => mitRundung(5, () => {
    const { db } = zeitDb();
    const cfg = require('../config.json');
    eintrag(db, { ziel_schluessel: 'NEU-1' });
    eintrag(db, { ziel_art: 'projekt', ziel_schluessel: 'Nur Manuell' });
    const k = require('../kontakte').speichere(db, { firma: 'Kunde GmbH' });
    eintrag(db, { ziel_art: 'kunde', ziel_schluessel: String(k.id), ende: '2026-08-18T15:00:00.000Z' });
    eintrag(db, { ziel_art: 'intern', ziel_schluessel: 'Planung', ende: '2026-08-18T16:00:00.000Z' });
    const t = metrics.byTicket(db, {});
    assert.deepStrictEqual(t.map((r) => r.ticket), ['NEU-1'], 'Vorgang nur mit manueller Zeit fehlt');
    assert.strictEqual(t[0].manuell_hours, 1.5);
    assert.strictEqual(t[0].sessions, 0);
    assert.strictEqual(t[0].first_day, '2026-08-18');
    assert.ok(Math.abs(t[0].arbeitswert - 1.5 * cfg.stundensatz) < 1e-9);
    assert.ok(Number.isFinite(t[0].abo_anteil_usd) && t[0].abo_anteil_usd === 0, 'Abo-Anteil NaN');
    const o = metrics.ohneTicket(db, {});
    const proj = o.find((r) => r.gruppe === 'Nur Manuell');
    assert.ok(proj && proj.art === 'projekt' && proj.manuell_hours === 1.5, 'Projekt nur mit manueller Zeit fehlt');
    const kun = o.find((r) => r.art === 'kunde');
    assert.ok(kun && kun.gruppe === 'Kunde GmbH' && kun.kunde_id === k.id && kun.manuell_hours === 1, 'Kundenzeile fehlt');
    assert.ok(Math.abs(kun.arbeitswert - cfg.stundensatz) < 1e-9, 'Kunde ohne Projekt nicht zum Standardsatz');
    assert.ok(!o.some((r) => r.gruppe === 'Planung'), 'interne Zeit als Zeile');
    const kz = metrics.kennzahlen(t.concat(o), {}, require('../zeit').kennzahlenZusatz(db, {}));
    assert.strictEqual(kz.intern_stunden, 2, 'interne Stunden ' + kz.intern_stunden);
    assert.ok(Math.abs(kz.wert.arbeitswert - (1.5 + 1.5 + 1) * cfg.stundensatz) < 1e-9, 'interne Zeit im Arbeitswert');
    assert.ok(Math.abs(kz.wert.zeitkosten - (1.5 + 1.5 + 1 + 2) * 40) < 1e-9, 'interne Zeit fehlt in den Zeitkosten: ' + kz.wert.zeitkosten);
    // Modellfilter: manuelle Zeit gehoert keinem Modell, keine erfundenen Zeilen.
    assert.strictEqual(metrics.byTicket(db, { model: 'claude-opus-5' }).length, 0);
    // Interne Zeit gehoert keinem Projekt: eine gefilterte Sicht zaehlt sie nicht.
    assert.strictEqual(require('../zeit').kennzahlenZusatz(db, { project: 'Nur Manuell' }).intern_stunden, 0, 'interne Zeit in der Projektsicht');
    // Werkzeugbetrieb ist keine Arbeit: eine Buchung dort verschwaende still.
    assert.throws(() => eintrag(db, { ziel_art: 'projekt', ziel_schluessel: '(lokal)' }), /Werkzeug/, 'Werkzeugprojekt als Ziel angenommen');
  }));
}

// Ohne einen einzigen Eintrag bleibt jede Zahl, wie sie war.
function testOhneEintraegeUnveraendert() {
  mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile } = zeitDb();
    for (let min = 0; min <= 30; min += 2) zeile('s1', min, 'Projekt A', 'PROJ-1', 1);
    for (let min = 40; min <= 70; min += 2) zeile('s2', min, 'Projekt B', null, 1);
    for (const r of metrics.byTicket(db, {}).concat(metrics.ohneTicket(db, {}), metrics.byProject(db, {}))) {
      assert.strictEqual(r.manuell_hours, 0, 'manuell_hours ohne Eintrag');
      assert.strictEqual(r.arbeitswert, r.arbeitswert_claude, 'Arbeitswert weicht ohne Eintrag ab');
      assert.ok(Math.abs(r.arbeitswert - (r.active_seconds / 3600) * r.stundensatz) < 1e-9, 'Arbeitswert nicht mehr Zeit x Satz');
    }
    assert.strictEqual(metrics.byTicket(db, {}).length, 1);
    assert.strictEqual(metrics.ohneTicket(db, {}).length, 1);
  });
}

function testZeitTimer() {
  const zeit = require('../zeit');
  mitRundung(5, () => {
    const { db } = zeitDb();
    const t0 = Date.parse('2026-08-18T09:00:00.000Z');
    assert.strictEqual(zeit.timerAktuell(db, t0), null);
    assert.throws(() => zeit.timerStop(db, t0), /Kein Timer/);
    assert.throws(() => zeit.timerStart(db, { ziel_art: 'xx', ziel_schluessel: 'A', taetigkeit: 'Entwicklung' }, t0), /Zielart/, 'Timer ohne gueltiges Ziel');
    const a = zeit.timerStart(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', taetigkeit: 'Entwicklung', notiz: 'A' }, t0);
    assert.strictEqual(a.gebucht, null);
    assert.strictEqual(zeit.timerAktuell(db, t0 + 12 * 60e3).laeuft_min, 12);
    // Zweiter Start bucht den laufenden zuerst.
    const b = zeit.timerStart(db, { ziel_art: 'projekt', ziel_schluessel: 'Projekt B', taetigkeit: 'Review' }, t0 + 32 * 60e3);
    assert.ok(b.gebucht, 'laufender Timer nicht gebucht');
    assert.strictEqual(b.gebucht.rohzeit_min, 32);
    assert.strictEqual(b.gebucht.gezaehlt_min, 35, 'Timer-Buchung nicht gerundet');
    assert.strictEqual(b.gebucht.notiz, 'A');
    assert.strictEqual(zeit.timerAktuell(db, t0 + 33 * 60e3).ziel_schluessel, 'Projekt B');
    // Unter einer Minute: verworfen, kein Eintrag.
    const n = db.prepare('SELECT COUNT(*) n FROM zeit_eintrag').get().n;
    assert.deepStrictEqual(zeit.timerStop(db, t0 + 32 * 60e3 + 30e3), { verworfen: true });
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM zeit_eintrag').get().n, n, 'verworfener Timer hat gebucht');
    assert.strictEqual(zeit.timerAktuell(db, t0), null);
    // Stop mit Buchung, danach leer.
    zeit.timerStart(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', taetigkeit: 'Entwicklung' }, t0 + 40 * 60e3);
    const s = zeit.timerStop(db, t0 + 50 * 60e3);
    assert.strictEqual(s.eintrag.gezaehlt_min, 10);
    // Verwerfen ohne Buchung.
    zeit.timerStart(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', taetigkeit: 'Entwicklung' }, t0 + 60 * 60e3);
    zeit.timerVerwerfen(db);
    assert.strictEqual(zeit.timerAktuell(db, t0), null);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM zeit_eintrag').get().n, n + 1);
    // Kaputte meta-Zeile: kein Absturz, kein Timer.
    for (const roh of ['null', '{}', '[]', '{"start":"gestern"}', 'kein json']) {
      dbmod.setMeta(db, 'timer', roh);
      assert.strictEqual(zeit.timerAktuell(db, t0), null, 'kaputter Timer ' + roh + ' gilt als laufend');
    }
    // Ein laufender Timer, der sich nicht mehr buchen laesst (ueber 24 h), blockiert
    // den naechsten Start mit einem Hinweis aufs Verwerfen — er wird nicht still geloescht.
    zeit.timerVerwerfen(db);
    zeit.timerStart(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', taetigkeit: 'Entwicklung' }, t0);
    assert.throws(() => zeit.timerStart(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-2', taetigkeit: 'Entwicklung' }, t0 + 25 * 3600e3),
      /verwerfen/, 'Hinweis aufs Verwerfen fehlt');
    assert.strictEqual(zeit.timerAktuell(db, t0 + 25 * 3600e3).ziel_schluessel, 'PROJ-1', 'alter Timer still verloren');
    zeit.timerVerwerfen(db);
  });
}

function testTaetigkeitsarten() {
  const zeit = require('../zeit');
  const { db } = zeitDb();
  assert.deepStrictEqual(zeit.taetigkeiten(db).map((t) => t.name),
    ['Begleiten', 'Entwicklung', 'Konzept', 'Meeting', 'Review', 'Support']);
  assert.strictEqual(zeit.taetigkeiten(db).find((t) => t.name === 'Meeting').parallel, 1, 'Meeting nicht parallel');
  // Geloeschte Saat kommt beim naechsten Start nicht zurueck.
  zeit.loescheTaetigkeit(db, 'Support');
  dbmod.migrate(db);
  assert.ok(!zeit.taetigkeiten(db).some((t) => t.name === 'Support'), 'Saat kam zurueck');
  // Eigener Satz: leer = Projektsatz, Zahl wird uebernommen, Unsinn prallt ab.
  assert.strictEqual(zeit.setzeTaetigkeit(db, { name: 'Beratung', satz: ' 120 ' }).satz, 120);
  assert.strictEqual(zeit.setzeTaetigkeit(db, { name: 'Doku', satz: '' }).satz, null);
  for (const boese of [true, [5], '1e3', -1, 10001]) {
    assert.throws(() => zeit.setzeTaetigkeit(db, { name: 'X', satz: boese }), /Satz/, 'Satz ' + JSON.stringify(boese));
  }
  assert.throws(() => zeit.setzeTaetigkeit(db, { name: ' ' }), /Name fehlt/);
  assert.throws(() => zeit.setzeTaetigkeit(db, { name: 'x'.repeat(41) }), /Name/);
  // Eigener Satz gilt im Arbeitswert statt des Projektsatzes.
  mitRundung(5, () => {
    eintrag(db, { ziel_schluessel: 'NEU-2', taetigkeit: 'Beratung' });
    const t = metrics.byTicket(db, {}).find((r) => r.ticket === 'NEU-2');
    assert.ok(Math.abs(t.arbeitswert - 1.5 * 120) < 1e-9, 'Tätigkeitssatz ignoriert: ' + t.arbeitswert);
  });
  assert.throws(() => zeit.loescheTaetigkeit(db, 'Beratung'), /verwendet/, 'verwendete Tätigkeit geloescht');
}

// Einstellungen und Projektsatz: Grenzen fuer die Rundung und das Tagessoll.
function testZeitEinstellungen() {
  configGeschuetzt(() => {
    const srv = require('../server');
    const zeit = require('../zeit');
    assert.throws(() => srv.setzeEinstellungen({ rundungMinuten: 0 }), /Rundung/);
    assert.throws(() => srv.setzeEinstellungen({ rundungMinuten: 61 }), /Rundung/);
    for (const halb of [7.5, '7.5']) {
      assert.throws(() => srv.setzeEinstellungen({ rundungMinuten: halb }), /ganze Zahl/, 'Rundung ' + halb + ' angenommen');
    }
    // Standard bewusst anders als die Projekt-Rundung unten, sonst sieht die
    // Pruefung "Rundung bleibt stehen" keinen Unterschied.
    assert.strictEqual(srv.setzeEinstellungen({ rundungMinuten: 10 }).rundungMinuten, 10);
    assert.throws(() => srv.setzeEinstellungen({ tagessollStunden: 25 }), /Tagessoll/);
    assert.throws(() => srv.setzeSatz({ projekt: 'Projekt R', rundung: 61 }), /Rundung/);
    assert.throws(() => srv.setzeSatz({ projekt: 'Projekt R', rundung: '7,5' }), /Rundung/);
    srv.setzeSatz({ projekt: 'Projekt R', rundung: 15 });
    const { db } = zeitDb();
    assert.strictEqual(zeit.rundungFuer(db, 'projekt', 'Projekt R'), 15);
    // Satzaenderung ohne Rundungsfeld laesst die Rundung stehen.
    srv.setzeSatz({ projekt: 'Projekt R', satz: 90 });
    assert.strictEqual(zeit.rundungFuer(db, 'projekt', 'Projekt R'), 15, 'Satzaenderung loescht die Rundung');
    srv.setzeSatz({ projekt: 'Projekt R', satz: 90, rundung: '' });
    assert.strictEqual(zeit.rundungFuer(db, 'projekt', 'Projekt R'), zeit.rundungFuer(db, 'kunde', '1'), 'leere Rundung nicht zurueckgesetzt');
  });
}

// Belege: die Vorgangsposition bleibt Claude-Zeit x Satz. Manuelle Zeit kommt
// erst als eigene Position (Block Z3) — bis dahin nie versteckt im Betrag.
function testBelegOhneManuelleZeit() {
  const rechnung = require('../rechnung');
  rechnungsUmgebung(() => {
    const db = rechnungsDb();
    mitRundung(5, () => eintrag(db, { ziel_schluessel: 'PROJ-500', start: '2026-08-10T14:00:00.000Z', ende: '2026-08-10T16:00:00.000Z' }));
    const pos = rechnung.baue(db, { from: '2026-08-01', to: '2026-08-31', tickets: ['PROJ-500'] })
      .find((p) => p.ticket === 'PROJ-500');
    assert.ok(Math.abs(pos.betrag_eur - Math.round(pos.stunden * pos.satz * 100) / 100) < 0.011,
      'Position: ' + pos.stunden + ' h x ' + pos.satz + ' ergibt nicht ' + pos.betrag_eur + ' (manuelle Zeit im Betrag?)');
    db.close();
  });
}

// Routen: Ablehnungen kommen als 400 mit deutschem Text, nicht als 404.
// Nur Ablehnungen — der Testserver haengt an der echten Datenbank.
// --- Kalender (Block Z6a): ICS/CalDAV lesen, Termine in der Woche ----------
const kalender = require('../kalender');
const KAL_ICS = fs.readFileSync(path.join(__dirname, 'fixtures', 'kalender.ics'), 'utf8');
// Horizont des Fixtures: 13.08. bis 17.09.2026 (heute = 20.08. 12:00 UTC).
const KAL_JETZT = Date.UTC(2026, 7, 20, 12, 0, 0);
const lokal = (...a) => new Date(2026, ...a).toISOString();  // TZID-Zeiten gelten als Ortszeit des Servers

function testIcsParser() {
  for (const [art, text] of [['LF', KAL_ICS], ['CRLF', KAL_ICS.replace(/\r?\n/g, '\r\n')]]) {
    const ev = kalender.parseIcs(text);
    const v = kalender.vorkommen(ev, Date.UTC(2026, 7, 13), Date.UTC(2026, 8, 18));
    const je = (uid) => v.filter((x) => x.uid.split('#')[0] === uid);
    // Faltung und Escapes: die Folgezeile verliert genau ein Leerzeichen.
    // Gegenprobe: Faltung ohne Entfernen des Leerzeichens -> "mit  langem".
    assert.strictEqual(je('einzel-1')[0].titel, 'PROJ-12 Review, Teil 1 mit langem Titel', art + ': Titel ' + JSON.stringify(je('einzel-1')[0].titel));
    assert.deepStrictEqual([je('einzel-1')[0].start, je('einzel-1')[0].ende], ['2026-08-18T08:00:00.000Z', '2026-08-18T09:00:00.000Z'], art + ': UTC-Zeit');
    // Ganztaegig: Datum ohne Uhrzeit, ganztag = 1.
    const g = je('ganz-1')[0];
    assert.deepStrictEqual([g.ganztag, g.start.slice(0, 10), g.ende.slice(0, 10)], [1, '2026-08-19', '2026-08-20'], art + ': ganztaegig ' + JSON.stringify(g));
    // WEEKLY BYDAY=MO,WE COUNT=4 minus EXDATE am 19.08. -> Mo 17., Mo 24., Mi 26.
    // Gegenprobe: EXDATE ignorieren -> 4 Vorkommen.
    assert.deepStrictEqual(je('serie-1').map((x) => x.start), [lokal(7, 17, 10), lokal(7, 24, 10), lokal(7, 26, 10)], art + ': Serie ' + JSON.stringify(je('serie-1').map((x) => x.start)));
    assert.strictEqual(je('serie-1')[0].ende, lokal(7, 17, 10, 30), art + ': Serienende');
    // Andere FREQ: ein Vorkommen und ein Hinweis.
    assert.deepStrictEqual([je('monat-1').length, je('monat-1')[0].rrule_ignoriert], [1, true], art + ': MONTHLY');
    assert.strictEqual(je('abgesagt-1').length, 0, art + ': abgesagter Termin bleibt drin');
    // DAILY INTERVAL=2 UNTIL 26.08. -> 20., 22., 24., 26.; der 22. ist verschoben (RECURRENCE-ID).
    assert.deepStrictEqual(je('serie-2').map((x) => x.start), ['2026-08-20T07:00:00.000Z', '2026-08-22T09:00:00.000Z', '2026-08-24T07:00:00.000Z', '2026-08-26T07:00:00.000Z'],
      art + ': Tagesserie ' + JSON.stringify(je('serie-2').map((x) => x.start)));
    assert.strictEqual(je('serie-2')[1].titel, 'Standup verschoben', art + ': Ausnahme der Serie');
    // VALARM ist verschachtelt: sein SUMMARY ueberschreibt nicht den Termin.
    assert.deepStrictEqual([je('alarm-1')[0].titel, je('alarm-1')[0].art], ['Fokus Beispielprojekt', 'blocker'], art + ': VALARM/Blocker');
    assert.strictEqual(je('einzel-1')[0].art, 'meeting', art + ': ohne Blocker-Wort ein Meeting');
    // Eindeutige Schluessel je Vorkommen (Primaerschluessel der Tabelle).
    assert.strictEqual(new Set(v.map((x) => x.uid)).size, v.length, art + ': doppelte uid');
  }
  // Horizont: nichts ausserhalb.
  const v = kalender.vorkommen(kalender.parseIcs(KAL_ICS), Date.UTC(2026, 7, 25), Date.UTC(2026, 7, 26));
  assert.deepStrictEqual(v.map((x) => x.uid.split('#')[0]).sort(), ['alarm-1'], 'Horizont 25.08.: ' + JSON.stringify(v.map((x) => x.uid)));
}

function testRateZiel() {
  const ctx = { projekte: ['Beispielprojekt', 'Beispiel'], kunden: [{ id: 7, firma: 'Beispielkunde' }] };
  const r = (t) => kalender.rateZiel(t, ctx);
  assert.deepStrictEqual(r('PROJ-12 Review'), { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-12' });
  // Gegenprobe: Treffer ohne Wortgrenze -> PROJ-12 statt PROJ-123.
  assert.deepStrictEqual(r('Sync zu PROJ-123'), { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-123' });
  // Laengster Projektname gewinnt, nur als ganzes Wort.
  assert.deepStrictEqual(r('Beispielprojekt Sync'), { ziel_art: 'projekt', ziel_schluessel: 'Beispielprojekt' });
  assert.deepStrictEqual(r('Jour fixe Beispielkunde'), { ziel_art: 'kunde', ziel_schluessel: '7' });
  assert.strictEqual(r('Beispielprojekte planen'), null, 'Teilwort als Projekt erkannt');
  // Gegenprobe: Wortanfang nicht pruefen -> "Testbeispiel" passt auf Projekt "Beispiel".
  assert.strictEqual(r('Testbeispiel Sync'), null, 'Wortanfang nicht geprueft');
  assert.strictEqual(r('Mittagessen'), null);
  // Mit bekannten Vorgaengen: nur die zaehlen, und nur als ganzes Wort.
  // Gegenprobe: tickets ignorieren -> "Q3-2026" wird ein Vorgang.
  const mit = { ...ctx, tickets: new Set(['PROJ-12', 'GHIJKLMNOP-12']) };
  assert.strictEqual(kalender.rateZiel('Review Q3-2026', mit), null, 'Quartal als Vorgang');
  assert.strictEqual(kalender.rateZiel('UTF-8 Umstellung', mit), null, 'Zeichensatz als Vorgang');
  assert.strictEqual(kalender.rateZiel('ABCDEFGHIJKLMNOP-12', mit), null, 'Treffer mitten im Wort');
  assert.deepStrictEqual(kalender.rateZiel('Q3-2026: PROJ-12 Review', mit), { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-12' });
}

async function testKalenderSync() {
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  db.prepare("INSERT INTO kontakte (firma, status, erstellt_am) VALUES ('Beispielkunde', 'kunde', '2026-08-01')").run();
  // PROJ-12 ist ein bekannter Vorgang (nur bekannte werden aus Titeln geraten).
  db.prepare(`INSERT INTO events (request_id, ts, session_id, project, ticket, model, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
    VALUES ('k1', '2026-08-19T10:00:00.000Z', 's-k', 'Testprojekt', 'PROJ-12', 'claude-opus-5', 1, 1, 0, 0, 0, 0, 0, 0, '2026-08-19')`).run();
  const konto = { id: 'privat', name: 'Privat', art: 'ics', url: 'https://kalender.invalid/geheim.ics' };
  const holen = (text) => async () => kalender.parseIcs(text);
  kalender.speichereTermin(db, { titel: 'Eigener Blocker', art: 'blocker', start: '2026-08-21T08:00:00.000Z', ende: '2026-08-21T09:00:00.000Z' });

  let e = await kalender.sync(db, konto, { jetzt: KAL_JETZT, holen: holen(KAL_ICS) });
  assert.deepStrictEqual([e.ok, e.anzahl, e.rrule_ignoriert], [true, 11, 1], 'erster Abgleich ' + JSON.stringify(e));
  const zeile = (uid) => db.prepare("SELECT * FROM termin WHERE kalender_id = 'privat' AND uid = ?").get(uid);
  assert.deepStrictEqual([zeile('einzel-1').ziel_art, zeile('einzel-1').ziel_schluessel, zeile('einzel-1').quelle], ['vorgang', 'PROJ-12', 'kalender']);
  const kunde = db.prepare("SELECT ziel_art, ziel_schluessel FROM termin WHERE uid LIKE 'serie-1#%' LIMIT 1").get();
  assert.deepStrictEqual([kunde.ziel_art, kunde.ziel_schluessel], ['kunde', '1'], 'Kunde aus den Kontakten');

  // Von Hand zugeordnet: bleibt beim naechsten Abgleich stehen.
  kalender.setzeZiel(db, { kalender_id: 'privat', uid: 'ganz-1', ziel_art: 'projekt', ziel_schluessel: 'Urlaubsprojekt' });
  // Termin aus dem Kalender geloescht -> verschwindet hier; der lokale bleibt.
  // Gegenprobe: Loesch-Abgleich weglassen -> einzel-1 bleibt, Test rot.
  // \r?: unter Windows checkt git (autocrlf) diese Datei mit CRLF aus.
  const ohne = KAL_ICS.replace(/BEGIN:VEVENT\r?\nUID:einzel-1[\s\S]*?END:VEVENT\r?\n/, '');
  e = await kalender.sync(db, konto, { jetzt: KAL_JETZT, holen: holen(ohne) });
  assert.strictEqual(e.anzahl, 10, 'zweiter Abgleich ' + JSON.stringify(e));
  assert.strictEqual(zeile('einzel-1'), undefined, 'geloeschter Kalendertermin bleibt stehen');
  assert.deepStrictEqual([zeile('ganz-1').ziel_art, zeile('ganz-1').ziel_schluessel], ['projekt', 'Urlaubsprojekt'], 'Zuordnung von Hand ueberschrieben');
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM termin WHERE quelle = 'lokal'").get().n, 1, 'lokaler Termin vom Abgleich geloescht');

  // Fehler beim Holen: nichts loeschen, Status mit Fehler und ohne URL.
  const okAm = e.at;
  e = await kalender.sync(db, konto, { jetzt: KAL_JETZT, holen: async () => { throw new kalender.KalenderFehler('HTTP 503'); } });
  assert.deepStrictEqual([e.ok, /503/.test(e.fehler)], [false, true], 'Fehler ' + JSON.stringify(e));
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM termin WHERE kalender_id = 'privat'").get().n, 10, 'Fehler hat Termine geloescht');
  const st = kalender.status(db, [konto]);
  assert.deepStrictEqual([st[0].id, st[0].ok, st[0].anzahl, st[0].letzter_ok], ['privat', false, 10, okAm], 'Status ' + JSON.stringify(st));
  assert.ok(!JSON.stringify(st).includes('geheim'), 'Status verraet die Kalenderadresse');
  assert.strictEqual(st[0].host, 'kalender.invalid');
  // Fremder Fehler (Programm, Datenbank): kein Rohtext nach aussen, Adresse schon gar nicht.
  e = await kalender.sync(db, konto, { jetzt: KAL_JETZT, holen: async () => { throw new Error('intern https://kalender.invalid/geheim.ics'); } });
  assert.deepStrictEqual([e.ok, e.fehler], [false, 'Abgleich fehlgeschlagen (Details im Serverprotokoll).'], 'interner Fehler ' + JSON.stringify(e));
  // Status gilt nur fuer dieselbe Konfiguration: andere Adresse = noch nicht abgeglichen.
  assert.strictEqual(kalender.status(db, [{ ...konto, url: 'https://anders.invalid/x.ics' }])[0].ok, null, 'Status einer alten Adresse');
  // Konto aus der Konfiguration genommen: Termine sind verwaist und werden gemeldet.
  assert.deepStrictEqual(kalender.verwaist(db, []), [{ kalender_id: 'privat', anzahl: 10 }]);

  // Serie zeitlich verschoben (10:00 -> 11:00): die uid haengt am Tag, die Zuordnung von Hand bleibt.
  const s24 = db.prepare("SELECT uid FROM termin WHERE uid LIKE 'serie-1#%' ORDER BY start LIMIT 1 OFFSET 1").get().uid;
  kalender.setzeZiel(db, { kalender_id: 'privat', uid: s24, ziel_art: 'projekt', ziel_schluessel: 'Verschoben' });
  e = await kalender.sync(db, konto, { jetzt: KAL_JETZT, holen: holen(ohne.replace(/T100000/g, 'T110000').replace('T103000', 'T113000')) });
  const z24 = zeile(s24);
  // Gegenprobe: uid mit Uhrzeit -> Zeile neu angelegt, Zuordnung weg.
  assert.ok(z24 && z24.ziel_schluessel === 'Verschoben' && z24.start === lokal(7, 24, 11), 'Zuordnung nach Zeitverschiebung ' + JSON.stringify(z24));

  // Leere Antwort: erst beim zweiten Mal in Folge gilt "leer" als gewollt.
  // Gegenprobe: Leerschutz weglassen -> beim ersten Mal alles weg.
  e = await kalender.sync(db, konto, { jetzt: KAL_JETZT, holen: async () => [] });
  assert.deepStrictEqual([e.ok, e.leer, db.prepare("SELECT COUNT(*) AS n FROM termin WHERE kalender_id = 'privat'").get().n], [false, true, 10], 'erste leere Antwort ' + JSON.stringify(e));
  e = await kalender.sync(db, konto, { jetzt: KAL_JETZT, holen: async () => [] });
  assert.deepStrictEqual([e.ok, db.prepare("SELECT COUNT(*) AS n FROM termin WHERE kalender_id = 'privat'").get().n], [true, 0], 'zweite leere Antwort ' + JSON.stringify(e));
}

// Was eine praeparierte Einladung oder ein kaputter Feed anrichten koennte.
function testIcsHaertung() {
  const kal = (...ev) => 'BEGIN:VCALENDAR\r\n' + ev.map((x) => 'BEGIN:VEVENT\r\n' + x.join('\r\n') + '\r\nEND:VEVENT\r\n').join('') + 'END:VCALENDAR\r\n';
  const H = [Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 15)];
  // Login-Seite mit HTTP 200 ist kein Kalender. Gegenprobe: Pruefung weg -> [] und der Abgleich loescht.
  assert.throws(() => kalender.alsIcs('<html><body>Bitte anmelden</body></html>'), /kein Kalender/);
  assert.strictEqual(kalender.alsIcs('\u{FEFF}' + kal(['UID:a', 'DTSTART:20261002T080000Z'])).length, 1, 'BOM vor BEGIN:VCALENDAR');
  // EXDATE als Datum gegen eine Serie mit Uhrzeit.
  let v = kalender.vorkommen(kalender.parseIcs(kal(['UID:x', 'DTSTART:20261005T090000Z', 'DTEND:20261005T100000Z', 'RRULE:FREQ=DAILY;COUNT=3', 'EXDATE;VALUE=DATE:20261006'])), ...H);
  assert.deepStrictEqual(v.map((x) => x.start.slice(0, 10)), ['2026-10-05', '2026-10-07'], 'EXDATE als Datum ' + JSON.stringify(v.map((x) => x.start)));
  // DAILY mit BYDAY: nur die genannten Wochentage, ausgelassene zaehlen nicht in COUNT.
  v = kalender.vorkommen(kalender.parseIcs(kal(['UID:d', 'DTSTART:20261005T090000Z', 'RRULE:FREQ=DAILY;BYDAY=MO,TU;COUNT=3'])), ...H);
  assert.deepStrictEqual(v.map((x) => x.start.slice(0, 10)), ['2026-10-05', '2026-10-06', '2026-10-12'], 'DAILY BYDAY ' + JSON.stringify(v.map((x) => x.start)));
  // Ohne Ende (RFC: Dauer 0) bekommt der Termin 15 Minuten, damit Woche und Abgleich ihn sehen.
  assert.strictEqual(v[0].ende, '2026-10-05T09:15:00.000Z', 'Termin ohne Ende ' + v[0].ende);
  // Steuer- und Bidi-Zeichen fliegen aus dem Titel.
  const t = kalender.parseIcs(kal(['UID:s', 'DTSTART:20261002T080000Z', 'SUMMARY:Re\u{202E}view\x07 \\nTeil 2']))[0].titel;
  assert.strictEqual(t, 'Re view Teil 2', 'Titel ' + JSON.stringify(t));
  // Riesige Dauer und Jahr 9999: nur dieser Termin faellt weg, der Rest bleibt.
  // Gegenprobe: Obergrenze der Dauer weg -> "jahr" (400 Tage) bleibt.
  const p = kalender.parseIcs(kal(['UID:gross', 'DTSTART:20261002T080000Z', 'DURATION:P999999999999W'], ['UID:jahr', 'DTSTART:20261002T080000Z', 'DURATION:P400D'],
    ['UID:spaet', 'DTSTART:99991231T080000Z'], ['UID:gut', 'DTSTART:20261002T080000Z']));
  assert.deepStrictEqual([p.map((x) => x.uid), p.verworfen], [['gut'], 3], 'verworfen ' + JSON.stringify([p.map((x) => x.uid), p.verworfen]));
  // Serie seit 1990 ohne COUNT: richtige Vorkommen im Horizont, ohne 13 000 Schritte.
  // Gegenprobe: Sprung zum Horizont um einen Schritt verrechnet -> falscher erster Tag.
  const t0 = Date.now();
  v = kalender.vorkommen(kalender.parseIcs(kal(['UID:alt', 'DTSTART:19900101T070000Z', 'RRULE:FREQ=DAILY;INTERVAL=3'])), ...H);
  const erwartet = [];
  for (let s = Date.UTC(1990, 0, 1, 7); s < H[1]; s += 3 * 86400000) if (s >= H[0]) erwartet.push(new Date(s).toISOString());
  assert.deepStrictEqual(v.map((x) => x.start), erwartet, 'alte Tagesserie');
  // BYDAY tausendfach wiederholt: entdoppelt, schnell.
  v = kalender.vorkommen(kalender.parseIcs(kal(['UID:w', 'DTSTART:20000103T070000Z', 'RRULE:FREQ=WEEKLY;BYDAY=' + Array(1000).fill('MO').join(',')])), ...H);
  assert.deepStrictEqual(v.map((x) => x.start.slice(0, 10)), ['2026-10-05', '2026-10-12'], 'BYDAY doppelt ' + JSON.stringify(v.map((x) => x.start)));
  assert.ok(Date.now() - t0 < 500, 'Serien brauchen ' + (Date.now() - t0) + ' ms');
  // Monatsserie seit 2020: kein Vorkommen im Horizont, trotzdem als ignoriert gezaehlt.
  v = kalender.vorkommen(kalender.parseIcs(kal(['UID:m', 'DTSTART:20200110T070000Z', 'RRULE:FREQ=MONTHLY'])), ...H);
  assert.deepStrictEqual([v.length, v.ignoriert], [0, 1], 'Monatsserie ' + JSON.stringify([v.length, v.ignoriert]));
  // CalDAV: selbstschliessendes Element, Hex-Zeichen, CDATA, Zeichen ueber U+FFFF.
  const xml = '<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    '<d:response><d:propstat><d:prop><c:calendar-data/></d:prop><d:status>HTTP/1.1 404</d:status></d:propstat></d:response>' +
    '<d:response><d:propstat><d:prop><c:calendar-data>BEGIN:VCALENDAR&#xD;\nBEGIN:VEVENT&#xD;\nUID:h1&#xD;\nDTSTART:20261002T080000Z&#xD;\nSUMMARY:A &amp; B &#128512;&#xD;\nEND:VEVENT&#xD;\nEND:VCALENDAR</c:calendar-data></d:prop></d:propstat></d:response>' +
    '<d:response><d:propstat><d:prop><C:calendar-data><![CDATA[BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:h2\nDTSTART:20261003T080000Z\nEND:VEVENT\nEND:VCALENDAR]]></C:calendar-data></d:prop></d:propstat></d:response></d:multistatus>';
  // Gegenprobe: selbstschliessendes Element als Beginn lesen -> erster Block beginnt mit "</d:prop>".
  assert.ok(kalender.calendarData(xml).every((b) => b.startsWith('BEGIN:VCALENDAR')), 'Block beginnt nicht mit dem Kalender');
  const bl = kalender.calendarData(xml).flatMap((b) => kalender.parseIcs(b));
  assert.deepStrictEqual(bl.map((x) => [x.uid, x.titel]), [['h1', 'A & B \u{1F600}'], ['h2', '(ohne Titel)']], 'CalDAV ' + JSON.stringify(bl.map((x) => [x.uid, x.titel])));
  // Offenes Element ohne Ende: kein quadratischer Suchlauf.
  const t1 = Date.now();
  assert.deepStrictEqual(kalender.calendarData('<c:calendar-data>'.repeat(200000)), []);
  assert.ok(Date.now() - t1 < 500, 'calendarData braucht ' + (Date.now() - t1) + ' ms');
}

function testKalenderKonten() {
  const k = kalender.konten([
    { id: 'privat', name: 'Privat', art: 'ics', url: 'webcal://kalender.example/x.ics' },
    { id: 'Privat 2', name: 'x', art: 'ics', url: 'https://a/b' },
    { id: 'arbeit', name: 'Arbeit', art: 'caldav', url: 'http://nextcloud.example/dav/', benutzer: 'ich', passwortEnvVar: 'KAL_PW' },
    { id: 'ftp', name: 'x', art: 'ftp', url: 'https://a/b' },
    { id: 'privat', name: 'doppelt', art: 'ics', url: 'https://a/b' },
    'kaputt',
  ]);
  assert.deepStrictEqual(k.gueltig.map((x) => [x.id, x.url]), [['privat', 'https://kalender.example/x.ics']], 'gueltig ' + JSON.stringify(k.gueltig));
  // Gegenprobe: CalDAV ueber http zulassen -> 2 gueltige, 4 Fehler.
  assert.strictEqual(k.fehler.length, 5, 'Fehler ' + JSON.stringify(k.fehler));
  assert.ok(k.fehler.some((f) => /arbeit.*https/.test(f)), 'CalDAV ohne https nicht abgelehnt');
  assert.ok(!JSON.stringify(k.fehler).includes('nextcloud.example/dav'), 'Fehlertext verraet die Adresse');
  assert.deepStrictEqual(kalender.konten(undefined), { gueltig: [], fehler: [] });
  assert.strictEqual(kalender.konten({}).fehler.length, 1, 'kalender als Objekt nicht gemeldet');
}

function testWocheTermine() {
  const zeit = require('../zeit');
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  kalender.speichereTermin(db, { titel: 'Kundentermin', art: 'meeting', start: '2026-08-18T09:00:00.000Z', ende: '2026-08-18T10:00:00.000Z' });
  db.prepare(`INSERT INTO termin (kalender_id, uid, titel, start, ende, ganztag, art, quelle, aktualisiert_am)
    VALUES ('privat', 'u1', 'Urlaub', '2026-08-19T00:00:00.000Z', '2026-08-20T00:00:00.000Z', 1, 'meeting', 'kalender', '2026-08-18')`).run();
  const w = zeit.woche(db, '2026-08-17', Date.UTC(2026, 7, 20, 12));
  const n = w.tage.map((t) => (t.termine || []).length);
  // Gegenprobe: termine nicht je Tag filtern -> jeder Tag hat 2.
  assert.deepStrictEqual(n, [0, 1, 1, 0, 0, 0, 0], 'Termine je Tag ' + JSON.stringify(n));
  assert.deepStrictEqual([w.tage[1].termine[0].titel, w.tage[1].termine[0].quelle], ['Kundentermin', 'lokal']);
  // Monat bleibt schlank: keine Terminlisten.
  assert.ok(!('termine' in zeit.monat(db, { from: '2026-08-01', to: '2026-08-31' }).tage[0]), 'Monat traegt Terminlisten');
  // Lokal: Pruefungen.
  assert.throws(() => kalender.speichereTermin(db, { titel: ' ', art: 'meeting', start: '2026-08-18T09:00:00Z', ende: '2026-08-18T10:00:00Z' }), /Titel fehlt/);
  assert.throws(() => kalender.speichereTermin(db, { titel: 'x', art: 'meeting', start: '2026-08-18T10:00:00Z', ende: '2026-08-18T09:00:00Z' }), /Ende liegt vor Start/);
  assert.throws(() => kalender.speichereTermin(db, { titel: 'x', art: 'party', start: '2026-08-18T09:00:00Z', ende: '2026-08-18T10:00:00Z' }), /Art: meeting oder blocker/);
  assert.throws(() => kalender.loescheTermin(db, { kalender_id: 'privat', uid: 'u1' }), /Kalendertermine werden nur gelesen/);
  assert.throws(() => kalender.speichereTermin(db, { kalender_id: 'privat', uid: 'u1', titel: 'x', art: 'meeting', start: '2026-08-18T09:00:00Z', ende: '2026-08-18T10:00:00Z' }), /Kalendertermine werden nur gelesen/);
  assert.throws(() => kalender.setzeZiel(db, { kalender_id: 'privat', uid: 'u1', ziel_art: 'xx', ziel_schluessel: 'y' }), /Zielart unbekannt/);
  // Datum, das es nicht gibt: Fehler statt NaN-Zeitraum.
  assert.throws(() => kalender.termine(db, { from: '2026-13-45', to: '2026-12-31' }), /from: Datum/);
  assert.throws(() => kalender.termine(db, { from: '2026-02-01', to: '2026-02-30' }), /to: Datum/);
  const eigen = db.prepare("SELECT uid FROM termin WHERE quelle = 'lokal'").get().uid;
  kalender.loescheTermin(db, { kalender_id: 'lokal', uid: eigen });
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM termin WHERE quelle = 'lokal'").get().n, 0, 'lokaler Termin nicht geloescht');
}

async function testKalenderRouten() {
  const srv = require('../server');
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const url = (p) => `http://127.0.0.1:${srv.server.address().port}${p}`;
  const post = async (p, body) => {
    const r = await fetch(url(p), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return [r.status, (await r.json()).error];
  };
  try {
    // Nur Ablehnungen: der Server im Selfcheck arbeitet auf der echten Datenbank.
    for (const [p, body, re] of [
      ['/api/termin', { titel: '', art: 'meeting', start: '2026-08-18T09:00:00Z', ende: '2026-08-18T10:00:00Z' }, /Titel fehlt/],
      ['/api/termin', { kalender_id: 'privat', uid: 'x', titel: 'x', art: 'meeting', start: '2026-08-18T09:00:00Z', ende: '2026-08-18T10:00:00Z' }, /nur gelesen/],
      ['/api/termin-loeschen', { kalender_id: 'privat', uid: 'x' }, /nur gelesen/],
      ['/api/termin-ziel', { kalender_id: 'lokal', uid: 'gibt-es-nicht', ziel_art: 'projekt', ziel_schluessel: 'X' }, /Termin nicht gefunden/],
      ['/api/termin-ziel', { kalender_id: 'lokal', uid: 'x', ziel_art: 'xx', ziel_schluessel: 'X' }, /Zielart unbekannt/],
      ['/api/kalender-sync', { id: 'gibt-es-nicht' }, /Kalender nicht gefunden/],
    ]) {
      const [s, e] = await post(p, body);
      assert.deepStrictEqual([s, re.test(e)], [400, true], p + ': ' + s + ' ' + e);
    }
    let r = await fetch(url('/api/termine?from=gestern&to=2026-08-31'));
    assert.strictEqual(r.status, 400, 'termine mit kaputtem Datum: ' + r.status);
    r = await fetch(url('/api/termine?from=2026-08-01&to=2026-08-31'));
    assert.deepStrictEqual([r.status, Array.isArray((await r.json()).termine)], [200, true], 'GET /api/termine');
    r = await fetch(url('/api/kalender'));
    const k = await r.json();
    assert.deepStrictEqual([r.status, Array.isArray(k.konten), Array.isArray(k.fehler)], [200, true, true], 'GET /api/kalender ' + JSON.stringify(k));
    r = await fetch(url('/api/zeit/woche?montag=2026-08-17'));
    assert.ok((await r.json()).tage.every((t) => Array.isArray(t.termine)), 'Woche ohne termine');
  } finally {
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

// Termin direkt in die Tabelle: Erinnerung und Workload lesen nur, woher er kommt ist egal.
function termin(db, uid, art, start, ende, ziel = [null, null], ganztag = 0) {
  db.prepare(`INSERT INTO termin (kalender_id, uid, titel, start, ende, ganztag, art, quelle, ziel_art, ziel_schluessel, aktualisiert_am)
    VALUES ('privat', ?, ?, ?, ?, ?, ?, 'kalender', ?, ?, '2026-08-01')`).run(uid, 'Titel ' + uid, start, ende, ganztag, art, ziel[0], ziel[1]);
}

function testErinnerungFall() {
  const basis = Date.UTC(2026, 7, 18, 10, 0, 0);
  const { db, aktiv, t } = zeitDb(basis);
  const s = (sek) => new Date(basis + sek * 1000).toISOString();
  db.prepare("INSERT INTO kontakte (id, firma, erstellt_am) VALUES (7, 'Beispielkunde', '2026-08-01')").run();
  db.prepare("INSERT INTO projekt_kontakt (projekt, kontakt_id) VALUES ('P4', 7)").run();
  termin(db, 'a', 'blocker', s(-20), t(60), ['vorgang', 'PROJ-1']);
  termin(db, 'b', 'blocker', s(-30), t(60), ['projekt', 'P2']);
  termin(db, 'c', 'blocker', s(-40), t(60), ['vorgang', 'PROJ-9']);
  termin(db, 'd', 'blocker', s(-50), t(60), ['kunde', '7']);
  termin(db, 'e', 'blocker', s(-10), t(60));                       // ohne Ziel: nichts vergleichbar
  termin(db, 'meeting', 'meeting', s(-10), t(60), ['vorgang', 'PROJ-1']);
  termin(db, 'alt', 'blocker', t(-10), t(60), ['vorgang', 'PROJ-1']);
  termin(db, 'spaeter', 'blocker', t(1), t(60), ['vorgang', 'PROJ-1']);
  termin(db, 'ganztag', 'blocker', '2026-08-18T00:00:00.000Z', '2026-08-19T00:00:00.000Z', ['vorgang', 'PROJ-1'], 1);
  aktiv('s1', -2, 'P1', 'PROJ-1', 1);          // du tippst am selben Vorgang
  aktiv('s2', -1, 'P2', null);                  // Claude arbeitet allein am Projekt
  aktiv('s3', -1, 'P3', null, 1);               // Eingaben, aber anderes Projekt
  aktiv('s4', -10, 'P9', 'PROJ-9', 1);          // zu lange her
  aktiv('s5', -3, 'P4', null, 1);               // Projekt des Kunden
  const neu = kalender.erinnerungen(db, { jetzt: basis });
  const fall = Object.fromEntries(neu.map((h) => [h.termin.uid, h.fall]));
  // Gegenprobe: Ziel nicht vergleichen -> b wird claude (s3), c/e werden claude.
  // Gegenprobe: 5-Minuten-Grenze weg -> c wird claude (s4).
  // Gegenprobe: art nicht pruefen -> meeting erscheint; ganztag nicht pruefen -> ganztag erscheint.
  assert.deepStrictEqual(fall, { a: 'claude', b: 'begleiten', c: 'manuell', d: 'claude', e: 'manuell' }, 'Faelle ' + JSON.stringify(fall));
  const hinweise = kalender.hinweise(db, { jetzt: basis });
  assert.strictEqual(hinweise.length, 5, 'Hinweisliste ' + hinweise.length);
  assert.ok(hinweise.every((h) => h.seit === new Date(basis).toISOString() && h.termin.kalender_id === 'privat'), 'seit/Schluessel fehlt');
  // Genau einmal: Gegenprobe "erinnert_am IS NULL" weg -> zweiter Takt erinnert wieder.
  assert.deepStrictEqual(kalender.erinnerungen(db, { jetzt: basis + 30000 }), [], 'zweiter Takt erinnert erneut');
  assert.strictEqual(kalender.hinweise(db, { jetzt: basis + 30000 }).length, 5, 'zweiter Takt hat Hinweise verdoppelt');
  const gesetzt = db.prepare('SELECT uid FROM termin WHERE erinnert_am IS NOT NULL ORDER BY uid').all().map((r) => r.uid);
  assert.deepStrictEqual(gesetzt, ['a', 'b', 'c', 'd', 'e'], 'erinnert_am ' + JSON.stringify(gesetzt));
  // Ein geratenes Ziel ist nur ein Vorschlag: nichts gebucht.
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM zeit_eintrag').get().n, 0, 'Erinnerung hat gebucht');
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM termin WHERE gebucht_eintrag_id IS NOT NULL').get().n, 0, 'gebucht_eintrag_id gesetzt');
  // Wegklicken nimmt genau einen; zweimal ist kein Fehler (zwei offene Tabs).
  const schluessel = { kalender_id: hinweise[0].termin.kalender_id, uid: hinweise[0].termin.uid };
  assert.deepStrictEqual(kalender.hinweisWeg(db, schluessel), { ok: true, weg: true });
  assert.deepStrictEqual(kalender.hinweisWeg(db, schluessel), { ok: true, weg: false });
  assert.strictEqual(kalender.hinweise(db, { jetzt: basis }).length, 4, 'Wegklicken');
  assert.throws(() => kalender.hinweisWeg(db, { uid: 5 }), /Termin nicht gefunden/);
  // Ein Termin ohne Erinnerung laesst sich nicht wegklicken (kein stilles ok).
  assert.deepStrictEqual(kalender.hinweisWeg(db, { kalender_id: 'privat', uid: 'spaeter' }), { ok: true, weg: false });
  // Neustart: der Hinweis haengt am Termin, nicht am Prozess.
  assert.strictEqual(kalender.hinweise(db, { jetzt: basis + 60000 }).length, 4, 'Hinweise nach Neustart');
  // Andere Datenbank, eigene Liste (vor dem Aufraeumen, sonst ist jede Liste leer).
  assert.strictEqual(kalender.hinweise(zeitDb(basis).db, { jetzt: basis }).length, 0, 'Hinweise zwischen Datenbanken geteilt');
  // Nach dem Terminende bleibt der Hinweis bis zum Wegklicken stehen (sonst geht eine
  // Erinnerung im Hintergrund-Tab verloren), hoechstens einen Tag.
  // Gegenprobe: Filter wieder auf "ende > jetzt" -> erste Pruefung rot; ohne Tagesgrenze -> zweite rot.
  assert.strictEqual(kalender.hinweise(db, { jetzt: basis + 61 * 60000 }).length, 4, 'Hinweis verschwindet mit dem Terminende');
  assert.strictEqual(kalender.hinweise(db, { jetzt: basis + 86400000 + 1000 }).length, 0, 'Hinweis bleibt laenger als einen Tag');
  // Ganztaegig beginnt um Mitternacht: auch dann keine Erinnerung (Urlaub ist kein Blocker-Beginn).
  termin(db, 'ganztag2', 'blocker', '2026-08-19T00:00:00.000Z', '2026-08-20T00:00:00.000Z', ['vorgang', 'PROJ-1'], 1);
  assert.deepStrictEqual(kalender.erinnerungen(db, { jetzt: Date.UTC(2026, 7, 19, 0, 0, 30) }), [], 'ganztaegiger Blocker erinnert');
  // Pruefung scheitert (hier: activity fehlt): trotzdem ein Hinweis, Fall manuell,
  // nie "erinnert" ohne Hinweis. Gegenprobe: Fehler durchreichen -> Test rot.
  const kaputt = zeitDb(basis).db;
  termin(kaputt, 'k', 'blocker', s(-5), t(60), ['vorgang', 'PROJ-1']);
  kaputt.exec('DROP TABLE activity');
  const fehlerVorher = console.error;
  console.error = () => {};
  let h;
  try { h = kalender.erinnerungen(kaputt, { jetzt: basis }); } finally { console.error = fehlerVorher; }
  assert.deepStrictEqual(h.map((x) => x.fall), ['manuell'], 'Rueckfall ' + JSON.stringify(h));
  assert.strictEqual(kalender.hinweise(kaputt, { jetzt: basis }).length, 1, 'Rueckfall ohne gespeicherten Hinweis');
}

// Ein verschobener Blocker wird zur neuen Zeit wieder erinnert, ein unveraenderter nicht.
async function testErinnerungVerschoben() {
  const basis = Date.UTC(2026, 7, 18, 10, 0, 0);
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const konto = { id: 'privat', name: 'Privat', art: 'ics', url: 'https://kalender.invalid/geheim.ics' };
  const ics = (beginn) => 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:fokus-1\nDTSTART:' + beginn +
    '\nDTEND:20260818T120000Z\nSUMMARY:Fokus\nEND:VEVENT\nEND:VCALENDAR\n';
  const sync = (beginn, jetzt) => kalender.sync(db, konto, { jetzt, holen: async () => kalender.parseIcs(ics(beginn)) });
  await sync('20260818T095950Z', basis);
  const lokal = kalender.speichereTermin(db, { titel: 'Eigener Fokus', art: 'blocker', start: '2026-08-18T09:59:55.000Z', ende: '2026-08-18T12:00:00.000Z' });
  assert.strictEqual(kalender.erinnerungen(db, { jetzt: basis }).length, 2, 'erste Erinnerung');
  // Gleicher Beginn: bleibt erinnert. Gegenprobe: immer zuruecksetzen -> zweite Erinnerung.
  await sync('20260818T095950Z', basis + 30000);
  kalender.speichereTermin(db, { uid: lokal.uid, titel: 'Eigener Fokus, neu benannt', art: 'blocker', start: lokal.start, ende: lokal.ende });
  assert.deepStrictEqual(kalender.erinnerungen(db, { jetzt: basis + 30000 }), [], 'unveraenderter Beginn erinnert erneut');
  // Verschoben: Hinweis weg, zur neuen Zeit wieder da. Gegenprobe: Ruecksetzen fehlt -> keine zweite Erinnerung.
  await sync('20260818T103000Z', basis + 60000);
  kalender.speichereTermin(db, { uid: lokal.uid, titel: 'Eigener Fokus', art: 'blocker', start: '2026-08-18T10:30:05.000Z', ende: lokal.ende });
  assert.strictEqual(kalender.hinweise(db, { jetzt: basis + 60000 }).length, 0, 'Hinweis zum alten Beginn bleibt');
  const neu = kalender.erinnerungen(db, { jetzt: Date.UTC(2026, 7, 18, 10, 30, 10) });
  assert.deepStrictEqual(neu.map((h) => h.termin.uid).sort(), ['fokus-1', lokal.uid].sort(), 'zweite Erinnerung ' + JSON.stringify(neu));
}

// Restkapazitaet heute (Live „Du“): Tagessoll − Arbeitszeit − was an Terminen heute noch ansteht.
// Vergangene Termine zaehlen nicht mehr (die Zeit steckt schon in der Arbeitszeit oder ist vorbei).
function testRestkapazitaet() {
  const zeit = require('../zeit');
  const jetzt = Date.UTC(2026, 7, 19, 12);
  const { db } = zeitDb(jetzt);
  const h = (std, min = 0) => new Date(Date.UTC(2026, 7, 19, std, min)).toISOString();
  eintrag(db, { start: h(8), ende: h(9) });                          // 60 Min Arbeitszeit
  termin(db, 'vorbei', 'meeting', h(10), h(11));                     // vorbei: zaehlt nicht
  termin(db, 'laeuft', 'blocker', h(11, 30), h(12, 30));             // noch 30 Min
  termin(db, 'spaeter', 'meeting', h(14), h(15, 30));                // 90 Min
  termin(db, 'doppelt', 'blocker', h(15), h(16));                    // ueberlappt: nur 30 Min mehr
  termin(db, 'morgen', 'meeting', h(33), h(34));                     // anderer Tag
  const w = mitConfig({ tagessollStunden: 8 }, () => zeit.workload(db, jetzt));
  // Gegenprobe: ohne Kappen auf jetzt -> 'vorbei' und die erste halbe Stunde von 'laeuft' zaehlen mit.
  assert.deepStrictEqual(w.heute, { tag: '2026-08-19', soll_min: 480, arbeitszeit_min: 60, termine_rest_min: 150, rest_min: 270 }, 'heute ' + JSON.stringify(w.heute));
  // Plausibel: nie negativ, nie ueber dem Soll.
  const voll = mitConfig({ tagessollStunden: 1 }, () => zeit.workload(db, jetzt));
  assert.strictEqual(voll.heute.rest_min, 0, 'Restkapazitaet negativ statt 0: ' + JSON.stringify(voll.heute));
  assert.ok(w.heute.rest_min <= w.heute.soll_min, 'Restkapazitaet ueber dem Soll');
}

// Schalter "Bei Beginn erinnern": aus = kein Hinweis; beim Aendern ohne Angabe bleibt er stehen.
function testErinnernSchalter() {
  const basis = Date.UTC(2026, 7, 18, 10, 0, 0);
  const { db, t } = zeitDb(basis);
  const s = (sek) => new Date(basis + sek * 1000).toISOString();
  const still = kalender.speichereTermin(db, { titel: 'Still', art: 'blocker', start: s(-20), ende: t(60), erinnern: false });
  const laut = kalender.speichereTermin(db, { titel: 'Laut', art: 'blocker', start: s(-20), ende: t(60) });
  assert.deepStrictEqual([still.erinnern, laut.erinnern], [0, 1], 'erinnern gespeichert ' + JSON.stringify([still.erinnern, laut.erinnern]));
  // Gegenprobe: Waechter "erinnern = 1" weg -> beide erinnert.
  assert.deepStrictEqual(kalender.erinnerungen(db, { jetzt: basis }).map((h) => h.termin.uid), [laut.uid], 'Blocker ohne Erinnern erinnert');
  // Umbenennen ohne erinnern: bleibt aus. Gegenprobe: Vorgabe 1 beim Aendern -> wieder an.
  const umbenannt = kalender.speichereTermin(db, { uid: still.uid, titel: 'Still, neu', art: 'blocker', start: still.start, ende: still.ende });
  assert.strictEqual(umbenannt.erinnern, 0, 'Aendern ohne Angabe schaltet Erinnern wieder ein');
  assert.throws(() => kalender.speichereTermin(db, { titel: 'X', art: 'blocker', start: t(1), ende: t(60), erinnern: 'ja' }), /Erinnern: ja oder nein/);
  // Kalendertermine (Abgleich) erinnern wie bisher.
  termin(db, 'k', 'blocker', s(-10), t(60));
  assert.strictEqual(db.prepare("SELECT erinnern FROM termin WHERE uid = 'k'").get().erinnern, 1, 'Kalenderblocker ohne Vorgabe');
}

// "+ buchen" am Termin-Geist: Eintrag und Termin kennen sich, zweimal buchen geht nicht,
// Loeschen gibt den Termin frei. Nur Meetings bekommen die Parallelregel (kalender_uid).
function testTerminBuchen() {
  const zeit = require('../zeit');
  const { db } = zeitDb();
  termin(db, 'm', 'meeting', '2026-08-18T14:00:00.000Z', '2026-08-18T15:00:00.000Z');
  termin(db, 'b', 'blocker', '2026-08-18T16:00:00.000Z', '2026-08-18T17:00:00.000Z');
  const e = eintrag(db, { ende: '2026-08-18T15:00:00.000Z', termin: { kalender_id: 'privat', uid: 'm' } });
  const lies = (uid) => db.prepare('SELECT gebucht_eintrag_id FROM termin WHERE uid = ?').get(uid).gebucht_eintrag_id;
  // Gegenprobe: UPDATE weglassen -> gebucht_eintrag_id bleibt leer.
  assert.strictEqual(lies('m'), e.id, 'Termin kennt den Eintrag nicht');
  assert.strictEqual(e.kalender_uid, 'm', 'Meeting ohne kalender_uid');
  // Gegenprobe: Pruefung auf schon gebucht weg -> zweiter Eintrag entsteht.
  assert.throws(() => eintrag(db, { ende: '2026-08-18T15:00:00.000Z', termin: { kalender_id: 'privat', uid: 'm' } }), /schon gebucht/);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM zeit_eintrag').get().n, 1, 'zweiter Eintrag trotz Fehler');
  // Blocker: verknuepft, aber ohne Parallelregel.
  const b = eintrag(db, { start: '2026-08-18T16:00:00.000Z', ende: '2026-08-18T17:00:00.000Z', termin: { kalender_id: 'privat', uid: 'b' } });
  assert.deepStrictEqual([lies('b'), b.kalender_uid], [b.id, null], 'Blocker ' + JSON.stringify([lies('b'), b.kalender_uid]));
  assert.throws(() => eintrag(db, { termin: { kalender_id: 'privat', uid: 'gibts-nicht' } }), /Termin nicht gefunden/);
  assert.throws(() => eintrag(db, { termin: 'm' }), /Termin nicht gefunden/);
  assert.throws(() => zeit.speichere(db, { ...e, termin: { kalender_id: 'privat', uid: 'b' } }, e.id), /nur beim Anlegen/);
  // Vorschau kennt die Parallelregel schon vor dem Buchen.
  termin(db, 'm2', 'meeting', '2026-08-18T18:00:00.000Z', '2026-08-18T19:00:00.000Z');
  const v = zeit.vorschau(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', start: '2026-08-18T18:00:00.000Z', ende: '2026-08-18T19:00:00.000Z',
    taetigkeit: 'Entwicklung', termin: { kalender_id: 'privat', uid: 'm2' } });
  assert.strictEqual(v.kalender_uid, 'm2', 'Vorschau ohne kalender_uid');
  assert.strictEqual(lies('m2'), null, 'Vorschau hat gebucht');
  // Loeschen gibt frei; danach laesst sich wieder buchen. Gegenprobe: Freigabe weg -> "schon gebucht" bleibt? Nein:
  // der Eintrag fehlt dann, deshalb prueft der Test die Spalte direkt.
  // Verschwindet der Eintrag auf anderem Weg (Rueckgaengig nach Timer-Stopp), gilt der Termin wieder als offen.
  // Gegenprobe: CASE/EXISTS in woche weg -> Geist bliebe aus; lade() in terminVon weg -> "schon gebucht".
  db.prepare('DELETE FROM zeit_eintrag WHERE id = ?').run(b.id);
  const wb = zeit.woche(db, '2026-08-17').tage.find((x) => x.tag === '2026-08-18').termine.find((x) => x.uid === 'b');
  assert.strictEqual(wb.gebucht_eintrag_id, null, 'verwaiste Buchung gilt als gebucht');
  assert.ok(eintrag(db, { start: '2026-08-18T16:00:00.000Z', ende: '2026-08-18T17:00:00.000Z', termin: { kalender_id: 'privat', uid: 'b' } }).id, 'verwaister Termin nicht buchbar');
  zeit.loesche(db, e.id);
  assert.strictEqual(lies('m'), null, 'Loeschen gibt den Termin nicht frei');
  assert.ok(eintrag(db, { ende: '2026-08-18T15:00:00.000Z', termin: { kalender_id: 'privat', uid: 'm' } }).id, 'neu buchen nach Loeschen');
  // Ein Termin, der noch nicht begonnen hat, laesst sich nicht buchen (auch nicht per direktem POST).
  termin(db, 'spaeter', 'meeting', new Date(Date.now() + 3600e3).toISOString(), new Date(Date.now() + 7200e3).toISOString());
  assert.throws(() => eintrag(db, { termin: { kalender_id: 'privat', uid: 'spaeter' } }), /noch nicht begonnen/);
  // Die Woche liefert, was die Geister brauchen.
  const w = zeit.woche(db, '2026-08-17');
  const tm = w.tage.find((x) => x.tag === '2026-08-18').termine.find((x) => x.uid === 'm');
  assert.ok(tm && tm.gebucht_eintrag_id && tm.ziel_von_hand === 0 && tm.erinnern === 1, 'Woche: ' + JSON.stringify(tm));
}

// Fehlt ein gebuchter Kalendertermin im Feed, loescht der Abgleich ihn nicht: kaeme dieselbe
// uid zurueck, waere sie sonst wieder buchbar (Doppelabrechnung). Ungebuchte gehen wie bisher.
async function testAbgleichBehaeltGebuchte() {
  const { db } = zeitDb();
  const konto = { id: 'privat', name: 'Privat', art: 'ics', url: 'https://kalender.invalid/geheim.ics' };
  const ev = (uid, h) => 'BEGIN:VEVENT\nUID:' + uid + '\nDTSTART:20260818T' + h + '0000Z\nDTEND:20260818T' + h + '3000Z\nSUMMARY:T ' + uid + '\nEND:VEVENT\n';
  const feed = (...e) => async () => kalender.parseIcs('BEGIN:VCALENDAR\nVERSION:2.0\n' + e.join('') + 'END:VCALENDAR\n');
  const jetzt = Date.UTC(2026, 7, 18, 20);
  await kalender.sync(db, konto, { jetzt, holen: feed(ev('a', '14'), ev('b', '15'), ev('c', '16')) });
  eintrag(db, { start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T14:30:00.000Z', termin: { kalender_id: 'privat', uid: 'a' } });
  await kalender.sync(db, konto, { jetzt: jetzt + 60000, holen: feed(ev('c', '16')) });
  const da = db.prepare("SELECT uid FROM termin WHERE kalender_id = 'privat' ORDER BY uid").all().map((r) => r.uid);
  // Gegenprobe: Waechter "gebucht_eintrag_id IS NULL" weg -> a verschwindet.
  assert.deepStrictEqual(da, ['a', 'c'], 'nach Abgleich ' + JSON.stringify(da));
  await kalender.sync(db, konto, { jetzt: jetzt + 120000, holen: feed(ev('a', '14'), ev('c', '16')) });
  assert.throws(() => eintrag(db, { start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T14:30:00.000Z', termin: { kalender_id: 'privat', uid: 'a' } }), /schon gebucht/);
}

// ICS-Kalender aus der Oberflaeche (Owner-Entscheidung 12.10.2026): pruefen, Probe vor
// dem Speichern, gespeichert wird nur ueber speichern(), die Adresse kommt nie zurueck.
async function testKalenderVerbinden() {
  const { db } = zeitDb();
  const jetzt = Date.UTC(2026, 7, 18, 20);
  const geheim = 'https://calendar.google.com/calendar/ical/x%40beispiel.de/private-0a1b2c/basic.ics';
  const feed = async () => kalender.parseIcs('BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:t1\nDTSTART:20260819T090000Z\nDTEND:20260819T100000Z\nSUMMARY:Daily\nEND:VEVENT\nEND:VCALENDAR\n');
  let gespeichert = null;
  const speichern = async (l) => { gespeichert = l; };
  const vorher = kalender.KONTEN.gueltig;
  try {
    // Eingaben: leer, Leerzeichen, kein Protokoll, zu lang -> abgelehnt, nichts gespeichert.
    for (const [d, re] of [[{}, /Adresse fehlt/], [{ url: 'https://a b.de/x.ics' }, /keine Kalender-Adresse/], [{ url: 'ftp://x.de/a.ics' }, /https/],
      [{ url: 'https://x.de/' + 'a'.repeat(2001) }, /keine Kalender-Adresse/], [{ url: geheim, name: 'x'.repeat(81) }, /80 Zeichen/],
      [{ url: 'http://x.de/a.ics' }, /Nur https/]]) {
      await assert.rejects(kalender.verbinde(db, d, { roh: [], speichern, holen: feed, jetzt }), re, JSON.stringify(d).slice(0, 60));
    }
    // Gescheiterte Probe: nichts gespeichert, Text ohne Adresse. Gegenprobe: Probe weg -> gespeichert.
    const kaputt = async () => { throw new kalender.KalenderFehler('HTTP 404'); };
    await assert.rejects(kalender.verbinde(db, { url: geheim }, { roh: [], speichern, holen: kaputt, jetzt }), (e) => /nicht erreichbar: HTTP 404/.test(e.message) && !e.message.includes('private-'));
    assert.strictEqual(gespeichert, null, 'gescheiterte Probe hat gespeichert');
    // Erfolg: eine Zeile mehr, id aus dem Host, Termine sofort da.
    const alt = [{ id: 'nextcloud', name: 'NC', art: 'caldav', url: 'https://cloud.beispiel.de/dav/', benutzer: 'u', passwortEnvVar: 'NC_PW' }];
    const r = await kalender.verbinde(db, { url: geheim }, { roh: alt, speichern, holen: feed, jetzt });
    assert.deepStrictEqual(gespeichert.map((k) => k.id), ['nextcloud', 'google'], 'Liste ' + JSON.stringify(gespeichert.map((k) => k.id)));
    assert.strictEqual(gespeichert[1].url, geheim);
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM termin WHERE kalender_id = 'google'").get().n, 1, 'Termine nach dem Verbinden');
    // Die Adresse geht nie zurueck: weder in der Antwort noch im Status.
    assert.ok(!JSON.stringify(r).includes('private-') && !JSON.stringify(kalender.status(db)).includes('private-'), 'Adresse in Antwort oder Status');
    assert.ok(kalender.KONTEN.gueltig.some((k) => k.id === 'google'), 'Konto nicht aktiv ohne Neustart');
    // Doppelt (auch als webcal://) abgelehnt. Gegenprobe: Pruefung weg -> zweiter Eintrag.
    await assert.rejects(kalender.verbinde(db, { url: geheim.replace('https://', 'webcal://') }, { roh: gespeichert, speichern, holen: feed, jetzt }), /schon verbunden/);
    // Trennen: ungebuchte Termine weg, gebuchte bleiben. Gegenprobe: Waechter weg -> gebuchter weg.
    db.prepare(`INSERT INTO termin (kalender_id, uid, titel, start, ende, ganztag, art, quelle, aktualisiert_am)
      VALUES ('google', 't2', 'Alt', '2026-08-18T14:00:00.000Z', '2026-08-18T14:30:00.000Z', 0, 'meeting', 'kalender', '2026-08-18T20:00:00.000Z')`).run();
    eintrag(db, { start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T14:30:00.000Z', termin: { kalender_id: 'google', uid: 't2' } });
    const t = await kalender.trenne(db, { id: 'google' }, { roh: gespeichert, speichern });
    assert.deepStrictEqual(gespeichert.map((k) => k.id), ['nextcloud'], 'nach Trennen');
    assert.strictEqual(t.termine_entfernt, 1);
    assert.deepStrictEqual(db.prepare("SELECT uid FROM termin WHERE kalender_id = 'google'").all().map((x) => x.uid), ['t2'], 'gebuchter Termin weg');
    await assert.rejects(kalender.trenne(db, { id: 'google' }, { roh: gespeichert, speichern }), /nicht gefunden/);
    // Neue id erbt keine alten Termine: "google" haengt noch an t2 -> "google-2".
    const r2 = await kalender.verbinde(db, { url: geheim }, { roh: gespeichert, speichern, holen: feed, jetzt });
    assert.strictEqual(r2.id, 'google-2', 'id ' + r2.id);
    // Zwei gleichzeitig (zwei Tabs): nacheinander, also verschiedene Kennungen.
    // Gegenprobe: seriell() weg -> beide bekommen "beispiel".
    const db2 = zeitDb().db;
    const langsam = async () => { await new Promise((r) => setTimeout(r, 30)); return feed(); };
    const [p1, p2] = await Promise.all(['https://beispiel.de/a.ics', 'https://beispiel.de/b.ics']
      .map((u) => kalender.verbinde(db2, { url: u }, { roh: [], speichern: async () => {}, holen: langsam, jetzt })));
    assert.notStrictEqual(p1.id, p2.id, 'parallele Kennungen ' + p1.id + '/' + p2.id);
  } finally {
    kalender.setzeKonten(require('../config.json').kalender);
    assert.ok(kalender.KONTEN.gueltig.length === vorher.length, 'KONTEN nicht zurueckgesetzt');
  }
}

// "In Google Kalender oeffnen" legt vorlaeufig an (google_offen); kommt der Termin ueber
// den Abgleich zurueck, wird zusammengefuehrt statt doppelt gezeigt (Owner-Befund 12.10.2026).
async function testGoogleZusammenfuehren() {
  const { db } = zeitDb();
  const konto = { id: 'google', name: 'Google', art: 'ics', url: 'https://kalender.invalid/privat.ics' };
  const ev = (uid, titel, s, e) => 'BEGIN:VEVENT\nUID:' + uid + '\nDTSTART:' + s + '\nDTEND:' + e + '\nSUMMARY:' + titel + '\nEND:VEVENT\n';
  const feed = (...x) => async () => kalender.parseIcs('BEGIN:VCALENDAR\nVERSION:2.0\n' + x.join('') + 'END:VCALENDAR\n');
  const jetzt = Date.UTC(2026, 7, 18, 8);
  const lokal = (titel, start, ende, extra = {}) => kalender.speichereTermin(db, { titel, art: 'meeting', start, ende, google: true, ...extra }, { kontenDa: true });
  // Ohne verbundenen Kalender kaeme nie etwas zurueck: dann gewoehnlich lokal.
  // Gegenprobe: kontenDa ignorieren -> google_offen gesetzt.
  assert.strictEqual(kalender.speichereTermin(db, { titel: 'Ohne Konto', art: 'meeting', start: '2026-08-21T09:00:00.000Z', ende: '2026-08-21T10:00:00.000Z', google: true }, { kontenDa: false }).google_offen, null, 'ohne Konto vorlaeufig');
  const a = lokal('Abstimmung PROJ-1', '2026-08-19T06:00:00.000Z', '2026-08-19T07:00:00.000Z', { ziel_art: 'projekt', ziel_schluessel: 'P2', erinnern: false });
  const b = lokal('Workshop', '2026-08-20T09:00:00.000Z', '2026-08-20T10:00:00.000Z');
  // Feste uids: der falsche Kandidat (Review A) sortiert zuerst, ohne Titel-Vorrang griffe er.
  const vorl = db.prepare(`INSERT INTO termin (kalender_id, uid, titel, start, ende, ganztag, art, quelle, ziel_von_hand, google_offen, aktualisiert_am)
    VALUES ('lokal', ?, ?, '2026-08-20T13:00:00.000Z', '2026-08-20T14:00:00.000Z', 0, 'meeting', 'lokal', 1, ?, ?)`);
  vorl.run('a-review', 'Review A', new Date().toISOString(), new Date().toISOString());
  vorl.run('z-review', 'Review B', new Date().toISOString(), new Date().toISOString());
  const c1 = { uid: 'a-review', start: '2026-08-20T13:00:00.000Z', ende: '2026-08-20T14:00:00.000Z' };
  const c2 = { uid: 'z-review' };
  const normal = kalender.speichereTermin(db, { titel: 'Daily', art: 'meeting', start: '2026-08-19T08:00:00.000Z', ende: '2026-08-19T08:15:00.000Z' });
  assert.ok(a.google_offen && !normal.google_offen, 'google_offen');
  // b ist gebucht, bevor Google zurueckkommt (Meeting hat begonnen).
  const e = eintrag(db, { start: '2026-08-20T09:00:00.000Z', ende: '2026-08-20T10:00:00.000Z', termin: { kalender_id: 'lokal', uid: b.uid } });
  const erg = await kalender.sync(db, konto, { jetzt: Date.UTC(2026, 7, 20, 11), holen: feed(
    ev('g-a', 'Abstimmung PROJ-1', '20260819T060000Z', '20260819T070000Z'),
    ev('g-b', 'Workshop Kunde', '20260820T090000Z', '20260820T100000Z'),        // Titel in Google geaendert, Zeit eindeutig
    ev('g-c', 'Review B', '20260820T130000Z', '20260820T140000Z'),              // zwei Kandidaten: nur der gleichnamige
    ev('g-d', 'Daily', '20260819T080000Z', '20260819T081500Z')) });             // normaler lokaler Termin bleibt
  assert.strictEqual(erg.zusammengefuehrt, 3, 'zusammengefuehrt ' + erg.zusammengefuehrt);
  const lokale = db.prepare("SELECT titel FROM termin WHERE kalender_id = 'lokal' ORDER BY titel").all().map((r) => r.titel);
  // Gegenprobe: Zusammenfuehren weg -> alle lokal; Titel-Vorrang weg -> Review A statt B weg.
  assert.deepStrictEqual(lokale, ['Daily', 'Ohne Konto', 'Review A'], 'lokal uebrig ' + JSON.stringify(lokale));
  const ga = db.prepare("SELECT * FROM termin WHERE kalender_id = 'google' AND uid = 'g-a'").get();
  assert.deepStrictEqual([ga.ziel_art, ga.ziel_schluessel, ga.ziel_von_hand, ga.erinnern], ['projekt', 'P2', 1, 0], 'Ziel/Erinnern nicht uebernommen');
  // Die Buchung wandert mit: der Google-Termin ist gebucht, der Eintrag zeigt auf ihn.
  const gb = db.prepare("SELECT gebucht_eintrag_id FROM termin WHERE kalender_id = 'google' AND uid = 'g-b'").get();
  assert.strictEqual(gb.gebucht_eintrag_id, e.id, 'Buchung nicht uebernommen');
  assert.strictEqual(db.prepare('SELECT kalender_uid FROM zeit_eintrag WHERE id = ?').get(e.id).kalender_uid, 'g-b', 'kalender_uid nicht umgehaengt');
  assert.throws(() => eintrag(db, { start: '2026-08-20T09:00:00.000Z', ende: '2026-08-20T10:00:00.000Z', termin: { kalender_id: 'google', uid: 'g-b' } }), /schon gebucht/);
  // 24 h ohne Treffer: nicht gefunden — aber nur im Abgleich-Horizont.
  const spaet = lokal('Weit weg', '2027-06-30T09:00:00.000Z', '2027-06-30T10:00:00.000Z');
  const ra = db.prepare("SELECT * FROM termin WHERE uid = ?").get(c1.uid);
  const morgen = Date.parse(ra.google_offen) + 86400000 + 1000;
  assert.strictEqual(kalender.googleFehlt(ra, Date.parse(ra.google_offen) + 3600000), false, 'nach 1 h schon nicht gefunden');
  assert.strictEqual(kalender.googleFehlt(ra, morgen), true, 'nach 24 h nicht als fehlend');
  // Gegenprobe: Horizont-Pruefung weg -> "Weit weg" gilt als fehlend.
  assert.strictEqual(kalender.googleFehlt(db.prepare("SELECT * FROM termin WHERE uid = ?").get(spaet.uid), morgen), false, 'Termin ausserhalb des Horizonts als fehlend');
  // Behalten nimmt die Markierung weg.
  const behalten = kalender.speichereTermin(db, { uid: c1.uid, titel: 'Review A', art: 'meeting', start: c1.start, ende: c1.ende, google: false });
  assert.strictEqual(behalten.google_offen, null, 'Behalten');
  void jetzt; void c2;
}

// Google-Vorlage (R22): UTC-Format, Encoding, Gaeste kommagetrennt, ohne Gaeste kein add.
function testGoogleVorlageUrl() {
  const { googleVorlageUrl } = require('../public/app/kern.js');
  const roh = googleVorlageUrl({ titel: 'Fokus & Review #1', start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T15:30:00.000Z',
    details: 'NW-12 · c2invoice', gaeste: ['a@beispiel.de', 'b+x@beispiel.de'] });
  // Wie encodeURIComponent: Leerzeichen %20, das + der Adresse %2B (Gegenprobe: replace weg -> "+" im Titel).
  assert.ok(roh.includes('text=Fokus%20%26%20Review%20%231') && roh.includes('b%2Bx%40beispiel.de'), 'Kodierung ' + roh);
  const u = new URL(roh);
  assert.strictEqual(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
  assert.strictEqual(u.searchParams.get('action'), 'TEMPLATE');
  assert.strictEqual(u.searchParams.get('text'), 'Fokus & Review #1', 'Titel nicht kodiert');
  assert.strictEqual(u.searchParams.get('dates'), '20260818T140000Z/20260818T153000Z', 'dates ' + u.searchParams.get('dates'));
  assert.strictEqual(u.searchParams.get('details'), 'NW-12 · c2invoice');
  assert.strictEqual(u.searchParams.get('add'), 'a@beispiel.de,b+x@beispiel.de', 'Gaeste ' + u.searchParams.get('add'));
  const ohne = new URL(googleVorlageUrl({ titel: 'X', start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T15:00:00.000Z' }));
  assert.ok(!ohne.searchParams.has('add') && !ohne.searchParams.has('details'), 'leere Parameter ' + ohne.search);
}

function testWorkload() {
  const zeit = require('../zeit');
  const db = dbmod.open(':memory:');
  openDbs.push(db);
  const h = (tag, std, min = 0) => new Date(Date.UTC(2026, 7, tag, std, min)).toISOString();
  termin(db, 'm1', 'meeting', h(19, 9), h(19, 10));
  termin(db, 'm2', 'meeting', h(19, 9, 30), h(19, 10, 30));      // ueberlappt m1: 90 Min, nicht 120
  termin(db, 'b1', 'blocker', h(19, 10), h(19, 12));              // 30 Min schon Meeting: Blocker 90
  termin(db, 'b2', 'blocker', h(20, 8), h(20, 17));               // 9 h: ueberbucht
  termin(db, 'b3', 'blocker', h(21, 23), h(22, 1));               // ueber Mitternacht: Fr 60, Sa 60
  termin(db, 'm3', 'meeting', h(22, 10), h(22, 11));              // Samstag
  termin(db, 'f1', 'fremd', h(24, 9), h(24, 17));                 // fremd zaehlt nicht
  termin(db, 'g1', 'meeting', h(24, 0), h(25, 0), [null, null], 1); // ganztaegig zaehlt nicht
  termin(db, 'vor', 'meeting', h(18, 9), h(18, 10));              // vor dem Zeitraum
  termin(db, 'nach', 'meeting', h(26, 9), h(26, 10));             // nach dem Zeitraum
  const w = mitConfig({ tagessollStunden: 8 }, () => zeit.workload(db, Date.UTC(2026, 7, 19, 12)));
  const zeile = (tag) => w.tage.find((t) => t.tag === tag);
  assert.deepStrictEqual([w.von, w.bis, w.tage.length], ['2026-08-19', '2026-08-25', 7]);
  // Gegenprobe: Summe statt Vereinigung -> meeting 120, blocker 120.
  assert.deepStrictEqual([zeile('2026-08-19').meeting_min, zeile('2026-08-19').blocker_min, zeile('2026-08-19').belegt_min], [90, 90, 180], 'Mittwoch ' + JSON.stringify(zeile('2026-08-19')));
  assert.deepStrictEqual([zeile('2026-08-20').belegt_min, zeile('2026-08-20').ueber_min], [540, 60], 'Donnerstag ' + JSON.stringify(zeile('2026-08-20')));
  assert.deepStrictEqual([zeile('2026-08-21').blocker_min, zeile('2026-08-22').blocker_min, zeile('2026-08-22').meeting_min], [60, 60, 60], 'Mitternacht');
  // Wochenende: kein Soll, aber auch nicht schon mit einer Stunde ueberbucht.
  assert.deepStrictEqual([zeile('2026-08-22').soll_min, zeile('2026-08-22').ueber_min], [0, 0], 'Samstag ' + JSON.stringify(zeile('2026-08-22')));
  assert.strictEqual(zeile('2026-08-24').belegt_min, 0, 'fremd/ganztaegig gezaehlt');
  // Gegenprobe: Kapazitaet mit Wochenende -> 3360; belegt ohne Grenzen -> mehr als 900.
  assert.deepStrictEqual(w.summe, { meeting_min: 150, blocker_min: 750, belegt_min: 900, kapazitaet_min: 2400, frei_min: 1500, ueberbucht_tage: 1, auslastung: 900 / 2400 },
    'Summe ' + JSON.stringify(w.summe));
  // Plausibilitaet: Auslastung ist ein Anteil, kein Prozentwert.
  assert.ok(w.summe.auslastung > 0 && w.summe.auslastung < 1, 'Auslastung ' + w.summe.auslastung);
  const leer = mitConfig({ tagessollStunden: 0 }, () => zeit.workload(db, Date.UTC(2026, 7, 19, 12)));
  assert.strictEqual(leer.summe.auslastung, null, 'Tagessoll 0: Auslastung ' + leer.summe.auslastung);
}

async function testHinweisRouten() {
  const srv = require('../server');
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const url = (p) => `http://127.0.0.1:${srv.server.address().port}${p}`;
  try {
    let r = await fetch(url('/api/zeit-hinweise'));
    assert.deepStrictEqual([r.status, Array.isArray((await r.json()).hinweise)], [200, true], 'GET /api/zeit-hinweise');
    r = await fetch(url('/api/zeit-hinweis-weg'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: 5 }) });
    assert.deepStrictEqual([r.status, /Termin nicht gefunden/.test((await r.json()).error)], [400, true], 'hinweis-weg mit Zahl');
    r = await fetch(url('/api/zeit-hinweis-weg'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kalender_id: 'lokal', uid: 'gibt-es-nicht' }) });
    assert.deepStrictEqual([r.status, (await r.json()).weg], [200, false], 'hinweis-weg unbekannt');
    r = await fetch(url('/api/zeit/workload'));
    const w = await r.json();
    assert.deepStrictEqual([r.status, Array.isArray(w.tage) && w.tage.length, typeof w.summe], [200, 7, 'object'], 'GET /api/zeit/workload');
  } finally {
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

async function testZeitRouten() {
  const srv = require('../server');
  const lauscht = srv.server.listening;
  if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
  const url = (p) => `http://127.0.0.1:${srv.server.address().port}${p}`;
  const post = async (p, body) => {
    const r = await fetch(url(p), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return [r.status, (await r.json()).error];
  };
  try {
    let [s, e] = await post('/api/zeit', { ziel_art: 'xx' });
    assert.deepStrictEqual([s, /Zielart unbekannt/.test(e)], [400, true], 'POST /api/zeit: ' + s + ' ' + e);
    [s, e] = await post('/api/zeit', null);
    assert.strictEqual(s, 400, 'POST /api/zeit mit null: ' + s);
    [s, e] = await post('/api/zeit-loeschen', { id: 'abc' });
    assert.deepStrictEqual([s, /Eintrag/.test(e)], [400, true], 'zeit-loeschen: ' + s + ' ' + e);
    [s, e] = await post('/api/zeit/timer-start', { ziel_art: 'xx' });
    assert.deepStrictEqual([s, /Zielart/.test(e)], [400, true], 'timer-start: ' + s + ' ' + e);
    [s, e] = await post('/api/zeit/timer-wahl', { session_id: 's', wahl: 'halb' });
    assert.deepStrictEqual([s, /Wahl: beides, claude, meine oder keins/.test(e)], [400, true], 'timer-wahl: ' + s + ' ' + e);
    [s, e] = await post('/api/taetigkeitsarten', { name: '' });
    assert.deepStrictEqual([s, /Name fehlt/.test(e)], [400, true], 'taetigkeitsarten: ' + s + ' ' + e);
    [s, e] = await post('/api/taetigkeitsart-loeschen', { name: 'gibt es nicht' });
    assert.deepStrictEqual([s, /nicht gefunden/.test(e)], [400, true], 'taetigkeitsart-loeschen: ' + s + ' ' + e);
    [s, e] = await post('/api/zeit/vorschau', { ziel_art: 'xx' });
    assert.deepStrictEqual([s, /Zielart unbekannt/.test(e)], [400, true], 'vorschau: ' + s + ' ' + e);
    [s, e] = await post('/api/zeit/wahl', { eintrag_id: 1, session_id: 's', wahl: 'halb' });
    assert.deepStrictEqual([s, /Wahl: beides, claude, meine oder keins/.test(e)], [400, true], 'wahl: ' + s + ' ' + e);
    [s, e] = await post('/api/zeit/wahl', { eintrag_id: 'abc', session_id: 's', wahl: 'meine' });
    assert.deepStrictEqual([s, /Eintrag nicht gefunden/.test(e)], [400, true], 'wahl ohne Eintrag: ' + s + ' ' + e);
    let r = await fetch(url('/api/zeit/ueberlappung?id=abc'));
    assert.strictEqual(r.status, 400, 'ueberlappung mit kaputter id: ' + r.status);
    for (const pfad of ['/api/zeit/woche?montag=2026-08-18', '/api/zeit/monat?from=2026-01-01&to=2026-12-31',
      '/api/zeit/ziele-tabelle?from=x&to=2026-08-31', '/api/zeit/analyse']) {
      r = await fetch(url(pfad));
      assert.strictEqual(r.status, 400, pfad + ' liefert ' + r.status);
    }
    r = await fetch(url('/api/zeit/woche?montag=2026-08-17'));
    assert.strictEqual(r.status, 200, 'woche mit Montag: ' + r.status);
    r = await fetch(url('/api/zeit/ziele?q=' + 'x'.repeat(101)));
    assert.strictEqual(r.status, 400, 'zu lange Suche angenommen');
    r = await fetch(url('/api/zeit?from=gestern'));
    assert.strictEqual(r.status, 400, 'GET /api/zeit mit kaputtem Datum: ' + r.status);
    for (const p of ['/api/zeit/timer', '/api/taetigkeitsarten', '/api/zeit?from=2026-08-01&to=2026-08-31']) {
      r = await fetch(url(p));
      assert.strictEqual(r.status, 200, p + ' liefert ' + r.status);
    }
  } finally {
    if (!lauscht) await new Promise((ok) => srv.server.close(ok));
  }
}

// --- Zeiterfassung (Block Z2): Ueberlappung mit Claude-Sitzungen -----------
// Eine Minute zaehlt hoechstens einmal, ausser sie ist ausdruecklich parallel
// (Meeting, Wahl "beides"). Abzug, Parallel und Kulanz stehen im Eintrag;
// "meine"/"keins" nehmen der Sitzung genau die ueberlappenden Minuten.

// Sitzung im Modell "eingaben": Fenster liegen eine halbe Pausenschwelle um
// jede Eingabe. Eingaben im Abstand einer halben Schwelle ergeben genau ein
// Fenster [vonMin, bisMin].
function eingabenSitzung(zeile, session, vonMin, bisMin, projekt, ticket, gap = 5) {
  const halb = gap / 2;
  for (let m = vonMin + halb; m <= bisMin - halb + 1e-9; m += halb) zeile(session, m, projekt, ticket, 1);
}
// Sitzung im Modell "aktivitaet": Zeilen alle 2 Min ergeben den Abschnitt [vonMin, bisMin].
function aktivSitzung(zeile, session, vonMin, bisMin, projekt, ticket) {
  for (let m = vonMin; m <= bisMin; m += 2) zeile(session, m, projekt, ticket);
}
const VIERZEHN = 240;   // 14:00 bei zeitDb-Basis 10:00 UTC
const ZWEI_STUNDEN = { start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T16:00:00.000Z' };
const sitzungsZeit = (db, s) => metrics.activeSecondsByGroup(db, {}, { groupBy: 'session' })[s] || 0;

// Abnahmefaelle aus dem Plan: Eintrag 14–16 Uhr, Sitzung 14:30–15:00.
function testUeberlappungRegeln() {
  mitRundung(5, () => {
    // Eigene Zeit: der Mensch war am Geraet, die Minuten zaehlen nur einmal —
    // gleich, ob die Sitzung denselben Vorgang hatte.
    mitZeitmodell(5, 'eingaben', () => {
      const { db, zeile } = zeitDb();
      eingabenSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 60, 'Projekt A', 'PROJ-1');
      const e = eintrag(db, ZWEI_STUNDEN);
      assert.strictEqual(e.abzug_min, 30, 'Abzug ' + e.abzug_min + ' statt 30 (Regel eigene)');
      assert.strictEqual(e.gezaehlt_min, 90, 'gezaehlt ' + e.gezaehlt_min + ' statt 90');
      assert.strictEqual(eintrag(db, { ...ZWEI_STUNDEN, ziel_schluessel: 'PROJ-9' }).gezaehlt_min, 90, 'eigene Zeit nur bei gleichem Ziel abgezogen');
      const u = require('../zeit').ueberlappungVon(db, e.id);
      assert.deepStrictEqual(u.sitzungen.map((s) => [s.session_id, s.min, s.regel, s.ergebnis]), [['sA', 30, 'eigene', 'abzug']]);
      // Aus einem Kalendertermin gebucht: Parallelarbeit wie ein Meeting.
      db.prepare("UPDATE zeit_eintrag SET kalender_uid = 'uid-1' WHERE id = ?").run(e.id);
      assert.strictEqual(require('../zeit').ueberlappungVon(db, e.id).parallel_min, 30, 'Kalendertermin nicht parallel');
      // Aendern behaelt die Herkunft: aus parallel wird nicht still ein Abzug.
      const k = require('../zeit').speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', ...ZWEI_STUNDEN, taetigkeit: 'Entwicklung', notiz: 'neu' }, e.id);
      assert.deepStrictEqual([k.kalender_uid, k.parallel_min, k.gezaehlt_min], ['uid-1', 30, 120], 'Kalenderherkunft beim Aendern verloren');
      // Meeting ist Parallelarbeit: beides zaehlt, ausgewiesen als parallel.
      const m = eintrag(db, { ...ZWEI_STUNDEN, taetigkeit: 'Meeting' });
      assert.deepStrictEqual([m.gezaehlt_min, m.abzug_min, m.parallel_min], [120, 0, 30], 'Meeting: ' + [m.gezaehlt_min, m.abzug_min, m.parallel_min]);
    });
    // Aktivitaet: Claude arbeitet allein, der Mensch kann parallel anderes tun.
    // Nur gleiches Ziel waere doppelt gezaehlt.
    mitZeitmodell(5, 'aktivitaet', () => {
      const { db, zeile } = zeitDb();
      aktivSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 60, 'Projekt A', 'PROJ-1');
      const fall = (d) => eintrag(db, { ...ZWEI_STUNDEN, ...d }).gezaehlt_min;
      assert.strictEqual(fall({}), 90, 'gleicher Vorgang nicht abgezogen');
      assert.strictEqual(fall({ ziel_art: 'projekt', ziel_schluessel: 'Projekt A' }), 90, 'gleiches Projekt nicht abgezogen');
      assert.strictEqual(fall({ ziel_schluessel: 'PROJ-2' }), 120, 'anderer Vorgang abgezogen');
      assert.strictEqual(fall({ ziel_art: 'projekt', ziel_schluessel: 'Projekt B' }), 120, 'anderes Projekt abgezogen');
      assert.strictEqual(fall({ ziel_art: 'intern', ziel_schluessel: 'Planung' }), 120, 'intern als gleiches Ziel gewertet');
    });
    // Werkzeugbetrieb (lokale Modelle, Hintergrundsitzungen) ist keine Arbeit
    // am Geraet und nimmt dem Eintrag nichts.
    mitZeitmodell(5, 'eingaben', () => {
      const { db, zeile } = zeitDb();
      eingabenSitzung(zeile, 'sW', VIERZEHN + 30, VIERZEHN + 60, '(lokal)', null);
      assert.strictEqual(eintrag(db, ZWEI_STUNDEN).gezaehlt_min, 120, 'Werkzeugbetrieb abgezogen');
    });
  });
}

// Abzug ist eine Vereinigung: zwei Sitzungen in denselben 30 Min ziehen 30 ab,
// nicht 60. Rundung kommt nach dem Abzug. Fenster ueber den Rand zaehlen nur innen.
function testUeberlappungVereinigung() {
  mitRundung(5, () => {
    mitZeitmodell(5, 'eingaben', () => {
      const { db, zeile } = zeitDb();
      eingabenSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 60, 'Projekt A', 'PROJ-1');
      eingabenSitzung(zeile, 'sB', VIERZEHN + 30, VIERZEHN + 60, 'Projekt B', 'PROJ-2');
      // Ragt ueber das Ende: 15:50–16:20, davon 10 Min im Eintrag.
      eingabenSitzung(zeile, 'sC', VIERZEHN + 110, VIERZEHN + 140, 'Projekt C', 'PROJ-3');
      const e = eintrag(db, ZWEI_STUNDEN);
      assert.strictEqual(e.abzug_min, 40, 'Abzug ' + e.abzug_min + ' statt 40 (Summe statt Vereinigung oder Rand?)');
      assert.strictEqual(e.gezaehlt_min, 80);
      // sB parallel, sA zieht dieselben Minuten ab: was der Eintrag abgibt,
      // ist nicht zusaetzlich parallel.
      const w = require('../zeit').waehle(db, e.id, 'sB', 'beides').eintrag;
      assert.deepStrictEqual([w.abzug_min, w.parallel_min], [40, 0], 'parallel trotz Abzug: ' + [w.abzug_min, w.parallel_min]);
    });
    // Roh 47, Abzug 3, Schritt 5: erst abziehen, dann runden = 45 (nicht 50 − 3 = 47).
    mitZeitmodell(3, 'eingaben', () => {
      const { db, zeile } = zeitDb();
      zeile('sA', VIERZEHN + 20, 'Projekt A', 'PROJ-1', 1);   // Fenster 14:18:30–14:21:30
      const e = eintrag(db, { start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T15:00:00.000Z', pause_min: 13 });
      assert.deepStrictEqual([e.rohzeit_min, e.abzug_min, e.gezaehlt_min], [47, 3, 45], 'Rundung vor Abzug: ' + [e.rohzeit_min, e.abzug_min, e.gezaehlt_min]);
    });
    // Die Pause hat keine Lage: Claude laeuft die ganze Stunde, der Eintrag hat
    // 40 Min Pause. Abzug hoechstens die Rohzeit, nie mehr als der Eintrag.
    mitZeitmodell(5, 'eingaben', () => {
      const { db, zeile } = zeitDb();
      eingabenSitzung(zeile, 'sA', VIERZEHN, VIERZEHN + 60, 'Projekt A', 'PROJ-1');
      const e = eintrag(db, { start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T15:00:00.000Z', pause_min: 40 });
      assert.deepStrictEqual([e.rohzeit_min, e.abzug_min, e.gezaehlt_min], [20, 20, 0], 'Abzug ueber der Rohzeit: ' + [e.rohzeit_min, e.abzug_min, e.gezaehlt_min]);
    });
  });
}

// metrics.schneide: ohne Abzuege dasselbe Array (Regressionsgarantie), sonst
// genau die Minuten heraus, nur in der genannten Sitzung.
function testSchneide() {
  const a = [{ von: 0, bis: 100, session: 's1', project: 'P' }, { von: 0, bis: 100, session: 's2', project: 'P' }];
  assert.strictEqual(metrics.schneide(a, []), a, 'leere Abzuege muessen dasselbe Array liefern');
  const mitte = metrics.schneide(a, [{ session: 's1', von: 30, bis: 60 }]);
  assert.deepStrictEqual(mitte.map((x) => [x.session, x.von, x.bis]), [['s1', 0, 30], ['s1', 60, 100], ['s2', 0, 100]]);
  assert.deepStrictEqual(metrics.schneide(a, [{ session: 's1', von: -5, bis: 200 }]).map((x) => x.session), ['s2'], 'ganz ueberdeckt bleibt stehen');
  assert.deepStrictEqual(metrics.schneide(a, [{ session: 's1', von: 80, bis: 200 }]).map((x) => [x.von, x.bis]), [[0, 80], [0, 100]]);
  // Zwei Abzuege derselben Sitzung.
  assert.deepStrictEqual(metrics.schneide(a, [{ session: 's1', von: 10, bis: 20 }, { session: 's1', von: 50, bis: 60 }])
    .filter((x) => x.session === 's1').map((x) => [x.von, x.bis]), [[0, 10], [20, 50], [60, 100]]);
  // Felder bleiben erhalten, das Original bleibt unberuehrt.
  assert.strictEqual(mitte[0].project, 'P');
  assert.deepStrictEqual([a[0].von, a[0].bis], [0, 100], 'Original veraendert');
}

// Vierer-Wahl je Paar Eintrag ↔ Sitzung. Sitzung 14:30–15:30 auf PROJ-1
// (Aktivitaet), Eintrag 14:00–15:00 auf PROJ-2: 30 Min Ueberlappung, ohne Wahl
// zaehlt beides.
function testWahl() {
  const zeit = require('../zeit');
  mitRundung(5, () => mitZeitmodell(5, 'aktivitaet', () => {
    const { db, zeile } = zeitDb();
    aktivSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 90, 'Projekt A', 'PROJ-1');
    const e = eintrag(db, { ziel_schluessel: 'PROJ-2', start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T15:00:00.000Z' });
    assert.strictEqual(e.gezaehlt_min, 60);
    assert.strictEqual(sitzungsZeit(db, 'sA'), 3600);
    const stand = (w) => {
      const r = zeit.waehle(db, e.id, 'sA', w).eintrag;
      return [r.gezaehlt_min, r.abzug_min, r.parallel_min, r.kulanz_min, sitzungsZeit(db, 'sA')];
    };
    assert.deepStrictEqual(stand('meine'), [60, 0, 0, 0, 1800], 'meine: Eintrag voll, Sitzung genau −30 Min');
    assert.deepStrictEqual(stand('claude'), [30, 30, 0, 0, 3600], 'claude: Eintrag −30, Sitzung voll');
    assert.deepStrictEqual(stand('keins'), [30, 30, 0, 30, 1800], 'keins: beide −30, Kulanz 30');
    assert.deepStrictEqual(stand('beides'), [60, 0, 30, 0, 3600], 'beides: beide voll, parallel 30');
    assert.strictEqual(metrics.byTicket(db, {}).find((r) => r.ticket === 'PROJ-1').active_seconds, 3600);
    assert.strictEqual(zeit.ueberlappungVon(db, e.id).sitzungen[0].wahl, 'beides');
    // Wahl gilt auch fuer den Vorgang, nicht nur die Sitzung.
    zeit.waehle(db, e.id, 'sA', 'meine');
    assert.strictEqual(metrics.byTicket(db, {}).find((r) => r.ticket === 'PROJ-1').active_seconds, 1800, 'Vorgang sieht die Wahl nicht');
    // Grenzen.
    assert.throws(() => zeit.waehle(db, e.id, 'sA', 'halb'), /Wahl: beides, claude, meine oder keins/);
    assert.throws(() => zeit.waehle(db, e.id, 'gibts-nicht', 'meine'), /Sitzung/);
    // Eine echte Sitzung ohne Ueberschneidung bekommt keine Wahl — sonst wirkte
    // sie unsichtbar, sobald der Eintrag spaeter verschoben wird.
    aktivSitzung(zeile, 'sZ', VIERZEHN + 240, VIERZEHN + 270, 'Projekt Z', 'PROJ-9');
    assert.throws(() => zeit.waehle(db, e.id, 'sZ', 'meine'), /Überschneidung/, 'Wahl ohne Ueberlappung angenommen');
    assert.throws(() => zeit.waehle(db, 99999, 'sA', 'meine'), /Eintrag nicht gefunden/);
    // Abgerechnet: Wahl gesperrt, Eintrag bleibt.
    db.prepare("UPDATE zeit_eintrag SET status = 'abgerechnet', rechnung_nr = 'R-1' WHERE id = ?").run(e.id);
    assert.throws(() => zeit.waehle(db, e.id, 'sA', 'claude'), /gesperrt/);
    db.prepare("UPDATE zeit_eintrag SET status = 'offen', rechnung_nr = NULL WHERE id = ?").run(e.id);
    // Loeschen nimmt die Wahl mit: die Sitzung bekommt ihre Zeit zurueck.
    zeit.loesche(db, e.id);
    assert.strictEqual(sitzungsZeit(db, 'sA'), 3600, 'Wahl ueberlebt das Loeschen');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM ueberlappung_wahl').get().n, 0);
  }));
  // Abnahmefall: gleicher Vorgang, eigene Zeit, "meine" — Eintrag voll 120,
  // die Sitzung verliert genau die 30 Minuten.
  mitRundung(5, () => mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile } = zeitDb();
    eingabenSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 60, 'Projekt A', 'PROJ-1');
    const vorher = sitzungsZeit(db, 'sA');
    const e = eintrag(db, ZWEI_STUNDEN);
    assert.strictEqual(e.gezaehlt_min, 90);
    assert.strictEqual(zeit.waehle(db, e.id, 'sA', 'meine').eintrag.gezaehlt_min, 120);
    assert.strictEqual(vorher - sitzungsZeit(db, 'sA'), 1800, 'Sitzung nicht genau −1800 s');
    // Aendern ohne neue Zeiten behaelt die Wahl.
    const d = { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', ...ZWEI_STUNDEN, taetigkeit: 'Entwicklung', notiz: 'geaendert' };
    assert.strictEqual(zeit.speichere(db, d, e.id).gezaehlt_min, 120, 'Aendern vergisst die Wahl');
    // Verschoben ohne Ueberlappung: die Wahl faellt weg, die Sitzung hat ihre Zeit zurueck.
    zeit.speichere(db, { ...d, start: '2026-08-18T17:00:00.000Z', ende: '2026-08-18T18:00:00.000Z' }, e.id);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM ueberlappung_wahl').get().n, 0, 'verwaiste Wahl bleibt stehen');
    assert.strictEqual(sitzungsZeit(db, 'sA'), vorher, 'Sitzung nach dem Verschieben nicht zurueck');
  }));
}

// Vorschau rechnet wie Speichern, schreibt aber nichts.
function testZeitVorschau() {
  const zeit = require('../zeit');
  mitRundung(5, () => mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile } = zeitDb();
    eingabenSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 60, 'Projekt A', 'PROJ-1');
    const d = { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-1', ...ZWEI_STUNDEN, taetigkeit: 'Entwicklung' };
    const v = zeit.vorschau(db, d);
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM zeit_eintrag').get().n, 0, 'Vorschau hat gespeichert');
    assert.deepStrictEqual([v.rohzeit_min, v.abzug_min, v.gezaehlt_min, v.rundung], [120, 30, 90, 5]);
    assert.deepStrictEqual(v.sitzungen.map((s) => s.regel), ['eigene']);
    const e = zeit.speichere(db, d);
    assert.strictEqual(e.gezaehlt_min, v.gezaehlt_min);
    // Mit id gelten die Wahlen dieses Eintrags.
    zeit.waehle(db, e.id, 'sA', 'beides');
    assert.strictEqual(zeit.vorschau(db, d, e.id).gezaehlt_min, 120, 'Vorschau ignoriert die Wahl');
    assert.throws(() => zeit.vorschau(db, { ...d, ziel_art: 'xx' }), /Zielart/);
  }));
}

// Logs kommen verzoegert: offene Eintraege der letzten 48 h werden nachgerechnet,
// aeltere und abgerechnete nicht.
function testNachrechnen() {
  const zeit = require('../zeit');
  mitRundung(5, () => mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile } = zeitDb();
    const neu = eintrag(db, ZWEI_STUNDEN);
    const alt = eintrag(db, { start: '2026-08-15T14:00:00.000Z', ende: '2026-08-15T16:00:00.000Z' });
    const zu = eintrag(db, { ...ZWEI_STUNDEN, ziel_schluessel: 'PROJ-7' });
    db.prepare("UPDATE zeit_eintrag SET status = 'abgerechnet', rechnung_nr = 'R-1' WHERE id = ?").run(zu.id);
    assert.strictEqual(neu.gezaehlt_min, 120);
    // Die Sitzung kommt erst jetzt ins Log — auch fuer den alten Tag.
    eingabenSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 60, 'Projekt A', 'PROJ-1');
    eingabenSitzung(zeile, 'sB', VIERZEHN + 30 - 3 * 1440, VIERZEHN + 60 - 3 * 1440, 'Projekt A', 'PROJ-1');
    const jetzt = Date.parse('2026-08-19T10:00:00.000Z');
    assert.strictEqual(zeit.nachrechnen(db, { seitStunden: 48, jetzt }), 1, 'genau ein Eintrag haette sich aendern muessen');
    assert.strictEqual(zeit.lade(db, neu.id).gezaehlt_min, 90, 'neuer Eintrag nicht nachgerechnet');
    assert.strictEqual(zeit.lade(db, alt.id).gezaehlt_min, 120, 'Eintrag aelter als 48 h nachgerechnet');
    assert.strictEqual(zeit.lade(db, zu.id).gezaehlt_min, 120, 'abgerechneter Eintrag nachgerechnet');
    // Zweiter Lauf: nichts mehr zu tun.
    assert.strictEqual(zeit.nachrechnen(db, { seitStunden: 48, jetzt }), 0);
    // Ohne Grenze (nach Einstellungsaenderung, beim Start): auch der alte, nie der abgerechnete.
    assert.strictEqual(zeit.nachrechnen(db, { seitStunden: Infinity, jetzt }), 1);
    assert.strictEqual(zeit.lade(db, alt.id).gezaehlt_min, 90, 'alle offenen nicht nachgerechnet');
    assert.strictEqual(zeit.lade(db, zu.id).gezaehlt_min, 120);
    // Ein kaputter Eintrag haelt die anderen nicht auf, faellt aber auf.
    const ok = eintrag(db, { ...ZWEI_STUNDEN, ziel_schluessel: 'PROJ-8', taetigkeit: 'Meeting' });
    db.prepare("UPDATE zeit_eintrag SET start = '2026-08-18Tkaputt' WHERE id = ?").run(neu.id);
    db.prepare("UPDATE zeit_eintrag SET taetigkeit = 'Entwicklung' WHERE id = ?").run(ok.id);
    assert.throws(() => zeit.nachrechnen(db, { seitStunden: 48, jetzt }), /1 Eintrag/, 'kaputter Eintrag still uebergangen');
    assert.strictEqual(zeit.lade(db, ok.id).gezaehlt_min, 90, 'Eintrag nach dem kaputten nicht nachgerechnet');
  }));
}

// Live: Sitzungszeilen tragen die Ueberlappungen mit Wahl, die Zeit der Sitzung
// folgt der Wahl.
function testLiveWahl() {
  const zeit = require('../zeit');
  const basis = Math.floor((Date.now() - 50 * 60000) / 60000) * 60000;
  mitRundung(5, () => mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile, t } = zeitDb(basis);
    eingabenSitzung(zeile, 'sL', 10, 40, 'Projekt A', 'PROJ-1');
    const e = eintrag(db, { start: t(0), ende: t(45), ziel_schluessel: 'PROJ-1' });
    const zeileL = () => metrics.live(db).sessions.find((s) => s.session_id === 'sL');
    assert.deepStrictEqual(zeileL().wahl.map((w) => [w.eintrag_id, w.wahl, w.min]), [[e.id, null, 30]], 'Ueberlappung fehlt in live');
    assert.strictEqual(zeileL().active_seconds, 1800);
    zeit.waehle(db, e.id, 'sL', 'meine');
    assert.deepStrictEqual(zeileL().wahl.map((w) => w.wahl), ['meine']);
    assert.strictEqual(zeileL().active_seconds, 0, 'live-Zeit folgt der Wahl nicht');
  }));
}

// Die Spalte "Bei Ueberlappung" nennt den Eintrag mit seiner Zeitspanne —
// ohne sie sind zwei Eintraege derselben Sitzung nicht auseinanderzuhalten.
function testLiveWahlZeitspanne() {
  const basis = Math.floor((Date.now() - 50 * 60000) / 60000) * 60000;
  mitRundung(5, () => mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile, t } = zeitDb(basis);
    eingabenSitzung(zeile, 'sZ', 10, 40, 'Projekt A', 'PROJ-1');
    const e = eintrag(db, { start: t(0), ende: t(45), ziel_schluessel: 'PROJ-1' });
    const w = metrics.live(db).sessions.find((s) => s.session_id === 'sZ').wahl;
    assert.deepStrictEqual(w.map((x) => [x.eintrag_id, x.start, x.ende]), [[e.id, e.start, e.ende]], 'Zeitspanne fehlt: ' + JSON.stringify(w));
  }));
}

// Detail: dieselbe Wahl wie in Live, an der Sitzung des Vorgangs. Gegenprobe:
// ohne Eintrag bleibt die Liste leer, die Sitzung selbst bleibt unveraendert.
function testVorgangSitzungWahl() {
  const zeit = require('../zeit');
  mitRundung(5, () => mitZeitmodell(5, 'eingaben', () => {
    const { db, zeile, t } = zeitDb();
    eingabenSitzung(zeile, 'sV', 10, 40, 'Projekt A', 'PROJ-1');
    const ohne = metrics.sitzungenJeVorgang(db, 'PROJ-1').find((s) => s.session_id === 'sV');
    assert.deepStrictEqual(ohne.wahl, [], 'Wahl ohne Eintrag');
    const e = eintrag(db, { start: t(0), ende: t(45), ziel_schluessel: 'PROJ-1' });
    zeit.waehle(db, e.id, 'sV', 'beides');
    const s = metrics.sitzungenJeVorgang(db, 'PROJ-1').find((x) => x.session_id === 'sV');
    assert.deepStrictEqual(s.wahl.map((w) => [w.eintrag_id, w.wahl, w.min, w.start]), [[e.id, 'beides', 30, e.start]], 'Wahl fehlt: ' + JSON.stringify(s.wahl));
    assert.strictEqual(s.active_seconds, 1800, 'beides kuerzt die Sitzung nicht');
    // Alter Vorgang: 501 spaetere Eintraege duerfen seinen Eintrag nicht aus der Liste druecken.
    const spalten = db.prepare('PRAGMA table_info(zeit_eintrag)').all().map((c) => c.name).filter((c) => c !== 'id');
    const kopie = db.prepare('INSERT INTO zeit_eintrag (' + spalten.join(',') + ') SELECT ' +
      spalten.map((c) => (c === 'tag' ? '?' : c === 'start' ? '?' : c === 'ende' ? '?' : c)).join(',') + ' FROM zeit_eintrag WHERE id = ?');
    for (let i = 0; i < 501; i++) kopie.run('2026-09-' + String(1 + (i % 28)).padStart(2, '0'), '2026-09-01T08:00:00.000Z', '2026-09-01T08:30:00.000Z', e.id);
    const spaeter = metrics.sitzungenJeVorgang(db, 'PROJ-1').find((x) => x.session_id === 'sV');
    assert.deepStrictEqual(spaeter.wahl.map((w) => w.eintrag_id), [e.id], 'spaetere Eintraege verdraengen den Eintrag des Vorgangs');
  }));
}

// "Abrechenbar offen X h · Y EUR": Stunden mit derselben Abgrenzung wie offen_eur —
// Claude-Zeit nicht abgerechneter Zeilen plus offene manuelle Stunden.
function testKennzahlenOffeneStunden() {
  const zeilen = [
    { ticket: 'A-1', arbeitswert: 600, active_hours: 6, manuell_hours: 1, manuell_offen_hours: 0.5 },
    { ticket: 'A-2', arbeitswert: 300, active_hours: 3, manuell_hours: 1.5, manuell_offen_hours: 1.5 },
    { gruppe: 'Projekt X', arbeitswert: 100, active_hours: 1 },
  ];
  const abrechnung = Object.create(null);
  abrechnung['A-1'] = { betrag_eur: 600, nummern: ['2026-0001'] };
  const k = metrics.kennzahlen(zeilen, abrechnung);
  // A-1 gestellt: nur seine offene manuelle halbe Stunde. A-2: 3 + 1,5. Projekt X: 1.
  assert.strictEqual(k.offen_stunden, 6, 'offene Stunden: ' + k.offen_stunden);
  // Plausibel: nie negativ, nie mehr als alle abrechenbaren Stunden.
  assert.ok(k.offen_stunden >= 0 && k.offen_stunden <= k.aktive_stunden + k.manuell_stunden, 'offen ausserhalb 0..abrechenbar');
  assert.strictEqual(metrics.kennzahlen([], Object.create(null)).offen_stunden, 0, 'ohne Zeilen nicht 0');
  // Der Rechenweg nennt die Stunden hinter "Eigene Zeit" vom Server: Claude 10 + manuell 2,5.
  assert.strictEqual(k.wert.eigene_stunden, 12.5, 'eigene Stunden: ' + k.wert.eigene_stunden);
}

// --- Zeiterfassung (Block Z3): Rechnung, Sperre, Kennzahlen, Woche ---------
// Manuelle Zeit geht als eigene Position auf die Rechnung, nie versteckt in der
// Vorgangsposition. Gestellte Eintraege sind gesperrt; ein Storno gibt sie frei,
// ohne die gestellte Abschrift anzufassen.

// rechnungsDb (Sitzung s-r 18.08. 10–12 Uhr auf PROJ-500, Projekt "Beispiel - App")
// mit festen Saetzen und Regeln. Satz 80, Rabatt 10 % -> 72 je Stunde.
function zeitRechnung(fn) {
  return rechnungsUmgebung(() => mitConfig({ stundensatz: 100 }, () => mitRundung(15, () =>
    mitZeitmodell(5, 'aktivitaet', () => mitProjektSatz('Beispiel - App', { satz: 80, rabatt: 10 }, () => {
      const db = rechnungsDb();
      const e = (start, ende, d = {}) => eintrag(db, { ziel_schluessel: 'PROJ-500', start, ende, ...d });
      const ids = {
        e1: e('2026-08-20T14:00:00.000Z', '2026-08-20T15:30:00.000Z').id,
        e2: e('2026-08-21T09:00:00.000Z', '2026-08-21T10:00:00.000Z').id,
        e3: e('2026-08-21T10:00:00.000Z', '2026-08-21T10:45:00.000Z', { taetigkeit: 'Review' }).id,
        // Ueberlappt die Sitzung 11–12 Uhr am selben Vorgang: 60 Min Abzug.
        e5: e('2026-08-18T11:00:00.000Z', '2026-08-18T12:30:00.000Z').id,
      };
      return fn(db, ids);
    })))));
}
const EMPF = { name: 'Kunde GmbH', anschrift: ['Weg 1', '50667 Köln'] };
const AUGUST = { from: '2026-08-01', to: '2026-08-31' };

function testRechnungZeitpositionen() {
  const rechnung = require('../rechnung');
  const zeit = require('../zeit');
  zeitRechnung((db, { e1, e2, e3, e5 }) => {
    zeit.waehle(db, e5, 's-r', 'keins');   // 30 gezaehlt, 60 Kulanz, Sitzung −60
    const pos = rechnung.baue(db, { ...AUGUST, eintraege: [e1, e2, e3, e5], gruppierung: 'taetigkeit' });
    const kurz = pos.map((p) => [p.typ, p.bezeichnung, p.stunden, p.satz, p.betrag_eur]);
    assert.deepStrictEqual(kurz, [
      ['zeit', 'Entwicklung – Vorgang PROJ-500', 3, 72, 216],
      ['zeit', 'Review – Vorgang PROJ-500', 0.75, 72, 54],
      ['kulanz', 'Kulanz – nicht berechnete Zeit', 1, 0, 0],
    ], 'Positionen: ' + JSON.stringify(kurz));
    const ent = pos[0];
    assert.deepStrictEqual([ent.basissatz, ent.rabatt_prozent, ent.ziel_art, ent.ziel], [80, 10, 'vorgang', 'PROJ-500']);
    assert.deepStrictEqual(ent.refs, [e5, e1, e2], 'refs');
    assert.deepStrictEqual(ent.tage, ['2026-08-18', '2026-08-20', '2026-08-21'], 'tage');
    assert.strictEqual(ent.ticket, undefined, 'Zeitposition traegt ticket — abrechnung() zaehlte sie als Vorgang');
    assert.deepStrictEqual(pos[2].refs, [e5]);
    // Je Eintrag: eine Zeile je Eintrag, die Summe bleibt.
    const je = rechnung.baue(db, { ...AUGUST, eintraege: [e1, e2, e3, e5], gruppierung: 'eintrag' });
    assert.strictEqual(je.filter((p) => p.typ === 'zeit').length, 4);
    assert.strictEqual(Math.round(je.reduce((a, p) => a + p.betrag_eur, 0) * 100) / 100, 270);
    // Mit Vorgang: Claude-Position nimmt nur Claude-Zeit (10–11, die Kulanz-Stunde
    // 11–12 hat die Sitzung abgegeben) — nie dieselben Minuten zweimal.
    const beide = rechnung.baue(db, { ...AUGUST, tickets: ['PROJ-500'], eintraege: [e1, e5] });
    const claude = beide.find((p) => p.ticket === 'PROJ-500');
    assert.deepStrictEqual([claude.stunden, claude.betrag_eur], [1, 72], 'Claude-Position: ' + [claude.stunden, claude.betrag_eur]);
    const stunden = beide.filter((p) => p.typ !== 'kulanz').reduce((a, p) => a + p.stunden, 0);
    assert.ok(stunden <= 1 + 1.5 + 0.5 + 1e-9, 'mehr Stunden abgerechnet als gearbeitet: ' + stunden);
  });
}

function testRechnungZeitPruefungen() {
  const rechnung = require('../rechnung');
  const zeit = require('../zeit');
  zeitRechnung((db, { e1, e2 }) => {
    const nicht = eintrag(db, { ziel_schluessel: 'PROJ-500', start: '2026-08-22T09:00:00.000Z', ende: '2026-08-22T10:00:00.000Z', abrechenbar: false }).id;
    const intern = eintrag(db, { ziel_art: 'intern', ziel_schluessel: 'Planung', start: '2026-08-22T11:00:00.000Z', ende: '2026-08-22T12:00:00.000Z' }).id;
    const fall = (d, muster, was) => assert.throws(() => rechnung.baue(db, { ...AUGUST, ...d }), muster, was);
    fall({ eintraege: [99999] }, /Eintrag #99999 nicht gefunden/, 'unbekannter Eintrag');
    fall({ eintraege: [nicht] }, new RegExp('Eintrag #' + nicht + ' ist nicht abrechenbar'), 'nicht abrechenbar');
    fall({ eintraege: [intern] }, /Interne Eintr.ge geh.ren auf keine Rechnung/, 'intern');
    fall({ eintraege: [e1, e1] }, /doppelt/, 'doppelt');
    fall({ eintraege: 'e1' }, /Liste/, 'keine Liste');
    fall({ eintraege: ['abc'] }, /nicht gefunden/, 'keine Zahl');
    fall({ eintraege: Array.from({ length: 501 }, (_, i) => i + 1) }, /500 Eintr/, 'zu viele');
    fall({ eintraege: [e1], gruppierung: 'woche' }, /Gruppierung/, 'Gruppierung');
    fall({ from: '2026-08-01', to: '2026-08-19', eintraege: [e1] }, /ausserhalb des Leistungszeitraums/, 'Eintrag ausserhalb des Zeitraums');
    // Veralteter gespeicherter Wert: vor dem Stellen frisch gerechnet.
    db.prepare('UPDATE zeit_eintrag SET gezaehlt_min = 999 WHERE id = ?').run(e2);
    const p = rechnung.baue(db, { ...AUGUST, eintraege: [e2] })[0];
    assert.strictEqual(p.stunden, 1, 'gespeicherter statt frisch gerechneter Wert: ' + p.stunden);
    assert.strictEqual(zeit.lade(db, e2).gezaehlt_min, 60, 'frischer Wert nicht gespeichert');
    // Vorgang nur mit manueller Zeit: keine Claude-Position mit 0 h.
    const nur = eintrag(db, { ziel_schluessel: 'PROJ-777', start: '2026-08-23T09:00:00.000Z', ende: '2026-08-23T10:00:00.000Z' }).id;
    fall({ tickets: ['PROJ-777'] }, /keine Daten/, '0-h-Position');
    // Gewaehlt, aber ohne Claude-Zeit: nicht still weglassen, sondern sagen.
    fall({ tickets: ['PROJ-777'], eintraege: [nur] }, /PROJ-777 hat im Zeitraum keine Claude-Zeit/, 'Vorgang still verworfen');
    assert.deepStrictEqual(rechnung.baue(db, { ...AUGUST, eintraege: [nur] }).map((x) => x.typ), ['zeit']);
    // Ganz abgezogen (Claude 10–11 am selben Vorgang): nichts abzurechnen,
    // also auch nicht unsichtbar sperren.
    const leerE = eintrag(db, { ziel_schluessel: 'PROJ-500', start: '2026-08-18T10:00:00.000Z', ende: '2026-08-18T11:00:00.000Z' });
    assert.strictEqual(leerE.gezaehlt_min, 0);
    fall({ eintraege: [leerE.id] }, new RegExp('Eintrag #' + leerE.id + ' hat nach dem Abzug keine abrechenbare Zeit'), 'leerer Eintrag gesperrt');
    // Kaputter Satz ergibt keine 0-EUR-Position.
    const ohneSatz = eintrag(db, { ziel_art: 'projekt', ziel_schluessel: 'Ohne Satz', start: '2026-08-24T09:00:00.000Z', ende: '2026-08-24T10:00:00.000Z' }).id;
    mitConfig({ stundensatz: 'kaputt' }, () => fall({ eintraege: [ohneSatz] }, /Satz/, 'kaputter Satz'));
  });
}

function testSperreUndStorno() {
  const rechnung = require('../rechnung');
  const zeit = require('../zeit');
  zeitRechnung((db, { e1, e2, e3 }) => {
    const daten = { ...AUGUST, eintraege: [e1, e2], empfaenger: EMPF };
    const inv = rechnung.erstelle(db, daten);
    for (const id of [e1, e2]) {
      const e = zeit.lade(db, id);
      assert.deepStrictEqual([e.status, e.rechnung_nr, e.satz_eingefroren], ['abgerechnet', inv.nr, 72], 'Sperre #' + id);
    }
    assert.strictEqual(zeit.lade(db, e3).status, 'offen', 'nicht gewaehlter Eintrag gesperrt');
    assert.throws(() => zeit.speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-500', start: '2026-08-20T14:00:00.000Z', ende: '2026-08-20T15:00:00.000Z', taetigkeit: 'Entwicklung' }, e1), /gesperrt/);
    assert.throws(() => rechnung.erstelle(db, daten), new RegExp('Eintrag #' + e1 + ' ist bereits abgerechnet \\(Rechnung ' + inv.nr + '\\)'));
    assert.throws(() => rechnung.vorschau(db, daten), /bereits abgerechnet/);
    // Wettlauf: zwischen Vorschau und Schreiben stellt jemand anderes den Eintrag.
    const d = rechnung.entwurf(db, { ...AUGUST, eintraege: [e3], empfaenger: EMPF });
    db.prepare("UPDATE zeit_eintrag SET status = 'abgerechnet', rechnung_nr = '2026-9999' WHERE id = ?").run(e3);
    const vorher = db.prepare('SELECT COUNT(*) n FROM invoices').get().n;
    assert.throws(() => rechnung.schreibe(db, d), (err) => err.abweichung === true && /inzwischen abgerechnet/.test(err.message));
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM invoices').get().n, vorher, 'Rechnung trotz Wettlauf geschrieben');
    db.prepare("UPDATE zeit_eintrag SET status = 'offen', rechnung_nr = NULL WHERE id = ?").run(e3);
    // Storno: Eintraege wieder offen, die Abschrift bleibt Byte fuer Byte.
    const abschrift = JSON.stringify(rechnung.lade(db, inv.nr).positionen);
    rechnung.storniere(db, inv.nr);
    assert.strictEqual(JSON.stringify(rechnung.lade(db, inv.nr).positionen), abschrift, 'Storno aendert die Abschrift');
    for (const id of [e1, e2]) {
      const e = zeit.lade(db, id);
      assert.deepStrictEqual([e.status, e.rechnung_nr, e.satz_eingefroren], ['offen', null, null], 'Freigabe #' + id);
    }
    assert.strictEqual(rechnung.erstelle(db, daten).positionen[0].betrag_eur, 180, 'nach Storno nicht wieder stellbar');
  });
}

function testAbrechnungZeitpositionen() {
  const rechnung = require('../rechnung');
  const metrics = require('../metrics');
  const zeit = require('../zeit');
  zeitRechnung((db, { e1, e2, e3 }) => {
    const o = AUGUST;
    const k = () => metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
    const vorher = k();
    assert.strictEqual(vorher.abgerechnet_manuell_eur, 0);
    rechnung.erstelle(db, { ...AUGUST, eintraege: [e1, e2], empfaenger: EMPF });
    // Zeitpositionen sind keine Vorgangsabrechnung.
    assert.strictEqual(rechnung.abrechnung(db)['PROJ-500'], undefined, 'Zeitposition als Vorgang gezaehlt');
    assert.strictEqual(rechnung.abgerechnetFuerVorgang(db, 'PROJ-500'), 180, 'manuell abgerechnet je Vorgang');
    const nach = k();
    assert.strictEqual(nach.abgerechnet_manuell_eur, 180);
    assert.ok(Math.abs(nach.offen_eur - (vorher.offen_eur - 180)) < 1e-9, 'offen nicht um die manuelle Rechnung gesunken');
    assert.strictEqual(nach.wert.arbeitswert, vorher.wert.arbeitswert, 'Arbeitswert durch Abrechnung veraendert');
    // Plausibel: offen nie negativ, nie mehr als der Arbeitswert.
    assert.ok(nach.offen_eur >= -1e-9 && nach.offen_eur <= nach.wert.arbeitswert + 1e-9, 'offen ausserhalb 0..Arbeitswert: ' + nach.offen_eur);
    // Offen bleiben e3 (45 Min) und e5 (30 Min gezaehlt).
    const offen = nach.manuell_offen_stunden;
    assert.strictEqual(offen, 1.25, 'offene manuelle Stunden: ' + offen);
    // Vorgang nur mit manueller Zeit, ganz gestellt: zaehlt nicht mehr als offen.
    const nur = eintrag(db, { ziel_schluessel: 'PROJ-888', start: '2026-08-23T09:00:00.000Z', ende: '2026-08-23T10:00:00.000Z' }).id;
    const vorNur = k().offen_vorgaenge;
    rechnung.erstelle(db, { ...AUGUST, eintraege: [nur], empfaenger: EMPF });
    assert.strictEqual(vorNur - k().offen_vorgaenge, 1, 'gestellter Vorgang zaehlt weiter als offen');
  });
}

function testDruckUndErechnungZeit() {
  const rechnung = require('../rechnung');
  const erechnung = require('../erechnung');
  const zeit = require('../zeit');
  zeitRechnung((db, { e1, e5 }) => {
    zeit.waehle(db, e5, 's-r', 'keins');
    // Was die E-Rechnung zusaetzlich verlangt (rechnungsUmgebung stellt den Rest zurueck).
    Object.assign(require('../config.json').rechnung.aussteller, { email: 'test@example.org', telefon: '0221 123' });
    const inv = rechnung.erstelle(db, { ...AUGUST, eintraege: [e1, e5], empfaenger: { ...EMPF, email: 'kunde@example.org', kaeufer_referenz: 'K-1' } });
    const html = rechnung.renderHtml(inv);
    assert.ok(html.includes('18.08., 20.08.'), 'Tage fehlen in der Unterzeile');
    assert.ok(/Kulanz – nicht berechnete Zeit[\s\S]*?0,00 EUR/.test(html), 'Kulanz ohne 0,00 EUR');
    const xml = erechnung.alsXml(inv);
    assert.ok(/<ram:Name>Kulanz – nicht berechnete Zeit<\/ram:Name>[\s\S]*?<ram:ChargeAmount>0\.00<\/ram:ChargeAmount>[\s\S]*?<ram:BilledQuantity unitCode="HUR">1<\/ram:BilledQuantity>/.test(xml),
      'Kulanz nicht als Stunden zu 0,00 in der E-Rechnung');
  });
}

// Woche, Monat, Ziele, Analyse: Arbeitszeit = Vereinigung aus Eintraegen und
// Claude-Zeit, eine Minute zaehlt einmal. Soll Mo–Fr.
function testZeitAnsichten() {
  const zeit = require('../zeit');
  zeitRechnung((db, { e5 }) => mitConfig({ tagessollStunden: 8 }, () => {
    // Ohne Wahl laufen Claude (10–12) und Eintrag (11–12:30) eine Stunde
    // gleichzeitig: Arbeitszeit 10:00–12:30 = 150, nicht 120 + 90.
    const vorWahl = zeit.woche(db, '2026-08-17').tage[1];
    assert.deepStrictEqual([vorWahl.claude_min, vorWahl.manuell_min, vorWahl.arbeitszeit_min], [120, 90, 150], 'Arbeitszeit ohne Vereinigung: ' + vorWahl.arbeitszeit_min);
    zeit.waehle(db, e5, 's-r', 'keins');   // Claude 10–11, Eintrag 11–12:30
    const w = zeit.woche(db, '2026-08-17');
    assert.deepStrictEqual(w.tage.map((t) => t.tag), ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23']);
    const di = w.tage[1];
    assert.deepStrictEqual([di.eintraege.map((e) => e.id), di.claude_min, di.manuell_min, di.arbeitszeit_min, di.soll_min], [[e5], 60, 90, 150, 480],
      'Dienstag: ' + JSON.stringify([di.eintraege.map((e) => e.id), di.claude_min, di.manuell_min, di.arbeitszeit_min, di.soll_min]));
    assert.deepStrictEqual(di.claude_fenster.map((f) => [f.session_id, f.von, f.bis]), [['s-r', '2026-08-18T10:00:00.000Z', '2026-08-18T11:00:00.000Z']]);
    assert.strictEqual(w.tage[5].soll_min, 0, 'Samstag mit Soll');
    // Do 20.08.: Eintrag 14:00–15:30 = 90.
    assert.strictEqual(w.tage[3].arbeitszeit_min, 90);
    assert.strictEqual(w.summe.arbeitszeit_min, 150 + 90 + 60 + 45);
    assert.throws(() => zeit.woche(db, '2026-08-18'), /Montag/, 'Dienstag als Wochenbeginn');
    assert.throws(() => zeit.woche(db, 'gestern'), /Montag/);
    const m = zeit.monat(db, AUGUST);
    assert.strictEqual(m.tage.length, 31);
    assert.strictEqual(m.summe.arbeitszeit_min, 345);
    assert.strictEqual(m.summe.soll_min, 21 * 480, 'Soll August: 21 Werktage');
    assert.strictEqual(m.summe.saldo_min, 345 - 21 * 480);
    assert.throws(() => zeit.monat(db, { from: '2026-01-01', to: '2026-12-31' }), /62 Tage/);
    const z = zeit.zieleTabelle(db, AUGUST);
    const p = z.find((r) => r.ziel_art === 'vorgang' && r.ziel_schluessel === 'PROJ-500');
    assert.deepStrictEqual([p.eintraege, p.manuell_min, p.offen_min, p.abgerechnet_min, p.status], [4, 90 + 60 + 45 + 30, 225, 0, 'offen']);
    assert.ok(Math.abs(p.offen_eur - 225 / 60 * 72) < 1e-9, 'offen_eur ' + p.offen_eur);
    const a = zeit.analyse(db, AUGUST);
    assert.deepStrictEqual([a.kpis.kulanz_min, a.kpis.parallel_min], [60, 0]);
    assert.deepStrictEqual(a.taetigkeiten.map((t) => [t.name, t.min]), [['Entwicklung', 180], ['Review', 45]]);
    assert.ok(a.wochen.some((x) => x.montag === '2026-08-17' && x.ist_stunden === 345 / 60), 'Woche fehlt in der Analyse');
  }));
}

// Analyse-Reiter Arbeitszeit (Z5b): je Woche Claude und manuell abrechenbar neben der
// Arbeitszeit, je Taetigkeit der Betrag. Summen muessen zu den KPIs und zur Liste passen.
function testAnalyseWochenTaetigkeiten() {
  const zeit = require('../zeit');
  zeitRechnung((db) => mitConfig({ tagessollStunden: 8 }, () => {
    const a = zeit.analyse(db, AUGUST);
    const s = (k) => a.wochen.reduce((x, w) => x + w[k], 0);
    assert.ok(Math.abs(s('claude_stunden') + s('manuell_stunden') - a.kpis.abrechenbar_stunden) < 1e-9, 'Wochen ergeben nicht die abrechenbare Zeit');
    assert.ok(Math.abs(s('manuell_stunden') - a.kpis.manuell_stunden) < 1e-9, 'manuelle Wochen ≠ KPI');
    // Woche 17.08. unabhaengig ueber woche(): Claude-Minuten der Tage.
    const w17 = a.wochen.find((w) => w.montag === '2026-08-17');
    assert.strictEqual(w17.claude_stunden, zeit.woche(db, '2026-08-17').summe.claude_min / 60, 'Claude der Woche');
    assert.ok(w17.manuell_stunden > 0 && w17.manuell_stunden <= w17.ist_stunden + w17.claude_stunden, 'manuell der Woche unplausibel');
    // Betrag je Taetigkeit = Summe der Eintraege dieser Taetigkeit aus der Liste (eine Formel).
    const liste = zeit.imRahmen(db, AUGUST);
    for (const t of a.taetigkeiten) {
      const soll = liste.filter((e) => e.taetigkeit === t.name).reduce((x, e) => x + e.eur, 0);
      assert.ok(Math.abs(t.eur - soll) < 1e-9 && t.eur > 0, 'Betrag ' + t.name + ': ' + t.eur + ' ≠ ' + soll);
    }
  }));
}

// Pflicht aus Z3: "Nur meine Zeit"/"Keins" kuerzt Claude-Zeit. Ist der Vorgang der
// Sitzung schon abgerechnet, verschoebe das still "abgerechnet" gegen den Arbeitswert.
function testWahlAbgerechneterVorgang() {
  const rechnung = require('../rechnung');
  const zeit = require('../zeit');
  zeitRechnung((db, { e5 }) => {
    rechnung.erstelle(db, { ...AUGUST, tickets: ['PROJ-500'], empfaenger: EMPF });
    assert.throws(() => zeit.waehle(db, e5, 's-r', 'keins'), /abgerechnet/, 'Keins auf abgerechnete Vorgangszeit angenommen');
    assert.throws(() => zeit.waehle(db, e5, 's-r', 'meine'), /abgerechnet/, 'Nur meine Zeit auf abgerechnete Vorgangszeit angenommen');
    // Was Claude-Zeit nicht kuerzt, bleibt moeglich.
    assert.strictEqual(zeit.waehle(db, e5, 's-r', 'beides').eintrag.id, e5);
    // Nachtrag mit "Keins" ueber derselben Sitzung: abgelehnt. Timer-Stopp (abgerechneteVerwerfen):
    // die Wahl faellt weg, gebucht wird nach der Regel — der Timer haengt nicht fest.
    const daten = { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-777', start: '2026-08-18T10:15:00.000Z', ende: '2026-08-18T10:45:00.000Z', taetigkeit: 'Entwicklung', abrechenbar: true };
    assert.throws(() => zeit.speichere(db, daten, null, { wahlen: { 's-r': 'keins' } }), /abgerechnet/, 'Nachtrag mit Keins angenommen');
    const t = zeit.speichere(db, daten, null, { wahlen: { 's-r': 'keins' }, abgerechneteVerwerfen: true });
    assert.ok(!t.kulanz_min && !zeit.ueberlappungVon(db, t.id).sitzungen.some((s) => s.wahl === 'keins'), 'Timer-Stopp uebernimmt die kuerzende Wahl');
  });
}

// --- Zeiterfassung (Block Z4): Wahl am laufenden Timer, Rueckgaengig, Liste ---
// Gegenprobe: timerStop ohne die Timer-Wahlen bucht 60 statt 30 Minuten.
function testTimerWahl() {
  const zeit = require('../zeit');
  mitRundung(5, () => mitZeitmodell(5, 'aktivitaet', () => {
    const { db, zeile } = zeitDb();
    aktivSitzung(zeile, 'sA', VIERZEHN + 30, VIERZEHN + 90, 'Projekt A', 'PROJ-1');
    const t0 = Date.parse('2026-08-18T14:00:00.000Z');
    const start = { ziel_art: 'vorgang', ziel_schluessel: 'PROJ-2', taetigkeit: 'Entwicklung' };
    assert.throws(() => zeit.timerWahl(db, 'sA', 'claude', t0), /Kein Timer/);
    zeit.timerStart(db, start, t0);
    assert.strictEqual(zeit.timerVorschau(db, t0 + 30e3), null, 'Vorschau unter einer Minute');
    const v = zeit.timerVorschau(db, t0 + 60 * 60e3);
    assert.deepStrictEqual(v.sitzungen.map((s) => [s.session_id, s.regel, s.min]), [['sA', 'anderes_ziel', 30]]);
    assert.strictEqual(v.gezaehlt_min, 60);
    assert.throws(() => zeit.timerWahl(db, 'sA', 'halb', t0 + 60 * 60e3), /Wahl: beides, claude, meine oder keins/);
    assert.throws(() => zeit.timerWahl(db, 'gibts-nicht', 'claude', t0 + 60 * 60e3), /Überschneidung/);
    // Liste: alle oder keine — eine fremde Sitzung verhindert auch die gueltige.
    assert.throws(() => zeit.timerWahl(db, ['sA', 'gibts-nicht'], 'keins', t0 + 60 * 60e3), /Überschneidung/);
    assert.strictEqual(zeit.timerAktuell(db, t0).wahlen, undefined, 'halbe Wahl gespeichert');
    const w = zeit.timerWahl(db, ['sA'], 'claude', t0 + 60 * 60e3);
    assert.deepStrictEqual([w.vorschau.abzug_min, w.vorschau.gezaehlt_min, w.vorschau.sitzungen[0].wahl], [30, 30, 'claude']);
    assert.deepStrictEqual(zeit.timerAktuell(db, t0).wahlen, { sA: 'claude' });
    const e = zeit.timerStop(db, t0 + 60 * 60e3).eintrag;
    assert.deepStrictEqual([e.gezaehlt_min, e.abzug_min], [30, 30], 'Wahl am Timer gilt beim Buchen nicht');
    assert.deepStrictEqual(db.prepare('SELECT session_id, wahl FROM ueberlappung_wahl WHERE eintrag_id = ?').all(e.id)
      .map((r) => [r.session_id, r.wahl]), [['sA', 'claude']], 'Wahl nicht beim Eintrag gespeichert');
    // Rueckgaengig: nicht, solange ein anderer Timer laeuft — die Buchung bleibt.
    zeit.timerStart(db, start, t0 + 61 * 60e3);
    assert.throws(() => zeit.timerZurueck(db, e.id, t0 + 61 * 60e3), /läuft schon ein Timer/);
    assert.ok(zeit.lade(db, e.id), 'Buchung trotz Ablehnung geloescht');
    zeit.timerVerwerfen(db);
    // Sonst in einem Schritt: Eintrag weg, Timer laeuft mit altem Beginn und alter Wahl weiter.
    zeit.timerZurueck(db, e.id, t0 + 61 * 60e3);
    const t = zeit.timerAktuell(db, t0 + 61 * 60e3);
    assert.deepStrictEqual([t.start, t.laeuft_min, t.wahlen.sA, t.ziel_schluessel], [e.start, 61, 'claude', 'PROJ-2'], 'Timer nicht wiederhergestellt');
    assert.strictEqual(zeit.lade(db, e.id), null, 'Buchung nach Rueckgaengig noch da');
    assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM ueberlappung_wahl WHERE eintrag_id = ?').get(e.id).n, 0);
    assert.strictEqual(zeit.timerVorschau(db, t0 + 60 * 60e3).abzug_min, 30);
    zeit.timerVerwerfen(db);
    // Nur direkt nach dem Stopp: kein beliebiger alter oder nachgetragener Eintrag.
    const e2 = zeit.timerStop(db, (zeit.timerStart(db, start, t0 + 120 * 60e3), t0 + 150 * 60e3)).eintrag;
    assert.throws(() => zeit.timerZurueck(db, e2.id, t0 + 161 * 60e3), /direkt nach dem Stoppen/, 'Rueckgaengig nach 11 Min angenommen');
    const mitPause = zeit.speichere(db, { ...start, start: '2026-08-18T06:00:00.000Z', ende: '2026-08-18T07:00:00.000Z', pause_min: 10 }, null, { jetzt: t0 });
    assert.throws(() => zeit.timerZurueck(db, mitPause.id, t0), /direkt nach dem Stoppen/, 'Eintrag mit Pause zum Timer gemacht');
    assert.ok(zeit.lade(db, e2.id) && zeit.lade(db, mitPause.id), 'abgelehntes Rueckgaengig hat geloescht');
    zeit.loesche(db, e2.id);
    zeit.loesche(db, mitPause.id);
    // Abgerechnet: kein Rueckgaengig.
    const g = eintrag(db, { ziel_schluessel: 'PROJ-2', start: '2026-08-18T08:00:00.000Z', ende: '2026-08-18T09:00:00.000Z' });
    db.prepare("UPDATE zeit_eintrag SET status = 'abgerechnet', rechnung_nr = 'R-1' WHERE id = ?").run(g.id);
    assert.throws(() => zeit.timerZurueck(db, g.id, t0), /gesperrt/);
    assert.strictEqual(zeit.timerAktuell(db, t0), null, 'abgelehntes Rueckgaengig hat einen Timer gesetzt');
    db.prepare('DELETE FROM zeit_eintrag WHERE id = ?').run(g.id);
    // Laufender Timer zaehlt in die Arbeitszeit des Tages (Vereinigung mit Claude).
    const montag = '2026-08-17';
    const ohne = zeit.woche(db, montag, t0).tage.find((x) => x.tag === '2026-08-18').arbeitszeit_min;
    zeit.timerStart(db, start, t0 - 60 * 60e3);
    const mit = zeit.woche(db, montag, t0).tage.find((x) => x.tag === '2026-08-18');
    assert.strictEqual(mit.arbeitszeit_min - ohne, 60, 'laufender Timer fehlt in der Arbeitszeit (13–14 Uhr frei)');
    assert.strictEqual(mit.claude_fenster[0].modell, 'aktivitaet', 'Claude-Fenster ohne Zeitmodell');
    zeit.timerVerwerfen(db);
    // Nachtrag: Wahl in Vorschau und beim Speichern (neu und geaendert), Betrag in der Vorschau.
    const d = { ...start, start: '2026-08-18T14:00:00.000Z', ende: '2026-08-18T15:00:00.000Z' };
    const vk = zeit.vorschau(db, { ...d, wahlen: { sA: 'keins' } });
    assert.deepStrictEqual([vk.kulanz_min, vk.gezaehlt_min], [30, 30], 'Vorschau ohne Wahl');
    assert.strictEqual(vk.eur, 0.5 * vk.satz, 'Vorschau ohne Betrag');
    const n1 = zeit.speichere(db, d, null, { wahlen: { sA: 'keins' } });
    assert.strictEqual(n1.kulanz_min, 30, 'Wahl beim Speichern verloren');
    const n2 = zeit.speichere(db, d, n1.id, { wahlen: { sA: 'beides' } });
    assert.deepStrictEqual([n2.kulanz_min, n2.parallel_min, n2.gezaehlt_min], [0, 30, 60], 'Wahl beim Aendern nicht uebernommen');
    // Gespeichert, nicht nur gerechnet: das Nachrechnen sieht dieselbe Wahl.
    assert.strictEqual(zeit.ueberlappungVon(db, n1.id).parallel_min, 30, 'Wahl beim Aendern nicht gespeichert');
    assert.throws(() => zeit.speichere(db, d, null, { wahlen: { sA: 'halb' } }), /Wahl/);
  }));
}

// Gegenprobe: liste ohne Anreicherung hat kein eur/name.
function testZeitListeWert() {
  const zeit = require('../zeit');
  mitRundung(5, () => {
    const { db } = zeitDb();
    eintrag(db, { ziel_art: 'projekt', ziel_schluessel: 'Projekt A' });
    eintrag(db, { ziel_art: 'intern', ziel_schluessel: 'Planung', start: '2026-08-18T16:00:00.000Z', ende: '2026-08-18T16:30:00.000Z' });
    const l = zeit.liste(db, {});
    const p = l.find((e) => e.ziel_art === 'projekt');
    const i = l.find((e) => e.ziel_art === 'intern');
    const satz = metrics.satzFuerProjekt('Projekt A').satz;
    assert.ok(satz > 0, 'Testsatz fehlt');
    assert.deepStrictEqual([p.name, p.satz, p.eur], ['Projekt A', satz, 1.5 * satz], 'Projekt-Eintrag ohne Wert');
    assert.deepStrictEqual([i.name, i.satz, i.eur], ['Planung', null, 0], 'Intern mit Wert');
    // Eine Formel: dieselben Werte wie in der Auswertung.
    assert.deepStrictEqual(l.map((e) => e.eur).sort(), zeit.imRahmen(db, {}).map((e) => e.eur).sort());
  });
}

async function main() {
  console.log('c2invoice Selbstpruefung\n');
  test('Zeiterfassung: Rechnung mit Zeitpositionen und Kulanz, keine Doppelabrechnung', testRechnungZeitpositionen);
  test('Zeiterfassung: Rechnung prueft Eintraege und rechnet sie frisch', testRechnungZeitPruefungen);
  test('Zeiterfassung: Sperre beim Stellen, Wettlauf, Storno gibt frei', testSperreUndStorno);
  test('Zeiterfassung: Abrechnung und Kennzahlen kennen die manuelle Zeit', testAbrechnungZeitpositionen);
  test('Zeiterfassung: Druck und E-Rechnung fuer Zeit und Kulanz', testDruckUndErechnungZeit);
  test('Zeiterfassung: Woche, Monat, Ziele, Analyse', testZeitAnsichten);
  test('Analyse: Wochen mit Claude und manueller Zeit, Taetigkeiten mit Betrag', testAnalyseWochenTaetigkeiten);
  test('Wahl: abgerechnete Vorgangszeit laesst sich nicht kuerzen', testWahlAbgerechneterVorgang);
  test('Zeiterfassung: Wahl am laufenden Timer gilt beim Buchen', testTimerWahl);
  test('Zeiterfassung: Liste traegt Betrag und Zielnamen', testZeitListeWert);
  test('Zeiterfassung: Ueberlappung nach Regel eigene, gleiches Ziel, Meeting, Werkzeug', testUeberlappungRegeln);
  test('Zeiterfassung: Abzug als Vereinigung, Rundung nach dem Abzug', testUeberlappungVereinigung);
  test('Zeiterfassung: schneide nimmt genau die gewaehlten Minuten', testSchneide);
  test('Zeiterfassung: Vierer-Wahl aendert Eintrag und Sitzung', testWahl);
  test('Zeiterfassung: Vorschau rechnet wie Speichern, ohne zu schreiben', testZeitVorschau);
  test('Zeiterfassung: Nachrechnen nur offene Eintraege der letzten 48 h', testNachrechnen);
  test('Zeiterfassung: Live-Sitzungen zeigen Ueberlappung und Wahl', testLiveWahl);
  test('Live: Ueberlappung je Sitzung traegt die Zeitspanne des Eintrags', testLiveWahlZeitspanne);
  test('Vorgang: Sitzungen tragen ihre Wahl bei Ueberlappung', testVorgangSitzungWahl);
  test('Kennzahlen: offene Stunden aus Claude und manueller Zeit', testKennzahlenOffeneStunden);
  test('Zeiterfassung: Rohzeit, Pause, feste Dauer, Rundung je Projekt', testZeitRundung);
  test('Zeiterfassung: Eingaben werden geprueft, intern nie abrechenbar', testZeitGrenzen);
  test('Zeiterfassung: manuelle Zeit im Arbeitswert, nicht in den Claude-Stunden', testManuellImArbeitswert);
  test('CSV-Export: manuelle Stunden und ihr Arbeitswert als eigene Spalten', testCsvManuelleZeit);
  test('Zeiterfassung: Ziele ohne Claude erscheinen, interne Zeit nur als Kosten', testManuellOhneEvents);
  test('Zeiterfassung: ohne Eintraege bleiben alle Zahlen gleich', testOhneEintraegeUnveraendert);
  test('Zeiterfassung: Timer startet, bucht beim Wechsel, verwirft unter 1 Min', testZeitTimer);
  test('Zeiterfassung: Tätigkeitsarten mit Saat, eigenem Satz und Grenzen', testTaetigkeitsarten);
  test('Zeiterfassung: Rundung und Tagessoll mit Grenzen, Rundung je Projekt bleibt', testZeitEinstellungen);
  test('Zeiterfassung: Vorgangsposition bleibt Claude-Zeit x Satz', testBelegOhneManuelleZeit);
  test('Analyse: Perioden mit Zeit ohne Request, Kosten je aktive Stunde', testByPeriodNurZeit);
  test('Analyse: Verlauf je Modell summiert auf den Zeitraum', testVerlaufJeModell);
  test('Analyse: Fluss Modell → Projekt → Vorgang ohne Werkzeugbetrieb', testFluss);
  test('Analyse: Marge je Woche rechnet wie kennzahlen()', testMargeJeWoche);
  test('Detail: Cache-Schreiben bleibt nach 5m/1h getrennt', testCacheGetrenntJeModell);
  test('Detail: USD je Tokenart, Abweichung zur erfassten Summe offen', testTokenArten);
  test('Detail: Sitzungen eines Vorgangs ergeben Zeit und Dollar des Vorgangs', testSitzungenJeVorgang);
  test('Tabelle: Dollar je Tag und Vorgang, Summe = Vorgang', testVerlaufJeVorgang);
  test('Live: Tokens je Minute der letzten Stunde', testLiveMinuten);
  test('Live: Spuren je Sitzung — abrechenbare Fenster und Agentenzeit', testLiveSpuren);
  test('Hub: Cache-Ersparnis je Modell mit dessen Preis', testCacheErsparnis);
  test('Hub: Kennzahlen des Zeitraums rechnen wie mehrwert(), abgerechnet + offen = Arbeitswert', testKennzahlenZeitraum);
  test('Oberfläche: Diagramm-Bausteine liefern gültige Pfade ohne NaN', testChartBausteine);
  test('Oberfläche: Zeitraum und gleich lange Vorperiode', testZeitraum);
  test('Raster: Kachelgröße aus dem Speicher nur in Grenzen', testKachelGroesse);
  test('Raster: Verschieben nach links und nach rechts', testVerschiebe);
  test('Eingabe: Betrag deutsch und englisch, sonst keine Zahl', testBetragAus);
  test('Analyse: Verlauf je Projekt summiert auf den Zeitraum', testVerlaufJeProjekt);
  test('Analyse: Kosten je Stunde im Schnitt = Summe USD / Summe Stunden', testUsdJeStunde);
  test('Diagramme: Marge je Woche gegen das Ziel', testMargeWochenZeichnung);
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
  test('Live: Sitzung zeigt abgerechnete Zeit und Agentenzeit ueber ihre ganze Dauer', testLiveSitzungszeit);
  test('Rechnung: Position nennt das Zeitmodell ihrer Stunden', testRechnungZeitmodell);
  test('Preise: synthetisch = 0, Haiku < Opus, unbekannte Variante > 0', testPricing);
  test('Mehrwert rechnet Dollar in Euro um, bevor addiert wird', testMehrwert);
  test('Marge zieht die eigene Arbeitszeit ab, Zielmarge nur als Vergleich', testMargeZiehtEigeneZeitAb);
  test('Abo in Euro wird nicht durch den Dollarkurs gedreht', testAboWaehrung);
  test('Abokosten im Zeitraum: volle Monate voll, angeschnittene anteilig', testAboKostenZeitraum);
  test('Werkzeug-Overhead wird von Kundenprojekten getrennt', testOverhead);
  test('Werkzeuge werden dem parallel bearbeiteten Projekt zugeordnet', testWerkzeugZuordnung);
  test('Kalender: ICS-Parser mit Faltung, ganztaegig, Serien und Ausnahmen', testIcsParser);
  test('Kalender: rateZiel erkennt Vorgang, Projekt und Kunde', testRateZiel);
  test('Kalender: Feeds koennen den Server nicht lahmlegen oder Termine loeschen', testIcsHaertung);
  test('Kalender: Konten aus der Konfiguration werden geprueft', testKalenderKonten);
  test('Kalender: Termine erscheinen in der Woche', testWocheTermine);
  test('Kalender: Erinnerung unterscheidet claude, begleiten und manuell', testErinnerungFall);
  test('Zeit: Workload 7 Tage aus Meetings und Blockern', testWorkload);
  test('Kalender: Blocker ohne Erinnern bleibt still', testErinnernSchalter);
  test('Zeit: Termin buchen verknuepft Eintrag und Termin', testTerminBuchen);
  test('Kern: Google-Vorlage-URL', testGoogleVorlageUrl);
  test('Kalender: Abgleich behaelt gebuchte Termine', testAbgleichBehaeltGebuchte);
  test('Zeit: Restkapazitaet heute aus Soll, Arbeitszeit und anstehenden Terminen', testRestkapazitaet);
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
  test('Kundennummer: automatisch, eindeutig, fuellt Kaeuferreferenz und Kaeuferkennung', testKundennummer);
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
  test('Zahlungen: buchen, Rest und Grenzen', testZahlungen);
  test('Rechnungen: Status aus Zahlungen abgeleitet', testStatusAusZahlungen);
  test('Rechnungen: Liste mit Fälligkeit, Gezahlt und Rest', testRechnungsListe);
  test('Rechnungen: Kennzahlen offen, bezahlt, Zahlungsdauer', testBelegKennzahlen);
  test('Überfällig: Kennzahlen und Liste vom Server', testUeberfaellig);
  test('Einstellungen: nur echte Zahlen', testEchteZahlen);
  test('Stammdaten: Steuerzeichen abgelehnt', testStammdatenSteuerzeichen);
  test('Storno: Zahlungen fallen aus bezahlt, Toleranz-Cent, alles oder nichts', testStornoUndZahlungen);
  test('Fälligkeit: Altrechnungen festgeschrieben, Ziel 0 bleibt 0', testFaelligAltrechnung);
  test('Texte: Steuer- und Bidi-Zeichen abgelehnt, Kontakt-Id streng', testTextZeichen);
  test('Angebote: Status abgelaufen und abgerechnet abgeleitet', testAngebotStatusAbgeleitet);
  test('Rechnungen: baue() liefert die Positionen, die erstelle() schreibt', testBaue);
  test('Rechnungen: freie Posten, Pauschale, Rabatt und Zahlungsziel', testRechnungFreiePosten);
  test('Belege: Vorschau schreibt nichts und gleicht dem gestellten Dokument', testBelegVorschau);
  test('Editor: Entwürfe aus dem Speicher nur in fester Form', testEntwuerfeAus);
  test('Ansprechpartner: einmalige Übernahme, Grenzen, Kontakt muss existieren', testAnsprechpartner);
  test('Kontakte: Kennzahlen je Kontakt zählen nur gestellte Rechnungen', testKennzahlenJeKontakt);
  test('Darstellung: Bewegung reduzieren nur an oder aus', testBewegung);
  test('Navigation: geplante Bereiche nur mit Schalter, Vorlage blendet aus', testNavGeplant);
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
    await testIngestOhneOffeneTransaktion();
    console.log('  ok   Ingest: keine Transaktion ueber await, Anfragen koennen waehrenddessen schreiben');
  } catch (err) {
    failed++;
    console.log('  FAIL Ingest: keine Transaktion ueber await, Anfragen koennen waehrenddessen schreiben\n       ' + err.message);
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
    await testSicherheitsHeader();
    console.log('  ok   Server: Sicherheits-Header');
  } catch (err) {
    failed++;
    console.log('  FAIL Server: Sicherheits-Header\n       ' + err.message);
  }

  try {
    await testAnsprechpartnerRoute();
    console.log('  ok   Ansprechpartner: Routen prüfen und lehnen ab');
  } catch (err) {
    failed++;
    console.log('  FAIL Ansprechpartner: Routen prüfen und lehnen ab\n       ' + err.message);
  }

  try {
    await testVorschauRoute();
    console.log('  ok   Belege: Vorschau-Route lehnt ab, ohne zu schreiben');
  } catch (err) {
    failed++;
    console.log('  FAIL Belege: Vorschau-Route lehnt ab, ohne zu schreiben\n       ' + err.message);
  }

  try {
    await testRechnungEinzelabruf();
    console.log('  ok   Rechnungen: Einzelabruf als JSON nur mit gültiger Nummer');
  } catch (err) {
    failed++;
    console.log('  FAIL Rechnungen: Einzelabruf als JSON nur mit gültiger Nummer\n       ' + err.message);
  }

  try {
    await testHostHeader();
    console.log('  ok   Server: fremder Host-Header wird abgewiesen (DNS-Rebinding)');
  } catch (err) {
    failed++;
    console.log('  FAIL Server: fremder Host-Header wird abgewiesen (DNS-Rebinding)\n       ' + err.message);
  }

  for (const [name, fn] of [
    ['Kalender: Sync legt an, gleicht ab und behaelt die Zuordnung', testKalenderSync],
    ['Kalender: Routen fuer Termine und Kalender', testKalenderRouten],
    ['Kalender: Routen fuer Hinweise und Workload', testHinweisRouten],
    ['Kalender: verschobener Blocker wird neu erinnert', testErinnerungVerschoben],
    ['Kalender: verbinden und trennen aus der Oberflaeche', testKalenderVerbinden],
    ['Kalender: Google-Termin wird beim Abgleich zusammengefuehrt', testGoogleZusammenfuehren],
  ]) {
    try {
      await fn();
      console.log('  ok   ' + name);
    } catch (err) {
      failed++;
      console.log('  FAIL ' + name + '\n       ' + err.message);
    }
  }

  try {
    await testZeitRouten();
    console.log('  ok   Zeiterfassung: Routen pruefen und lehnen ab');
  } catch (err) {
    failed++;
    console.log('  FAIL Zeiterfassung: Routen pruefen und lehnen ab\n       ' + err.message);
  }

  // Masterplan 3.0 (Cira): je Block eine Datei unter test/cira/, damit diese
  // Datei nicht weiter waechst. Jede liefert [Name, Funktion]-Paare.
  for (const [name, fn] of [
    ...require('./cira/c0')({ configGeschuetzt }),
    ...require('./cira/c1')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/c2')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/c3')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/modelle')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/m2')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/c4')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/c5')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/s1')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/c6')({ configGeschuetzt, dbmod, openDbs }),
    ...require('./cira/c6b')({ dbmod, openDbs }),
    ...require('./cira/c7')({ dbmod, openDbs }),
    ...require('./cira/l')({ dbmod, openDbs }),
    ...require('./cira/budget')({ dbmod, openDbs }),
    ...require('./cira/c8')({ dbmod, openDbs }),
  ]) {
    try {
      await fn();
      console.log('  ok   ' + name);
    } catch (err) {
      failed++;
      console.log('  FAIL ' + name + '\n       ' + err.message);
    }
  }

  try {
    await testCodeStandKennung();
    console.log('  ok   Programmstand: Kennung erlaubt das Erkennen eines Neustarts');
  } catch (err) {
    failed++;
    console.log('  FAIL Programmstand: Kennung erlaubt das Erkennen eines Neustarts\n       ' + err.message);
  }

  // Hotfix 2.0.2 (Toolcheck 15.10.2026), eigene Datei wie test/cira/ auf dem Branch cira.
  for (const [name, fn] of require('./hotfix')({ dbmod, openDbs, rechnungsUmgebung, rechnungsDb, configGeschuetzt })) {
    try {
      await fn();
      console.log('  ok   ' + name);
    } catch (err) {
      failed++;
      console.log('  FAIL ' + name + '\n       ' + err.message);
    }
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
