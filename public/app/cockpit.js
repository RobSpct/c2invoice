'use strict';
/* Cira-Cockpit (Handoff README §5.3, Masterplan 3.0 C3): Buehne mit Orb und
   Szene, Gespraechsverlauf, Eingabe; rechts Heute, Braucht dich, Briefings und
   die festen Kacheln. Gerechnet wird hier nichts: Szenen liefert /api/cira/frage
   fertig, die Leiste kommt aus /api/kennzahlen und /api/freigaben. Diese Datei
   formatiert nur und legt Kurven und Balken auf die Flaeche. */

Object.assign(EN, {
  'Frag nach Zahlen, starte Skills, schreib Rechnungen …': 'Ask about numbers, start skills, write invoices …',
  'Frage an Cira im Cockpit': 'Question for Cira in the cockpit', 'Du': 'You', 'denkt nach …': 'is thinking …',
  'Zahlen zeigen': 'Show numbers', 'Chart zeigen': 'Show chart', 'Verteilung zeigen': 'Show breakdown', 'Entwurf zeigen': 'Show draft',
  'Wird gezeigt': 'Showing', 'Szene schließen': 'Close scene', 'Quelle': 'Source',
  'Vollbild': 'Full screen', 'Vollbild beenden': 'Exit full screen',
  'keine Arbeit': 'no work', 'kein Selbstkostensatz': 'no cost rate', 'keine Marge': 'no margin',
  'Stunden': 'Hours', 'API-Gegenwert': 'API equivalent', 'Abgerechnet': 'Invoiced', 'Offen': 'Open',
  'eigene Zeit zum Stundensatz': 'own time at hourly rate', 'Claude-Arbeit und manuell': 'Claude work and manual',
  'auf gestellten Rechnungen': 'on issued invoices', 'Arbeitswert noch ohne Rechnung': 'work value not yet invoiced',
  'Marge — nach Sachkosten und eigener Zeit': 'Margin — after material costs and own time',
  'Überfällig': 'Overdue', 'Überfällig gesamt': 'Overdue total', 'gesamt': 'total', 'letzte Woche': 'last week',
  'Rechnung · Entwurf': 'Invoice · Draft', 'Vorschau — maßgeblich ist der Beleg-Editor': 'Preview — the document editor is authoritative', 'Netto': 'Net', 'USt': 'VAT', 'Brutto': 'Gross',
  'ohne USt (Kleinunternehmer, § 19 UStG)': 'no VAT (small business, § 19 UStG)', 'Leistungszeitraum': 'Service period',
  'Braucht dich': 'Needs you', 'Nichts wartet auf dich. Cira meldet sich.': 'Nothing is waiting for you. Cira will let you know.',
  'Freigeben': 'Approve', 'Ablehnen': 'Decline', 'Freigegeben': 'Approved', 'Abgelehnt': 'Declined',
  'noch keine Aktion · nur Ablehnen': 'no action yet · decline only',
  'Briefings kommen mit Block C9 des Ausbaus.': 'Briefings arrive with block C9 of the build-out.',
  'Skills starten': 'Start skills', 'Tagesbericht vorlesen': 'Read daily report', 'Timer stoppen + buchen': 'Stop timer + book',
  'Frag mich nach Zahlen — oder tipp einen Vorschlag unten an. Direkte Antworten (T0) kosten nichts.': 'Ask me about numbers — or tap a suggestion below. Direct answers (T0) cost nothing.',
  'Heute — Stunden aus Claude-Arbeit und manuell': 'Today — hours from Claude work and manual',
  'Orb-Stil': 'Orb style', 'Bühne im Cockpit · Partikel oder ruhige Fläche': 'Cockpit stage · particles or calm surface', 'Partikel': 'Particles', 'Ruhige Fläche': 'Calm surface',
  'Fehler': 'Error', 'wartet': 'waiting', 'läuft': 'running',
  'Rechnung': 'Invoice', 'Mahnung': 'Reminder', 'Mail': 'Mail', 'Jira-Kommentar': 'Jira comment', 'Rückfrage': 'Question',
  'Plan-Schritt': 'Plan step', 'Flow-Fehler': 'Flow error', 'Rechnungsserie': 'Invoice series',
  // C4: Herleitung, Rechnungsentwurf, Skills, Benachrichtigung
  'Wie entstanden?': 'How was this derived?', 'Herleitung': 'Derivation', '↻ Nochmal': '↻ Replay', 'Herleitung schließen': 'Close derivation',
  'Fertig · alles nachvollziehbar': 'Done · fully traceable', 'Rechenweg aus c2invoice · kein Modell': 'Calculation from c2invoice · no model',
  'Herleitung lädt …': 'Loading derivation …', 'Entwurf — Freigeben stellt die Rechnung': 'Draft — approving issues the invoice',
  'Rechnung {nr} gestellt': 'Invoice {nr} issued', 'Zu den Rechnungen': 'To invoices', 'Rechnungsentwurf': 'Invoice draft',
  'projekt': 'project', 'global': 'global', 'Arbeitsbereich': 'Workspace', '{n} weitere': '{n} more',
  'Keine Skills gefunden (~/.claude/skills und .claude/skills im Arbeitsbereich).': 'No skills found (~/.claude/skills and .claude/skills in the workspace).',
  'Meldung schließen': 'Close notice', 'In „Braucht dich“ ansehen': 'View in “Needs you”',
  'Desktop-Benachrichtigung': 'Desktop notification', 'zusätzlich zur Karte in der Seite, wenn der Tab im Hintergrund liegt · nicht im Nicht-stören-Fenster': 'in addition to the in-page card when the tab is in the background · not during do-not-disturb',
  'Dieser Browser kennt keine Desktop-Benachrichtigungen.': 'This browser has no desktop notifications.',
  'Der Browser erlaubt keine Benachrichtigungen. In den Seiten-Einstellungen freigeben und erneut einschalten.': 'The browser does not allow notifications. Allow them in the site settings and switch on again.',
  // C6b: Skill-Ablauf
  'Ablauf zeigen': 'Show run', 'Skill-Ablauf': 'Skill run', 'Ablauf starten': 'Start run', 'Ablauf · {ab}': 'Run · {ab}',
  'Ziel (optional)': 'Goal (optional)', 'Worum geht es? Wird an den Skill angehängt.': 'What is it about? Appended to the skill.',
  'Startet eine Claude-Sitzung im Arbeitsbereich. Kostet Claude-Nutzung.': 'Starts a Claude session in the workspace. Uses Claude.',
  'als Nächstes': 'next', 'Schritt läuft …': 'Step running …', 'wartet auf dich': 'waiting for you', 'erledigt': 'done', 'gestoppt': 'stopped',
  'Ergebnis': 'Result', '{n} Dateien geschrieben': '{n} files written', 'Keine Antwort von Claude.': 'No answer from Claude.',
  'Freigeben und mit {b} weitermachen?': 'Approve and continue with {b}?', 'Freigeben und Ablauf abschließen? Die Sitzung läuft weiter.': 'Approve and finish the run? The session keeps running.',
  'Ergänzung oder Einwand … (Enter = freigeben mit Hinweis)': 'Addition or objection … (Enter = approve with note)', 'Hinweis zum Schritt': 'Note on the step',
  'Freigeben mit Hinweis': 'Approve with note', 'Neu bauen': 'Rebuild', 'Schritt mit deinem Hinweis neu ausführen': 'Run the step again with your note',
  'Stopp': 'Stop', 'Ablauf stoppen. Warum? Der Grund kommt ins Vorgangs-Log.': 'Stop the run. Why? The reason goes into the item log.',
  'Oder eigener Grund …': 'Or your own reason …', 'Zurück': 'Back', 'Grund für den Stopp': 'Reason for stopping',
  'Plan passt nicht': 'Plan does not fit', 'Zu teuer': 'Too expensive', 'Mache ich selbst': 'I will do it myself', 'Später': 'Later',
  'Gestoppt nach Schritt {n}': 'Stopped after step {n}', 'Grund': 'Reason', 'im Vorgangs-Log {v} notiert': 'noted in the item log of {v}', 'Neu starten': 'Start again',
  'Ablauf abgeschlossen · Sitzung läuft weiter': 'Run finished · session keeps running', 'bucht auf {v}': 'books to {v}', 'Zur Sitzung': 'To session',
  'Höhe von Bühne und Gespräch': 'Height of stage and conversation', 'Ziehen ändert die Höhe · Doppelklick setzt zurück': 'Drag to resize · double-click resets',
  'Ziel wählen': 'Choose target',
  'Rechte': 'Permissions', 'Weniger zeigen': 'Show less', '{n} weitere nur über die Eingabe: „starte /name für …“': '{n} more only via the input: “starte /name für …”',
  'Stand nicht aktuell': 'Not up to date', 'Grund wählen oder eintragen.': 'Pick or enter a reason.',
  'Kein Arbeitsbereich mit diesem Skill. In config.json unter arbeitsbereiche eintragen.': 'No workspace with this skill. Add one under arbeitsbereiche in config.json.',
  'An Claude weitergegeben.': 'Passed on to Claude.', '/{b} als nächster Schritt angehängt': '/{b} appended as next step', 'Ablauf gestartet': 'Run started',
});

const ck = { verlauf: null, szene: null, vorschlaege: [], heute: null, freigaben: null, orbStil: 'partikel', fehler: {}, skills: null, her: null,
  ablauf: null, ablaufLauf: 0, ablaufHinweis: '', stoppFrage: false, stoppPille: '', stoppText: '' };

