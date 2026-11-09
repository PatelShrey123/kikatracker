import React, { useEffect, useRef, useState } from 'react';
import type { MarketItem } from '../utils/csv';
import { FilmStopPanel } from './home/FilmStopPanels';
import { FILM_STOPS, type FilmStopId } from './home/filmStops';

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

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (a: number, b: number, v: number) => clamp01((v - a) / (b - a));

/**
 * The home page: a player ID box over a film that runs as you scroll (see home/homeFilm.ts). The box
 * is plain HTML and works before the film has loaded, or on a device that can't run it at all.
 */
export const SearchSection: React.FC<SearchSectionProps> = ({ onSearch, isLoading, searchError, onClearError, catalog, marketPrices, onInspectItem, onOpenRender, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [filmReady, setFilmReady] = useState(false);
  const [still] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const panelRefs = useRef<Partial<Record<FilmStopId, HTMLDivElement | null>>>({});

  useEffect(() => {
    const progress = () => {
      const track = trackRef.current;
      if (!track || still) return 0;
      const room = track.offsetHeight - window.innerHeight;
      return room > 0 ? clamp01(-track.getBoundingClientRect().top / room) : 0;
    };

    // The box shows at the very start and the very end of the film, and gets out of the way between.
    const onScroll = () => {
      const p = progress();
      const shown = Math.max(1 - ramp(0.02, 0.045, p), ramp(0.93, 0.975, p));
      if (formRef.current) {
        formRef.current.style.opacity = String(shown);
        formRef.current.style.visibility = shown > 0.01 ? 'visible' : 'hidden';
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - ramp(0, 0.015, p));
      // A building's popup pops open while the player is in front of it.
      for (const stop of FILM_STOPS) {
        const panel = panelRefs.current[stop.id];
        if (!panel) continue;
        const on = p >= stop.from && p <= stop.to;
        panel.style.opacity = on ? '1' : '0';
        panel.style.visibility = on ? 'visible' : 'hidden';
        panel.style.transform = on ? 'none' : 'scale(0.82) translateY(14px)';
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    let film: { dispose: () => void } | null = null;
    let left = false;
    import('./home/homeFilm')
      .then(({ createHomeFilm }) => {
        if (left || !stageRef.current) return;
        film = createHomeFilm(stageRef.current, progress, () => setFilmReady(true), still);
      })
      .catch((err) => console.warn('[home film] failed to load:', err));

    return () => {
      left = true;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      film?.dispose();
      // The film is thousands of pixels tall, so whatever page comes next must not inherit that scroll.
      window.scrollTo(0, 0);
    };
  }, [still]);

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
    }
  };

  const shownError = error || searchError;

  return (
    <div className="night select-text">
      <div ref={trackRef} className={still ? 'h-[100svh]' : 'h-[1100vh] md:h-[1400vh]'}>
        <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#06080d]">
          <div
            ref={stageRef}
            className={`absolute inset-0 transition-opacity duration-700 ${filmReady ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden="true"
          />

          <h1 className="sr-only">Kirka Hub: look up any Kirka.io player</h1>

          <div ref={formRef} className="absolute left-4 right-4 bottom-[13svh] sm:right-auto sm:left-[7vw] sm:w-[440px]">
            <form onSubmit={handleSubmit} role="search">
              <label htmlFor="home-player-id" className="block mb-2 font-mono text-[13px] tracking-[0.04em] text-[#d8dbe2]">
                Player ID
              </label>
              <input
                id="home-player-id"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (error) setError('');
                  if (searchError) onClearError();
                }}
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

          {FILM_STOPS.map((stop) => (
            <div
              key={stop.id}
              ref={(el) => {
                panelRefs.current[stop.id] = el;
              }}
              style={{ opacity: 0, visibility: 'hidden', transform: 'scale(0.82) translateY(14px)' }}
              className="absolute left-3 right-3 bottom-3 max-h-[52svh] overflow-y-auto overscroll-contain md:right-auto md:left-[4vw] md:bottom-auto md:top-1/2 md:-mt-[150px] md:w-[360px] md:max-h-[76svh] p-4 bg-[#06080d] border-[3px] border-[#f4f1e8] shadow-[6px_6px_0_#f5c518] origin-bottom-left transition-[transform,opacity] duration-200 ease-[cubic-bezier(.2,1.5,.4,1)]"
            >
              <FilmStopPanel
                stop={stop.id}
                catalog={catalog}
                prices={marketPrices}
                onInspect={onInspectItem}
                onOpenRender={onOpenRender}
                onNavigate={onNavigate}
              />
            </div>
          ))}

          {!still && (
            <p ref={hintRef} aria-hidden="true" className="absolute bottom-5 inset-x-0 text-center font-mono text-[13px] text-[#8d929d]">
              Scroll
            </p>
          )}
        </div>
      </div>

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
