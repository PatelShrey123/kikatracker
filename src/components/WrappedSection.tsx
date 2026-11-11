import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Film, Image as ImageIcon, Link2, Loader2, Maximize2, Minimize2, Pause, Play, Search, Share2, Volume2, VolumeX, X } from 'lucide-react';
import { fetchMatchHistory, fetchUserInventory, fetchUserProfile } from '../utils/api';
import type { MatchHistoryItem, UserInventoryItem, UserProfile } from '../utils/api';
import { fetchAndParsePrices, formatValue } from '../utils/csv';
import type { MarketItem } from '../utils/csv';
import { fallBackToBaseRender, getSkinRenderUrl } from '../utils/skinAssets';
import { buildWrapped, defaultYear, durationLabel, hourLabel } from '../utils/wrapped';
import type { Wrapped, WrappedItem } from '../utils/wrapped';
import { canRecordVideo, drawSummary, recordVideo } from '../utils/wrappedCanvas';
import { BAR, playMusicLoop } from '../utils/wrappedMusic';

/** Kirka Wrapped: a player's Kirka story as tap-through slides, ending in an image to share. */

// two bars of the music per slide, so slides change on the beat
const SLIDE_MS = BAR * 2 * 1000;
const IS_PHONE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
const INK = '#11121B';
const CREAM = '#FFF6E0';
const COLORS = {
  yellow: { bg: '#F5C518', fg: INK },
  red: { bg: '#E3202E', fg: CREAM },
  blue: { bg: '#2F6FE0', fg: CREAM },
  dark: { bg: '#171925', fg: CREAM },
  green: { bg: '#2EE68F', fg: INK },
};
type Tone = keyof typeof COLORS;

const n = (v: number) => Math.round(v).toLocaleString();
const pct = (v: number) => `${Math.round(v * 100)}%`;
const dateLabel = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Straight from Kirka. api2's skin-render answers with a relative redirect, so it has to be asked
 * directly: through our /api2 proxy the redirect lands on our old-API route and fails, leaving the
 * plain weapon. api2 allows other sites to draw its renders, so the share image can use them as is.
 */
const renderUrl = (raw: any) => getSkinRenderUrl(raw);


function useCountUp(target: number, run: boolean, ms = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) {
      setValue(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setValue(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return value;
}

const Count: React.FC<{ value: number; decimals?: number; suffix?: string; prefix?: string }> = ({ value, decimals = 0, suffix = '', prefix = '' }) => {
  const v = useCountUp(value, true);
  return (
    <>
      {prefix}
      {decimals ? v.toFixed(decimals) : n(v)}
      {suffix}
    </>
  );
};

/** One line of a slide, rising in after the ones above it. */
const Rise: React.FC<{ i: number; children: React.ReactNode; className?: string }> = ({ i, children, className = '' }) => (
  <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.35, duration: 0.45, ease: 'easeOut' }} className={className}>
    {children}
  </motion.div>
);

const Skin: React.FC<{ item: WrappedItem; className?: string }> = ({ item, className = '' }) => (
  <img
    src={renderUrl(item.raw)}
    alt={item.name}
    onError={(e) => fallBackToBaseRender(e, item.weapon)}
    className={`object-contain drop-shadow-[0_8px_0_rgba(0,0,0,0.25)] ${className}`}
  />
);

interface Slide {
  id: string;
  tone: Tone;
  body: React.ReactNode;
}

