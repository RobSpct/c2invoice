'use strict';
/* Einstellungen (Block 4c): Unternavigation mit Suche, ein Abschnitt zur Zeit.
   Autosave (R12): Blur oder Enter schickt den ganzen Abschnitt an den
   bestehenden POST — die Server pruefen alles-oder-nichts. Scheitert es, steht
   der Fehler am Feld und die Eingabe bleibt. Grenzen (min/max/aus) kommen aus
   GET /api/einstellungen bzw. /api/stammdaten, der Server bleibt die Instanz.
   Keine Pro-Abschnitte (R16); nicht Gebautes erscheint nicht. */

Object.assign(EN, {
  'Stimme': 'Voice', 'Spracherkennung': 'Speech recognition', 'eingerichtet · lokal mit whisper · Pfade nur in config.json (sprache.stt)': 'set up · local with whisper · paths only in config.json (sprache.stt)',
  'Antworten vorlesen': 'Read answers aloud', 'Automatisch': 'Automatic', 'Immer': 'Always', 'Nie': 'Never',
  'automatisch = wenn du gesprochen hast oder beim Tagesbericht': 'automatic = when you spoke or for the daily report',
  'Browser · lokal': 'Browser · local', 'Der Text wird an ElevenLabs (USA) gesendet — auch Kundennamen und Beträge.': 'The text is sent to ElevenLabs (USA) — including customer names and amounts.',
  'Browser-Stimme': 'Browser voice', 'Stimme dieses Browsers · gilt nur auf diesem Gerät': 'Voice of this browser · this device only', 'Standard des Browsers': 'Browser default',
  'ElevenLabs-Stimme': 'ElevenLabs voice', 'ID einer Stimme deines Kontos · im Free-Plan nur die Standardstimmen, Voice-Library-Stimmen brauchen ein Abo · keine Stimme einer realen Person': 'ID of a voice in your account · free plan: default voices only, Voice Library voices need a subscription · no clone of a real person', 'Voice Library': 'Voice Library',
  'Modell kurze Antworten': 'Model for short answers', 'unter 400 Zeichen': 'under 400 characters', 'Modell Briefings': 'Model for briefings', 'ab 400 Zeichen': 'from 400 characters',
  'Monatslimit Zeichen': 'Monthly character limit', '1.000 bis 1.000.000 · dieser Monat bisher {n} Zeichen · danach Browser-Stimme': '1,000 to 1,000,000 · this month so far {n} characters · then browser voice',
  'Zeichen': 'characters', 'Probesatz sprechen': 'Speak test sentence', 'Letzter Versuch': 'Last attempt', 'Hallo, ich bin Cira. So klinge ich.': 'Hello, I am Cira. This is how I sound.',
  'Ungültige Serverantwort': 'Invalid server response',
  'Verbindung zum Server abgebrochen — ob das Modell vollständig geladen ist, zeigt „Liste aktualisieren“.': 'Connection to the server lost — "Refresh list" shows whether the model downloaded completely.',
  'Laufzeit nicht erkannt': 'Runtime not detected',
  'Modellordner nicht bestimmbar': 'Model folder cannot be determined',
  'Fremdes Repo auf HuggingFace — nur laden, wenn du der Quelle traust.': 'Third-party repo on HuggingFace — only download if you trust the source.',
  '— keins —': '— none —',
  'nicht verfügbar': 'not available',
  'Liste nicht geladen': 'List not loaded',
  'Modellserver nicht erreichbar': 'Model server unreachable',
  '{n} Modelle · {art}': '{n} models · {art}',
  'Ordner und Laden': 'Folder and download',
  'Lokale Modelle (T1)': 'Local models (T1)',
  'Liste aktualisieren': 'Refresh list',
  'Modell Schnell': 'Model Quick',
  'Modell Text': 'Model Text',
  'Modell Denken': 'Model Reasoning',
  'Modell Code': 'Model Code',
  'kurze Antworten aus den Zahlen · leer = nächstes eingestelltes Modell': 'short answers from the numbers · empty = next configured model',
  'Entwürfe, Mails, Umformulieren': 'drafts, emails, rewording',
  'Warum, Vergleich, Analyse · fängt ab, was die anderen abgeben': 'why, comparison, analysis · catches what the others hand off',
  'Skripte, Regex, Fehlermeldungen': 'scripts, regex, error messages',
  'Wörter Schnell': 'Words Quick',
  'Wörter Text': 'Words Text',
  'Wörter Denken': 'Words Reasoning',
  'Wörter Code': 'Words Code',
  'kommagetrennt, ergänzen die eingebauten Wörter': 'comma-separated, add to the built-in words',
  'z. B. n8n, Kalkulation': 'e.g. n8n, costing',
  'Eigene Wörter je Rolle und falsch zugeordnete Fragen': 'Own words per role and misrouted questions',
  'Zuletzt als „falsch zugeordnet“ markiert:': 'Recently marked as \"misrouted\":',
  'Noch nichts markiert.': 'Nothing marked yet.',
  'Gegenwert, Modellordner, Modelle laden': 'Equivalent value, model folder, download models',
  'Der Modellserver läuft nicht auf diesem Rechner — den Ordner legt dort sein Betreiber fest.': 'The model server does not run on this computer — its operator sets the folder there.',
  'Den Modellordner verwaltet dein Modellserver selbst (nicht Ollama) — dort in den Einstellungen ändern.': 'Your model server (not Ollama) manages its model folder — change it in its settings.',
  'Systemlaufwerk': 'System drive',
  'Modellordner ändern': 'Change model folder',
  'OLLAMA_MODELS für deinen Benutzer auf {p} setzen? Frei: {f}.': 'Set OLLAMA_MODELS for your user to {p}? Free: {f}.',
  'Das ist das Systemlaufwerk.': 'This is the system drive.',
  'Gilt nach einem Neustart von Ollama; vorhandene Modelle bleiben im alten Ordner.': 'Takes effect after restarting Ollama; existing models stay in the old folder.',
  'Ja, setzen': 'Yes, set',
  'Neuer Modellordner': 'New model folder',
  'Prüfen': 'Check',
  'Modellordner': 'Model folder',
  'Quelle: {q} · frei {f}': 'Source: {q} · free {f}',
  'Standard von Ollama': 'Ollama default',
  'Ändern': 'Change',
  'Modelle laden geht hier nur mit Ollama — LM Studio und andere laden in ihrer eigenen Oberfläche.': 'Downloading models works here only with Ollama — LM Studio and others download in their own app.',
  'Modelle laden: erst den Modellserver starten.': 'Download models: start the model server first.',
  'Modell laden': 'Download model',
  '{n} herunterladen nach {p}? Frei: {f}. Modelle brauchen oft mehrere GB.': 'Download {n} to {p}? Free: {f}. Models often need several GB.',
  'den Ordner des Modellservers': 'the folder of the model server',
  'Das ist das Systemlaufwerk — Ordner vorher ändern?': 'This is the system drive — change the folder first?',
  'Ja, laden': 'Yes, download',
  'Name aus der Ollama-Bibliothek oder hf.co/nutzer/repo:Q4_K_M': 'Name from the Ollama library or hf.co/user/repo:Q4_K_M',
  'Modellname': 'Model name',
  'Laden': 'Download',
  'Modellserver': 'Model server',
  'nicht eingerichtet (lokaleModelle in config.json)': 'not set up (lokaleModelle in config.json)',
  '{n} Modelle': '{n} models',
  'startet …': 'starting …',
  '{n} geladen': '{n} downloaded',
  'Gesetzt': 'Set',
  'Gilt nach einem Neustart von Ollama. Vorhandene Modelle bleiben im alten Ordner.': 'Takes effect after restarting Ollama. Existing models stay in the old folder.',
  'Einstellung suchen …': 'Search settings …', 'Treffer': 'Results', 'Nichts gefunden.': 'Nothing found.',
  'Allgemein': 'General', 'Zeitmodell und Ziel': 'Time model and target', 'Abrechnung': 'Billing',
  'Sätze & Kosten': 'Rates & costs', 'gelten, wenn Projekt oder Kunde nichts Eigenes haben': 'apply when project or customer have nothing of their own',
  'Stundensätze je Projekt': 'Hourly rates per project', 'Satz, Rabatt und Zeitmodell · auch in der Kontakt-Akte': 'Rate, discount and time model · also in the contact record',
  'Positionsvorlagen': 'Item templates', 'füllen eine Position im Beleg-Editor vor': 'prefill an item in the document editor',
  'Belege': 'Documents', 'Stammdaten': 'Master data', 'stehen auf jedem Beleg · Name und Anschrift sind Pflicht': 'appear on every document · name and address are required',
  'System': 'System', 'Darstellung': 'Appearance', 'Sprache, Theme und Bewegung': 'Language, theme and motion', 'Theme': 'Theme', 'Dunkel': 'Dark', 'Hell': 'Light', 'hell, dunkel oder wie das Betriebssystem': 'light, dark or as set by the operating system',
  'Termine aus Google, Outlook, Apple · nur lesen': 'Events from Google, Outlook, Apple · read-only', 'Kalender': 'Calendar',
  'Lokale Modelle': 'Local models', 'Gegenwert für Modelle ohne API-Preis': 'Equivalent value for models without an API price',
  'Daten & Export': 'Data & export', 'Export, Abgleich und Speicherort': 'Export, sync and storage location',
  'Änderungen speichern sofort': 'Changes save immediately',
  'Eigene Zeit: Fenster um deine Eingaben. Aktivität: Laufzeit des Agenten. Projekte, Vorgänge und Sitzungen können abweichen.':
    'Own time: window around your inputs. Activity: agent runtime. Projects, jobs and sessions can differ.',
  'nach Sachkosten und eigener Zeit · steuert die Margen-Ampel': 'after material costs and own time · drives the margin traffic light',
  'deine eigene Zeit als Kosten · Grundlage der Marge': 'your own time as cost · basis of the margin',
  'wird auf die aktive Zeit verteilt': 'spread over the active time', 'Lücke, ab der eine Sitzung als unterbrochen gilt': 'gap after which a session counts as interrupted',
  '0 schaltet die Kennzahl ab · höchstens 1,5': '0 switches the metric off · at most 1.5',
  'Erlaubt: {min} bis {max}': 'Allowed: {min} to {max}', 'oder {aus} zum Abschalten': 'or {aus} to switch off', 'Wert fehlt': 'Value missing',
  'Zeitmodell': 'Time model', 'Standard-Stundensatz': 'Default hourly rate', 'Selbstkostensatz je Stunde': 'Cost rate per hour',
  'Zielmarge in Prozent': 'Target margin in percent', 'Abo-Preis je Monat': 'Subscription price per month',
  'Umrechnungskurs USD zu EUR': 'Exchange rate USD to EUR', 'Pausenschwelle in Minuten': 'Pause threshold in minutes',
  'Vergleichsfaktor klassische Entwicklung': 'Comparison factor classic development',
  'Pauschale je Million Tokens (lokale Modelle)': 'Flat rate per million tokens (local models)',
  'Selbstkosten je Stunde lokaler Rechenzeit': 'Cost per hour of local compute', 'Zuordnungsfenster lokaler Modelle in Minuten': 'Assignment window of local models in minutes',
  'Name oder Firma': 'Name or company', 'Bank': 'Bank', 'IBAN': 'IBAN', 'BIC': 'BIC', 'E-Mail': 'E-mail', 'Telefon': 'Phone', 'Land': 'Country',
  'Kleinunternehmer nach Par. 19 UStG': 'Small business under § 19 UStG', 'Umsatzsteuersatz in Prozent': 'VAT rate in percent',
  'Zahlungsziel in Tagen': 'Payment term in days', 'Für Rechnungen fehlt noch': 'Still missing for invoices',
  'Kontaktstelle für die E-Rechnung': 'contact point for the e-invoice', 'zweistelliges Kürzel, z. B. DE': 'two-letter code, e.g. DE',
  'Belege ohne Umsatzsteuer, mit Hinweis': 'documents without VAT, with a note', 'für neue Rechnungen · gestellte behalten ihr Fälligkeitsdatum': 'for new invoices · issued ones keep their due date',
  'Bezeichnung': 'Description', 'Satz €/h': 'Rate €/h', 'leer = Projektsatz': 'empty = project rate', '+ Vorlage': '+ Template',
  'Vorlage entfernt': 'Template removed', 'Vorlage nicht entfernt': 'Template not removed', 'Vorlagen nicht geladen': 'Templates not loaded',
  'Noch keine Vorlage.': 'No template yet.',
  'Sprache': 'Language', 'Oberfläche; Belege bleiben deutsch': 'interface; documents stay German', 'Deutsch': 'German', 'Englisch': 'English',
  'Bewegung reduzieren': 'Reduce motion', 'keine Einblendungen und Zähl-Animationen': 'no fade-ins and counting animations',
  'CSV-Export': 'CSV export', 'Vorgänge mit Stunden, Arbeitswert und Kosten im gewählten Zeitraum': 'Jobs with hours, work value and cost in the chosen period',
  'CSV laden': 'Download CSV', 'Jira-Abgleich': 'Jira sync', 'Arbeitswert und Status der Vorgänge nach Jira schreiben': 'Write work value and status of jobs to Jira',
  'Jetzt abgleichen': 'Sync now', 'Jira-Abgleich gelaufen': 'Jira sync done', 'Jira-Abgleich fehlgeschlagen': 'Jira sync failed',
  'Jira ist in config.json nicht eingeschaltet.': 'Jira is not enabled in config.json.',
  'Datenbank': 'Database', 'Zugänge und Pfade nur in': 'Access data and paths only in',
  'Einstellungen nicht geladen': 'Settings not loaded', 'Stammdaten nicht geladen': 'Master data not loaded', 'von': 'from', 'bis': 'to',
  'an': 'on', 'aus': 'off', 'Antwort ohne Daten': 'Response without data',
  'Tätigkeitsarten & Rundung': 'Activities & rounding', 'für manuelle Zeit · eigener Satz optional': 'for manual time · own rate optional',
  'Satz, Rabatt, Zeitmodell und Rundung · auch in der Kontakt-Akte': 'Rate, discount, time model and rounding · also in the contact file',
  'Grundlage für Arbeitszeit heute und Workload': 'Basis for working time today and workload', 'Tagessoll in Stunden': 'Daily target in hours',
  'Standard-Rundung': 'Default rounding', 'für Projekte ohne eigene Rundung · die Rohzeit bleibt gespeichert': 'for projects without own rounding · raw time stays stored',
  'aktuell {n} Min (aus config.json)': 'currently {n} min (from config.json)', 'Tätigkeiten nicht geladen': 'Activities not loaded',
  'eigener Satz €/h': 'own rate €/h', 'Name': 'Name', 'Projektsatz': 'project rate', 'Wird verwendet und kann nicht gelöscht werden.': 'In use and cannot be deleted.',
  '+ Tätigkeit': '+ Activity', 'Leer = Projektsatz inkl. Rabatt. Begleiten zählt als Fokusarbeit.': 'Empty = project rate incl. discount. Accompanying counts as focus work.',
  'Tätigkeit entfernt': 'Activity removed', 'Tätigkeit nicht entfernt': 'Activity not removed',
  'Rundung manueller Zeit in Minuten': 'Rounding of manual time in minutes',
  'Startseite': 'Start page', 'öffnet ohne Adresse eines Bereichs': 'opens when the address names no area',
  'Token-Limit je 5-h-Fenster': 'Token limit per 5-h window',
  'Cira-Karte: Tokens, die du je 5-h-Fenster von Claude erwartest · deine Schätzung · 0 blendet aus':
    'Cira card: tokens you expect per 5-h Claude window · your estimate · 0 hides it',
  'Arbeitsbereiche': 'Workspaces', 'Ordner für Sitzungen, Board und Werkzeuge · Pfade nur in config.json': 'Folders for sessions, board and tools · paths only in config.json',
  'Arbeitsbereiche nicht geladen': 'Workspaces not loaded', 'Kürzel': 'Short', 'Farbe': 'Colour', 'Projekt': 'Project', 'Jira': 'Jira', 'Ordner': 'Folder',
  'kein Projekt': 'no project', 'Vault': 'Vault', 'Global': 'Global', 'Chat': 'Chat', 'erreichbar': 'reachable', 'nicht erreichbar': 'not reachable',
  'Ordner nur in config.json änderbar': 'Folder can only be changed in config.json',
  'Ordner, Art und neue Arbeitsbereiche nur in config.json — ein Ordner bestimmt, wo Claude Code arbeitet und schreibt.':
    'Folder, type and new workspaces only in config.json — a folder decides where Claude Code works and writes.',
  'Noch keine Arbeitsbereiche eingetragen, Sitzungen lassen sich deshalb nicht starten. Unten steht nur ein Vorschlag aus deinen Daten: zum Übernehmen in config.json unter "arbeitsbereiche" einfügen, Pfade prüfen, Server neu starten.':
    'No workspaces set up yet, so sessions cannot start. Below is only a suggestion from your data: to use it, paste it under "arbeitsbereiche" in config.json, check the paths, restart the server.',
  'Geräte': 'Devices', 'Gekoppelte Browser und Programme · nur sie dürfen schreiben': 'Paired browsers and programs · only they may write',
  'Schreiben (Freigaben, Sitzungen, Rechnungen, Einstellungen) geht nur von gekoppelten Geräten. Lesen bleibt frei, auch für Obsidian und Jarvis.': 'Writing (approvals, sessions, invoices, settings) only works from paired devices. Reading stays open, also for Obsidian and Jarvis.',
  'Dieses Gerät koppeln': 'Pair this device', 'Gerät': 'Device', 'Art': 'Type', 'Gekoppelt': 'Paired', 'Aktion': 'Action',
  'dieses Gerät': 'this device', 'Programm': 'Program', 'Browser': 'Browser', 'Entfernen': 'Remove', 'Noch kein Gerät gekoppelt.': 'No device paired yet.',
  'Geräte nicht geladen': 'Devices not loaded', 'Gerät entfernt': 'Device removed', 'Entfernen fehlgeschlagen': 'Removal failed',
  'Dieses Gerät entfernen? Danach kann dieser Browser erst nach erneutem Koppeln wieder schreiben.': 'Remove this device? This browser can only write again after pairing again.',
  // Cira (C2)
  'Assistent': 'Assistant', 'Antwortstufen, Claude-Limit, Nicht stören': 'Answer tiers, Claude limit, quiet hours',
  'Anrede': 'Form of address', 'wie Cira dich anspricht · leer = ohne Namen': 'how Cira addresses you · empty = no name',
  'Lokales Modell (T1)': 'Local model (T1)',
  'Name im Modellserver, z. B. llama3.2:3b · leer = Cira antwortet nur direkt oder über Claude': 'name in the model server, e.g. llama3.2:3b · empty = Cira answers directly or via Claude only',
  'Claude erlaubt (T2)': 'Claude allowed (T2)',
  'für Texte und Fragen, die die Zahlen allein nicht beantworten · läuft als Werkzeugbetrieb, nicht auf Kundenvorgänge': 'for texts and questions the numbers alone do not answer · booked as tool overhead, never onto customer jobs',
  'Claude-Modell': 'Claude model', 'Standard = was die Claude-CLI eingestellt hat': 'Default = whatever the Claude CLI is set to', 'Standard': 'Default',
  'Monatslimit Claude': 'Monthly Claude limit', '0,50 bis 500 EUR · dieser Monat bisher': '0.50 to 500 EUR · this month so far',
  'Nicht stören': 'Do not disturb', 'Nicht stören ab': 'Do not disturb from', 'Nicht stören bis': 'Do not disturb until',
  'in diesem Fenster ist der Orb gedimmt · beide leer = aus': 'the orb is dimmed during this window · both empty = off',
  'Bewegung reduzieren und Startseite: Darstellung. Pfad zur claude.exe nur in config.json.': 'Reduce motion and start page: Appearance. Path to claude.exe only in config.json.',
});

