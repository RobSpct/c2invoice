'use strict';
/* E-Mail-Versand (C11a): Dialog fuer Rechnungen und Angebote, Versand-Marken
   in den Listen, Bereitschaft fuer den Editor. Geprueft und gefuellt wird auf
   dem Server (mail.js): der Dialog zeigt, was /api/mail/vorschau liefert, und
   sendet mit einem Schluessel je Oeffnung — ein Doppelklick oder eine
   Wiederholung nach Netzabbruch ergibt keine zweite Mail. Texte des Servers
   (Fehler, Gruende) gehen nur per textContent in die Seite. */

Object.assign(EN, {
  'E-Mail senden': 'Send e-mail', 'E-Mail …': 'E-mail …', 'An': 'To', 'Betreff': 'Subject', 'Nachricht': 'Message', 'Anhänge': 'Attachments',
  'Adresse hinzufügen': 'Add address', 'höchstens 5 Empfänger': 'at most 5 recipients', 'Empfänger entfernen': 'Remove recipient',
  'Testmodus: geht an {a}': 'Test mode: goes to {a}', 'Kein Versandkonto eingerichtet.': 'No sending account set up.',
  'Versand einrichten': 'Set up sending', 'Ohne PDF geht keine Mail raus.': 'No e-mail goes out without the PDF.',
  'Mindestens ein Empfänger fehlt.': 'At least one recipient is missing.', 'Keine gültige E-Mail-Adresse': 'Not a valid e-mail address',
  'Gesendet an {a}': 'Sent to {a}', 'Test gesendet an {a} (statt {o})': 'Test sent to {a} (instead of {o})', 'Bereits gesendet': 'Already sent',
  'Nicht gesendet': 'Not sent', 'Vorschau nicht geladen': 'Preview not loaded',
  'Zustellung unklar — bitte erst im Postfach unter „Gesendet“ nachsehen. Für einen neuen Versuch den Dialog neu öffnen.':
    'Delivery unclear — check “Sent” in your mailbox first. To try again, reopen the dialog.',
  'Keine Antwort vom Server — die Mail ist vielleicht gesendet. Erneut „Senden“ schickt sie nicht doppelt.':
    'No answer from the server — the e-mail may have been sent. Pressing “Send” again does not send it twice.',
  'gesendet {d}': 'sent {d}', 'gesendet an': 'sent to', 'Test an': 'test to', 'Versand fehlgeschlagen': 'Sending failed',
  'Zustellung unklar — unter Gesendet prüfen': 'Delivery unclear — check Sent',
  'Rechnung': 'Invoice', 'Angebot': 'Quote',
  'E-Mail-Status nicht geladen — „Erstellen & senden“ fehlt vorerst.': 'E-mail status not loaded — “Create & send” is hidden for now.',
  'Versandstatus nicht geladen — „gesendet“-Marken fehlen vielleicht.': 'Sending status not loaded — “sent” marks may be missing.',
  'Gesendet — Protokolleintrag fehlt, nicht erneut senden.': 'Sent — log entry missing, do not send again.',
  'Zustellung unklar {d}': 'Delivery unclear {d}',
  'Ein früherer Versand am {d} ist unklar zugestellt — erst im Postfach unter „Gesendet“ nachsehen, dann bewusst erneut senden.':
    'An earlier send on {d} has unclear delivery — check “Sent” in your mailbox first, then send again deliberately.',
});

/* ---------- Bereitschaft (Editor-Knopf) ---------- */
// Status kurz merken: der Editor zeichnet seinen Fuss oft neu. Ein Ladefehler wird einmal je Ausfall
// gemeldet — sonst fehlte der Knopf still, als gaebe es kein Konto.
const vsStatus = { d: null, zeit: 0, laedt: false, fehler: false };
function mailBereit(danach) {
  if (!vsStatus.laedt && Date.now() - vsStatus.zeit > 30000) {
    vsStatus.laedt = true;
    hole('/api/mail/status').then((d) => { vsStatus.d = d; vsStatus.fehler = false; }, (e) => {
      console.error('/api/mail/status:', e.message);
      vsStatus.d = null;
      if (!vsStatus.fehler) toast(uebersetze('E-Mail-Status nicht geladen — „Erstellen & senden“ fehlt vorerst.'), 'warn');
      vsStatus.fehler = true;
    }).then(() => { vsStatus.laedt = false; vsStatus.zeit = Date.now(); if (danach) danach(); });
  }
  return !!(vsStatus.d && vsStatus.d.bereit);
}

