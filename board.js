'use strict';
// Board (Masterplan 3.0, C7a): Karten aus TODO.md je Arbeitsbereich und aus
// Jira, mit Zeit und Wert aus c2invoice. Entwurf design/cira/C7-BOARD.md.
//
// TODO-Format (Owner 20.10.2026, wie die Task-Roadmap): eine Zeile je Aufgabe
//   - [ ] Text @id:JRV-12 @status:todo|in-progress|review|done @prio:wichtig @jira:DEV-5
// Akzeptanzkriterien = direkt folgende eingerueckte Checkboxen. Lesen schreibt
// nie; geschrieben wird genau eine Zeile, Zeilenenden und BOM bleiben.

const fs = require('node:fs');
const path = require('node:path');
const ereignisse = require('./ereignisse');
const metrics = require('./metrics');
const rechnung = require('./rechnung');
const { routenHelfer } = require('./sitzungen');

const KARTE_RE =/^ ?[-*] \[([ xX])\] (.*)$/;
const KRITERIUM_RE = /^(?: {2,}|\t)\s*[-*] \[([ xX])\] (.*)$/;
const TAG_RE = /\s*@[A-Za-z]+:\S+/g;
const SPALTE_TAG = { offen: 'todo', arbeit: 'in-progress', review: 'review', erledigt: 'done' };

function fehler(status, text) {
  const e = new Error(text);
  e.status = status;
  return e;
}

const tag = (s, name) => {
  const m = s.match(new RegExp('@' + name + ':(\\S+)', 'i'));
  return m ? m[1] : null;
};

function spalteAus(status, erledigt) {
  const s = (status || '').toLowerCase();
  if (erledigt || s === 'done') return 'erledigt';
  if (s === 'in-progress') return 'arbeit';
  if (s === 'review') return 'review';
  return 'offen';
}

// Zeilen samt ihrer Trenner: so bleibt eine Datei mit gemischten Zeilenenden
// beim Zusammensetzen byte-gleich.
function zerlege(text) {
  const bom = text.charCodeAt(0) === 0xfeff;
  const teile = (bom ? text.slice(1) : text).split(/(\r?\n)/);
  const zeilen = [];
  const trenner = [];
  for (let i = 0; i < teile.length; i += 2) {
    zeilen.push(teile[i]);
    trenner.push(teile[i + 1] || '');
  }
  return { bom, zeilen, trenner, eol: text.includes('\r\n') ? '\r\n' : '\n' };
}
const fuege = ({ bom, zeilen, trenner }) => (bom ? '\uFEFF' : '') + zeilen.map((z, i) => z + trenner[i]).join('');

function parseTodo(text) {
  const { bom, zeilen, eol } = zerlege(text);
  const karten = [];
  let letzte = null;
  zeilen.forEach((roh, zeile) => {
    const k = roh.match(KRITERIUM_RE);
    if (k && letzte) {
      letzte.kriterien.push({ zeile, roh, text: k[2].trim(), erledigt: k[1] !== ' ' });
      return;
    }
    const m = roh.match(KARTE_RE);
    if (!m) { letzte = null; return; }
    const erledigt = m[1] !== ' ';
    const status = tag(m[2], 'status');
    letzte = {
      zeile, roh,
      text: m[2].replace(TAG_RE, '').replace(/\s{2,}/g, ' ').trim(),
      id: tag(m[2], 'id'), status, spalte: spalteAus(status, erledigt),
      prio: tag(m[2], 'prio'), jira: tag(m[2], 'jira'), kriterien: [],
    };
    karten.push(letzte);
  });
  return { bom, eol, zeilen, karten };
}

// Prueft, dass die Zeile noch die ist, die der Nutzer gesehen hat, und
// ersetzt genau sie.
function ersetzeZeile(text, { zeile, roh }, fn) {
  const z = zerlege(text);
  if (!Number.isInteger(zeile) || z.zeilen[zeile] !== roh) throw fehler(409, 'Die Datei hat sich geändert. Bitte neu laden.');
  z.zeilen[zeile] = fn(roh);
  return fuege(z);
}

function setzeStatus(text, karte, spalte) {
  const neu = SPALTE_TAG[spalte];
  if (!neu) throw fehler(400, 'Unbekannte Spalte.');
  return ersetzeZeile(text, karte, (roh) => {
    const z = roh.replace(/\[[ xX]\]/, spalte === 'erledigt' ? '[x]' : '[ ]');
    return /@status:\S+/i.test(z) ? z.replace(/@status:\S+/i, '@status:' + neu) : z.replace(/\s*$/, '') + ' @status:' + neu;
  });
}

function setzeKriterium(text, kriterium, erledigt) {
  return ersetzeZeile(text, kriterium, (roh) => roh.replace(/\[[ xX]\]/, erledigt ? '[x]' : '[ ]'));
}

// Neue @id fuer eine Zeile ohne. Praefix = haeufigstes der Datei, sonst das
// Kuerzel des Arbeitsbereichs; nie ein Jira-Projektschluessel, sonst
// kommentierte der Jira-Abgleich ein fremdes echtes Ticket.
function vergibId(text, karte, { kuerzel, gesperrt = [] }) {
  const vorhanden = tag(karte.roh || '', 'id');
  if (vorhanden) {
    ersetzeZeile(text, karte, (r) => r);
    return { text, id: vorhanden };
  }
  const zaehl = new Map();
  for (const m of text.matchAll(/@id:([A-Za-z][A-Za-z0-9]*)-(\d+)/g)) zaehl.set(m[1], (zaehl.get(m[1]) || 0) + 1);
  const sperre = new Set(gesperrt.map((s) => String(s).toUpperCase()));
  const frei = (p) => p && !sperre.has(p.toUpperCase());
  let praefix = [...zaehl.entries()].sort((a, b) => b[1] - a[1])[0];
  praefix = praefix && frei(praefix[0]) ? praefix[0] : String(kuerzel || '').toUpperCase();
  if (!frei(praefix)) throw fehler(409, 'Kein freies Kürzel für neue Aufgaben-IDs. Bitte ein Kürzel für den Arbeitsbereich in config.json setzen.');
  let max = 0;
  for (const m of text.matchAll(new RegExp('@id:' + praefix + '-(\\d+)', 'g'))) max = Math.max(max, Number(m[1]));
  const id = praefix + '-' + (max + 1);
  return { text: ersetzeZeile(text, karte, (roh) => roh.replace(/\s*$/, '') + ' @id:' + id), id };
}

