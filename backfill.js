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
const { ticketOf } = require('./ingest');

// Sitzungsweise statt ereignisweise zuordnen: Tokens stehen in events,
// die Aktivzeit in activity. Wandern die getrennt, gehoeren Arbeitswert und
// Kosten desselben Zeitraums ploetzlich zu verschiedenen Tickets.
function setzeSession(db, sessionId, ticket, quelle) {
  const e = db.prepare(
    'UPDATE events SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND ticket IS NULL'
  ).run(ticket, quelle, sessionId);
  db.prepare(
    'UPDATE activity SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND ticket IS NULL'
  ).run(ticket, quelle, sessionId);
  return e.changes;
}

// Stufe 1: manuelle Nachtraege. Als einzige Stufe schlagen sie auch eine
// bereits vorhandene Zuordnung — wer hier etwas eintraegt, weiss es besser
// als die Automatik.
function stufeOverrides(db) {
  const zeilen = db.prepare('SELECT session_id, ticket FROM overrides WHERE ticket IS NOT NULL').all();
  let n = 0;
  for (const o of zeilen) {
    const e = db.prepare(
      'UPDATE events SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND (ticket IS NULL OR ticket <> ?)'
    ).run(o.ticket, 'override', o.session_id, o.ticket);
    db.prepare(
      'UPDATE activity SET ticket = ?, ticket_quelle = ? WHERE session_id = ? AND (ticket IS NULL OR ticket <> ?)'
    ).run(o.ticket, 'override', o.session_id, o.ticket);
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
      'UPDATE events SET ticket = ?, ticket_quelle = ? WHERE cwd = ? AND ticket IS NULL'
    ).run(ticket, 'cwd', cwd);
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
  const nichtOverhead = overhead.length ? `AND project NOT IN (${platz})` : '';

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

function run({ db, verbose = false } = {}) {
  const start = Date.now();
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
module.exports = { run, stufeCwd, stufeSessionKonsens, stufeZeitfenster };

if (require.main === module) {
  const dbmod = require('./db');
  const db = dbmod.open();
  run({ db, verbose: true });
  db.close();
}