function buildSlides(w: Wrapped): Slide[] {
  const s = w.season;
  const L = w.lifetime;
  const big = 'display leading-[0.9] text-[64px] sm:text-[76px]';
  const mid = 'display leading-none text-[34px] sm:text-[40px]';
  const small = 'text-[17px] font-bold leading-snug';
  const slides: Slide[] = [
    {
      id: 'intro',
      tone: 'yellow',
      body: (
        <>
          <Rise i={0} className="display text-[28px] tracking-wide">Kirka Wrapped{s ? ` ${s.year}` : ''}</Rise>
          <Rise i={1} className={`${big} break-words`}>{w.name}</Rise>
          <Rise i={2} className="font-mono text-[18px] font-bold">#{w.shortId} · Level {w.level}</Rise>
          <Rise i={3} className={`${small} mt-6 opacity-80`}>Tap to see your story.</Rise>
        </>
      ),
    },
    {
      id: 'since',
      tone: 'blue',
      body: (
        <>
          <Rise i={0} className={small}>You dropped into Kirka on</Rise>
          <Rise i={1} className={mid}>{dateLabel(w.since)}</Rise>
          <Rise i={2} className={`${big} mt-6`}>
            <Count value={w.daysPlaying} />
          </Rise>
          <Rise i={3} className={small}>days ago. That's {durationLabel(w.daysPlaying)} of Kirka.</Rise>
        </>
      ),
    },
    {
      id: 'grind',
      tone: 'red',
      body: (
        <>
          <Rise i={0} className={small}>You've played</Rise>
          <Rise i={1} className={big}>
            <Count value={L.games} />
          </Rise>
          <Rise i={2} className={mid}>games</Rise>
          <Rise i={3} className={`${small} mt-6`}>
            and won {n(L.wins)} of them. That's a {pct(L.winRate)} win rate.
          </Rise>
        </>
      ),
    },
    {
      id: 'kills',
      tone: 'dark',
      body: (
        <>
          <Rise i={0} className={small}>Players you've sent back to spawn</Rise>
          <Rise i={1} className={`${big} text-[#F5C518]`}>
            <Count value={L.kills} />
          </Rise>
          <Rise i={2} className={`${mid} mt-4`}>
            K/D <Count value={L.kd} decimals={2} />
          </Rise>
          <Rise i={3} className={small}>{L.killsPerGame.toFixed(1)} kills every game, on average.</Rise>
        </>
      ),
    },
    {
      id: 'headshots',
      tone: 'yellow',
      body: (
        <>
          <Rise i={0} className={small}>Right between the eyes</Rise>
          <Rise i={1} className={big}>
            <Count value={L.headshots} />
          </Rise>
          <Rise i={2} className={mid}>headshots</Rise>
          <Rise i={3} className={`${small} mt-6`}>{pct(L.headshotRate)} of all your kills.</Rise>
        </>
      ),
    },
  ];

  if (s) {
    slides.push({
      id: 'season',
      tone: 'blue',
      body: (
        <>
          <Rise i={0} className={mid}>Your {s.year} in ranked</Rise>
          <Rise i={1} className={`${big} mt-4`}>
            <Count value={s.matches} />
          </Rise>
          <Rise i={2} className={small}>ranked matches, {pct(s.winRate)} won</Rise>
          {s.ratingNet !== null && (
            <Rise i={3} className={`${mid} mt-6`}>
              {s.ratingNet >= 0 ? '+' : '−'}
              <Count value={Math.abs(s.ratingNet)} /> rating
            </Rise>
          )}
          {s.bestStreak >= 3 && <Rise i={4} className={small}>Best run: {s.bestStreak} wins in a row.</Rise>}
        </>
      ),
    });
    if (s.favMap) {
      slides.push({
        id: 'map',
        tone: 'red',
        body: (
          <>
            <Rise i={0} className={small}>Your home ground</Rise>
            <Rise i={1} className={`${big} break-words`}>{s.favMap.name}</Rise>
            <Rise i={2} className={`${small} mt-6`}>
              Played {s.favMap.count} times in {s.year}, and you won {pct(s.favMap.winRate)} of them.
            </Rise>
          </>
        ),
      });
    }
    if (s.bestMatch) {
      const b = s.bestMatch;
      slides.push({
        id: 'best',
        tone: 'dark',
        body: (
          <>
            <Rise i={0} className={small}>Your best match of {s.year}</Rise>
            <Rise i={1} className={`${big} text-[#F5C518]`}>
              {b.mine}–{b.theirs}
            </Rise>
            <Rise i={2} className={mid}>
              {b.map ? `on ${b.map}` : 'in ranked'}
            </Rise>
            <Rise i={3} className={`${small} mt-6`}>
              {b.win ? 'A win' : 'Even in a loss'} worth {n(b.xp)} XP, on {dateLabel(b.date)}.
            </Rise>
          </>
        ),
      });
    }
    if (s.favWeekday && s.favHour !== null) {
      slides.push({
        id: 'when',
        tone: 'green',
        body: (
          <>
            <Rise i={0} className={small}>You played the most on</Rise>
            <Rise i={1} className={big}>{s.favWeekday}s</Rise>
            <Rise i={2} className={mid}>around {hourLabel(s.favHour)}</Rise>
            {s.busiestMonth && <Rise i={3} className={`${small} mt-6`}>Your busiest month was {s.busiestMonth}.</Rise>}
          </>
        ),
      });
    }
  }

  const lk = w.locker;
  // one slide for both when the rarest skin is also the priciest
  const sameSkin = !!lk.rarest && !!lk.mostValuable && lk.rarest.raw?.id === lk.mostValuable.raw?.id;
  if (lk.skins) {
    slides.push({
      id: 'locker',
      tone: 'yellow',
      body: (
        <>
          <Rise i={0} className={small}>Your locker holds</Rise>
          <Rise i={1} className={big}>
            <Count value={lk.skins} />
          </Rise>
          <Rise i={2} className={mid}>different skins</Rise>
          <Rise i={3} className={`${small} mt-4`}>
            {lk.copies > lk.skins ? `${n(lk.copies)} counting every copy. ` : ''}
            {lk.worth > 0 ? `Worth about ${formatValue(lk.worth)} on Kirka Hub prices.` : ''}
          </Rise>
          {lk.mostValuable && !sameSkin && (
            <Rise i={4} className="mt-4">
              <Skin item={lk.mostValuable} className="h-28 w-full" />
              <p className="text-[15px] font-bold mt-1">
                Priciest: {lk.mostValuable.name} ({lk.mostValuable.weapon})
              </p>
            </Rise>
          )}
        </>
      ),
    });
  }
  if (lk.rarest) {
    slides.push({
      id: 'rarest',
      tone: 'blue',
      body: (
        <>
          <Rise i={0} className={small}>{sameSkin ? 'Your rarest skin, and your priciest' : 'Your rarest skin'}</Rise>
          <Rise i={1}>
            <Skin item={lk.rarest} className="h-40 w-full" />
          </Rise>
          <Rise i={2} className={`${mid} break-words`}>{lk.rarest.name}</Rise>
          <Rise i={3} className={`${small} mt-4`}>
            Only {n(lk.rarest.owners)} {lk.rarest.owners === 1 ? 'player owns' : 'players own'} one.
          </Rise>
        </>
      ),
    });
  }
  if (w.loadout.weapon || w.loadout.body) {
    slides.push({
      id: 'loadout',
      tone: 'dark',
      body: (
        <>
          <Rise i={0} className={mid}>Your loadout</Rise>
          <Rise i={1} className="flex items-end justify-center gap-2 mt-4">
            {w.loadout.body && <Skin item={w.loadout.body} className="h-44 w-1/3" />}
            {w.loadout.weapon && <Skin item={w.loadout.weapon} className="h-32 w-2/3" />}
          </Rise>
          <Rise i={2} className={`${small} mt-4`}>
            {[w.loadout.weapon && `${w.loadout.weapon.name} ${w.loadout.weapon.weapon}`, w.loadout.body && w.loadout.body.name].filter(Boolean).join(' and ')}. Clean.
          </Rise>
        </>
      ),
    });
  }
  if (w.ratings.length) {
    slides.push({
      id: 'ratings',
      tone: 'red',
      body: (
        <>
          <Rise i={0} className={mid}>Your ranked ratings</Rise>
          {w.ratings.map((r, i) => (
            <Rise key={r.label} i={i + 1} className="mt-4">
              <p className="display text-[56px] leading-none">
                <Count value={r.value} />
              </p>
              <p className={small}>{r.label}</p>
            </Rise>
          ))}
        </>
      ),
    });
  }
  slides.push({
    id: 'persona',
    tone: 'yellow',
    body: (
      <>
        <Rise i={0} className={small}>
          {s ? `In ${s.year}` : 'All in all'}, you are
        </Rise>
        <Rise i={1} className={`${big} mt-2`}>{w.persona.title}</Rise>
        <Rise i={2} className={`${small} mt-4`}>{w.persona.line}</Rise>
        <Rise i={3} className="flex flex-wrap gap-2 justify-center mt-6">
          {w.traits.map((t) => (
            <span key={t} className="px-2.5 py-1 border-2 border-[#11121B] bg-[#FFF6E0] text-[14px] font-bold">
              {t}
            </span>
          ))}
        </Rise>
      </>
    ),
  });
  return slides;
}

