'use strict';
// Skill-Ablauf (C6b, BACKEND §2.4, README §5.5). Owner 19.10.2026: ein Ablauf
// ist eine Sitzung, jeder Schritt die naechste Eingabe darin ("/plan-mode <ziel>").
// Schritte entstehen nur durch Klick auf eine Skill-Kachel, kein Modell
// erfindet sie. Ist der Zug eines Schritts fertig (Sitzung "bereit"), wartet
// der Schritt: Ergebnis = letzte Antwort + geschriebene Dateien, dazu eine
// Freigabe "ablauf" in "Braucht dich". Freigeben startet den naechsten Schritt,
// Neu bauen denselben mit Hinweis, Stopp beendet mit Grund im Vorgangs-Log.
const ereignisse = require('./ereignisse');
const freigaben = require('./freigaben');
const { routenHelfer, jetzt, kappe, ausJson } = require('./sitzungen');

// Form wie die Ordnernamen in skillNamen (server.js), ohne fuehrenden Punkt.
// Die eigentliche Pruefung ist die Liste der vorhandenen Skills (pruefeSkill);
// der Name wird nie zu einem Pfad zusammengesetzt.
const SKILL_RE = /^(?!\.)[\w.:-]{1,80}$/;
const MAX_TEXT = 2000;
const MAX_GRUND = 500;
const MAX_SCHRITTE = 10;
const AKTIV = ['run', 'wait'];
const SCHREIBT = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

