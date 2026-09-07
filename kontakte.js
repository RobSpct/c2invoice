'use strict';
// Leads und Kunden.
//
// Beide liegen in einer Tabelle und unterscheiden sich nur im Status. Ein Lead
// wird zum Kunden, sobald er ein Angebot annimmt — das ist ein Statuswechsel,
// kein Umzug in eine zweite Tabelle.
//
// Der Kontakt ist die Stammdatenquelle, NICHT der Inhalt eines Dokuments. Was
// auf einem Angebot oder einer Rechnung steht, ist eine Abschrift, die beim
// Erstellen eingefroren wird (siehe rechnung.js). Wer hier eine Anschrift
// korrigiert, aendert deshalb kein bereits gestelltes Dokument.

// Feldschema wie bei den Stammdaten in server.js: die Grenzen stehen an einer
// Stelle, und geprueft wird gegen das Schema, nie gegen den Anfragekoerper.
// Sonst landet irgendwann ein mitgeschicktes Feld ungeprueft in der Datenbank.
const FELDER = {
  firma:        { typ: 'text',   max: 200, pflicht: true, label: 'Firma' },
  vorname:      { typ: 'text',   max: 80,  label: 'Vorname' },
  nachname:     { typ: 'text',   max: 80,  label: 'Nachname' },
  // Dieselben Grenzen wie beim Empfaenger eines Angebots (angebot.js): der
  // Kontakt fuellt genau dieses Feld vor, engere Grenzen dort waeren wirkungslos.
  anschrift:    { typ: 'zeilen', max: 120, zeilen: 6, label: 'Anschrift' },
  steuernummer: { typ: 'text',   max: 40,  label: 'Steuernummer' },
  ustIdNr:      { typ: 'text',   max: 40,  label: 'USt-IdNr.' },
  email:        { typ: 'text',   max: 120, label: 'E-Mail' },
  notiz:        { typ: 'text',   max: 500, label: 'Notiz' },
  status:       { typ: 'wahl',   werte: ['lead', 'kunde'], label: 'Status' },
};

// Spaltennamen weichen an zwei Stellen vom Feldnamen ab (SQL mag kein
// Kamelhoeckerwort), deshalb eine ausdrueckliche Zuordnung statt Raterei.
const SPALTE = { ustIdNr: 'ust_id_nr' };

function spalteVon(feld) {
  return SPALTE[feld] || feld;
}

// U+FFFD entsteht bei kaputt uebertragenen Sonderzeichen (z.B. PowerShell
// Invoke-RestMethod ohne UTF-8). Landet sonst still auf einem Kundendokument.
function ohneErsatzzeichen(s, label) {
  if (typeof s !== 'string') throw new Error(`${label}: Text erwartet.`);
  if (s.includes('�')) throw new Error(`${label}: ungueltige Kodierung (Ersatzzeichen �).`);
}

function text(wert, max, label) {
  if (typeof wert !== 'string') throw new Error(`${label}: Text erwartet.`);
  const s = wert.trim();
  if (s.length > max) throw new Error(`${label}: hoechstens ${max} Zeichen.`);
  ohneErsatzzeichen(s, label);
  return s;
}

function zeilen(wert, { max, zeilen: maxZeilen }, label) {
  const liste = Array.isArray(wert) ? wert : String(wert == null ? '' : wert).split('\n');
  const sauber = liste
    .filter((z) => typeof z === 'string')
    .map((z) => z.trim())
    .filter(Boolean);
  if (sauber.length > maxZeilen) throw new Error(`${label}: hoechstens ${maxZeilen} Zeilen.`);
  if (sauber.some((z) => z.length > max)) throw new Error(`${label}: hoechstens ${max} Zeichen je Zeile.`);
  sauber.forEach((z) => ohneErsatzzeichen(z, label));
  return sauber;
}

