'use strict';
// Liest die Claude-Code-Logs und schreibt sie in die Ledger-Datenbank.
// Laeuft ausschliesslich als eigener Prozess auf fertig geschriebenen Dateien:
// keine Hooks, kein Eingriff in laufende Sessions, keine zusaetzlichen Tokens.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const pricing = require('./pricing');
const dbmod = require('./db');

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
    mcp_server, mcp_tool, skill, preis_art
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(request_id) DO UPDATE SET
    preis_art = excluded.preis_art,
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

// Bei einer schon vorhandenen Zeile wird nur die Eingabe-Kennung nachgezogen:
// die Zuordnung zum Vorgang kann inzwischen von Hand gebucht sein und darf
// beim erneuten Einlesen nicht zurueckfallen. MAX, weil zwei Logzeilen
// denselben Zeitstempel tragen koennen — ist eine davon eine Eingabe, zaehlt sie.
const UPSERT_ACTIVITY = `
  INSERT INTO activity (session_id, ts, project, branch, ticket, day, ticket_quelle, eingabe)
  VALUES (?,?,?,?,?,?,?,?)
  ON CONFLICT(session_id, ts) DO UPDATE SET
    eingabe = MAX(COALESCE(activity.eingabe, 0), excluded.eingabe)
`;

// Was Claude Code selbst als Nutzerzeile schreibt, ohne dass jemand tippt.
const KEINE_EINGABE_RE = /^\s*<(local-command-stdout|task-notification|bash-stdout|bash-stderr)\b/;

// Stammt die Logzeile von einer eigenen Eingabe des Nutzers? Davon haengt die
// abgerechnete Zeit ab. Im Log steht fast alles als "user": Werkzeugergebnisse,
// Unteragenten, Systemhinweise, Befehlsausgaben. Eigene Eingaben sind nur der
// getippte Prompt, der Slash- oder Shell-Befehl, der Abbruch und die Antwort
// auf eine Rueckfrage (Auswahl, Plan-Freigabe, abgelehnter Werkzeugaufruf).
//
// Programmatische Aufrufe (claude -p, Beobachter-Sitzungen) schreiben ihren
// Prompt ebenfalls als "user". Dort sitzt niemand — deshalb der Blick auf den
// Einstiegspunkt.
function istEingabe(o) {
  if (!o || o.type !== 'user' || o.isSidechain || o.isMeta || o.isCompactSummary) return false;
  if (typeof o.entrypoint === 'string' && o.entrypoint.startsWith('sdk')) return false;
  if (o.promptSource === 'system') return false;

  const inhalt = o.message && o.message.content;
  const teile = Array.isArray(inhalt) ? inhalt : [];
  if (teile.some((b) => b && b.type === 'tool_result')) {
    const r = o.toolUseResult;
    if (typeof r === 'string') return r.startsWith("Error: The user doesn't want to proceed");
    return Boolean(r && typeof r === 'object' && (r.answers || 'plan' in r));
  }
  const text = typeof inhalt === 'string'
    ? inhalt
    : (teile.find((b) => b && b.type === 'text') || {}).text || '';
  return !KEINE_EINGABE_RE.test(text);
}

// Liest eine Datei ab der gemerkten Byte-Position zeilenweise ein.
// Streaming, damit auch 200-MB-Dateien nicht in den Speicher geladen werden.
// nurAktivitaet: schreibt nur die Aktivitaetszeilen, keine Requests. Fuer den
// einmaligen Nachtrag der Eingabe-Kennung — der soll weder Kosten neu
// bepreisen noch eine gebuchte Zuordnung zuruecksetzen.
async function ingestFile(db, filePath, fromOffset, stmts, { nurAktivitaet = false } = {}) {
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

    // Jede Zeile ist ein Aktivitaetssignal, unabhaengig vom Typ. Ob sie eine
    // eigene Eingabe ist, entscheidet spaeter ueber die abgerechnete Zeit.
    stmts.activity.run(sessionId, ts, project, branch, ticket, day, ticketQuelle,
      istEingabe(o) ? 1 : 0);

    if (nurAktivitaet) continue;
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
      mcpServer, mcpTool, skill, preisLuecke(model)
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

    // Jede Anfrage an ein lokales Modell gilt als eigene Eingabe: der Proxy
    // sieht nur, was jemand abgeschickt hat, keine selbstlaufenden Agenten.
    stmts.activity.run(sessionId, ts, LOKAL_PROJEKT, null, null, day, null, 1);

    stmts.event.run(
      requestId, ts, sessionId, LOKAL_PROJEKT, null, null, null,
      String(o.model || 'lokal/unbekannt'), ein, aus, 0, 0, 0, 0,
      0, 0, day, null, 'lokal',
      // Ein lokales Modell laeuft ausserhalb von Claude Code: es kennt weder
      // MCP-Server noch Skills. Und es hat keinen Preis, der fehlen koennte.
      null, null, null, null
    );
    events++;
  }

  return { lines, events, offset: lastComplete };
}

