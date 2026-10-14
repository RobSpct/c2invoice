'use strict';
/* Rahmen der Oberflaeche: Seitenleiste mit Navigation, Zeitraum und
   Mini-Live, Kopfzeile mit Suche (⌘K) und Hinweisen, Laden und Anzeigen der
   Seiten. Die Seiten selbst stehen in eigenen Dateien und melden sich mit
   registriere() an. */

Object.assign(EN, {
  'Seitenleiste ein-/ausklappen': 'Collapse/expand sidebar', 'Hauptnavigation': 'Main navigation',
  'Hub': 'Hub', 'Analyse': 'Analytics', 'Zeiterfassung': 'Time tracking', 'Vorgänge': 'Jobs',
  'Abrechnung': 'Billing', 'System': 'System', 'Angebote': 'Quotes', 'Rechnungen': 'Invoices',
  'Kontakte': 'Contacts', 'Einstellungen': 'Settings',
  'Zeitraum': 'Period', 'Heute': 'Today', 'Woche': 'Week', 'Monat': 'Month', 'Letzter M.': 'Last mo.', 'Gesamt': 'All',
  'Letzter Monat': 'Last month', 'Quartal': 'Quarter', 'Jahr': 'Year', 'Frei…': 'Custom…', 'Frei': 'Custom',
  'von': 'from', 'bis': 'to', 'Der Zeitraum filtert hier nichts': 'The period does not filter anything here',
  'Vergleich zur Vorperiode': 'Compare with previous period', 'Bei Gesamt gibt es keine Vorperiode': 'All has no previous period', 'Zur Live-Ansicht': 'Go to live view',
  '1 Sitzung live': '1 session live', 'Sitzungen live': 'sessions live', 'Abgleich': 'Sync',
  'Suchen oder Befehl ausführen': 'Search or run a command', 'Suchen oder Befehl …': 'Search or command …',
  'Hinweise': 'Notifications', 'Server nicht erreichbar': 'Server unreachable',
  'Claude-Logs nicht lesbar': 'Claude logs not readable', 'Claude-Logs werden gelesen': 'Claude logs are being read',
  'Keine Verbindung zum Server. Angezeigt werden die zuletzt geladenen Werte — es wird weiter versucht.':
    'No connection to the server. Showing the last loaded values — still retrying.',
  'ist abgelaufen': 'has expired', 'läuft in': 'expires in', 'Tag ab': 'day', 'Tagen ab': 'days',
  'Angebot öffnen': 'Open quote', 'Neue Sitzungen werden nicht erfasst.': 'New sessions are not being recorded.',
  'offen': 'open', 'keine offenen': 'none open', 'Alle erledigen': 'Dismiss all', 'Erledigt': 'Done',
  'Alles erledigt. Neue Hinweise erscheinen hier.': 'All done. New notifications appear here.',
  'Fällige Rechnungen, Budget, Blocker und vergessene Timer meldet die Pro-Version.':
    'Pro reports due invoices, budgets, blockers and forgotten timers.',
  'Früher': 'Earlier', 'Befehl': 'Command', 'Einstellung': 'Setting', 'Seite': 'Page',
  'Vorgang': 'Job', 'Zuletzt': 'Recent', 'Beleg': 'Document', 'Belege': 'Documents', 'Befehle': 'Commands',
  'Seiten': 'Pages', 'Lead': 'Lead', 'Kunde': 'Customer', 'abgerechnet': 'invoiced',
  'Zeitraum: Monat': 'Period: month', 'Zeitraum: Quartal': 'Period: quarter', 'Zeitraum: Jahr': 'Period: year',
  'globaler Zeitraum': 'global period', 'Rechnung erstellen': 'Create invoice', 'Angebot erstellen': 'Create quote',
  'Sprache wechseln': 'Switch language',
  'Vorgang, Beleg, Kontakt, Einstellung … oder > für Befehle': 'Job, document, contact, setting … or > for commands',
  'wählen': 'select', 'öffnen': 'open', 'nur Befehle': 'commands only', 'nur Vorgänge': 'jobs only',
  'Nichts gefunden für': 'Nothing found for',
  'Timer, Nachtrag, Wochenansicht und Kalender — manuelle Arbeitszeit fließt in Arbeitswert, Marge und Rechnung.':
    'Timer, manual entries, week view and calendar — manual time flows into work value, margin and invoice.',
  'Stundensatz': 'Hourly rate', 'Selbstkosten je Stunde': 'Own cost per hour', 'Zielmarge': 'Target margin',
  'Abo-Preis': 'Subscription price', 'Wechselkurs': 'Exchange rate', 'Pausenschwelle': 'Break threshold',
  'Zeitmodell': 'Time model', 'Sprache': 'Language', 'Stundensätze je Projekt': 'Rates per project',
  'Positionsvorlagen': 'Line item templates', 'IBAN': 'IBAN', 'Steuernummer': 'Tax number',
  'Zahlungsziel': 'Payment terms', 'Kleinunternehmer': 'Small business', 'Lokale Modelle': 'Local models',
  'Sätze & Marge': 'Rates & margin', 'Allgemein': 'General', 'Stundensätze': 'Rates', 'Stammdaten': 'Master data',
  'gestellt': 'issued', 'storniert': 'cancelled', 'angenommen': 'accepted', 'abgelehnt': 'declined', 'erstellt': 'issued',
});

