'use strict';
/* Wiederkehrende Bauteile als HTML-Bausteine plus eine einzige Klick-
   Delegation. Jede Seite baut ihr Markup als Zeichenkette; Knoepfe tragen
   data-aktion="name" und optional data-wert. Die Seite meldet ihre Aktionen
   mit aktion(name, fn) an — kein Zuhoerer je Knopf, der beim Neuzeichnen
   verloren ginge. */

Object.assign(EN, { 'Kein Treffer.': 'No match.' });

const AKTIONEN = Object.create(null);
function aktion(name, fn) { AKTIONEN[name] = fn; }

function verdrahteAktionen(wurzel) {
  wurzel.addEventListener('click', (e) => {
    const el = e.target.closest('[data-aktion]');
    if (!el || !wurzel.contains(el)) return;
    // Ein Link innerhalb einer klickbaren Zeile ist selbst gemeint, nicht die Zeile.
    const link = e.target.closest('a[href]');
    if (link && link !== el && el.contains(link)) return;
    const fn = AKTIONEN[el.dataset.aktion];
    if (!fn) return;
    e.preventDefault();
    fn(el.dataset.wert, el, e);
  });
}

/* Segment-Schalter. optionen = [[wert, beschriftung], …]. `geerbt` markiert
   den gedrueckten Wert als nur geerbt (Zeitmodell): gilt, ist aber nicht
   selbst gewaehlt. */
function segment(aktionName, optionen, aktuell, label, geerbt) {
  return '<div class="segment" role="group" aria-label="' + esc(uebersetze(label || '')) + '">' +
    optionen.map(([w, l]) => '<button type="button" data-aktion="' + esc(aktionName) + '" data-wert="' + esc(w) + '"' +
      ' aria-pressed="' + (w === aktuell) + '"' + (w === aktuell && geerbt ? ' class="geerbt"' : '') + '>' +
      esc(uebersetze(l)) + '</button>').join('') +
  '</div>';
}

// Info-„i“: Erklaertext hinter einem Knopf (Owner-Regel 05.10.2026).
// Knopf und Text sind getrennt, weil der Knopf meist im Kopf sitzt und der
// Text darunter. Der offene Zustand wird je Browser gemerkt.
function infoI(id) {
  const offen = lies('info.' + id, '0') === '1';
  return '<button type="button" class="info-i" data-aktion="info" data-wert="' + esc(id) + '"' +
    ' aria-expanded="' + offen + '" aria-controls="info-' + esc(id) + '"' +
    ' aria-label="' + esc(uebersetze('Erklärung')) + '">i</button>';
}
function infoText(id, text) {
  const offen = lies('info.' + id, '0') === '1';
  return '<div class="info-text" id="info-' + esc(id) + '"' + (offen ? '' : ' hidden') + '>' +
    esc(uebersetze(text)) + '</div>';
}
aktion('info', (id, el) => {
  const box = document.getElementById('info-' + id);
  if (!box) return;
  const offen = box.hidden;
  box.hidden = !offen;
  el.setAttribute('aria-expanded', String(offen));
  merke('info.' + id, offen ? '1' : '0');
});

// Fehlende Stammdaten (rechnung.fehlendeStammdaten liefert Konfig-Schluessel)
// lesbar benennen — "rechnung.aussteller.name" sagt niemandem, was fehlt.
const STAMM_FEHLT = {
  'rechnung.aussteller.name': 'Name',
  'rechnung.aussteller.anschrift': 'Anschrift',
  'rechnung.aussteller.steuernummer oder ustIdNr': 'Steuernummer oder USt-IdNr.',
  'rechnung.ustSatz oder kleinunternehmer': 'Umsatzsteuersatz über 0 oder Kleinunternehmer',
};
const fehltNamen = (liste) => liste.map((f) => uebersetze(Object.hasOwn(STAMM_FEHLT, f) ? STAMM_FEHLT[f] : f)).join(', ');