/* ---------- Formate ---------- */
const FMT = { eur, usd, h: hrs, proz: prozent, n: num };
const fmtE = (e) => FMT[e] || num;
const uhrVon = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleTimeString(istDE() ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''; };
const zeigeLabel = { numbers: 'Zahlen zeigen', chart: 'Chart zeigen', bars: 'Verteilung zeigen', invoice: 'Entwurf zeigen', skill: 'Ablauf zeigen' };

/* ---------- Laden ---------- */
const ckKanal = {
  kanal: 'cockpit',
  liste: () => ck.verlauf || (ck.verlauf = []),
  zeichne: () => zeichneCkVerlauf(),
  danach: (a) => {
    // Die Antwort mit Szene oeffnet sie sofort; die Leiste kann sich geaendert haben (Timer, Buchung).
    if (a.szene && route().name === 'cockpit') zeigeSzene(ck.verlauf.indexOf(a));
    ladeCkVorschlaege(); ladeHeute();
  },
};
function ladeCkVerlauf() {
  hole('/api/cira/verlauf?kanal=cockpit').then((r) => { ck.verlauf = (r.verlauf || []).concat(ck.verlauf || []); zeichneCkVerlauf(); },
    (e) => { ck.fehler.verlauf = e.message; console.error('/api/cira/verlauf:', e.message); });
}
function ladeCkVorschlaege() {
  hole('/api/cira/vorschlaege?screen=cockpit').then((r) => { ck.vorschlaege = r.vorschlaege || []; zeichneCkVorschlaege(); },
    (e) => console.error('/api/cira/vorschlaege:', e.message));
}
function ladeHeute() {
  const t = isoTag(new Date());
  ck.heuteZeit = Date.now();
  hole('/api/kennzahlen?' + abfrage({ from: t, to: t })).then((k) => { ck.heute = k; delete ck.fehler.heute; zeichneHeute(); },
    (e) => { ck.fehler.heute = e.message; zeichneHeute(); });
}
function ladeFreigaben() {
  hole('/api/freigaben?status=offen').then((r) => { ck.freigaben = r.freigaben || []; delete ck.fehler.freigaben; zeichneFreigaben(); },
    (e) => { ck.fehler.freigaben = e.message; zeichneFreigaben(); });
}
function ladeOrbStil() {
  hole('/api/cira/einstellungen').then((r) => {
    const s = r.cira && r.cira.orbStil === 'flaeche' ? 'flaeche' : 'partikel';
    if (s !== ck.orbStil) { ck.orbStil = s; zeichneOrb(); }
  }, (e) => console.error('/api/cira/einstellungen:', e.message));
}
window.addEventListener('c2-freigabe', () => { if (route().name === 'cockpit') ladeFreigaben(); });

/* ---------- Seite ---------- */
function zeichneCockpit(w, teile, neu) {
  // Die Shell zeichnet nach jedem Nachladen neu: Orb, Eingabe und Szene bleiben stehen.
  // Nach einem Sprachwechsel dagegen ganz neu.
  const da = w.querySelector('.cockpit');
  // Dabei holt es nach, was beim Oeffnen fehlte, und frischt „Heute“ hoechstens minuetlich auf.
  if (!neu && da && da.dataset.sprache === SPRACHE) {
    const br = document.getElementById('ck-briefings');
    if (br) br.hidden = !geplantSichtbar();
    if (!ck.freigaben) ladeFreigaben();
    if (!ck.heute || Date.now() - (ck.heuteZeit || 0) > 60000) ladeHeute();
    // Rueckfall fuer verpasste SSE-Ereignisse: ein laufender Ablauf im 15-s-Takt.
    if (ck.ablauf && AKTIV_ABLAUF.includes(ck.ablauf.status)) ladeAblauf(ck.ablauf.id);
    return;
  }
  if (neu) ck.szene = null;
  // Benachrichtigungs-Karten stehen hier unter „Braucht dich“; oben rechts verdeckten sie die Buehne.
  const melde = document.getElementById('c2-melde');
  if (melde) melde.remove();
  w.innerHTML =
    '<div class="cockpit" data-screen-label="Cira-Cockpit" data-sprache="' + esc(SPRACHE) + '">' +
      '<div class="ck-links">' +
        '<section class="ck-buehne" id="ck-buehne" aria-label="' + esc(CIRA_NAME) + '">' +
          '<div class="ck-orb" id="ck-orb"></div>' +
          '<span class="ck-modus" id="ck-modus"><span class="punkt" aria-hidden="true"></span><span data-cira-modus></span></span>' +
          '<div class="ck-szene-platz" id="ck-szene"></div>' +
          '<button type="button" class="ck-vollbild" data-aktion="ck-vollbild" aria-pressed="' + imKiosk() + '">' + esc(uebersetze(imKiosk() ? 'Vollbild beenden' : 'Vollbild')) + '</button>' +
        '</section>' +
        '<div class="ck-teiler" id="ck-teiler" role="separator" aria-orientation="horizontal" tabindex="0" aria-valuemin="' + BUEHNE.min + '" aria-valuemax="' + BUEHNE.max + '"' +
          ' aria-label="' + esc(uebersetze('Höhe von Bühne und Gespräch')) + '" title="' + esc(uebersetze('Ziehen ändert die Höhe · Doppelklick setzt zurück')) + '"></div>' +
        '<div class="ck-verlauf" id="ck-verlauf" aria-live="polite"></div>' +
        '<div class="ck-eingabe">' +
          '<div class="ck-vorschlaege" id="ck-vorschlaege" role="group" aria-label="' + esc(uebersetze('Vorschläge')) + '"></div>' +
          '<form class="ck-zeile" id="ck-form">' +
            '<input id="ck-q" autocomplete="off" maxlength="2000" placeholder="' + esc(uebersetze('Frag nach Zahlen, starte Skills, schreib Rechnungen …')) + '" aria-label="' + esc(uebersetze('Frage an Cira im Cockpit')) + '">' +
            '<button type="submit" class="ck-senden">' + esc(uebersetze('Senden')) + '</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<aside class="ck-leiste" aria-label="' + esc(uebersetze('Heute')) + ', ' + esc(uebersetze('Braucht dich')) + '">' +
        '<div class="ck-block"><span class="ck-titel">' + esc(uebersetze('Heute')) + '</span><div class="ck-heute" id="ck-heute"></div></div>' +
        '<div class="ck-block"><span class="ck-titel">' + esc(uebersetze('Braucht dich')) + '<span class="ck-anzahl" id="ck-anzahl"></span></span><div class="ck-freigaben" id="ck-freigaben"></div></div>' +
        // Briefings kommen erst mit C9: nur mit Schalter fuer geplante Bereiche (Release 3.0.0).
        '<div class="ck-block" id="ck-briefings"' + (geplantSichtbar() ? '' : ' hidden') + '><span class="ck-titel">' + esc(uebersetze('Briefings')) + '</span><span class="ck-leer">' + esc(uebersetze('Briefings kommen mit Block C9 des Ausbaus.')) + '</span></div>' +
        '<div class="ck-block"><span class="ck-titel">' + esc(uebersetze('Skills starten')) + '<span id="ck-ab"></span></span>' +
          '<div class="ck-kacheln">' +
            '<button type="button" class="ck-kachel" data-aktion="ck-frage" data-wert="Tagesbericht"><span class="b">' + esc(uebersetze('Tagesbericht vorlesen')) + '</span><span class="s">T0 · ' + esc(uebersetze('kostenlos')) + '</span></button>' +
            '<button type="button" class="ck-kachel" id="ck-timer"></button>' +
          '</div><div class="ck-kacheln" id="ck-skills"></div></div>' +
      '</aside>' +
    '</div>';
  w.querySelector('#ck-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('ck-q');
    const text = q.value.trim();
    if (!text || cira.laeuft) return;
    q.value = '';
    frageCira(text, ckKanal);
  });
  setzeBuehne(Number(lies('cockpit.buehne', BUEHNE.standard)));
  zeichneOrb();
  zeichneSzene();
  zeichneCkVerlauf();
  zeichneCkVorschlaege();
  zeichneHeute();
  zeichneFreigaben();
  zeichneSkills();
  zeichneTimerKachel();
  if (neu || !ck.verlauf) { ck.verlauf = null; ladeCkVerlauf(); }
  ladeCkVorschlaege(); ladeHeute(); ladeFreigaben(); ladeOrbStil(); ladeSkills();
  // Zurueck im Cockpit: der gezeigte Ablauf kann sich inzwischen geaendert haben.
  if (!ck.szene) ladeOffenenAblauf(); else if (ck.ablauf) ladeAblauf(ck.ablauf.id);
  const q = document.getElementById('ck-q');
  if (q && neu) q.focus({ preventScroll: true });
}
// Frage, die eine andere Seite mitgibt („abrechnen“ auf dem Board, C7b):
// einmal stellen, sobald das Cockpit steht.
let ckAusstehend = null;
registriere('cockpit', {
  zeichne(...a) {
    zeichneCockpit(...a);
    const text = ckAusstehend;
    ckAusstehend = null;
    // Laeuft Cira noch, meldet frageCira das selbst („Cira antwortet noch“).
    if (text) frageCira(text, ckKanal);
  },
});

