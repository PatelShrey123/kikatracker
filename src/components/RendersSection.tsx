import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Box,
  Palette,
  Eye,
} from 'lucide-react';
import { Weapon3DViewer, isCharacterSkin, getSkinRenderUrl, cleanTextureUrl, isPlaceholderUrl } from './Weapon3DViewer';
import type { MarketItem } from '../utils/csv';
import { getCachedCatalog, setCachedCatalog, clearCachedCatalog, resolveItemCreator } from '../utils/catalogCache';

interface RendersSectionProps {
  publicItems: any[];
  marketPrices: Map<string, MarketItem>;
  fallbackRenders: Record<string, any>;
  allItemData?: any[];
}

const WEAPON_CATEGORIES = [
  'ALL',
  'CHARACTERS',
  'SCAR',
  'VITA',
  'Shark',
  'AR-9',
  'LAR',
  'M60',
  'MAC-10',
  'Revolver',
  'Bayonet',
  'Tomahawk',
  'Weatie',
];

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string; ring: string }> = {
  MYTHICAL: { border: 'border-red-500/60', bg: 'bg-red-500/10', text: 'text-red-400', glow: 'rgba(239, 68, 68, 0.4)', ring: 'ring-red-500/40' },
  MYTHIC: { border: 'border-red-500/60', bg: 'bg-red-500/10', text: 'text-red-400', glow: 'rgba(239, 68, 68, 0.4)', ring: 'ring-red-500/40' },
  LEGENDARY: { border: 'border-amber-500/60', bg: 'bg-amber-500/10', text: 'text-amber-400', glow: 'rgba(245, 158, 11, 0.4)', ring: 'ring-amber-500/40' },
  EPIC: { border: 'border-purple-500/60', bg: 'bg-purple-500/10', text: 'text-purple-400', glow: 'rgba(168, 85, 247, 0.4)', ring: 'ring-purple-500/40' },
  RARE: { border: 'border-cyan-500/60', bg: 'bg-cyan-500/10', text: 'text-cyan-400', glow: 'rgba(6, 182, 212, 0.4)', ring: 'ring-cyan-500/40' },
  COMMON: { border: 'border-slate-500/40', bg: 'bg-slate-500/10', text: 'text-slate-400', glow: 'rgba(100, 116, 139, 0.2)', ring: 'ring-slate-500/30' },
  PARANORMAL: { border: 'border-emerald-500/60', bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: 'rgba(16, 185, 129, 0.4)', ring: 'ring-emerald-500/40' },
};

const DEFAULT_RARITY = RARITY_COLORS.COMMON;

