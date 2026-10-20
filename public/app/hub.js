'use strict';
/* Hub: Startseite. Hero (Erloes im Zeitraum) und Live-Karte, darunter zwei
   frei anordenbare Raster: "Instrumente" (Zustand gegen ein Soll) und
   "Meine Metriken" (Kennzahlen, Diagramme, Belege ohne Soll). Gerechnet wird
   im Server (kennzahlen, byDay, live); hier wird nur dargestellt. */

Object.assign(EN, {
  'Erlös im Zeitraum': 'Revenue in period', 'Arbeitswert — (Claude + manuelle Zeit) × Stundensatz': 'Work value — (Claude + manual time) × hourly rate',
  'ggü.': 'vs.', 'in': 'in', 'Vorgängen': 'jobs',
  'USD/h Verbrauchsrate': 'USD/h burn rate', 'Listenpreis, letzte 60 Min hochgerechnet': 'List price, last 60 min extrapolated',
  'Tokens je Minute': 'Tokens per minute', 'jetzt': 'now', 'verbunden': 'connected', 'nicht lesbar': 'not readable', 'Fehler': 'Error',
  'eingeschaltet': 'enabled', 'aus': 'off', 'aktuell': 'current', 'Letzter Abgleich': 'Last sync', 'Dauer': 'Duration',
  'Neue Ereignisse': 'New events', 'Instanz': 'Instance', 'Vorgangskürzel': 'Job prefixes', 'Quelle': 'Source', 'Modelle': 'Models',
  'Instrumente': 'Instruments', 'Zustand gegen ein Soll — Ziele, Quoten, Auslastung': 'State against a target — goals, ratios, utilisation',
  'Meine Metriken': 'My metrics', 'deine Schnellansicht ohne Soll — Kennzahlen, Diagramme, Belege': 'your quick view without targets — figures, charts, documents',
  'Instrumente vs. Meine Metriken': 'Instruments vs. my metrics', 'Standard': 'Default', 'Angepasst · ↺ Standard': 'Customised · ↺ default',
  'Empfohlene Auswahl, Reihenfolge und Größen': 'Recommended selection, order and sizes',
  'Auswahl, Reihenfolge und Größen auf Standard zurücksetzen': 'Reset selection, order and sizes to default',
  '+ Instrument hinzufügen': '+ Add instrument', '+ Metrik hinzufügen': '+ Add metric', '× Auswahl schließen': '× Close selection',
  'an ⋮⋮ ziehen zum Verschieben': 'drag ⋮⋮ to move', 'Fertig': 'Done', 'Bearbeiten': 'Edit',
  'Anklicken fügt hinten an oder blendet aus · in die Reihe ziehen setzt an die Stelle': 'Click adds at the end or hides · drag into the row to place',
  'sichtbar ✓': 'visible ✓', 'im Hub ✓': 'on hub ✓', 'Klick blendet aus': 'click hides', 'Klick fügt hinzu': 'click adds',
  'Ziehen zum Verschieben': 'Drag to move', 'ziehen': 'drag', 'Entfernen': 'Remove', 'Breite ziehen · Doppelklick = Auto': 'Drag width · double-click = auto',
  'Höhe ziehen · Doppelklick = Auto': 'Drag height · double-click = auto', 'Größe frei ziehen · Pfeiltasten ±10 px · Doppelklick = Auto': 'Drag size freely · arrow keys ±10 px · double-click = auto',
  'Größe ändern': 'Resize', 'Größe zurücksetzen': 'Reset size', 'Zu klein für diese Ansicht': 'Too small for this view', 'mindestens': 'at least',
  'größer ziehen oder Auto-Größe': 'drag larger or use auto size', 'Auto-Größe': 'Auto size',
  'Metrik hinzufügen': 'Add metric', 'Noch keine eigenen Metriken': 'No metrics of your own yet', 'oder hierher ziehen': 'or drag here',
  'Kennzahlen, Diagramme oder Belege auf den Hub holen.': 'Bring figures, charts or documents onto the hub.',
  'Keine Instrumente ausgewählt': 'No instruments selected', 'Über Bearbeiten hinzufügen.': 'Add them via Edit.',
  'Instrumente — Zustand gegen ein Soll': 'Instruments — state against a target', 'Meine Metriken — deine Schnellansicht': 'My metrics — your quick view',
  'Jede Anzeige hat eine Skala, Zielmarke oder Ampel: Monatsziel, Marge, Abrechnungsquote, Auslastung. Sie beantworten „Bin ich im grünen Bereich?“':
    'Every gauge has a scale, target mark or traffic light: monthly goal, margin, invoicing ratio, utilisation. They answer "Am I in the green?"',
  'Einzelne Kennzahlen, Diagramme und Belege aus Analyse und Abrechnung — ohne Soll, frei angeordnet. Sie beantworten „Was will ich täglich sehen?“':
    'Single figures, charts and documents from analytics and billing — no targets, freely arranged. They answer "What do I want to see every day?"',
  'Beide starten mit einer empfohlenen Auswahl. Über Bearbeiten hinzufügen, ziehen und Breite ändern — „↺ Standard“ stellt den Ausgangszustand wieder her.':
    'Both start with a recommended selection. Use Edit to add, drag and resize — "↺ default" restores the original state.',
  'Marge': 'Margin', 'nach Sachkosten und eigener Zeit': 'after material costs and own time', '% vom Erlös': '% of revenue',
  'Ziel': 'Target', 'kein Ziel gesetzt': 'no target set', 'Selbstkostensatz fehlt': 'Own cost rate missing',
  'Ohne ihn bliebe die eigene Arbeitszeit unberechnet.': 'Without it your own working time would not be costed.',
  'Noch kein Erlös im Zeitraum': 'No revenue in this period yet',
  'Abo vs. API-Gegenwert': 'Subscription vs. API equivalent', 'gezahlt vs. Listenpreis, beides in EUR': 'paid vs. list price, both in EUR',
  'so viel Listenpreis deckt das Abo': 'list price covered by the subscription', 'kein Abo-Preis hinterlegt': 'no subscription price set',
  'Abo-Kosten': 'Subscription cost', 'API-Gegenwert': 'API equivalent', 'Modell-Anteile': 'Model shares', 'API-Gegenwert in USD': 'API equivalent in USD',
  'Keine Modelle im Zeitraum': 'No models in this period', 'andere': 'other',
  'Aktive Stunden': 'Active hours', 'heute': 'today', 'diese Woche': 'this week', 'aktive Zeit im Zeitraum': 'active time in period',
  'Agentenzeit': 'agent time', 'Noch nicht abgerechnet': 'Not yet invoiced', 'noch nicht abgerechnet': 'not yet invoiced', 'Claude: Aktivität': 'Claude: activity',
  'Verbrauchsrate': 'Burn rate', 'USD/h · Skala 0–30': 'USD/h · scale 0–30', 'Abrechnungsquote': 'Invoicing ratio',
  'Arbeitswert abgerechnet vs. noch nicht abgerechnet': 'Work value invoiced vs. not yet invoiced', 'abgerechnet': 'invoiced',
  'Agentenzeit vs. aktive Zeit': 'Agent time vs. active time', 'wie viel der KI-Laufzeit abrechenbar ist': 'how much of the AI runtime is billable',
  'der Agentenzeit ist aktive Zeit': 'of agent time is active time', 'aktive Zeit': 'active time', 'Agentenzeit gesamt': 'total agent time',
  'Monatsziel Umsatz': 'Monthly revenue goal', 'Erlös im laufenden Monat gegen Ziel': 'Revenue this month against goal', 'Ziel ändern': 'Change goal',
  'z. B. 5000': 'e.g. 5000', 'Monatsziel in EUR': 'Monthly goal in EUR', 'Ein Ziel setzen, um den Fortschritt im Monat zu sehen.': 'Set a goal to see this month\'s progress.',
  'noch': 'still', 'Arbeitstage': 'working days', 'Ziel erreicht ✓': 'Goal reached ✓',
  'Cache-Trefferquote': 'Cache hit rate', 'Anteil gelesener Cache-Tokens am Eingang': 'Share of cache reads in input tokens', 'aus dem Cache gelesen': 'read from cache',
  'Ersparnis ggü. ohne Cache': 'Saving vs. no cache', 'Listenpreis: Cache-Lesen kostet je Token einen Bruchteil eines Input-Tokens.': 'List price: a cache read costs a fraction of an input token.',
  'offen · bezahlt': 'open · paid', 'überfällig': 'overdue', 'bezahlt im Zeitraum': 'paid in period', 'Zu den Rechnungen': 'To invoices',
  'Sitzungen heute': 'Sessions today', 'Offene Posten': 'Open items', 'gestellte Rechnungen, noch nicht bezahlt · Liquidität, nicht Leistung': 'issued invoices not yet paid · liquidity, not output',
  'Zahlungseingänge erfassen und offene Posten verfolgen.': 'Record payments and track open items.', 'Gehört zur Pro-Version.': 'Part of the Pro version.',
  'Arbeitszeit heute': 'Working time today', 'Manuelle Zeit im Zeitraum': 'Manual time in period',
  '% der abrechenbaren Zeit': '% of billable time', 'abrechenbar': 'billable',
  'Tokens gesamt': 'Total tokens', 'Requests': 'Requests', 'Listenpreis, nicht gezahlt': 'List price, not paid', 'anteilig im Zeitraum': 'pro rata in period',
  'API-Gegenwert je Woche': 'API equivalent per week', 'Woche ab': 'Week of', 'Modelle im Zeitraum': 'Models in period',
  'Werkzeugbetrieb-Anteil': 'Tool overhead share', 'des API-Gegenwerts': 'of API equivalent', 'MCP-Server': 'MCP servers', 'Keine MCP-Aufrufe im Zeitraum': 'No MCP calls in this period',
  'Marge je Woche': 'Margin per week', 'gegen Ziel': 'vs. target', 'Marge Woche für Woche gegen dein Ziel.': 'Margin week by week against your target.',
  'Kosten je Stunde': 'Cost per hour', 'Vorgänge nach Status': 'Jobs by status', 'Aktivität': 'Activity', 'Tage in Folge aktiv': 'days active in a row',
  'Top-Vorgänge': 'Top jobs', 'nach Gegenwert': 'by equivalent value', 'Keine Vorgänge im Zeitraum': 'No jobs in this period',
  'Nach Projekt': 'By project', 'Letzte Rechnungen': 'Latest invoices', 'Noch keine Rechnungen': 'No invoices yet', 'Noch keine Angebote': 'No quotes yet',
  'Keine Daten im Zeitraum': 'No data in this period', 'Öffnen': 'Open',
  'Noch keine Claude-Sitzung erfasst': 'No Claude session recorded yet', 'Einstellungen öffnen': 'Open settings',
  'Starte eine Claude-Code-Sitzung — sie erscheint hier nach dem nächsten Abgleich. Danach Stundensatz und Stammdaten unter Einstellungen setzen.':
    'Start a Claude Code session — it appears here after the next sync. Then set your hourly rate and master data in Settings.',
  'Kennzahl': 'Figure', 'Ring': 'Ring', 'Doppelring': 'Double ring', 'Gauge mit Zielmarke': 'Gauge with target mark', 'Gauge, live': 'Gauge, live',
  'Gauge, Ziel änderbar': 'Gauge, editable goal', 'Zahl + Puls': 'Number + pulse', 'Claude · manuell · Agent': 'Claude · manual · agent',
  'abgerechnet vs. noch nicht abgerechnet': 'invoiced vs. not yet invoiced', 'fällig · überfällig · bezahlt': 'due · overdue · paid', 'Balken mit Werten': 'Bars with values',
  'Ring + Anteile': 'Ring + shares', 'nur Werkzeugdaten': 'tool data only', 'USD je aktive h': 'USD per active h', 'noch nicht abgerechnet · abgerechnet': 'not yet invoiced · invoiced',
  'Heatmap + Serie': 'Heatmap + streak', 'Anteil API-Gegenwert': 'Share of API equivalent', 'Status & Betrag': 'Status & amount', 'offen / angenommen': 'open / accepted',
  'gegenüber der gleich langen Vorperiode': 'vs. the previous period of equal length', 'Erklärung': 'Explanation',
  'Claude: Eigene Zeit': 'Claude: own time', 'Min um Eingaben': 'min around inputs',
  'Liegst du über deiner Zielmarge? Für Preis- und Rabattentscheidungen.': 'Are you above your target margin? For pricing and discount decisions.',
  'Lohnt sich das Abo? Zeigt, wie viel Listenpreis es deckt.': 'Is the subscription worth it? Shows how much list price it covers.',
  'Welche Modelle den Verbrauch treiben — für Kostensteuerung.': 'Which models drive consumption — for cost control.',
  'Wie viel abrechenbare Zeit entsteht und was noch offen ist.': 'How much billable time accrues and what is still open.',
  'Warnt, wenn gerade ungewöhnlich viel verbraucht wird.': 'Warns when consumption is unusually high right now.',
  'Wie viel der erbrachten Arbeit schon in Rechnung ist.': 'How much of the work done is already invoiced.',
  'Wie viel Claude allein arbeitet, ohne dass du abrechnest.': 'How much Claude works alone without you billing.',
  'Fortschritt zum Monatsziel und was noch fehlt.': 'Progress towards the monthly goal and what is missing.',
  'Technische Effizienz — hoch heißt günstiger.': 'Technical efficiency — higher means cheaper.',
  'Wie viele Claude-Sitzungen heute liefen.': 'How many Claude sessions ran today.',
  'Liquidität: was Kunden dir noch schulden — getrennt vom Erlös.': 'Liquidity: what customers still owe you — separate from revenue.',
  'Volumen im Blick, z. B. für Limits.': 'Keep an eye on volume, e.g. for limits.',
  'Was deine Nutzung zum Listenpreis wert ist.': 'What your usage is worth at list price.', 'Fixkosten im Zeitraum.': 'Fixed costs in the period.',
  'Wie aktiv du mit Claude arbeitest.': 'How actively you work with Claude.', 'Wochenvergleich auf einen Blick.': 'Week-on-week at a glance.',
  'Welche Modelle du nutzt.': 'Which models you use.', 'Wie viel Verbrauch auf eigene Werkzeuge entfällt.': 'How much consumption goes to your own tools.',
  'Welche MCP-Server Tokens erzeugen.': 'Which MCP servers generate tokens.', 'Ob die Stunde teurer wird.': 'Whether an hour is getting more expensive.',
  'Was offen oder abgerechnet ist.': 'What is open or invoiced.', 'Deine aktiven Tage und Serien.': 'Your active days and streaks.',
  'Vorgänge mit dem meisten Gegenwert.': 'Jobs with the highest equivalent value.', 'Verbrauch je Projekt.': 'Consumption per project.',
  'Letzte Rechnungen mit Status.': 'Latest invoices with status.', 'Offene und angenommene Angebote.': 'Open and accepted quotes.',
});

