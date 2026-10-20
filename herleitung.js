'use strict';
// Herleitung "Wie entstanden?" (README §5.4, BACKEND §2.3, Masterplan C4).
// Legt den echten Rechenweg als Graph aus: Quellen -> Teilbetraege -> Ergebnis.
// Gerechnet wird hier nichts Neues: jeder Wert kommt aus rechnung.js
// (Positionen, Abschrift, liste) oder metrics.js (byTicket, mehrwert,
// kennzahlen). Kein Modell, kein cira.js — die Herleitung muss auch stimmen,
// wenn Cira gar nicht laeuft.
//
// Knoten: { col 0|1|2, k Art, v Wert als Text, sub Untertext, c Farbe
// (quelle|satz|teil|ergebnis|kosten|info), wert/e fuer Pruefungen }.
// Links: [a, b] als Indizes in knoten.
const metrics = require('./metrics');
const rechnung = require('./rechnung');
const zeit = require('./zeit');

const nf = (stellen) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
const eur = (v) => nf(2).format(Number(v) || 0) + ' €';
const std = (v) => nf(1).format(Number(v) || 0) + ' h';
const proz = (v) => nf(1).format(Number(v) || 0) + ' %';

// Hoechstens so viele Knoten je Spalte, sonst ueberlappen sie in der 260 px hohen Welt.
const MAX_TEILE = 4;

function nichtGefunden(text) { return Object.assign(new Error(text), { status: 404 }); }

function graph(titel, schritte, knoten, links) {
  return { titel, schritte, knoten, links };
}

