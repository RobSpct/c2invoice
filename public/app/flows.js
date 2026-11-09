'use strict';
/* Flows (C11c, README §6.5 ohne Canvas): Liste, Aufbau als Schrittliste, Laeufe mit
   Detail und Fehlerbox. Gerechnet wird hier nichts: Status, Fehlertexte, Schritte
   und die Zahl der Kandidaten kommen von /api/flows (flows.js). Flows lassen sich
   schalten, probelaufen und wiederholen — anlegen oder aendern gibt es nicht (Owner P2).
   Server-Texte (Meldungen, Kartentitel) laufen fuer Englisch durch fxServer(). */

Object.assign(EN, {
  'Flows': 'Flows', 'Alle Läufe': 'All runs', 'Läufe': 'Runs', 'Aufbau': 'Setup', 'Ansicht': 'View', 'Flow': 'Flow', 'Filter': 'Filter',
  'Fehler und Warnungen': 'Errors and warnings', '{n} Fehler': '{n} errors', '1 Fehler': '1 error', 'offene Fehlerkarten unter „Braucht dich“': 'open error cards under “Needs you”',
  'aktiv': 'active', 'pausiert': 'paused', '{n} Schritte': '{n} steps', '1 Schritt': '1 step', '{n} Läufe': '{n} runs', '1 Lauf': '1 run', '200+ Läufe': '200+ runs',
  'Testlauf': 'Test run', 'Testlauf …': 'Test run …', 'Flows nicht geladen': 'Flows not loaded', 'Keine Flows': 'No flows', 'Es sind keine Flow-Vorlagen angelegt.': 'No flow templates have been created.',
  'Angebot läuft ab': 'Quote about to expire', 'Jira-Statuswechsel': 'Jira status change',
  'Überfällige Rechnung → Mahnung': 'Overdue invoice → dunning', 'Angebot läuft ab → Nachfassen': 'Quote expiring → follow-up', 'Vorgang erledigt → Rechnungsentwurf': 'Job done → invoice draft',
  'Auslöser': 'Trigger', 'Bedingung': 'Condition', 'Aktion': 'Action', 'Mahnschreiben senden': 'Send dunning letter', 'Nachfassen senden': 'Send follow-up', 'Vorgang erledigt?': 'Job done?', 'Rechnungsentwurf anlegen': 'Create invoice draft',
  'Sendet das Schreiben der fälligen Mahnstufe (Zahlungserinnerung, 1. oder 2. Mahnung)': 'Sends the letter for the due dunning level (reminder, 1st or 2nd dunning)',
  'Sendet die Nachfass-Mail mit dem Angebots-PDF': 'Sends the follow-up e-mail with the quote PDF', 'Legt einen Rechnungsentwurf unter „Braucht dich“ an': 'Creates an invoice draft under “Needs you”',
  'dann': 'then', 'ja': 'yes', 'nein': 'no', 'Schritt {n}': 'step {n}', 'Lauf endet': 'run ends', 'danach Ende': 'then the run ends', 'ist gesetzt': 'is set',
  'So läuft dieser Flow': 'How this flow works',
  'werktags ab {h} Uhr': 'on working days from {h}:00', 'täglich ab {h} Uhr': 'every day from {h}:00',
  'Der Scan läuft {wann} und prüft alle offenen Rechnungen. Für jede, bei der eine Mahnstufe fällig ist, geht das Schreiben raus; eine Rechnung in Mahnpause wird übersprungen. Steht unter E-Mail & Versand eine Testmodus-Adresse, gehen die Schreiben nur dorthin. Die Tagesgrenze begrenzt, wie viele am Tag rausgehen; der Rest folgt beim nächsten Scan. Uhrzeit und Wochenende stellst du unter Einstellungen → Flows ein. Der Aufbau lässt sich hier nicht ändern.':
    'The scan runs {wann} and checks all open invoices. For each one with a due dunning level the letter goes out; an invoice in a dunning pause is skipped. If a test mode address is set under E-mail & sending, the letters go only there. The daily limit caps how many go out per day; the rest follows with the next scan. You set the time and the weekend under Settings → Flows. The setup cannot be changed here.',
  'Der Scan läuft {wann} und prüft alle offenen Angebote. Kurz vor Ablauf der Gültigkeit geht einmal eine Nachfass-Mail mit dem Angebots-PDF raus. Den Abstand stellst du unter Einstellungen → Nachfassen ein, Uhrzeit und Wochenende unter Einstellungen → Flows. Steht unter E-Mail & Versand eine Testmodus-Adresse, geht die Mail nur dorthin. Der Aufbau lässt sich hier nicht ändern.':
    'The scan runs {wann} and checks all open quotes. Shortly before the validity ends, one follow-up e-mail with the quote PDF goes out. You set the lead time under Settings → Follow-up, the time and the weekend under Settings → Flows. If a test mode address is set under E-mail & sending, the e-mail goes only there. The setup cannot be changed here.',
  'Reagiert auf jeden Vorgang, der in Jira auf „erledigt“ wechselt, und legt dazu einen Rechnungsentwurf unter „Braucht dich“ an. Gesendet wird nichts. Der Flow braucht Jira (jira.enabled in config.json). Der Aufbau lässt sich hier nicht ändern.':
    'Reacts to every job that moves to “done” in Jira and creates an invoice draft under “Needs you”. Nothing is sent. The flow needs Jira (jira.enabled in config.json). The setup cannot be changed here.',
  'Letzte Läufe': 'Latest runs', 'Alle Läufe und Fehler': 'All runs and errors', 'Noch keine Läufe': 'No runs yet',
  'Ein Flow läuft nach dem Scharfschalten von selbst. Mit „Testlauf“ siehst du vorher, was er täte — es wird nichts gesendet.': 'A flow runs on its own once switched on. “Test run” shows beforehand what it would do — nothing is sent.',
  'Keine Fehler oder Warnungen': 'No errors or warnings', 'Alle Läufe sind sauber durchgelaufen.': 'All runs finished cleanly.',
  'Kein Lauf gewählt': 'No run selected', 'Links einen Lauf öffnen.': 'Open a run on the left.', 'Lauf nicht gefunden.': 'Run not found.', 'Lauf lädt …': 'Loading run …',
  'Warnung': 'warning', 'übersprungen': 'skipped', 'läuft': 'running', 'aus Original übernommen': 'carried over from original',
  'Start': 'Start', 'Dauer': 'Duration', 'Status': 'Status', 'Bezug': 'Reference', 'Wiederholung von Lauf {n}': 'Retry of run {n}', 'Testlauf, nichts gesendet': 'Test run, nothing sent',
  'Fehler in Schritt {n}': 'Error in step {n}', 'Ab Schritt {n} wiederholen': 'Retry from step {n}', 'Cira fragen': 'Ask Cira', 'Lauf ansehen': 'View run', 'Ignorieren': 'Ignore', 'Erledigt': 'Done',
  'Die Mail ist vermutlich raus. Nicht erneut senden: im Gesendet-Ordner und unter Gesendet in c2invoice prüfen. Die Karte unter „Braucht dich“ bestätigt nur.': 'The e-mail has probably gone out. Do not send again: check the Sent folder and Sent in c2invoice. The card under “Needs you” only confirms.',
  'Wiederholt im Lauf {n}: {s}': 'Retried as run {n}: {s}', 'Wiederholen fehlgeschlagen': 'Retry failed', 'Testlauf fehlgeschlagen': 'Test run failed', 'Testlauf beendet: {s}': 'Test run finished: {s}',
  'Eingang': 'Input', 'Ausgang': 'Output', 'Eingang und Ausgang': 'Input and output', 'leer': 'empty', 'Schritte': 'Steps', 'Test': 'Test',
  'Warum ist der Flow-Lauf {id} („{flow}“) bei Schritt {n} gescheitert: {fehler}? Was soll ich tun?': 'Why did flow run {id} (“{flow}”) fail at step {n}: {fehler}? What should I do?',
  'Flow scharfschalten': 'Switch flow on', 'Scharfschalten': 'Switch on', 'Abbrechen': 'Cancel', 'Pausieren': 'Pause',
  'Beim nächsten Scan ({wann}) geht 1 Schreiben raus.': 'On the next scan ({wann}) 1 letter goes out.', 'Beim nächsten Scan ({wann}) gehen {n} Schreiben raus.': 'On the next scan ({wann}) {n} letters go out.',
  'Beim nächsten Scan ({wann}) geht 1 Schreiben an die Test-Adresse {a}.': 'On the next scan ({wann}) 1 letter goes to the test address {a}.', 'Beim nächsten Scan ({wann}) gehen {n} Schreiben an die Test-Adresse {a}.': 'On the next scan ({wann}) {n} letters go to the test address {a}.',
  'Jetzt ausführen': 'Run now', 'Jetzt ausführen …': 'Running …', 'Jetzt geht 1 Schreiben raus.': '1 letter goes out now.', 'Jetzt gehen {n} Schreiben raus.': '{n} letters go out now.',
  'Jetzt geht 1 Schreiben an die Test-Adresse {a}.': '1 letter goes to the test address {a} now.', 'Jetzt gehen {n} Schreiben an die Test-Adresse {a}.': '{n} letters go to the test address {a} now.',
  'Im Moment ist nichts fällig, es geht nichts raus.': 'Nothing is due right now, nothing goes out.', 'Schließen': 'Close',
  '1 Lauf gestartet': '1 run started', '{n} Läufe gestartet': '{n} runs started', 'Nicht ausgeführt': 'Not run',
  'Führt den Scan dieses Flows sofort aus, ohne auf Wochentag und Uhrzeit zu warten. Was heute schon lief, geht kein zweites Mal raus, auch nicht beim täglichen Scan. Tagesgrenze und Testmodus gelten wie beim Scan.':
    'Runs this flow’s scan right away, without waiting for the weekday and time. What already ran today does not go out a second time, not even with the daily scan. The daily limit and test mode apply as for the scan.',
  'Der Scan von heute ist noch nicht gelaufen. Das kann innerhalb einer Minute passieren.': 'Today’s scan has not run yet. This can happen within a minute.',
  'Dieser Lauf wurde schon wiederholt, der neuere Lauf zählt.': 'This run has already been retried, the newer run counts.',
  'Im Moment ist nichts fällig, es geht nichts raus. Neue Fälle meldet der tägliche Scan.': 'Nothing is due right now, nothing goes out. The daily scan picks up new cases.',
  'Höchstens {g} am Tag (Tagesgrenze), der Rest folgt beim nächsten Scan.': 'At most {g} per day (daily limit), the rest follows with the next scan.',
  'Ab jetzt legt jeder Vorgang, der in Jira auf „erledigt“ wechselt, einen Rechnungsentwurf unter „Braucht dich“ an. Gesendet wird nichts.': 'From now on every job that moves to “done” in Jira creates an invoice draft under “Needs you”. Nothing is sent.',
  'Jira ist nicht eingeschaltet (jira.enabled in config.json). Dieser Flow reagiert auf Statuswechsel in Jira und lässt sich erst danach aktivieren.': 'Jira is not switched on (jira.enabled in config.json). This flow reacts to status changes in Jira and can only be activated afterwards.',
  'Flow nicht geschaltet': 'Flow not switched', 'Flow ist jetzt aktiv.': 'Flow is now active.', 'Flow ist pausiert.': 'Flow is paused.',
  'Probelauf für Vorgang': 'Test run for job', 'Vorgang (z. B. ABC-12)': 'Job (e.g. ABC-12)', 'Der Probelauf legt nichts an und sendet nichts.': 'The test run creates and sends nothing.',
  'Probelauf mit dem ersten echten Fall: es wird nichts gesendet oder angelegt, der Lauf erscheint mit dem Zusatz „Test“.': 'Test run with the first real case: nothing is sent or created, the run is marked “Test”.',
  'Erklärung': 'Explanation', 'Offene Fehlerkarte': 'Open error card',
});

