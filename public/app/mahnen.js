'use strict';
/* Mahnwesen (C11b): Mahnstufe in den Rechnungslisten und der Dialog "Mahnen".
   Gerechnet und geprueft wird auf dem Server (mahnung.js): der Dialog zeigt,
   was /api/mahnung/vorschau liefert, und gibt Fehlertexte (409: "Betrag hat sich
   geaendert", "Frist abgelaufen", "Versand laeuft bereits") unveraendert wieder.
   Eine Stufe zaehlt erst, wenn die Mahnung gesendet oder als per Post versendet
   markiert ist. Empfaengerfeld und Sperrlogik teilen sich die Bausteine mit dem
   E-Mail-Dialog (versand.js: vs, vsAnZeichnen, vsKnopf). */

Object.assign(EN, {
  'Mahnen': 'Dun', 'Mahnen …': 'Dun …', 'Mahnstufe': 'Dunning level', 'mit Mahnstufe': 'with dunning level',
  'Zahlungserinnerung': 'Payment reminder', '1. Mahnung': '1st dunning letter', '2. Mahnung': '2nd dunning letter',
  '{t} zu Rechnung {nr}': '{t} for invoice {nr}', 'Bisher': 'So far', 'noch nichts gesendet': 'nothing sent yet',
  'Post': 'post', '{s} {d} ({k})': '{s} {d} ({k})',
  'Erinnerung {d}': 'Reminder {d}', '1. Mahnung {d}': '1st dunning {d}', '2. Mahnung {d}': '2nd dunning {d}', 'ausgeschöpft': 'exhausted', 'Pause bis {d}': 'Paused until {d}',
  'regulär ab {d} — du mahnst früher': 'regular from {d} — you are dunning early',
  'Offener Betrag': 'Open amount', 'Mahngebühr': 'Dunning fee', 'Zu zahlen bis {d}': 'Payable by {d}',
  'Nur erzeugen': 'Create only', 'PDF ansehen': 'View PDF', 'Als versendet markieren (Post)': 'Mark as sent (post)',
  'Mahnung erzeugt. Sie zählt erst, wenn sie gesendet oder als per Post versendet markiert ist.': 'Letter created. It only counts once it is sent or marked as sent by post.',
  'Die Stufe zählt erst, wenn die Mahnung gesendet oder als per Post versendet markiert ist. Ein Versand im Testmodus zählt nie. Die Mahngebühr steht nur auf dem Mahnschreiben, nicht auf der Rechnung.':
    'The level only counts once the letter is sent or marked as sent by post. A send in test mode never counts. The dunning fee appears only on the letter, not on the invoice.',
  'Die Rechnung ist bezahlt — nichts zu mahnen.': 'The invoice is paid — nothing to dun.', 'Die Rechnung ist storniert.': 'The invoice is cancelled.',
  'Die Rechnung ist noch nicht fällig.': 'The invoice is not due yet.',
  'Mahnpause bis {d} — vorher gehen weder Erinnerung noch Mahnung raus.': 'Dunning paused until {d} — no reminder or dunning letter goes out before then.',
  'Mahnstufen ausgeschöpft — es gibt keine weitere Stufe.': 'Dunning levels exhausted — there is no further level.',
  'Mahnung nicht geladen': 'Dunning not loaded', 'Keine Angaben zur Rechnung': 'No data for this invoice', 'Keine Mahnung möglich.': 'No dunning possible.',
  'Für Post die Mahnung neu erzeugen — diese Zeile kann schon zugestellt sein.': 'For post, create the letter again — this row may already have been delivered.', 'Mahnung nicht erzeugt': 'Letter not created', 'Mahnung nicht gesendet': 'Letter not sent',
  'Mahnung gesendet an {a}': 'Dunning letter sent to {a}', 'Test gesendet an {a} (statt {o}) — zählt nicht als Stufe': 'Test sent to {a} (instead of {o}) — does not count as a level',
  'Als per Post versendet markiert': 'Marked as sent by post', 'Nicht markiert': 'Not marked',
  'Keine Antwort vom Server — die Mahnung ist vielleicht raus. Bitte die Rechnung prüfen, bevor du erneut sendest.': 'No answer from the server — the letter may have gone out. Check the invoice before sending again.',
  'PDF nicht erstellt': 'PDF not created', 'Mahnstufe nicht geladen': 'Dunning level not loaded',
  'Erinnerung unklar': 'Reminder unclear', '1. Mahnung unklar': '1st dunning unclear', '2. Mahnung unklar': '2nd dunning unclear',
  'Zustellung unklar — das Schreiben ist vielleicht beim Kunden. Diese Stufe bleibt gesperrt, bis du unter Gesendet geprüft hast, ob es angekommen ist.':
    'Delivery unclear — the letter may have reached the customer. This level stays locked until you have checked under Sent whether it arrived.',
  'Kam an': 'Arrived', 'Kam nicht an': 'Did not arrive', 'Unter Gesendet im Mailkonto geprüft?': 'Checked under Sent in the mail account?',
  'Ja, geprüft': 'Yes, checked', 'Zurück': 'Back', 'Mahnung geklärt': 'Letter resolved', 'Nicht geklärt': 'Not resolved',
  '„Kam an“ zählt die Stufe als gesendet, ab dem Tag des Versuchs. „Kam nicht an“ gibt die Stufe frei; die Mahnung lässt sich dann erneut senden oder neu erzeugen. Beides lässt sich nicht zurücknehmen.':
    '“Arrived” counts the level as sent, from the day of the attempt. “Did not arrive” releases the level; the letter can then be sent again or created anew. Neither can be undone.',
});

