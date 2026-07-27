import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, GitCompare, Swords, Copy, Check, Plus, Minus, ArrowRightLeft, Shield, Layers } from 'lucide-react';
import { fetchUserProfile, fetchUserInventory } from '../utils/api';
import type { UserProfile, UserInventoryItem } from '../utils/api';
import type { MarketItem } from '../utils/csv';
import { formatValue } from '../utils/csv';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryProfile: UserProfile;
  primaryInventory: UserInventoryItem[];
  marketPrices: Map<string, MarketItem>;
  fallbackRenders: Record<string, any>;
  publicItems: any[];
  allItemData: any[];
  initialType: 'stats' | 'inventory';
}

const QUICK_COMPARE_PROFILES = [
  { name: 'shadow', shortId: 'HESHPY' },
  { name: 'Hisoka', shortId: 'S2WVOK' },
  { name: 'Bot#0', shortId: '9VECSU' }
];

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  primaryProfile,
  primaryInventory,
  marketPrices,
  fallbackRenders,
  publicItems,
  initialType,
}) => {
  const [compareType, setCompareType] = useState<'stats' | 'inventory'>(initialType);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Stored comparison user data
  const [compareProfile, setCompareProfile] = useState<UserProfile | null>(null);
  const [compareInventory, setCompareInventory] = useState<UserInventoryItem[]>([]);

  // Selection states for Quick Trade Offer
  const [mySelected, setMySelected] = useState<Record<string, number>>({}); // id -> quantity
  const [theirSelected, setTheirSelected] = useState<Record<string, number>>({}); // id -> quantity

  // Search filter inside comparison view
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  // active inventory view tab: 'mine' or 'theirs'
  const [activeInventoryTab, setActiveInventoryTab] = useState<'mine' | 'theirs'>('mine');

  // Pagination states to avoid rendering lag
  const [visibleCount, setVisibleCount] = useState(15);

  const [copySuccess, setCopySuccess] = useState(false);

  // Reset states when modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      setCompareType(initialType);
      setSearchQuery('');
      setCompareProfile(null);
      setCompareInventory([]);
      setMySelected({});
      setTheirSelected({});
      setItemSearchTerm('');
      setActiveInventoryTab('mine');
      setVisibleCount(15);
      setError(null);
      setCopySuccess(false);
    }
  }, [isOpen, initialType]);

  // Reset visible counts when typing or changing tabs
  useEffect(() => {
    setVisibleCount(15);
  }, [itemSearchTerm, activeInventoryTab]);

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

  // Perform search and load comparison user profile/inventory
  const handleLoadCompareUser = async (idOrName: string) => {
    if (!idOrName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const isShortId = idOrName.trim().length === 6 && /^[A-Z0-9]+$/i.test(idOrName.trim());
      const profileResult = await fetchUserProfile(idOrName.trim(), isShortId);
      
      if (!profileResult) {
        setError('Player profile not found. Please double check the ID.');
        setLoading(false);
        return;
      }

      // Fetch inventory
      const inventoryResult = await fetchUserInventory(profileResult.id);
      
      setCompareProfile(profileResult);
      setCompareInventory(inventoryResult || []);
    } catch (err: any) {
      setError('An error occurred while fetching player data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getNetWorth = (inv: UserInventoryItem[]) => {
    if (!Array.isArray(inv)) return 0;
    return inv.reduce((sum, current) => sum + (current && current.item ? getItemPrice(current.item) * (current.amount || 0) : 0), 0);
  };

  const getUnitCount = (inv: UserInventoryItem[]) => {
    if (!Array.isArray(inv)) return 0;
    return inv.reduce((sum, current) => sum + (current ? (current.amount || 0) : 0), 0);
  };

  // Metrics extraction helpers
  const stats1 = primaryProfile.stats || { kills: 0, deaths: 0, wins: 0, games: 0, headshots: 0, scores: 0 };
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

  // Filtered inventory lists (descending order of price)
  const sortedMyInventory = useMemo(() => {
    if (!Array.isArray(primaryInventory)) return [];
    return [...primaryInventory]
      .filter(i => i && i.item && i.item.name)
      .sort((a, b) => getItemPrice(b.item) - getItemPrice(a.item))
      .filter(i => i.item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()));
  }, [primaryInventory, itemSearchTerm]);

  const sortedTheirInventory = useMemo(() => {
    if (!Array.isArray(compareInventory)) return [];
    return [...compareInventory]
      .filter(i => i && i.item && i.item.name)
      .sort((a, b) => getItemPrice(b.item) - getItemPrice(a.item))
      .filter(i => i.item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()));
  }, [compareInventory, itemSearchTerm]);

  // Click selectors for items
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

  // Generate trade offer command syntax
  const generatedTradeCommand = useMemo(() => {
    if (!compareProfile) return '';

    const myOffers: string[] = [];
    const theirOffers: string[] = [];

    // Parse my offers
    Object.entries(mySelected).forEach(([id, qty]) => {
      const match = primaryInventory.find(i => i && i.item && i.item.id === id);
      if (match && match.item && match.item.name) {
        const cleanName = match.item.name.replace(/^_+/, '');
        // Omit "x1" suffix if quantity is 1
        const qtyStr = qty > 1 ? `x${qty}` : '';
        myOffers.push(`${cleanName}${qtyStr}`);
      }
    });

    // Parse their offers
    Object.entries(theirSelected).forEach(([id, qty]) => {
      const match = compareInventory.find(i => i && i.item && i.item.id === id);
      if (match && match.item && match.item.name) {
        const cleanName = match.item.name.replace(/^_+/, '');
        // Omit "x1" suffix if quantity is 1
        const qtyStr = qty > 1 ? `x${qty}` : '';
        theirOffers.push(`${cleanName}${qtyStr}`);
      }
    });

    if (myOffers.length === 0 && theirOffers.length === 0) return '';

    const opponentId = compareProfile.shortId || compareProfile.id;
    const myPart = myOffers.length > 0 ? ` my:${myOffers.join(',')}` : '';
    const yourPart = theirOffers.length > 0 ? ` your:${theirOffers.join(',')}` : '';

    return `/trade offer #${opponentId}${myPart}${yourPart}`;
  }, [compareProfile, mySelected, theirSelected, primaryInventory, compareInventory]);

  // Copy command code to clipboard
  const handleCopyCommand = () => {
    if (!generatedTradeCommand) return;
    navigator.clipboard.writeText(generatedTradeCommand)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => console.error('Failed to copy trade offer command:', err));
  };

  

  const renderComparisonRow = (label: string, val1: number, val2: number, formatFn: (v: number) => string, higherIsBetter = true) => {
    const total = val1 + val2;
    const pct1 = total > 0 ? (val1 / total) * 100 : 50;
    const pct2 = total > 0 ? (val2 / total) * 100 : 50;

    const isVal1Better = higherIsBetter ? val1 > val2 : val1 < val2;
    const isVal2Better = higherIsBetter ? val2 > val1 : val2 < val1;
    const isEqual = val1 === val2;

    return (
      <div className="space-y-2 py-4 border-b border-white/5">
        <div className="flex justify-between items-center text-xs">
          <span className={`font-mono font-bold ${isEqual ? 'text-slate-300' : isVal1Better ? 'text-emerald-400 font-extrabold text-sm' : 'text-rose-500/80'}`}>
            {formatFn(val1)}
          </span>
          <span className="font-mono text-[9px] tracking-wider text-slate-500 uppercase font-black">{label}</span>
          <span className={`font-mono font-bold ${isEqual ? 'text-slate-300' : isVal2Better ? 'text-emerald-400 font-extrabold text-sm' : 'text-rose-500/80'}`}>
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

  if (!isOpen) return null;

  // Selected counts
  const mySelectedCount = Object.keys(mySelected).length;
  const theirSelectedCount = Object.keys(theirSelected).length;

  // Select items list based on inventory tab choice
  const activeItemsList = activeInventoryTab === 'mine' ? sortedMyInventory : sortedTheirInventory;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background Mask overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#040509]/90 backdrop-blur-md transition-opacity"
      />

      {/* Modal Box */}
      <div className="relative max-w-2xl w-full bg-[#12141D] border border-obsidian-border rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh] select-text animate-fade-in">
        
        {/* Header Block */}
        <div className="p-6 border-b border-obsidian-border/50 bg-[#0b0c13] flex justify-between items-center flex-shrink-0">
          <div className="flex items-center space-x-2 text-indigo-400">
            <GitCompare className="w-5 h-5" />
            <h3 className="text-base font-black text-white uppercase tracking-wider">Compare Arena</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-full p-2 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Search vs Comparison Display Container */}
        {!compareProfile ? (
          /* SEARCH STATE SCREEN */
          <div className="p-8 space-y-6 overflow-y-auto">
            <div className="text-center space-y-2 max-w-md mx-auto">
              <Swords className="w-10 h-10 text-indigo-400 mx-auto animate-bounce" />
              <h4 className="text-md font-bold text-white uppercase">Choose opponent to compare</h4>
              <p className="text-xs text-slate-400">Compare combat statistics and inventory net worth details side-by-side with {primaryProfile.name}.</p>
            </div>

            {/* Input Search Block */}
            <div className="max-w-md mx-auto space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Player ID or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadCompareUser(searchQuery)}
                  className="w-full bg-[#090A0F] border border-obsidian-border rounded-xl pl-11 pr-24 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-gold-primary/30 transition-all"
                  autoFocus
                />
                <button
                  disabled={loading || !searchQuery.trim()}
                  onClick={() => handleLoadCompareUser(searchQuery)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching...' : 'Compare'}
                </button>
              </div>

              {error && (
                <div className="text-[10px] font-mono text-rose-500 bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg text-center">
                  {error}
                </div>
              )}
            </div>

            {/* Quick Compare list */}
            <div className="max-w-md mx-auto space-y-3 pt-4 border-t border-white/5">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block font-bold text-center">Quick Compare Options</span>
              <div className="grid grid-cols-3 gap-2.5">
                {QUICK_COMPARE_PROFILES.map((p) => (
                  <button
                    key={p.shortId}
                    disabled={loading}
                    onClick={() => handleLoadCompareUser(p.shortId)}
                    className="bg-[#161825] hover:bg-[#1f2235] border border-white/5 rounded-xl py-2 px-3 text-center transition-all cursor-pointer group hover:scale-105 active:scale-95"
                  >
                    <span className="text-xs font-bold text-slate-300 group-hover:text-gold-bright transition-colors block truncate">{p.name}</span>
                    <span className="text-[8px] font-mono text-slate-500 tracking-wider block mt-0.5">{p.shortId}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* COMPARISON RESULTS SCREEN */
          <div className="flex-grow flex flex-col overflow-hidden min-h-0">
            {/* Split Opponents Header Card */}
            <div className="bg-[#0b0c13] border-b border-obsidian-border/50 p-5 grid grid-cols-3 items-center flex-shrink-0 text-center select-none">
              {/* Primary User info */}
              <div className="space-y-1">
                <span className="text-sm font-black text-white uppercase tracking-wider">{primaryProfile.name}</span>
                {primaryProfile.clan && (
                  <span className="text-[9px] font-mono font-bold text-indigo-400 block">CLAN: {primaryProfile.clan}</span>
                )}
                <span className="inline-block text-[8px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded uppercase font-bold mt-1">LEVEL {primaryProfile.level}</span>
              </div>

              {/* VS Badge */}
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#1b1c26] to-[#0c0d13] border border-white/10 flex items-center justify-center shadow-lg">
                  <span className="text-xs font-mono font-black text-gold-bright">VS</span>
                </div>
              </div>

              {/* Compare User info */}
              <div className="space-y-1">
                <span className="text-sm font-black text-white uppercase tracking-wider">{compareProfile.name}</span>
                {compareProfile.clan && (
                  <span className="text-[9px] font-mono font-bold text-gold-bright block">CLAN: {compareProfile.clan}</span>
                )}
                <span className="inline-block text-[8px] font-mono text-gold-bright bg-gold-primary/10 border border-gold-primary/30 px-2 py-0.5 rounded uppercase font-bold mt-1">LEVEL {compareProfile.level}</span>
              </div>
            </div>

            {/* Inner Subtabs for toggling stats/inventory compare */}
            <div className="flex border-b border-obsidian-border bg-[#10121a] flex-shrink-0">
              <button
                onClick={() => setCompareType('stats')}
                className={`flex-1 py-3.5 text-xs font-bold uppercase border-b-2 text-center transition-all cursor-pointer ${compareType === 'stats' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Combat Stats Compare
              </button>
              <button
                onClick={() => setCompareType('inventory')}
                className={`flex-1 py-3.5 text-xs font-bold uppercase border-b-2 text-center transition-all cursor-pointer ${compareType === 'inventory' ? 'border-gold-primary text-white bg-gold-primary/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Inventory Valuations
              </button>
            </div>

            {/* Scrollable comparison lists */}
            <div className="p-6 overflow-y-auto flex-grow flex flex-col min-h-0">
              {compareType === 'stats' ? (
                /* STATS VIEW */
                <div className="space-y-1 pr-1">
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
                  
                  {/* Detailed active skin matches */}
                  <div className="grid grid-cols-2 gap-4 pt-6">
                    <div className="bg-[#0b0c13] border border-white/5 p-4 rounded-xl space-y-2.5">
                      <span className="text-[8px] font-mono text-indigo-400 font-bold block uppercase tracking-widest border-b border-white/5 pb-1">{primaryProfile.name}'s Combat Loadout</span>
                      <div className="space-y-1 text-xs">
                        <span className="text-slate-500 font-mono text-[9px] block">CHARACTER SKIN</span>
                        <span className="font-extrabold text-slate-200 block uppercase truncate">{primaryProfile.activeBodySkin?.name || 'Default'}</span>
                      </div>
                      <div className="space-y-1 text-xs pt-1 border-t border-white/5">
                        <span className="text-slate-500 font-mono text-[9px] block">WEAPON SKIN</span>
                        <span className="font-extrabold text-slate-200 block uppercase truncate">{primaryProfile.activeWeapon1Skin?.name || 'Default'}</span>
                      </div>
                    </div>

                    <div className="bg-[#0b0c13] border border-white/5 p-4 rounded-xl space-y-2.5">
                      <span className="text-[8px] font-mono text-gold-bright font-bold block uppercase tracking-widest border-b border-white/5 pb-1">{compareProfile.name}'s Combat Loadout</span>
                      <div className="space-y-1 text-xs">
                        <span className="text-slate-500 font-mono text-[9px] block">CHARACTER SKIN</span>
                        <span className="font-extrabold text-slate-200 block uppercase truncate">{compareProfile.activeBodySkin?.name || 'Default'}</span>
                      </div>
                      <div className="space-y-1 text-xs pt-1 border-t border-white/5">
                        <span className="text-slate-500 font-mono text-[9px] block">WEAPON SKIN</span>
                        <span className="font-extrabold text-slate-200 block uppercase truncate">{compareProfile.activeWeapon1Skin?.name || 'Default'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* INVENTORY VALUATION VIEW (Unified select, matching user screenshot) */
                <div className="flex-grow flex flex-col min-h-0 space-y-4">
                  {/* Top Stats summary row */}
                  <div className="grid grid-cols-3 gap-3 border-b border-white/5 pb-4 select-none">
                    <div className="bg-[#090A0F]/80 p-2 text-center rounded-lg">
                      <span className="text-slate-500 text-[8px] font-mono uppercase block">Metric</span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-1 uppercase font-mono">Net Worth</span>
                      <span className="text-[9px] text-slate-400 font-bold block mt-1 uppercase font-mono">Total Units</span>
                    </div>

                    <div className="bg-indigo-950/10 p-2 rounded-lg border border-indigo-500/10 text-center">
                      <span className="text-indigo-400 text-[8px] font-mono uppercase block">{primaryProfile.name}</span>
                      <span className="text-[10px] text-emerald-400 font-black block mt-1 font-mono">{formatValue(netWorth1)}</span>
                      <span className="text-[10px] text-slate-200 font-bold block mt-1 font-mono">{units1.toLocaleString()}</span>
                    </div>

                    <div className="bg-gold-primary/5 p-2 rounded-lg border border-gold-primary/10 text-center">
                      <span className="text-gold-bright text-[8px] font-mono uppercase block">{compareProfile.name}</span>
                      <span className="text-[10px] text-emerald-400 font-black block mt-1 font-mono">{formatValue(netWorth2)}</span>
                      <span className="text-[10px] text-slate-200 font-bold block mt-1 font-mono">{units2.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Horizontal Tabs to choose whose inventory to browse */}
                  <div className="flex bg-[#0b0c13] p-1 rounded-xl border border-white/5 select-none">
                    <button
                      onClick={() => setActiveInventoryTab('mine')}
                      className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${activeInventoryTab === 'mine' ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Your Skins {mySelectedCount > 0 && <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-500 text-white font-extrabold">{mySelectedCount}</span>}
                    </button>
                    <button
                      onClick={() => setActiveInventoryTab('theirs')}
                      className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all cursor-pointer ${activeInventoryTab === 'theirs' ? 'bg-gold-primary/15 text-gold-bright border border-gold-primary/20' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {compareProfile.name}'s Skins {theirSelectedCount > 0 && <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gold-primary text-white font-extrabold">{theirSelectedCount}</span>}
                    </button>
                  </div>

                  {/* Search box for filtering items */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={`Search ${activeInventoryTab === 'mine' ? 'your' : compareProfile.name + "'s"} inventory...`}
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="w-full bg-[#0b0c13] border border-obsidian-border rounded-xl pl-11 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold-primary/20 transition-all"
                    />
                  </div>

                  {/* Spacious single list of items (Matching User Customization screenshot layout) */}
                  <div className="flex-grow overflow-y-auto space-y-2 pr-1 min-h-0">
                    {activeItemsList.slice(0, visibleCount).map((invItem) => {
                      const isSelected = activeInventoryTab === 'mine' ? !!mySelected[invItem.item.id] : !!theirSelected[invItem.item.id];
                      const price = getItemPrice(invItem.item);
                      const renderUrl = getItemRenderUrl(invItem.item);
                      const cleanName = invItem.item.name.replace(/^_+/, '');

                      return (
                        <div
                          key={invItem.item.id}
                          className={`group relative border rounded-2xl p-4 flex items-center justify-between transition-all select-none border-white/5 bg-[#0b0c13]/55 hover:bg-[#0b0c13]/85 ${isSelected ? 'shadow-[0_0_12px_rgba(212,175,55,0.05)] border-gold-primary/30 bg-gold-primary/[0.02]' : ''}`}
                        >
                          <div className="flex items-center space-x-4 flex-grow min-w-0">
                            {/* Checkbox Box */}
                            <button
                              onClick={() => activeInventoryTab === 'mine' ? handleToggleMyItem(invItem.item.id) : handleToggleTheirItem(invItem.item.id)}
                              className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${isSelected ? 'border-gold-primary bg-gold-primary text-slate-900' : 'border-white/10 bg-[#090A0F] hover:border-white/20'}`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>

                            {/* Render Preview Box */}
                            <div className="w-12 h-12 rounded-xl bg-[#090A0F] border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0 select-none">
                              {renderUrl ? (
                                <img
                                  src={renderUrl}
                                  alt={cleanName}
                                  className="w-10 h-10 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transform group-hover:scale-110 transition-transform duration-300"
                                />
                              ) : (
                                <div className="text-slate-600">
                                  {invItem.item.type === 'BODY_SKIN' ? (
                                    <Shield className="w-5 h-5 opacity-30" />
                                  ) : (
                                    <Layers className="w-5 h-5 opacity-30" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Skin Info */}
                            <div className="truncate pr-4 min-w-0">
                              <span 
                                onClick={() => activeInventoryTab === 'mine' ? handleToggleMyItem(invItem.item.id) : handleToggleTheirItem(invItem.item.id)}
                                className="font-extrabold text-sm text-slate-200 block truncate uppercase tracking-wide cursor-pointer hover:text-gold-bright transition-colors"
                              >
                                {cleanName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mt-0.5">x{invItem.amount} Units</span>
                            </div>
                          </div>

                          {/* Right Side: Quantity selectors and Price badge */}
                          <div className="flex items-center space-x-4 flex-shrink-0">
                            {/* Quantity Adjustment Overlay when checked */}
                            {isSelected && (
                              <div className="flex items-center bg-[#090A0F] border border-white/10 rounded-xl overflow-hidden shadow-md animate-fade-in">
                                <button
                                  onClick={() => activeInventoryTab === 'mine' ? handleAdjustMyItemQty(invItem.item.id, false, invItem.amount) : handleAdjustTheirItemQty(invItem.item.id, false, invItem.amount)}
                                  className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-3.5 font-mono font-bold text-xs text-white">
                                  {activeInventoryTab === 'mine' ? mySelected[invItem.item.id] : theirSelected[invItem.item.id]}
                                </span>
                                <button
                                  onClick={() => activeInventoryTab === 'mine' ? handleAdjustMyItemQty(invItem.item.id, true, invItem.amount) : handleAdjustTheirItemQty(invItem.item.id, true, invItem.amount)}
                                  className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* Price Badge Bubble */}
                            <div className="bg-[#090A0F] border border-white/5 px-4.5 py-2.5 rounded-2xl flex items-center space-x-2 text-xs font-mono font-black text-slate-100 shadow-inner">
                              <img
                                src="kirka_coin.png"
                                alt="coin"
                                className="w-3.5 h-3.5 object-contain filter drop-shadow-[0_0_2px_rgba(212,175,55,0.3)]"
                              />
                              <span className="text-slate-200">{formatValue(price)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {activeItemsList.length === 0 && (
                      <div className="text-center py-20 text-slate-500 text-xs border border-dashed border-white/5 rounded-3xl select-none">
                        No skins found matching search query.
                      </div>
                    )}

                    {activeItemsList.length > visibleCount && (
                      <button
                        onClick={() => setVisibleCount(prev => prev + 15)}
                        className="w-full py-3 bg-[#0b0c13] hover:bg-[#12141d] border border-white/5 rounded-2xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
                      >
                        Load More Skins
                      </button>
                    )}
                  </div>

                  {/* QUICK TRADE PANEL (Renders trade commands) */}
                  <div className="bg-[#0b0c13] border border-obsidian-border rounded-2xl p-4 space-y-3 flex-shrink-0 select-none">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-[10px] font-mono text-indigo-400 tracking-wider font-black uppercase flex items-center space-x-1.5">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Quick Trade Generator</span>
                      </span>
                      {generatedTradeCommand && (
                        <button
                          onClick={handleCopyCommand}
                          className="flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                        >
                          {copySuccess ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-mono">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="font-mono">Copy Trade Command</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {generatedTradeCommand ? (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-400">Copy this trade command paste it directly inside the Kirka.io game chat to create a trade offer immediately:</p>
                        <div 
                          onClick={handleCopyCommand}
                          className="bg-[#040509] border border-white/5 rounded-xl p-3.5 font-mono text-xs text-indigo-300 hover:text-indigo-200 break-all select-all cursor-pointer transition-colors relative group hover:border-indigo-500/20"
                          title="Click to copy to clipboard"
                        >
                          {generatedTradeCommand}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-2 font-mono">
                        Select skins from Your Skins or Opponent's Skins above to formulate a trade command.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons to reset and choose another player */}
            <div className="bg-[#0b0c13] p-4.5 border-t border-obsidian-border/50 flex justify-between items-center flex-shrink-0">
              <button
                onClick={() => {
                  setCompareProfile(null);
                  setCompareInventory([]);
                  setMySelected({});
                  setTheirSelected({});
                  setItemSearchTerm('');
                  setSearchQuery('');
                  setError(null);
                  setCopySuccess(false);
                }}
                className="flex items-center space-x-1.5 bg-[#1b1c26] hover:bg-[#252838] border border-white/10 rounded-xl px-4.5 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <GitCompare className="w-4 h-4 text-indigo-400" />
                <span>Compare Another Player</span>
              </button>

              <button
                onClick={onClose}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:shadow-indigo-glow text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
