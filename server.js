'use strict';
// Localhost-Server: liefert die Oberflaeche und die Auswertungen als JSON.
// Bindet bewusst nur an 127.0.0.1 und hat keine Anmeldung, weil er nicht
// ins Netz gehoert. Fuer die Einbettung als iframe ist das ausreichend.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

// Ohne config.json bricht der require-Baum mit MODULE_NOT_FOUND ab. Das sieht
// nach einem Programmfehler aus, ist aber ein vergessener Einrichtungsschritt.
if (!fs.existsSync(path.join(__dirname, 'config.json'))) {
  console.error('config.json fehlt. Zum Einrichten die Vorlage kopieren:\n'
    + '  copy config.example.json config.json   (Windows)\n'
    + '  cp config.example.json config.json     (macOS/Linux)\n'
    + 'Danach mindestens "jsonlDir" auf das Verzeichnis der Claude-Code-Logs setzen.');
  process.exit(1);
}

const config = require('./config.json');
const dbmod = require('./db');
const ingest = require('./ingest');
const backfill = require('./backfill');
const metrics = require('./metrics');
const pricing = require('./pricing');
const jira = require('./jira-sync');
const rechnung = require('./rechnung');
const erechnung = require('./erechnung');
const angebot = require('./angebot');
const kontakte = require('./kontakte');
const zeit = require('./zeit');
const kalender = require('./kalender');
const cira = require('./cira');
const modelle = require('./modelle');
const freigaben = require('./freigaben');
const claude = require('./claude');
const sitzungen = require('./sitzungen');
const { vorgangLog } = sitzungen;
const ablauf = require('./ablauf');
const board = require('./board');
const werkzeuge = require('./werkzeuge');
const ereignisse = require('./ereignisse');
const geraete = require('./geraete');
const vault = require('./vault');
const gedaechtnis = require('./gedaechtnis');
const briefings = require('./briefings');
const merken = require('./merken');
const crypto = require('node:crypto');

const db = dbmod.open();
// Altrechnungen ohne Faelligkeitstag einmal festschreiben (Ampel, Druck).
try { rechnung.faelligFestschreiben(db); } catch (e) { console.error('Faelligkeit festschreiben:', e); }
const PUBLIC = path.join(__dirname, 'public');
// Cira (C2): Router, Freigaben und Ereignis-Strom. Bucht ueber dieselbe
// Funktion wie /api/buchen.
// C9: Vault (Briefings, Gedaechtnis, „Merke dir“). Der Ordner kommt nur aus dem
// Arbeitsbereich der Art vault in config.json; fehlt er, bleibt alles leer.
function vaultPfad() {
  const a = arbeitsbereiche().find((x) => x.art === 'vault' && typeof x.pfad === 'string' && x.pfad.trim());
  const p = a ? ingest.loeseHeim(a.pfad) : null;
  return p && fs.existsSync(p) ? p : null;
}
const vaultCfg = () => (config.vault && typeof config.vault === 'object' ? config.vault : {});
// Die Dienste greifen lazy auf ciraDienst zu: der braucht umgekehrt „merken“ und den Briefing-Kontext.
const gedaechtnisDienst = gedaechtnis.erzeuge({ db, vaultPfad, gruppenEigen: () => vaultCfg().gruppen || [],
  ausText: (o) => ciraDienst.ausText(o), abrechnung: () => rechnung.abrechnung(db) });
const briefingDienst = briefings.erzeuge({ db, vaultPfad, ordnerName: () => vaultCfg().briefingsOrdner || 'Briefings',
  quellenEigen: () => vaultCfg().quellen || [], ausText: (o) => ciraDienst.ausText(o), bereiche: () => arbeitsbereiche() });
const merkDienst = merken.erzeuge({ db, vaultPfad, gedaechtnis: gedaechtnisDienst, ausText: (o) => ciraDienst.ausText(o),
  t2Lauf: (o) => ciraDienst.t2Lauf(o), bereiche: () => arbeitsbereiche() });
const ciraDienst = cira.erzeuge({ db, bucheVorgang, skillOrte: (b) => skillOrte(b), merken: merkDienst,
  kontextQuellen: { briefing: (id) => briefingDienst.kontextFakten(id) } });
// Im 30-s-Takt: Index nachziehen, Monatsbericht pruefen. Wirft nie.
// Derselbe Fehler steht einmal im Protokoll, nicht alle 30 s; in der Oberflaeche zeigt /api/vault ihn.
const vaultFehler = { index: null, monatsbericht: null };
function vaultTakt() {
  const lauf = (k, fn) => {
    try { fn(); vaultFehler[k] = null; } catch (err) {
      if (vaultFehler[k] !== err.message) console.error('Vault ' + k + ':', err);
      vaultFehler[k] = err.message;
    }
  };
  lauf('index', () => gedaechtnisDienst.indexiere());
  lauf('monatsbericht', () => briefingDienst.takt());
}

// Stellt eine Rechnung: ein Weg fuer den Beleg-Editor (POST /api/rechnung)
// und die Freigabe "Rechnungsentwurf" (C4), damit beide dasselbe tun.
function stelleRechnung(dbx, daten) {
  // Die Pruefung gehoert hierher und nicht in rechnung.js: dort waere
  // ein require auf kontakte.js ein Kreis ueber angebot.js.
  const kid = kontakte.pruefeId(dbx, daten.kontaktId);
  const inv = rechnung.erstelle(dbx, { ...daten, kontaktId: kid });
  // Ab hier ist die Rechnung geschrieben. Was danach scheitert, darf
  // nicht als Absage zurueckgehen — der Aufrufer hielte sie fuer nicht
  // erstellt, und ein zweiter Versuch zoege eine zweite Nummer.
  let erechnungFehlt = [];
  try {
    // Wer eine Rechnung bekommt, ist kein Lead mehr.
    kontakte.macheKunde(dbx, kid);
    // Gleich sagen, was der E-Rechnung fehlt: eine gestellte Rechnung
    // laesst sich nicht mehr ergaenzen, nur stornieren.
    erechnungFehlt = erechnung.pruefe(inv);
  } catch (err) {
    console.error('Nach dem Erstellen von', inv.nr, err);
  }
  return { nr: inv.nr, brutto_eur: inv.brutto_eur, erechnung_fehlt: erechnungFehlt };
}
// Freigabe "rechnung": die Nutzlast hat Cira gebaut (cira.rechnungsEntwurf);
// erwartetBrutto ist Pflicht, sonst stellte ein Klick etwas anderes als gezeigt.
const RECHNUNG_NUTZLAST = ['from', 'to', 'tickets', 'projekte', 'eintraege', 'empfaenger', 'kontaktId', 'erwartetBrutto'];
freigaben.registriere('rechnung', (dbx, n, { freigabe } = {}) => {
  if (!n || typeof n !== 'object' || typeof n.erwartetBrutto !== 'number') throw new Error('Rechnungsentwurf ohne erwarteten Betrag. Entwurf neu anfordern.');
  try {
    return stelleRechnung(dbx, Object.fromEntries(RECHNUNG_NUTZLAST.filter((k) => Object.hasOwn(n, k)).map((k) => [k, n[k]])));
  } catch (err) {
    // Abweichung oder Ueberschneidung: nichts gestellt, Freigabe bleibt offen.
    // Derselbe Klick scheitert wieder; der Weg heraus ist ein neuer Entwurf.
    if (err.abweichung) {
      err.status = 409;
      if (freigabe && freigabe.bezug) err.message += ' Neuen Entwurf anfordern: „Rechnung für ' + freigabe.bezug + '“.';
    }
    throw err;
  }
});
// Freigabe "jira_kommentar" (C7a): ein von Cira entworfener Kommentar geht erst
// nach der Freigabe an Jira. Selbst getippte Kommentare im Board gehen direkt.
freigaben.registriere('jira_kommentar', async (dbx, n) => {
  if (!n || typeof n.key !== 'string' || typeof n.text !== 'string' || !n.text.trim()) throw new Error('Kommentar-Entwurf unvollständig.');
  if (!jira.jiraAn()) { const e = new Error('Jira ist aus oder ohne Zugang.'); e.status = 409; throw e; }
  await jira.kommentiere(n.key, n.text.slice(0, 4000));
  return { key: n.key };
});

let lastIngest ={ at: null, ms: 0, events: 0, error: null };
let ingesting = false;

// Kennung des laufenden Programmstands. Der Server haelt seinen Code im
// Speicher: wird server.js geaendert, laeuft der alte Stand weiter, bis der
// Dienst neu startet. Die Oberflaeche kann dann Felder anfordern, die es beim
// laufenden Server noch nicht gibt — sichtbar wird das als 404 an einer Stelle,
// die eben noch ging. Aus dem letzten Aenderungszeitpunkt der Programmdateien
// entsteht deshalb eine Kennung, an der die Oberflaeche einen Versionssprung
// erkennt und zum Neuladen auffordert, statt einen Fehler zu zeigen.
// Die Oberflaeche liefert der Server direkt aus public/ aus: eine geaenderte
// Datei dort gilt ohne Neustart, ein offener Tab hat aber noch die alte.
// Deshalb wird public/ bei jeder Abfrage neu gelesen, der Servercode nur beim
// Start (ohne Neustart hilft Neuladen dort nicht).
function neuesteAenderung(dateien) {
  let neuestes = 0;
  for (const d of dateien) {
    try { neuestes = Math.max(neuestes, fs.statSync(path.join(__dirname, d)).mtimeMs); } catch { /* fehlt: egal */ }
  }
  return neuestes;
}
const SERVER_STAND = neuesteAenderung(['server.js', 'metrics.js', 'rechnung.js', 'erechnung.js', 'angebot.js', 'ingest.js']);
function codeStand() {
  const dateien = ['public/index.html'];
  // Die Oberflaeche besteht aus mehreren Dateien; eine Festliste wuerde
  // bei jeder neuen Datei veralten.
  try {
    for (const d of fs.readdirSync(path.join(__dirname, 'public', 'app'))) dateien.push('public/app/' + d);
  } catch { /* Ordner fehlt: egal */ }
  return String(Math.round(Math.max(SERVER_STAND, neuesteAenderung(dateien))));
}

// Der Abgleich laeuft im Hintergrund weiter, damit die Oberflaeche ohne
// Zutun aktuell bleibt. Dank gemerkter Leseposition kostet ein Lauf
// nur wenige Millisekunden.
// Rechnet offene Zeiteintraege mit dem aktuellen Stand der Sitzungen und
// Einstellungen nach. Infinity = alle offenen: nach einer Aenderung an
// Zeitmodell, Pausenschwelle, Rundung oder Taetigkeit gilt sie auch fuer
// aeltere Eintraege, nicht nur fuer die Sitzungsseite. Gibt einen Hinweistext
// zurueck oder null.
function zeitNachrechnen(seitStunden = Infinity) {
  try {
    zeit.nachrechnen(db, { seitStunden });
    return null;
  } catch (err) {
    console.error('Zeiteintraege nachrechnen fehlgeschlagen:', err);
    return 'Zeiteinträge nicht nachgerechnet, Details im Serverprotokoll';
  }
}

// Erinnerung bei Blocker-Beginn: eigener Takt, damit ein langer oder
// fehlgeschlagener Ingest sie nicht auslaesst. Auch ohne Kalenderkonto (lokale
// Blocker). Wirft nie.
function erinnern() {
  try { kalender.erinnerungen(db); } catch (err) { console.error('Erinnerungen fehlgeschlagen:', err); }
}

async function refreshData() {
  if (ingesting) return;
  ingesting = true;
  try {
    const res = await ingest.run({ db });
    // Muss direkt hinter das Einlesen: dessen UPSERT setzt ticket bei jedem
    // erneuten Lesen einer Datei auf die Branch-Zuordnung zurueck. Der
    // Backfill stellt die nachtraegliche Zuordnung sofort wieder her.
    backfill.run({ db });
    // Neue Sitzungsdaten koennen Zeiteintraege der letzten 48 h ueberlappen.
    // Ein Fehler hier ist kein Fehler beim Einlesen, aber er bleibt sichtbar.
    const zeitFehler = zeitNachrechnen(48);
    // Kalender je Konto alle 5 Minuten. Nicht abwarten: ein langsamer Kalender
    // haelt sonst den Ingest auf. takt() wirft nie und laeuft nie doppelt.
    kalender.takt(db).catch((err) => console.error('Kalender-Takt:', err));
    lastIngest ={ at: new Date().toISOString(), ms: res.ms, events: res.events, error: null, zeit_fehler: zeitFehler };
    // Hat jemand die Oberflaeche offen, rechnet der Takt die Zeit vor, statt
    // den naechsten Klick warten zu lassen (Block L). Ohne neue Daten nur ein
    // Stand-Vergleich. Ein Fehler hier ist kein Fehler beim Einlesen.
    if (ereignisse.offen() > 0) {
      try { metrics.vorrechnen(db); } catch (err) { console.error('Vorrechnen fehlgeschlagen:', err); }
    }
  } catch (err) {
    // Vollstaendig ins Protokoll, nach aussen nur ein Hinweis: Fehlertexte
    // aus dem Dateisystem enthalten Pfade und gehen ueber die Schnittstelle raus.
    console.error('Einlesen fehlgeschlagen:', err);
    lastIngest = {
      at: new Date().toISOString(), ms: 0, events: 0,
      error: 'Einlesen fehlgeschlagen, Details im Serverprotokoll',
    };
  } finally {
    ingesting = false;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendText(res, text, status = 200, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(text);
}

// CSP fuer die Seiten aus public/: Skripte nur aus eigenen Dateien, dazu das
// eine Inline-Skript der Seite per Hash (<script>start();</script>,
// selfcheck prueft den Hash). Einbetten nur selbst und in Obsidian: seit das
// Geraetecookie auch in Einbettungen gilt, koennte eine fremde Seite c2invoice
// sonst im Frame koppeln lassen und Klicks unterschieben (Review 1008786).
// Nur fuer HTML — object-src 'none' auf einer PDF-Antwort legte Chromes Anzeige lahm.
const CSP = "default-src 'self'; script-src 'self' 'sha256-E6jQvrT2ZivWG9GJ4AAEZf4MhI7l3QkLroW4hgvUT4c='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; " +
  "frame-ancestors 'self' app://obsidian.md capacitor://localhost";

// Statische Dateien nur aus dem public-Ordner ausliefern.
function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const full = path.join(PUBLIC, rel);
  // Trennzeichen anhaengen, damit ein Nachbarordner mit gleichem Namensanfang
  // die Pruefung nicht besteht.
  if (full !== PUBLIC && !full.startsWith(PUBLIC + path.sep)) {
    return sendText(res, 'Verboten', 403);
  }
  fs.readFile(full, (err, buf) => {
    if (err) return sendText(res, 'Nicht gefunden', 404);
    // no-cache: der Browser fragt jedes Mal nach. Ohne Angabe haelt er
    // Skripte heuristisch zwischen und mischt nach einem Update alte und neue.
    const kopf = { 'content-type': MIME[path.extname(full)] || 'application/octet-stream', 'cache-control': 'no-cache' };
    if (path.extname(full) === '.html') kopf['content-security-policy'] = CSP;
    res.writeHead(200, kopf);
    res.end(buf);
  });
}

// Anfragekoerper einlesen, mit Groessenbegrenzung.
function leseKoerper(req, fertig) {
  let roh = '';
  let zuGross = false;
  req.on('data', (stueck) => {
    if (zuGross) return;
    roh += stueck;
    if (roh.length > 64 * 1024) {
      zuGross = true;
      fertig('Anfrage zu gross');
    }
  });
  req.on('end', () => {
    if (zuGross) return;
    try {
      fertig(null, JSON.parse(roh || '{}'));
    } catch {
      fertig('Ungueltige Daten');
    }
  });
  req.on('error', () => fertig('Uebertragung fehlgeschlagen'));
}

// Rahmen fuer POST-Routen: Koerper lesen, Funktion ausfuehren, Ergebnis mit
// ok:true, jeder Fehler als 400 mit seinem deutschen Text. Ein leerer oder
// nicht-objektartiger Koerper kommt als {} an, nie als null.
function antworte(req, res, fn) {
  return leseKoerper(req, (fehler, daten) => {
    if (fehler) return sendJson(res, { error: fehler }, 400);
    try {
      return sendJson(res, { ok: true, ...fn(daten && typeof daten === 'object' && !Array.isArray(daten) ? daten : {}) });
    } catch (err) {
      return sendJson(res, { error: err.message }, 400);
    }
  });
}

// Setzt Satz und/oder Rabatt eines Projekts und schreibt die Konfiguration.
// Beides zusammen ist erlaubt: der Rabatt wirkt dann auf den eigenen Satz.
// Daneben steht das Zeitmodell des Projekts; ohne Wahl gilt der Standard.
// Der Eintrag wird als Ganzes ersetzt. Ausnahme Zeitmodell: fehlt das Feld
// ganz, bleibt die bisherige Wahl stehen — leer ("" oder null) setzt zurueck.
// Sonst loeschte jede Satzaenderung aus einer Oberflaeche, die die Wahl nicht
// geladen hat, still das Zeitmodell des Projekts.
const VERBOTENE_SCHLUESSEL = ['__proto__', 'constructor', 'prototype'];

// Zahl aus einer Anfrage: nur eine echte Zahl oder ein Dezimaltext. Number(' '),
// Number([]) und Number(false) ergaeben sonst 0, Number(true) 1 — und laegen
// in jeder Grenze; '0x10' und '1e3' sind keine Eingabe aus einem Formular.
// Alles andere wird NaN und faellt in der Pruefung durch.
function alsZahl(w) {
  if (typeof w === 'number') return w;
  return typeof w === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(w) ? Number(w) : NaN;
}

function setzeSatz({ projekt, satz, rabatt, kunde, zeitmodell, rundung }) {
  if (typeof projekt !== 'string' || !projekt.trim()) {
    throw new Error('Projektname fehlt.');
  }
  // Der Name wird Schluessel in config.projektSaetze. "__proto__" saetze dort
  // den Prototyp statt einen Eintrag anzulegen.
  if (VERBOTENE_SCHLUESSEL.includes(projekt)) throw new Error('Projektname nicht zulaessig.');
  // Der Name wird Schluessel in config.json, der Kunde steht auf Belegen: beide begrenzt.
  if (projekt.length > 200) throw new Error('Projektname: hoechstens 200 Zeichen.');
  if (typeof kunde === 'string' && kunde.trim().length > 200) throw new Error('Kunde: hoechstens 200 Zeichen.');
  const eintrag = {};
  if (zeitmodell === undefined) {
    const bisher = config.projektSaetze && Object.hasOwn(config.projektSaetze, projekt)
      ? config.projektSaetze[projekt].zeitmodell : undefined;
    if (bisher) eintrag.zeitmodell = bisher;
  } else if (zeitmodell !== null && zeitmodell !== '') {
    if (!ZEITMODELLE.includes(zeitmodell)) throw new Error('Zeitmodell: nur ' + ZEITMODELLE.join(' oder ') + '.');
    eintrag.zeitmodell = zeitmodell;
  }
  // Rundung manueller Zeit je Projekt, wie das Zeitmodell: fehlt das Feld,
  // bleibt die bisherige Wahl; leer setzt auf den Standard zurueck.
  if (rundung === undefined) {
    const bisher = config.projektSaetze && Object.hasOwn(config.projektSaetze, projekt)
      ? config.projektSaetze[projekt].rundung : undefined;
    if (bisher) eintrag.rundung = bisher;
  } else if (rundung !== null && rundung !== '') {
    const n = typeof rundung === 'number' ? rundung : typeof rundung === 'string' && /^\s*\d+\s*$/.test(rundung) ? Number(rundung) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > 60) throw new Error('Rundung: ganze Minuten von 1 bis 60.');
    eintrag.rundung = n;
  }

  if (satz !== null && satz !== undefined && satz !== '') {
    const n = alsZahl(satz);
    if (!Number.isFinite(n) || n < 0) throw new Error('Stundensatz muss eine Zahl ab 0 sein.');
    eintrag.satz = Math.round(n * 100) / 100;
  }
  if (rabatt !== null && rabatt !== undefined && rabatt !== '') {
    const n = alsZahl(rabatt);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error('Rabatt muss zwischen 0 und 100 liegen.');
    }
    eintrag.rabatt = Math.round(n * 100) / 100;
  }
  if (typeof kunde === 'string' && kunde.trim()) eintrag.kunde = kunde.trim();

  if (!config.projektSaetze) config.projektSaetze = {};
  if (Object.keys(eintrag).length === 0) {
    // Nichts gesetzt heisst: zurueck auf den Standardsatz.
    delete config.projektSaetze[projekt];
  } else {
    config.projektSaetze[projekt] = eintrag;
  }

  schreibeConfig();
  return { projekt, ...metrics.satzFuerProjekt(projekt), zeitmodell: eintrag.zeitmodell || null, rundung: eintrag.rundung || null };
}

