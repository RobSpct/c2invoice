'use strict';
// Traegt die Herkunft (MCP-Server, MCP-Werkzeug, Skill) fuer bereits
// eingelesene Ereignisse nach.
//
// Warum ueberhaupt: Claude Code protokolliert die Herkunft seit jeher, ingest.js
// hat sie nur nicht gelesen. Ein normaler Einlesevorgang holt sie nicht nach —
// er merkt sich je Datei die Leseposition und fasst bereits gelesene Zeilen nie
// wieder an. Ohne dieses Skript bliebe die Ansicht wochenlang leer, obwohl die
// Angaben in den Logdateien stehen.
//
// Einmalig noetig, danach erledigt das Einlesen es von selbst:
//   node herkunft-nachtragen.js [--dry-run]
//
// Sicherheit: ausschliesslich UPDATE der drei neuen Spalten, und nur dort, wo
// sie leer sind. Tokenzahlen, Kosten, Zeitstempel und Ticketzuordnungen werden
// nicht angefasst — ein Fehler hier kann keine Abrechnung verfaelschen.
// Beliebig oft wiederholbar.
const fs = require('fs');
const readline = require('readline');
const dbmod = require('./db');
const { listJsonlFiles, PROJECT_ROOTS } = require('./ingest');

async function nachtragen(db, { dryRun = false } = {}) {
  // Nur Ereignisse ohne Herkunft: was schon eingetragen ist, stammt aus dem
  // regulaeren Einlesen und ist damit aktueller als alles hier.
  const offen = new Set(
    db.prepare(`
      SELECT request_id FROM events
      WHERE source = 'claude' AND mcp_server IS NULL AND skill IS NULL
    `).all().map((r) => r.request_id)
  );
  if (offen.size === 0) return { geprueft: 0, getroffen: 0, dateien: 0, treffer: [] };

  const setz = db.prepare(`
    UPDATE events SET mcp_server = ?, mcp_tool = ?, skill = ?
    WHERE request_id = ? AND mcp_server IS NULL AND skill IS NULL
  `);

  const dateien = [];
  for (const wurzel of PROJECT_ROOTS) dateien.push(...listJsonlFiles(wurzel));

  let geprueft = 0;
  let getroffen = 0;
  const treffer = [];

  for (const datei of dateien) {
    // Zeilenweise statt die Datei am Stueck: einzelne Sitzungsprotokolle sind
    // mehrere hundert Megabyte gross.
    const strom = readline.createInterface({
      input: fs.createReadStream(datei, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const zeile of strom) {
      if (!zeile) continue;
      let o;
      try {
        o = JSON.parse(zeile);
      } catch {
        continue;
      }
      if (o.type !== 'assistant') continue;
      const requestId = o.requestId || (o.message && o.message.id);
      if (!requestId || !offen.has(requestId)) continue;

      const mcpServer = typeof o.attributionMcpServer === 'string' ? o.attributionMcpServer : null;
      const mcpTool = typeof o.attributionMcpTool === 'string' ? o.attributionMcpTool : null;
      const skill = typeof o.attributionSkill === 'string' ? o.attributionSkill : null;
      geprueft++;
      if (!mcpServer && !skill) continue;

      // Derselbe Request steht mehrfach in der Datei, nur eine Kopie traegt die
      // Herkunft. Ist sie gefunden, muss die id aus der offenen Menge — sonst
      // sucht der Lauf weiter und findet spaeter eine Kopie ohne die Felder.
      offen.delete(requestId);
      getroffen++;
      if (dryRun) treffer.push({ requestId, mcpServer, mcpTool, skill });
      else setz.run(mcpServer, mcpTool, skill, requestId);
    }
  }

  return { geprueft, getroffen, dateien: dateien.length, treffer };
}

module.exports = { nachtragen };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const db = dbmod.open();
  nachtragen(db, { dryRun })
    .then((r) => {
      console.log(`${r.dateien} Logdateien durchgesehen.`);
      console.log(`${r.geprueft} Ereignisse ohne Herkunft wiedergefunden, ` +
        `davon ${r.getroffen} mit einer Angabe.`);
      if (dryRun) {
        console.log('Probelauf — nichts geschrieben.');
        const gezaehlt = new Map();
        for (const t of r.treffer) {
          const k = t.mcpServer ? 'MCP ' + t.mcpServer : 'Skill ' + t.skill;
          gezaehlt.set(k, (gezaehlt.get(k) || 0) + 1);
        }
        for (const [k, v] of [...gezaehlt.entries()].sort((a, b) => b[1] - a[1])) {
          console.log('  ' + String(v).padStart(6) + '  ' + k);
        }
      } else {
        console.log('Eingetragen. Der Reiter Werkzeuge zeigt die Aufschluesselung ab sofort.');
      }
      db.close();
    })
    .catch((err) => {
      console.error('Fehlgeschlagen:', err.message);
      db.close();
      process.exitCode = 1;
    });
}