// Nimmt nur bekannte Felder an und gibt zurueck, was tatsaechlich gesetzt wurde.
// Fehlende Felder bleiben fehlend: beim Aendern soll eine Teileingabe nicht die
// uebrigen Angaben leeren.
function pruefe(daten, { vollstaendig }) {
  const d = daten && typeof daten === 'object' ? daten : {};
  const werte = {};

  for (const [feld, regel] of Object.entries(FELDER)) {
    const roh = d[feld];
    if (roh === undefined) {
      if (vollstaendig && regel.pflicht) throw new Error(`${regel.label} fehlt.`);
      continue;
    }
    if (regel.typ === 'zeilen') {
      werte[feld] = JSON.stringify(zeilen(roh, regel, regel.label));
    } else if (regel.typ === 'wahl') {
      const s = String(roh);
      if (!regel.werte.includes(s)) {
        throw new Error(`${regel.label}: nur ${regel.werte.join(' oder ')}.`);
      }
      werte[feld] = s;
    } else {
      const s = text(roh, regel.max, regel.label);
      if (regel.pflicht && !s) throw new Error(`${regel.label} fehlt.`);
      werte[feld] = s;
    }
  }

  if (werte.email && !werte.email.includes('@')) {
    throw new Error('E-Mail: Adresse sieht nicht wie eine E-Mail aus.');
  }
  if (!vollstaendig && Object.keys(werte).length === 0) {
    throw new Error('Keine aenderbaren Angaben uebergeben.');
  }
  return werte;
}

function ausZeile(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    firma: row.firma,
    vorname: row.vorname,
    nachname: row.nachname,
    anschrift: JSON.parse(row.anschrift || '[]'),
    steuernummer: row.steuernummer,
    ustIdNr: row.ust_id_nr,
    email: row.email,
    notiz: row.notiz,
    erstellt_am: row.erstellt_am,
    geaendert_am: row.geaendert_am,
  };
}

// --- Projekte eines Kontakts -------------------------------------------------
// Ein Kunde hat ein oder mehrere Projekte, ein Projekt gehoert genau einem
// Kunden. Daran haengt die Abrechenbarkeit: Vorgaenge haben keine eigene
// Tabelle, sie tragen ein Projekt — und ueber das Projekt ihren Kunden.

// Obergrenze fuer eine Zuordnung. Wer mehr Projekte an einem Kunden haengen
// hat, hat sich vertippt oder ruft den Endpunkt von aussen auf.
const PROJEKTE_MAX = 200;

// Werkzeugbetrieb und lokale Modelle gehoeren keinem Kunden: ihre Kosten liegen
// ueber die Zeitzuordnung bereits anteilig auf den echten Vorgaengen, zugeordnet
// stuenden sie ein zweites Mal auf einer Rechnung.
//
// Die Regel steht in metrics.js und wird von dort geholt statt hier nachgebaut —
// zwei Fassungen liefen frueher oder spaeter auseinander. Erst beim Aufruf
// geladen, damit dieses Modul beim Einlesen unabhaengig bleibt.
function istHintergrund(projekt) {
  return require('./metrics').isOverhead(projekt);
}

function projekteVon(db, kontaktId) {
  if (!Number.isInteger(kontaktId) || kontaktId <= 0) return [];
  return db.prepare(
    'SELECT projekt FROM projekt_kontakt WHERE kontakt_id = ? ORDER BY projekt COLLATE NOCASE'
  ).all(kontaktId).map((r) => r.projekt);
}

// Alle Zuordnungen auf einmal, als Objekt projekt -> { id, firma }. Eine
// Abfrage statt einer je Zeile: der Rechnungen-Tab braucht sie fuer jeden
// Vorgang. Der Name kommt mit, damit jede Ansicht den Kunden benennen kann,
// ohne zuvor die Kontaktliste geladen zu haben.
function kontaktJeProjekt(db) {
  const aus = {};
  const zeilen = db.prepare(`
    SELECT pk.projekt, pk.kontakt_id, k.firma FROM projekt_kontakt pk
    LEFT JOIN kontakte k ON k.id = pk.kontakt_id
  `).all();
  for (const r of zeilen) aus[r.projekt] = { id: r.kontakt_id, firma: r.firma || '' };
  return aus;
}