// Was in der Spalte preis_art steht: nur die beiden Faelle, die jemand sehen
// muss. Ein exakter Preis und ein kostenfreies Modell sind der Normalfall.
function preisLuecke(model) {
  const art = pricing.preisArt(model);
  return art === 'geschaetzt' || art === 'ohne' ? art : null;
}

// Gleicht die Preis-Kennzeichnung mit der aktuellen Preisliste ab.
// - Ein markierter Request, dessen Modell die Liste inzwischen besser kennt,
//   wird aus den gespeicherten Tokens neu bepreist. Sonst bliebe der
//   Schaetzwert oder die 0 fuer immer stehen.
// - Ein unmarkierter Request, dessen Modell die Liste nicht exakt kennt,
//   stammt aus der Zeit vor der Kennzeichnung. Er wird nur markiert; sein
//   Betrag bleibt, wie er eingelesen wurde.
// Ohne geladene Preisliste (kein Netz, kein Zwischenspeicher) wird nichts
// nachtraeglich markiert: die eingebaute Tabelle ist zu schmal, sie wuerde
// bekannte Modelle als Schaetzung ausweisen.
function gleichePreiseAb(db) {
  const listeGeladen = pricing.info().source !== 'fallback';
  const modelle = db.prepare(
    "SELECT model, preis_art FROM events WHERE source = 'claude' GROUP BY model, preis_art"
  ).all();
  const markiere = db.prepare('UPDATE events SET preis_art = ? WHERE model = ? AND preis_art IS NULL');
  const lese = db.prepare(`
    SELECT request_id, input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read
    FROM events WHERE model = ? AND preis_art = ?
  `);
  const schreibe = db.prepare('UPDATE events SET cost_usd = ?, preis_art = ? WHERE request_id = ?');

  let geaendert = 0;
  for (const { model, preis_art: alt } of modelle) {
    const jetzt = preisLuecke(model);
    if (jetzt === alt) continue;
    if (alt === null) {
      if (listeGeladen) geaendert += markiere.run(jetzt, model).changes;
      continue;
    }
    for (const r of lese.all(model, alt)) {
      schreibe.run(pricing.costOf(model, r), jetzt, r.request_id);
      geaendert++;
    }
  }
  return geaendert;
}

// Einmaliger Nachtrag: Zeilen aus der Zeit vor der Eingabe-Kennung tragen
// NULL. Solange ihre Logdatei noch liegt, laesst sich die Kennung nachholen —
// dafuer wird jede Datei einmal von vorn gelesen. Was danach noch NULL ist,
// stammt aus geloeschten Logs und bleibt beim alten Zeitmass (siehe metrics.js).
// Der Merker verhindert, dass dieser Rest jeden Lauf erneut alles liest.
const NACHTRAG_MERKER = 'eingabe_nachgetragen';

async function trageEingabenNach(db, files, stmts, verbose) {
  if (dbmod.getMeta(db, NACHTRAG_MERKER)) return;
  const offen = db.prepare('SELECT 1 FROM activity WHERE eingabe IS NULL LIMIT 1').get();
  if (offen) {
    db.exec('BEGIN');
    try {
      for (const { pfad, quelle } of files) {
        if (quelle !== 'claude') continue;
        try {
          await ingestFile(db, pfad, 0, stmts, { nurAktivitaet: true });
        } catch (err) {
          // Eine unlesbare Datei darf den Nachtrag der uebrigen nicht aufhalten.
          if (verbose) console.error('Nachtrag: Fehler bei', pfad, err.message);
        }
      }
      // Der Proxy der lokalen Modelle schreibt nur abgeschickte Anfragen.
      db.prepare("UPDATE activity SET eingabe = 1 WHERE eingabe IS NULL AND session_id LIKE 'lokal:%'").run();
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    if (verbose) console.log('Nachtrag: Eingabe-Kennung fuer vorhandene Logs ergaenzt');
  }
  dbmod.setMeta(db, NACHTRAG_MERKER, new Date().toISOString());
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

  await trageEingabenNach(db, files, stmts, verbose);

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

  // Nach dem Einlesen, damit auch die eben gelesenen Requests dabei sind.
  const nachbepreist = gleichePreiseAb(db);
  if (verbose && nachbepreist) console.log(`Preise: ${nachbepreist} Requests neu gekennzeichnet oder bepreist`);

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
  lokalDir, jsonlDir, LOKAL_PROJEKT, istEingabe,
};

if (require.main === module) {
  const db = dbmod.open();
  run({ db, verbose: true }).then(() => db.close());
}
