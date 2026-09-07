'use strict';
// Rechnungsstellung aus den Ledger-Zahlen.
//
// Der wichtigste Grundsatz steht in der Tabellendefinition und wird hier
// eingeloest: eine gestellte Rechnung wird NIE neu berechnet. Beim Erstellen
// werden Positionen, Stammdaten und Betraege als Abschrift in die Zeile
// geschrieben; die Druckansicht liest ausschliesslich diese Abschrift. Sonst
// aenderte ein spaeter korrigierter Stundensatz rueckwirkend ein Dokument,
// das bereits beim Kunden liegt.
const fs = require('node:fs');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');

const config = require('./config.json');
const metrics = require('./metrics');
const kontakte = require('./kontakte');

const RECHNUNGS_DIR = path.join(__dirname, 'data', 'rechnungen');

function stammdaten() {
  return (config.rechnung && config.rechnung.aussteller) || {};
}

// Fail-fast wie beim Wechselkurs: eine Rechnung ohne Pflichtangaben ist
// steuerlich unwirksam. Lieber hier abbrechen als ein unbrauchbares Dokument
// erzeugen, das erst der Steuerberater bemaengelt.
// Was fehlt, ohne zu werfen. Der Einstellungen-Tab braucht die Liste, um beim
// Speichern von Teileingaben anzeigen zu koennen, was noch aussteht — dort
// waere ein Abbruch falsch, beim Erstellen einer Rechnung dagegen richtig.
function fehlendeStammdaten() {
  const a = stammdaten();
  const fehlt = [];
  if (!a.name) fehlt.push('rechnung.aussteller.name');
  if (!Array.isArray(a.anschrift) || a.anschrift.length === 0) fehlt.push('rechnung.aussteller.anschrift');
  if (!a.steuernummer && !a.ustIdNr) fehlt.push('rechnung.aussteller.steuernummer oder ustIdNr');
  return fehlt;
}

function pruefeStammdaten() {
  const fehlt = fehlendeStammdaten();
  if (fehlt.length) {
    throw new Error(
      'Rechnungs-Stammdaten unvollstaendig, Par. 14 UStG verlangt sie: ' + fehlt.join(', ') +
      '. Bitte in den Einstellungen ergaenzen.'
    );
  }
}

function rund2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// --- Nummernkreis ------------------------------------------------------------
// Fortlaufend und einmalig, je Jahr eine eigene Reihe. Der Zaehler ergibt sich
// aus dem Bestand, nicht aus einem gemerkten Stand: so entsteht auch nach einem
// Absturz keine doppelte Nummer. UNIQUE(jahr, laufnr) ist das Netz darunter.
function naechsteNummer(db, jahr) {
  const row = db.prepare('SELECT COALESCE(MAX(laufnr), 0) + 1 AS n FROM invoices WHERE jahr = ?').get(jahr);
  const laufnr = row.n;
  return { laufnr, nr: `${jahr}-${String(laufnr).padStart(4, '0')}` };
}

