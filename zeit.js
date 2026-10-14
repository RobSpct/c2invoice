'use strict';
// Zeiterfassung: Zeit ohne Claude, von Hand nachgetragen oder per Timer.
// Ein Eintrag gehoert einem Ziel — Vorgang, Projekt, Kunde oder intern — und
// traegt seine Rohzeit und seine gezaehlte Zeit getrennt. Gerechnet wird hier
// beim Speichern; metrics.js summiert nur, was hier steht.
//
// Ueberlappt ein Eintrag eine Claude-Sitzung, stehen Abzug, parallele Minuten
// und Kulanz im Eintrag (siehe ueberlappung()); gezaehlt = Rohzeit minus
// Abzug, danach gerundet.
const config = require('./config.json');
const metrics = require('./metrics');
const kontakte = require('./kontakte');
const { getMeta, setMeta } = require('./db');

const ZIELARTEN = ['vorgang', 'projekt', 'kunde', 'intern'];
// Interne Ziele: Arbeit, die keinem Kunden gehoert. Nie abrechenbar, zaehlt
// mit dem Selbstkostensatz in die Kosten.
const INTERN = ['Planung', 'Verwaltung', 'Weiterbildung', 'Akquise', 'Werkzeugbetrieb'];
// Wie beim Buchen einer Sitzung (server.js bucheVorgang): der Name steht
// woertlich auf einem Dokument.
const VORGANG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
const VERBOTENE_SCHLUESSEL = ['__proto__', 'constructor', 'prototype'];
const MAX_MIN = 24 * 60;
const NOTIZ_MAX = 500;

// Ganze Zahl aus einer Anfrage, sonst NaN — Number(true), Number([5]) und
// Number(' ') ergaeben sonst 1, 5 und 0.
function ganzzahl(w) {
  if (typeof w === 'number') return Number.isInteger(w) ? w : NaN;
  return typeof w === 'string' && /^\s*\d+\s*$/.test(w) ? Number(w) : NaN;
}

// Nur mit Zeitzone (Z oder Versatz): ohne sie laese Date.parse Ortszeit des
// Servers, der Tag kaeme aber aus UTC — ein Eintrag kurz nach Mitternacht
// landete im falschen Abrechnungszeitraum. Jahre vor 2020 sind Tippfehler.
const ZEITPUNKT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
function zeitpunkt(w, label) {
  const ms = typeof w === 'string' && ZEITPUNKT_RE.test(w) ? Date.parse(w) : NaN;
  const jahr = Number.isFinite(ms) ? new Date(ms).getUTCFullYear() : 0;
  if (!Number.isFinite(ms) || jahr < 2020 || jahr > new Date().getUTCFullYear() + 1) {
    throw new Error(label + ': Zeitpunkt mit Zeitzone erwartet (z. B. 2026-10-06T14:00:00Z).');
  }
  return ms;
}

// Namen stehen spaeter auf Belegen: eine Zeile, ohne unsichtbare Zeichen
// (Zeilenwechsel, Tab, Null-Breite, Richtungsmarken, BOM, weiches Trennzeichen).
const EINZEILIG_RE = /[\t\n\r\u00AD\u061C\u200B-\u200F\u2060-\u2064\uFEFF]/;
function einzeilig(s, label) {
  kontakte.ohneErsatzzeichen(s, label);
  if (EINZEILIG_RE.test(s)) throw new Error(label + ': Zeilenwechsel und unsichtbare Zeichen sind nicht erlaubt.');
  return s;
}

// Prueft und normalisiert das Ziel. Kunden gehen ueber die Kontakt-Id: ein
// umbenannter Kontakt behaelt so seine Zeit.
function ziel(db, art, schluessel) {
  if (!ZIELARTEN.includes(art)) throw new Error('Zielart unbekannt.');
  const s = typeof schluessel === 'string' ? schluessel.trim() : typeof schluessel === 'number' ? String(schluessel) : '';
  if (!s) throw new Error('Ziel fehlt.');
  if (art === 'vorgang') {
    if (!VORGANG_RE.test(s)) {
      throw new Error('Vorgang: 2 bis 40 Zeichen, erlaubt sind Buchstaben, Ziffern, Punkt, Unterstrich und Bindestrich.');
    }
    return s.toUpperCase();
  }
  if (art === 'projekt') {
    if (VERBOTENE_SCHLUESSEL.includes(s)) throw new Error('Projektname nicht zulaessig.');
    if (s.length > 200) throw new Error('Projektname: hoechstens 200 Zeichen.');
    einzeilig(s, 'Projektname');
    // Werkzeugprojekte zaehlen nie als Arbeit; eine Buchung dort verschwaende still.
    if (metrics.isOverhead(s)) throw new Error('Werkzeugprojekt: bitte als intern "Werkzeugbetrieb" buchen.');
    return s;
  }
  if (art === 'kunde') return String(kontakte.pruefeId(db, s));
  if (!INTERN.includes(s)) throw new Error('Interne Tätigkeit unbekannt: ' + INTERN.join(', ') + '.');
  return s;
}

function taetigkeit(db, name) {
  const t = typeof name === 'string' ? db.prepare('SELECT * FROM taetigkeitsart WHERE name = ?').get(name.trim()) : null;
  if (!t) throw new Error('Tätigkeit unbekannt.');
  return t;
}

// Projekt eines Ziels: Vorgang ueber seine meisten Requests, wie der Satz.
function projektVon(db, art, schluessel) {
  if (art === 'projekt') return schluessel;
  if (art === 'vorgang') return metrics.satzFuerTicket(db, schluessel).projekt;
  return null;
}

function rundungFuer(db, art, schluessel) {
  const p = projektVon(db, art, schluessel);
  const saetze = config.projektSaetze || {};
  const eigen = p && Object.hasOwn(saetze, p) && saetze[p] ? saetze[p].rundung : undefined;
  const r = Number.isInteger(eigen) && eigen >= 1 ? eigen : Math.round(Number(config.rundungMinuten));
  return Number.isInteger(r) && r >= 1 && r <= 60 ? r : 5;
}

// Satz eines Eintrags: eigener Satz der Taetigkeit, sonst der des Ziels
// (Projekt inkl. Rabatt). Kunde ohne Projekt: Standardsatz. Intern: keiner.
function satzFuer(db, e, t = null) {
  if (e.ziel_art === 'intern') return null;
  const ta = t || db.prepare('SELECT satz FROM taetigkeitsart WHERE name = ?').get(e.taetigkeit);
  if (ta && ta.satz != null) return ta.satz;
  if (e.ziel_art === 'vorgang') return metrics.satzFuerTicket(db, e.ziel_schluessel).satz;
  if (e.ziel_art === 'projekt') return metrics.satzFuerProjekt(e.ziel_schluessel).satz;
  return config.stundensatz;
}

// Prueft eine Eingabe und rechnet Roh- und gezaehlte Zeit.
function pruefe(db, d, jetzt) {
  if (!d || typeof d !== 'object') throw new Error('Zielart unbekannt.');
  const art = d.ziel_art;
  const schluessel = ziel(db, art, d.ziel_schluessel);
  const start = zeitpunkt(d.start, 'Start');
  const fest = d.dauer_fest_min === undefined || d.dauer_fest_min === null || d.dauer_fest_min === ''
    ? null : ganzzahl(d.dauer_fest_min);
  if (fest !== null && !(fest >= 1 && fest <= MAX_MIN)) throw new Error('Feste Dauer: 1 bis 1440 Minuten.');
  const ende = fest !== null ? start + fest * 60000 : zeitpunkt(d.ende, 'Ende');
  if (ende <= start) throw new Error('Ende liegt vor dem Beginn.');
  if (ende - start > MAX_MIN * 60000) throw new Error('Eintrag länger als 24 Stunden — bitte aufteilen.');
  if (start > jetzt + 60000) throw new Error('Beginn liegt in der Zukunft — Zeit erst nachtragen, wenn sie geleistet ist.');
  const pause = d.pause_min === undefined || d.pause_min === null || d.pause_min === '' ? 0 : ganzzahl(d.pause_min);
  const brutto = fest !== null ? fest : Math.round((ende - start) / 60000);
  if (!Number.isInteger(pause) || pause < 0 || pause >= brutto) throw new Error('Pause: ganze Minuten, kürzer als der Eintrag.');
  const t = taetigkeit(db, d.taetigkeit);
  const notiz = d.notiz === undefined || d.notiz === null ? '' : d.notiz;
  if (typeof notiz !== 'string') throw new Error('Notiz: Text erwartet.');
  if (notiz.trim().length > NOTIZ_MAX) throw new Error('Notiz: höchstens 500 Zeichen.');
  kontakte.ohneErsatzzeichen(notiz, 'Notiz');
  const roh = brutto - pause;
  return {
    ziel_art: art,
    ziel_schluessel: schluessel,
    start: new Date(start).toISOString(),
    ende: new Date(ende).toISOString(),
    tag: new Date(start).toISOString().slice(0, 10),
    dauer_fest_min: fest,
    pause_min: pause,
    taetigkeit: t.name,
    notiz: notiz.trim(),
    // Intern ist nie abrechenbar, gleich was mitkommt.
    abrechenbar: art !== 'intern' && d.abrechenbar !== false && d.abrechenbar !== 0 ? 1 : 0,
    rohzeit_min: roh,
  };
}

