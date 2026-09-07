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
const angebot = require('./angebot');
const kontakte = require('./kontakte');

const db = dbmod.open();
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
  const dateien = ['server.js', 'metrics.js', 'rechnung.js', 'angebot.js', 'ingest.js', 'public/index.html'];
  let neuestes = 0;
  for (const d of dateien) {
    try { neuestes = Math.max(neuestes, fs.statSync(path.join(__dirname, d)).mtimeMs); } catch { /* fehlt: egal */ }
  }
  return String(Math.round(neuestes));
})();

// Der Abgleich laeuft im Hintergrund weiter, damit die Oberflaeche ohne
// Zutun aktuell bleibt. Dank gemerkter Leseposition kostet ein Lauf
// nur wenige Millisekunden.
async function refreshData() {
  if (ingesting) return;
  ingesting = true;
  try {
    const res = await ingest.run({ db });
    // Muss direkt hinter das Einlesen: dessen UPSERT setzt ticket bei jedem
    // erneuten Lesen einer Datei auf die Branch-Zuordnung zurueck. Der
    // Backfill stellt die nachtraegliche Zuordnung sofort wieder her.
    backfill.run({ db });
    lastIngest = { at: new Date().toISOString(), ms: res.ms, events: res.events, error: null };
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
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
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

// Setzt Satz und/oder Rabatt eines Projekts und schreibt die Konfiguration.
// Beides zusammen ist erlaubt: der Rabatt wirkt dann auf den eigenen Satz.
function setzeSatz({ projekt, satz, rabatt, kunde }) {
  if (typeof projekt !== 'string' || !projekt.trim()) {
    throw new Error('Projektname fehlt.');
  }
  const eintrag = {};

  if (satz !== null && satz !== undefined && satz !== '') {
    const n = Number(satz);
    if (!Number.isFinite(n) || n < 0) throw new Error('Stundensatz muss eine Zahl ab 0 sein.');
    eintrag.satz = Math.round(n * 100) / 100;
  }
  if (rabatt !== null && rabatt !== undefined && rabatt !== '') {
    const n = Number(rabatt);
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
  return { projekt, ...metrics.satzFuerProjekt(projekt) };
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

function setzeEinstellungen(daten) {
  if (!daten || typeof daten !== 'object') throw new Error('Keine Daten empfangen.');
  const geaendert = {};

  for (const [feld, regel] of Object.entries(EINSTELLUNGEN)) {
    const wert = daten[feld];
    if (wert === undefined || wert === null || wert === '') continue;
    const n = Number(wert);
    if (!Number.isFinite(n)) throw new Error(regel.label + ': keine gueltige Zahl.');
    // Manche Felder kennen einen Aus-Wert ausserhalb ihres Gueltigkeitsbereichs:
    // ein Vergleichsfaktor muss ueber 1 liegen, um sinnvoll zu sein, soll sich
    // aber mit 0 ganz abschalten lassen.
    const abgeschaltet = regel.aus !== undefined && n === regel.aus;
    if (!abgeschaltet && (n < regel.min || n > regel.max)) {
      throw new Error(
        `${regel.label}: muss zwischen ${regel.min} und ${regel.max} liegen` +
        (regel.aus !== undefined ? ` (oder ${regel.aus} zum Abschalten).` : '.')
      );
    }
    // Auf zwei Nachkommastellen, sonst stehen Fliesskomma-Reste in der Datei.
    const wert2 = Math.round(n * 100) / 100;
    if (regel.pfad) {
      const [gruppe, schluessel] = regel.pfad.split('.');
      if (!config[gruppe] || typeof config[gruppe] !== 'object') config[gruppe] = {};
      config[gruppe][schluessel] = wert2;
    } else {
      config[feld] = wert2;
    }
    geaendert[feld] = wert2;
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
  kleinunternehmer: { typ: 'schalter', label: 'Kleinunternehmer nach Par. 19 UStG', wurzel: true },
  ustSatz: { typ: 'zahl', min: 0, max: 30, label: 'Umsatzsteuersatz in Prozent', wurzel: true },
  zahlungszielTage: { typ: 'zahl', min: 0, max: 120, label: 'Zahlungsziel in Tagen', wurzel: true },
};

// Grobpruefung, keine Pruefsummenrechnung: Laenge und Zeichenvorrat. Ein
// Zahlendreher faellt damit nicht auf, ein vertippter Buchstabensalat schon.
const IBAN_RE = /^[A-Z]{2}[0-9A-Z]{13,32}$/;

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

  for (const [feld, regel] of Object.entries(STAMMDATEN)) {
    if (!(feld in daten)) continue;
    const roh = daten[feld];
    if (roh === undefined || roh === null) continue;
    const ziel = stammZiel(regel);

    if (regel.typ === 'schalter') {
      ziel[feld] = !!roh;
    } else if (regel.typ === 'zahl') {
      if (roh === '') continue;
      const n = Number(roh);
      if (!Number.isFinite(n)) throw new Error(regel.label + ': keine gueltige Zahl.');
      if (n < regel.min || n > regel.max) {
        throw new Error(`${regel.label}: muss zwischen ${regel.min} und ${regel.max} liegen.`);
      }
      ziel[feld] = Math.round(n * 100) / 100;
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
        if (z.length > regel.max) throw new Error(`${regel.label}: hoechstens ${regel.max} Zeichen je Zeile.`);
      }
      ziel[feld] = zeilen;
    } else {
      let s = String(roh).trim();
      if (regel.typ === 'iban') s = s.replace(/\s+/g, '').toUpperCase();
      if (s.length > regel.max) throw new Error(`${regel.label}: hoechstens ${regel.max} Zeichen.`);
      if (regel.typ === 'iban' && s && !IBAN_RE.test(s)) throw new Error(regel.label + ': Form nicht plausibel.');
      ziel[feld] = s;
    }
    geaendert[feld] = ziel[feld];
  }

  if (Object.keys(geaendert).length === 0) throw new Error('Kein bekanntes Feld uebergeben.');
  schreibeConfig();
  // Bewusst kein Abbruch bei fehlenden Pflichtangaben: Stammdaten entstehen
  // schrittweise. Wer eine Rechnung erstellt, laeuft ohnehin in die harte
  // Pruefung aus rechnung.js — hier wird nur gemeldet, was noch aussteht.
  return { geaendert, fehlt: rechnung.fehlendeStammdaten() };
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
    satz = Number(daten.satz);
    if (!Number.isFinite(satz) || satz < 0 || satz > 10000) {
      throw new Error('Stundensatz muss zwischen 0 und 10000 liegen.');
    }
    satz = Math.round(satz * 100) / 100;
  }

  const id = daten.id === undefined || daten.id === '' ? null : Number(daten.id);
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
  const nr = Number(id);
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
  // Verschachtelter Block, der Schleife oben entgeht er deshalb.
  if (config.rechnung) roh.rechnung = config.rechnung;
  const tmp = pfad + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(roh, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, pfad);
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

function handle(req, res) {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = u.pathname;

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

  try {
    if (p === '/api/summary') {
      const o = opts(u);
      return sendJson(res, {
        summary: metrics.summary(db, o),
        models: metrics.byModel(db, o),
        days: metrics.byDay(db, o),
        // Dieselbe Reihe in groeberer Koernung. Der Umschalter am Diagramm
        // wechselt nur die Quelle, statt im Frontend nachzusummieren — sonst
        // stuende die Formel ein zweites Mal da.
        months: metrics.byMonth(db, o),
        years: metrics.byYear(db, o),
        projects: metrics.byProject(db, o),
        tickets: metrics.byTicket(db, o),
        // Getrennt gehalten, nicht unter "tickets" gemischt: diese Zeilen
        // tragen keinen Vorgangsschluessel, und alles was tickets liest
        // (Jira-Abgleich, Rechnung, Angebot) setzt einen voraus.
        ohne_ticket: metrics.ohneTicket(db, o),
        split: metrics.splitOverhead(db, o),
        werkzeuge: metrics.werkzeuge(db, o),
        // Andere Sicht auf dieselben Tokens: woher die Requests der eigenen
        // Sitzungen kamen. Aendert keine Abrechnung, siehe metrics.herkunft().
        herkunft: metrics.herkunft(db, o),
        // Zeitraumunabhaengig: eine Rechnung bleibt gestellt, auch wenn der
        // Filter gerade einen anderen Ausschnitt zeigt.
        abrechnung: rechnung.abrechnung(db),
        // Welcher Kunde hinter welchem Projekt steht. Der Rechnungen-Tab waehlt
        // damit die Vorgaenge eines Kunden vor; gerechnet wird daran nichts,
        // deshalb hier statt in metrics — das kennt keine Kontakte.
        projekt_kontakt: kontakte.kontaktJeProjekt(db),
        config: {
          stundensatz: config.stundensatz,
          waehrung: config.waehrung,
          aboPreisMonat: config.aboPreisMonat,
          aboWaehrung: config.aboWaehrung,
          usdToEur: config.usdToEur,
          gapMinutes: config.gapMinutes,
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
      return sendJson(res, { ...metrics.live(db, { minutes }), lastIngest });
    }

    if (p === '/api/tickets') return sendJson(res, metrics.byTicket(db, opts(u)));
    if (p === '/api/projects') return sendJson(res, metrics.byProject(db, opts(u)));
    if (p === '/api/models') return sendJson(res, metrics.byModel(db, opts(u)));
    if (p === '/api/timeline') return sendJson(res, metrics.byDay(db, opts(u)));

    // Kundenbericht: ein Ticket je Zeile, Semikolon als Trenner fuer Excel (DE).
    if (p === '/api/export.csv') {
      const rows = metrics.byTicket(db, opts(u));
      const komma = (n) => Number(n || 0).toFixed(2).replace('.', ',');
      const head = [
        'Ticket', 'Kunde', 'Requests', 'Sessions', 'Von', 'Bis',
        'Tokens gesamt', 'Tokens Arbeit', 'Tokens Werkzeuge',
        'Input', 'Output', 'Cache geschrieben', 'Cache gelesen',
        'Aktive Stunden', 'Stundensatz ' + config.waehrung, 'Rabatt %',
        'Arbeitswert ' + config.waehrung,
        'API-Gegenwert USD', 'davon Werkzeuge USD', 'Abo-Anteil USD',
      ];
      const lines = [head.join(';')];
      for (const t of rows) {
        lines.push([
          t.ticket, t.kunde || '', t.requests, t.sessions, t.first_day, t.last_day,
          t.gesamt_tokens, t.total_tokens, t.werkzeug_tokens,
          t.input_tokens, t.output_tokens, t.cache_write_tokens, t.cache_read_tokens,
          komma(t.active_hours), komma(t.stundensatz), komma(t.rabatt_prozent),
          komma(t.arbeitswert),
          komma(t.api_gegenwert_usd), komma(t.werkzeug_cost_usd), komma(t.abo_anteil_usd),
        ].map(csvEscape).join(';'));
      }
      res.writeHead(200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="token-ledger.csv"',
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
      return sendJson(res, {
        ...row,
        models: metrics.byModel(db, { ticket: key }),
        days: metrics.byDay(db, { ticket: key }),
        abgerechnet: abr,
        wert: metrics.mehrwert(row, abr ? abr.betrag_eur : 0),
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
          return sendJson(res, { ok: true, geaendert: setzeEinstellungen(daten) });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/einstellungen') {
      const werte = {};
      for (const [feld, regel] of Object.entries(EINSTELLUNGEN)) {
        // Verschachtelte Felder stehen unter ihrer Gruppe, nicht oben.
        const wert = regel.pfad
          ? (config[regel.pfad.split('.')[0]] || {})[regel.pfad.split('.')[1]]
          : config[feld];
        werte[feld] = {
          wert, min: regel.min, max: regel.max, label: regel.label,
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

    if (p === '/api/rechnung' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          // Die Pruefung gehoert hierher und nicht in rechnung.js: dort waere
          // ein require auf kontakte.js ein Kreis ueber angebot.js.
          const kid = kontakte.pruefeId(db, daten.kontaktId);
          const inv = rechnung.erstelle(db, { ...daten, kontaktId: kid });
          // Wer eine Rechnung bekommt, ist kein Lead mehr.
          kontakte.macheKunde(db, kid);
          return sendJson(res, { ok: true, nr: inv.nr, brutto_eur: inv.brutto_eur });
        } catch (err) {
          return sendJson(res, { error: err.message }, 400);
        }
      });
    }

    if (p === '/api/rechnung-storno' && req.method === 'POST') {
      return leseKoerper(req, (fehler, daten) => {
        if (fehler) return sendJson(res, { error: fehler }, 400);
        try {
          const storno = rechnung.storniere(db, String(daten.nr || ''));
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
          return sendJson(res, { error: err.message }, 400);
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
      return sendJson(res, { kontakte: kontakte.liste(db) });
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
  setInterval(refreshData, 30_000).unref();

  if (config.jira && config.jira.enabled) {
    await syncJira();
    const takt = Math.max(5, config.jira.syncIntervalMinutes || 60) * 60_000;
    setInterval(syncJira, takt).unref();
  }

  server.listen(config.port, '127.0.0.1', () => {
    const s = metrics.summary(db);
    console.log(`Token-Ledger laeuft auf http://127.0.0.1:${config.port}`);
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
  bucheVorgang,
};
