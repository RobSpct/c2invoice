'use strict';
/* Rahmen der Oberflaeche: Seitenleiste mit Navigation, Zeitraum und
   Mini-Live, Kopfzeile mit Suche (⌘K) und Hinweisen, Laden und Anzeigen der
   Seiten. Die Seiten selbst stehen in eigenen Dateien und melden sich mit
   registriere() an. */

Object.assign(EN, {
  'Ungültige Serverantwort': 'Invalid server response',
  'Keine vollständige Antwort vom Server.': 'No complete answer from the server.',
  'Cira antwortet noch — gleich nochmal.': 'Cira is still answering — try again in a moment.',
  'Ersatzmodell, Rolle ohne eigenes Modell': 'fallback model, role has no model of its own',
  'Rolle': 'Role',
  'Schnell': 'Quick',
  'Denken': 'Reasoning',
  'übernimmt': 'is taking over',
  'eskaliert': 'escalated',
  'An Claude geben': 'Hand to Claude',
  'Diese Frage hätte eine andere Rolle gebraucht': 'This question needed a different role',
  'falsch zugeordnet': 'misrouted',
  'als falsch zugeordnet markiert': 'marked as misrouted',
  'Markiert — die Liste steht unter Einstellungen → Cira.': 'Marked — the list is under Settings → Cira.',
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
  'Angebot öffnen': 'Open quote', 'Vorgang öffnen': 'Open job', 'von': 'of',
  'Budget überschritten': 'Budget exceeded', 'Budget aufgebraucht': 'Budget used up', 'Budget zu 80 % verbraucht': 'Budget 80 % used', 'Neue Sitzungen werden nicht erfasst.': 'New sessions are not being recorded.',
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
  // Shell v2 (Masterplan 3.0, C1)
  'Assistent': 'Assistant', 'Arbeit': 'Work', 'Auswertung': 'Analysis', 'Finanzen': 'Finances', 'Verbrauch': 'Usage',
  'Sitzungen': 'Sessions', 'Briefings': 'Briefings', 'Board': 'Board', 'Postfach': 'Inbox', 'Flows': 'Flows',
  'Gedächtnis': 'Memory', 'Annahme-Links': 'Acceptance links', 'Wiederkehrend': 'Recurring', 'Steuer-Paket': 'Tax package',
  'Claude Code · jede Sitzung bucht auf einen Vorgang': 'Claude Code · every session books onto a job',
  'Laufende Claude-Sitzungen': 'Running Claude sessions', 'Timer, Nachträge, Kalender': 'Timer, entries, calendar',
  'Berichte aus dem Vault · Cira fasst zusammen und liest vor': 'Reports from the vault · Cira summarises and reads aloud',
  'Aufgaben aus TODO.md · mit Zeit und Wert aus c2invoice': 'Tasks from TODO.md · with time and value from c2invoice',
  'Budget, Status und Rechenweg je Vorgang': 'Budget, status and calculation per job',
  'Mail, Slack und Telegram · landet am Kunden und am Vorgang': 'Mail, Slack and Telegram · filed with customer and job',
  'Automatisierungen ohne Code · Auslöser, Bedingung, Aktion': 'Automations without code · trigger, condition, action',
  'Vault als Graph · Notizen, Links und ihr Bezug zum Ledger': 'Vault as a graph · notes, links and their ledger context',
  'Skills, Agents, Commands, Plugins, Mods und MCPs je Arbeitsbereich': 'Skills, agents, commands, plugins, mods and MCPs per workspace',
  'Umsatz, Marge, offene Posten': 'Revenue, margin, open items', 'Token, Kosten und Arbeitszeit je Projekt': 'Tokens, cost and working time per project',
  'Pipeline': 'Pipeline', 'Angebot raus, Kunde klickt an, Vorgang entsteht': 'Quote out, customer accepts, job is created',
  'Tabelle · Kanban · Serien': 'Table · Kanban · Series', 'Wartung, Hosting, Retainer · Rechnungen laufen über einen Flow': 'Maintenance, hosting, retainers · invoices run through a flow',
  'Quartalsweise alles für die Kanzlei, ein Klick': 'Everything for the accountant per quarter, one click',
  'Kunden und Akten': 'Customers and records', 'Stammdaten, Sätze, Hinweise': 'Master data, rates, notifications',
  'Dieser Bereich kommt mit Block {b} des Ausbaus.': 'This area arrives with block {b} of the build-out.',
  'Guten Morgen': 'Good morning', 'Hallo': 'Hello', 'Guten Abend': 'Good evening', 'bereit': 'ready', 'live': 'live',
  'Tag': 'Day', 'Vormon.': 'Prev. mo.', 'mit Vorperiode vergleichen': 'compare with previous period',
  '5-h-Block': '5-h block', '≈ aus Ledger': '≈ from ledger', 'Fenster endet': 'window ends', 'kein laufendes Fenster': 'no running window',
  'verbunden': 'connected', 'aus': 'off', 'angemeldet': 'signed in', 'nicht angemeldet': 'not signed in',
  'keine Anmeldung gefunden': 'no sign-in found', 'bereit · kein Modell geladen': 'ready · no model loaded', 'läuft': 'running',
  'noch kein Abgleich': 'no sync yet',
  // Cira-Dock (C2)
  'Bereit': 'Ready', 'Spricht': 'Speaking', 'Hört zu': 'Listening', 'Denkt nach': 'Thinking', 'Chat offen': 'chat open',
  'Sieht mit': 'Sees', 'Davor warst du in': 'Before that you were in',
  'noch nichts · Cira merkt sich die letzten drei Bereiche, in denen du warst': 'nothing yet · Cira remembers the last three areas you visited',
  'Ich sehe mit, was du gerade offen hast:': 'I can see what you have open:', 'Frag einfach, du musst nichts heraussuchen.': 'Just ask, no need to look anything up.',
  'Frag Cira zu': 'Ask Cira about', 'Senden': 'Send', 'Dock schließen': 'Close dock', 'Cockpit öffnen': 'Open cockpit',
  'Keine Antwort vom Server.': 'No answer from the server.', 'Frage an Cira': 'Question for Cira', 'Vorschläge': 'Suggestions',
  'kostenlos': 'free', 'diesem Bereich': 'this area', 'ausgewählt': 'selected',
});

// Linien-Icons 16×16, Strich 1.4 — Pfade 1:1 aus dem Handoff (Mockup `ICO`).
const ICON = {
  cockpit: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
  sitzungen: 'M2.5 3.5h11v9h-11zM5 7l2 1.5L5 10M8.5 10.5h2.5',
  live: 'M1.5 8h3l1.5-4 3 8 1.5-4h3',
  zeit: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11M8 5v3.2l2.2 1.4',
  briefings: 'M3.5 2.5h7l2 2v9h-9zM5.5 7h5M5.5 9.5h5M5.5 12h3',
  board: 'M2.5 3h3v10h-3zM6.5 3h3v6h-3zM10.5 3h3v8h-3z',
  vorgaenge: 'M3 4h10M3 8h10M3 12h6M12 11l1.5 1.5L16 10',
  postfach: 'M1.5 3.5h13v9h-13zM1.5 3.5l6.5 5 6.5-5',
  strecke: 'M2.5 3.5h7a2 2 0 0 1 0 4h-7M4.5 1.5l-2 2 2 2M6.5 12.5h7a2 2 0 0 0 0-4h-2M11.5 14.5l2-2-2-2',
  wiederkehrend: 'M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5M8 5.5v2.8l1.8 1.2',
  steuer: 'M3.5 2.5h9v11h-9zM5.5 5h5M5.5 7.5h5M5.5 10h2M9.5 10h1',
  flows: 'M1.5 3h3v3h-3zM11.5 1.5h3v3h-3zM11.5 9.5h3v3h-3zM4.5 4.5h2c1.5 0 1.5-1.5 3-1.5h2M6.5 4.5c1.5 0 1.5 6.5 3 6.5h2',
  gedaechtnis: 'M4 4.5a1.5 1.5 0 1 0 0.01 0M12 3.5a1.5 1.5 0 1 0 0.01 0M8 9a1.5 1.5 0 1 0 0.01 0M4 12.5a1.5 1.5 0 1 0 0.01 0M12 12a1.5 1.5 0 1 0 0.01 0M5.3 5.3l1.6 2.6M10.8 4.6L9 7.8M7 10.3l-2 1.3M9.3 9.8l1.6 1.4',
  werkzeuge: 'M10.5 2.5a3 3 0 0 0-2.8 4.1L2.5 11.8l1.7 1.7 5.2-5.2a3 3 0 0 0 4.1-2.8l-1.8 1.8-1.7-.4-.4-1.7z',
  hub: 'M2.5 13.5h11M4 11V8M7 11V5M10 11V7M13 11V3',
  analyse: 'M8 2.5a5.5 5.5 0 1 0 5.5 5.5H8z M10 1.8v4.2h4.2a4.2 4.2 0 0 0-4.2-4.2',
  angebote: 'M3.5 2.5h9v11h-9zM6 6h4M6 8.5h4M6 11h2',
  rechnungen: 'M3.5 1.5h9v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1zM6 5.5h4M6 8h4M6 10.5h2.5',
  kontakte: 'M6 7a2.5 2.5 0 1 0 0-5a2.5 2.5 0 1 0 0 5M1.5 13.5c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M11 3.2a2.2 2.2 0 0 1 0 4M12.5 9.8c1 .6 1.7 1.9 2 3.7',
};
const svgIcon = (k) => '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (ICON[k] || '') + '"/></svg>';
const ZAHNRAD = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

