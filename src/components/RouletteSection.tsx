import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Play, RotateCcw, Search, Shuffle, Trash2, UserPlus, Volume2, VolumeX, X } from 'lucide-react';
import { fallBackToBaseRender, getSkinRenderUrl } from '../utils/skinAssets';
import { createRoulette, randomBelow } from './roulette/rouletteScene';
import type { Roulette, RouletteStatus } from './roulette/rouletteScene';

/**
 * Giveaway Roulette: paste or type the entrants, and they play it out round a table as Kirka
 * characters. Made for streams: a full-screen stage view, sound, and a fair pick.
 */

const SEATS = 12;
const STORE = 'kirkahub_roulette_entries_v1';
const PICKS_STORE = 'kirkahub_roulette_characters_v1';

const cleanSkin = (name: string) => name.replace(/^_+|_+$/g, '').trim();
const skinKey = (name: string) => cleanSkin(name).toLowerCase();

/** "HESHPY", or "HESHPY : Gingerman" to give them a character too. One per line, or split by commas. */
const splitEntries = (text: string) =>
  text
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [name, skin] = x.split(':').map((y) => y.trim());
      return { name: name.replace(/^@/, '').slice(0, 24), skin: skin || '' };
    })
    .filter((x) => x.name);

interface CharacterOption {
  key: string;
  name: string;
  texture: string;
  raw: any;
}