// Pro-Sperre ueber einer Karte: die Funktion gibt es, ohne Lizenz ist sie zu.
// Bei offenem Schalter (R16, proAktiv in shell.js) erscheint sie nicht.
function sperre(titel, satz) {
  if (proAktiv()) return '';
  return '<div class="sperre">' +
    '<span class="pille pro">Pro</span>' +
    '<span class="t">' + esc(uebersetze(titel)) + '</span>' +
    '<span class="s">' + esc(uebersetze(satz)) + '</span>' +
  '</div>';
}

/* Fokus auf einem Knopf ueber ein Neuzeichnen per innerHTML retten — das
   Hintergrund-Nachladen ersetzt sonst das Element unter der Tastatur. */
function fokusMerken(w) {
  const a = document.activeElement;
  if (!a || !w.contains(a) || !a.dataset.aktion) return null;
  return '[data-aktion="' + CSS.escape(a.dataset.aktion) + '"]' + (a.dataset.wert != null ? '[data-wert="' + CSS.escape(a.dataset.wert) + '"]' : '');
}
function fokusZurueck(w, sel) {
  const x = sel && w.querySelector(sel);
  if (x) x.focus();
}

/* Status-Pille fuer Belege und Kontakte. Der Status kommt fertig vom Server
   (status_abgeleitet), hier wird nur beschriftet; die Farbe steht je Status
   in app.css (.st-<status>). Unbekannte Werte bekommen die neutrale Pille. */
const STATUS_TEXT = {
  offen: 'offen', teilbezahlt: 'teilbezahlt', bezahlt: 'bezahlt', storniert: 'storniert', storno: 'Storno',
  angenommen: 'angenommen', abgelehnt: 'abgelehnt', abgelaufen: 'abgelaufen', abgerechnet: 'abgerechnet',
  lead: 'Lead', kunde: 'Kunde', umgewandelt: 'umgewandelt', verloren: 'verloren',
};
function pille(status) {
  const bekannt = Object.prototype.hasOwnProperty.call(STATUS_TEXT, status);
  return '<span class="pille st' + (bekannt ? ' st-' + status : '') + '">' + esc(uebersetze(bekannt ? STATUS_TEXT[status] : String(status || '–'))) + '</span>';
}

/* Dialog: Grund + Karte, schliesst mit Esc, Klick auf den Grund und
   [data-aktion="dialog-zu"]. Ein Dialog zur Zeit; der Fokus geht beim
   Schliessen dorthin zurueck, wo er vorher war. */
let dialogVorher = null;
function dialog(inhalt, label, breite) {
  schliesseDialog();
  dialogVorher = document.activeElement;
  const grund = document.createElement('div');
  grund.className = 'dialog-grund'; grund.id = 'dialog';
  grund.innerHTML = '<div class="dialog formular"' + (breite ? ' style="max-width:' + Number(breite) + 'px"' : '') +
    ' role="dialog" aria-modal="true" aria-label="' + esc(uebersetze(label || '')) + '">' + inhalt + '</div>';
  // Klicks laufen ueber die Delegation am body (start() in shell.js).
  document.body.appendChild(grund);
  grund.addEventListener('mousedown', (e) => { if (e.target === grund) schliesseDialog(); });
  grund.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); schliesseDialog(); } });
  // autofocus zuerst: eine Selektor-Liste faende sonst den Schliessen-Knopf im Kopf.
  const erstes = grund.querySelector('[autofocus]') || grund.querySelector('input, select, textarea, button');
  if (erstes) erstes.focus();
  return grund;
}
function schliesseDialog() {
  const el = document.getElementById('dialog');
  if (!el) return;
  el.remove();
  if (dialogVorher && document.contains(dialogVorher)) dialogVorher.focus();
  dialogVorher = null;
}
aktion('dialog-zu', () => schliesseDialog());

/* Kontakt-Suchfeld: Combobox nach WAI-ARIA statt <select>. Das versteckte Feld
   traegt Id und Daten-Attribute (attr), die Auswahl setzt es und loest ein
   bubbelndes change darauf aus — bestehende Handler bleiben. Die Eintraege
   stehen alle im Markup und werden nur ein- und ausgeblendet; ein Zustand
   ausserhalb des DOM gibt es nicht, ein Neuzeichnen ersetzt das Ganze.
   gruppen = [{ gruppe, liste: [{ wert, text, such }] }], gruppe leer = ohne
   Ueberschrift. Der Leer-Eintrag (leerText, Wert '') steht immer oben.
   ACHTUNG: attr und textAttr sind ungeescaptes Markup und duerfen nur Literale/Konstanten
   tragen, nie Nutzerdaten (Namen, Notizen, Suchtexte).
   textAttr: Attribute fuer das sichtbare Textfeld (id fuer label for, aria-describedby,
   aria-invalid); ohne id heisst es <id>-q.
   Programmatisch setzen: kontaktSucheSetze(feld, wert) — Text und Id laufen
   nie auseinander, ein change loest das nicht aus. */
