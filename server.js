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

const db = dbmod.open();
// Altrechnungen ohne Faelligkeitstag einmal festschreiben (Ampel, Druck).
try { rechnung.faelligFestschreiben(db); } catch (e) { console.error('Faelligkeit festschreiben:', e); }
const PUBLIC = path.join(__dirname, 'public');

let lastIngest = { at: null, ms: 0, events: 0, error: null };
let ingesting = false;

// Kennung des laufenden Programmstands. Der Server haelt seinen Code im
// Speicher: wird server.js geaendert, laeuft der alte Stand weiter, bis der
// Dienst neu startet. Die Oberflaeche kann dann Felder anfordern, die es beim
// laufenden Server noch nicht gibt — sichtbar wird das als 404 an einer Stelle,
// die eben noch ging. Aus dem letzten Aenderungszeitpunkt der Programmdateien
// entsteht deshalb eine Kennung, an der die Oberflaeche einen Versionssprung
// erkennt und zum Neuladen auffordert, statt einen Fehler zu zeigen.
const CODE_STAND = (() => {
  const dateien = ['server.js', 'metrics.js', 'rechnung.js', 'erechnung.js', 'angebot.js', 'ingest.js',
    'public/index.html'];
  // Die neue Oberflaeche besteht aus mehreren Dateien; eine Festliste wuerde
  // bei jeder neuen Datei veralten.
  try {
    for (const d of fs.readdirSync(path.join(__dirname, 'public', 'app'))) dateien.push('public/app/' + d);
  } catch { /* Ordner fehlt: egal */ }
  let neuestes = 0;
  for (const d of dateien) {
    try { neuestes = Math.max(neuestes, fs.statSync(path.join(__dirname, d)).mtimeMs); } catch { /* fehlt: egal */ }
  }
  return String(Math.round(neuestes));
})();

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
// selfcheck prueft den Hash). Kein frame-ancestors: Obsidian bettet die Seite ein.
// Nur fuer HTML — object-src 'none' auf einer PDF-Antwort legte Chromes Anzeige lahm.
const CSP = "default-src 'self'; script-src 'self' 'sha256-E6jQvrT2ZivWG9GJ4AAEZf4MhI7l3QkLroW4hgvUT4c='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'";

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

