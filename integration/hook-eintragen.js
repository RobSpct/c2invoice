#!/usr/bin/env node
// Traegt integration/claude-hook.mjs fuer Notification, Stop und SessionEnd in
// ~/.claude/settings.json ein. Vorher eine Sicherung daneben, vorhandene Hooks
// bleiben unveraendert, doppelt eingetragen wird nichts. Aufruf:
//   node integration/hook-eintragen.js
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const datei = path.join(os.homedir(), '.claude', 'settings.json');
const skript = path.join(__dirname, 'claude-hook.mjs').replace(/\\/g, '/');
const befehl = 'node "' + skript + '"';
const EREIGNISSE = ['Notification', 'Stop', 'SessionEnd'];

const alt = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : '{}';
const s = JSON.parse(alt);
s.hooks = s.hooks || {};
const hat = (k) => (s.hooks[k] || []).some((g) => (g.hooks || []).some((h) => h.command === befehl));
const neu = EREIGNISSE.filter((k) => !hat(k));
if (!neu.length) { console.log('Schon eingetragen, nichts geaendert.'); process.exit(0); }

const sicherung = datei + '.bak-' + new Date().toISOString().slice(0, 10) + '-c2invoice-hook';
fs.writeFileSync(sicherung, alt);
for (const k of neu) (s.hooks[k] = s.hooks[k] || []).push({ hooks: [{ type: 'command', command: befehl, timeout: 5 }] });
fs.writeFileSync(datei, JSON.stringify(s, null, 2) + (alt.endsWith('\n') ? '\n' : ''));
console.log('Eingetragen fuer ' + neu.join(', ') + '. Sicherung: ' + sicherung);
console.log('Gilt fuer neu gestartete Claude-Code-Sitzungen.');
