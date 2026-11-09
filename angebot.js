'use strict';
// Angebote: die Kalkulation vor dem Auftrag.
//
// Bewusst getrennt von rechnung.js, obwohl beide sich aehneln — die
// Unterschiede sind fachlich, nicht technisch:
//   - Ein Angebot ist kein Par.-14-Dokument. Es darf geloescht werden, es
//     gibt keinen Storno, und eine Luecke im Nummernkreis ist unkritisch.
//   - Dafuer hat es eine Bindefrist und den Hinweis auf Freibleiblichkeit.
//   - Positionen entstehen aus einer Schaetzung, nicht aus gemessener Zeit.
//
// Gemeinsam bleibt, was gemeinsam bleiben muss: Steuerlogik, Rundung,
// Positionsdarstellung und Stammdatenpruefung kommen aus rechnung.js. Ein
// zweiter Satz Formeln waere die sicherste Art, dass Angebot und Rechnung
// eines Tages verschiedene Betraege fuer dieselbe Leistung ausweisen.
const path = require('node:path');
const config = require('./config.json');
const metrics = require('./metrics');
const rechnung = require('./rechnung');
const kontakte = require('./kontakte');
// Kein Kreis: leads.js laedt angebot.js nicht (haengt Angebote per SQL um).
const leads = require('./leads');

const { rund2, steuer, esc, positionsZeilen, vergleichsHinweis, eur, datum, freiePosition } = rechnung;

const NUMMER_RE = /^AN-\d{4}-\d{4}$/;
const ANGEBOTS_DIR = path.join(__dirname, 'data', 'angebote');

// Standard-Gueltigkeit aus Einstellungen -> Stammdaten (1 bis 365 ganze Tage),
// fehlt sie oder passt nicht, gelten 30. Zur Zeit des Aufrufs gelesen, nicht beim Laden.
function gueltigTageStandard() {
  const n = config.rechnung && config.rechnung.angebotGueltigTage;
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : 30;
}

function naechsteNummer(db, jahr) {
  const row = db.prepare(
    'SELECT COALESCE(MAX(laufnr), 0) + 1 AS n FROM angebote WHERE jahr = ?'
  ).get(jahr);
  return { laufnr: row.n, nr: `AN-${jahr}-${String(row.n).padStart(4, '0')}` };
}

// Freie Positionen prueft rechnung.freiePosition — eine Pruefung fuer beide
// Belegarten (R8).

// Positionen aus bereits erfassten Vorgaengen. Nuetzlich fuer Nachtraege und
// Folgeauftraege: die Schaetzung stuetzt sich dann auf gemessene Zeit.
function vorgangsPositionen(db, { from, to, tickets }, vFaktor) {
  const gewaehlt = new Set(tickets);
  const zeilen = metrics.byTicket(db, { from, to }).filter((t) => gewaehlt.has(t.ticket));
  if (zeilen.length === 0) {
    throw new Error('Zu den gewaehlten Vorgaengen gibt es im Zeitraum keine Daten.');
  }
  return zeilen.map((t) => ({
    bezeichnung: 'Entwicklungsleistung Vorgang ' + t.ticket,
    ticket: t.ticket,
    von: t.first_day,
    bis: t.last_day,
    stunden: rund2(t.active_hours),
    zeitmodell: t.zeitmodell,
    basissatz: rund2(t.stundensatz_standard),
    rabatt_prozent: t.rabatt_prozent || 0,
    satz: rund2(t.stundensatz),
    // Claude-Stunden x Satz aus den gedruckten Werten (wie rechnung.js, H2);
    // manuelle Zeit gehoert nicht in diese Position.
    betrag_eur: rund2(rund2(t.active_hours) * rund2(t.stundensatz)),
    vergleich_stunden: vFaktor > 1 ? rund2(t.active_hours * vFaktor) : null,
    vergleich_faktor: vFaktor > 1 ? vFaktor : null,
  }));
}