// --- Ueberlappung mit Claude-Sitzungen ---------------------------------------
// Laeuft waehrend eines Eintrags eine Claude-Sitzung, entscheidet je Sitzung:
// 1. die Wahl des Nutzers fuer dieses Paar (beides | claude | meine | keins),
// 2. sonst Parallelarbeit (Taetigkeit mit parallel=1, Kalendertermin): beides zaehlt,
// 3. sonst Zeitmodell "eingaben": der Mensch war am Geraet, die Minuten zaehlen
//    nur einmal — bei Claude, der Eintrag gibt sie ab ("eigene"),
// 4. sonst Aktivitaet am selben Vorgang/Projekt: doppelt gezaehlt, Abzug,
// 5. sonst anderes Ziel: Claude arbeitet allein, beides zaehlt.
// Abzug, parallel und Kulanz sind Vereinigungen ueber alle Sitzungen: zwei
// Sitzungen in denselben 30 Minuten nehmen dem Eintrag 30 Minuten, nicht 60.
const WAHLEN = ['beides', 'claude', 'meine', 'keins'];
const WAHL_ERGEBNIS = { beides: 'parallel', claude: 'abzug', meine: 'meine', keins: 'kulanz' };

// Sortiert und verschmilzt Intervalle [von, bis] (ms).
function vereinige(iv) {
  const s = iv.filter(([v, b]) => b > v).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [v, b] of s) {
    const l = out[out.length - 1];
    if (l && v <= l[1]) l[1] = Math.max(l[1], b); else out.push([v, b]);
  }
  return out;
}
const laenge = (iv) => iv.reduce((a, [v, b]) => a + b - v, 0);
// Teil von `iv` ausserhalb von `weg` (beide vereinigt).
function ohne(iv, weg) {
  let rest = iv;
  for (const [wv, wb] of weg) {
    rest = rest.flatMap(([v, b]) => (wb <= v || wv >= b ? [[v, b]] : [[v, wv], [wb, b]].filter(([x, y]) => y > x)));
  }
  return rest;
}
const minuten = (ms) => Math.round(ms / 60000);

function gleichesZiel(e, a) {
  if (e.ziel_art === 'vorgang') return !!a.ticket && String(a.ticket).toUpperCase() === e.ziel_schluessel;
  if (e.ziel_art === 'projekt') return a.project === e.ziel_schluessel;
  return false;   // Kunde und intern sind nie das Ziel einer Sitzung
}

// Rein: Eintrag (start/ende ISO, Ziel, kalender_uid), ungeschnittene
// Sitzungsabschnitte (metrics.zeitAbschnitte), Wahlen je Sitzung, Taetigkeit.
// Die Abschnitte muessen roh sein: geschnittene zeigten nach "meine" keine
// Ueberlappung mehr, und der Schnitt verschwaende beim Nachrechnen.
function ueberlappung(e, fenster, wahlen, t) {
  const s = Date.parse(e.start);
  const en = Date.parse(e.ende);
  // Ohne gueltige Zeitpunkte ergaebe jeder Vergleich false und still Abzug 0.
  if (!Number.isFinite(s) || !Number.isFinite(en)) throw new Error('Eintrag ohne gültigen Beginn oder Ende.');
  const je = new Map();   // Sitzung -> Zeile mit Teilen je Regel
  const iv = { abzug: [], kulanz: [], parallel: [] };
  for (const a of fenster) {
    // Werkzeugbetrieb begleitet die Arbeit nur, er ist kein Mensch am Geraet.
    if (metrics.isOverhead(a.project)) continue;
    const v = Math.max(a.von, s);
    const b = Math.min(a.bis, en);
    if (!(b > v)) continue;
    const wahl = wahlen.get(a.session) || null;
    let regel;
    let ergebnis;
    if (wahl) { regel = 'wahl'; ergebnis = WAHL_ERGEBNIS[wahl]; }
    else if ((t && t.parallel) || e.kalender_uid) { regel = 'meeting'; ergebnis = 'parallel'; }
    else if (a.modell === 'eingaben') { regel = 'eigene'; ergebnis = 'abzug'; }
    else if (gleichesZiel(e, a)) { regel = 'gleiches_ziel'; ergebnis = 'abzug'; }
    else { regel = 'anderes_ziel'; ergebnis = 'beide'; }
    if (ergebnis === 'abzug' || ergebnis === 'kulanz') iv.abzug.push([v, b]);
    if (ergebnis === 'kulanz') iv.kulanz.push([v, b]);
    if (ergebnis === 'parallel') iv.parallel.push([v, b]);
    let z = je.get(a.session);
    if (!z) {
      z = { session_id: a.session, von: v, bis: b, iv: [], teile: new Map(), modell: a.modell, project: a.project, ticket: a.ticket || null, wahl };
      je.set(a.session, z);
    }
    z.iv.push([v, b]);
    z.von = Math.min(z.von, v);
    z.bis = Math.max(z.bis, b);
    const k = regel + '\u0000' + ergebnis;
    if (!z.teile.has(k)) z.teile.set(k, { regel, ergebnis, iv: [] });
    z.teile.get(k).iv.push([v, b]);
  }
  const abzug = vereinige(iv.abzug);
  // Eine Zeile je Sitzung — die Wahl gilt fuer das Paar. Wechselt das Zeitmodell
  // mitten im Eintrag, nennt die Zeile die Regel mit den meisten Minuten und
  // traegt `gemischt: true`.
  const sitzungen = [...je.values()].sort((x, y) => x.von - y.von).map(({ iv: zi, teile, von, bis, ...z }) => {
    const haupt = [...teile.values()].map((p) => ({ ...p, ms: laenge(vereinige(p.iv)) })).sort((x, y) => y.ms - x.ms)[0];
    return {
      ...z, regel: haupt.regel, ergebnis: haupt.ergebnis, gemischt: teile.size > 1,
      von: new Date(von).toISOString(), bis: new Date(bis).toISOString(), min: minuten(laenge(vereinige(zi))),
    };
  });
  return {
    abzug_min: minuten(laenge(abzug)),
    // Eine Minute, die der Eintrag schon abgibt, ist nicht noch parallel.
    parallel_min: minuten(laenge(ohne(vereinige(iv.parallel), abzug))),
    kulanz_min: minuten(laenge(vereinige(iv.kulanz))),
    sitzungen,
  };
}

// Vorab geladene Nachschlagewerte fuer viele Eintraege in einem Durchlauf
// (nachrechnen, Live): eine Abfrage statt einer je Eintrag.
function cacheFuer(db) {
  return {
    taet: new Map(db.prepare('SELECT name, parallel FROM taetigkeitsart').all().map((t) => [t.name, t])),
    rundung: new Map(),
  };
}

function wahlenVon(db, id) {
  if (id == null) return new Map();
  return new Map(db.prepare('SELECT session_id, wahl FROM ueberlappung_wahl WHERE eintrag_id = ?').all(id).map((r) => [r.session_id, r.wahl]));
}

// Ueberlappung und gezaehlte Zeit eines Eintrags (geprueft oder aus der DB).
// `fenster` darf vorab fuer viele Eintraege geladen sein. Rundung nach dem Abzug.
// Die Pause hat keine Lage im Tag: liegt sie in der Ueberlappung, ist der Abzug
// zu hoch — er wird deshalb hoechstens so gross wie die Rohzeit.
// `wahlen` (Map Sitzung -> Wahl) statt der gespeicherten: Timer, der noch keine Zeile hat.
function rechne(db, e, id = null, fenster = null, cache = null, wahlen = null) {
  const fe = fenster || metrics.zeitAbschnitte(db, { von: e.start.slice(0, 10), bis: e.ende.slice(0, 10) });
  const t = cache ? cache.taet.get(e.taetigkeit)
    : db.prepare('SELECT parallel FROM taetigkeitsart WHERE name = ?').get(e.taetigkeit);
  const u = ueberlappung(e, fe, wahlen || wahlenVon(db, id), t);
  const rk = e.ziel_art + '\u0000' + e.ziel_schluessel;
  let rundung = cache ? cache.rundung.get(rk) : undefined;
  if (rundung === undefined) {
    rundung = rundungFuer(db, e.ziel_art, e.ziel_schluessel);
    if (cache) cache.rundung.set(rk, rundung);
  }
  const abzug = Math.min(u.abzug_min, e.rohzeit_min);
  return {
    ...u,
    abzug_min: abzug,
    kulanz_min: Math.min(u.kulanz_min, abzug),
    parallel_min: Math.min(u.parallel_min, e.rohzeit_min - abzug),
    rundung,
    gezaehlt_min: Math.ceil(Math.max(0, e.rohzeit_min - abzug) / rundung) * rundung,
  };
}

const GERECHNET = ['abzug_min', 'parallel_min', 'kulanz_min', 'gezaehlt_min'];
function gerechnet(r) {
  return Object.fromEntries(GERECHNET.map((k) => [k, r[k]]));
}

function lade(db, id) {
  return db.prepare('SELECT * FROM zeit_eintrag WHERE id = ?').get(id) || null;
}

function eintragsId(id) {
  const n = ganzzahl(id);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Eintrag nicht gefunden.');
  return n;
}

function gesperrt(e) {
  if (e.status === 'abgerechnet') throw new Error('Eintrag ist abgerechnet und gesperrt (Rechnung ' + e.rechnung_nr + ').');
}

// "Nur meine Zeit" und "Keins" kuerzen Claude-Minuten. Ist der Vorgang der Sitzung
// schon abgerechnet, bliebe die Rechnung, der Arbeitswert saenke still darunter.
// wahlen: Map Sitzung -> Wahl, nur die neu gegebenen (alte Wahlen bleiben gueltig).
const KUERZT_CLAUDE = ['meine', 'keins'];
// verwerfen=true (Timer-Stopp): solche Wahlen fallen weg statt abzulehnen — die Regel
// gilt dann, und die kuerzt nie Claude-Zeit. Sonst haenge der Timer fest. Gibt die gueltigen Wahlen zurueck.
function pruefeWahlAbgerechnet(db, sitzungen, wahlen, verwerfen = false) {
  if (![...wahlen.values()].some((w) => KUERZT_CLAUDE.includes(w))) return wahlen;
  const abr = require('./rechnung').abrechnung(db);
  const gueltig = new Map(wahlen);
  for (const s of sitzungen) {
    if (!KUERZT_CLAUDE.includes(wahlen.get(s.session_id)) || !s.ticket || !Object.hasOwn(abr, s.ticket)) continue;
    if (verwerfen) { gueltig.delete(s.session_id); continue; }
    throw new Error('Vorgang ' + s.ticket + ' ist schon abgerechnet (' + abr[s.ticket].nummern.join(', ') +
      ') — seine Claude-Zeit lässt sich nicht mehr kürzen. „Beides“ oder „Nur Claude“ wählen.');
  }
  return gueltig;
}

