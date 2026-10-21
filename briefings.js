'use strict';
// Briefings (C9a, BACKEND §11, Entwurf C9 §3): Berichte aus <Vault>/<briefingsOrdner>
// (und reports/) als Posteingang. Kein Frontmatter in den echten Dateien
// (Entwurf §1.2): Datum aus dem Namen oder dem H1, Quelle aus Namensregeln.
// Geschrieben wird nur das To-do-Rueckschreiben (eine Zeile, byte-genau) und
// der Monatsbericht ueber die Freigabe „monatsbericht“ (E3, E13).
const fs = require('node:fs');
const path = require('node:path');
const vault = require('./vault');
const board = require('./board');
const freigaben = require('./freigaben');
const metrics = require('./metrics');
const { getMeta, setMeta } = require('./db');

const fehler = (status, text) => Object.assign(new Error(text), { status });
const TODO_RE = /^- \[([ xX])\] (.*)$/;
// Ohne eigene Regeln (config vault.quellen): diese, in dieser Reihenfolge (E9).
const QUELLEN_STANDARD = [
  { muster: 'reports/*-c2invoice', name: 'c2invoice', farbe: '#f97316' },
  { muster: 'vault-health-JJJJ-MM-TT', name: 'Vault', farbe: '#52e0b1' },
  { muster: 'JJJJ-MM-TT', name: 'Posteingang', farbe: null },
];
// E8: Vault-Health-To-dos hakt nur der Skill vault-health-abarbeiten ab — mit der Aenderung dazu.
const geschuetzt = (rel) => /(^|\/)vault-health-[^/]*$/i.test(rel);
const pad = (n) => String(n).padStart(2, '0');
const isoTag = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Datum: JJJJ-MM-TT im Namen, sonst JJJJ-MM im Namen (Monatsbericht: erscheint am 1. danach), sonst im H1.
function datumAus(name, h1) {
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(name);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /(?:^|\D)(\d{4})-(\d{2})(?!\d)/.exec(name);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return isoTag(new Date(Number(m[1]), Number(m[2]), 1));
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(h1 || '');
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(h1 || '');
  if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
  return null;
}

function quelleVon(rel, regeln) {
  const ohne = rel.replace(/\.md$/i, '');
  for (const r of regeln) {
    let re;
    try { re = vault.regel(r.muster); } catch { continue; }
    if (re.test(ohne)) return { name: r.name, farbe: r.farbe || null };
  }
  const name = ohne.split('/').pop();
  const praefix = name.replace(/[-_ ]*\d{4}-\d{2}(-\d{2})?.*$/, '');
  return { name: praefix || name, farbe: null };
}

function todosAus(text) {
  const { zeilen } = board.zerlege(text);
  const aus = [];
  zeilen.forEach((roh, zeile) => {
    const m = TODO_RE.exec(roh);
    if (m) aus.push({ zeile, roh, text: m[2].trim(), erledigt: m[1] !== ' ' });
  });
  return aus;
}