// Server-Texte (Schritt-Meldungen, Fehler, Kartentitel) fuer Englisch. Unbekanntes bleibt Deutsch.
const FX_SERVER = [
  [/^Keine Empfängeradresse für Rechnung (.+?) \(Ansprechpartner oder Kontakt ohne E-Mail\)$/, 'No recipient address for invoice $1 (contact person or contact without e-mail)'],
  [/^Keine Empfängeradresse für Angebot (.+)$/, 'No recipient address for quote $1'],
  [/^Tagesgrenze erreicht \((\d+) Mails\), morgen wieder$/, 'Daily limit reached ($1 e-mails), again tomorrow'],
  [/^Stufe (\d) bereits gesendet$/, 'Level $1 already sent'], [/^Stufe (\d) ist noch nicht fällig$/, 'Level $1 is not due yet'],
  [/^Kein Kandidat$/, 'No candidate'],
  [/^Kein Kandidat: (.+)$/, (m) => 'No candidate: ' + m[1].split('; ').map(fxGrund).join('; ')], [/^Bedingung: ja$/, 'Condition: yes'], [/^Bedingung: nein$/, 'Condition: no'],
  [/^Server wurde während des Laufs beendet; Ergebnis prüfen$/, 'Server was stopped during the run; check the result'],
  [/^Angebot (.+) ist nicht mehr offen$/, 'Quote $1 is no longer open'], [/^Angebot (.+) nicht gefunden$/, 'Quote $1 not found'],
  [/^Nachfassen für (.+) ist schon gesendet$/, 'Follow-up for $1 has already been sent'],
  [/^Ein früheres Nachfassen zu (.+) ist unklar zugestellt — erst unter Gesendet prüfen$/, 'An earlier follow-up for $1 has unclear delivery — check under Sent first'],
  [/^Nachfassen gesendet an (.+)$/, 'Follow-up sent to $1'], [/^Nachfassen zu (.+?) an (.+)$/, 'Follow-up for $1 to $2'],
  [/^Test: Nachfassen ging an die Testadresse statt an (.+)$/, 'Test: follow-up went to the test address instead of $1'],
  [/^PDF fehlt: (.+)$/, 'PDF missing: $1'], [/^Versand fehlgeschlagen$/, 'Sending failed'], [/^Unbekannte Aktion: (.+)$/, 'Unknown action: $1'],
  [/^Rechnungsentwurf für (.+)$/, 'Invoice draft for $1'], [/^Das Ereignis nennt keinen Vorgang$/, 'The event names no job'],
  [/^Mail ging raus, Status nicht gespeichert — nicht erneut senden, nicht als Post markieren$/, 'E-mail went out, status not saved — do not send again, do not mark as post'],
  [/^Test: (.+?) ging an die Testadresse statt an (.+), zählt nicht als Stufe$/, (m) => 'Test: ' + uebersetze(m[1]) + ' went to the test address instead of ' + m[2] + ', does not count as a level'],
  [/^(Zahlungserinnerung|1\. Mahnung|2\. Mahnung) gesendet an (.+)$/, (m) => uebersetze(m[1]) + ' sent to ' + m[2]],
  [/^(Zahlungserinnerung|1\. Mahnung|2\. Mahnung) an (.+?) über (.+)$/, (m) => uebersetze(m[1]) + ' to ' + m[2] + ' for ' + m[3]],
  [/^Flow „(.+)“ fehlgeschlagen(?:: (.+))?$/, (m) => 'Flow “' + uebersetze(m[1]) + '” failed' + (m[2] ? ': ' + fxServer(m[2]) : '')],
  [/^Rechnung (\S+)$/, 'Invoice $1'], [/^Angebot (\S+)$/, 'Quote $1'], [/^Vorgang (\S+)$/, 'Job $1'],
  [/^Tages-Scan fehlgeschlagen$/, 'Daily scan failed'],
  [/^Zustellung unklar — erst unter Gesendet pr(?:ü|ue)fen( — im Dialog „Mahnen“ klären)?$/, (m) => 'Delivery unclear — check under Sent first' + (m[1] ? ' — resolve it in the “Dunning” dialog' : '')],
  [/^Rechnung (.+): Mahnstufen ausgeschöpft$/, 'Invoice $1: dunning levels exhausted'],
  [/^Automatische Schreiben warten: Versand nicht bereit$/, 'Automatic letters are waiting: sending not ready'],
  [/^Flow ist pausiert — erst scharf schalten$/, 'Flow is paused — switch it on first'],
  [/^Dieser Flow startet nur über den Jira-Abgleich$/, 'This flow only starts from the Jira sync'],
  [/^Versand nicht bereit(?:: (.+))?$/s, (m) => 'Sending not ready' + (m[1] ? ': ' + m[1] : '')],
  [/^Alle drei Stufen sind gesendet, die Frist ist abgelaufen und die Rechnung ist noch offen\. Weiteres \(Inkasso, Mahnbescheid\) liegt bei dir\.$/,
    'All three levels have been sent, the deadline has passed and the invoice is still open. Further steps (collection, court order) are up to you.'],
  [/^Schritt (\d+)(?: \((.*?)\))?: (.*?)(\. „Ok“ wiederholt den Lauf ab diesem Schritt\.| Die Mail ist womöglich schon raus: NICHT erneut senden, erst im Gesendet-Ordner und unter Gesendet in c2invoice prüfen, dann bestätigen\. Bis dahin lässt der Tages-Scan diesen Beleg aus\.| Im Gesendet-Ordner prüfen\. Ging das Nachfassen nicht raus, bitte von Hand senden — der Flow fasst dieses Angebot nicht noch einmal nach\.)?$/s,
    (m) => 'Step ' + m[1] + (m[2] ? ' (' + uebersetze(m[2]) + ')' : '') + ': ' + fxServer(m[3]) +
      (!m[4] ? '' : m[4].startsWith('.') ? '. “Ok” repeats the run from this step.'
        : m[4].startsWith(' Im') ? ' Check the Sent folder. If the follow-up did not go out, please send it by hand — the flow will not follow up on this quote again.'
          : ' The e-mail may already have gone out: do NOT send again, first check the Sent folder and Sent in c2invoice, then confirm. Until then the daily scan skips this document.')],
];
// Probelauf ohne Kandidat: "<nr> <Grund>" je Rechnung (Gruende aus mahnung.js ausgeschlossen).
const FX_GRUND = [
  [/^nie per Mail aus c2invoice versendet$/, 'never sent by e-mail from c2invoice'],
  [/^nur als Test versendet, Testmodus ist aus$/, 'only sent as a test, test mode is off'],
  [/^Stufe (\d) erst ab (\S+) fällig$/, 'level $1 due from $2'],
  [/^Testschreiben Stufe (\d) schon verschickt \(Testmodus: eins je Stufe\)$/, 'test letter for level $1 already sent (test mode: one per level)'],
  [/^Mahnpause bis (\S+)$/, 'dunning paused until $1'],
  [/^wartet auf die offene Fehlerkarte \(erst prüfen, dann bestätigen\)$/, 'waiting for the open error card (check first, then confirm)'],
  [/^Rechnung nicht lesbar \(siehe Protokoll\)$/, 'invoice not readable (see log)'],
];
function fxGrund(teil) {
  const m = /^(\S+) (.+)$/.exec(teil);
  if (!m) return teil;
  for (const [re, ein] of FX_GRUND) if (re.test(m[2])) return m[1] + ' ' + m[2].replace(re, ein);
  return m[1] + ' ' + fxServer(m[2]);
}

