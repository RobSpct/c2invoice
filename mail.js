'use strict';
// C11a Versand (design/cira/C11-FLOWS.md): MIME-Nachricht (baueMime, transportneutral nach Spec D5:
// kein Dot-Stuffing, keine Bcc-Kopfzeile), SMTP-Client (smtpSende), Versanddienst mit Protokoll,
// Idempotenz und Grenzen sowie Beleg-Nachrichten und Routen /api/mail/* (erzeuge).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const ID_RE = /^[A-Za-z0-9._-]+$/;

const fehler = (text) => Object.assign(new Error(text), { status: 400 });

// Kopfzeilen-Text darf keinen Zeilenumbruch tragen, sonst laesst sich eine Kopfzeile einschleusen.
function pruefeKopf(s, feld) {
  s = String(s ?? '');
  if (/[\r\n\0]/.test(s)) throw fehler(feld + ': Zeilenumbruch oder Nullbyte nicht erlaubt');
  return s;
}

function pruefeAdresse(s, feld) {
  s = pruefeKopf(s, feld);
  if (!EMAIL_RE.test(s)) throw fehler(feld + ': keine gueltige E-Mail-Adresse');
  return s;
}

// RFC 2047: Nicht-ASCII als Kodierwoerter (B), je <= 30 Byte, gefaltet mit CRLF + Leerzeichen.
function kodiere(s) {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const woerter = [];
  let cur = '';
  for (const z of s) {
    if (cur && Buffer.byteLength(cur + z) > 30) { woerter.push(cur); cur = ''; }
    cur += z;
  }
  if (cur) woerter.push(cur);
  return woerter.map((w) => '=?UTF-8?B?' + Buffer.from(w).toString('base64') + '?=').join('\r\n ');
}

// quoted-printable, Zeilen <= 76 Zeichen; Zeilenenden werden CRLF, Inhalt sonst unveraendert.
function qp(text) {
  return String(text).split(/\r\n|\r|\n/).map((zeile) => {
    const b = Buffer.from(zeile);
    const zeilen = [];
    let cur = '';
    b.forEach((x, i) => {
      const klar = (x >= 33 && x <= 126 && x !== 61) || ((x === 32 || x === 9) && i < b.length - 1);
      const t = klar ? String.fromCharCode(x) : '=' + x.toString(16).toUpperCase().padStart(2, '0');
      if (cur.length + t.length > 75) { zeilen.push(cur + '='); cur = ''; }
      cur += t;
    });
    zeilen.push(cur);
    return zeilen.join('\r\n');
  }).join('\r\n');
}

const base64 = (buf) => (buf.toString('base64').match(/.{1,76}/g) || []).join('\r\n');

