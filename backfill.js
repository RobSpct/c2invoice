'use strict';
// Nachtraegliche Ticket-Zuordnung fuer Ereignisse, die beim Einlesen keinen
// Ticket-Schluessel hatten. Grund: zugeordnet wird primaer ueber den
// Branch-Namen, aber es wird auch auf dev, release/* oder in Worktrees mit
// abgeloestem HEAD gearbeitet. Diese Arbeit gehoert trotzdem auf ein Ticket.
//
// Grundsatz: lieber ticketlos lassen als falsch abrechnen. Jede Stufe fasst
// nur an, was noch NULL ist; die Herkunft der Zuordnung steht danach in
// ticket_quelle und ist damit pruefbar. Reine UPDATEs, idempotent, jederzeit
// wiederholbar — auch nach dem naechsten Einlesen, das die Branch-Zuordnung
// per UPSERT zurueckschreibt (siehe refreshData in server.js).
const metrics = require('./metrics');
const { ticketOf, projectOf, istTemp, PROJEKT_ALIAS, CIRA_PROJEKT, LOKAL_PROJEKT, TEST_PROJEKT } = require('./ingest');
const { inTransaktion } = require('./kontakte');

// Testlaeufe tragen nie ein Ticket, keine Stufe gibt ihnen eines. Eine Sitzung kann aber
// gemischt sein (cd in den Temp-Ordner): deshalb je Zeile pruefen. Nur wo die ganze
// Sitzung aus Testlaeufen besteht, gehoeren auch ihre Zeilen ohne cwd dazu.
const NUR_TEST = 'SELECT session_id FROM events GROUP BY session_id HAVING SUM(project <> ?) = 0';

// Sitzungsweise statt ereignisweise zuordnen: Tokens stehen in events,
// die Aktivzeit in activity. Wandern die getrennt, gehoeren Arbeitswert und
// Kosten desselben Zeitraums ploetzlich zu verschiedenen Tickets.
function setzeSession(db, sessionId, ticket, quelle) {
  const e = db.prepare(
    'UPDATE events SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND ticket IS NULL AND project <> ?'
  ).run(ticket, quelle, sessionId, TEST_PROJEKT);
  db.prepare(
    'UPDATE activity SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND ticket IS NULL AND project <> ?'
  ).run(ticket, quelle, sessionId, TEST_PROJEKT);
  return e.changes;
}

// Stufe 1: manuelle Nachtraege. Als einzige Stufe schlagen sie auch eine
// bereits vorhandene Zuordnung — wer hier etwas eintraegt, weiss es besser
// als die Automatik. Testlaeufe bleiben trotzdem ohne Ticket; der Eintrag bleibt stehen.
function stufeOverrides(db) {
  const zeilen = db.prepare(
    `SELECT session_id, ticket FROM overrides WHERE ticket IS NOT NULL AND session_id NOT IN (${NUR_TEST})`
  ).all(TEST_PROJEKT);
  let n = 0;
  for (const o of zeilen) {
    const e = db.prepare(
      'UPDATE events SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND (ticket IS NULL OR ticket <> ?) AND project <> ?'
    ).run(o.ticket, 'override', o.session_id, o.ticket, TEST_PROJEKT);
    db.prepare(
      'UPDATE activity SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND (ticket IS NULL OR ticket <> ?) AND project <> ?'
    ).run(o.ticket, 'override', o.session_id, o.ticket, TEST_PROJEKT);
    n += e.changes;
  }
  return n;
}

// Stufe 2: Worktree-Pfade tragen den Ticket-Schluessel im Verzeichnisnamen,
// auch wenn der Branch abgeloest ist. activity fuehrt kein cwd — diese Zeilen
// holen die Stufen 3 und 4 sitzungsweise nach.
function stufeCwd(db) {
  const pfade = db.prepare(
    'SELECT DISTINCT cwd FROM events WHERE ticket IS NULL AND cwd IS NOT NULL'
  ).all();
  let n = 0;
  for (const { cwd } of pfade) {
    const ticket = ticketOf(cwd);
    if (!ticket) continue;
    const r = db.prepare(
      'UPDATE events SET ticket = ?, ticket_quelle = ? WHERE cwd = ? AND ticket IS NULL AND project <> ?'
    ).run(ticket, 'cwd', cwd, TEST_PROJEKT);
    n += r.changes;
  }
  return n;
}