function fxServer(t) {
  const s = String(t == null ? '' : t);
  if (istDE()) return s;
  for (const [re, ein] of FX_SERVER) {
    const m = re.exec(s);
    if (m) return typeof ein === 'function' ? ein(m) : s.replace(re, ein);
  }
  return s;
}

const fx = {
  flows: null, jira: null, versand: null, laeufe: null, karten: [], fehler: null, laedt: false,
  flowId: null, tab: 'aufbau', laufId: null, filter: lies('fx.filter', 'alle') === 'fehler' ? 'fehler' : 'alle',
  knoten: Object.create(null),            // Flow-Detail je Id (Knotenliste)
  lauf: null,                             // { id, d, fehler } gewaehlter Lauf
  busy: false,
};

// Liste, Laeufe und offene Fehlerkarten; ein Fehler laesst den alten Stand stehen.
function fxLade() {
  if (fx.laedt) return;
  fx.laedt = true;
  const vorher = JSON.stringify([fx.flows, fx.jira, fx.versand, fx.laeufe, fx.karten]);
  Promise.all([hole('/api/flows'), hole('/api/flows/laeufe'), hole('/api/freigaben?status=offen')]).then(([f, l, k]) => {
    fx.flows = f.flows; fx.jira = f.jira; fx.versand = f.versand || null; fx.laeufe = l.laeufe; fx.karten = (k.freigaben || []).filter((x) => x.art === 'flow_fehler'); fx.fehler = null;
  }, (e) => { if (!fx.flows) fx.fehler = e.grund || e.message; else console.error('/api/flows:', e.message); })
    .then(() => {
      fx.laedt = false;
      if (route().name !== 'flows') return;
      if (JSON.stringify([fx.flows, fx.jira, fx.versand, fx.laeufe, fx.karten]) !== vorher) zeichneAnsicht();
      if (fx.lauf && fx.lauf.d && fx.lauf.d.status === 'laeuft') fxLaufLade(fx.lauf.id);
    });
}
function fxLaufLade(id) {
  fx.lauf = fx.lauf && fx.lauf.id === id ? fx.lauf : { id, d: null, fehler: null };
  hole('/api/flows/lauf/' + id).then((d) => { if (fx.lauf.id === id) { fx.lauf.d = d; fx.lauf.fehler = null; } },
    (e) => { if (fx.lauf.id === id && !fx.lauf.d) fx.lauf.fehler = e.status === 404 ? uebersetze('Lauf nicht gefunden.') : (e.grund || e.message); })
    .then(() => { if (fx.lauf && fx.lauf.id === id && route().name === 'flows') zeichneAnsicht(); });
}
function fxKnotenLade(id) {
  if (fx.knoten[id]) return;
  fx.knoten[id] = { laedt: true };
  hole('/api/flows/' + id).then((d) => { fx.knoten[id] = d; }, (e) => { delete fx.knoten[id]; console.error('/api/flows/' + id + ':', e.message); })
    .then(() => { if (route().name === 'flows') zeichneAnsicht(); });
}

const FX_ART = { rechnung_ueberfaellig: 'Rechnung überfällig', angebot_laeuft_ab: 'Angebot läuft ab', jira_status: 'Jira-Statuswechsel' };
const FX_TYP = { trigger: 'Auslöser', cond: 'Bedingung', action: 'Aktion' };
const FX_AKTION = { mahnung_senden: 'Sendet das Schreiben der fälligen Mahnstufe (Zahlungserinnerung, 1. oder 2. Mahnung)',
  angebot_nachfassen: 'Sendet die Nachfass-Mail mit dem Angebots-PDF', rechnung_entwurf: 'Legt einen Rechnungsentwurf unter „Braucht dich“ an' };
