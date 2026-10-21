'use strict';
// Sitzungen I (Masterplan 3.0, Block C5; BACKEND §3). c2invoice startet
// Claude Code im Ordner eines Arbeitsbereichs und spricht mit dem Prozess
// ueber das Stream-Protokoll (stdin/stdout, je Zeile ein JSON-Objekt).
//
// Anders als Cira-T2 (claude.js) ist das eine Entwickler-Sitzung: normale
// Nutzer-Settings mit Hooks, Plugins und MCPs, kein --tools. Was die CLI
// fragen wuerde (Rechte, Rueckfragen), kommt mit --permission-prompt-tool
// stdio als control_request zu uns und wird zur Freigabe "sitzung_frage";
// die Entscheidung geht als control_response zurueck (Spike G0, 19.10.).
//
// Abgerechnet wird ueber den Ledger: die CLI schreibt ihre JSONL wie jede
// andere Sitzung, der Abgleich bucht sie (Branch, sonst Override). Die
// Kosten hier sind nur die Anzeige der CLI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile, execFileSync } = require('node:child_process');
const claude = require('./claude');
const ereignisse = require('./ereignisse');
const freigaben = require('./freigaben');

const SID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Agent und Modell gehen als Argument an claude.exe (ohne Shell). Kein
// fuehrendes "-", sonst waere es eine Option. Das Inventar kommt mit C8.
const AGENT_RE = /^[A-Za-z0-9][\w.:-]{0,79}$/;
const MODELL_RE = /^[A-Za-z0-9][\w.[\]-]{1,60}$/;
const OFFEN = ['startet', 'laeuft', 'bereit', 'wartet'];
// Rechte-Modus beim Start (sonst gilt defaultMode aus den Nutzer-Settings).
// bypassPermissions nie: das hebelte jede Freigabe aus.
const MODI = ['manual', 'acceptEdits', 'plan', 'auto', 'dontAsk'];
const MAX_LAUFEND = 8;
const MAX_TEXT = 20000;
const MAX_KOERPER = 16 * 1024;
// Was in einer Freigabe steht, muss ganz pruefbar sein: groessere Eingaben nur ablehnbar.
const MAX_PRUEFBAR = 16000;
// Eine Ausgabezeile ohne Zeilenende waechst sonst ohne Grenze.
const MAX_ZEILE = 8 * 1024 * 1024;
// Fremde Sitzung ohne eigene Eingabe so lange offen (Owner 20.10.); /exit beendet sofort.
const OFFEN_OHNE_EINGABE_MS = 5 * 3600000;
// Notification-Typen, bei denen eine Sitzung im eigenen Terminal wirklich auf dich wartet (B1).
const BRAUCHT_DICH = new Set(['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input']);
// Fremde Transkripte koennen groß werden; gelesen wird nur das Ende.
const MAX_JSONL = 4 * 1024 * 1024;

const jetzt = () => new Date().toISOString();
// Hoechstens n Zeichen einschliesslich "…": freigaben.anlegen nimmt Titel bis 200 (Probe 19.10.: 201 brach jede Rechte-Anfrage mit langem Pfad).
const kappe = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const alsKoerper = (v) => { const s = JSON.stringify(v ?? null); return s.length > MAX_KOERPER ? JSON.stringify({ gekuerzt: true, anfang: s.slice(0, MAX_KOERPER) }) : s; };
const ausJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

// Werkzeugname -> Ereignis-Art (Karten in C6).
function artVon(name) {
  if (/^mcp__/.test(name)) return 'mcp';
  if (['Read', 'Glob', 'Grep', 'LS', 'WebFetch', 'WebSearch'].includes(name)) return 'read';
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(name)) return 'edit';
  if (['Bash', 'PowerShell', 'BashOutput', 'KillShell'].includes(name)) return 'bash';
  if (name === 'Skill') return 'skill';
  if (name === 'AskUserQuestion') return 'frage';
  return 'werkzeug';
}
function titelVon(name, e = {}) {
  const s = (v) => (typeof v === 'string' ? v : '');
  const t = s(e.file_path) || s(e.notebook_path) || s(e.command) || s(e.pattern) || s(e.skill) || s(e.url) || s(e.query) || s(e.description) || '';
  return kappe(t ? name + ': ' + t.replace(/\s+/g, ' ') : name, 200);
}

// Ein Eintrag der JSONL bzw. des Streams als Ereignisse. Beide Formate tragen
// dieselben message-Objekte; nur control_request gibt es allein im Stream.
function ereignisseAus(m) {
  const aus = [];
  const inhalt = m.message && m.message.content;
  if (m.type === 'assistant' && Array.isArray(inhalt)) {
    for (const b of inhalt) {
      if (b.type === 'text' && b.text && b.text.trim()) aus.push({ art: 'say', titel: kappe(b.text.trim(), 200), koerper: { text: b.text } });
      if (b.type === 'tool_use') aus.push({ art: artVon(b.name), titel: titelVon(b.name, b.input), meta: b.name, koerper: { id: b.id, input: b.input } });
    }
  }
  if (m.type === 'user' && !m.isMeta) {
    const text = typeof inhalt === 'string' ? inhalt : Array.isArray(inhalt) ? inhalt.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '';
    if (text.trim()) aus.push({ art: 'eingabe', titel: kappe(text.trim(), 200), koerper: { text } });
  }
  return aus;
}

// Diff eines edit-Ereignisses fuer Terminal und Karten (C6): alte Zeilen "-",
// neue "+". Kurz gehalten, die Datei selbst steht im Arbeitsbereich.
const DIFF_ZEILEN = 12;
// Voller Text fuer die Terminal-Ansicht; titel bleibt die 200-Zeichen-Fassung fuer Liste und Karten.
const TEXT_MAX = 20000;
const textAus = (k) => (k && typeof k.text === 'string' && k.text.trim() ? kappe(k.text.trim(), TEXT_MAX) : undefined);
function diffAus(koerperJson) {
  const k = typeof koerperJson === 'string' || koerperJson == null ? ausJson(koerperJson) : koerperJson;
  // Zu grosse Eingabe wurde beim Speichern gekuerzt: sagen statt still keinen Diff zu zeigen.
  if (k && k.gekuerzt) return [{ z: '~', t: 'Eingabe zu groß, Diff ausgelassen' }];
  const e = k && k.input;
  if (!e || typeof e !== 'object') return null;
  const zeilen = (s, z) => (typeof s === 'string' && s ? s.split(/\r?\n/).map((t) => ({ z, t: kappe(t, 199) })) : []);
  const teile = Array.isArray(e.edits) ? e.edits : [e];
  const aus = [];
  for (const t of teile) aus.push(...zeilen(t.old_string, '-'), ...zeilen(t.new_string ?? t.content ?? t.new_source, '+'));
  return aus.length ? aus.slice(0, DIFF_ZEILEN) : null;
}

// "Zum Terminal" (C6): Befehl aus config.json in Argumente zerlegen, erst dann
// die Platzhalter ersetzen — ein Pfad mit Leerzeichen bleibt ein Argument,
// und es laeuft keine Shell, die etwas daraus lesen koennte.
function befehlArgumente(befehl, werte) {
  const aus = [];
  for (const [, roh, frei] of String(befehl).matchAll(/"([^"]*)"|(\S+)/g)) {
    aus.push((roh ?? frei).replace(/\{(pfad|sitzung|claude)\}/g, (_, k) => werte[k]));
  }
  return aus;
}

