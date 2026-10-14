'use strict';
/* Diagramm-Bausteine: reine Rechnungen von Zahlen zu SVG-Pfaden.
   Kein DOM, keine Formatierung — deshalb auch unter Node pruefbar
   (test/selfcheck.js, testChartBausteine). Uebernommen aus dem
   Claude-Design-Mockup und dort, wo es NaN erzeugen konnte, abgesichert:
   ein einziges NaN im Pfad laesst den Browser das Element still verwerfen. */

const f1 = (n) => n.toFixed(1);

// Weiche Linie durch Punkte (horizontale Bezier-Tangenten, kein Ueberschwingen
// unter die Grundlinie).
function smooth(pts, move = true) {
  if (!pts.length) return move ? 'M0,0' : '';
  let d = (move ? 'M' : ' L') + f1(pts[0][0]) + ',' + f1(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const xm = f1((x0 + x1) / 2);
    d += ' C' + xm + ',' + f1(y0) + ' ' + xm + ',' + f1(y1) + ' ' + f1(x1) + ',' + f1(y1);
  }
  return d;
}

// Flaeche unter einer Reihe; `top` haelt den hoechsten Punkt vom Rand weg.
function area(vals, w, h, top = 6, max) {
  const n = vals.length;
  if (!n) return { line: 'M0,' + h + ' L' + w + ',' + h, fill: 'M0,' + h + ' L' + w + ',' + h + ' Z' };
  max = max || Math.max(...vals) || 1;
  // Ein einzelner Wert wird ueber die volle Breite gezogen statt als Punkt.
  const reihe = n === 1 ? [vals[0], vals[0]] : vals;
  const m = reihe.length;
  const pts = reihe.map((v, i) => [i / (m - 1) * w, h - (v / max) * (h - top)]);
  const line = smooth(pts);
  return { line, fill: line + ' L' + w + ',' + h + ' L0,' + h + ' Z' };
}

// Ring aus Segmenten ueber stroke-dasharray. `anteil` ist der echte Anteil
// (0..1); `minAnteil` macht winzige Segmente nur sichtbar, aendert ihn nicht.
function ring(segs, r, minAnteil = 0) {
  const U = 2 * Math.PI * r;
  const tot = segs.reduce((a, s) => a + s.v, 0);
  if (!tot) return segs.map((s) => ({ ...s, anteil: 0, dash: '0 ' + U.toFixed(2), off: '0.00' }));
  let sh = segs.map((s) => Math.max(s.v / tot, s.v > 0 ? minAnteil : 0));
  const st = sh.reduce((a, b) => a + b, 0);
  sh = sh.map((x) => x / st);
  let acc = 0;
  return segs.map((s, i) => {
    const len = Math.max(sh[i] * U - 1.5, 0.01);
    const o = { ...s, anteil: s.v / tot, dash: len.toFixed(2) + ' ' + (U - len).toFixed(2), off: (-acc).toFixed(2) };
    acc += sh[i] * U;
    return o;
  });
}

