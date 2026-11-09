/**
 * The player skin format: which pixel belongs to which face of which body part, for the slim (3px
 * arm) and classic (4px arm) models, at 64x64 or Kirka's 128x128. A 128 sheet is the same layout
 * with every measurement doubled. The skin editor paints through this map, so a brush stays on one
 * face, and mirroring lands on the matching pixel of the opposite limb.
 *
 * No three.js in here, for the same reason as skinAssets.ts.
 */
export type SkinSize = 64 | 128;
export type SkinModel = 'slim' | 'default';
export type PartName = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';
export type FaceName = 'top' | 'bottom' | 'right' | 'front' | 'left' | 'back';

export const PART_NAMES: PartName[] = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];

export const PART_LABELS: Record<PartName, string> = {
  head: 'Head',
  body: 'Body',
  rightArm: 'Right arm',
  leftArm: 'Left arm',
  rightLeg: 'Right leg',
  leftLeg: 'Left leg',
};

const FACES: FaceName[] = ['top', 'bottom', 'right', 'front', 'left', 'back'];
const MIRROR_PART: Record<PartName, PartName> = {
  head: 'head',
  body: 'body',
  rightArm: 'leftArm',
  leftArm: 'rightArm',
  rightLeg: 'leftLeg',
  leftLeg: 'rightLeg',
};
const MIRROR_FACE: Record<FaceName, FaceName> = { top: 'top', bottom: 'bottom', right: 'left', left: 'right', front: 'front', back: 'back' };

interface Box {
  part: PartName;
  overlay: boolean;
  u: number;
  v: number;
  w: number;
  h: number;
  d: number;
}

export interface FaceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SkinCell {
  part: PartName;
  overlay: boolean;
  face: FaceName;
  /** Every pixel of one face of one box shares this id. */
  faceId: number;
}

/** How many skin pixels wide, tall and deep a body part is, at 64x64. */
export function partPixels(part: PartName, model: SkinModel): { w: number; h: number; d: number } {
  if (part === 'head') return { w: 8, h: 8, d: 8 };
  if (part === 'body') return { w: 8, h: 12, d: 4 };
  if (part === 'rightArm' || part === 'leftArm') return { w: model === 'slim' ? 3 : 4, h: 12, d: 4 };
  return { w: 4, h: 12, d: 4 };
}

function boxesFor(model: SkinModel, k: number): Box[] {
  const box = (part: PartName, overlay: boolean, u: number, v: number): Box => {
    const { w, h, d } = partPixels(part, model);
    return { part, overlay, u: u * k, v: v * k, w: w * k, h: h * k, d: d * k };
  };
  return [
    box('head', false, 0, 0),
    box('body', false, 16, 16),
    box('rightArm', false, 40, 16),
    box('leftArm', false, 32, 48),
    box('rightLeg', false, 0, 16),
    box('leftLeg', false, 16, 48),
    box('head', true, 32, 0),
    box('body', true, 16, 32),
    box('rightArm', true, 40, 32),
    box('leftArm', true, 48, 48),
    box('rightLeg', true, 0, 32),
    box('leftLeg', true, 0, 48),
  ];
}

function faceRect({ u, v, w, h, d }: Box, face: FaceName): FaceRect {
  switch (face) {
    case 'top': return { x: u + d, y: v, w, h: d };
    case 'bottom': return { x: u + d + w, y: v, w, h: d };
    case 'right': return { x: u, y: v + d, w: d, h };
    case 'front': return { x: u + d, y: v + d, w, h };
    case 'left': return { x: u + d + w, y: v + d, w: d, h };
    case 'back': return { x: u + d + w + d, y: v + d, w, h };
  }
}

export interface SkinLayout {
  model: SkinModel;
  size: SkinSize;
  /** Indexed by x + y * size; null where the format has no pixel. */
  cells: (SkinCell | null)[];
  /** Indexed like cells: the matching pixel across the character's centre line, or -1. */
  mirror: Int32Array;
  faces: { rect: FaceRect; overlay: boolean; part: PartName; face: FaceName }[];
}

