import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkinViewer } from 'skinview3d';
import { RotateCcw, Download, Sparkles, Loader2 } from 'lucide-react';
import { WEAPON_MODEL_MAP, cleanTextureUrl, getProxiedTextureUrl } from './Weapon3DViewer';

interface FitViewer3DProps {
  characterTextureUrl?: string | null;
  characterName?: string;
  primaryWeaponType?: string;
  primaryTextureUrl?: string | null;
  primarySkinName?: string;
  className?: string;
}

// In-memory cache for loaded GLTF weapon models
const gltfModelCache = new Map<string, THREE.Group>();

export const FitViewer3D: React.FC<FitViewer3DProps> = ({
  characterTextureUrl,
  characterName = 'Character',
  primaryWeaponType = 'SCAR',
  primaryTextureUrl,
  primarySkinName = 'Default',
  className = 'w-full h-full min-h-[460px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const skinViewerRef = useRef<SkinViewer | null>(null);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to pose character in authentic Kirka idle holding stance
  const applyKirkaPose = (viewer: SkinViewer) => {
    const skin = viewer.playerObject.skin;
    if (!skin) return;

    // Angled body
    viewer.playerObject.rotation.y = 0.22;

    // Right arm holding gun grip/trigger
    skin.rightArm.rotation.x = -1.15;
    skin.rightArm.rotation.y = -0.42;
    skin.rightArm.rotation.z = 0.16;

    // Left arm wrapped across torso supporting handguard
    skin.leftArm.rotation.x = -0.92;
    skin.leftArm.rotation.y = 0.68;
    skin.leftArm.rotation.z = -0.26;

    // Legs straight in athletic stance
    skin.rightLeg.rotation.x = 0;
    skin.rightLeg.rotation.z = 0.03;
    skin.leftLeg.rotation.x = 0;
    skin.leftLeg.rotation.z = -0.04;

    // Head looking slightly toward viewer
    skin.head.rotation.x = 0.08;
    skin.head.rotation.y = -0.18;
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 460;

    const canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);

    // 1. Initialize SkinViewer
    const cleanedCharTex = cleanTextureUrl(characterTextureUrl);
    const skinSource = cleanedCharTex ? getProxiedTextureUrl(cleanedCharTex) : undefined;

    const viewer = new SkinViewer({
      canvas,
      width,
      height,
      model: 'slim', // Kirka 3px slim voxel mesh
      skin: skinSource,
    });

    skinViewerRef.current = viewer;

    // Kirka signature royal blue backdrop
    viewer.background = 0x183c88;
    viewer.camera.position.set(0, 1.5, 52);
    viewer.camera.lookAt(0, -1, 0);

    // Initial pose
    applyKirkaPose(viewer);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    viewer.scene.add(ambientLight as any);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(15, 25, 30);
    viewer.scene.add(dirLight1 as any);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
    fillLight.position.set(-20, -5, 10);
    viewer.scene.add(fillLight as any);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.0);
    rimLight.position.set(0, 20, -25);
    viewer.scene.add(rimLight as any);

    // Soft drop shadow plane under the feet
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 58);
      grad.addColorStop(0, 'rgba(10, 20, 45, 0.75)');
      grad.addColorStop(0.6, 'rgba(12, 24, 55, 0.4)');
      grad.addColorStop(1, 'rgba(15, 30, 70, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);

      const shadowTex = new THREE.CanvasTexture(shadowCanvas);
      const shadowGeo = new THREE.PlaneGeometry(24, 15);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.set(0, -16.2, 0);
      viewer.scene.add(shadowMesh as any);
    }

    // 2. Load & Attach 3D Primary Weapon Model
    const normalizedWeapon = (primaryWeaponType || 'SCAR').trim().toUpperCase().replace(/^_+/, '');
    const modelFile = WEAPON_MODEL_MAP[normalizedWeapon] || 'SCAR.glb';

    const attachWeapon = (gltfGroup: THREE.Group) => {
      if (weaponMeshRef.current) {
        (viewer.playerObject as any).remove(weaponMeshRef.current);
        weaponMeshRef.current = null;
      }

      const gunClone = gltfGroup.clone(true);

      // Position gun directly in front of the hands across chest
      gunClone.position.set(1.6, -1.8, 6.8);
      gunClone.rotation.set(-0.22, 0.42, 0.32);
      gunClone.scale.set(7.5, 7.5, 7.5);

      // Apply weapon skin texture if provided
      const cleanedGunTex = cleanTextureUrl(primaryTextureUrl);
      if (cleanedGunTex) {
        const proxiedTexUrl = getProxiedTextureUrl(cleanedGunTex);
        const texLoader = new THREE.TextureLoader();
        texLoader.load(proxiedTexUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          gunClone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.material = new THREE.MeshStandardMaterial({
                map: tex,
                roughness: 0.35,
                metalness: 0.15,
              });
            }
          });
        });
      }

      (viewer.playerObject as any).add(gunClone);
      weaponMeshRef.current = gunClone;
      setLoading(false);
    };

    if (gltfModelCache.has(modelFile)) {
      attachWeapon(gltfModelCache.get(modelFile)!);
    } else {
      const loader = new GLTFLoader();
      const modelPath = `${import.meta.env.BASE_URL}models/${modelFile}`;
      loader.load(
        modelPath,
        (gltf) => {
          gltfModelCache.set(modelFile, gltf.scene);
          attachWeapon(gltf.scene);
        },
        undefined,
        (err) => {
          console.warn(`[FitViewer3D] Failed to load model ${modelPath}:`, err);
          setLoading(false);
        }
      );
    }

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
      resizeObserver.disconnect();
      skinViewerRef.current = null;
      viewer.dispose();
    };
  }, [characterTextureUrl, primaryWeaponType, primaryTextureUrl]);

  const handleExportSnapshot = () => {
    if (!skinViewerRef.current) return;
    try {
      const dataUrl = skinViewerRef.current.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `kirka_fit_${characterName.replace(/\s+/g, '_')}_${primarySkinName.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[FitViewer3D] Snapshot failed:', err);
    }
  };

  const handleResetView = () => {
    if (!skinViewerRef.current) return;
    const v = skinViewerRef.current;
    v.camera.position.set(0, 1.5, 52);
    v.camera.lookAt(0, -1, 0);
    applyKirkaPose(v);
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-[#183c88] ${className}`}>
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-[#091124]/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shadow-lg pointer-events-none">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-black tracking-wider text-white uppercase font-mono">
          3D Canvas • {primaryWeaponType} Fit
        </span>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
        <button
          onClick={handleResetView}
          title="Reset Camera View"
          className="p-2.5 rounded-xl bg-[#091124]/80 hover:bg-[#121f3d] text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleExportSnapshot}
          title="Download 3D PNG Snapshot"
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save PNG</span>
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-[#183c88]/90 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-sm font-bold text-slate-200 tracking-wider font-mono">
            Assembling 3D Fit...
          </span>
        </div>
      )}

      <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none z-10">
        <span className="text-[11px] font-semibold text-white/50 tracking-wide bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/5">
          🖱️ Click & drag to rotate in 3D • Scroll to zoom
        </span>
      </div>
    </div>
  );
};
