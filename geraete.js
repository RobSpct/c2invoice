'use strict';
// Geraetekopplung (Owner 19.10.2026, Security-Review C5 H1). c2invoice hat keine
// Anmeldung; die Herkunfts-Kopfzeilen (Sec-Fetch-Site, Origin) halten fremde
// Webseiten ab, aber keinen lokalen Prozess, der sie faelscht — etwa eine
// Claude-Sitzung mit curl, die sonst ihre eigenen Rechte-Anfragen bestaetigen
// koennte. Deshalb schreibt nur ein gekoppeltes Geraet.
//
// Koppeln: Der Browser bittet um einen Code. Der Server zeigt ihn als Dialog
// auf dem Desktop (Windows) bzw. im Serverfenster, nie in einer Antwort oder
// Datei. Wer ihn eintippt, bekommt ein Geraete-Token: als HttpOnly-Cookie
// (Browser) oder einmalig im Koerper (Programme wie Jarvis, Kopfzeile
// x-c2invoice-geraet). Gespeichert wird nur der SHA-256 des Tokens.
//
// Grenze (Security-Review S1): Das haelt Prozesse ab, die nur Anfragen
// schicken koennen. Wer als derselbe Nutzer Befehle ausfuehrt oder Dateien
// schreibt, kommt vorbei — er kann data/ledger.db aendern, den Dialogtext per
// UI Automation lesen oder einen eigenen Server auf 127.0.0.1 betreiben, an
// den der Browser das Cookie mitschickt (Cookies sind nicht nach Port
// getrennt). Dagegen hilft nur Betriebssystem-Trennung.
const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');

const COOKIE = 'c2i_geraet';
const KOPF = 'x-c2invoice-geraet';
const CODE_GILT_MS = 2 * 60000;
const MAX_VERSUCHE = 5;
// Kopplungen starten: hoechstens so viele je 10 Minuten (ein Dialog je Start).
const MAX_STARTS = 5;
const COOKIE_TAGE = 365;
const NAME_RE = /^[^\u0000-\u001f\u007f<>]{1,60}$/;
// Endet der Dialog-Prozess frueher, hat er nichts gezeigt (gemessen: detached
// oder ohne Desktop endet PowerShell sofort mit Exit 0).
const DIALOG_LEBT_MS = 1500;

const jetzt = () => new Date().toISOString();
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const fehler = (text, status) => Object.assign(new Error(text), { status });

// Absoluter Pfad: sonst sucht Windows zuerst im Arbeitsordner nach powershell.exe.
const POWERSHELL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

// Standard-Anzeige: Windows-Dialog ueber PowerShell. Der Code steht in der
// Umgebung des Kindprozesses, nicht in der Kommandozeile (die kann jeder
// Prozess des Nutzers auflisten). Anderswo: im Serverfenster.
// Ergebnis: Promise mit { kind } (zum Schliessen) oder Fehler, wenn der
// Dialog nicht erscheint.
function zeigeCodeAmDesktop(code, { bis, spawnFn = spawn, lebtMs = DIALOG_LEBT_MS } = {}) {
  if (process.platform !== 'win32') {
    console.log('[c2invoice] Kopplungscode: ' + code + ' (gilt bis ' + bis + ')');
    return Promise.resolve({ kind: null });
  }
  const skript = "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show(" +
    "('Kopplungscode für c2invoice: ' + $env:C2I_KOPPLUNGSCODE + [Environment]::NewLine + [Environment]::NewLine + 'Im Browser eintippen. Gilt bis ' + $env:C2I_KOPPLUNG_BIS + ' Uhr.'), " +
    "'c2invoice - Gerät koppeln', 'OK', 'Information') | Out-Null";
  return new Promise((ok, nein) => {
    let k;
    try {
      // Nicht detached: ohne Konsole endet PowerShell sofort mit Exit 0 und zeigt nichts (gemessen 19.10.).
      k = spawnFn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', skript], {
        env: { ...process.env, C2I_KOPPLUNGSCODE: code, C2I_KOPPLUNG_BIS: bis || '' }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true,
      });
    } catch (err) { nein(fehler('Dialog nicht gestartet: ' + err.message, 503)); return; }
    let stderr = '';
    if (k.stderr) k.stderr.on('data', (d) => { stderr = (stderr + d).slice(-500); });
    let fertig = false;
    const uhr = setTimeout(() => { fertig = true; if (k.unref) k.unref(); ok({ kind: k }); }, lebtMs);
    const vorbei = (grund) => {
      if (fertig) return;
      fertig = true; clearTimeout(uhr);
      nein(fehler('Der Dialog mit dem Code ließ sich nicht anzeigen (' + grund + (stderr.trim() ? ': ' + stderr.trim().split('\n')[0] : '') + '). Läuft c2invoice in deiner Windows-Sitzung?', 503));
    };
    k.on('error', (err) => vorbei(err.message));
    k.on('exit', (c) => vorbei('Exit ' + c));
  });
}

