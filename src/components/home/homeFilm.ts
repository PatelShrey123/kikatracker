/**
 * The home page film: one camera move over a block city at night. Scrolling runs a real Kirka player
 * across the rooftops, so scrolling back runs them backwards; nothing here plays on a timer except the
 * idle poses of the players standing around.
 *
 * It watches its own frame rate and sheds work on a machine that can't keep up, down to showing a still
 * frame where the scroll comes to rest (see "Tiers" below). The search box and the popups are plain
 * HTML, so they keep working whatever happens in here, even if the graphics context is lost for good.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getModelUrl } from '../../utils/skinAssets';
import { FILM_STOPS } from './filmStops';

export interface HomeFilm {
  dispose: () => void;
}

const asset = (file: string) => `${import.meta.env.BASE_URL}home/${file}`;

// ------------------------------------------------------------------------------------------------
// The route. `s` is distance run; the player runs down -z, so z = -s.
// ------------------------------------------------------------------------------------------------
interface Roof {
  from: number;
  to: number;
  y: number;
  halfWidth: number;
}

const ROOFS: Roof[] = [
  { from: -14, to: 26, y: 0, halfWidth: 8 },
  { from: 31, to: 72, y: -1.5, halfWidth: 8 },
  { from: 77, to: 128, y: -1, halfWidth: 8 },
  { from: 136, to: 205, y: -4, halfWidth: 9 },
  { from: 210, to: 262, y: -3, halfWidth: 8 },
  { from: 267, to: 320, y: -2, halfWidth: 8 },
  { from: 325, to: 380, y: -3, halfWidth: 8 },
  { from: 385, to: 460, y: -3, halfWidth: 12 },
];
const JUMP_HEIGHT = [1.5, 1.5, 2.6, 1.5, 1.5, 1.5, 1.5];

// A building stands across the route at each of these, with a doorway to run through. The sign is on
// the face looking back at the player, so it's square to the camera the whole way up to it.
const BUILDINGS: { gate: number; lines: string[]; pixel: number; colour: number; glow: number }[] = [
  { gate: 42, lines: ['KIRKA', 'HUB'], pixel: 0.8, colour: 0x2f2b2e, glow: 0xf5c518 },
  { gate: 112, lines: ['EVERY', 'SKIN'], pixel: 0.8, colour: 0x2b2f38, glow: 0xf4f1e8 },
  { gate: 172, lines: ['MARKET'], pixel: 0.7, colour: 0x332a28, glow: 0xf5c518 },
  { gate: 244, lines: ['COMPETE'], pixel: 0.6, colour: 0x2a2f36, glow: 0xff6b5e },
  { gate: 300, lines: ['CREATE'], pixel: 0.7, colour: 0x2d2c38, glow: 0x7fb6ff },
  { gate: 360, lines: ['LIVE'], pixel: 0.9, colour: 0x2a302d, glow: 0x7fe0a0 },
];
const BUILDING_DEPTH = 5;
const BUILDING_HALF_WIDTH = 14;
const GATES = BUILDINGS.map((b) => b.gate);
const STOP_AT = 420;
const STRIDE = 4.4;
const END_SIGN_Z = -441;

/** How far along the route the player is at each point of the scroll. Slow at each stop and over the big gap. */
const RUN_KEYS: [number, number][] = [
  [0, 0], [0.025, 0], [0.075, 44], [0.11, 82], [0.165, 88], [0.195, 118], [0.225, 128],
  [0.262, 136], [0.285, 142], [0.34, 148], [0.372, 180], [0.4, 205], [0.425, 214], [0.48, 220],
  [0.512, 250], [0.535, 264], [0.545, 270], [0.6, 276], [0.632, 306], [0.66, 322], [0.675, 330],
  [0.73, 336], [0.762, 366], [0.79, 382], [0.8, 390], [0.86, 418], [0.9, STOP_AT], [1, STOP_AT],
];

/** Low and behind the player, far enough back that the whole sign is on screen with room for the popup. */
const AT_STOP = [-0.6, 1.2, 9, -3, 6, -30, 44];
/** Following them into a doorway. */
const INTO_DOOR = [0.2, 1.8, 6, 0, 1.6, -8, 44];
const THROUGH_DOOR = [0.4, 1.9, 6, 0, 1.4, -8, 44];

/** Camera, relative to the player: x y z of the eye, x y z of what it looks at, then field of view. */
const CAMERA_KEYS: [number, number[]][] = [
  [0, [-1.5, 1.75, 4.6, 0.2, 6.2, -40, 40]],
  [0.025, [-1.5, 1.75, 4.4, 0.2, 5.6, -40, 40]],
  [0.075, [0.4, 2, 5.2, 0, 1.6, -8, 44]],
  [0.09, [-4, 1.2, 2.2, 0, 1.3, -2.5, 44]],
  // EVERY SKIN
  [0.11, AT_STOP],
  [0.165, AT_STOP],
  [0.18, INTO_DOOR],
  [0.195, THROUGH_DOOR],
  [0.21, [4.2, 1, 1, 0, 1.25, -1.5, 42]],
  // The big jump: the camera stays on the edge of the roof and watches them go.
  [0.225, [-3, 0.75, 5, 0, 1.8, -6, 48]],
  [0.243, [-2.9, 2.3, 8.2, -0.4, 3.2, -6, 44]],
  [0.262, [-2.2, 3.8, 10.4, 0, 1.6, -6, 46]],
  // MARKET
  [0.285, AT_STOP],
  [0.34, AT_STOP],
  [0.355, INTO_DOOR],
  [0.364, [3, 1.6, 0.5, 0, 1.3, -1, 46]],
  // Out among the big guns, looking back at them
  [0.378, [0.8, 1.6, -5.5, 0, 1.05, 0, 46]],
  [0.395, [-1.2, 2, -5.5, 0, 1.1, 0, 46]],
  [0.41, [-4, 1.5, 0.5, 0, 1.3, -1, 46]],
  // COMPETE
  [0.425, AT_STOP],
  [0.48, AT_STOP],
  [0.495, INTO_DOOR],
  [0.512, THROUGH_DOOR],
  [0.525, [4.8, 0.9, 0.6, 0, 1.25, -1, 40]],
  // CREATE
  [0.545, AT_STOP],
  [0.6, AT_STOP],
  [0.615, INTO_DOOR],
  [0.632, THROUGH_DOOR],
  [0.65, [-5, 1.4, -0.5, 0, 1.4, -1, 46]],
  // LIVE
  [0.675, AT_STOP],
  [0.73, AT_STOP],
  [0.745, INTO_DOOR],
  [0.762, THROUGH_DOOR],
  [0.79, [3.2, 2.7, 5.2, 0, 1.3, -4, 46]],
  // The last roof
  [0.86, [0.6, 2.4, 6.2, 0, 4.4, -14, 42]],
  [1, [0, 3, 8.4, 0, 5.7, -18, 42]],
];

