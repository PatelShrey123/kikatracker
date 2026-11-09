export interface LiveRoom {
  id: string;
  code: string;
  tag: string;
  region: string;
  mode: string;
  map: string;
  players: number;
  maxPlayers: number;
  isFull: boolean;
  inRound: boolean;
  roundCreatedAt?: number;
  isCustomMap: boolean;
  joinUrl: string;
}

export interface RegionSummary {
  id: string;
  name: string;
  flag: string;
  host: string;
  roomsCount: number;
  playersCount: number;
}

export const REGIONS: Record<string, { id: string; name: string; flag: string; host: string }> = {
  india: {
    id: 'india',
    name: 'India (Mumbai)',
    flag: '🇮🇳',
    host: 'india.kirka.io',
  },
  asia: {
    id: 'asia',
    name: 'Asia (Singapore/Tokyo)',
    flag: '🌏',
    host: 'asia.kirka.io',
  },
  eu: {
    id: 'eu',
    name: 'Europe (Frankfurt)',
    flag: '🇪🇺',
    host: 'eu.kirka.io',
  },
  na: {
    id: 'na',
    name: 'North America',
    flag: '🇺🇸',
    host: 'na.kirka.io',
  },
  sa: {
    id: 'sa',
    name: 'South America',
    flag: '🇧🇷',
    host: 'sa.kirka.io',
  },
  oceania: {
    id: 'oceania',
    name: 'Oceania',
    flag: '🇦🇺',
    host: 'oceania.kirka.io',
  },
};

/**
 * Kirka scrambles the key names in this feed and changes them whenever the game updates, which has
 * zeroed every lobby here more than once. The order and shape of the values don't change, so a room
 * is read by those. Top level, in order: locked, player count, created date, room capacity,
 * metadata, name, process id, room id. In the metadata, the player count is followed by the match's
 * player limit, and the map is the first text value that isn't the mode.
 */
function readRoom(r: any) {
  if (!r || typeof r !== 'object') return null;
  const mode = typeof r.name === 'string' ? r.name : '';
  // A party waiting together, not a match anyone can join.
  if (!mode || mode === 'LobbyRoom') return null;

  const values = Object.values(r);
  const numbers = values.filter((v): v is number => typeof v === 'number');
  const texts = values.filter((v): v is string => typeof v === 'string');
  const meta = (values.find((v) => v && typeof v === 'object' && !Array.isArray(v)) ?? {}) as Record<string, unknown>;
  const metaValues = Object.values(meta);

  const players = numbers[0] ?? 0;
  const capacity = numbers[1] ?? 8;
  const code = texts[texts.length - 1];
  if (!code || code === mode) return null;

  const metaNumbers = metaValues.filter((v): v is number => typeof v === 'number');
  const countAt = metaNumbers.indexOf(players);
  const limit = countAt >= 0 ? metaNumbers[countAt + 1] : undefined;
  const maxPlayers = typeof limit === 'number' && limit >= Math.max(players, 1) && limit <= capacity ? limit : capacity;

  const map = metaValues.find((v): v is string => typeof v === 'string' && v !== '' && v !== mode) ?? 'Unknown';

  return {
    mode,
    map,
    players,
    maxPlayers,
    code,
    inRound: meta.inRound___METADATA !== false,
    roundCreatedAt: typeof meta.roundCreatedAt___METADATA === 'number' ? meta.roundCreatedAt___METADATA : undefined,
    isCustomMap: Boolean(meta.customMap___METADATA),
  };
}

/**
 * Fetches live matches for a given server region
 */
export async function fetchRegionRooms(regionKey: string = 'india'): Promise<LiveRoom[]> {
  const reg = REGIONS[regionKey] || REGIONS.india;
  const res = await fetch(`https://${reg.host}/matchmake/`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to query Kirka cluster ${reg.host} (${res.status})`);
  }

  const rawRooms = await res.json();
  if (!Array.isArray(rawRooms)) return [];

  return rawRooms.flatMap((r: any) => {
    const room = readRoom(r);
    if (!room) return [];
    const tag = `${reg.id.toUpperCase()}~${room.code}`;
    return [{
      id: room.code,
      code: room.code,
      tag,
      region: reg.id,
      mode: room.mode,
      map: room.map,
      players: room.players,
      maxPlayers: room.maxPlayers,
      isFull: room.players >= room.maxPlayers,
      inRound: room.inRound,
      roundCreatedAt: room.roundCreatedAt,
      isCustomMap: room.isCustomMap,
      joinUrl: `https://kirka.io/games/${tag}`,
    }];
  });
}

/**
 * Fetches stats across all the server regions concurrently
 */
export async function fetchAllRegionsSummary(): Promise<RegionSummary[]> {
  const regionKeys = Object.keys(REGIONS);

  const results = await Promise.allSettled(
    regionKeys.map(async (key) => {
      const reg = REGIONS[key];
      const rooms = await fetchRegionRooms(key);
      const playersCount = rooms.reduce((sum, room) => sum + room.players, 0);
      return {
        id: reg.id,
        name: reg.name,
        flag: reg.flag,
        host: reg.host,
        roomsCount: rooms.length,
        playersCount,
      };
    })
  );

  return results.map((res, index) => {
    const key = regionKeys[index];
    const reg = REGIONS[key];
    if (res.status === 'fulfilled') {
      return res.value;
    }
    return {
      id: reg.id,
      name: reg.name,
      flag: reg.flag,
      host: reg.host,
      roomsCount: 0,
      playersCount: 0,
    };
  });
}
