const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ITEMS_PATH = path.join(__dirname, '..', 'public', 'data', 'items.json');
const OUT_DIR = path.join(__dirname, '..', 'public', 'renders', 'weapons');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const WEAPON_MODEL_MAP = {
  'VITA': 'VITA.glb',
  'SCAR': 'SCAR.glb',
  'SHARK': 'Shark.glb',
  'AR-9': 'AR-9.glb',
  'AR9': 'AR-9.glb',
  'LAR': 'LAR.glb',
  'SNIPER': 'LAR.glb',
  'M60': 'M60.glb',
  'MAC-10': 'MAC-10.glb',
  'MAC10': 'MAC-10.glb',
  'REVOLVER': 'Revolver.glb',
  'PISTOL': 'Revolver.glb',
  'TOMAHAWK': 'Tomahawk.glb',
  'BAYONET': 'Bayonet.glb',
  'KNIFE': 'Bayonet.glb',
  'MELEE': 'Bayonet.glb',
  'WEATIE': 'Weatie.glb',
  'SHOTGUN': 'Weatie.glb',
};

const items = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf8'));

// Identify weapon skins that need 2D renders
const candidateQueue = [];
for (const item of items) {
  const type = (item.type || '').toLowerCase();
  if (type === 'character' || type === 'body_skin' || type === 'body skin') continue;

  const parentName = (item.parent?.name || '').trim().toUpperCase();
  const modelFile = WEAPON_MODEL_MAP[parentName];
  if (!modelFile) continue;

  const r = item.renderUrl || '';
  const isPlaceholder = !r || (r.includes('render-mini.0ec8ea84') && parentName !== 'SHARK') || r.includes('render.b8016858') || r === 'https://kirka.io';

  if (isPlaceholder && ((item.totalOwned || 0) > 0 || item.name === 'Apexial')) {
    const cleanName = item.name.replace(/^_+/, '').trim();
    candidateQueue.push({
      name: item.name,
      cleanName,
      modelFile,
    });
  }
}

console.log(`Found ${candidateQueue.length} candidate weapon skins. Pre-fetching textures...`);

const textureCache = new Map();

async function prefetchTextures() {
  const queue = [...candidateQueue];
  const validQueue = [];
  const CONCURRENCY = 8;

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        const url = `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(item.cleanName)}`;
        const res = await fetch(url);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 100) {
            textureCache.set(item.cleanName.toLowerCase(), buf);
            validQueue.push(item);
            console.log(`✓ Fetched texture for ${item.name} (${buf.length} bytes)`);
          }
        } else {
          console.warn(`✗ Texture 404 for ${item.name}`);
        }
      } catch (err) {
        console.warn(`✗ Error fetching texture for ${item.name}:`, err.message);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return validQueue;
}

async function start() {
  const queue = await prefetchTextures();
  console.log(`\nReady to render ${queue.length} weapon skins with valid textures!`);

  let renderedCount = 0;

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost:5174');

    if (url.pathname === '/queue') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(queue));
      return;
    }

    if (url.pathname === '/texture') {
      const name = (url.searchParams.get('name') || '').trim().toLowerCase();
      const buf = textureCache.get(name);
      if (buf) {
        res.writeHead(200, {
          'Content-Type': 'image/webp',
          'Content-Length': buf.length,
        });
        res.end(buf);
      } else {
        res.writeHead(404);
        res.end('Texture not found');
      }
      return;
    }

    if (url.pathname === '/save-render' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { name, dataUrl } = JSON.parse(body);
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          const cleanName = name.replace(/^_+/, '').trim();
          const safeName = cleanName.replace(/[^a-zA-Z0-9_-]/g, '_');
          const filePath = path.join(OUT_DIR, `${safeName}.png`);

          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

          // Update item in items.json
          const match = items.find(it => it.name === name);
          if (match) {
            match.renderUrl = `/renders/weapons/${safeName}.png`;
            match.textureUrl = `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(cleanName)}`;
          }

          renderedCount++;
          console.log(`[${renderedCount}/${queue.length}] Saved render for ${name} -> /renders/weapons/${safeName}.png`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          console.error('Error saving render:', err);
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (url.pathname === '/done') {
      if (renderedCount < queue.length) {
        console.log(`Received partial done signal (${renderedCount}/${queue.length}), waiting for remaining items...`);
        res.writeHead(200);
        res.end('waiting');
        return;
      }
      console.log(`\nWeapon rendering complete! Successfully rendered ${renderedCount} skins.`);
      console.log('Updating items.json...');
      fs.writeFileSync(ITEMS_PATH, JSON.stringify(items, null, 2), 'utf8');
      console.log('Saved items.json successfully!');

      res.writeHead(200);
      res.end('done');

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 500);
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  server.listen(5174, () => {
    console.log('Weapon render server listening on port 5174');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cmd = `"${chromePath}" --headless=new --enable-webgl --use-gl=angle "http://localhost:5173/?render_weapons=1"`;
    console.log('Launching Chrome:', cmd);
    exec(cmd, (err, stdout, stderr) => {
      if (err) console.error('Chrome process ended with error:', err);
    });
  });
}

start().catch(console.error);
