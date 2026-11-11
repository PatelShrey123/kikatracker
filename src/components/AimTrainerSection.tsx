import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, Crosshair, Image as ImageIcon, Maximize, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { AimEngine, DRILLS } from './aim/aimEngine';
import type { DrillId, DrillResult, EngineState, Hud, TouchControl } from './aim/aimEngine';
import {
  DEFAULT_SETTINGS,
  GUNS,
  GUN_ADS,
  adsFov,
  cmPer360,
  crosshairSvg,
  hitmarkerSvg,
  keyLabel,
  loadSettings,
  parseKirkaExport,
  saveSettings,
  svgUrl,
  touchDegrees,
} from '../utils/kirkaSettings';
import type { Gun, KirkaSettings, SavedSettings } from '../utils/kirkaSettings';

const BEST_KEY = 'kirkahub_aim_best_v1';
const PREFS_KEY = 'kirkahub_aim_prefs_v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) || 'null') };
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const fmtScore = (drill: DrillId, score: number) => {
  const d = DRILLS.find((x) => x.id === drill)!;
  if (drill === 'tracking') return `${score.toFixed(1)}%`;
  if (d.better === 'lower') return `${score} ms`;
  return `${score}`;
};

const EMPTY_HUD: Hud = { time: 0, kills: 0, shots: 0, hits: 0, onTarget: 0, turned: 0, aimed: false, fov: 90, fps: 0 };
// The desktop app shows its frame rate, since an uncapped frame rate is what it's for
const IS_DESKTOP = import.meta.env.MODE === 'desktop';
// Phones and tablets get Kirka's touch controls. A laptop with a touchscreen still has a mouse, so it doesn't.
const IS_TOUCH =
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(any-pointer: fine)').matches;
// Phone scores aren't comparable with mouse ones, so they're kept apart
const BEST_STORE = IS_TOUCH ? `${BEST_KEY}_touch` : BEST_KEY;
// The desktop app runs an older Chrome without aspect-ratio or the translate property: the stage keeps its
// 16:9 shape with padding instead, and centred overlays use a plain transform
const NO_ASPECT = typeof CSS !== 'undefined' && !CSS.supports('aspect-ratio: 1');
const CENTER: React.CSSProperties = { transform: 'translate(-50%, -50%)' };
const CENTER_X: React.CSSProperties = { transform: 'translateX(-50%)' };