// Stufe 3: Sitzungs-Konsens. Eine Sitzung, in der genau ein Ticket vorkommt
// und daneben ticketlose Ereignisse: der Wechsel auf einen anderen Branch
// mitten in derselben Sitzung gehoert zur selben Arbeit. Deckt auch
// Unteragenten ab — die tragen dieselbe session_id.
function stufeSessionKonsens(db) {
  const kandidaten = db.prepare(`
    SELECT session_id, MIN(ticket) AS ticket
    FROM events
    GROUP BY session_id
    HAVING COUNT(DISTINCT ticket) = 1 AND SUM(ticket IS NULL) > 0
  `).all();
  let n = 0;
  for (const k of kandidaten) {
    if (!k.ticket) continue;
    n += setzeSession(db, k.session_id, k.ticket, 'session');
  }
  return n;
}

// Stufe 4: zeitliche Naehe, sitzungsweise und nur innerhalb desselben
// Projekts. Fuer komplett ticketlose Sitzungen: welches Ticket war im selben
// Projekt zeitlich ringsum aktiv? Zwei Bremsen gegen Falschabrechnung:
// Werkzeug-Projekte bleiben aussen vor (die ordnet werkzeugeJeTicket bereits
// ueber die Zeit zu — sonst zaehlt derselbe Betrag doppelt), und es braucht
// eine Mehrheit: nur wenn mehr als die Haelfte der Ereignisse einer Sitzung
// ueberhaupt einen Ticket-Nachbarn im Fenster hat, gilt die Zuordnung.
// Arbeit direkt auf dev ohne Ticket ist ein legitimer Fall und bleibt NULL.
function stufeZeitfenster(db) {
  const overhead = [...metrics.OVERHEAD];
  const platz = overhead.map(() => '?').join(',');
  const nichtOverhead = `AND project NOT IN (${platz})`;

  const sessions = db.prepare(`
    SELECT session_id, project, COUNT(*) AS anzahl
    FROM events
    WHERE ticket IS NULL ${nichtOverhead}
      AND session_id NOT IN (SELECT session_id FROM events WHERE ticket IS NOT NULL)
    GROUP BY session_id, project
  `).all(...overhead);
  if (sessions.length === 0) return 0;

  // Ticket-Ereignisse je Projekt einmal laden statt je Sitzung erneut.
  const zielJeProjekt = new Map();
  const zielFuer = (projekt) => {
    if (!zielJeProjekt.has(projekt)) {
      zielJeProjekt.set(projekt, db.prepare(
        'SELECT ts, ticket FROM events WHERE project = ? AND ticket IS NOT NULL ORDER BY ts'
      ).all(projekt).map((r) => ({ t: Date.parse(r.ts), p: r.ticket })));
    }
    return zielJeProjekt.get(projekt);
  };

  let n = 0;
  for (const s of sessions) {
    const ziel = zielFuer(s.project);
    if (ziel.length === 0) continue;

    const quell = db.prepare(
      'SELECT request_id, ts FROM events WHERE session_id = ? AND ticket IS NULL ORDER BY ts'
    ).all(s.session_id);

    const treffer = metrics.fensterMehrheit(quell, ziel, metrics.ZUORDNUNGSFENSTER_MS);
    // Quorum: die Mehrheit der Ereignisse muss einen Nachbarn gefunden haben.
    if (treffer.size * 2 <= quell.length) continue;

    const zaehler = new Map();
    for (const t of treffer.values()) zaehler.set(t, (zaehler.get(t) || 0) + 1);
    let bestes = null;
    let beste = -1;
    for (const [t, c] of zaehler) if (c > beste) { bestes = t; beste = c; }
    if (!bestes) continue;

    n += setzeSession(db, s.session_id, bestes, 'fenster');
  }
  return n;
}

