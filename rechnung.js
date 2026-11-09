'use strict';
// Rechnungsstellung aus den Ledger-Zahlen.
//
// Der wichtigste Grundsatz steht in der Tabellendefinition und wird hier
// eingeloest: eine gestellte Rechnung wird NIE neu berechnet. Beim Erstellen
// werden Positionen, Stammdaten und Betraege als Abschrift in die Zeile
// geschrieben; die Druckansicht liest ausschliesslich diese Abschrift. Sonst
// aenderte ein spaeter korrigierter Stundensatz rueckwirkend ein Dokument,
// das bereits beim Kunden liegt.
const fs = require('node:fs');
const path = require('node:path');
// execFile ueber das Modulobjekt (nicht entpackt): der Selfcheck prueft so die Kind-Umgebung des Drucks.
const childProcess = require('node:child_process');
const { execFileSync } = childProcess;
const { kindUmgebung } = require('./claude');

const config = require('./config.json');
const metrics = require('./metrics');
const kontakte = require('./kontakte');
const zeit = require('./zeit');

const RECHNUNGS_DIR = path.join(__dirname, 'data', 'rechnungen');

function stammdaten() {
  return (config.rechnung && config.rechnung.aussteller) || {};
}

// Fail-fast wie beim Wechselkurs: eine Rechnung ohne Pflichtangaben ist
// steuerlich unwirksam. Lieber hier abbrechen als ein unbrauchbares Dokument
// erzeugen, das erst der Steuerberater bemaengelt.
// Was fehlt, ohne zu werfen. Der Einstellungen-Tab braucht die Liste, um beim
// Speichern von Teileingaben anzeigen zu koennen, was noch aussteht — dort
// waere ein Abbruch falsch, beim Erstellen einer Rechnung dagegen richtig.
function fehlendeStammdaten() {
  const a = stammdaten();
  const fehlt = [];
  if (!a.name) fehlt.push('rechnung.aussteller.name');
  if (!Array.isArray(a.anschrift) || a.anschrift.length === 0) fehlt.push('rechnung.aussteller.anschrift');
  if (!a.steuernummer && !a.ustIdNr) fehlt.push('rechnung.aussteller.steuernummer oder ustIdNr');
  // Ohne Kleinunternehmerregelung und ohne Satz stuende "zzgl. 0 % Umsatzsteuer"
  // ohne § 19-Hinweis auf dem Dokument (Toolcheck 15.10., H5).
  const r = config.rechnung || {};
  if (!r.kleinunternehmer && !(Number(r.ustSatz) > 0)) fehlt.push('rechnung.ustSatz oder kleinunternehmer');
  return fehlt;
}

function pruefeStammdaten() {
  const fehlt = fehlendeStammdaten();
  if (fehlt.length) {
    throw new Error(
      'Rechnungs-Stammdaten unvollstaendig, Par. 14 UStG verlangt sie: ' + fehlt.join(', ') +
      '. Bitte in den Einstellungen ergaenzen.'
    );
  }
}

// Kaufmaennisch auf Cent, halbe Cent vom Null weg. Erst auf 15 Stellen
// glaetten: 42,50 x 19 / 100 ist als Gleitkommazahl 8,07499999…, ohne das
// Glaetten wird daraus 8,07 statt 8,08 (Toolcheck 15.10., H1).
// Netto = Summe der gerundeten Positionen (siehe dokument()).
const nettoAus = (positionen) => rund2(positionen.reduce((s, p) => s + (Number(p.betrag_eur) || 0), 0));
// Alle Stunden einer Rechnung, Kulanz eingeschlossen: was pruefeErwartet gegen die Vorschau haelt.
const stundenSumme = (positionen) => rund2(positionen.reduce((s, p) => s + (Number(p.stunden) || 0), 0));

function rund2(n) {
  const x = Number(n) || 0;
  const cent = Math.round(Number((Math.abs(x) * 100).toPrecision(15)));
  return (x < 0 ? -cent : cent) / 100;
}

// --- Abschrift des Empfaengers ------------------------------------------------
// Was vom Empfaenger in die Rechnung geht. Nur bekannte Felder, jedes mit
// Laengengrenze: der Anfragekoerper landet sonst unbesehen in einem Dokument
// nach § 14 UStG.
//
// Name und Anschrift kommen aus der Anfrage. Die Angaben fuer die E-Rechnung
// (E-Mail, Kaeuferreferenz, USt-IdNr., Land, Lieferantennummer) duerfen
// mitkommen; fehlen sie, werden sie aus dem verknuepften Kontakt gezogen. Danach
// ist die Abschrift eingefroren — ein spaeter geaenderter Kontakt aendert keine
// gestellte Rechnung.
const EMPFAENGER_ZUSATZ = {
  email: { max: 120, kontakt: 'email', label: 'E-Mail', form: /@/ },
  ust_id_nr: { max: 40, kontakt: 'ustIdNr', label: 'USt-IdNr.' },
  kaeufer_referenz: { max: 80, kontakt: 'kaeuferReferenz', label: 'Käuferreferenz' },
  land: { max: 2, kontakt: 'land', label: 'Land', form: /^[A-Za-z]{2}$/, gross: true },
  lieferantennummer: { max: 60, kontakt: 'lieferantennummer', label: 'Lieferantennummer' },
  // Nur aus dem Kontakt (dort beim Anlegen fest vergeben); eine mitgeschickte
  // wird ignoriert, ohne Kontakt traegt die Rechnung keine (C12 R6/R7).
  // Fuellt in der E-Rechnung die Kaeuferreferenz, wenn der Kunde keine nennt.
  kundennummer: { max: 30, kontakt: 'kundennummer', label: 'Kundennummer', nurKontakt: true },
  // Je Rechnung, nicht je Kunde: steht deshalb an keinem Kontakt.
  bestellnummer: { max: 60, kontakt: null, label: 'Bestellnummer' },
};

// Eine Angabe fuer die E-Rechnung, geprueft statt zurechtgeschnitten. Diese
// Werte gehen maschinenlesbar an den Empfaenger: aus "Niederlande" wuerde beim
// Abschneiden still "NI", und das stuende unwiderruflich in der Rechnung.
function zusatzWert(roh, regel) {
  if (roh === undefined || roh === null) return '';
  // Eine Zahl oder Liste an dieser Stelle ist ein Fehler des Aufrufers. Still
  // uebergangen, traete der Wert aus dem Kontakt an ihre Stelle.
  if (typeof roh !== 'string') throw new Error(`${regel.label}: Text erwartet.`);
  const s = roh.trim();
  if (!s) return '';
  if (regel.form && !regel.form.test(s)) {
    throw new Error(`${regel.label}: Angabe hat nicht die erwartete Form.`);
  }
  if (s.length > regel.max) throw new Error(`${regel.label}: hoechstens ${regel.max} Zeichen.`);
  kontakte.ohneErsatzzeichen(s, regel.label);
  return regel.gross ? s.toUpperCase() : s;
}

function empfaengerAbschrift(db, empfaenger, kontaktId) {
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  // Vor dem Zuschneiden: ein Name, der kein Text ist, soll als Fachmeldung
  // auffallen und nicht still zu einem leeren Namen werden.
  kontakte.ohneErsatzzeichen(empfaenger.name, 'Empfaenger');
  const kontakt = Number.isInteger(kontaktId) && kontaktId > 0 ? kontakte.lade(db, kontaktId) : null;

  const aus = {
    name: text(empfaenger.name, 200),
    anschrift: (Array.isArray(empfaenger.anschrift) ? empfaenger.anschrift : [])
      .filter((z) => typeof z === 'string')
      .map((z) => z.trim()).filter(Boolean).slice(0, 6)
      .map((z) => z.slice(0, 120)),
  };
  for (const [feld, regel] of Object.entries(EMPFAENGER_ZUSATZ)) {
    // Streng ist die Pruefung nur fuer das, was die Anfrage mitbringt. Eine
    // Angabe aus dem Kontakt, die die Form nicht haelt (alte Eintraege wurden
    // nie geprueft), bleibt weg, statt das Stellen der Rechnung zu verhindern —
    // die E-Rechnung meldet sie dann als fehlend.
    let wert = regel.nurKontakt ? '' : zusatzWert(empfaenger[feld], regel);
    if (!wert && kontakt && regel.kontakt) {
      try {
        wert = zusatzWert(kontakt[regel.kontakt], regel);
      } catch {
        // Ausnahme Land: fiele es weg, gaelte Deutschland, und ein falsches
        // Land stuende unwiderruflich in der Rechnung. Dann lieber anhalten
        // und sagen, wo der Fehler liegt.
        if (feld === 'land') {
          throw new Error('Land im Kontakt: zweistelliges Kuerzel erwartet (zum Beispiel DE oder NL). ' +
            'Bitte am Kontakt korrigieren.');
        }
        wert = '';
      }
    }
    if (wert) aus[feld] = wert;
  }
  aus.anschrift.forEach((z) => kontakte.ohneErsatzzeichen(z, 'Empfaenger-Anschrift'));
  return aus;
}

// new Date() wirft bei einem Tag, den es nicht gibt (toISOString auf einem
// ungueltigen Datum). Das zaehlt als "kein Tag", nicht als Absturz.
function istTagSicher(pruefung, wert) {
  try { return pruefung(wert); } catch { return false; }
}

// --- Faelligkeit ---------------------------------------------------------------
// Tag der Faelligkeit als "JJJJ-MM-TT". Steht seit Version 1.3 in der Abschrift.
// Aeltere Rechnungen tragen ihn nicht; fuer sie wird wie frueher aus dem
// aktuellen Zahlungsziel gerechnet.
function faelligAm(inv) {
  if (inv.faellig_am) return inv.faellig_am;
  return tagNach(inv.erstellt_am, zahlungsziel());
}

// Altrechnungen einmal festschreiben: sonst wanderten Faelligkeit und Ampel
// mit jeder Aenderung des Zahlungsziels. Geschrieben wird der Tag, der bis
// jetzt angezeigt wurde. Laeuft beim Start; ohne Altrechnungen tut er nichts.
function faelligFestschreiben(db) {
  const alt = db.prepare('SELECT nr, erstellt_am FROM invoices WHERE faellig_am IS NULL').all();
  const setze = db.prepare('UPDATE invoices SET faellig_am = ? WHERE nr = ?');
  for (const r of alt) setze.run(faelligAm(r), r.nr);
  return alt.length;
}

function tagNach(zeitpunkt, tage) {
  const d = new Date(zeitpunkt);
  d.setDate(d.getDate() + tage);
  const zwei = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
}

// Ganze Kalendertage von `von` bis `bis` (JJJJ-MM-TT), ueber UTC-Mitternacht: Zeitumstellung verschiebt nichts.
function tageZwischen(von, bis) {
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(bis) - t(von)) / 86400000);
}

function zahlungsziel() {
  const tage = Number(config.rechnung && config.rechnung.zahlungszielTage);
  return Number.isFinite(tage) && tage >= 0 ? tage : 14;
}

// --- Nummernkreis ------------------------------------------------------------
// Fortlaufend und einmalig, je Jahr eine eigene Reihe. Der Zaehler ergibt sich
// aus dem Bestand, nicht aus einem gemerkten Stand: so entsteht auch nach einem
// Absturz keine doppelte Nummer. UNIQUE(jahr, laufnr) ist das Netz darunter.
function naechsteNummer(db, jahr) {
  const row = db.prepare('SELECT COALESCE(MAX(laufnr), 0) + 1 AS n FROM invoices WHERE jahr = ?').get(jahr);
  const laufnr = row.n;
  return { laufnr, nr: `${jahr}-${String(laufnr).padStart(4, '0')}` };
}