// --- Erstellen ---------------------------------------------------------------
// projekte: Vorgaenge ohne Vorgangsnummer, ueber den Projektnamen gewaehlt.
// Bewusst ein eigener Parameter neben tickets: wuerde ein Projektname in
// tickets stehen, liefe er ungeprueft als Vorgangsnummer auf ein Dokument
// nach § 14 UStG und in den Jira-Abgleich.
function erstelle(db, { from, to, tickets, projekte, empfaenger, kontaktId } = {}) {
  pruefeStammdaten();
  const tListe = Array.isArray(tickets) ? tickets : [];
  const pListe = Array.isArray(projekte) ? projekte : [];
  if (tListe.length === 0 && pListe.length === 0) {
    throw new Error('Keine Vorgaenge gewaehlt.');
  }
  if (!empfaenger || !empfaenger.name) {
    throw new Error('Empfaenger fehlt (Name ist Pflicht).');
  }
  kontakte.ohneErsatzzeichen(empfaenger.name, 'Empfaenger');
  if (!from || !to) throw new Error('Leistungszeitraum fehlt.');

  const gewaehlt = new Set(tListe);
  const gewaehltP = new Set(pListe);
  const zeilen = [
    ...(tListe.length
      ? metrics.byTicket(db, { from, to }).filter((t) => gewaehlt.has(t.ticket))
      : []),
    ...(pListe.length
      ? metrics.ohneTicket(db, { from, to }).filter((t) => gewaehltP.has(t.gruppe))
      : []),
  ];
  if (zeilen.length === 0) {
    throw new Error('Zu den gewaehlten Vorgaengen gibt es im Zeitraum keine Daten.');
  }

  // Vergleichsaufwand ohne KI, nur als Zeit. Muss mit in die Abschrift: die
  // Druckansicht rechnet nichts nach, sonst stuende auf einer alten Rechnung
  // ploetzlich ein anderer Wert, sobald der Faktor geaendert wird.
  // Bewusst keine Euro-Entsprechung — Begruendung in metrics.mehrwert().
  const vFaktor = Number(config.vergleichsFaktor) || 0;

  const positionen = zeilen.map((t) => ({
    // Ticketlose Zeilen tragen keinen Vorgangsschluessel. Auf dem Dokument
    // steht dann der Projektname als Leistungsbezeichnung — kein erfundener
    // Schluessel, der nach einer Vorgangsnummer aussieht.
    ticket: t.ticket || t.gruppe,
    ohne_vorgangsnummer: t.ticket ? undefined : true,
    von: t.first_day,
    bis: t.last_day,
    stunden: Math.round(t.active_hours * 100) / 100,
    basissatz: rund2(t.stundensatz_standard),
    rabatt_prozent: t.rabatt_prozent || 0,
    satz: rund2(t.stundensatz),
    betrag_eur: rund2(t.arbeitswert),
    // Nur zur Information auf der Rechnung, keine Berechnungsgrundlage.
    tokens_gesamt: t.gesamt_tokens,
    vergleich_stunden: vFaktor > 1 ? Math.round(t.active_hours * vFaktor * 100) / 100 : null,
    vergleich_faktor: vFaktor > 1 ? vFaktor : null,
  }));

  // Nutzung lokaler Modelle als eigene Position. Getrennt von der Zeit, weil
  // es eine andere Leistung ist: nicht Arbeitszeit, sondern Rechenleistung auf
  // eigener Hardware. Als Pauschalposition, denn Stunden gibt es dafuer nicht.
  //
  // Der Betrag stammt aus metrics und wird hier NICHT nachgerechnet — der
  // Rabatt steckt bereits darin (derselbe wie beim Stundensatz). Wer ihn hier
  // noch einmal anwendete, zoege ihn zweimal ab.
  for (const t of zeilen) {
    const betrag = rund2(t.lokal_betrag_eur || 0);
    if (!(betrag > 0)) continue;
    const mio = (t.lokal_tokens || 0) / 1e6;
    positionen.push({
      ticket: t.ticket || t.gruppe,
      ohne_vorgangsnummer: t.ticket ? undefined : true,
      typ: 'pauschal',
      bezeichnung: `Nutzung lokaler KI-Modelle Vorgang ${t.ticket || t.gruppe}`,
      von: t.first_day,
      bis: t.last_day,
      mio_tokens: Math.round(mio * 1000) / 1000,
      preis_je_mio: rund2(t.lokal_eur_pro_mio || 0),
      rabatt_prozent: t.rabatt_prozent || 0,
      betrag_eur: betrag,
    });
  }

  // Summiert wird ueber die gerundeten Positionen, nicht ueber die
  // ungerundeten Ausgangswerte: sonst weicht die ausgewiesene Summe um Cents
  // von den addierten Zeilen ab, und genau das faellt beim Pruefen auf.
  const netto = rund2(positionen.reduce((s, p) => s + p.betrag_eur, 0));
  const { klein, satz, ust, brutto } = steuer(netto);

  const jahr = new Date().getFullYear();
  const { nr, laufnr } = naechsteNummer(db, jahr);

  db.prepare(`
    INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis,
      empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur,
      brutto_eur, kleinunternehmer, status, kontakt_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'erstellt',?)
  `).run(
    nr, jahr, laufnr, new Date().toISOString(), from, to,
    JSON.stringify(empfaenger), JSON.stringify(stammdaten()),
    JSON.stringify(positionen), netto, satz, ust, brutto, klein ? 1 : 0,
    Number.isInteger(kontaktId) && kontaktId > 0 ? kontaktId : null
  );

  return lade(db, nr);
}

