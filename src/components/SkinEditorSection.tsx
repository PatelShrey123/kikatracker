import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, Raycaster, Vector2 } from 'three';
import { SkinViewer, IdleAnimation, WalkingAnimation, RunningAnimation } from 'skinview3d';
import {
  Brush, Pencil, Eraser, PaintBucket, Pipette, Sun, Moon, Sparkles, Replace, Hand, Undo2, Redo2, Upload, Download,
  FilePlus2, FlipHorizontal2, Grid3x3, Layers, Search, Loader2,
} from 'lucide-react';
import { cleanTextureUrl, getProxiedTextureUrl, isPlaceholderUrl } from '../utils/skinAssets';
import {
  PART_NAMES, PART_LABELS, getSkinLayout, blankSkin, upgradeLegacySkin, looksClassic, clearUnusedPixels, partPixels, resizeSkin,
} from '../utils/skinLayout';
import type { SkinModel, PartName, SkinSize } from '../utils/skinLayout';
import { NativeAd } from './AdSlot';

type Tool = 'pencil' | 'eraser' | 'fill' | 'replace' | 'picker' | 'lighten' | 'darken' | 'noise' | 'move';
type Motion = 'still' | 'idle' | 'walk' | 'run';

interface SkinEditorSectionProps {
  catalog?: any[];
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.ElementType; hint: string }[] = [
  { id: 'pencil', label: 'Pencil', key: 'B', icon: Pencil, hint: 'Paint with the current colour' },
  { id: 'eraser', label: 'Eraser', key: 'E', icon: Eraser, hint: 'Make pixels transparent' },
  { id: 'fill', label: 'Fill', key: 'G', icon: PaintBucket, hint: 'Fill touching pixels of one colour, on one face' },
  { id: 'replace', label: 'Swap', key: 'R', icon: Replace, hint: 'Swap one colour for the current one across its whole layer' },
  { id: 'picker', label: 'Pick', key: 'I', icon: Pipette, hint: 'Take a colour from the skin (or hold Alt with any tool)' },
  { id: 'lighten', label: 'Lighten', key: 'L', icon: Sun, hint: 'Brighten what is already there' },
  { id: 'darken', label: 'Darken', key: 'D', icon: Moon, hint: 'Shade what is already there' },
  { id: 'noise', label: 'Noise', key: 'N', icon: Sparkles, hint: 'Paint the current colour with a random grain' },
  { id: 'move', label: 'Move', key: 'V', icon: Hand, hint: 'Drag to turn the 3D model without painting' },
];

const SWATCHES = [
  '#15120E', '#3B3F4C', '#7C8294', '#B8BDC9', '#FFFFFF', '#F2D5B1', '#D9A679', '#A96E45', '#6E4326', '#3E2412',
  '#7A0E18', '#E3202E', '#FF7A1A', '#FFD60A', '#FFF1A8', '#0E5A2E', '#2BA84A', '#8CE05A', '#0B7A8F', '#35D0E0',
  '#123A8C', '#2F6FE0', '#8DB8FF', '#4B1E91', '#9A5CF5', '#D8B4FE', '#A0146B', '#F04CB0', '#FFB3DC',
];

const FLAT_PX = 640;
const HISTORY_LIMIT = 100;
const SHADE_STEP = 0.14;
const NOISE_RANGE = 22;
const DRAFT_KEY = 'kirkahub_skin_editor_draft_v1';

const hexToRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const clamp8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
    img.src = src;
  });
}

/** Reads a skin image, upgrading the old half-height format. Null if it isn't a skin size we know. */
function imageToPixels(img: HTMLImageElement): { pixels: Uint8ClampedArray; size: SkinSize } | null {
  const { naturalWidth: w, naturalHeight: h } = img;
  if ((w !== 64 && w !== 128) || (h !== w && h !== w / 2)) return null;
  const size = w as SkinSize;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  if (h === size / 2) upgradeLegacySkin(pixels, size);
  return { pixels, size };
}

/**
 * The pixel grid for one body part, as loops around the box: one ring per pixel along each axis,
 * which between them rule every face. (w, h, d) is the mesh's own box; the arms are a unit box
 * scaled up, and the grid scales with them because it's a child of the mesh.
 */
