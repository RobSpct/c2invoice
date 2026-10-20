'use strict';
// Schreibt die Kennzahlen automatisch an die Jira-Vorgaenge.
// Je Ticket entsteht genau EIN Kommentar, der bei spaeteren Laeufen
// aktualisiert wird. So bleibt die Historie am Ticket lesbar statt zugespammt.
const crypto = require('node:crypto');
const config = require('./config.json');
const metrics = require('./metrics');

// Die Marker stammen aus der Zeit vor der Umbenennung und bleiben so. An
// ihnen erkennt der naechste Lauf den eigenen Kommentar wieder. Wer sie
// aendert, findet jeden bereits geschriebenen Kommentar nicht mehr und haengt
// einen zweiten daneben - genau das, was diese Datei verhindern soll.
const MARKER = 'token-ledger:auto';
// Eigener Marker fuer Tickets, zu denen es keine Rohdaten mehr gibt. Ohne
// diesen Hinweis am Ticket sieht ein leeres Feld nach "kostete nichts" aus.
const MARKER_NODATA = 'token-ledger:no-data';

// Der Token steht bei laufendem Dienst nicht in der Umgebung, weil die
// geplante Aufgabe ohne Doppler startet. Deshalb notfalls einmalig aus
// Doppler nachladen und fuer die Prozesslaufzeit merken.
let tokenCache = null;

function holeToken() {
  const direkt = process.env[config.jira.tokenEnvVar] || process.env.JIRA_API_TOKEN;
  if (direkt) return direkt;
  if (tokenCache !== null) return tokenCache;

  const d = config.jira.doppler;
  if (!d || !d.project || !d.config || !d.secret) {
    tokenCache = '';
    return '';
  }
  try {
    const { execFileSync } = require('node:child_process');
    tokenCache = execFileSync('doppler', [
      'secrets', 'get', d.secret, '--project', d.project, '--config', d.config, '--plain',
    ], { encoding: 'utf8', timeout: 15000, windowsHide: true }).trim();
  } catch {
    // Doppler nicht verfuegbar oder nicht angemeldet: Abgleich bleibt aus.
    tokenCache = '';
  }
  return tokenCache;
}