let ksN = 0;
function kontaktSuche({ attr = '', textAttr = '', gruppen = [], leerText, wert = '', label }) {
  const m = / id="([^"]*)"/.exec(attr);
  const id = m ? m[1] : 'ks-' + (++ksN);
  // Eine unbekannte Id bleibt nicht im versteckten Feld stehen: Text und Id laufen nie auseinander.
  const gewuenscht = String(wert == null ? '' : wert);
  const aktuell = gruppen.some((g) => g.liste.some((e) => String(e.wert) === gewuenscht)) ? gewuenscht : '';
  const tm = / id="([^"]*)"/.exec(textAttr);
  let n = 0, text = '';
  const opt = (w, t, such, extra) => {
    const gew = String(w) === aktuell;
    if (gew && w !== '') text = t;
    return '<div class="ks-opt' + (extra || '') + '" role="option" id="' + id + '-o' + (n++) + '" data-wert="' + esc(w) + '"' +
      ' data-such="' + esc(String(such || '').toLowerCase()) + '" aria-selected="' + gew + '">' + esc(t) + '</div>';
  };
  const leerOpt = opt('', uebersetze(leerText), '', ' ks-leer');
  const liste = gruppen.map((g) => {
    const os = g.liste.map((e) => opt(e.wert, e.text, e.such)).join('');
    return g.gruppe ? '<div role="group" aria-label="' + esc(uebersetze(g.gruppe)) + '"><div class="ks-gruppe" aria-hidden="true">' + esc(uebersetze(g.gruppe)) + '</div>' + os + '</div>' : os;
  }).join('');
  return '<div class="ksuche">' +
    '<input type="hidden"' + attr + ' value="' + esc(aktuell) + '">' +
    '<input type="text" class="eingabe ks-text"' + textAttr + (tm ? '' : ' id="' + id + '-q"') + ' role="combobox" aria-expanded="false" aria-controls="' + id + '-l"' +
      ' aria-autocomplete="list" aria-label="' + esc(uebersetze(label || '')) + '" autocomplete="off" spellcheck="false"' +
      ' placeholder="' + esc(uebersetze(leerText)) + '" value="' + esc(text) + '">' +
    '<div class="ks-pop" hidden><div class="ks-liste" id="' + id + '-l" role="listbox" aria-label="' + esc(uebersetze(label || '')) + '">' + leerOpt + liste + '</div>' +
      '<div class="ks-keine" role="status"></div></div></div>';
}
const ksWurzel = (el) => (el && el.closest ? el.closest('.ksuche') : null);
const ksIstText = (el) => !!(el && el.classList && el.classList.contains('ks-text'));
const ksText = (w) => w.querySelector('.ks-text');
const ksOpts = (w) => [...w.querySelectorAll('[role="option"]')];
const ksOffen = (w) => !w.querySelector('.ks-pop').hidden;
const ksGewaehlt = (w) => w.querySelector('[role="option"][aria-selected="true"]');
function ksAktiv(w, o) {
  for (const x of w.querySelectorAll('.ks-opt.aktiv')) x.classList.remove('aktiv');
  if (o) { o.classList.add('aktiv'); ksText(w).setAttribute('aria-activedescendant', o.id); o.scrollIntoView({ block: 'nearest' }); }
  else ksText(w).removeAttribute('aria-activedescendant');
}
function ksFilter(w, q) {
  const teile = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let treffer = 0;
  for (const o of ksOpts(w)) {
    const leer = o.classList.contains('ks-leer');
    o.hidden = !leer && !teile.every((t) => o.dataset.such.includes(t));
    if (!o.hidden && !leer) treffer++;
  }
  for (const g of w.querySelectorAll('[role="group"]')) g.hidden = !g.querySelector('[role="option"]:not([hidden])');
  w.querySelector('.ks-keine').textContent = teile.length && !treffer ? uebersetze('Kein Treffer.') : '';
}
function ksAuf(w) {
  w.querySelector('.ks-pop').hidden = false;
  ksText(w).setAttribute('aria-expanded', 'true');
  ksFilter(w, '');
  ksAktiv(w, ksGewaehlt(w));
}
function ksZu(w) {
  w.querySelector('.ks-pop').hidden = true;
  ksText(w).setAttribute('aria-expanded', 'false');
  ksAktiv(w, null);
}
// Angezeigter Text zurueck auf die gewaehlte Person (Esc, Fokusverlust ohne Wahl).
function ksZurueck(w) {
  const g = ksGewaehlt(w);
  ksText(w).value = g && g.dataset.wert !== '' ? g.textContent : '';
}
function ksSetze(w, o, melde) {
  const h = w.querySelector('input[type="hidden"]');
  const alt = h.value;
  for (const x of ksOpts(w)) x.setAttribute('aria-selected', String(x === o));
  h.value = o ? o.dataset.wert : '';
  ksZurueck(w);
  if (melde && h.value !== alt) h.dispatchEvent(new Event('change', { bubbles: true }));
}
function kontaktSucheSetze(feld, wert) {
  const w = ksWurzel(feld);
  if (!w) return;
  const os = ksOpts(w);
  ksSetze(w, os.find((x) => x.dataset.wert === String(wert == null ? '' : wert)) || os[0], false);
}
// Ein Satz Zuhoerer fuer alle Instanzen; keydown in der Capture-Phase, damit Esc
// weder den Dialog noch den Editor schliesst, solange die Liste offen ist.
if (typeof document !== 'undefined') {   // ohne DOM (Tests per vm) nichts registrieren
document.addEventListener('focusin', (e) => {
  if (!ksIstText(e.target)) return;
  ksAuf(ksWurzel(e.target));
  e.target.select();
});
document.addEventListener('focusout', (e) => {
  if (!ksIstText(e.target)) return;
  const w = ksWurzel(e.target);
  ksZu(w); ksZurueck(w);
});
document.addEventListener('click', (e) => {
  if (!ksIstText(e.target)) return;
  const w = ksWurzel(e.target);
  if (!ksOffen(w)) ksAuf(w);
});
document.addEventListener('input', (e) => {
  if (!ksIstText(e.target) || e.isComposing) return;
  const w = ksWurzel(e.target);
  if (!ksOffen(w)) ksAuf(w);
  ksFilter(w, e.target.value);
  ksAktiv(w, e.target.value.trim() ? ksOpts(w).find((o) => !o.hidden && !o.classList.contains('ks-leer')) || null : ksGewaehlt(w));
});
document.addEventListener('keydown', (e) => {
  if (!ksIstText(e.target)) return;
  const w = ksWurzel(e.target);
  const auf = ksOffen(w);
  if (e.key === 'Escape') {
    if (!auf) return;
    e.preventDefault(); e.stopPropagation();
    ksZu(w); ksZurueck(w);
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!auf) { ksAuf(w); return; }
    const s = ksOpts(w).filter((o) => !o.hidden);
    const i = s.indexOf(w.querySelector('.ks-opt.aktiv'));
    ksAktiv(w, s[e.key === 'ArrowDown' ? (i + 1) % s.length : (i <= 0 ? s.length - 1 : i - 1)]);
  } else if (e.key === 'Enter' && auf) {
    e.preventDefault(); e.stopPropagation();
    const a = w.querySelector('.ks-opt.aktiv');
    if (a) { ksSetze(w, a, true); ksZu(w); }
  }
}, true);
// mousedown statt click: der Fokus bleibt im Feld, focusout schliesst die Liste nicht vor der Wahl.
document.addEventListener('mousedown', (e) => {
  const pop = e.target.closest && e.target.closest('.ks-pop');
  if (!pop) return;
  e.preventDefault();
  const o = e.target.closest('[role="option"]');
  if (o) { const w = ksWurzel(o); ksSetze(w, o, true); ksZu(w); }
});
}

