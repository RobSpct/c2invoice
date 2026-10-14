'use strict';
// Kalender lesen: ICS-Adresse (Google "Privatadresse im iCal-Format", Outlook,
// Apple, beliebiger Abo-Link) oder CalDAV mit Basic Auth (Apple, Nextcloud,
// Fastmail). Ohne Abhaengigkeiten, nur lesend. Zugaenge stehen ausschliesslich
// in config.json (Projektregel: eine geheime ICS-Adresse ist ein Zugang) und
// verlassen den Server nie — der Status nennt nur den Host.
//
// Termine landen in der Tabelle termin, eine Serie je Vorkommen im Horizont
// [heute - 7, heute + 28 Tage]. Lokal angelegte Termine (kalender_id 'lokal')
// fasst der Abgleich nicht an.
//
// Feeds sind fremde Eingaben: jede Einladung eines Dritten landet im Kalender.
// Deshalb Grenzen fuer Groesse, Zeit, Dauer, Jahr und Schritte, und ein kaputter
// Termin ueberspringt nur sich selbst.
const crypto = require('node:crypto');
const config = require('./config.json');
const { getMeta, setMeta } = require('./db');
const metrics = require('./metrics');
const kontakte = require('./kontakte');

const TAG_MS = 86400000;
const HORIZONT_TAGE = { vor: 7, nach: 28 };
const TAKT_MS = 5 * 60000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EVENTS = 50000;
const MAX_VORKOMMEN = 20000;
const MAX_SCHRITTE = 20000;
const MAX_DAUER_MS = 366 * TAG_MS;
const OHNE_ENDE_MS = 15 * 60000;
const ZIEL_ARTEN = ['vorgang', 'projekt', 'kunde', 'intern'];

// Eigene Fehler: ihr Text darf in Status und Oberflaeche. Alles andere wird dort
// zu einem allgemeinen Hinweis und landet mit Stack im Serverprotokoll.
class KalenderFehler extends Error {}
const fehl = (m) => new KalenderFehler(m);

// Vorgangsschluessel nur als ganzes Wort (nicht "GHIJ-12" in "ABCDEFGHIJ-12").
const TICKET_QUELLE = config.ticketRegex || '([A-Z][A-Z0-9]{1,9}-\\d+)';
const TICKET_RE = (() => {
  try { return new RegExp('(?<![\\p{L}\\p{N}_-])(?:' + TICKET_QUELLE + ')(?![\\p{L}\\p{N}_])', 'gu'); } catch { return new RegExp(TICKET_QUELLE, 'g'); }
})();

// --- ICS lesen ----------------------------------------------------------------
// Zeilen entfalten: eine Folgezeile beginnt mit einem Leerzeichen oder Tab,
// das genau einmal wegfaellt (RFC 5545, 3.1).
function entfalte(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

// NAME;PARAM=x;PARAM="a:b":WERT — ein Doppelpunkt in Anfuehrungszeichen gehoert zum Parameter.
function zerlege(l) {
  let q = false;
  let i = 0;
  for (; i < l.length; i++) {
    if (l[i] === '"') q = !q;
    else if (l[i] === ':' && !q) break;
  }
  if (i >= l.length) return null;
  const [name, ...teile] = l.slice(0, i).split(';');
  const params = {};
  for (const p of teile) {
    const j = p.indexOf('=');
    if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, wert: l.slice(i + 1) };
}

// TEXT entschluesseln; Steuer- und Bidi-Zeichen raus (der Titel geht in die Oberflaeche).
const rein = (s) => s.replace(/[\x00-\x1f\x7f\u{202A}-\u{202E}\u{2066}-\u{2069}]/gu, ' ').replace(/\s+/g, ' ').trim();
const text = (w) => rein(w.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c)));

// Zeitpunkt in ms. Datum ohne Uhrzeit = ganztaegig (UTC-Mitternacht wie der
// UTC-Tag der Zeiterfassung). "Z" = UTC, sonst Ortszeit des Servers. Jahre
// ausserhalb 1900–2199 und Unsinn wie der 45. Dezember gelten als unlesbar.
// ponytail: TZID ignoriert, Server = Nutzer-Zeitzone; VTIMEZONE auswerten, wenn Kalender aus fremden Zonen kommen.
function zeitpunkt(wert, params = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(wert).trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4] || 0, m[5] || 0, m[6] || 0].map(Number);
  if (y < 1900 || y > 2199 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
  if (m[4] === undefined || params.VALUE === 'DATE') return { ms: Date.UTC(y, mo - 1, d), ganztag: true, utc: true };
  if (m[7]) return { ms: Date.UTC(y, mo - 1, d, h, mi, s), ganztag: false, utc: true };
  return { ms: new Date(y, mo - 1, d, h, mi, s).getTime(), ganztag: false, utc: false };
}