// Zeitmodell eines Vorgangs oder einer Sitzung. Leer heisst: keine eigene
// Wahl mehr, es gilt wieder Projekt bzw. Standard. Nur bekannte Vorgaenge und
// Sitzungen — eine Wahl fuer einen Tippfehler stuende sonst still herum.
function setzeZeitmodell(db, { art, schluessel, zeitmodell } = {}) {
  if (art !== 'vorgang' && art !== 'sitzung') throw new Error('Art: nur vorgang oder sitzung.');
  const leer = zeitmodell === null || zeitmodell === undefined || zeitmodell === '';
  if (!leer && !ZEITMODELLE.includes(zeitmodell)) {
    throw new Error('Zeitmodell: nur ' + ZEITMODELLE.join(' oder ') + '.');
  }
  if (typeof schluessel !== 'string' || !schluessel.trim() || schluessel.length > 200) {
    throw new Error(art === 'sitzung' ? 'Sitzungskennung fehlt.' : 'Vorgang fehlt.');
  }
  const k = schluessel.trim();
  const spalte = art === 'sitzung' ? 'session_id' : 'ticket';
  if (!db.prepare('SELECT 1 FROM events WHERE ' + spalte + ' = ? LIMIT 1').get(k)) {
    throw new Error(art === 'sitzung' ? 'Unbekannte Sitzung.' : 'Unbekannter Vorgang.');
  }
  if (leer) {
    db.prepare('DELETE FROM zeitmodell_wahl WHERE art = ? AND schluessel = ?').run(art, k);
  } else {
    db.prepare(
      'INSERT INTO zeitmodell_wahl (art, schluessel, zeitmodell) VALUES (?,?,?) ' +
      'ON CONFLICT(art, schluessel) DO UPDATE SET zeitmodell = excluded.zeitmodell'
    ).run(art, k, zeitmodell);
  }
  return { art, schluessel: k, zeitmodell: leer ? null : zeitmodell };
}

// Eine Sitzung von Hand auf einen Vorgang buchen. Deckt die Arbeit ab, die
// keinen Ticket-Branch traegt: eigene Ordner, dev, Worktrees mit abgeloestem
// HEAD. Der Vorgang muss kein Jira-Ticket sein — ein frei benannter Name
// reicht, damit die Arbeit auf einer Rechnung erscheint.
//
// Der Name landet woertlich auf einem Dokument nach § 14 UStG, deshalb eng
// begrenzt: keine Leerzeichen, keine Sonderzeichen ausser . _ -, hoechstens
// 40 Zeichen. Gross geschrieben wird nur hier, damit PROJ-1 und proj-1 nicht
// als zwei Vorgaenge nebeneinander stehen; der Backfill selbst schreibt
// unveraendert durch.
const VORGANG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;

function bucheVorgang(db, { session_id, vorgang }) {
  if (typeof session_id !== 'string' || !session_id.trim() || session_id.length > 200) {
    throw new Error('Sitzungskennung fehlt.');
  }
  const sid = session_id.trim();
  const roh = typeof vorgang === 'string' ? vorgang.trim() : '';

  // Der Vorgang wird zuerst geprueft: ein Tippfehler dort ist der haeufigere
  // Fall, und "Unbekannte Sitzung" als Antwort darauf schickt die Fehlersuche
  // in die falsche Richtung.
  if (roh && !VORGANG_RE.test(roh)) {
    throw new Error('Vorgang: 2 bis 40 Zeichen, erlaubt sind Buchstaben, Ziffern, Punkt, Unterstrich und Bindestrich.');
  }

  const bekannt = db.prepare('SELECT 1 FROM events WHERE session_id = ? LIMIT 1').get(sid);
  if (!bekannt) throw new Error('Unbekannte Sitzung.');

  if (roh) {
    const ticket = roh.toUpperCase();
    db.prepare(
      'INSERT INTO overrides (session_id, ticket, note, created_at) VALUES (?,?,?,?) ' +
      'ON CONFLICT(session_id) DO UPDATE SET ticket = excluded.ticket, ' +
      'note = excluded.note, created_at = excluded.created_at'
    ).run(sid, ticket, 'manuell via UI', new Date().toISOString());
    backfill.run({ db });
    return { session_id: sid, ticket };
  }

  // Loeschen: der Eintrag allein zu entfernen reicht nicht. Das Einlesen merkt
  // sich die Leseposition je Datei und schreibt bereits gelesene Ereignisse
  // nie erneut — die gebuchte Zuordnung bliebe also stehen. Sie wird deshalb
  // hier zurueckgenommen und die Branch-Zuordnung neu abgeleitet, danach
  // greifen die uebrigen Backfill-Stufen wieder wie bei einem frischen Lauf.
  db.prepare('DELETE FROM overrides WHERE session_id = ?').run(sid);
  for (const tabelle of ['events', 'activity']) {
    db.prepare(
      'UPDATE ' + tabelle + ' SET ticket = NULL, ticket_quelle = NULL ' +
      "WHERE session_id = ? AND ticket_quelle = 'override'"
    ).run(sid);
  }
  const branches = db.prepare(
    'SELECT DISTINCT branch FROM events WHERE session_id = ? AND branch IS NOT NULL'
  ).all(sid);
  for (const { branch } of branches) {
    const ticket = ingest.ticketOf(branch);
    if (!ticket) continue;
    db.prepare(
      'UPDATE events SET ticket = ?, ticket_quelle = NULL WHERE session_id = ? AND branch = ? AND ticket IS NULL'
    ).run(ticket, sid, branch);
    db.prepare(
      'UPDATE activity SET ticket = ?, ticket_quelle = NULL WHERE session_id = ? AND ticket IS NULL'
    ).run(ticket, sid);
  }
  backfill.run({ db });
  const jetzt = db.prepare('SELECT ticket FROM events WHERE session_id = ? LIMIT 1').get(sid);
  return { session_id: sid, ticket: (jetzt && jetzt.ticket) || null };
}

// Einstellungen, die ueber die Oberflaeche aenderbar sind. Grenzen bewusst
// eng: ein Tippfehler wie 8500 statt 85 wuerde sonst jede Auswertung
// unbrauchbar machen, und der Fehler faellt erst Wochen spaeter auf.
const EINSTELLUNGEN = {
  stundensatz: { min: 0, max: 10000, label: 'Standard-Stundensatz' },
  selbstkostenStunde: { min: 0, max: 10000, label: 'Selbstkostensatz je Stunde' },
  zielmargeProzent: { min: 0, max: 100, label: 'Zielmarge in Prozent' },
  aboPreisMonat: { min: 0, max: 100000, label: 'Abo-Preis je Monat' },
  usdToEur: { min: 0.01, max: 100, label: 'Umrechnungskurs USD zu EUR' },
  gapMinutes: { min: 1, max: 240, label: 'Pausenschwelle in Minuten' },
  // Obergrenze bewusst niedrig: die Studienlage traegt keinen hohen Faktor.
  // Unabhaengige Messungen reichen von langsamer (METR 2025: -19 %) bis
  // deutlich schneller; und selbst der optimistischste Wert misst nur das
  // Schreiben von Code, das rund ein Drittel der Entwicklungszeit ausmacht.
  // Wer hier 3 eintraegt, behauptet etwas, das er nicht belegen kann — und
  // die Zahl steht am Ende beim Kunden. 0 schaltet die Kennzahl ab.
  vergleichsFaktor: { min: 1, max: 1.5, aus: 0, label: 'Vergleichsfaktor klassische Entwicklung' },
  // Zeiterfassung. Das Tagessoll ist Massstab fuer "Arbeitszeit heute" und den
  // Workload, die Rundung gilt fuer Projekte ohne eigene (ganze Minuten,
  // aufgerundet; die Rohzeit bleibt gespeichert).
  // standard = was zeit.js ohne Eintrag in config.json rechnet (sollMin, rundungFuer) —
  // sonst zeigte die Oberflaeche ein leeres Feld, waehrend 8 h bzw. 5 Min gelten.
  tagessollStunden: { min: 0, max: 24, label: 'Tagessoll in Stunden', standard: 8 },
  rundungMinuten: { min: 1, max: 60, ganz: true, label: 'Rundung manueller Zeit in Minuten', standard: 5 },

  // Lokale Modelle. `pfad` legt das Feld unter config.lokaleModelle ab statt
  // auf oberster Ebene — Endpunkt und Grenzen bleiben dieselben.
  // Nicht aenderbar bleiben Adresse und Port des Modellservers: sie oeffnen
  // einen Zugang, statt nur eine Zahl zu beschriften. Die gehoeren in die
  // Datei, wie die Jira-Zugangsdaten auch.
  lokalEurProMioTokens: {
    min: 0, max: 1000, pfad: 'lokaleModelle.eurProMioTokens',
    label: 'Pauschale je Million Tokens (lokale Modelle)',
  },
  lokalSelbstkostenStunde: {
    min: 0, max: 100, pfad: 'lokaleModelle.selbstkostenEurProStunde',
    label: 'Selbstkosten je Stunde lokaler Rechenzeit',
  },
  lokalZuordnungsfenster: {
    min: 1, max: 480, pfad: 'lokaleModelle.zuordnungsfensterMinuten',
    label: 'Zuordnungsfenster lokaler Modelle in Minuten',
  },
  // 5-h-Block in der Cira-Karte (metrics.block5h). Anthropic nennt kein Limit
  // in Tokens; der Nutzer setzt es aus Erfahrung. 0 blendet die Anzeige aus.
  limit5hTokens: { min: 1000, max: 1e12, aus: 0, ganz: true, label: 'Token-Limit je 5-h-Fenster' },
};

// Die einzige Einstellung mit festen Auswahlwerten statt einer Zahl. Sie
// entscheidet, welche Zeit abgerechnet wird (siehe metrics.js).
const ZEITMODELLE = metrics.ZEITMODELLE;

function setzeEinstellungen(daten) {
  if (!daten || typeof daten !== 'object') throw new Error('Keine Daten empfangen.');
  const geaendert = {};

  // Vor allem anderen pruefen, erst nach den Zahlen uebernehmen: scheitert ein
  // anderes Feld derselben Eingabe, darf das Zeitmodell nicht schon umgestellt sein.
  const zeitmodell = daten.zeitmodell === undefined || daten.zeitmodell === null || daten.zeitmodell === ''
    ? null : daten.zeitmodell;
  if (zeitmodell !== null && !ZEITMODELLE.includes(zeitmodell)) {
    throw new Error('Zeitmodell: nur ' + ZEITMODELLE.join(' oder ') + '.');
  }

  for (const [feld, regel] of Object.entries(EINSTELLUNGEN)) {
    const wert = daten[feld];
    if (wert === undefined || wert === null || wert === '') continue;
    const n = alsZahl(wert);
    if (!Number.isFinite(n)) throw new Error(regel.label + ': keine gueltige Zahl.');
    // Manche Felder kennen einen Aus-Wert ausserhalb ihres Gueltigkeitsbereichs:
    // ein Vergleichsfaktor muss ueber 1 liegen, um sinnvoll zu sein, soll sich
    // aber mit 0 ganz abschalten lassen.
    const abgeschaltet = regel.aus !== undefined && n === regel.aus;
    if (regel.ganz && !Number.isInteger(n)) throw new Error(regel.label + ': ganze Zahl erwartet.');
    if (!abgeschaltet && (n < regel.min || n > regel.max)) {
      throw new Error(
        `${regel.label}: muss zwischen ${regel.min} und ${regel.max} liegen` +
        (regel.aus !== undefined ? ` (oder ${regel.aus} zum Abschalten).` : '.')
      );
    }
    // Auf zwei Nachkommastellen, sonst stehen Fliesskomma-Reste in der Datei.
    geaendert[feld] = Math.round(n * 100) / 100;
  }
  // Erst alles pruefen, dann uebernehmen: sonst stuende ein gueltiges Feld schon
  // im Speicher, waehrend ein spaeteres die Eingabe abweist.
  for (const [feld, wert2] of Object.entries(geaendert)) {
    const regel = EINSTELLUNGEN[feld];
    if (regel.pfad) {
      const [gruppe, schluessel] = regel.pfad.split('.');
      if (!config[gruppe] || typeof config[gruppe] !== 'object') config[gruppe] = {};
      config[gruppe][schluessel] = wert2;
    } else {
      config[feld] = wert2;
    }
  }

  if (zeitmodell !== null) {
    config.zeitmodell = zeitmodell;
    geaendert.zeitmodell = zeitmodell;
  }

  if (Object.keys(geaendert).length === 0) throw new Error('Kein bekanntes Feld uebergeben.');
  schreibeConfig();
  return geaendert;
}