// --- Freie Positionen -----------------------------------------------------------
// Eine Pruefung fuer Angebot und Rechnung (R8). Die Grenzen sind bewusst eng:
// das Dokument geht nach aussen, ein Tippfehler in der Stundenzahl faellt erst
// beim Kunden auf.
//
// Zahl oder nicht-leerer Text (die bisherige Ansicht schickt Feldinhalte).
// Alles andere ist NaN: Number() machte aus null 0, aus true 1 und aus [5] 5 —
// eine Position mit 0 EUR stuende dann unveraenderlich auf der Rechnung.
function zahlFeld(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

function freiePosition(p, vFaktor) {
  // Nur Zeichenketten: ein Objekt wuerde sonst als "[object Object]" auf dem
  // Dokument landen, ein Array stillschweigend zusammengefuegt.
  if (!p || typeof p.bezeichnung !== 'string') {
    throw new Error('Jede Position braucht eine Bezeichnung als Text.');
  }
  const bezeichnung = p.bezeichnung.trim();
  if (!bezeichnung) throw new Error('Jede Position braucht eine Bezeichnung.');
  if (bezeichnung.length > 200) throw new Error('Bezeichnung: hoechstens 200 Zeichen.');
  kontakte.ohneErsatzzeichen(bezeichnung, 'Bezeichnung');

  // Rabatt je Position, nur auf Stunden: das Dokument zeigt ihn als
  // "Satz/h abzgl. X %" — bei einem Festpreis stuende dort ein Satz, den es
  // nicht gibt. Ein Festpreis wird direkt angepasst.
  const rabattRoh = p.rabatt_prozent === undefined || p.rabatt_prozent === '' ? 0 : p.rabatt_prozent;
  if (typeof rabattRoh !== 'number' || !Number.isFinite(rabattRoh) || rabattRoh < 0 || rabattRoh > 100) {
    throw new Error(`"${bezeichnung}": Rabatt muss zwischen 0 und 100 Prozent liegen.`);
  }
  const rabatt = rund2(rabattRoh);

  // Pauschalposition: ein Festpreis fuer die beschriebene Leistung, ohne
  // Stunden. Die Grenze liegt enger als Stunden x Satz es zuliesse — ein
  // vertippter Festpreis geht ungeprueft nach aussen.
  if (p.typ === 'pauschal') {
    if (rabatt > 0) throw new Error(`"${bezeichnung}": Rabatt nur bei Stunden, den Festpreis direkt anpassen.`);
    const betrag = zahlFeld(p.betrag_eur);
    // Nach dem Runden pruefen: 0,004 ist groesser 0, steht aber als 0,00 da.
    if (!Number.isFinite(betrag) || rund2(betrag) <= 0 || betrag > 1000000) {
      throw new Error(`"${bezeichnung}": Festpreis muss zwischen 0 und 1000000 liegen.`);
    }
    return {
      bezeichnung,
      typ: 'pauschal',
      stunden: null,
      satz: null,
      basissatz: null,
      rabatt_prozent: 0,
      betrag_eur: rund2(betrag),
      vergleich_stunden: null,
      vergleich_faktor: null,
    };
  }

  const stunden = zahlFeld(p.stunden);
  if (!Number.isFinite(stunden) || rund2(stunden) <= 0 || stunden > 10000) {
    throw new Error(`"${bezeichnung}": Stunden muessen zwischen 0 und 10000 liegen.`);
  }
  // Fehlt der Satz, gilt der Standardsatz; null ist kein Fehlen, sondern ein Fehler.
  const basis = p.satz === undefined || p.satz === '' ? config.stundensatz : zahlFeld(p.satz);
  if (!Number.isFinite(basis) || basis < 0 || basis > 10000) {
    throw new Error(`"${bezeichnung}": Stundensatz muss zwischen 0 und 10000 liegen.`);
  }
  // Wie in metrics: der Rabatt mindert den Satz, nicht den Betrag. Gerundet
  // wird der Satz, damit Stunden x Satz auf dem Dokument den Betrag ergibt.
  const satz = rund2(basis * (1 - rabatt / 100));

  return {
    bezeichnung,
    stunden: rund2(stunden),
    satz,
    basissatz: rund2(basis),
    rabatt_prozent: rabatt,
    // Aus den gedruckten Stunden (H2): 1,333 h stehen als 1,33 da.
    betrag_eur: rund2(rund2(stunden) * satz),
    // Nur Zeit, nie ein Vergleichsbetrag — siehe die Begruendung in
    // metrics.mehrwert().
    vergleich_stunden: vFaktor > 1 ? rund2(stunden * vFaktor) : null,
    vergleich_faktor: vFaktor > 1 ? vFaktor : null,
  };
}

// --- Erstellen ---------------------------------------------------------------
// Positionen aus Vorgaengen, Projekten und freien Posten, ohne zu schreiben.
// Unterbau von erstelle() und der Vorschau: beide zeigen so dieselben Zeilen.
//
// projekte: Vorgaenge ohne Vorgangsnummer, ueber den Projektnamen gewaehlt.
// Bewusst ein eigener Parameter neben tickets: wuerde ein Projektname in
// tickets stehen, liefe er ungeprueft als Vorgangsnummer auf ein Dokument
// nach § 14 UStG und in den Jira-Abgleich.
function baue(db, daten = {}) {
  return baueMitSperre(db, daten).positionen;
}

// Wie baue(), dazu die Zeiteintraege, die schreibe() sperrt. Getrennt, weil
// die Sperrliste nicht in die Abschrift gehoert.
function baueMitSperre(db, { from, to, tickets, projekte, posten, eintraege, gruppierung } = {}) {
  const tListe = Array.isArray(tickets) ? tickets : [];
  const pListe = Array.isArray(projekte) ? projekte : [];
  if (eintraege !== undefined && eintraege !== null && !Array.isArray(eintraege)) throw new Error('Einträge: Liste erwartet.');
  if (posten !== undefined && posten !== null && !Array.isArray(posten)) {
    throw new Error('Posten: Liste erwartet.');
  }
  const frei = posten || [];
  if (frei.length > 100) throw new Error('Hoechstens 100 Positionen je Rechnung.');
  // Jede Vorschau fragt die Auswertung ab; eine endlose Liste kostet nur Zeit.
  if (tListe.length > 200 || pListe.length > 200) throw new Error('Hoechstens 200 Vorgaenge je Rechnung.');
  const hatZeit = Array.isArray(eintraege) && eintraege.length > 0;
  if (tListe.length === 0 && pListe.length === 0 && frei.length === 0 && !hatZeit) {
    throw new Error('Keine Vorgaenge oder Positionen gewaehlt.');
  }
  // Vergleichsaufwand ohne KI, nur als Zeit. Muss mit in die Abschrift: die
  // Druckansicht rechnet nichts nach, sonst stuende auf einer alten Rechnung
  // ploetzlich ein anderer Wert, sobald der Faktor geaendert wird.
  // Bewusst keine Euro-Entsprechung — Begruendung in metrics.mehrwert().
  const vFaktor = Number(config.vergleichsFaktor) || 0;
  // Freie Posten zuerst pruefen: ein Fehler dort soll nicht hinter der
  // Auswertung der Vorgaenge warten. Ohne Vergleichsangabe: das Dokument
  // nennt sie "erfasst" und die erfasste Zeit Berechnungsgrundlage — eine von
  // Hand eingetragene Stundenzahl ist beides nicht.
  const freiePositionen = frei.map((p) => freiePosition(p, 0));
  // Wunschangaben der Projekte ebenfalls vor der Auswertung pruefen.
  const wuensche = pListe.map(projektWunsch);
  const namen = wuensche.map((w) => w.name);
  const doppeltName = namen.find((n, i) => namen.indexOf(n) !== i);
  if (doppeltName !== undefined) throw new Error('Projekt ' + doppeltName + ' ist doppelt gewaehlt.');
  // Manuelle Zeit als eigene Positionen, vor den Vorgaengen geprueft und frisch
  // gerechnet. Jeder Eintrag muss im Leistungszeitraum liegen (§ 14 UStG).
  const zeitTeil = zeit.fuerRechnung(db, eintraege, gruppierung);
  for (const z of zeitTeil.sperre) {
    if ((from && z.tag < from) || (to && z.tag > to)) {
      throw new Error('Eintrag #' + z.id + ' liegt ausserhalb des Leistungszeitraums.');
    }
  }
  if (tListe.length === 0 && pListe.length === 0) {
    return { positionen: [...zeitTeil.positionen, ...freiePositionen], sperre: zeitTeil.sperre, hinweise: [], projektZeilen: [] };
  }

  const gewaehlt = new Set(tListe);
  // Projekte laufen ueber das Konto (projektTeil), Vorgaenge ueber byTicket.
  const zeilen = tListe.length ? metrics.byTicket(db, { from, to }).filter((t) => gewaehlt.has(t.ticket)) : [];
  // Nur Zeilen mit Claude-Zeit oder lokalen Modellen: ein Vorgang mit nur
  // manueller Zeit ergaebe sonst eine Position mit 0 Stunden und 0 EUR. Seine
  // Zeit geht ueber die Eintraege auf die Rechnung.
  const mitInhalt = zeilen.filter((t) => t.active_hours > 0 || (t.lokal_betrag_eur || 0) > 0);
  // Gewaehlt, aber ohne Claude-Zeit: nicht still weglassen, sonst fehlt er auf
  // der Rechnung, ohne dass es jemand merkt.
  const ohne = zeilen.filter((t) => !mitInhalt.includes(t));
  const projekt = wuensche.length ? projektTeil(db, wuensche, { to, vFaktor }) : { positionen: [], pauschalen: [], sperre: [], hinweise: [], zeilen: [], leer: [] };
  if ((ohne.length || projekt.leer.length) && zeitTeil.positionen.length) {
    throw new Error(ohne.length
      ? 'Vorgang ' + ohne[0].ticket + ' hat im Zeitraum keine Claude-Zeit — seine Zeit über die Einträge abrechnen.'
      : 'Projekt ' + projekt.leer[0] + ' hat nichts Offenes zum Abrechnen.');
  }
  if (mitInhalt.length === 0 && projekt.positionen.length === 0 && projekt.pauschalen.length === 0 && zeitTeil.positionen.length === 0) {
    throw new Error('Zu den gewaehlten Vorgaengen gibt es im Zeitraum keine Daten.');
  }

  const positionen = mitInhalt.map((t) => ({
    ticket: t.ticket,
    von: t.first_day,
    bis: t.last_day,
    stunden: rund2(t.active_hours),
    // Wie die Stunden entstanden sind. Die Abschrift wird nie nachgerechnet,
    // also muss sie selbst sagen, nach welchem Modell gezaehlt wurde.
    zeitmodell: t.zeitmodell,
    basissatz: rund2(t.stundensatz_standard),
    rabatt_prozent: t.rabatt_prozent || 0,
    satz: rund2(t.stundensatz),
    // Nur der Claude-Anteil: die Stunden oben sind Claude-Stunden. Manuelle
    // Zeit kommt als eigene Position, nie versteckt in diesem Betrag.
    // Aus den gedruckten Werten, wie freiePosition: der Kunde muss die Zeile
    // nachrechnen koennen (Toolcheck 15.10., H2). Der Arbeitswert in metrics
    // bleibt ungerundet; die Abweichung ist hoechstens ein halber Cent je Stunde.
    betrag_eur: rund2(rund2(t.active_hours) * rund2(t.stundensatz)),
    // Nur zur Information auf der Rechnung, keine Berechnungsgrundlage.
    tokens_gesamt: t.gesamt_tokens,
    vergleich_stunden: vFaktor > 1 ? Math.round(t.active_hours * vFaktor * 100) / 100 : null,
    vergleich_faktor: vFaktor > 1 ? vFaktor : null,
  }));

  // Nutzung lokaler Modelle als eigene Position. Getrennt von der Zeit, weil
  // es eine andere Leistung ist: nicht Arbeitszeit, sondern Rechenleistung auf
  // eigener Hardware. Als Pauschalposition, denn Stunden gibt es dafuer nicht.
  //
  // Der Betrag stammt aus metrics und wird hier NICHT nachgerechnet — der
  // Rabatt steckt bereits darin (derselbe wie beim Stundensatz). Wer ihn hier
  // noch einmal anwendete, zoege ihn zweimal ab.
  const pauschalen = [];
  for (const t of mitInhalt) {
    const p = lokalPosition(t);
    if (p) pauschalen.push(p);
  }

  return {
    positionen: [...positionen, ...projekt.positionen, ...pauschalen, ...projekt.pauschalen, ...zeitTeil.positionen, ...freiePositionen],
    sperre: [...zeitTeil.sperre, ...projekt.sperre],
    hinweise: projekt.hinweise,
    projektZeilen: projekt.zeilen,
  };
}

// Pauschalposition fuer lokale Modelle aus einer Auswertungszeile (Vorgang oder
// ticketloses Projekt); null, wenn nichts zu berechnen ist.
function lokalPosition(t) {
  const betrag = rund2(t.lokal_betrag_eur || 0);
  if (!(betrag > 0)) return null;
  const mio = (t.lokal_tokens || 0) / 1e6;
  return {
    ticket: t.ticket || t.gruppe,
    ohne_vorgangsnummer: t.ticket ? undefined : true,
    typ: 'pauschal',
    bezeichnung: `Nutzung lokaler KI-Modelle Vorgang ${t.ticket || t.gruppe}`,
    von: t.first_day,
    bis: t.last_day,
    mio_tokens: Math.round(mio * 1000) / 1000,
    preis_je_mio: rund2(t.lokal_eur_pro_mio || 0),
    rabatt_prozent: t.rabatt_prozent || 0,
    betrag_eur: betrag,
  };
}

// --- Projektpositionen aus dem Konto (Block B) -----------------------------------
// Projekt, auf das eine Position bucht; null, wenn auf keins. Eine Stelle fuer
// das Konto und die Doppelpruefung: was hier zaehlt, zaehlt in beiden.
function projektVon(p) {
  if (!p) return null;
  if (p.typ === 'zeit') return p.ziel_art === 'projekt' ? p.ziel : null;
  if (p.typ === 'kulanz') return p.projekt || null;
  if (p.typ === 'pauschal') return null;
  return p.ticket && p.ohne_vorgangsnummer ? p.ticket : null;
}

// Abrunden auf 0,01 h: nie mehr berechnen, als gewuenscht. Der Zuschlag fuer
// Gleitkomma (14,45 / 85 ist 0,16999...) verhindert ein Abrunden auf 0,16.
const abrunde = (x) => Math.floor(x * 100 + 1e-9) / 100;

// Eintrag in `projekte`: Name oder Objekt mit Wunschangabe. Geprueft wird hier,
// weil dieselbe Nutzlast auch ueber die Freigabe kommt (server.js, RECHNUNG_NUTZLAST).
function projektWunsch(roh) {
  const w = typeof roh === 'string' ? { name: roh } : roh;
  if (!w || typeof w !== 'object' || Array.isArray(w) || typeof w.name !== 'string' || !w.name || w.name.length > 200) {
    throw new Error('Projekt: Name als Text erwartet (hoechstens 200 Zeichen).');
  }
  const gesetzt = ['stunden', 'prozent', 'betrag'].filter((k) => w[k] !== undefined && w[k] !== null);
  if (gesetzt.length > 1) throw new Error('Projekt ' + w.name + ': hoechstens eines von Stunden, Prozent und Betrag.');
  const wort = { stunden: 'Stunden', prozent: 'Prozent', betrag: 'Betrag' };
  for (const k of gesetzt) {
    if (typeof w[k] !== 'number' || !Number.isFinite(w[k]) || w[k] <= 0 || w[k] > (k === 'prozent' ? 100 : 1e6)) {
      throw new Error('Projekt ' + w.name + ': ' + wort[k] + ' muss eine Zahl ueber 0 bis ' + (k === 'prozent' ? '100' : '1.000.000') + ' sein.');
    }
  }
  if (w.kulanzRest !== undefined && typeof w.kulanzRest !== 'boolean') throw new Error('Projekt ' + w.name + ': kulanzRest ist ja oder nein.');
  return { name: w.name, stunden: w.stunden, prozent: w.prozent, betrag: w.betrag, kulanzRest: w.kulanzRest === true };
}

// Abschrift der Positionen aus einer invoices-Zeile (nr, positionen). Unlesbar: lieber abbrechen als still
// falsch zaehlen, und mit Nummer, damit sich die Rechnung finden laesst.
function positionenVon(r) {
  let liste;
  try { liste = JSON.parse(r.positionen); } catch { liste = null; }
  if (!Array.isArray(liste)) throw new Error('Rechnung ' + r.nr + ': Abschrift der Positionen unlesbar.');
  return liste;
}

// Letzter Tag, bis zu dem die Pauschale fuer lokale Modelle eines Projekts gestellt ist.
function pauschaleBis(db, projekt) {
  let bis = null;
  for (const r of db.prepare("SELECT nr, leistung_bis, positionen FROM invoices WHERE status = 'erstellt'").all()) {
    for (const p of positionenVon(r)) {
      if (!p || p.typ !== 'pauschal' || p.ticket !== projekt || !p.ohne_vorgangsnummer) continue;
      const b = p.bis || r.leistung_bis;
      if (b && (!bis || b > bis)) bis = b;
    }
  }
  return bis;
}

// Pauschale lokaler Modelle fuer Tage nach der zuletzt gestellten bis `bisTag`; null, wenn nichts
// ansteht. Das Ende steht fest auf bisTag: die Auswertungszeile kennt nur ticketlose Events, und
// pauschaleBis las sonst einen zu frueh endenden Tag (Pauschale doppelt).
function offenePauschale(db, name, bisTag) {
  const ab = pauschaleBis(db, name);
  const fenster = { ...(ab ? { from: tagNach(ab + 'T12:00:00', 1) } : {}), ...(bisTag ? { to: bisTag } : {}) };
  const p = lokalPosition(metrics.ohneTicket(db, fenster).find((t) => t.art === 'projekt' && t.gruppe === name) || {});
  // `projekt` nur auf dem Projektweg: der Druck laesst dann die Token-Zeile weg (keine Tokens an Projektpositionen).
  return p ? { ...p, projekt: name, bezeichnung: 'Nutzung lokaler KI-Modelle Projekt ' + name, bis: bisTag || p.bis } : null;
}

// Toleranz, mit der Konto-Stunden und Einheiten (ms) gegeneinander laufen duerfen:
// die gespeicherten Stunden sind auf 0,01 gerundet.
const KONTO_TOL = 0.005;

// Die Projektpositionen einer Rechnung: je Wunsch die Stunden (auf offen begrenzt),
// FIFO ueber die Einheiten (aelteste zuerst, schon berechnete Stunden verbrauchen
// zuerst), auf Wunsch der Rest als Kulanz. Manuelle Eintraege, die danach ganz
// verbraucht sind, gehen in `sperre`. `leer`: Projekte ohne offene Stunden.
function projektTeil(db, wuensche, { to, vFaktor }) {
  const out = { positionen: [], pauschalen: [], sperre: [], hinweise: [], zeilen: [], leer: [] };
  const zeilenBis = (opts) => metrics.ohneTicket(db, opts).filter((t) => t.art === 'projekt');
  const alle = zeilenBis(to ? { to } : {});
  const pauschale = (name, bisTag) => offenePauschale(db, name, bisTag);
  for (const w of wuensche) {
    // Eine manuelle Zeile geht hier nicht durch fuerRechnung, das vorher neu
    // rechnet: ohne das stuende ein veraltet gespeicherter Wert auf der Rechnung.
    zeit.nachrechnen(db, { seitStunden: Infinity, projekt: w.name });
    const k = projektKonto(db, w.name, to);
    // Ohne offene Stunden kann trotzdem eine Pauschale fuer lokale Modelle anstehen.
    if (!(k.offen_h > 0)) {
      const p = pauschale(w.name, to);
      if (p) out.pauschalen.push(p);
      else { out.leer.push(w.name); out.hinweise.push('Projekt ' + w.name + ': nichts Offenes, ohne Position.'); }
      continue;
    }
    if (k.offen_in_berechnet) out.hinweise.push('Projekt ' + w.name + ': ' + OFFEN_IN_BERECHNET);
    const si = metrics.satzFuerProjekt(w.name);
    const satz = rund2(si.satz);

    let h;
    if (w.stunden !== undefined) h = w.stunden;
    else if (w.prozent !== undefined) h = (k.offen_h * w.prozent) / 100;
    else if (w.betrag !== undefined) {
      if (!(satz > 0)) throw new Error('Projekt ' + w.name + ': Satz 0, ein Betrag laesst sich nicht in Stunden umrechnen.');
      h = w.betrag / satz;
    } else h = k.offen_h;
    h = abrunde(h);
    if (!(h >= 0.01)) throw new Error('Projekt ' + w.name + ': Der Wunsch ergibt weniger als 0,01 Stunden.');
    if (h > k.offen_h) {
      out.hinweise.push('Projekt ' + w.name + ': auf die offenen ' + String(k.offen_h).replace('.', ',') + ' h begrenzt.');
      h = k.offen_h;
    }
    const rest = w.kulanzRest ? rund2(k.offen_h - h) : 0;

    // Einheiten als Strecke auf der Stundenachse; berechnete Stunden belegen den Anfang.
    let summe = 0;
    const strecke = metrics.projektEinheiten(db, w.name, to).map((e) => { const a = summe; summe += e.stunden; return { e, a, b: summe }; });
    const tage = (von, bis) => {
      const t = strecke.filter((s) => s.b > von + KONTO_TOL && s.a < bis - KONTO_TOL).map((s) => s.e.tag);
      // Nie leer, solange offen_h > 0; sonst der letzte Tag, statt eine Position ohne Zeitraum zu stellen.
      return t.length ? [t[0], t[t.length - 1]] : [strecke[strecke.length - 1].e.tag, strecke[strecke.length - 1].e.tag];
    };
    const [von, bis] = tage(k.berechnet_h, k.berechnet_h + h);
    const zeile = alle.find((t) => t.gruppe === w.name);
    out.positionen.push({
      ticket: w.name, ohne_vorgangsnummer: true, projekt: w.name,
      von, bis, stunden: h, satz,
      basissatz: rund2(si.basissatz), rabatt_prozent: si.rabatt || 0,
      betrag_eur: rund2(h * satz),
      zeitmodell: zeile ? zeile.zeitmodell : null,
      // Nur intern (nicht gedruckt): offen vor dieser Rechnung.
      erbracht_h: k.offen_h,
      // Nur zur Information, wie bei Vorgaengen.
      vergleich_stunden: vFaktor > 1 ? rund2(h * vFaktor) : null,
      vergleich_faktor: vFaktor > 1 ? vFaktor : null,
    });
    // Fuer die Vorschau: was diese Position berechnet und was danach offen bleibt (der Editor rechnet nichts).
    out.zeilen.push({ projekt: w.name, berechnet_h: h, kulanz_h: rest, offen_h: rund2(k.offen_h - h - rest) });
    let letzterTag = bis;
    if (rest > 0) {
      const [rVon, rBis] = tage(k.berechnet_h + h, k.berechnet_h + h + rest);
      out.positionen.push({ typ: 'kulanz', projekt: w.name, bezeichnung: 'Kulanz – nicht berechnete Zeit ' + w.name, stunden: rest, satz: 0, betrag_eur: 0, von: rVon, bis: rBis });
      letzterTag = rBis;
    }

    // Ganz verbrauchte manuelle Eintraege sperren, wie auf dem Weg ueber `eintraege`.
    const ende = k.berechnet_h + h + rest;
    const status = db.prepare('SELECT status FROM zeit_eintrag WHERE id = ?');
    for (const s of strecke) {
      if (s.e.art !== 'manuell' || s.b <= k.berechnet_h + KONTO_TOL || s.b > ende + KONTO_TOL) continue;
      const row = status.get(s.e.eintragId);
      if (row && row.status === 'offen') out.sperre.push({ id: s.e.eintragId, satz, tag: s.e.tag });
    }

    // Pauschale fuer lokale Modelle: nur Tage nach der zuletzt gestellten, bis zum Ende dieser Position.
    const pa = pauschale(w.name, letzterTag);
    if (pa) out.pauschalen.push(pa);
  }
  return out;
}

// Der fertige Beleg ohne Nummer, ohne Schreiben. erstelle() schreibt ihn,
// vorschau() zeigt ihn — derselbe Weg, damit beide nicht auseinanderlaufen.
function entwurf(db, { from, to, tickets, projekte, posten, eintraege, gruppierung, empfaenger, kontaktId, zahlungszielTage } = {}) {
  pruefeStammdaten();
  if (!empfaenger || !empfaenger.name) {
    throw new Error('Empfaenger fehlt (Name ist Pflicht).');
  }
  if (!from || !to) throw new Error('Leistungszeitraum fehlt.');
  // Vor der Auswertung: ein Zeitraum ohne Datumsform faende sonst "keine Daten"
  // statt den eigentlichen Fehler zu nennen.
  if (!istTag(from) || !istTag(to)) throw new Error('Leistungszeitraum: Datum in der Form JJJJ-MM-TT erwartet.');
  // Fehlt die Angabe, gilt die Einstellung. Eine falsche Angabe faellt auf,
  // statt still durch die Einstellung ersetzt zu werden.
  let zielTage = zahlungsziel();
  if (zahlungszielTage !== undefined && zahlungszielTage !== null) {
    if (!Number.isInteger(zahlungszielTage) || zahlungszielTage < 0 || zahlungszielTage > 120) {
      throw new Error('Zahlungsziel: ganze Tage von 0 bis 120.');
    }
    zielTage = zahlungszielTage;
  }
  const { positionen, sperre, hinweise, projektZeilen } = baueMitSperre(db, { from, to, tickets, projekte, posten, eintraege, gruppierung });
  pruefeDoppelt(db, positionen);
  // Projektpositionen koennen vor `from` beginnen (FIFO): der Kopf muss sie enthalten, sonst
  // steht auf der unveraenderlichen Rechnung (und in der E-Rechnung) ein falscher Zeitraum.
  const projektTage = positionen.filter((p) => p.projekt || p.ohne_vorgangsnummer).flatMap((p) => [p.von, p.bis]).filter(Boolean);
  const von = projektTage.reduce((m, t) => (t < m ? t : m), from);
  const bis = projektTage.reduce((m, t) => (t > m ? t : m), to);
  return { ...dokument(db, { von, bis, empfaenger, positionen, kontaktId, zielTage }), sperre, hinweise, projektZeilen };
}

// Claude-Zeit eines Vorgangs darf nur einmal auf einer gestellten Rechnung
// stehen. Manuelle Zeit sperrt sich ueber zeit_eintrag; Vorgangs- und
// Projektpositionen hatten keine Sperre (Toolcheck 15.10., H4, Owner: 409).
// Vorgaenge: verglichen werden die Tage, die eine gestellte Position abdeckt,
// mit den Tagen der neuen Position; getrennte Zeitraeume (Teilabrechnung je
// Monat) bleiben erlaubt. Projekte (Block B): das Konto entscheidet, nach
// Stunden statt nach Tagen (pruefeKonto); nur die Pauschale fuer lokale Modelle
// folgt weiter der Tagesregel.
// Nur fuer die Selbstpruefung: aeltere Tests stellen dieselbe Rechnung
// mehrfach, um anderes zu pruefen. Nicht ueber HTTP erreichbar.
const pruefung = { doppelt: true };
function pruefeDoppelt(db, positionen) {
  if (!pruefung.doppelt) return;
  pruefeKonto(db, positionen);
  const neu = positionen.filter((p) => p.ticket && p.typ !== 'zeit' && p.von && p.bis && (p.typ === 'pauschal' || !p.ohne_vorgangsnummer));
  if (!neu.length) return;
  const rows = db.prepare("SELECT nr, leistung_von, leistung_bis, positionen FROM invoices WHERE status = 'erstellt'").all();
  for (const r of rows) {
    // Unlesbare Abschrift: lieber nicht stellen als still doppelt abrechnen.
    for (const alt of positionenVon(r)) {
      if (!alt || !alt.ticket || alt.typ === 'zeit') continue;
      // Projektpositionen zaehlt das Konto, sie blockieren hier nichts.
      if (alt.ohne_vorgangsnummer && alt.typ !== 'pauschal') continue;
      const von = alt.von || r.leistung_von;
      const bis = alt.bis || r.leistung_bis;
      const treffer = neu.find((p) => p.ticket === alt.ticket && p.von <= bis && p.bis >= von);
      if (!treffer) continue;
      const e = new Error((treffer.ohne_vorgangsnummer ? 'Projekt ' : 'Vorgang ') + treffer.ticket + ' steht für ' + von + ' bis ' + bis +
        ' schon auf Rechnung ' + r.nr + '. Zeitraum so wählen, dass er sich nicht überschneidet, oder die Rechnung stornieren.');
      e.abweichung = true;
      throw e;
    }
  }
}

// Kontoregel (Block B): was ein Projekt schon berechnet hat plus das Neue darf
// das Geleistete bis zum Ende der neuen Positionen nicht uebersteigen. Zeitpositionen
// sind je Position auf 0,01 h gerundet, das Geleistete nicht: drei Eintraege zu
// 10 min ergeben 3 x 0,17 = 0,51 h gegen 0,50 h. Je gerundeter Position (alte und
// neue) deshalb 0,005 h Spielraum, mindestens 0,005 h.
function pruefeKonto(db, positionen) {
  const je = new Map();
  for (const p of positionen) {
    const name = projektVon(p);
    if (!name) continue;
    const e = je.get(name) || { h: 0, rundungen: 0, bis: '' };
    e.h += Number(p.stunden) || 0;
    if (p.typ === 'zeit') e.rundungen += 1;
    if (p.bis && p.bis > e.bis) e.bis = p.bis;
    je.set(name, e);
  }
  for (const [name, e] of je) {
    const k = projektKonto(db, name, e.bis || undefined);
    const spielraum = Math.max(0.005, 0.005 * (e.rundungen + k.zeit_positionen));
    if (k.berechnet_h + e.h > k.geleistet_h + spielraum + 1e-9) {
      const err = new Error('Projekt ' + name + ': nur noch ' + k.offen_h + ' h offen.');
      err.abweichung = true;
      throw err;
    }
  }
}

// Gestellt wird nur, was zu sehen war: der Editor schickt die Summe seiner
// Vorschau mit. Laeuft inzwischen Zeit auf oder aendert sich ein Satz, entsteht
// nichts — die Rechnung waere sonst unveraenderlich anders als angezeigt.
// Ohne Angabe (bisherige Ansicht, API) bleibt es beim Erstellen wie bisher.
// erwartetStunden: der Kulanz-Rest kostet 0 EUR, ohne die Stunden fiele mehr Kulanz als gezeigt nicht auf.
function pruefeErwartet(d, erwartet, erwartetStunden) {
  if (erwartet !== undefined && erwartet !== null) {
    if (typeof erwartet !== 'number' || !Number.isFinite(erwartet)) throw new Error('erwartetBrutto: Zahl erwartet.');
    if (Math.abs(d.brutto_eur - erwartet) > 0.004) {
      const e = new Error('Der Betrag hat sich seit der Vorschau geaendert (jetzt ' + eur(d.brutto_eur) + '). Bitte pruefen und erneut erstellen.');
      e.abweichung = true;
      throw e;
    }
  }
  if (erwartetStunden === undefined || erwartetStunden === null) return;
  if (typeof erwartetStunden !== 'number' || !Number.isFinite(erwartetStunden)) throw new Error('erwartetStunden: Zahl erwartet.');
  const jetzt = stundenSumme(d.positionen);
  if (Math.abs(jetzt - erwartetStunden) > 0.004) {
    const e = new Error('Die Stunden haben sich seit der Vorschau geaendert (jetzt ' + String(jetzt).replace('.', ',') + ' h). Bitte pruefen und erneut erstellen.');
    e.abweichung = true;
    throw e;
  }
}

function erstelle(db, daten = {}) {
  const d = entwurf(db, daten);
  pruefeErwartet(d, daten.erwartetBrutto, daten.erwartetStunden);
  // hinweise (z. B. "auf die offenen 8 h begrenzt") gehoeren nicht in die Abschrift, aber zum Aufrufer.
  return { ...schreibe(db, d), hinweise: d.hinweise };
}

// Vorschau fuer den Editor (R6): das Druck-HTML mit "ENTWURF" statt Nummer.
// Die Summen gehen mit, damit der Editor nichts nachrechnet.
function vorschau(db, daten = {}) {
  const d = entwurf(db, daten);
  return {
    html: renderHtml({ ...d, nr: 'ENTWURF' }),
    netto_eur: d.netto_eur, ust_prozent: d.ust_prozent, ust_eur: d.ust_eur,
    brutto_eur: d.brutto_eur, kleinunternehmer: d.kleinunternehmer, positionen: d.positionen, faellig_am: d.faellig_am, hinweise: d.hinweise, projekt_zeilen: d.projektZeilen,
    stunden_summe: stundenSumme(d.positionen),
    // Kopfzeitraum, wie er auf der Rechnung steht (entwurf weitet ihn ueber Projektpositionen); der Editor zeigt ihn an.
    leistung_von: d.leistung_von, leistung_bis: d.leistung_bis,
  };
}

// Baut die Abschrift ohne Nummer. Eine Stelle fuer alle Wege (aus der
// Auswertung, aus fertigen Positionen, als Vorschau), damit Steuer,
// Faelligkeit und die Abschrift des Empfaengers nicht mehrfach gebaut werden.
function dokument(db, { von, bis, empfaenger, positionen, kontaktId, zielTage = zahlungsziel() }) {
  // Vor der Nummernvergabe pruefen: eine abgelehnte Anfrage darf keine Nummer
  // aus dem fortlaufenden Kreis verbrauchen. Der Zeitraum geht als Datum in
  // die E-Rechnung und muss deshalb eines sein.
  // Form und Kalender: "2026-13-45" hat die Form, ist aber kein Tag.
  const istTag = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s))
    && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  if (!istTagSicher(istTag, von) || !istTagSicher(istTag, bis)) {
    throw new Error('Leistungszeitraum: Datum in der Form JJJJ-MM-TT erwartet.');
  }
  const kid = Number.isInteger(kontaktId) && kontaktId > 0 ? kontaktId : null;
  const abschrift = empfaengerAbschrift(db, empfaenger, kid);

  // Summiert wird ueber die gerundeten Positionen, nicht ueber die
  // ungerundeten Ausgangswerte: sonst weicht die ausgewiesene Summe um Cents
  // von den addierten Zeilen ab, und genau das faellt beim Pruefen auf.
  const netto = nettoAus(positionen);
  const { klein, satz, ust, brutto } = steuer(netto);
  const jetzt = new Date().toISOString();
  return {
    erstellt_am: jetzt, leistung_von: von, leistung_bis: bis,
    // Der Empfaenger ist die massgebliche Abschrift; kontakt_id nur der Verweis.
    empfaenger: abschrift, aussteller: stammdaten(), positionen,
    netto_eur: netto, ust_prozent: satz, ust_eur: ust, brutto_eur: brutto,
    kleinunternehmer: klein, status: 'erstellt', storno_von: null,
    kontakt_id: kid, faellig_am: tagNach(jetzt, zielTage),
  };
}

