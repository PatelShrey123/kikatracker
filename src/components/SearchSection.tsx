import React, { useState, useEffect } from 'react';
import { Search, Compass, AlertCircle, ArrowRight, Award, Trophy, ShieldAlert } from 'lucide-react';
import { fetchSoloLeaderboard, fetchUserProfile } from '../utils/api';
import { Hyperspeed } from './Hyperspeed';

interface SearchSectionProps {
  onSearch: (id: string, isShortId: boolean) => void;
  isLoading: boolean;
  searchError: string | null;
  onClearError: () => void;
}

interface FeaturedProfile {
  name: string;
  shortId: string;
  role: string;
  level: number;
  desc: string;
  isShortId: boolean;
}

const FEATURED_PROFILES: FeaturedProfile[] = [
  { name: 'shadow', shortId: 'HESHPY', role: 'LEADER', level: 98, desc: 'Clan Leader (kiss) • Mythic active loadout', isShortId: true },
  { name: 'Hisoka', shortId: 'S2WVOK', role: 'USER', level: 99, desc: 'Top S&D Leaderboard #1 • 5.7K KLO score', isShortId: true },
  { name: 'Bot#0', shortId: '9VECSU', role: 'USER', level: 85, desc: 'Active member • Bolt valuation inventory', isShortId: true },
];

