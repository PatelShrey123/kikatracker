import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { crosshairSvg, DEFAULT_SETTINGS, svgUrl } from '../utils/kirkaSettings';

/**
 * A one-time "what's new" card on the home page. Shown once per browser: closing it, or opening one of
 * the features from it, remembers that it's been seen. Bump the key to announce the next batch.
 */
const SEEN_KEY = 'kirkahub_whats_new_v1';

// Small pictures of the real things instead of generic icons

/** A tiny Wrapped story slide: progress bars and the year. */
const WrappedArt = () => (
  <span className="relative block w-full h-full bg-[#F5C518] overflow-hidden">
    <span className="absolute top-1 left-1 right-1 flex gap-0.5">
      {[1, 1, 0.4, 0.4, 0.4].map((o, i) => (
        <span key={i} className="h-0.5 flex-1 bg-[#11121B]" style={{ opacity: o }} />
      ))}
    </span>
    <span className="absolute inset-0 grid place-items-center pt-1.5 display text-[17px] leading-none text-[#11121B]">2025</span>
  </span>
);

/** The trainer's own view: sky, floor, a target and a Kirka crosshair. */
const AimArt = () => (
  <span className="relative block w-full h-full overflow-hidden" style={{ background: 'linear-gradient(#8fc3f2 0 58%, #b9bcc4 58%)' }}>
    <span className="absolute w-3.5 h-3.5 rounded-full bg-[#ff4d5a] shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.25)]" style={{ left: '58%', top: '26%' }} />
    <img src={svgUrl(crosshairSvg(DEFAULT_SETTINGS.crosshair))} alt="" className="absolute left-1/2 top-1/2 max-w-none [image-rendering:pixelated]" style={{ transform: 'translate(-50%, -50%) scale(1.4)' }} />
  </span>
);

/** A head cut from a real Kirka skin file (Thriller's), the kind of file the editor paints. */
const SkinArt = () => (
  <span
    className="block w-full h-full [image-rendering:pixelated]"
    style={{
      backgroundImage: `url(${import.meta.env.BASE_URL}home/c-thriller.png)`,
      // the face is the 8x8 square at (8, 8) of the 64x64 sheet
      backgroundSize: `${(64 / 8) * 100}% ${(64 / 8) * 100}%`,
      backgroundPosition: `${(8 / 56) * 100}% ${(8 / 56) * 100}%`,
    }}
  />
);

const ITEMS = [
  {
    tab: 'wrapped',
    Art: WrappedArt,
    title: 'Kirka Wrapped',
    text: 'Your Kirka story in slides: games, kills, your ranked year, your rarest skin and your player title. Save it as a video with music.',
  },
  {
    tab: 'aimtrainer',
    Art: AimArt,
    title: 'Aim Trainer',
    text: 'Paste your Kirka settings and train with your exact sensitivity, FOV and crosshair. Works on phones too.',
  },
  {
    tab: 'skineditor',
    Art: SkinArt,
    title: 'Skin Editor',
    text: 'Paint your own 3px slim skin in 3D, right in your browser.',
  },
];

function alreadySeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // no storage (private mode): showing it every visit would nag, so don't show it at all
    return true;
  }
}

export const WhatsNewModal: React.FC<{ onOpen: (tab: string) => void }> = ({ onOpen }) => {
  const [open, setOpen] = useState(false);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (alreadySeen()) return;
    // a moment after the page settles, so it doesn't land on top of the loading screen
    const t = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    firstButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] grid place-items-center p-4 bg-black/70" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-obsidian-card border-[3px] border-[var(--ink)] shadow-[6px_6px_0_var(--ink)] p-5 sm:p-6"
      >
        <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 w-9 h-9 grid place-items-center border-2 border-[var(--ink)] bg-obsidian-dark text-slate-300 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <p className="font-mono text-[13px] tracking-[0.06em] text-gold-bright">JUST ADDED</p>
        <h2 id="whats-new-title" className="display text-[38px] sm:text-[44px] leading-none text-slate-100 mt-1 pr-10">
          New on <span className="mark">Kirka Hub</span>
        </h2>

        <ul className="mt-5 space-y-3">
          {ITEMS.map(({ tab, Art, title, text }, i) => (
            <li key={tab} className="flex gap-3 items-start bg-obsidian-dark border-2 border-[var(--ink)] p-3">
              <span className="block w-12 h-12 shrink-0 border-2 border-[var(--ink)] overflow-hidden">
                <Art />
              </span>
              <span className="flex-1 min-w-0">
                <span className="display text-[24px] leading-none text-slate-100 block">{title}</span>
                <span className="text-[14px] font-bold text-slate-400 leading-snug block mt-1">{text}</span>
              </span>
              <button
                ref={i === 0 ? firstButton : undefined}
                type="button"
                onClick={() => {
                  close();
                  onOpen(tab);
                }}
                className="btn-interactive self-center shrink-0 px-3 py-2 border-2 border-[var(--ink)] bg-[var(--accent)] text-[var(--on-accent)] text-[14px] font-bold cursor-pointer"
              >
                Open
              </button>
            </li>
          ))}
        </ul>

        <button type="button" onClick={close} className="display w-full h-11 mt-5 bg-gold-primary text-[21px] cursor-pointer">
          Got it
        </button>
      </div>
    </div>
  );
};