// Rechnungs-Stammdaten. Sie landen auf einem Dokument, das beim Kunden liegt,
// deshalb dieselbe Strenge wie bei den Zahlen: Whitelist statt Durchreichen und
// eine Laengengrenze je Feld. Ohne sie nimmt der Endpunkt beliebig lange
// Zeichenketten an, und das Dokument bricht erst beim Drucken auseinander.
// `typ` unterscheidet die Behandlung: Text, Zeilenliste (Anschrift), Zahl,
// Schalter. Verschachtelt unter config.rechnung bzw. config.rechnung.aussteller.
const STAMMDATEN = {
  name: { typ: 'text', max: 120, label: 'Name oder Firma', pflicht: true },
  anschrift: { typ: 'zeilen', max: 120, zeilen: 6, label: 'Anschrift', pflicht: true },
  steuernummer: { typ: 'text', max: 40, label: 'Steuernummer' },
  ustIdNr: { typ: 'text', max: 40, label: 'USt-IdNr.' },
  bank: { typ: 'text', max: 80, label: 'Bank' },
  iban: { typ: 'iban', max: 40, label: 'IBAN' },
  bic: { typ: 'text', max: 11, label: 'BIC' },
  // Nur fuer die E-Rechnung noetig: die Norm verlangt eine Kontaktstelle des
  // Ausstellers mit E-Mail und Telefon sowie das Land als Kuerzel.
  email: { typ: 'email', max: 120, label: 'E-Mail' },
  telefon: { typ: 'text', max: 40, label: 'Telefon' },
  land: { typ: 'land', max: 2, label: 'Land' },
  kleinunternehmer: { typ: 'schalter', label: 'Kleinunternehmer nach Par. 19 UStG', wurzel: true },
  ustSatz: { typ: 'zahl', min: 0, max: 30, label: 'Umsatzsteuersatz in Prozent', wurzel: true },
  zahlungszielTage: { typ: 'zahl', min: 0, max: 120, label: 'Zahlungsziel in Tagen', wurzel: true },
};

// Grobpruefung, keine Pruefsummenrechnung: Laenge und Zeichenvorrat. Ein
// Zahlendreher faellt damit nicht auf, ein vertippter Buchstabensalat schon.
const IBAN_RE = /^[A-Z]{2}[0-9A-Z]{13,32}$/;

// Stammdaten stehen auf jeder Rechnung. Ein Steuerzeichen oder U+FFFD (Text in
// falscher Kodierung eingefuegt) ginge sonst ins Dokument; die E-Rechnung
// filtert sie, PDF und Druckansicht nicht.
const UNLESBAR_RE = /[\u0000-\u001f\u007f\ufffd]/;
function lesbar(regel, s) {
  if (UNLESBAR_RE.test(s)) throw new Error(regel.label + ': enthält Steuerzeichen oder ein Ersatzzeichen (\ufffd) — bitte neu eintippen.');
  return s;
}

// Wo ein Feld hingehoert: die Steuerangaben am Rechnungsblock, alles
// Personenbezogene beim Aussteller.
function stammZiel(regel) {
  if (!config.rechnung) config.rechnung = {};
  if (regel.wurzel) return config.rechnung;
  if (!config.rechnung.aussteller) config.rechnung.aussteller = {};
  return config.rechnung.aussteller;
}

function setzeStammdaten(daten) {
  if (!daten || typeof daten !== 'object') throw new Error('Keine Daten empfangen.');
  const geaendert = {};
  // Erst alles pruefen, dann uebernehmen. Wuerde jedes Feld sofort gesetzt,
  // stuende nach einer abgelehnten Eingabe die Haelfte schon im Speicher —
  // und ginge von dort in die naechste Rechnung, obwohl die Oberflaeche
  // "nicht gespeichert" gemeldet hat.
  const vorgemerkt = [];

  for (const [feld, regel] of Object.entries(STAMMDATEN)) {
    if (!(feld in daten)) continue;
    const roh = daten[feld];
    if (roh === undefined || roh === null) continue;
    const ziel = stammZiel(regel);
    let wert;

    if (regel.typ === 'schalter') {
      // Nur echte Wahrheitswerte: aus dem Text 'false' machte !! sonst 'an'.
      if (typeof roh !== 'boolean') throw new Error(regel.label + ': an oder aus (true/false) erwartet.');
      wert = roh;
    } else if (regel.typ === 'zahl') {
      if (roh === '') continue;
      const n = alsZahl(roh);
      if (!Number.isFinite(n)) throw new Error(regel.label + ': keine gueltige Zahl.');
      if (n < regel.min || n > regel.max) {
        throw new Error(`${regel.label}: muss zwischen ${regel.min} und ${regel.max} liegen.`);
      }
      wert = Math.round(n * 100) / 100;
    } else if (regel.typ === 'zeilen') {
      // Aus dem Textfeld kommt ein Block, gespeichert wird eine Zeilenliste —
      // die Rechnung setzt daraus die Adresszeilen.
      const zeilen = (Array.isArray(roh) ? roh : String(roh).split('\n'))
        .map((z) => String(z).trim())
        .filter(Boolean);
      if (zeilen.length > regel.zeilen) {
        throw new Error(`${regel.label}: hoechstens ${regel.zeilen} Zeilen.`);
      }
      for (const z of zeilen) {
        lesbar(regel, z);
        if (z.length > regel.max) throw new Error(`${regel.label}: hoechstens ${regel.max} Zeichen je Zeile.`);
      }
      wert = zeilen;
    } else {
      if (typeof roh !== 'string') throw new Error(regel.label + ': Text erwartet.');
      let s = lesbar(regel, roh.trim());
      if (regel.typ === 'iban') s = s.replace(/\s+/g, '').toUpperCase();
      if (regel.typ === 'land') {
        // Vor der Laengenpruefung: wer "Deutschland" eintippt, soll lesen, was
        // erwartet wird, statt nur "hoechstens 2 Zeichen". Ein ausgeschriebener
        // Laendername ginge sonst woertlich in die E-Rechnung.
        s = s.toUpperCase();
        if (s && !/^[A-Z]{2}$/.test(s)) {
          throw new Error(regel.label + ': zweistelliges Kuerzel erwartet, zum Beispiel DE oder AT.');
        }
      }
      if (s.length > regel.max) throw new Error(`${regel.label}: hoechstens ${regel.max} Zeichen.`);
      if (regel.typ === 'iban' && s && !IBAN_RE.test(s)) throw new Error(regel.label + ': Form nicht plausibel.');
      if (regel.typ === 'email' && s && !s.includes('@')) {
        throw new Error(regel.label + ': Adresse sieht nicht wie eine E-Mail aus.');
      }
      wert = s;
    }
    vorgemerkt.push([ziel, feld, wert]);
    geaendert[feld] = wert;
  }

  if (Object.keys(geaendert).length === 0) throw new Error('Kein bekanntes Feld uebergeben.');
  for (const [ziel, feld, wert] of vorgemerkt) ziel[feld] = wert;
  schreibeConfig();
  // Bewusst kein Abbruch bei fehlenden Pflichtangaben: Stammdaten entstehen
  // schrittweise. Wer eine Rechnung erstellt, laeuft ohnehin in die harte
  // Pruefung aus rechnung.js — hier wird nur gemeldet, was noch aussteht.
  return { geaendert, fehlt: rechnung.fehlendeStammdaten() };
}

// --- E-Rechnung ---------------------------------------------------------------
// Die Antwort auf den Abruf einer E-Rechnung, getrennt vom HTTP-Teil: so laesst
// sie sich gegen eine Testdatenbank pruefen, ohne in der echten eine Rechnung
// anzulegen. Die Nummer prueft rechnung.lade() auf ihre Form, bevor sie
// irgendwo verwendet wird.
function eRechnungAntwort(db, nr) {
  const absage = (status, error) => ({
    status,
    kopf: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    inhalt: JSON.stringify({ error }),
  });
  const inv = rechnung.lade(db, nr);
  if (!inv) return absage(404, 'Rechnung nicht gefunden.');
  try {
    return {
      status: 200,
      kopf: {
        'content-type': 'application/xml; charset=utf-8',
        // attachment: die Datei ist das Rechnungsoriginal fuer den Empfaenger
        // und soll gespeichert werden, nicht im Browser aufgehen.
        'content-disposition': `attachment; filename="Rechnung-${inv.nr}.xml"`,
        'cache-control': 'no-store',
      },
      inhalt: erechnung.alsXml(inv),
    };
  } catch (err) {
    // Fehlende Pflichtangaben sind kein Serverfehler: die Meldung nennt sie.
    if (err.fehlt) return absage(422, err.message);
    throw err;
  }
}

// --- Positionsvorlagen -------------------------------------------------------
// Grenzen wie bei einer freien Angebotsposition (angebot.js): eine Vorlage
// fuellt genau dieses Feld vor, weitere Grenzen dort waeren wirkungslos.
function vorlagenListe(db) {
  return db.prepare('SELECT id, bezeichnung, satz FROM vorlagen ORDER BY bezeichnung COLLATE NOCASE').all();
}

function setzeVorlage(db, daten = {}) {
  if (typeof daten.bezeichnung !== 'string') {
    throw new Error('Bezeichnung: Text erwartet.');
  }
  const bezeichnung = daten.bezeichnung.trim();
  if (!bezeichnung) throw new Error('Bezeichnung fehlt.');
  if (bezeichnung.length > 200) throw new Error('Bezeichnung: hoechstens 200 Zeichen.');

  // Leer bedeutet ausdruecklich "kein eigener Satz", nicht "null Euro" —
  // sonst legte eine Vorlage ohne Angabe stillschweigend Nullzeilen an.
  let satz = null;
  if (daten.satz !== undefined && daten.satz !== null && daten.satz !== '') {
    satz = alsZahl(daten.satz);
    if (!Number.isFinite(satz) || satz < 0 || satz > 10000) {
      throw new Error('Stundensatz muss zwischen 0 und 10000 liegen.');
    }
    satz = Math.round(satz * 100) / 100;
  }

  const id = daten.id === undefined || daten.id === '' ? null : alsZahl(daten.id);
  if (id === null) {
    const info = db.prepare('INSERT INTO vorlagen (bezeichnung, satz) VALUES (?, ?)')
      .run(bezeichnung, satz);
    return { id: Number(info.lastInsertRowid), bezeichnung, satz };
  }
  if (!Number.isInteger(id) || id <= 0) throw new Error('Unbekannte Vorlage.');
  const info = db.prepare('UPDATE vorlagen SET bezeichnung = ?, satz = ? WHERE id = ?')
    .run(bezeichnung, satz, id);
  if (info.changes === 0) throw new Error('Unbekannte Vorlage.');
  return { id, bezeichnung, satz };
}

function loescheVorlage(db, id) {
  const nr = alsZahl(id);
  if (!Number.isInteger(nr) || nr <= 0) throw new Error('Unbekannte Vorlage.');
  const info = db.prepare('DELETE FROM vorlagen WHERE id = ?').run(nr);
  if (info.changes === 0) throw new Error('Unbekannte Vorlage.');
  return true;
}

// Schluessel, die die Oberflaeche aendern kann und schreibeConfig() deshalb
// zurueckschreibt. Felder mit `pfad` liegen in einer Gruppe (lokaleModelle) —
// geschrieben wird die Gruppe, nicht der Feldname. Alles andere in der Datei
// bleibt, wie es dort steht. Jeder Eintrag gehoert auch in config.example.json
// (Gate design/werkzeuge/cira-c0-gates.js config).
const SCHREIBBAR = [...new Set([
  'projektSaetze', 'stundensatz', 'zeitmodell',
  'rechnung',          // Stammdaten (verschachtelt)
  'kalender',          // ICS-Konten aus der Oberflaeche (kalender.verbinde/trenne)
  'arbeitsbereiche',   // Kuerzel, Farbe, Verweise — Pfade aendert nur die Datei
  'cira',              // Einstellungen -> Cira (CIRA_FELDER), feldgenau
  'hook',              // Geheimnis fuer integration/claude-hook.mjs, beim ersten Start erzeugt (C5)
  'vault',             // Einstellungen -> Vault: nur gruppen und quellen (VAULT_FELDER), briefingsOrdner nur in der Datei
  ...Object.entries(EINSTELLUNGEN).map(([feld, r]) => (r.pfad ? r.pfad.split('.')[0] : feld)),
])];

// Die Datei neu schreiben, ohne die uebrigen Einstellungen zu verlieren.
function schreibeConfig() {
  const pfad = path.join(__dirname, 'config.json');
  const roh = JSON.parse(fs.readFileSync(pfad, 'utf8'));
  // Gruppen (lokaleModelle …) und Arbeitsbereiche feldgenau: was nur in der
  // Datei steht (Pfade, Adressen), bleibt so, wie es dort gerade steht —
  // auch wenn es seit dem Start von Hand geaendert wurde.
  const gruppen = new Map();
  for (const r of Object.values(EINSTELLUNGEN)) {
    if (!r.pfad) continue;
    const [g, s] = r.pfad.split('.');
    gruppen.set(g, (gruppen.get(g) || []).concat(s));
  }
  gruppen.set('cira', (gruppen.get('cira') || []).concat(Object.keys(CIRA_FELDER)));
  gruppen.set('vault', VAULT_FELDER);
  for (const k of SCHREIBBAR) {
    if (config[k] === undefined) continue;
    if (gruppen.has(k)) {
      roh[k] = roh[k] && typeof roh[k] === 'object' ? roh[k] : {};
      for (const s of gruppen.get(k)) if ((config[k] || {})[s] !== undefined) roh[k][s] = config[k][s];
    } else if (k === 'arbeitsbereiche') {
      if (!Array.isArray(roh.arbeitsbereiche)) continue;   // neue Eintraege nur in der Datei
      for (const a of roh.arbeitsbereiche) {
        const m = a && arbeitsbereiche().find((x) => x.name === a.name);
        if (!m) continue;
        for (const f of Object.keys(ARBEITSBEREICH_FELDER)) { if (m[f] === undefined) delete a[f]; else a[f] = m[f]; }
      }
    } else roh[k] = config[k];
  }
  const tmp = pfad + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(roh, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, pfad);
  } catch (err) {
    // Keine Reste: die Temp-Datei kann einen Zugang (Kalender-Adresse) tragen.
    try { fs.rmSync(tmp, { force: true }); } catch { /* bleibt liegen, Fehler unten zaehlt */ }
    throw err;
  }
}

