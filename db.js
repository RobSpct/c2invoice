'use strict';
// Persistente Ablage. Wichtig: die Claude-Code-Logs werden nach ~30 Tagen
// aufgeraeumt, diese DB ist danach die einzige Quelle fuer alte Abrechnungen.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'ledger.db');

function open(dbPath = DB_PATH) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    -- Ein Eintrag pro API-Request (nach Dedup), nicht pro JSONL-Zeile.
    CREATE TABLE IF NOT EXISTS events (
      request_id   TEXT PRIMARY KEY,
      ts           TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      project      TEXT NOT NULL,
      cwd          TEXT,
      branch       TEXT,
      ticket       TEXT,
      model        TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_w_5m   INTEGER NOT NULL DEFAULT 0,
      cache_w_1h   INTEGER NOT NULL DEFAULT 0,
      cache_read   INTEGER NOT NULL DEFAULT 0,
      web_search   INTEGER NOT NULL DEFAULT 0,
      cost_usd     REAL NOT NULL DEFAULT 0,
      is_sidechain INTEGER NOT NULL DEFAULT 0,
      day          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
    CREATE INDEX IF NOT EXISTS idx_events_ticket ON events(ticket);
    CREATE INDEX IF NOT EXISTS idx_events_project ON events(project);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);

    -- Jeder Zeitstempel jeder Zeile: Grundlage der Aktivzeit-Berechnung.
    CREATE TABLE IF NOT EXISTS activity (
      session_id TEXT NOT NULL,
      ts         TEXT NOT NULL,
      project    TEXT NOT NULL,
      branch     TEXT,
      ticket     TEXT,
      day        TEXT NOT NULL,
      PRIMARY KEY (session_id, ts)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_day ON activity(day);
    CREATE INDEX IF NOT EXISTS idx_activity_ticket ON activity(ticket);

    -- Inkrementelles Lesen: pro Datei die zuletzt verarbeitete Byte-Position.
    CREATE TABLE IF NOT EXISTS files (
      path     TEXT PRIMARY KEY,
      offset   INTEGER NOT NULL DEFAULT 0,
      size     INTEGER NOT NULL DEFAULT 0,
      mtime_ms INTEGER NOT NULL DEFAULT 0,
      seen_at  TEXT
    );

    -- Manuelle Nachtraege (Session -> Ticket), schlagen die Branch-Erkennung.
    CREATE TABLE IF NOT EXISTS overrides (
      session_id TEXT PRIMARY KEY,
      ticket     TEXT,
      note       TEXT,
      created_at TEXT
    );

    -- Zustand des Jira-Syncs: genau ein Ledger-Kommentar pro Ticket.
    CREATE TABLE IF NOT EXISTS jira_sync (
      ticket      TEXT PRIMARY KEY,
      comment_id  TEXT,
      fingerprint TEXT,
      synced_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- Gestellte Rechnungen. Entscheidend: Positionen, Aussteller und Betraege
    -- sind eingefrorene Abschriften, keine Verweise auf die Auswertung. Wuerde
    -- die Rechnung live gerechnet, aenderte ein spaeter korrigierter
    -- Stundensatz rueckwirkend ein bereits gestelltes Dokument — nach
    -- Par. 14 UStG unzulaessig. Geloescht wird nie, storniert schon.
    CREATE TABLE IF NOT EXISTS invoices (
      nr               TEXT PRIMARY KEY,
      jahr             INTEGER NOT NULL,
      laufnr           INTEGER NOT NULL,
      erstellt_am      TEXT NOT NULL,
      leistung_von     TEXT NOT NULL,
      leistung_bis     TEXT NOT NULL,
      empfaenger       TEXT NOT NULL,
      aussteller       TEXT NOT NULL,
      positionen       TEXT NOT NULL,
      netto_eur        REAL NOT NULL,
      ust_prozent      REAL NOT NULL,
      ust_eur          REAL NOT NULL,
      brutto_eur       REAL NOT NULL,
      kleinunternehmer INTEGER NOT NULL,
      status           TEXT NOT NULL DEFAULT 'erstellt',
      storno_von       TEXT,
      pdf_pfad         TEXT,
      UNIQUE (jahr, laufnr)
    );

    -- Angebote. Bewusst eine eigene Tabelle statt eines Status in invoices:
    -- der Rechnungs-Nummernkreis muss lueckenlos fortlaufen, ein nie
    -- angenommenes Angebot wuerde sonst eine Luecke hinterlassen. Ausserdem
    -- zaehlt der Abrechnungsstand alles in invoices als gestellt.
    -- Angebote sind kein Par.-14-Dokument: sie duerfen geloescht werden, es
    -- gibt keinen Storno, und Nummernluecken sind unkritisch. Die Abschrift
    -- gibt es trotzdem — ein zugesagter Preis darf sich nicht nachtraeglich
    -- aendern, nur weil ein Stundensatz korrigiert wurde.
    CREATE TABLE IF NOT EXISTS angebote (
      nr               TEXT PRIMARY KEY,
      jahr             INTEGER NOT NULL,
      laufnr           INTEGER NOT NULL,
      erstellt_am      TEXT NOT NULL,
      gueltig_bis      TEXT NOT NULL,
      empfaenger       TEXT NOT NULL,
      aussteller       TEXT NOT NULL,
      positionen       TEXT NOT NULL,
      netto_eur        REAL NOT NULL,
      ust_prozent      REAL NOT NULL,
      ust_eur          REAL NOT NULL,
      brutto_eur       REAL NOT NULL,
      kleinunternehmer INTEGER NOT NULL,
      status           TEXT NOT NULL DEFAULT 'offen',
      rechnung_nr      TEXT,
      UNIQUE (jahr, laufnr)
    );

    -- Leads und Kunden in einer Tabelle, unterschieden nur durch status.
    -- Getrennte Tabellen wuerden bei der Umwandlung einen Umzug erzwingen und
    -- jede Auswertung ueber beide Gruppen (Wieviele Leads werden Kunden?) auf
    -- zwei Abfragen verteilen.
    -- AUTOINCREMENT, damit eine geloeschte id nie neu vergeben wird: ein altes
    -- Angebot verweist sonst ploetzlich auf einen fremden Kontakt.
    CREATE TABLE IF NOT EXISTS kontakte (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      status       TEXT NOT NULL DEFAULT 'lead',
      firma        TEXT NOT NULL,
      vorname      TEXT NOT NULL DEFAULT '',
      nachname     TEXT NOT NULL DEFAULT '',
      anschrift    TEXT NOT NULL DEFAULT '[]',
      steuernummer TEXT NOT NULL DEFAULT '',
      ust_id_nr    TEXT NOT NULL DEFAULT '',
      email        TEXT NOT NULL DEFAULT '',
      notiz        TEXT NOT NULL DEFAULT '',
      erstellt_am  TEXT NOT NULL,
      geaendert_am TEXT
    );

    -- Wiederkehrende Leistungen, damit dieselbe Position nicht bei jedem
    -- Angebot neu getippt wird. satz NULL bedeutet: Standardsatz greift.
    CREATE TABLE IF NOT EXISTS vorlagen (
      id          INTEGER PRIMARY KEY,
      bezeichnung TEXT NOT NULL,
      satz        REAL
    );

    -- Welcher Kunde hinter einem Projekt steht. Ueber diese eine Kante wird
    -- jede Sitzung abrechenbar: Vorgaenge haben keine eigene Tabelle, sie
    -- haengen am Projekt, und das Projekt haengt hier am Kontakt.
    --
    -- Bewusst hier und nicht in config.projektSaetze: dort steht der
    -- Preiskatalog, und setzeSatz() loescht den ganzen Projekteintrag, sobald
    -- weder Satz noch Rabatt gesetzt sind — ein Zuruecksetzen auf den
    -- Standardsatz naehme dem Projekt sonst stillschweigend seinen Kunden.
    -- Das Freitextfeld "kunde" dort bleibt daneben bestehen; es beschriftet
    -- CSV-Ausgabe und Jira-Kommentar und braucht keinen Kontaktstamm.
    --
    -- projekt als PRIMARY KEY: ein Projekt gehoert genau einem Kunden. Weist
    -- ein zweiter Kunde sich dasselbe Projekt zu, wandert es zu ihm.
    -- Kein FOREIGN KEY, wie bei angebote.kontakt_id: PRAGMA foreign_keys ist
    -- aus, und ein Einschalten wuerde rueckwirkend auch die eingefrorenen
    -- Dokumentverweise pruefen. Aufgeraeumt wird stattdessen ausdruecklich in
    -- kontakte.loesche() — anders als ein Dokument ist eine Zuordnung ohne
    -- Kontakt wertlos und boete im Rechnungen-Tab einen Kunden an, den es
    -- nicht mehr gibt.
    CREATE TABLE IF NOT EXISTS projekt_kontakt (
      projekt    TEXT PRIMARY KEY,
      kontakt_id INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projekt_kontakt_kontakt ON projekt_kontakt(kontakt_id);
  `);

  // Nachtraeglich zugeordnete Tickets sollen nachvollziehbar bleiben: woher
  // kam die Zuordnung? NULL = aus dem Branch-Namen (der Normalfall).
  // CREATE IF NOT EXISTS greift hier nicht, die Tabelle existiert ja bereits.
  addColumn(db, 'events', 'ticket_quelle', 'TEXT');
  addColumn(db, 'activity', 'ticket_quelle', 'TEXT');

  // Verweis auf den Kontakt, nur fuer Auswertung und die Umwandlung Lead ->
  // Kunde. Bewusst ohne FOREIGN KEY: das Dokument traegt seine eigene
  // Abschrift, ein geloeschter Kontakt darf es weder blockieren noch aendern.
  addColumn(db, 'angebote', 'kontakt_id', 'INTEGER');
  addColumn(db, 'invoices', 'kontakt_id', 'INTEGER');

  // Woher ein Ereignis stammt: 'claude' fuer Claude Code, 'lokal' fuer die
  // eigenen Modelle hinter dem Proxy. Bestehende Zeilen sind Claude-Code-
  // Zeilen, deshalb der Vorgabewert — kein Nachtrag noetig.
  addColumn(db, 'events', 'source', "TEXT NOT NULL DEFAULT 'claude'");
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_source ON events(source, day)');

  // Woher ein Request kam. Claude Code protokolliert das selbst; bisher wurde
  // es nur nicht eingelesen.
  //
  // Zwei verschiedene Dinge, deshalb getrennte Spalten:
  // - mcp_server/mcp_tool: der Aufruf IST der Ausloeser. Harte Kausalkette,
  //   anders als die zeitliche Zuordnung bei overheadProjekte.
  // - skill: der Skill hat den Request NICHT ausgeloest, er lief nur waehrend
  //   seiner Laufzeit. Ein Skill schiebt Text in einen bestehenden Request,
  //   statt einen eigenen zu starten. Die Spalte beantwortet "wie oft war
  //   dieser Skill im Spiel", nie "was hat dieser Skill gekostet".
  //
  // Altbestand bleibt leer: die Logdateien dazu sind nach rund 30 Tagen fort.
  // Die Aufschluesselung waechst deshalb ab dem naechsten Einlesen.
  addColumn(db, 'events', 'mcp_server', 'TEXT');
  addColumn(db, 'events', 'mcp_tool', 'TEXT');
  addColumn(db, 'events', 'skill', 'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_mcp ON events(mcp_server, day)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_events_skill ON events(skill, day)');
}

// ALTER TABLE ... ADD COLUMN wirft, wenn die Spalte schon da ist. Deshalb
// vorher nachsehen statt den Fehler zu schlucken.
function addColumn(db, tabelle, spalte, typ) {
  const vorhanden = db.prepare(`PRAGMA table_info(${tabelle})`).all()
    .some((s) => s.name === spalte);
  if (!vorhanden) db.exec(`ALTER TABLE ${tabelle} ADD COLUMN ${spalte} ${typ}`);
}

function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(db, key, value) {
  db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

module.exports = { open, migrate, getMeta, setMeta, DB_PATH };
