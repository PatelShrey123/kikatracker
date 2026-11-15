// A flat front-and-back drawing of a skin: the Skin Editor uses it where there's no WebGL, and the
// gallery uses it for its cards, since a 3D viewer per card would be far too heavy.
import { getSkinLayout } from './skinLayout';
import type { PartName, SkinModel, SkinSize } from './skinLayout';

const DOLL_SCALE = 12; // screen pixels per skin pixel (at 64x64)
const DOLL_GAP = 6; // skin pixels between the front and the back

/** Draws the character from the front and from the back, flat, the way the 3D model would show it. */
export function drawFrontBack(canvas: HTMLCanvasElement, source: CanvasImageSource, model: SkinModel, size: SkinSize, scale = DOLL_SCALE) {
  const aw = model === 'slim' ? 3 : 4;
  const viewW = 8 + aw * 2;
  canvas.width = (viewW * 2 + DOLL_GAP) * scale;
  canvas.height = 32 * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { faces } = getSkinLayout(model, size);
  // where each part sits in a view, in skin pixels; from behind, left and right swap sides
  const spots = (back: boolean): [PartName, number, number, number, number][] => [
    ['head', aw, 0, 8, 8],
    ['body', aw, 8, 8, 12],
    [back ? 'leftArm' : 'rightArm', 0, 8, aw, 12],
    [back ? 'rightArm' : 'leftArm', aw + 8, 8, aw, 12],
    [back ? 'leftLeg' : 'rightLeg', aw, 20, 4, 12],
    [back ? 'rightLeg' : 'leftLeg', aw + 4, 20, 4, 12],
  ];
  for (const [back, ox] of [[false, 0], [true, viewW + DOLL_GAP]] as const) {
    for (const overlay of [false, true]) {
      for (const [part, x, y, w, h] of spots(back)) {
        const f = faces.find((fc) => fc.part === part && fc.overlay === overlay && fc.face === (back ? 'back' : 'front'));
        if (!f) continue;
        ctx.drawImage(source, f.rect.x, f.rect.y, f.rect.w, f.rect.h, (ox + x) * scale, y * scale, w * scale, h * scale);
      }
    }
  }
}
