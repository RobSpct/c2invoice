'use strict';
// Stufe T2: Claude Code headless (`claude -p`), uebernommen aus Jarvis
// core/claude.js. Regeln: --setting-sources project,local (keine Hooks und
// Plugins des Nutzers), Kindprozess ohne Geheimnisse, Werkzeuge hart ueber
// --tools festgelegt (--allowedTools erlaubt nur zusaetzlich, schraenkt nichts
// ein), Erfolg nur ueber result.is_error, Kosten aus total_cost_usd.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

// claude.cmd ist nur ein Shim auf bin/claude.exe. Node startet .cmd seit
// CVE-2024-27980 nicht mehr ohne Shell, und mit Shell muesste der Prompt fuer
// cmd.exe maskiert werden. Also die exe direkt.
function findeClaude(eingetragen) {
  if (eingetragen && fs.existsSync(eingetragen)) return eingetragen;
  const npm = path.join(process.env.APPDATA || '', 'npm');
  try {
    const shim = fs.readFileSync(path.join(npm, 'claude.cmd'), 'utf8');
    const m = shim.match(/"%dp0%\\([^"]+\.exe)"/i);
    if (m && fs.existsSync(path.join(npm, m[1]))) return path.join(npm, m[1]);
  } catch { /* kein npm-Shim */ }
  for (const p of [
    path.join(npm, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude'),
  ]) if (fs.existsSync(p)) return p;
  return null;
}

// Umgebung des Kindprozesses ohne Geheimnisse (auch nicht die aus "doppler run").
const GEHEIM = /(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE_KEY|DOPPLER|CREDENTIAL)/i;
function kindUmgebung(env = process.env) {
  const aus = {};
  for (const [k, v] of Object.entries(env)) if (!GEHEIM.test(k)) aus[k] = v;
  return aus;
}

// Profile: lesen = nur Read/Glob/Grep, schreiben = dazu Edit/Write. Bash,
// PowerShell und Notebooks nie. Ohne Freigabe-Regel bleibt Lesen im -p-Modus
// auf den Arbeitsordner beschraenkt (jede Nachfrage wird abgelehnt).
const PROFILE = { lesen: ['Read', 'Glob', 'Grep'], schreiben: ['Read', 'Glob', 'Grep', 'Edit', 'Write'] };
const NIE = ['Bash', 'PowerShell', 'NotebookEdit', 'WebFetch', 'WebSearch'];
const GESCHUETZT = ['.obsidian/**', '.git/**', '.claude/**', 'CLAUDE.md'];
function rechte(profil) {
  const tools = PROFILE[profil];
  if (!tools) throw new Error('Profil unbekannt: ' + profil);
  const schreibt = tools.includes('Write');
  const verbot = [...NIE, ...(schreibt ? GESCHUETZT.flatMap((p) => ['Edit(./' + p + ')', 'Write(./' + p + ')']) : ['Edit', 'Write'])];
  return ['--tools', tools.join(','), '--disallowedTools', verbot.join(','), ...(schreibt ? ['--permission-mode', 'acceptEdits'] : [])];
}

// Ein Lauf. onText(delta) bekommt die Textstuecke, sobald sie kommen.
// Ergebnis: { ok, text, sessionId, kostenUsd, tokens, abgelehnt[], fehler? }.
// maxBudgetUsd: harte Grenze je Lauf (--max-budget-usd), sonst bricht erst das Monatslimit.
function lauf({ exe, cwd, prompt, profil = 'lesen', modell = '', maxBudgetUsd = null, onText, spawnFn = spawn, env = kindUmgebung() }) {
  // --strict-mcp-config ohne --mcp-config: keine MCP-Server des Nutzers (die haengen nicht an --setting-sources).
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--setting-sources', 'project,local', '--strict-mcp-config', ...rechte(profil)];
  if (modell) args.push('--model', modell);
  if (maxBudgetUsd != null) args.push('--max-budget-usd', String(Math.max(0.01, Math.floor(maxBudgetUsd * 100) / 100)));
  // "--" beendet die Optionen: --disallowedTools ist variadisch und schluckte den Prompt sonst.
  args.push('--', prompt);

  let kind;
  const fertig = new Promise((aufloesen) => {
    if (!exe) return aufloesen({ ok: false, fehler: 'Claude Code nicht gefunden (claude.exe).' });
    try {
      kind = spawnFn(exe, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (err) {
      return aufloesen({ ok: false, fehler: 'Start fehlgeschlagen: ' + err.message });
    }
    let puffer = '', ergebnis = null, sessionId = null;
    const fehlerText = [];
    const zeile = (z) => {
      if (!z.trim()) return;
      let e;
      try { e = JSON.parse(z); } catch { return; }
      if (e.type === 'system' && e.subtype === 'init') sessionId = e.session_id || sessionId;
      else if (e.type === 'stream_event' && e.event && e.event.type === 'content_block_delta'
        && e.event.delta && e.event.delta.type === 'text_delta' && e.event.delta.text && onText) onText(e.event.delta.text);
      else if (e.type === 'result') ergebnis = e;
    };
    kind.stdout.setEncoding('utf8');
    kind.stdout.on('data', (d) => {
      puffer += d;
      let i;
      while ((i = puffer.indexOf('\n')) >= 0) { zeile(puffer.slice(0, i)); puffer = puffer.slice(i + 1); }
    });
    kind.stderr.setEncoding('utf8');
    kind.stderr.on('data', (d) => { if (fehlerText.join('').length < 4000) fehlerText.push(d); });
    kind.on('error', (err) => aufloesen({ ok: false, fehler: 'Start fehlgeschlagen: ' + err.message }));
    kind.on('close', (code, signal) => {
      if (puffer.trim()) zeile(puffer);
      const rest = fehlerText.join('').trim().slice(0, 300);
      if (kind.abgebrochen) return aufloesen({ ok: false, fehler: 'abgebrochen', sessionId });
      // Ohne Login endet claude -p mit Exit 0 und ohne result: kein Erfolg.
      if (!ergebnis) return aufloesen({ ok: false, sessionId, fehler: 'Kein Ergebnis von Claude (Exit ' + (signal || code) + ')' + (rest ? ': ' + rest : '') });
      const u = ergebnis.usage || {};
      const basis = {
        text: typeof ergebnis.result === 'string' ? ergebnis.result : '',
        sessionId: ergebnis.session_id || sessionId,
        // Fehlt das Feld, sind die Kosten unbekannt (null), nicht 0.
        kostenUsd: ergebnis.total_cost_usd != null && Number.isFinite(Number(ergebnis.total_cost_usd)) ? Number(ergebnis.total_cost_usd) : null,
        tokens: (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
        abgelehnt: (ergebnis.permission_denials || []).map((d) => d.tool_name).filter(Boolean),
      };
      if (ergebnis.is_error) return aufloesen({ ...basis, ok: false, fehler: String(basis.text || ergebnis.subtype || 'Fehler').slice(0, 240) });
      aufloesen({ ...basis, ok: true });
    });
  });
  return { fertig, stopp() { if (kind && kind.exitCode === null) { kind.abgebrochen = true; kind.kill(); } } };
}

module.exports = { lauf, findeClaude, kindUmgebung, rechte, PROFILE };
