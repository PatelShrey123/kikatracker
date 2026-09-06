import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Check, 
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import { FitViewer3D } from './FitViewer3D';
import { fetchUserProfile } from '../utils/api';

interface FitViewerSectionProps {
  publicItems: any[];
  marketPrices?: Map<string, any>;
}

// Preset fits for quick 1-click preview
const PRESET_FITS = [
  {
    name: 'Capy Chill',
    level: 99,
    charSkinName: 'Capy',
    primaryWeapon: 'SCAR',
    primarySkinName: 'Neo2',
    secondarySkinName: 'Sterling',
    secondaryWeapon: 'Revolver',
    meleeSkinName: 'CYB3R',
    meleeWeapon: 'Bayonet'
  },
  {
    name: 'CrackedYOU',
    level: 96,
    charSkinName: 'James',
    primaryWeapon: 'SCAR',
    primarySkinName: 'Neo2',
    secondarySkinName: 'Sterling',
    secondaryWeapon: 'Revolver',
    meleeSkinName: 'CYB3R',
    meleeWeapon: 'Bayonet'
  },
  {
    name: 'WeatieXpert',
    level: 89,
    charSkinName: 'James',
    primaryWeapon: 'Weatie',
    primarySkinName: 'Fading Waves',
    secondarySkinName: 'Crystalized',
    secondaryWeapon: 'Revolver',
    meleeSkinName: 'Cornfield',
    meleeWeapon: 'Bayonet'
  },
  {
    name: 'Grayscale God',
    level: 100,
    charSkinName: 'Grayscale',
    primaryWeapon: 'AR-9',
    primarySkinName: 'Rub1x',
    secondarySkinName: 'Murdered',
    secondaryWeapon: 'Revolver',
    meleeSkinName: 'Cyb3r',
    meleeWeapon: 'Bayonet'
  }
];

