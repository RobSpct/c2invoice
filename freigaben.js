'use strict';
// Freigaben ("Braucht dich", BACKEND §2.2). Alles, was nach aussen geht oder
// fremde Daten veraendert, legt Cira (spaeter auch Flows und Sitzungen) hier ab;
// ausgefuehrt wird erst auf Klick. Je Art eine Aktion in der Registry — die
// Bloecke tragen ihre Arten selbst ein (rechnung C4, sitzung_frage C5,
// jira_kommentar C7 …). Ohne Eintrag laesst sich eine Freigabe nur ablehnen.
//
// Dazu das Protokoll jeder Schreib-Aktion (aktion_log): zeit, quelle, art,
// objekt, vorher, nachher.
const { sende } = require('./ereignisse');

const REGISTRY = new Map();
function registriere(art, ausfuehren) {
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(art) || typeof ausfuehren !== 'function') throw new Error('Freigabe-Art ungueltig: ' + art);
  REGISTRY.set(art, ausfuehren);
}

const jetzt = () => new Date().toISOString();
const alsJson = (v) => (v === undefined ? null : JSON.stringify(v));
const ausJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

function protokoll(db, { quelle, art, objekt = null, vorher, nachher }) {
  db.prepare('INSERT INTO aktion_log (zeit, quelle, art, objekt, vorher_json, nachher_json) VALUES (?,?,?,?,?,?)')
    .run(jetzt(), quelle, art, objekt, alsJson(vorher), alsJson(nachher));
}

const offenAnzahl = (db) => db.prepare("SELECT COUNT(*) AS n FROM freigabe WHERE status = 'offen'").get().n;
const meldeZaehler = (db) => sende('zaehler', { freigaben: offenAnzahl(db) });

function zeile(r) {
  return {
    id: r.id, art: r.art, bezug: r.bezug, titel: r.titel, text: r.text, nutzlast: ausJson(r.nutzlast_json),
    status: r.status, erstellt: r.erstellt, erledigt_am: r.erledigt_am, quelle: r.quelle, hinweis: r.hinweis,
    ergebnis: ausJson(r.ergebnis_json), ausfuehrbar: REGISTRY.has(r.art),
  };
}

function anlegen(db, { art, bezug = null, titel, text = '', nutzlast = null, quelle }) {
  if (typeof art !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(art)) throw new Error('Freigabe: Art ungueltig.');
  if (typeof titel !== 'string' || !titel.trim() || titel.length > 200) throw new Error('Freigabe: Titel fehlt oder ist zu lang.');
  if (typeof quelle !== 'string' || !/^(cira|flow:\d+|sitzung:[\w-]{1,80})$/.test(quelle)) throw new Error('Freigabe: Quelle ungueltig.');
  const roh = alsJson(nutzlast);
  if (roh && roh.length > 64 * 1024) throw new Error('Freigabe: Nutzlast zu gross.');
  const r = db.prepare('INSERT INTO freigabe (art, bezug, titel, text, nutzlast_json, erstellt, quelle) VALUES (?,?,?,?,?,?,?)')
    .run(art, bezug == null ? null : String(bezug).slice(0, 120), titel.trim(), String(text || '').slice(0, 20000), roh, jetzt(), quelle);
  const f = zeile(db.prepare('SELECT * FROM freigabe WHERE id = ?').get(r.lastInsertRowid));
  // Art, Titel und Bezug gehen mit: die Benachrichtigung im Browser zeigt sie, ohne nachzuladen.
  sende('freigabe', { id: f.id, status: f.status, art: f.art, titel: f.titel, bezug: f.bezug });
  meldeZaehler(db);
  return f;
}

// Wie anlegen, aber eine offene Freigabe gleicher Art und gleichen Bezugs
// weicht der neuen (zweimal "Rechnung fuer ABC-1" ergibt eine Karte, nicht zwei).
// Die alte bleibt als abgelehnt mit Grund sichtbar, im Protokoll steht der Wechsel.
// Erst die neue anlegen (sie prueft Titel, Nutzlast, Quelle), dann die alten
// ablehnen: scheitert die neue, bleibt die alte offen statt dass beide fehlen.
function ersetze(db, daten) {
  const neu = anlegen(db, daten);
  const alt = daten.bezug == null ? [] : db.prepare("SELECT id FROM freigabe WHERE art = ? AND bezug = ? AND status = 'offen' AND id <> ?").all(neu.art, neu.bezug, neu.id);
  for (const { id } of alt) {
    const r = db.prepare("UPDATE freigabe SET status = 'abgelehnt', erledigt_am = ?, hinweis = 'durch neueren Entwurf ersetzt' WHERE id = ? AND status = 'offen'").run(jetzt(), id);
    if (!r.changes) continue;
    protokoll(db, { quelle: daten.quelle, art: daten.art + ':ersetzt', objekt: daten.bezug, vorher: { id, status: 'offen' }, nachher: { status: 'abgelehnt' } });
    sende('freigabe', { id, status: 'abgelehnt' });
  }
  if (alt.length) meldeZaehler(db);
  return neu;
}

