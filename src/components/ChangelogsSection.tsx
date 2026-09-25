import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ScrollText, AlertTriangle, TrendingUp, TrendingDown, Plus, Minus, GitCommit, Radio } from 'lucide-react';
import { fetchChangelog, fetchPending, cleanSubject } from '../utils/changelog';
import type { Changelog, ChangelogEntry, PriceMove, PendingChanges } from '../utils/changelog';
import { formatValue } from '../utils/csv';

// Unlisted page at /changelogs: every edit to the Kirka Hub Valuation list, taken from this repo's
// own history of hub_prices.json. Deliberately not in the navbar — it is for people we hand the link to.

const RARITY_COLOUR: Record<string, string> = {
  mythical: 'text-red-300',
  legendary: 'text-gold-bright',
  epic: 'text-fuchsia-300',
  rare: 'text-sky-300',
  uncommon: 'text-emerald-300',
  common: 'text-slate-400',
};

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

const Move: React.FC<{ m: PriceMove }> = ({ m }) => {
  const up = (m.pct ?? 0) > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm py-1.5 border-b border-white/5 last:border-0">
      <span className={`font-bold ${RARITY_COLOUR[m.rarity.toLowerCase()] || 'text-slate-200'}`}>{m.name}</span>
      <span className="text-[10px] font-mono uppercase text-slate-500">{m.type}</span>
      <span className="ml-auto flex items-center gap-2 font-mono text-xs">
        <span className="text-slate-500 line-through">{m.from === null ? 'unpriced' : formatValue(m.from)}</span>
        <span className="text-slate-600">&rarr;</span>
        <span className="text-white font-bold">{m.to === null ? 'unpriced' : formatValue(m.to)}</span>
        {m.pct !== null && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold ${up ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
            <Icon className="w-3 h-3" />{up ? '+' : ''}{m.pct}%
          </span>
        )}
      </span>
    </div>
  );
};

const SkinList: React.FC<{ rows: { name: string; type: string; rarity: string; value: number | null }[]; label: string; tone: 'add' | 'remove' }> = ({ rows, label, tone }) => (
  <div className="mt-2">
    <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest mb-1 ${tone === 'add' ? 'text-emerald-400' : 'text-red-400'}`}>
      {tone === 'add' ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {label} ({rows.length})
    </div>
    <div className="flex flex-wrap gap-1.5">
      {rows.map((r) => (
        <span key={`${r.name}-${r.type}`} className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10">
          <span className={RARITY_COLOUR[r.rarity.toLowerCase()] || 'text-slate-200'}>{r.name}</span>
          <span className="text-slate-500 font-mono ml-1.5 text-[10px]">{r.type}</span>
          {r.value !== null && <span className="text-slate-400 font-mono ml-1.5 text-[10px]">{formatValue(r.value)}</span>}
        </span>
      ))}
    </div>
  </div>
);

const Entry: React.FC<{ e: ChangelogEntry }> = ({ e }) => {
  const [open, setOpen] = useState(false);
  const many = e.changed.length > 8;
  const shown = open ? e.changed : e.changed.slice(0, 8);
  const quiet = e.kind === 'update' && !e.changed.length && !e.added.length && !e.removed.length;

  return (
    <li className="relative">
      <span className="absolute -left-[23px] top-4 w-2 h-2 rounded-full bg-gold-primary/70 ring-4 ring-obsidian-deep" />
      <div className="rounded-xl border border-white/10 bg-obsidian-card/40 px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-mono font-bold text-gold-bright">{dateLabel(e.date)}</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
            <GitCommit className="w-3 h-3" />{e.commit}
          </span>
          {e.kind === 'baseline' && (
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
              first snapshot
            </span>
          )}
          <span className="ml-auto text-[10px] font-mono text-slate-600">{e.skinCount} skins priced</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-1">{cleanSubject(e.subject)}</p>

        {e.changed.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-gold-bright/70 mb-0.5">
              {e.changed.length} price {e.changed.length === 1 ? 'change' : 'changes'}
            </div>
            {shown.map((m) => <Move key={`${m.name}-${m.type}`} m={m} />)}
            {many && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="mt-1.5 text-xs text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer"
              >
                {open ? 'Show fewer' : `Show all ${e.changed.length}`}
              </button>
            )}
          </div>
        )}

        {e.added.length > 0 && <SkinList rows={e.added} label="added" tone="add" />}
        {e.removed.length > 0 && <SkinList rows={e.removed} label="removed" tone="remove" />}
        {quiet && <p className="text-xs text-slate-600 mt-1">No values moved — structural change only.</p>}
      </div>
    </li>
  );
};

/** One detected sheet edit, in the shape of the notification cards these are modelled on. */
const PendingCard: React.FC<{
  title: string; name: string; type: string; rarity: string;
  label: string; from: string | null; to: string | null; pct: number | null;
}> = ({ title, name, type, rarity, label, from, to, pct }) => (
  <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] px-4 py-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold text-white">{title}</span>
      <span className="text-[10px] font-mono uppercase text-slate-500">{type}</span>
      {pct !== null && (
        <span className={`ml-auto text-xs font-mono font-bold px-1.5 py-0.5 rounded ${pct > 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
          {pct > 0 ? '+' : ''}{pct}%
        </span>
      )}
    </div>
    <p className="text-xs text-slate-400 mt-1">
      A change has been detected for skin{' '}
      <span className={`font-bold ${RARITY_COLOUR[rarity.toLowerCase()] || 'text-slate-200'}`}>{name}</span>
    </p>
    <div className="mt-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-sm font-mono text-slate-200">
        {label}: <span className="text-slate-500">&quot;{from ?? '—'}&quot;</span>
        <span className="text-slate-600 mx-1.5">&rarr;</span>
        <span className="text-white font-bold">&quot;{to ?? '—'}&quot;</span>
      </div>
    </div>
  </div>
);

