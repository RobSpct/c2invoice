'use strict';
// Lokale Modellserver fuer Cira (Modell-Block, Owner 15.10.2026): welche Modelle
// der Server kennt, ob er Ollama ist, wo Ollama die Modelle ablegt und das Laden
// eines Modells per Name. Gesprochen wird mit lokaleModelle.upstreamUrl direkt,
// nicht ueber den Proxy — Liste und Download sind keine Nutzung.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile, execFileSync } = require('node:child_process');

const basis = (cfg) => String((cfg.lokaleModelle || {}).upstreamUrl || '').replace(/\/+$/, '');
function istLokal(url) {
  try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname); } catch { return false; }
}

/* ---------- Liste ---------- */
// Die zuletzt gesehene Liste: Speichern prueft dagegen, ohne den Server ein
// zweites Mal zu fragen, wenn die Oberflaeche gerade geladen hat.
let letzte = { zeit: 0, ids: null, laufzeit: null };

async function holeJson(fetchFn, url, ms = 4000) {
  const r = await fetchFn(url, { signal: AbortSignal.timeout(ms), redirect: 'error' });
  // Ungelesener Koerper haelt die Verbindung bis zur Speicherbereinigung offen;
  // unter Windows brach Node daran ab (libuv, Selfcheck M2), wenn der Server schloss.
  if (!r.ok) { if (r.body && typeof r.body.cancel === 'function') await r.body.cancel().catch(() => {}); throw new Error('HTTP ' + r.status); }
  return r.json();
}

// Welche Laufzeit antwortet, an ihren eigenen Endpunkten (Recherche 15.10.).
// Ollama zuletzt: Lemonade bietet auch Ollama-Endpunkte an, ein antwortendes
// /api/version allein beweist also nichts. Nur bei Ollama gibt es Laden und Ordner.
async function laufzeit(cfg, fetchFn) {
  const b = basis(cfg);
  const frag = (p) => holeJson(fetchFn, b + p, 2000).catch(() => null);
  const [lemonade, lmstudio, llamacpp, ollama] = await Promise.all(['/v1/system-info', '/api/v1/models', '/props', '/api/version'].map(frag));
  if (lemonade && typeof lemonade === 'object') return 'lemonade';
  if (lmstudio && Array.isArray(lmstudio.models)) return 'lmstudio';
  if (llamacpp && llamacpp.build_info) return 'llamacpp';
  if (ollama && typeof ollama.version === 'string') return 'ollama';
  // Keine Sonde kam durch (Server laedt gerade ein Modell, Zeitgrenze): nicht raten,
  // sonst hiesse ein Ollama kurzzeitig "kein Ollama" (Silent-Failure M4).
  return [lemonade, lmstudio, llamacpp, ollama].every((x) => x === null) ? 'unbekannt' : 'openai';
}

