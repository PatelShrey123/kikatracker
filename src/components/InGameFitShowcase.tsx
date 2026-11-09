import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fallBackToBaseRender } from '../utils/skinAssets';
import { Crosshair, Loader2, Minus, Plus } from 'lucide-react';
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
  /** Image URL shown behind the character instead of the default backdrop */
  background?: string | null;
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
  // Base weapons (no skin, e.g. the default Shark) resolve to Kirka's own render there; the catalog
  // entry for them points at an api2 render that doesn't exist, so skip the lookups below
  if (!item.parent?.name || cleanName(item.name).toUpperCase() === cleanName(item.parent.name).toUpperCase()) {
    return getSkinRenderUrl({ ...item, parent: null });
  }
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

export const InGameFitShowcase: React.FC<InGameFitShowcaseProps> = ({ profile, inventory, catalog = [], overrides = {}, background = null, onInspectItem }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState<FitPose>('pose1');
  const [loading, setLoading] = useState(true);
  const [weaponScale, setWeaponScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kikatracker_fit_weapon_scale');
      if (saved) {
        const parsed = parseFloat(saved);
        if (Number.isFinite(parsed) && parsed >= 0.4 && parsed <= 2.0) return parsed;
      }
    } catch {}
    return 1.0;
  });
  const weaponScaleRef = useRef<number>(weaponScale);
  weaponScaleRef.current = weaponScale;
  const sceneApiRef = useRef<{
    setPose: (pose: FitPose) => void;
    setWeaponScale: (multiplier: number) => void;
  } | null>(null);

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
    const selectedItems = inventory.filter((i) => i.isSelected).map((i) => i.item as LoadoutItem);
    const baseMelee = selectedItems.find((item) => 
      (item.type === 'WEAPON_3' || MELEE_WEAPONS.includes(cleanName(item.name).toUpperCase())) && 
      !item.parent
    );
    const baseSecondary = selectedItems.find((item) => 
      (item.type === 'WEAPON_2' || SECONDARY_WEAPONS.includes(cleanName(item.name).toUpperCase())) && 
      !item.parent
    );
    const basePrimary = selectedItems.find((item) => 
      item.type === 'WEAPON_1' && 
      !item.parent
    );

    const weaponSkins = selectedItems.filter((item) => item.type === 'WEAPON_SKIN');

    const matchSlot = (baseItem: LoadoutItem | undefined, slotType: string, fallbackNames: string[]) => {
      const slotSkins = weaponSkins.filter((item) => {
        const pType = (item.parent?.type || '').toUpperCase();
        const pName = cleanName(item.parent?.name).toUpperCase();
        return pType === slotType || fallbackNames.includes(pName);
      });

      if (baseItem) {
        const baseName = cleanName(baseItem.name).toUpperCase();
        const skinForBase = slotSkins.find((item) => cleanName(item.parent?.name).toUpperCase() === baseName);
        return skinForBase || baseItem;
      }
      return slotSkins[0] || null;
    };

    return {
      primary: overrides.primary || (profile.activeWeapon1Skin as LoadoutItem) || matchSlot(basePrimary, 'WEAPON_1', PRIMARY_WEAPONS),
      secondary: overrides.secondary || matchSlot(baseSecondary, 'WEAPON_2', SECONDARY_WEAPONS),
      melee: overrides.melee || matchSlot(baseMelee, 'WEAPON_3', MELEE_WEAPONS),
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lit like a studio shot rather than a flat ambient wash: sky/ground fill so block tops are
    // brighter than undersides, a key from the right that casts real shadows (gun on chest, arms
    // on body), a soft fill from the left, and a cool rim from behind to lift the silhouette off
    // the blue background.
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe8eeff, 0x2b3150, 1.4));
    const keyLight = new THREE.DirectionalLight(0xfff4e8, 2.6);
    keyLight.position.set(3.6, 4, 3.6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    Object.assign(keyLight.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.03;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc9d6ff, 0.45);
    fillLight.position.set(-4, 2, 3);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x9db8ff, 2.2);
    rimLight.position.set(-2.5, 3.5, -5);
    scene.add(rimLight);

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
    shadow.material.opacity = 0.7;

    // Invisible floor that only shows the key light's shadow, under the soft contact blob
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ color: 0x0a0e1a, opacity: 0.35 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.281;
    shadowCatcher.receiveShadow = true;

    // Turntable: drag to spin the character
    const turntable = new THREE.Group();
    turntable.add(shadow);
    turntable.add(shadowCatcher);
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
    const applyWeaponScale = (multiplier: number) => {
      if (!weapon) return;
      const baseScale = WEAPON_SCALE[modelFile] ?? 3;
      const currentScale = baseScale * multiplier;
      weapon.scale.setScalar(currentScale);
      const lever = weapon.getObjectByName('Lever');
      if (lever) weapon.position.copy(lever.position).multiplyScalar(-currentScale);
    };
    sceneApiRef.current = { setPose: applyPose, setWeaponScale: applyWeaponScale };

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
          mesh.castShadow = true;
          mesh.receiveShadow = true;
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
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.material = new THREE.MeshStandardMaterial({
            map: weaponTexture,
            color: weaponTexture ? 0xffffff : 0x4b5468,
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
          });
        });
        const baseScale = WEAPON_SCALE[modelFile] ?? 3;
        const initialScale = baseScale * weaponScaleRef.current;
        const lever = weaponModel.getObjectByName('Lever');
        weaponModel.scale.setScalar(initialScale);
        if (lever) weaponModel.position.copy(lever.position).multiplyScalar(-initialScale);
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
      shadowCatcher.geometry.dispose();
      (shadowCatcher.material as THREE.Material).dispose();
      renderer.dispose();
    };
    // pose changes are applied through sceneApiRef without rebuilding the scene
  }, [charTextureUrl, primaryKey, catalog.length]);

  const changePose = (next: FitPose) => {
    setPose(next);
    sceneApiRef.current?.setPose(next);
  };

  const changeWeaponScale = (next: number) => {
    const rounded = Math.round(next * 100) / 100;
    const clamped = Math.max(0.5, Math.min(1.6, rounded));
    setWeaponScale(clamped);
    weaponScaleRef.current = clamped;
    sceneApiRef.current?.setWeaponScale(clamped);
    try {
      localStorage.setItem('kikatracker_fit_weapon_scale', clamped.toString());
    } catch {}
  };

  const slots: { label: string; item: LoadoutItem | null }[] = [
    { label: 'Primary', item: loadout.primary },
    { label: 'Secondary', item: loadout.secondary },
    { label: 'Melee', item: loadout.melee },
  ];

  return (
    <div className="night w-full max-w-[690px] mx-auto rounded-md overflow-hidden select-none border-2 border-[var(--ink)] shadow-[6px_6px_0_var(--ink)]" style={{ fontFamily: '"Exo 2", Outfit, Inter, system-ui, sans-serif' }}>
      <div
        className="relative w-full h-[440px] sm:h-[620px]"
        style={
          background
            ? { backgroundImage: `url("${background}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#1c2338' }
            : { background: 'radial-gradient(ellipse at 50% 45%, #2a3450 0%, #222a42 55%, #1c2338 100%)' }
        }
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

        {/* Gun size controls */}
        <div
          className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded border border-white/10 text-xs font-mono select-none"
          data-html2canvas-ignore
        >
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-0.5">Gun</span>
          <button
            type="button"
            title="Shrink gun (-10%)"
            onClick={() => changeWeaponScale(weaponScale - 0.1)}
            className="w-5 h-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Reset gun size (100%)"
            onClick={() => changeWeaponScale(1.0)}
            className="px-1 py-0.5 text-[11px] font-bold text-[#f5a623] hover:underline cursor-pointer min-w-[34px] text-center"
          >
            {Math.round(weaponScale * 100)}%
          </button>
          <button
            type="button"
            title="Enlarge gun (+10%)"
            onClick={() => changeWeaponScale(weaponScale + 0.1)}
            className="w-5 h-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>

          <div className="h-3 w-px bg-white/20 mx-0.5" />

          <button
            type="button"
            title="Slim size (75%)"
            onClick={() => changeWeaponScale(0.75)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
              Math.abs(weaponScale - 0.75) < 0.04 ? 'bg-[#f5a623] text-[#1a2031]' : 'bg-black/20 text-slate-300 hover:text-white'
            }`}
          >
            Slim
          </button>
          <button
            type="button"
            title="Default size (100%)"
            onClick={() => changeWeaponScale(1.0)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
              Math.abs(weaponScale - 1.0) < 0.04 ? 'bg-[#f5a623] text-[#1a2031]' : 'bg-black/20 text-slate-300 hover:text-white'
            }`}
          >
            Default
          </button>
          <button
            type="button"
            title="Chunky size (125%)"
            onClick={() => changeWeaponScale(1.25)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
              Math.abs(weaponScale - 1.25) < 0.04 ? 'bg-[#f5a623] text-[#1a2031]' : 'bg-black/20 text-slate-300 hover:text-white'
            }`}
          >
            Chunky
          </button>
        </div>

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
                    onError={(e) => fallBackToBaseRender(e, item?.parent?.name)}
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
