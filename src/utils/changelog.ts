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

/** Live diff between the price sheet and the last committed snapshot. */
export interface PendingChanges {
  generatedAt: string;
  sheetReachable: boolean;
  snapshotCount: number;
  sheetCount: number;
  pending: {
    added: (SkinRef & { raw: string | null })[];
    removed: (SkinRef & { raw: string | null })[];
    changed: (PriceMove & { fromRaw: string | null; toRaw: string | null })[];
    total: number;
  };
}

/** Undeployed sheet edits. Resolves to null when the endpoint is unavailable (e.g. vite dev). */
export async function fetchPending(): Promise<PendingChanges | null> {
  try {
    const res = await fetch('/api/changelog');
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.pending ? (data as PendingChanges) : null;
  } catch {
    return null;
  }
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
