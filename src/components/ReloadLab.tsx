import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Pause, Play, RotateCcw, Loader2, Upload } from 'lucide-react';
import { SkinPicker } from './SkinPicker';
import type { PickerOption } from './SkinPicker';
import { getModelUrl, loadSkinTexture } from './Weapon3DViewer';

// Public page: the custom reload/inspect animations played on the official Kirka models with any skin.
// Gun only - the arm rig stays out of the viewer, it reads as flat slabs at this camera distance.
const WEAPONS = {
  SCAR: { file: 'reload/scar-reload.glb', camSide: 1 },
  'AR-9': { file: 'reload/ar9-reload.glb', camSide: 1 },
  LAR: { file: 'reload/lar-reload.glb', camSide: 1 },
  // handZoom pulls the first-person camera in for weapons shorter than the rifle it was fitted on
  'MAC-10': { file: 'reload/mac10-reload.glb', camSide: 1, pistol: true, handZoom: 0.7 },
  M60: { file: 'reload/m60-reload.glb', camSide: 1 },
  VITA: { file: 'reload/vita-reload.glb', camSide: 1 },
  Weatie: { file: 'reload/weatie-reload.glb', camSide: 1 },
  Revolver: { file: 'reload/revolver-reload.glb', camSide: 1, pistol: true },
  Shark: { file: 'reload/shark-reload.glb', camSide: 1, pistol: true },
  Bayonet: { file: 'reload/bayonet-inspect.glb', camSide: 1, knife: true }, // inspect animation, not a reload
  Tomahawk: { file: 'reload/tomahawk-inspect.glb', camSide: 1, knife: true }, // inspect animation
} as const;
// parts added for the reloads (not on Kirka's models) get a fixed look instead of a skin texture
const ADDED_PART_COLORS: Record<string, number> = { Empty_casings: 0xc9a24a, Fresh_rounds: 0xd9b25a, Spent_shell: 0xb3262b };
type WeaponName = keyof typeof WEAPONS;

const DEFAULT = '__default__';
const PLAIN = '__plain__';
const MINE = '__mine__';          // a PNG the visitor dropped in themselves
const MAX_UPLOAD = 12 * 1024 * 1024;
const SPEEDS = [1, 0.5, 0.25];
type View = 'hands' | 'side';

interface ReloadLabProps {
  catalog: any[];
}

const sameName = (a?: string | null, b?: string | null) => (a || '').toLowerCase() === (b || '').toLowerCase();