function dauerMs(w) {
  const m = /^([+-])?P(?:(\d{1,6})W)?(?:(\d{1,6})D)?(?:T(?:(\d{1,7})H)?(?:(\d{1,9})M)?(?:(\d{1,10})S)?)?$/.exec(String(w).trim());
  if (!m) return NaN;
  const ms = ((+m[2] || 0) * 7 * 86400 + (+m[3] || 0) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

const WOCHENTAG = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function regel(wert) {
  const r = {};
  for (const teil of String(wert).split(';')) {
    const [k, v] = teil.split('=');
    if (k && v !== undefined) r[k.trim().toUpperCase()] = v.trim();
  }
  const until = r.UNTIL ? zeitpunkt(r.UNTIL) : null;
  const tage = r.BYDAY ? [...new Set(r.BYDAY.split(',').map((x) => WOCHENTAG[x.trim().slice(-2).toUpperCase()]).filter((x) => x !== undefined))] : [];
  return {
    freq: (r.FREQ || '').toUpperCase(),
    interval: Math.min(10000, Math.max(1, parseInt(r.INTERVAL, 10) || 1)),
    count: r.COUNT ? Math.max(0, parseInt(r.COUNT, 10) || 0) : null,
    // UNTIL als Datum schliesst den ganzen Tag ein.
    until: until ? (until.ganztag ? until.ms + TAG_MS - 1 : until.ms) : null,
    byday: tage.length ? tage : null,
  };
}

// Ein VEVENT fertig machen; null = verwerfen (ohne UID, ohne lesbaren Beginn,
// laenger als ein Jahr). Ohne Ende (RFC: Dauer 0) 15 Minuten, damit Woche und
// Abgleich ihn ueberhaupt sehen.
function abschliessen(a) {
  if (!a.uid || !a.dtstart) return null;
  const start = a.dtstart.ms;
  let ende = a.dtend ? a.dtend.ms : a.dauer !== undefined ? start + a.dauer : a.dtstart.ganztag ? start + TAG_MS : start;
  if (!Number.isFinite(start) || !Number.isFinite(ende) || ende - start > MAX_DAUER_MS) return null;
  if (ende < start) ende = start;
  if (ende === start && !a.dtstart.ganztag) ende = start + OHNE_ENDE_MS;
  const titel = (a.titel || '(ohne Titel)').slice(0, 200);
  return {
    uid: a.uid.slice(0, 250), titel, start, ende, ganztag: a.dtstart.ganztag, utc: a.dtstart.utc,
    rrule: a.rrule || null, exdate: a.exdate, rid: a.rid || null,
    abgesagt: a.status === 'CANCELLED',
    art: /\b(blocker|fokus)\b/i.test(titel + ' ' + a.kategorien) ? 'blocker' : 'meeting',
  };
}

// Liest die VEVENTs eines Kalenders. Verschachtelte Komponenten (VALARM)
// werden uebersprungen, damit deren SUMMARY nicht den Termin ueberschreibt.
// Ergebnis: Liste der Termine, .verworfen = Zahl der unlesbaren.
function parseIcs(roh) {
  const ev = [];
  let verworfen = 0;
  let akt = null;
  let tiefe = 0;
  for (const l of entfalte(roh)) {
    const z = l && zerlege(l);
    if (!z) continue;
    if (z.name === 'BEGIN') {
      if (akt) tiefe++;
      else if (z.wert.trim().toUpperCase() === 'VEVENT') akt = { exdate: [], kategorien: '' };
      continue;
    }
    if (z.name === 'END') {
      if (!akt) continue;
      if (tiefe) { tiefe--; continue; }
      const e = abschliessen(akt);
      if (e) ev.push(e); else verworfen++;
      if (ev.length > MAX_EVENTS) throw fehl('Mehr als ' + MAX_EVENTS + ' Termine im Kalender.');
      akt = null;
      continue;
    }
    if (!akt || tiefe) continue;
    if (z.name === 'UID') akt.uid = z.wert.trim();
    else if (z.name === 'SUMMARY') akt.titel = text(z.wert);
    else if (z.name === 'DTSTART') akt.dtstart = zeitpunkt(z.wert, z.params);
    else if (z.name === 'DTEND') akt.dtend = zeitpunkt(z.wert, z.params);
    else if (z.name === 'DURATION') akt.dauer = dauerMs(z.wert);
    else if (z.name === 'RRULE') akt.rrule = regel(z.wert);
    else if (z.name === 'EXDATE') for (const w of z.wert.split(',')) { const t = zeitpunkt(w, z.params); if (t) akt.exdate.push(t); }
    // ponytail: RANGE=THISANDFUTURE wie eine einzelne Ausnahme; Apple nutzt es selten.
    else if (z.name === 'RECURRENCE-ID') akt.rid = zeitpunkt(z.wert, z.params);
    else if (z.name === 'STATUS') akt.status = z.wert.trim().toUpperCase();
    else if (z.name === 'CATEGORIES') akt.kategorien += ' ' + text(z.wert);
  }
  ev.verworfen = verworfen;
  return ev;
}

// Eine Antwort, die kein Kalender ist (Login-Seite mit HTTP 200, abgelaufener
// Link), ist ein Fehler — sonst gaelte sie als leerer Kalender und der Abgleich
// loeschte alle Termine.
function alsIcs(text) {
  if (!/^\s*BEGIN:VCALENDAR/i.test(String(text).replace(/^\u{FEFF}/u, ''))) throw fehl('Antwort ist kein Kalender (kein BEGIN:VCALENDAR) — Adresse prüfen.');
  return parseIcs(text);
}

// --- Serien ausrollen -----------------------------------------------------------
// Tage addieren: UTC-Termine in UTC, Ortszeit-Termine in Ortszeit (Sommerzeit
// verschiebt die Uhrzeit sonst um eine Stunde).
function plusTage(ms, n, utc) {
  if (utc) return ms + n * TAG_MS;
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}
const wochentag = (ms, utc) => (utc ? new Date(ms).getUTCDay() : new Date(ms).getDay());
const zwei = (n) => String(n).padStart(2, '0');
// Kalendertag eines Zeitpunkts in der Zone des Termins (Schluessel fuer uid und EXDATE).
const tagVon = (ms, utc) => {
  const d = new Date(ms);
  return utc ? d.toISOString().slice(0, 10) : d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
};

// Beginnzeiten einer Serie, die vor `bis` liegen (ab kurz vor `von`). Nur DAILY
// und WEEKLY (Plan A5); andere FREQ ergeben das erste Vorkommen und gelten als
// ignoriert. COUNT zaehlt vor EXDATE (RFC 5545), der Aufrufer filtert danach.
// Ohne COUNT springt die Schleife direkt vor den Horizont: eine Tagesserie von
// 1990 kostet sonst bei jedem Abgleich 13 000 Schritte.
// ponytail: WKST ignoriert (Montag), DTSTART ausserhalb von BYDAY zaehlt nicht als erstes Vorkommen.
function beginnzeiten(e, von, bis) {
  const r = e.rrule;
  if (!r) return { zeiten: [e.start], ignoriert: false };
  if (r.freq !== 'DAILY' && r.freq !== 'WEEKLY') return { zeiten: [e.start], ignoriert: true };
  const zeiten = [];
  let n = 0;
  const vorbei = (s) => s >= bis || (r.until != null && s > r.until);
  const voll = () => r.count != null && n >= r.count;
  if (r.freq === 'DAILY') {
    const filter = r.byday ? new Set(r.byday) : null;
    let k = r.count == null && von > e.start ? Math.max(0, Math.floor((von - e.start) / (r.interval * TAG_MS)) - 2) : 0;
    for (let i = 0; i < MAX_SCHRITTE; i++, k++) {
      const s = plusTage(e.start, k * r.interval, e.utc);
      if (vorbei(s)) break;
      if (filter && !filter.has(wochentag(s, e.utc))) continue;
      if (voll()) break;
      zeiten.push(s);
      n++;
    }
  } else {
    const tage = (r.byday || [wochentag(e.start, e.utc)]).map((d) => (d + 6) % 7).sort((a, b) => a - b);
    const montag = plusTage(e.start, -((wochentag(e.start, e.utc) + 6) % 7), e.utc);
    let k = r.count == null && von > montag ? Math.max(0, Math.floor((von - montag) / (7 * r.interval * TAG_MS)) - 1) : 0;
    aussen: for (let i = 0; i < MAX_SCHRITTE; i++, k++) {
      const woche = plusTage(montag, k * 7 * r.interval, e.utc);
      for (const t of tage) {
        const s = plusTage(woche, t, e.utc);
        if (s < e.start) continue;
        if (vorbei(s) || voll()) break aussen;
        zeiten.push(s);
        n++;
      }
    }
  }
  return { zeiten, ignoriert: false };
}

const iso = (ms) => new Date(ms).toISOString();

// Alle Vorkommen in [von, bis), nach Beginn sortiert. uid einer Serie =
// "<UID>#<Tag>": eine verschobene Uhrzeit ("alle Termine 10 statt 9 Uhr")
// behaelt so ihre Zeile und deren Zuordnung von Hand. Eine Ausnahme
// (RECURRENCE-ID) ersetzt das Vorkommen ihrer Serie; abgesagte fallen weg.
// Ergebnis traegt .ignoriert (Serien mit nicht unterstuetzter Regel, auch
// ausserhalb des Horizonts) und .verworfen (Termine, die nicht auszurollen waren).
function vorkommen(events, von, bis) {
  const ausnahmen = new Map();
  for (const e of events) if (e.rid) (ausnahmen.get(e.uid) || ausnahmen.set(e.uid, new Set()).get(e.uid)).add(e.rid.ms);
  const out = [];
  let ignoriert = 0;
  let verworfen = 0;
  const nimm = (e, uid, start, ende, ign) => {
    if (!(start < bis && ende > von)) return;
    out.push({ uid, titel: e.titel, start: iso(start), ende: iso(ende), ganztag: e.ganztag ? 1 : 0, art: e.art, rrule_ignoriert: ign });
    if (out.length > MAX_VORKOMMEN) throw fehl('Mehr als ' + MAX_VORKOMMEN + ' Termine im Zeitraum — Kalender nicht übernommen.');
  };
  for (const e of events) {
    try {
      if (e.rid) {
        if (!e.abgesagt) nimm(e, e.uid + '#' + tagVon(e.rid.ms, e.rid.utc), e.start, e.ende, false);
        continue;
      }
      if (e.abgesagt) continue;
      const { zeiten, ignoriert: ign } = beginnzeiten(e, von, bis);
      if (ign) ignoriert++;
      const exMs = new Set([...e.exdate.filter((x) => !x.ganztag).map((x) => x.ms), ...(ausnahmen.get(e.uid) || [])]);
      const exTag = new Set(e.exdate.filter((x) => x.ganztag).map((x) => tagVon(x.ms, true)));
      const serie = e.rrule && !ign;
      for (const s of zeiten) {
        if (exMs.has(s) || exTag.has(tagVon(s, e.utc))) continue;
        nimm(e, serie ? e.uid + '#' + tagVon(s, e.utc) : e.uid, s, s + (e.ende - e.start), ign);
      }
    } catch (err) {
      if (err instanceof KalenderFehler) throw err;
      verworfen++;
    }
  }
  out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  out.ignoriert = ignoriert;
  out.verworfen = verworfen + (events.verworfen || 0);
  return out;
}

// --- Ziel raten -----------------------------------------------------------------
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alsWort = (name) => new RegExp('(^|[^\\p{L}\\p{N}])' + escRe(name) + '($|[^\\p{L}\\p{N}])', 'iu');
const vorbereitet = new WeakMap();
function vorbereiten(ctx) {
  let v = vorbereitet.get(ctx);
  if (!v) {
    v = {
      projekte: [...(ctx.projekte || [])].filter(Boolean).sort((a, b) => b.length - a.length).map((n) => [n, alsWort(n)]),
      kunden: [...(ctx.kunden || [])].filter((k) => k && k.firma).sort((a, b) => b.firma.length - a.firma.length).map((k) => [String(k.id), alsWort(k.firma)]),
    };
    vorbereitet.set(ctx, v);
  }
  return v;
}

// Vorgang per ticketRegex als ganzes Wort — mit ctx.tickets nur bekannte
// Vorgaenge ("Q3-2026", "UTF-8" sind keine). Sonst der laengste Projekt- bzw.
// Kundenname als ganzes Wort. Der Titel kommt von Dritten (Einladungen): das
// Ergebnis ist ein Vorschlag, gebucht wird daraus nur mit Bestaetigung.
function rateZiel(titel, ctx = {}) {
  const t = String(titel || '');
  TICKET_RE.lastIndex = 0;
  for (const m of t.matchAll(TICKET_RE)) {
    const k = m[1] || m[0];
    if (!ctx.tickets || ctx.tickets.has(k)) return { ziel_art: 'vorgang', ziel_schluessel: k };
  }
  const v = vorbereiten(ctx);
  const p = v.projekte.find(([, re]) => re.test(t));
  if (p) return { ziel_art: 'projekt', ziel_schluessel: p[0] };
  const k = v.kunden.find(([, re]) => re.test(t));
  if (k) return { ziel_art: 'kunde', ziel_schluessel: k[0] };
  return null;
}

function kontext(db) {
  const projekte = new Set(db.prepare("SELECT DISTINCT project FROM events WHERE project NOT IN ('(unbekannt)', '(lokal)')").all()
    .map((r) => r.project).filter((p) => p && !metrics.isOverhead(p)));
  for (const p of Object.keys(config.projektSaetze || {})) projekte.add(p);
  const tickets = new Set(db.prepare(`SELECT DISTINCT ticket AS k FROM events WHERE ticket IS NOT NULL
    UNION SELECT DISTINCT ziel_schluessel FROM zeit_eintrag WHERE ziel_art = 'vorgang'`).all().map((r) => r.k));
  return { tickets, projekte: [...projekte], kunden: db.prepare('SELECT id, firma FROM kontakte').all() };
}

// --- Konten aus config.json -----------------------------------------------------
// Fehlertexte nennen Nummer und id, nie die Adresse (sie ist ein Zugang).
function konten(liste) {
  if (liste === undefined || liste === null) return { gueltig: [], fehler: [] };
  if (!Array.isArray(liste)) return { gueltig: [], fehler: ['kalender in config.json ist keine Liste.'] };
  const gueltig = [];
  const fehler = [];
  const ids = new Set();
  liste.forEach((k, i) => {
    const wer = 'Kalender ' + (i + 1) + (k && typeof k.id === 'string' ? ' (' + k.id.slice(0, 40) + ')' : '');
    if (!k || typeof k !== 'object' || Array.isArray(k)) return fehler.push(wer + ': Eintrag ist kein Objekt.');
    if (typeof k.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(k.id) || k.id === 'lokal') return fehler.push(wer + ': id aus a–z, 0–9, - und _ (höchstens 40 Zeichen, nicht „lokal“).');
    if (ids.has(k.id)) return fehler.push(wer + ': id doppelt.');
    if (k.art !== 'ics' && k.art !== 'caldav') return fehler.push(wer + ': art ist ics oder caldav.');
    let url;
    try { url = new URL(String(k.url || '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch { return fehler.push(wer + ': url fehlt oder ist keine Adresse.'); }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && k.art === 'ics')) {
      return fehler.push(wer + (k.art === 'caldav' ? ': CalDAV nur über https (Passwort im Klartext).' : ': url muss mit https:// oder webcal:// beginnen.'));
    }
    if (k.passwortEnvVar != null && (typeof k.passwortEnvVar !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k.passwortEnvVar))) return fehler.push(wer + ': passwortEnvVar ist der Name einer Umgebungsvariable.');
    if (k.benutzer != null && (typeof k.benutzer !== 'string' || k.benutzer.length > 200)) return fehler.push(wer + ': benutzer ist ein Text.');
    if (k.art === 'ics' && (k.benutzer || k.passwortEnvVar)) return fehler.push(wer + ': benutzer/passwortEnvVar gibt es nur bei caldav — ein ICS-Link trägt seinen Zugang in der Adresse.');
    ids.add(k.id);
    gueltig.push({ id: k.id, name: typeof k.name === 'string' && k.name.trim() ? k.name.trim().slice(0, 80) : k.id, art: k.art, url: url.href,
      benutzer: k.benutzer || null, passwortEnvVar: k.passwortEnvVar || null });
  });
  return { gueltig, fehler };
}

const KONTEN = konten(config.kalender);
for (const f of KONTEN.fehler) console.warn('Warnung: ' + f + ' Dieser Kalender wird nicht abgeglichen.');

// --- Holen ----------------------------------------------------------------------
const zeitIcs = (ms) => iso(ms).replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const xmlText = (s) => s.replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]{1,6});/gi, (_, h) => zeichen(parseInt(h, 16))).replace(/&#(\d{1,7});/g, (_, n) => zeichen(+n)).replace(/&amp;/g, '&');
const zeichen = (n) => (n <= 0x10ffff ? String.fromCodePoint(n) : '');

// calendar-data-Bloecke einer CalDAV-Antwort. Linear: jedes Element wird einmal
// gelesen, ein offenes ohne Ende beendet die Suche (kein quadratischer Lauf),
// ein selbstschliessendes (Ressource ohne Daten) wird uebersprungen.
function calendarData(xml) {
  const out = [];
  const re = /<((?:[\w-]+:)?calendar-data)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(xml))) {
    if (m[2].trim().endsWith('/')) continue;
    const zu = '</' + m[1] + '>';
    const ende = xml.indexOf(zu, re.lastIndex);
    if (ende < 0) break;
    out.push(xmlText(xml.slice(re.lastIndex, ende)));
    re.lastIndex = ende + zu.length;
  }
  return out;
}