export const FitViewerSection: React.FC<FitViewerSectionProps> = ({ publicItems }) => {
  // Player Header Info
  const [playerName, setPlayerName] = useState('CrackedYOU');
  const [playerLevel, setPlayerLevel] = useState(96);
  const [playerInput, setPlayerInput] = useState('');
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Selected Character
  const [selectedCharName, setSelectedCharName] = useState('James');

  // Selected Primary Weapon & Skin
  const [selectedPrimaryWeapon, setSelectedPrimaryWeapon] = useState('SCAR');
  const [selectedPrimarySkin, setSelectedPrimarySkin] = useState('Neo2');

  // Selected Secondary & Melee (displays on the 3 loadout slots below canvas)
  const [selectedSecondarySkin, setSelectedSecondarySkin] = useState('Sterling');
  const [selectedMeleeSkin, setSelectedMeleeSkin] = useState('CYB3R');

  // Search filter states for dropdowns
  const [charSearch, setCharSearch] = useState('');
  const [primarySearch, setPrimarySearch] = useState('');
  const [secondarySearch, setSecondarySearch] = useState('');
  const [meleeSearch, setMeleeSearch] = useState('');

  // Dropdown open states
  const [openDropdown, setOpenDropdown] = useState<'char' | 'primaryGun' | 'primarySkin' | 'secondary' | 'melee' | null>(null);

  // --- FILTERED CATALOG DATA ---
  // 1. All Character Skins (including in-game specials like Capy)
  const characterSkins = useMemo(() => {
    const list = publicItems.filter(item => {
      const type = (item.type || '').toUpperCase();
      return type === 'BODY_SKIN' || type === 'CHARACTER';
    });

    // Ensure Capy is present even if official items API is not updated yet
    if (!list.some(s => s.name?.toLowerCase() === 'capy')) {
      list.push({
        id: 'capy-skin-special',
        name: 'Capy',
        type: 'BODY_SKIN',
        rarity: 'LEGENDARY',
        textureUrl: 'https://api2.kirka.io/api/skin-texture/Capy/v1785750819945.webp',
        renderUrl: 'https://api2.kirka.io/api/skin-texture/Capy/v1785750819945.webp',
      });
    }

    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [publicItems]);

  // 2. All Primary Weapons available
  const primaryWeaponTypes = ['SCAR', 'AR-9', 'Weatie', 'LAR', 'VITA', 'M60', 'MAC-10', 'Shark'];

  // 3. Skins for selected primary weapon
  const primarySkinsForWeapon = useMemo(() => {
    const targetParent = selectedPrimaryWeapon.toLowerCase();
    return publicItems.filter(item => {
      const pName = (item.parent?.name || '').toLowerCase();
      return pName === targetParent;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [publicItems, selectedPrimaryWeapon]);

  // 4. Secondary (Revolver) skins
  const secondarySkins = useMemo(() => {
    return publicItems.filter(item => {
      const pName = (item.parent?.name || '').toLowerCase();
      return pName === 'revolver' || pName === 'pistol';
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [publicItems]);

  // 5. Melee (Bayonet / Tomahawk) skins
  const meleeSkins = useMemo(() => {
    return publicItems.filter(item => {
      const pName = (item.parent?.name || '').toLowerCase();
      return pName === 'bayonet' || pName === 'tomahawk' || pName === 'knife';
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [publicItems]);

  // --- RESOLVE CURRENT EQUIPPED OBJECTS ---
  const activeCharItem = useMemo(() => {
    const found = characterSkins.find(s => s.name?.toLowerCase() === selectedCharName.toLowerCase());
    if (found) return found;

    // Direct CDN probe for unlisted or user-entered skin names
    return {
      id: `probed-${selectedCharName}`,
      name: selectedCharName,
      type: 'BODY_SKIN',
      rarity: 'SPECIAL',
      textureUrl: `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(selectedCharName)}`,
      renderUrl: `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(selectedCharName)}`,
    };
  }, [characterSkins, selectedCharName]);

  const activePrimaryItem = useMemo(() => {
    return primarySkinsForWeapon.find(s => s.name?.toLowerCase() === selectedPrimarySkin.toLowerCase()) || primarySkinsForWeapon[0];
  }, [primarySkinsForWeapon, selectedPrimarySkin]);

  const activeSecondaryItem = useMemo(() => {
    return secondarySkins.find(s => s.name?.toLowerCase() === selectedSecondarySkin.toLowerCase()) || secondarySkins[0];
  }, [secondarySkins, selectedSecondarySkin]);

  const activeMeleeItem = useMemo(() => {
    return meleeSkins.find(s => s.name?.toLowerCase() === selectedMeleeSkin.toLowerCase()) || meleeSkins[0];
  }, [meleeSkins, selectedMeleeSkin]);

  // Handle Loading a Live Player's Fit by ID or Username
  const handleLoadPlayerFit = async () => {
    if (!playerInput.trim()) return;
    setIsLoadingPlayer(true);
    setPlayerError(null);

    try {
      const profile = await fetchUserProfile(playerInput.trim());
      if (profile) {
        setPlayerName(profile.name || playerInput);
        setPlayerLevel(profile.level || 1);

        // Equip character
        if (profile.activeBodySkin?.name) {
          setSelectedCharName(profile.activeBodySkin.name.replace(/^_+/, '').trim());
        }

        // Equip primary weapon
        if (profile.activeWeapon1Skin?.name) {
          const gunType = profile.activeWeapon1Skin.parent?.name || 'SCAR';
          setSelectedPrimaryWeapon(gunType);
          setSelectedPrimarySkin(profile.activeWeapon1Skin.name.replace(/^_+/, '').trim());
        }

        setPlayerInput('');
      } else {
        setPlayerError(`Player "${playerInput}" not found on Kirka.`);
      }
    } catch (err: any) {
      setPlayerError(err.message || 'Failed to fetch player loadout.');
    } finally {
      setIsLoadingPlayer(false);
    }
  };

  // Apply a Preset
  const handleApplyPreset = (preset: typeof PRESET_FITS[0]) => {
    setPlayerName(preset.name);
    setPlayerLevel(preset.level);
    setSelectedCharName(preset.charSkinName);
    setSelectedPrimaryWeapon(preset.primaryWeapon);
    setSelectedPrimarySkin(preset.primarySkinName);
    setSelectedSecondarySkin(preset.secondarySkinName);
    setSelectedMeleeSkin(preset.meleeSkinName);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* 1. Header Banner matching Kirka In-Game Inventory styling */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <span className="px-3.5 py-1 rounded-md bg-[#253966] border border-[#3e568f] text-xs font-black tracking-widest text-white uppercase font-mono shadow-sm">
              INVENTORY
            </span>
            <span className="text-xs text-indigo-400 font-bold uppercase tracking-widest font-mono">
              3D Fit Viewer • Kirka Live Engine
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-wide flex items-center gap-3">
            Loadout Showcase
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </h1>
        </div>

        {/* 1-Click Load Player Fit Input */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Load Player (e.g. 43KBHA)..."
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadPlayerFit()}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#0d1424] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
          <button
            onClick={handleLoadPlayerFit}
            disabled={isLoadingPlayer || !playerInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold tracking-wide transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            {isLoadingPlayer ? 'Loading...' : '⚡ Equip Fit'}
          </button>
        </div>
      </div>

      {playerError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium">
          ⚠️ {playerError}
        </div>
      )}

      {/* Preset Quick Switchers */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mr-1">
          Presets:
        </span>
        {PRESET_FITS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handleApplyPreset(preset)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#0d1527] hover:bg-[#162340] border border-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer whitespace-nowrap shadow-sm hover:border-cyan-500/40"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">{preset.name}</span>
            <span className="text-[10px] text-slate-400">({preset.primaryWeapon})</span>
          </button>
        ))}
      </div>

      {/* 2. Main Stage Grid: Left In-Game Card vs Right Customizer Dropdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Authentic Kirka Loadout Card (Canvas + 3 Weapon Slots) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0e162a] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
            {/* Player Level & Name Header (Matching media_1788712025325.png) */}
            <div className="flex items-center justify-center space-x-3 mb-4">
              <span className="px-2.5 py-1 rounded bg-[#d97706] text-black font-black text-sm tracking-wider font-mono shadow-sm">
                {playerLevel}
              </span>
              <span className="text-2xl font-black text-white tracking-wide">
                {playerName}
              </span>
            </div>

            {/* Center 3D WebGL Canvas */}
            <div className="w-full h-[460px] md:h-[500px]">
              <FitViewer3D
                characterTextureUrl={activeCharItem?.textureUrl}
                characterName={selectedCharName}
                primaryWeaponType={selectedPrimaryWeapon}
                primaryTextureUrl={activePrimaryItem?.textureUrl}
                primarySkinName={selectedPrimarySkin}
                className="w-full h-full"
              />
            </div>

            {/* 3 Bottom Loadout Slots (Matching media_1788712025325.png) */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {/* Slot 1: Primary Weapon */}
              <div 
                onClick={() => setOpenDropdown(openDropdown === 'primarySkin' ? null : 'primarySkin')}
                className="group relative p-3 rounded-xl bg-[#121c33] hover:bg-[#172545] border border-cyan-500/40 hover:border-cyan-400 transition-all cursor-pointer shadow-md"
              >
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono block">
                  PRIMARY ({selectedPrimaryWeapon})
                </span>
                <span className="text-sm font-black text-white truncate block mt-0.5 group-hover:text-cyan-300">
                  {selectedPrimarySkin}
                </span>
                <div className="h-16 flex items-center justify-center mt-2">
                  <img
                    src={activePrimaryItem?.renderUrl || `${import.meta.env.BASE_URL}render-mini.webp`}
                    alt={selectedPrimarySkin}
                    className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* Slot 2: Secondary Weapon (Pistol) */}
              <div 
                onClick={() => setOpenDropdown(openDropdown === 'secondary' ? null : 'secondary')}
                className="group relative p-3 rounded-xl bg-[#121c33] hover:bg-[#172545] border border-white/10 hover:border-indigo-400/50 transition-all cursor-pointer shadow-md"
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                  SECONDARY
                </span>
                <span className="text-sm font-black text-white truncate block mt-0.5 group-hover:text-indigo-300">
                  {selectedSecondarySkin}
                </span>
                <div className="h-16 flex items-center justify-center mt-2">
                  <img
                    src={activeSecondaryItem?.renderUrl || `${import.meta.env.BASE_URL}render-mini.webp`}
                    alt={selectedSecondarySkin}
                    className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* Slot 3: Melee Weapon (Knife) */}
              <div 
                onClick={() => setOpenDropdown(openDropdown === 'melee' ? null : 'melee')}
                className="group relative p-3 rounded-xl bg-[#121c33] hover:bg-[#172545] border border-white/10 hover:border-purple-400/50 transition-all cursor-pointer shadow-md"
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                  MELEE
                </span>
                <span className="text-sm font-black text-white truncate block mt-0.5 group-hover:text-purple-300">
                  {selectedMeleeSkin}
                </span>
                <div className="h-16 flex items-center justify-center mt-2">
                  <img
                    src={activeMeleeItem?.renderUrl || `${import.meta.env.BASE_URL}render-mini.webp`}
                    alt={selectedMeleeSkin}
                    className="max-h-full max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Customization Controls & Dropdown Selectors */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-6 rounded-2xl border border-white/10 bg-[#0d1424]/90 backdrop-blur-md space-y-6 shadow-xl">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-white/10">
              <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black text-white tracking-wide">
                Fit Customizer
              </h2>
            </div>

            {/* 1. Character Skin Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>👤 Character Skin</span>
                <span className="text-cyan-400">{selectedCharName}</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Character skin..."
                  value={charSearch}
                  onChange={(e) => setCharSearch(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#141e33] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 mb-2"
                />
                <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1.5 border border-white/10 rounded-xl p-1.5 bg-[#090e1a]">
                  {characterSkins
                    .filter(c => !charSearch || c.name?.toLowerCase().includes(charSearch.toLowerCase()))
                    .map(char => {
                      const isSelected = char.name?.toLowerCase() === selectedCharName.toLowerCase();
                      return (
                        <button
                          key={char.id || char.name}
                          onClick={() => setSelectedCharName(char.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' 
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 truncate">
                            {char.renderUrl && (
                              <img src={char.renderUrl} alt={char.name} className="w-5 h-5 object-contain" />
                            )}
                            <span className="truncate">{char.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                        </button>
                      );
                    })}

                  {/* Option to load unlisted / custom skin via api2.kirka.io CDN */}
                  {charSearch.trim() && !characterSkins.some(c => c.name?.toLowerCase() === charSearch.trim().toLowerCase()) && (
                    <button
                      onClick={() => {
                        setSelectedCharName(charSearch.trim());
                        setCharSearch('');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 hover:bg-indigo-600/40 transition-all cursor-pointer font-bold mt-1 shadow-sm"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span>⚡ Probe & Load "{charSearch.trim()}"</span>
                      </div>
                      <span className="text-[10px] bg-indigo-500/60 px-2 py-0.5 rounded text-white font-mono">
                        api2.kirka.io
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Primary Weapon Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                🔫 Primary Weapon
              </label>
              <div className="grid grid-cols-4 gap-2">
                {primaryWeaponTypes.map(gun => {
                  const isSelected = gun.toLowerCase() === selectedPrimaryWeapon.toLowerCase();
                  return (
                    <button
                      key={gun}
                      onClick={() => {
                        setSelectedPrimaryWeapon(gun);
                        // Auto-select first skin for newly chosen gun
                        const available = publicItems.filter(i => (i.parent?.name || '').toLowerCase() === gun.toLowerCase());
                        if (available.length > 0) {
                          setSelectedPrimarySkin(available[0].name);
                        }
                      }}
                      className={`px-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                          : 'bg-[#141e33] text-slate-300 hover:bg-[#1c2945] hover:text-white border border-white/5'
                      }`}
                    >
                      {gun}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Primary Weapon Skin Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>🎨 {selectedPrimaryWeapon} Skin</span>
                <span className="text-cyan-400">{selectedPrimarySkin}</span>
              </label>
              <input
                type="text"
                placeholder={`Search ${selectedPrimaryWeapon} skins (${primarySkinsForWeapon.length})...`}
                value={primarySearch}
                onChange={(e) => setPrimarySearch(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#141e33] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 mb-2"
              />
              <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1.5 border border-white/10 rounded-xl p-1.5 bg-[#090e1a]">
                {primarySkinsForWeapon
                  .filter(s => !primarySearch || s.name?.toLowerCase().includes(primarySearch.toLowerCase()))
                  .map(skin => {
                    const isSelected = skin.name?.toLowerCase() === selectedPrimarySkin.toLowerCase();
                    return (
                      <button
                        key={skin.id || skin.name}
                        onClick={() => setSelectedPrimarySkin(skin.name)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' 
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          {skin.renderUrl && (
                            <img src={skin.renderUrl} alt={skin.name} className="w-6 h-4 object-contain" />
                          )}
                          <span className="truncate">{skin.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* 4. Secondary (Pistol) Skin Selector */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>🔫 Secondary Pistol Skin</span>
                <span className="text-slate-300">{selectedSecondarySkin}</span>
              </label>
              <input
                type="text"
                placeholder="Search Revolver skins..."
                value={secondarySearch}
                onChange={(e) => setSecondarySearch(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#141e33] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 mb-2"
              />
              <div className="max-h-28 overflow-y-auto no-scrollbar space-y-1 border border-white/10 rounded-xl p-1.5 bg-[#090e1a]">
                {secondarySkins
                  .filter(s => !secondarySearch || s.name?.toLowerCase().includes(secondarySearch.toLowerCase()))
                  .slice(0, 30)
                  .map(skin => {
                    const isSelected = skin.name?.toLowerCase() === selectedSecondarySkin.toLowerCase();
                    return (
                      <button
                        key={skin.id || skin.name}
                        onClick={() => setSelectedSecondarySkin(skin.name)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate">{skin.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* 5. Melee (Knife) Skin Selector */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
                <span>🗡️ Melee Knife Skin</span>
                <span className="text-slate-300">{selectedMeleeSkin}</span>
              </label>
              <input
                type="text"
                placeholder="Search Bayonet/Tomahawk skins..."
                value={meleeSearch}
                onChange={(e) => setMeleeSearch(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#141e33] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 mb-2"
              />
              <div className="max-h-28 overflow-y-auto no-scrollbar space-y-1 border border-white/10 rounded-xl p-1.5 bg-[#090e1a]">
                {meleeSkins
                  .filter(s => !meleeSearch || s.name?.toLowerCase().includes(meleeSearch.toLowerCase()))
                  .slice(0, 30)
                  .map(skin => {
                    const isSelected = skin.name?.toLowerCase() === selectedMeleeSkin.toLowerCase();
                    return (
                      <button
                        key={skin.id || skin.name}
                        onClick={() => setSelectedMeleeSkin(skin.name)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate">{skin.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
