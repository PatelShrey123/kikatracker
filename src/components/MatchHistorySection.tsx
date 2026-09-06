import React, { useState, useEffect, useMemo } from 'react';
import { Swords, Trophy, Skull, Flame, RefreshCw, Filter } from 'lucide-react';
import { fetchMatchHistory } from '../utils/api';
import type { MatchHistoryItem } from '../utils/api';

interface MatchHistorySectionProps {
  identifier: string;
  playerName: string;
}

// Format timestamp exactly like the Kirka match history screenshot
export function formatMatchDate(isoStr: string) {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      return { dateLine: 'RECENT MATCH', timeLine: '' };
    }
    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    const day = d.getDate();
    let suffix = 'TH';
    if (day % 10 === 1 && day !== 11) suffix = 'ST';
    else if (day % 10 === 2 && day !== 12) suffix = 'ND';
    else if (day % 10 === 3 && day !== 13) suffix = 'RD';

    const month = months[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    const minsStr = String(d.getMinutes()).padStart(2, '0');
    const secsStr = String(d.getSeconds()).padStart(2, '0');

    // Timezone offset format (e.g. GMT+5:30)
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMins = Math.abs(offset) % 60;
    const tzStr = `GMT${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    return {
      dateLine: `${month} ${day}${suffix}, ${year}`,
      timeLine: `${hoursStr}:${minsStr}:${secsStr} ${ampm} ${tzStr}`
    };
  } catch {
    return { dateLine: 'RECENT MATCH', timeLine: '' };
  }
}

export const MatchHistorySection: React.FC<MatchHistorySectionProps> = ({
  identifier,
  playerName
}) => {
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterResult, setFilterResult] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [visibleCount, setVisibleCount] = useState(15);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = async () => {
    if (!identifier) return;
    setLoading(true);
    try {
      const data = await fetchMatchHistory(identifier, 0);
      setMatches(data);
    } catch (err) {
      console.error('Failed to load match history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, [identifier]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  // Filtered matches
  const filteredMatches = useMemo(() => {
    if (filterResult === 'WIN') return matches.filter((m) => m.isWin);
    if (filterResult === 'LOSS') return matches.filter((m) => !m.isWin);
    return matches;
  }, [matches, filterResult]);

  const pagedMatches = useMemo(() => {
    return filteredMatches.slice(0, visibleCount);
  }, [filteredMatches, visibleCount]);

  // Overall Match Stats
  const stats = useMemo(() => {
    const total = matches.length;
    const wins = matches.filter((m) => m.isWin).length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { total, wins, losses, winRate };
  }, [matches]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Stats Summary Banner */}
      <div className="bg-[#0e121d]/90 border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 backdrop-blur-md">
        <div>
          <div className="flex items-center space-x-3">
            <h3 className="text-base sm:text-lg font-black tracking-wider text-white flex items-center space-x-2">
              <Swords className="w-5 h-5 text-gold-primary" />
              <span>{playerName}'s Match History</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold uppercase tracking-wider">
              Live API
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Recent combat records, scores, maps, and timestamps directly recorded from Kirka.io.
          </p>
        </div>

        {/* Quick Stats Summary Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-black/50 border border-white/10 px-3.5 py-2 rounded-xl flex items-center space-x-2.5">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Win Rate</div>
              <div className="text-sm font-black font-mono text-emerald-400">{stats.winRate}%</div>
            </div>
          </div>

          <div className="bg-black/50 border border-white/10 px-3.5 py-2 rounded-xl flex items-center space-x-2.5">
            <Flame className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Victories</div>
              <div className="text-sm font-black font-mono text-white">{stats.wins}</div>
            </div>
          </div>

          <div className="bg-black/50 border border-white/10 px-3.5 py-2 rounded-xl flex items-center space-x-2.5">
            <Skull className="w-4 h-4 text-red-400" />
            <div className="text-left">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Defeats</div>
              <div className="text-sm font-black font-mono text-white">{stats.losses}</div>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh match records"
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-gold-primary/40 text-slate-400 hover:text-white cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-gold-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d101a]/80 p-3.5 rounded-xl border border-white/5">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Filter:</span>

          <div className="flex items-center space-x-1.5 ml-1">
            <button
              onClick={() => {
                setFilterResult('ALL');
                setVisibleCount(15);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                filterResult === 'ALL'
                  ? 'bg-gold-primary/20 border border-gold-primary/50 text-gold-bright shadow-sm'
                  : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              All ({matches.length})
            </button>

            <button
              onClick={() => {
                setFilterResult('WIN');
                setVisibleCount(15);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                filterResult === 'WIN'
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-sm'
                  : 'bg-white/5 border border-white/5 text-slate-400 hover:text-emerald-400'
              }`}
            >
              Wins ({stats.wins})
            </button>

            <button
              onClick={() => {
                setFilterResult('LOSS');
                setVisibleCount(15);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                filterResult === 'LOSS'
                  ? 'bg-red-500/20 border border-red-500/50 text-red-400 shadow-sm'
                  : 'bg-white/5 border border-white/5 text-slate-400 hover:text-red-400'
              }`}
            >
              Defeats ({stats.losses})
            </button>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-500">
          Showing <strong className="text-white">{pagedMatches.length}</strong> of {filteredMatches.length} matches
        </span>
      </div>

      {/* Match History List Rows */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-[#0d101a]/50 rounded-2xl border border-white/5">
          <div className="w-8 h-8 rounded-full border-2 border-gold-primary border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-slate-400 tracking-wider uppercase">Loading Match Records from Kirka API...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-[#0d101a]/50 rounded-2xl border border-white/5 text-slate-500">
          <Swords className="w-10 h-10 opacity-30 text-gold-primary" />
          <p className="text-sm font-mono">No match records found for this player.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedMatches.map((match) => {
            const { dateLine, timeLine } = formatMatchDate(match.date);
            const mapNameClean = match.mapName || 'Shipment';
            const mapImgUrl = `https://api2.kirka.io/api/map-image/${encodeURIComponent(mapNameClean)}/mini`;

            return (
              <div
                key={match.id}
                className="group relative flex items-stretch bg-[#1a2136] hover:bg-[#1f2740] rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-200 shadow-lg hover:shadow-2xl"
              >
                {/* 1. Far Left Vertical Accent Stripe (Green for Win, Red for Defeat) */}
                <div
                  className={`w-2 sm:w-2.5 flex-shrink-0 self-stretch ${
                    match.isWin ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                  }`}
                />

                {/* 2. Map Image Background Container with Uppercase Map Label */}
                <div className="relative w-40 sm:w-64 md:w-80 h-20 sm:h-24 overflow-hidden flex items-center justify-center flex-shrink-0 bg-black/40">
                  <img
                    src={mapImgUrl}
                    alt={mapNameClean}
                    className="absolute inset-0 w-full h-full object-cover brightness-[0.72] contrast-[1.15] group-hover:scale-105 transition-transform duration-500 ease-out"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback if specific map image redirect fails
                      e.currentTarget.src = 'https://api2.kirka.io/api/map-image/Shipment/mini/v1785719320996.webp';
                    }}
                  />
                  {/* Dark Vignette Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/60 pointer-events-none" />

                  {/* Centered Map Name Overlay */}
                  <span
                    className="relative z-10 text-white font-black text-lg sm:text-2xl md:text-3xl tracking-wider uppercase drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)] select-none px-2 text-center"
                    style={{
                      textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)'
                    }}
                  >
                    {mapNameClean}
                  </span>
                </div>

                {/* 3. Right Score & Date Information Panel */}
                <div className="flex-1 flex flex-col justify-center items-end px-4 sm:px-8 py-2 bg-gradient-to-l from-[#192035] to-transparent">
                  {/* Big Score Text */}
                  <div
                    className={`font-mono font-black text-2xl sm:text-3xl md:text-4xl tracking-wider leading-none select-none ${
                      match.isWin ? 'text-[#10b981]' : 'text-[#f87171]'
                    }`}
                  >
                    <span>{match.score1}</span>
                    <span className="mx-2 sm:mx-3 text-slate-500 font-light">-</span>
                    <span>{match.score2}</span>
                  </div>

                  {/* Date & Time formatted directly matching screenshot */}
                  <div className="mt-1.5 sm:mt-2 text-right">
                    <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 tracking-wider uppercase">
                      {dateLine}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono font-medium text-slate-400 tracking-wider uppercase mt-0.5">
                      {timeLine}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Pagination */}
      {visibleCount < filteredMatches.length && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 15)}
            className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-gold-primary/40 text-xs font-mono font-bold text-slate-200 hover:text-white cursor-pointer transition-all active:scale-95 shadow-md"
          >
            Load More Matches ({filteredMatches.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
