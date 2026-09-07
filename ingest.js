'use strict';
// Liest die Claude-Code-Logs und schreibt sie in die Ledger-Datenbank.
// Laeuft ausschliesslich als eigener Prozess auf fertig geschriebenen Dateien:
// keine Hooks, kein Eingriff in laufende Sessions, keine zusaetzlichen Tokens.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const pricing = require('./pricing');

const config = require('./config.json');
const TICKET_RE = new RegExp(config.ticketRegex);

// Wohin ollama-proxy.js seine Zeilen schreibt. Eigene Quelle neben den
// Claude-Code-Logs, gleicher Lesemechanismus (Byte-Position je Datei).
//
// Bewusst eine Funktion und keine Konstante: der Wert wird bei jedem Lauf neu
// aus der Konfiguration gelesen. Eine beim Laden des Moduls eingefrorene
// Konstante liesse sich weder in der Selbstpruefung umbiegen noch nachtraeglich
// verlegen — und ein fest verdrahteter Pfad gehoert ohnehin nicht hierher.
function lokalDir() {
  const eigen = (config.lokaleModelle || {}).protokollDir;
  return eigen ? loeseHeim(eigen) : path.join(__dirname, 'data', 'lokal');
}

// Wo die Claude-Code-Logs liegen. Aus denselben Gruenden eine Funktion wie
// lokalDir(). Zusaetzlich wird "~" aufgeloest, damit ein Eintrag wie
// "~/.claude/projects" auf jedem Rechner und jedem Betriebssystem passt.
// Ohne das muesste die Vorlage einen Pfad nennen, der nur auf einem System
// existiert — unter macOS/Linux liefe jede frische Installation ins Leere.
function jsonlDir() {
  return loeseHeim(config.jsonlDir);
}
// Lokale Anfragen tragen kein Projekt: sie kommen aus einem Browserfenster
// ohne Arbeitsverzeichnis. Der Name steht bewusst in Klammern, damit er sich
// nicht mit einem echten Projektnamen verwechseln laesst.
const LOKAL_PROJEKT = '(lokal)';

// Aus "C:\Users\Name\Dev\Beispiel - App\src\lib" wird "Beispiel - App".
// Ohne diesen Schritt zaehlt jeder Unterordner als eigenes Projekt.
// Wo die Projekte liegen, ist von Rechner zu Rechner verschieden — deshalb
// aus der Konfiguration, mit dem bisherigen Verhalten als Rueckfallebene.
// "~" steht fuer das Benutzerverzeichnis, damit der Eintrag ohne absoluten
// Pfad auskommt und auf jedem Rechner passt.
const HEIM = process.env.USERPROFILE || process.env.HOME || '';

function loeseHeim(p) {
  const s = String(p || '').trim();
  if (!s) return '';
  if (s === '~') return HEIM;
  if (s.startsWith('~/') || s.startsWith('~\\')) return path.join(HEIM, s.slice(2));
  return s;
}

const PROJECT_ROOTS = (Array.isArray(config.projectRoots) && config.projectRoots.length
  ? config.projectRoots
  : ['~/Dev', '~']
).map(loeseHeim).filter(Boolean);