// Felder je Abschnitt; Grenzen und Label kommen vom Server.
const E_ABSCHNITTE = [
  { id: 'allgemein', l: 'Allgemein', g: '', sub: 'Zeitmodell und Ziel', felder: ['zeitmodell', 'tagessollStunden', 'zielmargeProzent', 'limit5hTokens'] },
  { id: 'saetze', l: 'Sätze & Kosten', g: 'Abrechnung', sub: 'gelten, wenn Projekt oder Kunde nichts Eigenes haben',
    felder: ['stundensatz', 'selbstkostenStunde', 'aboPreisMonat', 'usdToEur', 'gapMinutes', 'vergleichsFaktor'] },
  { id: 'projekte', l: 'Stundensätze je Projekt', g: '', sub: 'Satz, Rabatt, Zeitmodell und Rundung · auch in der Kontakt-Akte', kw: 'satz rabatt zeitmodell rundung projekt rate discount rounding' },
  // Rundung als Segment, nicht als Feld: speichern wie das Zeitmodell (e-rundung).
  { id: 'taet', l: 'Tätigkeitsarten & Rundung', g: '', sub: 'für manuelle Zeit · eigener Satz optional', kw: 'tätigkeit meeting konzept review rundung activity rounding' },
  { id: 'vorlagen', l: 'Positionsvorlagen', g: '', sub: 'füllen eine Position im Beleg-Editor vor', kw: 'vorlage position template' },
  { id: 'stammdaten', l: 'Stammdaten', g: 'Belege', sub: 'stehen auf jedem Beleg · Name und Anschrift sind Pflicht', stamm: true },
  // Cira (C2): Stufen T1/T2, Claude-Limit, Nicht stoeren. claude.exe nur in config.json.
  { id: 'cira', l: 'Cira', g: 'Assistent', sub: 'Antwortstufen, Claude-Limit, Nicht stören', kw: 'cira assistent ollama claude limit modell anrede nicht stören stimme sprache mikrofon vorlesen elevenlabs whisper assistant model quiet voice speech microphone' },
  { id: 'darstellung', l: 'Darstellung', g: 'System', sub: 'Sprache, Theme und Bewegung', kw: 'sprache englisch deutsch bewegung animation language motion theme hell dunkel light dark' },
  // Geraetekopplung (S1): nur gekoppelte Geraete schreiben.
  { id: 'geraete', l: 'Geräte', g: '', sub: 'Gekoppelte Browser und Programme · nur sie dürfen schreiben', kw: 'gerät geräte koppeln kopplung sicherheit browser device pairing security' },
  // Masterplan 3.0: Ordner fuer Sitzungen, Board, Werkzeuge. Pfade nur in config.json (Ruling R-Pfade).
  { id: 'arbeitsbereiche', l: 'Arbeitsbereiche', g: '', sub: 'Ordner für Sitzungen, Board und Werkzeuge · Pfade nur in config.json', kw: 'arbeitsbereich ordner kürzel farbe projekt jira workspace folder' },
  // Dieselbe Ansicht wie der Kalender-Dialog der Zeiterfassung (zeit.js, zKalZeichnen).
  { id: 'kalender', l: 'Kalender', g: '', sub: 'Termine aus Google, Outlook, Apple · nur lesen', kw: 'kalender ics caldav google outlook apple nextcloud termine abo calendar events' },
  { id: 'lokal', l: 'Lokale Modelle', g: '', sub: 'Gegenwert, Modellordner, Modelle laden', kw: 'ollama modell laden download ordner speicherort ollama_models festplatte model folder pull', felder: ['lokalEurProMioTokens', 'lokalSelbstkostenStunde', 'lokalZuordnungsfenster'] },
  { id: 'daten', l: 'Daten & Export', g: '', sub: 'Export, Abgleich und Speicherort', kw: 'csv export jira datenbank database' },
];
const E_HINWEIS = {
  zeitmodell: 'Eigene Zeit: Fenster um deine Eingaben. Aktivität: Laufzeit des Agenten. Projekte, Vorgänge und Sitzungen können abweichen.',
  zielmargeProzent: 'nach Sachkosten und eigener Zeit · steuert die Margen-Ampel',
  selbstkostenStunde: 'deine eigene Zeit als Kosten · Grundlage der Marge', aboPreisMonat: 'wird auf die aktive Zeit verteilt',
  gapMinutes: 'Lücke, ab der eine Sitzung als unterbrochen gilt', vergleichsFaktor: '0 schaltet die Kennzahl ab · höchstens 1,5',
  email: 'Kontaktstelle für die E-Rechnung', land: 'zweistelliges Kürzel, z. B. DE', kleinunternehmer: 'Belege ohne Umsatzsteuer, mit Hinweis',
  zahlungszielTage: 'für neue Rechnungen · gestellte behalten ihr Fälligkeitsdatum',
  tagessollStunden: 'Grundlage für Arbeitszeit heute und Workload',
  limit5hTokens: 'Cira-Karte: Tokens, die du je 5-h-Fenster von Claude erwartest · deine Schätzung · 0 blendet aus',
};
const E_EINHEIT = {
  stundensatz: 'EUR/h', selbstkostenStunde: 'EUR/h', zielmargeProzent: '%', aboPreisMonat: 'EUR', gapMinutes: 'Min', vergleichsFaktor: '×',
  lokalEurProMioTokens: 'EUR', lokalSelbstkostenStunde: 'EUR/h', lokalZuordnungsfenster: 'Min', ustSatz: '%', zahlungszielTage: 'Tage',
  tagessollStunden: 'h', limit5hTokens: 'Tokens',
};

const ez = {
  e: { d: null, fehler: null, laedt: false },     // /api/einstellungen
  s: { d: null, fehler: null, laedt: false },     // /api/stammdaten
  v: { d: null, fehler: null, laedt: false },     // /api/vorlagen
  vNeu: [],                                       // tmp-Ids neuer Vorlagen
  t: { d: null, fehler: null, laedt: false },     // /api/taetigkeitsarten
  tNeu: [],                                       // tmp-Ids neuer Taetigkeiten
  ab: { d: null, fehler: null, laedt: false },    // /api/arbeitsbereiche
  cira: { d: null, fehler: null, laedt: false },  // /api/cira/einstellungen
  mod: { d: null, fehler: null, laedt: false },   // /api/modelle (Liste, Laufzeit, Ordner)
  falsch: { d: null, fehler: null, laedt: false }, // /api/cira/falsch
  mv: { ordner: null, ordnerFrage: null, ladeFrage: null, fort: null }, // Ordner aendern / Modell laden
  q: '',
  hl: null,                                       // hervorgehobenes Feld nach einem Suchtreffer
  csv: null,                                      // { von, bis } fuer den Export
  fokus: null,                                    // Feld, das nach dem Zeichnen den Fokus bekommt
  kette: Object.create(null),                     // Abschnitt -> Promise des laufenden Speicherns
};
// Entwuerfe, Fehler und "Gespeichert" teilen sich den Speicher mit der Akte (kz in kontakte.js).
const eKey = (f) => 'e:' + f;

