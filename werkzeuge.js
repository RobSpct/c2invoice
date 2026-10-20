'use strict';
// C8 Werkzeuge: Skills, Agents, Commands, Plugins, Mods und MCP-Server je
// Arbeitsbereich. Liest die Claude-Code-Konfiguration und schreibt genau
// einen Schluessel, wo Claude Code einen Schalter kennt (Spec
// design/cira/C8-WERKZEUGE.md, Owner-Freigabe 20.10.2026).
//
// Geschrieben wird nur von diesem Prozess, nie von einem Claude-Lauf, und nur
// synchron: zwischen Lesen und rename steht kein await, damit ein fremder
// Schreiber (laufende Claude-Sitzung) hoechstens vor oder nach uns schreibt.
const fs = require('node:fs');
const path = require('node:path');

const fehler = (text, status) => Object.assign(new Error(text), { status });

// --- JSON lesen und genau einen Schluessel schreiben ---------------------

function leseJson(datei) {
  let roh;
  try { roh = fs.readFileSync(datei, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  const bom = roh.charCodeAt(0) === 0xfeff;
  const text = bom ? roh.slice(1) : roh;
  let daten;
  try { daten = text.trim() ? JSON.parse(text) : {}; } catch { throw fehler('nicht lesbar: ' + datei, 409); }
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) throw fehler('nicht lesbar: ' + datei, 409);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const m = text.match(/\n([ \t]+)\S/);
  const einzug = !m ? 2 : m[1][0] === '\t' ? '\t' : m[1].length;
  return { daten, bom, eol, einzug, endeNeu: /\r?\n$/.test(text), leer: !text.trim() };
}

// Zeitstempel fuer die Sicherung in Ortszeit: YYYYMMDD-HHMMSS-mmm.
function stempel(ms) {
  const d = new Date(ms);
  const z = (n, l = 2) => String(n).padStart(l, '0');
  return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds()) + '-' + z(d.getMilliseconds(), 3);
}

