'use strict';
/* Sprache (C10, design/cira/C10-SPRACHE.md): Push-to-Talk und Vorlesen fuer
   Shell, Cockpit und Briefings. Aufnahme im Browser (WAV 16 kHz mono) →
   /api/sprache/erkennen (whisper, lokal) → frageCira wie getippt. Vorlesen
   ueber /api/sprache/sprechen: ElevenLabs liefert MP3, sonst antwortet der
   Server JSON { fallback: 'browser', text } und die Browser-Stimme spricht.
   Ohne eingerichtete Erkennung bleibt jeder Mikrofon-Knopf verborgen (E10). */

Object.assign(EN, {
  'Sprechen': 'Speak', 'Hört zu': 'Listening', 'Aufnahme beenden': 'Stop recording', 'Sprechen (Strg+Leertaste)': 'Speak (Ctrl+Space)',
  'Nichts verstanden.': 'Didn’t catch that.', 'Spracherkennung': 'Speech recognition', 'Vorlesen': 'Read aloud', 'Vorlesen stoppen': 'Stop reading',
  'Mikrofon in dieser Einbettung nicht erlaubt.': 'Microphone not allowed in this embedding.', 'Mikrofon verweigert.': 'Microphone denied.',
  'Kein Mikrofon gefunden.': 'No microphone found.', 'Dieser Browser kann nicht vorlesen.': 'This browser cannot read aloud.',
  'Vorlesen fehlgeschlagen': 'Reading aloud failed', 'Vorlesen stoppen': 'Stop reading', 'gesprochen': 'spoken', 'Gekürzt auf 5000 Zeichen.': 'Shortened to 5,000 characters.',
  'Mikrofon getrennt.': 'Microphone disconnected.', 'Die Erkennung läuft noch.': 'Recognition is still running.',
  'Cira antwortet noch — dein Text steht im Feld.': 'Cira is still answering — your text is in the field.',
});

const SPRACHE_STILLE = 0.015;      // RMS-Schwelle: darueber zaehlt ein Block als gesprochen
const sprache = {
  status: null, aufnahme: null, erkennt: false, audio: null, utter: null, quelle: null, nr: 0, gemeldet: new Set(), pegelRaf: 0, wache: 0, nachladen: 0,
  bereit() { return !!(this.status && this.status.stt && this.status.stt.bereit); },
  // quelle steht schon waehrend des Abrufs: auch dann stoppt Esc und ruht der Orb nicht.
  aktiv() { return !!(this.aufnahme || this.erkennt || this.audio || this.utter || this.quelle); },
  async lade() {
    clearTimeout(this.nachladen);
    try { this.status = await hole('/api/sprache/status'); } catch (e) {
      // Beim Server-Neustart blieben die Knoepfe sonst bis zum Neuladen verborgen.
      console.error('/api/sprache/status:', e.message);
      this.nachladen = setTimeout(() => this.lade(), 5000);
    }
    spracheKnoepfe();
    return this.status;
  },
  // E5: auto = gesprochene Frage oder eine Antwort, die vorgelesen werden will (Tagesbericht).
  sollVorlesen(gesprochen, vorlesen) {
    const v = (this.status && this.status.tts && this.status.tts.vorlesen) || 'auto';
    return v === 'immer' || (v === 'auto' && (gesprochen || vorlesen));
  },
};