// Setzt die Projekte eines Kontakts auf genau diese Liste.
//
// Geprueft wird gegen den Bestand, nicht gegen ein Muster: Projektnamen kommen
// aus den Logs und sind kein freies Feld. Ohne diese Pruefung schriebe ein
// direkter Aufruf einen erfundenen Namen in die Zuordnung, und die Oberflaeche
// zeigte ihn als echtes Projekt dieses Kunden an.
function schreibeProjekte(db, kontaktId, projekte) {
  if (!Number.isInteger(kontaktId) || kontaktId <= 0) throw new Error('Unbekannter Kontakt.');
  if (!lade(db, kontaktId)) throw new Error('Unbekannter Kontakt.');
  if (!Array.isArray(projekte)) throw new Error('Projekte: Liste erwartet.');
  if (projekte.length > PROJEKTE_MAX) {
    throw new Error(`Projekte: hoechstens ${PROJEKTE_MAX} Eintraege.`);
  }

  // Doppelte Namen sind kein Fehler, nur ueberfluessig — die Liste kommt aus
  // einer Mehrfachauswahl, und ein Aufruf von aussen darf daran nicht scheitern.
  const sauber = [...new Set(projekte.map((p) => text(p, 200, 'Projekt')))].filter(Boolean);

  const bekannt = new Set(
    db.prepare('SELECT DISTINCT project FROM events WHERE project IS NOT NULL').all()
      .map((r) => r.project)
  );
  for (const p of sauber) {
    if (!bekannt.has(p)) throw new Error(`Unbekanntes Projekt: ${p}`);
    if (istHintergrund(p)) {
      throw new Error(`${p} laeuft im Hintergrund und gehoert keinem Kunden.`);
    }
  }

  // Ein bereits vergebenes Projekt wird abgewiesen, nicht stillschweigend
  // umgehaengt: sonst nimmt ein unbedachter Aufruf einem anderen Kunden seine
  // Zuordnung weg, und dessen Vorgaenge fallen aus seiner Rechnung. Wer wirklich
  // umhaengen will, entfernt es erst beim bisherigen Kunden — ein Schritt mehr,
  // dafuer keine stille Umverteilung.
  const fremd = db.prepare(`
    SELECT pk.projekt, k.firma FROM projekt_kontakt pk
    LEFT JOIN kontakte k ON k.id = pk.kontakt_id
    WHERE pk.kontakt_id != ?
  `).all(kontaktId);
  for (const r of fremd) {
    if (sauber.includes(r.projekt)) {
      throw new Error(`${r.projekt} gehoert bereits ${r.firma || 'einem anderen Kunden'}. ` +
        'Dort zuerst entfernen.');
    }
  }

  db.prepare('DELETE FROM projekt_kontakt WHERE kontakt_id = ?').run(kontaktId);
  const ein = db.prepare('INSERT INTO projekt_kontakt (projekt, kontakt_id) VALUES (?, ?)');
  for (const p of sauber) ein.run(p, kontaktId);
  return sauber;
}