// Arbeitsbereiche (Masterplan 3.0, Ruling R-Arbeitsbereich): ein benannter
// Ordner mit Farbe, in dem Claude Code arbeitet — ein Projekt, der Vault, die
// globale Claude-Konfiguration oder ein neutraler Chat-Ordner. `projekt`
// verweist auf den Ledger-Projektnamen (Verbrauch, Saetze, Jira).
// Ruling R-Pfade: pfad und todo stehen nur in config.json. Die Oberflaeche
// aendert Kuerzel, Farbe und Verweise eines vorhandenen Eintrags — ein Pfad
// ist ein Schreibziel fuer einen gestarteten Prozess, also ein Zugang.
const ARBEITSBEREICH_ARTEN = ['projekt', 'vault', 'global', 'neutral'];
const ARBEITSBEREICH_FELDER = {
  kuerzel: { re: /^[A-Za-z0-9]{1,3}$/, label: 'Kuerzel', gross: true },
  farbe: { re: /^#[0-9a-fA-F]{6}$/, label: 'Farbe', klein: true },
  projekt: { re: /^[^\u0000-\u001f\u007f]{1,80}$/, label: 'Projekt', leer: true },
  jiraProjekt: { re: /^[A-Z][A-Z0-9]{1,9}$/, label: 'Jira-Projekt', leer: true },
  // Projekt-Tag fuer „Merke dir“ (C9c, E12): ausdruecklich, kein Automatismus aus dem Namen.
  tag: { re: /^[\p{L}\p{N}_/-]{1,40}$/u, label: 'Tag', leer: true },
};
const arbeitsbereiche = () => (Array.isArray(config.arbeitsbereiche) ? config.arbeitsbereiche : [])
  .filter((a) => a && typeof a === 'object' && typeof a.name === 'string');

function setzeArbeitsbereich(daten) {
  const ab = typeof daten.name === 'string' ? arbeitsbereiche().find((a) => a.name === daten.name) : null;
  if (!ab) throw new Error('Arbeitsbereich unbekannt. Neue Bereiche und Pfade nur in config.json.');
  for (const k of Object.keys(daten)) {
    if (k !== 'name' && !Object.hasOwn(ARBEITSBEREICH_FELDER, k)) {
      throw new Error(/pfad|todo|path|dir|art/i.test(k) ? k + ': nur in config.json aenderbar.' : 'Unbekanntes Feld: ' + k);
    }
  }
  const neu = {};
  for (const [k, r] of Object.entries(ARBEITSBEREICH_FELDER)) {
    if (!Object.hasOwn(daten, k)) continue;
    const w = daten[k] == null ? '' : daten[k];
    if (typeof w !== 'string') throw new Error(r.label + ': Text erwartet.');
    const s = w.trim();
    if (s === '' && r.leer) { neu[k] = null; continue; }
    if (!r.re.test(s)) throw new Error(r.label + ': ungueltig.');
    neu[k] = r.gross ? s.toUpperCase() : r.klein ? s.toLowerCase() : s;
  }
  if (!Object.keys(neu).length) throw new Error('Kein bekanntes Feld uebergeben.');
  const alt = { ...ab };
  for (const [k, v] of Object.entries(neu)) { if (v === null) delete ab[k]; else ab[k] = v; }
  try {
    schreibeConfig();
  } catch (err) {
    for (const k of Object.keys(ab)) delete ab[k];
    Object.assign(ab, alt);
    throw err;
  }
  return { arbeitsbereich: arbeitsbereichAnzeige(ab) };
}

// Einstellungen -> Cira (BACKEND §13). Whitelist mit Grenzen; der Pfad zur
// claude.exe (cira.claudeExe) bleibt der Datei vorbehalten.
const UHRZEIT_RE = /^(|([01]\d|2[0-3]):[0-5]\d)$/;
// Buchstaben, Ziffern, Leerzeichen, Bindestrich, Komma; je Wort 2 bis 40 Zeichen.
const WOERTER_RE = /^(|[\p{L}\p{N} -]{2,40}(, ?[\p{L}\p{N} -]{2,40}){0,29})$/u;
const CIRA_FELDER = {
  anrede: { art: 'text', re: /^[^\u0000-\u001f\u007f<>]{0,40}$/, label: 'Anrede', standard: cira.STANDARD.anrede },
  // Modell je Rolle (Modell-Block): gespeichert wird nur, was der Modellserver
  // gerade auflistet (setzeCira, bekannte) — ein Tippfehler kommt nicht durch.
  // modellLokal ist der alte Schluessel und heisst jetzt Rolle "Schnell".
  modellLokal: { art: 'modell', label: 'Modell Schnell', standard: cira.STANDARD.modellLokal },
  modellText: { art: 'modell', label: 'Modell Text', standard: cira.STANDARD.modellText },
  modellDenken: { art: 'modell', label: 'Modell Denken', standard: cira.STANDARD.modellDenken },
  modellCode: { art: 'modell', label: 'Modell Code', standard: cira.STANDARD.modellCode },
  // Eigene Woerter je Rolle, kommagetrennt.
  woerterSchnell: { art: 'text', re: WOERTER_RE, label: 'Eigene Wörter Schnell', standard: cira.STANDARD.woerterSchnell },
  woerterText: { art: 'text', re: WOERTER_RE, label: 'Eigene Wörter Text', standard: cira.STANDARD.woerterText },
  woerterDenken: { art: 'text', re: WOERTER_RE, label: 'Eigene Wörter Denken', standard: cira.STANDARD.woerterDenken },
  woerterCode: { art: 'text', re: WOERTER_RE, label: 'Eigene Wörter Code', standard: cira.STANDARD.woerterCode },
  claudeErlaubt: { art: 'bool', label: 'Claude erlaubt', standard: cira.STANDARD.claudeErlaubt },
  claudeModell: { art: 'wahl', wahl: ['', 'haiku', 'sonnet', 'opus'], label: 'Claude-Modell', standard: cira.STANDARD.claudeModell },
  claudeMonatslimitEur: { art: 'zahl', min: 0.5, max: 500, label: 'Monatslimit Claude in EUR', standard: cira.STANDARD.claudeMonatslimitEur },
  nichtStoerenAb: { art: 'text', re: UHRZEIT_RE, label: 'Nicht stören ab', standard: cira.STANDARD.nichtStoerenAb },
  nichtStoerenBis: { art: 'text', re: UHRZEIT_RE, label: 'Nicht stören bis', standard: cira.STANDARD.nichtStoerenBis },
  // Buehne im Cockpit: Partikel-Orb oder Flaeche (siri-orb), README §5.2.
  orbStil: { art: 'wahl', wahl: ['partikel', 'flaeche'], label: 'Orb-Stil', standard: cira.STANDARD.orbStil },
  // Desktop-Benachrichtigung (Notification API) zusaetzlich zur Karte in der Seite; Owner 15.10.: Standard aus.
  benachrichtigungDesktop: { art: 'bool', label: 'Desktop-Benachrichtigung', standard: cira.STANDARD.benachrichtigungDesktop },
};
const CIRA_FELDER_ANZEIGE = Object.fromEntries(Object.entries(CIRA_FELDER).map(([k, r]) =>
  [k, { art: r.art, label: r.label, ...(r.wahl ? { wahl: r.wahl } : {}), ...(r.art === 'zahl' ? { min: r.min, max: r.max } : {}) }]));
function ciraEinstellungen() {
  const c = config.cira && typeof config.cira === 'object' ? config.cira : {};
  return Object.fromEntries(Object.entries(CIRA_FELDER).map(([k, r]) => [k, c[k] === undefined ? r.standard : c[k]]));
}
// bekannte: Modellnamen, die der Server gerade auflistet (nur noetig, wenn ein Modell gesetzt wird).
function setzeCira(daten, bekannte = null) {
  for (const k of Object.keys(daten)) if (!Object.hasOwn(CIRA_FELDER, k)) throw new Error(/exe|pfad|path/i.test(k) ? k + ': nur in config.json aenderbar.' : 'Unbekanntes Feld: ' + k);
  const neu = {};
  for (const [k, r] of Object.entries(CIRA_FELDER)) {
    if (!Object.hasOwn(daten, k)) continue;
    const w = daten[k];
    if (r.art === 'bool') { if (typeof w !== 'boolean') throw new Error(r.label + ': ja oder nein.'); neu[k] = w; }
    else if (r.art === 'modell') {
      if (typeof w !== 'string') throw new Error(r.label + ': Name oder leer.');
      if (w.trim() && !(bekannte || []).includes(w.trim())) throw new Error(r.label + ': „' + w.trim().slice(0, 80) + '“ kennt der Modellserver nicht. Liste aktualisieren oder das Modell laden.');
      neu[k] = w.trim();
    }
    else if (r.art === 'wahl') { if (!r.wahl.includes(w)) throw new Error(r.label + ': ' + r.wahl.filter(Boolean).join(', ') + (r.wahl.includes('') ? ' oder leer.' : '.')); neu[k] = w; }
    else if (r.art === 'zahl') {
      const n = alsZahl(w);
      if (!Number.isFinite(n) || n < r.min || n > r.max) throw new Error(r.label + ': zwischen ' + r.min + ' und ' + r.max + '.');
      neu[k] = Math.round(n * 100) / 100;
    } else {
      if (typeof w !== 'string' || !r.re.test(w.trim())) throw new Error(r.label + ': ungueltig.');
      neu[k] = w.trim();
    }
  }
  if (!Object.keys(neu).length) throw new Error('Kein bekanntes Feld uebergeben.');
  if (!config.cira || typeof config.cira !== 'object') config.cira = {};
  const alt = { ...config.cira };
  Object.assign(config.cira, neu);
  try {
    schreibeConfig();
  } catch (err) {
    for (const k of Object.keys(config.cira)) delete config.cira[k];
    Object.assign(config.cira, alt);
    throw err;
  }
  return ciraEinstellungen();
}

// Einstellungen -> Vault (C9). Gruppen (Graph) und Quellen (Briefings) als Text,
// eine Regel je Zeile; Grenzen hier, nicht nur im Browser. Pfad und
// Briefings-Ordner bleiben der Datei vorbehalten (Ruling R-Pfade).
const VAULT_FELDER = ['gruppen', 'quellen'];
const FARBE_RE = /^#[0-9a-fA-F]{6}$/;
function zeilenAus(text, label, max) {
  if (typeof text !== 'string' || text.length > 4000) throw new Error(label + ': Text bis 4000 Zeichen.');
  const zeilen = text.split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  if (zeilen.length > max) throw new Error(label + ': höchstens ' + max + ' Regeln.');
  return zeilen;
}
function leseGruppen(text) {
  return zeilenAus(text, 'Gruppen', 30).map((z, i) => {
    const m = /^(tag:#[^\s#]{1,60}|path:[^\s]{1,80})\s+(#[0-9a-fA-F]{6})$/.exec(z);
    if (!m) throw new Error('Gruppen, Zeile ' + (i + 1) + ': „tag:#name #rrggbb“ oder „path:ordner #rrggbb“.');
    return { query: m[1], farbe: m[2].toLowerCase() };
  });
}
function leseQuellen(text) {
  return zeilenAus(text, 'Quellen', 20).map((z, i) => {
    const [muster, name, farbe = ''] = z.split('|').map((t) => t.trim());
    const wo = 'Quellen, Zeile ' + (i + 1) + ': ';
    try { vault.regel(muster); } catch (err) { throw new Error(wo + err.message); }
    if (!name || name.length > 40 || /[\u0000-\u001f<>]/.test(name)) throw new Error(wo + 'Name 1 bis 40 Zeichen („Muster | Name | #rrggbb“).');
    if (farbe && !FARBE_RE.test(farbe)) throw new Error(wo + 'Farbe als #rrggbb oder leer.');
    return { muster, name, farbe: farbe ? farbe.toLowerCase() : null };
  });
}
const gruppenText = (l) => (l || []).map((g) => g.query + ' ' + g.farbe).join('\n');
const quellenText = (l) => (l || []).map((q) => q.muster + ' | ' + q.name + (q.farbe ? ' | ' + q.farbe : '')).join('\n');
function vaultAnzeige() {
  const v = vaultPfad();
  const ab = arbeitsbereiche().find((x) => x.art === 'vault');
  const g = vault.gruppenAus(v, vaultCfg().gruppen || []);
  return {
    pfad: ab && ab.pfad ? ab.pfad : null, name: v ? path.basename(v) : null, erreichbar: !!v, briefingsOrdner: briefingDienst.ordner(),
    gruppen: gruppenText(vaultCfg().gruppen), gruppenQuelle: g.quelle, gruppenWirksam: gruppenText(g.gruppen),
    quellen: quellenText(vaultCfg().quellen), quellenStandard: quellenText(briefings.QUELLEN_STANDARD),
    index: { gesamt: db.prepare('SELECT COUNT(*) AS n FROM notiz_index').get().n, zeit: dbmod.getMeta(db, 'vault_index_zeit') }, fehler: vaultFehler,
  };
}
function setzeVault(daten) {
  for (const k of Object.keys(daten)) if (!VAULT_FELDER.includes(k)) throw new Error(/ordner|pfad|path/i.test(k) ? k + ': nur in config.json aenderbar.' : 'Unbekanntes Feld: ' + k);
  const neu = {};
  if (Object.hasOwn(daten, 'gruppen')) neu.gruppen = leseGruppen(daten.gruppen);
  if (Object.hasOwn(daten, 'quellen')) neu.quellen = leseQuellen(daten.quellen);
  if (!Object.keys(neu).length) throw new Error('Kein bekanntes Feld uebergeben.');
  if (!config.vault || typeof config.vault !== 'object') config.vault = {};
  const alt = { ...config.vault };
  Object.assign(config.vault, neu);
  try {
    schreibeConfig();
  } catch (err) {
    for (const k of Object.keys(config.vault)) delete config.vault[k];
    Object.assign(config.vault, alt);
    throw err;
  }
  return vaultAnzeige();
}

// Claude-Code-Konfiguration (Skills, spaeter Agenten/Plugins in C8). Ohne
// Claude Code fehlt der Ordner: dann gibt es schlicht keine Skills.
const claudeOrdner = () => process.env.CLAUDE_CONFIG_DIR || path.join(require('node:os').homedir(), '.claude');
// Ein Skill ist ein Ordner mit SKILL.md. Nur Namen, kein Inhalt.
// ponytail: liest bei jedem Aufruf; Cache erst, wenn C8 das Inventar oft braucht.
function skillNamen(ordner) {
  let eintraege;
  try { eintraege = fs.readdirSync(ordner, { withFileTypes: true }); } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') console.error('Skills lesen', ordner + ':', err.message);
    return [];
  }
  // Verlinkte Skill-Ordner (Symlink, Junction) zaehlen mit: isDirectory() folgt Links nicht.
  const ordnerArtig = (e) => e.isDirectory() || (e.isSymbolicLink() && (() => { try { return fs.statSync(path.join(ordner, e.name)).isDirectory(); } catch { return false; } })());
  return eintraege.filter((e) => /^[\w.:-]{1,80}$/.test(e.name) && ordnerArtig(e) && fs.existsSync(path.join(ordner, e.name, 'SKILL.md'))).map((e) => e.name);
}
// Skills eines Arbeitsbereichs: global aus ~/.claude/skills, projekt aus <pfad>/.claude/skills (gewinnt).
function skillsIn(ab) {
  const je = new Map(skillNamen(path.join(claudeOrdner(), 'skills')).map((n) => [n, 'global']));
  const heim = ab && ab.pfad ? ingest.loeseHeim(ab.pfad) : null;
  if (heim) for (const n of skillNamen(path.join(heim, '.claude', 'skills'))) je.set(n, 'projekt');
  return [...je].map(([n, quelle]) => ({ name: n, quelle })).sort((a, b) => (a.quelle === b.quelle ? a.name.localeCompare(b.name) : a.quelle === 'projekt' ? -1 : 1));
}
// Fuer den Skill-Ablauf (C6b): Namen je Arbeitsbereich bzw. die Arbeitsbereiche, die einen Skill kennen.
function skillNamenIn(name) {
  const ab = arbeitsbereiche().find((a) => a.name === name);
  if (!ab) throw Object.assign(new Error('Arbeitsbereich unbekannt.'), { status: 404 });
  return skillsIn(ab).map((s) => s.name);
}
const skillOrte = (befehl) => arbeitsbereiche().filter((a) => skillsIn(a).some((s) => s.name === befehl)).map((a) => a.name);

function arbeitsbereichAnzeige(a) {
  const ziel = ingest.loeseHeim(a.pfad);
  // Von Hand eingetragene Werte gelten erst nach derselben Pruefung wie aus
  // der Oberflaeche: die Farbe landet in einem style-Attribut.
  const gilt = (f) => (typeof a[f] === 'string' && ARBEITSBEREICH_FELDER[f].re.test(a[f]) ? a[f] : '');
  return {
    name: a.name, kuerzel: gilt('kuerzel').toUpperCase(), farbe: gilt('farbe').toLowerCase(), art: ARBEITSBEREICH_ARTEN.includes(a.art) ? a.art : 'neutral',
    projekt: a.projekt || null, jiraProjekt: a.jiraProjekt || null, tag: gilt('tag') || null, pfad: a.pfad || null, todo: a.todo || null,
    erreichbar: !!ziel && fs.existsSync(ziel),
  };
}

// Ohne Eintrag in config.json: Vorschlag aus den Daten (je Projekt der
// haeufigste Ordner, auf den Projektordner gekuerzt) plus "Global". Nur zum
// Kopieren in die Datei — geschrieben wird hier nichts.
const VORSCHLAG_FARBEN = ['#f97316', '#57c98a', '#e0b355', '#9aa8ec', '#c084fc', '#52e0b1'];
function arbeitsbereichVorschlag() {
  const zeilen = db.prepare(`SELECT project, cwd, COUNT(*) AS n FROM events
    WHERE cwd IS NOT NULL AND cwd <> '' AND COALESCE(source, '') <> 'lokal'
    GROUP BY project, cwd ORDER BY n DESC`).all();
  const jeProjekt = new Map();
  for (const z of zeilen) {
    if (jeProjekt.size >= VORSCHLAG_FARBEN.length) break;
    if (jeProjekt.has(z.project) || metrics.isOverhead(z.project)) continue;
    const teile = z.cwd.split(/[\\/]/);
    const i = teile.lastIndexOf(z.project);
    jeProjekt.set(z.project, i > 0 ? teile.slice(0, i + 1).join(path.sep) : z.cwd);
  }
  const kuerzelVon = (p) => (String(p).replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'P').toUpperCase();
  return [...jeProjekt].map(([projekt, pfad], i) => ({
    name: projekt, kuerzel: kuerzelVon(projekt), farbe: VORSCHLAG_FARBEN[i], art: 'projekt', projekt, pfad,
  })).concat([{ name: 'Global', kuerzel: 'GL', farbe: '#9c9ca6', art: 'global', pfad: '~/.claude' }]);
}

// Sitzungen (C5): Vorgang einer Sitzung buchen wie /api/buchen. Eine eben
// gestartete Sitzung hat noch kein Ereignis im Ledger; dann wird nur der
// Override vorgemerkt, der Backfill zieht ihn beim naechsten Abgleich.
function vormerkeVorgang(dbx, sid, vorgang) {
  const roh = typeof vorgang === 'string' ? vorgang.trim() : '';
  if (roh && !VORGANG_RE.test(roh)) {
    throw new Error('Vorgang: 2 bis 40 Zeichen, erlaubt sind Buchstaben, Ziffern, Punkt, Unterstrich und Bindestrich.');
  }
  if (dbx.prepare('SELECT 1 FROM events WHERE session_id = ? LIMIT 1').get(sid)) return bucheVorgang(dbx, { session_id: sid, vorgang: roh }).ticket;
  if (!roh) { dbx.prepare('DELETE FROM overrides WHERE session_id = ?').run(sid); return null; }
  const ticket = roh.toUpperCase();
  dbx.prepare(
    'INSERT INTO overrides (session_id, ticket, note, created_at) VALUES (?,?,?,?) ' +
    'ON CONFLICT(session_id) DO UPDATE SET ticket = excluded.ticket, note = excluded.note, created_at = excluded.created_at'
  ).run(sid, ticket, 'Sitzung aus c2invoice', new Date().toISOString());
  return ticket;
}
const sitzungDienst = sitzungen.erzeuge({
  db, arbeitsbereiche, heim: ingest.loeseHeim, vormerken: (sid, v) => vormerkeVorgang(db, sid, v), werkzeug: (p) => metrics.isOverhead(p),
  exe: () => claude.findeClaude(config.cira && config.cira.claudeExe),
  zusammenfassen: (verlauf) => ciraDienst.zusammenfassen(verlauf),
  // Nur aus der Datei (oeffnet einen Prozess): nicht ueber die Oberflaeche aenderbar.
  // Fehlt der Schluessel, gilt unter Windows der Standard aus config.example.json; ein leerer Wert schaltet "Zum Terminal" bewusst ab.
  terminalBefehl: () => (config.terminal && typeof config.terminal.befehl === 'string' ? config.terminal.befehl : (process.platform === 'win32' ? 'wt -d "{pfad}" "{claude}" --resume {sitzung}' : '')),
});
// Skill-Ablauf (C6b): Schritte als Eingaben in einer Sitzung.
const ablaufDienst = ablauf.erzeuge({ db, sitzungen: sitzungDienst, skills: skillNamenIn });
// Board (C7a): TODO.md je Arbeitsbereich und Jira. Neue @id-Praefixe nie gleich
// einem Jira-Projektschluessel (sonst kommentierte der Jira-Abgleich fremde Tickets).
const boardDienst = board.erzeuge({ db, bereiche: arbeitsbereiche, loeseHeim: ingest.loeseHeim, jira,
  gesperrt: () => [...((config.jira && config.jira.projectKeys) || []), ...arbeitsbereiche().map((a) => a.jiraProjekt).filter(Boolean)] });
// Werkzeuge (C8): Claude-Code-Konfiguration je Arbeitsbereich. Der Bereich der
// Art 'global' ist die Spalte Global; Pfade und Lager nur aus der Datei.
const werkzeugDienst = werkzeuge.erzeuge({
  db,
  bereiche: () => arbeitsbereiche().filter((a) => a.art !== 'global').map((a) => {
    const pfad = a.pfad ? ingest.loeseHeim(a.pfad) : null;
    return { name: a.name, pfad: pfad && fs.existsSync(pfad) ? pfad : null, projekt: a.projekt || null };
  }),
  heim: () => ingest.loeseHeim('~'),
  lager: () => (config.claudeConfig && config.claudeConfig.lager ? ingest.loeseHeim(config.claudeConfig.lager) : null),
  // Sicherungen zentral in data/ statt neben der Datei: eine Kopie von
  // settings.local.json im Projektordner landete sonst mit `git add .` im Repo.
  sicherung: () => path.join(__dirname, 'data', 'sicherungen', 'werkzeuge'),
  exe: () => claude.findeClaude(config.cira && config.cira.claudeExe),
  env: () => claude.kindUmgebung(),
});
// Geraetekopplung (S1): nur gekoppelte Geraete schreiben. Immer an; abschalten
// nur ausdruecklich (C2I_GERAETESCHUTZ=aus setzt allein der Selfcheck fuer
// seine alten HTTP-Tests) — main() warnt dann im Protokoll.
let geraeteDienst = geraete.erzeuge({ db });
let geraeteSchutz = process.env.C2I_GERAETESCHUTZ !== 'aus';
// Ohne Geraet erlaubt: der Hook (eigenes Geheimnis) und die Kopplung selbst.
const OHNE_GERAET = new Set(['/api/hook', '/api/kopplung/start', '/api/kopplung/bestaetigen']);

// Beim Ende des Servers die eigenen Claude-Prozesse mitnehmen (synchron).
process.on('exit', () => sitzungDienst.beendeAlle());

// Absturz sichtbar machen: die Aufgabe TokenLedger verwirft stdout/stderr, ein
// unbehandelter Fehler beendete den Server bisher spurlos (20.10.). Der Stack
// kommt nach data/absturz.log, beendet wird wie vorher; die Aufgabe startet neu.
function absturz(art, err) {
  try { fs.appendFileSync(path.join(__dirname, 'data', 'absturz.log'), new Date().toISOString() + ' ' + art + ' (PID ' + process.pid + ')\n' + ((err && err.stack) || String(err)) + '\n\n'); } catch { /* Platte weg: dann wenigstens stderr */ }
  console.error(art + ':', err);
  process.exit(1);
}
// Nur als eigener Prozess: der Selfcheck laedt server.js per require und hat eigene Regeln.
if (require.main === module) {
  process.on('uncaughtException', (err) => absturz('uncaughtException', err));
  process.on('unhandledRejection', (err) => absturz('unhandledRejection', err));
}

// Hook fremder Sitzungen (integration/claude-hook.mjs): kommt nicht aus dem
// Browser, deshalb ein eigenes Geheimnis (hook.geheimnis, beim ersten Start
// erzeugt). Verglichen werden die Hashes, in fester Zeit.
function hookErlaubt(req) {
  const soll = config.hook && typeof config.hook.geheimnis === 'string' ? config.hook.geheimnis : '';
  const ist = req.headers['x-c2invoice-geheimnis'];
  if (soll.length < 32 || typeof ist !== 'string') return false;
  const h = (s) => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(soll), h(ist));
}

