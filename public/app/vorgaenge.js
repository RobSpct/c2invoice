'use strict';
/* Vorgaenge: Tabelle des Zeitraums und Detailseite je Vorgang (#/vorgaenge/KEY).
   Gerechnet wird hier nichts — jede Zahl kommt aus /api/summary (Tabelle,
   Zeitraum) oder /api/ticket (Detail, ganzer Vorgang). Im Browser entstehen
   nur Anteile fuer Balkenbreiten und die Formatierung. */

Object.assign(EN, {
  'Vorgänge im Zeitraum': 'jobs in period', 'Vorgang im Zeitraum': 'job in period', 'Marge im Zeitraum': 'Margin in period', 'nach Sachkosten + eigener Zeit': 'after material costs + own time', 'Spaltenkopf klicken zum Sortieren, Zeile für Details': 'Click a column header to sort, a row for details',
  'CSV exportieren': 'Export CSV', 'alle': 'all', 'offen': 'open', 'abgerechnet': 'invoiced', 'ohne Marge': 'no margin',
  'Verlauf': 'Trend', 'Aktiv': 'Active', 'Arbeitswert': 'Billable value', 'Status': 'Status', 'Budget': 'Budget',
  'Marge im Zeitraum — nach Sachkosten und eigener Zeit': 'Margin in period — after material costs and own time',
  'API-Gegenwert je Tag im Zeitraum': 'API equivalent per day in period',
  'Noch keine Vorgänge im Zeitraum': 'No jobs in this period yet',
  'Sobald ein Vorgangsschlüssel (z. B. ABC-123) in Branch oder Sitzung auftaucht, erscheint er hier.': 'As soon as a job key (e.g. ABC-123) shows up in a branch or session, it appears here.',
  'Kein Vorgang passt zum Filter': 'No job matches the filter',
  'Budget je Vorgang aus angenommenen Angeboten — mit der Pro-Version.': 'Budget per job from accepted quotes — with Pro.',
  '← Vorgänge': '← Jobs', 'Vorgang nicht gefunden': 'Job not found', 'Vorgang lädt …': 'Loading job …',
  'Der Schlüssel taucht in keiner erfassten Sitzung auf.': 'The key does not appear in any recorded session.',
  'Zurück zu den Vorgängen': 'Back to jobs', 'Vorgang konnte nicht geladen werden': 'Job could not be loaded', 'Erneut versuchen': 'Try again', 'Vorgang nicht aktualisiert': 'Job not refreshed', 'Server nicht erreichbar': 'Server not reachable',
  'Requests': 'Requests', 'h aktiv': 'h active', 'mit Subagent': 'with subagent', 'Web-Suchen': 'web searches',
  'Stundensatz in Einstellungen öffnen': 'Open hourly rate in settings', 'Vorgang in Jira öffnen': 'Open job in Jira',
  'Projektpfad kopieren': 'Copy project path', 'kopieren': 'copy', 'kopiert ✓': 'copied ✓', 'Kopieren nicht möglich': 'Copy not possible',
  'Zeitmodell': 'Time model', 'Gilt für alle Zahlen dieser Seite.': 'Applies to every figure on this page.',
  'Erfasst': 'Recorded', 'Angebot': 'Quote', 'Rechnung': 'Invoice', 'Bezahlt': 'Paid',
  'kein Angebotsbezug': 'no quote link', 'Mehr Spalten': 'More columns', 'Abo-Anteil USD': 'Plan share USD', 'Tokens lokal': 'Local tokens', 'In Jira öffnen': 'Open in Jira', 'Stand der Rechnung nicht geladen': 'Invoice status not loaded', 'noch nicht abgerechnet': 'not yet invoiced', 'Zahlungseingänge mit der Pro-Version': 'Payments with Pro',
  'Marge — nach Sachkosten und eigener Zeit': 'Margin — after material costs and own time',
  'Pp zum Ziel': 'pp to target', 'kein Ziel hinterlegt': 'no target set',
  'Selbstkostensatz fehlt — ohne ihn gibt es keine Marge.': 'Own cost rate missing — no margin without it.', 'Einstellungen öffnen': 'Open settings',
  'kein Erlös': 'no revenue',
  'Vom Erlös zur Marge': 'From revenue to margin', 'Erlös': 'Revenue', 'Abo-Anteil': 'Subscription share',
  'Lokale Rechenzeit': 'Local compute', 'Eigene Zeit': 'Own time', 'Marge': 'Margin', 'Deckungsbeitrag': 'Contribution margin',
  'Token-Aufteilung': 'Token split', 'Gesamt': 'Total',
  'Ring zeigt Anteile mit Mindestbreite — Cache gelesen kostet je Token rund ein Zehntel eines Input-Tokens.': 'Ring shows shares with a minimum width — a cache read costs about a tenth of an input token.',
  'Tagesverlauf': 'Daily trend', 'API-Gegenwert in USD · Punkte = Sitzungen': 'API equivalent in USD · dots = sessions',
  'Tag': 'Day', 'Woche': 'Week', 'Monat': 'Month', 'Fläche': 'Area', 'Balken': 'Bars',
  'API-Gegenwert': 'API equivalent', 'Mehrwert': 'Added value', 'Zahlen als Tabelle': 'Figures as table', 'Zeitraum': 'Period',
  'Zeit': 'Time', 'Geld': 'Money', 'Aktive Zeit': 'Active time', 'Agentenzeit': 'Agent time', 'nicht abgerechnet': 'not billed',
  'Vergleichsaufwand': 'Comparison effort', 'klassische Entwicklung ohne KI, Schätzung': 'classic development without AI, estimate',
  'Rabatt': 'Discount', 'Lokale Modelle': 'Local models', 'Gegenwert gesamt': 'Total equivalent', 'Rechnungsbetrag': 'Invoice amount',
  'Gegenwert − Rechnung': 'Equivalent − invoice', 'Zielmarge': 'Target margin', 'angestrebt': 'target',
  'gestellte Rechnung': 'issued invoice', 'Arbeitswert, noch nicht abgerechnet': 'Billable value, not yet invoiced',
  'Sachkosten, anteilig aus dem Abo': 'Material costs, pro rata from the subscription', 'Strom und Abschreibung': 'power and depreciation',
  'Erlös − Sachkosten': 'Revenue − material costs', 'Selbstkosten': 'own cost',
  'Tokens im Detail': 'Tokens in detail', 'Betrag je Zeile aus den Modellpreisen': 'Amount per row from model prices',
  'Art': 'Type', 'Anteil': 'Share', 'Input': 'Input', 'Output': 'Output', 'Cache geschrieben · 5 Min': 'Cache written · 5 min',
  'Cache geschrieben · 1 h': 'Cache written · 1 h', 'Cache gelesen': 'Cache read',
  'Abweichung zur erfassten Summe': 'Difference to recorded total', 'Preis seit der Erfassung geändert oder Modell ohne Preis': 'Price changed since recording or model without price',
  'davon Werkzeug-Tokens': 'of which tool tokens', 'zusätzlich, siehe Werkzeuge': 'additional, see tools',
  'Modelle im Vorgang': 'Models in job', 'Anteil am API-Gegenwert': 'Share of API equivalent', 'Preis geschätzt': 'price estimated', 'ohne Preis': 'no price',
  'älteste zuerst · Zeitmodell je Sitzung änderbar in Live': 'oldest first · time model per session can be changed in Live',
  'Start': 'Start', 'Cache 5 Min': 'Cache 5 min', 'Cache 1 h': 'Cache 1 h', 'Branch': 'Branch', 'Modell': 'Model', 'Marken': 'Marks', 'Subagent': 'Subagent',
  'Eingaben': 'Inputs', 'Aktivität': 'Activity', 'gemischt': 'mixed',
  'Für Beleg auswählen': 'Select for document', 'Auswahl': 'Selection', 'Beleg erstellen': 'Create document',
  'nur Claude': 'Claude only', 'mit manueller Zeit': 'with manual time', 'Zahlen': 'Figures', 'h abrechenbar': 'h billable',
  'Gilt für alle Zahlen dieser Seite: Gauge, Wasserfall, Rechenweg. Rechnung rechnet immer mit manueller Zeit.':
    'Applies to every figure on this page: gauge, waterfall, calculation. Invoices always include manual time.',
  'ausgeblendet · Schalter oben: „mit manueller Zeit“': 'hidden · switch above: “with manual time”',
  'Eintrag aus der Zeiterfassung': 'entry from time tracking', 'Einträge aus der Zeiterfassung': 'entries from time tracking',
  'je Eintrag aufgerundet': 'rounded up per entry', 'keine Einträge — in der Zeiterfassung buchen': 'no entries — book in time tracking',
  'Aktive Zeit · Claude': 'Active time · Claude', 'Manuelle Zeit': 'Manual time', 'Abrechenbare Zeit': 'Billable time',
  'Claude aktiv + manuell, Überlappung bereinigt': 'Claude active + manual, overlap removed', 'nur Claude aktiv': 'Claude active only',
  'Arbeitswert manuell': 'Billable value, manual', 'Satz je Eintrag aus der Zeiterfassung': 'rate per entry from time tracking',
  'Eintrag': 'entry',
});