// Each stretch of the route has its own player; they meet at the gates, where one is cut off and the
// next begins, so the skin changes exactly as it crosses the gate. Scrub back and it changes back.
const RUNNERS = [
  { skin: 'c-gore.png', weapon: 'SCAR.glb' },
  { skin: 'c-skeletain.png', weapon: 'LAR.glb' },
  { skin: 'c-doombringer.png', weapon: 'M60.glb' },
  { skin: 'c-onryo.png', weapon: 'AR-9.glb' },
  { skin: 'c-pumpreaper.png', weapon: 'SCAR.glb' },
  { skin: 'c-kingdracula.png', weapon: 'LAR.glb' },
  { skin: 'c-thriller.png', weapon: 'SCAR.glb' },
];

const SKINS = ['c-gore.png', 'c-slasher.png', 'c-skeletain.png', 'c-doombringer.png', 'c-onryo.png', 'c-thriller.png', 'c-pumpreaper.png', 'c-kingdracula.png'];

const WEAPON_SCALE: Record<string, number> = {
  'SCAR.glb': 2.8, 'AR-9.glb': 2.7, 'LAR.glb': 3, 'M60.glb': 2.7, 'Shark.glb': 1.6, 'Tomahawk.glb': 5,
};
const WEAPON_TEXTURE: Record<string, string> = {
  'SCAR.glb': 'w-scar.webp', 'AR-9.glb': 'w-ar-9.webp', 'LAR.glb': 'w-lar.webp', 'M60.glb': 'w-m60.webp', 'Shark.glb': 'w-shark.webp', 'Tomahawk.glb': 'w-tomahawk.webp',
};

type PoseName = 'pose1' | 'pose2' | 'pose3';

// Everyone standing around. `face` is a y rotation: 0 looks down the route, PI looks back up it.
const CROWD: { s: number; x: number; skin: string; weapon: string; pose: PoseName; face: number }[] = [
  { s: 11, x: 5.4, skin: 'c-thriller.png', weapon: 'M60.glb', pose: 'pose1', face: Math.PI + 0.9 },
  { s: 16, x: -5.6, skin: 'c-pumpreaper.png', weapon: 'Tomahawk.glb', pose: 'pose3', face: Math.PI - 0.8 },
  { s: 56, x: 5.2, skin: 'c-kingdracula.png', weapon: 'Shark.glb', pose: 'pose2', face: Math.PI + 1 },
  { s: 66, x: -5.4, skin: 'c-slasher.png', weapon: 'LAR.glb', pose: 'pose1', face: Math.PI - 1 },
  { s: 100, x: -5.5, skin: 'c-onryo.png', weapon: 'AR-9.glb', pose: 'pose1', face: Math.PI - 0.9 },
  { s: 104, x: 5.5, skin: 'c-gore.png', weapon: 'Tomahawk.glb', pose: 'pose3', face: Math.PI + 0.9 },
  { s: 160, x: 5, skin: 'c-doombringer.png', weapon: 'Shark.glb', pose: 'pose2', face: Math.PI + 0.8 },
  // A lobby's worth of players outside COMPETE
  { s: 230, x: -5, skin: 'c-slasher.png', weapon: 'SCAR.glb', pose: 'pose1', face: Math.PI - 0.5 },
  { s: 232, x: 5, skin: 'c-skeletain.png', weapon: 'M60.glb', pose: 'pose2', face: Math.PI + 0.5 },
  { s: 238, x: -3.5, skin: 'c-thriller.png', weapon: 'Tomahawk.glb', pose: 'pose3', face: Math.PI - 0.3 },
  { s: 238, x: 3.5, skin: 'c-gore.png', weapon: 'AR-9.glb', pose: 'pose1', face: Math.PI + 0.3 },
  { s: 290, x: -5, skin: 'c-onryo.png', weapon: 'LAR.glb', pose: 'pose2', face: Math.PI - 0.7 },
  { s: 346, x: 5, skin: 'c-gore.png', weapon: 'Shark.glb', pose: 'pose2', face: Math.PI + 0.7 },
  // The final roof: a crowd looking back at whoever just arrived.
  { s: 425, x: -3, skin: 'c-gore.png', weapon: 'SCAR.glb', pose: 'pose1', face: Math.PI + 0.1 },
  { s: 425, x: 3, skin: 'c-skeletain.png', weapon: 'LAR.glb', pose: 'pose2', face: Math.PI - 0.1 },
  { s: 428, x: -7, skin: 'c-doombringer.png', weapon: 'M60.glb', pose: 'pose1', face: Math.PI + 0.25 },
  { s: 428, x: 0, skin: 'c-slasher.png', weapon: 'Tomahawk.glb', pose: 'pose3', face: Math.PI },
  { s: 428, x: 7, skin: 'c-onryo.png', weapon: 'AR-9.glb', pose: 'pose1', face: Math.PI - 0.25 },
  { s: 431.5, x: -9.5, skin: 'c-kingdracula.png', weapon: 'Shark.glb', pose: 'pose2', face: Math.PI + 0.3 },
  { s: 431.5, x: -4, skin: 'c-pumpreaper.png', weapon: 'SCAR.glb', pose: 'pose3', face: Math.PI + 0.1 },
  { s: 431.5, x: 3.5, skin: 'c-slasher.png', weapon: 'LAR.glb', pose: 'pose1', face: Math.PI - 0.1 },
  { s: 431.5, x: 9.5, skin: 'c-gore.png', weapon: 'M60.glb', pose: 'pose2', face: Math.PI - 0.3 },
];

