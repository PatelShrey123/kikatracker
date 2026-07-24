import React from 'react';
import { X, Coins, Shield, Layers, Calendar, UserCheck, Eye, Layers3, Award } from 'lucide-react';
import type { MarketItem } from '../utils/csv';
import { formatValue } from '../utils/csv';

interface ItemInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemType?: string; // weapon parent name e.g., "SCAR", "character"
  marketPrices: Map<string, MarketItem>;
  allItemData: any[]; // Parsed from AllItemData.json
  fallbackRenders: Record<string, any>;
  inventoryAmount?: number; // if inspected from inventory
}

export const ItemInspectModal: React.FC<ItemInspectModalProps> = ({
  isOpen,
  onClose,
  itemName,
  itemType = '',
  marketPrices,
  allItemData,
  fallbackRenders,
  inventoryAmount = 1,
}) => {
  if (!isOpen) return null;

  const normalizedName = itemName.toLowerCase();
  const normalizedType = itemType.toLowerCase();

  // 1. Get pricing details from Bolt (Google Sheet)
  // Check composite key matching (e.g. delicate_m60 or delicate_character) or single name key
  const isCharacterType = normalizedType === 'character' || normalizedType === 'body_skin' || normalizedType === 'body skin';
  const itemTypeKey = isCharacterType ? 'character' : normalizedType;
  const compositeKey = `${normalizedName}_${itemTypeKey}`;
  
  const boltPriceData = marketPrices.get(compositeKey) || marketPrices.get(normalizedName);
  const boltValue = boltPriceData ? boltPriceData.baseValue : null;

  // 2. Fetch detailed metadata from AllItemData.json
  const metadata = allItemData.find((item) => {
    const matchesName = item.name.toLowerCase() === normalizedName;
    if (!matchesName) return false;

    // Check type matching
    if (isCharacterType) {
      return item.type === 'BODY_SKIN';
    } else if (normalizedType) {
      return item.parent?.name.toLowerCase() === normalizedType || item.type === 'WEAPON_SKIN';
    }
    return true;
  }) || {};

  // Resolve render URL from metadata, then fallback renders JSON, then fallback placeholder
  let renderUrl = metadata.renderUrl || null;
  if (!renderUrl) {
    const fallback = fallbackRenders[normalizedName];
    if (fallback && fallback.renderurl) {
      renderUrl = fallback.renderurl;
    } else {
      const comboKey = normalizedType ? `${normalizedName} ${normalizedType}` : normalizedName;
      const comboFallback = fallbackRenders[comboKey];
      if (comboFallback && comboFallback.renderurl) {
        renderUrl = comboFallback.renderurl;
      }
    }
  }

  // Format values safely
  const itemRarity = boltPriceData?.rarity || metadata.rarity || 'Common';
  const itemClassType = isCharacterType ? 'BODY SKIN' : (boltPriceData?.type || metadata.parent?.name || 'WEAPON SKIN');
  const isUnique = metadata.unique !== undefined ? (metadata.unique ? 'Yes' : 'No') : 'No';
  const obtainableMethod = boltPriceData?.obtainableBy || 'N/A';
  const totalOwnedCount = metadata.totalOwned !== undefined ? metadata.totalOwned : 0;
  
  const formattedCreatedDate = metadata.createdAt 
    ? new Date(metadata.createdAt).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : 'May 16, 2025'; // Default fallback date if empty

  // Helper for rarity colors matching dashboard theme
  const getRarityTextStyles = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'MYTHICAL':
      case 'MYTHIC':
        return 'text-rarity-mythic';
      case 'LEGENDARY':
        return 'text-rarity-legendary';
      case 'EPIC':
        return 'text-rarity-epic';
      case 'RARE':
        return 'text-rarity-rare';
      default:
        return 'text-slate-400';
    }
  };

  const getHeaderGradient = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'MYTHICAL':
      case 'MYTHIC':
        return 'from-[#4a1212] via-[#2f0c0c] to-[#12141D] border-b border-red-500/10';
      case 'LEGENDARY':
        return 'from-[#4a3e12] via-[#2f280c] to-[#12141D] border-b border-yellow-500/10';
      case 'EPIC':
        return 'from-[#3a124a] via-[#260c30] to-[#12141D] border-b border-purple-500/10';
      case 'RARE':
        return 'from-[#12244a] via-[#0c1830] to-[#12141D] border-b border-blue-500/10';
      default:
        return 'from-[#22252c] via-[#16181d] to-[#12141D] border-b border-slate-500/10';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#040509]/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Box */}
      <div className="relative max-w-xl w-full bg-[#12141D] border border-obsidian-border/80 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh] transition-transform select-text">
        
        {/* Top Hero Section with dynamic rarity background gradient */}
        <div className={`relative h-56 bg-gradient-to-b ${getHeaderGradient(itemRarity)} flex items-center justify-center p-6 flex-shrink-0`}>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 border border-white/10 hover:border-white/20 transition-all cursor-pointer z-20"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Render image container */}
          <div className="w-full h-full flex items-center justify-center relative pt-4">
            {renderUrl ? (
              <img
                src={renderUrl}
                alt={itemName}
                className="max-h-40 max-w-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-700 opacity-30">
                {isCharacterType ? (
                  <Shield className="w-14 h-14" />
                ) : (
                  <Layers className="w-14 h-14" />
                )}
                <span className="text-[10px] font-mono uppercase tracking-widest mt-1">No Image Render</span>
              </div>
            )}
          </div>
        </div>

        {/* Item Title */}
        <div className="text-center py-4 border-b border-obsidian-border/50 bg-[#0e1017]">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider font-sans leading-none">
            {itemName}
          </h2>
        </div>

        {/* Details Grid & Market Panel - Scrollable if content overflows */}
        <div className="p-6 space-y-6 overflow-y-auto min-h-0 flex-1">
          {/* Information Cards Grid */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* TYPE Card */}
            <div className="bg-[#1b191c]/30 border border-obsidian-border/40 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block leading-none mb-1">TYPE</span>
                <span className="text-xs font-black text-white uppercase block leading-none">{itemClassType}</span>
              </div>
            </div>

            {/* RARITY Card */}
            <div className="bg-[#1b191c]/30 border border-obsidian-border/40 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2 bg-gold-primary/10 rounded-lg text-gold-bright">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block leading-none mb-1">RARITY</span>
                <span className={`text-xs font-black uppercase block leading-none ${getRarityTextStyles(itemRarity)}`}>
                  {itemRarity}
                </span>
              </div>
            </div>

            {/* UNIQUE Card */}
            <div className="bg-[#1b191c]/30 border border-obsidian-border/40 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2 bg-[#ff5e00]/10 rounded-lg text-[#ff5e00]">
                <Layers3 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block leading-none mb-1">UNIQUE</span>
                <span className="text-xs font-black text-white uppercase block leading-none">{isUnique}</span>
              </div>
            </div>

            {/* OBTAINABLE BY Card */}
            <div className="bg-[#1b191c]/30 border border-obsidian-border/40 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2 bg-[#00ffcc]/10 rounded-lg text-[#00ffcc]">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block leading-none mb-1">OBTAINABLE BY</span>
                <span className="text-xs font-black text-white uppercase block leading-none">{obtainableMethod}</span>
              </div>
            </div>

            {/* TOTAL OWNED Card */}
            <div className="bg-[#1b191c]/30 border border-obsidian-border/40 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block leading-none mb-1">TOTAL OWNED</span>
                <span className="text-xs font-black text-white block leading-none">{totalOwnedCount.toLocaleString()}</span>
              </div>
            </div>

            {/* CREATED Card */}
            <div className="bg-[#1b191c]/30 border border-obsidian-border/40 p-4 rounded-xl flex items-center space-x-3.5 col-span-2 md:col-span-1">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block leading-none mb-1">CREATED</span>
                <span className="text-xs font-black text-white block leading-none">{formattedCreatedDate}</span>
              </div>
            </div>

          </div>

          {/* Market Data full-width box */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-mono text-slate-500 tracking-widest uppercase block border-b border-obsidian-border/40 pb-2">
              MARKET DATA
            </h4>
            
            <div className="bg-[#090A0F] border border-obsidian-border/60 rounded-xl p-4.5 space-y-3 font-mono text-xs text-slate-400">
              {/* Bolt Value Row */}
              <div className="flex justify-between items-center">
                <span>BOLT VALUE:</span>
                <div className="flex items-center space-x-1.5 text-gold-bright font-black text-sm">
                  <Coins className="w-4 h-4 text-gold-primary" />
                  <span>{boltValue !== null ? formatValue(boltValue) : '—'}</span>
                  {boltValue !== null && <span className="w-1.5 h-1.5 rounded-full bg-gold-primary animate-pulse ml-0.5" />}
                </div>
              </div>

              {/* Units Row */}
              <div className="flex justify-between items-center pt-2.5 border-t border-white/5">
                <span>UNITS:</span>
                <span className="font-bold text-slate-200">{inventoryAmount}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
