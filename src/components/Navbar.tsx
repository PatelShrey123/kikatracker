import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Tag, Bot, Menu, X, Box, Shirt, MousePointer2, Crosshair, Repeat, Search, Trophy, Swords, Users, Brush, Radio, ChevronDown, Loader2, Target, Clapperboard, Gift } from 'lucide-react';
import { supportsCustomCursor } from '../hooks/useCursorMode';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCustomCursor: boolean;
  toggleCursorMode: () => void;
  onSearch: (id: string, isShortId: boolean) => void;
  isSearching: boolean;
  searchError: string | null;
  onClearSearchError: () => void;
  /** The home page: no bar, only a way to open the full menu. */
  minimal?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  badge?: string;
}

// The twelve pages, sorted by what a visitor came to do.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Compete',
    items: [
      { id: 'wrapped', label: 'Kirka Wrapped', hint: 'Your Kirka story, as a video', icon: Clapperboard, badge: 'NEW' },
      { id: 'daily', label: 'Daily Leaderboard', hint: 'Today\'s top scores', icon: Trophy },
      { id: 'ranked', label: 'Ranked Arena', hint: 'S&D, 1v1 and 2v2 standings', icon: Swords },
      { id: 'clans', label: 'Clans Registry', hint: 'Top clans and rosters', icon: Users },
    ],
  },
  {
    label: 'Market',
    items: [
      { id: 'prices', label: 'Skins & Prices', hint: 'Every skin and its Hub value', icon: Tag },
      { id: 'trades', label: 'Trades Portal', hint: 'Live offers and trade history', icon: Repeat },
      { id: 'renders', label: '3D Renders', hint: 'Every skin, in 3D', icon: Box },
    ],
  },
  {
    label: 'Create',
    items: [
      { id: 'skineditor', label: 'Skin Editor', hint: 'Paint 3px slim skins', icon: Brush },
      { id: 'aimtrainer', label: 'Aim Trainer', hint: 'Train with your Kirka sens and FOV', icon: Target, badge: 'NEW' },
      { id: 'fit', label: '3D Fit', hint: 'Build and show off a loadout', icon: Shirt },
      { id: 'reloadlab', label: 'Reload Lab', hint: 'Reloads on real weapon models', icon: Crosshair },
    ],
  },
  {
    label: 'Live',
    items: [
      { id: 'players', label: 'Live Lobbies', hint: 'Join a running match', icon: Radio, badge: 'LIVE' },
      { id: 'chat', label: 'Kirka Chat', hint: 'The in-game chat, live', icon: MessageSquare },
      { id: 'giveaway', label: 'Giveaway Roulette', hint: 'Pick a winner, Kirka style', icon: Gift, badge: 'NEW' },
      { id: 'bot', label: 'Discord Bot', hint: 'Commands and invite', icon: Bot },
    ],
  },
];

/** Same rules as the home search: a 6-character short ID or a full UUID, with the # optional. */
function parsePlayerId(raw: string): { id: string; isShortId: boolean } | null {
  const id = raw.trim().replace(/^#/, '');
  if (/^[a-zA-Z0-9]{6}$/.test(id)) return { id, isShortId: true };
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) return { id, isShortId: false };
  return null;
}

/** The address of a page, the same one App writes when you open it. */
function pathFor(id: string) {
  const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
  return prefix + (id === 'search' ? '/' : `/${id}`);
}

const Logo: React.FC = () => (
  <a href={pathFor('search')} data-nav-tab="search" className="flex items-center gap-2.5 cursor-pointer shrink-0" aria-label="Kirka Hub home">
    <span className="relative w-12 h-12 flex items-center justify-center -rotate-6">
      <span className="burst absolute inset-0 bg-[var(--ink)]" />
      <span className="burst absolute inset-[3px] bg-[var(--accent)]" />
      <img src={`${import.meta.env.BASE_URL}kikatracker_mascot.png`} alt="" className="relative w-6 h-6 object-cover" />
    </span>
    <span className="display text-[32px] leading-none text-[var(--logo)]">Xpert</span>
  </a>
);

