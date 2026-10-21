'use strict';
// „Merke dir …“ (C9c, Entwurf C9 §3, E6/E7/E11/E12): Cira legt einen Entwurf
// als Freigabe „vault_notiz“ an; in den Vault geschrieben wird erst auf Klick.
// Neue Notiz: c2invoice baut sie selbst (Memory-Schema, tags auf Spalte 0 mit
// Projekt-Tag), T1 formuliert nur. Ergaenzung oder Wiki: Claude (T2) arbeitet in
// einer Kopie von memory/ und wiki/ im Temp-Ordner — nie im Vault selbst
// (Obsidian-Git pusht alle 10 min). Die Freigabe traegt je Datei den neuen Text
// und den Hash des Stands, auf dem der Entwurf beruht; „Speichern“ prueft alle
// Hashes, bevor die erste Datei geschrieben wird.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vault = require('./vault');
const board = require('./board');
const freigaben = require('./freigaben');

const fehler = (status, text) => Object.assign(new Error(text), { status });
const MEMORY_MAX = 140;
const PLATZHALTER = '  - TAG-WAEHLEN';
const NUTZLAST_MAX = 60000;
const UMLAUT = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'ae', Ö: 'oe', Ü: 'ue' };
const slug = (s, trenner) => String(s).replace(/[äöüßÄÖÜ]/g, (c) => UMLAUT[c]).toLowerCase()
  .replace(/[^a-z0-9]+/g, trenner).replace(new RegExp('^' + trenner + '+|' + trenner + '+$', 'g'), '').slice(0, 50) || 'notiz';
const hashNormal = (text) => vault.sha1(vault.normal(text));
const TAG_RE = /^[\p{L}\p{N}_/-]{1,40}$/u;

// Prueft eine Notiz vor jeder Freigabe und vor jedem Schreiben.
// memory/: Memory-Schema (name, description, metadata.type), wiki/: title. Immer: tags auf Spalte 0.
function pruefeNotiz(text, { pfad = 'memory/x.md', neu = true } = {}) {
  const fm = vault.frontmatter(text);
  if (!fm.ok) return { ok: false, grund: 'Frontmatter fehlt oder ist nicht geschlossen (' + pfad + ').' };
  const d = fm.daten;
  const oben = Array.isArray(d.tags) ? d.tags.filter((t) => String(t).trim()) : typeof d.tags === 'string' && d.tags.trim() ? [d.tags] : [];
  if (!oben.length) return { ok: false, grund: 'tags: fehlt auf oberster Ebene (Spalte 0) in ' + pfad + ' — verschachtelt unter metadata sieht Obsidian keinen Tag.' };
  const name = pfad.split('/').pop();
  if (neu && !/^[a-z0-9_-]{3,80}\.md$/.test(name)) return { ok: false, grund: 'Dateiname ungültig: ' + name };
  if (neu && pfad.startsWith('memory/')) {
    if (!d.name || !d.description) return { ok: false, grund: 'name oder description fehlt in ' + pfad + '.' };
    if (!d.metadata || typeof d.metadata !== 'object' || !d.metadata.type) return { ok: false, grund: 'metadata.type fehlt in ' + pfad + '.' };
  }
  if (neu && pfad.startsWith('wiki/') && !d.title) return { ok: false, grund: 'title fehlt in ' + pfad + '.' };
  return { ok: true, tags: oben };
}