// Dienst-Status fuer die Kopfzeile (Shell v2). Muster aus Jarvis
// core/vitals.js: jeder Punkt muss rot werden koennen, 4 s Zeitlimit.
// Angezeigt wird nur, was eingerichtet ist; Ledger und Claude immer.
// Abgefragt werden ausschliesslich Adressen aus config.json, nie aus der
// Anfrage — sonst waere die Route ein offener Weiterleiter.
let letzterJira = null;   // { at, ok, grund } aus syncJira()
const hostVon = (u) => { try { return new URL(u).host; } catch { return ''; } };
async function holeDienst(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'error' });
  // Koerper verwerfen, sonst bleibt die Verbindung offen (wie modelle.holeJson).
  if (!r.ok) { await r.body?.cancel().catch(() => {}); throw new Error('HTTP ' + r.status); }
  return r.json().catch(() => ({}));
}
// Angemeldet ist Claude Code, wenn ~/.claude.json ein Konto traegt. Die Datei
// kann gross sein: gelesen wird nur, wenn sie sich geaendert hat.
let claudeStand = { mtime: -1, ok: false };
function claudeStatus() {
  const datei = path.join(ingest.loeseHeim('~'), '.claude.json');
  try {
    const m = fs.statSync(datei).mtimeMs;
    if (m !== claudeStand.mtime) claudeStand = { mtime: m, ok: !!JSON.parse(fs.readFileSync(datei, 'utf8')).oauthAccount };
    return claudeStand.ok ? { ok: true, detail: 'angemeldet' } : { ok: false, detail: 'nicht angemeldet' };
  } catch {
    return { ok: false, detail: 'keine Anmeldung gefunden' };
  }
}
// 10 s zwischengespeichert, eine laufende Pruefung wird geteilt: eine fremde
// Seite kann die Route per no-cors beliebig oft ausloesen (Security-Review B).
let dienstStand = { zeit: 0, laeuft: null, wert: null };
function dienste() {
  if (dienstStand.laeuft) return dienstStand.laeuft;
  if (dienstStand.wert && Date.now() - dienstStand.zeit < 10000) return Promise.resolve(dienstStand.wert);
  dienstStand.laeuft = diensteJetzt().then((w) => { dienstStand = { zeit: Date.now(), laeuft: null, wert: w }; return w; },
    (err) => { dienstStand.laeuft = null; throw err; });
  return dienstStand.laeuft;
}
// Der Proxy traegt auf jeder Antwort die Kennung x-c2i-proxy. Ohne sie antwortet
// ein fremdes Programm auf dem Port — dann erreicht Cira kein Modell, auch wenn
// "etwas" antwortet. Ein Fehlerstatus mit Kennung (502) kommt vom Proxy selbst:
// er laeuft, nur der Modellserver dahinter nicht (der steht dann rot daneben).
let proxyStartFehler = null;   // aus starteModellProxy, fuer den Dienst-Status
async function proxyStatus(port) {
  let r;
  try {
    r = await fetch('http://127.0.0.1:' + port + '/v1/models', { signal: AbortSignal.timeout(4000), redirect: 'error' });
    await r.arrayBuffer().catch(() => null);
  } catch {
    return { ok: false, detail: proxyStartFehler ? 'nicht gestartet · ' + proxyStartFehler : 'nicht erreichbar · Port ' + port };
  }
  if (r.headers.get('x-c2i-proxy') !== '1') return { ok: false, detail: 'Port ' + port + ' belegt, kein c2invoice-Proxy' };
  return { ok: true, detail: 'Port ' + port + (r.ok ? '' : ' · Modellserver antwortet nicht') };
}
const LAUFZEIT_NAME = { ollama: 'Ollama', lmstudio: 'LM Studio', lemonade: 'Lemonade', llamacpp: 'llama.cpp', openai: 'OpenAI-kompatibel', unbekannt: 'Laufzeit unbekannt' };
async function diensteJetzt() {
  const lm = config.lokaleModelle;
  const n8n = config.dienste && config.dienste.n8nUrl;
  const basis = (u) => String(u).replace(/\/+$/, '');
  const proxyPort = lm && (Number(lm.proxyPort) || 11435);
  const [modellserver, proxy, n8nStand] = await Promise.all([
    // Dieselbe Liste wie Einstellungen → Lokale Modelle, damit beide dasselbe sagen.
    // Ohne Modell kann Cira lokal nichts beantworten: erreichbar allein ist nicht gruen.
    lm && lm.upstreamUrl ? modelle.liste({ cfg: config }).then((l) => {
      const art = LAUFZEIT_NAME[l.laufzeit] || l.laufzeit;
      if (!l.erreichbar) return { ok: false, detail: 'nicht erreichbar · ' + hostVon(lm.upstreamUrl) };
      if (!l.modelle.length) return { ok: false, detail: art + ' · kein Modell' };
      return { ok: true, detail: art + ' · ' + l.modelle.length + (l.modelle.length === 1 ? ' Modell' : ' Modelle') };
    }).catch((err) => ({ ok: false, detail: 'Prüfung fehlgeschlagen · ' + String(err.message).slice(0, 80) })) : null,
    // Ohne laufenden Proxy erreicht Cira kein lokales Modell und lokale Arbeit bleibt unerfasst.
    lm && lm.upstreamUrl ? proxyStatus(proxyPort) : null,
    n8n ? holeDienst(basis(n8n) + '/healthz').then(() => ({ ok: true, detail: 'läuft' }), () => ({ ok: false, detail: 'nicht erreichbar · ' + hostVon(n8n) })) : null,
  ]);
  const liste = [];
  if (modellserver) liste.push({ name: 'Modellserver', ...modellserver }, { name: 'Modell-Proxy', ...proxy });
  liste.push({ name: 'Claude', ...claudeStatus() });
  liste.push({ name: 'Ledger', ok: !lastIngest.error, detail: '127.0.0.1:' + config.port + (lastIngest.error ? ' · Einlesen gestört' : '') });
  if (config.jira && config.jira.enabled) {
    liste.push({ name: 'Jira', ok: !!(letzterJira && letzterJira.ok),
      detail: !letzterJira ? 'noch kein Abgleich'
        : letzterJira.ok ? 'Abgleich ' + new Date(letzterJira.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : letzterJira.grund });
  }
  if (n8nStand) liste.push({ name: 'n8n', ...n8nStand });
  return liste;
}

function opts(u) {
  const g = (k) => u.searchParams.get(k) || undefined;
  return {
    from: g('from'), to: g('to'), month: g('month'),
    ticket: g('ticket'), project: g('project'), model: g('model'),
  };
}

function csvEscape(v) {
  let s = v == null ? '' : String(v);
  // Fuehrende Rechenzeichen werden von Tabellenprogrammen als Formel gelesen.
  // Ein vorangestelltes Hochkomma verhindert das.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Zeilen des Kundenberichts. Der Arbeitswert enthaelt die manuelle Zeit; ihre
// Stunden und ihr Betrag stehen deshalb daneben, angehaengt am Ende, damit
// bestehende Auswertungen nicht verrutschen.
function csvExport(rows, kundeVon) {
  const komma = (n) => Number(n || 0).toFixed(2).replace('.', ',');
  const head = [
    'Ticket', 'Kunde', 'Requests', 'Sessions', 'Von', 'Bis',
    'Tokens gesamt', 'Tokens Arbeit', 'Tokens Werkzeuge',
    'Input', 'Output', 'Cache geschrieben', 'Cache gelesen',
    'Aktive Stunden', 'Agentenstunden (nicht berechnet)',
    'Stundensatz ' + config.waehrung, 'Rabatt %',
    'Arbeitswert ' + config.waehrung,
    'API-Gegenwert USD', 'davon Werkzeuge USD', 'Abo-Anteil USD',
    'Manuelle Stunden', 'davon Arbeitswert manuell ' + config.waehrung,
  ];
  const lines = [head.join(';')];
  for (const t of rows) {
    lines.push([
      t.ticket, kundeVon(t), t.requests, t.sessions, t.first_day, t.last_day,
      t.gesamt_tokens, t.total_tokens, t.werkzeug_tokens,
      t.input_tokens, t.output_tokens, t.cache_write_tokens, t.cache_read_tokens,
      komma(t.active_hours), komma(t.agent_hours),
      komma(t.stundensatz), komma(t.rabatt_prozent),
      komma(t.arbeitswert),
      komma(t.api_gegenwert_usd), komma(t.werkzeug_cost_usd), komma(t.abo_anteil_usd),
      komma(t.manuell_hours), komma(t.arbeitswert_manuell),
    ].map(csvEscape).join(';'));
  }
  return lines;
}

function handle(req, res) {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = u.pathname;

  // DNS-Rebinding: eine fremde Webseite laesst ihren Namen auf 127.0.0.1
  // zeigen und gilt dann als "same-origin" — CORS und der Herkunfts-Check
  // unten greifen nicht mehr. Ihren Namen schickt der Browser aber im
  // Host-Header mit. Bedient werden nur die eigenen Namen. Ein fehlender
  // Header kommt nicht aus einem Browser und bleibt erlaubt.
  const host = req.headers.host;
  if (host && !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)) {
    return sendJson(res, { error: 'Unbekannter Host' }, 421);
  }
  // Antworten nur als das, was sie sagen: kein Raten des Typs durch den Browser.
  res.setHeader('x-content-type-options', 'nosniff');

  // Obsidian laedt die Seite unter der Herkunft app://obsidian.md und braucht
  // deshalb eine Freigabe. Bewusst keine Freigabe fuer alle: sonst koennte
  // jede im Browser geoeffnete Webseite die Abrechnungsdaten auslesen.
  // Andere lokale Ports sind fremde Anwendungen (Toolcheck 15.10., H7): nur die
  // eigene Herkunft und die Einbettungen. Jarvis liest aus dem Hauptprozess,
  // ohne Origin, und braucht keine Freigabe.
  const HERKUNFT_ERLAUBT = ['app://obsidian.md', 'capacitor://localhost'];
  const herkunft = req.headers.origin;
  if (herkunft && (HERKUNFT_ERLAUBT.includes(herkunft) || (host && herkunft === 'http://' + host))) {
    res.setHeader('access-control-allow-origin', herkunft);
    res.setHeader('vary', 'origin');
  }
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Schreibende Aufrufe nur aus der eigenen Seite. Eine fremde Webseite kann
  // sonst per einfachem POST einen Jira-Abgleich ausloesen oder einen Satz
  // setzen — CORS verhindert nur das Lesen der Antwort, nicht das Absenden.
  // Den Header setzt der Browser selbst, Javascript kann ihn nicht faelschen.
  const ziel = req.headers['sec-fetch-site'];
  const schreibt = req.method !== 'GET' && req.method !== 'HEAD';
  if (schreibt && ziel && ziel !== 'same-origin' && ziel !== 'none') {
    return sendJson(res, { error: 'Fremde Herkunft' }, 403);
  }
  // Aeltere Browser schicken Sec-Fetch-Site nicht, Origin aber bei jedem POST.
  // Erlaubt: die eigene Seite und die freigegebenen Einbettungen. Ohne Origin
  // (curl, Skripte) bleibt der Aufruf wie bisher moeglich.
  if (schreibt && herkunft && herkunft !== 'http://' + host && !HERKUNFT_ERLAUBT.includes(herkunft)) {
    return sendJson(res, { error: 'Fremde Herkunft' }, 403);
  }

  // Schreiben nur von gekoppelten Geraeten. Die Kopfzeilen oben haelt eine
  // fremde Webseite ab, das hier auch einen lokalen Prozess, der sie faelscht.
  if (schreibt && geraeteSchutz && !OHNE_GERAET.has(p)) {
    let g;
    // Ein DB-Fehler ist kein "nicht gekoppelt": sonst saehe man einen Kopplungsdialog statt der Ursache.
    try { g = geraeteDienst.geraet(req); } catch (err) {
      console.error('Geraetepruefung fehlgeschlagen (' + p + '):', err);
      req.resume();
      return sendJson(res, { error: 'Geräteprüfung fehlgeschlagen, Details im Serverprotokoll.' }, 500);
    }
    if (!g) {
      req.resume();
      res.setHeader('x-c2invoice-kopplung', 'noetig');
      return sendJson(res, { error: 'Dieses Gerät ist nicht gekoppelt. Zum Schreiben bitte zuerst koppeln.', kopplung: true }, 401);
    }
  }

  try {
    if (p === '/api/kopplung/status' && req.method === 'GET') {
      const g = geraeteDienst.geraet(req);
      return sendJson(res, { gekoppelt: !!g || !geraeteSchutz, geraet: g ? g.name : null, schutz: geraeteSchutz });
    }
    if (p === '/api/kopplung/start' && req.method === 'POST') {
      return leseKoerper(req, (fehler, d) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        geraeteDienst.starte(d && typeof d === 'object' ? d : {}).then(
          (r) => sendJson(res, { ok: true, ...r }),
          (err) => sendJson(res, { error: err.message }, err.status || 400));
      });
    }
    if (p === '/api/kopplung/bestaetigen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, d) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const r = geraeteDienst.bestaetige(d && typeof d === 'object' ? d : {});
          // Browser: Token nur als HttpOnly-Cookie; Programme (client) bekommen es einmal im Koerper.
          if (r.geraet.art === 'client') return sendJson(res, { ok: true, geraet: r.geraet, token: r.token });
          res.setHeader('set-cookie', geraeteDienst.cookie(r.token));
          return sendJson(res, { ok: true, geraet: r.geraet });
        } catch (err) { return sendJson(res, { error: err.message }, err.status || 400); }
      });
    }
    if (p === '/api/geraete' && req.method === 'GET') return sendJson(res, { geraete: geraeteDienst.liste(geraeteDienst.geraet(req)) });
    const mg = req.method === 'POST' && p.match(/^\/api\/geraet\/(\d{1,9})\/entfernen$/);
    if (mg) {
      req.resume();
      try {
        const id = Number(mg[1]);
        const selbst = geraeteDienst.geraet(req);
        geraeteDienst.entferne(id);
        if (selbst && selbst.id === id) res.setHeader('set-cookie', geraeteDienst.cookieWeg());
        return sendJson(res, { ok: true, id });
      } catch (err) { return sendJson(res, { error: err.message }, err.status || 400); }
    }
    if (ciraDienst.routen(req, res, p, u, { sendJson, leseKoerper })) return;
    if (sitzungDienst.routen(req, res, p, u, { sendJson, leseKoerper })) return;
    if (ablaufDienst.routen(req, res, p, u, { sendJson, leseKoerper })) return;
    if (boardDienst.routen(req, res, p, u, { sendJson, leseKoerper })) return;
    if (werkzeugDienst.routen(req, res, p, u, { sendJson, leseKoerper })) return;
    if (gedaechtnisDienst.routen(req, res, p, u, { sendJson, leseKoerper })) return;
    if (briefingDienst.routen(req, res, p, u, { sendJson, leseKoerper })) return;
    if (p === '/api/vault' && req.method === 'POST') return antworte(req, res, setzeVault);
    if (p === '/api/vault') return sendJson(res, vaultAnzeige());
    if (p === '/api/hook' && req.method === 'POST') {
      // Vor dem Lesen des Koerpers: ohne Geheimnis entsteht nichts.
      if (!hookErlaubt(req)) { req.resume(); return sendJson(res, { error: 'Nicht berechtigt' }, 401); }
      return antworte(req, res, (d) => sitzungDienst.hook(d));
    }
    if (p === '/api/cira/einstellungen' && req.method === 'POST') {
      // Ein gesetztes Modell wird gegen die Liste des Modellservers geprueft (async), alles andere wie bisher.
      return leseKoerper(req, async (fehler, roh) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        const d = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {};
        try {
          const mitModell = Object.entries(d).some(([k, w]) => CIRA_FELDER[k] && CIRA_FELDER[k].art === 'modell' && typeof w === 'string' && w.trim());
          const bekannte = mitModell ? await modelle.bekannteModelle({ cfg: config }) : null;
          sendJson(res, { ok: true, cira: setzeCira(d, bekannte) });
        } catch (err) { sendJson(res, { error: err.message }, 400); }
      });
    }
    if (modelle.routen(req, res, p, { sendJson, leseKoerper, cfg: config })) return;
    if (p === '/api/cira/einstellungen') {
      return sendJson(res, {
        cira: ciraEinstellungen(), felder: CIRA_FELDER_ANZEIGE,
        name: (config.cira && typeof config.cira.name === 'string' && config.cira.name.trim().slice(0, 40)) || 'Cira',
        verbraucht_eur: metrics.ciraKostenMonatEur(db),
      });
    }

    if (p === '/api/summary') {
      const o = opts(u);
      const tickets = metrics.byTicket(db, o);
      const ohneTicket = metrics.ohneTicket(db, o);
      const abrechnung = rechnung.abrechnung(db);
      const modelle = metrics.byModel(db, o);
      const wochen = metrics.byPeriod(db, o, 'woche');
      return sendJson(res, {
        summary: metrics.summary(db, o),
        // Hub: Arbeitswert, Marge, abgerechnet/offen des Zeitraums — gerechnet
        // mit derselben mehrwert()-Formel wie je Vorgang.
        kennzahlen: metrics.kennzahlen(tickets.concat(ohneTicket), abrechnung, zeit.kennzahlenZusatz(db, o)),
        models: modelle,
        // Was der Cache gegenueber normaler Eingabe gespart hat (Listenpreis, USD).
        cache_ersparnis_usd: metrics.cacheErsparnis(modelle),
        // Modelle ohne exakten Preis. Ohne diese Liste sieht eine geschaetzte
        // oder fehlende Summe aus wie jede andere.
        preis_luecken: metrics.preisLuecken(db, o),
        days: metrics.byDay(db, o),
        // Dieselbe Reihe in groeberer Koernung. Der Umschalter am Diagramm
        // wechselt nur die Quelle, statt im Frontend nachzusummieren — sonst
        // stuende die Formel ein zweites Mal da.
        months: metrics.byMonth(db, o),
        years: metrics.byYear(db, o),
        weeks: wochen,
        // Durchschnitt fuer "Kosten je Stunde" (Hub + Analyse): die letzten
        // zwoelf Wochen, die beide Diagramme zeigen.
        kosten_je_stunde_12w: metrics.usdJeStunde(wochen.slice(-12)),
        projects: metrics.byProject(db, o),
        // Je Vorgang der Wert des Zeitraums, ohne Rechnungsbetrag — wie die
        // Hub-Kennzahlen: eine Rechnung kann Zeit ausserhalb des Zeitraums
        // enthalten. Das Detail rechnet mit dem gestellten Betrag.
        tickets: tickets.map((t) => ({ ...t, wert: metrics.mehrwert(t, 0) })),
        // Alle Budgets, nicht nur die Vorgaenge im Zeitraum: die Glocke meldet
        // auch einen Vorgang, an dem diesen Monat niemand gearbeitet hat.
        budgets: metrics.budgets(db),
        // Dollar je Tag und Vorgang fuer die Sparklines der Vorgangstabelle.
        ticket_verlauf: metrics.verlaufJeVorgang(db, o),
        projekt_verlauf: metrics.verlaufJeProjekt(db, o),
        // Getrennt gehalten, nicht unter "tickets" gemischt: diese Zeilen
        // tragen keinen Vorgangsschluessel, und alles was tickets liest
        // (Jira-Abgleich, Rechnung, Angebot) setzt einen voraus.
        ohne_ticket: ohneTicket,
        split: metrics.splitOverhead(db, o),
        // Echte Kosten neben dem Listenpreis: ohne diese Zahl liest sich der
        // API-Gegenwert im Ueberblick wie eine Rechnung von Anthropic.
        abo_kosten: metrics.aboKosten(db, o),
        werkzeuge: metrics.werkzeuge(db, o),
        // Andere Sicht auf dieselben Tokens: woher die Requests der eigenen
        // Sitzungen kamen. Aendert keine Abrechnung, siehe metrics.herkunft().
        herkunft: metrics.herkunft(db, o),
        // Zeitraumunabhaengig: eine Rechnung bleibt gestellt, auch wenn der
        // Filter gerade einen anderen Ausschnitt zeigt.
        abrechnung,
        // Rechnungen-Seite und Hub-Instrument "Offene Posten": gestellt,
        // bezahlt, offen, Zahlungsdauer — gerechnet in rechnung.kennzahlen().
        // Eigener Fang: ein Fehler hier nimmt nicht die ganze Uebersicht mit;
        // die Oberflaeche zeigt dann "Nicht geladen" an dieser einen Stelle.
        belege_kennzahlen: (() => {
          try { return rechnung.kennzahlen(db, o); } catch (e) { console.error('Beleg-Kennzahlen:', e); return null; }
        })(),
        // Welcher Kunde hinter welchem Projekt steht. Der Rechnungen-Tab waehlt
        // damit die Vorgaenge eines Kunden vor; gerechnet wird daran nichts,
        // deshalb hier statt in metrics — das kennt keine Kontakte.
        projekt_kontakt: kontakte.kontaktJeProjekt(db),
        // Beginn des Zeitraums "Gesamt" in der Oberflaeche: erster Tag mit Daten.
        erster_tag: (db.prepare('SELECT MIN(d) AS d FROM (SELECT MIN(day) AS d FROM events UNION ALL SELECT MIN(day) FROM activity)').get() || {}).d || null,
        config: {
          stundensatz: config.stundensatz,
          waehrung: config.waehrung,
          aboPreisMonat: config.aboPreisMonat,
          aboWaehrung: config.aboWaehrung,
          usdToEur: config.usdToEur,
          gapMinutes: config.gapMinutes,
          // Bestimmt, wie die Oberflaeche die Zeitkachel beschriftet. Alles
          // ausser "aktivitaet" ist die Vorgabe, genau wie in metrics.js.
          zeitmodell: config.zeitmodell === 'aktivitaet' ? 'aktivitaet' : 'eingaben',
          // Nur die Basis-Adresse und die Vorgangskuerzel, damit die
          // Oberflaeche einen Absprunglink bauen kann. Zugangsdaten bleiben
          // hier draussen. Ist Jira aus, bleibt das Feld leer und der Link
          // erscheint erst gar nicht.
          jiraBaseUrl: config.jira && config.jira.enabled ? config.jira.baseUrl || null : null,
          jiraProjectKeys: config.jira && config.jira.enabled ? config.jira.projectKeys || [] : [],
          // Navigation zeigt Bereiche spaeterer Bloecke nur damit (kern.js navSeiten).
          geplanteBereiche: !!(config.oberflaeche && config.oberflaeche.geplanteBereiche === true),
        },
        pricing: pricing.info(),
        lastIngest,
        codeStand: codeStand(),
      });
    }

    if (p === '/api/live') {
      // Begrenzen, damit unsinnige Werte kein ungueltiges Datum erzeugen.
      const raw = Number(u.searchParams.get('minutes'));
      const minutes = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 60 * 24 * 31) : 60;
      return sendJson(res, {
        ...metrics.live(db, { minutes }), timer: zeit.timerAktuell(db), lastIngest,
        block5h: metrics.block5h(db, { limit: config.limit5hTokens }),
      });
    }

    // Shell v2: Badges der Navigation aus einer Quelle (BACKEND §1). Weitere
    // Felder kommen je Block dazu (freigaben C2, sitzungen C5 …).
    if (p === '/api/zaehler') return sendJson(res, { live: metrics.liveSitzungen(db), freigaben: freigaben.offenAnzahl(db), sitzungen: sitzungDienst.anzahlOffen(), briefings: briefingDienst.ungelesen() });
    if (p === '/api/dienste') {
      return dienste().then((d) => sendJson(res, { dienste: d }), (err) => {
        console.error('Dienst-Status:', err);
        sendJson(res, { error: 'Interner Fehler, Details im Serverprotokoll' }, 500);
      });
    }

    if (p === '/api/tickets') return sendJson(res, metrics.byTicket(db, opts(u)));
    if (p === '/api/projects') return sendJson(res, metrics.byProject(db, opts(u)));
    if (p === '/api/models') return sendJson(res, metrics.byModel(db, opts(u)));
    if (p === '/api/timeline') return sendJson(res, metrics.byDay(db, opts(u)));
    // Analyse: Verlauf je Modell, Fluss Modell -> Projekt -> Vorgang, Marge je Woche.
    if (p === '/api/verlauf') {
      const k = u.searchParams.get('koernung');
      return sendJson(res, metrics.verlaufJeModell(db, opts(u), ['tag', 'woche', 'monat', 'jahr'].includes(k) ? k : 'tag'));
    }
    if (p === '/api/fluss') return sendJson(res, metrics.fluss(db, opts(u)));
    if (p === '/api/marge-wochen') {
      const bis = u.searchParams.get('bis');
      // Format UND Kalenderdatum: 2026-13-45 passt aufs Muster, ist aber kein Tag.
      const echt = bis && /^\d{4}-\d{2}-\d{2}$/.test(bis) && !Number.isNaN(Date.parse(bis + 'T00:00:00Z'))
        && new Date(bis + 'T00:00:00Z').toISOString().slice(0, 10) === bis;
      if (bis && !echt) return sendJson(res, { error: 'bis muss ein Datum JJJJ-MM-TT sein' }, 400);
      return sendJson(res, metrics.margeJeWoche(db, { bis: bis || undefined, wochen: 12 }, rechnung.abrechnung(db)));
    }
    // Nur die Hub-Kennzahlen eines Zeitraums (Monatsziel), ohne die ganze Auswertung.
    if (p === '/api/kennzahlen') {
      const o = opts(u);
      return sendJson(res, metrics.kennzahlen(
        metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o)));
    }

    // Kundenbericht: ein Ticket je Zeile, Semikolon als Trenner fuer Excel (DE).
    if (p === '/api/export.csv') {
      const rows = metrics.byTicket(db, opts(u));
      // Kunde: der zugeordnete Kontakt (Kontakte → Projekte), sonst der alte Freitext am Satz.
      const pk = kontakte.kontaktJeProjekt(db);
      const kundeVon = (t) => (Object.hasOwn(pk, t.project) && pk[t.project].firma) || t.kunde || '';
      const lines = csvExport(rows, kundeVon);
      res.writeHead(200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="c2invoice.csv"',
      });
      // BOM, damit Excel die Umlaute richtig anzeigt.
      return res.end('﻿' + lines.join('\n'));
    }

    if (p === '/api/ticket') {
      const key = u.searchParams.get('key');
      if (!key) return sendJson(res, { error: 'Parameter key fehlt' }, 400);
      const row = metrics.byTicket(db, { ticket: key })[0];
      if (!row) return sendJson(res, { error: 'Ticket nicht gefunden' }, 404);
      // Der Rechnungsbetrag wird nicht mehr von aussen geraten, sondern kommt
      // aus den tatsaechlich gestellten Rechnungen. Kein Beleg = nicht
      // abgerechnet, dann bleibt die Marge leer statt geschaetzt zu werden.
      const abr = rechnung.abrechnung(db)[key] || null;
      const models = metrics.byModel(db, { ticket: key });
      const sitzungen = metrics.sitzungenJeVorgang(db, key);
      // Branch und Arbeitsverzeichnis, unter denen die meisten Requests liefen.
      const haeufigster = (feld) => {
        const n = new Map();
        for (const s of sitzungen) if (s[feld]) n.set(s[feld], (n.get(s[feld]) || 0) + s.requests);
        return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      };
      return sendJson(res, {
        ...row,
        models,
        days: metrics.byDay(db, { ticket: key }),
        weeks: metrics.byPeriod(db, { ticket: key }, 'woche'),
        months: metrics.byMonth(db, { ticket: key }),
        token_arten: metrics.tokenArten(models),
        sitzungen,
        subagent_sitzungen: sitzungen.filter((s) => s.subagent).length,
        web_suchen: sitzungen.reduce((a, s) => a + s.web_suchen, 0),
        branch: haeufigster('branch'),
        cwd: haeufigster('cwd'),
        abgerechnet: abr,
        // Erloes = gestellte Claude- und manuelle Zeit dieses Vorgangs. Nur der
        // Claude-Teil liesse die Marge sinken, sobald manuelle Zeit mitgestellt ist.
        wert: metrics.mehrwert(row, rechnung.abgerechnetFuerVorgang(db, key)),
        // Fuer den Schalter 'nur Claude | mit manueller Zeit' im Detail: beide
        // Zahlensaetze vom Server, die Oberflaeche waehlt nur aus.
        wert_nur_claude: metrics.mehrwert({ ...row, arbeitswert: row.arbeitswert_claude, manuell_hours: 0, manuell_nicht_hours: 0 }, abr ? abr.betrag_eur : 0),
        manuelle_eintraege: zeit.liste(db, { ziel_art: 'vorgang', ziel_schluessel: key }),
        budget: metrics.budgetFuer(db, key),
        // Modul ueber vorgangLog, nicht sitzungen.*: die lokale Liste oben heisst auch sitzungen.
        // Ein Fehler im Log reisst die Kennzahlen nicht mit, steht aber da (log null + logFehler).
        ...(() => { try { return { log: vorgangLog(db, key) }; } catch (err) { console.error('Vorgangs-Log ' + key + ':', err.message); return { log: null, logFehler: 'Vorgangs-Log nicht lesbar.' }; } })(),
      });
    }

    if (p === '/api/refresh' && req.method === 'POST') {
      refreshData();
      return sendJson(res, { ok: true, lastIngest });
    }

    // Stundensaetze aendern. Die Konfiguration ist im Modul-Cache geteilt,
    // deshalb wird das vorhandene Objekt veraendert statt ersetzt — sonst
    // rechnen die anderen Module weiter mit den alten Werten.
    if (p === '/api/saetze' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const geaendert = setzeSatz(daten);
          zeitNachrechnen();
          return sendJson(res, { ok: true, ...geaendert });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    // Sitzung von Hand auf einen Vorgang buchen. Wirkt sofort, weil der
    // Backfill direkt mitlaeuft — sonst stuende die Zuordnung erst nach dem
    // naechsten Takt in der Auswertung.
    if (p === '/api/buchen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, ...bucheVorgang(db, daten) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    // Zeitmodell je Vorgang oder Sitzung. Wirkt sofort: die Zeit wird bei
    // jeder Auswertung neu verteilt, ein Nachtrag ist nicht noetig.
    // Budget je Vorgang setzen oder mit null entfernen. Grenzen in metrics.setzeBudget.
    if (p === '/api/budget' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, ...metrics.setzeBudget(db, daten || {}) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/zeitmodell' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const r = setzeZeitmodell(db, daten);
          zeitNachrechnen();
          return sendJson(res, { ok: true, ...r });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    // Sofortiger Abgleich auf Knopfdruck. Ohne ihn stuende bis zum naechsten
    // Takt im Ticket noch der alte Arbeitswert, waehrend das Dashboard bereits
    // den neuen zeigt — zwei Quellen mit verschiedenen Zahlen.
    if (p === '/api/jira-sync' && req.method === 'POST') {
      return syncJira().then((r) => sendJson(res, r, r.ok ? 200 : 409));
    }

    if (p === '/api/saetze') {
      return sendJson(res, {
        standard: config.stundensatz,
        waehrung: config.waehrung,
        projekte: config.projektSaetze || {},
      });
    }

    // Rechnungs-Stammdaten. Sie stehen auf jeder Rechnung, ohne sie laesst
    // sich keine erstellen — deshalb ueber die Oberflaeche pflegbar. Zugaenge
    // (Jira, Token, Pfade) bleiben der Datei vorbehalten: die oeffnen Zugriff,
    // statt nur ein Dokument zu beschriften.
    if (p === '/api/stammdaten' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, ...setzeStammdaten(daten) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/stammdaten') {
      const a = rechnung.stammdaten();
      const r = config.rechnung || {};
      const werte = {};
      for (const [feld, regel] of Object.entries(STAMMDATEN)) {
        const quelle = regel.wurzel ? r : a;
        werte[feld] = {
          wert: quelle[feld] === undefined ? '' : quelle[feld],
          typ: regel.typ,
          label: regel.label,
          max: regel.max,
          min: regel.min,
          zeilen: regel.zeilen,
          pflicht: !!regel.pflicht,
        };
      }
      return sendJson(res, { werte, fehlt: rechnung.fehlendeStammdaten() });
    }

    // Einstellungen lesen und schreiben. Nur die Felder aus EINSTELLUNGEN —
    // Zugangsdaten und Pfade bleiben bewusst der Datei vorbehalten.
    if (p === '/api/einstellungen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const geaendert = setzeEinstellungen(daten);
          zeitNachrechnen();
          return sendJson(res, { ok: true, geaendert });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/einstellungen') {
      // Das Zeitmodell zuerst: es bestimmt, was die Pausenschwelle darunter bedeutet.
      const werte = {
        zeitmodell: {
          wert: config.zeitmodell === 'aktivitaet' ? 'aktivitaet' : 'eingaben',
          wahl: ZEITMODELLE, label: 'Zeitmodell',
        },
      };
      for (const [feld, regel] of Object.entries(EINSTELLUNGEN)) {
        // Verschachtelte Felder stehen unter ihrer Gruppe, nicht oben.
        const wert = regel.pfad
          ? (config[regel.pfad.split('.')[0]] || {})[regel.pfad.split('.')[1]]
          : config[feld];
        werte[feld] = {
          // Fehlt der Wert oder ist er ungueltig, rechnet zeit.js mit dem Standard — dann zeigt ihn auch die Oberflaeche.
          wert: regel.standard !== undefined && !(Number.isFinite(wert) && wert >= regel.min && wert <= regel.max && (!regel.ganz || Number.isInteger(wert)))
            ? regel.standard : wert,
          min: regel.min, max: regel.max, label: regel.label,
          ...(regel.aus !== undefined ? { aus: regel.aus } : {}),
        };
      }
      return sendJson(res, { werte, waehrung: config.waehrung, pfad: 'config.json' });
    }

    // Arbeitsbereiche: lesen mit Erreichbarkeit des Ordners; schreiben nur
    // Kuerzel, Farbe und Verweise (Pfade bleiben der Datei vorbehalten).
    if (p === '/api/arbeitsbereich' && req.method === 'POST') return antworte(req, res, setzeArbeitsbereich);
    // Skill-Kacheln im Cockpit (C4): Namen je Arbeitsbereich, gestartet als Ablauf (C6b).
    if (p === '/api/cira/skills' && req.method === 'GET') {
      const alle = arbeitsbereiche();
      const name = u.searchParams.get('arbeitsbereich');
      const ab = name ? alle.find((a) => a.name === name) : alle[0];
      if (name && !ab) return sendJson(res, { error: 'Arbeitsbereich unbekannt.' }, 404);
      const skills = skillsIn(ab);
      return sendJson(res, { arbeitsbereich: ab ? ab.name : null, arbeitsbereiche: alle.map((a) => a.name), skills: skills.slice(0, 60), mehr: Math.max(0, skills.length - 60) });
    }

    if (p === '/api/arbeitsbereiche') {
      const liste = arbeitsbereiche().map(arbeitsbereichAnzeige);
      return sendJson(res, { arbeitsbereiche: liste, vorschlag: liste.length ? null : arbeitsbereichVorschlag(), pfad: 'config.json' });
    }

    // --- Rechnungen ---------------------------------------------------------
    // Alle POSTs laufen bereits durch die Herkunftspruefung weiter oben.
    if (p === '/api/rechnungen') {
      return sendJson(res, { rechnungen: rechnung.liste(db) });
    }

    // Eine Rechnung samt Zahlungen (aufgeklappte Zeile). Die Nummer prueft
    // rechnung.lade() — alles andere ist 404, auch Pfadanteile.
    const einzel = req.method === 'GET' && p.match(/^\/api\/rechnung\/([^/]+)$/);
    if (einzel) {
      let nr = '';
      try { nr = decodeURIComponent(einzel[1]); } catch { /* kaputtes %-Escape: bleibt leer, also 404 */ }
      const d = rechnung.detail(db, nr);
      return d ? sendJson(res, d) : sendJson(res, { error: 'Rechnung nicht gefunden.' }, 404);
    }

    if (p === '/api/zahlung' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, zahlung: rechnung.bucheZahlung(db, daten || {}) });
        } catch (e) {
          return sendJson(res, { error: e.message }, 400);
        }
      });
    }

    if (p === '/api/zahlung-loeschen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, ...rechnung.loescheZahlung(db, (daten || {}).id) });
        } catch (e) {
          return sendJson(res, { error: e.message }, 400);
        }
      });
    }

    if (p === '/api/rechnung' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        let r;
        try {
          r = stelleRechnung(db, daten || {});
        } catch (err) {
          // 409: der Betrag weicht von der Vorschau ab, nichts geschrieben.
          return sendJson(res, { error: err.message }, err.abweichung ? 409 : 400);
        }
        return sendJson(res, { ok: true, ...r });
      });
    }

    // Vorschau fuer den Beleg-Editor (R6): dasselbe Druck-HTML, aber ohne
    // Nummer und ohne Schreiben. JSON statt text/html, damit die Summen vom
    // Server mitkommen und der Editor nichts nachrechnet.
    if (p === '/api/beleg-vorschau' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        const d = daten || {};
        if (d.art !== 'rechnung' && d.art !== 'angebot') return sendJson(res, { error: 'Belegart unbekannt.' }, 400);
        // Wie bei der E-Rechnung: fehlende Pflichtangaben sind kein
        // Eingabefehler, der Editor nennt sie und verweist auf die Einstellungen.
        const fehlt = rechnung.fehlendeStammdaten();
        if (fehlt.length) return sendJson(res, { error: 'Rechnungs-Stammdaten unvollstaendig.', fehlt }, 422);
        try {
          if (d.art === 'angebot') return sendJson(res, angebot.vorschau(db, d));
          const kid = kontakte.pruefeId(db, d.kontaktId);
          return sendJson(res, rechnung.vorschau(db, { ...d, kontaktId: kid }));
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/rechnung-storno' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const storno = rechnung.storniere(db, String((daten || {}).nr || ''));
          return sendJson(res, { ok: true, nr: storno.nr });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/rechnung-pdf' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        return rechnung.erzeugePdf(db, String(daten.nr || ''), config.port)
          .then((r) => sendJson(res, { ok: true, ...r }))
          .catch((err) => sendJson(res, { error: err.message }, 400));
      });
    }

    // --- Angebote ------------------------------------------------------------
    if (p === '/api/angebote') {
      return sendJson(res, { angebote: angebot.liste(db) });
    }

    if (p === '/api/angebot' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const ang = angebot.erstelle(db, daten);
          return sendJson(res, { ok: true, nr: ang.nr, brutto_eur: ang.brutto_eur });
        } catch (err) {
          return sendJson(res, { error: err.message }, err.abweichung ? 409 : 400);
        }
      });
    }

    if (p === '/api/angebot-status' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const ang = angebot.setzeStatus(db, String(daten.nr || ''), String(daten.status || ''), daten.stand);
          return sendJson(res, { ok: true, nr: ang.nr, status: ang.status, gueltig_bis: ang.gueltig_bis,
            angenommen_am: ang.angenommen_am, abgelehnt_am: ang.abgelehnt_am, kunde_geworden: ang.kunde_geworden });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/angebot-loeschen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, ...angebot.loesche(db, String(daten.nr || '')) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/angebot-rechnung' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const r = angebot.inRechnung(db, String(daten.nr || ''));
          return sendJson(res, { ok: true, nr: r.rechnung.nr, brutto_eur: r.rechnung.brutto_eur });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    // --- Kontakte (Leads und Kunden) -----------------------------------------
    if (p === '/api/kontakte') {
      // Kennzahlen der Akte (R10) vom Server, je Kontakt; ohne Belege alles 0.
      const jk = rechnung.jeKontakt(db);
      const leer = { umsatz_bezahlt_eur: 0, offen_eur: 0, zahlungsdauer_tage: null, angebote_offen: 0, rechnungen: 0 };
      return sendJson(res, { kontakte: kontakte.liste(db).map((k) => ({ ...k, kennzahlen: jk.get(k.id) || leer })) });
    }

    // Ansprechpartner (R11). Die Id kommt aus der Abfrage, also als Text: erst
    // pruefen, dann lesen — "abc" ist kein Kontakt, nicht "keiner".
    if (p === '/api/ansprechpartner' && req.method === 'GET') {
      try {
        const kid = kontakte.pruefeId(db, u.searchParams.get('kontakt') || undefined);
        if (kid === null) throw new Error('Unbekannter Kontakt.');
        return sendJson(res, { ansprechpartner: kontakte.ansprechpartnerVon(db, kid) });
      } catch (err) {
        return sendJson(res, { error: err.message }, 400);
      }
    }

    if (p === '/api/ansprechpartner' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, ansprechpartner: kontakte.speichereAnsprechpartner(db, daten) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/ansprechpartner-loeschen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, ...kontakte.loescheAnsprechpartner(db, (daten || {}).id) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/kontakt' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, kontakt: kontakte.speichere(db, daten) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/kontakt-loeschen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          kontakte.loesche(db, daten.id);
          return sendJson(res, { ok: true });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    // --- Positionsvorlagen ----------------------------------------------------
    // Bewusst hier und nicht in einem eigenen Modul: zwei Spalten, drei
    // Endpunkte, keine Dokumentlogik. Eine Vorlage fuellt eine Zeile vor, mehr
    // nicht — sie geht nie selbst in eine Abschrift ein.
    if (p === '/api/vorlagen') {
      return sendJson(res, { vorlagen: vorlagenListe(db) });
    }

    if (p === '/api/vorlage' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          return sendJson(res, { ok: true, vorlage: setzeVorlage(db, daten) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/vorlage-loeschen' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          loescheVorlage(db, daten.id);
          return sendJson(res, { ok: true });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    // --- Zeiterfassung -------------------------------------------------------
    // Gerechnet wird in zeit.js; hier nur Ein- und Ausgabe.
    if (p === '/api/zeit' && req.method === 'POST') {
      return antworte(req, res, (d) => {
        const e = zeit.speichere(db, d, d.id ?? null, { wahlen: d && d.wahlen });
        return { eintrag: e, ...(e.rohzeit_min > 8 * 60 ? { warnung: 'Eintrag länger als 8 Stunden.' } : {}) };
      });
    }
    if (p === '/api/zeit-loeschen' && req.method === 'POST') return antworte(req, res, (d) => zeit.loesche(db, d.id));
    if (p === '/api/zeit/vorschau' && req.method === 'POST') return antworte(req, res, (d) => zeit.vorschau(db, d, d.id ?? null));
    if (p === '/api/zeit/wahl' && req.method === 'POST') {
      return antworte(req, res, (d) => zeit.waehle(db, d.eintrag_id, d.session_id, d.wahl));
    }
    // Termine und Kalender (Z6a). Kalendertermine werden nur gelesen; lokal
    // angelegte (kalender_id 'lokal') sind aenderbar. Zugaenge nur aus config.json.
    if (p === '/api/termine') {
      try {
        return sendJson(res, { termine: kalender.termine(db, { from: u.searchParams.get('from') || undefined, to: u.searchParams.get('to') || undefined }) });
      } catch (err) {
        return sendJson(res, { error: err.message }, 400);
      }
    }
    if (p === '/api/termin' && req.method === 'POST') return antworte(req, res, (d) => ({ termin: kalender.speichereTermin(db, d) }));
    if (p === '/api/termin-loeschen' && req.method === 'POST') return antworte(req, res, (d) => kalender.loescheTermin(db, d));
    if (p === '/api/termin-ziel' && req.method === 'POST') return antworte(req, res, (d) => ({ termin: kalender.setzeZiel(db, d) }));
    if (p === '/api/kalender') {
      // fehler = ungueltige Eintraege in config.json, verwaist = Termine von
      // Konten, die dort nicht mehr stehen. Beides muss die Oberflaeche zeigen.
      return sendJson(res, { konten: kalender.status(db), fehler: kalender.KONTEN.fehler, verwaist: kalender.verwaist(db), takt_minuten: kalender.TAKT_MS / 60000 });
    }
    if (p === '/api/kalender-sync' && req.method === 'POST') {
      // "Verbindung testen": sofort abgleichen, Ergebnis je Konto zurueck.
      // Eigene Fehler 400 mit Text, alles andere 500 ohne Rohtext, Stack ins Protokoll.
      return leseKoerper(req, async (fehler, d) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const id = d && typeof d === 'object' && !Array.isArray(d) ? d.id : undefined;
          return sendJson(res, { ok: true, ergebnisse: await kalender.syncJetzt(db, typeof id === 'string' ? id : undefined) });
        } catch (err) {
          const eigen = err instanceof kalender.KalenderFehler;
          if (!eigen) console.error('Kalender-Abgleich fehlgeschlagen:', err);
          if (res.headersSent) return res.end();
          return sendJson(res, { error: eigen ? err.message : 'Abgleich fehlgeschlagen (Details im Serverprotokoll).' }, eigen ? 400 : 500);
        }
      });
    }
    // ICS-Kalender aus der Oberflaeche verbinden bzw. trennen (Owner-Entscheidung
    // 12.10.2026). Die Adresse geht nur hinein, die Antwort traegt den Status (Host).
    if ((p === '/api/kalender-verbinden' || p === '/api/kalender-trennen') && req.method === 'POST') {
      const speichern = (liste) => {
        const alt = config.kalender;
        config.kalender = liste;
        try { schreibeConfig(); } catch (err) { config.kalender = alt; throw err; }
      };
      return leseKoerper(req, async (fehler, d) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const r = p === '/api/kalender-verbinden' ? await kalender.verbinde(db, d, { speichern }) : await kalender.trenne(db, d, { speichern });
          return sendJson(res, { ...r, ergebnis: undefined, konten: kalender.status(db), fehler: kalender.KONTEN.fehler, verwaist: kalender.verwaist(db) });
        } catch (err) {
          const eigen = err instanceof kalender.KalenderFehler;
          if (!eigen) console.error('Kalender verbinden/trennen fehlgeschlagen:', err);
          if (res.headersSent) return res.end();
          return sendJson(res, { error: eigen ? err.message : 'Nicht gespeichert (Details im Serverprotokoll).' }, eigen ? 400 : 500);
        }
      });
    }
    // Hinweise bei Blocker-Beginn (Z6b) und Workload der naechsten 7 Tage.
    if (p === '/api/zeit-hinweise') return sendJson(res, { hinweise: kalender.hinweise(db) });
    if (p === '/api/zeit-hinweis-weg' && req.method === 'POST') return antworte(req, res, (d) => kalender.hinweisWeg(db, d));
    if (p === '/api/zeit/workload') return sendJson(res, zeit.workload(db));
    if (p === '/api/zeit/woche' || p === '/api/zeit/monat' || p === '/api/zeit/ziele-tabelle' || p === '/api/zeit/analyse') {
      try {
        const q = (k) => u.searchParams.get(k) || undefined;
        const r = { from: q('from'), to: q('to') };
        return sendJson(res, p === '/api/zeit/woche' ? zeit.woche(db, q('montag'))
          : p === '/api/zeit/monat' ? zeit.monat(db, r)
            : p === '/api/zeit/ziele-tabelle' ? { ziele: zeit.zieleTabelle(db, r) } : zeit.analyse(db, r));
      } catch (err) {
        return sendJson(res, { error: err.message }, 400);
      }
    }
    if (p === '/api/zeit/ueberlappung') {
      try {
        return sendJson(res, zeit.ueberlappungVon(db, u.searchParams.get('id')));
      } catch (err) {
        return sendJson(res, { error: err.message }, 400);
      }
    }
    if (p === '/api/zeit/timer-start' && req.method === 'POST') return antworte(req, res, (d) => zeit.timerStart(db, d));
    if (p === '/api/zeit/timer-stop' && req.method === 'POST') return antworte(req, res, () => zeit.timerStop(db));
    if (p === '/api/zeit/timer-verwerfen' && req.method === 'POST') return antworte(req, res, () => zeit.timerVerwerfen(db));
    if (p === '/api/zeit/timer-wahl' && req.method === 'POST') return antworte(req, res, (d) => zeit.timerWahl(db, d.session_ids ?? d.session_id, d.wahl));
    if (p === '/api/zeit/timer-zurueck' && req.method === 'POST') return antworte(req, res, (d) => zeit.timerZurueck(db, d.id));
    if (p === '/api/taetigkeitsarten' && req.method === 'POST') {
      return antworte(req, res, (d) => {
        const t = zeit.setzeTaetigkeit(db, d);
        zeitNachrechnen();
        return { taetigkeit: t };
      });
    }
    if (p === '/api/taetigkeitsart-loeschen' && req.method === 'POST') return antworte(req, res, (d) => zeit.loescheTaetigkeit(db, d.name));
    if (p === '/api/zeit/timer') {
      // Eine kaputte Vorschau (Ziel inzwischen ungueltig) nimmt den Timer nicht mit.
      let vorschau = null;
      let fehler = null;
      try { vorschau = zeit.timerVorschau(db); } catch (err) { fehler = err.message; console.error('Timer-Vorschau:', err.message); }
      return sendJson(res, { timer: zeit.timerAktuell(db), vorschau, ...(fehler ? { vorschau_fehler: fehler } : {}) });
    }
    if (p === '/api/taetigkeitsarten') return sendJson(res, zeit.taetigkeiten(db));
    if (p === '/api/zeit/ziele' || p === '/api/zeit') {
      try {
        const q = (k) => u.searchParams.get(k) || undefined;
        return sendJson(res, p === '/api/zeit/ziele'
          ? zeit.ziele(db, u.searchParams.get('q') || '')
          : { eintraege: zeit.liste(db, { from: q('from'), to: q('to'), ziel_art: q('ziel_art'), ziel_schluessel: q('ziel_schluessel'), status: q('status') }) });
      } catch (err) {
        return sendJson(res, { error: err.message }, 400);
      }
    }

    if (p.startsWith('/api/')) return sendJson(res, { error: 'Unbekannter Endpunkt' }, 404);

    // Das erzeugte PDF ausliefern. Ohne diese Route entsteht die Datei zwar im
    // Datenordner, ist aber ueber die Oberflaeche nicht erreichbar — der Knopf
    // sieht dann wirkungslos aus. Die Nummer wird streng geprueft, bevor aus
    // ihr ein Dateipfad wird.
    if (p.startsWith('/rechnung-pdf/')) {
      const nr = p.slice('/rechnung-pdf/'.length).replace(/\.pdf$/, '');
      if (!/^\d{4}-\d{4}$/.test(nr)) return sendText(res, 'Nicht gefunden', 404);
      const datei = path.join(__dirname, 'data', 'rechnungen', nr + '.pdf');
      if (!fs.existsSync(datei)) return sendText(res, 'Nicht gefunden', 404);
      return fs.readFile(datei, (err, buf) => {
        if (err) return sendText(res, 'Nicht gefunden', 404);
        res.writeHead(200, {
          'content-type': 'application/pdf',
          // inline: im Browser anzeigen, Herunterladen bleibt moeglich.
          'content-disposition': `inline; filename="Rechnung-${nr}.pdf"`,
          'cache-control': 'no-store',
        });
        res.end(buf);
      });
    }

    // E-Rechnung als Datei zum Herunterladen.
    if (p.startsWith('/rechnung-xml/')) {
      const nr = p.slice('/rechnung-xml/'.length).replace(/\.xml$/, '');
      if (!/^\d{4}-\d{4}$/.test(nr)) return sendText(res, 'Nicht gefunden', 404);
      const antwort = eRechnungAntwort(db, nr);
      res.writeHead(antwort.status, antwort.kopf);
      return res.end(antwort.inhalt);
    }

    // Druckansicht. Muss vor der Auslieferung statischer Dateien stehen, sonst
    // sucht der Server eine Datei dieses Namens. Die Nummer wird streng
    // geprueft, damit ueber den Pfad nichts anderes adressierbar ist.
    if (p.startsWith('/rechnung/')) {
      const nr = p.slice('/rechnung/'.length);
      if (!/^\d{4}-\d{4}$/.test(nr)) return sendText(res, 'Nicht gefunden', 404);
      const inv = rechnung.lade(db, nr);
      if (!inv) return sendText(res, 'Nicht gefunden', 404);
      return sendText(res, rechnung.renderHtml(inv), 200, 'text/html; charset=utf-8');
    }

    if (p.startsWith('/angebot/')) {
      const nr = p.slice('/angebot/'.length);
      if (!/^AN-\d{4}-\d{4}$/.test(nr)) return sendText(res, 'Nicht gefunden', 404);
      const ang = angebot.lade(db, nr);
      if (!ang) return sendText(res, 'Nicht gefunden', 404);
      return sendText(res, angebot.renderHtml(ang), 200, 'text/html; charset=utf-8');
    }

    // Seit 2.0 ist die Oberflaeche unter / (R15). Lesezeichen auf den alten
    // Einstieg landen dort; der Hash (#/rechnungen …) bleibt im Browser erhalten.
    if (p === '/app.html') {
      res.writeHead(301, { location: '/' });
      return res.end();
    }
    return serveStatic(res, p);
  } catch (err) {
    // Vollstaendig ins Serverprotokoll, aber nur eine allgemeine Meldung an den
    // Aufrufer: Fehlertexte aus Datenbank oder Dateisystem enthalten Pfade.
    console.error('Fehler bei', p, err);
    return sendJson(res, { error: 'Interner Fehler, Details im Serverprotokoll' }, 500);
  }
}

