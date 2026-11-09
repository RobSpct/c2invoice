'use strict';
// C11a Versand per SMTP (design/cira/C11-FLOWS.md): Geheimnisfilter, Tabelle versand, MIME, SMTP.
const assert = require('node:assert');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = ({ dbmod, openDbs, configGeschuetzt }) => {
  const neueDb = () => { const db = dbmod.open(':memory:'); openDbs.push(db); return db; };

  function kindUmgebung() {
    const { kindUmgebung: ku } = require('../../claude');
    assert.deepStrictEqual(ku({ C2I_SMTP_PASSWORT: 'x', SMTP_PASS: 'y', PATH: 'p' }), { PATH: 'p' });
  }

  function tabelleVersand() {
    const db = neueDb();
    const ein = db.prepare("INSERT INTO versand (zeit, art, status, lauf_id, nr) VALUES ('2026-01-01', 'rechnung', 'ok', ?, ?)");
    ein.run(1, 1);
    assert.throws(() => ein.run(1, 1), /UNIQUE/);
    ein.run(null, null); ein.run(null, null);
    const sk = db.prepare("INSERT INTO versand (zeit, art, status, schluessel) VALUES ('2026-01-01', 'mahnung1', 'ok', ?)");
    sk.run('k'); assert.throws(() => sk.run('k'), /UNIQUE/);
    assert.throws(() => db.prepare("INSERT INTO versand (zeit, art, status) VALUES ('z', 'rechnung', 'kaputt')").run(), /CHECK/);
    assert.throws(() => db.prepare("INSERT INTO versand (zeit, art, status) VALUES ('z', 'spam', 'ok')").run(), /CHECK/);
  }

  // Mini-Zerleger: Kopf (entfaltet) und Rumpf; Teile einer multipart-Nachricht.
  const CRLF2 = '\r\n\r\n';
  const kopfVon = (roh) => {
    const i = roh.indexOf(CRLF2);
    return { kopf: roh.slice(0, i).replace(/\r\n[ \t]+/g, ' '), roh: roh.slice(0, i), rumpf: roh.slice(i + 4) };
  };
  const teile = (roh) => {
    const { kopf, rumpf } = kopfVon(roh);
    const grenze = /boundary="([^"]+)"/.exec(kopf)[1];
    return rumpf.split('--' + grenze).slice(1, -1).map((t) => {
      const p = kopfVon(t.replace(/^\r\n/, ''));
      return { kopf: p.kopf, rumpf: p.rumpf.replace(/\r\n$/, '') };
    });
  };
  // Kodierwoerter dekodieren; Leerraum zwischen zwei Kodierwoertern faellt weg (RFC 2047).
  const entB = (s) => s.replace(/(\?=) (=\?UTF-8\?B\?)/g, '$1$2')
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
  const basis = {
    von: { name: 'Büro Müller', adresse: 'a@example.org' }, an: ['kunde@example.org'], betreff: 'Rechnung für Müller',
    text: 'Guten Tag,\r\nanbei die Rechnung. Größe: 5 €.\r\n', anhaenge: [], messageId: 'abc123', datum: new Date('2026-10-28T10:00:00Z'),
  };

  function mimeKopf() {
    const { baueMime } = require('../../mail');
    const roh = baueMime(basis);
    const { kopf } = kopfVon(roh);
    assert.match(kopf, /Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    assert.strictEqual(entB(/Subject: (.*?)(?:\r\n|$)/.exec(kopf)[1]), 'Rechnung für Müller');
    assert.match(kopf, /From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <a@example\.org>/);
    assert.strictEqual(entB(/From: (.*) <a@/.exec(kopf)[1]), 'Büro Müller');
    assert.match(kopf, /To: kunde@example\.org/);
    assert.match(kopf, /MIME-Version: 1\.0/);
    assert.match(kopf, /Date: Wed, 28 Oct 2026 10:00:00 \+0000/);
    assert.match(kopf, /Message-ID: <abc123@example\.org>/);
    // langer Betreff: gefaltet, keine Zeile ueber 78 Zeichen, Rundreise stimmt
    const lang = baueMime({ ...basis, betreff: 'Müller '.repeat(30) });
    for (const z of kopfVon(lang).roh.split('\r\n')) assert.ok(z.length <= 78, 'Kopfzeile zu lang: ' + z.length);
    assert.strictEqual(entB(/Subject: (.*)/.exec(kopfVon(lang).kopf)[1]), 'Müller '.repeat(30));
    // ASCII-Name mit Sonderzeichen wird zur quoted-string
    assert.match(baueMime({ ...basis, von: { name: 'Mueller, "Co"', adresse: 'a@example.org' } }), /From: "Mueller, \\"Co\\"" <a@example\.org>\r\n/);
    // reines ASCII bleibt lesbar
    assert.match(baueMime({ ...basis, betreff: 'Rechnung 2026-0001', von: { name: '', adresse: 'a@example.org' } }), /Subject: Rechnung 2026-0001\r\n/);
  }

  function mimeAnhaenge() {
    const { baueMime } = require('../../mail');
    const pdf = require('node:crypto').randomBytes(3000);
    const xml = Buffer.from('<?xml version="1.0"?><a>ü</a>', 'utf8');
    const roh = baueMime({
      ...basis, anhaenge: [
        { name: 'Rechnung 2026/0001 ä.pdf', typ: 'application/pdf', daten: pdf },
        { name: 'Rechnung-2026-0001.xml', typ: 'application/xml', daten: xml }],
    });
    const t = teile(roh);
    assert.strictEqual(t.length, 3);
    assert.match(t[0].kopf, /Content-Type: text\/plain; charset=utf-8/);
    assert.match(t[0].kopf, /Content-Transfer-Encoding: quoted-printable/);
    for (const z of t[0].rumpf.split('\r\n')) assert.ok(z.length <= 76);
    assert.ok(t[0].rumpf.includes('Gr=C3=B6=C3=9Fe'));
    // lange Zeile mit Umlauten: weiche Umbrueche, Rundreise ohne Verlust
    // dazu: Leerraum am Zeilenende (muss kodiert sein) und ein woertliches "=41" (muss =3D41 werden)
    const lang = 'Grüße ' + 'äö ü '.repeat(40) + 'Ende\r\nzweite Zeile\r\na =41 b \r\n\t\r\n';
    const tl = teile(baueMime({ ...basis, text: lang }))[0].rumpf;
    for (const z of tl.split('\r\n')) {
      assert.ok(z.length <= 76, 'QP-Zeile ' + z.length);
      assert.ok(!/[ \t]$/.test(z), 'QP-Zeile endet auf Leerraum: ' + JSON.stringify(z));
    }
    const dek = Buffer.from(tl.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8');
    assert.strictEqual(dek, lang);
    for (const [i, orig, name] of [[1, pdf, 'Rechnung_2026_0001__.pdf'], [2, xml, 'Rechnung-2026-0001.xml']]) {
      assert.match(t[i].kopf, /Content-Transfer-Encoding: base64/);
      assert.ok(t[i].kopf.includes('filename="' + name + '"'), t[i].kopf);
      const zeilen = t[i].rumpf.split('\r\n');
      for (const z of zeilen) assert.ok(z.length <= 76, 'base64-Zeile ' + z.length);
      assert.ok(zeilen.length > 1 || i === 2);
      assert.ok(Buffer.from(zeilen.join(''), 'base64').equals(orig));
    }
    assert.match(t[1].kopf, /Content-Type: application\/pdf/);
  }

  function mimeInjection() {
    const { baueMime, pruefeKopf } = require('../../mail');
    for (const k of [
      { betreff: 'a\r\nBcc: x@y.z' }, { an: ['k@example.org\nBcc: x@y.z'] }, { von: { name: 'a\0b', adresse: 'a@example.org' } },
      { von: { name: 'x', adresse: 'a@example.org\r\nBcc: x@y.z' } },
      { anhaenge: [{ name: 'a', typ: 'text/plain\r\nX: y', daten: Buffer.alloc(1) }] }, { an: 'kunde@example.org' }]) {
      assert.throws(() => baueMime({ ...basis, ...k }), (e) => e.status === 400);
    }
    assert.throws(() => pruefeKopf('a\rb', 'Betreff'), (e) => e.status === 400);
    assert.strictEqual(pruefeKopf('ok', 'Betreff'), 'ok');
  }

  function mimeTransportneutral() {
    const { baueMime, EMAIL_RE } = require('../../mail');
    const roh = baueMime({ ...basis, text: 'a\r\n.\r\nb\r\n' });
    assert.ok(roh.split('\r\n').includes('.'), 'Punktzeile muss unveraendert bleiben');
    assert.ok(!/^Bcc:/mi.test(roh));
    assert.ok(!/(^|[^\r])\n/.test(roh), 'nur CRLF');
    assert.ok(EMAIL_RE.test('test@example.org'));
    for (const s of ['a@b', 'a b@example.org', 'a@example.org,b@example.org', '<a@example.org>', '']) assert.ok(!EMAIL_RE.test(s), s);
  }

  // Mini-SMTP-Server: Klartext; STARTTLS ohne echtes TLS (Tests stufen mit s => s "hoch").
  // Bei AUTH PLAIN abgelehnt wiederholt er die Anmeldedaten, wie ein geschwaetziger Server.
  function smtpTestServer({ starttls = true, authOk = true, schliesseNachData = false, nurLogin = false, endeGeteilt = false } = {}) {
    const mails = [], befehle = [], socks = new Set();
    const server = net.createServer((s) => {
      socks.add(s); s.on('close', () => socks.delete(s)); s.on('error', () => {});
      const sende = (z) => s.write(z + '\r\n');
      let puffer = '', daten = null, login = 0, cur = null;
      sende('220 test.example.org ESMTP');
      s.on('data', (d) => {
        puffer += d.toString('latin1');
        for (let i; (i = puffer.indexOf('\r\n')) >= 0;) {
          const z = puffer.slice(0, i); puffer = puffer.slice(i + 2);
          if (daten) {
            if (z !== '.') { daten.push(z.startsWith('.') ? z.slice(1) : z); continue; }
            if (schliesseNachData) return s.destroy();
            mails.push({ ...cur, daten: daten.join('\r\n') + '\r\n' }); daten = null;
            if (endeGeteilt) {
              // UTF-8-Zeichen ueber zwei Pakete: 'ü' liegt auf Byte 12 und 13.
              const b = Buffer.from('250 2.0.0 Grüße\r\n');
              s.write(b.subarray(0, 13)); setTimeout(() => s.write(b.subarray(13)), 30); continue;
            }
            sende('250 2.0.0 angenommen'); continue;
          }
          befehle.push(z);
          if (login === 1) { login = 2; sende('334 UGFzc3dvcmQ6'); continue; }
          if (login === 2) { login = 0; sende(authOk ? '235 2.7.0 ok' : '535 5.7.8 abgelehnt'); continue; }
          const v = z.toUpperCase();
          if (v.startsWith('EHLO ')) {
            sende('250-test.example.org'); if (starttls) sende('250-STARTTLS');
            sende(nurLogin ? '250-AUTH LOGIN' : '250-AUTH PLAIN LOGIN'); sende('250 8BITMIME');
          } else if (v === 'STARTTLS') sende('220 2.0.0 bereit');
          else if (v === 'AUTH LOGIN') { login = 1; sende('334 VXNlcm5hbWU6'); }
          else if (v.startsWith('AUTH PLAIN ')) sende(authOk ? '235 2.7.0 ok' : '535 5.7.8 abgelehnt: ' + z.slice(11));
          else if (v.startsWith('MAIL FROM:<')) { cur = { von: z.slice(11, -1), an: [] }; sende('250 ok'); }
          else if (v.startsWith('RCPT TO:<')) { cur.an.push(z.slice(9, -1)); sende('250 ok'); }
          else if (v === 'DATA') { daten = []; sende('354 los'); }
          else if (v === 'QUIT') { sende('221 tschuess'); s.end(); }
          else sende('502 unbekannt');
        }
      });
    });
    return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({
      port: server.address().port, mails, befehle,
      schliesse: () => new Promise((fertig) => { for (const s of socks) s.destroy(); server.close(fertig); }),
    })));
  }

  const smtp = { host: 'localhost', sicher: 'starttls', benutzer: 'a@example.org', passwort: 'Geheim-Passwort-42', von: 'a@example.org', an: ['kunde@example.org'] };
  const plain = Buffer.from('\0a@example.org\0Geheim-Passwort-42').toString('base64');
  async function mitServer(opt, fn) {
    const srv = await smtpTestServer(opt);
    const t = { socks: [], hochstufen: (s) => s, verbinde: () => { const s = net.connect(srv.port, '127.0.0.1'); t.socks.push(s); return s; } };
    try { await fn(srv, t); } finally { await srv.schliesse(); }
  }
  const verben = (b) => b.map((x) => x.split(/[ :]/)[0]);

  async function smtpDurchlauf() {
    const { baueMime, smtpSende } = require('../../mail');
    const roh = baueMime({ ...basis, text: 'a\r\n.\r\n..b\r\n' });
    assert.ok(roh.split('\r\n').includes('.'));
    await mitServer({}, async (srv, t) => {
      const r = await smtpSende({ ...smtp, daten: roh }, t);
      assert.match(r.antwort, /^250 /);
      assert.deepStrictEqual(srv.mails, [{ von: 'a@example.org', an: ['kunde@example.org'], daten: roh }]);
      assert.deepStrictEqual(verben(srv.befehle), ['EHLO', 'STARTTLS', 'EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);
      assert.ok(srv.befehle.includes('AUTH PLAIN ' + plain));
      assert.ok(srv.befehle.includes('MAIL FROM:<a@example.org>'));
      assert.ok(srv.befehle.includes('RCPT TO:<kunde@example.org>'));
      assert.ok(t.socks[0].destroyed);
    });
    // sicher 'tls': kein STARTTLS, zwei Empfaenger
    await mitServer({ starttls: false }, async (srv, t) => {
      await smtpSende({ ...smtp, sicher: 'tls', an: ['kunde@example.org', 'test@example.org'], daten: roh }, t);
      assert.deepStrictEqual(verben(srv.befehle), ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'RCPT', 'DATA', 'QUIT']);
      assert.deepStrictEqual(srv.mails[0].an, ['kunde@example.org', 'test@example.org']);
      assert.strictEqual(srv.mails[0].daten, roh);
    });
  }

  async function smtpAuthLogin() {
    const { smtpSende } = require('../../mail');
    await mitServer({ nurLogin: true }, async (srv, t) => {
      await smtpSende({ ...smtp, daten: 'x\r\n' }, t);
      const i = srv.befehle.indexOf('AUTH LOGIN');
      assert.ok(i > 0);
      assert.deepStrictEqual(srv.befehle.slice(i + 1, i + 3), [Buffer.from('a@example.org').toString('base64'), Buffer.from('Geheim-Passwort-42').toString('base64')]);
      assert.strictEqual(srv.mails.length, 1);
    });
  }

  async function smtpOhneStarttls() {
    const { smtpSende } = require('../../mail');
    await mitServer({ starttls: false }, async (srv, t) => {
      await assert.rejects(smtpSende({ ...smtp, daten: 'x\r\n' }, t), (e) => e.code === 'SMTP' && /STARTTLS/.test(e.message));
      assert.strictEqual(srv.mails.length, 0);
      assert.ok(!srv.befehle.some((b) => /^AUTH/i.test(b)), srv.befehle.join('|'));
      assert.ok(t.socks[0].destroyed);
    });
  }

  async function smtpAuthAbgelehnt() {
    const { smtpSende } = require('../../mail');
    await mitServer({ authOk: false }, async (srv, t) => {
      let err;
      await assert.rejects(smtpSende({ ...smtp, daten: 'x\r\n' }, t), (e) => { err = e; return true; });
      assert.strictEqual(err.code, 'SMTP');
      assert.ok(!err.unklar, 'Ablehnung vor dem Datenende ist eindeutig');
      assert.match(err.smtp, /^535 /);
      const alles = String(err) + err.smtp + (err.stack || '');
      for (const g of ['Geheim-Passwort-42', plain]) assert.ok(!alles.includes(g), 'Geheimnis im Fehler: ' + alles);
      assert.strictEqual(srv.mails.length, 0);
      assert.ok(!srv.befehle.some((b) => b.startsWith('MAIL')));
      assert.ok(t.socks[0].destroyed);
    });
  }

  async function smtpAbbruchNachData() {
    const { smtpSende } = require('../../mail');
    await mitServer({ schliesseNachData: true }, async (srv, t) => {
      // Verbindung weg nach dem Punkt: ob der Server die Mail angenommen hat, ist offen.
      await assert.rejects(smtpSende({ ...smtp, daten: 'x\r\n' }, t), (e) => e.code === 'SMTP' && e.unklar === true && /Datenende/.test(e.message));
      assert.strictEqual(srv.mails.length, 0);
      assert.ok(t.socks[0].destroyed);
    });
  }

  async function smtpZeitgrenze() {
    const { smtpSende } = require('../../mail');
    const offen = [];
    const stumm = net.createServer((s) => offen.push(s));
    await new Promise((ok) => stumm.listen(0, '127.0.0.1', ok));
    try {
      let sock;
      const t = { zeitMs: 100, hochstufen: (s) => s, verbinde: () => (sock = net.connect(stumm.address().port, '127.0.0.1')) };
      await assert.rejects(smtpSende({ ...smtp, daten: 'x\r\n' }, t), (e) => e.code === 'SMTP' && /Zeit/.test(e.message));
      assert.ok(sock.destroyed);
    } finally {
      for (const s of offen) s.destroy();
      await new Promise((ok) => stumm.close(ok));
    }
  }

  async function smtpUmschlag() {
    const { smtpSende } = require('../../mail');
    let n = 0;
    const t = { verbinde: () => { n++; throw new Error('darf nicht verbinden'); } };
    for (const k of [{ von: 'bü@example.org' }, { an: ['kündé@example.org'] }, { an: ['k@example.org>\r\nRCPT TO:<x@example.org'] },
      { an: [] }, { an: 'kunde@example.org' }, { sicher: 'keins' }]) {
      await assert.rejects(smtpSende({ ...smtp, ...k, daten: 'x\r\n' }, t), (e) => e.status === 400, JSON.stringify(k));
    }
    assert.strictEqual(n, 0);
  }

  // Socket-Attrappe ohne TCP (sicher 'tls', also ohne STARTTLS): Befehle beantwortet sie sofort; den
  // Schreib-Callback des Datenteils gibt sie je angefangene 64 KiB erst nach msJe64k frei (langsame Leitung
  // mit fester Bandbreite), bei null nie (Leitung steht).
  function langsameLeitung(msJe64k) {
    const { Duplex } = require('node:stream');
    let daten = false;
    const s = new Duplex({
      read() {},
      write(chunk, enc, cb) {
        if (daten) {
          if (msJe64k == null) return;
          const ende = chunk.toString('latin1').endsWith('\r\n.\r\n');
          if (ende) daten = false;
          return setTimeout(() => { cb(); if (ende) s.push('250 2.0.0 angenommen\r\n'); }, Math.ceil(chunk.length / 65536) * msJe64k);
        }
        const v = chunk.toString('latin1').trim().toUpperCase();
        s.push(v.startsWith('EHLO') ? '250-test.example.org\r\n250 AUTH PLAIN\r\n' : v.startsWith('AUTH') ? '235 ok\r\n'
          : v === 'DATA' ? '354 los\r\n' : v === 'QUIT' ? '221 tschuess\r\n' : '250 ok\r\n');
        if (v === 'DATA') daten = true;
        cb();
      },
    });
    process.nextTick(() => s.push('220 test.example.org ESMTP\r\n'));
    return s;
  }

  // SF3: die Antwortfrist fuer das Datenende laeuft erst, wenn der Upload abgeflossen ist.
  async function smtpFristNachFlush() {
    const { smtpSende } = require('../../mail');
    // ~300 KB bei 60 ms je 64 KiB: Upload ~300 ms, Antwortfrist 100 ms — keine Zeitgrenze, solange es abfliesst.
    const r = await smtpSende({ ...smtp, sicher: 'tls', daten: 'y'.repeat(300000) }, { zeitMs: 100, verbinde: () => langsameLeitung(60) });
    assert.match(r.antwort, /^250 /);
    // Leitung steht: Abbruch nach zeitMs; der Punkt ist nicht raus, also eindeutig nicht zugestellt.
    const t0 = Date.now();
    await assert.rejects(smtpSende({ ...smtp, sicher: 'tls', daten: 'x\r\n' }, { zeitMs: 100, verbinde: () => langsameLeitung(null) }),
      (e) => e.code === 'SMTP' && /Zeitgrenze/.test(e.message) && !e.unklar);
    assert.ok(Date.now() - t0 < 2000);
  }

  // S3: eine Antwort ohne Zeilenende waechst nicht unbegrenzt.
  async function smtpZeileZuLang() {
    const { smtpSende } = require('../../mail');
    const { Duplex } = require('node:stream');
    let s;
    const verbinde = () => {
      s = new Duplex({ read() {}, write(c, e, cb) { cb(); } });
      process.nextTick(() => s.push('220 ' + 'x'.repeat(70000)));
      return s;
    };
    await assert.rejects(smtpSende({ ...smtp, sicher: 'tls', daten: 'x\r\n' }, { zeitMs: 3000, verbinde }),
      (e) => e.code === 'SMTP' && /Antwortzeile zu lang/.test(e.message));
    assert.ok(s.destroyed);
  }

  async function smtpUtf8Paketgrenze() {
    const { smtpSende } = require('../../mail');
    await mitServer({ endeGeteilt: true }, async (srv, t) => {
      const r = await smtpSende({ ...smtp, daten: 'x\r\n' }, t);
      assert.strictEqual(r.antwort, '250 2.0.0 Grüße');
    });
  }

  // ---- Versanddienst (Task 4): Attrappe als Transport, .eml nur im Temp-Ordner ----
  const PW = 'Geheim-Passwort-42';
  const PW64 = Buffer.from(PW).toString('base64');
  const konto = {
    smtp: { host: 'smtp.example.org', port: 465, sicher: 'tls', benutzer: 'a@example.org', passwortEnvVar: 'C2I_SMTP_PASSWORT' },
    absender: { name: 'Büro', adresse: 'a@example.org' }, transport: 'smtp', umleitenAn: '', tagesgrenze: 100,
  };
  const nachricht = { an: ['kunde@example.org'], betreff: 'Rechnung 1', text: 'Hallo' };
  // antwort(aufruf) ersetzt den Transport; aufrufe zaehlt jeden Aufruf.
  async function mitDienst(cfg, opt, fn) {
    const { erzeuge } = require('../../mail');
    const db = neueDb(), aufrufe = [];
    const ordner = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-versand-')), 'versand');
    const mailCfg = { ...konto, ...cfg };
    const zeile = (id) => db.prepare('SELECT * FROM versand WHERE id = ?').get(id);
    const dateien = () => (fs.existsSync(ordner) ? fs.readdirSync(ordner) : []);
    try {
      const d = erzeuge({
        db, mailCfg: () => mailCfg, env: { C2I_SMTP_PASSWORT: PW }, versandOrdner: ordner, jetzt: opt.jetzt, pdfFn: opt.pdfFn, xmlFn: opt.xmlFn,
        transporte: { smtp: async (a) => { aufrufe.push(a); return opt.antwort ? opt.antwort(a) : { antwort: '250 ok' }; } },
      });
      await fn({ d, db, aufrufe, ordner, zeile, dateien });
    } finally { fs.rmSync(path.dirname(ordner), { recursive: true, force: true }); }
  }

  function statusOhneKonto() {
    const { erzeuge } = require('../../mail');
    const db = neueDb();
    const st = (cfg, env = {}) => erzeuge({ db, mailCfg: () => cfg, env, transporte: { smtp: () => assert.fail('darf nicht senden') } }).status();
    for (const leer of [{}, undefined]) {
      const s = st(leer);
      assert.strictEqual(s.bereit, false);
      assert.match(s.grund, /mail\.smtp\.host/);
    }
    assert.match(st({ ...konto, smtp: { ...konto.smtp, benutzer: '' } }).grund, /mail\.smtp\.benutzer/);
    assert.match(st({ ...konto, absender: { name: 'x', adresse: '' } }).grund, /mail\.absender\.adresse/);
    assert.match(st({ ...konto, absender: { name: 'x', adresse: 'kein-at' } }).grund, /mail\.absender\.adresse/);
    assert.strictEqual(st(konto).grund, 'Umgebungsvariable C2I_SMTP_PASSWORT fehlt');
    assert.strictEqual(st(konto, { C2I_SMTP_PASSWORT: '' }).bereit, false);
    // Name ohne PASS/SECRET/TOKEN gilt nicht: sonst liesse sich jede Variable (PATH) als Passwort ausgeben.
    // M1: der Grund sagt das, statt still die Standard-Variable zu nennen — auch wenn die gesetzt ist.
    for (const env of [{ PATH: 'x' }, { PATH: 'x', C2I_SMTP_PASSWORT: PW }]) {
      const p = st({ ...konto, smtp: { ...konto.smtp, passwortEnvVar: 'PATH' } }, env);
      assert.strictEqual(p.bereit, false);
      assert.match(p.grund, /^mail\.smtp\.passwortEnvVar abgelehnt: .*PASS, SECRET oder TOKEN/);
      assert.ok(!p.grund.includes('C2I_SMTP_PASSWORT'), p.grund);
    }
    assert.strictEqual(st({ ...konto, smtp: { ...konto.smtp, passwortEnvVar: 'MEIN_SMTP_PASS' } }, { MEIN_SMTP_PASS: PW }).bereit, true);
    const s = st({ ...konto, umleitenAn: 'test@example.org' }, { C2I_SMTP_PASSWORT: PW });
    assert.deepStrictEqual(s, { bereit: true, grund: null, umgeleitet: true, heute: 0, grenze: 100 });
    assert.ok(!JSON.stringify(s).includes(PW));
    assert.strictEqual(st({ ...konto, tagesgrenze: 'viele' }, { C2I_SMTP_PASSWORT: PW }).grenze, 100);
  }

  // I3: Tippfehler in umleitenAn, sicher oder port machen das Konto nicht "bereit"; der Grund nennt das Feld.
  async function statusKonfigFelder() {
    const { erzeuge } = require('../../mail');
    const db = neueDb();
    const st = (cfg) => erzeuge({ db, mailCfg: () => cfg, env: { C2I_SMTP_PASSWORT: PW }, transporte: { smtp: () => assert.fail('darf nicht senden') } }).status();
    const mitSmtp = (s) => ({ ...konto, smtp: { ...konto.smtp, ...s } });
    for (const [cfg, feld] of [
      [{ ...konto, umleitenAn: 'kein-mail' }, /^mail\.umleitenAn /], [{ ...konto, umleitenAn: 'tëst@example.org' }, /^mail\.umleitenAn /],
      [{ ...konto, umleitenAn: 5 }, /^mail\.umleitenAn /],
      [mitSmtp({ sicher: undefined }), /^mail\.smtp\.sicher /], [mitSmtp({ sicher: 'ssl' }), /^mail\.smtp\.sicher /],
      [mitSmtp({ port: undefined }), /^mail\.smtp\.port /], [mitSmtp({ port: '465' }), /^mail\.smtp\.port /], [mitSmtp({ port: 0 }), /^mail\.smtp\.port /],
      [mitSmtp({ port: 65536 }), /^mail\.smtp\.port /], [mitSmtp({ port: 46.5 }), /^mail\.smtp\.port /]]) {
      const s = st(cfg);
      assert.strictEqual(s.bereit, false, JSON.stringify(cfg));
      assert.match(s.grund || '', feld, JSON.stringify(cfg));
    }
    for (const cfg of [konto, { ...konto, umleitenAn: 'test@example.org' }, { ...konto, umleitenAn: null }, mitSmtp({ port: 587, sicher: 'starttls' }),
      mitSmtp({ port: 1 }), mitSmtp({ port: 65535 })]) assert.strictEqual(st(cfg).bereit, true, JSON.stringify(cfg));
    // Nicht bereit heisst: 503 vor jedem Verbinden, keine Fehlzeile (zaehlt nicht zur Sperre nach 20 Fehlversuchen).
    await mitDienst({ umleitenAn: 'kein-mail' }, {}, async ({ d, db: vdb, aufrufe }) => {
      await assert.rejects(d.sende(nachricht, { art: 'rechnung', bezug: 'R-1' }), (e) => e.status === 503 && /mail\.umleitenAn/.test(e.message));
      assert.strictEqual(aufrufe.length, 0);
      assert.strictEqual(vdb.prepare('SELECT COUNT(*) n FROM versand').get().n, 0);
    });
  }

  async function transportUnbekannt() {
    await mitDienst({ transport: 'gmail-api' }, {}, async ({ d, aufrufe }) => {
      const s = d.status();
      assert.strictEqual(s.bereit, false);
      assert.strictEqual(s.grund, "Transport 'gmail-api' kommt mit Block O (OAuth)");
      await assert.rejects(d.sende(nachricht, { art: 'rechnung', bezug: 'R-1' }), (e) => e.status === 503);
      assert.strictEqual(aufrufe.length, 0);
    });
  }

  async function umleitung() {
    await mitDienst({ umleitenAn: 'test@example.org' }, {}, async ({ d, aufrufe, zeile, ordner }) => {
      const r = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1' });
      assert.strictEqual(r.status, 'ok');
      assert.strictEqual(r.test, true);
      assert.strictEqual(aufrufe.length, 1);
      const a = aufrufe[0];
      assert.deepStrictEqual(a.an, ['test@example.org']);
      assert.strictEqual(a.von, 'a@example.org');
      assert.strictEqual(a.host, 'smtp.example.org');
      assert.strictEqual(a.passwort, PW);
      assert.match(a.daten, /^To: test@example\.org\r\n/m);
      assert.match(a.daten, /^Subject: \[TEST an kunde@example\.org\] Rechnung 1\r\n/m);
      const z = zeile(r.id);
      assert.strictEqual(z.test, 1);
      assert.strictEqual(z.an, 'test@example.org');
      assert.strictEqual(z.an_original, 'kunde@example.org');
      assert.ok(z.betreff.startsWith('[TEST an kunde@example.org] '));
      assert.strictEqual(z.status, 'ok');
      assert.strictEqual(z.bezug, 'R-1');
      assert.ok(z.message_id && a.daten.includes('Message-ID: <' + z.message_id + '>'), z.message_id);
      assert.strictEqual(path.dirname(z.eml_pfad), ordner);
    });
    await mitDienst({}, {}, async ({ d, aufrufe, zeile }) => {
      const r = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1' });
      assert.strictEqual(r.test, false);
      assert.deepStrictEqual(aufrufe[0].an, ['kunde@example.org']);
      assert.match(aufrufe[0].daten, /^Subject: Rechnung 1\r\n/m);
      const z = zeile(r.id);
      assert.strictEqual(z.test, 0);
      assert.strictEqual(z.an_original, null);
      assert.strictEqual(z.betreff, 'Rechnung 1');
    });
  }

  async function idempotenz() {
    await mitDienst({}, {}, async ({ d, db, aufrufe }) => {
      const r1 = await d.sende(nachricht, { art: 'mahnung1', bezug: 'R-1', lauf_id: 1, nr: 2 });
      const r2 = await d.sende(nachricht, { art: 'mahnung1', bezug: 'R-1', lauf_id: 1, nr: 2 });
      assert.strictEqual(aufrufe.length, 1);
      assert.deepStrictEqual(r2, { id: r1.id, status: 'ok', test: false, doppelt: true });
      const s1 = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'dialog-1' });
      const s2 = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'dialog-1' });
      assert.strictEqual(aufrufe.length, 2);
      assert.strictEqual(s2.doppelt, true);
      assert.strictEqual(s2.id, s1.id);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM versand').get().n, 2);
    });
    // Nach einem Fehler darf derselbe Schluessel erneut senden (Fehlzeilen sperren nicht).
    let wurf = true;
    await mitDienst({}, { antwort: () => { if (wurf) { wurf = false; throw Object.assign(new Error('SMTP: weg'), { code: 'SMTP' }); } return { antwort: '250 ok' }; } },
      async ({ d, aufrufe }) => {
        assert.strictEqual((await d.sende(nachricht, { art: 'mahnung1', schluessel: 'm-1' })).status, 'fehler');
        const r = await d.sende(nachricht, { art: 'mahnung1', schluessel: 'm-1' });
        assert.strictEqual(r.status, 'ok');
        assert.ok(!r.doppelt);
        assert.strictEqual(aufrufe.length, 2);
      });
    // Zwei gleichzeitige Aufrufe mit demselben Schluessel: der zweite wartet nicht, er bekommt 409.
    let los;
    const tor = new Promise((ok) => { los = ok; });
    await mitDienst({}, { antwort: async () => { await tor; return { antwort: '250 ok' }; } }, async ({ d, aufrufe }) => {
      const p1 = d.sende(nachricht, { art: 'rechnung', schluessel: 'k' });
      const p2 = d.sende(nachricht, { art: 'rechnung', schluessel: 'k' }).then(() => 'gesendet', (e) => e);
      const p3 = d.sende(nachricht, { art: 'rechnung', lauf_id: 1, nr: 1, schluessel: 'k' }).then(() => 'gesendet', (e) => e);
      los();
      const [e2, e3] = await Promise.all([p2, p3]);
      assert.ok(e2.status === 409 && /läuft bereits/.test(e2.message), String(e2));
      assert.strictEqual(e3.status, 409, String(e3));
      assert.strictEqual((await p1).status, 'ok');
      assert.strictEqual((await d.sende(nachricht, { art: 'rechnung', schluessel: 'k' })).doppelt, true);
      assert.strictEqual(aufrufe.length, 1);
    });
  }

  async function tagesgrenze() {
    const jetzt = () => new Date(2026, 9, 28, 10, 0, 0);
    await mitDienst({ tagesgrenze: 2 }, { jetzt }, async ({ d, db, aufrufe }) => {
      const alt = db.prepare("INSERT INTO versand (zeit, art, status) VALUES (?, 'test', ?)");
      alt.run(new Date(2026, 9, 27, 23, 59, 0).toISOString(), 'ok'); // gestern, keine 24 h her
      alt.run(new Date(2026, 9, 28, 9, 0, 0).toISOString(), 'fehler');
      assert.strictEqual(d.status().heute, 0);
      for (let i = 0; i < 2; i++) assert.strictEqual((await d.sende(nachricht, { art: 'rechnung' })).status, 'ok');
      assert.strictEqual(d.status().heute, 2);
      await assert.rejects(d.sende(nachricht, { art: 'rechnung' }), (e) => e.status === 429 && /Tagesgrenze erreicht/.test(e.message));
      assert.strictEqual(aufrufe.length, 2);
    });
  }

  async function fehlerweg() {
    let wurf;
    await mitDienst({}, { antwort: () => { throw wurf; } }, async ({ d, zeile, dateien }) => {
      // Ein geschwaetziger Transport, der das Passwort in den Fehler schreibt: der Dienst entfernt es.
      wurf = Object.assign(new Error('SMTP: AUTH abgelehnt ' + PW), { code: 'SMTP', smtp: '535 bad ' + PW64 });
      const r = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 's' });
      assert.strictEqual(r.status, 'fehler');
      assert.ok(!r.unklar);
      const z = zeile(r.id);
      assert.strictEqual(z.status, 'fehler');
      assert.strictEqual(z.fehler, r.fehler);
      assert.match(z.fehler, /535/);
      for (const g of [PW, PW64]) assert.ok(!z.fehler.includes(g), z.fehler);
      assert.strictEqual(z.eml_pfad, null);
      assert.strictEqual(z.schluessel, null);
      wurf = { code: 'SMTP', smtp: '535 bad' };
      const r2 = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1' });
      assert.strictEqual(r2.status, 'fehler');
      assert.match(zeile(r2.id).fehler, /535 bad/);
      assert.deepStrictEqual(dateien(), []);
    });
  }

  async function zustellungUnklar() {
    const wurf = Object.assign(new Error('SMTP: Verbindung vom Server geschlossen (Datenende)'), { code: 'SMTP', unklar: true });
    await mitDienst({}, { antwort: () => { throw wurf; } }, async ({ d, zeile, dateien, aufrufe }) => {
      const r = await d.sende(nachricht, { art: 'mahnung1', bezug: 'R-1', lauf_id: 3, nr: 1 });
      assert.strictEqual(r.status, 'fehler');
      assert.strictEqual(r.unklar, true);
      assert.ok(zeile(r.id).fehler.startsWith('Zustellung unklar: '), zeile(r.id).fehler);
      assert.strictEqual(zeile(r.id).status, 'fehler');
      // SF4: gerade bei unklarer Zustellung liegt die Abschrift vor (was ging vielleicht raus?).
      assert.deepStrictEqual(dateien(), [path.basename(zeile(r.id).eml_pfad || '')]);
      // R7: unklare Zustellung behaelt den Schluessel; ein neuer Versuch sendet nicht noch einmal.
      assert.deepStrictEqual([zeile(r.id).lauf_id, zeile(r.id).nr], [3, 1]);
      await assert.rejects(d.sende(nachricht, { art: 'mahnung1', bezug: 'R-1', lauf_id: 3, nr: 1 }),
        (e) => e.status === 409 && e.message === 'Zustellung unklar — erst unter Gesendet pruefen');
      const s = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'u-1' });
      assert.strictEqual(zeile(s.id).schluessel, 'u-1');
      await assert.rejects(d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'u-1' }), (e) => e.status === 409);
      assert.strictEqual(aufrufe.length, 2);
    });
  }

  // console.error abfangen (erwartete Protokollzeilen nicht in der Ausgabe, aber pruefbar).
  async function mitProtokoll(fn) {
    const vorher = console.error, protokoll = [];
    console.error = (...a) => protokoll.push(a.map((x) => (x && x.message) || String(x)).join(' '));
    try { await fn(protokoll); } finally { console.error = vorher; }
  }

  // SF1: Mail ist raus, der INSERT scheitert — nie "nicht gesendet", kein zweiter Versand mit demselben Schluessel.
  async function protokollFehlt() {
    await mitProtokoll(async (protokoll) => {
      await mitDienst({}, {}, async ({ d, db, aufrufe }) => {
        db.exec("CREATE TRIGGER kaputt BEFORE INSERT ON versand BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
        const r = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'sf1-ok-0001' });
        assert.strictEqual(r.status, 'ok');
        assert.strictEqual(r.id, null);
        assert.match(r.warnung || '', /Protokolleintrag fehlt/);
        assert.ok(protokoll.some((z) => /message_id/.test(z) && z.includes('kunde@example.org') && z.includes('rechnung') && z.includes('R-1') && z.includes('.eml')),
          protokoll.join('\n'));
        // Auch wenn die DB wieder geht: derselbe Schluessel bekommt eine klare Absage, keine zweite Mail.
        db.exec('DROP TRIGGER kaputt');
        await assert.rejects(d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'sf1-ok-0001' }),
          (e) => e.status === 409 && /bereits gesendet/.test(e.message));
        assert.strictEqual(aufrufe.length, 1);
        assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM versand').get().n, 0);
      });
      // Unklare Zustellung ohne Zeile: bleibt unklar (R6/R7), Schluessel gesperrt.
      const unklar = Object.assign(new Error('SMTP: weg'), { code: 'SMTP', unklar: true });
      await mitDienst({}, { antwort: () => { throw unklar; } }, async ({ d, db, aufrufe }) => {
        db.exec("CREATE TRIGGER kaputt BEFORE INSERT ON versand BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
        const r = await d.sende(nachricht, { art: 'mahnung1', bezug: 'R-1', lauf_id: 9101, nr: 1 });
        assert.deepStrictEqual([r.status, r.unklar], ['fehler', true]);
        db.exec('DROP TRIGGER kaputt');
        await assert.rejects(d.sende(nachricht, { art: 'mahnung1', bezug: 'R-1', lauf_id: 9101, nr: 1 }), (e) => e.status === 409 && /unklar/.test(e.message));
        assert.strictEqual(aufrufe.length, 1);
      });
      // Klar nicht gesendet und keine Zeile: Fehler wie bisher, ein neuer Versuch ist erlaubt.
      let wurf = true;
      await mitDienst({}, { antwort: () => { if (wurf) throw Object.assign(new Error('SMTP: weg'), { code: 'SMTP' }); return { antwort: '250 ok' }; } },
        async ({ d, db, aufrufe }) => {
          db.exec("CREATE TRIGGER kaputt BEFORE INSERT ON versand BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
          await assert.rejects(d.sende(nachricht, { art: 'rechnung', schluessel: 'sf1-klar-0001' }), /Platte voll/);
          db.exec('DROP TRIGGER kaputt');
          wurf = false;
          assert.strictEqual((await d.sende(nachricht, { art: 'rechnung', schluessel: 'sf1-klar-0001' })).status, 'ok');
          assert.strictEqual(aufrufe.length, 2);
        });
    });
  }

  // R24: ohne Zeile sperrt der Versand den Beleg (nicht nur den Schluessel), und die Liste zeigt ihn als gesendet.
  async function protokollFehltBeleg() {
    await mitProtokoll(async () => {
      await mitDienst({}, {}, async ({ d, db, aufrufe }) => {
        db.exec("CREATE TRIGGER kaputt BEFORE INSERT ON versand BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
        const r = await d.sende(nachricht, { art: 'rechnung', bezug: '2026-0901', schluessel: 'r24-0001' });
        assert.deepStrictEqual([r.status, r.id], ['ok', null]);
        db.exec('DROP TRIGGER kaputt');
        // Dialog neu geoeffnet = neuer Schluessel: trotzdem keine zweite Mail an den Kunden.
        await assert.rejects(d.sende(nachricht, { art: 'rechnung', bezug: '2026-0901', schluessel: 'r24-0002' }),
          (e) => e.status === 409 && /Bereits gesendet, Protokolleintrag fehlt/.test(e.message));
        assert.strictEqual(aufrufe.length, 1);
        const l = d.letzte(['2026-0901', '2026-0902']);
        assert.deepStrictEqual(Object.keys(l), ['2026-0901']);
        assert.strictEqual(l['2026-0901'].test, false);
        // Ein anderer Beleg sendet normal.
        assert.strictEqual((await d.sende(nachricht, { art: 'rechnung', bezug: '2026-0902', schluessel: 'r24-0003' })).status, 'ok');
        assert.strictEqual(aufrufe.length, 2);
      });
      // R17: Testversand ohne Zeile setzt keine Marke und sperrt den Beleg nicht fuer den scharfen Versand.
      await mitDienst({ umleitenAn: 'test@example.org' }, {}, async ({ d, db, aufrufe }) => {
        db.exec("CREATE TRIGGER kaputt BEFORE INSERT ON versand BEGIN SELECT RAISE(ABORT, 'Platte voll'); END");
        assert.strictEqual((await d.sende(nachricht, { art: 'rechnung', bezug: '2026-0903', schluessel: 'r24-0004' })).id, null);
        db.exec('DROP TRIGGER kaputt');
        assert.deepStrictEqual(d.letzte(['2026-0903']), {});
        assert.strictEqual((await d.sende(nachricht, { art: 'rechnung', bezug: '2026-0903', schluessel: 'r24-0005' })).status, 'ok');
        assert.strictEqual(aufrufe.length, 2);
      });
    });
  }

  // SF5: scheitert die .eml-Abschrift, sagt die Antwort es (die Mail ist trotzdem raus).
  async function emlFehlerWarnung() {
    await mitProtokoll(async (protokoll) => {
      await mitDienst({}, {}, async ({ d, ordner, zeile }) => {
        fs.writeFileSync(ordner, 'besetzt'); // der Ordnername ist eine Datei: mkdir scheitert
        const r = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1' });
        assert.strictEqual(r.status, 'ok');
        assert.match(r.warnung || '', /Abschrift/);
        assert.strictEqual(zeile(r.id).eml_pfad, null);
        assert.ok(protokoll.some((z) => z.includes('.eml')), protokoll.join('\n'));
      });
    });
  }

  // SF6/S1: unklare Zustellungen zaehlen zur Tagesgrenze, klare Fehlversuche sind je Tag begrenzt (Konto-Sperre beim Anbieter).
  async function tagesgrenzeUnklar() {
    const jetzt = () => new Date(2026, 9, 28, 10, 0, 0);
    const heute = new Date(2026, 9, 28, 9, 0, 0).toISOString();
    await mitDienst({ tagesgrenze: 2 }, { jetzt }, async ({ d, db, aufrufe }) => {
      const ein = db.prepare("INSERT INTO versand (zeit, art, status, fehler) VALUES (?, 'rechnung', 'fehler', ?)");
      ein.run(heute, 'Zustellung unklar: Datenende ohne Antwort');
      ein.run(heute, 'SMTP: weg');
      assert.strictEqual(d.status().heute, 1);
      assert.strictEqual((await d.sende(nachricht, { art: 'rechnung' })).status, 'ok');
      await assert.rejects(d.sende(nachricht, { art: 'rechnung' }), (e) => e.status === 429 && /Tagesgrenze/.test(e.message));
      assert.strictEqual(aufrufe.length, 1);
    });
  }

  async function fehlversucheBegrenzt() {
    const jetzt = () => new Date(2026, 9, 28, 10, 0, 0);
    const abgelehnt = () => { throw Object.assign(new Error('SMTP: AUTH abgelehnt'), { code: 'SMTP' }); };
    await mitDienst({}, { jetzt, antwort: abgelehnt }, async ({ d, db, aufrufe }) => {
      const ein = db.prepare("INSERT INTO versand (zeit, art, status, fehler) VALUES (?, 'test', 'fehler', ?)");
      ein.run(new Date(2026, 9, 27, 23, 0, 0).toISOString(), 'SMTP: gestern');
      ein.run(new Date(2026, 9, 28, 9, 0, 0).toISOString(), 'Zustellung unklar: zaehlt zur Tagesgrenze, nicht hier');
      for (let i = 0; i < 18; i++) ein.run(new Date(2026, 9, 28, 9, 0, i).toISOString(), 'SMTP: AUTH abgelehnt');
      assert.strictEqual((await d.sende(nachricht, { art: 'test' })).status, 'fehler'); // der 19. ...
      assert.strictEqual((await d.sende(nachricht, { art: 'test' })).status, 'fehler'); // ... und 20. Versuch laufen
      // Der Text nennt die Variable des Passworts (Name, nie Wert) — das Passwort steht nicht in config.json.
      await assert.rejects(d.sende(nachricht, { art: 'test' }), (e) => e.status === 429 && /Fehlversuche/.test(e.message)
        && e.message.includes('C2I_SMTP_PASSWORT') && !e.message.includes(PW) && /Mitternacht/.test(e.message));
      const t = await anfrage(d, 'POST', '/api/mail/test', {});
      assert.ok(t.status === 429 && /Fehlversuche/.test(t.data.error), JSON.stringify(t));
      assert.strictEqual(aufrufe.length, 2);
    });
  }

  // S2: gleichzeitige Sendungen zaehlen zur Tagesgrenze, bevor ihre Zeile steht.
  async function tagesgrenzeParallel() {
    let los;
    const tor = new Promise((ok) => { los = ok; });
    await mitDienst({ tagesgrenze: 2 }, { antwort: async () => { await tor; return { antwort: '250 ok' }; } }, async ({ d, aufrufe }) => {
      const p = [1, 2, 3].map(() => d.sende(nachricht, { art: 'rechnung' }).then((r) => r.status, (e) => e.status));
      los();
      assert.deepStrictEqual(await Promise.all(p), ['ok', 'ok', 429]);
      assert.strictEqual(aufrufe.length, 2);
    });
  }

  // S4: der Chrome-Druck erbt keine Geheimnisse (SMTP-Passwort) aus der Umgebung.
  async function druckOhneGeheimnis() {
    const cp = require('node:child_process');
    const rechnung = require('../../rechnung');
    const config = require('../../config.json');
    const alt = { execFile: cp.execFile, rechnung: config.rechnung, pfad: config.rechnung && config.rechnung.chromePfad, pw: process.env.C2I_SMTP_PASSWORT };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-druck-'));
    let opt = null;
    cp.execFile = (exe, args, o, cb) => { opt = o; setImmediate(() => cb(new Error('kein Druck im Test'))); };
    process.env.C2I_SMTP_PASSWORT = PW;
    config.rechnung = config.rechnung || {};
    config.rechnung.chromePfad = process.execPath; // existiert: findeChrome nimmt ihn
    try {
      await mitProtokoll(() => assert.rejects(rechnung.druckePdf('http://127.0.0.1:1/x', path.join(tmp, 'x.pdf')), /PDF-Erzeugung fehlgeschlagen/));
      assert.ok(opt && opt.env, 'execFile ohne env');
      assert.ok(!Object.keys(opt.env).some((k) => /SMTP_PASSWORT/i.test(k)), Object.keys(opt.env).join(','));
      assert.ok(!Object.values(opt.env).includes(PW));
      assert.ok(Object.keys(opt.env).length > 0);
    } finally {
      cp.execFile = alt.execFile;
      if (alt.pw === undefined) delete process.env.C2I_SMTP_PASSWORT; else process.env.C2I_SMTP_PASSWORT = alt.pw;
      if (alt.rechnung === undefined) delete config.rechnung;
      else if (alt.pfad === undefined) delete config.rechnung.chromePfad; else config.rechnung.chromePfad = alt.pfad;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  async function emlOhnePasswort() {
    await mitDienst({}, {}, async ({ d, aufrufe, zeile, dateien }) => {
      const r = await d.sende({ ...nachricht, anhaenge: [{ name: 'R-1.pdf', typ: 'application/pdf', daten: Buffer.from('%PDF-1.4') }] }, { art: 'rechnung', bezug: 'R-1' });
      const eml = fs.readFileSync(zeile(r.id).eml_pfad, 'utf8');
      assert.strictEqual(eml, aufrufe[0].daten);
      for (const g of [PW, PW64, 'AUTH']) assert.ok(!eml.includes(g), g);
      assert.deepStrictEqual(dateien(), [path.basename(zeile(r.id).eml_pfad)]);
      assert.match(dateien()[0], /\.eml$/);
    });
  }

  async function sendePrueftVorher() {
    await mitDienst({}, {}, async ({ d, aufrufe, db }) => {
      for (const [n, m] of [[{ ...nachricht, an: 'kunde@example.org' }, { art: 'rechnung' }], [{ ...nachricht, an: [] }, { art: 'rechnung' }],
        [{ ...nachricht, betreff: 'a\r\nBcc: x@example.org' }, { art: 'rechnung' }], [nachricht, { art: 'spam' }],
        [nachricht, { art: 'rechnung', lauf_id: 1 }], [nachricht, { art: 'rechnung', schluessel: 5 }]]) {
        await assert.rejects(d.sende(n, m), (e) => e.status === 400, JSON.stringify(m));
      }
      assert.strictEqual(aufrufe.length, 0);
      assert.strictEqual(db.prepare('SELECT COUNT(*) n FROM versand').get().n, 0);
    });
  }

  async function verlaufLetzte() {
    let t = new Date(2026, 9, 28, 10, 0, 0).getTime();
    let wurf = false;
    await mitDienst({}, { jetzt: () => new Date(t += 60000), antwort: () => { if (wurf) throw Object.assign(new Error('SMTP: weg'), { code: 'SMTP' }); return { antwort: '250 ok' }; } },
      async ({ d }) => {
        const a = await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1' });
        wurf = true;
        const b = await d.sende(nachricht, { art: 'erinnerung', bezug: 'R-1' });
        wurf = false;
        await d.sende(nachricht, { art: 'angebot', bezug: 'A-1' });
        const v = d.verlauf('R-1');
        assert.deepStrictEqual(v.map((x) => x.id), [b.id, a.id]);
        assert.deepStrictEqual(Object.keys(v[0]).sort(), ['an', 'an_original', 'art', 'fehler', 'id', 'status', 'test', 'zeit']);
        assert.strictEqual(v[0].status, 'fehler');
        assert.strictEqual(v[1].test, false);
        const l = d.letzte(['R-1', 'A-1', 'X-9']);
        assert.deepStrictEqual(Object.keys(l).sort(), ['A-1', 'R-1']);
        assert.deepStrictEqual(l['R-1'], { zeit: v[1].zeit, test: false });
        assert.deepStrictEqual(d.letzte([]), {});
      });
  }

  // R17: die Marke an der Zeile zaehlt nur scharfen Versand; Testmodus steht nur im Verlauf.
  async function letzteNurScharf() {
    await mitDienst({ umleitenAn: 'test@example.org' }, {}, async ({ d }) => {
      await d.sende(nachricht, { art: 'rechnung', bezug: 'T-1' });
      assert.strictEqual(d.verlauf('T-1')[0].test, true);
      assert.deepStrictEqual(d.letzte(['T-1']), {});
    });
    await mitDienst({}, {}, async ({ d, db }) => {
      await d.sende(nachricht, { art: 'rechnung', bezug: 'R-2' });
      const scharf = d.verlauf('R-2')[0].zeit;
      // Ein spaeterer Testversand verdraengt die scharfe Marke nicht.
      db.prepare("INSERT INTO versand (zeit, art, bezug, an, status, test) VALUES ('2099-01-01T00:00:00.000Z', 'rechnung', 'R-2', 'test@example.org', 'ok', 1)").run();
      assert.deepStrictEqual(d.letzte(['R-2']), { 'R-2': { zeit: scharf, test: false } });
    });
  }

  // I1: unklare Zustellung (scharf) bleibt ausserhalb des Dialogs sichtbar; eine spaetere ok-Zeile gewinnt.
  const unklarWurf = () => { throw Object.assign(new Error('SMTP: Datenende ohne Antwort'), { code: 'SMTP', unklar: true }); };
  async function letzteUnklar() {
    let t = new Date(2026, 9, 28, 10, 0, 0).getTime(), modus = 'unklar';
    const antwort = () => (modus === 'unklar' ? unklarWurf() : modus === 'fehler' ? (() => { throw Object.assign(new Error('SMTP: weg'), { code: 'SMTP' }); })() : { antwort: '250 ok' });
    await mitDienst({}, { jetzt: () => new Date(t += 60000), antwort }, async ({ d }) => {
      await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'unklar-0001' });
      const u = d.verlauf('R-1')[0].zeit;
      assert.deepStrictEqual(d.letzte(['R-1']), { 'R-1': { zeit: u, test: false, unklar: true } });
      // Klarer Fehlversuch danach aendert nichts: unklar bleibt die letzte Aussage.
      modus = 'fehler';
      await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'fehler-0002' });
      assert.deepStrictEqual(d.letzte(['R-1']), { 'R-1': { zeit: u, test: false, unklar: true } });
      // Bewusst neu gesendet (neuer Schluessel, R7) und angenommen: die spaetere ok-Zeile gewinnt.
      modus = 'ok';
      await d.sende(nachricht, { art: 'rechnung', bezug: 'R-1', schluessel: 'neu-0003' });
      assert.deepStrictEqual(d.letzte(['R-1']), { 'R-1': { zeit: d.verlauf('R-1')[0].zeit, test: false } });
      // Erst ok, dann unklar: das Neueste ist unklar.
      await d.sende(nachricht, { art: 'rechnung', bezug: 'R-2', schluessel: 'ok-0004' });
      modus = 'unklar';
      await d.sende(nachricht, { art: 'rechnung', bezug: 'R-2', schluessel: 'unklar-0005' });
      assert.deepStrictEqual(d.letzte(['R-2']), { 'R-2': { zeit: d.verlauf('R-2')[0].zeit, test: false, unklar: true } });
    });
    // R17: unklar im Testmodus setzt keine Marke.
    await mitDienst({ umleitenAn: 'test@example.org' }, { antwort: unklarWurf }, async ({ d }) => {
      assert.strictEqual((await d.sende(nachricht, { art: 'rechnung', bezug: 'T-1' })).unklar, true);
      assert.deepStrictEqual(d.letzte(['T-1']), {});
    });
  }

  // ---- Belege per Mail (Task 5): Druck per Injektion, kein echter Chrome ----
  const AUSSTELLER = { name: 'Büro Test', anschrift: ['Weg 1', '50667 Köln'], steuernummer: '111/222/33333', email: 'a@example.org',
    telefon: '+49 221 123456', iban: 'DE89370400440532013000', land: 'DE' };
  const POS = JSON.stringify([{ bezeichnung: 'Pauschal', typ: 'pauschal', betrag_eur: 1000 }]);
  const EMPF = JSON.stringify({ name: 'Kunde GmbH', anschrift: ['Hauptstr. 1', '50667 Köln'] });
  function legeRechnungAn(db, { aussteller = AUSSTELLER, kontakt_id = null } = {}) {
    db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis, empfaenger, aussteller, positionen,
      netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, status, kontakt_id, faellig_am)
      VALUES ('2026-0007', 2026, 7, '2026-10-20T10:00:00.000Z', '2026-10-01', '2026-10-31', ?, ?, ?, 1000, 19, 190, 1190, 0, 'erstellt', ?, '2026-11-03')`)
      .run(EMPF, JSON.stringify(aussteller), POS, kontakt_id);
  }
  function legeAngebotAn(db, kontakt_id = null) {
    db.prepare(`INSERT INTO angebote (nr, jahr, laufnr, erstellt_am, gueltig_bis, empfaenger, aussteller, positionen,
      netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, status, kontakt_id)
      VALUES ('AN-2026-0003', 2026, 3, '2026-10-20T10:00:00.000Z', '2026-11-19T10:00:00.000Z', ?, ?, ?, 1000, 0, 0, 1000, 1, 'offen', ?)`)
      .run(EMPF, JSON.stringify(AUSSTELLER), POS, kontakt_id);
  }
  // Kontakt mit drei Ansprechpartnern: der erste ohne Mail, dann zwei mit — der fruehere gilt.
  function legeKontaktAn(db) {
    const kid = Number(db.prepare("INSERT INTO kontakte (firma, email, erstellt_am) VALUES ('Kunde GmbH', 'test@example.org', 'x')").run().lastInsertRowid);
    const ap = db.prepare("INSERT INTO ansprechpartner (kontakt_id, name, email, erstellt_am) VALUES (?, ?, ?, 'x')");
    ap.run(kid, 'Ohne Mail', '');
    ap.run(kid, 'Erika Muster', 'kunde@example.org');
    ap.run(kid, 'Spaeter', 'a@example.org');
    return kid;
  }
  // Druck-Attrappe: schreibt eine kleine Datei und meldet sie wie erzeugePdf.
  function druckAttrappe() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c2i-pdf-'));
    const aufrufe = [];
    const fn = async (art, nr) => {
      aufrufe.push([art, nr]);
      const pdf = path.join(tmp, nr + '.pdf');
      fs.writeFileSync(pdf, '%PDF-test ' + nr);
      return { nr, pdf };
    };
    return { fn, aufrufe, tmp, weg: () => fs.rmSync(tmp, { recursive: true, force: true }) };
  }

  async function belegRechnung() {
    const rechnung = require('../../rechnung');
    const druck = druckAttrappe();
    try {
      await mitDienst({}, { pdfFn: druck.fn, xmlFn: () => '<x/>' }, async ({ d, db }) => {
        const kid = legeKontaktAn(db);
        legeRechnungAn(db, { kontakt_id: kid });
        const n = await d.belegNachricht('rechnung', '2026-0007');
        assert.deepStrictEqual(n.an, ['kunde@example.org']);
        assert.strictEqual(n.betreff, 'Rechnung 2026-0007');
        assert.strictEqual(n.text, 'Guten Tag Erika Muster,\n\nanbei erhalten Sie die Rechnung 2026-0007 vom ' + rechnung.datum('2026-10-20T10:00:00.000Z')
          + ' über ' + rechnung.eur(1190) + ', zahlbar bis ' + rechnung.datum('2026-11-03T12:00:00') + '.\n\nViele Grüße\nBüro');
        assert.ok(n.text.includes('1.190,00 EUR'), n.text);
        assert.deepStrictEqual(n.anhaenge.map((a) => [a.name, a.typ, a.ok]),
          [['Rechnung-2026-0007.pdf', 'application/pdf', true], ['Rechnung-2026-0007.xml', 'application/xml', true]]);
        assert.strictEqual(n.anhaenge[0].daten.toString(), '%PDF-test 2026-0007');
        assert.strictEqual(n.anhaenge[1].daten.toString(), '<x/>');
        assert.deepStrictEqual(druck.aufrufe, [['rechnung', '2026-0007']]);
        // Liegt das PDF schon vor (pdf_pfad), wird nicht neu gedruckt.
        db.prepare("UPDATE invoices SET pdf_pfad = ? WHERE nr = '2026-0007'").run(path.join(druck.tmp, '2026-0007.pdf'));
        assert.strictEqual((await d.belegNachricht('rechnung', '2026-0007')).anhaenge[0].ok, true);
        assert.strictEqual(druck.aufrufe.length, 1);
        // Ohne Ansprechpartner mit Mail: Adresse des Kontakts, Anrede ohne Namen.
        db.prepare("UPDATE ansprechpartner SET email = ''").run();
        const k = await d.belegNachricht('rechnung', '2026-0007');
        assert.deepStrictEqual(k.an, ['test@example.org']);
        assert.ok(k.text.startsWith('Guten Tag,\n\n'), k.text);
        db.prepare('UPDATE invoices SET kontakt_id = NULL').run();
        assert.deepStrictEqual((await d.belegNachricht('rechnung', '2026-0007')).an, []);
        // Angebot: eigener Wortlaut, nur das PDF.
        legeAngebotAn(db, kid);
        db.prepare("UPDATE ansprechpartner SET email = 'kunde@example.org' WHERE name = 'Erika Muster'").run();
        const a = await d.belegNachricht('angebot', 'AN-2026-0003');
        assert.deepStrictEqual(a.an, ['kunde@example.org']);
        assert.strictEqual(a.betreff, 'Angebot AN-2026-0003');
        assert.strictEqual(a.text, 'Guten Tag Erika Muster,\n\nanbei erhalten Sie unser Angebot AN-2026-0003 über ' + rechnung.eur(1000)
          + ', gültig bis ' + rechnung.datum('2026-11-19T10:00:00.000Z') + '.\n\nViele Grüße\nBüro');
        assert.deepStrictEqual(a.anhaenge.map((x) => [x.name, x.ok]), [['Angebot-AN-2026-0003.pdf', true]]);
        assert.deepStrictEqual(druck.aufrufe[1], ['angebot', 'AN-2026-0003']);
        await assert.rejects(d.belegNachricht('rechnung', '2026-0099'), (e) => e.status === 404);
        await assert.rejects(d.belegNachricht('mahnung1', '2026-0007'), (e) => e.status === 400);
        await assert.rejects(d.belegNachricht('angebot', '2026-0007'), (e) => e.status === 400);
      });
    } finally { druck.weg(); }
  }

  async function belegXmlFehlt() {
    const druck = druckAttrappe();
    try {
      await mitDienst({}, { pdfFn: druck.fn }, async ({ d, db }) => {
        legeRechnungAn(db, { aussteller: { ...AUSSTELLER, email: '' } });
        const n = await d.belegNachricht('rechnung', '2026-0007');
        const x = n.anhaenge.find((a) => a.typ === 'application/xml');
        assert.strictEqual(x.ok, false);
        assert.match(x.grund, /Aussteller: E-Mail/);
        assert.ok(!x.daten);
        assert.strictEqual(n.anhaenge[0].ok, true);
      });
      // Druck scheitert: Anhang ok:false mit Grund, kein Wurf.
      await mitDienst({}, { pdfFn: async () => { throw new Error('Weder Chrome noch Edge gefunden.'); }, xmlFn: () => '<x/>' }, async ({ d, db }) => {
        legeRechnungAn(db);
        const p = (await d.belegNachricht('rechnung', '2026-0007')).anhaenge[0];
        assert.deepStrictEqual([p.ok, p.grund], [false, 'Weder Chrome noch Edge gefunden.']);
      });
    } finally { druck.weg(); }
  }

  function angebotGueltigkeit() {
    configGeschuetzt(() => {
      const config = require('../../config.json');
      const { setzeStammdaten } = require('../../server');
      const angebot = require('../../angebot');
      for (const w of [0, 366, 10.5]) assert.throws(() => setzeStammdaten({ angebotGueltigTage: w }), /Gültigkeit neuer Angebote/, String(w));
      setzeStammdaten({ angebotGueltigTage: 10 });
      assert.strictEqual(config.rechnung.angebotGueltigTage, 10);
      Object.assign(config.rechnung, { kleinunternehmer: true, aussteller: { name: 'Büro Test', anschrift: ['Weg 1', '50667 Köln'], steuernummer: '111/222/33333' } });
      const db = neueDb();
      const neu = () => angebot.erstelle(db, { empfaenger: { name: 'Kunde GmbH' }, posten: [{ bezeichnung: 'Pauschal', typ: 'pauschal', betrag_eur: 100 }] });
      // Kalendertage, nicht n x 24 h (DST-Lehre 86300bd).
      const tag = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
      const inTagen = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return tag(d); };
      const a = neu();
      assert.strictEqual(tag(new Date(a.gueltig_bis)), inTagen(10));
      // Wiederoeffnen eines abgelaufenen Angebots verlaengert um dieselbe Standard-Gueltigkeit.
      db.prepare("UPDATE angebote SET gueltig_bis = '2020-01-01T00:00:00.000Z' WHERE nr = ?").run(a.nr);
      assert.strictEqual(tag(new Date(angebot.setzeStatus(db, a.nr, 'offen').gueltig_bis)), inTagen(10));
      // Ausdruecklich angegebene Gueltigkeit schlaegt den Standard.
      assert.strictEqual(tag(new Date(angebot.erstelle(db, { empfaenger: { name: 'K' }, gueltigTage: 3,
        posten: [{ bezeichnung: 'P', typ: 'pauschal', betrag_eur: 1 }] }).gueltig_bis)), inTagen(3));
      delete config.rechnung.angebotGueltigTage;
      assert.strictEqual(tag(new Date(neu().gueltig_bis)), inTagen(30));
    });
  }

  // Ruft d.routen wie der Server; sendJson und leseKoerper als Attrappen.
  function anfrage(d, methode, pfad, koerper) {
    const { Readable } = require('node:stream');
    return new Promise((ok) => {
      const req = Readable.from(koerper === undefined ? [] : [JSON.stringify(koerper)]);
      req.method = methode; req.headers = {};
      const u = new URL('http://127.0.0.1' + pfad);
      const sendJson = (res, data, status = 200) => ok({ status, data });
      const leseKoerper = (r, fertig) => { let s = ''; r.on('data', (x) => { s += x; }); r.on('end', () => fertig(null, JSON.parse(s || '{}'))); };
      if (!d.routen(req, {}, u.pathname, u, { sendJson, leseKoerper })) ok(null);
    });
  }

  async function sendenPrueft() {
    const druck = druckAttrappe();
    const fehlt = () => { throw Object.assign(new Error('Für die E-Rechnung fehlen: Aussteller: E-Mail.'), { fehlt: ['Aussteller: E-Mail'] }); };
    const gut = { art: 'rechnung', nr: '2026-0007', an: ['kunde@example.org'], betreff: 'Rechnung 2026-0007', text: 'Hallo', schluessel: 'dialog-0001' };
    try {
      await mitDienst({}, { pdfFn: druck.fn, xmlFn: fehlt }, async ({ d, db, aufrufe, zeile }) => {
        legeRechnungAn(db);
        const sechs = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => x + '@example.org');
        // M2: Nicht-ASCII-Adressen lehnt der Transport ab (kein SMTPUTF8) — hier schon 400, kein Fehlversuch.
        for (const k of [{ an: ['a@b.c\r\nx'] }, { nr: '../x' }, { an: sechs }, { an: [] }, { an: 'kunde@example.org' }, { an: ['a\0@example.org'] },
          { an: ['kündé@example.org'] }, { an: ['kunde@exämple.org'] },
          { schluessel: undefined }, { schluessel: 'kurz' }, { schluessel: 'a/b/c/d/e' }, { art: 'mahnung1' }, { art: 'angebot' },
          { betreff: 'x'.repeat(201) }, { betreff: 'a\r\nBcc: x@example.org' }, { text: 'x'.repeat(4001) }, { text: 5 }]) {
          const r = await anfrage(d, 'POST', '/api/mail/senden', { ...gut, ...k });
          assert.strictEqual(r.status, 400, JSON.stringify(k) + ' ' + JSON.stringify(r));
        }
        assert.strictEqual(druck.aufrufe.length, 0, 'vor der Pruefung gedruckt');
        assert.strictEqual(aufrufe.length, 0);
        assert.strictEqual((await anfrage(d, 'POST', '/api/mail/senden', { ...gut, nr: '2026-0099' })).status, 404);

        // Vorschau: Inhalt ohne Bytes.
        const v = await anfrage(d, 'POST', '/api/mail/vorschau', { art: 'rechnung', nr: '2026-0007' });
        assert.strictEqual(v.status, 200);
        assert.strictEqual(v.data.betreff, 'Rechnung 2026-0007');
        assert.deepStrictEqual(v.data.anhaenge.map((a) => Object.keys(a).sort().join()), ['name,ok,typ', 'grund,name,ok,typ']);
        assert.strictEqual((await anfrage(d, 'POST', '/api/mail/vorschau', { art: 'rechnung', nr: '../x' })).status, 400);

        // Senden: nur ok-Anhaenge, Bezug ist die Nummer, derselbe Schluessel sendet nicht zweimal.
        const r = await anfrage(d, 'POST', '/api/mail/senden', gut);
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.data.status, 'ok');
        assert.strictEqual(aufrufe.length, 1);
        assert.ok(aufrufe[0].daten.includes('filename="Rechnung-2026-0007.pdf"'));
        assert.ok(!aufrufe[0].daten.includes('.xml'));
        assert.deepStrictEqual([zeile(r.data.id).art, zeile(r.data.id).bezug, zeile(r.data.id).schluessel], ['rechnung', '2026-0007', 'dialog-0001']);
        assert.strictEqual((await anfrage(d, 'POST', '/api/mail/senden', gut)).data.doppelt, true);
        assert.strictEqual(aufrufe.length, 1);

        // Lesen: Status, Verlauf, letzte.
        assert.strictEqual((await anfrage(d, 'GET', '/api/mail/status')).data.bereit, true);
        assert.deepStrictEqual((await anfrage(d, 'GET', '/api/mail/verlauf?bezug=2026-0007')).data.verlauf.map((x) => x.id), [r.data.id]);
        assert.strictEqual((await anfrage(d, 'GET', '/api/mail/verlauf')).status, 400);
        assert.deepStrictEqual(Object.keys((await anfrage(d, 'GET', '/api/mail/letzte?bezug=2026-0007,AN-2026-0001')).data.letzte), ['2026-0007']);
        assert.strictEqual(await anfrage(d, 'GET', '/api/mail/senden'), null, 'GET darf nicht senden');

        // Testmail an den Absender.
        const t = await anfrage(d, 'POST', '/api/mail/test', {});
        assert.strictEqual(t.data.status, 'ok');
        assert.deepStrictEqual(aufrufe[1].an, ['a@example.org']);
        assert.match(aufrufe[1].daten, /^Subject: c2invoice Testmail\r\n/m);
        assert.strictEqual(zeile(t.data.id).art, 'test');
      });
      // Testmail im Testmodus an die Umleitung; ein Fehlversand kommt als 200 mit status 'fehler'.
      await mitDienst({ umleitenAn: 'test@example.org' }, { antwort: () => { throw Object.assign(new Error('SMTP: weg'), { code: 'SMTP' }); } }, async ({ d, aufrufe }) => {
        const t = await anfrage(d, 'POST', '/api/mail/test', {});
        assert.deepStrictEqual(aufrufe[0].an, ['test@example.org']);
        assert.deepStrictEqual([t.status, t.data.status], [200, 'fehler']);
      });
      // Nicht bereit: 503 mit Grund, kein Versuch.
      await mitDienst({ smtp: { ...konto.smtp, host: '' } }, {}, async ({ d, aufrufe }) => {
        const t = await anfrage(d, 'POST', '/api/mail/test', {});
        assert.strictEqual(t.status, 503);
        assert.match(t.data.error, /mail\.smtp\.host/);
        assert.strictEqual(aufrufe.length, 0);
      });
    } finally { druck.weg(); }
  }

  // R10: ohne PDF kein Beleg-Versand (422); Datei-Fehler verraten keinen Pfad.
  async function pdfPflicht() {
    const gut = { art: 'rechnung', nr: '2026-0007', an: ['kunde@example.org'], betreff: 'Rechnung 2026-0007', text: 'Hallo', schluessel: 'dialog-0002' };
    const zeilen = (db) => db.prepare('SELECT COUNT(*) n FROM versand').get().n;
    await mitDienst({}, { pdfFn: async () => { throw new Error('Weder Chrome noch Edge gefunden.'); }, xmlFn: () => '<x/>' }, async ({ d, db, aufrufe }) => {
      legeRechnungAn(db);
      const r = await anfrage(d, 'POST', '/api/mail/senden', gut);
      assert.deepStrictEqual([r.status, r.data.error], [422, 'PDF fehlt: Weder Chrome noch Edge gefunden.']);
      assert.strictEqual(aufrufe.length, 0);
      assert.strictEqual(zeilen(db), 0);
      legeAngebotAn(db);
      const a = await anfrage(d, 'POST', '/api/mail/senden', { ...gut, art: 'angebot', nr: 'AN-2026-0003', schluessel: 'dialog-0004' });
      assert.deepStrictEqual([a.status, a.data.error], [422, 'PDF fehlt: Weder Chrome noch Edge gefunden.']);
      assert.strictEqual(aufrufe.length, 0);
    });
    const weg =path.join(os.tmpdir(), 'c2i-gibt-es-nicht-' + process.pid, 'geheim-pfad.pdf');
    const fehlerVorher = console.error;
    const protokoll = [];
    console.error = (...a) => protokoll.push(a.map(String).join(' '));
    try {
      await mitDienst({}, { pdfFn: async (art, nr) => ({ nr, pdf: weg }), xmlFn: () => '<x/>' }, async ({ d, db, aufrufe }) => {
        legeRechnungAn(db);
        const v = await anfrage(d, 'POST', '/api/mail/vorschau', { art: 'rechnung', nr: '2026-0007' });
        assert.strictEqual(v.data.anhaenge[0].grund, 'PDF konnte nicht gelesen werden, Details im Serverprotokoll.');
        const r = await anfrage(d, 'POST', '/api/mail/senden', gut);
        assert.strictEqual(r.status, 422);
        for (const x of [v, r]) assert.ok(!JSON.stringify(x).includes('geheim-pfad'), JSON.stringify(x));
        assert.ok(protokoll.some((z) => z.includes('geheim-pfad')), 'Details fehlen im Protokoll');
        assert.strictEqual(aufrufe.length, 0);
        assert.strictEqual(zeilen(db), 0);
      });
    } finally { console.error = fehlerVorher; }
  }

  // R12: stornierte Rechnung — 409, weder Druck noch Versand.
  async function storniertNicht() {
    const druck = druckAttrappe();
    try {
      await mitDienst({}, { pdfFn: druck.fn, xmlFn: () => '<x/>' }, async ({ d, db, aufrufe }) => {
        legeRechnungAn(db);
        db.prepare("UPDATE invoices SET status = 'storniert'").run();
        await assert.rejects(d.belegNachricht('rechnung', '2026-0007'), (e) => e.status === 409 && e.message === 'Rechnung ist storniert');
        const r = await anfrage(d, 'POST', '/api/mail/senden',
          { art: 'rechnung', nr: '2026-0007', an: ['kunde@example.org'], betreff: 'R', text: 'x', schluessel: 'dialog-0003' });
        assert.deepStrictEqual([r.status, r.data.error], [409, 'Rechnung ist storniert']);
        assert.strictEqual(druck.aufrufe.length, 0);
        assert.strictEqual(aufrufe.length, 0);
        // Die Storno-Gutschrift selbst bleibt versendbar.
        db.prepare("INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis, empfaenger, aussteller, positionen, netto_eur, ust_prozent, ust_eur, brutto_eur, kleinunternehmer, status, kontakt_id, faellig_am) SELECT '2026-0008', jahr, 8, erstellt_am, leistung_von, leistung_bis, empfaenger, aussteller, positionen, -netto_eur, ust_prozent, -ust_eur, -brutto_eur, kleinunternehmer, 'storno', kontakt_id, faellig_am FROM invoices WHERE nr = '2026-0007'").run();
        await d.belegNachricht('rechnung', '2026-0008');
      });
    } finally { druck.weg(); }
  }

  // I1: die Vorschau traegt den Unklar-Zustand; eine Wiederholung mit demselben Schluessel wird vor
  // Druck, R10 und R12 beantwortet (doppelt bzw. R7-409), nicht mit 422/409 aus dem Beleg.
  async function vorschauUnklarVorab() {
    const druck = druckAttrappe();
    let pdfKaputt = false, unklar = false, versuche = 0;
    const pdfFn = async (art, nr) => { versuche++; if (pdfKaputt) throw new Error('Weder Chrome noch Edge gefunden.'); return druck.fn(art, nr); };
    const gut = { art: 'rechnung', nr: '2026-0007', an: ['kunde@example.org'], betreff: 'Rechnung 2026-0007', text: 'Hallo', schluessel: 'dialog-0101' };
    try {
      await mitDienst({}, { pdfFn, xmlFn: () => '<x/>', antwort: () => (unklar ? unklarWurf() : { antwort: '250 ok' }) }, async ({ d, db, aufrufe }) => {
        legeRechnungAn(db);
        assert.ok(!('unklar' in (await anfrage(d, 'POST', '/api/mail/vorschau', { art: 'rechnung', nr: '2026-0007' })).data));
        const r = await anfrage(d, 'POST', '/api/mail/senden', gut);
        assert.deepStrictEqual([r.status, r.data.status], [200, 'ok']);
        // Danach scheitert der Druck bzw. die Rechnung ist storniert: dieselbe Wiederholung ist trotzdem doppelt.
        pdfKaputt = true;
        const w = await anfrage(d, 'POST', '/api/mail/senden', gut);
        assert.deepStrictEqual([w.status, w.data.doppelt, w.data.id], [200, true, r.data.id], JSON.stringify(w));
        db.prepare("UPDATE invoices SET status = 'storniert'").run();
        assert.deepStrictEqual((await anfrage(d, 'POST', '/api/mail/senden', gut)).data.doppelt, true);
        db.prepare("UPDATE invoices SET status = 'erstellt'").run();
        pdfKaputt = false;
        // Neuer Dialog, Zustellung unklar: die naechste Vorschau sagt es (Senden bleibt moeglich, R7).
        unklar = true;
        assert.strictEqual((await anfrage(d, 'POST', '/api/mail/senden', { ...gut, schluessel: 'dialog-0102' })).data.unklar, true);
        const v = await anfrage(d, 'POST', '/api/mail/vorschau', { art: 'rechnung', nr: '2026-0007' });
        assert.strictEqual(v.status, 200);
        assert.strictEqual(v.data.unklar, d.verlauf('2026-0007')[0].zeit);
        // Wiederholung des unklaren Schluessels bei kaputtem Druck: R7-409, nicht 422.
        pdfKaputt = true;
        const w2 = await anfrage(d, 'POST', '/api/mail/senden', { ...gut, schluessel: 'dialog-0102' });
        assert.deepStrictEqual([w2.status, w2.data.error], [409, 'Zustellung unklar — erst unter Gesendet pruefen']);
        // Gedruckt nur fuer die zwei Vorschauen und die zwei echten Sendungen, nie fuer eine Wiederholung.
        assert.strictEqual(versuche, 4, 'Wiederholungen duerfen nicht drucken');
        assert.strictEqual(aufrufe.length, 2);
      });
    } finally { druck.weg(); }
  }

  // I2: die Storno-Gutschrift hat einen eigenen Standardtext — keine Zahlungsfrist, nennt die Originalrechnung,
  // Betrag aus der Abschrift. Die gespeicherte Rechnungsvorlage gilt fuer sie nicht.
  async function gutschriftText() {
    const rechnung = require('../../rechnung');
    const druck = druckAttrappe();
    try {
      await mitDienst({ vorlagen: { rechnung: { betreff: 'RE {{nr}}', text: 'Bitte zahlen Sie {{brutto}} bis {{faellig}}.' } } },
        { pdfFn: druck.fn, xmlFn: () => '<x/>' }, async ({ d, db }) => {
          legeRechnungAn(db, { kontakt_id: legeKontaktAn(db) });
          // Wie rechnung.storniere, Betrag bewusst krumm: er kommt aus der Abschrift, nie aus den Positionen.
          db.prepare(`INSERT INTO invoices (nr, jahr, laufnr, erstellt_am, leistung_von, leistung_bis, empfaenger, aussteller, positionen, netto_eur, ust_prozent,
            ust_eur, brutto_eur, kleinunternehmer, status, storno_von, kontakt_id, faellig_am) SELECT '2026-0008', jahr, 8, '2026-10-22T10:00:00.000Z', leistung_von,
            leistung_bis, empfaenger, aussteller, positionen, -netto_eur, ust_prozent, -ust_eur, -1189.99, kleinunternehmer, 'storno', nr, kontakt_id, faellig_am
            FROM invoices WHERE nr = '2026-0007'`).run();
          db.prepare("UPDATE invoices SET status = 'storniert' WHERE nr = '2026-0007'").run();
          const n = await d.belegNachricht('rechnung', '2026-0008');
          assert.strictEqual(n.betreff, 'Stornorechnung 2026-0008 zur Rechnung 2026-0007');
          assert.strictEqual(n.text, 'Guten Tag Erika Muster,\n\nanbei erhalten Sie die Stornorechnung 2026-0008 vom ' + rechnung.datum('2026-10-22T10:00:00.000Z')
            + ' zur Rechnung 2026-0007 über ' + rechnung.eur(-1189.99) + '. Die Rechnung 2026-0007 ist damit storniert.\n\nViele Grüße\nBüro');
          assert.ok(!/zahlbar|Bitte zahlen/.test(n.text) && !n.text.includes(rechnung.datum('2026-11-03T12:00:00')), n.text);
          assert.deepStrictEqual(n.an, ['kunde@example.org']);
          assert.deepStrictEqual(n.anhaenge.map((a) => [a.name, a.ok]), [['Rechnung-2026-0008.pdf', true], ['Rechnung-2026-0008.xml', true]]);
        });
    } finally { druck.weg(); }
  }

  // ---- Einstellungen E-Mail & Versand (Task 6) ----
  const MAIL_DATEI = {
    smtp: { host: 'smtp.example.org', port: 465, sicher: 'tls', benutzer: 'a@example.org', passwortEnvVar: 'MEIN_SMTP_PASS' },
    absender: { name: 'Büro', adresse: 'a@example.org' },
  };
  const kopie = (o) => JSON.parse(JSON.stringify(o));
  // Konto wie von Hand eingetragen: in config.json und im Speicher. Nur innerhalb von configGeschuetzt aufrufen.
  function mailKontoInDatei() {
    const pfad = path.join(__dirname, '..', '..', 'config.json');
    const roh = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    roh.mail = kopie(MAIL_DATEI);
    fs.writeFileSync(pfad, JSON.stringify(roh, null, 2) + '\n', 'utf8');
    const config = require('../../config.json');
    config.mail = kopie(MAIL_DATEI);
    return { config, datei: () => JSON.parse(fs.readFileSync(pfad, 'utf8')).mail };
  }
  const mit400 = (muster) => (e) => e.status === 400 && muster.test(e.message);

  function mailGrenzen() {
    configGeschuetzt(() => {
      const { setzeMail, mailEinstellungen } = require('../../server');
      const { config, datei } = mailKontoInDatei();
      for (const w of [0, 501, 'x', 10.5, true, '', null]) assert.throws(() => setzeMail({ tagesgrenze: w }), mit400(/Tagesgrenze/), JSON.stringify(w));
      for (const f of ['umleitenAn', 'benachrichtigungAn']) {
        for (const w of ['kein-mail', 'a@example.org\r\nBcc: b@example.org', 'ä@example.org', 5]) {
          assert.throws(() => setzeMail({ [f]: w }), (e) => e.status === 400, f + ' ' + JSON.stringify(w));
        }
      }
      // Erst alles pruefen, dann uebernehmen: ein Fehler im zweiten Feld laesst das erste stehen.
      for (const d of [{ tagesgrenze: 50, umleitenAn: 'kein-mail' }, { umleitenAn: 'test@example.org', tagesgrenze: 50, vorlagen: 'x' }, { umleitenAn: 'test@example.org', tagesgrenze: 0 }]) {
        assert.throws(() => setzeMail(d), (e) => e.status === 400, JSON.stringify(d));
      }
      assert.deepStrictEqual([datei(), config.mail], [MAIL_DATEI, MAIL_DATEI]);
      assert.throws(() => setzeMail({}), mit400(/Kein bekanntes Feld/));
      assert.throws(() => setzeMail({ quatsch: 1 }), mit400(/Unbekanntes Feld: quatsch/));

      const r = setzeMail({ tagesgrenze: '20', umleitenAn: ' test@example.org ', benachrichtigungAn: 'a@example.org' });
      assert.deepStrictEqual(r.werte, { umleitenAn: 'test@example.org', tagesgrenze: 20, benachrichtigungAn: 'a@example.org', vorlagen: {} });
      assert.deepStrictEqual([r.status.grenze, r.status.umgeleitet], [20, true]);
      assert.deepStrictEqual(datei(), { ...MAIL_DATEI, tagesgrenze: 20, umleitenAn: 'test@example.org', benachrichtigungAn: 'a@example.org' });
      for (const w of [1, 500]) assert.strictEqual(setzeMail({ tagesgrenze: w }).werte.tagesgrenze, w);
      // Leer = scharf.
      setzeMail({ umleitenAn: '', benachrichtigungAn: '' });
      assert.deepStrictEqual([datei().umleitenAn, datei().benachrichtigungAn], ['', '']);
      assert.strictEqual(mailEinstellungen().status.umgeleitet, false);
    });
  }

  function vorlagePlatzhalter() {
    configGeschuetzt(() => {
      const { setzeMail } = require('../../server');
      const { STANDARD_VORLAGEN } = require('../../mail');
      const { datei } = mailKontoInDatei();
      const v = (rechnung) => setzeMail({ vorlagen: { rechnung } });
      assert.throws(() => v({ betreff: 'Rechnung {{nr}}', text: 'Hallo {{unbekannt}} und {{ x-y }}' }), mit400(/\{\{unbekannt\}\}.*\{\{x-y\}\}/));
      assert.throws(() => v({ betreff: 'Rechnung {{ betrag }}', text: 'x' }), mit400(/betrag/));
      assert.throws(() => v({ betreff: 'R\r\nBcc: b@example.org', text: 'x' }), (e) => e.status === 400);
      assert.throws(() => v({ betreff: 'x'.repeat(201), text: 'x' }), mit400(/200/));
      assert.throws(() => v({ betreff: 'x', text: 'x'.repeat(4001) }), mit400(/4000/));
      assert.throws(() => v({ betreff: 'x' }), (e) => e.status === 400);
      assert.throws(() => v({ betreff: '', text: 'x' }), (e) => e.status === 400);
      // nachfassen (C11c) ist eine Vorlagen-Art, aber {{frist}} gibt es nur in Mahnschreiben; eine unbekannte Art bleibt abgelehnt.
      assert.throws(() => setzeMail({ vorlagen: { nachfassen: { betreff: 'x', text: 'Frist {{frist}}' } } }), mit400(/frist/));
      assert.throws(() => setzeMail({ vorlagen: { unbekannt: { betreff: 'x', text: 'y' } } }), mit400(/unbekannt/));
      for (const w of ['x', [], null]) assert.throws(() => setzeMail({ vorlagen: w }), (e) => e.status === 400, JSON.stringify(w));
      assert.strictEqual(datei().vorlagen, undefined);

      const re = { betreff: 'Rechnung {{nr}}', text: '{{ anrede }}\n\nRechnung {{nr}} über {{brutto}}, fällig {{faellig}}.' };
      const r = v(re);
      assert.deepStrictEqual(r.werte.vorlagen, { rechnung: re });
      assert.deepStrictEqual(r.standard, STANDARD_VORLAGEN);
      // Je Art ersetzt; die andere bleibt. null stellt den Standard wieder her.
      const an = { betreff: 'Angebot {{nr}}', text: 'gültig bis {{gueltig}}' };
      setzeMail({ vorlagen: { angebot: an } });
      assert.deepStrictEqual(datei().vorlagen, { rechnung: re, angebot: an });
      setzeMail({ vorlagen: { rechnung: null } });
      assert.deepStrictEqual(datei().vorlagen, { angebot: an });
      // nachfassen (C11c): gueltige Vorlage mit {{nr}} und {{gueltig}} wird gespeichert und mit null wieder auf den Standard gestellt.
      const nf = { betreff: 'Ihr Angebot {{nr}} läuft ab', text: '{{anrede}} Angebot {{nr}} gilt bis {{gueltig}}.' };
      assert.deepStrictEqual(setzeMail({ vorlagen: { nachfassen: nf } }).werte.vorlagen.nachfassen, nf);
      assert.deepStrictEqual(datei().vorlagen, { angebot: an, nachfassen: nf });
      setzeMail({ vorlagen: { nachfassen: null } });
      assert.deepStrictEqual(datei().vorlagen, { angebot: an });
    });
  }

  function zugangInDatei() {
    configGeschuetzt(() => {
      const { setzeMail } = require('../../server');
      const { config, datei } = mailKontoInDatei();
      for (const k of ['smtp', 'absender', 'transport', 'passwortEnvVar']) {
        assert.throws(() => setzeMail({ tagesgrenze: 50, [k]: { host: 'evil.example.org' } }), mit400(/nur in config\.json/), k);
      }
      assert.deepStrictEqual([datei(), config.mail], [MAIL_DATEI, MAIL_DATEI]);
      // Was nur in der Datei steht, bleibt wie dort, auch wenn der Speicher abweicht (Handaenderung seit dem Start).
      config.mail.smtp.host = 'evil.example.org';
      config.mail.absender.adresse = 'evil@example.org';
      setzeMail({ tagesgrenze: 50 });
      assert.deepStrictEqual(datei(), { ...MAIL_DATEI, tagesgrenze: 50 });
    });
  }

  function antwortOhneGeheimnis() {
    const WERT = 'Geheim-Env-Wert-4711', alt = process.env.MEIN_SMTP_PASS;
    process.env.MEIN_SMTP_PASS = WERT;
    try {
      configGeschuetzt(() => {
        const { setzeMail, mailEinstellungen } = require('../../server');
        mailKontoInDatei();
        const get = mailEinstellungen();
        assert.deepStrictEqual(Object.keys(get), ['werte', 'standard', 'platzhalter', 'status', 'konto']);
        assert.strictEqual(get.status.bereit, true, get.status.grund);
        // C11b: Platzhalter je Vorlagenart kommen vom Server; {{frist}} gibt es nur in Mahnschreiben.
        assert.ok(get.platzhalter.mahnung1.includes('frist') && !get.platzhalter.rechnung.includes('frist'));
        assert.deepStrictEqual(get.konto, { host: 'smtp.example.org', benutzer: 'a@example.org', absender: { name: 'Büro', adresse: 'a@example.org' } });
        const texte = [JSON.stringify(get), JSON.stringify(setzeMail({ tagesgrenze: 5 }))];
        for (const boese of [{ tagesgrenze: WERT }, { umleitenAn: WERT }, { smtp: { passwort: WERT } }, { vorlagen: { rechnung: { betreff: WERT, text: '{{x}}' } } }]) {
          assert.throws(() => setzeMail(boese), (e) => { texte.push(e.message); return e.status === 400; });
        }
        // R2: der Variablenname darf nur im Grund stehen, wenn sie fehlt — hier ist sie gesetzt.
        for (const t of texte) for (const g of [WERT, 'MEIN_SMTP_PASS', 'passwortEnvVar']) assert.ok(!t.includes(g), g + ' in ' + t);
      });
    } finally {
      if (alt === undefined) delete process.env.MEIN_SMTP_PASS; else process.env.MEIN_SMTP_PASS = alt;
    }
  }

  // Ueber HTTP: GET-Form, POST mit Zugang 400 und Datei unveraendert, gueltiger POST 200.
  async function mailEinstellungenRoute() {
    const pfad = path.join(__dirname, '..', '..', 'config.json'), datei = fs.readFileSync(pfad, 'utf8');
    const cfg = require('../../config.json'), speicher = kopie(cfg);
    const srv = require('../../server'), lauscht = srv.server.listening;
    try {
      if (!lauscht) await new Promise((ok) => srv.server.listen(0, '127.0.0.1', ok));
      const url = 'http://127.0.0.1:' + srv.server.address().port + '/api/mail/einstellungen';
      const post = (b) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
      const { datei: mailDatei } = mailKontoInDatei();
      const g = await fetch(url);
      assert.strictEqual(g.status, 200);
      assert.deepStrictEqual(Object.keys(await g.json()), ['werte', 'standard', 'platzhalter', 'status', 'konto']);
      const boese = await post({ smtp: { host: 'evil.example.org' } });
      assert.deepStrictEqual([boese.status, (await boese.json()).error], [400, 'smtp: nur in config.json aenderbar.']);
      assert.deepStrictEqual(mailDatei(), MAIL_DATEI);
      const gut = await post({ tagesgrenze: 7 });
      const r = await gut.json();
      assert.deepStrictEqual([gut.status, r.ok, r.werte.tagesgrenze, mailDatei().tagesgrenze], [200, true, 7, 7]);
    } finally {
      if (!lauscht) await new Promise((ok) => srv.server.close(ok));
      fs.writeFileSync(pfad, datei, 'utf8');
      for (const k of Object.keys(cfg)) delete cfg[k];
      Object.assign(cfg, speicher);
    }
  }

  // Gespeicherte Vorlagen wirken im Dialog; ohne Eintrag gilt der Standard.
  async function vorlageImDialog() {
    const druck = druckAttrappe();
    try {
      await mitDienst({ vorlagen: { rechnung: { betreff: 'RE {{nr}}', text: 'Summe {{brutto}} {{unbekannt}}' } } },
        { pdfFn: druck.fn, xmlFn: () => '<x/>' }, async ({ d, db }) => {
          const kid = legeKontaktAn(db);
          legeRechnungAn(db, { kontakt_id: kid });
          legeAngebotAn(db, kid);
          const n = await d.belegNachricht('rechnung', '2026-0007');
          assert.deepStrictEqual([n.betreff, n.text], ['RE 2026-0007', 'Summe ' + require('../../rechnung').eur(1190) + ' ']);
          assert.strictEqual((await d.belegNachricht('angebot', 'AN-2026-0003')).betreff, 'Angebot AN-2026-0003');
        });
      // Rueckfall je Feld: nur Betreff gespeichert, Text bleibt Standard; null von Hand zaehlt als leer.
      const standard = await (async () => {
        let t;
        await mitDienst({}, { pdfFn: druck.fn, xmlFn: () => '<x/>' }, async ({ d, db }) => {
          legeAngebotAn(db, legeKontaktAn(db));
          t = (await d.belegNachricht('angebot', 'AN-2026-0003')).text;
        });
        return t;
      })();
      await mitDienst({ vorlagen: { angebot: { betreff: 'X {{nr}}' }, rechnung: { betreff: null, text: '' } } },
        { pdfFn: druck.fn, xmlFn: () => '<x/>' }, async ({ d, db }) => {
          const kid = legeKontaktAn(db);
          legeRechnungAn(db, { kontakt_id: kid });
          legeAngebotAn(db, kid);
          const a = await d.belegNachricht('angebot', 'AN-2026-0003');
          assert.deepStrictEqual([a.betreff, a.text], ['X AN-2026-0003', standard]);
          const r = await d.belegNachricht('rechnung', '2026-0007');
          assert.strictEqual(r.betreff, 'Rechnung 2026-0007');
          assert.ok(r.text.length > 0);
        });
    } finally { druck.weg(); }
  }

  return [
    ['C11a: Kind-Umgebung ohne SMTP-Passwort', kindUmgebung],
    ['C11a: Tabelle versand', tabelleVersand],
    ['C11a: MIME Kopf und Umlaute', mimeKopf],
    ['C11a: MIME Anhänge', mimeAnhaenge],
    ['C11a: Kopf-Injection', mimeInjection],
    ['C11a: MIME transportneutral', mimeTransportneutral],
    ['C11a: SMTP Durchlauf', smtpDurchlauf],
    ['C11a: SMTP AUTH LOGIN', smtpAuthLogin],
    ['C11a: SMTP ohne STARTTLS', smtpOhneStarttls],
    ['C11a: SMTP Auth abgelehnt', smtpAuthAbgelehnt],
    ['C11a: SMTP Abbruch nach DATA', smtpAbbruchNachData],
    ['C11a: SMTP Zeitgrenze', smtpZeitgrenze],
    ['C11a: SMTP Umschlag nur ASCII', smtpUmschlag],
    ['C11a: SMTP Antwort UTF-8 über Paketgrenze', smtpUtf8Paketgrenze],
    ['C11a: SMTP Frist nach dem Flush', smtpFristNachFlush],
    ['C11a: SMTP Antwortzeile zu lang', smtpZeileZuLang],
    ['C11a: Status ohne Konto', statusOhneKonto],
    ['C11a: Status prüft umleitenAn, sicher, port', statusKonfigFelder],
    ['C11a: Transport unbekannt', transportUnbekannt],
    ['C11a: Umleitung', umleitung],
    ['C11a: Idempotenz', idempotenz],
    ['C11a: Tagesgrenze', tagesgrenze],
    ['C11a: Fehlerweg', fehlerweg],
    ['C11a: Zustellung unklar', zustellungUnklar],
    ['C11a: eml ohne Passwort', emlOhnePasswort],
    ['C11a: Protokoll fehlt nach Versand', protokollFehlt],
    ['C11a: Protokoll fehlt sperrt den Beleg', protokollFehltBeleg],
    ['C11a: eml-Fehler als Warnung', emlFehlerWarnung],
    ['C11a: Tagesgrenze zählt unklar', tagesgrenzeUnklar],
    ['C11a: Fehlversuche je Tag begrenzt', fehlversucheBegrenzt],
    ['C11a: Tagesgrenze parallel', tagesgrenzeParallel],
    ['C11a: PDF-Druck ohne Geheimnisse', druckOhneGeheimnis],
    ['C11a: Versand prüft vor dem Senden', sendePrueftVorher],
    ['C11a: Verlauf und letzte', verlaufLetzte],
    ['C11a: Marke nur scharf', letzteNurScharf],
    ['C11a: Marke zeigt Zustellung unklar', letzteUnklar],
    ['C11a: Beleg-Nachricht Rechnung', belegRechnung],
    ['C11a: XML fehlt', belegXmlFehlt],
    ['C11a: Angebot Gültigkeit', angebotGueltigkeit],
    ['C11a: Senden prüft Eingaben', sendenPrueft],
    ['C11a: Senden ohne PDF 422', pdfPflicht],
    ['C11a: Stornierte Rechnung 409', storniertNicht],
    ['C11a: Vorschau unklar, Wiederholung vor dem Druck', vorschauUnklarVorab],
    ['C11a: Storno-Gutschrift eigener Text', gutschriftText],
    ['C11a: Mail-Einstellungen Grenzen', mailGrenzen],
    ['C11a: Vorlage Platzhalter', vorlagePlatzhalter],
    ['C11a: Zugang bleibt in der Datei', zugangInDatei],
    ['C11a: Antwort ohne Geheimnis', antwortOhneGeheimnis],
    ['C11a: Route Mail-Einstellungen', mailEinstellungenRoute],
    ['C11a: Vorlage im Dialog', vorlageImDialog],
  ];
};
