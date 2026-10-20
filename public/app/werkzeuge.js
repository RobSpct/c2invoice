'use strict';
/* Werkzeuge (Masterplan 3.0, C8): Skills, Agents, Commands, Plugins, Mods und
   MCP-Server je Arbeitsbereich. Gerechnet wird hier nichts: Zellen, Kontext,
   Nutzung, Kosten und der Vorschlag kommen fertig aus /api/werkzeuge. Schalten
   schreibt der Server (genau ein Schluessel, Sicherung vorher); die Seite sagt
   nur, wo es nicht geht und warum. */

Object.assign(EN, {
  'Werkzeuge': 'Tools', 'Commands': 'Commands', 'Plugins': 'Plugins', 'Mods': 'Mods', 'MCPs': 'MCPs',
  'Liste': 'List', 'Matrix': 'Matrix', 'Ansicht': 'View', 'Global': 'Global', 'Arbeitsbereich wählen': 'Choose workspace',
  'Kontext messen': 'Measure context', 'gemessen {z}': 'measured {z}', 'noch nicht gemessen': 'not measured yet', 'Kontext gemessen': 'Context measured',
  'Messung fehlgeschlagen': 'Measurement failed', 'aktiv': 'active', 'Werkzeugbetrieb · Kosten 30 T': 'Tool operation · cost 30 d',
  'Hintergrund-Läufe von Plugins und Mods, ohne Zuordnung je Mod.': 'Background runs of plugins and mods, not attributed per mod.',
  'Kontext / Sitzung': 'Context / session', 'Tokens vor dem ersten Prompt, aktive Werkzeuge': 'Tokens before the first prompt, active tools',
  'Cira schlägt vor': 'Cira suggests', 'Später': 'Later', 'In {ws} abschalten': 'Turn off in {ws}',
  '„{n}“ ist in {ws} aktiv, lief in 30 Tagen in {s} Sitzungen und belegt {k} Tokens Kontext. Abschalten spart ≈ {e} in 30 Tagen.':
    '“{n}” is active in {ws}, ran in {s} sessions in 30 days and takes {k} tokens of context. Turning it off saves ≈ {e} in 30 days.',
  'Grundlage: Kontext × Requests × Cache-Lesen + Sitzungen × Cache-Schreiben, Preise des meistgenutzten Modells, letzte 30 Tage.':
    'Basis: context × requests × cache read + sessions × cache write, prices of the most used model, last 30 days.',
  'Aktiv {n}': 'Active {n}', 'Lager {n}': 'Stash {n}', 'Deaktiviert {n}': 'Disabled {n}', 'Alle aufklappen': 'Expand all', 'Alle zuklappen': 'Collapse all',
  'Name': 'Name', 'Herkunft': 'Source', 'Kontext': 'Context', 'Sitzungen 30 T': 'Sessions 30 d', 'Kosten 30 T': 'Cost 30 d', 'Status': 'Status',
  'global': 'global', 'projekt': 'project', 'lager': 'stash', 'claude.ai': 'claude.ai', 'mcpjson': '.mcp.json',
  'lädt bei Bedarf': 'loads on demand', 'voll {k} Tokens, geladen erst bei Bedarf': 'full {k} tokens, loaded only on demand',
  'geschätzt aus der Beschreibung': 'estimated from the description', 'Installieren': 'Install', 'nur Anzeige': 'display only',
  'wirkt über Hooks – Nutzung nicht vollständig messbar': 'works via hooks – usage not fully measurable',
  'Keine {a} in dieser Auswahl.': 'No {a} in this selection.', '{n} in {ws}': '{n} in {ws}',
  'Werkzeug': 'Tool', 'an': 'on', 'aus': 'off', 'erbt': 'inherits', 'erbt von Global': 'inherits from Global',
  'Klick wechselt an → aus → erbt, soweit die Stelle es zulässt.': 'Click cycles on → off → inherits, as far as the place allows.',
  'Schreibt in ~/.claude/settings.json, <Bereich>/.claude/settings.local.json bzw. ~/.claude.json · Sicherung vor jeder Änderung · wirkt ab der nächsten Sitzung · Kosten aus c2invoice':
    'Writes to ~/.claude/settings.json, <workspace>/.claude/settings.local.json or ~/.claude.json · backup before every change · takes effect from the next session · costs from c2invoice',
  'Geschaltet – wirkt ab der nächsten Sitzung.': 'Switched – takes effect from the next session.',
  'Eine laufende Claude-Sitzung hat die Änderung überschrieben – nach Sitzungsende erneut schalten.': 'A running Claude session overwrote the change – switch again after the session ends.',
  'Nicht geschaltet': 'Not switched', 'Installiert – wirkt ab der nächsten Sitzung.': 'Installed – takes effect from the next session.', 'Nicht installiert': 'Not installed',
  '{d} ist nicht lesbar – diese Ebene wird nur angezeigt.': '{d} is not readable – this level is display only.',
  'Keine Claude-Code-Konfiguration gefunden.': 'No Claude Code configuration found.', 'Werkzeuge nicht geladen': 'Tools not loaded',
  'Verwalten → Werkzeuge': 'Manage → Tools', 'Keine Änderung nötig.': 'No change needed.', 'Zustand unbekannt': 'State unknown',
  'Die Einstellungsdatei ist nicht lesbar.': 'The settings file is not readable.', 'Stand nicht aktualisiert': 'Not refreshed',
  'Server aus .mcp.json gibt Claude Code selbst frei (Freigabedialog) – hier nur aus oder erbt.': 'Servers from .mcp.json are approved by Claude Code itself (approval dialog) – only off or inherit here.', 'Kein globales Aus in Claude Code – je Arbeitsbereich schalten.': 'No global off in Claude Code – switch per workspace.', '{w}: {z}': '{w}: {z}',
});

