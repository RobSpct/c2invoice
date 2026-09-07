'use strict';
// Sitzt zwischen dem Modell-Werkzeug (lokales Modell-Gateway, Terminal, ...) und dem lokalen
// Modellserver. Reicht jede Anfrage unveraendert weiter und schreibt nebenbei
// mit, wie viele Tokens sie gekostet hat.
//
// Warum ueberhaupt ein Zwischenstueck: der lokale Server fuehrt kein
// verwertbares Protokoll (im Ollama-Log stehen weder Modell noch Tokens), und
// die Oberflaeche speichert alles nur im Browser. Die Zahlen stehen einzig in
// der Antwort selbst — und beim Streaming auch dort nur, wenn die Anfrage
// "stream_options.include_usage" mitschickt. Genau das ergaenzt dieser Proxy.
//
// Grundsatz: Mitschreiben ist Beifang, Antworten ist Hauptzweck. Faellt das
// Protokoll aus, laeuft die Anfrage trotzdem durch — nur eine Meldung auf der
// Fehlerausgabe weist darauf hin.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const config = require('./config.json');

const EIN = config.lokaleModelle || {};
const UPSTREAM = new URL(EIN.upstreamUrl || 'http://127.0.0.1:11434');
const PORT = Number(EIN.proxyPort) || 11435;
const PRAEFIX = String(EIN.praefix || 'ollama').replace(/\/+$/, '');
// Muss mit ingest.lokalDir() uebereinstimmen — sonst schreibt der Proxy an
// eine Stelle, an der niemand nachsieht.
const LOG_DIR = EIN.protokollDir
  ? EIN.protokollDir.replace(/^~(?=[/\\])/, process.env.USERPROFILE || process.env.HOME || '~')
  : path.join(__dirname, 'data', 'lokal');

// Groesser als jede vernuenftige Anfrage, klein genug, dass ein
// fehlgeleiteter Datenstrom nicht den Arbeitsspeicher fuellt.
const MAX_BODY = 32 * 1024 * 1024;

// Dieselbe Ueberlegung fuer die Gegenrichtung. Die Antwort wird nur
// mitgeschrieben, um am Ende die Nutzungszahlen herauszuziehen — dafuer
// reichen wenige Kilobyte. Eine sehr lange Ausgabe (oder ein Modellserver,
// der sich unerwartet verhaelt) darf den Arbeitsspeicher nicht fuellen, nur
// weil nebenbei protokolliert wird. Wird die Grenze erreicht, laeuft die
// Antwort ungebremst zum Aufrufer weiter; nur das Protokoll entfaellt.
const MAX_ANTWORT = 8 * 1024 * 1024;

function monatsDatei(ts) {
  return path.join(LOG_DIR, `${ts.slice(0, 7)}.jsonl`);
}

// Eine Zeile je Anfrage. Anhaengen statt sammeln: der Ingest liest die Datei
// ohnehin fortlaufend, und ein Absturz verliert so hoechstens die letzte Zeile.
function schreibeZeile(satz) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(monatsDatei(satz.ts), JSON.stringify(satz) + '\n', 'utf8');
  } catch (err) {
    console.error('Proxy: Nutzung nicht protokolliert —', err.message);
  }
}

// Woher die Anfrage kam. Dient nur der Nachvollziehbarkeit in der Rohzeile,
// nicht der Abrechnung — abgerechnet wird das Modell, nicht das Werkzeug.
// ingest.js liest das Feld deshalb bewusst nicht; es hilft beim Nachsehen,
// welches Werkzeug eine Zeile erzeugt hat, wenn eine Zuordnung strittig ist.
function clientVon(req) {
  const o = req.headers.origin || req.headers.referer;
  if (o) {
    try {
      return new URL(o).host;
    } catch { /* kaputter Header: unten weiter */ }
  }
  return 'cli';
}

// Die Nutzungszahlen stehen entweder in einer gewoehnlichen JSON-Antwort oder
// im letzten Datenblock eines Stroms. Beide Faelle liefern dieselbe Form.
function usageAusText(text, gestreamt) {
  if (!gestreamt) {
    try {
      const o = JSON.parse(text);
      return o && o.usage ? o.usage : null;
    } catch {
      return null;
    }
  }
  let gefunden = null;
  for (const zeile of text.split('\n')) {
    if (!zeile.startsWith('data:')) continue;
    const rest = zeile.slice(5).trim();
    if (!rest || rest === '[DONE]') continue;
    try {
      const o = JSON.parse(rest);
      if (o && o.usage) gefunden = o.usage;
    } catch { /* Teilblock: der naechste Durchlauf hat ihn vollstaendig */ }
  }
  return gefunden;
}

function istChatPfad(url) {
  return /\/(chat\/completions|completions|embeddings)(\?|$)/.test(url || '');
}