function cookieAus(req) {
  const roh = req.headers.cookie;
  if (typeof roh !== 'string') return null;
  for (const teil of roh.split(';')) {
    const i = teil.indexOf('=');
    if (i > 0 && teil.slice(0, i).trim() === COOKIE) return teil.slice(i + 1).trim();
  }
  return null;
}

function erzeuge({ db, anzeigen = zeigeCodeAmDesktop, uhr = () => Date.now() }) {
  let offen = null;          // { id, code, bis, versuche, kind }
  let starts = [];           // Zeitpunkte der letzten Kopplungsstarts
  let zuletztFehler = 0;     // letzte Fehlermeldung beim Schreiben von "zuletzt"

  // Den Dialog einer erledigten oder ersetzten Kopplung schliessen.
  const schliesse = (o) => { if (o && o.kind && typeof o.kind.kill === 'function') { try { o.kind.kill(); } catch { /* schon zu */ } } };
  const verwirf = () => { schliesse(offen); offen = null; };

  function tokenAus(req) {
    const k = req.headers[KOPF];
    if (typeof k === 'string' && k) return k;
    return cookieAus(req);
  }

  // Geraet zur Anfrage oder null. "zuletzt" hoechstens einmal je Minute schreiben.
  function geraet(req) {
    const t = tokenAus(req);
    if (!t || t.length < 32 || t.length > 200) return null;
    const g = db.prepare('SELECT id, name, art, zuletzt FROM geraet WHERE token_hash = ?').get(hash(t));
    if (!g) return null;
    const vorher = g.zuletzt ? Date.parse(g.zuletzt) : NaN;
    if (Number.isNaN(vorher) || uhr() - vorher > 60000) {
      try { db.prepare('UPDATE geraet SET zuletzt = ? WHERE id = ?').run(new Date(uhr()).toISOString(), g.id); } catch (err) {
        // Nur Anzeige ("zuletzt"); einmal je 10 Minuten melden statt bei jeder Anfrage.
        if (uhr() - zuletztFehler > 10 * 60000) { zuletztFehler = uhr(); console.error('Geraet zuletzt nicht gespeichert:', err.message); }
      }
    }
    return g;
  }

  // Eine laufende Kopplung ersetzt nur, wer ihre ID kennt (der Browser, der sie
  // gestartet hat, mit "Neuen Code"). Ein fremder Aufruf kippt sie nicht.
  async function starte(d = {}) {
    const t = uhr();
    if (offen && t <= offen.bis && d.ersetzt !== offen.id) {
      throw fehler('Es läuft schon eine Kopplung (noch ' + Math.ceil((offen.bis - t) / 1000) + ' s). Den Code vom Desktop eintippen oder danach neu anfordern.', 409);
    }
    starts = starts.filter((s) => t - s < 10 * 60000);
    if (starts.length >= MAX_STARTS) throw fehler('Zu viele Kopplungsversuche. In ein paar Minuten noch einmal.', 429);
    starts.push(t);
    verwirf();
    const o = { id: crypto.randomBytes(16).toString('hex'), code: String(crypto.randomInt(0, 1000000)).padStart(6, '0'), bis: t + CODE_GILT_MS, versuche: 0, kind: null };
    offen = o;
    const bisText = new Date(o.bis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    try {
      const r = await dienst.anzeigen(o.code, { bis: bisText });
      o.kind = r && r.kind ? r.kind : null;
    } catch (err) {
      if (offen === o) offen = null;
      console.error('Kopplungscode nicht angezeigt:', err.message);
      throw err.status ? err : fehler('Der Dialog mit dem Code ließ sich nicht anzeigen: ' + err.message, 503);
    }
    // Waehrend der Anzeige ersetzt: dieser Dialog gehoert zu nichts mehr.
    if (offen !== o) { schliesse(o); throw fehler('Kopplung wurde inzwischen neu gestartet.', 409); }
    return { kopplung: o.id, gueltig_sekunden: CODE_GILT_MS / 1000 };
  }

  // Ergebnis: { token, geraet }. Der Aufrufer setzt das Cookie bzw. gibt das Token (client) zurueck.
  function bestaetige(d = {}) {
    const o = offen;
    if (!o || typeof d.kopplung !== 'string' || d.kopplung !== o.id) throw fehler('Kopplung unbekannt oder abgelaufen. Neuen Code anfordern.', 409);
    if (uhr() > o.bis) { verwirf(); throw fehler('Code abgelaufen. Neuen Code anfordern.', 409); }
    o.versuche++;
    const code = typeof d.code === 'string' ? d.code.replace(/\s+/g, '') : '';
    const gleich = /^\d{6}$/.test(code) && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(o.code));
    if (!gleich) {
      if (o.versuche >= MAX_VERSUCHE) { verwirf(); throw fehler('Zu viele falsche Codes. Neuen Code anfordern.', 409); }
      throw fehler('Code stimmt nicht.' + (o.versuche >= 2 ? ' Nur der Code aus dem neuesten Fenster gilt.' : ''), 400);
    }
    const name = typeof d.name === 'string' && NAME_RE.test(d.name.trim()) ? d.name.trim() : 'Gerät';
    const art = d.client === true ? 'client' : 'browser';
    const token = crypto.randomBytes(32).toString('base64url');
    let r;
    try {
      r = db.prepare('INSERT INTO geraet (name, art, token_hash, erstellt) VALUES (?,?,?,?)').run(name, art, hash(token), jetzt());
    } catch (err) {
      // Der Code bleibt gueltig: ein zweiter Versuch braucht keinen neuen Dialog.
      console.error('Geraet nicht gespeichert:', err.message);
      throw fehler('Gerät ließ sich nicht speichern. Gleich noch einmal versuchen.', 500);
    }
    verwirf();
    return { token, geraet: { id: Number(r.lastInsertRowid), name, art } };
  }

  const liste = (aktuell) => db.prepare('SELECT id, name, art, erstellt, zuletzt FROM geraet ORDER BY id').all()
    .map((g) => ({ ...g, dieses: !!aktuell && aktuell.id === g.id }));

  function entferne(id) {
    if (!Number.isInteger(id) || id < 1) throw fehler('Gerät unbekannt.', 404);
    const r = db.prepare('DELETE FROM geraet WHERE id = ?').run(id);
    if (!r.changes) throw fehler('Gerät unbekannt.', 404);
    return { id };
  }

  // Zwei Fassungen desselben Tokens. Strict fuer die Seite selbst. In einer
  // Einbettung (Obsidian zeigt c2invoice im iframe unter app://obsidian.md)
  // verwirft der Browser Strict; dort gilt die partitionierte Fassung, die nur
  // unter derselben obersten Seite mitgeht (CHIPS). Secure nimmt Chromium auf
  // 127.0.0.1 auch ohne https an (gemessen 19.10.). Schreiben aus fremden
  // Frames sperren weiter Sec-Fetch-Site und Origin in server.js.
  const EINGEBETTET = '; HttpOnly; SameSite=None; Secure; Partitioned; Path=/; Max-Age=';
  const cookie = (token) => [
    COOKIE + '=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + COOKIE_TAGE * 86400,
    COOKIE + '=' + token + EINGEBETTET + COOKIE_TAGE * 86400,
  ];
  const cookieWeg = () => [COOKIE + '=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0', COOKIE + '=' + EINGEBETTET + '0'];

  // anzeigen ist austauschbar: Tests oeffnen keinen echten Desktop-Dialog.
  const dienst = { geraet, starte, bestaetige, liste, entferne, cookie, cookieWeg, anzeigen };
  return dienst;
}

module.exports = { erzeuge, zeigeCodeAmDesktop, cookieAus, hash, COOKIE, KOPF, MAX_VERSUCHE, POWERSHELL };