// Schreibt die Abschrift mit der naechsten Nummer und sperrt die enthaltenen
// Zeiteintraege mit ihrem Satz — beides oder nichts. Hat ein anderer Weg einen
// Eintrag seit der Vorschau abgerechnet, entsteht keine Rechnung (409).
// danach(nr): weitere Schreibvorgaenge in derselben Transaktion (Angebot -> Rechnung).
function schreibe(db, d, danach = null) {
  const jahr = new Date(d.erstellt_am).getFullYear();
  return kontakte.inTransaktion(db, () => {
    // Auch hier, nicht nur im Entwurf: Angebot -> Rechnung (ausPositionen)
    // kommt nicht ueber entwurf() (Security-Review H4).
    pruefeDoppelt(db, d.positionen);
    const { nr, laufnr } = naechsteNummer(db, jahr);
    db.prepare(`
      INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis,
        empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur,
        brutto_eur, kleinunternehmer, status, kontakt_id, faellig_am)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'erstellt',?,?)
    `).run(
      nr, jahr, laufnr, d.erstellt_am, d.leistung_von, d.leistung_bis,
      JSON.stringify(d.empfaenger), JSON.stringify(d.aussteller),
      JSON.stringify(d.positionen), d.netto_eur, d.ust_prozent, d.ust_eur, d.brutto_eur,
      d.kleinunternehmer ? 1 : 0, d.kontakt_id, d.faellig_am
    );
    const sperren = db.prepare("UPDATE zeit_eintrag SET status = 'abgerechnet', rechnung_nr = ?, satz_eingefroren = ? WHERE id = ? AND status = 'offen'");
    for (const z of d.sperre || []) {
      if (sperren.run(nr, z.satz, z.id).changes !== 1) {
        const e = new Error('Ein Eintrag wurde inzwischen abgerechnet. Bitte Vorschau erneuern.');
        e.abweichung = true;
        throw e;
      }
    }
    if (danach) danach(nr);
    return lade(db, nr);
  });
}

