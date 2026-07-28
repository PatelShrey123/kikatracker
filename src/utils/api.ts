// Kirka.io API integration layer with High-Fidelity Mock Fallbacks

// API Base URL. In development, we use relative paths (which will be proxied by Vite).
// If we build static files or are outside Vite dev, we use the direct API.
const API_BASE = '/api';

// Fallback headers if client calls API directly
const HEADERS = {
  'Content-Type': 'application/json'
};

// Types corresponding to Kirka API schemas
export interface UserStats {
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  headshots: number;
  scores: number;
}

export interface WeaponParent {
  id: string;
  name: string;
  type: string;
  rarity: string;
}

export interface ActiveSkin {
  id: string;
  name: string;
  type: string;
  rarity: string;
  parent?: WeaponParent | null;
  renderUrl?: string | null;
  textureUrl?: string | null;
}

export interface UserProfile {
  id: string;
  shortId: string;
  name: string;
  bio?: string;
  role: string;
  klo: number;
  kloRanked?: number;
  kloSAD?: number;
  klo1V1?: number;
  klo2V2?: number;
  level: number;
  totalXp: number;
  xpSinceLastLevel: number;
  xpUntilNextLevel: number;
  coins: number;
  diamonds: number;
  createdAt: string;
  clan?: string | null;
  activeWeapon1Skin?: ActiveSkin | null;
  activeBodySkin?: ActiveSkin | null;
  stats: UserStats;
}

export interface QuestReward {
  id: string;
  type: 'XP' | 'COINS' | 'DIAMONDS' | 'ITEM';
  amount: number;
  item: any | null;
}

export interface Quest {
  id: string;
  type: 'hourly' | 'daily' | 'weekly' | 'event';
  name: string;
  weapon: string;
  amount: number;
  endedAt: string;
  rarity: string;
  rewards: QuestReward[];
  progress: {
    amount: number;
    completed: boolean;
    completedDone: boolean;
    rewardTaken: boolean;
  };
}

export interface UserInventoryItem {
  item: {
    id: string;
    parentId: string | null;
    type: 'WEAPON_SKIN' | 'BODY_SKIN' | 'CHEST' | 'CHARACTER_CARD';
    rarity: string;
    name: string;
    salePrice: number;
    renderUrl: string | null;
    textureUrl: string | null;
    parent?: WeaponParent | null;
  };
  amount: number;
  market: number;
  isSelected: boolean;
}

export interface SoloLeaderboardResult {
  userId: string;
  name: string;
  scores: number;
}

export interface RankedLeaderboardResult {
  id: string;
  shortId: string;
  role: string;
  name: string;
  kloSAD?: number;
  klo1V1?: number;
  klo2V2?: number;
}

export interface ClanLeaderboardResult {
  clanId: string;
  name: string;
  membersCount: number;
  scores: number;
}

export interface ClanMember {
  user: {
    id: string;
    shortId: string;
    name: string;
    level: number;
  };
  role: 'LEADER' | 'OWNER' | 'OFFICER' | 'NEWBIE' | 'MEMBER';
  allScores: number;
  createdAt: string;
  monthScores: number;
}

export interface ClanResponse {
  id: string;
  name: string;
  description: string;
  discordLink?: string;
  allScores: number;
  createdAt: string;
  members: ClanMember[];
}