const ZM_NAME = { eingaben: 'Eigene Zeit', aktivitaet: 'Aktivität', gemischt: 'gemischt' };
const zmName = (m) => uebersetze(ZM_NAME[m] || m || '–');
// Zahl mit passender Einzahl oder Mehrzahl.
const anzahl = (n, eins, mehr) => num(n) + ' ' + uebersetze(Number(n) === 1 ? eins : mehr);

const vz = {
  sort: liesJson('vorgaenge.sort', { k: 'arbeitswert', dir: -1 }),
  filter: lies('vorgaenge.filter', 'alle'),
  detail: { key: null, d: null, fehler: null, bezug: null },
  kopiert: false,
  tabelleOffen: lies('detail.tabelle', '0') === '1',
  wahl: new Set(),        // Haken fuer "Beleg erstellen" (nur diese Sitzung)
  mehr: lies('vorgaenge.mehr', '0') === '1',
};

/* ---------- Tabelle ---------- */

const SPALTEN_V = [
  ['ticket', 'Vorgang', false], ['verlauf', 'Verlauf', null], ['active_hours', 'Aktiv', true], ['agent_hours', 'Agent', true],
  ['api_gegenwert_usd', 'API USD', true], ['arbeitswert', 'Arbeitswert', true],
  ['marge', 'Marge im Zeitraum', true, 'nach Sachkosten + eigener Zeit'], ['zeitmodell', 'Zeitmodell', null],
  ['status', 'Status', null], ['budget', 'Budget', null],
];
// Weitere Spalten der bisherigen Tabelle, hinter "Mehr Spalten": fest eingebaut
// liefe die Tabelle schon bei 1024 px ueber.
const SPALTEN_MEHR = [
  ['requests', 'Requests', true], ['total_tokens', 'Tokens', true], ['abo_anteil_usd', 'Abo-Anteil USD', true],
  ['lokal_tokens', 'Tokens lokal', true], ['first_day', 'Zeitraum', false],
];
// Budget ist noch nicht gebaut: bei offenem Schalter keine Spalte (R16).
const spaltenV = () => [...SPALTEN_V.filter((s) => s[0] !== 'budget'), ...(vz.mehr ? SPALTEN_MEHR : []),
  ...(proAktiv() ? [] : SPALTEN_V.filter((s) => s[0] === 'budget'))];
// Gemerkte Sortierung aus dem Browser-Speicher nur uebernehmen, wenn sie passt.
if (!spaltenV().some(([key, , zahl]) => key === vz.sort.k && zahl != null) || ![1, -1].includes(vz.sort.dir)) vz.sort = { k: 'arbeitswert', dir: -1 };
const sortWert = (t, k) => (k === 'marge' ? (t.wert ? t.wert.marge_prozent : null) : t[k]);

function margeZelle(w) {
  if (!w || w.marge_prozent == null) return '<span class="faint">–</span>';
  const p = w.marge_prozent;
  const breite = Math.max(0, Math.min(1, p / 60)) * 100;
  // Zielmarke wie im Entwurf: weisser Strich an der Zielmarge.
  const ziel = w.zielmarge_prozent == null ? '' : '<i class="ziel" style="left:' + (Math.max(0, Math.min(1, w.zielmarge_prozent / 60)) * 100).toFixed(1) + '%"></i>';
  return '<span class="marge-zelle"><span class="band duenn" aria-hidden="true"><span style="width:' + breite.toFixed(1) + '%;background:' +
    margeFarbe(p, w.zielmarge_prozent) + '"></span>' + ziel + '</span><span class="mono" style="color:' + margeFarbe(p, w.zielmarge_prozent) + '">' +
    nf1.format(p) + ' %</span></span>';
}

function sparkline(reihe, tage) {
  if (!reihe || !reihe.length) return '<span class="faint">–</span>';
  const jeTag = new Map(reihe);
  const vals = tage.length ? tage.map((d) => jeTag.get(d) || 0) : reihe.map((x) => x[1]);
  const a = area(vals, 64, 22, 2);
  return '<svg class="spark" viewBox="0 0 64 22" width="64" height="22" aria-hidden="true">' +
    '<path d="' + a.fill + '" fill="var(--accent-soft)"/><path d="' + a.line + '" fill="none" stroke="var(--accent)" stroke-width="1.3"/></svg>';
}

