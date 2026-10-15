'use strict';
// Preise je Modell, Quelle: LiteLLM-Preisliste (dieselbe Quelle wie ccusage).
// Wird taeglich geholt und lokal zwischengespeichert; ohne Netz greift die
// eingebaute Tabelle. Alle Werte sind USD pro einzelnem Token.
const fs = require('node:fs');
const path = require('node:path');

const CACHE_PATH = path.join(__dirname, 'data', 'pricing-cache.json');
const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
// Version 2: Rang je Anbieter und Staffelpreise. Ein aelterer Speicher gilt
// als veraltet (neu holen, ohne Netz trotzdem nutzen).
const CACHE_VERSION = 2;

// Fallback in USD pro Token, nur fuer den Fall ohne Netz und ohne Zwischen-
// speicher. Werte aus der LiteLLM-Liste vom 15.10.2026 (Eintraege @default bzw.
// mit Datum, nicht die regionalen mit Aufschlag). Ein Treffer hier gilt als
// "fallback" und wird neu bepreist, sobald die Liste geladen ist (H3).
// 1h-Cache-Writes kosten das Doppelte der 5m-Writes (Anthropic-Preisliste).
const FALLBACK = {
  'claude-fable-5-1':         { in: 10e-6,  out: 50e-6,  cw5m: 12.5e-6,  cw1h: 20e-6,   cr: 0.25e-6 },
  'claude-fable-5':           { in: 10e-6,  out: 50e-6,  cw5m: 12.5e-6,  cw1h: 20e-6,   cr: 1e-6 },
  'claude-opus-5-5':          { in: 4e-6,   out: 20e-6,  cw5m: 5e-6,     cw1h: 8e-6,    cr: 0.2e-6 },
  'claude-opus-5':            { in: 5e-6,   out: 25e-6,  cw5m: 6.25e-6,  cw1h: 10e-6,   cr: 0.5e-6 },
  'claude-opus-4-8':          { in: 5e-6,   out: 25e-6,  cw5m: 6.25e-6,  cw1h: 10e-6,   cr: 0.5e-6 },
  'claude-opus-4-7':          { in: 5e-6,   out: 25e-6,  cw5m: 6.25e-6,  cw1h: 10e-6,   cr: 0.5e-6 },
  'claude-opus-4-6':          { in: 5e-6,   out: 25e-6,  cw5m: 6.25e-6,  cw1h: 10e-6,   cr: 0.5e-6 },
  'claude-opus-4-5':          { in: 5e-6,   out: 25e-6,  cw5m: 6.25e-6,  cw1h: 10e-6,   cr: 0.5e-6 },
  'claude-opus-4-1':          { in: 15e-6,  out: 75e-6,  cw5m: 18.75e-6, cw1h: 30e-6,   cr: 1.5e-6 },
  'claude-sonnet-5-5':        { in: 2e-6,   out: 10e-6,  cw5m: 2.5e-6,   cw1h: 4e-6,    cr: 0.1e-6 },
  'claude-sonnet-5':          { in: 2e-6,   out: 10e-6,  cw5m: 2.5e-6,   cw1h: 4e-6,    cr: 0.2e-6 },
  'claude-sonnet-4-5':        { in: 3e-6,   out: 15e-6,  cw5m: 3.75e-6,  cw1h: 6e-6,    cr: 0.3e-6 },
  'claude-haiku-5-5':         { in: 0.1e-6, out: 0.5e-6, cw5m: 0.125e-6, cw1h: 0.2e-6,  cr: 0.01e-6 },
  'claude-haiku-4-5-20251001':{ in: 1e-6,   out: 5e-6,   cw5m: 1.25e-6,  cw1h: 2e-6,    cr: 0.1e-6 },
  'claude-3-5-haiku-20241022':{ in: 0.8e-6, out: 4e-6,   cw5m: 1e-6,     cw1h: 1.6e-6,  cr: 0.08e-6 },
};

// Modelle ohne echten API-Aufruf. Muessen 0 kosten, sonst entstehen Fantasiebetraege.
const SYNTHETIC = new Set(['<synthetic>', 'synthetic', '<unknown>']);

// Lokal laufende Modelle tragen ein Praefix wie "ollama/". Sie verursachen
// keine API-Kosten. Ohne diese Ausnahme wuerde die Praefix-Suche in priceFor()
// frueher oder spaeter einen fremden Preis anlegen und Betraege erfinden, die
// es nie gab — auf einer Rechnung faellt das niemandem mehr auf.
const LOKAL_PRAEFIXE = ['ollama/', 'lokal/', 'local/', 'lmstudio/', 'llamacpp/'];

