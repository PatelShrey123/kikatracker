import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Repeat, RefreshCw, Search, FileText, ArrowRight } from 'lucide-react';
import type { MarketItem } from '../utils/csv';
import { formatValue } from '../utils/csv';
import { getSkinRenderUrl } from '../utils/skinAssets';
import { isVip } from '../utils/vip';

interface TradesSectionProps {
  onSelectPlayer: (id: string, isShortId: boolean) => void;
  marketPrices: Map<string, MarketItem>;
  allItemData: any[];
  fallbackRenders: Record<string, any>;
  onInspectItem: (name: string, type?: string) => void;
}

interface OpenTradeItem {
  i: string; // name
  r: string; // rarity code
  q: string; // quantity
}

interface OpenTrade {
  tradeId: number;
  userAndTag: string;
  offered: OpenTradeItem[];
  wanted: OpenTradeItem[];
  updatedAt: string;
}

// Safe cap on total trades kept in memory to prevent browser memory exhaustion / tab crash
const SAFE_TRADES_CAP = 30000;
const BATCH_SIZE = 8;

/**
 * Day files already fetched, kept for the life of the page.
 *
 * These are static archives - a file dated in the past never changes - so re-fetching them
 * was pure waste. Only dailyTrades.json is dynamic (updates every 15 min), so it is excluded from cache.
 *
 * Capped so browsing cannot grow without bound; oldest entries are dropped first.
 */
const dayCache = new Map<string, unknown[]>();
const DAY_CACHE_MAX = 200;

function cacheDay(file: string, rows: unknown[]) {
  if (file === 'dailyTrades.json') return;
  if (dayCache.size >= DAY_CACHE_MAX) {
    const oldest = dayCache.keys().next().value;
    if (oldest !== undefined) dayCache.delete(oldest);
  }
  dayCache.set(file, rows);
}

/** One trade-history file, with retries. The host's 502s come in short bursts, so back off between tries.
 *  Past days are cached; dailyTrades.json changes every 15 minutes, so it never is. */
async function fetchDayFile(file: string, signal: AbortSignal): Promise<any[] | null> {
  if (file !== 'dailyTrades.json') {
    const hit = dayCache.get(file);
    if (hit) return hit as any[];
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`/trade-api/tradehistory/${file}`, { signal });
      if (!res.ok) throw new Error(String(res.status));
      const rows = await res.json();
      if (Array.isArray(rows)) {
        if (file !== 'dailyTrades.json') cacheDay(file, rows);
        return rows;
      }
      return null;
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  return null;
}

/** Kirka reuses trade IDs (they stay under 100,000 and wrap), so an ID alone is not a trade: in October
 *  2026 alone 396 IDs belonged to two different trades. A trade is its ID, completion time and players. */
const tradeKey = (t: { tradeId: number; updatedAt: string; offerer: string; accepter: string }) =>
  `${t.tradeId}|${t.updatedAt}|${t.offerer}|${t.accepter}`;

interface HistoryTradeItem {
  name: string;
  rarity: string;
  quantity: string | number;
  value: number;
  percent?: number;
}

interface HistoryTrade {
  tradeId: number;
  offerer: string;
  accepter: string;
  updatedAt: string;
  trade: {
    ratio?: number;
    ratioDif?: number;
    offered: {
      total: number;
      items: HistoryTradeItem[];
    };
    wanted: {
      total: number;
      items: HistoryTradeItem[];
    };
  };
  /** updatedAt parsed once at collection time, so sorting never re-parses date strings. */
  _ts?: number;
}

// Check if a trade side consists exclusively of a single 1x Wood item (friendly transfer / gift)
function isPureOneWoodOpenSide(items: OpenTradeItem[]): boolean {
  if (!items || items.length !== 1) return false;
  const item = items[0];
  const name = (item.i || '').trim().toLowerCase();
  const qty = parseInt(String(item.q || '1'), 10);
  return name === 'wood' && qty === 1;
}

function isPureOneWoodHistorySide(items: HistoryTradeItem[]): boolean {
  if (!items || items.length !== 1) return false;
  const item = items[0];
  const name = (item.name || '').trim().toLowerCase();
  const qty = parseInt(String(item.quantity || '1'), 10);
  return name === 'wood' && qty === 1;
}

function formatTradeDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

