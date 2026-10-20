'use strict';
/* Analyse: Reiter Verbrauch · Arbeitszeit (Pro) · Werkzeuge (#/analyse/<reiter>).
   Der Verbrauch ist ein Raster aus Bereichen wie im Hub (Katalog, Ziehen,
   freie Groesse). Gerechnet wird nichts — Grunddaten aus /api/summary,
   dazu /api/verlauf, /api/fluss und /api/marge-wochen. Im Browser entstehen
   nur Anteile fuer Breiten und Flaechen. */

Object.assign(EN, {
  'Verbrauch': 'Usage', 'Arbeitszeit': 'Working time', 'Werkzeuge': 'Tools',
  'Filter aufheben': 'Clear filter', 'Verlauf nur ohne Modellfilter': 'Trend only without model filter', 'Modell': 'Model', 'Kunde': 'Customer', 'Requests': 'Requests', 'Tokens': 'Tokens', 'Jahr': 'Year',
  'Projektarbeit': 'Project work', 'Werkzeugbetrieb': 'Tool usage',
  'Anteil am API-Gegenwert · Requests und Tokens · Klick filtert „Nach Projekt“': 'Share of API equivalent · requests and tokens · click filters “By project”',
  'Ohne Preis:': 'No price:', 'Preis geschätzt:': 'Estimated price:',
  'Diese Requests stehen mit 0 USD im API-Gegenwert — die Summe ist zu niedrig.': 'These requests count as 0 USD in the API equivalent — the total is too low.',
  'Die Preisliste kennt das Modell nicht; gerechnet wird mit dem Preis des ähnlichsten Modells.': 'The price list does not know the model; the price of the most similar model is used.',
  'Sobald die Preisliste das Modell führt, wird der Betrag automatisch nachgezogen.': 'As soon as the price list includes the model, the amount is updated automatically.',
  'weniger anzeigen': 'show less', 'weitere {n} anzeigen': 'show {n} more',
  '{n} ließen sich keinem Projekt zuordnen': '{n} could not be attributed to a project', 'alle einem Projekt zugeordnet': 'all attributed to a project',
  'Zuordnung über die Zeit: es zählt das Projekt, an dem im Umkreis von {n} Minuten gearbeitet wurde.': 'Attribution by time: what counts is the project worked on within {n} minutes.',
  'Bezugsgröße: {t} Tokens aus Claude-Code-Sitzungen im Zeitraum. Davon {m} über MCP-Server, {s} im Kontext eines Skills.': 'Basis: {t} tokens from Claude Code sessions in the period. Of those {m} via MCP servers, {s} in the context of a skill.',
  'Ein MCP-Server löst den Request aus — die Tokens gehören ihm ursächlich. Ein Skill tut das nicht: er schiebt Text in einen ohnehin laufenden Request. Seine Zeile sagt deshalb, wie viel lief, während der Skill aktiv war — nicht, was der Skill gekostet hat. Werkzeuge ohne eigene Requests (Anweisungen im Kontext, Filter vor dem Modell) fehlen hier; eine Null stünde für „nicht messbar“, nicht für „kostet nichts“.': 'An MCP server triggers the request — the tokens are causally its own. A skill does not: it pushes text into a request that is running anyway. Its row therefore says how much ran while the skill was active — not what the skill cost. Tools without requests of their own (instructions in the context, filters ahead of the model) are missing here; a zero would mean “not measurable”, not “costs nothing”.',
  'Kennzahlen, Verlauf, Modelle, Projekte im gewählten Zeitraum': 'Figures, trend, models, projects in the selected period',
  'Arbeitszeit, manuelle Zeit und Workload': 'Working time, manual time and workload',
  'Werkzeugbetrieb — ändert keine Abrechnung': 'Tool usage — does not change billing',
  'Bereiche': 'Sections', 'Bereiche der Analyse — Auswahl, Reihenfolge, Breite': 'Analysis sections — selection, order, width',
  '+ Bereich hinzufügen': '+ Add section',
  'Kennzahlen': 'Key figures', 'Tokens, API, Abo, Requests': 'Tokens, API, subscription, requests', 'Der Überblick über den Zeitraum.': 'The overview of the period.',
  'API-Gegenwert im Verlauf': 'API equivalent over time', 'Fläche | Balken': 'Area | bars', 'Trends und Ausreißer über die Zeit.': 'Trends and outliers over time.',
  'Aktivität + Top-Vorgänge': 'Activity + top jobs', 'Heatmap, Rangliste': 'Heatmap, ranking', 'An welchen Tagen und Vorgängen du am meisten erwirtschaftest.': 'On which days and jobs you earn the most.',
  'Wohin der Verbrauch floss': 'Where the usage went', 'Modell → Projekt → Vorgang': 'Model → project → job', 'Welche Projekte welche Kosten verursachen.': 'Which projects cause which costs.',
  'Nach Projekt': 'By project', 'Tabelle': 'Table', 'Projekte im Vergleich.': 'Projects compared.',
  'Modelle im Zeitraum': 'Models in period', 'Tabelle + Ring': 'Table + ring', 'Modellmix und Preise im Detail.': 'Model mix and prices in detail.',
  'Marge je Woche gegen Ziel': 'Margin per week vs. target', 'Balken über/unter Ziel': 'Bars above/below target', 'Welche Wochen unter Ziel lagen.': 'Which weeks were below target.',
  'Kosten je Stunde im Verlauf': 'Cost per hour over time', 'USD je aktive h': 'USD per active h', 'Ob deine Arbeit pro Stunde teurer wird.': 'Whether your work gets more expensive per hour.',
  'Vorgänge nach Status': 'Jobs by status', 'noch nicht abgerechnet · abgerechnet': 'not yet invoiced · invoiced', 'Was noch abzurechnen ist.': 'What is still to be invoiced.',
  'gestapelt nach Modell, in USD': 'stacked by model, in USD', 'andere': 'other', 'Gesamt USD': 'Total USD', 'Aktiv h': 'Active h', 'Summe': 'Sum',
  'Zahlen als Tabelle': 'Figures as table', 'Zeitraum': 'Period', 'Tag': 'Day', 'Woche': 'Week', 'Monat': 'Month', 'Fläche': 'Area', 'Balken': 'Bars',
  'aktive Stunden je Tag, letzte 12 Wochen': 'active hours per day, last 12 weeks', 'weniger': 'less', 'mehr': 'more',
  'Top-Vorgänge': 'Top jobs', 'nach Gegenwert — Arbeitswert + API-Gegenwert': 'by equivalent — billable value + API equivalent',
  'Bandbreite = API-Gegenwert in USD · ohne Werkzeugbetrieb': 'Band width = API equivalent in USD · without tool usage',
  'ohne Vorgang': 'no job', 'Projekt': 'Project', 'Agent h': 'Agent h', 'API USD': 'API USD', 'Arbeitswert': 'Billable value', 'Anteil': 'Share',
  'Werkzeug': 'Tool', 'Werkzeugbetrieb gedämpft — nicht abrechenbar': 'Tool usage dimmed — not billable',
  'Anteil am API-Gegenwert · Requests und Tokens': 'Share of API equivalent · requests and tokens', 'Modell': 'Model', 'Requests': 'Requests', 'Tokens': 'Tokens',
  'Marge je Woche — nach Sachkosten und eigener Zeit': 'Margin per week — after material costs and own time',
  'Prozentpunkte gegen die Zielmarge': 'Percentage points vs. target margin', 'Marge in Prozent (keine Zielmarge hinterlegt)': 'Margin in percent (no target set)',
  'Wochen-Marge lädt …': 'Loading weekly margin …', 'Woche ab': 'Week from', 'kein Erlös oder Selbstkostensatz': 'no revenue or own cost rate',
  'API-Gegenwert (inkl. Werkzeugbetrieb) je aktive Stunde, je Woche': 'API equivalent (incl. tool usage) per active hour, per week',
  'Arbeitswert in EUR · Anzahl Vorgänge': 'Billable value in EUR · number of jobs',
  'Lädt …': 'Loading …', 'Bereich nicht aktualisiert': 'Section not refreshed', 'Stand': 'as of', 'Nicht geladen': 'Not loaded', 'Erneut versuchen': 'Try again', 'Keine Daten im Zeitraum': 'No data in period',
  'Claude-Zeit und Zeiterfassung zusammen, Auslastung je Woche, Workload — mit der Pro-Version.': 'Claude time and time tracking together, weekly utilisation, workload — with Pro.',
  'Werkzeugbetrieb': 'Tool usage', 'Nur Werkzeugdaten': 'Tool data only', 'nicht abrechenbar': 'not billable', 'ändert keine Abrechnung': 'does not change billing',
  'Hintergrunddienste mit eigener Sitzung — claude-mem, Sync-Jobs, MCP-Server. Diese Zahlen gehören zu keinem Vorgang, fließen in keine Rechnung und ändern keine Marge.':
    'Background services with their own session — claude-mem, sync jobs, MCP servers. These figures belong to no job, go into no invoice and change no margin.',
  'des API-Gegenwerts': 'of the API equivalent', 'Verbrauch nach Schnitt': 'Usage by cut', 'derselbe Verbrauch aus drei Blickwinkeln': 'the same usage from three angles',
  'Summe — bleibt in jedem Schnitt gleich': 'Sum — the same in every cut', 'Kein Werkzeugbetrieb im Zeitraum': 'No tool usage in period',
  'Keine Werkzeug-Projekte eingerichtet': 'No tool projects set up', 'In config.json unter overheadProjekte eintragen, z. B. „.claude-mem“.': 'Add them to overheadProjekte in config.json, e.g. “.claude-mem”.',
  'Beobachtet: {p} · letzter Request am {d}': 'Watched: {p} · last request on {d}', 'Beobachtet: {p} · noch kein Request': 'Watched: {p} · no request yet',
  'Dienste ohne eigenes Sitzungsprotokoll (z. B. rtk) sind nicht messbar.': 'Services without their own session log (e.g. rtk) cannot be measured.',
  'Kennzahlen Werkzeuge': 'Tool figures', 'Tokens, API-Gegenwert, Aufrufe': 'Tokens, API equivalent, calls', 'Der Werkzeugbetrieb in drei Zahlen.': 'Tool usage in three figures.',
  'Ring · Werkzeug | Projekt | Modell': 'Ring · tool | project | model', 'Wohin der Verbrauch der Hintergrunddienste floss.': 'Where the background services’ usage went.',
  'Rangliste': 'Ranking', 'Was lief, während ein Skill aktiv war.': 'What ran while a skill was active.',
  'Anteile an MCP-Servern und Skills': 'Shares of MCP servers and skills', 'Wie viel der eigenen Sitzungen über MCP-Server und Skills lief.': 'How much of your own sessions ran through MCP servers and skills.',
  'Fläche = Anteil': 'Area = share', 'Welche MCP-Server und Werkzeuge Tokens erzeugen.': 'Which MCP servers and tools generate tokens.', 'Keine Bereiche ausgewählt': 'No sections selected',
  'Requests im Kontext eines Skills': 'Requests in the context of a skill', 'nicht die Kosten des Skills — was lief, während er aktiv war': 'not the cost of the skill — what ran while it was active',
  'Keine Skills im Zeitraum': 'No skills in period', 'Nach MCP-Server': 'By MCP server', 'Woher die Requests der eigenen Sitzungen kamen': 'Where the requests of your own sessions came from',
  'Fläche = Anteil, sehr kleine Server mit Mindestbreite · Server anklicken, um seine Werkzeuge im selben Maßstab zu sehen': 'Area = share, very small servers at minimum width · click a server to see its tools at the same scale',
  'Anteile am API-Gegenwert — keine Kosten obendrauf': 'Shares of the API equivalent — no costs on top', 'Werkzeuge von': 'Tools of',
  'Keine MCP-Aufrufe im Zeitraum': 'No MCP calls in period', 'Tage in Folge aktiv': 'days active in a row',
  'Auf Standard': 'Reset to default', 'Keine Wochen-Marge': 'No weekly margin', 'Ohne Erlös oder Selbstkostensatz gibt es keine Marge.': 'Without revenue or own cost rate there is no margin.',
  'API-Gegenwert (inkl. Werkzeugbetrieb) je aktive Stunde, je Woche · letzte 12 Wochen · Linie = Durchschnitt': 'API equivalent (incl. tool usage) per active hour, per week · last 12 weeks · line = average', 'Tokens Werkzeuge': 'Tool tokens', 'API-Gegenwert Werkzeuge': 'Tool API equivalent', 'Aufrufe': 'Calls',
  'Hintergrunddienste': 'Background services', 'im gewählten Zeitraum': 'in the selected period',
  'Anteile an': 'Shares of', 'USD API-Gegenwert — keine Kosten obendrauf.': 'USD API equivalent — no costs on top.',
  'Hintergrunddienste mit eigener Sitzung — derselbe Verbrauch aus drei Blickwinkeln': 'Background services with their own session — the same usage from three angles', 'Serie': 'Streak', 'Tage in Folge': 'days in a row', 'aktive Stunden je Tag': 'active hours per day', 'Aktivität': 'Activity',
  'Vom Hub lösen': 'Remove from hub', 'Auf dem Hub anzeigen': 'Show on hub', '+ Hub': '+ Hub', 'Bereich ziehen': 'Drag section', 'Kachel verschieben': 'Move tile',
  'Gesamt je': 'Total per', 'Gestapelt nach Modell, je': 'Stacked by model, per', 'in USD': 'in USD', 'gesamt': 'total', 'aktiv': 'active',
  'Modell → Projekt → Vorgang · Bandbreite = API-Gegenwert in USD · ohne Werkzeugbetrieb': 'Model → project → job · band width = API equivalent in USD · without tool usage',
  'Verlauf': 'Trend', 'Marge je Woche gegen das Ziel': 'Margin per week vs. target', 'Prozentpunkte über bzw. unter': 'Percentage points above or below',
  'Zielmarge · grün über, rot unter Ziel': 'target margin · green above, red below target', 'KW': 'CW',
  'API-Gegenwert (inkl. Werkzeugbetrieb) je aktive Stunde, je Woche · Linie = Durchschnitt': 'API equivalent (incl. tool usage) per active hour, per week · line = average',
  'Arbeitszeit und manuelle Zeit': 'Working time and manual time', 'Claude-Zeit und Zeiterfassung zusammen · Parallelzeit in der Arbeitszeit nur einmal': 'Claude time and time tracking together · parallel time counts once in working time',
  'bisher': 'so far', 'Manueller Anteil': 'Manual share', 'der abrechenbaren Zeit': 'of billable time', 'Meeting + Claude gleichzeitig': 'meeting + Claude at the same time',
  'nicht berechnet, 0,00 EUR': 'not charged, 0.00 EUR', 'Auslastung je Woche': 'Utilisation per week', 'abrechenbar vs. Arbeitszeit, Soll {h} h': 'billable vs. working time, target {h} h',
  'abrechenbar vs. Arbeitszeit': 'billable vs. working time', 'Manuelle Zeit nach Tätigkeit': 'Manual time by activity',
});

