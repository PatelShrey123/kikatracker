/**
 * Giveaway Roulette: the entrants sit round a table as Kirka characters and a revolver goes round.
 * Each player puts it to their head and pulls: a click and it passes on, a bang and they're out. Last one
 * sitting wins. Cartoon, like the game: a flash, a "BANG", and they tip backwards off the chair.
 *
 * Fair: every round the bullet's chamber and the starting player are drawn with crypto.getRandomValues,
 * which makes the player knocked out a uniform pick from those left, so every entrant has the same chance.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getModelUrl } from '../../utils/skinAssets';
import { blockTexture, clamp01, FOOT_LIFT, makePlayer, pointBone, smooth, type Player } from '../home/filmKit';

export interface RouletteStatus {
  phase: 'loading' | 'ready' | 'playing' | 'done' | 'error';
  round: number;
  left: number;
  total: number;
  /** Whose turn it is. */
  turn?: string;
  /** What just happened, for the big caption. */
  shot?: { name: string; result: 'click' | 'bang' };
  winner?: string;
}

export interface Roulette {
  start(): void;
  setSpeed(multiplier: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const DOWN = v3(0, -1, 0);

/** A fair whole number below n. */
export function randomBelow(n: number) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % n;
}

const LOCAL_SKINS = ['c-gore.png', 'c-slasher.png', 'c-skeletain.png', 'c-doombringer.png', 'c-onryo.png', 'c-thriller.png', 'c-pumpreaper.png', 'c-kingdracula.png'];
const REVOLVER_TEXTURE = '/kirka-assets/assets/img/texture.0bed9187.webp';
// Kirka's Revolver: the barrel runs along -X from the grip ("Lever"), +Y is the top of the gun
const GUN_SCALE = 1.6 * 0.456;
const TABLE_TOP = 0.92;
/** Lying on its side, the grip point sits this far above the felt (half the gun's thickness, and a hair). */
const GUN_REST = 0.06;
/** From the head bone (at the neck) up to the middle of the head. */
const HEAD_MID = 0.27;

interface Seat extends Player {
  name: string;
  angle: number;
  home: THREE.Vector3;
  facing: THREE.Vector3;
  chair: THREE.Group;
  chairHome: THREE.Vector3;
  tag: HTMLDivElement;
  out: boolean;
  outAt: number;
  material: THREE.MeshLambertMaterial;
  head: THREE.Object3D;
  armR: THREE.Object3D;
  foreR: THREE.Object3D;
  armL: THREE.Object3D;
  foreL: THREE.Object3D;
  thighL: THREE.Object3D;
  shinL: THREE.Object3D;
  thighR: THREE.Object3D;
  shinR: THREE.Object3D;
  grip: THREE.Object3D;
  phase: number;
}

function loadSkin(url: string): Promise<THREE.Texture | null> {
  return new THREE.TextureLoader().loadAsync(url).then(
    (tex) => {
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      return tex;
    },
    () => null
  );
}

/** A plank texture for the table, drawn in the same blocky way as everything else. */
function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const plank = Math.floor(y / 8);
      const v = (y % 8 === 0 ? 70 : 120 + ((x * 7 + plank * 13 + ((x / 5) | 0) * 9) % 24)) | 0;
      g.fillStyle = `rgb(${v + 30},${v - 5},${v - 40})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------------- sound

function makeSound() {
  let ac: AudioContext | null = null;
  let muted = false;
  let noise: AudioBuffer | null = null;
  const ensure = () => {
    if (!ac) {
      try {
        ac = new AudioContext();
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        ac = null;
      }
    }
    void ac?.resume();
    return ac;
  };
  const burst = (t: number, freq: number, q: number, peak: number, decay: number, type: BiquadFilterType = 'bandpass') => {
    if (!ac || !noise) return;
    const s = ac.createBufferSource();
    s.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f).connect(g).connect(ac.destination);
    s.start(t, Math.random() * 0.4);
    s.stop(t + decay + 0.05);
  };
  const tone = (t: number, from: number, to: number, peak: number, decay: number, type: OscillatorType = 'sine') => {
    if (!ac) return;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = ac.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + decay + 0.05);
  };
  return {
    wake: ensure,
    setMuted: (m: boolean) => (muted = m),
    close: () => void ac?.close(),
    /** The cylinder spinning: a run of ratchet ticks, slowing down. */
    spin(seconds: number) {
      if (muted || !ensure() || !ac) return;
      let t = ac.currentTime;
      let gap = 0.035;
      while (t < ac.currentTime + seconds) {
        burst(t, 3500, 6, 0.25, 0.025);
        t += gap;
        gap *= 1.07;
      }
    },
    click() {
      if (muted || !ensure() || !ac) return;
      const t = ac.currentTime;
      burst(t, 2600, 8, 0.6, 0.04);
      burst(t + 0.012, 1200, 5, 0.3, 0.05);
    },
    bang() {
      if (muted || !ensure() || !ac) return;
      const t = ac.currentTime;
      burst(t, 900, 0.6, 1.2, 0.5, 'lowpass');
      burst(t, 3000, 0.8, 0.6, 0.25);
      tone(t, 140, 40, 0.9, 0.45);
    },
    heartbeat() {
      if (muted || !ensure() || !ac) return;
      const t = ac.currentTime;
      tone(t, 70, 45, 0.5, 0.14);
      tone(t + 0.2, 65, 42, 0.35, 0.14);
    },
    slide() {
      if (muted || !ensure() || !ac) return;
      burst(ac.currentTime, 600, 1, 0.12, 0.3, 'lowpass');
    },
    fanfare() {
      if (muted || !ensure() || !ac) return;
      const t = ac.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, f, f, 0.18, 0.5, 'square'));
      tone(t + 0.5, 1047, 1047, 0.18, 1.1, 'square');
      tone(t + 0.5, 784, 784, 0.12, 1.1, 'square');
    },
  };
}

// ---------------------------------------------------------------------------------- the scene

export function createRoulette(
  container: HTMLElement,
  names: string[],
  skinUrls: string[],
  onStatus: (s: RouletteStatus) => void
): Roulette | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    onStatus({ phase: 'error', round: 0, left: names.length, total: names.length });
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.appendChild(renderer.domElement);

  const n = names.length;
  const tableR = Math.max(1.05, n * 0.24);
  const seatR = tableR + 0.62;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d14);
  scene.fog = new THREE.Fog(0x0b0d14, seatR * 3, seatR * 6 + 6);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0x8fa2d0, 0x1a1410, 0.75));
  // one warm lamp over the table, the only real light in the room
  const lamp = new THREE.SpotLight(0xffd9a0, 60, 0, Math.PI / 3.4, 0.55, 1.6);
  lamp.position.set(0, 4.6, 0);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  scene.add(lamp, lamp.target);
  const flash = new THREE.PointLight(0xffcf6a, 0, 4, 2);
  scene.add(flash);

  const owned: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x);

  // floor
  const floorMap = keep(blockTexture());
  floorMap.repeat.set(18, 18);
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(40, 40)), keep(new THREE.MeshLambertMaterial({ map: floorMap, color: 0x3a3f52 })));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // the table: a wooden ring with green felt, on a thick post
  const wood = keep(woodTexture());
  wood.repeat.set(3, 3);
  const woodMat = keep(new THREE.MeshLambertMaterial({ map: wood }));
  const top = new THREE.Mesh(keep(new THREE.CylinderGeometry(tableR, tableR, 0.1, 40)), woodMat);
  top.position.y = TABLE_TOP - 0.05;
  top.castShadow = top.receiveShadow = true;
  const felt = new THREE.Mesh(keep(new THREE.CylinderGeometry(tableR - 0.14, tableR - 0.14, 0.012, 40)), keep(new THREE.MeshLambertMaterial({ color: 0x1d5a3a })));
  felt.position.y = TABLE_TOP + 0.002;
  felt.receiveShadow = true;
  const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.3, TABLE_TOP - 0.1, 12)), woodMat);
  post.position.y = (TABLE_TOP - 0.1) / 2;
  post.castShadow = true;
  scene.add(top, felt, post);

  // chairs
  const chairMat = keep(new THREE.MeshLambertMaterial({ map: wood, color: 0xb48a62 }));
  const seatGeo = keep(new THREE.BoxGeometry(0.5, 0.07, 0.5));
  const backGeo = keep(new THREE.BoxGeometry(0.5, 0.62, 0.07));
  const legGeo = keep(new THREE.BoxGeometry(0.06, 0.48, 0.06));
  const makeChair = () => {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(seatGeo, chairMat);
    seat.position.y = 0.48;
    const back = new THREE.Mesh(backGeo, chairMat);
    back.position.set(0, 0.82, 0.22);
    chair.add(seat, back);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const leg = new THREE.Mesh(legGeo, chairMat);
      leg.position.set(x, 0.24, z);
      chair.add(leg);
    }
    chair.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return chair;
  };

  // the revolver lives in a holder we aim by hand: its barrel (-X) points where `aim` says
  const holder = new THREE.Group();
  scene.add(holder);
  let gunMuzzle = v3(-0.76, 0.12, 0); // grip to muzzle, model units; replaced from the model
  const gunMat = keep(new THREE.MeshLambertMaterial({ color: 0x9aa3b5, side: THREE.DoubleSide }));

  // name tags
  const tags = document.createElement('div');
  tags.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  container.appendChild(tags);

  // knocked-out stars
  const starCanvas = document.createElement('canvas');
  starCanvas.width = starCanvas.height = 16;
  const sc = starCanvas.getContext('2d')!;
  sc.fillStyle = '#f5c518';
  for (const [x, y, w, h] of [[6, 0, 4, 16], [0, 6, 16, 4], [3, 3, 10, 10]]) sc.fillRect(x, y, w, h);
  const starMap = keep(new THREE.CanvasTexture(starCanvas));
  starMap.magFilter = THREE.NearestFilter;
  const starMat = keep(new THREE.SpriteMaterial({ map: starMap, transparent: true, depthWrite: false }));

  // confetti for the winner
  const confettiGeo = keep(new THREE.PlaneGeometry(0.06, 0.1));
  const confettiMats = [0xe3202e, 0xf5c518, 0x2f6fe0, 0x2ee68f, 0xfff6e0].map((c) => keep(new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })));
  const confetti: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[] = [];

  const sound = makeSound();
  let speed = 1;
  let disposed = false;
  let seats: Seat[] = [];
  let status: RouletteStatus = { phase: 'loading', round: 0, left: n, total: n };
  const emit = (patch: Partial<RouletteStatus>) => {
    status = { ...status, ...patch };
    onStatus(status);
  };
  emit({});

  // ------------------------------------------------------------------ timing

  const clock = new THREE.Clock();
  let now = 0;
  type Job = { until: number; tick: (k: number) => void; done: () => void; from: number };
  const jobs: Job[] = [];
  /** Runs `tick(0..1)` every frame for `seconds` (scaled by the speed), then resolves. */
  const animate = (seconds: number, tick: (k: number) => void = () => {}) =>
    new Promise<void>((done) => {
      const length = Math.max(0.01, seconds / speed);
      jobs.push({ from: now, until: now + length, tick, done });
    });
  const wait = (seconds: number) => animate(seconds);

  // ------------------------------------------------------------------ the gun

  /** Where the gun is, and what it's doing. */
  const gun = {
    on: 'table' as 'table' | 'hand',
    seat: null as Seat | null,
    pos: v3(0, TABLE_TOP + GUN_REST, 0),
    aim: v3(1, 0, 0),
    up: v3(0, 1, 0),
    raise: 0,
  };
  const basis = new THREE.Matrix4();
  const placeGun = () => {
    const f = gun.aim.clone().normalize();
    // on the table it lies flat on its side (top of the gun facing sideways) instead of standing on its grip
    if (gun.on === 'table') {
      gun.up.crossVectors(Y, f).normalize();
      gun.pos.y = Math.max(gun.pos.y, TABLE_TOP + GUN_REST);
    }
    const u = gun.up.clone().sub(f.clone().multiplyScalar(gun.up.dot(f))).normalize();
    const x = f.clone().negate();
    const z = new THREE.Vector3().crossVectors(x, u);
    basis.makeBasis(x, u, z);
    holder.quaternion.setFromRotationMatrix(basis);
    holder.position.copy(gun.pos);
  };
  const muzzleWorld = () => gunMuzzle.clone().multiplyScalar(GUN_SCALE).applyQuaternion(holder.quaternion).add(holder.position);

  // ------------------------------------------------------------------ posing

  const dirOf = (...parts: [THREE.Vector3, number][]) => {
    const out = new THREE.Vector3();
    for (const [v, k] of parts) out.addScaledVector(v, k);
    return out.normalize();
  };
  const arm = (upper: THREE.Object3D, fore: THREE.Object3D, upperDir: THREE.Vector3, foreDir?: THREE.Vector3) => {
    fore.quaternion.identity();
    fore.updateWorldMatrix(false, true);
    pointBone(upper, Y, upperDir);
    if (foreDir) pointBone(fore, Y, foreDir);
  };
  const side = v3();
  const upv = v3();
  const fwd = v3();
  const tmp = v3();
  let winner: Seat | null = null;
  let winnerAt = 0;

  function pose(s: Seat) {
    const t = now + s.phase;
    // where they sit, facing the middle
    s.root.position.copy(s.home);
    let lean = 0;
    let lift = 0;
    let tipBack = 0;
    let outward = 0;
    const isWinner = winner === s;
    if (s.out) {
      // knocked back off the chair, and down they stay
      const k = smooth(0, 0.55, now - s.outAt);
      tipBack = k;
      outward = 0.45 * k;
      lift = Math.sin(Math.PI * clamp01((now - s.outAt) / 0.55)) * 0.18;
    }
    if (isWinner) {
      // up onto the middle of the table
      const k = smooth(0, 0.7, now - winnerAt);
      // standing on the table top
      s.root.position.lerpVectors(s.home, v3(0, TABLE_TOP + FOOT_LIFT, 0), k);
      lift = Math.sin(Math.PI * clamp01((now - winnerAt) / 0.7)) * 0.6 + (k >= 1 ? Math.abs(Math.sin(t * 8)) * 0.08 : 0);
    }
    s.root.position.addScaledVector(s.facing, -outward);
    s.root.position.y += lift;
    const yaw = Math.atan2(s.facing.x, s.facing.z) + Math.PI;
    let yawExtra = 0;
    if (isWinner && now - winnerAt > 0.7) yawExtra = (now - winnerAt - 0.7) * 1.4;
    s.root.rotation.set(lean + tipBack * 1.45, yaw + yawExtra, 0, 'YXZ');
    // the chair goes over with them
    s.chair.rotation.set(tipBack * 1.2, s.chair.rotation.y, 0, 'YXZ');
    s.chair.position.copy(s.chairHome).addScaledVector(s.facing, -0.35 * tipBack);

    s.actions.stand.setEffectiveWeight(1);
    s.mixer.update(0);
    s.root.updateMatrixWorld(true);
    side.setFromMatrixColumn(s.root.matrixWorld, 0).normalize();
    upv.setFromMatrixColumn(s.root.matrixWorld, 1).normalize();
    fwd.setFromMatrixColumn(s.root.matrixWorld, 2).normalize().negate();
    const centre = s.root.getWorldPosition(v3());
    const outR = s.armR.getWorldPosition(v3()).sub(centre).projectOnPlane(upv).normalize();
    const outL = outR.clone().negate();

    // legs: sitting (the winner stands)
    if (!isWinner) {
      for (const [thigh, shin, spread] of [[s.thighL, s.shinL, 0.12], [s.thighR, s.shinR, -0.12]] as const) {
        shin.quaternion.identity();
        shin.updateWorldMatrix(false, true);
        pointBone(thigh, Y, dirOf([fwd, 1], [side, spread], [upv, -0.05]));
        pointBone(shin, Y, dirOf([upv, -1], [fwd, s.out ? 0.6 : 0.15]));
      }
    }

    // arms
    const holding = gun.on === 'hand' && gun.seat === s;
    if (isWinner && now - winnerAt > 0.7) {
      const swap = Math.sin(t * 7) > 0;
      arm(s.armR, s.foreR, swap ? dirOf([upv, 1], [outR, 0.5]) : dirOf([outR, 1], [upv, -0.2]));
      arm(s.armL, s.foreL, swap ? dirOf([outL, 1], [upv, -0.2]) : dirOf([upv, 1], [outL, 0.5]));
    } else if (s.out) {
      arm(s.armR, s.foreR, dirOf([outR, 1], [upv, 0.6]));
      arm(s.armL, s.foreL, dirOf([outL, 1], [upv, 0.6]));
    } else if (holding) {
      // gun hand coming up to the side of the head
      const r = gun.raise;
      // the head bone sits at the neck: the middle of the head is a quarter of a block up
      const headMid = s.head.getWorldPosition(v3()).addScaledVector(upv, HEAD_MID);
      // the hand stops a gun's length out from the side of the head, so the muzzle just touches it
      const temple = headMid.clone().addScaledVector(outR, 0.72).addScaledVector(fwd, 0.05);
      const restUpper = dirOf([DOWN, 0.55], [fwd, 0.8], [outR, 0.1]);
      // elbow out to the side and a little down, the forearm folding up to the temple
      const raiseUpper = dirOf([outR, 1], [DOWN, 0.25], [fwd, 0.12]);
      const upper = restUpper.clone().lerp(raiseUpper, r).normalize();
      pointBone(s.armR, Y, upper);
      s.foreR.quaternion.identity();
      s.foreR.updateWorldMatrix(false, true);
      const foreAt = s.foreR.getWorldPosition(v3());
      const restFore = dirOf([fwd, 1], [DOWN, 0.15]);
      const raiseFore = temple.clone().sub(foreAt).normalize();
      pointBone(s.foreR, Y, restFore.clone().lerp(raiseFore, r).normalize());
      arm(s.armL, s.foreL, dirOf([DOWN, 0.6], [fwd, 0.7], [outL, 0.1]), dirOf([fwd, 1], [DOWN, 0.2], [outR, 0.25]));
    } else {
      // forearms resting on the table edge, a little restless
      const fidget = Math.sin(t * 1.3) * 0.05;
      arm(s.armR, s.foreR, dirOf([DOWN, 0.6], [fwd, 0.7], [outR, 0.1]), dirOf([fwd, 1], [DOWN, 0.2 + fidget], [outL, 0.25]));
      arm(s.armL, s.foreL, dirOf([DOWN, 0.6], [fwd, 0.7], [outL, 0.1]), dirOf([fwd, 1], [DOWN, 0.2 - fidget], [outR, 0.25]));
    }

    // head: watching whoever has the gun, the winner looks at the camera
    const look = v3();
    if (isWinner) look.copy(camera.position);
    else if (s.out) look.copy(s.head.getWorldPosition(tmp)).addScaledVector(upv, 1);
    else if (gun.seat && gun.seat !== s) gun.seat.head.getWorldPosition(look);
    else look.set(0, TABLE_TOP, 0);
    const headPos = s.head.getWorldPosition(v3());
    const toLook = look.sub(headPos).normalize();
    const ang = toLook.angleTo(fwd);
    if (ang > 1.1) toLook.lerp(fwd, 1 - 1.1 / ang).normalize();
    pointBone(s.head, Z, toLook, 0.85);
    if (holding && gun.raise > 0.9) s.head.rotateZ(0.12 * Math.sin(now * 30) * 0.05);
    s.head.updateWorldMatrix(false, true);

    // the gun in the hand: grip on the hand, barrel into the head
    if (holding) {
      s.grip.updateWorldMatrix(true, false);
      const hand = s.grip.getWorldPosition(v3());
      gun.pos.copy(hand);
      const head = s.head.getWorldPosition(v3()).addScaledVector(upv, HEAD_MID);
      const atHead = head.sub(hand).normalize();
      const atTable = dirOf([fwd, 1], [DOWN, 0.1]);
      gun.aim.copy(atTable.lerp(atHead, gun.raise).normalize());
      gun.up.copy(upv);
    }
  }

  // ------------------------------------------------------------------ camera

  const camBase = { radius: seatR * 2.15 + 1.6, height: seatR * 1.15 + 1.9 };
  let camAngle = 0.35;
  /** When set, the camera swings round to this angle (across the table from the shooter). */
  let camWantAngle: number | null = null;
  const camFocus = v3(0, TABLE_TOP, 0);
  const camWantFocus = v3(0, TABLE_TOP, 0);
  let camZoom = 1;
  let camWantZoom = 1;
  let shake = 0;
  function moveCamera(dt: number) {
    if (camWantAngle === null) camAngle += dt * 0.06 * (status.phase === 'done' ? 3 : 1);
    else {
      let d = camWantAngle - camAngle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      camAngle += d * (1 - Math.exp(-dt * 2.2));
    }
    camFocus.lerp(camWantFocus, 1 - Math.exp(-dt * 3));
    camZoom += (camWantZoom - camZoom) * (1 - Math.exp(-dt * 2.5));
    const r = camBase.radius * camZoom;
    camera.position.set(Math.sin(camAngle) * r + camFocus.x * 0.4, camBase.height * camZoom + 0.3, Math.cos(camAngle) * r + camFocus.z * 0.4);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * shake * 0.25;
      shake = Math.max(0, shake - dt * 2.5);
    }
    camera.lookAt(camFocus);
  }

  // ------------------------------------------------------------------ the game

  const alive = () => seats.filter((s) => !s.out);
  /** On the table in front of a seat. */
  const tableSpot = (s: Seat) => v3(s.home.x, 0, s.home.z).setLength(tableR * 0.62).setY(TABLE_TOP + GUN_REST);

  async function slideGun(to: THREE.Vector3, aimTo: THREE.Vector3, seconds: number) {
    const from = gun.pos.clone();
    const fromAim = gun.aim.clone();
    gun.on = 'table';
    gun.seat = null;
    gun.raise = 0;
    gun.up.set(0, 1, 0);
    sound.slide();
    await animate(seconds, (k) => {
      const e = smooth(0, 1, k);
      gun.pos.lerpVectors(from, to, e);
      gun.pos.y = TABLE_TOP + GUN_REST + Math.sin(Math.PI * e) * 0.05;
      gun.aim.copy(fromAim).lerp(aimTo, e).normalize();
    });
  }

  /** Spins the gun on the table like a bottle; it stops pointing at whoever goes first. */
  async function spinTo(s: Seat) {
    gun.on = 'table';
    gun.seat = null;
    gun.pos.set(0, TABLE_TOP + GUN_REST, 0);
    const startA = Math.atan2(gun.aim.z, gun.aim.x);
    let endA = Math.atan2(s.home.z, s.home.x);
    while (endA < startA) endA += Math.PI * 2;
    endA += Math.PI * 2 * 3;
    sound.spin(1.6 / speed);
    await animate(1.8, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      const a = startA + (endA - startA) * e;
      gun.aim.set(Math.cos(a), 0, Math.sin(a));
    });
  }

  async function play() {
    let round = 0;
    emit({ phase: 'playing', round: 0, left: alive().length });
    await wait(0.6);
    while (alive().length > 1 && !disposed) {
      round++;
      const left = alive();
      // seat order round the table, from a fair random first player
      const first = left[randomBelow(left.length)];
      const order = [...left.slice(left.indexOf(first)), ...left.slice(0, left.indexOf(first))];
      const bullet = randomBelow(6);
      emit({ round, left: left.length, turn: undefined, shot: undefined });
      camWantFocus.set(0, TABLE_TOP, 0);
      camWantZoom = 1;
      camWantAngle = null;
      await spinTo(first);
      await wait(0.3);
      for (let pull = 0; ; pull++) {
        if (disposed) return;
        const s = order[pull % order.length];
        // the gun comes to them across the table, then into their hand
        const spot = tableSpot(s);
        await slideGun(spot, v3().copy(s.facing).negate().setY(0).normalize(), pull === 0 ? 0.45 : 0.6);
        gun.on = 'hand';
        gun.seat = s;
        emit({ turn: s.name, shot: undefined });
        camWantFocus.copy(s.home).setY(TABLE_TOP + 0.35);
        camWantFocus.lerp(v3(0, TABLE_TOP + 0.3, 0), 0.3);
        camWantAngle = Math.atan2(-s.home.x, -s.home.z);
        camWantZoom = 0.78;
        await animate(0.5, (k) => (gun.raise = smooth(0, 1, k)));
        // the wait: longer when it matters
        const lastTwo = left.length === 2;
        const tension = (lastTwo ? 1.6 : 0.7) + randomBelow(5) * 0.1;
        sound.heartbeat();
        if (tension > 1.2) window.setTimeout(() => sound.heartbeat(), 700 / speed);
        await wait(tension);
        if (pull === bullet) {
          // BANG
          sound.bang();
          shake = 1;
          flash.position.copy(muzzleWorld());
          flash.intensity = 25;
          s.out = true;
          s.outAt = now;
          s.tag.style.textDecoration = 'line-through';
          s.tag.style.opacity = '0.55';
          s.material.color.set(0x8a8a8a);
          gun.on = 'table';
          gun.seat = null;
          const drop = tableSpot(s);
          gun.pos.copy(drop);
          emit({ shot: { name: s.name, result: 'bang' }, left: alive().length });
          await wait(1.7);
          break;
        }
        sound.click();
        emit({ shot: { name: s.name, result: 'click' } });
        await wait(0.45);
        await animate(0.35, (k) => (gun.raise = 1 - smooth(0, 1, k)));
      }
    }
    const last = alive()[0];
    if (!last || disposed) return;
    winner = last;
    winnerAt = now;
    gun.on = 'table';
    gun.seat = null;
    gun.pos.set(tableR * 0.5, TABLE_TOP + GUN_REST, 0);
    camWantAngle = null;
    camWantFocus.set(0, TABLE_TOP + 1.55, 0);
    camWantZoom = 0.62;
    sound.fanfare();
    for (let i = 0; i < 160; i++) {
      const mesh = new THREE.Mesh(confettiGeo, confettiMats[i % confettiMats.length]);
      mesh.position.set((Math.random() - 0.5) * 3, 3.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      scene.add(mesh);
      confetti.push({ mesh, vel: v3((Math.random() - 0.5) * 0.4, -0.6 - Math.random() * 0.6, (Math.random() - 0.5) * 0.4), spin: v3(Math.random() * 6, Math.random() * 6, Math.random() * 6) });
    }
    emit({ phase: 'done', winner: last.name, turn: undefined, left: 1 });
  }

  // ------------------------------------------------------------------ loading

  const loader = new GLTFLoader();
  Promise.all([
    loader.loadAsync(getModelUrl('KirkaCharacter.glb')),
    loader.loadAsync(getModelUrl('Revolver.glb')),
    new THREE.TextureLoader().loadAsync(REVOLVER_TEXTURE).catch(() => null),
    Promise.all(names.map((_, i) => loadSkin(skinUrls[i % skinUrls.length] || `${import.meta.env.BASE_URL}home/${LOCAL_SKINS[i % LOCAL_SKINS.length]}`))),
  ])
    .then(([character, revolver, revolverTex, textures]) => {
      if (disposed) {
        textures.forEach((t) => t?.dispose());
        revolverTex?.dispose();
        return;
      }
      // the gun
      if (revolverTex) {
        revolverTex.flipY = false;
        revolverTex.colorSpace = THREE.SRGBColorSpace;
        revolverTex.magFilter = THREE.NearestFilter;
        keep(revolverTex);
        gunMat.map = revolverTex;
        gunMat.color.set(0xffffff);
        gunMat.needsUpdate = true;
      }
      const model = revolver.scene;
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = gunMat;
        mesh.castShadow = true;
      });
      const lever = model.getObjectByName('Lever');
      const muzzle = model.getObjectByName('Muzzle');
      if (lever && muzzle) gunMuzzle = muzzle.position.clone().sub(lever.position);
      model.scale.setScalar(GUN_SCALE);
      if (lever) model.position.copy(lever.position).multiplyScalar(-GUN_SCALE);
      holder.add(model);

      // everyone round the table
      seats = names.map((name, i) => {
        const angle = Math.PI / 2 + (i / n) * Math.PI * 2;
        const home = v3(Math.cos(angle) * seatR, 0, Math.sin(angle) * seatR);
        const facing = home.clone().negate().setY(0).normalize();
        const tex = textures[i];
        const material = keep(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.05, side: THREE.DoubleSide }));
        if (tex) keep(tex);
        const player = makePlayer(character, material, null, 'pose1');
        player.actions.stand.play();
        scene.add(player.root);
        const chair = makeChair();
        chair.position.copy(home).addScaledVector(facing, -0.08);
        chair.rotation.set(0, Math.atan2(facing.x, facing.z) + Math.PI, 0, 'YXZ');
        scene.add(chair);

        const tag = document.createElement('div');
        tag.textContent = name;
        tag.style.cssText =
          'position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:2px 8px;background:rgba(6,8,13,.72);color:#fff6e0;font:700 14px "JetBrains Mono",ui-monospace,monospace;white-space:nowrap;border:2px solid #11121b';
        tags.appendChild(tag);
        const bone = (b: string) => player.root.getObjectByName(b)!;
        return Object.assign(player, {
          name, angle, home: home.setY(FOOT_LIFT - 0.3), facing, chair, chairHome: chair.position.clone(), tag, out: false, outAt: 0, material, phase: Math.random() * 10,
          head: bone('head'), armR: bone('rightArm1'), foreR: bone('rightArm2'), armL: bone('leftArm1'), foreL: bone('leftArm2'),
          thighL: bone('leftLeg1'), shinL: bone('leftLeg2'), thighR: bone('rightLeg1'), shinR: bone('rightLeg2'), grip: bone('pose2'),
        }) as Seat;
      });
      for (const s of seats) s.root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      emit({ phase: 'ready' });
    })
    .catch((err) => {
      console.warn('[roulette] failed to load', err);
      emit({ phase: 'error' });
    });

  // ------------------------------------------------------------------ sizing and drawing

  const resize = () => {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 450;
    camera.aspect = w / h;
    // narrow screens step back so the whole table stays in shot
    camera.fov = camera.aspect < 1 ? 58 : 38;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const tagPos = v3();
  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    now += dt;
    for (const job of [...jobs]) {
      const k = clamp01((now - job.from) / (job.until - job.from));
      job.tick(k);
      if (k >= 1) {
        jobs.splice(jobs.indexOf(job), 1);
        job.done();
      }
    }
    for (const s of seats) {
      pose(s);
      // knocked-out stars
      const stars = (s as Seat & { stars?: THREE.Sprite[] }).stars;
      if (s.out && !stars) {
        (s as Seat & { stars?: THREE.Sprite[] }).stars = [0, 1, 2].map(() => {
          const sp = new THREE.Sprite(starMat);
          sp.scale.setScalar(0.13);
          scene.add(sp);
          return sp;
        });
      }
      if (s.out && stars) {
        const head = s.head.getWorldPosition(tagPos);
        stars.forEach((sp, i) => {
          const a = now * 4 + (i * Math.PI * 2) / 3;
          sp.position.set(head.x + Math.cos(a) * 0.3, head.y + 0.3, head.z + Math.sin(a) * 0.3);
        });
      }
    }
    placeGun();
    flash.intensity = Math.max(0, flash.intensity - dt * 120);
    for (const c of confetti) {
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      if (c.mesh.position.y < 0.02) c.mesh.position.y = 0.02;
    }
    moveCamera(dt);
    // development only: lets a test put the camera wherever it wants to look
    if (import.meta.env.DEV) (window as unknown as { __rouletteCam?: (c: THREE.Camera, shooter: Seat | null) => void }).__rouletteCam?.(camera, gun.seat);
    renderer.render(scene, camera);
    // name tags over heads
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const s of seats) {
      s.head.getWorldPosition(tagPos);
      tagPos.y += 0.55;
      tagPos.project(camera);
      const visible = tagPos.z < 1;
      s.tag.style.display = visible ? 'block' : 'none';
      s.tag.style.left = `${((tagPos.x + 1) / 2) * w}px`;
      s.tag.style.top = `${((1 - tagPos.y) / 2) * h}px`;
      s.tag.style.zIndex = String(Math.round((1 - tagPos.z) * 1000));
    }
  };
  frame();

  let started = false;
  return {
    start() {
      if (started || status.phase !== 'ready') return;
      started = true;
      sound.wake();
      void play();
    },
    setSpeed(m: number) {
      speed = Math.max(0.25, m);
    },
    setMuted(m: boolean) {
      sound.setMuted(m);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      sound.close();
      for (const o of owned) o.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      tags.remove();
    },
  };
}