async function liste({ cfg, fetchFn = fetch }) {
  const b = basis(cfg);
  if (!b) return { eingerichtet: false, erreichbar: false, laufzeit: null, modelle: [], fehler: 'Lokale Modelle sind nicht eingerichtet (lokaleModelle in config.json).' };
  let ids;
  try {
    const j = await holeJson(fetchFn, b + '/v1/models');
    if (!Array.isArray(j && j.data)) throw new Error('unerwartete Antwort von /v1/models');
    ids = j.data.map((m) => m && m.id).filter((id) => typeof id === 'string' && id.length <= 200);
  } catch (err) {
    return { eingerichtet: true, erreichbar: false, laufzeit: null, modelle: [], fehler: 'Modellserver nicht erreichbar (' + err.message + ').', lokal: istLokal(b) };
  }
  const art = await laufzeit(cfg, fetchFn);
  const groesse = new Map();
  if (art === 'ollama') {
    try { for (const m of (await holeJson(fetchFn, b + '/api/tags')).models || []) if (m && typeof m.name === 'string' && Number.isFinite(m.size)) groesse.set(m.name, m.size); } catch { /* Groesse ist nur Beiwerk */ }
  }
  ids = [...new Set(ids)].sort((x, y) => x.localeCompare(y));
  letzte = { zeit: Date.now(), ids, laufzeit: art };
  if (art === 'unbekannt') return { eingerichtet: true, erreichbar: true, laufzeit: art, lokal: istLokal(b), modelle: ids.map((id) => ({ id })), fehler: 'Laufzeit nicht erkannt (Zeitüberschreitung) — Liste aktualisieren.' };
  return {
    eingerichtet: true, erreichbar: true, laufzeit: art, lokal: istLokal(b),
    modelle: ids.map((id) => ({ id, ...(groesse.has(id) ? { groesse_gb: Math.round(groesse.get(id) / 1e8) / 10 } : {}) })),
  };
}
// Bekannte Namen fuer die Pruefung beim Speichern: frisch, wenn die letzte Liste aelter als eine Minute ist.
async function bekannteModelle({ cfg, fetchFn = fetch }) {
  if (letzte.ids && Date.now() - letzte.zeit < 60000) return letzte.ids;
  const l = await liste({ cfg, fetchFn });
  if (!l.erreichbar) throw new Error(l.fehler || 'Modellserver nicht erreichbar.');
  return letzte.ids;
}