// Rechnung aus fertigen Positionen. Wird gebraucht, wenn die Positionen nicht
// aus der Auswertung stammen, sondern schon feststehen — etwa bei der
// Uebernahme eines Angebots. Der Weg ueber byTicket() ginge dort fehl: die
// zugesagten Stunden sind eine Schaetzung und muessen so bleiben, auch wenn
// inzwischen mehr oder weniger Zeit gemessen wurde.
function ausPositionen(db, { positionen, empfaenger, von, bis, kontaktId } = {}) {
  pruefeStammdaten();
  if (!Array.isArray(positionen) || positionen.length === 0) {
    throw new Error('Keine Positionen uebergeben.');
  }
  if (!empfaenger || !empfaenger.name) throw new Error('Empfaenger fehlt (Name ist Pflicht).');
  if (!von || !bis) throw new Error('Leistungszeitraum fehlt.');

  const netto = rund2(positionen.reduce((s, p) => s + (Number(p.betrag_eur) || 0), 0));
  const { klein, satz, ust, brutto } = steuer(netto);
  const jahr = new Date().getFullYear();
  const { nr, laufnr } = naechsteNummer(db, jahr);

  db.prepare(`
    INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis,
      empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur,
      brutto_eur, kleinunternehmer, status, kontakt_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'erstellt',?)
  `).run(
    nr, jahr, laufnr, new Date().toISOString(), von, bis,
    JSON.stringify(empfaenger), JSON.stringify(stammdaten()),
    JSON.stringify(positionen), netto, satz, ust, brutto, klein ? 1 : 0,
    // Nur der Verweis; der Empfaenger oben bleibt die massgebliche Abschrift.
    Number.isInteger(kontaktId) && kontaktId > 0 ? kontaktId : null
  );

  return lade(db, nr);
}

// Jede Rechnungsnummer, die von aussen hereinkommt, laeuft hier durch. Der
// Wert landet spaeter in einem Dateipfad und in einer URL — die Form wird
// deshalb geprueft, bevor irgendetwas damit gebaut wird, und nicht erst
// darauf vertraut, dass die Datenbank schon nichts Unpassendes hergibt.
const NUMMER_RE = /^\d{4}-\d{4}$/;

function lade(db, nr) {
  if (!NUMMER_RE.test(String(nr || ''))) return null;
  const row = db.prepare('SELECT * FROM invoices WHERE nr = ?').get(nr);
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
  return db.prepare(`
    SELECT nr, erstellt_am, empfaenger, brutto_eur, status, pdf_pfad
    FROM invoices ORDER BY jahr DESC, laufnr DESC
  `).all().map((r) => ({
    nr: r.nr,
    erstellt_am: r.erstellt_am,
    empfaenger: (JSON.parse(r.empfaenger) || {}).name || '',
    brutto_eur: r.brutto_eur,
    status: r.status,
    hat_pdf: !!r.pdf_pfad,
  }));
}

