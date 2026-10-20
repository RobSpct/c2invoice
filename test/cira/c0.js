'use strict';
// Masterplan 3.0, Block C0: Config-Grundlage. Arbeitsbereiche (benannter
// Ordner mit Farbe, Projekt nur als Verweis) und schreibeConfig().
// Pfade stehen nur in config.json — die Oberflaeche zeigt sie, aendert sie nie.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CFG = path.join(__dirname, '..', '..', 'config.json');
const ausDatei = () => JSON.parse(fs.readFileSync(CFG, 'utf8'));
// Arbeitsbereiche entstehen nur in der Datei: Datei und Speicher (wie nach einem Neustart) setzen.
function bereicheSetzen(liste) {
  const d = ausDatei(); d.arbeitsbereiche = liste; fs.writeFileSync(CFG, JSON.stringify(d, null, 2));
  require(CFG).arbeitsbereiche = JSON.parse(JSON.stringify(liste));
}

// Wie configGeschuetzt in selfcheck.js, aber wartet auf asynchrone Tests:
// sonst stellt finally die Datei wieder her, waehrend der Test noch laeuft.
async function geschuetztAsync(fn) {
  const datei = fs.readFileSync(CFG, 'utf8');
  const cfg = require(CFG);
  const speicher = JSON.parse(JSON.stringify(cfg));
  try {
    return await fn();
  } finally {
    fs.writeFileSync(CFG, datei, 'utf8');
    for (const k of Object.keys(cfg)) delete cfg[k];
    Object.assign(cfg, speicher);
  }
}

