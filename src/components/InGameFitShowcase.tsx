import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Crosshair, Loader2 } from 'lucide-react';
import type { UserProfile, UserInventoryItem } from '../utils/api';
import {
  getProxiedTextureUrl,
  cleanTextureUrl,
  getModelFileName,
  getModelUrl,
  getSkinRenderUrl,
  isPlaceholderUrl,
  loadSkinTexture,
  loadWeaponModel,
} from './Weapon3DViewer';

export interface FitOverrides {
  character?: LoadoutItem | null;
  primary?: LoadoutItem | null;
  secondary?: LoadoutItem | null;
  melee?: LoadoutItem | null;
}

interface InGameFitShowcaseProps {
  profile: UserProfile;
  inventory: UserInventoryItem[];
  catalog?: any[];
  overrides?: FitOverrides;
  onInspectItem?: (name: string, type?: string, amount?: number, textureUrl?: string | null) => void;
}

export type LoadoutItem = {
  name: string;
  type?: string;
  parent?: { name: string; type?: string } | null;
  renderUrl?: string | null;
  textureUrl?: string | null;
};

export type FitPose = 'pose1' | 'pose2' | 'pose3';

const PRIMARY_WEAPONS = ['SCAR', 'VITA', 'AR-9', 'LAR', 'M60', 'MAC-10', 'WEATIE', 'REVOLVER'];
const SECONDARY_WEAPONS = ['SHARK', 'PISTOL'];
const MELEE_WEAPONS = ['TOMAHAWK', 'BAYONET', 'KNIFE'];

// Kirka's lobby character rig (from kirka.io). Each "poseN" animation has a matching "poseN"
// empty that the weapon is parented to, with the weapon's "Lever" empty (grip) placed on it.
const CHARACTER_MODEL = 'KirkaCharacter.glb';
const CHARACTER_SCALE = 1.65;
const ANIMATION_SPEED = 0.75;

// Per-weapon scale applied on the pose empty (kirka.io uses a per-weapon table in the same range)
const WEAPON_SCALE: Record<string, number> = {
  'SCAR.glb': 2.8,
  'VITA.glb': 2.4,
  'AR-9.glb': 2.7,
  'LAR.glb': 3,
  'M60.glb': 2.7,
  'MAC-10.glb': 3,
  'Weatie.glb': 3,
  'Revolver.glb': 1.6,
  'Shark.glb': 1.6,
  'Tomahawk.glb': 5,
  'Bayonet.glb': 5,
};

function cleanName(name?: string | null): string {
  return (name || '').replace(/^_+/, '').trim();
}

function findCatalogItem(catalog: any[], name: string, predicate?: (item: any) => boolean) {
  const lower = cleanName(name).toLowerCase();
  if (!lower) return null;
  return catalog.find((c) => c?.name && cleanName(c.name).toLowerCase() === lower && (!predicate || predicate(c))) || null;
}

function slotRenderUrl(item: LoadoutItem | null, catalog: any[]): string | null {
  if (!item) return null;
  if (item.renderUrl && !isPlaceholderUrl(item.renderUrl)) return cleanTextureUrl(item.renderUrl);
  const match = findCatalogItem(catalog, item.name, (c) => !item.parent?.name || cleanName(c.parent?.name).toUpperCase() === cleanName(item.parent?.name).toUpperCase());
  if (match?.renderUrl && !isPlaceholderUrl(match.renderUrl)) return cleanTextureUrl(match.renderUrl);
  return getSkinRenderUrl(item);
}

