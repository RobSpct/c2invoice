'use strict';
/* Seite Zeiterfassung: Timer, Heute, Wochenkennzahlen, Woche/Monat/Nach Ziel,
   Eintraege, Nachtrag-Dialog und Ziel-Auswahl. Gerechnet wird in zeit.js auf
   dem Server (Ueberlappung, Rundung, Satz, Betrag); hier wird nur dargestellt
   und summiert, was je Eintrag schon feststeht. Termine (Geister, Termin-Dialog,
   Kalender-Dialog) seit Block Z7a; ein Termin wird nie ohne Klick gebucht. */

Object.assign(EN, {
  'Timer läuft': 'Timer running', 'Kein Timer aktiv': 'No timer running', 'seit': 'since', 'Uhr': '',
  'Ziel wählen und starten — oder Zeit nachtragen': 'Pick a target and start — or add time manually',
  'Buchen auf': 'Book to', 'suchen ⌕': 'search ⌕', 'Ziel wählen': 'Choose target',
  'Notiz — erscheint auf der Rechnungsposition': 'Note — appears on the invoice line',
  '▶  Starten': '▶  Start', '■  Stoppen und buchen': '■  Stop and book', '+ Zeit nachtragen': '+ Add time',
  'Stoppen und buchen': 'Stop and book', 'Timer': 'Timer', 'Zur Zeiterfassung': 'Go to time tracking', 'läuft': 'running',
  'Nicht abrechenbar · zählt als Selbstkosten': 'Not billable · counts as own cost', 'Satz': 'Rate', 'aus': 'from',
  'Standardsatz': 'default rate', 'Rundung': 'Rounding', 'aus Tätigkeit': 'from activity',
  'Gleichzeitig läuft Claude-Sitzung': 'Claude session running at the same time:', 'Zeitmodell': 'time model',
  'Regel je Sitzung aus Zeitmodell.': 'Rule per session from its time model.',
  'Abrechnen bei Überlappung': 'Billing on overlap', 'gewählt · gilt beim Stoppen und Buchen': 'chosen · applies when stopping and booking',
  'Standard bei Meetings: Beides': 'Default for meetings: both', 'Standard: Regel aus dem Zeitmodell': 'Default: rule from the time model',
  'Beides': 'Both', 'Nur Claude': 'Claude only', 'Nur meine Zeit': 'My time only', 'Keins': 'Neither',
  'Claude und du': 'Claude and you', 'deine Minuten entfallen': 'your minutes drop', 'Claude-Minuten entfallen': 'Claude minutes drop',
  'Kulanz · 0,00 EUR': 'Goodwill · 0.00 EUR',
  'Claude und deine Zeit werden beide abgerechnet.': 'Claude and your time are both billed.',
  'Deine überlappenden Minuten entfallen, Claude rechnet ab.': 'Your overlapping minutes drop, Claude bills.',
  'Claudes überlappende Minuten entfallen, deine Zeit rechnet ab.': "Claude's overlapping minutes drop, your time bills.",
  'Beide entfallen — auf der Rechnung als Kulanz mit 0,00 EUR.': 'Both drop — shown on the invoice as goodwill at 0.00 EUR.',
  'Eigene Zeit': 'Own time', 'Aktivität': 'Activity', 'Sitzung': 'Session',
  'gewählt': 'chosen', 'Kalendertermin, Claude arbeitet nebenher': 'Calendar event, Claude works alongside',
  'Meeting, Claude arbeitet nebenher': 'Meeting, Claude works alongside', 'Fokusarbeit am Gerät, nur einmal zählbar': 'Focus work at the machine, counts once',
  'gleiches Ziel, sonst doppelt': 'same target, otherwise double', 'Agent lief allein, anderes Ziel': 'Agent ran alone, other target',
  'Kulanz': 'Goodwill', 'bei Claude abgezogen': 'deducted from Claude', 'abgezogen': 'deducted', 'parallel': 'parallel',
  'Tagessoll': 'Daily target', 'h Arbeitszeit': 'h working time', 'noch': 'still', 'h bis Soll': 'h to target', 'Soll erfüllt': 'Target met',
  'Abrechenbar': 'Billable', 'Parallel abgerechnet': 'Billed in parallel', 'Meeting + Claude': 'Meeting + Claude',
  'Nicht abrechenbar': 'Not billable', 'Intern': 'Internal', 'Manuell': 'Manual', 'Claude': 'Claude',
  'jetzt': 'now', 'Min parallel': 'min parallel', 'Min parallel zu Claude': 'min parallel to Claude',
  'Abrechenbar diese Woche': 'Billable this week', 'manuell': 'manual', 'Arbeitszeit diese Woche': 'Working time this week',
  'Soll': 'Target', 'Parallelzeit nur einmal': 'parallel time once', 'intern': 'internal',
  'Offen zur Abrechnung': 'Open for billing', 'Einträge, alle Zeiträume': 'entries, all periods',
  'Gleichzeitig mit Claude': 'At the same time as Claude', 'Min abgezogen': 'min deducted',
  'Regel aus Zeitmodell und Tätigkeit': 'rule from time model and activity',
  'Nach Ziel': 'By target', 'Ansicht': 'View', 'Vorige Woche': 'Previous week', 'Nächste Woche': 'Next week', 'Diese Woche': 'This week',
  'alle Einträge, gruppiert nach Vorgang, Projekt, Kunde': 'all entries, grouped by job, project, customer',
  'manuell abrechenbar': 'manual, billable', 'nicht abrechenbar': 'not billable',
  'Claude · Eigene Zeit': 'Claude · own time', 'Claude · Aktivität': 'Claude · activity', 'parallel abgerechnet': 'billed in parallel',
  'Klick oder Ziehen trägt Zeit nach': 'Click or drag to add time', 'Woche, Stundenraster': 'Week, hourly grid',
  'gezählt': 'counted', 'Claude-Sitzung': 'Claude session', 'Laufender Timer': 'Running timer',
  'Arbeitszeit': 'Working time', 'von': 'of', 'Saldo': 'Balance', 'Soll erfüllt an': 'Target met on', 'Tagen': 'days',
  'Balken: Claude ■ · manuell ■ · Zahl oben rechts: Abweichung vom Tagessoll · Arbeitszeit zählt Parallelzeit nur einmal':
    'Bars: Claude ■ · manual ■ · top right: deviation from daily target · working time counts parallel time once',
  'heute': 'today', 'Alle Ziele': 'All targets', 'Offene Vorgänge': 'Open jobs', 'Abgeschlossene': 'Closed',
  'Ziel': 'Target', 'Art': 'Type', 'Einträge': 'Entries', 'Offen': 'Open', 'Abger.': 'Billed', 'Offen EUR': 'Open EUR', 'Status': 'Status',
  'Klick auf eine Zeile filtert die Einträge darunter.': 'Click a row to filter the entries below.',
  'Keine Einträge in diesem Zeitraum.': 'No entries in this period.',
  'Alle': 'All', 'Datum': 'Date', 'Zeit': 'Time', 'Tätigkeit': 'Activity', 'Notiz': 'Note', 'Gezählt': 'Counted',
  'Überlappung': 'Overlap', 'Betrag': 'Amount', 'gesperrt': 'locked', 'Offene abrechnen →': 'Bill open entries →',
  'Keine Einträge in diesem Filter.': 'No entries in this filter.', 'Summe': 'Total', 'Ziel-Filter entfernen': 'Remove target filter',
  'Vorgang': 'Job', 'Projekt': 'Project', 'Kunde': 'Customer', 'Lead': 'Lead',
  'Zeit nachtragen': 'Add time', 'Eintrag bearbeiten': 'Edit entry', 'Eintrag · gesperrt': 'Entry · locked',
  'Abgerechnet mit Rechnung': 'Billed with invoice', '— gesperrt, Satz eingefroren. Korrektur nur per Gutschrift.': '— locked, rate frozen. Correct only via credit note.',
  'Tag': 'Day', 'Termin- / Blockerzeit': 'Event / blocker time', 'Beginn': 'Start', 'Ende': 'End', 'Pause (Min)': 'Break (min)',
  'Time Split Art': 'Time split', 'Nach Uhrzeit': 'By clock time', 'Feste Dauer': 'Fixed duration', '1:30 oder 1,5': '1:30 or 1.5',
  'Gezählt wird die tatsächlich verstrichene Zeit im Termin — minus Pause und Überlappung, gerundet auf 5 Min.':
    'Counted is the time actually elapsed — minus break and overlap, rounded.',
  'Gezählt wird die feste Dauer, sobald der Termin begonnen hat — unabhängig davon, wie lange er wirklich dauert.':
    'Counted is the fixed duration once it has started — regardless of how long it really takes.',
  'Intern ist nie abrechenbar': 'Internal is never billable', 'fließt in Arbeitswert und Rechnung': 'flows into work value and invoice',
  'zählt nur als Selbstkosten': 'counts as own cost only',
  'Gleichzeitig lief Claude': 'Claude ran at the same time', 'Regel aus Zeitmodell der Sitzung und Art der Tätigkeit': 'Rule from the session time model and the activity',
  'Noch keine Wahl — Regel aus Zeitmodell und Tätigkeit': 'No choice yet — rule from time model and activity',
  'Termin': 'Event', 'Pause': 'Break', 'Abzug': 'Deduction', 'Parallel': 'Parallel', 'Gezählt · auf': 'Counted · per',
  'Löschen': 'Delete', 'Abbrechen': 'Cancel', 'Schließen': 'Close', 'Buchen': 'Book',
  'Ziel fehlt.': 'Target missing.', 'Termin-Uhrzeit im Format HH:MM.': 'Time as HH:MM.', 'Ende liegt vor dem Beginn.': 'End is before start.',
  'Feste Dauer als 1:30 oder 1,5 angeben.': 'Enter fixed duration as 1:30 or 1.5.', 'Pause ist länger als die Zeit.': 'Break is longer than the time.',
  'Gebucht': 'Booked', 'Geändert': 'Changed', 'auf': 'to', 'Eintrag gelöscht': 'Entry deleted', 'Nicht gespeichert': 'Not saved',
  'Buchen auf …': 'Book to …', 'Ziele': 'targets', 'Nummer, Titel, Projekt oder Kunde — z. B. NW-12 oder Kundenportal': 'Number, title, project or customer — e.g. NW-12 or customer portal',
  'Zuletzt': 'Recent', 'Vorgänge': 'Jobs', 'Projekte': 'Projects', 'Kunden': 'Customers', 'Offene': 'Open',
  'Kein Treffer. Neue Vorgänge entstehen automatisch, sobald Claude darauf bucht — oder über Einstellungen → Projekte.':
    'No match. New jobs appear automatically as soon as Claude books to them — or via Settings → Projects.',
  'Keine Treffer in diesem Bereich.': 'No matches in this section.', 'Enter wählt den ersten Treffer · Esc schließt': 'Enter picks the first match · Esc closes',
  'Timer gebucht': 'Timer booked', 'Timer verworfen (unter 1 Min)': 'Timer discarded (under 1 min)', 'Rückgängig': 'Undo',
  'Timer läuft weiter': 'Timer continues', 'Timer nicht gebucht': 'Timer not booked', 'Timer nicht gestartet': 'Timer not started',
  'Rückgängig fehlgeschlagen': 'Undo failed', 'Wahl nicht gespeichert': 'Choice not saved', 'Zeiterfassung nicht geladen': 'Time tracking not loaded',
  'Erneut versuchen': 'Try again', 'Lädt …': 'Loading …',
  'Noch keine Zeit erfasst': 'No time recorded yet',
  'Starte den Timer oder trage Zeit nach — manuelle Arbeitszeit fließt in Arbeitswert, Marge und Rechnung.':
    'Start the timer or add time — manual working time flows into work value, margin and invoice.',
  'Zeiteinträge nicht nachgerechnet': 'Time entries not recalculated', 'Timer starten': 'Start timer', 'Zeiterfassung': 'Time tracking',
  'KW': 'CW', 'Timer lässt sich so nicht buchen': 'Timer cannot be booked like this', 'Timer verwerfen': 'Discard timer',
  'Danach die Zeit nachtragen.': 'Then add the time manually.', 'Nicht aktualisiert': 'Not updated',
  'Laufenden Timer verwerfen? Die Zeit wird nicht gebucht.': 'Discard the running timer? The time will not be booked.',
  'Timer nicht verworfen': 'Timer not discarded', 'Laufender Timer gebucht': 'Running timer booked',
  'Eintrag nicht gefunden — Liste wird neu geladen.': 'Entry not found — reloading the list.',
  'Arbeitszeit heute': 'Working time today', 'Bei Überlappung': 'On overlap', 'Zeiteintrag': 'Time entry', 'Wahl gespeichert': 'Choice saved',
  // Termine und Kalender (Z7a)
  'Termine': 'Events', 'Meeting': 'Meeting', 'Blocker': 'Blocker', '+ buchen': '+ book', '+ Termin / Blocker': '+ Event / blocker',
  '+ Kalender verbinden': '+ Connect calendar', 'Sync vor': 'Synced', 'Min': 'min ago', 'noch nie abgeglichen': 'never synced',
  'Abstimmung': 'Sync', 'Fokus': 'Focus',
  'Abgleich fehlgeschlagen': 'Sync failed', 'vermutet': 'guessed', 'Termin buchen': 'Book event', 'Aus Termin': 'From event',
  'Vorschlag aus dem Titel': 'Suggested from title', 'übernehmen': 'use it',
  'Klick oder Ziehen: vergangen trägt Zeit nach, künftig legt einen Blocker an': 'Click or drag: past adds time, future creates a blocker',
  'Meeting planen': 'Plan meeting', 'Blocker anlegen': 'Create blocker', 'Meeting anlegen': 'Create meeting', 'Termin bearbeiten': 'Edit event',
  'Kalendertermin': 'Calendar event', 'Speichern': 'Save', 'Ziel speichern': 'Save target', 'Titel': 'Title', 'Dauer': 'Duration',
  'Reservieren für': 'Reserve for', 'Kunde / Projekt': 'Customer / project', 'Teilnehmer': 'Attendees', 'ohne E-Mail': 'no email',
  'Weitere E-Mails, mit Komma getrennt': 'More emails, comma-separated',
  'Am Ziel hängt kein Kunde — Teilnehmer per E-Mail eintragen.': 'No customer on this target — enter attendees by email.',
  'Einladungen verschickt c2invoice erst mit dem E-Mail-Versand — bis dahin über „In Google Kalender öffnen“.':
    'c2invoice sends invitations once email sending exists — until then use “Open in Google Calendar”.',
  'Reservierte Arbeitszeit für einen Vorgang. Zählt in den Workload.': 'Reserved working time for a job. Counts towards the workload.',
  'Bei Beginn erinnern und prüfen': 'Remind and check at start',
  'tippst du in Claude → läuft über Claude · Claude allein → „Begleiten“ · keine Sitzung → „Manuell“':
    'typing in Claude → runs via Claude · Claude alone → “Accompany” · no session → “Manual”',
  'In Google Kalender öffnen': 'Open in Google Calendar',
  'Legt den Termin hier an und öffnet Googles Formular vorbefüllt — dort speichern, Google verschickt die Einladungen. Änderungen danach in beiden Kalendern von Hand.':
    'Creates the event here and opens Google’s prefilled form — save it there, Google sends the invitations. Later changes by hand in both calendars.',
  'Kalendertermine werden nur gelesen — änderbar ist das Ziel.': 'Calendar events are read-only — the target can be changed.',
  'Überschneidet sich mit': 'Overlaps with', 'Titel fehlt.': 'Title missing.', 'Uhrzeit im Format HH:MM.': 'Time as HH:MM.',
  'Beginn liegt in der Vergangenheit — dafür „Zeit nachtragen“ nutzen.': 'Start is in the past — use “Add time” for that.',
  'Ungültige E-Mail': 'Invalid email', 'Termin angelegt': 'Event created', 'Termin gespeichert': 'Event saved', 'Termin gelöscht': 'Event deleted',
  'Ziel gespeichert': 'Target saved', 'Termin nicht gefunden — Woche wird neu geladen.': 'Event not found — reloading the week.',
  'im Google-Tab nicht speichern, erst hier korrigieren.': 'do not save in the Google tab, fix it here first.',
  'Google-Formular im neuen Tab': 'Google form in a new tab',
  'In Google nicht gefunden — am': 'Not found in Google — handed to Google’s form on',
  'an Googles Formular übergeben, der Abgleich hat ihn seitdem nicht gebracht. Vielleicht dort nicht gespeichert.': ', the sync has not brought it back since. Maybe it was not saved there.',
  'Behalten': 'Keep', 'Erneut öffnen': 'Open again',
  'Wartet auf Google — kommt der Termin über den Abgleich zurück, wird er zusammengeführt.': 'Waiting for Google — once the sync brings the event back, the two are merged.',
  'wartet auf Google': 'waiting for Google', 'in Google nicht gefunden': 'not found in Google',
  'Noch kein Kalender verbunden.': 'No calendar connected yet.',
  'Entfernen': 'Remove',
  'Wirklich entfernen?': 'Really remove?',
  'Abo-Adresse einfügen (ICS)': 'Paste subscription address (ICS)',
  'https://… oder webcal://… (endet meist auf .ics)': 'https://… or webcal://… (usually ends in .ics)',
  'Abo-Adresse': 'Subscription address',
  'Name (optional)': 'Name (optional)',
  'Verbinden': 'Connect',
  'Die Adresse wird geprüft, in config.json gespeichert und danach nicht mehr angezeigt. Sie ist ein Zugang: nicht weitergeben.': 'The address is checked, stored in config.json and not shown again. It is a key: do not share it.',
  'So findest du die Adresse:': 'Where to find the address:',
  'Outlook.com: Einstellungen → Kalender → Freigegebene Kalender → „Kalender veröffentlichen“, Kalender wählen, „Kann alle Details anzeigen“ → den ICS-Link kopieren.': 'Outlook.com: Settings → Calendar → Shared calendars → “Publish a calendar”, pick the calendar, “Can view all details” → copy the ICS link.',
  'CalDAV (Apple iCloud, Nextcloud, Fastmail)': 'CalDAV (Apple iCloud, Nextcloud, Fastmail)',
  'CalDAV braucht ein Passwort und wird deshalb nur in config.json eingetragen: Adresse der Kalender-Sammlung, Benutzer und den Namen der Umgebungsvariable mit dem App-Passwort. Danach den Server neu starten.': 'CalDAV needs a password and is therefore only set in config.json: address of the calendar collection, user and the name of the environment variable holding the app password. Then restart the server.',
  'Kalender verbunden': 'Calendar connected',
  'Nicht verbunden': 'Not connected',
  'Kalender entfernt': 'Calendar removed',
  'Nicht entfernt': 'Not removed', 'Google-Kalender-Einstellungen öffnen': 'Open Google Calendar settings', 'Anderer Tag': 'Other day',
  'Kalender verbinden': 'Connect calendar',
  'Termine erscheinen in Woche und Heute als Vorschlag. Gebucht wird nie automatisch — ein Klick übernimmt Zeit, Titel und vermutetes Ziel.':
    'Events appear in Week and Today as suggestions. Nothing is booked automatically — one click takes over time, title and guessed target.',
  'Google Kalender': 'Google Calendar', 'Microsoft 365': 'Microsoft 365', 'folgt in 2.1': 'coming in 2.1',
  'folgt in 2.1 · bis dahin: ICS-Privatadresse aus den Google-Kalender-Einstellungen eintragen':
    'coming in 2.1 · until then: add the private ICS address from the Google Calendar settings',
  'CalDAV oder ICS-Link': 'CalDAV or ICS link', 'Google, Apple, Nextcloud, beliebiger Abo-Link · nur Lesen': 'Google, Apple, Nextcloud, any subscription link · read-only',
  'Zugänge stehen nur in config.json, nie in der Oberfläche. So geht es:': 'Credentials live only in config.json, never in the interface. How to:',
  'Google: Einstellungen öffnen (Link unten oder ⚙ oben rechts → Einstellungen). Links unter „Einstellungen für meine Kalender“ deinen Kalender anklicken, meist dein Name — nicht „Kalender hinzufügen“. Weiter unten im Abschnitt „Kalender integrieren“ die „Privatadresse im iCal-Format“ kopieren: Das Feld zeigt nur Punkte (••••), rechts daneben ist das Kopieren-Symbol. Nicht die „Öffentliche Adresse“ und nicht „Code einbetten“ — die gehen nur bei öffentlich gemachtem Kalender. Fehlt der Punkt, hat ihn bei Google Workspace der Admin abgeschaltet.':
    'Google: open the settings (link below or ⚙ top right → Settings). On the left under “Settings for my calendars” click your calendar, usually your name — not “Add calendar”. Further down in “Integrate calendar”, copy the “Secret address in iCal format”: the field only shows dots (••••), the copy icon is right next to it. Not the “Public address” and not “Embed code” — those only work for a calendar made public. If it is missing, a Google Workspace admin has turned it off.',
  'CalDAV (Apple, Nextcloud, Fastmail): Adresse der Kalender-Sammlung, Benutzer und den Namen der Umgebungsvariable mit dem App-Passwort.':
    'CalDAV (Apple, Nextcloud, Fastmail): address of the calendar collection, user and the name of the environment variable holding the app password.',
  'Den Ausschnitt in config.json im Ordner von c2invoice eintragen, die kopierte Adresse bei url einsetzen und den Server neu starten.': 'Add the snippet to config.json in the c2invoice folder, paste the copied address as url and restart the server.',
  'Kopieren': 'Copy', 'Kopiert': 'Copied', 'Nicht kopiert': 'Not copied', 'Jetzt abgleichen': 'Sync now', 'Abgeglichen': 'Synced',
  'Abgleich alle': 'Sync every', 'Zuordnung lernt aus Titeln: „Projekt A“, „NW-125“ oder Kundennamen im Termin werden erkannt.':
    'Matching learns from titles: “Project A”, “NW-125” or customer names in the event are recognised.',
  'Fehler in config.json': 'Errors in config.json', 'Konto nicht mehr in config.json': 'Account no longer in config.json',
  'bleiben, weil Buchungen daran hängen können': 'kept because bookings may depend on them', 'zuletzt erfolgreich': 'last success',
  'Serienregeln übergangen': 'recurrence rules skipped', 'verworfen': 'discarded', 'Kalender nicht geladen': 'Calendar not loaded',
  'Kein Kalender in config.json.': 'No calendar in config.json.', 'Verbindungen': 'Connections',
  // Workload, Als Naechstes, Hinweise (Z7b)
  'Workload 7 Tage': 'Workload 7 days', 'Workload 7 Tage — Meetings + Blocker gegen Tagessoll': 'Workload 7 days — meetings + blockers against daily target',
  'Workload nicht geladen': 'Workload not loaded', '{n} Tag überbucht': '{n} day overbooked', '{n} Tage überbucht': '{n} days overbooked',
  'nichts überbucht': 'nothing overbooked', 'Meetings + Blocker gegen Tagessoll': 'Meetings + blockers against daily target', 'frei': 'free',
  'Meetings': 'Meetings', 'über Soll': 'over target', 'Als Nächstes heute': 'Next today',
  'Blocker · Erinnerung mit Prüfung Claude vs. manuell': 'Blocker · reminder checking Claude vs. manual',
  'Keine Termine oder Blocker mehr heute.': 'No more events or blockers today.', 'Restkapazität heute': 'Remaining capacity today',
  'Restkapazität heute — Tagessoll − Arbeitszeit − anstehende Termine': 'Remaining capacity today — daily target − working time − upcoming events',
  'Blocker hat begonnen': 'Blocker started',
  'Du tippst gerade in Claude an diesem Ziel — die Zeit läuft über Claude.': 'You are typing in Claude on this target — the time runs via Claude.',
  'Claude arbeitet allein an diesem Ziel — Timer mit Tätigkeit Begleiten starten?': 'Claude works alone on this target — start a timer with activity Accompany?',
  'Keine Claude-Sitzung an diesem Ziel — Timer starten?': 'No Claude session on this target — start a timer?',
  'Timer starten · Begleiten': 'Start timer · Accompany', 'Desktop-Hinweise bei Blocker-Beginn erlauben': 'Allow desktop notifications at blocker start',
  'Hinweis nicht mehr offen.': 'Notice no longer open.', 'Ziel prüfen und Timer starten.': 'Check the target and start the timer.',
  'Ziel wählen und Timer starten.': 'Choose a target and start the timer.', 'Timer gestartet': 'Timer started',
  'Hinweis nicht weggeklickt': 'Notice not dismissed', 'Erinnerungen nicht aktualisiert': 'Reminders not updated', 'Es läuft schon ein Timer — erst stoppen, dann starten.': 'A timer is already running — stop it first, then start.', '+ Zeit reservieren': '+ Reserve time',
});