// Rechnung aus fertigen Positionen. Wird gebraucht, wenn die Positionen nicht
// aus der Auswertung stammen, sondern schon feststehen — etwa bei der
// Uebernahme eines Angebots. Der Weg ueber byTicket() ginge dort fehl: die
// zugesagten Stunden sind eine Schaetzung und muessen so bleiben, auch wenn
// inzwischen mehr oder weniger Zeit gemessen wurde.
function ausPositionen(db, { positionen, empfaenger, von, bis, kontaktId, danach } = {}) {
  pruefeStammdaten();
  if (!Array.isArray(positionen) || positionen.length === 0) {
    throw new Error('Keine Positionen uebergeben.');
  }
  if (!empfaenger || !empfaenger.name) throw new Error('Empfaenger fehlt (Name ist Pflicht).');
  if (!von || !bis) throw new Error('Leistungszeitraum fehlt.');

  return schreibe(db, dokument(db, { von, bis, empfaenger, positionen, kontaktId }), danach);
}

// Jede Rechnungsnummer, die von aussen hereinkommt, laeuft hier durch. Der
// Wert landet spaeter in einem Dateipfad und in einer URL — die Form wird
// deshalb geprueft, bevor irgendetwas damit gebaut wird, und nicht erst
// darauf vertraut, dass die Datenbank schon nichts Unpassendes hergibt.
const NUMMER_RE = /^\d{4}-\d{4}$/;

function lade(db, nr) {
  // Nur Text: String(["2026-0001"]) passt sonst auf die Regex.
  if (typeof nr !== 'string' || !NUMMER_RE.test(nr)) return null;
  const row = db.prepare('SELECT * FROM invoices WHERE nr = ?').get(nr);
  if (!row) return null;
  return {
    ...row,
    empfaenger: JSON.parse(row.empfaenger),
    aussteller: JSON.parse(row.aussteller),
    positionen: JSON.parse(row.positionen),
    kleinunternehmer: !!row.kleinunternehmer,
  };
}

function liste(db, opts = {}) {
  const heute = opts.heute || tagNach(new Date(), 0);
  const gezahlt = gezahltJeRechnung(db);
  return db.prepare(`
    SELECT nr, erstellt_am, empfaenger, brutto_eur, netto_eur, status, pdf_pfad,
      leistung_von, leistung_bis, storno_von, kontakt_id, faellig_am
    FROM invoices ORDER BY jahr DESC, laufnr DESC
  `).all().map((r) => {
    const g = gezahlt.get(r.nr) || { summe: 0 };
    return {
      nr: r.nr,
      erstellt_am: r.erstellt_am,
      empfaenger: (JSON.parse(r.empfaenger) || {}).name || '',
      brutto_eur: r.brutto_eur,
      netto_eur: r.netto_eur,
      status: r.status,
      hat_pdf: !!r.pdf_pfad,
      leistung_von: r.leistung_von,
      leistung_bis: r.leistung_bis,
      storno_von: r.storno_von,
      kontakt_id: r.kontakt_id,
      faellig_am: faelligAm(r),
      ...mitAmpel(r, g.summe, heute),
    };
  });
}