function zeichneTabelle(w) {
  const S = state.summary;
  if (!S) { w.innerHTML = state.fehler.summary ? leer('liste', 'Server nicht erreichbar') : '<div class="leer">…</div>'; return; }
  const abr = S.abrechnung || {};
  const alle = Array.isArray(S.tickets) ? S.tickets : [];
  const passt = {
    alle: () => true,
    offen: (t) => !abr[t.ticket],
    abgerechnet: (t) => !!abr[t.ticket],
    ohne: (t) => !t.wert || t.wert.marge_prozent == null,
  }[vz.filter] || (() => true);
  const { k, dir } = vz.sort;
  const zeilen = alle.filter(passt).sort((a, b) => {
    const x = sortWert(a, k), y = sortWert(b, k);
    if (x == null && y == null) return 0;
    if (x == null) return 1;            // leere Werte immer hinten
    if (y == null) return -1;
    return (typeof x === 'string' ? x.localeCompare(y, 'de') : x - y) * dir;
  });
  const tage = (S.days || []).map((d) => d.day);
  const z = aktuellerZeitraum();

  const kopf = '<th scope="col" class="wahl"><span class="nur-sr">' + esc(uebersetze('Auswahl')) + '</span></th>' + spaltenV().map(([key, label, zahl, unter]) => {
    if (zahl == null) return '<th scope="col">' + esc(uebersetze(label)) + '</th>';
    const aktiv = k === key;
    return '<th scope="col"' + (zahl ? ' class="z"' : '') + ' aria-sort="' + (aktiv ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
      '<button type="button" class="th-knopf" data-aktion="v-sort" data-wert="' + key + '">' + esc(uebersetze(label)) +
        (unter ? '<span class="unter">' + esc(uebersetze(unter)) + '</span>' : '') + '</button></th>';
  }).join('');

  const zeile = (t) => {
    const ist = !!abr[t.ticket];
    return '<tr class="klickbar" data-aktion="v-oeffnen" data-wert="' + esc(t.ticket) + '">' +
      // Haken fuer den Schnellweg in den Beleg-Editor. Eigene Aktion, damit der
      // Klick nicht die Zeile oeffnet.
      '<td class="wahl"><input type="checkbox" name="v-wahl" data-aktion="v-wahl" data-wert="' + esc(t.ticket) + '"' + (vz.wahl.has(t.ticket) ? ' checked' : '') +
        ' aria-label="' + esc(uebersetze('Für Beleg auswählen') + ' ' + t.ticket) + '"></td>' +
      '<td><a class="mono vorgang-link" href="#/vorgaenge/' + encodeURIComponent(t.ticket) + '"><b>' + esc(t.ticket) + '</b></a>' +
        '<span class="unter faint">' + esc(t.project || '–') + ' · ' + esc(anzahl(t.sessions, 'Sitzung', 'Sitzungen')) + '</span></td>' +
      '<td title="' + esc(uebersetze('API-Gegenwert je Tag im Zeitraum')) + '">' + sparkline((S.ticket_verlauf || {})[t.ticket], tage) + '</td>' +
      '<td class="z">' + hrs(t.active_hours) + '</td>' +
      '<td class="z faint">' + hrs(t.agent_hours) + '</td>' +
      '<td class="z akzent">' + nf2.format(t.api_gegenwert_usd) + '</td>' +
      '<td class="z">' + nf2.format(t.arbeitswert) + '</td>' +
      '<td class="z">' + margeZelle(t.wert) + '</td>' +
      '<td><span class="pille">' + esc(zmName(t.zeitmodell)) + '</span></td>' +
      '<td><span class="pille status' + (ist ? ' ok' : '') + '"' + (ist ? ' title="' + esc(abr[t.ticket].nummern.join(', ') + ' · ' + eur(abr[t.ticket].betrag_eur)) + '"' : '') + '>' +
        esc(uebersetze(ist ? 'abgerechnet' : 'offen')) + '</span></td>' +
      (vz.mehr ? '<td class="z">' + num(t.requests) + '</td><td class="z">' + num(t.total_tokens) + '</td>' +
        '<td class="z">' + nf2.format(t.abo_anteil_usd || 0) + '</td><td class="z">' + num(t.lokal_tokens || 0) + '</td>' +
        '<td class="faint nowrap">' + esc(t.first_day === t.last_day ? datum(t.first_day) : datum(t.first_day) + ' – ' + datum(t.last_day)) + '</td>' : '') +
      (proAktiv() ? '' : '<td><span class="pille pro" title="' + esc(uebersetze('Budget je Vorgang aus angenommenen Angeboten — mit der Pro-Version.')) + '">Pro</span></td>') +
    '</tr>';
  };

  // Nur Vorgaenge, die es im Zeitraum gibt: nach einem Zeitraumwechsel faellt
  // eine Wahl weg, die der Editor nicht mehr findet.
  for (const k of vz.wahl) if (!alle.some((t) => t.ticket === k)) vz.wahl.delete(k);
  const gewaehlt = [...vz.wahl];
  const belegLink = '#/beleg/neu?' + abfrage({ art: 'rechnung', tickets: gewaehlt.join(','), from: z.von, to: z.bis });
  w.innerHTML = '<div class="karte weit">' +
    '<div class="karten-kopf"><h2 class="titel-klein">' + num(alle.length) + ' ' + esc(uebersetze(alle.length === 1 ? 'Vorgang im Zeitraum' : 'Vorgänge im Zeitraum')) + '</h2>' +
      '<span class="hinweis">' + esc(uebersetze('Spaltenkopf klicken zum Sortieren, Zeile für Details')) + '</span>' +
      '<span class="rechts">' +
        (gewaehlt.length ? '<a class="knopf primaer klein" href="' + esc(belegLink) + '">' + esc(uebersetze('Beleg erstellen')) + ' (' + num(gewaehlt.length) + ')</a>' : '') + segment('v-filter', [['alle', 'alle'], ['offen', 'offen'], ['abgerechnet', 'abgerechnet'], ['ohne', 'ohne Marge']], vz.filter, 'Filter') +
        '<button type="button" class="knopf klein' + (vz.mehr ? ' an' : '') + '" data-aktion="v-mehr" aria-pressed="' + vz.mehr + '">' + esc(uebersetze('Mehr Spalten')) + '</button>' +
        '<a class="knopf klein" href="/api/export.csv?' + esc(abfrage({ from: z.von, to: z.bis })) + '">' + esc(uebersetze('CSV exportieren')) + '</a></span></div>' +
    (!alle.length ? leer('liste', 'Noch keine Vorgänge im Zeitraum', 'Sobald ein Vorgangsschlüssel (z. B. ABC-123) in Branch oder Sitzung auftaucht, erscheint er hier.')
      : !zeilen.length ? leer('liste', 'Kein Vorgang passt zum Filter')
      : '<div class="tabelle-huelle"><table class="tabelle vorgaenge"><thead><tr>' + kopf + '</tr></thead><tbody>' + zeilen.map(zeile).join('') + '</tbody></table></div>') +
  '</div>';
}

aktion('v-sort', (k) => {
  vz.sort = { k, dir: vz.sort.k === k ? -vz.sort.dir : (k === 'ticket' ? 1 : -1) };
  merke('vorgaenge.sort', vz.sort);
  zeichneAnsicht();
});
aktion('v-mehr', () => {
  vz.mehr = !vz.mehr; merke('vorgaenge.mehr', vz.mehr ? '1' : '0');
  // Sortiert nach einer jetzt ausgeblendeten Spalte: zurueck auf Arbeitswert.
  if (!spaltenV().some(([key]) => key === vz.sort.k)) { vz.sort = { k: 'arbeitswert', dir: -1 }; merke('vorgaenge.sort', vz.sort); }
  zeichneAnsicht();
});
aktion('v-filter', (f) => { vz.filter = f; merke('vorgaenge.filter', f); zeichneAnsicht(); });
aktion('v-oeffnen', (key) => geheZu('vorgaenge/' + encodeURIComponent(key)));
// Die Delegation verhindert den Standard-Klick; der Haken folgt deshalb dem Zustand.
aktion('v-wahl', (key) => {
  if (vz.wahl.has(key)) vz.wahl.delete(key); else vz.wahl.add(key);
  zeichneAnsicht();
  const el = document.querySelector('[data-aktion="v-wahl"][data-wert="' + CSS.escape(key) + '"]');
  if (el) el.focus();
});

/* ---------- Detail ---------- */

// Holt den Vorgang neu, wenn sich der Schluessel aendert oder die Auswertung
// neu geladen wurde (Zeitmodell, Buchen, Abgleich).
async function ladeVorgang(key) {
  const D = vz.detail;
  if (D.key === key && D.bezug === state.summary && (D.d || D.fehler || D.laedt)) return;
  if (D.key !== key) { D.d = null; D.fehler = null; }
  D.key = key;
  D.bezug = state.summary;
  D.laedt = true;
  // Nur die zuletzt gestartete Abfrage zaehlt: eine aeltere Antwort (alter
  // Vorgang oder Stand vor dem Zeitmodell-Wechsel) darf nichts ueberschreiben.
  const lauf = D.lauf = (D.lauf || 0) + 1;
  let fehler = null, d = null;
  try { d = await hole('/api/ticket?key=' + encodeURIComponent(key)); } catch (e) { fehler = e.message || 'Fehler'; }
  if (lauf !== D.lauf) return;
  D.laedt = false;
  if (!fehler) { D.d = d; D.fehler = null; }
  // Scheitert nur das Nachladen, bleibt der zuletzt geladene Stand stehen.
  else if (D.d) toast(uebersetze('Vorgang nicht aktualisiert') + ': ' + fehler, 'err');
  else D.fehler = fehler;
  const r = route();
  if (r.name === 'vorgaenge' && r.teile[0] === key) zeichneAnsicht();
}

function jiraLink(key) {
  const c = (state.summary && state.summary.config) || {};
  const praefix = String(key).split('-')[0];
  if (!/^https?:\/\//i.test(c.jiraBaseUrl || '') || !/^[A-Z][A-Z0-9]*-\d+$/.test(key) || ((c.jiraProjectKeys || []).length && !c.jiraProjectKeys.includes(praefix))) return null;
  return String(c.jiraBaseUrl).replace(/\/+$/, '') + '/browse/' + encodeURIComponent(key);
}

// Schalter "nur Claude | mit manueller Zeit" (Mockup Z. 1014, Standard: mit).
// Beide Zahlensaetze kommen vom Server (/api/ticket wert, wert_nur_claude).
// Fehlt der Claude-Zahlensatz, gilt "mit manueller Zeit" — nie Zahlen mit manueller Zeit unter "nur Claude".
const detailModus = () => (lies('detail.modus', 'alle') === 'claude' && vz.detail.d && vz.detail.d.wert_nur_claude ? 'claude' : 'alle');
const detailWert = (d) => (detailModus() === 'claude' ? d.wert_nur_claude : d.wert);
const manH = (d) => (detailModus() === 'alle' ? Number(d.manuell_hours) || 0 : 0);

function kopfKarte(d) {
  const jira = jiraLink(d.ticket);
  const meta = [
    datum(d.first_day) + ' – ' + datum(d.last_day),
    anzahl(d.sessions, 'Sitzung', 'Sitzungen'),
    num(d.requests) + ' ' + uebersetze('Requests'),
    nf1.format(d.active_hours + manH(d)) + ' ' + uebersetze(detailModus() === 'alle' ? 'h abrechenbar' : 'h aktiv'),
    num(d.subagent_sitzungen) + ' ' + uebersetze('mit Subagent'),
    num(d.web_suchen) + ' ' + uebersetze('Web-Suchen'),
  ];
  return '<div class="karte weit detail-kopf">' +
    '<a class="textknopf" href="#/vorgaenge">' + esc(uebersetze('← Vorgänge')) + '</a>' +
    '<div class="detail-titel"><b class="mono">' + esc(d.ticket) + '</b><span class="faint">' + esc(meta.join(' · ')) + '</span>' +
      (proAktiv() ? '' : '<span class="pille pro" title="' + esc(uebersetze('Budget je Vorgang aus angenommenen Angeboten — mit der Pro-Version.')) + '">' + esc(uebersetze('Budget')) + ' · Pro</span>') +
      '<span class="detail-modus" title="' + esc(uebersetze('Gilt für alle Zahlen dieser Seite: Gauge, Wasserfall, Rechenweg. Rechnung rechnet immer mit manueller Zeit.')) + '">' +
        segment('v-modus', [['claude', 'nur Claude'], ['alle', 'mit manueller Zeit']], detailModus(), 'Zahlen') + '</span></div>' +
    '<div class="detail-chips">' +
      '<a class="chip" href="#/einstellungen" title="' + esc(uebersetze('Stundensatz in Einstellungen öffnen')) + '">' + esc(d.project || '–') +
        '<span class="mono">' + nf2.format(d.stundensatz) + ' EUR/h</span><span aria-hidden="true">↗</span></a>' +
      // Jira-Link haengt am Vorgang, nicht am Branch: auch ohne Branch erreichbar.
      (jira ? '<a class="chip" href="' + esc(jira) + '" target="_blank" rel="noopener" title="' + esc(uebersetze('Vorgang in Jira öffnen')) + '"><span class="mono">' + esc(d.branch || d.ticket) + '</span><span>Jira ↗</span></a>'
        : d.branch ? '<span class="chip"><span class="mono">' + esc(d.branch) + '</span></span>' : '') +
      (d.cwd ? '<button type="button" class="chip" data-aktion="v-kopieren" title="' + esc(uebersetze('Projektpfad kopieren')) + '"><span class="mono ell">' + esc(d.cwd) +
        '</span><span>' + esc(uebersetze(vz.kopiert ? 'kopiert ✓' : 'kopieren')) + '</span></button>' : '') +
    '</div>' +
    '<div class="detail-zm"><span class="label">' + esc(uebersetze('Zeitmodell')) + '</span>' +
      zeitmodellSchalter('vorgang', d.ticket, d.zeitmodell_wahl, d.zeitmodell_erbt) +
      '<span class="hinweis">' + esc(uebersetze('Gilt für alle Zahlen dieser Seite.')) + (d.zeitmodell === 'gemischt' ? ' · ' + esc(zmName('gemischt')) : '') + '</span></div>' +
  '</div>' + zeitstrahl(d);
}

function zeitstrahl(d) {
  const abr = d.abgerechnet;
  const schritt = (fertig, n, titel, unter, extra) => '<div class="schritt' + (fertig ? ' fertig' : '') + '"><span class="nr">' + n + '</span>' +
    '<span><span class="t">' + esc(uebersetze(titel)) + '</span><span class="faint">' + unter + '</span></span>' + (extra || '') + '</div>';
  return '<div class="karte weit zeitstrahl">' +
    schritt(true, '✓', 'Erfasst', esc(datum(d.first_day))) +
    schritt(false, '–', 'Angebot', esc(uebersetze('kein Angebotsbezug'))) +
    schritt(!!abr, abr ? '✓' : '3', 'Rechnung', abr
      ? '<a href="#/rechnungen">' + esc(abr.nummern.join(', ')) + '</a> · ' + esc(eur(abr.betrag_eur))
      : esc(uebersetze('noch nicht abgerechnet'))) +
    (proAktiv() ? bezahltSchritt(abr, schritt) : schritt(false, '4', 'Bezahlt', esc(uebersetze('Zahlungseingänge mit der Pro-Version')), '<span class="pille pro">Pro</span>')) +
  '</div>';
}

// Stand der gestellten Rechnungen zu diesem Vorgang; Storno und Stornierte zaehlen nicht.
function bezahltSchritt(abr, schritt) {
  const rs = abr ? (state.rechnungen || []).filter((r) => abr.nummern.includes(r.nr) && r.status === 'erstellt') : [];
  if (!rs.length) return schritt(false, '4', 'Bezahlt', esc(uebersetze(abr ? 'Stand der Rechnung nicht geladen' : 'noch nicht abgerechnet')));
  const fertig = rs.every((r) => r.status_abgeleitet === 'bezahlt');
  const ueber = rs.some((r) => r.ueberfaellig_tage > 0);
  return schritt(fertig, fertig ? '✓' : '4', 'Bezahlt', '<a href="#/rechnungen"' + (ueber ? ' class="schlecht"' : '') + '>' +
    esc(uebersetze(fertig ? 'bezahlt' : ueber ? 'überfällig' : rs.some((r) => r.status_abgeleitet === 'teilbezahlt') ? 'teilbezahlt' : 'offen')) + '</a>');
}

function gaugeKarte(w) {
  const ziel = w.zielmarge_prozent;
  if (w.marge_prozent == null) {
    return '<div class="karte weit"><span class="label">' + esc(uebersetze('Marge — nach Sachkosten und eigener Zeit')) + '</span>' +
      leer('liste', w.erloes > 0 ? 'Selbstkostensatz fehlt — ohne ihn gibt es keine Marge.' : 'kein Erlös', null,
        w.erloes > 0 ? '<a class="knopf klein" href="#/einstellungen">' + esc(uebersetze('Einstellungen öffnen')) + '</a>' : '') + '</div>';
  }
  const g = gauge(w.marge_prozent, 60, ziel);
  const farbe = margeFarbe(w.marge_prozent, ziel);
  const abw = w.zielmarge_abweichung;
  return '<div class="karte weit gauge-karte"><span class="label">' + esc(uebersetze('Marge — nach Sachkosten und eigener Zeit')) + '</span>' +
    '<svg viewBox="0 0 220 124" class="detail-gauge" role="img" aria-label="' + esc(uebersetze('Marge') + ' ' + nf1.format(w.marge_prozent) + ' %') + '">' +
      '<path d="' + g.bahn + '" fill="none" stroke="var(--line-soft)" stroke-width="14"/>' +
      '<path d="' + g.wert + '" fill="none" stroke="' + farbe + '" stroke-width="14" stroke-linecap="round"/>' +
      (g.zielPt ? '<circle cx="' + g.zielPt[0] + '" cy="' + g.zielPt[1] + '" r="4" fill="var(--text)"/>' : '') +
    '</svg>' +
    '<div class="gauge-text"><span class="instr-wert" style="color:' + farbe + '">' + nf1.format(w.marge_prozent) + '<span>%</span></span>' +
      '<span class="faint">' + (abw == null ? esc(uebersetze('kein Ziel hinterlegt'))
        : (abw > 0 ? '+' : '') + nf1.format(abw) + ' ' + esc(uebersetze('Pp zum Ziel'))) + '</span>' +
      '<span class="mono">' + esc(eur(w.marge)) + '</span></div></div>';
}

function wasserfallKarte(w) {
  const stufen = [{ l: 'Erlös', v: w.erloes, summe: true }, { l: 'Abo-Anteil', v: w.eigene_kosten, neg: true }];
  if (w.lokal_kosten > 0) stufen.push({ l: 'Lokale Rechenzeit', v: w.lokal_kosten, neg: true });
  if (w.zeitkosten != null) {
    stufen.push({ l: 'Eigene Zeit', v: w.zeitkosten, neg: true }, { l: 'Marge', v: w.marge, summe: true });
  } else if (w.deckungsbeitrag != null) {
    stufen.push({ l: 'Deckungsbeitrag', v: w.deckungsbeitrag, summe: true });
  }
  const B = wasserfall(stufen, 400, 190);
  const farbe = (b) => (b.neg ? 'var(--bad)' : b.l === 'Erlös' ? 'var(--text-dim)' : margeFarbe(w.marge_prozent, w.zielmarge_prozent));
  return '<div class="karte weit"><span class="label">' + esc(uebersetze('Vom Erlös zur Marge')) + '</span>' +
    '<svg viewBox="0 0 400 210" class="detail-wf" role="img" aria-label="' + esc(B.map((b) => uebersetze(b.l) + ' ' + (b.neg ? '−' : '') + nf2.format(b.v)).join(', ')) + '">' +
      B.map((b) => '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" rx="2" fill="' + farbe(b) + '" fill-opacity="' + (b.neg ? '.75' : '.9') + '"/>' +
        '<text x="' + (Number(b.x) + Number(b.w) / 2).toFixed(1) + '" y="' + (Number(b.y) - 4).toFixed(1) + '" text-anchor="middle" class="wf-wert">' +
          (b.neg ? '−' : '') + nf0.format(b.v) + '</text>' +
        '<text x="' + (Number(b.x) + Number(b.w) / 2).toFixed(1) + '" y="206" text-anchor="middle" class="wf-label">' + esc(uebersetze(b.l)) + '</text>').join('') +
    '</svg><span class="hinweis">EUR</span></div>';
}

const ART_NAME = { input: 'Input', output: 'Output', cache_5m: 'Cache geschrieben · 5 Min', cache_1h: 'Cache geschrieben · 1 h', cache_lesen: 'Cache gelesen' };
const ART_KURZ = { input: 'Input', output: 'Output', cache_5m: 'Cache 5 Min', cache_1h: 'Cache 1 h', cache_lesen: 'Cache gelesen' };
const ART_FARBE = { input: 'var(--text)', output: 'var(--accent)', cache_5m: 'var(--m-3)', cache_1h: 'var(--m-2)', cache_lesen: 'var(--m-rest)' };

function tokenRingKarte(d) {
  const T = d.token_arten;
  const segs = ring(T.zeilen.map((z) => ({ n: z.art, v: z.tokens, c: ART_FARBE[z.art] })), 40, 0.06);
  return '<div class="karte weit"><span class="label">' + esc(uebersetze('Token-Aufteilung')) + '</span>' +
    '<div class="ring-reihe">' + ringSvg(segs, 104, 14) +
      '<div class="legenden eng">' + segs.map((s) => legende(s.c, ART_KURZ[s.n], kurz(s.v))).join('') +
        legende('transparent', 'Gesamt', kurz(T.tokens)) + '</div></div>' +
    '<span class="hinweis">' + esc(uebersetze('Ring zeigt Anteile mit Mindestbreite — Cache gelesen kostet je Token rund ein Zehntel eines Input-Tokens.')) + '</span></div>';
}

// Montag einer Woche, wie metrics.montagVon — nur zum Einsortieren der Sitzungspunkte.
function montag(tag) {
  const d = new Date(tag + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function verlaufKarte(d, w) {
  // Nur bekannte Werte aus dem Browser-Speicher, sonst der Standard.
  const koernung = ['tag', 'woche', 'monat'].includes(lies('detail.koernung')) ? lies('detail.koernung') : 'tag';
  const form = lies('detail.form') === 'balken' ? 'balken' : 'flaeche';
  const reihe = { tag: d.days, woche: d.weeks, monat: d.months }[koernung] || [];
  const vals = reihe.map((r) => r.cost_usd);
  const max = Math.max(...vals, 0) || 1;
  const schluessel = (ts) => { const t = String(ts || '').slice(0, 10); return koernung === 'woche' ? montag(t) : koernung === 'monat' ? t.slice(0, 7) : t; };
  const idx = new Map(reihe.map((r, i) => [r.day, i]));
  const n = reihe.length;
  const punkte = d.sitzungen.map((s) => idx.get(schluessel(s.start))).filter((i) => i != null);
  const xPos = (i) => (n < 2 ? 50 : i / (n - 1) * 100);
  const marke = (r) => (koernung === 'tag' ? datumKurz(r.day) : koernung === 'woche' ? datumKurz(r.day) : r.day);
  let grafik;
  if (!n) grafik = leer('liste', 'kein Erlös');
  else if (form === 'balken') {
    grafik = '<div class="saeulen detail-saeulen">' + reihe.map((r) => '<div title="' + esc(marke(r) + ' · ' + nf2.format(r.cost_usd) + ' USD') + '">' +
      '<span class="mono">' + nf0.format(r.cost_usd) + '</span><span class="s" style="height:' + Math.max(1, r.cost_usd / max * 100).toFixed(1) + '%"></span></div>').join('') + '</div>';
  } else {
    const a = area(vals, 1000, 150, 8);
    grafik = '<svg viewBox="0 0 1000 150" preserveAspectRatio="none" class="detail-flaeche" aria-hidden="true">' +
      '<path d="' + a.fill + '" fill="var(--accent-soft)"/><path d="' + a.line + '" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }
  const achse = n ? [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, x) => x.indexOf(v) === i).map((i) => '<span>' + esc(marke(reihe[i])) + '</span>').join('') : '';
  return '<div class="karte weit verlauf-karte">' +
    '<div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Tagesverlauf')) + '</h2><span class="hinweis">' + esc(uebersetze('API-Gegenwert in USD · Punkte = Sitzungen')) + '</span>' +
      segment('v-koernung', [['tag', 'Tag'], ['woche', 'Woche'], ['monat', 'Monat']], koernung, 'Zeitraum') +
      segment('v-form', [['flaeche', 'Fläche'], ['balken', 'Balken']], form, 'Form') +
      '<span class="rechts band-leg"><span>' + esc(uebersetze('Arbeitswert')) + ' <b>' + esc(eur(w.arbeitswert)) + '</b></span>' +
        '<span>' + esc(uebersetze('API-Gegenwert')) + ' <b>' + esc(usd(d.api_gegenwert_usd)) + '</b></span>' +
        '<span>' + esc(uebersetze('Mehrwert')) + ' <b>' + esc(eur(w.mehrwert)) + '</b></span></span></div>' +
    '<div class="chart">' + grafik + '</div>' +
    '<div class="sitzungs-punkte" aria-hidden="true">' + punkte.map((i) => '<span style="left:' + xPos(i).toFixed(2) + '%"></span>').join('') + '</div>' +
    '<div class="strom-achse">' + achse + '</div>' +
    '<button type="button" class="textknopf" data-aktion="v-tabelle" aria-expanded="' + vz.tabelleOffen + '">' + esc(uebersetze('Zahlen als Tabelle')) + (vz.tabelleOffen ? ' ▾' : ' ▸') + '</button>' +
    (vz.tabelleOffen ? '<div class="tabelle-huelle"><table class="tabelle"><thead><tr><th scope="col">' + esc(uebersetze('Zeitraum')) + '</th><th scope="col" class="z">USD</th></tr></thead><tbody>' + reihe.map((r) => '<tr><td>' + esc(marke(r)) + '</td><td class="z">' + nf2.format(r.cost_usd) + '</td></tr>').join('') + '</tbody></table></div>' : '') +
  '</div>';
}

function rechenweg(d, w) {
  const alle = detailModus() === 'alle';
  const man = manH(d);
  const n = Number(d.manuell_eintraege) || 0;
  const z = (label, unter, wert, klasse) => '<div class="rw-zeile"><span>' + esc(uebersetze(label)) + (unter ? '<span class="faint">' + unter + '</span>' : '') + '</span>' +
    '<span class="mono' + (klasse ? ' ' + klasse : '') + '">' + wert + '</span></div>';
  const karte = (titel, kopf, zeilen, farbe) => '<div class="karte weit rechenweg"><div class="rw-kopf"><span class="label">' + esc(uebersetze(titel)) + '</span>' +
    '<b class="mono"' + (farbe ? ' style="color:' + farbe + '"' : '') + '>' + kopf + '</b></div>' + zeilen.join('') + '</div>';
  // Der Satz enthaelt den Rabatt schon; der Grundsatz steht zum Nachvollziehen dabei.
  const rabatt = d.rabatt_prozent > 0 ? ' (' + nf2.format(d.stundensatz_standard) + ' − ' + nf1.format(d.rabatt_prozent) + ' % ' + uebersetze('Rabatt') + ')' : '';
  // Mockup Z. 2102: Claude, manuell, abrechenbar. Manuelle Eintraege werden je Eintrag
  // aufwaerts gerundet (zehn 1-Min-Eintraege ergeben bei 5-Min-Schritt 50 Min).
  const manUnter = !alle ? uebersetze('ausgeblendet · Schalter oben: „mit manueller Zeit“')
    : n ? n + ' ' + uebersetze(n === 1 ? 'Eintrag aus der Zeiterfassung' : 'Einträge aus der Zeiterfassung') + ' · ' + uebersetze('je Eintrag aufgerundet')
      : uebersetze('keine Einträge — in der Zeiterfassung buchen');
  const zeit = [
    z('Aktive Zeit · Claude', esc(uebersetze('Zeitmodell') + ': ' + zmName(d.zeitmodell)), esc(hrs(d.active_hours))),
    z('Manuelle Zeit', '<a href="#/zeit">' + esc(manUnter) + '</a>', esc(hrs(man))),
    z('Abrechenbare Zeit', esc(uebersetze(alle ? 'Claude aktiv + manuell, Überlappung bereinigt' : 'nur Claude aktiv')), '<b>' + esc(hrs(d.active_hours + man)) + '</b>'),
    z('Agentenzeit', esc(uebersetze('nicht abgerechnet')), esc(hrs(d.agent_hours)), 'faint'),
  ];
  if (d.lokal_stunden > 0) zeit.push(z('Lokale Rechenzeit', esc(uebersetze('Strom und Abschreibung')), esc(hrs(d.lokal_stunden))));
  if (w.vergleich_stunden != null) zeit.push(z('Vergleichsaufwand', esc(uebersetze('klassische Entwicklung ohne KI, Schätzung')), esc(hrs(w.vergleich_stunden)), 'faint'));
  // Mockup Z. 2102: Blocker fuer diesen Vorgang im Kalender reservieren (Termin-Dialog der Zeiterfassung).
  zeit.push('<div class="rw-zeile"><span></span><button type="button" class="knopf klein akzent-rand" data-aktion="z-reservieren" data-wert="' + esc(d.ticket) + '">' +
    esc(uebersetze('+ Zeit reservieren')) + '</button></div>');
  const geld = [
    // Rechenweg der Claude-Zeit: Stunden x Satz. Manuelle Zeit traegt ihren eigenen Satz je Eintrag.
    z('Arbeitswert', esc(hrs(d.active_hours) + ' × ' + nf2.format(d.stundensatz) + ' EUR/h' + rabatt), esc(eur(d.arbeitswert_claude ?? w.arbeitswert))),
  ];
  if (alle && man > 0) geld.push(z('Arbeitswert manuell', esc(hrs(man) + ' · ' + uebersetze('Satz je Eintrag aus der Zeiterfassung')), esc(eur(d.arbeitswert_manuell || 0))));
  geld.push(z('API-Gegenwert', esc(usd(d.api_gegenwert_usd) + ' × ' + nf2.format(w.kurs)), esc(eur(w.api_gegenwert))));
  if (d.lokal_tokens) geld.push(z('Lokale Modelle', esc(kurz(d.lokal_tokens) + ' Tokens × ' + eur(d.lokal_eur_pro_mio) + '/Mio.'), esc(eur(d.lokal_betrag_eur))));
  geld.push(z('Gegenwert gesamt', '', esc(eur(w.gegenwert))));
  geld.push(z('Rechnungsbetrag', d.abgerechnet ? '<a href="#/rechnungen">' + esc(d.abgerechnet.nummern.join(', ')) + ' ↗</a>' : esc(uebersetze('noch nicht abgerechnet')),
    w.erloes_ist_rechnung ? esc(eur(w.rechnungsbetrag)) : '–'));
  geld.push(z('Mehrwert', esc(uebersetze('Gegenwert − Rechnung')), esc(eur(w.mehrwert))));
  const farbe = margeFarbe(w.marge_prozent, w.zielmarge_prozent);
  const marge = [
    z('Zielmarge', esc(uebersetze('angestrebt')), w.zielmarge_prozent == null ? '–' : nf1.format(w.zielmarge_prozent) + ' %', 'faint'),
    z('Erlös', esc(uebersetze(w.erloes_ist_rechnung ? 'gestellte Rechnung' : 'Arbeitswert, noch nicht abgerechnet')), esc(eur(w.erloes))),
    z('Abo-Anteil', esc(uebersetze('Sachkosten, anteilig aus dem Abo')), '− ' + esc(eur(w.eigene_kosten))),
  ];
  if (w.lokal_kosten) marge.push(z('Lokale Rechenzeit', esc(hrs(w.lokal_stunden) + ' · ' + uebersetze('Strom und Abschreibung')), '− ' + esc(eur(w.lokal_kosten))));
  marge.push(z('Deckungsbeitrag', esc(uebersetze('Erlös − Sachkosten')),
    w.deckungsbeitrag == null ? esc(uebersetze('kein Erlös')) : esc(eur(w.deckungsbeitrag)) + (w.deckungsbeitrag_prozent != null ? ' (' + nf1.format(w.deckungsbeitrag_prozent) + ' %)' : '')));
  marge.push(z('Eigene Zeit', esc(hrs(w.eigene_stunden ?? d.active_hours) + ' × ' + (w.selbstkosten_stunde > 0 ? eur(w.selbstkosten_stunde) : '?') + ' ' + uebersetze('Selbstkosten')),
    w.zeitkosten == null ? '–' : '− ' + esc(eur(w.zeitkosten))));
  marge.push(z('Marge', esc(uebersetze('nach Sachkosten und eigener Zeit')),
    w.marge == null ? esc(uebersetze('Selbstkostensatz fehlt — ohne ihn gibt es keine Marge.')) : '<span style="color:' + farbe + '">' + esc(eur(w.marge)) + '</span>'));
  return '<div class="raster rechenweg-raster">' +
    karte('Zeit', esc(hrs(d.active_hours + man)), zeit) +
    karte('Geld', esc(eur(w.gegenwert)), geld) +
    karte('Marge', w.marge_prozent == null ? '–' : nf1.format(w.marge_prozent) + ' %', marge, w.marge_prozent == null ? null : farbe) +
  '</div>';
}

function tokenTabelle(d) {
  const T = d.token_arten;
  const summe = T.tokens || 1;
  const zeile = (z) => '<tr><td><span class="leg-p" style="background:' + ART_FARBE[z.art] + '"></span>' + esc(uebersetze(ART_NAME[z.art])) + '</td>' +
    '<td class="z">' + num(z.tokens) + '</td>' +
    '<td class="z"><span class="anteil"><span class="band duenn" aria-hidden="true"><span style="width:' + Math.max(1.5, z.tokens / summe * 100).toFixed(1) + '%;background:' + ART_FARBE[z.art] + '"></span></span>' +
      nf1.format(z.tokens / summe * 100) + ' %</span></td><td class="z">' + nf2.format(z.usd) + '</td></tr>';
  const abw = Math.abs(T.abweichung_usd) >= 0.01
    ? '<tr class="faint"><td>' + esc(uebersetze('Abweichung zur erfassten Summe')) + ' <span title="' + esc(uebersetze('Preis seit der Erfassung geändert oder Modell ohne Preis')) + '">ⓘ</span></td><td></td><td></td>' +
      '<td class="z">' + (T.abweichung_usd > 0 ? '+' : '') + nf2.format(T.abweichung_usd) + '</td></tr>' : '';
  return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Tokens im Detail')) + '</h2><span class="hinweis">' + esc(uebersetze('Betrag je Zeile aus den Modellpreisen')) + '</span></div>' +
    '<div class="tabelle-huelle"><table class="tabelle"><thead><tr><th scope="col">' + esc(uebersetze('Art')) + '</th><th scope="col" class="z">Tokens</th><th scope="col" class="z">' +
      esc(uebersetze('Anteil')) + '</th><th scope="col" class="z">USD</th></tr></thead><tbody>' + T.zeilen.map(zeile).join('') + abw + '</tbody>' +
      '<tfoot><tr><th scope="row">' + esc(uebersetze('Gesamt')) + '</th><td class="z">' + num(T.tokens) + '</td><td class="z">100 %</td><td class="z">' + nf2.format(T.erfasst_usd) + '</td></tr>' +
      '<tr class="faint"><td>' + esc(uebersetze('davon Werkzeug-Tokens')) + ' <span class="unter">' + esc(uebersetze('zusätzlich, siehe Werkzeuge')) + '</span></td><td class="z">' +
        num(d.werkzeug_tokens) + '</td><td class="z">–</td><td class="z">–</td></tr></tfoot></table></div></div>';
}

function modellKarte(d) {
  const M = d.models || [];
  const summe = M.reduce((a, m) => a + m.cost_usd, 0) || 1;
  return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(uebersetze('Modelle im Vorgang')) + '</h2><span class="hinweis">' + esc(uebersetze('Anteil am API-Gegenwert')) + '</span></div>' +
    '<div class="modell-liste">' + M.map((m, i) => '<div><div class="m-kopf"><span class="leg-p" style="background:' + modellFarbe(i) + '"></span><b class="mono">' + esc(kurzModell(m.model)) + '</b>' +
      (m.preis_art ? ' <span class="pille warn">' + esc(uebersetze(m.preis_art === 'ohne' ? 'ohne Preis' : 'Preis geschätzt')) + '</span>' : '') +
      '<span class="mono rechts">' + nf2.format(m.cost_usd) + ' USD</span></div>' +
      '<span class="band duenn" aria-hidden="true"><span style="width:' + (m.cost_usd / summe * 100).toFixed(1) + '%;background:' + modellFarbe(i) + '"></span></span>' +
      '<div class="m-fuss faint"><span>' + num(m.requests) + ' ' + esc(uebersetze('Requests')) + '</span><span>' + kurz(m.total_tokens) + ' Tokens</span><span>' +
        nf1.format(m.cost_usd / summe * 100) + ' %</span></div></div>').join('') + '</div></div>';
}

function sitzungsTabelle(d) {
  const S = d.sitzungen;
  const start = (ts) => {
    if (!ts) return '–';
    const t = new Date(ts);
    return Number.isFinite(t.getTime()) ? t.toLocaleString(istDE() ? 'de-DE' : 'en-US', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
  };
  // Manuelle Eintraege als eigene Zeilenart (Taetigkeit statt Modell), nur "mit manueller Zeit".
  const M = detailModus() === 'alle' ? (d.manuelle_eintraege || []) : [];
  const zeilen = S.map((s) => [s.start, '<tr><td class="mono">' + esc(start(s.start)) + '</td>' +
      '<td class="z">' + hrs(s.active_seconds / 3600) + '</td><td class="z faint">' + hrs(s.agent_seconds / 3600) + '</td>' +
      '<td class="mono ell" title="' + esc(s.branch || '') + '">' + esc(s.branch || '–') + '</td>' +
      '<td class="mono">' + esc(s.modelle.map(kurzModell).join(', ') || '–') + '</td>' +
      '<td class="z">' + kurz(s.tokens) + '</td><td class="z">' + nf2.format(s.cost_usd) + '</td>' +
      '<td><span class="pille">' + esc(zmName(s.zeitmodell)) + '</span></td>' +
      '<td>' + (s.subagent ? '<span class="pille">' + esc(uebersetze('Subagent')) + '</span> ' : '') +
        (s.web_suchen ? '<span class="pille">' + num(s.web_suchen) + ' Web</span>' : '') + '</td>' +
      '<td>' + (zSitzWahl(s.session_id, s.wahl, false) || '<span class="faint">–</span>') + '</td></tr>'])
    .concat(M.map((e) => [e.start, '<tr class="manuell-zeile"><td class="mono">' + esc(start(e.start)) + '</td>' +
      '<td class="z">' + hrs(e.gezaehlt_min / 60) + '</td><td class="z faint">–</td>' +
      '<td class="ell" title="' + esc(e.notiz || '') + '"><a href="#/zeit">' + esc(uebersetze('Zeiterfassung')) + '</a>' + (e.notiz ? ' <span class="faint">' + esc(e.notiz) + '</span>' : '') + '</td>' +
      '<td>' + esc(e.taetigkeit) + '</td><td class="z faint">–</td><td class="z faint">–</td>' +
      '<td><span class="pille man">' + esc(uebersetze('manuell')) + '</span></td>' +
      '<td>' + (e.status === 'abgerechnet' ? '<span class="pille">' + esc(uebersetze('gesperrt') + (e.rechnung_nr ? ' · ' + e.rechnung_nr : '')) + '</span>'
        : !e.abrechenbar ? '<span class="pille">' + esc(uebersetze('nicht abrechenbar')) + '</span>' : '') + '</td>' +
      '<td class="faint">' + (e.kulanz_min ? esc(uebersetze('Kulanz') + ' ' + e.kulanz_min + ' Min') : e.abzug_min ? esc('−' + e.abzug_min + ' Min') : e.parallel_min ? esc('∥ +' + e.parallel_min + ' Min') : '–') + '</td></tr>']))
    .sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || '')));
  return '<div class="karte weit"><div class="karten-kopf"><h2 class="titel-klein">' + esc(anzahl(S.length, 'Sitzung', 'Sitzungen')) +
      (M.length ? ' · ' + esc(anzahl(M.length, 'Eintrag', 'Einträge')) : '') + '</h2>' +
      '<span class="hinweis">' + esc(uebersetze('älteste zuerst · Zeitmodell je Sitzung änderbar in Live')) + '</span></div>' +
    '<div class="tabelle-huelle"><table class="tabelle"><thead><tr>' +
      ['Start', 'Aktiv', 'Agent', 'Branch', 'Modell', 'Tokens', 'USD', 'Zeitmodell', 'Marken', 'Bei Überlappung'].map((h, i) => '<th scope="col"' + ([1, 2, 5, 6].includes(i) ? ' class="z"' : '') + '>' + esc(uebersetze(h)) + '</th>').join('') +
    '</tr></thead><tbody>' + zeilen.map((z) => z[1]).join('') +
    '</tbody></table></div></div>';
}