function liste(db, { status = 'offen' } = {}) {
  const alle = status === 'alle';
  if (!alle && !['offen', 'erledigt', 'abgelehnt', 'fehler'].includes(status)) throw new Error('Status: offen, erledigt, abgelehnt, fehler oder alle.');
  return db.prepare(`SELECT * FROM freigabe ${alle ? '' : 'WHERE status = ?'} ORDER BY id DESC LIMIT 200`)
    .all(...(alle ? [] : [status])).map(zeile);
}

// wahl: ok | ablehnen. Der Statuswechsel offen -> laeuft ist die Sperre gegen
// einen Doppelklick: wer ihn nicht bekommt, hat nichts zu tun. Scheitert die
// Aktion, steht die Freigabe wieder offen und der Fehler geht an den Aufrufer.
async function entscheide(db, id, { wahl, hinweis } = {}) {
  if (!Number.isInteger(id) || id < 1) throw new Error('Freigabe unbekannt.');
  if (wahl !== 'ok' && wahl !== 'ablehnen') throw new Error('Wahl: ok oder ablehnen.');
  if (hinweis != null && (typeof hinweis !== 'string' || hinweis.length > 2000)) throw new Error('Hinweis: Text bis 2000 Zeichen.');
  const f = db.prepare('SELECT * FROM freigabe WHERE id = ?').get(id);
  if (!f) throw new Error('Freigabe unbekannt.');
  const ausfuehren = REGISTRY.get(f.art);
  if (wahl === 'ok' && !ausfuehren) throw Object.assign(new Error('Für diese Art gibt es noch keine Aktion. Nur Ablehnen ist möglich.'), { status: 409 });
  const sperre = db.prepare("UPDATE freigabe SET status = 'laeuft' WHERE id = ? AND status = 'offen'").run(id);
  if (!sperre.changes) throw Object.assign(new Error('Freigabe ist schon entschieden.'), { status: 409 });

  let ergebnis = null;
  if (wahl === 'ok') {
    try {
      ergebnis = (await ausfuehren(db, ausJson(f.nutzlast_json), { hinweis: hinweis || null, freigabe: zeile(f) })) ?? null;
    } catch (err) {
      db.prepare("UPDATE freigabe SET status = 'offen' WHERE id = ?").run(id);
      throw err;
    }
  }
  const status = wahl === 'ok' ? 'erledigt' : 'abgelehnt';
  try {
    db.prepare('UPDATE freigabe SET status = ?, erledigt_am = ?, hinweis = ?, ergebnis_json = ? WHERE id = ?')
      .run(status, jetzt(), hinweis || null, alsJson(ergebnis), id);
    protokoll(db, { quelle: 'freigabe:' + id, art: f.art + ':' + wahl, objekt: f.bezug, vorher: { status: 'offen' }, nachher: { status, ergebnis } });
  } catch (err) {
    // Die Aktion ist gelaufen (z. B. Rechnung gestellt), nur der Status fehlt.
    // Nie zurueck auf "offen": ein zweiter Klick stellte ein zweites Mal.
    console.error('Freigabe ' + id + ': Aktion ausgefuehrt, Status nicht gespeichert:', err);
    try { db.prepare("UPDATE freigabe SET status = 'fehler', hinweis = ?, ergebnis_json = ? WHERE id = ?").run('Aktion ausgeführt, Status nicht gespeichert: ' + String(err.message).slice(0, 200), alsJson(ergebnis), id); } catch (e2) { console.error('Freigabe ' + id + ': auch Fehlerstatus nicht gespeichert:', e2.message); }
    sende('freigabe', { id, status: 'fehler' });
    throw Object.assign(new Error('Ausgeführt' + (ergebnis && ergebnis.nr ? ' (Rechnung ' + ergebnis.nr + ')' : '') + ', aber der Status ließ sich nicht speichern. Nicht erneut auslösen, Ergebnis prüfen.'), { status: 500 });
  }
  sende('freigabe', { id, status });
  meldeZaehler(db);
  return zeile(db.prepare('SELECT * FROM freigabe WHERE id = ?').get(id));
}

// Beim Start: eine Freigabe, die beim Absturz noch lief, ist unklar ausgefuehrt.
// Sie wird sichtbar zu "fehler" statt still in "laeuft" zu verschwinden.
function aufraeumen(db) {
  return db.prepare("UPDATE freigabe SET status = 'fehler', hinweis = 'Server wurde waehrend der Aktion beendet; Ergebnis pruefen.' WHERE status = 'laeuft'").run().changes;
}

module.exports = { aufraeumen, registriere, anlegen, ersetze, liste, entscheide, offenAnzahl, protokoll, REGISTRY };