// Real guns on plinths behind the MARKET building, big enough to run under.
const STATUES = [
  { s: 182, x: -7, weapon: 'SCAR.glb' },
  { s: 188, x: 7, weapon: 'LAR.glb' },
  { s: 194, x: -7, weapon: 'M60.glb' },
  { s: 200, x: 7, weapon: 'AR-9.glb' },
];

// ------------------------------------------------------------------------------------------------
// Small maths
// ------------------------------------------------------------------------------------------------
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Hermite spline through (t, values). With `monotone` it can't overshoot, so the runner never reverses. */
function makeCurve(keys: [number, number[]][], monotone = false) {
  const n = keys.length;
  const dims = keys[0][1].length;
  const tangents = keys.map(() => new Array<number>(dims).fill(0));
  for (let i = 1; i < n - 1; i++) {
    for (let d = 0; d < dims; d++) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const [t2, v2] = keys[i + 1];
      let m = (v2[d] - v0[d]) / (t2 - t0);
      if (monotone) {
        const a = (v1[d] - v0[d]) / (t1 - t0);
        const b = (v2[d] - v1[d]) / (t2 - t1);
        m = a * b <= 0 ? 0 : Math.sign(m) * Math.min(Math.abs(m), 3 * Math.abs(a), 3 * Math.abs(b));
      }
      tangents[i][d] = m;
    }
  }
  const out = new Array<number>(dims);
  return (t: number) => {
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    const h = t1 - t0;
    const u = clamp01((t - t0) / h);
    const u2 = u * u;
    const u3 = u2 * u;
    for (let d = 0; d < dims; d++) {
      out[d] = (2 * u3 - 3 * u2 + 1) * v0[d] + (u3 - 2 * u2 + u) * h * tangents[i][d] + (-2 * u3 + 3 * u2) * v1[d] + (u3 - u2) * h * tangents[i + 1][d];
    }
    return out;
  };
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const runCurve = makeCurve(RUN_KEYS.map(([p, s]) => [p, [s]]), true);
const baseYCurve = makeCurve(ROOFS.flatMap((r) => [[r.from, [r.y]], [r.to, [r.y]]] as [number, number[]][]), true);
const cameraCurve = makeCurve(CAMERA_KEYS);

/** Where the player is at distance s: their height, how airborne they are, and ground actually run. */
function routeAt(s: number) {
  let groundBefore = 0;
  for (let i = 0; i < ROOFS.length; i++) {
    const roof = ROOFS[i];
    if (s <= roof.to) return { y: roof.y, air: 0, ground: groundBefore + s - roof.from };
    groundBefore += roof.to - roof.from;
    const next = ROOFS[i + 1];
    if (next && s < next.from) {
      const t = (s - roof.to) / (next.from - roof.to);
      return {
        y: THREE.MathUtils.lerp(roof.y, next.y, t) + 4 * JUMP_HEIGHT[i] * t * (1 - t),
        air: Math.sin(Math.PI * t),
        ground: groundBefore,
      };
    }
  }
  return { y: ROOFS[ROOFS.length - 1].y, air: 0, ground: groundBefore };
}

// ------------------------------------------------------------------------------------------------
// Building with blocks. Everything static ends up in two meshes: lit blocks, and things that glow.
// ------------------------------------------------------------------------------------------------
const FACES: { n: number[]; corners: number[][]; uv: [number, number] }[] = [
  { n: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [2, 1] },
  { n: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [2, 1] },
  { n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [0, 2] },
  { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [0, 2] },
  { n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [0, 1] },
  { n: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [0, 1] },
];

class Blocks {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colours: number[] = [];
  indices: number[] = [];

  /** Sides darken towards their foot, a cheap stand-in for the shading a real map bakes in. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: number, top = colour, footShade = 0.62) {
    const size = [x1 - x0, y1 - y0, z1 - z0];
    const low = [x0, y0, z0];
    const c = new THREE.Color();
    for (const face of FACES) {
      const base = this.positions.length / 3;
      c.setHex(face.n[1] > 0 ? top : colour);
      for (const corner of face.corners) {
        for (let a = 0; a < 3; a++) this.positions.push(low[a] + corner[a] * size[a]);
        this.normals.push(face.n[0], face.n[1], face.n[2]);
        const [ua, va] = face.uv;
        // Align to the world grid so neighbouring boxes share one block pattern.
        this.uvs.push(low[ua] + corner[ua] * size[ua], low[va] + corner[va] * size[va]);
        const shade = face.n[1] === 0 && corner[1] === 0 ? footShade : 1;
        this.colours.push(c.r * shade, c.g * shade, c.b * shade);
      }
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** One flat rectangle facing a direction, for lit windows. */
  quad(axis: 'x+' | 'x-' | 'z+', a: number, b0: number, b1: number, y0: number, y1: number, colour: number) {
    const base = this.positions.length / 3;
    const c = new THREE.Color(colour);
    const corners = axis === 'z+'
      ? [[b0, y0, a], [b1, y0, a], [b1, y1, a], [b0, y1, a]]
      : axis === 'x+'
        ? [[a, y0, b1], [a, y0, b0], [a, y1, b0], [a, y1, b1]]
        : [[a, y0, b0], [a, y0, b1], [a, y1, b1], [a, y1, b0]];
    const n = axis === 'z+' ? [0, 0, 1] : axis === 'x+' ? [1, 0, 0] : [-1, 0, 0];
    for (const p of corners) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
      this.uvs.push(0, 0);
      this.colours.push(c.r, c.g, c.b);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colours, 3));
    g.setIndex(this.indices);
    return g;
  }
}

