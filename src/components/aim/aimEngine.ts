import * as THREE from 'three';
import { GUN_ADS, adsFov, keyMatches, mouseButtonOf, radiansPerCount } from '../../utils/kirkaSettings';
import type { Gun, KirkaSettings } from '../../utils/kirkaSettings';

/**
 * The aim trainer's 3D side. Mouse look, aiming in and the zoom follow Kirka's client line for line
 * (see kirkaSettings.ts), so a flick here is the same flick in Kirka with the same settings.
 */

export type DrillId = 'gridshot' | 'flick' | 'tracking' | 'quickscope' | 'sens';

export interface DrillInfo {
  id: DrillId;
  name: string;
  blurb: string;
  /** Length in seconds; 0 runs until the player stops. */
  seconds: number;
  /** Ends early once this many are down. */
  kills?: number;
  /** Forces a gun, for the VITA drill. */
  gun?: Gun;
  /** Which way a better score goes. */
  better: 'higher' | 'lower';
  unit: string;
}

export const DRILLS: DrillInfo[] = [
  { id: 'gridshot', name: 'Gridshot', blurb: 'Three targets on a grid. Shoot one and another appears. Speed and accuracy.', seconds: 60, better: 'higher', unit: 'kills' },
  { id: 'flick', name: 'Flick', blurb: 'One target at a time, somewhere around you. Get to it fast.', seconds: 60, kills: 30, better: 'lower', unit: 'ms per kill' },
  { id: 'tracking', name: 'Tracking', blurb: 'A strafing, jumping target. Keep your crosshair on it.', seconds: 30, better: 'higher', unit: '% on target' },
  { id: 'quickscope', name: 'VITA Quickscope', blurb: 'Far, small targets with the VITA. Scope in, shoot, repeat.', seconds: 90, kills: 20, gun: 'VITA', better: 'lower', unit: 'ms per kill' },
  { id: 'sens', name: '360 check', blurb: 'No targets. Swipe a full turn here and in Kirka with the same mouse movement: they should land the same.', seconds: 0, better: 'higher', unit: '' },
];

export interface Hud {
  /** Seconds left, or seconds gone for an open-ended drill. */
  time: number;
  kills: number;
  shots: number;
  hits: number;
  /** Tracking: share of the time on target, 0 to 1. */
  onTarget: number;
  /** 360 check: how far the camera has turned, in degrees, signed. */
  turned: number;
  aimed: boolean;
  fov: number;
}

export interface DrillResult {
  drill: DrillId;
  gun: Gun;
  score: number;
  kills: number;
  shots: number;
  hits: number;
  seconds: number;
  avgKillMs: number;
  onTarget: number;
}

export type EngineState = 'idle' | 'running' | 'paused' | 'done';

export interface EngineEvents {
  onHud(h: Hud): void;
  onState(s: EngineState): void;
  onResult(r: DrillResult): void;
  /** Pointer lock was refused, usually because it was asked for too soon after leaving it. */
  onLockError(message: string): void;
  /** Whether Raw Input actually got through (the browser may not support it). */
  onRawInput(active: boolean): void;
}

export interface EngineOverlay {
  crosshair: HTMLElement;
  scope: HTMLElement;
  hitmarker: HTMLElement;
}

interface Target {
  mesh: THREE.Mesh;
  born: number;
  cell: number;
  dying: number;
  /** Tracking: angle around the player and how fast it's changing. */
  angle: number;
  speed: number;
  nextTurn: number;
  jump: number;
}

const EYE = 1.6;
const DEG = Math.PI / 180;