function zeichneDetail(w, key) {
  ladeVorgang(key);
  const D = vz.detail;
  const zurueck = '<a class="knopf klein" href="#/vorgaenge">' + esc(uebersetze('Zurück zu den Vorgängen')) + '</a>';
  if (!D.d) {
    w.innerHTML = D.fehler
      ? (/404/.test(D.fehler)
        ? leer('liste', 'Vorgang nicht gefunden', 'Der Schlüssel taucht in keiner erfassten Sitzung auf.', zurueck)
        : leer('liste', 'Vorgang konnte nicht geladen werden', D.fehler,
          '<button type="button" class="knopf klein" data-aktion="v-neu">' + esc(uebersetze('Erneut versuchen')) + '</button> ' + zurueck))
      : '<div class="leer">' + esc(uebersetze('Vorgang lädt …')) + '</div>';
    return;
  }
  const d = D.d;
  const wert = detailWert(d);
  w.innerHTML = '<div class="detail">' + kopfKarte(d) +
    '<div class="raster detail-drei">' + gaugeKarte(wert) + wasserfallKarte(wert) + tokenRingKarte(d) + '</div>' +
    verlaufKarte(d, wert) + rechenweg(d, wert) +
    '<div class="raster detail-tokens">' + tokenTabelle(d) + modellKarte(d) + '</div>' +
    sitzungsTabelle(d) + '</div>';
}