// Das Angebot ohne Nummer, ohne Schreiben. erstelle() schreibt es, vorschau()
// zeigt es — derselbe Weg, damit beide nicht auseinanderlaufen.
function entwurf(db, { posten, from, to, tickets, empfaenger, gueltigTage, kontaktId, leadId } = {}) {
  // Dieselbe Pruefung wie bei der Rechnung: ohne Stammdaten steht auf dem
  // Dokument nicht, wer es ausgestellt hat.
  rechnung.pruefeStammdaten();
  if (!empfaenger || typeof empfaenger.name !== 'string' || !empfaenger.name.trim()) {
    throw new Error('Empfaenger fehlt (Name ist Pflicht).');
  }
  // Nur die beiden bekannten Felder uebernehmen, und zwar geprueft: der
  // Anfragekoerper geht sonst unbesehen in die Abschrift und von dort ins
  // Dokument. Escaping beim Rendern faengt XSS ab, aber nicht eine Adresse
  // mit tausend Zeilen.
  const empf = {
    name: empfaenger.name.trim().slice(0, 200),
    anschrift: (Array.isArray(empfaenger.anschrift) ? empfaenger.anschrift : [])
      .filter((z) => typeof z === 'string')
      .map((z) => z.trim()).filter(Boolean).slice(0, 6)
      .map((z) => z.slice(0, 120)),
  };
  kontakte.ohneErsatzzeichen(empf.name, 'Empfaenger');
  empf.anschrift.forEach((z) => kontakte.ohneErsatzzeichen(z, 'Empfaenger-Anschrift'));

  // Nur der Verweis, nicht der Inhalt: der Empfaenger oben bleibt die
  // massgebliche Abschrift. Der Verweis dient der Auswertung und der
  // Umwandlung Lead -> Kunde bei Annahme.
  const kid = kontakte.pruefeId(db, kontaktId);
  // Angebot an einen Lead (C12): entweder Kunde oder Lead, nie beides. Ein
  // umgewandelter Lead hat einen Kunden — dorthin gehoert das Angebot.
  let lid = null;
  if (leadId !== undefined && leadId !== null && leadId !== '') {
    if (kid !== null) throw new Error('Angebot: Kunde oder Lead, nicht beides.');
    const n = typeof leadId === 'number' ? leadId : typeof leadId === 'string' && /^\d+$/.test(leadId) ? Number(leadId) : NaN;
    const l = leads.lade(db, n);
    if (!l) throw new Error('Unbekannter Lead.');
    if (l.status === 'umgewandelt') {
      // R9: den Kunden nennen, sonst sucht der Nutzer ihn erst.
      const k = kontakte.lade(db, l.kunde_id);
      const wer = k ? [k.kundennummer, k.firma || [k.vorname, k.nachname].filter(Boolean).join(' ')].filter(Boolean).join(' ') : 'gelöscht';
      throw new Error('Lead ' + l.lead_nr + ' ist bereits umgewandelt (Kunde ' + wer + ') — Angebot an den Kunden richten.');
    }
    lid = l.id;
  }

  const vFaktor = Number(config.vergleichsFaktor) || 0;
  const positionen = [];
  if (Array.isArray(posten)) {
    // Obergrenze, damit die Abschrift nicht ins Uferlose waechst. Ein Angebot
    // mit hundert Positionen ist ohnehin keins mehr, das jemand liest.
    if (posten.length > 100) throw new Error('Hoechstens 100 Positionen je Angebot.');
    for (const p of posten) positionen.push(freiePosition(p, vFaktor));
  }
  if (Array.isArray(tickets) && tickets.length > 0) {
    if (!from || !to) throw new Error('Fuer uebernommene Vorgaenge fehlt der Zeitraum.');
    if (!rechnung.istTag(from) || !rechnung.istTag(to)) throw new Error('Zeitraum: Datum in der Form JJJJ-MM-TT erwartet.');
    if (tickets.length > 200) throw new Error('Hoechstens 200 Vorgaenge je Angebot.');
    positionen.push(...vorgangsPositionen(db, { from, to, tickets }, vFaktor));
  }
  if (positionen.length === 0) throw new Error('Das Angebot enthaelt keine Position.');

  // Wie beim Zahlungsziel: fehlt die Angabe, gilt der Standard; eine falsche
  // Angabe faellt auf, statt still ersetzt zu werden.
  let tage = gueltigTageStandard();
  if (gueltigTage !== undefined && gueltigTage !== null && gueltigTage !== '') {
    if (!Number.isInteger(gueltigTage) || gueltigTage < 1 || gueltigTage > 365) {
      throw new Error('Gueltigkeit: ganze Tage von 1 bis 365.');
    }
    tage = gueltigTage;
  }
  const jetzt = new Date();
  const gueltig = new Date(jetzt);
  gueltig.setDate(gueltig.getDate() + tage);

  const netto = rund2(positionen.reduce((s, p) => s + p.betrag_eur, 0));
  const { klein, satz, ust, brutto } = steuer(netto);
  return {
    erstellt_am: jetzt.toISOString(), gueltig_bis: gueltig.toISOString(),
    empfaenger: empf, aussteller: rechnung.stammdaten(), positionen,
    netto_eur: netto, ust_prozent: satz, ust_eur: ust, brutto_eur: brutto,
    kleinunternehmer: klein, status: 'offen', kontakt_id: kid, lead_id: lid,
  };
}