const ICON = {
  hub: '<rect x="2" y="2" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="10" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/><rect x="2" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5"/><rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor"/>',
  analyse: '<rect x="2" y="10" width="3.5" height="6" rx="1" fill="currentColor"/><rect x="7.25" y="6" width="3.5" height="10" rx="1" fill="currentColor"/><rect x="12.5" y="2" width="3.5" height="14" rx="1" fill="currentColor"/>',
  live: '<circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="3" fill="#57c98a"/>',
  zeit: '<circle cx="9" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="8.2" y="6" width="1.6" height="4.6" rx=".8" fill="currentColor"/><rect x="7" y="1.2" width="4" height="1.6" rx=".8" fill="currentColor"/>',
  vorgaenge: '<rect x="2" y="3" width="14" height="2" rx="1" fill="currentColor"/><rect x="2" y="8" width="10" height="2" rx="1" fill="currentColor"/><rect x="2" y="13" width="12" height="2" rx="1" fill="currentColor"/>',
  angebote: '<rect x="3" y="2" width="12" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="6" y="6" width="6" height="1.6" rx=".8" fill="currentColor"/>',
  rechnungen: '<rect x="3" y="2" width="12" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="6" y="6" width="6" height="1.6" rx=".8" fill="currentColor"/><rect x="6" y="10" width="4" height="1.6" rx=".8" fill="currentColor"/>',
  kontakte: '<circle cx="9" cy="6" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="11" width="12" height="5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  einstellungen: '<circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"/><circle cx="9" cy="9" r="2.4" fill="currentColor"/>',
};
const svgIcon = (k) => '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">' + ICON[k] + '</svg>';

// Reihenfolge und Gruppen der Navigation wie im Entwurf.
const SEITEN = [
  { k: 'hub', l: 'Hub', gruppe: 'Analyse' },
  { k: 'analyse', l: 'Analyse' },
  { k: 'live', l: 'Live' },
  { k: 'zeit', l: 'Zeiterfassung' },
  { k: 'vorgaenge', l: 'Vorgänge' },
  { k: 'angebote', l: 'Angebote', gruppe: 'Abrechnung' },
  { k: 'rechnungen', l: 'Rechnungen' },
  { k: 'kontakte', l: 'Kontakte' },
  { k: 'einstellungen', l: 'Einstellungen', gruppe: 'System' },
];
// Seiten ohne Zeitbezug: der Zeitraum filtert dort nichts.
const OHNE_ZEITRAUM = ['kontakte', 'einstellungen'];

const ZEITRAUM_LABEL = {
  heute: 'Heute', woche: 'Woche', monat: 'Monat', letzter: 'Letzter M.',
  quartal: 'Quartal', jahr: 'Jahr', gesamt: 'Gesamt', frei: 'Frei…',
};
const ZEITRAUM_TITEL = { letzter: 'Letzter Monat', frei: 'Frei' };

// Der Schalter fuer einen spaeteren Pro-Schnitt (R16): 2.0 ist frei fuer alle,
// deshalb immer an. Sperrkarten und Pro-Pillen bleiben im Code und erscheinen
// nur, wenn er aus ist — mit Lizenz hiesse das wieder
// !!(state.summary && state.summary.pro && state.summary.pro.aktiv).
// Noch nicht gebaute Pro-Funktionen (Zeiterfassung, Kanban, Mahnen, Versand,
// Budget) erscheinen bei offenem Schalter gar nicht.
const proAktiv = () => true;
// Seiten ohne die noch nicht gebauten Pro-Seiten.
const sichtbareSeiten = () => SEITEN.filter((s) => !(s.pro && proAktiv()));

/* ---------- Zeitraum ---------- */
state.zeitraumArt = lies('zeitraum', 'monat');
state.frei = liesJson('frei', {});
// Gemerkt, damit "Gesamt" nicht erst mit dem Jahresanfang laedt; zeitraum() prueft die Form.
state.ersterTag = lies('erster.tag', null);
state.vergleich = lies('vergleich', '1') === '1';
const aktuellerZeitraum = () => zeitraum(state.zeitraumArt, null, state.frei, state.ersterTag);

function zeitraumText(z) {
  if (z.von === z.bis) return datum(z.von);
  const [y1, m1] = z.von.split('-'), [y2, m2] = z.bis.split('-');
  if (istDE() && y1 === y2 && m1 === m2) return z.von.slice(8) + '.–' + datum(z.bis);
  return datum(z.von) + ' – ' + datum(z.bis);
}

/* ---------- Laden ---------- */
let ladeLauf = 0;
async function ladeSummary() {
  const lauf = ++ladeLauf;
  const z = aktuellerZeitraum();
  // Neuer Zeitraum: der alte Stand gehoert nicht unter die neue Ueberschrift —
  // auch nicht, wenn das Laden scheitert. Gleicher Zeitraum (60-s-Takt) behaelt ihn.
  const schluessel = [z.von, z.bis, state.vergleich].join('|');
  if (state.summarySchluessel !== schluessel) {
    state.summarySchluessel = schluessel;
    state.summary = null;
    state.vorher = null;
    zeichneAnsicht();
  }
  try {
    const [jetzt, vorher] = await Promise.all([
      hole('/api/summary?' + abfrage({ from: z.von, to: z.bis })),
      state.vergleich && z.vorVon ? hole('/api/summary?' + abfrage({ from: z.vorVon, to: z.vorBis })).catch(() => null) : null,
    ]);
    if (lauf !== ladeLauf) return;          // inzwischen neuer Zeitraum gewaehlt
    state.summary = jetzt;
    // Erster Tag mit Daten: Beginn von "Gesamt". Aendert er sich, laedt der neue Schluessel nach.
    if (jetzt && jetzt.erster_tag && jetzt.erster_tag !== state.ersterTag) {
      state.ersterTag = jetzt.erster_tag; merke('erster.tag', jetzt.erster_tag);
      if (state.zeitraumArt === 'gesamt') { ladeSummary(); return; }
    }
    state.vorher = vorher;
    state.fehler.summary = false;
    if (state.codeStand && jetzt.codeStand !== state.codeStand) state.codeSprung = true;
    state.codeStand = state.codeStand || jetzt.codeStand;
  } catch {
    state.fehler.summary = true;
  }
  zeichneRahmen();
  zeichneAnsicht();
}

async function ladeLive() {
  // Zeit-Hinweise (Blocker-Beginn) im selben Takt; ein Fehler dort laesst den alten Stand stehen.
  // catch hinter then: auch ein Fehler beim Melden darf den Live-Takt nicht reissen.
  const hw = hole('/api/zeit-hinweise').then((r) => { state.zeitHinweise = r.hinweise; state.fehler.zeitHinweise = null; zHinweiseMelden(); })
    .catch((e) => { state.fehler.zeitHinweise = e.message; console.error('/api/zeit-hinweise:', e.message); });
  try {
    state.live = await hole('/api/live?minutes=60');
    state.fehler.live = false;
  } catch { state.fehler.live = true; }
  await hw;
  if (state.glockeOffen) zeichneGlocke();
  zeichneMiniLive();
  zeichneMiniTimer();
  zeichneKopf();
  const a = ANSICHTEN[route().name];
  if (a && a.live) a.live();
}

