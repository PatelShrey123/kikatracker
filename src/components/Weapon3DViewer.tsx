import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SkinViewer, IdleAnimation } from 'skinview3d';
import { RotateCw, ZoomIn, Loader2, Sparkles } from 'lucide-react';
import { getCachedCatalog } from '../utils/catalogCache';

export const WEAPON_MODEL_MAP: Record<string, string> = {
  'VITA': 'VITA.glb',
  'SCAR': 'SCAR.glb',
  'SHARK': 'Shark.glb',
  'AR-9': 'AR-9.glb',
  'AR9': 'AR-9.glb',
  'LAR': 'LAR.glb',
  'SNIPER': 'LAR.glb',
  'M60': 'M60.glb',
  'MAC-10': 'MAC-10.glb',
  'MAC10': 'MAC-10.glb',
  'REVOLVER': 'Revolver.glb',
  'PISTOL': 'Revolver.glb',
  'TOMAHAWK': 'Tomahawk.glb',
  'BAYONET': 'Bayonet.glb',
  'KNIFE': 'Bayonet.glb',
  'MELEE': 'Bayonet.glb',
  'WEATIE': 'Weatie.glb', // Shotgun
  'SHOTGUN': 'Weatie.glb',
};

// Global in-memory cache for parsed GLB models to ensure instant 0ms switching
const glbCache = new Map<string, THREE.Group>();
// In-memory cache for loaded textures
const textureCache = new Map<string, THREE.Texture>();

export function isCharacterSkin(weaponTypeOrParent?: string): boolean {
  if (!weaponTypeOrParent) return false;
  const n = weaponTypeOrParent.trim().toUpperCase();
  return n === 'CHARACTER' || n === 'BODY_SKIN' || n === 'BODY SKIN' || n === 'BODY';
}

export function getModelFileName(weaponTypeOrParent?: string): string | null {
  if (!weaponTypeOrParent) return null;
  const normalized = weaponTypeOrParent.trim().toUpperCase().replace(/^_+/, '');
  return WEAPON_MODEL_MAP[normalized] || null;
}

export function has3DViewerSupport(weaponTypeOrParent?: string): boolean {
  if (!weaponTypeOrParent) return false;
  if (isCharacterSkin(weaponTypeOrParent)) return true;
  return !!getModelFileName(weaponTypeOrParent);
}

// Clean texture URL to handle Kirka API malformed URIs (e.g. 'https://kirka.iodata:image/png;base64,...' or 'https://kirka.iohttps://api2.kirka.io/...')
export function cleanTextureUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let trimmed = url.trim();

  // Fix malformed double prefix (e.g. 'https://kirka.iohttps://api2.kirka.io/...')
  const secondHttp = trimmed.indexOf('http', 8);
  if (secondHttp !== -1) {
    trimmed = trimmed.substring(secondHttp);
  }

  const dataIdx = trimmed.indexOf('data:image');
  if (dataIdx !== -1) {
    return trimmed.substring(dataIdx);
  }
  return trimmed;
}

