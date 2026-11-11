import { formatValue } from './csv';
import { getSkinRenderUrl } from './skinAssets';
import { durationLabel, hourLabel } from './wrapped';
import type { Wrapped, WrappedItem } from './wrapped';
import { BAR, scheduleMusic } from './wrappedMusic';

/**
 * Wrapped drawn by hand on a 1080x1920 canvas: the summary image to save, and the story as a video
 * (recorded from the canvas, with the music from wrappedMusic.ts) for TikTok, Reels and Shorts.
 */

const W = 1080;
const H = 1920;
const INK = '#11121B';
const CREAM = '#FFF6E0';
const YELLOW = '#F5C518';
const TONES = {
  yellow: { bg: YELLOW, fg: INK },
  red: { bg: '#E3202E', fg: CREAM },
  blue: { bg: '#2F6FE0', fg: CREAM },
  dark: { bg: '#171925', fg: CREAM },
  green: { bg: '#2EE68F', fg: INK },
};
type Tone = keyof typeof TONES;

const n = (v: number) => Math.round(v).toLocaleString();
const pct = (v: number) => `${Math.round(v * 100)}%`;
const dateLabel = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const display = (size: number) => `${size}px Bangers, Impact, sans-serif`;
const body = (size: number) => `bold ${size}px "Comic Neue", "Comic Sans MS", sans-serif`;
const mono = (size: number) => `bold ${size}px "JetBrains Mono", monospace`;
const easeOut = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

async function fontsReady() {
  await Promise.all(['80px Bangers', 'bold 40px "Comic Neue"', 'bold 40px "JetBrains Mono"'].map((f) => document.fonts.load(f).catch(() => null)));
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** kirka.io doesn't let other sites draw its pictures, so those come through our proxy; api2 allows it. */
export const drawableUrl = (raw: any) => {
  const url = getSkinRenderUrl(raw);
  return url.startsWith('https://kirka.io/') ? url.replace('https://kirka.io/', '/kirka-assets/') : url;
};

const keyOf = (it: WrappedItem) => it.raw?.id || `${it.name}_${it.weapon}`;

/** Every skin picture the slides use, loaded once. */
async function loadPictures(w: Wrapped): Promise<Map<string, HTMLImageElement>> {
  const items = [w.locker.mostValuable, w.locker.rarest, w.loadout.body, w.loadout.weapon].filter(Boolean) as WrappedItem[];
  const out = new Map<string, HTMLImageElement>();
  await Promise.all(
    items.map(async (it) => {
      const img = await loadImage(drawableUrl(it.raw));
      if (img) out.set(keyOf(it), img);
    })
  );
  return out;
}

function fit(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, top: number, bw: number, bh: number) {
  const k = Math.min(bw / img.width, bh / img.height);
  g.drawImage(img, x + (bw - img.width * k) / 2, top + (bh - img.height * k), img.width * k, img.height * k);
}

function dots(g: CanvasRenderingContext2D, color: string, alpha: number) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 24;
  const t = tile.getContext('2d')!;
  t.fillStyle = color;
  t.globalAlpha = alpha;
  t.beginPath();
  t.arc(6, 6, 2.4, 0, Math.PI * 2);
  t.arc(18, 18, 2.4, 0, Math.PI * 2);
  t.fill();
  return g.createPattern(tile, 'repeat')!;
}

// ------------------------------------------------------------------ the summary card