const fehler =(text, status = 400) => Object.assign(new Error(text), { status });
// Freitext aus der Oberflaeche: Steuerzeichen ausser Zeilenumbruch raus.
const sauber = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim() : '');
function text(v, name, { pflicht = false, max = MAX_TEXT } = {}) {
  if (v != null && typeof v !== 'string') throw fehler(name + ': Text erwartet.');
  const s = sauber(v);
  if (pflicht && !s) throw fehler(name + ' fehlt.');
  if (s.length > max) throw fehler(name + ': höchstens ' + max + ' Zeichen.');
  return s;
}
const befehlVon = (v) => {
  const b = typeof v === 'string' ? v.trim().replace(/^\//, '') : '';
  if (!SKILL_RE.test(b)) throw fehler('Skill: Name ungültig.');
  return b;
};
const auftrag = (s, hinweis, art = 'weiter') => '/' + s.befehl + (s.ziel ? ' ' + s.ziel : '') +
  (hinweis ? (art === 'neu' ? '\n\nÜberarbeite das Ergebnis mit diesem Hinweis: ' : '\n\nHinweis: ') + hinweis : '');

// db; sitzungen = Dienst aus sitzungen.erzeuge; skills(arbeitsbereich) -> Namen
// der Skills dort (wirft bei unbekanntem Arbeitsbereich).
function erzeuge({ db, sitzungen, skills }) {
  const zeile = (id) => db.prepare('SELECT * FROM ablauf WHERE id = ?').get(id);
  const schritteVon = (a) => ausJson(a.schritte_json) || [];
  const setze = (id, felder) => {
    const k = Object.keys(felder);
    db.prepare('UPDATE ablauf SET ' + k.map((x) => x + ' = ?').join(', ') + ', aktualisiert = ? WHERE id = ?').run(...k.map((x) => felder[x]), jetzt(), id);
  };
  const melde = (id) => { const a = zeile(id); ereignisse.sende('ablauf', { id, status: a ? a.status : null }); };
  const letzteId = (sid) => db.prepare('SELECT COALESCE(MAX(id), 0) AS n FROM sitzung_ereignis WHERE session_id = ?').get(sid).n;
  const pruefeSkill = (ab, befehl) => {
    if (!skills(ab).includes(befehl)) throw fehler('Skill /' + befehl + ' gibt es im Arbeitsbereich ' + ab + ' nicht.');
  };

  // Freigabe eines wartenden Schritts zurueckziehen (Neu bauen, Stopp). Die
  // Ablauf-Zeile ist dann schon umgestellt: der Hoerer unten sieht keinen
  // wartenden Schritt mehr und stoppt nichts.
  function zieheZurueck(fid, hinweis) {
    if (!fid) return;
    const r = db.prepare("UPDATE freigabe SET status = 'abgelehnt', erledigt_am = ?, hinweis = ? WHERE id = ? AND status = 'offen'").run(jetzt(), hinweis, fid);
    if (!r.changes) return;
    ereignisse.sende('freigabe', { id: fid, status: 'abgelehnt' });
    ereignisse.sende('zaehler', { freigaben: freigaben.offenAnzahl(db) });
  }

  // Ergebnis eines Schritts aus den Ereignissen seiner Sitzung (ab < id <= bis).
  function ergebnis(sid, ab, bis) {
    const ev = db.prepare('SELECT id, art, titel, meta, kosten_usd, koerper_json FROM sitzung_ereignis WHERE session_id = ? AND id > ?' + (bis ? ' AND id <= ?' : '') + ' ORDER BY id')
      .all(...(bis ? [sid, ab, bis] : [sid, ab]));
    let antwort = null, fehlerText = null, kosten = null;
    const dateien = [];
    for (const e of ev) {
      const k = ausJson(e.koerper_json) || {};
      if (e.art === 'say') antwort = typeof k.text === 'string' ? k.text : e.titel;
      if (e.art === 'edit' && SCHREIBT.includes(e.meta) && k.input) {
        const f = k.input.file_path || k.input.notebook_path;
        if (typeof f === 'string' && !dateien.includes(f) && dateien.length < 20) dateien.push(f);
      }
      if (e.art === 'zug') { fehlerText = k.fehler || null; if (typeof e.kosten_usd === 'number') kosten = (kosten ?? 0) + e.kosten_usd; }
      if (e.art === 'fehler') fehlerText = e.titel;
    }
    return { antwort: antwort ? kappe(antwort, 4000) : null, dateien, kosten_usd: kosten == null ? null : Math.round(kosten * 1e6) / 1e6, fehler: fehlerText };
  }

  function anzeige(a) {
    const schritte = schritteVon(a);
    return {
      id: a.id, vorgang: a.vorgang, arbeitsbereich: a.arbeitsbereich, sitzung: a.sitzung, status: a.status, schritt: a.aktueller_schritt,
      stop_grund: a.stop_grund, hinweise: ausJson(a.hinweise_json) || [], erstellt: a.erstellt, aktualisiert: a.aktualisiert,
      schritte: schritte.map((s) => ({
        befehl: s.befehl, ziel: s.ziel || '', status: s.status, freigabe: s.freigabe || null,
        ergebnis: s.ab != null && s.status !== 'run' && s.status !== 'idle' ? ergebnis(a.sitzung, s.ab, s.bis) : null,
      })),
    };
  }
  function details(id) {
    const a = Number.isInteger(id) ? zeile(id) : null;
    if (!a) throw fehler('Ablauf unbekannt.', 404);
    return anzeige(a);
  }
  // Nur offene: das Cockpit zeigt den neuesten davon beim Oeffnen.
  const offene = () => db.prepare("SELECT * FROM ablauf WHERE status IN ('run', 'wait') ORDER BY id DESC LIMIT 50").all().map(anzeige);

  function starte(d = {}) {
    const ab = typeof d.arbeitsbereich === 'string' ? d.arbeitsbereich : '';
    const befehl = befehlVon(d.befehl);
    const ziel = text(d.ziel, 'Ziel');
    pruefeSkill(ab, befehl);
    const schritt = { befehl, ziel, status: 'run', ab: 0, bis: null, freigabe: null };
    // Arbeitsbereich, Vorgang, Rechte-Modus und Prozess prueft die Sitzung selbst.
    const s = sitzungen.starte({ arbeitsbereich: ab, vorgang: d.vorgang, modus: d.modus, prompt: auftrag(schritt) });
    let r;
    try {
      r = db.prepare('INSERT INTO ablauf (vorgang, arbeitsbereich, sitzung, schritte_json, aktueller_schritt, status, hinweise_json, erstellt, aktualisiert) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(s.vorgang || null, s.arbeitsbereich, s.id, JSON.stringify([schritt]), 0, 'run', '[]', jetzt(), jetzt());
    } catch (err) {
      // Ohne Zeile liefe eine Sitzung, die kein Ablauf mehr fuehrt.
      try { sitzungen.stopp(s.id); } catch (e2) { console.error('Ablauf: Sitzung ' + s.id + ' nicht gestoppt:', e2.message); }
      throw err;
    }
    const id = Number(r.lastInsertRowid);
    melde(id);
    return anzeige(zeile(id));
  }

  // Weiteren Skill anhaengen (Kachel waehrend eines laufenden Ablaufs).
  function anhaengen(id, d = {}) {
    const a = zeile(id);
    if (!a) throw fehler('Ablauf unbekannt.', 404);
    if (!AKTIV.includes(a.status)) throw fehler('Ablauf läuft nicht mehr. Einen neuen starten.', 409);
    const befehl = befehlVon(d.befehl);
    const ziel = text(d.ziel, 'Ziel');
    pruefeSkill(a.arbeitsbereich, befehl);
    const schritte = schritteVon(a);
    if (schritte.length >= MAX_SCHRITTE) throw fehler('Höchstens ' + MAX_SCHRITTE + ' Schritte je Ablauf.', 409);
    schritte.push({ befehl, ziel, status: 'idle', ab: null, bis: null, freigabe: null });
    setze(id, { schritte_json: JSON.stringify(schritte) });
    melde(id);
    return anzeige(zeile(id));
  }

  // Aktion der Freigabe "ablauf" (auch aus "Braucht dich"). Erst die Eingabe
  // an die Sitzung, dann die Zeile: scheitert die Eingabe, bleibt alles, wie es war.
  function weiterAusfuehren(n, hinweis) {
    const a = n && zeile(n.ablauf);
    if (!a || a.status !== 'wait' || a.aktueller_schritt !== n.schritt) throw fehler('Der Ablauf wartet hier nicht mehr.', 409);
    const h = text(hinweis, 'Hinweis');
    const schritte = schritteVon(a);
    const hinweise = ausJson(a.hinweise_json) || [];
    if (h) hinweise.push({ schritt: n.schritt, art: 'weiter', text: h, zeit: jetzt() });
    const naechster = schritte[n.schritt + 1];
    const ab = letzteId(a.sitzung);
    if (naechster) sitzungen.eingabe(a.sitzung, { text: auftrag(naechster, h) });
    // Mit Vorsatz: ein Hinweis "/irgendwas" startete sonst einen ungeprueften Befehl (Security-Review C6b).
    else if (h) sitzungen.eingabe(a.sitzung, { text: 'Hinweis: ' + h });
    schritte[n.schritt].status = 'done';
    if (naechster) Object.assign(naechster, { status: 'run', ab, bis: null });
    setze(a.id, { schritte_json: JSON.stringify(schritte), hinweise_json: JSON.stringify(hinweise),
      aktueller_schritt: naechster ? n.schritt + 1 : n.schritt, status: naechster ? 'run' : 'done' });
    melde(a.id);
    return { ablauf: a.id, status: naechster ? 'run' : 'done' };
  }
  freigaben.registriere('ablauf', (dbx, n, opt) => weiterAusfuehren(n, opt.hinweis));

  // Freigeben ueber die Freigabe: ihr Statuswechsel ist die Sperre gegen Doppelklick.
  async function weiter(id, d = {}) {
    const a = zeile(id);
    if (!a) throw fehler('Ablauf unbekannt.', 404);
    if (a.status !== 'wait') throw fehler('Der Ablauf wartet gerade nicht.', 409);
    const s = schritteVon(a)[a.aktueller_schritt];
    const h = text(d.hinweis, 'Hinweis');
    const f = s.freigabe ? db.prepare('SELECT status FROM freigabe WHERE id = ?').get(s.freigabe) : null;
    if (f && f.status === 'laeuft') throw fehler('Freigabe ist schon entschieden.', 409);
    // Ohne offene Freigabe (Anlegen scheiterte, Karte verwaist) direkt — der Status prueft dann die Aktion selbst.
    if (!f || f.status !== 'offen') return weiterAusfuehren({ ablauf: id, schritt: a.aktueller_schritt }, h);
    await freigaben.entscheide(db, s.freigabe, { wahl: 'ok', hinweis: h || null });
    return { ablauf: id, status: zeile(id).status };
  }

  function neu(id, d = {}) {
    const a = zeile(id);
    if (!a) throw fehler('Ablauf unbekannt.', 404);
    if (a.status !== 'wait') throw fehler('Neu bauen geht nur bei einem wartenden Schritt.', 409);
    const h = text(d.hinweis, 'Hinweis', { pflicht: true });
    const schritte = schritteVon(a);
    const s = schritte[a.aktueller_schritt];
    const ab = letzteId(a.sitzung);
    sitzungen.eingabe(a.sitzung, { text: auftrag(s, h, 'neu') });
    const alt = s.freigabe;
    Object.assign(s, { status: 'run', ab, bis: null, freigabe: null });
    const hinweise = (ausJson(a.hinweise_json) || []).concat([{ schritt: a.aktueller_schritt, art: 'neu', text: h, zeit: jetzt() }]);
    setze(id, { schritte_json: JSON.stringify(schritte), hinweise_json: JSON.stringify(hinweise), status: 'run' });
    zieheZurueck(alt, 'Neu gebaut mit Hinweis');
    melde(id);
    return { ablauf: id, status: 'run' };
  }

  // Stopp mit Grund: Zeile zuerst (der Hoerer auf das Sitzungsende sieht dann
  // keinen laufenden Ablauf), dann Vorgangs-Log, Freigabe, Sitzung.
  // Scheitert ein Teil nach der Zeile, laufen die uebrigen trotzdem: sonst
  // liefe die Sitzung weiter und die Karte bliebe offen (Silent-Failure-Review C6b).
  function beende(a, grund, { sitzungStoppen = true } = {}) {
    const schritte = schritteVon(a);
    const s = schritte[a.aktueller_schritt];
    // Auch bei Stopp aus "run": spaetere Ereignisse gehoeren nicht mehr zum Schritt.
    if (s.bis == null) s.bis = letzteId(a.sitzung);
    s.status = 'stopped';
    setze(a.id, { schritte_json: JSON.stringify(schritte), status: 'stopped', stop_grund: grund });
    let ersterFehler = null;
    const versuche = (was, fn) => { try { fn(); } catch (err) { console.error('Ablauf ' + a.id + ': ' + was + ':', err); ersterFehler = ersterFehler || err; } };
    if (a.vorgang) {
      versuche('Vorgangs-Log nicht geschrieben', () => db.prepare('INSERT INTO vorgang_log (vorgang, zeit, quelle, text) VALUES (?,?,?,?)')
        .run(a.vorgang, jetzt(), 'ablauf:' + a.id, 'Skill-Ablauf gestoppt nach Schritt ' + (a.aktueller_schritt + 1) + ' (/' + s.befehl + '): ' + grund));
    }
    versuche('Freigabe nicht zurueckgezogen', () => zieheZurueck(s.freigabe, 'Ablauf gestoppt'));
    if (sitzungStoppen && sitzungen.laufend.has(a.sitzung)) versuche('Sitzung nicht gestoppt', () => sitzungen.stopp(a.sitzung));
    melde(a.id);
    if (ersterFehler) throw Object.assign(new Error('Ablauf gestoppt, aber nicht vollständig: ' + ersterFehler.message + ' (Details im Serverprotokoll).'), { status: 500 });
    return { ablauf: a.id, status: 'stopped' };
  }
  function stopp(id, d = {}) {
    const a = zeile(id);
    if (!a) throw fehler('Ablauf unbekannt.', 404);
    if (!AKTIV.includes(a.status)) throw fehler('Ablauf läuft nicht mehr.', 409);
    return beende(a, text(d.grund, 'Grund', { pflicht: true, max: MAX_GRUND }));
  }

  // Schritt fertig: Sitzung meldet "bereit".
  function schrittFertig(sid) {
    const a = db.prepare("SELECT * FROM ablauf WHERE sitzung = ? AND status = 'run'").get(sid);
    if (!a) return;
    const schritte = schritteVon(a);
    const i = a.aktueller_schritt;
    const s = schritte[i];
    Object.assign(s, { status: 'wait', bis: letzteId(sid) });
    setze(a.id, { schritte_json: JSON.stringify(schritte), status: 'wait' });
    try {
      const e = ergebnis(sid, s.ab, s.bis);
      const f = freigaben.anlegen(db, {
        art: 'ablauf', bezug: a.vorgang || 'Ablauf ' + a.id, quelle: 'sitzung:' + sid,
        // Ohne Gesamtzahl: angehaengte Schritte machten sie veraltet.
        titel: kappe('Schritt ' + (i + 1) + ' wartet: /' + s.befehl, 200),
        text: (e.fehler ? 'Fehler: ' + e.fehler + '\n' : '') + (e.antwort || 'Keine Antwort von Claude.'),
        nutzlast: { ablauf: a.id, schritt: i },
      });
      s.freigabe = f.id;
      setze(a.id, { schritte_json: JSON.stringify(schritte) });
    } catch (err) {
      // Ohne Karte bleibt der Schritt in der Szene bedienbar (weiter() geht dann direkt).
      console.error('Ablauf ' + a.id + ': Freigabe nicht angelegt:', err);
    }
    melde(a.id);
  }

  const hoerer = (e) => {
    try {
      if (e.art === 'sitzung' && e.daten.status === 'bereit') schrittFertig(e.daten.id);
      else if (e.art === 'sitzung_beendet') {
        const a = db.prepare("SELECT * FROM ablauf WHERE sitzung = ? AND status IN ('run', 'wait')").get(e.daten.id);
        if (a) {
          const s = db.prepare('SELECT status, fehler FROM sitzung WHERE id = ?').get(e.daten.id);
          beende(a, s && s.status === 'fehler' ? 'Sitzung mit Fehler beendet: ' + kappe(String(s.fehler || ''), 300) : 'Sitzung beendet.', { sitzungStoppen: false });
        }
      } else if (e.art === 'freigabe' && e.daten.status === 'abgelehnt') {
        // Abgelehnt in "Braucht dich" = Stopp; der Hinweis der Ablehnung ist der Grund.
        const f = db.prepare("SELECT art, nutzlast_json, hinweis FROM freigabe WHERE id = ? AND art = 'ablauf'").get(e.daten.id);
        const n = f && ausJson(f.nutzlast_json);
        const a = n && zeile(n.ablauf);
        if (a && a.status === 'wait' && a.aktueller_schritt === n.schritt && schritteVon(a)[n.schritt].freigabe === e.daten.id) {
          beende(a, f.hinweis ? kappe(f.hinweis, MAX_GRUND) : 'In „Braucht dich“ abgelehnt.');
        }
      }
    } catch (err) { console.error('Ablauf: Ereignis ' + e.art + ' nicht verarbeitet:', err); }
  };
  ereignisse.bus.on('ereignis', hoerer);

  // Beim Start: Sitzungen ueberleben keinen Neustart, ihre Ablaeufe auch nicht.
  function aufraeumen() {
    const alt = db.prepare("SELECT * FROM ablauf WHERE status IN ('run', 'wait')").all();
    // Einzeln: ein kaputter Ablauf haelt die anderen nicht in "run".
    for (const a of alt) { try { beende(a, 'Server wurde neu gestartet.', { sitzungStoppen: false }); } catch (err) { console.error('Ablauf ' + a.id + ' aufraeumen:', err.message); } }
    return alt.length;
  }

  function routen(req, res, p, u, mittel) {
    const { sendJson } = mittel;
    // Wie bei den Sitzungen: startet Prozesse, also nur mit den Kopfzeilen der eigenen Seite.
    const { fehler: fehlerAntwort, post } = routenHelfer(req, res, p, mittel, 'Abläufe');
    if (p === '/api/ablaeufe' && req.method === 'GET') { sendJson(res, { ablaeufe: offene() }); return true; }
    if (p === '/api/ablauf' && req.method === 'POST') { post((d) => ({ ablauf: starte(d) })); return true; }
    const m = p.match(/^\/api\/ablauf\/(\d{1,9})(?:\/(weiter|neu|stopp|schritt))?$/);
    if (!m) return false;
    const id = Number(m[1]);
    if (!m[2] && req.method === 'GET') { try { sendJson(res, details(id)); } catch (err) { fehlerAntwort(err); } return true; }
    if (m[2] && req.method === 'POST') {
      const fn = { weiter, neu, stopp, schritt: anhaengen }[m[2]];
      post((d) => fn(id, d));
      return true;
    }
    return false;
  }

  return { starte, anhaengen, weiter, neu, stopp, details, offene, aufraeumen, routen, schliesse: () => ereignisse.bus.off('ereignis', hoerer) };
}

module.exports = { erzeuge, auftrag };