export const RendersSection: React.FC<RendersSectionProps> = ({
  publicItems = [],
  marketPrices = new Map(),
  fallbackRenders = {},
  allItemData = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedRarity, setSelectedRarity] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(24);
  const [cachedItems, setCachedItems] = useState<any[]>([]);
  const [isCachedSource, setIsCachedSource] = useState(false);

  // Full-Screen 3D Maximizer / Theater State
  const [maximizedItem, setMaximizedItem] = useState<any | null>(null);
  const [maximizedIndex, setMaximizedIndex] = useState<number>(-1);

  // 1. Sync & Cache Catalog in Browser Storage
  useEffect(() => {
    if (publicItems && publicItems.length > 0) {
      setCachedCatalog(publicItems);
      setCachedItems(publicItems);
      setIsCachedSource(false);
    } else {
      const fromCache = getCachedCatalog();
      if (fromCache && fromCache.length > 0) {
        setCachedItems(fromCache);
        setIsCachedSource(true);
      }
    }
  }, [publicItems]);

  const activeCatalog = useMemo(() => {
    if (publicItems && publicItems.length > 0) return publicItems;
    if (cachedItems && cachedItems.length > 0) return cachedItems;
    if (allItemData && allItemData.length > 0) return allItemData;
    return [];
  }, [publicItems, cachedItems, allItemData]);

  // Merge items into unique list by name + type
  const mergedItems = useMemo(() => {
    const map = new Map<string, any>();

    activeCatalog.forEach((item) => {
      if (item && item.name) {
        const cleanName = item.name.replace(/^_+/, '').trim().toLowerCase();
        const parentName = (item.parent?.name || item.type || '').toLowerCase();
        const key = `${cleanName}_${parentName}`;
        map.set(key, item);
      }
    });

    // Also include items from marketPrices if missing
    marketPrices.forEach((mp) => {
      const cleanName = mp.skinName.replace(/^_+/, '').trim().toLowerCase();
      const parentName = (mp.type || '').toLowerCase();
      const key = `${cleanName}_${parentName}`;
      if (!map.has(key)) {
        map.set(key, {
          name: mp.skinName,
          rarity: mp.rarity || 'COMMON',
          type: mp.type === 'CHARACTER' ? 'BODY_SKIN' : 'WEAPON_SKIN',
          parent: { name: mp.type },
          renderUrl: null,
          textureUrl: null,
          salePrice: mp.baseValue || 0,
        });
      }
    });

    return Array.from(map.values());
  }, [activeCatalog, marketPrices]);

  // Filter items
  const filteredItems = useMemo(() => {
    let list = mergedItems;

    // Filter by category
    if (selectedCategory === 'CHARACTERS') {
      list = list.filter((i) => i.type === 'BODY_SKIN' || !i.parent?.name || i.parent?.name === 'CHARACTER');
    } else if (selectedCategory !== 'ALL') {
      list = list.filter(
        (i) => i.parent?.name?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Filter by rarity
    if (selectedRarity !== 'ALL') {
      list = list.filter((i) => i.rarity?.toUpperCase() === selectedRarity.toUpperCase());
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.parent?.name?.toLowerCase().includes(q) ||
          i.rarity?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [mergedItems, selectedCategory, selectedRarity, searchTerm]);

  const pagedItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  // Helper to resolve textureUrl for an item
  const resolveTextureUrl = useCallback(
    (item: any): string | null => {
      if (!item) return null;
      const cleanName = item.name ? item.name.replace(/^_+/, '').trim() : '';
      if (item.textureUrl && !item.textureUrl.endsWith('kirka.io') && !item.textureUrl.includes('render-mini')) {
        return cleanTextureUrl(item.textureUrl);
      }
      const cleanLower = cleanName.toLowerCase();
      const fb = fallbackRenders[cleanLower];
      if (fb && (fb.textureUrl || fb.textureurl)) {
        return cleanTextureUrl(fb.textureUrl || fb.textureurl);
      }
      if (cleanName) {
        return `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(cleanName)}`;
      }
      return null;
    },
    [fallbackRenders]
  );

  // Helper to resolve renderUrl for preview image with api2.kirka.io 3D fallback
  const resolveRenderUrl = useCallback(
    (item: any): string | null => {
      if (!item) return null;
      return getSkinRenderUrl(item);
    },
    []
  );

  // Open Maximizer for an item
  const handleOpenMaximizer = (item: any, index: number) => {
    setMaximizedItem(item);
    setMaximizedIndex(index);
  };

  const handleCloseMaximizer = () => {
    setMaximizedItem(null);
    setMaximizedIndex(-1);
  };

  // Navigate Previous / Next in Theater mode
  const handlePrevSkin = () => {
    if (filteredItems.length === 0) return;
    const nextIdx = (maximizedIndex - 1 + filteredItems.length) % filteredItems.length;
    setMaximizedIndex(nextIdx);
    setMaximizedItem(filteredItems[nextIdx]);
  };

  const handleNextSkin = () => {
    if (filteredItems.length === 0) return;
    const nextIdx = (maximizedIndex + 1) % filteredItems.length;
    setMaximizedIndex(nextIdx);
    setMaximizedItem(filteredItems[nextIdx]);
  };

  // Keyboard navigation for theater mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!maximizedItem) return;
      if (e.key === 'Escape') handleCloseMaximizer();
      if (e.key === 'ArrowLeft') handlePrevSkin();
      if (e.key === 'ArrowRight') handleNextSkin();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [maximizedItem, maximizedIndex, filteredItems]);

  const handleClearCache = () => {
    clearCachedCatalog();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 flex flex-col pt-1 pb-16 px-4 sm:px-8 max-w-[1700px] mx-auto select-none">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white flex items-center space-x-2.5">
              <span>3D RENDERS SHOWCASE</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold uppercase tracking-wider">
              3D CINEMATIC
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Explore high-definition 3D renders of all Kirka weapon and character skins. Click any skin to launch the full-screen 3D theater with slow rotation.
          </p>
        </div>

        {/* Cache status badge & refresh button */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-[10px] font-mono text-slate-400 shadow-inner">
            <span className={`w-1.5 h-1.5 rounded-full ${isCachedSource ? 'bg-emerald-400' : 'bg-cyan-400'} animate-pulse`} />
            <span>{isCachedSource ? 'Browser Cache Active (0ms)' : 'Live API Sync'}</span>
          </div>

          <button
            onClick={handleClearCache}
            title="Refresh skin cache from API"
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-400 hover:text-white cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-obsidian-card/80 p-4 rounded-2xl border border-white/10 flex flex-col space-y-3 mb-6 shadow-xl">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {WEAPON_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setVisibleCount(24);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.35)]'
                  : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat === 'CHARACTERS' ? '👤 Characters' : cat}
            </button>
          ))}
        </div>

        {/* Search Bar & Rarity Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
          <div className="flex items-center bg-black/50 border border-white/10 rounded-xl px-3 py-2 w-full sm:w-80 focus-within:border-cyan-400 transition-all shadow-inner">
            <Search className="w-4 h-4 text-slate-400 mr-2.5" />
            <input
              type="text"
              placeholder="Search skins by name (e.g. Neo2, Sterling)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(24);
              }}
              className="bg-transparent text-xs font-mono text-slate-100 outline-none w-full placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Rarity:</span>
            <select
              value={selectedRarity}
              onChange={(e) => {
                setSelectedRarity(e.target.value);
                setVisibleCount(24);
              }}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none cursor-pointer hover:border-white/20 transition-all"
            >
              <option value="ALL">All Rarities</option>
              <option value="MYTHICAL">Mythical (Red)</option>
              <option value="LEGENDARY">Legendary (Gold)</option>
              <option value="EPIC">Epic (Purple)</option>
              <option value="RARE">Rare (Blue)</option>
              <option value="COMMON">Common (Slate)</option>
            </select>

            <span className="text-[11px] font-mono text-slate-500 ml-2 hidden sm:inline">
              Showing <strong className="text-white">{filteredItems.length}</strong> 3D skins
            </span>
          </div>
        </div>
      </div>

      {/* 3D Showcase Grid (Big, Crisp Showcase Cards) */}
      {pagedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-slate-500 space-y-3 bg-obsidian-card/40 rounded-2xl border border-white/10">
          <Palette className="w-10 h-10 opacity-40 text-cyan-400" />
          <p className="text-sm font-mono">No matching 3D skins found for your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {pagedItems.map((item, idx) => {
            const rarityStyle = RARITY_COLORS[item.rarity?.toUpperCase()] || DEFAULT_RARITY;
            const isChar = isCharacterSkin(item.parent?.name || item.type);
            const weaponType = isChar ? 'CHARACTER' : item.parent?.name || item.type || 'SCAR';
            const renderUrl = resolveRenderUrl(item);

            // Bolt Price valuation
            const marketItem = marketPrices.get(item.name?.toLowerCase());
            const boltValue = marketItem?.baseValue || item.salePrice || 0;

            const creatorName = resolveItemCreator(item);

            return (
              <div
                key={`${item.name}-${weaponType}-${idx}`}
                onClick={() => handleOpenMaximizer(item, idx)}
                className={`group relative rounded-2xl border ${rarityStyle.border} bg-gradient-to-b from-[#0e121a]/90 to-[#07090e]/95 p-4 flex flex-col justify-between transition-all duration-300 hover:scale-102 hover:shadow-2xl cursor-pointer overflow-hidden backdrop-blur-sm`}
                style={{
                  boxShadow: `0 4px 20px -2px ${rarityStyle.glow}`,
                }}
              >
                {/* Top Card Header */}
                <div className="flex items-center justify-between w-full z-10">
                  <div className="flex flex-col min-w-0 flex-1 pr-2">
                    <span className="text-sm font-mono font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 mt-0.5 truncate" title={`Creator: ${creatorName}`}>
                      {weaponType} • <span className="text-slate-300 font-semibold">{creatorName}</span>
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${rarityStyle.border} ${rarityStyle.bg} ${rarityStyle.text}`}
                  >
                    {item.rarity}
                  </span>
                </div>

                {/* Card Center: Big High-Res Render Preview */}
                <div className="my-5 h-36 sm:h-40 flex items-center justify-center relative overflow-hidden">
                  {renderUrl ? (
                    <img
                      src={renderUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] group-hover:scale-115 transition-transform duration-500 ease-out"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.triedTexture && item.textureUrl && !isPlaceholderUrl(item.textureUrl)) {
                          target.dataset.triedTexture = 'true';
                          target.src = item.textureUrl;
                        } else if (!target.dataset.fallback) {
                          target.dataset.fallback = 'true';
                          target.src = `${import.meta.env.BASE_URL}render-mini.webp`;
                        }
                      }}
                    />
                  ) : (
                    <Box className="w-12 h-12 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  )}

                  {/* Hover "Launch 3D Theater" overlay pill */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-opacity duration-300 flex items-center justify-center">
                    <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-cyan-500 text-black font-mono font-bold text-xs shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Launch 3D Theater</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Info */}
                <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs font-mono z-10">
                  <div className="flex items-center space-x-1 text-gold-bright font-bold">
                    {boltValue > 0 ? (
                      <>
                        <span className="text-amber-400">⚡</span>
                        <span>{boltValue.toLocaleString()} Bolts</span>
                      </>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Market Valuation Index</span>
                    )}
                  </div>

                  <span className="flex items-center space-x-1 text-cyan-400 text-[10px] font-bold group-hover:underline">
                    <Eye className="w-3 h-3" />
                    <span>View 3D</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Pagination */}
      {visibleCount < filteredItems.length && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 24)}
            className="px-8 py-3 rounded-xl bg-white/5 border border-white/15 hover:border-cyan-400/40 text-xs font-mono font-bold text-slate-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-lg"
          >
            Load More Skins ({filteredItems.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FULL-SCREEN / FULL-PAGE 3D THEATER MAXIMIZER OVERLAY */}
      {/* ===================================================================== */}
      {maximizedItem && (
        <div className="fixed inset-0 z-50 bg-[#04060a]/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
          {/* Top Theater Header Bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/60 z-20 flex-shrink-0">
            {/* Left: Skin Details */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black tracking-wider text-white">
                  {maximizedItem.name}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                    (RARITY_COLORS[maximizedItem.rarity?.toUpperCase()] || DEFAULT_RARITY).border
                  } ${(RARITY_COLORS[maximizedItem.rarity?.toUpperCase()] || DEFAULT_RARITY).bg} ${
                    (RARITY_COLORS[maximizedItem.rarity?.toUpperCase()] || DEFAULT_RARITY).text
                  }`}
                >
                  {maximizedItem.rarity}
                </span>
              </div>

              <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                • {isCharacterSkin(maximizedItem.parent?.name || maximizedItem.type) ? 'Character' : maximizedItem.parent?.name || maximizedItem.type}
              </span>

              <span className="text-xs font-mono text-cyan-300/90 hidden sm:inline px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                Creator: <span className="font-bold text-white">{resolveItemCreator(maximizedItem)}</span>
              </span>
            </div>

            {/* Center: Prev / Next Navigation Arrows */}
            <div className="flex items-center space-x-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={handlePrevSkin}
                title="Previous Skin (Left Arrow Key)"
                className="px-3 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all text-xs font-mono flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <span className="text-[10px] font-mono text-slate-500 px-2">
                {maximizedIndex + 1} / {filteredItems.length}
              </span>
              <button
                onClick={handleNextSkin}
                title="Next Skin (Right Arrow Key)"
                className="px-3 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all text-xs font-mono flex items-center space-x-1 cursor-pointer"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Close Fullscreen Button */}
            <button
              onClick={handleCloseMaximizer}
              title="Close Theater (Esc)"
              className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-400 transition-all cursor-pointer border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Viewport: Full-Page 3D Interactive Canvas */}
          <div className="flex-grow relative w-full h-full overflow-hidden flex items-center justify-center">
            <Weapon3DViewer
              weaponType={
                isCharacterSkin(maximizedItem.parent?.name || maximizedItem.type)
                  ? 'CHARACTER'
                  : maximizedItem.parent?.name || maximizedItem.type || 'SCAR'
              }
              textureUrl={resolveTextureUrl(maximizedItem)}
              className="w-full h-full min-h-[500px]"
              autoRotateDefault={true}
            />
          </div>

          {/* Bottom Theater Footer Hints */}
          <div className="px-6 py-3 border-t border-white/10 bg-black/60 flex items-center justify-between text-xs font-mono text-slate-400 z-20 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1.5 text-cyan-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>3D Cinematic Rotation Active</span>
              </span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-600 sm:hidden">|</span>
              <span className="text-slate-300 sm:hidden">Creator: <span className="text-white font-bold">{resolveItemCreator(maximizedItem)}</span></span>
              <span className="hidden sm:inline">Use Left/Right arrow keys to step through skins</span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-slate-500">Press ESC to exit</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};