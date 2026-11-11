import type { MarketItem } from './csv';
import type { MatchHistoryItem, UserInventoryItem, UserProfile } from './api';

/**
 * Kirka Wrapped: a player's story from what Kirka publishes. The profile only has lifetime totals,
 * so the "year" part comes from ranked match history, which has a date on every match.
 */

export interface WrappedItem {
  name: string;
  weapon: string;
  rarity: string;
  /** The raw item, for the render lookup. */
  raw: any;
}

export interface Season {
  year: number;
  matches: number;
  wins: number;
  winRate: number;
  /** Null when none of the year's matches came with a rating change (Kirka only sends it on newer ones). */
  ratingNet: number | null;
  bestGain: number;
  bestStreak: number;
  xp: number;
  favMap: { name: string; count: number; winRate: number } | null;
  /** map is null when Kirka didn't say which map it was. */
  bestMatch: { map: string | null; mine: number; theirs: number; xp: number; date: Date; win: boolean } | null;
  busiestMonth: string | null;
  favWeekday: string | null;
  /** Hour of day in the viewer's own time zone. */
  favHour: number | null;
}

export interface Wrapped {
  name: string;
  shortId: string;
  level: number;
  clan: string | null;
  bio: string;
  since: Date;
  daysPlaying: number;
  lifetime: {
    games: number;
    wins: number;
    winRate: number;
    kills: number;
    deaths: number;
    kd: number;
    headshots: number;
    headshotRate: number;
    killsPerGame: number;
    xp: number;
  };
  ratings: { label: string; value: number }[];
  /** Years that have ranked matches, newest first. */
  years: { year: number; matches: number }[];
  season: Season | null;
  locker: {
    /** Different skins, and every copy counted. */
    skins: number;
    copies: number;
    worth: number;
    mostValuable: (WrappedItem & { value: number }) | null;
    rarest: (WrappedItem & { owners: number }) | null;
  };
  loadout: { weapon: WrappedItem | null; body: WrappedItem | null };
  persona: { title: string; line: string };
  traits: string[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const clean = (name?: string | null) => (name || '').replace(/^_+/, '').trim();
const toItem = (raw: any): WrappedItem | null =>
  raw ? { name: clean(raw.name), weapon: raw.type === 'BODY_SKIN' ? 'Character' : clean(raw.parent?.name) || 'Skin', rarity: String(raw.rarity || ''), raw } : null;

/** The same lookup the profile page uses: the Hub price by name and weapon, then by name. */
export function itemValue(raw: any, prices: Map<string, MarketItem>): number {
  if (!raw) return 0;
  const name = clean(raw.name).toLowerCase();
  const kind = raw.type === 'BODY_SKIN' ? 'character' : clean(raw.parent?.name).toLowerCase();
  const match = prices.get(`${name}_${kind}`) || prices.get(name);
  return match ? match.baseValue : raw.salePrice || 0;
}

const most = <T,>(list: T[]): [T, number] | null => {
  const counts = new Map<T, number>();
  for (const x of list) counts.set(x, (counts.get(x) || 0) + 1);
  let best: [T, number] | null = null;
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  return best;
};

/** The year to open on: this year if it has a real season in it, otherwise the latest one that does. */
export function defaultYear(years: { year: number; matches: number }[]): number | null {
  const real = years.filter((y) => y.matches >= 25);
  return (real[0] ?? years[0])?.year ?? null;
}

function buildSeason(matches: MatchHistoryItem[], year: number): Season | null {
  const list = matches
    .map((m) => ({ ...m, when: new Date(m.date) }))
    .filter((m) => !Number.isNaN(m.when.getTime()) && m.when.getFullYear() === year)
    .sort((a, b) => a.when.getTime() - b.when.getTime());
  if (!list.length) return null;
  const wins = list.filter((m) => m.isWin).length;
  let streak = 0;
  let bestStreak = 0;
  for (const m of list) {
    streak = m.isWin ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  // older matches come without a map or a rating change, so those only count where Kirka sent them
  const mapped = list.filter((m) => m.mapKnown !== false);
  const fav = mapped.length >= 5 ? most(mapped.map((m) => m.mapName)) : null;
  const favGames = fav ? mapped.filter((m) => m.mapName === fav[0]) : [];
  const rated = list.filter((m) => typeof m.ratingDelta === 'number');
  const best = list.reduce((a, b) => (b.xpEarned > a.xpEarned ? b : a), list[0]);
  const month = most(list.map((m) => m.when.getMonth()));
  const day = most(list.map((m) => m.when.getDay()));
  const hour = most(list.map((m) => m.when.getHours()));
  return {
    year,
    matches: list.length,
    wins,
    winRate: wins / list.length,
    ratingNet: rated.length ? rated.reduce((a, m) => a + (m.ratingDelta || 0), 0) : null,
    bestGain: Math.max(0, ...rated.map((m) => m.ratingDelta || 0)),
    bestStreak,
    xp: list.reduce((a, m) => a + (m.xpEarned || 0), 0),
    favMap: fav ? { name: fav[0], count: fav[1], winRate: favGames.filter((m) => m.isWin).length / favGames.length } : null,
    bestMatch: best ? { map: best.mapKnown === false ? null : best.mapName, mine: best.score1, theirs: best.score2, xp: best.xpEarned, date: best.when, win: best.isWin } : null,
    busiestMonth: month ? MONTHS[month[0]] : null,
    favWeekday: day ? DAYS[day[0]] : null,
    favHour: hour ? hour[0] : null,
  };
}

export function buildWrapped(
  profile: UserProfile,
  inventory: UserInventoryItem[],
  matches: MatchHistoryItem[],
  prices: Map<string, MarketItem>,
  year: number | null
): Wrapped {
  const raw = profile as any;
  const st = profile.stats || ({} as UserProfile['stats']);
  const games = st.games || 0;
  const kills = st.kills || 0;
  const deaths = st.deaths || 0;
  const since = new Date(profile.createdAt);
  const lifetime = {
    games,
    wins: st.wins || 0,
    winRate: games ? (st.wins || 0) / games : 0,
    kills,
    deaths,
    kd: deaths ? kills / deaths : kills,
    headshots: st.headshots || 0,
    headshotRate: kills ? (st.headshots || 0) / kills : 0,
    killsPerGame: games ? kills / games : 0,
    xp: profile.totalXp || 0,
  };

  const ratings = [
    { label: 'Search & Destroy', value: raw.kloSAD },
    { label: '1v1', value: raw.klo1V1 },
    { label: '2v2', value: raw.kloPOINT2V2 ?? raw.klo2V2 },
  ]
    .filter((r) => typeof r.value === 'number' && r.value > 0)
    .map((r) => ({ label: r.label, value: Math.round(r.value) }));

  const byYear = new Map<number, number>();
  for (const m of matches) {
    const y = new Date(m.date).getFullYear();
    if (!Number.isNaN(y)) byYear.set(y, (byYear.get(y) || 0) + 1);
  }
  const years = [...byYear].map(([y, n]) => ({ year: y, matches: n })).sort((a, b) => b.year - a.year);
  const season = year === null ? null : buildSeason(matches, year);

  // The locker: skins only, valued the way the profile page values them
  const skins = inventory.filter((e) => e.item && (e.item.type === 'WEAPON_SKIN' || e.item.type === 'BODY_SKIN'));
  let worth = 0;
  let mostValuable: Wrapped['locker']['mostValuable'] = null;
  let rarest: Wrapped['locker']['rarest'] = null;
  for (const e of skins) {
    const value = itemValue(e.item, prices);
    worth += value * (e.amount || 1);
    if (!mostValuable || value > mostValuable.value) mostValuable = { ...toItem(e.item)!, value };
    const owners = (e.item as any).totalOwned;
    if (typeof owners === 'number' && owners > 0 && (!rarest || owners < rarest.owners)) rarest = { ...toItem(e.item)!, owners };
  }
  const copies = skins.reduce((a, e) => a + (e.amount || 1), 0);

  // Who they are, from the stand-out number
  const weapon = toItem(profile.activeWeapon1Skin);
  const persona =
    lifetime.headshotRate >= 0.7
      ? { title: 'The Headhunter', line: `${Math.round(lifetime.headshotRate * 100)}% of your kills were headshots. You don't aim for the body.` }
      : lifetime.winRate >= 0.6
        ? { title: 'The Closer', line: `You win ${Math.round(lifetime.winRate * 100)}% of your games. Teams want you on their side.` }
        : lifetime.killsPerGame >= 12
          ? { title: 'The Fragger', line: `${lifetime.killsPerGame.toFixed(1)} kills a game. Lobbies feel it when you join.` }
          : worth >= 1_000_000_000
            ? { title: 'The Collector', line: `A locker worth ${worth.toLocaleString()}. You play in style.` }
            : games >= 2000
              ? { title: 'The Veteran', line: `${games.toLocaleString()} games in. You've seen every map a hundred times.` }
              : { title: 'The Rising Star', line: 'Every number here is going up. Next year is yours.' };

  const traits: string[] = [];
  if (weapon?.weapon && weapon.weapon !== 'Skin') traits.push(`${weapon.weapon} main`);
  if (season?.favMap && season.favMap.count / season.matches >= 0.4) traits.push(`${season.favMap.name} regular`);
  if (season?.favHour !== null && season?.favHour !== undefined && season.favHour < 5) traits.push('Night owl');
  if (lifetime.kd >= 1.5) traits.push('Positive K/D');
  if (season && season.bestStreak >= 5) traits.push(`${season.bestStreak}-win streak`);
  if (profile.clan) traits.push(`Clan ${profile.clan}`);

  return {
    name: profile.name,
    shortId: profile.shortId,
    level: profile.level,
    clan: profile.clan || null,
    bio: profile.bio || '',
    since,
    daysPlaying: Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000)),
    lifetime,
    ratings,
    years,
    season,
    locker: { skins: skins.length, copies, worth, mostValuable, rarest },
    loadout: { weapon, body: toItem(profile.activeBodySkin) },
    persona,
    traits: traits.slice(0, 4),
  };
}

/** "4 years 7 months" */
export function durationLabel(days: number) {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30.4);
  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months || !years) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function hourLabel(hour: number) {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}