export function getProxiedTextureUrl(url: string | null | undefined): string {
  const cleaned = cleanTextureUrl(url);
  if (!cleaned) return '';
  if (cleaned.startsWith('data:') || cleaned.startsWith('blob:') || cleaned.startsWith('/')) {
    return cleaned;
  }
  if (cleaned.startsWith('https://kirka.io/')) {
    return cleaned.replace('https://kirka.io/', '/kirka-assets/');
  }
  if (cleaned.startsWith('http://kirka.io/')) {
    return cleaned.replace('http://kirka.io/', '/kirka-assets/');
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(cleaned)}`;
}

export function getModelUrl(modelFile: string): string {
  const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
  return `${prefix}/models/${modelFile}`;
}

// Load and cache a parsed GLB scene; callers receive their own clone
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
  const tryLoad = (src: string) =>
    new Promise<THREE.Texture | null>((resolve) => {
      texLoader.load(src, (tex) => resolve(prepareSkinTexture(tex)), undefined, () => resolve(null));
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

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const t = url.trim();
  if (t === '' || t === 'https://kirka.io' || t === 'https://kirka.io/' || t === '/render') return true;
  if (t.endsWith('/render-mini.webp') || t === 'render-mini.webp') return true;
  if (t.includes('render.0e1d4800') || t.includes('render.d8456ef7')) return true;  if (t.includes('__questions__')) return true;
  return false;
}

// Kirka's catalog sometimes points a skin at another weapon's base render as a stand-in: 48 skins
// across Bayonet, VITA, MAC-10, character and more are served the base Shark image
// (render-mini.0ec8ea84.webp). Showing a Shark for a Bayonet skin is worse than showing that
// skin's own weapon, so treat "this is some other weapon's base render" as no art at all.
function borrowedFromAnotherWeapon(url: string, weapon: string | null): boolean {
  if (!url || !weapon) return false;
  try {
    const cached = getCachedCatalog();
    if (!cached || !Array.isArray(cached)) return false;
    const file = url.split('/').pop();
    if (!file) return false;
    const owner = cached.find(
      (c) =>
        c.name &&
        /^(WEAPON_\d+|CHARACTER)$/.test(String(c.type || '')) &&
        typeof c.renderUrl === 'string' &&
        c.renderUrl.endsWith(file)
    );
    if (!owner?.name) return false;
    return owner.name.trim().toLowerCase() !== weapon.trim().toLowerCase();
  } catch {
    return false;
  }
}

// Universal skin render image resolver:
// 1. Prioritize official CDN renderUrl directly for <img> tags (no proxy needed!)
// 2. Look up skin name in client-cached catalog if renderUrl is missing or placeholder
// 3. Fall back gracefully to base weapon or character render instead of flat UV textures or pistols
export function getSkinRenderUrl(itemOrName: any): string {
  if (!itemOrName) return `${import.meta.env.BASE_URL}render-mini.webp`;
  const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
  const cleanName = name ? name.replace(/^_+/, '').trim() : '';
  const rawUrl = typeof itemOrName === 'object' ? (itemOrName.renderUrl || itemOrName.renderurl) : null;
  const cleaned = cleanTextureUrl(rawUrl);

  // Which weapon this skin belongs to, so a stand-in image from a different weapon can be spotted.
  // Callers often pass just a name and a url, so fall back to looking the skin up in the catalog.
  const weaponFrom = (it: any): string | null => {
    if (!it) return null;
    if (it.type === 'BODY_SKIN' || it.type === 'CHARACTER') return 'CHARACTER';
    return it.parent?.name || null;
  };
  let ownWeapon = typeof itemOrName === 'object' ? weaponFrom(itemOrName) : null;
  if (!ownWeapon && cleanName) {
    try {
      const cached = getCachedCatalog();
      const lower = cleanName.toLowerCase();
      ownWeapon = weaponFrom(cached?.find((c) => c.name && c.name.toLowerCase() === lower));
    } catch {}
  }

  // 1. If valid renderUrl is provided, return direct CDN URL (<img> tags do not need CORS proxy)
  if (cleaned && !isPlaceholderUrl(cleaned) && !borrowedFromAnotherWeapon(cleaned, ownWeapon)) {
    return cleaned;
  }

  // 2. If renderUrl missing or placeholder, look up item in client-side cached catalog
  if (cleanName) {
    try {
      const cached = getCachedCatalog();
      if (cached && Array.isArray(cached)) {
        const lower = cleanName.toLowerCase();
        const found = cached.find((c) => c.name && c.name.toLowerCase() === lower);
        const foundClean = cleanTextureUrl(found?.renderUrl);
        const foundWeapon = found
          ? (found.type === 'BODY_SKIN' || found.type === 'CHARACTER' ? 'CHARACTER' : found.parent?.name || ownWeapon)
          : ownWeapon;
        if (foundClean && !isPlaceholderUrl(foundClean) && !borrowedFromAnotherWeapon(foundClean, foundWeapon)) {
          return foundClean;
        }
      }
    } catch {}
  }

  // 3. Query live official 3D render from api2.kirka.io if skin name is present
  if (cleanName) {
    return `https://api2.kirka.io/api/skin-render/${encodeURIComponent(cleanName)}`;
  }

  // 4. If item is a character skin without a name, return official Kirka default character render
  const isChar = typeof itemOrName === 'object' && (
    itemOrName.type === 'BODY_SKIN' ||
    itemOrName.type === 'CHARACTER' ||
    itemOrName.parent?.name === 'CHARACTER' ||
    isCharacterSkin(itemOrName.parent?.name || itemOrName.type)
  );
  if (isChar) {
    return 'https://kirka.io/assets/img/render.b8016858.png';
  }

  // 5. If item is a weapon skin with a known parent, try finding the base weapon render
  if (typeof itemOrName === 'object' && itemOrName.parent?.name) {
    const baseName = itemOrName.parent.name.trim();
    try {
      const cached = getCachedCatalog();
      if (cached && Array.isArray(cached)) {
        const lowerBase = baseName.toLowerCase();
        const foundBase = cached.find(
          (c) => c.name && (c.name.toLowerCase() === lowerBase || c.name.toLowerCase() === `_${lowerBase}`)
        );
        if (foundBase?.renderUrl && !isPlaceholderUrl(foundBase.renderUrl)) {
          return cleanTextureUrl(foundBase.renderUrl)!;
        }
      }
    } catch {}
  }

  return `${import.meta.env.BASE_URL}render-mini.webp`;
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
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
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
    <div className={`relative ${className} select-none overflow-hidden rounded-2xl bg-gradient-to-b from-[#0e1017]/80 to-[#07090e]/90 flex items-center justify-center`}>
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Drag to rotate • Scroll to zoom</span>
          </div>

          <div className="flex items-center space-x-1.5 pointer-events-auto">
            <button
              onClick={toggleAutoRotate}
              title={isAutoRotating ? 'Pause Rotation' : 'Auto Rotate'}
              className={`p-1.5 rounded-lg border backdrop-blur-md transition-all cursor-pointer ${
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
              className="p-1.5 rounded-lg border border-white/10 bg-black/60 hover:bg-black/80 text-slate-400 hover:text-white backdrop-blur-md transition-all cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