module.exports = ({ configGeschuetzt }) => {
  // Verschachtelte Einstellungen (pfad: 'lokaleModelle.x') landeten nur im
  // Speicher: schreibeConfig schrieb config[feld] statt der Gruppe.
  function schreibtVerschachtelt() {
    configGeschuetzt(() => {
      const srv = require('../../server');
      const vorher = ausDatei().lokaleModelle || {};
      srv.setzeEinstellungen({ lokalEurProMioTokens: 3.25, lokalZuordnungsfenster: 45 });
      const d = ausDatei();
      assert.strictEqual(d.lokaleModelle && d.lokaleModelle.eurProMioTokens, 3.25, 'eurProMioTokens nicht in der Datei');
      assert.strictEqual(d.lokaleModelle.zuordnungsfensterMinuten, 45);
      assert.ok(!('lokalEurProMioTokens' in d), 'Feldname statt Gruppe in der Datei');
      // Die uebrigen Schluessel der Gruppe bleiben stehen.
      for (const k of Object.keys(vorher)) assert.ok(k in d.lokaleModelle, 'lokaleModelle.' + k + ' verloren');
      // Alles, was schreibeConfig schreibt, ist als Liste bekannt (Gate config).
      assert.ok(srv.SCHREIBBAR.includes('lokaleModelle') && srv.SCHREIBBAR.includes('arbeitsbereiche'));
    });
  }

  function arbeitsbereichGrenzen() {
    configGeschuetzt(() => {
      const srv = require('../../server');
      const cfg = require(CFG);
      const pfad = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-ab-'));
      bereicheSetzen([
        { name: 'Kunde A', kuerzel: 'KA', farbe: '#f97316', art: 'projekt', projekt: 'kunde-a', pfad, todo: path.join(pfad, 'TODO.md') },
        { name: 'Global', kuerzel: 'GL', farbe: '#9c9ca6', art: 'global', pfad: '~/.claude' },
      ]);
      // Erlaubte Felder werden normalisiert und landen in der Datei.
      const r = srv.setzeArbeitsbereich({ name: 'Kunde A', kuerzel: 'ka', farbe: '#57C98A', jiraProjekt: 'KA' });
      assert.strictEqual(r.arbeitsbereich.kuerzel, 'KA');
      assert.strictEqual(r.arbeitsbereich.farbe, '#57c98a');
      const d = ausDatei().arbeitsbereiche[0];
      assert.deepStrictEqual([d.kuerzel, d.farbe, d.jiraProjekt, d.pfad], ['KA', '#57c98a', 'KA', pfad], 'Datei: ' + JSON.stringify(d));
      // Leer entfernt optionale Verweise, nicht Pflichtfelder.
      srv.setzeArbeitsbereich({ name: 'Kunde A', jiraProjekt: '' });
      assert.ok(!('jiraProjekt' in ausDatei().arbeitsbereiche[0]), 'jiraProjekt nicht entfernt');
      assert.throws(() => srv.setzeArbeitsbereich({ name: 'Kunde A', kuerzel: '' }), /Kuerzel/);
      // Pfade und Unbekanntes nie ueber die Oberflaeche.
      for (const boese of [{ pfad: 'C:\\Windows' }, { todo: '/etc/passwd' }, { art: 'global' }, { __proto__: { x: 1 }, farbe: '#000000', constructor: 'x' }]) {
        assert.throws(() => srv.setzeArbeitsbereich({ name: 'Kunde A', ...boese }), /config\.json|Unbekannt/, 'durchgelassen: ' + JSON.stringify(boese));
      }
      assert.strictEqual(ausDatei().arbeitsbereiche[0].pfad, pfad, 'Pfad wurde veraendert');
      // Grenzen je Feld.
      for (const [f, w] of [['kuerzel', 'ABCD'], ['kuerzel', 'Ä1'], ['farbe', 'red'], ['farbe', '#12345'], ['farbe', '#1234567'],
        ['jiraProjekt', 'ka'], ['jiraProjekt', 'A'], ['projekt', 'x'.repeat(81)], ['projekt', 'a\u0007b'], ['kuerzel', 5], ['farbe', ['#000000']]]) {
        assert.throws(() => srv.setzeArbeitsbereich({ name: 'Kunde A', [f]: w }), Error, f + ' nimmt ' + JSON.stringify(w));
      }
      // Von Hand in der Datei geaenderte Pfade ueberlebt jedes Speichern aus
      // der Oberflaeche (Security-Review A): geschrieben werden nur die Felder.
      const datei = ausDatei();
      datei.arbeitsbereiche[0].pfad = 'D:\\umgezogen';
      datei.lokaleModelle = { ...(datei.lokaleModelle || {}), upstreamUrl: 'http://127.0.0.1:9999' };
      fs.writeFileSync(CFG, JSON.stringify(datei, null, 2));
      srv.setzeArbeitsbereich({ name: 'Kunde A', farbe: '#e0b355' });
      srv.setzeEinstellungen({ lokalZuordnungsfenster: 20 });
      const nachher = ausDatei();
      assert.deepStrictEqual([nachher.arbeitsbereiche[0].pfad, nachher.arbeitsbereiche[0].farbe], ['D:\\umgezogen', '#e0b355'], 'Pfad aus der Datei ueberschrieben');
      assert.strictEqual(nachher.lokaleModelle.upstreamUrl, 'http://127.0.0.1:9999', 'upstreamUrl aus der Datei ueberschrieben');
      assert.strictEqual(nachher.lokaleModelle.zuordnungsfensterMinuten, 20);
      // Neue Bereiche entstehen nur in der Datei.
      assert.throws(() => srv.setzeArbeitsbereich({ name: 'Neu', kuerzel: 'NE' }), /unbekannt/i);
      assert.throws(() => srv.setzeArbeitsbereich({ name: 'Kunde A' }), /Kein bekanntes Feld/);
      fs.rmSync(pfad, { recursive: true, force: true });
    });
  }

  async function arbeitsbereicheRoute() {
    await geschuetztAsync(async () => {
      const srv = require('../../server');
      const cfg = require(CFG);
      const lauscht = srv.server.listening;
      if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
      const url = (p) => `http://127.0.0.1:${srv.server.address().port}${p}`;
      try {
        bereicheSetzen([
          { name: 'Da', kuerzel: 'DA', farbe: '#f97316', art: 'projekt', projekt: 'p', pfad: os.tmpdir() },
          { name: 'Weg', kuerzel: 'WE', farbe: '#57c98a', art: 'neutral', pfad: path.join(os.tmpdir(), 'gibt-es-nicht-' + Date.now()) },
        ]);
        let r = await (await fetch(url('/api/arbeitsbereiche'))).json();
        assert.deepStrictEqual(r.arbeitsbereiche.map((a) => [a.name, a.erreichbar]), [['Da', true], ['Weg', false]]);
        // Von Hand Eingetragenes geht durch dieselbe Pruefung: die Farbe landet in einem style-Attribut.
        cfg.arbeitsbereiche.push({ name: 'Hand', kuerzel: '<b>', farbe: 'red;background:url(x)', art: 'boese', pfad: '' });
        r = await (await fetch(url('/api/arbeitsbereiche'))).json();
        assert.deepStrictEqual(['kuerzel', 'farbe', 'art', 'erreichbar'].map((k) => r.arbeitsbereiche[2][k]), ['', '', 'neutral', false], JSON.stringify(r.arbeitsbereiche[2]));
        cfg.arbeitsbereiche.pop();
        assert.strictEqual(r.vorschlag, null, 'Vorschlag trotz vorhandener Liste');
        // Ohne Liste: Vorschlag mit Global-Eintrag, sonst nichts geschrieben.
        delete cfg.arbeitsbereiche;
        const vorher = fs.readFileSync(CFG, 'utf8');
        r = await (await fetch(url('/api/arbeitsbereiche'))).json();
        assert.deepStrictEqual(r.arbeitsbereiche, []);
        assert.ok(Array.isArray(r.vorschlag) && r.vorschlag.some((a) => a.art === 'global'), 'Vorschlag ohne Global: ' + JSON.stringify(r.vorschlag));
        assert.ok(r.vorschlag.every((a) => /^#[0-9a-f]{6}$/.test(a.farbe) && /^[A-Z0-9]{1,3}$/.test(a.kuerzel)), 'Vorschlag verletzt die eigenen Grenzen');
        assert.strictEqual(fs.readFileSync(CFG, 'utf8'), vorher, 'Lesen hat config.json veraendert');
        // Schreiben ueber die Route: Pfad abgewiesen mit 400.
        bereicheSetzen([{ name: 'Da', kuerzel: 'DA', farbe: '#f97316', art: 'projekt', pfad: os.tmpdir() }]);
        const post = (b) => fetch(url('/api/arbeitsbereich'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
        let a = await post({ name: 'Da', pfad: 'C:\\' });
        assert.strictEqual(a.status, 400, 'Pfad ueber die Route: ' + a.status);
        a = await post({ name: 'Da', farbe: '#e0b355' });
        assert.strictEqual(a.status, 200);
        assert.strictEqual(ausDatei().arbeitsbereiche[0].farbe, '#e0b355');
      } finally {
        if (!lauscht) await new Promise((ok) => srv.server.close(ok));
      }
    });
  }

  return [
    ['Cira C0: schreibeConfig schreibt verschachtelte Einstellungen in ihre Gruppe', schreibtVerschachtelt],
    ['Cira C0: Arbeitsbereiche nur mit Whitelist und Grenzen, Pfade nur in der Datei', arbeitsbereichGrenzen],
    ['Cira C0: Arbeitsbereiche-Route meldet Erreichbarkeit, Vorschlag ohne Schreiben', arbeitsbereicheRoute],
  ];
};