// ------------------------------------------------------------------ page

/** Loading steps: 0 profile, 1 locker, 2 ranked matches, 3 ready. */
type Phase = { kind: 'idle' } | { kind: 'loading'; step: number; name?: string; matches: number } | { kind: 'error'; message: string } | { kind: 'ready' };

const STEPS = ['Reading your profile', 'Opening your locker', 'Going through your ranked matches', 'Here we go!'];

// ------------------------------------------------------------------ remembering a player for a while

/** A player's data stays for 10 minutes, so a reload, a replay or a second look doesn't ask Kirka again. */
const CACHE_MS = 10 * 60 * 1000;
const cacheKey = (id: string) => `kirkahub_wrapped_${id.toUpperCase()}`;
interface Cached {
  at: number;
  profile: UserProfile;
  inventory: UserInventoryItem[];
  matches: MatchHistoryItem[];
}

function readCache(id: string): Cached | null {
  try {
    const hit = JSON.parse(sessionStorage.getItem(cacheKey(id)) || 'null') as Cached | null;
    return hit && Date.now() - hit.at < CACHE_MS ? hit : null;
  } catch {
    return null;
  }
}

function writeCache(ids: string[], profile: UserProfile, inventory: UserInventoryItem[], matches: MatchHistoryItem[]) {
  // only what Wrapped reads, so it stays small (some items carry whole textures)
  const slim = inventory.map((e) => ({
    amount: e.amount,
    item: {
      id: e.item.id,
      name: e.item.name,
      type: e.item.type,
      rarity: e.item.rarity,
      salePrice: e.item.salePrice,
      renderUrl: e.item.renderUrl,
      totalOwned: (e.item as any).totalOwned,
      parent: e.item.parent ? { name: e.item.parent.name } : null,
    },
  })) as unknown as UserInventoryItem[];
  const value = JSON.stringify({ at: Date.now(), profile, inventory: slim, matches } satisfies Cached);
  for (const id of new Set(ids.map((x) => x.toUpperCase()))) {
    try {
      sessionStorage.setItem(cacheKey(id), value);
    } catch {}
  }
}

