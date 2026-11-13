// Text shared by the app and by scripts/prerender.mjs (which writes a real HTML page for every
// address, so search engines and AdSense see each page's content without running the app).
// Plain JavaScript so Node can import it directly; types are in site.d.ts.

export const SITE = 'https://kirkahub.online';

export const RARITY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL', 'PARANORMAL'];
export const rarityLabel = (r) => (r ? r.charAt(0) + r.slice(1).toLowerCase() : '');

/** "Vita Plasma!" -> "vita-plasma" */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SLOT = { WEAPON_1: 'primary weapon', WEAPON_2: 'secondary weapon', WEAPON_3: 'melee weapon' };
const fmt = (n) => Number(n).toLocaleString('en-US');
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Published weapon and character skins from items.json, in a flat shape both sides can use. */
export function skinsFrom(items) {
  return items
    // every skin someone owns, including ones no longer in the published list (old rewards and the like);
    // skins nobody owns yet (mostly added in 2026) have no data to show
    .filter((x) => x && (x.type === 'WEAPON_SKIN' || x.type === 'BODY_SKIN') && x.name && Number(x.totalOwned) > 0)
    .map((x) => ({
      name: x.name,
      slug: slugify(x.name),
      kind: x.type === 'WEAPON_SKIN' ? 'weapon' : 'character',
      weapon: x.type === 'WEAPON_SKIN' ? (x.parent && x.parent.name) || 'Weapon' : 'Character',
      slot: x.type === 'WEAPON_SKIN' ? SLOT[x.parent && x.parent.type] || 'weapon' : null,
      rarity: x.rarity || 'COMMON',
      owners: Number(x.totalOwned) || 0,
      createdAt: x.createdAt || null,
      creator: (x.creators && x.creators[0] && x.creators[0].name) || null,
      renderUrl: x.renderUrl || null,
    }));
}

/** Parse "1,250,000" / "TBD" from the price sheet. */
export function parseValue(text) {
  if (text == null) return null;
  const n = Number(String(text).replace(/[^0-9.]/g, ''));
  return /\d/.test(String(text)) && Number.isFinite(n) ? n : null;
}

/** Counts used to compare one skin with the others. */
export function skinStats(skins) {
  const byWeapon = {};
  for (const s of skins) (byWeapon[s.weapon] ||= []).push(s);
  const median = {};
  for (const [w, list] of Object.entries(byWeapon)) {
    const o = list.map((s) => s.owners).sort((a, b) => a - b);
    median[w] = o.length ? o[Math.floor(o.length / 2)] : 0;
  }
  return { byWeapon, median, total: skins.length };
}

/**
 * The written description of one skin: a few short paragraphs built from its real numbers.
 * price: { value: number|null, valueText: string|null, obtainableBy: string|null }
 */
export function describeSkin(skin, price, stats) {
  const r = rarityLabel(skin.rarity);
  const aOrAn = /^[AEIOU]/.test(r) ? 'an' : 'a';
  const out = [];
  const sameWeapon = (stats.byWeapon[skin.weapon] || []).length;

  if (skin.kind === 'weapon') {
    out.push(
      `${skin.name} is ${aOrAn} ${r} skin for the ${skin.weapon}, a ${skin.slot} in Kirka.io. ` +
        `It is one of ${fmt(sameWeapon)} ${skin.weapon} skins that players own.`
    );
  } else {
    out.push(
      `${skin.name} is ${aOrAn} ${r} character skin in Kirka.io, one of ${fmt(sameWeapon)} character skins that players own.`
    );
  }

  const facts = [];
  if (skin.createdAt) facts.push(`It was added to the game on ${fmtDate(skin.createdAt)}`);
  if (skin.owners) {
    const med = stats.median[skin.weapon] || 0;
    let compare = '';
    if (med && skin.owners < med / 3) compare = `, which makes it much rarer than most ${skin.kind === 'weapon' ? skin.weapon : 'character'} skins`;
    else if (med && skin.owners < med) compare = `, fewer than the typical ${skin.kind === 'weapon' ? skin.weapon : 'character'} skin`;
    else if (med && skin.owners > med * 3) compare = `, making it one of the more common ${skin.kind === 'weapon' ? skin.weapon : 'character'} skins`;
    facts.push(`${skin.owners === 1 ? 'only 1 player owns it' : `${fmt(skin.owners)} players own it`}${compare}`);
  }
  if (facts.length) out.push(facts.join(' and ') + '.');

  if (price && price.value) {
    out.push(
      `Its Hub Value is ${fmt(price.value)} coins. Hub Values come from the Kirka Hub valuation index, which tracks what the skin actually trades for between players.`
    );
  } else if (price && price.valueText) {
    out.push(`The Kirka Hub valuation index has not priced it yet (listed as "${price.valueText}"), usually because it has not traded often enough for a fair value.`);
  }
  if (price && price.obtainableBy) out.push(`How to get it: ${price.obtainableBy}.`);
  if (skin.creator) {
    out.push(
      skin.creator === 'Kirka'
        ? 'It was made by the Kirka team.'
        : `It was designed by ${skin.creator}, one of the community artists whose skins are in the game.`
    );
  }
  return out;
}

