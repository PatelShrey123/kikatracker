import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, FileText, ArrowRight } from 'lucide-react';
import type { MarketItem } from '../utils/csv';
import { formatValue } from '../utils/csv';

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

  // Loading / UI States
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ignoreEscrow, setIgnoreEscrow] = useState(true);
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
  }, [searchQuery, appliedOffered, appliedWanted, ignoreEscrow, activeSubTab]);

  // Load snapshots index and load all history files merged in one feed on mount
  useEffect(() => {
    setLoading(true);
    // 1. Fetch trade snapshots list
    fetch('/trade-api/tradehistory/snapshots.json')
      .then((r) => r.json())
      .then(async (data) => {
        if (Array.isArray(data)) {
          const jsonFiles = data.filter((s) => typeof s === 'string' && s.endsWith('.json'));

          // We fetch the first 12 snapshots in parallel to merge them into one feed
          const filesToFetch = jsonFiles.slice(0, 12);
          const promises = filesToFetch.map((file) =>
            fetch(`/trade-api/tradehistory/${file}`)
              .then((r) => r.json())
              .catch(() => [])
          );
          
          const results = await Promise.all(promises);
          const merged = results.flat();
          
          // Sort trade history chronologically descending (latest first)
          merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          setHistoryTrades(merged);
        }
      })
      .catch((err) => console.error('Failed to load snapshots index:', err))
      .finally(() => setLoading(false));
  }, []);

  // Fetch open live trades
  useEffect(() => {
    if (activeSubTab === 'live') {
      setLoading(true);
      fetch('/trade-api/trades.json')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            // Sort live trades chronologically descending (latest first)
            data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setLiveTrades(data);
          }
        })
        .catch((err) => console.error('Failed to fetch open trades:', err))
        .finally(() => setLoading(false));
    }
  }, [activeSubTab]);

  // Helper to map rarity codes (M, L, E, R, C) to full name & border styles
  const getRarityDetails = (code: string) => {
    const raw = code.toUpperCase();
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

  // Resolve skin image render URL
  const getItemRenderUrl = (name: string) => {
    const nameKey = name.toLowerCase();

    // 1. Check fallback renders map
    const fallback = fallbackRenders[nameKey];
    if (fallback && fallback.renderurl) return fallback.renderurl;

    // 2. Check complete skins metadata list
    const matched = allItemData.find((i) => i.name.toLowerCase() === nameKey);
    if (matched && matched.renderUrl) return matched.renderUrl;

    return null;
  };

  // Helper to look up skin price in Bolt database map
  const getItemPrice = (name: string) => {
    const nameKey = name.toLowerCase();
    const matched = marketPrices.get(nameKey);
    if (matched) return matched.baseValue;

    // Try finding type details in metadata list for composite key lookup
    const matchedMeta = allItemData.find((i) => i.name.toLowerCase() === nameKey);
    if (matchedMeta) {
      const typeKey = matchedMeta.type === 'BODY_SKIN' ? 'character' : (matchedMeta.parent?.name || '');
      const compositeKey = `${nameKey}_${typeKey.toLowerCase()}`;
      const matchedComposite = marketPrices.get(compositeKey);
      if (matchedComposite) return matchedComposite.baseValue;
      return matchedMeta.salePrice || 0;
    }
    return 0;
  };

  // Calculate profit margin gives vs gets details
  const getProfitMargin = (givesItems: Array<{ name: string; quantity: number }>, getsItems: Array<{ name: string; quantity: number }>) => {
    let totalGives = 0;
    let totalGets = 0;
    let hasGivesPrice = false;
    let hasGetsPrice = false;

    givesItems.forEach((item) => {
      const price = getItemPrice(item.name);
      if (price > 0) hasGivesPrice = true;
      totalGives += price * item.quantity;
    });

    getsItems.forEach((item) => {
      const price = getItemPrice(item.name);
      if (price > 0) hasGetsPrice = true;
      totalGets += price * item.quantity;
    });

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

  // Render open live trade card
  const renderOpenTradeCard = (trade: OpenTrade, index: number) => {
    const givesItems = trade.offered.map((i) => ({ name: i.i, quantity: parseInt(i.q, 10) || 1, rarity: i.r }));
    const getsItems = trade.wanted.map((i) => ({ name: i.i, quantity: parseInt(i.q, 10) || 1, rarity: i.r }));
    const margin = getProfitMargin(givesItems, getsItems);

    return (
      <div 
        key={trade.tradeId + '-' + index}
        className="bg-obsidian-card border border-obsidian-border/80 rounded-2xl p-5 hover:border-gold-primary/20 transition-all duration-300 relative shadow-sm hover:shadow-[0_4px_25px_rgba(0,0,0,0.3)] flex flex-col space-y-4"
      >
        {/* Card Header info */}
        <div className="flex items-center justify-between border-b border-obsidian-border/50 pb-3 text-xs">
          <div className="flex items-center space-x-2 font-mono">
            <span className="text-gold-primary font-bold">#{trade.tradeId}</span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => parseUsernameClick(trade.userAndTag)}
              className="text-white hover:text-gold-bright font-black uppercase tracking-wider transition-colors hover:underline cursor-pointer"
            >
              {trade.userAndTag}
            </button>
          </div>
          <span className="text-slate-500 font-mono">
            {new Date(trade.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Card Body */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4 relative">
          
          {/* GIVES side */}
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-black font-mono tracking-widest text-[#ef4444] uppercase block mb-1">Gives</span>
            <div className="space-y-2">
              {givesItems.map((item, idx) => {
                const rar = getRarityDetails(item.rarity);
                const render = getItemRenderUrl(item.name);
                const price = getItemPrice(item.name);
                return (
                  <div
                    key={idx}
                    onClick={() => onInspectItem(item.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${rar.border}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-obsidian-deep/50 border border-white/5 rounded-lg flex items-center justify-center p-1.5 flex-shrink-0">
                        {render ? (
                          <img src={render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                        ) : (
                          <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                        <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                          <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${rar.color}`}>{rar.name}</span>
                          <span className="text-[9px] font-mono font-bold text-gold-bright">
                            {price > 0 ? formatValue(price) : 'no price'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                  </div>
                );
              })}
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
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center space-x-1 shadow-[0_0_12px_rgba(16,185,129,0.05)]">
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
              {getsItems.map((item, idx) => {
                const rar = getRarityDetails(item.rarity);
                const render = getItemRenderUrl(item.name);
                const price = getItemPrice(item.name);
                return (
                  <div
                    key={idx}
                    onClick={() => onInspectItem(item.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${rar.border}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-obsidian-deep/50 border border-white/5 rounded-lg flex items-center justify-center p-1.5 flex-shrink-0">
                        {render ? (
                          <img src={render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                        ) : (
                          <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                        <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                          <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${rar.color}`}>{rar.name}</span>
                          <span className="text-[9px] font-mono font-bold text-gold-bright">
                            {price > 0 ? formatValue(price) : 'no price'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // Render closed history trade card
  const renderHistoryTradeCard = (trade: HistoryTrade, index: number) => {
    const givesItems = (trade.trade?.offered?.items || []).map((i) => ({ name: i.name, quantity: typeof i.quantity === 'string' ? parseInt(i.quantity, 10) || 1 : i.quantity, rarity: i.rarity }));
    const getsItems = (trade.trade?.wanted?.items || []).map((i) => ({ name: i.name, quantity: typeof i.quantity === 'string' ? parseInt(i.quantity, 10) || 1 : i.quantity, rarity: i.rarity }));
    const margin = getProfitMargin(givesItems, getsItems);

    return (
      <div 
        key={trade.tradeId + '-' + index}
        className="bg-obsidian-card border border-obsidian-border/80 rounded-2xl p-5 hover:border-gold-primary/20 transition-all duration-300 relative shadow-sm hover:shadow-[0_4px_25px_rgba(0,0,0,0.3)] flex flex-col space-y-4"
      >
        {/* Card Header info */}
        <div className="flex items-center justify-between border-b border-obsidian-border/50 pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 font-mono">
            <span className="text-gold-primary font-bold">#{trade.tradeId}</span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => parseUsernameClick(trade.offerer)}
              className="text-white hover:text-gold-bright font-black uppercase tracking-wider transition-colors hover:underline cursor-pointer"
            >
              {trade.offerer}
            </button>
            <span className="text-slate-500 font-bold">🤝 Swap 🤝</span>
            <button
              onClick={() => parseUsernameClick(trade.accepter)}
              className="text-white hover:text-gold-bright font-black uppercase tracking-wider transition-colors hover:underline cursor-pointer"
            >
              {trade.accepter}
            </button>
          </div>
          <span className="text-slate-500 font-mono text-[10px]">
            {new Date(trade.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Card Body */}
        <div className="flex flex-col lg:flex-row items-stretch gap-4 relative">
          
          {/* GIVES side */}
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-black font-mono tracking-widest text-[#ef4444] uppercase block mb-1">Gives</span>
            <div className="space-y-2">
              {givesItems.map((item, idx) => {
                const rar = getRarityDetails(item.rarity);
                const render = getItemRenderUrl(item.name);
                const price = getItemPrice(item.name);
                return (
                  <div
                    key={idx}
                    onClick={() => onInspectItem(item.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${rar.border}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-obsidian-deep/50 border border-white/5 rounded-lg flex items-center justify-center p-1.5 flex-shrink-0">
                        {render ? (
                          <img src={render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                        ) : (
                          <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                        <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                          <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${rar.color}`}>{rar.name}</span>
                          <span className="text-[9px] font-mono font-bold text-gold-bright">
                            {price > 0 ? formatValue(price) : 'no price'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                  </div>
                );
              })}
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
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center space-x-1 shadow-[0_0_12px_rgba(16,185,129,0.05)]">
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
              {getsItems.map((item, idx) => {
                const rar = getRarityDetails(item.rarity);
                const render = getItemRenderUrl(item.name);
                const price = getItemPrice(item.name);
                return (
                  <div
                    key={idx}
                    onClick={() => onInspectItem(item.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] ${rar.border}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-obsidian-deep/50 border border-white/5 rounded-lg flex items-center justify-center p-1.5 flex-shrink-0">
                        {render ? (
                          <img src={render} alt={item.name} className="max-h-8 max-w-full object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                        ) : (
                          <span className="text-[8px] font-mono text-slate-600 uppercase">Skin</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block leading-none mb-1">{item.name}</span>
                        <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                          <span className={`text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded border border-current ${rar.color}`}>{rar.name}</span>
                          <span className="text-[9px] font-mono font-bold text-gold-bright">
                            {price > 0 ? formatValue(price) : 'no price'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">x{item.quantity}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // Filters mapping
  const getFilteredLiveTrades = () => {
    let result = [...liveTrades];
    if (ignoreEscrow) {
      result = result.filter((t) => t.userAndTag.toUpperCase() !== 'PWNSTAR#ESCROW');
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
  };

  const getFilteredHistoryTrades = () => {
    let result = [...historyTrades];
    if (ignoreEscrow) {
      result = result.filter(
        (t) =>
          t.offerer.toUpperCase() !== 'PWNSTAR#ESCROW' &&
          t.accepter.toUpperCase() !== 'PWNSTAR#ESCROW'
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
  };

  const activeFilteredLive = getFilteredLiveTrades();
  const activeFilteredHistory = getFilteredHistoryTrades();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 select-text">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-obsidian-border pb-6">
        <div className="flex items-center space-x-3.5">
          {/* Custom image replaces ArrowRightLeft icon */}
          <img 
            src="trade_portal.png" 
            alt="Trades Icon" 
            className="w-8 h-8 rounded-lg object-contain glow-filter-gold" 
          />
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              Trades Portal
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Monitor real-time live open trade offers and inspect full histories in the marketplace.
            </p>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex bg-[#090A0F]/80 p-1.5 rounded-xl border border-obsidian-border w-fit">
          <button
            onClick={() => setActiveSubTab('live')}
            className={`btn-interactive px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeSubTab === 'live'
                ? 'bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Trades
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`btn-interactive px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
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
      <div className="bg-[#12141D] border border-obsidian-border rounded-xl p-5 space-y-4">
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
              className="block w-full pl-10 pr-4 py-3 bg-obsidian-deep border border-obsidian-border rounded-xl text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/30 text-xs transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex-shrink-0"
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
          <div className="bg-[#090A0F]/60 border border-indigo-500/10 rounded-xl p-4.5 space-y-4">
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
                  className="block w-full px-4 py-3 bg-obsidian-deep border border-obsidian-border rounded-xl text-slate-200 placeholder-slate-700 outline-none focus:border-emerald-500/30 text-xs transition-all font-mono"
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
                  className="block w-full px-4 py-3 bg-obsidian-deep border border-obsidian-border rounded-xl text-slate-200 placeholder-slate-700 outline-none focus:border-red-500/30 text-xs transition-all font-mono"
                />
              </div>

              {/* Apply Button */}
              <div className="md:mt-5 self-end md:self-center flex-shrink-0">
                <button
                  onClick={() => {
                    setAppliedOffered(offeredQuery);
                    setAppliedWanted(wantedQuery);
                  }}
                  className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Apply
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Roster / Ranks filter settings card */}
      <div className="bg-[#12141D] border border-obsidian-border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <span className="text-slate-500 block">Hides all automated listings from PWNSTAR#ESCROW</span>
          </div>
        </div>

        {/* Informative info banner for merged snapshots */}
        {activeSubTab === 'history' && (
          <div className="flex items-center space-x-2 bg-obsidian-deep/50 px-3 py-1.5 rounded-lg border border-white/5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] font-mono text-slate-500 uppercase">Merged snap history active</span>
          </div>
        )}
      </div>

      {/* Main Grid display results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 space-y-3">
          <RefreshCw className="w-8 h-8 text-gold-primary animate-spin" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Merging snap files...
          </span>
        </div>
      ) : activeSubTab === 'live' ? (
        // Open Trades
        activeFilteredLive.length === 0 ? (
          <div className="text-center py-24 bg-obsidian-card border border-obsidian-border rounded-xl text-slate-500 text-sm">
            No active open trades found matching your filters.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Showing {Math.min(visibleLiveCount, activeFilteredLive.length)} of {activeFilteredLive.length} open offers (Latest first)</span>
              <span>Valuation: Bolt Pricing</span>
            </div>
            <div className="grid grid-cols-1 gap-5">
              {activeFilteredLive.slice(0, visibleLiveCount).map((trade, idx) => renderOpenTradeCard(trade, idx))}
            </div>
            {activeFilteredLive.length > visibleLiveCount && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setVisibleLiveCount((prev) => prev + 40)}
                  className="px-6 py-2.5 bg-[#12141D] border border-obsidian-border hover:border-gold-primary/20 text-xs font-bold uppercase tracking-wider text-slate-300 rounded-xl transition-all duration-200 cursor-pointer"
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
          <div className="text-center py-24 bg-obsidian-card border border-obsidian-border rounded-xl text-slate-500 text-sm">
            No trade history records found matching your filters.
          </div>
        ) : (
          <div className="space-y-6">
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
                  className="px-6 py-2.5 bg-[#12141D] border border-obsidian-border hover:border-gold-primary/20 text-xs font-bold uppercase tracking-wider text-slate-300 rounded-xl transition-all duration-200 cursor-pointer"
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
