'use strict';
/* Sitzungen (Masterplan 3.0, C5 Engine + C6a Oberflaeche): Claude Code aus
   c2invoice starten, mitlesen, antworten, stoppen; fremde Sitzungen (eigenes
   Terminal) nur lesen. Aufbau nach Mockup (README §6.1): Liste 260 · Terminal
   oder Karten · Abrechnung 300. Gerechnet wird hier nichts: Zahlen kommen aus
   /api/ticket, Rechte-Anfragen sind Freigaben, Aktionen sind Server-Routen. */

Object.assign(EN, {
  'Neue Sitzung': 'New session', 'Arbeitsbereich': 'Workspace', 'Auftrag': 'Task', 'Vorgang (optional)': 'Job (optional)',
  'Agent (optional)': 'Agent (optional)', 'Starten': 'Start', 'Senden': 'Send', 'Stoppen': 'Stop', 'Erlauben': 'Allow',
  'Keine Sitzung': 'No session', 'Starte eine Sitzung oder arbeite im Terminal — fremde Sitzungen erscheinen hier nach dem nächsten Abgleich.':
    'Start a session or work in your terminal — external sessions appear here after the next sync.',
  'Keine Arbeitsbereiche': 'No workspaces', 'Sitzungen starten in einem Arbeitsbereich. Arbeitsbereiche stehen in config.json; einen Vorschlag zeigt Einstellungen → Arbeitsbereiche.':
    'Sessions start in a workspace. Workspaces live in config.json; Settings → Workspaces shows a suggestion.',
  'Zu den Einstellungen': 'Open settings', 'Sitzung gestartet': 'Session started', 'Start fehlgeschlagen': 'Start failed', 'Eingabe fehlgeschlagen': 'Input failed',
  'Sitzung wird beendet': 'Session is stopping', 'Stoppen fehlgeschlagen': 'Stop failed',
  'Entscheidung fehlgeschlagen': 'Decision failed', 'Antwort (bei Rückfragen Pflicht)': 'Answer (required for questions)',
  'Nur lesen — läuft in deinem Terminal': 'Read only — runs in your terminal', 'Terminal': 'Terminal', 'Karten': 'Cards', 'Du': 'You',
  'Tüftelt': 'Tinkering', 'Grübelt': 'Pondering', 'Werkelt': 'Working', 'Sinniert': 'Musing', 'Braut': 'Brewing', 'Köchelt': 'Simmering', 'Knobelt': 'Puzzling', 'Sitzung beenden': 'End session', 'Slash-Befehle': 'Slash commands',
  'gibt es ohne Terminal nicht — „Im Terminal fortsetzen“ öffnet die Sitzung dort.': 'is not available without a terminal — “Continue in terminal” opens the session there.',
  'noch nicht abgeglichen': 'not synced yet', 'Kontext': 'Context',
  'wartet auf dich': 'waiting for you', 'bereit': 'ready', 'läuft': 'running', 'startet': 'starting', 'beendet': 'ended', 'Fehler': 'Error',
  'Nachricht an Claude …': 'Message to Claude …', 'Was soll Claude tun?': 'What should Claude do?', 'nicht erreichbar': 'not reachable',
  'Branch': 'Branch', 'Buchung': 'booking', 'Vormerkung beim Start': 'reservation at start', 'ohne Vorgang': 'no job', 'Transkript gekürzt (Ende der Datei)': 'Transcript truncated (end of file)',
  'Sitzung unbekannt': 'Unknown session', 'Transkript nicht lesbar.': 'Transcript not readable.', 'Keine Transkript-Datei gefunden.': 'No transcript file found.', 'Rechte': 'Permissions', 'Wie in deinen Claude-Settings': 'As in your Claude settings',
  'Immer fragen': 'Always ask', 'Dateiänderungen erlauben': 'Allow file edits', 'Nur planen': 'Plan only',
  'Offen': 'Open', 'Beendet': 'Ended', '+ Sitzung': '+ Session', 'Jede Sitzung bucht automatisch auf den Vorgang aus Branch oder Board-Karte.': 'Every session books automatically onto the job from its branch or board card.',
  'Abrechnung dieser Sitzung': 'Billing for this session', 'Dauer · Sitzung': 'Duration · session', 'Tokens · Sitzung': 'Tokens · session', 'API · Sitzung': 'API · session',
  'Arbeitswert · Vorgang gesamt': 'Work value · whole job', 'Zuordnung über': 'Assigned via', 'ändern': 'change', 'Speichern': 'Save', 'Abbrechen': 'Cancel',
  'Vorgang, leer = ohne': 'Job, empty = none', 'Zuordnung gespeichert': 'Assignment saved', 'Zuordnung fehlgeschlagen': 'Assignment failed',
  'Geladen': 'Loaded', 'Skills': 'skills', 'Agents': 'agents', 'Werkzeuge verwalten →': 'Manage tools →', 'Nur für Sitzungen aus c2invoice bekannt.': 'Only known for sessions started from c2invoice.',
  'Aus dieser Sitzung': 'From this session', 'Zusammenfassung ins Vorgangs-Log': 'Summary into job log', 'lokal': 'local', 'Als Position in Rechnungsentwurf': 'As item in invoice draft', 'direkt': 'direct',
  'Übergabe für nächste Sitzung': 'Handoff for next session', 'Im Terminal fortsetzen': 'Continue in terminal',
  'Zusammenfassung im Vorgangs-Log': 'Summary added to job log', 'Zusammenfassung fehlgeschlagen': 'Summary failed', 'Übergabe beauftragt': 'Handoff requested',
  'Übergabe fehlgeschlagen': 'Handoff failed', 'Terminal geöffnet': 'Terminal opened', 'Terminal nicht geöffnet': 'Terminal not opened',
  'Erst einem Vorgang zuordnen.': 'Assign a job first.', 'Nur in einer laufenden Sitzung aus c2invoice.': 'Only in a running session from c2invoice.',
  'Läuft noch in c2invoice — erst stoppen.': 'Still running in c2invoice — stop it first.', 'Noch nicht im Ledger — nach dem nächsten Abgleich.': 'Not in the ledger yet — after the next sync.',
  'Cira fragen': 'Ask Cira', 'Strg+Leertaste': 'Ctrl+Space', 'Modell': 'Model', 'Rechte-Modus': 'Permission mode', 'Thinking-Effort': 'Thinking effort',
  'Kontext-Fenster': 'Context window', 'Plugins und MCP-Server': 'Plugins and MCP servers', 'Slash-Befehle in der Eingabe': 'Slash commands in the input',
  'Ansicht': 'View', 'weitere': 'more', 'Abrechnung nicht ladbar': 'Billing could not be loaded',
  'Diese Sitzung ist noch nicht abgeglichen; der Vorgang schon.': 'This session is not synced yet; the job is.',
  'Übergabe an Claude beauftragt — geschrieben wird erst nach deiner Freigabe': 'Handoff requested from Claude — written only after your approval', 'Keine Ereignisse.': 'No events.', 'Datei': 'File', 'Lesen': 'Read', 'Frage': 'Question', 'Tool': 'Tool',
});