// Punkt auf einem oberen Halbbogen: 0 = links, 0,5 = oben, 1 = rechts.
function arcPt(cx, cy, r, frac) {
  const a = Math.PI * (1 - frac);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

// Halbkreis-Anzeige (Mockup: Mitte 110/112, Radius 86). `prozent` wird auf
// 0..max geklemmt; ohne Wert bleibt der Zeiger leer statt bei 0 zu stehen.
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
function gauge(prozent, max = 60, ziel = null, cx = 110, cy = 112, r = 86) {
  const bogen = (frac) => {
    const [x, y] = arcPt(cx, cy, r, frac);
    return 'M' + f1(cx - r) + ',' + f1(cy) + ' A' + r + ',' + r + ' 0 0 1 ' + f1(x) + ',' + f1(y);
  };
  return {
    bahn: bogen(1),
    wert: prozent == null || !Number.isFinite(Number(prozent)) ? '' : bogen(clamp01(prozent / max)),
    zielPt: ziel == null || !(ziel > 0) ? null : arcPt(cx, cy, r, clamp01(ziel / max)).map((v) => Number(f1(v))),
  };
}

// Wasserfall. stufen = [{l, v, neg?, summe?}]: `summe` steht auf der Null-
// linie (auch nach unten, wenn v < 0), `neg` zieht v vom laufenden Stand ab,
// sonst wird v aufgesetzt. Platz oben fuer die Beschriftung.
function wasserfall(stufen, w, h, oben = 16) {
  let stand = 0;
  const spannen = stufen.map((s) => {
    const v = Number(s.v) || 0;
    let a, b;
    if (s.summe) { a = 0; b = v; stand = v; }
    else if (s.neg) { a = stand - v; b = stand; stand -= v; }
    else { a = stand; b = stand + v; stand += v; }
    return [Math.min(a, b), Math.max(a, b)];
  });
  const hoch = Math.max(0, ...spannen.map((x) => x[1]));
  const tief = Math.min(0, ...spannen.map((x) => x[0]));
  const k = (h - oben) / ((hoch - tief) || 1);
  const y = (v) => oben + (hoch - v) * k;
  const slot = w / (stufen.length || 1);
  return stufen.map((s, i) => ({
    l: s.l, v: Number(s.v) || 0, neg: !!s.neg, summe: !!s.summe,
    x: f1(i * slot + slot * 0.2), w: f1(slot * 0.6),
    y: f1(y(spannen[i][1])), h: Math.max((spannen[i][1] - spannen[i][0]) * k, 1).toFixed(1),
  }));
}

// Aktivitaets-Heatmap: `wochen` Spalten bis zur Woche von `bis`, Montag oben.
// tage = [{day, v}]. Stufe 0 = nichts, 1–4 nach Rang unter den Tagen mit Wert,
// null = Tag nach `bis`. monate[spalte] = Monatsindex 0–11, wo ein Monat beginnt.
function heatmap(tage, { wochen = 12, bis } = {}) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const b = new Date(bis + 'T00:00:00Z');
  const start = new Date(b);
  start.setUTCDate(b.getUTCDate() - ((b.getUTCDay() + 6) % 7) - 7 * (wochen - 1));
  const wert = new Map(tage.map((t) => [t.day, Number(t.v) || 0]));
  const pos = [...wert.values()].filter((v) => v > 0).sort((x, y) => x - y);
  const stufe = (v) => (v > 0 ? 1 + Math.min(3, Math.floor((pos.length > 1 ? pos.lastIndexOf(v) / (pos.length - 1) : 1) * 4)) : 0);
  const zellen = [], monate = [];
  for (let i = 0; i < wochen * 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const day = iso(d);
    if (i % 7 === 0) monate.push(i === 0 || d.getUTCMonth() !== new Date(zellen[i - 7].day + 'T00:00:00Z').getUTCMonth() ? d.getUTCMonth() : null);
    const nachher = day > bis;
    zellen.push({ day, v: nachher ? null : wert.get(day) || 0, stufe: nachher ? null : stufe(wert.get(day) || 0) });
  }
  return { zellen, monate };
}

// Gestapelte Flaechen. `series` = [{vals:[…], …}], alle gleich lang.
function stacked(series, w, h, mx) {
  const n = series.length ? series[0].vals.length : 0;
  const sums = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + s.vals[i], 0));
  const max = mx || (n ? Math.max(...sums) * 1.05 : 0) || 1;
  const x = (i) => (n < 2 ? (i === 0 ? 0 : w) : i / (n - 1) * w);
  // Ein einzelner Tag wird zu einer Flaeche ueber die Breite gezogen.
  const dehne = (arr) => (n === 1 ? [arr[0], arr[0]] : arr);
  const P = (arr) => dehne(arr).map((v, i) => [n === 1 ? i * w : x(i), h - v / max * h]);
  let base = Array(n).fill(0);
  const layers = series.map((s) => {
    const top = base.map((b, i) => b + s.vals[i]);
    const d = smooth(P(top)) + smooth(P(base).reverse(), false) + ' Z';
    base = top;
    return { ...s, d };
  });
  return { layers, max };
}