// --- Abrechnungsstand --------------------------------------------------------
// Welcher Vorgang steckt in welcher gestellten Rechnung, und mit welchem Betrag.
// Nur status='erstellt' zaehlt: ein storniertes Original steht auf 'storniert',
// seine Gegenrechnung auf 'storno' — beide fallen damit heraus, ohne dass die
// negativen Betraege gegeneinander verrechnet werden muessen.
function abrechnung(db) {
  const rows = db.prepare(`
    SELECT nr, positionen FROM invoices
    WHERE status = 'erstellt' ORDER BY jahr, laufnr
  `).all();

  // Ohne Prototyp: ein Vorgang namens "__proto__" waere sonst kein Schluessel,
  // sondern wuerde beim Lesen das Prototyp-Objekt liefern.
  const map = Object.create(null);
  for (const r of rows) {
    for (const p of JSON.parse(r.positionen) || []) {
      if (!p || !p.ticket) continue;
      const e = map[p.ticket] || (map[p.ticket] = { betrag_eur: 0, nummern: [] });
      e.betrag_eur = rund2(e.betrag_eur + (Number(p.betrag_eur) || 0));
      if (!e.nummern.includes(r.nr)) e.nummern.push(r.nr);
    }
  }
  return map;
}

// --- Storno ------------------------------------------------------------------
// Loeschen gibt es nicht: eine ausgegebene Nummer bleibt vergeben, sonst
// entsteht eine Luecke in der fortlaufenden Reihe. Die Korrektur ist eine
// eigene Rechnung mit negativen Betraegen.
function storniere(db, nr) {
  const original = lade(db, nr);
  if (!original) throw new Error('Rechnung nicht gefunden.');
  if (original.status !== 'erstellt') {
    throw new Error(`Rechnung ${nr} ist bereits ${original.status}.`);
  }

  const jahr = new Date().getFullYear();
  const { nr: stornoNr, laufnr } = naechsteNummer(db, jahr);
  const positionen = original.positionen.map((p) => ({ ...p, betrag_eur: -p.betrag_eur }));

  db.prepare(`
    INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis,
      empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur,
      brutto_eur, kleinunternehmer, status, storno_von)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'storno',?)
  `).run(
    stornoNr, jahr, laufnr, new Date().toISOString(),
    original.leistung_von, original.leistung_bis,
    JSON.stringify(original.empfaenger), JSON.stringify(original.aussteller),
    JSON.stringify(positionen), -original.netto_eur, original.ust_prozent,
    -original.ust_eur, -original.brutto_eur, original.kleinunternehmer ? 1 : 0, nr
  );
  db.prepare("UPDATE invoices SET status = 'storniert' WHERE nr = ?").run(nr);

  return lade(db, stornoNr);
}

// --- Druckansicht ------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function eur(n) {
  return (Number(n) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + ' EUR';
}

function datum(iso) {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '';
}

// Steuer aus dem Nettobetrag. Eine Stelle fuer Rechnung und Angebot — zwei
// Formeln waeren die sicherste Art, dass beide Dokumente eines Tages
// verschiedene Betraege fuer dieselbe Leistung ausweisen.
function steuer(netto) {
  const klein = !!(config.rechnung && config.rechnung.kleinunternehmer);
  const satz = klein ? 0 : Number(config.rechnung.ustSatz) || 0;
  const ust = rund2(netto * satz / 100);
  return { klein, satz, ust, brutto: rund2(netto + ust) };
}