const szZustand = { liste: null, details: null, freigaben: [], bereiche: null, fehler: null, uhr: null, ticket: null, zuordnen: false };
const SZ_OFFEN = ['startet', 'laeuft', 'bereit', 'wartet'];
const SZ_STATUS = { startet: ['startet', ''], laeuft: ['läuft', 'an'], bereit: ['bereit', 'ok'], wartet: ['wartet auf dich', 'warn'], beendet: ['beendet', ''], fehler: ['Fehler', 'bad'] };
// Art-Marke je Karte (README §6.1): Datei orange · Bash/Lesen grau · MCP blau · Claude gruen.
const SZ_ART = { eingabe: 'Du', edit: 'Datei', bash: 'Bash', mcp: 'MCP', read: 'Lesen', say: 'Claude', skill: 'Skill', werkzeug: 'Tool', frage: 'Frage', rechte: 'Rechte', fehler: 'Fehler' };
// Eigene !-Befehle schreibt Claude Code als <bash-input>/<bash-stdout> in die Eingabe:
// lesbar machen wie im Terminal. aus: 'ein' = Befehl, 'aus' = Ausgabe.
function szEingabe(text) {
  const t = String(text || '');
  const ein = t.match(/<bash-input>([\s\S]*?)<\/bash-input>/);
  if (ein) return { art: 'ein', t: '! ' + ein[1].trim() };
  if (/<bash-(stdout|stderr)>/.test(t)) return { art: 'aus', t: t.replace(/<\/?bash-(stdout|stderr)>/g, '').trim() };
  // Eingefuegter Text: Tags weg, jede Zeile als Zitat ("│ "), Leerzeilen drumherum weg.
  const zitat = t.replace(/\s*<pasted_content[^>]*>\n?([\s\S]*?)\n?<\/pasted_content[^>]*>\s*/g,
    (_, inhalt) => '\n' + inhalt.trim().split('\n').map((z) => '│ ' + z).join('\n') + '\n');
  return { art: 'ein', t: zitat.trim() };
}

const szGewaehlt = () => route().teile[0] || null;
const szAnsicht = () => (lies('sz.ansicht', 'term') === 'karten' ? 'karten' : 'term');
function szPille(s) {
  const [t, k] = SZ_STATUS[s] || [s || '–', ''];
  return '<span class="pille ' + k + '">' + esc(uebersetze(t)) + '</span>';
}
// "mcp__github__get_issue" -> "github · get_issue"
function szMcp(name) { const m = /^mcp__(.+?)__(.+)$/.exec(name || ''); return m ? m[1] + ' · ' + m[2] : name || ''; }
// Titel ohne den vorangestellten Werkzeugnamen ("Read: a.ts" -> "a.ts").
function szZiel(e) {
  const t = e.titel || '';
  const p = (e.meta || '') + ': ';
  return e.meta && t.startsWith(p) ? t.slice(p.length) : t;
}

/* ---------- Arbeitszeile wie in Claude Code (Owner 20.10.) ---------- */
// Solange Claude an einer Eingabe arbeitet: wechselndes Wort, Laufzeit, Tokens.
// Die Zeit tickt im Browser (szZugTakt), die Tokens kommen mit jedem Neuladen.
const SZ_WOERTER = ['Tüftelt', 'Grübelt', 'Werkelt', 'Sinniert', 'Braut', 'Köchelt', 'Knobelt'];
function szDauer(s) { return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s'; }
function szZugText(seit) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(seit)) / 1000));
  return { wort: uebersetze(SZ_WOERTER[Math.floor(s / 4) % SZ_WOERTER.length]), zeit: szDauer(s) };
}
function szZugHtml(d) {
  if (!d || d.status !== 'laeuft' || !d.zug) return '';
  const t = szZugText(d.zug.seit);
  return '<div class="tz-zug" id="sz-zug" role="status" data-seit="' + esc(d.zug.seit) + '"><span class="stern" aria-hidden="true">✻</span> ' +
    '<span class="wort">' + esc(t.wort) + '</span> … <span class="leise">(<span class="zeit">' + esc(t.zeit) + '</span> · ↓ ' + esc(kurz(d.zug.tokens || 0)) + ' ' + esc(uebersetze('Tokens')) + ')</span></div>';
}
// Ein Takt fuer alle: nur Text tauschen, nicht neu zeichnen (Eingabe und Scrollen bleiben).
setInterval(() => {
  const z = typeof document !== 'undefined' && document.getElementById('sz-zug');
  if (!z) return;
  const t = szZugText(z.dataset.seit);
  z.querySelector('.wort').textContent = t.wort;
  z.querySelector('.zeit').textContent = t.zeit;
}, 1000);

/* ---------- Slash-Befehle wie in Claude Code ---------- */
// Liste aus dem, was die Sitzung selbst meldet (init/commands_changed): nur das
// geht ohne Terminal. /exit und /quit faengt c2invoice selbst ab.
function szVorschlaege(text, befehle) {
  const t = String(text || '');
  if (!t.startsWith('/') || !befehle || !befehle.length) return { liste: [], hinweis: null };
  const name = t.slice(1).split(/\s/)[0];
  const eigen = ['exit', 'quit'].filter((n) => !befehle.some((b) => b.name === n)).map((n) => ({ name: n, text: uebersetze('Sitzung beenden') }));
  const alle = befehle.concat(eigen);
  const bekannt = alle.some((b) => b.name === name);
  if (/\s/.test(t)) return { liste: [], hinweis: name && !bekannt ? '/' + name : null };
  const q = name.toLowerCase();
  const vorn = alle.filter((b) => b.name.toLowerCase().startsWith(q));
  const liste = vorn.concat(alle.filter((b) => !vorn.includes(b) && b.name.toLowerCase().includes(q))).slice(0, 8);
  return { liste, hinweis: q && !liste.length ? '/' + name : null };
}