const LEER_ZEICHEN = {
  liste: '<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  uhr: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6" fill="none"/>' +
       '<path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  beleg: '<path d="M6.5 3.5h11v17l-2.75-1.6-2.75 1.6-2.75-1.6L6.5 20.5z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>' +
         '<path d="M9.5 8.5h5M9.5 12h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  person: '<circle cx="12" cy="8.5" r="3.5" stroke="currentColor" stroke-width="1.6" fill="none"/>' +
          '<path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
};
// Leerzustand: Zeichen, ein Satz, die naechste Handlung — nie eine nackte Flaeche.
function leer(zeichen, titel, text, tat) {
  return '<div class="leer">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true">' + (LEER_ZEICHEN[zeichen] || LEER_ZEICHEN.liste) + '</svg>' +
    '<span class="gross">' + esc(uebersetze(titel)) + '</span>' +
    (text ? '<span>' + esc(uebersetze(text)) + '</span>' : '') +
    (tat || '') +
  '</div>';
}

/* Zeitmodell-Schalter (Sitzung oder Vorgang). Zwei Knoepfe, gedrueckt ist
   das geltende Modell; ohne eigene Wahl gedaempft mit Herkunft im Tooltip.
   Klick auf den geerbten Wert loescht die eigene Wahl (Owner-Regel 1.4). */