/* ---------- Versand-Marken in den Listen ---------- */
const vsMarken = { d: {}, stand: undefined, laedt: false, fehler: false };
function ladeVersandMarken() {
  if (vsMarken.laedt || vsMarken.stand === state.belegeStand) return;
  const nrs = [...(state.rechnungen || []), ...(state.angebote || [])].map((x) => x.nr);
  if (!nrs.length) return;
  vsMarken.laedt = true;
  vsMarken.stand = state.belegeStand;
  // ponytail: alle Nummern in einer Abfrage (Server nimmt bis 1000); bei mehr Belegen seitenweise holen.
  hole('/api/mail/letzte?bezug=' + encodeURIComponent(nrs.join(','))).then((d) => { vsMarken.d = (d && d.letzte) || {}; vsMarken.fehler = false; }, (e) => {
    console.error('/api/mail/letzte:', e.message);
    // Beim naechsten Zeichnen neu versuchen (nicht sofort: das Neuzeichnen riefe uns in Schleife), Hinweis
    // einmal je Ausfall — sonst wirkt eine gesendete Rechnung ungesendet und wird noch einmal verschickt.
    vsMarken.stand = undefined;
    if (!vsMarken.fehler) toast(uebersetze('Versandstatus nicht geladen — „gesendet“-Marken fehlen vielleicht.'), 'warn');
    vsMarken.fehler = true;
  }).then(() => { vsMarken.laedt = false; if (!vsMarken.fehler && ['rechnungen', 'angebote'].includes(route().name)) zeichneAnsicht(); });
}
// "gesendet 28.10." unter der Status-Pille, bzw. "Zustellung unklar 28.10." in Warnfarbe (I1: vielleicht beim Kunden,
// erst unter Gesendet pruefen). Nur scharfer Versand (R17, Server filtert test = 0); Tests stehen im Verlauf.
function versandMarke(nr) {
  const m = vsMarken.d[nr];
  if (!m) return '';
  const d = datumKurz(ortsTag(m.zeit));
  return m.unklar ? '<span class="s warn">' + esc(fuelle('Zustellung unklar {d}', { d })) + '</span>' : '<span class="s">' + esc(fuelle('gesendet {d}', { d })) + '</span>';
}

/* ---------- Dialog ---------- */
const vs = { lauf: 0, art: null, nr: null, an: [], schluessel: '', pdfOk: false, unklar: false, umleitenAn: '' };
const VS_ADRESSE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

function vsKopf(art, nr) {
  return '<div class="dialog-kopf"><div><h2>' + esc(uebersetze('E-Mail senden')) + '</h2><span class="hinweis mono">' + esc(uebersetze(art === 'rechnung' ? 'Rechnung' : 'Angebot') + ' ' + nr) + '</span></div>' +
    '<button type="button" class="mini-knopf" data-aktion="dialog-zu" aria-label="' + esc(uebersetze('Schließen')) + '">×</button></div>';
}
// Ohne Konto: das Dokument von Hand verschicken.
function vsDokument(art, nr) {
  const r = art === 'rechnung' && (state.rechnungen || []).find((x) => x.nr === nr);
  return r && r.hat_pdf ? { href: '/rechnung-pdf/' + encodeURIComponent(nr), t: 'PDF laden' }
    : { href: '/' + art + '/' + encodeURIComponent(nr), t: 'Dokument ansehen' };
}

