// Builds the /changelogs data from the repo's own history.
//
// public/data/hub_prices.json is committed, so every price edit already lives in git as an exact
// before/after. This walks the commits that touched it, diffs consecutive versions, and writes a
// changelog with real numbers — "TTV 550,000 -> 650,000" rather than a hand-written note.
//
// Run it after changing prices:  node scripts/build-price-changelog.mjs
// Vercel clones shallowly, so the output is committed rather than generated at deploy time.

import { execFileSync } from 'child_process';
import { diffPrices, indexRows } from '../api/_priceDiff.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRICES = 'public/data/hub_prices.json';
const OUT = resolve(ROOT, 'public/data/price-changelog.json');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

function loadAt(commit) {
  try {
    const rows = JSON.parse(git('show', `${commit}:${PRICES}`));
    return Array.isArray(rows) ? indexRows(rows) : null;
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

  const { added, removed, changed } = diffPrices(prev, cur);

  // a commit that touched the file without moving any price (a header rename, a reformat) still
  // belongs in the log, so it is kept with empty lists rather than dropped
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
