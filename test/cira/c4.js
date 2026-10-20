'use strict';
// Masterplan 3.0, Block C4 (Cockpit II): "Rechnung fuer X" legt eine Freigabe
// an, Freigeben stellt ueber die Registry eine echte Rechnung (derselbe Weg wie
// POST /api/rechnung), die Herleitung legt den echten Rechenweg aus, Skills je
// Arbeitsbereich, Einstellung fuer Desktop-Benachrichtigungen.
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const W = path.join(__dirname, '..', '..');
const CFG = path.join(W, 'config.json');

module.exports = ({ configGeschuetzt, dbmod, openDbs }) => {
  const cira = require('../../cira');
  const metrics = require('../../metrics');
  const rechnung = require('../../rechnung');
  const kontakte = require('../../kontakte');
  const zeit = require('../../zeit');
  const freigaben = require('../../freigaben');
  const ereignisse = require('../../ereignisse');
  const herleitung = require('../../herleitung');
  const srv = () => require('../../server');

  const tag = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const nah = (a, b, text) => assert.ok(Math.abs(a - b) < 0.005, text + ': ' + a + ' statt ' + b);

  // Arbeit an ABC-1 und ABC-2 (Projekt "Kunde") und ABC-3 (Projekt "Andere", ohne Kunden).
  function arbeitsDb() {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const insE = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day, cwd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insA = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day, eingabe) VALUES (?,?,?,?,?,?,?)');
    let n = 0;
    const stunde = (session, beginn, projekt, ticket) => {
      for (let m = 0; m <= 60; m += 3) {
        const ts = new Date(beginn + m * 60000).toISOString();
        insE.run('c4-' + n++, ts, session, projekt, 'main', ticket, 'claude-opus-5', 10, 10, 0, 0, 0, 0, 0.1, 0, ts.slice(0, 10), null);
        insA.run(session, ts, projekt, 'main', ticket, ts.slice(0, 10), 1);
      }
    };
    const h = new Date();
    const um = (stundeNr, tage = 0) => new Date(h.getFullYear(), h.getMonth(), h.getDate() - tage, stundeNr, 0).getTime();
    stunde('s-1', um(9), 'Kunde', 'ABC-1');
    stunde('s-2', um(11), 'Kunde', 'ABC-2');
    stunde('s-3', um(13), 'Andere', 'ABC-3');
    return { db, stunde, um };
  }
  const RECHNUNG = {
    rechnung: { aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '' },
      kleinunternehmer: false, ustSatz: 19, zahlungszielTage: 14, chromePfad: '' },
    vergleichsFaktor: 0, selbstkostenStunde: 30,
  };
  async function mitConfig(werte, fn) {
    const cfg = require(CFG);
    const alt = JSON.parse(JSON.stringify(cfg));
    for (const [k, v] of Object.entries(werte)) { if (v === undefined) delete cfg[k]; else cfg[k] = JSON.parse(JSON.stringify(v)); }
    try { return await fn(); } finally { for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, alt); }
  }
  const mitKunde = (db) => kontakte.speichere(db, { firma: 'Nordwind GmbH', vorname: 'Ada', nachname: 'Lind', anschrift: ['Hafen 1', '20457 Hamburg'], email: 'a@nordwind.example', projekte: ['Kunde'] });
  // Manuelle Zeit auf ABC-2 gestern, 14:00 bis 15:30 Ortszeit (ueberlappt keine Sitzung).
  function manuell(db) {
    const h = new Date();
    const von = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 1, 14, 0);
    return zeit.speichere(db, { ziel_art: 'vorgang', ziel_schluessel: 'ABC-2', start: von.toISOString(), ende: new Date(von.getTime() + 90 * 60000).toISOString(),
      pause_min: 0, taetigkeit: 'Entwicklung', notiz: 'Abstimmung', abrechenbar: true });
  }
  const dienst = (db) => cira.erzeuge({ db, bucheVorgang: srv().bucheVorgang, fetchFn: () => { throw new Error('Ollama darf nicht laufen'); },
    spawnFn: () => { throw new Error('Claude darf nicht laufen'); }, claudeExe: 'claude-test.exe' });
  const offene = (db) => freigaben.liste(db, { status: 'offen' }).filter((f) => f.art === 'rechnung');
  const anzahl = (db) => db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;

  /* ---------- G3: Ziel, Nutzlast, Ersetzen ---------- */
  async function rechnungsZiel() {
    const { db, stunde, um } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      srv();
      const d = dienst(db);
      mitKunde(db);
      const e = manuell(db);
      const frag = (t) => d.frage({ text: t, kanal: 'cockpit' });

      const a = await frag('Rechnung für ABC-1');
      let f = offene(db);
      assert.strictEqual(f.length, 1, 'eine Freigabe: ' + a.text);
      assert.strictEqual(a.freigabe_id, f[0].id);
      assert.deepStrictEqual(f[0].nutzlast.tickets, ['ABC-1']);
      assert.strictEqual(f[0].nutzlast.eintraege, undefined, 'ABC-1 hat keine manuelle Zeit');
      nah(f[0].nutzlast.erwartetBrutto, a.szene.brutto, 'erwartetBrutto = gezeigtes Brutto');
      // Die Nutzlast ergibt genau die gezeigte Vorschau.
      nah(rechnung.vorschau(db, f[0].nutzlast).brutto_eur, a.szene.brutto, 'Vorschau aus der Nutzlast');
      assert.deepStrictEqual(a.szene.herleitung, { art: 'rechnung', id: 'F' + f[0].id });
      assert.strictEqual(anzahl(db), 0, 'nichts gestellt');

      // Dieselbe Frage noch einmal: eine Karte, die alte ist ersetzt.
      const alt = f[0].id;
      await frag('Rechnung für ABC-1');
      f = offene(db);
      assert.strictEqual(f.length, 1, 'zwei offene Karten fuer denselben Bezug');
      assert.notStrictEqual(f[0].id, alt);
      const r = db.prepare('SELECT status, hinweis FROM freigabe WHERE id = ?').get(alt);
      assert.deepStrictEqual([r.status, r.hinweis], ['abgelehnt', 'durch neueren Entwurf ersetzt']);
      assert.ok(db.prepare("SELECT COUNT(*) AS n FROM aktion_log WHERE art = 'rechnung:ersetzt'").get().n === 1, 'Ersetzen nicht protokolliert');

      // Liste, Bereich, Projekt, Kunde (Firma und Person): beide Vorgaenge plus manuelle Zeit an ABC-2.
      for (const [frage, bezug] of [['Rechnung für ABC-1, ABC-2', 'ABC-1, ABC-2'], ['Rechnung für ABC-1 bis 2', 'ABC-1 bis ABC-2'], ['Rechnung für kunde', 'Kunde'],
        ['Rechnung für Nordwind GmbH', 'Nordwind GmbH'], ['Rechnung an Ada Lind', 'Nordwind GmbH']]) {
        const n = await frag(frage);
        const x = offene(db).find((y) => y.bezug === bezug);
        assert.ok(x, frage + ': keine Freigabe mit Bezug ' + bezug + ' (' + n.text + ')');
        assert.deepStrictEqual([...x.nutzlast.tickets].sort(), ['ABC-1', 'ABC-2'], frage);
        assert.deepStrictEqual(x.nutzlast.eintraege, [e.id], frage + ': manuelle Zeit fehlt');
        assert.ok(x.nutzlast.from <= e.tag && x.nutzlast.to >= e.tag, frage + ': Zeitraum ohne den Eintrag');
        // Plausibel: zwei Stunden Claude plus 1,5 h manuell, also drei Positionen und mehr als die Claude-Zeit allein.
        assert.strictEqual(n.szene.positionen.length, 3, frage + ': ' + JSON.stringify(n.szene.positionen));
      }
      const offenVorher = offene(db).length;
      // Verschiedene Kunden bzw. kein Kunde, Unbekanntes: keine neue Karte.
      for (const t of ['Rechnung für ABC-1, ABC-3', 'Rechnung für ABC-3', 'Rechnung für Gibtsnicht GmbH', 'Rechnung für XYZ-1, XYZ-2']) {
        const n = await frag(t);
        assert.strictEqual(n.szene, null, t + ' zeigt einen Entwurf');
        assert.strictEqual(offene(db).length, offenVorher, t + ' legt eine Freigabe an');
      }
      // Gestellt: ABC-1 faellt heraus und wird genannt.
      const t1 = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-1');
      const k = kontakte.liste(db)[0];
      const inv = rechnung.erstelle(db, { from: t1.first_day, to: t1.last_day, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1'] } });
      const n = await frag('Rechnung für Kunde');
      const x = offene(db).find((y) => y.bezug === 'Kunde');
      assert.deepStrictEqual(x.nutzlast.tickets, ['ABC-2']);
      assert.ok(n.text.includes('ABC-1 steht schon auf ' + inv.nr), n.text);
      // Bereich mit zwei Kuerzeln ist keiner; Luecken im Bereich werden genannt.
      assert.ok(/in einem Kürzel/.test((await frag('Rechnung für ABC-1 bis XYZ-3')).text));
      stunde('s-6', um(15), 'Kunde', 'ABC-6');
      const lu = await frag('Rechnung für ABC-4 bis 6');
      assert.ok(/Ohne Daten: ABC-4, ABC-5/.test(lu.text), lu.text);
      // Scheitert der neue Entwurf (Titel zu lang), bleibt der alte offen.
      const vorher = offene(db).find((y) => y.bezug === 'Kunde');
      assert.throws(() => freigaben.ersetze(db, { art: 'rechnung', bezug: 'Kunde', titel: 'x'.repeat(201), quelle: 'cira', nutzlast: {} }), /Titel/);
      assert.ok(offene(db).some((y) => y.id === vorher.id), 'alter Entwurf trotz gescheitertem Ersatz abgelehnt');
    });
  }

  // Teilabrechnung: bis vorgestern gestellt, heute neue Zeit (Silent-Failure-Review C4, H1).
  async function teilabrechnung() {
    const { db, stunde, um } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      srv();
      const d = dienst(db);
      const k = mitKunde(db);
      // ABC-1 hatte schon vor drei Tagen Arbeit; die ist gestellt, die von heute nicht.
      stunde('s-alt', um(9, 3), 'Kunde', 'ABC-1');
      const t = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-1');
      const bis = tag(new Date(um(9, 3)));
      const inv = rechnung.erstelle(db, { from: t.first_day, to: bis, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1'] } });
      assert.strictEqual(rechnung.abgerechnetBis(db)['ABC-1'], bis);
      // Offene manuelle Zeit auf dem gestellten Vorgang ABC-2? Hier auf ABC-1 vor dem Belegende: faellt mit Hinweis heraus.
      // Allein angefragt: ab dem Folgetag.
      const n = await d.frage({ text: 'Rechnung für ABC-1', kanal: 'cockpit' });
      const f = offene(db).find((y) => y.bezug === 'ABC-1');
      assert.ok(f, 'kein Entwurf fuer die neue Zeit: ' + n.text);
      assert.ok(f.nutzlast.from > bis, 'Zeitraum ueberlappt den Beleg: ' + f.nutzlast.from);
      const heute = metrics.byTicket(db, { ticket: 'ABC-1', from: f.nutzlast.from, to: f.nutzlast.to })[0];
      nah(n.szene.netto, rechnung.rund2(rechnung.rund2(heute.active_hours) * rechnung.rund2(heute.stundensatz)), 'nur die neue Zeit');
      const e = await freigaben.entscheide(db, f.id, { wahl: 'ok' });
      assert.ok(e.ergebnis.nr && e.ergebnis.nr !== inv.nr, 'Teilabrechnung nicht gestellt');
      // In einer Sammelanfrage: ausgelassen und genannt, nicht still.
      stunde('s-neu', um(16), 'Kunde', 'ABC-2');
      const t2 = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-2');
      rechnung.erstelle(db, { from: t2.first_day, to: tag(new Date()), tickets: ['ABC-2'], kontaktId: k.id, empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1'] } });
      stunde('s-morgen', um(9, -1), 'Kunde', 'ABC-1');
      stunde('s-morgen2', um(11, -1), 'Kunde', 'ABC-7');
      const s = await d.frage({ text: 'Rechnung für Kunde', kanal: 'cockpit' });
      const g = offene(db).find((y) => y.bezug === 'Kunde');
      assert.ok(g && !g.nutzlast.tickets.includes('ABC-1'), 'ABC-1 doppelt im Sammelentwurf');
      assert.ok(/Nicht enthalten: ABC-1 \(gestellt bis/.test(s.text) && /Nicht enthalten: ABC-1/.test(g.text), 'Auslassung nicht genannt: ' + s.text);
    });
  }

  /* ---------- G4: Freigeben stellt die Rechnung ---------- */
  async function freigabeStellt() {
    const { db, stunde, um } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      srv();
      assert.ok(freigaben.REGISTRY.has('rechnung'), 'server.js traegt die Art rechnung nicht ein');
      const d = dienst(db);
      const k = mitKunde(db);
      // Als Lead: stelleRechnung macht ihn zum Kunden (wie POST /api/rechnung).
      db.prepare("UPDATE kontakte SET status = 'lead' WHERE id = ?").run(k.id);
      manuell(db);
      const n = await d.frage({ text: 'Rechnung für Kunde', kanal: 'cockpit' });
      const f = offene(db)[0];
      assert.ok(f && f.ausfuehrbar, 'Freigabe nicht ausfuehrbar');
      const vorher = anzahl(db);
      const e = await freigaben.entscheide(db, f.id, { wahl: 'ok' });
      assert.strictEqual(e.status, 'erledigt');
      assert.strictEqual(anzahl(db), vorher + 1, 'genau eine neue Rechnung');
      const inv = rechnung.lade(db, e.ergebnis.nr);
      assert.ok(inv, 'Ergebnis ohne Nummer: ' + JSON.stringify(e.ergebnis));
      nah(inv.brutto_eur, n.szene.brutto, 'gestellt = gezeigt');
      nah(e.ergebnis.brutto_eur, inv.brutto_eur, 'Ergebnis-Betrag');
      assert.ok(Array.isArray(e.ergebnis.erechnung_fehlt), 'erechnung_fehlt fehlt (nicht ueber stelleRechnung?)');
      assert.strictEqual(inv.kontakt_id, k.id);
      assert.strictEqual(kontakte.lade(db, k.id).status, 'kunde', 'Kontakt nicht zum Kunden gemacht');
      // Manuelle Zeit ist mitgestellt und gesperrt.
      assert.ok(inv.positionen.some((p) => p.typ === 'zeit'), 'manuelle Zeit fehlt auf der Rechnung');
      assert.strictEqual(zeit.liste(db, { status: 'offen' }).length, 0, 'Eintrag noch offen');
      assert.ok(db.prepare("SELECT COUNT(*) AS n FROM aktion_log WHERE art = 'rechnung:ok'").get().n === 1, 'aktion_log fehlt');
      // Plausibel: 2 h Claude + 1,5 h manuell; brutto = netto × 1,19.
      nah(inv.brutto_eur, rechnung.rund2(inv.netto_eur * 1.19), 'USt 19 %');

      // Abweichung: nach dem Entwurf kommt Arbeit dazu -> 409, nichts gestellt, keine Nummer verbraucht.
      stunde('s-4', um(15), 'Kunde', 'ABC-4');
      await d.frage({ text: 'Rechnung für ABC-4', kanal: 'cockpit' });
      const g = offene(db).find((x) => x.bezug === 'ABC-4');
      assert.ok(g, 'kein Entwurf fuer ABC-4');
      stunde('s-5', um(17), 'Kunde', 'ABC-4');
      const laufnr = db.prepare('SELECT MAX(laufnr) AS m FROM invoices').get().m;
      const z = anzahl(db);
      // Die Herleitung des Entwurfs sagt es vorher.
      const hg = herleitung.herleitung(db, 'rechnung', 'F' + g.id);
      assert.ok(hg.veraltet && /geändert/.test(hg.titel), 'Herleitung zeigt die Abweichung nicht: ' + hg.titel);
      await assert.rejects(freigaben.entscheide(db, g.id, { wahl: 'ok' }), (err) => err.status === 409 && /geaendert/.test(err.message) && /Neuen Entwurf anfordern: „Rechnung für ABC-4“/.test(err.message));
      assert.strictEqual(anzahl(db), z, 'trotz Abweichung gestellt');
      assert.strictEqual(db.prepare('SELECT MAX(laufnr) AS m FROM invoices').get().m, laufnr, 'Nummer verbraucht');
      assert.strictEqual(db.prepare('SELECT status FROM freigabe WHERE id = ?').get(g.id).status, 'offen', 'Freigabe nicht wieder offen');
      // Ohne erwarteten Betrag stellt die Registry nichts.
      const h = freigaben.anlegen(db, { art: 'rechnung', bezug: 'ohne', titel: 'ohne Betrag', quelle: 'cira', nutzlast: { ...g.nutzlast, erwartetBrutto: undefined } });
      await assert.rejects(freigaben.entscheide(db, h.id, { wahl: 'ok' }), /ohne erwarteten Betrag/);
      assert.strictEqual(anzahl(db), z);
      // Aktion gelaufen, Status nicht speicherbar: "fehler", nie zurueck auf "offen".
      freigaben.registriere('test_c4', () => { db.exec("CREATE TRIGGER c4_sperre BEFORE UPDATE ON freigabe WHEN NEW.status = 'erledigt' BEGIN SELECT RAISE(ABORT, 'kaputt'); END"); return { nr: 'X' }; });
      try {
        const t = freigaben.anlegen(db, { art: 'test_c4', titel: 'Haengt', quelle: 'cira' });
        const alt = console.error; console.error = () => {};
        try { await assert.rejects(freigaben.entscheide(db, t.id, { wahl: 'ok' }), (err) => err.status === 500 && /Nicht erneut auslösen/.test(err.message)); } finally { console.error = alt; }
        assert.strictEqual(db.prepare('SELECT status FROM freigabe WHERE id = ?').get(t.id).status, 'fehler');
      } finally { db.exec('DROP TRIGGER IF EXISTS c4_sperre'); freigaben.REGISTRY.delete('test_c4'); }
    });
  }

  /* ---------- G5: Herleitung Rechnung ---------- */
  const col = (g, c) => g.knoten.filter((x) => x.col === c);
  function pruefeGraph(g) {
    assert.ok(g.titel && g.schritte.length === 3 && g.knoten.length && g.links.length, JSON.stringify(g));
    for (const [a, b] of g.links) assert.ok(g.knoten[a] && g.knoten[b] && g.knoten[a].col < g.knoten[b].col, 'Link ' + a + '->' + b + ' falsch');
    for (const c of [0, 1, 2]) assert.ok(col(g, c).length >= 1 && col(g, c).length <= 5, 'Spalte ' + c + ': ' + col(g, c).length + ' Knoten');
    for (const k of g.knoten) assert.ok(['quelle', 'satz', 'teil', 'ergebnis', 'kosten', 'info'].includes(k.c), 'Farbe ' + k.c);
  }
  async function herleitungRechnung() {
    const { db } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      srv();
      const d = dienst(db);
      const k = mitKunde(db);
      const e = manuell(db);
      await d.frage({ text: 'Rechnung für Kunde', kanal: 'cockpit' });
      const f = offene(db)[0];
      // Entwurf: Teile summieren sich auf den Cent zum Netto der Vorschau.
      const v = rechnung.vorschau(db, f.nutzlast);
      let g = herleitung.herleitung(db, 'rechnung', 'F' + f.id);
      pruefeGraph(g);
      nah(col(g, 1).reduce((s, x) => s + x.wert, 0), v.netto_eur, 'Entwurf: Teile = Netto');
      nah(col(g, 2)[0].wert, v.netto_eur, 'Entwurf: Netto');
      nah(col(g, 2)[0].brutto, v.brutto_eur, 'Entwurf: Brutto');
      assert.ok(col(g, 0).some((x) => x.k === 'Zeiterfassung'), 'Quelle Zeiterfassung fehlt');
      assert.ok(col(g, 1).some((x) => x.k === v.positionen.find((p) => p.typ === 'zeit').bezeichnung.slice(0, 60)), 'manuelle Zeit nicht als eigener Teil');
      // Nach dem Freigeben zeigt der Entwurf die gestellte Rechnung.
      const erg = (await freigaben.entscheide(db, f.id, { wahl: 'ok' })).ergebnis;
      assert.ok(herleitung.herleitung(db, 'rechnung', 'F' + f.id).titel.includes(erg.nr));
      // Gestellt mit mehr Positionen als Platz: Rest als ein Knoten, Summe stimmt weiter.
      const t3 = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-3');
      const posten = [1, 2, 3, 4].map((i) => ({ bezeichnung: 'Pauschale ' + i, typ: 'pauschal', betrag_eur: 10.01 * i }));
      const inv = rechnung.erstelle(db, { from: t3.first_day, to: t3.last_day, tickets: ['ABC-3'], posten, kontaktId: k.id, empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1'] } });
      assert.strictEqual(inv.positionen.length, 5);
      g = herleitung.herleitung(db, 'rechnung', inv.nr);
      pruefeGraph(g);
      assert.strictEqual(col(g, 1).length, 4, 'drei Positionen plus Rest');
      nah(col(g, 1).reduce((s, x) => s + x.wert, 0), inv.netto_eur, 'Gestellt: Teile = Netto');
      nah(col(g, 2)[0].wert, inv.netto_eur, 'Gestellt: Netto');
      nah(col(g, 2)[0].brutto, inv.brutto_eur, 'Gestellt: Brutto');
      assert.ok(e.id > 0);
      assert.throws(() => herleitung.herleitung(db, 'rechnung', '2099-9999'), (err) => err.status === 404);
      assert.throws(() => herleitung.herleitung(db, 'rechnung', 'F99999'), (err) => err.status === 404);
    });
  }

  /* ---------- G6: Marge, Arbeitswert, Offene Posten ---------- */
  async function herleitungWerte() {
    // Kein Modell: die Herleitung haengt nicht an cira.js.
    assert.ok(!/require\(['"]\.\/cira['"]\)/.test(fs.readFileSync(path.join(W, 'herleitung.js'), 'utf8')), 'herleitung.js laedt cira.js');
    const { db } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      const k = mitKunde(db);
      manuell(db);
      // Marge eines Vorgangs: dieselben Werte wie /api/ticket (metrics.mehrwert mit abgerechnetFuerVorgang).
      const row = metrics.byTicket(db, { ticket: 'ABC-2' })[0];
      const w = metrics.mehrwert(row, rechnung.abgerechnetFuerVorgang(db, 'ABC-2'));
      let g = herleitung.herleitung(db, 'marge', 'ABC-2');
      pruefeGraph(g);
      nah(col(g, 2)[0].wert, w.marge_prozent, 'Marge %');
      nah(g.knoten.find((x) => x.k === 'Erlös').wert, w.erloes, 'Erloes');
      nah(g.knoten.find((x) => x.k === 'Deckungsbeitrag').wert, w.deckungsbeitrag, 'Deckungsbeitrag');
      nah(g.knoten.find((x) => x.k === 'Zeitkosten').wert, w.zeitkosten, 'Zeitkosten');
      // Plausibel: Dienstleistung mit Selbstkostensatz 30 € — Marge unter 100 %, ueber -100 %.
      assert.ok(w.marge_prozent > -100 && w.marge_prozent < 100, 'Marge unplausibel: ' + w.marge_prozent);
      // Zeitraum: dieselbe Marge wie die Kennzahlen des Monats.
      const h = new Date();
      const o = { from: tag(new Date(h.getFullYear(), h.getMonth(), 1)), to: tag(new Date(h.getFullYear(), h.getMonth() + 1, 0)) };
      const kz = metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
      g = herleitung.herleitung(db, 'marge', o.from + '_' + o.to);
      nah(col(g, 2)[0].wert, kz.wert.marge_prozent, 'Marge Monat');
      assert.throws(() => herleitung.herleitung(db, 'marge', '2026-13-01_2026-12-31'), (err) => err.status === 400);
      // Arbeitswert: Teile = Arbeitswert, mit manueller Zeit.
      g = herleitung.herleitung(db, 'arbeitswert', 'ABC-2');
      pruefeGraph(g);
      assert.strictEqual(col(g, 1).length, 2, 'Claude- und manueller Teil');
      nah(col(g, 1).reduce((s, x) => s + x.wert, 0), row.arbeitswert, 'Teile = Arbeitswert');
      nah(col(g, 2)[0].wert, row.arbeitswert, 'Arbeitswert');
      assert.ok(row.arbeitswert_manuell > 0 && row.arbeitswert > row.arbeitswert_claude, 'Saat ohne manuellen Anteil');
      // Offene Posten: Summe der Reste aus rechnung.liste.
      for (const t of ['ABC-1', 'ABC-2']) {
        const r = metrics.byTicket(db, {}).find((x) => x.ticket === t);
        rechnung.erstelle(db, { from: r.first_day, to: r.last_day, tickets: [t], kontaktId: k.id, empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1'] } });
      }
      // Nach dem Stellen ist der Erloes die Rechnung (nur Claude-Zeit), nicht mehr der Arbeitswert mit manueller Zeit.
      const w2 = metrics.mehrwert(metrics.byTicket(db, { ticket: 'ABC-2' })[0], rechnung.abgerechnetFuerVorgang(db, 'ABC-2'));
      const g2 = herleitung.herleitung(db, 'marge', 'ABC-2');
      assert.ok(w2.erloes_ist_rechnung && Math.abs(w2.erloes - row.arbeitswert) > 0.005, 'Saat: Rechnung ohne manuelle Zeit');
      nah(g2.knoten.find((x) => x.k === 'Erlös').wert, w2.erloes, 'Erloes nach Rechnung');
      nah(col(g2, 2)[0].wert, w2.marge_prozent, 'Marge % nach Rechnung');
      const nr = rechnung.liste(db)[0].nr;
      rechnung.bucheZahlung(db, { nr, datum: tag(new Date()), betrag_eur: 5 });
      const offen = rechnung.liste(db).filter((r) => r.status === 'erstellt' && r.rest_eur > 0);
      g = herleitung.herleitung(db, 'offene-posten', '');
      pruefeGraph(g);
      nah(col(g, 2)[0].wert, offen.reduce((s, r) => s + r.rest_eur, 0), 'Offene Posten');
      nah(col(g, 1).reduce((s, x) => s + x.wert, 0), col(g, 2)[0].wert, 'Teile = Summe');
      assert.ok(col(g, 1).some((x) => x.k === nr + ' offen' && Math.abs(x.wert - (rechnung.liste(db).find((r) => r.nr === nr).rest_eur)) < 0.005), 'Teilzahlung nicht abgezogen');
      assert.throws(() => herleitung.herleitung(db, 'arbeitswert', 'NOPE-1'), (err) => err.status === 404);
    });
  }

  /* ---------- G7: Route und Szenen-Bezug ---------- */
  function leseKoerper(req, fertig) { let roh = ''; req.on('data', (s) => { roh += s; }); req.on('end', () => { try { fertig(null, JSON.parse(roh || '{}')); } catch { fertig('Ungueltige Daten'); } }); }
  const sendJson = (res, dd, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(dd)); };
  async function route() {
    const { db, stunde } = arbeitsDb();
    await mitConfig(RECHNUNG, async () => {
      srv();
      const d = dienst(db);
      const k = mitKunde(db);
      // Zwei abgeschlossene Wochen fuer die Marge-Kurve, eine ueberfaellige Rechnung.
      const h = new Date();
      for (const tage of [10, 17]) stunde('s-w' + tage, new Date(h.getFullYear(), h.getMonth(), h.getDate() - tage, 9, 0).getTime(), 'Kunde', 'ABC-9');
      const t1 = metrics.byTicket(db, {}).find((x) => x.ticket === 'ABC-1');
      const inv = rechnung.erstelle(db, { from: t1.first_day, to: t1.last_day, tickets: ['ABC-1'], kontaktId: k.id, empfaenger: { name: 'Nordwind GmbH', anschrift: ['Hafen 1'] } });
      db.prepare('UPDATE invoices SET faellig_am = ? WHERE nr = ?').run('2026-01-02', inv.nr);
      const s = http.createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (!d.routen(req, res, u.pathname, u, { sendJson, leseKoerper })) sendJson(res, { error: 'nicht hier' }, 404);
      });
      await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
      const hole = (q) => fetch('http://127.0.0.1:' + s.address().port + '/api/cira/herleitung?' + q);
      try {
        const r = await hole('art=rechnung&id=' + inv.nr);
        assert.strictEqual(r.status, 200);
        const g = await r.json();
        for (const key of ['titel', 'schritte', 'knoten', 'links']) assert.ok(key in g, key + ' fehlt');
        assert.strictEqual((await hole('art=foo&id=x')).status, 400);
        assert.strictEqual((await hole('art=rechnung&id=2099-9999')).status, 404);
        assert.strictEqual((await hole('art=marge&id=')).status, 400);
        assert.strictEqual((await hole('art=offene-posten')).status, 200);
        // Jede Szene traegt einen Bezug, der sich aufloesen laesst.
        for (const [frage, art] of [['Wie lief der Monat?', 'marge'], ['Was ist überfällig?', 'offene-posten'], ['Wie entwickelt sich die Marge?', 'marge'], ['Rechnung für ABC-2', 'rechnung']]) {
          const n = await d.frage({ text: frage, kanal: 'cockpit' });
          const b = n.szene && n.szene.herleitung;
          assert.ok(b && b.art === art, frage + ': ' + JSON.stringify(n.szene && n.szene.herleitung));
          const a = await hole('art=' + encodeURIComponent(b.art) + '&id=' + encodeURIComponent(b.id));
          assert.strictEqual(a.status, 200, frage + ': ' + (await a.text()));
        }
        // Marge-Kurve: Bezug ist die letzte Woche mit Marge, Montag bis Sonntag.
        const m = await d.frage({ text: 'Wie entwickelt sich die Marge?', kanal: 'cockpit' });
        const [von, bis] = m.szene.herleitung.id.split('_');
        assert.strictEqual(von, m.szene.punkte.filter((p) => p.v != null).pop().x);
        assert.strictEqual((new Date(bis + 'T12:00:00') - new Date(von + 'T12:00:00')) / 864e5, 6, 'Woche nicht Montag bis Sonntag');
      } finally { await new Promise((ok) => { s.closeAllConnections(); s.close(ok); }); }
    });
  }

  /* ---------- G8: Skills je Arbeitsbereich ---------- */
  async function skills() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c4-skills-'));
    const skill = (ordner, name, mitDatei = true) => { fs.mkdirSync(path.join(ordner, name), { recursive: true }); if (mitDatei) fs.writeFileSync(path.join(ordner, name, 'SKILL.md'), '---\nname: ' + name + '\n---\n'); };
    const glob = path.join(tmp, 'claude');
    const proj = path.join(tmp, 'projekt');
    skill(path.join(glob, 'skills'), 'debug');
    skill(path.join(glob, 'skills'), 'plan-mode');
    skill(path.join(glob, 'skills'), 'kaputt', false);
    skill(path.join(proj, '.claude', 'skills'), 'plan-mode');
    skill(path.join(proj, '.claude', 'skills'), 'council-review');
    const S = srv();
    const altEnv = process.env.CLAUDE_CONFIG_DIR;
    const lauscht = S.server.listening;
    if (!lauscht) await new Promise((ok) => S.server.listen(0, '127.0.0.1', ok));
    const hole = (q) => fetch('http://127.0.0.1:' + S.server.address().port + '/api/cira/skills' + q);
    try {
      process.env.CLAUDE_CONFIG_DIR = glob;
      await mitConfig({ arbeitsbereiche: [{ name: 'Proj', kuerzel: 'P', pfad: proj, art: 'projekt' }, { name: 'Leer', pfad: path.join(tmp, 'gibtsnicht'), art: 'neutral' }] }, async () => {
        let r = await (await hole('')).json();
        assert.strictEqual(r.arbeitsbereich, 'Proj');
        assert.deepStrictEqual(r.arbeitsbereiche, ['Proj', 'Leer']);
        assert.deepStrictEqual(r.skills, [{ name: 'council-review', quelle: 'projekt' }, { name: 'plan-mode', quelle: 'projekt' }, { name: 'debug', quelle: 'global' }]);
        // Fehlender Projektordner: nur die globalen, kein Fehler.
        r = await (await hole('?arbeitsbereich=Leer')).json();
        assert.deepStrictEqual(r.skills.map((x) => x.name), ['debug', 'plan-mode']);
        assert.strictEqual((await hole('?arbeitsbereich=Fremd')).status, 404);
        // Ohne Claude Code (kein Ordner): leere Liste, 200.
        process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'ohne-claude');
        const o = await hole('?arbeitsbereich=Leer');
        assert.strictEqual(o.status, 200);
        assert.deepStrictEqual((await o.json()).skills, []);
      });
      await mitConfig({ arbeitsbereiche: undefined }, async () => {
        process.env.CLAUDE_CONFIG_DIR = glob;
        const r = await (await hole('')).json();
        assert.strictEqual(r.arbeitsbereich, null);
        assert.deepStrictEqual(r.skills.map((x) => x.quelle), ['global', 'global']);
      });
    } finally {
      if (altEnv === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = altEnv;
      if (!lauscht) await new Promise((ok) => S.server.close(ok));
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  /* ---------- G9: Benachrichtigung ---------- */
  function benachrichtigung() {
    configGeschuetzt(() => {
      const S = srv();
      const cfg = require(CFG);
      const altCira = cfg.cira;
      cfg.cira = { ...(altCira || {}) };
      delete cfg.cira.benachrichtigungDesktop;
      try {
        assert.strictEqual(S.ciraEinstellungen().benachrichtigungDesktop, false, 'Standard nicht aus');
        assert.strictEqual(S.CIRA_FELDER.benachrichtigungDesktop.art, 'bool');
        for (const boese of ['ja', 1, null]) assert.throws(() => S.setzeCira({ benachrichtigungDesktop: boese }), /ja oder nein/, 'nimmt ' + JSON.stringify(boese));
        assert.strictEqual(S.setzeCira({ benachrichtigungDesktop: true }).benachrichtigungDesktop, true);
        assert.strictEqual(JSON.parse(fs.readFileSync(CFG, 'utf8')).cira.benachrichtigungDesktop, true);
      } finally { cfg.cira = altCira; }
    });
    const bsp = JSON.parse(fs.readFileSync(path.join(W, 'config.example.json'), 'utf8'));
    assert.strictEqual(bsp.cira.benachrichtigungDesktop, false, 'config.example.json ohne benachrichtigungDesktop: false');
    // Das Ereignis traegt, was die Karte im Browser zeigt.
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    const gehoert = [];
    const hoer = (e) => gehoert.push(e);
    ereignisse.bus.on('ereignis', hoer);
    try {
      freigaben.anlegen(db, { art: 'flow_fehler', bezug: 'f1', titel: 'Mahnlauf gescheitert', quelle: 'cira' });
    } finally { ereignisse.bus.off('ereignis', hoer); }
    const e = gehoert.find((x) => x.art === 'freigabe');
    assert.ok(e, 'kein Freigabe-Ereignis');
    assert.deepStrictEqual([e.daten.art, e.daten.titel, e.daten.bezug, e.daten.status], ['flow_fehler', 'Mahnlauf gescheitert', 'f1', 'offen']);
  }

  return [
    ['Cira C4 Rechnung: Ziel, Nutzlast, Ersetzen, Ablehnen', rechnungsZiel],
    ['Cira C4 Rechnung: Teilabrechnung ab dem Folgetag, Auslassung genannt', teilabrechnung],
    ['Cira C4 Freigabe: stellt echte Rechnung, 409 bei Abweichung', freigabeStellt],
    ['Cira C4 Herleitung Rechnung: Teile = Netto auf den Cent', herleitungRechnung],
    ['Cira C4 Herleitung Werte: Marge, Arbeitswert, Offene Posten', herleitungWerte],
    ['Cira C4 Route: /api/cira/herleitung und Szenen-Bezug', route],
    ['Cira C4 Skills: global und Projekt je Arbeitsbereich', skills],
    ['Cira C4 Benachrichtigung: Einstellung und Ereignis', benachrichtigung],
  ];
};