function loadCharacterTexture(url: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(
      getProxiedTextureUrl(url),
      (tex) => {
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

export const InGameFitShowcase: React.FC<InGameFitShowcaseProps> = ({ profile, inventory, catalog = [], overrides = {}, onInspectItem }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState<FitPose>('pose1');
  const [loading, setLoading] = useState(true);
  const sceneApiRef = useRef<{ setPose: (pose: FitPose) => void } | null>(null);

  // 1. Equipped character skin texture
  const charTextureUrl = useMemo(() => {
    const selectedBody = inventory.find((inv) => inv.isSelected && inv.item.type === 'BODY_SKIN')?.item;
    const body = overrides.character || profile.activeBodySkin || selectedBody;
    if (!body?.name) return null;
    const match = findCatalogItem(catalog, body.name, (c) => c.type === 'BODY_SKIN' || c.type === 'CHARACTER');
    const tex = cleanTextureUrl(body.textureUrl || match?.textureUrl || selectedBody?.textureUrl);
    if (tex && !isPlaceholderUrl(tex)) return tex;
    return `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(cleanName(body.name))}`;
  }, [overrides.character, profile.activeBodySkin, inventory, catalog]);

  // 2. Loadout: WEAPON_1 primary, WEAPON_2 secondary, WEAPON_3 melee (falls back to base weapon names)
  const loadout = useMemo(() => {
    const selected = inventory.filter((i) => i.isSelected && i.item.type === 'WEAPON_SKIN').map((i) => i.item as LoadoutItem);
    const bySlot = (slotType: string, names: string[]) =>
      selected.find((item) => (item.parent?.type || '').toUpperCase() === slotType) ||
      selected.find((item) => names.includes(cleanName(item.parent?.name).toUpperCase())) ||
      null;

    return {
      primary: overrides.primary || (profile.activeWeapon1Skin as LoadoutItem) || bySlot('WEAPON_1', PRIMARY_WEAPONS),
      secondary: overrides.secondary || bySlot('WEAPON_2', SECONDARY_WEAPONS),
      melee: overrides.melee || bySlot('WEAPON_3', MELEE_WEAPONS),
    };
  }, [overrides.primary, overrides.secondary, overrides.melee, profile.activeWeapon1Skin, inventory]);

  const primaryKey = `${loadout.primary?.parent?.name || ''}|${loadout.primary?.name || ''}|${loadout.primary?.textureUrl || ''}`;

  // 3. Scene: Kirka character playing a lobby pose, holding the primary weapon
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    setLoading(true);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio * 2, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(1.5, 3, 4);
    scene.add(keyLight);

    // Orthographic camera like the kirka.io lobby
    const frustumHeight = 4.1;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 100);
    camera.position.set(0, 1.78, 10);
    camera.lookAt(0, 1.78, 0);

    const resize = () => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 560;
      const aspect = w / h;
      camera.left = (-frustumHeight * aspect) / 2;
      camera.right = (frustumHeight * aspect) / 2;
      camera.top = frustumHeight / 2;
      camera.bottom = -frustumHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();

    // Floor shadow
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(10, 14, 26, 0.8)');
      grad.addColorStop(0.6, 'rgba(10, 14, 26, 0.5)');
      grad.addColorStop(1, 'rgba(10, 14, 26, 0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.1),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.28;

    // Turntable: drag to spin the character
    const turntable = new THREE.Group();
    turntable.add(shadow);
    scene.add(turntable);
    let dragging = false;
    let lastX = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      turntable.rotation.y += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.style.touchAction = 'pan-y';

    let mixer: THREE.AnimationMixer | null = null;
    let character: THREE.Object3D | null = null;
    let weapon: THREE.Object3D | null = null;
    const actions: Partial<Record<FitPose, THREE.AnimationAction>> = {};
    let currentPose: FitPose = pose;

    const attachWeapon = (target: FitPose) => {
      if (!character || !weapon) return;
      character.getObjectByName(target)?.add(weapon);
    };

    const applyPose = (target: FitPose) => {
      const next = actions[target];
      if (!next) return;
      const prev = actions[currentPose];
      next.reset().play();
      if (prev && prev !== next) next.crossFadeFrom(prev, 0.25, false);
      currentPose = target;
      attachWeapon(target);
    };
    sceneApiRef.current = { setPose: applyPose };

    const primary = loadout.primary;
    const weaponName = cleanName(primary?.parent?.name) || 'SCAR';
    const modelFile = getModelFileName(weaponName) || 'SCAR.glb';
    const weaponTextureUrl = primary
      ? primary.textureUrl || findCatalogItem(catalog, primary.name, (c) => cleanName(c.parent?.name).toUpperCase() === cleanName(primary.parent?.name).toUpperCase())?.textureUrl
      : null;

    const characterPromise = new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) =>
      new GLTFLoader().load(getModelUrl(CHARACTER_MODEL), resolve, undefined, reject)
    );

    Promise.all([
      characterPromise,
      charTextureUrl ? loadCharacterTexture(charTextureUrl) : Promise.resolve(null),
      loadWeaponModel(modelFile),
      primary ? loadSkinTexture(weaponTextureUrl, primary.name) : Promise.resolve(null),
    ])
      .then(([gltf, charTexture, weaponModel, weaponTexture]) => {
        if (disposed) return;

        // Character
        character = gltf.scene;
        character.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.frustumCulled = false;
          mesh.material = new THREE.MeshStandardMaterial({
            map: charTexture,
            color: charTexture ? 0xffffff : 0x2a3148,
            alphaTest: 0.05,
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
          });
        });
        character.scale.setScalar(CHARACTER_SCALE);
        character.rotation.y = Math.PI;
        turntable.add(character);

        mixer = new THREE.AnimationMixer(character);
        for (const clip of gltf.animations) {
          if (clip.name === 'pose1' || clip.name === 'pose2' || clip.name === 'pose3') {
            actions[clip.name] = mixer.clipAction(clip);
          }
        }

        // Weapon: grip ("Lever") sits on the pose empty
        weaponModel.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = new THREE.MeshStandardMaterial({
            map: weaponTexture,
            color: weaponTexture ? 0xffffff : 0x4b5468,
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
          });
        });
        const scale = WEAPON_SCALE[modelFile] ?? 3;
        const lever = weaponModel.getObjectByName('Lever');
        weaponModel.scale.setScalar(scale);
        if (lever) weaponModel.position.copy(lever.position).multiplyScalar(-scale);
        weapon = weaponModel;

        const initial = actions[currentPose];
        initial?.play();
        attachWeapon(currentPose);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[FitViewer] Failed to load fit scene:', err);
        if (!disposed) setLoading(false);
      });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      mixer?.update(clock.getDelta() * ANIMATION_SPEED);
      renderer.render(scene, camera);
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      sceneApiRef.current = null;
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      shadowTex.dispose();
      renderer.dispose();
    };
    // pose changes are applied through sceneApiRef without rebuilding the scene
  }, [charTextureUrl, primaryKey, catalog.length]);

  const changePose = (next: FitPose) => {
    setPose(next);
    sceneApiRef.current?.setPose(next);
  };

  const slots: { label: string; item: LoadoutItem | null }[] = [
    { label: 'Primary', item: loadout.primary },
    { label: 'Secondary', item: loadout.secondary },
    { label: 'Melee', item: loadout.melee },
  ];

  return (
    <div className="w-full max-w-[690px] mx-auto rounded-xl overflow-hidden select-none shadow-2xl border border-[#2c3653]" style={{ fontFamily: '"Exo 2", Outfit, Inter, system-ui, sans-serif' }}>
      <div
        className="relative w-full h-[440px] sm:h-[620px]"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, #2a3450 0%, #222a42 55%, #1c2338 100%)' }}
      >
        {/* Level + name banner */}
        <div className="absolute top-8 sm:top-[78px] inset-x-0 z-10 flex items-center justify-center gap-2 pointer-events-none px-4">
          <span className="bg-[#1a2031]/90 text-[#f5a623] font-extrabold text-2xl sm:text-[34px] leading-none px-2 py-1 rounded-[3px]">
            {profile.level || 1}
          </span>
          <span className="text-white font-extrabold text-2xl sm:text-[34px] leading-none tracking-tight truncate drop-shadow">
            {profile.name}
          </span>
        </div>

        <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

        {/* Pose switcher */}
        <div className="absolute top-3 right-3 z-10 flex gap-1" data-html2canvas-ignore>
          {(['pose1', 'pose2', 'pose3'] as FitPose[]).map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => changePose(p)}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                pose === p ? 'bg-[#f5a623] text-[#1a2031]' : 'bg-black/30 text-slate-300 hover:text-white'
              }`}
            >
              Pose {i + 1}
            </button>
          ))}
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 pointer-events-none">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading fit</span>
          </div>
        )}
      </div>

      {/* Loadout slots */}
      <div className="grid grid-cols-3 gap-[3px] bg-[#1a2033] pt-[3px]">
        {slots.map(({ label, item }) => {
          const img = slotRenderUrl(item, catalog);
          return (
            <button
              key={label}
              type="button"
              onClick={() => item && onInspectItem?.(item.name, item.parent?.name || 'weapon_skin', 1, item.textureUrl)}
              className="bg-[#252d45] hover:bg-[#2c3552] transition-colors h-24 sm:h-[150px] p-2.5 sm:p-4 flex flex-col text-left cursor-pointer group"
            >
              <span className="text-white font-semibold text-sm sm:text-lg leading-none truncate">
                {item ? cleanName(item.name) : label}
              </span>
              <div className="flex-1 flex items-center justify-center min-h-0">
                {img ? (
                  <img
                    src={img}
                    alt={item ? cleanName(item.name) : label}
                    className="max-h-full max-w-[85%] object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.45)] group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
                  />
                ) : (
                  <Crosshair className="w-6 h-6 text-slate-600 opacity-50" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
