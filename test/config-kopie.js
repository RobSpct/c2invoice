// Tests und Gates schreiben ueber schreibeConfig() und configGeschuetzt() in die
// Konfiguration. Mit diesem Modul landet das in einer Kopie: bricht der Lauf
// mittendrin ab oder bearbeitet jemand config.json waehrenddessen, bleibt die
// echte Datei unberuehrt (Toolcheck 15.10., H8). Lesen geht ebenfalls an die
// Kopie, sonst saehen Tests ihr eigenes Schreiben nicht. Dasselbe Verfahren
// wie design/werkzeuge/probe.js. Als erstes require eines Skripts laden, vor
// jedem Modul, das config.json liest.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const echt = path.join(__dirname, '..', 'config.json');
const kopie = path.join(os.tmpdir(), 'c2invoice-test-' + process.pid + '-config.json');
fs.copyFileSync(echt, kopie);
const norm = (p) => (typeof p === 'string' || p instanceof URL ? path.resolve(String(p)).toLowerCase() : null);
const um = (p) => (norm(p) === echt.toLowerCase() ? kopie : norm(p) === (echt + '.tmp').toLowerCase() ? kopie + '.tmp' : p);
for (const name of ['readFileSync', 'writeFileSync', 'existsSync', 'rmSync', 'statSync']) {
  const orig = fs[name];
  fs[name] = (p, ...r) => orig(um(p), ...r);
}
const benenne = fs.renameSync;
fs.renameSync = (a, b) => benenne(um(a), um(b));
process.on('exit', () => { for (const f of [kopie, kopie + '.tmp']) try { fs.unlinkSync(f); } catch { /* weg */ } });

// Dasselbe fuer die Datenbank: server.js oeffnet und migriert beim Laden, ohne
// Umleitung landete das in data/ledger.db (R15). Kindprozesse erben C2I_DB und
// teilen die Datei; aufraeumen tut nur der Prozess, der sie angelegt hat.
// Unter Windows ist die Datei beim Prozessende oft noch offen (EBUSY): Reste
// toter Prozesse raeumt deshalb der naechste Lauf weg.
if (!process.env.C2I_DB) {
  const muster = /^c2invoice-test-(\d+)-ledger\.db/;
  for (const f of fs.readdirSync(os.tmpdir())) {
    const m = muster.exec(f);
    if (!m) continue;
    try { process.kill(Number(m[1]), 0); continue; } catch (e) { if (e.code === 'EPERM') continue; }
    try { fs.unlinkSync(path.join(os.tmpdir(), f)); } catch { /* noch offen */ }
  }
  const dbKopie = path.join(os.tmpdir(), 'c2invoice-test-' + process.pid + '-ledger.db');
  process.env.C2I_DB = dbKopie;
  process.on('exit', () => { for (const s of ['', '-wal', '-shm']) try { fs.unlinkSync(dbKopie + s); } catch { /* offen, naechster Lauf */ } });
}