const FX_OP = { gleich: '=', ungleich: '≠', groesser: '>' };
// {wann} = Versandzeit vom Server (/api/flows versand), gilt fuer alle Flows.
const FX_INFO = { rechnung_ueberfaellig: 'Der Scan läuft {wann} und prüft alle offenen Rechnungen. Für jede, bei der eine Mahnstufe fällig ist, geht das Schreiben raus; eine Rechnung in Mahnpause wird übersprungen. Steht unter E-Mail & Versand eine Testmodus-Adresse, gehen die Schreiben nur dorthin. Die Tagesgrenze begrenzt, wie viele am Tag rausgehen; der Rest folgt beim nächsten Scan. Uhrzeit und Wochenende stellst du unter Einstellungen → Flows ein. Der Aufbau lässt sich hier nicht ändern.',
  angebot_laeuft_ab: 'Der Scan läuft {wann} und prüft alle offenen Angebote. Kurz vor Ablauf der Gültigkeit geht einmal eine Nachfass-Mail mit dem Angebots-PDF raus. Den Abstand stellst du unter Einstellungen → Nachfassen ein, Uhrzeit und Wochenende unter Einstellungen → Flows. Steht unter E-Mail & Versand eine Testmodus-Adresse, geht die Mail nur dorthin. Der Aufbau lässt sich hier nicht ändern.',
  jira_status: 'Reagiert auf jeden Vorgang, der in Jira auf „erledigt“ wechselt, und legt dazu einen Rechnungsentwurf unter „Braucht dich“ an. Gesendet wird nichts. Der Flow braucht Jira (jira.enabled in config.json). Der Aufbau lässt sich hier nicht ändern.' };
const FX_STATUS = { ok: 'ok', warn: 'Warnung', err: 'Fehler', skip: 'übersprungen', laeuft: 'läuft', uebernommen: 'aus Original übernommen' };

const FX_SCAN = ['rechnung_ueberfaellig', 'angebot_laeuft_ab'];   // Ausloeser des Tages-Scans; nur sie haben "Jetzt ausführen"
const fxWann = () => { const v = fx.versand || { ab_stunde: 9, wochenende: false }; return fuelle(v.wochenende ? 'täglich ab {h} Uhr' : 'werktags ab {h} Uhr', { h: v.ab_stunde }); };
const fxFlow = (id) => (fx.flows || []).find((f) => f.id === id) || null;
const fxAusloeserArt = (f) => { try { return JSON.parse(f.ausloeser_json).art; } catch { return null; } };
// Ohne Jira laesst sich der Statuswechsel-Flow nicht scharfschalten. Das Flag kommt vom Server (/api/flows, jira.enabled); der 409 beim Schalten bleibt die Sperre.
const fxGesperrt = (f) => fxAusloeserArt(f) === 'jira_status' && fx.jira === false;
const fxKartenVon = (flowId) => fx.karten.filter((k) => k.quelle === 'flow:' + flowId);
const fxName = (id) => { const f = fxFlow(id); return f ? uebersetze(f.titel) : '#' + id; };
const fxZeit = (iso) => (iso ? new Date(iso).toLocaleString(istDE() ? 'de-DE' : 'en-US', { dateStyle: 'short', timeStyle: 'medium' }) : '–');
function fxDauer(start, ende) {
  const ms = Date.parse(ende) - Date.parse(start);
  if (!Number.isFinite(ms) || ms < 0) return '–';
  return ms < 1000 ? '<1 s' : ms < 60000 ? Math.round(ms / 1000) + ' s' : Math.round(ms / 60000) + ' min';
}
const fxStPille = (s) => '<span class="pille ' + (s === 'ok' ? 'ok' : s === 'warn' ? 'warn' : s === 'err' ? 'bad' : '') + '">' + esc(uebersetze(FX_STATUS[s] || s)) + '</span>';
const fxPunkt = (s) => '<span class="fx-st fx-st-' + esc(s) + '" role="img" aria-label="' + esc(uebersetze(FX_STATUS[s] || s)) + '"></span>';
const fxZaehlLaeufe = (id) => { const n = (fx.laeufe || []).filter((l) => l.flow_id === id).length; return n >= 200 ? uebersetze('200+ Läufe') : n === 1 ? uebersetze('1 Lauf') : fuelle('{n} Läufe', { n }); };

/* ---------- Route ---------- */
// #/flows/<id>  #/flows/<id>/laeufe[/<lauf>]  #/flows/alle[/<lauf>]  #/flows/lauf/<lauf> (aus Karten: springt in den Flow des Laufs)
function fxRoute(teile) {
  const [a, b, c] = teile;
  if (a === 'lauf' && /^\d+$/.test(b || '')) { fx.sprung = Number(b); return; }
  if (a === 'alle') { Object.assign(fx, { flowId: 'alle', tab: 'laeufe', laufId: /^\d+$/.test(b || '') ? Number(b) : null }); return; }
  if (/^\d+$/.test(a || '')) {
    Object.assign(fx, { flowId: Number(a), tab: b === 'laeufe' ? 'laeufe' : 'aufbau', laufId: b === 'laeufe' && /^\d+$/.test(c || '') ? Number(c) : null });
    return;
  }
  if (!teile.length && fx.flowId === null && fx.flows && fx.flows.length) Object.assign(fx, { flowId: fx.flows[0].id, tab: 'aufbau', laufId: null });
}
const fxLink = (flowId, tab, laufId) => '#/flows/' + (flowId === 'alle' ? 'alle' + (laufId ? '/' + laufId : '') : flowId + (tab === 'laeufe' ? '/laeufe' + (laufId ? '/' + laufId : '') : ''));

/* ---------- Zeichnen ---------- */
function fxListe() {
  const offen = fx.karten.length;
  return '<nav class="fx-zeilen" aria-label="' + esc(uebersetze('Flows')) + '">' +
    '<a class="fx-zeile" href="#/flows/alle"' + (fx.flowId === 'alle' ? ' aria-current="page"' : '') + '><span class="t">' + esc(uebersetze('Alle Läufe')) + '</span>' +
      (offen ? '<span class="pille bad" title="' + esc(uebersetze('offene Fehlerkarten unter „Braucht dich“')) + '">' + esc(offen === 1 ? uebersetze('1 Fehler') : fuelle('{n} Fehler', { n: offen })) + '</span>' : '') + '</a>' +
    '<div class="fx-gruppe">' + esc(uebersetze('Flows')) + '</div>' +
    fx.flows.map((f) => '<a class="fx-zeile" href="#/flows/' + f.id + '"' + (fx.flowId === f.id ? ' aria-current="page"' : '') + '>' +
      '<span class="fx-punkt' + (f.aktiv ? ' an' : '') + '" role="img" aria-label="' + esc(uebersetze(f.aktiv ? 'aktiv' : 'pausiert')) + '"></span>' +
      '<span class="t">' + esc(uebersetze(f.titel)) + '</span>' +
      '<span class="s">' + esc(uebersetze(FX_ART[fxAusloeserArt(f)] || 'Auslöser')) + ' · ' + esc(fxZaehlLaeufe(f.id)) + '</span></a>').join('') + '</nav>';
}

