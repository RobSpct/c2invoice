'use strict';
/* Kern der neuen Oberflaeche: Speicher, Formate, Laden, Rueckmeldung,
   Zeitraum und Navigation. Die oberste Ebene greift nicht auf DOM oder
   Browser-Speicher zu, damit test/selfcheck.js die reinen Funktionen unter
   Node laden kann (zeitraum). Gerechnet wird hier nichts, was auf einer
   Rechnung landet — das bleibt in metrics.js. */

/* ---------- Browser-Speicher ----------
   Nur Bequemlichkeit je Browser (gewaehlter Reiter, Zeitraum, Schalter).
   Kann leer sein oder werfen (privater Modus) — die Seite muss ohne laufen. */
const SPEICHER = 'c2invoice.';
function lies(k, standard) {
  try {
    const v = localStorage.getItem(SPEICHER + k);
    return v === null ? standard : v;
  } catch { return standard; }
}
function liesJson(k, standard) {
  try { const v = JSON.parse(lies(k, 'null')); return v === null ? standard : v; } catch { return standard; }
}
// true, wenn es geklappt hat: wer Daten (Entwuerfe) ablegt, muss es wissen.
function merke(k, v) {
  try { localStorage.setItem(SPEICHER + k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; }
}

/* ---------- Formate (folgen der Sprache) ---------- */
let nf0, nf1, nf2;
function setzeFormate() {
  const l = (typeof istDE === 'function' && !istDE()) ? 'en-US' : 'de-DE';
  nf0 = new Intl.NumberFormat(l, { maximumFractionDigits: 0 });
  nf1 = new Intl.NumberFormat(l, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  nf2 = new Intl.NumberFormat(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
setzeFormate();

const num = (v) => nf0.format(Number(v) || 0);
const usd = (v) => nf2.format(Number(v) || 0) + ' USD';
const eur = (v) => nf2.format(Number(v) || 0) + ' EUR';
const hrs = (v) => nf1.format(Number(v) || 0) + ' h';
const prozent = (v) => (v == null ? '–' : nf1.format(Number(v)) + ' %');

// Grosse Zahlen kompakt; Kurzformen wechseln mit der Sprache.
function kurz(v) {
  const n = Number(v) || 0;
  const E = istDE() ? { g: ' Mrd', m: ' Mio', k: ' Tsd' } : { g: ' bn', m: ' m', k: ' k' };
  if (n >= 1e9) return nf2.format(n / 1e9) + E.g;
  if (n >= 1e6) return nf1.format(n / 1e6) + E.m;
  if (n >= 1e4) return nf0.format(Math.round(n / 1e3)) + E.k;
  return nf0.format(n);
}

// Englisch Monat vor Tag, sonst liest ein Amerikaner den 07.09. als 9. Juli.
function datum(iso) {
  if (!iso) return '–';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return String(iso);
  return istDE() ? p[2] + '.' + p[1] + '.' + p[0] : p[1] + '/' + p[2] + '/' + p[0];
}
function datumKurz(iso) {
  if (!iso) return '–';
  const p = String(iso).slice(0, 10).split('-');
  return istDE() ? p[2] + '.' + p[1] + '.' : p[1] + '/' + p[2];
}

function vor(iso) {
  const unbekannt = istDE() ? 'unbekannt' : 'unknown';
  if (!iso) return unbekannt;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return unbekannt;
  if (ms < 0) return istDE() ? 'gerade eben' : 'just now';
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  let zahl, einheit;
  if (s < 60) { zahl = s; einheit = istDE() ? 'Sek' : 'sec'; }
  else if (m < 60) { zahl = m; einheit = istDE() ? 'Min' : 'min'; }
  else if (h < 24) { zahl = h; einheit = istDE() ? 'Std' : 'hr'; }
  else { zahl = Math.floor(h / 24); einheit = istDE() ? 'Tagen' : 'days'; }
  return istDE() ? 'vor ' + zahl + ' ' + einheit : zahl + ' ' + einheit + ' ago';
}

// Laeuft diese Sitzung gerade? Zwei Minuten, bewusst unter dem Pausenabstand.
function istAktiv(ts) {
  const t = Date.parse(ts);
  return Number.isFinite(t) && (Date.now() - t) < 120000;
}

// Deckungsgleich mit esc() in rechnung.js, einschliesslich des Apostrophs.
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const kurzModell = (m) => String(m || '–').replace(/^claude-/, '');

/* ---------- Zeitraum ----------
   Liefert von/bis (ISO-Tage, lokal) und eine gleich lange Vorperiode.
   "bis" ist bei laufenden Zeitraeumen heute, nicht das Monatsende: verglichen
   wird bis-heute gegen bis-zum-selben-Tag-davor. */
const ZEITRAEUME = ['heute', 'woche', 'monat', 'letzter', 'quartal', 'jahr', 'gesamt', 'frei'];

function isoTag(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function ausIso(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}
const plusTage = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const tageZwischen = (a, b) => Math.round((b - a) / 86400000);
// Gleicher Tag im Monat `m` Monate frueher, am Monatsende gekappt.
function monatZurueck(d, m) {
  const ziel = new Date(d.getFullYear(), d.getMonth() - m, 1);
  const letzter = new Date(ziel.getFullYear(), ziel.getMonth() + 1, 0).getDate();
  return new Date(ziel.getFullYear(), ziel.getMonth(), Math.min(d.getDate(), letzter));
}

// erster: erster Tag mit Daten (summary.erster_tag), nur fuer "gesamt".
function zeitraum(art, heute, frei, erster) {
  const n = heute || new Date();
  const h = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (!ZEITRAEUME.includes(art)) art = 'monat';
  let von, bis = h, vorVon, vorBis;
  if (art === 'heute') {
    von = h; vorVon = vorBis = plusTage(h, -1);
  } else if (art === 'woche') {
    von = plusTage(h, -((h.getDay() + 6) % 7));       // Montag
    vorVon = plusTage(von, -7); vorBis = plusTage(h, -7);
  } else if (art === 'monat') {
    von = new Date(h.getFullYear(), h.getMonth(), 1);
    vorVon = new Date(h.getFullYear(), h.getMonth() - 1, 1); vorBis = monatZurueck(h, 1);
  } else if (art === 'letzter') {
    von = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    bis = new Date(h.getFullYear(), h.getMonth(), 0);
    vorVon = new Date(h.getFullYear(), h.getMonth() - 2, 1);
    vorBis = new Date(h.getFullYear(), h.getMonth() - 1, 0);
  } else if (art === 'quartal') {
    const q = Math.floor(h.getMonth() / 3) * 3;
    von = new Date(h.getFullYear(), q, 1);
    vorVon = new Date(h.getFullYear(), q - 3, 1);
    vorBis = plusTage(vorVon, tageZwischen(von, h));
  } else if (art === 'jahr') {
    von = new Date(h.getFullYear(), 0, 1);
    vorVon = new Date(h.getFullYear() - 1, 0, 1); vorBis = monatZurueck(h, 12);
  } else if (art === 'gesamt') {
    // Alles bis heute. Eine Vorperiode gibt es nicht; vor dem ersten Laden ist
    // der erste Tag unbekannt, dann gilt bis dahin der Jahresanfang.
    von = /^\d{4}-\d{2}-\d{2}$/.test(erster || '') && ausIso(erster) <= h ? ausIso(erster) : new Date(h.getFullYear(), 0, 1);
    return { art, von: isoTag(von), bis: isoTag(bis), vorVon: null, vorBis: null };
  } else {
    von = frei && frei.von ? ausIso(frei.von) : new Date(h.getFullYear(), h.getMonth(), 1);
    bis = frei && frei.bis ? ausIso(frei.bis) : h;
    if (bis < von) [von, bis] = [bis, von];
    const tage = tageZwischen(von, bis) + 1;
    vorBis = plusTage(von, -1); vorVon = plusTage(von, -tage);
  }
  return { art, von: isoTag(von), bis: isoTag(bis), vorVon: isoTag(vorVon), vorBis: isoTag(vorBis) };
}

/* ---------- Zustand ---------- */
const state = {
  summary: null,          // /api/summary im gewaehlten Zeitraum
  vorher: null,           // /api/summary der Vorperiode (nur mit Vergleich)
  live: null,
  zeitraumArt: 'monat',
  frei: {},
  vergleich: true,
  codeStand: null,
  codeSprung: false,
  fehler: {},
};

/* ---------- Laden ---------- */
async function hole(pfad) {
  // Nach 30 s abbrechen: eine haengende Abfrage liesse sonst "Lädt …" ewig stehen.
  const r = await fetch(pfad, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!r.ok) {
    // Meldung bleibt "HTTP <status>" (Aufrufer pruefen darauf); der Grund des
    // Servers kommt als e.grund mit, damit ihn die Oberflaeche zeigen kann.
    const e = new Error('HTTP ' + r.status);
    e.status = r.status;
    e.grund = await r.json().then((d) => (d && d.error) || null, () => null);
    throw e;
  }
  return r.json();
}
// Der Server meldet Fehler als { error } mit Status 400 — beides pruefen.
async function sende(pfad, nutzlast) {
  const r = await fetch(pfad, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(nutzlast),
    // 60 s statt 30: die PDF-Erzeugung startet einen Browser. Abbruch heisst
    // nur "keine Antwort" — der Server kann trotzdem geschrieben haben.
    signal: AbortSignal.timeout(60000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    // status geht mit: 409 und 5xx bedeuten fuer den Aufrufer etwas anderes als 400.
    const e = new Error(d.error || d.grund || 'HTTP ' + r.status);
    e.status = r.status;
    e.daten = d;   // z. B. die moeglichen Jira-Uebergaenge bei 409 (Board)
    throw e;
  }
  return d;
}
const abfrage = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '')
  .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

/* ---------- Rueckmeldung ---------- */
function toast(text, art, aktion) {
  if (!text) return;
  let halter = document.getElementById('toasts');
  if (!halter) {
    halter = document.createElement('div');
    halter.id = 'toasts';
    halter.className = 'toast-halter';
    halter.setAttribute('aria-live', 'polite');
    halter.setAttribute('role', 'status');
    document.body.appendChild(halter);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (art ? ' ' + art : '');
  const txt = document.createElement('span');
  txt.textContent = text;
  el.appendChild(txt);
  if (aktion && aktion.text && typeof aktion.tu === 'function') {
    const k = document.createElement('button');
    k.className = 'knopf klein';
    k.textContent = aktion.text;
    k.addEventListener('click', () => { weg(); aktion.tu(); });
    el.appendChild(k);
  }
  const zu = document.createElement('button');
  zu.className = 'toast-zu';
  zu.setAttribute('aria-label', uebersetze('Meldung schließen'));
  zu.textContent = '×';
  zu.addEventListener('click', () => weg());
  el.appendChild(zu);
  halter.appendChild(el);
  let fort = null;
  function weg() {
    if (!el.isConnected) return;
    clearTimeout(fort);
    el.classList.add('geht');
    setTimeout(() => el.remove(), 220);
  }
  // Mit Rueckgaengig-Knopf 6 s (Plan 11.1), Fehler laenger zum Abschreiben.
  fort = setTimeout(weg, art === 'err' ? 7000 : aktion ? 6000 : 4000);
  return weg;
}

const wenigerBewegung = () => typeof window !== 'undefined' && window.matchMedia
  && (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off');

/* Zaehlt eine Kennzahl beim ersten Fuellen hoch. Der letzte Schritt setzt
   immer format(ziel) — am Ende steht exakt, was die API geliefert hat. */
const zaehlerLaeuft = new WeakMap();
function zaehleHoch(el, ziel, format) {
  if (!el) return;
  const fertig = () => { el.textContent = format(ziel); };
  const alt = zaehlerLaeuft.get(el);
  if (alt) cancelAnimationFrame(alt);
  const schonGefuellt = el.dataset.gefuellt === '1';
  el.dataset.gefuellt = '1';
  const z = Number(ziel);
  if (schonGefuellt || wenigerBewegung() || !Number.isFinite(z) || z === 0) return fertig();
  const start = performance.now();
  const schritt = (jetzt) => {
    const t = Math.min(1, (jetzt - start) / 900);
    if (t >= 1) { zaehlerLaeuft.delete(el); return fertig(); }
    el.textContent = format(z * (1 - Math.pow(1 - t, 3)));
    zaehlerLaeuft.set(el, requestAnimationFrame(schritt));
  };
  zaehlerLaeuft.set(el, requestAnimationFrame(schritt));
}

/* Sperrt den Knopf waehrend der Aktion — gegen Doppelklick, der bei
   "Rechnung erstellen" zwei Nummern aus dem Kreis ziehen wuerde. */
async function mitLauf(knopf, tu) {
  if (!knopf) return tu();
  if (knopf.dataset.laeuft) return;
  const vorher = knopf.innerHTML;
  knopf.dataset.laeuft = '1';
  knopf.disabled = true;
  knopf.setAttribute('aria-busy', 'true');
  knopf.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + vorher;
  try {
    return await tu();
  } finally {
    delete knopf.dataset.laeuft;
    knopf.disabled = false;
    knopf.removeAttribute('aria-busy');
    knopf.innerHTML = vorher;
  }
}

/* ---------- Cira (Handoff README §8) ----------
   Ein Zustand fuer alle Orbs und das Dock. Jede Ansicht meldet ihr gewaehltes
   Objekt mit ciraKontext({ art, id, titel }); das Dock zeigt es unter "Sieht
   mit" und schickt es mit jeder Frage. Beim Seitenwechsel faellt es weg. */
const CIRA_MODI = { ruht: 'Bereit', spricht: 'Spricht', 'hört': 'Hört zu', denkt: 'Denkt nach' };
const cira = { modus: 'ruht', zustand: 'auto', nacht: false, kontext: null, spur: [], dockOffen: false, verlauf: null };
function ciraKontext(k) {
  cira.kontext = k && typeof k === 'object' && k.art
    ? { art: String(k.art), id: k.id == null ? '' : String(k.id), titel: String(k.titel || k.id || '') } : null;
  if (typeof zeichneDockKontext === 'function') zeichneDockKontext();
}
// Spiegelt Modus und Zustand auf jeden <cira-orb> und jede Modus-Beschriftung.
function ciraModus(modus) {
  if (modus && CIRA_MODI[modus]) cira.modus = modus;
  const zustand = cira.nacht && cira.zustand === 'auto' ? 'night' : cira.zustand;
  for (const o of document.querySelectorAll('cira-orb')) {
    if (o.getAttribute('mode') !== cira.modus) o.setAttribute('mode', cira.modus);
    if (o.getAttribute('state') !== zustand) o.setAttribute('state', zustand);
  }
  // Orb-Stil „Flaeche“ auf der Buehne (README §5.2): eigene Zustandsnamen.
  const siri = { ruht: 'idle', 'hört': 'listening', denkt: 'thinking', spricht: 'speaking' }[cira.modus];
  for (const o of document.querySelectorAll('siri-orb')) if (o.getAttribute('state') !== siri) o.setAttribute('state', siri);
  for (const el of document.querySelectorAll('[data-cira-modus]')) el.textContent = uebersetze(CIRA_MODI[cira.modus]);
}

/* ---------- Navigation ----------
   Hash-Routen: #/hub, #/analyse/verbrauch, #/vorgaenge/ABC-123. Jede Seite
   meldet sich mit registriere() an; shell.js zeigt sie an. */
const ANSICHTEN = Object.create(null);
function registriere(name, def) { ANSICHTEN[name] = def; }
// Ohne gemerkte Wahl oeffnet das Cockpit (Masterplan 3.0, C3).
const START_STANDARD = 'cockpit';

function route() {
  const roh = location.hash.replace(/^#\/?/, '');
  const teile = roh.split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  if (ANSICHTEN[teile[0]]) return { name: teile[0], teile: teile.slice(1) };
  const start = lies('start', START_STANDARD);
  return { name: ANSICHTEN[start] ? start : 'hub', teile: [] };
}

/* Freie Kachelgroesse aus dem Browser-Speicher: { w, h } in px, jede Achse
   einzeln optional. Die Werte landen im style-Attribut, deshalb nur ganze
   Zahlen in festen Grenzen; sonst null (= Auto). */
function kachelGroesse(roh) {
  if (!roh || typeof roh !== 'object') return null;
  const g = {};
  if (Number.isInteger(roh.w) && roh.w >= 120 && roh.w <= 2000) g.w = roh.w;
  if (Number.isInteger(roh.h) && roh.h >= 80 && roh.h <= 1600) g.h = roh.h;
  return g.w || g.h ? g : null;
}

/* Reihenfolge nach dem Ablegen von `id` auf `ziel` (null = ans Ende): wer nach
   rechts zieht, landet hinter dem Ziel, wer nach links zieht, davor. */
function verschiebe(liste, id, ziel) {
  if (id === ziel) return liste.slice();
  const nachRechts = liste.includes(id) && ziel != null && liste.indexOf(id) < liste.indexOf(ziel);
  const rest = liste.filter((x) => x !== id);
  const i = ziel == null ? -1 : rest.indexOf(ziel);
  if (i < 0) rest.push(id); else rest.splice(nachRechts ? i + 1 : i, 0, id);
  return rest;
}

/* Betrag aus einem Eingabefeld. Stehen Punkt und Komma, ist das hintere das
   Dezimalzeichen; nur Komma = Dezimalkomma; nur Punkte mit genau drei Ziffern
   je Gruppe = Tausender (1.234), sonst Dezimalpunkt (12.50). Alles andere ist
   NaN — der Dialog zeigt die gelesene Zahl vor dem Buchen an. */
function betragAus(text) {
  const s = String(text == null ? '' : text).replace(/[\s€]/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return NaN;
  const p = s.lastIndexOf('.'), k = s.lastIndexOf(',');
  let roh;
  if (p >= 0 && k >= 0) {
    const dez = p > k ? '.' : ',', tsd = dez === '.' ? ',' : '.';
    const [ganz, rest, zuviel] = s.split(dez);
    if (zuviel !== undefined || rest.includes(tsd) || !/^\d{1,3}([.,]\d{3})*$/.test(ganz)) return NaN;
    roh = ganz.split(tsd).join('') + '.' + rest;
  } else if (k >= 0) {
    roh = s.replace(',', '.');          // ein zweites Komma bleibt stehen, Number() macht daraus NaN
  } else {
    roh = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.split('.').join('') : s;
  }
  return Number(roh);
}

/* Entwuerfe des Beleg-Editors aus dem Browser-Speicher (R5): hoechstens 20,
   jeder in fester Form, sonst faellt er weg. Die Felder in `daten` prueft der
   Server beim Erstellen — hier nur, dass es ein kleines Objekt ist. */
const ENTWUERFE_MAX = 20;
function entwuerfeAus(roh) {
  if (!Array.isArray(roh)) return [];
  return roh.filter((e) => e && typeof e === 'object'
    && typeof e.id === 'string' && /^[a-z0-9-]{1,40}$/.test(e.id)
    && (e.art === 'rechnung' || e.art === 'angebot')
    && typeof e.stand === 'string' && Number.isFinite(Date.parse(e.stand))
    && e.daten && typeof e.daten === 'object' && !Array.isArray(e.daten)
    && JSON.stringify(e.daten).length <= 50000).slice(0, ENTWUERFE_MAX);
}

/* "Bewegung reduzieren" (R13) aus dem Browser-Speicher: nur on oder off.
   Alles andere gilt als an — der Wert landet als data-motion am html-Element. */
function bewegungAus(roh) {
  return roh === 'off' ? 'off' : 'on';
}

/* Bereiche spaeterer Bloecke (`block`) stehen nur mit config
   oberflaeche.geplanteBereiche === true in der Navigation (Owner 21.10.):
   oeffentlich aus, in der eigenen Installation als Erinnerung an. */
function navSeiten(seiten, geplant) {
  return seiten.filter((s) => !s.block || geplant === true);
}

// Googles vorbefuelltes Termin-Formular (R22, Zwischenloesung statt OAuth): der
// Nutzer speichert dort selbst, bei Gaesten verschickt Google die Einladung.
function googleVorlageUrl({ titel, start, ende, details, gaeste }) {
  const utc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: titel || '', dates: utc(start) + '/' + utc(ende) });
  if (details) p.set('details', details);
  if (gaeste && gaeste.length) p.set('add', gaeste.join(','));
  // Leerzeichen als %20 wie encodeURIComponent; ein echtes + steht schon als %2B da.
  return 'https://calendar.google.com/calendar/render?' + p.toString().replace(/\+/g, '%20');
}

if (typeof module !== 'undefined') module.exports = { zeitraum, isoTag, kachelGroesse, verschiebe, betragAus, entwuerfeAus, bewegungAus, navSeiten, googleVorlageUrl };