function erstelle(db, daten = {}) {
  const d = entwurf(db, daten);
  rechnung.pruefeErwartet(d, daten.erwartetBrutto);
  const { nr, laufnr } = naechsteNummer(db, new Date(d.erstellt_am).getFullYear());
  db.prepare(`
    INSERT INTO angebote (nr, jahr, laufnr, erstellt_am, gueltig_bis,
      empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur,
      brutto_eur, kleinunternehmer, status, kontakt_id, lead_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'offen',?,?)
  `).run(
    nr, new Date(d.erstellt_am).getFullYear(), laufnr, d.erstellt_am, d.gueltig_bis,
    JSON.stringify(d.empfaenger), JSON.stringify(d.aussteller),
    JSON.stringify(d.positionen), d.netto_eur, d.ust_prozent, d.ust_eur, d.brutto_eur,
    d.kleinunternehmer ? 1 : 0, d.kontakt_id, d.lead_id
  );
  return lade(db, nr);
}

// Vorschau fuer den Editor (R6), wie rechnung.vorschau().
function vorschau(db, daten = {}) {
  const d = entwurf(db, daten);
  return {
    html: renderHtml({ ...d, nr: 'ENTWURF' }),
    netto_eur: d.netto_eur, ust_prozent: d.ust_prozent, ust_eur: d.ust_eur,
    brutto_eur: d.brutto_eur, kleinunternehmer: d.kleinunternehmer, positionen: d.positionen, gueltig_bis: d.gueltig_bis,
  };
}

function lade(db, nr) {
  if (!NUMMER_RE.test(String(nr || ''))) return null;
  const row = db.prepare('SELECT * FROM angebote WHERE nr = ?').get(nr);
  if (!row) return null;
  return {
    ...row,
    empfaenger: JSON.parse(row.empfaenger),
    aussteller: JSON.parse(row.aussteller),
    positionen: JSON.parse(row.positionen),
    kleinunternehmer: !!row.kleinunternehmer,
  };
}

function liste(db) {
  const heute = new Date().toISOString();
  return db.prepare(`
    SELECT nr, erstellt_am, gueltig_bis, empfaenger, brutto_eur, status, rechnung_nr, kontakt_id, lead_id, angenommen_am, abgelehnt_am
    FROM angebote ORDER BY jahr DESC, laufnr DESC
  `).all().map((r) => ({
    nr: r.nr,
    erstellt_am: r.erstellt_am,
    gueltig_bis: r.gueltig_bis,
    empfaenger: (JSON.parse(r.empfaenger) || {}).name || '',
    brutto_eur: r.brutto_eur,
    // Abgelaufen wird abgeleitet, nicht gespeichert: sonst muesste jemand
    // taeglich einen Auftrag laufen lassen, damit der Status stimmt.
    // SQL-Gegenstueck dieser Offen-Regel: rechnung.ANGEBOT_OFFEN.
    status: r.status === 'offen' && r.gueltig_bis < heute ? 'abgelaufen' : r.status,
    // Fuer die neue Oberflaeche: abgerechnet ist ein eigener Stand, nicht nur
    // "angenommen mit Rechnung". Das Feld status bleibt, wie die alte es liest.
    status_abgeleitet: r.rechnung_nr ? 'abgerechnet'
      : r.status === 'offen' && r.gueltig_bis < heute ? 'abgelaufen' : r.status,
    rechnung_nr: r.rechnung_nr,
    kontakt_id: r.kontakt_id,
    lead_id: r.lead_id,
    angenommen_am: r.angenommen_am,
    abgelehnt_am: r.abgelehnt_am,
  }));
}