const WK_ARTEN = [['skills', 'Skills'], ['agents', 'Agents'], ['commands', 'Commands'], ['plugins', 'Plugins'], ['mods', 'Mods'], ['mcps', 'MCPs']];
const wkZustand = { daten: null, fehler: null, messFehler: null, lauf: 0, laedt: false, gemessen: new Set() };
const wkWs = () => lies('werkzeuge.ws', 'global');
const wkAnsicht = () => (lies('werkzeuge.ansicht', 'liste') === 'matrix' ? 'matrix' : 'liste');
const wkOffen = () => new Set(liesJson('werkzeuge.offen', ['skills']));
const wkFilter = (art) => (liesJson('werkzeuge.filter', {})[art] || 'aktiv');
const wkTok = (n) => (n >= 1000 ? nf1.format(n / 1000) + 'k' : nf0.format(n));
const wkSpalte = (s) => (s === 'global' ? uebersetze('Global') : s);

// „Später“ blendet einen Vorschlag 30 Tage aus — Bequemlichkeit je Geraet.
const WK_SPAETER = 'werkzeuge.vorschlagAus';
const wkVorschlagKey = (v) => v.art + '|' + v.name + '|' + v.ws;
function wkAusgeblendet(v) {
  try { const m = liesJson(WK_SPAETER, {}); return (m[wkVorschlagKey(v)] || 0) > Date.now(); } catch { return false; }
}