// Navigation der Shell v2 (Handoff §4.1): vier Gruppen, Einstellungen am
// Zahnrad oben. `block`: der Bereich kommt mit diesem Block des Masterplans
// 3.0, bis dahin zeigt er einen Leerzustand. `u`: Untertitel im Kopf
// (Mockup `titles`, generisch gefasst — keine Beispielnamen im Code).
const SEITEN = [
  { k: 'cockpit', l: 'Cira', gruppe: 'Assistent' },
  { k: 'sitzungen', l: 'Sitzungen', u: 'Claude Code · jede Sitzung bucht auf einen Vorgang' },
  { k: 'live', l: 'Live', u: 'Laufende Claude-Sitzungen' },
  { k: 'zeit', l: 'Zeiterfassung', u: 'Timer, Nachträge, Kalender' },
  { k: 'briefings', l: 'Briefings', u: 'Berichte aus dem Vault · Cira fasst zusammen' },
  { k: 'board', l: 'Board', gruppe: 'Arbeit', u: 'Aufgaben aus TODO.md · mit Zeit und Wert aus c2invoice' },
  { k: 'vorgaenge', l: 'Vorgänge', u: 'Budget, Status und Rechenweg je Vorgang' },
  { k: 'postfach', l: 'Postfach', block: 'C15', u: 'Mail, Slack und Telegram · landet am Kunden und am Vorgang' },
  { k: 'flows', l: 'Flows', block: 'C11', u: 'Automatisierungen ohne Code · Auslöser, Bedingung, Aktion' },
  { k: 'gedaechtnis', l: 'Gedächtnis', u: 'Vault als Graph · Notizen, Links und ihr Bezug zum Ledger' },
  { k: 'werkzeuge', l: 'Werkzeuge', u: 'Skills, Agents, Commands, Plugins, Mods und MCPs je Arbeitsbereich' },
  { k: 'hub', l: 'Finanzen', gruppe: 'Auswertung', u: 'Umsatz, Marge, offene Posten' },
  { k: 'analyse', l: 'Verbrauch', u: 'Token, Kosten und Arbeitszeit je Projekt' },
  { k: 'angebote', l: 'Angebote', gruppe: 'Abrechnung', u: 'Pipeline' },
  { k: 'strecke', l: 'Annahme-Links', block: 'C14', u: 'Angebot raus, Kunde klickt an, Vorgang entsteht' },
  { k: 'rechnungen', l: 'Rechnungen', u: 'Tabelle · Kanban · Serien' },
  { k: 'wiederkehrend', l: 'Wiederkehrend', block: 'C13', u: 'Wartung, Hosting, Retainer · Rechnungen laufen über einen Flow' },
  { k: 'steuer', l: 'Steuer-Paket', block: 'C16', u: 'Quartalsweise alles für die Kanzlei, ein Klick' },
  { k: 'kontakte', l: 'Kontakte', u: 'Kunden und Akten' },
];
const EINSTELLUNGEN_SEITE = { k: 'einstellungen', l: 'Einstellungen', u: 'Stammdaten, Sätze, Hinweise' };
const seiteVon = (k) => SEITEN.find((s) => s.k === k) || (k === EINSTELLUNGEN_SEITE.k ? EINSTELLUNGEN_SEITE : null);
const seitenName = (s) => (s.k === 'cockpit' ? CIRA_NAME : uebersetze(s.l));
// Der Zeitraum filtert nur hier (Handoff §4.1.3); sonst bleibt der Block
// unsichtbar stehen, damit die Leiste nicht springt.
const MIT_ZEITRAUM = ['hub', 'analyse', 'live', 'zeit', 'vorgaenge', 'angebote', 'rechnungen'];

// Bereiche aus spaeteren Bloecken: bis dahin ein ehrlicher Leerzustand statt
// eines Mockups. Der Block meldet sich spaeter mit eigenem registriere() an.
for (const s of SEITEN.filter((x) => x.block)) {
  registriere(s.k, {
    zeichne(w) {
      w.innerHTML = leer('liste', seitenName(s), fuelle('Dieser Bereich kommt mit Block {b} des Ausbaus.', { b: s.block }));
    },
  });
}

// Untertitel des Cockpits: Begruessung nach Tageszeit (Handoff §4.2).
function begruessung(jetzt = new Date()) {
  const h = jetzt.getHours();
  const gruss = uebersetze(h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : 'Guten Abend');
  const tag = jetzt.toLocaleDateString(istDE() ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  return gruss + '. ' + tag;
}

const ZEITRAUM_LABEL = {
  heute: 'Tag', woche: 'Woche', monat: 'Monat', letzter: 'Vormon.',
  quartal: 'Quartal', jahr: 'Jahr', gesamt: 'Gesamt', frei: 'Frei…',
};

// Der Schalter fuer einen spaeteren Pro-Schnitt (R16): 2.0 ist frei fuer alle,
// deshalb immer an. Sperrkarten und Pro-Pillen bleiben im Code und erscheinen
// nur, wenn er aus ist — mit Lizenz hiesse das wieder
// !!(state.summary && state.summary.pro && state.summary.pro.aktiv).
// Noch nicht gebaute Pro-Funktionen (Zeiterfassung, Kanban, Mahnen, Versand,
// Budget) erscheinen bei offenem Schalter gar nicht.
const proAktiv = () => true;
// Seiten ohne die noch nicht gebauten Pro-Seiten.
const geplantSichtbar = () => !!(state.summary && state.summary.config && state.summary.config.geplanteBereiche === true);
const sichtbareSeiten = () => navSeiten(SEITEN, geplantSichtbar()).filter((s) => !(s.pro && proAktiv()));

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
    const navVorher = sichtbareSeiten().length;
    state.summary = jetzt;
    if (sichtbareSeiten().length !== navVorher) zeichneLeiste();
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
  // Badges der Navigation (Shell v2): ein Fehler laesst den alten Stand stehen.
  pruefeKopplung(false);
  const zl = hole('/api/zaehler').then((z) => { state.zaehler = z; zeigeSitzungenZaehler(); }).catch((e) => console.error('/api/zaehler:', e.message));
  try {
    state.live = await hole('/api/live?minutes=60');
    state.fehler.live = false;
  } catch { state.fehler.live = true; }
  await Promise.all([hw, zl]);
  if (state.glockeOffen) zeichneGlocke();
  zeichneMiniLive();
  zeichneMiniTimer();
  zeichneKopf();
  const a = ANSICHTEN[route().name];
  if (a && a.live) a.live();
}