// Zeitpunkt aus einem Rueckgaengig-Stand: ISO-Zeit oder (wo erlaubt) null.
function zeitpunkt(v, feld, leerErlaubt) {
  if (v === null && leerErlaubt) return null;
  if (typeof v !== 'string' || v.length > 40 || !Number.isFinite(Date.parse(v))) throw new Error(feld + ': kein gueltiger Zeitpunkt.');
  // Grenze: Jahre ausserhalb vierstelliger Form ("+275760-…") sortieren als
  // Text falsch und liessen ein Angebot sofort abgelaufen erscheinen.
  const jahr = new Date(v).getUTCFullYear();
  if (jahr < 2000 || jahr > 2100) throw new Error(feld + ': ausserhalb des erlaubten Bereichs.');
  return new Date(v).toISOString();
}

// Ohne `stand`: Status setzen, Zeitpunkt der Zusage bzw. Ablehnung festhalten,
// ein abgelaufenes Angebot beim Wiederoeffnen um die Standard-Gueltigkeit
// verlaengern. Mit `stand` (Rueckgaengig): genau diesen vorigen Stand
// wiederherstellen — Gueltigkeit und beide Zeitpunkte. Eine Umwandlung des
// Leads bleibt dabei bestehen (Kundennummer ist verbraucht, C12 Festlegung 2).
function setzeStatus(db, nr, status, stand) {
  if (!['offen', 'angenommen', 'abgelehnt'].includes(status)) {
    throw new Error('Unbekannter Status.');
  }
  const a = lade(db, nr);
  if (!a) throw new Error('Angebot nicht gefunden.');
  if (a.rechnung_nr) throw new Error('Zu diesem Angebot gibt es bereits eine Rechnung.');
  const jetzt = new Date();
  let f;
  if (stand !== undefined && stand !== null) {
    if (typeof stand !== 'object' || Array.isArray(stand)) throw new Error('Stand: Objekt erwartet.');
    f = {
      gueltig_bis: zeitpunkt(stand.gueltig_bis, 'Gueltig bis', false),
      angenommen_am: zeitpunkt(stand.angenommen_am === undefined ? null : stand.angenommen_am, 'Angenommen am', true),
      abgelehnt_am: zeitpunkt(stand.abgelehnt_am === undefined ? null : stand.abgelehnt_am, 'Abgelehnt am', true),
    };
    // Zeitpunkt nur zum passenden Status — sonst widerspraeche die Karte sich selbst.
    if ((f.angenommen_am && status !== 'angenommen') || (f.abgelehnt_am && status !== 'abgelehnt')) {
      throw new Error('Stand: Zeitpunkt passt nicht zum Status.');
    }
    // Wiederherstellen ueberspringt beiAnnahme: angenommen ohne umgewandelten Lead
    // hiesse ein angenommenes Angebot ohne Kunden.
    const l = status === 'angenommen' && Number.isInteger(a.lead_id) ? leads.lade(db, a.lead_id) : null;
    if (l && l.status !== 'umgewandelt') throw new Error('Stand: Lead ' + l.lead_nr + ' ist nicht umgewandelt, bitte regulär annehmen.');
  } else {
    f = { gueltig_bis: a.gueltig_bis, angenommen_am: null, abgelehnt_am: null };
    if (status === 'angenommen') f.angenommen_am = jetzt.toISOString();
    if (status === 'abgelehnt') f.abgelehnt_am = jetzt.toISOString();
    if (status === 'offen' && a.gueltig_bis < jetzt.toISOString()) {
      const neu = new Date(jetzt);
      neu.setDate(neu.getDate() + gueltigTageStandard());
      f.gueltig_bis = neu.toISOString();
    }
  }
  // Status und Umwandlung zusammen: scheitert die Umwandlung, bleibt das
  // Angebot offen. SAVEPOINT, deshalb auch in einer offenen Ingest-Transaktion.
  const umwandlung = kontakte.inTransaktion(db, () => {
    db.prepare('UPDATE angebote SET status = ?, gueltig_bis = ?, angenommen_am = ?, abgelehnt_am = ? WHERE nr = ?')
      .run(status, f.gueltig_bis, f.angenommen_am, f.abgelehnt_am, nr);
    // Annahme ist der Touchpoint: Lead ohne Kunde -> neuer Kunde, mit Bezug ->
    // zusammengefuehrt. Nur bei echter Annahme, nicht beim Rueckgaengig.
    return !stand && status === 'angenommen' ? leads.beiAnnahme(db, a.lead_id) : null;
  });
  return { ...lade(db, nr), kunde_geworden: umwandlung?.art === 'neu', umwandlung };
}

