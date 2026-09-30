const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ITEMS_PATH = path.join(__dirname, '..', 'public', 'data', 'items.json');
const OUT_DIR = path.join(__dirname, '..', 'public', 'renders', 'characters');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function renderSkin(srcBuf) {
  const src = PNG.sync.read(srcBuf);
  const scale = 8;
  const dst = new PNG({ width: 16 * scale, height: 32 * scale });

  // Clear transparent buffer
  dst.data.fill(0);

  function copy(sx, sy, sw, sh, dx, dy, mirror = false) {
    for (let y = 0; y < sh * scale; y++) {
      for (let x = 0; x < sw * scale; x++) {
        const px = mirror ? (sw * scale - 1 - x) : x;
        const srcX = sx + Math.floor(px / scale);
        const srcY = sy + Math.floor(y / scale);
        if (srcX >= src.width || srcY >= src.height) continue;

        const sidx = (srcY * src.width + srcX) * 4;
        const didx = ((dy * scale + y) * dst.width + (dx * scale + x)) * 4;

        const sa = src.data[sidx + 3];
        if (sa > 10) {
          if (sa === 255) {
            dst.data[didx] = src.data[sidx];
            dst.data[didx + 1] = src.data[sidx + 1];
            dst.data[didx + 2] = src.data[sidx + 2];
            dst.data[didx + 3] = 255;
          } else {
            const da = dst.data[didx + 3] / 255;
            const a = sa / 255;
            const outA = a + da * (1 - a);
            if (outA > 0) {
              dst.data[didx] = Math.round((src.data[sidx] * a + dst.data[didx] * da * (1 - a)) / outA);
              dst.data[didx + 1] = Math.round((src.data[sidx + 1] * a + dst.data[didx + 1] * da * (1 - a)) / outA);
              dst.data[didx + 2] = Math.round((src.data[sidx + 2] * a + dst.data[didx + 2] * da * (1 - a)) / outA);
              dst.data[didx + 3] = Math.round(outA * 255);
            }
          }
        }
      }
    }
  }

  const isOldFormat = src.height === 32;

  // Base body layers
  copy(8, 8, 8, 8, 4, 0);          // Head front
  copy(20, 20, 8, 12, 4, 8);       // Torso front
  copy(44, 20, 3, 12, 1, 8);       // Right arm front
  if (isOldFormat) {
    copy(44, 20, 3, 12, 12, 8, true); // Left arm mirrored from right
  } else {
    copy(36, 52, 3, 12, 12, 8);    // Left arm front
  }

  copy(4, 20, 4, 12, 4, 20);       // Right leg front
  if (isOldFormat) {
    copy(4, 20, 4, 12, 8, 20, true);  // Left leg mirrored from right
  } else {
    copy(20, 52, 4, 12, 8, 20);     // Left leg front
  }

  // Overlay layers
  copy(40, 8, 8, 8, 4, 0);         // Hat
  if (!isOldFormat) {
    copy(20, 36, 8, 12, 4, 8);     // Jacket
    copy(44, 36, 3, 12, 1, 8);     // Right arm sleeve
    copy(52, 52, 3, 12, 12, 8);    // Left arm sleeve
    copy(4, 36, 4, 12, 4, 20);     // Right leg pants
    copy(4, 52, 4, 12, 8, 20);     // Left leg pants
  }

  return PNG.sync.write(dst);
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.status === 200) {
        const buf = await res.arrayBuffer();
        return Buffer.from(buf);
      }
      if (res.status === 404) return null;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 400));
    }
  }
  return null;
}

async function run() {
  console.log('Loading items.json...');
  const items = JSON.parse(fs.readFileSync(ITEMS_PATH, 'utf8'));

  const characters = items.filter(it => {
    const t = (it.type || '').toLowerCase();
    return t === 'character' || t === 'body_skin' || t === 'body skin';
  });

  const targets = characters.filter(c => {
    const r = c.renderUrl || '';
    return r.includes('render.b8016858') || r.includes('render-mini.0ec8ea84') || !r;
  });

  console.log(`Found ${characters.length} total character skins.`);
  console.log(`Processing ${targets.length} character skins needing 2D renders...`);

  let successCount = 0;
  let notFoundCount = 0;
  let failCount = 0;

  const CONCURRENCY = 12;
  const queue = [...targets];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      const cleanName = item.name.replace(/^_+/, '').trim();
      const safeName = cleanName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const outPath = path.join(OUT_DIR, `${safeName}.png`);
      const textureUrl = `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(cleanName)}`;

      try {
        const buf = await fetchWithRetry(textureUrl);
        if (buf && buf.length > 50) {
          const renderedPng = renderSkin(buf);
          fs.writeFileSync(outPath, renderedPng);

          // Update item in items.json
          item.renderUrl = `/renders/characters/${safeName}.png`;
          item.textureUrl = textureUrl;
          successCount++;
        } else {
          notFoundCount++;
        }
      } catch (err) {
        console.error(`Error processing ${item.name}: ${err.message}`);
        failCount++;
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\nBatch rendering complete!`);
  console.log(`  - Successfully rendered & mapped: ${successCount}`);
  console.log(`  - Not found (404 on api2): ${notFoundCount}`);
  console.log(`  - Failed: ${failCount}`);

  // Also check all other character skins to ensure valid textureUrl
  characters.forEach(c => {
    const t = c.textureUrl || '';
    if (!t || t === 'https://kirka.io' || t === 'https://kirka.io/') {
      const cleanName = c.name.replace(/^_+/, '').trim();
      c.textureUrl = `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(cleanName)}`;
    }
  });

  console.log('Writing updated items.json...');
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(items, null, 2), 'utf8');
  console.log('Done!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
