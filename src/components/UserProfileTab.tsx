import React, { useEffect, useState } from 'react';
import { ArrowLeft, Target, Sparkles, Database, Shield, Layers, Award, Camera, GitCompare } from 'lucide-react';
import type { UserProfile, UserInventoryItem } from '../utils/api';
import { FitViewer } from './FitViewer';
import { fetchUserInventory, fetchAllPublicItems } from '../utils/api';
import type { MarketItem } from '../utils/csv';
import { formatValue } from '../utils/csv';
import { cropMinecraftHead } from '../utils/skinCropper';
import { ShareInventoryModal } from './ShareInventoryModal';
interface UserProfileTabProps {
  profile: UserProfile;
  onBack: () => void;
  marketPrices: Map<string, MarketItem>;
  onSelectClan: (clanName: string) => void;
  fallbackRenders: Record<string, any>;
  onInspectItem: (name: string, type?: string, amount?: number) => void;
  allItemData: any[];
  onCompare: (id: string, type: 'stats' | 'inventory') => void;
}

export const UserProfileTab: React.FC<UserProfileTabProps> = ({ 
  profile, 
  onBack, 
  marketPrices, 
  onSelectClan,
  fallbackRenders,
  onInspectItem,
  allItemData,
  onCompare
}) => {
  const [profileTab, setProfileTab] = useState<'stats' | 'inventory' | 'fit'>('stats');
  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [publicItems, setPublicItems] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [croppedHeadUrl, setCroppedHeadUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Sync inventory & public items
  useEffect(() => {
    setLoadingInventory(true);
    fetchUserInventory(profile.id)
      .then((data) => setInventory(data))
      .catch((err) => console.error('Failed to load inventory:', err))
      .finally(() => setLoadingInventory(false));

    fetchAllPublicItems()
      .then((data) => {
        if (Array.isArray(data)) setPublicItems(data);
      })
      .catch((err) => console.error('Failed to load public items database:', err));
  }, [profile.id]);

  // Crop equipped character skin texture to display head face
  useEffect(() => {
    setCroppedHeadUrl(null);
    if (profile.activeBodySkin) {
      let texture = profile.activeBodySkin.textureUrl;
      if (!texture && allItemData && Array.isArray(allItemData)) {
        // Look up texture in the allItemData repository JSON
        const nameKey = profile.activeBodySkin.name.toLowerCase();
        const matched = allItemData.find(
          (i) => i.name.toLowerCase() === nameKey && i.type === 'BODY_SKIN'
        );
        if (matched) texture = matched.textureUrl;
      }

      if (texture) {
        cropMinecraftHead(texture)
          .then((headUrl) => setCroppedHeadUrl(headUrl))
          .catch((err) => console.error('Failed to crop profile head texture:', err));
      }
    }
  }, [profile.activeBodySkin, allItemData]);

  // Helper to map item to market price
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

  // Helper to resolve skin image render URL
  const getItemRenderUrl = (item: any) => {
    if (!item) return null;
    if (item.renderUrl) return item.renderUrl;

    // Check fallback renders map
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

  // Compute total valuation
  const totalValuation = inventory.reduce((sum, current) => {
    const price = getItemPrice(current.item);
    return sum + price * current.amount;
  }, 0);

  // Helper to get rarity border/shadow classes
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

  const formatRating = (val?: number) => {
    return val !== undefined && val !== null ? val.toFixed(2) : '—';
  };

  const rawKills = profile.stats?.kills || 0;
  const rawDeaths = profile.stats?.deaths || 0;
  const rawWins = profile.stats?.wins || 0;
  const rawGames = profile.stats?.games || 0;
  const rawHeadshots = profile.stats?.headshots || 0;
  const rawScore = profile.stats?.scores || 0;

  const kd = rawDeaths > 0 ? (rawKills / rawDeaths).toFixed(2) : rawKills.toFixed(2);
  const winRate = rawGames > 0 ? ((rawWins / rawGames) * 100).toFixed(1) + '%' : '0%';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 select-text">
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-slate-400 hover:text-gold-bright transition-colors font-mono text-sm cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Search</span>
      </button>

      {/* Profile Header Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-obsidian-card to-[#161925] border border-obsidian-border rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Subtle background glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-gold-primary/5 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="flex items-center space-x-6">
          {/* Square Avatar Column (displays cropped head/face!) */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative w-20 h-20 bg-obsidian-dark border border-gold-primary/20 rounded-xl flex items-center justify-center p-1.5 shadow-gold-glow overflow-hidden">
              {croppedHeadUrl ? (
                <img
                  src={croppedHeadUrl}
                  alt={profile.activeBodySkin?.name}
                  className="w-14 h-14 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                />
              ) : (
                /* Blocky Pixel head fallback */
                <svg viewBox="0 0 8 8" className="w-14 h-14 text-slate-500 fill-current">
                  <rect width="8" height="8" rx="0" fill="#4b5563" />
                  <rect x="1" y="1" width="6" height="5" fill="#9ca3af" />
                  <rect x="2" y="4" width="1" height="1" fill="#000" />
                  <rect x="5" y="4" width="1" height="1" fill="#000" />
                </svg>
              )}
            </div>
            <span className="text-[11px] font-black font-mono text-slate-300">
              #{profile.shortId}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gold-bright uppercase tracking-widest bg-gold-primary/10 border border-gold-primary/30 px-2.5 py-0.5 rounded w-fit block font-mono">
              {profile.role}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{profile.name}</h2>
            
            <div className="flex flex-col space-y-0.5 text-xs text-slate-400 font-mono">
              <div className="flex items-center space-x-2">
                <span>joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                {profile.clan && (
                  <>
                    <span className="text-slate-600">•</span>
                    <button
                      onClick={() => onSelectClan(profile.clan!)}
                      className="flex items-center space-x-1.5 text-gold-bright hover:text-gold-primary font-bold uppercase tracking-wider transition-colors hover:underline cursor-pointer"
                    >
                      <img src={`${import.meta.env.BASE_URL}clan_registry.png`} alt="Clan Registry" className="w-3.5 h-3.5 rounded-sm object-contain filter drop-shadow-[0_0_2px_rgba(212,175,55,0.4)]" />
                      <span>[{profile.clan}]</span>
                    </button>
                  </>
                )}
              </div>
              <span className="text-[10px] text-slate-500">UUID: {profile.id}</span>
            </div>
            {profile.bio && <p className="text-sm text-slate-400 italic max-w-md pt-1">"{profile.bio}"</p>}
          </div>
        </div>

        {/* Quick KLO / Stats Card */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-[#090A0F]/85 border border-obsidian-border p-4 rounded-xl">
          <div className="text-center px-4 border-r border-obsidian-border/50">
            <span className="text-[10px] text-slate-500 tracking-wider font-mono uppercase block">S&D Rating</span>
            <span className="text-lg font-bold text-white block mt-0.5">{profile.kloSAD ? profile.kloSAD.toFixed(1) : '—'}</span>
          </div>
          <div className="text-center px-4 border-r border-obsidian-border/50">
            <span className="text-[10px] text-slate-500 tracking-wider font-mono uppercase block">K/D Ratio</span>
            <span className="text-lg font-bold text-gold-bright block mt-0.5">{kd}</span>
          </div>
          <div className="text-center px-4">
            <span className="text-[10px] text-slate-500 tracking-wider font-mono uppercase block">Win Rate</span>
            <span className="text-lg font-bold text-white block mt-0.5">{winRate}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-obsidian-border gap-3 sm:gap-0">
        <div className="flex">
          <button
            onClick={() => setProfileTab('stats')}
            className={`flex items-center space-x-2 px-6 py-3.5 text-sm font-semibold tracking-wider uppercase border-b-2 transition-all duration-300 ${
              profileTab === 'stats'
                ? 'border-gold-primary text-gold-bright bg-gold-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-obsidian-card/20'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Stats & Loadout</span>
          </button>
          <button
            onClick={() => setProfileTab('inventory')}
            className={`flex items-center space-x-2 px-6 py-3.5 text-sm font-semibold tracking-wider uppercase border-b-2 transition-all duration-300 ${
              profileTab === 'inventory'
                ? 'border-gold-primary text-gold-bright bg-gold-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-obsidian-card/20'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Inventory Valuation</span>
          </button>
          <button
            onClick={() => setProfileTab('fit')}
            className={`flex items-center space-x-2 px-6 py-3.5 text-sm font-semibold tracking-wider uppercase border-b-2 transition-all duration-300 ${
              profileTab === 'fit'
                ? 'border-gold-primary text-gold-bright bg-gold-primary/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-obsidian-card/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3D Fit Viewer</span>
          </button>
        </div>

        {/* Compare Profile Buttons aligned right */}
        <div className="px-4 pb-2.5 sm:pb-0">
          {profileTab === 'inventory' ? (
            <button
              onClick={() => onCompare(profile.id, 'inventory')}
              className="flex items-center space-x-1.5 bg-[#1b1c26]/60 hover:bg-[#252838]/80 border border-gold-primary/25 px-4.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.97]"
            >
              <GitCompare className="w-3.5 h-3.5 text-gold-primary" />
              <span>Compare Inventory</span>
            </button>
          ) : (
            <button
              onClick={() => onCompare(profile.id, 'stats')}
              className="flex items-center space-x-1.5 bg-[#1b1c26]/60 hover:bg-[#252838]/80 border border-indigo-500/25 px-4.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.97]"
            >
              <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Compare Stats</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Contents */}
      <div>
        {profileTab === 'stats' ? (
          <div className="space-y-10">
            {/* 1. Equipped Loadout Cards */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono text-slate-500 tracking-widest uppercase flex items-center space-x-2 border-b border-obsidian-border/50 pb-3">
                <Shield className="w-4 h-4 text-gold-primary" />
                <span>Active Combat Loadout</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Character skin card */}
                <div 
                  onClick={() => {
                    if (profile.activeBodySkin) {
                      onInspectItem(profile.activeBodySkin.name, 'character', 1);
                    }
                  }}
                  className="card-interactive bg-[#0b0c13] border border-obsidian-border/80 p-5 rounded-2xl flex flex-col justify-between min-h-[220px] cursor-pointer hover:border-gold-primary/30 hover:shadow-gold-glow group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Character Slot</span>
                      {profile.activeBodySkin ? (
                        <div>
                          <span className={`inline-block text-[8px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${getRarityStyles(profile.activeBodySkin.rarity).split(' ')[0]} ${getRarityStyles(profile.activeBodySkin.rarity).split(' ')[2]}`}>
                            {profile.activeBodySkin.rarity}
                          </span>
                          <h4 className="text-lg font-extrabold text-white mt-2 leading-none group-hover:text-gold-bright transition-colors">{profile.activeBodySkin.name}</h4>
                        </div>
                      ) : (
                        <h4 className="text-base font-bold text-slate-600 mt-2">No Character Equipped</h4>
                      )}
                    </div>
                    {profile.activeBodySkin && (
                      <span className="text-[9px] font-mono text-slate-500 uppercase bg-[#161825] px-2 py-1 rounded border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">Inspect</span>
                    )}
                  </div>

                  <div className="w-full h-24 flex items-center justify-center my-3 relative">
                    {profile.activeBodySkin && getItemRenderUrl(profile.activeBodySkin) ? (
                      <img
                        src={getItemRenderUrl(profile.activeBodySkin) || ''}
                        alt={profile.activeBodySkin.name}
                        className="max-h-20 max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 opacity-20">
                        <Shield className="w-10 h-10" />
                        <span className="text-[9px] font-mono uppercase mt-1">Default Model</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-white/5 font-mono text-xs text-slate-500">
                    <span>Valuation:</span>
                    {profile.activeBodySkin ? (
                      <div className="flex items-center space-x-1 text-gold-bright font-bold">
                        <img src={`${import.meta.env.BASE_URL}kirka_coin.png`} alt="Coin" className="w-3.5 h-3.5 object-contain filter drop-shadow-[0_0_2px_rgba(212,175,55,0.3)]" />
                        <span>{formatValue(getItemPrice(profile.activeBodySkin))}</span>
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>

                {/* Weapon skin card */}
                <div 
                  onClick={() => {
                    if (profile.activeWeapon1Skin) {
                      onInspectItem(
                        profile.activeWeapon1Skin.name, 
                        profile.activeWeapon1Skin.parent?.name || 'weapon_skin', 
                        1
                      );
                    }
                  }}
                  className="card-interactive bg-[#0b0c13] border border-obsidian-border/80 p-5 rounded-2xl flex flex-col justify-between min-h-[220px] cursor-pointer hover:border-gold-primary/30 hover:shadow-gold-glow group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Primary Weapon</span>
                      {profile.activeWeapon1Skin ? (
                        <div>
                          <span className={`inline-block text-[8px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${getRarityStyles(profile.activeWeapon1Skin.rarity).split(' ')[0]} ${getRarityStyles(profile.activeWeapon1Skin.rarity).split(' ')[2]}`}>
                            {profile.activeWeapon1Skin.rarity}
                          </span>
                          <h4 className="text-lg font-extrabold text-white mt-2 leading-none group-hover:text-gold-bright transition-colors">
                            {profile.activeWeapon1Skin.name}
                            <span className="text-xs text-slate-400 font-mono block mt-1 font-medium">
                              Base: {profile.activeWeapon1Skin.parent?.name || 'WEAPON'}
                            </span>
                          </h4>
                        </div>
                      ) : (
                        <h4 className="text-base font-bold text-slate-600 mt-2">No Weapon Equipped</h4>
                      )}
                    </div>
                    {profile.activeWeapon1Skin && (
                      <span className="text-[9px] font-mono text-slate-500 uppercase bg-[#161825] px-2 py-1 rounded border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">Inspect</span>
                    )}
                  </div>

                  <div className="w-full h-24 flex items-center justify-center my-3 relative">
                    {profile.activeWeapon1Skin && getItemRenderUrl(profile.activeWeapon1Skin) ? (
                      <img
                        src={getItemRenderUrl(profile.activeWeapon1Skin) || ''}
                        alt={profile.activeWeapon1Skin.name}
                        className="max-h-20 max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 opacity-20">
                        <Layers className="w-10 h-10" />
                        <span className="text-[9px] font-mono uppercase mt-1">Default Model</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-white/5 font-mono text-xs text-slate-500">
                    <span>Valuation:</span>
                    {profile.activeWeapon1Skin ? (
                      <div className="flex items-center space-x-1 text-gold-bright font-bold">
                        <img src={`${import.meta.env.BASE_URL}kirka_coin.png`} alt="Coin" className="w-3.5 h-3.5 object-contain filter drop-shadow-[0_0_2px_rgba(212,175,55,0.3)]" />
                        <span>{formatValue(getItemPrice(profile.activeWeapon1Skin))}</span>
                      </div>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* 2. Full Performance Statistics Grid */}
            <div className="space-y-6">
              <h3 className="text-xs font-mono text-slate-500 tracking-widest uppercase flex items-center space-x-2 border-b border-obsidian-border/50 pb-3">
                <Sparkles className="w-4 h-4 text-gold-primary" />
                <span>Player Performance Metrics</span>
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">K / D</span>
                    <span className="text-xl sm:text-2xl font-black text-[#818cf8] block font-sans">{kd}</span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">KILLS</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">{rawKills.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">DEATHS</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">{rawDeaths.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">HEADSHOTS</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">{rawHeadshots.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">GAMES</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">{rawGames.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">WINS</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">{rawWins.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl col-span-2 md:col-span-1">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">WIN RATE</span>
                    <span className="text-xl sm:text-2xl font-black text-[#818cf8] block font-sans">{winRate}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1">
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">TOTAL SCORE</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">{rawScore.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">COINS</span>
                    <span className="text-xl sm:text-2xl font-black text-gold-bright block font-sans">
                      {profile.coins !== undefined ? profile.coins.toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">DIAMONDS</span>
                    <span className="text-xl sm:text-2xl font-black text-cyan-400 block font-sans">
                      {profile.diamonds !== undefined ? profile.diamonds.toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">TOTAL XP</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">
                      {profile.totalXp !== undefined ? profile.totalXp.toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">NEXT LEVEL XP</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">
                      {profile.xpUntilNextLevel !== undefined ? profile.xpUntilNextLevel.toLocaleString() : '—'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">KLO</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">
                      {profile.klo !== undefined ? profile.klo.toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">RANKED</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">
                      {formatRating(profile.kloRanked)}
                    </span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">SAD</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">
                      {formatRating(profile.kloSAD)}
                    </span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">1V1</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">
                      {formatRating(profile.klo1V1)}
                    </span>
                  </div>
                  <div className="bg-[#0b0c13] border border-obsidian-border/60 p-4.5 rounded-xl">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">2V2</span>
                    <span className="text-xl sm:text-2xl font-black text-white block font-sans">
                      {formatRating(profile.klo2V2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : profileTab === 'inventory' ? (
          /* Inventory Valuation Tab */
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-obsidian-card to-[#151825] border border-gold-primary/10 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                {/* Net Worth Block */}
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gold-primary/10 rounded-lg border border-gold-primary/20 flex items-center justify-center">
                    <img src={`${import.meta.env.BASE_URL}kirka_coin.png`} alt="Coin" className="w-7.5 h-7.5 object-contain filter drop-shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 tracking-wider uppercase font-mono block">Estimated Net Worth</span>
                    <span className="text-2xl font-black text-gold-gradient block mt-0.5 leading-none">
                      {totalValuation.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} <span className="text-xs font-medium font-mono text-gold-bright/60">Kirka Coins</span>
                    </span>
                  </div>
                </div>

                {/* Total Units Block */}
                <div className="flex items-center space-x-3 border-t sm:border-t-0 sm:border-l border-white/5 pt-4 sm:pt-0 sm:pl-6">
                  <div className="p-3 bg-gold-primary/5 rounded-lg border border-white/5">
                    <Database className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 tracking-wider uppercase font-mono block">Total Inventory Items</span>
                    <span className="text-2xl font-black text-white block mt-0.5 leading-none">
                      {inventory.reduce((sum, item) => sum + item.amount, 0).toLocaleString()} <span className="text-xs font-medium font-mono text-slate-400/60">Units</span>
                      <span className="text-[10px] text-slate-500 font-mono font-medium ml-2">({inventory.length} unique)</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center space-x-2 bg-gradient-to-r from-gold-primary to-gold-bright hover:shadow-gold-glow text-obsidian-deep px-4 py-2.5 rounded-xl font-bold hover:scale-[1.02] transition-all cursor-pointer text-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>Share Inventory</span>
                </button>

                <div className="bg-obsidian-deep/80 border border-obsidian-border px-4 py-2.5 rounded-lg flex items-center space-x-2 text-xs font-mono text-slate-400">
                  <Database className="w-3.5 h-3.5 text-gold-primary" />
                  <span>Price Index: <strong className="text-slate-200">Bolt Pricing</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-obsidian-card/40 border border-obsidian-border/50 px-4 py-3 rounded-lg text-xs text-slate-400 font-mono">
              <Award className="w-4 h-4 text-gold-primary" />
              <span>Note: All prices shown in the inventory valuations are synchronized directly from the official **Bolt Pricing** database. Unpriced items are sorted to the bottom of the list.</span>
            </div>

            {loadingInventory ? (
              <div className="flex items-center justify-center py-32 bg-obsidian-card border border-obsidian-border rounded-xl">
                <div className="w-8 h-8 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : inventory.length === 0 ? (
              <div className="text-center py-24 bg-obsidian-card border border-obsidian-border rounded-xl text-slate-500 text-sm">
                No items found in this user's inventory.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[...inventory]
                  .sort((a, b) => getItemPrice(b.item) - getItemPrice(a.item))
                  .map((invItem, index) => {
                  const item = invItem.item;
                  const matchedPrice = getItemPrice(item);
                  const rarityStyles = getRarityStyles(item.rarity);
                  const renderUrl = getItemRenderUrl(item);
                  
                  return (
                    <div
                      key={item.id + '-' + index}
                      onClick={() => onInspectItem(
                        item.name, 
                        item.type === 'BODY_SKIN' ? 'character' : item.parent?.name || 'weapon_skin', 
                        invItem.amount
                      )}
                      className={`card-interactive relative flex flex-col justify-between bg-obsidian-card border p-4.5 rounded-xl cursor-pointer hover:shadow-gold-glow group ${rarityStyles}`}
                    >
                      <span className="absolute top-2.5 right-2.5 bg-obsidian-deep border border-obsidian-border text-[10px] font-bold px-1.5 py-0.5 rounded font-mono text-slate-300 font-black">
                        x{invItem.amount}
                      </span>

                      <div className="w-full h-24 flex items-center justify-center mb-3.5 relative">
                        {renderUrl ? (
                          <img
                            src={renderUrl}
                            alt={item.name}
                            className="max-h-20 max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600">
                            {item.type === 'BODY_SKIN' ? (
                              <Shield className="w-10 h-10 opacity-20" />
                            ) : (
                              <Layers className="w-10 h-10 opacity-20" />
                            )}
                            <span className="text-[9px] font-mono uppercase tracking-wider mt-1 opacity-50">No Render</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
                          {item.type === 'BODY_SKIN' ? 'Body Skin' : item.parent?.name || 'Weapon Skin'}
                        </span>
                        <h4 className="text-sm font-extrabold text-white line-clamp-1 group-hover:text-gold-bright transition-colors">
                          {item.name.replace(/^_+/, '')}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5 text-xs font-mono">
                        <span className="text-[10px] text-slate-500 uppercase">Valuation:</span>
                        <div className="flex items-center space-x-1 text-gold-bright font-bold">
                          <img src={`${import.meta.env.BASE_URL}kirka_coin.png`} alt="Coin" className="w-3.5 h-3.5 object-contain filter drop-shadow-[0_0_2px_rgba(212,175,55,0.3)]" />
                          <span>{matchedPrice > 0 ? formatValue(matchedPrice) : '—'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <FitViewer
            profile={profile}
            publicItems={publicItems}
            allItemData={allItemData}
            fallbackRenders={fallbackRenders}
          />
        )}
      </div>
      {/* Subtle render attribution footer */}
      <div className="text-center pt-8 pb-2 text-[9px] font-mono text-slate-600 select-none opacity-40">
        All 3D character avatars and skins are rendered on-the-fly or sourced from Smudgy/Akuma open repository API.
      </div>

      <ShareInventoryModal
        inventory={inventory}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        getItemPrice={getItemPrice}
        getItemRenderUrl={getItemRenderUrl}
        username={profile.name}
      />

    </div>
  );
};
