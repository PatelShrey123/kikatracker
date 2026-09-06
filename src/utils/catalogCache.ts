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
  creators?: Array<{ id?: string; name: string; shortId?: string }> | null;
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

    // Slim items to keep storage compact (only essential render, texture & creator info)
    const slim = items.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      rarity: i.rarity,
      renderUrl: i.renderUrl || null,
      textureUrl: i.textureUrl || null,
      creators: i.creators || null,
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
      if (!existingMap.has(key)) {
        newCount++;
        existingMap.set(key, {
          id: live.id,
          name: live.name,
          type: live.type,
          rarity: live.rarity,
          renderUrl: live.renderUrl || null,
          textureUrl: live.textureUrl || null,
          creators: live.creators || null,
          parent: live.parent ? { name: live.parent.name, type: live.parent.type } : null,
          salePrice: live.salePrice || 0,
        });
      } else {
        // Update URLs and creators if missing in cache but present in live
        const cached = existingMap.get(key)!;
        if (!cached.renderUrl && live.renderUrl) cached.renderUrl = live.renderUrl;
        if (!cached.textureUrl && live.textureUrl) cached.textureUrl = live.textureUrl;
        if ((!cached.creators || cached.creators.length === 0) && live.creators) cached.creators = live.creators;
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
 * Fast O(1) in-memory URL resolver for any skin
 */
export function getStoredSkinUrls(skinName: string, weaponType?: string): { renderUrl: string | null; textureUrl: string | null } {
  const cached = getCachedCatalog();
  if (!cached || !skinName) return { renderUrl: null, textureUrl: null };

  const cleanName = skinName.replace(/^_+/, '').trim().toLowerCase();
  const cleanType = weaponType ? weaponType.trim().toLowerCase() : '';

  // Try exact composite match
  if (cleanType) {
    const composite = cached.find(
      (c) => c.name.toLowerCase() === cleanName && (c.parent?.name || c.type || '').toLowerCase() === cleanType
    );
    if (composite) {
      return { renderUrl: composite.renderUrl, textureUrl: composite.textureUrl };
    }
  }

  // Fallback to name match
  const matched = cached.find((c) => c.name.toLowerCase() === cleanName);
  if (matched) {
    return { renderUrl: matched.renderUrl, textureUrl: matched.textureUrl };
  }

  return { renderUrl: null, textureUrl: null };
}