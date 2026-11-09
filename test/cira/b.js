'use strict';
// Block B Projekt-Teilabrechnung (design/cira/B-PROJEKT-ABRECHNUNG.md): Projektkonto, Projektposition.
const assert = require('node:assert');

module.exports = ({ dbmod, openDbs }) => {
  const P = 'Konto-Projekt';
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };

  // 3 h Claude-Zeit ohne Vorgang am Tag (Aktivitaet im Zweiminutentakt, dazu ein Request,
  // damit ohneTicket die Zeile ueberhaupt bildet).
  function claude(db, tag, stunden = 3) {
    const ein = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
    for (let m = 0; m <= stunden * 60; m += 2) ein.run('s-' + tag, new Date(Date.parse(tag + 'T08:00:00Z') + m * 60000).toISOString(), P, 'main', null, tag);
    db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
      VALUES (?,?,?,?,?,?,?,10,10,0,0,0,0,0.1,0,?)`).run('r-' + tag, tag + 'T08:00:00.000Z', 's-' + tag, P, 'main', null, 'claude-opus-5', tag);
  }
  function manuell(db, tag, min, { abrechenbar = 1, projekt = P } = {}) {
    return db.prepare(`INSERT INTO zeit_eintrag (ziel_art, ziel_schluessel, start, ende, tag, taetigkeit, abrechenbar,
      rohzeit_min, gezaehlt_min, created_at) VALUES ('projekt', ?, ?, ?, ?, 'Beratung', ?, ?, ?, ?)`)
      .run(projekt, tag + 'T12:00:00.000Z', new Date(Date.parse(tag + 'T12:00:00.000Z') + min * 60000).toISOString(), tag, abrechenbar, min, min, tag).lastInsertRowid;
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
  const projektPos = (stunden) => ({ ticket: P, ohne_vorgangsnummer: true, stunden, betrag_eur: stunden * 100 });
  // 6 h Claude an zwei Tagen + 2 h manuell
  function standard() {
    const db = neueDb();
    claude(db, '2026-08-18'); claude(db, '2026-08-19'); manuell(db, '2026-08-20', 120);
    return db;
  }
  const konto = (db, bis = '2026-12-31') => require('../../rechnung').projektKonto(db, P, bis);

  function geleistet() {
    const db = standard();
    const k = konto(db);
    assert.strictEqual(k.geleistet_h, 8);
    assert.strictEqual(k.offen_h, 8);
    assert.strictEqual(k.ueber_h, 0);
    assert.strictEqual(k.berechnet_h, 0);
    assert.strictEqual(typeof k.satz, 'number');
    assert.deepStrictEqual(k.nummern, []);
    // Zeit MIT Vorgang im selben Projekt gehoert zum Vorgang, nicht aufs Konto
    const ein = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
    for (let m = 0; m <= 240; m += 2) ein.run('s-v', new Date(Date.parse('2026-08-19T14:00:00Z') + m * 60000).toISOString(), P, 'main', 'XY-1', '2026-08-19');
    assert.strictEqual(konto(db).geleistet_h, 8);
    // nicht abrechenbare Eintraege und fremde Projekte zaehlen nicht
    manuell(db, '2026-08-21', 600, { abrechenbar: 0 }); manuell(db, '2026-08-21', 600, { projekt: 'anderes' });
    assert.strictEqual(konto(db).geleistet_h, 8);
    // bis schneidet
    assert.strictEqual(konto(db, '2026-08-18').geleistet_h, 3);
  }

  function berechnetStorno() {
    const db = standard();
    const nr = rechnungMit(db, [projektPos(5)]);
    let k = konto(db);
    assert.strictEqual(k.offen_h, 3);
    assert.strictEqual(k.berechnet_h, 5);
    assert.deepStrictEqual(k.nummern, [nr]);
    require('../../rechnung').storniere(db, nr);
    k = konto(db);
    assert.strictEqual(k.offen_h, 8);
    assert.strictEqual(k.berechnet_h, 0);
  }

  function kulanzUndZeit() {
    const db = standard();
    rechnungMit(db, [
      { typ: 'kulanz', projekt: P, stunden: 1, betrag_eur: 0 },
      { typ: 'zeit', ziel_art: 'projekt', ziel: P, stunden: 2, betrag_eur: 200 },
      // zaehlt nicht: andere Ziele/Projekte, Pauschale, Vorgang mit Nummer
      { typ: 'zeit', ziel_art: 'projekt', ziel: 'anderes', stunden: 9, betrag_eur: 1 },
      { typ: 'zeit', ziel_art: 'vorgang', ziel: P, stunden: 9, betrag_eur: 1 },
      { typ: 'kulanz', projekt: 'anderes', stunden: 9, betrag_eur: 0 },
      { typ: 'kulanz', stunden: 9, betrag_eur: 0 },
      { typ: 'pauschal', ticket: P, ohne_vorgangsnummer: true, projekt: P, stunden: 9, betrag_eur: 1 },
      { ticket: P, stunden: 9, betrag_eur: 1 },
    ]);
    assert.strictEqual(konto(db).berechnet_h, 3);
  }

  function niemalsNegativ() {
    const db = standard();
    rechnungMit(db, [projektPos(10)]);
    const k = konto(db);
    assert.strictEqual(k.offen_h, 0);
    assert.strictEqual(k.ueber_h, 2);
    assert.ok(k.offen_h >= 0 && k.ueber_h >= 0);
    // nie beides zugleich: Plausibilitaet
    assert.ok(k.offen_h === 0 || k.ueber_h === 0);
  }

  function einheitenAdditiv() {
    const db = standard();
    const metrics = require('../../metrics');
    const e = metrics.projektEinheiten(db, P, '2026-12-31');
    assert.deepStrictEqual(e.map((x) => [x.tag, x.art]), [['2026-08-18', 'claude'], ['2026-08-19', 'claude'], ['2026-08-20', 'manuell']]);
    assert.ok(Number.isInteger(e[2].eintragId));
    const claudeSumme = e.filter((x) => x.art === 'claude').reduce((a, x) => a + x.stunden, 0);
    const ot = metrics.ohneTicket(db, { to: '2026-12-31' }).find((r) => r.gruppe === P);
    assert.ok(ot && ot.active_hours > 5, 'Gegenprobe: ohneTicket sieht die Zeit');
    assert.ok(Math.abs(claudeSumme - ot.active_hours) < 0.01, claudeSumme + ' vs ' + ot.active_hours);
    // am selben Tag Claude vor manuell
    manuell(db, '2026-08-18', 60);
    const t = metrics.projektEinheiten(db, P, '2026-12-31').filter((x) => x.tag === '2026-08-18').map((x) => x.art);
    assert.deepStrictEqual(t, ['claude', 'manuell']);
  }

  // --- Task 2: Projektposition aus Wunsch und Konto ------------------------------
  // Eigene Umgebung (Stammdaten, Satz 85, Rundung 5, Doppelpruefung an), danach zurueck.
  function umgebung(fn) {
    const config = require('../../config.json');
    const rechnung = require('../../rechnung');
    const merk = { rechnung: config.rechnung, faktor: config.vergleichsFaktor, satz: config.stundensatz, saetze: config.projektSaetze, rundung: config.rundungMinuten, doppelt: rechnung.pruefung.doppelt };
    config.rechnung = {
      aussteller: { name: 'Testfirma', anschrift: ['Teststr. 1', '50667 Koeln'], steuernummer: '123/456/78910', ustIdNr: '', bank: 'Testbank', iban: 'DE00 0000 0000 0000 0000 00', bic: 'TESTDEFF' },
      kleinunternehmer: true, ustSatz: 19, zahlungszielTage: 14, chromePfad: '',
    };
    config.vergleichsFaktor = 0; config.stundensatz = 85; config.projektSaetze = {}; config.rundungMinuten = 5;
    rechnung.pruefung.doppelt = true;
    try { return fn(rechnung); } finally {
      config.rechnung = merk.rechnung; config.vergleichsFaktor = merk.faktor; config.stundensatz = merk.satz;
      config.projektSaetze = merk.saetze; config.rundungMinuten = merk.rundung; rechnung.pruefung.doppelt = merk.doppelt;
    }
  }
  const KUNDE = { name: 'Kunde' };
  const daten = (projekte, extra = {}) => ({ from: '2026-08-01', to: '2026-08-31', projekte, empfaenger: KUNDE, ...extra });
  const projektPositionen = (inv) => inv.positionen.filter((p) => p.ohne_vorgangsnummer && p.typ !== 'pauschal');
  const eintragStatus = (db, id) => db.prepare('SELECT status, rechnung_nr FROM zeit_eintrag WHERE id = ?').get(id);
  // Der manuelle Eintrag der Standarddatenbank (20.08., 2 h)
  const manuellId = (db) => db.prepare('SELECT id FROM zeit_eintrag WHERE ziel_schluessel = ?').get(P).id;
  const fehler = (fn) => { try { fn(); } catch (e) { return e; } return null; };
  // Quelltext fuer Aufbau-Pruefungen; ein Mutant des Gate-Skripts wirkt auch hier (sonst liest der Test die heile Datei).
  const quelle = (rel) => {
    const s = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', rel), 'utf8').replace(/\r\n/g, '\n');
    const m = process.env.B_MUTANT ? JSON.parse(process.env.B_MUTANT) : null;
    return m && m.datei === rel ? s.split(m.von).join(m.nach) : s;
  };

  const T2 = {
    teil: 'B2 Teil: 5 von 8 h, Rest 3 h offen',
    zweite: 'B2 zweite Rechnung gleicher Zeitraum geht',
    prozentBetrag: 'B2 Prozent und Betrag',
    betragKlein: 'B2 Betrag zu klein, Begrenzung auf offen',
    niedoppelt: 'B2 nie doppelt (Kontoregel)',
    zweiWege: 'B2 Manuell zwei Wege',
    fifo: 'B2 FIFO-Zeitraum',
    kulanzRest: 'B2 Kulanz-Rest',
    storno: 'B2 Storno gibt frei',
    pauschale: 'B2 Pauschale nicht doppelt',
    drift: 'B2 Rundungsdrift: 3 x 10 min auf drei Rechnungen',
    nachrechnen: 'B2 Projektposition rechnet manuelle Eintraege vorher neu',
    wunschForm: 'B2 Wunschangabe wird geprueft',
    kopf: 'B2 Kopfzeitraum umfasst die Projektpositionen',
    offenTo: 'B2 offeneDaten: to aus den Einheiten, Teilprojekt bleibt offen',
    abgBis: 'B2 abgerechnetBis ohne Projektpositionen',
    kontoBis: 'B2 Kontoregel prueft gegen geleistet bis',
    prozentOffen: 'B2 Prozent bezieht sich auf offen',
    tokens: 'B2 Beleg ohne Token-Zeile bei Projektposition',
  };

  function teil() {
    umgebung((rechnung) => {
      const db = standard();
      const inv = rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      const pos = projektPositionen(inv);
      assert.strictEqual(pos.length, 1);
      assert.strictEqual(pos[0].stunden, 5);
      assert.strictEqual(pos[0].betrag_eur, Math.round(5 * 85 * 100) / 100);
      assert.strictEqual(pos[0].projekt, P);
      assert.strictEqual(pos[0].satz, 85);
      assert.strictEqual(pos[0].erbracht_h, 8);
      const k = konto(db);
      assert.strictEqual(k.offen_h, 3);
      assert.strictEqual(k.berechnet_h, 5);
      assert.deepStrictEqual(k.nummern, [inv.nr]);
    });
  }

  function zweite() {
    umgebung((rechnung) => {
      const db = standard();
      rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      // gleicher Zeitraum, nur der Name: genau der Rest, kein 409
      const inv2 = rechnung.erstelle(db, daten([P]));
      const pos = projektPositionen(inv2);
      assert.strictEqual(pos.length, 1);
      assert.strictEqual(pos[0].stunden, 3);
      assert.strictEqual(konto(db).offen_h, 0);
      // danach ist nichts mehr offen
      assert.ok(fehler(() => rechnung.erstelle(db, daten([P]))), 'dritte Rechnung ohne offene Stunden');
    });
  }

  function prozentBetrag() {
    umgebung((rechnung) => {
      const db = standard();
      const a = rechnung.entwurf(db, daten([{ name: P, prozent: 50 }]));
      assert.strictEqual(projektPositionen(a)[0].stunden, 4);
      const b = rechnung.entwurf(db, daten([{ name: P, betrag: 300 }]));
      const p = projektPositionen(b)[0];
      assert.strictEqual(p.stunden, 3.52);   // abgerundet, nicht 3,53
      assert.strictEqual(p.betrag_eur, 299.2);
    });
  }

  function betragKlein() {
    umgebung((rechnung) => {
      const db = standard();
      const e = fehler(() => rechnung.entwurf(db, daten([{ name: P, betrag: 0.4 }])));
      assert.ok(e && /ergibt weniger als 0,01 Stunden/.test(e.message), e && e.message);
      const d = rechnung.entwurf(db, daten([{ name: P, betrag: 10000 }]));
      assert.strictEqual(projektPositionen(d)[0].stunden, 8);
      assert.ok(Array.isArray(d.hinweise) && d.hinweise.some((h) => /begrenzt/.test(h)), JSON.stringify(d.hinweise));
      const v = rechnung.vorschau(db, daten([{ name: P, stunden: 99 }]));
      assert.strictEqual(v.positionen.find((x) => x.ohne_vorgangsnummer).stunden, 8);
      assert.strictEqual(v.hinweise.length, 1);
    });
  }

  function nieDoppelt() {
    umgebung((rechnung) => {
      const db = standard();
      const pos = (stunden) => ({ ticket: P, ohne_vorgangsnummer: true, projekt: P, von: '2026-08-18', bis: '2026-08-20', stunden, satz: 85, basissatz: 85, rabatt_prozent: 0, betrag_eur: Math.round(stunden * 85 * 100) / 100 });
      const ap = (stunden) => rechnung.ausPositionen(db, { positionen: [pos(stunden)], empfaenger: KUNDE, von: '2026-08-18', bis: '2026-08-20' });
      const offen = konto(db).offen_h;
      const e = fehler(() => ap(offen + 0.01));
      assert.ok(e && e.abweichung === true && /Projekt Konto-Projekt: nur noch 8 h offen\./.test(e.message), e && e.message);
      assert.ok(ap(offen).nr, 'genau offen geht');
      // jetzt ist nichts mehr offen: schon 0,01 h mehr wird abgelehnt
      const e2 = fehler(() => ap(0.01));
      assert.ok(e2 && e2.abweichung === true, 'Rest 0 h, 0,01 h zusaetzlich');
    });
  }

  function zweiWege() {
    umgebung((rechnung) => {
      // vollstaendig verbraucht: die Projektposition sperrt den Eintrag, der zweite Weg meldet "bereits abgerechnet"
      const db = standard();
      const id = manuellId(db);
      const inv = rechnung.erstelle(db, daten([P]));
      assert.strictEqual(eintragStatus(db, id).status, 'abgerechnet');
      assert.strictEqual(eintragStatus(db, id).rechnung_nr, inv.nr);
      const e = fehler(() => rechnung.erstelle(db, { from: '2026-08-01', to: '2026-08-31', eintraege: [id], empfaenger: KUNDE }));
      assert.ok(e && /bereits abgerechnet/.test(e.message), e && e.message);
      // teilweise verbraucht (7 von 8 h): der Eintrag bleibt offen, der Weg ueber eintraege scheitert am Konto
      const db2 = standard();
      const id2 = manuellId(db2);
      rechnung.erstelle(db2, daten([{ name: P, stunden: 7 }]));
      assert.strictEqual(eintragStatus(db2, id2).status, 'offen');
      const e2 = fehler(() => rechnung.erstelle(db2, { from: '2026-08-01', to: '2026-08-31', eintraege: [id2], empfaenger: KUNDE }));
      assert.ok(e2 && e2.abweichung === true && /nur noch/.test(e2.message), e2 && e2.message);
    });
  }

  function fifo() {
    umgebung((rechnung) => {
      const db = standard();
      const a = projektPositionen(rechnung.erstelle(db, daten([{ name: P, stunden: 3 }])))[0];
      assert.deepStrictEqual([a.von, a.bis], ['2026-08-18', '2026-08-18']);
      const b = projektPositionen(rechnung.erstelle(db, daten([{ name: P, stunden: 3 }])))[0];
      assert.deepStrictEqual([b.von, b.bis], ['2026-08-19', '2026-08-19']);
    });
  }

  function kulanzRest() {
    umgebung((rechnung) => {
      const db = standard();
      const id = manuellId(db);
      const inv = rechnung.erstelle(db, daten([{ name: P, stunden: 5, kulanzRest: true }]));
      assert.strictEqual(projektPositionen(inv)[0].stunden, 5);
      const kul = inv.positionen.filter((x) => x.typ === 'kulanz');
      assert.strictEqual(kul.length, 1);
      assert.deepStrictEqual([kul[0].projekt, kul[0].stunden, kul[0].satz, kul[0].betrag_eur, kul[0].bezeichnung], [P, 3, 0, 0, 'Kulanz – nicht berechnete Zeit ' + P]);
      assert.strictEqual(inv.netto_eur, 425);
      const k = konto(db);
      assert.strictEqual(k.offen_h, 0);
      assert.strictEqual(k.berechnet_h, 8);
      // der Rest enthaelt den manuellen Eintrag: gesperrt
      assert.strictEqual(eintragStatus(db, id).status, 'abgerechnet');
    });
  }

  function storno() {
    umgebung((rechnung) => {
      const db = standard();
      const id = manuellId(db);
      const inv = rechnung.erstelle(db, daten([{ name: P, stunden: 5, kulanzRest: true }]));
      assert.strictEqual(eintragStatus(db, id).status, 'abgerechnet');
      rechnung.storniere(db, inv.nr);
      assert.strictEqual(konto(db).offen_h, 8);
      assert.deepStrictEqual({ ...eintragStatus(db, id) }, { status: 'offen', rechnung_nr: null });
      assert.strictEqual(projektPositionen(rechnung.erstelle(db, daten([P])))[0].stunden, 8);
    });
  }

  // Mit echten source='lokal'-Events in eigenem Prozess (Preis je Mio. Tokens wird beim Laden gelesen).
  function pauschale() {
    require('node:child_process').execFileSync(process.execPath, [require('node:path').join(__dirname, 'b-lokal.js')], { stdio: 'pipe', env: process.env });
  }

  function kopf() {
    umgebung((rechnung) => {
      const db = standard();
      // Stunden am 18.-20.08., gewaehlt ist der September
      const inv = rechnung.erstelle(db, { from: '2026-09-01', to: '2026-09-30', projekte: [P], empfaenger: KUNDE });
      assert.deepStrictEqual([inv.leistung_von, inv.leistung_bis], ['2026-08-18', '2026-09-30']);
      assert.ok(rechnung.renderHtml(inv).includes('Leistungszeitraum: 2026-08-18 bis 2026-09-30'));
      // from mitten im Zeitraum: die Position beginnt trotzdem am 18.08.
      const db2 = standard();
      const v = rechnung.vorschau(db2, { from: '2026-08-19', to: '2026-08-31', projekte: [P], empfaenger: KUNDE });
      assert.ok(v.html.length > 0);
      assert.strictEqual(rechnung.entwurf(db2, { from: '2026-08-19', to: '2026-08-31', projekte: [P], empfaenger: KUNDE }).leistung_von, '2026-08-18');
    });
  }

  function offenDatenTo() {
    umgebung((rechnung) => {
      const db = standard();
      // Die manuelle Zeit am 20.08. liegt nach dem letzten Claude-Event: to muss sie einschliessen
      const od = rechnung.offeneDaten(db, { projekte: [P] });
      assert.strictEqual(od.daten.to, '2026-08-20');
      assert.strictEqual(rechnung.vorschau(db, { ...od.daten, empfaenger: KUNDE }).positionen.find((x) => x.projekt).stunden, 8);
      // teilweise berechnet: bleibt offen, mit dem Rest
      rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      const od2 = rechnung.offeneDaten(db, { projekte: [P] });
      assert.ok(od2.daten && od2.daten.projekte.includes(P), 'teilberechnetes Projekt verschwindet aus offen');
      assert.strictEqual(od2.daten.to, '2026-08-20');
      assert.strictEqual(rechnung.vorschau(db, { ...od2.daten, empfaenger: KUNDE }).positionen.find((x) => x.projekt).stunden, 3);
    });
  }

  function abgerechnetBisProjekt() {
    umgebung((rechnung) => {
      const db = standard();
      rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      assert.strictEqual(rechnung.abgerechnetBis(db)[P], undefined);
    });
  }

  function kontoBis() {
    umgebung((rechnung) => {
      const db = standard();
      // bis 18.08. sind 3 h geleistet (gesamt 8): 3,5 h bis dahin duerfen nicht gestellt werden
      const e = fehler(() => rechnung.ausPositionen(db, { positionen: [{ ticket: P, ohne_vorgangsnummer: true, projekt: P, von: '2026-08-18', bis: '2026-08-18', stunden: 3.5, satz: 85, basissatz: 85, rabatt_prozent: 0, betrag_eur: 297.5 }], empfaenger: KUNDE, von: '2026-08-18', bis: '2026-08-18' }));
      assert.ok(e && e.abweichung === true && /nur noch 3 h offen/.test(e.message), e && e.message);
    });
  }

  function prozentOffen() {
    umgebung((rechnung) => {
      const db = standard();
      rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      assert.strictEqual(projektPositionen(rechnung.entwurf(db, daten([{ name: P, prozent: 50 }])))[0].stunden, 1.5);
    });
  }

  function tokenZeile() {
    umgebung((rechnung) => {
      const db = standard();
      const proj = rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      assert.ok(!/Token-Verbrauch/.test(rechnung.renderHtml(proj)), 'Token-Zeile bei Projektposition');
      // gemischt: eine Projektposition genuegt
      const gemischt = { ...proj, positionen: [...proj.positionen, { ticket: 'XY-1', stunden: 1, satz: 85, betrag_eur: 85, tokens_gesamt: 1234 }] };
      assert.ok(!/Token-Verbrauch/.test(rechnung.renderHtml(gemischt)), 'Token-Zeile bei gemischtem Beleg');
      // alte Abschrift ohne projekt: unveraendert
      const alt = { ...proj, positionen: [{ ticket: 'XY-1', stunden: 1, satz: 85, betrag_eur: 85, tokens_gesamt: 1234 }] };
      assert.ok(rechnung.renderHtml(alt).includes('Token-Verbrauch gesamt: 1.234 (informativ, nicht Bestandteil der Berechnung)'));
      // alte Abschrift mit Pauschale (ohne projekt): Zeile unveraendert
      const altPauschal = { ...proj, positionen: [...alt.positionen, { ticket: P, ohne_vorgangsnummer: true, typ: 'pauschal', bezeichnung: 'Nutzung lokaler KI-Modelle Vorgang ' + P, betrag_eur: 5 }] };
      assert.ok(rechnung.renderHtml(altPauschal).includes('Token-Verbrauch gesamt: 1.234 (informativ, nicht Bestandteil der Berechnung)'));
    });
  }

  function drift() {
    umgebung((rechnung) => {
      const db = neueDb();
      const ids = ['2026-08-10', '2026-08-11', '2026-08-12'].map((t) => manuell(db, t, 10));
      for (const id of ids) rechnung.erstelle(db, { from: '2026-08-01', to: '2026-08-31', eintraege: [id], empfaenger: KUNDE });
      const k = konto(db);
      assert.strictEqual(k.berechnet_h, 0.51);
      assert.strictEqual(k.geleistet_h, 0.5);
    });
  }

  function nachrechnen() {
    umgebung((rechnung) => {
      const db = standard();
      const id = manuellId(db);
      db.prepare('UPDATE zeit_eintrag SET gezaehlt_min = 600 WHERE id = ?').run(id);   // veraltet gespeichert
      const inv = rechnung.erstelle(db, daten([P]));
      assert.strictEqual(projektPositionen(inv)[0].stunden, 8, 'veralteter Wert wurde berechnet');
      assert.strictEqual(db.prepare('SELECT gezaehlt_min FROM zeit_eintrag WHERE id = ?').get(id).gezaehlt_min, 120);
    });
  }

  function wunschForm() {
    umgebung((rechnung) => {
      const db = standard();
      const schlecht = [
        [[{ name: P, stunden: 1, prozent: 10 }], /hoechstens eines/],
        [[{ name: P, prozent: 101 }], /Prozent/],
        [[{ name: P, stunden: -1 }], /Stunden/],
        [[{ name: P, betrag: Infinity }], /Betrag/],
        [[{ name: 5 }], /Name/],
        [[{ name: 'x'.repeat(201) }], /Name/],
        [[{ name: P, kulanzRest: 'ja' }], /kulanzRest/],
        [[P, { name: P }], /doppelt/],
      ];
      for (const [w, re] of schlecht) {
        const e = fehler(() => rechnung.entwurf(db, daten(w)));
        assert.ok(e && re.test(e.message), JSON.stringify(w) + ' -> ' + (e && e.message));
      }
      // Namen allein (alter Weg) gehen weiter
      assert.strictEqual(projektPositionen(rechnung.entwurf(db, daten([P])))[0].stunden, 8);
    });
  }

  // --- Task 3: Kennzahlen aus dem Konto ------------------------------------------
  const T3 = {
    sinkt: 'B3 ohne_vorgang sinkt nach Teilrechnung',
    plausibel: 'B3 Plausibilitaet',
    doppelt: 'B3 Manuelle Zeit nicht doppelt abgezogen',
    vergangen: 'B3 Vergangener Zeitraum ohne Ueberhang',
    aufrufer: 'B3 Jeder Aufrufer reicht das Konto durch',
    mischsatz: 'B3 Mischsatz ohne Rechnung: nichts abgerechnet, Monate gleich Gesamt',
    durchschnitt: 'B3 Mischsatz mit Teilrechnung: Durchschnitt, gesamt + offen = Arbeitswert',
    kollision: 'B3 Kunde gleichnamig mit Projekt bekommt das Konto nicht',
    ueberhang: 'B3 Ueberhang nur in der Heute-Sicht und ueber der Toleranz',
  };
  const naeher = (a, b, text) => assert.ok(Math.abs(a - b) < 1e-6, (text || '') + ' ' + a + ' vs ' + b);
  const rund2 = (x) => Math.round(x * 100) / 100;
  // Wie die Aufrufer: Zeilen des Zeitraums plus Konto bis Zeitraumende.
  function kz(db, rechnung, o = { from: '2026-08-01', to: '2026-08-31' }) {
    const metrics = require('../../metrics');
    const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
    return { zeilen, k: metrics.kennzahlen(zeilen, rechnung.abrechnung(db), { projektKonto: rechnung.projektKonten(db, zeilen, o) }) };
  }

  function ohneVorgangSinkt() {
    umgebung((rechnung) => {
      const db = standard();
      assert.strictEqual(kz(db, rechnung).k.ohne_vorgang_eur, 8 * 85, 'Ausgangslage: alles offen');
      rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      const { k } = kz(db, rechnung);
      naeher(k.ohne_vorgang_eur, rund2(3 * 85), 'ohne_vorgang');
      naeher(k.offen_eur, rund2(3 * 85), 'offen_eur');
      naeher(k.offen_stunden, 3, 'offen_stunden');
      naeher(k.abgerechnet_projekt_eur, 5 * 85, 'abgerechnet_projekt');
    });
  }

  function plausibel() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const zeitraeume = [{ from: '2026-08-01', to: '2026-08-31' }, { from: '2026-08-19', to: '2026-08-19' }];   // der zweite: Zeile (3 h) kleiner als das Konto bis dahin (6 h)
      const faelle = {
        unberuehrt: (db) => db,
        teil: (db) => { rechnung.erstelle(db, daten([{ name: P, stunden: 5 }])); return db; },
        klein: (db) => { rechnung.erstelle(db, daten([{ name: P, stunden: 1 }])); return db; },   // Konto bis 19.08. (5 h offen) groesser als die Zeile (3 h)
        voll: (db) => { rechnung.erstelle(db, daten([P])); return db; },
        ueber: (db) => { rechnungMit(db, [projektPos(10)]); return db; },
        storniert: (db) => { rechnung.storniere(db, rechnung.erstelle(db, daten([P])).nr); return db; },
      };
      for (const [name0, bau] of Object.entries(faelle)) for (const o of zeitraeume) {
        const name = name0 + ' ' + o.from + '..' + o.to;
        const db = bau(standard());
        const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
        const konten = rechnung.projektKonten(db, zeilen, o);
        for (const z of zeilen) {
          const e = metrics.kennzahlen([z], rechnung.abrechnung(db), { projektKonto: konten });
          assert.ok(e.offen_eur >= -1e-9 && e.offen_eur <= z.arbeitswert + 1e-9, name + ': offen ' + e.offen_eur + ' ausserhalb 0..' + z.arbeitswert);
        }
        const k = metrics.kennzahlen(zeilen, rechnung.abrechnung(db), { projektKonto: konten });
        // Entfernt: Summe der Einzelzeilen und vorgang + ohne == offen_eur; beides kann bei dieser Bauart nicht rot werden.
        // Die echte Sicherung ist abgerechnet_gesamt_eur + offen_eur == Arbeitswert (Zeile darunter).
        // offen + abgerechnet teilen den Arbeitswert ohne Rest auf
        naeher(k.abgerechnet_gesamt_eur + k.offen_eur, k.wert.arbeitswert, name + ': Aufteilung');
        assert.ok(k.offen_stunden >= -1e-9 && k.offen_stunden <= k.aktive_stunden + k.manuell_stunden + 1e-9, name + ': Stunden ' + k.offen_stunden);
      }
    });
  }

  function nichtDoppeltAbgezogen() {
    umgebung((rechnung) => {
      // Alles ueber die Projektposition: der manuelle Eintrag ist per Sperre "abgerechnet" (satz_eingefroren)
      const db = standard();
      rechnung.erstelle(db, daten([P]));
      assert.strictEqual(eintragStatus(db, manuellId(db)).status, 'abgerechnet');
      const { k } = kz(db, rechnung);
      assert.strictEqual(k.ohne_vorgang_eur, 0, 'zweimal abgezogen: ' + k.ohne_vorgang_eur);
      assert.strictEqual(k.offen_eur, 0);
      assert.strictEqual(k.offen_stunden, 0);
      naeher(k.abgerechnet_projekt_eur, 8 * 85, 'alles auf der Projektposition');
      assert.strictEqual(k.abgerechnet_manuell_eur, 0, 'manuell nicht zusaetzlich als abgerechnet gezaehlt');
      // 6 von 8 h berechnet: der manuelle Eintrag (2 h) bleibt offen, offen sind genau 2 h
      const db2 = standard();
      rechnung.erstelle(db2, daten([{ name: P, stunden: 6 }]));
      naeher(kz(db2, rechnung).k.ohne_vorgang_eur, 2 * 85, '6 von 8 h');
      // Alter Weg: manuelle Zeit allein ueber eintraege abgerechnet (Zeitposition mit Ziel Projekt)
      const db3 = standard();
      rechnung.erstelle(db3, { from: '2026-08-01', to: '2026-08-31', eintraege: [manuellId(db3)], empfaenger: KUNDE });
      naeher(kz(db3, rechnung).k.ohne_vorgang_eur, 6 * 85, 'Zeitposition zaehlt im Konto');
    });
  }

  function vergangenerZeitraum() {
    umgebung((rechnung) => {
      const db = standard();
      rechnungMit(db, [projektPos(5)]);
      // nur der 18.08. (3 h) ausgewertet: bis dahin ist mehr berechnet als geleistet. Kein Minus, kein Ueberhang als Zahl.
      const o = { from: '2026-08-18', to: '2026-08-18' };
      const { k, zeilen } = kz(db, rechnung, o);
      assert.ok(zeilen.some((z) => z.gruppe === P));
      assert.strictEqual(k.ohne_vorgang_eur, 0);
      assert.ok(k.offen_eur >= 0 && k.offen_stunden >= 0);
      assert.ok(!('ueber_h' in k) && !('ueber_eur' in k), 'Ueberhang darf in den Kennzahlen nicht auftauchen');
      // bis wird auf das Zeitraumende gesetzt (nicht heute): Monat statt to geht ebenso
      const konten = rechnung.projektKonten(db, zeilen, { month: '2026-08' });
      assert.strictEqual(konten.get(P).geleistet_h, 8);
      // Daten NACH dem Zeitraum: ohne den Monatszweig kaeme "bis heute" heraus (11 statt 8 h)
      claude(db, '2026-09-10');
      assert.strictEqual(rechnung.projektKonten(db, zeilen, { month: '2026-08' }).get(P).geleistet_h, 8, 'Monat statt to');
      const spaeter = rechnung.projektKonten(db, zeilen, { to: '2026-08-18' });
      assert.strictEqual(spaeter.get(P).geleistet_h, 3);
    });
  }

  const mischsatz = (db) => db.prepare("INSERT OR REPLACE INTO taetigkeitsart (name, satz, parallel) VALUES ('Beratung', 120, 0)").run();

  function mischsatzOhneRechnung() {
    umgebung((rechnung) => {
      const bau = (extra) => { const db = standard(); mischsatz(db); claude(db, '2026-07-10'); if (extra) extra(db); return db; };
      // 41 min: krumme Minuten, die das Konto auf 2 Stellen rundet
      for (const [name, extra] of [['glatt', null], ['41 min', (db) => manuell(db, '2026-08-21', 41)]]) {
        const db = bau(extra);
        const jetzt = (o) => kz(db, rechnung, o).k;
        const gesamt = jetzt({ from: '2026-07-01', to: '2026-08-31' });
        assert.strictEqual(gesamt.abgerechnet_projekt_eur, 0, name + ': abgerechnet ohne jede Rechnung');
        assert.strictEqual(gesamt.offen_eur, gesamt.wert.arbeitswert, name + ': offen ist der Arbeitswert, exakt');
        const jul = jetzt({ from: '2026-07-01', to: '2026-07-31' });
        const aug = jetzt({ from: '2026-08-01', to: '2026-08-31' });
        assert.strictEqual(jul.abgerechnet_projekt_eur + aug.abgerechnet_projekt_eur, 0, name);
        naeher(jul.offen_eur + aug.offen_eur, gesamt.offen_eur, name + ': Monate gegen Gesamt');
        // Gegenprobe der Zahlen: 9 h Claude zu 85 EUR + 2 h manuell zu 120 EUR
        if (name === 'glatt') naeher(gesamt.wert.arbeitswert, 9 * 85 + 2 * 120, 'Arbeitswert');
      }
    });
  }

  function mischsatzMitTeilrechnung() {
    umgebung((rechnung) => {
      const db = standard(); mischsatz(db);   // 6 h Claude zu 85 + 2 h manuell zu 120 = 750
      rechnung.erstelle(db, daten([{ name: P, stunden: 4 }]));
      const { k } = kz(db, rechnung);
      naeher(k.wert.arbeitswert, 750, 'Arbeitswert');
      // Durchschnitt (bekannte Grenze): halbe Stunden, halber Wert
      naeher(k.offen_eur, 375, 'offen');
      naeher(k.abgerechnet_gesamt_eur, 375, 'abgerechnet gesamt');
      naeher(k.abgerechnet_gesamt_eur + k.offen_eur, k.wert.arbeitswert, 'gesamt + offen');
      naeher(k.offen_stunden, 4, 'offen_stunden');
      // ganz berechnet
      rechnung.erstelle(db, daten([P]));
      const voll = kz(db, rechnung).k;
      assert.strictEqual(voll.offen_eur, 0);
      // der Arbeitswert folgt dem eingefrorenen Satz der berechneten Eintraege (85 statt 120): gesamt = Arbeitswert
      naeher(voll.abgerechnet_gesamt_eur, voll.wert.arbeitswert, 'alles berechnet');
      assert.ok(voll.abgerechnet_gesamt_eur > 0);
    });
  }

  function kundeGleichnamig() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const db = standard();
      const kunde = (firma) => Number(db.prepare("INSERT INTO kontakte (firma, email, erstellt_am) VALUES (?, 'a@example.org', 'x')").run(firma).lastInsertRowid);
      for (const id of [kunde(P), kunde('Nur Kunde')]) {
        db.prepare(`INSERT INTO zeit_eintrag (ziel_art, ziel_schluessel, start, ende, tag, taetigkeit, abrechenbar, rohzeit_min, gezaehlt_min, created_at)
          VALUES ('kunde', ?, '2026-08-21T12:00:00.000Z', '2026-08-21T13:00:00.000Z', '2026-08-21', 'Beratung', 1, 60, 60, '2026-08-21')`).run(String(id));
      }
      rechnung.erstelle(db, daten([P]));   // Projekt ganz berechnet: offen_h 0
      const o = { from: '2026-08-01', to: '2026-08-31' };
      const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
      assert.deepStrictEqual(zeilen.filter((z) => z.art === 'kunde').map((z) => z.gruppe).sort(), ['Konto-Projekt', 'Nur Kunde']);
      const konten = rechnung.projektKonten(db, zeilen, o);
      assert.deepStrictEqual([...konten.keys()], [P], 'Konten nur fuer Projektzeilen');
      for (const z of zeilen.filter((x) => x.art === 'kunde')) {
        const e = metrics.kennzahlen([z], rechnung.abrechnung(db), { projektKonto: konten });
        assert.strictEqual(e.offen_eur, z.arbeitswert, z.gruppe + ': Kundenzeile bleibt offen');
        assert.ok(z.arbeitswert > 0);
      }
    });
  }

  function ueberhangMelden() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const sicht = (db, o) => {
        const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
        return metrics.kennzahlen(zeilen, rechnung.abrechnung(db), { projektKonto: rechnung.projektKonten(db, zeilen, o) });
      };
      const db = standard();
      rechnungMit(db, [projektPos(10)]);   // 2 h mehr berechnet als geleistet
      assert.deepStrictEqual(sicht(db, { from: '2026-08-01' }).ueberhang, [{ projekt: P, ueber_h: 2 }], 'Heute-Sicht');
      // So schickt es die Oberflaeche: to = heute (Monat), auch ein Datum in der Zukunft
      const d = new Date(); const heute = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      assert.deepStrictEqual(sicht(db, { from: '2026-08-01', to: heute }).ueberhang, [{ projekt: P, ueber_h: 2 }], 'to = heute');
      assert.deepStrictEqual(sicht(db, { from: '2026-08-01', to: '2999-01-01' }).ueberhang, [{ projekt: P, ueber_h: 2 }], 'to in der Zukunft');
      assert.deepStrictEqual(sicht(db, { from: '2026-08-01', to: '2026-08-31' }).ueberhang, [], 'Vergangenheitssicht');
      assert.deepStrictEqual(sicht(db, { month: '2026-08' }).ueberhang, [], 'Monatssicht');
      // innerhalb der Toleranz (3 gerundete Zeitpositionen, je 0,005 h): keine Meldung
      const db2 = standard();
      rechnungMit(db2, [1, 2, 3].map(() => ({ typ: 'zeit', ziel_art: 'projekt', ziel: P, stunden: 2.67, betrag_eur: 227 })));
      assert.strictEqual(konto(db2).ueber_h, 0.01);
      assert.deepStrictEqual(sicht(db2, { from: '2026-08-01' }).ueberhang, [], 'Rundung ist kein Ueberhang');
      // nichts berechnet: leer
      assert.deepStrictEqual(sicht(standard(), { from: '2026-08-01' }).ueberhang, []);
    });
  }

  // Ein Aufrufer ohne Konto behielte still die alte Ganz-oder-gar-nicht-Zahl.
  function aufruferMitKonto() {
    const fs = require('node:fs');
    const path = require('node:path');
    const W = path.join(__dirname, '..', '..');
    let n = 0;
    for (const f of ['server.js', 'cira.js', 'briefings.js', 'herleitung.js', 'metrics.js']) {
      const src = fs.readFileSync(path.join(W, f), 'utf8');
      const re = /(?<![\w.])(?:metrics\.)?kennzahlen\((?!\))/g;   // ohne Kommentare mit leeren Klammern
      for (let m; (m = re.exec(src));) {
        const davor = src.slice(Math.max(0, m.index - 12), m.index);
        if (/function\s*$/.test(davor)) continue;   // die Definition selbst
        n += 1;
        assert.ok(/projektKonto/.test(src.slice(m.index, m.index + 400)), f + ': kennzahlen() ohne projektKonto bei Zeichen ' + m.index);
      }
    }
    assert.ok(n >= 6, 'nur ' + n + ' Aufrufer gefunden, Suche kaputt');
  }

  // --- Task 4: Editor liest vom Server, rechnet nichts ----------------------------------
  const T4 = {
    zeilen: 'B4 Vorschau liefert projekt_zeilen und hinweise',
    konten: 'B4 Konten fuer den Editor: offen, berechnet, nummern, ueber_h nur Heute-Sicht',
    name: 'B4 Druck: Projektposition ohne das Wort Vorgang (HTML und E-Rechnung)',
    alt: 'B4 Druck: alte Abschrift ohne projekt bleibt byte-gleich',
    route: 'B4 /api/summary reicht das Konto durch',
    rest: 'B4 Rest ohne Zeile im Zeitraum bleibt in der Auswahl (R12)',
    hinweis: 'B4 Hinweise: Projekt ohne Offenes, deutsche Zahl',
    kopf: 'B4 Vorschau meldet den geweiteten Kopfzeitraum',
    unbekannt: 'B4 (unbekannt) ist kein Projekt der Auswahl',
  };

  function vorschauZeilen() {
    umgebung((rechnung) => {
      const db = standard();
      let v = rechnung.vorschau(db, daten([{ name: P, stunden: 5 }]));
      assert.deepStrictEqual(v.projekt_zeilen, [{ projekt: P, berechnet_h: 5, kulanz_h: 0, offen_h: 3 }]);
      assert.deepStrictEqual(v.hinweise, []);
      v = rechnung.vorschau(db, daten([{ name: P, stunden: 5, kulanzRest: true }]));
      assert.deepStrictEqual(v.projekt_zeilen, [{ projekt: P, berechnet_h: 5, kulanz_h: 3, offen_h: 0 }], 'Kulanz-Rest');
      v = rechnung.vorschau(db, daten([{ name: P, stunden: 20 }]));
      assert.deepStrictEqual(v.projekt_zeilen, [{ projekt: P, berechnet_h: 8, kulanz_h: 0, offen_h: 0 }], 'auf offen begrenzt');
      assert.strictEqual(v.hinweise.length, 1);
      assert.ok(/auf die offenen 8 h begrenzt/.test(v.hinweise[0]), v.hinweise[0]);
      // ohne Projektposition: leere Liste, kein Fehlen des Feldes
      v = rechnung.vorschau(db, { from: '2026-08-01', to: '2026-08-31', eintraege: [manuellId(db)], empfaenger: KUNDE });
      assert.deepStrictEqual(v.projekt_zeilen, []);
    });
  }

  function kontenFuerEditor() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const anzeige = (db, o) => {
        const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
        const k = rechnung.projektKonten(db, zeilen, o);
        return rechnung.projektKontenAnzeige(k, metrics.kennzahlen(zeilen, rechnung.abrechnung(db), { projektKonto: k }).ueberhang)[P];
      };
      const db = standard();
      assert.deepStrictEqual(anzeige(db, { from: '2026-08-01' }), { geleistet_h: 8, berechnet_h: 0, offen_h: 8, ueber_h: 0, nummern: [], letzter_tag: '2026-08-20' });
      const nr = rechnungMit(db, [projektPos(5)]);
      assert.deepStrictEqual(anzeige(db, { from: '2026-08-01' }), { geleistet_h: 8, berechnet_h: 5, offen_h: 3, ueber_h: 0, nummern: [nr], letzter_tag: '2026-08-20' });
      const db2 = standard();
      rechnungMit(db2, [projektPos(10)]);
      assert.strictEqual(anzeige(db2, { from: '2026-08-01' }).ueber_h, 2, 'Heute-Sicht zeigt den Ueberhang');
      assert.strictEqual(anzeige(db2, { from: '2026-08-01' }).offen_h, 0);
      assert.strictEqual(anzeige(db2, { from: '2026-08-01', to: '2026-08-31' }).ueber_h, 0, 'Vergangenheitssicht: nie als Zahl');
    });
  }

  function druckOhneVorgang() {
    umgebung((rechnung) => {
      const erechnung = require('../../erechnung');
      const db = standard();
      const inv = rechnung.erstelle(db, daten([{ name: P, stunden: 5, kulanzRest: true }]));
      const html = rechnung.renderHtml(inv);
      assert.ok(html.includes('Entwicklungsleistung Projekt ' + P), 'HTML nennt das Projekt');
      assert.ok(!/Entwicklungsleistung Vorgang/.test(html), 'HTML: Vorgang bei Projektposition');
      // Pflichtangaben der E-Rechnung ergaenzen (die Abschrift des Tests hat nur Name und Anschrift).
      const voll = {
        ...inv, nr: '2026-0001',
        aussteller: { ...inv.aussteller, email: 'a@test.de', telefon: '0221 123456', land: 'DE' },
        empfaenger: { name: 'Kunde', anschrift: ['Kundenstr. 2', '50667 Koeln'], kundennummer: 'K-1', email: 'k@test.de', land: 'DE' },
      };
      assert.deepStrictEqual(erechnung.pruefe(voll), [], 'Testrechnung nicht als E-Rechnung gueltig');
      const xml = erechnung.alsXml(voll);
      assert.ok(xml.includes('Entwicklungsleistung Projekt ' + P), 'E-Rechnung nennt das Projekt');
      assert.ok(!/Entwicklungsleistung Vorgang/.test(xml), 'E-Rechnung: Vorgang bei Projektposition');
    });
  }

  function druckAlt() {
    const rechnung = require('../../rechnung');
    // Literal aus dem Stand vor Block B (HEAD b2f7ecc): alte Abschriften drucken weiter "Vorgang".
    const erwartet = [
      '', '      <tr>', '        <td>', '          Entwicklungsleistung Vorgang XY-1<br>', '          <span class="klein"></span>', '        </td>',
      '        <td class="r">1,00</td>', '        <td class="r">85,00 EUR</td>', '        <td class="r">85,00 EUR</td>', '      </tr>',
    ].join('\n');
    assert.strictEqual(rechnung.positionsZeilen([{ ticket: 'XY-1', stunden: 1, satz: 85, betrag_eur: 85 }], 'rechnung'), erwartet);
    // auch eine alte Projektposition ohne Feld projekt (ohne_vorgangsnummer) bleibt "Vorgang"
    assert.ok(rechnung.positionsZeilen([{ ticket: P, ohne_vorgangsnummer: true, stunden: 1, satz: 85, betrag_eur: 85 }], 'rechnung').includes('Entwicklungsleistung Vorgang ' + P));
    assert.strictEqual(rechnung.positionsName({ bezeichnung: 'Frei', projekt: P }), 'Frei', 'eigene Bezeichnung geht vor');
    // E-Rechnung: dieselbe Abschrift ohne Feld projekt (so sahen alte Projektpositionen aus) nennt weiter den Vorgang
    umgebung((r2) => {
      const inv = r2.erstelle(standard(), daten([{ name: P, stunden: 5 }]));
      const alt = { ...inv, nr: '2026-0001', positionen: inv.positionen.map(({ projekt, ...rest }) => rest),
        aussteller: { ...inv.aussteller, email: 'a@test.de', telefon: '0221 123456', land: 'DE' },
        empfaenger: { name: 'Kunde', anschrift: ['Kundenstr. 2', '50667 Koeln'], kundennummer: 'K-1', email: 'k@test.de', land: 'DE' } };
      const xml = require('../../erechnung').alsXml(alt);
      assert.ok(xml.includes('Entwicklungsleistung Vorgang ' + P), 'E-Rechnung alte Abschrift');
      assert.ok(!xml.includes('Entwicklungsleistung Projekt'), 'E-Rechnung alte Abschrift: Projekt-Wort');
    });
  }

  function summaryRoute() {
    const fs = require('node:fs');
    const src = fs.readFileSync(require('node:path').join(__dirname, '..', '..', 'server.js'), 'utf8');
    assert.ok(/projekt_konto:\s*rechnung\.projektKontenAnzeige\(konten, kz\.ueberhang, rechnung\.projektKontenRest\(db, konten, o\)\)/.test(src), '/api/summary liefert projekt_konto nicht');
    assert.ok(/projektKonto:\s*konten/.test(src), 'kennzahlen bekommt ein anderes Konto als projekt_konto');
  }

  function restAusserhalb() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const okt = { from: '2026-10-01', to: '2026-10-30' };
      const db = standard();   // Arbeit am 18. bis 20. August, 8 h
      rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));   // Teilrechnung im August, Rest 3 h
      const sicht = () => {
        const zeilen = metrics.byTicket(db, okt).concat(metrics.ohneTicket(db, okt));
        const konten = rechnung.projektKonten(db, zeilen, okt);
        return { zeilen, konten, rest: rechnung.projektKontenRest(db, konten, okt) };
      };
      const x = sicht();
      assert.ok(!x.zeilen.some((z) => z.gruppe === P), 'Voraussetzung: im Oktober keine Zeile');
      const a = rechnung.projektKontenAnzeige(x.konten, [], x.rest)[P];
      assert.deepStrictEqual(a && [a.offen_h, a.berechnet_h, a.geleistet_h], [3, 5, 8], 'Rest fehlt in der Anzeige');
      // Werkzeugprojekt: nie angeboten
      manuell(db, '2026-08-21', 60, { projekt: '(cira)' });
      assert.ok(!sicht().rest.has('(cira)'), 'Werkzeugprojekt in der Auswahl');
      // Die Rechnung findet die Stunden, obwohl sie vor dem gewaehlten from liegen; der Kopf reicht zurueck
      const e = rechnung.entwurf(db, { from: '2026-10-01', to: '2026-10-30', projekte: [P], empfaenger: KUNDE });
      assert.strictEqual(projektPositionen(e)[0].stunden, 3);
      assert.ok(e.leistung_von <= '2026-08-20', 'Kopf reicht nicht zurueck: ' + e.leistung_von);
      // ganz berechnet: nicht mehr angeboten
      rechnung.erstelle(db, daten([P]));
      assert.ok(!sicht().rest.has(P), 'Projekt ohne Offenes in der Auswahl');
    });
  }

  function hinweiseLeerUndKomma() {
    umgebung((rechnung) => {
      const db = standard();
      rechnung.erstelle(db, daten([P]));   // alles berechnet
      manuell(db, '2026-08-21', 90, { projekt: 'Zweit' });   // 1,5 h offen
      let v = rechnung.vorschau(db, daten([P, 'Zweit']));
      assert.ok(v.hinweise.some((h) => /^Projekt Konto-Projekt: nichts Offenes/.test(h)), JSON.stringify(v.hinweise));
      v = rechnung.vorschau(db, daten([{ name: 'Zweit', stunden: 5 }]));
      assert.ok(v.hinweise.some((h) => /auf die offenen 1,5 h begrenzt/.test(h)), JSON.stringify(v.hinweise));
    });
  }

  function kopfzeitraumVorschau() {
    umgebung((rechnung) => {
      const db = standard();   // Arbeit 18. bis 20. August
      rechnung.erstelle(db, daten([{ name: P, stunden: 5 }]));
      const v = rechnung.vorschau(db, { from: '2026-10-01', to: '2026-10-30', projekte: [P], empfaenger: KUNDE });
      assert.ok(v.leistung_von && v.leistung_von <= '2026-08-20', 'Vorschau meldet den Kopf nicht: ' + v.leistung_von);
      assert.strictEqual(v.leistung_bis, '2026-10-30');
      // dasselbe wie der Beleg, den erstelle() schreibt
      const inv = rechnung.erstelle(db, { from: '2026-10-01', to: '2026-10-30', projekte: [P], empfaenger: KUNDE });
      assert.deepStrictEqual([v.leistung_von, v.leistung_bis], [inv.leistung_von, inv.leistung_bis], 'Vorschau und Beleg widersprechen sich');
      // ohne Projektposition: genau der gewaehlte Zeitraum
      const db2 = standard();
      const w = rechnung.vorschau(db2, { from: '2026-08-01', to: '2026-08-31', eintraege: [manuellId(db2)], empfaenger: KUNDE });
      assert.deepStrictEqual([w.leistung_von, w.leistung_bis], ['2026-08-01', '2026-08-31']);
    });
  }

  function unbekanntKeinProjekt() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const db = standard();
      manuell(db, '2026-08-22', 60, { projekt: '(unbekannt)' });
      manuell(db, '2026-08-22', 60, { projekt: 'Echt' });
      const namen = metrics.projektNamen(db);
      assert.ok(!namen.includes('(unbekannt)'), '(unbekannt) als Projekt angeboten');
      assert.ok(namen.includes('Echt') && namen.includes(P), 'Gegenprobe: echte Projekte fehlen');
    });
  }

  // --- Fixwelle nach den Gesamt-Reviews (final-findings.md) ---------------------------
  const TF = {
    basissatz: 'F1 Basissatz: Rabatt rechnet vom gedruckten Satz, je Weg',
    kulanzSchutz: 'F2 Kulanz-Rest: mehr Stunden als gezeigt scheitern',
    buchen: 'F3 Sitzung buchen: gestellte Stunde bleibt auf dem Projekt',
    verwaist: 'F4 Verwaistes Konto: Ueberhang sichtbar',
    gestiegen: 'F5 Hinweis: offene Stunden in berechneten Tagen',
    ohneKonto: 'F6 kennzahlen: Projektzeile ohne Konto wirft',
    kaputtIds: 'F7 Nachrechnen nennt die kaputten Eintraege',
    hinweise: 'F9 Hinweise gehen nach aussen, Cira nennt sie',
    unlesbar: 'F10 Unlesbare Abschrift nennt die Nummer',
    einmal: 'F15 berechnetJe wird einmal gelesen',
    grenze: 'F16 Fehlertext nennt die Obergrenze',
    label: 'F17 Cira-Label traegt den Bezug',
    plugin: 'F13 Plugin-Pfade: Dateien, ausserhalb, fehlender installPath',
    proto: 'F14 Projektname __proto__ und constructor',
  };
  // Vorgangsarbeit im Testprojekt: 2 h am Tag, Vorgang XY-1.
  function vorgang(db, tag) {
    const ein = db.prepare('INSERT INTO activity (session_id, ts, project, branch, ticket, day) VALUES (?,?,?,?,?,?)');
    for (let m = 0; m <= 120; m += 2) ein.run('v-' + tag, new Date(Date.parse(tag + 'T14:00:00Z') + m * 60000).toISOString(), P, 'main', 'XY-1', tag);
    db.prepare(`INSERT INTO events (request_id, ts, session_id, project, branch, ticket, model, input_tokens, output_tokens,
      cache_w_5m, cache_w_1h, cache_read, web_search, cost_usd, is_sidechain, day)
      VALUES (?,?,?,?,?,?,?,10,10,0,0,0,0,0.1,0,?)`).run('rv-' + tag, tag + 'T14:00:00.000Z', 'v-' + tag, P, 'main', 'XY-1', 'claude-opus-5', tag);
  }
  const sichtFix = (rechnung, db, o) => {
    const metrics = require('../../metrics');
    const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
    const konten = rechnung.projektKonten(db, zeilen, o);
    const kz = metrics.kennzahlen(zeilen, rechnung.abrechnung(db), { projektKonto: konten });
    return { konten, kz, anzeige: rechnung.projektKontenAnzeige(konten, kz.ueberhang, rechnung.projektKontenRest(db, konten, o)) };
  };

  function basissatz() {
    umgebung((rechnung) => {
      const config = require('../../config.json');
      config.projektSaetze = { [P]: { satz: 100, rabatt: 10 } };
      const db = standard();
      vorgang(db, '2026-08-21');
      const inv = rechnung.erstelle(db, daten([P], { tickets: ['XY-1'] }));
      const weg = { Projekt: inv.positionen.find((p) => p.projekt), Vorgang: inv.positionen.find((p) => p.ticket === 'XY-1') };
      for (const [name, p] of Object.entries(weg)) {
        assert.deepStrictEqual([p.basissatz, p.rabatt_prozent, p.satz], [100, 10, 90], name);
        naeher(p.basissatz * (1 - p.rabatt_prozent / 100), p.satz, name + ': Rabatt fuehrt nicht zum Satz');
      }
      const html = rechnung.renderHtml(inv);
      assert.ok(html.includes('100,00 EUR/h abzgl. 10 % Rabatt') && !html.includes('85,00 EUR/h abzgl.'), 'Druck nennt den falschen Basissatz');
      // Angebot nimmt denselben Wert
      const a = require('../../angebot').erstelle(db, { from: '2026-08-01', to: '2026-08-31', tickets: ['XY-1'], empfaenger: KUNDE });
      assert.strictEqual(a.positionen[0].basissatz, 100, 'Angebot');
      // Eine alte Abschrift traegt ihren Wert und druckt ihn weiter (unveraenderlich), auch wenn er falsch war
      const alt = rechnung.positionsZeilen([{ ticket: 'XY-1', stunden: 1, satz: 90, basissatz: 85, rabatt_prozent: 10, betrag_eur: 90 }], 'rechnung');
      assert.ok(alt.includes('85,00 EUR/h abzgl. 10 % Rabatt'), 'alte Abschrift veraendert');
    });
  }

  function kulanzSchutz() {
    umgebung((rechnung) => {
      const anzahl = (db) => db.prepare('SELECT COUNT(*) AS n FROM invoices').get().n;
      const w = daten([{ name: P, stunden: 5, kulanzRest: true }]);
      const lauf = (stelle) => {
        const db = standard();
        const v = rechnung.vorschau(db, w);
        assert.strictEqual(v.stunden_summe, 8, 'Vorschau nennt die Stunden');
        manuell(db, '2026-08-21', 60);   // Zeit laeuft auf: der Betrag bleibt, die Kulanz waechst auf 4 h
        assert.strictEqual(rechnung.vorschau(db, w).brutto_eur, v.brutto_eur, 'Voraussetzung: gleicher Betrag');
        const e = fehler(() => stelle(db, { ...w, erwartetBrutto: v.brutto_eur, erwartetStunden: v.stunden_summe }));
        assert.ok(e && (e.abweichung === true), e ? e.message : 'mehr Kulanz als gezeigt gestellt');
        assert.ok(/Stunden/.test(e.message), e.message);
        assert.strictEqual(anzahl(db), 0, 'trotzdem geschrieben');
        return { db, v };
      };
      // Editor-Weg, Freigabe-Weg
      const { db, v } = lauf((d, x) => rechnung.erstelle(d, x));
      require('../../server');
      const freigabe = require('../../freigaben').REGISTRY.get('rechnung');
      const f = lauf((d, x) => freigabe(d, x, {}));
      // Passt die Vorschau, geht es
      const v2 = rechnung.vorschau(f.db, w);
      assert.ok(freigabe(f.db, { ...w, erwartetBrutto: v2.brutto_eur, erwartetStunden: v2.stunden_summe }, {}).nr, 'gleiche Stunden muessen durchgehen');
      // Ohne das Feld (alte Aufrufer): wie bisher
      assert.ok(rechnung.erstelle(db, { ...w, erwartetBrutto: v.brutto_eur }).nr, 'ohne Feld wie bisher');
      assert.ok(/erwartetStunden/.test(fehler(() => rechnung.pruefeErwartet({ brutto_eur: 1, positionen: [] }, 1, 'x')).message));
    });
  }

  function buchenSperrt() {
    umgebung((rechnung) => {
      const { bucheVorgang } = require('../../server');
      const sid = 's-2026-08-19';
      const db = standard();
      rechnung.erstelle(db, daten([P]));   // alle 8 h stehen auf der Rechnung
      const e = fehler(() => bucheVorgang(db, { session_id: sid, vorgang: 'XY-9' }));
      assert.ok(e && e.status === 409, e ? e.message : 'gestellte Stunde auf Vorgang gebucht');
      assert.strictEqual(e.message, 'Auf ' + P + ' ist schon etwas in Rechnung gestellt — die Zeit bleibt dort, sonst wäre sie unter dem Jira-Ticket ein zweites Mal abrechenbar.');
      // Nichts blieb stehen
      assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM overrides').get().n, 0, 'Override blieb');
      assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM activity WHERE ticket IS NOT NULL').get().n, 0, 'Zuordnung blieb');
      assert.strictEqual(konto(db).ueber_h, 0);
      assert.strictEqual(konto(db).geleistet_h, 8);
      // Liegt die Sitzung im Offenen, geht es: 3 h offen, die Sitzung hat 3 h
      const db2 = standard();
      rechnung.erstelle(db2, daten([{ name: P, stunden: 5 }]));
      assert.strictEqual(bucheVorgang(db2, { session_id: sid, vorgang: 'XY-9' }).ticket, 'XY-9');
      assert.deepStrictEqual([konto(db2).geleistet_h, konto(db2).ueber_h], [5, 0]);
      // Projekt ohne Rechnung: wie bisher
      assert.strictEqual(bucheVorgang(standard(), { session_id: sid, vorgang: 'XY-9' }).ticket, 'XY-9');
      // Sitzung auf einem gestellten Vorgang: weder auf einen anderen Vorgang noch zurueck ins Ticketlose
      const db3 = standard();
      vorgang(db3, '2026-08-21');
      rechnung.erstelle(db3, daten([P], { tickets: ['XY-1'] }));
      const gestellt = 'v-2026-08-21';
      for (const ziel of ['XY-2', '']) {
        const e3 = fehler(() => bucheVorgang(db3, { session_id: gestellt, vorgang: ziel }));
        assert.ok(e3 && e3.status === 409 && e3.message.includes('XY-1'), e3 ? e3.message : 'gestellte Sitzung wechselt nach "' + ziel + '"');
      }
      assert.strictEqual(db3.prepare('SELECT COUNT(*) AS n FROM overrides').get().n, 0, 'Override blieb');
      assert.strictEqual(db3.prepare("SELECT COUNT(*) AS n FROM activity WHERE session_id = ? AND ticket = 'XY-1'").get(gestellt).n > 0, true, 'Zuordnung verschwand');
      // Derselbe Vorgang (auch klein geschrieben) aendert nichts und bleibt erlaubt
      assert.strictEqual(bucheVorgang(db3, { session_id: gestellt, vorgang: 'xy-1' }).ticket, 'XY-1');
      // Arbeit nach dem gestellten Stand ist frei
      vorgang(db3, '2026-09-02');
      assert.strictEqual(bucheVorgang(db3, { session_id: 'v-2026-09-02', vorgang: 'XY-2' }).ticket, 'XY-2');
      // Storno gibt die Sitzung frei
      const db4 = standard();
      vorgang(db4, '2026-08-21');
      rechnung.storniere(db4, rechnung.erstelle(db4, daten([P], { tickets: ['XY-1'] })).nr);
      assert.strictEqual(bucheVorgang(db4, { session_id: gestellt, vorgang: 'XY-2' }).ticket, 'XY-2');
      assert.ok(/\.\.\.bucheVorgang\(db, daten\) \}\);\s+\} catch \(err\) \{\s+return sendJson\(res, \{ error: err\.message \}, err\.status \|\| 400\);/.test(quelle('server.js')), '/api/buchen reicht den Status nicht durch');
    });
  }

  function verwaist() {
    umgebung((rechnung) => {
      const db = standard();
      rechnung.erstelle(db, daten([P]));
      // Ordner umbenannt: die Arbeit steht unter dem neuen Namen, die Rechnung unter dem alten
      db.prepare("UPDATE activity SET project = 'Neu'").run();
      db.prepare("UPDATE events SET project = 'Neu'").run();
      db.prepare("UPDATE zeit_eintrag SET ziel_schluessel = 'Neu'").run();
      for (const o of [{ from: '2026-08-01' }, { from: '2026-10-01' }]) {
        const { kz, anzeige } = sichtFix(rechnung, db, o);
        assert.deepStrictEqual(kz.ueberhang, [{ projekt: P, ueber_h: 8 }], 'Hub ' + o.from);
        assert.strictEqual(anzeige[P] && anzeige[P].ueber_h, 8, 'Anzeige ' + o.from);
      }
      // Vergangenheitssicht meldet nichts (R4)
      assert.deepStrictEqual(sichtFix(rechnung, db, { from: '2026-08-01', to: '2026-08-31' }).kz.ueberhang, []);
      assert.ok(!(P in sichtFix(rechnung, db, { from: '2026-08-01', to: '2026-08-31' }).anzeige));
      // Gegenprobe: ein Projekt ohne Ueberhang steht nicht in den Konten
      const db2 = standard();
      rechnung.erstelle(db2, daten([P]));
      assert.ok(!sichtFix(rechnung, db2, { from: '2026-10-01' }).konten.has(P));
    });
  }

  function gestiegen() {
    umgebung((rechnung) => {
      const TEXT = 'offene Stunden liegen in bereits berechneten Tagen — Zeitmodell oder Einlesen geändert?';
      const o = { from: '2026-08-01' };
      const db = standard();
      rechnung.erstelle(db, daten([P]));   // bis 20.08. voll berechnet
      assert.strictEqual(sichtFix(rechnung, db, o).anzeige[P].hinweis, undefined, 'nichts offen, kein Hinweis');
      db.prepare('UPDATE zeit_eintrag SET gezaehlt_min = 180').run();   // spaeter eingelesen: ein berechneter Tag waechst
      assert.strictEqual(konto(db).offen_h, 1);
      assert.ok(rechnung.vorschau(db, daten([P])).hinweise.includes('Projekt ' + P + ': ' + TEXT), 'Vorschau');
      assert.strictEqual(sichtFix(rechnung, db, o).anzeige[P].hinweis, TEXT, 'Anzeige');
      // Nur Hinweis, keine Sperre (R14); die Vergangenheitssicht meldet nichts
      assert.strictEqual(sichtFix(rechnung, db, { from: '2026-08-01', to: '2026-08-31' }).anzeige[P].hinweis, undefined, 'Vergangenheitssicht');
      assert.ok(rechnung.erstelle(db, daten([P])).nr, 'Hinweis sperrt nicht');
      // Gegenprobe: neue Arbeit nach dem letzten berechneten Tag ist kein Fall
      const db2 = standard();
      rechnung.erstelle(db2, daten([P]));
      manuell(db2, '2026-08-25', 60);
      assert.deepStrictEqual(rechnung.vorschau(db2, daten([P])).hinweise, []);
      assert.strictEqual(sichtFix(rechnung, db2, o).anzeige[P].hinweis, undefined);
      // Gegenprobe: Teilrechnung, der Rest liegt hinter dem letzten berechneten Tag
      const db3 = standard();
      rechnung.erstelle(db3, daten([{ name: P, stunden: 5 }]));
      assert.deepStrictEqual(rechnung.vorschau(db3, daten([P])).hinweise, []);
    });
  }

  function ohneKonto() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const o = { from: '2026-08-01', to: '2026-08-31' };
      const db = standard();
      const zeilen = metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o));
      assert.ok(zeilen.some((z) => z.art === 'projekt'), 'Voraussetzung: Projektzeile');
      for (const [name, zusatz] of [['ohne Konto', {}], ['leeres Konto', { projektKonto: new Map() }]]) {
        const e = fehler(() => metrics.kennzahlen(zeilen, rechnung.abrechnung(db), zusatz));
        assert.ok(e && e.message.includes(P), name + ': still als ganz offen gerechnet');
      }
      // Ohne Projektzeilen bleibt es, wie es war
      assert.strictEqual(metrics.kennzahlen([{ ticket: 'XY-1', arbeitswert: 10, active_hours: 1 }, { gruppe: 'K', art: 'kunde', arbeitswert: 5 }], {}).offen_eur, 15);
    });
  }

  function kaputteIds() {
    const zeit = require('../../zeit');
    const db = standard();
    const id = manuellId(db);
    db.prepare("UPDATE zeit_eintrag SET start = '2026-08-20Tkaputt' WHERE id = ?").run(id);
    const e = fehler(() => zeit.nachrechnen(db, { seitStunden: Infinity }));
    assert.ok(e && e.message.includes('#' + id), e ? e.message : 'kaputter Eintrag still uebergangen');
    assert.ok(/1 Eintrag/.test(e.message), e.message);
  }

  function hinweiseNachAussen() {
    umgebung((rechnung) => {
      const w = daten([{ name: P, stunden: 99 }]);
      const inv = rechnung.erstelle(standard(), w);
      assert.ok(inv.hinweise.some((h) => /begrenzt/.test(h)), 'erstelle verschweigt die Begrenzung');
      assert.strictEqual(projektPositionen(inv)[0].stunden, 8);
      // Freigabe-Weg (derselbe wie POST /api/rechnung)
      require('../../server');
      const db2 = standard();
      const v = rechnung.vorschau(db2, w);
      const r = require('../../freigaben').REGISTRY.get('rechnung')(db2, { ...w, erwartetBrutto: v.brutto_eur }, {});
      assert.ok(Array.isArray(r.hinweise) && r.hinweise.some((h) => /begrenzt/.test(h)), 'Antwort ohne Hinweis');
      // Cira nennt sie im Entwurf und gibt die Stunden in die Nutzlast
      const db3 = standard();
      rechnung.erstelle(db3, daten([P]));
      db3.prepare('UPDATE zeit_eintrag SET gezaehlt_min = 180').run();
      const kid = Number(db3.prepare("INSERT INTO kontakte (firma, email, erstellt_am) VALUES ('Kunde', 'a@example.org', 'x')").run().lastInsertRowid);
      require('../../kontakte').setzeProjekte(db3, kid, [P]);
      const c = require('../../cira').rechnungsEntwurf(db3, P);
      assert.ok(/offene Stunden liegen in bereits berechneten Tagen/.test(c.antwort), c.antwort);
      const f = require('../../freigaben').liste(db3).find((x) => x.id === c.freigabe_id);
      assert.ok(/offene Stunden liegen in bereits berechneten Tagen/.test(f.text), f.text);
      assert.strictEqual(f.nutzlast.erwartetStunden, 1, 'Nutzlast ohne Stunden');
    });
  }

  function abschriftUnlesbar() {
    umgebung((rechnung) => {
      for (const roh of ['{kaputt', 'null', '{}']) {
        const db = standard();
        const nr = rechnungMit(db, []);
        db.prepare('UPDATE invoices SET positionen = ? WHERE nr = ?').run(roh, nr);
        for (const [name, fn] of Object.entries({
          projektKonto: () => konto(db), abrechnung: () => rechnung.abrechnung(db), abgerechnetBis: () => rechnung.abgerechnetBis(db),
          abgerechnetFuerVorgang: () => rechnung.abgerechnetFuerVorgang(db, 'XY-1'), gestelltAuf: () => rechnung.gestelltAuf(db, 'XY-1'),
        })) {
          const e = fehler(fn);
          assert.ok(e && e.message.includes('Rechnung ' + nr), name + ' ' + roh + ': ' + (e ? e.message : 'still uebergangen'));
        }
      }
    });
  }

  function berechnetEinmal() {
    umgebung((rechnung) => {
      const metrics = require('../../metrics');
      const db = standard();
      manuell(db, '2026-08-21', 60, { projekt: 'Zweit' });
      rechnungMit(db, [projektPos(1)]);
      const orig = db.prepare.bind(db);
      let n = 0;
      db.prepare = (sql) => { if (/^SELECT nr, positionen FROM invoices/.test(sql)) n += 1; return orig(sql); };
      const namen = metrics.ohneTicket(db, {}).map((t) => t.gruppe);
      n = 0;
      rechnung.offeneDaten(db, { projekte: namen });
      assert.strictEqual(n, 1, 'offeneDaten liest die Abschriften ' + n + '-mal');
      const o = { from: '2026-10-01' };
      const konten = rechnung.projektKonten(db, [], o);
      n = 0;
      rechnung.projektKontenRest(db, konten, o);
      assert.strictEqual(n, 0, 'projektKontenRest liest die Abschriften neu');
    });
  }

  function grenzeImText() {
    umgebung((rechnung) => {
      const e = fehler(() => rechnung.entwurf(standard(), daten([{ name: P, stunden: 2e6 }])));
      assert.ok(e && /1\.000\.000/.test(e.message), e && e.message);
      const b = fehler(() => rechnung.entwurf(standard(), daten([{ name: P, betrag: 2e6 }])));
      assert.ok(b && /1\.000\.000/.test(b.message), b && b.message);
      const p = fehler(() => rechnung.entwurf(standard(), daten([{ name: P, prozent: 101 }])));
      assert.ok(p && /bis 100 /.test(p.message), p && p.message);
    });
  }

  function ciraLabel() {
    assert.ok(/k: 'Abgerechnet',[^\n]*u: 'Arbeitswert auf gestellten Rechnungen'/.test(quelle('cira.js')), 'Label ohne Bezug');
  }

  function pluginPfade() {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const wz = require('../../werkzeuge');
    const heim = fs.mkdtempSync(path.join(os.tmpdir(), 'b-plugin-'));
    try {
      const schreib = (rel, t) => { const d = path.join(heim, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, t); };
      const md = (b) => '---\ndescription: ' + b + '\n---\nText';
      const ort = (n) => [{ scope: 'user', installPath: path.join(heim, 'cache', n) }];
      schreib('.claude/settings.json', '{}');
      schreib('.claude/plugins/known_marketplaces.json', '{}');
      schreib('.claude/plugins/installed_plugins.json', JSON.stringify({ plugins: {
        'p@m': ort('p'), 'datei@m': ort('datei'), 'ohne@m': [{ scope: 'user' }], 'weg@m': ort('gibt-es-nicht'),
      } }));
      // Manifest-Pfade: einzelne .md, Ordner, ausserhalb (relativ und absolut), keine .md, Datei bei Skills, fehlt
      schreib('draussen/geheim.md', md('Geheim'));
      // Windows: "D:foo" ist nicht absolut, fuehrt aber auf ein anderes Laufwerk
      const fremdLaufwerk = process.platform === 'win32' ? [(/^d:/i.test(heim) ? 'E' : 'D') + ':fremd'] : [];
      schreib('cache/p/.claude-plugin/plugin.json', JSON.stringify({ name: 'p',
        agents: ['./extra/eins.md', './mehr', '../../draussen/geheim.md', path.join(heim, 'draussen', 'geheim.md'), path.join(heim, 'cache', 'p', 'extra', 'absolut.md'), './notiz.txt', './fehlt', ...fremdLaufwerk],
        commands: './cmd/zwei.md', skills: ['./skill.md'] }));
      schreib('cache/p/extra/eins.md', md('Eins'));
      schreib('cache/p/extra/absolut.md', md('Absolut'));
      schreib('cache/p/mehr/drei.md', md('Drei'));
      schreib('cache/p/notiz.txt', 'x');
      schreib('cache/p/cmd/zwei.md', md('Zwei'));
      schreib('cache/p/skill.md', md('Skill'));
      // Standardordner ist eine Datei: bleibt still
      schreib('cache/datei/.claude-plugin/plugin.json', JSON.stringify({ name: 'datei' }));
      schreib('cache/datei/agents', 'eine Datei');
      const inv = wz.inventar({ heim, bereiche: [], lager: null, kontext: {} });
      const namen = (art) => inv.arten[art].filter((e) => e.herkunft === 'plugin').map((e) => e.name).sort();
      assert.deepStrictEqual(namen('agents'), ['p:drei', 'p:eins'], 'Agents');
      assert.deepStrictEqual(namen('commands'), ['p:zwei'], 'Commands');
      assert.strictEqual(inv.arten.agents.find((e) => e.name === 'p:eins').beschreibung, 'Eins');
      const je = (t) => inv.ebenenFehler.filter((f) => t.test(f.grund));
      assert.strictEqual(je(/außerhalb/).length, 3 + fremdLaufwerk.length, 'ausserhalb: ' + JSON.stringify(inv.ebenenFehler));
      assert.ok(je(/außerhalb/).every((f) => f.datei.startsWith('p@m: ')), JSON.stringify(inv.ebenenFehler));
      assert.deepStrictEqual(je(/weder/).map((f) => path.basename(f.datei)).sort(), ['notiz.txt', 'skill.md'], 'Datei ohne .md oder bei Skills');
      assert.deepStrictEqual(je(/^fehlt$/).map((f) => path.basename(f.datei)), ['fehlt'], 'Pfad aus dem Manifest fehlt');
      assert.deepStrictEqual(je(/installPath/).map((f) => f.datei).sort(), ['ohne@m', 'weg@m'], 'installPath');
      assert.ok(!inv.ebenenFehler.some((f) => f.datei.includes('datei@m') || f.datei.includes(path.join('datei', 'agents'))), 'Standardordner als Datei bleibt still');
    } finally { fs.rmSync(heim, { recursive: true, force: true }); }
  }

  function prototypSchluessel() {
    umgebung((rechnung) => {
      const db = standard();
      for (const name of ['__proto__', 'constructor']) manuell(db, '2026-08-21', 60, { projekt: name });
      const { anzeige } = sichtFix(rechnung, db, { from: '2026-08-01' });
      const j = JSON.parse(JSON.stringify(anzeige));
      for (const name of ['__proto__', 'constructor']) {
        assert.ok(Object.hasOwn(anzeige, name), name + ' fehlt');
        assert.strictEqual(anzeige[name].offen_h, 1, name);
        assert.ok(Object.hasOwn(j, name), name + ' fehlt im JSON');
      }
      assert.strictEqual(anzeige[P].offen_h, 8);
      // Rest ohne Zeile im Zeitraum: dieselbe Anzeige
      const r = sichtFix(rechnung, db, { from: '2026-10-01' }).anzeige;
      assert.ok(Object.hasOwn(r, '__proto__') && r.__proto__.offen_h === 1, 'Rest __proto__');
    });
  }

  return [
    [TF.ohneKonto, ohneKonto], [TF.kaputtIds, kaputteIds], [TF.hinweise, hinweiseNachAussen], [TF.unlesbar, abschriftUnlesbar], [TF.einmal, berechnetEinmal],
    [TF.grenze, grenzeImText], [TF.label, ciraLabel], [TF.plugin, pluginPfade], [TF.proto, prototypSchluessel],
    [TF.basissatz, basissatz], [TF.kulanzSchutz, kulanzSchutz], [TF.buchen, buchenSperrt], [TF.verwaist, verwaist], [TF.gestiegen, gestiegen],
    [T3.mischsatz, mischsatzOhneRechnung], [T3.durchschnitt, mischsatzMitTeilrechnung], [T3.kollision, kundeGleichnamig], [T3.ueberhang, ueberhangMelden],
    [T3.sinkt, ohneVorgangSinkt], [T3.plausibel, plausibel], [T3.doppelt, nichtDoppeltAbgezogen], [T3.vergangen, vergangenerZeitraum], [T3.aufrufer, aufruferMitKonto],
    ['B1 Konto: geleistet = Claude ohne Vorgang + manuelle Projekt-Eintraege', geleistet],
    ['B1 Konto: berechnet aus Abschriften, Storno zaehlt nicht', berechnetStorno],
    ['B1 Konto: Kulanz und Zeitposition zaehlen mit', kulanzUndZeit],
    ['B1 Konto: nie negativ', niemalsNegativ],
    ['B1 Einheiten: Summe gleich ohneTicket', einheitenAdditiv],
    [T2.teil, teil], [T2.zweite, zweite], [T2.prozentBetrag, prozentBetrag], [T2.betragKlein, betragKlein],
    [T2.niedoppelt, nieDoppelt], [T2.zweiWege, zweiWege], [T2.fifo, fifo], [T2.kulanzRest, kulanzRest],
    [T2.storno, storno], [T2.pauschale, pauschale], [T2.drift, drift], [T2.nachrechnen, nachrechnen], [T2.wunschForm, wunschForm],
    [T4.zeilen, vorschauZeilen], [T4.konten, kontenFuerEditor], [T4.name, druckOhneVorgang], [T4.alt, druckAlt], [T4.route, summaryRoute], [T4.rest, restAusserhalb], [T4.hinweis, hinweiseLeerUndKomma], [T4.kopf, kopfzeitraumVorschau], [T4.unbekannt, unbekanntKeinProjekt],
    [T2.kopf, kopf], [T2.offenTo, offenDatenTo], [T2.abgBis, abgerechnetBisProjekt], [T2.kontoBis, kontoBis], [T2.prozentOffen, prozentOffen], [T2.tokens, tokenZeile],
  ];
};