/** The loading screen, in the story's own frame, so the wait already looks like Wrapped. */
const Preparing: React.FC<{ step: number; name?: string; matches: number }> = ({ step, name, matches }) => {
  // matches come a page at a time with no total, so that step fills towards its end as pages arrive
  const progress = step >= 3 ? 1 : (step + (step === 2 ? Math.min(0.9, matches / 400) : 0.4)) / 3;
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative aspect-[9/16] border-[3px] border-[var(--ink)] shadow-[6px_6px_0_var(--ink)] overflow-hidden flex flex-col justify-center px-8"
        style={{ background: '#F5C518', color: '#11121B', width: 'min(420px, 100%, calc(80vh * 9 / 16))' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(currentColor 1.4px, transparent 1.6px)', backgroundSize: '14px 14px' }} />
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="display text-[26px] leading-none">
          {name ? `Hey ${name}!` : 'Kirka Wrapped'}
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="display text-[54px] leading-[0.95] mt-2">
          Preparing your Wrapped
        </motion.p>
        <ul className="mt-7 space-y-2.5">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex items-center gap-2.5 text-[16px] font-bold transition-opacity ${i > step ? 'opacity-35' : ''}`}>
              <span className={`grid place-items-center w-6 h-6 shrink-0 border-2 border-[#11121B] ${i < step ? 'bg-[#11121B] text-[#F5C518]' : 'bg-[#FFF6E0]'}`}>
                {i < step ? '✓' : i === step ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : ''}
              </span>
              {label}
              {i === 2 && step === 2 && matches > 0 ? ` (${matches})` : ''}
            </li>
          ))}
        </ul>
        <div className="mt-7 h-3 border-2 border-[#11121B] bg-[#FFF6E0]">
          <motion.div className="h-full bg-[#E3202E]" initial={{ width: '0%' }} animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ duration: 0.4 }} />
        </div>
        <p className="mt-2 text-[13px] font-bold opacity-70">Usually takes about 10 seconds.</p>
      </div>
    </div>
  );
};