/** The story-sized summary card: the saved image, and the last frames of the video. */
export function paintSummary(g: CanvasRenderingContext2D, w: Wrapped, pics: Map<string, HTMLImageElement>) {
  g.fillStyle = '#171925';
  g.fillRect(0, 0, W, H);
  g.fillStyle = dots(g, CREAM, 0.06);
  g.fillRect(0, 0, W, H);

  g.fillStyle = YELLOW;
  g.fillRect(0, 0, W, 300);
  g.fillStyle = INK;
  g.font = display(64);
  g.textAlign = 'left';
  g.fillText(`KIRKA WRAPPED${w.season ? ` ${w.season.year}` : ''}`, 70, 120);
  g.font = display(118);
  let name = w.name.toUpperCase();
  while (g.measureText(name).width > W - 140 && name.length > 3) name = name.slice(0, -1);
  g.fillText(name, 70, 250);

  g.fillStyle = CREAM;
  g.font = mono(40);
  g.fillText(`#${w.shortId} · LVL ${w.level}${w.clan ? ` · ${w.clan}` : ''}`, 70, 380);

  g.save();
  g.translate(70, 430);
  g.rotate(-0.025);
  g.fillStyle = '#E3202E';
  g.fillRect(0, 0, W - 140, 150);
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.strokeRect(0, 0, W - 140, 150);
  g.fillStyle = CREAM;
  g.font = display(96);
  g.fillText(w.persona.title.toUpperCase(), 36, 112);
  g.restore();

  const bodyImg = w.loadout.body ? pics.get(keyOf(w.loadout.body)) : undefined;
  const gunImg = w.loadout.weapon ? pics.get(keyOf(w.loadout.weapon)) : undefined;
  const extra = [
    w.season?.favMap && `Home map: ${w.season.favMap.name}`,
    w.season && w.season.bestStreak >= 3 && `Best streak: ${w.season.bestStreak} wins in a row`,
    w.locker.rarest && `Rarest: ${w.locker.rarest.name} (${n(w.locker.rarest.owners)} owners)`,
    w.ratings.length && w.ratings.map((r) => `${r.label === 'Search & Destroy' ? 'S&D' : r.label} ${n(r.value)}`).join(' · '),
    `Playing since ${w.since.getFullYear()}`,
  ].filter(Boolean) as string[];
  const lines = extra.slice(0, 4);
  const picH = bodyImg || gunImg ? 380 : 0;
  const used = picH + 3 * 170 + 30 + lines.length * 58;
  let y = 630 + Math.max(0, (H - 160 - 630 - used) / 2);
  if (picH) {
    if (bodyImg) fit(g, bodyImg, 90, y, 300, 360);
    if (gunImg) fit(g, gunImg, bodyImg ? 410 : 140, y + 40, bodyImg ? 580 : 800, 300);
    y += picH;
  }

  const L = w.lifetime;
  const stats: [string, string][] = [
    ['GAMES', n(L.games)],
    ['WIN RATE', pct(L.winRate)],
    ['KILLS', n(L.kills)],
    ['K/D', L.kd.toFixed(2)],
    ['HEADSHOTS', pct(L.headshotRate)],
    w.season ? [`RANKED ${w.season.year}`, `${w.season.matches} games`] : ['LEVEL', String(w.level)],
  ];
  const colW = (W - 140 - 30) / 2;
  stats.forEach(([label, value], i) => {
    const x = 70 + (i % 2) * (colW + 30);
    const top = y + Math.floor(i / 2) * 170;
    g.fillStyle = '#262A3C';
    g.fillRect(x, top, colW, 145);
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.strokeRect(x, top, colW, 145);
    g.fillStyle = YELLOW;
    g.font = mono(28);
    g.fillText(label, x + 26, top + 46);
    g.fillStyle = CREAM;
    g.font = display(76);
    g.fillText(value, x + 26, top + 122);
  });
  y += 3 * 170 + 30;

  g.fillStyle = CREAM;
  g.font = body(40);
  lines.forEach((line, i) => g.fillText(line, 70, y + 36 + i * 58));

  g.fillStyle = YELLOW;
  g.fillRect(0, H - 130, W, 130);
  g.fillStyle = INK;
  g.font = display(60);
  g.fillText('KIRKAHUB.ONLINE/WRAPPED', 70, H - 45);
}

