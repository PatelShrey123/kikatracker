// api/prices.js - Live Hub Valuation API proxy.
// Fetches directly from upstream live market price feed (Bolt & Community Valuation),
// completely bypassing Google Sheets and mapping values cleanly into Hub Valuation.
import fs from 'fs';
import path from 'path';

let cachedData = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache

const UPSTREAM_PRICE_URL = 'https://kirka.lukeskywalk.com/priceList.json';

const rarityMap = {
  'M': 'Mythical',
  'L': 'Legendary',
  'E': 'Epic',
  'R': 'Rare',
  'C': 'Common'
};

let obtainableMap = null;
function getObtainableMap() {
  if (obtainableMap && Object.keys(obtainableMap).length > 0) return obtainableMap;
  try {
    const fileUrl = new URL('../public/data/obtainable_methods.json', import.meta.url);
    if (fs.existsSync(fileUrl)) {
      obtainableMap = JSON.parse(fs.readFileSync(fileUrl, 'utf8'));
      return obtainableMap;
    }
  } catch {}
  try {
    const p1 = path.join(process.cwd(), 'public/data/obtainable_methods.json');
    if (fs.existsSync(p1)) {
      obtainableMap = JSON.parse(fs.readFileSync(p1, 'utf8'));
      return obtainableMap;
    }
  } catch {}
  obtainableMap = {};
  return obtainableMap;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  if (cachedData && now - lastFetchTime < CACHE_TTL_MS) {
    return res.status(200).json(cachedData);
  }

  let base = null;
  const obtMap = getObtainableMap();

  // 1. Fetch directly from upstream live price feed
  try {
    const response = await fetch(UPSTREAM_PRICE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Server/1.0' },
    });
    if (response.ok) {
      const boltList = await response.json();
      if (Array.isArray(boltList) && boltList.length > 500) {
        base = boltList.map(item => {
          const rawRarity = item.rarity || 'C';
          const rarity = rarityMap[rawRarity] || rawRarity;
          const val = (item.bolt && item.bolt > 0) ? item.bolt : (item.average && item.average > 0 ? item.average : (item.fate || 0));
          const valStr = val > 0 ? val.toLocaleString('en-US') : 'TBD';
          const skinName = (item.itemName || '').trim();
          const type = (item.type || '').trim();
          const key = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
          const obtainableBy = obtMap[key] || obtMap[skinName.toLowerCase()] || 'Chest Drop / Trading';

          return {
            'Skin Name': skinName,
            'Type': type,
            'Skin Rarity': rarity,
            'Hub Value': valStr,
            'Base Value': valStr,
            'Obtainable By': obtainableBy
          };
        });
      }
    }
  } catch (err) {
    console.warn('[HubPrices] upstream fetch failed, falling back to local database:', err.message);
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

  cachedData = base;
  lastFetchTime = now;
  return res.status(200).json(base);
}
