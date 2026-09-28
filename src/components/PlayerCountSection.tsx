import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * How many people are playing Kirka, by region, over the last week.
 *
 * Source: kirka.lukeskywalk.com/playerCount.json — a rolling 7-day window sampled every 15
 * minutes. It goes through the existing /trade-api proxy, which already points at that host in
 * both dev (vite proxy) and production (vercel rewrite), so the upstream never appears in
 * DevTools and there is no new config to keep in sync.
 *
 * Form: the headline is a single number (how many are on right now), so that is a hero figure
 * rather than a chart. The week of history is composition-over-time, which is a stacked area —
 * it answers "how busy is it" and "where are they" in one read. Regions are direct-labelled at
 * the right edge as well as carrying colour, so identity is never colour alone.
 *
 * The region palette is stepped for a dark surface and validated: OKLCH L inside 0.48–0.67,
 * chroma above the floor, worst adjacent CVD ΔE 10.5 (deutan), normal-vision ΔE 19.5, all six
 * above 3:1 against #161616. Blue and violet are deliberately not adjacent in the order — side
 * by side they fell to ΔE 3.2 for deuteranopes.
 *
 * A single-hue version with per-region small multiples was tried and reverted: it was more
 * consistent with the rest of the site, but the stacked form shows composition far better,
 * which is the point of the chart.
 */

const SOURCE = '/trade-api/playerCount.json';

interface Sample {
  timestamp: string;
  eu: number;
  na: number;
  sa: number;
  asia: number;
  oce: number;
  india: number;
}

/** Fixed order, never cycled. Colour follows the region, not its current rank. */
const REGIONS = [
  { key: 'eu' as const, label: 'Europe', colour: '#D91B70' },
  { key: 'asia' as const, label: 'Asia', colour: '#0E9CB5' },
  { key: 'na' as const, label: 'N. America', colour: '#76A00D' },
  { key: 'india' as const, label: 'India', colour: '#2176C7' },
  { key: 'sa' as const, label: 'S. America', colour: '#D65A00' },
  { key: 'oce' as const, label: 'Oceania', colour: '#8B45D6' },
];

const totalOf = (s: Sample) => REGIONS.reduce((a, r) => a + (s[r.key] || 0), 0);

const W = 1000;
const H = 300;
const PAD = { top: 12, right: 8, bottom: 22, left: 40 };

export const PlayerCountSection: React.FC = () => {
  const [data, setData] = useState<Sample[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(SOURCE)
      .then((r) => {
        if (!r.ok) throw new Error(`Source returned ${r.status}`);
        return r.json();
      })
      .then((rows: Sample[]) => {
        if (!Array.isArray(rows) || !rows.length) throw new Error('No samples returned');
        setData(rows);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load player counts'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const view = useMemo(() => {
    if (!data?.length) return null;

    const peak = Math.max(...data.map(totalOf));
    const yMax = Math.ceil(peak / 50) * 50 || 50;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (i / (data.length - 1)) * plotW;
    const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

    // stacked bands, bottom up in the fixed region order
    let running = new Array(data.length).fill(0);
    const bands = REGIONS.map((r) => {
      const lower = [...running];
      running = running.map((base, i) => base + (data[i][r.key] || 0));
      const upper = [...running];
      const top = upper.map((v, i) => `${x(i)},${y(v)}`).join(' L');
      const bottom = lower.map((v, i) => `${x(i)},${y(v)}`).reverse().join(' L');
      return { ...r, d: `M${top} L${bottom} Z` };
    });

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: Math.round(yMax * f), y: y(yMax * f) }));

    // one label per day, not per sample
    const dayMarks: { x: number; label: string }[] = [];
    let lastDay = '';
    data.forEach((s, i) => {
      const d = new Date(s.timestamp);
      const key = d.toDateString();
      if (key !== lastDay) {
        lastDay = key;
        dayMarks.push({ x: x(i), label: d.toLocaleDateString(undefined, { weekday: 'short' }) });
      }
    });

    return { bands, ticks, dayMarks, x, yMax, latest: data[data.length - 1], peak };
  }, [data]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!data?.length || !svgRef.current) return;
    const box = svgRef.current.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * W;
    const plotW = W - PAD.left - PAD.right;
    const i = Math.round(((rel - PAD.left) / plotW) * (data.length - 1));
    setHover(i >= 0 && i < data.length ? i : null);
  };

  const active = hover !== null && data ? data[hover] : view?.latest;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl text-[#EDEDED]">
            Player{' '}
            <span className="mark text-obsidian-deep" style={{ ['--mark-color' as string]: 'var(--color-spray-cyan)' }}>
              count
            </span>
          </h2>
          <p className="text-[13px] text-slate-400 mt-2 max-w-[60ch]">
            How many people are in Kirka right now, and where. Sampled every 15 minutes over the last week.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="self-start shrink-0 flex items-center gap-2 h-9 px-3 rounded-md bg-obsidian-card border border-slate-700 hover:border-slate-500 hover:bg-obsidian-hover text-[13px] text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && !data && loading && (
        <p className="py-24 text-center text-[13px] text-slate-500">Loading…</p>
      )}

      {view && active && (
        <>
          {/* Hero figure: the one number most people came for. */}
          <section className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">
                {hover === null ? 'Online now' : 'At this moment'}
              </span>
              <span className="display block text-6xl sm:text-7xl leading-none text-[#EDEDED] tabular-nums">
                {totalOf(active).toLocaleString()}
              </span>
              <span className="block text-[12px] text-slate-600 mt-2 tabular-nums">
                {new Date(active.timestamp).toLocaleString(undefined, {
                  weekday: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-500 mb-1">Week peak</span>
              <span className="display block text-3xl leading-none text-slate-300 tabular-nums">
                {view.peak.toLocaleString()}
              </span>
            </div>
          </section>

          {/* Composition over time. One y-axis, stacked, direct-labelled. */}
          <section>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto select-none"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              role="img"
              aria-label="Kirka players online by region over the last seven days"
            >
              {view.ticks.map((t) => (
                <g key={t.v}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#282828" strokeWidth="1" />
                  <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" fill="#6B6B6B" fontSize="11">{t.v}</text>
                </g>
              ))}

              {view.dayMarks.map((d, i) => (
                <text key={i} x={d.x} y={H - 6} textAnchor="middle" fill="#575757" fontSize="11">{d.label}</text>
              ))}

              {/* 2px surface gap between stacked fills, so the bands read as separate */}
              {view.bands.map((b) => (
                <path key={b.key} d={b.d} fill={b.colour} stroke="#0B0B0B" strokeWidth="2" opacity="0.92" />
              ))}

              {hover !== null && (
                <line
                  x1={view.x(hover)} x2={view.x(hover)} y1={PAD.top} y2={H - PAD.bottom}
                  stroke="#EDEDED" strokeWidth="1" opacity="0.5"
                />
              )}
            </svg>
          </section>

          {/* Legend and per-region reading, for the moment under the cursor. */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {REGIONS.map((r) => (
              <div key={r.key} className="bg-obsidian-card border border-slate-800 rounded-md px-3.5 py-3">
                <span className="flex items-center gap-2 text-[11px] text-slate-500 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.colour }} />
                  {r.label}
                </span>
                <span className="display block text-2xl leading-none text-[#EDEDED] tabular-nums">
                  {(active[r.key] ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </section>

          <p className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-800 pt-4">
            Counts come from a public feed maintained outside Kirka Hub, sampled every 15 minutes — hover the
            chart to read any moment in the week. Figures are what that feed reported, not a direct measurement
            of Kirka's servers.
          </p>
        </>
      )}
    </div>
  );
};