// High-Fidelity Mock Data Fallbacks
export const MOCK_PROFILE: Record<string, UserProfile> = {
  "fed19590-9bf2-45c5-9f97-156647508efe": {
    id: "fed19590-9bf2-45c5-9f97-156647508efe",
    shortId: "HESHPY",
    name: "shadow",
    bio: "Trust in the Lord your God ♥️",
    role: "USER",
    klo: 1423,
    kloRanked: 234.95,
    kloSAD: 137.6,
    klo1V1: 1108.46,
    klo2V2: 996.81,
    level: 100,
    totalXp: 9971016,
    xpSinceLastLevel: 1671216,
    xpUntilNextLevel: 5210000,
    coins: 2040972,
    diamonds: 169,
    createdAt: "2024-04-01T07:49:36.854Z",
    clan: "kiss",
    activeWeapon1Skin: {
      id: "33825eca-a7e7-422e-947a-d090d75f9215",
      type: "WEAPON_SKIN",
      rarity: "MYTHICAL",
      name: "Imperial",
      parent: { id: "eb59d477-9735-43b8-9cfb-81080ea2dd1b", name: "SCAR", type: "WEAPON_1", rarity: "COMMON" }
    },
    activeBodySkin: {
      id: "df064e8c-06b8-4284-bbe5-cd4d5e88de89",
      type: "BODY_SKIN",
      rarity: "MYTHICAL",
      name: "Marage"
    },
    stats: { games: 4075, wins: 2861, kills: 52056, deaths: 24673, headshots: 44737, scores: 5757369 }
  },
  "9d42e1d0-cf39-40bd-91c2-7b85e8b36233": {
    id: "9d42e1d0-cf39-40bd-91c2-7b85e8b36233",
    shortId: "S2WVOK",
    name: "Hisoka",
    bio: "Top 1 S&D Player in Kirka ⚡",
    role: "USER",
    klo: 5759,
    kloSAD: 5758.99,
    level: 120,
    totalXp: 18942100,
    xpSinceLastLevel: 312000,
    xpUntilNextLevel: 5500000,
    coins: 4501290,
    diamonds: 320,
    createdAt: "2023-11-12T14:22:11.231Z",
    clan: "kiss",
    stats: { games: 12450, wins: 9840, kills: 148900, deaths: 62100, headshots: 110450, scores: 18451000 }
  }
};

export const MOCK_INVENTORY: Record<string, UserInventoryItem[]> = {
  "fed19590-9bf2-45c5-9f97-156647508efe": [
    {
      item: {
        id: "33825eca-a7e7-422e-947a-d090d75f9215",
        parentId: "eb59d477-9735-43b8-9cfb-81080ea2dd1b",
        type: "WEAPON_SKIN",
        rarity: "MYTHICAL",
        name: "Imperial",
        salePrice: 40000,
        renderUrl: "https://kirka.io/assets/img/render-mini.67fdc7ae.webp",
        textureUrl: null,
        parent: { id: "eb59d477-9735-43b8-9cfb-81080ea2dd1b", name: "SCAR", type: "WEAPON_1", rarity: "COMMON" }
      },
      amount: 1,
      market: 0,
      isSelected: true
    },
    {
      item: {
        id: "df064e8c-06b8-4284-bbe5-cd4d5e88de89",
        parentId: null,
        type: "BODY_SKIN",
        rarity: "MYTHICAL",
        name: "Marage",
        salePrice: 25000,
        renderUrl: "https://kirka.io/assets/img/render-mini.67fdc7ae.webp",
        textureUrl: null
      },
      amount: 1,
      market: 0,
      isSelected: true
    },
    {
      item: {
        id: "dc9a2bd2-a6a5-4aa7-b340-2f77fbb03127",
        parentId: "121c51ef-fa5f-4098-99a7-0bf70e969892",
        type: "WEAPON_SKIN",
        rarity: "MYTHICAL",
        name: "Moonlight",
        salePrice: 20000,
        renderUrl: null,
        textureUrl: null,
        parent: { id: "121c51ef-fa5f-4098-99a7-0bf70e969892", name: "MAC-10", type: "WEAPON_1", rarity: "COMMON" }
      },
      amount: 1,
      market: 0,
      isSelected: false
    },
    {
      item: {
        id: "a7d41435-d5a1-495d-8c96-0486b0896cfa",
        parentId: "0b2779f3-df2f-43ab-9487-308a05ec1284",
        type: "WEAPON_SKIN",
        rarity: "MYTHICAL",
        name: "1337",
        salePrice: 20000,
        renderUrl: "https://kirka.io/assets/img/render-mini.67fdc7ae.webp",
        textureUrl: null,
        parent: { id: "0b2779f3-df2f-43ab-9487-308a05ec1284", name: "Shark", type: "WEAPON_2", rarity: "COMMON" }
      },
      amount: 2,
      market: 0,
      isSelected: false
    }
  ]
};