export async function drawSummary(w: Wrapped): Promise<Blob> {
  await fontsReady();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const toBlob = () =>
    new Promise<Blob>((resolve, reject) => {
      try {
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('empty'))), 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  paintSummary(c.getContext('2d')!, w, await loadPictures(w));
  try {
    return await toBlob();
  } catch {
    // a picture that wouldn't let itself be saved: leave the pictures out
    paintSummary(c.getContext('2d')!, w, new Map());
    return toBlob();
  }
}

// ------------------------------------------------------------------ the story as video

type El =
  | { kind: 'text'; size: 'small' | 'mid' | 'big'; text: string; accent?: boolean }
  | { kind: 'count'; size: 'mid' | 'big'; value: number; decimals?: number; before?: string; after?: string; accent?: boolean }
  | { kind: 'pics'; items: WrappedItem[]; h: number }
  | { kind: 'chips'; chips: string[] };
interface VSlide {
  tone: Tone;
  els: El[];
}

/** The same story as the slides on the page, as things to draw. */
function videoSlides(w: Wrapped): VSlide[] {
  const s = w.season;
  const L = w.lifetime;
  const out: VSlide[] = [
    {
      tone: 'yellow',
      els: [
        { kind: 'text', size: 'mid', text: `KIRKA WRAPPED${s ? ` ${s.year}` : ''}` },
        { kind: 'text', size: 'big', text: w.name.toUpperCase() },
        { kind: 'text', size: 'small', text: `#${w.shortId} · Level ${w.level}` },
      ],
    },
    {
      tone: 'blue',
      els: [
        { kind: 'text', size: 'small', text: 'You dropped into Kirka on' },
        { kind: 'text', size: 'mid', text: dateLabel(w.since).toUpperCase() },
        { kind: 'count', size: 'big', value: w.daysPlaying },
        { kind: 'text', size: 'small', text: `days ago. That's ${durationLabel(w.daysPlaying)} of Kirka.` },
      ],
    },
    {
      tone: 'red',
      els: [
        { kind: 'text', size: 'small', text: "You've played" },
        { kind: 'count', size: 'big', value: L.games },
        { kind: 'text', size: 'mid', text: 'GAMES' },
        { kind: 'text', size: 'small', text: `and won ${n(L.wins)} of them. That's a ${pct(L.winRate)} win rate.` },
      ],
    },
    {
      tone: 'dark',
      els: [
        { kind: 'text', size: 'small', text: "Players you've sent back to spawn" },
        { kind: 'count', size: 'big', value: L.kills, accent: true },
        { kind: 'count', size: 'mid', value: L.kd, decimals: 2, before: 'K/D ' },
        { kind: 'text', size: 'small', text: `${L.killsPerGame.toFixed(1)} kills every game, on average.` },
      ],
    },
    {
      tone: 'yellow',
      els: [
        { kind: 'text', size: 'small', text: 'Right between the eyes' },
        { kind: 'count', size: 'big', value: L.headshots },
        { kind: 'text', size: 'mid', text: 'HEADSHOTS' },
        { kind: 'text', size: 'small', text: `${pct(L.headshotRate)} of all your kills.` },
      ],
    },
  ];
  if (s) {
    const els: El[] = [
      { kind: 'text', size: 'mid', text: `YOUR ${s.year} IN RANKED` },
      { kind: 'count', size: 'big', value: s.matches },
      { kind: 'text', size: 'small', text: `ranked matches, ${pct(s.winRate)} won` },
    ];
    if (s.ratingNet !== null) els.push({ kind: 'count', size: 'mid', value: Math.abs(s.ratingNet), before: s.ratingNet >= 0 ? '+' : '−', after: ' RATING' });
    if (s.bestStreak >= 3) els.push({ kind: 'text', size: 'small', text: `Best run: ${s.bestStreak} wins in a row.` });
    out.push({ tone: 'blue', els });
    if (s.favMap) {
      out.push({
        tone: 'red',
        els: [
          { kind: 'text', size: 'small', text: 'Your home ground' },
          { kind: 'text', size: 'big', text: s.favMap.name.toUpperCase() },
          { kind: 'text', size: 'small', text: `Played ${s.favMap.count} times in ${s.year}, and you won ${pct(s.favMap.winRate)} of them.` },
        ],
      });
    }
    if (s.bestMatch) {
      const b = s.bestMatch;
      out.push({
        tone: 'dark',
        els: [
          { kind: 'text', size: 'small', text: `Your best match of ${s.year}` },
          { kind: 'text', size: 'big', text: `${b.mine}–${b.theirs}`, accent: true },
          { kind: 'text', size: 'mid', text: (b.map ? `ON ${b.map}` : 'IN RANKED').toUpperCase() },
          { kind: 'text', size: 'small', text: `${b.win ? 'A win' : 'Even in a loss'} worth ${n(b.xp)} XP, on ${dateLabel(b.date)}.` },
        ],
      });
    }
    if (s.favWeekday && s.favHour !== null) {
      const els2: El[] = [
        { kind: 'text', size: 'small', text: 'You played the most on' },
        { kind: 'text', size: 'big', text: `${s.favWeekday.toUpperCase()}S` },
        { kind: 'text', size: 'mid', text: `AROUND ${hourLabel(s.favHour)}` },
      ];
      if (s.busiestMonth) els2.push({ kind: 'text', size: 'small', text: `Your busiest month was ${s.busiestMonth}.` });
      out.push({ tone: 'green', els: els2 });
    }
  }
  const lk = w.locker;
  const sameSkin = !!lk.rarest && !!lk.mostValuable && lk.rarest.raw?.id === lk.mostValuable.raw?.id;
  if (lk.skins) {
    const els: El[] = [
      { kind: 'text', size: 'small', text: 'Your locker holds' },
      { kind: 'count', size: 'big', value: lk.skins },
      { kind: 'text', size: 'mid', text: 'DIFFERENT SKINS' },
    ];
    const note = `${lk.copies > lk.skins ? `${n(lk.copies)} counting every copy. ` : ''}${lk.worth > 0 ? `Worth about ${formatValue(lk.worth)} on Kirka Hub prices.` : ''}`;
    if (note) els.push({ kind: 'text', size: 'small', text: note });
    if (lk.mostValuable && !sameSkin) {
      els.push({ kind: 'pics', items: [lk.mostValuable], h: 240 });
      els.push({ kind: 'text', size: 'small', text: `Priciest: ${lk.mostValuable.name} (${lk.mostValuable.weapon})` });
    }
    out.push({ tone: 'yellow', els });
  }
  if (lk.rarest) {
    out.push({
      tone: 'blue',
      els: [
        { kind: 'text', size: 'small', text: sameSkin ? 'Your rarest skin, and your priciest' : 'Your rarest skin' },
        { kind: 'pics', items: [lk.rarest], h: 380 },
        { kind: 'text', size: 'big', text: lk.rarest.name.toUpperCase() },
        { kind: 'text', size: 'small', text: `Only ${n(lk.rarest.owners)} ${lk.rarest.owners === 1 ? 'player owns' : 'players own'} one.` },
      ],
    });
  }
  const loadout = [w.loadout.body, w.loadout.weapon].filter(Boolean) as WrappedItem[];
  if (loadout.length) {
    out.push({
      tone: 'dark',
      els: [
        { kind: 'text', size: 'mid', text: 'YOUR LOADOUT' },
        { kind: 'pics', items: loadout, h: 460 },
        { kind: 'text', size: 'small', text: `${[w.loadout.weapon && `${w.loadout.weapon.name} ${w.loadout.weapon.weapon}`, w.loadout.body?.name].filter(Boolean).join(' and ')}. Clean.` },
      ],
    });
  }
  if (w.ratings.length) {
    out.push({
      tone: 'red',
      els: [
        { kind: 'text', size: 'mid', text: 'YOUR RANKED RATINGS' },
        ...w.ratings.flatMap((r): El[] => [
          { kind: 'count', size: 'mid', value: r.value },
          { kind: 'text', size: 'small', text: r.label },
        ]),
      ],
    });
  }
  out.push({
    tone: 'yellow',
    els: [
      { kind: 'text', size: 'small', text: `${s ? `In ${s.year}` : 'All in all'}, you are` },
      { kind: 'text', size: 'big', text: w.persona.title.toUpperCase() },
      { kind: 'text', size: 'small', text: w.persona.line },
      { kind: 'chips', chips: w.traits },
    ],
  });
  return out;
}

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const SIZES = { small: { font: body, px: 50, lh: 64 }, mid: { font: display, px: 104, lh: 108 }, big: { font: display, px: 200, lh: 196 } };
const MAX_W = 920;

/** The text an element shows at time k (0..1 through its count-up). */
function elText(el: El, k: number) {
  if (el.kind === 'text') return el.text;
  if (el.kind !== 'count') return '';
  const v = el.value * easeOut(k);
  return `${el.before ?? ''}${el.decimals ? v.toFixed(el.decimals) : n(v)}${el.after ?? ''}`;
}

/** Big words shrink to fit the width; everything else wraps. */
function layout(g: CanvasRenderingContext2D, el: El): { h: number; px: number; lines: string[] } {
  if (el.kind === 'pics') return { h: el.h, px: 0, lines: [] };
  if (el.kind === 'chips') return { h: 96, px: 40, lines: [] };
  const spec = SIZES[el.size];
  const final = elText(el, 1);
  if (el.size === 'big') {
    let px = spec.px;
    g.font = spec.font(px);
    while (g.measureText(final).width > MAX_W && px > 80) g.font = spec.font((px -= 6));
    return { h: px * 0.98, px, lines: [final] };
  }
  g.font = spec.font(spec.px);
  const lines = wrapText(g, final, MAX_W);
  return { h: lines.length * spec.lh, px: spec.px, lines };
}

function paintSlide(g: CanvasRenderingContext2D, slide: VSlide, t: number, pics: Map<string, HTMLImageElement>, patterns: Record<string, CanvasPattern>) {
  const tone = TONES[slide.tone];
  g.fillStyle = tone.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = patterns[tone.fg];
  g.fillRect(0, 0, W, H);

  const GAP = 34;
  const boxes = slide.els.map((el) => layout(g, el));
  const total = boxes.reduce((a, b) => a + b.h, 0) + GAP * (boxes.length - 1);
  let y = (H - total) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  slide.els.forEach((el, i) => {
    const box = boxes[i];
    const start = 0.12 + i * 0.22;
    const k = easeOut((t - start) / 0.35);
    if (k > 0) {
      g.save();
      g.globalAlpha = k;
      const dy = (1 - k) * 46;
      const color = 'accent' in el && el.accent ? YELLOW : tone.fg;
      if (el.kind === 'text' || el.kind === 'count') {
        const spec = SIZES[el.size];
        g.fillStyle = color;
        if (el.size === 'big' || el.kind === 'count') {
          g.font = spec.font(box.px);
          g.fillText(elText(el, el.kind === 'count' ? (t - start) / 1.0 : 1), W / 2, y + dy);
        } else {
          g.font = spec.font(spec.px);
          box.lines.forEach((line, j) => g.fillText(line, W / 2, y + dy + j * spec.lh));
        }
      } else if (el.kind === 'pics') {
        const imgs = el.items.map((it) => pics.get(keyOf(it))).filter(Boolean) as HTMLImageElement[];
        if (imgs.length === 2) {
          fit(g, imgs[0], 90, y + dy, 330, el.h);
          fit(g, imgs[1], 420, y + dy + el.h * 0.25, 580, el.h * 0.7);
        } else if (imgs[0]) {
          fit(g, imgs[0], 110, y + dy, W - 220, el.h);
        }
      } else if (el.kind === 'chips') {
        g.font = body(40);
        const widths = el.chips.map((c) => g.measureText(c).width + 48);
        const rowW = widths.reduce((a, b) => a + b, 0) + 18 * (widths.length - 1);
        let x = Math.max(60, (W - rowW) / 2);
        el.chips.forEach((chip, j) => {
          g.fillStyle = CREAM;
          g.fillRect(x, y + dy, widths[j], 76);
          g.strokeStyle = INK;
          g.lineWidth = 5;
          g.strokeRect(x, y + dy, widths[j], 76);
          g.fillStyle = INK;
          g.fillText(chip, x + widths[j] / 2, y + dy + 16);
          x += widths[j] + 18;
        });
      }
      g.restore();
    }
    y += box.h + GAP;
  });

  g.textBaseline = 'alphabetic';
  g.globalAlpha = 0.75;
  g.fillStyle = tone.fg;
  g.font = mono(34);
  g.fillText('kirkahub.online/wrapped', W / 2, H - 70);
  g.globalAlpha = 1;
}

function paintProgress(g: CanvasRenderingContext2D, index: number, k: number, count: number, color: string) {
  const pad = 40;
  const gap = 10;
  const segW = (W - pad * 2 - gap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    const x = pad + i * (segW + gap);
    g.fillStyle = 'rgba(127,127,127,0.4)';
    g.fillRect(x, 44, segW, 8);
    g.fillStyle = color;
    g.fillRect(x, 44, segW * (i < index ? 1 : i === index ? k : 0), 8);
  }
}

export interface VideoResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
}