/* ---------- Rechnung (gestellt oder Entwurf aus einer Freigabe) ---------- */
// Teilbetrag je Position; was ueber MAX_TEILE hinausgeht, steht als ein Knoten
// "weitere Positionen" mit der Summe ihrer Betraege — die Positionsbetraege
// selbst sind schon gerundet (rechnung.baueMitSperre), Netto ist ihre Summe.
// Kulanz (zeit.js) ist erfasste Zeit ohne Betrag: sie gehoert zur Zeiterfassung, nicht zu den freien Positionen.
const positionArt = (p) => (p.typ === 'zeit' || p.typ === 'kulanz' ? 'zeit' : p.typ === 'pauschal' && /lokaler KI-Modelle/.test(p.bezeichnung || '') ? 'lokal' : p.typ === 'pauschal' || !p.ticket ? 'frei' : 'claude');
// Stunden der Positionen zweistellig wie auf dem Beleg: "2,8 h × 72,25 €" liesse sich nicht nachrechnen.
const std2 = (v) => nf(2).format(Number(v) || 0) + ' h';
function teilText(p) {
  if (Number.isFinite(p.stunden) && Number.isFinite(p.satz)) return std2(p.stunden) + ' × ' + eur(p.satz);
  if (Number.isFinite(p.mio_tokens) && Number.isFinite(p.preis_je_mio)) return nf(3).format(p.mio_tokens) + ' Mio × ' + eur(p.preis_je_mio);
  return 'Festpreis';
}
function teilName(p) {
  if (p.typ === 'zeit' || p.typ === 'kulanz') return String(p.bezeichnung || 'Zeiterfassung').slice(0, 60);
  if (p.typ === 'pauschal') return String(p.bezeichnung || 'Position').slice(0, 60);
  return (p.ohne_vorgangsnummer ? 'Projekt ' : '') + p.ticket;
}
function rechnungsGraph(titel, d) {
  const pos = Array.isArray(d.positionen) ? d.positionen : [];
  const knoten = [];
  const links = [];
  // Spalte 0: woher die Mengen kommen, je Art einmal.
  const QUELLE = {
    claude: { k: 'Claude-Sitzungen', sub: 'Aktivzeit aus den Logs' },
    zeit: { k: 'Zeiterfassung', sub: 'manuelle Einträge' },
    lokal: { k: 'Lokale Modelle', sub: 'Tokens über den Modell-Proxy' },
    frei: { k: 'Freie Positionen', sub: 'von Hand im Beleg' },
  };
  const quelleIdx = {};
  for (const p of pos) {
    const a = positionArt(p);
    if (quelleIdx[a] != null) continue;
    const gleiche = pos.filter((x) => positionArt(x) === a);
    const h = gleiche.every((x) => Number.isFinite(x.stunden)) ? gleiche.reduce((s, x) => s + x.stunden, 0) : null;
    quelleIdx[a] = knoten.push({ col: 0, k: QUELLE[a].k, v: h != null ? std2(h) :gleiche.length + (gleiche.length === 1 ? ' Position' : ' Positionen'), sub: QUELLE[a].sub, c: 'quelle' }) - 1;
  }
  // Der Satz kommt aus Kontakt/Projekt bzw. Taetigkeit; er gilt fuer alle Stundenpositionen.
  const saetze = [...new Set(pos.filter((p) => Number.isFinite(p.satz) && Number.isFinite(p.stunden)).map((p) => p.satz))];
  const satzIdx = saetze.length ? knoten.push({ col: 0, k: 'Stundensatz', v: saetze.length === 1 ? eur(saetze[0]) + '/h' : saetze.length + ' Sätze',
    sub: saetze.length === 1 ? 'aus Kontakt, Projekt oder Tätigkeit' : saetze.map(eur).join(', '), c: 'satz' }) - 1 : null;

  // Spalte 1: je Position der Betrag.
  const gezeigt = pos.slice(0, pos.length > MAX_TEILE ? MAX_TEILE - 1 : MAX_TEILE);
  const rest = pos.slice(gezeigt.length);
  const teilIdx = [];
  for (const p of gezeigt) {
    const i = knoten.push({ col: 1, k: teilName(p), v: teilText(p), sub: '= ' + eur(p.betrag_eur), c: 'teil', wert: Number(p.betrag_eur) || 0, e: 'eur' }) - 1;
    teilIdx.push(i);
    links.push([quelleIdx[positionArt(p)], i]);
    if (satzIdx != null && Number.isFinite(p.satz) && Number.isFinite(p.stunden)) links.push([satzIdx, i]);
  }
  if (rest.length) {
    const summe = rechnung.rund2(rest.reduce((s, p) => s + (Number(p.betrag_eur) || 0), 0));
    const i = knoten.push({ col: 1, k: rest.length + ' weitere Positionen', v: eur(summe), sub: [...new Set(rest.map(teilName))].slice(0, 3).join(', '), c: 'teil', wert: summe, e: 'eur' }) - 1;
    teilIdx.push(i);
    for (const a of [...new Set(rest.map(positionArt))]) links.push([quelleIdx[a], i]);
  }

  // Spalte 2: der Beleg.
  const steuer = d.kleinunternehmer ? 'ohne USt (§ 19 UStG)' : '+ ' + nf(0).format(d.ust_prozent) + ' % USt ' + eur(d.ust_eur) + ' = ' + eur(d.brutto_eur);
  const erg = knoten.push({ col: 2, k: 'Rechnung', v: eur(d.netto_eur) + ' netto', sub: steuer, c: 'ergebnis', wert: d.netto_eur, brutto: d.brutto_eur, e: 'eur' }) - 1;
  for (const i of teilIdx) links.push([i, erg]);
  return graph(titel, ['Quellen einsammeln', 'Menge × Satz je Position', 'Beleg zusammensetzen'], knoten, links);
}

