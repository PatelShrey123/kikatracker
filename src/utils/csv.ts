import hubPricesFallback from '../data/hub_prices.json';

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
  const apiEndpoint = '/api/prices';
  const staticFallbackUrl = `${import.meta.env.BASE_URL}data/hub_prices.json`;

  let rows: any[] = hubPricesFallback as any[];
  try {
    // 1. Try secure backend endpoint (proxies private sheet in production)
    const response = await fetch(apiEndpoint);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        rows = data;
      }
    } else {
      // 2. Fallback to static local hub_prices.json
      const staticRes = await fetch(staticFallbackUrl);
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (Array.isArray(staticData) && staticData.length > 0) {
          rows = staticData;
        }
      }
    }
  } catch (error) {
    console.warn('Using bundled Hub prices fallback:', error);
  }

  rows.forEach((row: any) => {
    const skinName = row['Skin Name'] || '';
    const rarity = row['Skin Rarity'] || '';
    const rawValue = String(row['Base Value'] || '').trim();
    const baseValueStr = rawValue.replace(/,/g, '');
    const baseValue = parseInt(baseValueStr, 10) || 0;
    // rows carrying "TBD": listed, but pending community valuation
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

  return priceMap;
}