/* ---------- Stand in den Listen ---------- */
const mzStand = { d: {}, stand: undefined, laedt: false, fehler: false };
function ladeMahnStand() {
  if (mzStand.laedt || mzStand.stand === state.belegeStand) return;
  const nrs = (state.rechnungen || []).filter((r) => r.status === 'erstellt' && r.rest_eur > 0).map((r) => r.nr);
  mzStand.stand = state.belegeStand;
  if (!nrs.length) { mzStand.d = {}; return; }
  mzStand.laedt = true;
  // ponytail: alle Nummern in einer Abfrage (Server nimmt bis 1000); bei mehr Rechnungen seitenweise holen.
  hole('/api/mahnung/stand?nr=' + encodeURIComponent(nrs.join(','))).then((d) => { mzStand.d = (d && d.stand) || {}; mzStand.fehler = false; }, (e) => {
    console.error('/api/mahnung/stand:', e.message);
    mzStand.stand = undefined;   // naechstes Zeichnen versucht es neu
    mzStand.d = {};              // kein veralteter Stand mit "Mahnen" stehen lassen
    if (!mzStand.fehler) toast(uebersetze('Mahnstufe nicht geladen') + ': ' + e.message, 'warn');
    mzStand.fehler = true;
  }).then(() => { mzStand.laedt = false; if (!mzStand.fehler && route().name === 'rechnungen') zeichneAnsicht(); });
}

const MZ_KURZ = { 1: 'Erinnerung {d}', 2: '1. Mahnung {d}', 3: '2. Mahnung {d}' };
const MZ_UNKLAR = { 1: 'Erinnerung unklar', 2: '1. Mahnung unklar', 3: '2. Mahnung unklar' };
// "Erinnerung 12.10.", "1. Mahnung 26.10. (Post)", "ausgeschöpft", "Pause bis 05.11.", sonst "—" (mahnbar, noch nichts raus).
function mahnText(nr) {
  const s = mzStand.d[nr];
  if (!s) return '';
  const z = s.zuletzt;
  const stufe = z ? fuelle(MZ_KURZ[z.stufe], { d: datumKurz(z.gesendet_am) }) + (z.kanal === 'post' ? ' (' + uebersetze('Post') + ')' : '') : '';
  if (s.grund === 'pause') return fuelle('Pause bis {d}', { d: datumKurz(s.pause_bis) });
  if (s.grund === 'ausgeschoepft') return uebersetze('ausgeschöpft');
  if (s.grund === 'unklar') return uebersetze(MZ_UNKLAR[s.unklar_stufe] || 'Erinnerung unklar');
  if (z) return stufe;
  return s.naechste ? '—' : '';
}
const mahnbar = (nr) => !!(mzStand.d[nr] && mzStand.d[nr].naechste);
function mahnMarke(nr) {
  const t = mahnText(nr);
  return t ? '<span class="s mahn" title="' + esc(uebersetze('Mahnstufe')) + '">' + esc(t) + '</span>' : '';
}