async function wkLaden() {
  const lauf = ++wkZustand.lauf;
  wkZustand.laedt = true;
  try {
    const d = await hole('/api/werkzeuge?' + abfrage({ ws: wkWs() }));
    if (lauf !== wkZustand.lauf) return;
    wkZustand.daten = d; wkZustand.fehler = null; wkZustand.laedt = false;
    // Einmal am Tag messen, aber nur von einem gekoppelten Geraet (sonst oeffnete
    // ein Hintergrundaufruf den Kopplungsdialog).
    if (d.kontext.alt && state.kopplung === true && !wkZustand.gemessen.has(d.ws)) {
      wkZustand.gemessen.add(d.ws);
      sende('/api/werkzeuge/kontext-messen', { ws: d.ws })
        .then(() => { wkZustand.messFehler = null; return wkLaden(); }, (e) => { wkZustand.messFehler = e.message; console.warn('Kontext messen:', e.message); wkZeichnen(document.getElementById('ansicht')); })
        .catch((e) => console.error('Werkzeuge nach Messung:', e));
    }
  } catch (e) {
    if (lauf !== wkZustand.lauf) return;
    wkZustand.laedt = false;
    if (e.status === 404 && wkWs() !== 'global') { merke('werkzeuge.ws', 'global'); return wkLaden(); }
    wkZustand.fehler = e.grund || e.message; console.error('Werkzeuge laden:', e);
  }
  if (route().name === 'werkzeuge') wkZeichnen(document.getElementById('ansicht'));
}

function wkKopf(d) {
  const ws = [['global', 'Global']].concat(d.bereiche.map((b) => [b.name, b.name]));
  const stand = (d.kontext.gemessen_am ? fuelle('gemessen {z}', { z: vor(d.kontext.gemessen_am) }) : uebersetze('noch nicht gemessen')) +
    (wkZustand.messFehler ? ' · ' + uebersetze('Messung fehlgeschlagen') + ': ' + wkZustand.messFehler : '');
  return '<div class="wk-kopf">' +
    segment('wk-ws', ws, d.ws, 'Arbeitsbereich wählen') +
    (d.pfad ? '<span class="wk-pfad mono" title="' + esc(d.pfad) + '">' + esc(d.pfad) + '</span>' : '') +
    '<span class="wk-rechts"><span class="hinweis">' + esc(stand) + '</span>' +
      '<button type="button" class="knopf klein" data-aktion="wk-messen"' + (d.pfad ? '' : ' disabled') + '>' + esc(uebersetze('Kontext messen')) + '</button>' +
      segment('wk-ansicht', [['liste', 'Liste'], ['matrix', 'Matrix']], wkAnsicht(), 'Ansicht') +
    '</span></div>';
}

function wkKacheln(d) {
  const k = WK_ARTEN.map(([a, l]) => '<button type="button" class="karte wk-kachel" data-aktion="wk-art" data-wert="' + a + '">' +
    '<span class="hinweis">' + esc(uebersetze(l)) + '</span><span class="kpi-wert">' + nf0.format(d.kacheln[a] || 0) + '</span>' +
    '<span class="hinweis">' + esc(uebersetze('aktiv')) + '</span></button>').join('');
  return '<div class="wk-kacheln">' + k +
    '<div class="karte wk-kachel"><span class="hinweis">' + esc(uebersetze('Werkzeugbetrieb · Kosten 30 T')) + ' ' + infoI('wk-betrieb') + '</span>' +
      '<span class="kpi-wert wk-geld">' + esc(eur(d.werkzeugbetrieb_eur_30t)) + '</span>' + infoText('wk-betrieb', 'Hintergrund-Läufe von Plugins und Mods, ohne Zuordnung je Mod.') + '</div>' +
    '<div class="karte wk-kachel"><span class="hinweis">' + esc(uebersetze('Kontext / Sitzung')) + '</span>' +
      '<span class="kpi-wert">' + (d.kontext_summe.geschaetzt ? '≈ ' : '') + esc(wkTok(d.kontext_summe.tokens)) + '</span>' +
      '<span class="hinweis">' + esc(uebersetze('Tokens vor dem ersten Prompt, aktive Werkzeuge')) + '</span></div>' +
  '</div>';
}