// Loeschen ist erlaubt — anders als bei der Rechnung. Ein Angebot ist keine
// steuerlich relevante Aufzeichnung; eine Luecke im Nummernkreis schadet nicht.
function loesche(db, nr) {
  const a = lade(db, nr);
  if (!a) throw new Error('Angebot nicht gefunden.');
  if (a.rechnung_nr) throw new Error('Zu diesem Angebot gibt es eine Rechnung, es bleibt erhalten.');
  db.prepare('DELETE FROM angebote WHERE nr = ?').run(nr);
  return { nr };
}

// Angebot in eine Rechnung ueberfuehren. Das Angebot selbst bleibt
// unveraendert: was zugesagt wurde, bleibt nachlesbar, auch wenn sich
// Saetze inzwischen geaendert haben.
function inRechnung(db, nr) {
  const a = lade(db, nr);
  if (!a) throw new Error('Angebot nicht gefunden.');
  if (a.rechnung_nr) throw new Error('Aus diesem Angebot wurde bereits Rechnung ' + a.rechnung_nr + '.');

  // Eine Transaktion um Umwandlung und Rechnung: scheitert die Rechnung (etwa
  // an fehlenden Stammdaten), gibt es weder neuen Kunden noch verbrauchte
  // Kundennummer. Erst umwandeln, dann kontakt_id neu lesen: die Rechnung
  // haengt immer am Kunden und traegt so seine Nummer.
  const inv = kontakte.inTransaktion(db, () => {
    leads.beiAnnahme(db, a.lead_id);
    return rechnung.ausPositionen(db, {
      positionen: a.positionen,
      empfaenger: a.empfaenger,
      von: a.erstellt_am.slice(0, 10),
      bis: new Date().toISOString().slice(0, 10),
      kontaktId: lade(db, nr).kontakt_id,
      // In derselben Transaktion wie die Rechnung: sonst gaebe es eine Rechnung,
      // deren Angebot weiter als offen gilt (Toolcheck 15.10., H6).
      danach: (rnr) => {
        db.prepare("UPDATE angebote SET rechnung_nr = ?, status = 'angenommen', angenommen_am = COALESCE(angenommen_am, ?), abgelehnt_am = NULL WHERE nr = ?")
          .run(rnr, new Date().toISOString(), nr);
      },
    });
  });
  return { angebot: lade(db, nr), rechnung: inv };
}