/* ---------- Formate und Texte ---------- */
const zdur = (min) => { const m = Math.max(0, Math.round(Number(min) || 0)); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
const zzwei = (n) => String(n).padStart(2, '0');
const zhm = (ts) => { const d = new Date(ts); return zzwei(d.getHours()) + ':' + zzwei(d.getMinutes()); };
const zMinute = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };   // Ortszeit
const zTag = (ts) => isoTag(new Date(ts));
const zWochentage = () => (istDE() ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const zWt = (iso) => zWochentage()[(ausIso(iso).getDay() + 6) % 7];
const zMontag = (d) => isoTag(plusTage(d, -((d.getDay() + 6) % 7)));
const ZART = { vorgang: 'Vorgang', projekt: 'Projekt', kunde: 'Kunde', intern: 'Intern' };
const ZWL = { beides: 'Beides', claude: 'Nur Claude', meine: 'Nur meine Zeit', keins: 'Keins' };
const ZWSUB = { beides: 'Claude und du', claude: 'deine Minuten entfallen', meine: 'Claude-Minuten entfallen', keins: 'Kulanz · 0,00 EUR' };
const ZWTXT = {
  beides: 'Claude und deine Zeit werden beide abgerechnet.', claude: 'Deine überlappenden Minuten entfallen, Claude rechnet ab.',
  meine: 'Claudes überlappende Minuten entfallen, deine Zeit rechnet ab.', keins: 'Beide entfallen — auf der Rechnung als Kulanz mit 0,00 EUR.',
};
// Ergebnis einer Sitzung (zeit.js ueberlappung) als Wahl, die es bewirkt.
const ZERG_WAHL = { parallel: 'beides', beide: 'beides', abzug: 'claude', meine: 'meine', kulanz: 'keins' };
const zModell = (m) => uebersetze(m === 'eingaben' ? 'Eigene Zeit' : 'Aktivität');
const zHM = (m) => zzwei(Math.floor(m / 60)) + ':' + zzwei(m % 60);

/* ---------- Termine ----------
   Kommen mit der Woche (Server, je UTC-Tag); ein Termin ueber Mitternacht steht
   dort zweimal. Gezeichnet wird nach Ortstag, deshalb erst eindeutig machen.
   Ganztaegige (Urlaub, Feiertag) zeichnet das Stundenraster nicht. */
const ZTA = { meeting: 'Meeting', blocker: 'Blocker', fremd: 'Termin' };
function zTermine(woche) {
  const m = new Map();
  for (const x of (woche && woche.tage) || []) for (const t of x.termine || []) m.set(t.kalender_id + '\n' + t.uid, t);
  return [...m.values()].filter((t) => !t.ganztag);
}
const zTerminFinde = (kid, uid) => [...zTermine(zt.d.woche), ...zTermine(zt.d.hw)].find((t) => t.kalender_id === kid && t.uid === uid);
const zBuchbar = (t) => Date.parse(t.start) <= Date.now() && !t.gebucht_eintrag_id;
// Ziel am Termin; ob es von Hand gesetzt oder aus dem Titel geraten ist, sagt ziel_von_hand.
const zTerminZiel = (t) => (t.ziel_art ? zZielVon(t.ziel_art, t.ziel_schluessel, zielKurz(t.ziel_art, t.ziel_schluessel)) : null);
// uid und kalender_id sind fremde Eingaben: nur als data-*, nie als id=.
const zTerminDaten = (t) => ' data-kal="' + esc(t.kalender_id) + '" data-uid="' + esc(t.uid) + '"';

// Geltende Wahl ueber alle Sitzungen: nur wenn alle dasselbe ergeben.
function zEffWahl(sitzungen) {
  const w = [...new Set((sitzungen || []).map((s) => s.wahl || ZERG_WAHL[s.ergebnis]))];
  return w.length === 1 ? w[0] : null;
}
function zSitzName(s) {
  return s.ticket || s.project || String(s.session_id || '').slice(0, 8);
}
function zSitzLive(sid) {
  return ((state.live && state.live.sessions) || []).some((x) => x.session_id === sid && istAktiv(x.last_ts));
}

/* ---------- Ziele ----------
   Ein Ziel: { art, schluessel, l (Kurzname), t (Titel), satz, rundung, selbstkosten, projekt }. */
function zZiele(d) {
  if (!d) return [];
  return [
    ...d.vorgaenge.map((v) => ({ art: 'vorgang', schluessel: v.schluessel, l: v.schluessel, t: v.projekt || '', satz: v.satz, rundung: v.rundung, projekt: v.projekt })),
    ...d.projekte.map((p) => ({ art: 'projekt', schluessel: p.schluessel, l: p.schluessel, t: '', satz: p.satz, rundung: p.rundung, projekt: p.schluessel })),
    ...d.kunden.map((k) => ({ art: 'kunde', schluessel: k.schluessel, l: k.name, t: k.status === 'lead' ? 'Lead' : 'Kunde', satz: k.satz, rundung: k.rundung })),
    ...d.intern.map((i) => ({ art: 'intern', schluessel: i.schluessel, l: i.schluessel, t: '', satz: null, selbstkosten: i.selbstkosten })),
  ];
}
const zGleich = (a, b) => !!a && !!b && a.art === b.art && String(a.schluessel) === String(b.schluessel);
function zZielVon(art, schluessel, name, projekt) {
  const bekannt = zZiele(zt.d.ziele).find((z) => zGleich(z, { art, schluessel }));
  if (bekannt) return bekannt;
  return { art, schluessel, l: art === 'kunde' ? (name || '#' + schluessel) : schluessel, t: art === 'vorgang' ? projekt || '' : '' };
}
// Kurzname fuer Leiste und Toast; Kunden ueber ihren Namen aus den Kontakten.
function zielKurz(art, schluessel) {
  if (art === 'kunde') {
    const k = (state.kontakte || []).find((x) => String(x.id) === String(schluessel));
    return k ? k.firma || k.name : '#' + schluessel;
  }
  return String(schluessel || '');
}
const zEintragZiel = (e) => zZielVon(e.ziel_art, e.ziel_schluessel, e.name, e.projekt);

// Kontakt eines Eintrags: Kunde direkt, sonst ueber das Projekt (Kontakte → Projekte & Sätze).
// Dieselbe Zuordnung wie die Vorgangs-Schublade im Beleg-Editor.
function zKontaktVon(e) {
  if (e.ziel_art === 'kunde') return Number(e.ziel_schluessel) || null;
  const pk = (state.summary && state.summary.projekt_kontakt) || {};
  return e.projekt && Object.hasOwn(pk, e.projekt) ? pk[e.projekt].id : null;
}
// "Offene abrechnen →": Editor mit offener Schublade; gehoeren alle offenen, abrechenbaren
// Eintraege (im Ziel-Filter) einem Kontakt, ist er vorbelegt.
function zAbrechnenLink(zf) {
  const offen = (zt.d.ol || []).filter((e) => e.abrechenbar && e.ziel_art !== 'intern' && (!zf || (e.ziel_art === zf[0] && String(e.ziel_schluessel) === String(zf[1]))));
  const kontakte = [...new Set(offen.map(zKontaktVon))];
  return 'beleg/neu?art=rechnung&zeit=offen' + (kontakte.length === 1 && kontakte[0] ? '&kontakt=' + kontakte[0] : '');
}

function zZielSub(z, taetigkeit) {
  if (!z) return '';
  if (z.art === 'intern') return uebersetze('Nicht abrechenbar · zählt als Selbstkosten') + ' ' + nf2.format(z.selbstkosten || 0) + ' EUR/h';
  const t = (zt.d.taet || []).find((x) => x.name === taetigkeit);
  if (t && t.satz != null) return uebersetze('Satz') + ' ' + nf2.format(t.satz) + ' EUR/h ' + uebersetze('aus Tätigkeit') + ' ' + t.name;
  if (z.satz == null) return '';
  return uebersetze('Satz') + ' ' + nf2.format(z.satz) + ' EUR/h' + (z.projekt ? ' ' + uebersetze('aus') + ' ' + z.projekt : ' · ' + uebersetze('Standardsatz')) +
    (z.rundung ? ' · ' + uebersetze('Rundung') + ' ' + z.rundung + ' Min' : '');
}
function zZielKnopf(z, aktionWert, gesperrt) {
  return '<button type="button" class="zt-ziel" data-aktion="zt-picker" data-wert="' + aktionWert + '"' + (gesperrt ? ' disabled' : '') + '>' +
    '<b class="mono">' + esc(z ? z.l : '—') + '</b>' +
    '<span class="zt-ziel-t"><span>' + esc(!z ? uebersetze('Ziel wählen') : uebersetze(z.t || ZART[z.art])) + '</span>' +
      '<span>' + esc(z && z.t ? uebersetze(ZART[z.art]) : '') + '</span></span>' +
    '<span class="zt-suchen">' + esc(uebersetze('suchen ⌕')) + '</span></button>';
}
function zMerkeZuletzt(z) {
  const alt = [].concat(liesJson('zeit.zuletzt', [])).filter((x) => x && !zGleich(x, z));
  merke('zeit.zuletzt', [{ art: z.art, schluessel: String(z.schluessel), l: z.l, t: z.t }].concat(alt).slice(0, 6));
}
const zZuletzt = () => [].concat(liesJson('zeit.zuletzt', []))
  .filter((x) => x && Object.hasOwn(ZART, x.art) && typeof x.schluessel === 'string' && typeof x.l === 'string');

/* ---------- Zustand und Laden ---------- */
const zt = {
  ansicht: ['woche', 'monat', 'ziele'].includes(lies('zeit.ansicht', 'woche')) ? lies('zeit.ansicht', 'woche') : 'woche',
  filter: 'alle', zielFilter: null, zielTab: 'alle', montag: null,
  form: liesJson('zeit.timer', {}),
  d: {}, schluessel: null, lauf: 0, fehler: null, zieht: null,
  termineAn: lies('zeit.termine', '1') !== '0',
};
if (!zt.form || typeof zt.form !== 'object' || Array.isArray(zt.form)) zt.form = {};
if (zt.form.ziel && !(Object.hasOwn(ZART, zt.form.ziel.art) && typeof zt.form.ziel.l === 'string')) delete zt.form.ziel;
const zTimer = () => (state.live && state.live.timer) || null;

async function zeitLaden() {
  const lauf = ++zt.lauf;
  const z = aktuellerZeitraum();
  const mo = zt.montag || zMontag(new Date());
  const h = new Date();
  const aktMo = zMontag(h);
  // Eintraege mit einem Tag Puffer: der Server schneidet nach UTC-Tag, gezeigt wird nach Ortstag.
  const eintraegeWoche = (m) => hole('/api/zeit?' + abfrage({ from: isoTag(plusTage(ausIso(m), -1)), to: isoTag(plusTage(ausIso(m), 7)) }));
  try {
    const [woche, wl, pl, ol, taet, timer, ziele, monat, zieleTab, hw, hl, kal] = await Promise.all([
      hole('/api/zeit/woche?' + abfrage({ montag: mo })),
      eintraegeWoche(mo),
      hole('/api/zeit?' + abfrage({ from: z.von, to: z.bis })),
      hole('/api/zeit?status=offen'),
      zt.d.taet || hole('/api/taetigkeitsarten'),
      hole('/api/zeit/timer'),
      zt.d.ziele || hole('/api/zeit/ziele'),
      // Bis heute: Soll und Saldo zaehlen nur Tage, die schon waren (Zukunftstage zeichnet zMonat leer).
      zt.ansicht === 'monat' ? hole('/api/zeit/monat?' + abfrage({ from: isoTag(new Date(h.getFullYear(), h.getMonth(), 1)), to: isoTag(h) })) : null,
      zt.ansicht === 'ziele' ? hole('/api/zeit/ziele-tabelle?' + abfrage({ from: z.von, to: z.bis })) : null,
      // Heute und die Wochenkennzahlen gelten immer der laufenden Woche, auch wenn eine andere gezeigt wird.
      mo === aktMo ? null : hole('/api/zeit/woche?' + abfrage({ montag: aktMo })),
      mo === aktMo ? null : eintraegeWoche(aktMo),
      // Kalenderstatus darf die Seite nicht reissen: der Fehler steht dann am Statusknopf.
      hole('/api/kalender').catch((e) => ({ fehlerLaden: e.message })),
    ]);
    if (lauf !== zt.lauf) return;
    zt.d = {
      woche, wl: wl.eintraege, pl: pl.eintraege, ol: ol.eintraege, taet, timer, ziele, monat, zieleTab: zieleTab && zieleTab.ziele,
      hw: hw || woche, hl: hl ? hl.eintraege : wl.eintraege, kal,
    };
    zt.fehler = null;
    // Der Timer kann woanders gestartet oder gestoppt worden sein.
    if (state.live && JSON.stringify(state.live.timer || null) !== JSON.stringify(timer.timer || null)) {
      state.live.timer = timer.timer;
      zeichneMiniTimer();
    }
  } catch (e) {
    if (lauf !== zt.lauf) return;
    zt.fehler = e.message;
  }
  if (route().name === 'zeit') zeichneAnsicht();
}
// Nach jeder Aenderung: Seite und alles Abhaengige (Hub, Live, Kennzahlen).
function zeitNachAenderung() {
  zHeute.zeit = 0;
  zWl.zeit = 0;
  zeitLaden();
  neuLaden();
}

/* ---------- Timer-Karte ---------- */
function zTimerKarte() {
  const t = zTimer();
  const lauf = !!t;
  const ziel = lauf ? zZielVon(t.ziel_art, t.ziel_schluessel, zielKurz(t.ziel_art, t.ziel_schluessel)) : zt.form.ziel || null;
  const taet = lauf ? t.taetigkeit : zt.form.taetigkeit;
  const notiz = lauf ? t.notiz || '' : zt.form.notiz || '';
  const tats = (zt.d.taet || []).map((x) => x.name);
  let html = '<section class="karte zt-timer' + (lauf ? ' laeuft' : '') + '">' +
    '<div class="zt-timer-kopf"><div class="zt-status"><div><span class="zt-punkt"></span><span class="zt-ueber">' + esc(uebersetze(lauf ? 'Timer läuft' : 'Kein Timer aktiv')) + '</span></div>' +
      '<span class="zt-uhr mono zeit-uhr">' + (lauf ? uhrText(Date.now() - Date.parse(t.start)) : '00:00:00') + '</span></div>' +
      '<span class="zt-sub">' + esc(lauf ? uebersetze('seit') + ' ' + zhm(t.start) + ' ' + uebersetze('Uhr') + ' · ' + t.taetigkeit : uebersetze('Ziel wählen und starten — oder Zeit nachtragen')) + '</span></div>' +
    '<div class="zt-feld"><span class="zt-ueber">' + esc(uebersetze('Buchen auf')) + '</span>' + zZielKnopf(ziel, 'timer', lauf) +
      '<span class="hinweis">' + esc(zZielSub(ziel, taet)) + '</span></div>' +
    '<div class="zt-chips" role="group" aria-label="' + esc(uebersetze('Tätigkeit')) + '">' + tats.map((n) =>
      '<button type="button" class="chip" data-aktion="zt-taet" data-wert="' + esc(n) + '" aria-pressed="' + (n === taet) + '"' + (lauf ? ' disabled' : '') + '>' + esc(n) + '</button>').join('') + '</div>' +
    '<input id="zt-notiz" class="zt-eingabe" maxlength="500" value="' + esc(notiz) + '"' + (lauf ? ' disabled' : '') +
      ' placeholder="' + esc(uebersetze('Notiz — erscheint auf der Rechnungsposition')) + '" aria-label="' + esc(uebersetze('Notiz')) + '">' +
    '<div class="zt-knoepfe"><button type="button" class="zt-start" data-aktion="zt-timer">' + esc(uebersetze(lauf ? '■  Stoppen und buchen' : '▶  Starten')) + '</button>' +
      '<button type="button" class="knopf geist" data-aktion="zt-neu">' + esc(uebersetze('+ Zeit nachtragen')) + '</button></div>';
  // Laesst sich der Timer nicht mehr buchen (ueber 24 h, Ziel oder Taetigkeit weg),
  // scheitert auch der Stopp — dann ist Verwerfen der einzige Ausweg.
  const vf = lauf && zt.d.timer && zt.d.timer.vorschau_fehler;
  if (vf) {
    html += '<div class="zt-ov"><span class="bad">' + esc(uebersetze('Timer lässt sich so nicht buchen') + ': ' + vf) + '</span>' +
      '<div class="zt-knoepfe"><button type="button" class="knopf klein" data-aktion="zt-verwerfen">' + esc(uebersetze('Timer verwerfen')) + '</button>' +
      '<span class="hinweis">' + esc(uebersetze('Danach die Zeit nachtragen.')) + '</span></div></div>';
  }
  const v = lauf && zt.d.timer && zt.d.timer.vorschau;
  if (v && v.sitzungen.length) {
    const o = v.sitzungen[0];
    const gewaehlt = t.wahlen && Object.keys(t.wahlen).length;
    const eff = zEffWahl(v.sitzungen);
    const wert = zTimerUeberlappung(v);
    const parallel = ((zt.d.taet || []).find((x) => x.name === t.taetigkeit) || {}).parallel;
    html += '<div class="zt-ov">' +
      '<div class="zt-ov-zeile"><span class="zt-ov-i mono" aria-hidden="true">∥</span><span>' +
        esc(uebersetze('Gleichzeitig läuft Claude-Sitzung') + ' ' + zSitzName(o) + (zSitzLive(o.session_id) ? ' (live)' : '') + ', ' + uebersetze('Zeitmodell') + ' ' + zModell(o.modell) + '. ' +
          uebersetze(eff ? ZWTXT[eff] : 'Regel je Sitzung aus Zeitmodell.')) + '</span>' +
        '<b class="mono ' + wert[1] + '">' + esc(wert[0]) + '</b></div>' +
      '<div class="zt-ov-kopf"><span class="zt-ueber">' + esc(uebersetze('Abrechnen bei Überlappung')) + '</span><span class="hinweis">' +
        esc(uebersetze(gewaehlt ? 'gewählt · gilt beim Stoppen und Buchen' : parallel ? 'Standard bei Meetings: Beides' : 'Standard: Regel aus dem Zeitmodell')) + '</span></div>' +
      zWahlKnoepfe('zt-twahl', eff) + '</div>';
  }
  return html + '</section>';
}
// Wirkung der Ueberlappung am laufenden Timer: [Text, Klasse] — Timer-Karte und Live „Du“.
function zTimerUeberlappung(v) {
  const meine = v.sitzungen.filter((s) => s.ergebnis === 'meine').reduce((a, s) => a + s.min, 0);
  return v.kulanz_min ? [uebersetze('Kulanz') + ' ' + v.kulanz_min + ' Min', 'bad'] : v.abzug_min ? ['−' + v.abzug_min + ' Min', 'bad']
    : meine ? ['Claude −' + meine + ' Min', 'warn'] : ['∥ +' + v.parallel_min + ' Min', 'ok'];
}
function zWahlKnoepfe(aktionName, eff, gesperrt) {
  return '<div class="zt-wahl" role="group" aria-label="' + esc(uebersetze('Abrechnen bei Überlappung')) + '">' + Object.keys(ZWL).map((k) =>
    '<button type="button" data-aktion="' + aktionName + '" data-wert="' + k + '" aria-pressed="' + (eff === k) + '"' + (gesperrt ? ' disabled' : '') + '>' +
      '<b>' + esc(uebersetze(ZWL[k])) + '</b><span>' + esc(uebersetze(ZWSUB[k])) + '</span></button>').join('') + '</div>';
}

/* ---------- Heute ---------- */
// Lage in den Spuren 08–19 Uhr in Prozent (wie Mockup).
const zL = (m) => Math.max(0, Math.min(100, (m - 480) / 660 * 100)).toFixed(2);
const zW = (a, b) => Math.max(0.6, (Math.min(b, 1140) - Math.max(a, 480)) / 660 * 100).toFixed(2);

// Heute aus Woche (Server) und Eintraegen — dieselbe Rechnung fuer die Heute-Karte,
// Live „Du“ und den Hub. Summiert werden nur Werte, die der Server je Eintrag liefert.
function zHeuteWerte(hw, hl) {
  const heute = isoTag(new Date());
  const tag = (hw.tage || []).find((x) => x.tag === heute) || { arbeitszeit_min: 0, soll_min: 0, claude_min: 0, claude_fenster: [] };
  const es = hl.filter((e) => zTag(e.start) === heute).sort((a, b) => a.start.localeCompare(b.start));
  const manAbr = es.filter((e) => e.abrechenbar).reduce((a, e) => a + e.gezaehlt_min, 0);
  return {
    heute, tag, es, manAbr,
    nicht: es.filter((e) => !e.abrechenbar).reduce((a, e) => a + e.gezaehlt_min, 0),
    par: es.reduce((a, e) => a + (e.parallel_min || 0), 0),
    soll: tag.soll_min, rest: tag.soll_min - tag.arbeitszeit_min,
    // Balken bis 125 % des Solls, die Sollmarke sitzt bei 80 % (Mockup).
    skala: (tag.soll_min || 480) / 0.8,
  };
}
// „noch X h bis Soll“ bzw. „Soll erfüllt · +X h“ mit Farbe.
const zRestText = (rest) => [rest > 0 ? uebersetze('noch') + ' ' + zdur(rest) + ' ' + uebersetze('h bis Soll') : uebersetze('Soll erfüllt') + ' · +' + zdur(-rest) + ' h', rest > 0 ? 'warn' : 'ok'];

// Stand eines an Google uebergebenen Termins (google_offen / google_fehlt vom Server).
const zGoogleMarke = (t) => (t.google_fehlt ? ' · ' + uebersetze('in Google nicht gefunden') : t.google_offen ? ' · ' + uebersetze('wartet auf Google') : '');
function zHeuteKarte() {
  const { heute, tag, es, manAbr, nicht, par, soll, rest, skala } = zHeuteWerte(zt.d.hw, zt.d.hl);
  const t = zTimer();
  const jetzt = zMinute(Date.now());
  const fenster = [].concat(...(zt.d.hw.tage || []).map((x) => x.claude_fenster)).filter((f) => zTag(f.von) === heute);
  const spur = (l, teile) => '<span>' + esc(uebersetze(l)) + '</span><div class="zt-spur">' + teile.join('') +
    '<span class="zt-jetzt" style="left:' + zL(jetzt) + '%"></span></div>';
  const seg = (a, b, farbe, tip) => '<span title="' + esc(tip) + '" style="left:' + zL(a) + '%;width:' + zW(a, b) + '%;background:' + farbe + '"></span>';
  const items = es.map((e) => {
    const z = zEintragZiel(e);
    const sub = [e.notiz || z.t, e.parallel_min ? e.parallel_min + ' ' + uebersetze('Min parallel') : '', e.abzug_min && !e.kulanz_min ? '−' + e.abzug_min + ' Min' : '',
      e.kulanz_min ? uebersetze('Kulanz') + ' ' + e.kulanz_min + ' Min' : ''].filter(Boolean).join(' · ');
    return [e.start, '<div class="zt-heute-z"><span class="mono">' + zhm(e.start) + '–' + zhm(e.ende) + '</span>' +
      '<button type="button" data-aktion="zt-eintrag" data-wert="' + e.id + '"><span>' + esc(z.l + ' · ' + e.taetigkeit) + '</span><span>' + esc(sub) + '</span></button>' +
      '<span class="mono' + (e.abrechenbar ? '' : ' faint') + '">' + zdur(e.gezaehlt_min) + '</span></div>'];
  });
  if (t) {
    const v = zt.d.timer && zt.d.timer.vorschau;
    items.push([t.start, '<div class="zt-heute-z lauf"><span class="mono">' + zhm(t.start) + '–' + esc(uebersetze('jetzt')) + '</span>' +
      '<a href="#/zeit"><span>' + esc(zielKurz(t.ziel_art, t.ziel_schluessel) + ' · ' + t.taetigkeit) + '</span><span>' + esc(uebersetze('Timer läuft') +
        (v && v.parallel_min ? ' · ' + v.parallel_min + ' ' + uebersetze('Min parallel zu Claude') : '')) + '</span></a>' +
      '<span class="mono akzent">' + zdur(t.laeuft_min) + '</span></div>']);
  }
  // Ungebuchte Termine von heute: Klick auf den Text oeffnet den Termin, „+ buchen“ den Nachtrag.
  const tms = zt.termineAn ? zTermine(zt.d.hw).filter((x) => zTag(x.start) === heute) : [];
  for (const x of tms.filter((y) => !y.gebucht_eintrag_id)) {
    const z = zTerminZiel(x);
    items.push([x.start, '<div class="zt-heute-z termin"><span class="mono">' + zhm(x.start) + '–' + zhm(x.ende) + '</span>' +
      '<button type="button" data-aktion="zt-termin-dlg"' + zTerminDaten(x) + '><span>' + esc(x.titel) + '</span><span>' +
        esc(uebersetze(ZTA[x.art]) + (z ? ' · ' + (x.ziel_von_hand ? '' : uebersetze('vermutet') + ' ') + z.l : '') + zGoogleMarke(x)) + '</span></button>' +
      (zBuchbar(x) ? '<button type="button" class="zt-buchen" data-aktion="zt-termin-buchen"' + zTerminDaten(x) + '>' + esc(uebersetze('+ buchen')) + '</button>' : '<span></span>') + '</div>']);
  }
  items.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return '<section class="karte zt-heute">' +
    '<div class="zt-k"><h2>' + esc(uebersetze('Heute')) + '</h2><span class="hinweis">' + esc(zWt(heute) + ' ' + datumKurz(heute) + ' · ' + uebersetze('Tagessoll') + ' ' + zdur(soll) + ' h') + '</span></div>' +
    '<div class="zt-heute-wert"><span class="mono">' + zdur(tag.arbeitszeit_min) + '<small>' + esc(uebersetze('h Arbeitszeit')) + '</small></span>' +
      '<span class="' + zRestText(rest)[1] + '">' + esc(zRestText(rest)[0]) + '</span></div>' +
    '<div class="zt-balken"><span style="width:' + Math.min(100, tag.arbeitszeit_min / skala * 100).toFixed(1) + '%" class="' + (rest > 0 ? '' : 'ok') + '"></span>' +
      (soll ? '<span class="soll" title="' + esc(uebersetze('Tagessoll')) + '"></span>' : '') + '</div>' +
    '<div class="zt-stats">' +
      '<span>' + esc(uebersetze('Abrechenbar')) + '<b class="mono akzent">' + zdur(tag.claude_min + manAbr) + ' h</b><span>Claude ' + zdur(tag.claude_min) + ' + ' + esc(uebersetze('manuell')) + ' ' + zdur(manAbr) + '</span></span>' +
      '<span>' + esc(uebersetze('Parallel abgerechnet')) + '<b class="mono">' + zdur(par) + ' h</b><span>' + esc(uebersetze('Meeting + Claude')) + '</span></span>' +
      '<span>' + esc(uebersetze('Nicht abrechenbar')) + '<b class="mono">' + zdur(nicht) + ' h</b><span>' + esc(uebersetze('Intern')) + '</span></span></div>' +
    '<div class="zt-spuren">' +
      (zt.termineAn ? spur('Termine', tms.map((x) => seg(zMinute(x.start), zTag(x.ende) === heute ? zMinute(x.ende) : 1440,
        x.art === 'blocker' ? 'var(--zeit-blocker)' : 'var(--zeit-termin)', x.titel + ' · ' + zhm(x.start) + '–' + zhm(x.ende)))) : '') +
      spur('Manuell', es.map((e) => seg(zMinute(e.start), zMinute(e.ende), e.abrechenbar ? 'var(--zeit-manuell)' : 'var(--m-rest)', zEintragZiel(e).l + ' · ' + zhm(e.start) + '–' + zhm(e.ende)))
        .concat(t ? [seg(zTag(t.start) === heute ? zMinute(t.start) : 0, jetzt, 'var(--accent)', 'Timer · ' + zielKurz(t.ziel_art, t.ziel_schluessel))] : [])) +
      spur('Claude', fenster.map((f) => seg(zMinute(f.von), zMinute(f.bis), f.modell === 'eingaben' ? 'var(--text-dim)' : 'var(--m-rest)', 'Claude ' + zSitzName(f) + ' · ' + zModell(f.modell)))) +
      '<span></span><div class="zt-achse mono"><span>08</span><span>11</span><span>14</span><span>17</span><span>19</span></div></div>' +
    '<div class="zt-heute-liste">' + items.map((x) => x[1]).join('') + '</div>' +
  '</section>';
}

/* ---------- Heute fuer Live und Hub ----------
   Die Seiten laden die Zeiterfassung nicht; dieser Stand holt nur, was die
   Heute-Rechnung braucht, hoechstens alle 15 s (so oft pollt auch Live). */
const zHeute = { d: null, zeit: 0, laeuft: false, fehler: null };
async function zHeuteLaden() {
  if (zHeute.laeuft || Date.now() - zHeute.zeit < 15000) return;
  zHeute.laeuft = true;
  zHeute.zeit = Date.now();
  const mo = zMontag(new Date());
  try {
    const [hw, hl, timer] = await Promise.all([
      hole('/api/zeit/woche?' + abfrage({ montag: mo })),
      // Ein Tag Puffer wie zeitLaden: Server schneidet nach UTC-Tag, gezaehlt wird nach Ortstag.
      hole('/api/zeit?' + abfrage({ from: isoTag(plusTage(ausIso(mo), -1)), to: isoTag(plusTage(ausIso(mo), 7)) })),
      hole('/api/zeit/timer'),
    ]);
    zHeute.d = { hw, hl: hl.eintraege, timer };
    zHeute.fehler = null;
  } catch (e) {
    zHeute.fehler = e.message;
  }
  zHeute.laeuft = false;
  const seite = route().name;
  if (seite === 'live' || seite === 'hub') zeichneAnsicht();
}

// Block „Arbeitszeit heute“ (Live „Du“ und Hub, Mockup Z. 912–916 / 379–385).
// mitDrei: Hub-Fassung mit Abrechenbar / Manuell / Parallel und Timer-Chip.
function zArbeitHeute(mitDrei) {
  const kopf = '<span class="label">' + esc(uebersetze('Arbeitszeit heute')) + '</span>';
  if (!zHeute.d) {
    return '<div class="zh-spalte">' + kopf + (zHeute.fehler ? '<span class="hinweis bad">' + esc(uebersetze('Zeiterfassung nicht geladen') + ': ' + zHeute.fehler) + '</span>'
      : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>') + '</div>';
  }
  const { tag, manAbr, par, rest, skala } = zHeuteWerte(zHeute.d.hw, zHeute.d.hl);
  const t = zTimer();
  const [restText, restKlasse] = zRestText(rest);
  // Scheitert ein spaeteres Nachladen, bleibt der alte Stand stehen — sichtbar als nicht aktualisiert.
  const alt = zHeute.fehler ? '<span class="hinweis bad">' + esc(uebersetze('Nicht aktualisiert') + ': ' + zHeute.fehler) + '</span>' : '';
  return '<div class="zh-spalte">' +
    (mitDrei ? '<div class="zh-kopf">' + kopf + (t ? '<a class="zh-chip mono" href="#/zeit"><span class="zt-punkt"></span><span class="zeit-uhr">' + uhrText(Date.now() - Date.parse(t.start)) + '</span></a>' : '') + '</div>' : kopf) + alt +
    '<div class="zh-wert"><span class="mono">' + zdur(tag.arbeitszeit_min) + '<small>/ ' + zdur(tag.soll_min) + ' h</small></span><span class="' + restKlasse + '">' + esc(restText) + '</span></div>' +
    '<div class="zt-balken"><span style="width:' + Math.min(100, tag.arbeitszeit_min / skala * 100).toFixed(1) + '%" class="' + (rest > 0 ? '' : 'ok') + '"></span>' +
      (tag.soll_min ? '<span class="soll" title="' + esc(uebersetze('Tagessoll')) + '"></span>' : '') + '</div>' +
    (mitDrei
      ? '<div class="zh-drei"><span>' + esc(uebersetze('Abrechenbar')) + '<b class="mono akzent">' + zdur(tag.claude_min + manAbr) + ' h</b></span>' +
        '<span>' + esc(uebersetze('Manuell')) + '<b class="mono zh-man">' + zdur(manAbr) + ' h</b></span>' +
        '<span>' + esc(uebersetze('Parallel')) + '<b class="mono ok">' + zdur(par) + ' h</b></span></div>'
      : '<span class="hinweis">' + esc(uebersetze('Abrechenbar')) + ' <b class="mono akzent">' + zdur(tag.claude_min + manAbr) + ' h</b> · Claude ' + zdur(tag.claude_min) + ' + ' + esc(uebersetze('manuell')) + ' ' + zdur(manAbr) + '</span>') +
  '</div>';
}

// Spalte „Bei Überlappung“ (Live, Vorgangs-Detail): je Eintrag, der die Sitzung
// ueberlappt, die Vierer-Wahl. Daten aus sessions[].wahl bzw. sitzungen[].wahl.
// mitLabel=false in Tabellen, deren Spaltenkopf schon „Bei Überlappung“ sagt.
function zSitzWahl(sessionId, wahl, mitLabel = true) {
  if (!wahl || !wahl.length) return '';
  return '<div class="zs-wahl">' + (mitLabel ? '<span class="label">' + esc(uebersetze('Bei Überlappung')) + '</span>' : '') + wahl.map((w) => {
    const eff = w.gemischt ? null : w.wahl || ZERG_WAHL[w.ergebnis];
    const zu = w.status !== 'offen';
    return '<div class="zs-zeile"><span class="mono faint" title="' + esc(uebersetze('Zeiteintrag') + ' · ' + w.min + ' Min ' + uebersetze('Überlappung')) + '">' +
        esc(zhm(w.start) + '–' + zhm(w.ende)) + '</span>' +
      '<div class="segment" role="group" aria-label="' + esc(uebersetze('Abrechnen bei Überlappung')) + '">' + Object.keys(ZWL).map((k) =>
        '<button type="button" data-aktion="z-swahl" data-wert="' + k + '" data-eintrag="' + esc(w.eintrag_id) + '" data-session="' + esc(sessionId) + '"' +
          ' aria-pressed="' + (eff === k) + '" title="' + esc(uebersetze(ZWSUB[k])) + '"' + (zu ? ' disabled' : '') + '>' + esc(uebersetze(ZWL[k])) + '</button>').join('') + '</div>' +
      (zu ? '<span class="hinweis">' + esc(uebersetze('gesperrt')) + '</span>' : '') + '</div>';
  }).join('') + '</div>';
}
aktion('z-swahl', (wahl, el) => mitLauf(el, async () => {
  try {
    await sende('/api/zeit/wahl', { eintrag_id: Number(el.dataset.eintrag), session_id: el.dataset.session, wahl });
    toast(uebersetze('Wahl gespeichert') + ' · ' + uebersetze(ZWL[wahl]), 'ok');
    zeitNachAenderung();
  } catch (e) {
    toast(uebersetze('Wahl nicht gespeichert') + ': ' + e.message, 'err');
  }
}));

/* ---------- Kennzahlen der Woche ---------- */
function zKpis() {
  const s = zt.d.hw.summe;
  const mo = zMontag(new Date()), so = isoTag(plusTage(ausIso(mo), 6));
  const wl = zt.d.hl.filter((e) => zTag(e.start) >= mo && zTag(e.start) <= so);
  const sum = (xs, k) => xs.reduce((a, e) => a + (e[k] || 0), 0);
  const manAbr = sum(wl.filter((e) => e.abrechenbar), 'gezaehlt_min');
  const intern = sum(wl.filter((e) => e.ziel_art === 'intern'), 'gezaehlt_min');
  const offen = zt.d.ol.filter((e) => e.abrechenbar);
  const k = (l, v, sub, klasse) => '<div class="karte zt-kpi"><span class="zt-ueber">' + esc(uebersetze(l)) + '</span><span class="mono zt-kpi-v ' + (klasse || '') + '">' + esc(v) + '</span><span class="hinweis">' + esc(sub) + '</span></div>';
  return '<div class="zt-kpis">' +
    k('Abrechenbar diese Woche', zdur(s.claude_min + manAbr) + ' h', 'Claude ' + zdur(s.claude_min) + ' + ' + uebersetze('manuell') + ' ' + zdur(manAbr)) +
    k('Arbeitszeit diese Woche', zdur(s.arbeitszeit_min) + ' h', uebersetze('Soll') + ' ' + zdur(s.soll_min) + ' h · ' + uebersetze('Parallelzeit nur einmal') + ' · ' + zdur(intern) + ' h ' + uebersetze('intern')) +
    k('Offen zur Abrechnung', eur(sum(offen, 'eur')), nf1.format(sum(offen, 'gezaehlt_min') / 60) + ' h · ' + offen.length + ' ' + uebersetze('Einträge, alle Zeiträume'), 'akzent') +
    k('Gleichzeitig mit Claude', zdur(sum(wl, 'parallel_min')) + ' h ' + uebersetze('parallel'), sum(wl, 'abzug_min') + ' ' + uebersetze('Min abgezogen') + ' · ' + uebersetze('Regel aus Zeitmodell und Tätigkeit')) +
  '</div>';
}

/* ---------- Woche ---------- */
const ZW_VON = 6 * 60, ZW_BIS = 22 * 60, ZW_SPANNE = ZW_BIS - ZW_VON;
const zY = (m) => (Math.max(0, Math.min(ZW_SPANNE, m - ZW_VON)) / ZW_SPANNE * 100).toFixed(2);
const zH = (a, b) => (Math.max(0, Math.min(b, ZW_BIS) - Math.max(a, ZW_VON)) / ZW_SPANNE * 100).toFixed(2);

function zWoche() {
  const heute = isoTag(new Date());
  const tage = Array.from({ length: 7 }, (_, i) => isoTag(plusTage(ausIso(zt.montag), i)));
  // ponytail: Tage hier nach Ortszeit, Summen und Claude-Fenster vom Server nach UTC-Tag — Montag kurz nach
  // Mitternacht fehlen Fenster, Summen weichen ab. Upgrade: Woche mit Zeitzonen-Versatz vom Server holen.
  const serverTag = Object.fromEntries((zt.d.woche.tage || []).map((x) => [x.tag, x]));
  const fenster = [].concat(...(zt.d.woche.tage || []).map((x) => x.claude_fenster));
  // Gebuchte Termine zeigt ihr Eintrag; ein Geist steht nur fuer Offenes.
  const termine = zt.termineAn ? zTermine(zt.d.woche).filter((x) => !x.gebucht_eintrag_id) : [];
  const t = zTimer();
  const jetzt = zMinute(Date.now());
  const legende = [['manuell abrechenbar', 'manuell'], ['nicht abrechenbar', 'intern'], ['Claude · Eigene Zeit', 'cl-eigene'], ['Claude · Aktivität', 'cl-akt'],
    ['abgezogen', 'abzug'], ['parallel abgerechnet', 'parallel']];
  let html = '<div class="zt-legende">' + legende.map(([l, k]) => '<span><span class="zt-lg ' + k + '"></span>' + esc(uebersetze(l)) + '</span>').join('') +
    (zt.termineAn ? '<span><span class="zt-lg termin"></span>' + esc(uebersetze('Termine')) + '</span>' : '') +
    '<span class="faint zt-legende-r">' + esc(uebersetze('Klick oder Ziehen: vergangen trägt Zeit nach, künftig legt einen Blocker an')) + '</span></div>' +
    '<div class="zt-woche-huelle"><div class="zt-woche" aria-label="' + esc(uebersetze('Woche, Stundenraster')) + '"><div></div>';
  for (const tag of tage) {
    const st = serverTag[tag] || { arbeitszeit_min: 0, soll_min: 0 };
    const p = st.arbeitszeit_min;
    const klasse = tag === heute ? 'akzent' : tag < heute && st.soll_min && p < st.soll_min ? 'warn' : st.soll_min && p >= st.soll_min ? 'ok' : 'faint';
    html += '<div class="zt-tagkopf"><b class="' + (tag === heute ? 'akzent' : st.soll_min ? '' : 'faint') + '">' + zWt(tag) + '</b><span class="faint">' + datumKurz(tag) + '</span>' +
      '<span class="mono ' + klasse + '">' + (p ? zdur(p) + ' h' : '–') + '</span></div>';
  }
  html += '<div class="zt-stunden">' + Array.from({ length: 9 }, (_, k) => '<span class="mono" style="top:' + zY(ZW_VON + k * 120) + '%">' + zzwei(6 + k * 2) + '</span>').join('') + '</div>';
  for (const tag of tage) {
    const es = zt.d.wl.filter((e) => zTag(e.start) === tag);
    const fe = fenster.filter((f) => zTag(f.von) === tag);
    let s = '<div class="zt-tag' + (tag === heute ? ' heute' : '') + (ausIso(tag).getDay() % 6 === 0 ? ' we' : '') + '" data-tag="' + tag + '">' +
      Array.from({ length: 8 }, (_, k) => '<span class="zt-linie" style="top:' + zY(ZW_VON + (k + 1) * 120) + '%"></span>').join('');
    for (const f of fe) {
      const a = zMinute(f.von), b = zMinute(f.bis);
      s += '<span class="zt-sitz ' + (f.modell === 'eingaben' ? 'cl-eigene' : 'cl-akt') + '" style="top:' + zY(a) + '%;height:' + zH(a, b) + '%" title="' +
        esc(uebersetze('Claude-Sitzung') + ' ' + zSitzName(f) + ' · ' + zhm(f.von) + '–' + zhm(f.bis) + ' · ' + uebersetze('Zeitmodell') + ' ' + zModell(f.modell)) + '"></span>';
    }
    for (const tm of termine.filter((x) => zTag(x.start) === tag)) {
      const a = zMinute(tm.start), b = zTag(tm.ende) === tag ? zMinute(tm.ende) : 24 * 60;
      const z = zTerminZiel(tm);
      s += '<button type="button" class="zt-geist ' + (tm.art === 'blocker' ? 'blocker' : 'meeting') + (tm.google_fehlt ? ' google-fehlt' : '') + '" data-aktion="zt-termin"' + zTerminDaten(tm) +
        ' style="top:' + Math.min(Number(zY(a)), 97.5) + '%;height:' + zH(a, b) + '%" title="' + esc(uebersetze(ZTA[tm.art]) + ' · ' + tm.titel + ' · ' + zhm(tm.start) + '–' + zhm(tm.ende) +
          (z ? ' · ' + (tm.ziel_von_hand ? '' : uebersetze('vermutet') + ' ') + z.l : '') + zGoogleMarke(tm)) + '">' +
        '<b>' + esc(tm.titel) + '</b><span>' + esc(uebersetze(ZTA[tm.art]) + (zBuchbar(tm) ? ' · ' + uebersetze('+ buchen') : '') + zGoogleMarke(tm)) + '</span></button>';
    }
    for (const e of es) {
      const z = zEintragZiel(e);
      const a = zMinute(e.start), b = zTag(e.ende) === tag ? zMinute(e.ende) : 24 * 60;
      const badge = e.kulanz_min ? [uebersetze('Kulanz') + ' ' + e.kulanz_min + ' Min', 'bad'] : e.abzug_min ? ['−' + e.abzug_min + ' Min', 'bad'] : e.parallel_min ? ['∥ +' + e.parallel_min + ' Min', 'ok'] : null;
      s += '<button type="button" class="zt-block' + (e.abrechenbar ? '' : ' intern') + (e.status === 'abgerechnet' ? ' abg' : '') + '" data-aktion="zt-eintrag" data-wert="' + e.id + '"' +
        ' style="top:' + Math.min(Number(zY(a)), 96.5) + '%;height:' + zH(a, b) + '%" title="' + esc(uebersetze(ZART[e.ziel_art]) + ' ' + z.l + ' · ' + e.taetigkeit + ' · ' + zhm(e.start) + '–' + zhm(e.ende) +
          ' · ' + uebersetze('gezählt') + ' ' + zdur(e.gezaehlt_min) + ' h' + (e.notiz ? ' · ' + e.notiz : '')) + '">' +
        '<b>' + esc(z.l) + '</b><span>' + esc(e.taetigkeit + ' · ' + zdur(e.gezaehlt_min)) + '</span>' +
        (badge ? '<span class="zt-badge ' + badge[1] + ' mono">' + esc(badge[0]) + '</span>' : '') + '</button>';
      // Ueberlappung schraffiert: rot, wenn der Eintrag Minuten abgibt, gruen, wenn parallel gezaehlt.
      const art = e.kulanz_min || e.abzug_min ? 'abzug' : e.parallel_min ? 'parallel' : null;
      if (art) {
        for (const f of fe) {
          const v = Math.max(Date.parse(e.start), Date.parse(f.von)), w = Math.min(Date.parse(e.ende), Date.parse(f.bis));
          if (w > v) s += '<span class="zt-schraffur ' + art + '" style="top:' + zY(zMinute(v)) + '%;height:' + zH(zMinute(v), zMinute(w)) + '%"></span>';
        }
      }
    }
    if (t && tag === heute) {
      const a = zTag(t.start) === tag ? zMinute(t.start) : 0;   // seit gestern: ab Mitternacht
      s += '<a class="zt-block lauf" href="#/zeit" title="' + esc(uebersetze('Laufender Timer')) + '" style="top:' + zY(a) + '%;height:' + zH(a, Math.max(jetzt, a + 12)) + '%">' +
        '<b>Timer · ' + esc(zielKurz(t.ziel_art, t.ziel_schluessel)) + '</b><span class="mono zeit-uhr">' + uhrText(Date.now() - Date.parse(t.start)) + '</span></a>';
    }
    if (tag === heute) s += '<span class="zt-jetzt-linie" style="top:' + zY(jetzt) + '%"></span>';
    html += s + '<span class="zt-zug mono" hidden></span></div>';
  }
  return html + '</div></div>';
}

const zLaedt = () => (zt.fehler ? leer('uhr', 'Zeiterfassung nicht geladen', zt.fehler,
  '<button type="button" class="knopf klein" data-aktion="zt-neu-laden">' + esc(uebersetze('Erneut versuchen')) + '</button>')
  : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>');

/* ---------- Monat ---------- */
function zMonat() {
  const m = zt.d.monat;
  if (!m) return zLaedt();
  const heute = isoTag(new Date());
  const s = m.summe;
  const claude = m.tage.reduce((a, x) => a + x.claude_min, 0), man = m.tage.reduce((a, x) => a + x.manuell_min, 0);
  const vorlauf = (ausIso(m.tage[0].tag).getDay() + 6) % 7;
  let zellen = '<span></span>'.repeat(vorlauf);
  const erster = ausIso(m.tage[0].tag);
  const letzter = new Date(erster.getFullYear(), erster.getMonth() + 1, 0).getDate();
  const tage = m.tage.concat(Array.from({ length: letzter - m.tage.length }, (_, i) => {
    const tag = isoTag(new Date(erster.getFullYear(), erster.getMonth(), m.tage.length + i + 1));
    return { tag, arbeitszeit_min: 0, claude_min: 0, manuell_min: 0, soll_min: ausIso(tag).getDay() % 6 ? 1 : 0, abweichung_min: 0 };
  }));
  for (const x of tage) {
    const zukunft = x.tag > heute;
    const abw = x.soll_min && !zukunft ? (x.abweichung_min >= 0 ? '+' : '−') + zdur(Math.abs(x.abweichung_min)) : '';
    zellen += '<button type="button" class="zt-mzelle' + (x.tag === heute ? ' heute' : '') + (x.soll_min ? '' : ' we') + (zukunft ? ' zukunft' : '') + '" data-aktion="zt-mtag" data-wert="' + x.tag + '"' +
      ' title="' + esc(x.arbeitszeit_min ? uebersetze('Arbeitszeit') + ' ' + zdur(x.arbeitszeit_min) + ' h · Claude ' + zdur(x.claude_min) + ' · ' + uebersetze('manuell') + ' ' + zdur(x.manuell_min) : '') + '">' +
      '<span class="zt-mkopf"><b>' + Number(x.tag.slice(8)) + (x.tag === heute ? ' · ' + esc(uebersetze('heute')) : '') + '</b><span class="mono ' + (x.abweichung_min >= 0 ? 'ok' : 'warn') + '">' + abw + '</span></span>' +
      '<span class="mono zt-mwert">' + (x.arbeitszeit_min ? zdur(x.arbeitszeit_min) + ' h' : '') + '</span>' +
      '<span class="zt-mbalken"><span style="width:' + (Math.min(x.claude_min, 600) / 6).toFixed(1) + '%"></span><span class="m" style="width:' + (Math.min(x.manuell_min, 600) / 6).toFixed(1) + '%"></span></span></button>';
  }
  return '<div class="zt-msumme">' +
      '<span>' + esc(uebersetze('Arbeitszeit')) + ' <b class="mono">' + zdur(s.arbeitszeit_min) + ' h</b> ' + esc(uebersetze('von')) + ' ' + zdur(s.soll_min) + ' h ' + esc(uebersetze('Soll')) + '</span>' +
      '<span>' + esc(uebersetze('Saldo')) + ' <b class="mono ' + (s.saldo_min >= 0 ? 'ok' : 'warn') + '">' + (s.saldo_min >= 0 ? '+' : '−') + zdur(Math.abs(s.saldo_min)) + ' h</b></span>' +
      '<span>Claude <b class="mono akzent">' + zdur(claude) + ' h</b> · ' + esc(uebersetze('manuell')) + ' <b class="mono">' + zdur(man) + ' h</b></span>' +
      '<span>' + esc(uebersetze('Soll erfüllt an')) + ' <b>' + s.soll_erfuellt_tage + ' ' + esc(uebersetze('von')) + ' ' + s.soll_tage + '</b> ' + esc(uebersetze('Tagen')) + '</span></div>' +
    '<div class="zt-monat">' + zWochentage().map((w) => '<span class="zt-mwt">' + w + '</span>').join('') + zellen + '</div>' +
    '<span class="hinweis">' + esc(uebersetze('Balken: Claude ■ · manuell ■ · Zahl oben rechts: Abweichung vom Tagessoll · Arbeitszeit zählt Parallelzeit nur einmal')) + '</span>';
}

/* ---------- Nach Ziel ---------- */
function zNachZiel() {
  const zs = zt.d.zieleTab;
  if (!zs) return zLaedt();
  const rows = zs.filter((z) => zt.zielTab === 'alle' || (zt.zielTab === 'offen' ? z.status === 'offen' : z.status === 'abgerechnet'));
  return segment('zt-zieltab', [['alle', 'Alle Ziele'], ['offen', 'Offene Vorgänge'], ['abg', 'Abgeschlossene']], zt.zielTab, 'Nach Ziel') +
    '<div class="zt-tab-huelle"><div class="zt-tab zt-ztab"><div class="zt-tkopf"><span>' + ['Ziel', 'Art'].map((x) => esc(uebersetze(x))).join('</span><span>') + '</span>' +
      ['Einträge', 'Manuell', 'Offen', 'Abger.', 'Offen EUR'].map((x) => '<span class="r">' + esc(uebersetze(x)) + '</span>').join('') + '<span>' + esc(uebersetze('Status')) + '</span></div>' +
    rows.map((z) => {
      const ziel = zZielVon(z.ziel_art, z.ziel_schluessel, z.name, z.projekt);
      return '<button type="button" class="zt-tzeile" data-aktion="zt-zielfilter" data-wert="' + esc(JSON.stringify([z.ziel_art, z.ziel_schluessel])) + '">' +
        '<span class="zt-zname"><b class="mono akzent">' + esc(ziel.l) + '</b><span>' + esc(ziel.t) + '</span></span><span class="faint">' + esc(uebersetze(ZART[z.ziel_art])) + '</span>' +
        '<span class="mono r faint">' + z.eintraege + '</span><span class="mono r">' + zdur(z.manuell_min) + '</span>' +
        '<span class="mono r akzent">' + (z.offen_min ? zdur(z.offen_min) : '–') + '</span><span class="mono r ok">' + (z.abgerechnet_min ? zdur(z.abgerechnet_min) : '–') + '</span>' +
        '<span class="mono r">' + (z.offen_eur ? nf2.format(z.offen_eur) : '–') + '</span><span>' + pille(z.status) + '</span></button>';
    }).join('') +
    (rows.length ? '' : '<div class="leer">' + esc(uebersetze('Keine Einträge in diesem Zeitraum.')) + '</div>') + '</div></div>' +
    '<span class="hinweis">' + esc(uebersetze('Klick auf eine Zeile filtert die Einträge darunter.')) + '</span>';
}

/* ---------- Eintraege ---------- */
function zEintraege() {
  const heute = isoTag(new Date());
  const f = zt.filter;
  const zf = zt.zielFilter;
  const liste = zt.d.pl.filter((e) => (!zf || (e.ziel_art === zf[0] && String(e.ziel_schluessel) === String(zf[1]))) &&
    (f === 'alle' || (f === 'heute' && zTag(e.start) === heute) || (f === 'offen' && e.status === 'offen' && e.abrechenbar) ||
      (f === 'abgerechnet' && e.status === 'abgerechnet') || (f === 'nicht' && !e.abrechenbar)));
  const ov = (e) => (e.kulanz_min ? [uebersetze('Kulanz') + ' ' + e.kulanz_min + ' Min', 'bad'] : e.abzug_min ? ['−' + e.abzug_min + ' Min', 'bad']
    : e.parallel_min ? ['∥ ' + e.parallel_min + ' ' + uebersetze('Min parallel'), 'ok'] : ['–', 'faint']);
  const zfName = zf && (zt.d.pl.find((e) => e.ziel_art === zf[0] && String(e.ziel_schluessel) === String(zf[1])) || {}).name;
  return '<section class="karte zt-eintraege"><div class="zt-k">' +
      '<h2>' + esc(uebersetze('Einträge')) + '</h2>' +
      segment('zt-filter', [['heute', 'Heute'], ['alle', 'Alle'], ['offen', 'Offen'], ['abgerechnet', 'Abgerechnet'], ['nicht', 'Nicht abrechenbar']], f, 'Einträge') +
      (zf ? '<button type="button" class="chip" aria-pressed="true" data-aktion="zt-zielfilter" data-wert="" aria-label="' + esc(uebersetze('Ziel-Filter entfernen')) + '">' +
        esc(uebersetze('Ziel') + ': ' + zZielVon(zf[0], zf[1], zfName).l) + ' ×</button>' : '') +
      '<button type="button" class="knopf akzent-rand zt-rechts" data-aktion="gehe" data-wert="' + esc(zAbrechnenLink(zf)) + '">' + esc(uebersetze('Offene abrechnen →')) + '</button></div>' +
    '<div class="zt-tab-huelle"><div class="zt-tab zt-etab"><div class="zt-tkopf">' +
      ['Datum', 'Zeit', 'Ziel', 'Tätigkeit', 'Notiz'].map((x) => '<span>' + esc(uebersetze(x)) + '</span>').join('') +
      '<span class="r">' + esc(uebersetze('Gezählt')) + '</span><span>' + esc(uebersetze('Überlappung')) + '</span><span class="r">' + esc(uebersetze('Betrag')) + '</span><span>' + esc(uebersetze('Status')) + '</span></div>' +
    liste.map((e) => {
      const z = zEintragZiel(e);
      const o = ov(e);
      const st = e.status === 'abgerechnet' ? '<span class="pille st st-abgerechnet">' + esc(uebersetze('gesperrt') + ' · ' + (e.rechnung_nr || '')) + '</span>'
        : '<span class="pille st' + (e.abrechenbar ? ' st-offen' : ' st-storniert') + '">' + esc(uebersetze(e.abrechenbar ? 'offen' : 'intern')) + '</span>';
      return '<button type="button" class="zt-tzeile' + (e.status === 'abgerechnet' ? ' abg' : '') + '" data-aktion="zt-eintrag" data-wert="' + e.id + '">' +
        '<span>' + esc(zWt(zTag(e.start)) + ' ' + datumKurz(zTag(e.start))) + '</span><span class="mono faint">' + zhm(e.start) + '–' + zhm(e.ende) + '</span>' +
        '<span class="zt-zname"><span class="zt-ell"><b class="mono akzent">' + esc(z.l) + '</b> ' + esc(e.ziel_art === 'vorgang' ? z.t : '') + '</span><span class="faint">' + esc(uebersetze(ZART[e.ziel_art])) + '</span></span>' +
        '<span>' + esc(e.taetigkeit) + '</span><span class="faint zt-ell">' + esc(e.notiz || '–') + '</span>' +
        '<span class="mono r">' + zdur(e.gezaehlt_min) + '</span><span class="mono ' + o[1] + ' zt-ell">' + esc(o[0]) + '</span>' +
        '<span class="mono r' + (e.abrechenbar ? '' : ' faint') + '">' + (e.abrechenbar ? nf2.format(e.eur) : '—') + '</span><span>' + st + '</span></button>';
    }).join('') +
    (liste.length ? '' : '<div class="leer">' + esc(uebersetze('Keine Einträge in diesem Filter.')) + '</div>') +
    '<div class="zt-tsumme"><span>' + esc(uebersetze('Summe') + ' · ' + liste.length + ' ' + uebersetze('Einträge')) + '</span>' +
      '<span class="mono r">' + zdur(liste.reduce((a, e) => a + e.gezaehlt_min, 0)) + ' h</span><span></span>' +
      '<span class="mono r">' + eur(liste.reduce((a, e) => a + (e.eur || 0), 0)) + '</span><span></span></div>' +
  '</div></div></section>';
}

/* ---------- Seite ---------- */
function zeichneZeit(w, teile, neu) {
  if (['woche', 'monat', 'ziele'].includes(teile[0]) && teile[0] !== zt.ansicht) { zt.ansicht = teile[0]; merke('zeit.ansicht', zt.ansicht); }
  if (!zt.montag) zt.montag = zMontag(new Date());
  const z = aktuellerZeitraum();
  const schluessel = [z.von, z.bis, zt.montag, zt.ansicht].join('|');
  if (neu || zt.schluessel !== schluessel) {
    zt.schluessel = schluessel;
    if (neu) zt.d.ziele = null;   // neue Vorgaenge und Kontakte seit dem letzten Besuch
    zeitLaden();
  }
  if (!zt.d.woche) {
    w.innerHTML = '<div class="karte weit">' + (zt.fehler ? leer('uhr', 'Zeiterfassung nicht geladen', zt.fehler,
      '<button type="button" class="knopf klein" data-aktion="zt-neu-laden">' + esc(uebersetze('Erneut versuchen')) + '</button>') : '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>') + '</div>';
    return;
  }
  // Waehrend getippt oder gezogen wird, ersetzt kein Nachladen das Feld unter dem Zeiger.
  const fokus = document.activeElement;
  if (zt.zieht || (fokus && fokus.tagName === 'INPUT' && w.contains(fokus))) return;
  const ing = state.live && state.live.lastIngest;
  const warn = (ing && ing.zeit_fehler ? '<div class="hinweis warn">' + esc(uebersetze('Zeiteinträge nicht nachgerechnet') + ': ' + ing.zeit_fehler) + '</div>' : '') +
    // Nachladen gescheitert: der alte Stand bleibt stehen, aber nicht unbemerkt.
    (zt.fehler ? '<div class="hinweis warn">' + esc(uebersetze('Nicht aktualisiert') + ': ' + zt.fehler) +
      ' <button type="button" class="textknopf" data-aktion="zt-neu-laden">' + esc(uebersetze('Erneut versuchen')) + '</button></div>' : '');
  const nichts = !zt.d.pl.length && !zt.d.wl.length && !zt.d.ol.length && !zTimer();
  if (nichts) {
    w.innerHTML = '<div class="zt-seite">' + warn + '<div class="zt-oben">' + zTimerKarte() + '<section class="karte">' +
      leer('uhr', 'Noch keine Zeit erfasst', 'Starte den Timer oder trage Zeit nach — manuelle Arbeitszeit fließt in Arbeitswert, Marge und Rechnung.',
        '<button type="button" class="knopf primaer" data-aktion="zt-neu">' + esc(uebersetze('+ Zeit nachtragen')) + '</button>') + '</section></div></div>';
  } else {
    const so = isoTag(plusTage(ausIso(zt.montag), 6));
    const label = zt.ansicht === 'woche' ? uebersetze('KW') + ' ' + kw(zt.montag) + ' · ' + zeitraumText({ von: zt.montag, bis: so })
      : zt.ansicht === 'monat' ? new Date().toLocaleDateString(istDE() ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' }) + ' · ' + uebersetze('Tagessoll') + ' ' + zdur((zt.d.woche.tage.find((x) => x.soll_min) || {}).soll_min) + ' h'
        : uebersetze('alle Einträge, gruppiert nach Vorgang, Projekt, Kunde');
    w.innerHTML = '<div class="zt-seite">' + warn +
      '<div class="zt-oben">' + zTimerKarte() + zHeuteKarte() + '</div>' + zKpis() +
      '<section class="karte zt-ansicht"><div class="zt-k">' +
        segment('zt-ansicht', [['woche', 'Woche'], ['monat', 'Monat'], ['ziele', 'Nach Ziel']], zt.ansicht, 'Ansicht') +
        '<span class="hinweis">' + esc(label) + '</span>' +
        (zt.ansicht === 'woche' ? '<span class="zt-wnav"><button type="button" class="mini-knopf" data-aktion="zt-woche" data-wert="-7" aria-label="' + esc(uebersetze('Vorige Woche')) + '">‹</button>' +
          '<button type="button" class="textknopf" data-aktion="zt-woche" data-wert="0">' + esc(uebersetze('Diese Woche')) + '</button>' +
          '<button type="button" class="mini-knopf" data-aktion="zt-woche" data-wert="7" aria-label="' + esc(uebersetze('Nächste Woche')) + '">›</button></span>' : '') +
        zKalenderLeiste() +
      '</div>' + (zt.ansicht === 'woche' ? zWoche() : zt.ansicht === 'monat' ? zMonat() : zNachZiel()) + '</section>' +
      zEintraege() + '</div>';
    zWocheZiehen(w);
  }
  const notiz = w.querySelector('#zt-notiz');
  if (notiz) notiz.addEventListener('input', () => { zt.form.notiz = notiz.value; merke('zeit.timer', zt.form); });
  tickUhr();
}

// Klick auf eine freie Stelle traegt ab dort eine Stunde nach, Ziehen den gezogenen Bereich (15-Min-Raster).
function zWocheZiehen(w) {
  const minuteBei = (el, y) => {
    const r = el.getBoundingClientRect();
    return Math.max(ZW_VON, Math.min(ZW_BIS, ZW_VON + Math.round((y - r.top) / r.height * ZW_SPANNE / 15) * 15));
  };
  const hm = zHM;
  for (const el of w.querySelectorAll('.zt-tag')) {
    const zug = el.querySelector('.zt-zug');
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button, a')) return;
      const m = minuteBei(el, e.clientY);
      zt.zieht = { a: m, b: m };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!zt.zieht) return;
      zt.zieht.b = minuteBei(el, e.clientY);
      const a = Math.min(zt.zieht.a, zt.zieht.b), b = Math.max(zt.zieht.a, zt.zieht.b);
      zug.hidden = b - a < 15;
      zug.style.top = zY(a) + '%'; zug.style.height = zH(a, b) + '%';
      zug.textContent = hm(a) + '–' + hm(b);
    });
    el.addEventListener('pointerup', () => {
      const g = zt.zieht;
      zt.zieht = null;
      zug.hidden = true;
      if (!g) return;
      const a = Math.min(g.a, g.b), b = Math.max(g.a, g.b);
      const tag = el.dataset.tag, bis = b - a < 15 ? Math.min(a + 60, ZW_BIS) : b;
      // Kuenftig: Blocker anlegen; vergangen: nachtragen (der Server bucht nichts, was noch nicht war).
      if (Date.parse(zIso(tag, a)) > Date.now()) zTerminDialog({ neu: { art: 'blocker', tag, von: hm(a), bis: hm(bis) } });
      else zeitNachtrag({ tag, von: hm(a), bis: hm(bis) });
    });
    el.addEventListener('pointercancel', () => { zt.zieht = null; zug.hidden = true; });
  }
}

registriere('zeit', {
  zeichne: zeichneZeit,
  live() { if (!zt.zieht && !document.getElementById('dialog') && !document.getElementById('zt-picker')) zeitLaden(); },
});

/* ---------- Aktionen der Seite ---------- */
aktion('zt-neu-laden', () => zeitLaden());
aktion('zt-ansicht', (v) => { zt.ansicht = v; merke('zeit.ansicht', v); zeichneAnsicht(); });
aktion('zt-filter', (v) => { zt.filter = v; zeichneAnsicht(); });
aktion('zt-zieltab', (v) => { zt.zielTab = v; zeichneAnsicht(); });
aktion('zt-zielfilter', (v) => {
  try { zt.zielFilter = v ? JSON.parse(v) : null; } catch { zt.zielFilter = null; }
  if (zt.zielFilter) zt.filter = 'alle';
  zeichneAnsicht();
});
aktion('zt-woche', (v) => { zt.montag = Number(v) ? isoTag(plusTage(ausIso(zt.montag), Number(v))) : zMontag(new Date()); zeichneAnsicht(); });
aktion('zt-mtag', (tag) => { zt.montag = zMontag(ausIso(tag)); zt.ansicht = 'woche'; merke('zeit.ansicht', 'woche'); zeichneAnsicht(); });
aktion('zt-taet', (n) => { if (zTimer()) return; zt.form.taetigkeit = n; merke('zeit.timer', zt.form); zeichneAnsicht(); });
aktion('zt-neu', () => zeitNachtrag());
aktion('zt-eintrag', (id) => zeitNachtrag({ id: Number(id) }));
aktion('zt-picker', (fuer) => zeitPicker(fuer));
aktion('zt-timer', (_, el) => (zTimer() ? zeitStopp(el) : zeitStart(el)));
aktion('zeit-stopp', (_, el) => zeitStopp(el));
aktion('zt-twahl', async (wahl) => {
  const v = zt.d.timer && zt.d.timer.vorschau;
  if (!v) return;
  try {
    const r = await sende('/api/zeit/timer-wahl', { session_ids: v.sitzungen.map((s) => s.session_id), wahl });
    zt.d.timer = { timer: r.timer, vorschau: r.vorschau };
    if (state.live) state.live.timer = r.timer;
    zeichneAnsicht();
  } catch (e) {
    toast(uebersetze('Wahl nicht gespeichert') + ': ' + e.message, 'err');
    zeitLaden();
  }
});
aktion('zt-verwerfen', (_, el) => mitLauf(el, async () => {
  if (!window.confirm(uebersetze('Laufenden Timer verwerfen? Die Zeit wird nicht gebucht.'))) return;
  try {
    await sende('/api/zeit/timer-verwerfen', {});
    if (state.live) state.live.timer = null;
    zeichneMiniTimer();
  } catch (e) { toast(uebersetze('Timer nicht verworfen') + ': ' + e.message, 'err'); }
  zeitNachAenderung();
}));

async function zeitStart(knopf) {
  const f = zt.form;
  if (!f.ziel) { zeitPicker('timer'); return; }
  const tats = (zt.d.taet || []).map((x) => x.name);
  const taetigkeit = tats.includes(f.taetigkeit) ? f.taetigkeit : tats.includes('Entwicklung') ? 'Entwicklung' : tats[0];
  await mitLauf(knopf, async () => {
    try {
      const r = await sende('/api/zeit/timer-start', { ziel_art: f.ziel.art, ziel_schluessel: f.ziel.schluessel, taetigkeit, notiz: f.notiz || '', abrechenbar: f.ziel.art !== 'intern' });
      if (state.live) state.live.timer = r.timer;
      zeichneMiniTimer();
      zMerkeZuletzt(f.ziel);
      // Lief noch ein Timer (zweiter Tab), hat der Server ihn gebucht — sagen.
      if (r.gebucht) toast(uebersetze('Laufender Timer gebucht') + ' · ' + zdur(r.gebucht.gezaehlt_min) + ' h', 'ok');
    } catch (e) { toast(uebersetze('Timer nicht gestartet') + ': ' + e.message, 'err'); }
  });
  zeitNachAenderung();
}

async function zeitStopp(knopf) {
  const alt = zTimer();
  if (!alt) return;
  await mitLauf(knopf, async () => {
    try {
      const r = await sende('/api/zeit/timer-stop', {});
      if (state.live) state.live.timer = null;
      zeichneMiniTimer();
      if (r.verworfen) toast(uebersetze('Timer verworfen (unter 1 Min)'), 'ok');
      else {
        toast(uebersetze('Timer gebucht') + ' · ' + zdur(r.eintrag.gezaehlt_min) + ' h ' + uebersetze('auf') + ' ' + zielKurz(alt.ziel_art, alt.ziel_schluessel), 'ok',
          { text: uebersetze('Rückgängig'), tu: () => zeitStoppZurueck(r.eintrag) });
      }
    } catch (e) { toast(uebersetze('Timer nicht gebucht') + ': ' + e.message, 'err'); }
  });
  zeitNachAenderung();
}
// Rueckgaengig: der Server loescht die Buchung und laesst den Timer mit altem
// Beginn und alten Wahlen weiterlaufen — in einem Schritt, nie nur halb.
async function zeitStoppZurueck(eintrag) {
  try {
    const r = await sende('/api/zeit/timer-zurueck', { id: eintrag.id });
    if (state.live) state.live.timer = r.timer;
    zeichneMiniTimer();
    toast(uebersetze('Timer läuft weiter'), 'ok');
  } catch (e) { toast(uebersetze('Rückgängig fehlgeschlagen') + ': ' + e.message, 'err'); }
  zeitNachAenderung();
}

/* ---------- Nachtrag-Dialog ---------- */
let zd = null;
// "9:05", "09:05", "9" -> Minuten; sonst NaN.
function zUhrzeit(s) {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(String(s || ''));
  if (!m || Number(m[1]) > 23 || Number(m[2] || 0) > 59) return NaN;
  return Number(m[1]) * 60 + Number(m[2] || 0);
}
// "1:30" oder "1,5" (Stunden) -> Minuten; sonst NaN.
function zDauer(s) {
  const t = String(s || '').trim();
  let m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(t);
  return m ? Math.round(Number(m[1] + '.' + (m[2] || '0')) * 60) : NaN;
}
const zIso = (tag, min) => { const d = ausIso(tag); d.setMinutes(min); return d.toISOString(); };
const zAlleEintraege = () => [...(zt.d.pl || []), ...(zt.d.wl || []), ...(zt.d.hl || []), ...(zt.d.ol || [])];

// opts: { id } zum Bearbeiten, sonst { tag, von, bis } als Vorbelegung; aus einem
// Termin zusaetzlich { termin, ziel (nur von Hand gesetzt), vorschlag (geraten), plusTag }.
function zeitNachtrag(opts = {}) {
  if (route().name !== 'zeit') geheZu('zeit');
  const e = opts.id ? zAlleEintraege().find((x) => x.id === opts.id) : null;
  if (opts.id && !e) { toast(uebersetze('Eintrag nicht gefunden — Liste wird neu geladen.'), 'err'); zeitLaden(); return; }
  zk = null;
  const jetzt = new Date();
  const vonStd = Math.max(0, Math.floor(zMinute(jetzt) / 30) * 30 - 60);
  const ausT = opts.termin || null;
  // Aus einem Termin nie das Timer-Ziel unterschieben: ohne bestaetigtes Ziel bleibt es leer.
  const zielNeu = ausT ? opts.ziel || null : zt.form.ziel || null;
  const meeting = ausT && ausT.art === 'meeting' && (zt.d.taet || []).some((x) => x.name === 'Meeting');
  zd = e ? {
    // plusTag: endet der Eintrag am Folgetag (ueber Mitternacht), gehoert "Ende" dorthin.
    id: e.id, gesperrt: e.status === 'abgerechnet', rn: e.rechnung_nr, tag: zTag(e.start), von: zhm(e.start), bis: zhm(e.ende), pause: String(e.pause_min || 0),
    plusTag: zTag(e.ende) !== zTag(e.start) && !e.dauer_fest_min ? 1 : 0,
    modus: e.dauer_fest_min ? 'dauer' : 'zeit', dauer: e.dauer_fest_min ? zdur(e.dauer_fest_min) : '', ziel: zEintragZiel(e), taetigkeit: e.taetigkeit,
    notiz: e.notiz || '', abr: !!e.abrechenbar, wahl: null, sitzIds: [], v: null, fehler: '',
  } : {
    id: null, gesperrt: false, plusTag: opts.plusTag || 0, tag: opts.tag || isoTag(jetzt), von: opts.von || zzwei(Math.floor(vonStd / 60)) + ':' + zzwei(vonStd % 60),
    bis: opts.bis || zzwei(Math.floor((vonStd + 60) / 60)) + ':' + zzwei((vonStd + 60) % 60), pause: '0', modus: 'zeit', dauer: '',
    ziel: zielNeu, taetigkeit: meeting ? 'Meeting' : zt.form.taetigkeit || 'Entwicklung', notiz: ausT ? String(ausT.titel || '').slice(0, 500) : '',
    abr: !zielNeu || zielNeu.art !== 'intern', wahl: null, sitzIds: [], v: null, fehler: '',
    termin: ausT ? { kalender_id: ausT.kalender_id, uid: ausT.uid } : null, terminTitel: ausT ? ausT.titel : '', vorschlag: ausT ? opts.vorschlag || null : null,
  };
  const g = zd.gesperrt ? ' disabled' : '';
  const feld = (id, l, wert, ph) => '<label class="feld"><span class="label">' + esc(uebersetze(l)) + '</span><input id="' + id + '" class="mono" value="' + esc(wert) + '" placeholder="' + esc(ph) + '"' + g + ' autocomplete="off"></label>';
  const titel = zd.termin ? 'Termin buchen' : zd.id == null ? 'Zeit nachtragen' : zd.gesperrt ? 'Eintrag · gesperrt' : 'Eintrag bearbeiten';
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze(titel)) + '</h2>' +
      (zd.termin ? '<span class="hinweis">' + esc(uebersetze('Aus Termin') + ' „' + zd.terminTitel + '“') + '</span>' : '') + '</div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    (zd.gesperrt ? '<div class="zt-gesperrt">' + esc(uebersetze('Abgerechnet mit Rechnung') + ' ' + (zd.rn || '') + ' ' + uebersetze('— gesperrt, Satz eingefroren. Korrektur nur per Gutschrift.')) + '</div>' : '') +
    // Chips fuer die Woche, das Datumsfeld fuer jeden anderen Tag (nachgetragen wird bis heute).
    '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Tag')) + '</span><div class="zt-tagwahl"><div id="ztd-tag"></div>' +
      (zd.gesperrt ? '' : '<input type="date" id="ztd-datum" class="zt-eingabe zt-datum mono" max="' + isoTag(new Date()) + '" aria-label="' + esc(uebersetze('Anderer Tag')) + '">') + '</div></div>' +
    '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Termin- / Blockerzeit')) + '</span><div class="zt-drei">' +
      feld('ztd-von', 'Beginn', zd.von, '09:00') + feld('ztd-bis', 'Ende', zd.bis, '10:30') + feld('ztd-pause', 'Pause (Min)', zd.pause, '0') + '</div></div>' +
    '<div class="zt-dfeld" id="ztd-modus"></div>' +
    '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Buchen auf')) + '</span><div id="ztd-ziel" class="zt-feld"></div></div>' +
    '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Tätigkeit')) + '</span><div id="ztd-taet" class="zt-chips"></div></div>' +
    '<input id="ztd-notiz" class="zt-eingabe" maxlength="500" value="' + esc(zd.notiz) + '"' + g + ' placeholder="' + esc(uebersetze('Notiz — erscheint auf der Rechnungsposition')) + '" aria-label="' + esc(uebersetze('Notiz')) + '">' +
    '<div id="ztd-abr"></div><div id="ztd-ov"></div><div id="ztd-sum" class="zt-dsumme"></div>' +
    '<span class="dialog-fehler" id="ztd-fehler" role="alert"></span>' +
    '<div class="dialog-fuss">' + (zd.id != null && !zd.gesperrt ? '<button type="button" class="knopf zt-loeschen" data-aktion="ztd-loeschen">' + esc(uebersetze('Löschen')) + '</button>' : '') +
      '<button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze(zd.gesperrt ? 'Schließen' : 'Abbrechen')) + '</button>' +
      (zd.gesperrt ? '' : '<button type="button" class="knopf primaer" id="ztd-buchen" data-aktion="ztd-buchen">' + esc(uebersetze('Buchen')) + '</button>') + '</div>',
  titel, 580);
  const grund = document.getElementById('dialog');
  grund.addEventListener('input', (ev) => {
    if (!zd) return;
    if (ev.target.id === 'ztd-datum') {
      if (zd.gesperrt || !/^\d{4}-\d{2}-\d{2}$/.test(ev.target.value)) return;
      zd.tag = ev.target.value; zdZeichnen(); zdVorschauBald(0);
      return;
    }
    const k = { 'ztd-von': 'von', 'ztd-bis': 'bis', 'ztd-pause': 'pause', 'ztd-notiz': 'notiz', 'ztd-dauer': 'dauer' }[ev.target.id];
    if (!k) return;
    zd[k] = ev.target.value;
    zdVorschauBald();
  });
  grund.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); const b = grund.querySelector('#ztd-buchen'); if (b) b.click(); } });
  // Von einer anderen Seite aus geoeffnet: die Taetigkeiten sind evtl. noch nicht geladen.
  if (!zt.d.taet) {
    hole('/api/taetigkeitsarten').then((t) => { zt.d.taet = t; zdZeichnen(); }, (err) => { if (zd) { zd.fehler = err.message; zdZeichnen(); } });
  }
  zdZeichnen();
  zdVorschauBald(0);
}

