'use strict';
// Block P Task 1: lesende Projekt-Endpunkte (rechnungenJeProjekt, projektAntwort, projekteAntwort).
// Fixture-Datenbank im Speicher, nie die echte.
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = ({ dbmod, openDbs }) => {
  const P = 'Seiten-Projekt';
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };
  const R = () => require('../../rechnung');

  function claude(db, tag, { projekt = P, ticket = null, stunden = 3, sid = 's-' + tag } = {}) {
    const ein = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
    for (let m = 0; m <= stunden * 60; m += 2) ein.run(sid, new Date(Date.parse(tag + 'T08:00:00Z') + m * 60000).toISOString(), projekt, 'main', ticket, tag);
    db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
      VALUES (?,?,?,?,?,?,?,10,10,0,0,0,0,0.1,0,?)`).run('r-' + sid + tag, tag + 'T08:00:00.000Z', sid, projekt, 'main', ticket, 'claude-opus-5', tag);
  }
  function manuell(db, tag, min, projekt = P) {
    return db.prepare(`INSERT INTO zeit_eintrag (ziel_art, ziel_schluessel, start, ende, tag, taetigkeit, abrechenbar,
      rohzeit_min, gezaehlt_min, created_at) VALUES ('projekt', ?, ?, ?, ?, 'Beratung', 1, ?, ?, ?)`)
      .run(projekt, tag + 'T12:00:00.000Z', new Date(Date.parse(tag + 'T12:00:00.000Z') + min * 60000).toISOString(), tag, min, min, tag).lastInsertRowid;
  }
  let lauf = 0;
  function rechnungMit(db, positionen) {
    const nr = '2026-' + String(++lauf).padStart(4, '0');
    db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis, empfaenger, aussteller, positionen,
      netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, status)
      VALUES (?, 2026, ?, '2026-09-17', '2026-09-01', '2026-09-16', '{}', '{}', ?, 0, 0, 0, 0, 1, 'erstellt')`)
      .run(nr, lauf, JSON.stringify(positionen));
    return nr;
  }
  const projektPos = (stunden, projekt = P) => ({ ticket: projekt, ohne_vorgangsnummer: true, stunden, betrag_eur: stunden * 100 });
  // 6 h Claude an zwei Tagen + 2 h manuell = 8 h geleistet
  function standard() {
    const db = neueDb();
    claude(db, '2026-08-18'); claude(db, '2026-08-19'); manuell(db, '2026-08-20', 120);
    return db;
  }
  const srv = () => require('../../server');

  function rechnungenJeProjekt() {
    const db = standard();
    const a = rechnungMit(db, [
      projektPos(5),
      { typ: 'zeit', ticket: 'XY-1', stunden: 2, betrag_eur: 200 },     // Vorgangsposition: zaehlt nicht
      projektPos(3, 'anderes'),                                          // anderes Projekt: zaehlt nicht
    ]);
    const b = rechnungMit(db, [projektPos(1)]);
    rechnungMit(db, [{ typ: 'zeit', ticket: 'XY-1', stunden: 4, betrag_eur: 400 }]);   // keine Projektposition: fehlt in der Liste
    R().storniere(db, b);

    const z = R().rechnungenJeProjekt(db, P);
    // A (erstellt), B (storniert) und die Gegenrechnung zu B (storno), nicht die reine Vorgangsrechnung.
    assert.deepStrictEqual(z.map((r) => r.status).sort(), ['erstellt', 'storniert', 'storno']);
    const za = z.find((r) => r.nr === a);
    assert.strictEqual(za.stunden, 5, 'Vorgangs- und Fremdprojektposition duerfen nicht mitzaehlen');
    assert.strictEqual(za.betrag_eur, 500);
    assert.strictEqual(z.find((r) => r.nr === b).stunden, 1);
    const storno = z.find((r) => r.status === 'storno');
    assert.strictEqual(storno.storno_von, b);
    assert.deepStrictEqual(Object.keys(za).sort(), ['betrag_eur', 'erstellt_am', 'nr', 'status', 'storno_von', 'stunden']);
    // Gegenprobe auf zweitem Weg: gueltige Rechnungen = berechnet_h des Kontos.
    const gueltig = z.filter((r) => r.status === 'erstellt').reduce((s, r) => s + r.stunden, 0);
    assert.strictEqual(gueltig, R().projektKonto(db, P, '2026-12-31').berechnet_h);
    assert.deepStrictEqual(R().rechnungenJeProjekt(db, 'gibt-es-nicht'), []);
    assert.strictEqual(R().rechnungenJeProjekt(db, 'anderes').length, 1);
  }

  function projektForm() {
    const db = standard();
    claude(db, '2026-08-25', { ticket: 'XY-1', stunden: 1, sid: 's-v' });
    rechnungMit(db, [projektPos(5)]);
    const { projektAntwort } = srv();
    assert.strictEqual(projektAntwort(db, '').status, 400);
    assert.strictEqual(projektAntwort(db, null).status, 400);
    assert.strictEqual(projektAntwort(db, 'gibt-es-nicht').status, 404);
    assert.strictEqual(projektAntwort(db, '__proto__').status, 404);

    const to = '2026-12-31';
    const r = projektAntwort(db, P, { from: '2026-08-19', to });
    assert.strictEqual(r.status, 200);
    const b = r.body;
    for (const k of ['name', 'overhead', 'konto', 'kontakt', 'saetze', 'arbeitsbereich', 'zeitraum', 'vorgaenge', 'abrechnung', 'einheiten', 'zeit_eintraege', 'rechnungen', 'verlauf']) {
      assert.ok(k in b, 'Schluessel fehlt: ' + k);
    }
    for (const k of ['from', 'to', 'projekt', 'ohne_vorgang']) assert.ok(k in b.zeitraum, 'zeitraum.' + k);
    for (const k of ['standard', 'eintrag', 'wirksam']) assert.ok(k in b.saetze, 'saetze.' + k);
    assert.strictEqual(b.saetze.standard, require('../../config.json').stundensatz);
    assert.strictEqual(b.saetze.eintrag, null, 'ohne eigenen Satz kein Eintrag');
    assert.strictEqual(b.saetze.wirksam.satz, require('../../metrics').satzFuerProjekt(P).satz);
    // Konto: 8 h geleistet, 5 h berechnet -> 3 h offen (Laufzeit bis `to`, nicht der Zeitraum ab `from`).
    assert.strictEqual(b.konto.offen_h, 3);
    const konten = R().projektKonten(db, [{ ticket: null, art: 'projekt', gruppe: P }], { to });
    assert.strictEqual(b.konto.offen_h, R().projektKontenAnzeige(konten, [])[P].offen_h);
    assert.strictEqual(b.konto.nummern.length, 1);
    // Vorgang des Projekts mit Wert, wie /api/summary.
    assert.deepStrictEqual(b.vorgaenge.map((t) => t.ticket), ['XY-1']);
    assert.strictEqual(typeof b.vorgaenge[0].wert, 'object');
    // Einheiten ab `from`: der 18. faellt weg, der 19. (Claude) und der 20. (manuell) bleiben.
    assert.deepStrictEqual(b.einheiten.map((e) => e.tag), ['2026-08-19', '2026-08-20']);
    assert.strictEqual(b.zeit_eintraege.length, 1);
    assert.strictEqual(b.rechnungen.length, 1);
    assert.strictEqual(b.zeitraum.projekt.project, P);
    assert.ok(Array.isArray(b.verlauf) && b.verlauf.length > 0);
    // Zeitraum ohne Arbeit: Projekt bleibt bekannt, Zeitraumblock leer.
    const leer = projektAntwort(db, P, { from: '2030-01-01', to: '2030-01-31' });
    assert.strictEqual(leer.status, 200);
    assert.strictEqual(leer.body.zeitraum.projekt, null);
    assert.deepStrictEqual(leer.body.vorgaenge, []);
  }

  function projekteListe() {
    const db = standard();
    claude(db, '2026-08-21', { projekt: '(cira)', sid: 's-w' });          // Werkzeugprojekt
    claude(db, '2026-08-21', { projekt: '(test)', sid: 's-t' });          // Wegwerf-Ordner
    claude(db, '2026-08-21', { projekt: '(unbekannt)', sid: 's-u' });      // Sammeleimer
    claude(db, '2026-08-21', { projekt: 'Nur-Vorgaenge', ticket: 'ZZ-9', sid: 's-n' });
    rechnungMit(db, [projektPos(5)]);
    db.prepare('INSERT INTO projekt_kontakt (projekt, kontakt_id) VALUES (?, ?)').run(P, 7);
    const config = require('../../config.json');
    const merk = config.arbeitsbereiche;
    config.arbeitsbereiche = [{ name: 'Bereich-A', kuerzel: 'ba', farbe: '#112233', art: 'projekt', projekt: P, jiraProjekt: 'AB' }];
    let l;
    try { l = srv().projekteAntwort(db); } finally { if (merk === undefined) delete config.arbeitsbereiche; else config.arbeitsbereiche = merk; }
    assert.strictEqual(l.status, 200);
    const je = Object.fromEntries(l.body.map((x) => [x.name, x]));
    assert.ok(!('(unbekannt)' in je), 'Sammeleimer ist kein Projekt');
    assert.strictEqual(je['(cira)'].overhead, true);
    assert.strictEqual(je['(cira)'].konto, null);
    assert.strictEqual(je['(test)'].overhead, true);
    assert.strictEqual(je['(test)'].konto, null);
    assert.strictEqual(je[P].overhead, false);
    assert.strictEqual(je[P].konto.offen_h, 3);
    assert.strictEqual(je[P].kontakt.id, 7);
    assert.deepStrictEqual(je[P].arbeitsbereich, { name: 'Bereich-A', kuerzel: 'BA', farbe: '#112233', jiraProjekt: 'AB' });
    assert.strictEqual(typeof je[P].satz.satz, 'number');
    assert.ok(je['Nur-Vorgaenge'], 'Projekt nur mit Vorgang fehlt');
    assert.strictEqual(je['Nur-Vorgaenge'].kontakt, null);
    assert.strictEqual(je['Nur-Vorgaenge'].arbeitsbereich, null);
    assert.strictEqual(new Set(l.body.map((x) => x.name)).size, l.body.length, 'Namen doppelt');
  }

  // ueber_h wie /api/summary: Ueberhang unter der Toleranz (R3) zeigt 0, darueber den Wert. Referenz ist
  // der Summary-Pfad selbst (kennzahlen().ueberhang -> projektKontenAnzeige), nicht ein eigener Vergleich.
  function kontoWieSummary() {
    const metrics = require('../../metrics');
    const zeit = require('../../zeit');
    const Q = 'Ueber-Projekt';
    const db = standard();
    claude(db, '2026-08-25', { projekt: Q, sid: 's-q1' }); claude(db, '2026-08-26', { projekt: Q, sid: 's-q2' });   // 6 h
    const zeitPos = (ziel, h) => ({ typ: 'zeit', ziel_art: 'projekt', ziel, stunden: h, betrag_eur: h * 100 });
    // P: 8 h geleistet, 2 x 4,005 h = 8,01 h berechnet -> 0,01 h Ueberhang, Toleranz bei 2 Zeitpositionen 0,01
    rechnungMit(db, [zeitPos(P, 4.005), zeitPos(P, 4.005)]);
    // Q: 6 h geleistet, 6,5 h berechnet -> 0,5 h, klar darueber
    rechnungMit(db, [zeitPos(Q, 6.5)]);
    assert.ok(R().projektKonto(db, P).ueber_h > 0, 'Fixture: roher Ueberhang an P');
    const o = {};
    const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
    const konten = R().projektKonten(db, zeilen, o);
    const kz = metrics.kennzahlen(zeilen, R().abrechnung(db), { ...zeit.kennzahlenZusatz(db, o), projektKonto: konten });
    const erwartet = R().projektKontenAnzeige(konten, kz.ueberhang);
    assert.strictEqual(erwartet[P].ueber_h, 0);
    assert.strictEqual(erwartet[Q].ueber_h, 0.5);
    const { projektAntwort, projekteAntwort } = srv();
    const liste = Object.fromEntries(projekteAntwort(db).body.map((x) => [x.name, x.konto]));
    for (const n of [P, Q]) {
      assert.deepStrictEqual(projektAntwort(db, n, {}).body.konto, erwartet[n], '/api/projekt ' + n);
      assert.deepStrictEqual(liste[n], erwartet[n], '/api/projekte ' + n);
    }
  }

  const heuteTag = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  // Ueberhang gibt es nur im Stand bis heute (R4): vergangenes `to` muss das sagen, sonst liest sich ueber_h 0 als "keiner".
  function kontoBisHeute() {
    const db = standard();
    claude(db, '2026-08-21', { projekt: '(cira)', sid: 's-w' });
    rechnungMit(db, [projektPos(9)]);   // 8 h geleistet, 9 h berechnet
    const { projektAntwort } = srv();
    const nimm = (o) => projektAntwort(db, P, o).body;
    assert.strictEqual(nimm({ to: heuteTag() }).konto_bis_heute, true, 'heute');
    assert.strictEqual(nimm({ to: heuteTag() }).konto.ueber_h, 1);
    assert.strictEqual(nimm({}).konto_bis_heute, true, 'ohne to');
    const alt = nimm({ to: '2026-09-01' });
    assert.strictEqual(alt.konto_bis_heute, false, 'vergangenes to');
    assert.strictEqual(alt.konto.ueber_h, 0, 'Fixture: die 0, die ohne das Flag falsch aussaehe');
    assert.strictEqual(projektAntwort(db, '(cira)', {}).body.konto_bis_heute, false, 'Werkzeug ohne Konto');
  }

  // Abrechnen-Weg: to = letzter_tag zeigt dieselbe Zahl wie die Uebersicht, ein frueheres Zeitraumende nicht. Und ein
  // Projekt ohne Offenes oder ohne Zeile im Zeitraum ist so im projekt_konto von /api/summary, wie der Editor es liest.
  function abrechnenGleicheZahl() {
    const metrics = require('../../metrics');
    const Q = 'Fertig-Projekt';
    const db = standard();
    claude(db, '2026-08-25', { projekt: Q, sid: 's-q' });   // 3 h
    rechnungMit(db, [projektPos(5), projektPos(3, Q)]);
    const uebersicht = srv().projekteAntwort(db).body.find((x) => x.name === P).konto.offen_h;
    const konto = (o) => {
      const konten = R().projektKonten(db, metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), o);
      return R().projektKontenAnzeige(konten, [], R().projektKontenRest(db, konten, o));
    };
    assert.strictEqual(uebersicht, 3);
    const heute = konto({ from: '2026-10-01', to: heuteTag() });   // Zeitraum ohne Arbeit: P kommt aus dem Rest (R12)
    assert.strictEqual(heute[P].offen_h, uebersicht, 'Stand heute');
    const bis = heute[P].letzter_tag;
    assert.strictEqual(konto({ from: bis, to: bis })[P].offen_h, uebersicht, 'Editor mit to = letzter_tag');
    assert.strictEqual(konto({ from: '2026-08-01', to: '2026-08-18' })[P].offen_h, 0, 'Zeitraumende im August: 3 h geleistet, 5 h berechnet');
    assert.ok(!Object.hasOwn(heute, Q), 'nichts offen: kein Eintrag, der Editor entfernt die Zeile');
    assert.ok(!Object.hasOwn(heute, 'gibt-es-nicht'), 'unbekanntes Projekt');
  }

  // letzter_tag begrenzt das Rechnungsende: das Konto bis dorthin ist das Konto ohne Grenze, in allen drei Antworten
  // dieselbe Form. Ohne Arbeit null, nicht '' (sonst liefe der Knopf mit leerem to).
  function letzterTag() {
    const db = standard();   // letzte Arbeit: 2026-08-20 (manuell), davor 2026-08-19 (Claude)
    rechnungMit(db, [projektPos(5)]);
    const X = '2026-08-20';
    const k = R().projektKonto(db, P);
    assert.strictEqual(k.letzter_tag, X);
    assert.strictEqual(R().projektKonto(db, P, X).offen_h, k.offen_h, 'Konto bis X gleich Konto ohne Grenze');
    assert.strictEqual(k.offen_h, 3);
    assert.strictEqual(R().projektKonto(db, P, '2026-08-19').letzter_tag, '2026-08-19', 'Grenze zieht den letzten Tag mit');
    assert.strictEqual(R().projektKonto(db, 'gibt-es-nicht').letzter_tag, null);
    const { projektAntwort, projekteAntwort } = srv();
    assert.strictEqual(projektAntwort(db, P, {}).body.konto.letzter_tag, X, '/api/projekt');
    assert.strictEqual(projektAntwort(db, P, { to: '2026-08-19' }).body.konto.letzter_tag, '2026-08-19', '/api/projekt bis Zeitraumende');
    assert.strictEqual(projekteAntwort(db).body.find((x) => x.name === P).konto.letzter_tag, X, '/api/projekte');
  }

  // Warum der Link bis letzter_tag geht: der Kopf verkuerzt `to` nie, ein spaeteres stuende auf der Rechnung (par. 14 UStG).
  function kopfEndetAmLetztenTag() {
    const config = require('../../config.json');
    const merk = config.rechnung;
    config.rechnung = {
      aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '', bank: 'Testbank', iban: 'DE00', bic: 'X' },
      kleinunternehmer: true, ustSatz: 19, zahlungszielTage: 14, chromePfad: '',
    };
    try {
      const db = standard();
      const X = R().projektKonto(db, P).letzter_tag;
      const kopf = (to) => R().vorschau(db, { from: X, to, projekte: [P], empfaenger: { name: 'Kunde', anschrift: 'Weg 1' } });
      assert.strictEqual(kopf(X).leistung_bis, X);
      assert.strictEqual(kopf(X).leistung_von, '2026-08-18', 'FIFO: der Kopf beginnt bei den Positionstagen');
      assert.strictEqual(kopf('2026-09-30').leistung_bis, '2026-09-30', 'Fixture: ein spaeteres to bleibt stehen');
    } finally { config.rechnung = merk; }
  }

  // Sortierung: byTicket liefert nach Kosten, die Projektseite nach Arbeitswert.
  function vorgaengeNachWert() {
    const metrics = require('../../metrics');
    const db = standard();
    claude(db, '2026-08-25', { ticket: 'XY-1', stunden: 1, sid: 's-a1' });
    claude(db, '2026-08-26', { ticket: 'XY-1', stunden: 1, sid: 's-a2' });   // 2 h, zwei Ereignisse: teurer
    claude(db, '2026-08-27', { ticket: 'XY-2', stunden: 3, sid: 's-b' });    // 3 h, ein Ereignis
    const o = { project: P };
    assert.deepStrictEqual(metrics.byTicket(db, o).map((t) => t.ticket), ['XY-1', 'XY-2'], 'Fixture: Kosten-Reihenfolge');
    const v = srv().projektAntwort(db, P, {}).body.vorgaenge;
    assert.deepStrictEqual(v.map((t) => t.ticket), ['XY-2', 'XY-1']);
    assert.ok(v[0].arbeitswert > v[1].arbeitswert && v[1].arbeitswert > 0, 'Arbeitswert absteigend und nicht 0');
  }

  // Der Zeitmodell-Chip liest ohne_vorgang[0].zeitmodell (byProject traegt keins).
  function zeitmodellOhneVorgang() {
    const b = srv().projektAntwort(standard(), P, {}).body;
    assert.ok(['eingaben', 'aktivitaet', 'gemischt'].includes(b.zeitraum.ohne_vorgang[0].zeitmodell), 'Zeitmodell: ' + b.zeitraum.ohne_vorgang[0].zeitmodell);
    assert.deepStrictEqual(srv().projektAntwort(standard(), P, { from: '2030-01-01', to: '2030-01-31' }).body.zeitraum.ohne_vorgang, [], 'keine Zeile: kein Chip');
  }

  // /api/board: bereiche[] tragen projekt und offen_n (Karten ausser Spalte erledigt, Server zaehlt).
  async function boardBereiche() {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const ordner = (text) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-p-')); fs.writeFileSync(path.join(d, 'TODO.md'), text); return d; };
    const a = ordner('# A\n- [ ] eins @id:A-1\n- [ ] zwei @id:A-2 @status:in-progress\n- [x] fertig @id:A-3\n');
    const b = ordner('# B\n- [x] nur fertig @id:B-1\n');
    const bereiche = [{ name: 'Bereich-A', pfad: a, kuerzel: 'AA', projekt: P }, { name: 'Bereich-B', pfad: b, kuerzel: 'BB' }];
    const db = neueDb();
    claude(db, '2026-08-18', { projekt: 'Bereich-Arbeit', ticket: 'A-1', stunden: 1 });   // nur A-1 hat Daten
    const dienst = require('../../board').erzeuge({ db, bereiche: () => bereiche, loeseHeim: (x) => x });
    const alle = (await dienst.board('alle', 'alle')).bereiche;
    const karten = Object.values((await dienst.board('alle', 'alle')).spalten).flatMap((x) => x.karten);
    assert.strictEqual(karten.find((k) => k.schluessel === 'A-1').hat_daten, true, 'Karte mit Aktivitaet');
    assert.strictEqual(karten.find((k) => k.schluessel === 'A-2').hat_daten, false, 'Karte ohne Aktivitaet');
    assert.strictEqual(alle.find((x) => x.name === 'Bereich-A').offen_n, 2, 'zwei offene Karten, die erledigte zaehlt nicht');
    assert.strictEqual(alle.find((x) => x.name === 'Bereich-B').offen_n, 0);
    assert.strictEqual(alle.find((x) => x.name === 'Bereich-A').projekt, P);
    assert.strictEqual(alle.find((x) => x.name === 'Bereich-B').projekt, null);
    // Nur ein Bereich geladen: der andere hat keine Zahl (null), nicht eine falsche 0.
    const einer = (await dienst.board('Bereich-A', 'alle')).bereiche;
    assert.strictEqual(einer.find((x) => x.name === 'Bereich-A').offen_n, 2);
    assert.strictEqual(einer.find((x) => x.name === 'Bereich-B').offen_n, null);
  }

  // ---- Task 8: Wegwerf-Ordner sind keine Projekte ----
  const ing = () => require('../../ingest');
  const tempFormen = () => {
    const kurz = os.tmpdir();
    return [...new Set([kurz, fs.realpathSync.native(kurz), process.env.TEMP, process.env.TMP].filter(Boolean))];
  };
  const langTemp = () => fs.realpathSync.native(os.tmpdir());

  function tempOrdner() {
    const { projectOf, CIRA_ORDNER, PROJECT_ROOTS } = ing();
    for (const w of tempFormen()) {
      assert.strictEqual(projectOf(w), '(test)', 'Wurzel ' + w);
      assert.strictEqual(projectOf(w + path.sep), '(test)', 'Wurzel mit Trenner ' + w);
      assert.strictEqual(projectOf(path.join(w, 'c2i-c5-live-abc')), '(test)', 'Unterordner ' + w);
      assert.strictEqual(projectOf(path.join(w, 'a', 'b', 'src').toUpperCase()), '(test)', 'Gross-/Kleinschreibung ' + w);
      assert.strictEqual(projectOf(path.join(w, 'a').replace(/\\/g, '/')), '(test)', 'Schraegstrich ' + w);
      // Vor dem Temp-Ordner: daran zaehlen die Cira-Kosten.
      assert.strictEqual(projectOf(path.join(w, 'c2i-sandbox-x', 'c2i-merken-Ab1')), '(cira)', 'merken ' + w);
    }
    assert.strictEqual(projectOf(CIRA_ORDNER), '(cira)');
    assert.strictEqual(projectOf(path.join(PROJECT_ROOTS[0], 'x', 'src')), 'x', 'normales Projekt');
    const lang = langTemp();
    // Feste Pfade: ein TEMP wie ...\Temp\2 machte einen aus os.tmpdir() gebauten Nachbarn selbst zu Temp.
    assert.notStrictEqual(projectOf('C:\\Users\\ABCDEF~1\\AppData\\Local\\Temporary\\x'), '(test)', 'nur aehnlicher Name');
    ing().TEMP_WURZELN.push('d:\\wegwerf');
    try {
      assert.strictEqual(projectOf('D:\\Wegwerf\\x'), '(test)', 'eigene Temp-Wurzel');
      assert.notStrictEqual(projectOf('D:\\Wegwerfer\\x'), '(test)', 'Wurzel ist nur Praefix des Namens');
    } finally { ing().TEMP_WURZELN.pop(); }
    assert.strictEqual(projectOf(''), '(unbekannt)');
    // Kurzform eines fremden Benutzers: steht in keiner Temp-Wurzel dieses Prozesses, gilt trotzdem.
    assert.ok(!tempFormen().some((w) => w.includes('ABCDEF~1')), 'Fixture: fremder Temp-Ordner');
    const fremd = 'C:\\Users\\ABCDEF~1\\AppData\\Local\\';
    assert.strictEqual(projectOf(fremd + 'Temp\\x'), '(test)', 'fremde Kurzform');
    assert.strictEqual(projectOf(fremd + 'Temp'), '(test)', 'Wurzel selbst');
    assert.strictEqual(projectOf('c:/users/abcdef~1/appdata/local/TEMP/x/y'), '(test)', 'Schreibweise');
    assert.notStrictEqual(projectOf(fremd + 'TempFoo\\x'), '(test)', 'nur aehnlicher Name');
    assert.notStrictEqual(projectOf('C:\\Users\\ABCDEF~1\\AppData\\Temp\\x'), '(test)', 'ohne Local');
    // Langform auch dort, wo das Muster nicht greift (verlegter Temp-Ordner, macOS: /var -> /private/var).
    assert.ok(ing().TEMP_WURZELN.includes(lang.replace(/\//g, '\\').toLowerCase()), 'Langform fehlt in den Wurzeln');
    // Eine Wurzel, die alles umfasst, darf nie gelten: TEMP=C:\ machte jedes Projekt zu (test).
    assert.deepStrictEqual(ing().tempWurzeln(['C:\\', 'C:', '/', '', null, undefined, 'C:\\Tmp\\', 'c:/tmp', '/var/tmp']), ['c:\\tmp', '\\var\\tmp']);
  }

  function projektAlias() {
    const { projectOf, PROJEKT_ALIAS, PROJECT_ROOTS, pruefeAlias } = ing();
    const r = PROJECT_ROOTS[0];
    const warnung = console.warn;
    const warnungen = [];
    console.warn = (t) => warnungen.push(t);
    try {
      assert.deepStrictEqual(pruefeAlias(undefined), {});
      assert.strictEqual(warnungen.length, 0, 'fehlender Alias warnt nicht');
      assert.deepStrictEqual(pruefeAlias({ alt: 'neu', zahl: 5, leer: '', blank: '  ', nichts: null }), { alt: 'neu' });
      assert.strictEqual(warnungen.length, 4, 'je ungueltigem Eintrag eine Warnung');
      for (const roh of [['x'], 'text', 7]) assert.deepStrictEqual(pruefeAlias(roh), {});
      assert.strictEqual(warnungen.length, 7, 'kein Objekt warnt');
    } finally { console.warn = warnung; }

    // Eigener Name: die Tests lesen eine Kopie der echten config.json, dort stehen echte Aliase.
    const alt = 'alias-probe-alt';
    assert.strictEqual(projectOf(path.join(r, alt, 'src')), alt, 'ohne Eintrag kein Alias');
    Object.assign(PROJEKT_ALIAS, { [alt]: 'ziel-projekt', 'ziel-projekt': 'zu-weit' });
    try {
      assert.strictEqual(projectOf(path.join(r, alt, 'src')), 'ziel-projekt', 'einstufig');
      assert.strictEqual(projectOf(path.join(r, 'constructor')), 'constructor', 'Prototyp-Schluessel');
      assert.strictEqual(projectOf(path.join(r, 'andere')), 'andere');
    } finally { delete PROJEKT_ALIAS[alt]; delete PROJEKT_ALIAS['ziel-projekt']; }
  }

  // Zeile in events und zwei in activity, wie ein Lauf in diesem Ordner sie hinterliess.
  let nz = 0;
  function zeile(db, sid, projekt, cwd, usd = 1) {
    const ts = new Date(Date.parse('2026-08-18T08:00:00Z') + (++nz) * 60000).toISOString();
    db.prepare(`INSERT INTO events (request_id, ts, session_id, project, cwd, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
      VALUES (?,?,?,?,?,'claude-opus-5',1,1,0,0,0,0,?,0,'2026-08-18')`).run('n-' + nz, ts, sid, projekt, cwd, usd);
    aktiv(db, sid, projekt, ts);
  }
  function aktiv(db, sid, projekt, ts = new Date(Date.parse('2026-08-19T08:00:00Z') + (++nz) * 60000).toISOString()) {
    const ein = db.prepare("INSERT INTO activity (session_id, ts, project, day) VALUES (?,?,?,'2026-08-18')");
    ein.run(sid, ts, projekt);
    ein.run(sid, new Date(Date.parse(ts) + 1000).toISOString(), projekt);
  }
  const projektVon = (db, tabelle, sid) => db.prepare(`SELECT DISTINCT project AS p FROM ${tabelle} WHERE session_id = ? AND project <> '(unbekannt)'`).all(sid).map((r) => r.p).join(',');
  const summe = (db) => db.prepare('SELECT SUM(cost_usd) AS u, COUNT(*) AS n FROM events').get();

  function nachzug() {
    const { PROJECT_ROOTS, PROJEKT_ALIAS } = ing();
    const { zieheProjekteNach } = require('../../backfill');
    const db = neueDb();
    const lang = langTemp();
    const w = PROJECT_ROOTS[0];
    zeile(db, 's-kurz', 'wegwerf-a', path.join(os.tmpdir(), 'wegwerf-a'));
    zeile(db, 's-lang', 'HeimOrdner', path.join(lang, 'scratch', 'b'));
    zeile(db, 's-heim', 'HeimOrdner', 'D:\\Anderswo\\Roaming-x\\c');                       // gleicher Name, kein Temp
    zeile(db, 's-normal', 'Normal', path.join(w, 'Normal', 'src'));
    zeile(db, 's-cira', '(cira)', path.join(lang, 'x'));                                   // gesetzt: bleibt
    zeile(db, 's-lokal', '(lokal)', path.join(lang, 'y'));
    zeile(db, 's-merken', 'HeimOrdner', path.join(lang, 'sandbox', 'c2i-merken-Ab1'));
    zeile(db, 's-frueher', 'alter-name', path.join(w, 'anderer-ordner'));                  // alte Zuordnung wandert nicht
    zeile(db, 's-alias', 'umbenannt', path.join(w, 'umbenannt'));
    zeile(db, 's-frueher2', 'auch-alt', path.join(w, 'umbenannt'));                        // Alias-Pfad, aber nicht das Alias-Paar
    aktiv(db, 's-nur-activity', 'umbenannt');                                              // kein Ereignis in der Sitzung
    aktiv(db, 's-ohne-ereignis', 'HeimOrdner');                                            // ohne cwd und ohne Alias: nicht zuzuordnen
    db.prepare("INSERT INTO projekt_kontakt (projekt, kontakt_id) VALUES ('wegwerf-a', 3)").run();
    manuell(db, '2026-08-20', 60, 'wegwerf-a');
    rechnungMit(db, [projektPos(2, 'wegwerf-a')]);
    db.prepare("INSERT INTO overrides (session_id, ticket, note, created_at) VALUES ('s-kurz', 'XY-7', 'n', '2026-08-18')").run();
    aktiv(db, 's-kurz', '(unbekannt)');
    for (const t of ['events', 'activity']) db.prepare(`UPDATE ${t} SET ticket = 'XY-7', ticket_quelle = 'override' WHERE session_id IN ('s-kurz', 's-normal')`).run();
    const fest = () => JSON.stringify(['invoices', 'zeit_eintrag', 'projekt_kontakt', 'overrides'].map((t) => db.prepare('SELECT * FROM ' + t).all()));
    const vorher = { fest: fest(), summe: summe(db) };

    PROJEKT_ALIAS.umbenannt = 'neuer-name';
    try {
      const log = console.log;
      const zeilen = [];
      console.log = (t) => zeilen.push(t);
      let erst, zweit;
      try { erst = zieheProjekteNach(db); zweit = zieheProjekteNach(db); } finally { console.log = log; }
      assert.deepStrictEqual({ ...erst }, { events: 4, activity: 10, tickets: 5 }, '4 Ereignisse, je 2 Activity-Zeilen, 2 ohne Ereignis; 1 + 2 + 2 Tickets geloescht');
      assert.deepStrictEqual({ ...zweit }, { events: 0, activity: 0, tickets: 0 }, 'zweiter Lauf aendert nichts');
      assert.strictEqual(zeilen.length, 1, 'Protokollzeile nur bei Aenderungen');

      for (const t of ['events', 'activity']) {
        assert.strictEqual(projektVon(db, t, 's-kurz'), '(test)', t + ' Kurzform');
        assert.strictEqual(projektVon(db, t, 's-lang'), '(test)', t + ' Langform');
        assert.strictEqual(projektVon(db, t, 's-merken'), '(cira)', t + ' merken wie beim Einlesen');
        assert.strictEqual(projektVon(db, t, 's-alias'), 'neuer-name', t + ' Alias');
        for (const [sid, soll] of [['s-heim', 'HeimOrdner'], ['s-normal', 'Normal'], ['s-cira', '(cira)'], ['s-lokal', '(lokal)'],
          ['s-frueher', 'alter-name'], ['s-frueher2', 'auch-alt']]) {
          assert.strictEqual(projektVon(db, t, sid), soll, t + ' ' + sid + ' unveraendert');
        }
      }
      assert.strictEqual(projektVon(db, 'activity', 's-nur-activity'), 'neuer-name', 'Reste: Alias direkt');
      assert.strictEqual(projektVon(db, 'activity', 's-ohne-ereignis'), 'HeimOrdner', 'Sitzung ohne Ereignis bleibt ohne Alias stehen');
      assert.deepStrictEqual(summe(db), vorher.summe, 'Summe cost_usd');
      assert.strictEqual(fest(), vorher.fest, 'Rechnungen, Zeit, Kontakte, Overrides unberuehrt');
      for (const t of ['events', 'activity']) {
        const paar = (sid) => db.prepare(`SELECT DISTINCT ticket, ticket_quelle FROM ${t} WHERE session_id = ?`).all(sid).map((r) => r.ticket + '/' + r.ticket_quelle).join(',');
        assert.strictEqual(paar('s-kurz'), 'null/null', t + ': (test) traegt kein Ticket, auch nicht in Zeilen ohne cwd');
        assert.strictEqual(paar('s-normal'), 'XY-7/override', t + ': echte Arbeit behaelt ihr Ticket');
      }
    } finally { delete PROJEKT_ALIAS.umbenannt; }
  }

  // Sitzung mit Temp- und Nicht-Temp-Ordner unter demselben alten Namen: activity kennt kein cwd, also bleibt
  // sie ganz, wo echte Arbeit liegt. Sonst wanderte Arbeitszeit nach (test) und verloere ihr Ticket.
  function nachzugGemischteSitzung() {
    const { zieheProjekteNach } = require('../../backfill');
    const db = neueDb();
    const lang = langTemp();
    zeile(db, 's-mix', 'HeimOrdner', 'D:\\Anderswo\\Roaming-x\\c');
    zeile(db, 's-mix', 'HeimOrdner', path.join(lang, 'scratch', 'b'));
    zeile(db, 's-zwei', 'HeimOrdner', path.join(lang, 'scratch', 'c'));   // zwei Temp-Ordner: zieht ganz um
    zeile(db, 's-zwei', 'HeimOrdner', path.join(lang, 'scratch', 'd'));
    for (const t of ['events', 'activity']) db.prepare(`UPDATE ${t} SET ticket = 'XY-5', ticket_quelle = 'override' WHERE session_id = 's-mix'`).run();
    const log = console.log;
    console.log = () => {};
    try {
      assert.deepStrictEqual({ ...zieheProjekteNach(db) }, { events: 3, activity: 4, tickets: 1 }, 'nur der Temp-Teil der Ereignisse, Activity nur der reinen Sitzung');
      assert.deepStrictEqual({ ...zieheProjekteNach(db) }, { events: 0, activity: 0, tickets: 0 }, 'zweiter Lauf');
    } finally { console.log = log; }
    const zaehle = (t, sid, p) => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE session_id = ? AND project = ?`).get(sid, p).n;
    assert.strictEqual(zaehle('activity', 's-mix', 'HeimOrdner'), 4, 'Arbeitszeit bleibt');
    assert.strictEqual(zaehle('activity', 's-mix', '(test)'), 0, 'Arbeitszeit bleibt');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM activity WHERE session_id = 's-mix' AND ticket = 'XY-5'").get().n, 4, 'Ticket der Arbeitszeit bleibt');
    assert.strictEqual(zaehle('events', 's-mix', '(test)'), 1, 'Temp-Ereignis zieht um');
    assert.strictEqual(zaehle('events', 's-mix', 'HeimOrdner'), 1, 'Arbeits-Ereignis bleibt');
    assert.strictEqual(zaehle('activity', 's-zwei', '(test)'), 4, 'nur Temp: ganze Sitzung');
  }

  // Kette im Alias: projectOf ist einstufig, also darf der Nachzug auch im zweiten Lauf nichts weiterreichen.
  function nachzugKette() {
    const { PROJECT_ROOTS, PROJEKT_ALIAS } = ing();
    const { zieheProjekteNach } = require('../../backfill');
    const db = neueDb();
    const w = PROJECT_ROOTS[0];
    zeile(db, 's-a', 'ka', path.join(w, 'ka'));
    zeile(db, 's-b', 'kb', path.join(w, 'kb'));
    Object.assign(PROJEKT_ALIAS, { kb: 'kc', ka: 'kb' });
    const log = console.log;
    console.log = () => {};
    try {
      zieheProjekteNach(db);
      assert.deepStrictEqual({ ...zieheProjekteNach(db) }, { events: 0, activity: 0, tickets: 0 }, 'zweiter Lauf');
      for (const t of ['events', 'activity']) {
        assert.strictEqual(projektVon(db, t, 's-a'), 'kb', t + ' einstufig');
        assert.strictEqual(projektVon(db, t, 's-b'), 'kc', t);
      }
    } finally { console.log = log; delete PROJEKT_ALIAS.ka; delete PROJEKT_ALIAS.kb; }
  }

  // Scheitert ein UPDATE, bleibt nichts stehen, der Fehler steht im Protokoll, und der Takt laeuft weiter.
  function nachzugRollback() {
    const { zieheProjekteNach } = require('../../backfill');
    const db = neueDb();
    zeile(db, 's-t', 'wegwerf-b', path.join(langTemp(), 'wegwerf-b'));
    db.exec("CREATE TEMP TRIGGER stoer BEFORE UPDATE ON activity BEGIN SELECT RAISE(ABORT, 'Stoerung'); END");
    const fehlerAlt = console.error;
    const fehler = [];
    console.error = (...a) => fehler.push(a.join(' '));
    let r;
    try { r = zieheProjekteNach(db); } finally { console.error = fehlerAlt; }
    assert.deepStrictEqual({ ...r }, { events: 0, activity: 0, tickets: 0 });
    assert.strictEqual(projektVon(db, 'events', 's-t'), 'wegwerf-b', 'Ereignisse zurueckgerollt');
    assert.strictEqual(db.isTransaction, false, 'keine offene Transaktion');
    assert.ok(fehler.some((t) => /Stoerung/.test(t)), 'Fehler nicht sichtbar: ' + fehler.join('|'));
    db.exec('DROP TRIGGER stoer');
    // Innerhalb einer laufenden Transaktion (bucheVorgang -> backfill.run) kein "cannot start a transaction".
    db.exec('BEGIN');
    const log = console.log;
    console.log = () => {};
    try { assert.deepStrictEqual({ ...zieheProjekteNach(db) }, { events: 1, activity: 2, tickets: 0 }); } finally { console.log = log; db.exec('ROLLBACK'); }
  }

  // Alias auf (test): Zeilen ohne Ereignis ziehen erst um, dann verlieren sie ihr Ticket. Andere Reihenfolge liesse es stehen.
  function nachzugAliasAufTest() {
    const { PROJECT_ROOTS, PROJEKT_ALIAS } = ing();
    const { zieheProjekteNach } = require('../../backfill');
    const db = neueDb();
    zeile(db, 's-e', 'AliasOrdner', path.join(PROJECT_ROOTS[0], 'AliasOrdner'));
    aktiv(db, 's-a', 'AliasOrdner');
    for (const t of ['events', 'activity']) db.prepare(`UPDATE ${t} SET ticket = 'XY-3', ticket_quelle = 'fenster'`).run();
    PROJEKT_ALIAS.AliasOrdner = '(test)';
    const log = console.log;
    console.log = () => {};
    try {
      assert.deepStrictEqual({ ...zieheProjekteNach(db) }, { events: 1, activity: 4, tickets: 5 });
      assert.deepStrictEqual({ ...zieheProjekteNach(db) }, { events: 0, activity: 0, tickets: 0 }, 'zweiter Lauf');
      for (const t of ['events', 'activity']) {
        assert.deepStrictEqual(db.prepare(`SELECT DISTINCT project, ticket, ticket_quelle FROM ${t}`).all().map((r) => ({ ...r })),
          [{ project: '(test)', ticket: null, ticket_quelle: null }], t);
      }
    } finally { console.log = log; delete PROJEKT_ALIAS.AliasOrdner; }
  }

  async function einlesenOhneTicket() {
    const ingest = ing();
    const config = require('../../config.json');
    const lang = langTemp();
    const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-p8-'));
    const datei = path.join(wurzel, 'lauf.jsonl');
    const zeilen = (sid, cwd, n) => [
      { timestamp: '2026-08-18T10:00:0' + n + '.000Z', sessionId: sid, cwd, gitBranch: 'feature/ABC-9-x', type: 'user', message: { content: 'los' } },
      { timestamp: '2026-08-18T10:00:1' + n + '.000Z', sessionId: sid, cwd, gitBranch: 'feature/ABC-9-x', type: 'assistant', requestId: 'r-' + sid,
        message: { id: 'm-' + sid, model: 'claude-opus-5', usage: { input_tokens: 1, output_tokens: 1 } } },
    ].map((o) => JSON.stringify(o)).join('\n') + '\n';
    fs.writeFileSync(datei, zeilen('s-test', path.join(lang, 'ABC-7-ordner'), 1) + zeilen('s-arbeit', path.join(ingest.PROJECT_ROOTS[0], 'Normal'), 2));
    const db = neueDb();
    const merk = config.jsonlDir;
    config.jsonlDir = wurzel;
    const log = console.log;
    console.log = () => {};
    const stand = (t, sid) => ({ ...db.prepare(`SELECT project, ticket, ticket_quelle FROM ${t} WHERE session_id = ? LIMIT 1`).get(sid) });
    try {
      await ingest.run({ db });
      for (const t of ['events', 'activity']) {
        assert.deepStrictEqual(stand(t, 's-test'), { project: '(test)', ticket: null, ticket_quelle: null }, t + ': Branch-Treffer in (test)');
        assert.strictEqual(stand(t, 's-arbeit').ticket, 'ABC-9', t + ': Gegenprobe, derselbe Branch bei echter Arbeit');
      }
      // UPSERT: dieselbe Anfrage kommt erneut (je Inhaltsblock eine Logzeile) und setzt nichts zurueck.
      fs.appendFileSync(datei, zeilen('s-test', path.join(lang, 'ABC-7-ordner'), 1));
      await ingest.run({ db });
      assert.strictEqual(stand('events', 's-test').ticket, null, 'UPSERT');
    } finally {
      console.log = log;
      config.jsonlDir = merk;
      fs.rmSync(wurzel, { recursive: true, force: true });
    }
  }

  function backfillOhneTicket() {
    const backfill = require('../../backfill');
    const metrics = require('../../metrics');
    const { PROJECT_ROOTS, ticketOf } = ing();
    const db = neueDb();
    const lang = langTemp();
    const w = PROJECT_ROOTS[0];
    assert.strictEqual(ticketOf(path.join(lang, 'ABC-5-x')), 'ABC-5', 'Fixture: Pfad traegt einen Schluessel');
    const ticketVon = (t, sid, projekt) => db.prepare(`SELECT DISTINCT ticket AS x FROM ${t} WHERE session_id = ? AND project = ?`).all(sid, projekt).map((r) => r.x).join(',');
    const setze = (sid, ticket) => db.prepare('INSERT INTO overrides (session_id, ticket, note, created_at) VALUES (?, ?, ?, ?)').run(sid, ticket, 'n', '2026-08-18');
    // Stufe cwd
    zeile(db, 's-cwd', '(test)', path.join(lang, 'ABC-5-x'));
    zeile(db, 's-cwd-echt', 'ABC-6-x', path.join(w, 'ABC-6-x'));
    // Stufe override: reine Testsitzung, auch die Zeile ohne cwd
    zeile(db, 's-ov', '(test)', path.join(lang, 'a'));
    aktiv(db, 's-ov', '(unbekannt)');
    setze('s-ov', 'TEST-1');
    // Gemischte Sitzung (cd in den Temp-Ordner): die Buchung gilt der Arbeit, nicht dem Testteil
    zeile(db, 's-mix', 'Normal', path.join(w, 'Normal'));
    zeile(db, 's-mix', '(test)', path.join(lang, 'b'));
    setze('s-mix', 'XY-2');
    // Stufe Sitzungs-Konsens
    zeile(db, 's-kons', 'Normal', path.join(w, 'Normal'));
    db.prepare("UPDATE events SET ticket = 'XY-3' WHERE session_id = 's-kons'").run();
    zeile(db, 's-kons', 'Normal', path.join(w, 'Normal'));
    zeile(db, 's-kons', '(test)', path.join(lang, 'c'));
    const overrides = () => JSON.stringify(db.prepare('SELECT * FROM overrides').all());
    const vorher = overrides();

    const log = console.log;
    console.log = () => {};
    try { backfill.run({ db }); backfill.run({ db }); } finally { console.log = log; }

    assert.strictEqual(ticketVon('events', 's-cwd', '(test)'), '', 'Stufe cwd');
    assert.strictEqual(ticketVon('events', 's-cwd-echt', 'ABC-6-x'), 'ABC-6', 'Gegenprobe Stufe cwd');
    for (const t of ['events', 'activity']) {
      assert.strictEqual(ticketVon(t, 's-ov', '(test)'), '', t + ': Override auf Testsitzung');
      assert.strictEqual(ticketVon(t, 's-mix', '(test)'), '', t + ': Override, Testteil');
      assert.strictEqual(ticketVon(t, 's-mix', 'Normal'), 'XY-2', t + ': Gegenprobe Override auf der Arbeit');
      assert.strictEqual(ticketVon(t, 's-kons', '(test)'), '', t + ': Konsens');
      assert.ok(ticketVon(t, 's-kons', 'Normal').includes('XY-3'), t + ': Gegenprobe Konsens');
    }
    assert.strictEqual(ticketVon('activity', 's-ov', '(unbekannt)'), '', 'Zeile ohne cwd der Testsitzung');
    assert.strictEqual(overrides(), vorher, 'overrides selbst bleibt');
    const tickets = metrics.byTicket(db, {}).map((t) => t.ticket);
    assert.ok(tickets.includes('XY-2') && !tickets.includes('TEST-1'), 'byTicket: ' + tickets);
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM events WHERE project = '(test)' AND ticket IS NOT NULL").get().n, 0);

    // Fensterstufe: Testsitzungen bleiben aussen vor, auch neben einer ticketierten (test)-Zeile aus alter Zeit.
    const db2 = neueDb();
    zeile(db2, 's-alt', '(test)', path.join(lang, 'd'));
    db2.prepare("UPDATE events SET ticket = 'XY-4'").run();
    zeile(db2, 's-neu', '(test)', path.join(lang, 'd'));
    assert.strictEqual(backfill.stufeZeitfenster(db2), 0, 'Fensterstufe');
  }

  // Abmelden einer Buchung leitet die Branch-Zuordnung neu ab: auch das gibt (test) kein Ticket.
  function buchungZurueck() {
    const { bucheVorgang } = srv();
    const db = neueDb();
    const lang = langTemp();
    zeile(db, 's-r', 'Normal', path.join(ing().PROJECT_ROOTS[0], 'Normal'));
    zeile(db, 's-r', '(test)', path.join(lang, 'e'));
    db.prepare("UPDATE events SET branch = 'feature/ABC-8-x' WHERE session_id = 's-r'").run();
    const log = console.log;
    console.log = () => {};
    // Erst der Takt: sonst raeumte der Nachzug der ersten Buchung den Fehler weg, und der Test saehe ihn nicht.
    try { require('../../backfill').run({ db }); bucheVorgang(db, { session_id: 's-r', vorgang: '' }); } finally { console.log = log; }
    assert.strictEqual(db.prepare("SELECT ticket FROM events WHERE session_id = 's-r' AND project = 'Normal'").get().ticket, 'ABC-8', 'Gegenprobe: Arbeit bekommt den Branch');
    assert.strictEqual(db.prepare("SELECT ticket FROM events WHERE session_id = 's-r' AND project = '(test)'").get().ticket, null, 'events');
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM activity WHERE session_id = 's-r' AND project = '(test)' AND ticket IS NOT NULL").get().n, 0, 'activity');
  }

  // Einmal je Verbindung: der 30-s-Takt fasst danach nichts mehr an, eine neue Verbindung schon.
  function nachzugEinmal() {
    const backfill = require('../../backfill');
    const db = neueDb();
    const ordner = path.join(langTemp(), 'wegwerf-c');
    zeile(db, 's-1', 'wegwerf-c', ordner);
    const log = console.log;
    console.log = () => {};
    try {
      backfill.run({ db });
      assert.strictEqual(projektVon(db, 'events', 's-1'), '(test)', 'run zieht nach');
      zeile(db, 's-2', 'wegwerf-c', ordner);
      backfill.run({ db });
      assert.strictEqual(projektVon(db, 'events', 's-2'), 'wegwerf-c', 'zweiter Takt: Stufe laeuft nicht erneut');
      // Erster Lauf in einer Buchung, die scheitert: das ROLLBACK darf den Nachzug nicht verschlucken.
      const db2 = neueDb();
      zeile(db2, 's-3', 'wegwerf-c', ordner);
      db2.exec('BEGIN');
      backfill.run({ db: db2 });
      db2.exec('ROLLBACK');
      backfill.run({ db: db2 });
      assert.strictEqual(projektVon(db2, 'events', 's-3'), '(test)', 'naechster Takt holt nach');
    } finally { console.log = log; }
  }

  function testNebenArbeit() {
    const metrics = require('../../metrics');
    assert.strictEqual(metrics.TEST_PROJEKT, ing().TEST_PROJEKT, 'Name muss zu ingest passen');
    for (const p of ['(test)', '(cira)', '(lokal)']) assert.ok(metrics.isOverhead(p), p);
    assert.ok(!metrics.isOverhead(P));
    assert.ok(metrics.OVERHEAD.has('(test)'), 'auch ohne Eintrag in der Konfiguration');
    assert.ok(!metrics.OVERHEAD.has('(cira)') && !metrics.OVERHEAD.has('(lokal)'), '(cira)/(lokal) bleiben ausserhalb des Sets');

    const db = standard();
    const aktivP = () => metrics.byProject(db, {}).find((p) => p.project === P).active_seconds;
    const geleistet = () => R().projektKonto(db, P).geleistet_h;
    const ohne = aktivP(), kontoOhne = geleistet();
    assert.ok(ohne > 0, 'Fixture: Arbeit vorhanden');
    claude(db, '2026-08-18', { projekt: '(test)', sid: 's-t' });   // zeitgleich mit der Arbeit
    assert.strictEqual(aktivP(), ohne, 'Testlauf nimmt der Arbeit keine Zeit weg');
    assert.strictEqual(geleistet(), kontoOhne, 'Konto bleibt');

    const split = metrics.splitOverhead(db, {});
    assert.ok(split.overhead_projekte.includes('(test)'));
    assert.ok(!metrics.ohneTicket(db, {}).some((z) => z.gruppe === '(test)'), 'keine abrechenbare Zeile');
    assert.ok(!metrics.projektNamen(db).includes('(test)'), 'kein offenes Konto');
    assert.strictEqual(metrics.liveSitzungen(db, { jetzt: Date.parse('2026-08-18T08:01:00Z') }), 2, 'Live zaehlt nur die zwei Arbeitssitzungen');

    // Werkzeug-Seite: sichtbar, aber "beobachtet" und "zuletzt" sprechen weiter nur von der Konfiguration.
    const w = metrics.werkzeuge(db);
    assert.ok(w.nach_werkzeug.some((x) => x.werkzeug === '(test)'), '(test) fehlt unter Werkzeuge');
    assert.ok(!w.summe.projekte.includes('(test)'), 'Hinweis "in config.json eintragen" waere nie mehr erreichbar');
    assert.strictEqual(w.summe.zuletzt, null, 'ein Testlauf ueberdeckt, dass ein Dienst still ist');
  }

  // Testkosten landen nie auf einem Vorgang, auch wenn der Testlauf direkt neben ticketierter Arbeit liegt.
  function testkostenNichtAufVorgang() {
    const metrics = require('../../metrics');
    const werkzeug = [...metrics.OVERHEAD].find((p) => p !== '(test)');
    const db = neueDb();
    claude(db, '2026-08-18', { ticket: 'XY-1', stunden: 1, sid: 's-a' });   // Ereignis 08:00
    const ein = db.prepare(`INSERT INTO events (request_id, ts, session_id, project, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day) VALUES (?,?,?,?,'claude-opus-5',1,1,0,0,0,0,?,0,'2026-08-18')`);
    ein.run('t1', '2026-08-18T08:02:00.000Z', 's-t', '(test)', 5);
    const zeile1 = () => metrics.byTicket(db, {}).find((t) => t.ticket === 'XY-1');
    assert.strictEqual(zeile1().werkzeug_cost_usd, 0, 'Testkosten auf dem Vorgang');
    assert.ok(Math.abs(zeile1().api_gegenwert_usd - 0.1) < 1e-9, 'Gegenwert: ' + zeile1().api_gegenwert_usd);
    ein.run('w1', '2026-08-18T08:03:00.000Z', 's-w', werkzeug, 2);
    assert.strictEqual(zeile1().werkzeug_cost_usd, 2, 'Gegenprobe: ein echtes Werkzeug bleibt auf dem Vorgang');
  }

  return [
    ['Projekt: Temp-Ordner werden (test), merken bleibt (cira), aehnliche Namen normal', tempOrdner],
    ['Projekt: projektAlias einstufig, ungueltige Werte ignoriert, kein Prototyp-Treffer', projektAlias],
    ['Projekt: Nachzug verschiebt nur Temp und Alias, Summen und Rechnungen bleiben', nachzug],
    ['Projekt: Nachzug reicht eine Alias-Kette nicht weiter', nachzugKette],
    ['Projekt: Nachzug laesst gemischte Sitzungen bei der Arbeit', nachzugGemischteSitzung],
    ['Projekt: Nachzug rollt bei Fehler zurueck und laeuft in offener Transaktion', nachzugRollback],
    ['Projekt: Nachzug einmal je Verbindung', nachzugEinmal],
    ['Projekt: (test) ist Werkzeugbetrieb und nimmt der Arbeit keine Zeit', testNebenArbeit],
    ['Projekt: Testkosten landen nie auf einem Vorgang', testkostenNichtAufVorgang],
    ['Projekt: Nachzug mit Alias auf (test) loescht auch dessen Tickets', nachzugAliasAufTest],
    ['Projekt: Einlesen gibt (test) kein Ticket, auch nicht per UPSERT', einlesenOhneTicket],
    ['Projekt: keine Backfill-Stufe gibt (test) ein Ticket', backfillOhneTicket],
    ['Projekt: Buchung zuruecknehmen gibt (test) kein Ticket', buchungZurueck],
    ['Projekt: /api/board Bereiche tragen projekt und offen_n, Karten hat_daten', boardBereiche],
    ['Projekt: rechnungenJeProjekt zählt nur Projektpositionen je Rechnung', rechnungenJeProjekt],
    ['Projekt: /api/projekt Form, 400/404 und Konto wie projektKontenAnzeige', projektForm],
    ['Projekt: Konto in beiden Endpunkten wie /api/summary (Ueberhang mit Toleranz)', kontoWieSummary],
    ['Projekt: /api/projekte Liste mit Werkzeug, Konto, ohne (unbekannt)', projekteListe],
    ['Projekt: konto_bis_heute nur im Stand bis heute', kontoBisHeute],
    ['Projekt: Abrechnen mit to = letzter_tag zeigt die Zahl der Uebersicht', abrechnenGleicheZahl],
    ['Projekt: letzter_tag aus dem Konto, Konto bis dorthin ohne Unterschied', letzterTag],
    ['Projekt: Rechnungskopf endet am letzten Arbeitstag', kopfEndetAmLetztenTag],
    ['Projekt: Vorgaenge nach Arbeitswert absteigend', vorgaengeNachWert],
    ['Projekt: Zeitmodell aus der Zeile ohne Vorgang', zeitmodellOhneVorgang],
  ];
};