async function oeffneVersand(art, nr) {
  if (!['rechnung', 'angebot'].includes(art) || !nr) return;
  const lauf = ++vs.lauf;
  // Ein Schluessel je Oeffnung (R7): erneutes Senden im selben Dialog ist sicher, ein neuer Dialog ist ein neuer Versand.
  Object.assign(vs, { art, nr, an: [], schluessel: crypto.randomUUID(), pdfOk: false, unklar: false, umleitenAn: '' });
  const grund = dialog(vsKopf(art, nr) + '<div id="vs-inhalt" class="vs-inhalt"><div class="leer">' + esc(uebersetze('Lädt …')) + '</div></div>', 'E-Mail senden', 560);
  const aktuell = () => lauf === vs.lauf && grund.isConnected;
  const fehlerZeigen = (titel, e) => {
    const el = grund.querySelector('#vs-inhalt');
    el.innerHTML = '<p class="dialog-fehler" role="alert"></p>';
    el.firstChild.textContent = uebersetze(titel) + ': ' + ((e && (e.grund || e.message)) || 'Fehler');
  };
  let e;
  try { e = await hole('/api/mail/einstellungen'); }
  catch (err) { if (aktuell()) fehlerZeigen('Vorschau nicht geladen', err); return; }
  if (!aktuell()) return;
  vsStatus.d = e.status; vsStatus.zeit = Date.now();
  if (!e.status.bereit) {
    const dok = vsDokument(art, nr);
    grund.querySelector('#vs-inhalt').innerHTML = '<p class="dialog-text">' + esc(uebersetze('Kein Versandkonto eingerichtet.')) + '</p>' +
      '<p class="hinweis" id="vs-grund"></p>' +
      '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="vs-einrichten">' + esc(uebersetze('Versand einrichten')) + '</button>' +
        '<a class="knopf primaer" href="' + esc(dok.href) + '" target="_blank" rel="noopener">' + esc(uebersetze(dok.t)) + '</a></div>';
    grund.querySelector('#vs-grund').textContent = e.status.grund || '';
    return;
  }
  let n;
  try { n = await sende('/api/mail/vorschau', { art, nr }); }
  catch (err) { if (aktuell()) fehlerZeigen('Vorschau nicht geladen', err); return; }
  if (!aktuell()) return;
  vs.an = (n.an || []).slice(0, 5);
  vs.umleitenAn = e.status.umgeleitet ? e.werte.umleitenAn : '';
  const pdf = (n.anhaenge || []).find((a) => a.typ === 'application/pdf');
  vs.pdfOk = !!(pdf && pdf.ok);
  const anhaenge = (n.anhaenge || []).map((a, i) => '<div class="vs-anhang"><span class="chip' + (a.ok ? '' : ' fehlt') + '">' + esc(a.name) + '</span>' +
    (a.ok ? '' : '<span class="hinweis warn" data-grund="' + i + '"></span>') + '</div>').join('');
  grund.querySelector('#vs-inhalt').innerHTML =
    (e.status.umgeleitet ? '<div class="banner" role="status" id="vs-test"></div>' : '') +
    // Unklare letzte Zustellung (I1): nur Hinweis, Senden bleibt frei — neuer Schluessel = bewusste Handlung (R7).
    (n.unklar ? '<p class="hinweis warn" role="status" id="vs-unklar"></p>' : '') +
    '<div class="feld"><label class="label" for="vs-an-neu">' + esc(uebersetze('An')) + '</label><div class="vs-an" id="vs-an"></div></div>' +
    '<label class="feld"><span class="label">' + esc(uebersetze('Betreff')) + '</span><input id="vs-betreff" maxlength="200" autocomplete="off" value="' + esc(n.betreff) + '"></label>' +
    '<label class="feld"><span class="label">' + esc(uebersetze('Nachricht')) + '</span><textarea class="eingabe" id="vs-text" rows="9" maxlength="4000">' + esc(n.text) + '</textarea></label>' +
    '<div class="feld"><span class="label">' + esc(uebersetze('Anhänge')) + '</span><div class="vs-anhaenge">' + anhaenge + '</div></div>' +
    '<p class="hinweis warn" id="vs-sperre"></p><p class="dialog-fehler" id="vs-fehler" role="alert"></p>' +
    '<div class="dialog-fuss"><button type="button" class="knopf" data-aktion="dialog-zu">' + esc(uebersetze('Abbrechen')) + '</button>' +
      '<button type="button" class="knopf primaer" id="vs-senden" data-aktion="vs-senden">' + esc(uebersetze('Senden')) + '</button></div>';
  if (vs.umleitenAn) grund.querySelector('#vs-test').textContent = fuelle('Testmodus: geht an {a}', { a: vs.umleitenAn });
  if (n.unklar) grund.querySelector('#vs-unklar').textContent = fuelle('Ein früherer Versand am {d} ist unklar zugestellt — erst im Postfach unter „Gesendet“ nachsehen, dann bewusst erneut senden.', { d: datumKurz(ortsTag(n.unklar)) });
  (n.anhaenge || []).forEach((a, i) => { const s = grund.querySelector('[data-grund="' + i + '"]'); if (s) s.textContent = a.grund || ''; });
  vsAnZeichnen();
  const neu = grund.querySelector('#vs-an-neu');
  if (neu) neu.focus();
  // Enter, Komma oder Semikolon uebernimmt die getippte Adresse; im Betreff schickt Enter nichts ab.
  grund.addEventListener('keydown', (ev) => {
    if (ev.target.id === 'vs-an-neu' && (ev.key === 'Enter' || ev.key === ',' || ev.key === ';')) { ev.preventDefault(); vsAnUebernehmen(true); }
    else if (ev.target.id === 'vs-an-neu' && ev.key === 'Backspace' && !ev.target.value && vs.an.length) { vs.an.pop(); vsAnZeichnen(); vsFokusAn(); }
    else if (ev.target.id === 'vs-betreff' && ev.key === 'Enter') ev.preventDefault();
  });
  // Verzoegert: im focusout selbst das Feld per innerHTML zu ersetzen wirft (NotFoundError).
  grund.addEventListener('focusout', (ev) => { if (ev.target.id === 'vs-an-neu') setTimeout(() => { const n = document.getElementById('vs-an-neu'); if (n && n.value.trim()) vsAnUebernehmen(); }, 0); });
}

