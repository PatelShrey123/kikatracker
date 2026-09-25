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
// Columns shown in the per-skin table, in this order. Only those present in the data are rendered.
export const DISPLAY_FIELDS = ['Skin Name', 'Skin Rarity', 'Hub Value', 'Base Value', 'Obtainable By', 'Type'];

/**
 * Every column of one skin, side by side, flagging the ones that moved. The unchanged rows are
 * kept so the table reads as a record of the skin rather than a bare list of deltas.
 */
export function fieldDiff(before, after, schemaFields = null) {
  const fields = [];
  for (const key of DISPLAY_FIELDS) {
    const a = before?.[key];
    const b = after?.[key];
    if (a === undefined && b === undefined) continue;
    const from = a === undefined || a === null ? '' : String(a).trim();
    const to = b === undefined || b === null ? '' : String(b).trim();
    // A column added to (or dropped from) the whole sheet at once is a schema change, not a repricing.
    // Counting it would make a single header edit look like a thousand skins changed.
    const schema = Boolean(schemaFields?.has(key));
    fields.push({ field: key, from, to, changed: from !== to && !schema, ...(schema ? { schema: true } : {}) });
  }
  return fields;
}

/** Columns that exist on one side of the diff but not the other. */
function schemaShift(before, after) {
  const cols = (map) => {
    const set = new Set();
    for (const row of map.values()) for (const k of Object.keys(row)) set.add(k);
    return set;
  };
  const a = cols(before), b = cols(after);
  const shifted = new Set();
  for (const k of b) if (!a.has(k)) shifted.add(k);
  for (const k of a) if (!b.has(k)) shifted.add(k);
  return shifted;
}

export function diffPrices(beforeRows, afterRows) {
  const before = beforeRows instanceof Map ? beforeRows : indexRows(beforeRows);
  const after = afterRows instanceof Map ? afterRows : indexRows(afterRows);

  const schema = schemaShift(before, after);
  const added = [];
  const removed = [];
  const changed = [];
  const rawOf = (row) => String(row?.['Hub Value'] ?? row?.['Base Value'] ?? '').trim() || null;

  for (const [k, row] of after) {
    const [name, type] = k.split('|');
    const prev = before.get(k);
    if (!prev) {
      added.push({ name, type, rarity: row['Skin Rarity'] ?? '', value: valueOf(row), raw: rawOf(row), fields: fieldDiff(null, row, schema) });
      continue;
    }
    const fields = fieldDiff(prev, row, schema);
    const moved = fields.filter((f) => f.changed);
    if (!moved.length) continue;
    const a = valueOf(prev), b = valueOf(row);
    changed.push({
      name, type, rarity: row['Skin Rarity'] ?? '',
      from: a, to: b, fromRaw: rawOf(prev), toRaw: rawOf(row),
      pct: a && b ? Math.round(((b - a) / a) * 1000) / 10 : null,
      fields, changeCount: moved.length,
    });
  }

  for (const [k, row] of before) {
    if (after.has(k)) continue;
    const [name, type] = k.split('|');
    removed.push({ name, type, rarity: row['Skin Rarity'] ?? '', value: valueOf(row), raw: rawOf(row), fields: fieldDiff(row, null, schema) });
  }

  // biggest movers first; new listings and delistings read better alphabetically
  changed.sort((x, y) => Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0) || x.name.localeCompare(y.name));
  added.sort((x, y) => x.name.localeCompare(y.name));
  removed.sort((x, y) => x.name.localeCompare(y.name));

  return { added, removed, changed, schemaFields: [...schema], total: added.length + removed.length + changed.length };
}
