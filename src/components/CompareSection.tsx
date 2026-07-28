import React, { useState, useEffect, useMemo } from 'react';
import { Search, GitCompare, Swords, Copy, Check, Plus, Minus, ArrowRightLeft, Shield, Layers } from 'lucide-react';
import { fetchUserProfile, fetchUserInventory } from '../utils/api';
import type { UserProfile, UserInventoryItem } from '../utils/api';
import type { MarketItem } from '../utils/csv';
import { formatValue } from '../utils/csv';

interface CompareSectionProps {
  marketPrices: Map<string, MarketItem>;
  fallbackRenders: Record<string, any>;
  publicItems: any[];
  allItemData: any[];
}

const isValidKirkaId = (id: string) => {
  const clean = id.trim();
  const isShortId = clean.length === 6 && /^[a-zA-Z0-9]{6}$/.test(clean);
  const isUuid = clean.length === 36 && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clean);
  return isShortId || isUuid;
};

export const CompareSection: React.FC<CompareSectionProps> = ({
  marketPrices,
  fallbackRenders,
  publicItems,
}) => {
  // Debugging logs to display on-screen for local diagnostics
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addLog = (msg: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Local state to track URL search query string reactively
  const [urlQuery, setUrlQuery] = useState(window.location.search);

  // Sync state with urlQuery state variable changes on back/forward
  useEffect(() => {
    const handlePopState = () => {
      addLog(`popstate triggered. New search: "${window.location.search}"`);
      setUrlQuery(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    addLog(`Initialized popstate history listeners.`);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Query parameters parsing
  const getQueryParams = (searchStr: string) => {
    const params = new URLSearchParams(searchStr);
    return {
      p1Query: params.get('p1') || '',
      p2Query: params.get('p2') || '',
      typeQuery: (params.get('type') as 'stats' | 'inventory') || 'stats'
    };
  };

  const { p1Query, p2Query, typeQuery } = getQueryParams(urlQuery);

  const [compareType, setCompareType] = useState<'stats' | 'inventory'>(typeQuery);
  const [p1Search, setP1Search] = useState(p1Query);
  const [p2Search, setP2Search] = useState(p2Query);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded profiles and inventories
  const [primaryProfile, setPrimaryProfile] = useState<UserProfile | null>(null);
  const [primaryInventory, setPrimaryInventory] = useState<UserInventoryItem[]>([]);
  const [compareProfile, setCompareProfile] = useState<UserProfile | null>(null);
  const [compareInventory, setCompareInventory] = useState<UserInventoryItem[]>([]);

  // Selection states for Quick Trade Offer
  const [mySelected, setMySelected] = useState<Record<string, number>>({});
  const [theirSelected, setTheirSelected] = useState<Record<string, number>>({});

  // Search filters for both columns
  const [mySearchTerm, setMySearchTerm] = useState('');
  const [theirSearchTerm, setTheirSearchTerm] = useState('');

  // Pagination lists limit
  const [myVisibleCount, setMyVisibleCount] = useState(15);
  const [theirVisibleCount, setTheirVisibleCount] = useState(15);

  const [copySuccess, setCopySuccess] = useState(false);

  // Sync inputs when urlQuery changes
  useEffect(() => {
    const { p1Query, p2Query, typeQuery } = getQueryParams(urlQuery);
    addLog(`urlQuery synced inputs. p1: "${p1Query}", p2: "${p2Query}", type: "${typeQuery}"`);
    setCompareType(typeQuery);
    setP1Search(p1Query);
    setP2Search(p2Query);
  }, [urlQuery]);

  // Sync state with URL change
  useEffect(() => {
    const loadFromUrl = async () => {
      const { p1Query, p2Query } = getQueryParams(urlQuery);
      addLog(`loadFromUrl starting fetch. p1: "${p1Query}", p2: "${p2Query}"`);

      if (!p1Query && !p2Query) {
        addLog(`No query parameters present. Resetting profiles.`);
        setPrimaryProfile(null);
        setPrimaryInventory([]);
        setCompareProfile(null);
        setCompareInventory([]);
        setMySelected({});
        setTheirSelected({});
        return;
      }

      setError(null);

      // Validate inputs
      const upperP1 = p1Query.trim().toUpperCase();
      const upperP2 = p2Query.trim().toUpperCase();

      if (p1Query && !isValidKirkaId(upperP1)) {
        const errMsg = `Player 1 ID format is invalid ("${p1Query}"). Must be a 6-character Short ID or UUID.`;
        addLog(`Validation failure: ${errMsg}`);
        setError(errMsg);
        return;
      }
      if (p2Query && !isValidKirkaId(upperP2)) {
        const errMsg = `Player 2 ID format is invalid ("${p2Query}"). Must be a 6-character Short ID or UUID.`;
        addLog(`Validation failure: ${errMsg}`);
        setError(errMsg);
        return;
      }

      addLog(`Inputs validated. Starting API fetches...`);
      setLoading(true);
      try {
        if (upperP1) {
          addLog(`Fetching Player 1: ${upperP1}`);
          const isShortId = upperP1.length === 6;
          const prof1 = await fetchUserProfile(upperP1, isShortId);
          addLog(`Player 1 profile resolved: ${prof1 ? prof1.name : 'null'}`);
          if (prof1) {
            setPrimaryProfile(prof1);
            addLog(`Fetching Player 1 inventory...`);
            const inv1 = await fetchUserInventory(prof1.id);
            addLog(`Player 1 inventory resolved: ${inv1 ? inv1.length : 0} items`);
            setPrimaryInventory(inv1 || []);
          } else {
            setError(`Player 1 (${upperP1}) not found.`);
          }
        } else {
          setPrimaryProfile(null);
          setPrimaryInventory([]);
        }

        if (upperP2) {
          addLog(`Fetching Player 2: ${upperP2}`);
          const isShortId = upperP2.length === 6;
          const prof2 = await fetchUserProfile(upperP2, isShortId);
          addLog(`Player 2 profile resolved: ${prof2 ? prof2.name : 'null'}`);
          if (prof2) {
            setCompareProfile(prof2);
            addLog(`Fetching Player 2 inventory...`);
            const inv2 = await fetchUserInventory(prof2.id);
            addLog(`Player 2 inventory resolved: ${inv2 ? inv2.length : 0} items`);
            setCompareInventory(inv2 || []);
          } else {
            setError(`Player 2 (${upperP2}) not found.`);
          }
        } else {
          setCompareProfile(null);
          setCompareInventory([]);
        }
      } catch (err: any) {
        addLog(`Fetch caught exception: ${err.message}`);
        console.error(err);
        setError('Error loading player profile details.');
      } finally {
        setLoading(false);
        addLog(`Finished loading sequence.`);
      }
    };

    loadFromUrl();
  }, [urlQuery]);

  // Reset pagination counters
  useEffect(() => {
    setMyVisibleCount(15);
  }, [mySearchTerm]);

  useEffect(() => {
    setTheirVisibleCount(15);
  }, [theirSearchTerm]);

  // Update query params function
  const updateUrlParams = (p1: string, p2: string, type: 'stats' | 'inventory') => {
    const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
    const qParts: string[] = [];
    if (p1) qParts.push(`p1=${p1}`);
    if (p2) qParts.push(`p2=${p2}`);
    qParts.push(`type=${type}`);
    const searchString = qParts.length > 0 ? `?${qParts.join('&')}` : '';
    addLog(`updateUrlParams called. Pushing URL: ${prefix}/compare${searchString}`);
    window.history.pushState(null, '', `${prefix}/compare${searchString}`);
    setUrlQuery(searchString);
  };

  // Helper to resolve skin image render URL
  const getItemRenderUrl = (item: any) => {
    if (!item) return null;
    if (item.renderUrl) return item.renderUrl;

    const cleanName = item.name.replace(/^_+/, '');
    const nameKey = cleanName.toLowerCase();
    const fallback = fallbackRenders[nameKey];
    if (fallback && fallback.renderurl) return fallback.renderurl;

    if (item.parent?.name) {
      const comboKey = `${cleanName.toLowerCase()} ${item.parent.name.toLowerCase()}`;
      const comboFallback = fallbackRenders[comboKey];
      if (comboFallback && comboFallback.renderurl) return comboFallback.renderurl;
    }
    
    const matched = publicItems.find(
      (p) =>
        p.id === item.id ||
        (p.name.toLowerCase() === cleanName.toLowerCase() &&
          p.type.toLowerCase() === item.type.toLowerCase())
    );
    return matched ? matched.renderUrl : null;
  };

  // Resolve item price helper
  const getItemPrice = (item: any) => {
    if (!item || !item.name) return 0;
    const cleanName = item.name.replace(/^_+/, '');
    const isCharacter = item.type === 'BODY_SKIN';
    const parentName = item.parent?.name || '';
    const itemTypeKey = isCharacter ? 'character' : parentName;
    
    const compositeKey = `${cleanName.toLowerCase()}_${itemTypeKey.toLowerCase()}`;
    const nameKey = cleanName.toLowerCase();

    const matched = marketPrices ? (marketPrices.get(compositeKey) || marketPrices.get(nameKey)) : null;
    return matched ? matched.baseValue : (item.salePrice || 0);
  };

  // Trigger search comparison manually
  const handlePerformComparison = () => {
    const val1 = p1Search.trim().toUpperCase();
    const val2 = p2Search.trim().toUpperCase();
    addLog(`handlePerformComparison clicked. val1: "${val1}", val2: "${val2}"`);
    if (!val1 || !val2) {
      setError('Please fill in both player IDs.');
      return;
    }
    if (!isValidKirkaId(val1)) {
      setError('Player 1 ID format is invalid. Must be a 6-character Short ID or UUID.');
      return;
    }
    if (!isValidKirkaId(val2)) {
      setError('Player 2 ID format is invalid. Must be a 6-character Short ID or UUID.');
      return;
    }
    setError(null);
    updateUrlParams(val1, val2, compareType);
  };

  const handleResetComparison = () => {
    addLog(`Resetting comparison and clearing state.`);
    setP1Search('');
    setP2Search('');
    updateUrlParams('', '', 'stats');
  };

  const getNetWorth = (inv: UserInventoryItem[]) => {
    if (!Array.isArray(inv)) return 0;
    return inv.reduce((sum, current) => sum + (current && current.item ? getItemPrice(current.item) * (current.amount || 0) : 0), 0);
  };

  const getUnitCount = (inv: UserInventoryItem[]) => {
    if (!Array.isArray(inv)) return 0;
    return inv.reduce((sum, current) => sum + (current ? (current.amount || 0) : 0), 0);
  };

  // Stat computations
  const stats1 = primaryProfile?.stats || { kills: 0, deaths: 0, wins: 0, games: 0, headshots: 0, scores: 0 };
  const stats2 = compareProfile?.stats || { kills: 0, deaths: 0, wins: 0, games: 0, headshots: 0, scores: 0 };

  const kd1 = stats1.deaths > 0 ? stats1.kills / stats1.deaths : stats1.kills;
  const kd2 = stats2.deaths > 0 ? stats2.kills / stats2.deaths : stats2.kills;

  const winRate1 = stats1.games > 0 ? (stats1.wins / stats1.games) * 100 : 0;
  const winRate2 = stats2.games > 0 ? (stats2.wins / stats2.games) * 100 : 0;

  const hsRate1 = stats1.kills > 0 ? (stats1.headshots / stats1.kills) * 100 : 0;
  const hsRate2 = stats2.kills > 0 ? (stats2.headshots / stats2.kills) * 100 : 0;

  const netWorth1 = getNetWorth(primaryInventory);
  const netWorth2 = getNetWorth(compareInventory);

  const units1 = getUnitCount(primaryInventory);
  const units2 = getUnitCount(compareInventory);

  // Sorting memo lists
  const sortedMyInventory = useMemo(() => {
    if (!Array.isArray(primaryInventory)) return [];
    return [...primaryInventory]
      .filter(i => i && i.item && i.item.name)
      .sort((a, b) => getItemPrice(b.item) - getItemPrice(a.item))
      .filter(i => i.item.name.toLowerCase().includes(mySearchTerm.toLowerCase()));
  }, [primaryInventory, mySearchTerm]);

  const sortedTheirInventory = useMemo(() => {
    if (!Array.isArray(compareInventory)) return [];
    return [...compareInventory]
      .filter(i => i && i.item && i.item.name)
      .sort((a, b) => getItemPrice(b.item) - getItemPrice(a.item))
      .filter(i => i.item.name.toLowerCase().includes(theirSearchTerm.toLowerCase()));
  }, [compareInventory, theirSearchTerm]);

  // Click selectors
  const handleToggleMyItem = (itemId: string) => {
    setMySelected(prev => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = 1;
      }
      return next;
    });
  };

  const handleAdjustMyItemQty = (itemId: string, increment: boolean, maxAmount: number) => {
    setMySelected(prev => {
      const next = { ...prev };
      const curr = next[itemId] || 1;
      if (increment) {
        next[itemId] = Math.min(curr + 1, maxAmount);
      } else {
        if (curr <= 1) {
          delete next[itemId];
        } else {
          next[itemId] = curr - 1;
        }
      }
      return next;
    });
  };

  const handleToggleTheirItem = (itemId: string) => {
    setTheirSelected(prev => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = 1;
      }
      return next;
    });
  };

  const handleAdjustTheirItemQty = (itemId: string, increment: boolean, maxAmount: number) => {
    setTheirSelected(prev => {
      const next = { ...prev };
      const curr = next[itemId] || 1;
      if (increment) {
        next[itemId] = Math.min(curr + 1, maxAmount);
      } else {
        if (curr <= 1) {
          delete next[itemId];
        } else {
          next[itemId] = curr - 1;
        }
      }
      return next;
    });
  };

  const generatedTradeCommand = useMemo(() => {
    if (!compareProfile) return '';

    const myOffers: string[] = [];
    const theirOffers: string[] = [];

    Object.entries(mySelected).forEach(([id, qty]) => {
      const match = primaryInventory.find(i => i && i.item && i.item.id === id);
      if (match && match.item && match.item.name) {
        const cleanName = match.item.name.replace(/^_+/, '');
        const qtyStr = qty > 1 ? `x${qty}` : '';
        myOffers.push(`[${cleanName}]${qtyStr}`);
      }
    });

    Object.entries(theirSelected).forEach(([id, qty]) => {
      const match = compareInventory.find(i => i && i.item && i.item.id === id);
      if (match && match.item && match.item.name) {
        const cleanName = match.item.name.replace(/^_+/, '');
        const qtyStr = qty > 1 ? `x${qty}` : '';
        theirOffers.push(`[${cleanName}]${qtyStr}`);
      }
    });

    if (myOffers.length === 0 && theirOffers.length === 0) return '';

    const finalMyOffers = (myOffers.length === 0 && theirOffers.length > 0) ? ['[wood]'] : myOffers;
    const finalTheirOffers = (theirOffers.length === 0 && myOffers.length > 0) ? ['[wood]'] : theirOffers;

    const opponentId = compareProfile.shortId || compareProfile.id;
    const myPart = finalMyOffers.length > 0 ? ` my:${finalMyOffers.join(',')}` : '';
    const yourPart = finalTheirOffers.length > 0 ? ` your:${finalTheirOffers.join(',')}` : '';

    return `/trade offer #${opponentId}${myPart}${yourPart}`;
  }, [compareProfile, mySelected, theirSelected, primaryInventory, compareInventory]);

  const handleCopyCommand = () => {
    if (!generatedTradeCommand) return;
    navigator.clipboard.writeText(generatedTradeCommand)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => console.error('Failed to copy:', err));
  };

  const renderComparisonRow = (label: string, val1: number, val2: number, formatFn: (v: number) => string, higherIsBetter = true) => {
    const total = val1 + val2;
    const pct1 = total > 0 ? (val1 / total) * 100 : 50;
    const pct2 = total > 0 ? (val2 / total) * 100 : 50;

    const isVal1Better = higherIsBetter ? val1 > val2 : val1 < val2;
    const isVal2Better = higherIsBetter ? val2 > val1 : val2 < val1;
    const isEqual = val1 === val2;

    return (
      <div className="space-y-2.5 py-4.5 border-b border-white/5 font-mono">
        <div className="flex justify-between items-center text-xs">
          <span className={`font-bold ${isEqual ? 'text-slate-300' : isVal1Better ? 'text-emerald-400 font-extrabold text-sm' : 'text-rose-500/80'}`}>
            {formatFn(val1)}
          </span>
          <span className="text-[10px] tracking-widest text-slate-500 uppercase font-black">{label}</span>
          <span className={`font-bold ${isEqual ? 'text-slate-300' : isVal2Better ? 'text-emerald-400 font-extrabold text-sm' : 'text-rose-500/80'}`}>
            {formatFn(val2)}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-obsidian-deep border border-white/5 flex">
          <div 
            style={{ width: `${pct1}%` }} 
            className={`h-full transition-all duration-500 ${isEqual ? 'bg-indigo-500/40' : isVal1Better ? 'bg-emerald-500/80' : 'bg-rose-600/50'}`}
          />
          <div 
            style={{ width: `${pct2}%` }} 
            className={`h-full transition-all duration-500 ${isEqual ? 'bg-indigo-500/30' : isVal2Better ? 'bg-emerald-500/80' : 'bg-rose-600/50'}`}
          />
        </div>
      </div>
    );
  };

  const mySelectedCount = Object.keys(mySelected).length;
  const theirSelectedCount = Object.keys(theirSelected).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 select-text">
      {/* Page Title */}
      <div className="flex justify-between items-center select-none">
        <div className="flex items-center space-x-3">
          <GitCompare className="w-8 h-8 text-gold-primary filter drop-shadow-[0_0_8px_rgba(212,175,55,0.2)]" />
          <div>
            <h2 className="text-2xl font-black tracking-wider text-white uppercase">Compare Arena</h2>
            <p className="text-xs text-slate-400 mt-0.5">Compare Combat statistics and inventory trade valuations side-by-side using full page workspace.</p>
          </div>
        </div>
      </div>

      {!primaryProfile || !compareProfile ? (
        /* SEARCH CARD WORKSPACE */
        <div className="bg-[#0b0c13] border border-obsidian-border rounded-3xl p-8 space-y-8">
          <div className="text-center space-y-2.5 max-w-lg mx-auto">
            <Swords className="w-12 h-12 text-indigo-400 mx-auto animate-pulse" />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Select Players to compare</h3>
            <p className="text-xs text-slate-400">Provide Kirka Player IDs for both combatants to initialize full-screen statistics & valuation comparisons.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Player 1 ID (6-Char Short ID or UUID)</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Player 1 ID (e.g. HESHPY)..."
                  value={p1Search}
                  onChange={(e) => setP1Search(e.target.value)}
                  className="w-full bg-[#090A0F] border border-obsidian-border rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/25 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Player 2 ID (6-Char Short ID or UUID)</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Player 2 ID (e.g. S2WVOK)..."
                  value={p2Search}
                  onChange={(e) => setP2Search(e.target.value)}
                  className="w-full bg-[#090A0F] border border-obsidian-border rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-gold-primary/20 transition-all"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-[11px] font-mono text-rose-500 bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl text-center max-w-lg mx-auto">
              {error}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <button
              disabled={loading}
              onClick={handlePerformComparison}
              className="bg-gradient-to-r from-gold-primary to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-extrabold text-sm px-12 py-3.5 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Initializing Comparison...' : 'Compare'}
            </button>
          </div>

          {/* Diagnostic Log Panel for Client-Side Debugging */}
          <div className="mt-8 pt-6 border-t border-white/5 space-y-2 select-text max-w-2xl mx-auto">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-black block">Client Diagnostics Console Logs</span>
            <div className="bg-[#040509]/80 border border-white/5 rounded-xl p-4 font-mono text-[9px] text-slate-400 space-y-1 max-h-48 overflow-y-auto">
              {debugLogs.length === 0 ? (
                <div className="text-slate-600 italic">No diagnostics logs registered. Initialize query filters to log actions.</div>
              ) : (
                debugLogs.map((log, idx) => (
                  <div key={idx} className="break-all">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* COMPARISON RESULTS TAB WORKSPACE */
        <div className="space-y-6">
          
          {/* Header Panel */}
          <div className="bg-[#0b0c13] border border-obsidian-border rounded-3xl p-6 grid grid-cols-3 items-center text-center select-none relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
            
            <div className="space-y-1.5 z-10">
              <span className="text-lg font-black text-white uppercase tracking-wider block">{primaryProfile.name}</span>
              {primaryProfile.clan && (
                <span className="text-xs font-mono font-bold text-indigo-400 block">CLAN: {primaryProfile.clan}</span>
              )}
              <span className="inline-block text-[9px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded uppercase font-bold mt-2">LEVEL {primaryProfile.level}</span>
            </div>

            <div className="flex justify-center z-10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-b from-[#1b1c26] to-[#0c0d13] border border-white/10 flex items-center justify-center shadow-xl">
                <span className="text-sm font-mono font-black text-gold-bright">VS</span>
              </div>
            </div>

            <div className="space-y-1.5 z-10">
              <span className="text-lg font-black text-white uppercase tracking-wider block">{compareProfile.name}</span>
              {compareProfile.clan && (
                <span className="text-xs font-mono font-bold text-gold-bright block">CLAN: {compareProfile.clan}</span>
              )}
              <span className="inline-block text-[9px] font-mono text-gold-bright bg-gold-primary/10 border border-gold-primary/30 px-3 py-1 rounded uppercase font-bold mt-2">LEVEL {compareProfile.level}</span>
            </div>
          </div>

          {/* Subnavigation Tab Switcher */}
          <div className="flex bg-[#0b0c13] border border-obsidian-border p-1 rounded-2xl select-none">
            <button
              onClick={() => {
                setCompareType('stats');
                updateUrlParams(p1Search, p2Search, 'stats');
              }}
              className={`flex-1 py-4 text-xs font-bold uppercase rounded-xl text-center transition-all cursor-pointer ${compareType === 'stats' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Combat Stats Compare
            </button>
            <button
              onClick={() => {
                setCompareType('inventory');
                updateUrlParams(p1Search, p2Search, 'inventory');
              }}
              className={`flex-1 py-4 text-xs font-bold uppercase rounded-xl text-center transition-all cursor-pointer ${compareType === 'inventory' ? 'bg-gold-primary/15 text-gold-bright border border-gold-primary/20' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Inventory Valuations
            </button>
          </div>

          {/* Tab Work Content */}
          <div className="bg-[#0b0c13] border border-obsidian-border rounded-3xl p-6">
            {compareType === 'stats' ? (
              /* STATS VIEW */
              <div className="space-y-2">
                {renderComparisonRow("Level", primaryProfile.level, compareProfile.level, (v) => v.toString())}
                {renderComparisonRow("K/D Ratio", kd1, kd2, (v) => v.toFixed(3))}
                {renderComparisonRow("Kills", stats1.kills, stats2.kills, (v) => v.toLocaleString())}
                {renderComparisonRow("Deaths", stats1.deaths, stats2.deaths, (v) => v.toLocaleString(), false)}
                {renderComparisonRow("Headshots", stats1.headshots, stats2.headshots, (v) => v.toLocaleString())}
                {renderComparisonRow("Headshot Rate %", hsRate1, hsRate2, (v) => v.toFixed(1) + '%')}
                {renderComparisonRow("Wins", stats1.wins, stats2.wins, (v) => v.toLocaleString())}
                {renderComparisonRow("Games Played", stats1.games, stats2.games, (v) => v.toLocaleString())}
                {renderComparisonRow("Win Rate %", winRate1, winRate2, (v) => v.toFixed(1) + '%')}
                {renderComparisonRow("Total Score", stats1.scores, stats2.scores, (v) => v.toLocaleString())}
                {renderComparisonRow("Gold Coins", primaryProfile.coins || 0, compareProfile.coins || 0, (v) => v.toLocaleString())}
                {renderComparisonRow("Diamonds", primaryProfile.diamonds || 0, compareProfile.diamonds || 0, (v) => v.toLocaleString())}
                {renderComparisonRow("Total Experience XP", primaryProfile.totalXp || 0, compareProfile.totalXp || 0, (v) => v.toLocaleString())}
                {renderComparisonRow("Elo Rating (KLO)", primaryProfile.klo || 0, compareProfile.klo || 0, (v) => v.toLocaleString())}
                
                {/* Active skin loadout breakdown cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-8">
                  <div className="bg-[#090A0F] border border-white/5 p-5 rounded-2xl space-y-4">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold block uppercase tracking-widest border-b border-white/5 pb-2">{primaryProfile.name}'s Combat Loadout</span>
                    <div className="space-y-1 text-xs">
                      <span className="text-slate-500 font-mono text-[9px] block uppercase">Character Equipped</span>
                      <span className="font-extrabold text-slate-200 block uppercase truncate text-sm">{primaryProfile.activeBodySkin?.name || 'Default'}</span>
                    </div>
                    <div className="space-y-1 text-xs pt-2.5 border-t border-white/5">
                      <span className="text-slate-500 font-mono text-[9px] block uppercase">Weapon Equipped</span>
                      <span className="font-extrabold text-slate-200 block uppercase truncate text-sm">{primaryProfile.activeWeapon1Skin?.name || 'Default'}</span>
                    </div>
                  </div>

                  <div className="bg-[#090A0F] border border-white/5 p-5 rounded-2xl space-y-4">
                    <span className="text-[10px] font-mono text-gold-bright font-bold block uppercase tracking-widest border-b border-white/5 pb-2">{compareProfile.name}'s Combat Loadout</span>
                    <div className="space-y-1 text-xs">
                      <span className="text-slate-500 font-mono text-[9px] block uppercase">Character Equipped</span>
                      <span className="font-extrabold text-slate-200 block uppercase truncate text-sm">{compareProfile.activeBodySkin?.name || 'Default'}</span>
                    </div>
                    <div className="space-y-1 text-xs pt-2.5 border-t border-white/5">
                      <span className="text-slate-500 font-mono text-[9px] block uppercase">Weapon Equipped</span>
                      <span className="font-extrabold text-slate-200 block uppercase truncate text-sm">{compareProfile.activeWeapon1Skin?.name || 'Default'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* INVENTORY VALUATION VIEW */
              <div className="space-y-6">
                
                {/* Valuation metrics grid */}
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-5 select-none">
                  <div className="bg-[#090A0F]/80 p-3.5 text-center rounded-xl flex flex-col justify-center">
                    <span className="text-slate-500 text-[9px] font-mono uppercase block tracking-wider">Metrics</span>
                    <span className="text-xs text-slate-400 font-extrabold block mt-2 uppercase font-mono">Net Worth</span>
                    <span className="text-xs text-slate-400 font-extrabold block mt-2.5 uppercase font-mono">Total Units</span>
                  </div>

                  <div className="bg-indigo-950/15 p-3.5 rounded-xl border border-indigo-500/10 text-center">
                    <span className="text-indigo-400 text-[10px] font-mono uppercase font-black block">{primaryProfile.name}</span>
                    <span className="text-sm text-emerald-400 font-black block mt-2 font-mono">{formatValue(netWorth1)}</span>
                    <span className="text-sm text-slate-200 font-bold block mt-2 font-mono">{units1.toLocaleString()}</span>
                  </div>

                  <div className="bg-gold-primary/5 p-3.5 rounded-xl border border-gold-primary/10 text-center">
                    <span className="text-gold-bright text-[10px] font-mono uppercase font-black block">{compareProfile.name}</span>
                    <span className="text-sm text-emerald-400 font-black block mt-2 font-mono">{formatValue(netWorth2)}</span>
                    <span className="text-sm text-slate-200 font-bold block mt-2 font-mono">{units2.toLocaleString()}</span>
                  </div>
                </div>

                {/* SIDE-BY-SIDE SPLIT CHECKLIST PANELS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                  
                  {/* LEFT: Player 1 Checklist */}
                  <div className="flex flex-col min-h-0 bg-[#090A0F]/50 border border-white/5 rounded-2xl p-5">
                    <div className="flex justify-between items-center pb-3.5 border-b border-white/5 mb-4 select-none">
                      <span className="text-sm font-black uppercase text-indigo-400 tracking-wider">Your Skins</span>
                      {mySelectedCount > 0 && (
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500 text-white font-extrabold">{mySelectedCount} Selected</span>
                      )}
                    </div>

                    <div className="relative mb-4 select-text">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search your skins..."
                        value={mySearchTerm}
                        onChange={(e) => setMySearchTerm(e.target.value)}
                        className="w-full bg-[#0b0c13] border border-obsidian-border rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/20 transition-all"
                      />
                    </div>

                    {/* Scrollable container with forced large height on full page */}
                    <div style={{ height: '520px', minHeight: '520px' }} className="overflow-y-auto space-y-2 pr-1 select-none">
                      {sortedMyInventory.slice(0, myVisibleCount).map((invItem) => {
                        const isSelected = !!mySelected[invItem.item.id];
                        const price = getItemPrice(invItem.item);
                        const renderUrl = getItemRenderUrl(invItem.item);
                        const cleanName = invItem.item.name.replace(/^_+/, '');

                        return (
                          <div
                            key={invItem.item.id}
                            onClick={() => handleToggleMyItem(invItem.item.id)}
                            className={`group relative border rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer border-white/5 bg-[#0b0c13]/55 hover:bg-[#0b0c13]/85 ${isSelected ? 'border-indigo-500/30 bg-indigo-500/[0.01]' : ''}`}
                          >
                            <div className="flex items-center space-x-3.5 flex-grow min-w-0">
                              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500 text-slate-900' : 'border-white/10 bg-[#090A0F]'}`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>

                              <div className="w-10 h-10 rounded-lg bg-[#090A0F] border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {renderUrl ? (
                                  <img
                                    src={renderUrl}
                                    alt={cleanName}
                                    className="w-8 h-8 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform group-hover:scale-110 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="text-slate-600">
                                    {invItem.item.type === 'BODY_SKIN' ? (
                                      <Shield className="w-4 h-4 opacity-30" />
                                    ) : (
                                      <Layers className="w-4 h-4 opacity-30" />
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="truncate pr-2 min-w-0">
                                <span className="font-extrabold text-xs text-slate-200 block truncate uppercase tracking-wide">{cleanName}</span>
                                <span className="text-[9px] font-mono text-slate-500 uppercase block mt-0.5">x{invItem.amount} Units</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2.5 flex-shrink-0">
                              {isSelected && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center bg-[#090A0F] border border-white/10 rounded-lg overflow-hidden shadow"
                                >
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAdjustMyItemQty(invItem.item.id, false, invItem.amount); }}
                                    className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="px-2 font-mono font-bold text-xs text-white">
                                    {mySelected[invItem.item.id]}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAdjustMyItemQty(invItem.item.id, true, invItem.amount); }}
                                    className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}

                              <div className="bg-[#090A0F] border border-white/5 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 text-[11px] font-mono font-black text-slate-200 shadow-inner">
                                <img
                                  src={`${import.meta.env.BASE_URL}kirka_coin.png`}
                                  alt="coin"
                                  className="w-3.5 h-3.5 object-contain"
                                />
                                <span>{formatValue(price)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {sortedMyInventory.length === 0 && (
                        <div className="text-center py-24 text-slate-600 text-xs border border-dashed border-white/5 rounded-2xl select-none">No skins found</div>
                      )}

                      {sortedMyInventory.length > myVisibleCount && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMyVisibleCount(prev => prev + 15); }}
                          className="w-full py-3 bg-[#0b0c13] hover:bg-[#12141d] border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
                        >
                          Load More Skins
                        </button>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: Player 2 Checklist */}
                  <div className="flex flex-col min-h-0 bg-[#090A0F]/50 border border-white/5 rounded-2xl p-5">
                    <div className="flex justify-between items-center pb-3.5 border-b border-white/5 mb-4 select-none">
                      <span className="text-sm font-black uppercase text-gold-bright tracking-wider">{compareProfile.name}'s Skins</span>
                      {theirSelectedCount > 0 && (
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-gold-primary text-slate-900 font-extrabold">{theirSelectedCount} Selected</span>
                      )}
                    </div>

                    <div className="relative mb-4 select-text">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder={`Search ${compareProfile.name}'s skins...`}
                        value={theirSearchTerm}
                        onChange={(e) => setTheirSearchTerm(e.target.value)}
                        className="w-full bg-[#0b0c13] border border-obsidian-border rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold-primary/20 transition-all"
                      />
                    </div>

                    <div style={{ height: '520px', minHeight: '520px' }} className="overflow-y-auto space-y-2 pr-1 select-none">
                      {sortedTheirInventory.slice(0, theirVisibleCount).map((invItem) => {
                        const isSelected = !!theirSelected[invItem.item.id];
                        const price = getItemPrice(invItem.item);
                        const renderUrl = getItemRenderUrl(invItem.item);
                        const cleanName = invItem.item.name.replace(/^_+/, '');

                        return (
                          <div
                            key={invItem.item.id}
                            onClick={() => handleToggleTheirItem(invItem.item.id)}
                            className={`group relative border rounded-xl p-3 flex items-center justify-between transition-all cursor-pointer border-white/5 bg-[#0b0c13]/55 hover:bg-[#0b0c13]/85 ${isSelected ? 'border-gold-primary/30 bg-gold-primary/[0.01]' : ''}`}
                          >
                            <div className="flex items-center space-x-3.5 flex-grow min-w-0">
                              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isSelected ? 'border-gold-primary bg-gold-primary text-slate-900' : 'border-white/10 bg-[#090A0F]'}`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>

                              <div className="w-10 h-10 rounded-lg bg-[#090A0F] border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {renderUrl ? (
                                  <img
                                    src={renderUrl}
                                    alt={cleanName}
                                    className="w-8 h-8 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform group-hover:scale-110 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="text-slate-600">
                                    {invItem.item.type === 'BODY_SKIN' ? (
                                      <Shield className="w-4 h-4 opacity-30" />
                                    ) : (
                                      <Layers className="w-4 h-4 opacity-30" />
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="truncate pr-2 min-w-0">
                                <span className="font-extrabold text-xs text-slate-200 block truncate uppercase tracking-wide">{cleanName}</span>
                                <span className="text-[9px] font-mono text-slate-500 uppercase block mt-0.5">x{invItem.amount} Units</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2.5 flex-shrink-0">
                              {isSelected && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center bg-[#090A0F] border border-white/10 rounded-lg overflow-hidden shadow"
                                >
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAdjustTheirItemQty(invItem.item.id, false, invItem.amount); }}
                                    className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="px-2 font-mono font-bold text-xs text-white">
                                    {theirSelected[invItem.item.id]}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAdjustTheirItemQty(invItem.item.id, true, invItem.amount); }}
                                    className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}

                              <div className="bg-[#090A0F] border border-white/5 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 text-[11px] font-mono font-black text-slate-200 shadow-inner">
                                <img
                                  src={`${import.meta.env.BASE_URL}kirka_coin.png`}
                                  alt="coin"
                                  className="w-3.5 h-3.5 object-contain"
                                />
                                <span>{formatValue(price)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {sortedTheirInventory.length === 0 && (
                        <div className="text-center py-24 text-slate-600 text-xs border border-dashed border-white/5 rounded-2xl select-none">No skins found</div>
                      )}

                      {sortedTheirInventory.length > theirVisibleCount && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setTheirVisibleCount(prev => prev + 15); }}
                          className="w-full py-3 bg-[#0b0c13] hover:bg-[#12141d] border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
                        >
                          Load More Skins
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* QUICK TRADE PANEL */}
                <div className="bg-[#090A0F] border border-obsidian-border rounded-2xl p-5 space-y-3 select-none">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                    <span className="text-xs font-mono text-indigo-400 tracking-wider font-black uppercase flex items-center space-x-2">
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Quick Trade Generator</span>
                    </span>
                    {generatedTradeCommand && (
                      <button
                        onClick={handleCopyCommand}
                        className="flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                      >
                        {copySuccess ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 font-mono">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span className="font-mono">Copy Trade Command</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {generatedTradeCommand ? (
                    <div className="space-y-2 select-text">
                      <p className="text-xs text-slate-400">Copy this trade command paste it directly inside the Kirka.io game chat to create a trade offer immediately:</p>
                      <div 
                        onClick={handleCopyCommand}
                        className="bg-[#040509] border border-white/5 rounded-xl p-4 font-mono text-sm text-indigo-300 hover:text-indigo-200 break-all select-all cursor-pointer transition-colors relative group hover:border-indigo-500/25"
                        title="Click to copy to clipboard"
                      >
                        {generatedTradeCommand}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4 font-mono">
                      Select skins from Your Skins (left) and Opponent's Skins (right) to formulate a trade command.
                    </p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Reset Comparison Section bar */}
          <div className="flex justify-between items-center select-none pt-4">
            <button
              onClick={handleResetComparison}
              className="flex items-center space-x-2 bg-[#1b1c26] hover:bg-[#252838] border border-white/10 rounded-xl px-5 py-3 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <GitCompare className="w-4 h-4 text-indigo-400" />
              <span>Compare Different Players</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