/** Up to n other skins for the same weapon, closest in rarity first. */
export function similarSkins(skin, stats, n = 8) {
  const ri = RARITY_ORDER.indexOf(skin.rarity);
  return (stats.byWeapon[skin.weapon] || [])
    .filter((s) => s.slug !== skin.slug)
    .sort((a, b) => Math.abs(RARITY_ORDER.indexOf(a.rarity) - ri) - Math.abs(RARITY_ORDER.indexOf(b.rarity) - ri) || b.owners - a.owners)
    .slice(0, n);
}

export const GUIDES = [
  {
    slug: 'kirka-sensitivity-and-fov',
    title: 'Kirka sensitivity and FOV, explained with the real numbers',
    description: 'How Kirka.io turns mouse movement into aim, what FOV and ADS do to your sensitivity, and how to work out your cm/360.',
  },
  {
    slug: 'how-kirka-skin-values-work',
    title: 'How Kirka skin values work',
    description: 'What a Hub Value is, why some skins are worth millions of coins, and how to judge a skin before you trade for it.',
  },
  {
    slug: 'kirka-skins-by-the-numbers',
    title: 'Kirka skins by the numbers',
    description: 'Every published Kirka.io skin counted by rarity, weapon and year, with the rarest and most owned skins.',
  },
  {
    slug: 'how-to-trade-safely-in-kirka',
    title: 'How to trade safely in Kirka',
    description: 'Check values, read trade history and avoid the common scams before you accept a Kirka trade.',
  },
  {
    slug: 'kirka-hub-discord-bot-guide',
    title: 'Kirka Hub Discord bot: every command',
    description: 'How to link your Kirka account and use the Kirka Hub bot for profiles, inventories, prices, trades and more.',
  },
  {
    slug: 'reading-a-kirka-player-profile',
    title: 'How to read a Kirka player profile',
    description: 'What every number on a Kirka Hub profile means: level, KLO, ranked stats, inventory value and match history.',
  },
];