// Die wechselnden Teile neu, die Eingabefelder bleiben (Fokus, Cursor).
function zdZeichnen() {
  const grund = document.getElementById('dialog');
  if (!grund || !zd) return;
  const g = zd.gesperrt;
  const tage = Array.from({ length: 7 }, (_, i) => isoTag(plusTage(ausIso(zMontag(ausIso(zd.tag))), i)));
  const setze = (id, html) => { const el = grund.querySelector('#' + id); if (el) el.innerHTML = html; };
  setze('ztd-tag', g ? '<span class="mono">' + esc(datum(zd.tag)) + '</span>' : '<div class="zt-chips">' + tage.map((t) =>
    '<button type="button" class="chip" data-aktion="ztd-tag" data-wert="' + t + '" aria-pressed="' + (t === zd.tag) + '">' + esc(zWt(t) + ' ' + t.slice(8)) + '</button>').join('') + '</div>');
  const dat = grund.querySelector('#ztd-datum');
  if (dat && dat.value !== zd.tag) dat.value = zd.tag;
  const m = grund.querySelector('#ztd-modus');
  if (m && m.dataset.modus !== zd.modus) {
    m.dataset.modus = zd.modus;
    m.innerHTML = '<div class="zt-dzeile"><span class="zt-ueber">' + esc(uebersetze('Time Split Art')) + '</span>' +
      segment('ztd-modus', [['zeit', 'Nach Uhrzeit'], ['dauer', 'Feste Dauer']], zd.modus, 'Time Split Art') + '</div>' +
      '<span class="hinweis">' + esc(uebersetze(zd.modus === 'zeit' ? 'Gezählt wird die tatsächlich verstrichene Zeit im Termin — minus Pause und Überlappung, gerundet auf 5 Min.'
        : 'Gezählt wird die feste Dauer, sobald der Termin begonnen hat — unabhängig davon, wie lange er wirklich dauert.')) + '</span>' +
      (zd.modus === 'dauer' ? '<label class="feld zt-dauer"><span class="label">' + esc(uebersetze('Feste Dauer')) + '</span><input id="ztd-dauer" class="mono" value="' + esc(zd.dauer) + '" placeholder="' +
        esc(uebersetze('1:30 oder 1,5')) + '"' + (g ? ' disabled' : '') + ' autocomplete="off"></label>' : '');
  }
  // Geratenes Ziel aus dem Termintitel: nur ein Angebot, gebucht wird erst nach Klick (Pflicht aus Z6a).
  const vs = !g && !zd.ziel && zd.vorschlag ? '<button type="button" class="chip zt-vorschlag" data-aktion="ztd-vorschlag">' +
    esc(uebersetze('Vorschlag aus dem Titel') + ': ' + zd.vorschlag.l + ' — ' + uebersetze('übernehmen')) + '</button>' : '';
  setze('ztd-ziel', zZielKnopf(zd.ziel, 'dialog', g) + vs + '<span class="hinweis">' + esc(zZielSub(zd.ziel, zd.taetigkeit)) + '</span>');
  setze('ztd-taet', (zt.d.taet || []).map((x) => '<button type="button" class="chip" data-aktion="ztd-taet" data-wert="' + esc(x.name) + '" aria-pressed="' + (x.name === zd.taetigkeit) + '"' + (g ? ' disabled' : '') + '>' + esc(x.name) + '</button>').join(''));
  const intern = zd.ziel && zd.ziel.art === 'intern';
  const an = zd.abr && !intern;
  setze('ztd-abr', '<button type="button" class="kippschalter" role="switch" data-aktion="ztd-abr" aria-checked="' + an + '"' + (g || intern ? ' disabled' : '') + '><span class="spur"></span>' +
    esc(uebersetze('Abrechenbar')) + ' <span class="hinweis">' + esc(uebersetze(intern ? 'Intern ist nie abrechenbar' : an ? 'fließt in Arbeitswert und Rechnung' : 'zählt nur als Selbstkosten')) + '</span></button>');
  // Waehrend neu gerechnet wird, bleibt der alte Stand sichtbar (der Knopf ist trotzdem gesperrt).
  const v = zd.v || (zd.fehler ? null : zd.vAlt);
  const ov = v && v.sitzungen && v.sitzungen.length ? v.sitzungen : [];
  const regel = (s) => (s.regel === 'wahl' ? uebersetze('gewählt') + ': ' + uebersetze(ZWL[s.wahl]) : s.regel === 'meeting' ? uebersetze(v.kalender_uid ? 'Kalendertermin, Claude arbeitet nebenher' : 'Meeting, Claude arbeitet nebenher')
    : uebersetze({ eigene: 'Fokusarbeit am Gerät, nur einmal zählbar', gleiches_ziel: 'gleiches Ziel, sonst doppelt', anderes_ziel: 'Agent lief allein, anderes Ziel' }[s.regel] || s.regel));
  const ERG = { kulanz: ['Kulanz', 'bad'], meine: ['bei Claude abgezogen', 'warn'], abzug: ['abgezogen', 'bad'], parallel: ['parallel', 'ok'], beide: ['parallel', 'ok'] };
  const eff = zd.wahl || zEffWahl(ov);
  setze('ztd-ov', ov.length ? '<div class="zt-ov"><div class="zt-ov-kopf"><b>' + esc(uebersetze('Gleichzeitig lief Claude')) + '</b><span class="hinweis">' + esc(uebersetze('Regel aus Zeitmodell der Sitzung und Art der Tätigkeit')) + '</span></div>' +
    ov.map((s) => { const r = ERG[s.ergebnis] || [s.ergebnis, '']; return '<div class="zt-ov-s"><span>' + esc(uebersetze('Sitzung') + ' ' + zSitzName(s) + (zSitzLive(s.session_id) ? ' (live)' : '') + ' · ' + zModell(s.modell) + ' — ' + regel(s)) + '</span>' +
      '<span class="mono faint">' + zhm(s.von) + '–' + zhm(s.bis) + '</span><span class="mono ' + r[1] + '">' + s.min + ' Min ' + esc(uebersetze(r[0])) + '</span></div>'; }).join('') +
    '<div class="zt-ov-wahl"><div class="zt-ov-kopf"><span class="zt-ueber">' + esc(uebersetze('Abrechnen bei Überlappung')) + '</span><span class="hinweis">' +
      esc(uebersetze(zd.wahl ? ZWTXT[zd.wahl] : 'Noch keine Wahl — Regel aus Zeitmodell und Tätigkeit')) + '</span></div>' + zWahlKnoepfe('ztd-wahl', eff, g) + '</div></div>' : '');
  const brutto = v ? v.rohzeit_min + v.pause_min : null;
  const ovL = v && v.kulanz_min ? ['Kulanz', v.kulanz_min + ' Min', 'bad'] : v && v.parallel_min && !v.abzug_min ? ['Parallel', '+' + v.parallel_min + ' Min', 'ok'] : ['Abzug', (v ? v.abzug_min : 0) + ' Min', 'bad'];
  setze('ztd-sum', '<span>' + esc(uebersetze(zd.modus === 'zeit' ? 'Termin' : 'Feste Dauer')) + '<b class="mono">' + (v ? zdur(brutto) + ' h' : '–') + '</b></span>' +
    '<span>' + esc(uebersetze('Pause')) + '<b class="mono">' + (v ? v.pause_min + ' Min' : '–') + '</b></span>' +
    '<span>' + esc(uebersetze(ovL[0])) + '<b class="mono ' + (v ? ovL[2] : '') + '">' + (v ? ovL[1] : '–') + '</b></span>' +
    '<span>' + esc(uebersetze('Gezählt · auf') + ' ' + (v && v.rundung ? v.rundung : 5) + ' Min') + '<b class="mono gross">' + (v ? zdur(v.gezaehlt_min) + ' h' : '–') + '</b></span>' +
    '<span class="r">' + esc(uebersetze('Betrag')) + '<b class="mono gross akzent">' + (v ? (v.abrechenbar ? eur(v.eur) : '—') : '–') + '</b></span>');
  setze('ztd-fehler', g ? '' : esc(zd.fehler));
  const b = grund.querySelector('#ztd-buchen');
  if (b && !b.dataset.laeuft) b.disabled = !!zd.fehler || !zd.v;
}