function projectOf(cwd) {
  if (!cwd) return '(unbekannt)';
  const norm = cwd.replace(/\//g, '\\').replace(/\\+$/, '');
  for (const root of PROJECT_ROOTS) {
    if (!root) continue;
    const r = root.replace(/\//g, '\\').replace(/\\+$/, '');
    if (norm.toLowerCase().startsWith(r.toLowerCase() + '\\')) {
      const rest = norm.slice(r.length + 1);
      const first = rest.split('\\')[0];
      if (first) return first;
    }
  }
  const parts = norm.split('\\').filter(Boolean);
  return parts[parts.length - 1] || '(unbekannt)';
}

function ticketOf(branch) {
  if (!branch) return null;
  const m = branch.match(TICKET_RE);
  return m ? m[1] : null;
}

function dayOf(ts) {
  return typeof ts === 'string' && ts.length >= 10 ? ts.slice(0, 10) : '';
}

// Zieht die Zahlen aus message.usage. Der 1h- und der 5m-Cache haben
// unterschiedliche Preise, deshalb werden sie getrennt gefuehrt.
function extractUsage(u) {
  const cc = u.cache_creation || {};
  let w5 = cc.ephemeral_5m_input_tokens;
  let w1 = cc.ephemeral_1h_input_tokens;
  const totalWrite = u.cache_creation_input_tokens || 0;
  if (w5 == null && w1 == null) {
    // Aeltere Zeilen ohne Aufschluesselung: alles als 5m werten.
    w5 = totalWrite;
    w1 = 0;
  } else {
    w5 = w5 || 0;
    w1 = w1 || 0;
  }
  const st = u.server_tool_use || {};
  return {
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    cache_w_5m: w5,
    cache_w_1h: w1,
    cache_read: u.cache_read_input_tokens || 0,
    web_search: (st.web_search_requests || 0) + (st.web_fetch_requests || 0),
  };
}

function listJsonlFiles(root) {
  const out = [];
  let dirs;
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of dirs) {
    const p = path.join(root, d.name);
    if (d.isDirectory()) out.push(...listJsonlFiles(p));
    else if (d.isFile() && d.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

// Kern der Korrektheit: Claude Code schreibt denselben Request mehrfach ins Log
// (ein Eintrag je Content-Block). Alle Kopien tragen dieselben usage-Werte.
// Ein INSERT ... ON CONFLICT DO UPDATE setzt pro request_id den zuletzt
// gesehenen Stand, statt die Kopien zu addieren.
const UPSERT_EVENT = `
  INSERT INTO events (
    request_id, ts, session_id, project, cwd, branch, ticket, model,
    input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read,
    web_search, cost_usd, is_sidechain, day, ticket_quelle, source,
    mcp_server, mcp_tool, skill
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(request_id) DO UPDATE SET
    ts = excluded.ts, session_id = excluded.session_id, project = excluded.project,
    cwd = excluded.cwd, branch = excluded.branch, ticket = excluded.ticket,
    model = excluded.model, input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens, cache_w_5m = excluded.cache_w_5m,
    cache_w_1h = excluded.cache_w_1h, cache_read = excluded.cache_read,
    web_search = excluded.web_search, cost_usd = excluded.cost_usd,
    is_sidechain = excluded.is_sidechain, day = excluded.day,
    ticket_quelle = excluded.ticket_quelle, source = excluded.source,
    -- COALESCE statt Ueberschreiben: derselbe Request steht mehrfach im Log,
    -- ein Eintrag je Inhaltsblock, und nur einer davon traegt die Herkunft.
    -- Ein blindes excluded.* wuerde sie loeschen, sobald eine Kopie ohne die
    -- Felder nachkommt -- je nach Reihenfolge mal so, mal so.
    mcp_server = COALESCE(excluded.mcp_server, events.mcp_server),
    mcp_tool = COALESCE(excluded.mcp_tool, events.mcp_tool),
    skill = COALESCE(excluded.skill, events.skill)
`;

const UPSERT_ACTIVITY = `
  INSERT INTO activity (session_id, ts, project, branch, ticket, day, ticket_quelle)
  VALUES (?,?,?,?,?,?,?)
  ON CONFLICT(session_id, ts) DO NOTHING
`;

// Liest eine Datei ab der gemerkten Byte-Position zeilenweise ein.
// Streaming, damit auch 200-MB-Dateien nicht in den Speicher geladen werden.
async function ingestFile(db, filePath, fromOffset, stmts) {
  const stat = fs.statSync(filePath);
  if (stat.size <= fromOffset) return { lines: 0, events: 0, offset: stat.size };

  const stream = fs.createReadStream(filePath, {
    start: fromOffset,
    encoding: 'utf8',
    highWaterMark: 1 << 20,
  });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lines = 0;
  let events = 0;
  let consumed = fromOffset;
  let lastComplete = fromOffset;

  for await (const line of rl) {
    // +1 fuer das Newline. Eine noch unvollstaendig geschriebene letzte Zeile
    // wird nicht mitgezaehlt, damit sie beim naechsten Lauf komplett ankommt.
    consumed += Buffer.byteLength(line, 'utf8') + 1;
    if (!line.trim()) {
      lastComplete = consumed;
      continue;
    }
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      // Abgeschnittene Zeile: Position nicht vorruecken, naechster Lauf holt sie.
      continue;
    }
    lastComplete = consumed;
    lines++;

    const ts = o.timestamp;
    const sessionId = o.sessionId || o.session_id;
    if (!ts || !sessionId) continue;

    const project = projectOf(o.cwd);
    const branch = o.gitBranch || null;
    // Bei Worktrees steht der Ticket-Schluessel nicht im Branch (dort oft
    // detached HEAD), sondern im Pfad. Deshalb der Rueckgriff auf cwd.
    const ausBranch = ticketOf(branch);
    const ticket = ausBranch || ticketOf(o.cwd);
    const ticketQuelle = ausBranch ? null : (ticket ? 'cwd' : null);
    const day = dayOf(ts);

    // Jede Zeile ist ein Aktivitaetssignal, unabhaengig vom Typ.
    stmts.activity.run(sessionId, ts, project, branch, ticket, day, ticketQuelle);

    if (o.type !== 'assistant' || !o.message || !o.message.usage) continue;
    const requestId = o.requestId || o.message.id;
    if (!requestId) continue;

    const model = o.message.model;
    const u = extractUsage(o.message.usage);
    const cost = pricing.isSynthetic(model) ? 0 : pricing.costOf(model, u);

    // Herkunft, sofern Claude Code sie vermerkt hat. Ein MCP-Aufruf loest den
    // Request aus; ein Skill lief nur waehrend seiner Laufzeit mit. Beides wird
    // deshalb getrennt gehalten und in der Auswertung verschieden beschriftet.
    const mcpServer = typeof o.attributionMcpServer === 'string' ? o.attributionMcpServer : null;
    const mcpTool = typeof o.attributionMcpTool === 'string' ? o.attributionMcpTool : null;
    const skill = typeof o.attributionSkill === 'string' ? o.attributionSkill : null;

    stmts.event.run(
      requestId, ts, sessionId, project, o.cwd || null, branch, ticket,
      model || '<unknown>', u.input_tokens, u.output_tokens, u.cache_w_5m,
      u.cache_w_1h, u.cache_read, u.web_search, cost,
      o.isSidechain ? 1 : 0, day, ticketQuelle, 'claude',
      mcpServer, mcpTool, skill
    );
    events++;
  }

  return { lines, events, offset: lastComplete };
}

// Liest die Zeilen des Proxys. Aufbau je Zeile:
// { ts, request_id, model, prompt_tokens, completion_tokens, dauer_ms, client }
//
// Zwei Dinge unterscheiden diese Quelle von den Claude-Code-Logs:
// Erstens kostet sie nichts — die Modelle laufen auf eigener Hardware, es gibt
// keinen Rechnungsbetrag. Ein erfundener Dollarwert waere hier schlimmer als
// gar keiner. Zweitens gibt es weder Projekt noch Vorgang; beides ordnet
// metrics.js spaeter ueber die Zeit zu.
async function ingestLokalFile(db, filePath, fromOffset, stmts) {
  const stat = fs.statSync(filePath);
  if (stat.size <= fromOffset) return { lines: 0, events: 0, offset: stat.size };

  const stream = fs.createReadStream(filePath, {
    start: fromOffset,
    encoding: 'utf8',
    highWaterMark: 1 << 20,
  });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lines = 0;
  let events = 0;
  let consumed = fromOffset;
  let lastComplete = fromOffset;

  for await (const line of rl) {
    consumed += Buffer.byteLength(line, 'utf8') + 1;
    if (!line.trim()) { lastComplete = consumed; continue; }
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      // Halb geschriebene Zeile: Position nicht vorruecken.
      continue;
    }
    lastComplete = consumed;
    lines++;

    const ts = o.ts;
    const requestId = o.request_id;
    if (!ts || !requestId) continue;
    const day = dayOf(ts);
    if (!day) continue;

    // Eine Sitzungskennung je Tag. Der Modellserver kennt keine Sitzungen,
    // und tageweise laesst sich ein Nachtrag ueber die Tabelle "overrides"
    // von Hand zuordnen, wenn die zeitliche Zuordnung nichts findet.
    const sessionId = 'lokal:' + day;
    const ein = Number(o.prompt_tokens) || 0;
    const aus = Number(o.completion_tokens) || 0;

    stmts.activity.run(sessionId, ts, LOKAL_PROJEKT, null, null, day, null);

    stmts.event.run(
      requestId, ts, sessionId, LOKAL_PROJEKT, null, null, null,
      String(o.model || 'lokal/unbekannt'), ein, aus, 0, 0, 0, 0,
      0, 0, day, null, 'lokal',
      // Ein lokales Modell laeuft ausserhalb von Claude Code: es kennt weder
      // MCP-Server noch Skills.
      null, null, null
    );
    events++;
  }

  return { lines, events, offset: lastComplete };
}

async function run({ db, verbose = false } = {}) {
  const started = Date.now();
  await pricing.refresh();

  // Zwei Quellen, ein Lesemechanismus: Claude-Code-Logs und die Zeilen des
  // Proxys fuer die lokalen Modelle. Die Herkunft entscheidet, welcher
  // Zeilenleser greift — der Rest (Byte-Position, Wiederholungslauf,
  // Transaktion je Datei) ist fuer beide gleich.
  const files = [
    ...listJsonlFiles(jsonlDir()).map((f) => ({ pfad: f, quelle: 'claude' })),
    ...listJsonlFiles(lokalDir()).map((f) => ({ pfad: f, quelle: 'lokal' })),
  ];
  const getFile = db.prepare('SELECT offset, size, mtime_ms FROM files WHERE path = ?');
  const setFile = db.prepare(`
    INSERT INTO files (path, offset, size, mtime_ms, seen_at) VALUES (?,?,?,?,?)
    ON CONFLICT(path) DO UPDATE SET
      offset = excluded.offset, size = excluded.size,
      mtime_ms = excluded.mtime_ms, seen_at = excluded.seen_at
  `);
  const stmts = {
    event: db.prepare(UPSERT_EVENT),
    activity: db.prepare(UPSERT_ACTIVITY),
  };

  let totalLines = 0;
  let totalEvents = 0;
  let touched = 0;

  for (const { pfad: f, quelle } of files) {
    let stat;
    try {
      stat = fs.statSync(f);
    } catch {
      continue;
    }
    const prev = getFile.get(f);
    let start = prev ? prev.offset : 0;
    // Kleiner gewordene Datei heisst: sie wurde ersetzt, nicht angehaengt.
    if (prev && stat.size < prev.size) start = 0;
    if (prev && stat.size === prev.size && stat.mtimeMs === prev.mtime_ms) continue;

    db.exec('BEGIN');
    let res;
    try {
      res = quelle === 'lokal'
        ? await ingestLokalFile(db, f, start, stmts)
        : await ingestFile(db, f, start, stmts);
      setFile.run(f, res.offset, stat.size, Math.floor(stat.mtimeMs), new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      if (verbose) console.error('Fehler bei', f, err.message);
      continue;
    }
    totalLines += res.lines;
    totalEvents += res.events;
    touched++;
  }

  const ms = Date.now() - started;
  if (verbose) {
    console.log(
      `Ingest: ${touched}/${files.length} Dateien, ${totalLines} Zeilen, ` +
      `${totalEvents} Requests, ${ms} ms (Preise: ${pricing.info().source})`
    );
  }
  return { files: files.length, touched, lines: totalLines, events: totalEvents, ms };
}

module.exports = {
  run, projectOf, ticketOf, extractUsage, listJsonlFiles, PROJECT_ROOTS,
  lokalDir, jsonlDir, LOKAL_PROJEKT,
};

if (require.main === module) {
  const dbmod = require('./db');
  const db = dbmod.open();
  run({ db, verbose: true }).then(() => db.close());
}