// Belege und Kontakte fuer Suche, Hinweise und Hub. Selten geaendert.
async function ladeBelege() {
  const nichts = (pfad) => (e) => { console.error(pfad + ':', e.message); return null; };
  const [r, a, k] = await Promise.all([
    hole('/api/rechnungen').catch(nichts('/api/rechnungen')),
    hole('/api/angebote').catch(nichts('/api/angebote')),
    hole('/api/kontakte').catch(nichts('/api/kontakte')),
  ]);
  // Ohne ersten Stand bleibt die Liste null: "nicht geladen" ist etwas anderes
  // als "keine Rechnungen". Ein spaeterer Fehler behaelt den alten Stand.
  state.rechnungen = r ? r.rechnungen : state.rechnungen || null;
  state.angebote = a ? a.angebote : state.angebote || null;
  state.kontakte = k ? k.kontakte : state.kontakte || null;
  state.fehler.belege = !(r && a && k);
  if (!state.fehler.belege) state.belegeStand = Date.now();
  zeichneKopf();
  zeichneAnsicht();
}

/* ---------- Seitenleiste ---------- */
function liveSitzungen() {
  if (!state.live) return 0;
  return new Set(state.live.sessions.filter((s) => istAktiv(s.last_ts)).map((s) => s.session_id)).size;
}

function zeichneLeiste() {
  const r = route().name;
  let html = '<div class="leiste-kopf">' +
    '<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1c1c20"/><rect x="7" y="17" width="4" height="9" fill="#f97316"/><rect x="14" y="11" width="4" height="15" fill="#f97316"/><rect x="21" y="6" width="4" height="20" fill="#f97316"/></svg>' +
    '<div class="marke nur-breit"><b>c2invoice</b><span>lokal</span></div>' +
    '<button type="button" class="einklappen" data-aktion="leiste" aria-label="' + esc(uebersetze('Seitenleiste ein-/ausklappen')) + '">' +
      (document.getElementById('rahmen').classList.contains('schmal') ? '»' : '«') + '</button>' +
  '</div><nav class="nav" aria-label="' + esc(uebersetze('Hauptnavigation')) + '">';
  for (const s of sichtbareSeiten()) {
    if (s.gruppe) {
      html += '<div class="gruppe nur-breit">' + esc(uebersetze(s.gruppe)) + '</div>';
      if (s.gruppe !== 'Analyse') html += '<div class="trenner nur-schmal"></div>';
    }
    const extra = s.k === 'live' ? '<span class="zaehler" id="nav-live">' + liveSitzungen() + '</span>'
      : s.k === 'zeit' ? '<span class="zaehler laeuft" id="nav-zeit"' + (state.live && state.live.timer ? '' : ' hidden') + '>' + esc(uebersetze('läuft')) + '</span>'
        : s.pro && !proAktiv() ? '<span class="pille pro">Pro</span>' : '';
    html += '<a href="#/' + s.k + '" title="' + esc(uebersetze(s.l)) + '"' + (r === s.k ? ' aria-current="page"' : '') + '>' +
      svgIcon(s.k) + '<span class="name nur-breit">' + esc(uebersetze(s.l)) + extra + '</span></a>';
  }
  html += '</nav>' +
    '<div class="zeitraum-wahl nur-breit" id="zeitraum-wahl"></div>' +
    '<div class="mini-timer" id="mini-timer" hidden></div>' +
    '<a class="mini-live" id="mini-live" href="#/live"></a>';
  document.getElementById('leiste').innerHTML = html;
  zeichneZeitraumWahl();
  zeichneMiniLive();
  zeichneMiniTimer();
}

// Laufender Timer ueber der Mini-Live-Karte, auf jeder Seite; Stopp bucht (zeit.js).
function zeichneMiniTimer() {
  const el = document.getElementById('mini-timer');
  const t = state.live && state.live.timer;
  const nav = document.getElementById('nav-zeit');
  if (nav) nav.hidden = !t;
  if (el) {
    el.hidden = !t;
    el.innerHTML = t ? '<a href="#/zeit" title="' + esc(uebersetze('Zur Zeiterfassung')) + '">' +
        '<span class="oben"><span class="puls orange"></span><span class="nur-breit">' + esc(uebersetze('Timer')) + '</span>' +
          '<span class="uhr mono zeit-uhr nur-breit">' + uhrText(Date.now() - Date.parse(t.start)) + '</span></span>' +
        '<span class="ziel nur-breit">' + esc(zielKurz(t.ziel_art, t.ziel_schluessel) + ' · ' + t.taetigkeit) + '</span></a>' +
      '<button type="button" class="stopp nur-breit" data-aktion="zeit-stopp" title="' + esc(uebersetze('Stoppen und buchen')) + '" aria-label="' + esc(uebersetze('Stoppen und buchen')) + '"><span></span></button>' : '';
  }
  uhrTakt();
}
// Die Uhr tickt nur, solange ein Timer laeuft; jedes Element mit .zeit-uhr folgt.
let uhrIntervall = null;
function uhrTakt() {
  const t = state.live && state.live.timer;
  if (t && !uhrIntervall) uhrIntervall = setInterval(tickUhr, 1000);
  if (!t && uhrIntervall) { clearInterval(uhrIntervall); uhrIntervall = null; }
  tickUhr();
}
function tickUhr() {
  const t = state.live && state.live.timer;
  const text = t ? uhrText(Date.now() - Date.parse(t.start)) : '00:00:00';
  for (const el of document.querySelectorAll('.zeit-uhr')) el.textContent = text;
}
function uhrText(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
}