/* ---------- Knoepfe ---------- */
// Jeder [data-aktion="mikro"] zeigt sich nur bei eingerichteter Erkennung; aria-pressed traegt die Aufnahme.
function spracheKnoepfe() {
  for (const k of document.querySelectorAll('[data-aktion="mikro"]')) {
    const an = !!(sprache.aufnahme && sprache.aufnahme.wo === k.dataset.wert);
    k.hidden = !sprache.bereit();
    k.classList.toggle('an', an);
    k.setAttribute('aria-pressed', String(an));
    k.setAttribute('aria-label', uebersetze(an ? 'Aufnahme beenden' : 'Sprechen (Strg+Leertaste)'));
    const l = k.querySelector('.l');
    if (l) l.textContent = uebersetze(an ? 'Hört zu' : 'Sprechen');
  }
  // Stopp-Knopf nur, solange vorgelesen wird (auch waehrend des Abrufs).
  const spricht = !!(sprache.audio || sprache.utter || sprache.quelle);
  for (const k of document.querySelectorAll('[data-aktion="vorlesen-stopp"]')) k.hidden = !spricht;
  for (const id of ['dock-q', 'ck-q']) {
    const q = document.getElementById(id);
    if (!q) continue;
    if (sprache.aufnahme && !q.dataset.platz) { q.dataset.platz = q.placeholder; q.placeholder = uebersetze('Hört zu') + ' …'; }
    else if (!sprache.aufnahme && q.dataset.platz != null) { q.placeholder = q.dataset.platz; delete q.dataset.platz; }
  }
}
// Kurzer Ton bei Start und Stopp (80 ms, Oszillator, kein Asset).
function spracheTon(hz) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = hz; g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.08);
    o.onended = () => ctx.close();
  } catch { /* ohne Ton geht es auch */ }
}

