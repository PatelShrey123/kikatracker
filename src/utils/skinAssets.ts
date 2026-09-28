/**
 * Skin asset helpers: model file names, texture URLs, render thumbnails.
 *
 * These were living in Weapon3DViewer.tsx, which imports three.js, GLTFLoader, OrbitControls
 * and skinview3d. Chat, Trades, Prices and the profile all import a single string helper from
 * there — so every one of those pages was pulling the entire 3D stack in to format a URL. In
 * dev that is hundreds of extra module requests before anything renders.
 *
 * Nothing in this file may import three.js. That is the whole point of it existing.
 */
import { getCachedCatalog } from './catalogCache';

export const WEAPON_MODEL_MAP: Record<string, string> = {
  'VITA': 'VITA.glb',
  'SCAR': 'SCAR.glb',
  'SHARK': 'Shark.glb',
  'AR-9': 'AR-9.glb',
  'AR9': 'AR-9.glb',
  'LAR': 'LAR.glb',
  'SNIPER': 'LAR.glb',
  'M60': 'M60.glb',
  'MAC-10': 'MAC-10.glb',
  'MAC10': 'MAC-10.glb',
  'REVOLVER': 'Revolver.glb',
  'PISTOL': 'Revolver.glb',
  'TOMAHAWK': 'Tomahawk.glb',
  'BAYONET': 'Bayonet.glb',
  'KNIFE': 'Bayonet.glb',
  'MELEE': 'Bayonet.glb',
  'WEATIE': 'Weatie.glb', // Shotgun
  'SHOTGUN': 'Weatie.glb',
};

export function isCharacterSkin(weaponTypeOrParent?: string): boolean {
  if (!weaponTypeOrParent) return false;
  const n = weaponTypeOrParent.trim().toUpperCase();
  return n === 'CHARACTER' || n === 'BODY_SKIN' || n === 'BODY SKIN' || n === 'BODY';
}

export function getModelFileName(weaponTypeOrParent?: string): string | null {
  if (!weaponTypeOrParent) return null;
  const normalized = weaponTypeOrParent.trim().toUpperCase().replace(/^_+/, '');
  return WEAPON_MODEL_MAP[normalized] || null;
}

export function has3DViewerSupport(weaponTypeOrParent?: string): boolean {
  if (!weaponTypeOrParent) return false;
  if (isCharacterSkin(weaponTypeOrParent)) return true;
  return !!getModelFileName(weaponTypeOrParent);
}