// Der Fusstext trifft eine Aussage zur Abrechnung. Er muss zur Zusammen-
// setzung des Angebots passen: ein Festpreis wird nicht nach Aufwand
// abgerechnet, und ein Stundenangebot ist kein Festpreis.
function fussText(hatStunden, hatPauschal) {
  if (hatStunden && hatPauschal) {
    return 'Freibleibendes Angebot. Die als Stunden ausgewiesenen Positionen sind eine '
      + 'Sch&auml;tzung und werden nach tats&auml;chlichem Aufwand abgerechnet; als pauschal '
      + 'gekennzeichnete Positionen sind Festpreise f&uuml;r die beschriebene Leistung.';
  }
  if (hatPauschal) {
    return 'Freibleibendes Angebot. Die genannten Preise sind Festpreise f&uuml;r die '
      + 'beschriebene Leistung.';
  }
  return 'Freibleibendes Angebot. Die genannten Stunden sind eine Sch&auml;tzung; '
    + 'abgerechnet wird nach tats&auml;chlichem Aufwand, sofern nichts anderes vereinbart ist.';
}

function renderHtml(ang) {
  const a = ang.aussteller || {};
  const e = ang.empfaenger || {};
  const zeilen = positionsZeilen(ang.positionen, 'angebot');
  const stunden = ang.positionen.reduce((s, p) => s + (p.stunden || 0), 0);
  // Ein reines Pauschalangebot hat keinen Stundenaufwand. "0 Stunden" waere
  // dort keine Angabe, sondern eine falsche Behauptung.
  const hatStunden = ang.positionen.some((p) => p.typ !== 'pauschal');
  const hatPauschal = ang.positionen.some((p) => p.typ === 'pauschal');

  const steuerZeile = ang.kleinunternehmer
    ? '<p class="hinweis">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>'
    : `<tr><td colspan="3" class="r">zzgl. ${esc(String(ang.ust_prozent))} % Umsatzsteuer</td>
         <td class="r">${esc(eur(ang.ust_eur))}</td></tr>`;

  return `<!doctype html>
<meta charset="utf-8">
<title>Angebot ${esc(ang.nr)}</title>
<style>
  :root { --akzent: #ea580c; --tinte: #111; --grau: #666; --linie: #ddd; }
  * { box-sizing: border-box; }
  body { font: 13px/1.6 "Helvetica Neue", Arial, sans-serif; color: var(--tinte);
         max-width: 760px; margin: 40px auto; padding: 0 24px; background: #fff; }
  .kopf { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 40px; }
  .absender { font-size: 11px; color: var(--grau); margin-bottom: 24px; }
  .aussteller { text-align: right; font-size: 12px; color: var(--grau); }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h1 + .balken { width: 48px; height: 3px; background: var(--akzent); margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
       color: var(--grau); border-bottom: 1px solid var(--linie); padding: 6px 8px; }
  td { padding: 10px 8px; border-bottom: 1px solid var(--linie); vertical-align: top; }
  td.r, th.r { text-align: right; }
  .summe td { border-bottom: none; padding-top: 14px; }
  .gesamt td { font-weight: 700; font-size: 15px; border-top: 2px solid var(--akzent); }
  .klein { font-size: 11px; color: var(--grau); }
  .hinweis { font-size: 12px; background: #faf7f5; border-left: 3px solid var(--akzent);
             padding: 10px 14px; margin: 16px 0; }
  .fuss { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--linie);
          font-size: 11px; color: var(--grau); }
  @media print { body { margin: 0; max-width: none; } }
</style>

<div class="kopf">
  <div>
    <div class="absender">${esc(a.name)}, ${esc((a.anschrift || []).join(', '))}</div>
    <strong>${esc(e.name)}</strong><br>
    ${(e.anschrift || []).map(esc).join('<br>')}
  </div>
  <div class="aussteller">
    <strong>${esc(a.name)}</strong><br>
    ${(a.anschrift || []).map(esc).join('<br>')}<br>
    ${a.steuernummer ? 'Steuernummer: ' + esc(a.steuernummer) + '<br>' : ''}
    ${a.ustIdNr ? 'USt-IdNr.: ' + esc(a.ustIdNr) + '<br>' : ''}
  </div>
</div>

<h1>Angebot ${esc(ang.nr)}</h1>
<div class="balken"></div>
<p class="klein">
  Angebotsdatum: ${esc(datum(ang.erstellt_am))} &middot;
  G&uuml;ltig bis: ${esc(datum(ang.gueltig_bis))}
</p>

<table>
  <thead><tr><th>Leistung</th><th class="r">Stunden</th><th class="r">Satz</th><th class="r">Betrag</th></tr></thead>
  <tbody>${zeilen}</tbody>
  <tfoot>
    <tr class="summe"><td colspan="3" class="r">Nettobetrag</td><td class="r">${esc(eur(ang.netto_eur))}</td></tr>
    ${ang.kleinunternehmer ? '' : steuerZeile}
    <tr class="gesamt"><td colspan="3" class="r">Angebotssumme</td><td class="r">${esc(eur(ang.brutto_eur))}</td></tr>
  </tfoot>
</table>

${ang.kleinunternehmer ? steuerZeile : ''}

${hatStunden ? `<p class="klein">Kalkulierter Aufwand gesamt: ${esc(stunden.toLocaleString('de-DE', { maximumFractionDigits: 1 }))} Stunden.</p>` : ''}
${vergleichsHinweis(ang.positionen, 'angebot')}

<div class="fuss">
  <p>${fussText(hatStunden, hatPauschal)}</p>
</div>
`;
}