function auth() {
  const token = holeToken();
  const email = config.jira.email || process.env.JIRA_EMAIL;
  if (!token || !email) return null;
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

function fmtInt(n) {
  return Math.round(n || 0).toLocaleString('de-DE');
}

function fmtMoney(n, cur) {
  return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + cur;
}

function fmtHours(sec) {
  const h = (sec || 0) / 3600;
  return h.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' h';
}

// Aenderungen erkennen, ohne jedes Mal zu schreiben: nur wenn sich die
// gerundeten Kennzahlen bewegt haben, geht ein Aufruf an Jira raus.
function fingerprint(t) {
  return [
    t.requests,
    Math.round((t.gesamt_tokens || t.total_tokens) / 1000),
    Math.round(t.api_gegenwert_usd * 100),
    Math.round(t.active_seconds / 60),
    // Ohne den Satz bliebe ein nachtraeglich geaenderter Rabatt unbemerkt und
    // der Kommentar wiese weiter den alten Arbeitswert aus.
    Math.round((t.stundensatz || 0) * 100),
    // Der Fusstext nennt das Zeitmodell. Aendert es sich bei gleicher Zeit
    // (Altbestand ohne Eingabe-Kennung), stuende sonst der alte Satz da.
    t.zeitmodell,
    // Manuelle Zeit steht im Kommentar und im Arbeitswert; ein neuer oder
    // geaenderter Eintrag muss den Kommentar erneuern. Ohne Eintraege bleibt
    // der Fingerabdruck wie bisher, damit nicht jeder Kommentar neu geschrieben wird.
    ...(t.manuell_seconds ? [Math.round(t.manuell_seconds / 60), Math.round((t.arbeitswert_manuell || 0) * 100)] : []),
  ].join('|');
}

// Jira erwartet das Dokumentformat ADF, kein Markdown.
function buildComment(t, models) {
  const modelLines = models
    .filter((m) => m.requests > 0)
    .map((m) => `${m.model}: ${fmtInt(m.total_tokens)} Tokens, ${fmtMoney(m.cost_usd, 'USD')}`);

  // Ausgewiesen wird die Abrechnungssumme: eigentliche Arbeit plus die
  // Werkzeuge (etwa claude-mem), die waehrend dieser Arbeit mitliefen.
  const eigeneKosten = (t.api_gegenwert_usd || 0) - (t.werkzeug_cost_usd || 0);
  const rows = [
    ['Zeitraum', `${t.first_day} bis ${t.last_day}`],
    ['Sitzungen / Aufrufe', `${fmtInt(t.sessions)} / ${fmtInt(t.requests)}`],
    ['Tokens gesamt', fmtInt(t.gesamt_tokens || t.total_tokens)],
    ['davon Arbeitssitzung', fmtInt(t.total_tokens)],
    ['davon Werkzeuge', `${fmtInt(t.werkzeug_tokens)} (${fmtInt(t.werkzeug_requests)} Aufrufe)`],
    ['Aktive Arbeitszeit', fmtHours(t.active_seconds)],
    // Der Arbeitswert unten enthaelt sie; ohne diese Zeile passten Zeit und Wert nicht zusammen.
    ...(t.manuell_seconds > 0 ? [['Manuelle Zeit (Zeiterfassung)', fmtHours(t.manuell_seconds)]] : []),
    ['Agentenzeit (nicht berechnet)', fmtHours(t.agent_seconds)],
    ['Stundensatz', fmtMoney(t.stundensatz, config.waehrung) +
      (t.rabatt_prozent > 0
        ? ` (${t.rabatt_prozent.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % Rabatt auf ${fmtMoney(t.stundensatz_standard, config.waehrung)})`
        : '')],
    ['Arbeitswert', fmtMoney(t.arbeitswert, config.waehrung)],
    ['API-Gegenwert gesamt', fmtMoney(t.api_gegenwert_usd, 'USD')],
    ['davon Arbeitssitzung', fmtMoney(eigeneKosten, 'USD')],
    ['davon Werkzeuge', fmtMoney(t.werkzeug_cost_usd, 'USD')],
    ['Anteil Abokosten', fmtMoney(t.abo_anteil_usd, config.aboWaehrung)],
  ];

  const content = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'c2invoice', marks: [{ type: 'strong' }] }],
    },
    {
      type: 'bulletList',
      content: rows.map(([k, v]) => ({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: k + ': ', marks: [{ type: 'strong' }] },
            { type: 'text', text: v },
          ],
        }],
      })),
    },
  ];

  if (modelLines.length) {
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Modelle: ' + modelLines.join(' | ') }],
    });
  }

  content.push({
    type: 'paragraph',
    content: [{
      type: 'text',
      text:
        `Automatisch erstellt (${MARKER}). ` +
        // Das Modell des Vorgangs, nicht der globale Standard: Projekt,
        // Vorgang oder einzelne Sitzungen koennen ihn ueberschreiben.
        (t.zeitmodell === 'aktivitaet'
          ? `Aktivzeit ohne Pausen ueber ${config.gapMinutes} Minuten. `
          : t.zeitmodell === 'gemischt'
            ? 'Arbeitszeit je Sitzung nach eigenem Zeitmodell: teils die Zeit um die eigenen Eingaben, ' +
              `teils jede Aktivitaet ohne Pausen ueber ${config.gapMinutes} Minuten. `
            : `Arbeitszeit ist die Zeit um die eigenen Eingaben (je ${config.gapMinutes / 2} Minuten davor und danach); ` +
              'die Agentenzeit ist die Laufzeit der KI und wird nicht berechnet. ') +
        'Werkzeuge sind Hintergrunddienste (z. B. claude-mem), die waehrend der ' +
        'Arbeit an diesem Ticket mitliefen und ueber ein Zeitfenster zugeordnet werden. ' +
        `Stand: ${new Date().toLocaleString('de-DE')}`,
      marks: [{ type: 'em' }],
    }],
  });

  return { type: 'doc', version: 1, content };
}