function fxKopf(f) {
  if (fx.flowId === 'alle') {
    const n = (fx.laeufe || []).length;
    return '<header class="fx-kopf"><h2>' + esc(uebersetze('Alle Läufe')) + '</h2><span class="fx-meta mono">' + esc(n >= 200 ? uebersetze('200+ Läufe') : n === 1 ? uebersetze('1 Lauf') : fuelle('{n} Läufe', { n })) + '</span></header>';
  }
  const k = fx.knoten[f.id];
  const schritte = k && k.knoten ? k.knoten.length : null;
  const gesperrt = fxGesperrt(f);
  const art = fxAusloeserArt(f);
  const jetzt = !!f.aktiv && FX_SCAN.includes(art);   // nur ein aktiver Scan-Flow; der Server prueft es noch einmal (409)
  const fehler = fxKartenVon(f.id).length;
  const spiel = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>';
  const sw = '<div class="segment" role="group" aria-label="' + esc(uebersetze('Ansicht')) + '">' +
    '<button type="button" data-aktion="fx-tab" data-wert="aufbau" aria-pressed="' + (fx.tab === 'aufbau') + '">' + esc(uebersetze('Aufbau')) + '</button>' +
    '<button type="button" data-aktion="fx-tab" data-wert="laeufe" aria-pressed="' + (fx.tab === 'laeufe') + '">' + esc(uebersetze('Läufe')) +
      (fehler ? ' <span class="fx-zahl" title="' + esc(uebersetze('offene Fehlerkarten unter „Braucht dich“')) + '">' + fehler + '</span>' : '') + '</button></div>';
  return '<header class="fx-kopf"><h2>' + esc(uebersetze(f.titel)) + '</h2>' +
    '<button type="button" class="kippschalter" role="switch" data-aktion="fx-aktiv" aria-checked="' + (!!f.aktiv) + '"' + (gesperrt ? ' disabled aria-describedby="fx-sperre"' : '') + '>' +
      '<span class="spur" aria-hidden="true"></span><span>' + esc(uebersetze(f.aktiv ? 'aktiv' : 'pausiert')) + '</span></button>' +
    (schritte ? '<span class="fx-meta mono">' + esc(schritte === 1 ? uebersetze('1 Schritt') : fuelle('{n} Schritte', { n: schritte })) + '</span>' : '') +
    '<span class="fx-platz"></span>' + sw +
    '<span class="fx-test"><button type="button" class="knopf klein" data-aktion="fx-test"' + (fx.busy ? ' disabled' : '') + '>' + spiel +
      esc(uebersetze(fx.busy ? 'Testlauf …' : 'Testlauf')) + '</button>' + infoI('fx-test') + '</span>' +
    (jetzt ? '<span class="fx-test"><button type="button" class="knopf klein" data-aktion="fx-jetzt"' + (fx.busy ? ' disabled' : '') + '>' + spiel +
      esc(uebersetze(fx.busy ? 'Jetzt ausführen …' : 'Jetzt ausführen')) + '</button>' + infoI('fx-jetzt') + '</span>' : '') + '</header>' +
    infoText('fx-test', 'Probelauf mit dem ersten echten Fall: es wird nichts gesendet oder angelegt, der Lauf erscheint mit dem Zusatz „Test“.') +
    (jetzt ? infoText('fx-jetzt', 'Führt den Scan dieses Flows sofort aus, ohne auf Wochentag und Uhrzeit zu warten. Was heute schon lief, geht kein zweites Mal raus, auch nicht beim täglichen Scan. Tagesgrenze und Testmodus gelten wie beim Scan.') : '') +
    (gesperrt ? '<p class="fx-sperre faint" id="fx-sperre">' + esc(uebersetze('Jira ist nicht eingeschaltet (jira.enabled in config.json). Dieser Flow reagiert auf Statuswechsel in Jira und lässt sich erst danach aktivieren.')) + '</p>' : '');
}

// Knoten in Lauf-Reihenfolge ab dem Ausloeser: der Flow ist ein Baum aus ja/nein/weiter, keine Zeichnung noetig.
function fxReihenfolge(knoten) {
  const von = new Map(knoten.map((k) => [k.id, k]));
  const start = knoten.find((k) => k.typ === 'trigger') || knoten[0];
  const aus = [], gesehen = new Set(), wartend = start ? [start] : [];
  while (wartend.length) {
    const k = wartend.shift();
    if (gesehen.has(k.id)) continue;
    gesehen.add(k.id); aus.push(k);
    for (const z of Object.values(k.outs || {})) if (von.has(z)) wartend.push(von.get(z));
  }
  for (const k of knoten) if (!gesehen.has(k.id)) aus.push(k);
  return aus;
}
function fxSchrittSub(k) {
  const p = k.parameter || {};
  if (k.typ === 'trigger') return esc(uebersetze(FX_ART[p.art] || String(p.art || '')));
  if (k.typ === 'cond') return '<span class="mono">' + esc(p.feld) + ' ' + esc(p.op === 'gesetzt' ? uebersetze('ist gesetzt') : (FX_OP[p.op] || p.op) + ' ' + p.wert) + '</span>';
  return esc(uebersetze(FX_AKTION[p.aktion] || String(p.aktion || '')));
}
function fxAufbau(f) {
  const k = fx.knoten[f.id];
  if (!k) { fxKnotenLade(f.id); return '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>'; }
  if (!k.knoten) return '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>';
  const reihe = fxReihenfolge(k.knoten);
  const nr = new Map(reihe.map((x, i) => [x.id, i + 1]));
  const letzte = (fx.laeufe || []).filter((l) => l.flow_id === f.id).slice(0, 3);
  const art = fxAusloeserArt(f);
  return '<div class="fx-aufbau"><div class="fx-titelzeile"><span class="ueberzeile">' + esc(uebersetze('Schritte')) + '</span>' + infoI('fx-aufbau') + '</div>' +
    infoText('fx-aufbau', FX_INFO[art] ? fuelle(FX_INFO[art], { wann: fxWann() }) : FX_INFO.jira_status) +
    '<ol class="fx-schritte">' + reihe.map((s) => {
      const ports = s.typ === 'cond' ? ['ja', 'nein'] : Object.keys(s.outs || {});
      const aus = ports.map((p) => esc(uebersetze(p === 'weiter' ? 'dann' : p)) + ' → ' + (s.outs && nr.get(s.outs[p]) ? esc(fuelle('Schritt {n}', { n: nr.get(s.outs[p]) })) : esc(uebersetze('Lauf endet')))).join(' · ') ||
        esc(uebersetze('danach Ende'));
      return '<li class="fx-schritt fx-typ-' + esc(s.typ) + '"><span class="fx-nr mono">' + nr.get(s.id) + '</span><div class="fx-text">' +
        '<span class="fx-art">' + esc(uebersetze(FX_TYP[s.typ] || s.typ)) + '</span><span class="fx-st-titel">' + esc(uebersetze(s.titel || '')) + '</span>' +
        '<span class="fx-sub">' + fxSchrittSub(s) + '</span><span class="fx-aus mono">' + aus + '</span></div></li>';
    }).join('') + '</ol>' +
    '<div class="fx-letzte"><div class="fx-titelzeile"><span class="ueberzeile">' + esc(uebersetze('Letzte Läufe')) + '</span></div>' +
      (letzte.length ? letzte.map((l) => fxLaufZeile(l, false)).join('') : '<p class="faint">' + esc(uebersetze('Ein Flow läuft nach dem Scharfschalten von selbst. Mit „Testlauf“ siehst du vorher, was er täte — es wird nichts gesendet.')) + '</p>') +
      '<a class="fx-alle" href="' + fxLink(f.id, 'laeufe') + '">' + esc(uebersetze('Alle Läufe und Fehler')) + ' →</a></div></div>';
}

