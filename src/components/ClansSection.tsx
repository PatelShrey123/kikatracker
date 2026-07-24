import React, { useEffect, useState } from 'react';
import { Search, Users2, MessageSquare, AlertCircle, Calendar, ArrowLeft } from 'lucide-react';
import type { ClanLeaderboardResult, ClanResponse, ClanMember } from '../utils/api';
import { fetchClanLeaderboard, fetchClanDetail, fetchUserProfile } from '../utils/api';
import { cropMinecraftHead } from '../utils/skinCropper';

interface ClansSectionProps {
  onSelectPlayer: (id: string, isShortId: boolean) => void;
  activeClanName: string | null;
  onClearActiveClanName: () => void;
  fallbackRenders: Record<string, any>;
  allItemData: any[];
}

// Subcomponent to fetch user avatars asynchronously inside the roster grid list
const ClanMemberCard: React.FC<{
  member: ClanMember;
  onSelectPlayer: (id: string, isShortId: boolean) => void;
  isLeader: boolean;
  isOfficer: boolean;
  fallbackRenders: Record<string, any>;
  allItemData: any[];
}> = ({ member, onSelectPlayer, isLeader, isOfficer, fallbackRenders, allItemData }) => {
  const [croppedAvatarUrl, setCroppedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    // Dynamically retrieve player profile in the background to show equipped characters
    fetchUserProfile(member.user.id, false)
      .then((profile) => {
        if (profile && profile.activeBodySkin) {
          const skin = profile.activeBodySkin;
          let texture = skin.textureUrl;
          if (!texture && allItemData && Array.isArray(allItemData)) {
            // Lookup textureUrl in the allItemData repository
            const nameKey = skin.name.toLowerCase();
            const matched = allItemData.find(
              (i) => i.name.toLowerCase() === nameKey && i.type === 'BODY_SKIN'
            );
            if (matched) texture = matched.textureUrl;
          }

          if (texture) {
            cropMinecraftHead(texture)
              .then((headUrl) => setCroppedAvatarUrl(headUrl))
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        // Fallback safely to letters SVG
      });
  }, [member.user.id, fallbackRenders, allItemData]);

  const role = member.role.toUpperCase();

  return (
    <div
      onClick={() => onSelectPlayer(member.user.id, false)}
      className={`group cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all duration-300 select-none ${
        isLeader
          ? 'bg-red-500/5 border-red-500/25 hover:border-red-500/55 hover:shadow-[0_0_15px_rgba(239,68,68,0.06)]'
          : isOfficer
          ? 'bg-gold-primary/5 border-gold-primary/20 hover:border-gold-primary/45 hover:shadow-[0_0_15px_rgba(212,175,55,0.06)]'
          : 'bg-obsidian-card/40 border-obsidian-border hover:border-slate-500/35'
      }`}
    >
      <div className="flex items-center space-x-3">
        {/* Profile/Character Square avatar picture (renders cropped skin head!) */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs border overflow-hidden relative flex-shrink-0 ${
          isLeader
            ? 'bg-red-950/80 border-red-500/40 text-red-400'
            : isOfficer
            ? 'bg-[#29220c]/80 border-gold-primary/40 text-gold-bright'
            : 'bg-obsidian-deep border-white/5 text-slate-400'
        }`}>
          {croppedAvatarUrl ? (
            <img
              src={croppedAvatarUrl}
              alt={member.user.name}
              className="w-7.5 h-7.5 object-contain filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            />
          ) : (
            /* Retro pixelated block head profile photo fallback */
            <svg viewBox="0 0 8 8" className="w-5.5 h-5.5 text-slate-500 fill-current opacity-70">
              <rect width="8" height="8" rx="0" fill="#4b5563" />
              <rect x="1" y="1" width="6" height="5" fill="#9ca3af" />
              <rect x="2" y="4" width="1" height="1" fill="#000" />
              <rect x="5" y="4" width="1" height="1" fill="#000" />
            </svg>
          )}
        </div>
        <div>
          <span className={`text-sm font-semibold block transition-colors ${
            isLeader
              ? 'text-red-400 group-hover:text-red-300 font-bold'
              : isOfficer
              ? 'text-gold-bright group-hover:text-gold-primary'
              : 'text-white group-hover:text-gold-bright'
          }`}>
            {member.user.name}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {role} • Lvl {member.user.level}
          </span>
        </div>
      </div>

      <div className="text-right font-mono">
        <span className="text-xs font-bold text-slate-300 block">{member.allScores.toLocaleString()}</span>
        <span className="text-[9px] text-slate-500 block uppercase">Score</span>
      </div>
    </div>
  );
};

export const ClansSection: React.FC<ClansSectionProps> = ({
  onSelectPlayer,
  activeClanName,
  onClearActiveClanName,
  fallbackRenders,
  allItemData
}) => {
  const [clans, setClans] = useState<ClanLeaderboardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dedicated Clan page state
  const [currentViewedClan, setCurrentViewedClan] = useState<ClanResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');

  // Fetch Clans leaderboard
  useEffect(() => {
    setLoading(true);
    fetchClanLeaderboard()
      .then((data) => {
        if (Array.isArray(data)) setClans(data);
      })
      .catch((err) => console.error('Failed to load clan leaderboard:', err))
      .finally(() => setLoading(false));
  }, []);

  // Sync with deep-link clan redirects from other pages
  useEffect(() => {
    if (activeClanName) {
      loadClanPage(activeClanName);
    }
  }, [activeClanName]);

  // Load a single Clan Roster view page
  const loadClanPage = async (clanName: string) => {
    setViewLoading(true);
    setViewError('');
    try {
      const clanDetail = await fetchClanDetail(clanName);
      if (!clanDetail || !clanDetail.name) {
        throw new Error('Clan roster not found in database.');
      }
      setCurrentViewedClan(clanDetail);
    } catch (err: any) {
      console.error('Failed to load clan page detail:', err);
      setViewError(err.message || 'Clan not found.');
    } finally {
      setViewLoading(false);
    }
  };

  // Reset page view
  const closeClanPage = () => {
    setCurrentViewedClan(null);
    setViewError('');
    onClearActiveClanName();
  };

  // Handle Search Input Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      loadClanPage(query);
    }
  };

  // Sort member roster by role priorities (Leader -> Owner -> Officer -> Members)
  const sortMembers = (members: ClanMember[]) => {
    const getRolePriority = (role: string) => {
      const uRole = role.toUpperCase();
      if (uRole === 'LEADER' || uRole === 'OWNER') return 1;
      if (uRole === 'OFFICER') return 2;
      return 3;
    };

    return [...members].sort((a, b) => {
      const pA = getRolePriority(a.role);
      const pB = getRolePriority(b.role);
      if (pA !== pB) return pA - pB;
      return b.allScores - a.allScores; // Secondary sort by scores
    });
  };

  // Filter clans hub list by query
  const filteredClans = clans.filter((clan) =>
    clan.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 1. RENDER DETAILED ROSTER PAGE
  if (currentViewedClan || viewLoading || viewError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Back breadcrumbs */}
        <button
          onClick={closeClanPage}
          className="flex items-center space-x-2 text-slate-400 hover:text-gold-bright transition-colors font-mono text-sm border border-transparent hover:border-gold-primary/20 px-3 py-1.5 rounded-lg w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Clans Hub</span>
        </button>

        {viewLoading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-3">
            <div className="w-8 h-8 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Compiling Clan Roster...</span>
          </div>
        ) : viewError ? (
          <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-white uppercase">Search Failed</h3>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">{viewError}</p>
            <button
              onClick={closeClanPage}
              className="bg-obsidian-deep hover:bg-obsidian-card border border-obsidian-border text-white text-xs font-bold font-mono px-5 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : currentViewedClan ? (
          /* Roster presentation page */
          <div className="space-y-8 select-text">
            {/* Header info bar */}
            <div className="bg-gradient-to-br from-obsidian-card to-[#12141D] border border-obsidian-border rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gold-bright uppercase tracking-widest bg-gold-primary/10 border border-gold-primary/25 px-2.5 py-0.5 rounded font-mono w-fit block">
                  ACTIVE CLAN REGISTRY
                </span>
                <h3 className="text-3xl font-black text-white uppercase tracking-tight">
                  [{currentViewedClan.name}]
                </h3>
                {currentViewedClan.description && (
                  <p className="text-sm text-slate-400 max-w-xl leading-relaxed italic">
                    "{currentViewedClan.description}"
                  </p>
                )}
              </div>

              {/* Discord connection link */}
              {currentViewedClan.discordLink && (
                <a
                  href={currentViewedClan.discordLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all font-mono"
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                  <span>Join Discord Server</span>
                </a>
              )}
            </div>

            {/* Performance Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-[#090A0F]/65 p-4 rounded-xl border border-obsidian-border/60 text-xs font-mono text-slate-500">
              <div className="px-2">
                <span className="block text-[9px] uppercase tracking-wider">Championship Score</span>
                <strong className="text-gold-bright text-lg font-black mt-0.5 block">
                  {currentViewedClan.allScores.toLocaleString()}
                </strong>
              </div>
              <div className="px-2">
                <span className="block text-[9px] uppercase tracking-wider">Roster Registry</span>
                <strong className="text-slate-200 text-lg font-black mt-0.5 block">
                  {currentViewedClan.members.length} / 100 Members
                </strong>
              </div>
              <div className="col-span-2 md:col-span-1 px-2">
                <span className="block text-[9px] uppercase tracking-wider flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Created Date</span>
                </span>
                <strong className="text-slate-400 text-xs font-bold mt-2 block">
                  {new Date(currentViewedClan.createdAt).toLocaleDateString()}
                </strong>
              </div>
            </div>

            {/* Roster members grid */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono text-slate-400 tracking-widest uppercase flex items-center space-x-2 border-b border-obsidian-border pb-3">
                <Users2 className="w-4 h-4 text-gold-primary" />
                <span>ROSTER REGISTRY (SORTED BY ROLE)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortMembers(currentViewedClan.members).map((member, index) => {
                  const role = member.role.toUpperCase();
                  const isLeader = role === 'LEADER' || role === 'OWNER';
                  const isOfficer = role === 'OFFICER';

                  return (
                    <ClanMemberCard
                      key={member.user.id + '-' + index}
                      member={member}
                      onSelectPlayer={onSelectPlayer}
                      isLeader={isLeader}
                      isOfficer={isOfficer}
                      fallbackRenders={fallbackRenders}
                      allItemData={allItemData}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // 2. RENDER CLANS HUB LISTING
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 select-text">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-obsidian-border pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <img src="/clan_registry.png" alt="Clans Icon" className="w-8 h-8 rounded-lg object-contain glow-filter-gold" />
            <span>Clans Hub</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1.5">
            View Kirka's Top 32 clans or search any clan to inspect description and roster.
          </p>
        </div>

        {/* Search Clan Form */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search clan by exact name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2.5 bg-obsidian-card border border-obsidian-border rounded-xl text-slate-200 placeholder-slate-500 outline-none focus:border-gold-primary/40 focus:shadow-[0_0_12px_rgba(212,175,55,0.06)] text-sm transition-all"
          />
        </form>
      </div>

      {/* Clans Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-3">
          <div className="w-8 h-8 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Loading Clans...</span>
        </div>
      ) : filteredClans.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-sm">
          No clans match your query. Press Enter to search live.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClans.map((clan, index) => {
            const rank = index + 1;
            return (
              <div
                key={clan.clanId}
                onClick={() => loadClanPage(clan.name)}
                className="card-interactive group cursor-pointer bg-gradient-to-br from-obsidian-card to-[#141621] hover:to-[#191c2b] border border-obsidian-border hover:border-gold-primary/20 p-5 rounded-2xl relative shadow-sm hover:shadow-[0_4px_25px_rgba(0,0,0,0.3)] overflow-hidden"
              >
                {/* Gold Glow hover lines */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold-primary to-gold-bright scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-slate-500 font-bold">#{rank}</span>
                    <h3 className="text-lg font-extrabold text-white group-hover:text-gold-bright transition-colors uppercase">
                      {clan.name}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#090A0F]/70 text-gold-bright border border-gold-primary/20 px-2 py-0.5 rounded">
                    CLAN
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4 bg-[#090A0F]/45 p-3 rounded-xl border border-obsidian-border/50 text-xs font-mono text-slate-400">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase mb-0.5">Members</span>
                    <span className="font-bold text-white text-sm">{clan.membersCount} / 100</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase mb-0.5">Championship Score</span>
                    <span className="font-bold text-gold-bright text-sm">{clan.scores.toLocaleString()}</span>
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
