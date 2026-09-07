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
const config = require('./config.json');
const metrics = require('./metrics');
const rechnung = require('./rechnung');
const kontakte = require('./kontakte');

const { rund2, steuer, esc, positionsZeilen, vergleichsHinweis, eur, datum } = rechnung;

const NUMMER_RE = /^AN-\d{4}-\d{4}$/;
const GUELTIG_TAGE_STANDARD = 30;

function naechsteNummer(db, jahr) {
  const row = db.prepare(
    'SELECT COALESCE(MAX(laufnr), 0) + 1 AS n FROM angebote WHERE jahr = ?'
  ).get(jahr);
  return { laufnr: row.n, nr: `AN-${jahr}-${String(row.n).padStart(4, '0')}` };
}

// Positionen aus freier Eingabe. Die Grenzen sind bewusst eng: ein Angebot
// geht nach aussen, ein Tippfehler in der Stundenzahl faellt erst auf, wenn
// der Kunde zusagt.
function freiePosition(p, vFaktor) {
  // Nur Zeichenketten: ein Objekt wuerde sonst als "[object Object]" auf dem
  // Dokument landen, ein Array stillschweigend zusammengefuegt.
  if (!p || typeof p.bezeichnung !== 'string') {
    throw new Error('Jede Position braucht eine Bezeichnung als Text.');
  }
  const bezeichnung = p.bezeichnung.trim();
  if (!bezeichnung) throw new Error('Jede Position braucht eine Bezeichnung.');
  if (bezeichnung.length > 200) throw new Error('Bezeichnung: hoechstens 200 Zeichen.');

  // Pauschalposition: ein Festpreis fuer die beschriebene Leistung, ohne
  // Stunden. Die Grenze liegt enger als Stunden x Satz es zuliesse — ein
  // vertippter Festpreis geht ungeprueft nach aussen.
  if (p.typ === 'pauschal') {
    const betrag = Number(p.betrag_eur);
    if (!Number.isFinite(betrag) || betrag <= 0 || betrag > 1000000) {
      throw new Error(`"${bezeichnung}": Festpreis muss zwischen 0 und 1000000 liegen.`);
    }
    return {
      bezeichnung,
      typ: 'pauschal',
      stunden: null,
      satz: null,
      basissatz: null,
      rabatt_prozent: 0,
      betrag_eur: rund2(betrag),
      vergleich_stunden: null,
      vergleich_faktor: null,
    };
  }

  const stunden = Number(p.stunden);
  if (!Number.isFinite(stunden) || stunden <= 0 || stunden > 10000) {
    throw new Error(`"${bezeichnung}": Stunden muessen zwischen 0 und 10000 liegen.`);
  }
  const satz = p.satz === undefined || p.satz === '' ? config.stundensatz : Number(p.satz);
  if (!Number.isFinite(satz) || satz < 0 || satz > 10000) {
    throw new Error(`"${bezeichnung}": Stundensatz muss zwischen 0 und 10000 liegen.`);
  }

  return {
    bezeichnung,
    stunden: rund2(stunden),
    satz: rund2(satz),
    basissatz: rund2(satz),
    rabatt_prozent: 0,
    betrag_eur: rund2(stunden * satz),
    // Auch im Angebot nur Zeit, nie ein Vergleichsbetrag — siehe die
    // Begruendung in metrics.mehrwert().
    vergleich_stunden: vFaktor > 1 ? rund2(stunden * vFaktor) : null,
    vergleich_faktor: vFaktor > 1 ? vFaktor : null,
  };
}

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
    basissatz: rund2(t.stundensatz_standard),
    rabatt_prozent: t.rabatt_prozent || 0,
    satz: rund2(t.stundensatz),
    betrag_eur: rund2(t.arbeitswert),
    vergleich_stunden: vFaktor > 1 ? rund2(t.active_hours * vFaktor) : null,
    vergleich_faktor: vFaktor > 1 ? vFaktor : null,
  }));
}

function erstelle(db, { posten, from, to, tickets, empfaenger, gueltigTage, kontaktId } = {}) {
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
    positionen.push(...vorgangsPositionen(db, { from, to, tickets }, vFaktor));
  }
  if (positionen.length === 0) throw new Error('Das Angebot enthaelt keine Position.');

  const tage = Number(gueltigTage) > 0 ? Math.min(Number(gueltigTage), 365) : GUELTIG_TAGE_STANDARD;
  const jetzt = new Date();
  const gueltig = new Date(jetzt);
  gueltig.setDate(gueltig.getDate() + tage);

  const netto = rund2(positionen.reduce((s, p) => s + p.betrag_eur, 0));
  const { klein, satz, ust, brutto } = steuer(netto);

  const jahr = jetzt.getFullYear();
  const { nr, laufnr } = naechsteNummer(db, jahr);

  db.prepare(`
    INSERT INTO angebote (nr, jahr, laufnr, erstellt_am, gueltig_bis,
      empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur,
      brutto_eur, kleinunternehmer, status, kontakt_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'offen',?)
  `).run(
    nr, jahr, laufnr, jetzt.toISOString(), gueltig.toISOString(),
    JSON.stringify(empf), JSON.stringify(rechnung.stammdaten()),
    JSON.stringify(positionen), netto, satz, ust, brutto, klein ? 1 : 0, kid
  );

  return lade(db, nr);
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
    SELECT nr, erstellt_am, gueltig_bis, empfaenger, brutto_eur, status, rechnung_nr
    FROM angebote ORDER BY jahr DESC, laufnr DESC
  `).all().map((r) => ({
    nr: r.nr,
    erstellt_am: r.erstellt_am,
    gueltig_bis: r.gueltig_bis,
    empfaenger: (JSON.parse(r.empfaenger) || {}).name || '',
    brutto_eur: r.brutto_eur,
    // Abgelaufen wird abgeleitet, nicht gespeichert: sonst muesste jemand
    // taeglich einen Auftrag laufen lassen, damit der Status stimmt.
    status: r.status === 'offen' && r.gueltig_bis < heute ? 'abgelaufen' : r.status,
    rechnung_nr: r.rechnung_nr,
  }));
}

function setzeStatus(db, nr, status) {
  if (!['offen', 'angenommen', 'abgelehnt'].includes(status)) {
    throw new Error('Unbekannter Status.');
  }
  const a = lade(db, nr);
  if (!a) throw new Error('Angebot nicht gefunden.');
  if (a.rechnung_nr) throw new Error('Zu diesem Angebot gibt es bereits eine Rechnung.');
  db.prepare('UPDATE angebote SET status = ? WHERE nr = ?').run(status, nr);
  // Wer zusagt, ist kein Lead mehr. Laeuft ins Leere, wenn kein Kontakt
  // verknuepft oder er inzwischen geloescht ist — eine Annahme darf daran
  // nicht scheitern.
  if (status === 'angenommen') kontakte.macheKunde(db, a.kontakt_id);
  return lade(db, nr);
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

  const inv = rechnung.ausPositionen(db, {
    positionen: a.positionen,
    empfaenger: a.empfaenger,
    von: a.erstellt_am.slice(0, 10),
    bis: new Date().toISOString().slice(0, 10),
    kontaktId: a.kontakt_id,
  });
  db.prepare("UPDATE angebote SET rechnung_nr = ?, status = 'angenommen' WHERE nr = ?").run(inv.nr, nr);
  kontakte.macheKunde(db, a.kontakt_id);
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

module.exports = { erstelle, lade, liste, setzeStatus, loesche, inRechnung, renderHtml };
