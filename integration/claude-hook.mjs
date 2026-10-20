#!/usr/bin/env node
// Meldet c2invoice, dass eine Claude-Code-Sitzung im eigenen Terminal auf dich
// wartet (Notification), einen Zug beendet hat (Stop) oder vorbei ist
// (SessionEnd: /exit, Fenster zu). Optional: ohne diesen Hook zeigt c2invoice
// fremde Sitzungen trotzdem (offen bis 5 h ohne Eingabe), nur ohne „wartet“
// und ohne sofortiges Ende.
//
// Eintragen in ~/.claude/settings.json (Pfad anpassen):
//   "hooks": {
//     "Notification": [{ "hooks": [{ "type": "command", "command": "node C:/Pfad/zu/c2invoice/integration/claude-hook.mjs" }] }],
//     "Stop":         [{ "hooks": [{ "type": "command", "command": "node C:/Pfad/zu/c2invoice/integration/claude-hook.mjs" }] }],
//     "SessionEnd":   [{ "hooks": [{ "type": "command", "command": "node C:/Pfad/zu/c2invoice/integration/claude-hook.mjs" }] }]
//   }
//
// Das Geheimnis (hook.geheimnis) und der Port stehen in config.json neben
// diesem Ordner; c2invoice erzeugt das Geheimnis beim ersten Start. Der Hook
// blockiert Claude nie: jeder Fehler endet still mit Exit 0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const still = () => process.exit(0);
setTimeout(still, 3000).unref();
try {
  const ordner = path.dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(fs.readFileSync(path.join(ordner, '..', 'config.json'), 'utf8'));
  const geheimnis = config.hook && config.hook.geheimnis;
  let roh = '';
  for await (const s of process.stdin) roh += s;
  const e = JSON.parse(roh || '{}');
  if (!geheimnis || !['Notification', 'Stop', 'SessionEnd'].includes(e.hook_event_name)) still();
  await fetch('http://127.0.0.1:' + (config.port || 4747) + '/api/hook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-c2invoice-geheimnis': geheimnis },
    body: JSON.stringify({ hook_event_name: e.hook_event_name, session_id: e.session_id, message: e.message || null }),
    signal: AbortSignal.timeout(2000),
  });
} catch { /* c2invoice laeuft nicht oder Datei fehlt: Claude nicht stoeren */ }
still();