function fxLaufZeile(l, mitFlow) {
  const warn = l.status === 'err' || l.status === 'warn';
  return '<a class="fx-lauf' + (warn ? ' ' + l.status : '') + '" href="' + fxLink(fx.flowId === 'alle' ? 'alle' : l.flow_id, 'laeufe', l.id) + '"' + (fx.laufId === l.id ? ' aria-current="page"' : '') + '>' +
    fxPunkt(l.status) + '<span class="t">' + esc(fxServer(l.betreff) || uebersetze(fxName(l.flow_id))) + (l.test ? ' <span class="pille">' + esc(uebersetze('Test')) + '</span>' : '') + '</span>' +
    '<span class="z mono" title="' + esc(fxZeit(l.start)) + '">' + esc(vor(l.start)) + '</span>' +
    '<span class="q mono">' + (mitFlow ? esc(fxName(l.flow_id)) + ' · ' : '') + esc(l.ende ? fxDauer(l.start, l.ende) : uebersetze('läuft')) + '</span>' +
    (l.fehler ? '<span class="f">' + esc(fxServer(l.fehler)) + '</span>' : '') + '</a>';
}

function fxLaeufe() {
  let alle = (fx.laeufe || []).filter((l) => fx.flowId === 'alle' || l.flow_id === fx.flowId);
  if (fx.filter === 'fehler') alle = alle.filter((l) => l.status === 'err' || l.status === 'warn');
  const liste = alle.length ? alle.map((l) => fxLaufZeile(l, fx.flowId === 'alle')).join('')
    : fx.filter === 'fehler' ? leer('liste', 'Keine Fehler oder Warnungen', 'Alle Läufe sind sauber durchgelaufen.')
      : leer('liste', 'Noch keine Läufe', 'Ein Flow läuft nach dem Scharfschalten von selbst. Mit „Testlauf“ siehst du vorher, was er täte — es wird nichts gesendet.');
  return '<div class="fx-laeufe"><div class="fx-lliste"><div class="fx-filter">' +
      segment('fx-filter', [['alle', 'Alle'], ['fehler', 'Fehler und Warnungen']], fx.filter, 'Filter') + '</div><div class="fx-lzeilen">' + liste + '</div></div>' +
    '<div class="fx-detail" id="fx-detail">' + fxDetail() + '</div></div>';
}

// Die offene Fehlerkarte dieses Laufs, falls es sie gibt (Wiederholen laeuft dann ueber die Karte und schliesst sie).
// Eine Karte je Beleg (Bezug rechnung:/angebot:/vorgang:), sie nennt den Lauf in der Nutzlast.
const fxKarteZu = (l) => fx.karten.find((k) => k.nutzlast && k.nutzlast.lauf_id === l.id);
function fxDetail() {
  if (!fx.laufId) return leer('liste', 'Kein Lauf gewählt', 'Links einen Lauf öffnen.');
  const L = fx.lauf && fx.lauf.id === fx.laufId ? fx.lauf : null;
  if (!L || !L.d) return '<div class="leer">' + esc(L && L.fehler ? L.fehler : uebersetze('Lauf lädt …')) + '</div>';
  const l = L.d;
  const box = l.status === 'err'
    ? '<section class="fx-fehlerbox" role="alert"><span class="fx-fkopf">' + esc(fuelle('Fehler in Schritt {n}', { n: l.fehler_schritt })) + '</span><p class="mono">' + esc(fxServer(l.fehler)) + '</p>' +
      // Ob wiederholt werden darf, entscheidet der Server (wiederholbar, kein_retry): Mail ging raus oder schon ein Nachfolger.
      (l.kein_retry ? '<p class="faint">' + esc(uebersetze('Die Mail ist vermutlich raus. Nicht erneut senden: im Gesendet-Ordner und unter Gesendet in c2invoice prüfen. Die Karte unter „Braucht dich“ bestätigt nur.')) + '</p>'
        : !l.wiederholbar ? '<p class="faint">' + esc(uebersetze('Dieser Lauf wurde schon wiederholt, der neuere Lauf zählt.')) + '</p>' : '') +
      '<div class="fx-knoepfe">' + (!l.wiederholbar ? '' : '<button type="button" class="knopf klein primaer" data-aktion="fx-wdh">' + esc(fuelle('Ab Schritt {n} wiederholen', { n: l.fehler_schritt })) + '</button>') +
        '<button type="button" class="knopf klein" data-aktion="fx-cira">' + esc(uebersetze('Cira fragen')) + '</button></div></section>' : '';
  const meta = [['Start', fxZeit(l.start)], ['Dauer', l.ende ? fxDauer(l.start, l.ende) : uebersetze('läuft')], ['Auslöser', uebersetze(FX_ART[(l.ausloeser && l.ausloeser.art) || (fxFlow(l.flow_id) && fxAusloeserArt(fxFlow(l.flow_id)))] || '–')],
    ['Bezug', l.bezug || '–']];
  return '<article class="fx-artikel"><div class="fx-dkopf">' + fxStPille(l.status) + '<h3>' + esc(fxServer(l.betreff) || uebersetze(fxName(l.flow_id))) + '</h3></div>' +
    '<div class="fx-dsub faint">' + esc(fxName(l.flow_id)) + ' · <span class="mono">#' + l.id + '</span>' +
      (l.wurzel_id && l.wurzel_id !== l.id ? ' · ' + esc(fuelle('Wiederholung von Lauf {n}', { n: l.wurzel_id })) : '') + (l.test ? ' · ' + esc(uebersetze('Testlauf, nichts gesendet')) : '') + '</div>' +
    '<dl class="fx-meta-raster">' + meta.map(([k, v]) => '<dt>' + esc(uebersetze(k)) + '</dt><dd class="mono">' + esc(v) + '</dd>').join('') + '</dl>' + box +
    '<ol class="fx-zeitstrahl" aria-label="' + esc(uebersetze('Schritte')) + '">' + l.schritte.map((s) => fxSchritt(s)).join('') + '</ol></article>';
}
const fxJson = (v) => { if (v === null || v === undefined) return uebersetze('leer'); const t = JSON.stringify(v, null, 2); return t.length > 4000 ? t.slice(0, 4000) + '\n…' : t; };
function fxSchritt(s) {
  return '<li class="fx-ze fx-z-' + esc(s.status) + '"><span class="fx-ze-punkt" aria-hidden="true"></span><div class="fx-ze-text">' +
    '<div class="fx-ze-kopf"><span class="fx-art">' + esc(uebersetze(FX_TYP[s.typ] || s.typ)) + '</span><span class="fx-st-titel">' + esc(uebersetze(s.titel || '')) + '</span>' +
      '<span class="fx-ze-st mono">' + esc(uebersetze(FX_STATUS[s.status] || s.status)) + (s.ms != null ? ' · ' + s.ms + ' ms' : '') + '</span></div>' +
    (s.meldung ? '<span class="fx-meldung mono">' + esc(fxServer(s.meldung)) + '</span>' : '') +
    '<details class="fx-io"><summary>' + esc(uebersetze('Eingang und Ausgang')) + '</summary><div class="fx-io-raster">' +
      '<div><span class="ueberzeile">' + esc(uebersetze('Eingang')) + '</span><pre class="mono">' + esc(fxJson(s.eingang)) + '</pre></div>' +
      '<div><span class="ueberzeile">' + esc(uebersetze('Ausgang')) + '</span><pre class="mono">' + esc(fxJson(s.ausgang)) + '</pre></div></div></details></div></li>';
}