const server = http.createServer((req, res) => {
  const teile = [];
  let laenge = 0;
  let zuGross = false;

  req.on('data', (c) => {
    laenge += c.length;
    if (laenge > MAX_BODY) { zuGross = true; return; }
    teile.push(c);
  });

  req.on('end', () => {
    if (zuGross) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Anfrage zu gross.' }));
      return;
    }

    let body = Buffer.concat(teile);
    let gestreamt = false;
    let modell = null;
    const chat = istChatPfad(req.url);

    // Nur bei den Endpunkten anfassen, die Nutzung melden koennen. Alles
    // andere (Modell-Liste, Statusabfragen) geht unveraendert durch.
    if (chat && body.length) {
      try {
        const o = JSON.parse(body.toString('utf8'));
        modell = o.model || null;
        gestreamt = o.stream === true;
        if (gestreamt) {
          o.stream_options = { ...(o.stream_options || {}), include_usage: true };
          body = Buffer.from(JSON.stringify(o), 'utf8');
        }
      } catch {
        // Kein JSON: unveraendert weiterreichen. Lieber nicht protokolliert
        // als eine Anfrage zerstoert.
        modell = null;
      }
    }

    const kopf = { ...req.headers, host: UPSTREAM.host };
    delete kopf['content-length'];
    if (body.length) kopf['content-length'] = String(body.length);
    // Komprimierte Antworten koennte der Proxy nicht mitlesen. Der Umweg ueber
    // Klartext kostet auf 127.0.0.1 nichts.
    if (chat) kopf['accept-encoding'] = 'identity';

    const beginn = Date.now();
    const client = clientVon(req);

    const weiter = http.request(
      {
        hostname: UPSTREAM.hostname,
        port: UPSTREAM.port || 80,
        path: req.url,
        method: req.method,
        headers: kopf,
      },
      (antwort) => {
        res.writeHead(antwort.statusCode, antwort.headers);

        // Nur mitlesen, wo auch etwas zu zaehlen ist. Sonst reicht das
        // Durchreichen ohne jede Zwischenspeicherung.
        if (!chat || antwort.statusCode !== 200) {
          antwort.pipe(res);
          return;
        }

        let gesammelt = [];
        let gesammeltLaenge = 0;
        let uebergelaufen = false;
        antwort.on('data', (c) => {
          // Der Datenstrom geht sofort weiter — der Aufrufer wartet nicht
          // auf das Protokoll.
          res.write(c);
          if (uebergelaufen) return;
          gesammeltLaenge += c.length;
          if (gesammeltLaenge > MAX_ANTWORT) {
            // Aufgeben statt weiter anhaeufen: das Protokoll ist Beifang,
            // die Antwort ist der Zweck. Den bereits gesammelten Teil
            // freigeben, sonst bliebe genau der Speicher belegt, den diese
            // Grenze verhindern soll.
            uebergelaufen = true;
            gesammelt = [];
            return;
          }
          gesammelt.push(c);
        });

        antwort.on('end', () => {
          res.end();
          if (uebergelaufen) {
            console.error(
              `Proxy: Antwort groesser als ${Math.round(MAX_ANTWORT / 1024 / 1024)} MB ` +
              `(${modell || 'unbekanntes Modell'}) — nicht protokolliert.`
            );
            return;
          }
          const text = Buffer.concat(gesammelt).toString('utf8');
          const u = usageAusText(text, gestreamt);
          if (!u) {
            console.error(
              `Proxy: keine Nutzungszahlen in der Antwort (${modell || 'unbekanntes Modell'}) — nicht protokolliert.`
            );
            return;
          }
          schreibeZeile({
            ts: new Date(beginn).toISOString(),
            request_id: crypto.randomUUID(),
            model: `${PRAEFIX}/${modell || 'unbekannt'}`,
            prompt_tokens: Number(u.prompt_tokens) || 0,
            completion_tokens: Number(u.completion_tokens) || 0,
            dauer_ms: Date.now() - beginn,
            client,
          });
        });
      }
    );

    weiter.on('error', (err) => {
      console.error('Proxy: Modellserver nicht erreichbar —', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Modellserver nicht erreichbar: ${err.message}` }));
      } else {
        res.end();
      }
    });

    weiter.end(body.length ? body : undefined);
  });
});

function start(port = PORT) {
  return new Promise((auf) => {
    // Ausdruecklich nur auf der Rueckschleife: der Proxy hat keine
    // Zugangspruefung und darf deshalb nie im Netz stehen.
    server.listen(port, '127.0.0.1', () => auf(server));
  });
}

module.exports = { start, server, usageAusText, clientVon, istChatPfad };

if (require.main === module) {
  start().then(() => {
    console.log(
      `Proxy laeuft auf http://127.0.0.1:${PORT} → ${UPSTREAM.origin}\n` +
      `Protokoll: ${LOG_DIR}\n` +
      'In der Oberflaeche des Modell-Werkzeugs diesen Port eintragen ' +
      `(z. B. http://localhost:${PORT}/v1), sonst wird nichts erfasst.`
    );
  });
}
