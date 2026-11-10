/**
 * The home page crew: four Kirka players beside the search box who watch what you do. Their heads
 * and bodies follow the cursor; they lean in and nod while you type an ID, cheer when it's a real
 * one, shrug at a wrong one, think while it loads and facepalm when nobody's found. Click one for an
 * emote; leave the mouse alone and they get bored.
 *
 * A different four, standing differently, with different habits, every visit.
 *
 * Built to be cheap: four small models, no shadows, no map, drawn at most 30 times a second and not
 * at all while it's off screen or the tab is hidden.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getModelUrl } from '../../utils/skinAssets';
import { blockTexture, clamp01, FOOT_LIFT, loadTexture, makePlayer, pointBone, smooth, type Player } from './filmKit';

export type CrewEvent =
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'type'; value: string }
  | { type: 'invalid' }
  | { type: 'searching'; on: boolean }
  | { type: 'notFound' }
  /** The cursor is over one of the link boxes below (or has left them: null). */
  | { type: 'hoverLink'; id: string | null; el: HTMLElement | null }
  /** One of the emote buttons. */
  | { type: 'emote'; name: WheelEmote };

/** What the emote buttons under them can ask for. */
export type WheelEmote = 'wave' | 'dance' | 'gg' | 'flex' | 'spin';

export interface Crew {
  react: (event: CrewEvent) => void;
  dispose: () => void;
}

interface CrewOptions {
  /** Where the ID box is on screen, so they can look at it. */
  inputRect: () => DOMRect | null;
  onReady: () => void;
  still?: boolean;
}

const SKINS = [
  { file: 'c-gore.png', name: 'Gore' },
  { file: 'c-slasher.png', name: 'Slasher' },
  { file: 'c-skeletain.png', name: 'Skeletain' },
  { file: 'c-doombringer.png', name: 'Doombringer' },
  { file: 'c-onryo.png', name: 'Onryo' },
  { file: 'c-thriller.png', name: 'Thriller' },
  { file: 'c-pumpreaper.png', name: 'Pumpreaper' },
  { file: 'c-kingdracula.png', name: 'Kingdracula' },
];

/** Ways to stand: [x, z] for each of the four, and which one (if any) gets a crate to stand on. */
const LAYOUTS: { spots: [number, number][]; crate: number | null }[] = [
  { spots: [[-1.35, 0.15], [-0.45, -0.4], [0.45, 0.1], [1.35, -0.35]], crate: null },
  { spots: [[-1.3, -0.3], [-0.42, 0.25], [0.5, -0.25], [1.4, 0.2]], crate: 0 },
  { spots: [[-1.4, 0], [-0.5, 0.35], [0.4, -0.45], [1.3, 0.05]], crate: 2 },
];

/** How each one carries themselves when nothing's happening. */
type Habit = 'easy' | 'crossed' | 'bouncy' | 'hands-on-hips';
const HABITS: Habit[] = ['easy', 'crossed', 'bouncy', 'hands-on-hips'];

type EmoteName = 'wave' | 'cheer' | 'shrug' | 'facepalm' | 'think' | 'spin' | 'dance' | 'nod' | 'hop' | 'sit' | 'stretch' | 'dizzy' | 'stumble' | 'gg' | 'flex' | 'money';
const EMOTE_LENGTH: Record<EmoteName, number> = {
  dizzy: 2.6, stumble: 2.2, gg: 1.5, flex: 1.7, money: 1.8,
  wave: 1.6, cheer: 1.5, shrug: 1.3, facepalm: 1.8, think: Infinity, spin: 0.9, dance: 2.4, nod: 0.45, hop: 0.45, sit: Infinity, stretch: 1.8,
};

interface Mate extends Player {
  name: string;
  home: THREE.Vector3;
  habit: Habit;
  /** Seconds of offset so they don't all breathe together. */
  phase: number;
  /** `from` is whoever bumped into them, for a stumble. */
  emote: { name: EmoteName; t0: number; from?: Mate } | null;
  look: THREE.Vector3;
  yaw: number;
  tag: HTMLDivElement;
  head: THREE.Object3D;
  armR: THREE.Object3D;
  foreR: THREE.Object3D;
  armL: THREE.Object3D;
  foreL: THREE.Object3D;
  thighF: THREE.Object3D;
  shinF: THREE.Object3D;
  thighB: THREE.Object3D;
  shinB: THREE.Object3D;
  lastHop: number;
}

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const DOWN = v3(0, -1, 0);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5);