const server = http.createServer(handle);

// Jira-Abgleich laeuft nur, wenn er in der Konfiguration eingeschaltet ist
// und ein Zugangstoken bereitsteht. Fehler beenden den Server nicht.
async function syncJira() {
  const r = await syncJiraLauf();
  letzterJira = { at: new Date().toISOString(), ok: r.ok, grund: r.grund || '' };
  return r;
}
async function syncJiraLauf() {
  if (!config.jira || !config.jira.enabled) {
    return { ok: false, grund: 'Jira-Abgleich ist ausgeschaltet.' };
  }
  try {
    const res = await jira.run({ db });
    const geschrieben = res.results.filter((r) => r.action !== 'unveraendert');
    const fehler = res.results.filter((r) => r.action === 'Fehler');
    if (geschrieben.length) {
      console.log(`Jira: ${geschrieben.length} Ticket(s) aktualisiert.`);
    }
    if (res.skipped) return { ok: false, grund: 'Kein Jira-Zugang (Token oder E-Mail fehlt).' };
    return {
      ok: true,
      geprueft: res.results.length,
      aktualisiert: geschrieben.length - fehler.length,
      fehler: fehler.length,
    };
  } catch (err) {
    console.error('Jira-Abgleich fehlgeschlagen:', err.message);
    // Der Fehlertext kann Jira-Antworten enthalten, deshalb nur allgemein nach aussen.
    return { ok: false, grund: 'Abgleich fehlgeschlagen, Details im Serverprotokoll.' };
  }
}