// Neu anlegen oder (mit id) aendern. Ein abgerechneter Eintrag bleibt, wie er ist.
// `wahlen` (Timer, Nachtrag-Dialog): Wahlen je Sitzung, die mit dem Eintrag
// gespeichert werden — nur fuer Sitzungen, die ihn wirklich ueberlappen.
// Aus einem Termin gebucht ("+ buchen" am Termin-Geist): der Termin merkt sich
// den Eintrag (gebucht_eintrag_id), damit der Geist verschwindet und niemand
// ihn zweimal bucht. kalender_uid und damit die Parallelregel bekommen nur
// Meetings; ein Blocker ist Fokusarbeit, dort gilt die Regel der Taetigkeit.
function terminVon(db, d, jetzt = Date.now()) {
  if (!d || d.termin === undefined || d.termin === null) return null;
  const t = d.termin;
  if (typeof t !== 'object' || typeof t.kalender_id !== 'string' || typeof t.uid !== 'string') throw new Error('Termin nicht gefunden.');
  const r = db.prepare('SELECT kalender_id, uid, art, start, gebucht_eintrag_id FROM termin WHERE kalender_id = ? AND uid = ?').get(t.kalender_id, t.uid);
  if (!r) throw new Error('Termin nicht gefunden.');
  if (Date.parse(r.start) > jetzt + 60000) throw new Error('Termin hat noch nicht begonnen — buchen geht ab Beginn.');
  if (r.gebucht_eintrag_id !== null && lade(db, r.gebucht_eintrag_id)) throw new Error('Termin ist schon gebucht.');
  return r;
}
const uidVon = (t) => (t && t.art !== 'blocker' ? t.uid : null);

function speichere(db, daten, id = null, { jetzt = Date.now(), wahlen = null, abgerechneteVerwerfen = false } = {}) {
  let gegeben = wahlenAus(wahlen);
  const n = id !== null && id !== undefined ? eintragsId(id) : null;
  const geprueft = pruefe(db, daten, jetzt);
  const alt = n !== null ? lade(db, n) : null;
  if (n !== null && daten && daten.termin !== undefined && daten.termin !== null) throw new Error('Einen Termin buchen geht nur beim Anlegen.');
  const termin = terminVon(db, daten, jetzt);
  if (n !== null) {
    if (!alt) throw new Error('Eintrag nicht gefunden.');
    gesperrt(alt);
    // Aus einem Kalendertermin gebucht bleibt gebucht: sonst wuerde aus der
    // Parallelregel beim Aendern still ein Abzug.
    geprueft.kalender_uid = alt.kalender_uid;
  } else if (termin) geprueft.kalender_uid = uidVon(termin);
  let r = rechne(db, geprueft, n, null, null, new Map([...wahlenVon(db, n), ...gegeben]));
  const gueltig = pruefeWahlAbgerechnet(db, r.sitzungen, gegeben, abgerechneteVerwerfen);
  if (gueltig.size !== gegeben.size) {
    gegeben = gueltig;
    r = rechne(db, geprueft, n, null, null, new Map([...wahlenVon(db, n), ...gegeben]));
  }
  const w = { ...geprueft, ...gerechnet(r) };
  const spalten = Object.keys(w);
  return kontakte.inTransaktion(db, () => {
    if (n !== null) {
      db.prepare('UPDATE zeit_eintrag SET ' + spalten.map((s) => s + ' = ?').join(', ') + ' WHERE id = ?')
        .run(...spalten.map((s) => w[s]), n);
      // Wahlen fuer Sitzungen, die nach der Aenderung nicht mehr ueberlappen,
      // fallen weg — sonst wirkten sie unsichtbar weiter, sobald sich die
      // Zeiten spaeter wieder ueberschneiden.
      const bleiben = new Set(r.sitzungen.map((s) => s.session_id));
      for (const { session_id: sid } of db.prepare('SELECT session_id FROM ueberlappung_wahl WHERE eintrag_id = ?').all(n)) {
        if (!bleiben.has(sid)) db.prepare('DELETE FROM ueberlappung_wahl WHERE eintrag_id = ? AND session_id = ?').run(n, sid);
      }
      schreibeWahlen(db, n, r, gegeben);
      return lade(db, n);
    }
    const ein = db.prepare('INSERT INTO zeit_eintrag (' + spalten.join(', ') + ', created_at) VALUES ('
      + spalten.map(() => '?').join(', ') + ', ?)').run(...spalten.map((s) => w[s]), new Date(jetzt).toISOString());
    const neu = Number(ein.lastInsertRowid);
    schreibeWahlen(db, neu, r, gegeben);
    if (termin) db.prepare('UPDATE termin SET gebucht_eintrag_id = ? WHERE kalender_id = ? AND uid = ?').run(neu, termin.kalender_id, termin.uid);
    return lade(db, neu);
  });
}

// Wahlen aus Anfrage (Objekt) oder Timer (Map) als Map.
function wahlenAus(w) {
  return w instanceof Map ? w : new Map(Object.entries(pruefeWahlen(w)));
}
// Gegebene Wahlen der Sitzungen, die den Eintrag ueberlappen (wie waehle()).
function schreibeWahlen(db, id, r, gegeben) {
  for (const s of r.sitzungen) {
    if (!gegeben.has(s.session_id)) continue;
    db.prepare('INSERT INTO ueberlappung_wahl (eintrag_id, session_id, wahl) VALUES (?, ?, ?) '
      + 'ON CONFLICT(eintrag_id, session_id) DO UPDATE SET wahl = excluded.wahl').run(id, s.session_id, gegeben.get(s.session_id));
  }
}

// Rechnet wie speichere, schreibt aber nichts — fuer den Nachtrag-Dialog. Mit
// id gelten die Wahlen dieses Eintrags, `daten.wahlen` gehen vor. Satz und
// Betrag wie in der Liste (mitWert).
function vorschau(db, daten, id = null, { jetzt = Date.now() } = {}) {
  const n = id !== null && id !== undefined && id !== '' ? eintragsId(id) : null;
  const alt = n !== null ? lade(db, n) : null;
  if (n !== null && !alt) throw new Error('Eintrag nicht gefunden.');
  const w = pruefe(db, daten, jetzt);
  if (alt) w.kalender_uid = alt.kalender_uid;
  else { const t = terminVon(db, daten, jetzt); if (t) w.kalender_uid = uidVon(t); }
  const gegeben = wahlenAus(daten && daten.wahlen);
  return mitWert(db, [{ ...w, ...rechne(db, w, n, null, null, new Map([...wahlenVon(db, n), ...gegeben])) }])[0];
}

function loesche(db, id) {
  const n = eintragsId(id);
  const alt = lade(db, n);
  if (!alt) throw new Error('Eintrag nicht gefunden.');
  gesperrt(alt);
  // Die Wahl gehoert zum Paar: ohne Eintrag gibt die Sitzung ihre Minuten nicht
  // mehr ab. Beides zusammen, sonst stuende eine Haelfte allein.
  kontakte.inTransaktion(db, () => {
    db.prepare('DELETE FROM ueberlappung_wahl WHERE eintrag_id = ?').run(n);
    db.prepare('DELETE FROM zeit_eintrag WHERE id = ?').run(n);
    // Aus einem Termin gebucht: der Termin wird wieder buchbar.
    db.prepare('UPDATE termin SET gebucht_eintrag_id = NULL WHERE gebucht_eintrag_id = ?').run(n);
  });
  return { id: n };
}

// Speichert die Wahl eines Paars und rechnet den Eintrag sofort neu. Die
// Sitzungsseite folgt von selbst (metrics.abrechenbareAbschnitte). Nur fuer
// Sitzungen, die den Eintrag tatsaechlich ueberlappen.
function waehle(db, eintragId, sessionId, wahl) {
  if (!WAHLEN.includes(wahl)) throw new Error('Wahl: beides, claude, meine oder keins.');
  const n = eintragsId(eintragId);
  const e = lade(db, n);
  if (!e) throw new Error('Eintrag nicht gefunden.');
  gesperrt(e);
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 200) throw new Error('Sitzung nicht gefunden.');
  const fenster = metrics.zeitAbschnitte(db, { von: e.start.slice(0, 10), bis: e.ende.slice(0, 10) });
  const vorher = rechne(db, e, n, fenster).sitzungen;
  if (!vorher.some((s) => s.session_id === sessionId)) {
    throw new Error('Sitzung nicht gefunden oder ohne Überschneidung mit dem Eintrag.');
  }
  pruefeWahlAbgerechnet(db, vorher, new Map([[sessionId, wahl]]));
  return kontakte.inTransaktion(db, () => {
    db.prepare('INSERT INTO ueberlappung_wahl (eintrag_id, session_id, wahl) VALUES (?, ?, ?) '
      + 'ON CONFLICT(eintrag_id, session_id) DO UPDATE SET wahl = excluded.wahl').run(n, sessionId, wahl);
    const r = rechne(db, e, n, fenster);
    aktualisiere(db, e, r);
    return { eintrag: lade(db, n), ueberlappung: r };
  });
}