// Anfrage an den Server aus dem Dialog; null + zd.fehler, wenn schon die Form nicht stimmt.
function zdNutzlast() {
  const fest = zd.modus === 'dauer';
  const s = zUhrzeit(zd.von), p = String(zd.pause).trim() === '' ? 0 : Number(zd.pause);
  // Bei fester Dauer zaehlt das Ende nicht; ueber Mitternacht liegt es am Folgetag.
  const e = fest ? s + 1 : zUhrzeit(zd.bis) + zd.plusTag * 1440;
  const du = fest ? zDauer(zd.dauer) : null;
  zd.fehler = !zd.ziel ? 'Ziel fehlt.' : Number.isNaN(s) || Number.isNaN(e) ? 'Termin-Uhrzeit im Format HH:MM.' : e <= s ? 'Ende liegt vor dem Beginn.'
    : fest && !(du > 0) ? 'Feste Dauer als 1:30 oder 1,5 angeben.' : !Number.isInteger(p) || p < 0 || (fest ? du : e - s) - p <= 0 ? 'Pause ist länger als die Zeit.' : '';
  zd.fehler = zd.fehler ? uebersetze(zd.fehler) : '';
  if (zd.fehler) return null;
  const n = {
    ziel_art: zd.ziel.art, ziel_schluessel: zd.ziel.schluessel, taetigkeit: zd.taetigkeit, notiz: zd.notiz, abrechenbar: zd.abr && zd.ziel.art !== 'intern',
    start: zIso(zd.tag, s), ende: zIso(zd.tag, e), pause_min: p, dauer_fest_min: fest ? du : null,
  };
  if (zd.id != null) n.id = zd.id;
  else if (zd.termin) n.termin = zd.termin;
  if (zd.wahl) n.wahlen = Object.fromEntries(zd.sitzIds.map((sid) => [sid, zd.wahl]));
  return n;
}