function buildLayout(model: SkinModel, size: SkinSize): SkinLayout {
  const boxes = boxesFor(model, size / 64);
  const cells: (SkinCell | null)[] = new Array(size * size).fill(null);
  const mirror = new Int32Array(size * size).fill(-1);
  const faces: SkinLayout['faces'] = [];

  for (const box of boxes) {
    const twin = boxes.find((b) => b.part === MIRROR_PART[box.part] && b.overlay === box.overlay)!;
    for (const face of FACES) {
      const rect = faceRect(box, face);
      const twinRect = faceRect(twin, MIRROR_FACE[face]);
      const faceId = faces.length;
      faces.push({ rect, overlay: box.overlay, part: box.part, face });
      for (let fy = 0; fy < rect.h; fy++) {
        for (let fx = 0; fx < rect.w; fx++) {
          const i = rect.x + fx + (rect.y + fy) * size;
          cells[i] = { part: box.part, overlay: box.overlay, face, faceId };
          mirror[i] = twinRect.x + (rect.w - 1 - fx) + (twinRect.y + fy) * size;
        }
      }
    }
  }
  return { model, size, cells, mirror, faces };
}

const layouts = new Map<string, SkinLayout>();

export function getSkinLayout(model: SkinModel, size: SkinSize): SkinLayout {
  const key = `${model}:${size}`;
  let layout = layouts.get(key);
  if (!layout) {
    layout = buildLayout(model, size);
    layouts.set(key, layout);
  }
  return layout;
}

/** An old half-height skin from before 2014: the left limbs didn't exist and were the right ones, mirrored. */
export function upgradeLegacySkin(pixels: Uint8ClampedArray, size: SkinSize): void {
  const { cells, mirror } = getSkinLayout('default', size);
  cells.forEach((cell, i) => {
    if (!cell || cell.overlay || (cell.part !== 'rightArm' && cell.part !== 'rightLeg')) return;
    const m = mirror[i] * 4;
    for (let c = 0; c < 4; c++) pixels[m + c] = pixels[i * 4 + c];
  });
}

/** True when the 4th arm column has paint in it, meaning the skin was drawn for the classic model. */
export function looksClassic(pixels: Uint8ClampedArray, size: SkinSize): boolean {
  const k = size / 64;
  for (let y = 20 * k; y < 32 * k; y++) {
    for (let x = 54 * k; x < 56 * k; x++) {
      if (pixels[(x + y * size) * 4 + 3] > 0) return true;
    }
  }
  return false;
}

/** Wipes every pixel the model doesn't use, so a saved file has nothing stray in it. */
export function clearUnusedPixels(pixels: Uint8ClampedArray, model: SkinModel, size: SkinSize): void {
  const { cells } = getSkinLayout(model, size);
  cells.forEach((cell, i) => {
    if (!cell) pixels.fill(0, i * 4, i * 4 + 4);
  });
}

/** Resamples to the other size: doubling copies each pixel to a 2x2 block, halving keeps every other one. */
export function resizeSkin(pixels: Uint8ClampedArray, from: SkinSize, to: SkinSize): Uint8ClampedArray {
  if (from === to) return new Uint8ClampedArray(pixels);
  const out = new Uint8ClampedArray(to * to * 4);
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      const sx = Math.floor((x * from) / to);
      const sy = Math.floor((y * from) / to);
      const o = (sx + sy * from) * 4;
      out.set(pixels.subarray(o, o + 4), (x + y * to) * 4);
    }
  }
  return out;
}

/** The starting point for a new skin: a plain grey mannequin with just enough face to tell front from back. */
export function blankSkin(model: SkinModel, size: SkinSize): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const { cells } = getSkinLayout(model, size);
  const k = size / 64;
  const SHADE: Record<FaceName, number> = { top: 176, front: 160, left: 146, right: 146, back: 132, bottom: 118 };
  cells.forEach((cell, i) => {
    if (!cell || cell.overlay) return;
    const v = SHADE[cell.face];
    pixels.set([v, v + 2, v + 8, 255], i * 4);
  });
  // the head's front face starts at (8,8): two eyes
  for (const ex of [10, 13]) {
    for (let dy = 0; dy < k; dy++) {
      for (let dx = 0; dx < k; dx++) pixels.set([38, 40, 52, 255], (ex * k + dx + (12 * k + dy) * size) * 4);
    }
  }
  return pixels;
}