/** A 5x7 block alphabet, only the letters the signs use. */
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
};

/** Stacked block lettering facing back up the route. `at` is the middle of the bottom line. */
function letter(blocks: Blocks, glow: Blocks, lines: string[], at: THREE.Vector3, pixel: number, colour: number, side: number) {
  const width = (line: string) => line.length * 6 - 1;
  lines.forEach((line, row) => {
    const rowY = at.y + (lines.length - 1 - row) * 9 * pixel;
    const startOffset = (-width(line) * pixel) / 2;
    [...line].forEach((ch, chIndex) => {
      const glyph = FONT[ch];
      if (!glyph) return;
      glyph.forEach((rowBits, gy) => {
        [...rowBits].forEach((bit, gx) => {
          if (bit !== '#') return;
          const u = startOffset + (chIndex * 6 + gx) * pixel;
          const y0 = rowY + (6 - gy) * pixel;
          const y1 = y0 + pixel;
          const inset = pixel * 0.06;
          blocks.box(at.x + u, y0, at.z - pixel * 0.8, at.x + u + pixel, y1, at.z, side);
          glow.quad('z+', at.z + 0.02, at.x + u + inset, at.x + u + pixel - inset, y0 + inset, y1 - inset, colour);
        });
      });
    });
  });
}

function buildWorld() {
  const blocks = new Blocks();
  const glow = new Blocks();
  const rand = seeded(20261109);
  const WINDOW = [0xffb454, 0xffd27a, 0xff9a3c, 0xe8e2c8, 0x8fb7ff];

  const CONCRETE = [0x2a2e37, 0x33302f, 0x262c36, 0x35333a, 0x2c2a2e];
  const LIT_ROOF = 0x4d525c;

  const windows = (x0: number, z0: number, x1: number, z1: number, top: number, odds: number, front = true) => {
    for (let y = top - 2; y > top - 34; y -= 2.5) {
      for (const face of ['z+', 'x+', 'x-'] as const) {
        if (face === 'z+' && !front) continue;
        const span = face === 'z+' ? [x0, x1] : [z0, z1];
        for (let u = span[0] + 1; u < span[1] - 1.4; u += 2.4) {
          if (rand() > odds) continue;
          const colour = WINDOW[Math.floor(rand() * WINDOW.length)];
          const a = face === 'z+' ? z1 + 0.03 : face === 'x+' ? x1 + 0.03 : x0 - 0.03;
          glow.quad(face, a, u, u + 1.3, y, y + 1.5, colour);
        }
      }
    }
  };

  // The roofs along the route
  ROOFS.forEach((roof, i) => {
    const z0 = -roof.to;
    const z1 = -roof.from;
    const w = roof.halfWidth;
    blocks.box(-w, roof.y - 70, z0, w, roof.y, z1, CONCRETE[i % CONCRETE.length], LIT_ROOF);
    // Parapets along the sides and the far end, leaving a run-through in the middle of the ends
    blocks.box(-w, roof.y, z0, -w + 0.6, roof.y + 0.7, z1, 0x3a3e47);
    blocks.box(w - 0.6, roof.y, z0, w, roof.y + 0.7, z1, 0x3a3e47);
    for (const z of [z0, z1 - 0.6]) {
      blocks.box(-w, roof.y, z, -3, roof.y + 0.7, z + 0.6, 0x3a3e47);
      blocks.box(3, roof.y, z, w, roof.y + 0.7, z + 0.6, 0x3a3e47);
    }
    // Vents and tanks, kept out of the lane
    for (let s = roof.from + 3; s < roof.to - 3; s += 5 + rand() * 4) {
      if (rand() < 0.45) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const x = side * (w - 1.6 - rand() * 1.6);
      const h = 0.7 + rand() * 1.4;
      const a = 0.6 + rand() * 0.8;
      blocks.box(x - a, roof.y, -s - a, x + a, roof.y + h, -s + a, 0x3f434c, 0x565b65);
    }
    windows(-w, z0, w, z1, roof.y, 0.2, false);
  });

  // The city around it
  const OFFSET = 18;
  for (let col = -9; col <= 9; col++) {
    for (let row = -5; row < 30; row++) {
      const cx = col * OFFSET + (rand() - 0.5) * 3;
      const cz = -row * OFFSET + (rand() - 0.5) * 3;
      const w = 6 + rand() * 2;
      const d = 6 + rand() * 2;
      if (Math.abs(cx) - w < 18 && -cz > -30 && -cz < 470) continue;
      const near = Math.abs(cx) < 40;
      const top = (near ? -14 : -6) + rand() * rand() * (near ? 18 : 42);
      const colour = CONCRETE[Math.floor(rand() * CONCRETE.length)];
      blocks.box(cx - w, top - 80, cz - d, cx + w, top, cz + d, colour, 0x24272e);
      windows(cx - w, cz - d, cx + w, cz + d, top, 0.13);
      if (rand() < 0.35) {
        const a = 1 + rand() * 1.5;
        blocks.box(cx - a, top, cz - a, cx + a, top + 1.2 + rand() * 2, cz + a, 0x2d3038, 0x383c45);
      }
    }
  }

  // The buildings, each with a doorway and a glowing frame around it. Their signs are kept apart from
  // the rest so only the next one is drawn, or a far one would show cut off through the doorway.
  const signs: { blocks: THREE.BufferGeometry; glow: THREE.BufferGeometry }[] = [];
  const DOOR_X = 5.6;
  const DOOR_Y = 5.4;
  for (const building of BUILDINGS) {
    const y = routeAt(building.gate).y;
    const z1 = -building.gate;
    const z0 = z1 - BUILDING_DEPTH;
    const signHeight = (building.lines.length === 2 ? 16 : 7) * building.pixel;
    const top = y + 6.8 + signHeight + 1.4;
    const w = BUILDING_HALF_WIDTH;
    blocks.box(-w, y - 70, z0, -DOOR_X, top, z1, building.colour, 0x24272e);
    blocks.box(DOOR_X, y - 70, z0, w, top, z1, building.colour, 0x24272e);
    blocks.box(-DOOR_X, y + DOOR_Y, z0, DOOR_X, top, z1, building.colour, 0x24272e);
    windows(-w, z0, w, z1, top, 0.2, false);
    glow.box(-DOOR_X, y, z1, -DOOR_X + 0.26, y + DOOR_Y, z1 + 0.1, building.glow);
    glow.box(DOOR_X - 0.26, y, z1, DOOR_X, y + DOOR_Y, z1 + 0.1, building.glow);
    glow.box(-DOOR_X, y + DOOR_Y - 0.26, z1, DOOR_X, y + DOOR_Y, z1 + 0.1, building.glow);

    const signBlocks = new Blocks();
    const signGlow = new Blocks();
    letter(signBlocks, signGlow, building.lines, new THREE.Vector3(0, y + 6.8, z1 + building.pixel * 0.8), building.pixel, building.glow, 0x4a4238);
    signs.push({ blocks: signBlocks.build(), glow: signGlow.build() });
  }

  // The last sign, behind the crowd
  blocks.box(-26, -30, END_SIGN_Z - 8, 26, 0, END_SIGN_Z, 0x25282f, 0x2a2e36);
  const endBlocks = new Blocks();
  const endGlow = new Blocks();
  letter(endBlocks, endGlow, ['FIND', 'ANYONE'], new THREE.Vector3(0, 0.6, END_SIGN_Z + 0.68), 0.85, 0xf5c518, 0x6b5410);
  signs.push({ blocks: endBlocks.build(), glow: endGlow.build() });

  // Plinths for the guns
  for (const statue of STATUES) {
    const y = routeAt(statue.s).y;
    blocks.box(statue.x - 2, y, -statue.s - 2, statue.x + 2, y + 1.6, -statue.s + 2, 0x3a3e47, 0x565b65);
  }

  return { blocks: blocks.build(), glow: glow.build(), signs };
}