/* ---------- Dialog ---------- */
const mn = { klaer: null, lauf: 0, nr: null, v: null, m: null, betreff: '', text: '', alle: [], liste: [], verworfen: new Set(), umleitenAn: '', bereit: false, busy: false };
const MZ_TITEL = { 1: 'Zahlungserinnerung', 2: '1. Mahnung', 3: '2. Mahnung' };
const MZ_GRUND = {
  bezahlt: 'Die Rechnung ist bezahlt — nichts zu mahnen.', storniert: 'Die Rechnung ist storniert.', nicht_faellig: 'Die Rechnung ist noch nicht fällig.',
  ausgeschoepft: 'Mahnstufen ausgeschöpft — es gibt keine weitere Stufe.',
  unklar: 'Zustellung unklar — das Schreiben ist vielleicht beim Kunden. Diese Stufe bleibt gesperrt, bis du unter Gesendet geprüft hast, ob es angekommen ist.',
};

function mnKopf(titel, nr) {
  return '<div class="dialog-kopf"><div><h2>' + esc(titel) + '</h2><span class="hinweis mono">' + esc(uebersetze('Rechnung') + ' ' + nr) + '</span></div>' +
    '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>';
}
const mnFehler = (grund, text) => { const f = grund.querySelector('#vs-fehler'); if (f) f.textContent = text; };

// Vorschau holen (wirft bei Fehler) und den jüngsten unverworfenen Entwurf der Stufe wieder aufnehmen (R7).
async function mnVorschau() {
  const v = await sende('/api/mahnung/vorschau', { nr: mn.nr });
  mn.v = v; mn.betreff = v.betreff; mn.text = v.text;
  mn.bereit = !!(v.bereit && v.bereit.bereit);
  // liste kommt neueste zuerst; verworfen = der Server hat den Entwurf als veraltet gemeldet.
  mn.m = mn.alle.find((x) => x.status === 'erzeugt' && x.stufe === v.stufe && !mn.verworfen.has(x.id)) || null;
  Object.assign(vs, { an: (v.an || []).slice(0, 5), pdfOk: true, unklar: !mn.bereit, umleitenAn: mn.umleitenAn, schluessel: crypto.randomUUID() });
}