let zdTakt = null, zdLauf = 0;
// Jede Aenderung verwirft die alte Vorschau: "Buchen" bleibt gesperrt, bis die
// neue da ist — sonst ginge eine Wahl an einer neu ueberlappenden Sitzung vorbei.
function zdVorschauBald(ms = 250) {
  clearTimeout(zdTakt);
  if (zd && !zd.gesperrt && zd.v) { zd.vAlt = zd.v; zd.v = null; zdZeichnen(); }
  zdTakt = setTimeout(zdVorschau, ms);
}
async function zdVorschau() {
  if (!zd) return;
  // Gesperrt: nur lesen, die Werte stehen schon im Eintrag.
  if (zd.gesperrt) {
    const e = zAlleEintraege().find((x) => x.id === zd.id);
    if (e) zd.v = { ...e, sitzungen: [], rundung: zd.ziel && zd.ziel.rundung };
    zdZeichnen();
    return;
  }
  const n = zdNutzlast();
  if (!n) { zd.v = null; zdZeichnen(); return; }
  const lauf = ++zdLauf;
  try {
    const v = await sende('/api/zeit/vorschau', n);
    if (lauf !== zdLauf || !zd) return;
    zd.v = v;
    zd.fehler = '';
    const ids = v.sitzungen.map((s) => s.session_id);
    const neu = ids.some((x) => !zd.sitzIds.includes(x));
    zd.sitzIds = ids;
    // Eine neu ueberlappende Sitzung bekommt die schon getroffene Wahl auch.
    if (zd.wahl && neu) { zdVorschauBald(0); return; }
  } catch (e) {
    if (lauf !== zdLauf || !zd) return;
    zd.v = null;
    zd.fehler = e.message;
  }
  zdZeichnen();
}