function zeichneFlows(w, teile) {
  fxRoute(teile);
  if (!fx.flows && !fx.fehler) { fxLade(); w.innerHTML = '<div class="leer">' + esc(uebersetze('Lädt …')) + '</div>'; return; }
  if (fx.fehler && !fx.flows) { w.innerHTML = leer('liste', 'Flows nicht geladen', fx.fehler, '<button type="button" class="knopf klein" data-aktion="fx-neu">' + esc(uebersetze('Erneut versuchen')) + '</button>'); return; }
  if (!fx.flows.length) { w.innerHTML = leer('liste', 'Keine Flows', 'Es sind keine Flow-Vorlagen angelegt.'); return; }
  if (fx.sprung) {   // #/flows/lauf/<id>: den Flow des Laufs suchen und dorthin springen
    const id = fx.sprung; fx.sprung = null;
    hole('/api/flows/lauf/' + id).then((d) => { fx.lauf = { id, d, fehler: null }; location.replace(fxLink(d.flow_id, 'laeufe', id)); },
      (e) => { toast(uebersetze('Lauf nicht gefunden.') + ' ' + (e.grund || ''), 'err'); location.replace('#/flows/alle'); });
    w.innerHTML = '<div class="leer">' + esc(uebersetze('Lauf lädt …')) + '</div>';
    return;
  }
  if (fx.flowId !== 'alle' && !fxFlow(fx.flowId)) fx.flowId = fx.flows[0].id;
  if (fx.laufId && (!fx.lauf || fx.lauf.id !== fx.laufId)) fxLaufLade(fx.laufId);
  const f = fx.flowId === 'alle' ? null : fxFlow(fx.flowId);
  if (f) fxKnotenLade(f.id);
  const fv = fokusMerken(w);
  const sc = (s) => (w.querySelector(s) ? w.querySelector(s).scrollTop : 0);
  const gemerkt = { haupt: sc('.fx-body'), liste: sc('.fx-lzeilen'), detail: sc('.fx-detail'), nav: sc('.fx-zeilen') };
  w.innerHTML = '<div class="fx" data-screen-label="' + esc(uebersetze('Flows')) + '"><div class="fx-liste">' + fxListe() + '</div><section class="fx-haupt">' + fxKopf(f) +
    '<div class="fx-body">' + (fx.tab === 'laeufe' ? fxLaeufe() : fxAufbau(f)) + '</div></section></div>';
  const setze = (s, v) => { const e = w.querySelector(s); if (e && v) e.scrollTop = v; };
  setze('.fx-body', gemerkt.haupt); setze('.fx-lzeilen', gemerkt.liste); setze('.fx-detail', gemerkt.detail); setze('.fx-zeilen', gemerkt.nav);
  fokusZurueck(w, fv);
}

/* ---------- Aktionen ---------- */
aktion('fx-neu', () => { fx.fehler = null; fxLade(); });
aktion('fx-tab', (t) => geheZu(fxLink(fx.flowId, t === 'laeufe' ? 'laeufe' : 'aufbau').slice(1)));
aktion('fx-filter', (v) => { fx.filter = v === 'fehler' ? 'fehler' : 'alle'; merke('fx.filter', fx.filter); zeichneAnsicht(); });

async function fxSetzeAktiv(id, an) {
  try {
    await sende('/api/flows/' + id + '/aktiv', { aktiv: an });
    toast(uebersetze(an ? 'Flow ist jetzt aktiv.' : 'Flow ist pausiert.'), 'ok');
  } catch (e) { toast(uebersetze('Flow nicht geschaltet') + ': ' + fxServer(e.message), 'err'); }
  fx.laedt = false; fxLade();
}
const fxDlgKopf = (titel, unter) => '<div class="dialog-kopf"><div><h2>' + esc(uebersetze(titel)) + '</h2><span class="hinweis">' + esc(unter) + '</span></div>' +
  '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>';

// Mehr Kandidaten als heute noch frei (Tagesgrenze aus /api/mail/einstellungen): der Rest folgt beim naechsten Scan.
const fxGrenzText = (n, m) => (m.status && n > m.status.grenze - m.status.heute ? fuelle('Höchstens {g} am Tag (Tagesgrenze), der Rest folgt beim nächsten Scan.', { g: m.status.grenze }) : '');

// Scharfschalten fragt mit der Zahl nach (Spec E5): was morgen frueh rausgeht, soll keine Ueberraschung sein.
aktion('fx-aktiv', async () => {
  const f = fxFlow(fx.flowId);
  if (!f || fxGesperrt(f)) return;
  if (f.aktiv) { await fxSetzeAktiv(f.id, false); return; }
  const grund = dialog(fxDlgKopf('Flow scharfschalten', uebersetze(f.titel)) + '<div class="dialog-text" id="fx-dlg"><div class="leer">' + esc(uebersetze('Lädt …')) + '</div></div>', 'Flow scharfschalten', 480);
  const art = fxAusloeserArt(f);
  let satz, zusatz = '';
  try {
    if (art === 'jira_status') satz = uebersetze('Ab jetzt legt jeder Vorgang, der in Jira auf „erledigt“ wechselt, einen Rechnungsentwurf unter „Braucht dich“ an. Gesendet wird nichts.');
    else {
      const [k, m] = await Promise.all([hole('/api/flows/' + f.id + '/kandidaten'), hole('/api/mail/einstellungen')]);
      const n = k.anzahl, sofort = !!k.scan_sofort, test = m.status && m.status.umgeleitet && m.werte ? m.werte.umleitenAn : '', wann = fxWann();
      satz = !n ? uebersetze('Im Moment ist nichts fällig, es geht nichts raus. Neue Fälle meldet der tägliche Scan.')
        : test ? (n === 1 ? fuelle('Beim nächsten Scan ({wann}) geht 1 Schreiben an die Test-Adresse {a}.', { a: test, wann }) : fuelle('Beim nächsten Scan ({wann}) gehen {n} Schreiben an die Test-Adresse {a}.', { n, a: test, wann }))
          : (n === 1 ? fuelle('Beim nächsten Scan ({wann}) geht 1 Schreiben raus.', { wann }) : fuelle('Beim nächsten Scan ({wann}) gehen {n} Schreiben raus.', { n, wann }));
      // Vom Server: lief der Tagesscan heute noch nicht, geht der Versand binnen einer Minute los.
      if (n && sofort) zusatz = uebersetze('Der Scan von heute ist noch nicht gelaufen. Das kann innerhalb einer Minute passieren.');
      const g = fxGrenzText(n, m);
      if (g) zusatz = (zusatz ? zusatz + ' ' : '') + g;
    }
  } catch (e) { const d = grund.querySelector('#fx-dlg'); if (d) d.innerHTML = '<p class="dialog-fehler" role="alert"></p>'; if (d) d.firstChild.textContent = e.message; return; }
  const d = grund.querySelector('#fx-dlg');
  if (!d) return;
  d.innerHTML = '<p class="fx-frage"></p>' + (zusatz ? '<p class="faint fx-zusatz"></p>' : '') +
    '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
    '<button type="button" class="knopf primaer" data-aktion="fx-aktiv-ja" data-wert="' + f.id + '" autofocus>' + esc(uebersetze('Scharfschalten')) + '</button></div>';
  d.querySelector('.fx-frage').textContent = satz;
  if (zusatz) d.querySelector('.fx-zusatz').textContent = zusatz;
  d.querySelector('[autofocus]').focus();
});
aktion('fx-aktiv-ja', async (id, el) => { await mitLauf(el, () => fxSetzeAktiv(Number(id), true)); schliesseDialog(); });

