'use strict';
// Gedaechtnis (C9b, BACKEND §12): der Vault als Graph, eine Notiz mit ihrem
// Ledger-Bezug, Suche ueber Titel, Tags und Text. Nur lesen. Den Index haelt
// vault.indexiere im 30-s-Takt aktuell; Graph und Liste sind gecacht, bis sich
// sein Stand aendert.
const fs = require('node:fs');
const path = require('node:path');
const vault = require('./vault');
const metrics = require('./metrics');
const { getMeta } = require('./db');

const fehler = (status, text) => Object.assign(new Error(text), { status });

// vaultPfad(): absoluter Ordner oder null. gruppenEigen(): config vault.gruppen.
// ausText: cira-Dienst (T1 aus Text), abrechnung(): rechnung.abrechnung(db).
function erzeuge({ db, vaultPfad, gruppenEigen = () => [], ausText = null, abrechnung = () => ({}) }) {
  const stand = () => Number(getMeta(db, 'vault_index_stand') || 0);

  function indexiere({ neu = false } = {}) {
    const v = vaultPfad();
    if (!v) return { neu: 0, geaendert: 0, entfernt: 0, gesamt: 0 };
    if (neu) db.exec('DELETE FROM notiz_index');
    return vault.indexiere(db, v);
  }

  // Alle Notizen, geparst; gilt bis zum naechsten Index-Stand.
  let listeCache = null;
  function liste() {
    const s = stand() + '|' + (getMeta(db, 'vault_index_pfad') || '');
    if (!listeCache || listeCache.s !== s) listeCache = { s, l: vault.notizen(db) };
    return listeCache.l;
  }

  let graphCache = null;
  function graph() {
    const v = vaultPfad();
    if (!v) return { vault: null, knoten: [], kanten: [], gruppen: [], stand: 0 };
    const eigen = gruppenEigen();
    const key = stand() + '|' + v + '|' + JSON.stringify(eigen);
    if (graphCache && graphCache.key === key) return graphCache.wert;
    const l = liste();
    const { gruppen, quelle } = vault.gruppenAus(v, eigen);
    const ziel = vault.zielKarte(l);
    const idx = new Map(l.map((n, i) => [n.pfad, i]));
    const kanten = [], gesehen = new Set(), grad = new Array(l.length).fill(0);
    l.forEach((n, i) => {
      for (const link of n.links) {
        const j = idx.get(ziel(link));
        if (j === undefined || j === i) continue;
        const k = i < j ? i + ',' + j : j + ',' + i;
        if (gesehen.has(k)) continue;
        gesehen.add(k);
        kanten.push([i, j]);
        grad[i]++; grad[j]++;
      }
    });
    const gruppenMap = new Map(gruppen.map((g) => [g.query, { id: g.query, farbe: g.farbe, n: 0 }]));
    const knoten = l.map((n, i) => {
      const g = vault.gruppeVon(n, gruppen);
      if (!gruppenMap.has(g.id)) gruppenMap.set(g.id, { id: g.id, farbe: g.farbe, n: 0 });
      gruppenMap.get(g.id).n++;
      return { id: n.pfad, l: n.titel, g: g.id, grad: grad[i], waise: grad[i] === 0 };
    });
    const wert = {
      vault: path.basename(v), knoten, kanten, stand: stand(), gruppenQuelle: quelle,
      // Regeln in ihrer Reihenfolge, danach Ordner nach Groesse; leere Regeln fallen weg.
      gruppen: [...gruppenMap.values()].filter((g) => g.n > 0)
        .sort((a, b) => (a.id.startsWith('ordner:') - b.id.startsWith('ordner:')) || (a.id.startsWith('ordner:') ? b.n - a.n : 0)),
    };
    graphCache = { key, wert };
    return wert;
  }

  function notiz(rel) {
    const v = vaultPfad();
    if (!v) throw fehler(404, 'Kein Vault eingerichtet.');
    const abs = vault.sicher(v, rel);
    let roh;
    try { roh = fs.readFileSync(abs, 'utf8'); } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EISDIR') throw fehler(404, 'Notiz nicht gefunden.');
      throw fehler(409, 'Notiz nicht lesbar: ' + e.code);
    }
    const p = rel.replace(/\\/g, '/');
    const n = vault.parse(p, roh);
    const l = liste();
    const ziel = vault.zielKarte(l);
    const titel = new Map(l.map((x) => [x.pfad, x.titel]));
    const links = [...new Set(n.links.map(ziel).filter((x) => x && x !== p))].map((x) => ({ pfad: x, titel: titel.get(x) }));
    const rueck = l.filter((x) => x.pfad !== p && x.links.some((k) => ziel(k) === p)).map((x) => ({ pfad: x.pfad, titel: x.titel }));
    const fm = n.frontmatter || {};
    const meta = fm.metadata && typeof fm.metadata === 'object' ? fm.metadata : {};
    const sid = [fm.originSessionId, meta.originSessionId].find((x) => typeof x === 'string' && x.trim()) || null;
    let bezug = sid ? metrics.sitzungsBezug(db, sid.trim()) : null;
    if (bezug) {
      const a = bezug.vorgang ? abrechnung()[bezug.vorgang] : null;
      bezug = { ...bezug, rechnungen: a ? a.nummern : [] };
    }
    return {
      pfad: p, titel: n.titel, frontmatter: fm, tags: n.tags, rumpf: n.rumpf, links, rueck, sitzung: sid, bezug,
      worte: (n.rumpf.match(/[\p{L}\p{N}]+/gu) || []).length,
      obsidian: 'obsidian://open?vault=' + encodeURIComponent(path.basename(v)) + '&file=' + encodeURIComponent(p.replace(/\.md$/i, '')),
    };
  }

  // Treffer ohne Modell; mit antwort=true formuliert T1 aus den drei besten Notizen.
  async function suche(q, { antwort = false, signal = null } = {}) {
    if (!vaultPfad()) return { treffer: [], antwort: null };
    const frage = String(q || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 200);
    const l = liste();
    const treffer = vault.suche(l, frage);
    if (!antwort || !treffer.length || !ausText) return { treffer, antwort: null };
    const nach = new Map(l.map((n) => [n.pfad, n]));
    const text = treffer.slice(0, 3).map((t) => 'NOTIZ ' + t.titel + ' (' + t.pfad + '):\n' + nach.get(t.pfad).rumpf.slice(0, 600)).join('\n\n');
    const r = await ausText({ auftrag: 'Beantworte die Frage in zwei bis drei Sätzen aus den Notizen und nenne die passende Notiz beim Titel. FRAGE: ' + frage, text, rolle: 'schnell', signal });
    return r.fehlt ? { treffer, antwort: null, fehlt: r.fehlt } : { treffer, antwort: { text: r.text, modell: r.modell } };
  }

  function routen(req, res, p, u, mittel) {
    if (!p.startsWith('/api/gedaechtnis/')) return false;
    const { sendJson } = mittel;
    const { fehler: fehlerAntwort, post } = require('./sitzungen').routenHelfer(req, res, p, mittel, 'Gedächtnis');
    if (req.method === 'GET' && p === '/api/gedaechtnis/graph') {
      try { sendJson(res, graph()); } catch (err) { fehlerAntwort(err); }
      return true;
    }
    if (req.method === 'GET' && p === '/api/gedaechtnis/notiz') {
      try { sendJson(res, notiz(u.searchParams.get('pfad') || '')); } catch (err) { fehlerAntwort(err); }
      return true;
    }
    if (req.method === 'GET' && p === '/api/gedaechtnis/suche') {
      // Schliesst der Browser (neue Eingabe), endet auch die lokale Anfrage.
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ac.abort(); });
      suche(u.searchParams.get('q'), { antwort: u.searchParams.get('antwort') === '1', signal: ac.signal }).then((r) => sendJson(res, r), fehlerAntwort);
      return true;
    }
    if (req.method === 'POST' && p === '/api/gedaechtnis/neu-indexieren') {
      post(() => indexiere({ neu: true }));
      return true;
    }
    return false;
  }

  return { indexiere, liste, graph, notiz, suche, routen, stand };
}

module.exports = { erzeuge };
