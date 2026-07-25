import React, { useEffect, useState } from 'react';
import { Trophy, Search, ShieldAlert } from 'lucide-react';
import type { RankedLeaderboardResult } from '../utils/api';
import { fetchRanked1v1, fetchRanked2v2, fetchRankedSAD } from '../utils/api';

interface RankedSectionProps {
  onSelectPlayer: (id: string, isShortId: boolean) => void;
}

type RankedTab = 'sad' | '1v1' | '2v2';

export const RankedSection: React.FC<RankedSectionProps> = ({ onSelectPlayer }) => {
  const [activeSubTab, setActiveSubTab] = useState<RankedTab>('sad');
  const [leaderboard, setLeaderboard] = useState<RankedLeaderboardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setLeaderboard([]);
    
    const fetchCall = 
      activeSubTab === 'sad' ? fetchRankedSAD : 
      activeSubTab === '1v1' ? fetchRanked1v1 : 
      fetchRanked2v2;

    fetchCall()
      .then((data) => setLeaderboard(data))
      .catch((err) => console.error(`Failed to load ranked ${activeSubTab}:`, err))
      .finally(() => setLoading(false));
  }, [activeSubTab]);

  const filteredList = leaderboard.filter((player) =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );



  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-obsidian-border pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <img src={`${import.meta.env.BASE_URL}ranked_arena.png`} alt="Ranked Icon" className="w-8 h-8 rounded-lg object-contain glow-filter-gold" />
            <span>Ranked Arena Leaderboard</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1.5">
            Competitive standings based on Elo rating (KLO score) tiers.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex bg-[#090A0F]/80 p-1.5 rounded-xl border border-obsidian-border w-fit">
          <button
            onClick={() => setActiveSubTab('sad')}
            className={`btn-interactive px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeSubTab === 'sad'
                ? 'bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ranked S&D
          </button>
          <button
            onClick={() => setActiveSubTab('1v1')}
            className={`btn-interactive px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeSubTab === '1v1'
                ? 'bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ranked 1v1
          </button>
          <button
            onClick={() => setActiveSubTab('2v2')}
            className={`btn-interactive px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeSubTab === '2v2'
                ? 'bg-gradient-to-r from-gold-primary to-gold-bright text-obsidian-deep font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ranked 2v2
          </button>
        </div>
      </div>

      {/* Control row (Search) */}
      <div className="flex items-center justify-between">
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading}
            className="block w-full pl-9 pr-4 py-2.5 bg-obsidian-card border border-obsidian-border rounded-xl text-slate-200 placeholder-slate-500 outline-none focus:border-gold-primary/40 focus:shadow-[0_0_12px_rgba(212,175,55,0.06)] text-xs transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* Standings list container */}
      <div className="bg-obsidian-card border border-obsidian-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <div className="w-8 h-8 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Fetching Arena Stats...</span>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2 text-center px-4">
            <ShieldAlert className="w-10 h-10 text-slate-600 opacity-60" />
            <h4 className="text-base font-bold text-white uppercase tracking-wider">No Matches</h4>
            <p className="text-xs text-slate-500 max-w-xs">
              There are currently no active players or recorded matches for this arena mode in the current season.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-obsidian-border bg-[#090A0F]/55 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">Rank</th>
                  <th className="py-4 px-6 font-semibold">Player</th>
                  <th className="py-4 px-6 font-semibold text-right">KLO Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50">
                {filteredList.map((player, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  const klo = player.kloSAD || player.klo1V1 || player.klo2V2 || 0;

                  return (
                    <tr
                      key={player.id + '-' + rank}
                      onClick={() => onSelectPlayer(player.id, false)}
                      className="group cursor-pointer hover:bg-obsidian-hover/50 transition-colors"
                    >
                      {/* Rank Index */}
                      <td className="py-4 px-6 font-mono text-sm">
                        {isTop3 ? (
                          <div className="flex items-center space-x-1.5">
                            <Trophy className={`w-4 h-4 ${
                              rank === 1 ? 'text-gold-bright' : rank === 2 ? 'text-slate-300' : 'text-amber-600'
                            }`} />
                            <span className={`font-bold ${
                              rank === 1 ? 'text-gold-bright' : 'text-slate-200'
                            }`}>#{rank}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">#{rank}</span>
                        )}
                      </td>

                      {/* Player Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2.5">
                          <span className="text-sm font-semibold text-white group-hover:text-gold-bright transition-colors">
                            {player.name}
                          </span>
                          <span className="text-[9px] font-mono bg-obsidian-deep text-slate-500 px-1 py-0.5 rounded border border-white/5 uppercase">
                            {player.shortId}
                          </span>
                        </div>
                      </td>

                      {/* KLO rating score */}
                      <td className="py-4 px-6 text-right font-mono text-sm font-bold text-slate-300 group-hover:text-gold-bright transition-colors">
                        {klo.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
