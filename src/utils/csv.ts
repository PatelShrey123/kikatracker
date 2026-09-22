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

/** Estimated value stub for unpriced skins. Returns 0 as fake estimates are removed. */
export function estimateValue(_rarity?: string | null, _type?: string | null): number {
  return 0;
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
          baseValueFormatted: pending || baseValue === 0 ? 'TBD' : formatValue(baseValue),
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

      console.log(`Parsed ${priceMap.size} market valuation items from OpenSheet JSON.`);
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