function eLade(e, pfad, nimm) {
  if (e.laedt || e.fehler) return;              // Fehler: erst "Erneut versuchen" laedt wieder
  e.laedt = true;
  hole(pfad).then((d) => {
    const x = nimm(d);
    if (x == null) throw new Error(uebersetze('Antwort ohne Daten'));
    e.d = x; e.fehler = null;
  }).catch((err) => { if (!e.d) e.fehler = err.message; else toast(err.message, 'err'); })
    .then(() => { e.laedt = false; if (route().name === 'einstellungen') zeichneAnsicht(); });
}
const ladeEinst = () => eLade(ez.e, '/api/einstellungen', (d) => (d && d.werte ? d : null));
const ladeStamm = () => eLade(ez.s, '/api/stammdaten', (d) => (d && d.werte ? d : null));
const ladeVorlagenListe = () => eLade(ez.v, '/api/vorlagen', (d) => (d && Array.isArray(d.vorlagen) ? d.vorlagen : null));

/* ---------- Felder ---------- */
const eWerte = () => (ez.e.d ? ez.e.d.werte : {});
const sWerte = () => (ez.s.d ? ez.s.d.werte : {});
function eAnzeige(f, stamm) {
  const r = (stamm ? sWerte() : eWerte())[f];
  if (!r) return '';
  if (Array.isArray(r.wert)) return r.wert.join('\n');
  return typeof r.wert === 'number' ? zahlText(r.wert) : String(r.wert == null ? '' : r.wert);
}
const eWert = (f, stamm) => (kz.entwurf[eKey(f)] != null ? kz.entwurf[eKey(f)] : eAnzeige(f, stamm));

function grenzText(r) {
  return fuelle('Erlaubt: {min} bis {max}', { min: zahlText(r.min), max: zahlText(r.max) }) +
    (r.aus !== undefined ? ' ' + fuelle('oder {aus} zum Abschalten', { aus: zahlText(r.aus) }) : '');
}

function feldZeile(f, stamm) {
  const r = (stamm ? sWerte() : eWerte())[f];
  if (!r) return '';
  const key = eKey(f);
  const hint = E_HINWEIS[f];
  const aria = ' aria-describedby="m-' + key + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '');
  let w;
  if (f === 'zeitmodell') {
    w = '<span class="segment" role="group" aria-label="' + esc(uebersetze('Zeitmodell')) + '">' + r.wahl.map((m) =>
      '<button type="button" data-aktion="e-zeitmodell" data-wert="' + esc(m) + '" aria-pressed="' + (r.wert === m) + '">' + esc(uebersetze(ZEITMODELL_NAME[m] || m)) + '</button>').join('') + '</span>';
  } else if (r.typ === 'schalter') {
    w = '<button type="button" class="kippschalter" role="switch" data-aktion="e-schalter" data-wert="' + esc(f) + '" aria-checked="' + schalterAn(f) + '" aria-labelledby="el-' + esc(f) + '"' + aria + '>' +
      '<span class="spur"></span>' + esc(uebersetze(schalterAn(f) ? 'an' : 'aus')) + '</button>';
  } else if (r.typ === 'zeilen') {
    w = '<textarea class="eingabe text" id="ef-' + f + '" data-efeld="' + f + '" rows="' + Math.min(6, r.zeilen || 4) + '"' + aria + '>' + esc(eWert(f, stamm)) + '</textarea>';
  } else {
    const zahl = !stamm || r.typ === 'zahl';
    // Nach § 19 UStG gibt es keinen Steuersatz. Das Feld bleibt sichtbar (der Wert
    // gilt nach dem Zurueckschalten wieder), nimmt aber keine Eingabe an.
    const gesperrt = stamm && f === 'ustSatz' && schalterAn('kleinunternehmer');
    w = '<input class="eingabe ' + (zahl ? 'zahl' : 'text') + '" id="ef-' + f + '" data-efeld="' + f + '" value="' + esc(eWert(f, stamm)) + '"' +
      (zahl ? ' inputmode="decimal" title="' + esc(gesperrt ? uebersetze('Nach § 19 UStG wird keine Umsatzsteuer ausgewiesen.') : grenzText(r)) + '"' : r.max ? ' maxlength="' + Number(r.max) + '"' : '') +
      (r.typ === 'email' ? ' type="email"' : '') + (r.typ === 'land' ? ' autocapitalize="characters"' : '') +
      (gesperrt ? ' disabled' : '') + aria + '>';
  }
  // Leere Einheit haelt die Flucht der Eingabefelder.
  const ohneFeld = r.typ === 'schalter' || f === 'zeitmodell';
  const einheit = ohneFeld ? '' : '<span class="einheit">' + esc(uebersetze(E_EINHEIT[f] || '')) + '</span>';
  return '<div class="einst-feld' + (ez.hl === f ? ' hl' : '') + '" data-feldzeile="' + f + '">' +
    // Schalter und Zeitmodell sind Knoepfe, kein Formularfeld: dort kein <label> ohne Ziel,
    // sondern eine Beschriftung, auf die der Schalter per aria-labelledby zeigt.
    (ohneFeld ? '<span class="l" id="el-' + f + '">' : '<label class="l" for="ef-' + f + '">') + esc(uebersetze(r.label)) + (r.pflicht ? ' *' : '') +
      (hint ? '<small>' + esc(uebersetze(hint)) + '</small>' : '') + (ohneFeld ? '</span>' : '</label>') +
    '<div class="w"><div class="zeile">' + w + einheit + '</div>' + feldMeldung(key) + '</div></div>';
}

/* ---------- Speichern ---------- */
const abschnittVon = (f) => E_ABSCHNITTE.find((a) => (a.felder || []).includes(f)) || (sWerte()[f] ? E_ABSCHNITTE.find((a) => a.stamm) : null);

