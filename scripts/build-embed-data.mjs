// Builds public/embed/renders.json for the embed pages: item id -> Kirka render file name.
// The full catalog (public/data/items.json) is 2.5 MB; the embeds only need each skin's picture,
// and they load it through our own /kirka-assets/ path, so only the file name is kept.
// Runs before every build (package.json), so it follows items.json automatically.
import { readFileSync, writeFileSync } from 'node:fs';

const items = JSON.parse(readFileSync(new URL('../public/data/items.json', import.meta.url), 'utf8'));
const PREFIX = 'https://kirka.io/assets/img/';

// the same stand-ins the site treats as "no real picture" (src/utils/skinAssets.ts isPlaceholderUrl)
const placeholder = (u) =>
  !u || u.endsWith('render-mini.webp') || u.includes('render.0e1d4800') || u.includes('render.d8456ef7') ||
  u.includes('__questions__') || u.includes('0ec8ea84');

const out = {};
for (const it of items) {
  const url = String(it.renderUrl || '').trim();
  if (!it.id || placeholder(url) || !url.startsWith(PREFIX)) continue;
  out[it.id] = url.slice(PREFIX.length);
}

writeFileSync(new URL('../public/embed/renders.json', import.meta.url), JSON.stringify(out));
console.log(`embed renders: ${Object.keys(out).length} of ${items.length} items`);