/* ---------- Katalog und Raster ---------- */
// [id, Titel, Kurzbeschreibung, Zeichen, Wozu, Standardbreite]
const ANA = [
  ['kpis', 'Kennzahlen', 'Tokens, API, Abo, Requests', '#', 'Der Überblick über den Zeitraum.', 4],
  ['verlauf', 'API-Gegenwert im Verlauf', 'Fläche | Balken', '▮', 'Trends und Ausreißer über die Zeit.', 4],
  ['akt', 'Aktivität + Top-Vorgänge', 'Heatmap, Rangliste', '▦', 'An welchen Tagen und Vorgängen du am meisten erwirtschaftest.', 4],
  ['sankey', 'Wohin der Verbrauch floss', 'Modell → Projekt → Vorgang', '⇶', 'Welche Projekte welche Kosten verursachen.', 4],
  ['projekte', 'Nach Projekt', 'Tabelle', '≡', 'Projekte im Vergleich.', 4],
  ['modelle', 'Modelle im Zeitraum', 'Tabelle + Ring', '◔', 'Modellmix und Preise im Detail.', 4],
  ['marge', 'Marge je Woche gegen Ziel', 'Balken über/unter Ziel', '±', 'Welche Wochen unter Ziel lagen.', 4],
  ['kosten', 'Kosten je Stunde im Verlauf', 'USD je aktive h', '⌁', 'Ob deine Arbeit pro Stunde teurer wird.', 4],
  ['status', 'Vorgänge nach Status', 'noch nicht abgerechnet · abgerechnet', '◧', 'Was noch abzurechnen ist.', 4],
];
RASTER.ana = { standard: ['kpis', 'verlauf', 'akt', 'sankey', 'modelle'], reihe: null, meta: ANA, speicher: 'analyse.raster', felder: [3, 4], an: 'sichtbar ✓', plus: '+ Bereich hinzufügen', min: () => [360, 220],
  zusatz: ['analyse.kpi'] };

const REITER = [
  ['verbrauch', 'Verbrauch', 'Kennzahlen, Verlauf, Modelle, Projekte im gewählten Zeitraum'],
  ['arbeitszeit', 'Arbeitszeit', 'Arbeitszeit und manuelle Zeit'],
  ['werkzeuge', 'Werkzeuge', 'Werkzeugbetrieb — ändert keine Abrechnung'],
];
const anaReiter = () => REITER;
const anaZustand = { mcp: null, schnitt: 'werkzeug', modell: null, alleSkills: false };
aktion('ana-skills', () => { anaZustand.alleSkills = !anaZustand.alleSkills; zeichneAnsicht(); });


const zr = () => { const z = aktuellerZeitraum(); return { from: z.von, to: z.bis }; };
const modellName = (m) => (m == null ? uebersetze('andere') : kurzModell(m));

/* ---------- Bereiche ----------
   Optik nach dem Entwurf (Analyse-Abschnitt): Karte mit fettem Titel,
   Untertitel und Schaltern rechts. "+ Hub" erscheint nur beim Bearbeiten
   und schaltet die passende Hub-Metrik in "Meine Metriken". */
function anaKopf(titel, unter, rechts) {
  return '<div class="ana-kopf"><h2>' + esc(uebersetze(titel)) + '</h2>' + (unter ? '<span class="hinweis">' + unter + '</span>' : '') +
    '<span class="rechts">' + (rechts || '') + '</span></div>';
}
// Raster des offenen Reiters: Verbrauch = ana, Werkzeuge = wz (merke() laeuft vor dem Zeichnen).
const anaSek = () => (lies('analyse.reiter') === 'werkzeuge' ? 'wz' : 'ana');
function pinKnopf(id) {
  if (!hubZustand.bearbeiten[anaSek()]) return '';
  const an = rasterStand('meine').sicht.includes(id);
  return '<button type="button" class="pin' + (an ? ' an' : '') + '" data-aktion="ana-pin" data-wert="' + esc(id) + '" title="' +
    esc(uebersetze(an ? 'Vom Hub lösen' : 'Auf dem Hub anzeigen')) + '">' + esc(uebersetze(an ? 'im Hub ✓' : '+ Hub')) + '</button>';
}
aktion('ana-pin', (id) => {
  if (!WIDGETS.some((w) => w[0] === id)) return;
  rasterSetze('meine', (st) => { st.sicht = st.sicht.includes(id) ? st.sicht.filter((x) => x !== id) : st.sicht.concat(id); });
});
const tageDesZeitraums = (S) => (S.days || []).map((d) => d.day);