async function jiraFetch(pathname, { method = 'GET', body } = {}) {
  const header = auth();
  if (!header) throw new Error('Jira-Zugangsdaten fehlen (E-Mail oder Token)');
  const res = await fetch(config.jira.baseUrl.replace(/\/$/, '') + pathname, {
    method,
    headers: {
      authorization: header,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jira ${method} ${pathname} -> ${res.status} ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

// Findet einen frueher von uns geschriebenen Kommentar wieder, auch wenn die
// gemerkte Kennung fehlt (etwa nach einem Wechsel der Datenbank).
async function findOwnComment(ticket, marker = MARKER) {
  const data = await jiraFetch(`/rest/api/3/issue/${ticket}/comment?maxResults=100&orderBy=-created`);
  const list = (data && data.comments) || [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (JSON.stringify(list[i].body || '').includes(marker)) return list[i].id;
  }
  return null;
}

// Die numerischen Felder sind die Grundlage fuer Auswertungen in Jira:
// nur sie lassen sich filtern und ueber Epics summieren. Der Kommentar
// bleibt als lesbare Zusammenfassung daneben bestehen.
function feldWerte(t) {
  const f = (config.jira && config.jira.felder) || {};
  const werte = {};
  const setz = (id, wert) => {
    if (!id) return;
    const n = Number(wert);
    if (Number.isFinite(n)) werte[id] = Math.round(n * 100) / 100;
  };
  setz(f.kosten_usd, t.api_gegenwert_usd);
  setz(f.tokens, t.gesamt_tokens != null ? t.gesamt_tokens : t.total_tokens);
  // Stunden passend zum Arbeitswert: Claude-Zeit plus abrechenbare manuelle Zeit.
  setz(f.stunden, (t.active_hours || 0) + (t.manuell_hours || 0));
  setz(f.arbeitswert_eur, t.arbeitswert);
  return werte;
}

async function schreibeFelder(ticket, werte) {
  if (Object.keys(werte).length === 0) return 'keine Felder konfiguriert';
  await jiraFetch(`/rest/api/3/issue/${ticket}`, { method: 'PUT', body: { fields: werte } });
  return `${Object.keys(werte).length} Felder`;
}

async function syncTicket(db, ticket, row) {
  const models = metrics.byModel(db, { ticket });
  const body = buildComment(row, models);
  const fp = fingerprint(row);

  const state = db.prepare('SELECT comment_id, fingerprint FROM jira_sync WHERE ticket = ?').get(ticket);
  if (state && state.fingerprint === fp) return { ticket, action: 'unveraendert' };

  // Zuerst die Felder: sie tragen die auswertbaren Zahlen. Schlaegt das fehl,
  // soll auch kein Kommentar entstehen, der etwas anderes behauptet.
  const feldInfo = await schreibeFelder(ticket, feldWerte(row));

  let commentId = state ? state.comment_id : null;
  if (!commentId) commentId = await findOwnComment(ticket);

  let action;
  if (commentId) {
    try {
      await jiraFetch(`/rest/api/3/issue/${ticket}/comment/${commentId}`, { method: 'PUT', body: { body } });
      action = 'aktualisiert';
    } catch (err) {
      // Kommentar geloescht oder nicht mehr erreichbar: neu anlegen.
      const created = await jiraFetch(`/rest/api/3/issue/${ticket}/comment`, { method: 'POST', body: { body } });
      commentId = created.id;
      action = 'neu angelegt';
    }
  } else {
    const created = await jiraFetch(`/rest/api/3/issue/${ticket}/comment`, { method: 'POST', body: { body } });
    commentId = created.id;
    action = 'erstellt';
  }

  db.prepare(`
    INSERT INTO jira_sync (ticket, comment_id, fingerprint, synced_at) VALUES (?,?,?,?)
    ON CONFLICT(ticket) DO UPDATE SET
      comment_id = excluded.comment_id, fingerprint = excluded.fingerprint,
      synced_at = excluded.synced_at
  `).run(ticket, String(commentId), fp, new Date().toISOString());

  return { ticket, action, felder: feldInfo };
}

// Ein Vorgang darf nur dann nach Jira, wenn er dort auch existieren kann.
// Seit Vorgaenge von Hand gebucht werden koennen, stehen frei benannte Namen
// in derselben Spalte wie echte Schluessel — und ein blosses startsWith wuerde
// bei WEBSHOP-RELAUNCH (Schluessel WEBSHOP) einen Jira-Aufruf auf ein Issue
// absetzen, das es nicht gibt. Echte Schluessel enden immer auf einer Zahl.
function istJiraKey(ticket, keys) {
  if (typeof ticket !== 'string') return false;
  return (keys || []).some((k) => {
    const sicher = String(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^' + sicher + '-\\d+$').test(ticket);
  });
}

// dryRun zeigt nur, was passieren wuerde. Nuetzlich beim ersten Einrichten.
async function run({ db, verbose = false, dryRun = false, only = null } = {}) {
  if (!config.jira.enabled) {
    if (verbose) console.log('Jira-Abgleich ist in der Konfiguration ausgeschaltet.');
    return { skipped: true, results: [] };
  }
  if (!auth()) {
    if (verbose) console.log(`Kein Zugang: ${config.jira.tokenEnvVar} oder jira.email fehlt.`);
    return { skipped: true, results: [] };
  }

  const keys = config.jira.projectKeys || [];
  // sessions > 0: ein Vorgang nur aus manueller Zeit ist kein Beleg, dass es
  // das Ticket in Jira gibt — ein vertippter Schluessel bekaeme sonst Kommentare.
  const rows = metrics.byTicket(db).filter((t) =>
    t.sessions > 0 && istJiraKey(t.ticket, keys) && (!only || t.ticket === only)
  );

  const results = [];
  for (const row of rows) {
    if (dryRun) {
      results.push({ ticket: row.ticket, action: 'wuerde schreiben', fingerprint: fingerprint(row) });
      continue;
    }
    try {
      results.push(await syncTicket(db, row.ticket, row));
    } catch (err) {
      results.push({ ticket: row.ticket, action: 'Fehler', error: err.message });
    }
  }

  if (verbose) {
    for (const r of results) {
      console.log(
        `  ${r.ticket}: ${r.action}` +
        (r.felder ? ` (${r.felder})` : '') +
        (r.error ? ' — ' + r.error : '')
      );
    }
    console.log(`${results.length} Ticket(s) verarbeitet.`);
  }
  return { skipped: false, results };
}

// --- Tickets ohne Rohdaten ---------------------------------------------------
// Claude Code raeumt seine Protokolle nach einigen Wochen auf. Fuer alles, was
// vor dem Beginn der Aufzeichnung liegt, gibt es deshalb keine Zahlen mehr und
// wird es auch nie wieder geben. Ein leeres Feld am Ticket liesse sich als
// "hat nichts gekostet" missverstehen, deshalb bekommt es einen Hinweis.

// Reine Mengenlehre, getrennt von HTTP, damit sie pruefbar bleibt.
function ticketsOhneDaten(alleKeys, zeilenMitDaten) {
  const mitDaten = new Set(zeilenMitDaten.map((r) => r.ticket));
  return alleKeys.filter((k) => !mitDaten.has(k));
}

function nodataKommentar(startDatum) {
  return {
    type: 'doc',
    version: 1,
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text:
          'c2invoice: keine Token-Daten vorhanden. Die Arbeit an diesem ' +
          `Vorgang liegt vor Beginn der Aufzeichnung (${startDatum}); die ` +
          'Protokolle von Claude Code waren zu diesem Zeitpunkt bereits ' +
          `aufgeraeumt. (${MARKER_NODATA})`,
        marks: [{ type: 'em' }],
      }],
    }],
  };
}

// Holt alle Vorgangsschluessel der konfigurierten Projekte. Der alte
// Suchendpunkt /rest/api/3/search ist bei Jira Cloud abgeschaltet, der
// Nachfolger blaettert ueber nextPageToken statt ueber startAt.
async function alleTicketKeys(projectKeys) {
  const jql = `project IN (${projectKeys.join(',')}) ORDER BY created ASC`;
  const keys = [];
  let token = null;
  do {
    const q = new URLSearchParams({ jql, fields: 'key', maxResults: '100' });
    if (token) q.set('nextPageToken', token);
    const data = await jiraFetch(`/rest/api/3/search/jql?${q}`);
    for (const issue of data.issues || []) keys.push(issue.key);
    token = data.nextPageToken || null;
  } while (token);
  return keys;
}

async function markiereTicketsOhneDaten({ db, verbose = false, dryRun = false } = {}) {
  if (!config.jira.enabled || !auth()) {
    if (verbose) console.log('Jira-Abgleich ist aus oder ohne Zugang.');
    return { skipped: true, results: [] };
  }

  const startDatum = db.prepare('SELECT MIN(day) AS d FROM events').get().d || 'unbekannt';
  const alle = await alleTicketKeys(config.jira.projectKeys || []);
  const offen = ticketsOhneDaten(alle, metrics.byTicket(db));
  if (verbose) console.log(`${alle.length} Vorgaenge, davon ${offen.length} ohne Token-Daten.`);

  const body = nodataKommentar(startDatum);
  const results = [];
  for (const ticket of offen) {
    if (dryRun) {
      results.push({ ticket, action: 'wuerde markieren' });
      continue;
    }
    try {
      // Schon vermerkt: nichts tun. Der Lauf muss beliebig oft wiederholbar
      // sein, ohne dass Kommentare doppelt entstehen.
      const state = db.prepare('SELECT comment_id FROM jira_sync WHERE ticket = ?').get(ticket);
      if (state) { results.push({ ticket, action: 'bereits vermerkt' }); continue; }

      // Ein echter Ledger-Kommentar hat Vorrang: dann gibt es Daten und der
      // Hinweis waere falsch.
      if (await findOwnComment(ticket, MARKER)) {
        results.push({ ticket, action: 'hat Ledger-Kommentar' });
        continue;
      }

      // Aus einem frueheren Lauf ohne gemerkte Kennung: nur nachtragen.
      let commentId = await findOwnComment(ticket, MARKER_NODATA);
      let action = 'nachgetragen';
      if (!commentId) {
        const created = await jiraFetch(`/rest/api/3/issue/${ticket}/comment`, { method: 'POST', body: { body } });
        commentId = created.id;
        action = 'markiert';
      }
      // fingerprint 'no-data' unterscheidet sich von jedem echten Fingerabdruck.
      // Tauchen spaeter doch Daten auf, ersetzt der normale Abgleich diesen
      // Kommentar von selbst — ohne Sonderbehandlung.
      db.prepare(`
        INSERT INTO jira_sync (ticket, comment_id, fingerprint, synced_at) VALUES (?,?,?,?)
        ON CONFLICT(ticket) DO UPDATE SET
          comment_id = excluded.comment_id, fingerprint = excluded.fingerprint,
          synced_at = excluded.synced_at
      `).run(ticket, String(commentId), 'no-data', new Date().toISOString());
      results.push({ ticket, action });
    } catch (err) {
      results.push({ ticket, action: 'Fehler', error: err.message });
      // Zu viele Anfragen: abbrechen statt weiter gegen die Wand laufen.
      if (/\b429\b/.test(err.message)) {
        if (verbose) console.log('Jira drosselt (429). Abbruch, Rest beim naechsten Lauf.');
        break;
      }
    }
  }

  if (verbose) {
    const zusammen = {};
    for (const r of results) zusammen[r.action] = (zusammen[r.action] || 0) + 1;
    for (const [a, n] of Object.entries(zusammen)) console.log(`  ${a}: ${n}`);
    for (const r of results.filter((x) => x.error)) console.log(`  ${r.ticket}: ${r.error}`);
  }
  return { skipped: false, results };
}

// --- Lesen fuers Board (C7a) -------------------------------------------------
// Jira ist die Wahrheit, sobald es im Spiel ist (Owner 20.10.). Gelesen wird
// nur auf Anfrage des Boards; geschrieben nur auf ausdrueckliche Handlung.

const jiraAn = () => !!(config.jira && config.jira.enabled && auth());
const KEY_RE = /^[A-Z][A-Z0-9]{0,9}-\d{1,9}$/;
const PROJEKT_RE = /^[A-Z][A-Z0-9]{0,9}$/;

// Sprint und Story Points haben je Jira-Instanz andere Feld-IDs; einmal je
// Instanz nach Namen suchen.
const feldCache = new Map();
async function felderIds() {
  const basis = config.jira.baseUrl;
  if (!feldCache.has(basis)) {
    const liste = await jiraFetch('/rest/api/3/field');
    const id = (namen) => ((liste || []).find((f) => namen.includes(f.name)) || {}).id || null;
    feldCache.set(basis, { sprint: id(['Sprint']), punkte: id(['Story point estimate', 'Story Points']) });
  }
  return feldCache.get(basis);
}

// ADF (Atlassian Document Format) als Klartext; Aufgabenlisten getrennt.
function adfText(knoten) {
  if (!knoten) return '';
  if (knoten.type === 'text') return knoten.text || '';
  if (knoten.type === 'taskList') return '';
  const innen = (knoten.content || []).map(adfText).join('');
  return ['paragraph', 'heading', 'listItem', 'codeBlock', 'blockquote'].includes(knoten.type) ? innen + '\n' : innen;
}
function adfKriterien(knoten, aus = []) {
  if (!knoten) return aus;
  if (knoten.type === 'taskItem') aus.push({ text: adfText({ content: knoten.content }).trim(), erledigt: (knoten.attrs || {}).state === 'DONE' });
  else for (const k of knoten.content || []) adfKriterien(k, aus);
  return aus;
}

function issueAus(roh, ids) {
  const f = roh.fields || {};
  const sprints = ids.sprint && Array.isArray(f[ids.sprint]) ? f[ids.sprint] : [];
  const sprint = sprints.find((s) => s.state === 'active') || sprints[sprints.length - 1];
  // Leer heisst „nicht geschaetzt“, nicht 0 (Number(null) und Number('') ergaeben 0).
  const punkteRoh = ids.punkte ? f[ids.punkte] : null;
  const punkte = punkteRoh == null || punkteRoh === '' ? NaN : Number(punkteRoh);
  // Epic = Elternvorgang der Ebene 1 (Scrum-Gruppierung); Unteraufgaben haben eine Story als Eltern.
  const p = f.parent && f.parent.fields ? f.parent : null;
  const epic = p && p.fields.issuetype && (p.fields.issuetype.hierarchyLevel === 1 || /^(epic|epos)$/i.test(p.fields.issuetype.name || ''))
    ? { key: p.key, titel: p.fields.summary || '' } : null;
  return {
    key: roh.key, projekt: roh.key.split('-')[0], titel: f.summary || '',
    status: (f.status && f.status.name) || '', statusKat: (f.status && f.status.statusCategory && f.status.statusCategory.key) || 'new',
    typ: (f.issuetype && f.issuetype.name) || null, zugewiesen: (f.assignee && f.assignee.displayName) || null,
    gemeldet: (f.reporter && f.reporter.displayName) || null, prio: (f.priority && f.priority.name) || null,
    labels: Array.isArray(f.labels) ? f.labels : [], sprint: sprint ? sprint.name : null, sprintStatus: sprint && ['active', 'future', 'closed'].includes(sprint.state) ? sprint.state : null,
    epic, punkte: Number.isFinite(punkte) ? punkte : null,
    beschreibung: adfText(f.description).trim(), kriterien: adfKriterien(f.description), aktualisiert: f.updated || null,
  };
}

async function suche(jql, ids) {
  const fields = ['summary', 'status', 'assignee', 'reporter', 'priority', 'labels', 'issuetype', 'updated', 'description', 'parent', ids.sprint, ids.punkte].filter(Boolean).join(',');
  const aus = [];
  let token = null;
  do {
    const q = new URLSearchParams({ jql, fields, maxResults: '100' });
    if (token) q.set('nextPageToken', token);
    const data = await jiraFetch(`/rest/api/3/search/jql?${q}`);
    for (const roh of (data && data.issues) || []) aus.push(issueAus(roh, ids));
    token = (data && data.nextPageToken) || null;
  } while (token);
  return aus;
}

// Alle offenen Tickets des Projekts (Backlog und Sprint, Owner 20.10.) und
// dazu die erledigten, auf denen noch offene Zeit liegt (doneKeys).
async function holeIssues(projekt, { doneKeys = [] } = {}) {
  if (!PROJEKT_RE.test(projekt)) throw new Error('Jira-Projektschlüssel ungültig.');
  const ids = await felderIds();
  const aus = await suche(`project = "${projekt}" AND statusCategory != Done ORDER BY updated DESC`, ids);
  const keys = doneKeys.filter((k) => KEY_RE.test(k) && k.startsWith(projekt + '-'));
  for (let i = 0; i < keys.length; i += 50) aus.push(...await suche(`key in (${keys.slice(i, i + 50).join(',')}) AND statusCategory = Done`, ids));
  return aus;
}

const initialen = (name) => String(name || '?').split(/\s+/).filter(Boolean).map((t) => t[0]).join('').slice(0, 2).toUpperCase();

async function holeIssue(key) {
  if (!KEY_RE.test(String(key))) throw new Error('Jira-Schlüssel ungültig.');
  const ids = await felderIds();
  const roh = await jiraFetch(`/rest/api/3/issue/${key}`);
  const k = await jiraFetch(`/rest/api/3/issue/${key}/comment?orderBy=-created&maxResults=50`);
  const kommentare = ((k && k.comments) || []).map((c) => {
    const autor = (c.author && c.author.displayName) || 'Unbekannt';
    return { autor, initialen: initialen(autor), zeit: c.created || null, text: adfText(c.body).trim() };
  });
  return { ...issueAus(roh, ids), kommentare };
}

// --- Schreiben fuers Board: nur auf ausdrueckliche Handlung des Nutzers -------

async function transitions(key) {
  if (!KEY_RE.test(String(key))) throw new Error('Jira-Schlüssel ungültig.');
  const d = await jiraFetch(`/rest/api/3/issue/${key}/transitions`);
  return ((d && d.transitions) || []).map((t) => ({
    id: String(t.id), name: t.name || '', nach: (t.to && t.to.name) || '', nachKat: (t.to && t.to.statusCategory && t.to.statusCategory.key) || 'new',
  }));
}

async function transition(key, id) {
  if (!KEY_RE.test(String(key)) || !/^\d{1,9}$/.test(String(id))) throw new Error('Jira-Übergang ungültig.');
  await jiraFetch(`/rest/api/3/issue/${key}/transitions`, { method: 'POST', body: { transition: { id: String(id) } } });
}

// Ein Absatz je Zeile; Leerzeilen fallen weg.
async function kommentiere(key, text) {
  if (!KEY_RE.test(String(key))) throw new Error('Jira-Schlüssel ungültig.');
  const absaetze = String(text).split(/\r?\n/).map((z) => z.trim()).filter(Boolean)
    .map((z) => ({ type: 'paragraph', content: [{ type: 'text', text: z }] }));
  return jiraFetch(`/rest/api/3/issue/${key}/comment`, { method: 'POST', body: { body: { type: 'doc', version: 1, content: absaetze } } });
}

// "Als Jira-Ticket anlegen" (C7b). Der Typ kommt aus dem Projekt: Jira ist oft
// lokalisiert ("Aufgabe"), und nicht jedes Projekt kennt "Task".
async function legeAn(projekt, { titel, kriterien = [] }) {
  if (!PROJEKT_RE.test(String(projekt))) throw new Error('Jira-Projektschlüssel ungültig.');
  const summary = String(titel || '').trim();
  if (!summary || summary.length > 255) throw new Error('Titel: 1 bis 255 Zeichen.');
  const p = await jiraFetch(`/rest/api/3/project/${projekt}`);
  const typen = ((p && p.issueTypes) || []).filter((t) => !t.subtask);
  const typ = typen.find((t) => /^(task|aufgabe)$/i.test(t.name)) || typen.find((t) => t.hierarchyLevel === 0);
  if (!typ) throw new Error('Jira-Projekt ' + projekt + ' hat keinen Vorgangstyp für Aufgaben.');
  const content = kriterien.length ? [{ type: 'taskList', attrs: { localId: crypto.randomUUID() }, content: kriterien.map((k) => ({
    type: 'taskItem', attrs: { localId: crypto.randomUUID(), state: k.erledigt ? 'DONE' : 'TODO' }, content: [{ type: 'text', text: String(k.text) }] })) }] : [];
  let r;
  try {
    r = await jiraFetch('/rest/api/3/issue', { method: 'POST', body: { fields: {
      project: { key: projekt }, issuetype: { id: typ.id }, summary, description: { type: 'doc', version: 1, content } } } });
  } catch (e) {
    // Abgebrochen heisst nicht "nicht angelegt": Jira kann das Ticket schon haben.
    if (/abort|timeout|ECONNRESET|socket/i.test(e.message)) throw new Error('Ergebnis unklar (' + e.message + ') — bitte in Jira nachsehen, bevor du es erneut versuchst.');
    throw e;
  }
  if (!r || !KEY_RE.test(String(r.key))) throw new Error('Jira hat keinen Schlüssel zurückgegeben.');
  return { key: r.key };
}

module.exports = {
  run, buildComment, fingerprint, MARKER, MARKER_NODATA, istJiraKey,
  markiereTicketsOhneDaten, ticketsOhneDaten, nodataKommentar,
  jiraAn, holeIssues, holeIssue, transitions, transition, kommentiere, legeAn, KEY_RE,
  // Nur fuer die Live-Gates (Testticket anlegen, aufraeumen).
  jiraFetch,
};

if (require.main === module) {
  const db = require('./db').open();
  const dryRun = process.argv.includes('--dry-run');
  const onlyIdx = process.argv.indexOf('--ticket');
  const only = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
  const aufgabe = process.argv.includes('--no-data')
    ? markiereTicketsOhneDaten({ db, verbose: true, dryRun })
    : run({ db, verbose: true, dryRun, only });
  aufgabe.then(() => db.close());
}
