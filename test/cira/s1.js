'use strict';
// Geraetekopplung (S1, Owner 19.10.2026; Security-Review C5 H1): schreibende
// Aufrufe nur von gekoppelten Geraeten, auch wenn ein lokaler Prozess die
// Herkunfts-Kopfzeilen faelscht. Der Kopplungscode erscheint nur auf dem Desktop.
const assert = require('node:assert');
const path = require('node:path');
const { EventEmitter } = require('node:events');

module.exports = ({ dbmod, openDbs }) => {
  const geraete = require('../../geraete');
  const srv = () => require('../../server');

  // Dialog-Attrappe: merkt Code und Prozess (kill wird gezaehlt).
  function dienst(extra = {}) {
    const db = dbmod.open(':memory:');
    openDbs.push(db);
    let t = Date.parse('2026-10-19T12:00:00Z');
    const codes = [];
    const kinder = [];
    const d = geraete.erzeuge({ db, uhr: () => t, ...extra });
    d.anzeigen = (c) => { codes.push(c); const k = { getoetet: false, kill() { this.getoetet = true; } }; kinder.push(k); return Promise.resolve({ kind: k }); };
    return { db, d, codes, kinder, vor: (ms) => { t += ms; } };
  }
  const req = (h = {}) => ({ headers: h });

  /* ---------- Kopplung ---------- */
  async function kopplung() {
    const { db, d, codes, kinder, vor } = dienst();
    const s = await d.starte();
    assert.match(codes[0], /^\d{6}$/, 'Code nicht angezeigt');
    assert.ok(!JSON.stringify(s).includes(codes[0]), 'Code in der Antwort');
    assert.throws(() => d.bestaetige({ kopplung: s.kopplung, code: codes[0] === '000000' ? '111111' : '000000' }), /stimmt nicht/);
    const r = d.bestaetige({ kopplung: s.kopplung, code: codes[0], name: 'Arbeitsrechner' });
    assert.ok(r.token.length >= 40, 'Token zu kurz');
    assert.ok(kinder[0].getoetet, 'Dialog bleibt nach dem Koppeln offen');
    const zeile = db.prepare('SELECT * FROM geraet').get();
    assert.strictEqual(zeile.token_hash, geraete.hash(r.token));
    assert.ok(!JSON.stringify(zeile).includes(r.token), 'Token im Klartext gespeichert');
    assert.strictEqual(zeile.name, 'Arbeitsrechner'); assert.strictEqual(zeile.art, 'browser');
    // Ein Code gilt einmal.
    assert.throws(() => d.bestaetige({ kopplung: s.kopplung, code: codes[0] }), (e) => e.status === 409);
    // Cookie und Kopfzeile gelten, Unsinn nicht.
    assert.strictEqual(d.geraet(req({ cookie: 'x=1; ' + geraete.COOKIE + '=' + r.token })).id, zeile.id);
    assert.strictEqual(d.geraet(req({ [geraete.KOPF]: r.token })).id, zeile.id);
    assert.strictEqual(d.geraet(req({ [geraete.KOPF]: r.token + 'x' })), null);
    assert.strictEqual(d.geraet(req({})), null);
    // Abgelaufen.
    const s2 = await d.starte();
    vor(2 * 60000 + 1);
    assert.throws(() => d.bestaetige({ kopplung: s2.kopplung, code: codes[1] }), /abgelaufen/);
    // Fuenf falsche Versuche entwerten den Code, auch fuer den richtigen danach.
    const s3 = await d.starte();
    const falsch = codes[2] === '123456' ? '654321' : '123456';
    for (let i = 0; i < 4; i++) assert.throws(() => d.bestaetige({ kopplung: s3.kopplung, code: falsch }), /stimmt nicht/);
    assert.throws(() => d.bestaetige({ kopplung: s3.kopplung, code: falsch }), /Zu viele/);
    assert.throws(() => d.bestaetige({ kopplung: s3.kopplung, code: codes[2] }), (e) => e.status === 409);
    // Eine laufende Kopplung kippt nur, wer ihre ID kennt — ein fremder Start bekommt 409.
    const a = await d.starte();
    await assert.rejects(d.starte(), (e) => e.status === 409 && /läuft schon/.test(e.message), 'fremder Start ersetzt die Kopplung');
    const b = await d.starte({ ersetzt: a.kopplung });
    assert.ok(kinder[3].getoetet, 'alter Dialog bleibt offen');
    assert.throws(() => d.bestaetige({ kopplung: a.kopplung, code: codes[3] }), (e) => e.status === 409);
    assert.ok(d.bestaetige({ kopplung: b.kopplung, code: codes[4], client: true, name: '<script>' }).geraet.art === 'client');
    assert.strictEqual(db.prepare("SELECT name FROM geraet WHERE art = 'client'").get().name, 'Gerät', 'ungueltiger Name uebernommen');
    // Hoechstens 5 Starts je 10 Minuten (je Start ein Dialog auf dem Desktop; der abgewiesene zaehlt nicht).
    await assert.rejects(d.starte(), (e) => e.status === 429);
    vor(10 * 60000 + 1);
    await d.starte();
    // Entfernen entwertet sofort.
    d.entferne(zeile.id);
    assert.strictEqual(d.geraet(req({ [geraete.KOPF]: r.token })), null);
    assert.throws(() => d.entferne(zeile.id), (e) => e.status === 404);
    // Cookie: HttpOnly, SameSite=Strict — und fuer Einbettungen (Obsidian-iframe,
    // dort verwirft der Browser Strict) eine partitionierte Fassung mit demselben Token.
    const [strikt, eingebettet] = d.cookie('abc');
    assert.match(strikt, /^c2i_geraet=abc; HttpOnly; SameSite=Strict;/);
    assert.match(eingebettet, /^c2i_geraet=abc; HttpOnly; SameSite=None; Secure; Partitioned;/);
    assert.ok(d.cookieWeg().length === 2 && d.cookieWeg().every((c) => /Max-Age=0/.test(c)) && /Partitioned/.test(d.cookieWeg()[1]), 'Abmelden loescht nicht beide Cookies');
  }

  // Erscheint der Dialog nicht, sagt die Antwort das — und die Kopplung ist weg,
  // ein neuer Versuch braucht keine ID. Scheitert das Speichern, bleibt der Code gueltig.
  async function fehlerfaelle() {
    const { db, d, codes } = dienst();
    const ok = d.anzeigen;
    d.anzeigen = () => Promise.reject(Object.assign(new Error('Exit 0'), { status: 503 }));
    await assert.rejects(d.starte(), (e) => e.status === 503, 'nicht angezeigter Dialog als Erfolg gemeldet');
    d.anzeigen = ok;
    const s = await d.starte();
    db.exec('ALTER TABLE geraet RENAME TO geraet_weg');
    assert.throws(() => d.bestaetige({ kopplung: s.kopplung, code: codes[0] }), (e) => e.status === 500);
    db.exec('ALTER TABLE geraet_weg RENAME TO geraet');
    assert.ok(d.bestaetige({ kopplung: s.kopplung, code: codes[0] }).token, 'Code nach Speicherfehler verbraucht');
  }

  // Desktop-Dialog: Code in der Umgebung, nie in den Argumenten; absoluter Pfad;
  // ein sofort endender Prozess (detached, kein Desktop) ist ein Fehler.
  async function anzeige() {
    if (process.platform !== 'win32') return;
    const aufrufe = [];
    const fake = (bleibt) => (exe, args, opt) => {
      aufrufe.push({ exe, args, opt });
      const k = new EventEmitter(); k.unref = () => {}; k.stderr = new EventEmitter();
      if (!bleibt) setImmediate(() => k.emit('exit', 0));
      return k;
    };
    const r = await geraete.zeigeCodeAmDesktop('482913', { bis: '21:30', spawnFn: fake(true), lebtMs: 20 });
    assert.ok(r.kind, 'kein Prozess zum Schliessen');
    const a = aufrufe[0];
    assert.ok(path.isAbsolute(a.exe) && /powershell\.exe$/i.test(a.exe), 'PowerShell ohne absoluten Pfad: ' + a.exe);
    assert.ok(!a.args.join(' ').includes('482913'), 'Code in der Kommandozeile');
    assert.strictEqual(a.opt.env.C2I_KOPPLUNGSCODE, '482913');
    assert.ok(!a.opt.shell, 'mit Shell gestartet');
    assert.ok(!a.opt.detached, 'detached: der Dialog erscheint nicht');
    await assert.rejects(geraete.zeigeCodeAmDesktop('482913', { bis: '21:30', spawnFn: fake(false), lebtMs: 200 }), (e) => e.status === 503 && /nicht anzeigen/.test(e.message), 'sofort beendeter Dialog als Erfolg');
  }

  /* ---------- Schutz im Server ---------- */
  async function serverSchutz() {
    const s = srv();
    const { d, codes } = dienst();
    s.setzeGeraeteDienst(d);
    s.setzeGeraeteSchutz(true);
    await new Promise((ok) => s.server.listen(0, '127.0.0.1', ok));
    const basis = 'http://127.0.0.1:' + s.server.address().port;
    // So faelscht ein lokaler Prozess die eigene Seite.
    const gefaelscht = { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', origin: basis };
    const post = (p, kopf = gefaelscht, body = '{}', method = 'POST') => fetch(basis + p, { method, headers: kopf, body });
    try {
      for (const p of ['/api/einstellungen', '/api/stammdaten', '/api/sitzung', '/api/freigaben/1/entscheide', '/api/rechnung', '/api/saetze', '/api/cira/frage', '/api/refresh']) {
        const r = await post(p);
        assert.strictEqual(r.status, 401, p + ' ohne Geraet: ' + r.status);
        assert.strictEqual(r.headers.get('x-c2invoice-kopplung'), 'noetig', p + ': Kopplungs-Kopfzeile fehlt');
      }
      // Andere Methoden auch; fremde Herkunft schon vorher 403.
      assert.strictEqual((await post('/api/einstellungen', gefaelscht, '{}', 'PUT')).status, 401, 'PUT ohne Geraet');
      assert.strictEqual((await post('/api/einstellungen', { ...gefaelscht, 'sec-fetch-site': 'cross-site' }, '{}', 'DELETE')).status, 403, 'DELETE fremder Herkunft');
      // Lesen bleibt frei; GET loest keinen Abgleich mehr aus.
      assert.strictEqual((await fetch(basis + '/api/zaehler')).status, 200);
      assert.notStrictEqual((await fetch(basis + '/api/refresh')).status, 200, 'GET /api/refresh loest noch den Abgleich aus');
      assert.deepStrictEqual(await (await fetch(basis + '/api/kopplung/status')).json(), { gekoppelt: false, geraet: null, schutz: true });
      // Der Hook prueft sein eigenes Geheimnis (401 ohne Kopplungs-Kopfzeile).
      const h = await post('/api/hook');
      assert.ok(!h.headers.get('x-c2invoice-kopplung'), 'Hook verlangt ein Geraet');
      // Kopplung ueber HTTP: Code nie in der Antwort; Browser bekommt nur ein HttpOnly-Cookie.
      const st = await post('/api/kopplung/start');
      const stText = await st.text();
      assert.strictEqual(st.status, 200, stText);
      assert.ok(!stText.includes(codes[0]), 'Code in der Antwort');
      const { kopplung } = JSON.parse(stText);
      // Ein zweiter Start ohne ID (fremder Prozess) kippt die laufende Kopplung nicht.
      assert.strictEqual((await post('/api/kopplung/start')).status, 409);
      const be = await post('/api/kopplung/bestaetigen', gefaelscht, JSON.stringify({ kopplung, code: codes[0], name: 'Test' }));
      const beText = await be.text();
      assert.strictEqual(be.status, 200, beText);
      const sc = be.headers.get('set-cookie') || '';
      assert.match(sc, /c2i_geraet=[\w-]{40,}; HttpOnly; SameSite=Strict/);
      assert.match(sc, /c2i_geraet=[\w-]{40,}; HttpOnly; SameSite=None; Secure; Partitioned/, 'Einbettung (Obsidian) bekommt kein Cookie');
      assert.ok(!/"token"/.test(beText), 'Browser-Token im Koerper');
      const token = sc.match(/c2i_geraet=([\w-]+)/)[1];
      const mitCookie = { ...gefaelscht, cookie: 'c2i_geraet=' + token };
      // Ohne Nebenwirkung: ein unbekanntes Geraet entfernen kommt am Schutz vorbei und endet mit 404.
      const e = await post('/api/geraet/999999/entfernen', mitCookie);
      assert.strictEqual(e.status, 404, 'gekoppelt, trotzdem ' + e.status);
      assert.strictEqual((await (await fetch(basis + '/api/kopplung/status', { headers: { cookie: 'c2i_geraet=' + token } })).json()).gekoppelt, true);
      const liste = await (await fetch(basis + '/api/geraete', { headers: { cookie: 'c2i_geraet=' + token } })).json();
      assert.ok(liste.geraete.some((g) => g.dieses && g.name === 'Test') && !JSON.stringify(liste).includes(token), 'Liste falsch oder mit Token');
      // Entfernen (sich selbst): Cookie geloescht, danach wieder 401.
      const weg = await post('/api/geraet/' + liste.geraete[0].id + '/entfernen', mitCookie);
      assert.strictEqual(weg.status, 200);
      assert.match(weg.headers.get('set-cookie') || '', /Max-Age=0/);
      assert.match(weg.headers.get('set-cookie') || '', /Partitioned; Path=\/; Max-Age=0/, 'eingebettetes Cookie bleibt nach dem Entfernen');
      assert.strictEqual((await post('/api/geraet/999999/entfernen', mitCookie)).status, 401, 'entferntes Geraet schreibt noch');
      // Programm (client): Token einmal im Koerper, als Kopfzeile nutzbar.
      const st2 = JSON.parse(await (await post('/api/kopplung/start')).text());
      const cl = await (await post('/api/kopplung/bestaetigen', gefaelscht, JSON.stringify({ kopplung: st2.kopplung, code: codes[1], client: true, name: 'Jarvis' }))).json();
      assert.ok(cl.token, 'client ohne Token');
      assert.strictEqual((await post('/api/geraet/999999/entfernen', { ...gefaelscht, 'x-c2invoice-geraet': cl.token })).status, 404);
      // Ein DB-Fehler in der Pruefung ist kein "nicht gekoppelt" (kein Kopplungsdialog, sondern 500).
      s.setzeGeraeteDienst({ ...d, geraet() { throw new Error('database is locked'); } });
      const kaputt = await post('/api/einstellungen');
      assert.strictEqual(kaputt.status, 500, 'DB-Fehler als ' + kaputt.status);
      assert.ok(!kaputt.headers.get('x-c2invoice-kopplung'), 'DB-Fehler oeffnet den Kopplungsdialog');
    } finally {
      s.setzeGeraeteDienst(d);
      s.setzeGeraeteSchutz(false);
      await new Promise((ok) => { s.server.closeAllConnections(); s.server.close(ok); });
    }
  }

  return [
    ['S1 Kopplung: Code nur in der Anzeige, einmal gueltig, 2 Minuten, 5 Versuche, nur eigener Neustart, Startgrenze, Dialog schliesst, nur Hash gespeichert, Entfernen', kopplung],
    ['S1 Fehlerfaelle: Dialog nicht angezeigt meldet 503, Speicherfehler verbraucht den Code nicht', fehlerfaelle],
    ['S1 Desktop-Dialog: absoluter Pfad, Code in der Umgebung, sofortiges Ende ist ein Fehler', anzeige],
    ['S1 Server: Schreiben ohne Geraet 401 trotz gefaelschter Kopfzeilen (alle Methoden), Lesen und Hook frei, Kopplung per HTTP, Entfernen sperrt, DB-Fehler 500', serverSchutz],
  ];
};
