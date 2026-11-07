import fs from 'fs';
import path from 'path';

const API_KEY = 'dddcff96e910cdb350085cf4484f722e7778ecb3fba6ae907b931a3f048b9641';

function cleanUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let trimmed = url.trim();

  // Fix double prefix: 'https://kirka.iohttps://api2.kirka.io/...'
  const secondHttp = trimmed.indexOf('http', 8);
  if (secondHttp !== -1) {
    trimmed = trimmed.substring(secondHttp);
  }

  const dataIdx = trimmed.indexOf('data:image');
  if (dataIdx !== -1) {
    return trimmed.substring(dataIdx);
  }
  return trimmed;
}

async function sync() {
  console.log('Fetching live catalog from Kirka API...');
  const res = await fetch('https://api.kirka.io/api/inventory/items', {
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json, text/plain, */*',
      'ApiKey': API_KEY,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch catalog: HTTP ${res.status}`);
  }

  const items = await res.json();
  console.log(`Fetched ${items.length} items from live API.`);

  // Sanitize URLs
  const sanitized = items.map(i => {
    const renderUrl = cleanUrl(i.renderUrl);
    const textureUrl = cleanUrl(i.textureUrl);
    return {
      ...i,
      renderUrl,
      textureUrl
    };
  });

  // Verify Bloodveil
  const bloodveil = sanitized.find(i => i.name && i.name.toLowerCase() === 'bloodveil');
  console.log('Bloodveil in sanitized catalog:', bloodveil ? {
    id: bloodveil.id,
    name: bloodveil.name,
    type: bloodveil.type,
    rarity: bloodveil.rarity,
    renderUrl: bloodveil.renderUrl,
    textureUrl: bloodveil.textureUrl
  } : 'NOT FOUND');

  const chars = sanitized.filter(i => i.type === 'BODY_SKIN');
  console.log(`Total character skins (BODY_SKIN): ${chars.length}`);

  const publicDest = 'C:/Users/Shrey/.gemini/antigravity/scratch/kikatracker/public/data/items.json';
  fs.writeFileSync(publicDest, JSON.stringify(sanitized), 'utf8');
  console.log(`Saved to ${publicDest} (${(fs.statSync(publicDest).size / 1024 / 1024).toFixed(2)} MB).`);

  const distDest = 'C:/Users/Shrey/.gemini/antigravity/scratch/kikatracker/dist/data/items.json';
  if (fs.existsSync(path.dirname(distDest))) {
    fs.writeFileSync(distDest, JSON.stringify(sanitized), 'utf8');
    console.log(`Saved to ${distDest}.`);
  }

  // Also update discordbot catalog fallback if exists
  const discordFallback = 'C:/Users/Shrey/.gemini/antigravity/scratch/discordbot/src/data/catalogFallback.json';
  if (fs.existsSync(path.dirname(discordFallback))) {
    fs.writeFileSync(discordFallback, JSON.stringify(sanitized), 'utf8');
    console.log(`Saved to ${discordFallback}.`);
  }
}

sync().catch(console.error);