function herleitungRechnung(db, id) {
  // "F12" = Entwurf aus Freigabe 12, sonst eine gestellte Rechnungsnummer.
  const f = /^F(\d{1,9})$/.exec(id);
  if (f) {
    const z = db.prepare('SELECT art, bezug, nutzlast_json, status, ergebnis_json FROM freigabe WHERE id = ?').get(Number(f[1]));
    if (!z || z.art !== 'rechnung') throw nichtGefunden('Rechnungsentwurf unbekannt.');
    // Schon freigegeben: dann zeigt die Herleitung die gestellte Rechnung, nicht einen neuen Entwurf.
    let erg = null;
    try { erg = JSON.parse(z.ergebnis_json || 'null'); } catch { erg = null; }
    if (z.status === 'erledigt' && erg && typeof erg.nr === 'string') return herleitungRechnung(db, erg.nr);
    if (z.status !== 'offen') throw nichtGefunden('Rechnungsentwurf ist nicht mehr offen (' + z.status + ').');
    let n;
    try { n = JSON.parse(z.nutzlast_json); } catch { n = null; }
    if (!n || typeof n !== 'object') throw nichtGefunden('Rechnungsentwurf ohne lesbare Nutzlast.');
    // Neu aufgebaut wie beim Freigeben: zeigt, was jetzt gestellt wuerde.
    let v;
    try { v = rechnung.vorschau(db, n); } catch (err) {
      // Fachlich (z. B. inzwischen gestellt): der Entwurf ist veraltet, kein Programmfehler.
      throw Object.assign(new Error('Der Entwurf lässt sich nicht mehr aufbauen: ' + err.message + ' Neuen Entwurf anfordern.'), { status: 409 });
    }
    // Weicht der Betrag vom Entwurf ab, scheitert das Freigeben (409) — das muss hier sichtbar sein.
    const anders = typeof n.erwartetBrutto === 'number' && Math.abs(v.brutto_eur - n.erwartetBrutto) > 0.004;
    const g = rechnungsGraph('Rechnungsentwurf ' + (z.bezug || '') + ' · ' + eur(v.netto_eur) + ' netto' + (anders ? ' · Betrag seit dem Entwurf geändert (war ' + eur(n.erwartetBrutto) + ' brutto)' : ''), v);
    if (anders) g.veraltet = { war: n.erwartetBrutto, jetzt: v.brutto_eur };
    return g;
  }
  // Gestellt: die Abschrift, nie nachgerechnet (§ 14 UStG).
  const inv = rechnung.lade(db, id);
  if (!inv) throw nichtGefunden('Rechnung nicht gefunden.');
  return rechnungsGraph('Rechnung ' + inv.nr + ' · ' + eur(inv.netto_eur) + ' netto', inv);
}

/* ---------- Marge: aus metrics.mehrwert ---------- */
// w ist die Ausgabe von metrics.mehrwert(); hier wird nur angeordnet.
function margeGraph(titel, w) {
  const knoten = [];
  const links = [];
  const erl = knoten.push({ col: 0, k: 'Erlös', v: eur(w.erloes), sub: w.erloes_ist_rechnung ? 'gestellte Rechnungen' : 'Arbeitswert, noch ohne Rechnung', c: 'quelle', wert: w.erloes, e: 'eur' }) - 1;
  const abo = knoten.push({ col: 0, k: 'Abo-Anteil', v: eur(w.eigene_kosten), sub: 'Sachkosten Claude', c: 'kosten', wert: w.eigene_kosten, e: 'eur' }) - 1;
  const lok = w.lokal_kosten > 0 ? knoten.push({ col: 0, k: 'Lokale Rechenzeit', v: eur(w.lokal_kosten), sub: std(w.lokal_stunden) + ' Strom und Abschreibung', c: 'kosten', wert: w.lokal_kosten, e: 'eur' }) - 1 : null;
  const zeitQ = knoten.push({ col: 0, k: 'Eigene Zeit', v: std2(w.eigene_stunden) + ' × ' + eur(w.selbstkosten_stunde), sub: w.selbstkosten_stunde > 0 ? 'Selbstkostensatz' : 'kein Selbstkostensatz', c: 'kosten', wert: w.eigene_stunden, e: 'h' }) - 1;

  const db = knoten.push({ col: 1, k: 'Deckungsbeitrag', v: w.deckungsbeitrag == null ? '—' : eur(w.deckungsbeitrag),
    sub: w.deckungsbeitrag == null ? 'kein Erlös' : 'Erlös − Sachkosten · ' + proz(w.deckungsbeitrag_prozent), c: 'teil', wert: w.deckungsbeitrag, e: 'eur' }) - 1;
  const zk = knoten.push({ col: 1, k: 'Zeitkosten', v: w.zeitkosten == null ? '—' : eur(w.zeitkosten), sub: w.zeitkosten == null ? 'Selbstkostensatz fehlt' : 'eigene Stunden × Satz', c: 'kosten', wert: w.zeitkosten, e: 'eur' }) - 1;
  links.push([erl, db], [abo, db], [zeitQ, zk]);
  if (lok != null) links.push([lok, db]);

  const ziel = w.zielmarge_prozent != null && w.zielmarge_abweichung != null
    ? 'Ziel ' + proz(w.zielmarge_prozent) + ' · ' + (w.zielmarge_abweichung >= 0 ? '+' : '') + nf(1).format(w.zielmarge_abweichung) + ' Punkte' : 'nach Sachkosten und eigener Zeit';
  const erg = knoten.push({ col: 2, k: 'Marge — nach Sachkosten und eigener Zeit', v: w.marge_prozent == null ? 'keine Marge' : proz(w.marge_prozent),
    sub: w.marge == null ? (w.erloes > 0 ? 'Selbstkostensatz fehlt' : 'kein Erlös') : eur(w.marge) + ' · ' + ziel, c: w.marge != null && w.marge < 0 ? 'kosten' : 'ergebnis', wert: w.marge_prozent, e: 'proz' }) - 1;
  links.push([db, erg], [zk, erg]);
  return graph(titel, ['Erlös und Kosten einsammeln', 'Deckungsbeitrag und Zeitkosten', 'Marge daraus'], knoten, links);
}