// vaultPfad(): absoluter Ordner oder null; ordnerName(): config vault.briefingsOrdner;
// quellenEigen(): config vault.quellen; ausText: cira-Dienst; bereiche(): Arbeitsbereiche (Kuerzel im Monatsbericht).
function erzeuge({ db, vaultPfad, ordnerName = () => 'Briefings', quellenEigen = () => [], ausText = null, bereiche = () => [], jetzt = () => new Date() }) {
  const ordner = () => {
    const o = String(ordnerName() || '').trim();
    return /^[^\\/:*?"<>|\u0000-\u001f.][^\\/:*?"<>|\u0000-\u001f]{0,79}$/.test(o) ? o : 'Briefings';
  };
  // Von Hand eingetragene Regeln gelten nur in der Form, die auch die Oberflaeche annimmt.
  const regeln = () => {
    const e = (Array.isArray(quellenEigen()) ? quellenEigen() : []).filter((r) => r && typeof r.muster === 'string' && typeof r.name === 'string' && r.name.trim() && r.name.length <= 40 && (!r.farbe || /^#[0-9a-fA-F]{6}$/.test(r.farbe)));
    return e.length ? e : QUELLEN_STANDARD;
  };

  // ponytail: Cache je Datei nach Groesse+mtime, jede Liste stat-t alle Dateien (71 echte); Ordner-Watcher erst, wenn das spuerbar wird.
  const cache = new Map();
  function dateien(v) {
    const basis = path.join(v, ordner());
    const aus = [];
    const lese = (abs, rel) => {
      let e;
      try { e = fs.readdirSync(abs, { withFileTypes: true }); } catch (err) { if (err.code === 'ENOENT') return false; throw err; }
      for (const x of e) {
        if (x.name.startsWith('.') || x.isSymbolicLink()) continue;
        if (x.isFile() && /\.md$/i.test(x.name)) aus.push(rel ? rel + '/' + x.name : x.name);
        else if (x.isDirectory() && !rel && x.name === 'reports') lese(path.join(abs, x.name), 'reports');
      }
      return true;
    };
    return lese(basis, '') ? aus : null;
  }
  function eintrag(v, rel) {
    const abs = path.join(v, ordner(), ...rel.split('/'));
    let st;
    try { st = fs.statSync(abs); } catch { return null; }
    const c = cache.get(rel);
    if (c && c.groesse === st.size && c.mtime === st.mtimeMs) return c.e;
    let roh;
    try { roh = fs.readFileSync(abs); } catch { return null; }
    const text = roh.toString('utf8');
    const h1 = (/^#\s+(.+)$/m.exec(vault.normal(text)) || [])[1] || '';
    const name = rel.split('/').pop().replace(/\.md$/i, '');
    const e = {
      pfad: ordner() + '/' + rel, name, titel: (h1 || name).trim().slice(0, 200), datum: datumAus(name, h1),
      quelle: quelleVon(rel, regeln()), schutz: geschuetzt(rel),
      offen: todosAus(text).filter((t) => !t.erledigt).length, hash: vault.sha1(roh), mtime: new Date(st.mtimeMs).toISOString(),
    };
    cache.set(rel, { groesse: st.size, mtime: st.mtimeMs, e });
    return e;
  }

  function liste() {
    const v = vaultPfad();
    if (!v) return { vault: null, ordner: ordner(), briefings: [] };
    const namen = dateien(v);
    if (!namen) return { vault: path.basename(v), ordner: ordner(), briefings: [], fehlt: true };
    for (const k of cache.keys()) if (!namen.includes(k)) cache.delete(k);
    const alle = namen.map((rel) => eintrag(v, rel)).filter(Boolean);
    // Startstand (E2): beim ersten Mal gilt alles Vorhandene als gelesen.
    if (getMeta(db, 'briefings_startstand') === null) {
      const z = new Date().toISOString();
      const ein = db.prepare('INSERT OR IGNORE INTO briefing_gelesen (pfad, hash, gelesen_am) VALUES (?,?,?)');
      db.exec('BEGIN');
      try { for (const e of alle) ein.run(e.pfad, e.hash, z); setMeta(db, 'briefings_startstand', z); db.exec('COMMIT'); } catch (err) { db.exec('ROLLBACK'); throw err; }
    }
    const gelesen = new Map(db.prepare('SELECT pfad, hash FROM briefing_gelesen').all().map((r) => [r.pfad, r.hash]));
    const briefings = alle.map((e) => ({ ...e, gelesen: gelesen.get(e.pfad) === e.hash }))
      .sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || b.mtime.localeCompare(a.mtime));
    return { vault: path.basename(v), ordner: ordner(), briefings };
  }
  const ungelesen = () => { try { return liste().briefings.filter((b) => !b.gelesen).length; } catch (err) { console.error('Briefings zaehlen:', err.message); return null; } };

  // Pfad aus der Anfrage: im Vault, im Briefings-Ordner, hoechstens reports/ darunter.
  function datei(pfad) {
    const v = vaultPfad();
    if (!v) throw fehler(404, 'Kein Vault eingerichtet.');
    const abs = vault.sicher(v, pfad);
    const rel = String(pfad).replace(/\\/g, '/');
    const teile = rel.split('/');
    if (teile[0] !== ordner() || teile.length > 3 || (teile.length === 3 && teile[1] !== 'reports')) throw fehler(400, 'Kein Briefing.');
    return { v, abs, rel: teile.slice(1).join('/') };
  }
  function lies(pfad) {
    const { v, abs, rel } = datei(pfad);
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch (e) { if (e.code === 'ENOENT') throw fehler(404, 'Briefing nicht gefunden.'); throw fehler(409, 'Briefing nicht lesbar: ' + e.code); }
    const e = eintrag(v, rel);
    if (!e) throw fehler(404, 'Briefing nicht gefunden.');
    const g = db.prepare('SELECT hash FROM briefing_gelesen WHERE pfad = ?').get(e.pfad);
    return { ...e, gelesen: !!g && g.hash === e.hash, text, todos: todosAus(text) };
  }

  function gelesen({ pfad, hash } = {}) {
    const { v, rel } = datei(pfad);
    if (typeof hash !== 'string' || !/^[0-9a-f]{40}$/.test(hash)) throw fehler(400, 'Hash fehlt.');
    if (!eintrag(v, rel)) throw fehler(404, 'Briefing nicht gefunden.');
    db.prepare('INSERT INTO briefing_gelesen (pfad, hash, gelesen_am) VALUES (?,?,?) ON CONFLICT(pfad) DO UPDATE SET hash = excluded.hash, gelesen_am = excluded.gelesen_am')
      .run(ordner() + '/' + rel, hash, new Date().toISOString());
    return { gelesen: true };
  }

  function todo({ pfad, zeile, roh, erledigt } = {}) {
    const { v, abs, rel } = datei(pfad);
    if (geschuetzt(rel)) throw fehler(409, 'Vault-Health-To-dos hakt der Skill vault-health-abarbeiten ab, zusammen mit der Änderung dazu.');
    if (!Number.isInteger(zeile) || zeile < 0 || typeof roh !== 'string' || !TODO_RE.test(roh) || typeof erledigt !== 'boolean') throw fehler(400, 'To-do: zeile, roh und erledigt erwartet.');
    const vorher = eintrag(v, rel);
    const neuZeile = roh.replace(/^- \[[ xX]\]/, erledigt ? '- [x]' : '- [ ]');
    try {
      board.schreibeAtomar(abs, (text) => board.ersetzeZeile(text, { zeile, roh }, () => neuZeile));
    } catch (e) { if (e.code === 'ENOENT') throw fehler(404, 'Briefing nicht gefunden.'); throw e; }
    const nachher = eintrag(v, rel);
    // Selbst geaendert: war es gelesen, bleibt es gelesen.
    if (vorher && nachher && db.prepare('SELECT 1 FROM briefing_gelesen WHERE pfad = ? AND hash = ?').get(vorher.pfad, vorher.hash)) {
      db.prepare('UPDATE briefing_gelesen SET hash = ? WHERE pfad = ?').run(nachher.hash, nachher.pfad);
    }
    freigaben.protokoll(db, { quelle: 'briefings', art: 'briefing_todo', objekt: ordner() + '/' + rel + ':' + (zeile + 1), vorher: { zeile: roh }, nachher: { zeile: neuZeile } });
    return { todo: { zeile, roh: neuZeile, erledigt }, hash: nachher ? nachher.hash : null };
  }

  // Kurzfassung (E10): auf Klick, gecacht je Datei-Hash.
  async function kurz({ pfad } = {}, signal = null) {
    const b = lies(pfad);
    const c = db.prepare('SELECT text, modell, tokens FROM briefing_kurz WHERE hash = ?').get(b.hash);
    if (c) return { ...c, cache: true };
    if (!ausText) return { fehlt: 'Kein lokales Modell eingestellt (Einstellungen → Cira).' };
    const r = await ausText({ auftrag: 'Fasse dieses Briefing in drei bis fünf Sätzen zusammen: was wichtig ist und was zu tun ist.', text: b.text, rolle: 'text', signal });
    if (r.fehlt) return { fehlt: r.fehlt };
    db.prepare('INSERT OR REPLACE INTO briefing_kurz (hash, text, modell, tokens, zeit) VALUES (?,?,?,?,?)').run(b.hash, r.text, r.modell || null, r.tokens || 0, new Date().toISOString());
    return { text: r.text, modell: r.modell || null, tokens: r.tokens || 0, cache: false };
  }

  // Fakten fuer „Im Gespraech nachfragen“ (cira kontextQuellen.briefing).
  function kontextFakten(pfad) {
    const b = lies(pfad);
    const f = [{ k: 'Briefing', t: b.titel }, { k: 'Briefing Datum', t: b.datum || 'ohne Datum' }, { k: 'Briefing Quelle', t: b.quelle.name }];
    for (const z of vault.normal(b.text).split('\n')) {
      const t = z.replace(/^#+\s*|^\s*[-*]\s+(\[[ xX]\]\s+)?/, '').replace(/\*\*/g, '').trim();
      if (t && /^(#|\s*[-*] )/.test(z) && f.length < 25) f.push({ k: /^#/.test(z) ? 'Abschnitt' : 'Punkt', t });
    }
    return f;
  }

  /* ---------- Monatsbericht (E3, E13) ---------- */
  const nf = (s) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: s, maximumFractionDigits: s });
  const eur = (v) => nf(2).format(v) + ' EUR';
  function monatsText(monat) {
    const zeit = require('./zeit');
    const rechnung = require('./rechnung');
    const [y, m] = monat.split('-').map(Number);
    const von = monat + '-01', bis = isoTag(new Date(y, m, 0));
    const o = { from: von, to: bis };
    const k = metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
    const rs = metrics.rechnungsSummen(rechnung.liste(db), { von, bis });
    // Nur Kuerzel der Arbeitsbereiche nach aussen (E13); nicht zugeordnete Projekte als Summe.
    const kuerzel = new Map(bereiche().filter((a) => a.projekt && a.kuerzel).map((a) => [a.projekt, a.kuerzel]));
    const je = new Map();
    for (const p of metrics.byProject(db, o)) {
      if (!(p.cost_usd > 0)) continue;
      const n = kuerzel.get(p.project) || 'Übrige Projekte';
      je.set(n, (je.get(n) || 0) + p.cost_usd);
    }
    const proj = [...je.entries()].sort((a, b) => b[1] - a[1]);
    if (!(k.aktive_stunden + k.manuell_stunden > 0) && !rs.gestellt.n && !proj.length) return null;
    return [
      '# c2invoice — Monatsbericht ' + MONATE[m - 1] + ' ' + y, '',
      'Erzeugt von c2invoice am ' + isoTag(jetzt()) + '. Nur Summen, keine Rechnungsnummern und keine Empfänger.', '',
      '## Arbeit', '',
      '- Stunden (Claude-Arbeit und manuell): ' + nf(1).format(k.aktive_stunden + k.manuell_stunden) + ' h',
      '- Arbeitswert (eigene Zeit zum Stundensatz): ' + eur(k.wert.arbeitswert), '',
      '## Rechnungen', '',
      '- Gestellt im ' + MONATE[m - 1] + ': ' + rs.gestellt.n + ', zusammen ' + eur(rs.gestellt.brutto) + ' brutto',
      '- Offen (Stand ' + isoTag(jetzt()) + '): ' + rs.offen.n + ', zusammen ' + eur(rs.offen.rest),
      '- Davon überfällig: ' + rs.ueberfaellig.n + ', zusammen ' + eur(rs.ueberfaellig.rest), '',
      '## API-Gegenwert je Projekt', '',
      ...(proj.length ? proj.map(([n, usd]) => '- ' + n + ': ' + nf(2).format(usd) + ' USD') : ['- kein Verbrauch erfasst']), '',
    ].join('\n');
  }
  // Ab dem 1. eines Monats 07:00 genau eine Freigabe fuer den Vormonat; nachgeholt, wenn der Server spaeter laeuft.
  function takt(h = jetzt()) {
    const v = vaultPfad();
    if (!v) return null;
    if (h < new Date(h.getFullYear(), h.getMonth(), 1, 7, 0, 0)) return null;
    const vm = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    const monat = vm.getFullYear() + '-' + pad(vm.getMonth() + 1);
    if (db.prepare("SELECT 1 FROM freigabe WHERE art = 'monatsbericht' AND bezug = ?").get(monat)) return null;
    const pfad = ordner() + '/reports/' + monat + '-c2invoice.md';
    if (fs.existsSync(path.join(v, ...pfad.split('/')))) return null;
    const text = monatsText(monat);
    if (text === null) return null;   // Monat ohne Arbeit (frische Installation): kein leerer Bericht
    return freigaben.anlegen(db, {
      art: 'monatsbericht', bezug: monat, quelle: 'cira',
      titel: 'Monatsbericht ' + MONATE[vm.getMonth()] + ' ' + vm.getFullYear() + ' in den Vault',
      text: 'Speichern legt ' + pfad + ' an. Nur Summen und Projekt-Kürzel, keine Rechnungsnummern oder Empfänger. Der Vault wird mit Obsidian-Git geteilt.',
      nutzlast: { monat, pfad, text },
    });
  }
  freigaben.registriere('monatsbericht', (dbx, n) => {
    const v = vaultPfad();
    if (!v) throw fehler(409, 'Kein Vault eingerichtet.');
    if (!n || typeof n.text !== 'string' || typeof n.pfad !== 'string' || !/^\d{4}-\d{2}$/.test(n.monat || '')) throw fehler(400, 'Monatsbericht unvollständig.');
    if (n.pfad !== ordner() + '/reports/' + n.monat + '-c2invoice.md') throw fehler(409, 'Pfad passt nicht zum Briefings-Ordner.');
    const abs = vault.sicher(v, n.pfad);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = abs + '.c2i-tmp';
    try {
      fs.writeFileSync(tmp, n.text, { flag: 'wx' });
      if (fs.existsSync(abs)) throw fehler(409, 'Der Bericht liegt schon im Vault (' + n.pfad + ').');
      fs.renameSync(tmp, abs);
    } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
    freigaben.protokoll(dbx, { quelle: 'briefings', art: 'monatsbericht', objekt: n.pfad, vorher: null, nachher: { pfad: n.pfad, zeichen: n.text.length } });
    return { pfad: n.pfad };
  });

  function routen(req, res, p, u, mittel) {
    if (p !== '/api/briefings' && !p.startsWith('/api/briefing/') && p !== '/api/briefing') return false;
    const { sendJson } = mittel;
    const { fehler: fehlerAntwort, post } = require('./sitzungen').routenHelfer(req, res, p, mittel, 'Briefings');
    if (req.method === 'GET' && p === '/api/briefings') { try { sendJson(res, liste()); } catch (err) { fehlerAntwort(err); } return true; }
    if (req.method === 'GET' && p === '/api/briefing') { try { sendJson(res, lies(u.searchParams.get('pfad') || '')); } catch (err) { fehlerAntwort(err); } return true; }
    if (req.method !== 'POST') return false;
    if (p === '/api/briefing/gelesen') { post(gelesen); return true; }
    if (p === '/api/briefing/todo') { post(todo); return true; }
    if (p === '/api/briefing/kurz') {
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ac.abort(); });
      post((d) => kurz(d, ac.signal));
      return true;
    }
    return false;
  }

  return { liste, lies, gelesen, todo, kurz, ungelesen, kontextFakten, monatsText, takt, routen, ordner };
}

module.exports = { erzeuge, datumAus, quelleVon, todosAus, QUELLEN_STANDARD };