// Body lesen mit Grenze waehrend des Lesens (Content-Length fehlt bei chunked,
// ein gepackter Body waechst beim Entpacken).
async function lies(r) {
  if (!r.body) return '';
  const leser = r.body.getReader();
  const teile = [];
  let n = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    n += value.byteLength;
    if (n > MAX_BYTES) { await leser.cancel().catch(() => {}); throw fehl('Kalender größer als 5 MB.'); }
    teile.push(value);
  }
  return Buffer.concat(teile).toString('utf8');
}
const verwerfe = (r) => (r.body ? r.body.cancel().catch(() => {}) : undefined);

function horizont(jetzt) {
  const d = new Date(jetzt);
  const heute = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return { von: heute - HORIZONT_TAGE.vor * TAG_MS, bis: heute + (HORIZONT_TAGE.nach + 1) * TAG_MS };
}

async function hole(konto, jetzt = Date.now()) {
  const signal = AbortSignal.timeout(20000);
  if (konto.art === 'ics') {
    // Weiterleitungen von Hand: hoechstens 3, und nie von https auf http.
    let url = konto.url;
    for (let hop = 0; hop <= 3; hop++) {
      const r = await fetch(url, { signal, redirect: 'manual', headers: { accept: 'text/calendar, */*', 'accept-encoding': 'identity' } });
      const ziel = r.status >= 300 && r.status < 400 && r.headers.get('location');
      if (ziel) {
        await verwerfe(r);
        const naechste = new URL(ziel, url);
        if (naechste.protocol !== 'https:' && !(naechste.protocol === 'http:' && new URL(url).protocol === 'http:')) throw fehl('Weiterleitung auf eine unsichere Adresse abgelehnt.');
        url = naechste.href;
        continue;
      }
      if (!r.ok) { await verwerfe(r); throw fehl('HTTP ' + r.status); }
      return alsIcs(await lies(r));
    }
    throw fehl('Zu viele Weiterleitungen.');
  }
  // CalDAV: ein REPORT calendar-query auf die Kalender-Collection (die URL ist
  // die Collection, kein PROPFIND), Zeitfenster = Horizont. Keine Weiterleitung:
  // das Passwort ginge sonst an einen anderen Host.
  const headers = { depth: '1', 'content-type': 'application/xml; charset=utf-8', 'accept-encoding': 'identity' };
  if (konto.benutzer) {
    const pw = konto.passwortEnvVar ? process.env[konto.passwortEnvVar] : undefined;
    if (pw === undefined) throw fehl('Passwort fehlt: die in passwortEnvVar genannte Umgebungsvariable ist nicht gesetzt.');
    headers.authorization = 'Basic ' + Buffer.from(konto.benutzer + ':' + pw).toString('base64');
  }
  const { von, bis } = horizont(jetzt);
  const body = '<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    '<d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
    '<c:time-range start="' + zeitIcs(von) + '" end="' + zeitIcs(bis) + '"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>';
  const r = await fetch(konto.url, { method: 'REPORT', headers, body, signal, redirect: 'manual' });
  if (r.status === 401 || r.status === 403) { await verwerfe(r); throw fehl('Anmeldung abgelehnt (HTTP ' + r.status + ').'); }
  if (r.status !== 207) { await verwerfe(r); throw fehl('HTTP ' + r.status + (r.status >= 300 && r.status < 400 ? ' (Weiterleitung — url der Kalender-Sammlung eintragen)' : '')); }
  const xml = await lies(r);
  if (!/<(?:[\w-]+:)?multistatus\b/i.test(xml)) throw fehl('Antwort ist keine CalDAV-Antwort (kein multistatus).');
  return calendarData(xml).flatMap((b) => parseIcs(b));
}

