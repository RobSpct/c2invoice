'use strict';
// Legt die numerischen Felder an, in die der Abgleich die Kennzahlen schreibt.
// Kommentare lassen sich in Jira weder filtern noch summieren — fuer Auswertung
// braucht es echte Felder.
//
// Aufruf:  node integration/jira-felder-anlegen.js [--dry-run]
// Voraussetzung: JIRA_API_TOKEN und JIRA_EMAIL gesetzt, Konto mit Adminrechten.
const fs = require('node:fs');
const path = require('node:path');

const config = require('../config.json');
const BASE = config.jira.baseUrl.replace(/\/$/, '');

// Zahl mit Nachkommastellen. Der Typ "float" deckt Geldbetraege und Stunden ab.
const TYP_ZAHL = 'com.atlassian.jira.plugin.system.customfieldtypes:float';
const SUCHER_ZAHL = 'com.atlassian.jira.plugin.system.customfieldtypes:exactnumber';

const FELDER = [
  { schluessel: 'kosten_usd', name: 'Token-Kosten USD',
    beschreibung: 'API-Gegenwert der verbrauchten Tokens, einschliesslich begleitender Werkzeuge. Automatisch vom Token-Ledger gepflegt.' },
  { schluessel: 'tokens', name: 'Tokens gesamt',
    beschreibung: 'Verbrauchte Tokens insgesamt (Arbeitssitzung plus Werkzeuge). Automatisch vom Token-Ledger gepflegt.' },
  { schluessel: 'stunden', name: 'Arbeitszeit Stunden',
    beschreibung: 'Aktive Arbeitszeit ohne Pausen. Automatisch vom Token-Ledger gepflegt.' },
  { schluessel: 'arbeitswert_eur', name: 'Arbeitswert EUR',
    beschreibung: 'Arbeitszeit multipliziert mit dem Stundensatz des Projekts. Automatisch vom Token-Ledger gepflegt.' },
];

function auth() {
  const token = process.env[config.jira.tokenEnvVar] || process.env.JIRA_API_TOKEN;
  const email = config.jira.email || process.env.JIRA_EMAIL;
  if (!token || !email) {
    throw new Error(
      `Zugang fehlt. Erwartet: ${config.jira.tokenEnvVar} und jira.email (oder JIRA_EMAIL).`
    );
  }
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

async function jira(pfad, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + pfad, {
    method,
    headers: { authorization: auth(), 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${pfad} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

// Vorhandene Felder desselben Namens wiederverwenden, statt Doppel anzulegen.
async function vorhandene() {
  const alle = await jira('/rest/api/3/field');
  const map = new Map();
  for (const f of alle) {
    if (f.custom) map.set(f.name, f.id);
  }
  return map;
}

// Ein Feld ist erst beschreibbar, wenn es auf dem Bearbeiten-Bildschirm liegt.
// Ohne diesen Schritt existiert es, laesst sich aber nicht setzen — die
// bekannte Falle bei Jira-Feldern.
async function aufBildschirme(feldId) {
  const gelegt = [];
  const screens = await jira('/rest/api/3/screens?maxResults=100');
  for (const s of (screens.values || [])) {
    let tabs;
    try {
      tabs = await jira(`/rest/api/3/screens/${s.id}/tabs`);
    } catch {
      continue;
    }
    const tab = (tabs || [])[0];
    if (!tab) continue;
    try {
      await jira(`/rest/api/3/screens/${s.id}/tabs/${tab.id}/fields`, {
        method: 'POST', body: { fieldId: feldId },
      });
      gelegt.push(s.name);
    } catch (err) {
      // Bereits vorhanden ist kein Fehler.
      if (!/already|exists/i.test(err.message)) gelegt.push(`${s.name} (fehlgeschlagen)`);
    }
  }
  return gelegt;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const da = await vorhandene();
  const ergebnis = {};

  for (const f of FELDER) {
    if (da.has(f.name)) {
      ergebnis[f.schluessel] = da.get(f.name);
      console.log(`  ${f.name}: vorhanden (${da.get(f.name)})`);
      continue;
    }
    if (dryRun) {
      console.log(`  ${f.name}: wuerde angelegt`);
      continue;
    }
    const neu = await jira('/rest/api/3/field', {
      method: 'POST',
      body: { name: f.name, description: f.beschreibung, type: TYP_ZAHL, searcherKey: SUCHER_ZAHL },
    });
    ergebnis[f.schluessel] = neu.id;
    const screens = await aufBildschirme(neu.id);
    console.log(`  ${f.name}: angelegt (${neu.id}), auf ${screens.length} Bildschirm(e) gelegt`);
  }

  if (dryRun) {
    console.log('\nProbelauf beendet, nichts angelegt.');
    return;
  }

  // Feld-Kennungen in die Konfiguration schreiben, damit der Abgleich sie kennt.
  const pfad = path.join(__dirname, '..', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(pfad, 'utf8'));
  cfg.jira.felder = { ...(cfg.jira.felder || {}), ...ergebnis };
  fs.writeFileSync(pfad, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

  console.log('\nFeld-Kennungen in config.json eingetragen:');
  for (const [k, v] of Object.entries(ergebnis)) console.log(`  ${k}: ${v}`);
}

main().catch((err) => {
  console.error('Fehlgeschlagen:', err.message);
  process.exitCode = 1;
});