const MOCK_QUESTS: Quest[] = [
  {
    id: "7b08d59e-89f8-4dbc-84b2-2e95a574fe25",
    type: "hourly",
    name: "DM (Deathmatch Kills)",
    weapon: "undefined",
    amount: 18,
    endedAt: new Date(Date.now() + 1800000).toISOString(),
    rarity: "legendary",
    rewards: [
      { id: "xp-reward", type: "XP", amount: 1800, item: null },
      { id: "coin-reward", type: "COINS", amount: 900, item: null }
    ],
    progress: { amount: 8, completed: false, completedDone: false, rewardTaken: false }
  },
  {
    id: "74415bec-d2ea-430f-b710-c204692778db",
    type: "daily",
    name: "SCORE (Accumulate Score)",
    weapon: "undefined",
    amount: 9198,
    endedAt: new Date(Date.now() + 54000000).toISOString(),
    rarity: "rare",
    rewards: [
      { id: "xp-reward-2", type: "XP", amount: 1839, item: null },
      { id: "coin-reward-2", type: "COINS", amount: 918, item: null }
    ],
    progress: { amount: 4500, completed: false, completedDone: false, rewardTaken: false }
  }
];

const MOCK_SOLO_LEADERBOARD: SoloLeaderboardResult[] = [
  { userId: "7907ed30-1e73-4c45-bb34-bac989e7e742", name: "XDXDXDnoprime", scores: 46442 },
  { userId: "7f4ca17f-a7a0-474b-b59d-4f04be478f9d", name: "Bot#0", scores: 32256 },
  { userId: "00075e3f-5925-4f88-8158-1d35121ed138", name: "Fabin", scores: 28280 },
  { userId: "558fa474-eaf1-4d9b-9509-3f0d12c28e9b", name: "iWin", scores: 25161 },
  { userId: "aad8b7b2-0c00-4df2-9566-dbaf9b61c752", name: "BanBoMeBayGio", scores: 24979 },
  { userId: "guest-a41661b9-ee4a-49e4-b438-4736ba13e2fd", name: "Newbie", scores: 24506 },
  { userId: "6500e0f6-10ba-4b5c-820c-864b0a3ac9ef", name: "Unknown", scores: 22973 },
  { userId: "guest-457c3fde-bd9d-4c95-ab02-597b8becd919", name: "Newbie", scores: 22841 },
  { userId: "40a82586-b2b2-48bf-af45-a1a237369d0a", name: "Jack_Sparrow", scores: 18894 },
  { userId: "f9721f1b-29e6-470e-86ad-5f84e56784be", name: "hhiromi", scores: 18634 }
];

const MOCK_CLANS: ClanLeaderboardResult[] = [
  { clanId: "9cf4ae6e-dee3-46a7-9964-d8feed9f1797", name: "kiss", membersCount: 98, scores: 65028188 },
  { clanId: "eb50e364-757e-491f-9973-839a81867d92", name: "Blackmafia", membersCount: 100, scores: 55910796 },
  { clanId: "93328e13-8ba3-4381-ac85-5c298d0da4c0", name: "ThePhoenix", membersCount: 98, scores: 41692805 },
  { clanId: "a4ede423-8bd3-46e9-9c52-3c4dd62b5656", name: "PRO9", membersCount: 100, scores: 32801716 },
  { clanId: "4f03ae71-14bb-4a1c-8166-805db5121510", name: "VinK", membersCount: 94, scores: 26165741 },
  { clanId: "5d912683-46f7-4db2-af26-076c27bea650", name: "rune", membersCount: 71, scores: 25557174 },
  { clanId: "00568be3-43a7-49f4-b281-ce046c29458d", name: "burger", membersCount: 90, scores: 25103229 },
  { clanId: "e7c180d7-0c0d-456a-8782-55adafe2a56f", name: "War_LORDS", membersCount: 81, scores: 23503798 },
  { clanId: "985d140a-a5e5-448a-905b-ef52de54448c", name: "GLADIATORZ", membersCount: 68, scores: 15471660 }
];