aktion('ztd-tag', (t) => { if (!zd || zd.gesperrt) return; zd.tag = t; zdZeichnen(); zdVorschauBald(0); });
aktion('ztd-modus', (m) => {
  if (!zd || zd.gesperrt) return;
  if (m === 'dauer' && !zd.dauer) { const a = zUhrzeit(zd.von), b = zUhrzeit(zd.bis); if (b > a) zd.dauer = zdur(b - a); }
  zd.modus = m; zdZeichnen(); zdVorschauBald(0);
});
aktion('ztd-taet', (n) => { if (!zd || zd.gesperrt) return; zd.taetigkeit = n; zdZeichnen(); zdVorschauBald(0); });
aktion('ztd-abr', () => { if (!zd || zd.gesperrt || (zd.ziel && zd.ziel.art === 'intern')) return; zd.abr = !zd.abr; zdZeichnen(); zdVorschauBald(0); });
aktion('ztd-wahl', (w) => { if (!zd || zd.gesperrt) return; zd.wahl = w; zdVorschauBald(0); });
aktion('ztd-vorschlag', () => {
  if (!zd || zd.gesperrt || !zd.vorschlag) return;
  zd.ziel = zd.vorschlag; zd.abr = zd.ziel.art !== 'intern'; zdZeichnen(); zdVorschauBald(0);
});
// Nach dem await kann schon ein anderer Dialog offen sein: nur der eigene wird geschlossen.
const zdFertig = (d) => { if (zd === d) { zd = null; schliesseDialog(); } };
aktion('ztd-buchen', (_, el) => mitLauf(el, async () => {
  const d = zd;
  if (!d || !d.v) return;
  const n = zdNutzlast();
  if (!n) { zdZeichnen(); return; }
  try {
    const r = await sende('/api/zeit', n);
    zMerkeZuletzt(d.ziel);
    toast(uebersetze(d.id != null ? 'Geändert' : 'Gebucht') + ' · ' + zdur(r.eintrag.gezaehlt_min) + ' h ' + uebersetze('auf') + ' ' + d.ziel.l + (r.warnung ? ' · ' + r.warnung : ''), 'ok');
    zdFertig(d);
    zeitNachAenderung();
  } catch (e) {
    if (zd === d) { d.fehler = uebersetze('Nicht gespeichert') + ': ' + e.message; zdZeichnen(); }
    else toast(uebersetze('Nicht gespeichert') + ': ' + e.message, 'err');
  }
}));
aktion('ztd-loeschen', (_, el) => mitLauf(el, async () => {
  const d = zd;
  if (!d || d.id == null) return;
  try {
    await sende('/api/zeit-loeschen', { id: d.id });
    zdFertig(d);
    toast(uebersetze('Eintrag gelöscht'), 'ok');
    zeitNachAenderung();
  } catch (e) {
    if (zd === d) { d.fehler = e.message; zdZeichnen(); }
    else toast(e.message, 'err');
  }
}));

/* ---------- Ziel-Auswahl ---------- */
let zp = null;
function zeitPicker(fuer) {
  if (fuer === 'timer' && route().name !== 'zeit') geheZu('zeit');
  zpZu();
  zp = { fuer, q: '', vf: 'offen', offen: { vorgang: true, projekt: true, kunde: false, intern: false }, daten: zt.d.ziele || null, lauf: 0, erster: null, fehler: null };
  const grund = document.createElement('div');
  grund.className = 'dialog-grund zt-picker-grund'; grund.id = 'zt-picker';
  grund.innerHTML = '<div class="dialog formular zt-picker" role="dialog" aria-modal="true" aria-label="' + esc(uebersetze('Buchen auf …')) + '">' +
    '<div class="dialog-kopf"><div class="zp-kopf"><h2>' + esc(uebersetze('Buchen auf …')) + '</h2><span class="hinweis" id="zp-hinweis"></span></div>' +
      '<button type="button" class="mini-knopf" data-aktion="zp-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<input id="zp-q" class="zt-eingabe gross" autocomplete="off" spellcheck="false" placeholder="' + esc(uebersetze('Nummer, Titel, Projekt oder Kunde — z. B. NW-12 oder Kundenportal')) + '" aria-label="' + esc(uebersetze('Buchen auf …')) + '">' +
    '<div id="zp-liste" class="zp-liste"></div>' +
    '<span class="hinweis">' + esc(uebersetze('Enter wählt den ersten Treffer · Esc schließt')) + '</span></div>';
  document.body.appendChild(grund);
  grund.addEventListener('mousedown', (e) => { if (e.target === grund) zpZu(); });
  grund.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zpZu(); } });
  const inp = grund.querySelector('#zp-q');
  let takt = null;
  inp.addEventListener('input', () => { zp.q = inp.value; clearTimeout(takt); takt = setTimeout(zpLaden, 150); });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (zp.erster) zpWaehle(zp.erster); } });
  inp.focus();
  if (!zp.daten) zpLaden(); else zpZeichnen();
}
async function zpLaden() {
  if (!zp) return;
  const lauf = ++zp.lauf;
  const q = zp.q.trim();
  try {
    const d = await hole('/api/zeit/ziele?' + abfrage({ q }));
    // Ungefiltert gilt die Liste fuer die ganze Seite; gefiltert nur fuer diese Suche.
    if (!q) zt.d.ziele = d;
    if (!zp || lauf !== zp.lauf || q !== zp.q.trim()) return;
    zp.daten = d;
    zp.fehler = null;
  } catch (e) { if (zp && lauf === zp.lauf) zp.fehler = e.message; }
  zpZeichnen();
}
function zpZeichnen() {
  const el = document.getElementById('zp-liste');
  if (!el || !zp) return;
  const alle = zZiele(zp.daten);
  const aktuell = zp.fuer === 'timer' ? zt.form.ziel : zp.fuer === 'termin' ? zk && zk.ziel : zd && zd.ziel;
  const q = zp.q.trim();
  const SEK = [['vorgang', 'Vorgänge'], ['projekt', 'Projekte'], ['kunde', 'Kunden'], ['intern', 'Intern']];
  zp.erster = null;
  let html = '';
  const zuletzt = zZuletzt();
  if (!q && zuletzt.length) {
    html += '<div class="zt-chips"><span class="hinweis">' + esc(uebersetze('Zuletzt')) + '</span>' + zuletzt.map((z, i) =>
      '<button type="button" class="chip" data-aktion="zp-zuletzt" data-wert="' + i + '" aria-pressed="' + zGleich(z, aktuell) + '" title="' + esc(z.t || '') + '"><b class="mono">' + esc(z.l) + '</b></button>').join('') + '</div>';
  }
  let treffer = 0;
  for (const [art, titel] of SEK) {
    const gesamt = alle.filter((z) => z.art === art);
    let it = gesamt;
    if (art === 'vorgang' && zp.vf === 'offen') it = it.filter((z) => !istAbgerechnet(z.schluessel));
    treffer += it.length;
    if (!zp.erster && it.length) zp.erster = it[0];
    const offen = q ? it.length > 0 : zp.offen[art];
    html += '<div class="zp-sek"><div class="zp-sek-kopf"><button type="button" data-aktion="zp-sek" data-wert="' + art + '" aria-expanded="' + offen + '">' +
        '<span class="mono faint">' + (offen ? '▾' : '▸') + '</span>' + esc(uebersetze(titel)) + '<span class="mono faint">' + (it.length === gesamt.length ? gesamt.length : it.length + ' ' + uebersetze('von') + ' ' + gesamt.length) + '</span></button>' +
        (art === 'vorgang' ? segment('zp-vf', [['offen', 'Offene'], ['alle', 'Alle']], zp.vf, 'Vorgänge') : '') + '</div>' +
      (offen ? '<div class="zp-zeilen">' + it.map((z) => {
        const i = alle.indexOf(z);
        return '<button type="button" class="zp-zeile' + (zGleich(z, aktuell) ? ' an' : '') + '" data-aktion="zp-waehle" data-wert="' + i + '">' +
          '<b class="mono">' + esc(z.l) + '</b><span>' + esc(uebersetze(z.t)) + '</span>' +
          '<span class="hinweis">' + esc(z.art === 'intern' ? uebersetze('Nicht abrechenbar') : z.satz != null ? nf2.format(z.satz) + ' EUR/h' : '') + '</span>' +
          (z.art === 'vorgang' ? pille(istAbgerechnet(z.schluessel) ? 'abgerechnet' : 'offen') : '<span></span>') + '</button>';
      }).join('') + (it.length ? '' : '<div class="hinweis zp-leer">' + esc(uebersetze('Keine Treffer in diesem Bereich.')) + '</div>') + '</div>' : '') + '</div>';
  }
  if (q && !treffer) html = '<div class="zp-nichts">' + esc(uebersetze('Kein Treffer. Neue Vorgänge entstehen automatisch, sobald Claude darauf bucht — oder über Einstellungen → Projekte.')) + '</div>';
  if (zp.fehler) html = '<div class="dialog-fehler">' + esc(zp.fehler) + '</div>' + html;
  el.innerHTML = html;
  const h = document.getElementById('zp-hinweis');
  if (h) h.textContent = q && zp.erster ? 'Enter → ' + zp.erster.l : alle.length + ' ' + uebersetze('Ziele');
}
function zpZu() {
  const el = document.getElementById('zt-picker');
  if (el) el.remove();
  zp = null;
}
function zpWaehle(z) {
  const fuer = zp && zp.fuer;
  zpZu();
  zMerkeZuletzt(z);
  if (fuer === 'timer') {
    zt.form.ziel = z;
    merke('zeit.timer', zt.form);
    zeichneAnsicht();
  } else if (fuer === 'termin') {
    if (zk) zkZielGewaehlt(z);
  } else if (zd) {
    zd.ziel = z;
    zd.abr = z.art !== 'intern';
    zdZeichnen();
    zdVorschauBald(0);
    const b = document.querySelector('#dialog .zt-ziel');
    if (b) b.focus();
  }
}
aktion('zp-zu', () => zpZu());
aktion('zp-sek', (art) => { if (!zp || !Object.hasOwn(zp.offen, art)) return; zp.offen[art] = !zp.offen[art]; zpZeichnen(); });
aktion('zp-vf', (v) => { if (!zp) return; zp.vf = v; zpZeichnen(); });
aktion('zp-waehle', (i) => { if (!zp) return; const z = zZiele(zp.daten)[Number(i)]; if (z) zpWaehle(z); });
aktion('zp-zuletzt', (i) => {
  if (!zp) return;
  const x = zZuletzt()[Number(i)];
  if (x) zpWaehle(zZiele(zt.d.ziele).find((z) => zGleich(z, x)) || x);
});

/* ---------- Termine: Leiste, Buchen, Termin-Dialog (Z7a) ---------- */
const zSyncText = (a) => (a.ok === false ? uebersetze('Abgleich fehlgeschlagen')
  : a.at ? uebersetze('Sync vor') + ' ' + Math.max(0, Math.round((Date.now() - Date.parse(a.at)) / 60000)) + ' ' + uebersetze('Min')
    : uebersetze('noch nie abgeglichen'));

// Kopf der Ansicht: „+ Termin / Blocker“, Kalenderstatus (oder „+ Kalender verbinden“), Schalter Termine.
function zKalenderLeiste() {
  const k = zt.d.kal || {};
  const konten = k.konten || [];
  let status;
  if (k.fehlerLaden) status = '<button type="button" class="zt-kal bad" data-aktion="zt-kal" title="' + esc(k.fehlerLaden) + '"><span class="zt-kal-punkt"></span>' + esc(uebersetze('Kalender nicht geladen')) + '</button>';
  else if (!konten.length && !(k.fehler || []).length && !(k.verwaist || []).length) {
    status = '<button type="button" class="knopf geist klein" data-aktion="zt-kal">' + esc(uebersetze('+ Kalender verbinden')) + '</button>';
  } else {
    const kaputt = konten.some((x) => x.ok === false) || (k.fehler || []).length > 0;
    const a = konten[0];
    status = '<button type="button" class="zt-kal' + (kaputt ? ' bad' : '') + '" data-aktion="zt-kal"><span class="zt-kal-punkt"></span>' +
      esc(a ? a.name + (konten.length > 1 ? ' +' + (konten.length - 1) : '') + ' · ' + zSyncText(a)
        : uebersetze((k.fehler || []).length ? 'Fehler in config.json' : 'Konto nicht mehr in config.json')) + '</button>';
  }
  return '<span class="zt-kal-leiste"><button type="button" class="knopf akzent-rand klein" data-aktion="zt-termin-neu">' + esc(uebersetze('+ Termin / Blocker')) + '</button>' + status +
    '<button type="button" class="kippschalter" role="switch" data-aktion="zt-termine-an" aria-checked="' + zt.termineAn + '"><span class="spur"></span>' + esc(uebersetze('Termine')) + '</button></span>';
}

function zTerminVon(el) {
  const t = zTerminFinde(el.dataset.kal, el.dataset.uid);
  if (!t) { toast(uebersetze('Termin nicht gefunden — Woche wird neu geladen.'), 'err'); zeitLaden(); }
  return t || null;
}
// Termin buchen: Nachtrag mit Zeit und Titel. Ein von Hand gesetztes Ziel gilt,
// ein geratenes ist nur ein Vorschlag. Laeuft der Termin noch, endet der
// Nachtrag jetzt — gebucht wird nur, was schon war.
function zeitAusTermin(t) {
  // Volle Minute statt 5-Min-Raster: ein Termin, der eben erst begann, gaebe sonst Ende vor Beginn.
  const ende = Math.min(Date.parse(t.ende), Math.floor(Date.now() / 60000) * 60000);
  zeitNachtrag({ tag: zTag(t.start), von: zhm(t.start), bis: zhm(ende), plusTag: zTag(ende) !== zTag(t.start) ? 1 : 0,
    termin: t, ziel: t.ziel_von_hand ? zTerminZiel(t) : null, vorschlag: t.ziel_von_hand ? null : zTerminZiel(t) });
}
aktion('zt-termin', (_, el) => { const t = zTerminVon(el); if (t) { if (zBuchbar(t)) zeitAusTermin(t); else zTerminDialog({ termin: t }); } });
aktion('zt-termin-dlg', (_, el) => { const t = zTerminVon(el); if (t) zTerminDialog({ termin: t }); });
aktion('zt-termin-buchen', (_, el) => { const t = zTerminVon(el); if (t) zeitAusTermin(t); });
aktion('zt-termin-neu', () => zTerminDialog({ neu: { art: 'meeting' } }));
aktion('zt-termine-an', () => { zt.termineAn = !zt.termineAn; merke('zeit.termine', zt.termineAn ? '1' : '0'); zeichneAnsicht(); });
aktion('zt-kal', () => zKalenderDialog());

let zk = null;
// opts: { termin } zum Ansehen/Aendern, sonst { neu: { art, tag, von, bis, ziel } }.
// Kalendertermine sind nur lesbar; aenderbar ist ihr Ziel (/api/termin-ziel).
function zTerminDialog(opts = {}) {
  if (route().name !== 'zeit') geheZu('zeit');
  zd = null;
  const t = opts.termin || null;
  const n = opts.neu || {};
  const jetzt = new Date();
  // Naechste halbe Stunde plus 30 Min, fruehestens 08:00; spaet am Abend morgen 08:00.
  const s1 = Math.max(8 * 60, Math.ceil(zMinute(jetzt) / 30) * 30 + 30);
  const morgen = s1 > 22 * 60;
  const s0 = morgen ? 8 * 60 : s1;
  zk = t ? {
    kid: t.kalender_id, uid: t.uid, lokal: t.quelle === 'lokal', art: t.art === 'blocker' ? 'blocker' : 'meeting', tag: zTag(t.start),
    von: zhm(t.start), bis: zhm(t.ende), startAlt: t.start, titel: t.titel, titelSet: true,
    ziel: t.ziel_von_hand ? zTerminZiel(t) : null, vorschlag: t.ziel_von_hand ? null : zTerminZiel(t), erinnern: t.erinnern !== 0,
    googleOffen: t.google_offen || null, googleFehlt: !!t.google_fehlt,
  } : {
    kid: 'lokal', uid: null, lokal: true, art: n.art === 'blocker' ? 'blocker' : 'meeting', tag: n.tag || isoTag(morgen ? plusTage(jetzt, 1) : jetzt), von: n.von || zHM(s0),
    bis: n.bis || zHM(s0 + 60), startAlt: null, titel: '', titelSet: false, ziel: n.ziel || null, vorschlag: null, erinnern: true,
  };
  Object.assign(zk, { gaeste: new Set(), extra: '', ap: null, apFehler: null, serverFehler: '' });
  const ro = zk.lokal ? '' : ' disabled';
  const feld = (id, l, wert, ph) => '<label class="feld"><span class="label">' + esc(uebersetze(l)) + '</span><input id="' + id + '" class="mono" value="' + esc(wert) + '" placeholder="' + esc(ph) + '"' + ro + ' autocomplete="off"></label>';
  dialog('<div class="dialog-kopf"><div><h2 id="zk-kopf"></h2>' +
      (zk.lokal ? '' : '<span class="hinweis">' + esc(uebersetze('Kalendertermine werden nur gelesen — änderbar ist das Ziel.')) + '</span>') + '</div>' +
      '<div id="zk-art"></div><button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    // Chips fuer die naechsten Tage, das Datumsfeld fuer jeden spaeteren (geplant wird ab heute).
    '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Tag')) + '</span><div class="zt-tagwahl"><div id="zk-tag"></div>' +
      (zk.lokal ? '<input type="date" id="zk-datum" class="zt-eingabe zt-datum mono" min="' + isoTag(new Date()) + '" aria-label="' + esc(uebersetze('Anderer Tag')) + '">' : '') + '</div></div>' +
    '<div class="zt-drei">' + feld('zk-von', 'Beginn', zk.von, '09:00') + feld('zk-bis', 'Ende', zk.bis, '10:00') +
      '<div class="feld"><span class="label">' + esc(uebersetze('Dauer')) + '</span><b class="mono zk-dauer" id="zk-dauer"></b></div></div>' +
    '<label class="feld"><span class="label">' + esc(uebersetze('Titel')) + '</span><input id="zk-titel" class="zt-eingabe" maxlength="200"' + ro + ' autocomplete="off"></label>' +
    '<div class="zt-dfeld"><span class="zt-ueber" id="zk-ziel-l"></span><div id="zk-ziel" class="zt-feld"></div></div>' +
    '<div id="zk-mehr" class="zt-dfeld"></div><div id="zk-warn"></div>' +
    (zk.lokal ? '<span class="hinweis">' + esc(uebersetze('Legt den Termin hier an und öffnet Googles Formular vorbefüllt — dort speichern, Google verschickt die Einladungen. Änderungen danach in beiden Kalendern von Hand.')) + '</span>' : '') +
    '<span class="dialog-fehler" id="zk-fehler" role="alert"></span>' +
    '<div class="dialog-fuss">' + (zk.lokal && zk.uid ? '<button type="button" class="knopf zt-loeschen" data-aktion="zk-loeschen">' + esc(uebersetze('Löschen')) + '</button>' : '') +
      '<button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
      // Ein echter Link statt eines vorab geoeffneten Fensters: Popup-Blocker und Erweiterungen sperren leere
      // Fenster, die erst nach dem Speichern umgeleitet werden, einen Link-Klick nie.
      (zk.lokal ? '<a class="knopf zk-google" id="zk-google" target="_blank" rel="noopener noreferrer">' + esc(uebersetze('In Google Kalender öffnen')) + '</a>' : '') +
      '<button type="button" class="knopf primaer" id="zk-speichern" data-aktion="zk-speichern"></button></div>',
  'Termin', 580);
  const grund = document.getElementById('dialog');
  grund.querySelector('#zk-titel').value = zkTitel();
  grund.addEventListener('input', (ev) => {
    if (!zk) return;
    const id = ev.target.id;
    if (id === 'zk-von' || id === 'zk-bis') zk[id.slice(3)] = ev.target.value;
    else if (id === 'zk-datum') { if (!zk.lokal || !/^\d{4}-\d{2}-\d{2}$/.test(ev.target.value)) return; zk.tag = ev.target.value; }
    else if (id === 'zk-titel') { zk.titel = ev.target.value; zk.titelSet = true; }
    else if (id === 'zk-extra') zk.extra = ev.target.value;
    else return;
    zk.serverFehler = '';
    zkZeichnen();
  });
  grund.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); const b = grund.querySelector('#zk-speichern'); if (b) b.click(); } });
  // Google-Link: den Tab oeffnet der Browser selbst, hier wird nur gespeichert.
  grund.addEventListener('click', (ev) => {
    const g = ev.target.closest('.zk-google');
    if (!g) return;
    if (!zk || zkFehler() || g.dataset.laeuft) { ev.preventDefault(); if (zk) zkZeichnen(); return; }
    zkSpeichern(g, 'google');
  });
  zkZeichnen();
  if (zk.lokal) zkLadeAp();
}

