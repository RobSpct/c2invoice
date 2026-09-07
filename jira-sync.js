'use strict';
// Schreibt die Kennzahlen automatisch an die Jira-Vorgaenge.
// Je Ticket entsteht genau EIN Kommentar, der bei spaeteren Laeufen
// aktualisiert wird. So bleibt die Historie am Ticket lesbar statt zugespammt.
const config = require('./config.json');
const metrics = require('./metrics');

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
      content: [{ type: 'text', text: 'devbill', marks: [{ type: 'strong' }] }],
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
        `Aktivzeit ohne Pausen ueber ${config.gapMinutes} Minuten. ` +
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
  setz(f.stunden, t.active_hours);
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
  const rows = metrics.byTicket(db).filter((t) =>
    istJiraKey(t.ticket, keys) && (!only || t.ticket === only)
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
          'devbill: keine Token-Daten vorhanden. Die Arbeit an diesem ' +
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

module.exports = {
  run, buildComment, fingerprint, MARKER, MARKER_NODATA, istJiraKey,
  markiereTicketsOhneDaten, ticketsOhneDaten, nodataKommentar,
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
