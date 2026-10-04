'use strict';
// Wertet die Datenbank aus: Tokens, Kosten, Arbeitszeit, Mehrwert.
// Rechnet ausschliesslich auf gespeicherten Zahlen, kein Modellaufruf.
const config = require('./config.json');

const SUM_COLS = `
  COUNT(*) AS requests,
  COALESCE(SUM(input_tokens),0)  AS input_tokens,
  COALESCE(SUM(output_tokens),0) AS output_tokens,
  COALESCE(SUM(cache_w_5m),0)    AS cache_w_5m,
  COALESCE(SUM(cache_w_1h),0)    AS cache_w_1h,
  COALESCE(SUM(cache_read),0)    AS cache_read,
  COALESCE(SUM(cost_usd),0)      AS cost_usd
`;

function withTotals(row) {
  const r = row || {};
  const inp = r.input_tokens || 0;
  const out = r.output_tokens || 0;
  const cw = (r.cache_w_5m || 0) + (r.cache_w_1h || 0);
  const cr = r.cache_read || 0;
  return {
    requests: r.requests || 0,
    input_tokens: inp,
    output_tokens: out,
    cache_write_tokens: cw,
    cache_read_tokens: cr,
    total_tokens: inp + out + cw + cr,
    cost_usd: r.cost_usd || 0,
  };
}

