// Page-view log: the site reports which page was opened and this posts it to a Discord channel.
// The webhook URL lives only in the DISCORD_LOG_WEBHOOK env var (Vercel), never in the code or the browser.
// No IP addresses are logged: just the page, the country Vercel reports, the device and a random visit tag.
import { readBody } from './_session.js';

const SITE = 'https://kirkahub.online';
const PER_MINUTE = 20; // per IP, per server instance: stops one person flooding the channel
const hits = new Map();

const PAGES = {
  prices: ['💰', 'Skins & Prices'],
  trades: ['🔁', 'Trades Portal'],
  renders: ['🧊', '3D Renders'],
  '3drenders': ['🧊', '3D Renders'],
  kirkadle: ['🟩', 'Kirkadle'],
  wordle: ['🟩', 'Kirkadle'],
  wrapped: ['🎬', 'Kirka Wrapped'],
  daily: ['🏆', 'Daily Leaderboard'],
  ranked: ['⚔️', 'Ranked Arena'],
  clans: ['🛡️', 'Clans Registry'],
  players: ['🎮', 'Lobbies'],
  playercount: ['🎮', 'Lobbies'],
  chat: ['💬', 'Kirka Chat'],
  chatlogs: ['💬', 'Chat Logs'],
  changelogs: ['📝', 'Changelogs'],
  giveaway: ['🎁', 'Giveaway Roulette'],
  roulette: ['🎁', 'Giveaway Roulette'],
  bot: ['🤖', 'Discord Bot page'],
  skineditor: ['🖌️', 'Skin Editor'],
  'skin-editor': ['🖌️', 'Skin Editor'],
  aimtrainer: ['🎯', 'Aim Trainer'],
  'aim-trainer': ['🎯', 'Aim Trainer'],
  reloadlab: ['🔫', 'Reload Lab'],
};

const cut = (s, n) => {
  const t = String(s || '').replace(/[\r\n\t]+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const decode = (s) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

/** What the page is, in words, from its path. */
function describe(path) {
  const [first, ...rest] = path.split('/').filter(Boolean);
  const arg = cut(decode(rest.join('/')), 80);
  switch (first) {
    case undefined: return '🏠 Home';
    case 'player':
    case 'inventory': return `👤 Player profile: ${arg}`;
    case 'clan': return `🛡️ Clan: ${arg}`;
    case 'skin': return `🎨 Skin page: ${arg}`;
    case 'gallery': return arg ? '🖼️ Gallery skin' : '🖼️ Skin Gallery';
    case 'guides': return arg ? `📖 Guide: ${arg}` : '📖 Guides';
    case 'fit': return arg ? '👕 3D Fit (a shared loadout)' : '👕 3D Fit';
  }
  const known = PAGES[first];
  return known ? `${known[0]} ${known[1]}` : `📄 ${cut(path, 80)}`;
}

const flag = (cc) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐');

function device(ua) {
  const kind = /iPad|Tablet/i.test(ua) ? 'Tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'Phone' : 'Computer';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'other browser';
  return `${kind}, ${browser}`;
}

function tooMany(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > 60_000) {
    hits.set(ip, { start: now, n: 1 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  return ++h.n > PER_MINUTE;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const done = () => { res.statusCode = 204; res.end(); };
  const hook = process.env.DISCORD_LOG_WEBHOOK;
  if (req.method !== 'POST' || !hook) return done();

  const ua = String(req.headers['user-agent'] || '');
  if (/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(ua)) return done();

  // only reports sent by the site itself (a script elsewhere can fake this, the rate limit covers that)
  const host = String(req.headers.host || '');
  const from = String(req.headers.origin || req.headers.referer || '');
  if (!host || !from.includes(host)) return done();

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return done();

  const body = await readBody(req);
  const path = String(body.path || '');
  if (!/^\/[^\s<>"`\\]{0,200}$/.test(path)) return done();
  const visit = /^[a-z0-9]{4}$/.test(body.visit) ? body.visit : '????';
  const n = Math.min(Math.max(parseInt(body.n, 10) || 1, 1), 9999);

  let came = '';
  try {
    const r = new URL(String(body.ref || ''));
    if (r.host && r.host !== host) came = r.host.replace(/^www\./, '');
  } catch { /* no referrer */ }

  const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const footer = [`${flag(country)} ${country || 'Unknown'}`, device(ua), `visit ${visit}`, `page ${n}`].join(' · ');

  const embed = {
    title: cut(describe(path), 250),
    url: SITE + encodeURI(decode(path)),
    description: [!String(body.title || '').startsWith('Kirka Hub —') || path === '/' ? cut(body.title, 200) : '', came && `Came from **${cut(came, 60)}**`].filter(Boolean).join('\n'),
    color: n === 1 ? 0xf5c518 : 0x3b4252,
    footer: { text: footer },
    timestamp: new Date().toISOString(),
  };

  try {
    // Discord allows about 30 messages a minute per channel; past that it answers 429 and the view is skipped
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Kirka Hub visits', allowed_mentions: { parse: [] }, embeds: [embed] }),
    });
  } catch { /* Discord down: drop it */ }
  return done();
}
