import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, GitCompare, Swords, Copy, Check, Plus, Minus, ArrowRightLeft } from 'lucide-react';
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

  // Pagination states for both inventories to avoid any rendering lag
  const [myVisibleCount, setMyVisibleCount] = useState(15);
  const [theirVisibleCount, setTheirVisibleCount] = useState(15);

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
      setMyVisibleCount(15);
      setTheirVisibleCount(15);
      setError(null);
      setCopySuccess(false);
    }
  }, [isOpen, initialType]);

  // Reset visible counts when typing search query
  useEffect(() => {
    setMyVisibleCount(15);
    setTheirVisibleCount(15);
  }, [itemSearchTerm]);

  

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
      const match = primaryInventory.find(i => i.item.id === id);
      if (match) {
        const cleanName = match.item.name.replace(/^_+/, '');
        myOffers.push(`${cleanName}x${qty}`);
      }
    });

    // Parse their offers
    Object.entries(theirSelected).forEach(([id, qty]) => {
      const match = compareInventory.find(i => i.item.id === id);
      if (match) {
        const cleanName = match.item.name.replace(/^_+/, '');
        theirOffers.push(`${cleanName}x${qty}`);
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

  const getRarityBadgeColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'MYTHICAL':
      case 'MYTHIC':
        return 'bg-rarity-mythic/10 text-rarity-mythic border-rarity-mythic/20';
      case 'LEGENDARY':
        return 'bg-rarity-legendary/10 text-rarity-legendary border-rarity-legendary/20';
      case 'EPIC':
        return 'bg-rarity-epic/10 text-rarity-epic border-rarity-epic/20';
      case 'RARE':
        return 'bg-rarity-rare/10 text-rarity-rare border-rarity-rare/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background Mask overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#040509]/90 backdrop-blur-md transition-opacity"
      />

      {/* Modal Box */}
      <div className="relative max-w-4xl w-full bg-[#12141D] border border-obsidian-border rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh] select-text animate-fade-in">
        
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
                /* INVENTORY VALUATION VIEW (Searchable, selectable side-by-side) */
                <div className="flex-grow flex flex-col min-h-0 space-y-4">
                  {/* Top Stats summary row */}
                  <div className="grid grid-cols-3 gap-3 border-b border-white/5 pb-4 select-none">
                    <div className="bg-[#090A0F]/80 p-2.5 rounded-xl border border-white/5 text-center">
                      <span className="text-slate-500 text-[8px] font-mono uppercase block">Metric</span>
                      <span className="text-[10px] text-slate-300 font-bold block mt-1.5 uppercase font-mono">Net Worth</span>
                      <span className="text-[10px] text-slate-300 font-bold block mt-1.5 uppercase font-mono">Total Units</span>
                      <span className="text-[10px] text-slate-300 font-bold block mt-1.5 uppercase font-mono">Unique Types</span>
                    </div>

                    <div className="bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-500/10 text-center">
                      <span className="text-indigo-400 text-[8px] font-mono uppercase block">{primaryProfile.name}</span>
                      <span className="text-[10px] text-emerald-400 font-black block mt-1.5 font-mono">{formatValue(netWorth1)}</span>
                      <span className="text-[10px] text-slate-200 font-bold block mt-1.5 font-mono">{units1.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-200 font-bold block mt-1.5 font-mono">{primaryInventory.length}</span>
                    </div>

                    <div className="bg-gold-primary/5 p-2.5 rounded-xl border border-gold-primary/10 text-center">
                      <span className="text-gold-bright text-[8px] font-mono uppercase block">{compareProfile.name}</span>
                      <span className="text-[10px] text-emerald-400 font-black block mt-1.5 font-mono">{formatValue(netWorth2)}</span>
                      <span className="text-[10px] text-slate-200 font-bold block mt-1.5 font-mono">{units2.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-200 font-bold block mt-1.5 font-mono">{compareInventory.length}</span>
                    </div>
                  </div>

                  {/* Search box for filtering items */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search and filter skins in both inventories..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="w-full bg-[#0b0c13] border border-obsidian-border rounded-xl pl-11 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold-primary/20 transition-all"
                    />
                  </div>

                  {/* Dual Grid lists side by side */}
                  <div className="grid grid-cols-2 gap-4 flex-grow overflow-hidden min-h-0">
                    
                    {/* Left: My inventory selection grid */}
                    <div className="flex flex-col min-h-0 border border-white/5 bg-[#090A0F]/30 rounded-2xl p-3">
                      <span className="text-[8px] font-mono text-indigo-400 uppercase tracking-widest font-black block pb-2 border-b border-white/5 mb-2 select-none">
                        Your Items ({sortedMyInventory.length} matched)
                      </span>
                      <div className="flex-grow overflow-y-auto space-y-2 pr-1 min-h-0">
                        {sortedMyInventory.slice(0, myVisibleCount).map((invItem) => {
                          const isSelected = !!mySelected[invItem.item.id];
                          const price = getItemPrice(invItem.item);
                          const cleanName = invItem.item.name.replace(/^_+/, '');

                          return (
                            <div
                              key={invItem.item.id}
                              className={`group relative border rounded-xl p-2.5 flex items-center justify-between text-xs transition-all cursor-pointer select-none ${isSelected ? 'border-indigo-500 bg-indigo-950/20 shadow-sm' : 'border-white/5 bg-[#0b0c13] hover:border-white/10'}`}
                            >
                              <div 
                                onClick={() => handleToggleMyItem(invItem.item.id)}
                                className="flex-grow pr-2 min-w-0"
                              >
                                <div className="flex items-center space-x-1.5">
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                                  <span className="font-extrabold text-slate-200 block truncate uppercase">{cleanName}</span>
                                </div>
                                <span className={`inline-block text-[7px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border mt-1 ${getRarityBadgeColor(invItem.item.rarity)}`}>
                                  {invItem.item.rarity || 'Common'}
                                </span>
                                <span className="text-[8px] font-mono text-slate-500 ml-1.5">Price: <strong className="text-gold-bright">{formatValue(price)}</strong></span>
                              </div>

                              <div className="flex flex-col items-end space-y-1.5">
                                <span className="text-[9px] font-mono font-bold text-slate-400">Own: x{invItem.amount}</span>
                                
                                {/* Quantity Adjuster overlay when selected */}
                                {isSelected ? (
                                  <div className="flex items-center bg-[#090A0F] border border-indigo-500/35 rounded-lg overflow-hidden">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAdjustMyItemQty(invItem.item.id, false, invItem.amount); }}
                                      className="p-1 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="px-2 font-mono font-bold text-[10px] text-white">
                                      {mySelected[invItem.item.id]}
                                    </span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAdjustMyItemQty(invItem.item.id, true, invItem.amount); }}
                                      className="p-1 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleToggleMyItem(invItem.item.id)}
                                    className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg p-1 transition-all cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {sortedMyInventory.length === 0 && (
                          <div className="text-center py-16 text-slate-600 text-xs border border-dashed border-white/5 rounded-2xl select-none">No skins found</div>
                        )}
                        {sortedMyInventory.length > myVisibleCount && (
                          <button
                            onClick={() => setMyVisibleCount(prev => prev + 15)}
                            className="w-full py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
                          >
                            Load More
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: Their inventory selection grid */}
                    <div className="flex flex-col min-h-0 border border-white/5 bg-[#090A0F]/30 rounded-2xl p-3">
                      <span className="text-[8px] font-mono text-gold-bright uppercase tracking-widest font-black block pb-2 border-b border-white/5 mb-2 select-none">
                        {compareProfile.name}'s Items ({sortedTheirInventory.length} matched)
                      </span>
                      <div className="flex-grow overflow-y-auto space-y-2 pr-1 min-h-0">
                        {sortedTheirInventory.slice(0, theirVisibleCount).map((invItem) => {
                          const isSelected = !!theirSelected[invItem.item.id];
                          const price = getItemPrice(invItem.item);
                          const cleanName = invItem.item.name.replace(/^_+/, '');

                          return (
                            <div
                              key={invItem.item.id}
                              className={`group relative border rounded-xl p-2.5 flex items-center justify-between text-xs transition-all cursor-pointer select-none ${isSelected ? 'border-gold-primary bg-gold-primary/10 shadow-sm' : 'border-white/5 bg-[#0b0c13] hover:border-white/10'}`}
                            >
                              <div 
                                onClick={() => handleToggleTheirItem(invItem.item.id)}
                                className="flex-grow pr-2 min-w-0"
                              >
                                <div className="flex items-center space-x-1.5">
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-gold-primary" />}
                                  <span className="font-extrabold text-slate-200 block truncate uppercase">{cleanName}</span>
                                </div>
                                <span className={`inline-block text-[7px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border mt-1 ${getRarityBadgeColor(invItem.item.rarity)}`}>
                                  {invItem.item.rarity || 'Common'}
                                </span>
                                <span className="text-[8px] font-mono text-slate-500 ml-1.5">Price: <strong className="text-gold-bright">{formatValue(price)}</strong></span>
                              </div>

                              <div className="flex flex-col items-end space-y-1.5">
                                <span className="text-[9px] font-mono font-bold text-slate-400">Own: x{invItem.amount}</span>
                                
                                {isSelected ? (
                                  <div className="flex items-center bg-[#090A0F] border border-gold-primary/35 rounded-lg overflow-hidden">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAdjustTheirItemQty(invItem.item.id, false, invItem.amount); }}
                                      className="p-1 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                      <Minus className="w-2.5 h-2.5" />
                                    </button>
                                    <span className="px-2 font-mono font-bold text-[10px] text-white">
                                      {theirSelected[invItem.item.id]}
                                    </span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAdjustTheirItemQty(invItem.item.id, true, invItem.amount); }}
                                      className="p-1 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleToggleTheirItem(invItem.item.id)}
                                    className="bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-bright border border-gold-primary/30 rounded-lg p-1 transition-all cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {sortedTheirInventory.length === 0 && (
                          <div className="text-center py-16 text-slate-600 text-xs border border-dashed border-white/5 rounded-2xl select-none">No skins found</div>
                        )}
                        {sortedTheirInventory.length > theirVisibleCount && (
                          <button
                            onClick={() => setTheirVisibleCount(prev => prev + 15)}
                            className="w-full py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer select-none"
                          >
                            Load More
                          </button>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* QUICK TRADE PANEL (Renders when items selected) */}
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
                        Select skins from Your Items (left) and Opponent's Items (right) to formulate a trade command.
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