export const ReloadLab: React.FC<ReloadLabProps> = ({ catalog }) => {
  const [weapon, setWeapon] = useState<WeaponName>('SCAR');
  const [skin, setSkin] = useState<string>(DEFAULT);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  // side view first: without the arm rig the first-person view is a lot harder to read
  const [view, setView] = useState<View>('side');
  const restBox = useRef<THREE.Box3 | null>(null);
  // a skin the visitor loaded from their own machine; the blob URL is revoked when it is replaced
  const [ownSkin, setOwnSkin] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [time, setTime] = useState({ t: 0, d: 0 });

  const mountRef = useRef<HTMLDivElement>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    model: THREE.Group | null;
    mixer: THREE.AnimationMixer | null;
    action: THREE.AnimationAction | null;
  } | null>(null);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  playingRef.current = playing;
  speedRef.current = speed;

  const skins = useMemo(
    () =>
      catalog
        .filter((c) => c?.type === 'WEAPON_SKIN' && sameName(c.parent?.name, weapon))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalog, weapon]
  );
  const options: PickerOption[] = useMemo(
    () => [
      { key: DEFAULT, label: `Default ${weapon}` },
      { key: PLAIN, label: 'Plain grey (no skin)' },
      ...(ownSkin ? [{ key: MINE, label: ownSkin.name, sublabel: 'your upload', badge: 'YOURS' }] : []),
      ...skins.map((s) => ({ key: s.name, label: s.name, sublabel: s.rarity ? String(s.rarity).toLowerCase() : undefined })),
    ],
    [skins, weapon, ownSkin]
  );

  // Scene setup once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2d35, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-1, 2, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb6ff, 1.0);
    rim.position.set(2, 1, -2);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.05;
    controls.maxDistance = 4;

    three.current = { renderer, scene, camera, controls, model: null, mixer: null, action: null };

    const resize = () => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0, lastUi = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      const s = three.current;
      if (!s) return;
      if (s.mixer && playingRef.current) s.mixer.update(dt * speedRef.current);
      controls.update();
      renderer.render(scene, camera);
      const now = performance.now();
      if (s.action && now - lastUi > 50) {
        lastUi = now;
        const d = s.action.getClip().duration;
        setTime({ t: s.action.time % d, d });
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  // Place the camera: 'hands' = first person like in game (gun low on the right, looking down the barrel), 'side' = side view
  const frame = () => {
    const s = three.current, box = restBox.current;
    if (!s || !box) return;
    const c = box.getCenter(new THREE.Vector3());
    const dims = box.getSize(new THREE.Vector3());
    const L = Math.max(dims.x, dims.y, dims.z);
    const w = WEAPONS[weapon] as { camSide: number; knife?: boolean; pistol?: boolean; handZoom?: number };
    // the knife tilts forward and to the right in the hand (display only, the clip is untouched)
    if (s.model) s.model.rotation.set(view === 'hands' && w.knife ? -0.6 : 0, 0, view === 'hands' && w.knife ? -0.3 : 0);
    if (view === 'side') {
      s.camera.fov = 34;
      s.controls.target.copy(c);
      s.camera.position.copy(c).add(new THREE.Vector3(-0.05, 0.22, w.camSide).normalize().multiplyScalar(dims.length() * 1.25));
    } else if (w.knife) {
      // knife held up in front of you: blade up, hand low on the right
      s.camera.fov = 60;
      s.camera.position.set(c.x - 0.45 * L, c.y + 0.5 * L, c.z + 1.2 * L);
      s.controls.target.set(c.x - 0.45 * L, c.y + 0.28 * L, c.z - 1.5 * L);
    } else {
      // Kirka's own first-person camera, fitted against an in-game screenshot: the muzzle and the back of the
      // receiver land where the game draws them, so this view can be compared with the game directly.
      // Every model shares an origin at the grip, so a short weapon only needs the whole rig pulled in
      // towards that point to fill the frame the same way.
      s.camera.fov = 55;
      const grip = new THREE.Vector3(0.3, 0, 0);
      const zoom = w.handZoom ?? 1;
      s.camera.position.copy(grip).addScaledVector(new THREE.Vector3(0.597, 0.097, 0.258).sub(grip), zoom);
      s.controls.target.copy(grip).addScaledVector(new THREE.Vector3(-1.943, 0.325, -0.027).sub(grip), zoom);
    }
    s.camera.updateProjectionMatrix();
    s.controls.update();
  };
  useEffect(frame, [view]);

  // Load the weapon's reload GLB
  useEffect(() => {
    const s = three.current;
    if (!s) return;
    let cancelled = false;
    setLoading(true);
    setStatus(null);
    new GLTFLoader().load(
      getModelUrl(WEAPONS[weapon].file),
      (gltf) => {
        if (cancelled || !three.current) return;
        if (s.model) s.scene.remove(s.model);
        s.model = gltf.scene;
        s.scene.add(gltf.scene);
        s.mixer = new THREE.AnimationMixer(gltf.scene);
        s.action = s.mixer.clipAction(gltf.animations[0]);
        s.action.play();

        restBox.current = new THREE.Box3().setFromObject(gltf.scene);
        frame();
        setLoading(false);
      },
      undefined,
      () => {
        if (!cancelled) { setLoading(false); setStatus('Could not load the reload model.'); }
      }
    );
    return () => { cancelled = true; };
  }, [weapon]);

  // Apply the selected skin to every part of the gun
  useEffect(() => {
    const s = three.current;
    if (!s || loading || !s.model) return;
    let cancelled = false;
    const apply = (map: THREE.Texture | null) => {
      s.model!.traverse((o: any) => {
        if (!o.isMesh) return;
        const added = ADDED_PART_COLORS[o.name] ?? ADDED_PART_COLORS[o.parent?.name];
        if (added !== undefined) {
          o.material = new THREE.MeshStandardMaterial({ color: added, metalness: 0.6, roughness: 0.35 });
          return;
        }
        o.material = new THREE.MeshStandardMaterial({
          map,
          color: map ? 0xffffff : 0x55595f,
          metalness: 0.1,
          roughness: map ? 0.65 : 0.8,
          side: THREE.DoubleSide,
        });
      });
    };
    if (skin === PLAIN) { apply(null); setStatus(null); return; }
    if (skin === MINE) {
      if (!ownSkin) { apply(null); return; }
      setStatus('Loading your skin...');
      loadSkinTexture(ownSkin.url).then((tex) => {
        if (cancelled) return;
        apply(tex);
        setStatus(tex ? null : 'That image could not be read as a texture.');
      });
      return () => { cancelled = true; };
    }
    const item = skin === DEFAULT
      ? catalog.find((c) => String(c.type || '').startsWith('WEAPON_') && sameName(c.name, weapon))
      : skins.find((c) => c.name === skin);
    setStatus('Loading skin...');
    loadSkinTexture(item?.textureUrl, skin === DEFAULT ? undefined : skin).then((tex) => {
      if (cancelled) return;
      apply(tex);
      setStatus(tex ? null : 'This skin has no texture available, showing plain grey.');
    });
    return () => { cancelled = true; };
  }, [skin, weapon, loading, catalog, skins, ownSkin]);

  // Load a texture straight off the visitor's machine. It never leaves the browser: the file is
  // turned into a blob URL and handed to the same loader the catalog skins use.
  const pickFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { setStatus('That file is not an image. Export your skin as a PNG.'); return; }
    if (file.size > MAX_UPLOAD) { setStatus('That image is over 12 MB — export it at 1024 or 2048 wide.'); return; }
    setOwnSkin({ url: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, '') });
    setSkin(MINE);
    setStatus(null);
  };

  // release each blob once it has been replaced, and the last one when the page goes away
  useEffect(() => () => { if (ownSkin) URL.revokeObjectURL(ownSkin.url); }, [ownSkin]);

  const restart = () => {
    const a = three.current?.action;
    if (a) { a.time = 0; setPlaying(true); }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 py-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Reload Lab</h1>
          <p className="text-sm text-slate-400">
            Reload and inspect animations built by XPERT, playing on Kirka's own weapon models. Pick a gun, then any skin
            in the game.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WEAPONS) as WeaponName[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => { setWeapon(w); setSkin(DEFAULT); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${weapon === w ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div
          className={`relative rounded-2xl border bg-gradient-to-b from-[#1b1e27] to-[#0d0f14] overflow-hidden aspect-[16/10] transition-colors ${dragging ? 'border-indigo-400' : 'border-white/10'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
        >
          <div ref={mountRef} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 grid place-items-center text-slate-300">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          <div className="absolute left-3 bottom-3 right-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPlaying((p) => !p)} className="px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white text-sm font-semibold flex items-center gap-1.5">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={restart} className="px-3 py-2 rounded-lg bg-black/50 border border-white/15 text-white text-sm font-semibold flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" />Restart
            </button>
            <div className="flex rounded-lg overflow-hidden border border-white/15">
              {SPEEDS.map((sp) => (
                <button key={sp} type="button" onClick={() => setSpeed(sp)} className={`px-3 py-2 text-sm font-semibold ${speed === sp ? 'bg-indigo-500 text-white' : 'bg-black/50 text-slate-300'}`}>
                  {sp === 1 ? '1×' : sp === 0.5 ? '½×' : '¼×'}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg overflow-hidden border border-white/15">
              {(['hands', 'side'] as View[]).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`px-3 py-2 text-sm font-semibold ${view === v ? 'bg-indigo-500 text-white' : 'bg-black/50 text-slate-300'}`}>
                  {v === 'hands' ? 'In hand' : 'Side'}
                </button>
              ))}
            </div>
            <span className="ml-auto font-mono text-xs text-slate-300 bg-black/50 rounded-md px-2 py-1 tabular-nums">
              {time.t.toFixed(2)}s / {time.d.toFixed(2)}s
            </span>
          </div>
        </div>

        <aside className="space-y-3">
          <SkinPicker label={`${weapon} skin`} options={options} value={skin} onChange={setSkin} />
          <p className="text-xs text-slate-400">{catalog.length === 0 ? `Loading the skin catalog from Kirka... the list fills in when it arrives.` : `${skins.length} ${weapon} skins in the catalog. Drag to orbit, scroll to zoom.`}</p>
          {status && <p className="text-xs text-amber-300">{status}</p>}

          {/* Try your own texture. Nothing is uploaded anywhere — it is read straight off the disk. */}
          <div className="rounded-xl border border-dashed border-indigo-500/30 bg-indigo-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-indigo-300">
              <Upload className="w-3.5 h-3.5" />Test your own skin
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/webp,image/jpeg"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold transition cursor-pointer"
            >
              {ownSkin ? 'Choose another PNG' : 'Choose a PNG'}
            </button>
            {ownSkin ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-300 truncate" title={ownSkin.name}>{ownSkin.name}</span>
                <button
                  type="button"
                  onClick={() => { setOwnSkin(null); if (skin === MINE) setSkin(DEFAULT); }}
                  className="text-xs text-slate-400 hover:text-white shrink-0 cursor-pointer"
                >
                  remove
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Or drop a file on the viewer. Paint on the {weapon} template at 1024 or 2048, export a PNG, and watch it
                reload. Your file stays in your browser.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