export function createCrew(container: HTMLElement, { inputRect, onReady, still = false }: CrewOptions): Crew | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:pointer';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const LOOK_AT = v3(0, 0.98, 0);
  camera.position.set(0, 1.25, 5.4);
  camera.lookAt(LOOK_AT);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2420, 1.6));
  const key = new THREE.DirectionalLight(0xffe2c0, 2.2);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb2ff, 1.4);
  rim.position.set(-4, 3, -5);
  scene.add(rim);

  // A soft dark patch under each of them, so they stand on something
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
  const shadowGeometry = new THREE.PlaneGeometry(1.1, 0.7);
  const crateGeometry = new THREE.BoxGeometry(1, 0.5, 0.9);
  const crateMap = blockTexture();
  crateMap.repeat.set(2, 1);
  const crateMaterial = new THREE.MeshLambertMaterial({ map: crateMap, color: 0x9a7350 });
  const owned: { dispose: () => void }[] = [shadowMap, shadowMaterial, shadowGeometry, crateGeometry, crateMap, crateMaterial];

  const tags = document.createElement('div');
  tags.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  container.appendChild(tags);

  // --- Who's here this time ----------------------------------------------------------------------
  const layout = pick(LAYOUTS);
  const chosen = shuffle(SKINS).slice(0, 4);
  const habits = shuffle(HABITS);
  let mates: Mate[] = [];
  let ready = false;
  let disposed = false;

  // --- Where they look -----------------------------------------------------------------------------
  const pointer = new THREE.Vector2(0, 0.1);
  let pointerInside = true;
  let lastMove = performance.now() / 1000;
  let typing = false;
  let searching = false;
  let lastValid = '';
  /** A link box they're pointing at. */
  let linkEl: HTMLElement | null = null;
  /** The edge of the window the cursor's at, and who leans out to look. */
  let edge: 'left' | 'right' | 'top' | null = null;
  let edgeMate: Mate | null = null;
  /** Shaking the cursor: quick changes of direction fill this up; it drains away on its own. */
  let lastPointer = { x: 0, y: 0, t: 0 };
  let lastDirection = 0;
  let shakeMeter = 0;
  let dizzyUntil = 0;
  const raycaster = new THREE.Raycaster();
  const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.2);

  /** A screen point, as a point in the room a little in front of them. */
  const toWorld = (ndcX: number, ndcY: number, out: THREE.Vector3) => {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    return raycaster.ray.intersectPlane(lookPlane, out) ?? out.set(ndcX * 3, 1.4 + ndcY * 2, 2.2);
  };
  const screenToNdc = (x: number, y: number) => {
    const rect = renderer.domElement.getBoundingClientRect();
    return [((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1] as const;
  };

  const onPointerMove = (e: PointerEvent) => {
    const [x, y] = screenToNdc(e.clientX, e.clientY);
    pointer.set(x, y);
    pointerInside = true;
    lastMove = clock.elapsedTime;

    // Shake the cursor back and forth and they get dizzy. A fast sweep across the screen doesn't count:
    // it takes quick changes of direction.
    const now = performance.now() / 1000;
    const dx = e.clientX - lastPointer.x;
    if (Math.abs(dx) > 6) {
      const direction = Math.sign(dx);
      const quick = now - lastPointer.t < 0.12;
      if (quick && lastDirection && direction !== lastDirection) shakeMeter += 0.17;
      lastDirection = direction;
      if (shakeMeter > 1 && clock.elapsedTime > dizzyUntil) {
        shakeMeter = 0;
        dizzyUntil = clock.elapsedTime + 7;
        playAll(['dizzy'], 0.15);
      }
    }
    lastPointer = { x: e.clientX, y: e.clientY, t: now };

    // At the edge of the window, the nearest one leans out to see
    const nextEdge = e.clientX < 40 ? 'left' : e.clientX > window.innerWidth - 40 ? 'right' : e.clientY < 30 ? 'top' : null;
    if (nextEdge !== edge) {
      edge = nextEdge;
      if (!edge || !mates.length) edgeMate = null;
      else {
        const byX = [...mates].sort((a, b) => screenX(a) - screenX(b));
        edgeMate = edge === 'left' ? byX[0] : edge === 'right' ? byX[byX.length - 1] : pick(byX);
      }
    }
    // Anyone sitting gets back up
    for (const m of mates) if (m.emote?.name === 'sit') m.emote = null;
    // Hovering over someone makes them hop
    const hovered = mateAt(x, y);
    if (hovered && clock.elapsedTime - hovered.lastHop > 2.5 && !hovered.emote) {
      hovered.lastHop = clock.elapsedTime;
      play(hovered, 'hop');
    }
  };
  const onPointerLeave = () => {
    pointerInside = false;
  };
  const onClick = (e: MouseEvent) => {
    const [x, y] = screenToNdc(e.clientX, e.clientY);
    const m = mateAt(x, y);
    if (!m) return;
    const name = pick<EmoteName>(['wave', 'spin', 'dance', 'cheer', 'stretch', 'flex']);
    play(m, name);
    // Spinning and dancing take up room: often the one next door gets bumped
    if ((name === 'spin' || name === 'dance' || Math.random() < 0.35) && mates.length > 1) {
      const next = mates.filter((o) => o !== m).sort((a, b) => a.home.distanceTo(m.home) - b.home.distanceTo(m.home))[0];
      window.setTimeout(() => {
        if (!disposed) next.emote = { name: 'stumble', t0: clock.elapsedTime, from: m };
      }, 220);
    }
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onClick);

  /** Where one of them is across the screen, from -1 (left) to 1. */
  const screenX = (m: Mate) => corner.copy(m.root.position).project(camera).x;

  /** Which of them is under a screen point. */
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  const mateAt = (x: number, y: number) => {
    for (const m of mates) {
      box.setFromCenterAndSize(m.root.position.clone().add(v3(0, 0.95, 0)), v3(0.9, 1.9, 0.6));
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const cx of [box.min.x, box.max.x]) for (const cy of [box.min.y, box.max.y]) {
        corner.set(cx, cy, box.max.z).project(camera);
        x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x); y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y);
      }
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return m;
    }
    return null;
  };

  const play = (m: Mate, name: EmoteName) => {
    m.emote = { name, t0: clock.elapsedTime };
  };
  const playAll = (names: EmoteName[], stagger = 0.12) => {
    mates.forEach((m, i) => {
      if (m.emote?.name === 'think') return;
      window.setTimeout(() => play(m, names[i % names.length]), i * stagger * 1000);
    });
  };

  // --- What the page tells them ---------------------------------------------------------------------
  const isValidId = (v: string) => /^#?[a-zA-Z0-9]{6}$/.test(v.trim()) || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v.trim());
  let lastNod = 0;
  const react = (event: CrewEvent) => {
    if (!ready) return;
    switch (event.type) {
      case 'focus':
        typing = true;
        if (Math.random() < 0.6) play(pick(mates), 'wave');
        break;
      case 'blur':
        typing = false;
        break;
      case 'type': {
        typing = true;
        const now = clock.elapsedTime;
        if (now - lastNod > 0.18) {
          lastNod = now;
          const idle = mates.filter((m) => !m.emote);
          if (idle.length) play(pick(idle), 'nod');
        }
        if (isValidId(event.value) && event.value.trim() !== lastValid) {
          lastValid = event.value.trim();
          playAll(['cheer', 'cheer', 'dance', 'cheer']);
        }
        if (!isValidId(event.value)) lastValid = '';
        break;
      }
      case 'invalid':
        playAll(['shrug', 'facepalm', 'shrug', 'shrug'], 0.08);
        break;
      case 'searching':
        searching = event.on;
        if (event.on) play(mates[1], 'think');
        else mates.forEach((m) => m.emote?.name === 'think' && (m.emote = null));
        break;
      case 'notFound':
        playAll(['facepalm', 'shrug', 'facepalm', 'shrug'], 0.1);
        break;
      case 'hoverLink': {
        linkEl = event.el;
        if (!event.id) break;
        // One of them has something to say about where you're headed
        const flavour: Record<string, EmoteName> = { live: 'cheer', market: 'money', compete: 'flex', skin: 'gg', create: 'nod' };
        const free = mates.filter((m) => !m.emote);
        if (free.length && flavour[event.id]) play(pick(free), flavour[event.id]);
        break;
      }
      case 'emote': {
        lastMove = clock.elapsedTime;
        // Down the line, one after another
        const order = [...mates].sort((a, b) => screenX(a) - screenX(b));
        order.forEach((m, i) => window.setTimeout(() => !disposed && play(m, event.name), i * 140));
        break;
      }
    }
  };

  // --- Loading ---------------------------------------------------------------------------------------
  const loader = new GLTFLoader();
  Promise.all([loader.loadAsync(getModelUrl('KirkaCharacter.glb')), Promise.all(chosen.map((s) => loadTexture(s.file)))])
    .then(([character, textures]) => {
      if (disposed) {
        textures.forEach((t) => t?.dispose());
        return;
      }
      mates = chosen.map((skin, i) => {
        const texture = textures[i];
        if (texture) owned.push(texture);
        const material = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.05, side: THREE.DoubleSide });
        owned.push(material);
        const player = makePlayer(character, material, null, 'pose1');
        player.root.traverse((o) => ((o as THREE.Mesh).castShadow = false));
        player.actions.stand.play();
        const [x, z] = layout.spots[i];
        const onCrate = layout.crate === i;
        const home = v3(x, onCrate ? 0.5 : 0, z);
        if (onCrate) {
          const crate = new THREE.Mesh(crateGeometry, crateMaterial);
          crate.position.set(x, 0.25, z);
          scene.add(crate);
        }
        const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(x, onCrate ? 0.505 : 0.005, z);
        scene.add(shadow);
        scene.add(player.root);

        const tag = document.createElement('div');
        tag.textContent = skin.name;
        tag.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);padding:1px 6px;background:rgba(6,8,13,.6);color:#f4f1e8;font:600 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:nowrap';
        tags.appendChild(tag);

        const bone = (n: string) => player.root.getObjectByName(n)!;
        return Object.assign(player, {
          name: skin.name, home, habit: habits[i], phase: Math.random() * 6, emote: null, look: v3(0, 1.4, 3), yaw: Math.PI, tag, lastHop: 0,
          head: bone('head'), armR: bone('rightArm1'), foreR: bone('rightArm2'), armL: bone('leftArm1'), foreL: bone('leftArm2'),
          thighF: bone('leftLeg1'), shinF: bone('leftLeg2'), thighB: bone('rightLeg1'), shinB: bone('rightLeg2'),
        }) as Mate;
      });
      ready = true;
      // Someone says hello
      window.setTimeout(() => !disposed && play(pick(mates), 'wave'), 500);
      onReady();
      if (still) draw(0);
    })
    .catch((err) => console.warn('[home crew] failed to load:', err));

  // --- Sizing --------------------------------------------------------------------------------------
  const resize = () => {
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 600;
    camera.aspect = w / h;
    // Keep all four in shot on a narrow screen
    const fitWidth = 3.75;
    const dist = camera.position.distanceTo(LOOK_AT);
    const neededFov = THREE.MathUtils.radToDeg(2 * Math.atan(fitWidth / 2 / dist / camera.aspect));
    camera.fov = Math.max(30, neededFov);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (still && ready) draw(0);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  let inView = true;
  const viewObserver = new IntersectionObserver((entries) => (inView = entries[0]?.isIntersecting ?? true));
  viewObserver.observe(container);

  // --- Posing --------------------------------------------------------------------------------------
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const dirOf = (...parts: [THREE.Vector3, number][]) => {
    const out = new THREE.Vector3();
    for (const [v, k] of parts) out.addScaledVector(v, k);
    return out.normalize();
  };
  /** Points an arm: the upper arm one way, the forearm another (or straight on). */
  const arm = (upper: THREE.Object3D, fore: THREE.Object3D, upperDir: THREE.Vector3, foreDir?: THREE.Vector3) => {
    fore.quaternion.identity();
    fore.updateWorldMatrix(false, true);
    pointBone(upper, Y, upperDir);
    if (foreDir) pointBone(fore, Y, foreDir);
  };

  /** Takes out any sideways tilt, so a head looks up, down and round but never lolls onto a shoulder. */
  const levelQ = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();
  const levelHead = (head: THREE.Object3D) => {
    const q = head.getWorldQuaternion(levelQ);
    const face = Z.clone().applyQuaternion(q);
    const headUp = Y.clone().applyQuaternion(q).projectOnPlane(face).normalize();
    const wantUp = Y.clone().projectOnPlane(face).normalize();
    if (headUp.lengthSq() < 0.5 || wantUp.lengthSq() < 0.5) return;
    q.premultiply(new THREE.Quaternion().setFromUnitVectors(headUp, wantUp));
    head.parent!.getWorldQuaternion(parentQ).invert();
    head.quaternion.copy(parentQ.multiply(q));
    head.updateWorldMatrix(false, true);
  };

  // Stars going round a dizzy head
  const starCanvas = document.createElement('canvas');
  starCanvas.width = starCanvas.height = 16;
  const starCtx = starCanvas.getContext('2d')!;
  starCtx.fillStyle = '#f5c518';
  for (const [x, y, w, h] of [[6, 0, 4, 16], [0, 6, 16, 4], [3, 3, 10, 10]]) starCtx.fillRect(x, y, w, h);
  const starMap = new THREE.CanvasTexture(starCanvas);
  starMap.magFilter = THREE.NearestFilter;
  const starMaterial = new THREE.SpriteMaterial({ map: starMap, transparent: true, depthWrite: false });
  owned.push(starMap, starMaterial);
  const starsFor = new Map<Mate, THREE.Sprite[]>();
  const placeStars = (m: Mate, on: boolean, t: number) => {
    let stars = starsFor.get(m);
    if (!stars) {
      if (!on) return;
      stars = [0, 1, 2].map(() => {
        const sprite = new THREE.Sprite(starMaterial);
        sprite.scale.setScalar(0.13);
        scene.add(sprite);
        return sprite;
      });
      starsFor.set(m, stars);
    }
    const top = m.head.getWorldPosition(new THREE.Vector3());
    stars.forEach((star, i) => {
      star.visible = on;
      if (!on) return;
      const a = t * 5 + (i * Math.PI * 2) / 3;
      star.position.set(top.x + Math.cos(a) * 0.32, top.y + 0.45 + Math.sin(a * 2) * 0.03, top.z + Math.sin(a) * 0.32);
    });
  };

  function pose(m: Mate, now: number, dt: number) {
    const e = m.emote;
    const t = e ? now - e.t0 : 0;
    if (e && t > EMOTE_LENGTH[e.name]) m.emote = null;
    const name = m.emote?.name;
    const p = e ? clamp01(t / EMOTE_LENGTH[e.name]) : 0;

    // Where they want to look
    const leaningOut = !!edge && edgeMate === m && !name;
    if (linkEl && !searching) {
      const rect = linkEl.getBoundingClientRect();
      const [x, y] = screenToNdc(rect.left + rect.width / 2, rect.top + rect.height / 2);
      toWorld(x, y, target);
    } else if (name === 'stumble' && m.emote?.from && now - m.emote.t0 > 0.6) {
      // Who did that?
      m.emote.from.head.getWorldPosition(target);
    } else if (edge === 'left' || edge === 'right') {
      target.set(edge === 'left' ? -6 : 6, 1.5, 1.5);
    } else if (edge === 'top') {
      target.set(m.home.x * 0.5, 5, 2);
    } else if (searching || typing) {
      const rect = inputRect();
      if (rect) {
        const [x, y] = screenToNdc(rect.left + rect.width * 0.4, rect.top + rect.height / 2);
        toWorld(x, y, target);
      } else toWorld(pointer.x, pointer.y, target);
    } else if (!pointerInside || now - lastMove > 6) {
      // Nobody about: they look round the room
      const k = Math.floor((now + m.phase * 3) / 1.6);
      target.set(Math.sin(k * 12.9898 + m.phase) * 3, 1.3 + Math.sin(k * 78.233) * 0.8, 2.5);
    } else {
      toWorld(pointer.x, pointer.y, target);
    }
    m.look.lerp(target, 1 - Math.exp(-dt * (m.habit === 'bouncy' ? 12 : 7)));

    // Body: turned part of the way towards it, breathing, hopping
    m.root.position.copy(m.home);
    const toLook = Math.atan2(m.look.x - m.home.x, m.look.z - m.home.z);
    const bodyYaw = toLook * 0.3;
    let yaw = bodyYaw;
    let lift = 0;
    let lean = typing && !name ? -0.08 : 0;
    let drop = 0;
    if (name === 'spin') yaw += Math.PI * 2 * smooth(0, 1, p);
    if (name === 'cheer') lift = 0.32 * Math.abs(Math.sin((t * Math.PI) / 0.45)) * (t < 1.35 ? 1 : 0);
    if (name === 'hop' || name === 'spin') lift = 0.28 * Math.sin(Math.PI * p);
    if (name === 'dance') {
      lift = 0.07 * Math.abs(Math.sin(t * 8));
      yaw += 0.35 * Math.sin(t * 4);
    }
    if (name === 'stretch') lean = 0.18 * Math.sin(Math.PI * p);
    if (name === 'sit') drop = 0.5 * smooth(0, 0.35, t);
    if (m.habit === 'bouncy' && !name) lift = 0.03 * Math.abs(Math.sin((now + m.phase) * 3));
    let roll = 0;
    if (leaningOut && edge !== 'top') {
      // Leaning out sideways to see past the edge
      roll = edge === 'left' ? 0.3 : -0.3;
      m.root.position.x += edge === 'left' ? -0.18 : 0.18;
    }
    if (name === 'dizzy') {
      const fade = 1 - p;
      roll = Math.sin(t * 5) * 0.1 * fade;
      yaw += Math.sin(t * 2.6) * 0.25 * fade;
      lean = Math.cos(t * 4) * 0.05 * fade;
    }
    if (name === 'stumble' && m.emote?.from) {
      // Knocked sideways, a wobble, then back to where they were
      const away = m.home.clone().sub(m.emote.from.home).setY(0).normalize();
      const knock = Math.sin(Math.PI * clamp01(t / 0.7));
      m.root.position.addScaledVector(away, 0.38 * knock);
      roll = -away.x * 0.35 * knock;
      lift = 0.05 * knock;
    }
    if (name === 'flex') lift = 0.04 * Math.abs(Math.sin(t * 6));
    m.root.position.y += lift - drop + FOOT_LIFT + Math.sin((now + m.phase) * 2) * 0.006;
    m.yaw = yaw;
    m.root.rotation.set(lean, Math.PI + yaw, roll, 'YXZ');

    m.actions.stand.setEffectiveWeight(1);
    m.mixer.update(0);
    m.root.updateMatrixWorld(true);
    side.setFromMatrixColumn(m.root.matrixWorld, 0).normalize();
    up.setFromMatrixColumn(m.root.matrixWorld, 1).normalize();
    facing.setFromMatrixColumn(m.root.matrixWorld, 2).normalize().negate();
    const centre = m.root.getWorldPosition(new THREE.Vector3());
    const outR = m.armR.getWorldPosition(new THREE.Vector3()).sub(centre).projectOnPlane(up).normalize();
    const outL = outR.clone().negate();
    const sway = Math.sin((now + m.phase) * 1.6) * 0.05;

    // Legs: only sitting changes them
    if (name === 'sit') {
      for (const [thigh, shin, spread] of [[m.thighF, m.shinF, 0.15], [m.thighB, m.shinB, -0.15]] as const) {
        shin.quaternion.identity();
        shin.updateWorldMatrix(false, true);
        pointBone(thigh, Y, dirOf([facing, 1], [side, spread], [DOWN, 0.1]));
        pointBone(shin, Y, dirOf([DOWN, 1], [facing, 0.2]));
      }
    }

    // Arms: what the emote wants, or their habit
    const down = (out: THREE.Vector3) => dirOf([DOWN, 1], [out, 0.12 + sway], [facing, 0.05]);
    switch (name) {
      case 'wave':
        arm(m.armR, m.foreR, dirOf([up, 1], [outR, 0.6], [facing, 0.15]), dirOf([up, 1], [outR, 0.65 * Math.sin(t * 14)], [facing, 0.1]));
        arm(m.armL, m.foreL, down(outL));
        break;
      case 'cheer':
      case 'stretch':
        arm(m.armR, m.foreR, dirOf([up, 1], [outR, 0.45]));
        arm(m.armL, m.foreL, dirOf([up, 1], [outL, 0.45]));
        break;
      case 'shrug':
        arm(m.armR, m.foreR, dirOf([DOWN, 0.4], [outR, 0.75], [facing, 0.4]), dirOf([up, 0.7], [facing, 0.5], [outR, 0.3]));
        arm(m.armL, m.foreL, dirOf([DOWN, 0.4], [outL, 0.75], [facing, 0.4]), dirOf([up, 0.7], [facing, 0.5], [outL, 0.3]));
        break;
      case 'facepalm':
        arm(m.armR, m.foreR, dirOf([facing, 0.6], [DOWN, 0.4], [outR, 0.2]), dirOf([up, 1], [outL, 0.45], [facing, 0.25]));
        arm(m.armL, m.foreL, down(outL));
        break;
      case 'think':
        arm(m.armR, m.foreR, dirOf([DOWN, 0.7], [facing, 0.55]), dirOf([up, 1], [outL, 0.35], [facing, 0.35]));
        arm(m.armL, m.foreL, dirOf([DOWN, 0.6], [facing, 0.5], [outR, 0.3]), dirOf([outR, 1], [facing, 0.3]));
        break;
      case 'dance': {
        const swap = Math.sin(t * 4) > 0;
        arm(m.armR, m.foreR, swap ? dirOf([up, 1], [outR, 0.5]) : dirOf([outR, 1], [DOWN, 0.2]));
        arm(m.armL, m.foreL, swap ? dirOf([outL, 1], [DOWN, 0.2]) : dirOf([up, 1], [outL, 0.5]));
        break;
      }
      case 'dizzy':
        // Arms a little out, loose, kept close so they don't swing into the next one
        arm(m.armR, m.foreR, dirOf([DOWN, 1], [outR, 0.35], [facing, 0.12 * Math.sin(t * 5)]));
        arm(m.armL, m.foreL, dirOf([DOWN, 1], [outL, 0.35], [facing, -0.12 * Math.sin(t * 5)]));
        break;
      case 'stumble':
        if (t < 0.7) {
          // Windmilling
          arm(m.armR, m.foreR, dirOf([outR, 1], [up, 0.4 + 0.5 * Math.sin(t * 22)]));
          arm(m.armL, m.foreL, dirOf([outL, 1], [up, 0.4 - 0.5 * Math.sin(t * 22)]));
        } else {
          // ...then hands on hips, unimpressed
          arm(m.armR, m.foreR, dirOf([DOWN, 0.6], [outR, 0.8]), dirOf([DOWN, 0.4], [outL, 0.9]));
          arm(m.armL, m.foreL, dirOf([DOWN, 0.6], [outL, 0.8]), dirOf([DOWN, 0.4], [outR, 0.9]));
        }
        break;
      case 'gg':
        // Thumbs up
        arm(m.armR, m.foreR, dirOf([facing, 0.8], [up, 0.3], [outR, 0.25]), dirOf([up, 1], [facing, 0.25]));
        arm(m.armL, m.foreL, down(outL));
        break;
      case 'flex':
        arm(m.armR, m.foreR, dirOf([outR, 1], [up, 0.15]), dirOf([up, 1], [outL, 0.15]));
        arm(m.armL, m.foreL, dirOf([outL, 1], [up, 0.15]), dirOf([up, 1], [outR, 0.15]));
        break;
      case 'money': {
        // Rubbing hands together
        const rub = 0.25 * Math.sin(t * 16);
        arm(m.armR, m.foreR, dirOf([DOWN, 0.6], [facing, 0.6], [outR, 0.1]), dirOf([outL, 1], [facing, 0.4], [up, rub]));
        arm(m.armL, m.foreL, dirOf([DOWN, 0.6], [facing, 0.6], [outL, 0.1]), dirOf([outR, 1], [facing, 0.4], [up, -rub]));
        break;
      }
      case 'sit':
        arm(m.armR, m.foreR, dirOf([DOWN, 0.8], [facing, -0.45], [outR, 0.25]));
        arm(m.armL, m.foreL, dirOf([DOWN, 0.8], [facing, -0.45], [outL, 0.25]));
        break;
      default:
        if (m.habit === 'crossed') {
          arm(m.armR, m.foreR, dirOf([DOWN, 0.75], [facing, 0.4], [outR, 0.15]), dirOf([outL, 1], [facing, 0.25], [up, 0.1]));
          arm(m.armL, m.foreL, dirOf([DOWN, 0.75], [facing, 0.45], [outL, 0.15]), dirOf([outR, 1], [facing, 0.3], [up, 0.05]));
        } else if (m.habit === 'hands-on-hips') {
          arm(m.armR, m.foreR, dirOf([DOWN, 0.6], [outR, 0.8]), dirOf([DOWN, 0.4], [outL, 0.9]));
          arm(m.armL, m.foreL, dirOf([DOWN, 0.6], [outL, 0.8]), dirOf([DOWN, 0.4], [outR, 0.9]));
        } else {
          arm(m.armR, m.foreR, down(outR));
          arm(m.armL, m.foreL, down(outL));
        }
    }

    // Pointing at the link box you're on, with whichever arm is nearer it
    if (linkEl && !searching && (!name || name === 'nod' || name === 'hop')) {
      const at = m.look.clone().sub(m.armR.getWorldPosition(new THREE.Vector3())).normalize();
      if (at.dot(outR) >= 0) arm(m.armR, m.foreR, at);
      else arm(m.armL, m.foreL, m.look.clone().sub(m.armL.getWorldPosition(new THREE.Vector3())).normalize());
    }
    // Hand over the eyes, looking up past the top of the window
    if (leaningOut && edge === 'top') arm(m.armR, m.foreR, dirOf([facing, 0.75], [up, 0.55], [outR, 0.25]), dirOf([outL, 1], [up, 0.2], [facing, 0.15]));

    // Head: on whatever they're looking at, but not past what a neck can do
    const headPos = m.head.getWorldPosition(new THREE.Vector3());
    const toTarget = tmp.copy(m.look).sub(headPos).normalize();
    const angle = toTarget.angleTo(facing);
    const maxTurn = 1.0;
    if (angle > maxTurn) toTarget.lerp(facing, 1 - maxTurn / angle).normalize();
    pointBone(m.head, Z, toTarget, 0.9);
    levelHead(m.head);
    if (name === 'nod') m.head.rotateX(Math.sin(p * Math.PI * 2) * 0.3);
    if (name === 'shrug') m.head.rotateY(Math.sin(t * 16) * 0.3 * (1 - p));
    if (name === 'facepalm') m.head.rotateX(0.35 * Math.sin(Math.PI * p));
    if (name === 'think') m.head.rotateZ(0.18);
    if (name === 'gg') m.head.rotateX(Math.sin(Math.min(1, t / 0.5) * Math.PI * 2) * 0.25);
    if (name === 'dizzy') m.head.rotateX(Math.cos(t * 6) * 0.1 * (1 - p));
    placeStars(m, name === 'dizzy' && p < 0.92, t);
    m.head.updateWorldMatrix(false, true);
  }

  // --- Boredom ----------------------------------------------------------------------------------------
  let nextBored = 7;
  const boredom = (now: number) => {
    if (typing || searching) return;
    const idleFor = now - lastMove;
    if (idleFor > nextBored) {
      nextBored = idleFor + 5 + Math.random() * 4;
      const free = mates.filter((m) => !m.emote);
      if (!free.length) return;
      const m = pick(free);
      play(m, pick<EmoteName>(['sit', 'stretch', 'dance', 'sit']));
    }
    if (idleFor < 1) nextBored = 7;
  };

  // --- Drawing ----------------------------------------------------------------------------------------
  const clock = new THREE.Clock();
  const tagPos = new THREE.Vector3();
  function draw(dt: number) {
    const now = clock.elapsedTime;
    for (const m of mates) pose(m, now, dt);
    renderer.render(scene, camera);
    // Name tags over their heads, like in a match
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const m of mates) {
      m.head.getWorldPosition(tagPos);
      tagPos.y += 0.55;
      tagPos.project(camera);
      m.tag.style.transform = `translate(${((tagPos.x + 1) / 2) * w}px, ${((1 - tagPos.y) / 2) * h}px) translate(-50%,-100%)`;
    }
  }

  // At most 30 frames a second; less if the machine is struggling
  let since = 0;
  let frameBudget = 1 / 30;
  let slow = 0;
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (!ready || still || !inView || document.hidden) return;
    since += dt;
    if (since < frameBudget) return;
    const step = Math.min(since, 0.1);
    since = 0;
    boredom(clock.elapsedTime);
    shakeMeter = Math.max(0, shakeMeter - step * 0.7);
    draw(step);
    frames++;
    if (step > 0.06) slow++;
    if (frames % 60 === 0) {
      if (slow > 30 && pixelRatio > 0.75) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
        frameBudget = 1 / 24;
      }
      slow = 0;
    }
  });

  return {
    react,
    dispose: () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      observer.disconnect();
      viewObserver.disconnect();
      owned.forEach((o) => o.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
    },
  };
}