function zeichneZeitraumWahl() {
  const el = document.getElementById('zeitraum-wahl');
  if (!el) return;
  const z = aktuellerZeitraum();
  const aus = OHNE_ZEITRAUM.includes(route().name);
  el.classList.toggle('aus', aus);
  el.title = aus ? uebersetze('Der Zeitraum filtert hier nichts') : '';
  el.innerHTML =
    '<div class="zeile"><span>' + esc(uebersetze('Zeitraum')) + '</span><span>' + esc(zeitraumText(z)) + '</span></div>' +
    '<div class="knoepfe" role="group" aria-label="' + esc(uebersetze('Zeitraum')) + '">' +
      ZEITRAEUME.map((k) => '<button type="button" data-aktion="zeitraum" data-wert="' + k + '" aria-pressed="' + (state.zeitraumArt === k) + '">' +
        esc(uebersetze(ZEITRAUM_LABEL[k])) + '</button>').join('') +
    '</div>' +
    (state.zeitraumArt === 'frei'
      ? '<div class="frei"><input type="date" id="frei-von" value="' + esc(z.von) + '" aria-label="' + esc(uebersetze('von')) + '">' +
        '<input type="date" id="frei-bis" value="' + esc(z.bis) + '" aria-label="' + esc(uebersetze('bis')) + '"></div>'
      : '') +
    // Gesamt hat keine Vorperiode: der Schalter bleibt stehen, ist aber aus.
    '<button type="button" class="kippschalter" role="switch" data-aktion="vergleich" aria-checked="' + state.vergleich + '"' +
      (z.vorVon ? '' : ' disabled title="' + esc(uebersetze('Bei Gesamt gibt es keine Vorperiode')) + '"') + '>' +
      '<span class="spur"></span>' + esc(uebersetze('Vergleich zur Vorperiode')) + '</button>';
}

function zeichneMiniLive() {
  const el = document.getElementById('mini-live');
  if (!el) return;
  const n = liveSitzungen();
  const L = state.live;
  const m = L && L.minuten ? L.minuten.slice(-20) : [];
  const max = Math.max(...m, 1);
  el.classList.toggle('ruhe', n === 0);
  el.title = uebersetze('Zur Live-Ansicht');
  el.innerHTML = '<div class="oben"><span class="puls"></span><span class="nur-breit">' +
      esc(n === 1 ? uebersetze('1 Sitzung live') : n + ' ' + uebersetze('Sitzungen live')) + '</span></div>' +
    '<div class="unten nur-breit"><span class="rate">' + (L ? nf2.format(L.burn_usd_per_hour) : '–') + '<small>USD/h</small></span>' +
      '<div class="strom-mini" aria-hidden="true">' +
        m.map((v, i) => '<span style="height:' + Math.max(8, v / max * 100).toFixed(0) + '%;opacity:' + (0.35 + i / 30).toFixed(2) + '"></span>').join('') +
      '</div></div>';
  const z = document.getElementById('nav-live');
  if (z) z.textContent = String(n);
}

/* ---------- Kopfzeile ---------- */
function verbindungsStatus() {
  const s = state.summary;
  if (state.fehler.summary || state.fehler.live) return { stufe: 'fehler', text: 'Server nicht erreichbar' };
  // Die Fehlermeldung im Wortlaut gehoert dazu — ohne sie sucht man blind (Pfad, Rechte).
  if (s && s.lastIngest && s.lastIngest.error) return { stufe: 'fehler', text: 'Claude-Logs nicht lesbar', detail: String(s.lastIngest.error) };
  return { stufe: 'ok', text: 'Claude-Logs werden gelesen' };
}

function zeichneKopf() {
  const el = document.getElementById('kopf');
  if (!el) return;
  const r = route().name;
  const seite = SEITEN.find((s) => s.k === r);
  const z = aktuellerZeitraum();
  const mitZeitraum = !OHNE_ZEITRAUM.includes(r);
  const ingest = state.summary && state.summary.lastIngest;
  const vs = verbindungsStatus();
  const n = hinweise().length;
  document.title = zTitel(document.title);
  el.innerHTML =
    '<div class="titel"><h1>' + esc(uebersetze(seite ? seite.l : 'Hub')) + '</h1>' +
      (mitZeitraum ? '<span>' + esc(uebersetze(ZEITRAUM_TITEL[state.zeitraumArt] || ZEITRAUM_LABEL[state.zeitraumArt])) + ' · ' + esc(zeitraumText(z)) + '</span>' : '') +
    '</div>' +
    '<div class="rechts">' +
      '<span class="abgleich" title="' + esc(uebersetze(vs.text) + (vs.detail ? ': ' + vs.detail : '')) + '"><span class="punkt' + (vs.stufe === 'ok' ? '' : ' fehler') + '"></span>' +
        '<span>' + esc(uebersetze('Abgleich')) + ' ' + esc(ingest && ingest.at ? vor(ingest.at) : '–') + '</span></span>' +
      '<button type="button" class="knopf" data-aktion="abgleich">' + esc(uebersetze('Abgleich')) + '</button>' +
      '<button type="button" class="suche-knopf" data-aktion="suche" title="' + esc(uebersetze('Suchen oder Befehl ausführen')) + '">' +
        '<span class="lupe"></span><span class="text">' + esc(uebersetze('Suchen oder Befehl …')) + '</span><span class="taste">⌘K</span></button>' +
      '<button type="button" class="glocke" data-aktion="glocke" aria-expanded="' + !!state.glockeOffen + '" aria-label="' + esc(uebersetze('Hinweise')) + '">' +
        '<span aria-hidden="true" style="display:flex;flex-direction:column;align-items:center"><span style="width:11px;height:10px;border:1.5px solid currentColor;border-bottom:0;border-radius:6px 6px 1px 1px"></span><span style="width:15px;height:1.5px;background:currentColor;border-radius:1px"></span><span style="width:4px;height:2px;margin-top:1px;background:currentColor;border-radius:0 0 3px 3px"></span></span>' +
        (n ? '<span class="zahl">' + n + '</span>' : '') +
      '</button>' +
    '</div>';
}

