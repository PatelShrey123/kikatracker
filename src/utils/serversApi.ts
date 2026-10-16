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
};

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

  return rawRooms.map((r: any) => {
    const meta = r.WwwMWn || {};
    const mode = r.name || meta.wMWNwm || 'TDM';
    const map = meta.wWwMnWmN || 'Shipment';
    const players = typeof r.WmwwMWnN === 'number' ? r.WmwwMWnN : 0;
    const maxPlayers = typeof meta.wWnmwNW === 'number' ? meta.wWnmwNW : 8;
    const code = r.WMwnWNmw || r.WwMmWnNw || 'LOBBY';
    const tag = `${reg.id.toUpperCase()}~${code}`;

    return {
      id: r.WwMmWnNw || code,
      code,
      tag,
      region: reg.id,
      mode,
      map,
      players,
      maxPlayers,
      isFull: players >= maxPlayers,
      inRound: meta.inRound___METADATA !== false,
      roundCreatedAt: meta.roundCreatedAt___METADATA,
      isCustomMap: Boolean(meta.customMap___METADATA),
      joinUrl: `https://kirka.io/games/${tag}`,
    };
  });
}

/**
 * Fetches stats across all 5 server regions concurrently
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
