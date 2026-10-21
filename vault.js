'use strict';
// Vault (C9): reine Kerne fuer Briefings, Gedaechtnis und „Merke dir“.
// Frontmatter in zwei Schemata (memory: name/description/metadata, wiki:
// title/tags/created), Wikilinks, Index in notiz_index, Gruppen aus
// .obsidian/graph.json, Pfadpruefung, Suche, Quellenregeln. Kein YAML-Paket:
// Schluessel, Skalare, [a, b], - a-Listen und eine verschachtelte Ebene reichen
// fuer beide Schemata (gemessen am echten Vault, Entwurf §1.5).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getMeta, setMeta } = require('./db');

// Nie im Index (E4): Ordner mit Punkt (.obsidian, .git, .claude …) ueberall,
// dazu diese auf oberster Ebene.
const AUSSCHLUSS = new Set(['docs', 'scripts', 'node_modules']);
const RUMPF_MAX = 200000;

const fehler = (status, text) => Object.assign(new Error(text), { status });
const normal = (text) => String(text == null ? '' : text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const unq = (s) => { const t = String(s).trim(); return /^"(.*)"$/.test(t) || /^'(.*)'$/.test(t) ? t.slice(1, -1) : t; };
function skalar(v) {
  const t = v.trim();
  if (/^\[.*\]$/.test(t)) return t.slice(1, -1).split(',').map(unq).filter(Boolean);
  return unq(t);
}

// { daten, rumpf, ok }: ok = Frontmatter vorhanden und geschlossen.
function frontmatter(text) {
  const t = normal(text);
  if (!t.startsWith('---\n')) return { daten: {}, rumpf: t, ok: false };
  const m = /\n---[ \t]*(?:\n|$)/.exec(t.slice(3));
  if (!m) return { daten: {}, rumpf: t, ok: false };
  const kopf = t.slice(4, 3 + m.index);
  const rumpf = t.slice(3 + m.index + m[0].length);
  const daten = {};
  let key = null, map = null, mapInd = 0, sub = null;
  for (const z of kopf.split('\n')) {
    if (!z.trim() || /^\s*#/.test(z)) continue;
    const ind = z.length - z.trimStart().length;
    const li = /^\s*-(?:\s+(.*))?$/.exec(z);
    if (li) {
      const wert = unq(li[1] || '');
      if (map && sub !== null && ind > mapInd) { if (!Array.isArray(map[sub])) map[sub] = []; map[sub].push(wert); }
      else if (key !== null && !map) { if (!Array.isArray(daten[key])) daten[key] = []; daten[key].push(wert); }
      continue;
    }
    const kv = /^\s*([^:\s][^:]*?):(?:\s+(.*)|\s*)$/.exec(z);
    if (!kv) continue;
    const v = kv[2] === undefined || kv[2] === '' ? null : skalar(kv[2]);
    if (ind === 0) { key = kv[1]; map = null; sub = null; daten[key] = v; continue; }
    if (key === null) continue;
    if (!map) {
      if (daten[key] !== null) continue;   // Skalar oder Liste mit eingerueckten Schluesseln: nicht unser Schema
      map = daten[key] = {};
      mapInd = ind;
    }
    if (ind === mapInd) { sub = kv[1]; map[sub] = v; }
  }
  return { daten, rumpf, ok: true };
}

const alsListe = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? v.split(/[,\s]+/) : []);
// Tags auf Spalte 0 gewinnen; nur ohne sie zaehlen die unter metadata (95 alte memory-Dateien).
function tagsAus(daten) {
  const d = daten || {};
  const oben = alsListe(d.tags);
  const quelle = oben.length ? oben : alsListe(d.metadata && typeof d.metadata === 'object' ? d.metadata.tags : null);
  const aus = [];
  for (const t of quelle) { const s = String(t).trim().replace(/^#/, ''); if (s && !aus.includes(s)) aus.push(s); }
  return aus;
}

function wikilinksAus(text) {
  const ohneCode = normal(text).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const aus = [];
  for (const m of ohneCode.matchAll(/\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|[^\]\n]*)?\]\]/g)) {
    const z = m[1].trim().replace(/\.md$/i, '');
    if (z && !aus.includes(z)) aus.push(z);
  }
  return aus;
}