// Eine Rechnung samt Zahlungen fuer die aufgeklappte Zeile. Laeuft ueber
// lade(), damit die Nummernpruefung (NUMMER_RE) auch hier greift.
function detail(db, nr, opts = {}) {
  const inv = lade(db, nr);
  if (!inv) return null;
  const zahlungen = zahlungenZu(db, nr);
  const summe = rund2(zahlungen.reduce((s, z) => s + z.betrag_eur, 0));
  return { ...inv, faellig_am: faelligAm(inv), zahlungen, ...mitAmpel(inv, summe, opts.heute || tagNach(new Date(), 0)) };
}

// --- Zahlungen (Block 4a, Owner 06.10.: Free) -------------------------------
// Eine Zahlung aendert nie die Abschrift. Der Status ergibt sich aus der Summe
// der Eingaenge; ein Cent Toleranz, damit Rundung beim Kunden nicht als
// offener Rest stehen bleibt. "Ueberfaellig" ist kein Status, sondern die
// Ampel daneben (R16, frei): Tage seit der Faelligkeit, solange etwas offen ist.
const TOLERANZ = 0.01;

function statusOf(inv, gezahlt = 0) {
  if (inv.status === 'storniert' || inv.status === 'storno') return inv.status;
  const g = Number(gezahlt) || 0;
  if (inv.brutto_eur - g <= TOLERANZ + 1e-9) return 'bezahlt';
  return g > 0 ? 'teilbezahlt' : 'offen';
}

function zahlstand(inv, summe) {
  const gezahlt = rund2(summe);
  const status = statusOf(inv, gezahlt);
  // Bezahlt innerhalb der Toleranz heisst auch: kein Rest. Sonst stuende der
  // Cent in "Offen gesamt", waehrend die Rechnung als bezahlt gilt.
  const offen = inv.status === 'erstellt' && status !== 'bezahlt' ? Math.max(0, rund2(inv.brutto_eur - gezahlt)) : 0;
  return { gezahlt_eur: gezahlt, rest_eur: offen, status_abgeleitet: status };
}

// Tage seit der Faelligkeit, 0 = nicht ueberfaellig. Beide Tage als
// "JJJJ-MM-TT": Date.parse liest sie als UTC-Mitternacht, die Differenz ist ganz.
function ueberfaelligTage(faellig, status, heute) {
  if (status !== 'offen' && status !== 'teilbezahlt') return 0;
  return Math.max(0, Math.round((Date.parse(heute) - Date.parse(faellig)) / 86400000)) || 0;
}

function mitAmpel(inv, summe, heute) {
  const z = zahlstand(inv, summe);
  return { ...z, ueberfaellig_tage: ueberfaelligTage(faelligAm(inv), z.status_abgeleitet, heute) };
}

function gezahltJeRechnung(db) {
  const m = new Map();
  for (const r of db.prepare(`
    SELECT rechnung_nr, SUM(betrag_eur) AS summe, MAX(datum) AS letzte
    FROM zahlungen GROUP BY rechnung_nr
  `).all()) m.set(r.rechnung_nr, { summe: r.summe, letzte: r.letzte });
  return m;
}

function zahlungenZu(db, nr) {
  return db.prepare(`
    SELECT id, rechnung_nr, datum, betrag_eur, notiz, erstellt_am
    FROM zahlungen WHERE rechnung_nr = ? ORDER BY datum, id
  `).all(String(nr)).map((z) => ({ ...z }));
}

function istTag(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s))
    && istTagSicher((x) => new Date(x + 'T00:00:00Z').toISOString().slice(0, 10) === x, s);
}

function bucheZahlung(db, { nr, datum, betrag_eur, notiz } = {}) {
  const inv = lade(db, nr);
  if (!inv) throw new Error('Rechnung nicht gefunden.');
  if (inv.status !== 'erstellt') throw new Error(`Rechnung ${nr} ist ${inv.status} und nimmt keine Zahlung an.`);
  if (typeof betrag_eur !== 'number' || !Number.isFinite(betrag_eur) || betrag_eur <= 0) {
    throw new Error('Betrag muss eine Zahl groesser 0 sein.');
  }
  const betrag = rund2(betrag_eur);
  // Tage in Ortszeit, wie sie auf dem Kontoauszug stehen.
  const ausgestellt = tagNach(inv.erstellt_am, 0);
  const heute = tagNach(new Date().toISOString(), 0);
  if (!istTag(datum)) throw new Error('Datum in der Form JJJJ-MM-TT erwartet.');
  if (datum < ausgestellt) throw new Error('Zahlung liegt vor dem Rechnungsdatum ' + ausgestellt + '.');
  if (datum > heute) throw new Error('Zahlung liegt in der Zukunft.');
  if (notiz != null && typeof notiz !== 'string') throw new Error('Notiz muss Text sein.');
  const text = (notiz || '').trim();
  if (text.length > 200) throw new Error('Notiz zu lang (hoechstens 200 Zeichen).');

  const bisher = rund2(zahlungenZu(db, nr).reduce((s, z) => s + z.betrag_eur, 0));
  const rest = rund2(inv.brutto_eur - bisher);
  if (betrag > rest + TOLERANZ + 1e-9) {
    throw new Error(rest > 0 ? 'Betrag uebersteigt den offenen Rest von ' + eur(rest) + ' EUR.' : 'Rechnung ist bereits bezahlt.');
  }
  const r = db.prepare(`
    INSERT INTO zahlungen (rechnung_nr, datum, betrag_eur, notiz, erstellt_am) VALUES (?,?,?,?,?)
  `).run(nr, datum, betrag, text, new Date().toISOString());
  return { id: Number(r.lastInsertRowid), rechnung_nr: nr, datum, betrag_eur: betrag, notiz: text };
}

function loescheZahlung(db, id) {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Unbekannte Zahlung.');
  const r = db.prepare('DELETE FROM zahlungen WHERE id = ?').run(id);
  if (!r.changes) throw new Error('Unbekannte Zahlung.');
  return { id };
}

// Kennzahlen der Rechnungen-Seite. Gestellt und storniert nach dem Tag der
// Ausstellung im Zeitraum, Zahlungen nach ihrem Eingangstag. Offene Posten
// sind ein Bestand und haengen nicht am Zeitraum.
function kennzahlen(db, opts = {}) {
  // Nur der Tag zaehlt: ein Zeitstempel als Grenze fiele sonst um einen Tag zu kurz aus.
  const from = opts.from ? String(opts.from).slice(0, 10) : null;
  const to = opts.to ? String(opts.to).slice(0, 10) : null;
  const imZeitraum = (tag) => (!from || tag >= from) && (!to || tag <= to);
  const heute = opts.heute || tagNach(new Date(), 0);
  const gezahlt = gezahltJeRechnung(db);
  let gestelltAnzahl = 0, gestelltBrutto = 0, storniert = 0, offen = 0;
  let ueberAnzahl = 0, ueberEur = 0, ueberAelteste = null;
  const dauern = [];
  for (const r of db.prepare('SELECT nr, erstellt_am, brutto_eur, status, faellig_am FROM invoices').all()) {
    const tag = tagNach(r.erstellt_am, 0);
    if (r.status === 'storniert' && imZeitraum(tag)) storniert++;
    if (r.status !== 'erstellt') continue;
    const g = gezahlt.get(r.nr) || { summe: 0, letzte: null };
    if (imZeitraum(tag)) { gestelltAnzahl++; gestelltBrutto += r.brutto_eur; }
    const z = mitAmpel(r, g.summe, heute);
    offen += z.rest_eur;
    // Bestand wie offen: haengt am Stichtag, nicht am Zeitraum.
    if (z.ueberfaellig_tage > 0) {
      ueberAnzahl++; ueberEur += z.rest_eur;
      ueberAelteste = Math.max(ueberAelteste || 0, z.ueberfaellig_tage);
    }
    if (statusOf(r, g.summe) === 'bezahlt' && g.letzte && imZeitraum(g.letzte)) {
      dauern.push((Date.parse(g.letzte) - Date.parse(tag)) / 86400000);
    }
  }
  // Wie jeKontakt: Zahlungen zu stornierten Rechnungen zaehlen nicht.
  const bezahlt = db.prepare(`SELECT z.datum, z.betrag_eur FROM zahlungen z
    JOIN invoices i ON i.nr = z.rechnung_nr WHERE i.status = 'erstellt'`).all()
    .filter((z) => imZeitraum(z.datum)).reduce((s, z) => s + z.betrag_eur, 0);
  return {
    gestellt_anzahl: gestelltAnzahl,
    gestellt_brutto: rund2(gestelltBrutto),
    storniert_anzahl: storniert,
    offen_eur: rund2(offen),
    ueberfaellig_anzahl: ueberAnzahl,
    ueberfaellig_eur: rund2(ueberEur),
    ueberfaellig_aeltester_tage: ueberAelteste,
    bezahlt_eur: rund2(bezahlt),
    zahlungsdauer_tage: dauern.length ? Math.round(dauern.reduce((a, b) => a + b, 0) / dauern.length * 10) / 10 : null,
  };
}

// Kennzahlen der Kontakt-Akte (R10, Block 4c). Nur gestellte Rechnungen
// (status 'erstellt'): eine stornierte und ihre Gegenrechnung tragen weder
// Umsatz noch Rest — auch nicht die Zahlung, die vor dem Storno einging.
// Offenes Angebot = offen, nicht abgerechnet, nicht abgelaufen (wie
// status_abgeleitet in angebot.liste()). Ein Ort fuer Kunden- und Lead-Zaehlung;
// Spalten von angebote, Parameter: jetzt als ISO-Zeit.
const ANGEBOT_OFFEN = "status = 'offen' AND rechnung_nr IS NULL AND gueltig_bis >= ?";

function jeKontakt(db) {
  const gezahlt = gezahltJeRechnung(db);
  const m = new Map();
  const eintrag = (kid) => {
    if (!m.has(kid)) m.set(kid, { umsatz_bezahlt_eur: 0, offen_eur: 0, zahlungsdauer_tage: null, angebote_offen: 0, rechnungen: 0, dauern: [] });
    return m.get(kid);
  };
  for (const r of db.prepare(`
    SELECT nr, erstellt_am, brutto_eur, status, kontakt_id FROM invoices
    WHERE kontakt_id IS NOT NULL AND status = 'erstellt'
  `).all()) {
    const e = eintrag(r.kontakt_id);
    const g = gezahlt.get(r.nr) || { summe: 0, letzte: null };
    e.rechnungen++;
    e.umsatz_bezahlt_eur += g.summe;
    e.offen_eur += zahlstand(r, g.summe).rest_eur;
    if (statusOf(r, g.summe) === 'bezahlt' && g.letzte) {
      e.dauern.push((Date.parse(g.letzte) - Date.parse(tagNach(r.erstellt_am, 0))) / 86400000);
    }
  }
  const jetzt = new Date().toISOString();
  for (const a of db.prepare(`
    SELECT kontakt_id FROM angebote
    WHERE kontakt_id IS NOT NULL AND ${ANGEBOT_OFFEN}
  `).all(jetzt)) eintrag(a.kontakt_id).angebote_offen++;
  for (const e of m.values()) {
    e.umsatz_bezahlt_eur = rund2(e.umsatz_bezahlt_eur);
    e.offen_eur = rund2(e.offen_eur);
    e.zahlungsdauer_tage = e.dauern.length ? Math.round(e.dauern.reduce((s, x) => s + x, 0) / e.dauern.length * 10) / 10 : null;
    delete e.dauern;
  }
  return m;
}

// --- Abrechnungsstand --------------------------------------------------------
// Welcher Vorgang steckt in welcher gestellten Rechnung, und mit welchem Betrag.
// Nur status='erstellt' zaehlt: ein storniertes Original steht auf 'storniert',
// seine Gegenrechnung auf 'storno' — beide fallen damit heraus, ohne dass die
// negativen Betraege gegeneinander verrechnet werden muessen.
function abrechnung(db) {
  const rows = db.prepare(`
    SELECT nr, positionen FROM invoices
    WHERE status = 'erstellt' ORDER BY jahr, laufnr
  `).all();

  // Ohne Prototyp: ein Vorgang namens "__proto__" waere sonst kein Schluessel,
  // sondern wuerde beim Lesen das Prototyp-Objekt liefern.
  const map = Object.create(null);
  for (const r of rows) {
    for (const p of positionenVon(r)) {
      if (!p || !p.ticket) continue;
      const e = map[p.ticket] || (map[p.ticket] = { betrag_eur: 0, nummern: [] });
      e.betrag_eur = rund2(e.betrag_eur + (Number(p.betrag_eur) || 0));
      if (!e.nummern.includes(r.nr)) e.nummern.push(r.nr);
    }
  }
  return map;
}

