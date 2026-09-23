// api/prices.js - Secure Backend Proxy for Hub Prices
// Hides private Google Sheet URL & credentials from client F12 DevTools Network tab
import fs from 'fs';
import path from 'path';

let cachedData = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // Cache 60 seconds

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  // Parse header
  const parseRow = (rowStr) => {
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
  };

  const headers = parseRow(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length >= 4) {
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = values[idx] || '';
      });
      rows.push(item);
    }
  }

  return rows;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  if (cachedData && (now - lastFetchTime < CACHE_TTL_MS)) {
    return res.status(200).json(cachedData);
  }

  // 1. Private Google Sheet feed (configured in Vercel Environment Variables)
  const privateSheetUrl = process.env.HUB_PRICES_SHEET_URL;
  if (privateSheetUrl) {
    try {
      const response = await fetch(privateSheetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 KirkaHub-Server/1.0' }
      });
      if (response.ok) {
        const text = await response.text();
        const parsed = parseCsv(text);
        if (parsed.length > 500) {
          cachedData = parsed;
          lastFetchTime = now;
          return res.status(200).json(parsed);
        }
      }
    } catch (err) {
      console.warn('[HubPrices] Failed to fetch private sheet URL, falling back to local database:', err.message);
    }
  }

  // 2. Offline / Local fallback database (100% uptime, 0ms latency)
  try {
    const localJsonPath = path.join(process.cwd(), 'public/data/hub_prices.json');
    if (fs.existsSync(localJsonPath)) {
      const localData = JSON.parse(fs.readFileSync(localJsonPath, 'utf8'));
      cachedData = localData;
      lastFetchTime = now;
      return res.status(200).json(localData);
    }
  } catch (err) {
    console.error('[HubPrices] Error loading local json:', err);
  }

  return res.status(200).json([]);
}