async function oeffneMahnen(nr) {
  if (!nr) return;
  const lauf = ++mn.lauf;
  Object.assign(mn, { nr, v: null, m: null, betreff: '', text: '', alle: [], liste: [], verworfen: new Set(), umleitenAn: '', bereit: false });
  const grund = dialog(mnKopf(uebersetze('Mahnen'), nr) + '<div id="vs-inhalt" class="vs-inhalt"><div class="leer">' + esc(uebersetze('Lädt …')) + '</div></div>', 'Mahnen', 560);
  const aktuell = () => lauf === mn.lauf && grund.isConnected;
  const inhalt = () => grund.querySelector('#vs-inhalt');
  const fehlerZeigen = (e) => { inhalt().innerHTML = '<p class="dialog-fehler" role="alert"></p>'; inhalt().firstChild.textContent = uebersetze('Mahnung nicht geladen') + ': ' + ((e && e.message) || 'Fehler'); };
  let st, liste;
  try {
    [st, liste] = await Promise.all([hole('/api/mahnung/stand?nr=' + encodeURIComponent(nr)), hole('/api/mahnung/liste?nr=' + encodeURIComponent(nr))]);
  } catch (e) { if (aktuell()) fehlerZeigen(e); return; }
  if (!aktuell()) return;
  const s = st.stand && st.stand[nr];
  if (!s) { fehlerZeigen(new Error(uebersetze('Keine Angaben zur Rechnung'))); return; }
  mn.alle = liste.liste || [];
  mn.liste = mn.alle.filter((x) => x.status === 'gesendet').sort((a, b) => a.stufe - b.stufe);
  // Kein Formular, wenn der Server keine Stufe vorsieht: der Grund steht im Klartext.
  if (s.grund) {
    inhalt().innerHTML = '<p class="dialog-text" id="mn-grund"></p>' + mnBisher() +
      '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Schließen')) + '</button></div>';
    const u = s.grund === 'unklar' ? mn.alle.find((x) => x.unklar && x.stufe === s.unklar_stufe) : null;
    if (u) mnKlaerBlock(inhalt(), u.id);
    inhalt().querySelector('#mn-grund').textContent = s.grund === 'pause' ? fuelle('Mahnpause bis {d} — vorher gehen weder Erinnerung noch Mahnung raus.', { d: datum(s.pause_bis) })
      : uebersetze(MZ_GRUND[s.grund] || 'Keine Mahnung möglich.');
    return;
  }
  try { await mnVorschau(); } catch (e) { if (aktuell()) fehlerZeigen(e); return; }
  if (!aktuell()) return;
  if (mn.bereit && mn.v.bereit.umgeleitet) {
    try { mn.umleitenAn = (await hole('/api/mail/einstellungen')).werte.umleitenAn || ''; } catch (e) { console.error('/api/mail/einstellungen:', e.message); /* Band zeigt dann nur den Hinweis ohne Adresse */ }
    if (!aktuell()) return;
    vs.umleitenAn = mn.umleitenAn;
  }
  mnZeichne(grund);
  grund.addEventListener('keydown', (ev) => {
    if (ev.target.id === 'vs-an-neu' && (ev.key === 'Enter' || ev.key === ',' || ev.key === ';')) { ev.preventDefault(); vsAnUebernehmen(true); }
    else if (ev.target.id === 'vs-an-neu' && ev.key === 'Backspace' && !ev.target.value && vs.an.length) { vs.an.pop(); vsAnZeichnen(); vsFokusAn(); }
    else if (ev.target.id === 'vs-betreff' && ev.key === 'Enter') ev.preventDefault();
  });
  grund.addEventListener('focusout', (ev) => { if (ev.target.id === 'vs-an-neu') setTimeout(() => { const n = document.getElementById('vs-an-neu'); if (n && n.value.trim()) vsAnUebernehmen(); }, 0); });
}

// P6: zwei Knöpfe "Kam an" / "Kam nicht an", jeder mit Rückfrage; der Server prüft, dass die Zeile wirklich unklar ist.
function mnKlaerBlock(inhalt, id) {
  mn.klaer = null;
  const feld = document.createElement('div');
  feld.id = 'mn-klaeren';
  inhalt.querySelector('#mn-grund').after(feld);
  const zeichne = () => {
    feld.innerHTML = (mn.klaer
      ? '<p class="dialog-text" role="alert">' + esc(uebersetze('Unter Gesendet im Mailkonto geprüft?')) + '</p><div class="dialog-fuss">' +
        '<button type="button" class="knopf" data-aktion="mn-klaer-zurueck">' + esc(uebersetze('Zurück')) + '</button>' +
        '<button type="button" class="knopf primaer" data-aktion="mn-klaeren" data-wert="' + esc(id) + '">' + esc(uebersetze('Ja, geprüft')) + '</button></div>'
      : '<div class="dialog-fuss">' +
        '<button type="button" class="knopf" data-aktion="mn-klaer-frage" data-wert="nicht_gesendet">' + esc(uebersetze('Kam nicht an')) + '</button>' +
        '<button type="button" class="knopf" data-aktion="mn-klaer-frage" data-wert="gesendet">' + esc(uebersetze('Kam an')) + '</button></div>' +
        infoI('mahnen-klaeren') + infoText('mahnen-klaeren', '„Kam an“ zählt die Stufe als gesendet, ab dem Tag des Versuchs. „Kam nicht an“ gibt die Stufe frei; die Mahnung lässt sich dann erneut senden oder neu erzeugen. Beides lässt sich nicht zurücknehmen.')) +
      '<p class="dialog-fehler" id="vs-fehler" role="alert"></p>';
  };
  mn.klaerZeichne = zeichne;
  zeichne();
}
aktion('mn-klaer-frage', (wert) => { mn.klaer = wert; if (mn.klaerZeichne) mn.klaerZeichne(); });
aktion('mn-klaer-zurueck', () => { mn.klaer = null; if (mn.klaerZeichne) mn.klaerZeichne(); });
aktion('mn-klaeren', (wert) => mnLauf(async () => {
  const g = document.getElementById('dialog');
  if (!g || !mn.klaer) return;
  const { lauf, nr } = mn, ergebnis = mn.klaer;
  try { await sende('/api/mahnung/klaeren', { id: Number(wert), ergebnis }); } catch (e) {
    if (g.isConnected && lauf === mn.lauf) { mn.klaer = null; mn.klaerZeichne(); mnFehler(g, uebersetze('Nicht geklärt') + ': ' + e.message); }
    return;
  }
  mnFertig(lauf, g, uebersetze('Mahnung geklärt'), 'ok');
}));