// Schreibt die gerechneten Spalten eines offenen Eintrags, wenn sie sich
// geaendert haben. true = wirklich geschrieben.
function aktualisiere(db, e, r) {
  if (GERECHNET.every((k) => e[k] === r[k])) return false;
  return db.prepare("UPDATE zeit_eintrag SET abzug_min = ?, parallel_min = ?, kulanz_min = ?, gezaehlt_min = ? WHERE id = ? AND status = 'offen'")
    .run(r.abzug_min, r.parallel_min, r.kulanz_min, r.gezaehlt_min, e.id).changes > 0;
}

// Ueberlappung eines gespeicherten Eintrags, jetzt gerechnet.
function ueberlappungVon(db, id) {
  const n = eintragsId(id);
  const e = lade(db, n);
  if (!e) throw new Error('Eintrag nicht gefunden.');
  return { eintrag_id: n, ...rechne(db, e, n) };
}

// Claude schreibt seine Logs verzoegert: offene Eintraege, die in den letzten
// `seitStunden` endeten, werden mit den neuen Sitzungsdaten nachgerechnet
// (Infinity = alle offenen, z. B. nach einer Einstellungsaenderung).
// Abgerechnete bleiben, wie sie auf der Rechnung stehen. Gibt die Zahl der
// geaenderten Eintraege zurueck.
function nachrechnen(db, { seitStunden = 48, jetzt = Date.now() } = {}) {
  const seit = Number.isFinite(seitStunden) ? new Date(jetzt - seitStunden * 3600e3).toISOString() : '';
  const offen = db.prepare("SELECT * FROM zeit_eintrag WHERE status = 'offen' AND ende >= ? ORDER BY start").all(seit);
  if (!offen.length) return 0;
  const fenster = fensterJeTag(db, offen);
  const cache = cacheFuer(db);
  let n = 0;
  let kaputt = 0;
  // Ein kaputter Eintrag haelt die uebrigen nicht auf; am Ende faellt er auf.
  for (const e of offen) {
    try {
      if (aktualisiere(db, e, rechne(db, e, e.id, fenster(e), cache))) n += 1;
    } catch (err) {
      kaputt += 1;
      console.error('Zeiteintrag #' + e.id + ' nicht nachgerechnet:', err.message);
    }
  }
  if (kaputt) throw new Error(kaputt + ' Eintrag/Einträge nicht nachgerechnet (' + n + ' aktualisiert).');
  return n;
}

// Sitzungsabschnitte je Eintragstag, einmal je Tag geladen: so liest ein Lauf
// ueber viele Eintraege nur die Tage mit Eintraegen, nie die ganze Historie
// dazwischen. Gibt eine Funktion Eintrag -> Abschnitte zurueck.
function fensterJeTag(db, eintraege) {
  const bisJeTag = new Map();
  for (const e of eintraege) {
    const b = String(e.ende).slice(0, 10);
    if (!bisJeTag.has(e.tag) || b > bisJeTag.get(e.tag)) bisJeTag.set(e.tag, b);
  }
  const geladen = new Map();
  return (e) => {
    if (!geladen.has(e.tag)) geladen.set(e.tag, metrics.zeitAbschnitte(db, { von: e.tag, bis: bisJeTag.get(e.tag) }));
    return geladen.get(e.tag);
  };
}

// Was die Sitzungsseite der Wahl braucht: je meine/keins die Spanne des
// Eintrags, die metrics.schneide aus der Sitzung nimmt.
// ponytail: liest alle Wahlen; bei vielen Tausend Paaren nach Rahmen filtern.
function sitzungsAbzuege(db) {
  return db.prepare(`
    SELECT w.session_id AS session, e.start, e.ende FROM ueberlappung_wahl w
    JOIN zeit_eintrag e ON e.id = w.eintrag_id WHERE w.wahl IN ('meine', 'keins')
  `).all().map((r) => ({ session: r.session, von: Date.parse(r.start), bis: Date.parse(r.ende) }));
}

// Fuer die Live-Ansicht: je Sitzung die Eintraege, mit denen sie sich
// ueberschneidet, samt Regel und Wahl. `vonTag`: erster Tag der Sitzungen.
// Nur die Ueberlappung, ohne Rundung und Satz — die Live-Abfrage laeuft oft.
// ponytail: hoechstens die 500 juengsten Eintraege seit vonTag; Live zeigt nur
// Sitzungen der letzten Stunde, aeltere Ueberlappungen sieht die Zeiterfassung.
// bisTag (optional, Vorgangs-Detail): ohne Obergrenze verdraengten spaetere
// Eintraege die eines alten Vorgangs aus dem Limit.
function ueberlappungenJeSitzung(db, ids, vonTag, bisTag) {
  const out = new Map();
  if (!ids.length || !vonTag) return out;
  const gesucht = new Set(ids);
  const eintraege = bisTag
    ? db.prepare("SELECT * FROM zeit_eintrag WHERE tag >= date(?, '-1 day') AND tag <= date(?, '+1 day') ORDER BY start DESC LIMIT 500").all(vonTag, bisTag)
    : db.prepare("SELECT * FROM zeit_eintrag WHERE tag >= date(?, '-1 day') ORDER BY start DESC LIMIT 500").all(vonTag);
  if (!eintraege.length) return out;
  const fenster = fensterJeTag(db, eintraege);
  const { taet } = cacheFuer(db);
  const wahlen = new Map();
  for (const w of db.prepare('SELECT eintrag_id, session_id, wahl FROM ueberlappung_wahl').all()) {
    if (!wahlen.has(w.eintrag_id)) wahlen.set(w.eintrag_id, new Map());
    wahlen.get(w.eintrag_id).set(w.session_id, w.wahl);
  }
  for (const e of eintraege.reverse()) {
    for (const s of ueberlappung(e, fenster(e), wahlen.get(e.id) || new Map(), taet.get(e.taetigkeit)).sitzungen) {
      if (!gesucht.has(s.session_id)) continue;
      if (!out.has(s.session_id)) out.set(s.session_id, []);
      out.get(s.session_id).push({ eintrag_id: e.id, start: e.start, ende: e.ende, wahl: s.wahl, min: s.min, regel: s.regel, ergebnis: s.ergebnis, gemischt: s.gemischt, status: e.status });
    }
  }
  return out;
}

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

function liste(db, { from, to, ziel_art, ziel_schluessel, status } = {}) {
  for (const [w, l] of [[from, 'from'], [to, 'to']]) {
    if (w != null && w !== '' && !DATUM_RE.test(w)) throw new Error(l + ' muss ein Datum JJJJ-MM-TT sein.');
  }
  const bed = [];
  const par = [];
  if (from) { bed.push('tag >= ?'); par.push(from); }
  if (to) { bed.push('tag <= ?'); par.push(to); }
  if (ziel_art) { bed.push('ziel_art = ?'); par.push(ziel_art); }
  if (ziel_schluessel) { bed.push('ziel_schluessel = ?'); par.push(ziel_schluessel); }
  if (status) { bed.push('status = ?'); par.push(status); }
  // Obergrenze: die Liste geht ungefiltert als Antwort raus.
  const zeilen = mitWert(db, db.prepare('SELECT * FROM zeit_eintrag ' + (bed.length ? 'WHERE ' + bed.join(' AND ') : '') + ' ORDER BY start DESC LIMIT 2000')
    .all(...par));
  // Name des Ziels fuer die Anzeige (Kunden ueber ihren heutigen Namen).
  const namen = new Map();
  for (const e of zeilen) {
    const k = e.ziel_art + '\u0000' + e.ziel_schluessel;
    if (!namen.has(k)) namen.set(k, zielText(db, e));
    e.name = namen.get(k);
  }
  return zeilen;
}

// Eintraege eines Zeitraums mit Wert, fuer metrics. `projekt` ist das Projekt
// des Ziels (Vorgang: ueber seine Requests), `eur` = gezaehlte Stunden x Satz.
// Abgerechnete Eintraege tragen ihren eingefrorenen Satz.
function imRahmen(db, { from, to, month } = {}) {
  const { von, bis } = metrics.zeitRahmen({ from, to, month });
  return mitWert(db, db.prepare(`
    SELECT * FROM zeit_eintrag WHERE (? IS NULL OR tag >= ?) AND (? IS NULL OR tag <= ?)
  `).all(von, von, bis, bis));
}

// Projekt, Satz und Wert je Eintrag — eine Formel fuer Auswertung und Liste.
function mitWert(db, zeilen) {
  if (!zeilen.length) return zeilen;
  const satzTaetigkeit = new Map(db.prepare('SELECT name, satz FROM taetigkeitsart').all().map((t) => [t.name, t]));
  const projektCache = new Map();
  for (const e of zeilen) {
    const k = e.ziel_art + '\u0000' + e.ziel_schluessel;
    if (!projektCache.has(k)) projektCache.set(k, projektVon(db, e.ziel_art, e.ziel_schluessel));
    e.projekt = projektCache.get(k);
    const satz = e.satz_eingefroren != null ? e.satz_eingefroren : satzFuer(db, e, satzTaetigkeit.get(e.taetigkeit) || { satz: null });
    e.satz = satz;
    e.eur = e.abrechenbar && satz != null ? (e.gezaehlt_min / 60) * satz : 0;
  }
  return zeilen;
}