// Ohne eigenen Titel: aus dem Ziel (Mockup „Abstimmung …“ / „Fokus …“).
function zkTitel() {
  if (zk.titelSet) return zk.titel;
  const z = zk.ziel;
  if (!z) return '';
  return zk.art === 'meeting' ? uebersetze('Abstimmung') + ' ' + z.l : uebersetze('Fokus') + ' ' + z.l + (z.art === 'vorgang' && z.t ? ' · ' + z.t : '');
}
const zkKontakt = () => (zk && zk.ziel ? zKontaktVon({ ziel_art: zk.ziel.art, ziel_schluessel: zk.ziel.schluessel, projekt: zk.ziel.projekt }) : null);
// Gaeste nur fuer den Google-Link: c2invoice speichert und verschickt keine Einladung (2.0).
const zkGaeste = () => (zk.art !== 'meeting' ? [] : [...new Set([...zk.gaeste, ...zk.extra.split(/[,;\s]+/).filter(Boolean)])]);
function zkZeiten() {
  // Ende vor Beginn heisst Folgetag (Termin ueber Mitternacht); die Dauer zeigt es an.
  const s = zUhrzeit(zk.von), b = zUhrzeit(zk.bis), e = b < s ? b + 1440 : b;
  return Number.isNaN(s) || Number.isNaN(e) ? null : { s, e, start: zIso(zk.tag, s), ende: zIso(zk.tag, e) };
}
function zkFehler() {
  if (!zk.lokal) return '';
  const z = zkZeiten();
  if (!z) return uebersetze('Uhrzeit im Format HH:MM.');
  if (z.e <= z.s) return uebersetze('Ende liegt vor dem Beginn.');
  if (Date.parse(z.start) < Date.now() && z.start !== zk.startAlt) return uebersetze('Beginn liegt in der Vergangenheit — dafür „Zeit nachtragen“ nutzen.');
  if (!zkTitel().trim()) return uebersetze('Titel fehlt.');
  const bad = zkGaeste().find((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  return bad ? uebersetze('Ungültige E-Mail') + ': ' + bad : '';
}

async function zkLadeAp() {
  const d = zk;
  if (!d) return;
  const kid = zkKontakt();
  d.ap = null; d.apFehler = null; d.gaeste = new Set();
  if (!kid) { d.ap = []; zkZeichnen(); return; }
  zkZeichnen();
  try {
    const r = await hole('/api/ansprechpartner?' + abfrage({ kontakt: kid }));
    if (zk !== d || zkKontakt() !== kid) return;
    d.ap = r.ansprechpartner || [];
    for (const p of d.ap) if (p.email) d.gaeste.add(p.email);   // vorausgewaehlt (Mockup)
  } catch (e) {
    if (zk !== d) return;
    if (zkKontakt() !== kid) return;
    d.ap = []; d.apFehler = e.message;
  }
  zkZeichnen();
}

// Die wechselnden Teile neu; Eingabefelder bleiben (Fokus, Cursor).
function zkZeichnen() {
  const grund = document.getElementById('dialog');
  if (!grund || !zk || !grund.querySelector('#zk-art')) return;
  const setze = (id, html) => { const el = grund.querySelector('#' + id); if (el) el.innerHTML = html; };
  const ro = !zk.lokal, neu = zk.uid == null;
  grund.querySelector('#zk-kopf').textContent = uebersetze(ro ? 'Kalendertermin' : !neu ? 'Termin bearbeiten' : zk.art === 'meeting' ? 'Meeting planen' : 'Blocker anlegen');
  setze('zk-art', ro ? '<span class="pille">' + esc(uebersetze(ZTA[zk.art])) + '</span>' : segment('zk-art', [['meeting', 'Meeting'], ['blocker', 'Blocker']], zk.art, 'Art'));
  // Heute und die naechsten sechs Tage; ein Termin an einem anderen Tag behaelt seinen.
  const heute = isoTag(new Date());
  const tage = Array.from({ length: 7 }, (_, i) => isoTag(plusTage(ausIso(heute), i)));
  if (!tage.includes(zk.tag)) tage.unshift(zk.tag);
  setze('zk-tag', ro ? '<span class="mono">' + esc(datum(zk.tag)) + '</span>' : '<div class="zt-chips">' + tage.map((x) =>
    '<button type="button" class="chip" data-aktion="zk-tag" data-wert="' + x + '" aria-pressed="' + (x === zk.tag) + '">' + esc(zWt(x) + ' ' + datumKurz(x)) + '</button>').join('') + '</div>');
  const dat = grund.querySelector('#zk-datum');
  if (dat && dat.value !== zk.tag) dat.value = zk.tag;
  const z = zkZeiten();
  setze('zk-dauer', z && z.e > z.s ? esc(zdur(z.e - z.s)) + ' h' : '–');
  const ti = grund.querySelector('#zk-titel');
  if (ti && !zk.titelSet && document.activeElement !== ti) ti.value = zkTitel();
  setze('zk-ziel-l', esc(uebersetze(zk.art === 'meeting' ? 'Kunde / Projekt' : 'Reservieren für')));
  setze('zk-ziel', zZielKnopf(zk.ziel, 'termin', false) + (!zk.ziel && zk.vorschlag ? '<button type="button" class="chip zt-vorschlag" data-aktion="zk-vorschlag">' +
    esc(uebersetze('Vorschlag aus dem Titel') + ': ' + zk.vorschlag.l + ' — ' + uebersetze('übernehmen')) + '</button>' : ''));
  // Teilnehmer bzw. Erinnern nur neu, wenn sich ihr Stand aendert — sonst verloere das E-Mail-Feld den Fokus.
  const mehr = grund.querySelector('#zk-mehr');
  const kid = zkKontakt();
  const schl = ro ? 'leer' : zk.art === 'blocker' ? 'b|' + zk.erinnern : 'm|' + kid + '|' + (zk.ap ? zk.ap.length : '-') + '|' + (zk.apFehler || '') + '|' + [...zk.gaeste].join(',');
  if (mehr && mehr.dataset.s !== schl) {
    mehr.dataset.s = schl;
    if (schl === 'leer') mehr.innerHTML = '';
    else if (zk.art === 'blocker') {
      mehr.innerHTML = '<span class="hinweis">' + esc(uebersetze('Reservierte Arbeitszeit für einen Vorgang. Zählt in den Workload.')) + '</span>' +
        '<button type="button" class="kippschalter" role="switch" data-aktion="zk-erinnern" aria-checked="' + zk.erinnern + '"><span class="spur"></span>' +
        esc(uebersetze('Bei Beginn erinnern und prüfen')) + ' <span class="hinweis">' + esc(uebersetze('tippst du in Claude → läuft über Claude · Claude allein → „Begleiten“ · keine Sitzung → „Manuell“')) + '</span></button>';
    } else {
      const ap = zk.ap || [];
      mehr.innerHTML = '<span class="zt-ueber">' + esc(uebersetze('Teilnehmer')) + '</span>' +
        (ap.length ? '<div class="zt-chips">' + ap.map((p, i) => '<button type="button" class="chip" data-aktion="zk-gast" data-wert="' + i + '" aria-pressed="' + zk.gaeste.has(p.email) + '"' +
            (p.email ? ' title="' + esc(p.email) + '"' : ' disabled') + '>' + esc(p.name + (p.rolle ? ' · ' + p.rolle : '') + (p.email ? '' : ' · ' + uebersetze('ohne E-Mail'))) + '</button>').join('') + '</div>'
          : zk.apFehler ? '<span class="hinweis bad">' + esc(zk.apFehler) + '</span>'
            : kid && !zk.ap ? '<span class="hinweis">' + esc(uebersetze('Lädt …')) + '</span>'
              : '<span class="hinweis">' + esc(uebersetze('Am Ziel hängt kein Kunde — Teilnehmer per E-Mail eintragen.')) + '</span>') +
        '<input id="zk-extra" class="zt-eingabe" maxlength="500" value="' + esc(zk.extra) + '" placeholder="' + esc(uebersetze('Weitere E-Mails, mit Komma getrennt')) +
          '" aria-label="' + esc(uebersetze('Weitere E-Mails, mit Komma getrennt')) + '" autocomplete="off">' +
        '<span class="hinweis">' + esc(uebersetze('Einladungen verschickt c2invoice erst mit dem E-Mail-Versand — bis dahin über „In Google Kalender öffnen“.')) + '</span>';
    }
  }
  // Ueberschneidung mit bekannten Terminen der geladenen Wochen (nur Hinweis, kein Hindernis).
  let warn = '';
  if (z && z.e > z.s) {
    const a = Date.parse(z.start), b = Date.parse(z.ende);
    const alle = new Map([...zTermine(zt.d.woche), ...zTermine(zt.d.hw)].map((x) => [x.kalender_id + '\n' + x.uid, x]));
    warn = [...alle.values()].filter((x) => !(x.kalender_id === zk.kid && x.uid === zk.uid) && Date.parse(x.start) < b && Date.parse(x.ende) > a)
      .map((x) => '<div class="hinweis warn">' + esc(uebersetze('Überschneidet sich mit') + ' ' + uebersetze(ZTA[x.art]) + ' „' + x.titel + '“ ' + zhm(x.start) + '–' + zhm(x.ende)) + '</div>').join('');
  }
  // An Google uebergeben, aber noch nicht zurueck: der Abgleich fuehrt zusammen (kalender.fuehreZusammen).
  if (zk.lokal && zk.googleOffen) {
    warn = (zk.googleFehlt
      ? '<div class="zk-google-status bad"><span>' + esc(uebersetze('In Google nicht gefunden — am') + ' ' + datumKurz(zTag(zk.googleOffen)) + ' ' + uebersetze('an Googles Formular übergeben, der Abgleich hat ihn seitdem nicht gebracht. Vielleicht dort nicht gespeichert.')) + '</span>' +
        '<span class="zk-google-knoepfe"><button type="button" class="knopf klein" data-aktion="zk-google-behalten">' + esc(uebersetze('Behalten')) + '</button>' +
        '<a class="knopf klein zk-google" target="_blank" rel="noopener noreferrer">' + esc(uebersetze('Erneut öffnen')) + ' ↗</a>' +
        '<button type="button" class="knopf klein zt-loeschen" data-aktion="zk-loeschen">' + esc(uebersetze('Löschen')) + '</button></span></div>'
      : '<div class="hinweis">' + esc(uebersetze('Wartet auf Google — kommt der Termin über den Abgleich zurück, wird er zusammengeführt.')) + '</div>') + warn;
  }
  setze('zk-warn', warn);
  const f = zkFehler();
  setze('zk-fehler', esc(f || zk.serverFehler));
  const b = grund.querySelector('#zk-speichern');
  if (b && !b.dataset.laeuft) {
    b.textContent = uebersetze(ro ? 'Ziel speichern' : !neu ? 'Speichern' : zk.art === 'meeting' ? 'Meeting anlegen' : 'Blocker anlegen');
    b.disabled = !!f;
  }
  // Die Adresse folgt jeder Eingabe, damit der Klick sie schon kennt.
  for (const g of grund.querySelectorAll('.zk-google')) {
    if (f) g.removeAttribute('href');
    else g.href = zkGoogleUrl();
    g.setAttribute('aria-disabled', String(!!f));
  }
}
function zkGoogleUrl() {
  const z = zkZeiten();
  return googleVorlageUrl({ titel: zkTitel().trim(), start: z.start, ende: z.ende, details: (zk.ziel ? zk.ziel.l + ' · ' : '') + 'c2invoice', gaeste: zkGaeste() });
}

// Nach einem await: nur den eigenen Dialog schliessen — er kann schon zu sein und ein anderer offen.
function zkFertig(d) {
  if (zk !== d) return;
  zk = null;
  if (document.querySelector('#dialog #zk-art')) schliesseDialog();
}

function zkZielGewaehlt(z) {
  zk.ziel = z;
  zk.vorschlag = null;
  zkZeichnen();
  if (zk.lokal) zkLadeAp();
  const b = document.querySelector('#dialog .zt-ziel');
  if (b) b.focus();
}

// modus: 'google' (an Googles Formular, wartet auf den Abgleich), 'behalten' (Markierung weg) oder leer.
async function zkSpeichern(knopf, modus) {
  const google = modus === 'google';
  const d = zk;
  if (!d || zkFehler()) { zkZeichnen(); return; }
  const z = zkZeiten();
  const titel = zkTitel().trim();
  const ziel = { ziel_art: d.ziel ? d.ziel.art : null, ziel_schluessel: d.ziel ? String(d.ziel.schluessel) : null };
  // Blocker mit Erinnerung: jetzt, im Klick, einmal nach Desktop-Hinweisen fragen —
  // sonst kommt die Erinnerung im Hintergrund-Tab nur als Toast, den niemand sieht.
  if (d.lokal && d.art === 'blocker' && d.erinnern && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    // Aeltere Safari liefern kein Promise: ein Fehler hier darf das Speichern nie verhindern.
    try { Promise.resolve(Notification.requestPermission()).catch((e) => console.error('Desktop-Hinweise:', e.message)); } catch (e) { console.error('Desktop-Hinweise:', e.message); }
  }
  await mitLauf(knopf, async () => {
    try {
      if (d.lokal) await sende('/api/termin', { uid: d.uid || undefined, titel, art: d.art, start: z.start, ende: z.ende, erinnern: d.erinnern, ...ziel,
        google: google ? true : modus === 'behalten' ? false : undefined });
      else await sende('/api/termin-ziel', { kalender_id: d.kid, uid: d.uid, ...ziel });
    } catch (e) {
      // Der Google-Tab ist dann schon offen (Link): sagen, dass hier nichts gespeichert ist.
      const t = uebersetze('Nicht gespeichert') + ': ' + e.message + (google ? ' — ' + uebersetze('im Google-Tab nicht speichern, erst hier korrigieren.') : '');
      if (zk === d) { d.serverFehler = t; zkZeichnen(); } else toast(t, 'err');
      return;
    }
    zkFertig(d);
    toast(uebersetze(!d.lokal ? 'Ziel gespeichert' : d.uid ? 'Termin gespeichert' : 'Termin angelegt') + ' · ' + titel + (google ? ' · ' + uebersetze('Google-Formular im neuen Tab') : ''), 'ok');
    zeitNachAenderung();
  });
}
aktion('zk-speichern', (_, el) => zkSpeichern(el));
aktion('zk-google-behalten', (_, el) => zkSpeichern(el, 'behalten'));
aktion('zk-art', (v) => { if (!zk || !zk.lokal || (v !== 'meeting' && v !== 'blocker')) return; zk.art = v; zkZeichnen(); });
aktion('zk-tag', (v) => { if (!zk || !zk.lokal) return; zk.tag = v; zk.serverFehler = ''; zkZeichnen(); });
aktion('zk-erinnern', () => { if (!zk || !zk.lokal) return; zk.erinnern = !zk.erinnern; zkZeichnen(); });
aktion('zk-vorschlag', () => { if (zk && zk.vorschlag) zkZielGewaehlt(zk.vorschlag); });
aktion('zk-gast', (i) => {
  const p = zk && zk.ap && zk.ap[Number(i)];
  if (!p || !p.email) return;
  if (zk.gaeste.has(p.email)) zk.gaeste.delete(p.email); else zk.gaeste.add(p.email);
  zkZeichnen();
});
aktion('zk-loeschen', (_, el) => mitLauf(el, async () => {
  const d = zk;
  if (!d || !d.lokal || !d.uid) return;
  try {
    await sende('/api/termin-loeschen', { kalender_id: 'lokal', uid: d.uid });
    zkFertig(d);
    toast(uebersetze('Termin gelöscht') + ' · ' + d.titel, 'ok');
    zeitNachAenderung();
  } catch (e) {
    if (zk === d) { d.serverFehler = e.message; zkZeichnen(); } else toast(e.message, 'err');
  }
}));

/* ---------- Kalender-Dialog (B2.9) und Einstellungen → Kalender ----------
   ICS-Abo-Adresse per Eingabezeile (Owner-Entscheidung 12.10.2026, Ausnahme von
   "Zugaenge nur in der Datei"); CalDAV mit Passwort bleibt in config.json.
   Zeigt vollstaendig, was /api/kalender meldet: Status je Konto, Fehler in der
   Konfiguration und verwaiste Termine. */
// CalDAV braucht ein Passwort und bleibt deshalb in config.json (Projektregel).
const ZKAL_BEISPIEL = '"kalender": [\n' +
  '  { "id": "nextcloud", "name": "Nextcloud", "art": "caldav", "url": "https://…/remote.php/dav/calendars/…/",\n' +
  '    "benutzer": "…", "passwortEnvVar": "NEXTCLOUD_PASSWORT" }\n]';
// Eingabe der Abo-Adresse: ueberlebt ein Neuzeichnen (Laden, Abgleich), geht nach dem Verbinden weg.
const zKalForm = { url: '', name: '', fehler: '' };
let zKalTrennen = null;
function zKalenderDialog() {
  zd = null; zk = null;
  dialog('<div class="dialog-kopf"><div><h2>' + esc(uebersetze('Kalender verbinden')) + '</h2></div>' +
      '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>' +
    '<span class="hinweis">' + esc(uebersetze('Termine erscheinen in Woche und Heute als Vorschlag. Gebucht wird nie automatisch — ein Klick übernimmt Zeit, Titel und vermutetes Ziel.')) + '</span>' +
    '<div id="zkal" class="zkal"></div>', 'Kalender verbinden', 640);
  zKalLaden();
}
// Auch fuer Einstellungen → Kalender: zeichnet jede .zkal-Flaeche, die gerade da ist.
function zKalLaden() {
  zKalZeichnen();
  hole('/api/kalender').then((k) => { zt.d.kal = k; zKalZeichnen(); }, (e) => { zt.d.kal = { fehlerLaden: e.message }; zKalZeichnen(); });
}
function zKalZeichnen() {
  const flaechen = document.querySelectorAll('.zkal');
  if (!flaechen.length) return;
  const k = zt.d.kal || {};
  const konten = k.konten || [];
  const wann = (iso) => (iso ? datumKurz(zTag(iso)) + ' ' + zhm(iso) : '–');
  let html = k.fehlerLaden ? '<div class="dialog-fehler">' + esc(uebersetze('Kalender nicht geladen') + ': ' + k.fehlerLaden) + '</div>' : '';
  html += '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Verbindungen')) + '</span>' + (konten.length ? konten.map((a) =>
    '<div class="zkal-konto' + (a.ok === false ? ' bad' : '') + '"><div class="zkal-z"><span class="zt-kal-punkt"></span><b>' + esc(a.name) + '</b>' +
      '<span class="faint mono">' + esc(String(a.art).toUpperCase() + ' · ' + a.host) + '</span><span class="zt-rechts">' + esc(zSyncText(a)) + '</span>' +
      '<button type="button" class="textknopf' + (zKalTrennen === a.id ? ' bad' : '') + '" data-aktion="zkal-trennen" data-wert="' + esc(a.id) + '">' +
        esc(uebersetze(zKalTrennen === a.id ? 'Wirklich entfernen?' : 'Entfernen')) + '</button></div>' +
      '<span class="hinweis">' + esc([a.anzahl + ' ' + uebersetze('Termine'), uebersetze('zuletzt erfolgreich') + ' ' + wann(a.letzter_ok),
        a.rrule_ignoriert ? a.rrule_ignoriert + ' ' + uebersetze('Serienregeln übergangen') : '', a.verworfen ? a.verworfen + ' ' + uebersetze('verworfen') : ''].filter(Boolean).join(' · ')) + '</span>' +
      (a.fehler ? '<span class="hinweis bad">' + esc(a.fehler) + '</span>' : '') + '</div>').join('')
    : '<span class="hinweis">' + esc(uebersetze('Noch kein Kalender verbunden.')) + '</span>') + '</div>';
  if ((k.fehler || []).length) {
    html += '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Fehler in config.json')) + '</span>' + k.fehler.map((f) => '<span class="hinweis bad">' + esc(f) + '</span>').join('') + '</div>';
  }
  if ((k.verwaist || []).length) {
    html += '<div class="zt-dfeld"><span class="zt-ueber">' + esc(uebersetze('Konto nicht mehr in config.json')) + '</span>' + k.verwaist.map((v) =>
      '<span class="hinweis warn">' + esc(v.kalender_id + ': ' + v.anzahl + ' ' + uebersetze('Termine') + ' — ' + uebersetze('bleiben, weil Buchungen daran hängen können')) + '</span>').join('') + '</div>';
  }
  // Abo-Adresse einfuegen: der Server prueft, holt einmal zur Probe und speichert
  // in config.json. Danach steht sie nirgends mehr in der Oberflaeche (nur der Host).
  html += '<div class="zt-dfeld zkal-form"><span class="zt-ueber">' + esc(uebersetze('Abo-Adresse einfügen (ICS)')) + '</span>' +
      '<div class="zkal-zeile"><input type="url" class="zt-eingabe mono" data-zkal="url" value="' + esc(zKalForm.url) + '" autocomplete="off" spellcheck="false" maxlength="2000"' +
        ' placeholder="' + esc(uebersetze('https://… oder webcal://… (endet meist auf .ics)')) + '" aria-label="' + esc(uebersetze('Abo-Adresse')) + '">' +
      '<input class="zt-eingabe" data-zkal="name" value="' + esc(zKalForm.name) + '" maxlength="80" placeholder="' + esc(uebersetze('Name (optional)')) + '" aria-label="' + esc(uebersetze('Name')) + '">' +
      '<button type="button" class="knopf primaer" data-aktion="zkal-verbinden">' + esc(uebersetze('Verbinden')) + '</button></div>' +
      (zKalForm.fehler ? '<span class="hinweis bad" role="alert">' + esc(zKalForm.fehler) + '</span>' : '') +
      '<span class="hinweis">' + esc(uebersetze('Die Adresse wird geprüft, in config.json gespeichert und danach nicht mehr angezeigt. Sie ist ein Zugang: nicht weitergeben.')) + '</span></div>';
  // Google und Microsoft (Anmeldung) folgen mit 2.1 (R21); bis dahin die Abo-Adresse.
  html += '<div class="zkal-anleitung"><span class="hinweis">' + esc(uebersetze('So findest du die Adresse:')) + '</span><ol>' +
      ['Google: Einstellungen öffnen (Link unten oder ⚙ oben rechts → Einstellungen). Links unter „Einstellungen für meine Kalender“ deinen Kalender anklicken, meist dein Name — nicht „Kalender hinzufügen“. Weiter unten im Abschnitt „Kalender integrieren“ die „Privatadresse im iCal-Format“ kopieren: Das Feld zeigt nur Punkte (••••), rechts daneben ist das Kopieren-Symbol. Nicht die „Öffentliche Adresse“ und nicht „Code einbetten“ — die gehen nur bei öffentlich gemachtem Kalender. Fehlt der Punkt, hat ihn bei Google Workspace der Admin abgeschaltet.',
        'Outlook.com: Einstellungen → Kalender → Freigegebene Kalender → „Kalender veröffentlichen“, Kalender wählen, „Kann alle Details anzeigen“ → den ICS-Link kopieren.']
        .map((x) => '<li>' + esc(uebersetze(x)) + '</li>').join('') + '</ol>' +
      '<a class="textknopf" href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener noreferrer">' + esc(uebersetze('Google-Kalender-Einstellungen öffnen')) + ' ↗</a>' +
      '<details class="zkal-caldav"><summary>' + esc(uebersetze('CalDAV (Apple iCloud, Nextcloud, Fastmail)')) + '</summary>' +
        '<span class="hinweis">' + esc(uebersetze('CalDAV braucht ein Passwort und wird deshalb nur in config.json eingetragen: Adresse der Kalender-Sammlung, Benutzer und den Namen der Umgebungsvariable mit dem App-Passwort. Danach den Server neu starten.')) + '</span>' +
        '<pre class="zkal-code mono"></pre><button type="button" class="knopf klein" data-aktion="zkal-kopieren">' + esc(uebersetze('Kopieren')) + '</button></details></div>' +
    '<span class="hinweis">' + esc(uebersetze('Abgleich alle') + ' ' + (k.takt_minuten || 5) + ' Min · ' + uebersetze('Zuordnung lernt aus Titeln: „Projekt A“, „NW-125“ oder Kundennamen im Termin werden erkannt.')) + '</span>';
  for (const el of flaechen) {
    const offen = el.querySelector('details.zkal-caldav[open]');
    el.innerHTML = html + (el.id === 'zkal'
      ? '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Schließen')) + '</button>' +
        (konten.length ? '<button type="button" class="knopf primaer" data-aktion="zkal-sync">' + esc(uebersetze('Jetzt abgleichen')) + '</button>' : '') + '</div>'
      : konten.length ? '<div class="zkal-fuss"><button type="button" class="knopf" data-aktion="zkal-sync">' + esc(uebersetze('Jetzt abgleichen')) + '</button></div>' : '');
    el.querySelector('.zkal-code').textContent = ZKAL_BEISPIEL;
    if (offen) el.querySelector('details.zkal-caldav').open = true;
    if (!el.dataset.verdrahtet) {
      el.dataset.verdrahtet = '1';
      el.addEventListener('input', (ev) => { const f = ev.target.dataset.zkal; if (f) zKalForm[f] = ev.target.value; });
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.dataset.zkal) { ev.preventDefault(); const b = el.querySelector('[data-aktion="zkal-verbinden"]'); if (b) b.click(); } });
    }
  }
}
// Antwort von verbinden/trennen traegt den neuen Stand; der Takt bleibt vom letzten Laden.
const zKalStand = (r) => { zt.d.kal = { konten: r.konten, fehler: r.fehler, verwaist: r.verwaist, takt_minuten: (zt.d.kal || {}).takt_minuten }; };
aktion('zkal-verbinden', (_, el) => mitLauf(el, async () => {
  zKalForm.fehler = '';
  try {
    const r = await sende('/api/kalender-verbinden', { url: zKalForm.url, name: zKalForm.name });
    zKalStand(r);
    const neu = (r.konten || []).find((a) => a.id === r.id);
    zKalForm.url = ''; zKalForm.name = '';
    toast(uebersetze('Kalender verbunden') + (neu ? ' · ' + neu.anzahl + ' ' + uebersetze('Termine') : ''), 'ok');
    zeitNachAenderung();
  } catch (e) { zKalForm.fehler = uebersetze('Nicht verbunden') + ': ' + e.message; }
  zKalZeichnen();
}));
// Entfernen in zwei Klicks; der erste faellt nach 4 s zurueck.
aktion('zkal-trennen', (id, el) => {
  if (zKalTrennen !== id) {
    zKalTrennen = id; zKalZeichnen();
    setTimeout(() => { if (zKalTrennen === id) { zKalTrennen = null; zKalZeichnen(); } }, 4000);
    return;
  }
  zKalTrennen = null;
  return mitLauf(el, async () => {
    try {
      const r = await sende('/api/kalender-trennen', { id });
      zKalStand(r);
      toast(uebersetze('Kalender entfernt') + (r.termine_entfernt ? ' · ' + r.termine_entfernt + ' ' + uebersetze('Termine') : ''), 'ok');
      zeitNachAenderung();
    } catch (e) { toast(uebersetze('Nicht entfernt') + ': ' + e.message, 'err'); }
    zKalZeichnen();
  });
});
aktion('zkal-kopieren', async () => {
  try { await navigator.clipboard.writeText(ZKAL_BEISPIEL); toast(uebersetze('Kopiert'), 'ok'); } catch (e) { toast(uebersetze('Nicht kopiert') + ': ' + e.message, 'err'); }
});
aktion('zkal-sync', (_, el) => mitLauf(el, async () => {
  try {
    const r = await sende('/api/kalender-sync', {});
    const kaputt = (r.ergebnisse || []).filter((x) => !x.ok);
    toast(kaputt.length ? uebersetze('Abgleich fehlgeschlagen') + ': ' + kaputt.map((x) => x.id + ' — ' + x.fehler).join(' · ') : uebersetze('Abgeglichen'), kaputt.length ? 'err' : 'ok');
  } catch (e) { toast(uebersetze('Abgleich fehlgeschlagen') + ': ' + e.message, 'err'); }
  try { zt.d.kal = await hole('/api/kalender'); } catch (e) { zt.d.kal = { fehlerLaden: e.message }; }
  zKalZeichnen();
  zeitNachAenderung();
}));

