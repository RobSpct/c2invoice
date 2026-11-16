'use strict';
const { getMeta, setMeta } = require('./db');
const rechnung = require('./rechnung');
const mahnung = require('./mahnung');
const angebot = require('./angebot');
const freigaben = require('./freigaben');
const ereignisse = require('./ereignisse');
const { antwort } = require('./mail');
// C11c Flows: Engine. Ein Flow ist eine Knotenliste (knoten_json); Kanten stehen als `outs`
// ({ port: knotenId }) im Knoten. Bausteine nur trigger, cond, action (Owner P2).
// Kein BEGIN ueber ein await: je Schritt INSERT 'laeuft', await, UPDATE.

const MAX_SCHRITTE = 50; // Schutz gegen Kreise im Knotenmodell
const BAUSTEINE = { trigger: 'trigger', cond: 'cond', action: 'action' };
// E5: f1-f3, pausiert angelegt. P3: f1/f2 ohne cond, den Kandidaten waehlt der Scan (Regeln in mahnung.js/angebot.js).
const einfach = (vorlage, titel, art, aktion, aktionTitel) => ({ titel, ausloeser: { art }, vorlage, knoten: [
  { id: 't', typ: 'trigger', titel: 'Auslöser', parameter: { art }, outs: { weiter: 'a' } },
  { id: 'a', typ: 'action', titel: aktionTitel, parameter: { aktion }, outs: {} }] });
const VORLAGEN = [
  einfach('ueberfaellig_mahnung', 'Überfällige Rechnung → Mahnung', 'rechnung_ueberfaellig', 'mahnung_senden', 'Mahnschreiben senden'),
  einfach('angebot_nachfassen', 'Angebot läuft ab → Nachfassen', 'angebot_laeuft_ab', 'angebot_nachfassen', 'Nachfassen senden'),
  { titel: 'Vorgang erledigt → Rechnungsentwurf', ausloeser: { art: 'jira_status' }, vorlage: 'rechnung_entwurf', knoten: [
    { id: 't', typ: 'trigger', titel: 'Auslöser', parameter: { art: 'jira_status' }, outs: { weiter: 'c' } },
    { id: 'c', typ: 'cond', titel: 'Vorgang erledigt?', parameter: { feld: 'kat', op: 'gleich', wert: 'done' }, outs: { ja: 'a' } },
    { id: 'a', typ: 'action', titel: 'Rechnungsentwurf anlegen', parameter: { aktion: 'rechnung_entwurf' }, outs: {} }] },
];

