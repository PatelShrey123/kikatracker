// Reads the price changelog generated from this repo's own history by
// scripts/build-price-changelog.mjs. Every entry is a real commit to hub_prices.json, so the
// numbers are exact rather than hand-written notes.

export interface PriceMove {
  name: string;
  type: string;
  rarity: string;
  from: number | null;
  to: number | null;
  pct: number | null;
}

export interface SkinRef {
  name: string;
  type: string;
  rarity: string;
  value: number | null;
}

export interface ChangelogEntry {
  commit: string;
  date: string;
  subject: string;
  kind: 'baseline' | 'update';
  skinCount: number;
  added: SkinRef[];
  removed: SkinRef[];
  changed: PriceMove[];
}

export interface Changelog {
  generatedAt: string;
  entries: ChangelogEntry[];
}

export async function fetchChangelog(): Promise<Changelog> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/price-changelog.json`);
  if (!res.ok) throw new Error(`changelog returned ${res.status}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.entries)) throw new Error('Unexpected changelog shape');
  return data as Changelog;
}

/** Commit subjects are conventional-commit style; strip the prefix for display. */
export function cleanSubject(subject: string): string {
  const s = subject.replace(/^(feat|fix|chore|refactor|perf|docs|style|test)(\([^)]*\))?:\s*/i, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