// Die vier Kennzahlen lassen sich im Bearbeiten einzeln sortieren (eigene
// Sektion 'kpi', nur innerhalb der Kennzahlen). Gespeichert wird nur die
// Reihenfolge; "↺ Standard" der Analyse nimmt sie mit zurueck (RASTER.ana.zusatz).
const KPI_STANDARD = ['kpi-tokens', 'kpi-api', 'kpi-abo', 'kpi-req'];
function kpiReihe() {
  const s = liesJson('analyse.kpi', null);
  const gemerkt = Array.isArray(s) ? s.filter((id) => KPI_STANDARD.includes(id)) : [];
  return [...new Set(gemerkt.concat(KPI_STANDARD))];
}
function kpisInhalt(D) {
  const ed = !!hubZustand.bearbeiten.ana;
  return kpiReihe().map((id) =>
    '<div class="ana-karte ana-kpi' + (ed ? ' bearbeiten' : '') + '" data-sek="kpi" data-id="' + id + '"><div class="ana-kpi-kopf">' +
      (ed ? '<span class="greif im-kopf" draggable="true" title="' + esc(uebersetze('Kachel verschieben')) + '">⋮⋮</span>' : '') +
      '<span class="label">' + esc(uebersetze(WIDGETS.find((w) => w[0] === id)[1])) + '</span>' + pinKnopf(id) + '</div>' +
      kpiInhalt(id, D) + '</div>').join('');
}

// Index-Auswahl fuer Achsenbeschriftungen: n gleich verteilte Stellen.
const stellen = (laenge, n) => [...new Set(Array.from({ length: Math.min(n, laenge) }, (_, i) => Math.round(i * (laenge - 1) / Math.max(n - 1, 1))))];

