import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, Search, Calendar, Plus, Trash2, Clock, 
  Award, Users, RefreshCw, ChevronDown, AlertTriangle 
} from 'lucide-react';
import { fetchClanDetail } from '../utils/api';
import type { ClanResponse, ClanMember } from '../utils/api';

// Interface for localStorage snapshots
interface ClanSnapshot {
  id: string; // ISO String / Timestamp
  dateLabel: string; // Formatting
  scores: Record<string, number>; // memberName/memberId -> score
}

export const ClanTrackerSection: React.FC = () => {
  const [clanInput, setClanInput] = useState('');
  const [activeClan, setActiveClan] = useState<ClanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Local storage snapshots state
  const [snapshots, setSnapshots] = useState<ClanSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('month');

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'role' | 'current' | 'gain'>('gain');
  const [sortAsc, setSortAsc] = useState(false);

  // Auto-refresh interval
  const [lastRefetched, setLastRefetched] = useState<Date>(new Date());

  // Load snapshots from local storage when activeClan changes
  useEffect(() => {
    if (!activeClan) return;
    loadSnapshots();
    setSelectedSnapshotId('month'); // Reset comparison type to month on new search
  }, [activeClan?.name]);

  const loadSnapshots = () => {
    if (!activeClan) return;
    try {
      const allSnapshots = JSON.parse(localStorage.getItem('kikatracker_clan_snapshots') || '{}');
      const clanNameKey = activeClan.name.toLowerCase();
      const clanSnapshots = allSnapshots[clanNameKey] || [];
      setSnapshots(clanSnapshots);
    } catch (e) {
      console.error('Failed to load snapshots:', e);
      setSnapshots([]);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!clanInput.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchClanDetail(clanInput.trim());
      if (!data || !data.name) {
        throw new Error('Clan not found');
      }
      setActiveClan(data);
      setLastRefetched(new Date());
    } catch (err: any) {
      setError('Could not find clan. Check the spelling and try again.');
      setActiveClan(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeSnapshot = () => {
    if (!activeClan) return;

    const now = new Date();
    const dateLabel = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const scoreMap: Record<string, number> = {};
    activeClan.members.forEach(member => {
      // Use user ID (preferred) or name as key
      const key = member.user.id || member.user.name;
      scoreMap[key] = member.allScores;
    });

    const newSnapshot: ClanSnapshot = {
      id: now.toISOString(),
      dateLabel,
      scores: scoreMap
    };

    try {
      const allSnapshots = JSON.parse(localStorage.getItem('kikatracker_clan_snapshots') || '{}');
      const clanNameKey = activeClan.name.toLowerCase();
      const clanSnapshots = allSnapshots[clanNameKey] || [];
      
      const updatedSnapshots = [newSnapshot, ...clanSnapshots];
      allSnapshots[clanNameKey] = updatedSnapshots;
      
      localStorage.setItem('kikatracker_clan_snapshots', JSON.stringify(allSnapshots));
      setSnapshots(updatedSnapshots);
      setSelectedSnapshotId(newSnapshot.id); // Switch comparison to the new snapshot
    } catch (e) {
      console.error('Failed to save snapshot:', e);
    }
  };

  const handleDeleteSnapshot = (idToDelete: string) => {
    if (!activeClan) return;

    try {
      const allSnapshots = JSON.parse(localStorage.getItem('kikatracker_clan_snapshots') || '{}');
      const clanNameKey = activeClan.name.toLowerCase();
      const clanSnapshots = allSnapshots[clanNameKey] || [];
      
      const updatedSnapshots = clanSnapshots.filter((snap: ClanSnapshot) => snap.id !== idToDelete);
      allSnapshots[clanNameKey] = updatedSnapshots;
      
      localStorage.setItem('kikatracker_clan_snapshots', JSON.stringify(allSnapshots));
      setSnapshots(updatedSnapshots);
      
      if (selectedSnapshotId === idToDelete) {
        setSelectedSnapshotId('month');
      }
    } catch (e) {
      console.error('Failed to delete snapshot:', e);
    }
  };

  const handleSort = (field: 'name' | 'role' | 'current' | 'gain') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Helper: Get comparison score & gain for a member
  const getComparisonStats = (member: ClanMember) => {
    const key = member.user.id || member.user.name;

    if (selectedSnapshotId === 'month') {
      // Month-to-date tracking from Kirka API directly (resets on 1st of month at 12:30 IST)
      const gain = member.monthScores || 0;
      const originalScore = Math.max(0, member.allScores - gain);
      return { originalScore, gain };
    }

    // Custom snapshot comparison
    const activeSnapshot = snapshots.find(s => s.id === selectedSnapshotId);
    if (!activeSnapshot || activeSnapshot.scores[key] === undefined) {
      // If member was not in the snapshot (new member)
      return { originalScore: 0, gain: member.allScores };
    }

    const originalScore = activeSnapshot.scores[key];
    const gain = Math.max(0, member.allScores - originalScore);
    return { originalScore, gain };
  };

  // Process and sort member data
  const processedMembers = activeClan
    ? activeClan.members.map(member => {
        const { originalScore, gain } = getComparisonStats(member);
        return {
          ...member,
          originalScore,
          gain
        };
      })
      .filter(member => 
        member.user.name.toLowerCase().includes(searchFilter.toLowerCase())
      )
      .sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortField === 'name') {
          valA = a.user.name.toLowerCase();
          valB = b.user.name.toLowerCase();
        } else if (sortField === 'role') {
          const roleWeights = { LEADER: 4, OWNER: 4, OFFICER: 3, MEMBER: 2, NEWBIE: 1 };
          valA = roleWeights[a.role] || 0;
          valB = roleWeights[b.role] || 0;
        } else if (sortField === 'current') {
          valA = a.allScores;
          valB = b.allScores;
        } else if (sortField === 'gain') {
          valA = a.gain;
          valB = b.gain;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      })
    : [];

  // Metrics
  const totalGain = processedMembers.reduce((sum, m) => sum + m.gain, 0);
  const activeMembersCount = processedMembers.filter(m => m.gain > 0).length;
  const topContributor = processedMembers.length > 0
    ? [...processedMembers].sort((a, b) => b.gain - a.gain)[0]
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 select-text">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-wider text-white flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-gold-bright glow-filter-gold" />
            CLAN XP TRACKER
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-mono uppercase tracking-widest">
            Compare past snapshots to live XP scores • 100% Client-Side Caching
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-grow md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Enter Clan Name (e.g. kiss)..."
              value={clanInput}
              onChange={(e) => setClanInput(e.target.value)}
              className="w-full bg-[#0a0c16]/90 border border-obsidian-border text-sm text-slate-200 pl-10 pr-4 py-2.5 rounded-xl outline-none focus:border-gold-primary/60 focus:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-gold-primary hover:bg-gold-bright text-obsidian-deep font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Track
          </button>
        </form>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold font-mono"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        {!activeClan && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-obsidian-border/50 bg-[#06070c]/50 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-gold-primary/5 flex items-center justify-center border border-gold-primary/20 shadow-[0_0_15px_rgba(212,175,55,0.05)]">
              <TrendingUp className="w-8 h-8 text-gold-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-200">No Clan Selected</h2>
              <p className="text-slate-500 text-sm max-w-sm">
                Enter any Kirka.io clan name in the search bar above to track member XP gains and differences over time.
              </p>
            </div>
          </motion.div>
        )}

        {activeClan && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Clan info card & snapshot controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Info panel */}
              <div className="lg:col-span-2 border border-obsidian-border bg-gradient-to-br from-[#0c0e17]/90 to-[#06070b]/95 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div>
                  <span className="bg-gold-primary/10 border border-gold-primary/30 text-gold-bright px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider">
                    Clan Profile
                  </span>
                  <h2 className="text-3xl font-black tracking-wide text-white mt-3 flex items-baseline gap-2">
                    {activeClan.name.toUpperCase()}
                    <span className="text-xs font-mono text-slate-500 font-normal normal-case">
                      ({activeClan.members.length} members)
                    </span>
                  </h2>
                  <p className="text-slate-400 text-sm mt-2 italic font-mono">
                    "{activeClan.description || 'No description provided.'}"
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500 border-t border-obsidian-border/50 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>Created: <b>{new Date(activeClan.createdAt).toLocaleDateString()}</b></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>Last Synced: <b>{lastRefetched.toLocaleTimeString()}</b></span>
                  </div>
                  <button 
                    onClick={() => handleSearch()}
                    className="ml-auto text-gold-primary hover:text-gold-bright transition flex items-center gap-1.5 cursor-pointer hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sync Live Data
                  </button>
                </div>
              </div>

              {/* Snapshot Controls */}
              <div className="border border-obsidian-border bg-[#090b14]/90 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gold-bright" />
                    COMPARE TIME PERIOD
                  </h3>

                  {/* Dropdown/Select for comparison */}
                  <div className="relative">
                    <select
                      value={selectedSnapshotId}
                      onChange={(e) => setSelectedSnapshotId(e.target.value)}
                      className="w-full bg-[#05060b] border border-obsidian-border text-sm text-slate-200 px-4 py-3 rounded-xl appearance-none outline-none focus:border-gold-primary/60 font-mono cursor-pointer"
                    >
                      <option value="month">📅 Current Month Gain (Resets Monthly at 12:30 IST)</option>
                      {snapshots.map(snap => (
                        <option key={snap.id} value={snap.id}>
                          📷 Custom Snapshot: {snap.dateLabel}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>

                  {selectedSnapshotId === 'month' && (
                    <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                      💡 <b>Month Gain</b> calculates XP difference since the 1st of the current month. The Kirka API resets this monthly at 12:30 PM IST (07:00 UTC).
                    </p>
                  )}

                  {selectedSnapshotId !== 'month' && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-indigo-400 font-mono">Comparing against custom snapshot</span>
                      <button
                        onClick={() => handleDeleteSnapshot(selectedSnapshotId)}
                        className="text-red-400 hover:text-red-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Snapshot
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleTakeSnapshot}
                  className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 font-bold text-sm py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Take Custom Snapshot
                </button>
              </div>
            </div>

            {/* Metric widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Gain Widget */}
              <div className="border border-obsidian-border bg-[#07090f]/75 rounded-2xl p-5 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">Total Clan Gain</span>
                  <span className="text-xl font-black text-emerald-400 block mt-1 font-mono">
                    +{totalGain.toLocaleString()} XP
                  </span>
                </div>
              </div>

              {/* Active Members Widget */}
              <div className="border border-obsidian-border bg-[#07090f]/75 rounded-2xl p-5 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">Active Members</span>
                  <span className="text-xl font-black text-white block mt-1 font-mono">
                    {activeMembersCount} / {processedMembers.length}
                  </span>
                </div>
              </div>

              {/* Top Contributor Widget */}
              <div className="border border-obsidian-border bg-[#07090f]/75 rounded-2xl p-5 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center">
                  <Award className="w-6 h-6 text-gold-bright" />
                </div>
                <div className="flex-grow min-w-0">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">Top Gainer</span>
                  <span className="text-sm font-black text-white block truncate mt-1">
                    {topContributor ? topContributor.user.name : 'N/A'}
                  </span>
                  <span className="text-[10px] text-gold-bright font-mono block">
                    {topContributor ? `+${topContributor.gain.toLocaleString()} XP` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Member list section */}
            <div className="border border-obsidian-border bg-gradient-to-b from-[#08090f]/90 to-[#040509]/95 rounded-2xl overflow-hidden shadow-2xl">
              {/* Filter controls bar */}
              <div className="px-6 py-4 border-b border-obsidian-border/50 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#0a0c15]/30">
                <h3 className="text-sm font-bold text-slate-300 font-mono tracking-wide">
                  MEMBER XP LEDGER ({processedMembers.length} listed)
                </h3>

                <div className="w-full md:w-64 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter by name..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full bg-[#05060b] border border-obsidian-border/80 text-xs text-slate-300 pl-9 pr-4 py-2 rounded-lg outline-none focus:border-indigo-500/50 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Table wrapper */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse select-text">
                  <thead>
                    <tr className="border-b border-obsidian-border/60 text-[10px] font-mono text-slate-500 uppercase tracking-wider bg-[#06070c]/50 select-none">
                      <th className="py-4 px-6 text-center w-16">Rank</th>
                      <th className="py-4 px-6 cursor-pointer hover:text-slate-300 transition" onClick={() => handleSort('name')}>
                        Member Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="py-4 px-6 cursor-pointer hover:text-slate-300 transition text-center" onClick={() => handleSort('role')}>
                        Role {sortField === 'role' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="py-4 px-6 cursor-pointer hover:text-slate-300 transition text-right" onClick={() => handleSort('current')}>
                        Current XP {sortField === 'current' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                      <th className="py-4 px-6 text-right">Start XP</th>
                      <th className="py-4 px-6 cursor-pointer hover:text-slate-300 transition text-right text-gold-bright" onClick={() => handleSort('gain')}>
                        XP Gain {sortField === 'gain' ? (sortAsc ? '▲' : '▼') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedMembers.map((member, idx) => {
                      const gainStr = member.gain > 0 ? `+${member.gain.toLocaleString()}` : '0';
                      const isGainPositive = member.gain > 0;
                      
                      return (
                        <tr 
                          key={member.user.id || member.user.name}
                          className="border-b border-obsidian-border/30 hover:bg-obsidian-card/25 transition-colors duration-150"
                        >
                          <td className="py-4 px-6 text-center font-mono text-xs text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-200">
                            <span className="hover:text-gold-bright cursor-pointer transition">
                              {member.user.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              Lvl {member.user.level}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                              member.role === 'LEADER' || member.role === 'OWNER'
                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : member.role === 'OFFICER'
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                                : member.role === 'MEMBER'
                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                            }`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-sm text-slate-300">
                            {member.allScores.toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-xs text-slate-500">
                            {member.originalScore.toLocaleString()}
                          </td>
                          <td className={`py-4 px-6 text-right font-mono font-bold text-sm ${
                            isGainPositive ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            {gainStr}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
