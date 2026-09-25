import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { fetchChangelog, fetchPending } from '../utils/changelog';
import type { Changelog, PendingChanges, FieldChange } from '../utils/changelog';

// Unlisted page at /changelogs: every edit to the Kirka Hub Valuation list, as a field-by-field
// record per skin. Reachable by URL only — absent from the navbar and the sitemap.

const PER_PAGE = 12;

type Kind = 'modified' | 'added' | 'removed';

/** One skin's worth of change, flattened out of the entry it came from. */
interface Record_ {
  key: string;
  name: string;
  kind: Kind;
  fields: FieldChange[];
  changeCount: number;
  detected: string;
  previous: string | null;
  source: string;
  live: boolean;
}

const stamp = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
};

const KIND_STYLE: Record<Kind, string> = {
  modified: 'text-amber-300',
  added: 'text-emerald-300',
  removed: 'text-red-300',
};

const FieldRow: React.FC<{ f: FieldChange }> = ({ f }) => (
  <tr className={f.changed ? 'bg-emerald-500/[0.05]' : ''}>
    <td className="py-1.5 pr-4 align-top whitespace-nowrap">
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300/90 border border-emerald-500/20">
        {f.field}
      </span>
    </td>
    <td className="py-1.5 pr-4 align-top text-slate-400 break-all">
      {f.changed ? <span className="text-red-400 line-through">{f.from || '—'}</span> : (f.from || '—')}
    </td>
    <td className="py-1.5 align-top break-all">
      {f.changed ? (
        <span className="text-emerald-300 font-bold">{f.to || '—'} <span className="text-emerald-500/70">&rarr;</span></span>
      ) : (
        <span className="text-slate-400">{f.to || '—'}</span>
      )}
    </td>
  </tr>
);