// Projektkonto (Block B): was bis `bis` geleistet, was schon gestellt ist, was offen
// bleibt. "Berechnet" liest die Abschriften selbst (nur status='erstellt', Storno faellt
// heraus): Projektpositionen, Zeitpositionen mit Ziel Projekt und Projekt-Kulanz.
// Nie negativ: ein Ueberhang steht in ueber_h, nicht als Minus in offen_h.
// Was die gestellten Rechnungen je Projekt schon berechnet haben. Die Abschriften werden einmal
// gelesen: `je` laesst viele Konten (offene Projekte ausserhalb des Zeitraums) eine Map teilen.
function berechnetJe(db) {
  const je = new Map();
  for (const r of db.prepare("SELECT nr, positionen FROM invoices WHERE status = 'erstellt' ORDER BY jahr, laufnr").all()) {
    for (const p of positionenVon(r)) {
      const name = projektVon(p);
      if (!name) continue;
      // zeitPositionen: gerundete Zeitpositionen, Spielraum der Kontoregel (pruefeKonto)
      const e = je.get(name) || { berechnet: 0, zeitPositionen: 0, nummern: [], bisMax: '' };
      e.berechnet += Number(p.stunden) || 0;
      if (p.typ === 'zeit') e.zeitPositionen += 1;
      if (p.bis && p.bis > e.bisMax) e.bisMax = p.bis;
      if (!e.nummern.includes(r.nr)) e.nummern.push(r.nr);
      je.set(name, e);
    }
  }
  return je;
}
// R14: offen, aber der letzte Tag mit Leistung ist schon berechnet. Nur Hinweis, keine Sperre: FIFO legt die
// Stunden auf bereits berechnete Tage, der Owner entscheidet. Gestellte Positionen ohne `bis` zaehlen nicht.
const OFFEN_IN_BERECHNET = 'offene Stunden liegen in bereits berechneten Tagen — Zeitmodell oder Einlesen geändert?';
function projektKonto(db, projekt, bis, je = berechnetJe(db)) {
  const einheiten = metrics.projektEinheiten(db, projekt, bis);
  const geleistet = einheiten.reduce((a, e) => a + e.stunden, 0);
  const { berechnet, zeitPositionen, nummern, bisMax } = je.get(projekt) || { berechnet: 0, zeitPositionen: 0, nummern: [], bisMax: '' };
  const offen = rund2(Math.max(0, geleistet - berechnet));
  const letzterTag = einheiten.length ? einheiten[einheiten.length - 1].tag : '';
  return {
    geleistet_h: rund2(geleistet), berechnet_h: rund2(berechnet), zeit_positionen: zeitPositionen,
    offen_h: offen, ueber_h: rund2(Math.max(0, berechnet - geleistet)),
    offen_in_berechnet: offen > 0 && !!bisMax && letzterTag <= bisMax,
    nummern: [...nummern], satz: metrics.satzFuerProjekt(projekt).satz, letzter_tag: letzterTag || null,
  };
}

// Rechnungen, die auf ein Projekt buchen (Projektseite): je Rechnung die Summe der Positionen, deren
// projektVon() der Name ist. Alle Status, damit Storno und Gegenrechnung sichtbar bleiben; wer nur die
// gueltigen summieren will, nimmt status 'erstellt' (= berechnetJe). Rechnungen ohne Projektposition fehlen.
function rechnungenJeProjekt(db, name) {
  const out = [];
  for (const r of db.prepare('SELECT nr, erstellt_am, status, storno_von, positionen FROM invoices ORDER BY jahr DESC, laufnr DESC').all()) {
    const meine = positionenVon(r).filter((p) => projektVon(p) === name);
    if (!meine.length) continue;
    out.push({ nr: r.nr, erstellt_am: r.erstellt_am, status: r.status, storno_von: r.storno_von || null,
      stunden: rund2(meine.reduce((a, p) => a + (Number(p.stunden) || 0), 0)),
      betrag_eur: rund2(meine.reduce((a, p) => a + (Number(p.betrag_eur) || 0), 0)) });
  }
  return out;
}

// Projektkonten fuer metrics.kennzahlen: je ticketloser Projektzeile das Konto bis zum Ende
// des ausgewerteten Zeitraums (nie "heute": eine vergangene Ansicht darf keinen Ueberhang
// von spaeter gestellten Rechnungen zeigen). Ein Konto je Projekt, nicht je Zeile.
// `zeitraum`: { to, month } wie die Auswertung; ohne beides bis heute.
function kontoBis(zeitraum) {
  const z = typeof zeitraum === 'string' ? { to: zeitraum } : (zeitraum || {});
  let bis = z.to ? String(z.to).slice(0, 10) : undefined;
  if (!bis && z.month) bis = ortsTag(new Date(Number(z.month.slice(0, 4)), Number(z.month.slice(5, 7)), 0));
  return bis;
}
function projektKonten(db, zeilen, zeitraum) {
  const bis = kontoBis(zeitraum);
  const je = berechnetJe(db);
  const map = new Map();
  // Nur dann darf kennzahlen() einen Ueberhang melden. Die Oberflaeche schickt immer `to` (Monat: heute),
  // deshalb zaehlt auch bis >= heute (Ortstag) als Heute-Sicht.
  map.bisHeute = !bis || bis >= ortsTag(new Date());
  map.je = je;   // fuer projektKontenRest: dieselben Abschriften, nicht ein zweites Mal gelesen
  for (const r of zeilen) {
    if (r.ticket == null && r.art === 'projekt' && r.gruppe && !map.has(r.gruppe)) map.set(r.gruppe, projektKonto(db, r.gruppe, bis, je));
  }
  // Mehr berechnet als geleistet, auch ohne Zeile im Zeitraum (z. B. Projekt umbenannt: der alte Name hat
  // Rechnungen, aber keine Arbeit mehr). Nur Heute-Sicht (R4); so sehen es kennzahlen() und die Anzeige.
  if (map.bisHeute) {
    for (const name of je.keys()) {
      if (map.has(name)) continue;
      const k = projektKonto(db, name, bis, je);
      if (k.ueber_h > 0) map.set(name, k);
    }
  }
  return map;
}

// R12: Projekte mit offenen Stunden, die im ausgewerteten Zeitraum keine Zeile haben (Teilrechnung im
// August, Rest im Oktober, dort keine neue Arbeit). Ohne sie fiele der Rest aus der Auswahl. Dieselbe
// Quelle wie projektKonten (das Konto), eine Map, kein Konto je Aufruf; nur offen_h > 0.
function projektKontenRest(db, konten, zeitraum) {
  const bis = kontoBis(zeitraum);
  const rest = new Map();
  for (const name of metrics.projektNamen(db)) {
    if (konten.has(name)) continue;
    const k = projektKonto(db, name, bis, konten.je);
    if (k.offen_h > 0) rest.set(name, k);
  }
  return rest;
}

// Die Konten fuer die Auswahl im Editor (/api/summary): Klartext je Projekt. `ueberhang` ist die
// Liste aus metrics.kennzahlen (nur Heute-Sicht und ueber der Toleranz, R4/R9) - nur dort steht
// ueber_h, sonst 0; die Schwelle haelt metrics, hier steht sie nicht ein zweites Mal.
function projektKontenAnzeige(konten, ueberhang, rest = new Map()) {
  // Ohne Prototyp: ein Projekt namens "__proto__" waere sonst kein Schluessel.
  const aus = Object.create(null);
  for (const [name, k] of [...konten, ...rest]) {
    const u = (ueberhang || []).find((x) => x.projekt === name);
    aus[name] = { geleistet_h: k.geleistet_h, berechnet_h: k.berechnet_h, offen_h: k.offen_h, ueber_h: u ? u.ueber_h : 0, nummern: k.nummern, letzter_tag: k.letzter_tag,
      ...(konten.bisHeute && k.offen_in_berechnet ? { hinweis: OFFEN_IN_BERECHNET } : {}) };
  }
  return aus;
}

// Sitzung nachtraeglich auf einen Vorgang buchen: Stunden, die schon auf einer Projektrechnung stehen,
// duerfen das Konto nicht verlassen, sonst stuenden sie auf zwei Rechnungen. `buchen` laeuft mit der
// Pruefung in einem Savepoint (kein await dazwischen); steigt der Ueberhang eines betroffenen Projekts,
// bleibt nichts stehen. Projekte ohne Rechnung kosten keine Kontorechnung.
function bucheOhneDoppelung(db, sessionId, buchen) {
  const je = berechnetJe(db);
  const projekte = db.prepare('SELECT project FROM events WHERE session_id = ? UNION SELECT project FROM activity WHERE session_id = ?').all(sessionId, sessionId)
    .map((r) => r.project).filter((p) => je.has(p));
  const vorher = new Map(projekte.map((p) => [p, projektKonto(db, p, undefined, je).ueber_h]));
  return kontakte.inTransaktion(db, () => {
    const aus = buchen();
    for (const p of projekte) {
      if (projektKonto(db, p, undefined, je).ueber_h > vorher.get(p)) throw Object.assign(new Error(gestelltText(p)), { status: 409 });
    }
    return aus;
  });
}

// Bis zu welchem Tag die Claude-Zeit eines Vorgangs (oder ticketlosen
// Projekts) schon gestellt ist: je Schluessel das spaeteste Positions-Ende.
// Nur lesen; dient der Teilabrechnung ab dem Folgetag (C4).
function abgerechnetBis(db) {
  const map = Object.create(null);
  for (const r of db.prepare("SELECT nr, leistung_bis, positionen FROM invoices WHERE status = 'erstellt'").all()) {
    for (const p of positionenVon(r)) {
      // Projektpositionen: das Konto sagt, was offen ist, nicht ein Tag.
      if (!p || !p.ticket || p.typ === 'zeit' || projektVon(p)) continue;
      const bis = p.bis || r.leistung_bis;
      if (bis && (!map[p.ticket] || bis > map[p.ticket])) map[p.ticket] = bis;
    }
  }
  return map;
}

// Sitzung umbuchen oder Buchung zuruecknehmen: Arbeit bis zum gestellten Stand eines Vorgangs bleibt dort,
// sonst stuende sie unter dem neuen Ziel ein zweites Mal zur Abrechnung. ziel = neuer Vorgang (gross) oder null.
function pruefeSitzungGestellt(db, sessionId, ziel) {
  const bis = Object.create(null);
  for (const [k, tag] of Object.entries(abgerechnetBis(db))) bis[k.toUpperCase()] = tag;
  const z = db.prepare(`SELECT ticket, MIN(day) AS tag FROM (SELECT ticket, day FROM events WHERE session_id = ? UNION ALL SELECT ticket, day FROM activity WHERE session_id = ?)
    WHERE ticket IS NOT NULL GROUP BY ticket`).all(sessionId, sessionId).find((r) => {
    const k = r.ticket.toUpperCase();
    return k !== ziel && bis[k] && r.tag <= bis[k];
  });
  if (z) throw Object.assign(new Error('Diese Sitzung steht auf ' + z.ticket + ' schon in Rechnung — die Zeit bleibt dort, sonst wäre sie zweimal abrechenbar. Erst stornieren, dann umbuchen.'), { status: 409 });
}