// Sankey ueber Spalten. cols = [[{id,label,c}], …], links = [{s,t,v}].
// Knotenhoehe = groesserer Wert aus Zu- und Abfluss.
function sankey(cols, links, W, H, nodeW, gap) {
  const inV = {}, outV = {};
  links.forEach((l) => {
    outV[l.s] = (outV[l.s] || 0) + l.v;
    inV[l.t] = (inV[l.t] || 0) + l.v;
  });
  const nv = (id) => Math.max(inV[id] || 0, outV[id] || 0);
  const tot = Math.max(...cols.map((c) => c.reduce((a, n) => a + nv(n.id), 0)), 0);
  const maxN = Math.max(...cols.map((c) => c.length), 1);
  const k = tot ? (H - (maxN - 1) * gap) / tot : 0;
  const pos = {};
  const nodes = [];
  const spalten = Math.max(cols.length - 1, 1);
  cols.forEach((c, ci) => {
    const x = ci * (W - nodeW) / spalten;
    const colH = c.reduce((a, n) => a + nv(n.id) * k, 0) + (c.length - 1) * gap;
    let y = (H - colH) / 2;
    c.forEach((n) => {
      const h = nv(n.id) * k;
      pos[n.id] = { x, y, so: 0, to: 0, c: n.c };
      nodes.push({
        id: n.id, label: n.label, c: n.c, v: nv(n.id), spalte: ci,
        x: f1(x), y: f1(y), h: Math.max(h, 1.5).toFixed(1),
        lx: f1(x + nodeW + 8), ly: y + h / 2,
      });
      y += h + gap;
    });
  });
  // ly = Mitte der Beschriftung. Kleine Knoten liegen dichter als eine Zeile:
  // je Spalte vom oberen Rand nach unten auf 17 Abstand (eine Zeile) schieben, dann vom
  // unteren Rand zurueck.
  for (let ci = 0; ci < cols.length; ci++) {
    const sp = nodes.filter((n) => n.spalte === ci);
    for (let i = 0; i < sp.length; i++) sp[i].ly = Math.max(sp[i].ly, i ? sp[i - 1].ly + 17 : 9);
    for (let i = sp.length - 1; i >= 0; i--) sp[i].ly = Math.min(sp[i].ly, i === sp.length - 1 ? H - 9 : sp[i + 1].ly - 17);
  }
  for (const n of nodes) n.ly = f1(n.ly);
  const paths = links.map((l) => {
    const a = pos[l.s], b = pos[l.t];
    const w = l.v * k;
    const x0 = a.x + nodeW, x1 = b.x;
    const y0 = a.y + a.so, y1 = b.y + b.to;
    a.so += w; b.to += w;
    const xm = (x0 + x1) / 2;
    return {
      s: l.s, t: l.t, v: l.v, c: a.c,
      d: `M${f1(x0)},${f1(y0)} C${f1(xm)},${f1(y0)} ${f1(xm)},${f1(y1)} ${f1(x1)},${f1(y1)} ` +
         `L${f1(x1)},${f1(y1 + w)} C${f1(xm)},${f1(y1 + w)} ${f1(xm)},${f1(y0 + w)} ${f1(x0)},${f1(y0 + w)} Z`,
    };
  });
  return { nodes, paths };
}

