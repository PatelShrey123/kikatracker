// Builds the /changelogs data from the repo's own history.
//
// public/data/hub_prices.json is committed, so every price edit already lives in git as an exact
// before/after. This walks the commits that touched it, diffs consecutive versions, and writes a
// changelog with real numbers — "TTV 550,000 -> 650,000" rather than a hand-written note.
//
// Run it after changing prices:  node scripts/build-price-changelog.mjs
// Vercel clones shallowly, so the output is committed rather than generated at deploy time.

import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRICES = 'public/data/hub_prices.json';
const OUT = resolve(ROOT, 'public/data/price-changelog.json');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/** Value the site actually shows for a row: Hub Value wins, Base Value is the older header. */
const valueOf = (row) => {
  const raw = String(row['Hub Value'] ?? row['Base Value'] ?? '').replace(/,/g, '').trim();
  if (!raw || /^tbd$/i.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
const keyOf = (row) => `${String(row['Skin Name'] ?? '').trim()}|${String(row['Type'] ?? '').trim()}`;

function loadAt(commit) {
  try {
    const rows = JSON.parse(git('show', `${commit}:${PRICES}`));
    if (!Array.isArray(rows)) return null;
    const map = new Map();
    for (const r of rows) map.set(keyOf(r), r);
    return map;
  } catch {
    return null; // the file did not exist at that commit
  }
}

// oldest first, so each commit can be compared with the one before it
const commits = git('log', '--reverse', '--format=%H\t%aI\t%s', '--', PRICES)
  .trim().split('\n').filter(Boolean)
  .map((line) => { const [hash, iso, ...rest] = line.split('\t'); return { hash, iso, subject: rest.join('\t') }; });

const entries = [];
let prev = null;

for (const c of commits) {
  const cur = loadAt(c.hash);
  if (!cur) continue;

  if (!prev) {
    entries.push({
      commit: c.hash.slice(0, 7), date: c.iso, subject: c.subject,
      kind: 'baseline', skinCount: cur.size, added: [], removed: [], changed: [],
    });
    prev = cur;
    continue;
  }

  const added = [];
  const removed = [];
  const changed = [];

  for (const [k, row] of cur) {
    const before = prev.get(k);
    const [name, type] = k.split('|');
    if (!before) { added.push({ name, type, rarity: row['Skin Rarity'] ?? '', value: valueOf(row) }); continue; }
    const a = valueOf(before), b = valueOf(row);
    if (a !== b && (a !== null || b !== null)) {
      changed.push({
        name, type, rarity: row['Skin Rarity'] ?? '', from: a, to: b,
        pct: a && b ? Math.round(((b - a) / a) * 1000) / 10 : null,
      });
    }
  }
  for (const [k, row] of prev) {
    if (!cur.has(k)) { const [name, type] = k.split('|'); removed.push({ name, type, rarity: row['Skin Rarity'] ?? '', value: valueOf(row) }); }
  }

  // a commit that touched the file without moving any price (a header rename, a reformat) still
  // belongs in the log, so it is kept with empty lists rather than dropped
  changed.sort((x, y) => Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0));
  entries.push({
    commit: c.hash.slice(0, 7), date: c.iso, subject: c.subject,
    kind: 'update', skinCount: cur.size, added, removed, changed,
  });
  prev = cur;
}

entries.reverse(); // newest first, the order the page renders

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2));

const totals = entries.reduce((a, e) => ({
  changed: a.changed + e.changed.length, added: a.added + e.added.length, removed: a.removed + e.removed.length,
}), { changed: 0, added: 0, removed: 0 });
console.log(`price-changelog.json: ${entries.length} entries`);
console.log(`  ${totals.changed} price changes, ${totals.added} skins added, ${totals.removed} removed`);
console.log(`  latest snapshot: ${entries[0]?.skinCount ?? 0} skins`);