function gridTexture(base: string, line: string, cells = 4) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = line;
  const step = 128 / cells;
  for (let i = 0; i < cells; i++) {
    g.fillRect(i * step, 0, 2, 128);
    g.fillRect(0, i * step, 128, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class AimEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private host: HTMLElement;
  private overlay: EngineOverlay;
  private events: EngineEvents;
  private settings: KirkaSettings;
  private chosenGun: Gun = 'AR-9';
  private drill: DrillInfo = DRILLS[0];
  private state: EngineState = 'idle';

  private yaw = 0;
  private pitch = 0;
  private turned = 0;
  private lastMove: { x: number; y: number } | null = null;

  private aimKey = false;
  private aimMouse = false;
  private fireHeld = false;
  private adsTime = 0;
  private fullyAimed = false;
  private scopeShown = false;

  private targets: Target[] = [];
  private recentCells: number[] = [];
  private targetGeo = new THREE.SphereGeometry(1, 24, 16);
  private targetMat = new THREE.MeshLambertMaterial({ color: 0xff4d5a, emissive: 0x5a0d14 });
  private pillars = new THREE.Group();
  private clock = 0;
  private kills = 0;
  private shots = 0;
  private hits = 0;
  private killTimes: number[] = [];
  private onTargetTime = 0;
  private trackTick = 0;
  private hudAt = 0;

  private frame = 0;
  private last = 0;
  private audio: AudioContext | null = null;
  muted = false;
  private resize: ResizeObserver;
  private disposers: (() => void)[] = [];

  constructor(host: HTMLElement, overlay: EngineOverlay, events: EngineEvents, settings: KirkaSettings) {
    this.host = host;
    this.overlay = overlay;
    this.events = events;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(settings.mainFov, 16 / 9, 0.05, 400);
    this.camera.position.set(0, EYE, 0);
    this.camera.rotation.order = 'YXZ';
    this.buildWorld();

    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.bindInput();
    this.render();
  }

  // ---------------------------------------------------------------- world

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x8fc3f2);
    s.fog = new THREE.Fog(0x8fc3f2, 60, 160);
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(20, 40, 10);
    s.add(sun);

    const floorTex = gridTexture('#b9bcc4', '#a3a7b1');
    floorTex.repeat.set(40, 40);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);

    // A ring of walls, far enough away to stay out of the drills
    const wallTex = gridTexture('#d6d1c4', '#c3bdae');
    wallTex.repeat.set(20, 4);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
    for (let i = 0; i < 4; i++) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 16), wallMat);
      const a = (i * Math.PI) / 2;
      wall.position.set(-Math.sin(a) * 40, 8, -Math.cos(a) * 40);
      wall.rotation.y = a;
      s.add(wall);
    }

    // Markers for the 360 check: red straight ahead, then one every quarter turn
    const colors = [0xff4d5a, 0xf5c518, 0x4da3ff, 0x2ee68f];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 30, 0.5), new THREE.MeshBasicMaterial({ color: colors[i] }));
      p.position.set(-Math.sin(a) * 20, 15, -Math.cos(a) * 20);
      this.pillars.add(p);
    }
    const thin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 30, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    thin.position.set(0, 15, -19.6);
    this.pillars.add(thin);
    this.pillars.visible = false;
    s.add(this.pillars);
  }

  private fit() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.state !== 'running') this.render();
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- settings

  setSettings(settings: KirkaSettings, gun: Gun) {
    this.settings = settings;
    this.chosenGun = gun;
    if (!this.fullyAimed) this.camera.fov = settings.mainFov;
    this.camera.updateProjectionMatrix();
    if (this.state !== 'running') this.render();
  }

  get gun(): Gun {
    return this.drill.gun ?? this.chosenGun;
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    const canvas = this.renderer.domElement;
    const on = <K extends keyof DocumentEventMap>(target: Document | Window, type: K, fn: (e: DocumentEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on(document, 'pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (locked && (this.state === 'paused' || this.state === 'idle')) this.setState('running');
      else if (!locked && this.state === 'running') {
        this.aimKey = this.aimMouse = this.fireHeld = false;
        this.setState('paused');
      }
    });
    on(document, 'pointerlockerror', () => this.events.onLockError('The browser needs a second before it can lock the mouse again. Click once more.'));
    on(document, 'mousemove', (e) => {
      if (this.state !== 'running') return;
      this.look(e.movementX || 0, e.movementY || 0);
    });
    on(document, 'mousedown', (e) => {
      if (this.state !== 'running') return;
      const { aim, shoot } = this.settings.keys;
      if (e.button === 2 || e.button === mouseButtonOf(aim)) this.aimMouse = true;
      if (e.button === 0 || e.button === mouseButtonOf(shoot)) this.pullTrigger();
    });
    on(document, 'mouseup', (e) => {
      const { aim, shoot } = this.settings.keys;
      if (e.button === 2 || e.button === mouseButtonOf(aim)) this.aimMouse = false;
      if (e.button === 0 || e.button === mouseButtonOf(shoot)) this.fireHeld = false;
    });
    on(window, 'keydown', (e) => {
      if (this.state !== 'running') return;
      const { aim, shoot } = this.settings.keys;
      if (keyMatches(aim, e)) {
        this.aimKey = true;
        e.preventDefault();
      }
      if (keyMatches(shoot, e) && !e.repeat) {
        this.pullTrigger();
        e.preventDefault();
      }
    });
    on(window, 'keyup', (e) => {
      const { aim, shoot } = this.settings.keys;
      if (keyMatches(aim, e)) this.aimKey = false;
      if (keyMatches(shoot, e)) this.fireHeld = false;
    });
    const noMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', noMenu);
    this.disposers.push(() => canvas.removeEventListener('contextmenu', noMenu));
  }

  /** Kirka's mouse look, step for step. */
  private look(mx: number, my: number) {
    const s = this.settings;
    if (s.flickProtection) {
      if (this.lastMove && (Math.abs(mx) > s.flickX || Math.abs(my) > s.flickY)) {
        mx = this.lastMove.x;
        my = this.lastMove.y;
      } else {
        this.lastMove = { x: mx, y: my };
      }
    }
    const sens = this.fullyAimed ? s.aimSensitivity : s.sensitivity;
    const factor = radiansPerCount(sens, this.camera.fov, s.mainFov);
    this.yaw = (this.yaw - mx * factor) % 6.283;
    this.turned -= mx * factor;
    this.pitch = Math.min(1.57, Math.max(-1.57, this.pitch - my * factor));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Asks for the mouse. Has to be called from a click. */
  async lock() {
    const canvas = this.renderer.domElement as HTMLCanvasElement & { requestPointerLock(o?: { unadjustedMovement?: boolean }): Promise<void> | void };
    this.ensureAudio();
    if (this.settings.rawInput) {
      try {
        await canvas.requestPointerLock({ unadjustedMovement: true });
        this.events.onRawInput(true);
        return;
      } catch (err) {
        if ((err as Error)?.name !== 'NotSupportedError') {
          this.events.onLockError('The browser needs a second before it can lock the mouse again. Click once more.');
          return;
        }
      }
    }
    try {
      await canvas.requestPointerLock();
      this.events.onRawInput(false);
    } catch {
      this.events.onLockError('The browser needs a second before it can lock the mouse again. Click once more.');
    }
  }

  // ---------------------------------------------------------------- drills

  /** Sets a drill up. It starts running once the mouse is locked. */
  prepare(id: DrillId) {
    this.drill = DRILLS.find((d) => d.id === id) ?? DRILLS[0];
    for (const t of this.targets) this.scene.remove(t.mesh);
    this.targets = [];
    this.recentCells = [];
    this.clock = this.kills = this.shots = this.hits = this.onTargetTime = this.trackTick = 0;
    this.killTimes = [];
    this.yaw = this.pitch = this.turned = 0;
    this.lastMove = null;
    this.adsTime = 0;
    this.fullyAimed = this.scopeShown = false;
    this.camera.fov = this.settings.mainFov;
    this.camera.updateProjectionMatrix();
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.pillars.visible = id === 'sens';
    if (id === 'gridshot') for (let i = 0; i < 3; i++) this.spawn();
    else if (id !== 'sens') this.spawn();
    this.applyOverlay(0);
    this.setState('idle');
    this.emitHud();
    this.render();
  }

  /** Stops the drill and reports it. */
  finish() {
    if (this.state === 'done') return;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    const d = this.drill;
    const avgKillMs = this.killTimes.length ? (this.killTimes.reduce((a, b) => a + b, 0) / this.killTimes.length) * 1000 : 0;
    const onTarget = this.clock > 0 ? this.onTargetTime / this.clock : 0;
    const score = d.id === 'gridshot' ? this.kills : d.id === 'tracking' ? Math.round(onTarget * 1000) / 10 : d.id === 'sens' ? 0 : Math.round(avgKillMs);
    this.setState('done');
    if (d.id !== 'sens' && this.clock > 1) {
      this.events.onResult({ drill: d.id, gun: this.gun, score, kills: this.kills, shots: this.shots, hits: this.hits, seconds: this.clock, avgKillMs, onTarget });
    }
  }

  private setState(s: EngineState) {
    this.state = s;
    this.events.onState(s);
    cancelAnimationFrame(this.frame);
    if (s === 'running') {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.render();
    }
  }

  private spawn() {
    const d = this.drill.id;
    const mesh = new THREE.Mesh(this.targetGeo, this.targetMat);
    const t: Target = { mesh, born: this.clock, cell: -1, dying: 0, angle: 0, speed: 0, nextTurn: 0, jump: 0 };
    if (d === 'gridshot') {
      // a 5 x 5 grid on the wall ahead, its bottom row clear of the floor. Random, but never a cell
      // that's showing or one of the last few used, so it can't fall into a back-and-forth
      const taken = new Set([...this.targets.map((o) => o.cell), ...this.recentCells]);
      let cell = 0;
      do cell = Math.floor(Math.random() * 25);
      while (taken.has(cell));
      t.cell = cell;
      this.recentCells = [...this.recentCells, cell].slice(-4);
      const col = (cell % 5) - 2;
      const row = Math.floor(cell / 5) - 2;
      mesh.scale.setScalar(0.42);
      mesh.position.set(col * 1.2, 3.0 + row * 1.1, -14);
    } else if (d === 'flick' || d === 'quickscope') {
      const far = d === 'quickscope' ? 32 : 14;
      const radius = d === 'quickscope' ? 0.42 : 0.38;
      // low enough to stay above the floor, and far enough from the crosshair to be a real flick
      const lowest = Math.asin((radius + 0.3 - EYE) / far) / DEG;
      const spread = d === 'quickscope' ? 45 : 40;
      let yaw = 0;
      let pitch = 0;
      for (let tries = 0; tries < 20; tries++) {
        yaw = this.yaw + (Math.random() * 2 - 1) * spread * DEG;
        pitch = (lowest + Math.random() * (14 - lowest)) * DEG;
        if (Math.hypot(yaw - this.yaw, pitch - this.pitch) > 12 * DEG) break;
      }
      mesh.scale.setScalar(radius);
      mesh.position.set(-Math.sin(yaw) * Math.cos(pitch) * far, EYE + Math.sin(pitch) * far, -Math.cos(yaw) * Math.cos(pitch) * far);
    } else if (d === 'tracking') {
      mesh.scale.setScalar(0.5);
      t.speed = 18 * DEG;
      t.nextTurn = 0.6;
      this.placeTracker(t);
    }
    this.scene.add(mesh);
    this.targets.push(t);
  }

  private placeTracker(t: Target) {
    const r = 12;
    const lift = t.jump > 0 ? Math.sin((1 - t.jump / 0.7) * Math.PI) * 1.4 : 0;
    t.mesh.position.set(-Math.sin(t.angle) * r, EYE + lift, -Math.cos(t.angle) * r);
  }

  private pullTrigger() {
    if (this.drill.id === 'sens') return;
    this.fireHeld = true;
    if (this.drill.id === 'tracking') return; // tracking fires on its own while held
    this.shoot();
  }

  private shoot() {
    this.shots++;
    this.click(0.04, 160);
    const dir = new THREE.Vector2(0, 0);
    // The VITA is wildly off unless scoped in, as in Kirka
    if (GUN_ADS[this.gun].scope && !this.fullyAimed) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.35;
      dir.set(Math.cos(a) * r, Math.sin(a) * r);
    }
    // the mouse may have moved since the last frame: shoot where the crosshair is now
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(dir, this.camera);
    const live = this.targets.filter((t) => !t.dying);
    const hit = this.raycaster.intersectObjects(live.map((t) => t.mesh), false)[0];
    if (!hit) return;
    const target = live.find((t) => t.mesh === hit.object)!;
    this.hits++;
    this.kills++;
    this.killTimes.push(this.clock - target.born);
    target.dying = 0.09;
    this.ding();
    this.flashHitmarker();
    this.spawn();
    if (this.drill.kills && this.kills >= this.drill.kills) this.finish();
  }

  private onTarget(): boolean {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    return this.raycaster.intersectObjects(this.targets.map((t) => t.mesh), false).length > 0;
  }

  private tick = (now: number) => {
    if (this.state !== 'running') return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    this.updateAds(dt);

    for (const t of [...this.targets]) {
      if (t.dying) {
        t.dying -= dt;
        t.mesh.scale.multiplyScalar(0.7);
        if (t.dying <= 0) {
          this.scene.remove(t.mesh);
          this.targets.splice(this.targets.indexOf(t), 1);
        }
      }
    }

    if (this.drill.id === 'tracking') {
      const t = this.targets[0];
      if (t) {
        t.nextTurn -= dt;
        if (t.nextTurn <= 0) {
          // strafe the other way, at a new speed, now and then with a jump
          t.speed = -Math.sign(t.speed || 1) * (12 + Math.random() * 22) * DEG;
          t.nextTurn = 0.35 + Math.random() * 0.9;
          if (Math.random() < 0.3) t.jump = 0.7;
        }
        t.angle += t.speed * dt;
        if (Math.abs(t.angle) > 50 * DEG) t.speed = -Math.sign(t.angle) * Math.abs(t.speed);
        if (t.jump > 0) t.jump = Math.max(0, t.jump - dt);
        this.placeTracker(t);
        const on = this.onTarget();
        if (on) this.onTargetTime += dt;
        if (this.fireHeld) {
          this.trackTick -= dt;
          if (this.trackTick <= 0) {
            this.trackTick = 0.1;
            this.shots++;
            if (on) {
              this.hits++;
              this.ding();
              this.flashHitmarker();
            }
          }
        }
      }
    }

    if (now - this.hudAt > 90) {
      this.hudAt = now;
      this.emitHud();
    }
    this.render();
    if (this.drill.seconds && this.clock >= this.drill.seconds) {
      this.finish();
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  /** Aiming in and out, and what it does to the FOV and the overlays: Kirka's rules. */
  private updateAds(dt: number) {
    const gun = this.gun;
    const ads = GUN_ADS[gun];
    const held = this.aimKey || this.aimMouse;
    this.adsTime = held ? Math.min(ads.time, this.adsTime + dt) : Math.max(0, this.adsTime - dt);
    const p = this.adsTime / ads.time;
    if (held && p >= 1) this.fullyAimed = true;
    if (!held) this.fullyAimed = false;

    let fov: number;
    if (ads.scope) {
      this.scopeShown = this.fullyAimed;
      fov = this.settings.sniper.smoothFov ? adsFov(this.settings, gun, p) : this.scopeShown ? adsFov(this.settings, gun, 1) : this.settings.mainFov;
    } else {
      this.scopeShown = false;
      fov = adsFov(this.settings, gun, p);
    }
    if (fov !== this.camera.fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.applyOverlay(p);
  }

  private applyOverlay(p: number) {
    const s = this.settings;
    const ironSights = s.ironSights && !GUN_ADS[this.gun].scope;
    const opacity = this.scopeShown ? 0 : ironSights ? 1 - p : 1;
    this.overlay.crosshair.style.opacity = String(opacity);
    this.overlay.scope.style.display = this.scopeShown ? 'block' : 'none';
  }

  private flashHitmarker() {
    if (!this.settings.hitmarker.enabled) return;
    const el = this.overlay.hitmarker;
    el.style.transition = 'none';
    el.style.opacity = '1';
    void el.offsetWidth;
    el.style.transition = `opacity ${this.settings.hitmarker.fade}ms linear`;
    el.style.opacity = '0';
  }

  private emitHud() {
    const d = this.drill;
    this.events.onHud({
      time: d.seconds ? Math.max(0, d.seconds - this.clock) : this.clock,
      kills: this.kills,
      shots: this.shots,
      hits: this.hits,
      onTarget: this.clock > 0 ? this.onTargetTime / this.clock : 0,
      turned: this.turned / DEG,
      aimed: this.fullyAimed,
      fov: this.camera.fov,
    });
  }

  // ---------------------------------------------------------------- sound

  private ensureAudio() {
    if (this.audio) {
      void this.audio.resume();
      return;
    }
    try {
      this.audio = new AudioContext();
    } catch {
      this.audio = null;
    }
  }

  private click(length: number, freq: number) {
    if (this.muted || !this.audio) return;
    const a = this.audio;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.04, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + length);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + length);
  }

  private ding() {
    if (this.muted || !this.audio) return;
    const a = this.audio;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1180, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, a.currentTime + 0.06);
    g.gain.setValueAtTime(0.09, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.09);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.1);
  }

  // ---------------------------------------------------------------- cleanup

  dispose() {
    cancelAnimationFrame(this.frame);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.resize.disconnect();
    for (const d of this.disposers) d();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        (mat as THREE.MeshLambertMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.targetGeo.dispose();
    this.targetMat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    void this.audio?.close();
  }
}
