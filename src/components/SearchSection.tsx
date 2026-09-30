import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, ArrowRight, ArrowUpRight, Tag, Repeat, Trophy, Swords, Crosshair, Users } from 'lucide-react';
import { fetchSoloLeaderboard, fetchUserProfile } from '../utils/api';
import { getVipType, getVipTextClass, getVipBadgeClass } from '../utils/vip';

interface SearchSectionProps {
  onSearch: (id: string, isShortId: boolean) => void;
  isLoading: boolean;
  searchError: string | null;
  onClearError: () => void;
  onNavigateToPrices?: () => void;
  /** Jump to another tab, for the section cards. */
  onNavigate?: (tabId: string) => void;
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
  { name: 'Hisoka', shortId: '9d42e1d0-cf39-40bd-91c2-7b85e8b36233', role: 'USER', level: 99, desc: 'Top S&D Leaderboard #1 • 5.7K KLO score', isShortId: false },
  { name: 'Bot#0', shortId: '9VECSU', role: 'USER', level: 85, desc: 'Active member • Hub valuation inventory', isShortId: true },
];


// The paint colour is passed to CSS as a custom property, so the stroke and the taped
// edge are drawn by the stylesheet rather than rebuilt per element here.
const markStyle = (c: string) => ({ '--mark-color': c }) as React.CSSProperties;
const tapeStyle = (c: string) => ({ '--tape-color': c }) as React.CSSProperties;

const DESTINATIONS = [
  { id: 'prices', icon: Tag, title: 'Skins & prices', desc: 'Every skin in the game, with its Hub valuation.', can: 'var(--color-spray-lime)' },
  { id: 'trades', icon: Repeat, title: 'Trades', desc: 'What changed hands, month by month.', can: 'var(--color-spray-cyan)' },
  { id: 'daily', icon: Trophy, title: 'Daily leaderboard', desc: 'The top players today, read from Kirka.', can: 'var(--color-spray-orange)' },
  { id: 'ranked', icon: Swords, title: 'Ranked arena', desc: 'Search & Destroy standings and ELO.', can: 'var(--color-spray-pink)' },
  { id: 'reloadlab', icon: Crosshair, title: 'Reload Lab', desc: 'Reload animations on real weapon models.', can: 'var(--color-spray-violet)' },
  { id: 'clans', icon: Users, title: 'Clans', desc: 'Registry, members and clan tracking.', can: 'var(--color-spray-cyan)' },
];

/** Rank colour, hottest first. */
const PODIUM = ['var(--color-spray-pink)', 'var(--color-spray-cyan)', 'var(--color-spray-lime)'];