// Sicherung vor dem Schreiben. Mit `ordner` zentral (Name traegt den ganzen
// Pfad, damit settings.local.json mehrerer Bereiche getrennt bleiben und keine
// Kopie im Projekt-Repo landet), sonst neben der Datei. Nie ueberschreiben
// (gleiche Millisekunde → Zaehler), je Datei hoechstens BEHALTEN Stueck.
const BEHALTEN = 20;
function sichere(datei, ordner, ms) {
  const ziel = ordner || path.dirname(datei);
  const vorsilbe = (ordner ? path.resolve(datei).replace(/[:\\/]+/g, '_') : path.basename(datei)) + '.bak-';
  fs.mkdirSync(ziel, { recursive: true });
  let bak;
  for (let n = 0; ; n++) {
    bak = path.join(ziel, vorsilbe + stempel(ms) + (n ? '-' + String(n).padStart(3, '0') : ''));
    try { fs.copyFileSync(datei, bak, fs.constants.COPYFILE_EXCL); break; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  const alle = fs.readdirSync(ziel).filter((f) => f.startsWith(vorsilbe)).sort();
  for (const f of alle.slice(0, Math.max(0, alle.length - BEHALTEN))) fs.rmSync(path.join(ziel, f), { force: true });
  return bak;
}

// fn(daten) aendert das Objekt und liefert { vorher, nachher }. Geschrieben
// wird nur bei einer Aenderung: Sicherung, Temp-Datei (Rechte wie das
// Original), rename. Scheitert rename, bleibt keine Temp-Datei liegen.
function aendere(datei, fn, { jetzt = Date.now, sicherung = null } = {}) {
  const alt = leseJson(datei);
  const form = alt || { daten: {}, bom: false, eol: '\n', einzug: 2, endeNeu: true };
  const vorherJson = JSON.stringify(form.daten);
  const { vorher, nachher } = fn(form.daten);
  if (JSON.stringify(form.daten) === vorherJson) return { bak: null, vorher, nachher, geaendert: false };
  let text = JSON.stringify(form.daten, null, form.einzug);
  if (form.endeNeu) text += '\n';
  if (form.eol === '\r\n') text = text.replace(/\n/g, '\r\n');
  if (form.bom) text = '\uFEFF' + text;
  let bak = null;
  if (alt && !alt.leer) bak = sichere(datei, sicherung, jetzt());
  if (!alt) fs.mkdirSync(path.dirname(datei), { recursive: true });
  const tmpDatei = datei + '.c2i-tmp';
  fs.writeFileSync(tmpDatei, text, alt ? { mode: fs.statSync(datei).mode & 0o777 } : undefined);
  try { fs.renameSync(tmpDatei, datei); } catch (e) {
    fs.rmSync(tmpDatei, { force: true });
    if (['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw fehler(path.basename(datei) + ' ist gerade gesperrt (eine Claude-Sitzung schreibt?) – gleich erneut versuchen.', 409);
    throw e;
  }
  return { bak, vorher, nachher, geaendert: true };
}

// Eltern eines Schluessels; legt fehlende nur an, wenn gesetzt wird.
function elternVon(obj, pfad, anlegen) {
  let o = obj;
  for (const k of pfad.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) {
      if (!anlegen) return null;
      o[k] = {};
    }
    o = o[k];
  }
  return o;
}

function setzeSchluessel(obj, pfad, wert) {
  const o = elternVon(obj, pfad, wert !== undefined);
  if (!o) return { vorher: undefined, nachher: undefined };
  const k = pfad[pfad.length - 1];
  const vorher = o[k];
  if (wert === undefined) delete o[k];
  else o[k] = wert;
  return { vorher, nachher: wert };
}

function listeSetzen(obj, pfad, eintrag, drin) {
  const o = elternVon(obj, pfad, drin);
  if (!o) return { vorher: false, nachher: false };
  const k = pfad[pfad.length - 1];
  const liste = Array.isArray(o[k]) ? o[k] : [];
  const vorher = liste.includes(eintrag);
  if (drin && !vorher) liste.push(eintrag);
  if (!drin && vorher) liste.splice(liste.indexOf(eintrag), 1);
  if (drin || Array.isArray(o[k])) o[k] = liste;
  return { vorher, nachher: drin };
}

// --- Kontext je Arbeitsbereich: `claude -p /context` ----------------------
//
// Lokaler Befehl, kostet nichts (Spike 20.10.). Die Ausgabe ist Markdown mit
// Tabellen je Abschnitt. Erkannt wird nur, was eine Tokens-Spalte hat; fehlt
// die Kategorie-Tabelle oder eine Tokens-Spalte, gilt die Messung als nicht
// lesbar statt halb erkannte Zahlen zu liefern.

const tokenZahl = (s) => {
  // „~280“ ist geschaetzt, „< 20“ steht fuer sehr kleine Werte: gezaehlt wird die Obergrenze.
  const m = String(s).trim().replace(/^(~|<\s*)/, '').match(/^([\d.]+)(k?)$/);
  return m ? Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1)) : NaN;
};

// Maps aus Fremdtext ohne Prototyp: ein Name wie __proto__ verbiegt nichts.
const leer = () => Object.create(null);

function tabellen(text) {
  const abschnitte = leer();
  let titel = '';
  for (const zeile of String(text).split(/\r?\n/)) {
    const h = zeile.match(/^#{2,4}\s+(.*)$/);
    if (h) { titel = h[1].trim(); continue; }
    if (!zeile.startsWith('|') || /^\|[\s|:-]+\|$/.test(zeile)) continue;
    const zellen = zeile.split('|').slice(1, -1).map((s) => s.trim());
    const t = abschnitte[titel] || (abschnitte[titel] = { kopf: zellen, zeilen: [] });
    if (t.kopf !== zellen) t.zeilen.push(zellen);
  }
  return abschnitte;
}

function parseKontext(text) {
  const nicht = () => { throw fehler('Messung nicht lesbar', 502); };
  const ab = tabellen(text);
  const kat = ab['Estimated usage by category'];
  if (!kat || kat.kopf[0] !== 'Category' || kat.kopf[1] !== 'Tokens') nicht();
  const spalte = (t, name) => { const i = t.kopf.indexOf(name); if (i < 0) nicht(); return i; };
  const zahl = (s) => { const n = tokenZahl(s); if (!Number.isFinite(n)) nicht(); return n; };
  const kategorien = leer();
  for (const z of kat.zeilen) kategorien[z[0]] = zahl(z[1]);
  // Zaehlt eine Kategorie, muss ihre Tabelle da sein — sonst waeren es halb
  // erkannte Zahlen (alle Skills „—“, Plugins 0).
  if (kategorien['Skills'] > 0 && !ab['Skills']) nicht();
  if (kategorien['Custom agents'] > 0 && !ab['Custom Agents']) nicht();
  if ((kategorien['MCP tools'] > 0 || kategorien['MCP tools (deferred)'] > 0) && !ab['MCP Tools']) nicht();
  const mcp = leer();
  const t = ab['MCP Tools'];
  if (t) {
    const s = spalte(t, 'Server'), n = spalte(t, 'Tokens');
    for (const z of t.zeilen) mcp[z[s]] = (mcp[z[s]] || 0) + zahl(z[n]);
  }
  const liste = (titel, namensSpalte) => {
    const tab = ab[titel];
    const r = leer();
    if (!tab) return r;
    const k = spalte(tab, namensSpalte), q = spalte(tab, 'Source'), n = spalte(tab, 'Tokens');
    for (const z of tab.zeilen) r[z[k]] = { quelle: z[q], tokens: zahl(z[n]) };
    return r;
  };
  return {
    kategorien,
    deferred: (kategorien['MCP tools (deferred)'] || 0) > 0,
    mcp,
    skills: liste('Skills', 'Skill'),
    agents: liste('Custom Agents', 'Agent Type'),
  };
}

function misseKontext({ exe, cwd, spawnFn = require('node:child_process').spawn, zeitMs = 60000, env }) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '/context', '--output-format', 'json', '--no-session-persistence'];
    let kind;
    try { kind = spawnFn(exe, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); } catch (e) {
      return reject(fehler('Messung fehlgeschlagen: ' + e.message, 502));
    }
    const teile = [];
    let groesse = 0, fehlerText = '';
    let fertig = false;
    const ende = (fn) => { if (fertig) return; fertig = true; clearTimeout(uhr); fn(); };
    // Unter Windows endet mit claude.exe sonst nicht, was es gestartet hat (MCP-Server).
    const beende = () => {
      try { if (kind.pid) require('./sitzungen').baumBeenden(kind.pid); else kind.kill(); } catch { /* schon weg */ }
    };
    const uhr = setTimeout(() => ende(() => { beende(); reject(fehler('Messung fehlgeschlagen: Zeitlimit', 502)); }), zeitMs);
    kind.stdout.on('data', (b) => {
      groesse += b.length;
      if (groesse > 5e6) return ende(() => { beende(); reject(fehler('Messung fehlgeschlagen: Ausgabe zu groß', 502)); });
      teile.push(b);
    });
    kind.stderr.on('data', (b) => { fehlerText = (fehlerText + b.toString('utf8')).slice(-300); });
    kind.on('error', (e) => ende(() => reject(fehler('Messung fehlgeschlagen: ' + e.message, 502))));
    kind.on('close', (code) => ende(() => {
      let j;
      try { j = JSON.parse(Buffer.concat(teile).toString('utf8')); } catch { j = null; }
      if (!j || typeof j !== 'object') {
        return reject(fehler('Messung fehlgeschlagen: Exit ' + code + ', keine JSON-Antwort' + (fehlerText.trim() ? ' – ' + fehlerText.trim() : ''), 502));
      }
      if (code !== 0 || j.is_error) return reject(fehler('Messung fehlgeschlagen: ' + String(j.result || 'Exit ' + code).slice(0, 200), 502));
      try { resolve(parseKontext(j.result)); } catch (e) { reject(e); }
    }));
  });
}

