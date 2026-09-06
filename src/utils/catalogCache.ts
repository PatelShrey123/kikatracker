// Client-side browser storage caching for Kirka skin catalog
// Stores renderUrl and textureUrl locally in user's browser (localStorage / IndexedDB)
// Avoids repeated API hits and never stores private data in the GitHub repo!

const CACHE_KEY = 'kikatracker_catalog_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

export interface CachedItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  renderUrl: string | null;
  textureUrl: string | null;
  parent?: {
    id?: string;
    name: string;
    type?: string;
    rarity?: string;
  } | null;
  salePrice?: number;
}

interface CachePayload {
  timestamp: number;
  items: CachedItem[];
}

/**
 * Retrieve cached catalog items from browser storage.
 * Returns null if cache doesn't exist or has expired.
 */
export function getCachedCatalog(): CachedItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed: CachePayload = JSON.parse(raw);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_TTL_MS) {
      // Cache expired
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      return parsed.items;
    }
  } catch (err) {
    console.warn('[CatalogCache] Failed to read from browser storage:', err);
  }
  return null;
}

/**
 * Save catalog items to browser storage with timestamp.
 */
export function setCachedCatalog(items: CachedItem[]): void {
  try {
    if (!Array.isArray(items) || items.length === 0) return;

    // Slim items to keep storage compact (only essential render & texture info)
    const slim = items.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      renderUrl: i.renderUrl || null,
      textureUrl: i.textureUrl || null,
      parent: i.parent ? { name: i.parent.name, type: i.parent.type } : null,
      salePrice: i.salePrice || 0,
    }));

    const payload: CachePayload = {
      timestamp: Date.now(),
      items: slim,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[CatalogCache] Failed to write to browser storage (quota exceeded):', err);
  }
}

/**
 * Clear cached catalog to force a fresh fetch from API.
 */
export function clearCachedCatalog(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}