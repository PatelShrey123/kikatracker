import React, { useEffect, useRef, useState } from 'react';
import type { MarketItem } from '../utils/csv';
import { FilmStopPanel, type FilmStopId } from './home/FilmStopPanels';
import type { Crew, WheelEmote } from './home/crew';

interface SearchSectionProps {
  onSearch: (id: string, isShortId: boolean) => void;
  isLoading: boolean;
  searchError: string | null;
  onClearError: () => void;
  catalog: any[];
  marketPrices: Map<string, MarketItem>;
  onInspectItem: (name: string, type?: string, amount?: number, textureUrl?: string | null) => void;
  onOpenRender: (item: any) => void;
  onNavigate: (tab: string) => void;
}

const LINK_GROUPS: FilmStopId[] = ['skin', 'market', 'compete', 'create', 'live'];
const EMOTES: { name: WheelEmote; label: string }[] = [
  { name: 'wave', label: 'Wave' },
  { name: 'dance', label: 'Dance' },
  { name: 'gg', label: 'GG' },
  { name: 'flex', label: 'Flex' },
  { name: 'spin', label: 'Spin' },
];

/**
 * The home page: the player ID box, with four Kirka players beside it who watch what you do (see
 * home/crew.ts), and every part of the site one click away just below. The box and the links are
 * plain HTML and work before the crew has loaded, or on a device that can't draw them at all.
 */
