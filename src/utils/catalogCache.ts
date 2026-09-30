// Client-side browser storage caching for Kirka skin catalog
// Stores renderUrl and textureUrl locally in user's browser (localStorage / IndexedDB)
// Avoids repeated API hits and never stores private data in the GitHub repo!

const CACHE_KEY = 'kikatracker_catalog_cache_v4';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

export interface CachedItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  renderUrl: string | null;
  textureUrl: string | null;
  creators?: Array<{ id?: string; name: string; shortId?: string }> | null;
  parent?: {
    id?: string;
    name: string;
    type?: string;
    rarity?: string;
  } | null;
  salePrice?: number;
  published?: boolean;
  /** Kirka's own release date for the item. */
  createdAt?: string | null;
  /** Kirka's own "one of a kind" flag and owner count, shown as-is. */
  unique?: boolean | null;
  totalOwned?: number | null;
}

interface CachePayload {
  timestamp: number;
  items: CachedItem[];
}

/**
 * Sanitize URLs from Kirka API corrupted with double prefixes
 * e.g. "https://kirka.iohttps://api2.kirka.io/..." or "https://kirka.iodata:image/..."
 */
export function cleanSkinUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let trimmed = url.trim();

  // Fix malformed double prefix (e.g. 'https://kirka.iohttps://api2.kirka.io/...')
  const secondHttp = trimmed.indexOf('http', 8);
  if (secondHttp !== -1) {
    trimmed = trimmed.substring(secondHttp);
  }

  const dataIdx = trimmed.indexOf('data:image');
  if (dataIdx !== -1) {
    return trimmed.substring(dataIdx);
  }
  return trimmed;
}

// In-memory catalog cache singleton to avoid parsing 2MB JSON on every card render
let memoryCache: CachedItem[] | null = null;
const memoryCacheMap = new Map<string, CachedItem>();

function refreshMemoryCacheMap(items: CachedItem[]): void {
  memoryCacheMap.clear();
  for (const item of items) {
    if (!item) continue;
    if (item.id) memoryCacheMap.set(item.id, item);
    if (item.name) {
      const clean = item.name.replace(/^_+|_+$/g, '').trim().toLowerCase();
      const raw = item.name.trim().toLowerCase();
      const type = (item.parent?.name || item.type || '').trim().toLowerCase();

      if (type) {
        memoryCacheMap.set(`${clean}_${type}`, item);
        memoryCacheMap.set(`${raw}_${type}`, item);
        if (clean.endsWith(type)) {
          const stripped = clean.slice(0, -type.length).trim();
          if (stripped) {
            memoryCacheMap.set(`${stripped}_${type}`, item);
            if (!memoryCacheMap.has(stripped)) memoryCacheMap.set(stripped, item);
          }
        }
      }
      if (!memoryCacheMap.has(clean)) memoryCacheMap.set(clean, item);
      if (!memoryCacheMap.has(raw)) memoryCacheMap.set(raw, item);
    }
  }
}

/**
 * How old the stored catalog is, in ms, or null when there is nothing stored.
 *
 * The catalog is ~2,000 items and takes seconds to fetch. Knowing its age lets the app skip
 * the fetch entirely when what it already has is recent enough, instead of re-downloading the
 * whole thing on every page load.
 */
export function catalogCacheAgeMs(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachePayload = JSON.parse(raw);
    if (!parsed?.timestamp) return null;
    return Date.now() - parsed.timestamp;
  } catch {
    return null;
  }
}

/**
 * Retrieve cached catalog items from browser storage.
 * Returns null if cache doesn't exist or has expired.
 */
export function getCachedCatalog(): CachedItem[] | null {
  if (memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (!raw) return null;

    const parsed: CachePayload = JSON.parse(raw);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_TTL_MS) {
      // Cache expired
      localStorage.removeItem(CACHE_KEY);
      memoryCache = null;
      memoryCacheMap.clear();
      return null;
    }

    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      memoryCache = parsed.items.map((i) => ({
        ...i,
        renderUrl: cleanSkinUrl(i.renderUrl),
        textureUrl: cleanSkinUrl(i.textureUrl),
      }));
      refreshMemoryCacheMap(memoryCache);
      return memoryCache;
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

    // Slim items to keep storage compact (only essential render, texture & creator info)
    const slim = items.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      renderUrl: cleanSkinUrl(i.renderUrl),
      textureUrl: cleanSkinUrl(i.textureUrl),
      creators: i.creators || null,
      parent: i.parent ? { name: i.parent.name, type: i.parent.type } : null,
      salePrice: i.salePrice || 0,
      published: i.published,
      // the item modal shows these, and stripping them here made every skin look like it had no
      // owners, was not unique, and had no release date
      createdAt: i.createdAt ?? null,
      unique: i.unique ?? null,
      totalOwned: i.totalOwned ?? null,
    }));

    const payload: CachePayload = {
      timestamp: Date.now(),
      items: slim,
    };

    memoryCache = slim;
    refreshMemoryCacheMap(slim);
    if (typeof window !== 'undefined') {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('kikatracker_catalog_cache_') && key !== CACHE_KEY) {
            localStorage.removeItem(key);
          }
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch {
        // Quota exceeded: memoryCache remains fully operational in-memory
      }
    }
  } catch (err) {
    console.warn('[CatalogCache] Failed to process catalog:', err);
  }
}