function vsAnZeichnen() {
  const box = document.getElementById('vs-an');
  if (!box) return;
  const voll = vs.an.length >= 5;
  box.innerHTML = vs.an.map((a, i) => '<span class="chip vs-chip">' + esc(a) +
      '<button type="button" class="vs-weg" data-aktion="vs-an-weg" data-wert="' + i + '" aria-label="' + esc(uebersetze('Empfänger entfernen') + ': ' + a) + '">×</button></span>').join('') +
    '<input id="vs-an-neu" type="email" autocomplete="off" maxlength="254"' + (voll ? ' disabled' : '') +
      ' placeholder="' + esc(uebersetze(voll ? 'höchstens 5 Empfänger' : 'Adresse hinzufügen')) + '" aria-label="' + esc(uebersetze('Adresse hinzufügen')) + '">';
  vsKnopf();
}
// Senden gesperrt ohne PDF (R10/R14), ohne Empfaenger und nach unklarer Zustellung (R6).
function vsKnopf() {
  const k = document.getElementById('vs-senden');
  if (!k) return;
  const grund = !vs.pdfOk ? 'Ohne PDF geht keine Mail raus.' : !vs.an.length ? 'Mindestens ein Empfänger fehlt.' : '';
  k.disabled = !!grund || vs.unklar;
  document.getElementById('vs-sperre').textContent = grund ? uebersetze(grund) : '';
}
const vsFokusAn = () => { const n = document.getElementById('vs-an-neu'); if (n && !n.disabled) n.focus(); };
// Getippte Adressen als Chips uebernehmen; false bei ungueltiger Eingabe (sie bleibt im Feld).
function vsAnUebernehmen(fokus) {
  const feld = document.getElementById('vs-an-neu');
  if (!feld) return true;
  const neu = feld.value.split(/[,;\s]+/).filter(Boolean);
  const falsch = neu.filter((a) => !VS_ADRESSE.test(a));
  const f = document.getElementById('vs-fehler');
  // Der Unklar-Hinweis (R6) bleibt stehen; eine Tippfehler-Meldung verdraengt ihn nicht.
  if (falsch.length) { if (!vs.unklar) f.textContent = uebersetze('Keine gültige E-Mail-Adresse') + ': ' + falsch.join(', '); return false; }
  if (!neu.length) return true;
  for (const a of neu) if (vs.an.length < 5 && !vs.an.includes(a)) vs.an.push(a);
  // Erst leeren: das Neuzeichnen entfernt das fokussierte Feld, dessen focusout sonst noch einmal uebernaehme.
  feld.value = '';
  if (!vs.unklar) f.textContent = '';
  vsAnZeichnen();
  if (fokus) vsFokusAn();
  return true;
}
aktion('vs-an-weg', (i) => { vs.an.splice(Number(i), 1); vsAnZeichnen(); vsFokusAn(); });
aktion('vs-einrichten', () => { schliesseDialog(); geheZu('einstellungen/versand'); });