export const SearchSection: React.FC<SearchSectionProps> = ({ onSearch, isLoading, searchError, onClearError, catalog, marketPrices, onInspectItem, onOpenRender, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [filmReady, setFilmReady] = useState(false);
  const [still] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const crewRef = useRef<Crew | null>(null);

  useEffect(() => {
    let left = false;
    import('./home/crew')
      .then(({ createCrew }) => {
        if (left || !stageRef.current) return;
        crewRef.current = createCrew(stageRef.current, {
          inputRect: () => inputRef.current?.getBoundingClientRect() ?? null,
          onReady: () => setFilmReady(true),
          still,
        });
      })
      .catch((err) => console.warn('[home crew] failed to load:', err));
    return () => {
      left = true;
      crewRef.current?.dispose();
      crewRef.current = null;
    };
  }, [still]);

  // They watch the search: thinking while it loads, a facepalm when nobody's found
  useEffect(() => {
    crewRef.current?.react({ type: 'searching', on: isLoading });
  }, [isLoading]);
  useEffect(() => {
    if (searchError) crewRef.current?.react({ type: 'notFound' });
  }, [searchError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    onClearError();
    const id = query.trim().replace(/^#/, '');
    if (/^[a-zA-Z0-9]{6}$/.test(id)) {
      onSearch(id, true);
    } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
      onSearch(id, false);
    } else {
      setError('That is not a player ID. It is 6 characters, like HESHPY.');
      crewRef.current?.react({ type: 'invalid' });
    }
  };

  const shownError = error || searchError;

  return (
    <div className="night select-text">
      <section className="relative min-h-[86svh] overflow-hidden bg-[#06080d] grid md:grid-cols-2 items-stretch">
        {/* The crew, half the screen; above the search on a phone */}
        <div className="relative h-[46svh] md:h-auto md:min-h-[520px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_70%,#1b2130_0%,transparent_65%)]" aria-hidden="true" />
          <div
            ref={stageRef}
            className={`absolute inset-0 transition-opacity duration-700 ${filmReady ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden="true"
          />
          {filmReady && (
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 flex-wrap px-3">
              {EMOTES.map((e) => (
                <button
                  key={e.name}
                  type="button"
                  onClick={() => crewRef.current?.react({ type: 'emote', name: e.name })}
                  aria-label={`Make them ${e.label.toLowerCase()}`}
                  className="h-8 px-3 border-2 border-[#f4f1e8]/70 bg-[#06080d]/80 font-mono text-[12px] text-[#f4f1e8] hover:bg-[#f5c518] hover:border-[#f5c518] hover:text-[#06080d] cursor-pointer"
                >
                  {e.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex items-center px-4 pb-10 md:pb-0 md:pr-[7vw] md:pl-6">
          <div className="w-full max-w-[480px]">
            <h1 className="text-[34px] sm:text-[44px] leading-[1.05] text-[#f4f1e8] normal-case tracking-normal" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800 }}>
              Look up any Kirka player
            </h1>
            <p className="mt-3 mb-7 text-[16px] text-[#a9aeb9]">Their inventory and what it&apos;s worth, stats, clan and trades.</p>
            <form onSubmit={handleSubmit} role="search">
              <label htmlFor="home-player-id" className="block mb-2 font-mono text-[13px] tracking-[0.04em] text-[#d8dbe2]">
                Player ID
              </label>
              <input
                ref={inputRef}
                id="home-player-id"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (error) setError('');
                  if (searchError) onClearError();
                  crewRef.current?.react({ type: 'type', value: e.target.value });
                }}
                onFocus={() => crewRef.current?.react({ type: 'focus' })}
                onBlur={() => crewRef.current?.react({ type: 'blur' })}
                disabled={isLoading}
                enterKeyHint="search"
                placeholder="HESHPY"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="characters"
                className="block w-full h-[60px] px-4 bg-[#06080d] border-2 border-[#f4f1e8] rounded-none outline-none font-mono text-[24px] text-[#f4f1e8] uppercase placeholder:text-[#5d626d] focus:border-[#f5c518] disabled:opacity-60"
              />
            </form>
            <p role={shownError ? 'alert' : undefined} className={`mt-2 min-h-[20px] font-mono text-[13px] ${shownError ? 'text-[#ff8a80]' : 'text-[#8d929d]'}`}>
              {isLoading ? 'Looking them up...' : shownError || 'Press enter'}
            </p>
          </div>
        </div>
      </section>

      {/* The whole site, one click away */}
      <nav aria-label="Site" className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 items-start">
        {LINK_GROUPS.map((id) => (
          <div
            key={id}
            onMouseEnter={(e) => crewRef.current?.react({ type: 'hoverLink', id, el: e.currentTarget })}
            onMouseLeave={() => crewRef.current?.react({ type: 'hoverLink', id: null, el: null })}
            className="p-4 bg-[#06080d] border-[3px] border-[#f4f1e8] shadow-[6px_6px_0_#f5c518]"
          >
            <FilmStopPanel
              stop={id}
              catalog={catalog}
              prices={marketPrices}
              onInspect={onInspectItem}
              onOpenRender={onOpenRender}
              onNavigate={onNavigate}
            />
          </div>
        ))}
      </nav>

      {/* In words, for anyone who wants them and for search engines. */}
      <section className="max-w-[62ch] mx-auto px-5 pt-16 pb-6 text-[17px] leading-relaxed text-slate-300">
        <h2 className="text-[17px] font-bold normal-case tracking-normal text-slate-100" style={{ fontFamily: 'var(--font-sans)' }}>What this is</h2>
        <p className="mt-2">
          Kirka Hub is a free fan-made tracker for Kirka.io. Put in a player's short ID to see their inventory and what it's worth, their stats, their clan and their recent trades. The rest of the site has every skin with its value, live trade offers, the daily and ranked leaderboards, 3D renders, a fit builder and a skin editor. It isn't affiliated with Kirka.io.
        </p>
        <p className="mt-3 text-[15px] text-slate-400">
          Supported by{' '}
          <button type="button" onClick={() => onSearch('CARSON', true)} className="text-purple-black-wave font-mono cursor-pointer">#CARSON</button>
          {' '}and{' '}
          <button type="button" onClick={() => onSearch('TTTVBJ', true)} className="text-yip-blue-wave font-mono cursor-pointer">#TTTVBJ</button>
        </p>
      </section>
    </div>
  );
};