function titelAus(daten, rumpf, rel) {
  const d = daten || {};
  for (const k of ['title', 'name']) if (typeof d[k] === 'string' && d[k].trim()) return d[k].trim().slice(0, 200);
  const h = /^#\s+(.+)$/m.exec(normal(rumpf));
  if (h) return h[1].trim().slice(0, 200);
  return path.posix.basename(String(rel).replace(/\\/g, '/')).replace(/\.md$/i, '');
}

// Relativer Pfad -> absoluter Pfad im Vault, sonst 400. Nie Ordner mit Punkt
// (.obsidian, .git, .claude), nie ausserhalb, nur .md. Liegt die Datei schon
// da, muss auch ihr echter Pfad (Verknuepfungen aufgeloest) im Vault liegen.
function sicher(vault, rel) {
  const weg = () => fehler(400, 'Pfad ungültig.');
  if (!vault || typeof rel !== 'string' || !rel || rel.length > 300 || /[\u0000-\u001f"<>|?*:]/.test(rel)) throw weg();
  const n = rel.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(n) || n.startsWith('/') || !/\.md$/i.test(n)) throw weg();
  const teile = n.split('/');
  if (teile.some((t) => t === '' || t === '.' || t === '..' || /[. ]$/.test(t))) throw weg();
  if (teile.some((t) => /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(t))) throw weg();
  if (teile.slice(0, -1).some((t) => t.startsWith('.'))) throw weg();
  const basis = path.resolve(vault);
  const abs = path.resolve(basis, ...teile);
  if (!abs.startsWith(basis + path.sep)) throw weg();
  let echt = null;
  try { echt = fs.realpathSync(abs); } catch { /* neue Datei: Ordner pruefen */ }
  if (echt === null) { try { echt = path.join(fs.realpathSync(path.dirname(abs)), path.basename(abs)); } catch { echt = null; } }
  if (echt !== null) {
    let echtBasis = basis;
    try { echtBasis = fs.realpathSync(basis); } catch { /* Vault fehlt: unten */ }
    if (!echt.startsWith(echtBasis + path.sep)) throw weg();
  }
  return abs;
}

const hex = (rgb) => '#' + ((Number(rgb) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
const QUERY_RE = /^(tag:#[^\s#]+|path:[^\s]+)$/;
// Farbgruppen (E5): eigene aus config, sonst die von Obsidian, sonst keine.
function gruppenAus(vault, eigene) {
  // Von Hand in config.json eingetragen: dieselbe Pruefung wie aus der Oberflaeche (die Farbe landet im Browser).
  const gut = (Array.isArray(eigene) ? eigene : []).filter((g) => g && typeof g.query === 'string' && QUERY_RE.test(g.query.trim()) && /^#[0-9a-fA-F]{6}$/.test(g.farbe || ''));
  if (gut.length) return { quelle: 'eigene', gruppen: gut.map((g) => ({ query: g.query.trim(), farbe: g.farbe.toLowerCase() })) };
  if (!vault) return { quelle: 'ordner', gruppen: [] };
  const datei = path.join(vault, '.obsidian', 'graph.json');
  let roh;
  try { roh = fs.readFileSync(datei, 'utf8'); } catch (e) {
    if (e.code !== 'ENOENT') console.error('Vault graph.json nicht lesbar:', e.message);
    return { quelle: 'ordner', gruppen: [] };
  }
  try {
    const g = JSON.parse(roh.replace(/^﻿/, ''));
    const liste = (Array.isArray(g.colorGroups) ? g.colorGroups : [])
      .filter((c) => c && typeof c.query === 'string' && QUERY_RE.test(c.query.trim()) && c.color)
      .map((c) => ({ query: c.query.trim(), farbe: hex(c.color.rgb) }));
    return { quelle: liste.length ? 'obsidian' : 'ordner', gruppen: liste };
  } catch (e) {
    console.error('Vault graph.json kein JSON:', e.message);
    return { quelle: 'ordner', gruppen: [] };
  }
}

// Erste passende Regel gewinnt (wie in Obsidian). Ohne Treffer: oberster Ordner.
function gruppeVon(notiz, gruppen) {
  const p = notiz.pfad.toLowerCase();
  const tags = (notiz.tags || []).map((t) => t.toLowerCase());
  for (const g of gruppen) {
    const q = g.query.toLowerCase();
    if (q.startsWith('tag:#')) {
      const t = q.slice(5);
      if (tags.some((x) => x === t || x.startsWith(t + '/'))) return { id: g.query, farbe: g.farbe };
    } else if (q.startsWith('path:') && p.startsWith(q.slice(5).replace(/\/$/, '') + '/')) return { id: g.query, farbe: g.farbe };
  }
  return { id: 'ordner:' + (notiz.ordner || ''), farbe: null };
}

// Quellen-Muster (C9a): * = beliebig ohne /, JJJJ-MM-TT = Datum, sonst woertlich.
function regel(muster) {
  if (typeof muster !== 'string' || !muster.trim() || muster.length > 80 || (muster.match(/\*/g) || []).length > 3 || /[\u0000-\u001f]/.test(muster)) {
    throw fehler(400, 'Muster: 1 bis 80 Zeichen, höchstens drei *.');
  }
  const src = muster.trim().split(/(JJJJ-MM-TT|\*)/).map((t) => (t === '*' ? '[^/]*' : t === 'JJJJ-MM-TT' ? '\\d{4}-\\d{2}-\\d{2}' : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
  return new RegExp('^' + src + '$', 'i');
}

// Alle .md des Vaults ausser dem Ausschluss. Verknuepfte Ordner werden nicht betreten (Schleifen).
// aus.teilweise: ein Ordner oder eine Datei war gerade nicht lesbar (Obsidian-Git-Pull) —
// dann darf der Index nichts als geloescht werten.
function walk(vault) {
  const aus = [];
  aus.teilweise = false;
  const geh = (abs, rel, oben) => {
    let eintraege;
    try { eintraege = fs.readdirSync(abs, { withFileTypes: true }); } catch (e) {
      if (oben) throw e;
      console.error('Vault: Ordner nicht lesbar ' + rel + ':', e.message);
      aus.teilweise = true;
      return;
    }
    for (const e of eintraege) {
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
      if (oben && AUSSCHLUSS.has(e.name)) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) geh(path.join(abs, e.name), r, false);
      else if (e.isFile() && /\.md$/i.test(e.name)) {
        try { const st = fs.statSync(path.join(abs, e.name)); aus.push({ rel: r, groesse: st.size, mtime: st.mtimeMs }); } catch (err) { if (err.code !== 'ENOENT') aus.teilweise = true; }
      }
    }
  };
  geh(vault, '', true);
  return aus;
}

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const gemeldet = new Set();
function parse(rel, roh) {
  const fm = frontmatter(roh);
  const rumpf = fm.ok ? fm.rumpf : normal(roh);
  const teile = rel.split('/');
  return {
    pfad: rel, ordner: teile.length > 1 ? teile[0] : '', titel: titelAus(fm.daten, rumpf, rel),
    tags: tagsAus(fm.daten), links: wikilinksAus(rumpf), frontmatter: fm.daten, rumpf: rumpf.slice(0, RUMPF_MAX),
  };
}

// Index nachziehen. Unveraendert = gleiche Groesse UND gleiche mtime (ungerundet,
// LEDGER Block L). Synchron, eine Transaktion ohne await.
function indexiere(db, vault) {
  const wurzel = path.resolve(vault);
  if (getMeta(db, 'vault_index_pfad') !== wurzel) {
    db.exec('DELETE FROM notiz_index');
    setMeta(db, 'vault_index_pfad', wurzel);
  }
  const dateien = walk(wurzel);
  const alt = new Map(db.prepare('SELECT pfad, groesse, mtime FROM notiz_index').all().map((r) => [r.pfad, r]));
  const schreiben = [];
  let neu = 0, geaendert = 0;
  for (const d of dateien) {
    const a = alt.get(d.rel);
    alt.delete(d.rel);
    if (a && a.groesse === d.groesse && a.mtime === d.mtime) continue;
    let roh;
    try { roh = fs.readFileSync(path.join(wurzel, ...d.rel.split('/'))); } catch (e) {
      if (e.code === 'ENOENT') { if (a) alt.set(d.rel, a); continue; }   // verschwunden: wie geloescht
      // Einmal je Stand melden, nicht alle 30 s.
      const k = d.rel + '|' + d.mtime;
      if (!gemeldet.has(k)) { gemeldet.add(k); console.error('Vault: ' + d.rel + ' nicht lesbar:', e.message); }
      continue;
    }
    schreiben.push({ d, n: parse(d.rel, roh.toString('utf8')), hash: sha1(roh) });
    if (a) geaendert++; else neu++;
  }
  // Unvollstaendiger Lauf: nichts entfernen, sonst fehlten Notizen bis zum naechsten Takt.
  const entfernt = dateien.teilweise ? [] : [...alt.keys()];
  if (schreiben.length || entfernt.length) {
    const jetzt = new Date().toISOString();
    const ein = db.prepare(`INSERT INTO notiz_index (pfad, ordner, titel, tags_json, links_json, frontmatter_json, rumpf, groesse, mtime, hash, indexiert)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pfad) DO UPDATE SET ordner = excluded.ordner, titel = excluded.titel, tags_json = excluded.tags_json,
      links_json = excluded.links_json, frontmatter_json = excluded.frontmatter_json, rumpf = excluded.rumpf, groesse = excluded.groesse,
      mtime = excluded.mtime, hash = excluded.hash, indexiert = excluded.indexiert`);
    const weg = db.prepare('DELETE FROM notiz_index WHERE pfad = ?');
    db.exec('BEGIN');
    try {
      for (const { d, n, hash } of schreiben) {
        ein.run(n.pfad, n.ordner, n.titel, JSON.stringify(n.tags), JSON.stringify(n.links), JSON.stringify(n.frontmatter), n.rumpf, d.groesse, d.mtime, hash, jetzt);
      }
      for (const p of entfernt) weg.run(p);
      setMeta(db, 'vault_index_stand', Number(getMeta(db, 'vault_index_stand') || 0) + 1);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  setMeta(db, 'vault_index_zeit', new Date().toISOString());
  return { neu, geaendert, entfernt: entfernt.length, gesamt: dateien.length };
}

const ausJson = (s, sonst) => { try { return s == null ? sonst : JSON.parse(s); } catch { return sonst; } };
function notizen(db) {
  return db.prepare('SELECT pfad, ordner, titel, tags_json, links_json, frontmatter_json, rumpf, hash FROM notiz_index ORDER BY pfad').all()
    .map((r) => ({ pfad: r.pfad, ordner: r.ordner, titel: r.titel, tags: ausJson(r.tags_json, []), links: ausJson(r.links_json, []),
      frontmatter: ausJson(r.frontmatter_json, {}), rumpf: r.rumpf || '', hash: r.hash }));
}

// Wikilink-Ziel -> Pfad einer Notiz: mit Ordner zuerst der volle Pfad, sonst
// (und als Rueckfall) der Dateiname ohne Ordner.
function zielKarte(liste) {
  const voll = new Map(), name = new Map();
  for (const n of liste) {
    const ohne = n.pfad.replace(/\.md$/i, '').toLowerCase();
    voll.set(ohne, n.pfad);
    const b = ohne.split('/').pop();
    if (!name.has(b)) name.set(b, n.pfad);
  }
  return (ziel) => {
    const z = String(ziel).toLowerCase().replace(/\\/g, '/');
    return voll.get(z) || name.get(z.split('/').pop()) || null;
  };
}

// T0-Suche: je Wort Titel x3, Tag x2, Rumpf x1. Hoechstens `max` Treffer mit Punkten > 0.
function suche(liste, q, max = 7) {
  const woerter = [...new Set(String(q || '').toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((w) => w.length >= 2))].slice(0, 12);
  if (!woerter.length) return [];
  const aus = [];
  for (const n of liste) {
    const t = n.titel.toLowerCase(), r = n.rumpf.toLowerCase(), tags = n.tags.map((x) => x.toLowerCase());
    let punkte = 0;
    for (const w of woerter) {
      if (t.includes(w)) punkte += 3;
      if (tags.some((x) => x.includes(w))) punkte += 2;
      if (r.includes(w)) punkte += 1;
    }
    if (punkte > 0) aus.push({ pfad: n.pfad, titel: n.titel, ordner: n.ordner, punkte });
  }
  return aus.sort((a, b) => b.punkte - a.punkte || a.pfad.localeCompare(b.pfad)).slice(0, max);
}

module.exports = { AUSSCHLUSS, normal, frontmatter, tagsAus, wikilinksAus, titelAus, sicher, gruppenAus, gruppeVon, regel, walk, parse, indexiere, notizen, zielKarte, suche, sha1 };