// Gesendete Stufen; extra haengt etwas an die Zeile (das "i").
function mnBisher(extra) {
  const t = mn.liste.length ? mn.liste.map((x) => fuelle('{s} {d} ({k})', { s: uebersetze(MZ_TITEL[x.stufe]), d: datumKurz(x.gesendet_am), k: uebersetze(x.kanal === 'post' ? 'Post' : 'E-Mail') })).join(' · ')
    : uebersetze('noch nichts gesendet');
  return '<p class="hinweis">' + esc(uebersetze('Bisher') + ': ' + t) + (extra ? ' ' + extra : '') + '</p>';
}

// Formular (vor dem Erzeugen) oder Ergebnis (danach); die Felder der erzeugten Mahnung sind fest.
// Alle Zahlen und die Fruehwarnung (frueh) kommen vom Server; hier wird nichts gerechnet oder verglichen.
function mnZeichne(grund) {
  const v = mn.v, m = mn.m;
  const titel = fuelle('{t} zu Rechnung {nr}', { t: uebersetze(MZ_TITEL[v.stufe]), nr: mn.nr });
  grund.querySelector('.dialog-kopf h2').textContent = titel;
  const q = m || v;
  const senden = '<button type="button" class="knopf primaer" id="vs-senden" data-aktion="mn-senden"' + (mn.bereit ? '' : ' disabled') + '>' + esc(uebersetze('Senden')) + '</button>';
  // Post nur für eine erzeugte Zeile: nach einem Fehlversand kann sie schon zugestellt sein, der Server lehnt Post dann ab.
  const fuss = m
    ? '<a class="knopf" href="/mahnung/' + m.id + '" target="_blank" rel="noopener">' + esc(uebersetze('PDF ansehen')) + '</a>' +
      (m.status === 'erzeugt' ? '<button type="button" class="knopf" data-aktion="mn-post">' + esc(uebersetze('Als versendet markieren (Post)')) + '</button>' : '') + senden
    : '<button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
      '<button type="button" class="knopf" data-aktion="mn-erzeugen">' + esc(uebersetze('Nur erzeugen')) + '</button>' + senden;
  grund.querySelector('#vs-inhalt').innerHTML =
    (mn.bereit && mn.v.bereit.umgeleitet ? '<div class="banner" role="status" id="vs-test"></div>' : '') +
    mnBisher(infoI('mahnen-stufe')) + infoText('mahnen-stufe', 'Die Stufe zählt erst, wenn die Mahnung gesendet oder als per Post versendet markiert ist. Ein Versand im Testmodus zählt nie. Die Mahngebühr steht nur auf dem Mahnschreiben, nicht auf der Rechnung.') +
    (v.frueh ? '<p class="hinweis warn" id="mn-frueh"></p>' : '') +
    (m ? '<p class="hinweis" role="status">' + esc(uebersetze('Mahnung erzeugt. Sie zählt erst, wenn sie gesendet oder als per Post versendet markiert ist.')) + '</p>' : '') +
    (m && m.status === 'fehler' && !m.unklar ? '<p class="hinweis warn">' + esc(uebersetze('Für Post die Mahnung neu erzeugen — diese Zeile kann schon zugestellt sein.')) + '</p>' : '') +
    (m && m.warnung ? '<p class="hinweis warn" id="mn-warnung"></p>' : '') +
    (mn.bereit ? '<div class="feld"><label class="label" for="vs-an-neu">' + esc(uebersetze('An')) + '</label><div class="vs-an" id="vs-an"></div></div>' : '') +
    '<label class="feld"><span class="label">' + esc(uebersetze('Betreff')) + '</span><input id="vs-betreff" maxlength="200" autocomplete="off" value="' + esc(m ? m.betreff : mn.betreff) + '"' + (m ? ' readonly' : '') + '></label>' +
    '<label class="feld"><span class="label">' + esc(uebersetze('Nachricht')) + '</span><textarea class="eingabe" id="vs-text" rows="8" maxlength="4000"' + (m ? ' readonly' : '') + '>' + esc(m ? m.text : mn.text) + '</textarea></label>' +
    '<div class="mn-aufstellung"><span>' + esc(uebersetze('Offener Betrag')) + '</span><span class="mono">' + esc(eur(q.offen_eur)) + '</span>' +
      (q.gebuehr_eur > 0 ? '<span>' + esc(uebersetze('Mahngebühr')) + '</span><span class="mono">' + esc(eur(q.gebuehr_eur)) + '</span>' : '') +
      '<span class="gesamt">' + esc(fuelle('Zu zahlen bis {d}', { d: datum(q.frist) })) + '</span><span class="mono gesamt">' + esc(eur(q.gesamt_eur)) + '</span></div>' +
    (mn.bereit ? '' : '<p class="dialog-text">' + esc(uebersetze('Kein Versandkonto eingerichtet.')) + ' <button type="button" class="textknopf akzent" data-aktion="vs-einrichten">' + esc(uebersetze('Versand einrichten')) + '</button></p>') +
    '<p class="hinweis warn" id="vs-sperre"></p><p class="dialog-fehler" id="vs-fehler" role="alert"></p>' +
    '<div class="dialog-fuss">' + fuss + '</div>';
  if (mn.bereit && mn.v.bereit.umgeleitet) grund.querySelector('#vs-test').textContent = fuelle('Testmodus: geht an {a}', { a: mn.umleitenAn });
  if (v.frueh) grund.querySelector('#mn-frueh').textContent = fuelle('regulär ab {d} — du mahnst früher', { d: datum(v.faellig_ab) });
  if (m && m.warnung) grund.querySelector('#mn-warnung').textContent = uebersetze('PDF nicht erstellt') + ': ' + m.warnung;
  if (mn.bereit) vsAnZeichnen();
  const ziel = grund.querySelector('#vs-an-neu') || grund.querySelector('#vs-senden');
  if (ziel && !ziel.disabled) ziel.focus();
}

