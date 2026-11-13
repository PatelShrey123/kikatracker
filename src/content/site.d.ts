export const SITE: string;
export const RARITY_ORDER: string[];
export function rarityLabel(rarity: string | null | undefined): string;
export function slugify(name: string): string;

export interface SiteSkin {
  name: string;
  slug: string;
  kind: 'weapon' | 'character';
  weapon: string;
  slot: string | null;
  rarity: string;
  owners: number;
  createdAt: string | null;
  creator: string | null;
  renderUrl: string | null;
}
export interface SkinStats {
  byWeapon: Record<string, SiteSkin[]>;
  median: Record<string, number>;
  total: number;
}
export interface SkinPrice {
  value: number | null;
  valueText: string | null;
  obtainableBy: string | null;
}

export function skinsFrom(items: unknown[]): SiteSkin[];
export function parseValue(text: unknown): number | null;
export function skinStats(skins: SiteSkin[]): SkinStats;
export function describeSkin(skin: SiteSkin, price: SkinPrice | null, stats: SkinStats): string[];
export function similarSkins(skin: SiteSkin, stats: SkinStats, n?: number): SiteSkin[];

export interface GuideMeta {
  slug: string;
  title: string;
  description: string;
}
export const GUIDES: GuideMeta[];

export interface PageInfo {
  path: string;
  title: string;
  description: string;
  heading: string;
  intro: string[];
}
export const PAGES: Record<string, PageInfo>;