// PDF ueber denselben Druckweg wie die Rechnung (rechnung.druckePdf). Ohne
// Spalte in angebote: ein Angebot aendert sich (Wiederoeffnen verlaengert die
// Gueltigkeit), deshalb wird jedes Mal frisch gedruckt.
function erzeugePdf(db, nr, port) {
  if (!lade(db, nr)) return Promise.reject(new Error('Angebot nicht gefunden.'));
  const ziel = path.join(ANGEBOTS_DIR, `${nr}.pdf`);
  return rechnung.druckePdf(`http://127.0.0.1:${port}/angebot/${nr}`, ziel).then(() => ({ nr, pdf: ziel }));
}

// C11c (E4): Nachfassen, einmal, wenn `gueltig_bis` in hoechstens `tageVorAblauf` Tagen erreicht ist (nachholen,
// falls der Server aus war) und das Angebot noch gilt. Nur nach scharfem Versand; im Testmodus zaehlt auch Testversand (P1),
// und ein Test-Nachfassen sperrt dann.
// Laeuft es vor dem naechsten Werktag ab (Freitag: Ablauf Samstag/Sonntag), kommt es heute dran. Der Scan folgt der Versandzeit
// (Einstellungen -> Flows, Standard Mo-Fr); laeuft er auch am Wochenende, faellt das Nachfassen am Freitag nur frueher, nie zweimal.
function kandidaten(db, heute, { testmodus = false, tageVorAblauf = 3 } = {}) {
  const t = testmodus ? 1 : 0;
  const wt = new Date(heute + 'T00:00:00Z').getUTCDay();
  const bisNaechsterScan = wt === 5 ? 3 : wt === 6 ? 2 : 1;
  // Ein reines Datum ist ein Ortstag; new Date('JJJJ-MM-TT') laese UTC-Mitternacht und verschoebe ihn westlich von UTC.
  const tagVon = (s) => (String(s).length === 10 ? String(s) : rechnung.tagNach(s, 0));
  return db.prepare(`SELECT nr, gueltig_bis FROM angebote WHERE status = 'offen'
    AND EXISTS (SELECT 1 FROM versand WHERE art = 'angebot' AND bezug = angebote.nr AND status = 'ok' AND (test = 0 OR @t = 1))
    AND NOT EXISTS (SELECT 1 FROM versand WHERE art = 'nachfassen' AND bezug = angebote.nr AND status = 'ok' AND (test = 0 OR @t = 1))
    ORDER BY gueltig_bis, nr`).all({ t })
    .map((r) => ({ nr: r.nr, tage: rechnung.tageZwischen(heute, tagVon(r.gueltig_bis)) }))
    .filter((r) => r.tage >= 0 && (r.tage <= tageVorAblauf || r.tage < bisNaechsterScan));
}

module.exports = {
  kandidaten, erstelle, vorschau, lade, liste, setzeStatus, loesche, inRechnung, renderHtml, erzeugePdf };