// Jira-Status → Spalte: nach Namen, sonst nach Kategorie (new/indeterminate/done).
// Jira ist oft lokalisiert (HDO 20.10.: "Wird überprüft", "In Arbeit", "Fertig").
function jiraSpalte(status, kat) {
  const s = String(status || '');
  // Erledigt zuerst: "Review abgeschlossen" (Kategorie done) gehoert in Erledigt,
  // sonst fehlte sein offener Betrag in "Erledigt · nicht abgerechnet".
  if (kat === 'done') return 'erledigt';
  if (/review|überprüf|prüfung/i.test(s)) return 'review';
  if (/^in progress$/i.test(s)) return 'arbeit';
  if (kat === 'indeterminate') return 'arbeit';
  return 'offen';
}

const STANDARD_UEBERGANG = {
  offen: /^(to do|zu erledigen|offen|open)$/i, arbeit: /^(in progress|in arbeit)$/i,
  review: /^(in review|review|wird überprüft)$/i, erledigt: /^(done|fertig|erledigt)$/i,
};

const CACHE_MS = 120000;

// "Als Jira-Ticket anlegen" (Owner 20.10.: Jira ist die Wahrheit): alles, was
// auf der @id gebucht ist, geht in einem Schritt auf den Jira-Key ueber.
// Gestellte Rechnungen bleiben Abschriften (Par. 14 UStG) und werden nicht
// angefasst; steht dort schon etwas auf der @id, wird nicht umgebucht.
const UMBUCHEN = [
  ['events', 'UPDATE events SET ticket = ? WHERE ticket = ? COLLATE NOCASE'],
  ['activity', 'UPDATE activity SET ticket = ? WHERE ticket = ? COLLATE NOCASE'],
  ['overrides', 'UPDATE overrides SET ticket = ? WHERE ticket = ? COLLATE NOCASE'],
  ['zeit_eintrag', "UPDATE zeit_eintrag SET ziel_schluessel = ? WHERE ziel_art = 'vorgang' AND ziel_schluessel = ? COLLATE NOCASE"],
  ['termin', "UPDATE termin SET ziel_schluessel = ? WHERE ziel_art = 'vorgang' AND ziel_schluessel = ? COLLATE NOCASE"],
  ['sitzung', 'UPDATE sitzung SET vorgang = ? WHERE vorgang = ? COLLATE NOCASE'],
  ['vorgang_log', 'UPDATE vorgang_log SET vorgang = ? WHERE vorgang = ? COLLATE NOCASE'],
  ['ablauf', 'UPDATE ablauf SET vorgang = ? WHERE vorgang = ? COLLATE NOCASE'],
  // Hat der neue Key schon eine Zeitmodell-Wahl, gilt seine; die alte faellt weg.
  ['zeitmodell_wahl', "UPDATE OR IGNORE zeitmodell_wahl SET schluessel = ? WHERE art = 'vorgang' AND schluessel = ? COLLATE NOCASE"],
  // Ebenso das Budget: hat der neue Key schon eins, gilt seins.
  ['vorgang_budget', 'UPDATE OR IGNORE vorgang_budget SET vorgang = ? WHERE vorgang = ? COLLATE NOCASE'],
];
function uebernehmeZeit(db, alt, neu) {
  if (!alt || !neu) throw fehler(400, 'Alter und neuer Schlüssel fehlen.');
  if (rechnung.gestelltAuf(db, alt)) throw fehler(409, 'Auf ' + alt + ' ist schon etwas in Rechnung gestellt — die Zeit bleibt dort, sonst wäre sie unter dem Jira-Ticket ein zweites Mal abrechenbar.');
  const n = {};
  db.exec('BEGIN');
  try {
    for (const [tabelle, sql] of UMBUCHEN) n[tabelle] = Number(db.prepare(sql).run(neu, alt).changes);
    db.prepare("DELETE FROM zeitmodell_wahl WHERE art = 'vorgang' AND schluessel = ? COLLATE NOCASE").run(alt);
    db.prepare('DELETE FROM vorgang_budget WHERE vorgang = ? COLLATE NOCASE').run(alt);
    db.exec('COMMIT');
  } catch (e) {
    // Hat SQLite schon zurueckgerollt, wirft ROLLBACK selbst — die eigentliche Ursache zaehlt.
    try { db.exec('ROLLBACK'); } catch { /* keine offene Transaktion mehr */ }
    throw e;
  }
  return n;
}