// Ein Abschnitt zur Zeit unterwegs; wer waehrenddessen ein Feld verlaesst,
// loest danach einen weiteren Lauf mit dem dann aktuellen Stand aus.
async function speichereAbschnitt(a) {
  const lauf = 'e:' + a.id;
  // Laeuft schon einer: danach noch einmal; wer wartet, wartet auf beide Laeufe.
  if (kz.laeuft[lauf]) { kz.nochmal[lauf] = true; return ez.kette[lauf]; }
  const stamm = !!a.stamm;
  const W = stamm ? sWerte() : eWerte();
  const felder = stamm ? Object.keys(W) : a.felder.filter((f) => f !== 'zeitmodell');
  const geaendert = felder.filter((f) => kz.entwurf[eKey(f)] != null && kz.entwurf[eKey(f)] !== eAnzeige(f, stamm));
  // Unveraenderte Entwuerfe (zurueckgetippt) raeumen.
  for (const f of felder) if (kz.entwurf[eKey(f)] != null && !geaendert.includes(f)) { delete kz.entwurf[eKey(f)]; delete kz.fehler[eKey(f)]; }
  if (!geaendert.length) { eMeldungen(felder); return; }

  // Zahlen vorab lesen und gegen die Grenzen aus dem GET halten — so stehen alle
  // falschen Felder auf einmal da. Entscheiden tut der Server.
  const daten = {};
  let fehler = false;
  for (const f of geaendert) {
    const r = W[f];
    const roh = eWert(f, stamm);
    delete kz.fehler[eKey(f)];
    if (r.typ === 'schalter') { daten[f] = schalterAn(f); continue; }
    if (stamm && r.typ !== 'zahl') { daten[f] = roh; continue; }
    const s = String(roh).trim();
    // Leer heisst beim Server "unveraendert" — hier also ein Fehler, sonst stuende "Gespeichert" da.
    if (!s) { kz.fehler[eKey(f)] = uebersetze('Wert fehlt'); fehler = true; continue; }
    const n = betragAus(s);
    if (!Number.isFinite(n)) { kz.fehler[eKey(f)] = uebersetze('Keine gültige Zahl'); fehler = true; continue; }
    if ((n < r.min || n > r.max) && !(r.aus !== undefined && n === r.aus)) { kz.fehler[eKey(f)] = grenzText(r); fehler = true; continue; }
    daten[f] = n;
  }
  if (fehler) { eMeldungen(felder); return; }

  kz.laeuft[lauf] = true;
  let fertig;
  ez.kette[lauf] = new Promise((x) => { fertig = x; });
  for (const f of geaendert) kz.laeuft[eKey(f)] = true;
  eMeldungen(geaendert);
  const gesendet = Object.fromEntries(geaendert.map((f) => [f, kz.entwurf[eKey(f)]]));
  try {
    if (stamm) {
      await sende('/api/stammdaten', daten);
      // Gespeichert ist gespeichert: scheitert nur das Nachladen, bleibt der Erfolg stehen.
      try { ez.s.d = await hole('/api/stammdaten'); }
      catch (err) {
        for (const f of geaendert) if (W[f]) W[f].wert = W[f].typ === 'zeilen' ? String(daten[f]).split('\n').map((z) => z.trim()).filter(Boolean) : daten[f];
        toast(uebersetze('Stammdaten nicht geladen') + ': ' + err.message, 'err');
      }
    } else {
      const r = await sende('/api/einstellungen', daten);
      for (const [f, v] of Object.entries(r.geaendert || {})) if (W[f]) W[f].wert = v;
    }
    for (const f of geaendert) {
      if (kz.entwurf[eKey(f)] === gesendet[f]) delete kz.entwurf[eKey(f)];
      kz.ok[eKey(f)] = Date.now();
      const key = eKey(f);
      blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
    }
    neuLaden();
  } catch (err) {
    // Die Meldung beginnt mit dem Label des Feldes (server.js); sonst traegt
    // sie das erste geaenderte Feld.
    const f = felder.find((x) => W[x] && String(err.message).startsWith(W[x].label)) || geaendert[0];
    kz.fehler[eKey(f)] = err.message;
    for (const g of geaendert) delete kz.ok[eKey(g)];
  } finally {
    delete kz.laeuft[lauf];
    for (const f of geaendert) delete kz.laeuft[eKey(f)];
  }
  eMeldungen(felder);
  // Stammdaten: die Liste "fehlt noch" haengt am gespeicherten Stand.
  if (stamm) { const h = document.getElementById('e-fehlt'); if (h) h.outerHTML = fehltHtml(); }
  if (kz.nochmal[lauf]) { delete kz.nochmal[lauf]; await speichereAbschnitt(a); }
  fertig();
}
function eMeldungen(felder) {
  for (const f of felder) {
    const key = eKey(f);
    zeigeMeldung('m-' + key, key);
    const el = document.getElementById('ef-' + f);
    if (el) { if (kz.fehler[key]) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
  }
}

aktion('e-zeitmodell', async (m, el) => {
  const r = eWerte().zeitmodell;
  const key = eKey('zeitmodell');
  if (!r || !r.wahl.includes(m) || kz.laeuft[key]) return;
  if (r.wert === m) { if (kz.fehler[key]) { delete kz.fehler[key]; zeigeMeldung('m-' + key, key); } return; }
  kz.laeuft[key] = true;
  try {
    await sende('/api/einstellungen', { zeitmodell: m });
    r.wert = m;
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
    neuLaden();
  } catch (err) { kz.fehler[key] = err.message; delete kz.ok[key]; }
  delete kz.laeuft[key];
  zeichneAnsicht();
  const neu = document.querySelector('[data-aktion="e-zeitmodell"][data-wert="' + m + '"]');
  if (neu && el) neu.focus();
});
// Der Schalter ist ein Entwurf wie jedes Feld; scheitert das Speichern an ihm, springt er zurueck.
const schalterAn = (f) => (kz.entwurf[eKey(f)] != null ? kz.entwurf[eKey(f)] === 'true' : !!(sWerte()[f] || {}).wert);
aktion('e-schalter', (f) => {
  const r = sWerte()[f];
  if (!r || r.typ !== 'schalter') return;
  kz.entwurf[eKey(f)] = String(!schalterAn(f));
  zeichneAnsicht();
  const a = E_ABSCHNITTE.find((x) => x.stamm);
  speichereAbschnitt(a).then(() => {
    // Scheitert der Abschnitt (an welchem Feld auch immer), springt der Schalter zurueck.
    if (Object.keys(sWerte()).some((x) => kz.fehler[eKey(x)])) delete kz.entwurf[eKey(f)];
    zeichneAnsicht();
    const k = document.querySelector('[data-aktion="e-schalter"][data-wert="' + f + '"]');
    if (k) k.focus();
  });
});

/* ---------- Abschnitte ---------- */
function fehltHtml() {
  const fehlt = ez.s.d && ez.s.d.fehlt || [];
  return '<span id="e-fehlt" class="e-fehlt">' + (fehlt.length ? esc(uebersetze('Für Rechnungen fehlt noch') + ': ' + fehltNamen(fehlt)) : '') + '</span>';
}

function vorlagenHtml() {
  if (!ez.v.d) {
    ladeVorlagenListe();
    return ez.v.fehler ? leer('liste', 'Vorlagen nicht geladen', ez.v.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  }
  const zeilen = [...ez.v.d.map((v) => ({ id: String(v.id), v })), ...ez.vNeu.map((t) => ({ id: t, v: {} }))];
  return '<div class="vorl-tabelle"><div class="vorl-kopf"><span>' + esc(uebersetze('Bezeichnung')) + '</span><span class="rechts">' + esc(uebersetze('Satz €/h')) + '</span><span></span></div>' +
    (zeilen.length ? zeilen.map(({ id, v }) => {
      const key = 'v:' + id;
      const wert = (f) => (kz.entwurf[key + ':' + f] != null ? kz.entwurf[key + ':' + f] : f === 'satz' ? zahlText(v.satz) : (v[f] || ''));
      const aria = ' aria-describedby="m-' + key + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '');
      return '<div class="vorl-zeile" data-vorlzeile="' + esc(id) + '">' +
        '<input class="eingabe" data-vorl="' + esc(id) + '" data-vorlfeld="bezeichnung" name="vorl-bezeichnung" maxlength="200" value="' + esc(wert('bezeichnung')) + '" placeholder="' + esc(uebersetze('Bezeichnung')) + '" aria-label="' + esc(uebersetze('Bezeichnung')) + '"' + aria + '>' +
        '<input class="eingabe zahl" inputmode="decimal" data-vorl="' + esc(id) + '" data-vorlfeld="satz" name="vorl-satz" value="' + esc(wert('satz')) + '" placeholder="' + esc(uebersetze('leer = Projektsatz')) + '" aria-label="' + esc(uebersetze('Satz €/h')) + '"' + aria + '>' +
        '<button type="button" class="mini-knopf" data-aktion="e-vorl-weg" data-wert="' + esc(id) + '" title="' + esc(uebersetze('Entfernen')) + '" aria-label="' + esc(uebersetze('Entfernen') + ' · ' + (v.bezeichnung || '')) + '">×</button>' +
        feldMeldung(key) + '</div>';
    }).join('') : '<span class="dim">' + esc(uebersetze('Noch keine Vorlage.')) + '</span>') +
    '<button type="button" class="knopf klein geist e-plus" data-aktion="e-vorl-plus">' + esc(uebersetze('+ Vorlage')) + '</button></div>';
}

async function speichereVorlage(id) {
  const key = 'v:' + id;
  const tmp = !/^\d+$/.test(id);
  const alt = tmp ? {} : (ez.v.d || []).find((v) => String(v.id) === id);
  if (!alt) return;
  const bez = kz.entwurf[key + ':bezeichnung'] != null ? kz.entwurf[key + ':bezeichnung'] : (alt.bezeichnung || '');
  const satzRoh = kz.entwurf[key + ':satz'] != null ? kz.entwurf[key + ':satz'] : zahlText(alt.satz);
  if (tmp && !bez.trim() && !String(satzRoh).trim()) return;      // leere neue Zeile: nichts zu tun
  if (!tmp && bez === alt.bezeichnung && satzRoh === zahlText(alt.satz)) { delete kz.fehler[key]; zeigeMeldung('m-' + key, key); return; }
  const s = String(satzRoh).trim();
  const satz = s ? betragAus(s) : '';
  if (s && !Number.isFinite(satz)) { kz.fehler[key] = uebersetze('Keine gültige Zahl'); zeigeMeldung('m-' + key, key); return; }
  if (kz.laeuft[key]) { kz.nochmal[key] = true; return; }
  kz.laeuft[key] = true;
  zeigeMeldung('m-' + key, key);
  try {
    const r = await sende('/api/vorlage', { bezeichnung: bez, satz, ...(tmp ? {} : { id: Number(id) }) });
    if (kz.entwurf[key + ':bezeichnung'] === bez) delete kz.entwurf[key + ':bezeichnung'];
    if (kz.entwurf[key + ':satz'] === satzRoh) delete kz.entwurf[key + ':satz'];
    delete kz.fehler[key];
    if (tmp) {
      ez.v.d.push(r.vorlage);
      ez.vNeu = ez.vNeu.filter((t) => t !== id);
      const neuId = String(r.vorlage.id), neuKey = 'v:' + neuId;
      for (const f of ['bezeichnung', 'satz']) if (kz.entwurf[key + ':' + f] != null) { kz.entwurf[neuKey + ':' + f] = kz.entwurf[key + ':' + f]; delete kz.entwurf[key + ':' + f]; }
      befoerdere(key, neuKey, [['data-vorl', id, neuId], ['data-vorlzeile', id, neuId], ['data-wert', id, neuId]]);
      kz.ok[neuKey] = Date.now();
      blendeOkAus(neuKey, () => zeigeMeldung('m-' + neuKey, neuKey));
      delete kz.laeuft[key];
      zeigeMeldung('m-' + neuKey, neuKey);
      const weiter = kz.nochmal[key];
      delete kz.nochmal[key];
      if (weiter || ['bezeichnung', 'satz'].some((f) => kz.entwurf[neuKey + ':' + f] != null)) speichereVorlage(neuId);
      zeichneAnsicht();
      return;
    }
    Object.assign(alt, r.vorlage);
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
  } catch (err) {
    kz.fehler[key] = err.message;
    delete kz.ok[key];
  }
  delete kz.laeuft[key];
  zeigeMeldung('m-' + key, key);
  for (const i of document.querySelectorAll('[data-vorl]')) {
    if (i.dataset.vorl !== id) continue;
    if (kz.fehler[key]) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }
  if (kz.nochmal[key]) { delete kz.nochmal[key]; speichereVorlage(id); }
}
aktion('e-vorl-plus', () => {
  const t = 'neu' + Date.now().toString(36);
  ez.vNeu.push(t);
  zeichneAnsicht();
  const f = document.querySelector('[data-vorl="' + t + '"][data-vorlfeld="bezeichnung"]');
  if (f) f.focus();
});
aktion('e-vorl-weg', (id, el) => {
  if (!/^\d+$/.test(id)) { ez.vNeu = ez.vNeu.filter((t) => t !== id); zeichneAnsicht(); return; }
  const alt = (ez.v.d || []).find((v) => String(v.id) === id);
  if (!alt) return;
  return mitLauf(el, async () => {
    try {
      await sende('/api/vorlage-loeschen', { id: alt.id });
      ez.v.d = ez.v.d.filter((v) => v !== alt);
      toast(uebersetze('Vorlage entfernt') + ': ' + alt.bezeichnung, 'ok', { text: uebersetze('Rückgängig'), tu: async () => {
        try { const r = await sende('/api/vorlage', { bezeichnung: alt.bezeichnung, satz: alt.satz == null ? '' : alt.satz }); ez.v.d.push(r.vorlage); }
        catch (err) { toast(uebersetze('Wiederherstellen fehlgeschlagen') + ': ' + err.message, 'err'); }
        zeichneAnsicht();
      } });
    } catch (err) { toast(uebersetze('Vorlage nicht entfernt') + ': ' + err.message, 'err'); }
    zeichneAnsicht();
  });
});

/* ---------- Taetigkeitsarten & Rundung (Mockup Abrechnung Z. 1203–1212) ---------- */
const ladeTaet = () => eLade(ez.t, '/api/taetigkeitsarten', (d) => (Array.isArray(d) ? d : null));
function taetHtml() {
  const r = eWerte().rundungMinuten;
  const rk = eKey('rundungMinuten');
  const rundung = !r ? '' : '<div class="einst-feld" data-feldzeile="rundungMinuten"><span class="l" id="el-rundungMinuten">' + esc(uebersetze('Standard-Rundung')) +
      '<small>' + esc(uebersetze('für Projekte ohne eigene Rundung · die Rohzeit bleibt gespeichert')) + '</small></span>' +
    '<div class="w"><div class="zeile"><span class="segment" role="group" aria-labelledby="el-rundungMinuten">' + [1, 5, 15].map((m) =>
      '<button type="button" data-aktion="e-rundung" data-wert="' + m + '" aria-pressed="' + (r.wert === m) + '">' + m + ' Min</button>').join('') + '</span>' +
      ([1, 5, 15].includes(r.wert) ? '' : '<span class="hinweis">' + esc(fuelle('aktuell {n} Min (aus config.json)', { n: zahlText(r.wert) })) + '</span>') + '</div>' + feldMeldung(rk) + '</div></div>';
  if (!ez.t.d) {
    ladeTaet();
    return rundung + (ez.t.fehler ? leer('liste', 'Tätigkeiten nicht geladen', ez.t.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>');
  }
  // Bestehende Namen bleiben fest: ein umbenannter Name liesse die Eintraege mit dem alten zurueck.
  const zeilen = [...ez.t.d.map((t) => ({ id: t.name, t })), ...ez.tNeu.map((x) => ({ id: x, t: null }))];
  return rundung + '<div class="vorl-tabelle taet-tabelle"><div class="vorl-kopf"><span>' + esc(uebersetze('Tätigkeit')) + '</span><span class="rechts">' + esc(uebersetze('eigener Satz €/h')) + '</span><span></span></div>' +
    zeilen.map(({ id, t }) => {
      const key = 'ta:' + id;
      const satz = kz.entwurf[key + ':satz'] != null ? kz.entwurf[key + ':satz'] : t ? zahlText(t.satz) : '';
      const aria = ' aria-describedby="m-' + esc(key) + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '');
      const name = t ? '<span class="taet-name">' + esc(t.name) + (t.verwendet ? '<small class="faint">' + esc(anzahl(t.verwendet, 'Eintrag', 'Einträge')) + '</small>' : '') + '</span>'
        : '<input class="eingabe" data-taet="' + esc(id) + '" data-taetfeld="name" maxlength="40" value="' + esc(kz.entwurf[key + ':name'] || '') + '" placeholder="' + esc(uebersetze('Name')) + '" aria-label="' + esc(uebersetze('Tätigkeit')) + '"' + aria + '>';
      return '<div class="vorl-zeile" data-taetzeile="' + esc(id) + '">' + name +
        '<input class="eingabe zahl" inputmode="decimal" data-taet="' + esc(id) + '" data-taetfeld="satz" value="' + esc(satz) + '" placeholder="' + esc(uebersetze('Projektsatz')) + '" aria-label="' + esc(uebersetze('eigener Satz €/h') + (t ? ' · ' + t.name : '')) + '"' + aria + '>' +
        '<button type="button" class="mini-knopf" data-aktion="e-taet-weg" data-wert="' + esc(id) + '"' + (t && t.verwendet ? ' disabled title="' + esc(uebersetze('Wird verwendet und kann nicht gelöscht werden.')) + '"' : ' title="' + esc(uebersetze('Entfernen')) + '"') +
          ' aria-label="' + esc(uebersetze('Entfernen') + (t ? ' · ' + t.name : '')) + '">×</button>' + feldMeldung(key) + '</div>';
    }).join('') +
    '<button type="button" class="knopf klein geist e-plus" data-aktion="e-taet-plus">' + esc(uebersetze('+ Tätigkeit')) + '</button>' +
    '<span class="hinweis">' + esc(uebersetze('Leer = Projektsatz inkl. Rabatt. Begleiten zählt als Fokusarbeit.')) + '</span></div>';
}
aktion('e-rundung', async (m) => {
  const r = eWerte().rundungMinuten, key = eKey('rundungMinuten');
  const n = Number(m);
  if (!r || ![1, 5, 15].includes(n) || r.wert === n || kz.laeuft[key]) return;
  kz.laeuft[key] = true;
  try {
    const x = await sende('/api/einstellungen', { rundungMinuten: n });
    r.wert = (x.geaendert && x.geaendert.rundungMinuten) || n;
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
    neuLaden();
  } catch (err) { kz.fehler[key] = err.message; delete kz.ok[key]; }
  delete kz.laeuft[key];
  zeichneAnsicht();
});
async function speichereTaet(id) {
  const key = 'ta:' + id;
  const alt = (ez.t.d || []).find((t) => t.name === id);
  const name = alt ? alt.name : String(kz.entwurf[key + ':name'] || '').trim();
  const satzRoh = kz.entwurf[key + ':satz'] != null ? kz.entwurf[key + ':satz'] : alt ? zahlText(alt.satz) : '';
  if (!alt && !name) return;                                   // leere neue Zeile: nichts zu tun
  if (alt && satzRoh === zahlText(alt.satz)) { delete kz.entwurf[key + ':satz']; delete kz.fehler[key]; zeigeMeldung('m-' + key, key); return; }
  const s = String(satzRoh).trim();
  const satz = s ? betragAus(s) : '';
  if (s && !Number.isFinite(satz)) { kz.fehler[key] = uebersetze('Keine gültige Zahl'); zeigeMeldung('m-' + key, key); return; }
  if (kz.laeuft[key]) { kz.nochmal[key] = true; return; }
  kz.laeuft[key] = true;
  zeigeMeldung('m-' + key, key);
  try {
    const r = await sende('/api/taetigkeitsarten', { name, satz: satz === '' ? null : satz });
    delete kz.entwurf[key + ':satz']; delete kz.entwurf[key + ':name']; delete kz.fehler[key];
    // Neuer Name gleich einem bestehenden: der Server ueberschreibt (Upsert) — keine zweite Zeile.
    const da = alt || ez.t.d.find((t) => t.name === r.taetigkeit.name);
    if (da) Object.assign(da, r.taetigkeit); else ez.t.d.push({ ...r.taetigkeit, verwendet: 0 });
    if (!alt) ez.tNeu = ez.tNeu.filter((x) => x !== id);
    const neuKey = 'ta:' + r.taetigkeit.name;
    kz.ok[neuKey] = Date.now();
    blendeOkAus(neuKey, () => zeigeMeldung('m-' + neuKey, neuKey));
    // Neue Saetze wirken auf offene Eintraege (Server rechnet nach): Zeiterfassung nachladen.
    zeitNachAenderung();
  } catch (err) { kz.fehler[key] = err.message; delete kz.ok[key]; }
  delete kz.laeuft[key];
  if (!alt && !kz.fehler[key]) {
    // Die Seite zeichnet nicht neu, solange ein Feld den Fokus hat (Schutz laufender
    // Eingaben) — die gespeicherte neue Zeile muss aber zur festen Zeile werden.
    const a = document.activeElement;
    if (a && a.closest && a.closest('[data-taetzeile="' + CSS.escape(id) + '"]')) a.blur();
    zeichneAnsicht();
  } else zeigeMeldung('m-' + key, key);
  if (kz.nochmal[key]) { delete kz.nochmal[key]; speichereTaet(id); }
}
aktion('e-taet-plus', () => {
  const t = 'neu' + Date.now().toString(36);
  ez.tNeu.push(t);
  zeichneAnsicht();
  const f = document.querySelector('[data-taet="' + t + '"][data-taetfeld="name"]');
  if (f) f.focus();
});
aktion('e-taet-weg', (id, el) => {
  const alt = (ez.t.d || []).find((t) => t.name === id);
  if (!alt) { ez.tNeu = ez.tNeu.filter((x) => x !== id); zeichneAnsicht(); return; }
  return mitLauf(el, async () => {
    try {
      await sende('/api/taetigkeitsart-loeschen', { name: alt.name });
      ez.t.d = ez.t.d.filter((t) => t !== alt);
      toast(uebersetze('Tätigkeit entfernt') + ': ' + alt.name, 'ok', { text: uebersetze('Rückgängig'), tu: async () => {
        try { const r = await sende('/api/taetigkeitsarten', { name: alt.name, satz: alt.satz, parallel: !!alt.parallel }); if (!ez.t.d.some((t) => t.name === r.taetigkeit.name)) ez.t.d.push({ ...r.taetigkeit, verwendet: 0 }); zeitNachAenderung(); }
        catch (err) { toast(uebersetze('Wiederherstellen fehlgeschlagen') + ': ' + err.message, 'err'); }
        zeichneAnsicht();
      } });
    } catch (err) { toast(uebersetze('Tätigkeit nicht entfernt') + ': ' + err.message, 'err'); }
    zeichneAnsicht();
  });
});

function darstellungHtml() {
  const reduziert = document.documentElement.dataset.motion === 'off';
  return '<div class="einst-feld"><span class="l">' + esc(uebersetze('Sprache')) + '<small>' + esc(uebersetze('Oberfläche; Belege bleiben deutsch')) + '</small></span>' +
      '<div class="w"><div class="zeile">' + segment('e-sprache', [['de', 'Deutsch'], ['en', 'Englisch']], SPRACHE, 'Sprache') + '</div></div></div>' +
    '<div class="einst-feld"><span class="l">' + esc(uebersetze('Theme')) + '<small>' + esc(uebersetze('hell, dunkel oder wie das Betriebssystem')) + '</small></span>' +
      '<div class="w"><div class="zeile">' + segment('e-theme', [['system', 'System'], ['dunkel', 'Dunkel'], ['hell', 'Hell']], themeWahl(), 'Theme') + '</div></div></div>' +
    '<div class="einst-feld"><span class="l">' + esc(uebersetze('Bewegung reduzieren')) + '<small>' + esc(uebersetze('keine Einblendungen und Zähl-Animationen')) + '</small></span>' +
      '<div class="w"><div class="zeile"><button type="button" class="kippschalter" role="switch" data-aktion="e-bewegung" aria-checked="' + reduziert + '" aria-label="' + esc(uebersetze('Bewegung reduzieren')) + '">' +
        '<span class="spur"></span>' + esc(uebersetze(reduziert ? 'an' : 'aus')) + '</button></div></div></div>' +
    // Startseite (Handoff §4.3): gilt, wenn die Adresse keinen Bereich nennt. Je Browser.
    '<div class="einst-feld"><span class="l">' + esc(uebersetze('Startseite')) + '<small>' + esc(uebersetze('öffnet ohne Adresse eines Bereichs')) + '</small></span>' +
      '<div class="w"><div class="zeile">' + segment('e-start', STARTSEITEN.map((k) => [k, seitenName(seiteVon(k))]), lies('start', START_STANDARD), 'Startseite') + '</div></div></div>';
}
const STARTSEITEN = ['cockpit', 'sitzungen', 'werkzeuge', 'board', 'hub'];
aktion('e-start', (k) => {
  if (!STARTSEITEN.includes(k)) return;
  merke('start', k);
  zeichneAnsicht();
  const el = document.querySelector('[data-aktion="e-start"][data-wert="' + k + '"]');
  if (el) el.focus();
});
aktion('e-sprache', (s) => setzeSprache(s));
aktion('e-theme', (w) => {
  if (!THEMES.includes(w)) return;
  // Ohne Browser-Speicher wenigstens fuer diese Sitzung.
  themeSitzung = merke('theme', w) ? null : w;
  setzeTheme();
  zeichneAnsicht();
  const el = document.querySelector('[data-aktion="e-theme"][data-wert="' + w + '"]');
  if (el) el.focus();
});
aktion('e-bewegung', () => {
  const neu = document.documentElement.dataset.motion === 'off' ? 'on' : 'off';
  merke('motion', neu);
  setzeBewegung();
  zeichneAnsicht();
  const k = document.querySelector('[data-aktion="e-bewegung"]');
  if (k) k.focus();
});

/* ---------- Arbeitsbereiche ----------
   Kuerzel, Farbe, Projekt und Jira-Projekt speichern beim Verlassen des Felds.
   Ordner, Art und neue Bereiche stehen nur in config.json: ein Pfad bestimmt,
   wo ein gestarteter Prozess arbeitet und schreibt (Ruling R-Pfade). */
const AB_ART = { projekt: 'Projekt', vault: 'Vault', global: 'Global', neutral: 'Chat' };
const ladeArbeitsbereiche = () => eLade(ez.ab, '/api/arbeitsbereiche', (d) => (d && Array.isArray(d.arbeitsbereiche) ? d : null));
function arbeitsbereicheHtml() {
  if (!ez.ab.d) {
    ladeArbeitsbereiche();
    return ez.ab.fehler ? leer('liste', 'Arbeitsbereiche nicht geladen', ez.ab.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  }
  const { arbeitsbereiche: L, vorschlag } = ez.ab.d;
  if (!L.length) {
    return '<p class="dim">' + esc(uebersetze('Noch keine Arbeitsbereiche eingetragen, Sitzungen lassen sich deshalb nicht starten. Unten steht nur ein Vorschlag aus deinen Daten: zum Übernehmen in config.json unter "arbeitsbereiche" einfügen, Pfade prüfen, Server neu starten.')) + '</p>' +
      '<pre class="ab-vorschlag mono" tabindex="0">' + esc('"arbeitsbereiche": ' + JSON.stringify(vorschlag || [], null, 2)) + '</pre>';
  }
  const feld = (a, f, extra, label) => {
    const key = 'ab:' + a.name;
    const wert = kz.entwurf[key + ':' + f] != null ? kz.entwurf[key + ':' + f] : (a[f] || '');
    return '<input class="eingabe" data-ab="' + esc(a.name) + '" data-abfeld="' + f + '" value="' + esc(wert) + '" aria-label="' + esc(uebersetze(label) + ' · ' + a.name) + '"' +
      ' aria-describedby="m-' + esc(key) + '"' + (kz.fehler[key] ? ' aria-invalid="true"' : '') + extra + '>';
  };
  return '<div class="ab-tabelle"><div class="ab-kopf"><span>' + esc(uebersetze('Name')) + '</span><span>' + esc(uebersetze('Kürzel')) + '</span><span>' + esc(uebersetze('Farbe')) + '</span>' +
      '<span>' + esc(uebersetze('Projekt')) + '</span><span>' + esc(uebersetze('Jira')) + '</span><span>' + esc(uebersetze('Ordner')) + '</span></div>' +
    L.map((a) => '<div class="ab-zeile">' +
      '<span class="ab-name"><span class="ab-pille" style="color:' + esc(a.farbe || 'var(--text-dim)') + ';border-color:' + esc(a.farbe || 'var(--line)') + '">' + esc(a.kuerzel || '–') + '</span>' +
        '<span><b>' + esc(a.name) + '</b><small>' + esc(uebersetze(AB_ART[a.art] || a.art)) + '</small></span></span>' +
      feld(a, 'kuerzel', ' maxlength="3"', 'Kürzel') +
      feld(a, 'farbe', ' type="color"', 'Farbe').replace('class="eingabe"', 'class="ab-farbe"') +
      feld(a, 'projekt', ' maxlength="80" placeholder="' + esc(uebersetze('kein Projekt')) + '"', 'Projekt') +
      feld(a, 'jiraProjekt', ' maxlength="10" placeholder="–"', 'Jira') +
      '<span class="ab-pfad mono" title="' + esc(uebersetze('Ordner nur in config.json änderbar')) + '"><span class="punkt' + (a.erreichbar ? '' : ' fehler') + '" aria-hidden="true"></span>' +
        '<span class="t">' + esc(a.pfad || '–') + '</span><span class="nur-sr">' + esc(uebersetze(a.erreichbar ? 'erreichbar' : 'nicht erreichbar')) + '</span></span>' +
      feldMeldung('ab:' + a.name) + '</div>').join('') +
    '<p class="faint ab-fuss">' + esc(uebersetze('Ordner, Art und neue Arbeitsbereiche nur in config.json — ein Ordner bestimmt, wo Claude Code arbeitet und schreibt.')) + '</p></div>';
}
async function speichereArbeitsbereich(name, feld, wert) {
  const key = 'ab:' + name;
  const a = ez.ab.d && ez.ab.d.arbeitsbereiche.find((x) => x.name === name);
  if (!a || (a[feld] || '') === wert) { delete kz.entwurf[key + ':' + feld]; return; }
  try {
    const r = await sende('/api/arbeitsbereich', { name, [feld]: wert });
    Object.assign(a, r.arbeitsbereich);
    if (kz.entwurf[key + ':' + feld] === wert) delete kz.entwurf[key + ':' + feld];
    delete kz.fehler[key];
    kz.ok[key] = Date.now();
    blendeOkAus(key, () => zeigeMeldung('m-' + key, key));
  } catch (err) {
    kz.fehler[key] = err.message;
    delete kz.ok[key];
  }
  zeigeMeldung('m-' + key, key);
  for (const i of document.querySelectorAll('[data-abfeld]')) {
    if (i.dataset.ab !== name) continue;
    if (kz.fehler[key]) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }
  if (!kz.fehler[key]) zeichneAnsicht();
}

/* ---------- Cira ----------
   Speichert beim Verlassen des Felds; Grenzen prueft der Server (CIRA_FELDER).
   Der Pfad zur claude.exe bleibt der Datei vorbehalten. */
const ladeCiraEinst = () => eLade(ez.cira, '/api/cira/einstellungen', (d) => (d && d.cira ? d : null));
function ciraHtml() {
  if (!ez.cira.d) {
    ladeCiraEinst();
    return ez.cira.fehler ? leer('liste', 'Einstellungen nicht geladen', ez.cira.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  }
  const c = ez.cira.d.cira;
  const zeile = (titel, unter, rechts, key) => '<div class="einst-feld"><span class="l">' + esc(uebersetze(titel)) + '<small>' + unter + '</small></span>' +
    '<div class="w"><div class="zeile">' + rechts + '</div>' + (key ? feldMeldung(key) : '') + '</div></div>';
  const feld = (f, extra, label) => {
    const key = 'cira:' + f;
    const wert = kz.entwurf[key] != null ? kz.entwurf[key] : (c[f] == null ? '' : c[f]);
    return '<input class="eingabe" data-cirafeld="' + f + '" value="' + esc(wert) + '" aria-label="' + esc(uebersetze(label)) + '" aria-describedby="m-' + key + '"' +
      (kz.fehler[key] ? ' aria-invalid="true"' : '') + extra + '>';
  };
  const verbraucht = Number(ez.cira.d.verbraucht_eur) || 0;
  // Modell je Rolle: nur aus der Liste des Modellservers. Ein gespeichertes Modell,
  // das der Server gerade nicht nennt, bleibt sichtbar statt still zu verschwinden.
  if (!ez.mod.d) ladeModelle();
  const M = ez.mod.d;
  const modellWahl = (f, label) => {
    const wert = c[f] || '';
    const ids = M && M.modelle ? M.modelle : [];
    const opt = (id, text) => '<option value="' + esc(id) + '"' + (id === wert ? ' selected' : '') + '>' + esc(text) + '</option>';
    return '<select class="eingabe" data-cirafeld="' + f + '" aria-label="' + esc(uebersetze(label)) + '" aria-describedby="m-cira:' + f + '"' + (kz.fehler['cira:' + f] ? ' aria-invalid="true"' : '') + '>' +
      opt('', uebersetze('— keins —')) + ids.map((m) => opt(m.id, m.id + (m.groesse_gb ? ' · ' + nf1.format(m.groesse_gb) + ' GB' : ''))).join('') +
      (wert && !ids.some((m) => m.id === wert) ? opt(wert, wert + ' · ' + uebersetze('nicht verfügbar')) : '') + '</select>';
  };
  const ROLLE_UNTER = {
    modellLokal: 'kurze Antworten aus den Zahlen · leer = nächstes eingestelltes Modell',
    modellText: 'Entwürfe, Mails, Umformulieren',
    modellDenken: 'Warum, Vergleich, Analyse · fängt ab, was die anderen abgeben',
    modellCode: 'Skripte, Regex, Fehlermeldungen',
  };
  const ROLLE_TITEL = { modellLokal: 'Modell Schnell', modellText: 'Modell Text', modellDenken: 'Modell Denken', modellCode: 'Modell Code' };
  const status = ez.mod.fehler ? uebersetze('Liste nicht geladen') + ': ' + ez.mod.fehler
    : !M ? uebersetze('Lädt …') : !M.erreichbar ? (M.fehler || uebersetze('Modellserver nicht erreichbar'))
      : fuelle('{n} Modelle · {art}', { n: M.modelle.length, art: LAUFZEIT[M.laufzeit] || M.laufzeit });
  const modellBlock = zeile('Lokale Modelle (T1)', esc(status) + ' · <a href="#/einstellungen/lokal">' + esc(uebersetze('Ordner und Laden')) + '</a>',
      '<button type="button" class="knopf klein" data-aktion="e-modelle-neu">' + esc(uebersetze('Liste aktualisieren')) + '</button>') +
    Object.keys(ROLLE_TITEL).map((f) => zeile(ROLLE_TITEL[f], esc(uebersetze(ROLLE_UNTER[f])), modellWahl(f, ROLLE_TITEL[f]), 'cira:' + f)).join('');
  // Eigene Woerter und Fehlzuordnungen: aufklappbar, sie braucht man selten.
  if (!ez.falsch.d) eLade(ez.falsch, '/api/cira/falsch', (d) => (d && Array.isArray(d.falsch) ? d.falsch : null));
  const WT = { woerterSchnell: 'Wörter Schnell', woerterText: 'Wörter Text', woerterDenken: 'Wörter Denken', woerterCode: 'Wörter Code' };
  const falschListe = (ez.falsch.d || []).map((x) => '<li><span>' + esc(x.frage || '–') + '</span><small class="faint">' + esc(uebersetze(CIRA_ROLLE[x.rolle] || x.rolle)) + ' · ' + esc(x.grund) + '</small></li>').join('');
  const woerterBlock = '<details class="e-woerter"><summary>' + esc(uebersetze('Eigene Wörter je Rolle und falsch zugeordnete Fragen')) + '</summary>' +
    Object.keys(WT).map((f) => zeile(WT[f], esc(uebersetze('kommagetrennt, ergänzen die eingebauten Wörter')), feld(f, ' maxlength="300" placeholder="' + esc(uebersetze('z. B. n8n, Kalkulation')) + '" spellcheck="false"', WT[f]), 'cira:' + f)).join('') +
    '<p class="faint">' + esc(uebersetze('Zuletzt als „falsch zugeordnet“ markiert:')) + '</p>' + (falschListe ? '<ul class="e-falsch">' + falschListe + '</ul>' : '<p class="dim">' + esc(uebersetze('Noch nichts markiert.')) + '</p>') + '</details>';
  return zeile('Anrede', esc(uebersetze('wie Cira dich anspricht · leer = ohne Namen')), feld('anrede', ' maxlength="40"', 'Anrede'), 'cira:anrede') +
    modellBlock + woerterBlock +
    zeile('Claude erlaubt (T2)', esc(uebersetze('für Texte und Fragen, die die Zahlen allein nicht beantworten · läuft als Werkzeugbetrieb, nicht auf Kundenvorgänge')),
      '<button type="button" class="kippschalter" role="switch" data-aktion="e-cira-claude" aria-checked="' + (c.claudeErlaubt === true) + '" aria-label="' + esc(uebersetze('Claude erlaubt (T2)')) + '">' +
        '<span class="spur"></span>' + esc(uebersetze(c.claudeErlaubt === true ? 'an' : 'aus')) + '</button>', 'cira:claudeErlaubt') +
    zeile('Claude-Modell', esc(uebersetze('Standard = was die Claude-CLI eingestellt hat')),
      segment('e-cira-modell', [['', 'Standard'], ['haiku', 'Haiku'], ['sonnet', 'Sonnet'], ['opus', 'Opus']], c.claudeModell || '', 'Claude-Modell'), 'cira:claudeModell') +
    zeile('Monatslimit Claude', esc(uebersetze('0,50 bis 500 EUR · dieser Monat bisher') + ' ' + eur(verbraucht)),
      feld('claudeMonatslimitEur', ' inputmode="decimal" style="max-width:120px"', 'Monatslimit Claude') + '<span class="faint">EUR</span>', 'cira:claudeMonatslimitEur') +
    zeile('Nicht stören', esc(uebersetze('in diesem Fenster ist der Orb gedimmt · beide leer = aus')),
      feld('nichtStoerenAb', ' type="time"', 'Nicht stören ab') + '<span class="faint">–</span>' + feld('nichtStoerenBis', ' type="time"', 'Nicht stören bis'), 'cira:nichtStoerenAb') +
    zeile('Desktop-Benachrichtigung', esc(uebersetze('zusätzlich zur Karte in der Seite, wenn der Tab im Hintergrund liegt · nicht im Nicht-stören-Fenster')),
      '<button type="button" class="kippschalter" role="switch" data-aktion="e-cira-desktop" aria-checked="' + (c.benachrichtigungDesktop === true) + '" aria-label="' + esc(uebersetze('Desktop-Benachrichtigung')) + '">' +
        '<span class="spur"></span>' + esc(uebersetze(c.benachrichtigungDesktop === true ? 'an' : 'aus')) + '</button>', 'cira:benachrichtigungDesktop') +
    zeile('Orb-Stil', esc(uebersetze('Bühne im Cockpit · Partikel oder ruhige Fläche')),
      segment('e-cira-orb', [['partikel', 'Partikel'], ['flaeche', 'Ruhige Fläche']], c.orbStil || 'partikel', 'Orb-Stil'), 'cira:orbStil') +
    stimmeBlock(c, zeile, feld) +
    '<p class="faint ab-fuss">' + esc(uebersetze('Bewegung reduzieren und Startseite: Darstellung. Pfad zur claude.exe nur in config.json.')) + '</p>';
}
// Einstellungen → Cira → Stimme (C10). Pfade und Schluessel bleiben der Datei vorbehalten;
// die Browser-Stimme ist Geraetesache (localStorage), alles andere geht ueber CIRA_FELDER.
function stimmeBlock(c, zeile, feld) {
  const sp = ez.cira.d.sprache || { stt: { bereit: false, grund: '' }, tts: { verbraucht: 0, bereit: true } };
  const F = ez.cira.d.felder || {};
  const wahl = (f, label) => '<select class="eingabe" data-cirafeld="' + f + '" aria-label="' + esc(uebersetze(label)) + '" aria-describedby="m-cira:' + f + '">' +
    ((F[f] && F[f].wahl) || []).map((m) => '<option value="' + esc(m) + '"' + (m === c[f] ? ' selected' : '') + '>' + esc(m) + '</option>').join('') + '</select>';
  const sprachTeil = istDE() ? 'de' : 'en';
  const stimmen = typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter((v) => v.lang.slice(0, 2) === sprachTeil);
  const gewaehlt = lies('stimme', '');
  const el = c.stimmeAnbieter === 'elevenlabs';
  return '<p class="ueberzeile e-stimme-titel">' + esc(uebersetze('Stimme')) + '</p>' +
    zeile('Spracherkennung', esc(sp.stt.bereit ? uebersetze('eingerichtet · lokal mit whisper · Pfade nur in config.json (sprache.stt)') : (sp.stt.grund || '')), '') +
    zeile('Antworten vorlesen', esc(uebersetze('automatisch = wenn du gesprochen hast oder beim Tagesbericht')),
      segment('e-cira-vorlesen', [['auto', 'Automatisch'], ['immer', 'Immer'], ['nie', 'Nie']], c.antwortenVorlesen || 'auto', 'Antworten vorlesen'), 'cira:antwortenVorlesen') +
    zeile('Stimme', esc(uebersetze('Der Text wird an ElevenLabs (USA) gesendet — auch Kundennamen und Beträge.')) + (el && sp.tts.grund ? ' · <b>' + esc(sp.tts.grund) + '</b>' : '') +
        (el && !sp.tts.grund && sp.tts.letzterFehler ? ' · <b>' + esc(uebersetze('Letzter Versuch') + ' ' + uhrVon(sp.tts.letzterFehler.zeit) + ': ' + sp.tts.letzterFehler.grund) + '</b>' : ''),
      segment('e-cira-stimme', [['browser', 'Browser · lokal'], ['elevenlabs', 'ElevenLabs']], c.stimmeAnbieter || 'browser', 'Stimme'), 'cira:stimmeAnbieter') +
    zeile('Browser-Stimme', esc(uebersetze('Stimme dieses Browsers · gilt nur auf diesem Gerät')),
      '<select class="eingabe" id="e-browserstimme" aria-label="' + esc(uebersetze('Browser-Stimme')) + '"><option value="">' + esc(uebersetze('Standard des Browsers')) + '</option>' +
        stimmen.map((v) => '<option value="' + esc(v.voiceURI) + '"' + (v.voiceURI === gewaehlt ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('') + '</select>') +
    (el ? zeile('ElevenLabs-Stimme', esc(uebersetze('ID einer Stimme deines Kontos · im Free-Plan nur die Standardstimmen, Voice-Library-Stimmen brauchen ein Abo · keine Stimme einer realen Person')) + ' · <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noopener noreferrer">' + esc(uebersetze('Voice Library')) + '</a>',
        feld('stimmeElevenlabs', ' maxlength="40" spellcheck="false" style="max-width:240px"', 'ElevenLabs-Stimme'), 'cira:stimmeElevenlabs') +
      zeile('Modell kurze Antworten', esc(uebersetze('unter 400 Zeichen')), wahl('stimmeModellKurz', 'Modell kurze Antworten'), 'cira:stimmeModellKurz') +
      zeile('Modell Briefings', esc(uebersetze('ab 400 Zeichen')), wahl('stimmeModellLang', 'Modell Briefings'), 'cira:stimmeModellLang') +
      zeile('Monatslimit Zeichen', esc(fuelle('1.000 bis 1.000.000 · dieser Monat bisher {n} Zeichen · danach Browser-Stimme', { n: num(sp.tts.verbraucht || 0) })),
        feld('stimmeMonatslimitZeichen', ' inputmode="numeric" style="max-width:120px"', 'Monatslimit Zeichen') + '<span class="faint">' + esc(uebersetze('Zeichen')) + '</span>', 'cira:stimmeMonatslimitZeichen') : '') +
    zeile('', '', '<button type="button" class="knopf klein" data-aktion="e-cira-probe">' + esc(uebersetze('Probesatz sprechen')) + '</button>');
}
async function speichereCira(feld, wert) {
  const key = 'cira:' + feld;
  const c = ez.cira.d && ez.cira.d.cira;
  if (!c || String(c[feld] == null ? '' : c[feld]) === String(wert)) { delete kz.entwurf[key]; return; }
  // Ab und bis teilen sich eine Meldung.
  const mkey = feld === 'nichtStoerenBis' ? 'cira:nichtStoerenAb' : key;
  try {
    const r = await sende('/api/cira/einstellungen', { [feld]: wert });
    ez.cira.d.cira = r.cira;
    if (kz.entwurf[key] === wert) delete kz.entwurf[key];
    delete kz.fehler[mkey];
    kz.ok[mkey] = Date.now();
    blendeOkAus(mkey, () => zeigeMeldung('m-' + mkey, mkey));
    if (typeof ladeCira === 'function') ladeCira();
    // Stimme: Status (bereit, Grund, Zeichen) kommt aus sprache.js, Knoepfe und Vorlese-Regel folgen ihm.
    if (/^(stimme|antwortenVorlesen)/.test(feld)) sprache.lade().then((st) => { if (st && ez.cira.d) { ez.cira.d.sprache = st; zeichneAnsicht(); } });
  } catch (err) {
    kz.fehler[mkey] = err.message;
    delete kz.ok[mkey];
  }
  zeigeMeldung('m-' + mkey, mkey);
  for (const i of document.querySelectorAll('[data-cirafeld="' + feld + '"]')) {
    if (kz.fehler[mkey]) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
  }
  if (!kz.fehler[mkey]) zeichneAnsicht();
}
/* ---------- Lokale Modelle: Liste, Ordner, Laden (Modell-Block) ----------
   Den Ordner bestimmt Ollama (OLLAMA_MODELS) fuer alle Modelle zusammen; ein
   Ziel je Download gibt es nicht. Aendern und Laden fragen vorher nach. */
const LAUFZEIT = { ollama: 'Ollama', lmstudio: 'LM Studio', llamacpp: 'llama.cpp', lemonade: 'Lemonade', openai: 'OpenAI-kompatibel', unbekannt: 'Laufzeit nicht erkannt' };
const ladeModelle = () => eLade(ez.mod, '/api/modelle', (d) => (d && Array.isArray(d.modelle) ? d : null));
aktion('e-modelle-neu', () => { ez.mod.d = null; ez.mod.fehler = null; ez.falsch.d = null; ez.falsch.fehler = null; ladeModelle(); zeichneAnsicht(); });
const gbText = (v) => (v == null ? '–' : nf1.format(v) + ' GB');
function ordnerZeile(o) {
  if (!o) return '';
  if (!o.lokal) return '<p class="dim">' + esc(uebersetze('Der Modellserver läuft nicht auf diesem Rechner — den Ordner legt dort sein Betreiber fest.')) + '</p>';
  if (o.fremd) return '<p class="dim">' + esc(uebersetze('Den Modellordner verwaltet dein Modellserver selbst (nicht Ollama) — dort in den Einstellungen ändern.')) + '</p>';
  if (o.pfad == null) return '<p class="dim">' + esc(uebersetze('Modellordner nicht bestimmbar') + ': ' + (o.fehler || '')) + '</p>';
  const warn = o.systemlaufwerk ? ' <span class="pille warn">' + esc(uebersetze('Systemlaufwerk')) + '</span>' : '';
  const mv = ez.mv;
  let unten = '';
  if (mv.ordnerFrage) {
    const z = mv.ordnerFrage.ziel;
    unten = '<div class="e-frage" role="group" aria-label="' + esc(uebersetze('Modellordner ändern')) + '"><p>' +
      esc(fuelle('OLLAMA_MODELS für deinen Benutzer auf {p} setzen? Frei: {f}.', { p: z.pfad, f: gbText(z.frei_gb) })) +
      (z.systemlaufwerk ? ' <b>' + esc(uebersetze('Das ist das Systemlaufwerk.')) + '</b>' : '') + ' ' +
      esc(uebersetze('Gilt nach einem Neustart von Ollama; vorhandene Modelle bleiben im alten Ordner.')) + '</p>' +
      '<button type="button" class="knopf primaer klein" data-aktion="e-ordner-ja">' + esc(uebersetze('Ja, setzen')) + '</button> ' +
      '<button type="button" class="knopf klein" data-aktion="e-ordner-nein">' + esc(uebersetze('Abbrechen')) + '</button></div>';
  } else if (mv.ordner != null && o.aendern) {
    unten = '<div class="zeile"><input class="eingabe mono" id="e-ordner" value="' + esc(mv.ordner) + '" maxlength="200" spellcheck="false" aria-label="' + esc(uebersetze('Neuer Modellordner')) + '" aria-describedby="m-mv:ordner" placeholder="D:\\Ollama\\models">' +
      '<button type="button" class="knopf klein" data-aktion="e-ordner-pruefen">' + esc(uebersetze('Prüfen')) + '</button></div>';
  }
  return '<div class="einst-feld"><span class="l">' + esc(uebersetze('Modellordner')) + '<small>' + esc(fuelle('Quelle: {q} · frei {f}', { q: uebersetze(o.quelle === 'standard' ? 'Standard von Ollama' : 'OLLAMA_MODELS'), f: gbText(o.frei_gb) })) + '</small></span>' +
    '<div class="w"><div class="zeile"><span class="mono">' + esc(o.pfad) + '</span>' + warn +
      (o.aendern && mv.ordner == null && !mv.ordnerFrage ? '<button type="button" class="knopf klein" data-aktion="e-ordner-aendern">' + esc(uebersetze('Ändern')) + '</button>' : '') + '</div>' +
      unten + feldMeldung('mv:ordner') + '</div></div>';
}
function ladenZeile(M) {
  if (!M || M.laufzeit !== 'ollama') {
    return '<p class="dim">' + esc(uebersetze(M && M.erreichbar ? 'Modelle laden geht hier nur mit Ollama — LM Studio und andere laden in ihrer eigenen Oberfläche.' : 'Modelle laden: erst den Modellserver starten.')) + '</p>';
  }
  const mv = ez.mv;
  let unten = '';
  if (mv.fort) {
    const f = mv.fort;
    const pz = f.gesamt ? Math.round((f.fertig || 0) / f.gesamt * 100) : null;
    unten = '<div class="e-fort"><label for="e-fort">' + esc(f.name + ' · ' + (f.status || '')) + (pz != null ? ' · ' + pz + ' %' : '') + '</label>' +
      '<progress id="e-fort"' + (pz != null ? ' max="100" value="' + pz + '"' : '') + '></progress></div>';
  } else if (mv.ladeFrage) {
    const z = mv.ladeFrage.ziel || {};
    unten = '<div class="e-frage" role="group" aria-label="' + esc(uebersetze('Modell laden')) + '"><p>' +
      esc(fuelle('{n} herunterladen nach {p}? Frei: {f}. Modelle brauchen oft mehrere GB.', { n: mv.ladeFrage.name, p: z.pfad || uebersetze('den Ordner des Modellservers'), f: gbText(z.frei_gb) })) +
      (mv.ladeFrage.fremd ? ' <b>' + esc(uebersetze('Fremdes Repo auf HuggingFace — nur laden, wenn du der Quelle traust.')) + '</b>' : '') +
      (z.systemlaufwerk ? ' <b>' + esc(uebersetze('Das ist das Systemlaufwerk — Ordner vorher ändern?')) + '</b>' : '') + '</p>' +
      '<button type="button" class="knopf primaer klein" data-aktion="e-laden-ja">' + esc(uebersetze('Ja, laden')) + '</button> ' +
      '<button type="button" class="knopf klein" data-aktion="e-laden-nein">' + esc(uebersetze('Abbrechen')) + '</button></div>';
  }
  return '<div class="einst-feld"><span class="l">' + esc(uebersetze('Modell laden')) + '<small>' + esc(uebersetze('Name aus der Ollama-Bibliothek oder hf.co/nutzer/repo:Q4_K_M')) + '</small></span>' +
    '<div class="w"><div class="zeile"><input class="eingabe mono" id="e-laden" maxlength="160" spellcheck="false" placeholder="qwen3:8b" aria-label="' + esc(uebersetze('Modellname')) + '" aria-describedby="m-mv:laden"' + (mv.fort ? ' disabled' : '') + '>' +
      '<button type="button" class="knopf klein" data-aktion="e-laden"' + (mv.fort ? ' disabled' : '') + '>' + esc(uebersetze('Laden')) + '</button></div>' + unten + feldMeldung('mv:laden') + '</div></div>';
}
function modellVerwaltungHtml() {
  if (!ez.mod.d) { ladeModelle(); return ez.mod.fehler ? '<p class="dim">' + esc(ez.mod.fehler) + '</p>' : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>'; }
  const M = ez.mod.d;
  const server = !M.eingerichtet ? uebersetze('nicht eingerichtet (lokaleModelle in config.json)') : M.erreichbar ? (LAUFZEIT[M.laufzeit] || M.laufzeit) + ' · ' + fuelle('{n} Modelle', { n: M.modelle.length }) : (M.fehler || '');
  return '<div class="einst-feld"><span class="l">' + esc(uebersetze('Modellserver')) + '<small>' + esc(server) + '</small></span><div class="w"><div class="zeile">' +
      '<button type="button" class="knopf klein" data-aktion="e-modelle-neu">' + esc(uebersetze('Liste aktualisieren')) + '</button></div></div></div>' +
    ordnerZeile(M.ordner) + ladenZeile(M);
}
const mvMeldung = (key, fehler) => { if (fehler) kz.fehler[key] = fehler; else delete kz.fehler[key]; };
aktion('e-ordner-aendern', () => { ez.mv.ordner = (ez.mod.d && ez.mod.d.ordner && ez.mod.d.ordner.pfad) || ''; zeichneAnsicht(); const i = document.getElementById('e-ordner'); if (i) i.focus(); });
aktion('e-ordner-nein', () => { ez.mv.ordner = null; ez.mv.ordnerFrage = null; mvMeldung('mv:ordner'); zeichneAnsicht(); });
aktion('e-ordner-pruefen', (_, el) => mitLauf(el, async () => {
  const i = document.getElementById('e-ordner');
  ez.mv.ordner = i ? i.value.trim() : '';
  if (i) i.blur();
  try { ez.mv.ordnerFrage = await sende('/api/modelle/ordner', { pfad: ez.mv.ordner }); mvMeldung('mv:ordner'); } catch (err) { mvMeldung('mv:ordner', err.message); }
  zeichneAnsicht();
}));
aktion('e-ordner-ja', (_, el) => mitLauf(el, async () => {
  try {
    const r = await sende('/api/modelle/ordner', { pfad: ez.mv.ordnerFrage.ziel.pfad, bestaetigt: true });
    toast(uebersetze(r.hinweis || 'Gesetzt'), 'ok');
    ez.mv.ordner = null; ez.mv.ordnerFrage = null; mvMeldung('mv:ordner');
    ez.mod.d = null;
  } catch (err) { mvMeldung('mv:ordner', err.message); ez.mv.ordnerFrage = null; }
  zeichneAnsicht();
}));
aktion('e-laden', (_, el) => mitLauf(el, async () => {
  const i = document.getElementById('e-laden');
  const name = i ? i.value.trim() : '';
  if (i) i.blur();
  try { ez.mv.ladeFrage = await sende('/api/modelle/laden', { name }); mvMeldung('mv:laden'); } catch (err) { mvMeldung('mv:laden', err.message); }
  zeichneAnsicht();
}));
aktion('e-laden-nein', () => { ez.mv.ladeFrage = null; zeichneAnsicht(); });
aktion('e-laden-ja', async () => {
  if (!ez.mv.ladeFrage) return;   // Doppelklick
  const name = ez.mv.ladeFrage.name;
  ez.mv.ladeFrage = null;
  ez.mv.fort = { name, status: uebersetze('startet …') };
  zeichneAnsicht();
  // NDJSON: eine Zeile je Fortschritt; der Fortschrittsbalken wird direkt aktualisiert, nicht neu gezeichnet.
  let fehler = null, fertig = false, lesen = null;
  try {
    const r = await fetch('/api/modelle/laden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, bestaetigt: true }) });
    if (!r.ok || !r.body) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'HTTP ' + r.status); }
    lesen = r.body.getReader();
    const dec = new TextDecoder();
    let rest = '';
    for (;;) {
      const { value, done } = await lesen.read();
      if (done) break;
      rest += dec.decode(value, { stream: true });
      const zeilen = rest.split('\n');
      rest = zeilen.pop();
      for (const z of zeilen) {
        if (!z.trim()) continue;
        let o;
        try { o = JSON.parse(z); } catch { fehler = uebersetze('Ungültige Serverantwort') + ': ' + z.slice(0, 80); continue; }
        if (o.typ === 'fehler') fehler = o.error;
        else if (o.typ === 'fertig') fertig = true;
        else if (o.typ === 'fortschritt') {
          ez.mv.fort = { name, status: o.status, gesamt: o.gesamt, fertig: o.fertig };
          const p = document.getElementById('e-fort'), l = document.querySelector('label[for="e-fort"]');
          const pz = o.gesamt ? Math.round((o.fertig || 0) / o.gesamt * 100) : null;
          if (p && pz != null) { p.max = 100; p.value = pz; }
          if (l) l.textContent = name + ' · ' + (o.status || '') + (pz != null ? ' · ' + pz + ' %' : '');
        }
      }
    }
  } catch (err) { fehler = err.message; } finally { if (lesen) lesen.cancel().catch(() => {}); }
  // Strom zu Ende ohne Abschluss (Server neu gestartet): kein gruener Haken (Silent-Failure H1).
  if (!fehler && !fertig) fehler = uebersetze('Verbindung zum Server abgebrochen — ob das Modell vollständig geladen ist, zeigt „Liste aktualisieren“.');
  ez.mv.fort = null;
  mvMeldung('mv:laden', fehler);
  if (!fehler) { toast(fuelle('{n} geladen', { n: name }), 'ok'); ez.mod.d = null; }
  zeichneAnsicht();
});

aktion('e-cira-claude', () => speichereCira('claudeErlaubt', !(ez.cira.d && ez.cira.d.cira.claudeErlaubt === true)));
aktion('e-cira-modell', (m) => speichereCira('claudeModell', m));
aktion('e-cira-orb', (s) => speichereCira('orbStil', s));
aktion('e-cira-vorlesen', (s) => speichereCira('antwortenVorlesen', s));
aktion('e-cira-stimme', (s) => speichereCira('stimmeAnbieter', s));
aktion('e-cira-probe', () => sprich(uebersetze('Hallo, ich bin Cira. So klinge ich.'), 'probe'));
// Die Stimmenliste kommt im Browser oft erst nach dem ersten Zeichnen.
if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener('voiceschanged', () => { if (route().name === 'einstellungen' && document.getElementById('e-browserstimme')) zeichneAnsicht(); });
// Einschalten nur mit Erlaubnis des Browsers: sonst stuende "an" da und es kaeme nie etwas.
aktion('e-cira-desktop', async () => {
  const an = !(ez.cira.d && ez.cira.d.cira.benachrichtigungDesktop === true);
  if (an) {
    if (typeof Notification === 'undefined') { toast(uebersetze('Dieser Browser kennt keine Desktop-Benachrichtigungen.'), 'warn'); return; }
    const erlaubt = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (erlaubt !== 'granted') { toast(uebersetze('Der Browser erlaubt keine Benachrichtigungen. In den Seiten-Einstellungen freigeben und erneut einschalten.'), 'warn'); return; }
  }
  speichereCira('benachrichtigungDesktop', an);
});

function datenHtml() {
  const z = ez.csv || (ez.csv = { von: aktuellerZeitraum().von, bis: aktuellerZeitraum().bis });
  const jira = !!(state.summary && state.summary.config && state.summary.config.jiraBaseUrl);
  const zeile = (titel, unter, rechts) => '<div class="daten-zeile"><span class="l">' + esc(uebersetze(titel)) + '<small>' + unter + '</small></span><div class="r">' + rechts + '</div></div>';
  return zeile('CSV-Export', esc(uebersetze('Vorgänge mit Stunden, Arbeitswert und Kosten im gewählten Zeitraum')),
      '<input type="date" class="eingabe" id="e-csv-von" value="' + esc(z.von) + '" aria-label="' + esc(uebersetze('von')) + '">' +
      '<input type="date" class="eingabe" id="e-csv-bis" value="' + esc(z.bis) + '" aria-label="' + esc(uebersetze('bis')) + '">' +
      '<a class="knopf" id="e-csv" href="/api/export.csv?' + esc(abfrage({ from: z.von, to: z.bis })) + '" download>' + esc(uebersetze('CSV laden')) + '</a>') +
    zeile('Jira-Abgleich', esc(uebersetze(jira ? 'Arbeitswert und Status der Vorgänge nach Jira schreiben' : 'Jira ist in config.json nicht eingeschaltet.')),
      jira ? '<button type="button" class="knopf" data-aktion="e-jira">' + esc(uebersetze('Jetzt abgleichen')) + '</button>' : '') +
    zeile('Datenbank', '<span class="mono">data/ledger.db</span> · ' + esc(uebersetze('Zugänge und Pfade nur in')) + ' <span class="mono">' + esc((ez.e.d && ez.e.d.pfad) || 'config.json') + '</span>', '');
}
aktion('e-jira', (_, el) => mitLauf(el, async () => {
  try {
    const r = await sende('/api/jira-sync', {});
    toast(uebersetze('Jira-Abgleich gelaufen') + (r.aktualisiert != null ? ': ' + r.aktualisiert : ''), 'ok');
    neuLaden();
  } catch (err) { toast(uebersetze('Jira-Abgleich fehlgeschlagen') + ': ' + err.message, 'err'); }
}));

/* ---------- Suche ---------- */
function suchTreffer(q) {
  const qq = falte(q.trim());
  if (!qq) return [];
  const T = [];
  for (const a of E_ABSCHNITTE) {
    const W = a.stamm ? sWerte() : eWerte();
    for (const f of a.stamm ? Object.keys(W) : a.felder || []) {
      const r = W[f];
      if (!r) continue;
      const text = [uebersetze(r.label), r.label, uebersetze(E_HINWEIS[f] || '')].join(' ');
      if (falte(text).includes(qq)) T.push({ a, f, l: uebersetze(r.label), h: uebersetze(E_HINWEIS[f] || '') });
    }
    if (a.kw && falte([uebersetze(a.l), a.l, a.kw].join(' ')).includes(qq)) T.push({ a, f: '', l: uebersetze(a.l), h: uebersetze(a.sub) });
  }
  return T;
}
aktion('e-springe', (wert) => {
  const [id, f] = String(wert).split(':');
  if (!E_ABSCHNITTE.some((a) => a.id === id)) return;
  ez.q = '';
  ez.hl = f || null;
  ez.fokus = f || null;
  geheZu('einstellungen/' + id);
  const hl = ez.hl;
  setTimeout(() => { if (ez.hl === hl) { ez.hl = null; const z = document.querySelector('.einst-feld.hl'); if (z) z.classList.remove('hl'); } }, 2600);
});

/* ---------- Geraete (S1) ----------
   Nur gekoppelte Geraete schreiben; der Code zum Koppeln erscheint auf dem
   Desktop. Entfernen entwertet das Token sofort. */
const egZ = { d: null, fehler: null, laedt: false };
const ladeGeraete = () => eLade(egZ, '/api/geraete', (d) => (d && Array.isArray(d.geraete) ? d.geraete : null));
function geraeteHtml() {
  if (!egZ.d) {
    ladeGeraete();
    return egZ.fehler ? leer('liste', 'Geräte nicht geladen', egZ.fehler, '<button type="button" class="knopf klein" data-aktion="e-geraete-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  }
  const dieses = egZ.d.some((g) => g.dieses);
  return '<p class="dim">' + esc(uebersetze('Schreiben (Freigaben, Sitzungen, Rechnungen, Einstellungen) geht nur von gekoppelten Geräten. Lesen bleibt frei, auch für Obsidian und Jarvis.')) + '</p>' +
    (dieses ? '' : '<p><button type="button" class="knopf primaer" data-aktion="koppeln">' + esc(uebersetze('Dieses Gerät koppeln')) + '</button></p>') +
    (egZ.d.length ? '<table class="tabelle eg-tabelle"><thead><tr><th scope="col">' + esc(uebersetze('Gerät')) + '</th><th scope="col">' + esc(uebersetze('Art')) + '</th><th scope="col">' + esc(uebersetze('Gekoppelt')) + '</th><th scope="col">' + esc(uebersetze('Zuletzt')) + '</th><th scope="col" aria-label="' + esc(uebersetze('Aktion')) + '"></th></tr></thead><tbody>' +
      egZ.d.map((g) => '<tr><td>' + esc(g.name) + (g.dieses ? ' <span class="pille an">' + esc(uebersetze('dieses Gerät')) + '</span>' : '') + '</td><td>' + esc(uebersetze(g.art === 'client' ? 'Programm' : 'Browser')) + '</td>' +
        '<td class="mono">' + esc(datumKurz(g.erstellt)) + '</td><td class="mono">' + esc(g.zuletzt ? vor(g.zuletzt) : '–') + '</td>' +
        '<td><button type="button" class="knopf klein" data-aktion="e-geraet-weg" data-wert="' + g.id + '" aria-label="' + esc(uebersetze('Entfernen') + ': ' + g.name) + '">' + esc(uebersetze('Entfernen')) + '</button></td></tr>').join('') +
      '</tbody></table>' : '<p class="dim">' + esc(uebersetze('Noch kein Gerät gekoppelt.')) + '</p>');
}
aktion('e-geraete-neu', () => { egZ.fehler = null; egZ.d = null; zeichneAnsicht(); });
aktion('e-geraet-weg', async (id, knopf) => {
  const g = (egZ.d || []).find((x) => String(x.id) === String(id));
  if (g && g.dieses && !confirm(uebersetze('Dieses Gerät entfernen? Danach kann dieser Browser erst nach erneutem Koppeln wieder schreiben.'))) return;
  await mitLauf(knopf, async () => {
    try { await sende('/api/geraet/' + encodeURIComponent(id) + '/entfernen', {}); toast(uebersetze('Gerät entfernt')); } catch (err) { toast(uebersetze('Entfernen fehlgeschlagen') + ': ' + err.message, 'err'); }
    egZ.d = null;
    // Eigenes Geraet: sofort "nur lesen" zeigen, nicht erst nach der Nachpruefung.
    if (g && g.dieses) { state.kopplung = false; zeichneBanner(); pruefeKopplung(); }
    zeichneAnsicht();
  });
});
window.addEventListener('c2-gekoppelt', () => { egZ.d = null; if (route().name === 'einstellungen') zeichneAnsicht(); });

/* ---------- Seite ---------- */
function zeichneEinstellungen(w, teile) {
  const gemerkt = lies('einstellungen.abschnitt', 'allgemein');
  const A = E_ABSCHNITTE.find((a) => a.id === teile[0]) || E_ABSCHNITTE.find((a) => a.id === gemerkt) || E_ABSCHNITTE[0];
  merke('einstellungen.abschnitt', A.id);
  // Hintergrund-Nachladen unterbricht keine Eingabe; die Entwuerfe stehen im Zustand.
  const a = document.activeElement;
  if (a && w.contains(a) && a.matches('.einst-inhalt input, .einst-inhalt textarea') && w.dataset.abschnitt === A.id) return;
  w.dataset.abschnitt = A.id;
  if (!ez.e.d && !ez.e.fehler) ladeEinst();
  // Beide immer: die Suche reicht ueber alle Abschnitte.
  if (!ez.s.d && !ez.s.fehler) ladeStamm();
  if (A.id === 'projekte') ladeSaetze();
  const suche = sucheVorher('e-suche');
  const fv = fokusMerken(w);
  let gruppe = null;
  const nav = '<nav aria-label="' + esc(uebersetze('Einstellungen')) + '">' + E_ABSCHNITTE.map((x) => {
    const g = x.g !== '' && x.g !== gruppe ? (gruppe = x.g, '<span class="g">' + esc(uebersetze(x.g)) + '</span>') : '';
    return g + '<a href="#/einstellungen/' + x.id + '"' + (x.id === A.id && !ez.q ? ' aria-current="page"' : '') + '>' + esc(uebersetze(x.l)) + '</a>';
  }).join('') + '</nav>';

  let inhalt;
  if (ez.q.trim()) {
    const T = suchTreffer(ez.q);
    inhalt = '<div class="einst-karte"><span class="ueberzeile">' + esc(uebersetze('Treffer')) + '</span>' +
      (T.length ? T.map((t) => '<button type="button" class="e-treffer" data-aktion="e-springe" data-wert="' + esc(t.a.id + ':' + t.f) + '">' +
        '<span class="faint">' + esc(uebersetze(t.a.l)) + '</span><span><b>' + esc(t.l) + '</b>' + (t.h ? '<small>' + esc(t.h) + '</small>' : '') + '</span></button>').join('')
        : '<span class="dim">' + esc(uebersetze('Nichts gefunden.')) + '</span>') + '</div>';
  } else {
    let k;
    if (A.felder) {
      k = ez.e.fehler ? leer('liste', 'Einstellungen nicht geladen', ez.e.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
        : !ez.e.d ? '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>' : A.felder.map((f) => feldZeile(f, false)).join('') + (A.id === 'lokal' ? modellVerwaltungHtml() : '');
    } else if (A.stamm) {
      k = ez.s.fehler ? leer('liste', 'Stammdaten nicht geladen', ez.s.fehler, '<button type="button" class="knopf klein" data-aktion="e-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>')
        : !ez.s.d ? '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>' : fehltHtml() + Object.keys(sWerte()).map((f) => feldZeile(f, true)).join('');
    } else if (A.id === 'projekte') {
      k = sz.d ? satzTabelle(sz.d.projekte.map((p) => p.project).sort((x, y) => x.localeCompare(y)), true, false) : satzTabelle([], true, false);
    } else if (A.id === 'vorlagen') k = vorlagenHtml();
    else if (A.id === 'taet') k = taetHtml();
    else if (A.id === 'darstellung') k = darstellungHtml();
    else if (A.id === 'arbeitsbereiche') k = arbeitsbereicheHtml();
    else if (A.id === 'geraete') k = geraeteHtml();
    else if (A.id === 'cira') k = ciraHtml();
    else if (A.id === 'kalender') k = '<div id="e-zkal" class="zkal"></div>';
    else k = datenHtml();
    inhalt = '<div class="einst-karte"><div class="einst-kopf"><h2>' + esc(uebersetze(A.l)) + '</h2><span class="sub">' + esc(uebersetze(A.sub)) + '</span>' +
      '<span class="rechts">' + esc(uebersetze('Änderungen speichern sofort')) + '</span></div>' + k + '</div>';
  }
  w.innerHTML = '<div class="einst"><div class="einst-nav">' +
      '<input type="search" class="suche-feld" id="e-suche" value="' + esc(ez.q) + '" placeholder="' + esc(uebersetze('Einstellung suchen …')) + '" aria-label="' + esc(uebersetze('Einstellung suchen …')) + '">' + nav +
    '</div><div class="einst-inhalt">' + inhalt + '</div></div>';
  verdrahteSuche(w, 'e-suche', (v) => { ez.q = v; }, suche);
  fokusZurueck(w, fv);
  if (!ez.q.trim() && A.id === 'kalender') zKalLaden();
  // Sprung aus der Suche: erst nach dem Zeichnen gibt es das Feld.
  if (ez.fokus) {
    const el = w.querySelector('#ef-' + CSS.escape(ez.fokus)) || w.querySelector('[data-feldzeile="' + CSS.escape(ez.fokus) + '"] button');
    ez.fokus = null;
    if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
  }
  const wurzel = w.querySelector('.einst-inhalt');
  verdrahteSaetze(wurzel);
  wurzel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.efeld) kz.entwurf[eKey(t.dataset.efeld)] = t.value;
    else if (t.dataset.vorlfeld) kz.entwurf['v:' + t.dataset.vorl + ':' + t.dataset.vorlfeld] = t.value;
    else if (t.dataset.taetfeld) kz.entwurf['ta:' + t.dataset.taet + ':' + t.dataset.taetfeld] = t.value;
    else if (t.dataset.abfeld) kz.entwurf['ab:' + t.dataset.ab + ':' + t.dataset.abfeld] = t.value;
    else if (t.dataset.cirafeld) kz.entwurf['cira:' + t.dataset.cirafeld] = t.value;
  });
  wurzel.addEventListener('focusout', (e) => {
    const t = e.target;
    if (t.dataset.efeld) {
      const x = abschnittVon(t.dataset.efeld);
      if (x) speichereAbschnitt(x);
    } else if (t.dataset.vorlfeld) {
      const zeile = t.closest('[data-vorlzeile]');
      if (e.relatedTarget && zeile && zeile.contains(e.relatedTarget)) return;
      speichereVorlage(t.dataset.vorl);
    } else if (t.dataset.taetfeld) {
      const zeile = t.closest('[data-taetzeile]');
      if (e.relatedTarget && zeile && zeile.contains(e.relatedTarget)) return;
      speichereTaet(t.dataset.taet);
    }
  });
  wurzel.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || t.tagName === 'TEXTAREA') return;
    if (t.dataset.efeld) { e.preventDefault(); const x = abschnittVon(t.dataset.efeld); if (x) speichereAbschnitt(x); }
    else if (t.dataset.vorlfeld) { e.preventDefault(); speichereVorlage(t.dataset.vorl); }
    else if (t.dataset.taetfeld) { e.preventDefault(); speichereTaet(t.dataset.taet); }
  });
  wurzel.addEventListener('change', (e) => {
    // Textfelder melden change beim Verlassen oder Enter, das Farbfeld beim Schliessen der Auswahl.
    if (e.target.dataset.abfeld) return speichereArbeitsbereich(e.target.dataset.ab, e.target.dataset.abfeld, e.target.value.trim());
    if (e.target.dataset.cirafeld) return speichereCira(e.target.dataset.cirafeld, e.target.value.trim());
    if (e.target.id === 'e-browserstimme') { merke('stimme', e.target.value); return; }
    if (e.target.id !== 'e-csv-von' && e.target.id !== 'e-csv-bis') return;
    const von = document.getElementById('e-csv-von').value, bis = document.getElementById('e-csv-bis').value;
    if (!von || !bis) return;
    ez.csv = { von, bis };
    document.getElementById('e-csv').href = '/api/export.csv?' + abfrage({ from: von, to: bis });
  });
}
aktion('e-neu', () => { ez.e.fehler = null; ez.s.fehler = null; ez.v.fehler = null; ez.t.fehler = null; ez.ab.fehler = null; zeichneAnsicht(); });

registriere('einstellungen', { zeichne: zeichneEinstellungen });