/**
 * Clear cached catalog to force a fresh fetch from API.
 */
export function clearCachedCatalog(): void {
  try {
    memoryCache = null;
    memoryCacheMap.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {}
}

/**
 * Automatically merges live items from API into existing cache.
 * If new skins are detected, saves their URLs and returns the merged list.
 */
export function syncAndStoreCatalog(liveItems: any[]): { merged: CachedItem[]; newCount: number } {
  if (!Array.isArray(liveItems) || liveItems.length === 0) {
    const existing = getCachedCatalog() || [];
    return { merged: existing, newCount: 0 };
  }

  const existing = getCachedCatalog() || [];
  const existingMap = new Map<string, CachedItem>();

  existing.forEach((item) => {
    if (item && item.name) {
      const key = `${item.name.toLowerCase()}_${(item.parent?.name || item.type || '').toLowerCase()}`;
      existingMap.set(key, item);
    }
  });

  let newCount = 0;
  liveItems.forEach((live) => {
    if (live && live.name) {
      const key = `${live.name.toLowerCase()}_${(live.parent?.name || live.type || '').toLowerCase()}`;
      const cleanRender = cleanSkinUrl(live.renderUrl);
      const cleanTexture = cleanSkinUrl(live.textureUrl);

      if (!existingMap.has(key)) {
        newCount++;
        existingMap.set(key, {
          id: live.id,
          name: live.name,
          type: live.type,
          rarity: live.rarity,
          renderUrl: cleanRender,
          textureUrl: cleanTexture,
          creators: live.creators || null,
          parent: live.parent ? { name: live.parent.name, type: live.parent.type } : null,
          salePrice: live.salePrice || 0,
          createdAt: live.createdAt ?? null,
          unique: live.unique ?? null,
          totalOwned: live.totalOwned ?? null,
          published: live.published,
        });
      } else {
        // Live data wins: skins move from api2 placeholders to official renders (and get re-rendered),
        // so cached URLs must be refreshed rather than only filled in when missing
        const cached = existingMap.get(key)!;
        if (cleanRender) cached.renderUrl = cleanRender;
        if (cleanTexture) cached.textureUrl = cleanTexture;
        if (live.rarity) cached.rarity = live.rarity;
        if (typeof live.published === 'boolean') cached.published = live.published;
        if (live.creators && live.creators.length > 0) cached.creators = live.creators;
      }
    }
  });

  const merged = Array.from(existingMap.values());
  setCachedCatalog(merged);

  return { merged, newCount };
}

/**
 * Helper to resolve the skin creator credit or dash (-) if not provided
 */
export function resolveItemCreator(item: any): string {
  if (!item) return '-';
  const creators = item.creators || item.creator;
  if (Array.isArray(creators) && creators.length > 0) {
    const names = creators
      .map((c: any) => (typeof c === 'string' ? c : c?.name))
      .filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  if (typeof creators === 'object' && creators?.name) {
    return creators.name;
  }
  if (typeof creators === 'string' && creators.trim()) {
    return creators.trim();
  }
  return '-';
}

/**
 * Fast O(1) in-memory item lookup by id, name, or composite (name + weaponType)
 */
export function getCachedItem(identifier: string, weaponType?: string): CachedItem | null {
  if (!memoryCache || memoryCacheMap.size === 0) {
    getCachedCatalog();
  }
  if (!identifier || memoryCacheMap.size === 0) return null;
  if (memoryCacheMap.has(identifier)) return memoryCacheMap.get(identifier)!;

  const clean = identifier.replace(/^_+|_+$/g, '').trim().toLowerCase();
  const type = weaponType ? weaponType.trim().toLowerCase() : '';
  if (type) {
    const composite = memoryCacheMap.get(`${clean}_${type}`);
    if (composite) return composite;
  }
  return memoryCacheMap.get(clean) || null;
}

/**
 * Fast O(1) in-memory URL resolver for any skin
 */
export function getStoredSkinUrls(skinName: string, weaponType?: string): { renderUrl: string | null; textureUrl: string | null } {
  const item = getCachedItem(skinName, weaponType);
  if (item) {
    return { renderUrl: item.renderUrl, textureUrl: item.textureUrl };
  }
  return { renderUrl: null, textureUrl: null };
}