// Die Datei neu schreiben, ohne die uebrigen Einstellungen zu verlieren.
function schreibeConfig() {
  const pfad = path.join(__dirname, 'config.json');
  const roh = JSON.parse(fs.readFileSync(pfad, 'utf8'));
  roh.projektSaetze = config.projektSaetze;
  roh.stundensatz = config.stundensatz;
  for (const feld of Object.keys(EINSTELLUNGEN)) roh[feld] = config[feld];
  if (config.zeitmodell !== undefined) roh.zeitmodell = config.zeitmodell;
  // Verschachtelter Block, der Schleife oben entgeht er deshalb.
  if (config.rechnung) roh.rechnung = config.rechnung;
  // Kalender-Konten (ICS aus der Oberflaeche, kalender.verbinde/trenne).
  if (config.kalender !== undefined) roh.kalender = config.kalender;
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
  const HERKUNFT_ERLAUBT = ['app://obsidian.md', 'capacitor://localhost'];
  const herkunft = req.headers.origin;
  if (herkunft && (HERKUNFT_ERLAUBT.includes(herkunft) || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(herkunft))) {
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
  if (req.method === 'POST' && ziel && ziel !== 'same-origin' && ziel !== 'none') {
    return sendJson(res, { error: 'Fremde Herkunft' }, 403);
  }
  // Aeltere Browser schicken Sec-Fetch-Site nicht, Origin aber bei jedem POST.
  // Erlaubt: die eigene Seite und die freigegebenen Einbettungen. Ohne Origin
  // (curl, Skripte) bleibt der Aufruf wie bisher moeglich.
  if (req.method === 'POST' && herkunft && herkunft !== 'http://' + host && !HERKUNFT_ERLAUBT.includes(herkunft)) {
    return sendJson(res, { error: 'Fremde Herkunft' }, 403);
  }

  try {
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
        },
        pricing: pricing.info(),
        lastIngest,
        codeStand: CODE_STAND,
      });
    }

    if (p === '/api/live') {
      // Begrenzen, damit unsinnige Werte kein ungueltiges Datum erzeugen.
      const raw = Number(u.searchParams.get('minutes'));
      const minutes = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 60 * 24 * 31) : 60;
      return sendJson(res, { ...metrics.live(db, { minutes }), timer: zeit.timerAktuell(db), lastIngest });
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
      });
    }

    if (p === '/api/refresh') {
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
        let inv, kid;
        try {
          // Die Pruefung gehoert hierher und nicht in rechnung.js: dort waere
          // ein require auf kontakte.js ein Kreis ueber angebot.js.
          kid = kontakte.pruefeId(db, daten.kontaktId);
          inv = rechnung.erstelle(db, { ...daten, kontaktId: kid });
        } catch (err) {
          // 409: der Betrag weicht von der Vorschau ab, nichts geschrieben.
          return sendJson(res, { error: err.message }, err.abweichung ? 409 : 400);
        }
        // Ab hier ist die Rechnung geschrieben. Was danach scheitert, darf
        // nicht als Absage zurueckgehen — der Editor hielte sie fuer nicht
        // erstellt, und ein zweiter Versuch zoege eine zweite Nummer.
        let erechnungFehlt = [];
        try {
          // Wer eine Rechnung bekommt, ist kein Lead mehr.
          kontakte.macheKunde(db, kid);
          // Gleich sagen, was der E-Rechnung fehlt: eine gestellte Rechnung
          // laesst sich nicht mehr ergaenzen, nur stornieren.
          erechnungFehlt = erechnung.pruefe(inv);
        } catch (err) {
          console.error('Nach dem Erstellen von', inv.nr, err);
        }
        return sendJson(res, { ok: true, nr: inv.nr, brutto_eur: inv.brutto_eur, erechnung_fehlt: erechnungFehlt });
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
          const ang = angebot.setzeStatus(db, String(daten.nr || ''), String(daten.status || ''));
          return sendJson(res, { ok: true, nr: ang.nr, status: ang.status });
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

async function main() {
  pruefeLogverzeichnis();
  await refreshData();
  // Beim Start alle offenen: Aenderungen an config.json wirken erst nach einem
  // Neustart, und Logs koennen laenger als 48 h ausgeblieben sein.
  zeitNachrechnen();
  setInterval(refreshData, 30_000).unref();
  erinnern();
  setInterval(erinnern, 30_000).unref();

  if (config.jira && config.jira.enabled) {
    await syncJira();
    const takt = Math.max(5, config.jira.syncIntervalMinutes || 60) * 60_000;
    setInterval(syncJira, takt).unref();
  }

  server.listen(config.port, '127.0.0.1', () => {
    const s = metrics.summary(db);
    console.log(`c2invoice laeuft auf http://127.0.0.1:${config.port}`);
    console.log(
      `Daten: ${s.requests} Requests, ${(s.total_tokens / 1e6).toFixed(0)} Mio Tokens, ` +
      `$${s.cost_usd.toFixed(2)} (${s.first_day} bis ${s.last_day})`
    );
  });
}

process.on('SIGINT', () => {
  server.close();
  db.close();
  process.exit(0);
});

if (require.main === module) main();

module.exports = {
  server, refreshData,
  setzeEinstellungen, EINSTELLUNGEN,
  setzeStammdaten, STAMMDATEN,
  vorlagenListe, setzeVorlage, loescheVorlage,
  bucheVorgang, eRechnungAntwort,
  setzeSatz, setzeZeitmodell, csvExport,
};