function wkBanner(d) {
  const v = d.vorschlag;
  if (!v || wkAusgeblendet(v)) return '';
  const wert = esc(JSON.stringify({ art: v.art, name: v.name, wert: 'aus' }));
  return '<div class="wk-banner" role="region" aria-label="' + esc(uebersetze('Cira schlägt vor')) + '">' +
    '<div class="wk-banner-text"><span class="wk-banner-titel">' + esc(uebersetze('Cira schlägt vor')) + ' ' + infoI('wk-grundlage') + '</span>' +
      '<span>' + esc(fuelle('„{n}“ ist in {ws} aktiv, lief in 30 Tagen in {s} Sitzungen und belegt {k} Tokens Kontext. Abschalten spart ≈ {e} in 30 Tagen.',
        { n: v.name, ws: wkSpalte(v.ws), s: nf0.format(v.sitzungen), k: wkTok(v.tokens), e: eur(v.ersparnis_eur) })) + '</span>' +
      infoText('wk-grundlage', 'Grundlage: Kontext × Requests × Cache-Lesen + Sitzungen × Cache-Schreiben, Preise des meistgenutzten Modells, letzte 30 Tage.') + '</div>' +
    '<button type="button" class="knopf primaer klein" data-aktion="wk-schalte" data-wert="' + wert + '">' + esc(fuelle('In {ws} abschalten', { ws: wkSpalte(v.ws) })) + '</button>' +
    '<button type="button" class="knopf klein" data-aktion="wk-spaeter" data-wert="' + esc(wkVorschlagKey(v)) + '">' + esc(uebersetze('Später')) + '</button>' +
  '</div>';
}

// Einordnung einer Zeile fuer den gewaehlten Arbeitsbereich.
function wkKlasse(e, ws) {
  if (e.herkunft === 'lager') return 'lager';
  if (e.zellen[ws] === '—') return null;
  // Zustand unbekannt (Datei nicht lesbar): bei Aktiv, mit Hinweis statt Schalter.
  return e.wirksam[ws] === false ? 'aus' : 'aktiv';
}

function wkKontext(e, ws) {
  const k = e.kontext[ws];
  if (!k || k.tokens == null) return '<span class="hinweis">—</span>';
  if (k.deferred) return '<span class="hinweis" title="' + esc(fuelle('voll {k} Tokens, geladen erst bei Bedarf', { k: wkTok(k.voll) })) + '">' + esc(uebersetze('lädt bei Bedarf')) + '</span>';
  return k.geschaetzt ? '<span title="' + esc(uebersetze('geschätzt aus der Beschreibung')) + '">≈ ' + esc(wkTok(k.tokens)) + '</span>' : esc(wkTok(k.tokens));
}

function wkStatus(e, ws) {
  if (e.herkunft === 'lager') {
    return (e.installierbarIn || []).includes(ws)
      ? '<button type="button" class="knopf klein" data-aktion="wk-installiere" data-wert="' + esc(e.name) + '">' + esc(uebersetze('Installieren')) + '</button>'
      : '<span class="hinweis">—</span>';
  }
  // Ziel aus den erlaubten Werten des Servers; fehlt es, steht der Grund da.
  const an = e.wirksam[ws] === true;
  const erlaubt = e.erlaubt[ws] || [];
  const ziel = an ? (erlaubt.includes('aus') ? 'aus' : null) : (erlaubt.includes('an') ? 'an' : null);
  if (!e.schaltbar || !ziel) {
    const grund = e.zellen[ws] === '?' ? 'Die Einstellungsdatei ist nicht lesbar.'
      : e.grund || (ws === 'global' && e.art === 'mcps' ? 'Kein globales Aus in Claude Code – je Arbeitsbereich schalten.'
        : e.herkunft === 'mcpjson' ? 'Server aus .mcp.json gibt Claude Code selbst frei (Freigabedialog) – hier nur aus oder erbt.' : 'nur Anzeige');
    return '<span class="wk-grund" title="' + esc(uebersetze(grund)) + '">' + esc(uebersetze(e.zellen[ws] === '?' ? 'Zustand unbekannt' : 'nur Anzeige')) + '</span>';
  }
  const wert = esc(JSON.stringify({ art: e.art, name: e.name, wert: ziel }));
  return '<button type="button" class="kippschalter" role="switch" data-aktion="wk-schalte" data-wert="' + wert + '" aria-checked="' + an + '"' +
    ' aria-label="' + esc(fuelle('{n} in {ws}', { n: e.name, ws: wkSpalte(ws) })) + '"><span class="spur"></span></button>';
}