function istLokal(model) {
  const m = String(model || '').toLowerCase();
  return LOKAL_PRAEFIXE.some((p) => m.startsWith(p));
}

let table = null;
let source = 'none';
let tableVersion = null;

// Ein Preis je Token ist endlich, nicht negativ und unter 0,001 USD. Alles
// andere (Infinity aus 1e999, Text, negative Werte) kaeme sonst ungeprueft in
// cost_usd und ueber die Neubepreisung in die ganze Historie (Security-Review H3).
const PREISFELDER = ['in', 'out', 'cw5m', 'cw1h', 'cr'];
const preisOk = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 1e-3;
function eintragOk(p) {
  if (!p || typeof p !== 'object' || !PREISFELDER.every((f) => preisOk(p[f]))) return false;
  return p.ueber200k === undefined || PREISFELDER.every((f) => preisOk(p.ueber200k[f]));
}
// Ohne Prototyp: Modellnamen wie "constructor" oder "__proto__" sind sonst Treffer.
function nurGueltige(prices) {
  const out = Object.create(null);
  for (const [k, v] of Object.entries(prices || {})) if (!['__proto__', 'constructor', 'prototype'].includes(k) && eintragOk(v)) out[k] = v;
  return out;
}

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (raw && raw.fetchedAt && raw.prices) return { ...raw, prices: nurGueltige(raw.prices) };
  } catch { /* kein oder kaputter Cache */ }
  return null;
}

function saveCache(prices) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ fetchedAt: Date.now(), version: CACHE_VERSION, prices }, null, 1));
  } catch { /* Cache ist optional */ }
}

// LiteLLM-Rohdaten auf unser schmales Format reduzieren.
function normalizeLiteLLM(json) {
  const out = Object.create(null);
  const rangVon = new Map();
  for (const [name, e] of Object.entries(json)) {
    if (!e || typeof e !== 'object') continue;
    if (e.litellm_provider !== 'anthropic' && !name.includes('claude')) continue;
    const inp = e.input_cost_per_token;
    const outp = e.output_cost_per_token;
    if (typeof inp !== 'number' || typeof outp !== 'number') continue;
    const cw5m = e.cache_creation_input_token_cost ?? inp * 1.25;
    const key = stripPrefix(name);
    // Mehrere Anbieter ergeben denselben Schluessel (vertex_ai/claude-x,
    // anthropic/claude-x, claude-x). Ohne Rang gewann der letzte in der Datei,
    // z. B. ein regionaler Eintrag mit 10 % Aufschlag (H3).
    const r = rang(name);
    if (out[key] && rangVon.get(key) <= r) continue;
    rangVon.set(key, r);
    const p = {
      in: inp,
      out: outp,
      cw5m,
      // LiteLLM fuehrt den 1h-Preis nicht immer; Anthropic berechnet das Doppelte.
      cw1h: e.cache_creation_input_token_cost_above_1hr ?? cw5m * 1.6,
      cr: e.cache_read_input_token_cost ?? inp * 0.1,
    };
    // Staffel: ueber 200k Eingabe-Tokens gilt fuer den ganzen Request der hoehere Preis.
    const in2 = e.input_cost_per_token_above_200k_tokens;
    const out2 = e.output_cost_per_token_above_200k_tokens;
    if (typeof in2 === 'number' && typeof out2 === 'number') {
      const cw5m2 = e.cache_creation_input_token_cost_above_200k_tokens ?? in2 * 1.25;
      p.ueber200k = {
        in: in2, out: out2, cw5m: cw5m2,
        cw1h: e.cache_creation_input_token_cost_above_1hr_above_200k_tokens ?? cw5m2 * 1.6,
        cr: e.cache_read_input_token_cost_above_200k_tokens ?? in2 * 0.1,
      };
    }
    out[key] = p;
  }
  return nurGueltige(out);
}

// Wer bei gleichem Schluessel gewinnt: ohne Praefix, dann anthropic/, dann der Rest.
function rang(name) {
  if (!name.includes('/')) return 0;
  return name.startsWith('anthropic/') ? 1 : 2;
}