// Dienst-Status im Kopf. Seltener als Live: jede Pruefung darf bis 4 s dauern.
async function ladeDienste() {
  try {
    state.dienste = (await hole('/api/dienste')).dienste;
  } catch (e) { console.error('/api/dienste:', e.message); return; }
  const el = document.getElementById('dienste');
  if (el) el.innerHTML = diensteHtml();
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
// Laufende Claude-Sitzungen: vom Server (/api/zaehler), eine Quelle fuer
// Badge und Cira-Karte. Bis zur ersten Antwort aus dem Live-Stand.
function liveSitzungen() {
  if (state.zaehler && Number.isInteger(state.zaehler.live)) return state.zaehler.live;
  if (!state.live) return 0;
  return new Set(state.live.sessions.filter((s) => istAktiv(s.last_ts)).map((s) => s.session_id)).size;
}
// Laufende Sitzungen (eigene Prozesse und fremde mit Ereignis in 2 Min, C5).
const offeneSitzungen = () => (state.zaehler && Number.isInteger(state.zaehler.sitzungen) ? state.zaehler.sitzungen : 0);
// Ungelesene Briefings (C9a), gleiche Quelle /api/zaehler.
const ungeleseneBriefings = () => (state.zaehler && Number.isInteger(state.zaehler.briefings) ? state.zaehler.briefings : 0);
function zeigeSitzungenZaehler() {
  const z = document.getElementById('nav-sitzungen');
  if (z) { z.textContent = String(offeneSitzungen()); z.hidden = !offeneSitzungen(); }
  const b = document.getElementById('nav-briefings');
  if (b) { b.textContent = String(ungeleseneBriefings()); b.hidden = !ungeleseneBriefings(); }
}
const LOGO = '<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--panel-2)"/><rect x="7" y="17" width="4" height="9" fill="var(--accent)"/><rect x="14" y="11" width="4" height="15" fill="var(--accent)"/><rect x="21" y="6" width="4" height="20" fill="var(--accent)"/></svg>';

function zeichneLeiste() {
  const r = route().name;
  const einst = uebersetze('Einstellungen');
  let html = '<div class="leiste-kopf">' + LOGO + '<span class="marke nur-breit">c2invoice</span>' +
    '<a class="zahnrad" href="#/einstellungen" title="' + esc(einst) + '" aria-label="' + esc(einst) + '"' + (r === 'einstellungen' ? ' aria-current="page"' : '') + '>' + ZAHNRAD + '</a>' +
  '</div><nav class="nav" aria-label="' + esc(uebersetze('Hauptnavigation')) + '">';
  let erste = true;
  for (const s of sichtbareSeiten()) {
    if (s.gruppe) {
      html += '<div class="gruppe nur-breit">' + esc(uebersetze(s.gruppe)) + '</div>' + (erste ? '' : '<div class="trenner nur-schmal"></div>');
      erste = false;
    }
    const extra = s.k === 'live' ? '<span class="zaehler ok nur-breit" id="nav-live"' + (liveSitzungen() ? '' : ' hidden') + '>' + liveSitzungen() + '</span>'
      : s.k === 'sitzungen' ? '<span class="zaehler laeuft nur-breit" id="nav-sitzungen"' + (offeneSitzungen() ? '' : ' hidden') + '>' + offeneSitzungen() + '</span>'
      : s.k === 'briefings' ? '<span class="zaehler nur-breit" id="nav-briefings"' + (ungeleseneBriefings() ? '' : ' hidden') + '>' + ungeleseneBriefings() + '</span>'
      : s.k === 'zeit' ? '<span class="zaehler laeuft nur-breit" id="nav-zeit"' + (state.live && state.live.timer ? '' : ' hidden') + '>' + esc(uebersetze('läuft')) + '</span>'
        : s.pro && !proAktiv() ? '<span class="pille pro">Pro</span>' : '';
    html += '<a href="#/' + s.k + '" title="' + esc(seitenName(s)) + '"' + (r === s.k ? ' aria-current="page"' : '') + '>' +
      svgIcon(s.k) + '<span class="name nur-breit">' + esc(seitenName(s)) + '</span>' + extra + '</a>';
  }
  html += '</nav>' +
    '<div class="zeitraum-wahl nur-breit" id="zeitraum-wahl"></div>' +
    '<div class="mini-timer" id="mini-timer" hidden></div>' +
    // Cira-Karte (Handoff §4.1.4). Zeile 1 oeffnet und schliesst das Dock (§5.6).
    '<div class="cira-karte">' +
      '<button type="button" class="cira-kopf" data-aktion="dock" aria-expanded="' + cira.dockOffen + '" aria-controls="dock" title="' + esc(CIRA_NAME + ' · Strg+Leertaste') + '">' +
        '<cira-orb class="orb-mini" scale="1.2" mode="' + cira.modus + '" state="auto" aria-hidden="true"></cira-orb>' +
        '<span class="wer nur-breit"><b>' + esc(CIRA_NAME) + '</b>' +
          (cira.dockOffen ? '<span>' + esc(uebersetze('Chat offen')) + '</span>' : '<span data-cira-modus>' + esc(uebersetze(CIRA_MODI[cira.modus])) + '</span>') + '</span>' +
        '<span class="taste nur-breit" aria-hidden="true">Strg+␣</span></button>' +
      '<a class="mini-live nur-breit" id="mini-live" href="#/live"></a>' +
    '</div>';
  document.getElementById('leiste').innerHTML = html;
  ciraModus();
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
  // Die Timer-Kachel im Cockpit folgt demselben Stand.
  if (typeof zeichneTimerKachel === 'function') zeichneTimerKachel();
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
  const aus = !MIT_ZEITRAUM.includes(route().name);
  el.classList.toggle('aus', aus);
  el.setAttribute('aria-hidden', String(aus));
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
      '<span class="spur"></span>' + esc(uebersetze('mit Vorperiode vergleichen')) + '</button>';
}

// Zeile 2 der Cira-Karte: laufende Sitzungen, Verbrauchsrate, Mini-Strom
// (Tokens der letzten 20 Minuten aus /api/live) und der 5-h-Block.
function zeichneMiniLive() {
  const el = document.getElementById('mini-live');
  if (!el) return;
  const n = liveSitzungen();
  const L = state.live;
  const m = L && L.minuten ? L.minuten.slice(-20) : [];
  const max = Math.max(...m, 1);
  el.classList.toggle('ruhe', n === 0);
  el.title = uebersetze('Zur Live-Ansicht');
  const b = L && L.block5h;
  let block = '';
  if (b) {
    const p = Math.max(0, b.anteil * 100);
    const farbe = p > 95 ? 'var(--bad)' : p > 80 ? 'var(--accent)' : 'var(--warn)';
    const titel = uebersetze('≈ aus Ledger') + ' · ' + num(b.tokens) + ' / ' + num(b.limit) + ' Tokens' +
      (b.ende ? ' · ' + uebersetze('Fenster endet') + ' ' + new Date(b.ende).toLocaleTimeString(istDE() ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ' · ' + uebersetze('kein laufendes Fenster'));
    block = '<div class="block5h" title="' + esc(titel) + '"><span>' + esc(uebersetze('5-h-Block')) + '</span>' +
      '<span class="spur"><span style="width:' + Math.min(100, p).toFixed(0) + '%;background:' + farbe + '"></span></span>' +
      '<span class="wert" style="color:' + farbe.replace('--accent)', '--accent-text)') + '">' + nf0.format(p) + ' %</span></div>';
  }
  el.innerHTML = '<div class="oben"><span class="puls"></span><span>' + esc(n + ' ' + uebersetze('live')) + '</span>' +
      '<span class="rate">' + (L ? nf2.format(L.burn_usd_per_hour) : '–') + '<small>USD/h</small></span></div>' +
    '<div class="strom-mini" aria-hidden="true">' +
      m.map((v, i) => '<span style="height:' + Math.max(8, v / max * 100).toFixed(0) + '%;opacity:' + (0.35 + 0.65 * i / Math.max(1, m.length - 1)).toFixed(2) + '"></span>').join('') +
    '</div>' + block;
  const z = document.getElementById('nav-live');
  if (z) { z.textContent = String(n); z.hidden = !n; }
}

/* ---------- Kopfzeile ---------- */
// Dienst-Status (Handoff §4.2): Punkt + Name, Detail im Tooltip. Der Zustand
// steht zusaetzlich als Text fuer Screenreader — nicht nur ueber die Farbe.
function diensteHtml() {
  return (state.dienste || []).map((d) => '<span class="dienst" title="' + esc(d.name + ': ' + uebersetze(d.detail)) + '">' +
    '<span class="punkt' + (d.ok ? '' : ' aus') + '" aria-hidden="true"></span><span class="dienst-name">' + esc(d.name) + '</span>' +
    '<span class="nur-sr"> ' + esc(uebersetze(d.ok ? 'verbunden' : 'aus')) + '</span></span>').join('');
}
const uhrzeit = () => new Date().toLocaleTimeString(istDE() ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });

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
  const seite = seiteVon(r);
  const ingest = state.summary && state.summary.lastIngest;
  const vs = verbindungsStatus();
  const n = hinweise().length;
  document.title = zTitel(document.title);
  const unter = !seite ? '' : seite.k === 'cockpit' ? begruessung() : uebersetze(seite.u || '');
  el.innerHTML =
    '<div class="titel"><h1>' + esc(seite ? seitenName(seite) : uebersetze('Finanzen')) + '</h1>' +
      (unter ? '<span class="unter">' + esc(unter) + '</span>' : '') +
    '</div>' +
    '<div class="rechts">' +
      '<span class="dienste" id="dienste">' + diensteHtml() + '</span>' +
      '<span class="abgleich" title="' + esc(uebersetze(vs.text) + (vs.detail ? ': ' + vs.detail : '')) + '"><span class="punkt' + (vs.stufe === 'ok' ? '' : ' fehler') + '"></span>' +
        '<span>' + esc(uebersetze('Abgleich')) + ' ' + esc(ingest && ingest.at ? vor(ingest.at) : '–') + '</span></span>' +
      '<button type="button" class="knopf" data-aktion="abgleich">' + esc(uebersetze('Abgleich')) + '</button>' +
      '<button type="button" class="suche-knopf" data-aktion="suche" title="' + esc(uebersetze('Suchen oder Befehl ausführen')) + '">' +
        '<span class="lupe"></span><span class="text">' + esc(uebersetze('Suchen oder Befehl …')) + '</span><span class="taste">⌘K</span></button>' +
      '<button type="button" class="glocke" data-aktion="glocke" aria-expanded="' + !!state.glockeOffen + '" aria-label="' + esc(uebersetze('Hinweise')) + '">' +
        '<span aria-hidden="true" style="display:flex;flex-direction:column;align-items:center"><span style="width:11px;height:10px;border:1.5px solid currentColor;border-bottom:0;border-radius:6px 6px 1px 1px"></span><span style="width:15px;height:1.5px;background:currentColor;border-radius:1px"></span><span style="width:4px;height:2px;margin-top:1px;background:currentColor;border-radius:0 0 3px 3px"></span></span>' +
        (n ? '<span class="zahl">' + n + '</span>' : '') +
      '</button>' +
      '<span class="uhr mono" id="kopf-uhr">' + esc(uhrzeit()) + '</span>' +
    '</div>';
}