/* ---------- Workload, Als Naechstes, Hinweise (Z7b) ----------
   Workload und Restkapazitaet rechnet der Server (/api/zeit/workload); hier wird
   nur gezeichnet. Hub, Live und Analyse teilen einen Stand, hoechstens alle 15 s. */
const zWl = { d: null, zeit: 0, laeuft: false, fehler: null };
async function zWorkloadLaden() {
  if (zWl.laeuft || Date.now() - zWl.zeit < 15000) return;
  zWl.laeuft = true;
  zWl.zeit = Date.now();
  try {
    zWl.d = await hole('/api/zeit/workload');
    zWl.fehler = null;
  } catch (e) { zWl.fehler = e.message; }
  zWl.laeuft = false;
  if (['hub', 'live', 'analyse'].includes(route().name)) zeichneAnsicht();
}
const zWlProzent = (s) => (s.auslastung == null ? '–' : nf0.format(s.auslastung * 100));
const zWlUeber = (s) => (s.ueberbucht_tage ? fuelle(s.ueberbucht_tage === 1 ? '{n} Tag überbucht' : '{n} Tage überbucht', { n: s.ueberbucht_tage }) : uebersetze('nichts überbucht'));

// Karte „Workload 7 Tage“ (Hub-Reihe, Analyse; Mockup Z. 393–400): je Tag Termine,
// Blocker und was ueber dem Tagessoll liegt; Skala 125 % des Solls, Sollmarke bei 80 %.
function zWorkloadSpalte() {
  zWorkloadLaden();
  const kopf = '<div class="zh-kopf"><span class="label" title="' + esc(uebersetze('Workload 7 Tage — Meetings + Blocker gegen Tagessoll')) + '">' + esc(uebersetze('Workload 7 Tage')) + '</span>' +
    '<a class="akzent zh-link" href="#/zeit">' + esc(uebersetze('Zeiterfassung')) + ' →</a></div>';
  if (!zWl.d) {
    return '<div class="zh-spalte zw">' + kopf + (zWl.fehler ? '<span class="hinweis bad">' + esc(uebersetze('Workload nicht geladen') + ': ' + zWl.fehler) + '</span>' : '<div class="leer">…</div>') + '</div>';
  }
  const W = zWl.d, s = W.summe;
  const soll = Math.max(1, ...W.tage.map((t) => t.soll_min));
  const skala = soll / 0.8;
  const breite = (m) => (Math.min(m, skala) / skala * 100).toFixed(1);
  const alt = zWl.fehler ? '<span class="hinweis bad">' + esc(uebersetze('Nicht aktualisiert') + ': ' + zWl.fehler) + '</span>' : '';
  return '<div class="zh-spalte zw">' + kopf + alt +
    '<div class="zh-wert"><span class="mono">' + esc(zWlProzent(s)) + '<small>%</small></span><span class="' + (s.ueberbucht_tage ? 'bad' : 'faint') + '">' + esc(zWlUeber(s)) + '</span></div>' +
    '<span class="hinweis">' + esc(uebersetze('Meetings + Blocker gegen Tagessoll') + ' · ' + zdur(s.belegt_min) + ' h ' + uebersetze('von') + ' ' + zdur(s.kapazitaet_min) + ' h') + '</span>' +
    '<div class="zw-tage">' + W.tage.map((t) => {
      const blocker = Math.max(0, Math.min(t.blocker_min, soll - Math.min(t.meeting_min, soll)));
      const wert = !t.belegt_min ? uebersetze('frei') : t.ueber_min ? '+' + zdur(t.ueber_min) : zdur(t.belegt_min);
      return '<div class="zw-tag' + (t.soll_min ? '' : ' we') + '" title="' + esc(zWt(t.tag) + ' ' + datumKurz(t.tag) + ' · ' + uebersetze('Meetings') + ' ' + zdur(t.meeting_min) + ' h · ' +
          uebersetze('Blocker') + ' ' + zdur(t.blocker_min) + ' h' + (t.ueber_min ? ' · ' + uebersetze('über Soll') + ' ' + zdur(t.ueber_min) + ' h' : '')) + '">' +
        '<span class="zw-l">' + esc(zWt(t.tag) + ' ' + datumKurz(t.tag)) + '</span>' +
        '<span class="zw-balken"><span class="m" style="width:' + breite(Math.min(t.meeting_min, soll)) + '%"></span><span class="b" style="width:' + breite(blocker) + '%"></span>' +
          '<span class="u" style="width:' + breite(t.ueber_min) + '%"></span><span class="soll"></span></span>' +
        '<span class="mono zw-v' + (t.ueber_min ? ' bad' : t.belegt_min ? '' : ' faint') + '">' + esc(wert) + '</span></div>';
    }).join('') + '</div>' +
    '<div class="zw-legende"><span><span class="leg-p zw-m"></span>' + esc(uebersetze('Termine')) + '</span><span><span class="leg-p zw-b"></span>' + esc(uebersetze('Blocker')) + '</span>' +
      '<span><span class="leg-p zw-u"></span>' + esc(uebersetze('über Soll')) + '</span><span class="faint">' + esc(uebersetze('Tagessoll') + ' ' + zdur(soll) + ' h') + '</span></div>' +
  '</div>';
}

// Live „Du“ (Mockup Z. 919–922): Termine und Blocker, die heute noch anstehen, und
// die Restkapazitaet aus dem Server. Klick oeffnet den Termin in der Zeiterfassung.
function zNaechsteHeute() {
  zWorkloadLaden();
  const heute = isoTag(new Date());
  const jetzt = Date.now();
  const tms = zHeute.d ? zTermine(zHeute.d.hw).filter((x) => zTag(x.start) === heute && Date.parse(x.start) > jetzt && !x.gebucht_eintrag_id)
    .sort((a, b) => a.start.localeCompare(b.start)) : [];
  const zeile = (x) => {
    const z = zTerminZiel(x);
    const sub = x.art === 'blocker' ? uebersetze(x.erinnern ? 'Blocker · Erinnerung mit Prüfung Claude vs. manuell' : 'Blocker')
      : uebersetze(ZTA[x.art]) + (z ? ' · ' + z.l : '') + ' · ' + zdur((Date.parse(x.ende) - Date.parse(x.start)) / 60000) + ' h';
    return '<button type="button" class="zn-z ' + (x.art === 'blocker' ? 'blocker' : 'meeting') + '" data-aktion="zt-termin-dlg"' + zTerminDaten(x) + '>' +
      '<span class="mono">' + zhm(x.start) + '–' + zhm(x.ende) + '</span><span class="zn-t"><span>' + esc(x.titel) + '</span><span>' + esc(sub) + '</span></span></button>';
  };
  // Server rechnet nach UTC-Tag: kurz nach Mitternacht Ortszeit gehoert die Zahl noch zum Vortag.
  const h = zWl.d && zWl.d.heute && zWl.d.heute.tag === heute ? zWl.d.heute : null;
  return '<div class="zh-spalte"><span class="label">' + esc(uebersetze('Als Nächstes heute')) + '</span>' +
    (!zHeute.d ? '<div class="leer">…</div>' : tms.length ? '<div class="zn-liste">' + tms.slice(0, 4).map(zeile).join('') + '</div>'
      : '<span class="hinweis">' + esc(uebersetze('Keine Termine oder Blocker mehr heute.')) + '</span>') +
    '<span class="hinweis" title="' + esc(uebersetze('Restkapazität heute — Tagessoll − Arbeitszeit − anstehende Termine')) + '">' + esc(uebersetze('Restkapazität heute')) + ' <b class="mono">' +
      (h ? zdur(h.rest_min) + ' h' : zWl.fehler || zWl.d ? '–' : '…') + '</b>' +
      (h ? ' <span class="faint">· ' + esc(zdur(h.soll_min) + ' − ' + zdur(h.arbeitszeit_min) + ' − ' + zdur(h.termine_rest_min) + ' h') + '</span>' : '') + '</span>' +
    (zWl.fehler ? '<span class="hinweis bad">' + esc(uebersetze('Workload nicht geladen') + ': ' + zWl.fehler) + '</span>' : '') +
  '</div>';
}

/* ---------- Zeit-Hinweise (Glocke, Desktop-Hinweis, Banner) ----------
   Quelle /api/zeit-hinweise (Erinnerung bei Blocker-Beginn), geladen mit Live
   (15 s). Wegklicken geht an den Server — der Hinweis haengt am Termin. */
const zHinweisId = (h) => 'zeit:' + h.termin.kalender_id + ':' + h.termin.uid + ':' + h.seit;
const ZFALL = {
  claude: ['Du tippst gerade in Claude an diesem Ziel — die Zeit läuft über Claude.', null],
  begleiten: ['Claude arbeitet allein an diesem Ziel — Timer mit Tätigkeit Begleiten starten?', 'Timer starten · Begleiten'],
  manuell: ['Keine Claude-Sitzung an diesem Ziel — Timer starten?', 'Timer starten'],
};
// Eintraege fuer hinweise() in shell.js.
// Weggeklickte merkt sich der Tab: eine aeltere Antwort des Live-Takts braechte sie sonst zurueck.
const zWeg = new Set();
const zOffen = () => (state.zeitHinweise || []).filter((h) => !zWeg.has(zHinweisId(h)));
// Offene Erinnerungen im Tab-Titel ("(1) Hub · c2invoice"): faellt auch im Hintergrund-Tab auf.
const zTitel = (t) => (zOffen().length ? '(' + zOffen().length + ') ' : '') + String(t).replace(/^\(\d+\) /, '');
function zHinweise() {
  return zOffen().map((h) => {
    const f = ZFALL[h.fall] || ZFALL.manuell;
    const z = zTerminZiel(h.termin);
    return {
      id: zHinweisId(h), heute: true, icon: '◷', c: h.fall === 'claude' ? 'var(--ok)' : 'var(--accent)',
      t: uebersetze('Blocker hat begonnen') + ': ' + h.termin.titel,
      s: uebersetze(f[0]) + (z ? ' (' + (h.termin.ziel_von_hand ? '' : uebersetze('vermutet') + ' ') + z.l + ')' : ''),
      wann: zhm(h.termin.start), aktion: f[1], aktionName: 'zeit-hinweis-timer', ziel: zHinweisId(h), weg: 'zeit-hinweis-weg',
    };
  });
}
// Neue Hinweise einmal melden: Desktop-Hinweis, wenn erlaubt, sonst Banner (Toast mit Knopf).
function zHinweiseMelden() {
  const gemeldet = liesJson('zeit.gemeldet', {});
  const neu = (state.zeitHinweise || []).filter((h) => !gemeldet[zHinweisId(h)]);
  if (!neu.length) return;
  for (const h of neu) {
    const id = zHinweisId(h);
    gemeldet[id] = 1;
    const f = ZFALL[h.fall] || ZFALL.manuell;
    const titel = uebersetze('Blocker hat begonnen') + ': ' + h.termin.titel;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(titel, { body: uebersetze(f[0]), tag: id });
        n.onclick = () => { window.focus(); state.glockeOffen = true; zeichneGlocke(); zeichneKopf(); };
        continue;
      } catch (e) { console.error('Desktop-Hinweis:', e.message); }
    }
    toast(titel, 'ok', f[1] ? { text: uebersetze(f[1]), tu: () => zHinweisTimer(id).catch((e) => toast(e.message, 'err')) } : undefined);
  }
  // Nur die letzten 50 merken: Schluessel enthalten den Zeitpunkt, alte kommen nie wieder.
  merke('zeit.gemeldet', Object.fromEntries(Object.entries(gemeldet).slice(-50)));
}
// Zeile in der Glocke: Desktop-Hinweise einmal erlauben (Plan B9).
function zGlockeZeile() {
  const alt = state.fehler.zeitHinweise ? '<div class="hw" style="grid-template-columns:1fr"><span class="s bad">' + esc(uebersetze('Erinnerungen nicht aktualisiert') + ': ' + state.fehler.zeitHinweise) + '</span></div>' : '';
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return alt;
  return alt + '<button type="button" class="verbindung-zeile" data-aktion="zeit-hinweise-erlauben"><span class="punkt" style="background:var(--accent)"></span>' +
    '<span style="flex:1">' + esc(uebersetze('Desktop-Hinweise bei Blocker-Beginn erlauben')) + '</span><span class="faint">→</span></button>';
}
aktion('zeit-hinweise-erlauben', async () => {
  try { await Notification.requestPermission(); } catch (e) { toast(e.message, 'err'); }
  zeichneGlocke();
});

// Primaeraktion: ein von Hand gesetztes Ziel startet den Timer sofort. Ein geratenes
// oder fehlendes Ziel kommt nur als Vorschlag in die Timer-Karte — gestartet wird
// erst nach Bestaetigung (Pflicht aus Z6a: geratenes Ziel nie ohne Klick buchen).
async function zHinweisTimer(id, knopf) {
  const h = zOffen().find((x) => zHinweisId(x) === id);
  if (!h) { toast(uebersetze('Hinweis nicht mehr offen.'), 'err'); return; }
  const t = h.termin;
  const taetigkeit = h.fall === 'begleiten' ? 'Begleiten' : zt.form.taetigkeit || 'Entwicklung';
  state.glockeOffen = false; zeichneGlocke(); zeichneKopf();
  // Laeuft schon ein Timer, wuerde timer-start ihn still buchen: dann auch nur vorbelegen.
  const laeuft = !!zTimer();
  if (!(t.ziel_art && t.ziel_von_hand) || laeuft) {
    zt.form = { ...zt.form, ziel: t.ziel_art ? zTerminZiel(t) : undefined, taetigkeit, notiz: String(t.titel || '').slice(0, 500) };
    if (!zt.form.ziel) delete zt.form.ziel;
    merke('zeit.timer', zt.form);
    geheZu('zeit');
    toast(uebersetze(laeuft ? 'Es läuft schon ein Timer — erst stoppen, dann starten.' : zt.form.ziel ? 'Ziel prüfen und Timer starten.' : 'Ziel wählen und Timer starten.'), 'ok');
    if (!zt.form.ziel && !laeuft) setTimeout(() => zeitPicker('timer'), 0);
    return;
  }
  // Ohne Blick in ein Formular: nur ein selbst getippter Titel (lokaler Termin) wird Notiz —
  // ein fremder Kalendertitel landete sonst ungesehen auf der Rechnungsposition.
  const notiz = t.kalender_id === 'lokal' ? String(t.titel || '').slice(0, 500) : '';
  await mitLauf(knopf, async () => {
    try {
      const r = await sende('/api/zeit/timer-start', { ziel_art: t.ziel_art, ziel_schluessel: t.ziel_schluessel, taetigkeit, notiz, abrechenbar: t.ziel_art !== 'intern' });
      if (state.live) state.live.timer = r.timer;
      zeichneMiniTimer();
      if (r.gebucht) toast(uebersetze('Laufender Timer gebucht') + ' · ' + zdur(r.gebucht.gezaehlt_min) + ' h', 'ok');
      toast(uebersetze('Timer gestartet') + ' · ' + zielKurz(t.ziel_art, t.ziel_schluessel) + ' · ' + taetigkeit, 'ok');
    } catch (e) { toast(uebersetze('Timer nicht gestartet') + ': ' + e.message, 'err'); return; }
    // Der Hinweis ist erledigt; scheitert nur das Wegklicken, bleibt er stehen (sichtbar, kein Fehler am Timer).
    zWeg.add(id);
    zeichneKopf();
    try { await sende('/api/zeit-hinweis-weg', { kalender_id: t.kalender_id, uid: t.uid }); } catch (e) { toast(uebersetze('Hinweis nicht weggeklickt') + ': ' + e.message, 'err'); }
    zeitNachAenderung();
  });
}
aktion('zeit-hinweis-timer', (id, el) => zHinweisTimer(id, el));
async function zHinweisWeg(id) {
  const h = zOffen().find((x) => zHinweisId(x) === id);
  if (!h) return;
  try {
    await sende('/api/zeit-hinweis-weg', { kalender_id: h.termin.kalender_id, uid: h.termin.uid });
    zWeg.add(id);
  } catch (e) { toast(uebersetze('Hinweis nicht weggeklickt') + ': ' + e.message, 'err'); }
  zeichneGlocke(); zeichneKopf();
}
aktion('zeit-hinweis-weg', (id) => zHinweisWeg(id));

// „+ Zeit reservieren“ im Vorgangs-Detail: Blocker-Dialog mit dem Vorgang als Ziel.
aktion('z-reservieren', (key) => {
  if (!key) return;
  zTerminDialog({ neu: { art: 'blocker', ziel: zZielVon('vorgang', key) } });
});