// Fehlertext fuer Status und Oberflaeche: nur eigene Texte, nie eine Adresse.
function meldung(err, konto) {
  if (err instanceof KalenderFehler) return err.message;
  if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) return 'Zeitüberschreitung (20 s).';
  if (err && err.cause && typeof err.cause.code === 'string') return 'nicht erreichbar (' + err.cause.code + ').';
  console.error('Kalender ' + (konto ? konto.id : '?') + ': Abgleich fehlgeschlagen:', err);
  return 'Abgleich fehlgeschlagen (Details im Serverprotokoll).';
}

// Verschobener Termin: Erinnerung und Hinweis zum alten Beginn verfallen, zur
// neuen Zeit wird wieder erinnert. In SET sieht termin.start noch den alten Wert.
const NEU_ERINNERN = `erinnert_am = CASE WHEN excluded.start <> termin.start THEN NULL ELSE termin.erinnert_am END,
          hinweis_fall = CASE WHEN excluded.start <> termin.start THEN NULL ELSE termin.hinweis_fall END`;

// Fingerabdruck der Konfiguration: ein Status gilt nur fuer dieselbe Adresse.
const kennung = (k) => crypto.createHash('sha256').update([k.art, k.url, k.benutzer || '', k.passwortEnvVar || ''].join('\n')).digest('hex').slice(0, 16);

function letzterSync(db, konto) {
  let s = null;
  try { s = JSON.parse(getMeta(db, 'kalender_sync_' + konto.id) || 'null'); } catch { /* kaputt = nie abgeglichen */ }
  return s && s.konfig === kennung(konto) ? s : null;
}