export const SearchSection: React.FC<SearchSectionProps> = ({
  onSearch,
  isLoading,
  searchError,
  onClearError,
  onNavigateToPrices,
  onNavigate,
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

    const isShortId = trimmed.length === 6 && /^[a-zA-Z0-9]{6}$/.test(trimmed);
    const isUuid = trimmed.length === 36 && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(trimmed);

    if (isShortId) {
      onSearch(trimmed, true);
    } else if (isUuid) {
      onSearch(trimmed, false);
    } else {
      setError('Invalid ID. Please search using a valid 6-character short ID (e.g. #FUYR7K) or a 36-character UUID.');
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (error) setError('');
    if (searchError) onClearError();
  };

  return (
    <div className="max-w-5xl mx-auto px-6 pb-16 select-text">

      {/* Search */}
      <section className="pt-14 pb-10 sm:pt-20">
        <h1 className="display text-[3.5rem] sm:text-[5rem] text-[#EDEDED] leading-[0.92]">
          Kirka{' '}
          <span className="mark text-obsidian-deep" style={markStyle('var(--color-spray-lime)')}>Hub</span>
        </h1>
        <p className="mt-5 text-[15px] text-slate-400 leading-relaxed max-w-[44ch]">
          Look up any player&apos;s inventory, what it&apos;s worth, and what they&apos;ve been trading.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 max-w-2xl">
          <div className="flex items-center gap-2 rounded-md border-2 border-slate-700 bg-obsidian-card p-1.5 focus-within:border-spray-lime transition-colors duration-150">
            <Search className="w-[18px] h-[18px] text-slate-500 ml-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Enter a short ID, e.g. FUYR7K"
              value={query}
              onChange={handleInputChange}
              disabled={isLoading}
              spellCheck={false}
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[#EDEDED] text-[15px] py-2 placeholder-slate-600 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="shrink-0 flex items-center gap-2 h-10 px-5 rounded-md bg-spray-lime hover:bg-spray-cyan text-obsidian-deep text-sm font-extrabold uppercase tracking-wide transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-obsidian-deep/40 border-t-obsidian-deep rounded-full animate-spin" />
              ) : (
                <>
                  Search
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {error || searchError ? (
            <p className="mt-2.5 flex items-start gap-1.5 text-red-400 text-[13px] leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error || searchError}</span>
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] text-slate-600">Six characters, or a full UUID. The # is optional.</p>
          )}
        </form>
      </section>

      {/* Top players today */}
      <section className="pb-12">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="display text-xl text-[#EDEDED]">Top players today</h2>
          <button
            type="button"
            onClick={() => onNavigate?.('daily')}
            className="text-[13px] text-slate-500 hover:text-gold-bright transition-colors cursor-pointer"
          >
            Full leaderboard
          </button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          {featuredProfiles.map((player, i) => {
            const vipType = getVipType(player.shortId);
            const isPlayerVip = vipType !== null;
            return (
              <button
                key={player.shortId}
                type="button"
                onClick={() => onSearch(player.shortId, player.isShortId)}
                className="taped group text-left rounded-md border border-slate-800 bg-obsidian-card hover:bg-obsidian-hover transition-colors duration-150 p-4 cursor-pointer"
                style={tapeStyle(PODIUM[i] || 'var(--color-spray-violet)')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="stencil text-3xl leading-none" style={{ color: PODIUM[i] || 'var(--color-spray-violet)' }}>
                    {i + 1}
                  </span>
                  {isPlayerVip && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getVipBadgeClass(player.shortId)}`}>
                      {vipType === 'yip' ? 'YIP' : 'VIP'}
                    </span>
                  )}
                </div>

                <div className={`mt-3 text-[15px] font-medium truncate ${
                  isPlayerVip ? getVipTextClass(player.shortId) : 'text-[#EDEDED]'
                }`}>
                  {player.name}
                </div>

                <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-600">
                  {player.isShortId && <span className="font-mono">#{player.shortId}</span>}
                  {player.level > 0 && <span className="tabular-nums">Lv {player.level}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Destinations */}
      <section className="pb-12">
        <h2 className="display text-xl text-[#EDEDED] mb-3">Everything else</h2>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATIONS.map(({ id, icon: Icon, title, desc, can }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate?.(id)}
              className="taped group text-left rounded-md border border-slate-800 bg-obsidian-card hover:bg-obsidian-hover transition-colors duration-150 p-4 cursor-pointer"
              style={tapeStyle(can)}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" style={{ color: can }} />
                <span className="display text-[16px] text-[#EDEDED]">{title}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors ml-auto shrink-0" />
              </div>
              <p className="mt-2 text-[12.5px] text-slate-500 leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Footer strip */}
      <section className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-800 pt-5">
        <button
          onClick={onNavigateToPrices}
          className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-slate-800 bg-obsidian-card hover:bg-obsidian-hover hover:border-slate-700 text-[13px] text-slate-300 transition-colors cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Prices online
        </button>

        <span className="text-[13px] text-slate-600">Valued against the Kirka Hub index.</span>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-slate-600">Supported by</span>
          <button
            type="button"
            onClick={() => onSearch('CARSON', true)}
            className="chip-purple-wave h-8 px-2.5 rounded-md text-[12px] font-mono cursor-pointer"
            title="View #CARSON"
          >
            <span className="text-purple-black-wave">#CARSON</span>
          </button>
          <button
            type="button"
            onClick={() => onSearch('TTTVBJ', true)}
            className="chip-yip-wave h-8 px-2.5 rounded-md text-[12px] font-mono cursor-pointer"
            title="View #TTTVBJ (Yip)"
          >
            <span className="text-yip-blue-wave">#TTTVBJ</span>
          </button>
        </div>
      </section>

    </div>
  );
};