// Aktivzeit: Summe der Abstaende zwischen aufeinanderfolgenden Ereignissen,
// aber nur solange ein Abstand die Pausenschwelle nicht ueberschreitet.
// Damit zaehlt Wartezeit auf eine Antwort des Nutzers nicht als Arbeitszeit.
function activeSecondsFromTimestamps(timestamps, gapMinutes = config.gapMinutes) {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return 0;
  const limit = gapMinutes * 60 * 1000;
  const ms = timestamps
    .map((t) => (t instanceof Date ? t.getTime() : Date.parse(t)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < ms.length; i++) {
    const gap = ms[i] - ms[i - 1];
    if (gap > 0 && gap <= limit) total += gap;
  }
  return Math.round(total / 1000);
}

// Welches Zeitmass abgerechnet wird.
// "eingaben" (Vorgabe): die eigene Zeit — ein Fenster um jede eigene Eingabe.
//   Was die KI dazwischen allein arbeitet, ist Agentenzeit und wird nicht
//   berechnet.
// "aktivitaet": jede Logzeile zaehlt, also auch die Laufzeit der KI. Fuer alle,
//   die das Beaufsichtigen eines Agenten bewusst als Arbeitszeit abrechnen.
//
// config.zeitmodell ist nur der Standard. Ein Projekt (config.projektSaetze),
// ein Vorgang oder eine einzelne Sitzung (Tabelle zeitmodell_wahl) kann ihn
// ueberschreiben. Es gilt die engste Wahl: Sitzung vor Vorgang vor Projekt.
const ZEITMODELLE = ['eingaben', 'aktivitaet'];

function zeitmodellKarte(db) {
  const sitzung = new Map();
  const vorgang = new Map();
  for (const w of db.prepare('SELECT art, schluessel, zeitmodell FROM zeitmodell_wahl').all()) {
    if (!ZEITMODELLE.includes(w.zeitmodell)) continue;
    if (w.art === 'sitzung') sitzung.set(w.schluessel, w.zeitmodell);
    else if (w.art === 'vorgang') vorgang.set(w.schluessel, w.zeitmodell);
  }
  const standard = config.zeitmodell === 'aktivitaet' ? 'aktivitaet' : 'eingaben';
  const saetze = config.projektSaetze || {};
  // Nur eigene Eintraege: ein Projekt namens "constructor" darf nicht ueber
  // den Prototyp etwas finden.
  const projekt = (p) => {
    const m = Object.hasOwn(saetze, p) && saetze[p] ? saetze[p].zeitmodell : undefined;
    return ZEITMODELLE.includes(m) ? m : null;
  };
  // Waehlt niemand "aktivitaet", braucht keine Auswertung die Zeilen ohne
  // eigene Eingabe — die Abfrage darf sie dann gleich weglassen. Das sind
  // ueber 90 % aller Zeilen.
  const nurEingaben = standard === 'eingaben'
    && ![...sitzung.values(), ...vorgang.values()].includes('aktivitaet')
    && !Object.keys(config.projektSaetze || {}).some((p) => projekt(p) === 'aktivitaet');
  return {
    sitzung, vorgang, projekt, standard, nurEingaben,
    fuer: (r) => sitzung.get(r.session_id) || (r.ticket && vorgang.get(r.ticket))
      || projekt(r.project) || standard,
  };
}

// Mehrere Modelle in einer Gruppe heissen "gemischt"; ohne Abschnitte gilt,
// was die Gruppe gewaehlt haette.
function zeitmodellAus(modelle, ersatz) {
  if (!modelle || modelle.size === 0) return ersatz;
  return modelle.size === 1 ? [...modelle][0] : 'gemischt';
}

// Claude Code schreibt mitten in eine Sitzung Zeilen ohne Arbeitsverzeichnis.
// ingest.js fuehrt sie unter diesem Projektnamen, ohne Vorgang. Bekaemen sie
// ihre Zeit selbst, verschwaende sie: zu "(unbekannt)" gibt es keine Requests
// und damit nirgends eine Zeile, die sie ausweist. Sie gehoeren zu der Arbeit,
// in der sie stehen — also zur Zeile davor in derselben Sitzung.
const UNBEKANNT = '(unbekannt)';

function erbeProjekt(r, davor) {
  if (r.project !== UNBEKANNT || !davor || davor.session_id !== r.session_id) return;
  r.project = davor.project;
  if (!r.ticket) r.ticket = davor.ticket;
}

// Tagesgrenzen eines Zeitfilters. `month` und from/to duerfen zusammen stehen.
function zeitRahmen({ from, to, month }) {
  let von = from || null;
  let bis = to || null;
  if (month) {
    if (!von || von < month + '-01') von = month + '-01';
    if (!bis || bis > month + '-31') bis = month + '-31';
  }
  return { von, bis };
}

// Die abrechenbare Zeit als Abschnitte, noch unverteilt. Ein Abschnitt gehoert
// Projekt, Vorgang und Tag der Zeile, aus der er entsteht — so bleibt die Zeit
// richtig aufgeteilt, wenn in einer Sitzung der Branch wechselt.
//
// Zwei Arten von Abschnitten:
// - Eingabefenster: eine halbe Pausenschwelle vor und nach jeder eigenen
//   Eingabe. Liegen zwei Eingaben hoechstens `gapMinutes` auseinander, zaehlt
//   die Zeit dazwischen voll; laeuft der Agent laenger allein, zaehlt genau
//   eine Pausenschwelle.
// - Aktivitaet: Abstaende zwischen aufeinanderfolgenden Zeilen bis zur
//   Pausenschwelle. Gilt im Modell "aktivitaet" und fuer Zeilen ohne
//   Eingabe-Kennung, deren Logs laengst geloescht sind.
//
// Gefiltert wird hier nur nach Zeit, und zwar einen Tag weiter als verlangt:
// Vorgang, Projekt und der genaue Zeitraum werden erst nach dem Verteilen
// ausgewaehlt. Sonst saehe ein gefilterter Aufruf die parallele Sitzung des
// anderen Vorgangs oder das Fenster jenseits der Monatsgrenze nicht, und
// dieselbe Arbeit truege je nach Ansicht verschiedene Zeiten.
function zeitAbschnitte(db, rahmen) {
  const karte = zeitmodellKarte(db);
  const rows = db.prepare(`
    SELECT session_id, ts, project, ticket, day, eingabe FROM activity
    WHERE (? IS NULL OR day >= date(?, '-1 day'))
      AND (? IS NULL OR day <= date(?, '+1 day'))
      ${karte.nurEingaben ? 'AND (eingabe IS NULL OR eingabe = 1)' : ''}
    ORDER BY session_id, ts
  `).all(rahmen.von, rahmen.von, rahmen.bis, rahmen.bis);

  const limit = config.gapMinutes * 60 * 1000;
  const halb = limit / 2;
  // Projekt, Vorgang und Sitzung legen das Modell fest. Wer in allen dreien
  // gleich ist, hat also auch dasselbe Modell.
  const gleich = (a, r) => a.session === r.session_id && a.project === r.project
    && a.ticket === r.ticket && a.day === r.day;
  const neu = (von, bis, r) => ({
    von, bis, session: r.session_id, project: r.project, ticket: r.ticket, day: r.day,
    modell: r.modell,
  });

  const out = [];
  let prev = null;
  let prevMs = 0;
  let lauf = null;
  let fenster = null;
  let davor = null;
  for (const r of rows) {
    const ms = Date.parse(r.ts);
    if (!Number.isFinite(ms)) continue;
    erbeProjekt(r, davor);
    // Das Modell haengt am Projekt, deshalb erst nach dem Erben entscheiden.
    r.modell = karte.fuer(r);
    const eingaben = r.modell === 'eingaben';
    // Im Modell "eingaben" sind Zeilen ohne eigene Eingabe Agentenzeit. Sie
    // fallen ganz heraus, auch als Vorgaenger fuer das Erben: so verhaelt sich
    // die Rechnung wie vorher, als die Abfrage sie gar nicht erst las.
    if (eingaben && r.eingabe === 0) continue;
    davor = r;

    if (eingaben && r.eingabe === 1) {
      // Wechselt die Sitzung mitten in der Arbeit von einem Vorgang mit
      // Modell "aktivitaet" hierher, gehoert die Luecke davor noch jenem
      // Vorgang: eine Luecke zaehlt dort, wo sie beginnt. Ohne das ginge sie
      // beim Zuruecksetzen unten verloren.
      if (prev && prev.modell !== 'eingaben' && r.session_id === prev.session_id) {
        const gap = ms - prevMs;
        if (gap > 0 && gap <= limit) {
          if (lauf && lauf.bis === prevMs && gleich(lauf, prev)) lauf.bis = ms;
          else out.push(neu(prevMs, ms, prev));
        }
      }
      // Fenster derselben Sitzung wachsen zusammen, damit eine Sitzung beim
      // Verteilen als ein Teilnehmer zaehlt und nicht als mehrere.
      if (fenster && gleich(fenster, r) && ms - halb <= fenster.bis) {
        fenster.bis = ms + halb;
      } else {
        fenster = neu(ms - halb, ms + halb, r);
        out.push(fenster);
      }
      prev = null;
      lauf = null;
      continue;
    }

    const gap = prev && r.session_id === prev.session_id ? ms - prevMs : Infinity;
    if (gap > 0 && gap <= limit) {
      if (lauf && lauf.bis === prevMs && gleich(lauf, prev)) {
        lauf.bis = ms;
      } else {
        lauf = neu(prevMs, ms, prev);
        out.push(lauf);
      }
    } else {
      lauf = null;
    }
    prev = r;
    prevMs = ms;
  }
  return out;
}

// Verteilt ueberlappende Abschnitte so, dass jede Minute hoechstens einmal
// zaehlt: laufen n Abschnitte gleichzeitig, bekommt jeder ein n-tel. Eine
// Stunde auf der Uhr ergibt damit hoechstens eine Stunde auf der Rechnung,
// gleich wie viele Sitzungen offen waren.
//
// Werkzeugbetrieb (overheadProjekte, lokale Modelle) begleitet die Arbeit nur.
// Laeuft er neben einer Arbeitssitzung, bekommt die Arbeit den Abschnitt ganz —
// sonst naehme jede Hintergrundsitzung dem Vorgang die halbe Zeit weg.
// Schreibt das Ergebnis als `ms` in jeden Abschnitt.
function verteile(abschnitte) {
  const punkte = [];
  abschnitte.forEach((a, i) => {
    a.ms = 0;
    a.werkzeug = isOverhead(a.project);
    // Ein Abschnitt ohne Dauer traegt keine Zeit. Im Durchlauf stuende sein
    // Ende vor seinem Anfang, und er bliebe fuer immer als offen stehen.
    if (!(a.bis > a.von)) return;
    punkte.push([a.von, 1, i], [a.bis, -1, i]);
  });
  // Bei gleicher Zeit erst schliessen, dann oeffnen: aneinanderstossende
  // Abschnitte ueberlappen nicht.
  punkte.sort((x, y) => x[0] - y[0] || x[1] - y[1]);

  const offen = new Set();
  let arbeit = 0;
  let zuletzt = 0;
  for (const [zeit, art, i] of punkte) {
    const dauer = zeit - zuletzt;
    if (dauer > 0 && offen.size > 0) {
      const teil = dauer / (arbeit || offen.size);
      for (const j of offen) {
        if (!arbeit || !abschnitte[j].werkzeug) abschnitte[j].ms += teil;
      }
    }
    zuletzt = zeit;
    if (art === 1) offen.add(i); else offen.delete(i);
    if (!abschnitte[i].werkzeug) arbeit += art;
  }
  return abschnitte;
}

// Abrechenbare Zeit je Gruppe (Ticket oder Projekt), in Sekunden.
// opts: dieselben Filter wie ueberall (from, to, month, ticket, project). Ein
// Modellfilter wird bewusst nicht gelesen — eine Zeitspanne gehoert keinem
// einzelnen Request. `ticketlos` beschraenkt auf Arbeit ohne Vorgangsnummer.
function activeSecondsByGroup(db, opts = {}, wie = {}) {
  return zeitJeGruppe(db, opts, wie).sekunden;
}

// Wie activeSecondsByGroup, liefert dazu je Gruppe die Zeitmodelle, nach denen
// ihre Zeit entstanden ist. Ein Durchlauf fuer beides.
function zeitJeGruppe(db, opts = {}, { groupBy = 'ticket', ticketlos = false } = {}) {
  const rahmen = zeitRahmen(opts);
  const out = new Map();
  const modelle = new Map();
  for (const a of verteile(zeitAbschnitte(db, rahmen))) {
    if (rahmen.von && a.day < rahmen.von) continue;
    if (rahmen.bis && a.day > rahmen.bis) continue;
    if (opts.ticket && a.ticket !== opts.ticket) continue;
    if (opts.project && a.project !== opts.project) continue;
    if (ticketlos && a.ticket) continue;
    const grp = (groupBy === 'project' ? a.project : groupBy === 'session' ? a.session : a.ticket) || '(ohne)';
    out.set(grp, (out.get(grp) || 0) + a.ms);
    if (a.ms > 0) {
      if (!modelle.has(grp)) modelle.set(grp, new Set());
      modelle.get(grp).add(a.modell);
    }
  }
  const sekunden = {};
  for (const [k, v] of out) sekunden[k] = Math.round(v / 1000);
  return { sekunden, modelle };
}

// Laufzeit je Gruppe (Ticket oder Projekt): jede Sitzung fuer sich, parallele
// Sitzungen zaehlen einzeln, und jede Logzeile zaehlt — auch die, die der Agent
// allein schreibt. Das ist Maschinenzeit: sie wird ausgewiesen, aber nicht
// abgerechnet. Eine Luecke zaehlt der Gruppe, in der sie beginnt.
//
// Dieselben Optionen wie activeSecondsByGroup. Vorgang und Projekt werden auch
// hier erst nach dem Lesen ausgewaehlt, damit Zeilen ohne Arbeitsverzeichnis
// ihr Projekt erben koennen.
function agentSecondsByGroup(db, opts = {}, { groupBy = 'ticket', ticketlos = false } = {}) {
  const zeit = filterClause({ from: opts.from, to: opts.to, month: opts.month });
  const rows = db.prepare(`
    SELECT session_id, ts, project, ticket FROM activity
    ${zeit.where ? 'WHERE ' + zeit.where : ''}
    ORDER BY session_id, ts
  `).all(...zeit.params);

  const limit = config.gapMinutes * 60 * 1000;
  const out = new Map();
  let prev = null;
  let prevMs = 0;

  for (const r of rows) {
    const ms = Date.parse(r.ts);
    if (!Number.isFinite(ms)) continue;
    erbeProjekt(r, prev);
    const gap = prev && r.session_id === prev.session_id ? ms - prevMs : Infinity;
    const gewaehlt = prev
      && (!opts.ticket || prev.ticket === opts.ticket)
      && (!opts.project || prev.project === opts.project)
      && !(ticketlos && prev.ticket);
    if (gap > 0 && gap <= limit && gewaehlt) {
      const grp = (groupBy === 'project' ? prev.project : groupBy === 'session' ? prev.session_id : prev.ticket) || '(ohne)';
      out.set(grp, (out.get(grp) || 0) + gap);
    }
    prev = r;
    prevMs = ms;
  }

  const result = {};
  for (const [k, v] of out) result[k] = Math.round(v / 1000);
  return result;
}

function monthOf(day) {
  return typeof day === 'string' ? day.slice(0, 7) : '';
}

// Preise kommen in USD, abgerechnet wird in Euro. Fester Kurs aus der
// Konfiguration, damit die Zahlen nachvollziehbar und offline stabil bleiben.
function usdToEur(usd) {
  return (usd || 0) * (config.usdToEur || 1);
}

// Stundensatz je Projekt. Kunden haben unterschiedliche Preise, deshalb kann
// pro Projekt entweder ein eigener Satz oder ein Rabatt auf den Standardsatz
// hinterlegt werden. Ohne Eintrag gilt der Standardsatz.
// Ein negativer oder fehlender Standardsatz wuerde alle Arbeitswerte
// verfaelschen, ohne dass es auffaellt — deshalb hier hart pruefen.
if (typeof config.stundensatz !== 'number' || !Number.isFinite(config.stundensatz) ||
    config.stundensatz < 0) {
  throw new Error(
    'config.json: stundensatz fehlt oder ist ungueltig. Erwartet wird eine Zahl >= 0.'
  );
}

function satzFuerProjekt(projekt) {
  const standard = config.stundensatz;
  const eintrag = (config.projektSaetze || {})[projekt];
  if (!eintrag) {
    return {
      satz: standard, standard, basissatz: standard, rabatt: 0,
      quelle: 'standard', kunde: null,
    };
  }
  // Beides zusammen ist erlaubt: der Rabatt wirkt dann auf den eigenen Satz.
  // So laesst sich ein Kundenpreis hinterlegen und darauf noch nachlassen.
  if (typeof eintrag.satz === 'number' && Number.isFinite(eintrag.satz) && eintrag.satz >= 0) {
    const basis = eintrag.satz;
    let r = 0;
    if (typeof eintrag.rabatt === 'number' && Number.isFinite(eintrag.rabatt)) {
      if (eintrag.rabatt < 0 || eintrag.rabatt > 100) {
        console.warn(
          `Warnung: Rabatt ${eintrag.rabatt} % fuer "${projekt}" liegt ausserhalb 0–100 ` +
          'und wurde begrenzt. Bitte config.json pruefen.'
        );
      }
      r = Math.min(100, Math.max(0, eintrag.rabatt));
    }
    return {
      satz: basis * (1 - r / 100),
      standard,
      basissatz: basis,
      rabatt: r,
      quelle: r > 0 ? 'eigener Satz mit Rabatt' : 'eigener Satz',
      kunde: eintrag.kunde || null,
    };
  }
  if (typeof eintrag.rabatt === 'number' && Number.isFinite(eintrag.rabatt)) {
    // Werte ausserhalb 0–100 sind fast immer Tippfehler (15 statt 150).
    // Sie werden begrenzt, aber nicht stillschweigend hingenommen.
    if (eintrag.rabatt < 0 || eintrag.rabatt > 100) {
      console.warn(
        `Warnung: Rabatt ${eintrag.rabatt} % fuer "${projekt}" liegt ausserhalb 0–100 ` +
        'und wurde begrenzt. Bitte config.json pruefen.'
      );
    }
    const r = Math.min(100, Math.max(0, eintrag.rabatt));
    return {
      satz: standard * (1 - r / 100),
      standard,
      basissatz: standard,
      rabatt: r,
      quelle: 'Rabatt',
      kunde: eintrag.kunde || null,
    };
  }
  return {
    satz: standard, standard, basissatz: standard, rabatt: 0,
    quelle: 'standard', kunde: eintrag.kunde || null,
  };
}

// Ein Ticket gehoert zu genau einem Projekt; dessen Satz gilt.
// Bei Ticketarbeit ueber mehrere Projekte hinweg gewinnt das mit den
// meisten Aufrufen.
//
// Das gewaehlte Projekt wird mit zurueckgegeben, nicht nur der Satz: der
// Kundenfilter im Rechnungen-Tab braucht dieselbe Zuordnung, die auch den Preis
// bestimmt. Zwei Wege dorthin waeren zwei Wahrheiten — eine Zeile bekaeme ihren
// Satz von einem Projekt und ihren Kunden von einem anderen.
function satzFuerTicket(db, ticket) {
  const row = db.prepare(
    'SELECT project, COUNT(*) c FROM events WHERE ticket = ? GROUP BY project ORDER BY c DESC LIMIT 1'
  ).get(ticket);
  const projekt = row ? row.project : null;
  return { ...satzFuerProjekt(projekt), projekt };
}

// Projekte, die zum Werkzeugbetrieb gehoeren und keinem Kunden zurechenbar sind.
// Ein falsch geschriebener Eintrag wuerde die Trennung lautlos ausschalten,
// deshalb wird der Typ geprueft und im Zweifel gewarnt.
if (config.overheadProjekte != null && !Array.isArray(config.overheadProjekte)) {
  console.warn('Warnung: overheadProjekte in config.json ist keine Liste. ' +
    'Die Trennung von Werkzeugbetrieb ist deshalb ausgeschaltet.');
}
const OVERHEAD = new Set(Array.isArray(config.overheadProjekte) ? config.overheadProjekte : []);

// Lokale Modelle: eigene Hardware statt fremder Schnittstelle. Kosten in
// Dollar gibt es dort nicht — abgerechnet wird eine Pauschale je Million
// Tokens, und die Rechenzeit geht als Sachkosten in die Marge ein.
const LOKAL = config.lokaleModelle || {};
const LOKAL_EUR_PRO_MIO = Math.max(0, Number(LOKAL.eurProMioTokens) || 0);
const LOKAL_SELBSTKOSTEN_STD = Math.max(0, Number(LOKAL.selbstkostenEurProStunde) || 0);
// Groesser als das Fenster fuer Werkzeuge: Vorarbeit mit einem lokalen Modell
// geht der eigentlichen Sitzung oft voraus, statt sie zu begleiten.
// Muss zu ingest.js passen: dort tragen lokale Ereignisse diesen Projektnamen.
const LOKAL_PROJEKT = '(lokal)';
const LOKAL_FENSTER_MS = Math.max(1, Number(LOKAL.zuordnungsfensterMinuten) || 30) * 60 * 1000;

// Ohne gueltigen Kurs waeren alle Euro-Betraege in Wahrheit Dollarbetraege.
// Das faellt niemandem auf, deshalb hier abbrechen statt still weiterrechnen.
if (typeof config.usdToEur !== 'number' || !Number.isFinite(config.usdToEur) || config.usdToEur <= 0) {
  throw new Error(
    'config.json: usdToEur fehlt oder ist ungueltig. Ohne Kurs waeren alle ' +
    'Euro-Betraege falsch. Bitte einen Wert wie 0.92 eintragen.'
  );
}

// Von beiden Werten haengt jede abgerechnete Stunde ab. Fehlt die
// Pausenschwelle oder ist sie 0, ergaebe jede Auswertung still 0 Stunden; ein
// vertipptes Zeitmodell schaltete unbemerkt auf das andere Mass um.
if (!Number.isFinite(config.gapMinutes) || config.gapMinutes <= 0) {
  throw new Error(
    'config.json: gapMinutes fehlt oder ist ungueltig. Ohne Pausenschwelle ' +
    'waeren alle Stunden 0. Bitte einen Wert wie 5 eintragen.'
  );
}
if (config.zeitmodell !== undefined && !['eingaben', 'aktivitaet'].includes(config.zeitmodell)) {
  throw new Error(
    'config.json: zeitmodell kennt nur "eingaben" oder "aktivitaet", nicht "' + config.zeitmodell + '".'
  );
}
for (const [projekt, eintrag] of Object.entries(config.projektSaetze || {})) {
  const m = eintrag && eintrag.zeitmodell;
  if (m !== undefined && !ZEITMODELLE.includes(m)) {
    throw new Error(
      'config.json: projektSaetze["' + projekt + '"].zeitmodell kennt nur "eingaben" oder "aktivitaet", nicht "' + m + '".'
    );
  }
}

function isOverhead(project) {
  return OVERHEAD.has(project) || project === LOKAL_PROJEKT;
}

// Werkzeuge wie claude-mem laufen nicht eigenstaendig, sondern begleiten eine
// Arbeitssitzung. Sie haben eigene Sitzungskennungen und immer denselben Pfad,
// tragen also selbst keinen Hinweis auf das Projekt. Zugeordnet wird deshalb
// ueber die Zeit: welches echte Projekt war im selben Zeitfenster aktiv.
// Rueckgabe: Map von request_id auf den Projektnamen, dem die Kosten gehoeren.
const ZUORDNUNGSFENSTER_MS = 5 * 60 * 1000;

// nach: 'project' ordnet dem begleiteten Projekt zu, 'ticket' dem begleiteten
// Ticket. Fuer die Abrechnung zaehlt die Ticket-Sicht: der Verbrauch eines
// Werkzeugs waehrend der Arbeit an PROJ-125 gehoert auf die Rechnung von PROJ-125.
function overheadZuordnung(db, opts = {}, nach = 'project') {
  if (OVERHEAD.size === 0) return new Map();
  const platz = [...OVERHEAD].map(() => '?').join(',');
  const spalte = nach === 'ticket' ? 'ticket' : 'project';

  // Werkzeuge tragen selbst weder Ticket noch Projekt des Auftrags — sie
  // werden ja gerade erst ueber die Zeit zugeordnet. Ein Filter auf Ticket
  // oder Projekt wuerde sie deshalb alle aussortieren, bevor die Zuordnung
  // ueberhaupt greift. Auf die Werkzeugseite wirken nur Zeitfilter.
  const zeitlich = filterClause({ from: opts.from, to: opts.to, month: opts.month });
  const wZeit = zeitlich.where ? zeitlich.where + ' AND ' : '';

  const werkzeug = db.prepare(
    `SELECT request_id, ts FROM events WHERE ${wZeit}project IN (${platz}) ORDER BY ts`
  ).all(...zeitlich.params, ...OVERHEAD);
  if (werkzeug.length === 0) return new Map();

  // Die Arbeitsseite ebenfalls nur zeitlich einschraenken: Wird nach einem
  // Ticket gefiltert, muessen konkurrierende Ereignisse anderer Tickets
  // sichtbar bleiben, sonst gewinnt das gesuchte Ticket auch dort, wo in
  // Wahrheit an etwas anderem gearbeitet wurde.
  const nurMitTicket = spalte === 'ticket' ? ' AND ticket IS NOT NULL' : '';
  const arbeit = db.prepare(
    `SELECT ts, ${spalte} AS ziel FROM events
     WHERE ${wZeit}project NOT IN (${platz})${nurMitTicket} ORDER BY ts`
  ).all(...zeitlich.params, ...OVERHEAD).map((r) => ({ t: Date.parse(r.ts), p: r.ziel }))
    // Sortierung ist Voraussetzung fuer den fortlaufenden Fensterzeiger.
    .sort((a, b) => a.t - b.t);

  return fensterMehrheit(werkzeug, arbeit, ZUORDNUNGSFENSTER_MS);
}

// Ordnet jedem Quell-Ereignis das Ziel zu, das im Zeitfenster ringsum am
// haeufigsten vorkommt. quell: [{ request_id, ts }] nach ts sortiert,
// ziel: [{ t, p }] nach t sortiert. Ein mitwandernder Zeiger statt einer
// verschachtelten Schleife — beide Listen sind sortiert.
// Genutzt von der Werkzeug-Zuordnung und vom Backfill.
function fensterMehrheit(quell, ziel, fensterMs) {
  const ergebnis = new Map();
  let start = 0;
  for (const e of quell) {
    const t = Date.parse(e.ts);
    while (start < ziel.length && ziel[start].t < t - fensterMs) start++;
    const zaehler = new Map();
    for (let k = start; k < ziel.length && ziel[k].t <= t + fensterMs; k++) {
      if (ziel[k].p == null) continue;
      zaehler.set(ziel[k].p, (zaehler.get(ziel[k].p) || 0) + 1);
    }
    if (zaehler.size === 0) continue;
    // Das Ziel mit den meisten Ereignissen im Fenster gewinnt.
    let besterName = null;
    let besteZahl = -1;
    for (const [p, n] of zaehler) {
      if (n > besteZahl) { besterName = p; besteZahl = n; }
    }
    ergebnis.set(e.request_id, besterName);
  }
  return ergebnis;
}

// Werkzeugkosten und -tokens je Ticket. Grundlage der Abrechnung.
function werkzeugeJeTicket(db, opts = {}) {
  const ergebnis = new Map();
  if (OVERHEAD.size === 0) return ergebnis;

  const zuordnung = overheadZuordnung(db, opts, 'ticket');
  if (zuordnung.size === 0) return ergebnis;

  // Nur zeitlich filtern, siehe Begruendung in overheadZuordnung. Die
  // Einschraenkung auf ein Ticket erfolgt weiter unten ueber die Zuordnung.
  const zeitlich = filterClause({ from: opts.from, to: opts.to, month: opts.month });
  const w = zeitlich.where ? zeitlich.where + ' AND ' : '';
  const platz = [...OVERHEAD].map(() => '?').join(',');

  const zeilen = db.prepare(
    `SELECT request_id, input_tokens, output_tokens, cache_w_5m, cache_w_1h,
            cache_read, cost_usd
     FROM events WHERE ${w}project IN (${platz})`
  ).all(...zeitlich.params, ...OVERHEAD);

  for (const r of zeilen) {
    const ticket = zuordnung.get(r.request_id);
    if (!ticket) continue;
    if (!ergebnis.has(ticket)) {
      ergebnis.set(ticket, { requests: 0, total_tokens: 0, cost_usd: 0 });
    }
    const e = ergebnis.get(ticket);
    e.requests += 1;
    e.total_tokens += (r.input_tokens || 0) + (r.output_tokens || 0) +
      (r.cache_w_5m || 0) + (r.cache_w_1h || 0) + (r.cache_read || 0);
    e.cost_usd += r.cost_usd || 0;
  }
  return ergebnis;
}

// Lokale Modelle tragen weder Projekt noch Vorgang: sie laufen in einem
// Browserfenster ohne Arbeitsverzeichnis und ohne Git-Zweig. Zugeordnet wird
// deshalb wie bei den Werkzeugen ueber die Zeit — welcher Vorgang war im
// Fenster ringsum in Bearbeitung.
//
// Eigene Funktion und nicht in overheadZuordnung() mit hineingezogen: dort
// entscheidet der Projektname ueber die Zugehoerigkeit, hier die Herkunft der
// Zeile. Und das Zeitfenster ist ein anderes.
function lokalZuordnung(db, opts = {}, nach = 'ticket') {
  const spalte = nach === 'ticket' ? 'ticket' : 'project';
  const zeitlich = filterClause({ from: opts.from, to: opts.to, month: opts.month });
  const w = zeitlich.where ? zeitlich.where + ' AND ' : '';

  // Nur zeitlich einschraenken: eine Zeile ohne Vorgang wuerde von einem
  // Vorgangsfilter aussortiert, bevor die Zuordnung ueberhaupt greift.
  const lokal = db.prepare(
    `SELECT request_id, ts FROM events WHERE ${w}source = 'lokal' ORDER BY ts`
  ).all(...zeitlich.params);
  if (lokal.length === 0) return new Map();

  const platz = [...OVERHEAD].map(() => '?').join(',');
  const ohneWerkzeug = OVERHEAD.size ? ` AND project NOT IN (${platz})` : '';
  const nurMitTicket = spalte === 'ticket' ? ' AND ticket IS NOT NULL' : '';
  const arbeit = db.prepare(
    `SELECT ts, ${spalte} AS ziel FROM events
     WHERE ${w}source = 'claude'${ohneWerkzeug}${nurMitTicket} ORDER BY ts`
  ).all(...zeitlich.params, ...(OVERHEAD.size ? [...OVERHEAD] : []))
    .map((r) => ({ t: Date.parse(r.ts), p: r.ziel }))
    .sort((a, b) => a.t - b.t);

  return fensterMehrheit(lokal, arbeit, LOKAL_FENSTER_MS);
}

// Was der Kunde fuer die Nutzung lokaler Modelle zahlt: eine Pauschale je
// Million Tokens. Bewusst keine Umrechnung aus Dollar — es gab nie eine
// Rechnung in Dollar, die man umrechnen koennte.
// eurProMio ist nur fuer die Selbstpruefung gedacht: ohne konfigurierte
// Pauschale koennte sie die Formel sonst gar nicht pruefen, weil jedes
// Ergebnis 0 waere. Im Betrieb bleibt der Parameter ungenutzt.
function lokalBetrag(tokens, rabattProzent = 0, eurProMio = LOKAL_EUR_PRO_MIO) {
  const preis = Math.max(0, Number(eurProMio) || 0);
  if (!preis || !tokens) return 0;
  const r = Math.min(100, Math.max(0, Number(rabattProzent) || 0));
  return (tokens / 1e6) * preis * (1 - r / 100);
}

// Tokens, Anfragen und Rechenzeit lokaler Modelle je Vorgang.
// nach: 'ticket' oder 'project' — dieselbe Auswertung fuer beide Sichten.
function lokalJeGruppe(db, opts = {}, nach = 'ticket') {
  const ergebnis = new Map();
  const zuordnung = lokalZuordnung(db, opts, nach);
  if (zuordnung.size === 0) return ergebnis;

  const zeitlich = filterClause({ from: opts.from, to: opts.to, month: opts.month });
  const w = zeitlich.where ? zeitlich.where + ' AND ' : '';
  const zeilen = db.prepare(
    `SELECT request_id, ts, model, input_tokens, output_tokens
     FROM events WHERE ${w}source = 'lokal' ORDER BY ts`
  ).all(...zeitlich.params);

  for (const r of zeilen) {
    const ziel = zuordnung.get(r.request_id);
    if (!ziel) continue;
    if (!ergebnis.has(ziel)) {
      ergebnis.set(ziel, { requests: 0, tokens: 0, modelle: new Set(), erste: r.ts, letzte: r.ts });
    }
    const e = ergebnis.get(ziel);
    e.requests += 1;
    e.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
    if (r.model) e.modelle.add(r.model);
    if (r.ts < e.erste) e.erste = r.ts;
    if (r.ts > e.letzte) e.letzte = r.ts;
  }
  return ergebnis;
}

// Aktive Rechenzeit der lokalen Modelle, nach demselben Pausenmass wie die
// uebrige Aktivzeit. Geht ausschliesslich in die Marge ein (Strom und
// Abschreibung), nie auf eine Rechnung.
function lokalStundenJeGruppe(db, opts = {}, nach = 'ticket') {
  const ergebnis = new Map();
  const zuordnung = lokalZuordnung(db, opts, nach);
  if (zuordnung.size === 0) return ergebnis;

  const zeitlich = filterClause({ from: opts.from, to: opts.to, month: opts.month });
  const w = zeitlich.where ? zeitlich.where + ' AND ' : '';
  const zeilen = db.prepare(
    `SELECT request_id, ts FROM events WHERE ${w}source = 'lokal' ORDER BY ts`
  ).all(...zeitlich.params);

  const proZiel = new Map();
  for (const r of zeilen) {
    const ziel = zuordnung.get(r.request_id);
    if (!ziel) continue;
    if (!proZiel.has(ziel)) proZiel.set(ziel, []);
    proZiel.get(ziel).push(r.ts);
  }
  for (const [ziel, stempel] of proZiel) {
    ergebnis.set(ziel, activeSecondsFromTimestamps(stempel) / 3600);
  }
  return ergebnis;
}

// Kosten und Tokens der Werkzeuge, aufgeschluesselt nach dem Projekt,
// zu dem sie gehoeren, und nach dem Werkzeug selbst.
function werkzeuge(db, opts = {}) {
  if (OVERHEAD.size === 0) {
    return { summe: { requests: 0, total_tokens: 0, cost_usd: 0, cost_eur: 0, ohne_zuordnung: 0,
      fenster_minuten: ZUORDNUNGSFENSTER_MS / 60000 },
      nach_werkzeug: [], nach_projekt: [], nach_modell: [] };
  }
  // Ebenfalls nur zeitlich filtern: ein Projekt-/Ticketfilter wuerde die
  // Werkzeugzeilen aussortieren, die gar kein solches Merkmal tragen.
  const zeitlich = filterClause({ from: opts.from, to: opts.to, month: opts.month });
  const w = zeitlich.where ? zeitlich.where + ' AND ' : '';
  const platz = [...OVERHEAD].map(() => '?').join(',');
  const zuordnung = overheadZuordnung(db, opts);

  const zeilen = db.prepare(
    `SELECT request_id, project, model, input_tokens, output_tokens,
            cache_w_5m, cache_w_1h, cache_read, cost_usd
     FROM events WHERE ${w}project IN (${platz})`
  ).all(...zeitlich.params, ...OVERHEAD);

  const proWerkzeug = new Map();
  const proProjekt = new Map();
  const proModell = new Map();
  let gesamtKosten = 0;
  let gesamtTokens = 0;
  let requests = 0;
  let ohneZuordnung = 0;

  const leer = () => ({ requests: 0, total_tokens: 0, cost_usd: 0 });
  const dazu = (map, key, z) => {
    if (!map.has(key)) map.set(key, leer());
    const e = map.get(key);
    e.requests += 1;
    e.total_tokens += z.tokens;
    e.cost_usd += z.cost;
  };

  for (const r of zeilen) {
    const tokens = (r.input_tokens || 0) + (r.output_tokens || 0) +
      (r.cache_w_5m || 0) + (r.cache_w_1h || 0) + (r.cache_read || 0);
    const z = { tokens, cost: r.cost_usd || 0 };
    gesamtKosten += z.cost;
    gesamtTokens += tokens;
    requests += 1;

    dazu(proWerkzeug, r.project, z);
    dazu(proModell, r.model, z);
    const ziel = zuordnung.get(r.request_id);
    if (ziel) dazu(proProjekt, ziel, z);
    else ohneZuordnung += 1;
  }

  const alsListe = (map, feld) => [...map.entries()]
    .map(([k, v]) => ({ [feld]: k, ...v, cost_eur: usdToEur(v.cost_usd) }))
    .sort((a, b) => b.cost_usd - a.cost_usd);

  return {
    summe: {
      requests,
      total_tokens: gesamtTokens,
      cost_usd: gesamtKosten,
      cost_eur: usdToEur(gesamtKosten),
      ohne_zuordnung: ohneZuordnung,
      fenster_minuten: ZUORDNUNGSFENSTER_MS / 60000,
    },
    nach_werkzeug: alsListe(proWerkzeug, 'werkzeug'),
    nach_projekt: alsListe(proProjekt, 'projekt'),
    nach_modell: alsListe(proModell, 'model'),
  };
}

// Herkunft der Requests innerhalb der eigenen Sitzungen.
//
// Etwas anderes als werkzeuge(): dort geht es um Hintergrunddienste mit eigenem
// Arbeitsverzeichnis, deren Kosten zeitlich einem Vorgang zugeschlagen werden.
// Hier geht es um Requests der laufenden Sitzung selbst — sie sind bereits Teil
// der Projektzahlen und werden nur anders gruppiert. Nichts davon aendert eine
// Abrechnung; es beantwortet allein "was nutze ich wie intensiv".
//
// Der Unterschied zwischen den beiden Rueckgabelisten ist wesentlich:
//
// - nach_mcp: der Aufruf IST der Ausloeser des Requests. Die Kosten gehoeren
//   ihm ursaechlich. Belastbar.
// - nach_skill: der Skill hat den Request NICHT ausgeloest. Er schiebt Text in
//   einen laufenden Request, statt einen eigenen zu starten. Die Zahl sagt
//   "so viel lief, waehrend dieser Skill aktiv war" — nicht "so viel hat der
//   Skill gekostet". Wer sie als Kostenzuordnung liest, liegt falsch, deshalb
//   traegt sie in der Oberflaeche eine eigene Ueberschrift.
//
// Nicht erfassbar sind Werkzeuge, die gar keinen Request erzeugen: Anweisungen
// im Kontext (Ponytail, Caveman, CLAUDE.md) und Filter vor dem Modell (rtk).
// Fuer sie waere eine Null keine Messung, sondern eine falsche Auskunft — sie
// tauchen deshalb bewusst nirgends auf.
function herkunft(db, opts = {}) {
  const { where, params } = filterClause(opts);
  // Die eigene Bedingung wird angehaengt, statt sie mit dem Zeitfilter zu
  // verweben: so steht an einer Stelle, was gefiltert wird.
  const bedingung = (eigene) => 'WHERE ' + (where ? where + ' AND ' : '') + eigene;

  const summen = `
    COUNT(*) AS requests,
    SUM(input_tokens + output_tokens + cache_w_5m + cache_w_1h + cache_read) AS total_tokens,
    SUM(cost_usd) AS cost_usd
  `;
  const aufbereiten = (zeilen, feld) => zeilen.map((r) => ({
    [feld]: r[feld],
    requests: r.requests,
    total_tokens: r.total_tokens || 0,
    cost_usd: r.cost_usd || 0,
    cost_eur: usdToEur(r.cost_usd || 0),
  }));

  // Je Server, mit den einzelnen Werkzeugen darunter. Beide Angaben stehen auf
  // derselben Zeile wie die Nutzungszahlen — keine Zuordnung ueber Umwege.
  const mcpZeilen = db.prepare(`
    SELECT mcp_server, mcp_tool, ${summen}
    FROM events ${bedingung('mcp_server IS NOT NULL')}
    GROUP BY mcp_server, mcp_tool
  `).all(...params);

  const proServer = new Map();
  for (const r of mcpZeilen) {
    if (!proServer.has(r.mcp_server)) {
      proServer.set(r.mcp_server, {
        server: r.mcp_server, requests: 0, total_tokens: 0, cost_usd: 0, werkzeuge: [],
      });
    }
    const s = proServer.get(r.mcp_server);
    s.requests += r.requests;
    s.total_tokens += r.total_tokens || 0;
    s.cost_usd += r.cost_usd || 0;
    s.werkzeuge.push({
      werkzeug: r.mcp_tool || '(ohne Namen)',
      requests: r.requests,
      total_tokens: r.total_tokens || 0,
      cost_usd: r.cost_usd || 0,
      cost_eur: usdToEur(r.cost_usd || 0),
    });
  }
  const nachMcp = [...proServer.values()]
    .map((s) => ({
      ...s,
      cost_eur: usdToEur(s.cost_usd),
      werkzeuge: s.werkzeuge.sort((a, b) => b.total_tokens - a.total_tokens),
    }))
    .sort((a, b) => b.total_tokens - a.total_tokens);

  const nachSkill = aufbereiten(db.prepare(`
    SELECT skill, ${summen}
    FROM events ${bedingung('skill IS NOT NULL')}
    GROUP BY skill
  `).all(...params), 'skill').sort((a, b) => b.total_tokens - a.total_tokens);

  // Bezugsgroesse: ohne sie sagt "19,5 Mio" nichts. Erst der Anteil am Ganzen
  // beantwortet die Frage, wie intensiv etwas genutzt wird.
  const gesamt = db.prepare(`
    SELECT ${summen} FROM events ${bedingung("source = 'claude'")}
  `).get(...params) || {};

  const summe = (liste) => liste.reduce((s, x) => s + x.total_tokens, 0);
  return {
    gesamt: {
      requests: gesamt.requests || 0,
      total_tokens: gesamt.total_tokens || 0,
      cost_usd: gesamt.cost_usd || 0,
      cost_eur: usdToEur(gesamt.cost_usd || 0),
    },
    mcp_tokens: summe(nachMcp),
    skill_tokens: summe(nachSkill),
    nach_mcp: nachMcp,
    nach_skill: nachSkill,
  };
}

// Anteil am Monatsabo: Ein Ticket traegt so viel vom Abopreis, wie es am
// Listenwert des Monats ausmacht. Die Bezugsgroesse ist bewusst der GESAMTE
// Monatsverbrauch einschliesslich der Werkzeuge — sonst waeren die Anteile
// aller Tickets zusammen groesser als das Abo selbst.
function aboAnteil(db, costUsd, month) {
  if (!costUsd || !month) return 0;
  const row = db.prepare(
    'SELECT COALESCE(SUM(cost_usd),0) AS total FROM events WHERE substr(day,1,7) = ?'
  ).get(month);
  const total = row ? row.total : 0;
  if (!total) return 0;
  return (costUsd / total) * config.aboPreisMonat;
}

// Was das Abo im gewaehlten Ausschnitt tatsaechlich gekostet hat — die echte
// Gegenzahl zum API-Gegenwert, der nur ein Listenpreis ist. Je Monat der
// Anteil des Ausschnitts am Monatsverbrauch, mal Abopreis: volle Monate ergeben
// genau den Abopreis, angeschnittene anteilig. Dieselbe Formel wie je Vorgang,
// deshalb ueber aboAnteil statt eigener Rechnung. Waehrung: aboWaehrung.
function aboKosten(db, opts = {}) {
  return byMonth(db, opts).reduce((s, r) => s + aboAnteil(db, r.cost_usd, r.day), 0);
}

// Der Anteil steht in der Waehrung des Abos, nicht zwangslaeufig in Dollar:
// Anthropic stellt aus Irland in Euro. Wird ein Euro-Betrag trotzdem durch den
// Dollarkurs gedreht, sind die Abokosten in der Marge um den Kursfaktor zu
// niedrig. Nur der API-Gegenwert ist immer in Dollar — der stammt aus den
// Preislisten, nicht von der Rechnung.
function aboAnteilEur(betrag) {
  return String(config.aboWaehrung).toUpperCase() === 'EUR'
    ? (betrag || 0)
    : usdToEur(betrag);
}

function filterClause({ from, to, ticket, project, month, model }) {
  const cond = [];
  const params = [];
  if (from) { cond.push('day >= ?'); params.push(from); }
  if (to) { cond.push('day <= ?'); params.push(to); }
  if (month) { cond.push("substr(day,1,7) = ?"); params.push(month); }
  if (ticket) { cond.push('ticket = ?'); params.push(ticket); }
  if (project) { cond.push('project = ?'); params.push(project); }
  if (model) { cond.push('model = ?'); params.push(model); }
  return { where: cond.join(' AND '), params };
}

function summary(db, opts = {}) {
  const { where, params } = filterClause(opts);
  const row = db.prepare(`SELECT ${SUM_COLS} FROM events ${where ? 'WHERE ' + where : ''}`).get(...params);
  const totals = withTotals(row);
  // Die Zeit folgt dem Modellfilter nicht, siehe byProject.
  const summe = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
  totals.active_seconds = summe(activeSecondsByGroup(db, opts, { groupBy: 'ticket' }));
  totals.agent_seconds = summe(agentSecondsByGroup(db, opts, { groupBy: 'ticket' }));
  const range = db.prepare(
    `SELECT MIN(day) AS first_day, MAX(day) AS last_day FROM events ${where ? 'WHERE ' + where : ''}`
  ).get(...params);
  totals.first_day = range ? range.first_day : null;
  totals.last_day = range ? range.last_day : null;
  return totals;
}

function byModel(db, opts = {}) {
  const { where, params } = filterClause(opts);
  // MAX statt eigener Gruppe: traegt auch nur ein Request des Modells eine
  // Kennzeichnung, ist die Summe des Modells nicht mehr exakt. 'ohne' sortiert
  // hinter 'geschaetzt' und gewinnt damit — die Luecke ist der schwerere Fall.
  return db.prepare(`
    SELECT model, MAX(preis_art) AS preis_art, ${SUM_COLS}
    FROM events ${where ? 'WHERE ' + where : ''}
    GROUP BY model ORDER BY cost_usd DESC
  `).all(...params).map((r) => ({ model: r.model, preis_art: r.preis_art, ...withTotals(r) }));
}

// Modelle, deren Kosten nicht belastbar sind: geschaetzt ueber ein aehnlich
// benanntes Modell, oder ganz ohne Preis und damit mit 0 in jeder Summe.
// Leer, solange die Preisliste alle genutzten Modelle kennt.
function preisLuecken(db, opts = {}) {
  const { where, params } = filterClause(opts);
  return db.prepare(`
    SELECT model, preis_art, ${SUM_COLS}
    FROM events WHERE ${where ? where + ' AND ' : ''}preis_art IS NOT NULL
    GROUP BY model, preis_art ORDER BY requests DESC
  `).all(...params).map((r) => ({ model: r.model, preis_art: r.preis_art, ...withTotals(r) }));
}

// Zeitreihe in drei Koernungen. `day` ist ein ISO-Datum, deshalb genuegt der
// Zuschnitt der Zeichenkette: 10 Zeichen Tag, 7 Monat, 4 Jahr. Kein zweiter
// Weg, die Werte zu summieren — Monat und Jahr rechnen dieselbe Abfrage.
const PERIODEN = { tag: 10, monat: 7, jahr: 4 };

function byPeriod(db, opts = {}, koernung = 'tag') {
  const laenge = PERIODEN[koernung] || PERIODEN.tag;
  const { where, params } = filterClause(opts);
  return db.prepare(`
    SELECT substr(day,1,${laenge}) AS day, ${SUM_COLS} FROM events ${where ? 'WHERE ' + where : ''}
    GROUP BY 1 ORDER BY 1
  `).all(...params).map((r) => ({ day: r.day, ...withTotals(r) }));
}

function byDay(db, opts = {}) {
  return byPeriod(db, opts, 'tag');
}

function byMonth(db, opts = {}) {
  return byPeriod(db, opts, 'monat');
}

function byYear(db, opts = {}) {
  return byPeriod(db, opts, 'jahr');
}

function byProject(db, opts = {}) {
  const { where, params } = filterClause(opts);
  const rows = db.prepare(`
    SELECT project, ${SUM_COLS} FROM events ${where ? 'WHERE ' + where : ''}
    GROUP BY project ORDER BY cost_usd DESC
  `).all(...params);
  // Die Aktivzeit kennt kein Modell: sie ist eine Zeitspanne zwischen zwei
  // Ereignissen, keine Eigenschaft eines Requests. Ein Modellfilter darf sie
  // deshalb nicht einschraenken — sonst stuende bei einer Modellansicht ein
  // anteiliger Arbeitswert, der nie so abgerechnet wird. Der Zeitfilter gilt
  // weiterhin, nur die Modellbedingung faellt fuer diese Abfrage heraus.
  const act = activeSecondsByGroup(db, opts, { groupBy: 'project' });
  const agent = agentSecondsByGroup(db, opts, { groupBy: 'project' });
  return rows.map((r) => {
    const t = withTotals(r);
    const seconds = act[r.project] || 0;
    const satzInfo = satzFuerProjekt(r.project);
    return {
      project: r.project,
      ...t,
      active_seconds: seconds,
      // Laufzeit der KI je Sitzung. Wird ausgewiesen, nicht abgerechnet.
      agent_seconds: agent[r.project] || 0,
      arbeitswert: (seconds / 3600) * satzInfo.satz,
      stundensatz: satzInfo.satz,
      stundensatz_standard: satzInfo.standard,
      rabatt_prozent: satzInfo.rabatt,
      satz_quelle: satzInfo.quelle,
      kunde: satzInfo.kunde,
      cost_eur: usdToEur(t.cost_usd),
      overhead: isOverhead(r.project),
    };
  });
}

// Kennzahlen je Ticket, einschliesslich der abgestimmten Mehrwert-Rechnung.
function byTicket(db, opts = {}) {
  const { where, params } = filterClause(opts);
  const cond = where ? where + ' AND ticket IS NOT NULL' : 'ticket IS NOT NULL';
  const rows = db.prepare(`
    SELECT ticket, ${SUM_COLS},
           MIN(day) AS first_day, MAX(day) AS last_day,
           COUNT(DISTINCT session_id) AS sessions
    FROM events WHERE ${cond}
    GROUP BY ticket ORDER BY cost_usd DESC
  `).all(...params);

  // Ohne Modellbedingung, siehe byProject.
  const zeit = zeitJeGruppe(db, opts, { groupBy: 'ticket' });
  const act = zeit.sekunden;
  const karte = zeitmodellKarte(db);
  const agent = agentSecondsByGroup(db, opts, { groupBy: 'ticket' });
  // Werkzeuge, die waehrend der Arbeit am Ticket mitgelaufen sind.
  const werkzeugTicket = werkzeugeJeTicket(db, opts);
  // Lokale Modelle, die im selben Zeitraum fuer diesen Vorgang liefen.
  const lokalTicket = lokalJeGruppe(db, opts, 'ticket');
  const lokalStunden = lokalStundenJeGruppe(db, opts, 'ticket');

  return rows.map((r) => {
    const t = withTotals(r);
    const seconds = act[r.ticket] || 0;
    const stunden = seconds / 3600;
    const satzInfo = satzFuerTicket(db, r.ticket);
    const arbeitswert = stunden * satzInfo.satz;
    // Was der Vorgang ohne eigene Wahl haette: das Modell seines Projekts
    // oder der Standard. Die Oberflaeche zeigt es neben der eigenen Wahl.
    const erbt = karte.projekt(satzInfo.projekt) || karte.standard;
    const wahl = karte.vorgang.get(r.ticket) || null;
    const wz = werkzeugTicket.get(r.ticket) || { requests: 0, total_tokens: 0, cost_usd: 0 };
    const lok = lokalTicket.get(r.ticket) || { requests: 0, tokens: 0, modelle: new Set() };
    const lokStd = lokalStunden.get(r.ticket) || 0;

    // Abgerechnet wird die Summe: eigentliche Arbeit plus die Werkzeuge,
    // die waehrend dieser Arbeit mitliefen.
    const gesamtKosten = t.cost_usd + wz.cost_usd;
    const gesamtTokens = t.total_tokens + wz.total_tokens;
    const abo = aboAnteil(db, gesamtKosten, monthOf(r.last_day));

    return {
      ticket: r.ticket,
      ...t,
      sessions: r.sessions,
      first_day: r.first_day,
      last_day: r.last_day,
      active_seconds: seconds,
      active_hours: stunden,
      // Laufzeit der KI je Sitzung. Wird ausgewiesen, nicht abgerechnet.
      agent_seconds: agent[r.ticket] || 0,
      agent_hours: (agent[r.ticket] || 0) / 3600,
      // Nach welchem Modell die Zeit entstanden ist; "gemischt", wenn einzelne
      // Sitzungen eine eigene Wahl tragen.
      zeitmodell: zeitmodellAus(zeit.modelle.get(r.ticket), wahl || erbt),
      zeitmodell_wahl: wahl,
      zeitmodell_erbt: erbt,
      arbeitswert,                            // Zeit x Stundensatz, in Euro
      stundensatz: satzInfo.satz,
      stundensatz_standard: satzInfo.standard,
      rabatt_prozent: satzInfo.rabatt,
      satz_quelle: satzInfo.quelle,
      kunde: satzInfo.kunde,
      // Das mehrheitlich beteiligte Projekt — dieselbe Wahl, aus der auch der
      // Stundensatz stammt. Der Rechnungen-Tab haengt daran den Kunden.
      project: satzInfo.projekt,

      // Anteil der begleitenden Werkzeuge, getrennt ausweisbar
      werkzeug_requests: wz.requests,
      werkzeug_tokens: wz.total_tokens,
      werkzeug_cost_usd: wz.cost_usd,
      werkzeug_cost_eur: usdToEur(wz.cost_usd),

      // Lokale Modelle: eigene Hardware, keine Dollarkosten. Deshalb getrennt
      // gefuehrt und mit einer eigenen Pauschale bewertet, statt in die
      // Token- und Kostensummen der Schnittstelle einzufliessen.
      lokal_requests: lok.requests,
      lokal_tokens: lok.tokens,
      lokal_modelle: [...lok.modelle].sort(),
      lokal_stunden: lokStd,
      lokal_eur_pro_mio: LOKAL_EUR_PRO_MIO,
      lokal_betrag_eur: lokalBetrag(lok.tokens, satzInfo.rabatt),

      // Summen fuer die Abrechnung: Arbeit + Werkzeuge
      gesamt_tokens: gesamtTokens,
      api_gegenwert_usd: gesamtKosten,
      api_gegenwert_eur: usdToEur(gesamtKosten),
      abo_anteil_usd: abo,
      abo_anteil_eur: aboAnteilEur(abo),
      gegenwert_eur: arbeitswert + usdToEur(gesamtKosten),
    };
  });
}

// Arbeit ohne Vorgangsnummer, gruppiert nach Projekt. Nicht jede Leistung
// laeuft ueber ein Ticketsystem — ohne diese Sicht waere sie unabrechenbar.
//
// Bewusst eine eigene Funktion und keine Erweiterung von byTicket(): dessen
// Ergebnis geht ungeprueft in Rechnungen, Angebote und Jira-Kommentare. Ein
// Projektname im Feld "ticket" stuende woertlich auf einem Dokument nach
// § 14 UStG, und jira-sync wuerde ueber den Fremdschluessel stolpern.
// Der Schluessel heisst deshalb "gruppe", nicht "ticket".
function ohneTicket(db, opts = {}) {
  const { where, params } = filterClause(opts);
  const cond = where ? where + ' AND ticket IS NULL' : 'ticket IS NULL';
  const rows = db.prepare(`
    SELECT project, ${SUM_COLS},
           MIN(day) AS first_day, MAX(day) AS last_day,
           COUNT(DISTINCT session_id) AS sessions
    FROM events WHERE ${cond}
    GROUP BY project ORDER BY cost_usd DESC
  `).all(...params);

  // Ohne Modellbedingung, siehe byProject.
  const zeit = zeitJeGruppe(db, opts, { groupBy: 'project', ticketlos: true });
  const act = zeit.sekunden;
  const karte = zeitmodellKarte(db);
  const agent = agentSecondsByGroup(db, opts, { groupBy: 'project', ticketlos: true });
  const lokalProjekt = lokalJeGruppe(db, opts, 'project');
  const lokalStunden = lokalStundenJeGruppe(db, opts, 'project');

  return rows
    // Werkzeugprojekte tragen nie ein Ticket und rutschten hier sonst als
    // eigene Zeile herein — obwohl ihre Kosten ueber werkzeugeJeTicket()
    // bereits anteilig auf den echten Vorgaengen liegen. Das waere doppelt.
    .filter((r) => !isOverhead(r.project))
    .map((r) => {
      const t = withTotals(r);
      const seconds = act[r.project] || 0;
      const stunden = seconds / 3600;
      // Direkt ueber das Projekt, nicht ueber satzFuerTicket(): dort wird der
      // Ticketschluessel nachgeschlagen, den es hier per Definition nicht gibt.
      const satzInfo = satzFuerProjekt(r.project);
      const arbeitswert = stunden * satzInfo.satz;
      const abo = aboAnteil(db, t.cost_usd, monthOf(r.last_day));
      const lok = lokalProjekt.get(r.project) || { requests: 0, tokens: 0, modelle: new Set() };
      const lokStd = lokalStunden.get(r.project) || 0;

      return {
        gruppe: r.project,
        art: 'projekt',
        project: r.project,
        ...t,
        sessions: r.sessions,
        first_day: r.first_day,
        last_day: r.last_day,
        active_seconds: seconds,
        active_hours: stunden,
        agent_seconds: agent[r.project] || 0,
        agent_hours: (agent[r.project] || 0) / 3600,
        zeitmodell: zeitmodellAus(zeit.modelle.get(r.project), karte.projekt(r.project) || karte.standard),
        arbeitswert,
        stundensatz: satzInfo.satz,
        stundensatz_standard: satzInfo.standard,
        rabatt_prozent: satzInfo.rabatt,
        satz_quelle: satzInfo.quelle,
        kunde: satzInfo.kunde,

        // Lokale Modelle, ueber die Zeitnaehe diesem Projekt zugeordnet.
        lokal_requests: lok.requests,
        lokal_tokens: lok.tokens,
        lokal_modelle: [...lok.modelle].sort(),
        lokal_stunden: lokStd,
        lokal_eur_pro_mio: LOKAL_EUR_PRO_MIO,
        lokal_betrag_eur: lokalBetrag(lok.tokens, satzInfo.rabatt),

        // Kein Werkzeuganteil: der wird ueber die Zeitnaehe echten Vorgaengen
        // zugeschlagen, nicht der ticketlosen Restarbeit.
        gesamt_tokens: t.total_tokens,
        api_gegenwert_usd: t.cost_usd,
        api_gegenwert_eur: usdToEur(t.cost_usd),
        abo_anteil_usd: abo,
        abo_anteil_eur: aboAnteilEur(abo),
        gegenwert_eur: arbeitswert + usdToEur(t.cost_usd),
      };
    });
}

// Mehrwert = Arbeitswert + API-Gegenwert - Rechnungsbetrag, alles in Euro.
// Der Rechnungsbetrag kommt von aussen: 0, solange keine Rechnung gestellt ist.
function mehrwert(ticketRow, rechnungsbetrag = 0) {
  const arbeitswert = ticketRow.arbeitswert || 0;              // bereits EUR
  const apiEur = usdToEur(ticketRow.api_gegenwert_usd || 0);   // USD -> EUR
  const kostenEur = aboAnteilEur(ticketRow.abo_anteil_usd || 0);
  const gegenwert = arbeitswert + apiEur;

  // Der Erlös steht schon vor dem Rechnungstellen fest: es ist der Arbeitswert,
  // also Aktivstunden mal Stundensatz. Die Rechnung bestaetigt ihn nur. Erst
  // wenn tatsaechlich abgerechnet wurde und der Betrag abweicht (Rabatt,
  // Teilabrechnung), tritt der gestellte Betrag an seine Stelle.
  // Die Pauschale fuer lokale Modelle gehoert zum Erloes: sie steht als
  // eigene Position auf derselben Rechnung. Bleibt sie hier aussen vor,
  // ist die Marge zu niedrig ausgewiesen — und in der Gegenrichtung fehlte
  // die Rechenzeit bei den Kosten.
  const lokalErloes = ticketRow.lokal_betrag_eur || 0;
  const erloes = rechnungsbetrag > 0 ? rechnungsbetrag : arbeitswert + lokalErloes;
  const hatErloes = erloes > 0;

  // Sachkosten der lokalen Modelle: Strom und anteilige Abschreibung der
  // Grafikkarte, bewertet ueber die aktive Rechenzeit. Klein, aber sie
  // gehoeren auf die Kostenseite — sonst behauptet die Marge, lokale
  // Rechenleistung sei umsonst.
  const lokalKosten = (Number(ticketRow.lokal_stunden) || 0) * LOKAL_SELBSTKOSTEN_STD;

  // Deckungsbeitrag: was nach den direkt zurechenbaren Sachkosten uebrig
  // bleibt. Die eigene Arbeitszeit ist hier NICHT eingerechnet.
  const deckungsbeitrag = erloes - kostenEur - lokalKosten;

  // Marge: zusaetzlich abzueglich der eigenen Arbeitszeit. Ohne diesen Abzug
  // waere die Zahl geschoent — im Stundensatz steckt der eigene Aufwand ja
  // schon drin, er ist keine kostenlose Zutat. Fehlt der Selbstkostensatz,
  // bleibt die Marge leer statt den Deckungsbeitrag als Marge auszugeben.
  const selbstkostenStunde = Number(config.selbstkostenStunde) || 0;
  const stunden = ticketRow.active_hours || 0;
  const zeitkosten = selbstkostenStunde * stunden;
  const hatSelbstkosten = selbstkostenStunde > 0;
  const gewinn = deckungsbeitrag - zeitkosten;

  // Sollwert nur zum Vergleichen — beeinflusst keine Rechnung.
  const zielProzent = Number(config.zielmargeProzent) || 0;

  // Vergleichsaufwand: was dieselbe Arbeit ohne KI-Unterstuetzung an Zeit
  // bedeutet haette. Rein darstellend, geht in keine Berechnung ein.
  //
  // BEWUSST NUR STUNDEN, KEIN EUROBETRAG. Ein hypothetischer Preis neben einem
  // echten liest sich als Streichpreis, und die Rechtsprechung dazu verlangt
  // einen real verlangten Vergleichspreis — den gibt es hier nie. Was nicht
  // berechnet wird, kann auch nicht versehentlich gerendert werden.
  //
  // Der Faktor ist eine Schaetzung, keine Messung: unabhaengige Studien
  // reichen von langsamer bis deutlich schneller, und sie messen ueberwiegend
  // das Schreiben von Code, nicht das ganze Projekt. Fehlt der Wert, bleibt
  // die Kennzahl leer — wie bei der Marge ohne Selbstkostensatz.
  const faktor = Number(config.vergleichsFaktor) || 0;
  const hatFaktor = faktor > 1 && stunden > 0;

  return {
    waehrung: config.waehrung,
    kurs: config.usdToEur,
    arbeitswert,
    api_gegenwert: apiEur,
    gegenwert,
    rechnungsbetrag,
    mehrwert: gegenwert - rechnungsbetrag,
    eigene_kosten: kostenEur,
    // Getrennt ausgewiesen, damit im Label steht, was tatsaechlich abgezogen
    // wurde: "Marge — nach Sachkosten (Schnittstelle + lokale Rechenzeit)".
    lokal_erloes: lokalErloes,
    lokal_kosten: lokalKosten,
    lokal_stunden: Number(ticketRow.lokal_stunden) || 0,
    // Der Erlös, auf den sich die Marge bezieht: geplant (Arbeitswert) oder
    // tatsaechlich (gestellte Rechnung).
    erloes,
    erloes_ist_rechnung: rechnungsbetrag > 0,
    // Vorstufe der Marge: ohne den eigenen Zeitaufwand.
    deckungsbeitrag: hatErloes ? deckungsbeitrag : null,
    deckungsbeitrag_prozent: hatErloes ? (deckungsbeitrag / erloes) * 100 : null,
    // Der eigene Zeitaufwand, bewertet mit dem Selbstkostensatz.
    selbstkosten_stunde: selbstkostenStunde,
    zeitkosten: hatSelbstkosten ? zeitkosten : null,
    // Absoluter Gewinn in Euro, nach Sachkosten UND eigener Arbeitszeit.
    marge: hatErloes && hatSelbstkosten ? gewinn : null,
    // Handelsspanne: Anteil des Gewinns am Erlös.
    marge_prozent: hatErloes && hatSelbstkosten ? (gewinn / erloes) * 100 : null,
    // Aufschlag auf die Vollkosten — die Sicht "ich schlage X % drauf".
    aufschlag_prozent: hatErloes && hatSelbstkosten && (kostenEur + zeitkosten) > 0
      ? (gewinn / (kostenEur + zeitkosten)) * 100
      : null,
    // Soll/Ist gegen die angestrebte Marge, falls hinterlegt.
    zielmarge_prozent: zielProzent > 0 ? zielProzent : null,
    zielmarge_abweichung: zielProzent > 0 && hatErloes && hatSelbstkosten
      ? ((gewinn / erloes) * 100) - zielProzent
      : null,
    // Vergleichsaufwand ohne KI — nur Zeit, siehe Begruendung oben.
    vergleich_faktor: hatFaktor ? faktor : null,
    vergleich_stunden: hatFaktor ? stunden * faktor : null,
    vergleich_mehrstunden: hatFaktor ? stunden * (faktor - 1) : null,
  };
}

// Momentaufnahme fuer den Live-Monitor.
// Werkzeug-Sitzungen erscheinen hier bewusst NICHT als eigene Zeilen: sie
// begleiten eine Arbeitssitzung und wuerden die Liste sonst verdoppeln.
// Ihre Kosten werden dem begleiteten Projekt zugeschlagen.
function live(db, { minutes = 60 } = {}) {
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const platz = [...OVERHEAD].map(() => '?').join(',');
  const nichtWerkzeug = OVERHEAD.size ? ` AND project NOT IN (${platz})` : '';
  const werkzeugParams = OVERHEAD.size ? [...OVERHEAD] : [];

  // ticket_quelle macht in der Ansicht den Unterschied zwischen "automatisch
  // erkannt" und "von Hand gebucht" sichtbar. Ohne sie sieht eine erkannte
  // Zuordnung aus wie eine offene Aufgabe.
  //
  // is_sidechain im GROUP BY: ein Subagent traegt die session_id seiner
  // Hauptsitzung und oft dasselbe Modell. Ohne die Spalte ginge er in deren
  // Zeile auf, und niemand saehe, was die Subagents gekostet haben.
  const recent = db.prepare(`
    SELECT session_id, project, branch, ticket, MIN(ticket_quelle) AS ticket_quelle, model,
           is_sidechain, MAX(ts) AS last_ts, ${SUM_COLS}
    FROM events WHERE ts >= ?${nichtWerkzeug}
    GROUP BY session_id, model, is_sidechain ORDER BY last_ts DESC LIMIT 20
  `).all(since, ...werkzeugParams);
  // Die Wahl gilt je Sitzung, auch ohne Vorgang. `zeitmodell_wahl` ist die
  // eigene Wahl der Sitzung (oder null), `zeitmodell` das, was gerade gilt.
  const karte = zeitmodellKarte(db);

  // Zeit je Sitzung ueber ihre ganze Dauer, nicht nur das Fenster: ab dem
  // ersten Tag, an dem eine der angezeigten Sitzungen begann. Verteilt wird
  // wie ueberall, parallele Sitzungen teilen sich also die Minute.
  const ids = [...new Set(recent.map((r) => r.session_id))];
  let zeitJe = {};
  let agentJe = {};
  if (ids.length) {
    const beginn = db.prepare(
      `SELECT MIN(day) AS d FROM activity WHERE session_id IN (${ids.map(() => '?').join(',')})`
    ).get(...ids).d;
    zeitJe = activeSecondsByGroup(db, { from: beginn }, { groupBy: 'session' });
    agentJe = agentSecondsByGroup(db, { from: beginn }, { groupBy: 'session' });
  }

  const sitzungen = recent.map((r) => ({
    session_id: r.session_id, project: r.project, branch: r.branch,
    ticket: r.ticket, ticket_quelle: r.ticket_quelle, model: r.model,
    is_sidechain: r.is_sidechain === 1, last_ts: r.last_ts, ...withTotals(r),
    // Je Sitzung, nicht je Modellzeile: alle Zeilen einer Sitzung tragen
    // denselben Wert, angezeigt wird er nur in der ersten.
    active_seconds: zeitJe[r.session_id] || 0,
    agent_seconds: agentJe[r.session_id] || 0,
    zeitmodell_wahl: karte.sitzung.get(r.session_id) || null,
    zeitmodell: karte.fuer(r),
    // Was ohne eigene Wahl der Sitzung gaelte: Vorgang, Projekt, Standard.
    zeitmodell_erbt: (r.ticket && karte.vorgang.get(r.ticket)) || karte.projekt(r.project) || karte.standard,
  }));

  // Werkzeugkosten des Zeitfensters, nach Projekt aufgeschluesselt.
  // Bewusst NICHT an die einzelne Sitzungszeile gehaengt: mehrere Zeilen
  // desselben Projekts wuerden denselben Betrag mehrfach ausweisen.
  const wz = werkzeuge(db, { from: since.slice(0, 10) });
  const werkzeugJeProjekt = wz.nach_projekt.filter((x) =>
    recent.some((s) => s.project === x.projekt)
  );

  const todayRow = db.prepare(`SELECT ${SUM_COLS} FROM events WHERE day = ?`).get(today);
  const windowRow = db.prepare(`SELECT ${SUM_COLS} FROM events WHERE ts >= ?`).get(since);
  const w = withTotals(windowRow);

  return {
    now: new Date().toISOString(),
    today: withTotals(todayRow),
    window_minutes: minutes,
    window: w,
    burn_usd_per_hour: minutes > 0 ? (w.cost_usd / minutes) * 60 : 0,
    sessions: sitzungen,
    werkzeuge: werkzeugJeProjekt,
  };
}

// Trennt Projektarbeit von Werkzeugbetrieb. Ohne diese Trennung sieht die
// Gesamtsumme nach Kundenarbeit aus, obwohl ein grosser Teil auf automatische
// Hintergrundsitzungen entfaellt.
function splitOverhead(db, opts = {}) {
  const projects = byProject(db, opts);
  const leer = { requests: 0, total_tokens: 0, cost_usd: 0, active_seconds: 0, agent_seconds: 0, arbeitswert: 0 };
  const add = (acc, p) => ({
    requests: acc.requests + p.requests,
    total_tokens: acc.total_tokens + p.total_tokens,
    cost_usd: acc.cost_usd + p.cost_usd,
    active_seconds: acc.active_seconds + p.active_seconds,
    agent_seconds: acc.agent_seconds + p.agent_seconds,
    arbeitswert: acc.arbeitswert + p.arbeitswert,
  });
  const arbeit = projects.filter((p) => !p.overhead).reduce(add, { ...leer });
  const overhead = projects.filter((p) => p.overhead).reduce(add, { ...leer });
  arbeit.cost_eur = usdToEur(arbeit.cost_usd);
  overhead.cost_eur = usdToEur(overhead.cost_usd);
  return {
    arbeit,
    overhead,
    overhead_projekte: projects.filter((p) => p.overhead).map((p) => p.project),
    overhead_anteil_kosten: arbeit.cost_usd + overhead.cost_usd > 0
      ? overhead.cost_usd / (arbeit.cost_usd + overhead.cost_usd)
      : 0,
  };
}

module.exports = {
  splitOverhead,
  werkzeuge,
  werkzeugeJeTicket,
  herkunft,
  satzFuerProjekt,
  satzFuerTicket,
  overheadZuordnung,
  fensterMehrheit,
  ZUORDNUNGSFENSTER_MS,
  OVERHEAD,
  usdToEur,
  isOverhead,
  activeSecondsFromTimestamps,
  activeSecondsByGroup,
  agentSecondsByGroup,
  zeitmodellKarte,
  ZEITMODELLE,
  summary,
  byModel,
  preisLuecken,
  byDay,
  byMonth,
  byYear,
  byPeriod,
  byProject,
  ohneTicket,
  byTicket,
  mehrwert,
  live,
  aboAnteil,
  aboKosten,
  filterClause,
  lokalZuordnung, lokalJeGruppe, lokalStundenJeGruppe, lokalBetrag,
};