function zeichneBanner() {
  const el = document.getElementById('banner');
  if (state.codeSprung) {
    // Knopf statt nur Strg+R: im VS-Code-Browser greift die Taste nicht sicher.
    el.innerHTML = esc(uebersetze('Seit dem Öffnen dieser Seite gibt es eine neue Version. ') +
      uebersetze('Bitte neu laden, sonst passen Oberfläche und Server nicht zusammen.')) +
      ' <button type="button" class="knopf klein" data-aktion="neu-laden">' + esc(uebersetze('Neu laden')) + '</button>';
    el.hidden = false;
  } else if (state.kopplung === false) {
    el.innerHTML = esc(uebersetze('Nur lesen: Dieses Gerät ist nicht gekoppelt.')) + ' <button type="button" class="knopf klein" data-aktion="koppeln">' + esc(uebersetze('Gerät koppeln')) + '</button>';
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
  // Budget je Vorgang: 80 % und 100 % aus allen Budgets, nicht nur dem Zeitraum.
  // Das Budget steht im Schluessel — wer es erhoeht, bekommt den Hinweis beim
  // naechsten Erreichen wieder, statt dass ein altes „erledigt“ ihn verschluckt.
  for (const b of (state.summary && state.summary.budgets) || []) {
    if (!b.hinweis) continue;
    liste.push({
      id: 'budget:' + b.vorgang + ':' + b.hinweis + ':' + b.budget_eur, heute: b.hinweis === 100, icon: '€', c: b.hinweis === 100 ? 'var(--bad)' : 'var(--accent)',
      t: b.vorgang + ' · ' + uebersetze(b.stufe === 'bad' ? 'Budget überschritten' : b.hinweis === 100 ? 'Budget aufgebraucht' : 'Budget zu 80 % verbraucht'),
      s: num(b.prozent) + ' % · ' + eur(b.verbraucht_eur) + ' ' + uebersetze('von') + ' ' + eur(b.budget_eur), wann: '', aktion: 'Vorgang öffnen', ziel: 'vorgaenge/' + encodeURIComponent(b.vorgang),
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
      const se = sichtbareSeiten().concat(EINSTELLUNGEN_SEITE).filter((s) => passt(seitenName(s), s.l)).slice(0, 4).map((s) => ({
        icon: '→', t: seitenName(s), sub: uebersetze('Seite'), meta: '', tu: () => geheZu(s.k),
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
      '<span class="ic"' + (r.befehl ? ' style="color:var(--accent-text)"' : '') + '>' + esc(r.icon) + '</span>' +
      '<span class="haupt-t"><b' + (r.mono ? ' class="mono"' : '') + '>' + esc(r.t) + '</b><span>' + esc(r.sub) + '</span></span>' +
      '<span class="meta"' + (r.befehl ? ' style="color:var(--accent-text)"' : '') + '>' + esc(r.meta) + '</span></button>';
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

/* ---------- Cira-Dock (Handoff README §5.6) ----------
   Panel rechts auf jedem Bereich. Fragen gehen mit Bereich und gewaehltem
   Objekt an /api/cira/frage; die Antwort kommt als NDJSON-Strom. Der Server
   haelt das Gespraech, hier steht nur die Anzeige. */
function kontextText() {
  const s = seiteVon(route().name);
  const name = s ? seitenName(s) : uebersetze('Finanzen');
  return cira.kontext && cira.kontext.titel ? name + ' · ' + cira.kontext.titel : name;
}
function oeffneDock(an = !cira.dockOffen) {
  // Auf dem Cockpit gibt es kein Dock (README §5.6): Strg+Leertaste fuehrt in dessen Eingabe.
  if (an && route().name === 'cockpit') { const q = document.getElementById('ck-q'); if (q) q.focus(); an = false; }
  cira.dockOffen = an;
  let el = document.getElementById('dock');
  if (an && !el) {
    el = document.createElement('aside');
    el.id = 'dock'; el.className = 'dock';
    el.setAttribute('aria-label', CIRA_NAME);
    document.body.appendChild(el);
  }
  if (el) el.hidden = !an;
  zeichneLeiste();
  if (!an) { const k = document.querySelector('.cira-kopf'); if (k && route().name !== 'cockpit') k.focus(); return; }
  zeichneDock();
  const q = document.getElementById('dock-q');
  if (q) q.focus();
  if (!cira.verlauf) {
    hole('/api/cira/verlauf?kanal=dock').then((r) => { if (!cira.verlauf) { cira.verlauf = r.verlauf; zeichneVerlauf(); } })
      .catch((e) => console.error('/api/cira/verlauf:', e.message));
  }
  ladeVorschlaege();
}
function zeichneDock() {
  const el = document.getElementById('dock');
  if (!el || el.hidden) return;
  el.innerHTML =
    '<div class="dock-kopf"><cira-orb class="orb-dock" mode="' + cira.modus + '" state="auto" aria-hidden="true"></cira-orb>' +
      '<span class="wer"><b>' + esc(CIRA_NAME) + '</b><span data-cira-modus>' + esc(uebersetze(CIRA_MODI[cira.modus])) + '</span></span>' +
      '<button type="button" class="knopf klein geist" data-aktion="dock-cockpit" title="' + esc(uebersetze('Cockpit öffnen')) + '">Cockpit ↗</button>' +
      '<button type="button" class="dock-x" data-aktion="dock" aria-label="' + esc(uebersetze('Dock schließen')) + '">×</button></div>' +
    '<div class="dock-zeile"><span>' + esc(uebersetze('Sieht mit')) + '</span><span class="kontext-pille"><span class="punkt" aria-hidden="true"></span><span id="dock-kontext"></span></span></div>' +
    '<div class="dock-zeile dock-spur" id="dock-spur"></div>' +
    '<div class="dock-verlauf" id="dock-verlauf" aria-live="polite"></div>' +
    '<div class="dock-fuss"><div class="vorschlaege" id="dock-vorschlaege" role="group" aria-label="' + esc(uebersetze('Vorschläge')) + '"></div>' +
      '<form class="dock-eingabe" id="dock-form">' +
        '<button type="button" class="dock-mikro" data-aktion="mikro" data-wert="dock" aria-pressed="false" aria-label="' + esc(uebersetze('Sprechen (Strg+Leertaste)')) + '" title="' + esc(uebersetze('Sprechen (Strg+Leertaste)')) + '" hidden><span class="punkt" aria-hidden="true"></span></button>' +
        '<button type="button" class="dock-mikro dock-stopp" data-aktion="vorlesen-stopp" aria-label="' + esc(uebersetze('Vorlesen stoppen')) + '" title="' + esc(uebersetze('Vorlesen stoppen')) + ' (Esc)" hidden><span class="quadrat" aria-hidden="true"></span></button>' +
        '<input id="dock-q" autocomplete="off" maxlength="2000" aria-label="' + esc(uebersetze('Frage an Cira')) + '">' +
        '<button type="submit" class="senden">' + esc(uebersetze('Senden')) + '</button></form></div>';
  el.querySelector('#dock-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('dock-q');
    const text = q.value.trim();
    if (!text) return;
    q.value = '';
    frageCira(text);
  });
  ciraModus();
  spracheKnoepfe();
  zeichneDockKontext();
  zeichneSpur();
  zeichneVerlauf();
  zeichneVorschlaege();
}
function zeichneDockKontext() {
  const el = document.getElementById('dock-kontext');
  if (!el) return;
  el.textContent = kontextText();
  const s = seiteVon(route().name);
  const q = document.getElementById('dock-q');
  if (q) q.placeholder = uebersetze('Frag Cira zu') + ' ' + (s ? seitenName(s) : uebersetze('diesem Bereich')) + ' …';
  const intro = document.getElementById('dock-intro');
  if (intro) intro.textContent = uebersetze('Ich sehe mit, was du gerade offen hast:') + ' ' + kontextText() + '. ' + uebersetze('Frag einfach, du musst nichts heraussuchen.');
}
function zeichneSpur() {
  const el = document.getElementById('dock-spur');
  if (!el) return;
  el.innerHTML = '<span>' + esc(uebersetze('Davor warst du in')) + '</span>' + (cira.spur.length
    ? cira.spur.map((k) => { const s = seiteVon(k); return s ? '<button type="button" class="spur-pille" data-aktion="gehe" data-wert="' + esc(k) + '">' + esc(seitenName(s)) + '</button>' : ''; }).join('')
    : '<span class="faint">' + esc(uebersetze('noch nichts · Cira merkt sich die letzten drei Bereiche, in denen du warst')) + '</span>');
}
// Lokale Antwort (Modell-Block): welche Rolle, warum, was davor scheiterte —
// dazu "An Claude geben" (nur Angebot, kostet) und "falsch zugeordnet".
const CIRA_ROLLE = { schnell: 'Schnell', text: 'Text', denken: 'Denken', code: 'Code' };
function ciraRouteHtml(m, klasse) {
  const r = m.route;
  const zeile = r && r.rolle ? '<span class="cira-route mono" title="' + esc(r.versuche && r.versuche.length ? r.versuche.map((v) => uebersetze(CIRA_ROLLE[v.rolle] || v.rolle) + ' · ' + v.modell + ': ' + v.ergebnis).join(' → ') : '') + '">' +
    esc(uebersetze('Rolle') + ' ' + uebersetze(CIRA_ROLLE[r.rolle] || r.rolle) + ' · ' + r.grund +
      (r.versuche && r.versuche.length > 1 ? ' · ' + uebersetze('eskaliert') : '') +
      (r.versuche && r.versuche.some((v) => v.ersatz && v.ergebnis && v.ergebnis.startsWith('ok')) ? ' · ' + uebersetze('Ersatzmodell, Rolle ohne eigenes Modell') : '')) + '</span>' : '';
  const knoepfe = (m.angebot ? '<button type="button" class="' + klasse + '" data-aktion="cira-angebot" data-wert="' + esc(m.angebot.frage) + '">' + esc(uebersetze(m.angebot.l)) + '</button>' : '') +
    (r && r.rolle && m.id && !m.falsch ? '<button type="button" class="' + klasse + '" data-aktion="cira-falsch" data-wert="' + esc(String(m.id)) + '" title="' + esc(uebersetze('Diese Frage hätte eine andere Rolle gebraucht')) + '">' + esc(uebersetze('falsch zugeordnet')) + '</button>' : '') +
    (m.falsch ? '<span class="faint">' + esc(uebersetze('als falsch zugeordnet markiert')) + '</span>' : '');
  return zeile + (knoepfe ? '<div class="cira-route-knoepfe">' + knoepfe + '</div>' : '');
}
function zeichneVerlauf() {
  const el = document.getElementById('dock-verlauf');
  if (!el) return;
  const blase = (m) => {
    const ich = m.rolle === 'ich';
    const meta = ich && m.gesprochen ? '<span class="meta mono">' + esc(uebersetze('gesprochen')) + '</span>' : !ich && m.stufe ? '<span class="meta mono">' + esc([m.stufe, m.quelle, m.kosten_eur ? eur(m.kosten_eur) : (m.laeuft ? '' : uebersetze('kostenlos'))].filter(Boolean).join(' · ')) + '</span>' : '';
    const spr = !ich && m.sprung && m.sprung.length ? '<div class="spruenge">' + m.sprung.map((x) =>
      '<button type="button" class="knopf klein geist" data-aktion="gehe" data-wert="' + esc(String(x.ziel || '').replace(/^#\/?/, '')) + '">' + esc(uebersetze(x.l)) + '</button>').join('') + '</div>' : '';
    const text = m.laeuft && !m.text ? (m.uebernimmt || uebersetze('Denkt nach')) + ' …' : m.text;
    return '<div class="nachricht' + (ich ? ' ich' : '') + (m.fehler ? ' fehler' : '') + '"><div class="blase">' + esc(text) + '</div>' + meta + (ich || m.laeuft ? '' : ciraRouteHtml(m, 'knopf klein geist')) + spr + '</div>';
  };
  el.innerHTML = '<div class="nachricht"><div class="blase" id="dock-intro"></div></div>' + (cira.verlauf || []).map(blase).join('');
  zeichneDockKontext();
  el.scrollTop = el.scrollHeight;
}
let vorschlaege = [];
async function ladeVorschlaege() {
  try { vorschlaege = (await hole('/api/cira/vorschlaege?screen=' + encodeURIComponent(route().name))).vorschlaege || []; } catch (e) { console.error('/api/cira/vorschlaege:', e.message); }
  zeichneVorschlaege();
}
function zeichneVorschlaege() {
  const el = document.getElementById('dock-vorschlaege');
  if (el) el.innerHTML = vorschlaege.map((v) => '<button type="button" class="spur-pille" data-aktion="cira-frage" data-wert="' + esc(v) + '">' + esc(uebersetze(v)) + '</button>').join('');
  // Die Vorschlagszeile aendert die Hoehe des Verlaufs: das Ende bleibt sichtbar.
  const v = document.getElementById('dock-verlauf');
  if (v) v.scrollTop = v.scrollHeight;
}
// Ein Gespraech je Kanal: das Dock haelt cira.verlauf, das Cockpit seinen
// eigenen (cockpit.js). liste() liefert die Nachrichten, zeichne() zeigt sie,
// danach(antwort) laeuft, wenn die Antwort fertig ist.
const DOCK_KANAL = { kanal: 'dock', liste: () => cira.verlauf || (cira.verlauf = []), zeichne: () => zeichneVerlauf(), danach: () => ladeVorschlaege() };
// Eine Frage: Zeilen des Stroms sofort zeigen, die letzte ersetzt alles.
// gesprochen: kam per Push-to-Talk (C10) — Marke im Verlauf, Antwort wird vorgelesen (E5).
async function frageCira(text, k = DOCK_KANAL, { gesprochen = false } = {}) {
  if (cira.laeuft) { toast(uebersetze('Cira antwortet noch — gleich nochmal.'), 'info'); return; }
  cira.laeuft = true;
  const jetzt = new Date().toISOString();
  const antwort = { rolle: 'cira', text: '', laeuft: true, zeit: jetzt };
  k.liste().push({ rolle: 'ich', text, zeit: jetzt, gesprochen }, antwort);
  k.zeichne();
  ciraModus('denkt');
  const kontext = { screen: route().name, art: cira.kontext ? cira.kontext.art : null, id: cira.kontext ? cira.kontext.id : null, titel: kontextText(), arbeitsbereich: lies('cockpit.arbeitsbereich', '') || null };
  try {
    const r = await fetch('/api/cira/frage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, kanal: k.kanal, kontext, gesprochen }) });
    if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || 'HTTP ' + r.status);
    const leser = r.body.getReader();
    const dec = new TextDecoder();
    let puffer = '';
    for (;;) {
      const { value, done } = await leser.read();
      if (done) break;
      puffer += dec.decode(value, { stream: true });
      let i;
      while ((i = puffer.indexOf('\n')) >= 0) {
        const roh = puffer.slice(0, i);
        puffer = puffer.slice(i + 1);
        let z;
        try { z = JSON.parse(roh); } catch { z = { typ: 'fehler', error: uebersetze('Ungültige Serverantwort') + ': ' + roh.slice(0, 80) }; }
        if (z.typ === 'stufe') antwort.stufe = z.stufe;
        // Zwischenstufe: welche Rolle mit welchem Modell gerade arbeitet (Eskalation sichtbar).
        else if (z.typ === 'rolle') {
          const rolle = String(z.rolle || '').replace(/^./, (c) => c.toUpperCase());
          antwort.stufe = 'T1 · ' + uebersetze(rolle) + ' (' + z.modell + ')';
          antwort.uebernimmt = uebersetze(rolle) + ' ' + uebersetze('übernimmt') + ' (' + z.modell + ')';
        }
        else if (z.typ === 'text') antwort.text += z.text;
        else if (z.typ === 'fertig') Object.assign(antwort, { id: z.id, text: z.antwort, stufe: z.stufe, quelle: z.quelle, kosten_eur: z.kosten_eur, sprung: z.sprung, szene: z.szene || null, zustand: z.zustand || null, route: z.route || null, angebot: z.angebot || null, vorlesen: z.vorlesen === true });
        // Die Zwischenstufe nennt ein Modell; nach einem Fehler hat es nicht geantwortet.
        else if (z.typ === 'fehler') Object.assign(antwort, { text: z.error || uebersetze('Fehler'), fehler: true, stufe: '' });
        k.zeichne();
      }
    }
  } catch (e) {
    Object.assign(antwort, { text: uebersetze('Keine Antwort vom Server.') + ' ' + e.message, fehler: true, stufe: '' });
  } finally {
    if (!antwort.id && !antwort.fehler) Object.assign(antwort, { text: (antwort.text ? antwort.text + ' — ' : '') + uebersetze('Keine vollständige Antwort vom Server.'), fehler: true, stufe: '' });
    antwort.laeuft = false;
    cira.laeuft = false;
    k.zeichne();
    // Vorlesen (C10): die Antwort spricht genau einmal, die Orbs zeigen den Pegel.
    // Sonst spricht der Orb sie stumm mit (Huellkurve aus dem Text), danach ruht er.
    if (!antwort.fehler && sprache.sollVorlesen(gesprochen, antwort.vorlesen)) sprich(antwort.text);
    else {
      const orbs = [...document.querySelectorAll('cira-orb')];
      const ms = !antwort.fehler && orbs.length ? Math.max(...orbs.map((o) => (typeof o.speak === 'function' ? o.speak(antwort.text) || 0 : 0))) : 0;
      cira.modus = ms ? 'spricht' : 'ruht';
      ciraModus();
      if (ms) setTimeout(() => { if (!cira.laeuft && !sprache.aktiv()) ciraModus('ruht'); }, ms);
    }
    k.danach(antwort);
  }
}
aktion('dock', () => oeffneDock());
aktion('dock-cockpit', () => { oeffneDock(false); geheZu('cockpit'); });
aktion('cira-frage', (text) => frageCira(text));
// Das Angebot fragt im selben Kanal nach, in dem es steht (Dock oder Cockpit).
aktion('cira-angebot', (frage, el) => frageCira(frage, el && el.closest('#ck-verlauf') && typeof ckKanal !== 'undefined' ? ckKanal : DOCK_KANAL));
aktion('cira-falsch', async (id, el) => {
  try {
    await sende('/api/cira/nachricht/' + encodeURIComponent(id) + '/falsch', {});
    for (const l of [cira.verlauf || [], (typeof ck !== 'undefined' && ck.verlauf) || []]) for (const m of l) if (String(m.id) === String(id)) m.falsch = true;
    toast(uebersetze('Markiert — die Liste steht unter Einstellungen → Cira.'), 'ok');
    zeichneVerlauf();
    if (el && el.closest('#ck-verlauf') && typeof zeichneCkVerlauf === 'function') zeichneCkVerlauf();
  } catch (err) { toast(err.message, 'err'); }
});

// Nicht stoeren (Einstellungen -> Cira): in diesem Fenster ist der Orb gedimmt.
let ciraZeiten = { ab: '', bis: '' };
function nichtStoerenJetzt() {
  const { ab, bis } = ciraZeiten;
  const d = new Date();
  const jetzt = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return !!(ab && bis) && (ab <= bis ? jetzt >= ab && jetzt < bis : jetzt >= ab || jetzt < bis);
}
function pruefeNacht() {
  const nacht = nichtStoerenJetzt();
  if (nacht !== cira.nacht) { cira.nacht = nacht; ciraModus(); }
}
async function ladeCira() {
  try {
    const r = await hole('/api/cira/einstellungen');
    if (r.name && r.name !== CIRA_NAME) { CIRA_NAME = r.name; zeichneLeiste(); }
    ciraZeiten = { ab: r.cira.nichtStoerenAb || '', bis: r.cira.nichtStoerenBis || '', desktop: r.cira.benachrichtigungDesktop === true };
    pruefeNacht();
  } catch (e) { console.error('/api/cira/einstellungen:', e.message); }
}

/* ---------- Benachrichtigung (README §5.7, C4) ---------- */
// Neue Freigabe: Karte oben rechts, ausser das Cockpit ist offen und sichtbar
// (dort steht sie schon unter „Braucht dich“). Liegt der Tab im Hintergrund und
// ist es eingeschaltet, zusaetzlich eine Desktop-Benachrichtigung — nie im
// Nicht-stoeren-Fenster.
const MELDE_ART = { flow_fehler: 'Flow-Fehler', sitzung_frage: 'Rückfrage', rechnung: 'Rechnungsentwurf', mahnung: 'Mahnung', mail: 'Mail', jira_kommentar: 'Jira-Kommentar', plan_schritt: 'Plan-Schritt', serie: 'Rechnungsserie', sitzung_wartet: 'Rückfrage im Terminal', vault_notiz: 'Vault-Notiz', monatsbericht: 'Monatsbericht' };
function benachrichtige(f) {
  if (!f || f.status !== 'offen' || !f.titel) return;
  const art = uebersetze(MELDE_ART[f.art] || f.art);
  if (document.hidden && ciraZeiten.desktop === true && typeof Notification !== 'undefined' && Notification.permission === 'granted' && !nichtStoerenJetzt()) {
    try {
      const n = new Notification(CIRA_NAME + ' · ' + art, { body: f.titel, tag: 'c2-freigabe-' + f.id });
      n.onclick = () => { window.focus(); geheZu(f.ziel || 'cockpit'); n.close(); };
    } catch (e) { console.error('Desktop-Benachrichtigung:', e.message); }
  }
  if (route().name === 'cockpit' && !document.hidden) return;
  let halter = document.getElementById('c2-melde');
  if (!halter) {
    halter = document.createElement('div');
    halter.id = 'c2-melde';
    halter.className = 'melde-halter';
    halter.setAttribute('role', 'status');
    halter.setAttribute('aria-live', 'polite');
    document.body.appendChild(halter);
  }
  // Hoechstens drei Karten; die aelteste geht.
  while (halter.children.length >= 3) halter.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'melde-karte' + (f.art === 'flow_fehler' ? ' fehler' : '');
  el.innerHTML = '<div class="kopf"><span class="art">' + esc(art) + '</span><span class="mono zeit">' + esc(new Date().toLocaleTimeString(istDE() ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })) + '</span>' +
    '<button type="button" class="zu" aria-label="' + esc(uebersetze('Meldung schließen')) + '">×</button></div>' +
    '<span class="t">' + esc(f.titel) + '</span>' + (f.bezug ? '<span class="s mono">' + esc(f.bezug) + '</span>' : '') +
    '<div class="knoepfe"><button type="button" class="ok" data-aktion="gehe" data-wert="' + esc(f.ziel || 'cockpit') + '">' + esc(uebersetze(f.knopf || 'In „Braucht dich“ ansehen')) + '</button></div>';
  el.querySelector('.zu').addEventListener('click', () => el.remove());
  // Erst nach der Klick-Delegation entfernen: die prueft wurzel.contains(el) und
  // ignorierte den Knopf einer schon entfernten Karte — er navigierte nie (Owner-Test 21.10.).
  el.querySelector('.ok').addEventListener('click', () => setTimeout(() => el.remove()));
  halter.appendChild(el);
}

// Ereignis-Strom (SSE). Faellt er aus, holt die 15-s-Schleife alles nach.
function verbindeEreignisse() {
  if (typeof EventSource === 'undefined') return;
  const es = new EventSource('/api/ereignisse');
  es.addEventListener('zaehler', (e) => {
    try { state.zaehler = { ...(state.zaehler || {}), ...JSON.parse(e.data).daten }; } catch { /* naechster Takt */ }
    zeigeSitzungenZaehler();
  });
  // Sitzungen (C5): die Seite hoert auf dieses Fenster-Ereignis.
  for (const art of ['sitzung', 'sitzung_beendet']) {
    es.addEventListener(art, (e) => {
      let d = null;
      try { d = JSON.parse(e.data).daten; } catch (err) { console.error('Ereignis ' + art + ' unlesbar:', err.message); return; }
      window.dispatchEvent(new CustomEvent('c2-sitzung', { detail: { art, ...d } }));
      // B1: eine Sitzung im eigenen Terminal fragt (Hook). Eigene Sitzungen melden sich als Freigabe.
      // Direkt zur Sitzung: die Meldung kommt auch auf dem Cockpit, wenn der Tab im Hintergrund lag (Owner-Test 21.10.).
      if (d && d.fremd && d.status === 'wartet') benachrichtige({ status: 'offen', art: 'sitzung_wartet', id: 's-' + d.id, titel: d.frage || uebersetze('Claude wartet auf dich'), ziel: 'sitzungen/' + encodeURIComponent(d.id), knopf: 'Zur Sitzung' });
    });
  }
  // Skill-Ablauf (C6b): das Cockpit laedt den gezeigten Ablauf nach.
  es.addEventListener('ablauf', (e) => {
    let d = null;
    try { d = JSON.parse(e.data).daten; } catch (err) { console.error('Ereignis ablauf unlesbar:', err.message); return; }
    window.dispatchEvent(new CustomEvent('c2-ablauf', { detail: d }));
  });
  // Board (C7a): ein Jira-Status hat sich geaendert.
  es.addEventListener('jira_status', () => window.dispatchEvent(new CustomEvent('c2-jira')));
  // Board-Abgleich im Hintergrund hat einen neuen Jira-Stand (Block L).
  es.addEventListener('jira_cache', () => window.dispatchEvent(new CustomEvent('c2-jira')));
  // Cira hat nachtraeglich geantwortet (C9c „Merke dir“): Verlauf neu laden.
  es.addEventListener('cira', (e) => {
    let d = null;
    try { d = JSON.parse(e.data).daten; } catch (err) { console.error('Ereignis cira unlesbar:', err.message); return; }
    if (!d) return;
    if (d.kanal === 'dock' && cira.verlauf && !cira.laeuft) hole('/api/cira/verlauf?kanal=dock').then((r) => { if (!cira.laeuft) { cira.verlauf = r.verlauf; zeichneVerlauf(); } }, (err) => console.error('/api/cira/verlauf:', err.message));
    window.dispatchEvent(new CustomEvent('c2-cira', { detail: d }));
  });
  // Ansichten mit Freigaben (Cockpit „Braucht dich“) hoeren auf dieses Fenster-Ereignis.
  es.addEventListener('freigabe', (e) => {
    let d = null;
    try { d = JSON.parse(e.data).daten; } catch (err) { console.error('Ereignis freigabe unlesbar:', err.message); }
    window.dispatchEvent(new CustomEvent('c2-freigabe', { detail: d }));
    benachrichtige(d);
  });
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

/* Theme (K2): system | dunkel | hell, je Browser. Beim Laden setzt es schon
   app/theme.js (vor dem Stylesheet); hier Umschalten, Systemwechsel, andere Tabs
   und theme-color. Ohne Browser-Speicher gilt die Wahl fuer die laufende Sitzung. */
const THEMES = ['system', 'dunkel', 'hell'];
const systemHell = window.matchMedia('(prefers-color-scheme: light)');
let themeSitzung = null;
function themeWahl() {
  const w = themeSitzung || lies('theme', 'system');
  return THEMES.includes(w) ? w : 'system';
}
function setzeTheme() {
  const w = themeWahl();
  const hell = w === 'hell' || (w === 'system' && systemHell.matches);
  document.documentElement.dataset.theme = hell ? 'light' : 'dark';
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}
systemHell.addEventListener('change', setzeTheme);
window.addEventListener('storage', (e) => { if (e.key === SPEICHER + 'theme') { themeSitzung = null; setzeTheme(); } });

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
aktion('abgleich', async (_, el) => {
  await mitLauf(el, async () => {
    try { await sende('/api/refresh', {}); } catch { /* Anzeige folgt ueber den Banner (ungekoppelt: Kopplungsdialog) */ }
    await Promise.all([ladeSummary(), ladeLive()]);
  });
});
aktion('neu-laden', () => location.reload());
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

/* ---------- Kiosk (K1): Cockpit ohne Leiste und Kopf, im Browser-Vollbild ----------
   Nicht gespeichert. Esc, Verlassen des Vollbilds oder ein Seitenwechsel beenden ihn. */
function kiosk(an) {
  document.getElementById('rahmen').classList.toggle('kiosk', an);
  const k = document.querySelector('[data-aktion="ck-vollbild"]');
  if (k) { k.setAttribute('aria-pressed', String(an)); k.textContent = uebersetze(an ? 'Vollbild beenden' : 'Vollbild'); }
  if (an && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    // Ohne Vollbild-Erlaubnis bleibt der Kiosk im Fenster; Esc beendet ihn trotzdem.
    document.documentElement.requestFullscreen().catch((e) => console.warn('Vollbild nicht erlaubt, Kiosk im Fenster:', e.message));
  }
  if (!an && document.fullscreenElement) document.exitFullscreen().catch((e) => console.error('Vollbild beenden:', e.message));
}
const imKiosk = () => document.getElementById('rahmen').classList.contains('kiosk');
aktion('ck-vollbild', () => kiosk(!imKiosk()));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && imKiosk()) kiosk(false); });
// Esc, den Palette, Dialog oder Glocke schon nutzen, schliesst erst diese, nicht den Kiosk.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && imKiosk() && !document.fullscreenElement && !e.defaultPrevented && !palette && !state.glockeOffen) kiosk(false);
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
  // Cira: Bereichswechsel loescht den Kontext und merkt den alten Bereich.
  if (neu) {
    if (gezeigt) cira.spur = [gezeigt].concat(cira.spur).filter((k, i, a) => k !== r.name && a.indexOf(k) === i).slice(0, 3);
    cira.kontext = null;
    // Die Farbe einer Szene (Marge, Ueberfaellig) gilt nur, solange sie offen ist.
    if (cira.zustand !== 'auto') { cira.zustand = 'auto'; ciraModus(); }
    // Das Cockpit fuellt den Bereich ohne Rand und ersetzt das Dock.
    document.getElementById('inhalt').classList.toggle('vollbild', ['cockpit', 'sitzungen', 'gedaechtnis', 'briefings'].includes(r.name));
    if (r.name !== 'cockpit') kiosk(false);
    if (r.name === 'cockpit' && cira.dockOffen) oeffneDock(false);
  }
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
  const s = seiteVon(r.name);
  document.title = zTitel((s ? seitenName(s) : uebersetze('Finanzen')) + ' · c2invoice');
  zeichneAnsicht(neu);
  if (cira.dockOffen) {
    zeichneDock();
    if (neu) ladeVorschlaege();
  }
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

Object.assign(EN, {
  'Nur lesen: Dieses Gerät ist nicht gekoppelt.': 'Read only: this device is not paired.', 'Gerät koppeln': 'Pair device',
  'Zum Schreiben muss dieser Browser einmal gekoppelt werden. Der Code erscheint als Fenster auf deinem Desktop, nicht hier im Browser.': 'To write, this browser must be paired once. The code appears as a window on your desktop, not here in the browser.',
  'Code anzeigen': 'Show code', 'Code vom Desktop (6 Ziffern, 2 Minuten gültig)': 'Code from the desktop (6 digits, valid for 2 minutes)', 'Name des Geräts': 'Device name',
  'Danach die Aktion noch einmal ausführen.': 'Then repeat the action.',
  'Gekoppelt, aber der Browser hat das Cookie nicht gespeichert. Cookies für diese Adresse erlauben und immer dieselbe Adresse (127.0.0.1) nutzen.': 'Paired, but the browser did not store the cookie. Allow cookies for this address and always use the same address (127.0.0.1).',
  'Koppeln': 'Pair', 'Neuen Code': 'New code', 'Kopplung nicht gestartet': 'Pairing not started', 'Gerät gekoppelt. Schreiben ist jetzt möglich.': 'Device paired. Writing is now possible.',
});
/* ---------- Geraetekopplung (S1) ----------
   Schreiben nur von gekoppelten Geraeten. Der Code erscheint als Fenster auf
   dem Desktop, nie hier: so kann ihn ein Programm, das nur Anfragen schickt,
   nicht abgreifen. */
function pruefeKopplung(nochmal = true) {
  return hole('/api/kopplung/status').then((s) => { state.kopplung = !!s.gekoppelt; zeichneBanner(); return state.kopplung; })
    .catch((e) => {
      console.error('Kopplungsstatus:', e.message);
      // Server startet gerade? Einmal nachfassen; danach haelt der 15-s-Takt den Stand.
      if (nochmal) setTimeout(() => pruefeKopplung(false), 3000);
      return null;
    });
}
let kopplungId = null;
function zeigeKopplung() {
  if (document.getElementById('kopplung-form')) return;
  const grund = dialog('<form id="kopplung-form" class="kopplung">' +
    '<div class="dialog-kopf"><h2>' + esc(uebersetze('Gerät koppeln')) + '</h2><button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<p>' + esc(uebersetze('Zum Schreiben muss dieser Browser einmal gekoppelt werden. Der Code erscheint als Fenster auf deinem Desktop, nicht hier im Browser.')) + ' ' + esc(uebersetze('Danach die Aktion noch einmal ausführen.')) + '</p>' +
    '<div id="kopplung-schritt"><button type="button" class="knopf primaer" data-aktion="kopplung-code" autofocus>' + esc(uebersetze('Code anzeigen')) + '</button></div>' +
    '</form>', 'Gerät koppeln', 440);
  grund.querySelector('#kopplung-form').addEventListener('submit', kopplungBestaetigen);
}
aktion('koppeln', () => zeigeKopplung());
aktion('kopplung-code', async (w, knopf) => {
  await mitLauf(knopf, async () => {
    try {
      const r = await sende('/api/kopplung/start', kopplungId ? { ersetzt: kopplungId } : {});
      kopplungId = r.kopplung;
      const s = document.getElementById('kopplung-schritt');
      if (!s) return;
      const name = (navigator.userAgentData && navigator.userAgentData.platform ? navigator.userAgentData.platform + ' · ' : '') + uebersetze('Browser');
      s.innerHTML = '<label for="kopplung-code">' + esc(uebersetze('Code vom Desktop (6 Ziffern, 2 Minuten gültig)')) + '</label>' +
        '<input class="eingabe mono" id="kopplung-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>' +
        '<label for="kopplung-name">' + esc(uebersetze('Name des Geräts')) + '</label><input class="eingabe" id="kopplung-name" maxlength="60" value="' + esc(name) + '">' +
        '<div class="knoepfe"><button type="submit" class="knopf primaer">' + esc(uebersetze('Koppeln')) + '</button>' +
        '<button type="button" class="knopf" data-aktion="kopplung-code">' + esc(uebersetze('Neuen Code')) + '</button></div>';
      document.getElementById('kopplung-code').focus();
    } catch (err) { toast(uebersetze('Kopplung nicht gestartet') + ': ' + err.message, 'err'); }
  });
});
async function kopplungBestaetigen(e) {
  e.preventDefault();
  const code = document.getElementById('kopplung-code');
  if (!code) return;
  await mitLauf(e.submitter, async () => {
    try {
      await sende('/api/kopplung/bestaetigen', { kopplung: kopplungId, code: code.value.trim(), name: (document.getElementById('kopplung-name') || {}).value || '' });
      kopplungId = null;
      // Gegenprobe: blockiert der Browser das Cookie (andere Adresse, Datenschutz), gilt die Kopplung nicht.
      if (await pruefeKopplung(false) !== true) {
        toast(uebersetze('Gekoppelt, aber der Browser hat das Cookie nicht gespeichert. Cookies für diese Adresse erlauben und immer dieselbe Adresse (127.0.0.1) nutzen.'), 'err');
        return;
      }
      schliesseDialog();
      toast(uebersetze('Gerät gekoppelt. Schreiben ist jetzt möglich.'));
      window.dispatchEvent(new CustomEvent('c2-gekoppelt'));
    } catch (err) {
      toast(err.message, 'err');
      const c = document.getElementById('kopplung-code');
      if (c) { c.value = ''; c.focus(); }
    }
  });
}

/* ---------- Start ---------- */
function start() {
  document.documentElement.lang = SPRACHE;
  setzeBewegung();
  setzeTheme();
  // Unter 1280 px klappt die Leiste auf 64 px ein (Handoff §4), sonst ist sie offen.
  const rahmen = document.getElementById('rahmen');
  const SCHMAL_UNTER = 1280;
  let schmalVorher = window.innerWidth < SCHMAL_UNTER;
  rahmen.classList.toggle('schmal', schmalVorher);
  window.addEventListener('resize', () => {
    const schmal = window.innerWidth < SCHMAL_UNTER;
    if (schmal !== schmalVorher) { schmalVorher = schmal; rahmen.classList.toggle('schmal', schmal); zeichneLeiste(); }
  });
  verdrahteAktionen(document.body);
  // Geraetekopplung (S1): jede Antwort "nicht gekoppelt" oeffnet den Dialog, gleich von welchem Aufruf.
  const echtesFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const r = await echtesFetch(...args);
    if (r.status === 401 && r.headers.get('x-c2invoice-kopplung')) { state.kopplung = false; zeichneBanner(); zeigeKopplung(); }
    return r;
  };
  pruefeKopplung();
  document.addEventListener('change', (e) => {
    if (e.target.id === 'frei-von' || e.target.id === 'frei-bis') {
      const von = document.getElementById('frei-von').value, bis = document.getElementById('frei-bis').value;
      if (von && bis) { state.frei = { von, bis }; merke('frei', state.frei); zeichneRahmen(); ladeSummary(); }
    }
  });
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (palette) schliessePalette(); else oeffnePalette(); }
    // C10 (E3): im Cockpit oder offenen Dock mit leerem Feld nimmt Strg+Leertaste auf, sonst wie bisher.
    else if (e.ctrlKey && !e.altKey && !e.metaKey && e.code === 'Space') { e.preventDefault(); if (!spracheTaste()) oeffneDock(); }
    // Esc stoppt zuerst Aufnahme oder Vorlesen, erst der naechste schliesst Glocke oder Dock.
    else if (e.key === 'Escape' && !e.defaultPrevented && !palette && !document.querySelector('.dialog-grund') && spracheAbbrechen()) e.preventDefault();
    else if (e.key === 'Escape' && state.glockeOffen) { state.glockeOffen = false; zeichneGlocke(); zeichneKopf(); }
    // Esc schliesst das Dock nur, wenn kein Dialog darueber liegt.
    else if (e.key === 'Escape' && cira.dockOffen && !palette && !document.querySelector('.dialog-grund')) oeffneDock(false);
  });
  window.addEventListener('hashchange', zeige);
  zeige();
  ladeSummary();
  ladeLive();
  ladeBelege();
  ladeDienste();
  setInterval(ladeDienste, 60000);
  ladeCira();
  verbindeEreignisse();
  setInterval(() => { const u = document.getElementById('kopf-uhr'); if (u) u.textContent = uhrzeit(); pruefeNacht(); }, 20000);
  setInterval(ladeLive, 15000);
  setInterval(ladeSummary, 60000);
  setInterval(ladeBelege, 120000);
}
