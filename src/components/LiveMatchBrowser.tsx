import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Search, 
  SlidersHorizontal
} from 'lucide-react';
import { 
  fetchRegionRooms, 
  fetchAllRegionsSummary, 
  REGIONS
} from '../utils/serversApi';
import type { LiveRoom, RegionSummary } from '../utils/serversApi';

export const LiveMatchBrowser: React.FC = () => {
  const [activeRegion, setActiveRegion] = useState<string>('eu');
  const [summaries, setSummaries] = useState<RegionSummary[]>([]);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [hideFull, setHideFull] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Fetch summaries for all regions
  const refreshSummaries = useCallback(() => {
    fetchAllRegionsSummary()
      .then((data) => setSummaries(data))
      .catch((err) => console.warn('Region summary load failed:', err));
  }, []);

  // Fetch rooms for active region
  const loadRooms = useCallback((regionKey: string, showSpinner = true) => {
    if (showSpinner) setLoadingRooms(true);
    setError(null);

    fetchRegionRooms(regionKey)
      .then((data) => {
        setRooms(data);
        setLastRefreshed(new Date());
      })
      .catch((err) => {
        console.error('Failed to fetch rooms:', err);
        setError(err instanceof Error ? err.message : 'Could not fetch live rooms');
      })
      .finally(() => {
        if (showSpinner) setLoadingRooms(false);
      });
  }, []);

  useEffect(() => {
    refreshSummaries();
    loadRooms(activeRegion);
  }, [activeRegion, loadRooms, refreshSummaries]);

  // Background silent poll every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadRooms(activeRegion, false);
      refreshSummaries();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeRegion, loadRooms, refreshSummaries]);

  const handleCopyCode = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedCode(tag);
    setTimeout(() => {
      setCopiedCode((curr) => (curr === tag ? null : curr));
    }, 2000);
  };

  const handleJoinLobby = (joinUrl: string) => {
    window.open(joinUrl, '_blank', 'noopener,noreferrer');
  };

  const availableModes = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      if (r.mode) set.add(r.mode.toUpperCase());
    });
    return Array.from(set);
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchSearch =
        r.map.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.mode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchMode =
        selectedMode === 'ALL' || r.mode.toUpperCase() === selectedMode;

      const matchFull = !hideFull || !r.isFull;

      return matchSearch && matchMode && matchFull;
    });
  }, [rooms, searchTerm, selectedMode, hideFull]);

  const getModeBadge = (mode: string) => {
    const m = mode.toUpperCase();
    if (m === 'TDM') return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    if (m === 'DM' || m === 'FFA') return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (m === 'POINT' || m === 'HARDPOINT') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (m === 'PARKOUR') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
  };

  return (
    <div className="space-y-4">
      {/* Clean Region Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {Object.values(REGIONS).map((reg) => {
          const isSelected = activeRegion === reg.id;
          const summary = summaries.find((s) => s.id === reg.id);
          const count = summary ? summary.playersCount : null;

          return (
            <button
              key={reg.id}
              onClick={() => setActiveRegion(reg.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{reg.flag}</span>
              <span>{reg.name.split(' ')[0]}</span>
              {count !== null && (
                <span className={`text-[11px] tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Clean Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by map name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#11131a] border border-slate-800 rounded px-8 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-slate-600 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#11131a] border border-slate-800 rounded px-2.5 py-1.5">
            <SlidersHorizontal className="w-3 h-3 text-slate-500" />
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="bg-transparent text-xs text-slate-300 outline-none border-0 ring-0 cursor-pointer"
            >
              <option value="ALL" className="bg-[#11131a]">All Modes</option>
              {availableModes.map((mode) => (
                <option key={mode} value={mode} className="bg-[#11131a]">
                  {mode}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideFull}
              onChange={(e) => setHideFull(e.target.checked)}
              className="accent-slate-400 rounded"
            />
            <span>Open slots</span>
          </label>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 tabular-nums">
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          <button
            onClick={() => loadRooms(activeRegion, true)}
            disabled={loadingRooms}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-800 bg-obsidian-card hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loadingRooms ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-500/30 bg-red-500/5 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Server Browser List / Table */}
      {loadingRooms ? (
        <div className="py-20 text-center text-xs text-slate-500">
          Loading active lobbies…
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-obsidian-card border border-slate-800/80 rounded-md">
          No matches currently running in this region.
        </div>
      ) : (
        <div className="border border-slate-800/80 rounded-md overflow-hidden bg-obsidian-card">
          {/* Table Header (hidden on mobile, visible on desktop) */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 text-[11px] text-slate-400 font-medium">
            <div className="col-span-4">Map &amp; Mode</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Players</div>
            <div className="col-span-3 text-right">Join Lobby</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-800/60">
            {filteredRooms.map((room) => {
              const occupancy = room.players / (room.maxPlayers || 8);
              const isFull = room.players >= room.maxPlayers;

              return (
                <div
                  key={room.tag}
                  className="p-3 sm:px-4 sm:py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center hover:bg-slate-900/30 transition-colors"
                >
                  {/* Map & Mode */}
                  <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${getModeBadge(room.mode)}`}>
                      {room.mode}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate" title={room.map}>
                      {room.map}
                    </span>
                    {room.isCustomMap && (
                      <span className="text-[9px] text-slate-500 uppercase shrink-0">custom</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-2 text-xs text-slate-400 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${room.inRound ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span>{room.inRound ? 'In match' : 'In lobby'}</span>
                  </div>

                  {/* Players */}
                  <div className="col-span-3 flex items-center gap-3">
                    <span className={`text-xs tabular-nums font-mono ${isFull ? 'text-red-400' : 'text-slate-300'}`}>
                      {room.players}/{room.maxPlayers}
                    </span>
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full ${isFull ? 'bg-red-400' : occupancy > 0.75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, Math.round(occupancy * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleCopyCode(room.tag)}
                      title="Copy server tag"
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {copiedCode === room.tag ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{room.code}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleJoinLobby(room.joinUrl)}
                      disabled={isFull}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                        isFull
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                          : 'bg-white hover:bg-slate-200 text-black shadow-sm'
                      }`}
                    >
                      <span>Join</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