const Card: React.FC<{ r: Record_ }> = ({ r }) => (
  <div className="rounded-xl border border-white/10 bg-[#11131a] overflow-hidden">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
      <span className="text-emerald-300 font-bold">
        Skin: <span className="text-white">{r.name}</span>
      </span>
      {r.kind !== 'modified' && (
        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-current/30 ${KIND_STYLE[r.kind]}`}>
          {r.kind}
        </span>
      )}
      {r.live && (
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300">
          pending
        </span>
      )}
      <span className="ml-auto text-slate-500">Changes: {r.changeCount}</span>
    </div>

    <div className="px-4 py-2 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-white/5">
            <th className="py-2 pr-4 font-normal text-slate-400">Field</th>
            <th className="py-2 pr-4 font-normal text-red-400">Old Value</th>
            <th className="py-2 font-normal text-emerald-300">New Value</th>
          </tr>
        </thead>
        <tbody>
          {r.fields.map((f) => <FieldRow key={f.field} f={f} />)}
        </tbody>
      </table>
    </div>

    <div className="px-4 py-2 border-t border-white/5 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
      <span>Detected: <span className="text-slate-400">{stamp(r.detected)}</span></span>
      <span>Previous: <span className="text-slate-600">{stamp(r.previous)}</span></span>
      {!r.live && <span className="text-slate-700">{r.source}</span>}
    </div>
  </div>
);

export const ChangelogsSection: React.FC = () => {
  const [log, setLog] = useState<Changelog | null>(null);
  const [live, setLive] = useState<PendingChanges | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchChangelog()
      .then((d) => { if (!cancelled) setLog(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the changelog'); });
    fetchPending().then((p) => { if (!cancelled) setLive(p); });
    return () => { cancelled = true; };
  }, []);

  // flatten every entry into one record per skin, newest first
  const records = useMemo<Record_[]>(() => {
    const out: Record_[] = [];

    const push = (rows: any[], kind: Kind, detected: string, previous: string | null, source: string, isLive: boolean) => {
      for (const row of rows ?? []) {
        if (!row.fields?.length) continue;
        out.push({
          key: `${source}-${kind}-${row.name}-${row.type}`,
          name: row.name,
          kind,
          fields: row.fields,
          changeCount: row.changeCount ?? row.fields.filter((f: FieldChange) => f.changed).length ?? 1,
          detected, previous, source, live: isLive,
        });
      }
    };

    if (live?.pending) {
      const detected = live.generatedAt;
      const previous = log?.entries?.[0]?.date ?? null;
      push(live.pending.changed, 'modified', detected, previous, 'live sheet', true);
      push(live.pending.added, 'added', detected, previous, 'live sheet', true);
      push(live.pending.removed, 'removed', detected, previous, 'live sheet', true);
    }

    for (const e of log?.entries ?? []) {
      const src = e.commit;
      push(e.changed, 'modified', e.date, e.previousDate ?? null, src, false);
      push(e.added, 'added', e.date, e.previousDate ?? null, src, false);
      push(e.removed, 'removed', e.date, e.previousDate ?? null, src, false);
    }
    return out;
  }, [log, live]);

  const totals = useMemo(() => ({
    all: records.length,
    added: records.filter((r) => r.kind === 'added').length,
    removed: records.filter((r) => r.kind === 'removed').length,
    modified: records.filter((r) => r.kind === 'modified').length,
    skins: log?.entries?.[0]?.skinCount ?? live?.sheetCount ?? 0,
    lastCheck: live?.generatedAt ?? log?.generatedAt ?? null,
  }), [records, log, live]);

  const shown = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => r.kind === filter)),
    [records, filter]
  );
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const slice = shown.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  useEffect(() => { setPage(0); }, [filter]);

  return (
    <section className="max-w-6xl mx-auto px-4 py-8 space-y-4 font-mono">
      {/* status bar */}
      <div className="rounded-xl border border-white/10 bg-[#11131a] px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-slate-300">Total Changes: <span className="text-white font-bold">{totals.all}</span></span>
        <span className="text-slate-300">Added: <span className="text-emerald-300 font-bold">{totals.added}</span></span>
        <span className="text-slate-300">Removed: <span className="text-red-300 font-bold">{totals.removed}</span></span>
        <span className="text-slate-300">Modified: <span className="text-amber-300 font-bold">{totals.modified}</span></span>
        <span className="ml-auto text-slate-300">Total Skins: <span className="text-white font-bold">{totals.skins}</span></span>
        <span className="text-slate-400">Last Check: <span className="text-slate-300">{stamp(totals.lastCheck)}</span></span>
        <span className="text-slate-400">Page {current + 1} of {pages}</span>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 text-xs">
        {([['all', 'All'], ['modified', 'Modified'], ['added', 'Added'], ['removed', 'Removed']] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
              filter === k
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            {label} <span className="opacity-60">{k === 'all' ? totals.all : totals[k as Kind]}</span>
          </button>
        ))}
      </div>

      {!log && !error && (
        <div className="flex items-center gap-2 text-slate-400 py-10 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading the changelog...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Could not load the changelog ({error}). It is generated by scripts/build-price-changelog.mjs.</span>
        </div>
      )}

      <div className="space-y-3">
        {slice.map((r) => <Card key={r.key} r={r} />)}
      </div>

      {log && shown.length === 0 && (
        <p className="text-sm text-slate-500 py-8">Nothing recorded under that filter.</p>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 text-sm">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 disabled:opacity-30 disabled:cursor-default hover:bg-white/10 cursor-pointer"
          >
            Prev
          </button>
          <span className="text-slate-500 px-2">{current + 1} / {pages}</span>
          <button
            type="button"
            disabled={current >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 disabled:opacity-30 disabled:cursor-default hover:bg-white/10 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-600 pt-2 leading-relaxed">
        Pending rows come from comparing the live sheet with the last committed snapshot; the rest are read
        from the snapshot's own history. A column added to the whole sheet at once is treated as a structural
        change, not a repricing.
      </p>
    </section>
  );
};