function zeichneBanner() {
  const el = document.getElementById('banner');
  if (state.codeSprung) {
    el.textContent = uebersetze('Der Server wurde seit dem Öffnen dieser Seite erneuert. ') +
      uebersetze('Bitte neu laden (Strg+R), sonst passen Oberfläche und Server nicht zusammen.');
    el.hidden = false;
  } else if (state.fehler.summary || state.fehler.live) {
    el.textContent = uebersetze('Keine Verbindung zum Server. Angezeigt werden die zuletzt geladenen Werte — es wird weiter versucht.');
    el.hidden = false;
  } else el.hidden = true;
}

function zeichneRahmen() {
  zeichneKopf();
  zeichneZeitraumWahl();
  zeichneBanner();
}

/* ---------- Hinweise (Glocke) ----------
   Frei: was sich ohne Zahlungsdaten sicher sagen laesst. Faellige und
   ueberfaellige Rechnungen brauchen Zahlungseingaenge (Pro) — ohne sie waere
   jede bezahlte Rechnung irgendwann "ueberfaellig". */
function hinweise() {
  const erledigt = liesJson('hinweise.erledigt', {});
  const liste = [];
  const vs = verbindungsStatus();
  if (vs.stufe !== 'ok') liste.push({ id: 'verbindung', heute: true, icon: '!', c: 'var(--bad)', t: uebersetze(vs.text), s: 'Neue Sitzungen werden nicht erfasst.', wann: '', aktion: 'Einstellungen', ziel: 'einstellungen' });
  const heute = isoTag(new Date());
  const in7 = isoTag(new Date(Date.now() + 7 * 86400000));
  for (const a of state.angebote || []) {
    if (a.status !== 'offen' || !a.gueltig_bis || a.gueltig_bis > in7) continue;
    const tage = Math.round((ausIso(a.gueltig_bis) - ausIso(heute)) / 86400000);
    liste.push({
      id: 'angebot:' + a.nr + ':' + a.gueltig_bis, heute: tage <= 1, icon: 'A', c: 'var(--warn)',
      t: tage < 0 ? a.nr + ' ' + uebersetze('ist abgelaufen')
        : a.nr + ' ' + uebersetze('läuft in') + ' ' + tage + ' ' + uebersetze(tage === 1 ? 'Tag ab' : 'Tagen ab'),
      s: (a.empfaenger || '') + ' · ' + eur(a.brutto_eur), wann: datum(a.gueltig_bis), aktion: 'Angebot öffnen', ziel: 'angebote',
    });
  }
  // Erinnerungen bei Blocker-Beginn (zeit.js): weggeklickt wird am Server, nicht hier.
  return liste.filter((h) => !erledigt[h.id]).concat(zHinweise());
}

function zeichneGlocke() {
  let el = document.getElementById('hinweise');
  if (!state.glockeOffen) {
    if (el) el.remove();
    const s = document.getElementById('schleier');
    if (s) s.remove();
    return;
  }
  if (!el) {
    const schleier = document.createElement('div');
    schleier.className = 'schleier'; schleier.id = 'schleier'; schleier.dataset.aktion = 'glocke';
    document.body.appendChild(schleier);
    el = document.createElement('div');
    el.id = 'hinweise'; el.className = 'popover hinweise'; el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', uebersetze('Hinweise'));
    document.body.appendChild(el);
  }
  const h = hinweise();
  const vs = verbindungsStatus();
  const gruppen = [['Heute', h.filter((x) => x.heute)], ['Früher', h.filter((x) => !x.heute)]].filter((g) => g[1].length);
  el.innerHTML = '<div class="k"><h2>' + esc(uebersetze('Hinweise')) + '</h2><span class="faint" style="font-size:11.5px">' +
      esc(h.length ? h.length + ' ' + uebersetze('offen') : uebersetze('keine offenen')) + '</span>' +
      (h.length ? '<button type="button" class="textknopf" style="margin-left:auto" data-aktion="hinweise-alle">' + esc(uebersetze('Alle erledigen')) + '</button>' : '') + '</div>' +
    '<button type="button" class="verbindung-zeile" data-aktion="gehe" data-wert="einstellungen"><span class="punkt" style="background:' + (vs.stufe === 'ok' ? 'var(--ok)' : 'var(--bad)') + '"></span><span style="flex:1">' + esc(uebersetze(vs.text)) + '</span><span class="faint">→</span></button>' +
    zGlockeZeile() +
    gruppen.map(([l, xs]) => '<span class="gruppe-l">' + esc(uebersetze(l)) + '</span>' + xs.map((x) =>
      '<div class="hw"><span class="ic" style="color:' + x.c + ';background:color-mix(in srgb,' + x.c + ' 14%,transparent)">' + esc(x.icon) + '</span>' +
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:0">' +
        '<div style="display:flex;align-items:baseline;gap:8px"><span class="t" style="flex:1">' + esc(x.t) + '</span><span class="wann">' + esc(x.wann) + '</span></div>' +
        '<span class="s">' + esc(uebersetze(x.s)) + '</span>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          (x.aktion ? '<button type="button" class="knopf klein geist" style="color:' + x.c + ';border-color:' + x.c + '" data-aktion="' + esc(x.aktionName || 'gehe') + '" data-wert="' + esc(x.ziel) + '">' + esc(uebersetze(x.aktion)) + '</button>' : '') +
          '<button type="button" class="knopf klein geist" data-aktion="' + esc(x.weg || 'hinweis-erledigt') + '" data-wert="' + esc(x.id) + '">' + esc(uebersetze('Erledigt')) + '</button>' +
        '</div></div></div>').join('')).join('') +
    (h.length ? '' : '<div class="leer">' + esc(uebersetze('Alles erledigt. Neue Hinweise erscheinen hier.')) + '</div>') +
    (proAktiv() ? '' : '<div class="hw" style="grid-template-columns:1fr"><span class="s"><span class="pille pro">Pro</span> ' +
      esc(uebersetze('Fällige Rechnungen, Budget, Blocker und vergessene Timer meldet die Pro-Version.')) + '</span></div>');
}

