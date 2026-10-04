// api/prices.js - Backend proxy for Hub prices.
//
// The browser only ever sees /api/prices. The upstream sheet URL lives in an environment
// variable and is never sent to the client, so nothing about the source appears in DevTools.
//
// Prices come from two places and are merged:
//   1. HUB_PRICES_SHEET_URL       the base list, ~2,000 skins
//   2. PRICE_OVERRIDES_SHEET_URL  a much smaller sheet we own, which wins where it has a row
//
// The override sheet is how prices get edited. The base sheet may not be writable by us, and
// even when it is, keeping our changes separate means we can always see what we changed.
import fs from 'fs';
import path from 'path';

let cachedData = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000;

function parseRow(rowStr) {
  const result = [];
  let insideQuotes = false;
  let entry = '';
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(entry.trim());
      entry = '';
    } else {
      entry += char;
    }
  }
  result.push(entry.trim());
  return result;
}

/**
 * `minCols` guards against half-written rows in the base sheet, which has five columns.
 * The override sheet is allowed to be as narrow as "Skin Name, Hub Value", so it passes 2 -
 * with the default of 4 every override row was being discarded silently.
 */
function parseCsv(csvText, minCols = 4) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseRow(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length >= minCols) {
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = values[idx] || '';
      });
      const skinName = (item['Skin Name'] || '').trim();
      if (!skinName) continue;
      const val = item['Hub Value'] || item['Base Value'] || '0';
      // Whitelist only legitimate Hub fields: no upstream author or internal notes can leak to F12
      rows.push({
        'Skin Name': skinName,
        'Type': (item['Type'] || '').trim(),
        'Skin Rarity': (item['Skin Rarity'] || '').trim(),
        'Hub Value': val,
        'Base Value': val,
        'Obtainable By': (item['Obtainable By'] || 'N/A').trim()
      });
    }
  }

  return rows;
}

/** Skins are identified by name plus type, because the same name exists on several weapons. */
const keyOf = (name, type) => `${String(name || '').trim().toLowerCase()}|${String(type || '').trim().toLowerCase()}`;

/**
 * The override sheet needs only two columns to be useful: "Skin Name" and "Hub Value".
 * "Type" is strongly recommended, since without it an override applies to every skin sharing
 * that name. Any other column present replaces the base row's value for that column.
 *
 * A row whose skin is not in the base list is added, so this can introduce skins too.
 */
async function loadOverrides() {
  const url = process.env.PRICE_OVERRIDES_SHEET_URL;
  if (!url) return [];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Server/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = parseCsv(await res.text(), 2);
    // No minimum row count here - one override is a legitimate override.
    return rows.filter((r) => (r['Skin Name'] || '').trim() !== '');
  } catch (err) {
    // Never let a broken override sheet take the price list down with it.
    console.warn('[HubPrices] override sheet unavailable, serving base prices only:', err.message);
    return [];
  }
}

function applyOverrides(base, overrides) {
  if (!overrides.length) return base;

  const index = new Map();
  base.forEach((row, i) => index.set(keyOf(row['Skin Name'], row['Type']), i));

  let replaced = 0;
  let added = 0;

  for (const ov of overrides) {
    const k = keyOf(ov['Skin Name'], ov['Type']);
    const at = index.get(k);

    if (at !== undefined) {
      // merge column by column, so an override sheet carrying only a price does not wipe
      // the rarity and obtainability the base row already had
      const merged = { ...base[at] };
      for (const [col, v] of Object.entries(ov)) {
        if (col === 'Hub Value' || col === 'Base Value') continue;
        if (String(v).trim() !== '') merged[col] = v;
      }
      const val = ov['Hub Value'] || ov['Base Value'];
      const baseVal = base[at]['Hub Value'] || base[at]['Base Value'];
      const cleanBase = String(baseVal || '').replace(/,/g, '').trim().toLowerCase();
      const cleanOv = String(val || '').replace(/,/g, '').trim().toLowerCase();
      const baseHasRealPrice = cleanBase !== '' && cleanBase !== '0' && cleanBase !== 'tbd' && cleanBase !== '-' && !isNaN(Number(cleanBase));
      const ovIsTbd = cleanOv === '' || cleanOv === 'tbd' || cleanOv === '-' || cleanOv === 'n/a';

      if (ovIsTbd && baseHasRealPrice) {
        // Do not downgrade an established base price to TBD/placeholder
      } else if (val && String(val).trim() !== '') {
        merged['Hub Value'] = val;
        merged['Base Value'] = val;
      }
      base[at] = merged;
      replaced++;
    } else {
      const val = ov['Hub Value'] || ov['Base Value'] || '0';
      base.push({
        'Skin Name': (ov['Skin Name'] || '').trim(),
        'Type': (ov['Type'] || '').trim(),
        'Skin Rarity': (ov['Skin Rarity'] || '').trim(),
        'Hub Value': val,
        'Base Value': val,
        'Obtainable By': (ov['Obtainable By'] || 'N/A').trim()
      });
      added++;
    }
  }

  console.log(`[HubPrices] overrides applied: ${replaced} replaced, ${added} added`);
  return base;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  if (cachedData && now - lastFetchTime < CACHE_TTL_MS) {
    return res.status(200).json(cachedData);
  }

  let base = null;

  // 1. Upstream sheet, configured in the environment
  const privateSheetUrl = process.env.HUB_PRICES_SHEET_URL;
  if (privateSheetUrl) {
    try {
      const response = await fetch(privateSheetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Server/1.0' },
      });
      if (response.ok) {
        const parsed = parseCsv(await response.text());
        // A short response means the link is wrong or the sheet is mid-edit; fall through to
        // the committed list rather than serving a half-empty price index.
        if (parsed.length > 500) base = parsed;
      }
    } catch (err) {
      console.warn('[HubPrices] sheet fetch failed, falling back to local database:', err.message);
    }
  }

  // 2. Committed fallback, so the site never loses prices entirely
  if (!base) {
    try {
      const localJsonPath = path.join(process.cwd(), 'public/data/hub_prices.json');
      if (fs.existsSync(localJsonPath)) {
        base = JSON.parse(fs.readFileSync(localJsonPath, 'utf8'));
      }
    } catch (err) {
      console.error('[HubPrices] error loading local json:', err);
    }
  }

  if (!base) return res.status(200).json([]);

  // 3. Our own edits, applied whichever source above served
  const merged = applyOverrides(base, await loadOverrides());

  cachedData = merged;
  lastFetchTime = now;
  return res.status(200).json(merged);
}