const MOCK_CLAN_DETAIL: Record<string, ClanResponse> = {
  "kiss": {
    id: "9cf4ae6e-dee3-46a7-9964-d8feed9f1797",
    name: "kiss",
    description: "WE ARE THE GAY GANG KISS UP",
    discordLink: "https://discord.gg/afsbdFjEBz",
    allScores: 61454620,
    createdAt: "2026-05-22T15:40:45.745Z",
    members: [
      {
        user: { id: "fed19590-9bf2-45c5-9f97-156647508efe", shortId: "HESHPY", name: "shadow", level: 100 },
        role: "LEADER", allScores: 40825, monthScores: 5470, createdAt: "2026-05-22T15:41:30.818Z"
      },
      {
        user: { id: "f89f551b-813e-4a90-936e-7c39b5a7fe37", shortId: "74BA8S", name: "whaa", level: 100 },
        role: "OFFICER", allScores: 178125, monthScores: 21300, createdAt: "2026-05-22T15:40:45.745Z"
      },
      {
        user: { id: "df9ba6de-e605-42ef-8b12-40a7a70996cc", shortId: "ZYNOTW", name: "reze.", level: 98 },
        role: "NEWBIE", allScores: 729155, monthScores: 236760, createdAt: "2026-05-22T16:25:03.681Z"
      },
      {
        user: { id: "b35405de-6bc7-446f-bdac-3389dbac655c", shortId: "OE5938", name: "boop", level: 98 },
        role: "NEWBIE", allScores: 513660, monthScores: 0, createdAt: "2026-05-24T05:31:37.385Z"
      }
    ]
  }
};

const MOCK_RANKED_SAD: RankedLeaderboardResult[] = [
  { id: "9d42e1d0-cf39-40bd-91c2-7b85e8b36233", shortId: "S2WVOK", role: "USER", name: "Hisoka", kloSAD: 5758.992 },
  { id: "a2035d2a-40d0-4d1e-952b-4fc48dc53c94", shortId: "02979J", role: "USER", name: "Baduy", kloSAD: 5157.173 },
  { id: "00075e3f-5925-4f88-8158-1d35121ed138", shortId: "KB4ACS", role: "USER", name: "Fabin", kloSAD: 4103.744 },
  { id: "f35cf12b-3dd4-45bd-b127-564e5a246fa6", shortId: "FALCON", role: "USER", name: "CometFPS", kloSAD: 3591.745 },
  { id: "3321648a-0db5-43f1-8851-618da458e3cb", shortId: "KAGEYA", role: "USER", name: "kageyama", kloSAD: 3367.81 },
  { id: "28e932da-fdfa-48a3-9cb5-ef5928ca1e32", shortId: "ELLA99", role: "USER", name: "Ella", kloSAD: 3339.02 },
  { id: "1a82e9cb-4ab5-4ca1-817e-be983e20e1cd", shortId: "YURAYU", role: "USER", name: "Yura_Yufa", kloSAD: 3138.6 },
  { id: "7a268ce2-4e92-4cb1-80a5-f12b6a5e12ca", shortId: "JOHNNY", role: "USER", name: "John_Kirka", kloSAD: 3013.5 },
  { id: "982ea5c2-f12d-4ac1-b9cb-de987fa2312b", shortId: "GLOWING", role: "USER", name: "Glowing_Dev", kloSAD: 3000.9 }
];

// Helper wrapper for fetches that handles local proxy and mocks
async function apiRequest<T>(endpoint: string, method: string = 'GET', body: any = null): Promise<T> {
  const options: RequestInit = {
    method,
    headers: HEADERS
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  // Attempt live request first
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.warn(`Live API error for ${endpoint}, returning mock fallback:`, err);
    throw err; // bubble up so specific handler can return matched mock
  }
}

export async function fetchSoloLeaderboard(): Promise<SoloLeaderboardResult[]> {
  try {
    const res = await apiRequest<{ results: SoloLeaderboardResult[] }>('/leaderboard/solo');
    return res.results || [];
  } catch {
    return MOCK_SOLO_LEADERBOARD;
  }
}

export async function fetchClanLeaderboard(): Promise<ClanLeaderboardResult[]> {
  try {
    const res = await apiRequest<{ results: ClanLeaderboardResult[] }>('/leaderboard/clan');
    return res.results || [];
  } catch {
    return MOCK_CLANS;
  }
}