const GARC = Math.PI * 80;          // Halbbogen r=80 (Gauges)
const C40 = 2 * Math.PI * 40;       // Ring r=40

// Daten neben dem gewaehlten Zeitraum: Heute/Woche/Heatmap brauchen die
// letzten 12 Wochen, das Monatsziel den laufenden Monat, "Sitzungen heute"
// die Live-Daten seit Mitternacht.
const hubDaten = { tage: null, monat: null, heute: null, zeit: 0, laeuft: false };
async function ladeHubDaten(erzwingen) {
  if (hubDaten.laeuft || (!erzwingen && Date.now() - hubDaten.zeit < 55000)) return;
  hubDaten.laeuft = true;
  const jetzt = new Date();
  const m = zeitraum('monat', jetzt);
  const seitMitternacht = jetzt.getHours() * 60 + jetzt.getMinutes() + 1;
  try {
    const [tage, monat, live] = await Promise.all([
      hole('/api/timeline?' + abfrage({ from: isoTag(plusTage(jetzt, -83)), to: isoTag(jetzt) })),
      hole('/api/kennzahlen?' + abfrage({ from: m.von, to: m.bis })),
      hole('/api/live?minutes=' + seitMitternacht),
    ]);
    Object.assign(hubDaten, { tage, monat, heute: live, zeit: Date.now(), fehler: false });
  } catch { hubDaten.zeit = Date.now() - 40000; hubDaten.fehler = true; /* in 15 s erneut */ }
  hubDaten.laeuft = false;
  if (['hub', 'live', 'analyse'].includes(route().name)) zeichneAnsicht();
}

/* ---------- kleine Zeichenhilfen ---------- */
function gaugeSvg(anteil, farbe, opt = {}) {
  const a = Math.max(0, Math.min(1, anteil || 0));
  const w = opt.breite || 14;
  const kappe = opt.rund ? ' stroke-linecap="round"' : '';
  let s = '<svg viewBox="0 0 200 118" class="gauge" aria-hidden="true">' +
    '<path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="var(--line-soft)" stroke-width="' + w + '"' + kappe + '/>' +
    '<path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="' + farbe + '" stroke-width="' + w + '"' + kappe +
      ' stroke-dasharray="' + (a * GARC).toFixed(1) + ' 400" class="gauge-bogen"/>';
  if (opt.ziel != null) {
    const z = Math.max(0, Math.min(1, opt.ziel));
    const [x1, y1] = arcPt(100, 100, 70, z), [x2, y2] = arcPt(100, 100, 90, z);
    s += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="var(--text)" stroke-width="2.5"/>';
  }
  if (opt.nadel) {
    s += '<g class="nadel" style="transform:rotate(' + (-90 + a * 180).toFixed(1) + 'deg)"><rect x="98.5" y="34" width="3" height="66" rx="1.5" fill="var(--text)"/></g>' +
      '<circle cx="100" cy="100" r="6" fill="var(--text)"/>';
  }
  return s + '</svg>';
}
function ringSvg(segs, groesse, staerke) {
  return '<svg viewBox="0 0 100 100" width="' + groesse + '" height="' + groesse + '" class="ring" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="40" fill="none" stroke="var(--line-soft)" stroke-width="' + staerke + '"/>' +
    segs.map((m) => '<circle cx="50" cy="50" r="40" fill="none" stroke="' + m.c + '" stroke-width="' + staerke + '"' +
      ' stroke-dasharray="' + m.dash + '" stroke-dashoffset="' + m.off + '"/>').join('') + '</svg>';
}
function anteilRing(anteil, farbe, groesse = 96) {
  const a = Math.max(0, Math.min(1, anteil || 0));
  return ringSvg([{ c: farbe, dash: (a * C40).toFixed(1) + ' ' + C40.toFixed(1), off: '0' }], groesse, 11);
}
function sparkFlaeche(werte, farbe, id) {
  if (!werte.length || werte.every((v) => !v)) return '<div class="spark"></div>';
  const a = area(werte, 300, 40, 4);
  return '<svg viewBox="0 0 300 40" preserveAspectRatio="none" class="spark" aria-hidden="true">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + farbe + '" stop-opacity=".3"/><stop offset="1" stop-color="' + farbe + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + a.fill + '" fill="url(#' + id + ')"/><path d="' + a.line + '" fill="none" stroke="' + farbe + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
}
const legende = (farbe, text, wert, wertFarbe) => '<span class="leg"><span class="leg-l"><span class="leg-p" style="background:' + farbe + '"></span>' +
  esc(uebersetze(text)) + '</span><b' + (wertFarbe ? ' style="color:' + wertFarbe + '"' : '') + '>' + wert + '</b></span>';
const zahlEinheit = (wert, einheit) => '<span class="instr-wert">' + wert + '<span>' + esc(einheit) + '</span></span>';
const OFFEN_FARBE = 'color-mix(in srgb, var(--accent) 55%, transparent)';

// Modelle nach Kosten: die fuenf groessten, der Rest als "andere".
function modellRing(modelle) {
  const sortiert = (modelle || []).filter((m) => m.cost_usd > 0).sort((a, b) => b.cost_usd - a.cost_usd);
  const top = sortiert.slice(0, 5).map((m, i) => ({ n: kurzModell(m.model), v: m.cost_usd, c: modellFarbe(i) }));
  const rest = sortiert.slice(5).reduce((a, m) => a + m.cost_usd, 0);
  if (rest > 0) top.push({ n: uebersetze('andere'), v: rest, c: modellFarbe(99) });
  return ring(top, 40, 0.012);
}

// Werktage (Mo–Fr) des laufenden Monats ab heute.
function restArbeitstage(heute) {
  let n = 0;
  const ende = new Date(heute.getFullYear(), heute.getMonth() + 1, 0);
  for (let d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()); d <= ende; d = plusTage(d, 1)) if (d.getDay() % 6 !== 0) n++;
  return n;
}
const stundenJeTag = () => Object.fromEntries((hubDaten.tage || []).map((t) => [t.day, t.active_seconds / 3600]));

/* ---------- Instrumente ---------- */
// [id, Titel, Kurzbeschreibung, Zeichen, Wozu, Pro]
const INSTRUMENTE = [
  ['marge', 'Marge', 'Gauge mit Zielmarke', '◠', 'Liegst du über deiner Zielmarge? Für Preis- und Rabattentscheidungen.'],
  ['abo', 'Abo vs. API-Gegenwert', 'Doppelring', '◎', 'Lohnt sich das Abo? Zeigt, wie viel Listenpreis es deckt.'],
  ['modelle', 'Modell-Anteile', 'Ring', '◔', 'Welche Modelle den Verbrauch treiben — für Kostensteuerung.'],
  ['stunden', 'Aktive Stunden', 'Claude · manuell · Agent', '◷', 'Wie viel abrechenbare Zeit entsteht und was noch offen ist.'],
  ['burn', 'Verbrauchsrate', 'Gauge, live', '◜', 'Warnt, wenn gerade ungewöhnlich viel verbraucht wird.'],
  ['quote', 'Abrechnungsquote', 'abgerechnet vs. noch nicht abgerechnet', '◑', 'Wie viel der erbrachten Arbeit schon in Rechnung ist.'],
  ['agent', 'Agentenzeit vs. aktive Zeit', 'Ring', '◐', 'Wie viel Claude allein arbeitet, ohne dass du abrechnest.'],
  ['ziel', 'Monatsziel Umsatz', 'Gauge, Ziel änderbar', '◎', 'Fortschritt zum Monatsziel und was noch fehlt.'],
  ['cache', 'Cache-Trefferquote', 'Ring', '◒', 'Technische Effizienz — hoch heißt günstiger.'],
  ['sitz', 'Sitzungen heute', 'Zahl + Puls', '●', 'Wie viele Claude-Sitzungen heute liefen.'],
  // Free seit Owner-Entscheidung 06.10. (R0): Zahlungen sind Free, nur die Ampel (ueberfaellig) ist Pro.
  ['op', 'Offene Posten', 'offen · bezahlt', '€', 'Liquidität: was Kunden dir noch schulden — getrennt vom Erlös.'],
];
const INSTRUMENTE_STANDARD = ['ziel', 'op', 'marge', 'quote', 'stunden', 'burn', 'agent'];
// Reihenfolge ohne eigene Anordnung: wie im Katalog.
const INSTRUMENTE_REIHE = INSTRUMENTE.map((m) => m[0]);