/** Every app page: its address, what search results show, and a short written introduction. */
export const PAGES = {
  search: {
    path: '/',
    title: 'Kirka Hub — Kirka.io Tracker, Player Profile & Inventory Value',
    description: "Search any Kirka.io player's profile, see what their inventory is worth, inspect 3D skins and follow live leaderboards, trades and chat.",
    heading: 'Kirka Hub',
    intro: [
      'Kirka Hub is a free fan-made tracker for the browser shooter Kirka.io. Search any player by their short ID to see their profile, level, ranked record, equipped loadout, every skin in their inventory and what it is all worth.',
      'Beyond profiles, the site lists every skin in the game with its value and a 3D render, follows live trades and the in-game chat, keeps daily and ranked leaderboards, and has tools for players: an aim trainer that uses your exact Kirka settings, a 3D skin editor and a loadout viewer.',
    ],
  },
  prices: {
    path: '/prices',
    title: 'Kirka Skin Prices & Values — Every Skin | Kirka Hub',
    description: 'Every Kirka.io weapon and character skin with its Hub Value, rarity, how to get it and a 3D render. Search and sort the full list.',
    heading: 'Kirka skin prices',
    intro: [
      'This is the full list of Kirka.io skins with their Hub Value: the price the Kirka Hub valuation index gives each skin, based on what it trades for between players. Search by name, filter by weapon or rarity, and open any skin to see it in 3D.',
      'Values move as skins trade. A skin marked TBD has not traded often enough to price fairly yet. Use these values as a guide when you trade, and check the trade history for recent deals on the same skin.',
    ],
  },
  trades: {
    path: '/trades',
    title: 'Kirka Trades — Live Offers & Trade History | Kirka Hub',
    description: 'Live Kirka.io trade offers and the history of completed trades, with every skin valued so you can see who won each trade.',
    heading: 'Kirka trades',
    intro: [
      'The trade portal shows live Kirka.io trade offers and completed trades, with every skin on both sides priced by its Hub Value. It is the quickest way to see what a skin really goes for before you make your own offer.',
      'Look at several recent trades for the same skin rather than one: a single trade can be a friend deal or a mistake.',
    ],
  },
  daily: {
    path: '/daily',
    title: 'Kirka Daily Leaderboard — Top Scores Today | Kirka Hub',
    description: "Today's top Kirka.io players, updated through the day.",
    heading: 'Kirka daily leaderboard',
    intro: ["The daily leaderboard lists today's best Kirka.io players. It resets every day, so anyone can get on it with a good session. Click a name to open that player's full profile."],
  },
  ranked: {
    path: '/ranked',
    title: 'Kirka Ranked Leaderboards — S&D, 1v1 & 2v2 | Kirka Hub',
    description: 'Kirka.io ranked standings for Search & Destroy, 1v1 and 2v2, with ratings and records for the top players.',
    heading: 'Kirka ranked leaderboards',
    intro: ['Ranked standings for every Kirka.io ranked mode: Search & Destroy, 1v1 and 2v2. Each list shows the top players by rating. Open a player to see their ranked record and recent matches.'],
  },
  clans: {
    path: '/clans',
    title: 'Kirka Clans — Top Clans & Rosters | Kirka Hub',
    description: 'The top Kirka.io clans by championship score, with member counts, descriptions and full rosters.',
    heading: 'Kirka clans',
    intro: ["The clan registry ranks Kirka.io's top clans by championship score. Open a clan to read its description and see every member, or search any clan by its exact name."],
  },
  players: {
    path: '/players',
    title: 'Kirka Live Lobbies & Player Count | Kirka Hub',
    description: 'How many people are playing Kirka.io right now, by region, and the live matches you can join.',
    heading: 'Kirka live lobbies',
    intro: ['See how many players are online in Kirka.io right now, region by region, and the matches that are running. Useful for finding a full lobby or a quiet server.'],
  },
  chat: {
    path: '/chat',
    title: 'Kirka Live Chat | Kirka Hub',
    description: "Kirka.io's global chat, live, without opening the game.",
    heading: 'Kirka live chat',
    intro: ["Read Kirka.io's global chat as it happens, without being in the game."],
  },
  renders: {
    path: '/renders',
    title: 'Kirka 3D Skin Renders | Kirka Hub',
    description: 'Every Kirka.io weapon and character skin as a 3D model you can turn and zoom.',
    heading: 'Kirka 3D renders',
    intro: ['Every Kirka.io skin on its real 3D model. Turn it, zoom in and see the texture up close, which is often clearer than the small picture in the game.'],
  },
  fit: {
    path: '/fit',
    title: 'Kirka 3D Fit — Show Off Your Loadout | Kirka Hub',
    description: "See any Kirka.io player's character and weapons together in 3D, or build a loadout from any skins.",
    heading: 'Kirka 3D Fit',
    intro: ["3D Fit shows a player's character skin and weapon skins together on the 3D model, the way others see them in game. Enter a short ID to load someone's loadout or try any combination of skins."],
  },
  skineditor: {
    path: '/skineditor',
    title: 'Free Kirka Skin Editor — Paint 3px Slim Skins in 3D | Kirka Hub',
    description: 'Paint Kirka.io character skins on a 3D model in your browser. Slim 3px and classic 4px, 64x64 and 128x128, with layers and mirror painting.',
    heading: 'Kirka skin editor',
    intro: [
      'A free skin editor for Kirka.io character skins that runs in your browser. Paint straight onto the 3D model or onto the flat skin sheet, with pencil, fill, colour picker, mirror painting and separate body and outer layers.',
      'It supports the slim 3px model and the classic 4px model at 64x64 and 128x128. You can start from any existing Kirka character skin, and your work is saved in the browser as you go.',
    ],
  },
  aimtrainer: {
    path: '/aimtrainer',
    title: 'Kirka Aim Trainer With Your Exact Sensitivity & FOV | Kirka Hub',
    description: "An aim trainer that turns your mouse exactly like Kirka.io does: paste your Kirka settings and train with the same sensitivity, FOV, ADS and crosshair.",
    heading: 'Kirka aim trainer',
    intro: [
      "Most aim trainers only approximate your game's sensitivity. This one uses the same formula Kirka.io uses, so a flick here is the same distance as in Kirka. Paste the settings Kirka's export button gives you and the trainer copies your sensitivity, ADS sensitivity, FOV, ADS zoom for each gun and your crosshair.",
      'There are four drills (Gridshot, Flick, Tracking and VITA Quickscope) plus a 360 check that lets you confirm the turn speed matches the game. It works on phones too, with Kirka-style touch controls.',
    ],
  },
  reloadlab: {
    path: '/reloadlab',
    title: 'Kirka Reload Lab — Reload Animations on Real Models | Kirka Hub',
    description: 'Watch Kirka.io reload animations with any skin on the real weapon models.',
    heading: 'Kirka reload lab',
    intro: ['Play the reload animation of any Kirka.io weapon with any skin on the real 3D model, at full speed or slowed down.'],
  },
  wrapped: {
    path: '/wrapped',
    title: 'Kirka Wrapped — Your Kirka Story | Kirka Hub',
    description: 'Your Kirka.io games, kills, ranked year and rarest skin, told as a short video you can save and share.',
    heading: 'Kirka Wrapped',
    intro: ['Kirka Wrapped turns a player\'s Kirka.io history into a short story in slides: games played, kills, ranked results, their rarest skin and a player title, with music. Save it as a video to share.'],
  },
  giveaway: {
    path: '/giveaway',
    title: 'Kirka Giveaway Roulette | Kirka Hub',
    description: 'Pick a giveaway winner Kirka-style: up to 12 players sit round a table as Kirka characters and pass a revolver.',
    heading: 'Kirka giveaway roulette',
    intro: ['A fair, fun way to draw giveaway winners on stream or in Discord. Enter up to 12 names, each becomes a Kirka character at the table, and the last one left wins.'],
  },
  bot: {
    path: '/bot',
    title: 'Kirka Hub Discord Bot — Commands & Invite | Kirka Hub',
    description: 'Add the Kirka Hub bot to your Discord server for Kirka.io profiles, inventories, prices, trades, leaderboards and store alerts.',
    heading: 'Kirka Hub Discord bot',
    intro: [
      'The Kirka Hub bot brings the site into Discord: profiles, inventory values, skin prices, trades, clan rosters, leaderboards, quests and store alerts, all with slash commands. Link your Kirka account once and commands know who you are.',
      'Kirka Hub is a VIP bot. Server VIP unlocks every command for a whole server; Personal VIP lets you use the bot as your own app in DMs, group chats and any server. You can try /profile, /inventory and /link for free in the Kirka Hub support server, and buy VIP by messaging the owner there.',
    ],
  },
  guides: {
    path: '/guides',
    title: 'Kirka Guides — Sensitivity, Skin Values, Trading | Kirka Hub',
    description: 'Guides for Kirka.io players: sensitivity and FOV, how skin values work, trading safely, the Discord bot and reading player profiles.',
    heading: 'Kirka guides',
    intro: ['Written guides for Kirka.io players, based on the game itself and on the data Kirka Hub collects.'],
  },
};