function pixelGridGeometry(w: number, h: number, d: number, nx: number, ny: number, nz: number): BufferGeometry {
  const v: number[] = [];
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const seg = (a: number[], b: number[]) => v.push(...a, ...b);
  for (let i = 0; i <= nx; i++) {
    const x = -hx + (i * w) / nx;
    seg([x, -hy, -hz], [x, hy, -hz]); seg([x, hy, -hz], [x, hy, hz]); seg([x, hy, hz], [x, -hy, hz]); seg([x, -hy, hz], [x, -hy, -hz]);
  }
  for (let i = 0; i <= ny; i++) {
    const y = -hy + (i * h) / ny;
    seg([-hx, y, -hz], [hx, y, -hz]); seg([hx, y, -hz], [hx, y, hz]); seg([hx, y, hz], [-hx, y, hz]); seg([-hx, y, hz], [-hx, y, -hz]);
  }
  for (let i = 0; i <= nz; i++) {
    const z = -hz + (i * d) / nz;
    seg([-hx, -hy, z], [hx, -hy, z]); seg([hx, -hy, z], [hx, hy, z]); seg([hx, hy, z], [-hx, hy, z]); seg([-hx, hy, z], [-hx, -hy, z]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(v, 3));
  return g;
}

/** A little front-on player made of buttons, one per body part, in the proportions of the real model. */
const BodyFigure: React.FC<{
  shown: Record<PartName, boolean>;
  armWidth: number;
  onPart: (part: PartName) => void;
}> = ({ shown, armWidth, onPart }) => {
  const U = 6; // px per skin pixel
  const gap = 1; // skin pixels between the arm and the torso, so they read as separate buttons
  const left = armWidth + gap;
  const parts: { part: PartName; x: number; y: number; w: number; h: number }[] = [
    { part: 'head', x: left, y: 0, w: 8, h: 7.5 },
    { part: 'rightArm', x: 0, y: 8, w: armWidth, h: 11.5 },
    { part: 'body', x: left, y: 8, w: 8, h: 11.5 },
    { part: 'leftArm', x: left + 8 + gap, y: 8, w: armWidth, h: 11.5 },
    { part: 'rightLeg', x: left, y: 20, w: 3.75, h: 12 },
    { part: 'leftLeg', x: left + 4.25, y: 20, w: 3.75, h: 12 },
  ];
  return (
    <div className="relative mx-auto" style={{ width: (left * 2 + 8) * U, height: 32 * U }}>
      {parts.map(({ part, x, y, w, h }) => (
        <button
          key={part}
          type="button"
          onClick={() => onPart(part)}
          aria-pressed={shown[part]}
          aria-label={PART_LABELS[part]}
          title={`${PART_LABELS[part]}: ${shown[part] ? 'on' : 'off'}`}
          className={`absolute border-2 cursor-pointer transition-colors ${
            shown[part] ? 'bg-[var(--accent)] hover:brightness-110 border-[var(--ink)]' : 'bg-transparent border-slate-700 border-dashed hover:bg-obsidian-hover'
          }`}
          style={{ left: x * U, top: y * U, width: w * U, height: h * U }}
        />
      ))}
    </div>
  );
};

export const SkinEditorSection: React.FC<SkinEditorSectionProps> = ({ catalog = [] }) => {
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#E3202E');
  const [recent, setRecent] = useState<string[]>([]);
  const [brush, setBrush] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [model, setModel] = useState<SkinModel>('slim');
  const [size, setSize] = useState<SkinSize>(64);
  const [grid, setGrid] = useState(true);
  const [motion, setMotion] = useState<Motion>('still');
  const [spin, setSpin] = useState(false);
  const [showBody, setShowBody] = useState(true);
  const [showOuter, setShowOuter] = useState(true);
  const [parts, setParts] = useState<Record<PartName, boolean>>(() => Object.fromEntries(PART_NAMES.map((p) => [p, true])) as Record<PartName, boolean>);
  const [partMode, setPartMode] = useState<'toggle' | 'isolate'>('toggle');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hover, setHover] = useState<string>('');
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [username, setUsername] = useState('');
  const [kirkaName, setKirkaName] = useState('');
  const [importing, setImporting] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const pixels = useRef<Uint8ClampedArray>(blankSkin('slim', 64));
  const hovered = useRef(-1);
  const undoStack = useRef<{ pixels: Uint8ClampedArray; model: SkinModel; size: SkinSize }[]>([]);
  const redoStack = useRef<{ pixels: Uint8ClampedArray; model: SkinModel; size: SkinSize }[]>([]);
  const stroke = useRef<{ before: Uint8ClampedArray; touched: Set<number>; last: number; changed: boolean } | null>(null);

  // the pointer handlers are bound once; they read the current settings from here
  const live = useRef({ tool, color, brush, mirror, model, size, grid, showBody, showOuter, parts });
  live.current = { tool, color, brush, mirror, model, size, grid, showBody, showOuter, parts };

  /** A part of a layer can be seen and edited only when both the layer and the part are on. */
  const isOn = (overlay: boolean, part: PartName) => live.current.parts[part] && (overlay ? live.current.showOuter : live.current.showBody);

  const characters = useMemo(
    () => catalog.filter((c) => c?.type === 'BODY_SKIN' && c?.name).map((c) => ({ name: String(c.name).replace(/^_+/, '').trim(), textureUrl: c.textureUrl as string | null })),
    [catalog]
  );

  // ---------------------------------------------------------------- drawing what's in `pixels`
  const drawFlat = useCallback(() => {
    const canvas = flatRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const S = FLAT_PX / live.current.size;
    const { cells, faces, mirror: mirrorMap } = getSkinLayout(live.current.model, live.current.size);
    const data = pixels.current;
    ctx.fillStyle = '#11121B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < live.current.size; y++) {
      for (let x = 0; x < live.current.size; x++) {
        const i = x + y * live.current.size;
        if (!cells[i]) continue;
        // a checker shows through wherever the skin is transparent
        ctx.fillStyle = (x + y) % 2 ? '#2B2F42' : '#363B52';
        ctx.fillRect(x * S, y * S, S, S);
        const a = data[i * 4 + 3];
        if (a) {
          ctx.fillStyle = `rgba(${data[i * 4]},${data[i * 4 + 1]},${data[i * 4 + 2]},${a / 255})`;
          ctx.fillRect(x * S, y * S, S, S);
        }
      }
    }
    if (live.current.grid) {
      ctx.fillStyle = live.current.size === 128 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.09)';
      for (const { rect } of faces) {
        for (let gx = 1; gx < rect.w; gx++) ctx.fillRect((rect.x + gx) * S, rect.y * S, 1, rect.h * S);
        for (let gy = 1; gy < rect.h; gy++) ctx.fillRect(rect.x * S, (rect.y + gy) * S, rect.w * S, 1);
      }
    }
    for (const f of faces) {
      ctx.strokeStyle = f.overlay ? 'rgba(77,163,255,0.8)' : 'rgba(255,246,224,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(f.rect.x * S + 0.5, f.rect.y * S + 0.5, f.rect.w * S - 1, f.rect.h * S - 1);
    }
    // deselected parts are out of play, so they sit back under a dark wash
    ctx.fillStyle = 'rgba(17,18,27,0.78)';
    for (const f of faces) {
      if (!isOn(f.overlay, f.part)) ctx.fillRect(f.rect.x * S, f.rect.y * S, f.rect.w * S, f.rect.h * S);
    }
    const mark = (i: number, style: string) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = 2;
      ctx.strokeRect((i % live.current.size) * S + 1, Math.floor(i / live.current.size) * S + 1, S - 2, S - 2);
    };
    if (hovered.current >= 0 && cells[hovered.current]) {
      mark(hovered.current, '#FFD60A');
      if (live.current.mirror && mirrorMap[hovered.current] >= 0) mark(mirrorMap[hovered.current], 'rgba(255,214,10,0.55)');
    }
  }, []);

  const pushToViewer = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const source = document.createElement('canvas');
    source.width = source.height = live.current.size;
    source.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.current), live.current.size, live.current.size), 0, 0);
    viewer.loadSkin(source, { model: live.current.model });
  }, []);

  const refresh = useCallback(() => {
    drawFlat();
    pushToViewer();
  }, [drawFlat, pushToViewer]);

  // ---------------------------------------------------------------- history and draft
  const saveDraft = useCallback(() => {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = live.current.size;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.current), live.current.size, live.current.size), 0, 0);
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ model: live.current.model, png: c.toDataURL('image/png') }));
    } catch {
      // private window or full storage: the editor still works, it just won't remember
    }
  }, []);

  const syncHistory = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const remember = useCallback((before: Uint8ClampedArray, beforeModel: SkinModel, beforeSize: SkinSize) => {
    undoStack.current.push({ pixels: before, model: beforeModel, size: beforeSize });
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    syncHistory();
    saveDraft();
  }, [saveDraft, syncHistory]);

  const applyModel = useCallback((next: SkinModel, nextSize: SkinSize) => {
    live.current.model = next;
    live.current.size = nextSize;
    setModel(next);
    setSize(nextSize);
    const viewer = viewerRef.current;
    if (viewer) viewer.playerObject.skin.modelType = next;
  }, []);

  const step = useCallback((from: typeof undoStack, to: typeof undoStack) => {
    const entry = from.current.pop();
    if (!entry) return;
    to.current.push({ pixels: new Uint8ClampedArray(pixels.current), model: live.current.model, size: live.current.size });
    pixels.current = entry.pixels;
    applyModel(entry.model, entry.size);
    refresh();
    syncHistory();
    saveDraft();
  }, [applyModel, refresh, saveDraft, syncHistory]);

  const undo = useCallback(() => step(undoStack, redoStack), [step]);
  const redo = useCallback(() => step(redoStack, undoStack), [step]);

  /** Replaces the whole skin, as one undoable step. */
  const replaceSkin = useCallback((next: Uint8ClampedArray, nextModel: SkinModel, nextSize: SkinSize) => {
    remember(new Uint8ClampedArray(pixels.current), live.current.model, live.current.size);
    clearUnusedPixels(next, nextModel, nextSize);
    pixels.current = next;
    applyModel(nextModel, nextSize);
    refresh();
    saveDraft();
  }, [applyModel, refresh, remember, saveDraft]);

  // ---------------------------------------------------------------- the tools
  const setPixel = (i: number, r: number, g: number, b: number, a: number) => {
    // every tool writes through here, so this one check covers brushes, fill, swap and mirror
    const cell = getSkinLayout(live.current.model, live.current.size).cells[i];
    if (!cell || !isOn(cell.overlay, cell.part)) return;
    const d = pixels.current;
    const o = i * 4;
    if (d[o] === r && d[o + 1] === g && d[o + 2] === b && d[o + 3] === a) return;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
    if (stroke.current) stroke.current.changed = true;
  };

  const shade = (i: number, factor: number) => {
    const d = pixels.current;
    const o = i * 4;
    if (!d[o + 3]) return;
    setPixel(i, clamp8(d[o] * factor), clamp8(d[o + 1] * factor), clamp8(d[o + 2] * factor), d[o + 3]);
  };

  /** One pixel of a brush stroke. Each pixel changes once per stroke, so shading doesn't pile up under a slow drag. */
  const paintOne = (i: number) => {
    const s = stroke.current;
    if (!s || s.touched.has(i)) return;
    s.touched.add(i);
    const { tool: t, color: hex, mirror: useMirror, model: m } = live.current;
    const twin = useMirror ? getSkinLayout(m, live.current.size).mirror[i] : -1;
    if (twin >= 0) s.touched.add(twin);
    const both = (fn: (px: number) => void) => {
      fn(i);
      if (twin >= 0 && twin !== i) fn(twin);
    };
    if (t === 'pencil') {
      const [r, g, b] = hexToRgb(hex);
      both((px) => setPixel(px, r, g, b, 255));
    } else if (t === 'eraser') {
      both((px) => setPixel(px, 0, 0, 0, 0));
    } else if (t === 'lighten') {
      both((px) => {
        const d = pixels.current;
        const o = px * 4;
        if (!d[o + 3]) return;
        // push toward white, so pure black can still be lightened
        setPixel(px, clamp8(d[o] + (255 - d[o]) * SHADE_STEP), clamp8(d[o + 1] + (255 - d[o + 1]) * SHADE_STEP), clamp8(d[o + 2] + (255 - d[o + 2]) * SHADE_STEP), d[o + 3]);
      });
    } else if (t === 'darken') {
      both((px) => shade(px, 1 - SHADE_STEP));
    } else if (t === 'noise') {
      const [r, g, b] = hexToRgb(hex);
      const n = (Math.random() * 2 - 1) * NOISE_RANGE;
      both((px) => setPixel(px, clamp8(r + n), clamp8(g + n), clamp8(b + n), 255));
    }
  };

  /** Lays the brush square at a pixel, staying on the face the pixel belongs to. */
  const stamp = (i: number) => {
    const { brush: size, model: m } = live.current;
    const { cells } = getSkinLayout(m, live.current.size);
    const centre = cells[i];
    if (!centre) return;
    const x0 = i % live.current.size;
    const y0 = Math.floor(i / live.current.size);
    const off = Math.floor((size - 1) / 2);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const x = x0 + dx - off;
        const y = y0 + dy - off;
        if (x < 0 || y < 0 || x >= live.current.size || y >= live.current.size) continue;
        const j = x + y * live.current.size;
        if (cells[j]?.faceId === centre.faceId) paintOne(j);
      }
    }
  };

  const sameColor = (a: number, b: number) => {
    const d = pixels.current;
    const oa = a * 4;
    const ob = b * 4;
    if (d[oa + 3] === 0 && d[ob + 3] === 0) return true;
    return d[oa] === d[ob] && d[oa + 1] === d[ob + 1] && d[oa + 2] === d[ob + 2] && d[oa + 3] === d[ob + 3];
  };

  const floodFill = (start: number) => {
    const { color: hex, mirror: useMirror, model: m } = live.current;
    const { cells, mirror: mirrorMap } = getSkinLayout(m, live.current.size);
    const cell = cells[start];
    if (!cell) return;
    const [r, g, b] = hexToRgb(hex);
    const region: number[] = [];
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const i = queue.pop()!;
      region.push(i);
      const x = i % live.current.size;
      for (const j of [x > 0 ? i - 1 : -1, x < live.current.size - 1 ? i + 1 : -1, i - live.current.size, i + live.current.size]) {
        if (j < 0 || j >= cells.length || seen.has(j) || cells[j]?.faceId !== cell.faceId || !sameColor(j, start)) continue;
        seen.add(j);
        queue.push(j);
      }
    }
    for (const i of region) {
      setPixel(i, r, g, b, 255);
      if (useMirror && mirrorMap[i] >= 0) setPixel(mirrorMap[i], r, g, b, 255);
    }
  };

  const swapColor = (start: number) => {
    const { color: hex, model: m } = live.current;
    const { cells } = getSkinLayout(m, live.current.size);
    const cell = cells[start];
    if (!cell) return;
    const [r, g, b] = hexToRgb(hex);
    const d = pixels.current;
    const from = [d[start * 4], d[start * 4 + 1], d[start * 4 + 2], d[start * 4 + 3]];
    if (!from[3]) return; // swapping "nothing" would flood every empty pixel on the layer
    cells.forEach((c, i) => {
      if (!c || c.overlay !== cell.overlay) return;
      const o = i * 4;
      if (d[o] === from[0] && d[o + 1] === from[1] && d[o + 2] === from[2] && d[o + 3] === from[3]) setPixel(i, r, g, b, 255);
    });
  };

  const pickFrom = (i: number) => {
    const d = pixels.current;
    if (!d[i * 4 + 3]) return false;
    setColor(rgbToHex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]));
    return true;
  };

  const addRecent = (hex: string) => setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 12));

  /** Starts a stroke at a skin pixel. The pixel-less tools act here and leave no stroke open. */
  const beginStroke = (i: number, altKey: boolean) => {
    const { tool: t } = live.current;
    if (t === 'move') return false;
    if (t === 'picker' || altKey) {
      pickFrom(i);
      return false;
    }
    stroke.current = { before: new Uint8ClampedArray(pixels.current), touched: new Set(), last: i, changed: false };
    if (t === 'fill') floodFill(i);
    else if (t === 'replace') swapColor(i);
    else stamp(i);
    refresh();
    return true;
  };

  const endStroke = () => {
    const s = stroke.current;
    stroke.current = null;
    if (!s || !s.changed) return;
    remember(s.before, live.current.model, live.current.size);
    const { tool: t, color: hex } = live.current;
    if (t === 'pencil' || t === 'fill' || t === 'replace' || t === 'noise') addRecent(hex);
  };

  /** Fills in the pixels between two pointer events, so a fast drag leaves a solid line. */
  const strokeTo = (i: number) => {
    const s = stroke.current;
    const { tool: t } = live.current;
    if (!s || t === 'fill' || t === 'replace') return;
    const { cells } = getSkinLayout(live.current.model, live.current.size);
    // a jump between faces isn't a line across the sheet: it's the brush crossing an edge of the model
    if (cells[s.last]?.faceId !== cells[i]?.faceId) {
      stamp(i);
    } else {
      let x0 = s.last % live.current.size;
      let y0 = Math.floor(s.last / live.current.size);
      const x1 = i % live.current.size;
      const y1 = Math.floor(i / live.current.size);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        stamp(x0 + y0 * live.current.size);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    s.last = i;
    refresh();
  };

  // ---------------------------------------------------------------- the flat sheet
  const flatIndex = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * live.current.size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * live.current.size);
    if (x < 0 || y < 0 || x >= live.current.size || y >= live.current.size) return -1;
    return x + y * live.current.size;
  };

  const describe = (i: number) => {
    const cell = i >= 0 ? getSkinLayout(live.current.model, live.current.size).cells[i] : null;
    if (!cell) return '';
    return `${PART_LABELS[cell.part]} · ${cell.face} · ${cell.overlay ? 'outer layer' : 'body'} · ${i % live.current.size}, ${Math.floor(i / live.current.size)}`;
  };

  const onFlatDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const i = flatIndex(e);
    if (i < 0 || !getSkinLayout(live.current.model, live.current.size).cells[i]) return;
    if (beginStroke(i, e.altKey)) e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onFlatMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const i = flatIndex(e);
    hovered.current = i;
    setHover(describe(i));
    const valid = i >= 0 && !!getSkinLayout(live.current.model, live.current.size).cells[i];
    if (stroke.current && valid) strokeTo(i);
    else drawFlat();
  };

  // ---------------------------------------------------------------- the 3D model
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const canvas = document.createElement('canvas');
    canvas.style.touchAction = 'none';
    canvas.style.display = 'block';
    stage.appendChild(canvas);

    const source = document.createElement('canvas');
    source.width = source.height = live.current.size;
    source.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.current), live.current.size, live.current.size), 0, 0);

    const viewer = new SkinViewer({
      canvas,
      width: Math.max(stage.clientWidth, 100),
      height: Math.max(stage.clientHeight, 100),
      model: live.current.model,
      skin: source,
    });
    viewer.camera.position.set(-22, 14, 42);
    viewer.camera.lookAt(0, 0, 0);
    viewer.controls.enablePan = false;
    viewer.controls.mouseButtons.RIGHT = 0; // right drag always turns the model, whatever the tool
    viewerRef.current = viewer;

    const resizeObserver = new ResizeObserver(() => {
      if (stage.clientWidth > 0 && stage.clientHeight > 0) viewer.setSize(stage.clientWidth, stage.clientHeight);
    });
    resizeObserver.observe(stage);

    const raycaster = new Raycaster();
    const pointer = new Vector2();

    /** The skin pixels under the pointer, nearest first: only what's showing can be hit. */
    const pixelsUnder = (e: PointerEvent): number[] => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, viewer.camera as never);
      const skin = viewer.playerObject.skin;
      const meshes = PART_NAMES.flatMap((p) => [skin[p].outerLayer, skin[p].innerLayer]).filter((m) => m.visible && m.parent?.visible !== false);
      const { size: sz, model: m } = live.current;
      const { cells } = getSkinLayout(m, sz);
      const out: number[] = [];
      for (const hit of raycaster.intersectObjects(meshes as never[], false)) {
        if (!hit.uv) continue;
        const x = Math.min(sz - 1, Math.floor(hit.uv.x * sz));
        const y = Math.min(sz - 1, Math.floor((1 - hit.uv.y) * sz));
        const i = x + y * sz;
        if (cells[i]) out.push(i);
      }
      return out;
    };

    // Capture phase, so this decides before the orbit controls do: on the model it paints, off the
    // model it turns. That keeps one finger enough on a phone.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) {
        viewer.controls.enabled = true;
        return;
      }
      const { tool: t } = live.current;
      let i = -1;
      if (t !== 'move') {
        const hits = pixelsUnder(e);
        // Painting hits whatever's in front, so an outer layer that's showing takes the brush. Picking
        // reads what you can see, which passes through outer pixels that have no paint on them.
        if (t === 'picker' || e.altKey) i = hits.find((h) => pixels.current[h * 4 + 3]) ?? -1;
        else i = hits[0] ?? -1;
      }
      if (i < 0) {
        viewer.controls.enabled = true;
        return;
      }
      viewer.controls.enabled = false;
      if (beginStroke(i, e.altKey)) {
        canvas.setPointerCapture(e.pointerId);
        if (viewer.animation) viewer.animation.paused = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!stroke.current) return;
      const i = pixelsUnder(e)[0] ?? -1;
      if (i >= 0) strokeTo(i);
    };
    const onUp = () => {
      if (stroke.current) endStroke();
      viewer.controls.enabled = true;
      if (viewer.animation) viewer.animation.paused = false;
    };
    const noMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', onDown, true);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('contextmenu', noMenu);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onDown, true);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('contextmenu', noMenu);
      viewerRef.current = null;
      viewer.dispose();
      canvas.remove();
    };
    // the handlers read current settings through `live` and `pixels`, so this runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.animation = motion === 'idle' ? new IdleAnimation() : motion === 'walk' ? new WalkingAnimation() : motion === 'run' ? new RunningAnimation() : null;
    if (motion === 'still') {
      // an animation leaves the limbs wherever it stopped; a painter needs them straight
      for (const p of PART_NAMES) viewer.playerObject.skin[p].rotation.set(0, 0, 0);
      viewer.playerObject.skin.rotation.set(0, 0, 0);
      viewer.playerObject.position.set(0, 0, 0);
    }
  }, [motion]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.autoRotate = spin;
    viewer.autoRotateSpeed = 1.2;
  }, [spin]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const skin = viewer.playerObject.skin;
    for (const p of PART_NAMES) {
      skin[p].innerLayer.visible = showBody && parts[p];
      skin[p].outerLayer.visible = showOuter && parts[p];
    }
  }, [showBody, showOuter, parts, model]);

  // The pixel grid, drawn on the model itself: on the body, and as a shell floating where the outer
  // layer is, so the outer layer can be seen and clicked before it has any paint on it.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const skin = viewer.playerObject.skin;
    const k = size / 64;
    // dark lines read on a skin, light ones on the empty stage, so the body gets both
    const bodyDark = new LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
    const bodyLight = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false });
    const outer = new LineBasicMaterial({ color: 0x8db8ff, transparent: true, opacity: k > 1 ? 0.3 : 0.5, depthWrite: false });
    const added: { parent: { remove: (o: never) => void }; line: LineSegments }[] = [];
    if (grid) {
      for (const p of PART_NAMES) {
        const { w, h, d } = partPixels(p, model);
        for (const [mesh, materials] of [[skin[p].innerLayer, [bodyDark, bodyLight]], [skin[p].outerLayer, [outer]]] as const) {
          const box = (mesh as unknown as { geometry: { parameters: { width: number; height: number; depth: number } } }).geometry.parameters;
          const geometry = pixelGridGeometry(box.width, box.height, box.depth, w * k, h * k, d * k);
          for (const material of materials) {
            const line = new LineSegments(geometry, material);
            line.scale.setScalar(1.002); // just off the surface, so it doesn't flicker against it
            (mesh as unknown as { add: (o: never) => void }).add(line as never);
            added.push({ parent: mesh as never, line });
          }
        }
      }
    }
    return () => {
      for (const { parent, line } of added) {
        parent.remove(line as never);
        line.geometry.dispose();
      }
      bodyDark.dispose();
      bodyLight.dispose();
      outer.dispose();
    };
  }, [grid, model, size]);

  useEffect(() => {
    drawFlat();
  }, [drawFlat, grid, mirror, model, size, showBody, showOuter, parts]);

  // ---------------------------------------------------------------- restore the draft, once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw) as { model: SkinModel; png: string };
        const img = await loadImage(draft.png);
        const data = imageToPixels(img);
        if (!data || cancelled) return;
        pixels.current = data.pixels;
        applyModel(draft.model === 'default' ? 'default' : 'slim', data.size);
        refresh();
      } catch {
        // no storage or a damaged draft: start from the mannequin
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyModel, refresh]);

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const match = TOOLS.find((t) => t.key.toLowerCase() === k);
      if (match) setTool(match.id);
      else if (k === 'm') setMirror((v) => !v);
      else if (k === 'o') setShowOuter((v) => !v);
      else if (k === 'h') setShowBody((v) => !v);
      else if (k === '[') setBrush((v) => Math.max(1, v - 1));
      else if (k === ']') setBrush((v) => Math.min(4, v + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redo, undo]);

  // ---------------------------------------------------------------- import and export
  const say = (text: string, bad = false) => setNotice({ text, bad });

  const adopt = (data: { pixels: Uint8ClampedArray; size: SkinSize }, label: string) => {
    const classic = looksClassic(data.pixels, data.size);
    replaceSkin(data.pixels, classic ? 'default' : 'slim', data.size);
    const res = `${data.size}x${data.size}`;
    say(classic ? `${label} loaded at ${res}. It was drawn for 4px arms, so the model switched to Classic to keep every pixel.` : `${label} loaded at ${res}.`);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const data = imageToPixels(await loadImage(url));
      if (!data) say('That image is not a skin. It has to be a 64x64 or 128x128 PNG (or the old half-height kind).', true);
      else adopt(data, file.name);
    } catch {
      say('That file could not be read as an image.', true);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const importUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
      say('Minecraft names are 1 to 16 letters, numbers or underscores.', true);
      return;
    }
    setImporting(true);
    try {
      const data = imageToPixels(await loadImage(`https://mc-heads.net/skin/${encodeURIComponent(name)}`));
      if (!data) say(`The skin for ${name} is not a size this editor supports.`, true);
      else adopt(data, name);
    } catch {
      say(`Could not fetch a skin for ${name}.`, true);
    } finally {
      setImporting(false);
    }
  };

  const importKirka = async (e: React.FormEvent) => {
    e.preventDefault();
    const wanted = kirkaName.trim().toLowerCase();
    if (!wanted) return;
    const item = characters.find((c) => c.name.toLowerCase() === wanted);
    if (!item) {
      say(`No Kirka character called "${kirkaName.trim()}".`, true);
      return;
    }
    setImporting(true);
    try {
      const raw = cleanTextureUrl(item.textureUrl);
      const url = raw && !isPlaceholderUrl(raw) ? raw : `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(item.name)}`;
      const data = imageToPixels(await loadImage(getProxiedTextureUrl(url)));
      if (!data) say(`${item.name} is not a 64x64 or 128x128 skin, so it can't be edited here.`, true);
      else adopt(data, item.name);
    } catch {
      say(`Could not load ${item.name}.`, true);
    } finally {
      setImporting(false);
    }
  };

  const downloadSkin = () => {
    const c = document.createElement('canvas');
    c.width = c.height = live.current.size;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels.current), live.current.size, live.current.size), 0, 0);
    const link = document.createElement('a');
    link.download = `kirkahub-skin-${live.current.model === 'slim' ? 'slim' : 'classic'}-${live.current.size}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  };

  const newSkin = () => {
    replaceSkin(blankSkin(live.current.model, live.current.size), live.current.model, live.current.size);
    say('New skin. Undo brings the old one back.');
  };

  const changeModel = (next: SkinModel) => {
    if (next === live.current.model) return;
    replaceSkin(new Uint8ClampedArray(pixels.current), next, live.current.size);
    say(next === 'slim' ? 'Slim arms (3px).' : 'Classic arms (4px). The new column is empty, ready to paint.');
  };

  const changeSize = (next: SkinSize) => {
    const from = live.current.size;
    if (next === from) return;
    replaceSkin(resizeSkin(pixels.current, from, next), live.current.model, next);
    say(next === 128 ? 'Now 128x128: each old pixel is a 2x2 block, ready for finer detail.' : 'Now 64x64. Fine detail was lost in the shrink; undo brings it back.');
  };

  /** Layer-wide actions: each one is a single undo step. */
  const editLayers = (fn: (d: Uint8ClampedArray, base: number[], over: number[]) => void) => {
    const next = new Uint8ClampedArray(pixels.current);
    const { cells } = getSkinLayout(live.current.model, live.current.size);
    const offsets = (overlay: boolean) => {
      const out: number[] = [];
      cells.forEach((c, i) => {
        if (c && c.overlay === overlay) out.push(i);
      });
      return out;
    };
    fn(next, offsets(false), offsets(true));
    replaceSkin(next, live.current.model, live.current.size);
  };

  /** The overlay box of each base pixel: same face, same spot, on the overlay's part of the sheet. */
  const baseToOverlayMap = () => {
    const { faces } = getSkinLayout(live.current.model, live.current.size);
    const pairs: [number, number][] = [];
    for (const f of faces) {
      if (f.overlay) continue;
      const o = faces.find((g) => g.overlay && g.part === f.part && g.face === f.face)!;
      for (let fy = 0; fy < f.rect.h; fy++) {
        for (let fx = 0; fx < f.rect.w; fx++) {
          pairs.push([f.rect.x + fx + (f.rect.y + fy) * live.current.size, o.rect.x + fx + (o.rect.y + fy) * live.current.size]);
        }
      }
    }
    return pairs;
  };

  const copyBaseToOverlay = () => editLayers((d) => {
    for (const [b, o] of baseToOverlayMap()) for (let c = 0; c < 4; c++) d[o * 4 + c] = d[b * 4 + c];
  });

  const flattenOverlay = () => editLayers((d) => {
    for (const [b, o] of baseToOverlayMap()) {
      if (d[o * 4 + 3] === 255) {
        for (let c = 0; c < 4; c++) d[b * 4 + c] = d[o * 4 + c];
      }
      d.fill(0, o * 4, o * 4 + 4);
    }
  });

  const clearLayer = (outerLayer: boolean) => editLayers((d, base, over) => {
    for (const i of outerLayer ? over : base) d.fill(0, i * 4, i * 4 + 4);
  });

  const mirrorWholeSkin = () => {
    const before = pixels.current;
    const next = new Uint8ClampedArray(before);
    const { mirror: map } = getSkinLayout(live.current.model, live.current.size);
    for (let i = 0; i < map.length; i++) {
      if (map[i] < 0) continue;
      for (let c = 0; c < 4; c++) next[map[i] * 4 + c] = before[i * 4 + c];
    }
    replaceSkin(next, live.current.model, live.current.size);
  };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // ---------------------------------------------------------------- body parts
  const allParts = (on: boolean) => Object.fromEntries(PART_NAMES.map((p) => [p, on])) as Record<PartName, boolean>;

  const showEverything = () => {
    setParts(allParts(true));
    setShowBody(true);
    setShowOuter(true);
  };

  const clickPart = (part: PartName) => {
    if (partMode === 'isolate') setParts({ ...allParts(false), [part]: true });
    else setParts((s) => ({ ...s, [part]: !s[part] }));
  };

  // ---------------------------------------------------------------- view
  const chip = (on: boolean) => `px-2.5 py-1.5 border-2 text-[13px] font-bold cursor-pointer transition-colors ${
    on ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]' : 'bg-obsidian-dark text-slate-300 border-[var(--ink)] hover:bg-obsidian-hover'
  }`;
  const action = 'btn-interactive flex items-center justify-center gap-1.5 px-2.5 py-1.5 border-2 border-[var(--ink)] bg-obsidian-dark text-[13px] font-bold text-slate-200 cursor-pointer disabled:opacity-40 disabled:pointer-events-none';
  const panel = 'bg-obsidian-card border p-3.5 space-y-2.5';
  const heading = 'display text-[19px] text-slate-100 leading-none';

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6 space-y-4 select-none">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-obsidian-border pb-4">
        <div>
          <h1 className="display text-4xl sm:text-5xl text-slate-100 flex items-center gap-3">
            <Brush className="w-8 h-8 text-gold-bright" />
            <span>Skin <span className="mark">Editor</span></span>
          </h1>
          <p className="text-[15px] text-slate-400 mt-1.5 max-w-[70ch] select-text">
            Paint a 64x64 or 128x128 skin on the 3px slim model, in 3D or on the flat sheet. It all happens in your browser, so nothing is uploaded.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className={action}><Undo2 className="w-4 h-4" /> Undo</button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className={action}><Redo2 className="w-4 h-4" /> Redo</button>
          <button type="button" onClick={newSkin} className={action}><FilePlus2 className="w-4 h-4" /> New</button>
          <button type="button" onClick={() => fileRef.current?.click()} className={action}><Upload className="w-4 h-4" /> Open PNG</button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={downloadSkin} className="display flex items-center gap-1.5 h-9 px-4 bg-gold-primary text-[18px] cursor-pointer">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </header>

      {notice && (
        // floats over the page: a bar in the flow would shift the canvas under the brush when it comes and goes
        <p role="status" className={`fixed bottom-5 right-5 z-40 max-w-sm pointer-events-none text-[14px] font-bold px-3 py-2 border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] ${notice.bad ? 'bg-[#3D1A20] text-red-300' : 'bg-obsidian-hover text-slate-100'}`}>
          {notice.text}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Tools and colour */}
        <aside className="space-y-4 lg:row-span-2 xl:row-span-1">
          <section className={panel}>
            <h2 className={`${heading} flex items-center gap-2`}><Layers className="w-4 h-4" /> Body parts</h2>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setShowBody((v) => !v)} aria-pressed={showBody} title="Show or hide the body layer (H)" className={chip(showBody)}>Body</button>
              <button type="button" onClick={() => setShowOuter((v) => !v)} aria-pressed={showOuter} title="Show or hide the outer layer (O)" className={chip(showOuter)}>Outer layer</button>
            </div>
            <p className="text-[13px] font-bold text-slate-500 leading-snug">You paint whatever's in front. Hide the outer layer to get at the body.</p>
            <BodyFigure shown={parts} armWidth={model === 'slim' ? 3 : 4} onPart={clickPart} />
            <div className="flex gap-1" role="group" aria-label="What clicking a part does">
              <button type="button" onClick={() => setPartMode('toggle')} aria-pressed={partMode === 'toggle'} title="Clicking a part turns it on or off" className={`${chip(partMode === 'toggle')} flex-1`}>On / off</button>
              <button type="button" onClick={() => setPartMode('isolate')} aria-pressed={partMode === 'isolate'} title="Clicking a part makes it the only one you can edit" className={`${chip(partMode === 'isolate')} flex-1`}>Isolate</button>
            </div>
            <button type="button" onClick={showEverything} className={`${action} w-full`}>Show everything</button>
          </section>

          <section className={panel}>
            <h2 className={heading}>Tools</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {TOOLS.map(({ id, label, key, icon: Icon, hint }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTool(id)}
                  title={`${hint} (${key})`}
                  aria-pressed={tool === id}
                  className={`flex flex-col items-center gap-0.5 py-1.5 border-2 text-[12px] font-bold cursor-pointer transition-colors ${
                    tool === id ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--ink)] shadow-[2px_2px_0_var(--ink)]' : 'bg-obsidian-dark text-slate-300 border-[var(--ink)] hover:bg-obsidian-hover'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[13px] font-bold text-slate-400">Brush</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" onClick={() => setBrush(n)} aria-pressed={brush === n} className={chip(brush === n)}>{n}</button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setMirror((v) => !v)} aria-pressed={mirror} title="Paint both sides at once (M)" className={`${chip(mirror)} w-full flex items-center justify-center gap-1.5`}>
              <FlipHorizontal2 className="w-4 h-4" /> Mirror {mirror ? 'on' : 'off'}
            </button>
          </section>

          <section className={panel}>
            <h2 className={heading}>Colour</h2>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color.toLowerCase()}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                aria-label="Pick a colour"
                className="w-11 h-11 p-0 border-2 border-[var(--ink)] bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={color}
                maxLength={7}
                spellCheck={false}
                aria-label="Hex colour"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const hex = v.startsWith('#') ? v : `#${v}`;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(hex)) setColor(hex.toUpperCase());
                }}
                onBlur={() => {
                  if (!/^#[0-9A-F]{6}$/.test(color)) setColor('#E3202E');
                }}
                className="min-w-0 flex-1 h-11 px-2 bg-obsidian-dark border-2 border-[var(--ink)] text-slate-100 font-mono text-[14px] outline-none"
              />
            </div>
            <div className="grid grid-cols-10 gap-[3px]">
              {SWATCHES.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} title={c} style={{ backgroundColor: c }} className={`aspect-square border cursor-pointer ${color === c ? 'border-[var(--accent)] outline outline-1 outline-[var(--accent)]' : 'border-[var(--ink)]'}`} />
              ))}
            </div>
            {recent.length > 0 && (
              <>
                <p className="text-[12px] font-bold text-slate-500">Recent</p>
                <div className="grid grid-cols-10 gap-[3px]">
                  {recent.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} title={c} style={{ backgroundColor: c }} className="aspect-square border border-[var(--ink)] cursor-pointer" />
                  ))}
                </div>
              </>
            )}
          </section>
        </aside>

        {/* 3D */}
        <section className="space-y-2 min-w-0">
          <div ref={stageRef} className="night relative h-[460px] xl:h-[600px] bg-[var(--stage)] border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] overflow-hidden cursor-crosshair" />
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setGrid((v) => !v)} aria-pressed={grid} className={`${chip(grid)} flex items-center gap-1.5`}>
              <Grid3x3 className="w-4 h-4" /> Grid
            </button>
            <div className="flex gap-1 ml-auto" role="group" aria-label="Animation">
              {(['still', 'idle', 'walk', 'run'] as Motion[]).map((m) => (
                <button key={m} type="button" onClick={() => setMotion(m)} aria-pressed={motion === m} className={`${chip(motion === m)} capitalize`}>{m}</button>
              ))}
              <button type="button" onClick={() => setSpin((v) => !v)} aria-pressed={spin} className={chip(spin)}>Spin</button>
            </div>
          </div>
          <p className="text-[13px] font-bold text-slate-500">Drag on the model to paint. Drag beside it, or right-drag anywhere, to turn it. Scroll to zoom.</p>
        </section>

        {/* Flat sheet */}
        <section className="space-y-2 min-w-0 lg:col-start-2 xl:col-start-3">
          <canvas
            ref={flatRef}
            width={FLAT_PX}
            height={FLAT_PX}
            onPointerDown={onFlatDown}
            onPointerMove={onFlatMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={() => {
              hovered.current = -1;
              setHover('');
              drawFlat();
            }}
            className="block w-full aspect-square border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--ink)] touch-none cursor-crosshair"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-slate-400 min-h-5">{hover || 'Blue outlines are the outer layer, cream are the body.'}</span>
          </div>
          <NativeAd className="!mt-4" />
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={panel}>
          <h2 className={heading}>Model and layers</h2>
          <div className="flex gap-1" role="group" aria-label="Skin resolution">
            <button type="button" onClick={() => changeSize(64)} aria-pressed={size === 64} className={`${chip(size === 64)} flex-1`}>64 x 64</button>
            <button type="button" onClick={() => changeSize(128)} aria-pressed={size === 128} title="Kirka allows 128x128 skins" className={`${chip(size === 128)} flex-1`}>128 x 128</button>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => changeModel('slim')} aria-pressed={model === 'slim'} className={`${chip(model === 'slim')} flex-1`}>Slim (3px)</button>
            <button type="button" onClick={() => changeModel('default')} aria-pressed={model === 'default'} className={`${chip(model === 'default')} flex-1`}>Classic (4px)</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={copyBaseToOverlay} className={action}>Body to outer</button>
            <button type="button" onClick={flattenOverlay} title="Solid outer pixels are pressed onto the body, then the outer layer is cleared" className={action}>Flatten outer</button>
            <button type="button" onClick={() => clearLayer(true)} className={action}>Clear outer</button>
            <button type="button" onClick={() => clearLayer(false)} className={action}>Clear body</button>
            <button type="button" onClick={mirrorWholeSkin} title="Copies each side of the character onto the other" className={`${action} col-span-2`}>Mirror whole skin</button>
          </div>
        </section>

        <section className={panel}>
          <h2 className={heading}>Start from a skin</h2>
          <form onSubmit={importKirka} className="flex gap-1.5">
            <input
              value={kirkaName}
              onChange={(e) => setKirkaName(e.target.value)}
              list="skin-editor-kirka"
              placeholder="Kirka character, e.g. Gore"
              aria-label="Kirka character name"
              className="min-w-0 flex-1 h-9 px-2 bg-obsidian-dark border-2 border-[var(--ink)] text-slate-100 text-[14px] outline-none"
            />
            <datalist id="skin-editor-kirka">
              {characters.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
            <button type="submit" disabled={importing || !kirkaName.trim()} className={action}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Load
            </button>
          </form>
          <form onSubmit={importUsername} className="flex gap-1.5">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={16}
              spellCheck={false}
              placeholder="Minecraft username"
              aria-label="Minecraft username"
              className="min-w-0 flex-1 h-9 px-2 bg-obsidian-dark border-2 border-[var(--ink)] text-slate-100 text-[14px] outline-none"
            />
            <button type="submit" disabled={importing || !username.trim()} className={action}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Load
            </button>
          </form>
          <p className="text-[13px] text-slate-500 select-text">
            Your work saves itself in this browser. Keys: B E G R I L D N V for tools, M mirror, H body, O outer layer, [ ] brush, Ctrl+Z undo.
          </p>
        </section>
      </div>

      <section className="text-[15px] text-slate-400 leading-relaxed max-w-[80ch] select-text space-y-2 pt-2">
        <h2 className="display text-[26px] text-slate-100">How a skin file works</h2>
        <p>
          A player skin is a square PNG, usually 64x64, and Kirka also allows 128x128 for finer detail. Every part of the body has six faces on that sheet, and there are two
          layers: the body, and an outer layer that floats slightly outside it and can be see-through, which is how hats, jackets and hair get their depth. The slim model has arms 3 pixels wide instead of 4.
        </p>
        <p>
          The file you download works anywhere that takes a standard skin. Kirka Hub is a fan project, not affiliated with Mojang, Microsoft or Kirka.io. Minecraft is a trademark of Mojang.
        </p>
      </section>
    </div>
  );
};