// mitLauf gibt den Knopf am Ende frei; vsKnopf sperrt ihn danach wieder, wo noetig.
aktion('vs-senden', (w, knopf) => mitLauf(knopf, async () => {
  const g = document.getElementById('dialog');
  if (!g || !vsAnUebernehmen()) return;
  // Alles vor dem await festhalten: waehrenddessen kann ein anderer Dialog vs uebernehmen.
  const { lauf, art, nr, schluessel, umleitenAn } = vs;
  const an = vs.an.slice();
  const hier = () => g.isConnected && lauf === vs.lauf;
  const UNKLAR = 'Zustellung unklar — bitte erst im Postfach unter „Gesendet“ nachsehen. Für einen neuen Versuch den Dialog neu öffnen.';
  // Fehlertext in den eigenen Dialog oder, wenn der schon zu ist, als Toast.
  const melde = (text, unklar) => {
    if (!hier()) { toast(text, 'err'); return; }
    if (unklar) vs.unklar = true;
    g.querySelector('#vs-fehler').textContent = text;
  };
  let r;
  try {
    r = await sende('/api/mail/senden', { art, nr, an, betreff: g.querySelector('#vs-betreff').value, text: g.querySelector('#vs-text').value, schluessel });
  } catch (e) {
    // Gleicher Schluessel: ein zweiter Klick nach verlorener Antwort sendet nicht doppelt.
    if (VERLOREN.includes(e.name)) melde(uebersetze('Keine Antwort vom Server — die Mail ist vielleicht gesendet. Erneut „Senden“ schickt sie nicht doppelt.'));
    // 409: R7 (frueherer Versuch mit diesem Schluessel unklar) oder Versand laeuft bereits — kein "nicht gesendet".
    else if (e.status === 409 && /unklar/i.test(e.message)) melde(uebersetze(UNKLAR), true);
    // Gesendet, nur der Protokolleintrag fehlt (Server): Senden bleibt gesperrt.
    else if (e.status === 409 && /bereits gesendet/i.test(e.message)) melde(e.message, true);
    else if (e.status === 409) melde(e.message);
    else melde(uebersetze('Nicht gesendet') + ': ' + e.message);
    return;
  }
  vsMarken.stand = undefined;
  // warnung (Server-Text): Mail ist raus bzw. unklar, aber Abschrift oder Protokolleintrag fehlen.
  const warnung = r.warnung ? ' ' + r.warnung : '';
  if (r.status !== 'ok') {
    melde(r.unklar ? uebersetze(UNKLAR) + warnung : uebersetze('Nicht gesendet') + ': ' + (r.fehler || ''), !!r.unklar);
    belegeNeu(nr);
    return;
  }
  // Gesendet, aber ohne Protokolleintrag (R24): Dialog bleibt offen und gesperrt, der Hinweis bleibt stehen
  // (ein kurzer Toast verfliegt, und ohne Marke saehe der Beleg ungesendet aus).
  if (!r.doppelt && r.id == null) {
    melde(uebersetze('Gesendet — Protokolleintrag fehlt, nicht erneut senden.') + warnung, true);
    belegeNeu(nr);
    return;
  }
  // Gesendet mit Warnung zur Abschrift (.eml): als gesendet melden (Dialog zu), nicht als Fehler.
  if (hier()) schliesseDialog();
  toast((r.doppelt ? uebersetze('Bereits gesendet') : r.test ? fuelle('Test gesendet an {a} (statt {o})', { a: umleitenAn, o: an.join(', ') }) : fuelle('Gesendet an {a}', { a: an.join(', ') })) + warnung,
    r.warnung ? 'warn' : 'ok');
  belegeNeu(nr);
}).then(vsKnopf));
