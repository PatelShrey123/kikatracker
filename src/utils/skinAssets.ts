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
import { getCachedItem } from './catalogCache';

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

export const BASE_WEAPON_RENDERS: Record<string, string> = {
  'CHARACTER': 'https://kirka.io/assets/img/render.b8016858.png',
  'BODY_SKIN': 'https://kirka.io/assets/img/render.b8016858.png',
  'SCAR': 'https://kirka.io/assets/img/render-mini.7f11ce89.webp',
  'VITA': 'https://kirka.io/assets/img/render-mini.f5b98f34.webp',
  'SHARK': 'https://kirka.io/assets/img/render-mini.0ec8ea84.webp',
  'AR-9': 'https://kirka.io/assets/img/render-mini.eb7cfab0.webp',
  'AR9': 'https://kirka.io/assets/img/render-mini.eb7cfab0.webp',
  'LAR': 'https://kirka.io/assets/img/render-mini.a0363f9a.webp',
  'SNIPER': 'https://kirka.io/assets/img/render-mini.a0363f9a.webp',
  'M60': 'https://kirka.io/assets/img/render-mini.5e482163.webp',
  'MAC-10': 'https://kirka.io/assets/img/render-mini.4876657f.webp',
  'MAC10': 'https://kirka.io/assets/img/render-mini.4876657f.webp',
  'REVOLVER': 'https://kirka.io/assets/img/render-mini.d26a90cd.webp',
  'PISTOL': 'https://kirka.io/assets/img/render-mini.d26a90cd.webp',
  'TOMAHAWK': 'https://kirka.io/assets/img/render-mini.e7985b42.webp',
  'BAYONET': 'https://kirka.io/assets/img/render-mini.f3df9462.webp',
  'KNIFE': 'https://kirka.io/assets/img/render-mini.f3df9462.webp',
  'MELEE': 'https://kirka.io/assets/img/render-mini.f3df9462.webp',
  'WEATIE': 'https://kirka.io/assets/img/render-mini.c50a020d.webp',
  'SHOTGUN': 'https://kirka.io/assets/img/render-mini.c50a020d.webp',
};

export function getBaseWeaponRender(weaponType?: string | null): string {
  if (!weaponType) return `${import.meta.env.BASE_URL}render-mini.webp`;
  const normalized = weaponType.trim().toUpperCase().replace(/^_+/, '');
  return BASE_WEAPON_RENDERS[normalized] || `${import.meta.env.BASE_URL}render-mini.webp`;
}

export function isPlaceholderUrl(url: string | null | undefined, weaponType?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const t = url.trim();
  if (t === '' || t === 'https://kirka.io' || t === 'https://kirka.io/' || t === '/render') return true;
  if (t.endsWith('/render-mini.webp') || t === 'render-mini.webp') return true;
  if (t.includes('render.0e1d4800') || t.includes('render.d8456ef7')) return true;
  if (t.includes('__questions__')) return true;
  // Shark render hash (render-mini.0ec8ea84.webp) is mistakenly applied to 645 non-Shark skins in Kirka API!
  if (t.includes('render-mini.0ec8ea84') || t.includes('0ec8ea84')) {
    const w = (weaponType || '').trim().toUpperCase();
    if (w !== 'SHARK') return true;
  }
  return false;
}

// Kirka's catalog sometimes points a skin at another weapon's base render as a stand-in: 48 skins
// across Bayonet, VITA, MAC-10, character and more are served the base Shark image
// (render-mini.0ec8ea84.webp). Showing a Shark for a Bayonet skin is worse than showing that
// skin's own weapon, so treat "this is some other weapon's base render" as no art at all.
function borrowedFromAnotherWeapon(url: string, weapon: string | null): boolean {
  if (!url || !weapon) return false;
  if (url.includes('render-mini.0ec8ea84') && weapon.toUpperCase() !== 'SHARK') {
    return true;
  }
  return false;
}

export function formatRenderPath(url: string | null | undefined): string {
  if (!url) return `${import.meta.env.BASE_URL}render-mini.webp`;
  if (url.startsWith('/renders/')) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${base}${url}`;
  }
  return url;
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

  const weaponFrom = (it: any): string | null => {
    if (!it) return null;
    if (it.type === 'BODY_SKIN' || it.type === 'CHARACTER') return 'CHARACTER';
    return it.parent?.name || null;
  };
  let ownWeapon = typeof itemOrName === 'object' ? weaponFrom(itemOrName) : null;

  // 1. If valid renderUrl is provided, return direct CDN URL or local character render
  if (cleaned && !isPlaceholderUrl(cleaned, ownWeapon) && !borrowedFromAnotherWeapon(cleaned, ownWeapon)) {
    return formatRenderPath(cleaned);
  }

  // 2. If renderUrl missing or placeholder, look up item in client-side cached catalog
  let cachedWeapon: string | null = null;
  if (cleanName) {
    try {
      const found = getCachedItem(cleanName, ownWeapon || undefined);
      if (found) {
        cachedWeapon = found.type === 'BODY_SKIN' || found.type === 'CHARACTER'
          ? 'CHARACTER'
          : found.parent?.name || null;
        const foundClean = cleanTextureUrl(found.renderUrl);
        const foundWeapon = cachedWeapon || ownWeapon;
        if (foundClean && !isPlaceholderUrl(foundClean, foundWeapon) && !borrowedFromAnotherWeapon(foundClean, foundWeapon)) {
          return formatRenderPath(foundClean);
        }
      }
    } catch {}
  }

  // 3. Character skins fallback to generated 2D front render by skin name
  const isChar = typeof itemOrName === 'object' && (
    itemOrName.type === 'BODY_SKIN' ||
    itemOrName.type === 'CHARACTER' ||
    itemOrName.parent?.name === 'CHARACTER' ||
    isCharacterSkin(itemOrName.parent?.name || itemOrName.type)
  );
  if (isChar || ownWeapon === 'CHARACTER' || cachedWeapon === 'CHARACTER') {
    if (cleanName) {
      const safeName = cleanName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      return `${base}/renders/characters/${safeName}.png`;
    }
    return 'https://kirka.io/assets/img/render.b8016858.png';
  }

  // 4. Weapon skins fallback to base weapon model render
  const weaponKey = (typeof itemOrName === 'object' ? (itemOrName.parent?.name || ownWeapon) : ownWeapon) || cachedWeapon;
  if (weaponKey) {
    return getBaseWeaponRender(weaponKey);
  }

  return `${import.meta.env.BASE_URL}render-mini.webp`;
}