/** The block pattern: a pale tile with pixel noise and a dark seam, tinted by the vertex colours. */
function blockTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(7);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const seam = x === 0 || y === 0;
      const v = seam ? 150 : 205 + Math.floor(rand() * 50);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A low-resolution moon, drawn pixel by pixel so it matches the blocks. */
function moonTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(1969);
  const craters = Array.from({ length: 16 }, () => ({ x: rand() * size, y: rand() * size, r: 2 + rand() * 6 }));
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > c - 1) continue;
      let v = 226 + Math.floor(rand() * 14);
      if (craters.some((k) => Math.hypot(x - k.x, y - k.y) < k.r)) v -= 38;
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 14})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------------------------------------
// Players
// ------------------------------------------------------------------------------------------------
interface Player {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}

/**
 * The rig's run clip swings the arms, so a gun on it floats around the body. Kirka's lobby pose is the
 * one the gun actually fits: so a runner takes the pose for everything above the waist, and only the
 * legs from whatever they're doing. The hands stay on the grip.
 */
function splitBody(gltf: GLTF) {
  const isLeg = (track: THREE.KeyframeTrack) => /^(left|right)Leg/.test(track.name);
  const clip = (name: string) => gltf.animations.find((c) => c.name === name)!;
  const part = (name: string, keep: (t: THREE.KeyframeTrack) => boolean) => {
    const source = clip(name);
    return new THREE.AnimationClip(`${name}-part`, source.duration, source.tracks.filter(keep));
  };
  return {
    upper: part('pose1', (t) => !isLeg(t)),
    legsPose: part('pose1', isLeg),
    legsRun: part('run', isLeg),
    legsTuck: part('squat', isLeg),
  };
}

function makePlayer(gltf: GLTF, material: THREE.Material, weapon: THREE.Object3D | null, weaponNode: PoseName): Player {
  const root = cloneSkinned(gltf.scene);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.material = material;
  });
  if (weapon) root.getObjectByName(weaponNode)?.add(weapon);
  const mixer = new THREE.AnimationMixer(root);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
  return { root, mixer, actions };
}

/** A skin that fails to load just goes untextured; one bad file shouldn't take out the whole film. */
function loadTexture(file: string): Promise<THREE.Texture | null> {
  return new THREE.TextureLoader().loadAsync(asset(file)).then((tex) => {
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }, () => null);
}

// The model's origin sits a little under its feet.
const FOOT_LIFT = -0.17;

