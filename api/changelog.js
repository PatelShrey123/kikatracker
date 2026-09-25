// api/changelog.js - what has moved in the price sheet since the last committed snapshot.
//
// The sheet is the live source of truth; public/data/hub_prices.json is the last snapshot that was
// committed. Diffing one against the other gives the pending changes without storing anything: no
// database, no cron, no second copy to keep in step.
//
// Once a snapshot is committed the diff goes empty again, and the change becomes a permanent entry
// in the generated history (scripts/build-price-changelog.mjs).
import fs from 'fs';
import path from 'path';
import { diffPrices } from './_priceDiff.js';

let cached = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000;

// Same CSV shape as api/prices.js; the sheet is published as CSV.
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const parseRow = (rowStr) => {
    const result = [];
    let insideQuotes = false;
    let entry = '';
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"') insideQuotes = !insideQuotes;
      else if (char === ',' && !insideQuotes) { result.push(entry.trim()); entry = ''; }
      else entry += char;
    }
    result.push(entry.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < 4) continue;
    const item = {};
    headers.forEach((h, idx) => { item[h] = values[idx] ?? ''; });
    if (String(item['Skin Name'] ?? '').trim()) rows.push(item);
  }
  return rows;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();
  if (cached && now - lastFetchTime < CACHE_TTL_MS) return res.status(200).json(cached);

  // the last committed snapshot is the "before"
  let snapshot = [];
  try {
    const p = path.join(process.cwd(), 'public/data/hub_prices.json');
    if (fs.existsSync(p)) snapshot = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error('[Changelog] Could not read the snapshot:', err.message);
  }

  // the live sheet is the "after"
  let live = null;
  const sheetUrl = process.env.HUB_PRICES_SHEET_URL;
  if (sheetUrl) {
    try {
      const response = await fetch(sheetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Server/1.0' } });
      if (response.ok) {
        const parsed = parseCsv(await response.text());
        // guard against a truncated or failed export wiping the list and reporting 1000 removals
        if (parsed.length > 500) live = parsed;
        else console.warn(`[Changelog] Sheet returned only ${parsed.length} rows, ignoring`);
      }
    } catch (err) {
      console.warn('[Changelog] Sheet fetch failed:', err.message);
    }
  }

  const payload = live
    ? {
        generatedAt: new Date().toISOString(),
        sheetReachable: true,
        snapshotCount: snapshot.length,
        sheetCount: live.length,
        pending: diffPrices(snapshot, live),
      }
    : {
        generatedAt: new Date().toISOString(),
        sheetReachable: false,
        snapshotCount: snapshot.length,
        sheetCount: 0,
        pending: { added: [], removed: [], changed: [], total: 0 },
      };

  cached = payload;
  lastFetchTime = now;
  return res.status(200).json(payload);
}