// Positionszeilen der Leistungstabelle. Die Vergleichsangabe steht bewusst
// beim Leistungstext und nicht neben dem Betrag: ein hypothetischer Wert
// direkt neben einem echten Preis liest sich als Streichpreis.
function positionsZeilen(positionen, dokument) {
  const std = (n) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' h';
  // Im Angebot ist nichts erfasst, sondern kalkuliert — das Wort muss zum
  // Dokument passen, sonst behauptet ein Angebot gemessene Zeiten.
  const eigen = dokument === 'angebot' ? 'kalkuliert' : 'erfasst';
  const vergleichText = (p) => (p.vergleich_stunden && typeof p.stunden === 'number'
    ? `${eigen} ${esc(std(p.stunden))}, klassische Entwicklung gesch&auml;tzt ${esc(std(p.vergleich_stunden))}`
    : '');
  return positionen.map((p) => {
    // Eine Pauschalposition hat keine Stunden. Die Pruefung geht bewusst ueber
    // den Typ hinaus: eine Abschrift ohne Stundenzahl darf die Druckansicht
    // niemals zum Absturz bringen, sonst haengt auch die PDF-Erzeugung.
    const pauschal = p.typ === 'pauschal' || typeof p.stunden !== 'number';
    // Teile der Unterzeile zusammensetzen und erst dann verbinden: sonst steht
    // ein Trennzeichen am Anfang, wenn der Zeitraum fehlt (freie Posten).
    const teile = [];
    if (p.von) teile.push(esc(p.von) + ' bis ' + esc(p.bis));
    if (p.rabatt_prozent > 0) {
      teile.push(`${esc(eur(p.basissatz))}/h abzgl. ${esc(String(p.rabatt_prozent))} % Rabatt`);
    }
    const v = vergleichText(p);
    if (v) teile.push(v);
    return `
      <tr>
        <td>
          ${esc(p.bezeichnung || ('Entwicklungsleistung Vorgang ' + p.ticket))}<br>
          <span class="klein">${teile.join(' &middot; ')}</span>
        </td>
        <td class="r">${pauschal ? 'pauschal' : esc(p.stunden.toLocaleString('de-DE', { minimumFractionDigits: 2 }))}</td>
        <td class="r">${pauschal ? '&ndash;' : esc(eur(p.satz))}</td>
        <td class="r">${esc(eur(p.betrag_eur))}</td>
      </tr>`;
  }).join('');
}

// Einordnung der Vergleichsangabe. Erscheint nur, wenn ueberhaupt eine
// vorkommt — ein Hinweis auf etwas Unsichtbares verwirrt mehr, als er nuetzt.
function vergleichsHinweis(positionen, dokument) {
  if (!positionen.some((p) => p.vergleich_stunden)) return '';
  return `<p class="klein">Die Angabe zur klassischen Entwicklung ist eine rechnerische Sch&auml;tzung auf Basis
  eines pauschalen Faktors, keine Preiszusage und kein Alternativangebot. Unabh&auml;ngige Untersuchungen
  zur Produktivit&auml;t mit KI-Werkzeugen kommen zu stark abweichenden Ergebnissen. Berechnungsgrundlage
  ${dokument === 'angebot' ? 'dieses Angebots' : 'dieser Rechnung'} ist ausschlie&szlig;lich die
  ${dokument === 'angebot' ? 'kalkulierte' : 'tats&auml;chlich erfasste'} Arbeitszeit.</p>`;
}

