/**
 * The pieces the home page film is built from: the block city, the pixel moon, and Kirka players
 * holding real guns. No three.js scene of its own; see fightFilm.ts for that.
 */
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const asset = (file: string) => `${import.meta.env.BASE_URL}home/${file}`;

export const WEAPON_SCALE: Record<string, number> = {
  'SCAR.glb': 2.8, 'VITA.glb': 2.4, 'AR-9.glb': 2.7, 'LAR.glb': 3, 'M60.glb': 2.7, 'Shark.glb': 1.6, 'Tomahawk.glb': 5,
};
export const WEAPON_TEXTURE: Record<string, string> = {
  'SCAR.glb': 'w-scar.webp', 'VITA.glb': 'w-vita.webp', 'AR-9.glb': 'w-ar-9.webp', 'LAR.glb': 'w-lar.webp', 'M60.glb': 'w-m60.webp', 'Shark.glb': 'w-shark.webp', 'Tomahawk.glb': 'w-tomahawk.webp',
};

export type PoseName = 'pose1' | 'pose2' | 'pose3';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Hermite spline through (t, values). With `monotone` it can't overshoot, so the runner never reverses. */
export function makeCurve(keys: [number, number[]][], monotone = false) {
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

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FACES: { n: number[]; corners: number[][]; uv: [number, number] }[] = [
  { n: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [2, 1] },
  { n: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [2, 1] },
  { n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [0, 2] },
  { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [0, 2] },
  { n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [0, 1] },
  { n: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [0, 1] },
];

export class Blocks {
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
export const FONT: Record<string, string[]> = {
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
export function letter(blocks: Blocks, glow: Blocks, lines: string[], at: THREE.Vector3, pixel: number, colour: number, side: number) {
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

/** The block pattern: a pale tile with pixel noise and a dark seam, tinted by the vertex colours. */
export function blockTexture() {
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
export function moonTexture() {
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

export interface Player {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}

/**
 * The rig's run clip swings the arms, so a gun on it floats around the body. Kirka's lobby pose is the
 * one the gun actually fits: so a runner takes the pose for everything above the waist, and only the
 * legs from whatever they're doing. The hands stay on the grip.
 */
export function splitBody(gltf: GLTF) {
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

export function makePlayer(gltf: GLTF, material: THREE.Material, weapon: THREE.Object3D | null, weaponNode: PoseName): Player {
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
export function loadTexture(file: string): Promise<THREE.Texture | null> {
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
export const FOOT_LIFT = -0.17;

const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const qC = new THREE.Quaternion();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const NO_TURN = new THREE.Quaternion();

/** Turns a bone, as little as it takes, so one of its own axes points along `dir` in the world. */
export function pointBone(bone: THREE.Object3D, axis: THREE.Vector3, dir: THREE.Vector3, amount = 1) {
  const q = bone.getWorldQuaternion(qA);
  vA.copy(axis).applyQuaternion(q).normalize();
  qB.setFromUnitVectors(vA, vB.copy(dir).normalize());
  if (amount < 1) qB.slerp(NO_TURN, 1 - amount);
  qB.multiply(q);
  bone.parent!.getWorldQuaternion(qC).invert();
  bone.quaternion.copy(qC.multiply(qB));
  bone.updateWorldMatrix(false, true);
}