// Routen von Sitzungen und Ablaeufen (C6b): Fehler und Kopfzeilen-Pruefung an einem Ort.
function routenHelfer(req, res, p, { sendJson, leseKoerper }, bereich) {
  // Eingabefehler sind schlichte Error (400). TypeError & Co. sind Programmfehler:
  // ins Protokoll und als 500, statt wie eine falsche Eingabe auszusehen.
  const fehler = (err) => {
    const programm = !err.status && (err instanceof TypeError || err instanceof ReferenceError || err instanceof RangeError || err instanceof SyntaxError);
    if (programm) console.error(bereich + ' ' + p + ':', err);
    if (res.headersSent) return;
    // err.daten: Fachdaten zum Fehler, z. B. die moeglichen Jira-Uebergaenge bei 409 (Board).
    sendJson(res, { error: programm ? 'Interner Fehler, Details im Serverprotokoll.' : err.message, ...(!programm && err.daten ? err.daten : {}) }, err.status || (programm ? 500 : 400));
  };
  // Wie bei den Freigaben: schreiben nur mit den Kopfzeilen der eigenen Seite.
  // Das haelt fremde Webseiten (CSRF) und Skripte ab, die die Kopfzeilen nicht
  // setzen. Grenze (Security-Review C5, H1): ein lokaler Prozess — auch eine
  // Sitzung mit curl-Recht — kann sie faelschen; dagegen steht die
  // Geraetekopplung (S1).
  const post = (fn) => {
    const site = req.headers['sec-fetch-site'];
    const origin = req.headers.origin;
    if (site !== 'same-origin' && !(origin && origin === 'http://' + req.headers.host)) return sendJson(res, { error: bereich + ' nur aus der Oberfläche' }, 403);
    return leseKoerper(req, (f, d) => {
      if (f) return sendJson(res, { error: f }, 400);
      // Aktionen wie Zusammenfassung und Terminal sind asynchron. catch statt
      // zweitem then-Argument: auch ein Fehler beim Senden landet in fehler().
      Promise.resolve().then(() => fn(d && typeof d === 'object' && !Array.isArray(d) ? d : {})).then((r) => sendJson(res, { ok: true, ...r })).catch(fehler);
    });
  };
  return { fehler, post };
}

// Vorgangs-Log (C6), neueste zuerst.
const vorgangLog = (db, vorgang) => db.prepare('SELECT id, zeit, quelle, text FROM vorgang_log WHERE vorgang = ? ORDER BY zeit DESC, id DESC LIMIT 200').all(vorgang);

// Prozessbaum beenden. Unter Windows endet mit claude.exe sonst nicht, was es
// gestartet hat (MCP-Server, Shells).
function baumBeenden(pid, { sync = false } = {}) {
  if (!pid) return;
  if (process.platform === 'win32') {
    const args = ['/PID', String(pid), '/T', '/F'];
    if (sync) { try { execFileSync('taskkill', args, { stdio: 'ignore', windowsHide: true }); } catch { /* schon weg */ } return; }
    execFile('taskkill', args, { windowsHide: true }, (err) => {
      // 128: Prozess nicht gefunden (schon weg) — gut. Alles andere melden.
      if (err && err.code !== 128) console.error('Sitzung: taskkill ' + pid + ' fehlgeschlagen:', err.message);
    });
    return;
  }
  try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* schon weg */ } }
}

