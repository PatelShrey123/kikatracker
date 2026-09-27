#!/usr/bin/env node
/**
 * Lists skins that exist in Kirka but are not yet in our price sheet, formatted so the rows can
 * be pasted straight into Google Sheets.
 *
 * Why this exists: we maintain our own valuations, but we still need to know when a new skin
 * lands. Kirka's own API is the authority on what skins exist - it is where the skins actually
 * come from - so we watch that rather than watching somebody else's sheet and waiting for them
 * to notice first.
 *
 * Every column is filled from the API except "Obtainable By" and the value itself, because
 * neither is something Kirka publishes. Those are ours to decide.
 *
 *   node scripts/missing-skins.mjs              skins in circulation that we have not priced
 *   node scripts/missing-skins.mjs --all        include ones nobody owns yet
 *   node scripts/missing-skins.mjs --live       compare against the live sheet, not the snapshot
 *   node scripts/missing-skins.mjs --days 30    only skins Kirka added in the last 30 days
 *
 * By default this hides skins with zero owners. Kirka's catalog carries a lot of content that
 * has never dropped - at the time of writing, 895 of the 943 we had not priced were owned by
 * nobody. Pricing those is guesswork about items that may never exist in a trade, so the
 * default list is the 48 that people actually hold.
 */

import fs from 'node:fs';
import path from 'node:path';

const ITEMS_URL = 'https://api.kirka.io/api/inventory/items';

// --------------------------------------------------------------------------- args
const argv = process.argv.slice(2);
const useLive = argv.includes('--live');
const includeUnowned = argv.includes('--all');
const daysArg = argv.indexOf('--days');
const days = daysArg !== -1 ? Number(argv[daysArg + 1]) : null;

// --------------------------------------------------------------------------- env
function readEnv(name) {
  if (process.env[name]) return process.env[name];
  for (const file of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    const line = fs.readFileSync(p, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const apiKey = readEnv('KIRKA_API_KEY');
if (!apiKey) {
  console.error('KIRKA_API_KEY not found in the environment or .env.local');
  process.exit(1);
}

// --------------------------------------------------------------------------- helpers
/** Same identity the price sheet uses: a name can repeat across weapons. */
const keyOf = (name, type) =>
  `${String(name || '').trim().toLowerCase()}|${String(type || '').trim().toLowerCase()}`;

/** Kirka says MYTHICAL; the sheet says Mythical. */
const titleCase = (s) =>
  String(s || '').toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());

/** A skin's "type" in the sheet is the weapon it belongs to, or Character for body skins. */
function typeOf(item) {
  if (item.type === 'BODY_SKIN') return 'Character';
  return item.parent?.name || '';
}

function parseCsvRows(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const row = (r) => {
    const out = [];
    let q = false, cur = '';
    for (const c of r) {
      if (c === '"') q = !q;
      else if (c === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = row(lines[0]);
  return lines.slice(1).map((l) => {
    const v = row(l);
    const o = {};
    headers.forEach((h, i) => { o[h] = v[i] || ''; });
    return o;
  });
}

// --------------------------------------------------------------------------- load both sides
async function loadPriced() {
  if (useLive) {
    const url = readEnv('HUB_PRICES_SHEET_URL');
    if (!url) {
      console.error('--live needs HUB_PRICES_SHEET_URL set');
      process.exit(1);
    }
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub/1.0' } });
    if (!res.ok) throw new Error(`sheet returned ${res.status}`);
    return parseCsvRows(await res.text());
  }
  const p = path.join(process.cwd(), 'public/data/hub_prices.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function loadKirka() {
  const res = await fetch(ITEMS_URL, { headers: { ApiKey: apiKey, 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Kirka API returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || [];
}

// --------------------------------------------------------------------------- main
const [priced, catalog] = await Promise.all([loadPriced(), loadKirka()]);

const have = new Set(priced.map((r) => keyOf(r['Skin Name'], r['Type'])));

let missing = catalog
  .filter((it) => it.type === 'WEAPON_SKIN' || it.type === 'BODY_SKIN')
  .filter((it) => !have.has(keyOf(it.name, typeOf(it))));

if (!includeUnowned) {
  missing = missing.filter((it) => (it.totalOwned ?? 0) > 0);
}

if (days) {
  const cutoff = Date.now() - days * 86_400_000;
  missing = missing.filter((it) => new Date(it.createdAt).getTime() >= cutoff);
}

// newest first - a new drop is the reason you are running this
missing.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

console.log(`Kirka catalog : ${catalog.length} items`);
console.log(`Priced already: ${priced.length} rows  (${useLive ? 'live sheet' : 'hub_prices.json'})`);
console.log(`Not yet priced: ${missing.length}${includeUnowned ? '  (including ones nobody owns)' : '  (in circulation; pass --all for the rest)'}${days ? `, added in the last ${days} days` : ''}`);

if (!missing.length) {
  console.log('\nNothing missing - every Kirka skin is in the sheet.');
  process.exit(0);
}

// Tab separated, because pasting TSV into Google Sheets fills across columns correctly.
// Column order matches the sheet so it drops straight in.
const header = ['Skin Name', 'Type', 'Skin Rarity', 'Hub Value', 'Obtainable By'];
const lines = missing.map((it) =>
  [
    it.name,
    typeOf(it),
    titleCase(it.rarity),
    'TBD',                       // ours to decide
    '',                          // ours to fill in
  ].join('\t')
);

const outPath = path.join(process.cwd(), 'missing-skins.tsv');
fs.writeFileSync(outPath, [header.join('\t'), ...lines].join('\n') + '\n', 'utf8');

console.log(`\nWritten to ${outPath} - open it, copy, paste into the sheet.\n`);
console.log('Newest 15, for a quick look:\n');
console.log(['Added', 'Skin', 'Type', 'Rarity', 'Owners'].join('\t'));
missing.slice(0, 15).forEach((it) => {
  console.log([
    new Date(it.createdAt).toISOString().slice(0, 10),
    it.name,
    typeOf(it),
    titleCase(it.rarity),
    (it.totalOwned ?? 0).toLocaleString(),
  ].join('\t'));
});