// --- Inventar ---------------------------------------------------------------
//
// Spalten = 'global' + Arbeitsbereiche. Zelle je Spalte:
//   an | aus  — in der Schreibebene dieser Spalte gesetzt (Global:
//               ~/.claude/settings.json, Bereich: .claude/settings.local.json;
//               ein Wert aus der Projekt-Datei .claude/settings.json zaehlt mit)
//   erbt      — dort nicht gesetzt, wirksam ist die globale Ebene
//   —         — gibt es dort nicht (Bereich ohne Pfad, Projekt-Skill global …)
// `wirksam` sagt, ob das Werkzeug in der Spalte tatsaechlich geladen wird.

const ARTEN = ['skills', 'agents', 'commands', 'plugins', 'mods', 'mcps'];
const GRUND = {
  agents: 'Claude Code kennt keinen Schalter für Agents',
  commands: 'Claude Code kennt keinen Schalter für Commands',
  hook: 'Claude Code kennt keinen Schalter für einzelne Hooks',
  lager: 'Im Lager – erst installieren',
};
const normPfad = (p) => path.resolve(p).replace(/\\/g, '/');
// Eintraege eines Ordners; Verknuepfungen (Symlink, Junction) zaehlen nach
// ihrem Ziel. Fehlt der Ordner, ist er leer; jeder andere Fehler wird gemeldet.
function ordnerIn(dir, melde) {
  let eintraege;
  try { eintraege = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) {
    if (e.code !== 'ENOENT' && melde) melde({ datei: dir, grund: 'nicht lesbar (' + e.code + ')' });
    return [];
  }
  return eintraege.map((e) => {
    if (!e.isSymbolicLink()) return { name: e.name, ordner: e.isDirectory(), datei: e.isFile() };
    try { const s = fs.statSync(path.join(dir, e.name)); return { name: e.name, ordner: s.isDirectory(), datei: s.isFile() }; } catch { return { name: e.name, ordner: false, datei: false }; }
  });
}