// Abschnitt in MEMORY.md: der mit den meisten schon gelisteten Notizen dieses Tags (E12).
function memoryPlan(v, liste, tag) {
  const abs = path.join(v, 'memory', 'MEMORY.md');
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch (e) { return { abschnitt: null, hinweis: e.code === 'ENOENT' ? 'memory/MEMORY.md fehlt — keine Indexzeile.' : 'memory/MEMORY.md nicht lesbar (' + e.code + ') — keine Indexzeile.' }; }
  const zeilen = vault.normal(text).split('\n');
  if (zeilen.length >= MEMORY_MAX) return { abschnitt: null, hinweis: 'MEMORY.md hat ' + zeilen.length + ' Zeilen (Grenze ' + MEMORY_MAX + ') — keine Indexzeile, bitte aussortieren.' };
  const tags = new Map(liste.map((n) => [n.pfad, n.tags.map((t) => t.toLowerCase())]));
  const zaehl = new Map();
  let ab = null;
  for (const z of zeilen) {
    if (/^## /.test(z)) { ab = z.trim(); if (!zaehl.has(ab)) zaehl.set(ab, 0); continue; }
    const m = /\]\(([^)\s]+\.md)\)/.exec(z);
    if (ab && m && tag && (tags.get('memory/' + m[1]) || []).includes(tag.toLowerCase())) zaehl.set(ab, zaehl.get(ab) + 1);
  }
  const best = [...zaehl.entries()].sort((a, b) => b[1] - a[1])[0];
  const abschnitt = best && best[1] > 0 ? best[0] : zaehl.has('## Cross-Projekt') ? '## Cross-Projekt' : [...zaehl.keys()].pop() || null;
  return { abschnitt, hinweis: null };
}
// Zeile am Ende des Abschnitts einfuegen; Zeilenende und BOM der Datei bleiben.
function fuegeMemoryZeile(text, abschnitt, zeile) {
  const z = board.zerlege(text);
  if (z.zeilen.length >= MEMORY_MAX) return null;
  let start = z.zeilen.findIndex((x) => x.trim() === abschnitt);
  let pos;
  if (start < 0) pos = z.zeilen.length;
  else {
    pos = start + 1;
    for (let i = start + 1; i < z.zeilen.length && !/^## /.test(z.zeilen[i]); i++) if (z.zeilen[i].trim()) pos = i + 1;
  }
  // Letzte Zeile ohne Trenner bekommt einen, sonst klebte die neue an ihr.
  if (pos > 0 && !z.trenner[pos - 1]) z.trenner[pos - 1] = z.eol;
  z.zeilen.splice(pos, 0, zeile);
  z.trenner.splice(pos, 0, pos < z.zeilen.length - 1 ? z.eol : '');
  return board.fuege(z);
}

// Alle Dateien eines Ordners (rel mit /) mit Hash. Fuer den Vergleich der T2-Kopie.
function bestand(wurzel) {
  const aus = new Map();
  const geh = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) geh(path.join(abs, e.name), r);
      else if (e.isFile()) aus.set(r, vault.sha1(fs.readFileSync(path.join(abs, e.name))));
    }
  };
  geh(wurzel, '');
  return aus;
}
// Vorschau: gemeinsamer Anfang und Ende weg, dazwischen - alt / + neu.
function vorschau(alt, neu) {
  const a = alt === null ? [] : vault.normal(alt).split('\n');
  const b = vault.normal(neu).split('\n');
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let e = 0;
  while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  const raus = a.slice(s, a.length - e).map((z) => '- ' + z), rein = b.slice(s, b.length - e).map((z) => '+ ' + z);
  const zeilen = raus.concat(rein);
  return (s ? '@@ ab Zeile ' + (s + 1) + '\n' : '') + zeilen.slice(0, 80).join('\n') + (zeilen.length > 80 ? '\n… ' + (zeilen.length - 80) + ' weitere Zeilen' : '');
}

