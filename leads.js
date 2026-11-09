'use strict';
// Leads als eigene Datensaetze (C12). Ein Lead bleibt nach der Umwandlung
// erhalten, damit sich auswerten laesst, welche Quelle Kunden bringt. Geloescht
// wird nicht: Fehler enden als "verloren · Dublette".
//
// Nur kontakte.js wird geladen; Angebote werden per SQL umgehaengt, sonst
// entstuende ein Kreis mit angebot.js (das hier beiAnnahme ruft).
const kontakte = require('./kontakte');
// Nur die Offen-Regel; rechnung.js laedt leads.js nicht (kein Kreis).
const { ANGEBOT_OFFEN } = require('./rechnung');
// Dieselbe Adressregel wie der Versand (mail.js laedt leads.js erst zur Laufzeit, kein Kreis).
const { EMAIL_RE } = require('./mail');

// Feste Listen, nur hier. Die Oberflaeche holt sie ueber /api/leads.
const QUELLEN = [
  { wert: 'website', de: 'Website', en: 'Website' },
  { wert: 'empfehlung', de: 'Empfehlung', en: 'Referral' },
  { wert: 'social_organisch', de: 'Social Media (organisch)', en: 'Social media (organic)' },
  { wert: 'social_ad', de: 'Social Ad', en: 'Social ad' },
  { wert: 'event', de: 'Event', en: 'Event' },
  { wert: 'kaltakquise', de: 'Kaltakquise', en: 'Cold outreach' },
  { wert: 'partner', de: 'Partner', en: 'Partner' },
  { wert: 'sonstiges', de: 'Sonstiges', en: 'Other' },
];
const VERLOREN_GRUENDE = [
  { wert: 'kein_bedarf', de: 'Kein Bedarf', en: 'No need' },
  { wert: 'kein_budget', de: 'Kein Budget', en: 'No budget' },
  { wert: 'preis', de: 'Preis', en: 'Price' },
  { wert: 'wettbewerber', de: 'Wettbewerber', en: 'Competitor' },
  { wert: 'keine_rueckmeldung', de: 'Keine Rückmeldung', en: 'No response' },
  { wert: 'zeitpunkt', de: 'Zeitpunkt', en: 'Timing' },
  { wert: 'passt_nicht', de: 'Passt nicht', en: 'Not a fit' },
  { wert: 'dublette', de: 'Dublette', en: 'Duplicate' },
];
const istQuelle = (w) => QUELLEN.some((q) => q.wert === w);
const istGrund = (w) => VERLOREN_GRUENDE.some((g) => g.wert === w);

// Grenzen aus kontakte.js (FELDER; Telefon wie beim Ansprechpartner): der Lead
// fuellt bei der Umwandlung genau diese Felder.
const KF = kontakte.FELDER;
const TEXTE = {
  firma: KF.firma, vorname: KF.vorname, nachname: KF.nachname, email: KF.email,
  telefon: { max: 40, label: 'Telefon' },
  notiz: KF.notiz,
};
const ANSCHRIFT = KF.anschrift;

function fehler(msg, status) {
  const e = new Error(msg);
  if (status) e.status = status;
  return e;
}

// Nur bekannte Felder; fehlende bleiben fehlend (Teilaenderung leert nichts).
function pruefe(db, daten, { neu }) {
  const d = daten && typeof daten === 'object' ? daten : {};
  const w = {};
  for (const [feld, r] of Object.entries(TEXTE)) {
    if (d[feld] === undefined) continue;
    w[feld] = kontakte.text(d[feld], r.max, r.label);
    // Nur die Notiz ist mehrzeilig; text() laesst Tab und Zeilenwechsel fuer Notizen durch.
    if (feld !== 'notiz' && /[\r\n\t]/.test(w[feld])) throw fehler(r.label + ': nur eine Zeile.');
  }
  if (d.anschrift !== undefined) w.anschrift = JSON.stringify(kontakte.zeilen(d.anschrift, ANSCHRIFT, 'Anschrift'));
  if (d.quelle !== undefined) {
    if (!istQuelle(d.quelle)) throw fehler('Leadquelle: unbekannter Wert.');
    w.quelle = d.quelle;
  }
  if (d.kunde_id !== undefined) w.kunde_id = kontakte.pruefeId(db, d.kunde_id);
  if (w.email && !EMAIL_RE.test(w.email)) throw fehler('E-Mail: Adresse sieht nicht wie eine E-Mail aus.');
  if (neu && !w.firma && !w.vorname && !w.nachname && !w.email) throw fehler('Firma, Name oder E-Mail fehlt.');
  if (!neu && Object.keys(w).length === 0) throw fehler('Keine aenderbaren Angaben uebergeben.');
  return w;
}