export const SearchSection: React.FC<SearchSectionProps> = ({
  onSearch,
  isLoading,
  searchError,
  onClearError,
}) => {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [featuredProfiles, setFeaturedProfiles] = useState<FeaturedProfile[]>(FEATURED_PROFILES);

  useEffect(() => {
    // Fetch daily leaderboard to extract top 3 active players dynamically
    fetchSoloLeaderboard()
      .then((data) => {
        if (data && data.length >= 3) {
          Promise.all(
            data.slice(0, 3).map(async (player, index) => {
              try {
                // Fetch profile to resolve details (shortId, level, clan)
                const profile = await fetchUserProfile(player.userId, false);
                return {
                  name: profile.name,
                  shortId: profile.shortId || profile.id,
                  role: profile.role,
                  level: profile.level,
                  desc: `Daily Rank #${index + 1} • Level ${profile.level}${profile.clan ? ` (${profile.clan})` : ''}`,
                  isShortId: true
                };
              } catch {
                return {
                  name: player.name,
                  shortId: player.userId,
                  role: 'USER',
                  level: 0,
                  desc: `Daily Rank #${index + 1} • Active competitive player`,
                  isShortId: false
                };
              }
            })
          ).then((resolved) => {
            setFeaturedProfiles(resolved);
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to load dynamic featured profiles:', err);
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    onClearError();

    let trimmed = query.trim();
    if (trimmed.startsWith('#')) {
      trimmed = trimmed.substring(1);
    }

    // Strictly validate 6-character alphanumeric ID only
    const shortIdRegex = /^[a-zA-Z0-9]{6}$/;
    if (!shortIdRegex.test(trimmed)) {
      setError('Invalid ID. Please search using a valid 6-character short ID (e.g. #FUYR7K).');
      return;
    }

    onSearch(trimmed, true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (error) setError('');
    if (searchError) onClearError();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12 select-text">
      {/* 1. Hero Search Panel with Hyperspeed Background */}
      <div className="relative overflow-hidden w-full rounded-2xl border border-obsidian-border bg-gradient-to-br from-[#0c0e17]/80 to-[#06070b]/90 py-12 px-6 sm:px-12 flex flex-col items-center justify-center text-center space-y-6">
        
        {/* Background Hyperspeed Effect */}
        <div className="absolute inset-0 pointer-events-auto opacity-55 z-0">
          <Hyperspeed
            effectOptions={{
              distortion: 'mountainDistortion',
              length: 400,
              roadWidth: 10,
              islandWidth: 2,
              lanesPerRoad: 3,
              fov: 90,
              fovSpeedUp: 150,
              speedUp: 3.5,
              carLightsFade: 0.4,
              totalSideLightSticks: 20,
              lightPairsPerRoadWay: 40,
              shoulderLinesWidthPercentage: 0.05,
              brokenLinesWidthPercentage: 0.1,
              brokenLinesLengthPercentage: 0.5,
              lightStickWidth: [0.12, 0.5],
              lightStickHeight: [1.3, 1.7],
              movingAwaySpeed: [60, 80],
              movingCloserSpeed: [-120, -160],
              carLightsLength: [12, 80],
              carLightsRadius: [0.05, 0.14],
              carWidthPercentage: [0.3, 0.5],
              carShiftX: [-0.8, 0.8],
              carFloorSeparation: [0, 5],
              colors: {
                roadColor: 0x020202,
                islandColor: 0x050505,
                background: 0x000000,
                shoulderLines: 0xd4af37,
                brokenLines: 0xffd700,
                leftCars: [0xd4af37, 0xffd700, 0xb8860b],
                rightCars: [0xffdf00, 0xffc125, 0xdaa520],
                sticks: 0xffd700
              }
            }}
          />
        </div>

        {/* Hero Content Wrapper */}
        <div className="relative z-10 flex flex-col items-center justify-center space-y-6 max-w-2xl mx-auto pointer-events-none">
          <img src="search_portal.png" alt="Search Icon" className="w-16 h-16 rounded-xl object-contain filter drop-shadow-[0_0_12px_rgba(212,175,55,0.2)] mb-2" />
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight uppercase select-none">
            Kirka.io <span className="text-gold-gradient">Analytics Engine</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl font-medium leading-relaxed select-none">
            Search player profiles to calculate total net-worth inventory valuations, inspect active weapon loadouts, and track leaderboard ranks.
          </p>

          {/* Input box */}
          <form onSubmit={handleSubmit} className="w-full max-w-xl relative pt-3 pointer-events-auto">
            <div className="relative flex items-center bg-[#12141d]/90 border border-obsidian-border rounded-2xl p-1.5 focus-within:border-gold-primary/45 focus-within:shadow-[0_0_18px_rgba(212,175,55,0.06)] transition-all duration-300">
              <div className="pl-4 text-slate-500">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Search by 6-character short ID (e.g. #FUYR7K)..."
                value={query}
                onChange={handleInputChange}
                disabled={isLoading}
                className="w-full bg-transparent border-0 ring-0 outline-none text-white text-base py-3 px-3 placeholder-slate-600 disabled:opacity-50 font-medium"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="btn-interactive flex items-center space-x-2 bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep px-6 py-3 rounded-xl font-bold hover:shadow-[0_0_18px_rgba(255,215,0,0.25)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-obsidian-deep border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="font-extrabold uppercase tracking-wider text-xs">Search</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            
            {(error || searchError) && (
              <div className="absolute -bottom-6 left-2 flex items-center space-x-1.5 text-red-500 text-xs font-mono">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error || searchError}</span>
              </div>
            )}
          </form>

          {/* Tip notification to click for speed */}
          <div className="flex items-center space-x-2 text-[10px] font-mono text-gold-bright/60 bg-[#06070b]/80 border border-gold-primary/10 px-3.5 py-2 rounded-full select-none mt-2 animate-pulse pointer-events-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-bright shadow-[0_0_6px_rgba(255,215,0,0.8)]" />
            <span>Tip: Click and hold anywhere in the background to activate Hyperspeed! 🚀</span>
          </div>
        </div>
      </div>

      {/* 2. Page Distribution Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
        
        {/* Left 2 Columns: Recommended Profiles */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h3 className="text-xs font-mono text-slate-500 tracking-widest uppercase flex items-center space-x-2 mb-4">
              <Compass className="w-4.5 h-4.5 text-slate-500" />
              <span>RECOMMENDED PLAYER REGISTRY</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {featuredProfiles.map((player) => (
                <div
                  key={player.shortId}
                  onClick={() => onSearch(player.shortId, player.isShortId)}
                  className="group cursor-pointer bg-gradient-to-br from-[#12141D] to-[#0c0d15] border border-obsidian-border hover:border-gold-primary/20 p-5 rounded-2xl transition-all duration-300 relative shadow-sm overflow-hidden flex flex-col justify-between h-[160px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-primary to-gold-bright scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white group-hover:text-gold-bright transition-colors uppercase leading-none">
                        {player.name}
                      </span>
                      {player.level > 0 && <span className="text-[9px] text-slate-500 font-mono mt-1">Lvl {player.level}</span>}
                    </div>
                    <span className="text-[8px] font-mono font-bold bg-[#04050a] border border-white/5 text-slate-400 px-1.5 py-0.5 rounded uppercase max-w-[80px] truncate">
                      {player.isShortId ? `#${player.shortId}` : 'PROFILE'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors leading-relaxed">
                    {player.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Informational Guide Section */}
          <div className="bg-gradient-to-r from-[#0d0f17] to-obsidian-card/40 border border-indigo-500/10 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase tracking-widest block">Valuation Sync Info</span>
              <h4 className="text-sm font-bold text-white uppercase">BOLT PRICING INTEGRATION ACTIVE</h4>
              <p className="text-xs text-slate-500 max-w-lg">
                Calculations are mapped instantly to market valuation updates fetched directly from public sheets via OpenSheet JSON networks.
              </p>
            </div>
            <div className="bg-[#04050a]/80 border border-white/5 px-4 py-2.5 rounded-xl text-[10px] font-mono text-slate-400 text-center flex-shrink-0">
              PRICING STATUS: <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Tracker Info Panel */}
        <div className="lg:col-span-1 space-y-6">
          <h3 className="text-xs font-mono text-slate-500 tracking-widest uppercase flex items-center space-x-2">
            <Trophy className="w-4.5 h-4.5 text-slate-500" />
            <span>CORE CAPABILITIES</span>
          </h3>

          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-5 space-y-4">
            {/* Capability 1 */}
            <div className="flex items-start space-x-3.5 py-3 border-b border-obsidian-border/50">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400 mt-0.5">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block uppercase">S&D Ranks</span>
                <p className="text-[11px] text-slate-500">Live search rankings of competitive bomb defusal modes.</p>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="flex items-start space-x-3.5 py-3 border-b border-obsidian-border/50">
              <div className="p-2 bg-gold-primary/10 rounded-lg border border-gold-primary/20 text-gold-bright mt-0.5">
                <Award className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block uppercase">Net Worth sums</span>
                <p className="text-[11px] text-slate-500">Auto valuations of user player inventory boxes via Bolt index.</p>
              </div>
            </div>

            {/* Capability 3 */}
            <div className="flex items-start space-x-3.5 py-3">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block uppercase">Lobby Live Lounge</span>
                <p className="text-[11px] text-slate-500">Real-time WebSocket chat stream showing in-game lobby chat packets.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