// Vorstufe: Projektnamen vorhandener Zeilen an die heutigen Regeln angleichen.
// Bewusst nur Temp-Pfade und Alias-Paare: projectRoots war frueher anders, und
// alte Zuordnungen sollen nicht wandern. activity kennt kein cwd und folgt der
// Sitzung. Danach verlieren (test)-Zeilen ihr Ticket: erst nach allen Umzuegen, sonst
// entgingen ihr die Zeilen, die ein Alias auf (test) gerade erst hergebracht hat.
// Rechnungen, Zeiteintraege, Kontakte und overrides bleiben unberuehrt.
// Synchron, damit keine Transaktion ueber ein await offen bleibt. Reine UPDATEs, idempotent.
function zieheProjekteNach(db) {
  const fest = (p) => p === CIRA_PROJEKT || p === LOKAL_PROJEKT;
  const aus = { events: 0, activity: 0, tickets: 0 };
  try {
    inTransaktion(db, () => {
      const ereignisse = db.prepare('UPDATE events SET project = ? WHERE cwd = ? AND project = ?');
      // Steht nach dem Umzug noch ein Ereignis der Sitzung unter dem alten Namen, liegt dort echte
      // Arbeit: activity kennt kein cwd, also bleibt sie ganz dort, samt Ticket.
      const sitzungen = db.prepare(
        `UPDATE activity SET project = ? WHERE project = ? AND session_id IN (SELECT session_id FROM events WHERE cwd = ?)
         AND session_id NOT IN (SELECT session_id FROM events WHERE project = ?)`
      );
      for (const { project: alt, cwd } of db.prepare('SELECT DISTINCT project, cwd FROM events WHERE cwd IS NOT NULL').all()) {
        const neu = projectOf(cwd);
        if (neu === alt || fest(alt)) continue;
        if (!istTemp(cwd) && !(Object.hasOwn(PROJEKT_ALIAS, alt) && PROJEKT_ALIAS[alt] === neu)) continue;
        aus.events += ereignisse.run(neu, cwd, alt).changes;
        aus.activity += sitzungen.run(neu, alt, cwd, alt).changes;
      }
      // Reste ohne Ereignis in der Sitzung. Ist ein Name selbst Ziel eines Alias, stehen dort
      // schon umgezogene Zeilen, und der naechste Start reichte sie weiter (einstufig, wie projectOf).
      const ziele = new Set(Object.values(PROJEKT_ALIAS));
      const rest = db.prepare('UPDATE activity SET project = ? WHERE project = ?');
      for (const [alt, neu] of Object.entries(PROJEKT_ALIAS)) {
        if (!fest(alt) && !ziele.has(alt)) aus.activity += rest.run(neu, alt).changes;
      }
      const ohneTicket = 'SET ticket = NULL, ticket_quelle = NULL WHERE (ticket IS NOT NULL OR ticket_quelle IS NOT NULL) AND ';
      aus.tickets += db.prepare('UPDATE events ' + ohneTicket + 'project = ?').run(TEST_PROJEKT).changes;
      aus.tickets += db.prepare('UPDATE activity ' + ohneTicket + `(project = ? OR (project = ? AND session_id IN (${NUR_TEST})))`)
        .run(TEST_PROJEKT, metrics.UNBEKANNT, TEST_PROJEKT).changes;
    });
  } catch (err) {
    console.error('Projekt-Nachzug fehlgeschlagen, nichts geaendert:', err);
    return { events: 0, activity: 0, tickets: 0 };
  }
  if (aus.events || aus.activity || aus.tickets) {
    console.log(`Projekt-Nachzug: ${aus.events} Ereignisse, ${aus.activity} Activity-Zeilen, ${aus.tickets} Tickets entfernt`);
  }
  return aus;
}

// Einmal je Verbindung und Prozess, nicht in jedem 30-s-Takt: neue Zeilen stimmen schon beim Einlesen.
// Nie in einer offenen Transaktion (bucheVorgang): ihr ROLLBACK naehme den Nachzug mit, der dann als erledigt gaelte.
const nachgezogen = new WeakSet();

function run({ db, verbose = false } = {}) {
  const start = Date.now();
  if (!nachgezogen.has(db) && !db.isTransaction) {
    nachgezogen.add(db);
    zieheProjekteNach(db);
  }
  const stufen = {
    override: stufeOverrides(db),
    cwd: stufeCwd(db),
    session: stufeSessionKonsens(db),
    fenster: stufeZeitfenster(db),
  };
  const gesamt = Object.values(stufen).reduce((a, b) => a + b, 0);
  const ms = Date.now() - start;
  if (verbose) {
    console.log(`Backfill: ${gesamt} Ereignisse zugeordnet in ${ms} ms`);
    for (const [name, anzahl] of Object.entries(stufen)) {
      console.log(`  ${name.padEnd(9)} ${anzahl}`);
    }
    const offen = db.prepare(
      'SELECT COUNT(*) AS n, ROUND(SUM(cost_usd), 2) AS usd FROM events WHERE ticket IS NULL'
    ).get();
    console.log(`  offen:    ${offen.n} Ereignisse / ${offen.usd || 0} USD ohne Ticket`);
  }
  return { stufen, gesamt, ms };
}

// stufeOverrides ist bewusst nicht dabei: sie wird ueber run() mitgeprueft.
module.exports = { run, zieheProjekteNach, stufeCwd, stufeSessionKonsens, stufeZeitfenster };

if (require.main === module) {
  const dbmod = require('./db');
  const db = dbmod.open();
  run({ db, verbose: true });
  db.close();
}