// Zeitraum als "JJJJ-MM-TT_JJJJ-MM-TT", sonst ein Vorgangsschluessel.
const ZEITRAUM_RE = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/;
function vorgangZeile(db, id) {
  const row = metrics.byTicket(db, { ticket: id })[0];
  if (!row) throw nichtGefunden('Vorgang nicht gefunden.');
  return row;
}
function herleitungMarge(db, id) {
  const z = ZEITRAUM_RE.exec(id);
  if (z) {
    if (!rechnung.istTag(z[1]) || !rechnung.istTag(z[2]) || z[1] > z[2]) throw Object.assign(new Error('Zeitraum ungültig.'), { status: 400 });
    const o = { from: z[1], to: z[2] };
    // Dieselbe Rechnung wie die Kennzahlen in Finanzen und Cira (kennzahlenFakten).
    const k = metrics.kennzahlen(metrics.byTicket(db, o).concat(metrics.ohneTicket(db, o)), rechnung.abrechnung(db), zeit.kennzahlenZusatz(db, o));
    return margeGraph('Marge ' + z[1] + ' bis ' + z[2] + ' · ' + (k.wert.marge_prozent == null ? 'keine Marge' : proz(k.wert.marge_prozent)), k.wert);
  }
  const row = vorgangZeile(db, id);
  // Wie /api/ticket: Erloes aus den gestellten Rechnungen des Vorgangs.
  const w = metrics.mehrwert(row, rechnung.abgerechnetFuerVorgang(db, id));
  return margeGraph('Marge ' + row.ticket + ' · ' + (w.marge_prozent == null ? 'keine Marge' : proz(w.marge_prozent)), w);
}

/* ---------- Arbeitswert eines Vorgangs ---------- */
function herleitungArbeitswert(db, id) {
  const r = vorgangZeile(db, id);
  const knoten = [];
  const links = [];
  const cz = knoten.push({ col: 0, k: 'Claude-Sitzungen', v: std2(r.active_hours), sub: (r.sessions || 0) + ' Sitzungen · ' + (r.zeitmodell || 'Aktivzeit'), c: 'quelle', wert: r.active_hours, e: 'h' }) - 1;
  const satz = knoten.push({ col: 0, k: 'Stundensatz', v: eur(r.stundensatz) + '/h', sub: r.rabatt_prozent ? 'Basis ' + eur(r.stundensatz_standard) + ' − ' + nf(0).format(r.rabatt_prozent) + ' % Rabatt' : 'aus ' + (r.satz_quelle || 'Kontakt oder Projekt'), c: 'satz', wert: r.stundensatz, e: 'eur' }) - 1;
  const mz = r.manuell_hours > 0 || r.arbeitswert_manuell > 0
    ? knoten.push({ col: 0, k: 'Zeiterfassung', v: std2(r.manuell_hours), sub: (r.manuell_eintraege || 0) + ' Einträge, Satz je Tätigkeit', c: 'quelle', wert: r.manuell_hours, e: 'h' }) - 1 : null;
  const tc = knoten.push({ col: 1, k: 'Claude-Anteil', v: eur(r.arbeitswert_claude), sub: std2(r.active_hours) + ' × ' + eur(r.stundensatz), c: 'teil', wert: r.arbeitswert_claude, e: 'eur' }) - 1;
  links.push([cz, tc], [satz, tc]);
  const teile = [tc];
  if (mz != null) {
    const tm = knoten.push({ col: 1, k: 'Manuelle Zeit', v: eur(r.arbeitswert_manuell), sub: std2(r.manuell_hours) + ' erfasst', c: 'teil', wert: r.arbeitswert_manuell, e: 'eur' }) - 1;
    links.push([mz, tm]);
    teile.push(tm);
  }
  const erg = knoten.push({ col: 2, k: 'Arbeitswert', v: eur(r.arbeitswert), sub: 'eigene Zeit zum Stundensatz · ' + r.first_day + ' bis ' + r.last_day, c: 'ergebnis', wert: r.arbeitswert, e: 'eur' }) - 1;
  for (const t of teile) links.push([t, erg]);
  return graph('Arbeitswert ' + r.ticket + ' · ' + eur(r.arbeitswert), ['Zeit einsammeln', 'Stunden × Satz', 'Arbeitswert daraus'], knoten, links);
}