// description aus dem Frontmatter einer Markdown-Datei (eine Zeile).
function beschreibungAus(datei) {
  let t;
  try { t = fs.readFileSync(datei, 'utf8'); } catch { return ''; }
  const fm = t.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  const m = fm && fm[1].match(/^description:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
const skillsIn = (dir, melde) => ordnerIn(dir, melde).filter((e) => e.ordner && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
  .map((e) => ({ name: e.name, beschreibung: beschreibungAus(path.join(dir, e.name, 'SKILL.md')) }));
const mdIn = (dir, melde) => ordnerIn(dir, melde).filter((e) => e.datei && e.name.endsWith('.md'))
  .map((e) => ({ name: e.name.slice(0, -3), beschreibung: beschreibungAus(path.join(dir, e.name)) }));

// Schluessel eines Projekts in ~/.claude.json (dort mit Vorwaertsschraegstrichen).
function projektSchluessel(claudeJson, pfad) {
  const ziel = normPfad(pfad).toLowerCase();
  const k = Object.keys((claudeJson && claudeJson.projects) || {}).find((x) => normPfad(x).toLowerCase() === ziel);
  return k || normPfad(pfad);
}
const claudeAiName = (server) => 'claude.ai ' + server.slice('claude_ai_'.length).replace(/_/g, ' ');

// Naechster Wert beim Klick in der Matrix: zyklisch an → aus → erbt, nur ueber
// erlaubte Werte. Ist der angezeigte Wert selbst nicht waehlbar (erbt bei einem
// Server in ~/.claude.json heisst „an“), zaehlt die Wirkung.
const ZYKLUS = ['an', 'aus', 'erbt'];
function naechstAus(zelle, wirksam, erlaubt) {
  if (!erlaubt.length) return null;
  const jetzt = erlaubt.includes(zelle) ? zelle : wirksam ? 'an' : 'aus';
  for (let i = 1; i <= ZYKLUS.length; i++) {
    const w = ZYKLUS[(ZYKLUS.indexOf(jetzt) + i) % ZYKLUS.length];
    if (erlaubt.includes(w) && w !== jetzt) return w;
  }
  return null;
}

function inventar({ heim, bereiche = [], lager = null, kontext = {} }) {
  const ebenenFehler = [];
  const melde = (f) => ebenenFehler.push(f);
  const lies = (datei) => {
    try { return { daten: (leseJson(datei) || { daten: {} }).daten, kaputt: false }; } catch (e) {
      if (e.status !== 409) throw e;
      melde({ datei, grund: 'nicht lesbar' });
      return { daten: {}, kaputt: true };
    }
  };
  const claudeDir = path.join(heim, '.claude');
  const G = lies(path.join(claudeDir, 'settings.json'));
  const CJ = lies(path.join(heim, '.claude.json'));
  const mitPfad = bereiche.filter((b) => b.pfad);
  const B = {};
  for (const b of mitPfad) {
    B[b.name] = {
      lokal: lies(path.join(b.pfad, '.claude', 'settings.local.json')),
      projekt: lies(path.join(b.pfad, '.claude', 'settings.json')),
      mcpjson: lies(path.join(b.pfad, '.mcp.json')).daten.mcpServers || {},
      cj: (CJ.daten.projects || {})[projektSchluessel(CJ.daten, b.pfad)] || {},
    };
  }
  const spalten = ['global', ...bereiche.map((b) => b.name)];
  const arten = Object.fromEntries(ARTEN.map((a) => [a, []]));
  const index = new Map();
  const eintrag = (art, name, felder) => {
    const k = art + '|' + name;
    if (index.has(k)) return index.get(k);
    const e = { art, name, beschreibung: '', herkunft: 'global', schaltbar: false, zellen: {}, wirksam: {}, gesperrt: {}, erlaubt: {}, naechst: {}, kontext: {}, ...felder };
    for (const s of spalten) { e.zellen[s] = '—'; e.wirksam[s] = null; e.erlaubt[s] = []; e.naechst[s] = null; }
    index.set(k, e);
    arten[art].push(e);
    return e;
  };
  // Eine Zelle setzen. kaputt = die Schreibebene der Spalte ist nicht lesbar:
  // Zustand unbekannt („?“), nicht schaltbar — kein geratener Wert als Fakt.
  const zelle = (e, s, { wert, wirksam, erlaubt = [], kaputt = false }) => {
    e.zellen[s] = kaputt ? '?' : wert;
    e.wirksam[s] = kaputt ? null : wirksam;
    e.gesperrt[s] = kaputt || !erlaubt.length;
    e.erlaubt[s] = kaputt ? [] : erlaubt;
    e.naechst[s] = kaputt ? null : naechstAus(wert, wirksam, erlaubt);
  };
  // Wert aus Bereich: lokal vor Projekt-Datei, sonst erbt. `ausProjekt`: der
  // Wert kommt allein aus .claude/settings.json — dann aendert „erbt“ nichts.
  const ausBereich = (b, lesen) => {
    const l = lesen(B[b].lokal.daten);
    if (l !== undefined) return { w: l, ausProjekt: false };
    const p = lesen(B[b].projekt.daten);
    return { w: p, ausProjekt: p !== undefined };
  };
  // Zellen fuer Skills und Plugins: Global an/aus, Bereich an/aus/erbt.
  const schaltbareZellen = (e, wert) => {
    const g = G.kaputt ? null : wert(G.daten) === true;
    zelle(e, 'global', { wert: g ? 'an' : 'aus', wirksam: g, erlaubt: ['an', 'aus'], kaputt: G.kaputt });
    for (const b of mitPfad) {
      const { w, ausProjekt } = ausBereich(b.name, wert);
      const erlaubt = ausProjekt ? ['an', 'aus'] : ['an', 'aus', 'erbt'];
      zelle(e, b.name, { wert: w === undefined ? 'erbt' : w ? 'an' : 'aus', wirksam: w === undefined ? g : w, erlaubt, kaputt: B[b.name].lokal.kaputt });
    }
  };

  // Skills: global, projekt, Lager.
  const skillWert = (name) => (o) => (o.skillOverrides && Object.hasOwn(o.skillOverrides, name) ? o.skillOverrides[name] !== 'off' : undefined);
  for (const s of skillsIn(path.join(claudeDir, 'skills'), melde)) {
    const e = eintrag('skills', s.name, { beschreibung: s.beschreibung, schaltbar: true });
    const roh = skillWert(s.name);
    schaltbareZellen(e, (o) => (o === G.daten ? roh(o) !== false : roh(o)));
  }
  for (const b of mitPfad) {
    for (const s of skillsIn(path.join(b.pfad, '.claude', 'skills'), melde)) {
      if (index.has('skills|' + s.name) && index.get('skills|' + s.name).herkunft === 'global') continue;
      const e = eintrag('skills', s.name, { beschreibung: s.beschreibung, herkunft: 'projekt', schaltbar: true });
      const { w, ausProjekt } = ausBereich(b.name, skillWert(s.name));
      zelle(e, b.name, { wert: w === undefined ? 'erbt' : w ? 'an' : 'aus', wirksam: w !== false,
        erlaubt: ausProjekt ? ['an', 'aus'] : ['an', 'aus', 'erbt'], kaputt: B[b.name].lokal.kaputt });
    }
  }
  if (lager) {
    for (const s of skillsIn(lager, melde)) {
      if (index.has('skills|' + s.name)) continue;
      const installierbarIn = ['global', ...mitPfad.filter((b) => !fs.existsSync(path.join(b.pfad, '.claude', 'skills', s.name))).map((b) => b.name)];
      eintrag('skills', s.name, { beschreibung: s.beschreibung, herkunft: 'lager', grund: GRUND.lager, installierbarIn });
    }
  }

  // Agents und Commands: nur Anzeige.
  for (const [art, unter] of [['agents', 'agents'], ['commands', 'commands']]) {
    const setze = (liste, spalte, herkunft) => {
      for (const a of liste) {
        const e = eintrag(art, a.name, { beschreibung: a.beschreibung, herkunft, grund: GRUND[art] });
        zelle(e, spalte, { wert: 'an', wirksam: true });
      }
    };
    setze(mdIn(path.join(claudeDir, unter), melde), 'global', 'global');
    for (const b of mitPfad) setze(mdIn(path.join(b.pfad, '.claude', unter), melde), b.name, 'projekt');
    for (const e of arten[art]) for (const b of mitPfad) if (e.herkunft === 'global' && e.zellen[b.name] === '—') zelle(e, b.name, { wert: 'erbt', wirksam: true });
  }

  // Plugins und Mods (Verzeichnis-Marktplatz).
  const installiert = lies(path.join(claudeDir, 'plugins', 'installed_plugins.json')).daten.plugins || {};
  const maerkte = lies(path.join(claudeDir, 'plugins', 'known_marketplaces.json')).daten;
  const pluginWert = (key) => (o) => (o.enabledPlugins && Object.hasOwn(o.enabledPlugins, key) ? o.enabledPlugins[key] === true : undefined);
  for (const key of Object.keys(installiert)) {
    const markt = key.split('@')[1];
    const mod = maerkte[markt] && maerkte[markt].source && maerkte[markt].source.source === 'directory';
    const ort = [].concat(installiert[key])[0] || {};
    const manifest = ort.installPath ? lies(path.join(ort.installPath, '.claude-plugin', 'plugin.json')).daten : {};
    // Ein Plugin mit Hooks wirkt auch ohne Request (Anweisungen im Kontext,
    // Filter vor dem Modell); seine Nutzung ist im Ledger nicht vollstaendig.
    const hooks = !!(ort.installPath && (fs.existsSync(path.join(ort.installPath, 'hooks', 'hooks.json')) || manifest.hooks));
    const e = eintrag(mod ? 'mods' : 'plugins', key, { beschreibung: manifest.description || '', schaltbar: true, plugin: key.split('@')[0], hooks });
    schaltbareZellen(e, pluginWert(key));
  }
  // Hooks direkt in den Settings: nur Anzeige. Name = aufgerufenes Skript,
  // sonst das erste Wort ohne Zuweisung (`API_KEY=… tool` → tool, nie der Wert).
  const hooksAus = (o, spalte) => {
    for (const [ereignis, gruppen] of Object.entries(o.hooks || {})) {
      for (const g of [].concat(gruppen || [])) {
        for (const h of [].concat((g && g.hooks) || [])) {
          if (!h || typeof h.command !== 'string') continue;
          const skripte = h.command.match(/[^\\/"'\s=]+\.(?:m?js|cjs|sh|ps1|py)\b/g);
          const wort = h.command.trim().split(/\s+/).find((w) => !/^\w+=/.test(w)) || '?';
          const kurz = skripte ? skripte[skripte.length - 1] : wort.replace(/^["']|["']$/g, '').split(/[\\/]/).pop();
          const e = eintrag('mods', ereignis + ': ' + kurz, { beschreibung: 'Hook (' + ereignis + ')', herkunft: spalte === 'global' ? 'global' : 'projekt', grund: GRUND.hook });
          zelle(e, spalte, { wert: 'an', wirksam: true });
        }
      }
    }
  };
  hooksAus(G.daten, 'global');
  for (const b of mitPfad) { hooksAus(B[b.name].lokal.daten, b.name); hooksAus(B[b.name].projekt.daten, b.name); }

  // MCP-Server. In ~/.claude.json heisst „erbt“ dasselbe wie „an“ (nicht in
  // disabledMcpServers): nur an/aus waehlbar; global gibt es kein Aus.
  // `konfigName` ist der Name in den Dateien (claude.ai-Server: Anzeigename).
  const aus = (b, name) => [].concat(B[b].cj.disabledMcpServers || []).includes(name);
  const mcpGlobal = (name, herkunft, felder = {}) => {
    const e = eintrag('mcps', name, { herkunft, schaltbar: true, konfigName: name, ...felder });
    zelle(e, 'global', { wert: 'an', wirksam: true, kaputt: CJ.kaputt });
    for (const b of mitPfad) {
      const a = aus(b.name, name);
      zelle(e, b.name, { wert: a ? 'aus' : 'erbt', wirksam: !a, erlaubt: ['an', 'aus'], kaputt: CJ.kaputt });
    }
    return e;
  };
  for (const name of Object.keys(CJ.daten.mcpServers || {})) mcpGlobal(name, 'global');
  const gemessen = new Set();
  for (const k of Object.values(kontext)) for (const s of Object.keys((k && k.mcp) || {})) gemessen.add(s);
  for (const s of gemessen) if (s.startsWith('claude_ai_')) mcpGlobal(claudeAiName(s), 'claude.ai', { server: s });
  for (const b of mitPfad) {
    for (const name of Object.keys(B[b.name].cj.mcpServers || {})) {
      const e = eintrag('mcps', name, { herkunft: 'projekt', schaltbar: true, konfigName: name });
      const a = aus(b.name, name);
      zelle(e, b.name, { wert: a ? 'aus' : 'an', wirksam: !a, erlaubt: ['an', 'aus'], kaputt: CJ.kaputt });
    }
    // .mcp.json: „an“ hiesse, fremden Projekt-Code ohne den Freigabedialog von
    // Claude Code zu starten — hier nur aus und erbt. Gleicher Name wie ein
    // anderer Server: eigene Zeile, sonst schriebe der Schalter die falsche Datei.
    for (const name of Object.keys(B[b.name].mcpjson)) {
      const andere = index.get('mcps|' + name);
      const anzeige = andere && andere.herkunft !== 'mcpjson' ? name + ' (.mcp.json)' : name;
      const e = eintrag('mcps', anzeige, { herkunft: 'mcpjson', schaltbar: true, konfigName: name, server: name });
      const liste = (o, k) => [].concat(o[k] || []).includes(name);
      const { w } = ausBereich(b.name, (o) => (liste(o, 'disabledMcpjsonServers') ? false : liste(o, 'enabledMcpjsonServers') ? true : undefined));
      const alle = ausBereich(b.name, (o) => o.enableAllProjectMcpServers).w === true || G.daten.enableAllProjectMcpServers === true;
      zelle(e, b.name, { wert: w === undefined ? 'erbt' : w ? 'an' : 'aus', wirksam: w === undefined ? alle : w, erlaubt: ['aus', 'erbt'], kaputt: B[b.name].lokal.kaputt });
    }
  }

  // Kontext je Spalte: Messung oder Schaetzung (Beschreibung ÷ 4).
  const hat = (o, n) => !!o && Object.hasOwn(o, n);
  for (const art of ARTEN) {
    for (const e of arten[art]) {
      for (const s of spalten) {
        const k = kontext[s];
        if (!k) {
          e.kontext[s] = { tokens: e.beschreibung && (art === 'skills' || art === 'agents') ? Math.ceil(e.beschreibung.length / 4) : null, geschaetzt: true, deferred: false };
          continue;
        }
        let tokens = null;
        if (art === 'skills' && hat(k.skills, e.name)) tokens = k.skills[e.name].tokens;
        if (art === 'agents' && hat(k.agents, e.name)) tokens = k.agents[e.name].tokens;
        if (art === 'mcps') {
          const n = e.server || e.name;
          const voll = hat(k.mcp, n) ? k.mcp[n] : undefined;
          if (voll !== undefined && k.deferred) { e.kontext[s] = { tokens: 0, voll, geschaetzt: false, deferred: true }; continue; }
          if (voll !== undefined) tokens = voll;
        }
        if ((art === 'plugins' || art === 'mods') && e.plugin) {
          const p = e.plugin;
          tokens = 0;
          for (const v of Object.values(k.skills)) if (v.quelle === 'Plugin (' + p + ')') tokens += v.tokens;
          for (const [n, v] of Object.entries(k.agents)) if (n.startsWith(p + ':')) tokens += v.tokens;
          if (!k.deferred) for (const [n, v] of Object.entries(k.mcp)) if (n.startsWith('plugin_' + p + '_')) tokens += v;
        }
        e.kontext[s] = { tokens, geschaetzt: false, deferred: false };
      }
    }
  }
  for (const art of ARTEN) arten[art].sort((a, b) => a.name.localeCompare(b.name));
  return { spalten, arten, ebenenFehler };
}

// --- Dienst: Liste, Schalten, Lager, Messen, Routen --------------------------

const TAG_MS = 24 * 3600e3;
const NACHPRUEFUNG_MS = 5000;
const lokalerTag = (ms) => new Date(ms).toLocaleDateString('sv-SE');   // YYYY-MM-DD in Ortszeit

// bereiche(): [{ name, pfad (aufgeloest, erreichbar) | null, projekt | null }],
// ohne den Arbeitsbereich der Art 'global' — der ist die Spalte 'global'.
function erzeuge({ db, bereiche, heim, lager = () => null, sicherung = () => null, exe, spawnFn, env = () => undefined,
  jetzt = Date.now, warte = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const metrics = require('./metrics');
  const pricing = require('./pricing');
  const { protokoll } = require('./freigaben');
  const laufend = new Map();

  const messungen = () => {
    const r = {};
    for (const z of db.prepare('SELECT bereich, gemessen_am, json FROM werkzeug_kontext').all()) {
      // Kaputte oder fremd geformte Zeile = keine Messung (die naechste ersetzt sie), aber mit Spur.
      let k = null;
      try { k = JSON.parse(z.json); } catch { /* unten gemeldet */ }
      if (k && ['kategorien', 'mcp', 'skills', 'agents'].every((f) => k[f] && typeof k[f] === 'object')) r[z.bereich] = { gemessen_am: z.gemessen_am, k };
      else console.warn('Werkzeuge: Messung fuer ' + z.bereich + ' nicht lesbar, wird ignoriert');
    }
    return r;
  };
  const stand = () => {
    const m = messungen();
    const kontext = Object.fromEntries(Object.entries(m).map(([b, x]) => [b, x.k]));
    return { m, inv: inventar({ heim: heim(), bereiche: bereiche(), lager: lager(), kontext }) };
  };
  const bereichVon = (ws) => {
    if (ws === 'global') return { name: 'global', pfad: heim(), projekt: null };
    const b = bereiche().find((x) => x.name === ws);
    if (!b) throw fehler('Unbekannter Arbeitsbereich: ' + ws, 404);
    return b;
  };

  function liste(ws = 'global') {
    const b = bereichVon(ws);
    const { m, inv } = stand();
    const bis = jetzt();
    const zeitraum = { from: lokalerTag(bis - 29 * TAG_MS), to: lokalerTag(bis) };
    const nutzung = ws === 'global' || b.projekt ? metrics.werkzeugNutzung(db, { project: b.projekt, ...zeitraum }) : null;
    const kacheln = {};
    const kandidaten = [];
    let summe = 0, geschaetzt = false;
    for (const art of ARTEN) {
      kacheln[art] = 0;
      for (const e of inv.arten[art]) {
        let s = null, kosten = null;
        if (nutzung && e.herkunft !== 'lager') {
          if (art === 'skills') s = nutzung.skill[e.name] || 0;
          if (art === 'mcps') { const x = nutzung.mcp[e.konfigName || e.name]; s = x ? x.sitzungen : 0; kosten = x ? x.cost_eur : 0; }
          if ((art === 'plugins' || art === 'mods') && e.plugin) s = nutzung.plugin[e.plugin] || 0;
        }
        e.sitzungen30 = s;
        e.kosten30_eur = kosten;
        e.selten = s !== null && !e.hooks && s <= metrics.WERKZEUG_SELTEN;
        if (e.wirksam[ws] !== true) continue;
        kacheln[art]++;
        const k = e.kontext[ws];
        if (k && k.tokens) { summe += k.tokens; geschaetzt = geschaetzt || k.geschaetzt; }
        if (e.schaltbar && !e.hooks && !e.gesperrt[ws] && k && !k.geschaetzt && s !== null) kandidaten.push({ art, name: e.name, ws, tokens: k.tokens || 0, sitzungen: s });
      }
    }
    const preis = nutzung && nutzung.modell ? pricing.priceFor(nutzung.modell) : null;
    const messung = m[ws];
    return {
      ws, pfad: b.pfad, spalten: inv.spalten, bereiche: bereiche().map((x) => ({ name: x.name, pfad: x.pfad })),
      arten: inv.arten, ebenenFehler: inv.ebenenFehler, kacheln,
      kontext_summe: { tokens: summe, geschaetzt },
      vorschlag: metrics.werkzeugVorschlag({ kandidaten, nutzung, preis }),
      kontext: { gemessen_am: messung ? messung.gemessen_am : null, alt: !messung || bis - Date.parse(messung.gemessen_am) > TAG_MS },
      werkzeugbetrieb_eur_30t: metrics.werkzeuge(db, zeitraum).summe.cost_eur,
      zeitraum,
    };
  }

  async function schalte({ ws, art, name, wert } = {}) {
    if (!['an', 'aus', 'erbt'].includes(wert)) throw fehler('Wert muss an, aus oder erbt sein.', 400);
    if (!ARTEN.includes(art)) throw fehler('Unbekannte Art.', 400);
    const b = bereichVon(ws);
    if (ws === 'global' && wert === 'erbt') throw fehler('Global erbt von nichts – an oder aus.', 400);
    const e = stand().inv.arten[art].find((x) => x.name === name);
    if (!e) throw fehler('Unbekanntes Werkzeug: ' + name, 404);
    if (!e.schaltbar) throw fehler(e.grund || 'Nicht schaltbar.', 409);
    if (e.zellen[ws] === '—' || !b.pfad) throw fehler(name + ' gibt es in ' + ws + ' nicht.', 409);
    if (e.zellen[ws] === '?') throw fehler('Die Einstellungsdatei ist nicht lesbar.', 409);
    if (art === 'mcps' && ws === 'global') throw fehler('Kein globales Aus in Claude Code – je Arbeitsbereich schalten.', 409);
    if (!e.erlaubt[ws].includes(wert)) {
      throw fehler(e.herkunft === 'mcpjson' && wert === 'an' ? 'Server aus .mcp.json gibt Claude Code selbst frei (Freigabedialog) – hier nur aus oder erbt.' : '„' + wert + '“ ist für ' + name + ' in ' + ws + ' nicht wählbar.', 409);
    }
    const settings = ws === 'global' ? path.join(heim(), '.claude', 'settings.json') : path.join(b.pfad, '.claude', 'settings.local.json');
    const konfig = e.konfigName || name;
    let datei = settings, fn;
    if (art === 'skills') fn = (o) => setzeSchluessel(o, ['skillOverrides', name], wert === 'erbt' ? undefined : wert === 'aus' ? 'off' : 'on');
    else if (art === 'plugins' || art === 'mods') fn = (o) => setzeSchluessel(o, ['enabledPlugins', name], wert === 'erbt' ? undefined : wert === 'an');
    else if (e.herkunft === 'mcpjson') {
      fn = (o) => {
        const a = listeSetzen(o, ['enabledMcpjsonServers'], konfig, wert === 'an');
        const z = listeSetzen(o, ['disabledMcpjsonServers'], konfig, wert === 'aus');
        return { vorher: a.vorher ? 'an' : z.vorher ? 'aus' : 'erbt', nachher: wert };
      };
    } else {
      datei = path.join(heim(), '.claude.json');
      fn = (o) => listeSetzen(o, ['projects', projektSchluessel(o, b.pfad), 'disabledMcpServers'], konfig, wert === 'aus');
    }
    // Synchron von Lesen bis rename (aendere), erst danach wird gewartet.
    const r = aendere(datei, fn, { jetzt, sicherung: sicherung() });
    const antwort = { datei, bak: r.bak, vorher: r.vorher, nachher: r.nachher, geaendert: r.geaendert };
    if (!r.geaendert) return antwort;
    // Ab hier ist geschrieben. Was danach scheitert, ist eine Warnung, kein
    // „nicht geschaltet“.
    const warnungen = [];
    try {
      protokoll(db, { quelle: 'werkzeuge', art: 'schalten', objekt: art + ':' + name + '@' + ws, vorher: { datei, wert: r.vorher === undefined ? null : r.vorher }, nachher: { datei, wert: r.nachher === undefined ? null : r.nachher, bak: r.bak } });
    } catch (err) { console.error('Werkzeuge Protokoll:', err); warnungen.push('Protokoll nicht geschrieben (' + err.message + ')'); }
    if (datei.endsWith('.claude.json')) {
      // Eine laufende Claude-Sitzung schreibt die Datei aus ihrem Speicher neu
      // und kann den Schalter zuruecksetzen. Erkennen statt behaupten.
      await warte(NACHPRUEFUNG_MS);
      try {
        const o = (leseJson(datei) || { daten: {} }).daten;
        const p = ((o.projects || {})[projektSchluessel(o, b.pfad)]) || {};
        antwort.gehalten = [].concat(p.disabledMcpServers || []).includes(konfig) === (wert === 'aus');
      } catch (err) { antwort.gehalten = null; warnungen.push('Nachprüfung nicht möglich (' + err.message + ')'); }
    }
    if (warnungen.length) antwort.warnung = 'Geschrieben. ' + warnungen.join(' · ');
    return antwort;
  }

  async function installiere({ ws, name } = {}) {
    const b = bereichVon(ws);
    const quelle = lager();
    // Name zuerst pruefen, dann erst als Pfadteil verwenden.
    // Windows-Geraetenamen (con, nul …) und ein Punkt am Ende sind als Ordner nicht anlegbar.
    const echterOrdner = (p) => { try { const s = fs.lstatSync(p); return s.isDirectory() && !s.isSymbolicLink(); } catch { return false; } };
    if (!quelle || typeof name !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes('..') || name.endsWith('.')
      || /^(con|prn|aux|nul|comd|lptd)(.|$)/i.test(name)
      || !echterOrdner(path.join(quelle, name)) || !fs.existsSync(path.join(quelle, name, 'SKILL.md'))) throw fehler('Nicht im Lager: ' + name, 404);
    if (!b.pfad) throw fehler(ws + ' hat keinen erreichbaren Ordner.', 409);
    const zielOrdner = path.resolve(b.pfad, '.claude', 'skills');
    const ziel = path.join(zielOrdner, name);
    const global = path.join(heim(), '.claude', 'skills', name);
    if (fs.existsSync(ziel) || fs.existsSync(global)) throw fehler(name + ' ist ' + (fs.existsSync(ziel) ? 'in ' + ws : 'global') + ' schon installiert.', 409);
    fs.mkdirSync(zielOrdner, { recursive: true });
    // Verknuepfungen im Lager werden nicht mitkopiert: sie koennten auf beliebige Ordner zeigen.
    fs.cpSync(path.join(quelle, name), ziel, { recursive: true, errorOnExist: true, force: false, filter: (q) => !fs.lstatSync(q).isSymbolicLink() });
    try { protokoll(db, { quelle: 'werkzeuge', art: 'installieren', objekt: 'skills:' + name + '@' + ws, vorher: null, nachher: { ziel } }); } catch (err) {
      console.error('Werkzeuge Protokoll:', err);
      return { ziel, warnung: 'Installiert. Protokoll nicht geschrieben (' + err.message + ')' };
    }
    return { ziel };
  }

  function messe(ws) {
    if (laufend.has(ws)) return laufend.get(ws);
    const lauf = (async () => {
      const b = bereichVon(ws);
      if (!b.pfad) throw fehler(ws + ' hat keinen erreichbaren Ordner.', 409);
      const datei = exe();
      if (!datei) throw fehler('Claude Code nicht gefunden.', 503);
      const k = await misseKontext({ exe: datei, cwd: b.pfad, spawnFn, env: env() });
      const gemessen_am = new Date(jetzt()).toISOString();
      db.prepare('INSERT INTO werkzeug_kontext (bereich, gemessen_am, json) VALUES (?,?,?) ON CONFLICT(bereich) DO UPDATE SET gemessen_am = excluded.gemessen_am, json = excluded.json')
        .run(ws, gemessen_am, JSON.stringify(k));
      return { gemessen_am };
    })();
    laufend.set(ws, lauf);
    lauf.then(() => laufend.delete(ws), () => laufend.delete(ws));
    return lauf;
  }

  function routen(req, res, p, u, mittel) {
    if (p !== '/api/werkzeuge' && !p.startsWith('/api/werkzeuge/')) return false;
    const { sendJson } = mittel;
    const { fehler: fehlerAntwort, post } = require('./sitzungen').routenHelfer(req, res, p, mittel, 'Werkzeuge');
    if (p === '/api/werkzeuge' && req.method === 'GET') {
      try { sendJson(res, liste(u.searchParams.get('ws') || 'global')); } catch (err) { fehlerAntwort(err); }
      return true;
    }
    if (req.method !== 'POST') return false;
    const fn = { '/api/werkzeuge/schalte': schalte, '/api/werkzeuge/installiere': installiere, '/api/werkzeuge/kontext-messen': (d) => messe(d.ws) }[p];
    if (!fn) return false;
    post(fn);
    return true;
  }

  return { liste, schalte, installiere, messe, routen };
}

module.exports = { leseJson, aendere, setzeSchluessel, listeSetzen, parseKontext, misseKontext, inventar, projektSchluessel, erzeuge, ARTEN };
