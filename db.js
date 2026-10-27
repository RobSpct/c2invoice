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
  // backfill.js oder ein zweiter Prozess neben dem Server: warten statt "database is locked" (H8).
  db.exec('PRAGMA busy_timeout = 5000');
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

    -- Zeitmodell je Vorgang oder Sitzung. Ueberschreibt das Modell des
    -- Projekts (config.projektSaetze) und den Standard (config.zeitmodell).
    -- Bewusst nicht in overrides: eine Buchung zurueckzunehmen loescht dort
    -- die Zeile, und die Wahl des Zeitmodells ginge mit verloren.
    CREATE TABLE IF NOT EXISTS zeitmodell_wahl (
      art        TEXT NOT NULL,   -- 'vorgang' | 'sitzung'
      schluessel TEXT NOT NULL,   -- Vorgangsschluessel bzw. session_id
      zeitmodell TEXT NOT NULL,   -- 'eingaben' | 'aktivitaet'
      PRIMARY KEY (art, schluessel)
    );

    -- Zahlungseingaenge je Rechnung. Bewusst neben invoices statt darin: eine
    -- Zahlung ist kein Teil des Dokuments (Par. 14 UStG), sie darf korrigiert
    -- und geloescht werden, die Abschrift nie. Der Status offen/teilbezahlt/
    -- bezahlt wird beim Lesen aus der Summe abgeleitet (rechnung.statusOf).
    CREATE TABLE IF NOT EXISTS zahlungen (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      rechnung_nr TEXT NOT NULL,
      datum       TEXT NOT NULL,     -- Tag des Eingangs, JJJJ-MM-TT
      betrag_eur  REAL NOT NULL,
      notiz       TEXT NOT NULL DEFAULT '',
      erstellt_am TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_zahlungen_rechnung ON zahlungen(rechnung_nr);
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
  // Wann zugesagt bzw. abgelehnt wurde (Kanban-Karte). Aeltere Angebote bleiben leer.
  addColumn(db, 'angebote', 'angenommen_am', 'TEXT');
  addColumn(db, 'angebote', 'abgelehnt_am', 'TEXT');
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

  // Angaben, die erst die E-Rechnung braucht. Am Kontakt: die Kaeuferreferenz
  // (bei Behoerden die Leitweg-ID), das Land als zweistelliges Kuerzel und die
  // Lieferantennummer, unter der der Kunde den Aussteller fuehrt.
  addColumn(db, 'kontakte', 'kaeufer_referenz', 'TEXT');
  addColumn(db, 'kontakte', 'land', 'TEXT');
  addColumn(db, 'kontakte', 'lieferantennummer', 'TEXT');
  // Eigene Kundennummer, nur wenn von Hand vergeben. Leer heisst: die
  // automatische aus der Kontakt-ID (kontakte.js), die nie neu vergeben wird.
  addColumn(db, 'kontakte', 'kundennummer', 'TEXT');
  // An der Rechnung: der Tag der Faelligkeit. Vorher wurde er beim Anzeigen
  // aus dem aktuellen Zahlungsziel gerechnet — ein geaendertes Zahlungsziel
  // verschob damit die Faelligkeit bereits gestellter Rechnungen.
  addColumn(db, 'invoices', 'faellig_am', 'TEXT');

  // Wie belastbar der Preis war, als der Request bepreist wurde. NULL = exakt
  // oder kostenfrei, 'geschaetzt' = Preis eines aehnlich benannten Modells,
  // 'ohne' = kein Preis gefunden, der Request steht mit 0 in der Summe.
  // Festgehalten beim Einlesen: lernt die Preisliste das Modell spaeter,
  // bliebe der alte Betrag sonst unbemerkt stehen.
  addColumn(db, 'events', 'preis_art', 'TEXT');

  // Stammt die Zeile von einer eigenen Eingabe des Nutzers? Abgerechnet wird
  // die eigene Zeit, nicht die Laufzeit der KI — und die beiden lassen sich
  // nur trennen, wenn beim Einlesen festgehalten wird, wer geschrieben hat.
  // NULL = unbekannt (eingelesen vor dieser Spalte), 0 = nein, 1 = ja.
  addColumn(db, 'activity', 'eingabe', 'INTEGER');
  db.exec('CREATE INDEX IF NOT EXISTS idx_activity_eingabe ON activity(ts) WHERE eingabe = 1');

  // Ansprechpartner je Kontakt (R11, Block 4c). Die E-Mail am Kontakt bleibt —
  // die E-Rechnung liest sie weiter. Beim Umstieg wird sie einmal als
  // Ansprechpartner uebernommen, danach nie wieder: sonst kaeme ein geloeschter
  // Eintrag beim naechsten Start zurueck.
  db.exec(`
    CREATE TABLE IF NOT EXISTS ansprechpartner (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kontakt_id  INTEGER NOT NULL,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL DEFAULT '',
      telefon     TEXT NOT NULL DEFAULT '',
      rolle       TEXT NOT NULL DEFAULT '',
      erstellt_am TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ansprechpartner_kontakt ON ansprechpartner(kontakt_id);
  `);
  if (getMeta(db, 'ansprechpartner_uebernommen') === null) {
    db.exec('BEGIN');
    try {
      db.prepare(`
        INSERT INTO ansprechpartner (kontakt_id, name, email, telefon, rolle, erstellt_am)
        SELECT k.id, COALESCE(NULLIF(TRIM(k.vorname || ' ' || k.nachname), ''), k.firma), TRIM(k.email), '', '', ?
        FROM kontakte k
        WHERE TRIM(k.email) <> ''
          AND NOT EXISTS (SELECT 1 FROM ansprechpartner a WHERE a.kontakt_id = k.id)
      `).run(new Date().toISOString());
      setMeta(db, 'ansprechpartner_uebernommen', new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  // Zeiterfassung (2.0): Zeit ohne Claude, auf Vorgang, Projekt, Kunde oder
  // intern gebucht. Rohzeit und gezaehlte Zeit stehen getrennt: Rundung und
  // Abzug ueberlappender Claude-Zeit bleiben nachvollziehbar, und ein spaeter
  // geaenderter Rundungsschritt rechnet keinen alten Eintrag um.
  // Zeitpunkte als UTC-ISO, `tag` wie activity.day (die ersten zehn Zeichen).
  // status/rechnung_nr sperren den Eintrag, sobald er auf einer Rechnung steht.
  db.exec(`
    CREATE TABLE IF NOT EXISTS zeit_eintrag (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      ziel_art         TEXT NOT NULL CHECK (ziel_art IN ('vorgang','projekt','kunde','intern')),
      ziel_schluessel  TEXT NOT NULL,
      start            TEXT NOT NULL,
      ende             TEXT NOT NULL,
      tag              TEXT NOT NULL,
      dauer_fest_min   INTEGER,
      pause_min        INTEGER NOT NULL DEFAULT 0,
      taetigkeit       TEXT NOT NULL,
      notiz            TEXT NOT NULL DEFAULT '',
      abrechenbar      INTEGER NOT NULL DEFAULT 1,
      rohzeit_min      INTEGER NOT NULL,
      abzug_min        INTEGER NOT NULL DEFAULT 0,
      parallel_min     INTEGER NOT NULL DEFAULT 0,
      kulanz_min       INTEGER NOT NULL DEFAULT 0,
      gezaehlt_min     INTEGER NOT NULL,
      status           TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','abgerechnet')),
      rechnung_nr      TEXT,
      satz_eingefroren REAL,
      kalender_uid     TEXT,
      created_at       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_zeit_eintrag_tag ON zeit_eintrag(tag);
    CREATE INDEX IF NOT EXISTS idx_zeit_eintrag_ziel ON zeit_eintrag(ziel_art, ziel_schluessel);
    CREATE INDEX IF NOT EXISTS idx_zeit_eintrag_rechnung ON zeit_eintrag(rechnung_nr) WHERE rechnung_nr IS NOT NULL;

    -- Taetigkeitsarten der Zeiterfassung. satz NULL = Satz des Ziels (Projekt
    -- inkl. Rabatt). parallel = 1: darf neben einer Claude-Sitzung voll zaehlen.
    CREATE TABLE IF NOT EXISTS taetigkeitsart (
      name     TEXT PRIMARY KEY,
      satz     REAL,
      parallel INTEGER NOT NULL DEFAULT 0
    );

    -- Wahl bei Ueberlappung, je Paar Eintrag und Claude-Sitzung. Eine Quelle
    -- fuer beide Seiten: claude/keins senken den Eintrag, meine/keins die
    -- Sitzung, jeweils um genau die ueberlappenden Minuten.
    CREATE TABLE IF NOT EXISTS ueberlappung_wahl (
      eintrag_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      wahl       TEXT NOT NULL CHECK (wahl IN ('beides','claude','meine','keins')),
      PRIMARY KEY (eintrag_id, session_id)
    );

    -- Termine aus Kalendern (ICS/CalDAV, nur gelesen) und lokal angelegte
    -- (kalender_id 'lokal'). Eine Serie steht je Vorkommen hier, uid dann
    -- "<UID>#<Beginn>". ziel_von_hand = 1: Zuordnung von Hand, der Abgleich
    -- raet sie nicht neu. Zugaenge stehen nur in config.json, nie hier.
    CREATE TABLE IF NOT EXISTS termin (
      kalender_id        TEXT NOT NULL,
      uid                TEXT NOT NULL,
      titel              TEXT NOT NULL,
      start              TEXT NOT NULL,
      ende               TEXT NOT NULL,
      ganztag            INTEGER NOT NULL DEFAULT 0,
      art                TEXT NOT NULL CHECK (art IN ('meeting','blocker','fremd')),
      quelle             TEXT NOT NULL CHECK (quelle IN ('kalender','lokal')),
      ziel_art           TEXT,
      ziel_schluessel    TEXT,
      ziel_von_hand      INTEGER NOT NULL DEFAULT 0,
      gebucht_eintrag_id INTEGER,
      erinnert_am        TEXT,
      aktualisiert_am    TEXT NOT NULL,
      PRIMARY KEY (kalender_id, uid)
    );
    CREATE INDEX IF NOT EXISTS idx_termin_start ON termin(start);
  `);
  // Hinweis bei Blocker-Beginn (Z6b) am Termin selbst, nicht im Speicher: ein
  // Neustart darf eine schon verbrauchte Erinnerung nicht verschlucken.
  // hinweis_fall: claude | begleiten | manuell, hinweis_weg = 1: weggeklickt.
  addColumn(db, 'termin', 'hinweis_fall', 'TEXT');
  addColumn(db, 'termin', 'hinweis_weg', 'INTEGER NOT NULL DEFAULT 0');
  // Schalter "Bei Beginn erinnern" am Blocker (Z7a). Vorgabe an: so war es bis Z6b.
  addColumn(db, 'termin', 'erinnern', 'INTEGER NOT NULL DEFAULT 1');
  // Lokal angelegt und an Googles Formular uebergeben, aber noch nicht aus dem
  // Kalender zurueck (Zeitpunkt der Uebergabe). Der Abgleich fuehrt zusammen.
  addColumn(db, 'termin', 'google_offen', 'TEXT');

  // Cira (Masterplan 3.0, C2). Gespraech je Kanal, T2-Laeufe mit Kosten,
  // Freigaben ("Braucht dich") und das Protokoll jeder Schreib-Aktion.
  db.exec(`
    CREATE TABLE IF NOT EXISTS cira_nachricht (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      zeit         TEXT NOT NULL,
      kanal        TEXT NOT NULL,           -- dock | cockpit | flow
      rolle        TEXT NOT NULL,           -- ich | cira
      text         TEXT NOT NULL,
      stufe        TEXT,                    -- T0 | T1 | T2
      kosten_eur   REAL,
      quelle       TEXT,
      szene_json   TEXT,
      sprung_json  TEXT,
      kontext_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cira_nachricht_zeit ON cira_nachricht(kanal, zeit);
    -- Ein T2-Lauf (claude -p). session_id fuehrt zu den Zeilen in events.
    CREATE TABLE IF NOT EXISTS cira_lauf (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      zeit        TEXT NOT NULL,
      session_id  TEXT,
      profil      TEXT NOT NULL,
      ok          INTEGER NOT NULL,
      kosten_usd  REAL,
      tokens      INTEGER,
      fehler      TEXT
    );
    CREATE TABLE IF NOT EXISTS freigabe (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      art           TEXT NOT NULL,
      bezug         TEXT,
      titel         TEXT NOT NULL,
      text          TEXT,
      nutzlast_json TEXT,
      status        TEXT NOT NULL DEFAULT 'offen',   -- offen | erledigt | abgelehnt | fehler
      erstellt      TEXT NOT NULL,
      erledigt_am   TEXT,
      quelle        TEXT NOT NULL,                   -- cira | flow:<id> | sitzung:<id>
      hinweis       TEXT,
      ergebnis_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_freigabe_status ON freigabe(status);
    CREATE TABLE IF NOT EXISTS aktion_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      zeit         TEXT NOT NULL,
      quelle       TEXT NOT NULL,
      art          TEXT NOT NULL,
      objekt       TEXT,
      vorher_json  TEXT,
      nachher_json TEXT
    );
    -- Sitzungen (C5): aus c2invoice gestartete Claude-Code-Prozesse und
    -- fremde Sitzungen, die sich ueber den Hook gemeldet haben. Die id ist die
    -- session_id der CLI (--session-id), Kosten kommen aus events.
    CREATE TABLE IF NOT EXISTS sitzung (
      id            TEXT PRIMARY KEY,
      quelle        TEXT NOT NULL,                   -- c2invoice | fremd
      arbeitsbereich TEXT,
      vorgang       TEXT,
      agent         TEXT,
      status        TEXT NOT NULL,                   -- startet | laeuft | bereit | wartet | beendet | fehler
      pid           INTEGER,
      model         TEXT,
      mode          TEXT,
      effort        TEXT,
      ctx_pct       REAL,
      kosten_usd    REAL,                            -- laut CLI (total_cost_usd), der Ledger rechnet selbst
      init_json     TEXT,
      fehler        TEXT,
      gestartet     TEXT NOT NULL,
      beendet       TEXT
    );
    CREATE TABLE IF NOT EXISTS sitzung_ereignis (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT NOT NULL,
      zeit         TEXT NOT NULL,
      art          TEXT NOT NULL,                    -- eingabe | say | read | edit | bash | mcp | skill | werkzeug | frage | rechte | zug
      titel        TEXT,
      meta         TEXT,
      kosten_usd   REAL,
      koerper_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sitzung_ereignis ON sitzung_ereignis(session_id, id);
    -- Vorgangs-Log (C6): Eintraege je Vorgang, z. B. die Zusammenfassung einer
    -- Sitzung. quelle: sitzung:<id> | cira | flow:<n>.
    CREATE TABLE IF NOT EXISTS vorgang_log (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      vorgang TEXT NOT NULL,
      zeit    TEXT NOT NULL,
      quelle  TEXT NOT NULL,
      text    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vorgang_log ON vorgang_log(vorgang, zeit);
    -- Budget je Vorgang in Euro, von Hand gesetzt (Owner 20.10.2026).
    CREATE TABLE IF NOT EXISTS vorgang_budget (
      vorgang      TEXT PRIMARY KEY,
      budget_eur   REAL NOT NULL,
      geaendert_am TEXT NOT NULL
    );
    -- Skill-Ablauf (C6b): eine Sitzung, Schritte als Eingaben darin.
    -- schritte_json: [{befehl, ziel, status idle|run|wait|done|stopped, ab, bis, freigabe}];
    -- ab/bis grenzen die Ereignisse des Schritts in sitzung_ereignis ein.
    CREATE TABLE IF NOT EXISTS ablauf (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      vorgang           TEXT,
      arbeitsbereich    TEXT NOT NULL,
      sitzung           TEXT NOT NULL,
      schritte_json     TEXT NOT NULL,
      aktueller_schritt INTEGER NOT NULL DEFAULT 0,
      status            TEXT NOT NULL,                -- run | wait | stopped | done
      hinweise_json     TEXT,
      stop_grund        TEXT,
      erstellt          TEXT NOT NULL,
      aktualisiert      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ablauf_sitzung ON ablauf(sitzung, status);
    -- Jira-Cache fuers Board (C7a): eine Zeile je Ticket, felder_json = das
    -- abgebildete Ticket (jira-sync.issueAus). Abgleich hoechstens alle 120 s.
    CREATE TABLE IF NOT EXISTS jira_issue (
      key         TEXT PRIMARY KEY,
      projekt     TEXT NOT NULL,
      status      TEXT,
      status_kat  TEXT,
      felder_json TEXT NOT NULL,
      aktualisiert TEXT,
      geholt      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jira_issue_projekt ON jira_issue(projekt);
    -- Gekoppelte Geraete (S1): nur wer gekoppelt ist, schreibt. Gespeichert
    -- wird der SHA-256 des Tokens, nie das Token selbst.
    CREATE TABLE IF NOT EXISTS geraet (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      art        TEXT NOT NULL,                      -- browser | client
      token_hash TEXT NOT NULL UNIQUE,
      erstellt   TEXT NOT NULL,
      zuletzt    TEXT
    );
    -- Werkzeuge (C8): letzte /context-Messung je Arbeitsbereich ('global' fuer
    -- die Ebene Global), json = werkzeuge.parseKontext(...).
    CREATE TABLE IF NOT EXISTS werkzeug_kontext (
      bereich     TEXT PRIMARY KEY,
      gemessen_am TEXT NOT NULL,
      json        TEXT NOT NULL
    );
  `);
  // Modell-Block: welche Rolle/welches Modell antwortete und warum, plus die
  // Markierung "falsch zugeordnet" aus der Oberflaeche.
  addColumn(db, 'cira_nachricht', 'route_json', 'TEXT');
  addColumn(db, 'cira_nachricht', 'falsch', 'INTEGER');
  // C5: wann der Hook einer fremden Sitzung zuletzt meldete (Status gilt 15 Minuten).
  addColumn(db, 'sitzung', 'aktualisiert', 'TEXT');
  // /clear gibt der CLI eine neue Sitzungs-ID (Spike 20.10.). Jede neue ID einer
  // c2invoice-Sitzung steht hier als Fortsetzung: Vorgang, Liste und
  // "Im Terminal fortsetzen" folgen ihr.
  db.exec(`CREATE TABLE IF NOT EXISTS sitzung_folge (
    folge   TEXT PRIMARY KEY,
    sitzung TEXT NOT NULL,
    seit    TEXT NOT NULL
  )`);
  // C9: Index des Vaults (Gedaechtnis), Gelesen-Stand und Kurzfassungen der Briefings.
  db.exec(`
    CREATE TABLE IF NOT EXISTS notiz_index (
      pfad             TEXT PRIMARY KEY,   -- relativ zum Vault, mit /
      ordner           TEXT,
      titel            TEXT,
      tags_json        TEXT,
      links_json       TEXT,
      frontmatter_json TEXT,
      rumpf            TEXT,
      groesse          INTEGER,
      mtime            REAL,
      hash             TEXT,
      indexiert        TEXT
    );
    CREATE TABLE IF NOT EXISTS briefing_gelesen (
      pfad       TEXT PRIMARY KEY,
      hash       TEXT NOT NULL,
      gelesen_am TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS briefing_kurz (
      hash   TEXT PRIMARY KEY,
      text   TEXT NOT NULL,
      modell TEXT,
      tokens INTEGER,
      zeit   TEXT NOT NULL
    );
  `);
  // C10: Spracherkennung und Stimme. ElevenLabs rechnet nach Zeichen ab, die
  // passen weder zu cira_lauf (USD) noch zu events (Tokens) — eigene Tabelle.
  db.exec(`
    CREATE TABLE IF NOT EXISTS sprache_lauf (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      zeit     TEXT NOT NULL,
      art      TEXT NOT NULL,      -- stt | tts
      anbieter TEXT NOT NULL,      -- whisper | elevenlabs
      zeichen  INTEGER NOT NULL,   -- abgerechnete Zeichen (Cache-Treffer und Fehler 0)
      ms       INTEGER,
      cache    INTEGER NOT NULL,
      fehler   TEXT
    );
  `);
  addColumn(db, 'cira_nachricht', 'gesprochen', 'INTEGER');
  // Saat genau einmal: eine geloeschte Taetigkeit kaeme sonst bei jedem Start zurueck.
  if (getMeta(db, 'taetigkeiten_gesaet') === null) {
    const ein = db.prepare('INSERT OR IGNORE INTO taetigkeitsart (name, satz, parallel) VALUES (?, NULL, ?)');
    for (const [name, parallel] of [['Entwicklung', 0], ['Meeting', 1], ['Konzept', 0], ['Review', 0], ['Begleiten', 0], ['Support', 0]]) {
      ein.run(name, parallel);
    }
    setMeta(db, 'taetigkeiten_gesaet', new Date().toISOString());
  }
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