function baueMime({ von, an, betreff, text, anhaenge = [], messageId, datum = new Date() }) {
  const adresse = pruefeAdresse(von && von.adresse, 'Absender');
  const name = pruefeKopf(von && von.name, 'Absendername');
  if (!Array.isArray(an)) throw fehler('Empfaenger: Liste erwartet');
  const empf = an.map((a) => pruefeAdresse(a, 'Empfaenger'));
  if (!empf.length) throw fehler('Empfaenger fehlt');
  const subj = pruefeKopf(betreff, 'Betreff');
  const id = messageId == null ? crypto.randomBytes(12).toString('hex') : String(messageId);
  if (!ID_RE.test(id)) throw fehler('Message-ID: nur A-Z a-z 0-9 . _ -');
  const grenze = '=_c2i_' + crypto.randomBytes(12).toString('hex');

  const anzeige = !name || /^[A-Za-z0-9 ._-]+$/.test(name) ? name
    : /^[ -~]*$/.test(name) ? '"' + name.replace(/([\\"])/g, '\\$1') + '"' : kodiere(name);
  const kopf = [
    'From: ' + (anzeige ? anzeige + ' <' + adresse + '>' : adresse),
    'To: ' + empf.join(', '),
    'Subject: ' + kodiere(subj),
    'Date: ' + datum.toUTCString().replace(/ GMT$/, ' +0000'),
    'Message-ID: <' + id + '@' + adresse.slice(adresse.lastIndexOf('@') + 1) + '>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + grenze + '"',
  ];

  const teile = [['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable'].join('\r\n') + '\r\n\r\n' + qp(text)];
  for (const a of anhaenge) {
    const dateiname = pruefeKopf(a.name, 'Anhangsname').replace(/[^A-Za-z0-9._-]/g, '_');
    const typ = pruefeKopf(a.typ, 'Anhangstyp');
    teile.push([
      'Content-Type: ' + typ + '; name="' + dateiname + '"',
      'Content-Transfer-Encoding: base64',
      'Content-Disposition: attachment; filename="' + dateiname + '"',
    ].join('\r\n') + '\r\n\r\n' + base64(a.daten));
  }
  return kopf.join('\r\n') + '\r\n\r\n' + teile.map((t) => '--' + grenze + '\r\n' + t + '\r\n').join('') + '--' + grenze + '--\r\n';
}

// Umschlag-Adresse fuer MAIL FROM / RCPT TO: nur ASCII, denn SMTPUTF8 nutzen wir nicht.
function pruefeUmschlag(s, feld) {
  s = pruefeAdresse(s, feld);
  if (!/^[\x21-\x7e]+$/.test(s)) throw fehler(feld + ': nur ASCII-Adressen (kein SMTPUTF8)');
  return s;
}

// SMTP-Client (RFC 5321) ueber node:tls. Nie unverschluesselt: 'tls' (465) oder 'starttls' (587),
// fehlt STARTTLS in der EHLO-Antwort, bricht er vor AUTH ab. Jeder Ausgang zerstoert den Socket.
// Fehler: code 'SMTP', smtp = letzte Serverzeile; das Passwort (auch base64) wird daraus entfernt.
async function smtpSende({ host, port, sicher, benutzer = '', passwort = '', von, an, daten }, { verbinde, hochstufen, zeitMs = 20000 } = {}) {
  if (sicher !== 'tls' && sicher !== 'starttls') throw fehler("sicher: 'tls' oder 'starttls'");
  const absender = pruefeUmschlag(von, 'Absender');
  if (!Array.isArray(an)) throw fehler('Empfaenger: Liste erwartet');
  const empf = an.map((a) => pruefeUmschlag(a, 'Empfaenger'));
  if (!empf.length) throw fehler('Empfaenger fehlt');
  const tls = require('node:tls');
  verbinde ??= () => (sicher === 'tls' ? tls.connect({ host, port, servername: host }) : require('node:net').connect({ host, port }));
  hochstufen ??= (s, h) => tls.connect({ socket: s, servername: h });

  const b64 = (s) => Buffer.from(String(s)).toString('base64');
  const plain = b64('\0' + benutzer + '\0' + passwort);
  const geheim = [plain, b64(passwort), String(passwort)].filter(Boolean);
  const sauber = (s) => geheim.reduce((t, g) => t.split(g).join('***'), String(s));
  let letzte = '';
  const fail = (text) => Object.assign(new Error('SMTP: ' + sauber(text)), { code: 'SMTP', smtp: sauber(letzte) });

  // Zeilenleser: sammelt mehrzeilige Antworten (250-... bis 250 ...) in eine Warteschlange.
  const socks = [], eingang = [];
  // StringDecoder je Socket: ein UTF-8-Zeichen kann ueber zwei Pakete verteilt ankommen.
  let sock, dekoder, puffer = '', zeilen = [], wartet = null, kaputt = null;
  const melde = () => {
    if (!wartet || !(eingang.length || kaputt)) return;
    const w = wartet; wartet = null;
    if (eingang.length) w.ok(eingang.shift()); else w.nein(kaputt);
  };
  const lies = (d) => {
    puffer += dekoder.write(d);
    for (let i; (i = puffer.indexOf('\n')) >= 0;) {
      const z = puffer.slice(0, i).replace(/\r$/, ''); puffer = puffer.slice(i + 1);
      letzte = z; zeilen.push(z);
      if (!/^\d{3}-/.test(z)) { eingang.push({ code: Number(z.slice(0, 3)), zeilen }); zeilen = []; }
    }
    // Ein Server ohne Zeilenende fuellt sonst den Speicher.
    if (puffer.length > 65536) { kaputt ??= fail('Antwortzeile zu lang'); sock.destroy(); }
    melde();
  };
  const binde = (s) => {
    sock = s; socks.push(s); dekoder = new StringDecoder('utf8');
    s.on('data', lies);
    s.on('error', (e) => { kaputt ??= fail('Verbindung: ' + e.message); melde(); });
    s.on('close', () => { kaputt ??= fail('Verbindung vom Server geschlossen'); melde(); });
  };
  const antwort = (erwartet, schritt, ms = zeitMs) => new Promise((ok, nein) => {
    const t = setTimeout(() => { wartet = null; nein(fail('Zeitgrenze ueberschritten bei ' + schritt)); sock.destroy(); }, ms);
    wartet = { ok: (a) => { clearTimeout(t); ok(a); }, nein: (e) => { clearTimeout(t); nein(e); } };
    melde();
  }).then((a) => {
    if (!erwartet.includes(a.code)) throw fail(schritt + ' abgelehnt: ' + a.zeilen.join(' / '));
    return a;
  });
  // Fehltexte nennen nur den Schritt, nie den gesendeten Befehl (AUTH traegt das Passwort).
  const befehl = (zeile, erwartet, schritt, ms) => { sock.write(zeile + '\r\n'); return antwort(erwartet, schritt, ms); };
  const ehlo = async () => (await befehl('EHLO [127.0.0.1]', [250], 'EHLO')).zeilen.map((z) => z.slice(4).toUpperCase());

  binde(verbinde({ host, port }));
  try {
    await antwort([220], 'Begruessung');
    let kann = await ehlo();
    if (sicher === 'starttls') {
      if (!kann.some((k) => /^STARTTLS\b/.test(k))) throw fail('Server bietet kein STARTTLS an, Abbruch vor der Anmeldung');
      await befehl('STARTTLS', [220], 'STARTTLS');
      // Klartext nach der 220 verwerfen (sonst liessen sich Antworten vor TLS einschleusen).
      sock.off('data', lies); puffer = ''; zeilen = []; eingang.length = 0;
      binde(hochstufen(sock, host));
      kann = await ehlo();
    }
    const verfahren = (kann.find((k) => /^AUTH[ =]/.test(k)) || '').slice(5).split(/\s+/);
    if (verfahren.includes('PLAIN')) await befehl('AUTH PLAIN ' + plain, [235], 'AUTH');
    else if (verfahren.includes('LOGIN')) {
      await befehl('AUTH LOGIN', [334], 'AUTH');
      await befehl(b64(benutzer), [334], 'AUTH');
      await befehl(b64(passwort), [235], 'AUTH');
    } else throw fail('Server bietet weder AUTH PLAIN noch AUTH LOGIN an');
    await befehl('MAIL FROM:<' + absender + '>', [250], 'MAIL FROM');
    for (const e of empf) await befehl('RCPT TO:<' + e + '>', [250, 251], 'RCPT TO');
    await befehl('DATA', [354], 'DATA');
    // Zeilenenden vereinheitlichen (kein nacktes LF, kein SMTP-Smuggling), dann Dot-Stuffing.
    let rumpf = String(daten).replace(/\r\n|\r|\n/g, '\r\n').replace(/(^|\r\n)\./g, '$1..');
    if (!rumpf.endsWith('\r\n')) rumpf += '\r\n';
    // In Stuecken hochladen: jedes muss binnen zeitMs abfliessen (steht die Leitung, Abbruch), die
    // Antwortfrist laeuft erst nach dem letzten — ein grosses PDF auf langsamer Leitung ist kein Zeitfehler.
    // Scheitert der Upload, ist der Schlusspunkt nicht raus: eindeutig nicht zugestellt (nicht "unklar").
    const alles = Buffer.from(rumpf + '.\r\n');
    for (let i = 0; i < alles.length; i += 65536) {
      await new Promise((ok, nein) => {
        const t = setTimeout(() => nein(fail('Zeitgrenze ueberschritten beim Hochladen der Daten')), zeitMs);
        sock.write(alles.subarray(i, i + 65536), (e) => { clearTimeout(t); if (e) nein(kaputt || fail('Verbindung: ' + e.message)); else ok(); });
      });
    }
    const ende = await antwort([250], 'Datenende').catch((e) => {
      // Ohne Antwort (Zeitgrenze, Verbindung weg) ist offen, ob der Server die Mail schon angenommen hat.
      if (/abgelehnt/.test(e.message)) throw e;
      throw Object.assign(fail('Datenende ohne Antwort: ' + e.message.replace(/^SMTP: /, '')), { unklar: true });
    });
    // Die Mail ist angenommen; ein Fehler beim QUIT aendert daran nichts.
    await befehl('QUIT', [221], 'QUIT', Math.min(zeitMs, 5000)).catch(() => {});
    return { antwort: sauber(ende.zeilen.join('\n')) };
  } finally {
    for (const s of socks) s.destroy();
  }
}

// ---- Vorlagen fuer Belege ----
// Werte kommen aus der Abschrift (rechnung.lade/angebot.lade), nie neu gerechnet.
const STANDARD_VORLAGEN = {
  rechnung: {
    betreff: 'Rechnung {{nr}}',
    text: '{{anrede}}\n\nanbei erhalten Sie die Rechnung {{nr}} vom {{datum}} über {{brutto}}, zahlbar bis {{faellig}}.\n\nViele Grüße\n{{absender}}',
  },
  angebot: {
    betreff: 'Angebot {{nr}}',
    text: '{{anrede}}\n\nanbei erhalten Sie unser Angebot {{nr}} über {{brutto}}, gültig bis {{gueltig}}.\n\nViele Grüße\n{{absender}}',
  },
  // C11c: Nachfassen vor Ablauf der Gueltigkeit (f2); das Angebots-PDF haengt an.
  nachfassen: {
    betreff: 'Ihr Angebot {{nr}} läuft am {{gueltig}} ab',
    text: '{{anrede}}\n\nunser Angebot {{nr}} über {{brutto}} gilt noch bis {{gueltig}}. Haben Sie noch Fragen dazu, melden Sie sich gern. Das Angebot hängt zur Erinnerung an.\n\nViele Grüße\n{{absender}}',
  },
  // C11b: Mailtext und Brieftext des Mahnschreibens zugleich (P4); Werte aus der Mahnung-Abschrift.
  erinnerung: {
    betreff: 'Zahlungserinnerung zur Rechnung {{nr}}',
    text: '{{anrede}}\n\nsicher ist es Ihnen im Alltag entgangen: Die Rechnung {{nr}} vom {{datum}} war am {{faellig}} fällig. Offen sind noch {{offen}}.\n\n'
      + 'Bitte überweisen Sie den Betrag bis {{frist}}. Haben Sie bereits gezahlt, betrachten Sie dieses Schreiben bitte als gegenstandslos.\n\nViele Grüße\n{{absender}}',
  },
  mahnung1: {
    betreff: '1. Mahnung zur Rechnung {{nr}}',
    text: '{{anrede}}\n\ntrotz unserer Zahlungserinnerung ist die Rechnung {{nr}} vom {{datum}} noch nicht beglichen. Offen sind {{offen}}.\n\n'
      + 'Bitte überweisen Sie den Betrag bis spätestens {{frist}}.\n\nViele Grüße\n{{absender}}',
  },
  mahnung2: {
    betreff: '2. Mahnung zur Rechnung {{nr}}',
    text: '{{anrede}}\n\ndie Rechnung {{nr}} vom {{datum}} ist trotz Erinnerung und 1. Mahnung weiterhin offen: {{offen}}{{gebuehr}}.\n\n'
      + 'Bitte überweisen Sie den Betrag bis spätestens {{frist}}. Geht bis dahin keine Zahlung ein, behalten wir uns weitere Schritte vor.\n\nViele Grüße\n{{absender}}',
  },
};
// Stornorechnung (Gegenrechnung mit storno_von): fest, nicht in den Einstellungen; Betrag negativ wie auf dem Dokument.
const stornoVorlage = (von) => ({
  betreff: 'Stornorechnung {{nr}} zur Rechnung ' + von,
  text: '{{anrede}}\n\nanbei erhalten Sie die Stornorechnung {{nr}} vom {{datum}} zur Rechnung ' + von + ' über {{brutto}}. Die Rechnung ' + von
    + ' ist damit storniert.\n\nViele Grüße\n{{absender}}',
});
// Je Vorlagenart, was beim Speichern erlaubt ist: {{frist}} in einer Rechnungsvorlage kaeme beim Kunden leer an.
const PLATZHALTER_BELEG = ['nr', 'datum', 'brutto', 'faellig', 'gueltig', 'anrede', 'absender'];
const PLATZHALTER_MAHNUNG = [...PLATZHALTER_BELEG, 'offen', 'frist', 'gebuehr'];
const PLATZHALTER_JE = { rechnung: PLATZHALTER_BELEG, angebot: PLATZHALTER_BELEG, nachfassen: PLATZHALTER_BELEG,
  erinnerung: PLATZHALTER_MAHNUNG, mahnung1: PLATZHALTER_MAHNUNG, mahnung2: PLATZHALTER_MAHNUNG };
// Alle bekannten (fuelle): was die Werte einer Art nicht tragen, wird ohnehin leer.
const PLATZHALTER = PLATZHALTER_MAHNUNG;
// Unbekannte Platzhalter werden leer, damit nie "{{x}}" beim Kunden ankommt (abgelehnt wird beim Speichern, Task 6).
const fuelle = (vorlage, werte) => String(vorlage).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (PLATZHALTER.includes(k) && werte[k] != null ? String(werte[k]) : ''));
const BELEG_RE = { rechnung: /^\d{4}-\d{4}$/, angebot: /^AN-\d{4}-\d{4}$/ };
const SCHLUESSEL_RE = /^[A-Za-z0-9_-]{8,64}$/;

// Fehler mit status gehen mit ihrem Text raus, alles andere nur ins Protokoll (auch mahnung.js).
function antwort(res, sendJson, arbeit) {
  Promise.resolve().then(arbeit).then((r) => sendJson(res, r), (e) => {
    if (!e || !e.status) console.error('Mail:', e);
    sendJson(res, { error: e && e.status ? e.message : 'Interner Fehler, Details im Serverprotokoll.' }, (e && e.status) || 500);
  });
}

// ---- Versanddienst ----
// Garantien: nie zweimal (lauf_id+nr bzw. schluessel), im Testmodus nie an den echten Empfaenger,
// das Passwort steht in keiner Antwort, keinem Fehltext, keiner .eml. Kein BEGIN ueber ein await:
// gesendet wird ausserhalb jeder Transaktion, danach genau ein INSERT.
const ARTEN = ['rechnung', 'angebot', 'erinnerung', 'mahnung1', 'mahnung2', 'nachfassen', 'test', 'benachrichtigung'];
const VAR_RE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const mitStatus = (status, text) => Object.assign(new Error(text), { status });
// Schluessel, deren Versand gerade laeuft (Doppelklick, zwei Tabs): Vorabfrage und Eintragen hier
// laufen ohne await dazwischen, das schliesst die Luecke bis zum INSERT.
// ponytail: gilt nur in diesem Prozess; senden zwei Prozesse auf derselben DB gleichzeitig mit
// demselben Schluessel, gehen beide Mails raus und erst der UNIQUE-Index faengt die zweite Zeile.
const imFlug = new Set();
// Klare Fehlversuche je Kalendertag (Anmeldung scheitert, Server lehnt ab): danach wird nicht mehr
// verbunden, sonst sperrt der Anbieter das Konto nach einer Schleife auf "Testmail senden".
const FEHLVERSUCHE_TAG = 20;
const UNKLAR_SQL = "status = 'fehler' AND fehler LIKE 'Zustellung unklar:%'";
const UNKLAR_409 = 'Zustellung unklar — erst unter Gesendet pruefen';

function erzeuge({
  db, mailCfg, env = process.env, transporte = { smtp: smtpSende }, versandOrdner = path.join(__dirname, 'data', 'versand'), jetzt = () => new Date(),
  port = 4747,
  // Druck und E-Rechnung; Tests setzen Attrappen ein (kein Chrome).
  pdfFn = (art, nr) => (art === 'rechnung' ? require('./rechnung') : require('./angebot')).erzeugePdf(db, nr, port),
  xmlFn = (inv) => require('./erechnung').alsXml(inv),
}) {
  const cfg = () => mailCfg() || {};
  const transportVon = (m) => m.transport || 'smtp';
  // Name ohne PASS/SECRET/TOKEN gilt nicht, sonst liesse sich jede Variable (PATH, ...) als Passwort ausleiten.
  const envGueltig = (n) => typeof n === 'string' && VAR_RE.test(n) && /(PASS|SECRET|TOKEN)/i.test(n);
  const envName = (m) => {
    const n = m.smtp && m.smtp.passwortEnvVar;
    return envGueltig(n) ? n : 'C2I_SMTP_PASSWORT';
  };
  const grenzeVon = (m) => (Number.isInteger(m.tagesgrenze) && m.tagesgrenze > 0 ? m.tagesgrenze : 100);
  const ascii = (s) => /^[\x21-\x7e]+$/.test(s);

  function grundVon(m) {
    const t = transportVon(m);
    if (!Object.hasOwn(transporte, t)) return "Transport '" + t + "' kommt mit Block O (OAuth)";
    const s = m.smtp || {};
    if (!s.host) return 'mail.smtp.host fehlt';
    if (!Number.isInteger(s.port) || s.port < 1 || s.port > 65535) return 'mail.smtp.port fehlt oder ist keine ganze Zahl von 1 bis 65535';
    if (s.sicher !== 'tls' && s.sicher !== 'starttls') return "mail.smtp.sicher muss 'tls' (Port 465) oder 'starttls' (Port 587) sein — unverschluesselt sendet c2invoice nie";
    if (!s.benutzer) return 'mail.smtp.benutzer fehlt';
    const a = m.absender && m.absender.adresse;
    if (typeof a !== 'string' || !EMAIL_RE.test(a)) return 'mail.absender.adresse fehlt oder ist keine E-Mail-Adresse';
    // Testmodus-Adresse mit Tippfehler: sonst scheiterte jede Sendung mit „Empfaenger ungueltig“ wie eine falsche Kundenadresse.
    const u = m.umleitenAn;
    if (u && !(typeof u === 'string' && EMAIL_RE.test(u) && ascii(u))) return 'mail.umleitenAn (Testmodus) ist keine gueltige E-Mail-Adresse (nur ASCII); leer = scharf';
    const n = s.passwortEnvVar;
    if (n != null && n !== '' && !envGueltig(n)) {
      return 'mail.smtp.passwortEnvVar abgelehnt: der Name muss PASS, SECRET oder TOKEN enthalten (nur A-Z, 0-9, _), sonst liesse sich jede Umgebungsvariable als Passwort ausleiten';
    }
    if (!env[envName(m)]) return 'Umgebungsvariable ' + envName(m) + ' fehlt';
    return null;
  }

  // Kalendertag in Ortszeit (nicht "letzte 24 h"); zeit ist ISO in UTC, Grenzen ebenso.
  function amTag(bedingung) {
    const n = jetzt();
    const ab = new Date(n.getFullYear(), n.getMonth(), n.getDate()), bis = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    return db.prepare('SELECT COUNT(*) n FROM versand WHERE (' + bedingung + ') AND zeit >= ? AND zeit < ?').get(ab.toISOString(), bis.toISOString()).n;
  }
  // Zur Tagesgrenze zaehlt, was vielleicht zugestellt ist: ok und unklar.
  const heute = () => amTag("status = 'ok' OR (" + UNKLAR_SQL + ')');
  const fehlversuche = () => amTag("status = 'fehler' AND fehler NOT LIKE 'Zustellung unklar:%'");
  // Sendungen zwischen Pruefung und INSERT (S2): sonst ueberschreiten N gleichzeitige die Grenze um N-1.
  let unterwegs = 0;
  // Gesendet (oder unklar), aber ohne Zeile, weil der INSERT scheiterte: Schluessel -> Absagetext.
  // ponytail: nur im Speicher; nach einem Neustart kennt niemand den Schluessel mehr und er sendet erneut.
  const ohneZeile = new Map();
  // Dasselbe je Beleg (R24): ein neu geoeffneter Dialog hat einen neuen Schluessel, darf aber nicht noch
  // einmal an den Kunden senden. 'art\0bezug' -> { art, bezug, zeit }; nur scharfer Versand (R17), letzte() zeigt ihn
  // nur fuer Belege (Erinnerung und Mahnung teilen den bezug mit der Rechnung, sind aber kein Versand der Rechnung).
  const ohneZeileBeleg = new Map();
  const belegSchluessel = (art, bezug) => (bezug != null && art !== 'test' ? art + '\0' + bezug : null);

  function status() {
    const m = cfg();
    const grund = grundVon(m);
    return { bereit: !grund, grund, umgeleitet: !!m.umleitenAn, umleiten_an: m.umleitenAn || null, heute: heute(), grenze: grenzeVon(m) };
  }

  // NULL trifft in SQL nie, deshalb ohne Fallunterscheidung.
  const zugestellt = (lauf_id, nr, schluessel) => db.prepare(
    "SELECT id, test FROM versand WHERE status = 'ok' AND ((lauf_id = ? AND nr = ?) OR schluessel = ?) ORDER BY id LIMIT 1",
  ).get(lauf_id, nr, schluessel);
  const offen = (lauf_id, nr, schluessel) => db.prepare(
    'SELECT id FROM versand WHERE ' + UNKLAR_SQL + ' AND ((lauf_id = ? AND nr = ?) OR schluessel = ?) LIMIT 1',
  ).get(lauf_id, nr, schluessel);
  const sperrenVon = (lauf_id, nr, schluessel) => [lauf_id != null && 'l:' + lauf_id + ':' + nr, schluessel != null && 's:' + schluessel].filter(Boolean);

  // Gab es diesen Versand (Schluessel bzw. Lauf) schon? Antwort "doppelt" oder 409, sonst undefined.
  // Laeuft vor allem anderen — auch vor dem Druck in sendeBeleg, sonst bekaeme eine Wiederholung 422/409 statt doppelt.
  function schonVersucht(lauf_id, nr, schluessel) {
    const da = zugestellt(lauf_id, nr, schluessel);
    // R9: auch eine Testzeile (test=1) bleibt doppelt — Dialog-Schluessel sind je Oeffnen neu, Flow-Schluessel je Lauf.
    if (da) return { id: da.id, status: 'ok', test: !!da.test, doppelt: true };
    // R7: vielleicht schon zugestellt — kein zweiter Versuch, bis jemand unter Gesendet nachgesehen hat.
    if (offen(lauf_id, nr, schluessel)) throw mitStatus(409, UNKLAR_409);
    const sperren = sperrenVon(lauf_id, nr, schluessel);
    const ohne = sperren.map((k) => ohneZeile.get(k)).find(Boolean);
    if (ohne) throw mitStatus(409, ohne);
    if (sperren.some((k) => imFlug.has(k))) throw mitStatus(409, 'Versand läuft bereits');
    return undefined;
  }

  async function sende({ an, betreff, text = '', anhaenge = [] } = {}, { art, bezug = null, lauf_id = null, nr = null, schluessel = null } = {}) {
    if (!Array.isArray(an) || !an.length) throw fehler('Empfaenger: Liste mit mindestens einer Adresse erwartet');
    for (const a of an) pruefeAdresse(a, 'Empfaenger');
    betreff = pruefeKopf(betreff, 'Betreff');
    // Vor dem Senden pruefen, was der INSERT ablehnen wuerde: sonst ginge die Mail raus ohne Zeile.
    if (!ARTEN.includes(art)) throw fehler('art: unbekannt');
    if ((lauf_id != null || nr != null) && !(Number.isInteger(lauf_id) && Number.isInteger(nr))) throw fehler('lauf_id und nr: beide ganze Zahlen');
    if (schluessel != null && (typeof schluessel !== 'string' || !schluessel)) throw fehler('schluessel: Text erwartet');

    const vorher = schonVersucht(lauf_id, nr, schluessel);
    if (vorher) return vorher;
    const sperren = sperrenVon(lauf_id, nr, schluessel);

    const m = cfg();
    const grund = grundVon(m);
    if (grund) throw mitStatus(503, 'Versand nicht bereit: ' + grund);
    const beleg = belegSchluessel(art, bezug);
    if (!m.umleitenAn && beleg && ohneZeileBeleg.has(beleg)) throw mitStatus(409, 'Bereits gesendet, Protokolleintrag fehlt — erst unter Gesendet prüfen');
    if (heute() + unterwegs >= grenzeVon(m)) throw mitStatus(429, 'Tagesgrenze erreicht (' + grenzeVon(m) + ' Mails)');
    if (fehlversuche() >= FEHLVERSUCHE_TAG) {
      // Nur der Name der Variable (R2), nie ihr Wert.
      throw mitStatus(429, 'Heute schon ' + FEHLVERSUCHE_TAG + ' Fehlversuche — Versand bis Mitternacht gesperrt, damit der Anbieter das Konto nicht sperrt. '
        + 'Zugang prüfen: mail.smtp in config.json und das Passwort in der Umgebungsvariable ' + envName(m) + '.');
    }

    // Testmodus: RCPT TO und To: nur an die Umleitung, Original steht im Betreff und in an_original.
    const test = !!m.umleitenAn;
    const anOriginal = test ? an.join(', ') : null;
    const empf = test ? [m.umleitenAn] : an;
    const subj = test ? '[TEST an ' + anOriginal + '] ' + betreff : betreff;
    const von = m.absender.adresse;
    const lokal = crypto.randomBytes(12).toString('hex');
    const datum = jetzt();
    const roh = baueMime({ von: { name: m.absender.name, adresse: von }, an: empf, betreff: subj, text, anhaenge, messageId: lokal, datum });
    const passwort = env[envName(m)];
    // Laengstes zuerst (wie in smtpSende), sonst zerschnitte das kuerzere das laengere.
    const geheim = [Buffer.from('\0' + m.smtp.benutzer + '\0' + passwort).toString('base64'), Buffer.from(passwort).toString('base64'), passwort];

    for (const k of sperren) imFlug.add(k);
    unterwegs++;
    try {
      let fehlerText = null, unklar = false, emlPfad = null, warnung = null;
      try {
        await transporte[transportVon(m)]({ ...m.smtp, passwort, von, an: empf, daten: roh });
      } catch (e) {
        const msg = String((e && e.message) || 'Versand fehlgeschlagen'), smtp = e && e.smtp ? String(e.smtp) : '';
        fehlerText = geheim.reduce((t, g) => t.split(g).join('***'), msg + (smtp && !msg.includes(smtp) ? ' (' + smtp + ')' : ''));
        // Nach dem letzten "." ohne Antwort: vielleicht zugestellt. Kein Wiederholen von selbst.
        if (e && e.unklar) { unklar = true; fehlerText = 'Zustellung unklar: ' + fehlerText; }
      }
      const ok = !fehlerText, halten = ok || unklar;
      if (halten) {
        // Abschrift atomar, auch bei unklarer Zustellung (was ging vielleicht raus?); scheitert sie,
        // ist die Mail trotzdem raus und bekommt ihre Zeile, die Antwort traegt eine Warnung.
        const ziel = path.join(versandOrdner, datum.toISOString().slice(0, 10) + '-' + lokal + '.eml'), tmp = ziel + '.tmp';
        try {
          fs.mkdirSync(versandOrdner, { recursive: true });
          fs.writeFileSync(tmp, roh);
          fs.renameSync(tmp, ziel);
          emlPfad = ziel;
        } catch (e) {
          console.error('[mail] .eml nicht geschrieben: ' + e.message);
          warnung = 'Abschrift (.eml) nicht gespeichert, Details im Serverprotokoll.';
          try { fs.rmSync(tmp, { force: true }); } catch { /* nichts zu raeumen */ }
        }
      }
      // Klare Fehlzeilen tragen keinen Schluessel: sonst sperrte der UNIQUE-Index den naechsten Versuch.
      // Unklare behalten ihn (R7), damit der naechste Versuch oben mit 409 stehen bleibt.
      const messageId = lokal + '@' + von.slice(von.lastIndexOf('@') + 1);
      const antwortVon = (id) => (ok ? { id, status: 'ok', test } : { id, status: 'fehler', fehler: fehlerText, test, ...(unklar && { unklar: true }) });
      let r;
      try {
        r = db.prepare(`INSERT INTO versand (zeit, art, bezug, an, an_original, betreff, status, fehler, message_id, eml_pfad, test, lauf_id, nr, schluessel)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(datum.toISOString(), art, bezug == null ? null : String(bezug), empf.join(', '), anOriginal,
          subj, ok ? 'ok' : 'fehler', fehlerText, messageId, emlPfad, test ? 1 : 0,
          halten ? lauf_id : null, halten ? nr : null, halten ? schluessel : null);
      } catch (e) {
        // Gleichzeitiger Versand aus einem zweiten Prozess (siehe imFlug).
        const vorh = /UNIQUE/.test(e.message) && zugestellt(lauf_id, nr, schluessel);
        if (vorh) return { id: vorh.id, status: 'ok', test: !!vorh.test, doppelt: true };
        if (!halten) throw e;
        // Die Mail ist raus (oder vielleicht raus), nur die Zeile fehlt: nie "nicht gesendet" melden,
        // sonst sendet der naechste Klick sie noch einmal. Schluessel im Speicher sperren, alles ins Protokoll.
        console.error('[mail] Versand ohne Protokolleintrag: ' + JSON.stringify({ message_id: messageId, an: empf.join(', '), art, bezug, eml: emlPfad,
          zustellung: ok ? 'ok' : 'unklar' }), e);
        for (const k of sperren) ohneZeile.set(k, ok ? 'Mail wurde bereits gesendet — Protokolleintrag fehlt, Details im Serverprotokoll' : UNKLAR_409);
        if (ok && !test && beleg) ohneZeileBeleg.set(beleg, { art, bezug: String(bezug), zeit: datum.toISOString() });
        warnung = ['Protokolleintrag fehlt (Details im Serverprotokoll) — nicht erneut senden.', warnung].filter(Boolean).join(' ');
        return { ...antwortVon(null), warnung };
      }
      return { ...antwortVon(Number(r.lastInsertRowid)), ...(warnung && { warnung }) };
    } finally {
      for (const k of sperren) imFlug.delete(k);
      unterwegs--;
    }
  }

  // C11c (P6): ein Mensch hat unter Gesendet nachgesehen. Nur eine unklare Zeile; sonst 409.
  // gesendet: Zeile gilt als zugestellt (Schluessel bleibt, ein Wiederholen ist dann "doppelt").
  // nicht_gesendet: bleibt Fehler, aber ohne Schluessel/Lauf — der naechste Versuch ist frei.
  function klaere(versandId, ergebnis) {
    if (ergebnis !== 'gesendet' && ergebnis !== 'nicht_gesendet') throw mitStatus(400, "ergebnis: 'gesendet' oder 'nicht_gesendet' erwartet");
    const z = db.prepare('SELECT id, fehler, schluessel, lauf_id, nr FROM versand WHERE id = ? AND ' + UNKLAR_SQL).get(versandId);
    if (!z) throw mitStatus(409, 'Versand ist nicht unklar');
    if (ergebnis === 'gesendet') {
      db.prepare("UPDATE versand SET status = 'ok', fehler = NULL WHERE id = ?").run(z.id);
    } else {
      const grund = z.fehler.replace(/^Zustellung unklar:\s*/, '');
      db.prepare("UPDATE versand SET fehler = ?, schluessel = NULL, lauf_id = NULL, nr = NULL WHERE id = ?").run(grund + ' (als nicht zugestellt bestätigt)', z.id);
      for (const k of sperrenVon(z.lauf_id, z.nr, z.schluessel)) ohneZeile.delete(k);
    }
    return { id: z.id, status: ergebnis === 'gesendet' ? 'ok' : 'fehler' };
  }

  const verlauf = (bezug) => db.prepare('SELECT id, zeit, art, an, an_original, status, fehler, test FROM versand WHERE bezug = ? ORDER BY zeit DESC, id DESC')
    .all(String(bezug)).map((z) => ({ ...z, test: !!z.test }));

  // Letzter scharfer Versand je Bezug, der vielleicht beim Kunden ist (Marke "gesendet 28.10." in Listen):
  // zugestellt, oder Zustellung unklar (unklar: true), wenn danach keine ok-Zeile kam (I1) — sonst saehe der
  // Beleg nach geschlossenem Dialog ungesendet aus. Testmodus zaehlt nicht (R17); er steht nur im Verlauf.
  // Nur Rechnung und Angebot: eine Erinnerung zur Rechnung (bezug = Rechnungsnummer) setzt keine Versandmarke.
  function letzte(bezuege) {
    if (!Array.isArray(bezuege) || !bezuege.length) return {};
    const je = new Map();
    for (const z of db.prepare("SELECT bezug, zeit, status FROM versand WHERE test = 0 AND art IN ('rechnung', 'angebot') AND (status = 'ok' OR (" + UNKLAR_SQL + ')) AND bezug IN (SELECT value FROM json_each(?)) ORDER BY zeit, id')
      .all(JSON.stringify(bezuege.map(String)))) je.set(z.bezug, { zeit: z.zeit, test: false, ...(z.status !== 'ok' && { unklar: true }) });
    // Gesendet ohne Zeile (R24): sonst wirkte der Beleg ungesendet und wuerde noch einmal verschickt.
    const gesucht = new Set(bezuege.map(String));
    for (const v of ohneZeileBeleg.values()) {
      if (Object.hasOwn(BELEG_RE, v.art) && gesucht.has(v.bezug) && !(je.has(v.bezug) && je.get(v.bezug).zeit >= v.zeit)) je.set(v.bezug, { zeit: v.zeit, test: false });
    }
    return Object.fromEntries(je);
  }

  function pruefeBeleg(art, nr) {
    if (!Object.hasOwn(BELEG_RE, art)) throw fehler("art: 'rechnung' oder 'angebot'");
    if (typeof nr !== 'string' || !BELEG_RE[art].test(nr)) throw fehler('nr: keine gueltige Belegnummer');
  }

  // Empfaenger: erster Ansprechpartner mit Mail (kleinste id), sonst die Mail des Kontakts, sonst keiner.
  // Angebot an einen Lead ohne Kunde (C12): die Mail des Leads.
  function empfaengerVon(kid, leadId) {
    if (!Number.isInteger(kid) && Number.isInteger(leadId)) {
      const l = db.prepare("SELECT TRIM(email) email, TRIM(COALESCE(vorname, '') || ' ' || COALESCE(nachname, '')) name FROM leads WHERE id = ?").get(leadId);
      return { an: l && l.email ? [l.email] : [], name: l ? l.name : '' };
    }
    if (!Number.isInteger(kid)) return { an: [], name: '' };
    const a = db.prepare("SELECT name, TRIM(email) email FROM ansprechpartner WHERE kontakt_id = ? AND TRIM(email) <> '' ORDER BY id LIMIT 1").get(kid);
    if (a) return { an: [a.email], name: a.name };
    const k = db.prepare('SELECT TRIM(email) email FROM kontakte WHERE id = ?').get(kid);
    return { an: k && k.email ? [k.email] : [], name: '' };
  }

  // Liegt das Rechnungs-PDF schon vor, wird es genommen (die Abschrift aendert sich nie); sonst gedruckt.
  async function pdfAnhang(art, beleg) {
    const a = { name: (art === 'rechnung' ? 'Rechnung-' : 'Angebot-') + beleg.nr + '.pdf', typ: 'application/pdf' };
    try {
      const da = art === 'rechnung' && beleg.pdf_pfad && fs.existsSync(beleg.pdf_pfad) ? beleg.pdf_pfad : null;
      return { ...a, ok: true, daten: fs.readFileSync(da || (await pdfFn(art, beleg.nr)).pdf) };
    } catch (e) {
      // Die Druckfehler aus rechnung.js/angebot.js tragen einen sicheren Text. Datei- und
      // Systemfehler (code/path) nennen lokale Pfade: die nur ins Protokoll.
      if (!e || e.code || e.path || !e.message) {
        console.error('Mail: PDF ' + beleg.nr + ':', e);
        return { ...a, ok: false, grund: 'PDF konnte nicht gelesen werden, Details im Serverprotokoll.' };
      }
      return { ...a, ok: false, grund: String(e.message) };
    }
  }

  function xmlAnhang(inv) {
    const a = { name: 'Rechnung-' + inv.nr + '.xml', typ: 'application/xml' };
    try {
      return { ...a, ok: true, daten: Buffer.from(xmlFn(inv), 'utf8') };
    } catch (e) {
      // Fehlende Pflichtangaben sind kein Serverfehler: der Anhang faellt weg, der Grund nennt sie.
      if (!e || !e.fehlt) throw e;
      return { ...a, ok: false, grund: e.message };
    }
  }

  // Nachricht zu einem Beleg; anhaenge tragen daten (Buffer) nur bei ok.
  // vorlage: welche Vorlage Betreff und Text liefert (nachfassen nimmt das Angebots-PDF mit der Nachfassen-Vorlage).
  async function belegNachricht(art, nr, vorlage = art) {
    pruefeBeleg(art, nr);
    const rechnung = require('./rechnung');
    const beleg = (art === 'rechnung' ? rechnung : require('./angebot')).lade(db, nr);
    if (!beleg) throw mitStatus(404, (art === 'rechnung' ? 'Rechnung' : 'Angebot') + ' nicht gefunden.');
    // R12: eine stornierte Rechnung geht nicht mehr raus — vor Druck und Versand.
    if (art === 'rechnung' && beleg.status === 'storniert') throw mitStatus(409, 'Rechnung ist storniert');
    const { an, name } = empfaengerVon(beleg.kontakt_id, beleg.lead_id);
    const m = cfg();
    const werte = {
      nr: beleg.nr, datum: rechnung.datum(beleg.erstellt_am), brutto: rechnung.eur(beleg.brutto_eur),
      // Wie auf dem Dokument: Tag der Faelligkeit mittags, damit keine Zeitzone ihn verschiebt.
      faellig: art === 'rechnung' ? rechnung.datum(rechnung.faelligAm(beleg) + 'T12:00:00') : '',
      gueltig: art === 'angebot' ? rechnung.datum(beleg.gueltig_bis) : '',
      anrede: name ? 'Guten Tag ' + name + ',' : 'Guten Tag,',
      absender: (m.absender && m.absender.name) || (beleg.aussteller && beleg.aussteller.name) || '',
    };
    // Gespeicherte Vorlage (Einstellungen, geprueft beim Speichern) vor dem Standard — je Feld,
    // und nur nicht-leere Texte: von Hand eingetragenes null ergaebe sonst den Betreff „null“.
    // Die Stornorechnung hat einen eigenen Text (I2): keine Zahlungsfrist, nennt die aufgehobene Rechnung;
    // die Rechnungsvorlage gilt fuer sie nicht. storno_von ist eine Rechnungsnummer (NUMMER_RE), keine Platzhalter.
    const g = (m.vorlagen && m.vorlagen[vorlage]) || {};
    const feld = (k) => (typeof g[k] === 'string' && g[k].trim() ? g[k] : STANDARD_VORLAGEN[vorlage][k]);
    const v = art === 'rechnung' && beleg.storno_von ? stornoVorlage(String(beleg.storno_von)) : { betreff: feld('betreff'), text: feld('text') };
    const anhaenge = [await pdfAnhang(art, beleg)];
    if (art === 'rechnung') anhaenge.push(xmlAnhang(beleg));
    return { an, betreff: fuelle(v.betreff, werte), text: fuelle(v.text, werte), anhaenge };
  }

  const ohneDaten = (n) => ({ ...n, anhaenge: n.anhaenge.map(({ daten, ...a }) => a) });

  // Eingaben aus dem Dialog, geprueft bevor gedruckt oder gesendet wird.
  function pruefeSenden(d) {
    pruefeBeleg(d.art, d.nr);
    if (!Array.isArray(d.an) || !d.an.length || d.an.length > 5) throw fehler('an: 1 bis 5 Adressen');
    // Umschlag-Pruefung (nur ASCII): der Transport lehnte sonst ab und es zaehlte als Fehlversuch (M2).
    for (const a of d.an) pruefeUmschlag(a, 'Empfaenger');
    if (typeof d.betreff !== 'string' || d.betreff.length > 200) throw fehler('Betreff: Text bis 200 Zeichen');
    pruefeKopf(d.betreff, 'Betreff');
    if (typeof d.text !== 'string' || d.text.length > 4000) throw fehler('Text: bis 4000 Zeichen');
    if (typeof d.schluessel !== 'string' || !SCHLUESSEL_RE.test(d.schluessel)) throw fehler('schluessel: 8 bis 64 Zeichen A-Z a-z 0-9 _ -');
  }

  async function sendeBeleg(d) {
    pruefeSenden(d);
    // Wiederholung (gleicher Schluessel) vor Druck, R10 und R12 beantworten; sende() prueft danach noch einmal.
    const vorher = schonVersucht(null, null, d.schluessel);
    if (vorher) return vorher;
    const n = await belegNachricht(d.art, d.nr);
    // R10: ohne PDF kein Beleg-Versand; die E-Rechnung bleibt freiwillig.
    const pdf = n.anhaenge.find((a) => a.typ === 'application/pdf');
    if (!pdf || !pdf.ok) throw mitStatus(422, 'PDF fehlt: ' + (pdf ? pdf.grund : 'kein Anhang'));
    const anhaenge = n.anhaenge.filter((a) => a.ok).map(({ name, typ, daten }) => ({ name, typ, daten }));
    const r = await sende({ an: d.an, betreff: d.betreff, text: d.text, anhaenge }, { art: d.art, bezug: d.nr, schluessel: d.schluessel });
    // C12: scharf versendetes Angebot fuehrt einen Lead mit Kundenbezug zusammen (Testmodus nie).
    // Eigene kurze Transaktion nach dem await. Die Mail ist raus: ein Fehler hier darf nicht als
    // Absage zurueckgehen, sonst sendet der naechste Klick noch einmal.
    if (r.status === 'ok' && !r.test && d.art === 'angebot') {
      try { require('./leads').nachVersand(db, d.nr); } catch (e) {
        console.error('Mail: Lead nach Versand ' + d.nr + ':', e);
        // Der Dialog zeigt warnung (C11a SF5); eine vorhandene bleibt davor stehen.
        return { ...r, warnung: [r.warnung, 'Lead nicht zusammengeführt — siehe Serverprotokoll.'].filter(Boolean).join(' ') };
      }
    }
    return r;
  }

  function sendeTest() {
    const m = cfg();
    const grund = grundVon(m);
    if (grund) throw mitStatus(503, 'Versand nicht bereit: ' + grund);
    return sende({ an: [m.umleitenAn || m.absender.adresse], betreff: 'c2invoice Testmail',
      text: 'Diese Testmail bestätigt, dass c2invoice über das eingetragene Konto senden kann.' }, { art: 'test', bezug: 'test' });
  }

  // Vorschau traegt eine unklare letzte Zustellung (Zeitpunkt) mit: der Dialog sagt es, Senden bleibt moeglich (R7).
  async function vorschau(d) {
    const n = ohneDaten(await belegNachricht(d.art, d.nr));
    const l = letzte([d.nr])[d.nr];
    return l && l.unklar ? { ...n, unklar: l.zeit } : n;
  }
  const POST = { '/api/mail/test': () => sendeTest(), '/api/mail/vorschau': vorschau, '/api/mail/senden': sendeBeleg };

  function routen(req, res, p, u, { sendJson, leseKoerper }) {
    if (req.method === 'POST' && Object.hasOwn(POST, p)) {
      leseKoerper(req, (fehlerText, roh) => {
        if (fehlerText) return sendJson(res, { error: fehlerText }, 400);
        const d = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {};
        antwort(res, sendJson, () => POST[p](d));
      });
      return true;
    }
    if (req.method !== 'GET') return false;
    if (p === '/api/mail/status') { antwort(res, sendJson, status); return true; }
    if (p === '/api/mail/verlauf') {
      antwort(res, sendJson, () => {
        const b = u.searchParams.get('bezug');
        if (!b || b.length > 64) throw fehler('bezug fehlt');
        return { verlauf: verlauf(b) };
      });
      return true;
    }
    if (p === '/api/mail/letzte') {
      antwort(res, sendJson, () => ({ letzte: letzte(String(u.searchParams.get('bezug') || '').split(',').filter(Boolean).slice(0, 1000)) }));
      return true;
    }
    return false;
  }

  return { status, sende, klaere, verlauf, letzte, belegNachricht, empfaengerVon, routen };
}

module.exports = { baueMime, pruefeKopf, pruefeUmschlag, antwort, EMAIL_RE, smtpSende, erzeuge, STANDARD_VORLAGEN, PLATZHALTER, PLATZHALTER_JE, fuelle };