// "Jetzt ausführen": Rueckfrage mit der Zahl aus /kandidaten (was der Server gleich sendet), bei 0 nur ein Hinweis.
aktion('fx-jetzt', async () => {
  const f = fxFlow(fx.flowId);
  if (!f || !f.aktiv || fx.busy || !FX_SCAN.includes(fxAusloeserArt(f))) return;
  const grund = dialog(fxDlgKopf('Jetzt ausführen', uebersetze(f.titel)) + '<div class="dialog-text" id="fx-dlg"><div class="leer">' + esc(uebersetze('Lädt …')) + '</div></div>', 'Jetzt ausführen', 480);
  let k, m;
  try { [k, m] = await Promise.all([hole('/api/flows/' + f.id + '/kandidaten'), hole('/api/mail/einstellungen')]); } catch (e) {
    const d = grund.querySelector('#fx-dlg'); if (d) { d.innerHTML = '<p class="dialog-fehler" role="alert"></p>'; d.firstChild.textContent = e.message; } return;
  }
  const d = grund.querySelector('#fx-dlg');
  if (!d) return;
  const n = k.anzahl, test = m.status && m.status.umgeleitet && m.werte ? m.werte.umleitenAn : '';
  const satz = !n ? uebersetze('Im Moment ist nichts fällig, es geht nichts raus.')
    : test ? (n === 1 ? fuelle('Jetzt geht 1 Schreiben an die Test-Adresse {a}.', { a: test }) : fuelle('Jetzt gehen {n} Schreiben an die Test-Adresse {a}.', { n, a: test }))
      : (n === 1 ? uebersetze('Jetzt geht 1 Schreiben raus.') : fuelle('Jetzt gehen {n} Schreiben raus.', { n }));
  const zusatz = n ? fxGrenzText(n, m) : '';
  d.innerHTML = '<p class="fx-frage"></p>' + (zusatz ? '<p class="faint fx-zusatz"></p>' : '') + '<div class="dialog-fuss">' +
    (n ? '<button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
      '<button type="button" class="knopf primaer" data-aktion="fx-jetzt-ja" data-wert="' + f.id + '" autofocus>' + esc(uebersetze('Jetzt ausführen')) + '</button>'
      : '<button type="button" class="knopf" data-aktion="dialog-zu" autofocus>' + esc(uebersetze('Schließen')) + '</button>') + '</div>';
  d.querySelector('.fx-frage').textContent = satz;
  if (zusatz) d.querySelector('.fx-zusatz').textContent = zusatz;
  d.querySelector('[autofocus]').focus();
});
// Nur der POST entscheidet ueber "Nicht ausgeführt"; scheitert danach das Nachladen, ist trotzdem gesendet worden.
async function fxJetztStart(id) {
  fx.busy = true; zeichneAnsicht();
  let r;
  try { r = await sende('/api/flows/' + id + '/jetzt', {}); } catch (e) {
    fx.busy = false; toast(uebersetze('Nicht ausgeführt') + ': ' + fxServer(e.message), 'err'); zeichneAnsicht(); return;
  }
  fx.busy = false;
  toast(r.gestartet === 1 ? uebersetze('1 Lauf gestartet') : fuelle('{n} Läufe gestartet', { n: r.gestartet }), 'ok');
  geheZu(fxLink(id, 'laeufe').slice(1));
  fx.laedt = false; fxLade();   // Laeufe und Fehlerkarten; ein Fehler dort laesst den alten Stand stehen (fxLade)
}
aktion('fx-jetzt-ja', async (id, el) => { await mitLauf(el, () => fxJetztStart(Number(id))); schliesseDialog(); });

async function fxTestStart(id, vorgang) {
  fx.busy = true; zeichneAnsicht();
  try {
    const r = await sende('/api/flows/' + id + '/test', vorgang ? { vorgang } : {});
    toast(fuelle('Testlauf beendet: {s}', { s: uebersetze(FX_STATUS[r.status] || r.status) }), r.status === 'err' ? 'err' : 'ok');
    fx.laeufe = (await hole('/api/flows/laeufe')).laeufe;
    fx.busy = false;
    geheZu(fxLink(id, 'laeufe', r.id).slice(1));
  } catch (e) { fx.busy = false; toast(uebersetze('Testlauf fehlgeschlagen') + ': ' + fxServer(e.message), 'err'); zeichneAnsicht(); }
}
aktion('fx-test', () => {
  const f = fxFlow(fx.flowId);
  if (!f || fx.busy) return;
  if (fxAusloeserArt(f) !== 'jira_status') { fxTestStart(f.id); return; }
  // Der Statuswechsel-Flow hat keine Kandidaten aus dem Scan: der Probelauf braucht einen Vorgang.
  const grund = dialog(fxDlgKopf('Probelauf für Vorgang', uebersetze(f.titel)) +
    '<form id="fx-test-form" class="dialog-text"><label for="fx-vorgang">' + esc(uebersetze('Vorgang (z. B. ABC-12)')) + '</label>' +
    '<input class="eingabe mono" id="fx-vorgang" maxlength="40" pattern="[A-Za-z0-9_\\-]{1,40}" required autofocus><p class="faint">' + esc(uebersetze('Der Probelauf legt nichts an und sendet nichts.')) + '</p>' +
    '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
    '<button type="submit" class="knopf primaer">' + esc(uebersetze('Testlauf')) + '</button></div></form>', 'Probelauf für Vorgang', 420);
  grund.querySelector('#fx-test-form').addEventListener('submit', (ev) => { ev.preventDefault(); const v = grund.querySelector('#fx-vorgang').value.trim(); schliesseDialog(); fxTestStart(f.id, v); });
});

// Wiederholen: gibt es die offene Fehlerkarte zu diesem Lauf, laeuft es ueber sie (die Karte schliesst sich); sonst direkt ueber den Lauf.
aktion('fx-wdh', async (w, el) => {
  const l = fx.lauf && fx.lauf.d;
  if (!l || !l.wiederholbar) return;
  await mitLauf(el, async () => {
    try {
      const karte = fxKarteZu(l);
      let neu;
      if (karte && !karte.nutzlast.kein_retry) {
        const r = await sende('/api/freigaben/' + encodeURIComponent(karte.id) + '/entscheide', { wahl: 'ok' });
        neu = { id: r.freigabe && r.freigabe.ergebnis && r.freigabe.ergebnis.lauf_id, status: '' };
      } else neu = await sende('/api/flows/lauf/' + l.id + '/wiederholen', { ab_schritt: l.fehler_schritt });
      toast(neu.status ? fuelle('Wiederholt im Lauf {n}: {s}', { n: neu.id, s: uebersetze(FX_STATUS[neu.status] || neu.status) }) : fuelle('Wiederholt im Lauf {n}: {s}', { n: neu.id, s: '…' }), neu.status === 'err' ? 'err' : 'ok');
      const [ls, k] = await Promise.all([hole('/api/flows/laeufe'), hole('/api/freigaben?status=offen')]);
      fx.laeufe = ls.laeufe; fx.karten = (k.freigaben || []).filter((x) => x.art === 'flow_fehler');
      if (neu.id) geheZu(fxLink(fx.flowId, 'laeufe', neu.id).slice(1)); else zeichneAnsicht();
    } catch (e) { toast(uebersetze('Wiederholen fehlgeschlagen') + ': ' + fxServer(e.message), 'err'); }
  });
});
aktion('fx-cira', () => {
  const l = fx.lauf && fx.lauf.d;
  if (!l) return;
  oeffneDock(true);
  frageCira(fuelle('Warum ist der Flow-Lauf {id} („{flow}“) bei Schritt {n} gescheitert: {fehler}? Was soll ich tun?', { id: l.id, flow: fxName(l.flow_id), n: l.fehler_schritt, fehler: l.fehler || '' }));
});

registriere('flows', {
  zeichne: zeichneFlows,
  live() { if (route().name === 'flows') fxLade(); },
});
