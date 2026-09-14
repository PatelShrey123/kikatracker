import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkinViewer } from 'skinview3d';
import { RotateCw, Crosshair } from 'lucide-react';
import type { UserProfile, UserInventoryItem } from '../utils/api';
import { fetchAllPublicItems } from '../utils/api';
import { getProxiedTextureUrl, cleanTextureUrl, WEAPON_MODEL_MAP } from './Weapon3DViewer';

interface InGameFitShowcaseProps {
  profile: UserProfile;
  inventory: UserInventoryItem[];
  allItemData?: any[];
  publicItems?: any[];
  fallbackRenders?: Record<string, any>;
  getItemRenderUrl?: (item: any) => string | null;
  onInspectItem?: (name: string, type?: string, amount?: number, textureUrl?: string | null) => void;
}

// Procedurally generate a high-fidelity Kirka dark combat skin (purple eyes & accents) as a guaranteed fallback
function getStarterSkinDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background / Body Dark Camo
  ctx.fillStyle = '#1e1e24';
  ctx.fillRect(0, 0, 64, 64);

  // Head front
  ctx.fillStyle = '#161620';
  ctx.fillRect(8, 8, 8, 8);
  // Head top/sides/back
  ctx.fillStyle = '#111116';
  ctx.fillRect(0, 8, 8, 8);
  ctx.fillRect(16, 8, 8, 8);
  ctx.fillRect(24, 8, 8, 8);
  ctx.fillRect(8, 0, 8, 8);

  // Purple Kirka Glowing Eyes
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);

  // Torso (Dark combat armor with purple accents)
  ctx.fillStyle = '#14141e';
  ctx.fillRect(20, 20, 8, 12);
  ctx.fillStyle = '#2d1b4e';
  ctx.fillRect(21, 23, 6, 6);
  ctx.fillStyle = '#9333ea';
  ctx.fillRect(23, 25, 2, 2);

  // Arms
  ctx.fillStyle = '#1a1a24';
  ctx.fillRect(44, 20, 4, 12);
  ctx.fillRect(36, 52, 4, 12);
  ctx.fillStyle = '#7e22ce';
  ctx.fillRect(44, 28, 4, 4);
  ctx.fillRect(36, 60, 4, 4);

  // Legs
  ctx.fillStyle = '#12121a';
  ctx.fillRect(4, 20, 4, 12);
  ctx.fillRect(20, 52, 4, 12);
  ctx.fillStyle = '#261738';
  ctx.fillRect(4, 24, 4, 4);
  ctx.fillRect(20, 56, 4, 4);

  return canvas.toDataURL('image/png');
}