const idFromPath = () => {
  const m = /\/wrapped\/([^/?#]+)/.exec(window.location.pathname);
  return m ? decodeURIComponent(m[1]).replace(/^#/, '') : '';
};

interface WrappedSectionProps {
  marketPrices: Map<string, MarketItem>;
}

export const WrappedSection: React.FC<WrappedSectionProps> = ({ marketPrices }) => {
  const [query, setQuery] = useState(idFromPath);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [data, setData] = useState<{ profile: UserProfile; inventory: UserInventoryItem[]; matches: MatchHistoryItem[]; prices: Map<string, MarketItem> } | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState('');
  const [music, setMusic] = useState(true);
  const [recording, setRecording] = useState<{ done: number; total: number } | null>(null);
  // the share panel, and the file it has made ready to share or save
  const [shareOpen, setShareOpen] = useState(false);
  const [makingImage, setMakingImage] = useState(false);
  const [ready, setReady] = useState<{ blob: Blob; ext: string; kind: 'video' | 'image'; url: string } | null>(null);
  // the music while watching: browsers only allow sound after a tap, so it starts on the first one
  const [soundOn, setSoundOn] = useState(true);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const music$ = useRef<{ ac: AudioContext; stop: () => void } | null>(null);
  // full screen: the story fills the phone or monitor
  const [immersive, setImmersive] = useState(false);
  const immersiveRef = useRef(false);
  immersiveRef.current = immersive;
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const stageRef = useRef<HTMLDivElement>(null);
  const videoCanvas = useRef<HTMLCanvasElement>(null);
  const loadId = useRef(0);

  const load = useCallback(
    async (raw: string) => {
      const id = raw.trim().replace(/^#/, '');
      if (!id) return;
      const run = ++loadId.current;
      const isShort = /^[a-zA-Z0-9]{6}$/.test(id);
      try {
        let profile: UserProfile;
        let inventory: UserInventoryItem[];
        let matches: MatchHistoryItem[];
        const cached = readCache(id);
        if (cached) {
          ({ profile, inventory, matches } = cached);
        } else {
          setPhase({ kind: 'loading', step: 0, matches: 0 });
          profile = await fetchUserProfile(isShort ? id.toUpperCase() : id, isShort);
          if (run !== loadId.current) return;
          setPhase({ kind: 'loading', step: 1, name: profile.name, matches: 0 });
          inventory = await fetchUserInventory(profile.shortId, true).catch(() => [] as UserInventoryItem[]);
          if (run !== loadId.current) return;
          setPhase({ kind: 'loading', step: 2, name: profile.name, matches: 0 });
          matches = [];
          const seen = new Set<string>();
          for (let page = 0; page < 12; page++) {
            const batch = await fetchMatchHistory(profile.shortId, page).catch(() => [] as MatchHistoryItem[]);
            const fresh = batch.filter((m) => !seen.has(m.id));
            fresh.forEach((m) => seen.add(m.id));
            matches.push(...fresh);
            if (!fresh.length) break;
            if (run !== loadId.current) return;
            setPhase({ kind: 'loading', step: 2, name: profile.name, matches: matches.length });
          }
          writeCache([id, profile.shortId], profile, inventory, matches);
          setPhase({ kind: 'loading', step: 3, name: profile.name, matches: matches.length });
        }
        const prices = marketPrices.size ? marketPrices : await fetchAndParsePrices().catch(() => new Map<string, MarketItem>());
        if (run !== loadId.current) return;
        // a beat on "Here we go!" before the story starts, unless it came straight from memory
        if (!cached) await new Promise((r) => setTimeout(r, 600));
        if (run !== loadId.current) return;
        const years = buildWrapped(profile, [], matches, prices, null).years;
        setData({ profile, inventory, matches, prices });
        setYear(defaultYear(years));
        setIndex(0);
        setElapsed(0);
        setPaused(false);
        setPhase({ kind: 'ready' });
        const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
        const path = `${prefix}/wrapped/${profile.shortId}`;
        if (window.location.pathname !== path) window.history.pushState(null, '', path);
      } catch {
        if (run === loadId.current) setPhase({ kind: 'error', message: "Couldn't find that player. Check the ID: it's the 6 characters after the # on your Kirka profile." });
      }
    },
    [marketPrices]
  );

  // a link like /wrapped/EXPERT opens straight into the story
  useEffect(() => {
    const id = idFromPath();
    if (id) void load(id);
    const onPop = () => {
      const next = idFromPath();
      // going back to another player: their story starts silent until a tap
      stopSound();
      setQuery(next);
      if (next) void load(next);
      else setPhase({ kind: 'idle' });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // only on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrapped = useMemo(() => (data ? buildWrapped(data.profile, data.inventory, data.matches, data.prices, year) : null), [data, year]);
  const slides = useMemo(() => (wrapped ? buildSlides(wrapped) : []), [wrapped]);
  const total = slides.length + 1; // the summary card is last
  const onSummary = index >= slides.length;

  const go = useCallback(
    (to: number) => {
      setIndex(Math.max(0, Math.min(total - 1, to)));
      setElapsed(0);
    },
    [total]
  );

  // ---------------------------------------------------------------- music while watching
  const startSound = useCallback(() => {
    if (music$.current) return;
    try {
      const ac = new AudioContext();
      music$.current = { ac, stop: playMusicLoop(ac) };
      setSoundPlaying(true);
    } catch {}
  }, []);
  const stopSound = useCallback(() => {
    music$.current?.stop();
    music$.current = null;
    setSoundPlaying(false);
  }, []);
  /**
   * Wraps a tap so it also starts the music, the first time, and turns the story's own full-screen view
   * into the browser's real fullscreen, which is only allowed straight after a tap.
   */
  const withSound = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    if (soundOn && !recording) startSound();
    if (immersiveRef.current && !document.fullscreenElement) void stageRef.current?.requestFullscreen?.().catch(() => {});
    fn(...args);
  };
  // pausing the story pauses the song
  useEffect(() => {
    const ac = music$.current?.ac;
    if (!ac) return;
    if (paused) void ac.suspend();
    else void ac.resume();
  }, [paused, soundPlaying]);
  // the music stops when there's no story (it already plays while one is being prepared), or while a
  // video records its own
  useEffect(() => {
    if (phase.kind === 'idle' || phase.kind === 'error' || recording) stopSound();
  }, [phase.kind, recording, stopSound]);
  useEffect(() => stopSound, [stopSound]);
  // switching to another browser tab pauses the story and the song, and coming back carries on
  useEffect(() => {
    let pausedByHiding = false;
    const onVisibility = () => {
      if (document.hidden) {
        setPaused((was) => {
          pausedByHiding = !was;
          return true;
        });
        void music$.current?.ac.suspend();
      } else if (pausedByHiding) {
        pausedByHiding = false;
        setPaused(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // ---------------------------------------------------------------- full screen
  const enterImmersive = () => {
    setImmersive(true);
    // real fullscreen where the browser allows it; an iPhone gets the story over the page instead
    void stageRef.current?.requestFullscreen?.().catch(() => {});
  };
  const exitImmersive = () => {
    setImmersive(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  // a finished load opens straight into full screen: the story's own view always works, and the
  // browser's real fullscreen too if the Wrap tap was recent enough (otherwise the first tap does it)
  const wasReady = useRef(false);
  useEffect(() => {
    if (phase.kind === 'ready' && !wasReady.current) {
      setImmersive(true);
      requestAnimationFrame(() => void stageRef.current?.requestFullscreen?.().catch(() => {}));
    }
    wasReady.current = phase.kind === 'ready';
  }, [phase.kind]);
  useEffect(() => {
    if (!immersive) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, [immersive]);

  // stories move on by themselves
  useEffect(() => {
    if (phase.kind !== 'ready' || paused || onSummary) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      setElapsed((e) => e + (t - last));
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase.kind, paused, onSummary, index]);
  useEffect(() => {
    if (elapsed >= SLIDE_MS) go(index + 1);
  }, [elapsed, go, index]);

  useEffect(() => {
    if (phase.kind !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'Escape' && immersive) exitImmersive();
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, index, phase.kind, immersive]);

  const fileName = (ext: string) => `kirka-wrapped-${wrapped?.shortId}${wrapped?.season ? `-${wrapped.season.year}` : ''}.${ext}`;
  const link = wrapped ? `https://kirkahub.online/wrapped/${wrapped.shortId}` : '';
  const shareText = () => `My Kirka Wrapped${wrapped?.season ? ` ${wrapped.season.year}` : ''}. Make yours at kirkahub.online/wrapped`;
  const asFile = (blob: Blob, ext: string) => new File([blob], fileName(ext), { type: blob.type || (ext === 'png' ? 'image/png' : `video/${ext}`) });
  const canShareFile = (blob: Blob, ext: string) => {
    try {
      return !!navigator.canShare?.({ files: [asFile(blob, ext)] });
    } catch {
      return false;
    }
  };

  const keepReady = (blob: Blob, ext: string, kind: 'video' | 'image') => {
    setReady((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { blob, ext, kind, url: URL.createObjectURL(blob) };
    });
  };
  const closeShare = () => {
    setShareOpen(false);
    setNotice('');
    setReady((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
  };

  const saveFile = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(ext);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const makeImage = async () => {
    if (!wrapped || makingImage) return;
    setMakingImage(true);
    setNotice('');
    try {
      keepReady(await drawSummary(wrapped), 'png', 'image');
    } catch {
      setNotice("The image couldn't be made.");
    } finally {
      setMakingImage(false);
    }
  };

  /** Plays the story onto a canvas in real time, with the music, and keeps the recording ready. */
  const makeVideo = async () => {
    if (!wrapped || recording) return;
    // made inside the click: browsers only allow sound that a click started
    let ac: AudioContext;
    try {
      ac = new AudioContext();
    } catch {
      setNotice("This browser can't make the video.");
      return;
    }
    setPaused(true);
    setNotice('');
    setRecording({ done: 0, total: 1 });
    await new Promise((r) => requestAnimationFrame(r));
    try {
      const result = await recordVideo(wrapped, videoCanvas.current!, ac, music, (done, total) => setRecording({ done, total }));
      keepReady(result.blob, result.ext, 'video');
      if (result.ext !== 'mp4') setNotice("This browser only makes WebM videos. If TikTok or Instagram won't take it, make it again in Chrome, Edge or Safari for an MP4.");
    } catch {
      setNotice("The video couldn't be made in this browser. Try Chrome, Edge or Safari.");
    } finally {
      setRecording(null);
      void ac.close();
    }
  };

  /** The phone's (or computer's) own share menu. It has to open from a fresh tap, which is why it's its own button. */
  const shareReady = async () => {
    if (!ready) return;
    try {
      await navigator.share({ files: [asFile(ready.blob, ready.ext)], title: 'My Kirka Wrapped', text: shareText() });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setNotice("Sharing didn't open here. Use Save, then post it from your gallery.");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setNotice('Link copied.');
    } catch {
      setNotice(link);
    }
  };
  const shareLink = async () => {
    try {
      await navigator.share({ title: 'My Kirka Wrapped', text: shareText(), url: link });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') void copyLink();
    }
  };

  const shareBtn = 'flex items-center justify-center gap-2 w-full px-3 py-3 border-2 border-[#11121B] text-left cursor-pointer disabled:opacity-40';

  const tone = onSummary ? COLORS.dark : COLORS[slides[index]?.tone ?? 'dark'];
  const btn = 'btn-interactive flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-[var(--ink)] bg-obsidian-dark text-[14px] font-bold text-slate-200 cursor-pointer';

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian-border pb-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl text-slate-100">
            Kirka <span className="mark">Wrapped</span>
          </h1>
          <p className="text-[15px] text-slate-400 mt-1.5 max-w-[60ch]">Your Kirka story: games, kills, your ranked year, your locker, and who you are as a player.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // a new player gets the song from the top
            stopSound();
            if (soundOn) startSound();
            void load(query);
          }}
          className="flex gap-1.5"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Your ID, like #EXPERT"
            className="w-48 bg-obsidian-dark border-2 border-[var(--ink)] px-3 py-2 text-[15px] font-bold text-slate-100"
            aria-label="Kirka ID"
          />
          <button type="submit" className="display flex items-center gap-1.5 px-4 bg-gold-primary text-[19px] cursor-pointer">
            <Search className="w-4 h-4" /> Wrap
          </button>
        </form>
      </header>

      {phase.kind === 'idle' && <p className="text-[16px] font-bold text-slate-400">Type your Kirka ID above to make your Wrapped.</p>}
      {phase.kind === 'loading' && <Preparing step={phase.step} name={phase.name} matches={phase.matches} />}
      {phase.kind === 'error' && <p className="text-[16px] font-bold text-red-300">{phase.message}</p>}

      {phase.kind === 'ready' && wrapped && (
        <div ref={stageRef} className={immersive ? 'fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center gap-3 p-2' : 'flex flex-col items-center gap-4'}>
          {/* the story */}
          <div
            data-wrapped-story
            className={`relative aspect-[9/16] overflow-hidden select-none ${immersive ? '' : 'border-[3px] border-[var(--ink)] shadow-[6px_6px_0_var(--ink)]'}`}
            // sized from the height too, so a short window keeps the story's 9:16 shape
            style={{
              background: tone.bg,
              color: tone.fg,
              width: immersive ? Math.max(200, Math.min(viewport.w - 16, ((viewport.h - 76) * 9) / 16)) : 'min(420px, 100%, calc(80vh * 9 / 16))',
            }}
          >
            {soundOn && !soundPlaying && !recording && (
              <button type="button" onClick={withSound(() => {})} className="absolute top-6 right-3 z-[15] flex items-center gap-1.5 px-2.5 py-1 bg-black/60 text-white text-[12px] font-bold cursor-pointer">
                <Volume2 className="w-3.5 h-3.5" /> Tap for sound
              </button>
            )}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.12]"
              style={{ backgroundImage: 'radial-gradient(currentColor 1.4px, transparent 1.6px)', backgroundSize: '14px 14px' }}
            />
            <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
              {Array.from({ length: total }, (_, i) => (
                <div key={i} className="h-1 flex-1 bg-current/25 overflow-hidden" style={{ backgroundColor: 'rgba(127,127,127,0.35)' }}>
                  <div className="h-full" style={{ background: 'currentColor', width: i < index ? '100%' : i === index ? `${onSummary ? 100 : Math.min(100, (elapsed / SLIDE_MS) * 100)}%` : '0%' }} />
                </div>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={onSummary ? 'summary' : slides[index].id + (year ?? '')}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex flex-col justify-center text-center px-7 pt-10 pb-8"
              >
                {onSummary ? (
                  <>
                    <Rise i={0} className="display text-[26px] text-[#F5C518]">That's a wrap{wrapped.season ? ` on ${wrapped.season.year}` : ''}</Rise>
                    <Rise i={1} className="display text-[46px] leading-none break-words">{wrapped.name}</Rise>
                    <Rise i={2} className="display text-[30px] mt-2 px-3 py-1 bg-[#E3202E] border-2 border-[#11121B] self-center -rotate-2">
                      {wrapped.persona.title}
                    </Rise>
                    <Rise i={3} className="grid grid-cols-2 gap-2 mt-5 text-left">
                      {(
                        [
                          ['Games', n(wrapped.lifetime.games)],
                          ['Win rate', pct(wrapped.lifetime.winRate)],
                          ['Kills', n(wrapped.lifetime.kills)],
                          ['K/D', wrapped.lifetime.kd.toFixed(2)],
                          ['Headshots', pct(wrapped.lifetime.headshotRate)],
                          wrapped.season ? [`Ranked ${wrapped.season.year}`, `${wrapped.season.matches}`] : ['Level', `${wrapped.level}`],
                        ] as [string, string][]
                      ).map(([k, v]) => (
                        <div key={k} className="bg-[#262A3C] border-2 border-[#11121B] px-2.5 py-1.5">
                          <p className="font-mono text-[11px] font-bold text-[#F5C518] uppercase">{k}</p>
                          <p className="display text-[28px] leading-none">{v}</p>
                        </div>
                      ))}
                    </Rise>
                    <Rise i={4} className="flex justify-center mt-5">
                      <button type="button" onClick={() => setShareOpen(true)} className="display flex items-center gap-2 h-12 px-6 bg-[#F5C518] text-[#11121B] text-[23px] border-2 border-[#11121B] shadow-[3px_3px_0_#11121B] cursor-pointer">
                        <Share2 className="w-5 h-5" /> Share
                      </button>
                    </Rise>
                  </>
                ) : (
                  slides[index].body
                )}
              </motion.div>
            </AnimatePresence>
            {shareOpen && (
              <div className="absolute inset-0 z-30 bg-[#171925] text-[#FFF6E0] flex flex-col p-5 text-left overflow-y-auto">
                <div className="flex items-center justify-between">
                  <p className="display text-[30px] leading-none">{ready ? (ready.kind === 'video' ? 'Your video' : 'Your image') : 'Share your Wrapped'}</p>
                  <button type="button" onClick={closeShare} aria-label="Close" className="w-9 h-9 grid place-items-center border-2 border-[#FFF6E0]/40 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {ready ? (
                  <>
                    {/* the preview fills whatever space the buttons leave, never more */}
                    <div className="relative flex-1 min-h-[120px] my-4">
                      {ready.kind === 'video' ? (
                        <video src={ready.url} controls playsInline className="absolute inset-0 w-full h-full object-contain" />
                      ) : (
                        <img src={ready.url} alt="Your Kirka Wrapped" className="absolute inset-0 w-full h-full object-contain" />
                      )}
                    </div>
                    <div className="space-y-2">
                      {canShareFile(ready.blob, ready.ext) && (
                        <button type="button" onClick={shareReady} className={`${shareBtn} display text-[22px] bg-[#F5C518] text-[#11121B]`}>
                          <Share2 className="w-5 h-5" /> Share
                        </button>
                      )}
                      <button type="button" onClick={() => saveFile(ready.blob, ready.ext)} className={`${shareBtn} display text-[22px] bg-[#E3202E]`}>
                        <Download className="w-5 h-5" /> Save to {IS_PHONE ? 'phone' : 'computer'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReady((old) => {
                            if (old) URL.revokeObjectURL(old.url);
                            return null;
                          })
                        }
                        className="w-full py-1.5 text-[13px] font-bold underline cursor-pointer"
                      >
                        Back
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 mt-5">
                    {canRecordVideo() && (
                      <button type="button" onClick={makeVideo} className={`${shareBtn} bg-[#E3202E]`}>
                        <Film className="w-6 h-6 shrink-0" />
                        <span className="flex-1">
                          <span className="display text-[24px] leading-none block">Video</span>
                          <span className="text-[13px] font-bold">About 40 seconds{music ? ', with music' : ''}. For TikTok, Reels and Shorts.</span>
                        </span>
                      </button>
                    )}
                    {canRecordVideo() && (
                      <label className="flex items-center gap-2 text-[13px] font-bold pl-1 cursor-pointer">
                        <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} className="w-4 h-4 accent-[#F5C518]" />
                        Music in the video (our own, so it won't get muted)
                      </label>
                    )}
                    <button type="button" onClick={makeImage} disabled={makingImage} className={`${shareBtn} bg-[#2F6FE0]`}>
                      {makingImage ? <Loader2 className="w-6 h-6 shrink-0 animate-spin" /> : <ImageIcon className="w-6 h-6 shrink-0" />}
                      <span className="flex-1">
                        <span className="display text-[24px] leading-none block">Image</span>
                        <span className="text-[13px] font-bold">One picture with all your stats. For your story.</span>
                      </span>
                    </button>
                    <div className="flex gap-2">
                      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                        <button type="button" onClick={shareLink} className={`${shareBtn} bg-[#262A3C] text-[15px] font-bold`}>
                          <Share2 className="w-4 h-4" /> Share link
                        </button>
                      )}
                      <button type="button" onClick={copyLink} className={`${shareBtn} bg-[#262A3C] text-[15px] font-bold`}>
                        <Link2 className="w-4 h-4" /> Copy link
                      </button>
                    </div>
                  </div>
                )}
                {notice && <p className="mt-3 text-[13px] font-bold text-[#FFF6E0]/80">{notice}</p>}
              </div>
            )}
            {/* the video being made, shown as it records */}
            {recording && (
              <div className="absolute inset-0 z-40 bg-black flex flex-col">
                <canvas ref={videoCanvas} className="w-full flex-1 min-h-0 object-contain" />
                <div className="bg-[#171925] px-3 py-2 text-[13px] font-bold text-[#FFF6E0]">
                  Making your video… {Math.floor(recording.done)} / {Math.ceil(recording.total)}s. Keep this tab open and on screen.
                  <div className="mt-1.5 h-1.5 bg-white/20">
                    <div className="h-full bg-[#F5C518]" style={{ width: `${(recording.done / recording.total) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}
            {/* tap the left edge to go back, anywhere else to go on */}
            {!onSummary && (
              <>
                <button type="button" aria-label="Previous" onClick={withSound(() => go(index - 1))} className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-[5]" />
                <button type="button" aria-label="Next" onClick={withSound(() => go(index + 1))} className="absolute right-0 top-0 bottom-0 w-2/3 cursor-pointer z-[5]" />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={withSound(() => go(index - 1))} disabled={index === 0} className={`${btn} disabled:opacity-40`} aria-label="Previous slide">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={withSound(() => setPaused((p) => !p))} className={btn} aria-label={paused ? 'Play' : 'Pause'}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button type="button" onClick={withSound(() => go(index + 1))} disabled={onSummary} className={`${btn} disabled:opacity-40`} aria-label="Next slide">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (soundOn) {
                  setSoundOn(false);
                  stopSound();
                } else {
                  setSoundOn(true);
                  startSound();
                }
              }}
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Turn the music off' : 'Turn the music on'}
              className={btn}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={immersive ? exitImmersive : withSound(enterImmersive)}
              aria-label={immersive ? 'Exit full screen' : 'Full screen'}
              className={btn}
            >
              {immersive ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(true);
                setShareOpen(true);
              }}
              className="display flex items-center gap-1.5 px-4 py-1.5 bg-[#F5C518] text-[#11121B] text-[19px] border-2 border-[var(--ink)] cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
            {wrapped.years.length > 0 && !immersive && (
              <div className="flex flex-wrap gap-1.5 ml-2" role="group" aria-label="Ranked year">
                {wrapped.years.map((y) => (
                  <button
                    key={y.year}
                    type="button"
                    onClick={() => {
                      setYear(y.year);
                      go(0);
                    }}
                    aria-pressed={year === y.year}
                    className={`px-2.5 py-1.5 border-2 border-[var(--ink)] text-[13px] font-bold cursor-pointer ${year === y.year ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-obsidian-dark text-slate-300'}`}
                  >
                    {y.year} <span className="opacity-70">({y.matches})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className={`text-[13px] font-bold text-slate-500 text-center max-w-[52ch] ${immersive ? 'hidden' : ''}`}>
            Share makes a phone-sized video of the whole story (with our own music, free to post anywhere) or an image. Lifetime numbers come from your Kirka profile. The year is your ranked matches, the only Kirka data with dates on it. Locker value uses Kirka Hub prices.
          </p>
        </div>
      )}
    </div>
  );
};