// Ein Lauf zur Zeit: waehrend er geht, sind alle Knoepfe im Fuss gesperrt und ein zweiter Klick tut nichts (kein doppeltes Erzeugen).
async function mnLauf(tu) {
  if (mn.busy) return;
  mn.busy = true;
  const sperre = (an) => { const g = document.getElementById('dialog'); if (g) for (const k of g.querySelectorAll('.dialog-fuss button')) k.disabled = an; };
  sperre(true);
  try { await tu(); } finally {
    mn.busy = false;
    sperre(false);
    const s = document.getElementById('vs-senden');
    if (s && !mn.bereit) s.disabled = true; else vsKnopf();
  }
}

// Erzeugt die Mahnung einmal je Dialog; ein zweiter Klick auf "Senden" nach einem Fehler sendet dieselbe Zeile erneut.
async function mnErzeugen(grund) {
  if (mn.m) return mn.m;
  const b = grund.querySelector('#vs-betreff').value, t = grund.querySelector('#vs-text').value;
  mn.betreff = b; mn.text = t;
  // Betrag und Frist der Vorschau gehen mit: hat sich seither etwas geaendert, antwortet der Server 409 "neu erzeugen".
  mn.m = await sende('/api/mahnung/erzeugen', { nr: mn.nr, stufe: mn.v.stufe, betreff: b, text: t, offen_eur: mn.v.offen_eur, frist: mn.v.frist });
  mn.alle.unshift(mn.m);
  return mn.m;
}
function mnFertig(lauf, grund, text, ton) {
  mzStand.stand = undefined;
  if (grund.isConnected && lauf === mn.lauf) schliesseDialog();
  toast(text, ton);
  belegeNeu(mn.nr);
}
const mnMeldeFehler = (grund, e, titel) => mnFehler(grund, VERLOREN.includes(e.name)
  ? uebersetze('Keine Antwort vom Server — die Mahnung ist vielleicht raus. Bitte die Rechnung prüfen, bevor du erneut sendest.') : uebersetze(titel) + ': ' + e.message);