// Clean texture URL to handle Kirka API malformed URIs (e.g. 'https://kirka.iodata:image/png;base64,...' or 'https://kirka.iohttps://api2.kirka.io/...')
export function cleanTextureUrl(url: string | null | undefined): string | null {
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

export function getProxiedTextureUrl(url: string | null | undefined): string {
  const cleaned = cleanTextureUrl(url);
  if (!cleaned) return '';
  if (cleaned.startsWith('data:') || cleaned.startsWith('blob:') || cleaned.startsWith('/')) {
    return cleaned;
  }
  if (cleaned.startsWith('https://kirka.io/')) {
    return cleaned.replace('https://kirka.io/', '/kirka-assets/');
  }
  if (cleaned.startsWith('http://kirka.io/')) {
    return cleaned.replace('http://kirka.io/', '/kirka-assets/');
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(cleaned)}`;
}

export function getModelUrl(modelFile: string): string {
  const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
  return `${prefix}/models/${modelFile}`;
}

// Load and cache a parsed GLB scene; callers receive their own clone

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const t = url.trim();
  if (t === '' || t === 'https://kirka.io' || t === 'https://kirka.io/' || t === '/render') return true;
  if (t.endsWith('/render-mini.webp') || t === 'render-mini.webp') return true;
  if (t.includes('render.0e1d4800') || t.includes('render.d8456ef7')) return true;  if (t.includes('__questions__')) return true;
  return false;
}

// Kirka's catalog sometimes points a skin at another weapon's base render as a stand-in: 48 skins
// across Bayonet, VITA, MAC-10, character and more are served the base Shark image
// (render-mini.0ec8ea84.webp). Showing a Shark for a Bayonet skin is worse than showing that
// skin's own weapon, so treat "this is some other weapon's base render" as no art at all.
function borrowedFromAnotherWeapon(url: string, weapon: string | null): boolean {
  if (!url || !weapon) return false;
  try {
    const cached = getCachedCatalog();
    if (!cached || !Array.isArray(cached)) return false;
    const file = url.split('/').pop();
    if (!file) return false;
    const owner = cached.find(
      (c) =>
        c.name &&
        /^(WEAPON_\d+|CHARACTER)$/.test(String(c.type || '')) &&
        typeof c.renderUrl === 'string' &&
        c.renderUrl.endsWith(file)
    );
    if (!owner?.name) return false;
    return owner.name.trim().toLowerCase() !== weapon.trim().toLowerCase();
  } catch {
    return false;
  }
}

// Universal skin render image resolver:
// 1. Prioritize official CDN renderUrl directly for <img> tags (no proxy needed!)
// 2. Look up skin name in client-cached catalog if renderUrl is missing or placeholder
// 3. Fall back gracefully to base weapon or character render instead of flat UV textures or pistols
export function getSkinRenderUrl(itemOrName: any): string {
  if (!itemOrName) return `${import.meta.env.BASE_URL}render-mini.webp`;
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
  const cleanName = name ? name.replace(/^_+/, '').trim() : '';
  const rawUrl = typeof itemOrName === 'object' ? (itemOrName.renderUrl || itemOrName.renderurl) : null;
  const cleaned = cleanTextureUrl(rawUrl);

  // Which weapon this skin belongs to, so a stand-in image from a different weapon can be spotted.
  // Callers often pass just a name and a url, so fall back to looking the skin up in the catalog.
  const weaponFrom = (it: any): string | null => {
    if (!it) return null;
    if (it.type === 'BODY_SKIN' || it.type === 'CHARACTER') return 'CHARACTER';
    return it.parent?.name || null;
  };
  let ownWeapon = typeof itemOrName === 'object' ? weaponFrom(itemOrName) : null;
  if (!ownWeapon && cleanName) {
    try {
      const cached = getCachedCatalog();
      const lower = cleanName.toLowerCase();
      ownWeapon = weaponFrom(cached?.find((c) => c.name && c.name.toLowerCase() === lower));
    } catch {}
  }

  // 1. If valid renderUrl is provided, return direct CDN URL (<img> tags do not need CORS proxy)
  if (cleaned && !isPlaceholderUrl(cleaned) && !borrowedFromAnotherWeapon(cleaned, ownWeapon)) {
    return cleaned;
  }

  // 2. If renderUrl missing or placeholder, look up item in client-side cached catalog
  if (cleanName) {
    try {
      const cached = getCachedCatalog();
      if (cached && Array.isArray(cached)) {
        const lower = cleanName.toLowerCase();
        const found = cached.find((c) => c.name && c.name.toLowerCase() === lower);
        const foundClean = cleanTextureUrl(found?.renderUrl);
        const foundWeapon = found
          ? (found.type === 'BODY_SKIN' || found.type === 'CHARACTER' ? 'CHARACTER' : found.parent?.name || ownWeapon)
          : ownWeapon;
        if (foundClean && !isPlaceholderUrl(foundClean) && !borrowedFromAnotherWeapon(foundClean, foundWeapon)) {
          return foundClean;
        }
      }
    } catch {}
  }

  // 3. Query live official 3D render from api2.kirka.io if skin name is present
  if (cleanName) {
    return `https://api2.kirka.io/api/skin-render/${encodeURIComponent(cleanName)}`;
  }

  // 4. If item is a character skin without a name, return official Kirka default character render
  const isChar = typeof itemOrName === 'object' && (
    itemOrName.type === 'BODY_SKIN' ||
    itemOrName.type === 'CHARACTER' ||
    itemOrName.parent?.name === 'CHARACTER' ||
    isCharacterSkin(itemOrName.parent?.name || itemOrName.type)
  );
  if (isChar) {
    return 'https://kirka.io/assets/img/render.b8016858.png';
  }

  // 5. If item is a weapon skin with a known parent, try finding the base weapon render
  if (typeof itemOrName === 'object' && itemOrName.parent?.name) {
    const baseName = itemOrName.parent.name.trim();
    try {
      const cached = getCachedCatalog();
      if (cached && Array.isArray(cached)) {
        const lowerBase = baseName.toLowerCase();
        const foundBase = cached.find(
          (c) => c.name && (c.name.toLowerCase() === lowerBase || c.name.toLowerCase() === `_${lowerBase}`)
        );
        if (foundBase?.renderUrl && !isPlaceholderUrl(foundBase.renderUrl)) {
          return cleanTextureUrl(foundBase.renderUrl)!;
        }
      }
    } catch {}
  }

  return `${import.meta.env.BASE_URL}render-mini.webp`;
}
