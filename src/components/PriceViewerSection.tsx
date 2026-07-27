import React, { useState, useMemo } from 'react';
import { Search, Tag, Sparkles, SlidersHorizontal, RefreshCw } from 'lucide-react';
import type { MarketItem } from '../utils/csv';

interface PriceViewerSectionProps {
  marketPrices: Map<string, MarketItem>;
  publicItems: any[];
  fallbackRenders: Record<string, any>;
  onInspectItem?: (name: string, type: string) => void;
}

export const PriceViewerSection: React.FC<PriceViewerSectionProps> = ({
  marketPrices,
  publicItems,
  fallbackRenders,
  onInspectItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Parse and cache unique items from Bolt marketPrices map
  const uniqueItems = useMemo(() => {
    // Collect all values to get the unique set of MarketItem objects
    const items = Array.from(new Set(marketPrices.values()));
    // Sort by price descending
    return items.sort((a, b) => b.baseValue - a.baseValue);
  }, [marketPrices]);

  // Extract all unique rarity values
  const rarities = useMemo(() => {
    const set = new Set<string>();
    uniqueItems.forEach(item => {
      if (item.rarity) set.add(item.rarity.toUpperCase());
    });
    return Array.from(set);
  }, [uniqueItems]);

  // Extract all unique types
  const types = useMemo(() => {
    const set = new Set<string>();
    uniqueItems.forEach(item => {
      if (item.type) set.add(item.type.toUpperCase());
    });
    return Array.from(set);
  }, [uniqueItems]);

  // Filter items based on search query, rarity, and type
  const filteredItems = useMemo(() => {
    return uniqueItems.filter(item => {
      const matchSearch = item.skinName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.obtainableBy && item.obtainableBy.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchRarity = selectedRarity === 'ALL' || item.rarity?.toUpperCase() === selectedRarity;
      const matchType = selectedType === 'ALL' || item.type?.toUpperCase() === selectedType;

      return matchSearch && matchRarity && matchType;
    });
  }, [uniqueItems, searchTerm, selectedRarity, selectedType]);

  const getRarityStyles = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'MYTHICAL':
      case 'MYTHIC':
        return 'border-rarity-mythic text-rarity-mythic shadow-mythic bg-rarity-mythic/5';
      case 'LEGENDARY':
        return 'border-rarity-legendary text-rarity-legendary shadow-legendary bg-rarity-legendary/5';
      case 'EPIC':
        return 'border-rarity-epic text-rarity-epic shadow-epic bg-rarity-epic/5';
      case 'RARE':
        return 'border-rarity-rare text-rarity-rare shadow-rare bg-rarity-rare/5';
      default:
        return 'border-rarity-common/30 text-slate-400 shadow-common bg-rarity-common/5';
    }
  };

  const getRarityBadgeColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'MYTHICAL':
      case 'MYTHIC':
        return 'bg-rarity-mythic/10 text-rarity-mythic border-rarity-mythic/25';
      case 'LEGENDARY':
        return 'bg-rarity-legendary/10 text-rarity-legendary border-rarity-legendary/25';
      case 'EPIC':
        return 'bg-rarity-epic/10 text-rarity-epic border-rarity-epic/25';
      case 'RARE':
        return 'bg-rarity-rare/10 text-rarity-rare border-rarity-rare/25';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
    }
  };

  // Helper to format with spaces
  const formatWithSpaces = (num: number | string) => {
    if (num === undefined || num === null) return '0';
    const str = num.toString().replace(/[^0-9.]/g, '');
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  };

  const getProxiedImageUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('http://localhost') || url.includes(window.location.host)) {
      return url;
    }
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  };

  // Helper to resolve skin image render URL
  const getItemRenderUrl = (item: MarketItem) => {
    // Try fallback renders map first
    const nameKey = item.skinName.toLowerCase();
    const fallback = fallbackRenders[nameKey];
    if (fallback && fallback.renderurl) return fallback.renderurl;

    if (item.type) {
      const comboKey = `${item.skinName.toLowerCase()} ${item.type.toLowerCase()}`;
      const comboFallback = fallbackRenders[comboKey];
      if (comboFallback && comboFallback.renderurl) return comboFallback.renderurl;
    }
    
    // Find in publicItems list
    const matched = publicItems.find(
      (p) =>
        p.name.toLowerCase() === item.skinName.toLowerCase() &&
        p.type.toLowerCase() === item.type.toLowerCase()
    );
    return matched ? matched.renderUrl : null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 select-text animate-fade-in">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-obsidian-border/50 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 mb-1">
            <Tag className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase">Pricing Database</span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Item Price Viewer</h2>
          <p className="text-xs text-slate-400 font-medium">Search and browse current market valuations synchronized from Bolt Pricing.</p>
        </div>
        <div className="flex items-center space-x-2 bg-obsidian-card/60 border border-obsidian-border/80 px-4 py-2.5 rounded-xl text-xs text-slate-400 font-mono self-start md:self-auto">
          <RefreshCw className="w-3.5 h-3.5 text-gold-primary animate-pulse" />
          <span>Sync Status: <strong className="text-emerald-400">Online</strong></span>
        </div>
      </div>

      {/* Search and Filters Panel */}
      <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items by name or origin..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#12141f] border border-obsidian-border rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-gold-primary/45 focus:shadow-gold-glow transition-all"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Rarity filter dropdown */}
            <div className="flex items-center space-x-2 bg-[#12141f] border border-obsidian-border rounded-xl px-3 py-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-300 outline-none border-0 ring-0 cursor-pointer uppercase font-mono"
              >
                <option value="ALL" className="bg-[#12141f]">All Rarities</option>
                {rarities.map(rarity => (
                  <option key={rarity} value={rarity} className="bg-[#12141f]">{rarity}</option>
                ))}
              </select>
            </div>

            {/* Type filter dropdown */}
            <div className="flex items-center space-x-2 bg-[#12141f] border border-obsidian-border rounded-xl px-3 py-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-300 outline-none border-0 ring-0 cursor-pointer uppercase font-mono"
              >
                <option value="ALL" className="bg-[#12141f]">All Types</option>
                {types.map(t => (
                  <option key={t} value={t} className="bg-[#12141f]">{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-24 bg-obsidian-card border border-obsidian-border rounded-2xl text-slate-500 text-sm">
          No pricing values match your search query.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item, index) => {
            const rarityStyles = getRarityStyles(item.rarity);
            const renderUrl = getItemRenderUrl(item);

            return (
              <div
                key={item.skinName + '-' + item.type + '-' + index}
                onClick={() => onInspectItem?.(item.skinName, item.type)}
                className={`relative flex flex-col justify-between bg-gradient-to-b from-[#161824] to-[#0c0d13] border rounded-2xl p-4 transition-all duration-300 hover:scale-[1.03] select-none hover:shadow-lg cursor-pointer ${rarityStyles.split(' ')[0]}`}
              >
                {/* Rarity Border Highlight */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                {/* Top Info */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${getRarityBadgeColor(item.rarity)}`}>
                    {item.rarity || 'Common'}
                  </span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                    {item.type || 'Skin'}
                  </span>
                </div>

                {/* 3D Skin Render */}
                <div className="h-28 flex items-center justify-center relative my-2">
                  {renderUrl ? (
                    <img
                      src={getProxiedImageUrl(renderUrl)}
                      alt={item.skinName}
                      className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] hover:rotate-6 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-obsidian-deep/50 border border-white/5 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Bottom Stats */}
                <div className="space-y-2.5 pt-2.5 border-t border-white/5">
                  <div className="text-center">
                    <span className="text-xs font-black text-white uppercase tracking-wide line-clamp-1">
                      {item.skinName}
                    </span>
                    {item.obtainableBy && (
                      <span className="text-[8px] text-slate-500 font-mono block mt-0.5 max-w-full truncate uppercase">
                        {item.obtainableBy}
                      </span>
                    )}
                  </div>

                  {/* Valuation badge */}
                  <div className="bg-[#04050a]/90 border border-white/5 rounded-xl px-2 py-2 flex items-center justify-center space-x-1.5">
                    <img
                      src={`${import.meta.env.BASE_URL}kirka_coin.png`}
                      alt="Coins"
                      className="w-3.5 h-3.5 object-contain filter drop-shadow-[0_0_2px_rgba(212,175,55,0.3)]"
                    />
                    <span className="text-xs font-mono font-bold text-gold-bright">
                      {formatWithSpaces(item.baseValue)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