function renderHtml(inv) {
  const a = inv.aussteller || {};
  const e = inv.empfaenger || {};
  const tokens = inv.positionen.reduce((s, p) => s + (p.tokens_gesamt || 0), 0);
  const faellig = new Date(inv.erstellt_am);
  faellig.setDate(faellig.getDate() + (Number(config.rechnung.zahlungszielTage) || 14));

  const zeilen = positionsZeilen(inv.positionen, 'rechnung');
  const hinweisVergleich = vergleichsHinweis(inv.positionen, 'rechnung');

  const steuerZeile = inv.kleinunternehmer
    ? '<p class="hinweis">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>'
    : `<tr><td colspan="3" class="r">zzgl. ${esc(String(inv.ust_prozent))} % Umsatzsteuer</td>
         <td class="r">${esc(eur(inv.ust_eur))}</td></tr>`;

  return `<!doctype html>
<meta charset="utf-8">
<title>Rechnung ${esc(inv.nr)}</title>
<style>
  /* Bewusst hell: das Dokument wird gedruckt und liegt beim Kunden. Der dunkle
     Dashboard-Grund waere hier falsch — Drucker unterdruecken Flaechen, und
     Toner kostet. Vom Farbschema traegt nur der Akzent nach aussen. */
  :root { --akzent: #ea580c; --tinte: #111; --grau: #666; --linie: #ddd; }
  body { font: 14px/1.5 "Segoe UI", system-ui, sans-serif; color: var(--tinte);
         max-width: 20cm; margin: 2cm auto; padding: 0 1cm; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: -.01em; }
  /* Der Akzent sitzt auf der Kopfkante, nicht im Text: eine Rechnung wird
     gelesen, nicht ueberflogen — Farbe markiert das Dokument, nicht Inhalte. */
  h1::after { content: ""; display: block; width: 44px; height: 3px;
              background: var(--akzent); margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th, td { padding: 8px 6px; border-bottom: 1px solid var(--linie); text-align: left;
           vertical-align: top; }
  th { border-bottom: 2px solid var(--akzent); font-size: 12px; text-transform: uppercase;
       letter-spacing: .05em; color: var(--tinte); }
  .r { text-align: right; white-space: nowrap;
       font-variant-numeric: tabular-nums; }
  .klein { color: var(--grau); font-size: 12px; }
  .kopf { display: flex; justify-content: space-between; gap: 32px; }
  .summe td { border-bottom: none; padding-top: 4px; }
  .gesamt td { border-top: 2px solid var(--akzent); font-weight: 600; font-size: 15px; }
  .hinweis { background: #faf6f2; border-left: 3px solid var(--akzent);
             padding: 10px 12px; }
  .fuss { margin-top: 32px; font-size: 12px; color: #444;
          border-top: 1px solid var(--linie); padding-top: 14px; }
  .storno { color: #b91c1c; font-weight: 600; }
  /* Farbe muss der Druck nicht wiedergeben; ohne exact wirft der Treiber die
     Flaechen raus und der Hinweiskasten steht ohne Abgrenzung da. */
  @media print {
    body { margin: 0; max-width: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
<div class="kopf">
  <div>
    <div class="klein">${esc(a.name)}, ${esc((a.anschrift || []).join(', '))}</div>
    <p><strong>${esc(e.name)}</strong><br>${(e.anschrift || []).map(esc).join('<br>')}</p>
  </div>
  <div class="klein">
    <strong>${esc(a.name)}</strong><br>
    ${(a.anschrift || []).map(esc).join('<br>')}<br>
    ${a.steuernummer ? 'Steuernummer: ' + esc(a.steuernummer) + '<br>' : ''}
    ${a.ustIdNr ? 'USt-IdNr.: ' + esc(a.ustIdNr) + '<br>' : ''}
  </div>
</div>

<h1>${inv.status === 'storno' ? 'Stornorechnung' : 'Rechnung'} ${esc(inv.nr)}</h1>
${inv.status === 'storno' ? `<p class="storno">Storno zu Rechnung ${esc(inv.storno_von)}</p>` : ''}
${inv.status === 'storniert' ? '<p class="storno">Diese Rechnung wurde storniert.</p>' : ''}
<p class="klein">
  Rechnungsdatum: ${esc(datum(inv.erstellt_am))} &middot;
  Leistungszeitraum: ${esc(inv.leistung_von)} bis ${esc(inv.leistung_bis)}
</p>

<table>
  <thead><tr><th>Leistung</th><th class="r">Stunden</th><th class="r">Satz</th><th class="r">Betrag</th></tr></thead>
  <tbody>${zeilen}</tbody>
  <tfoot>
    <tr class="summe"><td colspan="3" class="r">Nettobetrag</td><td class="r">${esc(eur(inv.netto_eur))}</td></tr>
    ${inv.kleinunternehmer ? '' : steuerZeile}
    <tr class="gesamt"><td colspan="3" class="r">Rechnungsbetrag</td><td class="r">${esc(eur(inv.brutto_eur))}</td></tr>
  </tfoot>
</table>

${inv.kleinunternehmer ? steuerZeile : ''}

<p class="klein">Token-Verbrauch gesamt: ${esc(tokens.toLocaleString('de-DE'))} (informativ, nicht Bestandteil der Berechnung)</p>
${hinweisVergleich}

<div class="fuss">
  <p>Zahlbar ohne Abzug bis ${esc(faellig.toLocaleDateString('de-DE'))}.</p>
  ${a.iban ? `<p>${esc(a.bank)}<br>IBAN: ${esc(a.iban)}${a.bic ? ' &middot; BIC: ' + esc(a.bic) : ''}</p>` : ''}
</div>
`;
}