// Veralteter Entwurf (Betrag oder Frist): verwerfen, Vorschau neu laden, Fehlertext bleibt stehen; danach geht Erzeugen/Senden wieder.
async function mnVeraltet(g, e) {
  if (!(e.status === 409 && /neu erzeugen/.test(e.message))) return false;
  if (mn.m) mn.verworfen.add(mn.m.id);
  mn.m = null;
  try { await mnVorschau(); mnZeichne(g); mnFehler(g, e.message); } catch (e2) { mnFehler(g, e2.message); }
  return true;
}

aktion('mn-erzeugen', () => mnLauf(async () => {
  const g = document.getElementById('dialog');
  if (!g) return;
  const lauf = mn.lauf;
  try { await mnErzeugen(g); } catch (e) { if (g.isConnected && lauf === mn.lauf && !(await mnVeraltet(g, e))) mnMeldeFehler(g, e, 'Mahnung nicht erzeugt'); return; }
  if (g.isConnected && lauf === mn.lauf) mnZeichne(g);
}));

aktion('mn-senden', () => mnLauf(async () => {
  const g = document.getElementById('dialog');
  if (!g || !vsAnUebernehmen()) return;
  const { lauf, nr } = mn;
  const an = vs.an.slice(), umleitenAn = vs.umleitenAn;
  const hier = () => g.isConnected && lauf === mn.lauf;
  let m;
  try { m = await mnErzeugen(g); } catch (e) { if (hier() && !(await mnVeraltet(g, e))) mnMeldeFehler(g, e, 'Mahnung nicht erzeugt'); return; }
  let r;
  try { r = await sende('/api/mahnung/senden', { id: m.id, an }); } catch (e) {
    if (hier() && !(await mnVeraltet(g, e))) {
      // Die Zeile gibt es jetzt: die Ansicht wechselt zum Ergebnis, damit "PDF ansehen" und "Post" erreichbar bleiben.
      mnZeichne(g); mnMeldeFehler(g, e, 'Mahnung nicht gesendet');
    }
    mzStand.stand = undefined; belegeNeu(nr);
    return;
  }
  mn.m = r.mahnung;
  mn.alle = [r.mahnung, ...mn.alle.filter((x) => x.id !== r.mahnung.id)];
  // Warnungen (Server-Text) wie im E-Mail-Dialog: r.warnung = Mail raus, Status nicht gespeichert; versand.warnung = Abschrift oder Protokolleintrag fehlt.
  const warnung = [r.warnung, r.versand && r.versand.warnung].filter(Boolean).join(' ');
  const plus = warnung ? ' ' + warnung : '';
  if (r.mahnung.status === 'gesendet' || r.warnung) mnFertig(lauf, g, fuelle('Mahnung gesendet an {a}', { a: an.join(', ') }) + plus, warnung ? 'warn' : 'ok');
  else if (r.mahnung.status === 'test') mnFertig(lauf, g, fuelle('Test gesendet an {a} (statt {o}) — zählt nicht als Stufe', { a: umleitenAn, o: an.join(', ') }) + plus, 'warn');
  else if (hier()) { mnZeichne(g); mnFehler(g, uebersetze('Mahnung nicht gesendet') + ': ' + (r.mahnung.fehler || (r.versand && r.versand.fehler) || '') + plus); }
}));

aktion('mn-post', () => mnLauf(async () => {
  const g = document.getElementById('dialog');
  if (!g || !mn.m) return;
  const lauf = mn.lauf;
  try { await sende('/api/mahnung/post', { id: mn.m.id }); } catch (e) {
    if (g.isConnected && lauf === mn.lauf && !(await mnVeraltet(g, e))) mnMeldeFehler(g, e, 'Nicht markiert');
    return;
  }
  mnFertig(lauf, g, uebersetze('Als per Post versendet markiert'), 'ok');
}));

aktion('r-mahnen', (nr) => { menueZu(); bz.menu = null; oeffneMahnen(nr); });