// Summen je Gruppe: abrechenbare und nicht abrechenbare Sekunden, Euro,
// Anzahl und erster/letzter Tag. `schluesselVon` gibt null fuer Eintraege, die
// in keine Gruppe gehoeren — interne Eintraege haben weder Vorgang noch Projekt.
function gruppiere(eintraege, schluesselVon) {
  const out = new Map();
  for (const e of eintraege) {
    const k = schluesselVon(e);
    if (k == null) continue;
    let g = out.get(k);
    if (!g) {
      g = { sek: 0, nicht_sek: 0, eur: 0, n: 0, von: e.tag, bis: e.tag, abg_eur: 0, offen_sek: 0, par_min: 0, kul_min: 0 };
      out.set(k, g);
    }
    if (e.abrechenbar) g.sek += e.gezaehlt_min * 60; else g.nicht_sek += e.gezaehlt_min * 60;
    g.eur += e.eur;
    if (e.status === 'abgerechnet') g.abg_eur += e.eur;
    else if (e.abrechenbar) g.offen_sek += e.gezaehlt_min * 60;
    g.par_min += e.parallel_min || 0;
    g.kul_min += e.kulanz_min || 0;
    g.n += 1;
    if (e.tag < g.von) g.von = e.tag;
    if (e.tag > g.bis) g.bis = e.tag;
  }
  return out;
}

// Was der Hub zusaetzlich zu den Zeilen braucht: interne Zeit (Kosten).
// Interne Zeit gehoert keinem Vorgang, Projekt oder Modell: in einer so
// gefilterten Sicht zaehlt sie nicht mit, sonst druckte sie deren Marge.
function kennzahlenZusatz(db, opts = {}) {
  if (opts.ticket || opts.project || opts.model) return { intern_stunden: 0 };
  const intern = imRahmen(db, opts).filter((e) => e.ziel_art === 'intern');
  return { intern_stunden: intern.reduce((a, e) => a + e.gezaehlt_min, 0) / 60 };
}

// --- Timer -----------------------------------------------------------------
// Ein Timer zur Zeit, als meta-Zeile. Die Laufzeit wird beim Lesen gerechnet,
// ein Server-Takt ist dafuer nicht noetig.
function timerAktuell(db, jetzt = Date.now()) {
  const roh = getMeta(db, 'timer');
  if (!roh) return null;
  try {
    const t = JSON.parse(roh);
    const start = t && typeof t === 'object' && !Array.isArray(t) ? Date.parse(t.start) : NaN;
    if (!Number.isFinite(start) || !ZIELARTEN.includes(t.ziel_art) || typeof t.ziel_schluessel !== 'string') return null;
    return { ...t, laeuft_min: Math.max(0, Math.floor((jetzt - start) / 60000)) };
  } catch {
    return null;
  }
}

function timerStop(db, jetzt = Date.now()) {
  const t = timerAktuell(db, jetzt);
  if (!t) throw new Error('Kein Timer läuft.');
  // Unter einer Minute ist ein Fehlklick, keine Arbeit.
  if (jetzt - Date.parse(t.start) < 60000) {
    db.prepare("DELETE FROM meta WHERE key = 'timer'").run();
    return { verworfen: true };
  }
  // Laesst sich der Timer nicht buchen (laenger als 24 h, Ziel inzwischen
  // geloescht), bleibt er stehen: nichts geht still verloren, und der Text
  // sagt, wie es weitergeht.
  let e;
  try {
    // Inzwischen abgerechnete Vorgaenge: kuerzende Timer-Wahlen fallen weg, der Stopp gelingt.
    e = speichere(db, timerDaten(t, jetzt), null, { jetzt, wahlen: timerWahlen(t), abgerechneteVerwerfen: true });
  } catch (err) {
    throw new Error('Laufender Timer lässt sich nicht buchen: ' + err.message + ' Timer verwerfen und die Zeit nachtragen.');
  }
  db.prepare("DELETE FROM meta WHERE key = 'timer'").run();
  return { eintrag: e };
}

// Der Timer als Eintragsdaten bis `jetzt`.
function timerDaten(t, jetzt) {
  return {
    ziel_art: t.ziel_art, ziel_schluessel: t.ziel_schluessel, taetigkeit: t.taetigkeit,
    notiz: t.notiz, abrechenbar: t.abrechenbar, start: t.start, ende: new Date(jetzt).toISOString(),
  };
}
const timerWahlen = (t) => new Map(Object.entries(t.wahlen && typeof t.wahlen === 'object' ? t.wahlen : {})
  .filter(([, w]) => WAHLEN.includes(w)));

// Wahlen je Sitzung aus einer Anfrage: Objekt { session_id: wahl }.
function pruefeWahlen(w) {
  if (w === undefined || w === null) return {};
  if (typeof w !== 'object' || Array.isArray(w)) throw new Error('Wahl: Objekt Sitzung → beides, claude, meine oder keins.');
  const e = Object.entries(w);
  if (e.length > 50) throw new Error('Wahl: höchstens 50 Sitzungen.');
  for (const [sid, x] of e) {
    if (!sid || sid.length > 200 || VERBOTENE_SCHLUESSEL.includes(sid)) throw new Error('Sitzung nicht gefunden.');
    if (!WAHLEN.includes(x)) throw new Error('Wahl: beides, claude, meine oder keins.');
  }
  return Object.fromEntries(e);
}

// Startet einen Timer. Laeuft schon einer, wird er zuerst gebucht (A6).
function timerStart(db, d, jetzt = Date.now()) {
  if (!d || typeof d !== 'object') throw new Error('Zielart unbekannt.');
  const schluessel = ziel(db, d.ziel_art, d.ziel_schluessel);
  const t = taetigkeit(db, d.taetigkeit);
  const notiz = typeof d.notiz === 'string' ? d.notiz.trim() : '';
  if (notiz.length > NOTIZ_MAX) throw new Error('Notiz: höchstens 500 Zeichen.');
  kontakte.ohneErsatzzeichen(notiz, 'Notiz');
  let gebucht = null;
  if (timerAktuell(db, jetzt)) {
    const r = timerStop(db, jetzt);
    gebucht = r.eintrag || null;
  }
  const neu = {
    start: new Date(jetzt).toISOString(), ziel_art: d.ziel_art, ziel_schluessel: schluessel,
    taetigkeit: t.name, notiz, abrechenbar: d.ziel_art !== 'intern' && d.abrechenbar !== false,
  };
  setMeta(db, 'timer', JSON.stringify(neu));
  return { timer: timerAktuell(db, jetzt), gebucht };
}

// Rueckgaengig nach dem Stoppen: der Eintrag faellt weg, der Timer laeuft mit
// dessen Beginn, Ziel und Wahlen weiter — in einer Transaktion, damit nie
// beides fehlt. Abgelehnt, wenn inzwischen ein Timer laeuft (er wuerde sonst
// still gebucht).
function timerZurueck(db, id, jetzt = Date.now()) {
  const n = eintragsId(id);
  const e = lade(db, n);
  if (!e) throw new Error('Eintrag nicht gefunden.');
  gesperrt(e);
  // Nur was ein Timer-Stopp eben erzeugt hat: sonst gingen Pause, feste Dauer
  // oder Kalenderbezug eines beliebigen Eintrags still verloren.
  if (e.pause_min || e.dauer_fest_min != null || e.kalender_uid || !(jetzt - Date.parse(e.created_at) <= 10 * 60000)) {
    throw new Error('Rückgängig geht nur direkt nach dem Stoppen eines Timers.');
  }
  if (timerAktuell(db, jetzt)) throw new Error('Es läuft schon ein Timer — die Buchung bleibt bestehen.');
  const wahlen = Object.fromEntries(db.prepare('SELECT session_id, wahl FROM ueberlappung_wahl WHERE eintrag_id = ?').all(n)
    .map((w) => [w.session_id, w.wahl]));
  kontakte.inTransaktion(db, () => {
    db.prepare('DELETE FROM ueberlappung_wahl WHERE eintrag_id = ?').run(n);
    db.prepare('DELETE FROM zeit_eintrag WHERE id = ?').run(n);
    setMeta(db, 'timer', JSON.stringify({
      start: e.start, ziel_art: e.ziel_art, ziel_schluessel: e.ziel_schluessel, taetigkeit: e.taetigkeit,
      notiz: e.notiz, abrechenbar: !!e.abrechenbar, wahlen,
    }));
  });
  return { timer: timerAktuell(db, jetzt) };
}

// Ueberlappung des laufenden Timers bis jetzt, mit seinen Wahlen; unter einer
// Minute null (nichts zu buchen). Fuer den Hinweis an der Timer-Karte.
function timerVorschau(db, jetzt = Date.now()) {
  const t = timerAktuell(db, jetzt);
  if (!t || jetzt - Date.parse(t.start) < 60000) return null;
  const e = pruefe(db, timerDaten(t, jetzt), jetzt);
  const r = rechne(db, e, null, null, null, timerWahlen(t));
  return { ...gerechnet(r), rundung: r.rundung, sitzungen: r.sitzungen };
}

// Wahl am laufenden Timer: gilt beim Stoppen fuer diese Sitzungen (wie waehle()).
// Eine Sitzung oder eine Liste — alle oder keine.
function timerWahl(db, sitzungen, wahl, jetzt = Date.now()) {
  if (!WAHLEN.includes(wahl)) throw new Error('Wahl: beides, claude, meine oder keins.');
  if (!timerAktuell(db, jetzt)) throw new Error('Kein Timer läuft.');
  const ids = Array.isArray(sitzungen) ? sitzungen : [sitzungen];
  const v = timerVorschau(db, jetzt);
  if (!ids.length || ids.length > 50 || ids.some((sid) => typeof sid !== 'string' || !v || !v.sitzungen.some((s) => s.session_id === sid))) {
    throw new Error('Sitzung nicht gefunden oder ohne Überschneidung mit dem Timer.');
  }
  pruefeWahlAbgerechnet(db, v.sitzungen, new Map(ids.map((sid) => [sid, wahl])));
  const t = JSON.parse(getMeta(db, 'timer'));
  t.wahlen = { ...(t.wahlen && typeof t.wahlen === 'object' ? t.wahlen : {}), ...Object.fromEntries(ids.map((sid) => [sid, wahl])) };
  setMeta(db, 'timer', JSON.stringify(t));
  return { timer: timerAktuell(db, jetzt), vorschau: timerVorschau(db, jetzt) };
}