// ------------------------------------------------------------------------------------------------
// The film
// ------------------------------------------------------------------------------------------------
export function createHomeFilm(container: HTMLElement, getProgress: () => number, onReady: () => void, still = false): HomeFilm | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.appendChild(renderer.domElement);

  const SKY = 0x06080d;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 34, 300);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);

  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x0d0f15, 0.85));
  const moonLight = new THREE.DirectionalLight(0xe6eeff, 2.5);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  Object.assign(moonLight.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
  moonLight.shadow.bias = -0.0006;
  moonLight.shadow.normalBias = 0.04;
  scene.add(moonLight, moonLight.target);
  const fill = new THREE.DirectionalLight(0x8ea5cc, 0.8);
  fill.position.set(-3, 2, 6);
  scene.add(fill);
  const gateLight = new THREE.PointLight(0xffffff, 0, 26, 1.6);
  scene.add(gateLight);

  // City
  const world = buildWorld();
  const tileMap = blockTexture();
  const cityMaterial = new THREE.MeshLambertMaterial({ map: tileMap, vertexColors: true });
  const city = new THREE.Mesh(world.blocks, cityMaterial);
  city.castShadow = true;
  city.receiveShadow = true;
  scene.add(city);
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(world.glow, glowMaterial));
  const signGroups = world.signs.map((sign) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(sign.blocks, cityMaterial), new THREE.Mesh(sign.glow, glowMaterial));
    group.visible = false;
    scene.add(group);
    return group;
  });

  // Sky: these ride along with the camera, so they look infinitely far away
  const sky = new THREE.Group();
  scene.add(sky);
  const moonMap = moonTexture();
  const moon = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 190),
    new THREE.MeshBasicMaterial({ map: moonMap, transparent: true, alphaTest: 0.5, fog: false, depthWrite: false })
  );
  moon.position.set(300, 230, -760);
  moon.lookAt(0, 0, 0);
  sky.add(moon);
  const starRand = seeded(42);
  const starPositions: number[] = [];
  for (let i = 0; i < 900; i++) {
    const a = starRand() * Math.PI * 2;
    const e = 0.05 + starRand() * 1.3;
    starPositions.push(Math.cos(a) * Math.cos(e) * 800, Math.sin(e) * 800, Math.sin(a) * Math.cos(e) * 800);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xcfd8e8, size: phone ? 1.5 : 2, sizeAttenuation: false, fog: false, depthWrite: false });
  sky.add(new THREE.Points(starGeometry, starMaterial));

  // Grit hanging in the air along the route. It's what sells the speed.
  const dustRand = seeded(11);
  const dustPositions: number[] = [];
  for (let i = 0; i < 3600; i++) dustPositions.push((dustRand() - 0.5) * 34, -6 + dustRand() * 18, 10 - dustRand() * 470);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({ color: 0xaab4c6, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // Assets
  const owned: { dispose: () => void }[] = [...world.signs.flatMap((sign) => [sign.blocks, sign.glow]), world.blocks, world.glow, tileMap, cityMaterial, glowMaterial, moonMap, moon.geometry, moon.material as THREE.Material, starGeometry, starMaterial, dustGeometry, dustMaterial];
  let runners: Player[] = [];
  let crowd: Player[] = [];
  let statues: THREE.Object3D[] = [];
  let ready = false;
  let disposed = false;

  const loader = new GLTFLoader();
  const weaponFiles = [...new Set([...RUNNERS.map((r) => r.weapon), ...CROWD.map((c) => c.weapon), ...STATUES.map((s) => s.weapon)])];

  Promise.all([
    loader.loadAsync(getModelUrl('KirkaCharacter.glb')),
    Promise.all(SKINS.map(loadTexture)),
    Promise.all(weaponFiles.map((file) => loader.loadAsync(getModelUrl(file)))),
    Promise.all(weaponFiles.map((file) => loadTexture(WEAPON_TEXTURE[file]))),
  ]).then(([character, skinTextures, weaponGltfs, weaponTextures]) => {
    const textures = [...skinTextures, ...weaponTextures].filter((t): t is THREE.Texture => t !== null);
    if (disposed) {
      textures.forEach((t) => t.dispose());
      return;
    }
    owned.push(...textures);

    const skinByFile = new Map(SKINS.map((file, i) => [file, skinTextures[i]]));
    const skinMaterial = (file: string, planes?: THREE.Plane[]) => {
      const mat = new THREE.MeshLambertMaterial({ map: skinByFile.get(file) ?? null, alphaTest: 0.05, side: THREE.DoubleSide });
      if (planes) {
        mat.clippingPlanes = planes;
        mat.clipShadows = true;
      }
      owned.push(mat);
      return mat;
    };

    const weaponMaterials = new Map(weaponFiles.map((file, i) => {
      const mat = new THREE.MeshLambertMaterial({ map: weaponTextures[i], side: THREE.DoubleSide });
      owned.push(mat);
      return [file, mat] as const;
    }));
    weaponGltfs.forEach((g) => g.scene.traverse((o) => {
      const geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (geo) owned.push(geo);
    }));

    const weaponFor = (file: string, scale: number, material?: THREE.Material) => {
      const proto = weaponGltfs[weaponFiles.indexOf(file)].scene;
      const weapon = proto.clone(true);
      weapon.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = material ?? weaponMaterials.get(file)!;
        mesh.castShadow = true;
      });
      const baseScale = (WEAPON_SCALE[file] ?? 3) * scale;
      weapon.scale.setScalar(baseScale);
      const lever = weapon.getObjectByName('Lever');
      if (lever) weapon.position.copy(lever.position).multiplyScalar(-baseScale);
      return weapon;
    };

    const bodyClips = splitBody(character);

    // Runners: one per stretch of route, each clipped to that stretch
    runners = RUNNERS.map((spec, i) => {
      const planes: THREE.Plane[] = [];
      if (i > 0) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), -GATES[i - 1]));
      if (i < GATES.length) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), GATES[i]));
      const weaponMat = new THREE.MeshLambertMaterial({ map: weaponMaterials.get(spec.weapon)!.map, side: THREE.DoubleSide, clippingPlanes: planes, clipShadows: true });
      owned.push(weaponMat);
      const player = makePlayer(character, skinMaterial(spec.skin, planes), weaponFor(spec.weapon, 1, weaponMat), 'pose1');
      for (const [name, clip] of Object.entries(bodyClips)) {
        const action = player.mixer.clipAction(clip);
        action.play();
        action.paused = true;
        action.setEffectiveWeight(0);
        player.actions[name] = action;
      }
      scene.add(player.root);
      return player;
    });

    crowd = CROWD.map((spec, i) => {
      const player = makePlayer(character, skinMaterial(spec.skin), weaponFor(spec.weapon, 1), spec.pose);
      player.root.position.set(spec.x, routeAt(spec.s).y + FOOT_LIFT, -spec.s);
      player.root.rotation.y = spec.face;
      const action = player.actions[spec.pose];
      action.time = (i * 0.37) % action.getClip().duration;
      action.play();
      player.mixer.update(0);
      scene.add(player.root);
      return player;
    });

    statues = STATUES.map((spec) => {
      const holder = new THREE.Group();
      holder.add(weaponFor(spec.weapon, 5));
      holder.position.set(spec.x, routeAt(spec.s).y + 5, -spec.s);
      scene.add(holder);
      return holder;
    });

    ready = true;
    renderer.shadowMap.needsUpdate = true;
    onReady();
  }).catch((err) => {
    console.warn('[home film] assets failed to load:', err);
  });

  // Sizing
  let fovScale = 1;
  /** 0 on anything landscape, 1 on a tall phone. */
  let narrow = 0;
  const resize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    // Hold the framing's width on narrow screens instead of cropping the sign away.
    fovScale = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.75 : 1;
    narrow = clamp01((1 - camera.aspect) / 0.54);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // Don't spend anything while the film is scrolled away or the tab is hidden.
  let inView = true;
  const viewObserver = new IntersectionObserver((entries) => {
    inView = entries[0]?.isIntersecting ?? true;
  });
  viewObserver.observe(container);

  // Tiers. Only ever steps down: flipping back and forth would look worse than either.
  //   0  everything
  //   1  normal resolution, no dust, only the nearest players
  //   2  no shadows, below normal resolution, only the players right beside you
  //   3  no animation: one still frame each time the scroll comes to rest
  let tier = 0;
  let crowdRange = 60;
  const applyTier = (next: number) => {
    tier = next;
    container.dataset.filmTier = String(tier);
    if (tier >= 1) {
      pixelRatio = Math.min(pixelRatio, 1);
      dust.visible = false;
      crowdRange = 25;
    }
    if (tier >= 2) {
      pixelRatio = 0.75;
      moonLight.castShadow = false;
      crowdRange = 12;
    }
    renderer.setPixelRatio(pixelRatio);
    resize();
    if (tier >= 3) {
      renderer.setAnimationLoop(null);
      showRestingFrame();
    }
  };

  // Below this many frames a second, drop to the next tier.
  const TIER_FLOOR = [27, 20, 11];
  let sampleTime = 0;
  let sampleFrames = 0;
  const judgeFrameRate = (rawDt: number) => {
    // A long gap means the tab or window was hidden, not that the machine is slow. And don't judge
    // the first moments, when everything is being uploaded to the graphics card.
    if (rawDt > 0.5 || elapsed < 2) {
      sampleTime = 0;
      sampleFrames = 0;
      return;
    }
    sampleTime += rawDt;
    sampleFrames++;
    if (sampleTime < 2) return;
    const fps = sampleFrames / sampleTime;
    sampleTime = 0;
    sampleFrames = 0;
    if (tier < TIER_FLOOR.length && fps < TIER_FLOOR[tier]) applyTier(tier + 1);
  };

  // At tier 3, draw once when the scrolling stops, so the picture still matches where you are.
  let restTimer = 0;
  function showRestingFrame() {
    window.clearTimeout(restTimer);
    restTimer = window.setTimeout(() => {
      if (disposed || contextLost || !inView) return;
      progress = getProgress();
      drawFrame(0);
    }, 180);
  }
  const onScrollWhileResting = () => {
    if (tier >= 3) showRestingFrame();
  };
  window.addEventListener('scroll', onScrollWhileResting, { passive: true });

  // The browser can take the graphics context away from a struggling machine. three.js restores it
  // and restarts the loop by itself; a machine that lost it probably needs less work, and one that
  // loses it twice is better off without the film, so stop asking.
  let contextLost = false;
  let contextLosses = 0;
  const onContextLost = () => {
    if (disposed) return;
    contextLost = true;
    contextLosses++;
    if (contextLosses >= 2) {
      renderer.setAnimationLoop(null);
      renderer.domElement.style.visibility = 'hidden';
    }
  };
  const onContextRestored = () => {
    if (disposed) return;
    contextLost = false;
    if (contextLosses >= 2) {
      renderer.setAnimationLoop(null);
      return;
    }
    if (tier < 2) applyTier(2);
    renderer.shadowMap.needsUpdate = true;
    if (tier >= 3) showRestingFrame();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

  // Frame loop
  const clock = new THREE.Clock();
  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();
  let progress = getProgress();
  let elapsed = 0;
  let lastShadowS = -999;
  let frames = 0;

  const placeRunner = (s: number, poseTime: number) => {
    const { y, air, ground } = routeAt(s);
    const start = smooth(0.15, 1.6, s);
    const stop = smooth(STOP_AT - 3, STOP_AT - 0.2, s);
    const running = start * (1 - stop);
    const tuck = air * 0.75;
    const segment = GATES.filter((gate) => s >= gate).length;

    runners.forEach((runner, i) => {
      // Only the player either side of the nearest gate can be on screen.
      const visible = i === segment || (i === segment + 1 && GATES[segment] - s < 6) || (i === segment - 1 && s - GATES[i] < 6);
      runner.root.visible = visible;
      if (!visible) return;
      const { upper, legsPose, legsRun, legsTuck } = runner.actions;
      const runDuration = legsRun.getClip().duration;
      const phase = ((ground / STRIDE) % 1 + 1) % 1;
      legsRun.time = phase * runDuration;
      const poseDuration = upper.getClip().duration;
      upper.time = poseTime % poseDuration;
      legsPose.time = poseTime % poseDuration;
      upper.setEffectiveWeight(1);
      legsPose.setEffectiveWeight(1 - running);
      legsRun.setEffectiveWeight(running * (1 - tuck));
      legsTuck.setEffectiveWeight(running * tuck);
      runner.mixer.update(0);
      // The pose has no bounce of its own, so give the stride one.
      const bounce = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.07 * running * (1 - air);
      runner.root.position.set(0, y + FOOT_LIFT + bounce, -s);
    });
    return { y, segment };
  };

  const frameLoop = () => {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (!inView || document.hidden) return;
    elapsed += dt;

    // Native scrolling, with a little weight on it.
    const target = getProgress();
    progress += (target - progress) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - progress) < 0.00002) progress = target;

    drawFrame(dt);
    if (ready) judgeFrameRate(rawDt);
  };

  function drawFrame(dt: number) {
    const s = runCurve(progress)[0];
    // Each sign appears once the camera is through the doorway before it and turned away from it, so
    // nobody sees it half cut off by a doorway or a frame edge, and goes once it's well past.
    signGroups.forEach((group, i) => {
      const after = i === 0 ? -Infinity : Math.max(GATES[i - 1] + 9, (GATES[i] ?? 0) - 50);
      const until = i < GATES.length ? GATES[i] + 30 : Infinity;
      group.visible = s >= after && s <= until;
    });
    if (ready) {
      placeRunner(s, still ? 0 : elapsed);
      for (let i = 0; i < crowd.length; i++) {
        const near = Math.abs(CROWD[i].s - s) < crowdRange;
        crowd[i].root.visible = near;
        if (near && !still) crowd[i].mixer.update(dt * 0.75);
      }
      statues.forEach((statue, i) => {
        statue.rotation.y = s * 0.09 + i * 1.3;
      });
    }

    // Camera
    const baseY = baseYCurve(s)[0];
    const [ex, ey, ez, lx, ly, lz, fov] = cameraCurve(progress);
    // A touch of parallax from time, so the opening shot isn't a still image.
    const sway = still ? 0 : Math.sin(elapsed * 0.35) * 0.05;
    // A tall screen can't hold what a wide one does. It keeps the player nearer the middle, aims at
    // them rather than past them, and backs right off for the last shot so the whole sign fits.
    const opening = 1 - smooth(0.03, 0.1, progress);
    const closing = smooth(0.86, 1, progress);
    let atStop = 0;
    for (const stop of FILM_STOPS) atStop = Math.max(atStop, smooth(stop.from - 0.02, stop.from, progress) * (1 - smooth(stop.to, stop.to + 0.012, progress)));
    const midFilm = (1 - Math.max(opening, closing)) * (1 - atStop);
    eye.set(
      (ex + sway) * (1 - narrow * 0.6 * opening),
      baseY + ey + narrow * closing * 9,
      -s + ez + narrow * (closing * 40 + atStop * 13)
    );
    // At a stop a tall screen keeps the sign in its top half, because the popup takes the bottom half.
    look.set(lx * (1 - narrow * atStop), baseY + ly - narrow * atStop * 6, -s + lz * (1 - narrow * 0.7 * midFilm));
    camera.position.copy(eye);
    camera.lookAt(look);
    const nextFov = fov * fovScale;
    if (Math.abs(camera.fov - nextFov) > 0.01) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);

    // The moon's shadows follow the player
    moonLight.target.position.set(0, baseY, -s - 6);
    moonLight.position.set(16, baseY + 34, -s + 8);
    if (Math.abs(s - lastShadowS) > 0.002 || frames < 3) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowS = s;
    }

    // The nearest gate throws its colour onto whoever is running through
    let gateIndex = 0;
    for (let i = 1; i < GATES.length; i++) if (Math.abs(GATES[i] - s) < Math.abs(GATES[gateIndex] - s)) gateIndex = i;
    const gateDistance = Math.abs(GATES[gateIndex] - s);
    gateLight.color.setHex(BUILDINGS[gateIndex].glow);
    gateLight.position.set(0, routeAt(GATES[gateIndex]).y + 4.6, -GATES[gateIndex] + 1);
    gateLight.intensity = (1 - smooth(3, 16, gateDistance)) * 24;

    renderer.render(scene, camera);

    frames++;
  }

  renderer.setAnimationLoop(frameLoop);

  // Start lower on hardware that's already known to be weak, rather than making it prove it.
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
  const softwareOnly = /swiftshader|llvmpipe|software|basic render/i.test(gpuName);
  const fewResources = (navigator.hardwareConcurrency || 8) <= 2 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
  applyTier(softwareOnly ? 2 : fewResources ? 1 : 0);

  return {
    dispose: () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.clearTimeout(restTimer);
      window.removeEventListener('scroll', onScrollWhileResting);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      observer.disconnect();
      viewObserver.disconnect();
      owned.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