const CursorToggle: React.FC<{ on: boolean; onClick: () => void; className?: string }> = ({ on, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={!on}
    title={on ? 'Switch to your normal system cursor' : 'Switch back to the XPERT target cursor'}
    className={`btn-interactive flex items-center gap-2 h-10 px-2.5 border-2 border-[var(--ink)] bg-obsidian-dark text-[13px] font-bold text-slate-300 cursor-pointer ${className}`}
  >
    {on ? <Crosshair className="w-4 h-4 text-gold-bright" /> : <MousePointer2 className="w-4 h-4" />}
    {on ? 'Target cursor' : 'Normal cursor'}
  </button>
);

const Badge: React.FC<{ text: string }> = ({ text }) => (
  <span className="text-[10px] font-bold px-1 bg-[var(--fill-1)] text-[var(--on-fill-1)] leading-[1.5]">{text}</span>
);

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, isCustomCursor, toggleCursorMode, onSearch, isSearching, searchError, onClearSearchError, minimal = false }) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [formError, setFormError] = useState('');
  const barRef = useRef<HTMLElement>(null);
  const showCursorToggle = supportsCustomCursor();
  const onHome = activeTab === 'search';

  useEffect(() => {
    if (!openGroup) return;
    const onPointer = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  const go = (id: string) => {
    setActiveTab(id);
    setOpenGroup(null);
    setMobileOpen(false);
  };
  const goRef = useRef(go);
  goRef.current = go;

  // The menu is made of real links (ctrl-click opens a new tab, ad and analytics scripts see a page
  // change). This listener sits on window, the last stop of a click, so anything that handled
  // the click first wins; otherwise the page switches in place, without reloading the site.
  // Ctrl/Cmd/Shift/middle clicks are left alone and open a new tab as usual.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[data-nav-tab]');
      if (!link) return;
      e.preventDefault();
      goRef.current(link.getAttribute('data-nav-tab')!);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onClearSearchError();
    const parsed = parsePlayerId(query);
    if (!parsed) {
      setFormError('Use a 6-character ID like #HESHPY, or a full UUID.');
      return;
    }
    setFormError('');
    setMobileOpen(false);
    onSearch(parsed.id, parsed.isShortId);
  };

  // The home page has its own big search box, and it shows these errors itself.
  const shownError = formError || (!onHome ? searchError : null);

  const searchForm = (
    <form onSubmit={submitSearch} className="relative flex-1 min-w-0" role="search">
      <div className="flex items-center h-10 border-2 border-[var(--ink)] bg-obsidian-dark focus-within:bg-obsidian-hover">
        <Search className="w-4 h-4 text-slate-500 ml-2.5 shrink-0" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFormError('');
          }}
          placeholder="Find a player by short ID"
          aria-label="Find a player by short ID"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none px-2 text-[15px] text-slate-100"
        />
        <button type="submit" disabled={isSearching} className="display h-full px-3 bg-[var(--fill-1)] text-[var(--on-fill-1)] text-[17px] cursor-pointer disabled:opacity-50 border-l-2 border-[var(--ink)]">
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
        </button>
      </div>
      {shownError && (
        <p role="alert" className="absolute left-0 right-0 top-full mt-1 z-10 px-2 py-1 bg-[#3D1A20] border-2 border-[var(--ink)] text-[13px] font-bold text-red-300">
          {shownError}
        </p>
      )}
    </form>
  );

  return (
    <>
      {/* Home page: one word in the corner. The drawer below opens at any screen size here. */}
      {minimal && (
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="fixed top-4 right-4 sm:top-5 sm:right-[7vw] z-50 h-11 px-1 font-mono text-[15px] text-[#f4f1e8] hover:underline underline-offset-4 cursor-pointer"
        >
          {mobileOpen ? 'Close' : 'Menu'}
        </button>
      )}

      {/* Desktop masthead */}
      <header ref={barRef} className={`${minimal ? 'hidden' : 'hidden lg:block'} sticky top-0 z-40 bg-obsidian-card border-b-[3px] border-[var(--ink)] shadow-[0_4px_0_var(--ink)]`}>
        <div className="max-w-[1600px] mx-auto px-5 h-[68px] flex items-center gap-5">
          <Logo />

          <nav className="flex items-center gap-1" aria-label="Main">
            <a
              href={pathFor('search')}
              data-nav-tab="search"
              id="nav-tab-desktop-search"
              aria-current={onHome ? 'page' : undefined}
              className={`flex items-center h-10 px-3 border-2 text-[15px] font-bold cursor-pointer transition-colors ${onHome ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] -rotate-1' : 'border-transparent text-slate-200 hover:bg-obsidian-hover'}`}
            >
              Home
            </a>
            {NAV_GROUPS.map((group) => {
              const current = group.items.some((i) => i.id === activeTab);
              const open = openGroup === group.label;
              return (
                <div key={group.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : group.label)}
                    onMouseEnter={() => openGroup && setOpenGroup(group.label)}
                    aria-expanded={open}
                    className={`flex items-center gap-1 h-10 pl-3 pr-2 border-2 text-[15px] font-bold cursor-pointer transition-colors ${current ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--ink)] shadow-[3px_3px_0_var(--ink)] -rotate-1' : `border-transparent text-slate-200 hover:bg-obsidian-hover ${open ? 'bg-obsidian-hover' : ''}`}`}
                  >
                    {group.label}
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="absolute left-0 top-full mt-2 w-[290px] p-1.5 space-y-1 bg-obsidian-card border-2 border-[var(--ink)] shadow-[5px_5px_0_var(--ink)]">
                      {group.items.map(({ id, label, hint, icon: Icon, badge }) => (
                        <a
                          key={id}
                          href={pathFor(id)}
                          data-nav-tab={id}
                          id={`nav-tab-desktop-${id}`}
                          aria-current={activeTab === id ? 'page' : undefined}
                          className={`w-full flex items-center gap-3 px-2.5 py-2 text-left cursor-pointer transition-colors ${activeTab === id ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-slate-200 hover:bg-obsidian-hover'}`}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[15px] font-bold leading-tight">{label}{badge && <Badge text={badge} />}</span>
                            <span className={`block text-[13px] leading-snug ${activeTab === id ? 'text-[var(--on-accent)]' : 'text-slate-400'}`}>{hint}</span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
            {!onHome && <div className="w-full max-w-[340px] flex">{searchForm}</div>}
            {showCursorToggle && <CursorToggle on={isCustomCursor} onClick={toggleCursorMode} className="shrink-0" />}
          </div>
        </div>
      </header>

      {/* Phones and tablets */}
      <div className={minimal ? '' : 'lg:hidden sticky top-0 z-40'}>
        <header className={`${minimal ? 'hidden' : 'flex'} h-[60px] px-3 items-center justify-between bg-obsidian-card border-b-[3px] border-[var(--ink)]`}>
          <Logo />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
            className="w-11 h-11 flex items-center justify-center border-2 border-[var(--ink)] bg-obsidian-dark text-slate-100 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>
        {mobileOpen && (
          <div className={`fixed inset-x-0 bottom-0 z-40 overflow-y-auto bg-obsidian-card px-4 pb-8 space-y-5 ${minimal ? 'top-0 pt-16' : 'top-[60px] pt-4'}`}>
            {!minimal && <div className="flex">{searchForm}</div>}
            <a href={pathFor('search')} data-nav-tab="search" id="nav-tab-mobile-search" className={`block w-full text-left px-3 py-2.5 border-2 text-[16px] font-bold cursor-pointer ${onHome ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--ink)]' : 'border-[var(--ink)] bg-obsidian-dark text-slate-100'}`}>
              Home
            </a>
            {NAV_GROUPS.map((group) => (
              <section key={group.label}>
                <h2 className="display text-[22px] text-gold-bright leading-none mb-1.5">{group.label}</h2>
                <div className="space-y-1">
                  {group.items.map(({ id, label, icon: Icon, badge }) => (
                    <a
                      key={id}
                      href={pathFor(id)}
                      data-nav-tab={id}
                      id={`nav-tab-mobile-${id}`}
                      aria-current={activeTab === id ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 border-2 text-[16px] font-bold cursor-pointer ${activeTab === id ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--ink)]' : 'border-[var(--ink)] bg-obsidian-dark text-slate-100'}`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {badge && <Badge text={badge} />}
                    </a>
                  ))}
                </div>
              </section>
            ))}
            {showCursorToggle && <CursorToggle on={isCustomCursor} onClick={toggleCursorMode} className="w-full justify-center" />}
          </div>
        )}
      </div>
    </>
  );
};