// Vorlaeufige Google-Termine (google_offen): kommt derselbe Termin aus dem Kalender,
// uebernimmt er Ziel, Erinnerung, Erinnerungsstand und Buchung; der lokale geht weg,
// sonst stuende er doppelt da (doppelte Workload, zweimal buchbar). Derselbe heisst:
// gleiche Zeit und gleicher Titel; aendert jemand in Google nur den Titel, reicht die
// Zeit, wenn genau ein vorlaeufiger Termin sie hat. Laeuft in der Transaktion des Abgleichs.
function fuehreZusammen(db, kontoId, v) {
  const offen = db.prepare("SELECT * FROM termin WHERE kalender_id = 'lokal' AND google_offen IS NOT NULL ORDER BY uid").all();
  if (!offen.length) return 0;
  const gleich = (a, b) => Date.parse(a) === Date.parse(b);
  const norm = (t) => String(t || '').trim().toLowerCase();
  const eintragDa = db.prepare('SELECT 1 FROM zeit_eintrag WHERE id = ?');
  const zustand = db.prepare(`UPDATE termin SET erinnern = ?, erinnert_am = COALESCE(erinnert_am, ?), hinweis_fall = COALESCE(hinweis_fall, ?),
    hinweis_weg = MAX(hinweis_weg, ?), gebucht_eintrag_id = COALESCE(gebucht_eintrag_id, ?) WHERE kalender_id = ? AND uid = ?`);
  const ziel = db.prepare('UPDATE termin SET ziel_art = ?, ziel_schluessel = ?, ziel_von_hand = 1 WHERE kalender_id = ? AND uid = ?');
  const umhaengen = db.prepare('UPDATE zeit_eintrag SET kalender_uid = ? WHERE id = ? AND kalender_uid = ?');
  const loesche = db.prepare("DELETE FROM termin WHERE kalender_id = 'lokal' AND uid = ?");
  const vergeben = new Set();
  let n = 0;
  for (const x of v) {
    const kand = offen.filter((o) => !vergeben.has(o.uid) && gleich(o.start, x.start) && gleich(o.ende, x.ende));
    const o = kand.find((k) => norm(k.titel) === norm(x.titel)) || (kand.length === 1 ? kand[0] : null);
    if (!o) continue;
    const gebucht = o.gebucht_eintrag_id != null && eintragDa.get(o.gebucht_eintrag_id) ? o.gebucht_eintrag_id : null;
    zustand.run(o.erinnern, o.erinnert_am, o.hinweis_fall, o.hinweis_weg, gebucht, kontoId, x.uid);
    if (o.ziel_art != null) ziel.run(o.ziel_art, o.ziel_schluessel, kontoId, x.uid);
    if (gebucht) umhaengen.run(x.uid, gebucht, o.uid);
    loesche.run(o.uid);
    vergeben.add(o.uid);
    n++;
  }
  return n;
}

// "In Google nicht gefunden": 24 h nach der Uebergabe und nur, wenn der Termin im
// Abgleich-Horizont liegt — einer in acht Wochen kann noch gar nicht zurueck sein.
function googleFehlt(t, jetzt = Date.now()) {
  return !!(t && t.google_offen) && Date.parse(t.google_offen) < jetzt - TAG_MS && Date.parse(t.start) < horizont(jetzt).bis;
}

// --- Abgleich -------------------------------------------------------------------
// Upsert je Vorkommen, dann weg, was im Horizont liegt und diesmal nicht kam.
// Eine Zuordnung von Hand (ziel_von_hand) bleibt stehen. Scheitert das Holen,
// bleibt alles wie es war. Kommt auf einmal gar nichts, obwohl Termine da sind,
// gilt das erst beim zweiten Mal in Folge als gewollt.
async function sync(db, konto, { jetzt = Date.now(), holen } = {}) {
  const { von, bis } = horizont(jetzt);
  const at = iso(jetzt);
  const alt = letzterSync(db, konto);
  const basis = { at, konfig: kennung(konto), letzter_ok: alt ? alt.letzter_ok || null : null };
  let erg;
  let zusammen = 0;
  try {
    const ev = await (holen ? holen() : hole(konto, jetzt));
    const v = vorkommen(ev, von, bis);
    const imHorizont = db.prepare("SELECT uid FROM termin WHERE kalender_id = ? AND quelle = 'kalender' AND start < ? AND ende > ?").all(konto.id, iso(bis), iso(von));
    if (!v.length && imHorizont.length && !(alt && alt.leer)) {
      erg = { ...basis, ok: false, leer: true, fehler: 'Kalender lieferte keine Termine — die ' + imHorizont.length + ' vorhandenen bleiben. Bleibt er beim nächsten Abgleich leer, gilt das als gewollt.' };
    } else {
      const ctx = kontext(db);
      const ein = db.prepare(`
        INSERT INTO termin (kalender_id, uid, titel, start, ende, ganztag, art, quelle, ziel_art, ziel_schluessel, aktualisiert_am)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'kalender', ?, ?, ?)
        ON CONFLICT(kalender_id, uid) DO UPDATE SET titel = excluded.titel, start = excluded.start, ende = excluded.ende,
          ganztag = excluded.ganztag, art = excluded.art, aktualisiert_am = excluded.aktualisiert_am, ${NEU_ERINNERN},
          ziel_art = CASE WHEN termin.ziel_von_hand = 1 THEN termin.ziel_art ELSE excluded.ziel_art END,
          ziel_schluessel = CASE WHEN termin.ziel_von_hand = 1 THEN termin.ziel_schluessel ELSE excluded.ziel_schluessel END`);
      // Ueber die Schluessel, nicht ueber aktualisiert_am: zwei Laeufe in derselben
      // Millisekunde (Test, "Jetzt abgleichen") haetten sonst denselben Stempel.
      const da = new Set(v.map((x) => x.uid));
      // Gebuchte bleiben: kaeme dieselbe uid zurueck, waere sie sonst ein zweites Mal buchbar.
      const weg = db.prepare("DELETE FROM termin WHERE kalender_id = ? AND uid = ? AND quelle = 'kalender' AND gebucht_eintrag_id IS NULL");
      kontakte.inTransaktion(db, () => {
        for (const x of v) {
          const z = rateZiel(x.titel, ctx);
          ein.run(konto.id, x.uid, x.titel, x.start, x.ende, x.ganztag, x.art, z ? z.ziel_art : null, z ? z.ziel_schluessel : null, at);
        }
        for (const r of imHorizont) if (!da.has(r.uid)) weg.run(konto.id, r.uid);
        zusammen = fuehreZusammen(db, konto.id, v);
      });
      erg = { ...basis, ok: true, letzter_ok: at, leer: v.length === 0, anzahl: v.length, zusammengefuehrt: zusammen, rrule_ignoriert: v.ignoriert, verworfen: v.verworfen, fehler: null };
    }
  } catch (err) {
    erg = { ...basis, ok: false, fehler: meldung(err, konto) };
  }
  // Ein Fehler beim Merken darf den Takt der anderen Konten nicht abbrechen.
  try { setMeta(db, 'kalender_sync_' + konto.id, JSON.stringify(erg)); } catch (err) { console.error('Kalender ' + konto.id + ': Status nicht gespeichert:', err); }
  const { konfig, ...aussen } = erg;
  return { id: konto.id, ...aussen };
}