export const ChangelogsSection: React.FC = () => {
  const [log, setLog] = useState<Changelog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<PendingChanges | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchChangelog()
      .then((d) => { if (!cancelled) setLog(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the changelog'); });
    fetchPending().then((p) => { if (!cancelled) setLive(p); });
    return () => { cancelled = true; };
  }, []);

  const pending = live?.pending;

  const totals = useMemo(() => {
    const e = log?.entries ?? [];
    return {
      updates: e.filter((x) => x.kind === 'update').length,
      changes: e.reduce((a, x) => a + x.changed.length, 0),
      added: e.reduce((a, x) => a + x.added.length, 0),
      skins: e[0]?.skinCount ?? 0,
    };
  }, [log]);

  const years = useMemo(() => {
    const buckets = new Map<string, ChangelogEntry[]>();
    for (const e of log?.entries ?? []) {
      const y = String(new Date(e.date).getFullYear());
      (buckets.get(y) ?? buckets.set(y, []).get(y)!).push(e);
    }
    return [...buckets.entries()].sort((a, b) => Number(b[0]) - Number(a[0])).map(([year, rows]) => ({ year, rows }));
  }, [log]);

  return (
    <section className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2.5">
          <ScrollText className="w-6 h-6 text-gold-bright" />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Hub Valuation Changelog</h1>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          Every edit to the Kirka Hub Valuation list, with the exact figures before and after. Taken from the
          version history of the price database itself, so nothing here is written by hand.
        </p>
      </header>

      {log && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Updates', value: totals.updates },
            { label: 'Price changes', value: totals.changes },
            { label: 'Skins added', value: totals.added },
            { label: 'Skins priced', value: totals.skins },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-obsidian-card/40 px-3 py-2.5">
              <div className="text-xl font-black text-white tabular-nums">{s.value}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {pending && pending.total > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-black tracking-widest uppercase text-amber-300">
              Detected in the sheet · not yet in a snapshot
            </h2>
            <span className="text-[10px] font-mono text-slate-500">{pending.total} change{pending.total === 1 ? '' : 's'}</span>
          </div>
          {pending.changed.map((c) => (
            <PendingCard
              key={`c-${c.name}-${c.type}`}
              title={`Price Change Detected (${c.name})`}
              name={c.name} type={c.type} rarity={c.rarity} label="Hub Value"
              from={c.fromRaw} to={c.toRaw} pct={c.pct}
            />
          ))}
          {pending.added.map((a) => (
            <PendingCard
              key={`a-${a.name}-${a.type}`}
              title={`New Skin Detected (${a.name})`}
              name={a.name} type={a.type} rarity={a.rarity} label="Hub Value"
              from={null} to={a.raw} pct={null}
            />
          ))}
          {pending.removed.map((r) => (
            <PendingCard
              key={`r-${r.name}-${r.type}`}
              title={`Skin Removed (${r.name})`}
              name={r.name} type={r.type} rarity={r.rarity} label="Hub Value"
              from={r.raw} to={null} pct={null}
            />
          ))}
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Live comparison of the price sheet against the last committed snapshot, refreshed every minute.
            These become permanent entries below once the snapshot is updated.
          </p>
        </div>
      )}

      {live && live.sheetReachable && pending?.total === 0 && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          Sheet matches the last snapshot — {live.sheetCount} skins, nothing pending.
        </p>
      )}

      {!log && !error && (
        <div className="flex items-center gap-2 text-slate-400 py-10">
          <Loader2 className="w-4 h-4 animate-spin" />Loading the changelog...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Could not load the changelog ({error}). It is generated by scripts/build-price-changelog.mjs — run that and redeploy.</span>
        </div>
      )}

      {years.map(({ year, rows }) => (
        <div key={year} className="space-y-3">
          <div className="flex items-center gap-3 pt-2">
            <span className="text-lg font-black tracking-widest text-white">{year}</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{rows.length} entries</span>
            <div className="flex-grow h-px bg-white/5" />
          </div>
          <ol className="relative space-y-2.5 pl-5 border-l border-white/10">
            {rows.map((e) => <Entry key={e.commit} e={e} />)}
          </ol>
        </div>
      ))}

      {log && (
        <p className="text-[11px] text-slate-600 pt-4 border-t border-white/5 leading-relaxed">
          Generated from the commit history of the Hub Valuation database. Values are what the site prices
          against; percentages compare each commit with the one before it.
        </p>
      )}
    </section>
  );
};