function ausZeile(r) {
  if (!r) return null;
  return {
    id: r.id,
    lead_nr: 'L-' + String(r.id).padStart(4, '0'),
    firma: r.firma, vorname: r.vorname, nachname: r.nachname,
    email: r.email, telefon: r.telefon,
    anschrift: JSON.parse(r.anschrift || '[]'),
    notiz: r.notiz, quelle: r.quelle, status: r.status,
    verloren_grund: r.verloren_grund || null, verloren_am: r.verloren_am || null,
    kunde_id: r.kunde_id || null,
    umgewandelt_am: r.umgewandelt_am || null, umwandlung_art: r.umwandlung_art || null,
    erstellt_am: r.erstellt_am, geaendert_am: r.geaendert_am || null,
  };
}

function idVon(roh) {
  const id = typeof roh === 'number' ? roh : typeof roh === 'string' && /^\d+$/.test(roh) ? Number(roh) : NaN;
  if (!Number.isInteger(id) || id <= 0) throw fehler('Unbekannter Lead.', 404);
  return id;
}

function lade(db, id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return ausZeile(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
}

function ladePflicht(db, roh) {
  const l = lade(db, idVon(roh));
  if (!l) throw fehler('Unbekannter Lead.', 404);
  return l;
}

// Offen: dieselbe Regel wie rechnung.jeKontakt (ANGEBOT_OFFEN). Unqualifizierte
// Spalten im Unterabfrage-Teil meinen angebote (innerste Ebene zuerst).
function liste(db) {
  const leads = db.prepare(`
    SELECT l.*, k.firma AS kunde_firma, k.kundennummer AS kunde_nr,
      (SELECT COUNT(*) FROM angebote a WHERE a.lead_id = l.id AND ${ANGEBOT_OFFEN}) AS angebote_offen
    FROM leads l LEFT JOIN kontakte k ON k.id = l.kunde_id
    ORDER BY l.id DESC
  `).all(new Date().toISOString()).map((r) => ({
    ...ausZeile(r), kunde_firma: r.kunde_firma || '', kunde_nr: r.kunde_nr || '', angebote_offen: r.angebote_offen,
  }));
  const bericht = db.prepare(`
    SELECT quelle, SUM(status = 'offen') AS offen, SUM(status = 'umgewandelt') AS umgewandelt,
      SUM(status = 'verloren') AS verloren
    FROM leads GROUP BY quelle ORDER BY quelle
  `).all().map((r) => ({ ...r }));
  return { leads, bericht };
}

// Kandidaten, nie ein Block: der automatische Eingang (C12c) legt trotzdem an.
function dublettenKandidaten(db, { email, firma } = {}) {
  const e = email == null ? '' : kontakte.text(String(email), 120, 'E-Mail');
  const f = firma == null ? '' : kontakte.text(String(firma), 200, 'Firma');
  const domain = e.includes('@') ? e.slice(e.lastIndexOf('@') + 1).toLowerCase() : '';
  if (!e && !f && !domain) return { leads: [], kunden: [] };
  // ponytail: Freemailer (gmail.com …) treffen ueber die Domain jeden; Ausschlussliste, falls das stoert.
  const dom = "(? <> '' AND lower(substr(X, instr(X, '@') + 1)) = ? AND instr(X, '@') > 0)";
  const treffer = (spalte) => `((? <> '' AND ${spalte} = ? COLLATE NOCASE) OR ${dom.replace(/X/g, spalte)})`;
  const leads = db.prepare(`
    SELECT * FROM leads
    WHERE ${treffer('email')} OR (? <> '' AND firma = ? COLLATE NOCASE)
    ORDER BY id DESC LIMIT 10
  `).all(e, e, domain, domain, f, f).map(ausZeile);
  const kunden = db.prepare(`
    SELECT k.id, k.firma, k.kundennummer FROM kontakte k
    WHERE ${treffer('k.email')} OR (? <> '' AND k.firma = ? COLLATE NOCASE)
      OR EXISTS (SELECT 1 FROM ansprechpartner a WHERE a.kontakt_id = k.id AND ${treffer('a.email')})
    ORDER BY k.firma COLLATE NOCASE LIMIT 10
  `).all(e, e, domain, domain, f, f, e, e, domain, domain)
    .map((r) => ({ id: r.id, firma: r.firma, kundennummer: r.kundennummer || '' }));
  return { leads, kunden };
}

function anlegen(db, daten) {
  const w = pruefe(db, daten, { neu: true });
  const dubletten = dublettenKandidaten(db, { email: w.email, firma: w.firma });
  const jetzt = new Date().toISOString();
  const felder = Object.keys(w);
  const id = Number(db.prepare(`
    INSERT INTO leads (${felder.concat('erstellt_am', 'geaendert_am').join(', ')})
    VALUES (${felder.map(() => '?').concat('?', '?').join(', ')})
  `).run(...felder.map((f) => w[f]), jetzt, jetzt).lastInsertRowid);
  return { lead: lade(db, id), dubletten };
}

function aendern(db, daten = {}) {
  const l = ladePflicht(db, (daten || {}).id);
  if (l.status !== 'offen') throw fehler('Nur offene Leads lassen sich ändern.', 409);
  const w = pruefe(db, daten, { neu: false });
  const felder = Object.keys(w);
  db.prepare(`UPDATE leads SET ${felder.map((f) => f + ' = ?').join(', ')}, geaendert_am = ? WHERE id = ?`)
    .run(...felder.map((f) => w[f]), new Date().toISOString(), l.id);
  return lade(db, l.id);
}

// grund null = zurueck auf offen (Undo). Ein umgewandelter Lead bleibt umgewandelt.
function verloren(db, { id, grund } = {}) {
  const l = ladePflicht(db, id);
  if (l.status === 'umgewandelt') throw fehler('Lead ist bereits umgewandelt.', 409);
  const jetzt = new Date().toISOString();
  if (grund === null) {
    db.prepare("UPDATE leads SET status = 'offen', verloren_grund = NULL, verloren_am = NULL, geaendert_am = ? WHERE id = ?").run(jetzt, l.id);
  } else {
    if (!istGrund(grund)) throw fehler('Verloren-Grund: unbekannter Wert.');
    db.prepare("UPDATE leads SET status = 'verloren', verloren_grund = ?, verloren_am = ?, geaendert_am = ? WHERE id = ?").run(grund, jetzt, jetzt, l.id);
  }
  return lade(db, l.id);
}

// Ohne eigene Transaktion: laeuft in der des Aufrufers (Annahme, Rechnung).
// Ein verlorener Lead darf umgewandelt werden (gewonnen schlaegt verloren).
function umwandelnRoh(db, { id, art, kunde_id } = {}) {
  const l = ladePflicht(db, id);
  if (l.status === 'umgewandelt') throw fehler('Lead ist bereits umgewandelt.', 409);
  let kid;
  if (art === 'neu') {
    const person = [l.vorname, l.nachname].filter(Boolean).join(' ');
    const firma = l.firma || person || l.email;
    // Der Umzug haengt Felder an die Notiz, auch ueber die Kontaktgrenze hinaus.
    // Der Lead behaelt den vollen Text, der Kunde eine Kuerzung mit Verweis.
    const max = kontakte.FELDER.notiz.max;
    const verweis = ` … (vollständig in ${l.lead_nr})`;
    const notiz = l.notiz.length > max ? l.notiz.slice(0, max - verweis.length).trimEnd() + verweis : l.notiz;
    const k = kontakte.speichere(db, {
      firma, vorname: l.vorname, nachname: l.nachname,
      anschrift: l.anschrift, email: l.email, notiz,
    });
    kid = k.id;
    // Der Kontakt hat kein Telefonfeld: ohne Ansprechpartner ginge es verloren.
    if (person || l.telefon) {
      kontakte.speichereAnsprechpartner(db, { kontakt_id: kid, name: person || firma, email: l.email, telefon: l.telefon });
    }
  } else if (art === 'zusammengefuehrt') {
    kid = kontakte.pruefeId(db, kunde_id === undefined || kunde_id === null || kunde_id === '' ? l.kunde_id : kunde_id);
    if (kid === null) throw fehler('Zusammenführen: Kunde fehlt.');
  } else {
    throw fehler("Umwandlung: nur 'neu' oder 'zusammengefuehrt'.");
  }
  const jetzt = new Date().toISOString();
  db.prepare(`UPDATE leads SET status = 'umgewandelt', umgewandelt_am = ?, umwandlung_art = ?, kunde_id = ?,
    verloren_grund = NULL, verloren_am = NULL, geaendert_am = ? WHERE id = ?`).run(jetzt, art, kid, jetzt, l.id);
  db.prepare('UPDATE angebote SET kontakt_id = ? WHERE lead_id = ? AND kontakt_id IS NULL').run(kid, l.id);
  return { lead_id: l.id, art, kontakt_id: kid, kundennummer: kontakte.lade(db, kid).kundennummer };
}

function umwandeln(db, daten) {
  return kontakte.inTransaktion(db, () => umwandelnRoh(db, daten));
}

// Annahme eines Angebots: Lead ohne Kundenbezug wird neuer Kunde, mit Bezug
// zusammengefuehrt. Kein oder schon umgewandelter Lead: nichts zu tun.
function beiAnnahme(db, leadId) {
  const l = Number.isInteger(leadId) ? lade(db, leadId) : null;
  if (!l || l.status === 'umgewandelt') return null;
  return umwandelnRoh(db, { id: l.id, art: l.kunde_id ? 'zusammengefuehrt' : 'neu', kunde_id: l.kunde_id });
}

// Nach scharfem Versand eines Angebots: offener Lead mit Kundenbezug wird
// zusammengefuehrt. Eigene kurze Transaktion (der Aufrufer ist nach einem await).
function nachVersand(db, nr) {
  const a = db.prepare('SELECT lead_id FROM angebote WHERE nr = ?').get(nr);
  const l = a && a.lead_id ? lade(db, a.lead_id) : null;
  if (!l || l.status !== 'offen' || !l.kunde_id) return null;
  return umwandeln(db, { id: l.id, art: 'zusammengefuehrt', kunde_id: l.kunde_id });
}

module.exports = {
  QUELLEN, VERLOREN_GRUENDE, anlegen, aendern, lade, liste, verloren,
  umwandelnRoh, umwandeln, beiAnnahme, nachVersand, dublettenKandidaten,
};
