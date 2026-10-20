'use strict';
// Ereignis-Bus im Serverprozess und sein Weg zum Browser (Server-Sent Events).
// Module melden mit sende(art, daten); jeder offene Browser-Tab bekommt es
// ueber GET /api/ereignisse. Die 15-s-Nachladeschleife der Oberflaeche bleibt
// die Rueckfallebene: ein verpasstes Ereignis heilt beim naechsten Takt.
const { EventEmitter } = require('node:events');

const bus = new EventEmitter();
bus.setMaxListeners(100);   // ein Zuhoerer je offenem Tab

function sende(art, daten = {}) {
  bus.emit('ereignis', { art, daten, zeit: new Date().toISOString() });
}

// Je offenem Tab eine Verbindung. Mehr als das braucht niemand; eine fremde
// Seite koennte sonst beliebig viele oeffnen und die eigenen Plaetze belegen.
const MAX_VERBINDUNGEN = 20;
let verbindungen = 0;

// Haelt die Verbindung offen. Ein Kommentar alle 25 s, damit Proxys und der
// Browser sie nicht als tot schliessen.
function sse(req, res) {
  // Nur die eigene Seite: der Herkunfts-Check in server.js gilt fuer POST.
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') { res.writeHead(403, { 'content-type': 'text/plain' }); return res.end('Fremde Herkunft'); }
  if (verbindungen >= MAX_VERBINDUNGEN) { res.writeHead(429, { 'content-type': 'text/plain' }); return res.end('Zu viele Verbindungen'); }
  verbindungen++;
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  res.write(': verbunden\n\n');
  const weiter = (e) => res.write('event: ' + e.art + '\ndata: ' + JSON.stringify(e) + '\n\n');
  bus.on('ereignis', weiter);
  const puls = setInterval(() => res.write(': puls\n\n'), 25000);
  let offen = true;
  const zu = () => { if (!offen) return; offen = false; verbindungen--; clearInterval(puls); bus.off('ereignis', weiter); };
  req.on('close', zu);
  res.on('error', zu);
}

module.exports = { bus, sende, sse, MAX_VERBINDUNGEN, offen: () => verbindungen };