export const AimTrainerSection: React.FC = () => {
  const [saved, setSaved] = useState<SavedSettings>(() => loadSettings());
  const [prefs, setPrefs] = useState(() => loadJson(PREFS_KEY, { gun: 'AR-9' as Gun, fullscreen: true, muted: false, drill: 'gridshot' as DrillId }));
  const [best, setBest] = useState<Partial<Record<DrillId, number>>>(() => loadJson(BEST_STORE, {}));
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [result, setResult] = useState<(DrillResult & { newBest: boolean }) | null>(null);
  const [lockError, setLockError] = useState('');
  const [rawActive, setRawActive] = useState<boolean | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMsg, setPasteMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  // on a phone the stage takes over the whole screen from Start until the drill ends
  const [touchSession, setTouchSession] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AimEngine | null>(null);
  const bestRef = useRef(best);
  bestRef.current = best;

  const s = saved.settings;
  const drill = DRILLS.find((d) => d.id === prefs.drill) ?? DRILLS[0];
  const gun: Gun = drill.gun ?? prefs.gun;

  const update = (next: SavedSettings) => {
    setSaved(next);
    saveSettings(next);
  };
  const edit = (patch: Partial<KirkaSettings>) => update({ ...saved, settings: { ...s, ...patch }, source: saved.source === 'import' ? 'import' : 'manual' });
  const setPref = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveJson(PREFS_KEY, next);
  };

  // ---------------------------------------------------------------- engine
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !crosshairRef.current || !scopeRef.current || !hitRef.current) return;
    const engine = new AimEngine(
      host,
      { crosshair: crosshairRef.current, scope: scopeRef.current, hitmarker: hitRef.current },
      {
        onHud: setHud,
        onState: (st) => {
          setEngineState(st);
          if (st === 'running') setLockError('');
          if (st === 'done') {
            setTouchSession(false);
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          }
        },
        onResult: (r) => {
          const info = DRILLS.find((d) => d.id === r.drill)!;
          const enough = r.drill === 'gridshot' || r.drill === 'tracking' ? r.seconds >= info.seconds - 0.2 : r.kills >= 5;
          const prev = bestRef.current[r.drill];
          const newBest = enough && (prev === undefined || (info.better === 'higher' ? r.score > prev : r.score < prev));
          if (newBest) {
            const next = { ...bestRef.current, [r.drill]: r.score };
            setBest(next);
            saveJson(BEST_STORE, next);
          }
          setResult({ ...r, newBest });
        },
        onLockError: setLockError,
        onRawInput: setRawActive,
      },
      saved.settings
    );
    engineRef.current = engine;
    if (import.meta.env.DEV) (window as unknown as { __aim?: AimEngine }).__aim = engine;
    engine.muted = prefs.muted;
    engine.prepare(prefs.drill);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // built once; settings, drill and sound reach it through the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setSettings(s, prefs.gun);
  }, [s, prefs.gun]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.muted = prefs.muted;
  }, [prefs.muted]);

  const pickDrill = (id: DrillId) => {
    setPref({ drill: id });
    setResult(null);
    engineRef.current?.prepare(id);
  };

  const go = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engineState === 'done') {
      setResult(null);
      engine.prepare(prefs.drill);
    }
    if (IS_TOUCH) {
      setTouchSession(true);
      // Android can go properly fullscreen and turn sideways; an iPhone can't, and gets the stage over the page
      void stageRef.current
        ?.requestFullscreen?.()
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape'))
        .catch(() => {});
      engine.startTouch();
      return;
    }
    // the mouse first: going fullscreen uses up the click, and the lock needs it
    void engine.lock();
    if (prefs.fullscreen && !document.fullscreenElement) void stageRef.current?.requestFullscreen?.().catch(() => {});
  };

  const endDrill = () => engineRef.current?.finish();

  // fingers on the phone controls: the look area is the whole stage, fire and aim are buttons on top
  const touchHandlers = (control: TouchControl) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      engineRef.current?.touchDown(e.pointerId, control, e.clientX, e.clientY);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') engineRef.current?.touchMove(e.pointerId, e.clientX, e.clientY);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => engineRef.current?.touchUp(e.pointerId),
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => engineRef.current?.touchUp(e.pointerId),
  });
  const m = s.mobile;
  const touchButton = 'absolute grid place-items-center rounded-full border-2 border-white/70 bg-black/40 text-white display select-none touch-none';

  // ---------------------------------------------------------------- overlays
  const crosshairSrc = useMemo(() => {
    const c = s.crosshair;
    if (c.display === 'hidden') return '';
    if (c.mode === 'url' && c.url && s.allowImages) return c.url;
    return svgUrl(crosshairSvg(c));
  }, [s]);
  const scopeKind = s.sniper.display === 'image' && s.sniper.url && s.allowImages ? 'image' : s.sniper.display === 'crosshair' ? 'crosshair' : 'default';
  const outsideImages = [s.crosshair.mode === 'url' && s.crosshair.url, s.sniper.display === 'image' && s.sniper.url].filter(Boolean) as string[];

  // ---------------------------------------------------------------- import
  const importPaste = () => {
    try {
      const settings = parseKirkaExport(pasteText);
      update({ settings, source: 'import', dpi: saved.dpi });
      setPasteMsg({ text: `Imported. Sensitivity ${settings.sensitivity}, aim ${settings.aimSensitivity}, FOV ${settings.mainFov}.` });
      setPasteText('');
      setPasteOpen(false);
    } catch (err) {
      setPasteMsg({ text: (err as Error).message, bad: true });
    }
  };

  // ---------------------------------------------------------------- numbers for the panel
  const hipCm = cmPer360(s.sensitivity, saved.dpi);
  const aimFov = adsFov(s, gun, 1);
  const aimCm = cmPer360(s.aimSensitivity, saved.dpi, aimFov / s.mainFov);
  const accuracy = hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 100;

  const panel = 'bg-obsidian-card border p-3.5 space-y-2.5';
  const heading = 'display text-[19px] text-slate-100 leading-none';
  const action = 'btn-interactive flex items-center justify-center gap-1.5 px-2.5 py-1.5 border-2 border-[var(--ink)] bg-obsidian-dark text-[13px] font-bold text-slate-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none';
  const chip = (on: boolean) =>
    `px-2.5 py-1.5 border-2 text-[13px] font-bold cursor-pointer transition-colors ${
      on ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]' : 'bg-obsidian-dark text-slate-300 border-[var(--ink)] hover:bg-obsidian-hover'
    }`;
  const field = 'w-full bg-obsidian-dark border-2 border-[var(--ink)] px-2 py-1 text-[14px] font-bold text-slate-100';
  const row = 'flex items-center justify-between gap-3 text-[14px]';

  const numberField = (label: string, value: number, min: number, max: number, onChange: (v: number) => void, step = 1) => (
    <label className={row}>
      <span className="text-slate-400 font-bold">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className={`${field} max-w-[92px] text-right`}
      />
    </label>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-obsidian-border pb-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl text-slate-100 flex items-center gap-3">
            <Crosshair className="w-8 h-8 text-gold-bright" />
            <span>
              Aim <span className="mark">Trainer</span>
            </span>
          </h1>
          <p className="text-[15px] text-slate-400 mt-1.5 max-w-[72ch]">
            Practise with your exact Kirka settings. Paste the export from Kirka's settings and your sensitivity, FOV, zoom and crosshair all work the way they do in game.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Drills">
            {DRILLS.map((d) => (
              <button key={d.id} type="button" role="tab" aria-selected={prefs.drill === d.id} onClick={() => pickDrill(d.id)} disabled={engineState === 'running'} className={chip(prefs.drill === d.id)}>
                {d.name}
              </button>
            ))}
          </div>

          <div
            ref={stageRef}
            className={`bg-black overflow-hidden select-none [&:fullscreen]:border-0 [&:fullscreen]:aspect-auto ${
              touchSession ? 'fixed inset-0 z-[300] touch-none [-webkit-touch-callout:none]' : 'relative aspect-video border-2 border-[var(--ink)]'
            }`}
            style={touchSession ? { height: '100dvh' } : NO_ASPECT && !isFullscreen ? { height: 0, paddingTop: '56.25%' } : undefined}
          >
            <div ref={hostRef} className="absolute inset-0" {...(IS_TOUCH ? touchHandlers('look') : {})} />

            {/* scope, drawn over the world */}
            <div ref={scopeRef} className="absolute inset-0 pointer-events-none" style={{ display: 'none' }}>
              {scopeKind === 'image' && <img src={s.sniper.url} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-contain" />}
              {scopeKind === 'crosshair' && <img src={svgUrl(crosshairSvg(s.sniper))} alt="" className="absolute left-1/2 top-1/2 [image-rendering:pixelated]" style={CENTER} />}
              {scopeKind === 'default' && (
                <>
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 0, transparent 38vmin, rgba(0,0,0,0.9) 38.4vmin, #000 46vmin)' }} />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-black/90" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/90" />
                </>
              )}
            </div>

            <div ref={crosshairRef} className="absolute left-1/2 top-1/2 pointer-events-none" style={CENTER}>
              {crosshairSrc && <img src={crosshairSrc} alt="" referrerPolicy="no-referrer" className="block max-w-none [image-rendering:pixelated]" />}
            </div>
            <div ref={hitRef} className="absolute left-1/2 top-1/2 pointer-events-none opacity-0" style={CENTER}>
              <img src={svgUrl(hitmarkerSvg(s.hitmarker))} alt="" className="block max-w-none" />
            </div>

            {/* HUD */}
            {engineState === 'running' && (
              <div className="absolute top-3 left-1/2 flex gap-4 px-3 py-1.5 bg-black/55 font-mono text-[14px] text-white pointer-events-none" style={CENTER_X}>
                {IS_DESKTOP && <span>{hud.fps} FPS</span>}
                {drill.id === 'sens' ? (
                  <>
                    <span>{Math.abs(hud.turned).toFixed(1)}° turned</span>
                    <span>{(Math.abs(hud.turned) / 360).toFixed(2)} turns</span>
                    <span>{IS_TOUCH ? 'Pause to stop' : 'Esc to stop'}</span>
                  </>
                ) : (
                  <>
                    <span>{Math.ceil(hud.time)}s</span>
                    {drill.id === 'tracking' ? <span>{Math.round(hud.onTarget * 100)}% on target</span> : <span>{hud.kills}{drill.kills ? `/${drill.kills}` : ''} kills</span>}
                    <span>{accuracy}% acc</span>
                    {hud.aimed && <span className="text-[#f5c518]">ADS {Math.round(hud.fov)}°</span>}
                  </>
                )}
              </div>
            )}

            {touchSession && engineState === 'running' && (
              <>
                <button type="button" onClick={() => engineRef.current?.pause()} aria-label="Pause" className="absolute top-3 left-3 w-11 h-11 grid place-items-center bg-black/55 border-2 border-white/60 text-white">
                  <Pause className="w-5 h-5" />
                </button>
                {drill.id !== 'sens' && (
                  <>
                    <div
                      {...touchHandlers('fire')}
                      role="button"
                      aria-label="Fire"
                      className={touchButton}
                      style={{
                        width: `${6.25 * m.fireScale}rem`,
                        height: `${6.25 * m.fireScale}rem`,
                        right: `${1.75 - m.fireX}rem`,
                        bottom: `${2 - m.fireY}rem`,
                        opacity: Math.max(0.3, m.fireOpacity * m.allOpacity),
                        fontSize: `${1.4 * m.fireScale}rem`,
                      }}
                    >
                      FIRE
                    </div>
                    <div
                      {...touchHandlers('fireLeft')}
                      role="button"
                      aria-label="Fire left"
                      className={touchButton}
                      style={{
                        width: `${5.5 * m.fireLeftScale}rem`,
                        height: `${5.5 * m.fireLeftScale}rem`,
                        left: `${1.75 + m.fireLeftX}rem`,
                        bottom: `${2 - m.fireLeftY}rem`,
                        opacity: Math.max(0.3, m.fireLeftOpacity * m.allOpacity),
                        fontSize: `${1.25 * m.fireLeftScale}rem`,
                      }}
                    >
                      FIRE
                    </div>
                    <div
                      {...touchHandlers('aim')}
                      role="button"
                      aria-label="Aim"
                      className={touchButton}
                      style={{
                        width: `${4.5 * m.aimScale}rem`,
                        height: `${4.5 * m.aimScale}rem`,
                        right: `${9 - m.aimX}rem`,
                        bottom: `${6.5 - m.aimY}rem`,
                        opacity: Math.max(0.3, m.aimOpacity * m.allOpacity),
                        fontSize: `${1.05 * m.aimScale}rem`,
                      }}
                    >
                      AIM
                    </div>
                  </>
                )}
              </>
            )}
            {touchSession && (
              <div className="absolute inset-0 hidden portrait:grid place-items-center bg-black/85 p-6 text-center display text-[26px] text-slate-100 z-10">
                Turn your phone sideways
              </div>
            )}

            {engineState !== 'running' && (
              <div className="absolute inset-0 grid place-items-center bg-black/55 p-4">
                <div className="max-w-md w-full bg-obsidian-card border-2 border-[var(--ink)] shadow-[5px_5px_0_var(--ink)] p-5 space-y-3 text-center">
                  {engineState === 'done' && result ? (
                    <>
                      <p className="display text-[30px] text-slate-100 leading-none">{drill.name}</p>
                      <p className="display text-[44px] text-gold-bright leading-none">{fmtScore(result.drill, result.score)}</p>
                      {result.newBest && <p className="text-[14px] font-bold text-[var(--accent)] flex items-center justify-center gap-1.5"><Trophy className="w-4 h-4" /> New best</p>}
                      <p className="text-[14px] font-bold text-slate-400">
                        {result.kills} kills · {result.shots ? Math.round((result.hits / result.shots) * 100) : 0}% accuracy · {result.seconds.toFixed(1)}s · {result.gun}
                      </p>
                    </>
                  ) : engineState === 'paused' ? (
                    <p className="display text-[30px] text-slate-100 leading-none">Paused</p>
                  ) : (
                    <>
                      <p className="display text-[30px] text-slate-100 leading-none">{drill.name}</p>
                      <p className="text-[14px] font-bold text-slate-400">{drill.blurb}</p>
                    </>
                  )}
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={go} className="display flex items-center gap-1.5 h-10 px-5 bg-gold-primary text-[20px] cursor-pointer">
                      {engineState === 'done' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {engineState === 'done' ? 'Again' : engineState === 'paused' ? 'Resume' : 'Start'}
                    </button>
                    {engineState === 'paused' && (
                      <button type="button" onClick={endDrill} className={action}>
                        End drill
                      </button>
                    )}
                  </div>
                  {lockError && <p className="text-[13px] font-bold text-red-300">{lockError}</p>}
                  {IS_TOUCH ? (
                    <p className="text-[12px] font-bold text-slate-500">
                      Drag anywhere to look ·{' '}
                      {drill.gun && GUN_ADS[drill.gun].scope && m.aimWhenFire ? 'hold FIRE to scope, let go to shoot' : 'FIRE to shoot'} · AIM to zoom. Hold your phone sideways.
                    </p>
                  ) : (
                  <p className="text-[12px] font-bold text-slate-500">
                    Shoot: {keyLabel(s.keys.shoot)}{s.keys.shoot !== 'MOUSE_LEFT___KEY' ? ' or left mouse' : ''} · Aim: {keyLabel(s.keys.aim)}{s.keys.aim !== 'MOUSE_RIGHT___KEY' ? ' or right mouse' : ''} · Esc to pause
                  </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {drill.gun ? (
              <span className="text-[13px] font-bold text-slate-400">This drill uses the {drill.gun}.</span>
            ) : (
              <label className="flex items-center gap-2 text-[13px] font-bold text-slate-400">
                Zoom of
                <select value={prefs.gun} onChange={(e) => setPref({ gun: e.target.value as Gun })} className={`${field} w-auto py-1`}>
                  {GUNS.filter((g) => !GUN_ADS[g].scope).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!IS_TOUCH && (
              <button type="button" onClick={() => setPref({ fullscreen: !prefs.fullscreen })} aria-pressed={prefs.fullscreen} className={chip(prefs.fullscreen)}>
                <span className="flex items-center gap-1.5"><Maximize className="w-3.5 h-3.5" /> Fullscreen</span>
              </button>
            )}
            <button type="button" onClick={() => setPref({ muted: !prefs.muted })} aria-pressed={!prefs.muted} className={chip(!prefs.muted)}>
              <span className="flex items-center gap-1.5">{prefs.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />} Sound</span>
            </button>
            {s.rawInput && rawActive === false && <span className="text-[13px] font-bold text-red-300">Raw Input isn't available here, so your system's mouse acceleration applies (Kirka's own client is the same).</span>}
          </div>
        </div>

        {/* Settings */}
        <aside className="space-y-4">
          <section className={panel}>
            <h2 className={heading}>Your Kirka settings</h2>
            <p className="text-[13px] font-bold text-slate-400">
              {saved.source === 'import' ? 'Imported from your Kirka export.' : saved.source === 'manual' ? 'Typed in by you.' : "Kirka's defaults. Paste yours to match your game."}
            </p>
            {!pasteOpen ? (
              <button type="button" onClick={() => { setPasteOpen(true); setPasteMsg(null); }} className={`${action} w-full`}>
                <ClipboardPaste className="w-4 h-4" /> Paste Kirka settings
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-slate-400 leading-snug">In Kirka, open Settings and use the export button. It copies your settings; paste them here.</p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder='{"MOUSE___SETTING":{...'
                  className={`${field} font-mono text-[12px] resize-y`}
                />
                <div className="flex gap-1.5">
                  <button type="button" onClick={importPaste} disabled={!pasteText.trim()} className="display flex-1 h-9 bg-gold-primary text-[18px] cursor-pointer disabled:opacity-40">
                    Import
                  </button>
                  <button type="button" onClick={() => setPasteOpen(false)} className={action}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {pasteMsg && <p className={`text-[13px] font-bold ${pasteMsg.bad ? 'text-red-300' : 'text-emerald-300'}`}>{pasteMsg.text}</p>}

            <div className="space-y-1.5 pt-1">
              {numberField('Sensitivity', s.sensitivity, 1, 300, (v) => edit({ sensitivity: v }))}
              {numberField('Aim sensitivity', s.aimSensitivity, 1, 300, (v) => edit({ aimSensitivity: v }))}
              {numberField('Field of view', s.mainFov, 60, 150, (v) => edit({ mainFov: v }))}
              {numberField(`ADS power (${gun})`, s.adsPower[gun], 0, 3, (v) => edit({ adsPower: { ...s.adsPower, [gun]: v } }), 0.05)}
              {IS_TOUCH ? (
                <label className={row}>
                  <span className="text-slate-400 font-bold">Aim when fire</span>
                  <input type="checkbox" checked={m.aimWhenFire} onChange={(e) => edit({ mobile: { ...m, aimWhenFire: e.target.checked } })} className="w-4 h-4 accent-[var(--accent)]" />
                </label>
              ) : (
                <>
                  <label className={row}>
                    <span className="text-slate-400 font-bold">Raw input</span>
                    <input type="checkbox" checked={s.rawInput} onChange={(e) => edit({ rawInput: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
                  </label>
                  <label className={row}>
                    <span className="text-slate-400 font-bold">Flick protection</span>
                    <input type="checkbox" checked={s.flickProtection} onChange={(e) => edit({ flickProtection: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
                  </label>
                </>
              )}
              <p className={row}>
                <span className="text-slate-400 font-bold">Crosshair</span>
                <span className="flex items-center justify-center w-16 h-10 bg-[#8fc3f2] border-2 border-[var(--ink)]">
                  {crosshairSrc ? <img src={crosshairSrc} alt="Your crosshair" referrerPolicy="no-referrer" className="max-w-full max-h-full [image-rendering:pixelated]" /> : <span className="text-[11px] font-bold text-slate-900">Hidden</span>}
                </span>
              </p>
            </div>

            {outsideImages.length > 0 && (
              <div className="border-2 border-dashed border-[var(--ink)] p-2.5 space-y-1.5">
                <p className="text-[13px] font-bold text-slate-300 flex items-start gap-1.5 leading-snug">
                  <ImageIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  Your {s.crosshair.mode === 'url' && s.crosshair.url ? 'crosshair' : 'scope'} is an image from {hostOf(outsideImages[0])}.
                  {!s.allowImages && ' Until you load it, the trainer draws one from your custom crosshair values.'}
                </p>
                <button type="button" onClick={() => edit({ allowImages: !s.allowImages })} className={`${action} w-full`}>
                  {s.allowImages ? 'Stop loading it' : 'Load my image'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => update({ settings: DEFAULT_SETTINGS, source: 'default', dpi: saved.dpi })}
              className="text-[12px] font-bold text-slate-500 underline cursor-pointer"
            >
              Reset to Kirka's defaults
            </button>
          </section>

          {IS_TOUCH ? (
          <section className={panel}>
            <h2 className={heading}>Your swipe</h2>
            <p className={row}>
              <span className="text-slate-400 font-bold">Swipe 100 px</span>
              <span className="font-mono text-slate-100">{touchDegrees(s.sensitivity, 100).toFixed(0)}°</span>
            </p>
            <p className={row}>
              <span className="text-slate-400 font-bold">Full turn</span>
              <span className="font-mono text-slate-100">{Math.round((360 / touchDegrees(s.sensitivity, 1)))} px</span>
            </p>
            <p className="text-[12px] font-bold text-slate-500 leading-snug">Same touch maths as Kirka: small drags near where your thumb lands turn slower, longer swipes turn evenly.</p>
          </section>
          ) : (
          <section className={panel}>
            <h2 className={heading}>Your 360</h2>
            {numberField('Mouse DPI', saved.dpi, 50, 64000, (v) => update({ ...saved, dpi: v }), 50)}
            <p className={row}>
              <span className="text-slate-400 font-bold">Hip fire</span>
              <span className="font-mono text-slate-100">{hipCm.toFixed(1)} cm / 360°</span>
            </p>
            <p className={row}>
              <span className="text-slate-400 font-bold">Aimed in ({gun})</span>
              <span className="font-mono text-slate-100">{aimCm.toFixed(1)} cm / 360°</span>
            </p>
            <p className="text-[12px] font-bold text-slate-500 leading-snug">Use the 360 check drill to feel it: mark a spot on your desk, turn once here and once in Kirka.</p>
          </section>
          )}

          <section className={panel}>
            <h2 className={`${heading} flex items-center gap-2`}><Trophy className="w-4 h-4" /> Your bests</h2>
            {DRILLS.filter((d) => d.id !== 'sens').map((d) => (
              <p key={d.id} className={row}>
                <span className="text-slate-400 font-bold">{d.name}</span>
                <span className="font-mono text-slate-100">{best[d.id] !== undefined ? fmtScore(d.id, best[d.id]!) : '—'}</span>
              </p>
            ))}
            <p className="text-[12px] font-bold text-slate-500">Saved in this browser{IS_TOUCH ? ', separately from mouse scores' : ''}.</p>
          </section>
        </aside>
      </div>

      <section className="bg-obsidian-card border p-4 space-y-2 max-w-[90ch]">
        <h2 className="display text-[26px] text-slate-100">How it matches Kirka</h2>
        <ul className="list-disc pl-5 space-y-1 text-[14px] text-slate-300">
          <li>Mouse look is Kirka's own formula: every mouse count turns you by sensitivity × 0.0000235 radians, scaled by how zoomed in you are.</li>
          <li>Aiming in zooms to the same field of view as in game (70 for most guns, 35 for the VITA), times your ADS power, and switches to your aim sensitivity once you're fully in.</li>
          <li>Raw Input asks the browser for unfiltered mouse movement, like Kirka. Flick protection drops the same mouse spikes.</li>
          <li>On phones it uses Kirka's touch controls: the same invisible look joystick and touch sensitivity, a right fire button you can drag to aim, a left fire button, an aim button, and your Aim when fire setting.</li>
          <li>Your crosshair is drawn pixel for pixel the way Kirka draws it. Play in fullscreen so the view matches your game window.</li>
        </ul>
      </section>
    </div>
  );
};
