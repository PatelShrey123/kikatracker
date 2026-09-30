import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SkinViewer, IdleAnimation } from 'skinview3d';
import { RotateCw, ZoomIn, Loader2, Sparkles } from 'lucide-react';


// The 3D helpers below need these; everything URL-shaped now lives in skinAssets.
import {
  WEAPON_MODEL_MAP,
  isCharacterSkin,
  getModelFileName,
  has3DViewerSupport,
  cleanTextureUrl,
  getProxiedTextureUrl,
  getModelUrl,
  isPlaceholderUrl,
  getSkinRenderUrl,
} from '../utils/skinAssets';

// Re-exported so existing imports from this module keep working.
export {
  WEAPON_MODEL_MAP,
  isCharacterSkin,
  getModelFileName,
  has3DViewerSupport,
  cleanTextureUrl,
  getProxiedTextureUrl,
  getModelUrl,
  isPlaceholderUrl,
  getSkinRenderUrl,
};

// Global in-memory cache for parsed GLB models to ensure instant 0ms switching
const glbCache = new Map<string, THREE.Group>();
// In-memory cache for loaded textures
const textureCache = new Map<string, THREE.Texture>();

export function loadWeaponModel(modelFile: string): Promise<THREE.Group> {
  const modelUrl = getModelUrl(modelFile);
  if (glbCache.has(modelUrl)) {
    return Promise.resolve(glbCache.get(modelUrl)!.clone(true));
  }
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      modelUrl,
      (gltf) => {
        glbCache.set(modelUrl, gltf.scene);
        resolve(gltf.scene.clone(true));
      },
      undefined,
      reject
    );
  });
}

function prepareSkinTexture(tex: THREE.Texture): THREE.Texture {
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

// Cached weapon skin texture loader: proxied URL -> direct URL -> api2 skin-texture by name
export function loadSkinTexture(url: string | null | undefined, skinName?: string): Promise<THREE.Texture | null> {
  let targetUrl = cleanTextureUrl(url);

  // If url is invalid or a placeholder, fallback to api2 skin texture if skinName is available
  if (!targetUrl || isPlaceholderUrl(targetUrl)) {
    if (!skinName) return Promise.resolve(null);
    const cleanSkin = skinName.replace(/^_+/, '').trim();
    targetUrl = `https://api2.kirka.io/api/skin-texture/${encodeURIComponent(cleanSkin)}`;
  }
  const cacheKey = targetUrl;

  if (textureCache.has(cacheKey)) {
    return Promise.resolve(textureCache.get(cacheKey)!);
  }

  const texLoader = new THREE.TextureLoader();
  texLoader.crossOrigin = 'anonymous';
  const tryLoad = (src: string, timeoutMs = 3500) =>
    new Promise<THREE.Texture | null>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, timeoutMs);

      texLoader.load(
        src,
        (tex) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(prepareSkinTexture(tex));
          }
        },
        undefined,
        () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
        }
      );
    });

  return (async () => {
    let tex = await tryLoad(getProxiedTextureUrl(cacheKey));
    if (!tex) tex = await tryLoad(cacheKey);
    // Secondary fallback to api2 skin-texture if url was different
    if (!tex && skinName && !cacheKey.includes('api2.kirka.io')) {
      const cleanSkin = skinName.replace(/^_+/, '').trim();
      tex = await tryLoad(getProxiedTextureUrl(`https://api2.kirka.io/api/skin-texture/${encodeURIComponent(cleanSkin)}`));
    }
    if (tex) textureCache.set(cacheKey, tex);
    return tex;
  })();
}

interface Weapon3DViewerProps {
  weaponType: string;
  textureUrl: string | null;
  skinName?: string;
  className?: string;
  autoRotateDefault?: boolean;
}

