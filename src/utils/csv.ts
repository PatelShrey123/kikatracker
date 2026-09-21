export interface MarketItem {
  skinName: string;
  rarity: string;
  baseValue: number;
  baseValueFormatted: string;
  obtainableBy: string;
  type: string;
  /** The sheet lists this skin but has not priced it yet (Base Value is "TBD"). */
  pending?: boolean;
  /** baseValue is our own estimate, not a community price. */
  estimated?: boolean;
}

// Fallback pricing database in case API fetch fails
const FALLBACK_PRICES: Record<string, number> = {
  "1337_shark": 301337,
  "2022_vita": 20000,
  "2024_bayonet": 500000,
  "2025_character": 450000,
  "2025 bayonet_bayonet": 1000000,
  "2025 revolver_revolver": 750000,
  "2025 shark_shark": 1200000,
  "2025 vita_vita": 700000,
  "2026_character": 450000,
  "imperial_scar": 40000000,
  "moonlight_mac-10": 200000,
  "marage_character": 150000000,
};

// Median value per rarity+type and per rarity, built from the priced rows of the sheet.
// Used to estimate skins the community has not priced yet ("TBD") and brand new skins that
// are not in the sheet at all, so they still show a figure everywhere instead of "no price".
const estimates = { byRarityType: new Map<string, number>(), byRarity: new Map<string, number>() };

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Estimated value for a skin we have no community price for. Returns 0 when we cannot guess. */
export function estimateValue(rarity?: string | null, type?: string | null): number {
  const r = (rarity || '').toLowerCase();
  const t = (type || '').toLowerCase();
  return estimates.byRarityType.get(`${r}|${t}`) ?? estimates.byRarity.get(r) ?? 0;
}

export function formatValue(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' Billion';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' Million';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return value.toLocaleString();
}

export async function fetchAndParsePrices(): Promise<Map<string, MarketItem>> {
  const priceMap = new Map<string, MarketItem>();
  // JSON conversion of Google Sheet via OpenSheet
  const jsonUrl = 'https://opensheet.elk.sh/1pxMSoaSo8FYv-OIJ26HpSj8EDy7EDRmatHyQW24o6E4/1';

  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (Array.isArray(data)) {
      data.forEach((row: any) => {
        const skinName = row['Skin Name'] || '';
        const rarity = row['Skin Rarity'] || '';
        const rawValue = String(row['Base Value'] || '').trim();
        const baseValueStr = rawValue.replace(/,/g, '');
        const baseValue = parseInt(baseValueStr, 10) || 0;
        // 14 rows carry "TBD": listed, but the community has not agreed a price yet
        const pending = baseValue === 0 && /^tbd$/i.test(rawValue);
        const obtainableBy = row['Obtainable By'] || '';
        const type = row['Type'] || '';
        
        const item: MarketItem = {
          skinName,
          rarity,
          baseValue,
          baseValueFormatted: formatValue(baseValue),
          obtainableBy,
          type,
          pending
        };
        
        // We key by name + type combination (lowercase) to ensure precise match
        const key = `${skinName.toLowerCase()}_${type.toLowerCase()}`;
        priceMap.set(key, item);
        
        // Also save by name only in case type isn't matched exactly
        priceMap.set(skinName.toLowerCase(), item);
      });
      // Build the estimate tables from everything that does have a price...
      const unique = Array.from(new Set(priceMap.values()));
      const byRarityType = new Map<string, number[]>();
      const byRarity = new Map<string, number[]>();
      unique.forEach((it) => {
        if (it.baseValue <= 0) return;
        const r = it.rarity.toLowerCase();
        const key = `${r}|${it.type.toLowerCase()}`;
        (byRarityType.get(key) ?? byRarityType.set(key, []).get(key)!).push(it.baseValue);
        (byRarity.get(r) ?? byRarity.set(r, []).get(r)!).push(it.baseValue);
      });
      byRarityType.forEach((vals, k) => estimates.byRarityType.set(k, median(vals)));
      byRarity.forEach((vals, k) => estimates.byRarity.set(k, median(vals)));

      // ...then fill in the unpriced ones so they stop showing as "no price"
      let filled = 0;
      unique.forEach((it) => {
        if (it.baseValue > 0) return;
        const guess = estimateValue(it.rarity, it.type);
        if (guess <= 0) return;
        it.baseValue = guess;
        it.estimated = true;
        it.baseValueFormatted = `~${formatValue(guess)}`;
        filled++;
      });

      console.log(`Parsed ${priceMap.size} market valuation items from OpenSheet JSON (${filled} estimated).`);
    } else {
      throw new Error('Data is not a JSON array');
    }
  } catch (error) {
    console.error('Failed to fetch market prices from OpenSheet, loading fallback data:', error);
    
    // Initialize price map with fallback pricing
    Object.entries(FALLBACK_PRICES).forEach(([key, val]) => {
      const parts = key.split('_');
      const skinName = parts[0];
      const type = parts[1] || '';
      
      const item: MarketItem = {
        skinName: skinName.charAt(0).toUpperCase() + skinName.slice(1),
        rarity: 'Mythical',
        baseValue: val,
        baseValueFormatted: formatValue(val),
        obtainableBy: 'All Chests',
        type: type.toUpperCase()
      };
      priceMap.set(key, item);
      priceMap.set(skinName, item);
    });
  }

  return priceMap;
}