// Die Klammer um schreibende Aufrufe. Getrennt gehalten, damit speichere() die
// Zuordnung und die uebrigen Kontaktangaben in EINE Transaktion legen kann:
// sonst stuenden die Projekte schon fest, waehrend das Schreiben der restlichen
// Felder scheitert — ein halber Datensatz, den niemand bemerkt.
function inTransaktion(db, fn) {
  db.exec('BEGIN');
  try {
    const aus = fn();
    db.exec('COMMIT');
    return aus;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function setzeProjekte(db, kontaktId, projekte) {
  return inTransaktion(db, () => schreibeProjekte(db, kontaktId, projekte));
}

function lade(db, id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const k = ausZeile(db.prepare('SELECT * FROM kontakte WHERE id = ?').get(id));
  if (k) k.projekte = projekteVon(db, k.id);
  return k;
}

function liste(db) {
  const zeilen = db.prepare('SELECT * FROM kontakte ORDER BY firma COLLATE NOCASE').all().map(ausZeile);
  // Eine Abfrage fuer alle Zeilen statt einer je Kontakt.
  const jeKontakt = new Map();
  for (const r of db.prepare('SELECT projekt, kontakt_id FROM projekt_kontakt ORDER BY projekt COLLATE NOCASE').all()) {
    if (!jeKontakt.has(r.kontakt_id)) jeKontakt.set(r.kontakt_id, []);
    jeKontakt.get(r.kontakt_id).push(r.projekt);
  }
  for (const k of zeilen) k.projekte = jeKontakt.get(k.id) || [];
  return zeilen;
}

function speichere(db, daten = {}) {
  const jetzt = new Date().toISOString();
  const id = daten.id === undefined || daten.id === '' ? null : Number(daten.id);

  if (id === null) {
    const werte = pruefe(daten, { vollstaendig: true });
    const felder = Object.keys(werte);
    const spalten = felder.map(spalteVon);
    // Beides in einer Transaktion: eine abgewiesene Projektzuordnung darf keinen
    // Kontakt ohne seine Projekte hinterlassen.
    const neu = inTransaktion(db, () => {
      const info = db.prepare(`
        INSERT INTO kontakte (${spalten.concat('erstellt_am').join(', ')})
        VALUES (${felder.map(() => '?').concat('?').join(', ')})
      `).run(...felder.map((f) => werte[f]), jetzt);
      const angelegt = Number(info.lastInsertRowid);
      // Projekte sind keine Spalte in kontakte und laufen deshalb an pruefe()
      // vorbei — ausdruecklich behandelt statt stillschweigend verworfen.
      if (daten.projekte !== undefined) schreibeProjekte(db, angelegt, daten.projekte);
      return angelegt;
    });
    return lade(db, neu);
  }

  if (!Number.isInteger(id) || id <= 0) throw new Error('Unbekannter Kontakt.');
  if (!lade(db, id)) throw new Error('Unbekannter Kontakt.');

  // Projekte sind keine Spalte in kontakte. Wer nur sie aendert, schickt sonst
  // nichts mit — pruefe() wuerde das als "keine aenderbaren Angaben" abweisen,
  // obwohl es eine gueltige Aenderung ist. Deshalb getrennt behandelt.
  // Fehlt das Feld dagegen ganz, bleibt die Zuordnung stehen: dieselbe Regel
  // wie bei den uebrigen Angaben — eine Teileingabe leert nichts.
  const nurProjekte = daten.projekte !== undefined &&
    Object.keys(FELDER).every((f) => daten[f] === undefined);

  // Erst pruefen, dann schreiben: sonst stuenden die Projekte schon in der
  // Datenbank, waehrend eine ungueltige Anschrift den Aufruf abbrechen laesst.
  const werte = nurProjekte ? null : pruefe(daten, { vollstaendig: false });

  // Beide Schreibvorgaenge zusammen: scheitert einer, gilt keiner. Sonst stuende
  // die neue Zuordnung fest, waehrend die Anschrift die alte bliebe.
  inTransaktion(db, () => {
    if (daten.projekte !== undefined) schreibeProjekte(db, id, daten.projekte);
    if (werte) {
      const felder = Object.keys(werte);
      db.prepare(`
        UPDATE kontakte SET ${felder.map((f) => `${spalteVon(f)} = ?`).join(', ')}, geaendert_am = ?
        WHERE id = ?
      `).run(...felder.map((f) => werte[f]), jetzt, id);
    } else {
      db.prepare('UPDATE kontakte SET geaendert_am = ? WHERE id = ?').run(jetzt, id);
    }
  });
  return lade(db, id);
}

function loesche(db, id) {
  const k = lade(db, Number(id));
  if (!k) throw new Error('Unbekannter Kontakt.');
  // Anders als der Verweis in einem Angebot oder einer Rechnung: der ist Teil
  // einer eingefrorenen Abschrift und bleibt stehen. Eine Zuordnung dagegen ist
  // lebendes Stammdatum — ohne Kontakt boete sie im Rechnungen-Tab einen
  // Kunden an, den es nicht mehr gibt.
  inTransaktion(db, () => {
    db.prepare('DELETE FROM projekt_kontakt WHERE kontakt_id = ?').run(k.id);
    db.prepare('DELETE FROM kontakte WHERE id = ?').run(k.id);
  });
  return true;
}

// Wird beim Annehmen eines Angebots und beim Stellen einer Rechnung gerufen.
// Laeuft absichtlich ins Leere, wenn kein oder ein geloeschter Kontakt
// dranhaengt: eine Annahme darf nicht daran scheitern, dass jemand den Kontakt
// zwischenzeitlich entfernt hat. Der WHERE-Teil macht den Aufruf wiederholbar.
function macheKunde(db, kontaktId) {
  if (!Number.isInteger(kontaktId) || kontaktId <= 0) return false;
  const info = db.prepare(`
    UPDATE kontakte SET status = 'kunde', geaendert_am = ?
    WHERE id = ? AND status = 'lead'
  `).run(new Date().toISOString(), kontaktId);
  return info.changes > 0;
}

// Beim Erstellen eines Dokuments dagegen hart pruefen: eine mitgeschickte, aber
// unbekannte id ist ein Fehler und soll sofort auffallen, statt still als
// fehlende Verknuepfung zu enden.
function pruefeId(db, kontaktId) {
  if (kontaktId === undefined || kontaktId === null || kontaktId === '') return null;
  const id = Number(kontaktId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Unbekannter Kontakt.');
  if (!lade(db, id)) throw new Error('Unbekannter Kontakt.');
  return id;
}

module.exports = {
  FELDER, liste, lade, speichere, loesche, macheKunde, pruefeId, ohneErsatzzeichen,
  projekteVon, kontaktJeProjekt, setzeProjekte,
};