/* ---------- Modellordner (Ollama) ---------- */
const NAME = 'OLLAMA_MODELS';
// Windows: die Registry ist frischer als process.env — ein nach dem Start
// von c2invoice gesetzter Wert steht nur dort.
// reg query blockiert kurz; jede Anfrage auf /api/modelle fragte sonst zweimal (Security-Review C-M 4).
let umgebung = { zeit: 0, wert: undefined };
function leseUmgebung(plattform = process.platform) {
  if (plattform === 'win32' && Date.now() - umgebung.zeit < 5000) return umgebung.wert;
  const w = leseUmgebungJetzt(plattform);
  if (plattform === 'win32') umgebung = { zeit: Date.now(), wert: w };
  return w;
}
function leseUmgebungJetzt(plattform) {
  if (plattform === 'win32') {
    for (const [quelle, schluessel] of [['benutzer', 'HKCU\\Environment'], ['system', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment']]) {
      try {
        const aus = execFileSync('reg', ['query', schluessel, '/v', NAME], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
        const m = aus.match(/OLLAMA_MODELS\s+REG_(?:EXPAND_)?SZ\s+(.+)/i);
        // REG_EXPAND_SZ: %USERPROFILE% und Co. aufloesen, sonst stimmen Laufwerk und Freiplatz nicht.
        if (m) return { wert: m[1].trim().replace(/%([^%]+)%/g, (x, n) => process.env[n] ?? x), quelle };
      } catch (err) {
        // reg endet mit 1, wenn der Wert fehlt; alles andere ist ein echter Fehler.
        if (err.status !== 1) return { wert: null, quelle: 'fehler', fehler: 'Registry nicht lesbar: ' + String(err.message).split('\n')[0] };
      }
    }
  }
  return process.env[NAME] ? { wert: process.env[NAME], quelle: 'prozess' } : null;
}

function freiGb(p) {
  let d = path.resolve(p);
  while (!fs.existsSync(d)) { const hoch = path.dirname(d); if (hoch === d) return null; d = hoch; }
  try { const s = fs.statfsSync(d); return Math.round(s.bavail * s.bsize / 1e8) / 10; } catch { return null; }
}
const laufwerk = (p) => (/^[A-Za-z]:/.test(p) ? p.slice(0, 2).toUpperCase() : null);

function ordner({ cfg, lies = leseUmgebung, plattform = process.platform, heim = os.homedir(), frei = freiGb } = {}) {
  if (!istLokal(basis(cfg))) return { lokal: false };
  const u = lies(plattform);
  if (u && u.fehler) return { lokal: true, pfad: null, quelle: 'fehler', fehler: u.fehler, aendern: plattform === 'win32' };
  const pfad = u ? u.wert : path.join(heim, '.ollama', 'models');
  if (/%/.test(pfad)) return { lokal: true, pfad, quelle: u.quelle, frei_gb: null, systemlaufwerk: false, aendern: plattform === 'win32', fehler: 'Variable im Pfad nicht auflösbar' };
  const sys = plattform === 'win32' && laufwerk(pfad) === String(process.env.SystemDrive || 'C:').toUpperCase();
  return { lokal: true, pfad, quelle: u ? u.quelle : 'standard', frei_gb: frei(pfad), systemlaufwerk: sys, aendern: plattform === 'win32' };
}

// Nur ein absoluter Windows-Pfad mit Laufwerksbuchstabe: kein UNC (\\server),
// kein "..", keine Zeichen, die setx oder Ollama anders lesen.
function pruefeOrdner(p) {
  const s = typeof p === 'string' ? p.trim().replace(/[\\/]+$/, '') : '';
  if (!s || s.length > 200) throw new Error('Ordner: 1 bis 200 Zeichen.');
  if (!/^[A-Za-z]:\\[^"%<>|*?:\u0000-\u001f]*$/.test(s.replace(/\//g, '\\'))) throw new Error('Ordner: absoluter Pfad mit Laufwerk, z. B. D:\\Ollama\\models.');
  const norm = s.replace(/\//g, '\\');
  if (norm.split('\\').some((teil) => teil === '..' || teil === '.')) throw new Error('Ordner: ohne . und ..');
  // Windows legt CON, NUL, "x." oder "x " an, Explorer und rd kriegen sie kaum wieder weg (Security-Review C-M 1).
  if (norm.split('\\').slice(1).some((t) => /[. ]$/.test(t) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(t))) throw new Error('Ordner: ungültiger Name (Gerätename oder Punkt/Leerzeichen am Ende).');
  // Systemordner nie: dort schreibt Ollama ohne Adminrechte ohnehin nicht.
  if (/^[A-Za-z]:\\(windows|program files|program files \(x86\)|programdata)(\\|$)/i.test(norm)) throw new Error('Ordner: nicht in Windows- oder Programmordnern.');
  return norm;
}

const setx = (name, wert) => new Promise((ja, nein) => execFile('setx', [name, wert], { windowsHide: true }, (err) => (err ? nein(new Error('setx: ' + err.message)) : ja())));

async function setzeOrdner({ cfg, pfad, bestaetigt, plattform = process.platform, setze = setx, probe = process.env.C2I_PROBE === '1', lies = leseUmgebung }) {
  if (!istLokal(basis(cfg))) throw new Error('Der Modellserver laeuft nicht auf diesem Rechner; den Ordner legt dort sein Betreiber fest.');
  if (plattform !== 'win32') throw new Error('Aus der Oberflaeche nur unter Windows. Sonst OLLAMA_MODELS im Shell-Profil setzen und Ollama neu starten.');
  const ziel = pruefeOrdner(pfad);
  const info = { pfad: ziel, frei_gb: freiGb(ziel), systemlaufwerk: laufwerk(ziel) === String(process.env.SystemDrive || 'C:').toUpperCase() };
  if (bestaetigt !== true) return { bestaetigen: true, ziel: info };
  if (probe) return { ok: true, probe: true, ziel: info, hinweis: 'Probe: OLLAMA_MODELS wurde nicht gesetzt.' };
  fs.mkdirSync(ziel, { recursive: true });
  await setze(NAME, ziel);
  return { ok: true, ordner: ordner({ cfg, lies, plattform }), hinweis: 'Gilt nach einem Neustart von Ollama. Vorhandene Modelle bleiben im alten Ordner.' };
}

/* ---------- Laden (Ollama /api/pull) ---------- */
// Ollama-Namen (llama3.2:3b, nutzer/modell:tag) und HuggingFace-GGUF (hf.co/nutzer/repo:Q4_K_M).
const MODELLNAME = /^(hf\.co\/)?[A-Za-z0-9][A-Za-z0-9._-]{0,79}(\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}){0,1}(:[A-Za-z0-9._-]{1,60})?$/;
let ladeLaeuft = false;

async function lade({ cfg, name, bestaetigt, fetchFn = fetch, melde = () => {}, signal = null, lies = leseUmgebung, frei = freiGb, stillMs = 120000 }) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!MODELLNAME.test(n)) throw new Error('Modellname ungueltig, z. B. qwen3:8b oder hf.co/nutzer/repo:Q4_K_M.');
  const art = await laufzeit(cfg, fetchFn);
  if (art === 'unbekannt') throw new Error('Laufzeit nicht erkannt (Zeitüberschreitung) — Liste aktualisieren und nochmal versuchen.');
  if (art !== 'ollama') throw new Error('Laden geht nur mit Ollama. LM Studio und andere laden Modelle in ihrer eigenen Oberflaeche.');
  const ziel = ordner({ cfg, lies, frei });
  // Unter 2 GB passt kein brauchbares Modell; Ollama braeche mitten im Download ab (Security-Review C-M 5).
  if (ziel.lokal && ziel.frei_gb != null && ziel.frei_gb < 2) throw new Error('Zu wenig Platz im Modellordner (' + ziel.frei_gb + ' GB frei).');
  if (bestaetigt !== true) return { bestaetigen: true, name: n, fremd: n.startsWith('hf.co/'), ziel };
  if (ladeLaeuft) throw new Error('Es laedt schon ein Modell.');
  ladeLaeuft = true;
  // Steht der Strom still (Netz weg, Ollama haengt), bricht ein Leerlauf-Wecker ab,
  // sonst bliebe die Sperre bis zum Neustart (Silent-Failure M3).
  const ac = new AbortController();
  const weiter = () => ac.abort();
  if (signal) { if (signal.aborted) ac.abort(); else signal.addEventListener('abort', weiter, { once: true }); }
  let still = false, wecker = null;
  const wecke = () => { clearTimeout(wecker); wecker = setTimeout(() => { still = true; ac.abort(); }, stillMs); };
  try {
    wecke();
    const r = await fetchFn(basis(cfg) + '/api/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: n, stream: true }), redirect: 'error', signal: ac.signal });
    if (!r.ok || !r.body) throw new Error('Ollama: HTTP ' + r.status);
    let rest = '', letzter = null, kaputt = null;
    const zeile = (z) => {
      if (!z.trim()) return;
      let o;
      try { o = JSON.parse(z); } catch { kaputt = z.slice(0, 200); return; }
      if (o.error) throw new Error('Ollama: ' + String(o.error).slice(0, 200));
      letzter = String(o.status || '');
      melde({ status: letzter.slice(0, 80), ...(Number.isFinite(o.total) ? { gesamt: o.total } : {}), ...(Number.isFinite(o.completed) ? { fertig: o.completed } : {}) });
    };
    const dec = new TextDecoder();
    // Jedes Lesen im Wettlauf mit dem Abbruch: ein Strom, der das Signal nicht
    // beachtet, liesse sonst ein Promise ewig offen (Node endet dann still).
    const abbruch = new Promise((_, nein) => { const f = () => nein(Object.assign(new Error('abgebrochen'), { name: 'AbortError' })); if (ac.signal.aborted) f(); else ac.signal.addEventListener('abort', f, { once: true }); });
    abbruch.catch(() => {});
    const it = r.body[Symbol.asyncIterator]();
    try {
      for (;;) {
        const { value, done } = await Promise.race([it.next(), abbruch]);
        if (done) break;
        wecke();
        rest += dec.decode(value, { stream: true });
        const teile = rest.split('\n');
        rest = teile.pop();
        teile.forEach(zeile);
      }
    } finally {
      if (typeof it.return === 'function') Promise.resolve(it.return()).catch(() => {});
    }
    zeile(rest + dec.decode());
    if (letzter !== 'success') throw new Error('Ollama hat den Download nicht abgeschlossen' + (letzter ? ' (' + letzter + ')' : '') + (kaputt ? '; unlesbare Zeile: ' + kaputt : '') + '.');
    return { ok: true, name: n };
  } catch (err) {
    if (still) throw new Error('Download hängt — seit ' + Math.round(stillMs / 60000) + ' Minuten nichts empfangen.');
    throw err;
  } finally {
    clearTimeout(wecker);
    if (signal) signal.removeEventListener('abort', weiter);
    ladeLaeuft = false;
    // Auch nach Abbruch: das Modell kann schon da sein, die naechste Pruefung fragt frisch.
    letzte = { zeit: 0, ids: null, laufzeit: null };
  }
}

/* ---------- Routen ---------- */
// Laden und Ordner aendern greifen ueber das Werkzeug hinaus (Download, Benutzer-
// Umgebung): wie bei den Freigaben nur aus der eigenen Oberflaeche, nicht per curl.
function ausOberflaeche(req) {
  const origin = req.headers.origin;
  return req.headers['sec-fetch-site'] === 'same-origin' || (origin && origin === 'http://' + req.headers.host);
}
function routen(req, res, p, { sendJson, leseKoerper, cfg, fetchFn = fetch }) {
  if (p === '/api/modelle' && req.method === 'GET') {
    liste({ cfg, fetchFn }).then((l) => sendJson(res, { ...l, ordner: l.laufzeit === 'ollama' || !l.erreichbar ? ordner({ cfg }) : { lokal: istLokal(basis(cfg)), fremd: true } }))
      .catch((err) => { console.error('Modelle:', err); sendJson(res, { error: err.message }, 500); });
    return true;
  }
  if ((p === '/api/modelle/laden' || p === '/api/modelle/ordner') && req.method === 'POST') {
    if (!ausOberflaeche(req)) { sendJson(res, { error: 'Nur aus der Oberfläche' }, 403); return true; }
    leseKoerper(req, async (fehler, d) => {
      if (fehler) return sendJson(res, { error: fehler }, 400);
      const b = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
      if (p === '/api/modelle/ordner') {
        try { sendJson(res, await setzeOrdner({ cfg, pfad: b.pfad, bestaetigt: b.bestaetigt })); } catch (err) { sendJson(res, { error: err.message }, 400); }
        return;
      }
      // Laden: Pruefung vor dem Strom als JSON-Fehler, danach NDJSON (eine Zeile je Fortschritt).
      let vorab;
      try { vorab = await lade({ cfg, name: b.name, bestaetigt: false, fetchFn }); } catch (err) { return sendJson(res, { error: err.message }, 400); }
      if (b.bestaetigt !== true) return sendJson(res, vorab);
      if (ladeLaeuft) return sendJson(res, { error: 'Es lädt schon ein Modell.' }, 409);
      res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
      const zeile = (o) => { if (!res.writableEnded) res.write(JSON.stringify(o) + '\n'); };
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ac.abort(); });
      lade({ cfg, name: b.name, bestaetigt: true, fetchFn, signal: ac.signal, melde: (f) => zeile({ typ: 'fortschritt', ...f }) })
        .then((r) => zeile({ typ: 'fertig', name: r.name }), (err) => { console.error('Modell laden:', b.name, err.message); zeile({ typ: 'fehler', error: err.name === 'AbortError' ? 'abgebrochen' : err.message }); })
        .finally(() => res.end());
    });
    return true;
  }
  return false;
}

module.exports = { routen, liste, bekannteModelle, laufzeit, ordner, pruefeOrdner, setzeOrdner, lade, istLokal, MODELLNAME };