// --- PDF ---------------------------------------------------------------------
// Chrome bringt den Druck nach PDF selbst mit. Das spart eine Abhaengigkeit,
// verlangt aber, den Browser zu finden.
function findeChrome() {
  const kandidaten = [];
  if (config.rechnung && config.rechnung.chromePfad) kandidaten.push(config.rechnung.chromePfad);

  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const lokal = process.env['LOCALAPPDATA'] || '';
  kandidaten.push(
    path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
    lokal && path.join(lokal, 'Google\\Chrome\\Application\\chrome.exe'),
  );

  try {
    const aus = execFileSync('reg', [
      'query', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve',
    ], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const m = aus.match(/REG_SZ\s+(.+\.exe)/i);
    if (m) kandidaten.push(m[1].trim());
  } catch { /* Registry-Eintrag fehlt: naechster Kandidat */ }

  // Edge ist auf Windows 11 immer da und versteht dieselben Schalter.
  kandidaten.push(
    path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
  );

  for (const k of kandidaten) {
    if (k && fs.existsSync(k)) return k;
  }
  throw new Error(
    'Weder Chrome noch Edge gefunden. Pfad zur Programmdatei in ' +
    'config.json unter rechnung.chromePfad eintragen.'
  );
}

// Bewusst asynchron: der Browser holt die Druckansicht bei genau diesem
// Server ab. Ein blockierender Aufruf wuerde die Antwort verhindern, auf die
// er wartet — der Prozess bliebe stehen, bis das Zeitlimit greift.
function erzeugePdf(db, nr, port) {
  const inv = lade(db, nr);
  if (!inv) return Promise.reject(new Error('Rechnung nicht gefunden.'));

  const browser = findeChrome();
  fs.mkdirSync(RECHNUNGS_DIR, { recursive: true });
  const ziel = path.join(RECHNUNGS_DIR, `${nr}.pdf`);

  return new Promise((ok, fehler) => {
    execFile(browser, [
      '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
      `--print-to-pdf=${ziel}`,
      `http://127.0.0.1:${port}/rechnung/${nr}`,
    ], { timeout: 30000, windowsHide: true }, (err) => {
      // Vollstaendig ins Protokoll, nach aussen nur ein Hinweis: die Meldung
      // des Browsers enthaelt Dateipfade und geht ueber die Schnittstelle raus.
      if (err) {
        console.error('PDF-Erzeugung fehlgeschlagen fuer', nr, err);
        return fehler(new Error('PDF-Erzeugung fehlgeschlagen, Details im Serverprotokoll.'));
      }
      if (!fs.existsSync(ziel)) return fehler(new Error('PDF wurde nicht geschrieben.'));
      db.prepare('UPDATE invoices SET pdf_pfad = ? WHERE nr = ?').run(ziel, nr);
      ok({ nr, pdf: ziel });
    });
  });
}

module.exports = {
  erstelle, ausPositionen, lade, liste, abrechnung, storniere, renderHtml, erzeugePdf, esc,
  stammdaten, fehlendeStammdaten, pruefeStammdaten,
  // Fuer das Angebotsmodul: dieselbe Steuerlogik, dieselbe Rundung, dasselbe
  // Dokumentgeruest. Ein zweiter Satz Formeln waere die sicherste Art, dass
  // Angebot und Rechnung eines Tages auseinanderlaufen.
  rund2, steuer, positionsZeilen, vergleichsHinweis, eur, datum,
};