// Status je Konto fuer /api/kalender: Host statt Adresse.
function status(db, liste = KONTEN.gueltig) {
  const zaehle = db.prepare('SELECT COUNT(*) AS n FROM termin WHERE kalender_id = ?');
  return liste.map((k) => {
    const s = letzterSync(db, k) || {};
    return { id: k.id, name: k.name, art: k.art, host: new URL(k.url).hostname, at: s.at || null, ok: s.ok ?? null,
      letzter_ok: s.letzter_ok || null, fehler: s.fehler || null, rrule_ignoriert: s.rrule_ignoriert || 0, verworfen: s.verworfen || 0,
      anzahl: zaehle.get(k.id).n };
  });
}

// Kalendertermine eines Kontos, das nicht mehr in der Konfiguration steht.
// Nicht loeschen: daran koennen Zuordnungen und Buchungen haengen.
function verwaist(db, liste = KONTEN.gueltig) {
  const ids = new Set(liste.map((k) => k.id));
  return db.prepare("SELECT kalender_id, COUNT(*) AS anzahl FROM termin WHERE quelle = 'kalender' GROUP BY kalender_id ORDER BY kalender_id").all()
    .filter((r) => !ids.has(r.kalender_id)).map((r) => ({ kalender_id: r.kalender_id, anzahl: r.anzahl }));
}

// Takt aus refreshData: je Konto hoechstens alle 5 Minuten, nie zwei Laeufe
// gleichzeitig (auch nicht mit "Jetzt abgleichen"). Wirft nie — ein
// Kalenderfehler darf den Ingest nicht reissen.
let laeuft = false;
async function takt(db, { jetzt = Date.now(), liste = KONTEN.gueltig } = {}) {
  if (laeuft || !liste.length) return [];
  laeuft = true;
  try {
    const out = [];
    for (const k of liste) {
      const alt = letzterSync(db, k);
      if (alt && Date.parse(alt.at) > jetzt - TAKT_MS) continue;
      const e = await sync(db, k, { jetzt });
      if (!e.ok) console.error('Kalender ' + k.id + ': ' + e.fehler);
      out.push(e);
    }
    return out;
  } catch (err) {
    console.error('Kalender-Abgleich fehlgeschlagen:', err);
    return [];
  } finally {
    laeuft = false;
  }
}

async function syncJetzt(db, id) {
  const liste = id == null || id === '' ? KONTEN.gueltig : KONTEN.gueltig.filter((k) => k.id === id);
  if (id != null && id !== '' && !liste.length) throw fehl('Kalender nicht gefunden.');
  if (laeuft) throw fehl('Ein Abgleich läuft gerade — gleich noch einmal versuchen.');
  laeuft = true;
  try {
    const out = [];
    for (const k of liste) out.push(await sync(db, k));
    return out;
  } finally {
    laeuft = false;
  }
}