/** MP4 where the browser can make one (Chrome, Edge, Safari), WebM otherwise. */
function pickType(): string | null {
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return null;
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}
export const canRecordVideo = () => pickType() !== null && typeof HTMLCanvasElement.prototype.captureStream === 'function';

/**
 * Plays the whole story onto `canvas` in real time and records it. `ac` has to be created by the
 * caller inside the click, or the browser won't let it make sound.
 */
export async function recordVideo(
  w: Wrapped,
  canvas: HTMLCanvasElement,
  ac: AudioContext,
  music: boolean,
  onProgress: (done: number, total: number) => void
): Promise<VideoResult> {
  const type = pickType();
  if (!type) throw new Error('This browser cannot record video.');
  await fontsReady();
  const pics = await loadPictures(w);
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const patterns: Record<string, CanvasPattern> = { [INK]: dots(g, INK, 0.12), [CREAM]: dots(g, CREAM, 0.12) };
  const slides = videoSlides(w);
  const segments = slides.length + 1;
  const bars = slides.length + 2; // the summary holds for two bars, the last one ringing out
  const total = bars * BAR + 0.4;

  // a clean frame before recording starts, so the video doesn't open on a blank canvas
  paintSlide(g, slides[0], 0, pics, patterns);
  const video = canvas.captureStream(30);
  await ac.resume();
  const out = ac.createMediaStreamDestination();
  const t0 = ac.currentTime + 0.15;
  if (music) scheduleMusic(ac, out, t0, bars);
  const stream = new MediaStream([...video.getVideoTracks(), ...(music ? out.stream.getAudioTracks() : [])]);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start(250);

  await new Promise<void>((resolve) => {
    const frame = () => {
      // the music's clock drives the picture, so sound and slides stay together
      const t = Math.max(0, ac.currentTime - t0);
      const index = Math.min(segments - 1, Math.floor(t / BAR));
      const local = t - index * BAR;
      const draw = (i: number, at: number) => (i < slides.length ? paintSlide(g, slides[i], at, pics, patterns) : paintSummary(g, w, pics));
      const wipe = easeOut(local / 0.22);
      if (index > 0 && wipe < 1) {
        // the new slide sweeps up over the last one
        draw(index - 1, BAR);
        g.save();
        g.beginPath();
        g.rect(0, H * (1 - wipe), W, H * wipe);
        g.clip();
        draw(index, local);
        g.restore();
      } else draw(index, local);
      const fg = index < slides.length ? TONES[slides[index].tone].fg : CREAM;
      paintProgress(g, index, index < slides.length ? Math.min(1, local / BAR) : 1, segments, fg);
      onProgress(Math.min(t, total), total);
      if (t >= total) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  await stopped;
  video.getTracks().forEach((tr) => tr.stop());
  return { blob: new Blob(chunks, { type: type.split(';')[0] }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
}