// Was fuer die genannten Vorgaenge (und ticketlose Projekte) noch offen zum
// Abrechnen ist: die Nutzlast, die ein Rechnungsentwurf bekommt, ohne
// Empfaenger. Eine Stelle fuer den Cira-Entwurf und das Board (C7a).
// Gestellte Claude-Zeit nie ein zweites Mal. Ein Vorgang, der bis zu einem
// Tag gestellt ist und danach neue Zeit hat, ist "teilweise gestellt": allein
// angefragt wird ab dem Folgetag abgerechnet, in einer Sammelanfrage wird er
// ausgelassen und genannt (sonst fehlte seine neue Zeit still).
// vorgaenge: Zeilen aus metrics.byTicket; kundeId nur bei einer Kunden-Anfrage.
const ortsTag = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// vorab: gestellt/bisJe/liste schon gelesen (offenJeVorgang fragt sie fuer viele Vorgaenge nur einmal).
function offeneDaten(db, { vorgaenge = [], projekte = [], kundeId = null } = {}, vorab = {}) {
  const gestellt = vorab.gestellt || abrechnung(db);
  const bisJe = vorab.bisJe || abgerechnetBis(db);
  const folgetag = (iso) => ortsTag(new Date(new Date(iso + 'T12:00:00').getTime() + 864e5));
  const teilweise = (schluessel, letzter) => !!gestellt[schluessel] && !!bisJe[schluessel] && letzter > bisJe[schluessel];
  const schon = vorgaenge.filter((t) => gestellt[t.ticket] && !teilweise(t.ticket, t.last_day));
  const teil = vorgaenge.filter((t) => teilweise(t.ticket, t.last_day));
  let offen = vorgaenge.filter((t) => !gestellt[t.ticket]);
  let ab = null;
  if (vorgaenge.length === 1 && teil.length === 1) {
    ab = folgetag(bisJe[teil[0].ticket]);
    offen = metrics.byTicket(db, { ticket: teil[0].ticket, from: ab, to: teil[0].last_day }).filter((t) => t.ticket === teil[0].ticket);
  }
  const ausgelassen = ab ? [] : teil.map((t) => t.ticket + ' (gestellt bis ' + bisJe[t.ticket] + ', neue Zeit danach: einzeln anfordern mit „Rechnung für ' + t.ticket + '“)');
  const tickets = offen.filter((t) => t.active_hours > 0 || (t.lokal_betrag_eur || 0) > 0);
  // Projekte (Block B): das Konto entscheidet, nicht "irgendwann gestellt". Ein Projekt
  // mit offenen Stunden bleibt offen, auch wenn schon Teile berechnet sind.
  // Die Gesamtzeile kennt auch gestellte lokale Nutzung: die Pauschale zaehlt nur fuer Tage nach der letzten.
  const je = projekte.length ? berechnetJe(db) : null;
  const projektZeilen = projekte.length
    ? metrics.ohneTicket(db, {}).filter((t) => t.art === 'projekt' && projekte.includes(t.gruppe) && (projektKonto(db, t.gruppe, undefined, je).offen_h > 0 || ((t.lokal_betrag_eur || 0) > 0 && offenePauschale(db, t.gruppe) !== null))) : [];
  // Manuelle Zeit sperrt sich je Eintrag: auch auf gestellten Vorgaengen ist offene Zeit abrechenbar.
  const keys = new Set(vorgaenge.map((t) => t.ticket));
  const liste = vorab.liste || zeit.liste(db, { status: 'offen' });
  const basis = { gestellt, schon, teil, vorgaenge: offen, ab, ausgelassen };
  // zeit.liste liefert hoechstens 2000: dann waere die Auswahl still unvollstaendig.
  if (liste.length >= 2000) return { ...basis, zuViele: true, daten: null };
  const passend = liste.filter((e) => e.abrechenbar && (
    (e.ziel_art === 'vorgang' && keys.has(e.ziel_schluessel))
    // Manuelle Projektzeit steckt im Konto und kommt ueber die Projektposition, nicht zusaetzlich einzeln.
    || (e.ziel_art === 'kunde' && kundeId !== null && e.ziel_schluessel === String(kundeId))));
  // Ab dem Folgetag des letzten Belegs: aeltere offene Eintraege laegen sonst mit im ueberlappenden Zeitraum.
  const eintraege = ab ? passend.filter((e) => e.tag >= ab) : passend;
  if (eintraege.length < passend.length) ausgelassen.push((passend.length - eintraege.length) + ' offene Zeiteinträge vor dem ' + ab + ' (im Beleg-Editor)');
  // Projekte: der letzte Tag der Einheiten zaehlt (auch manuelle Zeit), die Auswertungszeile kennt nur Claude-Events.
  // `from` braucht keine Einheiten: entwurf() weitet den Kopf auf die Positionen.
  const projektTage = (t) => { const e = metrics.projektEinheiten(db, t.gruppe).map((x) => x.tag).sort(); return [t.first_day, t.last_day, e[e.length - 1]]; };
  const tage = tickets.flatMap((t) => [t.first_day, t.last_day]).concat(projektZeilen.flatMap(projektTage), eintraege.map((e) => e.tag)).filter(Boolean).sort();
  const daten = tage.length ? {
    from: ab && ab < tage[0] ? ab : tage[0], to: tage[tage.length - 1], tickets: tickets.map((t) => t.ticket),
    ...(projektZeilen.length ? { projekte: projektZeilen.map((t) => t.gruppe) } : {}), ...(eintraege.length ? { eintraege: eintraege.map((e) => e.id) } : {}),
  } : null;
  return { ...basis, tickets, projektZeilen, eintraege, daten, zuViele: false };
}

// Offener Nettobetrag je Vorgang, wie ihn ein Rechnungsentwurf fuer genau
// diesen Vorgang stellen wuerde. Nichts offen = 0.
// zeilen: metrics.byTicket(db, {}), falls der Aufrufer sie schon hat (kostet bei
// grossen Ledgern rund eine Sekunde).
function offenJeVorgang(db, keys, zeilen = null) {
  const alle = zeilen || metrics.byTicket(db, {});
  const vorab = { gestellt: abrechnung(db), bisJe: abgerechnetBis(db), liste: zeit.liste(db, { status: 'offen' }) };
  const aus = Object.create(null);
  const buendel = [];
  for (const key of keys) {
    const od = offeneDaten(db, { vorgaenge: alle.filter((t) => t.ticket === key) }, vorab);
    if (od.zuViele) throw new Error('2000 oder mehr offene Zeiteinträge — offener Betrag nicht bestimmbar.');
    if (!od.daten) aus[key] = 0;
    else if (od.ab) aus[key] = nettoAus(baueMitSperre(db, od.daten).positionen);   // teilweise gestellt: eigener Zeitraum ab dem Folgetag
    else buendel.push({ key, daten: od.daten });
  }
  // Ohne Teilabrechnung liegt die ganze Zeit eines Vorgangs in seinem eigenen
  // Zeitraum; ein gemeinsamer Aufbau ueber den umfassenden Zeitraum ergibt
  // dieselben Positionen je Vorgang. baueMitSperre wertet je Aufruf den ganzen
  // Zeitraum aus (~150 ms) — einzeln kostete die Erledigt-Spalte sonst Sekunden.
  for (let i = 0; i < buendel.length; i += 200) {
    const teil = buendel.slice(i, i + 200);
    const tage = teil.flatMap((b) => [b.daten.from, b.daten.to]).sort();
    const eintraege = teil.flatMap((b) => b.daten.eintraege || []);
    const pos = baueMitSperre(db, { from: tage[0], to: tage[tage.length - 1], tickets: teil.flatMap((b) => b.daten.tickets), ...(eintraege.length ? { eintraege } : {}) }).positionen;
    for (const { key } of teil) {
      aus[key] = nettoAus(pos.filter((p) => (p.typ !== 'zeit' && p.ticket === key) || (p.typ === 'zeit' && p.ziel_art === 'vorgang' && p.ziel === key)));
    }
  }
  return aus;
}

// Billiger Vorfilter: welche Vorgaenge haben ueberhaupt etwas Offenes zum
// Abrechnen (ohne Positionen zu bauen)? Ein Satz 0 kann den Betrag trotzdem 0
// machen; wer den Betrag braucht, fragt offenJeVorgang.
function mitOffenem(db, keys, zeilen = null) {
  const alle = zeilen || metrics.byTicket(db, {});
  const vorab = { gestellt: abrechnung(db), bisJe: abgerechnetBis(db), liste: zeit.liste(db, { status: 'offen' }) };
  return keys.filter((key) => offeneDaten(db, { vorgaenge: alle.filter((t) => t.ticket === key) }, vorab).daten !== null);
}

// Was zu einem Vorgang insgesamt gestellt ist: Claude-Zeit aus den
// Vorgangspositionen, manuelle Zeit aus den Zeitpositionen. Fuer die Marge im
// Vorgangs-Detail — ohne den manuellen Teil laege sie zu niedrig, sobald
// manuelle Zeit mitgestellt ist.
function abgerechnetFuerVorgang(db, key) {
  const claude = (abrechnung(db)[key] || { betrag_eur: 0 }).betrag_eur;
  let manuell = 0;
  for (const r of db.prepare("SELECT nr, positionen FROM invoices WHERE status = 'erstellt'").all()) {
    for (const p of positionenVon(r)) {
      if (p && p.typ === 'zeit' && p.ziel_art === 'vorgang' && p.ziel === key) manuell += Number(p.betrag_eur) || 0;
    }
  }
  return rund2(claude + manuell);
}

// Steht auf diesem Vorgang schon etwas in einer gestellten Rechnung (Claude-Zeit
// oder manuelle Zeit)? Dann darf er nicht umgebucht werden (C7b "Als Jira
// anlegen"): die gestellte Zeit waere unter dem neuen Schluessel ein zweites
// Mal abrechenbar.
// Ohne Gross-/Kleinschreibung, wie das Umbuchen selbst (COLLATE NOCASE).
const gestelltText = (key) => 'Auf ' + key + ' ist schon etwas in Rechnung gestellt — die Zeit bleibt dort, sonst wäre sie unter dem Jira-Ticket ein zweites Mal abrechenbar.';
function gestelltAuf(db, key) {
  const k = String(key).toUpperCase();
  const gleich = (v) => v != null && String(v).toUpperCase() === k;
  for (const r of db.prepare("SELECT nr, positionen FROM invoices WHERE status = 'erstellt'").all()) {
    for (const p of positionenVon(r)) {
      if (p && (gleich(p.ticket) || (p.typ === 'zeit' && p.ziel_art === 'vorgang' && gleich(p.ziel)))) return true;
    }
  }
  return !!db.prepare("SELECT 1 FROM zeit_eintrag WHERE ziel_art = 'vorgang' AND ziel_schluessel = ? COLLATE NOCASE AND status = 'abgerechnet' LIMIT 1").get(key);
}