const ZEITMODELL_NAME = { eingaben: 'Eigene Zeit', aktivitaet: 'Aktivität' };
function zeitmodellSchalter(art, schluessel, wahl, erbt) {
  const gilt = wahl || erbt || 'eingaben';
  const tip = wahl ? uebersetze('Eigene Wahl') + ' · ' + uebersetze('Standard wäre') + ' ' + uebersetze(ZEITMODELL_NAME[erbt] || '–')
    : uebersetze('Geerbt aus Vorgang, Projekt oder Einstellungen');
  return '<div class="segment zm" role="group" aria-label="' + esc(uebersetze('Zeitmodell')) + '" title="' + esc(tip) + '">' +
    ['eingaben', 'aktivitaet'].map((m) => '<button type="button" data-aktion="zeitmodell" data-wert="' +
      esc(JSON.stringify({ art, schluessel, m, erbt: erbt || 'eingaben' })) + '" aria-pressed="' + (m === gilt) + '"' +
      (m === gilt && !wahl ? ' class="geerbt"' : '') + '>' + esc(uebersetze(ZEITMODELL_NAME[m])) + '</button>').join('') + '</div>';
}
aktion('zeitmodell', async (wert, el) => {
  let w;
  try { w = JSON.parse(wert); } catch { return; }
  const gruppe = el.parentElement;
  gruppe.classList.add('laeuft');
  try {
    await sende('/api/zeitmodell', { art: w.art, schluessel: w.schluessel, zeitmodell: w.m === w.erbt ? null : w.m });
    toast(uebersetze('Zeitmodell gespeichert') + ': ' + uebersetze(ZEITMODELL_NAME[w.m]), 'ok');
  } catch (e) {
    toast(uebersetze('Zeitmodell nicht gespeichert') + ': ' + e.message, 'err');
  }
  gruppe.classList.remove('laeuft');
  if (typeof neuLaden === 'function') neuLaden();
});