function instrumentInhalt(id, D) {
  const S = D.S, K = S.kennzahlen, w = K.wert, cfg = S.config;
  if (id === 'op') {
    // Mockup Z. 345–350. Werte aus rechnung.kennzahlen(); ueberfaellig ist ein
    // Teil von offen (R16), das Band zeigt ihn rot vor dem uebrigen Offenen.
    const B = S.belege_kennzahlen;
    if (!B) return leer('beleg', 'Nicht geladen');
    const ges = B.offen_eur + B.bezahlt_eur;
    const breite = (v) => (ges > 0 ? v / ges * 100 : 0).toFixed(1);
    return '<span class="instr-wert">' + nf2.format(B.offen_eur) + '<span>EUR</span></span>' +
      '<div class="op-band" aria-hidden="true"><span style="width:' + breite(B.ueberfaellig_eur) + '%;background:var(--bad)"></span>' +
        '<span style="width:' + breite(B.offen_eur - B.ueberfaellig_eur) + '%;background:var(--warn)"></span><span style="width:' + breite(B.bezahlt_eur) + '%;background:var(--ok)"></span></div>' +
      '<div class="legenden">' + legende('var(--warn)', 'offen', eur(B.offen_eur)) +
        legende('var(--bad)', 'überfällig', eur(B.ueberfaellig_eur), B.ueberfaellig_eur > 0 ? 'var(--bad)' : null) +
        legende('var(--ok)', 'bezahlt im Zeitraum', eur(B.bezahlt_eur)) + '</div>' +
      '<a class="textknopf akzent op-link" href="#/rechnungen">' + esc(uebersetze('Zu den Rechnungen')) + ' →</a>';
  }
  if (id === 'marge') {
    const p = w.marge_prozent, ziel = w.zielmarge_prozent;
    if (p == null) {
      return leer('liste', w.erloes > 0 ? 'Selbstkostensatz fehlt' : 'Noch kein Erlös im Zeitraum',
        w.erloes > 0 ? 'Ohne ihn bliebe die eigene Arbeitszeit unberechnet.' : '',
        w.erloes > 0 ? '<a class="knopf klein" href="#/einstellungen">' + esc(uebersetze('Einstellungen')) + '</a>' : '');
    }
    const diff = ziel != null ? p - ziel : null;
    return '<div class="gauge-huelle">' + gaugeSvg(p / 60, margeFarbe(p, ziel), { ziel: ziel != null ? ziel / 60 : null }) +
        '<div class="gauge-wert"><span class="mono">' + nf1.format(p) + '</span><span>' + esc(uebersetze('% vom Erlös')) + '</span></div></div>' +
      '<div class="instr-fuss"><span>' + (ziel != null ? esc(uebersetze('Ziel')) + ' <b class="mono">' + nf1.format(ziel) + ' %</b>' : esc(uebersetze('kein Ziel gesetzt'))) + '</span>' +
        (diff != null ? '<span class="mono" style="color:' + (diff >= 0 ? 'var(--ok)' : 'var(--bad)') + '">' + (diff >= 0 ? '+' : '') + nf1.format(diff) + ' Pp</span>' : '') + '</div>';
  }
  if (id === 'abo') {
    const aboEur = String(cfg.aboWaehrung || 'USD').toUpperCase() === 'EUR' ? S.abo_kosten : S.abo_kosten * cfg.usdToEur;
    const apiEur = S.summary.cost_usd * cfg.usdToEur;
    const faktor = aboEur > 0 ? apiEur / aboEur : null;
    const r = ring([{ v: aboEur, c: 'var(--eur)' }, { v: Math.max(apiEur - aboEur, 0), c: 'var(--accent)' }], 40);
    return '<div class="instr-ring">' + ringSvg(r, 96, 11) +
        '<div><span class="instr-wert">' + (faktor != null ? nf1.format(faktor) + '<span>×</span>' : '–') + '</span>' +
        '<span class="hinweis">' + esc(uebersetze(faktor != null ? 'so viel Listenpreis deckt das Abo' : 'kein Abo-Preis hinterlegt')) + '</span></div></div>' +
      '<div class="legenden">' + legende('var(--eur)', 'Abo-Kosten', faktor != null ? eur(aboEur) : '–') + legende('var(--accent)', 'API-Gegenwert', usd(S.summary.cost_usd)) + '</div>';
  }
  if (id === 'modelle') {
    const r = modellRing(S.models);
    if (!r.length) return leer('liste', 'Keine Modelle im Zeitraum');
    return '<div class="instr-ring">' + ringSvg(r, 96, 11) + '<div class="legenden eng">' +
      r.map((m) => legende(m.c, m.n, nf1.format(m.anteil * 100) + ' %')).join('') + '</div></div>';
  }
  if (id === 'stunden') {
    const jeTag = stundenJeTag();
    const jetzt = new Date();
    const heuteIso = isoTag(jetzt);
    const montag = plusTage(jetzt, -((jetzt.getDay() + 6) % 7));
    const woche = Array.from({ length: 7 }, (_, i) => { const d = isoTag(plusTage(montag, i)); return { d, h: jeTag[d] || 0, zukunft: d > heuteIso }; });
    const hWoche = woche.reduce((a, x) => a + x.h, 0);
    const max = Math.max(...woche.map((x) => x.h), 0.01);
    const wt = istDE() ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const man = K.manuell_stunden || 0;
    const basis = K.agent_stunden + man;
    return '<div class="stunden-oben"><div>' + zahlEinheit(nf1.format(jeTag[heuteIso] || 0), 'h') + '<span class="hinweis">' + esc(uebersetze('heute')) + '</span></div>' +
        '<div>' + zahlEinheit(nf1.format(hWoche), 'h') + '<span class="hinweis">' + esc(uebersetze('diese Woche')) + '</span></div></div>' +
      '<div class="wochen-balken">' + woche.map((x, i) =>
        '<div title="' + esc(datum(x.d) + ' · ' + nf1.format(x.h) + ' h') + '"><span class="s" style="height:' + Math.max(x.h ? 6 : 0, x.h / max * 100).toFixed(0) + '%;background:' +
          (x.d === heuteIso ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 45%, transparent)') + '"></span><span class="t">' + wt[i] + '</span></div>').join('') + '</div>' +
      // Mockup Z. 327–330: Claude und manuell als Anteil an Agentenzeit + manueller Zeit.
      '<div class="balken-duenn zwei"><span style="width:' + (basis > 0 ? K.aktive_stunden / basis * 100 : 0).toFixed(1) + '%;background:var(--accent)"></span>' +
        '<span style="width:' + (basis > 0 ? man / basis * 100 : 0).toFixed(1) + '%;background:var(--zeit-manuell)"></span></div>' +
      '<span class="hinweis stunden-leg"><span><b class="mono" style="color:var(--text)">' + nf1.format(K.aktive_stunden + man) + ' h</b> ' + esc(uebersetze('abrechenbar')) + '</span>' +
        '<span><span class="leg-p" style="background:var(--accent)"></span>Claude ' + nf1.format(K.aktive_stunden) + '</span>' +
        '<span><span class="leg-p" style="background:var(--zeit-manuell)"></span>' + esc(uebersetze('manuell')) + ' ' + nf1.format(man) + '</span>' +
        '<span><span class="leg-p" style="background:var(--line-hover)"></span>' + esc(uebersetze('von')) + ' ' + nf1.format(K.agent_stunden) + ' h ' + esc(uebersetze('Agentenzeit')) + '</span></span>' +
      // Offen = Claude-Zeit nicht abgerechneter Vorgaenge + offene manuelle Zeit (kennzahlen.offen_stunden zu offen_eur).
      '<a class="instr-link" href="#/vorgaenge">' + esc(uebersetze('Noch nicht abgerechnet')) + ' <b class="mono">' + nf1.format(K.offen_stunden || 0) + ' h · ' + eur(K.offen_eur) + '</b><span>→</span></a>';
  }
  if (id === 'burn') {
    const b = state.live ? state.live.burn_usd_per_hour : 0;
    return '<div class="gauge-huelle">' + gaugeSvg(b / 30, 'var(--accent)', { nadel: true, rund: true, breite: 12 }) + '</div>' +
      '<div class="instr-fuss mitte"><span class="instr-wert akzent">' + nf2.format(b) + '</span><span class="hinweis">' + esc(uebersetze('USD/h · Skala 0–30')) + '</span></div>';
  }
  if (id === 'quote') {
    const q = w.arbeitswert > 0 ? K.abgerechnet_eur / w.arbeitswert : 0;
    const r = ring([{ v: K.abgerechnet_eur, c: 'var(--ok)' }, { v: K.offen_eur, c: OFFEN_FARBE }], 40);
    return '<div class="instr-ring">' + ringSvg(r, 96, 11) + '<div>' + zahlEinheit(nf1.format(q * 100), '%') +
        '<span class="hinweis">' + esc(uebersetze('abgerechnet')) + '</span></div></div>' +
      '<div class="legenden">' + legende('var(--ok)', 'abgerechnet', eur(K.abgerechnet_eur)) + legende('var(--accent)', 'noch nicht abgerechnet', eur(K.offen_eur), 'var(--accent-text)') + '</div>';
  }
  if (id === 'agent') {
    const a = K.agent_stunden > 0 ? K.aktive_stunden / K.agent_stunden : 0;
    return '<div class="instr-ring">' + anteilRing(a, 'var(--text)') + '<div>' + zahlEinheit(nf1.format(a * 100), '%') +
        '<span class="hinweis">' + esc(uebersetze('der Agentenzeit ist aktive Zeit')) + '</span></div></div>' +
      '<div class="legenden">' + legende('var(--text)', 'aktive Zeit', nf1.format(K.aktive_stunden) + ' h') +
        legende('var(--line-hover)', 'Agentenzeit gesamt', nf1.format(K.agent_stunden) + ' h') + '</div>';
  }
  if (id === 'ziel') {
    const ziel = Number(lies('hub.monatsziel', '0')) || 0;
    const monat = hubDaten.monat ? hubDaten.monat.wert.erloes : null;
    const feld = D.zielBearbeiten || !ziel
      ? '<div class="ziel-feld"><input type="text" inputmode="numeric" id="ziel-eingabe" value="' + (ziel || '') + '" placeholder="' + esc(uebersetze('z. B. 5000')) + '" aria-label="' + esc(uebersetze('Monatsziel in EUR')) + '"><span>EUR</span>' +
        '<button type="button" class="knopf klein" data-aktion="ziel-speichern">OK</button></div>'
      : '';
    if (!ziel) return feld + '<span class="hinweis">' + esc(uebersetze('Ein Ziel setzen, um den Fortschritt im Monat zu sehen.')) + '</span>';
    if (monat == null) return feld + '<div class="leer">…</div>';
    const f = monat / ziel;
    const farbe = f >= 1 ? 'var(--marge-top)' : f >= 0.75 ? 'var(--ok)' : f >= 0.5 ? 'var(--warn)' : 'var(--marge-schwach)';
    const rest = ziel - monat;
    return feld + '<div class="gauge-huelle">' + gaugeSvg(f, farbe, { rund: true, breite: 14 }) +
        '<div class="gauge-wert"><span class="mono">' + nf0.format(f * 100) + '<small>%</small></span></div></div>' +
      '<div class="instr-fuss"><span><b class="mono">' + nf0.format(monat) + '</b> / ' + nf0.format(ziel) + ' EUR</span>' +
        '<span style="color:var(--ok)">' + esc(rest > 0 ? uebersetze('noch') + ' ' + nf0.format(rest) + ' EUR · ' + restArbeitstage(new Date()) + ' ' + uebersetze('Arbeitstage') : uebersetze('Ziel erreicht ✓')) + '</span></div>';
  }
  if (id === 'cache') {
    const s = S.summary;
    const eingang = s.input_tokens + s.cache_read_tokens + s.cache_write_tokens;
    const q = eingang > 0 ? s.cache_read_tokens / eingang : 0;
    return '<div class="instr-ring">' + anteilRing(q, 'var(--accent)') + '<div>' + zahlEinheit(nf1.format(q * 100), '%') +
        '<span class="hinweis">' + esc(uebersetze('aus dem Cache gelesen')) + '</span></div></div>' +
      '<div class="legenden">' + legende('var(--accent)', 'Ersparnis ggü. ohne Cache', '≈ ' + usd(S.cache_ersparnis_usd || 0)) +
        '<span class="hinweis">' + esc(uebersetze('Listenpreis: Cache-Lesen kostet je Token einen Bruchteil eines Input-Tokens.')) + '</span></div>';
  }
  if (id === 'sitz') {
    const H = hubDaten.heute;
    const ids = H ? [...new Set(H.sessions.map((x) => x.session_id))] : [];
    const live = liveSitzungen();
    const zeilen = H ? ids.slice(0, 5).map((sid) => H.sessions.find((x) => x.session_id === sid)) : [];
    return '<div class="sitz-oben"><span class="instr-wert">' + ids.length + '</span><span class="hinweis"><span class="puls"' + (live ? '' : ' style="animation:none;background:var(--text-gruppe)"') + '></span> ' + live + ' live</span></div>' +
      '<div class="sitz-liste">' + zeilen.map((x) => '<span><span class="punkt" style="background:' + (istAktiv(x.last_ts) ? 'var(--ok)' : 'var(--text-gruppe)') + '"></span>' +
        '<span class="ell">' + esc(x.project || '–') + (x.ticket ? ' · ' + esc(x.ticket) : '') + '</span><span class="faint">' + esc(vor(x.last_ts)) + '</span></span>').join('') + '</div>';
  }
  return '';
}

/* ---------- Meine Metriken ---------- */
// [id, Titel, Kurzbeschreibung, Standardbreite, Quelle, Zeichen, Wozu]
const WIDGETS = [
  ['kpi-tokens', 'Tokens gesamt', 'Kennzahl', 1, 'analyse', '#', 'Volumen im Blick, z. B. für Limits.'],
  ['kpi-api', 'API-Gegenwert', 'Kennzahl', 1, 'analyse', '$', 'Was deine Nutzung zum Listenpreis wert ist.'],
  ['kpi-abo', 'Abo-Kosten', 'Kennzahl', 1, 'analyse', '€', 'Fixkosten im Zeitraum.'],
  ['kpi-req', 'Requests', 'Kennzahl', 1, 'analyse', '↯', 'Wie aktiv du mit Claude arbeitest.'],
  ['verlauf', 'API-Gegenwert je Woche', 'Balken mit Werten', 2, 'analyse', '▮', 'Wochenvergleich auf einen Blick.'],
  ['modelle', 'Modelle im Zeitraum', 'Ring + Anteile', 2, 'analyse', '◔', 'Welche Modelle du nutzt.'],
  ['werk', 'Werkzeugbetrieb-Anteil', 'nur Werkzeugdaten', 2, 'analyse', '⚙', 'Wie viel Verbrauch auf eigene Werkzeuge entfällt.'],
  ['tree', 'MCP-Server', 'nur Werkzeugdaten', 2, 'analyse', '▥', 'Welche MCP-Server Tokens erzeugen.'],
  ['marge', 'Marge je Woche', 'gegen Ziel', 2, 'analyse', '±', 'Marge Woche für Woche gegen dein Ziel.'],
  ['kosten', 'Kosten je Stunde', 'USD je aktive h', 2, 'analyse', '⌁', 'Ob die Stunde teurer wird.'],
  ['status', 'Vorgänge nach Status', 'noch nicht abgerechnet · abgerechnet', 2, 'vorgaenge', '◧', 'Was offen oder abgerechnet ist.'],
  ['heat', 'Aktivität', 'Heatmap + Serie', 2, 'analyse', '▦', 'Deine aktiven Tage und Serien.'],
  ['top', 'Top-Vorgänge', 'nach Gegenwert', 2, 'vorgaenge', '▲', 'Vorgänge mit dem meisten Gegenwert.'],
  ['projekte', 'Nach Projekt', 'Anteil API-Gegenwert', 2, 'analyse', '≡', 'Verbrauch je Projekt.'],
  ['rechnungen', 'Letzte Rechnungen', 'Status & Betrag', 3, 'rechnungen', '▤', 'Letzte Rechnungen mit Status.'],
  ['angebote', 'Angebote', 'offen / angenommen', 2, 'angebote', '▢', 'Offene und angenommene Angebote.'],
];
const WIDGETS_STANDARD = ['kpi-api', 'kpi-tokens', 'kpi-req', 'top', 'modelle', 'rechnungen'];
const WIDGET_BREITE_STANDARD = { modelle: 1 };

function kpiInhalt(id, D) {
  const s = D.S.summary, v = D.V && D.V.summary;
  const feld = id === 'kpi-tokens' ? 'total_tokens' : id === 'kpi-req' ? 'requests' : 'cost_usd';
  const reihe = (D.S.days || []).map((d) => d[feld]);
  let wert, einheit = '', hinweis, jetzt, vorher, farbe = 'var(--text-dim)', klasse = '';
  if (id === 'kpi-api') { wert = nf2.format(s.cost_usd); einheit = 'USD'; hinweis = uebersetze('Listenpreis, nicht gezahlt'); jetzt = s.cost_usd; vorher = v && v.cost_usd; farbe = 'var(--accent)'; klasse = ' akzent'; }
  else if (id === 'kpi-tokens') { const k = kurz(s.total_tokens).split(' '); wert = k[0]; einheit = k[1] || ''; hinweis = num(s.total_tokens) + ' Tokens'; jetzt = s.total_tokens; vorher = v && v.total_tokens; }
  else if (id === 'kpi-req') { wert = num(s.requests); hinweis = zeitraumText(aktuellerZeitraum()); jetzt = s.requests; vorher = v && v.requests; }
  // Ohne Abo-Preis ein Strich statt 0,00 — eine Null saehe aus wie "kostet nichts".
  else if (!(Number(D.S.config.aboPreisMonat) > 0)) { wert = '–'; hinweis = uebersetze('Abo-Preis unter Einstellungen eintragen'); }
  else { wert = nf2.format(D.S.abo_kosten); einheit = String(D.S.config.aboWaehrung || 'USD').toUpperCase(); hinweis = uebersetze('anteilig im Zeitraum'); jetzt = D.S.abo_kosten; vorher = D.V && D.V.abo_kosten; }
  return '<span class="kpi-wert' + klasse + '">' + wert + '<span>' + esc(einheit) + '</span></span>' +
    '<span class="hinweis">' + esc(hinweis) + '</span>' +
    // Abo: feste Kosten, im Entwurf eine flache Linie.
    '<div class="kpi-fuss">' + sparkFlaeche(id === 'kpi-abo' ? reihe.map(() => (D.S.abo_kosten > 0 ? 1 : 0)) : reihe, farbe, 'sp-' + id) +
      (state.vergleich ? delta(jetzt, vorher, id !== 'kpi-abo') : '') + '</div>';
}

// Vorgaenge nach Status: Summen und Anzahlen aus kennzahlen() (Server).
function statusInhalt(K) {
  const zeilen = [
    ['noch nicht abgerechnet', K.offen_vorgaenge, K.offen_vorgang_eur, 'var(--text-faint)'],
    ['abgerechnet', K.abgerechnet_vorgaenge, K.abgerechnet_eur, 'var(--ok)'],
    ['ohne Vorgang', null, K.ohne_vorgang_eur, 'var(--line-hover)'],
  ];
  for (const z of zeilen) z[2] = Number(z[2]) || 0;
  const ges = zeilen.reduce((a, z) => a + z[2], 0) || 1;
  return '<div class="status-band">' + zeilen.map((z) => '<span style="flex:' + (z[2] / ges).toFixed(4) + ';background:' + z[3] + '"></span>').join('') + '</div>' +
    '<div class="legenden">' + zeilen.map(([l, n, e, c]) => legende(c, uebersetze(l) + (n == null ? '' : ' · ' + n), eur(e))).join('') + '</div>';
}

// Aktivitaet der letzten zwoelf Wochen (aktive Stunden je Tag) mit Serie.
const HEAT_FARBE = ['var(--panel-2)', 'color-mix(in srgb, var(--accent) 30%, transparent)', 'color-mix(in srgb, var(--accent) 55%, transparent)', 'color-mix(in srgb, var(--accent) 80%, transparent)', 'var(--accent)'];
function heatDaten() {
  const heute = isoTag(new Date());
  const H = heatmap(Object.entries(stundenJeTag()).map(([day, v]) => ({ day, v })), { wochen: 12, bis: heute });
  const z = H.zellen.filter((x) => x.stufe != null);
  let serie = 0;
  for (let i = z.length - 1; i >= 0; i--) {
    if (z[i].v > 0) serie++;
    else if (i < z.length - 1) break;      // heute noch ohne Arbeit unterbricht nicht
  }
  return { H, serie, heute };
}
// Gitter wie im Entwurf: Wochentage links, Monate oben, heute umrandet, Legende rechts.
function heatGitter({ H, heute }) {
  const monat = (m) => (m == null ? '' : new Date(2026, m, 1).toLocaleDateString(istDE() ? 'de-DE' : 'en-US', { month: 'short' }).replace('.', ''));
  return '<div class="heat-huelle"><div class="heat-tage">' + (istDE() ? ['Mo', '', 'Mi', '', 'Fr', '', 'So'] : ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']).map((t) => '<span>' + t + '</span>').join('') + '</div>' +
    '<div class="heat-mitte"><div class="heat-monate">' + H.monate.map((m) => '<span>' + esc(monat(m)) + '</span>').join('') + '</div>' +
    '<div class="heat">' + H.zellen.map((x) => x.stufe == null ? '<span class="leer"></span>'
      : '<span' + (x.day === heute ? ' class="heute"' : '') + ' title="' + esc(datum(x.day) + ' · ' + nf1.format(x.v) + ' h') + '" style="background:' + HEAT_FARBE[x.stufe] + '"></span>').join('') + '</div></div>' +
    '<div class="heat-legende">' + esc(uebersetze('weniger')) + HEAT_FARBE.map((f) => '<span style="background:' + f + '"></span>').join('') + esc(uebersetze('mehr')) + '</div></div>';
}
const serieText = (n) => esc(uebersetze('Serie')) + ' <b class="mono akzent">' + n + '</b> ' + esc(uebersetze('Tage in Folge'));
function heatInhalt() {
  // Ohne geladene Tage keine Heatmap aus Nullen — das saehe aus wie zwoelf Wochen ohne Arbeit.
  if (!hubDaten.tage) return hubDaten.fehler ? leer('liste', 'Nicht geladen') : '<div class="leer">…</div>';
  const d = heatDaten();
  return '<span class="heat-serie">' + serieText(d.serie) + '</span>' + heatGitter(d);
}

function widgetInhalt(id, D) {
  const S = D.S;
  if (id.startsWith('kpi-')) return kpiInhalt(id, D);
  if (id === 'marge') return margeWochenHtml(ladeMargeWochen(), 120);
  if (id === 'top') {
    const t = (S.tickets || []).slice().sort((a, b) => b.gegenwert_eur - a.gegenwert_eur).slice(0, 5);
    if (!t.length) return leer('liste', 'Keine Vorgänge im Zeitraum');
    const max = t[0].gegenwert_eur || 1;
    return '<div class="top-liste">' + t.map((x, i) => '<a href="#/vorgaenge/' + encodeURIComponent(x.ticket) + '">' +
      '<span class="rang mono">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="mitte"><span><b class="mono">' + esc(x.ticket) + '</b> <span class="faint">' + esc(x.project || '') + '</span></span>' +
        '<span class="balken-duenn"><span style="width:' + (x.gegenwert_eur / max * 100).toFixed(1) + '%;background:var(--ok)"></span></span></span>' +
      '<span class="mono" style="color:var(--ok)">' + nf2.format(x.gegenwert_eur) + '</span></a>').join('') + '</div>';
  }
  if (id === 'modelle') {
    const r = modellRing(S.models);
    if (!r.length) return leer('liste', 'Keine Modelle im Zeitraum');
    return '<div class="instr-ring">' + ringSvg(r, 104, 12) + '<div class="legenden eng">' +
      r.map((m) => legende(m.c, m.n, nf1.format(m.anteil * 100) + ' %')).join('') + '</div></div>';
  }
  if (id === 'verlauf' || id === 'kosten') {
    const W = (S.weeks || []).slice(-12);
    if (!W.length) return leer('liste', 'Keine Daten im Zeitraum');
    // Kosten je Stunde: ohne aktive Zeit gibt es keinen Wert (null), keine 0.
    const werte = W.map((w) => (id === 'verlauf' ? w.cost_usd : w.usd_je_stunde));
    const max = Math.max(...werte.filter((v) => v != null), 0.01) * 1.08;
    // Durchschnitt aus dem Server (metrics.usdJeStunde), nicht im Browser gerechnet.
    const schnitt = id === 'kosten' ? S.kosten_je_stunde_12w : null;
    return '<div class="saeulen">' + W.map((w, i) => '<div title="' + esc(uebersetze('Woche ab') + ' ' + datum(w.day) + ' · ' + (werte[i] == null ? '–' : nf2.format(werte[i]) + (id === 'verlauf' ? ' USD' : ' USD/h'))) + '">' +
        '<span class="mono">' + (werte[i] == null ? '–' : id === 'verlauf' ? nf0.format(werte[i]) : nf1.format(werte[i])) + '</span>' +
        '<span class="s" style="height:' + ((werte[i] || 0) / max * 100).toFixed(1) + '%;background:' + (schnitt != null && werte[i] != null && werte[i] <= schnitt ? OFFEN_FARBE : 'var(--accent)') + '"></span></div>').join('') + '</div>' +
      '<div class="saeulen-achse">' + W.map((w) => '<span>' + esc(datumKurz(w.day)) + '</span>').join('') + '</div>';
  }
  if (id === 'werk') {
    const a = S.split.overhead_anteil_kosten || 0;
    const nach = (S.werkzeuge && S.werkzeuge.nach_werkzeug) || [];
    return '<div class="instr-ring">' + anteilRing(a, 'var(--accent)', 96) + '<div>' + zahlEinheit(nf1.format(a * 100), '%') +
      '<span class="hinweis">' + esc(uebersetze('des API-Gegenwerts')) + '</span></div></div>' +
      '<div class="legenden eng">' + nach.slice(0, 4).map((x, i) => legende(modellFarbe(i), x.werkzeug || '–', usd(x.cost_usd))).join('') + '</div>';
  }
  if (id === 'tree') {
    const n = (S.herkunft && S.herkunft.nach_mcp) || [];
    if (!n.length) return leer('liste', 'Keine MCP-Aufrufe im Zeitraum');
    const max = n[0].total_tokens || 1;
    return '<div class="balken-liste">' + n.slice(0, 6).map((x) => '<div><span class="ell">' + esc(x.server) + '</span><span class="balken-duenn"><span style="width:' + (x.total_tokens / max * 100).toFixed(1) + '%;background:var(--accent)"></span></span><span class="mono">' + kurz(x.total_tokens) + '</span></div>').join('') + '</div>';
  }
  if (id === 'status') {
    return statusInhalt(S.kennzahlen);
  }
  if (id === 'heat') {
    return heatInhalt();
  }
  if (id === 'projekte') {
    const p = (S.projects || []).filter((x) => !x.overhead && x.cost_usd > 0).sort((a, b) => b.cost_usd - a.cost_usd).slice(0, 6);
    const ges = p.reduce((a, x) => a + x.cost_usd, 0) || 1;
    return '<div class="balken-liste">' + p.map((x) => '<div><span class="ell">' + esc(x.project) + '</span><span class="balken-duenn"><span style="width:' + (x.cost_usd / ges * 100).toFixed(1) + '%;background:var(--accent)"></span></span>' +
      '<span class="mono">' + nf1.format(x.cost_usd / ges * 100) + ' %</span></div>').join('') + '</div>';
  }
  if (id === 'rechnungen' || id === 'angebote') {
    const liste = id === 'rechnungen' ? (state.rechnungen || []) : (state.angebote || []);
    if (!liste.length) return leer('beleg', id === 'rechnungen' ? 'Noch keine Rechnungen' : 'Noch keine Angebote');
    // Status vom Server (status_abgeleitet), dieselbe Pille wie auf der Seite.
    return '<div class="beleg-liste">' + liste.slice(0, 4).map((r) => {
      const st = r.status_abgeleitet || r.status;
      return '<a href="#/' + id + '"' + (st === 'storniert' || st === 'storno' ? ' class="storno"' : '') + '><span class="mono nr">' + esc(r.nr) + '</span>' +
        '<span class="wer ell">' + esc(r.empfaenger || '') + ' · ' + esc(datum(isoTag(new Date(r.erstellt_am)))) + '</span>' +
        '<span class="mono betrag">' + eur(r.brutto_eur) + '</span>' + pille(st) + '</a>';
    }).join('') + '</div>';
  }
  return '';
}

/* ---------- Raster: Auswahl, Reihenfolge, Groesse ----------
   Je Browser gespeichert: { sicht: [ids in Reihenfolge], groesse: {id: {w, h}} }.
   Ohne Groesse gilt Auto (Standardbreite der Kachel, Hoehe nach Inhalt).
   breite: {id: 1..4} stammt aus Block 1 und bleibt als Auto-Breite lesbar. */
// Weitere Seiten (Analyse) haengen ihr Raster hier an. meta = Katalog,
// felder = Index von Zeichen und Wozu-Text in einem Katalog-Eintrag,
// min(id) = Mindestgroesse [Breite, Hoehe] in px, darunter "Zu klein".
const RASTER = {
  inst: { standard: INSTRUMENTE_STANDARD, reihe: INSTRUMENTE_REIHE, meta: INSTRUMENTE, speicher: 'hub.inst', felder: [3, 4], an: 'sichtbar ✓', plus: '+ Instrument hinzufügen',
    min: () => [200, 200] },
  meine: { standard: WIDGETS_STANDARD, reihe: null, meta: WIDGETS, speicher: 'hub.meine', felder: [5, 6], an: 'im Hub ✓', plus: '+ Metrik hinzufügen',
    min: (id) => id.startsWith('kpi-') ? [200, 130] : ['rechnungen', 'angebote', 'top', 'status', 'projekte'].includes(id) ? [320, 180] : id === 'heat' ? [300, 170] : [300, 200] },
};
function rasterStand(sek) {
  const R = RASTER[sek];
  const s = liesJson(R.speicher, null);
  const std = R.reihe ? R.reihe.filter((id) => R.standard.includes(id)) : R.standard.slice();
  // Aus dem Browser-Speicher: nur bekannte Ids, Breiten 1–4 (class-Attribut) und
  // Groessen aus kachelGroesse() (style-Attribut).
  const bekannt = new Set(R.meta.map((m) => m[0]));
  const breite = {}, groesse = {};
  if (s && s.breite && typeof s.breite === 'object') for (const [id, b] of Object.entries(s.breite)) if (bekannt.has(id) && [1, 2, 3, 4].includes(b)) breite[id] = b;
  if (s && s.groesse && typeof s.groesse === 'object') for (const [id, g] of Object.entries(s.groesse)) { const v = bekannt.has(id) && kachelGroesse(g); if (v) groesse[id] = v; }
  const sicht = s && Array.isArray(s.sicht) ? [...new Set(s.sicht.filter((id) => bekannt.has(id)))] : std;
  // zusatz: weitere Ansichts-Vorlieben des Abschnitts (z. B. Kennzahlen-Reihenfolge der Analyse).
  return { sicht, breite, groesse, angepasst: !!s || (R.zusatz || []).some((z) => lies(z, null) !== null) };
}
function rasterMerke(sek, st) { merke(RASTER[sek].speicher, { sicht: st.sicht, breite: st.breite, groesse: st.groesse }); }
function rasterStandard(sek) {
  try { for (const k of [RASTER[sek].speicher, ...(RASTER[sek].zusatz || [])]) localStorage.removeItem(SPEICHER + k); } catch { /* egal */ }
}

const hubZustand = { bearbeiten: {}, katalog: {}, hilfe: false, zielBearbeiten: false, verbindungen: false, gezaehlt: false };

// Inline-Groesse einer Kachel; Werte kommen geprueft aus kachelGroesse().
function groesseStil(g) {
  return (g.w ? 'flex:0 0 ' + g.w + 'px;width:' + g.w + 'px;' : '') + (g.h ? 'height:' + g.h + 'px;' : '');
}

function kachel(sek, id, titel, unter, inhalt, breite, opt = {}) {
  const ed = hubZustand.bearbeiten[sek];
  const g = rasterStand(sek).groesse[id];
  const min = RASTER[sek].min(id);
  const klein = g && ((g.w && g.w < min[0]) || (g.h && g.h < min[1]));
  const wert = sek + ':' + esc(id);
  // Meine Metriken wie im Entwurf: Griff, Untertitel und Knoepfe in der Kopfzeile;
  // Instrumente und Analyse tragen die Bedien-Chips ueber dem Rahmen.
  const imKopf = sek === 'meine';
  const autoKnopf = (klasse) => (g ? '<button type="button" class="' + klasse + '" data-aktion="raster-auto" data-wert="' + wert + '" title="' + esc(uebersetze('Größe zurücksetzen')) + '">⤢ Auto</button>' : '');
  const wegKnopf = (klasse, text) => '<button type="button" class="' + klasse + '" data-aktion="raster-weg" data-wert="' + wert + '" aria-label="' + esc(uebersetze('Entfernen')) + '">' + text + '</button>';
  const greif = (klasse, text) => '<span class="' + klasse + '" draggable="true" title="' + esc(uebersetze('Ziehen zum Verschieben')) + '">' + text + '</span>';
  // opt.ziel: Klick auf die Flaeche springt dorthin (Maus-Abkuerzung). Tastatur und
  // Screenreader nehmen den ↗-Link in der Kachel, darum kein role="link" um innere Links.
  return '<div class="kachel b' + breite + (ed ? ' bearbeiten' : '') + (g ? ' fest' : '') + (opt.ziel && !ed ? ' mit-ziel' : '') + (opt.klasse ? ' ' + opt.klasse : '') + '" data-sek="' + sek + '" data-id="' + esc(id) + '"' +
      (opt.ziel && !ed ? ' data-aktion="kachel-ziel" data-wert="' + esc(opt.ziel) + '"' : '') +
      (g ? ' style="' + groesseStil(g) + '"' : '') + '>' +
    (klein ? '<div class="zu-klein"><span class="zeichen">⤢</span><b>' + esc(uebersetze('Zu klein für diese Ansicht')) + '</b>' +
      '<span>' + esc(uebersetze('mindestens')) + ' ' + min[0] + ' × ' + min[1] + ' px — ' + esc(uebersetze('größer ziehen oder Auto-Größe')) + '</span>' +
      '<button type="button" class="knopf klein" data-aktion="raster-auto" data-wert="' + wert + '">' + esc(uebersetze('Auto-Größe')) + '</button></div>' : '') +
    (ed && !imKopf ? greif('greif', '⋮⋮ ' + esc(uebersetze(opt.greif || 'ziehen'))) + autoKnopf('groesse-auto') + wegKnopf('entfernen', '×') : '') +
    (ed ? 
      '<span class="rz rz-r" data-rz="r" title="' + esc(uebersetze('Breite ziehen · Doppelklick = Auto')) + '"></span>' +
      '<span class="rz rz-b" data-rz="b" title="' + esc(uebersetze('Höhe ziehen · Doppelklick = Auto')) + '"></span>' +
      '<button type="button" class="rz rz-c" data-rz="c" title="' + esc(uebersetze('Größe frei ziehen · Pfeiltasten ±10 px · Doppelklick = Auto')) + '" aria-label="' + esc(uebersetze('Größe ändern')) + '">◢</button>' : '') +
    (opt.kopf != null ? opt.kopf
      : imKopf ? '<div class="kachel-kopf">' + (ed ? greif('greif im-kopf', '⋮⋮') : '') + '<span class="label">' + esc(uebersetze(titel)) + '</span>' +
          (unter ? '<span class="kachel-unter im-kopf ell">' + esc(uebersetze(unter)) + '</span>' : '') +
          '<span class="kachel-knoepfe">' + (ed ? autoKnopf('mini-auto') : '') + (opt.rechts || '') + (ed ? wegKnopf('mini-weg', '×') : '') + '</span></div>'
      : '<div class="kachel-kopf"><span class="label">' + esc(uebersetze(titel)) + '</span>' + (opt.rechts || '') + '</div>' +
        (unter ? '<span class="kachel-unter">' + esc(uebersetze(unter)) + '</span>' : '')) +
    '<div class="kachel-inhalt">' + inhalt + '</div>' +
    (opt.pro ? sperre(titel, opt.proText || 'Gehört zur Pro-Version.') : '') +
  '</div>';
}

function rasterKopf(sek, titel, satz, angepasst) {
  const ed = hubZustand.bearbeiten[sek];
  return '<div class="abschnitt-kopf"><div class="links"><h2>' + esc(uebersetze(titel)) + '</h2><span class="hinweis">' + esc(uebersetze(satz)) + '</span>' +
      '<button type="button" class="pille" data-aktion="hub-hilfe" aria-expanded="' + hubZustand.hilfe + '"><b>?</b> ' + esc(uebersetze('Instrumente vs. Meine Metriken')) + '</button></div>' +
    '<div class="rechts">' +
      (angepasst ? '<button type="button" class="pille warn" data-aktion="raster-standard" data-wert="' + sek + '" title="' + esc(uebersetze('Auswahl, Reihenfolge und Größen auf Standard zurücksetzen')) + '">' + esc(uebersetze('Angepasst · ↺ Standard')) + '</button>'
        : '<span class="pille" title="' + esc(uebersetze('Empfohlene Auswahl, Reihenfolge und Größen')) + '">' + esc(uebersetze('Standard')) + '</span>') +
      (ed ? '<button type="button" class="knopf klein' + (hubZustand.katalog[sek] ? ' an' : '') + '" data-aktion="raster-katalog" data-wert="' + sek + '">' +
        esc(uebersetze(hubZustand.katalog[sek] ? '× Auswahl schließen' : RASTER[sek].plus)) + '</button>' +
        '<span class="hinweis akzent">' + esc(uebersetze('an ⋮⋮ ziehen zum Verschieben')) + '</span>' +
        '<button type="button" class="knopf klein" data-aktion="raster-standard" data-wert="' + sek + '">↺ ' + esc(uebersetze('Auf Standard')) + '</button>' : '') +
      '<button type="button" class="knopf' + (ed ? ' primaer' : '') + '" data-aktion="raster-bearbeiten" data-wert="' + sek + '">' + (ed ? '✓ ' + esc(uebersetze('Fertig')) : '✎ ' + esc(uebersetze('Bearbeiten'))) + '</button>' +
    '</div></div>';
}

function katalogHtml(sek, meta, sicht) {
  if (!hubZustand.bearbeiten[sek] || !hubZustand.katalog[sek]) return '';
  return '<div class="katalog"><span class="hinweis">' + esc(uebersetze('Anklicken fügt hinten an oder blendet aus · in die Reihe ziehen setzt an die Stelle')) + '</span><div class="katalog-raster">' +
    meta.map((m) => {
      const an = sicht.includes(m[0]);
      const [fi, fw] = RASTER[sek].felder, icon = m[fi], wozu = m[fw];
      return '<button type="button" class="katalog-eintrag' + (an ? ' an' : '') + '" draggable="true" data-katalog="' + sek + ':' + m[0] + '" data-aktion="raster-umschalten" data-wert="' + sek + ':' + m[0] + '">' +
        '<span class="ic">' + esc(icon) + '</span><span class="tx"><b>' + esc(uebersetze(m[1])) + '</b>' +
        '<span>' + esc(an ? uebersetze(RASTER[sek].an) : uebersetze(m[2])) + ' · ' + esc(uebersetze(an ? 'Klick blendet aus' : 'Klick fügt hinzu')) + '</span>' +
        '<span class="wozu">' + esc(uebersetze(wozu)) + '</span></span></button>';
    }).join('') + '</div></div>';
}

/* ---------- Seite ---------- */
function hubHero(D) {
  const S = D.S, K = S.kennzahlen, w = K.wert;
  const vorher = D.V && D.V.kennzahlen ? D.V.kennzahlen.wert.erloes : null;
  // Verlauf hinter der Zahl: aufsummierte aktive Zeit — die Form des Erloeses,
  // ohne eine zweite Erloesformel im Browser.
  let summe = 0;
  const kum = (S.days || []).map((d) => (summe += d.active_seconds || 0));
  const a = area(kum.length > 1 ? kum : [0, summe], 600, 160, 10);
  const abgA = w.arbeitswert > 0 ? Math.min(100, K.abgerechnet_eur / w.arbeitswert * 100) : 0;
  const z = aktuellerZeitraum();
  const L = state.live;
  const b = L ? L.burn_usd_per_hour : 0;
  const m = L && L.minuten ? L.minuten : [];
  const mmax = Math.max(...m, 1);
  const n = liveSitzungen();
  return '<div class="hero-reihe">' +
    '<div class="karte hero">' +
      '<svg class="hero-flaeche" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".32"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="' + a.fill + '" fill="url(#hg1)"/><path d="' + a.line + '" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>' +
      '<div class="hero-inhalt">' +
        '<div class="hero-label"><span class="label hell">' + esc(uebersetze('Erlös im Zeitraum')) + '</span><span class="hinweis">' + esc(uebersetze('Arbeitswert — (Claude + manuelle Zeit) × Stundensatz')) + '</span></div>' +
        '<div class="hero-zahl"><span class="mono" id="hero-erloes">' + nf2.format(w.erloes) + '</span><span class="einheit">EUR</span>' +
          (state.vergleich && vorher ? '<span class="hero-delta">' + delta(w.erloes, vorher) + '<span>' + esc(uebersetze('ggü.')) + ' ' + esc(zeitraumText({ von: z.vorVon, bis: z.vorBis })) + '</span></span>' : '') + '</div>' +
        '<div class="hero-band"><div class="band"><span style="width:' + abgA.toFixed(1) + '%;background:var(--ok)"></span><span class="offen" style="width:' + (100 - abgA).toFixed(1) + '%"></span></div>' +
          '<div class="band-leg"><span><span class="leg-p" style="background:var(--ok)"></span>' + esc(uebersetze('abgerechnet')) + ' <b class="mono">' + eur(K.abgerechnet_eur) + '</b></span>' +
          '<span><span class="leg-p" style="background:var(--accent)"></span>' + esc(uebersetze('noch nicht abgerechnet')) + ' <b class="mono akzent">' + eur(K.offen_eur) + '</b> ' +
            esc(uebersetze('in')) + ' ' + K.offen_vorgaenge + ' ' + esc(uebersetze(K.offen_vorgaenge === 1 ? 'Vorgang' : 'Vorgängen')) + '</span></div></div>' +
      '</div></div>' +
    '<div class="karte live-karte">' +
      '<div class="karten-kopf"><span class="puls"' + (n ? '' : ' style="animation:none;background:var(--text-gruppe)"') + '></span><span class="label">Live</span>' +
        '<span class="hinweis">' + n + ' ' + esc(uebersetze(n === 1 ? 'Sitzung' : 'Sitzungen')) + ' · 60 Min</span>' +
        '<span class="rechts"><a class="akzent" href="#/live" style="font-size:12px">' + esc(uebersetze('öffnen')) + ' →</a></span></div>' +
      '<div class="live-mitte">' + gaugeSvg(b / 30, 'var(--accent)', { nadel: true, rund: true, breite: 12 }) +
        '<div class="live-text"><span class="live-rate mono">' + nf2.format(b) + '</span><span class="hell">' + esc(uebersetze('USD/h Verbrauchsrate')) + '</span>' +
        '<span class="hinweis">' + esc(uebersetze('Listenpreis, letzte 60 Min hochgerechnet')) + '</span></div></div>' +
      '<div class="strom">' + m.map((v, i) => '<span title="' + esc('−' + (59 - i) + ' Min · ' + num(v) + ' Tokens') + '" style="height:' + (v ? Math.max(4, v / mmax * 100) : 2).toFixed(1) + '%;background:' +
        (i === 59 ? 'var(--text)' : i >= 54 ? 'var(--accent)' : OFFEN_FARBE) + '"></span>').join('') + '</div>' +
      '<div class="strom-achse"><span>−60 Min</span><span>' + esc(uebersetze('Tokens je Minute')) + '</span><span>' + esc(uebersetze('jetzt')) + '</span></div>' +
    '</div></div>';
}

function verbindungsPillen(D) {
  const S = D.S;
  const ing = S.lastIngest || {};
  const jira = S.config.jiraBaseUrl;
  const P = [
    { n: 'Claude Code', v: ing.error ? 'nicht lesbar' : 'verbunden', c: ing.error ? 'var(--bad)' : 'var(--ok)',
      zeilen: [['Letzter Abgleich', ing.at ? vor(ing.at) : '–'], ['Dauer', ing.ms != null ? ing.ms + ' ms' : '–'], ['Neue Ereignisse', ing.events != null ? num(ing.events) : '–'],
        ...(ing.error ? [['Fehler', String(ing.error)]] : [])] },
    { n: 'Jira', v: jira ? 'eingeschaltet' : 'aus', c: jira ? 'var(--ok)' : 'var(--text-faint)',
      zeilen: [['Instanz', jira || '–'], ['Vorgangskürzel', (S.config.jiraProjectKeys || []).join(', ') || '–']] },
    { n: 'Preisdaten', v: S.pricing && S.pricing.source === 'cache' ? 'aktuell' : (S.pricing && S.pricing.source) || '–', c: 'var(--ok)',
      zeilen: [['Quelle', (S.pricing && S.pricing.source) || '–'], ['Modelle', S.pricing ? num(S.pricing.models) : '–']] },
  ];
  return '<div class="hub-oben"><div class="verbindungen">' + P.map((p) =>
      '<button type="button" class="verbindung" data-aktion="hub-verbindungen" aria-expanded="' + hubZustand.verbindungen + '"><span class="punkt" style="background:' + p.c + '"></span>' +
      esc(p.n) + ' <b style="color:' + p.c + '">' + esc(uebersetze(p.v)) + '</b></button>').join('') + '</div></div>' +
    (hubZustand.verbindungen ? '<div class="verbindung-panel">' + P.map((p) => '<div class="karte eingelassen"><div class="karten-kopf"><span class="punkt" style="background:' + p.c + '"></span><b>' + esc(p.n) + '</b><span class="hinweis">' + esc(uebersetze(p.v)) + '</span></div>' +
      p.zeilen.map(([k, v]) => '<span class="zeile-kv"><span class="faint">' + esc(uebersetze(k)) + '</span><span class="mono">' + esc(v) + '</span></span>').join('') + '</div>').join('') + '</div>' : '');
}

// Manuelle Zeit je Taetigkeit im gewaehlten Zeitraum (zeit.analyse), hoechstens alle 55 s.
const hubZeit = { schluessel: null, d: null, fehler: null, zeit: 0, laeuft: false };
async function ladeHubZeit() {
  const z = aktuellerZeitraum();
  const s = z.von + '|' + z.bis;
  if (hubZeit.laeuft || (hubZeit.schluessel === s && Date.now() - hubZeit.zeit < 55000)) return;
  if (hubZeit.schluessel !== s) hubZeit.d = null;
  hubZeit.laeuft = true;
  hubZeit.schluessel = s;
  hubZeit.zeit = Date.now();
  let d = null, fehler = null;
  try { d = await hole('/api/zeit/analyse?' + abfrage({ from: z.von, to: z.bis })); } catch (e) { fehler = e.message; }
  hubZeit.laeuft = false;
  // Zeitraum inzwischen gewechselt: Antwort verwerfen, gleich neu laden.
  const nun = aktuellerZeitraum();
  if (nun.von + '|' + nun.bis !== s) return ladeHubZeit();
  hubZeit.d = d || hubZeit.d;
  hubZeit.fehler = fehler;
  // Hub-Reihe und Analyse-Reiter Arbeitszeit lesen denselben Stand.
  if (route().name === 'hub' || route().name === 'analyse') zeichneAnsicht();
}

// Reihe unter den Instrumenten (Mockup Z. 376–400): Arbeitszeit heute, manuelle
// Zeit im Zeitraum und Workload 7 Tage (zWorkloadSpalte in zeit.js).
function zeitReihe(K) {
  zHeuteLaden();
  ladeHubZeit();
  const man = K.manuell_stunden || 0;
  const abr = K.aktive_stunden + man;
  const tats = hubZeit.d ? hubZeit.d.taetigkeiten : [];
  const tmax = Math.max(1, ...tats.map((t) => t.min));
  const balken = hubZeit.fehler ? '<span class="hinweis bad">' + esc(uebersetze('Zeiterfassung nicht geladen') + ': ' + hubZeit.fehler) + '</span>'
    : !hubZeit.d ? '<div class="leer">…</div>'
      : !tats.length ? '<span class="hinweis">' + esc(uebersetze('Keine Einträge in diesem Zeitraum.')) + '</span>'
        : tats.map((t, i) => '<div class="hz-tat"><span class="ell">' + esc(t.name) + '</span><span class="band duenn"><span style="width:' + (t.min / tmax * 100).toFixed(1) + '%;background:' + modellFarbe(i) + '"></span></span>' +
          '<span class="mono">' + zdur(t.min) + '</span></div>').join('');
  return '<section class="karte du-reihe hub-zeit">' + zArbeitHeute(true) +
    '<div class="zh-spalte"><span class="label">' + esc(uebersetze('Manuelle Zeit im Zeitraum')) + '</span>' +
      '<div class="zh-wert"><span class="mono zh-man">' + nf1.format(man) + '<small>h</small></span><span class="faint">' + nf0.format(abr > 0 ? man / abr * 100 : 0) + ' ' + esc(uebersetze('% der abrechenbaren Zeit')) + '</span></div>' +
      '<div class="hz-tats">' + balken + '</div></div>' + zWorkloadSpalte() +
  '</section>';
}

function hubHilfe() {
  if (!hubZustand.hilfe) return '';
  return '<div class="hub-hilfe">' +
    '<div><b>◠ ' + esc(uebersetze('Instrumente — Zustand gegen ein Soll')) + '</b><span>' + esc(uebersetze('Jede Anzeige hat eine Skala, Zielmarke oder Ampel: Monatsziel, Marge, Abrechnungsquote, Auslastung. Sie beantworten „Bin ich im grünen Bereich?“')) + '</span></div>' +
    '<div><b>▦ ' + esc(uebersetze('Meine Metriken — deine Schnellansicht')) + '</b><span>' + esc(uebersetze('Einzelne Kennzahlen, Diagramme und Belege aus Analyse und Abrechnung — ohne Soll, frei angeordnet. Sie beantworten „Was will ich täglich sehen?“')) + '</span></div>' +
    '<span class="hinweis">' + esc(uebersetze('Beide starten mit einer empfohlenen Auswahl. Über Bearbeiten hinzufügen, ziehen und Breite ändern — „↺ Standard“ stellt den Ausgangszustand wieder her.')) + '</span></div>';
}

const INSTRUMENT_UNTER = {
  marge: 'nach Sachkosten und eigener Zeit', abo: 'gezahlt vs. Listenpreis, beides in EUR', modelle: 'API-Gegenwert in USD',
  burn: 'Listenpreis, letzte 60 Min hochgerechnet', quote: 'Arbeitswert abgerechnet vs. noch nicht abgerechnet', agent: 'wie viel der KI-Laufzeit abrechenbar ist',
  ziel: 'Erlös im laufenden Monat gegen Ziel', cache: 'Anteil gelesener Cache-Tokens am Eingang', sitz: '',
  op: 'gestellte Rechnungen, noch nicht bezahlt · Liquidität, nicht Leistung',
};

function zeichneHub(w, teile, neu) {
  const S = state.summary;
  if (!S || !S.kennzahlen) {
    w.innerHTML = state.fehler.summary ? leer('liste', 'Server nicht erreichbar', 'Es wird weiter versucht.') : '<div class="leer">…</div>';
    return;
  }
  ladeHubDaten();
  // Neuzeichnen alle 15 s darf eine laufende Eingabe nicht verwerfen.
  const altFeld = document.getElementById('ziel-eingabe');
  const altWert = altFeld ? altFeld.value : null;
  const altFokus = !!altFeld && document.activeElement === altFeld;
  const D = { S, V: state.vorher, zielBearbeiten: hubZustand.zielBearbeiten };
  // Erst-Start: in den letzten zwoelf Wochen keine einzige erfasste Minute.
  const ersterStart = hubDaten.tage && !hubDaten.tage.length && !S.summary.requests;

  const inst = rasterStand('inst');
  const meta = Object.fromEntries(INSTRUMENTE.map((m) => [m[0], m]));
  const instHtml = inst.sicht.filter((id) => meta[id]).map((id) => {
    const m = meta[id];
    const pro = !!m[5] && !proAktiv();
    const rechts = id === 'ziel' ? '<button type="button" class="mini-knopf" data-aktion="ziel-bearbeiten" aria-label="' + esc(uebersetze('Ziel ändern')) + '">✎</button>'
      : id === 'sitz' ? '<a class="mini-link" href="#/live">Live →</a>' : '';
    const unter = id === 'stunden'
      ? (S.config.zeitmodell === 'aktivitaet' ? uebersetze('Claude: Aktivität')
        : uebersetze('Claude: Eigene Zeit') + ' · ±' + nf1.format(S.config.gapMinutes / 2) + ' ' + uebersetze('Min um Eingaben'))
      : INSTRUMENT_UNTER[id];
    return kachel('inst', id, m[1], unter, pro ? '<div class="platzhalter"></div><div class="platzhalter kurz"></div>' : instrumentInhalt(id, D),
      inst.breite[id] || 1, { rechts, pro, proText: 'Zahlungseingänge erfassen und offene Posten verfolgen.' });
  }).join('');

  const wst = rasterStand('meine');
  const wmeta = Object.fromEntries(WIDGETS.map((m) => [m[0], m]));
  const widHtml = wst.sicht.filter((id) => wmeta[id]).map((id) => {
    const m = wmeta[id];
    const rechts = '<a class="mini-link" href="#/' + m[4] + '" title="' + esc(uebersetze('Öffnen')) + '" aria-label="' + esc(uebersetze('Öffnen') + ': ' + uebersetze(m[1])) + '">↗</a>';
    const breite = wst.breite[id] || WIDGET_BREITE_STANDARD[id] || m[3];
    return kachel('meine', id, m[1], id.startsWith('kpi-') ? '' : m[2], widgetInhalt(id, D), breite, { rechts, ziel: '#/' + m[4] });
  }).join('');

  w.innerHTML =
    (ersterStart ? '<div class="karte weit erster-start">' + leer('uhr', 'Noch keine Claude-Sitzung erfasst',
      'Starte eine Claude-Code-Sitzung — sie erscheint hier nach dem nächsten Abgleich. Danach Stundensatz und Stammdaten unter Einstellungen setzen.',
      '<a class="knopf primaer" href="#/einstellungen">' + esc(uebersetze('Einstellungen öffnen')) + '</a>') + '</div>' : '') +
    verbindungsPillen(D) +
    hubHero(D) +
    rasterKopf('inst', 'Instrumente', 'Zustand gegen ein Soll — Ziele, Quoten, Auslastung', inst.angepasst) +
    hubHilfe() +
    katalogHtml('inst', INSTRUMENTE, inst.sicht) +
    '<div class="raster-kacheln inst" data-raster="inst">' + instHtml + (inst.sicht.length ? '' : leer('liste', 'Keine Instrumente ausgewählt', 'Über Bearbeiten hinzufügen.')) + '</div>' +
    zeitReihe(S.kennzahlen) +
    rasterKopf('meine', 'Meine Metriken', 'deine Schnellansicht ohne Soll — Kennzahlen, Diagramme, Belege', wst.angepasst) +
    katalogHtml('meine', WIDGETS, wst.sicht) +
    '<div class="raster-kacheln meine" data-raster="meine">' + widHtml +
      (hubZustand.bearbeiten.meine || !wst.sicht.length ? '<button type="button" class="kachel plus b1' + (wst.sicht.length ? '' : ' allein') + '" data-aktion="raster-plus" data-wert="meine" data-sek="meine"><span class="gross">+</span><span>' +
        esc(uebersetze(wst.sicht.length ? 'Metrik hinzufügen' : 'Noch keine eigenen Metriken')) + '</span><span class="hinweis">' + esc(uebersetze(wst.sicht.length ? 'oder hierher ziehen' : 'Kennzahlen, Diagramme oder Belege auf den Hub holen.')) + '</span></button>' : '') + '</div>';

  if (neu || !hubZustand.gezaehlt) {
    hubZustand.gezaehlt = true;
    const el = document.getElementById('hero-erloes');
    if (el) zaehleHoch(el, S.kennzahlen.wert.erloes, (v) => nf2.format(v));
  }
  verdrahteRaster(w);
  const zf = document.getElementById('ziel-eingabe');
  if (zf && altWert != null) zf.value = altWert;
  if (zf && (altFokus || (neu === false && hubZustand.zielBearbeiten && altWert == null))) zf.focus();
}

/* ---------- Bearbeiten: Ziehen, Breite, Katalog ---------- */
let gezogen = null;   // { sek, id }
function rasterSetze(sek, fn) {
  const st = rasterStand(sek);
  fn(st);
  rasterMerke(sek, st);
  zeichneAnsicht();
}
function verdrahteRaster(w) {
  for (const g of w.querySelectorAll('.greif')) {
    g.addEventListener('dragstart', (e) => {
      // Naechster Traeger mit Sektion: die Kachel, bei den Analyse-Kennzahlen die einzelne Karte.
      const k = g.closest('[data-sek]');
      gezogen = { sek: k.dataset.sek, id: k.dataset.id };
      try { e.dataTransfer.setData('text/plain', k.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch { /* egal */ }
      k.classList.add('zieht');
      ziehen(true);
    });
    g.addEventListener('dragend', () => { gezogen = null; for (const k of w.querySelectorAll('.ziel-drop, .zieht')) k.classList.remove('ziel-drop', 'zieht'); ziehen(false); });
  }
  for (const k of w.querySelectorAll('[data-katalog]')) {
    k.addEventListener('dragstart', (e) => {
      const [sek, id] = k.dataset.katalog.split(':');
      gezogen = { sek, id };
      ziehen(true);
      try { e.dataTransfer.setData('text/plain', id); } catch { /* egal */ }
    });
    k.addEventListener('dragend', () => { gezogen = null; ziehen(false); });
  }
  for (const k of w.querySelectorAll('.kachel.bearbeiten, .kachel.plus, .ana-kpi.bearbeiten')) {
    // Genau eine Kachel ist Ziel. dragleave feuert auch beim Wechsel auf ein
    // Kind-Element — nur das echte Verlassen nimmt die Markierung weg.
    k.addEventListener('dragover', (e) => {
      if (!gezogen || gezogen.sek !== k.dataset.sek) return;
      e.preventDefault();
      for (const x of k.parentElement.querySelectorAll('.ziel-drop')) if (x !== k) x.classList.remove('ziel-drop');
      k.classList.add('ziel-drop');
    });
    k.addEventListener('dragleave', (e) => { if (!k.contains(e.relatedTarget)) k.classList.remove('ziel-drop'); });
    k.addEventListener('drop', (e) => {
      if (!gezogen || gezogen.sek !== k.dataset.sek) return;
      e.preventDefault();
      e.stopPropagation();   // eine Kennzahl liegt in der Kachel "Kennzahlen" — die darf den Drop nicht noch einmal sehen
      const id = gezogen.id, vor = k.dataset.id || null;
      gezogen = null;
      // erst speichern, dann Sperre loesen — ziehen(false) zeichnet einmal neu
      if (id !== vor && k.dataset.sek === 'kpi') { merke('analyse.kpi', verschiebe(kpiReihe(), id, vor)); zeichneAnsicht(); }
      else if (id !== vor) rasterSetze(k.dataset.sek, (st) => { st.sicht = verschiebe(st.sicht, id, vor); });
      else zeichneAnsicht();
      ziehen(false);
    });
  }
  // Groesse wie im Entwurf: rechter Rand = Breite, unterer = Hoehe, Ecke = beides.
  // Beim Ziehen folgt die Kachel dem Zeiger pixelgenau (je Bild einmal), erst
  // beim Loslassen rastet sie auf 10 px ein. Die Ecke nimmt auch Pfeiltasten
  // (Ziehen nicht als einziger Weg). Doppelklick auf einen Griff = Auto.
  for (const g of w.querySelectorAll('.rz')) {
    const k = g.closest('.kachel'), modus = g.dataset.rz;
    g.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.isPrimary) return;
      e.preventDefault();
      const r = k.getBoundingClientRect(), zeile = k.parentElement.clientWidth;
      const x0 = e.clientX, y0 = e.clientY;
      const alt = rasterStand(k.dataset.sek).groesse[k.dataset.id] || {};
      // Sofort fest: sonst haelt die Mindesthoehe die Kachel beim Verkleinern
      // fest, und der Inhalt laeuft ueber, bis losgelassen wird.
      k.classList.add('fest');
      try { g.setPointerCapture(e.pointerId); } catch { /* synthetische Ereignisse */ }
      ziehen(true);
      document.body.style.cursor = getComputedStyle(g).cursor;
      document.body.style.userSelect = 'none';
      let roh = null, bild = 0;
      const anzeige = document.createElement('span');
      anzeige.className = 'rz-live';
      k.appendChild(anzeige);
      const raste = (n) => kachelGroesse({ w: n.w && Math.round(n.w / 10) * 10, h: n.h && Math.round(n.h / 10) * 10 });
      const zieh = (ev) => {
        roh = { w: alt.w, h: alt.h };
        if (modus !== 'b') roh.w = Math.round(Math.max(120, Math.min(zeile, 2000, r.width + ev.clientX - x0)));
        if (modus !== 'r') roh.h = Math.round(Math.max(80, Math.min(1600, r.height + ev.clientY - y0)));
        if (!bild) bild = requestAnimationFrame(() => {
          bild = 0;
          const n = kachelGroesse(roh), z = raste(roh) || {};
          k.style.cssText = n ? groesseStil(n) : '';
          anzeige.textContent = (z.w || 'auto') + ' × ' + (z.h || 'auto');
        });
      };
      // los kommt ueber pointerup, pointercancel oder verlorene Capture —
      // einmal reicht, sonst bliebe die Zieh-Sperre stehen.
      const ende = ['pointerup', 'pointercancel', 'lostpointercapture'];
      const los = () => {
        g.removeEventListener('pointermove', zieh);
        for (const t of ende) g.removeEventListener(t, los);
        window.removeEventListener('blur', los);
        cancelAnimationFrame(bild);
        document.body.style.cursor = document.body.style.userSelect = '';
        anzeige.remove();
        // Nur geklickt, nicht gezogen: eine Kachel ohne gespeicherte Groesse bleibt frei.
        if (roh == null && !alt.w && !alt.h) k.classList.remove('fest');
        const neu = roh && raste(roh);
        // Erst speichern, dann Sperre loesen: so zeichnet ein verpasstes
        // Nachladen nicht noch einmal die alte Groesse.
        if (neu) rasterSetze(k.dataset.sek, (st) => { st.groesse[k.dataset.id] = neu; });   // Zeichnen wird vorgemerkt
        ziehen(false);
      };
      g.addEventListener('pointermove', zieh);
      for (const t of ende) g.addEventListener(t, los);
      window.addEventListener('blur', los);
    });
    g.addEventListener('dblclick', () => AKTIONEN['raster-auto'](k.dataset.sek + ':' + k.dataset.id));
    if (modus === 'c') g.addEventListener('keydown', (e) => {
      const d = { ArrowRight: [10, 0], ArrowLeft: [-10, 0], ArrowDown: [0, 10], ArrowUp: [0, -10] }[e.key];
      if (!d) return;
      e.preventDefault();
      const r = k.getBoundingClientRect();
      const n = kachelGroesse({ w: Math.round((r.width + d[0]) / 10) * 10, h: Math.round((r.height + d[1]) / 10) * 10 });
      if (!n) return;
      const { sek, id } = k.dataset;
      rasterSetze(sek, (st) => { st.groesse[id] = n; });
      const neu = document.querySelector('.kachel[data-sek="' + sek + '"][data-id="' + CSS.escape(id) + '"] .rz-c');
      if (neu) neu.focus();
    });
  }
}

aktion('raster-bearbeiten', (sek) => {
  hubZustand.bearbeiten[sek] = !hubZustand.bearbeiten[sek];
  hubZustand.katalog = {};   // alle offenen Auswahl-Listen zu, nicht nur die eigene
  zeichneAnsicht();
});
aktion('raster-katalog', (sek) => { hubZustand.katalog[sek] = !hubZustand.katalog[sek]; zeichneAnsicht(); });
aktion('raster-plus', (sek) => { hubZustand.bearbeiten[sek] = true; hubZustand.katalog[sek] = true; zeichneAnsicht(); });
aktion('raster-standard', (sek) => { rasterStandard(sek); zeichneAnsicht(); });
aktion('raster-umschalten', (wert) => {
  const [sek, id] = wert.split(':');
  rasterSetze(sek, (st) => { st.sicht = st.sicht.includes(id) ? st.sicht.filter((x) => x !== id) : st.sicht.concat(id); });
});
aktion('raster-auto', (wert) => {
  const [sek, id] = wert.split(':');
  rasterSetze(sek, (st) => { delete st.groesse[id]; delete st.breite[id]; });
});
aktion('raster-weg', (wert) => {
  const [sek, id] = wert.split(':');
  rasterSetze(sek, (st) => { st.sicht = st.sicht.filter((x) => x !== id); });
});
aktion('kachel-ziel', (z, el, e) => {
  // Wer Text markiert, will kopieren, nicht springen; Eingabefelder und Knoepfe ohne eigene Aktion auch nicht.
  if (String(window.getSelection()).trim()) return;
  if (e.target.closest('input, select, textarea, label, button')) return;
  if (/^#\/[\w-]+$/.test(z)) geheZu(z.slice(2));
});
aktion('hub-hilfe', () => { hubZustand.hilfe = !hubZustand.hilfe; zeichneAnsicht(); });
aktion('hub-verbindungen', () => { hubZustand.verbindungen = !hubZustand.verbindungen; zeichneAnsicht(); });
aktion('ziel-bearbeiten', () => { hubZustand.zielBearbeiten = !hubZustand.zielBearbeiten; zeichneAnsicht(); });
aktion('ziel-speichern', () => {
  const el = document.getElementById('ziel-eingabe');
  const v = Number(String(el ? el.value : '').replace(/\D/g, '')) || 0;
  merke('hub.monatsziel', String(v));
  hubZustand.zielBearbeiten = false;
  zeichneAnsicht();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target && e.target.id === 'ziel-eingabe') AKTIONEN['ziel-speichern']();
});

registriere('hub', { zeichne: zeichneHub, live() { if (route().name === 'hub' && !hubZustand.bearbeiten.inst && !hubZustand.bearbeiten.meine) zeichneAnsicht(); } });