// Margen-Ampel. Die Stufen haengen an der Zielmarge, damit sie mitwandern,
// wenn das Ziel geaendert wird. Knapp verfehlt ist kein Fehlschlag und bekommt
// deshalb kein Rot. Gleiche Stufen wie bisher (Owner-Entscheidung 19.08.2026);
// das Mockup hatte abweichende Schwellen, die gelten nicht.
function margeKlasse(prozent, ziel) {
  if (prozent == null) return '';
  if (ziel == null || !(ziel > 0)) return prozent >= 0 ? 'pos' : 'neg';
  const d = prozent - ziel;
  if (d > 0.05) return 'm-top';
  if (d >= -0.05) return 'm-ok';
  if (d >= -2) return 'm-fast';
  if (d >= -4) return 'm-knapp';
  if (d > -7) return 'm-schwach';
  return 'm-bad';
}
const MARGE_FARBE = {
  'm-top': 'var(--marge-top)', 'm-ok': 'var(--marge-ok)', 'm-fast': 'var(--marge-fast)',
  'm-knapp': 'var(--marge-knapp)', 'm-schwach': 'var(--marge-schwach)', 'm-bad': 'var(--marge-bad)',
  pos: 'var(--ok)', neg: 'var(--bad)', '': 'var(--text-faint)',
};
const margeFarbe = (prozent, ziel) => MARGE_FARBE[margeKlasse(prozent, ziel)];

// Kalenderwoche nach ISO 8601 (Montag als Wochenbeginn).
function kw(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const j = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - j) / 86400000 - 3 + ((j.getUTCDay() + 6) % 7)) / 7);
}

// Marge je Woche (aus /api/marge-wochen) als Zeichnung in einer 1000×220-
// Flaeche, Ziellinie bei y 110. Balken = Abstand zur Zielmarge in Pp; ohne
// Zielmarge die Marge selbst. Eine Woche ohne Marge (kein Erloes oder
// Selbstkostensatz) bekommt keinen Balken und kein Farbsignal.
function margeWochen(W) {
  const ziel = W.map((w) => w.kennzahlen.wert.zielmarge_prozent).find((z) => z != null) ?? null;
  const werte = W.map((w) => (w.kennzahlen.wert.marge_prozent == null ? null : w.kennzahlen.wert.marge_prozent - (ziel || 0)));
  const farbe = (v) => (v == null ? 'var(--text-faint)' : v >= 0 ? 'var(--ok)' : 'var(--bad)');
  const da = werte.filter((v) => v != null);
  if (!da.length) return { ziel, leer: true, balken: [], linie: '', achse: [] };
  const max = Math.max(...da.map(Math.abs), 1);
  const b = 1000 / W.length;
  const y = (v) => 110 - v / max * 100;
  const balken = werte.map((v, i) => (v == null ? null : { x: b * i + b * 0.2, y: Math.min(110, y(v)), w: b * 0.6, h: Math.abs(v / max * 100), farbe: farbe(v) })).filter(Boolean);
  // Achsentext in ganzen Pp; String() schreibt -0 als 0 (Intl schriebe „-0“).
  const text = (v) => (v == null ? '–' : Math.round(v) > 0 ? '+' + Math.round(v) : String(Math.round(v)));
  const punkte = werte.map((v, i) => (v == null ? null : [b * (i + 0.5), y(v)])).filter(Boolean);
  return {
    ziel, leer: false, balken, linie: punkte.length > 1 ? smooth(punkte) : '',
    achse: W.map((w, i) => ({ montag: w.montag, kw: kw(w.montag), v: werte[i], marge: w.kennzahlen.wert.marge_prozent, farbe: farbe(werte[i]), text: text(werte[i]) })),
  };
}

// Modellfarben: feste Orange-Stufen nach Rang, damit dasselbe Modell auf jeder
// Seite dieselbe Farbe traegt. Rang kommt vom Aufrufer (nach Kosten sortiert).
const MODELL_FARBEN = ['var(--m-1)', 'var(--m-2)', 'var(--m-3)', 'var(--m-4)', 'var(--m-5)'];
const modellFarbe = (rang) => MODELL_FARBEN[rang] || 'var(--m-rest)';

if (typeof module !== 'undefined') {
  module.exports = { smooth, area, ring, arcPt, gauge, wasserfall, heatmap, stacked, sankey, margeKlasse, margeFarbe, modellFarbe, kw, margeWochen };
}