/* ---------- Befehlspalette (⌘K) ---------- */
const EINSTELLUNG_SUCHE = [
  ['Stundensatz', 'Sätze & Kosten', 'saetze'], ['Selbstkosten je Stunde', 'Sätze & Kosten', 'saetze'], ['Zielmarge', 'Allgemein', 'allgemein'],
  ['Abo-Preis', 'Sätze & Kosten', 'saetze'], ['Wechselkurs', 'Sätze & Kosten', 'saetze'], ['Pausenschwelle', 'Sätze & Kosten', 'saetze'],
  ['Zeitmodell', 'Allgemein', 'allgemein'], ['Sprache', 'Darstellung', 'darstellung'], ['Stundensätze je Projekt', 'Stundensätze', 'projekte'],
  ['Positionsvorlagen', 'Positionsvorlagen', 'vorlagen'], ['IBAN', 'Stammdaten', 'stammdaten'], ['Steuernummer', 'Stammdaten', 'stammdaten'],
  ['Zahlungsziel', 'Stammdaten', 'stammdaten'], ['Kleinunternehmer', 'Stammdaten', 'stammdaten'], ['Lokale Modelle', 'Lokale Modelle', 'lokal'],
  ['Bewegung reduzieren', 'Darstellung', 'darstellung'], ['CSV-Export', 'Daten & Export', 'daten'],
];
const falte = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const istAbgerechnet = (ticket) => {
  const a = state.summary && state.summary.abrechnung;
  return !!a && Object.prototype.hasOwnProperty.call(a, ticket);
};

function suchErgebnisse(q) {
  const roh = falte(q.trim());
  const nur = roh.startsWith('>') ? 'befehl' : roh.startsWith('#') ? 'vorgang' : null;
  const qq = nur ? roh.slice(1).trim() : roh;
  const passt = (...xs) => !qq || xs.some((x) => falte(x).includes(qq));
  const G = [];
  const S = state.summary || {};
  const befehle = [
    ['⇄', 'Zeitraum: Monat', 'globaler Zeitraum', () => setzeZeitraum('monat')],
    ['⇄', 'Zeitraum: Quartal', 'globaler Zeitraum', () => setzeZeitraum('quartal')],
    ['⇄', 'Zeitraum: Jahr', 'globaler Zeitraum', () => setzeZeitraum('jahr')],
    ['+', 'Rechnung erstellen', 'Beleg-Editor', () => geheZu('beleg/neu?art=rechnung')],
    ['+', 'Angebot erstellen', 'Beleg-Editor', () => geheZu('beleg/neu?art=angebot')],
    ['▶', 'Timer starten', 'Zeiterfassung', () => zeitPicker('timer')],
    ['+', 'Zeit nachtragen', 'Zeiterfassung', () => zeitNachtrag()],
    ['⇄', 'Sprache wechseln', 'Deutsch / English', () => setzeSprache(istDE() ? 'en' : 'de')],
  ];
  // Leeres Feld: zuletzt Geoeffnetes, sonst die juengsten Vorgaenge — dazu die Befehle.
  if (!qq && !nur) {
    const gemerkt = [].concat(liesJson('suche.zuletzt', [])).filter((r) => r && typeof r.ziel === 'string');
    const zuletzt = gemerkt.length ? gemerkt.map((r) => ({ ...r, tu: () => geheZu(r.ziel) }))
      : (S.tickets || []).slice().sort((a, b) => String(b.last_day).localeCompare(String(a.last_day))).slice(0, 3).map((t) => ({
        icon: '#', t: t.ticket, sub: t.project || '', meta: uebersetze('Vorgang'), mono: true, tu: () => geheZu('vorgaenge/' + encodeURIComponent(t.ticket)),
      }));
    if (zuletzt.length) G.push(['Zuletzt', zuletzt]);
    G.push(['Befehle', befehle.map(([icon, t, sub, tu]) => ({ icon, t: uebersetze(t), sub: uebersetze(sub), meta: uebersetze('Befehl'), befehl: true, tu }))]);
    return G;
  }
  if (nur !== 'befehl') {
    const belege = [
      ...(state.rechnungen || []).map((r) => ({ nr: r.nr, art: 'Rechnung', wer: r.empfaenger, betrag: r.brutto_eur, st: r.status, ziel: 'rechnungen' })),
      ...(state.angebote || []).map((a) => ({ nr: a.nr, art: 'Angebot', wer: a.empfaenger, betrag: a.brutto_eur, st: a.status, ziel: 'angebote' })),
    ];
    const direkt = !nur && qq.length >= 2 ? belege.filter((b) => falte(b.nr).startsWith(qq)) : [];
    if (direkt.length) G.push(['Beleg', direkt.slice(0, 3).map(belegTreffer)]);
    // Kunde wie im CSV: zugeordneter Kontakt, sonst der alte Freitext am Satz.
    const pk = S.projekt_kontakt || {};
    const kundeVon = (t) => (Object.hasOwn(pk, t.project) && pk[t.project].firma) || t.kunde || '';
    const vg = (S.tickets || []).filter((t) => passt(t.ticket, t.project, kundeVon(t))).slice(0, 5).map((t) => ({
      icon: '#', t: t.ticket, sub: [t.project, kundeVon(t)].filter(Boolean).join(' · '),
      meta: uebersetze(istAbgerechnet(t.ticket) ? 'abgerechnet' : 'offen'),
      mono: true, ziel: 'vorgaenge/' + encodeURIComponent(t.ticket), tu: () => geheZu('vorgaenge/' + encodeURIComponent(t.ticket)),
    }));
    if (vg.length) G.push(['Vorgänge', vg]);
    if (!nur) {
      const bl = belege.filter((b) => !direkt.includes(b) && passt(b.nr, b.art, b.wer)).slice(0, 4).map(belegTreffer);
      if (bl.length) G.push(['Belege', bl]);
      const ko = (state.kontakte || []).filter((k) => passt(k.firma, k.name, k.kundennummer)).slice(0, 3).map((k) => ({
        icon: '◎', t: k.firma || k.name, sub: [uebersetze(k.status === 'lead' ? 'Lead' : 'Kunde'), k.kundennummer].filter(Boolean).join(' · '),
        meta: '', tu: () => geheZu('kontakte/' + k.id),
      }));
      if (ko.length) G.push(['Kontakte', ko]);
      const ei = EINSTELLUNG_SUCHE.filter(([l, b]) => passt(uebersetze(l), uebersetze(b), l)).slice(0, 4).map(([l, b, id]) => ({
        icon: '⚙', t: uebersetze(l), sub: uebersetze(b), meta: uebersetze('Einstellung'), tu: () => geheZu('einstellungen/' + id),
      }));
      if (ei.length) G.push(['Einstellungen', ei]);
      const se = sichtbareSeiten().filter((s) => passt(uebersetze(s.l), s.l)).slice(0, 4).map((s) => ({
        icon: '→', t: uebersetze(s.l), sub: uebersetze('Seite'), meta: '', tu: () => geheZu(s.k),
      }));
      if (qq && se.length) G.push(['Seiten', se]);
    }
  }
  if (nur !== 'vorgang') {
    const bf = befehle.filter((b) => passt(uebersetze(b[1]), b[1], b[2])).slice(0, nur === 'befehl' || !qq ? 6 : 3)
      .map(([icon, t, sub, tu]) => ({ icon, t: uebersetze(t), sub: uebersetze(sub), meta: uebersetze('Befehl'), befehl: true, tu }));
    if (bf.length) G.push(['Befehle', bf]);
  }
  return G;
}
function belegTreffer(b) {
  return {
    icon: b.art === 'Rechnung' ? '€' : 'A', t: b.nr, sub: (b.wer || '') + ' · ' + eur(b.betrag), meta: uebersetze(b.st || ''),
    mono: true, ziel: b.ziel, tu: () => geheZu(b.ziel),
  };
}