/** A searchable grid of every Kirka character skin, with pictures. */
const CharacterPicker: React.FC<{ who: string; options: CharacterOption[]; value: string | null; onPick: (key: string | null) => void; onClose: () => void }> = ({ who, options, value, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.key.includes(q)) : options;
  }, [options, query]);
  const tile = (on: boolean) =>
    `flex flex-col items-center gap-1 p-1.5 border-2 cursor-pointer text-center ${on ? 'border-[var(--accent)] bg-[var(--accent)]/15' : 'border-[var(--ink)] bg-obsidian-dark hover:bg-obsidian-hover'}`;
  return (
    <div className="fixed inset-0 z-[400] grid place-items-center p-4 bg-black/70" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Character for ${who}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-obsidian-card border-[3px] border-[var(--ink)] shadow-[6px_6px_0_var(--ink)]"
      >
        <div className="flex items-center gap-3 p-4 border-b-2 border-[var(--ink)]">
          <p className="display text-[26px] leading-none text-slate-100 flex-1 min-w-0 truncate">
            Character for <span className="text-gold-bright">{who}</span>
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center border-2 border-[var(--ink)] bg-obsidian-dark text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 mx-4 mt-3 px-3 py-2 bg-obsidian-dark border-2 border-[var(--ink)]">
          <Search className="w-4 h-4 text-slate-500" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${options.length} Kirka characters`} className="flex-1 bg-transparent outline-none text-[15px] font-bold text-slate-100" />
        </label>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2 p-4 overflow-y-auto">
          {!query && (
            <button type="button" onClick={() => onPick(null)} className={tile(value === null)}>
              <span className="grid place-items-center w-full aspect-square bg-black/30">
                <Shuffle className="w-8 h-8 text-slate-400" />
              </span>
              <span className="text-[12px] font-bold text-slate-200">Random</span>
            </button>
          )}
          {shown.map((o) => (
            <button key={o.key} type="button" onClick={() => onPick(o.key)} className={tile(value === o.key)} title={o.name}>
              <img src={getSkinRenderUrl(o.raw)} alt="" loading="lazy" onError={(e) => fallBackToBaseRender(e, 'CHARACTER')} className="w-full aspect-square object-contain bg-black/30" />
              <span className="text-[12px] font-bold text-slate-200 w-full truncate">{o.name}</span>
            </button>
          ))}
          {!shown.length && <p className="col-span-full text-[14px] font-bold text-slate-400">No character called that.</p>}
        </div>
      </div>
    </div>
  );
};

/** A fair shuffle, for drawing finalists when there are more entrants than seats. */
function fairShuffle<T>(list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const kirkaTexture = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('data:image')) return url;
  // kirka.io doesn't let other sites use its pictures as textures; ours passes them through
  if (url.startsWith('https://kirka.io/assets/')) return url.replace('https://kirka.io/', '/kirka-assets/');
  return null;
};

interface RouletteSectionProps {
  catalog: any[];
}

export const RouletteSection: React.FC<RouletteSectionProps> = ({ catalog }) => {
  const [entries, setEntries] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || '[]');
      return Array.isArray(saved) ? saved.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  // who's playing as which character (skin key by lower-case name); missing means random
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PICKS_STORE) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  });
  const [picking, setPicking] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [typed, setTyped] = useState('');
  const [pasteText, setPasteText] = useState('');
  // each set of players, with the skins picked for them; a new object is a new table
  const [table, setTable] = useState<{ names: string[]; skins: string[] } | null>(null);
  const [finalists, setFinalists] = useState<{ names: string[]; drawn: number } | null>(null);
  const [status, setStatus] = useState<RouletteStatus | null>(null);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [stageView, setStageView] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Roulette | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(entries));
    } catch {}
  }, [entries]);
  useEffect(() => {
    try {
      localStorage.setItem(PICKS_STORE, JSON.stringify(picks));
    } catch {}
  }, [picks]);

  // every Kirka character skin that has a texture the 3D table can use
  const characters = useMemo<CharacterOption[]>(() => {
    const seen = new Set<string>();
    const out: CharacterOption[] = [];
    for (const c of catalog) {
      if (c?.type !== 'BODY_SKIN' || !c.name) continue;
      const texture = kirkaTexture(c.textureUrl);
      const key = skinKey(c.name);
      if (!texture || !key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, name: cleanSkin(c.name), texture, raw: c });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog]);
  const byKey = useMemo(() => new Map(characters.map((c) => [c.key, c])), [characters]);
  const pickOf = (name: string) => picks[name.toLowerCase()] ?? null;
  const setPick = (name: string, key: string | null) =>
    setPicks((all) => {
      const next = { ...all };
      if (key) next[name.toLowerCase()] = key;
      else delete next[name.toLowerCase()];
      return next;
    });

  /** Adds entrants; a "name : skin" entry also sets their character, if that skin exists. */
  const addEntries = (list: { name: string; skin: string }[]) => {
    const unknown: string[] = [];
    for (const { name, skin } of list) {
      if (!skin) continue;
      const key = skinKey(skin);
      if (byKey.has(key)) setPick(name, key);
      else unknown.push(skin);
    }
    add(list.map((x) => x.name));
    setNotice(unknown.length ? `No Kirka character called ${unknown.map((u) => `"${u}"`).join(', ')}, so ${unknown.length === 1 ? 'that one is' : 'those are'} random.` : '');
  };

  const add = (names: string[]) => {
    setEntries((list) => {
      const seen = new Set(list.map((x) => x.toLowerCase()));
      const next = [...list];
      for (const nme of names) {
        if (seen.has(nme.toLowerCase())) continue;
        seen.add(nme.toLowerCase());
        next.push(nme);
      }
      return next;
    });
  };

  /**
   * Seats these players: each in the character picked for them, the rest in random ones (not already
   * taken). Chosen now, so the skin list arriving later can't reset a game.
   */
  const seat = (names: string[]) => {
    const chosen = names.map((n) => byKey.get(pickOf(n) ?? '')?.texture ?? null);
    const taken = new Set(chosen.filter(Boolean));
    const pool = fairShuffle(characters.map((c) => c.texture).filter((t) => !taken.has(t)));
    let next = 0;
    const skins = chosen.map((t) => t ?? pool[next++ % Math.max(1, pool.length)] ?? '');
    setTable({ names, skins });
  };

  // the 3D table, made fresh for each set of players
  useEffect(() => {
    if (!table || !hostRef.current) return;
    const r = createRoulette(hostRef.current, table.names, table.skins, setStatus);
    engine.current = r;
    r?.setSpeed(speed);
    r?.setMuted(muted);
    return () => {
      r?.dispose();
      engine.current = null;
    };
    // speed and sound reach the running engine through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
  useEffect(() => engine.current?.setSpeed(speed), [speed]);
  useEffect(() => engine.current?.setMuted(muted), [muted]);

  // stage view: the browser's fullscreen where it's allowed, the stage over the page otherwise
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setStageView(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleStage = () => {
    if (stageView) {
      setStageView(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    } else {
      setStageView(true);
      void stageRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  /** Seats the players: everyone if they fit, otherwise a fair draw of finalists first. */
  const setUp = (list: string[]) => {
    if (list.length < 2) return;
    setStatus(null);
    if (list.length <= SEATS) {
      setFinalists(null);
      seat(fairShuffle(list));
      return;
    }
    const drawn = fairShuffle(list).slice(0, SEATS);
    setTable(null);
    setFinalists({ names: drawn, drawn: list.length });
  };

  const rerollWithout = (name: string) => {
    const rest = entries.filter((x) => x !== name);
    setEntries(rest);
    setUp(rest);
  };

  const phase = status?.phase;
  const shot = status?.shot;
  const btn = 'btn-interactive flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-[var(--ink)] bg-obsidian-dark text-[14px] font-bold text-slate-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none';
  const chip = (on: boolean) => `px-2.5 py-1.5 border-2 border-[var(--ink)] text-[13px] font-bold cursor-pointer ${on ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-obsidian-dark text-slate-300'}`;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-obsidian-border pb-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl text-slate-100">
            Giveaway <span className="mark">Roulette</span>
          </h1>
          <p className="text-[15px] text-slate-400 mt-1.5 max-w-[70ch]">
            Your entrants sit round a table as Kirka characters and pass a revolver round. Click, and it moves on. Bang, and they're out. Last one sitting wins.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* the stage */}
        <div className="space-y-3 min-w-0">
          <div
            ref={stageRef}
            className={`bg-[#0b0d14] overflow-hidden select-none ${stageView ? 'fixed inset-0 z-[300]' : 'relative aspect-video border-2 border-[var(--ink)]'}`}
          >
            <div ref={hostRef} className="absolute inset-0" />

            {!table && !finalists && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <div className="max-w-md space-y-2">
                  <p className="display text-[34px] text-slate-100 leading-none">Add your entrants</p>
                  <p className="text-[15px] font-bold text-slate-400">Type names or paste a list on the right, then press Set up the table. Up to {SEATS} sit at the table; with more, {SEATS} finalists are drawn first.</p>
                </div>
              </div>
            )}

            {finalists && (
              <div className="absolute inset-0 grid place-items-center p-6 bg-[#0b0d14]">
                <div className="w-full max-w-2xl text-center space-y-4">
                  <p className="font-mono text-[14px] text-gold-bright">DRAWN FAIRLY FROM {finalists.drawn} ENTRANTS</p>
                  <p className="display text-[44px] leading-none text-slate-100">The {SEATS} finalists</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {finalists.names.map((nme, i) => (
                      <span key={nme} className="px-3 py-1.5 bg-obsidian-card border-2 border-[var(--ink)] text-[16px] font-bold text-slate-100 animate-[fadeIn_.4s_ease-out_both]" style={{ animationDelay: `${i * 0.12}s` }}>
                        {nme}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={() => { seat(finalists.names); setFinalists(null); }} className="display inline-flex items-center gap-2 h-12 px-6 bg-gold-primary text-[22px] cursor-pointer">
                    To the table
                  </button>
                </div>
              </div>
            )}

            {/* what's happening */}
            {table && status && (
              <>
                <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
                  {phase === 'playing' && status.round > 0 && (
                    <span className="px-2.5 py-1 bg-black/60 font-mono text-[14px] text-white">
                      Round {status.round} · {status.left} left
                    </span>
                  )}
                  {status.turn && phase === 'playing' && <span className="px-2.5 py-1 bg-black/60 font-mono text-[14px] text-[#f5c518]">{status.turn}'s turn</span>}
                </div>

                {shot && phase === 'playing' && (
                  <div key={`${shot.name}-${shot.result}-${status.round}`} className="absolute inset-x-0 top-[12%] grid place-items-center pointer-events-none animate-[pop_.5s_ease-out_both]">
                    {shot.result === 'bang' ? (
                      <div className="text-center">
                        <p className="display text-[clamp(56px,10vw,120px)] leading-none text-[#e3202e] [text-shadow:4px_4px_0_#11121b]">BANG!</p>
                        <p className="display text-[clamp(22px,3vw,36px)] text-white [text-shadow:3px_3px_0_#11121b]">{shot.name} is out</p>
                      </div>
                    ) : (
                      <p className="display text-[clamp(34px,6vw,64px)] leading-none text-white/90 [text-shadow:3px_3px_0_#11121b]">*click*</p>
                    )}
                  </div>
                )}

                {phase === 'ready' && (
                  <div className="absolute inset-x-0 bottom-6 grid place-items-center">
                    <button type="button" onClick={() => engine.current?.start()} className="display flex items-center gap-2 h-14 px-8 bg-gold-primary text-[28px] border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] cursor-pointer">
                      <Play className="w-6 h-6" /> Start
                    </button>
                  </div>
                )}
                {phase === 'loading' && <p className="absolute inset-0 grid place-items-center display text-[30px] text-slate-300">Setting the table…</p>}
                {phase === 'error' && <p className="absolute inset-0 grid place-items-center text-[16px] font-bold text-red-300 p-6 text-center">The 3D table couldn't load in this browser.</p>}

                {phase === 'done' && status.winner && (
                  <div className="absolute inset-x-0 top-[8%] grid place-items-center pointer-events-none animate-[pop_.6s_ease-out_both]">
                    <div className="text-center">
                      <p className="font-mono text-[clamp(14px,1.6vw,20px)] text-[#f5c518] [text-shadow:2px_2px_0_#11121b]">LAST ONE SITTING</p>
                      <p className="display text-[clamp(30px,5vw,60px)] leading-none text-white [text-shadow:3px_3px_0_#11121b]">The winner is</p>
                      <p className="display text-[clamp(52px,9vw,120px)] leading-none text-[#f5c518] [text-shadow:5px_5px_0_#11121b] break-all px-4">{status.winner}</p>
                    </div>
                  </div>
                )}
                {phase === 'done' && status.winner && (
                  <div className="absolute inset-x-0 bottom-5 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => rerollWithout(status.winner!)} className={btn}>
                      <RotateCcw className="w-4 h-4" /> Didn't answer? Go again without them
                    </button>
                    <button type="button" onClick={() => setUp(entries)} className={btn}>
                      <Play className="w-4 h-4" /> Play again
                    </button>
                  </div>
                )}
              </>
            )}

            {stageView && (
              <button type="button" onClick={toggleStage} aria-label="Leave stage view" className="absolute top-3 right-3 w-10 h-10 grid place-items-center bg-black/60 border-2 border-white/40 text-white cursor-pointer">
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={toggleStage} className={btn}>
              <Maximize2 className="w-4 h-4" /> Stage view
            </button>
            <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={!muted} className={btn}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />} Sound
            </button>
            <span className="text-[13px] font-bold text-slate-400 ml-1">Speed</span>
            {[1, 2].map((x) => (
              <button key={x} type="button" onClick={() => setSpeed(x)} aria-pressed={speed === x} className={chip(speed === x)}>
                {x}x
              </button>
            ))}
          </div>
          <p className="text-[13px] font-bold text-slate-500 max-w-[80ch]">
            Fair by design: every round the bullet's chamber and the first player are drawn with your browser's secure random generator, so everyone has the same chance. For OBS, use Stage view and capture this window.
          </p>
        </div>

        {/* entrants */}
        <aside className="space-y-4">
          <section className="bg-obsidian-card border p-3.5 space-y-2.5">
            <h2 className="display text-[19px] text-slate-100 leading-none">Entrants ({entries.length})</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addEntries(splitEntries(typed));
                setTyped('');
              }}
              className="flex gap-1.5"
            >
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Name, or Name : Character" className="flex-1 min-w-0 bg-obsidian-dark border-2 border-[var(--ink)] px-2.5 py-1.5 text-[14px] font-bold text-slate-100" aria-label="Add a name" />
              <button type="submit" className={btn} aria-label="Add">
                <UserPlus className="w-4 h-4" />
              </button>
            </form>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={3}
              placeholder={'Or paste a list, one per line or split by commas.\nAdd a character with a colon:  HESHPY : Gingerman'}
              className="w-full bg-obsidian-dark border-2 border-[var(--ink)] px-2.5 py-1.5 text-[13px] font-bold text-slate-100 resize-y"
            />
            <button
              type="button"
              disabled={!pasteText.trim()}
              onClick={() => {
                addEntries(splitEntries(pasteText));
                setPasteText('');
              }}
              className={`${btn} w-full`}
            >
              Add the list
            </button>
            <div className="flex flex-wrap gap-1.5 max-h-[260px] overflow-y-auto">
              {entries.map((nme) => {
                const pick = byKey.get(pickOf(nme) ?? '');
                return (
                <span key={nme} className="flex items-center gap-1 pl-0.5 pr-1 py-0.5 bg-obsidian-dark border-2 border-[var(--ink)] text-[13px] font-bold text-slate-200">
                  <button
                    type="button"
                    onClick={() => setPicking(nme)}
                    title={pick ? `${nme} plays as ${pick.name}. Click to change.` : `Pick ${nme}'s character`}
                    className="flex items-center gap-1.5 pr-1 cursor-pointer hover:text-white"
                  >
                    <span className="grid place-items-center w-7 h-7 bg-black/40 border border-[var(--ink)] overflow-hidden shrink-0">
                      {pick ? (
                        <img src={getSkinRenderUrl(pick.raw)} alt="" onError={(e) => fallBackToBaseRender(e, 'CHARACTER')} className="w-full h-full object-contain" />
                      ) : (
                        <Shuffle className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </span>
                    {nme}
                  </button>
                  <button type="button" onClick={() => setEntries((l) => l.filter((x) => x !== nme))} aria-label={`Remove ${nme}`} className="px-1 text-slate-500 hover:text-red-300 cursor-pointer">
                    ×
                  </button>
                </span>
                );
              })}
            </div>
            {notice && <p className="text-[12px] font-bold text-amber-300">{notice}</p>}
            <p className="text-[12px] font-bold text-slate-500">Click someone's picture to pick their Kirka character; anyone left on random gets one at the table. Duplicates are skipped, and the list is kept in this browser.</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setUp(entries)} disabled={entries.length < 2 || phase === 'playing'} className="display flex-1 h-11 bg-gold-primary text-[20px] cursor-pointer disabled:opacity-40">
                Set up the table
              </button>
              <button type="button" onClick={() => setEntries([])} disabled={!entries.length || phase === 'playing'} className={btn} aria-label="Clear the list">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </section>
        </aside>
      </div>

      {picking && (
        <CharacterPicker
          who={picking}
          options={characters}
          value={pickOf(picking)}
          onPick={(key) => {
            setPick(picking, key);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
};