// --- Verbinden und Trennen aus der Oberflaeche ------------------------------------
// Owner-Entscheidung 12.10.2026: Ausnahme von "Zugaenge nur in der Datei" fuer die
// ICS-Abo-Adresse — sie ist der ganze Zugang, ein Passwort gibt es nicht. CalDAV
// (Benutzer + Passwort) bleibt in config.json. Die Adresse wird gespeichert und nie
// zurueckgegeben; Antworten tragen nur Host und Status. Geschrieben wird ueber
// speichern(neueListe) des Servers, damit hier nichts an config.json vorbeigeht.
const ADRESSE_MAX = 2000;
function setzeKonten(liste) {
  const k = konten(liste);
  KONTEN.gueltig = k.gueltig;
  KONTEN.fehler = k.fehler;
}
function rohListe(roh) {
  if (roh == null) return [];
  if (!Array.isArray(roh)) throw fehl('kalender in config.json ist keine Liste — erst dort korrigieren.');
  return roh;
}
// id aus dem Namen bzw. Host ("google"); frei heisst: weder in der Liste noch an
// alten Terminen — sonst erbte ein neues Konto die gebuchten Termine eines alten.
function neueId(db, name, host, liste) {
  const basis = (String(name || host.split('.').slice(-2, -1)[0] || 'kalender').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'kalender').replace(/^lokal$/, 'kalender');
  const belegt = new Set(liste.map((k) => k && k.id));
  const anTerminen = db.prepare('SELECT 1 FROM termin WHERE kalender_id = ? LIMIT 1');
  for (let i = 1; i < 100; i++) {
    const id = i === 1 ? basis : basis + '-' + i;
    if (!belegt.has(id) && !anTerminen.get(id)) return id;
  }
  throw fehl('Keine freie Kennung — einen anderen Namen wählen.');
}
// Nacheinander, nie parallel: verbinde wartet bis 20 s auf die Probe; ein Trennen oder
// zweites Verbinden dazwischen (zweiter Tab) ginge sonst mit der alten Liste verloren.
let kette = Promise.resolve();
function seriell(f) {
  const p = kette.then(f, f);
  kette = p.catch(() => {});
  return p;
}
const verbinde = (db, d, o) => seriell(() => verbindeEin(db, d, o));
const trenne = (db, d, o) => seriell(() => trenneEin(db, d, o));
async function verbindeEin(db, d, { roh = config.kalender, speichern, holen = hole, jetzt = Date.now() } = {}) {
  if (typeof speichern !== 'function') throw new Error('verbinde: speichern fehlt');
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw fehl('Adresse fehlt.');
  const url = typeof d.url === 'string' ? d.url.trim() : '';
  if (!url) throw fehl('Adresse fehlt.');
  if (url.length > ADRESSE_MAX || /[\s\u0000-\u001f\u007f]/.test(url)) throw fehl('Das ist keine Kalender-Adresse.');
  const name = d.name == null ? '' : String(d.name).trim();
  if (name.length > 80) throw fehl('Name: höchstens 80 Zeichen.');
  if (/[\u0000-\u001f\u007f�]/.test(name)) throw fehl('Name: Steuer- oder Ersatzzeichen.');
  let host;
  try { host = new URL(url.replace(/^webcals?:\/\//i, 'https://')).hostname; } catch { throw fehl('Das ist keine Kalender-Adresse — sie beginnt mit https:// oder webcal://.'); }
  const liste = rohListe(roh);
  const eintrag = { id: neueId(db, name, host, liste), name: name || host, art: 'ics', url };
  const probe = konten([eintrag]);
  // Fehlertexte von konten() beginnen mit "Kalender 1 (id): " — fuer die Oberflaeche ohne.
  if (probe.fehler.length) throw fehl(probe.fehler[0].replace(/^Kalender 1( \([^)]*\))?: /, ''));
  const konto = probe.gueltig[0];
  // Aus der Oberflaeche nur verschluesselt: die Adresse ist der Zugang. http im LAN bleibt per Datei moeglich.
  if (new URL(konto.url).protocol !== 'https:') throw fehl('Nur https:// oder webcal:// — die Adresse ist ein Zugang und ginge sonst im Klartext.');
  if (konten(liste).gueltig.some((k) => k.url === konto.url)) throw fehl('Dieser Kalender ist schon verbunden.');
  // Probe vor dem Speichern: Tippfehler, Login-Seite oder falsche Adresse sollen
  // hier auffallen, nicht erst als roter Status im Takt.
  let ereignisse;
  try { ereignisse = await holen(konto, jetzt); } catch (err) {
    const m = meldung(err, konto);
    throw fehl(/^nicht erreichbar/.test(m) ? 'Kalender ' + m : 'Kalender nicht erreichbar: ' + m);
  }
  const neu = [...liste, eintrag];
  await speichern(neu);
  setzeKonten(neu);
  const erg = await sync(db, konto, { jetzt, holen: async () => ereignisse });
  return { id: konto.id, ergebnis: erg };
}
async function trenneEin(db, d, { roh = config.kalender, speichern } = {}) {
  if (typeof speichern !== 'function') throw new Error('trenne: speichern fehlt');
  const id = d && typeof d === 'object' && typeof d.id === 'string' ? d.id : '';
  const liste = rohListe(roh);
  if (!liste.some((k) => k && k.id === id)) throw fehl('Kalender nicht gefunden.');
  if (laeuft) throw fehl('Ein Abgleich läuft gerade — gleich noch einmal versuchen.');
  const neu = liste.filter((k) => !(k && k.id === id));
  await speichern(neu);
  setzeKonten(neu);
  // Ungebuchte Termine des Kontos gehen mit, gebuchte bleiben (sonst waeren sie bei
  // einem erneuten Verbinden ein zweites Mal buchbar) und erscheinen als verwaist.
  const weg = db.prepare(`DELETE FROM termin WHERE kalender_id = ? AND quelle = 'kalender' AND (gebucht_eintrag_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM zeit_eintrag e WHERE e.id = termin.gebucht_eintrag_id))`).run(id).changes;
  return { ok: true, termine_entfernt: weg };
}

// --- Termine lesen und lokal pflegen --------------------------------------------
function tag(v, name) {
  const s = String(v || '');
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T00:00:00Z') : NaN;
  if (!Number.isFinite(ms) || iso(ms).slice(0, 10) !== s) throw fehl(name + ': Datum JJJJ-MM-TT erwartet.');
  return ms;
}
function zeitIso(v, name) {
  const ms = typeof v === 'string' && v.length <= 40 ? Date.parse(v) : NaN;
  if (!Number.isFinite(ms)) throw fehl(name + ': Zeitpunkt erwartet.');
  return iso(ms);
}
function schluessel(d) {
  const kid = typeof d.kalender_id === 'string' ? d.kalender_id : 'lokal';
  if (typeof d.uid !== 'string' || !d.uid || d.uid.length > 300) throw fehl('Termin nicht gefunden.');
  return { kid, uid: d.uid };
}
function pruefeZiel(d) {
  if (d.ziel_art == null && d.ziel_schluessel == null) return null;
  if (!ZIEL_ARTEN.includes(d.ziel_art)) throw fehl('Zielart unbekannt.');
  const s = typeof d.ziel_schluessel === 'string' ? d.ziel_schluessel.trim() : '';
  if (!s || s.length > 200) throw fehl('Ziel fehlt.');
  return { ziel_art: d.ziel_art, ziel_schluessel: s };
}
const lies1 = (db, kid, uid) => db.prepare('SELECT * FROM termin WHERE kalender_id = ? AND uid = ?').get(kid, uid);

function termine(db, { from, to } = {}) {
  const a = tag(from, 'from');
  const b = tag(to, 'to');
  if (b < a) throw fehl('Zeitraum: to liegt vor from.');
  if ((b - a) / TAG_MS > 62) throw fehl('Zeitraum: höchstens 62 Tage.');
  return db.prepare('SELECT * FROM termin WHERE start < ? AND ende > ? ORDER BY start').all(iso(b + TAG_MS), iso(a))
    .map((t) => ({ ...t, google_fehlt: googleFehlt(t) }));
}

function speichereTermin(db, d = {}, { kontenDa = KONTEN.gueltig.length > 0 } = {}) {
  if (d.kalender_id != null && d.kalender_id !== 'lokal') throw fehl('Kalendertermine werden nur gelesen.');
  const titel = typeof d.titel === 'string' ? rein(d.titel) : '';
  if (!titel) throw fehl('Titel fehlt.');
  if (titel.length > 200) throw fehl('Titel: höchstens 200 Zeichen.');
  if (d.art !== 'meeting' && d.art !== 'blocker') throw fehl('Art: meeting oder blocker.');
  const start = zeitIso(d.start, 'Start');
  const ende = zeitIso(d.ende, 'Ende');
  if (ende <= start) throw fehl('Ende liegt vor Start.');
  if (Date.parse(ende) - Date.parse(start) > 7 * TAG_MS) throw fehl('Termin: höchstens 7 Tage.');
  const z = pruefeZiel(d);
  let uid = d.uid;
  let alt = null;
  if (uid != null) {
    alt = typeof uid === 'string' ? lies1(db, 'lokal', uid) : null;
    if (!alt) throw fehl('Termin nicht gefunden.');
  } else uid = crypto.randomUUID();
  // Ohne Angabe bleibt der Schalter, wie er war (neu: an).
  const e = d.erinnern;
  if (e !== undefined && ![true, false, 0, 1].includes(e)) throw fehl('Erinnern: ja oder nein.');
  const erinnern = e === undefined ? (alt ? alt.erinnern : 1) : Number(e);
  // An Google uebergeben: wartet auf den Abgleich, der zusammenfuehrt. Ohne verbundenen
  // Kalender kaeme nie etwas zurueck, dann bleibt es ein gewoehnlicher lokaler Termin.
  const g = d.google;
  if (g !== undefined && g !== true && g !== false) throw fehl('Google: ja oder nein.');
  const googleOffen = g === true ? (kontenDa ? iso(Date.now()) : null) : g === false ? null : (alt ? alt.google_offen : null);
  db.prepare(`
    INSERT INTO termin (kalender_id, uid, titel, start, ende, ganztag, art, quelle, ziel_art, ziel_schluessel, ziel_von_hand, erinnern, google_offen, aktualisiert_am)
    VALUES ('lokal', ?, ?, ?, ?, 0, ?, 'lokal', ?, ?, 1, ?, ?, ?)
    ON CONFLICT(kalender_id, uid) DO UPDATE SET titel = excluded.titel, start = excluded.start, ende = excluded.ende, art = excluded.art, ${NEU_ERINNERN},
      ziel_art = excluded.ziel_art, ziel_schluessel = excluded.ziel_schluessel, erinnern = excluded.erinnern, google_offen = excluded.google_offen,
      aktualisiert_am = excluded.aktualisiert_am`)
    .run(uid, titel, start, ende, d.art, z ? z.ziel_art : null, z ? z.ziel_schluessel : null, erinnern, googleOffen, iso(Date.now()));
  return lies1(db, 'lokal', uid);
}

function loescheTermin(db, d = {}) {
  const { kid, uid } = schluessel(d);
  if (kid !== 'lokal') throw fehl('Kalendertermine werden nur gelesen.');
  if (db.prepare("DELETE FROM termin WHERE kalender_id = 'lokal' AND uid = ?").run(uid).changes !== 1) throw fehl('Termin nicht gefunden.');
  return { uid };
}

// Ziel eines Termins von Hand setzen (auch Kalendertermine: das ist keine
// Aenderung am Kalender). null/null nimmt die Zuordnung weg, bleibt aber "von Hand".
function setzeZiel(db, d = {}) {
  const z = pruefeZiel(d);
  const { kid, uid } = schluessel(d);
  const n = db.prepare('UPDATE termin SET ziel_art = ?, ziel_schluessel = ?, ziel_von_hand = 1 WHERE kalender_id = ? AND uid = ?')
    .run(z ? z.ziel_art : null, z ? z.ziel_schluessel : null, kid, uid).changes;
  if (n !== 1) throw fehl('Termin nicht gefunden.');
  return lies1(db, kid, uid);
}

// --- Erinnerung bei Blocker-Beginn ------------------------------------------------
// Laeuft in jedem Takt von refreshData (30 s). Ein Blocker, der gerade begonnen
// hat, bekommt genau einen Hinweis; welcher, entscheidet die Claude-Aktivitaet
// der letzten 5 Minuten am selben Ziel:
//   claude    — du tippst dort (Eingaben): die Zeit laeuft schon ueber Claude
//   begleiten — Claude arbeitet dort allein: Vorschlag Timer "Begleiten"
//   manuell   — nichts: Vorschlag Timer
// Gebucht wird hier nie: das Ziel eines Kalendertermins ist aus einem fremden
// Titel geraten und nur ein Vorschlag.
// Das Fenster ist 5 Minuten statt der 60 s aus dem Plan: ein langer Ingest
// laesst einen 30-s-Takt aus, und ein spaeter Hinweis nuetzt mehr als keiner.
// Der Hinweis steht am Termin (hinweis_fall, hinweis_weg), damit ein Neustart
// keine schon verbrauchte Erinnerung verschluckt. Wird ein Termin verschoben,
// setzen Abgleich und speichereTermin erinnert_am zurueck. Ein Blocker mit
// ausgeschaltetem "Bei Beginn erinnern" (erinnern = 0) bleibt still.
const ERINNERN_MS = 5 * 60000;
const AKTIV_MS = 5 * 60000;

function fall(db, t, jetzt) {
  let wo;
  if (t.ziel_art === 'vorgang') wo = ['UPPER(ticket) = UPPER(?)', t.ziel_schluessel];   // wie zeit.gleichesZiel
  else if (t.ziel_art === 'projekt') wo = ['project = ?', t.ziel_schluessel];
  else if (t.ziel_art === 'kunde') wo = ['project IN (SELECT projekt FROM projekt_kontakt WHERE kontakt_id = ?)', Number(t.ziel_schluessel)];
  else return 'manuell';   // ohne Ziel oder intern: nichts, womit Claude-Arbeit vergleichbar waere
  const von = jetzt - AKTIV_MS;
  const r = db.prepare(`SELECT COUNT(*) AS n, COALESCE(MAX(eingabe = 1), 0) AS tippt FROM activity
    WHERE day >= ? AND ts > ? AND ts <= ? AND ${wo[0]}`).get(iso(von).slice(0, 10), iso(von), iso(jetzt), wo[1]);
  return r.tippt ? 'claude' : r.n ? 'begleiten' : 'manuell';
}

const alsHinweis = (t) => ({
  fall: t.hinweis_fall, seit: t.erinnert_am,
  termin: { kalender_id: t.kalender_id, uid: t.uid, titel: t.titel, start: t.start, ende: t.ende, art: t.art,
    ziel_art: t.ziel_art, ziel_schluessel: t.ziel_schluessel, ziel_von_hand: t.ziel_von_hand },
});

function erinnerungen(db, { jetzt = Date.now() } = {}) {
  const faellig = db.prepare(`SELECT * FROM termin WHERE art = 'blocker' AND ganztag = 0 AND erinnern = 1 AND erinnert_am IS NULL
    AND start > ? AND start <= ? ORDER BY start`).all(iso(jetzt - ERINNERN_MS), iso(jetzt));
  // Fall und Merker in einem UPDATE: genau einmal, auch wenn zwei Takte sich
  // ueberholen, und nie "erinnert" ohne Hinweis.
  const merke = db.prepare(`UPDATE termin SET erinnert_am = ?, hinweis_fall = ?, hinweis_weg = 0
    WHERE kalender_id = ? AND uid = ? AND erinnert_am IS NULL`);
  const neu = [];
  for (const t of faellig) {
    let f;
    try {
      f = fall(db, t, jetzt);
    } catch (err) {
      // Lieber ein Hinweis ohne Pruefung als gar keiner.
      console.error('Erinnerung ' + t.kalender_id + '/' + t.uid + ': Pruefung fehlgeschlagen, Fall manuell:', err);
      f = 'manuell';
    }
    if (merke.run(iso(jetzt), f, t.kalender_id, t.uid).changes !== 1) continue;
    neu.push(alsHinweis({ ...t, erinnert_am: iso(jetzt), hinweis_fall: f }));
  }
  return neu;
}

// Offene Hinweise: bis zum Wegklicken, hoechstens einen Tag. Mit dem Terminende
// zu verschwinden hiess, dass eine Erinnerung im Hintergrund-Tab nie gesehen wurde.
function hinweise(db, { jetzt = Date.now() } = {}) {
  return db.prepare(`SELECT * FROM termin WHERE erinnert_am IS NOT NULL AND hinweis_fall IS NOT NULL AND hinweis_weg = 0
    AND erinnert_am > ? ORDER BY start`).all(iso(jetzt - TAG_MS)).map(alsHinweis);
}

// Zweimal wegklicken ist kein Fehler: zwei offene Tabs.
function hinweisWeg(db, d = {}) {
  const { kid, uid } = schluessel(d || {});
  const n = db.prepare('UPDATE termin SET hinweis_weg = 1 WHERE kalender_id = ? AND uid = ? AND hinweis_fall IS NOT NULL AND hinweis_weg = 0')
    .run(kid, uid).changes;
  return { ok: true, weg: n === 1 };
}

module.exports = {
  KalenderFehler, parseIcs, alsIcs, calendarData, vorkommen, rateZiel, konten, KONTEN, hole, sync, status, verwaist, takt, syncJetzt,
  verbinde, trenne, setzeKonten, googleFehlt,
  termine, speichereTermin, loescheTermin, setzeZiel, erinnerungen, hinweise, hinweisWeg, TAKT_MS,
};