function verlaufInhalt() {
  const k = ['tag', 'woche', 'monat', 'jahr'].includes(lies('analyse.koernung')) ? lies('analyse.koernung') : 'tag';
  const form = lies('analyse.form') === 'balken' ? 'balken' : 'flaeche';
  const e = ladeBereich('verlauf:' + k + JSON.stringify(zr()), '/api/verlauf?' + abfrage({ koernung: k, ...zr() }));
  const je = { tag: 'Tag', woche: 'Woche', monat: 'Monat', jahr: 'Jahr' }[k];
  const gesamt = e.d ? e.d.summe.reduce((a, x) => a + x, 0) : null;
  const unter = esc(uebersetze(form === 'balken' ? 'Gesamt je' : 'Gestapelt nach Modell, je') + ' ' + uebersetze(je) + ' ' + uebersetze('in USD')) +
    (gesamt == null ? '' : ' · ' + esc(uebersetze('gesamt')) + ' ' + nf2.format(gesamt) + ' USD');
  const kopf = anaKopf('API-Gegenwert im Verlauf', unter, pinKnopf('verlauf') +
    segment('ana-koernung', [['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat'], ['jahr', 'Jahr']], k, 'Zeitraum') +
    segment('ana-form', [['flaeche', 'Fläche'], ['balken', 'Balken']], form, 'Form'));
  const warte = bereichWarte(e);
  if (warte) return kopf + warte;
  const V = e.d;
  if (!V.perioden.length) return kopf + leer('liste', 'Keine Daten im Zeitraum');
  const farbe = (m, i) => (m.model == null ? 'var(--m-rest)' : modellFarbe(i));
  const marke = (p) => (k === 'monat' || k === 'jahr' ? p : datumKurz(p));
  const spitze = Math.max(...V.summe, 0);
  // Flaeche: oberer Rand = Spitze + 5 %. Balken lassen oben Platz fuer die Zahl
  // (80 % bzw. 88 % Hoehe wie im Entwurf) — die Achse folgt demselben Massstab.
  const oben = (form === 'balken' ? spitze / (k === 'tag' ? 0.8 : 0.88) : spitze * 1.05) || 1;
  const achseY = '<div class="ana-y">' + [oben, oben * 2 / 3, oben / 3, 0].map((v) => '<span>' + nf0.format(v) + '</span>').join('') + '</div>';
  let grafik;
  if (form === 'balken') {
    grafik = '<div class="ana-balken ' + k + '">' + V.perioden.map((p, i) => '<div class="ana-bk">' +
      '<span class="ana-bk-wert mono">' + (k === 'tag' ? nf0.format(V.summe[i]) : nf2.format(V.summe[i])) + '</span>' +
      '<span class="ana-bk-s" style="height:' + (V.summe[i] / oben * 100).toFixed(1) + '%"></span>' +
      '<div class="ana-tip" role="tooltip"><span class="faint">' + esc(marke(p)) + '</span>' +
        V.modelle.map((m, j) => '<span class="ana-tip-z"><span class="leg-p" style="background:' + farbe(m, j) + '"></span>' + esc(modellName(m.model)) +
          '<b class="mono">' + nf2.format(m.werte[i]) + '</b><span class="mono faint">' + nf0.format(V.summe[i] ? m.werte[i] / V.summe[i] * 100 : 0) + ' %</span></span>').join('') +
        '<span class="ana-tip-fuss mono"><b class="akzent">' + nf2.format(V.summe[i]) + ' USD</b><span>' + nf1.format(V.aktiv[i] / 3600) + ' h ' + esc(uebersetze('aktiv')) + '</span></span></div></div>').join('') + '</div>';
  } else {
    const st = stacked(V.modelle.map((m, j) => ({ vals: m.werte, c: farbe(m, j) })), 1000, 240, oben);
    grafik = '<svg viewBox="0 0 1000 240" preserveAspectRatio="none" class="ana-flaeche" aria-hidden="true">' +
      '<line x1="0" y1="0.5" x2="1000" y2="0.5"/><line x1="0" y1="80" x2="1000" y2="80"/><line x1="0" y1="160" x2="1000" y2="160"/><line x1="0" y1="239.5" x2="1000" y2="239.5" class="basis"/>' +
      st.layers.map((l) => '<path d="' + l.d + '" fill="' + l.c + '" fill-opacity=".85" stroke="var(--panel)" stroke-width=".6"/>').join('') + '</svg>';
  }
  const achseX = '<div class="ana-x">' + stellen(V.perioden.length, 7).map((i) => '<span>' + esc(marke(V.perioden[i])) + '</span>').join('') + '</div>';
  const offen = lies('analyse.tabelle', '0') === '1';
  const spalten = V.modelle.map((m) => m.werte.reduce((a, x) => a + x, 0));
  return kopf +
    '<div class="ana-legende">' + V.modelle.map((m, j) => '<span><span class="leg-p" style="background:' + farbe(m, j) + '"></span>' + esc(modellName(m.model)) + '</span>').join('') + '</div>' +
    '<div class="ana-diagramm">' + achseY + '<div class="ana-flaeche-huelle">' + grafik + achseX + '</div></div>' +
    '<button type="button" class="textknopf akzent ana-tabelle-knopf" data-aktion="ana-tabelle" aria-expanded="' + offen + '">' + esc(uebersetze('Zahlen als Tabelle')) + (offen ? ' ▾' : ' ▸') + '</button>' +
    (offen ? '<div class="tabelle-huelle ana-tabelle"><table class="tabelle"><thead><tr><th scope="col">' + esc(uebersetze('Zeitraum')) + '</th>' +
      V.modelle.map((m) => '<th scope="col" class="z">' + esc(modellName(m.model)) + '</th>').join('') +
      '<th scope="col" class="z">' + esc(uebersetze('Gesamt USD')) + '</th><th scope="col" class="z">' + esc(uebersetze('Aktiv h')) + '</th></tr></thead><tbody>' +
      V.perioden.map((p, i) => '<tr><td>' + esc(marke(p)) + '</td>' + V.modelle.map((m) => '<td class="z faint">' + nf2.format(m.werte[i]) + '</td>').join('') +
        '<td class="z akzent">' + nf2.format(V.summe[i]) + '</td><td class="z">' + nf1.format(V.aktiv[i] / 3600) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><th scope="row">' + esc(uebersetze('Summe')) + '</th>' + spalten.map((v) => '<td class="z">' + nf2.format(v) + '</td>').join('') +
        '<td class="z akzent">' + nf2.format(gesamt) + '</td><td class="z">' + nf1.format(V.aktiv.reduce((a, x) => a + x, 0) / 3600) + '</td></tr></tfoot></table></div>' : '');
}

function aktInhalt(D) {
  const S = D.S;
  const heat = hubDaten.tage ? heatDaten() : null;
  const abr = S.abrechnung || {};
  const tage = tageDesZeitraums(S);
  const verlauf = S.ticket_verlauf || {};
  const t = (S.tickets || []).slice().sort((a, b) => b.gegenwert_eur - a.gegenwert_eur).slice(0, 5);
  return '<div class="ana-karte ana-akt">' +
      anaKopf('Aktivität', esc(uebersetze('aktive Stunden je Tag')), (heat ? '<span class="ana-serie">' + serieText(heat.serie) + '</span>' : '') + pinKnopf('heat')) +
      (heat ? heatGitter(heat) : hubDaten.fehler ? leer('liste', 'Nicht geladen') : '<div class="leer">…</div>') + '</div>' +
    '<div class="ana-karte ana-top">' +
      anaKopf('Top-Vorgänge', esc(uebersetze('nach Gegenwert — Arbeitswert + API-Gegenwert')), pinKnopf('top')) +
      (t.length ? '<div class="ana-top-liste">' + t.map((x) => {
        const ab = !!abr[x.ticket];
        return '<a href="#/vorgaenge/' + encodeURIComponent(x.ticket) + '"><span class="ana-top-name"><b class="mono">' + esc(x.ticket) + '</b>' +
          '<span class="ell">' + esc(x.project || '–') + ' · ' + nf1.format(x.active_hours || 0) + ' h · <span style="color:' + (ab ? 'var(--ok)' : 'var(--text-dim)') + '">' +
            esc(uebersetze(ab ? 'abgerechnet' : 'offen')) + '</span></span></span>' +
          sparkline(verlauf[x.ticket], tage) + '<span class="mono ok">' + nf2.format(x.gegenwert_eur) + '</span></a>';
      }).join('') + '</div>' : leer('liste', 'Keine Vorgänge im Zeitraum')) + '</div>';
}

function sankeyInhalt() {
  const e = ladeBereich('fluss' + JSON.stringify(zr()), '/api/fluss?' + abfrage(zr()));
  const kopf = anaKopf('Wohin der Verbrauch floss', esc(uebersetze('Modell → Projekt → Vorgang · Bandbreite = API-Gegenwert in USD · ohne Werkzeugbetrieb')));
  const warte = bereichWarte(e);
  if (warte) return kopf + warte;
  const F = e.d;
  if (!F.links.length) return kopf + leer('liste', 'Keine Daten im Zeitraum');
  const spalte = (pr) => [...new Set(F.links.flatMap((l) => [l.s, l.t]).filter((id) => id.startsWith(pr)))];
  const andere = (id) => id.endsWith('\u0001andere');
  const name = (id) => (andere(id) ? uebersetze('andere') : id.startsWith('v:ohne:') ? uebersetze('ohne Vorgang') + ' · ' + id.slice(7)
    : id.startsWith('m:') ? kurzModell(id.slice(2)) : id.slice(2));
  const cols = [spalte('m:').map((id, i) => ({ id, label: name(id), c: andere(id) ? 'var(--m-rest)' : modellFarbe(i) })),
    spalte('p:').map((id) => ({ id, label: name(id), c: andere(id) ? 'var(--line-hover)' : 'var(--text-hell)' })),
    spalte('v:').map((id) => ({ id, label: name(id), c: andere(id) ? 'var(--m-5)' : id.startsWith('v:ohne:') ? 'var(--line-hover)' : 'var(--accent)' }))];
  // Hoehe nach Knotenzahl, Breite 960 wie im Entwurf; rechts bleiben 220 fuer Beschriftungen
  // (echte Projekt- und Vorgangsnamen sind laenger als die Beispieldaten).
  const H = Math.max(340, Math.max(...cols.map((c) => c.length)) * 30);
  const S = sankey(cols, F.links, 740, H, 10, 8);
  // preserveAspectRatio none: das Bild dehnt sich auf die Kachel, die Beschriftungen
  // (in %) wandern mit und behalten ihre Schriftgroesse; mindestens H px hoch.
  return kopf + '<div class="ana-sankey" style="min-height:' + H + 'px"><svg viewBox="0 0 960 ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(uebersetze('Wohin der Verbrauch floss')) + '">' +
      S.paths.map((p) => '<path d="' + p.d + '" fill="' + p.c + '" fill-opacity=".28"><title>' + esc(name(p.s) + ' → ' + name(p.t) + ' · ' + nf2.format(p.v) + ' USD') + '</title></path>').join('') +
      S.nodes.map((n) => '<rect x="' + n.x + '" y="' + n.y + '" width="10" height="' + n.h + '" rx="2" fill="' + n.c + '"><title>' + esc(n.label + ' · ' + nf2.format(n.v) + ' USD') + '</title></rect>').join('') + '</svg>' +
    // Beschriftung als HTML ueber dem SVG: bleibt bei jeder Breite gleich gross.
    S.nodes.map((n) => '<span class="sk-label' + (n.spalte === 2 ? ' rechts' : '') + '" title="' + esc(n.label + ' · ' + nf2.format(n.v) + ' USD') + '" style="left:' + ((Number(n.x) + 18) / 9.6).toFixed(2) + '%;top:' + (Number(n.ly) / H * 100).toFixed(2) + '%">' +
      '<span class="ell">' + esc(n.label) + '</span> <span class="faint">' + nf0.format(n.v) + '</span></span>').join('') + '</div>';
}

function projekteInhalt(S) {
  // Modellfilter aus "Modelle im Zeitraum" (Klick auf ein Modell): Projekte nur mit
  // diesem Modell, vom Server (/api/projects?model=). Die Summenzeilen gelten fuer
  // alle Modelle und entfallen dann — sie waeren groesser als die Zeilen darueber.
  const modell = anaZustand.modell;
  const filterChip = modell ? '<button type="button" class="pille an" data-aktion="ana-modell" data-wert="" title="' + esc(uebersetze('Filter aufheben')) + '">' +
    esc(uebersetze('Modell') + ': ' + kurzModell(modell)) + ' ×</button>' : '';
  const kopf = anaKopf('Nach Projekt', esc(uebersetze('Werkzeugbetrieb gedämpft — nicht abrechenbar')), filterChip + pinKnopf('projekte'));
  let P = S.projects || [];
  if (modell) {
    const e = ladeBereich('projekte:' + modell + JSON.stringify(zr()), '/api/projects?' + abfrage({ model: modell, ...zr() }));
    const warte = bereichWarte(e);
    if (warte) return kopf + warte;
    P = Array.isArray(e.d) ? e.d : [];
  }
  P = P.slice().sort((x, y) => y.cost_usd - x.cost_usd);
  if (!P.length) return kopf + leer('liste', 'Keine Daten im Zeitraum');
  const ges = (modell ? P.reduce((x, p) => x + p.cost_usd, 0) : S.summary.cost_usd) || 1;
  const tage = tageDesZeitraums(S);
  const verlauf = S.projekt_verlauf || {};
  const pk = S.projekt_kontakt || {};
  const kunde = (p) => (Object.hasOwn(pk, p) && pk[p].firma) || '–';
  const sp = !modell && S.split;
  const summe = (label, x, rest, klasse) => '<tr class="summe' + (klasse || '') + '"><th scope="row" class="ana-name">' + label + '</th><td></td><td></td>' +
    '<td class="z">' + num(x.requests) + '</td><td class="z faint">' + kurz(x.total_tokens) + '</td>' +
    '<td class="z">' + nf1.format(x.active_seconds / 3600) + '</td><td class="z faint">' + nf1.format((x.agent_seconds || 0) / 3600) + '</td>' +
    '<td class="z akzent">' + nf2.format(x.cost_usd) + '</td><td class="z">' + rest + '</td><td></td></tr>';
  return kopf + '<div class="tabelle-huelle"><table class="tabelle ana-projekte"><thead><tr>' +
    ['Projekt', 'Kunde', 'Verlauf', 'Requests', 'Tokens', 'Aktiv h', 'Agent h', 'API USD', 'Arbeitswert', 'Anteil'].map((h, i) => '<th scope="col"' + (i > 2 ? ' class="z"' : '') + '>' + esc(uebersetze(h)) + '</th>').join('') +
    '</tr></thead><tbody>' + P.map((p) => '<tr' + (p.overhead ? ' class="gedaempft"' : '') + '><td class="ana-name" title="' + esc(p.project) + '">' + esc(p.project) +
        (p.overhead ? ' <span class="pille">' + esc(uebersetze('Werkzeug')) + '</span>' : '') + '</td>' +
      '<td class="dim ell">' + esc(p.overhead ? '–' : kunde(p.project)) + '</td>' +
      '<td>' + (modell ? '<span class="faint" title="' + esc(uebersetze('Verlauf nur ohne Modellfilter')) + '">–</span>' : projektSpark(verlauf[p.project], tage)) + '</td>' +
      '<td class="z">' + num(p.requests) + '</td><td class="z faint">' + kurz(p.total_tokens) + '</td>' +
      '<td class="z">' + nf1.format(p.active_seconds / 3600) + '</td><td class="z faint">' + nf1.format(p.agent_seconds / 3600) + '</td>' +
      '<td class="z akzent">' + nf2.format(p.cost_usd) + '</td><td class="z">' + (p.overhead ? '–' : nf2.format(p.arbeitswert)) + '</td>' +
      '<td class="z"><span class="anteil"><span class="band duenn" aria-hidden="true"><span style="width:' + (p.cost_usd / ges * 100).toFixed(1) + '%;background:var(--accent)"></span></span>' +
        nf1.format(p.cost_usd / ges * 100) + ' %</span></td></tr>').join('') + '</tbody>' +
    // Was einem Kunden zurechenbar ist und was nicht, fuer den ganzen Zeitraum.
    (sp ? '<tfoot>' + summe(esc(uebersetze('Projektarbeit')), sp.arbeit, nf2.format(sp.arbeit.arbeitswert)) +
      summe(esc(uebersetze('Werkzeugbetrieb')) + ' <span class="faint">' + esc(sp.overhead_projekte.join(', ')) + '</span>', sp.overhead,
        '<span class="faint">' + esc(uebersetze('nicht abrechenbar')) + '</span>', ' gedaempft') + '</tfoot>' : '') +
    '</table></div>';
}
aktion('ana-modell', (m) => { anaZustand.modell = !m || anaZustand.modell === m ? null : String(m); zeichneAnsicht(); });
// Linie ohne Flaeche wie im Entwurf (110 × 22).
function projektSpark(reihe, tage) {
  if (!reihe || !reihe.length) return '<span class="faint">–</span>';
  const jeTag = new Map(reihe);
  const a = area(tage.length ? tage.map((d) => jeTag.get(d) || 0) : reihe.map((x) => x[1]), 110, 22, 2);
  return '<svg class="spark" viewBox="0 0 110 22" width="110" height="22" preserveAspectRatio="none" aria-hidden="true"><path d="' + a.line + '" fill="none" stroke="var(--accent)" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>';
}

function modelleInhalt(S) {
  const kopf = anaKopf('Modelle im Zeitraum', esc(uebersetze('Anteil am API-Gegenwert · Requests und Tokens · Klick filtert „Nach Projekt“')), pinKnopf('modelle'));
  const M = (S.models || []).filter((m) => m.requests > 0).sort((a, b) => b.cost_usd - a.cost_usd);
  if (!M.length) return kopf + leer('liste', 'Keine Modelle im Zeitraum');
  const ges = M.reduce((a, m) => a + m.cost_usd, 0) || 1;
  // Farben wie der Ring: die fuenf groessten farbig, der Rest grau.
  const farbe = (i) => (i < 5 && M[i].cost_usd > 0 ? modellFarbe(i) : 'var(--m-rest)');
  return kopf + '<div class="ana-modelle">' + ringSvg(modellRing(S.models), 150, 13) +
    '<div class="tabelle-huelle"><table class="tabelle"><thead><tr>' + ['Modell', 'Requests', 'Tokens', 'USD', 'Anteil'].map((h, i) => '<th scope="col"' + (i ? ' class="z"' : '') + '>' + esc(uebersetze(h)) + '</th>').join('') +
    '</tr></thead><tbody>' + M.map((m, i) => '<tr' + (anaZustand.modell === m.model ? ' class="an"' : '') + '><td><button type="button" class="textknopf modell-filter" data-aktion="ana-modell" data-wert="' + esc(m.model) + '" aria-pressed="' + (anaZustand.modell === m.model) + '">' +
      '<span class="leg-p" style="background:' + farbe(i) + '"></span><span class="mono">' + esc(kurzModell(m.model)) + '</span></button>' +
      (m.preis_art ? ' <span class="pille warn">' + esc(uebersetze(m.preis_art === 'ohne' ? 'ohne Preis' : 'Preis geschätzt')) + '</span>' : '') + '</td>' +
      '<td class="z">' + num(m.requests) + '</td><td class="z faint">' + kurz(m.total_tokens) + '</td><td class="z akzent">' + nf2.format(m.cost_usd) + '</td>' +
      '<td class="z"><span class="anteil"><span class="band duenn breit" aria-hidden="true"><span style="width:' + (m.cost_usd / ges * 100).toFixed(1) + '%;background:' + farbe(i) + '"></span></span>' +
        nf1.format(m.cost_usd / ges * 100) + ' %</span></td></tr>').join('') + '</tbody></table>' + preisHinweis(S) + '</div></div>';
}

// Modelle ohne exakten Preis beim Namen nennen. Zwei Faelle, zwei Saetze: eine
// Schaetzung steht in der Summe, eine Luecke fehlt darin.
function preisHinweis(S) {
  const L = Array.isArray(S.preis_luecken) ? S.preis_luecken : [];
  if (!L.length) return '';
  const liste = (art) => L.filter((l) => l.preis_art === art).map((l) => kurzModell(l.model) + ' (' + num(l.requests) + ' Requests, ' + kurz(l.total_tokens) + ' Tokens)').join(', ');
  const ohne = liste('ohne'), geschaetzt = liste('geschaetzt');
  return '<div class="ed-warnung preis-hinweis">' +
    (ohne ? '<b>' + esc(uebersetze('Ohne Preis:')) + '</b> ' + esc(ohne) + '. ' + esc(uebersetze('Diese Requests stehen mit 0 USD im API-Gegenwert — die Summe ist zu niedrig.')) + ' ' : '') +
    (geschaetzt ? '<b>' + esc(uebersetze('Preis geschätzt:')) + '</b> ' + esc(geschaetzt) + '. ' + esc(uebersetze('Die Preisliste kennt das Modell nicht; gerechnet wird mit dem Preis des ähnlichsten Modells.')) + ' ' : '') +
    esc(uebersetze('Sobald die Preisliste das Modell führt, wird der Betrag automatisch nachgezogen.')) + '</div>';
}

function margeInhalt() {
  const e = ladeMargeWochen();
  const W = e.d;
  const ziel = W ? margeWochen(W).ziel : null;
  const unter = W ? esc(ziel ? uebersetze('Prozentpunkte über bzw. unter') + ' ' + nf1.format(ziel) + ' % ' + uebersetze('Zielmarge · grün über, rot unter Ziel')
    : uebersetze('Marge in Prozent (keine Zielmarge hinterlegt)')) + ' · ' + esc(uebersetze('Stand')) + ' ' +
    new Date(e.zeit).toLocaleTimeString(istDE() ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  return anaKopf('Marge je Woche gegen das Ziel', unter, pinKnopf('marge')) + margeWochenHtml(e);
}

function kostenInhalt(S) {
  const kopf = anaKopf('Kosten je Stunde im Verlauf', esc(uebersetze('API-Gegenwert (inkl. Werkzeugbetrieb) je aktive Stunde, je Woche · letzte 12 Wochen · Linie = Durchschnitt')), pinKnopf('kosten'));
  const W = (S.weeks || []).slice(-12);
  if (!W.length) return kopf + leer('liste', 'Keine Daten im Zeitraum');
  // Ohne aktive Zeit gibt es keinen Wert (null), keine 0 und kein Farbsignal.
  // Der Durchschnitt kommt aus dem Server (metrics.usdJeStunde), wie in der Hub-Kachel.
  const werte = W.map((w) => w.usd_je_stunde);
  const schnitt = S.kosten_je_stunde_12w;
  const max = Math.max(...werte.filter((v) => v != null), schnitt || 0, 0.01) * 1.15;
  return kopf + '<div class="ana-kosten">' +
      (schnitt == null ? '' : '<span class="ana-schnitt" style="bottom:' + (schnitt / max * 100).toFixed(1) + '%"></span><span class="ana-schnitt-text mono" style="bottom:' + (schnitt / max * 100).toFixed(1) + '%">Ø ' + nf1.format(schnitt) + ' USD/h</span>') +
      W.map((w, i) => '<div title="' + esc(uebersetze('Woche ab') + ' ' + datum(w.day) + ' · ' + (werte[i] == null ? '–' : nf2.format(werte[i]) + ' USD/h')) + '">' +
        '<span class="mono">' + (werte[i] == null ? '–' : nf1.format(werte[i])) + '</span>' +
        '<span class="s" style="height:' + ((werte[i] || 0) / max * 100).toFixed(1) + '%;background:' + (schnitt != null && werte[i] != null && werte[i] <= schnitt ? OFFEN_FARBE : 'var(--accent)') + '"></span></div>').join('') + '</div>' +
    '<div class="ana-kosten-achse">' + W.map((w) => '<span>' + esc(uebersetze('KW')) + ' ' + kw(w.day) + '</span>').join('') + '</div>';
}

function statusBereich(S) {
  const kopf = anaKopf('Vorgänge nach Status', esc(uebersetze('Arbeitswert in EUR · Anzahl Vorgänge')), pinKnopf('status'));
  const K = S.kennzahlen, abr = S.abrechnung || {};
  const nach = (ab) => (S.tickets || []).filter((t) => !!abr[t.ticket] === ab && t.arbeitswert > 0).sort((a, b) => b.arbeitswert - a.arbeitswert).slice(0, 3).map((t) => t.ticket);
  const zeilen = [
    ['noch nicht abgerechnet', K.offen_vorgaenge, K.offen_vorgang_eur, 'var(--text-faint)', nach(false)],
    ['abgerechnet', K.abgerechnet_vorgaenge, K.abgerechnet_eur, 'var(--ok)', nach(true)],
    ['ohne Vorgang', null, K.ohne_vorgang_eur, 'var(--line-hover)', []],
  ];
  for (const z of zeilen) z[2] = Number(z[2]) || 0;
  const ges = zeilen.reduce((a, z) => a + z[2], 0);
  return kopf + '<div class="ana-status-band">' + zeilen.map((z) => '<span style="width:' + (ges ? z[2] / ges * 100 : 0).toFixed(2) + '%;background:' + z[3] + '"></span>').join('') + '</div>' +
    '<div class="ana-status">' + zeilen.map(([l, n, e, c, keys]) => '<div class="karte eingelassen">' +
      '<span class="ana-status-kopf"><span class="leg-p" style="background:' + c + '"></span>' + esc(uebersetze(l)) + '<span class="mono faint">' + nf1.format(ges ? e / ges * 100 : 0) + ' %</span></span>' +
      '<span class="kpi-wert">' + nf2.format(e) + '<span>EUR</span></span>' +
      (n == null ? '' : '<span class="hinweis">' + n + ' ' + esc(uebersetze(n === 1 ? 'Vorgang' : 'Vorgänge')) + '</span>') +
      (keys.length ? '<span class="ana-status-keys">' + keys.map((k) => '<a class="pille mono" href="#/vorgaenge/' + encodeURIComponent(k) + '">' + esc(k) + '</a>').join('') + '</span>' : '') +
    '</div>').join('') + '</div>';
}

const BEREICH = {
  kpis: (D) => kpisInhalt(D), verlauf: () => verlaufInhalt(), akt: (D) => aktInhalt(D), sankey: () => sankeyInhalt(),
  projekte: (D) => projekteInhalt(D.S), modelle: (D) => modelleInhalt(D.S), marge: () => margeInhalt(),
  kosten: (D) => kostenInhalt(D.S), status: (D) => statusBereich(D.S),
};
// Bereiche ohne eigene Karte: die Kinder sind die Karten (Kennzahlen, Aktivität + Top-Vorgänge).
const RAHMENLOS = new Set(['kpis', 'akt']);

/* ---------- Werkzeuge ----------
   Wie im Entwurf: ein gestrichelter Rahmen trennt Werkzeugbetrieb sichtbar von
   Vorgangsarbeit. Die Erklaerung steht hinter dem "i" (Owner-Regel 05.10.),
   nicht dauerhaft als Absatz. */
// Bereiche des Reiters — Raster wie im Verbrauch (Katalog, Ziehen, Groesse), eigener Speicher.
// [id, Titel, Kurzbeschreibung, Zeichen, Wozu, Standardbreite]
const WZ = [
  ['wz-schnitt', 'Verbrauch nach Schnitt', 'Ring · Werkzeug | Projekt | Modell', '◔', 'Wohin der Verbrauch der Hintergrunddienste floss.', 1],
  ['wz-kpis', 'Kennzahlen Werkzeuge', 'Tokens, API-Gegenwert, Aufrufe', '#', 'Der Werkzeugbetrieb in drei Zahlen.', 2],
  ['wz-skills', 'Requests im Kontext eines Skills', 'Rangliste', '≡', 'Was lief, während ein Skill aktiv war.', 2],
  ['wz-woher', 'Woher die Requests der eigenen Sitzungen kamen', 'Anteile an MCP-Servern und Skills', 'ⓘ', 'Wie viel der eigenen Sitzungen über MCP-Server und Skills lief.', 2],
  ['wz-tree', 'Nach MCP-Server', 'Fläche = Anteil', '▥', 'Welche MCP-Server und Werkzeuge Tokens erzeugen.', 4],
];
RASTER.wz = { standard: WZ.map((m) => m[0]), reihe: null, meta: WZ, speicher: 'analyse.werkzeuge.raster', felder: [3, 4], an: 'sichtbar ✓', plus: '+ Bereich hinzufügen',
  min: (id) => (id === 'wz-tree' ? [480, 260] : [300, 160]) };
RAHMENLOS.add('wz-kpis');

function werkzeugeReiter(S) {
  const W = S.werkzeuge || { summe: {}, nach_werkzeug: [], nach_projekt: [], nach_modell: [] };
  const H = S.herkunft || { gesamt: {}, nach_mcp: [], nach_skill: [] };
  const anteil = (S.split && S.split.overhead_anteil_kosten) || 0;
  const SCHNITT = { werkzeug: ['nach_werkzeug', 'werkzeug'], projekt: ['nach_projekt', 'projekt'], modell: ['nach_modell', 'model'] };
  const schnitt = SCHNITT[anaZustand.schnitt] ? anaZustand.schnitt : 'werkzeug';
  const [liste, feld] = SCHNITT[schnitt];
  // Sechs groesste einzeln, der Rest als "andere" — sonst fehlte er im Ring und die Summe stimmte nicht.
  const alleS = W[liste] || [];
  const restS = alleS.slice(6).reduce((x, y) => x + y.cost_usd, 0);
  const segs = ring(alleS.slice(0, 6).map((x, i) => ({ n: feld === 'model' ? kurzModell(x[feld]) : x[feld] || '–', v: x.cost_usd, c: modellFarbe(i) }))
    .concat(restS > 0 ? [{ n: uebersetze('andere') + ' (' + num(alleS.length - 6) + ')', v: restS, c: 'var(--m-rest)' }] : []), 40, 0.012);
  const summe = W.summe.cost_usd || 0;
  const tok = kurz(W.summe.total_tokens || 0).split(' ');
  const kennzahl = (label, wert, einheit, unter, klasse) => '<div class="ana-karte ana-kpi"><span class="label">' + esc(uebersetze(label)) + '</span>' +
    '<span class="kpi-wert' + (klasse || '') + '">' + wert + (einheit ? '<span>' + esc(einheit) + '</span>' : '') + '</span><span class="hinweis">' + esc(unter) + '</span></div>';

  const nachBetrag = (a, b) => b.cost_usd - a.cost_usd;
  const alleSkills = (H.nach_skill || []).slice().sort(nachBetrag);
  const skills = anaZustand.alleSkills ? alleSkills : alleSkills.slice(0, 8);
  const maxSkill = skills.length ? skills[0].cost_usd || 1 : 1;
  const mcp = (H.nach_mcp || []).filter((s) => s.cost_usd > 0).slice().sort(nachBetrag);
  const offenS = mcp.find((s) => s.server === anaZustand.mcp) || mcp[0];
  const maxServer = mcp.length ? mcp[0].cost_usd || 1 : 1;
  // Die drei groessten Server als Spalten mit ihren Werkzeugen, der Rest gestapelt daneben.
  const gross = mcp.slice(0, 3), rest = mcp.slice(3);
  const restV = rest.reduce((a, s) => a + s.cost_usd, 0);
  // flex-grow = Anteil in Promille (Summe je Behaelter 1000; unter 1 fuellte flex
  // die Flaeche nicht), die Mindestbreite steht in px im CSS (.tm-server, .tm-rest).
  // Vorher stand sie als flex-grow in USD (Rest = 90) und schlug den groessten Server.
  const gewicht = (teil, ganz) => (ganz > 0 ? teil / ganz * 1000 : 1).toFixed(2);
  const mcpV = mcp.reduce((a, s) => a + s.cost_usd, 0);
  const server = (s) => '<button type="button" class="tm-server' + (offenS === s ? ' an' : '') + '" data-aktion="ana-mcp" data-wert="' + esc(s.server) + '"' +
      ' title="' + esc(s.server + ' · ' + nf2.format(s.cost_usd) + ' USD') + '" style="flex:' + gewicht(s.cost_usd, mcpV) + ' 1 0">' +
    '<span class="tm-kopf"><span class="ell">' + esc(s.server) + '</span><b>' + nf2.format(s.cost_usd) + '</b></span>' +
    (s.werkzeuge || []).slice().sort(nachBetrag).filter((t) => t.cost_usd > 0).map((t) => {
      const sh = t.cost_usd / s.cost_usd;
      return '<span class="tm-werkzeug' + (sh > 0.3 ? ' dunkel' : '') + '" title="' + esc(t.werkzeug + ' · ' + nf2.format(t.cost_usd) + ' USD') + '" style="flex:' + gewicht(t.cost_usd, s.cost_usd) + ' 1 0;background:color-mix(in srgb, var(--accent) ' + ((0.25 + sh * 0.75) * 100).toFixed(0) + '%, transparent)">' +
        (sh > 0.06 ? '<span class="ell">' + esc(t.werkzeug) + '</span><span>' + nf2.format(t.cost_usd) + '</span>' : '') + '</span>';
    }).join('') + '</button>';

  // Leerer Werkzeugbetrieb: sagen, was beobachtet wird und seit wann es still ist,
  // statt "erscheint, sobald es laeuft" (claude-mem 13.18 schrieb keine Logs mehr).
  const P = W.summe.projekte || [];
  const stillText = !P.length ? uebersetze('In config.json unter overheadProjekte eintragen, z. B. „.claude-mem“.')
    // Kein Punkt nach {d}: datumKurz liefert "31.08." schon mit.
    : fuelle(W.summe.zuletzt ? 'Beobachtet: {p} · letzter Request am {d}' : 'Beobachtet: {p} · noch kein Request', { p: P.join(', '), d: datumKurz(W.summe.zuletzt) }) +
      ' · ' + uebersetze('Dienste ohne eigenes Sitzungsprotokoll (z. B. rtk) sind nicht messbar.');
  const stillLeer = leer('liste', P.length ? 'Kein Werkzeugbetrieb im Zeitraum' : 'Keine Werkzeug-Projekte eingerichtet', '', '<span>' + esc(stillText) + '</span>');

  const BER = {
    'wz-schnitt': () => '<div class="wz-schnitt"><div class="wz-schnitt-kopf"><div><h2 class="titel-klein">' + esc(uebersetze('Verbrauch nach Schnitt')) + '</h2>' +
          '<span class="hinweis">' + esc(uebersetze('Hintergrunddienste mit eigener Sitzung — derselbe Verbrauch aus drei Blickwinkeln')) + '</span></div>' + pinKnopf('werk') + '</div>' +
        segment('ana-schnitt', [['werkzeug', 'Werkzeug'], ['projekt', 'Projekt'], ['modell', 'Modell']], schnitt, 'Schnitt') +
        (segs.length ? '<div class="wz-ring">' + ringSvg(segs, 130, 14) + '<div class="wz-legende">' + segs.map((s) => '<span><span class="leg-p" style="background:' + s.c + '"></span><span class="ell">' + esc(s.n) + '</span><b>' + nf2.format(s.v) + '</b></span>').join('') + '</div></div>' +
          '<div class="wz-fuss"><span>' + esc(uebersetze('Summe — bleibt in jedem Schnitt gleich')) + '</span><b>' + nf2.format(summe) + ' USD</b></div>' +
          '<p class="hinweis">' + esc(fuelle('Zuordnung über die Zeit: es zählt das Projekt, an dem im Umkreis von {n} Minuten gearbeitet wurde.', { n: num(W.summe.fenster_minuten || 0) })) + '</p>'
          : stillLeer) + '</div>',
    'wz-kpis': () => kennzahl('Tokens Werkzeuge', tok[0], tok[1] || '', uebersetze('Hintergrunddienste')) +
        kennzahl('API-Gegenwert Werkzeuge', nf2.format(summe), 'USD', nf1.format(anteil * 100) + ' % ' + uebersetze('des API-Gegenwerts'), ' akzent') +
        kennzahl('Aufrufe', num(W.summe.requests || 0), '', (W.summe.ohne_zuordnung > 0
          ? fuelle('{n} ließen sich keinem Projekt zuordnen', { n: num(W.summe.ohne_zuordnung) }) : uebersetze('alle einem Projekt zugeordnet'))),
    'wz-skills': () => '<div class="wz-skills"><div class="ana-kopf"><h2>' + esc(uebersetze('Requests im Kontext eines Skills')) + '</h2><span class="hinweis">' + esc(uebersetze('nicht die Kosten des Skills — was lief, während er aktiv war')) + '</span></div>' +
        (skills.length ? skills.map((k) => '<div class="wz-zeile"><span class="ell" title="' + esc(k.skill) + '">' + esc(k.skill) + '</span><span class="wz-bahn"><span class="gestreift" style="width:' + (k.cost_usd / maxSkill * 100).toFixed(1) + '%"></span></span><span>' + nf2.format(k.cost_usd) + ' USD</span></div>').join('')
          : leer('liste', 'Keine Skills im Zeitraum')) +
        (alleSkills.length > 8 ? '<button type="button" class="textknopf akzent" data-aktion="ana-skills">' +
          esc(anaZustand.alleSkills ? uebersetze('weniger anzeigen') : fuelle('weitere {n} anzeigen', { n: num(alleSkills.length - 8) })) + '</button>' : '') + '</div>',
    'wz-woher': () => '<div class="wz-woher"><h2>' + esc(uebersetze('Woher die Requests der eigenen Sitzungen kamen')) + '</h2>' +
      '<p><span class="pille warn">' + esc(uebersetze('ändert keine Abrechnung')) + '</span>' + esc(uebersetze('Anteile an')) + ' <span class="mono">' + nf2.format(H.gesamt.cost_usd || 0) + '</span> ' + esc(uebersetze('USD API-Gegenwert — keine Kosten obendrauf.')) + '</p>' +
      (H.gesamt.total_tokens ? '<p class="hinweis">' + esc(fuelle('Bezugsgröße: {t} Tokens aus Claude-Code-Sitzungen im Zeitraum. Davon {m} über MCP-Server, {s} im Kontext eines Skills.', {
        t: kurz(H.gesamt.total_tokens), m: nf1.format((H.mcp_tokens || 0) / H.gesamt.total_tokens * 100) + ' %', s: nf1.format((H.skill_tokens || 0) / H.gesamt.total_tokens * 100) + ' %' })) + '</p>' : '') +
      infoI('herkunft') + infoText('herkunft', 'Ein MCP-Server löst den Request aus — die Tokens gehören ihm ursächlich. Ein Skill tut das nicht: er schiebt Text in einen ohnehin laufenden Request. Seine Zeile sagt deshalb, wie viel lief, während der Skill aktiv war — nicht, was der Skill gekostet hat. Werkzeuge ohne eigene Requests (Anweisungen im Kontext, Filter vor dem Modell) fehlen hier; eine Null stünde für „nicht messbar“, nicht für „kostet nichts“.') + '</div>',
    'wz-tree': () => '<div class="ana-kopf"><h2>' + esc(uebersetze('Nach MCP-Server')) + '</h2><span class="hinweis">' + esc(uebersetze('Fläche = Anteil, sehr kleine Server mit Mindestbreite · Server anklicken, um seine Werkzeuge im selben Maßstab zu sehen')) + '</span>' +
        '<span class="rechts">' + pinKnopf('tree') + '</span></div>' +
      (mcp.length ? '<div class="tm">' + gross.map(server).join('') +
          (rest.length ? '<div class="tm-rest" style="flex:' + gewicht(restV, mcpV) + ' 1 0">' + rest.map((s) => '<button type="button" class="tm-klein' + (offenS === s ? ' an' : '') + '" data-aktion="ana-mcp" data-wert="' + esc(s.server) + '"' +
            ' title="' + esc(s.server + ' · ' + nf2.format(s.cost_usd) + ' USD') + '" style="flex:' + gewicht(s.cost_usd, restV) + ' 1 0"><span class="ell">' + esc(s.server) + '</span><span class="akzent">' + nf2.format(s.cost_usd) + '</span></button>').join('') + '</div>' : '') + '</div>' +
        (offenS ? '<div class="tm-tools"><span class="hinweis">' + esc(uebersetze('Werkzeuge von')) + ' <b class="mono">' + esc(offenS.server) + '</b></span>' +
          (offenS.werkzeuge || []).slice().sort(nachBetrag).map((t) => '<div class="wz-zeile breit"><span class="ell" title="' + esc(t.werkzeug) + '">' + esc(t.werkzeug) + '</span><span class="wz-bahn"><span style="width:' + (t.cost_usd / maxServer * 100).toFixed(2) + '%"></span></span><span>' + nf2.format(t.cost_usd) + ' USD</span></div>').join('') + '</div>' : '')
        : leer('liste', 'Keine MCP-Aufrufe im Zeitraum')),
  };
  const st = rasterStand('wz');
  const meta = Object.fromEntries(WZ.map((m) => [m[0], m]));

  return '<section class="werkzeug-rahmen">' +
    '<div class="wz-kopf"><span class="wz-zeichen" aria-hidden="true">⚙</span>' +
      '<div class="wz-titel"><div><h2>' + esc(uebersetze('Werkzeugbetrieb')) + '</h2><span class="pille voll-warn">' + esc(uebersetze('Nur Werkzeugdaten')) + '</span>' +
        ' <a class="knopf klein" href="#/werkzeuge">' + esc(uebersetze('Verwalten → Werkzeuge')) + '</a>' +
        '<span class="pille warn">' + esc(uebersetze('nicht abrechenbar')) + '</span>' + infoI('werkzeuge') + '</div>' +
        infoText('werkzeuge', 'Hintergrunddienste mit eigener Sitzung — claude-mem, Sync-Jobs, MCP-Server. Diese Zahlen gehören zu keinem Vorgang, fließen in keine Rechnung und ändern keine Marge.') + '</div>' +
      '<div class="wz-summe"><span class="kpi-wert">' + nf2.format(summe) + '<span>USD</span></span><span class="hinweis">' + nf1.format(anteil * 100) + ' % ' + esc(uebersetze('des API-Gegenwerts')) + '</span></div></div>' +
    katalogHtml('wz', WZ, st.sicht) +
    '<div class="raster-kacheln ana wz" data-raster="wz">' + st.sicht.filter((id) => meta[id]).map((id) =>
      kachel('wz', id, meta[id][1], '', BER[id](), st.breite[id] || meta[id][5], { kopf: '', greif: 'Bereich ziehen', klasse: RAHMENLOS.has(id) ? 'rahmenlos' : '' })).join('') +
      (st.sicht.length ? '' : leer('liste', 'Keine Bereiche ausgewählt', 'Über Bearbeiten hinzufügen.')) + '</div>' +
  '</section>';
}

/* ---------- Reiter Arbeitszeit (Mockup Redesign Z. 588–613) ----------
   Zahlen aus /api/zeit/analyse (zeit.analyse) — derselbe Stand wie die Hub-Reihe.
   "Workload 7 Tage" aus /api/zeit/workload: gilt ab heute, nicht fuer den Zeitraum. */
function arbeitszeitReiter() {
  ladeHubZeit();
  const kopf = '<div class="ana-kopf"><h2>' + esc(uebersetze('Arbeitszeit und manuelle Zeit')) + '</h2><span class="hinweis">' +
    esc(uebersetze('Claude-Zeit und Zeiterfassung zusammen · Parallelzeit in der Arbeitszeit nur einmal')) + '</span>' +
    '<span class="rechts"><a class="akzent" href="#/zeit" style="font-size:12px">' + esc(uebersetze('Zeiterfassung')) + ' →</a></span></div>';
  const A = hubZeit.d;
  if (!A) {
    return '<section class="karte weit ana-az">' + kopf + (hubZeit.fehler ? leer('uhr', 'Zeiterfassung nicht geladen', hubZeit.fehler) : '<div class="leer">…</div>') + '</section>';
  }
  const K = A.kpis;
  const kpi = (l, v, u, sub, klasse) => '<div class="az-kpi"><span class="label">' + esc(uebersetze(l)) + '</span><span class="mono az-kpi-v ' + (klasse || '') + '">' + esc(v) +
    '<small>' + esc(u) + '</small></span><span class="hinweis">' + esc(sub) + '</span></div>';
  // Leere Wochen vor der ersten Arbeit (Zeitraum "Jahr" vor dem Erfassungsbeginn) weglassen.
  const erste = A.wochen.findIndex((w) => w.ist_stunden || w.claude_stunden || w.manuell_stunden);
  const W = erste < 0 ? [] : A.wochen.slice(erste);
  const soll = Math.max(0, ...W.map((w) => w.soll_stunden));
  const hmax = Math.max(soll * 1.2, ...W.map((w) => Math.max(w.ist_stunden, w.claude_stunden + w.manuell_stunden) * 1.08), 1);
  const pct = (h) => (h / hmax * 100).toFixed(1);
  const heuteMo = zMontag(new Date());
  const wochen = W.length ? '<div class="az-balken">' + (soll ? '<span class="az-soll" style="bottom:' + pct(soll) + '%"><span class="mono">' + esc(uebersetze('Soll')) + '</span></span>' : '') +
      W.map((w) => '<div class="az-woche" title="' + esc(datumKurz(w.montag) + ' · ' + uebersetze('Arbeitszeit') + ' ' + zdur(w.ist_stunden * 60) + ' h · ' + uebersetze('abrechenbar') + ' ' +
        zdur((w.claude_stunden + w.manuell_stunden) * 60) + ' h (Claude ' + zdur(w.claude_stunden * 60) + ' + ' + uebersetze('manuell') + ' ' + zdur(w.manuell_stunden * 60) + ')') + '">' +
        '<span class="mono az-wert">' + zdur((w.claude_stunden + w.manuell_stunden) * 60) + '</span>' +
        '<span class="az-man" style="height:' + pct(w.manuell_stunden) + '%"></span><span class="az-cl" style="height:' + pct(w.claude_stunden) + '%"></span>' +
        '<span class="az-ist" style="bottom:' + pct(w.ist_stunden) + '%"></span></div>').join('') + '</div>' +
      '<div class="az-achse">' + W.map((w) => '<span class="mono' + (w.montag === heuteMo ? ' akzent' : '') + '">' + esc(datumKurz(w.montag) + (w.montag === heuteMo ? ' · ' + uebersetze('bisher') : '')) + '</span>').join('') + '</div>' +
      '<div class="az-legende"><span><span class="leg-p" style="background:var(--accent)"></span>Claude</span><span><span class="leg-p" style="background:var(--zeit-manuell)"></span>' + esc(uebersetze('manuell')) + '</span>' +
        '<span><span class="az-leg-ist"></span>' + esc(uebersetze('Arbeitszeit')) + '</span></div>'
    : leer('uhr', 'Keine Einträge in diesem Zeitraum.');
  const T = A.taetigkeiten;
  const tmax = Math.max(1, ...T.map((t) => t.min));
  const taet = T.length ? T.map((t, i) => '<div class="az-tat"><span class="ell">' + esc(t.name) + '</span><span class="band duenn"><span style="width:' + (t.min / tmax * 100).toFixed(1) + '%;background:' + modellFarbe(i) + '"></span></span>' +
      '<span class="mono">' + zdur(t.min) + '</span><span class="mono faint">' + esc(eur(t.eur)) + '</span></div>').join('')
    : '<span class="hinweis">' + esc(uebersetze('Keine Einträge in diesem Zeitraum.')) + '</span>';
  // Scheitert ein spaeteres Nachladen, bleiben die alten Zahlen — sichtbar als nicht aktualisiert.
  const alt = hubZeit.fehler ? '<span class="hinweis bad">' + esc(uebersetze('Nicht aktualisiert') + ': ' + hubZeit.fehler) + '</span>' : '';
  return '<section class="karte weit ana-az">' + kopf + alt +
    '<div class="az-kpis">' +
      kpi('Abrechenbare Zeit', nf1.format(K.abrechenbar_stunden), 'h', 'Claude ' + nf1.format(K.claude_stunden) + ' + ' + uebersetze('manuell') + ' ' + nf1.format(K.manuell_stunden)) +
      kpi('Manueller Anteil', nf0.format(K.manuell_anteil * 100), '%', uebersetze('der abrechenbaren Zeit'), 'zh-man') +
      kpi('Parallel abgerechnet', zdur(K.parallel_min), 'h', uebersetze('Meeting + Claude gleichzeitig'), 'ok') +
      kpi('Kulanz', nf0.format(K.kulanz_min), 'Min', uebersetze('nicht berechnet, 0,00 EUR')) +
      (zWl.d ? kpi('Workload 7 Tage', zWlProzent(zWl.d.summe), '%', zdur(zWl.d.summe.belegt_min) + ' h ' + uebersetze('von') + ' ' + zdur(zWl.d.summe.kapazitaet_min) + ' h · ' + zWlUeber(zWl.d.summe)) : '') +
    '</div>' +
    '<div class="az-raster"><div class="az-spalte"><div class="az-k"><span class="label">' + esc(uebersetze('Auslastung je Woche')) + '</span><span class="hinweis">' +
        esc(soll ? fuelle('abrechenbar vs. Arbeitszeit, Soll {h} h', { h: nf1.format(soll) }) : uebersetze('abrechenbar vs. Arbeitszeit')) + '</span></div>' + wochen + '</div>' +
      '<div class="az-spalte"><div class="az-k"><span class="label">' + esc(uebersetze('Manuelle Zeit nach Tätigkeit')) + '</span><span class="hinweis">' + esc(uebersetze('Zeitraum')) + '</span></div>' + taet + '</div>' +
      '<div class="az-spalte">' + zWorkloadSpalte() + '</div></div>' +
  '</section>';
}

/* ---------- Seite ---------- */
function zeichneAnalyse(w, teile) {
  const S = state.summary;
  if (!S || !S.kennzahlen) { w.innerHTML = state.fehler.summary ? leer('liste', 'Server nicht erreichbar', 'Es wird weiter versucht.') : '<div class="leer">…</div>'; return; }
  ladeHubDaten();
  const reiter = anaReiter().some((r) => r[0] === teile[0]) ? teile[0] : (anaReiter().some((r) => r[0] === lies('analyse.reiter')) ? lies('analyse.reiter') : 'verbrauch');
  merke('analyse.reiter', reiter);
  const kopf = '<div class="abschnitt-kopf"><div class="links"><div class="segment ana-reiter" role="tablist">' +
    anaReiter().map(([k, l]) => '<a role="tab" href="#/analyse/' + k + '" aria-selected="' + (k === reiter) + '"' + (k === reiter ? ' aria-current="page"' : '') + '>' + esc(uebersetze(l)) + '</a>').join('') + '</div>' +
    '<span class="hinweis">' + esc(uebersetze(REITER.find((r) => r[0] === reiter)[2])) + '</span></div>' +
    (reiter === 'arbeitszeit' ? '' : rasterKnoepfe(anaSek())) + '</div>';

  let inhalt;
  if (reiter === 'arbeitszeit') {
    inhalt = arbeitszeitReiter();
  } else if (reiter === 'werkzeuge') {
    inhalt = werkzeugeReiter(S);
  } else {
    const st = rasterStand('ana');
    const meta = Object.fromEntries(ANA.map((m) => [m[0], m]));
    const D = { S, V: state.vorher };
    inhalt = katalogHtml('ana', ANA, st.sicht) +
      '<div class="raster-kacheln ana" data-raster="ana">' + st.sicht.filter((id) => meta[id]).map((id) =>
        kachel('ana', id, meta[id][1], '', BEREICH[id](D), st.breite[id] || meta[id][5], { kopf: '', greif: 'Bereich ziehen', klasse: RAHMENLOS.has(id) ? 'rahmenlos' : '' })).join('') +
        (st.sicht.length ? '' : leer('liste', 'Keine Daten im Zeitraum', 'Über Bearbeiten hinzufügen.')) + '</div>';
  }
  w.innerHTML = kopf + inhalt;
  verdrahteRaster(w);
}

function rasterKnoepfe(sek) {
  const st = rasterStand(sek);
  const ed = hubZustand.bearbeiten[sek];
  return '<div class="rechts">' +
    (st.angepasst ? '<button type="button" class="pille warn" data-aktion="raster-standard" data-wert="' + sek + '" title="' + esc(uebersetze('Auswahl, Reihenfolge und Größen auf Standard zurücksetzen')) + '">' + esc(uebersetze('Angepasst · ↺ Standard')) + '</button>'
      : '<span class="pille" title="' + esc(uebersetze('Empfohlene Auswahl, Reihenfolge und Größen')) + '">' + esc(uebersetze('Standard')) + '</span>') +
    (ed ? '<button type="button" class="knopf klein' + (hubZustand.katalog[sek] ? ' an' : '') + '" data-aktion="raster-katalog" data-wert="' + sek + '">' +
      esc(uebersetze(hubZustand.katalog[sek] ? '× Auswahl schließen' : '+ Bereich hinzufügen')) + '</button>' +
      '<span class="hinweis akzent">' + esc(uebersetze('an ⋮⋮ ziehen zum Verschieben')) + '</span>' +
      '<button type="button" class="knopf klein" data-aktion="raster-standard" data-wert="' + sek + '">↺ ' + esc(uebersetze('Auf Standard')) + '</button>' : '') +
    '<button type="button" class="knopf' + (ed ? ' primaer' : '') + '" data-aktion="raster-bearbeiten" data-wert="' + sek + '">' + (ed ? '✓ ' + esc(uebersetze('Fertig')) : '✎ ' + esc(uebersetze('Bearbeiten'))) + '</button></div>';
}

aktion('ana-koernung', (k) => { merke('analyse.koernung', k); zeichneAnsicht(); });
aktion('ana-form', (f) => { merke('analyse.form', f); zeichneAnsicht(); });
aktion('ana-tabelle', () => { merke('analyse.tabelle', lies('analyse.tabelle', '0') === '1' ? '0' : '1'); zeichneAnsicht(); });
aktion('ana-schnitt', (s) => { anaZustand.schnitt = s; zeichneAnsicht(); });
aktion('ana-mcp', (s) => { anaZustand.mcp = s; zeichneAnsicht(); });

registriere('analyse', { zeichne: zeichneAnalyse });