aktion('v-kopieren', async () => {
  const pfad = vz.detail.d && vz.detail.d.cwd;
  if (!pfad) return;
  try {
    await navigator.clipboard.writeText(pfad);
    vz.kopiert = true;
    zeichneAnsicht();
    setTimeout(() => { vz.kopiert = false; if (route().name === 'vorgaenge') zeichneAnsicht(); }, 1600);
  } catch (e) {
    toast(uebersetze('Kopieren nicht möglich') + ': ' + (e.message || e), 'err');
  }
});
aktion('v-neu', () => { vz.detail.fehler = null; zeichneAnsicht(); });
aktion('v-modus', (m) => { merke('detail.modus', m); zeichneAnsicht(); });
aktion('v-koernung', (k) => { merke('detail.koernung', k); zeichneAnsicht(); });
aktion('v-form', (f) => { merke('detail.form', f); zeichneAnsicht(); });
aktion('v-tabelle', () => { vz.tabelleOffen = !vz.tabelleOffen; merke('detail.tabelle', vz.tabelleOffen ? '1' : '0'); zeichneAnsicht(); });

registriere('vorgaenge', {
  zeichne(w, teile) {
    if (teile && teile[0]) zeichneDetail(w, teile[0]);
    else zeichneTabelle(w);
  },
});
