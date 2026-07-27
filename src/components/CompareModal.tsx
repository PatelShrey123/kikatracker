import React, { useState, useEffect } from 'react';
import { X, Search, GitCompare, Swords } from 'lucide-react';
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

  // Reset states when modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      setCompareType(initialType);
      setSearchQuery('');
      setCompareProfile(null);
      setCompareInventory([]);
      setError(null);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  // Resolve item price helper
  const getItemPrice = (item: any) => {
    if (!item) return 0;
    const cleanName = item.name.replace(/^_+/, '');
    const isCharacter = item.type === 'BODY_SKIN';
    const parentName = item.parent?.name || '';
    const itemTypeKey = isCharacter ? 'character' : parentName;
    
    const compositeKey = `${cleanName.toLowerCase()}_${itemTypeKey.toLowerCase()}`;
    const nameKey = cleanName.toLowerCase();

    const matched = marketPrices.get(compositeKey) || marketPrices.get(nameKey);
    return matched ? matched.baseValue : (item.salePrice || 0);
  };

  

  // Perform search and load comparison user profile/inventory
  const handleLoadCompareUser = async (idOrName: string) => {
    if (!idOrName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Determine if shortId or standard query
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

  // Compute valuations for both users
  const getNetWorth = (inv: UserInventoryItem[]) => {
    return inv.reduce((sum, current) => sum + getItemPrice(current.item) * current.amount, 0);
  };

  const getUnitCount = (inv: UserInventoryItem[]) => {
    return inv.reduce((sum, current) => sum + current.amount, 0);
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

  // Helper for comparison bars
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
          {/* Player 1 value */}
          <span className={`font-mono font-bold ${isEqual ? 'text-slate-300' : isVal1Better ? 'text-emerald-400 font-extrabold text-sm' : 'text-rose-500/80'}`}>
            {formatFn(val1)}
          </span>
          
          {/* Metric label */}
          <span className="font-mono text-[9px] tracking-wider text-slate-500 uppercase font-black">{label}</span>
          
          {/* Player 2 value */}
          <span className={`font-mono font-bold ${isEqual ? 'text-slate-300' : isVal2Better ? 'text-emerald-400 font-extrabold text-sm' : 'text-rose-500/80'}`}>
            {formatFn(val2)}
          </span>
        </div>

        {/* Dual Progress Bar */}
        <div className="h-2.5 rounded-full overflow-hidden bg-obsidian-deep border border-white/5 flex">
          <div 
            style={{ width: `${pct1}%` }} 
            className={`h-full transition-all duration-500 ${isEqual ? 'bg-indigo-500/40' : isVal1Better ? 'bg-emerald-500/80 shadow-[inset_0_1px_3px_rgba(255,255,255,0.2)]' : 'bg-rose-600/50'}`}
          />
          <div 
            style={{ width: `${pct2}%` }} 
            className={`h-full transition-all duration-500 ${isEqual ? 'bg-indigo-500/30' : isVal2Better ? 'bg-emerald-500/80 shadow-[inset_0_1px_3px_rgba(255,255,255,0.2)]' : 'bg-rose-600/50'}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background Mask overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#040509]/90 backdrop-blur-md transition-opacity"
      />

      {/* Modal Box */}
      <div className="relative max-w-2xl w-full bg-[#12141D] border border-obsidian-border rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[85vh] select-text animate-fade-in">
        
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
                <span className="text-[8px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded uppercase font-bold">LEVEL {primaryProfile.level}</span>
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
                <span className="text-[8px] font-mono text-gold-bright bg-gold-primary/10 border border-gold-primary/30 px-2 py-0.5 rounded uppercase font-bold">LEVEL {compareProfile.level}</span>
              </div>
            </div>

            {/* Inner Subtabs for toggling stats/inventory compare */}
            <div className="flex border-b border-obsidian-border bg-[#10121a] flex-shrink-0">
              <button
                onClick={() => setCompareType('stats')}
                className={`flex-1 py-3 text-xs font-bold uppercase border-b-2 text-center transition-all cursor-pointer ${compareType === 'stats' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Combat Stats Compare
              </button>
              <button
                onClick={() => setCompareType('inventory')}
                className={`flex-1 py-3 text-xs font-bold uppercase border-b-2 text-center transition-all cursor-pointer ${compareType === 'inventory' ? 'border-gold-primary text-white bg-gold-primary/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                Inventory Valuations
              </button>
            </div>

            {/* Scrollable comparison lists */}
            <div className="p-6 overflow-y-auto flex-grow space-y-2 select-text">
              {compareType === 'stats' ? (
                /* STATS VIEW */
                <div className="space-y-1">
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
                  
                  {/* Active character compare */}
                  <div className="grid grid-cols-2 gap-4 pt-5">
                    <div className="bg-obsidian-deep/50 border border-white/5 p-4 rounded-xl text-center space-y-1.5">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Active Skin ({primaryProfile.name})</span>
                      <span className="text-xs font-black text-white uppercase block line-clamp-1">{primaryProfile.activeBodySkin?.name || 'Default'}</span>
                      {primaryProfile.activeBodySkin?.rarity && (
                        <span className="text-[8px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase">{primaryProfile.activeBodySkin.rarity}</span>
                      )}
                    </div>
                    <div className="bg-obsidian-deep/50 border border-white/5 p-4 rounded-xl text-center space-y-1.5">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Active Skin ({compareProfile.name})</span>
                      <span className="text-xs font-black text-white uppercase block line-clamp-1">{compareProfile.activeBodySkin?.name || 'Default'}</span>
                      {compareProfile.activeBodySkin?.rarity && (
                        <span className="text-[8px] font-mono font-bold text-gold-bright bg-gold-primary/10 border border-gold-primary/20 px-1.5 py-0.5 rounded uppercase">{compareProfile.activeBodySkin.rarity}</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* INVENTORY VALUATION VIEW */
                <div className="space-y-4">
                  {renderComparisonRow("Net Worth (Coins)", netWorth1, netWorth2, (v) => formatValue(v))}
                  {renderComparisonRow("Total Units", units1, units2, (v) => v.toLocaleString())}
                  {renderComparisonRow("Unique Skins", primaryInventory.length, compareInventory.length, (v) => v.toString())}

                  {/* Top 5 Valued Items side-by-side */}
                  <div className="pt-4 space-y-3">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block font-black border-b border-white/5 pb-2">Top Inventory Valuations</span>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Player 1 Items */}
                      <div className="space-y-2">
                        <span className="text-[8px] font-mono text-indigo-400 font-bold block">{primaryProfile.name}'s Top Items:</span>
                        {[...primaryInventory]
                          .sort((a, b) => getItemPrice(b.item) - getItemPrice(a.item))
                          .slice(0, 5)
                          .map((inv, idx) => (
                            <div key={inv.item.id + '-' + idx} className="bg-[#0b0c13] border border-white/5 p-2 rounded-lg flex justify-between items-center text-xs">
                              <div className="truncate pr-2">
                                <span className="font-bold text-white block truncate">{inv.item.name.replace(/^_+/, '')}</span>
                                <span className="text-[8px] font-mono text-slate-500">x{inv.amount} • {inv.item.rarity || 'Common'}</span>
                              </div>
                              <span className="font-mono font-extrabold text-gold-bright text-[10px] flex-shrink-0">
                                {formatValue(getItemPrice(inv.item))}
                              </span>
                            </div>
                          ))}
                        {primaryInventory.length === 0 && (
                          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-white/5 rounded-lg">Empty Inventory</div>
                        )}
                      </div>

                      {/* Right: Player 2 Items */}
                      <div className="space-y-2">
                        <span className="text-[8px] font-mono text-gold-bright font-bold block">{compareProfile.name}'s Top Items:</span>
                        {[...compareInventory]
                          .sort((a, b) => getItemPrice(b.item) - getItemPrice(a.item))
                          .slice(0, 5)
                          .map((inv, idx) => (
                            <div key={inv.item.id + '-' + idx} className="bg-[#0b0c13] border border-white/5 p-2 rounded-lg flex justify-between items-center text-xs">
                              <div className="truncate pr-2">
                                <span className="font-bold text-white block truncate">{inv.item.name.replace(/^_+/, '')}</span>
                                <span className="text-[8px] font-mono text-slate-500">x{inv.amount} • {inv.item.rarity || 'Common'}</span>
                              </div>
                              <span className="font-mono font-extrabold text-gold-bright text-[10px] flex-shrink-0">
                                {formatValue(getItemPrice(inv.item))}
                              </span>
                            </div>
                          ))}
                        {compareInventory.length === 0 && (
                          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-white/5 rounded-lg">Empty Inventory</div>
                        )}
                      </div>
                    </div>
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
                  setSearchQuery('');
                  setError(null);
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
