// Runs after `vite build`. The app is a single page, so without this every address would send the same
// short HTML. This writes a real page for each address (dist/<path>/index.html) with its own title,
// description and written content, so search engines and AdSense's reviewers see each page's text
// without running the app. The app replaces that content the moment it starts, with the same text.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, PAGES, GUIDES, skinsFrom, skinStats, describeSkin, similarSkins, parseValue, rarityLabel } from '../src/content/site.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
// pages live in sub-folders, so relative asset links (a non-Vercel build uses base './') must start at the root
const NO_ADS_PATHS = new Set(['/aimtrainer', '/giveaway']);
// pages people click all over (painting): Monetag without the popunder, from the separate In-Page Push and Vignette zones
const NO_POPUNDER_PATHS = new Set(['/skineditor']);
const NO_POPUNDER_TAGS =
  `<script>(function(s){s.dataset.zone='12252591',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>` +
  `<script>(function(s){s.dataset.zone='12252595',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>`;
const template =readFileSync(join(dist, 'index.html'), 'utf8').replace(/(src|href)="\.\//g, '$1="/');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => Number(n).toLocaleString('en-US');

const STYLE = {
  wrap: 'max-width:820px;margin:0 auto;padding:48px 20px;color:#E0D6C2;font:400 17px/1.65 &quot;Comic Neue&quot;,&quot;Comic Sans MS&quot;,system-ui,sans-serif;background:#171925',
  h1: 'color:#FFF6E0;font:400 52px/1.05 Bangers,&quot;Comic Neue&quot;,sans-serif;letter-spacing:.03em;margin:0 0 16px',
  a: 'color:#FFF6E0',
};

/** Same nav on every static page, so every page links to the rest of the site. */
function siteNav() {
  const links = [
    ['/', 'Player search'], ['/prices', 'Skin prices'], ['/trades', 'Trades'], ['/daily', 'Daily leaderboard'],
    ['/ranked', 'Ranked'], ['/clans', 'Clans'], ['/aimtrainer', 'Aim trainer'], ['/skineditor', 'Skin editor'],
    ['/guides', 'Guides'], ['/bot', 'Discord bot'],
  ];
  return `<nav aria-label="Site"><p>${links.map(([h, t]) => `<a href="${h}" style="${STYLE.a}">${t}</a>`).join(' &middot; ')}</p></nav>`;
}
function footer() {
  return `<p style="margin-top:32px;font-size:14px">Kirka Hub is a fan project and is not affiliated with Kirka.io. <a href="/about.html" style="${STYLE.a}">About</a> &middot; <a href="/contact.html" style="${STYLE.a}">Contact</a> &middot; <a href="/privacy.html" style="${STYLE.a}">Privacy Policy</a> &middot; <a href="/terms.html" style="${STYLE.a}">Terms</a></p>`;
}

function page({ path, title, description, body, image }) {
  const url = SITE + path;
  let html = template;
  const set = (re, value) => {
    if (!re.test(html)) throw new Error(`prerender: template is missing ${re}`);
    html = html.replace(re, value);
  };
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  set(/<meta name="title" content="[^"]*"\s*\/?>/, `<meta name="title" content="${esc(title)}" />`);
  set(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`);
  set(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`);
  html = html
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="twitter:url" content="[^"]*"\s*\/?>/, `<meta property="twitter:url" content="${url}" />`)
    .replace(/<meta property="twitter:title" content="[^"]*"\s*\/?>/, `<meta property="twitter:title" content="${esc(title)}" />`)
    .replace(/<meta property="twitter:description" content="[^"]*"\s*\/?>/, `<meta property="twitter:description" content="${esc(description)}" />`);
  if (image) {
    html = html
      .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${esc(image)}" />`)
      .replace(/<meta property="twitter:image" content="[^"]*"\s*\/?>/, `<meta property="twitter:image" content="${esc(image)}" />`);
  }
  const start = html.indexOf('<!--prerender-start-->');
  const end = html.indexOf('<!--prerender-end-->');
  if (start < 0 || end < start) throw new Error('prerender: the prerender markers are missing from index.html');
  const content = `<!--prerender-start--><div style="${STYLE.wrap}">${siteNav()}${body}${footer()}</div>`;
  html = html.slice(0, start) + content + html.slice(end);
  // no Monetag in the aim trainer (a click-heavy game) or the giveaway roulette (shown on stream)
  if (NO_ADS_PATHS.has(path)) html = html.replace(/<!--multitag-->[\s\S]*?<!--\/multitag-->/, '');
  else if (NO_POPUNDER_PATHS.has(path)) html = html.replace(/<!--multitag-->[\s\S]*?<!--\/multitag-->/, () => NO_POPUNDER_TAGS);

  const file = path === '/' ? join(dist, 'index.html') : join(dist, ...path.split('/').filter(Boolean), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  return url;
}

const urls = [];
const items = JSON.parse(readFileSync(join(dist, 'data', 'items.json'), 'utf8'));
const priceRows = JSON.parse(readFileSync(join(dist, 'data', 'hub_prices.json'), 'utf8'));
const prices = new Map(priceRows.map((r) => [String(r['Skin Name']).toLowerCase(), r]));
const skins = skinsFrom(items).sort((a, b) => a.name.localeCompare(b.name));
const stats = skinStats(skins);
const priceOf = (name) => {
  const r = prices.get(name.toLowerCase());
  if (!r) return null;
  const value = parseValue(r['Hub Value']);
  return { value, valueText: value ? null : r['Hub Value'] || null, obtainableBy: r['Obtainable By'] || null };
};

// App pages
for (const [tab, info] of Object.entries(PAGES)) {
  let extra = '';
  if (tab === 'prices') {
    // the full list, linking every skin page
    const groups = Object.keys(stats.byWeapon).sort((a, b) => (a === 'Character') - (b === 'Character') || a.localeCompare(b));
    extra = groups
      .map((w) => `<h2>${w === 'Character' ? 'Character skins' : `${esc(w)} skins`}</h2><ul>${stats.byWeapon[w]
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => {
          const p = priceOf(s.name);
          return `<li><a href="/skin/${s.slug}" style="${STYLE.a}">${esc(s.name)}</a>: ${rarityLabel(s.rarity)}${p && p.value ? `, ${fmt(p.value)} coins` : ''}</li>`;
        })
        .join('')}</ul>`)
      .join('');
  }
  if (tab === 'guides') {
    extra = `<ul>${GUIDES.map((g) => `<li><a href="/guides/${g.slug}" style="${STYLE.a}">${esc(g.title)}</a>: ${esc(g.description)}</li>`).join('')}</ul>`;
  }
  if (tab === 'search') {
    extra = `<h2>Guides</h2><ul>${GUIDES.map((g) => `<li><a href="/guides/${g.slug}" style="${STYLE.a}">${esc(g.title)}</a></li>`).join('')}</ul>`;
  }
  const body = `<h1 style="${STYLE.h1}">${esc(info.heading)}</h1>${info.intro.map((p) => `<p>${esc(p)}</p>`).join('')}${extra}`;
  urls.push(page({ path: info.path, title: info.title, description: info.description, body }));
}

// Guides
for (const g of GUIDES) {
  const html = readFileSync(join(root, 'src', 'content', 'guides', `${g.slug}.html`), 'utf8');
  const body = `<p><a href="/guides" style="${STYLE.a}">All guides</a></p><h1 style="${STYLE.h1}">${esc(g.title)}</h1><p>${esc(g.description)}</p>${html.replace(/<a href="/g, `<a style="${STYLE.a}" href="`)}`;
  urls.push(page({ path: `/guides/${g.slug}`, title: `${g.title} | Kirka Hub`, description: g.description, body }));
}

// Skins
for (const s of skins) {
  const price = priceOf(s.name);
  const paras = describeSkin(s, price, stats);
  const similar = similarSkins(s, stats, 8);
  const kind = s.kind === 'weapon' ? `${s.weapon} skin` : 'character skin';
  const title = `${s.name} — Kirka ${s.kind === 'weapon' ? `${s.weapon} Skin` : 'Character Skin'} Value & Owners | Kirka Hub`;
  const description = `${s.name} is a ${rarityLabel(s.rarity)} ${kind} in Kirka.io${price && price.value ? ` with a Hub Value of ${fmt(price.value)} coins` : ''}, owned by ${fmt(s.owners)} ${s.owners === 1 ? 'player' : 'players'}.`;
  const body =
    `<p><a href="/prices" style="${STYLE.a}">Skin prices</a> / ${esc(s.kind === 'weapon' ? `${s.weapon} skins` : 'Character skins')}</p>` +
    `<h1 style="${STYLE.h1}">${esc(s.name)}</h1>` +
    (s.renderUrl ? `<img src="${esc(s.renderUrl)}" alt="${esc(`${s.name} ${kind}`)}" width="240" height="240" style="display:block;object-fit:contain;margin:0 0 16px" />` : '') +
    `<ul><li>Rarity: ${rarityLabel(s.rarity)}</li><li>${s.kind === 'weapon' ? `Weapon: ${esc(s.weapon)}` : 'Type: Character skin'}</li>` +
    `<li>Hub Value: ${price && price.value ? `${fmt(price.value)} coins` : esc((price && price.valueText) || 'not priced yet')}</li><li>Owners: ${fmt(s.owners)}</li></ul>` +
    paras.map((p) => `<p>${esc(p)}</p>`).join('') +
    (similar.length ? `<h2>${s.kind === 'weapon' ? `More ${esc(s.weapon)} skins` : 'More character skins'}</h2><ul>${similar.map((o) => `<li><a href="/skin/${o.slug}" style="${STYLE.a}">${esc(o.name)}</a> (${rarityLabel(o.rarity)})</li>`).join('')}</ul>` : '') +
    `<p>Read <a href="/guides/how-kirka-skin-values-work" style="${STYLE.a}">how Kirka skin values work</a>.</p>`;
  urls.push(page({ path: `/skin/${s.slug}`, title, description, body, image: s.renderUrl }));
}

// Sitemap: every page above, plus the static info pages
const today = new Date().toISOString().slice(0, 10);
const all = [...urls, `${SITE}/about.html`, `${SITE}/contact.html`, `${SITE}/privacy.html`, `${SITE}/terms.html`];
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`
);
console.log(`prerender: ${urls.length} pages (${skins.length} skins, ${GUIDES.length} guides) and sitemap.xml`);