/* ---------- Offene Posten ---------- */
function herleitungOffenePosten(db) {
  const offen = rechnung.liste(db).filter((r) => r.status === 'erstellt' && r.rest_eur > 0)
    .sort((a, b) => (b.ueberfaellig_tage || 0) - (a.ueberfaellig_tage || 0));
  const knoten = [];
  const links = [];
  const gezeigt = offen.slice(0, offen.length > MAX_TEILE ? MAX_TEILE - 1 : MAX_TEILE);
  const rest = offen.slice(gezeigt.length);
  const teile = [];
  for (const r of gezeigt) {
    const q = knoten.push({ col: 0, k: r.nr, v: eur(r.brutto_eur), sub: r.empfaenger + ' · brutto', c: 'quelle', wert: r.brutto_eur, e: 'eur' }) - 1;
    const t = knoten.push({ col: 1, k: r.nr + ' offen', v: eur(r.rest_eur), sub: r.ueberfaellig_tage > 0 ? r.ueberfaellig_tage + ' Tage über Ziel' : 'fällig ' + r.faellig_am, c: r.ueberfaellig_tage > 0 ? 'kosten' : 'teil', wert: r.rest_eur, e: 'eur' }) - 1;
    links.push([q, t]);
    teile.push(t);
  }
  if (rest.length) {
    const q = knoten.push({ col: 0, k: rest.length + ' weitere Rechnungen', v: eur(rechnung.rund2(rest.reduce((s, r) => s + r.brutto_eur, 0))), sub: 'brutto', c: 'quelle' }) - 1;
    const summe = rechnung.rund2(rest.reduce((s, r) => s + r.rest_eur, 0));
    const t = knoten.push({ col: 1, k: 'davon offen', v: eur(summe), sub: rest.map((r) => r.nr).slice(0, 3).join(', '), c: 'teil', wert: summe, e: 'eur' }) - 1;
    links.push([q, t]);
    teile.push(t);
  }
  const gesamt = rechnung.rund2(offen.reduce((s, r) => s + r.rest_eur, 0));
  const ueber = offen.filter((r) => r.ueberfaellig_tage > 0);
  const erg = knoten.push({ col: 2, k: 'Offene Posten', v: eur(gesamt), sub: offen.length ? offen.length + ' Rechnungen · ' + ueber.length + ' überfällig' : 'nichts offen', c: ueber.length ? 'kosten' : 'ergebnis', wert: gesamt, e: 'eur' }) - 1;
  for (const t of teile) links.push([t, erg]);
  return graph('Offene Posten · ' + eur(gesamt), ['Gestellte Rechnungen', 'Rest nach Zahlungen', 'Summe der Reste'], knoten, links);
}

const ARTEN = {
  rechnung: (db, id) => herleitungRechnung(db, id),
  marge: (db, id) => herleitungMarge(db, id),
  arbeitswert: (db, id) => herleitungArbeitswert(db, id),
  'offene-posten': (db) => herleitungOffenePosten(db),
};

function herleitung(db, art, id) {
  if (!Object.hasOwn(ARTEN, art)) throw Object.assign(new Error('Art: ' + Object.keys(ARTEN).join(', ') + '.'), { status: 400 });
  const s = typeof id === 'string' ? id.trim() : '';
  if (art !== 'offene-posten' && (!s || s.length > 80)) throw Object.assign(new Error('Id fehlt.'), { status: 400 });
  return ARTEN[art](db, s);
}

module.exports = { herleitung, ARTEN };