// Dienst je Server: Arbeitsbereiche, Dateien, Jira-Cache und Routen.
// bereiche() liefert die Eintraege aus config.json, loeseHeim loest ~ auf.
function erzeuge({ db, bereiche, loeseHeim, gesperrt = () => [], jira = require('./jira-sync'), jetzt = () => Date.now() }) {
  function bereich(name) {
    const b = bereiche().find((a) => a.name === name);
    if (!b) throw fehler(404, 'Arbeitsbereich unbekannt.');
    return b;
  }

  // Ruling R-Pfade: Pfade nur aus config.json, nie aus einer Anfrage.
  function todoPfad(b) {
    if (b.todo) return loeseHeim(b.todo);
    const ordner = b.pfad ? loeseHeim(b.pfad) : null;
    return ordner ? path.join(ordner, 'TODO.md') : null;
  }

  function lokal(name) {
    const b = bereich(name);
    const datei = todoPfad(b);
    if (!datei) return { karten: [], datei: null, hinweis: 'Kein Pfad in config.json — ohne Ordner keine lokalen Aufgaben.' };
    let text;
    try { text = fs.readFileSync(datei, 'utf8'); } catch (e) {
      // Standardpfad ohne Datei ist normal (nicht jeder Ordner fuehrt eine TODO.md);
      // ein eingetragenes todo, das fehlt, ist falsch eingestellt und wird gemeldet.
      if (e.code === 'ENOENT' && !b.todo) return { karten: [], datei: null, hinweis: null };
      if (e.code === 'ENOENT') return { karten: [], datei, hinweis: 'Aufgabendatei aus config.json fehlt (' + path.basename(datei) + ').' };
      throw e;
    }
    const karten = parseTodo(text).karten.map((k) => ({ ...k, bereich: b.name, quelle: 'md', schluessel: k.jira || k.id || b.name + ':' + k.zeile }));
    return { karten, datei, hinweis: null };
  }

  // Frisch lesen, genau eine Zeile aendern (fn prueft die Zeile), ueber eine
  // Temp-Datei ersetzen: ein Abbruch mittendrin laesst die alte Datei stehen.
  function schreibeZeile(name, karte, fn) {
    const datei = todoPfad(bereich(name));
    if (!datei) throw fehler(409, 'Kein Pfad in config.json.');
    const text = fs.readFileSync(datei, 'utf8');
    // Kein gueltiges UTF-8: Lesen und Schreiben ersetzte die kaputten Bytes in der ganzen Datei.
    if (text.includes('\uFFFD')) throw fehler(409, path.basename(datei) + ' ist kein gültiges UTF-8 — bitte in einem Editor als UTF-8 speichern.');
    const neu = fn(text, karte);
    if (neu === text) return neu;
    const tmp = datei + '.c2i-tmp';
    try {
      fs.writeFileSync(tmp, neu);
      fs.renameSync(tmp, datei);
    } catch (e) {
      // Datei im Editor gesperrt o. ae.: keine Temp-Datei im Projekt des Nutzers liegen lassen.
      fs.rmSync(tmp, { force: true });
      throw e;
    }
    return neu;
  }

  const ausCache = (projekt) => db.prepare('SELECT felder_json FROM jira_issue WHERE projekt = ? ORDER BY key').all(projekt)
    .map((r) => { const i = JSON.parse(r.felder_json); return { ...i, spalte: jiraSpalte(i.status, i.statusKat) }; });

  // Tickets eines Jira-Projekts, hoechstens alle 120 s frisch geholt. Ein
  // Jira-Fehler laesst den letzten Stand stehen und steht in stand.fehler —
  // das Board zeigt dann trotzdem die lokalen Karten.
  // doneKeys: Liste oder Funktion; die Funktion laeuft nur, wenn wirklich neu geholt wird.
  // Nach einem Jira-Fehler 120 s Pause: sonst wartete jede Anfrage erneut bis zum Timeout.
  const jiraFehler = new Map();
  // Nach "Als Jira anlegen": Projekt sofort neu abgleichen, auch innerhalb der 120 s.
  const veraltet = new Set();
  // Abruf ohne Aenderung schreibt nicht (Block L: jedes Schreiben leert den
  // Zwischenspeicher der Zeitrechnung); sein Zeitpunkt steht dann nur hier.
  const geholtJe = new Map();
  const laufend = new Map();
  // hintergrund (Board): ein veralteter Stand kommt sofort, der Abgleich laeuft
  // danach und meldet eine Aenderung per jira_cache. nachzug = dessen Promise.
  async function jiraKarten(projekt, doneKeys = [], { hintergrund = false } = {}) {
    const inDb = db.prepare('SELECT MAX(geholt) AS g FROM jira_issue WHERE projekt = ?').get(projekt).g;
    const letzt = [inDb, geholtJe.get(projekt)].filter(Boolean).sort().pop() || null;
    if (letzt && !veraltet.has(projekt) && jetzt() - Date.parse(letzt) < CACHE_MS) return { karten: ausCache(projekt), stand: { geholt: letzt, fehler: null, hinweis: null } };
    const pause = jiraFehler.get(projekt);
    if (pause && jetzt() < pause.bis) return { karten: ausCache(projekt), stand: { geholt: letzt || null, fehler: pause.fehler, hinweis: null } };
    if (!hintergrund || !inDb) return abgleich(projekt, doneKeys, letzt);
    let nachzug = laufend.get(projekt);
    if (!nachzug) {
      nachzug = abgleich(projekt, doneKeys, letzt)
        // Auch ein Fehler soll sichtbar werden: das Board laedt dann und zeigt die Pause.
        .then((r) => { if (r.geaendert || r.stand.fehler) ereignisse.sende('jira_cache', { projekt }); return r; })
        .catch((e) => { console.error('Board: Jira-Abgleich im Hintergrund ' + projekt + ':', e); })
        .finally(() => laufend.delete(projekt));
      laufend.set(projekt, nachzug);
    }
    return { karten: ausCache(projekt), stand: { geholt: letzt, fehler: null, hinweis: null }, nachzug };
  }

  async function abgleich(projekt, doneKeys, letzt) {
    // Lokale Ursache (DB) ist kein Jira-Fehler: getrennt melden, ohne erledigte Tickets weiter.
    let keys = [];
    let hinweis = null;
    try { keys = typeof doneKeys === 'function' ? doneKeys() : doneKeys; } catch (e) {
      console.error('Board: Done-Kandidaten fuer ' + projekt + ':', e);
      hinweis = 'Erledigte Jira-Tickets mit offener Zeit nicht bestimmbar: ' + e.message;
    }
    let liste;
    try { liste = await jira.holeIssues(projekt, { doneKeys: keys }); } catch (e) {
      console.error('Board: Jira ' + projekt + ':', e.message);
      jiraFehler.set(projekt, { bis: jetzt() + CACHE_MS, fehler: e.message });
      return { karten: ausCache(projekt), stand: { geholt: letzt || null, fehler: e.message, hinweis } };
    }
    jiraFehler.delete(projekt);
    veraltet.delete(projekt);
    // Nach dem await, ohne weiteres await dazwischen: ein Block, eine Transaktion.
    const geholt = new Date(jetzt()).toISOString();
    const alt = db.prepare('SELECT key, status, felder_json FROM jira_issue WHERE projekt = ?').all(projekt);
    const vorher = new Map(alt.map((r) => [r.key, r.status]));
    const altJson = new Map(alt.map((r) => [r.key, r.felder_json]));
    if (alt.length === liste.length && liste.every((i) => altJson.get(i.key) === JSON.stringify(i))) {
      geholtJe.set(projekt, geholt);
      return { karten: ausCache(projekt), stand: { geholt, fehler: null, hinweis }, geaendert: false };
    }
    const ein = db.prepare(`INSERT INTO jira_issue (key, projekt, status, status_kat, felder_json, aktualisiert, geholt) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET projekt = excluded.projekt, status = excluded.status, status_kat = excluded.status_kat,
      felder_json = excluded.felder_json, aktualisiert = excluded.aktualisiert, geholt = excluded.geholt`);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM jira_issue WHERE projekt = ?').run(projekt);
      for (const i of liste) ein.run(i.key, projekt, i.status, i.statusKat, JSON.stringify(i), i.aktualisiert, geholt);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    for (const i of liste) {
      const von = vorher.get(i.key);
      if (von !== undefined && von !== i.status) ereignisse.sende('jira_status', { key: i.key, von, nach: i.status });
    }
    return { karten: ausCache(projekt), stand: { geholt, fehler: null, hinweis }, geaendert: true };
  }

  // --- Karten je Arbeitsbereich -------------------------------------------------
  const lokalKarte = (k) => ({
    schluessel: k.schluessel, bereich: k.bereich, quelle: 'md', id: k.id, jira: k.jira, titel: k.text, spalte: k.spalte,
    statusRoh: k.status, prio: k.prio, zeile: k.zeile, roh: k.roh, kriterien: k.kriterien,
  });
  const jiraKarte = (i, b) => ({
    schluessel: i.key, bereich: b, quelle: 'jira', id: i.key, jira: i.key, titel: i.titel, spalte: i.spalte,
    statusRoh: i.status, prio: i.prio, kriterien: i.kriterien.map((x, n) => ({ ...x, nr: n })), issue: i,
    // Scrum-Sicht: aeltere Cache-Zeilen kennen sprintStatus/epic noch nicht (bis zum naechsten Abgleich).
    punkte: Number.isFinite(i.punkte) ? i.punkte : null, sprint: i.sprint || null, sprintStatus: i.sprintStatus || null, zugewiesen: i.zugewiesen || null, epic: i.epic || null,
  });

  // Doneschluessel: erledigte Jira-Tickets mit offener Zeit (sonst bliebe die
  // Spalte "Erledigt · nicht abgerechnet" fuer Jira leer).
  function doneKeys(projekt, zeilen) {
    const keys = [...new Set(zeilen.map((t) => t.ticket))].filter((t) => jira.KEY_RE.test(t) && t.startsWith(projekt + '-'));
    return rechnung.mitOffenem(db, keys, zeilen);
  }

  // Rohe Karten eines Bereichs ohne Werte. quelle: alle | jira | lokal.
  // zeilen: metrics.byTicket(db, {}) vom Aufrufer; fehlt sie, wird sie nur bei Bedarf geholt.
  async function karten(b, quelle = 'alle', zeilen = null) {
    let lok = { karten: [], datei: null, hinweis: null };
    if (quelle !== 'jira') {
      try { lok = lokal(b.name); } catch (e) { lok = { karten: [], datei: todoPfad(b), hinweis: 'Aufgabendatei nicht lesbar: ' + e.message }; }
    }
    let jr = null;
    if (quelle !== 'lokal' && b.jiraProjekt && jira.jiraAn()) jr = await jiraKarten(b.jiraProjekt, () => doneKeys(b.jiraProjekt, zeilen || metrics.byTicket(db, {})), { hintergrund: true });
    const aus = [];
    const jiraJe = new Map(((jr && jr.karten) || []).map((i) => [i.key, i]));
    for (const k of lok.karten) {
      const i = k.jira && jiraJe.get(k.jira);
      if (!i) { aus.push(lokalKarte(k)); continue; }
      // Jira ist die Wahrheit: Status und Titel von dort, Kriterien aus der Datei.
      jiraJe.delete(k.jira);
      aus.push({ ...jiraKarte(i, b.name), quelle: 'jira+md', mdId: k.id, zeile: k.zeile, roh: k.roh, kriterien: k.kriterien.length ? k.kriterien : jiraKarte(i, b.name).kriterien });
    }
    for (const i of jiraJe.values()) aus.push(jiraKarte(i, b.name));
    return { karten: aus, datei: lok.datei, hinweis: lok.hinweis, jira: jr ? jr.stand : null };
  }

  const FARBE_RE = /^#[0-9a-fA-F]{6}$/;
  const KUERZEL_RE = /^[A-Za-z0-9]{1,3}$/;
  const OFFENE_SITZUNG = ['startet', 'laeuft', 'bereit', 'wartet'];

  // Scrum-Sicht (nur lesen): Sprint-Filter vor den Summen, Gruppe je Karte fuer
  // die Zeilen der Oberflaeche. Lokale Karten haben keinen Sprint = Backlog.
  const SPRINT = { alle: () => true, aktiv: (k) => k.sprintStatus === 'active', backlog: (k) => k.sprintStatus !== 'active' };
  const GRUPPE = {
    epic: (k) => (k.epic ? { schluessel: k.epic.key, titel: k.epic.key + ' · ' + k.epic.titel } : null),
    bearbeiter: (k) => (k.zugewiesen ? { schluessel: k.zugewiesen, titel: k.zugewiesen } : null),
    prio: (k) => (k.prio ? { schluessel: String(k.prio).toLowerCase(), titel: k.prio } : null),
    bereich: (k) => ({ schluessel: k.bereich, titel: k.bereich }),
  };
  const OHNE = { epic: 'Ohne Epic', bearbeiter: 'Nicht zugewiesen', prio: 'Ohne Priorität', bereich: 'Ohne Arbeitsbereich' };

  async function board(name = 'alle', quelle = 'alle', sprint = 'alle', gruppe = 'keine') {
    if (!['alle', 'jira', 'lokal'].includes(quelle)) throw fehler(400, 'Quelle: alle, jira oder lokal.');
    if (!SPRINT[sprint]) throw fehler(400, 'Sprint: alle, aktiv oder backlog.');
    if (gruppe !== 'keine' && !GRUPPE[gruppe]) throw fehler(400, 'Gruppe: keine, epic, bearbeiter, prio oder bereich.');
    const liste = name === 'alle' ? bereiche() : [bereich(name)];
    const zeilen = metrics.byTicket(db, {});
    const werte = new Map(zeilen.map((t) => [t.ticket, t]));
    const budget = new Map(metrics.budgets(db).map((b) => [b.vorgang.toUpperCase(), b]));
    const laeuft = new Set(db.prepare(`SELECT DISTINCT vorgang FROM sitzung WHERE quelle = 'c2invoice' AND vorgang IS NOT NULL AND status IN (${OFFENE_SITZUNG.map(() => '?').join(',')})`).all(...OFFENE_SITZUNG).map((r) => r.vorgang));
    const spalten = { offen: [], arbeit: [], review: [], erledigt: [] };
    const sync = { jira: null, dateien: [], hinweise: [] };
    // Gibt es ueberhaupt einen aktiven Sprint (vor dem Filter)? Sonst waere „Aktiver
    // Sprint“ still leer (Kanban-Projekt, Sprint-Feld unbekannt, Cache noch alt).
    let aktivVorhanden = false;
    for (const b of liste) {
      const r = await karten(b, quelle, zeilen);
      sync.dateien.push({ bereich: b.name, datei: r.datei, hinweis: r.hinweis });
      if (r.jira) sync.jira = { host: hostVon(), geholt: r.jira.geholt, fehler: r.jira.fehler || (sync.jira && sync.jira.fehler) || null };
      if (r.jira && r.jira.hinweis) sync.hinweise.push(r.jira.hinweis);
      for (const k of r.karten) {
        if (k.sprintStatus === 'active') aktivVorhanden = true;
        if (SPRINT[sprint](k)) spalten[k.spalte].push(k);
      }
    }
    // Erledigt zeigt, was noch Geld bringt: offener Betrag, Karten ohne fallen weg.
    // Scheitert der offene Betrag (z. B. 2000+ offene Zeiteintraege), bleibt der
    // Rest des Boards lesbar; Erledigt zeigt den Fehler statt einer leeren Spalte.
    let offen = {};
    let offenFehler = null;
    try { offen = rechnung.offenJeVorgang(db, spalten.erledigt.map((k) => k.schluessel), zeilen); } catch (e) {
      console.error('Board: offener Betrag:', e);
      offenFehler = e.message;
      spalten.erledigt = [];
    }
    const aus = {};
    for (const [s, ks] of Object.entries(spalten)) {
      const mitWert = ks.map((k) => {
        const w = werte.get(k.schluessel);
        const o = s === 'erledigt';
        const g = gruppe === 'keine' ? null : GRUPPE[gruppe](k) || { schluessel: '', titel: OHNE[gruppe] };
        return { ...k, issue: undefined, stunden: w ? w.active_hours : 0, wert_eur: o ? offen[k.schluessel] : (w ? w.arbeitswert : 0), wert_art: o ? 'offen' : 'gesamt', sitzung_laeuft: laeuft.has(k.schluessel), gruppe: g, budget: budget.get(String(k.schluessel).toUpperCase()) || null };
      }).filter((k) => s !== 'erledigt' || k.wert_eur > 0);
      aus[s] = { karten: mitWert, summe_eur: rechnung.rund2(mitWert.reduce((a, k) => a + (k.wert_eur || 0), 0)),
        summe_punkte: rechnung.rund2(mitWert.reduce((a, k) => a + (Number(k.punkte) || 0), 0)), ...(s === 'erledigt' && offenFehler ? { fehler: offenFehler } : {}) };
    }
    // Gruppen nach Anzahl, „Ohne …“ zuletzt; Name des aktiven Sprints (mehrere Projekte: alle).
    const alleKarten = Object.values(aus).flatMap((x) => x.karten);
    const gruppen = new Map();
    for (const k of alleKarten) if (k.gruppe) { const g = gruppen.get(k.gruppe.schluessel) || { ...k.gruppe, n: 0 }; g.n++; gruppen.set(k.gruppe.schluessel, g); }
    const scrum = {
      sprint: [...new Set(alleKarten.filter((k) => k.sprintStatus === 'active').map((k) => k.sprint))].join(', ') || null,
      aktivVorhanden,
      gruppen: [...gruppen.values()].sort((a, b) => (a.schluessel === '') - (b.schluessel === '') || b.n - a.n || a.titel.localeCompare(b.titel)),
    };
    return {
      scrum,
      bereiche: bereiche().map((b) => ({ name: b.name, kuerzel: KUERZEL_RE.test(b.kuerzel || '') ? b.kuerzel.toUpperCase() : '', farbe: FARBE_RE.test(b.farbe || '') ? b.farbe.toLowerCase() : '',
        jira: !!(b.jiraProjekt && jira.jiraAn()), jiraProjekt: b.jiraProjekt || null, datei: todoPfad(b) })),
      spalten: aus, sync,
    };
  }

  function hostVon() {
    try { return new URL(require('./config.json').jira.baseUrl).host; } catch { return null; }
  }

  async function finde(schluessel, d) {
    const b = bereich(d.bereich);
    const r = await karten(b, 'alle');
    const k = r.karten.find((x) => x.schluessel === schluessel);
    // Nicht im Cache, weil Jira gerade nicht antwortet: das sagen, nicht "gibt es nicht".
    if (!k && r.jira && r.jira.fehler) throw fehler(503, 'Jira nicht erreichbar: ' + r.jira.fehler);
    if (!k) throw fehler(404, 'Aufgabe nicht gefunden. Bitte neu laden.');
    return { b, k };
  }

  async function detail(schluessel, d) {
    const { b, k } = await finde(schluessel, d);
    let i = k.issue || null;
    if (k.quelle !== 'md' && jira.jiraAn()) i = await jira.holeIssue(k.jira);
    const w = metrics.byTicket(db, { ticket: k.schluessel }).find((t) => t.ticket === k.schluessel);
    return {
      karte: { ...k, issue: undefined },
      meta: i ? { typ: i.typ, zugewiesen: i.zugewiesen, gemeldet: i.gemeldet, sprint: i.sprint, punkte: i.punkte, labels: i.labels, prio: i.prio, synchronisiert: (db.prepare('SELECT geholt FROM jira_issue WHERE key = ?').get(k.jira) || {}).geholt || null } : { prio: k.prio },
      beschreibung: i ? i.beschreibung : '', kommentare: (i && i.kommentare) || [],
      ort: k.zeile !== undefined ? { datei: todoPfad(b), zeile: k.zeile + 1 } : null,
      link: k.quelle !== 'md' && hostVon() ? 'https://' + hostVon() + '/browse/' + k.jira : null,
      ticket: { stunden: w ? w.active_hours : 0, wert_eur: w ? w.arbeitswert : 0, tokens: w ? w.total_tokens : 0 },
    };
  }

  // Lokale Zeile: @id vergeben (falls keine), dann Status — eine Lese-Schreib-Runde.
  // Mit @id wird die Zeile ueber die ID gesucht, ohne ueber Zeilennummer + Text des Clients.
  function lokalStatus(b, ziel, spalte) {
    let id = null;
    schreibeZeile(b.name, ziel, (text) => {
      let k = ziel;
      if (ziel.id) {
        k = parseTodo(text).karten.find((x) => x.id === ziel.id);
        if (!k) throw fehler(409, 'Aufgabe ' + ziel.id + ' steht nicht mehr in der Datei. Bitte neu laden.');
      }
      const r = vergibId(text, k, { kuerzel: b.kuerzel, gesperrt: [...gesperrt(), b.jiraProjekt].filter(Boolean) });
      id = r.id;
      const neu = parseTodo(r.text).karten.find((x) => x.zeile === k.zeile);
      return setzeStatus(r.text, neu, spalte);
    });
    return id;
  }

  async function status(schluessel, d) {
    if (!SPALTE_TAG[d.spalte]) throw fehler(400, 'Unbekannte Spalte.');
    const b = bereich(d.bereich);
    // Lokale Karte ohne @id: genau die Zeile, die der Nutzer gesehen hat.
    if (!jira.KEY_RE.test(schluessel) && !/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(schluessel)) {
      if (!Number.isInteger(d.zeile) || typeof d.roh !== 'string') throw fehler(400, 'Zeile und Text der Aufgabe fehlen.');
      const id = lokalStatus(b, { zeile: d.zeile, roh: d.roh }, d.spalte);
      return { karte: { schluessel: id, spalte: d.spalte }, hinweis: null };
    }
    // Lokale Karte (ohne @jira): Jira gar nicht erst fragen.
    let lokaleKarte = null;
    try { lokaleKarte = lokal(b.name).karten.find((x) => x.schluessel === schluessel && !x.jira) || null; } catch { /* Datei nicht lesbar: weiter ueber finde() */ }
    const { k } = lokaleKarte ? { k: lokalKarte(lokaleKarte) } : await finde(schluessel, d);
    if (k.jira && !jira.jiraAn()) throw fehler(409, 'Jira ist aus oder ohne Zugang — der Status dieser Aufgabe gehört Jira.');
    if (k.quelle === 'md') {
      const id = lokalStatus(b, k, d.spalte);
      return { karte: { ...k, schluessel: id, spalte: d.spalte }, hinweis: null };
    }
    const liste = await jira.transitions(k.jira);
    let wahl;
    if (d.transition !== undefined && d.transition !== null) {
      wahl = liste.find((t) => t.id === String(d.transition));
      if (!wahl) throw fehler(400, 'Diesen Übergang bietet Jira nicht an.');
    } else {
      let passend = liste.filter((t) => jiraSpalte(t.nach, t.nachKat) === d.spalte);
      // Mehrere Kandidaten (In Arbeit, Escalated, Hold …): der Standardname gewinnt.
      const standard = passend.filter((t) => STANDARD_UEBERGANG[d.spalte].test(t.nach) || STANDARD_UEBERGANG[d.spalte].test(t.name));
      if (passend.length > 1 && standard.length === 1) passend = standard;
      if (passend.length !== 1) {
        const e = fehler(409, passend.length ? 'Mehrere Übergänge passen — bitte einen wählen.' : 'Kein Übergang in diese Spalte — bitte einen wählen.');
        e.daten = { uebergaenge: liste.map((t) => ({ id: t.id, name: t.name, nach: t.nach, spalte: jiraSpalte(t.nach, t.nachKat) })) };
        throw e;
      }
      wahl = passend[0];
    }
    await jira.transition(k.jira, wahl.id);
    // Cache nachfuehren (synchron nach dem await), Ereignis wie beim Abgleich.
    // Jira ist gesetzt; ein Fehler hier darf nicht als "nicht geaendert" ankommen.
    let hinweis = null;
    try {
      const row = db.prepare('SELECT felder_json, status FROM jira_issue WHERE key = ?').get(k.jira);
      if (row) {
        const i = { ...JSON.parse(row.felder_json), status: wahl.nach, statusKat: wahl.nachKat };
        db.prepare('UPDATE jira_issue SET status = ?, status_kat = ?, felder_json = ? WHERE key = ?').run(i.status, i.statusKat, JSON.stringify(i), k.jira);
        if (row.status !== i.status) ereignisse.sende('jira_status', { key: k.jira, von: row.status, nach: i.status });
      }
    } catch (e) {
      console.error('Board: Cache nach Uebergang ' + k.jira + ':', e);
      hinweis = 'Jira ist gesetzt, der Board-Cache nicht nachgeführt (' + e.message + ') — Anzeige beim nächsten Abgleich.';
    }
    const spalte = jiraSpalte(wahl.nach, wahl.nachKat);
    if (k.quelle === 'jira+md') {
      try { lokalStatus(b, { zeile: k.zeile, roh: k.roh, id: k.mdId }, spalte); } catch (e) {
        hinweis = (hinweis ? hinweis + ' ' : '') + 'Jira ist gesetzt, die Zeile in der Aufgabendatei nicht: ' + e.message;
      }
    }
    return { karte: { ...k, issue: undefined, spalte, statusRoh: wahl.nach }, hinweis };
  }

  async function kommentar(schluessel, d) {
    if (!jira.jiraAn()) throw fehler(409, 'Jira ist aus oder ohne Zugang.');
    const text = typeof d.text === 'string' ? d.text.trim() : '';
    if (!text || text.length > 4000) throw fehler(400, 'Kommentar: 1 bis 4000 Zeichen.');
    const { k } = await finde(schluessel, d);
    if (k.quelle === 'md') throw fehler(409, 'Kommentare gehen nur an Jira-Tickets.');
    await jira.kommentiere(k.jira, text);
    return { schluessel: k.schluessel };
  }

  // Akzeptanzkriterium abhaken: nur in der Datei, nur eingerueckte Checkbox-Zeilen.
  async function kriterium(schluessel, d) {
    const b = bereich(d.bereich);
    if (!Number.isInteger(d.zeile) || typeof d.roh !== 'string' || typeof d.erledigt !== 'boolean') throw fehler(400, 'Zeile, Text und erledigt fehlen.');
    if (!KRITERIUM_RE.test(d.roh)) throw fehler(400, 'Das ist keine Kriterien-Zeile.');
    // Die Karte gehoert dazu: gleichlautende Kriterien ("Tests gruen") stehen unter
    // mehreren Karten; nach einer Verschiebung traefe die Zeilennummer sonst die falsche.
    const kt = d.karte;
    if (!kt || !Number.isInteger(kt.zeile) || typeof kt.roh !== 'string') throw fehler(400, 'Karte zum Kriterium fehlt.');
    schreibeZeile(b.name, { zeile: d.zeile, roh: d.roh }, (text) => {
      const karte = parseTodo(text).karten.find((x) => x.zeile === kt.zeile && x.roh === kt.roh);
      if (!karte || !karte.kriterien.some((x) => x.zeile === d.zeile)) throw fehler(409, 'Die Datei hat sich geändert. Bitte neu laden.');
      return setzeKriterium(text, { zeile: d.zeile, roh: d.roh }, d.erledigt);
    });
    return { schluessel };
  }

  const gesperrtFuer = (b) => [...gesperrt(), b.jiraProjekt].filter(Boolean);
  const zeileFehlt = (d) => !Number.isInteger(d.zeile) || typeof d.roh !== 'string';

  // @id vergeben, ohne den Status anzufassen ("▶ in Claude": die Sitzung bucht
  // auf die ID, nicht auf bereich:zeile). Hat die Zeile eine, bleibt sie.
  function idVergeben(schluessel, d) {
    const b = bereich(d.bereich);
    if (zeileFehlt(d)) throw fehler(400, 'Zeile und Text der Aufgabe fehlen.');
    let id = null;
    schreibeZeile(b.name, { zeile: d.zeile, roh: d.roh }, (text, k) => {
      const r = vergibId(text, k, { kuerzel: b.kuerzel, gesperrt: gesperrtFuer(b) });
      id = r.id;
      return r.text;
    });
    return { schluessel: id };
  }

  // Lokale Aufgabe → Jira-Ticket (C7b). Reihenfolge: alles Pruefbare vor dem
  // Jira-POST (Zeile unveraendert, noch kein @jira, nichts gestellt), dann
  // anlegen, dann @jira in die Zeile und die Zeit umbuchen. Ab dem POST gilt
  // Jira: scheitert danach etwas, sagt die Antwort es, statt das Ticket zu verschweigen.
  const anlage = new Set();
  // Angelegt, aber @jira nicht in die Zeile geschrieben: bereich:zeile → { roh, key }.
  // ponytail: nur im Speicher; nach einem Neustart schuetzt nur der Hinweis von damals.
  const ohneZeile = new Map();
  async function alsJira(schluessel, d) {
    const b = bereich(d.bereich);
    if (!jira.jiraAn()) throw fehler(409, 'Jira ist aus oder ohne Zugang.');
    if (!b.jiraProjekt) throw fehler(409, 'Für diesen Arbeitsbereich ist kein Jira-Projekt eingetragen (config.json, jiraProjekt).');
    if (zeileFehlt(d)) throw fehler(400, 'Zeile und Text der Aufgabe fehlen.');
    const sperre = b.name + ':' + d.zeile;
    // Doppelklick oder zweiter Tab: sonst entstuenden zwei Tickets.
    if (anlage.has(sperre)) throw fehler(409, 'Das Jira-Ticket wird schon angelegt.');
    anlage.add(sperre);
    try {
      const datei = todoPfad(b);
      if (!datei) throw fehler(409, 'Kein Pfad in config.json.');
      const karte = parseTodo(fs.readFileSync(datei, 'utf8')).karten.find((k) => k.zeile === d.zeile && k.roh === d.roh);
      if (!karte) throw fehler(409, 'Die Datei hat sich geändert. Bitte neu laden.');
      if (karte.jira) throw fehler(409, 'Diese Aufgabe hat schon ein Jira-Ticket (' + karte.jira + ').');
      const frueher = ohneZeile.get(sperre);
      if (frueher && frueher.roh === karte.roh) throw fehler(409, 'Für diese Aufgabe ist schon ' + frueher.key + ' angelegt — bitte @jira:' + frueher.key + ' in die Zeile eintragen.');
      if (karte.id) {
        // Die Datei ist nicht vertrauenswuerdig (Editor, Claude-Sitzung): eine @id mit
        // Jira-Praefix oder eine doppelte @id buchte fremde Zeit mit um.
        const praefix = karte.id.split('-')[0].toUpperCase();
        if (gesperrtFuer(b).some((p) => String(p).toUpperCase() === praefix)) throw fehler(409, 'Die ID ' + karte.id + ' sieht aus wie ein Jira-Schlüssel — so würde Zeit eines fremden Tickets umgebucht. Bitte die ID in der Datei ändern.');
        let n = 0;
        for (const a of bereiche()) {
          try { n += lokal(a.name).karten.filter((k) => String(k.id).toUpperCase() === karte.id.toUpperCase()).length; } catch { /* unlesbarer Bereich zaehlt nicht */ }
        }
        if (n > 1) throw fehler(409, 'Die ID ' + karte.id + ' steht mehrfach in den Aufgabendateien — die gebuchte Zeit lässt sich nicht eindeutig zuordnen. Bitte zuerst eindeutig machen.');
      }
      if (karte.id && rechnung.gestelltAuf(db, karte.id)) throw fehler(409, 'Auf ' + karte.id + ' ist schon etwas in Rechnung gestellt — so entstünde dieselbe Zeit unter dem Jira-Ticket ein zweites Mal. Bitte das Ticket in Jira anlegen und neue Arbeit dort buchen.');
      if (!karte.text) throw fehler(400, 'Die Aufgabe hat keinen Text.');
      const { key } = await jira.legeAn(b.jiraProjekt, { titel: karte.text, kriterien: karte.kriterien });
      const hinweise = [];
      let zeileOk = true;
      try {
        schreibeZeile(b.name, karte, (text) => ersetzeZeile(text, karte, (roh) => roh.replace(/\s*$/, '') + ' @jira:' + key));
      } catch (e) {
        console.error('Board: @jira nach Anlage von ' + key + ':', e);
        zeileOk = false;
        ohneZeile.set(sperre, { roh: karte.roh, key });
        hinweise.push('Die Zeile in der Aufgabendatei ist nicht ergänzt (' + e.message + ') — bitte @jira:' + key + ' von Hand eintragen.');
      }
      let umgebucht = {};
      if (karte.id) {
        try { umgebucht = uebernehmeZeit(db, karte.id, key); } catch (e) {
          console.error('Board: Zeit ' + karte.id + ' → ' + key + ':', e);
          hinweise.push('Die gebuchte Zeit liegt weiter auf ' + karte.id + ' (' + e.message + ').');
        }
      }
      veraltet.add(b.jiraProjekt);
      return { key, zeileOk, umgebucht, hinweis: hinweise.length ? 'Jira-Ticket ' + key + ' ist angelegt. ' + hinweise.join(' ') : null };
    } finally { anlage.delete(sperre); }
  }

  function routen(req, res, p, u, mittel) {
    if (p !== '/api/board' && !p.startsWith('/api/board/')) return false;
    const { sendJson } = mittel;
    const { fehler: fehlerAntwort, post } = routenHelfer(req, res, p, mittel, 'Board');
    if (p === '/api/board' && req.method === 'GET') {
      board(u.searchParams.get('bereich') || 'alle', u.searchParams.get('quelle') || 'alle', u.searchParams.get('sprint') || 'alle', u.searchParams.get('gruppe') || 'keine').then((r) => sendJson(res, r), fehlerAntwort);
      return true;
    }
    const m = p.match(/^\/api\/board\/([^/]{1,200})(?:\/(status|kommentar|kriterium|id|als-jira))?$/);
    if (!m) return false;
    let schluessel;
    try { schluessel = decodeURIComponent(m[1]); } catch { sendJson(res, { error: 'Schlüssel ungültig.' }, 400); return true; }
    if (!m[2] && req.method === 'GET') {
      detail(schluessel, { bereich: u.searchParams.get('bereich') }).then((r) => sendJson(res, r), fehlerAntwort);
      return true;
    }
    if (m[2] && req.method === 'POST') {
      const fn = { status, kommentar, kriterium, id: idVergeben, 'als-jira': alsJira }[m[2]];
      post((d) => fn(schluessel, d));
      return true;
    }
    return false;
  }

  return { db, bereich, todoPfad, lokal, schreibeZeile, gesperrt, jiraKarten, board, detail, status, kommentar, kriterium, idVergeben, alsJira, routen };
}

module.exports = { parseTodo, spalteAus, setzeStatus, setzeKriterium, vergibId, jiraSpalte, uebernehmeZeit, erzeuge, SPALTE_TAG };