export async function fetchRankedSAD(): Promise<RankedLeaderboardResult[]> {
  try {
    const res = await apiRequest<{ results: RankedLeaderboardResult[] }>('/leaderboard/rankedSAD');
    return res.results || [];
  } catch {
    return MOCK_RANKED_SAD;
  }
}

export async function fetchRanked1v1(): Promise<RankedLeaderboardResult[]> {
  try {
    const res = await apiRequest<{ results: RankedLeaderboardResult[] }>('/leaderboard/ranked1V1');
    return res.results || [];
  } catch {
    // 1v1 and 2v2 return nothing live, so we return empty array
    return [];
  }
}

export async function fetchRanked2v2(): Promise<RankedLeaderboardResult[]> {
  try {
    const res = await apiRequest<{ results: RankedLeaderboardResult[] }>('/leaderboard/ranked2V2');
    return res.results || [];
  } catch {
    // 2v2 returns nothing live, so we return empty array
    return [];
  }
}

export async function fetchClanDetail(name: string): Promise<ClanResponse> {
  try {
    return await apiRequest<ClanResponse>(`/clan/${encodeURIComponent(name)}`);
  } catch {
    const normalizedName = name.toLowerCase();
    if (MOCK_CLAN_DETAIL[normalizedName]) {
      return MOCK_CLAN_DETAIL[normalizedName];
    }
    // Return generic mock clan if not kiss
    return {
      id: `generic-clan-id-${normalizedName}`,
      name,
      description: `Active Kirka.io competitive clan. Join our community for tournaments and ranked battles!`,
      discordLink: "https://discord.gg/kirka",
      allScores: 12500400,
      createdAt: "2024-01-10T12:00:00Z",
      members: [
        {
          user: { id: `leader-${normalizedName}`, shortId: "LEADER", name: `${name}_Leader`, level: 95 },
          role: "LEADER", allScores: 1200000, monthScores: 250000, createdAt: "2024-01-10T12:00:00Z"
        },
        {
          user: { id: `officer-${normalizedName}`, shortId: "OFFICR", name: `${name}_Officer`, level: 88 },
          role: "OFFICER", allScores: 800000, monthScores: 150000, createdAt: "2024-01-11T12:00:00Z"
        },
        {
          user: { id: `member-${normalizedName}`, shortId: "MEMBER", name: `${name}_Player`, level: 75 },
          role: "MEMBER", allScores: 400000, monthScores: 80000, createdAt: "2024-01-12T12:00:00Z"
        }
      ]
    };
  }
}

export async function fetchUserProfile(id: string, isShortId: boolean = false): Promise<UserProfile> {
  try {
    return await apiRequest<UserProfile>('/user/getProfile', 'POST', { id, isShortId });
  } catch (err) {
    console.warn(`Failed to fetch live profile for ${id}, checking mock fallbacks:`, err);
    const cleanId = id.trim().toUpperCase();
    const matched = Object.values(MOCK_PROFILE).find(
      (p) => p.id === id || p.shortId.toUpperCase() === cleanId
    );
    if (matched) return matched;
    throw err;
  }
}

export async function fetchUserInventory(id: string, isShortId: boolean = false): Promise<UserInventoryItem[]> {
  try {
    return await apiRequest<UserInventoryItem[]>('/inventory/user', 'POST', { id, isShortId });
  } catch (err) {
    console.warn(`Failed to fetch live inventory for ${id}, checking mock fallbacks:`, err);
    const cleanId = id.trim().toUpperCase();
    const matchedProfile = Object.values(MOCK_PROFILE).find(
      (p) => p.id === id || p.shortId.toUpperCase() === cleanId
    );
    const uuid = matchedProfile ? matchedProfile.id : id;
    if (MOCK_INVENTORY[uuid]) {
      return MOCK_INVENTORY[uuid];
    }
    return []; // Return empty inventory array instead of throwing to prevent profile loading crash
  }
}

export async function fetchQuests(): Promise<Quest[]> {
  try {
    return await apiRequest<Quest[]>('/quests', 'POST', {});
  } catch {
    return MOCK_QUESTS;
  }
}

export async function fetchAllPublicItems(): Promise<any[]> {
  try {
    return await apiRequest<any[]>('/inventory/items');
  } catch {
    return [];
  }
}
