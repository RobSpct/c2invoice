'use strict';
// C10 Sprache lokal (design/cira/C10-SPRACHE.md). Erkennen ueber einen lokalen
// whisper-server (startet c2invoice selbst und beendet ihn nach Leerlauf),
// Sprechen ueber ElevenLabs mit Cache und Monatslimit — sonst spricht der
// Browser selbst (speechSynthesis), der Server antwortet dann JSON { fallback }
// mit 200 — der Rueckfall ist der Normalfall und kein Fehler (sonst stuende
// bei jeder Antwort ein roter Eintrag in der Browser-Konsole).
// Der Schluessel kommt aus einer Umgebungsvariablen und steht nie in einer
// Antwort, einem Fehltext oder der Kind-Umgebung.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { kindUmgebung } = require('./claude');
const { istLokal } = require('./modelle');
const metrics = require('./metrics');

const MAX_AUDIO = 2 * 1024 * 1024;   // 16 kHz mono 16 bit ≈ 60 s
const MAX_TEXT = 5000;
const KURZ = 400;                     // darunter das schnelle Modell
const SPRACHEN = ['de', 'en'];
const STIMME_RE = /^[A-Za-z0-9]{1,40}$/;
// Eigener Variablenname nur, wenn kindUmgebung() (claude.js) ihn als Geheimnis erkennt —
// sonst landete der Schluessel in der Umgebung von whisper und claude -p.
const VAR_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const GEHEIM_NAME = /(TOKEN|SECRET|API_?KEY)/i;
const WAV_TYP = /^audio\/(wav|wave|x-wav)\b/i;
const MODELLE = ['eleven_flash_v2_5', 'eleven_multilingual_v2', 'eleven_v4', 'eleven_v4_turbo', 'eleven_v3'];

const fehler = (status, text) => Object.assign(new Error(text), { status });
// Was eine Ablehnung von ElevenLabs fuer den Nutzer heisst. 402 kam im Owner-Test 27.10.:
// „Free users cannot use library voices via the API“ (paid_plan_required).
function httpGrund(status) {
  return (status === 401 ? 'ElevenLabs lehnt den Schlüssel ab'
    : status === 402 ? 'ElevenLabs: Diese Stimme braucht ein bezahltes Abo (Stimmen aus der Voice Library gehen im Free-Plan nicht über die Schnittstelle, nur die Standardstimmen des Kontos)'
      : status === 429 ? 'ElevenLabs: Kontingent oder Anfragegrenze erreicht'
        : 'ElevenLabs antwortet mit HTTP ' + status) + ' — Browser-Stimme.';
}