let palette = null;   // { q, i, flach }
function oeffnePalette() {
  palette = { q: '', i: 0, flach: [] };
  state.glockeOffen = false;
  zeichneGlocke();
  const grund = document.createElement('div');
  grund.className = 'dialog-grund'; grund.id = 'palette';
  grund.innerHTML = '<div class="dialog palette" role="dialog" aria-modal="true" aria-label="' + esc(uebersetze('Suchen oder Befehl ausführen')) + '">' +
    '<div class="eingabe"><span style="width:12px;height:12px;border:1.5px solid var(--text-faint);border-radius:50%;flex:0 0 auto"></span>' +
      '<input id="palette-q" autocomplete="off" spellcheck="false" placeholder="' + esc(uebersetze('Vorgang, Beleg, Kontakt, Einstellung … oder > für Befehle')) + '"' +
      ' role="combobox" aria-expanded="true" aria-controls="palette-liste">' +
      '<span class="taste">Esc</span></div>' +
    '<div class="liste" id="palette-liste" role="listbox"></div>' +
    '<div class="fuss"><span><b>↑↓</b> ' + esc(uebersetze('wählen')) + '</span><span><b>Enter</b> ' + esc(uebersetze('öffnen')) + '</span>' +
      '<span><b>&gt;</b> ' + esc(uebersetze('nur Befehle')) + '</span><span><b>#</b> ' + esc(uebersetze('nur Vorgänge')) + '</span></div></div>';
  document.body.appendChild(grund);
  grund.addEventListener('mousedown', (e) => { if (e.target === grund) schliessePalette(); });
  const inp = document.getElementById('palette-q');
  inp.addEventListener('input', () => { palette.q = inp.value; palette.i = 0; zeichnePalette(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); schliessePalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); palette.i = Math.min(palette.flach.length - 1, palette.i + 1); zeichnePalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palette.i = Math.max(0, palette.i - 1); zeichnePalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = palette.flach[palette.i]; if (r) { merkeZuletzt(r); schliessePalette(); r.tu(); } }
  });
  zeichnePalette();
  inp.focus();
}
// Geoeffnete Treffer fuer "Zuletzt" merken (nur Ziel und Beschriftung).
function merkeZuletzt(r) {
  if (!r || !r.ziel) return;
  const alt = [].concat(liesJson('suche.zuletzt', [])).filter((x) => x && (x.ziel !== r.ziel || x.t !== r.t));
  merke('suche.zuletzt', [{ icon: r.icon, t: r.t, sub: r.sub, meta: r.meta, mono: r.mono, ziel: r.ziel }].concat(alt).slice(0, 3));
}
function schliessePalette() {
  const el = document.getElementById('palette');
  if (el) el.remove();
  palette = null;
  const k = document.querySelector('.suche-knopf');
  if (k) k.focus();
}
function zeichnePalette() {
  const liste = document.getElementById('palette-liste');
  if (!liste || !palette) return;
  const G = suchErgebnisse(palette.q);
  palette.flach = [];
  liste.innerHTML = G.map(([l, xs]) => '<span class="gruppe-l">' + esc(uebersetze(l)) + '</span>' + xs.map((r) => {
    const i = palette.flach.push(r) - 1;
    return '<button type="button" class="treffer" role="option" data-i="' + i + '" aria-selected="' + (i === palette.i) + '">' +
      '<span class="ic"' + (r.befehl ? ' style="color:var(--accent)"' : '') + '>' + esc(r.icon) + '</span>' +
      '<span class="haupt-t"><b' + (r.mono ? ' class="mono"' : '') + '>' + esc(r.t) + '</b><span>' + esc(r.sub) + '</span></span>' +
      '<span class="meta"' + (r.befehl ? ' style="color:var(--accent)"' : '') + '>' + esc(r.meta) + '</span></button>';
  }).join('')).join('') ||
    '<div class="leer">' + esc(uebersetze('Nichts gefunden für')) + ' „' + esc(palette.q) + '“.</div>';
  for (const b of liste.querySelectorAll('.treffer')) {
    b.addEventListener('click', () => { const r = palette.flach[Number(b.dataset.i)]; merkeZuletzt(r); schliessePalette(); r.tu(); });
    b.addEventListener('mousemove', () => {
      const i = Number(b.dataset.i);
      if (palette.i === i) return;
      palette.i = i;
      for (const x of liste.querySelectorAll('.treffer')) x.setAttribute('aria-selected', String(Number(x.dataset.i) === i));
    });
  }
  const an = liste.querySelector('[aria-selected="true"]');
  if (an) an.scrollIntoView({ block: 'nearest' });
}

