import React, { useMemo, useState } from 'react';
import type { MarketItem } from '../../utils/csv';
import { fallBackToBaseRender, getSkinRenderUrl } from '../../utils/skinAssets';

/** The groups of pages on the home page; 'skin' is the skin finder. */
export type FilmStopId = 'skin' | 'market' | 'compete' | 'create' | 'live';

const PAGES: Record<Exclude<FilmStopId, 'skin'>, { title: string; links: { id: string; label: string; hint: string }[] }> = {
  market: {
    title: 'Market',
    links: [
      { id: 'prices', label: 'Skins & Prices', hint: 'Every skin and its Hub value' },
      { id: 'trades', label: 'Trades', hint: 'Live offers and trade history' },
      { id: 'renders', label: '3D Renders', hint: 'Every skin, in 3D' },
    ],
  },
  compete: {
    title: 'Compete',
    links: [
      { id: 'wrapped', label: 'Kirka Wrapped', hint: 'Your Kirka story, as a video' },
      { id: 'daily', label: 'Daily Leaderboard', hint: "Today's top scores" },
      { id: 'ranked', label: 'Ranked', hint: 'S&D, 1v1 and 2v2 standings' },
      { id: 'clans', label: 'Clans', hint: 'Top clans and their rosters' },
    ],
  },
  create: {
    title: 'Create',
    links: [
      { id: 'skineditor', label: 'Skin Editor', hint: 'Paint your own skin in 3D' },
      { id: 'aimtrainer', label: 'Aim Trainer', hint: 'Your Kirka sens, FOV and crosshair' },
      { id: 'fit', label: '3D Fit', hint: 'Build and show off a loadout' },
      { id: 'reloadlab', label: 'Reload Lab', hint: 'Reloads on real weapon models' },
    ],
  },
  live: {
    title: 'Live',
    links: [
      { id: 'players', label: 'Lobbies', hint: 'Join a match running now' },
      { id: 'chat', label: 'Kirka Chat', hint: 'The in-game chat, live' },
      { id: 'giveaway', label: 'Giveaway Roulette', hint: 'Pick a winner, Kirka style' },
      { id: 'bot', label: 'Discord Bot', hint: 'Commands and invite' },
    ],
  },
};

const heading = 'font-mono text-[13px] tracking-[0.04em] text-[#f5c518]';
const rowButton = 'block w-full text-left px-3 py-2.5 border-2 border-[#f4f1e8] bg-[#06080d] text-[#f4f1e8] hover:bg-[#f5c518] hover:border-[#f5c518] hover:text-[#06080d] focus-visible:bg-[#f5c518] focus-visible:text-[#06080d] cursor-pointer group';

const clean = (name: string) => (name || '').replace(/^_+/, '').trim();
const weaponOf = (item: any) => (item.type === 'BODY_SKIN' || item.type === 'CHARACTER' ? 'Character' : clean(item.parent?.name) || 'Skin');
const rarityOf = (item: any) => {
  const r = String(item.rarity || '').toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
};

/** Same lookup as the inspect popup: by name and weapon first, then by name alone. */
function priceOf(item: any, prices: Map<string, MarketItem>): string {
  const name = clean(item.name).toLowerCase();
  const weapon = weaponOf(item).toLowerCase();
  const market = prices.get(`${name}_${weapon}`) || prices.get(name);
  if (!market) return 'No price yet';
  if (market.pending) return 'Not priced yet';
  return market.baseValueFormatted;
}

interface SkinStopProps {
  catalog: any[];
  prices: Map<string, MarketItem>;
  onInspect: (name: string, type?: string, amount?: number, textureUrl?: string | null) => void;
  onOpenRender: (item: any) => void;
}