// Was vorgelesen wird: Markdown raus, Zeilen werden Saetze.
function ohneMarkdown(roh) {
  const zeilen = String(roh).replace(/\r\n?/g, '\n').replace(/```[\s\S]*?(```|$)/g, '').split('\n').map((z) => {
    if (/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(z) && z.includes('-')) return '';   // Trennzeile einer Tabelle
    // Links zuerst: der Alias-Strich eines Wiki-Links ist keine Tabellenspalte.
    let s = z.replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+(\[[ xX]\]\s+)?)/, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
    if (s.includes('|')) s = s.split('|').map((c) => c.trim()).filter(Boolean).join(', ');
    return s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
      .replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1$2').replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, '$1$2')
      .replace(/`([^`]*)`/g, '$1').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
  return zeilen.reduce((a, z) => (a ? a + (/[.!?:;,]$/.test(a) ? ' ' : '. ') : '') + z, '');
}

// Rohkoerper mit Byte-Grenze (leseKoerper in server.js kann nur JSON).
function leseRoh(req, max, fertig) {
  const teile = [];
  let n = 0, aus = false;
  req.on('data', (b) => {
    if (aus) return;
    n += b.length;
    if (n > max) { aus = true; fertig(fehler(413, 'Aufnahme zu lang (höchstens 2 MB, etwa 60 Sekunden).')); return; }
    teile.push(b);
  });
  req.on('end', () => { if (!aus) { aus = true; fertig(null, Buffer.concat(teile)); } });
  req.on('error', () => { if (!aus) { aus = true; fertig(fehler(400, 'Übertragung fehlgeschlagen.')); } });
}

// Ungelesener Koerper haelt die Verbindung offen (modelle.js holeJson).
const verwirf = async (r) => { if (r && r.body && typeof r.body.cancel === 'function') await r.body.cancel().catch(() => {}); };

// Beim Beenden von c2invoice keinen whisper-server zuruecklassen.
const LAUFENDE = new Set();
process.once('exit', () => { for (const p of LAUFENDE) try { p.kill(); } catch { /* schon weg */ } });

function erzeuge({ db, sprachCfg = () => ({}), einstellungen = () => ({}), env = process.env, fetchFn = fetch, spawnFn = spawn,
  existiert = fs.existsSync, cacheOrdner, jetzt = () => new Date(), pollMs = 250, bereitMs = 30000 }) {
  let proc = null, bereit = false, start = null, leerlauf = null, laufend = 0, stderrEnde = '', reserviert = 0;
  const gemeldet = new Set();
  // Pfade nur ins Protokoll (einmal): der Status ist ohne Geraet lesbar und Pfade tragen den Benutzernamen.
  const fehltPfad = (was, p) => { if (p && !gemeldet.has(p)) { gemeldet.add(p); console.error('Sprache: ' + was + ' nicht gefunden: ' + p); } };
  // Eine Buchung darf den Lauf nicht kippen: das Transkript oder das bezahlte Audio geht trotzdem raus.
  const buche = (fn) => { try { fn(); } catch (err) { console.error('Sprache: Buchung fehlgeschlagen:', err.message); } };
  const cfg = () => { const c = sprachCfg(); return c && typeof c === 'object' ? c : {}; };
  const sttCfg = () => (cfg().stt && typeof cfg().stt === 'object' ? cfg().stt : {});

  /* ---------- Erkennen (whisper) ---------- */
  function sttZiel() {
    const s = sttCfg();
    if (s.url) return istLokal(s.url) ? { url: String(s.url).replace(/\/+$/, '') } : { grund: 'Spracherkennung: nur eine lokale Adresse (127.0.0.1) ist erlaubt.' };
    if (!s.exe && !s.modell) return { grund: 'Spracherkennung nicht eingerichtet (sprache.stt in config.json, Anleitung in der README).' };
    if (!s.exe || !existiert(s.exe)) { fehltPfad('whisper-server', s.exe); return { grund: 'whisper-server nicht gefunden (sprache.stt.exe in config.json).' }; }
    if (!s.modell || !existiert(s.modell)) { fehltPfad('whisper-Modell', s.modell); return { grund: 'whisper-Modell nicht gefunden (sprache.stt.modell in config.json).' }; }
    const port = Number.isInteger(s.port) && s.port > 1024 && s.port < 65536 ? s.port : 8178;
    return { url: 'http://127.0.0.1:' + port, exe: s.exe, modell: s.modell, port };
  }
  async function antwortet(url) {
    try { const r = await fetchFn(url + '/', { signal: AbortSignal.timeout(1000), redirect: 'error' }); await verwirf(r); return r.ok; } catch { return false; }
  }
  async function starte(z, lang) {
    if (await antwortet(z.url)) return;   // laeuft schon, von wem auch immer
    const p = spawnFn(z.exe, ['-m', z.modell, '-l', lang, '--host', '127.0.0.1', '--port', String(z.port)],
      { windowsHide: true, env: kindUmgebung(env), stdio: ['ignore', 'ignore', 'pipe'] });
    proc = p; bereit = false; stderrEnde = '';
    LAUFENDE.add(p);
    if (p.stderr) p.stderr.on('data', (b) => { stderrEnde = (stderrEnde + b).slice(-2000); });
    const weg = () => { LAUFENDE.delete(p); if (proc === p) { proc = null; bereit = false; } };
    p.on('error', (err) => { console.error('Sprache: whisper-server startet nicht:', err.message); weg(); });
    p.on('exit', weg);
    const bis = Date.now() + bereitMs;
    while (Date.now() < bis) {
      if (proc !== p) throw fehler(502, 'whisper-server hat sich beim Start beendet.');
      if (await antwortet(z.url)) { bereit = true; return; }
      await new Promise((ok) => setTimeout(ok, pollMs));
    }
    p.kill();
    throw fehler(502, 'whisper-server antwortet nicht.');
  }
  function weckeLeerlauf() {
    clearTimeout(leerlauf);
    if (!proc || laufend) return;
    const min = Number(sttCfg().leerlaufMinuten);
    const ms = (Number.isFinite(min) && min > 0 ? Math.min(min, 1440) : 10) * 60000;
    leerlauf = setTimeout(() => { if (proc && !laufend) proc.kill(); }, ms);
    if (leerlauf.unref) leerlauf.unref();
  }
  const bucheStt = (t0, f) => buche(() => db.prepare("INSERT INTO sprache_lauf (zeit, art, anbieter, zeichen, ms, cache, fehler) VALUES (?, 'stt', 'whisper', 0, ?, 0, ?)")
    .run(jetzt().toISOString(), Date.now() - t0, f));

  async function erkenne(buf, sprache = 'de') {
    const lang = SPRACHEN.includes(sprache) ? sprache : 'de';
    if (!Buffer.isBuffer(buf) || !buf.length) throw fehler(400, 'Keine Aufnahme.');
    const z = sttZiel();
    if (z.grund) throw fehler(503, z.grund);
    const t0 = Date.now();
    laufend++;
    clearTimeout(leerlauf);
    try {
      if (z.exe && !(proc && bereit)) { if (!start) start = starte(z, lang).finally(() => { start = null; }); await start; }
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: 'audio/wav' }), 'aufnahme.wav');
      fd.append('response_format', 'json');
      fd.append('language', lang);
      const r = await fetchFn(z.url + '/inference', { method: 'POST', body: fd, signal: AbortSignal.timeout(60000), redirect: 'error' });
      if (!r.ok) { await verwirf(r); throw fehler(502, 'whisper antwortet mit HTTP ' + r.status + '.'); }
      const d = await r.json();
      // whisper meldet manche Fehler mit 200 und { error } — das ist kein „nichts verstanden“.
      if (!d || typeof d.text !== 'string') throw fehler(502, 'whisper: ' + String((d && d.error) || 'unerwartete Antwort').slice(0, 200));
      // [BLANK_AUDIO] und Aehnliches markiert whisper fuer Stille.
      const text = d.text.replace(/\[[A-Z_ ]+\]/g, ' ').replace(/\s+/g, ' ').trim();
      bucheStt(t0, null);
      return { text };
    } catch (err) {
      const e = err.status ? err : fehler(502, 'whisper antwortet nicht.');
      console.error('Sprache: Erkennen:', err.message, stderrEnde ? '| whisper: ' + stderrEnde.slice(-300).replace(/\s+/g, ' ') : '');
      bucheStt(t0, e.message);
      throw e;
    } finally {
      laufend--;
      weckeLeerlauf();
    }
  }

  function stoppe() {
    clearTimeout(leerlauf);
    if (proc) proc.kill();
  }

  /* ---------- Sprechen (ElevenLabs, sonst Browser) ---------- */
  function ttsZiel(e) {
    const anbieter = e.stimmeAnbieter === 'elevenlabs' ? 'elevenlabs' : 'browser';
    const limit = Number(e.stimmeMonatslimitZeichen) || 0;
    const verbraucht = metrics.spracheZeichenMonat(db, { jetzt: jetzt() });
    if (anbieter === 'browser') return { anbieter, stimme: '', limit, verbraucht, bereit: true, grund: null };
    const el = (cfg().tts && cfg().tts.elevenlabs) || {};
    const name = typeof el.apiKeyEnvVar === 'string' && VAR_RE.test(el.apiKeyEnvVar) && GEHEIM_NAME.test(el.apiKeyEnvVar) ? el.apiKeyEnvVar : 'ELEVENLABS_API_KEY';
    const stimme = typeof e.stimmeElevenlabs === 'string' ? e.stimmeElevenlabs : '';
    const grund = !env[name] ? 'Umgebungsvariable ' + name + ' fehlt — Browser-Stimme.'
      : !STIMME_RE.test(stimme) ? 'Keine ElevenLabs-Stimme eingetragen — Browser-Stimme.' : null;
    return { anbieter, stimme, limit, verbraucht, bereit: !grund, grund, keyName: name };
  }
  const bucheTts = (t0, zeichen, cache, f) => buche(() => db.prepare("INSERT INTO sprache_lauf (zeit, art, anbieter, zeichen, ms, cache, fehler) VALUES (?, 'tts', 'elevenlabs', ?, ?, ?, ?)")
    .run(jetzt().toISOString(), zeichen, Date.now() - t0, cache, f));

  async function sprich({ text } = {}) {
    if (typeof text !== 'string') throw fehler(400, 'Text fehlt.');
    // Vor der Markdown-Entfernung begrenzen: deren Regexe sind bei langen Zeilen teuer.
    if (text.length > 2 * MAX_TEXT) throw fehler(413, 'Text zu lang zum Vorlesen (höchstens 5000 Zeichen).');
    const t = ohneMarkdown(text);
    if (!t) throw fehler(400, 'Text fehlt.');
    if (t.length > MAX_TEXT) throw fehler(413, 'Text zu lang zum Vorlesen (höchstens 5000 Zeichen).');
    const e = einstellungen();
    const z = ttsZiel(e);
    // Der Rueckfall traegt den bereinigten Text: der Browser spricht ihn, ohne selbst Markdown zu kennen.
    if (z.anbieter === 'browser') return { fallback: 'browser', grund: null, text: t };
    if (!z.bereit) return { fallback: 'browser', grund: z.grund, text: t };
    const wahl = t.length < KURZ ? e.stimmeModellKurz : e.stimmeModellLang;
    const modell = MODELLE.includes(wahl) ? wahl : (t.length < KURZ ? MODELLE[0] : MODELLE[1]);
    const datei = path.join(cacheOrdner, crypto.createHash('sha1').update(['elevenlabs', z.stimme, modell, t].join('\u0000')).digest('hex') + '.mp3');
    const t0 = Date.now();
    let alt = null;
    try { alt = fs.readFileSync(datei); } catch (err) { if (err.code !== 'ENOENT') console.error('Sprache: Cache unlesbar:', err.message); }
    if (alt && alt.length) { bucheTts(t0, 0, 1, null); return { audio: alt, aus: 'cache' }; }
    // Reserviert vor dem Aufruf: parallele Anfragen duerfen das Limit nicht gemeinsam ueberschreiten.
    if (z.verbraucht + reserviert + t.length > z.limit) return { fallback: 'browser', grund: 'Monatslimit ElevenLabs erreicht (' + z.verbraucht + ' von ' + z.limit + ' Zeichen) — Browser-Stimme.', text: t };
    reserviert += t.length;
    let audio;
    try {
      const r = await fetchFn('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(z.stimme) + '/stream?output_format=mp3_44100_128', {
        method: 'POST', headers: { 'xi-api-key': env[z.keyName], 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: t, model_id: modell }), signal: AbortSignal.timeout(20000), redirect: 'error',
      });
      if (!r.ok) {
        await verwirf(r);
        bucheTts(t0, 0, 0, 'HTTP ' + r.status);
        return { fallback: 'browser', grund: httpGrund(r.status), text: t };
      }
      audio = Buffer.from(await r.arrayBuffer());
      // Nur echtes Audio kommt in den Cache, sonst stuende ein kaputter Eintrag fuer immer dort.
      if (!/^audio\//.test(r.headers.get('content-type') || '') || !audio.length) {
        bucheTts(t0, t.length, 0, 'kein Audio');
        return { fallback: 'browser', grund: 'ElevenLabs liefert kein Audio — Browser-Stimme.', text: t };
      }
    } catch (err) {
      // Nur Name und Ursache-Code: Fehltexte von fetch koennen die URL tragen (nie den Kopf).
      console.error('Sprache: ElevenLabs:', err.name, (err.cause && err.cause.code) || '');
      // Nach Zeitueberschreitung kann ElevenLabs abgerechnet haben: vorsichtshalber buchen.
      const zeit = err.name === 'TimeoutError';
      bucheTts(t0, zeit ? t.length : 0, 0, zeit ? 'Zeitüberschreitung' : 'nicht erreichbar');
      return { fallback: 'browser', grund: 'ElevenLabs nicht erreichbar — Browser-Stimme.', text: t };
    } finally {
      reserviert -= t.length;
    }
    bucheTts(t0, t.length, 0, null);
    // Atomar: ein abgebrochenes Schreiben hinterlaesst keine halbe Datei unter dem Cache-Namen.
    try {
      fs.mkdirSync(cacheOrdner, { recursive: true });
      const tmp = datei + '.' + process.pid + '.' + Date.now() + '.tmp';
      fs.writeFileSync(tmp, audio);
      fs.renameSync(tmp, datei);
    } catch (err) { console.error('Sprache: Cache nicht geschrieben:', err.message); }
    return { audio, aus: 'elevenlabs' };
  }

  function status() {
    const z = sttZiel();
    const e = einstellungen();
    const { keyName, ...tts } = ttsZiel(e);
    const vorlesen = ['auto', 'immer', 'nie'].includes(e.antwortenVorlesen) ? e.antwortenVorlesen : 'auto';
    // „bereit“ heisst nur: eingerichtet. Ob ElevenLabs wirklich spricht, sagt erst der letzte Versuch.
    let letzterFehler = null;
    if (tts.anbieter === 'elevenlabs') {
      const l = db.prepare("SELECT zeit, fehler FROM sprache_lauf WHERE art = 'tts' ORDER BY id DESC LIMIT 1").get();
      if (l && l.fehler) {
        const m = /^HTTP (\d+)$/.exec(l.fehler);
        letzterFehler = { zeit: l.zeit, grund: m ? httpGrund(Number(m[1])) : 'ElevenLabs: ' + l.fehler + ' — Browser-Stimme.' };
      }
    }
    return { stt: { bereit: !z.grund, grund: z.grund || null, laeuft: !!(proc && bereit) }, tts: { ...tts, vorlesen, letzterFehler } };
  }

  /* ---------- Routen ---------- */
  function routen(req, res, p, u, { sendJson, leseKoerper }) {
    if (p === '/api/sprache/status' && req.method === 'GET') { sendJson(res, status()); return true; }
    if (p === '/api/sprache/erkennen' && req.method === 'POST') {
      if (!WAV_TYP.test(req.headers['content-type'] || '')) { req.resume(); sendJson(res, { error: 'Erwartet audio/wav.' }, 415); return true; }
      leseRoh(req, MAX_AUDIO, (err, buf) => {
        if (err) return sendJson(res, { error: err.message }, err.status);
        erkenne(buf, u.searchParams.get('sprache')).then((r) => sendJson(res, r), (e) => {
          if (!e.status) console.error('Sprache:', e);
          sendJson(res, { error: e.status ? e.message : 'Interner Fehler, Details im Serverprotokoll.' }, e.status || 500);
        });
      });
      return true;
    }
    if (p === '/api/sprache/sprechen' && req.method === 'POST') {
      leseKoerper(req, (fehlerText, d) => {
        if (fehlerText) return sendJson(res, { error: fehlerText }, 400);
        sprich(d && typeof d === 'object' ? d : {}).then((r) => {
          if (r.fallback) return sendJson(res, r);
          res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'content-length': r.audio.length, 'x-sprache-aus': r.aus });
          res.end(r.audio);
        }, (e) => {
          if (!e.status) console.error('Sprache:', e);
          sendJson(res, { error: e.status ? e.message : 'Interner Fehler, Details im Serverprotokoll.' }, e.status || 500);
        });
      });
      return true;
    }
    return false;
  }

  return { status, erkenne, sprich, stoppe, routen };
}

module.exports = { erzeuge, ohneMarkdown, MODELLE, STIMME_RE };