// gedaechtnis: Dienst (liste, suche, indexiere). ausText/t2Lauf: cira-Dienst. bereiche(): config.arbeitsbereiche.
function erzeuge({ db, vaultPfad, gedaechtnis, ausText = null, t2Lauf = null, bereiche = () => [], tmp = null }) {
  const tagZaehlung = (liste) => {
    const n = new Map();
    for (const x of liste) for (const t of x.tags) n.set(t, (n.get(t) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  };

  // Projekt-Tag (E12): Arbeitsbereich des Gespraechs, dann „fuer X“, sonst Auswahl in der Freigabe.
  function tagFuer({ arbeitsbereich, tagWort }, liste) {
    const abs = bereiche();
    const ab = arbeitsbereich ? abs.find((a) => a.name === arbeitsbereich) : null;
    if (ab && typeof ab.tag === 'string' && TAG_RE.test(ab.tag)) return ab.tag;
    if (tagWort) {
      const w = String(tagWort).toLowerCase();
      const bekannt = tagZaehlung(liste).map(([t]) => t).find((t) => t.toLowerCase() === w);
      if (bekannt && TAG_RE.test(bekannt)) return bekannt;
      const perName = abs.find((a) => typeof a.tag === 'string' && TAG_RE.test(a.tag) && [a.name, a.kuerzel, a.projekt].some((x) => typeof x === 'string' && x.toLowerCase() === w));
      if (perName) return perName.tag;
    }
    return null;
  }

  async function entwirfNeu({ satz, arbeitsbereich = null, tagWort = null, signal = null }) {
    const v = vaultPfad();
    gedaechtnis.indexiere();
    const liste = gedaechtnis.liste();
    const tag = tagFuer({ arbeitsbereich, tagWort }, liste);
    const tagWahl = tag ? [] : tagZaehlung(liste).slice(0, 12).map(([t]) => t).filter((t) => TAG_RE.test(t));
    if (!tag && !tagWahl.length) return { fehlt: 'Für die Notiz fehlt ein Projekt-Tag. Sag „merke dir für <Tag>: …“ oder trag am Arbeitsbereich einen Tag ein.' };
    let titel = null, beschreibung = null, rumpf = null, modell = null, formuliert = null;
    if (ausText) {
      const r = await ausText({ auftrag: 'Mach daraus eine kurze Notiz für das Gedächtnis. Zeile 1: Titel, höchstens acht Wörter. Zeile 2: Beschreibung in einem Satz. Danach der Inhalt in ein bis drei Sätzen. Nichts hinzuerfinden.', text: satz, rolle: 'text', signal });
      const z = r.text ? r.text.split('\n').map((s) => s.replace(/^(#+|titel:|beschreibung:|\*\*)\s*/i, '').replace(/\*\*/g, '').trim()).filter(Boolean) : [];
      if (z.length >= 3) { titel = z[0].slice(0, 80); beschreibung = z[1].slice(0, 200); rumpf = z.slice(2).join('\n\n'); modell = r.modell; }
      formuliert = r.fehlt ? 'Ohne Modell formuliert: ' + r.fehlt : z.length < 3 ? 'Modellantwort unbrauchbar, Satz übernommen' : r.gestrichen ? r.gestrichen + ' Zeilen mit fremden Zahlen gestrichen' : null;
    } else formuliert = 'Ohne Modell formuliert';
    if (!titel) {
      titel = satz.split(/\s+/).slice(0, 8).join(' ').replace(/[.,;:!?]+$/, '').slice(0, 80);
      beschreibung = (satz.split(/(?<=[.!?])\s/)[0] || satz).slice(0, 200);
      rumpf = satz;
    }
    const basis = 'project_' + slug(titel, '_');
    let datei = 'memory/' + basis + '.md';
    for (let i = 2; fs.existsSync(path.join(v, ...datei.split('/'))) || liste.some((n) => n.pfad === datei); i++) datei = 'memory/' + basis + '_' + i + '.md';
    const verwandt = vault.suche(liste.filter((n) => !/(^|\/)(MEMORY|index)\.md$/i.test(n.pfad) && !n.pfad.startsWith('Briefings/')),
      // Nur tragende Woerter: „der“, „nur“, „keine“ fanden sonst irgendetwas.
      satz.split(/\s+/).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length >= 5).join(' '), 3)
      .map((t) => '[[' + t.pfad.split('/').pop().replace(/\.md$/i, '') + ']]');
    const text = ['---', 'name: ' + slug(titel, '-'), 'description: ' + JSON.stringify(beschreibung), 'tags:', tag ? '  - ' + tag : PLATZHALTER,
      'metadata:', '  type: project', '  quelle: c2invoice', '  created: ' + new Date().toISOString().slice(0, 10), '---', '',
      rumpf, ...(verwandt.length ? ['', 'Verwandt: ' + verwandt.join(', ')] : []), ''].join('\n');
    const p = pruefeNotiz(text.replace(PLATZHALTER, '  - x'), { pfad: datei });
    if (!p.ok) return { fehlt: 'Entwurf ungültig: ' + p.grund };
    const mem = memoryPlan(v, liste, tag);
    const memory = mem.abschnitt ? { abschnitt: mem.abschnitt, zeile: '- [' + titel.replace(/[[\]]/g, '') + '](' + datei.split('/').pop() + ') — ' + beschreibung } : null;
    const f = freigaben.ersetze(db, {
      art: 'vault_notiz', bezug: datei, quelle: 'cira', titel: ('Notiz „' + titel + '“ in den Vault').slice(0, 200),
      text: 'Neue Datei ' + datei + (tag ? ' · Tag ' + tag : ' · Tag bitte wählen') + (memory ? ' · Zeile in MEMORY.md unter ' + memory.abschnitt : '') + (mem.hinweis ? ' · ' + mem.hinweis : '') + (formuliert ? ' · ' + formuliert : '') + '.',
      nutzlast: { art: 'neu', pfad: datei, text, tag, tagWahl, memory, hinweis: mem.hinweis, modell },
    });
    return { freigabe: f, pfad: datei, tag };
  }

  // Ergaenzung (ziel = Pfad) oder neue Wiki-Notiz (ziel = null) ueber T2 in einer Kopie.
  async function entwirfT2({ satz, ziel = null, signal = null }) {
    const v = vaultPfad();
    if (!t2Lauf) return { fehlt: 'Claude (T2) ist hier nicht verfügbar.' };
    // Langer Pfad: unter dem 8.3-Kurznamen (C:\Users\ABCDEF~1) hielt Claude den Ordner fuer fremd und verweigerte Lesen und Schreiben (Probe 21.10.).
    const kopie = fs.realpathSync.native(fs.mkdtempSync(path.join(tmp || os.tmpdir(), 'c2i-merken-')));
    try {
      for (const ord of ['memory', 'wiki']) {
        const q = path.join(v, ord);
        if (!fs.existsSync(q)) continue;
        fs.cpSync(q, path.join(kopie, ord), { recursive: true, filter: (src) => { const b = path.basename(src); if (b.startsWith('.')) return false; const st = fs.lstatSync(src); return !st.isSymbolicLink() && (st.isDirectory() || /\.md$/i.test(b)); } });
      }
      const vorher = bestand(kopie);
      const basis = new Map([...vorher.keys()].map((rel) => [rel, fs.readFileSync(path.join(kopie, ...rel.split('/')), 'utf8')]));
      // Deny je Top-Level-Name des Vaults ausser memory/wiki (E7); die Kopie hat sie nicht, Claude soll sie auch nicht anlegen.
      const namen = new Set(['Briefings', 'raw', 'index.md', 'CLAUDE.md', 'log.md']);
      for (const e of fs.readdirSync(v, { withFileTypes: true })) if (!['memory', 'wiki'].includes(e.name)) namen.add(e.name);
      const zusatzVerbot = [...namen].filter((n) => !/[,()*?[\]!\\\s]/.test(n)).flatMap((n) => [n, n + '/**']);
      const auftrag = ziel
        ? 'Ergänze in der Datei ' + ziel + ' den INHALT unten an passender Stelle. Bestehendes nicht löschen.'
        : 'Lege im Ordner wiki/ eine neue Notiz für den INHALT unten an (Dateiname klein, mit Bindestrichen, .md) oder ergänze eine eindeutig passende bestehende Notiz in wiki/.';
      const r = await t2Lauf({
        profil: 'schreiben', cwd: kopie, zusatzVerbot, signal,
        prompt: auftrag + ' Arbeite nur mit relativen Pfaden im aktuellen Ordner. Schreibe nur in memory/ oder wiki/. Jede Notiz braucht Frontmatter mit tags: auf oberster Ebene (Spalte 0); eine neue Wiki-Notiz außerdem title:. ' +
          'Antworte zum Schluss mit einem Satz, was du geändert hast.\n\nINHALT: ' + satz,
      });
      if (r.fehlt) return { fehlt: r.fehlt };
      const nachher = bestand(kopie);
      const geloescht = [...vorher.keys()].filter((k) => !nachher.has(k));
      const geaendert = [...nachher.keys()].filter((k) => vorher.get(k) !== nachher.get(k));
      const fremd = geaendert.filter((k) => !/^(memory|wiki)\/[^/].*\.md$/i.test(k) || k.split('/').some((t) => t.startsWith('.')));
      if (fremd.length) return { fehlt: 'Claude hat außerhalb von memory/ und wiki/ geschrieben (' + fremd.slice(0, 5).join(', ') + ') — Entwurf verworfen.' };
      if (geloescht.length) return { fehlt: 'Claude hat Dateien gelöscht (' + geloescht.slice(0, 5).join(', ') + ') — Entwurf verworfen.' };
      if (!geaendert.length) return { fehlt: 'Claude hat nichts geändert.' + (r.text ? ' ' + String(r.text).slice(0, 300) : '') };
      const dateien = [];
      const vorschauen = [];
      for (const rel of geaendert) {
        const neu = fs.readFileSync(path.join(kopie, ...rel.split('/')), 'utf8');
        const istNeu = !vorher.has(rel);
        const p = pruefeNotiz(neu, { pfad: rel, neu: istNeu });
        if (!p.ok) return { fehlt: 'Entwurf verworfen: ' + p.grund };
        dateien.push({ pfad: rel, basis: istNeu ? null : hashNormal(basis.get(rel)), neu: vault.normal(neu) });
        vorschauen.push('### ' + rel + (istNeu ? ' (neu)' : '') + '\n' + vorschau(istNeu ? null : basis.get(rel), neu));
      }
      const nutzlast = { art: 'aenderung', dateien, vorschau: vorschauen.join('\n\n'), antwort: String(r.text || '').slice(0, 600) };
      if (JSON.stringify(nutzlast).length > NUTZLAST_MAX) return { fehlt: 'Der Entwurf ist zu groß für eine Freigabe (über ' + Math.round(NUTZLAST_MAX / 1000) + ' KB). Bitte kleiner fassen.' };
      const f = freigaben.ersetze(db, {
        art: 'vault_notiz', bezug: (ziel || dateien[0].pfad).slice(0, 120), quelle: 'cira',
        titel: (ziel ? 'Ergänzung in ' + ziel : 'Wiki-Notiz ' + dateien[0].pfad).slice(0, 200),
        text: dateien.length + (dateien.length === 1 ? ' Datei: ' : ' Dateien: ') + dateien.map((d) => d.pfad + (d.basis === null ? ' (neu)' : '')).join(', ') + '. ' + nutzlast.antwort,
        nutzlast,
      });
      return { freigabe: f, dateien: dateien.map((d) => d.pfad), kostenUsd: r.kostenUsd };
    } finally {
      fs.rmSync(kopie, { recursive: true, force: true });
    }
  }

  // Einstieg aus Cira (T0-Absicht). art: neu | ergaenze | wiki.
  async function entwirf({ art, satz, ziel = null, tagWort = null, arbeitsbereich = null, signal = null }) {
    if (!vaultPfad()) return { fehlt: 'Kein Vault eingerichtet (Arbeitsbereich mit art „vault“ in config.json).' };
    if (typeof satz !== 'string' || satz.trim().length < 3) return { fehlt: 'Was soll ich mir merken?' };
    if (art === 'neu') return entwirfNeu({ satz: satz.trim(), arbeitsbereich, tagWort, signal });
    if (art === 'ergaenze') {
      gedaechtnis.indexiere();
      const w = String(ziel || '').trim().toLowerCase().replace(/\.md$/, '').replace(/^\[\[|\]\]$/g, '');
      const n = gedaechtnis.liste().find((x) => /^(memory|wiki)\//.test(x.pfad) && (x.pfad.toLowerCase().replace(/\.md$/, '') === w || x.pfad.split('/').pop().toLowerCase().replace(/\.md$/, '') === w || x.titel.toLowerCase() === w));
      if (!n) return { fehlt: 'Die Notiz „' + String(ziel).slice(0, 80) + '“ finde ich nicht in memory/ oder wiki/.' };
      return entwirfT2({ satz: satz.trim(), ziel: n.pfad, signal });
    }
    if (art === 'wiki') return entwirfT2({ satz: satz.trim(), signal });
    return { fehlt: 'Unbekannte Art.' };
  }

  /* ---------- Speichern (Freigabe vault_notiz) ---------- */
  // Verknuepfung (Symlink, Junction) unter memory/ oder wiki/ darf nicht anderswohin im Vault fuehren.
  function imOrdner(v, rel, abs) {
    const wurzel = fs.realpathSync(path.join(v, rel.split('/')[0]));
    let echt;
    try { echt = fs.realpathSync(abs); } catch { let d = path.dirname(abs); while (!fs.existsSync(d)) d = path.dirname(d); echt = path.join(fs.realpathSync(d), path.relative(d, abs)); }
    if (!echt.startsWith(wurzel + path.sep)) throw fehler(400, 'Entwurf ungültig: ' + rel + ' liegt nicht in ' + rel.split('/')[0] + '/.');
  }
  function schreibeAlle(plan) {
    // Erst alle Temp-Dateien, dann umbenennen: ein Fehler beim Schreiben laesst den Vault unberuehrt.
    const tmps = [];
    try {
      for (const p of plan) { const t = p.abs + '.c2i-tmp'; fs.mkdirSync(path.dirname(p.abs), { recursive: true }); fs.rmSync(t, { force: true }); fs.writeFileSync(t, p.text, { flag: 'wx' }); tmps.push(t); }
    } catch (e) { for (const t of tmps) fs.rmSync(t, { force: true }); throw e; }
    let i = 0;
    try { for (; i < plan.length; i++) fs.renameSync(plan[i].abs + '.c2i-tmp', plan[i].abs); } catch (e) {
      for (const t of tmps.slice(i)) fs.rmSync(t, { force: true });
      throw Object.assign(new Error((i ? i + ' von ' + plan.length + ' Dateien geschrieben, dann: ' : '') + e.message), { status: 409 });
    }
  }
  // Text in der Form der Vault-Datei: BOM und CRLF, wenn sie die hat.
  const inForm = (neu, alt) => {
    let t = vault.normal(neu);
    if (alt && alt.includes('\r\n')) t = t.replace(/\n/g, '\r\n');
    if (alt && alt.charCodeAt(0) === 0xfeff) t = '﻿' + t;
    return t;
  };

  function speichere(dbx, n, { hinweis } = {}) {
    const v = vaultPfad();
    if (!v) throw fehler(409, 'Kein Vault eingerichtet.');
    if (!n || typeof n !== 'object') throw fehler(400, 'Entwurf fehlt.');
    if (n.art === 'neu') {
      if (typeof n.pfad !== 'string' || !/^memory\/[a-z0-9_-]{3,80}\.md$/.test(n.pfad) || typeof n.text !== 'string') throw fehler(400, 'Entwurf ungültig.');
      let text = n.text, tag = n.tag;
      if (!tag) {
        const m = /^tag:(.{1,40})$/u.exec(String(hinweis || '').trim());
        if (!m || !TAG_RE.test(m[1]) || !(n.tagWahl || []).includes(m[1])) throw fehler(409, 'Bitte zuerst einen Projekt-Tag wählen.');
        tag = m[1];
        if (!text.includes(PLATZHALTER)) throw fehler(409, 'Entwurf ohne Tag-Platzhalter.');
        text = text.replace(PLATZHALTER, '  - ' + tag);
      }
      const p = pruefeNotiz(text, { pfad: n.pfad });
      if (!p.ok) throw fehler(409, p.grund);
      const abs = vault.sicher(v, n.pfad);
      imOrdner(v, n.pfad, abs);
      if (fs.existsSync(abs)) throw fehler(409, 'Die Datei gibt es schon: ' + n.pfad);
      schreibeAlle([{ abs, text }]);
      let memory = null;
      if (n.memory && n.memory.abschnitt && typeof n.memory.zeile === 'string') {
        try {
          const ziel = path.join(v, 'memory', 'MEMORY.md');
          let eingefuegt = false;
          board.schreibeAtomar(ziel, (alt) => { const neu = fuegeMemoryZeile(alt, n.memory.abschnitt, n.memory.zeile); eingefuegt = neu !== null; return neu === null ? alt : neu; });
          memory = eingefuegt ? 'Zeile unter ' + n.memory.abschnitt : 'MEMORY.md hat ' + MEMORY_MAX + ' Zeilen erreicht — keine Zeile.';
        } catch (e) {
          // Die Notiz liegt; nur die Indexzeile fehlt. Sagen statt die ganze Freigabe scheitern zu lassen.
          console.error('Merken: MEMORY.md nicht ergaenzt:', e.message);
          memory = 'MEMORY.md nicht ergänzt: ' + e.message;
        }
      }
      freigaben.protokoll(dbx, { quelle: 'merken', art: 'vault_notiz', objekt: n.pfad, vorher: null, nachher: { hash: hashNormal(text), tag, memory } });
      try { gedaechtnis.indexiere(); } catch (e) { console.error('Merken: Index nicht nachgezogen:', e.message); }
      return { pfad: n.pfad, tag, memory };
    }
    if (n.art === 'aenderung') {
      if (!Array.isArray(n.dateien) || !n.dateien.length || n.dateien.length > 20) throw fehler(400, 'Entwurf ungültig.');
      const plan = [];
      for (const d of n.dateien) {
        if (!d || typeof d.pfad !== 'string' || !/^(memory|wiki)\//.test(d.pfad) || typeof d.neu !== 'string') throw fehler(400, 'Entwurf ungültig.');
        const abs = vault.sicher(v, d.pfad);
        imOrdner(v, d.pfad, abs);
        let alt = null;
        try { alt = fs.readFileSync(abs, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw fehler(409, d.pfad + ' nicht lesbar: ' + e.code); }
        if (d.basis === null && alt !== null) throw fehler(409, d.pfad + ' gibt es inzwischen — Entwurf neu erstellen.');
        if (d.basis !== null && (alt === null || hashNormal(alt) !== d.basis)) throw fehler(409, d.pfad + ' hat sich seit dem Entwurf geändert — Entwurf neu erstellen.');
        const p = pruefeNotiz(d.neu, { pfad: d.pfad, neu: d.basis === null });
        if (!p.ok) throw fehler(409, p.grund);
        plan.push({ abs, text: inForm(d.neu, alt), pfad: d.pfad, vorher: alt === null ? null : hashNormal(alt) });
      }
      schreibeAlle(plan);
      for (const p of plan) freigaben.protokoll(dbx, { quelle: 'merken', art: 'vault_notiz', objekt: p.pfad, vorher: p.vorher === null ? null : { hash: p.vorher }, nachher: { hash: hashNormal(p.text) } });
      try { gedaechtnis.indexiere(); } catch (e) { console.error('Merken: Index nicht nachgezogen:', e.message); }
      return { dateien: plan.map((p) => p.pfad) };
    }
    throw fehler(400, 'Entwurf ungültig.');
  }
  freigaben.registriere('vault_notiz', speichere);

  return { entwirf, speichere, pruefeNotiz };
}

module.exports = { erzeuge, pruefeNotiz, fuegeMemoryZeile, vorschau, PLATZHALTER, MEMORY_MAX };