/** The EVERY SKIN stop: type a name, pick a skin, then see its price and info or its 3D render. */
const SkinStop: React.FC<SkinStopProps> = ({ catalog, prices, onInspect, onOpenRender }) => {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<any | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const found: any[] = [];
    for (const item of catalog) {
      if (item.type !== 'WEAPON_SKIN' && item.type !== 'BODY_SKIN') continue;
      if (clean(item.name).toLowerCase().includes(q)) found.push(item);
    }
    // A name that starts with what was typed beats one that merely contains it.
    found.sort((a, b) => {
      const an = clean(a.name).toLowerCase();
      const bn = clean(b.name).toLowerCase();
      return Number(bn.startsWith(q)) - Number(an.startsWith(q)) || an.length - bn.length;
    });
    return found.slice(0, 4);
  }, [query, catalog]);

  if (picked) {
    return (
      <>
        <button type="button" onClick={() => setPicked(null)} className="font-mono text-[13px] text-[#d8dbe2] hover:underline underline-offset-4 cursor-pointer">
          Back to results
        </button>
        <div className="mt-2 flex items-center gap-3">
          <img src={getSkinRenderUrl(picked)} alt="" onError={(e) => fallBackToBaseRender(e, weaponOf(picked) === 'Character' ? 'CHARACTER' : weaponOf(picked))} className="w-20 h-20 object-contain shrink-0 bg-[#14171f]" />
          <div className="min-w-0">
            <p className="text-[20px] font-bold leading-tight text-[#f4f1e8] truncate">{clean(picked.name)}</p>
            <p className="text-[14px] text-[#a9aeb9]">{weaponOf(picked)} · {rarityOf(picked)}</p>
            <p className="mt-0.5 font-mono text-[17px] text-[#f5c518]">{priceOf(picked, prices)}</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            className={rowButton}
            onClick={() => onInspect(clean(picked.name), picked.type === 'BODY_SKIN' ? 'CHARACTER' : clean(picked.parent?.name), 1, picked.textureUrl)}
          >
            <span className="block text-[16px] font-bold leading-tight">Price and info</span>
          </button>
          <button type="button" className={rowButton} onClick={() => onOpenRender(picked)}>
            <span className="block text-[16px] font-bold leading-tight">3D render</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <label htmlFor="home-skin-name" className={heading}>Find a skin</label>
      <input
        id="home-skin-name"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type a skin name"
        spellCheck={false}
        autoComplete="off"
        className="mt-2 block w-full h-[50px] px-3 bg-[#06080d] border-2 border-[#f4f1e8] rounded-none outline-none text-[18px] text-[#f4f1e8] placeholder:text-[#5d626d] focus:border-[#f5c518]"
      />
      {query.trim() && (
        <div className="mt-2 space-y-1.5">
          {catalog.length === 0 && <p className="text-[14px] text-[#a9aeb9]">Skins are still loading...</p>}
          {catalog.length > 0 && matches.length === 0 && <p className="text-[14px] text-[#a9aeb9]">No skin with that name.</p>}
          {matches.map((item) => (
            <button key={item.id ?? `${item.name}-${weaponOf(item)}`} type="button" onClick={() => setPicked(item)} className={`${rowButton} !py-1.5 !px-2 flex items-center gap-2.5`}>
              <img src={getSkinRenderUrl(item)} alt="" loading="lazy" onError={(e) => fallBackToBaseRender(e, weaponOf(item) === 'Character' ? 'CHARACTER' : weaponOf(item))} className="w-10 h-10 object-contain shrink-0 bg-[#14171f]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-tight truncate">{clean(item.name)}</span>
                <span className="block text-[13px] leading-tight opacity-75 truncate">{weaponOf(item)} · {priceOf(item, prices)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

interface FilmStopPanelProps extends SkinStopProps {
  stop: FilmStopId;
  onNavigate: (tab: string) => void;
}

/** What pops up when the player reaches a building. */
export const FilmStopPanel: React.FC<FilmStopPanelProps> = ({ stop, onNavigate, ...skin }) => {
  if (stop === 'skin') return <SkinStop {...skin} />;
  const page = PAGES[stop];
  return (
    <>
      <p className={heading}>{page.title}</p>
      <div className="mt-2 space-y-2">
        {page.links.map((link) => (
          <button key={link.id} type="button" onClick={() => onNavigate(link.id)} className={rowButton}>
            <span className="block text-[17px] font-bold leading-tight">{link.label}</span>
            <span className="block text-[13px] leading-snug opacity-75">{link.hint}</span>
          </button>
        ))}
      </div>
    </>
  );
};