/* ---------- Sprache ---------- */
function setzeSprache(neu) {
  if (!SPRACHEN.includes(neu) || neu === SPRACHE) return;
  SPRACHE = neu;
  merke('sprache', neu);
  document.documentElement.lang = neu;
  setzeFormate();
  zeige();
}

/* Bewegung reduzieren (R13): aus dem Browser-Speicher, nur on|off. */
function setzeBewegung() {
  document.documentElement.dataset.motion = bewegungAus(lies('motion', 'on'));
}

/* Nach einer Aenderung (Buchen, Zeitmodell) alles Betroffene frisch holen. */
function neuLaden() {
  if (typeof hubDaten !== 'undefined') hubDaten.zeit = 0;
  ladeLive();
  ladeSummary();
}

/* ---------- Aktionen ---------- */
function setzeZeitraum(art) {
  state.zeitraumArt = art;
  merke('zeitraum', art);
  zeichneRahmen();
  ladeSummary();
}
aktion('zeitraum', (art) => setzeZeitraum(art));
aktion('vergleich', () => {
  state.vergleich = !state.vergleich;
  merke('vergleich', state.vergleich ? '1' : '0');
  zeichneZeitraumWahl();
  ladeSummary();
});
aktion('leiste', () => {
  const r = document.getElementById('rahmen');
  r.classList.toggle('schmal');
  merke('leiste', r.classList.contains('schmal') ? 'schmal' : 'breit');
  zeichneLeiste();
});
aktion('abgleich', async (_, el) => {
  await mitLauf(el, async () => {
    try { await hole('/api/refresh'); } catch { /* Anzeige folgt ueber den Banner */ }
    await Promise.all([ladeSummary(), ladeLive()]);
  });
});
aktion('suche', () => oeffnePalette());
aktion('glocke', () => { state.glockeOffen = !state.glockeOffen; zeichneGlocke(); zeichneKopf(); });
aktion('gehe', (ziel) => { state.glockeOffen = false; zeichneGlocke(); geheZu(ziel); });
aktion('hinweis-erledigt', (id) => {
  const e = liesJson('hinweise.erledigt', {}); e[id] = 1; merke('hinweise.erledigt', e);
  zeichneGlocke(); zeichneKopf();
});
aktion('hinweise-alle', async () => {
  const alle = hinweise();
  const e = liesJson('hinweise.erledigt', {}); for (const h of alle.filter((x) => !x.weg)) e[h.id] = 1; merke('hinweise.erledigt', e);
  for (const h of alle.filter((x) => x.weg)) await zHinweisWeg(h.id);
  zeichneGlocke(); zeichneKopf();
});

function geheZu(pfad) {
  const ziel = '#/' + String(pfad).replace(/^#?\/?/, '');
  if (location.hash === ziel) zeige(); else location.hash = ziel;
}

/* ---------- Anzeige der Seite ---------- */
let gezeigt = null;
function zeige() {
  const r = route();
  const neu = gezeigt !== r.name;
  gezeigt = r.name;
  zeichneLeiste();
  zeichneRahmen();
  const wurzel = document.getElementById('ansicht');
  if (neu) {
    wurzel.classList.remove('ansicht');
    void wurzel.offsetWidth;                 // Einblendung neu starten
    wurzel.classList.add('ansicht');
    window.scrollTo(0, 0);
  }
  // Titel vor dem Zeichnen: Seiten ohne Eintrag in SEITEN (Beleg-Editor) setzen ihren eigenen.
  document.title = zTitel(uebersetze((SEITEN.find((s) => s.k === r.name) || {}).l || 'Hub') + ' · c2invoice');
  zeichneAnsicht(neu);
}
// Waehrend eine Kachel gezogen wird, ersetzt kein Nachladen (Live alle 15 s) das
// DOM — sonst verliert der Griff den Zeiger mitten im Ziehen. Verpasstes wird
// beim Loslassen nachgeholt.
// verpasst: null = nichts, sonst das neu-Flag des verpassten Aufrufs (Seitenwechsel).
let ziehtGerade = false, verpasst = null;
function ziehen(an) {
  ziehtGerade = an;
  if (!an && verpasst !== null) { const n = verpasst; verpasst = null; zeichneAnsicht(n); }
}
function zeichneAnsicht(neu) {
  if (ziehtGerade) { verpasst = !!verpasst || !!neu; return; }
  const r = route();
  const a = ANSICHTEN[r.name];
  if (a) a.zeichne(document.getElementById('ansicht'), r.teile, !!neu);
}

/* ---------- Start ---------- */
function start() {
  document.documentElement.lang = SPRACHE;
  setzeBewegung();
  const rahmen = document.getElementById('rahmen');
  if (lies('leiste', window.innerWidth < 1024 ? 'schmal' : 'breit') === 'schmal') rahmen.classList.add('schmal');
  let schmalVorher = window.innerWidth < 1024;
  window.addEventListener('resize', () => {
    const schmal = window.innerWidth < 1024;
    if (schmal !== schmalVorher) { schmalVorher = schmal; rahmen.classList.toggle('schmal', schmal); zeichneLeiste(); }
  });
  verdrahteAktionen(document.body);
  document.addEventListener('change', (e) => {
    if (e.target.id === 'frei-von' || e.target.id === 'frei-bis') {
      const von = document.getElementById('frei-von').value, bis = document.getElementById('frei-bis').value;
      if (von && bis) { state.frei = { von, bis }; merke('frei', state.frei); zeichneRahmen(); ladeSummary(); }
    }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (palette) schliessePalette(); else oeffnePalette(); }
    else if (e.key === 'Escape' && state.glockeOffen) { state.glockeOffen = false; zeichneGlocke(); zeichneKopf(); }
  });
  window.addEventListener('hashchange', zeige);
  zeige();
  ladeSummary();
  ladeLive();
  ladeBelege();
  setInterval(ladeLive, 15000);
  setInterval(ladeSummary, 60000);
  setInterval(ladeBelege, 120000);
}