// Ein Platzhalter- oder Tippfehler-Pfad in "jsonlDir" faellt sonst nirgends auf:
// das Einlesen findet keine Dateien und der Server meldet 0 Requests. Das sieht
// aus wie "heute nichts gearbeitet", ist aber ein Einrichtungsfehler. Unter
// macOS/Linux traefe das jede frische Installation, weil die Vorlage
// zwangslaeufig den Pfad eines Systems nennen muss.
function pruefeLogverzeichnis() {
  const dir = ingest.jsonlDir();
  if (dir && fs.existsSync(dir)) return;
  const beispiel = process.platform === 'win32'
    ? '%USERPROFILE%\\.claude\\projects'
    : '~/.claude/projects';
  console.error(
    ['Hinweis: das in config.json unter "jsonlDir" eingetragene Verzeichnis gibt es nicht:',
      '  ' + (dir || '(leer)'),
      'Ohne dieses Verzeichnis werden keine Sitzungen gefunden, alle Zahlen bleiben auf null.',
      'Ueblich ist:',
      '  ' + beispiel,
      ''
    ].join('\n')
  );
}

// Der Modell-Proxy laeuft mit dem Server (Owner 15.10.2026, Q3): ohne ihn
// erreicht Cira kein lokales Modell und lokale Arbeit bleibt unerfasst. Laeuft
// er schon (Autostart, npm run proxy), ist der Port belegt — das ist kein
// Fehler. Die Probe startet ihn nie, sie wuerde dem echten Proxy den Port nehmen.
async function starteModellProxy({ start = (port) => require('./ollama-proxy').start(port) } = {}) {
  const lm = config.lokaleModelle;
  if (!(lm && lm.upstreamUrl) || process.env.C2I_PROBE === '1') return null;
  const port = Number(lm.proxyPort) || 11435;
  proxyStartFehler = null;
  try {
    await start(port);
    console.log('Modell-Proxy laeuft auf 127.0.0.1:' + port);
    return 'eigen';
  } catch (err) {
    // Ob auf dem belegten Port wirklich der Proxy laeuft, zeigt der Dienst-Status (Kennung).
    if (err && err.code === 'EADDRINUSE') { console.log('Modell-Proxy: Port ' + port + ' belegt, Proxy laeuft extern.'); return 'extern'; }
    proxyStartFehler = String((err && (err.code || err.message)) || 'unbekannt').slice(0, 60);
    console.error('Modell-Proxy nicht gestartet:', err && err.message);
    return null;
  }
}

