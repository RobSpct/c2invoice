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

// Fallback in USD pro Token. Deckt die real genutzten Modelle ab.
// 1h-Cache-Writes kosten das Doppelte der 5m-Writes (Anthropic-Preisliste).
const FALLBACK = {
  'claude-opus-5':            { in: 15e-6,  out: 75e-6,  cw5m: 18.75e-6, cw1h: 30e-6,   cr: 1.5e-6 },
  'claude-fable-5':           { in: 15e-6,  out: 75e-6,  cw5m: 18.75e-6, cw1h: 30e-6,   cr: 1.5e-6 },
  'claude-opus-4-8':          { in: 15e-6,  out: 75e-6,  cw5m: 18.75e-6, cw1h: 30e-6,   cr: 1.5e-6 },
  'claude-opus-4-1':          { in: 15e-6,  out: 75e-6,  cw5m: 18.75e-6, cw1h: 30e-6,   cr: 1.5e-6 },
  'claude-sonnet-5':          { in: 3e-6,   out: 15e-6,  cw5m: 3.75e-6,  cw1h: 6e-6,    cr: 0.3e-6 },
  'claude-sonnet-4-5':        { in: 3e-6,   out: 15e-6,  cw5m: 3.75e-6,  cw1h: 6e-6,    cr: 0.3e-6 },
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

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (raw && raw.fetchedAt && raw.prices) return raw;
  } catch { /* kein oder kaputter Cache */ }
  return null;
}

function saveCache(prices) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ fetchedAt: Date.now(), prices }, null, 1));
  } catch { /* Cache ist optional */ }
}

// LiteLLM-Rohdaten auf unser schmales Format reduzieren.
function normalizeLiteLLM(json) {
  const out = {};
  for (const [name, e] of Object.entries(json)) {
    if (!e || typeof e !== 'object') continue;
    if (e.litellm_provider !== 'anthropic' && !name.includes('claude')) continue;
    const inp = e.input_cost_per_token;
    const outp = e.output_cost_per_token;
    if (typeof inp !== 'number' || typeof outp !== 'number') continue;
    const cw5m = e.cache_creation_input_token_cost ?? inp * 1.25;
    out[stripPrefix(name)] = {
      in: inp,
      out: outp,
      cw5m,
      // LiteLLM fuehrt den 1h-Preis nicht immer; Anthropic berechnet das Doppelte.
      cw1h: e.cache_creation_input_token_cost_above_1hr ?? cw5m * 1.6,
      cr: e.cache_read_input_token_cost ?? inp * 0.1,
    };
  }
  return out;
}

// "anthropic/claude-opus-4" und "claude-opus-4" sollen denselben Schluessel ergeben.
function stripPrefix(name) {
  const i = name.indexOf('/');
  return i === -1 ? name : name.slice(i + 1);
}

async function refresh({ force = false } = {}) {
  const cached = loadCache();
  const fresh = cached && Date.now() - cached.fetchedAt < MAX_CACHE_AGE_MS;
  if (cached && fresh && !force) {
    table = cached.prices;
    source = 'cache';
    return table;
  }
  try {
    const res = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const prices = normalizeLiteLLM(await res.json());
    if (Object.keys(prices).length === 0) throw new Error('leere Preisliste');
    table = prices;
    source = 'litellm';
    saveCache(prices);
    return table;
  } catch (err) {
    // Netz weg oder Format geaendert: alter Cache ist besser als nichts.
    if (cached) {
      table = cached.prices;
      source = 'cache-stale';
    } else {
      table = null;
      source = 'fallback';
    }
    return table;
  }
}

function priceFor(model) {
  if (!model || SYNTHETIC.has(model) || istLokal(model)) return null;
  const key = stripPrefix(model);
  if (table && table[key]) return table[key];
  if (FALLBACK[key]) return FALLBACK[key];
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
    if (best) return best;
  }
  return null;
}

// usage: { input_tokens, output_tokens, cache_w_5m, cache_w_1h, cache_read }
function costOf(model, usage) {
  const p = priceFor(model);
  if (!p) return 0;
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

function info() {
  return { source, models: table ? Object.keys(table).length : Object.keys(FALLBACK).length };
}

module.exports = { refresh, priceFor, costOf, isSynthetic, istLokal, info, FALLBACK };