function wkListe(d) {
  const offen = wkOffen();
  const karten = WK_ARTEN.map(([art, l]) => {
    const zeilen = d.arten[art].map((e) => ({ e, k: wkKlasse(e, d.ws) })).filter((x) => x.k);
    const n = (k) => zeilen.filter((x) => x.k === k).length;
    const filter = wkFilter(art);
    const auf = offen.has(art);
    const pillen = [['aktiv', 'Aktiv {n}'], ['lager', 'Lager {n}'], ['aus', 'Deaktiviert {n}']].map(([k, t]) =>
      '<button type="button" class="pille' + (filter === k ? ' an' : '') + '" data-aktion="wk-filter" data-wert="' + art + '|' + k + '" aria-pressed="' + (filter === k) + '">' + esc(fuelle(t, { n: n(k) })) + '</button>').join('');
    const sichtbar = zeilen.filter((x) => x.k === filter).map((x) => x.e);
    const tabelle = !auf ? '' : sichtbar.length ? '<div class="tabelle-huelle"><table class="tabelle wk-tabelle"><thead><tr>' +
        '<th>' + esc(uebersetze('Name')) + '</th><th>' + esc(uebersetze('Herkunft')) + '</th><th class="z">' + esc(uebersetze('Kontext')) + '</th>' +
        '<th class="z">' + esc(uebersetze('Sitzungen 30 T')) + '</th><th class="z">' + esc(uebersetze('Kosten 30 T')) + '</th><th>' + esc(uebersetze('Status')) + '</th></tr></thead><tbody>' +
      sichtbar.map((e) => {
        const s = e.sitzungen30;
        const selten = e.selten === true;
        return '<tr><td><span class="mono">' + esc(e.name) + '</span>' + (e.beschreibung ? '<br><span class="hinweis">' + esc(e.beschreibung.slice(0, 140)) + '</span>' : '') + '</td>' +
          '<td><span class="wk-herkunft ' + esc(e.herkunft.replace('.', '')) + '">' + esc(uebersetze(e.herkunft)) + '</span></td>' +
          '<td class="z">' + wkKontext(e, d.ws) + '</td>' +
          '<td class="z' + (selten ? ' wk-selten' : '') + '"' + (e.hooks ? ' title="' + esc(uebersetze('wirkt über Hooks – Nutzung nicht vollständig messbar')) + '"' : '') + '>' +
            (s == null ? '—' : (e.hooks ? '≥ ' : '') + nf0.format(s)) + '</td>' +
          '<td class="z">' + (e.kosten30_eur == null ? '—' : esc(eur(e.kosten30_eur))) + '</td>' +
          '<td>' + wkStatus(e, d.ws) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<p class="hinweis wk-leer">' + esc(fuelle('Keine {a} in dieser Auswahl.', { a: uebersetze(l) })) + '</p>';
    return '<section class="karte wk-art">' +
      '<div class="wk-art-kopf"><button type="button" class="wk-auf" data-aktion="wk-art" data-wert="' + art + '" aria-expanded="' + auf + '">' +
        '<span aria-hidden="true">' + (auf ? '▾' : '▸') + '</span> ' + esc(uebersetze(l)) + '</button>' +
        '<span class="wk-pillen" role="group">' + pillen + '</span></div>' + tabelle + '</section>';
  }).join('');
  const alleAuf = WK_ARTEN.every(([a]) => offen.has(a));
  return '<div class="wk-alle"><button type="button" class="knopf klein" data-aktion="wk-alle">' + esc(uebersetze(alleAuf ? 'Alle zuklappen' : 'Alle aufklappen')) + '</button></div>' + karten;
}

function wkMatrix(d) {
  const zeilen = WK_ARTEN.flatMap(([art, l]) => d.arten[art].filter((e) => e.schaltbar).map((e) => ({ e, l })));
  const kopf = '<tr><th>' + esc(uebersetze('Werkzeug')) + '</th><th>' + esc(uebersetze('Art')) + '</th>' + d.spalten.map((s) => '<th class="wk-mz">' + esc(wkSpalte(s)) + '</th>').join('') + '</tr>';
  const zelle = (e, s) => {
    const z = e.zellen[s];
    if (z === '—' || z === '?') return '<td class="wk-mz"><span class="hinweis"' + (z === '?' ? ' title="' + esc(uebersetze('Die Einstellungsdatei ist nicht lesbar.')) + '"' : '') + '>' + z + '</span></td>';
    const bild = z === 'erbt' ? 'erbt' + (e.wirksam[s] ? ' an' : '') : z;
    const label = fuelle('{n} in {ws}', { n: e.name, ws: wkSpalte(s) }) + ': ' + uebersetze(z);
    const naechst = e.naechst[s];
    if (!naechst) return '<td class="wk-mz"><span class="wk-punkt ' + bild + '" role="img" aria-label="' + esc(label) + '" title="' + esc(label) + '"></span></td>';
    const wert = esc(JSON.stringify({ art: e.art, name: e.name, wert: naechst, ws: s }));
    return '<td class="wk-mz"><button type="button" class="wk-punkt ' + bild + '" data-aktion="wk-schalte" data-wert="' + wert + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"></button></td>';
  };
  return '<section class="karte wk-matrix"><div class="tabelle-huelle"><table class="tabelle">' +
    '<thead>' + kopf + '</thead><tbody>' + zeilen.map(({ e, l }) => '<tr><td class="mono">' + esc(e.name) + '</td><td class="hinweis">' + esc(uebersetze(l)) + '</td>' + d.spalten.map((s) => zelle(e, s)).join('') + '</tr>').join('') +
    '</tbody></table></div>' +
    '<div class="wk-legende hinweis"><span><span class="wk-punkt an"></span>' + esc(uebersetze('an')) + '</span><span><span class="wk-punkt aus"></span>' + esc(uebersetze('aus')) + '</span>' +
      '<span><span class="wk-punkt erbt an"></span>' + esc(uebersetze('erbt von Global')) + '</span><span>' + esc(uebersetze('Klick wechselt an → aus → erbt, soweit die Stelle es zulässt.')) + '</span></div>' +
  '</section>';
}

function wkZeichnen(w) {
  if (!w) return;
  const d = wkZustand.daten;
  if (!d) {
    w.innerHTML = wkZustand.fehler ? leer('liste', 'Werkzeuge nicht geladen', wkZustand.fehler) : '<div class="leer" aria-busy="true"><span>' + esc(uebersetze('lädt …')) + '</span></div>';
    return;
  }
  const leerInventar = WK_ARTEN.every(([a]) => !d.arten[a].length);
  w.innerHTML = '<div class="wk">' + wkKopf(d) +
    (wkZustand.fehler ? '<p class="wk-fehler">' + esc(uebersetze('Stand nicht aktualisiert') + ': ' + wkZustand.fehler) + '</p>' : '') +
    d.ebenenFehler.map((f) => '<p class="wk-fehler">' + esc(fuelle('{d} ist nicht lesbar – diese Ebene wird nur angezeigt.', { d: f.datei })) + '</p>').join('') +
    (leerInventar ? leer('liste', 'Keine Claude-Code-Konfiguration gefunden.') :
      wkKacheln(d) + wkBanner(d) + (wkAnsicht() === 'matrix' ? wkMatrix(d) : wkListe(d))) +
    '<p class="hinweis wk-fuss">' + esc(uebersetze('Schreibt in ~/.claude/settings.json, <Bereich>/.claude/settings.local.json bzw. ~/.claude.json · Sicherung vor jeder Änderung · wirkt ab der nächsten Sitzung · Kosten aus c2invoice')) + '</p>' +
  '</div>';
}

aktion('wk-ws', (ws) => { merke('werkzeuge.ws', ws); wkZustand.daten = null; wkZeichnen(document.getElementById('ansicht')); wkLaden(); });
aktion('wk-ansicht', (a) => { merke('werkzeuge.ansicht', a); wkZeichnen(document.getElementById('ansicht')); });
aktion('wk-art', (art) => {
  const o = wkOffen();
  if (o.has(art)) o.delete(art); else o.add(art);
  merke('werkzeuge.offen', JSON.stringify([...o]));
  if (wkAnsicht() === 'matrix') merke('werkzeuge.ansicht', 'liste');
  wkZeichnen(document.getElementById('ansicht'));
});
aktion('wk-alle', () => {
  const alle = WK_ARTEN.every(([a]) => wkOffen().has(a));
  merke('werkzeuge.offen', JSON.stringify(alle ? [] : WK_ARTEN.map(([a]) => a)));
  wkZeichnen(document.getElementById('ansicht'));
});
aktion('wk-filter', (wert) => {
  const [art, k] = wert.split('|');
  merke('werkzeuge.filter', JSON.stringify({ ...liesJson('werkzeuge.filter', {}), [art]: k }));
  wkZeichnen(document.getElementById('ansicht'));
});
aktion('wk-spaeter', (key) => {
  try { merke(WK_SPAETER, JSON.stringify({ ...liesJson(WK_SPAETER, {}), [key]: Date.now() + 30 * 86400000 })); } catch { /* nur Bequemlichkeit */ }
  wkZeichnen(document.getElementById('ansicht'));
});
aktion('wk-messen', (_w, knopf) => mitLauf(knopf, async () => {
  try { await sende('/api/werkzeuge/kontext-messen', { ws: wkWs() }); toast(uebersetze('Kontext gemessen')); } catch (e) { toast(uebersetze('Messung fehlgeschlagen') + ': ' + e.message, 'err'); }
  await wkLaden();
}));
// Schalten: waehrend der Nachpruefung (~/.claude.json, 5 s) bleibt der Schalter gesperrt.
aktion('wk-schalte', (wert, knopf) => mitLauf(knopf, async () => {
  const z = JSON.parse(wert);
  try {
    const r = await sende('/api/werkzeuge/schalte', { ws: z.ws || wkWs(), art: z.art, name: z.name, wert: z.wert });
    if (r.geaendert === false) toast(uebersetze('Keine Änderung nötig.'));
    else if (r.gehalten === false) toast(uebersetze('Eine laufende Claude-Sitzung hat die Änderung überschrieben – nach Sitzungsende erneut schalten.'), 'err');
    else if (r.warnung) toast(r.warnung, 'err');
    else toast(uebersetze('Geschaltet – wirkt ab der nächsten Sitzung.'));
  } catch (e) { toast(uebersetze('Nicht geschaltet') + ': ' + e.message, 'err'); }
  await wkLaden();
}));
aktion('wk-installiere', (name, knopf) => mitLauf(knopf, async () => {
  try { const r = await sende('/api/werkzeuge/installiere', { ws: wkWs(), name }); toast(r.warnung || uebersetze('Installiert – wirkt ab der nächsten Sitzung.'), r.warnung ? 'err' : undefined); } catch (e) { toast(uebersetze('Nicht installiert') + ': ' + e.message, 'err'); }
  await wkLaden();
}));

registriere('werkzeuge', {
  zeichne(w) {
    wkZeichnen(w);
    if (!wkZustand.laedt) wkLaden();
  },
});