function timerVerwerfen(db) {
  db.prepare("DELETE FROM meta WHERE key = 'timer'").run();
  return { ok: true };
}

// --- Taetigkeitsarten ------------------------------------------------------
function taetigkeiten(db) {
  return db.prepare(`
    SELECT t.name, t.satz, t.parallel, (SELECT COUNT(*) FROM zeit_eintrag e WHERE e.taetigkeit = t.name) AS verwendet
    FROM taetigkeitsart t ORDER BY t.name
  `).all();
}

function setzeTaetigkeit(db, { name, satz, parallel } = {}) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Name fehlt.');
  const n = name.trim();
  if (n.length > 40) throw new Error('Name: höchstens 40 Zeichen.');
  einzeilig(n, 'Name');
  let s = null;
  if (satz !== undefined && satz !== null && satz !== '') {
    s = typeof satz === 'number' ? satz : typeof satz === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(satz) ? Number(satz) : NaN;
    if (!Number.isFinite(s) || s < 0 || s > 10000) throw new Error('Satz: Zahl zwischen 0 und 10000 oder leer.');
    s = Math.round(s * 100) / 100;
  }
  const alt = db.prepare('SELECT parallel FROM taetigkeitsart WHERE name = ?').get(n);
  const p = parallel === undefined ? (alt ? alt.parallel : 0) : parallel === true || parallel === 1 ? 1 : 0;
  db.prepare('INSERT INTO taetigkeitsart (name, satz, parallel) VALUES (?, ?, ?) '
    + 'ON CONFLICT(name) DO UPDATE SET satz = excluded.satz, parallel = excluded.parallel').run(n, s, p);
  return db.prepare('SELECT name, satz, parallel FROM taetigkeitsart WHERE name = ?').get(n);
}

function loescheTaetigkeit(db, name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!db.prepare('SELECT 1 FROM taetigkeitsart WHERE name = ?').get(n)) throw new Error('Tätigkeit nicht gefunden.');
  if (db.prepare('SELECT 1 FROM zeit_eintrag WHERE taetigkeit = ? LIMIT 1').get(n)) {
    throw new Error('Tätigkeit wird verwendet und kann nicht gelöscht werden.');
  }
  db.prepare('DELETE FROM taetigkeitsart WHERE name = ?').run(n);
  return { name: n };
}

// --- Ziele fuer den Picker -------------------------------------------------
// Vorgaenge nach letzter Arbeit, Projekte ohne Werkzeugbetrieb, Kunden aus den
// Kontakten, interne Ziele fest. Je Ziel Satz und Rundung, damit die
// Oberflaeche nichts nachrechnet.
function ziele(db, q = '') {
  if (typeof q !== 'string' || q.length > 100) throw new Error('Suche: höchstens 100 Zeichen.');
  const such = q.trim().toLowerCase();
  const passt = (...t) => !such || t.some((x) => String(x || '').toLowerCase().includes(such));
  const vorgaenge = db.prepare(`
    SELECT ticket AS schluessel, MAX(day) AS zuletzt FROM events WHERE ticket IS NOT NULL GROUP BY ticket
    UNION SELECT ziel_schluessel, MAX(tag) FROM zeit_eintrag WHERE ziel_art = 'vorgang' GROUP BY ziel_schluessel
    ORDER BY zuletzt DESC
  `).all();
  const gesehen = new Set();
  const v = [];
  for (const r of vorgaenge) {
    if (gesehen.has(r.schluessel)) continue;
    gesehen.add(r.schluessel);
    const s = metrics.satzFuerTicket(db, r.schluessel);
    if (!passt(r.schluessel, s.projekt)) continue;
    v.push({ schluessel: r.schluessel, projekt: s.projekt, zuletzt: r.zuletzt, satz: s.satz, rundung: rundungFuer(db, 'vorgang', r.schluessel) });
    if (v.length >= 50) break;
  }
  const projektNamen = new Set(db.prepare("SELECT DISTINCT project FROM events WHERE project NOT IN ('(unbekannt)', '(lokal)')").all()
    .map((r) => r.project).filter((p) => p && !metrics.isOverhead(p)));
  for (const p of Object.keys(config.projektSaetze || {})) projektNamen.add(p);
  const projekte = [...projektNamen].filter((p) => passt(p)).sort((a, b) => a.localeCompare(b)).slice(0, 50)
    .map((p) => ({ schluessel: p, satz: metrics.satzFuerProjekt(p).satz, rundung: rundungFuer(db, 'projekt', p) }));
  const kunden = db.prepare('SELECT id, firma, status FROM kontakte ORDER BY firma COLLATE NOCASE').all()
    .filter((k) => passt(k.firma)).slice(0, 50)
    .map((k) => ({ schluessel: String(k.id), name: k.firma, status: k.status, satz: config.stundensatz, rundung: rundungFuer(db, 'kunde', String(k.id)) }));
  const intern = INTERN.filter((i) => passt(i))
    .map((i) => ({ schluessel: i, satz: null, selbstkosten: Number(config.selbstkostenStunde) || 0 }));
  return { vorgaenge: v, projekte, kunden, intern };
}

// --- Rechnung ----------------------------------------------------------------
// Positionen aus Eintraegen. Gerechnet wird hier, rechnung.js uebernimmt nur.
const rund2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const GRUPPIERUNGEN = ['taetigkeit', 'eintrag'];
const MAX_EINTRAEGE = 500;

// Satz mit Herkunft fuer das Dokument: Basissatz und Rabatt stehen dort sichtbar.
// Gleiche Reihenfolge wie satzFuer(): Taetigkeit, Vorgang, Projekt, Standard.
function satzDetail(db, e) {
  const t = db.prepare('SELECT satz FROM taetigkeitsart WHERE name = ?').get(e.taetigkeit);
  if (t && t.satz != null) return { satz: t.satz, basissatz: t.satz, rabatt: 0 };
  const s = e.ziel_art === 'vorgang' ? metrics.satzFuerTicket(db, e.ziel_schluessel)
    : e.ziel_art === 'projekt' ? metrics.satzFuerProjekt(e.ziel_schluessel) : null;
  if (s) return { satz: s.satz, basissatz: s.basissatz, rabatt: s.rabatt };
  return { satz: config.stundensatz, basissatz: config.stundensatz, rabatt: 0 };
}

// Wie das Ziel auf einem Dokument heisst. Kunden ueber ihren heutigen Namen.
function zielText(db, e) {
  if (e.ziel_art === 'vorgang') return 'Vorgang ' + e.ziel_schluessel;
  if (e.ziel_art === 'kunde') {
    const k = kontakte.lade(db, Number(e.ziel_schluessel));
    return k ? k.firma : 'Kunde #' + e.ziel_schluessel;
  }
  return e.ziel_schluessel;
}

