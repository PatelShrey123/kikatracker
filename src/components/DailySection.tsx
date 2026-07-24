import React, { useEffect, useState } from 'react';
import { Search, Trophy, TrendingUp } from 'lucide-react';
import type { SoloLeaderboardResult } from '../utils/api';
import { fetchSoloLeaderboard } from '../utils/api';

interface DailySectionProps {
  onSelectPlayer: (id: string, isShortId: boolean) => void;
}

export const DailySection: React.FC<DailySectionProps> = ({ onSelectPlayer }) => {
  const [leaderboard, setLeaderboard] = useState<SoloLeaderboardResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchSoloLeaderboard()
      .then((data) => setLeaderboard(data))
      .catch((err) => console.error('Failed to load daily leaderboard:', err))
      .finally(() => setLoading(false));
  }, []);

  const filteredList = leaderboard.filter((player) =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-obsidian-border pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <img src="daily_leaderboard.png" alt="Daily Icon" className="w-8 h-8 rounded-lg object-contain glow-filter-gold" />
            <span>Daily Leaderboard</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1.5">
            Real-time standings of individual players based on cumulative daily scores.
          </p>
        </div>

        {/* Search filter */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2.5 bg-obsidian-card border border-obsidian-border rounded-xl text-slate-200 placeholder-slate-500 outline-none focus:border-gold-primary/40 focus:shadow-[0_0_12px_rgba(212,175,55,0.06)] text-sm transition-all"
          />
        </div>
      </div>

      {/* Leaderboard Table Container */}
      <div className="bg-obsidian-card border border-obsidian-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-3">
            <div className="w-8 h-8 border-2 border-gold-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Loading Standings...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            {searchQuery ? 'No players match your search.' : 'No leaderboard entries found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-obsidian-border bg-[#090A0F]/55 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold">Rank</th>
                  <th className="py-4 px-6 font-semibold">Player</th>
                  <th className="py-4 px-6 font-semibold text-right">Daily Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50">
                {filteredList.map((player, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;
                  
                  return (
                    <tr
                      key={player.userId + '-' + rank}
                      onClick={() => onSelectPlayer(player.userId, false)}
                      className="group cursor-pointer hover:bg-obsidian-hover/50 transition-colors"
                    >
                      {/* Rank Index */}
                      <td className="py-4.5 px-6 font-mono text-sm">
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
                      <td className="py-4.5 px-6">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-white group-hover:text-gold-bright transition-colors">
                            {player.name}
                          </span>
                          {rank === 1 && (
                            <span className="bg-gold-primary/10 text-gold-bright border border-gold-primary/30 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                              Daily MVP
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Daily Score */}
                      <td className="py-4.5 px-6 text-right font-mono text-sm font-bold text-slate-300 group-hover:text-gold-bright transition-colors">
                        <div className="flex items-center justify-end space-x-1">
                          <TrendingUp className="w-3.5 h-3.5 text-slate-500 group-hover:text-gold-primary transition-colors" />
                          <span>{player.scores.toLocaleString()}</span>
                        </div>
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