// db; arbeitsbereiche() -> [{name, pfad, ...}] wie in config.json;
// exe() -> Pfad zu claude.exe; heim(p) loest "~" auf;
// vormerken(sid, vorgang) bucht wie /api/buchen (auch vor dem ersten Ereignis);
// werkzeug(projekt): Werkzeugbetrieb (claude-mem …) zaehlt nicht als fremde Sitzung, wie im Live-Tab.
// zusammenfassen(verlauf) -> {text} | {fehlt}: lokales Modell (Cira T1);
// terminalBefehl() -> terminal.befehl aus config.json; spawnTerminal startet ihn.
function erzeuge({ db, arbeitsbereiche, exe, heim = (p) => p, vormerken, werkzeug = () => false, spawnFn = spawn, beenden = baumBeenden, stoppWarteMs = 4000,
  zusammenfassen = async () => ({ fehlt: 'nicht eingerichtet' }), terminalBefehl = () => '', spawnTerminal = spawn, terminalWarteMs = 1500 }) {
  const laufend = new Map();   // id -> { kind, offen: Map(request_id -> {freigabe, werkzeug, input}), gestoppt, stderr }

  const zeile = (id) => db.prepare('SELECT rowid AS nr, * FROM sitzung WHERE id = ?').get(id);
  const setze = (id, felder) => {
    const k = Object.keys(felder);
    db.prepare('UPDATE sitzung SET ' + k.map((x) => x + ' = ?').join(', ') + ' WHERE id = ?').run(...k.map((x) => felder[x]), id);
  };
  const ereignis = (id, e, kosten = null) => {
    const r = db.prepare('INSERT INTO sitzung_ereignis (session_id, zeit, art, titel, meta, kosten_usd, koerper_json) VALUES (?,?,?,?,?,?,?)')
      .run(id, jetzt(), e.art, e.titel || null, e.meta || null, kosten, alsKoerper(e.koerper));
    ereignisse.sende('sitzung', { id, ereignis: { id: Number(r.lastInsertRowid), art: e.art, titel: e.titel || null, meta: e.meta || null, kosten_usd: kosten } });
  };
  const status = (id, s) => { setze(id, { status: s }); ereignisse.sende('sitzung', { id, status: s }); meldeZaehler(); };
  const meldeZaehler = () => ereignisse.sende('zaehler', { sitzungen: anzahlOffen() });

  function anzahlOffen() {
    // Eigene laufende Prozesse und fremde Sitzungen mit Ereignis in den letzten 2 Minuten.
    const fremd = db.prepare("SELECT DISTINCT session_id AS id, project FROM events WHERE ts >= ? AND COALESCE(source, '') <> 'lokal'").all(new Date(Date.now() - 120000).toISOString())
      .filter((r) => !werkzeug(r.project));
    return new Set([...laufend.keys(), ...fremd.map((r) => r.id)]).size;
  }

  function sende(id, o) {
    const p = laufend.get(id);
    if (!p || !p.kind.stdin || p.kind.stdin.destroyed || p.kind.stdin.writableEnded) return false;
    p.kind.stdin.write(JSON.stringify(o) + '\n');
    return true;
  }
  // Jede Eingabe beginnt einen Zug: Laufzeit und Tokens fuer die Arbeitszeile (Owner 20.10.).
  const nutzer = (id, text) => {
    const p = laufend.get(id);
    if (p) p.zug = { seit: jetzt(), tokens: new Map() };
    return sende(id, { type: 'user', message: { role: 'user', content: text } });
  };
  const zugVon = (p) => (p && p.zug ? { seit: p.zug.seit, tokens: [...p.zug.tokens.values()].reduce((a, b) => a + b, 0) } : null);

  function antworte(id, requestId, antwort) {
    return sende(id, { type: 'control_response', response: { subtype: 'success', request_id: requestId, response: antwort } });
  }

  // Offene Freigaben dieser Sitzung zurueckziehen (Prozess weg, Anfrage von der CLI widerrufen).
  function verwerfe(id, hinweis, nurId = null) {
    const offen = db.prepare("SELECT id FROM freigabe WHERE art = 'sitzung_frage' AND bezug = ? AND status = 'offen'" + (nurId ? ' AND id = ?' : '')).all(...(nurId ? [id, nurId] : [id]));
    for (const f of offen) {
      const r = db.prepare("UPDATE freigabe SET status = 'abgelehnt', erledigt_am = ?, hinweis = ? WHERE id = ? AND status = 'offen'").run(jetzt(), hinweis, f.id);
      if (r.changes) ereignisse.sende('freigabe', { id: f.id, status: 'abgelehnt' });
    }
    if (offen.length) ereignisse.sende('zaehler', { freigaben: freigaben.offenAnzahl(db) });
  }

  function rechteAnfrage(id, m) {
    const p = laufend.get(id);
    const r = m.request || {};
    const werkzeug = String(r.tool_name || 'Werkzeug');
    const frage = werkzeug === 'AskUserQuestion';
    const fragen = frage && Array.isArray(r.input && r.input.questions) ? r.input.questions.map((q) => String(q.question || '')).filter(Boolean) : [];
    const titel = frage ? 'Claude fragt: ' + kappe(fragen[0] || 'Rückfrage', 150) : 'Claude möchte ' + titelVon(werkzeug, r.input);
    const ab = zeile(id);
    const roh = JSON.stringify(r.input || {});
    const zuGross = roh.length > MAX_PRUEFBAR;
    // Dieselbe request_id zweimal: die alte Karte wuerde sonst die neue Anfrage beantworten.
    const alt = p.offen.get(m.request_id);
    if (alt) { p.offen.delete(m.request_id); verwerfe(id, 'durch neue Anfrage ersetzt', alt.freigabe); }
    const f = freigaben.anlegen(db, {
      art: 'sitzung_frage', bezug: id, quelle: 'sitzung:' + id,
      titel: kappe(titel, 200),
      text: (ab && ab.arbeitsbereich ? 'Arbeitsbereich ' + ab.arbeitsbereich + '. ' : '') +
        (zuGross ? 'Eingabe zu groß zum Prüfen (' + roh.length + ' Zeichen), nur Ablehnen möglich. Anfang:\n' + roh.slice(0, MAX_PRUEFBAR) : frage ? fragen.join('\n') : roh),
      // Die Eingabe des Werkzeugs bleibt im Speicher: sie geht unveraendert zurueck.
      nutzlast: { sitzung: id, request_id: m.request_id, werkzeug, frage },
    });
    p.offen.set(m.request_id, { freigabe: f.id, werkzeug, input: r.input || {}, fragen, zuGross });
    ereignis(id, { art: frage ? 'frage' : 'rechte', titel: f.titel, meta: werkzeug, koerper: { freigabe: f.id, input: r.input } });
    status(id, 'wartet');
  }

  // Slash-Befehle, die die Sitzung selbst meldet: nur diese gehen ohne Terminal
  // (Spike 20.10.: /plugin, /exit, /help fehlen in der Liste und scheitern).
  const befehleAus = (liste) => (Array.isArray(liste) ? liste : []).slice(0, 1000)
    .map((b) => (typeof b === 'string' ? { name: b } : b && typeof b.name === 'string' ? { name: b.name, text: kappe(String(b.description || ''), 160) || undefined } : null))
    .filter((b) => b && /^[\w:.-]{1,100}$/.test(b.name));
  function befehleSetzen(id, befehle) {
    const g = ausJson(zeile(id).init_json) || {};
    setze(id, { init_json: JSON.stringify({ ...g, befehle }) });
  }
  // /clear: neue Sitzungs-ID als Fortsetzung, Vorgang geht mit.
  function folgeMerken(id, neu) {
    if (db.prepare('INSERT OR IGNORE INTO sitzung_folge (folge, sitzung, seit) VALUES (?,?,?)').run(neu, id, jetzt()).changes === 0) return;
    const v = zeile(id).vorgang;
    if (v) {
      try { vormerken(neu, v); } catch (err) { console.error('Sitzung ' + id + ': Vorgang fuer Fortsetzung ' + neu + ' nicht vorgemerkt:', err.message); }
    }
  }
  const folgen = (id) => db.prepare('SELECT folge FROM sitzung_folge WHERE sitzung = ? ORDER BY seit, rowid').all(id).map((r) => r.folge);
  const aktuelleId = (id) => folgen(id).pop() || id;

  function verarbeite(id, m) {
    const p = laufend.get(id);
    if (m.type === 'system' && m.subtype === 'init') {
      setze(id, {
        model: m.model || null, mode: m.permissionMode || null,
        init_json: JSON.stringify({
          version: m.claude_code_version || null, cwd: m.cwd || null, werkzeuge: (m.tools || []).length,
          mcp: (m.mcp_servers || []).map((s) => ({ name: s.name, status: s.status })),
          plugins: (m.plugins || []).map((x) => x.name), agents: (m.agents || []).length, skills: (m.skills || []).length,
          befehle: befehleAus(m.slash_commands),
        }),
      });
      if (typeof m.session_id === 'string' && m.session_id !== id && SID_RE.test(m.session_id)) folgeMerken(id, m.session_id);
      p.init = true;
      // Aus den Settings (Nutzer oder Arbeitsbereich) kann bypassPermissions kommen: dann gaebe es keine Freigaben.
      if (m.permissionMode === 'bypassPermissions') {
        p.fehlerText = 'Rechte-Modus bypassPermissions (aus den Claude-Settings) umgeht die Freigaben. Sitzung beendet.';
        ereignis(id, { art: 'fehler', titel: p.fehlerText });
        stopp(id);
        return;
      }
      if (zeile(id).status === 'startet') status(id, 'laeuft');
      return;
    }
    // Neue Skills/Plugins waehrend der Sitzung, mit Beschreibung.
    if (m.type === 'system' && m.subtype === 'commands_changed') { befehleSetzen(id, befehleAus(m.commands)); return; }
    // Tokens der Arbeitszeile: die assistant-Nachricht traegt nur den Platzhalter vom
    // Antwortbeginn; die endgueltige Zahl je Antwort steht in message_delta (Spike
    // 20.10.: gleich result.usage und JSONL). Subagenten zaehlen nicht mit.
    if (m.type === 'stream_event') {
      const ev = m.event || {};
      if (p.zug && !m.parent_tool_use_id) {
        if (ev.type === 'message_start' && ev.message) p.zug.akt = ev.message.id;
        if (ev.type === 'message_delta' && ev.usage) p.zug.tokens.set(p.zug.akt || p.zug.tokens.size, ev.usage.output_tokens || 0);
      }
      return;
    }
    if (m.type === 'assistant' && m.message && m.message.usage && !m.parent_tool_use_id) p.usage = m.message.usage;
    for (const e of ereignisseAus(m)) if (e.art !== 'eingabe') ereignis(id, e);
    if (m.type === 'control_request') {
      if (m.request && m.request.subtype === 'can_use_tool') return rechteAnfrage(id, m);
      // Andere Anfragen (Hooks, MCP ueber das SDK) bedient c2invoice nicht.
      sende(id, { type: 'control_response', response: { subtype: 'error', request_id: m.request_id, error: 'Nicht unterstützt.' } });
      return;
    }
    if (m.type === 'control_cancel_request') {
      const o = p.offen.get(m.request_id);
      if (o) {
        p.offen.delete(m.request_id);
        verwerfe(id, 'von Claude zurückgezogen', o.freigabe);
        if (!p.offen.size && zeile(id).status === 'wartet') status(id, 'laeuft');
      }
      return;
    }
    if (m.type === 'result') {
      // total_cost_usd ist ueber die Sitzung kumuliert (Spike G0). Fehlt er oder
      // waere er kleiner als bisher, bleibt die Anzeige, wie sie war (kein 0, kein Minus).
      const vorher = zeile(id).kosten_usd;
      const gilt = typeof m.total_cost_usd === 'number' && m.total_cost_usd >= (vorher || 0);
      const gesamt = gilt ? m.total_cost_usd : null;
      const felder = gilt ? { kosten_usd: gesamt } : {};
      p.letzterFehler = m.is_error ? kappe(String(m.result || m.subtype || 'Fehler'), 1000) : null;
      // Kontext-Fuellstand aus der letzten Antwort des Hauptmodells.
      const fenster = m.modelUsage && Object.values(m.modelUsage).map((x) => x.contextWindow).filter(Number.isFinite).sort((a, b) => b - a)[0];
      if (p.usage && fenster) {
        const u = p.usage;
        felder.ctx_pct = Math.round(((u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)) / fenster * 1000) / 10;
      }
      if (Object.keys(felder).length) setze(id, felder);
      ereignis(id, { art: 'zug', titel: m.is_error ? 'Zug mit Fehler beendet' : 'Zug fertig', meta: m.subtype || null, koerper: { dauer_ms: m.duration_ms, zuege: m.num_turns, fehler: m.is_error ? kappe(String(m.result || ''), 500) : null } }, gilt ? Math.round((gesamt - (vorher || 0)) * 1e6) / 1e6 : null);
      p.zug = null;
      status(id, p.offen.size ? 'wartet' : 'bereit');
    }
  }

  function ende(id, code, signal = null) {
    const p = laufend.get(id);
    if (!p) return;
    // Letzte Zeile ohne Zeilenende (oft das result) noch verarbeiten.
    if (p.rest.trim()) { const z = p.rest; p.rest = ''; zeileVerarbeiten(id, p, z); }
    laufend.delete(id);
    try {
      // Fehler auch bei Exit 0: ohne Anmeldung endet claude -p mit 0, ohne init und mit Fehler-result.
      const fehlerhaft = !!p.fehlerText || (!p.gestoppt && (code !== 0 || !p.init || !!p.letzterFehler));
      const text = p.fehlerText || p.letzterFehler || p.stderr.trim().slice(-1000) || 'Prozess endete mit Code ' + code + (signal ? ' (' + signal + ')' : '');
      setze(id, { status: fehlerhaft ? 'fehler' : 'beendet', pid: null, beendet: jetzt(), fehler: fehlerhaft ? text : null });
      verwerfe(id, 'Sitzung beendet');
      // Nie richtig gestartet: auch die Vormerkung des Vorgangs zuruecknehmen.
      const z = zeile(id);
      if (!p.init && z && z.vorgang) { try { vormerken(id, ''); setze(id, { vorgang: null }); } catch (e) { console.error('Sitzung ' + id + ': Vormerkung nicht zurueckgenommen:', e.message); } }
      ereignisse.sende('sitzung', { id, status: z ? z.status : 'fehler' });
      ereignisse.sende('sitzung_beendet', { id, vorgang: z && p.init ? z.vorgang : null, arbeitsbereich: z ? z.arbeitsbereich : null, status: z ? z.status : 'fehler' });
      meldeZaehler();
    } catch (err) {
      console.error('Sitzung ' + id + ': Ende nicht sauber gespeichert:', err);
      try { db.prepare("UPDATE sitzung SET status = 'fehler', pid = NULL, fehler = ? WHERE id = ?").run('Ende nicht sauber gespeichert: ' + kappe(err.message, 200), id); } catch (e2) { console.error('Sitzung ' + id + ': auch Fehlerstatus nicht gespeichert:', e2.message); }
    }
  }

  // Eine Zeile des Stroms. Scheitert die Verarbeitung einer Rechte-Anfrage,
  // bekommt die CLI trotzdem eine Antwort — sonst wartete sie fuer immer.
  function zeileVerarbeiten(id, p, z) {
    if (!z.trim()) return;
    let m;
    try { m = JSON.parse(z); } catch {
      // Klartext auf stdout (z. B. Anmeldefehler) gehoert in den Fehlertext.
      p.stderr = (p.stderr + '\n' + kappe(z.trim(), 1000)).slice(-4000);
      return;
    }
    try { verarbeite(id, m); } catch (err) {
      console.error('Sitzung ' + id + ': Ereignis nicht verarbeitet:', err);
      if (m.type === 'control_request' && !p.offen.has(m.request_id)) {
        antworte(id, m.request_id, { behavior: 'deny', message: 'c2invoice konnte die Anfrage nicht ablegen.' });
      }
      try { ereignis(id, { art: 'fehler', titel: 'Interner Fehler: ' + kappe(String(err.message), 150) }); } catch { /* steht im Serverprotokoll */ }
    }
  }

  function starte(d = {}) {
    const ab = typeof d.arbeitsbereich === 'string' ? arbeitsbereiche().find((a) => a.name === d.arbeitsbereich) : null;
    if (!ab) throw new Error('Arbeitsbereich unbekannt.');
    const cwd = heim(ab.pfad || '');
    let istOrdner = false;
    try { istOrdner = !!cwd && fs.statSync(cwd).isDirectory(); } catch { /* fehlt */ }
    if (!istOrdner) throw new Error('Ordner des Arbeitsbereichs nicht erreichbar (in config.json prüfen).');
    if (typeof d.prompt !== 'string' || !d.prompt.trim() || d.prompt.length > MAX_TEXT) throw new Error('Auftrag: 1 bis ' + MAX_TEXT + ' Zeichen.');
    if (d.agent != null && d.agent !== '' && (typeof d.agent !== 'string' || !AGENT_RE.test(d.agent))) throw new Error('Agent: Name ungültig.');
    if (d.modell != null && d.modell !== '' && (typeof d.modell !== 'string' || !MODELL_RE.test(d.modell))) throw new Error('Modell: Name ungültig.');
    if (d.modus != null && d.modus !== '' && !MODI.includes(d.modus)) throw new Error('Modus: ' + MODI.join(', ') + '.');
    if (laufend.size >= MAX_LAUFEND) throw Object.assign(new Error('Schon ' + MAX_LAUFEND + ' Sitzungen laufen. Erst eine beenden.'), { status: 409 });
    const datei = exe();
    if (!datei) throw Object.assign(new Error('Claude Code nicht gefunden (claude.exe).'), { status: 503 });

    const id = crypto.randomUUID();
    // Vorgang zuerst: ein Tippfehler darf keinen Prozess starten.
    const vorgang = d.vorgang ? vormerken(id, d.vorgang) : null;
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--permission-prompt-tool', 'stdio', '--session-id', id];
    if (d.agent) args.push('--agent=' + d.agent);
    if (d.modell) args.push('--model', d.modell);
    if (d.modus) args.push('--permission-mode', d.modus);
    let kind;
    try {
      kind = spawnFn(datei, args, { cwd, env: claude.kindUmgebung(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    } catch (err) {
      // Nicht gestartet: auch die Vormerkung zuruecknehmen.
      if (vorgang) { try { vormerken(id, ''); } catch (e2) { console.error('Sitzung ' + id + ': Vormerkung nicht zurueckgenommen:', e2.message); } }
      throw err;
    }
    const p = { kind, offen: new Map(), gestoppt: false, stderr: '', rest: '', init: false, weg: false };
    try {
      db.prepare('INSERT INTO sitzung (id, quelle, arbeitsbereich, vorgang, agent, status, pid, gestartet) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, 'c2invoice', ab.name, vorgang, d.agent || null, 'startet', kind.pid || null, jetzt());
      laufend.set(id, p);
    } catch (err) {
      // Ohne Zeile liefe ein Prozess, den niemand sieht.
      beenden(kind.pid);
      if (vorgang) { try { vormerken(id, ''); } catch (e2) { console.error('Sitzung ' + id + ': Vormerkung nicht zurueckgenommen:', e2.message); } }
      throw err;
    }

    kind.stdout.setEncoding('utf8');
    kind.stdout.on('data', (stueck) => {
      p.rest += stueck;
      let i;
      while ((i = p.rest.indexOf('\n')) >= 0) {
        const z = p.rest.slice(0, i); p.rest = p.rest.slice(i + 1);
        zeileVerarbeiten(id, p, z);
      }
      if (p.rest.length > MAX_ZEILE) {
        p.rest = '';
        p.fehlerText = 'Ausgabe ohne Zeilenende über 8 MB. Sitzung beendet.';
        if (laufend.get(id) === p) stopp(id);
      }
    });
    kind.stderr.setEncoding('utf8');
    kind.stderr.on('data', (s) => { p.stderr = (p.stderr + s).slice(-4000); });
    // Schreibfehler auf stdin (Prozess schon weg) laufen ueber close.
    kind.stdin.on('error', (err) => { if (err.code !== 'EPIPE' && err.code !== 'EOF') console.error('Sitzung ' + id + ': stdin:', err.message); });
    kind.on('error', (err) => { p.stderr += '\n' + err.message; if (!kind.pid) ende(id, -1); });
    // close kommt erst, wenn alle Pipes zu sind. Haelt ein Kindprozess (MCP)
    // sie offen, endet die Sitzung trotzdem kurz nach exit — und die alte PID
    // wird danach nie mehr beendet (sie kann neu vergeben sein).
    kind.on('exit', (code, signal) => { p.weg = true; setTimeout(() => ende(id, code, signal), 2000).unref(); });
    kind.on('close', (code, signal) => { p.weg = true; ende(id, code, signal); });
    // Haengt der Start (Plugins, MCPs, Anmeldung), soll man es sehen.
    setTimeout(() => {
      if (laufend.get(id) === p && !p.init) { try { ereignis(id, { art: 'fehler', titel: 'Start dauert ungewöhnlich lange (nach 60 s noch keine Antwort von Claude)' }); } catch (e) { console.error('Sitzung ' + id + ':', e.message); } }
    }, 60000).unref();

    nutzer(id, d.prompt);
    ereignis(id, { art: 'eingabe', titel: kappe(d.prompt.trim(), 200), koerper: { text: d.prompt } });
    ereignisse.sende('sitzung', { id, status: 'startet' });
    meldeZaehler();
    return { id, status: 'startet', arbeitsbereich: ab.name, vorgang };
  }

  function eingabe(id, d = {}) {
    if (!laufend.has(id)) throw Object.assign(new Error('Sitzung läuft nicht.'), { status: 409 });
    if (typeof d.text !== 'string' || !d.text.trim() || d.text.length > MAX_TEXT) throw new Error('Eingabe: 1 bis ' + MAX_TEXT + ' Zeichen.');
    // /exit und /quit kennt die CLI ohne Terminal nicht ("isn't available in this
    // environment", Owner-Test 20.10.): c2invoice beendet die Sitzung selbst.
    if (/^\/(exit|quit)$/i.test(d.text.trim())) {
      ereignis(id, { art: 'eingabe', titel: d.text.trim(), koerper: { text: d.text.trim() } });
      return stopp(id);
    }
    if (!nutzer(id, d.text)) throw Object.assign(new Error('Sitzung nimmt keine Eingabe mehr an.'), { status: 409 });
    ereignis(id, { art: 'eingabe', titel: kappe(d.text.trim(), 200), koerper: { text: d.text } });
    if (!laufend.get(id).offen.size) status(id, 'laeuft');
    return { id };
  }

  // Erst hoeflich (Unterbrechen, stdin schliessen), dann den Baum beenden.
  function stopp(id) {
    const p = laufend.get(id);
    if (!p) throw Object.assign(new Error('Sitzung läuft nicht.'), { status: 409 });
    if (!p.gestoppt) {
      p.gestoppt = true;
      sende(id, { type: 'control_request', request_id: 'stopp-' + id, request: { subtype: 'interrupt' } });
      try { p.kind.stdin.end(); } catch { /* schon zu */ }
      setTimeout(() => { if (laufend.get(id) === p && !p.weg) beenden(p.kind.pid); }, stoppWarteMs).unref();
    }
    return { id, status: 'stoppt' };
  }

  // Freigabe "sitzung_frage" erlaubt: Antwort an den Prozess. Abgelehnt wird
  // ueber den Bus (entscheide ruft fuer "ablehnen" keine Aktion auf).
  function erlaube(n, { hinweis } = {}) {
    const p = n && laufend.get(n.sitzung);
    const o = p && p.offen.get(n.request_id);
    if (!o) throw Object.assign(new Error('Sitzung läuft nicht mehr oder die Anfrage ist schon erledigt.'), { status: 409 });
    if (o.zuGross) throw Object.assign(new Error('Eingabe zu groß zum Prüfen. Nur Ablehnen ist möglich.'), { status: 409 });
    let input = o.input;
    if (o.werkzeug === 'AskUserQuestion') {
      if (!hinweis || !hinweis.trim()) throw new Error('Antwort fehlt: bitte in den Hinweis schreiben.');
      input = { ...o.input, answers: Object.fromEntries(o.fragen.map((q) => [q, hinweis.trim()])) };
    }
    if (!antworte(n.sitzung, n.request_id, { behavior: 'allow', updatedInput: input })) throw Object.assign(new Error('Sitzung nimmt keine Antwort mehr an.'), { status: 409 });
    p.offen.delete(n.request_id);
    ereignis(n.sitzung, { art: 'rechte', titel: 'Erlaubt: ' + o.werkzeug, meta: 'erlaubt', koerper: { freigabe: o.freigabe } });
    if (!p.offen.size) status(n.sitzung, 'laeuft');
    return { sitzung: n.sitzung, antwort: 'erlaubt' };
  }
  function ablehnen(freigabeId) {
    const f = db.prepare('SELECT art, nutzlast_json, hinweis FROM freigabe WHERE id = ?').get(freigabeId);
    if (!f || f.art !== 'sitzung_frage') return;
    const n = ausJson(f.nutzlast_json);
    const p = n && laufend.get(n.sitzung);
    const o = p && p.offen.get(n.request_id);
    if (!o) return;
    const zugestellt = antworte(n.sitzung, n.request_id, { behavior: 'deny', message: f.hinweis ? 'Vom Nutzer abgelehnt: ' + f.hinweis : 'Vom Nutzer abgelehnt.' });
    p.offen.delete(n.request_id);
    if (!zugestellt) { ereignis(n.sitzung, { art: 'fehler', titel: 'Ablehnung nicht zugestellt (Sitzung endet gerade): ' + o.werkzeug }); return; }
    ereignis(n.sitzung, { art: 'rechte', titel: 'Abgelehnt: ' + o.werkzeug, meta: 'abgelehnt', koerper: { freigabe: o.freigabe } });
    if (!p.offen.size) status(n.sitzung, 'laeuft');
  }
  freigaben.registriere('sitzung_frage', (dbx, n, opt) => erlaube(n, opt));
  const hoerer = (e) => {
    if (e.art !== 'freigabe' || e.daten.status !== 'abgelehnt') return;
    try { ablehnen(e.daten.id); } catch (err) { console.error('Sitzung: Ablehnung nicht zugestellt:', err); }
  };
  ereignisse.bus.on('ereignis', hoerer);

  // Kosten aus dem Ledger (nach dem Abgleich), Zuordnung wie dort gebucht.
  const ledger = (id) => db.prepare(`SELECT COUNT(*) AS anfragen, COALESCE(SUM(cost_usd), 0) AS kosten_usd, MAX(ts) AS letzte,
    MAX(ticket) AS ticket, MAX(ticket_quelle) AS quelle, MAX(project) AS projekt, MAX(branch) AS branch, MAX(cwd) AS cwd FROM events WHERE session_id = ?`).get(id);
  // Titel der Sitzung = ihr erster Auftrag.
  const titelAus = (id) => { const e = db.prepare("SELECT titel FROM sitzung_ereignis WHERE session_id = ? AND art = 'eingabe' ORDER BY id LIMIT 1").get(id); return e ? e.titel : null; };
  const anzeige = (r) => {
    const l = ledger(r.id);
    return {
      id: r.id, nr: r.nr, titel: titelAus(r.id), quelle: r.quelle, arbeitsbereich: r.arbeitsbereich, vorgang: l.ticket || r.vorgang, zuordnung: l.ticket ? (l.quelle === 'override' ? 'gebucht' : 'branch') : (r.vorgang ? 'vorgemerkt' : null),
      agent: r.agent, status: r.status, live: laufend.has(r.id), pid: r.pid, model: r.model, mode: r.mode, effort: r.effort, ctx_pct: r.ctx_pct,
      kosten_usd: l.anfragen ? Math.round(l.kosten_usd * 1e6) / 1e6 : null, kosten_cli_usd: r.kosten_usd, projekt: l.projekt, branch: l.branch,
      gestartet: r.gestartet, beendet: r.beendet, fehler: r.fehler, geladen: ausJson(r.init_json),
    };
  };

  // Status einer fremden Sitzung (Owner 20.10.): offen, bis 5 h lang keine
  // eigene Eingabe kam oder /exit (SessionEnd-Hook) sie beendet hat. Eine Eingabe
  // nach dem Ende (claude --resume) oeffnet wieder. Ereignis in den letzten
  // 2 Minuten = laeuft; sonst gilt die letzte Hook-Meldung (wartet/bereit),
  // ohne Hook "bereit". Die letzte Eingabe steht in activity (ingest.istEingabe).
  function letzteEingabe(id) {
    return db.prepare('SELECT MAX(ts) AS t FROM activity WHERE session_id = ? AND eingabe = 1').get(id).t;
  }
  function fremdStatus(id, letzte, eingabe) {
    const h = db.prepare("SELECT status, aktualisiert FROM sitzung WHERE id = ? AND quelle = 'fremd'").get(id);
    const hookMs = h && h.aktualisiert ? Date.parse(h.aktualisiert) : 0;
    const letzteMs = Math.max(letzte ? Date.parse(letzte) : 0, eingabe ? Date.parse(eingabe) : 0);
    if (h && h.status === 'beendet' && hookMs >= letzteMs) return 'beendet';
    // Hook nach dem letzten Ereignis: Claude ist fertig (Stop) oder fragt (Notification).
    const hookGilt = h && hookMs >= letzteMs && (h.status === 'wartet' || h.status === 'bereit');
    if (!hookGilt && letzteMs >= Date.now() - 120000) return 'laeuft';
    // Alte Logs ohne Eingabe-Kennung: dann zaehlt das letzte Ereignis. Eine
    // Hook-Meldung ist ebenfalls ein Lebenszeichen der Sitzung.
    const eingabeMs = Math.max(eingabe ? Date.parse(eingabe) : letzteMs, hookGilt ? hookMs : 0);
    if (eingabeMs < Date.now() - OFFEN_OHNE_EINGABE_MS) return 'beendet';
    return hookGilt ? h.status : 'bereit';
  }

  function wartendAus(id) {
    const f = db.prepare("SELECT titel FROM sitzung_ereignis WHERE session_id = ? AND art = 'frage' ORDER BY id DESC LIMIT 1").get(id);
    const h = db.prepare('SELECT aktualisiert FROM sitzung WHERE id = ?').get(id);
    return { frage: f ? f.titel : null, seit: h ? h.aktualisiert : null };
  }

  function liste({ offen = false } = {}) {
    const eigene = db.prepare(`SELECT rowid AS nr, * FROM sitzung WHERE quelle = 'c2invoice' ${offen ? `AND status IN (${OFFEN.map(() => '?').join(',')})` : ''} ORDER BY gestartet DESC LIMIT 100`).all(...(offen ? OFFEN : []));
    const bekannt = new Set([...db.prepare("SELECT id FROM sitzung WHERE quelle = 'c2invoice'").all().map((r) => r.id), ...db.prepare('SELECT folge FROM sitzung_folge').all().map((r) => r.folge)]);
    const seit = new Date(Date.now() - (offen ? OFFEN_OHNE_EINGABE_MS : 24 * 3600000)).toISOString();
    const eingaben = new Map(db.prepare('SELECT session_id AS id, MAX(ts) AS t FROM activity WHERE eingabe = 1 AND ts >= ? GROUP BY session_id').all(seit).map((r) => [r.id, r.t]));
    const fremd = db.prepare(`SELECT session_id AS id, MIN(ts) AS erste, MAX(ts) AS letzte, MAX(project) AS projekt, MAX(branch) AS branch, MAX(ticket) AS ticket,
      COALESCE(SUM(cost_usd), 0) AS kosten_usd FROM events WHERE ts >= ? AND COALESCE(source, '') <> 'lokal' GROUP BY session_id ORDER BY letzte DESC LIMIT 50`).all(seit)
      .filter((r) => !bekannt.has(r.id) && !werkzeug(r.projekt))
      .map((r) => ({ id: r.id, quelle: 'fremd', projekt: r.projekt, branch: r.branch, vorgang: r.ticket, kosten_usd: Math.round(r.kosten_usd * 1e6) / 1e6,
        gestartet: r.erste, letzte: r.letzte, live: Date.parse(r.letzte) >= Date.now() - 120000, status: fremdStatus(r.id, r.letzte, eingaben.get(r.id) || letzteEingabe(r.id)) }))
      .filter((s) => !offen || s.status !== 'beendet');
    // Wartende tragen Hook-Meldung und Zeitpunkt („Braucht dich“, B1).
    for (const s of fremd) if (s.status === 'wartet') Object.assign(s, wartendAus(s.id));
    return { sitzungen: [...eigene.map(anzeige), ...fremd], offen: anzahlOffen() };
  }

  // Fremde Sitzung: Transkript aus der JSONL, die der Abgleich kennt. Nur lesen.
  const transkriptCache = new Map();   // pfad -> { stand, wert }
  function transkript(id) {
    const f = db.prepare("SELECT path FROM files WHERE path LIKE ? ESCAPE '\\' ORDER BY length(path) LIMIT 1").get('%' + id + '.jsonl');
    if (!f) return null;
    let st, text;
    try {
      st = fs.statSync(f.path);
      const stand = st.size + ':' + st.mtimeMs;
      const c = transkriptCache.get(f.path);
      if (c && c.stand === stand) return c.wert;
      const ab = Math.max(0, st.size - MAX_JSONL);
      const buf = Buffer.alloc(st.size - ab);
      const fd = fs.openSync(f.path, 'r');
      let gelesen;
      try { gelesen = fs.readSync(fd, buf, 0, buf.length, ab); } finally { fs.closeSync(fd); }
      text = buf.subarray(0, gelesen).toString('utf8');
      if (ab > 0) text = text.slice(text.indexOf('\n') + 1);
    } catch (err) {
      // Datei weg oder gesperrt: kein Pfad nach aussen, nur der Hinweis.
      console.error('Sitzung ' + id + ': Transkript nicht lesbar:', err.message);
      return { fehler: 'Transkript nicht lesbar.', gekuerzt: false, ereignisse: [] };
    }
    const aus = [];
    let n = 0;
    for (const z of text.split('\n')) {
      if (!z.trim()) continue;
      let m; try { m = JSON.parse(z); } catch { continue; }
      if (m.isSidechain) continue;
      for (const e of ereignisseAus(m)) {
        const diff = e.art === 'edit' ? diffAus(e.koerper) : null;
        aus.push({ id: ++n, zeit: m.timestamp || null, art: e.art, titel: e.titel, meta: e.meta || null, kosten_usd: null, text: textAus(e.koerper), ...(diff ? { diff } : {}) });
      }
    }
    const wert = { gekuerzt: st.size > MAX_JSONL || aus.length > 1000, ereignisse: aus.slice(-1000) };
    if (transkriptCache.size > 20) transkriptCache.clear();
    transkriptCache.set(f.path, { stand: st.size + ':' + st.mtimeMs, wert });
    return wert;
  }

  function details(id) {
    if (typeof id !== 'string' || !SID_RE.test(id)) throw Object.assign(new Error('Sitzung unbekannt.'), { status: 404 });
    const r = zeile(id);
    if (r && r.quelle === 'c2invoice') {
      const ev = db.prepare('SELECT id, zeit, art, titel, meta, kosten_usd, koerper_json FROM sitzung_ereignis WHERE session_id = ? ORDER BY id DESC LIMIT 1000').all(id).reverse()
        .map(({ koerper_json: k, ...e }) => {
          const d = e.art === 'edit' ? diffAus(k) : null;
          const text = e.art === 'say' || e.art === 'eingabe' ? textAus(ausJson(k)) : undefined;
          return { ...e, ...(d ? { diff: d } : {}), ...(text ? { text } : {}) };
        });
      return { ...anzeige(r), nurLesen: false, ereignisse: ev, zug: zugVon(laufend.get(id)) };
    }
    const t = transkript(id);
    const l = ledger(id);
    if (!t && !r && !l.anfragen) throw Object.assign(new Error('Sitzung unbekannt.'), { status: 404 });
    const hook = db.prepare('SELECT id, zeit, art, titel, meta, kosten_usd FROM sitzung_ereignis WHERE session_id = ? ORDER BY id').all(id);
    const eingabe = letzteEingabe(id);
    const status = fremdStatus(id, l.letzte, eingabe);
    // Laeuft sie im Terminal: Zug seit der letzten Eingabe, Tokens aus dem Ledger (kommt mit dem 30-s-Abgleich).
    const zug = status === 'laeuft' && eingabe ? { seit: eingabe, tokens: db.prepare('SELECT COALESCE(SUM(output_tokens), 0) AS n FROM events WHERE session_id = ? AND ts >= ?').get(id, eingabe).n } : null;
    return {
      id, quelle: 'fremd', nurLesen: true, status, zug, projekt: l.projekt, branch: l.branch, cwd: l.cwd, vorgang: l.ticket,
      kosten_usd: l.anfragen ? Math.round(l.kosten_usd * 1e6) / 1e6 : null, letzte: l.letzte, gekuerzt: t ? t.gekuerzt : false,
      transkript: t ? (t.fehler || null) : 'Keine Transkript-Datei gefunden.', ereignisse: t ? t.ereignisse : [], hinweise: hook,
    };
  }

  function zuordnung(id, d = {}) {
    if (typeof id !== 'string' || !SID_RE.test(id)) throw Object.assign(new Error('Sitzung unbekannt.'), { status: 404 });
    const v = vormerken(id, typeof d.vorgang === 'string' ? d.vorgang : '');
    // Fortsetzungen nach /clear buchen mit.
    for (const f of folgen(id)) vormerken(f, v || '');
    if (zeile(id)) setze(id, { vorgang: v });
    ereignisse.sende('sitzung', { id, vorgang: v });
    return { id, vorgang: v };
  }

  const unbekannt = () => Object.assign(new Error('Sitzung unbekannt.'), { status: 404 });
  const konflikt = (text) => Object.assign(new Error(text), { status: 409 });

  // Zusammenfassung ins Vorgangs-Log (C6): das lokale Modell liest den Verlauf
  // (Auftraege, Claude-Text, Werkzeuge). Ohne Modell oder ohne Antwort entsteht
  // keine Zeile — lieber nichts als eine erfundene Zusammenfassung.
  const fasstZusammen = new Set();   // Sitzungen, deren Zusammenfassung gerade laeuft (Doppelklick)
  async function zusammenfassung(id) {
    if (typeof id !== 'string' || !SID_RE.test(id)) throw unbekannt();
    const d = details(id);
    if (!d.vorgang) throw konflikt('Die Sitzung hat keinen Vorgang. Erst zuordnen, dann zusammenfassen.');
    const verlauf = d.ereignisse.filter((e) => e.art !== 'zug' && e.titel).map((e) => (e.art === 'eingabe' ? 'Auftrag' : e.art === 'say' ? 'Claude' : e.art) + ': ' + e.titel);
    if (!verlauf.length) throw konflikt('Die Sitzung hat noch keinen Verlauf.');
    if (fasstZusammen.has(id)) throw konflikt('Die Zusammenfassung dieser Sitzung läuft schon.');
    // Hoechstens 12 000 Zeichen: der erste Auftrag (die Aufgabe) bleibt immer, gekuerzt wird die Mitte — sichtbar.
    let text = verlauf.join('\n');
    if (text.length > 12000) text = verlauf[0] + '\n[… Mitte des Verlaufs ausgelassen …]\n' + text.slice(-(11500 - verlauf[0].length));
    fasstZusammen.add(id);
    try {
      const r = await zusammenfassen(text);
      const inhalt = r && typeof r.text === 'string' ? r.text.trim() : '';
      if (!inhalt) throw Object.assign(new Error('Lokales Modell ' + ((r && r.fehlt) || 'ohne Antwort') + '.'), { status: 503 });
      const z = db.prepare('INSERT INTO vorgang_log (vorgang, zeit, quelle, text) VALUES (?,?,?,?)').run(d.vorgang, jetzt(), 'sitzung:' + id, kappe(inhalt, 4000));
      ereignisse.sende('sitzung', { id, vorgang_log: Number(z.lastInsertRowid) });
      return { vorgang: d.vorgang, id: Number(z.lastInsertRowid), text: kappe(inhalt, 4000) };
    } finally { fasstZusammen.delete(id); }
  }

  // Uebergabe (C6): ein fester Auftrag an die laufende Sitzung. Schreiben geht
  // ueber die normale Rechte-Freigabe; der Pfad liegt im Arbeitsbereich.
  function uebergabe(id) {
    if (typeof id !== 'string' || !SID_RE.test(id)) throw unbekannt();
    if (!laufend.has(id)) throw konflikt('Übergabe nur in einer laufenden Sitzung aus c2invoice.');
    const datei = 'handoffs/HANDOFF-' + jetzt().slice(0, 10) + '-' + id.slice(0, 8) + '.md';
    eingabe(id, { text: 'Schreib eine Übergabe für die nächste Sitzung nach ' + datei + ' (Ordner bei Bedarf anlegen): was gemacht wurde, aktueller Stand, nächste Schritte, offene Punkte, wichtige Pfade. Knapp, Markdown. Danach antworte nur mit dem Dateinamen.' });
    return { id, datei };
  }

  // Zum Terminal (C6): die Sitzung im echten Terminal fortsetzen. Laeuft sie
  // noch in c2invoice, kollidierten zwei Prozesse auf derselben Sitzung.
  function terminal(id) {
    if (typeof id !== 'string' || !SID_RE.test(id)) throw unbekannt();
    if (laufend.has(id)) throw konflikt('Die Sitzung läuft noch in c2invoice. Erst stoppen, dann im Terminal fortsetzen.');
    const r = zeile(id);
    let pfad = null;
    if (r && r.quelle === 'c2invoice') { const ab = arbeitsbereiche().find((a) => a.name === r.arbeitsbereich); pfad = ab ? heim(ab.pfad || '') : null; } else {
      const l = ledger(id);
      // Laeuft oder wartet sie im eigenen Terminal, schriebe --resume mit einem
      // zweiten Prozess in dieselbe Sitzungsdatei (B1, Owner 21.10.).
      const st = fremdStatus(id, l.letzte, letzteEingabe(id));
      if (st === 'wartet' || st === 'laeuft') throw konflikt('Die Sitzung läuft noch in deinem Terminal — dort antworten.');
      pfad = l.cwd;
    }
    if (!r && !pfad) throw unbekannt();
    let ordner = false;
    try { ordner = !!pfad && fs.statSync(pfad).isDirectory(); } catch { /* fehlt */ }
    if (!ordner) throw konflikt('Ordner der Sitzung nicht erreichbar.');
    // Der Pfad stammt bei fremden Sitzungen aus der JSONL (cwd). wt liest ";" als
    // Subcommand-Trenner, auch in Anfuehrungszeichen — ein Ordner "a; new-tab cmd"
    // fuehrte sonst einen fremden Befehl aus (Security-Review C6a). Ebenso nie
    // relativ, mit Steuerzeichen, Anfuehrungszeichen oder als Option ("-…").
    if (!path.isAbsolute(pfad) || /[;"\u0000-\u001f]/.test(pfad) || pfad.startsWith('-')) throw konflikt('Dieser Ordnername lässt sich nicht sicher an das Terminal übergeben (Semikolon, Anführungszeichen oder Steuerzeichen). Bitte von Hand öffnen.');
    const befehl = String(terminalBefehl() || '').trim();
    if (!befehl) throw konflikt('Kein Terminal-Befehl eingerichtet (terminal.befehl in config.json).');
    // {claude}: derselbe Pfad wie fuer Sitzungen — "claude" allein ist oft nur ein npm-Shim (.ps1/.cmd), den ohne Shell niemand startet.
    const claudeExe = /\{claude\}/.test(befehl) ? exe() : '';
    if (/\{claude\}/.test(befehl) && !claudeExe) throw Object.assign(new Error('Claude Code nicht gefunden (claude.exe).'), { status: 503 });
    const [datei, ...args] = befehlArgumente(befehl, { pfad, sitzung: aktuelleId(id), claude: claudeExe });
    // Pruefungen oben werfen sofort; erst der Start selbst ist asynchron.
    // Erfolg erst nach "spawn" — ein falscher Befehl meldet sich als Fehler, nicht als offenes Terminal.
    return new Promise((ok, nein) => {
      let k;
      try { k = spawnTerminal(datei, args, { cwd: pfad, detached: true, stdio: 'ignore', windowsHide: false }); } catch (err) { nein(Object.assign(new Error('Terminal nicht gestartet: ' + err.message), { status: 500 })); return; }
      k.on('error', (err) => { console.error('Zum Terminal: ' + datei + ' nicht gestartet:', err.message); nein(Object.assign(new Error('Terminal nicht gestartet (' + datei + '): ' + err.message), { status: 500 })); });
      // "spawn" heisst nur: der Prozess lief an. Endet er gleich mit Fehlercode (falsche Argumente), ist kein Terminal offen.
      k.on('exit', (code) => { if (code) { console.error('Zum Terminal: ' + datei + ' endete mit Code ' + code); nein(Object.assign(new Error('Terminal-Befehl endete mit Code ' + code + ' (terminal.befehl prüfen).'), { status: 500 })); } });
      k.on('spawn', () => setTimeout(() => { k.unref(); ok({ id, pfad }); }, terminalWarteMs));
    });
  }

  // Hook einer fremden Sitzung (integration/claude-hook.mjs): "wartet auf dich".
  // Der Aufrufer hat das Geheimnis schon geprueft.
  // Wartet heisst eine echte Anfrage (B1, Owner 21.10.): Rechte, MCP-Formular,
  // Hintergrund-Agent. idle_prompt kommt ~60 s nach jedem Zug-Ende und heisst
  // nur "fertig"; ohne Typ (aelteres Hook-Skript) entscheidet der Text.
  function hook(d = {}) {
    const sid = d.session_id;
    if (typeof sid !== 'string' || !SID_RE.test(sid)) throw new Error('session_id fehlt.');
    const art = d.hook_event_name;
    if (art !== 'Notification' && art !== 'Stop' && art !== 'SessionEnd') return { ignoriert: true };
    const r = zeile(sid);
    if (r && r.quelle === 'c2invoice') return { ignoriert: true };   // eigene Sitzung: Stream weiss es schon
    const meldung = kappe(String(d.message || 'Claude wartet auf dich'), 200);
    const typ = typeof d.notification_type === 'string' ? d.notification_type : null;
    let s;
    if (art === 'Notification') {
      const wartet = typ ? BRAUCHT_DICH.has(typ) : /permission/i.test(meldung);
      if (typ && !wartet && typ !== 'idle_prompt') return { ignoriert: true };
      // Leerlauf-Hinweis waehrend einer offenen Anfrage: die Anfrage bleibt offen.
      // Kam seitdem neue Arbeit, ist sie beantwortet — dann gilt der Leerlauf.
      if (!wartet && r && r.status === 'wartet' && fremdStatus(sid, ledger(sid).letzte, letzteEingabe(sid)) === 'wartet') return { id: sid, status: 'wartet' };
      s = wartet ? 'wartet' : 'bereit';
    } else s = art === 'SessionEnd' ? 'beendet' : 'bereit';   // SessionEnd: /exit, Strg+D, Fenster zu
    if (r) setze(sid, { status: s, aktualisiert: jetzt() });
    else db.prepare('INSERT INTO sitzung (id, quelle, status, gestartet, aktualisiert) VALUES (?,?,?,?,?)').run(sid, 'fremd', s, jetzt(), jetzt());
    // typ steht nur in meta, wenn er aus BRAUCHT_DICH stammt.
    if (s === 'wartet') ereignis(sid, { art: 'frage', titel: meldung, meta: typ ? 'hook:' + typ : 'hook' });
    // fremd: der Browser meldet die Rueckfrage (eigene Sitzungen melden sich als Freigabe).
    ereignisse.sende('sitzung', { id: sid, status: s, fremd: true, ...(s === 'wartet' ? { frage: meldung } : {}) });
    return { id: sid, status: s };
  }

  // Beim Start: was die letzte Instanz gestartet hatte, laeuft nicht mehr
  // unter unserer Kontrolle (stdin ist zu, die CLI endet nach dem Zug).
  // Kein Beenden ueber die alte PID: die kann laengst ein anderer Prozess sein.
  function aufraeumen() {
    const alt = db.prepare(`SELECT id FROM sitzung WHERE quelle = 'c2invoice' AND status IN (${OFFEN.map(() => '?').join(',')})`).all(...OFFEN);
    for (const { id } of alt) {
      setze(id, { status: 'beendet', pid: null, beendet: jetzt(), fehler: 'Server wurde neu gestartet.' });
      verwerfe(id, 'Sitzung beendet (Server neu gestartet)');
    }
    return alt.length;
  }
  // Beim Beenden des Servers: synchron, sonst laufen die Prozesse weiter.
  function beendeAlle() {
    for (const p of laufend.values()) { p.gestoppt = true; if (!p.weg) baumBeenden(p.kind.pid, { sync: true }); }
  }

  function routen(req, res, p, u, mittel) {
    const { sendJson } = mittel;
    const { fehler, post } = routenHelfer(req, res, p, mittel, 'Sitzungen');
    if (p === '/api/sitzungen' && req.method === 'GET') { sendJson(res, liste({ offen: u.searchParams.get('offen') === '1' })); return true; }
    if (p === '/api/sitzung' && req.method === 'POST') { post(starte); return true; }
    const m = p.match(/^\/api\/sitzung\/([0-9a-f-]{36})(?:\/(eingabe|stopp|zuordnung|zusammenfassung|uebergabe|terminal))?$/);
    if (!m) return false;
    const [, id, aktion] = m;
    if (!aktion && req.method === 'GET') { try { sendJson(res, details(id)); } catch (err) { fehler(err); } return true; }
    if (aktion && req.method === 'POST') {
      if (aktion === 'eingabe') post((d) => eingabe(id, d));
      else if (aktion === 'stopp') post(() => stopp(id));
      else if (aktion === 'zusammenfassung') post(() => zusammenfassung(id));
      else if (aktion === 'uebergabe') post(() => uebergabe(id));
      else if (aktion === 'terminal') post(() => terminal(id));
      else post((d) => zuordnung(id, d));
      return true;
    }
    return false;
  }

  return { starte, eingabe, stopp, liste, details, zuordnung, zusammenfassung, uebergabe, terminal, hook, aktuelleId, aufraeumen, beendeAlle, anzahlOffen, routen, laufend, schliesse: () => ereignisse.bus.off('ereignis', hoerer) };
}

module.exports = { erzeuge, ereignisseAus, artVon, titelVon, baumBeenden, befehlArgumente, vorgangLog, diffAus, routenHelfer, jetzt, kappe, ausJson, SID_RE };