function szVorschlagBinden() {
  const feld = document.getElementById('sz-text');
  const box = document.getElementById('sz-vorschlaege');
  const hin = document.getElementById('sz-befehl-hinweis');
  if (!feld || !box || !hin) return;
  let aktiv = 0;
  let v = { liste: [] };
  const zeige = () => {
    const g = szZustand.details && szZustand.details.geladen;
    v = szVorschlaege(feld.value, (g && g.befehle) || []);
    aktiv = Math.min(aktiv, Math.max(0, v.liste.length - 1));
    box.hidden = !v.liste.length;
    feld.setAttribute('aria-expanded', String(!!v.liste.length));
    box.innerHTML = v.liste.map((b, i) => '<li role="option" id="sz-vb-' + i + '" data-befehl="' + esc(b.name) + '" aria-selected="' + (i === aktiv) + '">' +
      '<span class="mono">/' + esc(b.name) + '</span>' + (b.text ? '<small>' + esc(b.text) + '</small>' : '') + '</li>').join('');
    if (v.liste.length) feld.setAttribute('aria-activedescendant', 'sz-vb-' + aktiv); else feld.removeAttribute('aria-activedescendant');
    hin.textContent = v.hinweis ? v.hinweis + ' ' + uebersetze('gibt es ohne Terminal nicht — „Im Terminal fortsetzen“ öffnet die Sitzung dort.') : '';
  };
  const nimm = (name) => { feld.value = '/' + name + ' '; aktiv = 0; zeige(); feld.focus(); };
  feld.addEventListener('input', () => { aktiv = 0; zeige(); });
  feld.addEventListener('keydown', (e) => {
    if (!v.liste.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); aktiv = (aktiv + (e.key === 'ArrowDown' ? 1 : -1) + v.liste.length) % v.liste.length; zeige(); }
    else if ((e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey) { e.preventDefault(); nimm(v.liste[aktiv].name); }
    else if (e.key === 'Escape') { e.preventDefault(); v = { liste: [] }; box.hidden = true; feld.setAttribute('aria-expanded', 'false'); feld.removeAttribute('aria-activedescendant'); }
  });
  // mousedown statt click: der Fokus bleibt im Feld.
  box.addEventListener('mousedown', (e) => { const li = e.target.closest('[data-befehl]'); if (li) { e.preventDefault(); nimm(li.dataset.befehl); } });
  if (document.activeElement === feld) zeige();
}

/* ---------- Terminal und Karten: zwei Ansichten derselben Ereignisse ---------- */
// Terminal wie Claude Code (Owner 20.10.): Text und Eingaben ganz (e.text, der
// Titel ist auf 200 Zeichen gekuerzt), aufeinanderfolgende Werkzeuge ausser
// Edits als eine aufklappbare Sammelzeile (gruppe), Edits als Update(datei) mit Diff.
function szTerminalZeilen(ev) {
  const aus = [];
  let gruppe = null;
  for (const e of ev || []) {
    const t = e.titel || '';
    const werkzeug = !['eingabe', 'say', 'zug', 'fehler', 'frage', 'rechte', 'edit'].includes(e.art);
    if (!werkzeug) gruppe = null;
    if (e.art === 'eingabe') {
      const x = szEingabe(e.text || t);
      aus.push(x.art === 'aus' ? { ev: e.id, k: 'dim', t: '⎿ ' + x.t, ind: true } : { ev: e.id, k: 'ein', t: '› ' + x.t });
    }
    else if (e.art === 'say') aus.push({ ev: e.id, k: 'text', t: e.text || t, md: true });
    else if (e.art === 'zug') aus.push({ ev: e.id, k: 'dim', t: t + (e.kosten_usd ? ' · ' + usd(e.kosten_usd) : ''), ind: true });
    else if (e.art === 'fehler') aus.push({ ev: e.id, k: 'bad', t: '✗ ' + t });
    else if (e.art === 'frage' || e.art === 'rechte') aus.push({ ev: e.id, k: 'warn', t: '? ' + t });
    else if (e.art === 'edit') {
      aus.push({ ev: e.id, k: 'tool', t: '● ' + (e.meta === 'Write' ? 'Write' : 'Update') + '(' + szZiel(e) + ')' });
      for (const d of e.diff || []) aus.push({ ev: e.id, k: d.z === '+' ? 'plus' : d.z === '-' ? 'minus' : 'dim', t: d.z + ' ' + d.t, ind: true, diff: d.z });
    } else {
      if (!gruppe) { gruppe = { ev: e.id, k: 'gruppe', g: e.id, je: {} }; aus.push(gruppe); }
      gruppe.je[e.art] = (gruppe.je[e.art] || 0) + 1;
      aus.push({ ev: e.id, k: 'tool', g: gruppe.g, t: '● ' + (e.art === 'mcp' ? szMcp(e.meta) + (szZiel(e) !== e.titel ? ' ' + szZiel(e) : '') : t) });
    }
  }
  for (const z of aus) if (z.k === 'gruppe') z.t = Object.entries(z.je).map(([a, n]) => uebersetze(SZ_ART[a] || a) + ' ×' + n).join(' · ');
  return aus;
}