// M5: Pfade verlassen den Server auch ueber eine Fehlermeldung nicht (Lauf, Schritt, Karte, Mail). Absolute Windows-, UNC-
// und POSIX-Pfade werden <Pfad>; ein Pfad mit Leerzeichen wird segmentweise erkannt, im Zweifel faellt mehr weg. Hoechstens 500 Zeichen.
const redakt = (t) => String(t == null ? '' : t)
  .replace(/(['"])(?:[A-Za-z]:[\\/]|\\\\|\/)[^'"\n]*\1/g, '$1<Pfad>$1')
  .replace(/(?<!\w)(?:[A-Za-z]:[\\/]|\\\\)(?:[^\\/\n"'<>|:*?]*[\\/])*[^\s\\/"'<>|:*?]*/g, '<Pfad>')
  .replace(/(^|[\s(=])\/[^\s/"'<>]+\/(?:[^/\n"'<>]*\/)*[^\s/"'<>]*/g, '$1<Pfad>')
  .slice(0, 500);
// Lauf-Bezug lesbar ("rechnung:2026-0001" -> "Rechnung 2026-0001"): Betreff der Laeufe (I3) und Titel der Fehlerkarte (I2).
const BELEG = { rechnung: 'Rechnung', angebot: 'Angebot', vorgang: 'Vorgang' };
const beleg = (bezug) => { const m = /^(rechnung|angebot|vorgang):(.+)$/.exec(bezug || ''); return m ? BELEG[m[1]] + ' ' + m[2] : null; };
// C1: Text der Karte, wenn ein Brief vielleicht schon beim Kunden ist. Der Scan laesst den Beleg aus, bis die Karte entschieden ist.
const OHNE_WDH = ' Die Mail ist womöglich schon raus: NICHT erneut senden, erst im Gesendet-Ordner und unter Gesendet in c2invoice prüfen, dann bestätigen. Bis dahin lässt der Tages-Scan diesen Beleg aus.';
// R17: Nachfassen gibt es einmal je Angebot; nach einer solchen Karte fasst der Flow dieses Angebot nie wieder nach (sammle).
const OHNE_WDH_ANGEBOT = ' Im Gesendet-Ordner prüfen. Ging das Nachfassen nicht raus, bitte von Hand senden — der Flow fasst dieses Angebot nicht noch einmal nach.';

const wert = (o, pfad) => String(pfad || '').split('.').reduce((a, k) => (a !== null && typeof a === 'object' ? a[k] : undefined), o);

// Fehlendes Feld ergibt immer "nein", nie eine Exception.
function bedingung(p, eingang) {
  const a = wert(eingang, p.feld);
  if (a === undefined || a === null) return false;
  switch (p.op) {
    case 'gesetzt': return a !== '';
    case 'gleich': return String(a) === String(p.wert);
    case 'ungleich': return String(a) !== String(p.wert);
    case 'groesser': return typeof a !== 'object' && a !== '' && Number(a) > Number(p.wert);
    default: return false;
  }
}

// `mail` = mailDienst (nur status()), `cfg` liefert { mahnwesen, angebot }; ohne `mail` tut takt() nichts.
function erzeugeDienst({ db, jetzt = () => new Date().toISOString(), aktionen = {}, vorlagen = VORLAGEN, mail = null, cfg = () => ({}) }) {
  // ponytail: ein Lauf nach dem anderen (eine Promise-Kette je Prozess), reicht fuer einen Nutzer; je Flow parallel erst bei Bedarf.
  let kette = Promise.resolve();
  const seriell = (f) => { const p = kette.then(f); kette = p.catch(() => {}); return p; };
  const json = (v) => JSON.stringify(v === undefined ? null : v);
  const lade = (id) => {
    const f = db.prepare('SELECT * FROM flow WHERE id = ?').get(id);
    if (!f) throw Object.assign(new Error('Flow nicht gefunden'), { status: 404 });
    return { ...f, knoten: JSON.parse(f.knoten_json) };
  };

  // Probelauf eines Scan-Flows: ausdruecklich sagen, dass nichts rausging und wann es rausgeht (sonst sucht man die Mail im Postfach).
  const probeHinweis = (flow) => {
    let art = null;
    try { art = JSON.parse(flow.ausloeser_json).art; } catch { /* kein Scan-Flow */ }
    if (art !== 'rechnung_ueberfaellig' && art !== 'angebot_laeuft_ab') return '';
    // Pausiert sendet der Scan nichts: dann nichts versprechen (silent-failure-Review 09.11.).
    if (!flow.aktiv) return ' · Probelauf, nichts gesendet. Der Flow ist pausiert: gesendet wird erst nach dem Scharfschalten';
    const z = versandZeit();
    return ' · Probelauf, nichts gesendet. Gesendet wird beim Scan (' + (z.wochenende ? 'täglich' : 'werktags') + ' ab ' + z.ab_stunde + ' Uhr) oder mit „Jetzt ausführen“';
  };
  // Laeuft ab `knoten` mit `eingang`, `nr` = Nummer des letzten schon geschriebenen Schritts.
  async function gehe(laufId, flow, test, knotenId, eingang, nr) {
    let status = 'ok', fehler = null, fehlerSchritt = null, testAktion = false, ohneWiederholen = false;
    try {
      while (knotenId) {
        const k = flow.knoten.find((x) => x.id === knotenId);
        if (!k) throw new Error('Knoten fehlt: ' + knotenId);
        if (nr >= MAX_SCHRITTE) throw new Error('Mehr als ' + MAX_SCHRITTE + ' Schritte (Kreis im Flow?)');
        nr++;
        db.prepare("INSERT INTO flow_schritt (lauf_id, nr, node_id, typ, titel, status, eingang_json) VALUES (?, ?, ?, ?, ?, 'laeuft', ?)")
          .run(laufId, nr, k.id, k.typ, k.titel || null, json(eingang));
        const t0 = Date.now();
        const schluss = (st, meldung, ausgang) => db.prepare('UPDATE flow_schritt SET status = ?, ms = ?, meldung = ?, ausgang_json = ? WHERE lauf_id = ? AND nr = ?')
          .run(st, Date.now() - t0, meldung || null, ausgang === undefined ? null : json(ausgang), laufId, nr);
        let port = 'weiter', ausgang = eingang;
        try {
          const p = k.parameter || {};
          if (k.typ === 'cond') {
            port = bedingung(p, eingang) ? 'ja' : 'nein';
            if (!(k.outs && k.outs[port])) { schluss('ok', 'Bedingung: ' + port, ausgang); status = 'skip'; break; } // kein Ziel = Lauf endet ohne Wirkung
          } else if (k.typ === 'action') {
            const a = aktionen[p.aktion];
            if (!a) throw new Error('Unbekannte Aktion: ' + p.aktion);
            const ctx = { db, eingang, parameter: p, lauf: { id: laufId, wurzel_id: flow.wurzel, nr }, test };
            const meldung = await a.pruefe(ctx);
            if (test) { testAktion = true; schluss('skip', meldung + probeHinweis(flow), eingang); knotenId = k.outs && k.outs[port]; continue; }
            const r = (await a.fuehreAus(ctx)) || {};
            ausgang = r.ausgang === undefined ? eingang : r.ausgang;
            if (r.status === 'skip' || r.status === 'warn') { schluss(r.status, r.meldung, ausgang); status = r.status; break; }
            schluss('ok', r.meldung, ausgang);
            knotenId = k.outs && k.outs[port]; eingang = ausgang;
            continue;
          }
          schluss('ok', null, ausgang);
        } catch (err) {
          const st = err.lauf_status === 'skip' || err.lauf_status === 'warn' ? err.lauf_status : 'err';
          schluss(st, redakt(err.message), undefined);
          if (st === 'err') { fehlerSchritt = nr; throw err; }
          status = st; break;
        }
        knotenId = k.outs && k.outs[port]; eingang = ausgang;
      }
    } catch (err) {
      status = 'err'; fehler = redakt(err.message); ohneWiederholen = !!err.kein_retry;
      if (fehlerSchritt === null) fehlerSchritt = nr; // Fehler ausserhalb eines Schritts: letzter Schritt
    }
    if (status === 'ok' && testAktion) status = 'skip';
    db.prepare('UPDATE flow_lauf SET status = ?, ende = ?, fehler = ?, fehler_schritt = ?, kein_retry = ? WHERE id = ?').run(status, jetzt(), fehler, fehlerSchritt, status === 'err' && ohneWiederholen ? 1 : 0, laufId);
    if (status === 'err') await meldeFehler(laufId, { ohneWiederholen });
    else if ((status === 'ok' || status === 'skip') && !test) schliesseKarte(laufId);
    return laufId;
  }

  // I2: ein spaeterer Lauf zum selben Beleg lief durch: dessen offene Fehlerkarte ist erledigt. Aendert den Lauf nie.
  function schliesseKarte(laufId) {
    try {
      const l = db.prepare('SELECT bezug, flow_id FROM flow_lauf WHERE id = ?').get(laufId);
      if (l && l.bezug) freigaben.schliesse(db, { art: 'flow_fehler', bezug: l.bezug, hinweis: 'Ein späterer Lauf lief durch', quelle: 'flow:' + l.flow_id });
    } catch (e) { console.error('Flow-Fehlerkarte schliessen ' + laufId + ':', e); }
  }

  function lauf(flowId, ereignis, { test = false, bezug = null, schluessel = null } = {}) {
    return seriell(async () => {
      const flow = lade(flowId);
      if (schluessel !== null && db.prepare('SELECT 1 FROM flow_lauf WHERE flow_id = ? AND schluessel = ?').get(flowId, String(schluessel))) return null;
      const id = Number(db.prepare('INSERT INTO flow_lauf (flow_id, start, status, betreff, ausloeser_json, bezug, schluessel, test) VALUES (?, ?, \'laeuft\', ?, ?, ?, ?, ?)')
        .run(flowId, jetzt(), (ereignis && ereignis.betreff) || flow.titel, json(ereignis), bezug, schluessel === null ? null : String(schluessel), test ? 1 : 0).lastInsertRowid);
      db.prepare('UPDATE flow_lauf SET wurzel_id = id WHERE id = ?').run(id);
      const start = flow.knoten.find((k) => k.typ === 'trigger');
      return gehe(id, { ...flow, wurzel: id }, !!test, start && start.id, ereignis || {}, 0);
    });
  }

  function wiederholen(laufId, abSchritt) {
    return seriell(async () => {
      const alt = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(laufId);
      if (!alt) throw Object.assign(new Error('Lauf nicht gefunden'), { status: 404 });
      // Die Mail ging raus, nur der Status fehlt: ein neuer Lauf wuerde sie ein zweites Mal senden.
      if (alt.kein_retry) throw Object.assign(new Error('Dieser Lauf lässt sich nicht wiederholen: die Mail ist vermutlich schon raus. Im Gesendet-Ordner und unter Gesendet in c2invoice prüfen.'), { status: 409 });
      const schritte = db.prepare('SELECT * FROM flow_schritt WHERE lauf_id = ? AND nr <= ? ORDER BY nr').all(laufId, abSchritt);
      const ab = schritte.find((s) => s.nr === abSchritt);
      if (!ab || schritte.length !== abSchritt) throw Object.assign(new Error('Schritt ' + abSchritt + ' gibt es in Lauf ' + laufId + ' nicht'), { status: 400 });
      const flow = lade(alt.flow_id);
      const wurzel = alt.wurzel_id || alt.id;
      const id = Number(db.prepare('INSERT INTO flow_lauf (flow_id, wurzel_id, start, status, betreff, ausloeser_json, bezug, test) VALUES (?, ?, ?, \'laeuft\', ?, ?, ?, ?)')
        .run(alt.flow_id, wurzel, jetzt(), alt.betreff, alt.ausloeser_json, alt.bezug, alt.test).lastInsertRowid);
      const kop = db.prepare("INSERT INTO flow_schritt (lauf_id, nr, node_id, typ, titel, status, ms, meldung, eingang_json, ausgang_json) VALUES (?, ?, ?, ?, ?, 'uebernommen', ?, ?, ?, ?)");
      for (const s of schritte) if (s.nr < abSchritt) kop.run(id, s.nr, s.node_id, s.typ, s.titel, s.ms, s.meldung, s.eingang_json, s.ausgang_json);
      return gehe(id, { ...flow, wurzel }, !!alt.test, ab.node_id, JSON.parse(ab.eingang_json), abSchritt - 1);
    });
  }

  // Alle aktiven Flows mit dieser Art nacheinander; daten.schluessel/bezug wandern in den Lauf.
  // `nurFlow`: nur dieser Flow ("Jetzt ausfuehren"), sonst alle aktiven dieser Art.
  async function ausloesen(art, daten = {}, nurFlow = null) {
    const ids = db.prepare('SELECT id, ausloeser_json FROM flow WHERE aktiv = 1').all()
      .filter((f) => { try { return (nurFlow === null || f.id === nurFlow) && JSON.parse(f.ausloeser_json).art === art; } catch { return false; } }).map((f) => f.id);
    return Promise.all(ids.map((id) => lauf(id, daten, { bezug: daten.bezug, schluessel: daten.schluessel })));
  }

  // E8: Tages-Scan einmal am Tag in der Versandzeit (versandZeit, Standard Mo-Fr ab 9:00 Ortszeit), nachgeholt wenn der Server aus war.
  // Ein Kandidat = ein Ereignis (art rechnung_ueberfaellig / angebot_laeuft_ab); die Tagesgrenze des Versands begrenzt die Zahl,
  // aelteste zuerst, der Rest wartet auf den naechsten Scan. Marke erst nach dem Durchlauf. Wirft nie.
  // Eine Karte je Art+Bezug; `nurOffene`: eine erledigte Karte darf bei erneutem Problem eine neue bekommen.
  const karte = (art, bezug, titel, text, nurOffene) => {
    if (db.prepare("SELECT 1 FROM freigabe WHERE art = ? AND bezug = ? AND (status = 'offen' OR ? = 0)").get(art, bezug, nurOffene ? 1 : 0)) return;
    freigaben.anlegen(db, { art, bezug, titel, text, quelle: 'cira' });
  };
  // Alle Kandidaten beider Scan-Arten (Regeln in mahnung.js/angebot.js); im Testmodus zaehlt auch ein Testversand.
  // `beiFehler`: scheitert eine Art, laeuft die andere (M4, Scan); ohne ihn wirft es (Kandidaten-Route, Probelauf).
  const vorAblauf = (c) => { const t = c.angebot && c.angebot.nachfassenTageVorAblauf; return Number.isInteger(t) && t >= 1 && t <= 60 ? t : 3; };
  const sammle = (tag, st, c, beiFehler = (e) => { throw e; }) => {
    const vor = vorAblauf(c);
    const o = { testmodus: !!st.umgeleitet };
    const je = (f) => { try { return f(); } catch (e) { beiFehler(e); return []; } };
    const mit = (art, praefix) => (k) => ({ art, bezug: praefix + k.nr, betreff: beleg(praefix + k.nr), ...k });
    // C1: ein Beleg, dessen Brief vielleicht schon beim Kunden ist (offene Karte ohne Wiederholen), wartet, bis die Karte entschieden ist.
    // R17: ein Angebot mit einer solchen Karte wartet fuer immer, gleich wie sie entschieden ist (Nachfassen nur einmal; Rechnungen schuetzt P6).
    const wartet = new Set(db.prepare("SELECT bezug FROM freigabe WHERE art = 'flow_fehler' AND (status = 'offen' OR bezug LIKE 'angebot:%') AND json_extract(nutzlast_json, '$.kein_retry') = 1").all().map((r) => r.bezug));
    return [
      ...je(() => mahnung.kandidaten(db, tag, o, c.mahnwesen)).map(mit('rechnung_ueberfaellig', 'rechnung:')),
      ...je(() => angebot.kandidaten(db, tag, { ...o, tageVorAblauf: vor })).map(mit('angebot_laeuft_ab', 'angebot:')),
    ].filter((k) => !wartet.has(k.bezug));
  };
  const aktiveArten = () => new Set(db.prepare('SELECT ausloeser_json FROM flow WHERE aktiv = 1').all()
    .map((f) => { try { return JSON.parse(f.ausloeser_json).art; } catch { return null; } }));
  const flowArt = (id) => { try { return JSON.parse(lade(id).ausloeser_json).art; } catch { return null; } };
  // Probelauf ohne Kandidat: Gruende aus mahnung.js (f1) bzw. angebot.js (f2), dazu Belege, die auf eine Fehlerkarte warten (C1, R17).
  // Ein Kandidat aus dem Modul, der in sammle() fehlt, wartet auf eine Karte: dieselbe Filterregel, nicht nachgebaut.
  const gruendeOhneKandidat = (art) => {
    if (!mail) return [];
    const tag = heute(), c = cfg() || {}, o = { testmodus: !!mail.status().umgeleitet };
    if (art === 'angebot_laeuft_ab') {
      const oa = { ...o, tageVorAblauf: vorAblauf(c) };
      const gesperrt = angebot.kandidaten(db, tag, oa).map((k) => ({ nr: k.nr, grund: 'gesperrt durch eine Fehlerkarte (Nachfassen nur einmal)' }));
      return [...angebot.ausgeschlossen(db, tag, oa), ...gesperrt];
    }
    const wartet = mahnung.kandidaten(db, tag, o, c.mahnwesen).map((k) => ({ nr: k.nr, grund: 'wartet auf die offene Fehlerkarte (erst prüfen, dann bestätigen)' }));
    return [...mahnung.ausgeschlossen(db, tag, o, c.mahnwesen), ...wartet];
  };
  // M7: der Tag fuer Kandidaten, Probelauf und "Jetzt ausfuehren" kommt aus der injizierten Uhr.
  const heute = () => rechnung.tagNach(new Date(jetzt()), 0);
  const kandidatenVon = (art, tag = heute()) => (mail ? sammle(tag, mail.status(), cfg() || {}).filter((k) => k.art === art) : []);
  // Ein Lauf je Flow, Beleg und Tag: derselbe Schluessel fuer Scan, "Jetzt ausfuehren" und die Zahl in der Rueckfrage.
  const schluesselVon = (bezug, tag) => bezug + '|' + tag;
  const gelaufen = db.prepare('SELECT 1 FROM flow_lauf WHERE flow_id = ? AND schluessel = ?');
  // Was "Jetzt ausfuehren" (oder der heutige Scan) fuer diesen Flow noch startete: heute schon Gelaufenes faellt weg.
  const offeneKandidaten = (id, art) => { const tag = heute(); return kandidatenVon(art, tag).filter((k) => !gelaufen.get(id, schluesselVon(k.bezug, tag))); };
  // Versandzeit fuer alle Flows (Einstellungen -> Flows, Ortszeit): ab ganzer Stunde 0-23, sonst 9; Wochenende nur mit 1, sonst Mo-Fr.
  const versandZeit = () => {
    const v = (cfg() || {}).flows || {};
    return { ab_stunde: Number.isInteger(v.abStunde) && v.abStunde >= 0 && v.abStunde <= 23 ? v.abStunde : 9, wochenende: v.wochenende === 1 };
  };
  const imFenster = (h) => { const z = versandZeit(); return (z.wochenende || (h.getDay() !== 0 && h.getDay() !== 6)) && h.getHours() >= z.ab_stunde; };
  // Wuerde takt() jetzt scannen? Im Versandfenster und heute noch nicht gelaufen: dann geht ein neu scharfgeschalteter Flow binnen einer Minute los.
  const scanSofort = (h = new Date(jetzt())) => !!mail && imFenster(h) && getMeta(db, 'flows_scan_tag') !== rechnung.tagNach(h, 0);
  // Ein Durchlauf fuer die Ausloeser-Arten `arten`, gemeinsam fuer Tages-Scan und "Jetzt ausfuehren": dieselben Kandidaten (sammle, C1/R17),
  // dieselbe Tagesgrenze, derselbe Schluessel bezug|tag, also nie zweimal am selben Tag. `nurFlow` wie in ausloesen.
  async function scanne(arten, tag, st, c, beiFehler, nurFlow = null) {
    // ponytail: Kandidaten, deren Lauf scheitert oder uebersprungen wird, verbrauchen trotzdem Kontingent; Ausbau: echte Sendungen zaehlen.
    const alle = sammle(tag, st, c, beiFehler).filter((k) => arten.has(k.art)).slice(0, Math.max(0, st.grenze - st.heute));
    const laeufe = [];
    for (const { art, ...daten } of alle) {
      try { laeufe.push(...await ausloesen(art, { ...daten, schluessel: schluesselVon(daten.bezug, tag) }, nurFlow)); } catch (e) { console.error('Flow-Scan ' + daten.bezug + ':', e); }
    }
    await kette;
    return { kandidaten: alle.length, laeufe: laeufe.filter((id) => id !== null) };
  }
  async function takt(h = new Date()) {
    if (!mail || !imFenster(h)) return null;
    const tag = rechnung.tagNach(h, 0);
    // M4: ein Fehler ausserhalb eines Kandidaten wird eine Karte je Tag (Bezug scan:<tag>); ohne Tagesmarke versucht es der naechste Takt
    // wieder, die Schluessel halten jeden Kandidaten bei einem Lauf.
    let gestoert = false;
    const stoerung = (e) => {
      gestoert = true;
      try { karte('flow_fehler', 'scan:' + tag, 'Tages-Scan fehlgeschlagen', redakt(e && e.message), false); } catch (e2) { console.error('Flow-Takt:', e, e2); }
    };
    try {
      if (getMeta(db, 'flows_scan_tag') === tag) return null;
      const c = cfg() || {};
      // P9: Hinweis unabhaengig davon, ob ein Flow aktiv ist.
      try {
        for (const { nr } of mahnung.ausgeschoepft(db, tag)) karte('mahnung_ausgeschoepft', nr, 'Rechnung ' + nr + ': Mahnstufen ausgeschöpft', 'Alle drei Stufen sind gesendet, die Frist ist abgelaufen und die Rechnung ist noch offen. Weiteres (Inkasso, Mahnbescheid) liegt bei dir.', false);
      } catch (e) { stoerung(e); }
      // C2/I1: nur Arten mit aktivem Flow; ohne einen gibt es nichts zu senden, also auch nichts, worauf eine Karte "Versand nicht bereit" warten koennte.
      const aktiv = aktiveArten();
      if (!aktiv.has('rechnung_ueberfaellig') && !aktiv.has('angebot_laeuft_ab')) return { kandidaten: 0 };
      const st = mail.status();
      if (!st.bereit) { // P8, hoechstens eine Karte je Tag (auch weggeklickt), eine offene bleibt die eine
        if (getMeta(db, 'flows_nicht_bereit_tag') !== tag) {
          karte('flow_fehler', 'versand-nicht-bereit', 'Automatische Schreiben warten: Versand nicht bereit', String(st.grund || ''), true);
          setMeta(db, 'flows_nicht_bereit_tag', tag);
        }
        return { kandidaten: 0 };
      }
      freigaben.schliesse(db, { art: 'flow_fehler', bezug: 'versand-nicht-bereit', hinweis: 'Versand ist wieder bereit', quelle: 'cira' });
      const { kandidaten } = await scanne(aktiv, tag, st, c, stoerung);
      if (!gestoert) setMeta(db, 'flows_scan_tag', tag);
      return { kandidaten };
    } catch (e) { stoerung(e); return null; }
  }

  // "Jetzt ausfuehren": der Scan dieses einen Flows, ohne Wochentag und Uhrzeit, ohne Tagesmarke (der Scan der anderen Art laeuft trotzdem).
  // Nicht bereit: 409 statt Karte, der Nutzer steht davor.
  async function jetztAusfuehren(id) {
    const f = lade(id), art = flowArt(id);
    if (art !== 'rechnung_ueberfaellig' && art !== 'angebot_laeuft_ab') throw fehl('Dieser Flow startet nur über den Jira-Abgleich', 409);
    if (!f.aktiv) throw fehl('Flow ist pausiert — erst scharf schalten', 409);
    const st = mail ? mail.status() : { bereit: false, grund: 'kein Versanddienst' };
    if (!st.bereit) throw fehl('Versand nicht bereit' + (st.grund ? ': ' + st.grund : ''), 409);
    const { laeufe } = await scanne(new Set([art]), heute(), st, cfg() || {}, undefined, id);
    return { gestartet: laeufe.length, laeufe };
  }

  // E7: Karte "flow_fehler" (Nutzlast = Lauf und Wiederholen-Ziel; kein_retry: nur ansehen) und, wenn mail.benachrichtigungAn gesetzt ist,
  // genau eine Mail je Wurzel-Lauf. I2: eine Karte je Beleg (Bezug des Laufs), sonst je Wurzel-Lauf. I4: ein Probelauf meldet nichts.
  // Wirft nie: der Lauf ist schon geschrieben, die Meldung darf ihn nicht aendern. Die Karte entsteht vor dem ersten await.
  async function meldeFehler(laufId, { ohneWiederholen = false } = {}) {
    const l = db.prepare('SELECT l.*, f.titel AS flow_titel FROM flow_lauf l LEFT JOIN flow f ON f.id = l.flow_id WHERE l.id = ?').get(laufId);
    if (!l || l.status !== 'err' || l.test) return null;
    const ohne = ohneWiederholen || !!l.kein_retry;
    const wurzel = l.wurzel_id || l.id;
    const s = db.prepare('SELECT titel FROM flow_schritt WHERE lauf_id = ? AND nr = ?').get(l.id, l.fehler_schritt);
    const b = beleg(l.bezug);
    const titel = 'Flow „' + (l.flow_titel || l.flow_id) + '“ fehlgeschlagen' + (b ? ': ' + b : '');
    // Fehler gekappt, damit der Hinweis dahinter auf der Karte (gekuerzte Anzeige) nicht wegfaellt; vollstaendig steht er im Lauf.
    const text = 'Schritt ' + l.fehler_schritt + (s && s.titel ? ' (' + s.titel + ')' : '') + ': ' + redakt(l.fehler).slice(0, 200) +
      (!ohne ? '. „Ok“ wiederholt den Lauf ab diesem Schritt.' : /^angebot:/.test(l.bezug || '') ? OHNE_WDH_ANGEBOT : OHNE_WDH);
    let k = null;
    try {
      k = freigaben.ersetze(db, { art: 'flow_fehler', bezug: l.bezug || 'lauf:' + wurzel, titel: titel.slice(0, 200), text,
        nutzlast: { lauf_id: l.id, ab_schritt: l.fehler_schritt, ...(ohne && { kein_retry: true }) }, quelle: 'flow:' + l.flow_id });
    } catch (e) { console.error('Flow-Fehlerkarte ' + laufId + ':', e); }
    const an = ((cfg() || {}).mail || {}).benachrichtigungAn;
    if (an && mail && mail.sende) {
      try {
        const r = await mail.sende({ an: [an], betreff: titel, text }, { art: 'benachrichtigung', bezug: 'lauf:' + wurzel, schluessel: 'flow-fehler-' + wurzel });
        if (r.status !== 'ok') console.error('Flow-Benachrichtigung ' + laufId + ' nicht gesendet:', r.fehler);
      } catch (e) { console.error('Flow-Benachrichtigung ' + laufId + ' nicht gesendet:', e.message); }
    }
    return k;
  }

  // Neustart: was noch "laeuft", ist abgebrochen (P4). Liefert die Laeufe fuer die flow_fehler-Karte.
  const ABBRUCH = 'Server wurde während des Laufs beendet; Ergebnis prüfen';
  function aufraeumen() {
    const t = jetzt();
    const aus = [];
    for (const l of db.prepare("SELECT id, test FROM flow_lauf WHERE status = 'laeuft'").all()) {
      const id = l.id;
      const hang = db.prepare("SELECT MIN(nr) nr FROM flow_schritt WHERE lauf_id = ? AND status = 'laeuft'").get(id).nr
        ?? db.prepare('SELECT MAX(nr) nr FROM flow_schritt WHERE lauf_id = ?').get(id).nr;
      const s = db.prepare('SELECT typ FROM flow_schritt WHERE lauf_id = ? AND nr = ?').get(id, hang);
      // C1: hing eine Aktion, ist ihr Brief vielleicht beim Kunden (mail.sende schreibt `versand` erst nach SMTP): nie wiederholen.
      const ohne = !l.test && !!s && s.typ === 'action';
      db.prepare("UPDATE flow_schritt SET status = 'err', meldung = ? WHERE lauf_id = ? AND status = 'laeuft'").run(ABBRUCH, id);
      db.prepare("UPDATE flow_lauf SET status = 'err', ende = ?, fehler = ?, fehler_schritt = ?, kein_retry = ? WHERE id = ?").run(t, ABBRUCH, hang, ohne ? 1 : 0, id);
      aus.push({ id, fehler_schritt: hang, ohneWiederholen: ohne });
    }
    return aus;
  }

  const liste = () => db.prepare('SELECT id, titel, aktiv, version, vorlage, ausloeser_json FROM flow ORDER BY id').all();
  const detail = (id) => { const f = lade(id); delete f.knoten_json; return f; };
  const laeufe = ({ flow, filter } = {}) => db.prepare('SELECT * FROM flow_lauf WHERE (? IS NULL OR flow_id = ?) AND (? IS NULL OR status = ?) ORDER BY id DESC LIMIT 200')
    .all(flow ?? null, flow ?? null, filter ?? null, filter ?? null);
  const laufDetail = (id) => {
    const l = db.prepare('SELECT * FROM flow_lauf WHERE id = ?').get(id);
    return l && { ...l, schritte: db.prepare('SELECT * FROM flow_schritt WHERE lauf_id = ? ORDER BY nr').all(id) };
  };
  const setzeAktiv = (id, an) => {
    const f = an && db.prepare('SELECT ausloeser_json FROM flow WHERE id = ?').get(id);
    let art = null;
    try { art = f && JSON.parse(f.ausloeser_json).art; } catch { /* unlesbarer Ausloeser: kein Jira-Flow */ }
    if (art === 'jira_status' && !((cfg() || {}).jira || {}).enabled) throw Object.assign(new Error('Jira ist nicht eingeschaltet (jira.enabled). Dieser Flow reagiert auf Statuswechsel in Jira.'), { status: 409 });
    return db.prepare('UPDATE flow SET aktiv = ? WHERE id = ?').run(an ? 1 : 0, id).changes === 1;
  };
  // Nur einmal je Datenbank: ein geloeschter oder geaenderter Stand wird nie wieder angelegt.
  const vorlagenAnlegen = () => {
    if (getMeta(db, 'flows_vorlagen') !== null) return 0;
    const ein = db.prepare('INSERT OR IGNORE INTO flow (titel, aktiv, ausloeser_json, knoten_json, vorlage) VALUES (?, 0, ?, ?, ?)');
    const n = vorlagen.reduce((z, v) => z + ein.run(v.titel, json(v.ausloeser), json(v.knoten), v.vorlage).changes, 0);
    setMeta(db, 'flows_vorlagen', jetzt());
    return n;
  };

  // ---- Routen (Owner P2: nur Lesen, Schalten, Probelauf, Wiederholen; Flows anlegen/aendern gibt es nicht) ----
  const fehl = (text, status = 400) => Object.assign(new Error(text), { status });
  const zahl = (t, was) => { if (!/^\d{1,9}$/.test(String(t))) throw fehl(was + ' ungültig'); return Number(t); };
  // Pfade, Passwoerter und Tokens verlassen den Server nie, auch nicht, wenn ein Ereignis sie einmal mittransportiert.
  const GEHEIM = /pfad|pass|token|geheim|secret/i;
  const sauber = (v) => (Array.isArray(v) ? v.map(sauber) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !GEHEIM.test(k)).map(([k, w]) => [k, sauber(w)])) : v);
  const lies = (t) => { try { return sauber(JSON.parse(t)); } catch { return null; } };
  // wiederholbar: gescheitert, nicht kein_retry und noch ohne Nachfolger (neuerer Lauf derselben Wurzel).
  const nachfolger = db.prepare('SELECT 1 FROM flow_lauf WHERE wurzel_id = ? AND id > ? LIMIT 1');
  const lauf1 = (l) => { const { ausloeser_json: a, kein_retry: k, ...r } = l; return { ...r, ausloeser: lies(a), kein_retry: !!k, wiederholbar: l.status === 'err' && !k && !nachfolger.get(l.wurzel_id || l.id, l.id) }; };
  const schritt1 = (s) => { const { eingang_json: e, ausgang_json: a, ...r } = s; return { ...r, eingang: lies(e), ausgang: lies(a) }; };

  // Probelauf: der erste echte Kandidat, nichts wird gesendet. Ohne Kandidat ein Lauf "skip" (kein Flow-Lauf ohne Spur).
  function testen(id, vorgang) {
    const art = flowArt(id);
    let e = null;
    if (art === 'jira_status') { if (vorgang) e = { key: vorgang, vorgang, kat: 'done', bezug: 'vorgang:' + vorgang, betreff: beleg('vorgang:' + vorgang) }; } else {
      const k = kandidatenVon(art)[0];
      if (k) { const { art: _a, ...daten } = k; e = daten; }
    }
    if (e) return lauf(id, e, { test: true, bezug: e.bezug });
    const n = jetzt();
    const lid = Number(db.prepare("INSERT INTO flow_lauf (flow_id, start, ende, status, betreff, test) VALUES (?, ?, ?, 'skip', ?, 1)").run(id, n, n, lade(id).titel).lastInsertRowid);
    db.prepare('UPDATE flow_lauf SET wurzel_id = id WHERE id = ?').run(lid);
    const aus = art === 'rechnung_ueberfaellig' || art === 'angebot_laeuft_ab' ? gruendeOhneKandidat(art) : [];
    const meldung = aus.length ? 'Kein Kandidat: ' + aus.map((x) => x.nr + ' ' + x.grund).join('; ') : 'Kein Kandidat';
    db.prepare("INSERT INTO flow_schritt (lauf_id, nr, node_id, typ, titel, status, meldung, ausgang_json) VALUES (?, 1, 't', 'trigger', 'Auslöser', 'skip', ?, ?)")
      .run(lid, meldung, aus.length ? JSON.stringify({ ausgeschlossen: aus }) : null);
    return Promise.resolve(lid);
  }
  const ergebnis = (id) => { const l = db.prepare('SELECT id, status, fehler FROM flow_lauf WHERE id = ?').get(id); return { id: l.id, status: l.status, fehler: l.fehler }; };

  const GET_RE = /^\/api\/flows\/(?:(laeufe)|lauf\/([^/]+)|([^/]+)(\/kandidaten)?)$/;
  const POST_RE = /^\/api\/flows\/(?:lauf\/([^/]+)\/wiederholen|([^/]+)\/(aktiv|test|jetzt))$/;
  function routen(req, res, p, u, { sendJson, leseKoerper }) {
    // versand: die Oberflaeche nennt Stunde und Wochenende, statt "werktags ab 9 Uhr" fest zu sagen.
    if (p === '/api/flows' && req.method === 'GET') { antwort(res, sendJson, () => ({ flows: liste(), jira: !!((cfg() || {}).jira || {}).enabled, versand: versandZeit() })); return true; }
    if (req.method === 'GET') {
      const m = GET_RE.exec(p);
      if (!m) return false;
      antwort(res, sendJson, () => {
        if (m[1]) {
          const filter = u.searchParams.get('filter') || 'alle';
          if (filter !== 'alle' && filter !== 'fehler') throw fehl('filter ungültig');
          const f = u.searchParams.get('flow');
          return { laeufe: laeufe({ flow: f === null ? null : zahl(f, 'flow'), filter: filter === 'fehler' ? 'err' : null }).map(lauf1) };
        }
        if (m[2]) { const l = laufDetail(zahl(m[2], 'Lauf')); if (!l) throw fehl('Lauf nicht gefunden', 404); const { schritte, ...r } = l; return { ...lauf1(r), schritte: schritte.map(schritt1) }; }
        const id = zahl(m[3], 'Flow');
        if (m[4]) { const art = flowArt(id); return { art, anzahl: offeneKandidaten(id, art).length, scan_sofort: scanSofort() }; }
        const f = detail(id);
        return { ...f, ausloeser: lies(f.ausloeser_json), knoten: sauber(f.knoten) };
      });
      return true;
    }
    const m = req.method === 'POST' && POST_RE.exec(p);
    if (!m) return false;
    leseKoerper(req, (fehlerText, roh) => {
      if (fehlerText) return sendJson(res, { error: fehlerText }, 400);
      const d = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {};
      antwort(res, sendJson, async () => {
        if (m[1]) { // Wiederholen: nur ein gescheiterter Lauf, ab einem Schritt, den es gibt
          const lid = zahl(m[1], 'Lauf');
          const l = db.prepare('SELECT status FROM flow_lauf WHERE id = ?').get(lid);
          if (!l) throw fehl('Lauf nicht gefunden', 404);
          if (l.status !== 'err') throw fehl('Nur ein gescheiterter Lauf lässt sich wiederholen', 409);
          const n = db.prepare('SELECT COUNT(*) AS n FROM flow_schritt WHERE lauf_id = ?').get(lid).n;
          if (!Number.isInteger(d.ab_schritt) || d.ab_schritt < 1 || d.ab_schritt > n) throw fehl('ab_schritt ungültig (1 bis ' + n + ')');
          return ergebnis(await wiederholen(lid, d.ab_schritt));
        }
        const id = zahl(m[2], 'Flow');
        lade(id);
        if (m[3] === 'aktiv') {
          if (typeof d.aktiv !== 'boolean') throw fehl('aktiv muss true oder false sein');
          if (!setzeAktiv(id, d.aktiv)) throw fehl('Flow nicht gefunden', 404);
          return { ok: true, id, aktiv: d.aktiv };
        }
        if (m[3] === 'jetzt') return jetztAusfuehren(id);
        if (d.vorgang !== undefined && !(typeof d.vorgang === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(d.vorgang))) throw fehl('vorgang ungültig');
        return ergebnis(await testen(id, d.vorgang));
      });
    });
    return true;
  }

  const dienst = { routen, ausloesen, takt, scanSofort, lauf, wiederholen, aufraeumen, meldeFehler, liste, detail, laeufe, laufDetail, setzeAktiv, vorlagenAnlegen };
  DIENSTE.set(db, dienst);
  return dienst;
}

// Freigabe-Registry kennt nur (db, nutzlast): der Dienst zur Datenbank kommt aus dieser Zuordnung.
const DIENSTE = new WeakMap();
freigaben.registriere('flow_fehler', (db, n) => {
  // Die Karte "Versand nicht bereit" hat keinen Lauf, eine mit kein_retry nur einen zum Ansehen: Bestaetigen nimmt sie nur aus der Liste.
  if (!n || !Number.isInteger(n.lauf_id) || n.kein_retry) return { bestaetigt: true };
  const d = DIENSTE.get(db);
  if (!d) throw new Error('Flow-Dienst läuft nicht.');
  return d.wiederholen(n.lauf_id, n.ab_schritt).then((id) => ({ lauf_id: id }));
});
freigaben.registriere('mahnung_ausgeschoepft', () => ({ bestaetigt: true })); // Hinweis, nichts auszufuehren (P9)

// "Braucht dich"-Pille: offene Fehlerkarten, nicht Laeufe mit err (die bleiben als Verlauf stehen, die Karte ist die Aufgabe).
const fehlerAnzahl = (db) => db.prepare("SELECT COUNT(*) AS n FROM freigabe WHERE art = 'flow_fehler' AND status = 'offen'").get().n;

// Bus-Hoerer: jira_status startet die aktiven Flows mit diesem Ausloeser. Der Hoerer faengt jeden Fehler selbst ab,
// ein Flow darf nie den treffen, der das Ereignis sendet. Liefert die Abmeldung.
function verbinde(dienst, bus = ereignisse.bus) {
  const hoere = (e) => {
    if (!e || e.art !== 'jira_status' || !e.daten) return;
    const d = e.daten;
    try {
      Promise.resolve(dienst.ausloesen('jira_status', { ...d, vorgang: d.key, bezug: 'vorgang:' + d.key, betreff: beleg('vorgang:' + d.key), schluessel: d.key + '|' + d.nach + '|' + e.zeit }))
        .catch((err) => console.error('Flow jira_status ' + d.key + ':', err));
    } catch (err) { console.error('Flow jira_status ' + d.key + ':', err); }
  };
  bus.on('ereignis', hoere);
  return () => bus.off('ereignis', hoere);
}

// ---- Aktionen (E6) ----
// Duenne Huelle um mahnung.js, mail.js und cira.js: Betraege, Stufen und Fristen kommen von dort, hier wird nichts gerechnet.
// Ein Fehler mit `lauf_status` beendet den Lauf ohne err (skip: nichts zu tun, warn: morgen wieder).
const mitLauf = (text, lauf_status) => Object.assign(new Error(text), { lauf_status });
// 409 aus mahnung.js, die "heute nichts mehr zu mahnen" heissen; alles andere (z. B. "Zustellung unklar") braucht einen Menschen.
const NICHTS_ZU_TUN = /bezahlt|storniert|bereits gesendet|Mahnpause|nicht fällig|ausgeschöpft|Versand läuft bereits/;
// M2: 409 "Zustellung unklar" klaert nur ein Mensch; ein Wiederholen fuehrte wieder hierher. `unklarHinweis` sagt, wo.
function uebersetze(e, unklarHinweis = '') {
  const m = String((e && e.message) || '');
  if (e && e.status === 429) e.lauf_status = 'warn'; // Tagesgrenze, Fehlversuche: kein Fehler, der Kandidat kommt beim naechsten Scan wieder
  else if (e && e.status === 409 && NICHTS_ZU_TUN.test(m)) e.lauf_status = 'skip';
  else if (e && e.status === 409 && /Zustellung unklar/.test(m)) { e.kein_retry = true; e.message = m + unklarHinweis; }
  return e;
}
const MAHNEN_KLAEREN = ' — im Dialog „Mahnen“ klären';
const grenzeErreicht = (mailDienst) => {
  const st = mailDienst.status();
  if (st.heute >= st.grenze) throw mitLauf('Tagesgrenze erreicht (' + st.grenze + ' Mails), morgen wieder', 'warn');
};

// Testmodus: die Mail geht an die Umleitung, nicht an den Kunden. Meldungen nennen beide, sonst sucht man sie im falschen Postfach.
const testZiel = (mailDienst) => { const s = mailDienst.status(); return s.umgeleitet ? s.umleiten_an : null; };
// Nach dem Versand zaehlt die Zeile im Versandprotokoll, nicht die Config von jetzt (die Testadresse kann sich waehrend SMTP aendern).
const versandAn = (db, id) => { const z = id ? db.prepare('SELECT an FROM versand WHERE id = ?').get(id) : null; return (z && z.an) || 'unbekannt'; };
const anText = (mailDienst, an) => { const t = testZiel(mailDienst); return t ? 'an die Testadresse ' + t + ' (statt an ' + an.join(', ') + ')' : 'an ' + an.join(', '); };

function mahnungSenden({ mahnDienst, mailDienst }) {
  // Vorschau ist die Pruefung: dieselbe Antwort wie im Dialog "Mahnen", mit den Sperren (bezahlt, storniert, Mahnpause, unklar).
  function vorschau({ eingang }) {
    let v;
    try { v = mahnDienst.vorschau(eingang.nr); } catch (e) { throw uebersetze(e, MAHNEN_KLAEREN); }
    // Zwischen Scan und Lauf von Hand gemahnt: die naechste Stufe gehoert nicht an die Stelle der gemeldeten.
    if (eingang.stufe_faellig && v.stufe !== eingang.stufe_faellig) throw mitLauf('Stufe ' + eingang.stufe_faellig + ' bereits gesendet', 'skip');
    if (v.frueh) throw mitLauf('Stufe ' + v.stufe + ' ist noch nicht fällig', 'skip');
    if (!v.an.length) throw new Error('Keine Empfängeradresse für Rechnung ' + eingang.nr + ' (Ansprechpartner oder Kontakt ohne E-Mail)');
    return v;
  }
  return {
    pruefe: (ctx) => { const v = vorschau(ctx); return v.titel + ' ' + anText(mailDienst, v.an) + ' über ' + rechnung.eur(v.gesamt_eur); },
    async fuehreAus(ctx) {
      const v = vorschau(ctx);
      grenzeErreicht(mailDienst);
      let r, m;
      try {
        mahnDienst.sperrePruefen(ctx.eingang.nr, v.stufe); // von Hand laeuft gerade derselbe Versand: skip, kein Entwurf auf Vorrat
        m = await mahnDienst.erzeuge(ctx.eingang.nr, { stufe: v.stufe, offen_eur: v.offen_eur, frist: v.frist });
        r = await mahnDienst.sende(m.id, { an: v.an });
      } catch (e) { throw uebersetze(e, MAHNEN_KLAEREN); }
      // Mail ging raus, Status fehlt (Sperre nur im Speicher): err, aber die Karte darf nie zum Wiederholen einladen.
      if (r.warnung) throw Object.assign(new Error(r.warnung), { kein_retry: true });
      if (r.versand.status !== 'ok') throw new Error(r.versand.fehler || 'Versand fehlgeschlagen');
      return { ausgang: { mahnung_id: m.id, stufe: v.stufe },
        meldung: r.versand.test ? 'Test: ' + v.titel + ' ging an die Testadresse ' + versandAn(ctx.db, r.versand.id) + ' statt an ' + v.an.join(', ') + ', zählt nicht als Stufe' : v.titel + ' gesendet an ' + v.an.join(', ') };
    },
  };
}

function angebotNachfassen({ mailDienst }) {
  function pruefen({ db, eingang, lauf }) {
    const nr = eingang.nr;
    const a = angebot.lade(db, nr);
    if (!a) throw new Error('Angebot ' + nr + ' nicht gefunden');
    if (a.status !== 'offen') throw mitLauf('Angebot ' + nr + ' ist nicht mehr offen', 'skip');
    const t = mailDienst.status().umgeleitet ? 1 : 0; // wie angebot.kandidaten: im Testmodus zaehlt auch ein Testversand
    if (db.prepare("SELECT 1 FROM versand WHERE art = 'nachfassen' AND bezug = ? AND status = 'ok' AND (test = 0 OR ? = 1)").get(nr, t)) throw mitLauf('Nachfassen für ' + nr + ' ist schon gesendet', 'skip');
    // Ein unklares Nachfassen aus einem anderen Lauf: vielleicht beim Kunden, erst pruefen. (Der eigene Lauf wird von mail.sende ueber lauf_id + nr gesperrt, P5.)
    // ponytail: der Scan meldet das bis zum Ablauf taeglich neu (hoechstens nachfassenTageVorAblauf Karten); ein "als gesendet bestaetigen" gibt es nur fuer Mahnungen (P6).
    if (db.prepare("SELECT 1 FROM versand WHERE art = 'nachfassen' AND bezug = ? AND status = 'fehler' AND fehler LIKE 'Zustellung unklar:%' AND (lauf_id IS NULL OR lauf_id <> ?)").get(nr, lauf.wurzel_id)) {
      throw new Error('Ein früheres Nachfassen zu ' + nr + ' ist unklar zugestellt — erst unter Gesendet prüfen');
    }
    // Empfaenger = Adresse des letzten Angebotsversands (im Testmodus steht die echte in an_original).
    const v = db.prepare("SELECT an, an_original, test FROM versand WHERE art = 'angebot' AND bezug = ? AND status = 'ok' AND (test = 0 OR ? = 1) ORDER BY zeit DESC, id DESC LIMIT 1").get(nr, t);
    let an = v ? String((v.test ? v.an_original : v.an) || '').split(/,\s*/).filter(Boolean) : [];
    if (!an.length) an = mailDienst.empfaengerVon(a.kontakt_id, a.lead_id).an;
    if (!an.length) throw new Error('Keine Empfängeradresse für Angebot ' + nr);
    return { an, nr };
  }
  return {
    pruefe: (ctx) => { const { an, nr } = pruefen(ctx); return 'Nachfassen zu ' + nr + ' ' + anText(mailDienst, an); },
    async fuehreAus(ctx) {
      const { an, nr } = pruefen(ctx);
      grenzeErreicht(mailDienst);
      const n = await mailDienst.belegNachricht('angebot', nr, 'nachfassen');
      const pdf = n.anhaenge.find((x) => x.typ === 'application/pdf');
      if (!pdf || !pdf.ok) throw new Error('PDF fehlt: ' + (pdf ? pdf.grund : 'kein Anhang'));
      let r;
      // P5: wurzel_id, nicht die Id dieses Laufs. Eine Wiederholung ist eine neue Zeile; mit ihrer eigenen Id griffe die Sperre nicht.
      try { r = await mailDienst.sende({ an, betreff: n.betreff, text: n.text, anhaenge: [{ name: pdf.name, typ: pdf.typ, daten: pdf.daten }] }, { art: 'nachfassen', bezug: nr, lauf_id: ctx.lauf.wurzel_id, nr: ctx.lauf.nr }); } catch (e) { throw uebersetze(e); }
      if (r.status !== 'ok') throw new Error(r.fehler || 'Versand fehlgeschlagen');
      return { ausgang: { nr, versand_id: r.id }, meldung: r.test ? 'Test: Nachfassen ging an die Testadresse ' + versandAn(ctx.db, r.id) + ' statt an ' + an.join(', ') : 'Nachfassen gesendet an ' + an.join(', ') };
    },
  };
}

// E11: ein Entwurf je Vorgang ueber cira.rechnungsEntwurf; die Freigabe traegt den Flow als Quelle, ein zweiter Lauf ersetzt die offene.
function rechnungEntwurf({ entwurf }) {
  const vorgang = ({ eingang }) => {
    const v = String(eingang.vorgang || eingang.key || '').trim();
    if (!v) throw new Error('Das Ereignis nennt keinen Vorgang');
    return v;
  };
  return {
    pruefe: (ctx) => 'Rechnungsentwurf für ' + vorgang(ctx),
    fuehreAus(ctx) {
      const v = vorgang(ctx);
      const flowId = ctx.db.prepare('SELECT flow_id FROM flow_lauf WHERE id = ?').get(ctx.lauf.id).flow_id;
      const r = (entwurf || require('./cira').rechnungsEntwurf)(ctx.db, v, { quelle: 'flow:' + flowId });
      // Nichts Offenes (oder Vorgang unbekannt): keine Karte, der Antworttext von Cira ist die Meldung.
      if (!r.freigabe_id) return { status: 'warn', meldung: r.antwort, ausgang: ctx.eingang };
      return { ausgang: { freigabe_id: r.freigabe_id, vorgang: v }, meldung: r.antwort };
    },
  };
}

function erzeugeAktionen({ mahnDienst, mailDienst, entwurf = null }) {
  return { mahnung_senden: mahnungSenden({ mahnDienst, mailDienst }), angebot_nachfassen: angebotNachfassen({ mailDienst }), rechnung_entwurf: rechnungEntwurf({ entwurf }) };
}

// Takt-Zeitgeber: ein Tick, solange der vorige noch laeuft, faellt aus (R7), und takt() darf nie unbehandelt scheitern.
function planeTakt(dienst, ms = 60_000) {
  let laeuft = false;
  return setInterval(() => {
    if (laeuft) return;
    laeuft = true;
    Promise.resolve().then(() => dienst.takt()).catch((e) => console.error('Flow-Takt:', e)).finally(() => { laeuft = false; });
  }, ms).unref();
}

module.exports = { planeTakt, erzeugeDienst, erzeugeAktionen, verbinde, fehlerAnzahl, redakt, BAUSTEINE };
