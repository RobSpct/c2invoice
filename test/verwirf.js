'use strict';
// Fuer Pruefungen, die nur Status oder Kopfzeilen brauchen: den Antwortkoerper
// verwerfen. Ungelesen haelt er den Socket bis zur Speicherbereinigung offen;
// schliesst dann der Testserver, bricht Node unter Windows ab (libuv, Exit 127
// bzw. 0xC0000409). Nimmt eine Antwort oder das Promise von fetch().
module.exports = async function verwirf(antwort) {
  const r = await antwort;
  await r.body?.cancel().catch(() => {});
  return r;
};