// "anthropic/claude-opus-4" und "claude-opus-4" sollen denselben Schluessel ergeben.
function stripPrefix(name) {
  const i = name.indexOf('/');
  return i === -1 ? name : name.slice(i + 1);
}

async function refresh({ force = false } = {}) {
  const cached = loadCache();
  const fresh = cached && cached.version === CACHE_VERSION && Date.now() - cached.fetchedAt < MAX_CACHE_AGE_MS;
  if (cached && fresh && !force) {
    table = cached.prices;
    source = 'cache';
    tableVersion = cached.version || null;
    return table;
  }
  try {
    const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const prices = normalizeLiteLLM(await res.json());
    if (Object.keys(prices).length === 0) throw new Error('leere Preisliste');
    table = prices;
    source = 'litellm';
    tableVersion = CACHE_VERSION;
    saveCache(prices);
    return table;
  } catch (err) {
    // Netz weg oder Format geaendert: alter Cache ist besser als nichts.
    if (cached) {
      table = cached.prices;
      source = 'cache-stale';
      tableVersion = cached.version || null;
    } else {
      table = null;
      source = 'fallback';
      tableVersion = null;
    }
    return table;
  }
}

// Preis eines Modells samt der Auskunft, wie belastbar er ist:
//   frei       kein API-Aufruf (synthetisch, lokal) — 0 ist hier richtig
//   exakt      das Modell steht in der Preisliste
//   fallback   nur die eingebaute Tabelle kennt es (kein Netz, kein Speicher);
//              wird neu bepreist, sobald die Liste da ist (H3)
//   geschaetzt nur ein aehnlich benanntes Modell steht dort; dessen Preis gilt
//   ohne       nichts passt — das Modell kostet 0, obwohl es etwas gekostet hat
// Die letzten beiden muessen sichtbar sein: eine Schaetzung und eine Luecke
// sehen in einer Summe genauso aus wie ein echter Preis.
function preisAuskunft(model) {
  if (!model || SYNTHETIC.has(model) || istLokal(model)) return { preis: null, art: 'frei' };
  const key = stripPrefix(model);
  if (table && Object.hasOwn(table, key)) return { preis: table[key], art: 'exakt' };
  if (Object.hasOwn(FALLBACK, key)) return { preis: FALLBACK[key], art: 'fallback' };
  // Unbekannte Variante: laengster passender Praefix aus den bekannten Tabellen.
  const pools = [table, FALLBACK].filter(Boolean);
  let best = null;
  let bestLen = 0;
  for (const pool of pools) {
    for (const name of Object.keys(pool)) {
      if ((key.startsWith(name) || name.startsWith(key)) && name.length > bestLen) {
        best = pool[name];
        bestLen = name.length;
      }
    }
    if (best) return { preis: best, art: 'geschaetzt' };
  }
  return { preis: null, art: 'ohne' };
}

function priceFor(model) {
  return preisAuskunft(model).preis;
}

function preisArt(model) {
  return preisAuskunft(model).art;
}

// usage: { input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read }
function costOf(model, usage) {
  const basis = priceFor(model);
  if (!basis) return 0;
  // Anthropic: ueber 200k Eingabe (inkl. Cache) kostet der ganze Request den Staffelpreis.
  const eingabe = (usage.input_tokens || 0) + (usage.cache_w_5m || 0) + (usage.cache_w_1h || 0) + (usage.cache_read || 0);
  const p = basis.ueber200k && eingabe > 200000 ? basis.ueber200k : basis;
  return (
    (usage.input_tokens || 0) * p.in +
    (usage.output_tokens || 0) * p.out +
    (usage.cache_w_5m || 0) * p.cw5m +
    (usage.cache_w_1h || 0) * p.cw1h +
    (usage.cache_read || 0) * p.cr
  );
}

function isSynthetic(model) {
  return !model || SYNTHETIC.has(model) || istLokal(model);
}

// version: Version der geladenen Liste (null = alter Speicher oder keine Liste).
function info() {
  return { source, version: tableVersion, models: table ? Object.keys(table).length : Object.keys(FALLBACK).length };
}

// Nur fuer Tests: eine Preisliste setzen, ohne Netz.
function setzeTabelle(t, quelle = 'test', version = CACHE_VERSION) { table = t; source = quelle; tableVersion = version; }
const tabelle = () => table;

module.exports = { refresh, priceFor, preisArt, costOf, isSynthetic, istLokal, info, FALLBACK, normalizeLiteLLM, setzeTabelle, tabelle };