// Prueft die gewaehlten Eintraege, rechnet sie frisch (Logs koennen nach dem
// letzten Nachrechnen gekommen sein) und baut Positionen. Je Taetigkeit: eine
// Zeile je Ziel, Taetigkeit und Satz; je Eintrag: eine Zeile je Eintrag. Kulanz
// (Wahl "keins") als eigene Zeile mit Stunden und 0,00 EUR. `sperre` sagt
// schreibe(), welche Eintraege mit welchem Satz gesperrt werden.
// Betrag wie in der Auswertung: gezaehlte Stunden x Satz, gerundet je Position.
function fuerRechnung(db, ids, gruppierung) {
  if (ids === undefined || ids === null) return { positionen: [], sperre: [] };
  if (!Array.isArray(ids)) throw new Error('Einträge: Liste erwartet.');
  if (ids.length > MAX_EINTRAEGE) throw new Error('Höchstens 500 Einträge je Rechnung.');
  const g = gruppierung === undefined || gruppierung === null || gruppierung === '' ? 'taetigkeit' : gruppierung;
  if (!GRUPPIERUNGEN.includes(g)) throw new Error('Gruppierung: je Tätigkeit oder je Eintrag.');
  const gesehen = new Set();
  const geladen = [];
  for (const roh of ids) {
    const n = ganzzahl(roh);
    if (!Number.isInteger(n) || n <= 0) throw new Error('Eintrag nicht gefunden.');
    if (gesehen.has(n)) throw new Error('Eintrag #' + n + ' ist doppelt gewählt.');
    gesehen.add(n);
    const e = lade(db, n);
    if (!e) throw new Error('Eintrag #' + n + ' nicht gefunden.');
    if (e.status === 'abgerechnet') throw new Error('Eintrag #' + n + ' ist bereits abgerechnet (Rechnung ' + e.rechnung_nr + ').');
    if (e.ziel_art === 'intern') throw new Error('Interne Einträge gehören auf keine Rechnung.');
    if (!e.abrechenbar) throw new Error('Eintrag #' + n + ' ist nicht abrechenbar.');
    geladen.push(e);
  }
  // Erst alles pruefen, dann rechnen: Sitzungsabschnitte einmal je Tag,
  // Taetigkeiten und Rundung aus dem Cache.
  const fenster = fensterJeTag(db, geladen);
  const cache = cacheFuer(db);
  const liste = geladen.map((e) => {
    const r = rechne(db, e, e.id, fenster(e), cache);
    aktualisiere(db, e, r);
    // Ganz abgezogen: nichts zu stellen — gesperrt waere er sonst, ohne auf
    // dem Dokument zu stehen.
    if (!(r.gezaehlt_min > 0) && !(r.kulanz_min > 0)) throw new Error('Eintrag #' + e.id + ' hat nach dem Abzug keine abrechenbare Zeit.');
    const satzInfo = satzDetail(db, e);
    // Ein nicht lesbarer Satz ergaebe still eine 0-EUR-Position.
    if (!Number.isFinite(satzInfo.satz) || satzInfo.satz < 0) throw new Error('Eintrag #' + e.id + ': Satz nicht lesbar — Stundensatz in den Einstellungen prüfen.');
    return { ...e, ...gerechnet(r), satzInfo };
  });
  liste.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id));

  const gruppen = new Map();
  for (const e of liste) {
    if (!(e.gezaehlt_min > 0)) continue;   // ganz Kulanz: nur in der Kulanzzeile
    const k = g === 'eintrag' ? 'e' + e.id : [e.ziel_art, e.ziel_schluessel, e.taetigkeit, e.satzInfo.satz].join('\u0000');
    let p = gruppen.get(k);
    if (!p) { p = { e, min: 0, refs: [], tage: [] }; gruppen.set(k, p); }
    p.min += e.gezaehlt_min;
    p.refs.push(e.id);
    if (!p.tage.includes(e.tag)) p.tage.push(e.tag);
  }
  const positionen = [...gruppen.values()].map(({ e, min, refs, tage }) => {
    let bez = e.taetigkeit + ' – ' + zielText(db, e);
    if (g === 'eintrag' && e.notiz) bez += ': ' + e.notiz;
    const s = e.satzInfo;
    return {
      typ: 'zeit',
      // Nach Zeichen kuerzen, nicht nach UTF-16-Einheiten: ein halbes Emoji
      // stuende sonst unveraenderlich in der Abschrift.
      bezeichnung: Array.from(bez.replace(/\s+/g, ' ')).slice(0, 200).join(''),
      // Feld "ziel", nicht "ticket": abrechnung() zaehlt so nur Claude-Zeit als
      // Vorgangsabrechnung; manuelle Zeit gilt ueber die gesperrten Eintraege.
      ziel_art: e.ziel_art, ziel: e.ziel_schluessel, taetigkeit: e.taetigkeit,
      von: tage[0], bis: tage[tage.length - 1], tage,
      stunden: rund2(min / 60),
      basissatz: rund2(s.basissatz), rabatt_prozent: rund2(s.rabatt), satz: rund2(s.satz),
      betrag_eur: rund2((min / 60) * s.satz),
      refs,
    };
  });
  const kulanz = liste.filter((e) => e.kulanz_min > 0);
  if (kulanz.length) {
    const tage = [...new Set(kulanz.map((e) => e.tag))];
    positionen.push({
      typ: 'kulanz', bezeichnung: 'Kulanz – nicht berechnete Zeit',
      von: tage[0], bis: tage[tage.length - 1], tage,
      stunden: rund2(kulanz.reduce((a, e) => a + e.kulanz_min, 0) / 60),
      basissatz: 0, rabatt_prozent: 0, satz: 0, betrag_eur: 0,
      refs: kulanz.map((e) => e.id),
    });
  }
  return { positionen, sperre: liste.map((e) => ({ id: e.id, satz: e.satzInfo.satz, tag: e.tag })) };
}

// --- Ansichten: Woche, Monat, Ziele, Analyse -----------------------------------
// Tage sind UTC-Tage wie ueberall (activity.day, zeit_eintrag.tag). Arbeitszeit
// ist die Vereinigung aus Claude-Zeit (wie abgerechnet, ohne Werkzeugbetrieb)
// und manuellen Eintraegen: parallele Minuten zaehlen einmal.
const TAG_MS = 86400000;

function pruefeTag(w, label) {
  if (typeof w !== 'string' || !DATUM_RE.test(w) || new Date(w + 'T00:00:00Z').toISOString().slice(0, 10) !== w) {
    throw new Error(label + ': Datum JJJJ-MM-TT erwartet.');
  }
  return w;
}