/* ---------- Aufnahme ---------- */
const kanalVon = (wo) => (wo === 'cockpit' && typeof ckKanal !== 'undefined' ? ckKanal : DOCK_KANAL);
async function starteAufnahme(wo) {
  if (!sprache.bereit() || sprache.aufnahme) return;
  if (cira.laeuft) { toast(uebersetze('Cira antwortet noch — gleich nochmal.'), 'info'); return; }
  if (sprache.erkennt) { toast(uebersetze('Die Erkennung läuft noch.'), 'info'); return; }
  stoppeSprechen();
  const imRahmen = window.top !== window;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast(uebersetze('Mikrofon in dieser Einbettung nicht erlaubt.'), 'warn'); return; }
  // Sofort als laufend markieren: ein zweiter Druck waehrend der Freigabe-Abfrage startet keine zweite.
  const a = { wo, teile: [], laenge: 0, gesprochen: false, stilleSeit: 0, t0: performance.now(), aus: false };
  sprache.aufnahme = a;
  try {
    a.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    a.ctx = new AudioContext();
    await a.ctx.audioWorklet.addModule('app/sprache-worklet.js');
    a.node = new AudioWorkletNode(a.ctx, 'c2i-aufnahme');
    a.ctx.createMediaStreamSource(a.stream).connect(a.node).connect(a.ctx.destination);
    // Manche Browser starten den Kontext angehalten: dann kaemen nie Daten, und die Stille-Erkennung stuende.
    await a.ctx.resume();
  } catch (e) {
    aufraeumen(a);
    // Eine inzwischen neu gestartete Aufnahme bleibt stehen; nach Esc gibt es keinen Hinweis.
    if (sprache.aufnahme === a) sprache.aufnahme = null;
    spracheKnoepfe();
    if (a.aus === 'esc') return;
    const text = e.name === 'NotAllowedError' || e.name === 'SecurityError' ? (imRahmen ? 'Mikrofon in dieser Einbettung nicht erlaubt.' : 'Mikrofon verweigert.')
      : e.name === 'NotFoundError' ? 'Kein Mikrofon gefunden.' : null;
    toast(text ? uebersetze(text) : uebersetze('Spracherkennung') + ': ' + e.message, 'warn');
    return;
  }
  if (a.aus) { aufraeumen(a); return; }   // waehrend der Freigabe mit Esc verworfen
  // Die 60 s zaehlen ab hier, nicht ab dem Freigabe-Dialog. Haerter als die Stille-Erkennung:
  // kommen keine Daten mehr (Mikrofon weg), endet die Aufnahme trotzdem.
  a.t0 = performance.now();
  a.wache = setTimeout(() => { if (sprache.aufnahme === a) beendeAufnahme(true); }, 61000);
  const spur = a.stream.getAudioTracks()[0];
  if (spur) spur.onended = () => { if (sprache.aufnahme === a) { beendeAufnahme(false); toast(uebersetze('Mikrofon getrennt.'), 'warn'); } };
  a.node.port.onmessage = (ev) => {
    const { pcm, rms } = ev.data;
    a.teile.push(pcm); a.laenge += pcm.length;
    for (const o of document.querySelectorAll('cira-orb')) o.amplitude = Math.min(1, rms * 8);
    const jetzt = performance.now();
    if (rms > SPRACHE_STILLE) { a.gesprochen = true; a.stilleSeit = 0; }
    else if (a.gesprochen && !a.stilleSeit) a.stilleSeit = jetzt;
    if ((a.stilleSeit && jetzt - a.stilleSeit > 800) || jetzt - a.t0 > 60000) beendeAufnahme(true);
  };
  spracheTon(880);
  ciraModus('hört');
  spracheKnoepfe();
}
function aufraeumen(a) {
  if (!a.aus) a.aus = true;
  clearTimeout(a.wache);
  if (a.node) a.node.port.onmessage = null;
  if (a.stream) a.stream.getTracks().forEach((t) => t.stop());
  if (a.ctx && a.ctx.state !== 'closed') a.ctx.close().catch(() => {});
  for (const o of document.querySelectorAll('cira-orb')) o.amplitude = null;
}
// senden=false verwirft (Esc). Sonst: WAV an whisper, Text wie getippt an Cira.
async function beendeAufnahme(senden) {
  const a = sprache.aufnahme;
  if (!a) return;
  sprache.aufnahme = null;
  const lief = !!a.node;
  a.aus = senden ? true : 'esc';
  aufraeumen(a);
  spracheKnoepfe();
  if (!lief) return;
  spracheTon(660);
  ciraModus('ruht');
  if (!senden) return;
  if (!a.gesprochen || a.laenge < 16000 * 0.3) { toast(uebersetze('Nichts verstanden.'), 'info'); return; }
  sprache.erkennt = true;
  ciraModus('denkt');
  try {
    const r = await fetch('/api/sprache/erkennen?sprache=' + (istDE() ? 'de' : 'en'), {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: alsWav(a.teile, a.laenge), signal: AbortSignal.timeout(90000) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
    const text = String(d.text || '').trim();
    sprache.erkennt = false;
    if (!sprache.aufnahme) ciraModus('ruht');
    if (text.length < 2) { toast(uebersetze('Nichts verstanden.'), 'info'); return; }
    // Laeuft inzwischen eine getippte Frage, geht der gesprochene Text nicht verloren.
    if (cira.laeuft) {
      const q = document.getElementById(a.wo === 'cockpit' ? 'ck-q' : 'dock-q');
      if (q) q.value = text;
      toast(uebersetze('Cira antwortet noch — dein Text steht im Feld.'), 'info');
      return;
    }
    frageCira(text, kanalVon(a.wo), { gesprochen: true });
  } catch (e) {
    sprache.erkennt = false;
    if (!sprache.aufnahme) ciraModus('ruht');
    toast(uebersetze('Spracherkennung') + ': ' + e.message, 'warn');
  }
}
function alsWav(teile, n) {
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const t of teile) for (let i = 0; i < t.length; i++, o += 2) v.setInt16(o, t[i], true);
  return new Blob([buf], { type: 'audio/wav' });
}
// Knopf: an → aus und senden; aus → an.
function umschalteAufnahme(wo) { if (sprache.aufnahme) beendeAufnahme(true); else starteAufnahme(wo); }
aktion('mikro', (wo) => umschalteAufnahme(wo === 'cockpit' ? 'cockpit' : 'dock'));
aktion('vorlesen-stopp', () => stoppeSprechen());

// Strg+Leertaste (E3): laeuft eine Aufnahme → senden. Ist das Cockpit offen
// oder das Dock offen und das Feld leer → Aufnahme. Sonst false: die Shell
// macht, was sie immer machte (Dock oeffnen, im Cockpit Fokus ins Feld).
function spracheTaste() {
  if (sprache.aufnahme) { beendeAufnahme(true); return true; }
  if (!sprache.bereit()) return false;
  const leer = (id) => { const q = document.getElementById(id); return !!q && !q.value.trim(); };
  if (route().name === 'cockpit' && leer('ck-q')) { starteAufnahme('cockpit'); return true; }
  if (cira.dockOffen && leer('dock-q')) { starteAufnahme('dock'); return true; }
  return false;
}

/* ---------- Vorlesen ---------- */
// quelle: wer vorliest (z. B. 'briefing:<hash>'), damit sein Knopf „stoppen“ zeigen kann.
async function sprich(text, quelle = 'cira') {
  stoppeSprechen();
  const voll = String(text || '');
  const roh = voll.slice(0, 5000);
  if (!roh.trim()) return;
  if (voll.length > 5000) toast(uebersetze('Gekürzt auf 5000 Zeichen.'), 'info');
  const nr = ++sprache.nr;
  sprache.quelle = quelle;
  spracheMelde();
  let r, d = {};
  try {
    r = await fetch('/api/sprache/sprechen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: roh }), signal: AbortSignal.timeout(30000) });
    if (nr !== sprache.nr) return;
    if (r.ok && /^audio\//.test(r.headers.get('content-type') || '')) {
      const blob = await r.blob();
      // Waehrend des Ladens gestoppt oder etwas anderes gestartet: nicht mehr abspielen.
      if (nr === sprache.nr) spieleAb(URL.createObjectURL(blob), nr);
      return;
    }
    d = await r.json().catch(() => ({}));
  } catch (e) {
    if (nr !== sprache.nr) return;
    // Der eigene Server antwortet nicht: melden statt stumm umzuschalten.
    toast(uebersetze('Vorlesen fehlgeschlagen') + ': ' + e.message, 'warn');
    endeSprechen(nr);
    return;
  }
  if (nr !== sprache.nr) return;
  if (!d.fallback) { toast(uebersetze('Vorlesen fehlgeschlagen') + ': ' + (d.error || (r ? 'HTTP ' + r.status : '')), 'warn'); endeSprechen(nr); return; }
  // Rueckfall: ein Grund (Limit, Schluessel, Netz) einmal je Sitzung melden, nicht bei jeder Antwort —
  // ausser beim Probesatz, der genau das pruefen soll. Danach zeigt der Status den Grund in den Einstellungen.
  if (d.grund && (quelle === 'probe' || !sprache.gemeldet.has(d.grund))) { sprache.gemeldet.add(d.grund); toast(d.grund, quelle === 'probe' ? 'warn' : 'info'); }
  if (d.grund) sprache.lade().then((st) => { if (st && typeof ez !== 'undefined' && ez.cira && ez.cira.d) { ez.cira.d.sprache = st; if (route().name === 'einstellungen') zeichneAnsicht(); } });
  browserStimme(d.text || roh, nr);
}
function spieleAb(url, nr) {
  if (nr !== sprache.nr) { URL.revokeObjectURL(url); return; }
  const audio = new Audio(url);
  sprache.audio = audio;
  let ctx = null, an = null;
  try {
    ctx = new AudioContext();
    an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaElementSource(audio).connect(an).connect(ctx.destination);
  } catch { ctx = null; an = null; }
  const ende = () => { URL.revokeObjectURL(url); if (ctx) ctx.close().catch(() => {}); endeSprechen(nr); };
  audio.aufraeumen = ende;   // stoppeSprechen: pause() loest kein ended aus
  audio.addEventListener('ended', ende);
  audio.addEventListener('error', () => { toast(uebersetze('Vorlesen fehlgeschlagen'), 'warn'); ende(); });
  audio.addEventListener('timeupdate', spracheMelde);
  audio.play().then(() => {
    if (nr !== sprache.nr) return;
    ciraModus('spricht');
    pegel(() => { if (!an) return 0.5; const b = new Uint8Array(an.fftSize); an.getByteTimeDomainData(b); let q = 0; for (const x of b) q += ((x - 128) / 128) ** 2; return Math.min(1, Math.sqrt(q / b.length) * 4); });
  }, (e) => {
    // Abgelehnt (Autoplay, Einbettung) ist kein stiller Fall; AbortError kommt vom eigenen Stopp.
    if (nr === sprache.nr && e.name !== 'AbortError') toast(uebersetze('Vorlesen fehlgeschlagen') + ': ' + e.name, 'warn');
    ende();
  });
}
function browserStimme(text, nr) {
  if (typeof speechSynthesis === 'undefined') { toast(uebersetze('Dieser Browser kann nicht vorlesen.'), 'warn'); endeSprechen(nr); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = istDE() ? 'de-DE' : 'en-US';
  const gewaehlt = lies('stimme', '');
  const v = speechSynthesis.getVoices().find((x) => x.voiceURI === gewaehlt && x.lang.slice(0, 2) === u.lang.slice(0, 2));
  if (v) u.voice = v;
  u.onend = () => endeSprechen(nr);
  u.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled' && nr === sprache.nr) toast(uebersetze('Vorlesen fehlgeschlagen') + ': ' + e.error, 'warn');
    endeSprechen(nr);
  };
  sprache.utter = u;
  speechSynthesis.speak(u);
  // Chrome laesst onend bei langen Texten manchmal aus: spaetestens dann ist Schluss.
  sprache.wache = setTimeout(() => { if (nr === sprache.nr && sprache.utter === u) { speechSynthesis.cancel(); endeSprechen(nr); } }, 10000 + text.length * 90);
  ciraModus('spricht');
  // Ohne Pegel aus dem Browser: ruhige Huellkurve, solange er spricht.
  pegel(() => 0.45 + 0.25 * Math.sin(performance.now() / 120));
}
// Pegel auf alle Orbs, solange gesprochen wird (prefers-reduced-motion haelt der Orb selbst).
function pegel(wert) {
  cancelAnimationFrame(sprache.pegelRaf);
  const lauf = () => {
    if (!sprache.audio && !sprache.utter) return;
    const w = wert();
    for (const o of document.querySelectorAll('cira-orb')) o.amplitude = w;
    sprache.pegelRaf = requestAnimationFrame(lauf);
  };
  lauf();
}
function endeSprechen(nr) {
  if (nr !== sprache.nr) return;
  cancelAnimationFrame(sprache.pegelRaf);
  clearTimeout(sprache.wache);
  sprache.audio = null; sprache.utter = null; sprache.quelle = null;
  for (const o of document.querySelectorAll('cira-orb')) o.amplitude = null;
  if (!cira.laeuft && !sprache.aufnahme) ciraModus('ruht');
  spracheMelde();
}
function stoppeSprechen() {
  const nr = ++sprache.nr;
  if (sprache.audio) { const a = sprache.audio; a.pause(); a.aufraeumen(); }
  if (sprache.utter && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  endeSprechen(nr);
}
// Wer vorliest und wie lange noch — Briefings zeigt damit „Vorlesen stoppen · 0:38“.
function spracheMelde() {
  spracheKnoepfe();
  const a = sprache.audio;
  const rest = a && Number.isFinite(a.duration) ? Math.max(0, Math.round(a.duration - a.currentTime)) : null;
  document.dispatchEvent(new CustomEvent('c2i-sprache', { detail: { quelle: sprache.quelle, rest } }));
}
// Esc: Aufnahme verwerfen oder Vorlesen stoppen (die Shell ruft das vor ihren eigenen Esc-Regeln).
function spracheAbbrechen() {
  if (sprache.aufnahme) { beendeAufnahme(false); return true; }
  if (sprache.audio || sprache.utter || sprache.quelle) { stoppeSprechen(); return true; }
  return false;
}

sprache.lade();
// Geaenderte Einrichtung (config.json, Server-Neustart) zeigt sich beim Zurueckkommen in den Tab.
window.addEventListener('focus', () => { if (!sprache.aktiv()) sprache.lade(); });