// Markdown fuer Claudes Antworten: erst esc, dann wenige Formen (Code-Block,
// Tabelle, Ueberschrift, **fett**, `code`). HTML aus der Antwort bleibt Text.
function szMd(text) {
  const inl = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const zeilen = String(text).replace(/\r\n/g, '\n').split('\n');
  const istZeile = (z) => /^\s*\|.*\|\s*$/.test(z || '');
  const zellen = (z) => z.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const aus = [];
  for (let i = 0; i < zeilen.length;) {
    const z = zeilen[i];
    if (/^\s*```/.test(z)) {
      const b = [];
      for (i++; i < zeilen.length && !/^\s*```/.test(zeilen[i]); i++) b.push(zeilen[i]);
      i++;
      aus.push('<pre class="tz-code">' + esc(b.join('\n')) + '</pre>');
    } else if (istZeile(z) && /^\s*\|[\s:|-]+\|\s*$/.test(zeilen[i + 1] || '')) {
      const kopf = zellen(z);
      const reihen = [];
      for (i += 2; istZeile(zeilen[i]); i++) reihen.push(zellen(zeilen[i]));
      aus.push('<table class="tz-tab"><thead><tr>' + kopf.map((c) => '<th>' + inl(c) + '</th>').join('') + '</tr></thead><tbody>' +
        reihen.map((r) => '<tr>' + r.map((c) => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
    } else {
      const h = z.match(/^#{1,6}\s+(.*)/);
      aus.push(h ? '<div class="tz-h">' + inl(h[1]) + '</div>' : z.trim() ? '<div>' + inl(z) + '</div>' : '<div class="tz-luft"></div>');
      i++;
    }
  }
  return aus.join('');
}
// wartet: die Sitzung wartet gerade — dann ist die letzte Rueckfrage die offene.
function szKarten(ev, { wartet = false } = {}) {
  const karten = (ev || []).filter((e) => SZ_ART[e.art]).map((e) => ({
    ev: e.id, art: e.art, kind: SZ_ART[e.art], md: e.art === 'say',
    // Wie im Terminal der volle Text (Owner 20.10.), der Titel ist auf 200 Zeichen gekuerzt.
    t: e.art === 'eingabe' ? szEingabe(e.text || e.titel).t : e.art === 'say' ? e.text || e.titel || ''
      : e.art === 'mcp' ? szMcp(e.meta) : ['frage', 'rechte', 'fehler'].includes(e.art) ? e.titel || '' : szZiel(e),
    meta: e.art === 'mcp' && szZiel(e) !== e.titel ? szZiel(e) : e.diff ? '+' + e.diff.filter((d) => d.z === '+').length + ' −' + e.diff.filter((d) => d.z === '-').length : '',
    diff: e.diff || null, wartet: false,
  }));
  if (wartet) {
    const offen = karten.filter((k) => k.art === 'frage' || k.art === 'rechte').pop();
    if (offen) offen.wartet = true;
  }
  return karten;
}

async function szLaden() {
  const id = szGewaehlt();
  // Nur die zuletzt gestartete Abfrage zaehlt: eine spaete Antwort fuer die vorige
  // Sitzung zeigte sonst deren Inhalt unter der neuen Auswahl — und Eingaben gingen dorthin.
  const lauf = szZustand.lauf = (szZustand.lauf || 0) + 1;
  const aktuell = () => lauf === szZustand.lauf && id === szGewaehlt();
  try {
    const [l, b, f, d] = await Promise.all([
      hole('/api/sitzungen'), szZustand.bereiche ? Promise.resolve(szZustand.bereiche) : hole('/api/arbeitsbereiche'),
      hole('/api/freigaben'), id ? hole('/api/sitzung/' + encodeURIComponent(id)).catch((e) => { if (e.message === 'HTTP 404') return { unbekannt: true, id }; throw e; }) : Promise.resolve(null),
    ]);
    if (!aktuell()) return;
    szZustand.liste = l.sitzungen; szZustand.bereiche = b; szZustand.details = d;
    szZustand.freigaben = f.freigaben.filter((x) => x.art === 'sitzung_frage');
    szZustand.fehler = null;
    // Abrechnung: dieselben Zahlen wie die Vorgangsansicht. 404 = noch nicht im Ledger.
    // Scheitert nur sie, bleibt die Sitzung bedienbar und die Karte nennt den Fehler.
    let ticket = null, ticketFehler = null;
    if (d && d.vorgang) {
      try { ticket = await hole('/api/ticket?key=' + encodeURIComponent(d.vorgang)); } catch (e) { if (e.message !== 'HTTP 404') { ticketFehler = e.message; console.error('Sitzungen Abrechnung:', e); } }
      if (!aktuell()) return;
    }
    szZustand.ticket = d && d.vorgang ? { key: d.vorgang, d: ticket, fehler: ticketFehler } : null;
  } catch (e) {
    if (!aktuell()) return;
    szZustand.fehler = e.message; console.error('Sitzungen laden:', e);
  }
  if (route().name === 'sitzungen') szZeichnen(document.getElementById('ansicht'));
}
// SSE kommt in Schueben (ein Zug = viele Ereignisse): einmal je 300 ms nachladen.
function szSpaeter() { clearTimeout(szZustand.uhr); szZustand.uhr = setTimeout(szLaden, 300); }
window.addEventListener('c2-sitzung', () => { if (route().name === 'sitzungen') szSpaeter(); });
window.addEventListener('c2-freigabe', () => { if (route().name === 'sitzungen') szSpaeter(); });

/* ---------- Liste ---------- */
const szBereich = (s) => ((szZustand.bereiche && szZustand.bereiche.arbeitsbereiche) || []).find((a) => a.name === s.arbeitsbereich || (s.projekt && (a.projekt === s.projekt || a.name === s.projekt))) || null;
// Farbe kommt aus config.json: nur ein Hex-Wert wird zum Stil.
const szFarbe = (a) => (a && /^#[0-9a-f]{3,8}$/i.test(a.farbe || '') ? ' style="background:' + a.farbe + '"' : '');

function szKarteHtml(s, id) {
  const a = szBereich(s);
  const punkt = s.status === 'wartet' ? 'wartet' : s.live ? 'live' : 'ruht';
  const kosten = s.kosten_usd != null ? usd(s.kosten_usd) : uebersetze('noch nicht abgeglichen');
  return '<a class="sz-zeile' + (s.id === id ? ' gewaehlt' : '') + '" href="#/sitzungen/' + esc(s.id) + '"' + (s.id === id ? ' aria-current="true"' : '') + '>' +
    '<span class="sz-kopf"><span class="sz-punkt ' + punkt + '" aria-hidden="true"></span>' +
      (s.nr ? '<span class="sz-nr mono">#' + esc(s.nr) + '</span>' : '') +
      '<span class="t">' + esc(s.titel || s.arbeitsbereich || s.projekt || '–') + '</span>' +
      '<span class="nur-sr">' + esc(uebersetze((SZ_STATUS[s.status] || [s.status])[0] || '')) + '</span></span>' +
    '<span class="sz-unter mono">' + (a && a.kuerzel ? '<span class="sz-ws"' + szFarbe(a) + '>' + esc(a.kuerzel) + '</span>' : '') +
      '<span class="v">' + esc(s.vorgang || uebersetze('ohne Vorgang')) + '</span>' +
      '<span class="k' + (s.vorgang ? '' : ' leise') + '">' + esc(kosten) + '</span></span></a>';
}

function szListeHtml() {
  const l = szZustand.liste || [];
  const id = szGewaehlt();
  const offen = l.filter((s) => SZ_OFFEN.includes(s.status) || s.live);
  const zu = l.filter((s) => !offen.includes(s));
  const istZuGewaehlt = zu.some((s) => s.id === id);
  return '<aside class="sz-spalte sz-links" aria-label="' + esc(uebersetze('Sitzungen')) + '">' +
    '<div class="sz-spalte-kopf"><span class="sz-label">' + esc(uebersetze('Offen')) + '</span>' +
      '<a class="knopf klein primaer" href="#/sitzungen">' + esc(uebersetze('+ Sitzung')) + '</a></div>' +
    '<div class="sz-zeilen">' +
      (offen.length ? offen.map((s) => szKarteHtml(s, id)).join('') : '<p class="sz-leer">' + esc(uebersetze(szZustand.liste ? 'Keine Sitzung' : 'Lädt …')) + '</p>') +
      (zu.length ? '<details class="sz-beendet"' + (istZuGewaehlt ? ' open' : '') + '><summary>' + esc(uebersetze('Beendet')) + ' <span class="mono">' + zu.length + '</span></summary>' +
        zu.map((s) => szKarteHtml(s, id)).join('') + '</details>' : '') +
    '</div>' +
    '<p class="sz-fuss">' + esc(uebersetze('Jede Sitzung bucht automatisch auf den Vorgang aus Branch oder Board-Karte.')) + '</p>' +
  '</aside>';
}

/* ---------- Mitte: neue Sitzung oder Terminal/Karten ---------- */
// { arbeitsbereich, vorgang, prompt } vom Board; gestartet wird erst mit dem Klick hier.
let szVorlage = null;
function szNeuHtml() {
  const b = (szZustand.bereiche && szZustand.bereiche.arbeitsbereiche) || [];
  if (!b.length) {
    return '<div class="sz-neu">' + leer('liste', 'Keine Arbeitsbereiche', 'Sitzungen starten in einem Arbeitsbereich. Arbeitsbereiche stehen in config.json; einen Vorschlag zeigt Einstellungen → Arbeitsbereiche.',
      '<a class="knopf klein" href="#/einstellungen">' + esc(uebersetze('Zu den Einstellungen')) + '</a>') + '</div>';
  }
  // Vom Board vorbefuellt („▶ in Claude“): einmal einsetzen, danach haelt das Neuzeichnen die Werte.
  const v = szVorlage || {};
  szVorlage = null;
  return '<div class="sz-neu"><form class="sz-form" id="sz-neu">' +
    '<span class="sz-label">' + esc(uebersetze('Neue Sitzung')) + '</span>' +
    '<label for="sz-ab">' + esc(uebersetze('Arbeitsbereich')) + '</label><select class="eingabe" id="sz-ab" required>' +
      b.map((a) => '<option value="' + esc(a.name) + '"' + (a.erreichbar ? '' : ' disabled') + (a.name === v.arbeitsbereich ? ' selected' : '') + '>' + esc(a.name + (a.erreichbar ? '' : ' — ' + uebersetze('nicht erreichbar'))) + '</option>').join('') + '</select>' +
    '<div class="sz-zwei"><div><label for="sz-vorgang">' + esc(uebersetze('Vorgang (optional)')) + '</label><input class="eingabe mono" id="sz-vorgang" maxlength="40" autocomplete="off" value="' + esc(v.vorgang || '') + '"></div>' +
    '<div><label for="sz-agent">' + esc(uebersetze('Agent (optional)')) + '</label><input class="eingabe mono" id="sz-agent" maxlength="80" autocomplete="off"></div></div>' +
    '<label for="sz-modus">' + esc(uebersetze('Rechte')) + '</label><select class="eingabe" id="sz-modus">' +
      [['', 'Wie in deinen Claude-Settings'], ['manual', 'Immer fragen'], ['acceptEdits', 'Dateiänderungen erlauben'], ['plan', 'Nur planen']].map(([w, l]) => '<option value="' + w + '">' + esc(uebersetze(l)) + '</option>').join('') + '</select>' +
    '<label for="sz-prompt">' + esc(uebersetze('Auftrag')) + '</label><textarea class="eingabe" id="sz-prompt" rows="5" maxlength="20000" required placeholder="' + esc(uebersetze('Was soll Claude tun?')) + '">' + esc(v.prompt || '') + '</textarea>' +
    '<div><button type="submit" class="knopf primaer">' + esc(uebersetze('Starten')) + '</button></div>' +
  '</form></div>';
}

function szPfad(d) {
  const a = d.nurLesen ? null : szBereich(d);
  return (a && a.pfad) || d.cwd || '';
}

function szStatusleiste(d) {
  const g = d.geladen;
  const marken = [
    ['MODEL', d.model ? kurzModell(d.model) : '–', 'Modell', 'hell'],
    ['MODE', d.mode || '–', 'Rechte-Modus', 'akzent'],
    ['EFFORT', d.effort || '–', 'Thinking-Effort', 'hell'],
    ['CONTEXT', d.ctx_pct != null ? prozent(d.ctx_pct) : '–', 'Kontext-Fenster', 'ok'],
    ['PLUGINS', g ? String((g.plugins || []).length + (g.mcp || []).length) : '–', 'Plugins und MCP-Server', 'hell'],
    ['HELP', '/', 'Slash-Befehle in der Eingabe', 'dim'],
  ];
  const ansicht = szAnsicht();
  // Marken und Pfad schrumpfen (abgeschnitten), das Segment bleibt immer ganz sichtbar.
  return '<div class="sz-leiste"><div class="sz-marken">' +
    marken.map(([k, v, tip, c]) => '<span class="sz-marke" title="' + esc(uebersetze(tip)) + '"><span class="k">' + k + '</span><span class="v ' + c + '">' + esc(v) + '</span></span>').join('') +
    '<span class="sz-pfad mono" title="' + esc(szPfad(d)) + '">' + esc(szPfad(d)) + '</span></div>' +
    '<div class="segment klein" role="group" aria-label="' + esc(uebersetze('Ansicht')) + '">' +
      [['term', 'Terminal'], ['karten', 'Karten']].map(([w, l]) => '<button type="button" data-aktion="sz-ansicht" data-wert="' + w + '" aria-pressed="' + (w === ansicht) + '">' + esc(uebersetze(l)) + '</button>').join('') +
    '</div></div>';
}

function szTerminalHtml(d) {
  const z = szTerminalZeilen(d.ereignisse);
  const zeile = (x) => (x.md ? '<div class="tz text md"><span class="tz-punkt" aria-hidden="true">●</span><div>' + szMd(x.t) + '</div></div>'
    : '<div class="tz ' + x.k + (x.ind ? ' ein-r' : '') + '">' + esc(x.t) + '</div>');
  let html = '';
  for (let i = 0; i < z.length; i++) {
    const x = z[i];
    if (x.k !== 'gruppe') { html += zeile(x); continue; }
    let innen = '';
    while (i + 1 < z.length && z[i + 1].g === x.g) innen += zeile(z[++i]);
    html += '<details class="tz-gruppe"><summary class="tz dim">' + esc(x.t) + '</summary>' + innen + '</details>';
  }
  return '<div class="sz-terminal mono" id="sz-log" role="log" aria-live="polite">' +
    (z.length ? html : '<div class="tz dim">' + esc(uebersetze('Keine Ereignisse.')) + '</div>') + szZugHtml(d) +
    (!d.nurLesen && d.live ? '<div class="tz-cursor" aria-hidden="true"><span>›</span><i></i></div>' : '') +
  '</div>';
}

function szKartenHtml(d) {
  const k = szKarten(d.ereignisse, { wartet: d.status === 'wartet' });
  if (!k.length) return '<div class="sz-karten" id="sz-log"><p class="sz-leer">' + esc(uebersetze('Keine Ereignisse.')) + '</p></div>';
  return '<div class="sz-karten" id="sz-log" role="log" aria-live="polite">' + k.map((c) =>
    '<div class="sz-k k-' + c.art + (c.wartet ? ' wartet' : '') + '">' +
      '<div class="sz-k-kopf"><span class="sz-art a-' + c.art + '">' + esc(uebersetze(c.kind)) + '</span>' +
        (c.md ? '<div class="t text sz-k-md">' + szMd(c.t) + '</div>'
          : '<span class="t' + (['eingabe', 'rechte', 'frage', 'fehler'].includes(c.art) ? ' text' : ' mono') + '">' + esc(c.t) + '</span>') +
        (c.wartet ? '<span class="m warte">' + esc(uebersetze('wartet auf dich')) + '</span>' : c.meta ? '<span class="m mono">' + esc(c.meta) + '</span>' : '') + '</div>' +
      (c.diff ? '<div class="sz-k-diff mono">' + c.diff.map((x) => '<span class="' + (x.z === '+' ? 'plus' : x.z === '-' ? 'minus' : 'leise') + '">' + esc(x.z + ' ' + x.t) + '</span>').join('') + '</div>' : '') +
    '</div>').join('') + szZugHtml(d) + '</div>';
}

function szMitteHtml(d) {
  const eigen = !d.nurLesen;
  const offen = szZustand.freigaben.filter((f) => f.bezug === d.id);
  const hinweise = (d.nurLesen ? '<div class="hinweis">' + esc(uebersetze('Nur lesen — läuft in deinem Terminal')) + (d.gekuerzt ? ' · ' + esc(uebersetze('Transkript gekürzt (Ende der Datei)')) : '') + (d.transkript ? ' · ' + esc(uebersetze(d.transkript)) : '') + '</div>' : '') +
    (d.fehler ? '<div class="hinweis sz-fehler">' + esc(d.fehler) + '</div>' : '');
  const fragen = offen.map((f) => '<div class="sz-frage" role="group" aria-label="' + esc(f.titel) + '"><span class="t">' + esc(f.titel) + '</span>' +
    (f.text ? '<pre class="mono">' + esc(f.text) + '</pre>' : '') +
    '<input class="eingabe" id="sz-hinweis-' + f.id + '" maxlength="2000" placeholder="' + esc(uebersetze('Antwort (bei Rückfragen Pflicht)')) + '" aria-label="' + esc(uebersetze('Antwort (bei Rückfragen Pflicht)')) + '">' +
    '<span class="knoepfe"><button type="button" class="knopf klein primaer" data-aktion="sz-erlauben" data-wert="' + f.id + '">' + esc(uebersetze('Erlauben')) + '</button>' +
    '<button type="button" class="knopf klein" data-aktion="sz-ablehnen" data-wert="' + f.id + '">' + esc(uebersetze('Ablehnen')) + '</button></span></div>').join('');
  const eingabe = eigen && d.live ? '<form class="sz-eingabe" id="sz-eingabe" data-id="' + esc(d.id) + '"><span class="prompt mono" aria-hidden="true">›</span>' +
    '<ul class="sz-vorschlaege" id="sz-vorschlaege" role="listbox" aria-label="' + esc(uebersetze('Slash-Befehle')) + '" hidden></ul>' +
    '<textarea class="eingabe mono" id="sz-text" rows="1" maxlength="20000" role="combobox" aria-autocomplete="list" aria-controls="sz-vorschlaege" aria-expanded="false" aria-label="' + esc(uebersetze('Nachricht an Claude …')) + '" placeholder="' + esc(uebersetze('Nachricht an Claude …')) + '"></textarea>' +
    '<button type="submit" class="knopf klein primaer">' + esc(uebersetze('Senden')) + '</button>' +
    '<button type="button" class="knopf klein" data-aktion="sz-stopp" data-wert="' + esc(d.id) + '">' + esc(uebersetze('Stoppen')) + '</button></form>' +
    '<p class="sz-befehl-hinweis" id="sz-befehl-hinweis" role="status"></p>' : '';
  return '<section class="sz-mitte" aria-label="' + esc(d.titel || d.arbeitsbereich || d.projekt || d.id) + '">' + szStatusleiste(d) +
    (hinweise || fragen ? '<div class="sz-oben">' + hinweise + fragen + '</div>' : '') +
    (szAnsicht() === 'karten' ? szKartenHtml(d) : szTerminalHtml(d)) + eingabe +
    '<div class="sz-cira"><cira-orb class="orb-mini" scale="1.2" mode="' + esc(typeof cira !== 'undefined' ? cira.modus : '') + '" state="session" aria-hidden="true"></cira-orb>' +
      '<button type="button" class="knopf klein geist" data-aktion="sz-cira">' + esc(uebersetze('Cira fragen')) + '</button><span class="mono leise">' + esc(uebersetze('Strg+Leertaste')) + '</span></div>' +
  '</section>';
}

/* ---------- Rechts: Abrechnung, Geladen, Aktionen ---------- */
function szAbrechnungHtml(d) {
  const tz = szZustand.ticket && szZustand.ticket.key === d.vorgang ? szZustand.ticket : null;
  const t = tz ? tz.d : null;
  const s = t && (t.sitzungen || []).find((x) => x.session_id === d.id);
  const via = { branch: 'Branch', gebucht: 'Buchung', vorgemerkt: 'Vormerkung beim Start' }[d.zuordnung];
  const kpis = [
    ['Dauer · Sitzung', s ? hrs(s.active_seconds / 3600) : '–'],
    ['Tokens · Sitzung', s ? kurz(s.tokens) : '–'],
    ['API · Sitzung', s ? usd(s.cost_usd) : '–'],
    ['Arbeitswert · Vorgang gesamt', t ? eur(t.arbeitswert) : '–'],
  ];
  const zuordnen = szZustand.zuordnen
    ? '<form class="sz-zuordnen" id="sz-zuordnen" data-id="' + esc(d.id) + '"><input class="eingabe mono" id="sz-zu-vorgang" maxlength="40" autocomplete="off" value="' + esc(d.vorgang || '') + '" aria-label="' + esc(uebersetze('Vorgang, leer = ohne')) + '" placeholder="' + esc(uebersetze('Vorgang, leer = ohne')) + '">' +
      '<button type="submit" class="knopf klein primaer">' + esc(uebersetze('Speichern')) + '</button><button type="button" class="knopf klein" data-aktion="sz-zuordnen" data-wert="0">' + esc(uebersetze('Abbrechen')) + '</button></form>'
    : '<span class="sz-via">' + (via ? esc(uebersetze('Zuordnung über')) + ' ' + esc(uebersetze(via)) + (d.branch ? ' <span class="mono">' + esc(d.branch) + '</span>' : '') + ' · ' : '') +
      '<button type="button" class="link" data-aktion="sz-zuordnen" data-wert="1">' + esc(uebersetze('ändern')) + '</button></span>';
  return '<div class="sz-block"><span class="sz-label">' + esc(uebersetze('Abrechnung dieser Sitzung')) + '</span>' +
    '<div class="sz-abr"><div class="sz-abr-kopf"><span class="v mono">' + esc(d.vorgang || uebersetze('ohne Vorgang')) + '</span>' +
      (t && (t.kunde || t.project) ? '<span class="u">' + esc([t.project, t.kunde].filter(Boolean).join(' · ')) + '</span>' : '') + '</div>' +
      // Drei Faelle, damit "–" nie zugleich "0" und "unbekannt" heisst.
      (tz && tz.fehler ? '<p class="leise sz-fehler">' + esc(uebersetze('Abrechnung nicht ladbar')) + ': ' + esc(tz.fehler) + '</p>'
        : d.vorgang && !t ? '<p class="leise">' + esc(uebersetze('Noch nicht im Ledger — nach dem nächsten Abgleich.')) + '</p>'
        : t && !s ? '<p class="leise">' + esc(uebersetze('Diese Sitzung ist noch nicht abgeglichen; der Vorgang schon.')) + '</p>' : '') +
      '<div class="sz-kpis">' + kpis.map(([l, v]) => '<div><span class="l">' + esc(uebersetze(l)) + '</span><span class="w mono">' + esc(v) + '</span></div>').join('') + '</div>' +
      (d.nurLesen ? '' : zuordnen) + '</div></div>';
}

function szGeladenHtml(d) {
  const g = d.geladen;
  const namen = g ? [
    ...(g.plugins || []).map((n) => '<span class="sz-tool an">' + esc(n) + '</span>'),
    ...(g.mcp || []).map((m) => '<span class="sz-tool an' + (m.status === 'connected' ? '' : ' aus') + '" title="' + esc(m.status || '') + '">' + esc(m.name) + '</span>'),
  ] : [];
  const zahlen = g ? (g.skills ? '<span class="sz-tool">' + g.skills + ' ' + esc(uebersetze('Skills')) + '</span>' : '') + (g.agents ? '<span class="sz-tool">' + g.agents + ' ' + esc(uebersetze('Agents')) + '</span>' : '') : '';
  // Viele Plugins/MCPs schoeben die Aktionen aus dem Bild: die ersten 8, der Rest aufklappbar.
  const SICHTBAR = 8;
  const pillen = namen.slice(0, SICHTBAR).join('') + zahlen +
    (namen.length > SICHTBAR ? '<details class="sz-mehr"><summary>+' + (namen.length - SICHTBAR) + ' ' + esc(uebersetze('weitere')) + '</summary><div class="sz-tools">' + namen.slice(SICHTBAR).join('') + '</div></details>' : '');
  return '<div class="sz-block"><span class="sz-label zwei">' + esc(uebersetze('Geladen')) +
      (d.ctx_pct != null ? '<span class="mono">' + esc(prozent(d.ctx_pct)) + ' ' + esc(uebersetze('Kontext')) + '</span>' : '') + '</span>' +
    (g ? '<div class="sz-tools">' + pillen + '</div>' : '<p class="leise">' + esc(uebersetze('Nur für Sitzungen aus c2invoice bekannt.')) + '</p>') +
    '<a class="link" href="#/analyse/werkzeuge">' + esc(uebersetze('Werkzeuge verwalten →')) + '</a></div>';
}

function szAktionenHtml(d) {
  const eigen = !d.nurLesen;
  const tag = (d.gestartet || d.letzte || '').slice(0, 10);
  const zeile = (inhalt, art, grund) => grund
    ? '<button type="button" class="sz-aktion" disabled title="' + esc(uebersetze(grund)) + '">' + inhalt + '</button>'
    : art;
  const innen = (l, t, c) => '<span>' + esc(uebersetze(l)) + '</span><span class="tag mono ' + (c || '') + '">' + esc(uebersetze(t)) + '</span>';
  const pos = innen('Als Position in Rechnungsentwurf', 'direkt');
  return '<div class="sz-block"><span class="sz-label">' + esc(uebersetze('Aus dieser Sitzung')) + '</span>' +
    zeile(innen('Zusammenfassung ins Vorgangs-Log', 'lokal'), '<button type="button" class="sz-aktion" data-aktion="sz-zusammenfassung" data-wert="' + esc(d.id) + '">' + innen('Zusammenfassung ins Vorgangs-Log', 'lokal') + '</button>', d.vorgang ? null : 'Erst einem Vorgang zuordnen.') +
    (d.vorgang && /^\d{4}-\d{2}-\d{2}$/.test(tag)
      ? '<a class="sz-aktion" href="#/beleg/neu?art=rechnung&tickets=' + encodeURIComponent(d.vorgang) + '&from=' + tag + '&to=' + tag + '">' + pos + '</a>'
      : zeile(pos, '', 'Erst einem Vorgang zuordnen.')) +
    zeile(innen('Übergabe für nächste Sitzung', 'Claude', 'akzent'), '<button type="button" class="sz-aktion" data-aktion="sz-uebergabe" data-wert="' + esc(d.id) + '">' + innen('Übergabe für nächste Sitzung', 'Claude', 'akzent') + '</button>', eigen && d.live ? null : 'Nur in einer laufenden Sitzung aus c2invoice.') +
    zeile(innen('Im Terminal fortsetzen', 'wt'), '<button type="button" class="sz-aktion" data-aktion="sz-terminal" data-wert="' + esc(d.id) + '">' + innen('Im Terminal fortsetzen', 'wt') + '</button>', eigen && d.live ? 'Läuft noch in c2invoice — erst stoppen.' : null) +
  '</div>';
}

function szRechtsHtml(d) {
  return '<aside class="sz-spalte sz-rechts" aria-label="' + esc(uebersetze('Abrechnung dieser Sitzung')) + '">' + szAbrechnungHtml(d) + szGeladenHtml(d) + szAktionenHtml(d) + '</aside>';
}

function szZeichnen(w) {
  const id = szGewaehlt();
  const d = szZustand.details;
  let mitte, rechts = '';
  if (szZustand.fehler) mitte = '<section class="sz-mitte"><div class="sz-oben"><div class="hinweis sz-fehler">' + esc(szZustand.fehler) + '</div></div></section>';
  else if (!id) mitte = '<section class="sz-mitte">' + szNeuHtml() + '</section>';
  else if (d && d.unbekannt) mitte = '<section class="sz-mitte">' + leer('liste', 'Sitzung unbekannt', '') + '</section>';
  // Details einer anderen Sitzung (Wechsel, Antwort noch unterwegs) nie unter der neuen Auswahl zeigen.
  else if (!d || d.id !== id) mitte = '<section class="sz-mitte"><div class="sz-oben"><div class="hinweis">' + esc(uebersetze('Lädt …')) + '</div></div></section>';
  else { mitte = szMitteHtml(d); rechts = szRechtsHtml(d); }
  // Getippten Text ueber das Neuzeichnen retten (SSE zeichnet waehrend des Tippens).
  const merkeWert = ['sz-text', 'sz-prompt', 'sz-vorgang', 'sz-agent', 'sz-ab', 'sz-modus', 'sz-zu-vorgang'].map((k) => [k, document.getElementById(k)]).filter(([, el]) => el).map(([k, el]) => [k, el.value, document.activeElement === el]);
  const alt = document.getElementById('sz-log');
  // Nur mitscrollen, wenn man unten war — sonst springt die Ansicht beim Lesen weg.
  const unten = !alt || alt.scrollHeight - alt.scrollTop - alt.clientHeight < 40;
  w.innerHTML = '<div class="sz' + (rechts ? '' : ' ohne-rechts') + '">' + szListeHtml() + mitte + rechts + '</div>';
  for (const [k, v, fokus] of merkeWert) { const el = document.getElementById(k); if (el) { el.value = v; if (fokus) el.focus(); } }
  const log = document.getElementById('sz-log');
  if (log && unten) log.scrollTop = log.scrollHeight;
  const neu = document.getElementById('sz-neu');
  if (neu) neu.addEventListener('submit', szStarten);
  const ein = document.getElementById('sz-eingabe');
  if (ein) {
    ein.addEventListener('submit', szSenden);
    // Enter schickt ab, Shift+Enter ist eine neue Zeile (Owner 20.10., wie in Claude Code).
    // Offene Befehlsliste: Enter uebernimmt dort den Vorschlag (szVorschlagBinden).
    const feld = document.getElementById('sz-text');
    feld.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || feld.getAttribute('aria-expanded') === 'true') return;
      e.preventDefault();
      ein.requestSubmit();
    });
    szVorschlagBinden();
  }
  const zu = document.getElementById('sz-zuordnen');
  if (zu) zu.addEventListener('submit', szZuordnen);
}

async function szStarten(e) {
  e.preventDefault();
  const knopf = e.submitter;
  await mitLauf(knopf, async () => {
    try {
      const r = await sende('/api/sitzung', {
        arbeitsbereich: document.getElementById('sz-ab').value, prompt: document.getElementById('sz-prompt').value,
        vorgang: document.getElementById('sz-vorgang').value.trim(), agent: document.getElementById('sz-agent').value.trim(), modus: document.getElementById('sz-modus').value,
      });
      const p = document.getElementById('sz-prompt');
      if (p) p.value = '';
      toast(uebersetze('Sitzung gestartet'));
      location.hash = '#/sitzungen/' + r.id;
    } catch (err) { toast(uebersetze('Start fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
}
async function szSenden(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const text = document.getElementById('sz-text').value;
  if (!text.trim()) return;
  await mitLauf(e.submitter, async () => {
    try {
      await sende('/api/sitzung/' + encodeURIComponent(f.dataset.id) + '/eingabe', { text });
      // Das Feld kann inzwischen neu gezeichnet sein: das aktuelle leeren.
      const feld = document.getElementById('sz-text');
      if (feld) feld.value = '';
      szSpaeter();
    } catch (err) { toast(uebersetze('Eingabe fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
}
async function szZuordnen(e) {
  e.preventDefault();
  const id = e.currentTarget.dataset.id;
  await mitLauf(e.submitter, async () => {
    try {
      await sende('/api/sitzung/' + encodeURIComponent(id) + '/zuordnung', { vorgang: document.getElementById('sz-zu-vorgang').value.trim() });
      szZustand.zuordnen = false;
      toast(uebersetze('Zuordnung gespeichert'));
      szSpaeter();
    } catch (err) { toast(uebersetze('Zuordnung fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
}
aktion('sz-stopp', async (id, knopf) => {
  await mitLauf(knopf, async () => {
    try { await sende('/api/sitzung/' + encodeURIComponent(id) + '/stopp', {}); toast(uebersetze('Sitzung wird beendet')); } catch (err) { toast(uebersetze('Stoppen fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
});
aktion('sz-ansicht', (w) => { merke('sz.ansicht', w === 'karten' ? 'karten' : 'term'); szZeichnen(document.getElementById('ansicht')); });
aktion('sz-zuordnen', (w) => { szZustand.zuordnen = w === '1'; szZeichnen(document.getElementById('ansicht')); const f = document.getElementById('sz-zu-vorgang'); if (f) f.focus(); });
aktion('sz-cira', () => oeffneDock(true));
aktion('sz-zusammenfassung', async (id, knopf) => {
  await mitLauf(knopf, async () => {
    try {
      const r = await sende('/api/sitzung/' + encodeURIComponent(id) + '/zusammenfassung', {});
      toast(uebersetze('Zusammenfassung im Vorgangs-Log'), '', { text: r.vorgang + ' →', tu: () => { location.hash = '#/vorgaenge/' + encodeURIComponent(r.vorgang); } });
    } catch (err) { toast(uebersetze('Zusammenfassung fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
});
aktion('sz-uebergabe', async (id, knopf) => {
  await mitLauf(knopf, async () => {
    try { const r = await sende('/api/sitzung/' + encodeURIComponent(id) + '/uebergabe', {}); toast(uebersetze('Übergabe an Claude beauftragt — geschrieben wird erst nach deiner Freigabe') + ': ' + r.datei); szSpaeter(); } catch (err) { toast(uebersetze('Übergabe fehlgeschlagen') + ': ' + err.message, 'err'); }
  });
});
aktion('sz-terminal', async (id, knopf) => {
  await mitLauf(knopf, async () => {
    try { await sende('/api/sitzung/' + encodeURIComponent(id) + '/terminal', {}); toast(uebersetze('Terminal geöffnet')); } catch (err) { toast(uebersetze('Terminal nicht geöffnet') + ': ' + err.message, 'err'); }
  });
});
async function szEntscheide(id, wahl, knopf) {
  const h = document.getElementById('sz-hinweis-' + id);
  await mitLauf(knopf, async () => {
    try { await sende('/api/freigaben/' + encodeURIComponent(id) + '/entscheide', { wahl, hinweis: h && h.value.trim() ? h.value.trim() : undefined }); szSpaeter(); } catch (err) { toast(uebersetze('Entscheidung fehlgeschlagen') + ': ' + err.message, 'err'); szSpaeter(); }
  });
}
aktion('sz-erlauben', (id, knopf) => szEntscheide(id, 'ok', knopf));
aktion('sz-ablehnen', (id, knopf) => szEntscheide(id, 'ablehnen', knopf));

registriere('sitzungen', {
  zeichne(w, teile, neu) {
    // Beim Wechsel der Sitzung nicht die alte stehen lassen.
    if (neu || (szZustand.details && szZustand.details.id !== szGewaehlt())) { szZustand.details = null; szZustand.ticket = null; szZustand.zuordnen = false; }
    // Eine Sitzung geoeffnet statt des Formulars: die Board-Vorlage gilt nicht mehr.
    if (szGewaehlt()) szVorlage = null;
    szZeichnen(w);
    szLaden();
  },
  // Rueckfallebene, falls ein SSE-Ereignis fehlt (15-s-Takt der Shell).
  live() { if (route().name === 'sitzungen') szSpaeter(); },
});