// --- Storno ------------------------------------------------------------------
// Loeschen gibt es nicht: eine ausgegebene Nummer bleibt vergeben, sonst
// entsteht eine Luecke in der fortlaufenden Reihe. Die Korrektur ist eine
// eigene Rechnung mit negativen Betraegen.
function storniere(db, nr) {
  const original = lade(db, nr);
  if (!original) throw new Error('Rechnung nicht gefunden.');
  if (original.status !== 'erstellt') {
    throw new Error(`Rechnung ${nr} ist bereits ${original.status}.`);
  }

  const jahr = new Date().getFullYear();
  const { nr: stornoNr, laufnr } = naechsteNummer(db, jahr);
  const positionen = original.positionen.map((p) => ({ ...p, betrag_eur: -p.betrag_eur }));

  // Gegenrechnung und Storno des Originals gemeinsam oder gar nicht: sonst
  // stuenden beide als gestellt da und zaehlten offen.
  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis,
        empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur,
        brutto_eur, kleinunternehmer, status, storno_von)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'storno',?)
    `).run(
      stornoNr, jahr, laufnr, new Date().toISOString(),
      original.leistung_von, original.leistung_bis,
      JSON.stringify(original.empfaenger), JSON.stringify(original.aussteller),
      JSON.stringify(positionen), -original.netto_eur, original.ust_prozent,
      -original.ust_eur, -original.brutto_eur, original.kleinunternehmer ? 1 : 0, nr
    );
    db.prepare("UPDATE invoices SET status = 'storniert' WHERE nr = ?").run(nr);
    // Die Eintraege sind wieder stellbar; die stornierte Abschrift bleibt, wie sie ist.
    db.prepare("UPDATE zeit_eintrag SET status = 'offen', rechnung_nr = NULL, satz_eingefroren = NULL WHERE rechnung_nr = ?").run(nr);
    // Ein uebernommenes Angebot wird wieder abrechenbar (Toolcheck 15.10., H6).
    db.prepare('UPDATE angebote SET rechnung_nr = NULL WHERE rechnung_nr = ?').run(nr);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return lade(db, stornoNr);
}

// --- Druckansicht ------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function eur(n) {
  return (Number(n) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + ' EUR';
}

function datum(iso) {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '';
}

// Steuer aus dem Nettobetrag. Eine Stelle fuer Rechnung und Angebot — zwei
// Formeln waeren die sicherste Art, dass beide Dokumente eines Tages
// verschiedene Betraege fuer dieselbe Leistung ausweisen.
function steuer(netto) {
  const klein = !!(config.rechnung && config.rechnung.kleinunternehmer);
  const satz = klein ? 0 : Number(config.rechnung.ustSatz) || 0;
  const ust = rund2(netto * satz / 100);
  return { klein, satz, ust, brutto: rund2(netto + ust) };
}

// Positionszeilen der Leistungstabelle. Die Vergleichsangabe steht bewusst
// beim Leistungstext und nicht neben dem Betrag: ein hypothetischer Wert
// direkt neben einem echten Preis liest sich als Streichpreis.
// Text einer Position ohne eigene Bezeichnung. Eine Projektposition (Feld projekt) hat keinen Vorgang:
// das Wort "Vorgang" waere auf dem unveraenderlichen Beleg falsch. Alte Abschriften ohne projekt
// drucken unveraendert. Eine Stelle fuer HTML und E-Rechnung.
const positionsName = (p) => p.bezeichnung
  || (p.projekt ? 'Entwicklungsleistung Projekt ' + p.projekt : 'Entwicklungsleistung Vorgang ' + p.ticket);

function positionsZeilen(positionen, dokument) {
  const std = (n) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' h';
  // Im Angebot ist nichts erfasst, sondern kalkuliert — das Wort muss zum
  // Dokument passen, sonst behauptet ein Angebot gemessene Zeiten.
  const eigen = dokument === 'angebot' ? 'kalkuliert' : 'erfasst';
  const vergleichText = (p) => (p.vergleich_stunden && typeof p.stunden === 'number'
    ? `${eigen} ${esc(std(p.stunden))}, klassische Entwicklung gesch&auml;tzt ${esc(std(p.vergleich_stunden))}`
    : '');
  return positionen.map((p) => {
    // Eine Pauschalposition hat keine Stunden. Die Pruefung geht bewusst ueber
    // den Typ hinaus: eine Abschrift ohne Stundenzahl darf die Druckansicht
    // niemals zum Absturz bringen, sonst haengt auch die PDF-Erzeugung.
    const pauschal = p.typ === 'pauschal' || typeof p.stunden !== 'number';
    // Teile der Unterzeile zusammensetzen und erst dann verbinden: sonst steht
    // ein Trennzeichen am Anfang, wenn der Zeitraum fehlt (freie Posten).
    const teile = [];
    // Zeitpositionen nennen ihre Tage, solange es wenige sind.
    if (Array.isArray(p.tage) && p.tage.length && p.tage.length <= 12) {
      teile.push(p.tage.map((t) => esc(String(t).slice(8, 10) + '.' + String(t).slice(5, 7) + '.')).join(', '));
    } else if (p.von) teile.push(esc(p.von) + ' bis ' + esc(p.bis));
    if (p.rabatt_prozent > 0) {
      teile.push(`${esc(eur(p.basissatz))}/h abzgl. ${esc(String(p.rabatt_prozent))} % Rabatt`);
    }
    const v = vergleichText(p);
    if (v) teile.push(v);
    return `
      <tr>
        <td>
          ${esc(positionsName(p))}<br>
          <span class="klein">${teile.join(' &middot; ')}</span>
        </td>
        <td class="r">${pauschal ? 'pauschal' : esc(p.stunden.toLocaleString('de-DE', { minimumFractionDigits: 2 }))}</td>
        <td class="r">${pauschal ? '&ndash;' : esc(eur(p.satz))}</td>
        <td class="r">${esc(eur(p.betrag_eur))}</td>
      </tr>`;
  }).join('');
}

// Einordnung der Vergleichsangabe. Erscheint nur, wenn ueberhaupt eine
// vorkommt — ein Hinweis auf etwas Unsichtbares verwirrt mehr, als er nuetzt.
function vergleichsHinweis(positionen, dokument) {
  if (!positionen.some((p) => p.vergleich_stunden)) return '';
  return `<p class="klein">Die Angabe zur klassischen Entwicklung ist eine rechnerische Sch&auml;tzung auf Basis
  eines pauschalen Faktors, keine Preiszusage und kein Alternativangebot. Unabh&auml;ngige Untersuchungen
  zur Produktivit&auml;t mit KI-Werkzeugen kommen zu stark abweichenden Ergebnissen. Berechnungsgrundlage
  ${dokument === 'angebot' ? 'dieses Angebots' : 'dieser Rechnung'} ist ausschlie&szlig;lich die
  ${dokument === 'angebot' ? 'kalkulierte' : 'tats&auml;chlich erfasste'} Arbeitszeit.</p>`;
}

// Papier-Optik der Druckansicht; die Mahnung (mahnung.js) traegt dieselbe.
const PAPIER_CSS = `  /* Bewusst hell: das Dokument wird gedruckt und liegt beim Kunden. Der dunkle
     Dashboard-Grund waere hier falsch — Drucker unterdruecken Flaechen, und
     Toner kostet. Vom Farbschema traegt nur der Akzent nach aussen. */
  :root { --akzent: #ea580c; --tinte: #111; --grau: #666; --linie: #ddd; }
  body { font: 14px/1.5 "Segoe UI", system-ui, sans-serif; color: var(--tinte);
         max-width: 20cm; margin: 2cm auto; padding: 0 1cm; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -.01em; }
  /* Der Akzent sitzt auf der Kopfkante, nicht im Text: eine Rechnung wird
     gelesen, nicht ueberflogen — Farbe markiert das Dokument, nicht Inhalte. */
  h1::after { content: ""; display: block; width: 44px; height: 3px;
              background: var(--akzent); margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th, td { padding: 8px 6px; border-bottom: 1px solid var(--linie); text-align: left;
           vertical-align: top; }
  th { border-bottom: 2px solid var(--akzent); font-size: 12px; text-transform: uppercase;
       letter-spacing: .05em; color: var(--tinte); }
  .r { text-align: right; white-space: nowrap;
       font-variant-numeric: tabular-nums; }
  .klein { color: var(--grau); font-size: 12px; }
  .kopf { display: flex; justify-content: space-between; gap: 32px; }
  .summe td { border-bottom: none; padding-top: 4px; }
  .gesamt td { border-top: 2px solid var(--akzent); font-weight: 600; font-size: 15px; }
  .hinweis { background: #faf6f2; border-left: 3px solid var(--akzent);
             padding: 10px 12px; }
  .fuss { margin-top: 32px; font-size: 12px; color: #444;
          border-top: 1px solid var(--linie); padding-top: 14px; }
  .storno { color: #b91c1c; font-weight: 600; }
  /* Farbe muss der Druck nicht wiedergeben; ohne exact wirft der Treiber die
     Flaechen raus und der Hinweiskasten steht ohne Abgrenzung da. */
  @media print {
    body { margin: 0; max-width: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

function renderHtml(inv) {
  const a = inv.aussteller || {};
  const e = inv.empfaenger || {};
  const tokens = inv.positionen.reduce((s, p) => s + (p.tokens_gesamt || 0), 0);
  // Projektpositionen tragen keine Tokens: "gesamt" waere falsch, die Zeile entfaellt (auch bei gemischten Belegen).
  const mitProjekt = inv.positionen.some((p) => p && p.projekt);
  // Mittags, damit die Umrechnung in die Ortszeit den Tag nicht verschiebt.
  const faellig = new Date(faelligAm(inv) + 'T12:00:00');

  const zeilen = positionsZeilen(inv.positionen, 'rechnung');
  const hinweisVergleich = vergleichsHinweis(inv.positionen, 'rechnung');

  const steuerZeile = inv.kleinunternehmer
    ? '<p class="hinweis">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>'
    : `<tr><td colspan="3" class="r">zzgl. ${esc(String(inv.ust_prozent))} % Umsatzsteuer</td>
         <td class="r">${esc(eur(inv.ust_eur))}</td></tr>`;

  return `<!doctype html>
<meta charset="utf-8">
<title>Rechnung ${esc(inv.nr)}</title>
<style>
${PAPIER_CSS}</style>
<div class="kopf">
  <div>
    <div class="klein">${esc(a.name)}, ${esc((a.anschrift || []).join(', '))}</div>
    <p><strong>${esc(e.name)}</strong><br>${(e.anschrift || []).map(esc).join('<br>')}</p>
  </div>
  <div class="klein">
    <strong>${esc(a.name)}</strong><br>
    ${(a.anschrift || []).map(esc).join('<br>')}<br>
    ${a.steuernummer ? 'Steuernummer: ' + esc(a.steuernummer) + '<br>' : ''}
    ${a.ustIdNr ? 'USt-IdNr.: ' + esc(a.ustIdNr) + '<br>' : ''}
  </div>
</div>

<h1>${inv.status === 'storno' ? 'Stornorechnung' : 'Rechnung'} ${esc(inv.nr)}</h1>
${inv.status === 'storno' ? `<p class="storno">Storno zu Rechnung ${esc(inv.storno_von)}</p>` : ''}
${inv.status === 'storniert' ? '<p class="storno">Diese Rechnung wurde storniert.</p>' : ''}
<p class="klein">
  Rechnungsdatum: ${esc(datum(inv.erstellt_am))} &middot;
  Leistungszeitraum: ${esc(inv.leistung_von)} bis ${esc(inv.leistung_bis)}${
  // Nur wenn die Abschrift eine traegt: Rechnungen von vor der Kundennummer
  // muessen byte-gleich bleiben.
  e.kundennummer ? ` &middot;\n  Kundennummer: ${esc(e.kundennummer)}` : ''}
</p>

<table>
  <thead><tr><th>Leistung</th><th class="r">Stunden</th><th class="r">Satz</th><th class="r">Betrag</th></tr></thead>
  <tbody>${zeilen}</tbody>
  <tfoot>
    <tr class="summe"><td colspan="3" class="r">Nettobetrag</td><td class="r">${esc(eur(inv.netto_eur))}</td></tr>
    ${inv.kleinunternehmer ? '' : steuerZeile}
    <tr class="gesamt"><td colspan="3" class="r">Rechnungsbetrag</td><td class="r">${esc(eur(inv.brutto_eur))}</td></tr>
  </tfoot>
</table>

${inv.kleinunternehmer ? steuerZeile : ''}

${mitProjekt ? '' : `<p class="klein">Token-Verbrauch gesamt: ${esc(tokens.toLocaleString('de-DE'))} (informativ, nicht Bestandteil der Berechnung)</p>`}
${hinweisVergleich}

<div class="fuss">
  <p>Zahlbar ohne Abzug bis ${esc(faellig.toLocaleDateString('de-DE'))}.</p>
  ${a.iban ? `<p>${esc(a.bank)}<br>IBAN: ${esc(a.iban)}${a.bic ? ' &middot; BIC: ' + esc(a.bic) : ''}</p>` : ''}
</div>
`;
}

// --- PDF ---------------------------------------------------------------------
// Chrome bringt den Druck nach PDF selbst mit. Das spart eine Abhaengigkeit,
// verlangt aber, den Browser zu finden.
function findeChrome() {
  const kandidaten = [];
  if (config.rechnung && config.rechnung.chromePfad) kandidaten.push(config.rechnung.chromePfad);

  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const lokal = process.env['LOCALAPPDATA'] || '';
  kandidaten.push(
    path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
    lokal && path.join(lokal, 'Google\\Chrome\\Application\\chrome.exe'),
  );

  try {
    const aus = execFileSync('reg', [
      'query', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve',
    ], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const m = aus.match(/REG_SZ\s+(.+\.exe)/i);
    if (m) kandidaten.push(m[1].trim());
  } catch { /* Registry-Eintrag fehlt: naechster Kandidat */ }

  // Edge ist auf Windows 11 immer da und versteht dieselben Schalter.
  kandidaten.push(
    path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
  );

  for (const k of kandidaten) {
    if (k && fs.existsSync(k)) return k;
  }
  throw new Error(
    'Weder Chrome noch Edge gefunden. Pfad zur Programmdatei in ' +
    'config.json unter rechnung.chromePfad eintragen.'
  );
}

// Bewusst asynchron: der Browser holt die Druckansicht bei genau diesem
// Server ab. Ein blockierender Aufruf wuerde die Antwort verhindern, auf die
// er wartet — der Prozess bliebe stehen, bis das Zeitlimit greift.
// Ein Druckweg fuer Rechnung und Angebot. async: fehlt der Browser, kommt
// eine Ablehnung statt eines Wurfs am Aufrufer vorbei.
async function druckePdf(url, ziel) {
  const browser = findeChrome();
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  return new Promise((ok, fehler) => {
    // Ohne Geheimnisse (SMTP-Passwort u. a.): der Browser braucht sie nicht.
    childProcess.execFile(browser, [
      '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
      `--print-to-pdf=${ziel}`,
      url,
    ], { timeout: 30000, windowsHide: true, env: kindUmgebung() }, (err) => {
      // Vollstaendig ins Protokoll, nach aussen nur ein Hinweis: die Meldung
      // des Browsers enthaelt Dateipfade und geht ueber die Schnittstelle raus.
      if (err) {
        console.error('PDF-Erzeugung fehlgeschlagen fuer', url, err);
        return fehler(new Error('PDF-Erzeugung fehlgeschlagen, Details im Serverprotokoll.'));
      }
      if (!fs.existsSync(ziel)) return fehler(new Error('PDF wurde nicht geschrieben.'));
      ok(ziel);
    });
  });
}

function erzeugePdf(db, nr, port) {
  const inv = lade(db, nr);
  if (!inv) return Promise.reject(new Error('Rechnung nicht gefunden.'));
  const ziel = path.join(RECHNUNGS_DIR, `${nr}.pdf`);
  return druckePdf(`http://127.0.0.1:${port}/rechnung/${nr}`, ziel).then(() => {
    db.prepare('UPDATE invoices SET pdf_pfad = ? WHERE nr = ?').run(ziel, nr);
    return { nr, pdf: ziel };
  });
}

module.exports = {
  pruefung,
  erstelle, baue, entwurf, vorschau, schreibe, abgerechnetFuerVorgang, abgerechnetBis, pruefeSitzungGestellt, gestelltAuf, gestelltText, bucheOhneDoppelung, berechnetJe, offeneDaten, offenJeVorgang, mitOffenem, freiePosition, ausPositionen, lade, liste, detail, abrechnung, projektKonto, projektKonten, projektKontenRest, projektKontenAnzeige, rechnungenJeProjekt, storniere, renderHtml, PAPIER_CSS, erzeugePdf, druckePdf, esc,
  stammdaten, fehlendeStammdaten, pruefeStammdaten, faelligAm, tagNach, tageZwischen,
  ANGEBOT_OFFEN,
  statusOf, faelligFestschreiben, bucheZahlung, loescheZahlung, zahlungenZu, kennzahlen, jeKontakt, istTag, pruefeErwartet,
  // Fuer das Angebotsmodul: dieselbe Steuerlogik, dieselbe Rundung, dasselbe
  // Dokumentgeruest. Ein zweiter Satz Formeln waere die sicherste Art, dass
  // Angebot und Rechnung eines Tages auseinanderlaufen.
  rund2, steuer, positionsZeilen, positionsName, vergleichsHinweis, eur, datum,
};