async function main() {
  pruefeLogverzeichnis();
  // Erst den Port, dann alles andere. Die geplante Aufgabe startet alle zehn
  // Minuten neu; lief der Dienst schon, las die zweite Instanz bisher trotzdem
  // die Logs ein und glich mit Jira ab, bevor listen() am belegten Port
  // scheiterte — mit dem Code, der gerade ausgecheckt war, gegen die echte
  // Datenbank (gefunden beim Hotfix 2.0.2).
  try {
    await new Promise((ok, nein) => {
      server.once('error', nein);
      server.listen(config.port, '127.0.0.1', () => { server.off('error', nein); ok(); });
    });
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${config.port} ist belegt — c2invoice laeuft schon, diese Instanz endet.`);
      process.exit(0);
    }
    throw err;
  }
  // Erst nach listen(): eine zweite Instanz (oder der Selfcheck, der server.js
  // laedt) darf die Sitzungen der laufenden nicht als beendet markieren.
  try { sitzungDienst.aufraeumen(); } catch (e) { console.error('Sitzungen aufraeumen:', e); }
  try { ablaufDienst.aufraeumen(); } catch (e) { console.error('Ablaeufe aufraeumen:', e); }
  if (!geraeteSchutz) console.warn('WARNUNG: Geraeteschutz ist aus (C2I_GERAETESCHUTZ=aus) — jeder lokale Prozess kann schreiben.');
  // Geheimnis fuer den Hook fremder Sitzungen (C5): einmal erzeugen, steht
  // nur in config.json und geht in keine Antwort.
  if (!config.hook || typeof config.hook.geheimnis !== 'string' || config.hook.geheimnis.length < 32) {
    config.hook = { ...(config.hook || {}), geheimnis: crypto.randomBytes(32).toString('base64url') };
    // Scheitert das Schreiben, findet integration/claude-hook.mjs kein Geheimnis und meldet still nichts.
    try { schreibeConfig(); } catch (e) { console.error('Hook-Geheimnis nicht gespeichert, der Hook meldet nichts:', e.message); }
  }
  await starteModellProxy();
  await refreshData();
  // Beim Start alle offenen: Aenderungen an config.json wirken erst nach einem
  // Neustart, und Logs koennen laenger als 48 h ausgeblieben sein.
  zeitNachrechnen();
  setInterval(refreshData, 30_000).unref();
  erinnern();
  setInterval(erinnern, 30_000).unref();
  // C9: Index und Monatsbericht (nachgeholt, wenn der Server am 1. nicht lief).
  vaultTakt();
  setInterval(vaultTakt, 30_000).unref();

  if (config.jira && config.jira.enabled) {
    await syncJira();
    const takt = Math.max(5, config.jira.syncIntervalMinutes || 60) * 60_000;
    setInterval(syncJira, takt).unref();
  }

  const s = metrics.summary(db);
  console.log(`c2invoice laeuft auf http://127.0.0.1:${config.port}`);
  console.log(
    `Daten: ${s.requests} Requests, ${(s.total_tokens / 1e6).toFixed(0)} Mio Tokens, ` +
    `$${s.cost_usd.toFixed(2)} (${s.first_day} bis ${s.last_day})`
  );
}

// SIGTERM/SIGHUP wie SIGINT: process.exit loest 'exit' aus, und das beendet
// die eigenen Claude-Sitzungen mit (sitzungDienst.beendeAlle).
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = {
  server, refreshData,
  setzeEinstellungen, EINSTELLUNGEN, SCHREIBBAR,
  setzeArbeitsbereich, ARBEITSBEREICH_FELDER,
  setzeCira, CIRA_FELDER, ciraEinstellungen,
  setzeVault, vaultAnzeige, VAULT_FELDER,
  diensteCacheLeeren: () => { dienstStand = { zeit: 0, laeuft: null, wert: null }; },
  starteModellProxy,
  setzeStammdaten, STAMMDATEN,
  vorlagenListe, setzeVorlage, loescheVorlage,
  bucheVorgang, eRechnungAntwort, vormerkeVorgang, hookErlaubt,
  // Tests: Schutz einschalten und einen Dienst mit eigener DB einsetzen.
  setzeGeraeteSchutz: (an) => { geraeteSchutz = !!an; }, setzeGeraeteDienst: (d) => { geraeteDienst = d; },
  setzeSatz, setzeZeitmodell, csvExport,
};