export const Weapon3DViewer: React.FC<Weapon3DViewerProps> = ({
  weaponType,
  textureUrl,
  skinName,
  className = 'w-full h-full',
  autoRotateDefault = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotateDefault);

  const controlsRef = useRef<OrbitControls | null>(null);
  const skinViewerRef = useRef<SkinViewer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);

  const isChar = isCharacterSkin(weaponType);
  const modelFile = getModelFileName(weaponType);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!isChar && !modelFile) {
      setError(`No 3D model available for ${weaponType || 'this item'}`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const container = containerRef.current;
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 220;

    // --- CHARACTER 3D PIPELINE (skinview3d 3px Slim) ---
    if (isChar) {
      const canvas = document.createElement('canvas');
      container.innerHTML = '';
      container.appendChild(canvas);

      const cleanedTexture = cleanTextureUrl(textureUrl);
      const skinSource = cleanedTexture ? getProxiedTextureUrl(cleanedTexture) : undefined;

      const viewer = new SkinViewer({
        canvas,
        width,
        height,
        model: 'slim', // Exact 3px slim arm Kirka / Gecko model!
        skin: skinSource,
      });

      viewer.autoRotate = isAutoRotating;
      viewer.autoRotateSpeed = 1.5;
      viewer.camera.position.set(-18, 12, 40);
      viewer.camera.lookAt(0, 0, 0);
      viewer.animation = new IdleAnimation();

      skinViewerRef.current = viewer;
      setLoading(false);

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
    }

    // --- WEAPONS 3D PIPELINE (Three.js GLTF) ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.1, 1.75); // Pre-zoomed weapon view
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'default'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 2.0;
    controls.minDistance = 0.6;
    controls.maxDistance = 6.0;
    controls.minPolarAngle = Math.PI / 8;
    controls.maxPolarAngle = Math.PI / 1.7;
    controlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.4);
    fillLight.position.set(-3, -1, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfcd34d, 1.9);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    let isDisposed = false;

    if (modelFile) {
      Promise.all([loadWeaponModel(modelFile), loadSkinTexture(textureUrl, skinName)])
        .then(([model, loadedTexture]) => {
          if (isDisposed) return;

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (loadedTexture) {
                mesh.material = new THREE.MeshStandardMaterial({
                  map: loadedTexture,
                  roughness: 0.35,
                  metalness: 0.1,
                  side: THREE.DoubleSide,
                });
              } else {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0x475569,
                  roughness: 0.4,
                  metalness: 0.2,
                });
              }
            }
          });

          // Center and scale weapon model nicely in view
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetScale = 2.1 / (maxDim || 1);

          model.scale.setScalar(targetScale);
          model.position.x = -center.x * targetScale;
          model.position.y = -center.y * targetScale;
          model.position.z = -center.z * targetScale;

          const pivot = new THREE.Group();
          pivot.add(model);
          scene.add(pivot);
          pivotRef.current = pivot;

          setLoading(false);
        })
        .catch((err) => {
          console.error('[3D Viewer] Error loading model:', err);
          if (!isDisposed) {
            setError(`Could not load 3D model for ${weaponType}`);
            setLoading(false);
          }
        });
    }

    // Animation Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      pivotRef.current = null;
    };
  }, [modelFile, isChar, textureUrl]);

  // Sync auto-rotation toggle
  const toggleAutoRotate = () => {
    setIsAutoRotating((prev) => {
      const next = !prev;
      if (skinViewerRef.current) {
        skinViewerRef.current.autoRotate = next;
      }
      if (controlsRef.current) {
        controlsRef.current.autoRotate = next;
      }
      return next;
    });
  };

  const resetCamera = () => {
    if (skinViewerRef.current) {
      skinViewerRef.current.camera.position.set(-18, 12, 40);
      skinViewerRef.current.camera.lookAt(0, 0, 0);
      skinViewerRef.current.autoRotate = isAutoRotating;
    }
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.autoRotate = isAutoRotating;
    }
  };

  return (
    <div className={`relative ${className} select-none overflow-hidden rounded-md bg-gradient-to-b from-[#0e1017]/80 to-[#07090e]/90 flex items-center justify-center`}>
      {/* 3D Canvas Mounting point */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090e]/70 backdrop-blur-sm z-10 text-gold-bright space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-gold-primary" />
          <span className="text-[11px] font-mono tracking-widest uppercase text-slate-400">Loading 3D Mesh & Texture...</span>
        </div>
      )}

      {/* Error Fallback */}
      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090e]/60 z-10 text-slate-500 space-y-1">
          <Sparkles className="w-5 h-5 text-slate-600" />
          <span className="text-[11px] font-mono tracking-wider">{error}</span>
        </div>
      )}

      {/* Overlay Controls */}
      {!loading && !error && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-mono text-slate-400 flex items-center space-x-1.5 shadow-lg">
            <span>Drag to rotate • Scroll to zoom</span>
          </div>

          <div className="flex items-center space-x-1.5 pointer-events-auto">
            <button
              onClick={toggleAutoRotate}
              title={isAutoRotating ? 'Pause Rotation' : 'Auto Rotate'}
              className={`p-1.5 rounded-md border backdrop-blur-md transition-all cursor-pointer ${
                isAutoRotating
                  ? 'bg-gold-primary/20 border-gold-primary/50 text-gold-bright'
                  : 'bg-black/60 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetCamera}
              title="Reset View"
              className="p-1.5 rounded-md border border-white/10 bg-black/60 hover:bg-black/80 text-slate-400 hover:text-white backdrop-blur-md transition-all cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