/* ---------- Teiler Buehne | Gespraech (Owner 20.10.) ---------- */
// Hoehe der Buehne in Prozent der linken Spalte, gemerkt; Ziehen, Pfeiltasten, Doppelklick = Standard.
const BUEHNE = { standard: 48, min: 25, max: 80 };
function setzeBuehne(pct) {
  const p = Math.round(Math.min(BUEHNE.max, Math.max(BUEHNE.min, Number.isFinite(pct) ? pct : BUEHNE.standard)));
  const b = document.getElementById('ck-buehne'), t = document.getElementById('ck-teiler');
  if (b) b.style.flexBasis = p + '%';
  if (t) t.setAttribute('aria-valuenow', String(p));
  return p;
}
document.addEventListener('pointerdown', (ev) => {
  const t = ev.target.closest && ev.target.closest('#ck-teiler');
  if (!t || ev.button !== 0) return;
  ev.preventDefault();
  const links = t.parentElement.getBoundingClientRect();
  let p = null;
  const zieh = (e) => { p = setzeBuehne((e.clientY - links.top) / links.height * 100); };
  const los = () => { t.releasePointerCapture(ev.pointerId); t.removeEventListener('pointermove', zieh); t.classList.remove('zieht'); if (p != null) merke('cockpit.buehne', String(p)); };
  t.setPointerCapture(ev.pointerId);
  t.classList.add('zieht');
  t.addEventListener('pointermove', zieh);
  t.addEventListener('pointerup', los, { once: true });
  t.addEventListener('pointercancel', los, { once: true });
});
document.addEventListener('dblclick', (ev) => { if (ev.target.id === 'ck-teiler') merke('cockpit.buehne', String(setzeBuehne(BUEHNE.standard))); });
document.addEventListener('keydown', (ev) => {
  if (ev.target.id !== 'ck-teiler' || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
  ev.preventDefault();
  merke('cockpit.buehne', String(setzeBuehne(Number(ev.target.getAttribute('aria-valuenow')) + (ev.key === 'ArrowDown' ? 2 : -2))));
});

/* ---------- Buehne ---------- */
function zeichneOrb() {
  const el = document.getElementById('ck-orb');
  if (!el) return;
  const x = ck.szene ? 0.23 : 0.5;
  el.innerHTML = ck.orbStil === 'flaeche'
    ? '<div class="ck-siri" style="left:' + (x * 100) + '%"><siri-orb size="200" state="idle" aria-hidden="true"></siri-orb></div>'
    : '<cira-orb variant="stage" x="' + x + '" mode="' + esc(cira.modus) + '" state="auto" aria-hidden="true"></cira-orb>';
  ciraModus();
  setzeOrbLage();
}
function setzeOrbLage() {
  const x = ck.szene ? 0.23 : 0.5;
  const o = document.querySelector('#ck-orb cira-orb');
  if (o) o.setAttribute('x', String(x));
  const s = document.querySelector('#ck-orb .ck-siri');
  if (s) s.style.left = (x * 100) + '%';
  const m = document.getElementById('ck-modus');
  if (m) m.style.left = (x * 100) + '%';
}

function zeigeSzene(i) {
  const m = ck.verlauf && ck.verlauf[i];
  if (!m || !m.szene) return;
  ck.szene = { i, s: m.szene, sprung: m.sprung || [], quelle: m.quelle || '' };
  cira.zustand = m.zustand || 'auto';
  ciraModus();
  zeichneSzene(true);
  zeichneCkVerlauf();
}
function schliesseSzene() {
  ck.szene = null;
  cira.zustand = 'auto';
  ciraModus();
  zeichneSzene();
  zeichneCkVerlauf();
}
aktion('ck-szene', (i) => zeigeSzene(Number(i)));
aktion('ck-szene-zu', () => schliesseSzene());
aktion('ck-frage', (text) => { if (!cira.laeuft) frageCira(text, ckKanal); });

function zeichneSzene(frisch) {
  const el = document.getElementById('ck-szene');
  if (!el) return;
  setzeOrbLage();
  if (!ck.szene) { el.innerHTML = ''; return; }
  const { s, sprung, quelle } = ck.szene;
  const g = s.gross;
  const kopf = '<div class="ck-sz-kopf"><span class="ck-sz-titel">' + esc(uebersetze(s.titel)) + '</span>' +
    (g ? '<span class="ck-sz-gross" data-fly data-zahl="' + esc(g.v) + '" data-e="' + esc(g.e) + '">' + esc(fmtE(g.e)(g.v)) + '</span><span class="ck-sz-unter">' + esc(uebersetze(g.l)) + (s.unter ? ' · ' + esc(s.unter) : '') + '</span>' : '') +
    '<button type="button" class="ck-sz-zu" data-aktion="ck-szene-zu" aria-label="' + esc(uebersetze('Szene schließen')) + '">×</button></div>';
  const inhalt = s.typ === 'numbers' ? szeneZahlen(s) : s.typ === 'bars' ? szeneBalken(s) : s.typ === 'chart' ? szeneKurve(s) : s.typ === 'invoice' ? szeneBeleg(s) : s.typ === 'skill' ? szeneSkill(s) : '';
  const her = s.herleitung && s.herleitung.art ? '<button type="button" class="ck-sz-knopf ck-her-knopf" data-aktion="ck-herleitung" data-wert="' + esc(s.herleitung.art + '|' + (s.herleitung.id || '')) + '">' +
    '<span class="punkt" aria-hidden="true"></span>' + esc(uebersetze('Wie entstanden?')) + '</button>' : '';
  const aktionen = '<div class="ck-sz-aktionen">' + (Array.isArray(sprung) ? sprung : []).map((x) =>
    '<button type="button" class="ck-sz-knopf" data-aktion="gehe" data-wert="' + esc(String(x.ziel || '').replace(/^#\/?/, '')) + '">' + esc(uebersetze(x.l)) + '</button>').join('') +
    her + '<span class="ck-sz-quelle">' + esc(quelle) + '</span></div>';
  // Ein Ablauf zeichnet bei jedem Ereignis neu: dann ohne Eintritt, mit den
  // Eingaben und dem Fokus von vorher.
  const fokus = el.contains(document.activeElement) ? document.activeElement.id : '';
  el.innerHTML = '<div class="ck-szene ck-' + esc(s.typ) + (frisch ? '' : ' still') + '">' + kopf + inhalt + aktionen + '</div>';
  const h = el.querySelector('#ck-ab-hinweis');
  if (h) h.value = ck.ablaufHinweis;
  const grundFeld = el.querySelector('#ck-ab-grund');
  if (grundFeld) grundFeld.value = ck.stoppText;
  const wieder = fokus && document.getElementById(fokus);
  if (wieder) { wieder.focus({ preventScroll: true }); if (typeof wieder.value === 'string' && wieder.setSelectionRange) wieder.setSelectionRange(wieder.value.length, wieder.value.length); }
  for (const z of el.querySelectorAll('[data-zahl]')) zaehleHoch(z, Number(z.dataset.zahl), fmtE(z.dataset.e));
  // 450 ms nach dem Eintritt fliegen Partikel vom Orb zu den Werten (README §5.3).
  if (frisch && !wenigerBewegung()) {
    setTimeout(() => {
      const orb = document.querySelector('#ck-orb cira-orb');
      if (orb && typeof orb.fly === 'function' && ck.szene) orb.fly(el.querySelectorAll('[data-fly]'));
    }, 450);
  }
}
const kachelKlasse = (t) => (t === 'rot' ? ' rot' : t === 'gruen' ? ' gruen' : '');
function szeneZahlen(s) {
  return '<div class="ck-zahlen">' + (s.kacheln || []).map((k, i) =>
    '<div class="ck-zkachel' + kachelKlasse(k.ton) + '" style="animation-delay:' + (0.15 + i * 0.12).toFixed(2) + 's">' +
      '<span class="l">' + esc(uebersetze(k.l)) + '</span>' +
      '<span class="v" data-fly data-zahl="' + esc(k.v) + '" data-e="' + esc(k.e) + '">' + esc(fmtE(k.e)(k.v)) + '</span>' +
      (k.u ? '<span class="u">' + esc(uebersetze(k.u)) + '</span>' : '') + '</div>').join('') + '</div>';
}
function szeneBalken(s) {
  const z = s.zeilen || [];
  const max = Math.max(...z.map((x) => x.v), 0) || 1;
  return '<div class="ck-balken">' + z.map((x, i) =>
    '<div class="ck-bzeile" style="animation-delay:' + (0.1 + i * 0.1).toFixed(2) + 's"><span class="l" title="' + esc(x.l) + '">' + esc(x.l) + '</span>' +
      '<span class="spur"><span style="width:' + Math.max(1, x.v / max * 100).toFixed(1) + '%;animation-delay:' + (0.1 + i * 0.1).toFixed(2) + 's"></span></span>' +
      '<span class="v" data-fly data-zahl="' + esc(x.v) + '" data-e="' + esc(x.e) + '">' + esc(fmtE(x.e)(x.v)) + '</span></div>').join('') +
    (s.unter ? '<span class="ck-leer">' + esc(s.unter) + '</span>' : '') + '</div>';
}
// Kurve auf 600×220: Luecken (Wochen ohne Wert) unterbrechen die Linie.
function szeneKurve(s) {
  const p = s.punkte || [];
  const werte = p.map((x) => x.v).filter((v) => v != null);
  if (!werte.length) return '';
  let lo = Math.min(...werte, 0), hi = Math.max(...werte, 0);
  if (hi - lo < 1) hi = lo + 1;
  const rand = (hi - lo) * 0.12;
  lo -= rand; hi += rand;
  const X = (i) => (p.length < 2 ? 300 : 16 + i * (568 / (p.length - 1)));
  const Y = (v) => 196 - (v - lo) / (hi - lo) * 176;
  const stuecke = [];
  let akt = [];
  p.forEach((x, i) => { if (x.v == null) { if (akt.length) stuecke.push(akt); akt = []; } else akt.push([X(i), Y(x.v)]); });
  if (akt.length) stuecke.push(akt);
  const linie = stuecke.map((st) => 'M' + st.map(([a, b]) => a.toFixed(1) + ' ' + b.toFixed(1)).join(' L')).join(' ');
  // Wochen ohne Marge: gestrichelte Bruecke zwischen den Nachbarn, Grund unten an der Stelle.
  const luecken = [];
  p.forEach((x, i) => {
    if (x.v != null) return;
    const l = luecken[luecken.length - 1];
    if (l && l.bis === i - 1 && l.grund === x.grund) l.bis = i; else luecken.push({ von: i, bis: i, grund: x.grund });
  });
  const bruecke = luecken.filter((l) => l.von > 0 && l.bis < p.length - 1 && p[l.von - 1].v != null && p[l.bis + 1].v != null)
    .map((l) => 'M' + X(l.von - 1).toFixed(1) + ' ' + Y(p[l.von - 1].v).toFixed(1) + ' L' + X(l.bis + 1).toFixed(1) + ' ' + Y(p[l.bis + 1].v).toFixed(1)).join(' ');
  const lueckenText = luecken.map((l) => '<span class="ck-luecke" style="left:' + (X((l.von + l.bis) / 2) / 6).toFixed(1) + '%">' + esc(uebersetze(l.grund || 'keine Marge')) + '</span>').join('');
  const flaeche = stuecke.filter((st) => st.length > 1).map((st) => 'M' + st[0][0].toFixed(1) + ' 196 L' + st.map(([a, b]) => a.toFixed(1) + ' ' + b.toFixed(1)).join(' L') + ' L' + st[st.length - 1][0].toFixed(1) + ' 196 Z').join(' ');
  const letzter = [...p.keys()].reverse().find((i) => p[i].v != null);
  const mx = X(letzter), my = Y(p[letzter].v);
  const null0 = lo < 0 && hi > 0 ? '<line x1="0" x2="600" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="null"/>' : '';
  const achse = [0, Math.floor((p.length - 1) / 2), p.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => '<span>' + esc(datumKurz(p[i].x)) + '</span>').join('');
  return '<div class="ck-kurve" data-fly>' +
    '<svg viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="ck-flaeche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".3"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>' +
      null0 + '<path class="flaeche" d="' + flaeche + '" fill="url(#ck-flaeche)"/>' +
      (bruecke ? '<path class="luecke" d="' + bruecke + '"/>' : '') +
      '<path class="linie" d="' + linie + '"/>' +
      '<circle class="punkt" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="5.5"/>' +
    '</svg>' + lueckenText +
    // Am Rand klappt die Blase nach innen, sonst schneidet der Rahmen sie ab.
    '<span class="ck-blase' + (mx > 480 ? ' rechts' : mx < 120 ? ' links' : '') + '" style="left:' + (mx / 6).toFixed(1) + '%;top:' + (my / 2.2).toFixed(1) + '%">' + esc(fmtE(s.e)(p[letzter].v)) + '</span>' +
    '<div class="ck-achse">' + achse + '</div></div>';
}
function szeneBeleg(s) {
  const zr = s.zeitraum || {};
  const ust = s.kleinunternehmer ? uebersetze('ohne USt (Kleinunternehmer, § 19 UStG)') : uebersetze('USt') + ' ' + num(s.ust_prozent) + ' % ' + eur(s.ust);
  return '<div class="ck-papier">' +
    '<div class="pkopf"><div><b>' + esc(uebersetze('Rechnung · Entwurf')) + '</b><span>' + esc(s.empfaenger) + ' · ' + esc(s.vorgang) + '</span></div>' +
      '<span class="mono">' + esc(uebersetze('Leistungszeitraum')) + '<br>' + esc(datum(zr.von)) + ' – ' + esc(datum(zr.bis)) + '</span></div>' +
    '<div class="pos">' + (s.positionen || []).map((x, i) =>
      '<div class="zeile" data-fly style="animation-delay:' + (0.3 + i * 0.28).toFixed(2) + 's"><span>' + esc(uebersetze(x.l)) + '</span>' +
        '<span class="mono">' + (x.h != null ? esc(hrs(x.h)) : '') + '</span><span class="mono">' + (x.satz != null ? esc(eur(x.satz)) : '') + '</span>' +
        '<span class="mono">' + esc(eur(x.v)) + '</span></div>').join('') +
      (s.unter ? '<div class="zeile"><span class="faint">' + esc(s.unter) + '</span></div>' : '') + '</div>' +
    (s.hinweis ? '<span class="faint">' + esc(uebersetze(s.hinweis)) + '</span>' : '') +
    '<div class="summe"><span>' + esc(uebersetze('Netto')) + ' ' + esc(eur(s.netto)) + ' · ' + esc(ust) + '</span>' +
      '<span class="mono brutto" data-zahl="' + esc(s.brutto) + '" data-e="eur">' + esc(eur(s.brutto)) + '</span></div></div>';
}

/* ---------- Skill-Ablauf (C6b, README §5.5) ---------- */
// Gefuehrt wird der Ablauf auf dem Server (ablauf.js): eine Sitzung, jeder
// Schritt eine Eingabe darin. Hier nur Darstellung und Knoepfe.
const ABLAUF_STATUS = { idle: 'als Nächstes', run: 'Schritt läuft …', wait: 'wartet auf dich', done: 'erledigt', stopped: 'gestoppt' };
const STOPP_GRUENDE = ['Plan passt nicht', 'Zu teuer', 'Mache ich selbst', 'Später'];
const ORB_ABLAUF = { run: 'session', wait: 'session', stopped: 'warn', done: 'auto' };
const dateiName = (f) => String(f).split(/[\\/]/).pop();
// Wie die Startoptionen in Sitzungen (sitzungen.js); leer = Claude-Settings.
const ABLAUF_MODI = [['', 'Wie in deinen Claude-Settings'], ['manual', 'Immer fragen'], ['acceptEdits', 'Dateiänderungen erlauben'], ['plan', 'Nur planen']];
// Antworten von Claude kommen als Markdown: nur **fett** und `code` darstellen, erst escapen.
const mdLeicht = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');

function zeigeAblauf(a) {
  const neu = !ck.szene || ck.szene.s.typ !== 'skill' || ck.szene.s.ablauf !== a.id;
  if (neu) { ck.ablaufHinweis = ''; stoppZurueck(); }
  ck.ablauf = a;
  ck.szene = { i: neu ? -1 : ck.szene.i, s: { typ: 'skill', titel: a.vorgang ? 'Skill-Ablauf · ' + a.vorgang : 'Skill-Ablauf', ablauf: a.id },
    sprung: a.sitzung ? [{ l: 'Zur Sitzung', ziel: '#/sitzungen/' + a.sitzung }] : [], quelle: a.arbeitsbereich };
  cira.zustand = ORB_ABLAUF[a.status] || 'auto';
  ciraModus();
  zeichneSzene(neu);
  if (neu) zeichneCkVerlauf();
}
function stoppZurueck() { ck.stoppFrage = false; ck.stoppPille = ''; ck.stoppText = ''; }
function zeigeEntwurf(entwurf) {
  ck.ablauf = null; stoppZurueck();
  ck.szene = { i: -1, s: { typ: 'skill', titel: entwurf.vorgang ? 'Skill-Ablauf · ' + entwurf.vorgang : 'Skill-Ablauf', entwurf }, sprung: [], quelle: '' };
  cira.zustand = 'auto';
  ciraModus();
  zeichneSzene(true);
  zeichneCkVerlauf();
}
// Lauf-Zaehler: eine spaete Antwort (Knopf + SSE laden parallel) ueberschreibt nie einen neueren Stand.
function ladeAblauf(id) {
  const lauf = ++ck.ablaufLauf;
  hole('/api/ablauf/' + id).then((a) => {
    if (lauf !== ck.ablaufLauf || !ck.ablauf || ck.ablauf.id !== a.id || route().name !== 'cockpit') return;
    delete ck.fehler.ablauf;
    zeigeAblauf(a);
  }, (e) => {
    console.error('/api/ablauf:', e.message);
    if (lauf !== ck.ablaufLauf) return;
    ck.fehler.ablauf = e.message;
    if (route().name === 'cockpit') zeichneSzene();
  });
}
// Beim Oeffnen des Cockpits: ein laufender oder wartender Ablauf steht sofort auf der Buehne.
function ladeOffenenAblauf() {
  hole('/api/ablaeufe?offen=1').then((r) => { const a = (r.ablaeufe || [])[0]; if (a && !ck.szene && route().name === 'cockpit') zeigeAblauf(a); },
    (e) => console.error('/api/ablaeufe:', e.message));
}
window.addEventListener('c2-ablauf', (e) => {
  const d = e.detail || {};
  if (route().name === 'cockpit' && ck.ablauf && ck.ablauf.id === d.id) ladeAblauf(d.id);
});

function szeneSkill(s) {
  const a = ck.ablauf && ck.ablauf.id === s.ablauf ? ck.ablauf : null;
  if (!a) return s.entwurf ? ablaufEntwurf(s.entwurf) : '<span class="ck-leer">' + esc(uebersetze('Lädt …')) + '</span>';
  const schritte = a.schritte.map((x, i) =>
    '<div class="ck-schritt ' + esc(x.status) + '"' + (i === a.schritt && AKTIV_ABLAUF.includes(x.status) ? ' aria-current="step"' : '') + '>' +
      '<span class="nr mono" aria-hidden="true">' + (x.status === 'done' ? '✓' : i + 1) + '</span>' +
      '<div class="mitte"><span class="b mono">/' + esc(x.befehl) + '</span>' + (x.ziel ? '<span class="z">' + esc(x.ziel) + '</span>' : '') +
        '<span class="st">' + esc(uebersetze(ABLAUF_STATUS[x.status] || x.status)) + '</span>' +
        a.hinweise.filter((h) => h.schritt === i).map((h) => '<span class="du">' + esc(uebersetze('Du')) + ': ' + esc(h.text) + '</span><span class="cira">' + esc(uebersetze('An Claude weitergegeben.')) + '</span>').join('') +
        (x.status === 'wait' ? ablaufErgebnis(a, x, i) : '') + '</div>' +
      '<span class="k mono">' + (x.ergebnis && x.ergebnis.kosten_usd != null ? esc(usd(x.ergebnis.kosten_usd)) : '') + '</span></div>').join('');
  let fuss = '';
  if (ck.stoppFrage && AKTIV_ABLAUF.includes(a.status)) fuss = stoppDialog();
  else if (a.status === 'run') fuss = '<div class="ck-ab-knoepfe"><button type="button" class="ck-sz-knopf" data-aktion="ck-ab-stoppfrage">' + esc(uebersetze('Stopp')) + '</button></div>';
  else if (a.status === 'stopped') {
    fuss = '<div class="ck-ab-zeile"><span>' + esc(fuelle('Gestoppt nach Schritt {n}', { n: a.schritt + 1 })) + ' · ' + esc(uebersetze('Grund')) + ': <b>' + esc(a.stop_grund || '') + '</b>' +
      (a.vorgang ? ' · ' + esc(fuelle('im Vorgangs-Log {v} notiert', { v: a.vorgang })) : '') + '</span>' +
      '<button type="button" class="ck-sz-knopf" data-aktion="ck-ab-neustart">' + esc(uebersetze('Neu starten')) + '</button></div>';
  } else if (a.status === 'done') {
    fuss = '<div class="ck-ab-zeile ok"><span>' + esc(uebersetze('Ablauf abgeschlossen · Sitzung läuft weiter')) + (a.vorgang ? ' · ' + esc(fuelle('bucht auf {v}', { v: a.vorgang })) : '') + '</span></div>';
  }
  const alt = ck.fehler.ablauf ? '<span class="ck-leer">' + esc(uebersetze('Stand nicht aktuell')) + ': ' + esc(ck.fehler.ablauf) + '</span>' : '';
  return '<div class="ck-schritte" aria-live="polite">' + alt + schritte + fuss + '</div>';
}
const AKTIV_ABLAUF = ['run', 'wait'];
function ablaufErgebnis(a, x, i) {
  const e = x.ergebnis || { dateien: [] };
  // Die ganze Antwort (Server kappt bei 4000 Zeichen); die Box scrollt.
  const zeilen = String(e.antwort || uebersetze('Keine Antwort von Claude.')).split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  // Kosten stehen rechts am Schritt.
  const meta = e.dateien.length ? fuelle('{n} Dateien geschrieben', { n: e.dateien.length }) : '';
  const naechster = a.schritte[i + 1];
  const h = ck.ablaufHinweis.trim();
  return '<div class="ck-ergebnis">' +
    '<div class="ekopf"><span class="l">' + esc(uebersetze('Ergebnis')) + ' · /' + esc(x.befehl) + '</span><span class="meta mono">' + esc(meta) + '</span></div>' +
    (e.fehler ? '<span class="efehler">' + esc(e.fehler) + '</span>' : '') +
    '<div class="zeilen">' + zeilen.map((t) => '<span>' + mdLeicht(t) + '</span>').join('') + '</div>' +
    (e.dateien.length ? '<div class="dateien">' + e.dateien.map((f) => '<span class="mono" title="' + esc(f) + '">' + esc(dateiName(f)) + '</span>').join('') + '</div>' : '') +
    (ck.stoppFrage ? '' :
      '<span class="frage">' + esc(naechster ? fuelle('Freigeben und mit {b} weitermachen?', { b: '/' + naechster.befehl }) : uebersetze('Freigeben und Ablauf abschließen? Die Sitzung läuft weiter.')) + '</span>' +
      '<input id="ck-ab-hinweis" maxlength="2000" autocomplete="off" aria-label="' + esc(uebersetze('Hinweis zum Schritt')) + '" placeholder="' + esc(uebersetze('Ergänzung oder Einwand … (Enter = freigeben mit Hinweis)')) + '">' +
      '<div class="ck-ab-knoepfe">' +
        '<button type="button" class="ck-sz-knopf primaer" id="ck-ab-ok" data-aktion="ck-ab-weiter">' + esc(uebersetze(h ? 'Freigeben mit Hinweis' : 'Freigeben')) + '</button>' +
        '<button type="button" class="ck-sz-knopf" id="ck-ab-neu" data-aktion="ck-ab-neu" title="' + esc(uebersetze('Schritt mit deinem Hinweis neu ausführen')) + '"' + (h ? '' : ' disabled') + '>' + esc(uebersetze('Neu bauen')) + '</button>' +
        '<button type="button" class="ck-sz-knopf" data-aktion="ck-ab-stoppfrage">' + esc(uebersetze('Stopp')) + '</button></div>') +
    '</div>';
}
function stoppDialog() {
  return '<div class="ck-stopp" role="group" aria-label="' + esc(uebersetze('Grund für den Stopp')) + '">' +
    '<span class="t">' + esc(uebersetze('Ablauf stoppen. Warum? Der Grund kommt ins Vorgangs-Log.')) + '</span>' +
    '<div class="pillen">' + STOPP_GRUENDE.map((g) => '<button type="button" class="spur-pille" data-aktion="ck-ab-grund" data-wert="' + esc(g) + '" aria-pressed="' + (ck.stoppPille === g) + '">' + esc(uebersetze(g)) + '</button>').join('') + '</div>' +
    '<input id="ck-ab-grund" maxlength="500" autocomplete="off" aria-label="' + esc(uebersetze('Grund für den Stopp')) + '" placeholder="' + esc(uebersetze('Oder eigener Grund …')) + '">' +
    '<div class="ck-ab-knoepfe"><button type="button" class="ck-sz-knopf stopp" data-aktion="ck-ab-stopp">' + esc(uebersetze('Stoppen')) + '</button>' +
      '<button type="button" class="ck-sz-knopf" data-aktion="ck-ab-zurueck">' + esc(uebersetze('Zurück')) + '</button></div></div>';
}
function ablaufEntwurf(e) {
  const abs = Array.isArray(e.arbeitsbereiche) ? e.arbeitsbereiche : [];
  const gemerkt = lies('cockpit.arbeitsbereich', '');
  const ab = abs.includes(gemerkt) ? gemerkt : abs[0] || '';
  return '<form class="ck-schritte" id="ck-ab-start">' +
    '<div class="ck-schritt idle"><span class="nr mono" aria-hidden="true">1</span><div class="mitte"><span class="b mono">/' + esc(e.befehl) + '</span>' +
      '<label class="ck-ab-feld"><span>' + esc(uebersetze('Vorgang (optional)')) + '</span><input name="vorgang" maxlength="40" autocomplete="off" value="' + esc(e.vorgang || '') + '"></label>' +
      '<label class="ck-ab-feld"><span>' + esc(uebersetze('Ziel (optional)')) + '</span><input name="ziel" maxlength="2000" autocomplete="off" placeholder="' + esc(uebersetze('Worum geht es? Wird an den Skill angehängt.')) + '" value="' + esc(e.ziel || '') + '"></label>' +
      (abs.length > 1
        ? '<label class="ck-ab-feld"><span>' + esc(uebersetze('Arbeitsbereich')) + '</span><select name="arbeitsbereich">' + abs.map((n) => '<option' + (n === ab ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label>'
        : '<input type="hidden" name="arbeitsbereich" value="' + esc(ab) + '">') +
      // Rechte wie beim Sitzungsstart; die Wahl bleibt fuer den naechsten Ablauf.
      '<label class="ck-ab-feld"><span>' + esc(uebersetze('Rechte')) + '</span><select name="modus">' +
        ABLAUF_MODI.map(([w, l]) => '<option value="' + w + '"' + (w === lies('ablauf.modus', '') ? ' selected' : '') + '>' + esc(uebersetze(l)) + '</option>').join('') + '</select></label>' +
    '</div><span class="k"></span></div>' +
    '<span class="ck-leer">' + esc(uebersetze('Startet eine Claude-Sitzung im Arbeitsbereich. Kostet Claude-Nutzung.')) + (abs.length === 1 ? ' · ' + esc(ab) : '') + '</span>' +
    '<div class="ck-ab-knoepfe"><button type="submit" class="ck-sz-knopf primaer">' + esc(uebersetze('Ablauf starten')) + '</button></div></form>';
}
document.addEventListener('submit', async (ev) => {
  if (ev.target.id !== 'ck-ab-start') return;
  ev.preventDefault();
  const f = ev.target;
  const s = ck.szene && ck.szene.s;
  if (!s || !s.entwurf) return;
  if (!f.elements.arbeitsbereich.value) { toast(uebersetze('Kein Arbeitsbereich mit diesem Skill. In config.json unter arbeitsbereiche eintragen.'), 'warn'); return; }
  await mitLauf(f.querySelector('[type=submit]'), async () => {
    try {
      merke('ablauf.modus', f.elements.modus.value);
      const r = await sende('/api/ablauf', { arbeitsbereich: f.elements.arbeitsbereich.value, befehl: s.entwurf.befehl, vorgang: f.elements.vorgang.value.trim(), ziel: f.elements.ziel.value.trim(), modus: f.elements.modus.value });
      toast(uebersetze('Ablauf gestartet'), 'ok');
      zeigeAblauf(r.ablauf);
    } catch (e) { toast(e.message, 'err'); }
  });
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'ck-ab-grund') { ck.stoppText = ev.target.value; return; }
  if (ev.target.id !== 'ck-ab-hinweis') return;
  ck.ablaufHinweis = ev.target.value;
  const h = ck.ablaufHinweis.trim();
  const ok = document.getElementById('ck-ab-ok'), neu = document.getElementById('ck-ab-neu');
  if (ok) ok.textContent = uebersetze(h ? 'Freigeben mit Hinweis' : 'Freigeben');
  if (neu) neu.disabled = !h;
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || ev.target.id !== 'ck-ab-hinweis') return;
  ev.preventDefault();
  const ok = document.getElementById('ck-ab-ok');
  if (ok && !ok.disabled) ok.click();
});
// Knopf-Aktion am laufenden Ablauf; danach zeigt das Ereignis den neuen Stand.
async function ablaufAktion(el, pfad, daten) {
  const a = ck.ablauf;
  if (!a) return;
  await mitLauf(el, async () => {
    try { await sende('/api/ablauf/' + a.id + '/' + pfad, daten); ck.ablaufHinweis = ''; stoppZurueck(); } catch (e) { toast(e.message, 'err'); }
  });
  ladeAblauf(a.id);
}
aktion('ck-ab-weiter', (w, el) => ablaufAktion(el, 'weiter', { hinweis: ck.ablaufHinweis.trim() }));
aktion('ck-ab-neu', (w, el) => { if (ck.ablaufHinweis.trim()) ablaufAktion(el, 'neu', { hinweis: ck.ablaufHinweis.trim() }); });
aktion('ck-ab-stoppfrage', () => { ck.stoppFrage = true; zeichneSzene(); const p = document.querySelector('.ck-stopp .spur-pille'); if (p) p.focus({ preventScroll: true }); });
aktion('ck-ab-zurueck', () => { stoppZurueck(); zeichneSzene(); });
aktion('ck-ab-grund', (w) => {
  ck.stoppPille = ck.stoppPille === w ? '' : w;
  for (const p of document.querySelectorAll('.ck-stopp .spur-pille')) p.setAttribute('aria-pressed', String(p.dataset.wert === ck.stoppPille));
});
// Der Grund geht ins Vorgangs-Log: ohne Pille oder eigenen Text kein Stopp.
aktion('ck-ab-stopp', (w, el) => {
  const grund = ck.stoppText.trim() || ck.stoppPille;
  if (!grund) { toast(uebersetze('Grund wählen oder eintragen.'), 'warn'); return; }
  ablaufAktion(el, 'stopp', { grund });
});
aktion('ck-ab-neustart', () => {
  const a = ck.ablauf;
  if (a) zeigeEntwurf({ befehl: a.schritte[0].befehl, vorgang: a.vorgang || '', ziel: a.schritte[0].ziel || '', arbeitsbereiche: [a.arbeitsbereich] });
});

/* ---------- Verlauf und Eingabe ---------- */
function zeichneCkVerlauf() {
  const el = document.getElementById('ck-verlauf');
  if (!el) return;
  const liste = ck.verlauf || [];
  if (ck.verlauf && !liste.length) { el.innerHTML = '<span class="ck-leer">' + esc(uebersetze('Frag mich nach Zahlen — oder tipp einen Vorschlag unten an. Direkte Antworten (T0) kosten nichts.')) + '</span>'; return; }
  el.innerHTML = liste.map((m, i) => {
    if (m.rolle === 'ich') {
      return '<div class="ck-msg ich"><span class="ck-msg-kopf">' + esc(uebersetze('Du')) + ' · <span class="mono">' + esc(uhrVon(m.zeit)) + '</span></span><span class="ck-blase-du">' + esc(m.text) + '</span></div>';
    }
    if (m.laeuft && !m.text) return '<div class="ck-msg cira"><span class="ck-denkt"><b>' + esc(CIRA_NAME) + '</b> ' + esc(m.uebernimmt ? m.uebernimmt + ' …' : uebersetze('denkt nach …')) + '</span></div>';
    const meta = '<span class="ck-msg-kopf"><b>' + esc(CIRA_NAME) + '</b><span class="mono">' + esc(uhrVon(m.zeit)) + '</span>' +
      (m.stufe ? '<span class="ck-stufe mono">' + esc(m.stufe) + (m.kosten_eur ? ' · ' + esc(eur(m.kosten_eur)) : '') + '</span>' : '') +
      (m.quelle ? '<span class="mono ck-quelle">' + esc(m.quelle) + '</span>' : '') + '</span>';
    const gezeigt = ck.szene && ck.szene.i === i;
    const szene = m.szene ? '<div class="ck-msg-knoepfe"><button type="button" class="ck-zeige' + (gezeigt ? ' an' : '') + '" data-aktion="ck-szene" data-wert="' + i + '"' + (gezeigt ? ' aria-pressed="true"' : '') + '>' +
      '<span class="punkt" aria-hidden="true"></span>' + esc(uebersetze(gezeigt ? 'Wird gezeigt' : (zeigeLabel[m.szene.typ] || 'Zahlen zeigen'))) + '</button></div>' : '';
    // Mit Szene stehen die Spruenge in deren Aktionsleiste.
    const spr = !m.szene && m.sprung && m.sprung.length ? '<div class="ck-msg-knoepfe">' + m.sprung.map((x) =>
      '<button type="button" class="ck-sz-knopf" data-aktion="gehe" data-wert="' + esc(String(x.ziel || '').replace(/^#\/?/, '')) + '">' + esc(uebersetze(x.l)) + '</button>').join('') + '</div>' : '';
    return '<div class="ck-msg cira' + (m.fehler ? ' fehler' : '') + '">' + meta + '<span class="ck-text">' + esc(m.text) + '</span>' + (m.laeuft ? '' : ciraRouteHtml(m, 'ck-sz-knopf')) + szene + spr + '</div>';
  }).join('');
  el.scrollTop = el.scrollHeight;
}
function zeichneCkVorschlaege() {
  const el = document.getElementById('ck-vorschlaege');
  if (el) el.innerHTML = ck.vorschlaege.map((v) => '<button type="button" class="spur-pille" data-aktion="ck-frage" data-wert="' + esc(v) + '">' + esc(uebersetze(v)) + '</button>').join('');
}

/* ---------- Rechte Leiste ---------- */
function zeichneHeute() {
  const el = document.getElementById('ck-heute');
  if (!el) return;
  const k = ck.heute;
  if (!k) { el.innerHTML = '<span class="ck-leer">' + esc(ck.fehler.heute ? uebersetze('Keine Antwort vom Server.') : uebersetze('Lädt …')) + '</span>'; return; }
  // Drei Spalten auf 320 px: Euro ganzzahlig, der genaue Wert steht im Tooltip.
  const ganz = (v) => num(v) + ' €';
  const sp = (v, l, f, genau) => '<div title="' + esc(uebersetze(l) + ': ' + genau(v)) + '"><span class="v mono">' + esc(f(v)) + '</span><span class="l">' + esc(uebersetze(l)) + '</span></div>';
  el.innerHTML = sp(k.aktive_stunden + k.manuell_stunden, 'Stunden', hrs, hrs) + sp(k.wert.arbeitswert, 'Arbeitswert', ganz, eur) + sp(k.wert.api_gegenwert, 'API-Gegenwert', ganz, eur);
}
const ART = { mahnung: 'Mahnung', rechnung: 'Rechnung', mail: 'Mail', jira_kommentar: 'Jira-Kommentar', sitzung_frage: 'Rückfrage', plan_schritt: 'Plan-Schritt', flow_fehler: 'Flow-Fehler', serie: 'Rechnungsserie', ablauf: 'Skill-Ablauf' };
function zeichneFreigaben() {
  const el = document.getElementById('ck-freigaben');
  const n = document.getElementById('ck-anzahl');
  if (!el) return;
  const liste = ck.freigaben;
  if (n) { n.textContent = liste ? String(liste.length) : ''; n.classList.toggle('an', !!(liste && liste.length)); }
  if (!liste) { el.innerHTML = '<span class="ck-leer">' + esc(ck.fehler.freigaben ? uebersetze('Keine Antwort vom Server.') : uebersetze('Lädt …')) + '</span>'; return; }
  if (!liste.length) { el.innerHTML = '<span class="ck-leer">' + esc(uebersetze('Nichts wartet auf dich. Cira meldet sich.')) + '</span>'; return; }
  el.innerHTML = liste.map((f) => {
    const fehler = f.art === 'flow_fehler';
    return '<div class="ck-karte' + (fehler ? ' fehler' : '') + '">' +
      '<div class="ck-kkopf"><span class="punkt" aria-hidden="true"></span><span class="art mono">' + esc(uebersetze(ART[f.art] || f.art)) + '</span>' +
        (f.bezug ? '<span class="bezug mono">' + esc(f.bezug) + '</span>' : '') + '<span class="wann mono">' + esc(vor(f.erstellt)) + '</span></div>' +
      '<span class="t">' + esc(f.titel) + '</span>' + (f.text ? '<span class="s">' + esc(String(f.text).slice(0, 240)) + '</span>' : '') +
      '<div class="knoepfe">' + (f.ausfuehrbar ? '<button type="button" class="ok" data-aktion="ck-freigabe" data-wert="' + f.id + ':ok">' + esc(uebersetze('Freigeben')) + '</button>' : '') +
        '<button type="button" data-aktion="ck-freigabe" data-wert="' + f.id + ':ablehnen">' + esc(uebersetze('Ablehnen')) + '</button>' +
        // Ein Entwurf zeigt vor dem Freigeben, woraus er besteht.
        (f.art === 'rechnung' ? '<button type="button" class="her" data-aktion="ck-herleitung" data-wert="rechnung|F' + f.id + '">' + esc(uebersetze('Wie entstanden?')) + '</button>' : '') + '</div>' +
      (f.ausfuehrbar ? '' : '<span class="s faint">' + esc(uebersetze('noch keine Aktion · nur Ablehnen')) + '</span>') + '</div>';
  }).join('');
}
aktion('ck-freigabe', async (wert, el) => {
  const [id, wahl] = String(wert).split(':');
  await mitLauf(el, async () => {
    try {
      const r = await sende('/api/freigaben/' + encodeURIComponent(id) + '/entscheide', { wahl });
      const nr = r && r.freigabe && r.freigabe.ergebnis && r.freigabe.ergebnis.nr;
      if (nr) toast(fuelle('Rechnung {nr} gestellt', { nr }), 'ok', { text: uebersetze('Zu den Rechnungen'), tu: () => geheZu('rechnungen') });
      else toast(uebersetze(wahl === 'ok' ? 'Freigegeben' : 'Abgelehnt'), 'ok');
    } catch (e) { toast(e.message, 'err'); }
  });
  ladeFreigaben();
});

/* ---------- Timer-Kachel (Owner 20.10.) ---------- */
// Eine Kachel, die dem Timer folgt: ohne Timer „Timer starten“ (Zielauswahl der
// Zeiterfassung; die Wahl startet sofort, man bleibt im Cockpit), mit Timer
// Stoppen + Buchen wie die Mini-Karte.
// Den Stand haelt die Shell (state.live.timer); die Uhr tickt ueber .zeit-uhr.
function zeichneTimerKachel() {
  const el = document.getElementById('ck-timer');
  if (!el) return;
  const t = state.live && state.live.timer;
  el.dataset.aktion = t ? 'zeit-stopp' : 'ck-timer-start';
  el.innerHTML = t
    ? '<span class="b">' + esc(uebersetze('Timer stoppen + buchen')) + '</span><span class="s"><span class="zeit-uhr">' + uhrText(Date.now() - Date.parse(t.start)) + '</span> · ' + esc(zielKurz(t.ziel_art, t.ziel_schluessel)) + '</span>'
    : '<span class="b">' + esc(uebersetze('Timer starten')) + '</span><span class="s">' + esc(uebersetze('Ziel wählen')) + ' · ' + esc(uebersetze(zt.form.taetigkeit || 'Entwicklung')) + '</span>';
}
aktion('ck-timer-start', () => zeitPicker('timer-start'));

/* ---------- Skill-Kacheln je Arbeitsbereich (C4) ---------- */
// Nur Namen aus ~/.claude/skills und <pfad>/.claude/skills; ein Klick oeffnet den Skill-Ablauf (C6b).
function ladeSkills(name) {
  const ab = name || lies('cockpit.arbeitsbereich', '');
  hole('/api/cira/skills' + (ab ? '?' + abfrage({ arbeitsbereich: ab }) : '')).then((r) => { ck.skills = r; zeichneSkills(); }, (e) => {
    // Den gemerkten Bereich gibt es nicht mehr: einmal ohne ihn.
    if (ab && !name && /unbekannt/i.test(e.message)) { merke('cockpit.arbeitsbereich', ''); ladeSkills(''); return; }
    console.error('/api/cira/skills:', e.message);
    ck.skills = { fehler: e.message }; zeichneSkills();
  });
}
function zeichneSkills() {
  const el = document.getElementById('ck-skills');
  const kopf = document.getElementById('ck-ab');
  if (!el) return;
  const r = ck.skills;
  if (kopf) {
    const alle = (r && r.arbeitsbereiche) || [];
    kopf.innerHTML = alle.length > 1
      ? '<select class="ck-ab-wahl" aria-label="' + esc(uebersetze('Arbeitsbereich')) + '">' + alle.map((n) => '<option' + (n === r.arbeitsbereich ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>'
      : r && r.arbeitsbereich ? '<span class="ck-ab-name">' + esc(r.arbeitsbereich) + '</span>' : '';
    const s = kopf.querySelector('select');
    if (s) s.addEventListener('change', () => { merke('cockpit.arbeitsbereich', s.value); ladeSkills(s.value); });
  }
  if (!r) { el.innerHTML = ''; return; }
  if (r.fehler) { el.innerHTML = '<span class="ck-leer">' + esc(uebersetze('Keine Antwort vom Server.')) + '</span>'; return; }
  // Erst 8 Kacheln, „n weitere“ klappt alle auf (gemerkt).
  const alle = lies('cockpit.skillsAlle', '') === '1';
  const liste = (r.skills || []).slice(0, alle ? undefined : 8);
  const rest = (r.skills || []).length - liste.length;
  el.innerHTML = (liste.length ? liste.map((x) => '<button type="button" class="ck-kachel" data-aktion="ck-skill" data-wert="' + esc(x.name) + '" title="' + esc(uebersetze(x.quelle)) + '">' +
      '<span class="b">/' + esc(x.name) + '</span><span class="s claude">' + esc(uebersetze(x.quelle)) + ' · Claude</span></button>').join('')
    : '<span class="ck-leer">' + esc(uebersetze('Keine Skills gefunden (~/.claude/skills und .claude/skills im Arbeitsbereich).')) + '</span>') +
    (rest > 0 ? '<button type="button" class="ck-mehr" data-aktion="ck-skills-alle" data-wert="1" aria-expanded="false">' + esc(fuelle('{n} weitere', { n: rest })) + '</button>'
      : alle && liste.length > 8 ? '<button type="button" class="ck-mehr" data-aktion="ck-skills-alle" data-wert="" aria-expanded="true">' + esc(uebersetze('Weniger zeigen')) + '</button>' : '') +
    // Ueber 60 liefert der Server nicht: dann nur ueber die Eingabe („starte /name für …“).
    (r.mehr ? '<span class="ck-leer">' + esc(fuelle('{n} weitere nur über die Eingabe: „starte /name für …“', { n: r.mehr })) + '</span>' : '');
}
aktion('ck-skills-alle', (w) => { merke('cockpit.skillsAlle', w); zeichneSkills(); });
// Kachel (C6b): laeuft ein Ablauf, haengt sie den Skill als naechsten Schritt an; sonst Entwurf auf der Buehne.
aktion('ck-skill', async (name, el) => {
  const a = ck.ablauf;
  if (a && AKTIV_ABLAUF.includes(a.status) && ck.szene && ck.szene.s.ablauf === a.id) {
    await mitLauf(el, async () => {
      try { const r = await sende('/api/ablauf/' + a.id + '/schritt', { befehl: name }); toast(fuelle('/{b} als nächster Schritt angehängt', { b: name }), 'ok'); zeigeAblauf(r); } catch (e) { toast(e.message, 'err'); }
    });
    return;
  }
  const k = cira.kontext;
  zeigeEntwurf({ befehl: name, vorgang: k && k.art === 'vorgang' ? k.id : '', ziel: '', arbeitsbereiche: ck.skills && ck.skills.arbeitsbereich ? [ck.skills.arbeitsbereich] : [] });
});

/* ---------- Herleitung „Wie entstanden?“ (README §5.4, C4) ---------- */
// Der Server liefert den Graphen aus dem echten Rechenweg; hier wird er nur
// ausgelegt und mit der Web Animations API abgefahren. Welt 900 breit, je
// Spalte ein fester x-Wert; die Hoehe waechst mit der vollsten Spalte, damit
// sich Knoten nicht ueberdecken.
const HER = { X: [110, 450, 790], B: [190, 210, 230], ZEILE: 86, BREITE: 900 };
function herLayout(g) {
  const je = [0, 1, 2].map((c) => g.knoten.filter((k) => k.col === c));
  const hoehe = Math.max(260, Math.max(...je.map((l) => l.length)) * HER.ZEILE + 30);
  const pos = g.knoten.map((k) => { const l = je[k.col]; const i = l.indexOf(k); return { x: HER.X[k.col], y: hoehe / 2 + (i - (l.length - 1) / 2) * HER.ZEILE }; });
  const links = g.links.map(([a, b]) => {
    const A = pos[a], B = pos[b];
    const ax = A.x + HER.B[g.knoten[a].col] / 2, bx = B.x - HER.B[g.knoten[b].col] / 2, mx = (ax + bx) / 2;
    return { d: 'M' + ax + ' ' + A.y + ' C' + mx + ' ' + A.y + ',' + mx + ' ' + B.y + ',' + bx + ' ' + B.y, von: g.knoten[a].col, c: g.knoten[b].c };
  });
  return { pos, links, hoehe };
}
function oeffneHerleitung(wert, knopf) {
  const [art, id] = String(wert).split('|');
  const el = document.getElementById('ck-buehne');
  if (!el) return;
  schliesseHerleitung();
  ck.her = { art, id: id || '', zurueck: knopf || null, laeufe: [], lauf: 0 };
  const ebene = document.createElement('div');
  ebene.className = 'ck-her';
  ebene.id = 'ck-her';
  ebene.setAttribute('role', 'dialog');
  ebene.setAttribute('aria-modal', 'true');
  ebene.setAttribute('aria-label', uebersetze('Herleitung'));
  ebene.innerHTML = '<div class="ck-her-kopf"><span class="l">' + esc(uebersetze('Herleitung')) + '</span><span class="t" id="ck-her-titel"></span><span class="cap" id="ck-her-cap" aria-live="polite"></span>' +
    '<button type="button" class="ck-her-nochmal" data-aktion="ck-her-nochmal">' + esc(uebersetze('↻ Nochmal')) + '</button>' +
    '<button type="button" class="ck-sz-zu" data-aktion="ck-her-zu" aria-label="' + esc(uebersetze('Herleitung schließen')) + '">×</button></div>' +
    '<div class="ck-her-flaeche" id="ck-her-flaeche"><span class="ck-leer">' + esc(uebersetze('Herleitung lädt …')) + '</span></div>' +
    '<div class="ck-her-fuss" id="ck-her-fuss"></div>';
  el.appendChild(ebene);
  ebene.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); schliesseHerleitung(); } });
  ebene.querySelector('.ck-sz-zu').focus({ preventScroll: true });
  const meins = ck.her;
  hole('/api/cira/herleitung?' + abfrage({ art, id })).then((g) => { if (ck.her === meins) zeichneHerleitung(g); },
    (e) => { if (ck.her !== meins) return; const f = document.getElementById('ck-her-flaeche'); if (f) f.innerHTML = '<span class="ck-leer">' + esc(e.message) + '</span>'; });
}
function zeichneHerleitung(g) {
  ck.her.g = g;
  const { pos, links, hoehe } = herLayout(g);
  document.getElementById('ck-her-titel').textContent = g.titel;
  document.getElementById('ck-her-fuss').innerHTML = g.schritte.map((s, i) => '<span><b class="mono">' + (i + 1) + '</b>' + esc(s) + '</span>').join('') +
    '<span class="quelle">' + esc(uebersetze('Rechenweg aus c2invoice · kein Modell')) + '</span>';
  // Jede Linie zweimal: gestrichelt sichtbar, darueber eine Maske, die sich zeichnet.
  // So bleibt die Strichelung beim Zeichnen erhalten.
  const svg = '<svg viewBox="0 0 ' + HER.BREITE + ' ' + hoehe + '" aria-hidden="true"><defs>' +
    links.map((l, i) => '<mask id="ck-her-m' + i + '" maskUnits="userSpaceOnUse" x="0" y="0" width="' + HER.BREITE + '" height="' + hoehe + '"><path class="zug" d="' + l.d + '"/></mask>').join('') + '</defs>' +
    links.map((l, i) => '<path class="linie c-' + esc(l.c) + '" d="' + l.d + '" mask="url(#ck-her-m' + i + ')" data-von="' + l.von + '"/>').join('') + '</svg>';
  const knoten = g.knoten.map((k, i) => '<div class="ck-her-knoten c-' + esc(k.c) + '" data-col="' + k.col + '" style="left:' + pos[i].x + 'px;top:' + pos[i].y + 'px;width:' + HER.B[k.col] + 'px">' +
    '<span class="k">' + esc(k.k) + '</span><span class="v mono">' + esc(k.v) + '</span>' + (k.sub ? '<span class="s" title="' + esc(k.sub) + '">' + esc(k.sub) + '</span>' : '') + '</div>').join('');
  const f = document.getElementById('ck-her-flaeche');
  f.innerHTML = '<div class="ck-her-welt" id="ck-her-welt" style="width:' + HER.BREITE + 'px;height:' + hoehe + 'px;margin:' + (-hoehe / 2) + 'px 0 0 ' + (-HER.BREITE / 2) + 'px">' + svg + knoten + '</div>';
  spieleHerleitung();
}
// Kamera: der Grundmassstab passt die Welt in die Flaeche, s zoomt, t schiebt
// die gewuenschte Spalte in die Mitte.
function herKamera(spalte, s) {
  const f = document.getElementById('ck-her-flaeche'), w = document.getElementById('ck-her-welt');
  const basis = Math.min(1, (f.clientWidth - 24) / HER.BREITE, (f.clientHeight - 16) / w.offsetHeight);
  const t = spalte == null ? 0 : (HER.BREITE / 2 - HER.X[spalte]) * s;
  return 'scale(' + basis.toFixed(4) + ') translateX(' + t.toFixed(1) + 'px) scale(' + s + ')';
}
function spieleHerleitung() {
  const h = ck.her;
  if (!h || !h.g) return;
  for (const a of h.laeufe) a.cancel();
  h.laeufe = [];
  const lauf = ++h.lauf;
  const welt = document.getElementById('ck-her-welt');
  const cap = document.getElementById('ck-her-cap');
  const knoten = [...welt.querySelectorAll('.ck-her-knoten')];
  const zuege = [...welt.querySelectorAll('mask .zug')];
  const linien = [...welt.querySelectorAll('.linie')];
  const fertig = () => { if (cap) cap.textContent = uebersetze('Fertig · alles nachvollziehbar'); };
  // Endzustand: ohne Bewegung sofort, und wenn die Animation scheitert — nie eine leere Flaeche.
  const endzustand = () => {
    for (const a of h.laeufe) a.cancel();
    h.laeufe = [];
    welt.style.transform = herKamera(null, 1);
    for (const k of knoten) { k.style.opacity = 1; k.style.transform = 'translate(-50%, -50%)'; }
    for (const z of zuege) { z.style.strokeDasharray = 'none'; z.style.strokeDashoffset = 0; }
    fertig();
  };
  if (wenigerBewegung() || typeof welt.animate !== 'function') { endzustand(); return; }
  try {
    for (const z of zuege) { const L = z.getTotalLength(); z.style.strokeDasharray = L; z.style.strokeDashoffset = L; }
  } catch (e) { console.error('Herleitung:', e); endzustand(); return; }
  for (const k of knoten) { k.style.opacity = 0; k.style.transform = 'translate(-50%, -50%) scale(.85)'; }
  welt.style.transform = herKamera(null, 1);
  const an = (el, kf, o) => { const a = el.animate(kf, { fill: 'forwards', easing: 'cubic-bezier(.22,1,.36,1)', ...o }); h.laeufe.push(a); return a.finished; };
  const kamera = (spalte, s, dauer) => { const von = welt.style.transform; welt.style.transform = herKamera(spalte, s); return an(welt, [{ transform: von }, { transform: welt.style.transform }], { duration: dauer, easing: 'cubic-bezier(.45,0,.55,1)' }); };
  const zeige = (c, abstand) => Promise.all(knoten.filter((k) => k.dataset.col === String(c)).map((k, i) =>
    an(k, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(.85)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], { duration: 500, delay: i * abstand })));
  const zeichne = (von) => Promise.all(linien.map((l, i) => [l, zuege[i]]).filter(([l]) => l.dataset.von === String(von)).map(([, z], i) =>
    an(z, [{ strokeDashoffset: z.style.strokeDashoffset }, { strokeDashoffset: 0 }], { duration: 700, delay: i * 80 })));
  const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const schritt = (i) => { if (cap && h.lauf === lauf) cap.textContent = h.g.schritte[i] || ''; };
  const weiter = (p) => p.then(() => { if (h.lauf !== lauf || ck.her !== h) throw new Error('abgebrochen'); });
  schritt(0);
  weiter(Promise.all([kamera(0, 1.45, 900), warte(300).then(() => zeige(0, 110))]))
    .then(() => { schritt(1); return weiter(Promise.all([kamera(1, 1.3, 1100), zeichne(0), warte(550).then(() => zeige(1, 120))])); })
    .then(() => { schritt(2); return weiter(Promise.all([kamera(2, 1.35, 1100), zeichne(1), warte(650).then(() => zeige(2, 0))])); })
    .then(() => weiter(kamera(null, 1, 1000)))
    .then(fertig, (e) => {
      if (e && (e.message === 'abgebrochen' || e.name === 'AbortError')) return;
      console.error('Herleitung:', e);
      if (ck.her === h && h.lauf === lauf) endzustand();
    });
}
function schliesseHerleitung() {
  const h = ck.her;
  ck.her = null;
  if (h) for (const a of h.laeufe) a.cancel();
  const el = document.getElementById('ck-her');
  if (el) el.remove();
  if (h && h.zurueck && document.contains(h.zurueck)) h.zurueck.focus({ preventScroll: true });
}
aktion('ck-herleitung', (wert, el) => oeffneHerleitung(wert, el));
aktion('ck-her-nochmal', () => spieleHerleitung());
aktion('ck-her-zu', () => schliesseHerleitung());