export const InGameFitShowcase: React.FC<InGameFitShowcaseProps> = ({
  profile,
  inventory,
  allItemData = [],
  publicItems = [],
  fallbackRenders = {},
  getItemRenderUrl,
  onInspectItem
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const skinViewerRef = useRef<SkinViewer | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [itemsDb, setItemsDb] = useState<any[]>(publicItems || []);

  // Ensure public items database is loaded for resolving 2D weapon renders & textures
  useEffect(() => {
    if (publicItems && publicItems.length > 0) {
      setItemsDb(publicItems);
      return;
    }
    fetchAllPublicItems()
      .then((items) => {
        if (Array.isArray(items) && items.length > 0) {
          setItemsDb(items);
        }
      })
      .catch(() => {});
  }, [publicItems]);

  // 1. Resolve Equipped Character Skin & Texture
  const activeChar = useMemo(() => {
    if (profile.activeBodySkin && profile.activeBodySkin.name) {
      return profile.activeBodySkin;
    }
    const selectedBody = inventory.find(
      (inv) => inv.isSelected && (inv.item.type === 'BODY_SKIN' || (inv.item.type as any) === 'CHARACTER')
    );
    return selectedBody ? selectedBody.item : null;
  }, [profile.activeBodySkin, inventory]);

  const charTextureUrl = useMemo(() => {
    if (!activeChar) return null;
    let tex = activeChar.textureUrl;
    const cleanName = (activeChar.name || '').replace(/^_+/, '').trim().toLowerCase();

    const pool = [...(itemsDb || []), ...(allItemData || [])];
    const match = pool.find(
      (i) => i.name && i.name.replace(/^_+/, '').trim().toLowerCase() === cleanName && (i.type === 'BODY_SKIN' || i.type === 'CHARACTER')
    );
    if (match?.textureUrl) tex = match.textureUrl;

    const cleaned = tex ? cleanTextureUrl(tex) : null;
    if (cleaned && (cleaned === 'https://kirka.io' || cleaned === 'https://kirka.io/')) {
      return null;
    }
    return cleaned;
  }, [activeChar, allItemData, itemsDb]);

  // 2. Resolve Equipped Weapons (Primary, Secondary, Melee)
  const loadout = useMemo(() => {
    const selectedItems = inventory.filter((i) => i.isSelected).map((i) => i.item);

    let primary = profile.activeWeapon1Skin || null;
    if (!primary) {
      primary = selectedItems.find((item) => {
        const parent = (item.parent?.name || '').toUpperCase();
        return ['SCAR', 'VITA', 'AR-9', 'LAR', 'M60', 'MAC-10', 'WEATIE'].includes(parent);
      }) || null;
    }

    let secondary = selectedItems.find((item) => {
      const parent = (item.parent?.name || '').toUpperCase();
      return ['SHARK', 'REVOLVER', 'PISTOL'].includes(parent);
    }) || null;

    let melee = selectedItems.find((item) => {
      const parent = (item.parent?.name || '').toUpperCase();
      const type = (item.type || '').toUpperCase();
      return ['BAYONET', 'TOMAHAWK', 'KNIFE', 'MELEE'].includes(parent) || type === 'WEAPON_3';
    }) || null;

    return { primary, secondary, melee };
  }, [profile.activeWeapon1Skin, inventory]);

  // Robust weapon render resolver directly querying Kirka's asset CDN
  const resolveWeaponImage = (item: any) => {
    if (!item) return null;
    const rawName = (item.name || '').replace(/^_+/, '').trim();
    const cleanLower = rawName.toLowerCase();

    // 1. If item has valid renderUrl already
    if (item.renderUrl && !item.renderUrl.endsWith('/render-mini.webp') && item.renderUrl !== 'render-mini.webp') {
      return item.renderUrl;
    }

    // 2. Search loaded items database (contains full 1,967 Kirka skin renders)
    const pool = [...(itemsDb || []), ...(allItemData || [])];
    const match = pool.find((p: any) => (p.name || '').replace(/^_+/, '').trim().toLowerCase() === cleanLower);
    if (match?.renderUrl && !match.renderUrl.endsWith('/render-mini.webp') && match.renderUrl !== 'render-mini.webp') {
      return match.renderUrl;
    }

    // 3. Fallback dictionary lookup
    const fallback = fallbackRenders[cleanLower];
    if (fallback?.renderurl) {
      return fallback.renderurl;
    }

    // 4. Check getItemRenderUrl prop
    if (getItemRenderUrl) {
      const parentUrl = getItemRenderUrl(item);
      if (parentUrl && !parentUrl.endsWith('/render-mini.webp')) {
        return parentUrl;
      }
    }

    return null;
  };

  // 3. Mount skinview3d with exact Kirka in-game character framing and weapon posing
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 380;
    const height = container.clientHeight || 450;

    const canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);

    const skinSource = charTextureUrl ? getProxiedTextureUrl(charTextureUrl) : getStarterSkinDataUrl();

    const viewer = new SkinViewer({
      canvas,
      width,
      height,
      model: 'slim',
      skin: skinSource,
    });

    viewer.playerObject.visible = true;
    viewer.playerObject.skin.visible = true;

    viewer.autoRotate = isRotating;
    viewer.autoRotateSpeed = 1.0;

    // CAMERA FRAMING:
    // Positioning playerObject down at y=-6.0 and targeting y=-6.0 ensures:
    // 1. Head has 60px of clean headroom beneath the [99] #carson title
    // 2. Feet sit naturally planted on the floor shadow at the bottom
    viewer.camera.position.set(0, -3.0, 54.0);
    viewer.controls.target.set(0, -6.0, 0);
    viewer.controls.update();

    viewer.playerObject.position.set(0, -6.0, 0);

    // 3D Floor Shadow Mesh placed directly at y = -16.02 (under soles of player's shoes)
    // This makes it physically impossible for the feet to float in the air
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const shadowCtx = shadowCanvas.getContext('2d');
    if (shadowCtx) {
      const grad = shadowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
      grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      shadowCtx.fillStyle = grad;
      shadowCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(20, 12);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, -16.02, 0);
    (viewer.playerObject as any).add(shadowMesh);

    // Kirka Studio Directional + Ambient Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(12, 20, 25);
    (viewer.scene as any).add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.4);
    fillLight.position.set(-15, 2, -8);
    (viewer.scene as any).add(fillLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
    frontLight.position.set(0, 0, 20);
    (viewer.scene as any).add(frontLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    (viewer.scene as any).add(ambientLight);

    const skin = viewer.playerObject.skin;

    // Character Stance matching Kirka (subtle 7-degree body angle)
    viewer.playerObject.rotation.y = -0.12;

    // Head faces camera with slight natural angle
    skin.head.rotation.set(0.02, 0.08, 0);

    // Legs standing upright directly on the shadow plane
    skin.rightLeg.rotation.set(0.04, 0, 0.02);
    skin.leftLeg.rotation.set(-0.04, 0, -0.02);

    // Kirka Dual-Hand Combat Holding Pose:
    // Right arm grips rear handle/trigger
    skin.rightArm.rotation.set(-0.65, -0.42, 0.32);

    // Left arm reaches across to support front under-barrel/handguard
    skin.leftArm.rotation.set(-0.85, 0.28, -0.42);

    // 4. Load 3D Weapon Model
    const primaryWeapon = loadout.primary;
    const parentName = (primaryWeapon?.parent?.name || 'SCAR').toUpperCase();
    const modelFileName = WEAPON_MODEL_MAP[parentName] || 'SCAR.glb';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const modelUrl = `${origin}/models/${modelFileName}`;

    console.log('[FitViewer] Loading 3D weapon model from:', modelUrl);

    const weaponPivot = new THREE.Group();
    (viewer.playerObject as any).add(weaponPivot);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      modelUrl,
      (gltf) => {
        const weaponMesh = gltf.scene;

        // Default gunmetal material so weapon is ALWAYS immediately visible
        weaponMesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x3b4252,
              roughness: 0.35,
              metalness: 0.25,
              side: THREE.DoubleSide
            });
          }
        });

        // Resolve weapon skin texture
        let skinTexUrl: string | null = primaryWeapon?.textureUrl || null;
        const cleanSkinName = (primaryWeapon?.name || '').replace(/^_+/, '').trim().toLowerCase();

        if (!skinTexUrl && cleanSkinName) {
          const pool = [...(itemsDb || []), ...(allItemData || [])];
          const match = pool.find(
            (i) => i.name && i.name.replace(/^_+/, '').trim().toLowerCase() === cleanSkinName
          );
          if (match?.textureUrl) skinTexUrl = match.textureUrl;
        }

        if (skinTexUrl) {
          const texLoader = new THREE.TextureLoader();
          texLoader.crossOrigin = 'anonymous';
          const targetTex = getProxiedTextureUrl(skinTexUrl);

          texLoader.load(
            targetTex,
            (tex) => {
              tex.flipY = false;
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.magFilter = THREE.NearestFilter;
              tex.minFilter = THREE.NearestFilter;

              weaponMesh.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  mesh.material = new THREE.MeshStandardMaterial({
                    map: tex,
                    roughness: 0.35,
                    metalness: 0.15,
                    side: THREE.DoubleSide
                  });
                }
              });
              console.log('[FitViewer] Weapon skin texture applied:', targetTex);
            },
            undefined,
            () => {
              console.warn('[FitViewer] Texture failed to load, retaining gunmetal material');
            }
          );
        }

        // Center weapon mesh at origin so rotation and scaling happen about its geometric center
        const box = new THREE.Box3().setFromObject(weaponMesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 20.0 / (maxDim || 1);

        weaponMesh.position.x = -center.x;
        weaponMesh.position.y = -center.y;
        weaponMesh.position.z = -center.z;

        const weaponHolder = new THREE.Group();
        weaponHolder.add(weaponMesh);
        weaponHolder.scale.setScalar(targetScale);

        // Weapon Orientation matching Kirka Reference:
        // - Barrel points diagonally up and to the right (+21 degrees up)
        // - Buttstock rests on player's right shoulder/chest
        // - Top sights face upward and lean naturally toward viewer
        weaponHolder.rotation.set(-1.45, -0.35, 0.20);

        // Position directly at the dual-hand contact point in player space
        weaponPivot.position.set(-0.4, 0.5, 5.5);
        weaponPivot.add(weaponHolder);

        console.log('[FitViewer] 3D weapon centered and mounted successfully in hands!');
      },
      undefined,
      (err) => {
        console.error('[FitViewer] Failed to load 3D weapon model:', err);
      }
    );

    // Subtle synchronized breathing animation
    let animFrameId: number;
    let time = 0;
    const animatePose = () => {
      time += 0.035;
      const breath = Math.sin(time) * 0.012;

      skin.head.rotation.x = 0.02 + breath * 0.4;
      skin.rightArm.rotation.x = -0.65 + breath;
      skin.leftArm.rotation.x = -0.85 + breath;
      weaponPivot.position.y = 0.5 + breath * 1.2;

      animFrameId = requestAnimationFrame(animatePose);
    };
    animFrameId = requestAnimationFrame(animatePose);

    skinViewerRef.current = viewer;

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        viewer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      skinViewerRef.current = null;
      viewer.dispose();
    };
  }, [charTextureUrl, loadout.primary, itemsDb]);

  useEffect(() => {
    if (!skinViewerRef.current) return;
    skinViewerRef.current.autoRotate = isRotating;
  }, [isRotating]);

  const primaryImg = resolveWeaponImage(loadout.primary);
  const secondaryImg = resolveWeaponImage(loadout.secondary);
  const meleeImg = resolveWeaponImage(loadout.melee);

  return (
    <div className="w-full max-w-xl mx-auto bg-[#1c2438] border border-[#2b3554] rounded-xl shadow-2xl overflow-hidden font-sans select-none">
      {/* Main 3D Character Canvas Area */}
      <div className="relative w-full h-[450px] sm:h-[480px] bg-[#1a2238] flex flex-col items-center justify-between overflow-hidden">
        {/* Top Level + Player Name Banner (Identical to Official Kirka In-Game Showcase) */}
        <div className="absolute top-4 left-5 z-10 flex items-center space-x-3 pointer-events-none">
          <span className="bg-[#fbbf24] text-slate-950 font-black text-sm px-2.5 py-0.5 rounded shadow-sm">
            {profile.level || 1}
          </span>
          <span className="text-white font-extrabold text-2xl tracking-wide font-sans drop-shadow-md">
            {profile.name}
          </span>
        </div>

        {/* 360° Rotate Button (Sleek Floating Glass Pill, Top Right) */}
        <div className="absolute top-3.5 right-4 z-10">
          <button
            onClick={() => setIsRotating(!isRotating)}
            title="Toggle 360° Rotate"
            className={`px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition-all cursor-pointer backdrop-blur border ${
              isRotating 
                ? 'bg-amber-400 text-black font-bold border-amber-300 shadow-lg shadow-amber-400/20' 
                : 'bg-[#222b42]/80 text-slate-200 border-white/10 hover:text-white hover:bg-[#2e3a5a]'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px] uppercase font-bold">360° Rotate</span>
          </button>
        </div>

        {/* 3D Skinview3d Canvas Container */}
        <div 
          ref={containerRef} 
          className="w-full h-full absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* Bottom 3-Weapon Loadout Slots (Exact Kirka In-Game 3-Slot Bar) */}
      <div className="grid grid-cols-3 divide-x divide-[#2b3554] border-t border-[#2b3554] bg-[#161d2f]">
        {/* 1. Primary Weapon */}
        <div 
          onClick={() => loadout.primary && onInspectItem?.(loadout.primary.name, loadout.primary.parent?.name || 'weapon_skin', 1)}
          className="p-3 flex flex-col justify-between h-28 hover:bg-white/[0.04] transition-colors cursor-pointer group relative"
        >
          <span className="text-sm font-bold text-white tracking-wide truncate font-sans">
            {loadout.primary?.name || 'Primary'}
          </span>

          <div className="flex-1 flex items-center justify-center py-1">
            {primaryImg ? (
              <img
                src={primaryImg}
                alt={loadout.primary?.name || 'Primary'}
                className="max-h-14 max-w-[90%] object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <Crosshair className="w-6 h-6 text-slate-600 opacity-40" />
            )}
          </div>
        </div>

        {/* 2. Secondary Weapon */}
        <div 
          onClick={() => loadout.secondary && onInspectItem?.(loadout.secondary.name, loadout.secondary.parent?.name || 'weapon_skin', 1)}
          className="p-3 flex flex-col justify-between h-28 hover:bg-white/[0.04] transition-colors cursor-pointer group relative"
        >
          <span className="text-sm font-bold text-white tracking-wide truncate font-sans">
            {loadout.secondary?.name || 'Secondary'}
          </span>

          <div className="flex-1 flex items-center justify-center py-1">
            {secondaryImg ? (
              <img
                src={secondaryImg}
                alt={loadout.secondary?.name || 'Secondary'}
                className="max-h-14 max-w-[90%] object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <Crosshair className="w-6 h-6 text-slate-600 opacity-40" />
            )}
          </div>
        </div>

        {/* 3. Melee Weapon */}
        <div 
          onClick={() => loadout.melee && onInspectItem?.(loadout.melee.name, loadout.melee.parent?.name || 'weapon_skin', 1)}
          className="p-3 flex flex-col justify-between h-28 hover:bg-white/[0.04] transition-colors cursor-pointer group relative"
        >
          <span className="text-sm font-bold text-white tracking-wide truncate font-sans">
            {loadout.melee?.name || 'Melee'}
          </span>

          <div className="flex-1 flex items-center justify-center py-1">
            {meleeImg ? (
              <img
                src={meleeImg}
                alt={loadout.melee?.name || 'Melee'}
                className="max-h-14 max-w-[90%] object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <Crosshair className="w-6 h-6 text-slate-600 opacity-40" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
