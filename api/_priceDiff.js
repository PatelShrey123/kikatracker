// Shared price-diff logic. The leading underscore keeps Vercel from routing this as a function.
// Used by api/changelog.js (live sheet vs committed snapshot) and by
// scripts/build-price-changelog.mjs (commit vs commit), so both produce identical entries.

/** A row's effective value. "Hub Value" wins; "Base Value" is the older header. */
export function valueOf(row) {
  const raw = String(row?.['Hub Value'] ?? row?.['Base Value'] ?? '').replace(/,/g, '').trim();
  if (!raw || /^(tbd|est|n\/a|-)$/i.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Identity of a skin: its name plus the weapon it belongs to, since names repeat across types. */
export function keyOf(row) {
  return `${String(row?.['Skin Name'] ?? '').trim()}|${String(row?.['Type'] ?? '').trim()}`;
}

export function indexRows(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const k = keyOf(r);
    if (k !== '|') map.set(k, r);
  }
  return map;
}

/**
 * Compare two price tables.
 * Returns what was added, removed, and repriced — with the raw strings kept alongside the numbers
 * so the page can show exactly what the sheet said ("1,000,000" -> "2,500,000").
 */
export function diffPrices(beforeRows, afterRows) {
  const before = beforeRows instanceof Map ? beforeRows : indexRows(beforeRows);
  const after = afterRows instanceof Map ? afterRows : indexRows(afterRows);

  const added = [];
  const removed = [];
  const changed = [];
  const rawOf = (row) => String(row?.['Hub Value'] ?? row?.['Base Value'] ?? '').trim() || null;

  for (const [k, row] of after) {
    const [name, type] = k.split('|');
    const prev = before.get(k);
    if (!prev) {
      added.push({ name, type, rarity: row['Skin Rarity'] ?? '', value: valueOf(row), raw: rawOf(row) });
      continue;
    }
    const a = valueOf(prev), b = valueOf(row);
    if (a !== b) {
      changed.push({
        name, type, rarity: row['Skin Rarity'] ?? '',
        from: a, to: b, fromRaw: rawOf(prev), toRaw: rawOf(row),
        pct: a && b ? Math.round(((b - a) / a) * 1000) / 10 : null,
      });
    }
  }

  for (const [k, row] of before) {
    if (after.has(k)) continue;
    const [name, type] = k.split('|');
    removed.push({ name, type, rarity: row['Skin Rarity'] ?? '', value: valueOf(row), raw: rawOf(row) });
  }

  // biggest movers first; new listings and delistings read better alphabetically
  changed.sort((x, y) => Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0));
  added.sort((x, y) => x.name.localeCompare(y.name));
  removed.sort((x, y) => x.name.localeCompare(y.name));

  return { added, removed, changed, total: added.length + removed.length + changed.length };
}