// Delta zur Vorperiode. `besserWennHoeher = false` dreht die Farbe fuer Kosten.
// Die Richtung steht als Pfeil und Vorzeichen da — nicht nur als Farbe.
function delta(jetzt, vorher, besserWennHoeher = true) {
  const a = Number(jetzt), b = Number(vorher);
  if (jetzt == null || vorher == null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return '';
  const d = (a - b) / Math.abs(b) * 100;
  const farbe = Math.abs(d) < 0.05 ? 'var(--text-faint)' : ((d >= 0) === besserWennHoeher ? 'var(--ok)' : 'var(--bad)');
  return '<span class="delta mono" style="color:' + farbe + '"' +
    ' title="' + esc(uebersetze('gegenüber der gleich langen Vorperiode')) + '">' +
    (d >= 0 ? '▲ +' : '▼ ') + nf1.format(d) + ' %</span>';
}

/* ---------- Nachladen je Bereich ----------
   Ein Eintrag je Schluessel, geteilt von Analyse und Hub. Neu geholt wird,
   wenn die Auswertung neu geladen wurde (Zeitraum, Abgleich) und der Stand
   aelter als `alter` ms ist. Nur die zuletzt gestartete Abfrage zaehlt;
   scheitert ein Nachladen, bleibt der alte Stand stehen. */
const bereichDaten = Object.create(null);
function ladeBereich(schluessel, pfad, alter = 0) {
  const e = bereichDaten[schluessel] || (bereichDaten[schluessel] = { d: null, fehler: null, bezug: null, zeit: 0, lauf: 0, laedt: false });
  const frisch = e.bezug === state.summary || (e.d && Date.now() - e.zeit < alter);
  // Laeuft schon eine Abfrage fuer denselben Stand, nicht doppelt holen; ein
  // neuer Stand (Zeitraum, Abgleich) startet eine neue, die aeltere verfaellt.
  if ((e.laedt && e.bezug === state.summary) || (frisch && (e.d || e.fehler))) return e;
  e.bezug = state.summary;
  e.laedt = true;
  const lauf = ++e.lauf;
  hole(pfad).then((d) => {
    if (lauf !== e.lauf) return;
    Object.assign(e, { d, fehler: null, zeit: Date.now(), laedt: false });
  }, (err) => {
    if (lauf !== e.lauf) return;
    e.laedt = false;
    if (!e.d) e.fehler = err.message || 'Fehler';
    else toast(uebersetze('Bereich nicht aktualisiert') + ': ' + (err.message || 'Fehler'), 'err');
  }).then(() => { if (['analyse', 'hub', 'projekte'].includes(route().name)) zeichneAnsicht(); });
  return e;
}
const bereichWarte = (e) => (e.d ? null : e.fehler
  ? leer('liste', 'Nicht geladen', e.fehler, '<button type="button" class="knopf klein" data-aktion="bereich-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
  : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>');
// Loeschen statt null setzen: ein null-Eintrag liesse den naechsten Klick an .fehler scheitern.
aktion('bereich-neu', () => { for (const k of Object.keys(bereichDaten)) if (bereichDaten[k].fehler) delete bereichDaten[k]; zeichneAnsicht(); });

/* Marge je Woche: Analyse-Karte und Hub-Widget holen denselben
   Stand (hoechstens alle 5 Min, Block-3-Ruling A2) und zeichnen ihn gleich;
   nur die Hoehe unterscheidet sich. */
const ladeMargeWochen = () => ladeBereich('marge-wochen', '/api/marge-wochen?' + abfrage({ bis: isoTag(new Date()) }), 300000);
function margeWochenHtml(e, hoehe) {
  if (!e.d) return e.fehler ? bereichWarte(e) : '<div class="leer">' + esc(uebersetze('Wochen-Marge lädt …')) + '</div>';
  const M = margeWochen(e.d);
  if (M.leer) return leer('liste', 'Keine Wochen-Marge', 'Ohne Erlös oder Selbstkostensatz gibt es keine Marge.');
  const f = (n) => n.toFixed(1);
  return '<svg viewBox="0 0 1000 220" preserveAspectRatio="none" class="ana-marge"' + (hoehe ? ' style="height:' + hoehe + 'px"' : '') + ' aria-hidden="true">' +
      '<line x1="0" y1="110" x2="1000" y2="110" stroke="var(--line-hover)" stroke-dasharray="4 4"/>' +
      M.balken.map((b) => '<rect x="' + f(b.x) + '" y="' + f(b.y) + '" width="' + f(b.w) + '" height="' + f(b.h) + '" rx="3" fill="' + b.farbe + '" opacity=".88"/>').join('') +
      (M.linie ? '<path d="' + M.linie + '" fill="none" stroke="var(--text)" stroke-width="1.5" stroke-opacity=".55" vector-effect="non-scaling-stroke"/>' : '') + '</svg>' +
    '<div class="ana-marge-achse" style="grid-template-columns:repeat(' + M.achse.length + ',1fr)">' + M.achse.map((a) =>
      '<span title="' + esc(uebersetze('Woche ab') + ' ' + datum(a.montag) + ' · ' + (a.v == null ? uebersetze('kein Erlös oder Selbstkostensatz') : nf1.format(a.marge) + ' %')) + '">' +
        esc(uebersetze('KW')) + ' ' + a.kw + '<br><span style="color:' + a.farbe + '">' + a.text + '</span></span>').join('') + '</div>';
}

/* ---------- Markdown (Sitzungen C6, Briefings und Gedaechtnis C9) ----------
   Erst esc, dann wenige Formen: Codeblock, Tabelle, Ueberschrift, Listen,
   Aufgaben (☐/☑ nur zur Anzeige), Zitat, **fett**, `code`, Links nur http(s),
   Wikilinks als Text oder mit { wiki: true } als Knopf (data-aktion gd-oeffne).
   HTML aus dem Text bleibt Text. Frontmatter oben wird ausgelassen. */
function md(text, { wiki = false } = {}) {
  let t = String(text == null ? '' : text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const fm = /^---\n[\s\S]*?\n---[ \t]*(\n|$)/.exec(t);
  if (fm) t = t.slice(fm[0].length);
  const inl = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|([^\]\n]+))?\]\]/g, (m, z, a) => (wiki
      ? '<button type="button" class="md-wiki" data-aktion="gd-oeffne" data-wert="' + z.trim() + '">' + (a || z).trim() + '</button>'
      : '<span class="md-wiki">' + (a || z).trim() + '</span>'));
  const zeilen = t.split('\n');
  const istZeile = (z) => /^\s*\|.*\|\s*$/.test(z || '');
  const zellen = (z) => z.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const aus = [];
  for (let i = 0; i < zeilen.length;) {
    const z = zeilen[i];
    let m;
    if (/^\s*```/.test(z)) {
      const b = [];
      for (i++; i < zeilen.length && !/^\s*```/.test(zeilen[i]); i++) b.push(zeilen[i]);
      i++;
      aus.push('<pre class="tz-code">' + esc(b.join('\n')) + '</pre>');
      continue;
    }
    if (istZeile(z) && /^\s*\|[\s:|-]+\|\s*$/.test(zeilen[i + 1] || '')) {
      const kopf = zellen(z);
      const reihen = [];
      for (i += 2; istZeile(zeilen[i]); i++) reihen.push(zellen(zeilen[i]));
      aus.push('<table class="tz-tab"><thead><tr>' + kopf.map((c) => '<th>' + inl(c) + '</th>').join('') + '</tr></thead><tbody>' +
        reihen.map((r) => '<tr>' + r.map((c) => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    i++;
    if ((m = /^(#{1,6})\s+(.*)/.exec(z))) aus.push('<div class="tz-h md-h' + m[1].length + '">' + inl(m[2]) + '</div>');
    else if ((m = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(z))) aus.push('<div class="md-li" style="--md-ebene:' + Math.min(4, Math.floor(m[1].length / 2)) + '"><span class="md-punkt" aria-hidden="true">' + (m[2] === ' ' ? '☐' : '☑') + '</span><span>' + inl(m[3]) + '</span></div>');
    else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(z))) aus.push('<div class="md-li" style="--md-ebene:' + Math.min(4, Math.floor(m[1].length / 2)) + '"><span class="md-punkt" aria-hidden="true">•</span><span>' + inl(m[2]) + '</span></div>');
    else if ((m = /^(\s*)(\d{1,3})[.)]\s+(.*)$/.exec(z))) aus.push('<div class="md-li" style="--md-ebene:' + Math.min(4, Math.floor(m[1].length / 2)) + '"><span class="md-punkt mono">' + m[2] + '.</span><span>' + inl(m[3]) + '</span></div>');
    else if ((m = /^>\s?(.*)$/.exec(z))) aus.push('<div class="md-zitat">' + inl(m[1]) + '</div>');
    else if (/^\s*(-{3,}|\*{3,})\s*$/.test(z)) aus.push('<hr class="md-linie">');
    else aus.push(z.trim() ? '<div>' + inl(z) + '</div>' : '<div class="tz-luft"></div>');
  }
  return aus.join('');
}