export const TradesSection: React.FC<TradesSectionProps> = ({
  onSelectPlayer,
  marketPrices,
  allItemData,
  fallbackRenders,
  onInspectItem
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'history'>('live');
  
  // Data States
  const [liveTrades, setLiveTrades] = useState<OpenTrade[]>([]);
  const [historyTrades, setHistoryTrades] = useState<HistoryTrade[]>([]);

  // Loading / UI States (separate live vs history so live loads in <150ms without waiting for history)
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  // Trade History archive browsing: all-time history loaded newest first.
  const [snapshotIndex, setSnapshotIndex] = useState<string[]>([]);
  const [historyProgress, setHistoryProgress] = useState<{ done: number; total: number; failed: number; capped: boolean } | null>(null);
  // identifies the in-flight history load, so a superseded one cannot write stale results
  const historyRunRef = useRef(0);
  // Where the main stream stopped when it hit the memory cap, and the trades it already holds, so a
  // search can carry on through the older files without loading them all into memory.
  const streamedRef = useRef<{ seen: Set<string>; next: number } | null>(null);
  const [deepMatches, setDeepMatches] = useState<HistoryTrade[]>([]);
  const [deepProgress, setDeepProgress] = useState<{ done: number; total: number; found: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [ignoreEscrow, setIgnoreEscrow] = useState(true);
  const [ignoreWoodTrades, setIgnoreWoodTrades] = useState(true);
  const [visibleLiveCount, setVisibleLiveCount] = useState(40);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(40);

  // Advanced Search States
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [offeredQuery, setOfferedQuery] = useState('');
  const [wantedQuery, setWantedQuery] = useState('');
  const [appliedOffered, setAppliedOffered] = useState('');
  const [appliedWanted, setAppliedWanted] = useState('');

  // Reset pagination on filter or tab change
  useEffect(() => {
    setVisibleLiveCount(40);
    setVisibleHistoryCount(40);
  }, [searchQuery, appliedOffered, appliedWanted, ignoreEscrow, ignoreWoodTrades, activeSubTab]);

  // 1. Fetch open live trades immediately on mount (fast single request, zero lag)
  useEffect(() => {
    let cancelled = false;
    setLoadingLive(true);
    fetch('/trade-api/trades.json')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          // Sort live trades chronologically descending (latest first)
          data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          setLiveTrades(data);
        }
      })
      .catch((err) => console.error('Failed to fetch open trades:', err))
      .finally(() => {
        if (!cancelled) setLoadingLive(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Fetch the snapshot index on-demand when the user opens Trade History.
  //    ALWAYS include 'dailyTrades.json' at the very beginning (refreshed every 15m with today's live trades),
  //    followed by all snapshot archive files sorted in reverse chronological order (newest first).
  useEffect(() => {
    if (activeSubTab !== 'history' || historyLoaded) return;
    let cancelled = false;
    setLoadingHistory(true);

    // The trade host intermittently answers 502. Without a retry here a single bad response left
    // Trade History empty until the page was reloaded, since nothing asked for the index again.
    const fetchIndex = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch('/trade-api/tradehistory/snapshots.json');
          if (res.ok) return await res.json();
        } catch { /* retry below */ }
        if (cancelled) return null;
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
      throw new Error('trade index unavailable after 4 attempts');
    };

    fetchIndex()
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const snapFiles = data
          .filter((s) => typeof s === 'string' && /^\d{8}_\d+\.json$/.test(s))
          .sort()
          .reverse();

        // Place dailyTrades.json at the front so today's live completed trades load first!
        const files = ['dailyTrades.json', ...snapFiles];
        setSnapshotIndex(files);
        setHistoryLoaded(true);
      })
      .catch((err) => console.error('Failed to load snapshots index:', err))
      .finally(() => { if (!cancelled) setLoadingHistory(false); });

    return () => { cancelled = true; };
  }, [activeSubTab, historyLoaded]);

  // 3. Load all-time trade history, newest first.
  //    Streams archives progressively in batches so the page renders in <1s and never crashes or freezes.
  useEffect(() => {
    if (!snapshotIndex.length) return;

    const runId = ++historyRunRef.current;
    const controller = new AbortController();
    const isStale = () => runId !== historyRunRef.current;

    const files = snapshotIndex;

    setHistoryTrades([]);
    streamedRef.current = null;
    setVisibleHistoryCount(40);
    setHistoryProgress({ done: 0, total: files.length, failed: 0, capped: false });

    if (!files.length) {
      setLoadingHistory(false);
      setHistoryProgress(null);
      return;
    }
    setLoadingHistory(true);

    const seen = new Set<string>();
    const collected: HistoryTrade[] = [];
    let done = 0;
    let failed = 0;
    let capped = false;

    const loadFile = (file: string) => fetchDayFile(file, controller.signal);

    const BATCH = BATCH_SIZE;
    const tsOf = (t: HistoryTrade) => t._ts ?? 0;
    const PUBLISH_MS = 500;
    let lastPublish = 0;

    const publish = () => {
      collected.sort((a, b) => tsOf(b) - tsOf(a));
      setHistoryTrades([...collected]);
      lastPublish = performance.now();
    };

    (async () => {
      try {
        for (let i = 0; i < files.length; i += BATCH) {
          if (isStale()) return;
          const batch = files.slice(i, i + BATCH);
          const results = await Promise.all(batch.map(loadFile));
          if (isStale()) return;

          for (const rows of results) {
            if (rows === null) { failed++; continue; }
            for (const t of rows) {
              if (!t || !t.tradeId) continue;
              // the same trade repeats across overlapping day files
              const key = tradeKey(t);
              if (seen.has(key)) continue;
              seen.add(key);
              t._ts = Date.parse(t.updatedAt);
              collected.push(t);
            }
          }
          done += batch.length;

          // Crash prevention: stop auto-streaming once safe trade cap is reached.
          // This keeps memory low on mobile devices and prevents tab freeze.
          if (collected.length >= SAFE_TRADES_CAP) {
            capped = true;
          }

          setHistoryProgress({ done, total: files.length, failed, capped });
          if (capped || performance.now() - lastPublish > PUBLISH_MS) publish();
          if (capped) { streamedRef.current = { seen, next: i + BATCH }; break; }

          // Yield to browser event loop between batches so UI stays silky smooth
          await new Promise((r) => setTimeout(r, 60));
        }
      } finally {
        if (!isStale()) {
          publish();
          setLoadingHistory(false);
          setHistoryProgress(failed || capped ? { done, total: files.length, failed, capped } : null);
        }
      }
    })();

    return () => { controller.abort(); };
  }, [snapshotIndex]);

  // 4. Search past the cap. The page holds the newest SAFE_TRADES_CAP trades; a search should still find
  //    an older trade, so it streams the remaining day files and keeps only the trades that match.
  const [deepQuery, setDeepQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDeepQuery([searchQuery, appliedOffered, appliedWanted].map((q) => q.trim().toLowerCase()).join('\u0000')), 450);
    return () => clearTimeout(id);
  }, [searchQuery, appliedOffered, appliedWanted]);

  useEffect(() => {
    setDeepMatches([]);
    setDeepProgress(null);
    const [q, off, want] = deepQuery.split('\u0000');
    const streamed = streamedRef.current;
    if (activeSubTab !== 'history' || loadingHistory || !streamed || !(q || off || want)) return;

    const files = snapshotIndex.slice(streamed.next);
    if (!files.length) return;
    const controller = new AbortController();
    const names = (items?: HistoryTradeItem[]) => (items || []).map((i) => i.name.toLowerCase());
    const matches = (t: HistoryTrade) => {
      const offered = names(t.trade?.offered?.items), wanted = names(t.trade?.wanted?.items);
      if (q && !(t.offerer.toLowerCase().includes(q) || t.accepter.toLowerCase().includes(q) || String(t.tradeId).includes(q) ||
        offered.some((n) => n.includes(q)) || wanted.some((n) => n.includes(q)))) return false;
      if (off && !offered.some((n) => n.includes(off))) return false;
      if (want && !wanted.some((n) => n.includes(want))) return false;
      return true;
    };

    (async () => {
      const found: HistoryTrade[] = [];
      const local = new Set<string>();
      let done = 0;
      setDeepProgress({ done, total: files.length, found: 0 });
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const results = await Promise.all(files.slice(i, i + BATCH_SIZE).map((f) => fetchDayFile(f, controller.signal)));
        if (controller.signal.aborted) return;
        for (const rows of results) {
          for (const t of rows || []) {
            if (!t || !t.tradeId || !matches(t)) continue;
            const key = tradeKey(t);
            if (streamed.seen.has(key) || local.has(key)) continue;
            local.add(key);
            t._ts = Date.parse(t.updatedAt);
            found.push(t);
          }
        }
        done += results.length;
        setDeepProgress({ done, total: files.length, found: found.length });
        setDeepMatches([...found]);
        await new Promise((r) => setTimeout(r, 30));
      }
      if (!controller.signal.aborted) setDeepProgress(null);
    })();

    return () => controller.abort();
  }, [deepQuery, activeSubTab, loadingHistory, snapshotIndex]);

  // Helper to map rarity codes (M, L, E, R, C) to full name & border styles
  const getRarityDetails = (code: string) => {
    const raw = (code || '').toUpperCase();
    if (raw === 'M' || raw === 'MYTHIC' || raw === 'MYTHICAL') {
      return { label: 'M', name: 'MYTHICAL', color: 'text-rarity-mythic', border: 'border-rarity-mythic/40 hover:border-rarity-mythic bg-rarity-mythic/5' };
    }
    if (raw === 'L' || raw === 'LEGENDARY') {
      return { label: 'L', name: 'LEGENDARY', color: 'text-rarity-legendary', border: 'border-rarity-legendary/40 hover:border-rarity-legendary bg-rarity-legendary/5' };
    }
    if (raw === 'E' || raw === 'EPIC') {
      return { label: 'E', name: 'EPIC', color: 'text-rarity-epic', border: 'border-rarity-epic/40 hover:border-rarity-epic bg-rarity-epic/5' };
    }
    if (raw === 'R' || raw === 'RARE') {
      return { label: 'R', name: 'RARE', color: 'text-rarity-rare', border: 'border-rarity-rare/40 hover:border-rarity-rare bg-rarity-rare/5' };
    }
    return { label: 'C', name: 'COMMON', color: 'text-slate-400', border: 'border-slate-500/20 hover:border-slate-500 bg-slate-500/5' };
  };

  // Precompute O(1) indexed lookup map for allItemData to eliminate 2,000,000 array scans per render
  const itemDataMap = useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(allItemData)) {
      for (let i = 0; i < allItemData.length; i++) {
        const item = allItemData[i];
        if (item && item.name) {
          const clean = item.name.replace(/^_+|_+$/g, '').trim().toLowerCase();
          if (!map.has(clean)) {
            map.set(clean, item);
          }
        }
      }
    }
    return map;
  }, [allItemData]);

  // Fast O(1) memoized caches for renders and prices
  const renderCache = useMemo(() => new Map<string, string | null>(), [fallbackRenders, itemDataMap]);
  const priceCache = useMemo(() => new Map<string, number>(), [marketPrices, itemDataMap]);

  // Resolve skin image render URL with automatic api2 fallback (instant O(1))
  const getItemRenderUrl = (name: string): string | null => {
    const nameKey = name.replace(/^_+|_+$/g, '').trim().toLowerCase();
    if (renderCache.has(nameKey)) {
      return renderCache.get(nameKey)!;
    }
    const fallback = fallbackRenders[nameKey];
    const matched = itemDataMap.get(nameKey);
    const candidate = fallback?.renderurl || matched?.renderUrl || null;
    const url = getSkinRenderUrl({
      name,
      parent: matched?.parent,
      type: matched?.type,
      renderUrl: candidate,
    });
    renderCache.set(nameKey, url);
    return url;
  };

  // Resolve skin price from Hub price index (instant O(1))
  const getItemPrice = (name: string): number => {
    const nameKey = name.replace(/^_+|_+$/g, '').trim().toLowerCase();
    if (priceCache.has(nameKey)) {
      return priceCache.get(nameKey)!;
    }
    const matchedMeta = itemDataMap.get(nameKey);
    const typeKey = matchedMeta
      ? (matchedMeta.type === 'BODY_SKIN' ? 'character' : (matchedMeta.parent?.name || ''))
      : '';

    const matched = marketPrices.get(`${nameKey}_${typeKey.toLowerCase()}`) || marketPrices.get(nameKey);
    let val = 0;
    if (matched && matched.baseValue > 0) {
      val = matched.baseValue;
    } else if (matchedMeta && matchedMeta.salePrice) {
      val = matchedMeta.salePrice;
    }
    priceCache.set(nameKey, val);
    return val;
  };

  interface PreparedItem {
    name: string;
    quantity: number;
    rarity: string;
    rar: { label: string; name: string; color: string; border: string };
    render: string | null;
    price: number;
  }

  // Calculate profit margin gives vs gets details (fast loop without re-fetching prices)
  const getProfitMargin = (givesItems: PreparedItem[], getsItems: PreparedItem[]) => {
    let totalGives = 0;
    let totalGets = 0;
    let hasGivesPrice = false;
    let hasGetsPrice = false;

    for (let i = 0; i < givesItems.length; i++) {
      const item = givesItems[i];
      if (item.price > 0) hasGivesPrice = true;
      totalGives += item.price * item.quantity;
    }

    for (let i = 0; i < getsItems.length; i++) {
      const item = getsItems[i];
      if (item.price > 0) hasGetsPrice = true;
      totalGets += item.price * item.quantity;
    }

    if (totalGives === 0 && totalGets === 0) {
      return { diff: 0, pct: 0, status: 'no_price', label: 'no price' };
    }
    if (!hasGivesPrice || !hasGetsPrice) {
      return { diff: 0, pct: 0, status: 'no_price', label: 'no price' };
    }

    const diff = totalGets - totalGives;
    const pct = totalGives > 0 ? (diff / totalGives) * 100 : 0;
    const sign = diff > 0 ? '+' : '';

    return {
      diff,
      pct,
      status: diff > 0 ? 'profit' : diff < 0 ? 'loss' : 'fair',
      label: `${sign}${formatValue(diff)} (${sign}${pct.toFixed(1)}%)`
    };
  };

  // Helper to parse username strings safely (clickable searches)
  const parseUsernameClick = (userString: string) => {
    const parts = userString.split('#');
    if (parts.length === 2) {
      onSelectPlayer(parts[1], true);
    } else {
      onSelectPlayer(userString, false);
    }
  };

  const prepareLiveItem = (i: { i: string; q: string; r: string }): PreparedItem => {
    const name = i.i;
    return {
      name,
      quantity: parseInt(i.q, 10) || 1,
      rarity: i.r,
      rar: getRarityDetails(i.r),
      render: getItemRenderUrl(name),
      price: getItemPrice(name),
    };
  };

  const prepareHistoryItem = (i: HistoryTradeItem): PreparedItem => {
    const name = i.name;
    const quantity = typeof i.quantity === 'string' ? parseInt(i.quantity, 10) || 1 : (i.quantity || 1);
    return {
      name,
      quantity,
      rarity: i.rarity,
      rar: getRarityDetails(i.rarity),
      render: getItemRenderUrl(name),
      price: getItemPrice(name),
    };
  };

  // Render open live trade card
  const renderOpenTradeCard = (trade: OpenTrade, index: number) => {
    const givesItems = trade.offered.map(prepareLiveItem);
    const getsItems = trade.wanted.map(prepareLiveItem);
    const margin = getProfitMargin(givesItems, getsItems);

    return (
      <div 
        key={trade.tradeId + '-' + index}
        className="bg-obsidian-card border border-obsidian-border/80 rounded-md p-5 hover:border-gold-primary/20 transition-all duration-300 relative shadow-sm hover:shadow-[0_4px_25px_rgba(0,0,0,0.3)] flex flex-col space-y-4"
      >
        {/* Card Header info */}
        <div className="flex items-center justify-between border-b border-obsidian-border/50 pb-3 text-xs">
          <div className="flex items-center space-x-2 font-mono">
            <span className="text-gold-primary font-bold">#{trade.tradeId}</span>
            <span className="text-slate-600">|</span>
            {(() => {
              const tag = trade.userAndTag || '';
              const shortIdCandidate = tag.includes('#') ? tag.split('#').pop() : tag;
              const isTraderVip = isVip(shortIdCandidate) || isVip(tag);
              return (
                <button
                  onClick={() => parseUsernameClick(trade.userAndTag)}
                  className={`font-black uppercase tracking-wider transition-colors hover:underline cursor-pointer flex items-center space-x-1 ${
                    isTraderVip ? 'text-purple-black-wave' : 'text-white hover:text-gold-bright'
                  }`}
                >
                  <span>{trade.userAndTag}</span>
                  {isTraderVip && <span className="text-[10px] text-purple-300">⚡</span>}
                </button>
              );
            })()}
          </div>
          <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap" title={new Date(trade.updatedAt).toLocaleString()}>
            {formatTradeDateTime(trade.updatedAt)}
          </span>
        </div>

        {/* Card Body */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4 relative">
          
          {/* GIVES side */}
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-black font-mono tracking-widest text-[#ef4444] uppercase block mb-1">Gives</span>
            <div className="space-y-2">
              {givesItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onInspectItem(item.name)}
                  className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${item.rar.border}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-obsidian-deep/50 border border-slate-800 rounded-md flex items-center justify-center p-1.5 flex-shrink-0">
                      {item.render ? (
                        <img src={item.render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                      ) : (
                        <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                      <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                        <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${item.rar.color}`}>{item.rar.name}</span>
                        <span className="text-[9px] font-mono font-bold text-gold-bright">
                          {item.price > 0 ? formatValue(item.price) : 'no price'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Middle Margin */}
          <div className="flex flex-col items-center justify-center py-4 lg:py-0 px-2 flex-shrink-0 min-w-[120px]">
            <div className="text-center font-mono">
              <span className="text-[8px] text-slate-500 uppercase tracking-widest block mb-1">Margin</span>
              {margin.status === 'no_price' ? (
                <div className="bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  no price
                </div>
              ) : margin.status === 'profit' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center space-x-1">
                  <span>{margin.label}</span>
                </div>
              ) : margin.status === 'loss' ? (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center space-x-1">
                  <span>{margin.label}</span>
                </div>
              ) : (
                <div className="bg-slate-500/15 border border-slate-500/30 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full">
                  Fair Trade
                </div>
              )}
            </div>
            <div className="hidden lg:flex items-center justify-center text-slate-600 mt-2">
              <ArrowRight className="w-5 h-5 animate-pulse" />
            </div>
          </div>

          {/* GETS side */}
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-black font-mono tracking-widest text-emerald-400 uppercase block mb-1 text-right">Gets</span>
            <div className="space-y-2">
              {getsItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onInspectItem(item.name)}
                  className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${item.rar.border}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-obsidian-deep/50 border border-slate-800 rounded-md flex items-center justify-center p-1.5 flex-shrink-0">
                      {item.render ? (
                        <img src={item.render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                      ) : (
                        <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                      <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                        <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${item.rar.color}`}>{item.rar.name}</span>
                        <span className="text-[9px] font-mono font-bold text-gold-bright">
                          {item.price > 0 ? formatValue(item.price) : 'no price'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // Render closed history trade card
  const renderHistoryTradeCard = (trade: HistoryTrade, index: number) => {
    const givesItems = (trade.trade?.offered?.items || []).map(prepareHistoryItem);
    const getsItems = (trade.trade?.wanted?.items || []).map(prepareHistoryItem);
    const margin = getProfitMargin(givesItems, getsItems);

    return (
      <div 
        key={trade.tradeId + '-' + index}
        className="bg-obsidian-card border border-obsidian-border/80 rounded-md p-5 hover:border-gold-primary/20 transition-all duration-300 relative shadow-sm hover:shadow-[0_4px_25px_rgba(0,0,0,0.3)] flex flex-col space-y-4"
      >
        {/* Card Header info */}
        <div className="flex items-center justify-between border-b border-obsidian-border/50 pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 font-mono">
            <span className="text-gold-primary font-bold">#{trade.tradeId}</span>
            <span className="text-slate-600">|</span>
            {(() => {
              const tag1 = trade.offerer || '';
              const id1 = tag1.includes('#') ? tag1.split('#').pop() : tag1;
              const vip1 = isVip(id1) || isVip(tag1);
              return (
                <button
                  onClick={() => parseUsernameClick(trade.offerer)}
                  className={`font-black uppercase tracking-wider transition-colors hover:underline cursor-pointer flex items-center space-x-0.5 ${
                    vip1 ? 'text-purple-black-wave' : 'text-white hover:text-gold-bright'
                  }`}
                >
                  <span>{trade.offerer}</span>
                  {vip1 && <span className="text-[10px] text-purple-300">⚡</span>}
                </button>
              );
            })()}
            <span className="text-slate-500 font-bold">🤝 Swap 🤝</span>
            {(() => {
              const tag2 = trade.accepter || '';
              const id2 = tag2.includes('#') ? tag2.split('#').pop() : tag2;
              const vip2 = isVip(id2) || isVip(tag2);
              return (
                <button
                  onClick={() => parseUsernameClick(trade.accepter)}
                  className={`font-black uppercase tracking-wider transition-colors hover:underline cursor-pointer flex items-center space-x-0.5 ${
                    vip2 ? 'text-purple-black-wave' : 'text-white hover:text-gold-bright'
                  }`}
                >
                  <span>{trade.accepter}</span>
                  {vip2 && <span className="text-[10px] text-purple-300">⚡</span>}
                </button>
              );
            })()}
          </div>
          <span className="text-slate-500 font-mono text-[11px] whitespace-nowrap" title={new Date(trade.updatedAt).toLocaleString()}>
            {formatTradeDateTime(trade.updatedAt)}
          </span>
        </div>

        {/* Card Body */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4 relative">
          
          {/* GIVES side */}
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-black font-mono tracking-widest text-[#ef4444] uppercase block mb-1">Gives</span>
            <div className="space-y-2">
              {givesItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onInspectItem(item.name)}
                  className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${item.rar.border}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-obsidian-deep/50 border border-slate-800 rounded-md flex items-center justify-center p-1.5 flex-shrink-0">
                      {item.render ? (
                        <img src={item.render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                      ) : (
                        <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                      <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                        <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${item.rar.color}`}>{item.rar.name}</span>
                        <span className="text-[9px] font-mono font-bold text-gold-bright">
                          {item.price > 0 ? formatValue(item.price) : 'no price'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Middle Margin */}
          <div className="flex flex-col items-center justify-center py-4 lg:py-0 px-2 flex-shrink-0 min-w-[120px]">
            <div className="text-center font-mono">
              <span className="text-[8px] text-slate-500 uppercase tracking-widest block mb-1">Margin</span>
              {margin.status === 'no_price' ? (
                <div className="bg-slate-500/10 border border-slate-500/30 text-slate-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  no price
                </div>
              ) : margin.status === 'profit' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center space-x-1">
                  <span>{margin.label}</span>
                </div>
              ) : margin.status === 'loss' ? (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center space-x-1">
                  <span>{margin.label}</span>
                </div>
              ) : (
                <div className="bg-slate-500/15 border border-slate-500/30 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full">
                  Fair Trade
                </div>
              )}
            </div>
            <div className="hidden lg:flex items-center justify-center text-slate-600 mt-2">
              <ArrowRight className="w-5 h-5 animate-pulse" />
            </div>
          </div>

          {/* GETS side */}
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-black font-mono tracking-widest text-emerald-400 uppercase block mb-1 text-right">Gets</span>
            <div className="space-y-2">
              {getsItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onInspectItem(item.name)}
                  className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${item.rar.border}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-obsidian-deep/50 border border-slate-800 rounded-md flex items-center justify-center p-1.5 flex-shrink-0">
                      {item.render ? (
                        <img src={item.render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                      ) : (
                        <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                      <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                        <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${item.rar.color}`}>{item.rar.name}</span>
                        <span className="text-[9px] font-mono font-bold text-gold-bright">
                          {item.price > 0 ? formatValue(item.price) : 'no price'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // Memoized filtered live trades
  const activeFilteredLive = useMemo(() => {
    let result = liveTrades;
    if (ignoreEscrow) {
      result = result.filter((t) => t.userAndTag.toUpperCase() !== 'PWNSTAR#ESCROW');
    }
    if (ignoreWoodTrades) {
      result = result.filter(
        (t) => !isPureOneWoodOpenSide(t.offered) && !isPureOneWoodOpenSide(t.wanted)
      );
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.userAndTag.toLowerCase().includes(query) ||
          t.tradeId.toString().includes(query) ||
          t.offered.some((i) => i.i.toLowerCase().includes(query)) ||
          t.wanted.some((i) => i.i.toLowerCase().includes(query))
      );
    }
    const offQuery = appliedOffered.trim().toLowerCase();
    if (offQuery) {
      result = result.filter((t) =>
        t.offered.some((item) => item.i.toLowerCase().includes(offQuery))
      );
    }
    const wantQuery = appliedWanted.trim().toLowerCase();
    if (wantQuery) {
      result = result.filter((t) =>
        t.wanted.some((item) => item.i.toLowerCase().includes(wantQuery))
      );
    }
    return result;
  }, [liveTrades, ignoreEscrow, ignoreWoodTrades, searchQuery, appliedOffered, appliedWanted]);

  // Memoized filtered history trades
  const activeFilteredHistory = useMemo(() => {
    // trades found past the memory cap by a search are older than everything loaded, so they go last
    let result = deepMatches.length ? historyTrades.concat(deepMatches) : historyTrades;
    if (ignoreEscrow) {
      result = result.filter(
        (t) =>
          t.offerer.toUpperCase() !== 'PWNSTAR#ESCROW' &&
          t.accepter.toUpperCase() !== 'PWNSTAR#ESCROW'
      );
    }
    if (ignoreWoodTrades) {
      result = result.filter(
        (t) =>
          !isPureOneWoodHistorySide(t.trade?.offered?.items || []) &&
          !isPureOneWoodHistorySide(t.trade?.wanted?.items || [])
      );
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (t) =>
          t.offerer.toLowerCase().includes(query) ||
          t.accepter.toLowerCase().includes(query) ||
          t.tradeId.toString().includes(query) ||
          (t.trade?.offered?.items || []).some((i) => i.name.toLowerCase().includes(query)) ||
          (t.trade?.wanted?.items || []).some((i) => i.name.toLowerCase().includes(query))
      );
    }
    const offQuery = appliedOffered.trim().toLowerCase();
    if (offQuery) {
      result = result.filter((t) =>
        (t.trade?.offered?.items || []).some((item) => item.name.toLowerCase().includes(offQuery))
      );
    }
    const wantQuery = appliedWanted.trim().toLowerCase();
    if (wantQuery) {
      result = result.filter((t) =>
        (t.trade?.wanted?.items || []).some((item) => item.name.toLowerCase().includes(wantQuery))
      );
    }
    return result;
  }, [historyTrades, deepMatches, ignoreEscrow, ignoreWoodTrades, searchQuery, appliedOffered, appliedWanted]);

  // Fast O(1) date range calculation since historyTrades is already sorted descending
  const historyDateRangeInfo = useMemo(() => {
    if (!historyTrades || historyTrades.length === 0) {
      return { diffDays: 0, dateString: '' };
    }

    const latestTime = new Date(historyTrades[0].updatedAt).getTime();
    const oldestTime = new Date(historyTrades[historyTrades.length - 1].updatedAt).getTime();

    if (isNaN(latestTime) || isNaN(oldestTime)) {
      return { diffDays: 0, dateString: '' };
    }

    const oldestDate = new Date(oldestTime);
    const latestDate = new Date(latestTime);

    // Calculate diff in days
    const diffTime = Math.abs(latestTime - oldestTime);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Format as M/D/YYYY
    const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    const dateString = `${format(oldestDate)} → ${format(latestDate)}`;

    return { diffDays, dateString };
  }, [historyTrades]);

  const loading = activeSubTab === 'live' ? loadingLive : loadingHistory;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 select-text">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-obsidian-border pb-6">
        <div className="flex items-center space-x-3.5">
          <Repeat className="w-7 h-7 text-spray-cyan shrink-0" />
          <div>
            <h2 className="text-2xl sm:text-3xl text-[#EDEDED] leading-tight">
              Trades <span className="mark text-obsidian-deep" style={{ ['--mark-color' as string]: 'var(--color-spray-cyan)' }}>Portal</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Monitor real-time live open trade offers and inspect full histories in the marketplace.
            </p>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex bg-[#090A0F]/80 p-1.5 rounded-md border border-obsidian-border w-fit">
          <button
            onClick={() => setActiveSubTab('live')}
            className={`btn-interactive px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              activeSubTab === 'live'
                ? 'bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Trades
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`btn-interactive px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              activeSubTab === 'history'
                ? 'bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Trade History
          </button>
        </div>
      </div>

      {/* Advanced Search Card */}
      <div className="bg-[#12141D] border border-obsidian-border rounded-md p-5 space-y-4">
        {/* Main Search Row */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="flex items-center gap-3"
        >
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search trades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 bg-obsidian-deep border border-obsidian-border rounded-md text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/30 text-xs transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 rounded-md bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0"
          >
            Search
          </button>
        </form>

        {/* Toggle Advanced Search Link */}
        <div>
          <button
            onClick={() => {
              const nextState = !showAdvanced;
              setShowAdvanced(nextState);
              if (!nextState) {
                // Clear advanced filters when hiding
                setOfferedQuery('');
                setWantedQuery('');
                setAppliedOffered('');
                setAppliedWanted('');
              }
            }}
            className="text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 transition-colors duration-150 flex items-center space-x-1 outline-none cursor-pointer"
          >
            <span>{showAdvanced ? '− Hide advanced search' : '＋ Show advanced search'}</span>
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="bg-[#090A0F]/60 border border-indigo-500/10 rounded-md p-4.5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              
              {/* Offered Contains */}
              <div className="flex-grow space-y-1.5">
                <label className="text-[10px] font-black font-mono tracking-widest text-emerald-400 uppercase block">
                  Offered Contains
                </label>
                <input
                  type="text"
                  placeholder="e.g. turtle"
                  value={offeredQuery}
                  onChange={(e) => setOfferedQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setAppliedOffered(offeredQuery);
                      setAppliedWanted(wantedQuery);
                    }
                  }}
                  className="block w-full px-4 py-3 bg-obsidian-deep border border-obsidian-border rounded-md text-slate-200 placeholder-slate-700 outline-none focus:border-emerald-500/30 text-xs transition-all font-mono"
                />
              </div>

              {/* Arrow separator */}
              <div className="hidden md:flex items-center justify-center text-indigo-500/50 mt-5 self-center">
                <span className="text-lg">➔</span>
              </div>

              {/* Wanted Contains */}
              <div className="flex-grow space-y-1.5">
                <label className="text-[10px] font-black font-mono tracking-widest text-red-400 uppercase block">
                  Wanted Contains
                </label>
                <input
                  type="text"
                  placeholder="e.g. turtle"
                  value={wantedQuery}
                  onChange={(e) => setWantedQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setAppliedOffered(offeredQuery);
                      setAppliedWanted(wantedQuery);
                    }
                  }}
                  className="block w-full px-4 py-3 bg-obsidian-deep border border-obsidian-border rounded-md text-slate-200 placeholder-slate-700 outline-none focus:border-red-500/30 text-xs transition-all font-mono"
                />
              </div>

              {/* Apply Button */}
              <div className="md:mt-5 self-end md:self-center flex-shrink-0">
                <button
                  onClick={() => {
                    setAppliedOffered(offeredQuery);
                    setAppliedWanted(wantedQuery);
                  }}
                  className="w-full md:w-auto px-5 py-3 rounded-md bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Apply
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Roster / Ranks filter settings card */}
      <div className="bg-[#12141D] border border-obsidian-border rounded-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Toggle Escrow Switch */}
          <div className="flex items-center space-x-3.5">
            <button
              onClick={() => setIgnoreEscrow(!ignoreEscrow)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 outline-none cursor-pointer border ${
                ignoreEscrow
                  ? 'bg-gold-primary/20 border-gold-primary/40'
                  : 'bg-obsidian-deep border-obsidian-border'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all duration-300 ${
                  ignoreEscrow
                    ? 'right-0.5 bg-gold-bright shadow-gold-glow'
                    : 'left-0.5 bg-slate-500'
                }`}
              />
            </button>
            <div className="text-xs font-mono">
              <span className="text-white font-bold block">Ignore Escrow Bot Trades</span>
              <span className="text-slate-500 block text-[11px]">Hides PWNSTAR#ESCROW listings</span>
            </div>
          </div>

          {/* Toggle 1x Wood Friendly Trades Switch */}
          <div className="flex items-center space-x-3.5">
            <button
              onClick={() => setIgnoreWoodTrades(!ignoreWoodTrades)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 outline-none cursor-pointer border ${
                ignoreWoodTrades
                  ? 'bg-gold-primary/20 border-gold-primary/40'
                  : 'bg-obsidian-deep border-obsidian-border'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all duration-300 ${
                  ignoreWoodTrades
                    ? 'right-0.5 bg-gold-bright shadow-gold-glow'
                    : 'left-0.5 bg-slate-500'
                }`}
              />
            </button>
            <div className="text-xs font-mono">
              <span className="text-white font-bold block">Ignore 1x Wood Trades</span>
              <span className="text-slate-500 block text-[11px]">Hides purely 1x Wood friendly transfers</span>
            </div>
          </div>
        </div>

        {/* Informative info banner for merged snapshots */}
        {activeSubTab === 'history' && (
          <div className="flex items-center space-x-2 bg-obsidian-deep/50 px-3 py-1.5 rounded-md border border-slate-800">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-mono text-slate-500 uppercase">Merged snap history active</span>
          </div>
        )}
      </div>

      {/* Main Grid display results. History streams in a batch at a time, so the full-page spinner
          only stands in until the first trades land - after that the list renders and the month
          picker reports progress. */}
      {(activeSubTab === 'history' ? loading && historyTrades.length === 0 : loading) ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-3">
          <RefreshCw className="w-8 h-8 text-gold-primary animate-spin" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            {activeSubTab === 'live' ? 'Loading live trades...' : 'Loading newest trade archives...'}
          </span>
        </div>
      ) : activeSubTab === 'live' ? (
        // Open Trades
        activeFilteredLive.length === 0 ? (
          <div className="text-center py-24 bg-obsidian-card border border-obsidian-border rounded-md text-slate-500 text-sm">
            No active open trades found matching your filters.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Showing {Math.min(visibleLiveCount, activeFilteredLive.length)} of {activeFilteredLive.length} open offers (Latest first)</span>
              <span>Valuation: Kirka Hub Pricing</span>
            </div>
            <div className="grid grid-cols-1 gap-5">
              {activeFilteredLive.slice(0, visibleLiveCount).map((trade, idx) => renderOpenTradeCard(trade, idx))}
            </div>
            {activeFilteredLive.length > visibleLiveCount && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setVisibleLiveCount((prev) => prev + 40)}
                  className="px-6 py-2.5 bg-[#12141D] border border-obsidian-border hover:border-gold-primary/20 text-xs font-bold uppercase tracking-wider text-slate-300 rounded-md transition-all duration-200 cursor-pointer"
                >
                  Load More Offers (+40)
                </button>
              </div>
            )}
          </div>
        )
      ) : (
        // Closed History Trades
        activeFilteredHistory.length === 0 ? (
          <div className="text-center py-24 bg-obsidian-card border border-obsidian-border rounded-md text-slate-500 text-sm">
            No trade history records found matching your filters.
          </div>
        ) : (
          <div className="space-y-6">
            {/* All-Time Stream Status Banner */}
            <div className="bg-[#0b0c13]/90 border border-obsidian-border rounded-md px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-extrabold tracking-wider uppercase text-slate-200">
                    All-Time History
                  </span>
                </div>
                <span className="text-[11px] font-mono text-gold-bright bg-gold-primary/10 border border-gold-primary/20 px-2 py-0.5 rounded font-bold">
                  Newest First
                </span>
                <button
                  onClick={() => {
                    dayCache.delete('dailyTrades.json');
                    setHistoryLoaded(false);
                  }}
                  title="Refresh latest trades"
                  className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="text-xs font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                {loadingHistory && historyProgress ? (
                  <span className="text-purple-300 flex items-center space-x-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      Streaming archives: day {Math.min(historyProgress.done, historyProgress.total)} of {historyProgress.total} ·{' '}
                      <strong className="text-white">{historyTrades.length.toLocaleString()}</strong> trades loaded
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    <strong className="text-purple-400 font-bold">{historyTrades.length.toLocaleString()}</strong>{' '}
                    completed trades loaded
                  </span>
                )}
                {historyProgress?.capped && (
                  <span className="text-amber-300/90 text-[11px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    Safe memory cap ({SAFE_TRADES_CAP.toLocaleString()} trades)
                  </span>
                )}
                {deepProgress && (
                  <span className="text-purple-300">
                    Searching older trades: day {deepProgress.done} of {deepProgress.total}, {deepProgress.found.toLocaleString()} more found
                  </span>
                )}
                {!deepProgress && deepMatches.length > 0 && (
                  <span className="text-slate-400">
                    {deepMatches.length.toLocaleString()} older {deepMatches.length === 1 ? 'trade' : 'trades'} found past the cap
                  </span>
                )}
                {!loadingHistory && !!historyProgress?.failed && (
                  <span className="text-red-300">
                    {historyProgress.failed} {historyProgress.failed === 1 ? 'day' : 'days'} failed to load
                  </span>
                )}
              </div>
            </div>

            {/* Completed Trade History Dynamic Header Banner */}
            {(() => {
              const { diffDays, dateString } = historyDateRangeInfo;
              if (diffDays === 0) return null;
              return (
                <div className="bg-[#0b0c13]/90 border border-obsidian-border rounded-md px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono shadow-sm">
                  <span className="text-slate-300 font-extrabold tracking-wider uppercase">
                    COMPLETED TRADE HISTORY
                  </span>
                  <span className="text-slate-500">
                    Showing data from the <strong className="text-purple-400 font-bold">last {diffDays} days</strong> · {dateString}
                  </span>
                </div>
              );
            })()}
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Showing {Math.min(visibleHistoryCount, activeFilteredHistory.length)} of {activeFilteredHistory.length} merged logs (Latest first)</span>
              <span>Historical Archives Feed</span>
            </div>
            <div className="grid grid-cols-1 gap-5">
              {activeFilteredHistory.slice(0, visibleHistoryCount).map((trade, idx) => renderHistoryTradeCard(trade, idx))}
            </div>
            {activeFilteredHistory.length > visibleHistoryCount && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setVisibleHistoryCount((prev) => prev + 40)}
                  className="px-6 py-2.5 bg-[#12141D] border border-obsidian-border hover:border-gold-primary/20 text-xs font-bold uppercase tracking-wider text-slate-300 rounded-md transition-all duration-200 cursor-pointer"
                >
                  Load More History (+40)
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};