function tagesListe(von, bis) {
  const out = [];
  for (let t = Date.parse(von + 'T00:00:00Z'); t <= Date.parse(bis + 'T00:00:00Z'); t += TAG_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

function tagessollMin() {
  const h = Number(config.tagessollStunden);
  return Math.round((Number.isFinite(h) && h >= 0 ? h : 8) * 60);
}

function sollMin(tag) {
  const wt = new Date(tag + 'T00:00:00Z').getUTCDay();
  return wt === 0 || wt === 6 ? 0 : tagessollMin();
}

// Zerlegt [a, b] an UTC-Mitternacht; legt jedes Stueck beim Tag ab, falls dieser gezeigt wird.
function jeTag(tage, a, b, ablegen) {
  for (let v = a; v < b;) {
    const ende = Math.min(b, (Math.floor(v / TAG_MS) + 1) * TAG_MS);
    const d = tage.get(new Date(v).toISOString().slice(0, 10));
    if (d) ablegen(d, v, ende);
    v = ende;
  }
}

// `jetzt`: der laufende Timer zaehlt bis hierhin in die Arbeitszeit.
function tagesDaten(db, von, bis, jetzt = Date.now()) {
  const tage = new Map(tagesListe(von, bis).map((t) => [t, { tag: t, claude: [], hand: [], fenster: [], eintraege: [] }]));
  for (const a of metrics.abrechenbareAbschnitte(db, { von, bis })) {
    if (metrics.isOverhead(a.project) || !(a.bis > a.von)) continue;
    jeTag(tage, a.von, a.bis, (d, v, b) => {
      d.claude.push([v, b]);
      d.fenster.push({ session_id: a.session, project: a.project, ticket: a.ticket || null, modell: a.modell || null, von: v, bis: b });
    });
  }
  const eintraege = db.prepare("SELECT * FROM zeit_eintrag WHERE tag >= date(?, '-1 day') AND tag <= ? ORDER BY start").all(von, bis);
  for (const e of eintraege) {
    if (tage.has(e.tag)) tage.get(e.tag).eintraege.push(e);
    // ponytail: die Pause hat keine Lage; fuer die Arbeitszeit liegt sie am Ende.
    const s = Date.parse(e.start);
    jeTag(tage, s, Math.max(s, Date.parse(e.ende) - e.pause_min * 60000), (d, v, b) => d.hand.push([v, b]));
  }
  const t = timerAktuell(db, jetzt);
  if (t) jeTag(tage, Date.parse(t.start), Math.max(Date.parse(t.start), jetzt), (d, v, b) => d.hand.push([v, b]));
  return [...tage.values()].map((d) => {
    // Fenster einer Sitzung, die sich beruehren, als ein Block.
    const fenster = [];
    for (const f of d.fenster.sort((x, y) => (x.session_id < y.session_id ? -1 : x.session_id > y.session_id ? 1 : x.von - y.von))) {
      const l = fenster[fenster.length - 1];
      if (l && l.session_id === f.session_id && f.von <= l.bis) l.bis = Math.max(l.bis, f.bis); else fenster.push({ ...f });
    }
    const claude = vereinige(d.claude);
    return {
      tag: d.tag,
      eintraege: d.eintraege,
      claude_fenster: fenster.sort((x, y) => x.von - y.von)
        .map((f) => ({ ...f, von: new Date(f.von).toISOString(), bis: new Date(f.bis).toISOString() })),
      claude_min: minuten(laenge(claude)),
      manuell_min: d.eintraege.reduce((a, e) => a + e.rohzeit_min, 0),
      arbeitszeit_min: minuten(laenge(vereinige([...claude, ...d.hand]))),
      soll_min: sollMin(d.tag),
    };
  });
}

const summeVon = (tage, k) => tage.reduce((a, t) => a + t[k], 0);

function woche(db, montag, jetzt = Date.now()) {
  if (typeof montag !== 'string' || !DATUM_RE.test(montag) || new Date(montag + 'T00:00:00Z').getUTCDay() !== 1) {
    throw new Error('Montag: Datum JJJJ-MM-TT eines Montags erwartet.');
  }
  const beginn = Date.parse(montag + 'T00:00:00Z');
  const tage = tagesDaten(db, montag, new Date(beginn + 6 * TAG_MS).toISOString().slice(0, 10), jetzt);
  // Termine (Kalender + lokal) je UTC-Tag, wie die Eintraege. Nur die Woche
  // braucht sie (Raster, Termin-Geister); Monat und Analyse bleiben schlank.
  // Gebucht nur, solange der Eintrag besteht: ein verschwundener (z. B. Rueckgaengig nach
  // dem Timer-Stopp) macht den Termin wieder buchbar, wie terminVon es auch sieht.
  const termine = db.prepare(`SELECT kalender_id, uid, titel, start, ende, ganztag, art, quelle, ziel_art, ziel_schluessel, ziel_von_hand,
      CASE WHEN EXISTS (SELECT 1 FROM zeit_eintrag e WHERE e.id = termin.gebucht_eintrag_id) THEN gebucht_eintrag_id END AS gebucht_eintrag_id, erinnern, google_offen
    FROM termin WHERE start < ? AND ende > ? ORDER BY start`).all(new Date(beginn + 7 * TAG_MS).toISOString(), new Date(beginn).toISOString());
  // Lazy: kalender.js zieht metrics, metrics zieht zeit.js.
  const { googleFehlt } = require('./kalender');
  for (const t of termine) t.google_fehlt = googleFehlt(t);
  for (const t of tage) {
    const a = new Date(Date.parse(t.tag + 'T00:00:00Z')).toISOString();
    const b = new Date(Date.parse(t.tag + 'T00:00:00Z') + TAG_MS).toISOString();
    t.termine = termine.filter((x) => x.start < b && x.ende > a);
  }
  return {
    montag, tage,
    summe: Object.fromEntries(['claude_min', 'manuell_min', 'arbeitszeit_min', 'soll_min'].map((k) => [k, summeVon(tage, k)])),
  };
}

// Workload der naechsten 7 Tage ab heute (UTC-Tag wie ueberall): Meetings und
// Blocker gegen das Tagessoll. Je Tag vereinigt, damit sich ueberlappende
// Termine nicht doppelt zaehlen; was ein Meeting schon belegt, zaehlt nicht
// noch einmal als Blocker. Kapazitaet = Soll der Werktage. Ueberbucht ist ein
// Tag ueber dem Tagessoll — auch am Wochenende, wo das Soll 0 ist, sonst waere
// dort jede Stunde schon "ueberbucht".
// ponytail: ganztaegige Termine (Urlaub, Feiertag) zaehlen nicht und senken die
// Kapazitaet nicht; braucht eine Art "abwesend", wenn das stoert.
function workload(db, jetzt = Date.now()) {
  const a = Math.floor(jetzt / TAG_MS) * TAG_MS;
  const b = a + 7 * TAG_MS;
  const von = new Date(a).toISOString().slice(0, 10);
  const bis = new Date(b - TAG_MS).toISOString().slice(0, 10);
  const tage = new Map(tagesListe(von, bis).map((t) => [t, { tag: t, meeting: [], alle: [] }]));
  const termine = db.prepare(`SELECT art, start, ende FROM termin WHERE art IN ('meeting', 'blocker') AND ganztag = 0
    AND start < ? AND ende > ?`).all(new Date(b).toISOString(), new Date(a).toISOString());
  for (const t of termine) {
    jeTag(tage, Math.max(a, Date.parse(t.start)), Math.min(b, Date.parse(t.ende)), (d, v, e) => {
      d.alle.push([v, e]);
      if (t.art === 'meeting') d.meeting.push([v, e]);
    });
  }
  const grenze = tagessollMin();
  const zeilen = [...tage.values()].map((d) => {
    const belegt = minuten(laenge(vereinige(d.alle)));
    const meeting = minuten(laenge(vereinige(d.meeting)));
    return { tag: d.tag, meeting_min: meeting, blocker_min: belegt - meeting, belegt_min: belegt,
      soll_min: sollMin(d.tag), ueber_min: Math.max(0, belegt - grenze) };
  });
  const belegt = summeVon(zeilen, 'belegt_min');
  const kapazitaet = summeVon(zeilen, 'soll_min');
  // Restkapazitaet heute (Live „Du“): Soll − Arbeitszeit − was an Terminen heute noch
  // ansteht (ab jetzt, vereinigt). Vergangene Termine stecken schon in der Arbeitszeit
  // oder sind vorbei. Nie unter 0.
  const h = tage.get(von);
  const rest = h.alle.map(([v, e]) => [Math.max(v, jetzt), e]).filter(([v, e]) => e > v);
  const t0 = tagesDaten(db, von, von, jetzt)[0];
  const heute = { tag: von, soll_min: t0.soll_min, arbeitszeit_min: t0.arbeitszeit_min, termine_rest_min: minuten(laenge(vereinige(rest))) };
  heute.rest_min = Math.max(0, heute.soll_min - heute.arbeitszeit_min - heute.termine_rest_min);
  return {
    von, bis, tage: zeilen, heute,
    summe: {
      meeting_min: summeVon(zeilen, 'meeting_min'),
      blocker_min: summeVon(zeilen, 'blocker_min'),
      belegt_min: belegt,
      kapazitaet_min: kapazitaet,
      frei_min: Math.max(0, kapazitaet - belegt),
      ueberbucht_tage: zeilen.filter((z) => z.ueber_min > 0).length,
      auslastung: kapazitaet > 0 ? belegt / kapazitaet : null,
    },
  };
}

function zeitraum({ from, to } = {}, maxTage) {
  pruefeTag(from, 'from');
  pruefeTag(to, 'to');
  if (to < from) throw new Error('Zeitraum: to liegt vor from.');
  if ((Date.parse(to) - Date.parse(from)) / TAG_MS + 1 > maxTage) throw new Error('Zeitraum: höchstens ' + maxTage + ' Tage.');
  return { from, to };
}

function monat(db, opts) {
  const { from, to } = zeitraum(opts, 62);
  const tage = tagesDaten(db, from, to).map(({ eintraege, claude_fenster, ...t }) => ({ ...t, abweichung_min: t.arbeitszeit_min - t.soll_min }));
  const mitSoll = tage.filter((t) => t.soll_min > 0);
  return {
    tage,
    summe: {
      arbeitszeit_min: summeVon(tage, 'arbeitszeit_min'),
      soll_min: summeVon(tage, 'soll_min'),
      saldo_min: summeVon(tage, 'arbeitszeit_min') - summeVon(tage, 'soll_min'),
      soll_tage: mitSoll.length,
      soll_erfuellt_tage: mitSoll.filter((t) => t.arbeitszeit_min >= t.soll_min).length,
    },
  };
}

// Je Ziel: Eintraege, gezaehlte Minuten offen/abgerechnet, offener Betrag.
function zieleTabelle(db, opts) {
  const { from, to } = zeitraum(opts, 400);
  const je = new Map();
  for (const e of imRahmen(db, { from, to })) {
    const k = e.ziel_art + '\u0000' + e.ziel_schluessel;
    let z = je.get(k);
    if (!z) {
      z = { ziel_art: e.ziel_art, ziel_schluessel: e.ziel_schluessel, name: zielText(db, e), projekt: e.projekt,
        eintraege: 0, manuell_min: 0, offen_min: 0, abgerechnet_min: 0, offen_eur: 0 };
      je.set(k, z);
    }
    z.eintraege += 1;
    z.manuell_min += e.gezaehlt_min;
    if (e.status === 'abgerechnet') z.abgerechnet_min += e.gezaehlt_min;
    else if (e.abrechenbar) { z.offen_min += e.gezaehlt_min; z.offen_eur += e.eur; }
  }
  return [...je.values()].map((z) => ({
    ...z,
    status: z.ziel_art === 'intern' ? 'intern' : z.offen_min > 0 ? 'offen' : z.abgerechnet_min > 0 ? 'abgerechnet' : 'nicht abrechenbar',
  })).sort((a, b) => b.offen_eur - a.offen_eur || a.name.localeCompare(b.name));
}

function analyse(db, opts) {
  const { from, to } = zeitraum(opts, 400);
  const tage = tagesDaten(db, from, to);
  const eintraege = imRahmen(db, { from, to });
  const abrechenbar = (e) => e.abrechenbar && e.ziel_art !== 'intern';
  const manuell = eintraege.filter(abrechenbar).reduce((a, e) => a + e.gezaehlt_min, 0) / 60;
  const claude = summeVon(tage, 'claude_min') / 60;
  const montagVon = (tag) => {
    const wt = (new Date(tag + 'T00:00:00Z').getUTCDay() + 6) % 7;
    return new Date(Date.parse(tag + 'T00:00:00Z') - wt * TAG_MS).toISOString().slice(0, 10);
  };
  // Je Woche: Arbeitszeit (Parallelzeit einmal) neben dem Abrechenbaren aus Claude und manueller Zeit.
  const wochen = new Map();
  const woche = (montag) => {
    if (!wochen.has(montag)) wochen.set(montag, { montag, ist_min: 0, soll_min: 0, claude_min: 0, manuell_min: 0 });
    return wochen.get(montag);
  };
  for (const t of tage) {
    const w = woche(montagVon(t.tag));
    w.ist_min += t.arbeitszeit_min;
    w.soll_min += t.soll_min;
    w.claude_min += t.claude_min;
  }
  for (const e of eintraege.filter(abrechenbar)) woche(montagVon(e.tag)).manuell_min += e.gezaehlt_min;
  const taet = new Map();
  for (const e of eintraege) {
    const t = taet.get(e.taetigkeit) || { min: 0, eur: 0 };
    t.min += e.gezaehlt_min;
    t.eur += e.eur;
    taet.set(e.taetigkeit, t);
  }
  return {
    kpis: {
      abrechenbar_stunden: claude + manuell,
      claude_stunden: claude,
      manuell_stunden: manuell,
      manuell_anteil: claude + manuell > 0 ? manuell / (claude + manuell) : 0,
      parallel_min: eintraege.reduce((a, e) => a + (e.parallel_min || 0), 0),
      kulanz_min: eintraege.reduce((a, e) => a + (e.kulanz_min || 0), 0),
      arbeitszeit_stunden: summeVon(tage, 'arbeitszeit_min') / 60,
      soll_stunden: summeVon(tage, 'soll_min') / 60,
    },
    wochen: [...wochen.values()].sort((a, b) => a.montag.localeCompare(b.montag)).map((w) => ({
      montag: w.montag, ist_stunden: w.ist_min / 60, soll_stunden: w.soll_min / 60,
      claude_stunden: w.claude_min / 60, manuell_stunden: w.manuell_min / 60,
    })),
    taetigkeiten: [...taet].map(([name, t]) => ({ name, min: t.min, eur: t.eur })).sort((a, b) => b.min - a.min),
  };
}

module.exports = {
  ZIELARTEN, INTERN,
  fuerRechnung, satzDetail, woche, monat, zieleTabelle, analyse, workload,
  speichere, vorschau, loesche, lade, liste, imRahmen, gruppiere, kennzahlenZusatz,
  WAHLEN, ueberlappung, waehle, ueberlappungVon, nachrechnen, sitzungsAbzuege, ueberlappungenJeSitzung,
  rundungFuer, satzFuer,
  timerAktuell, timerStart, timerStop, timerVerwerfen, timerVorschau, timerWahl, timerZurueck,
  taetigkeiten, setzeTaetigkeit, loescheTaetigkeit,
  ziele,
};
