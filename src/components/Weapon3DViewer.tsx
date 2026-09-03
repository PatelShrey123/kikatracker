import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SkinViewer, IdleAnimation } from 'skinview3d';
import { RotateCw, ZoomIn, Loader2, Sparkles } from 'lucide-react';

export const WEAPON_MODEL_MAP: Record<string, string> = {
  'VITA': 'VITA.glb',
  'SCAR': 'SCAR.glb',
  'SHARK': 'Shark.glb',
  'AR-9': 'AR-9.glb',
  'AR9': 'AR-9.glb',
  'LAR': 'LAR.glb',
  'M60': 'M60.glb',
  'MAC-10': 'MAC-10.glb',
  'MAC10': 'MAC-10.glb',
  'REVOLVER': 'Revolver.glb',
  'TOMAHAWK': 'Tomahawk.glb',
  'BAYONET': 'Bayonet.glb',
  'KNIFE': 'Bayonet.glb',
  'WEATIE': 'Weatie.glb', // Shotgun
  'SHOTGUN': 'Weatie.glb',
};

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

// Clean texture URL to handle Kirka API malformed data URIs (e.g. 'https://kirka.iodata:image/png;base64,...')
export function cleanTextureUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
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
  return `https://images.weserv.nl/?url=${encodeURIComponent(cleaned)}`;
}

interface Weapon3DViewerProps {
  weaponType?: string;
  textureUrl?: string | null;
  className?: string;
  autoRotateDefault?: boolean;
}

export const Weapon3DViewer: React.FC<Weapon3DViewerProps> = ({
  weaponType = '',
  textureUrl = null,
  className = 'w-full h-full min-h-[220px]',
  autoRotateDefault = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotateDefault);
  const controlsRef = useRef<OrbitControls | null>(null);
  const skinViewerRef = useRef<SkinViewer | null>(null);

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

      const viewer = new SkinViewer({
        canvas,
        width,
        height,
        model: 'slim', // Exact 3px slim arm Kirka / Gecko model!
        skin: cleanedTexture || undefined,
      });

      viewer.autoRotate = isAutoRotating;
      viewer.autoRotateSpeed = 1.5;
      // Stylish 3/4 perspective view
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
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.1, 1.75); // Pre-zoomed weapon view

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 2.0;
    controls.minDistance = 0.6;
    controls.maxDistance = 6.0;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.minPolarAngle = Math.PI / 8;
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

    // Texture Loader
    const loadTexturePromise = (url: string | null): Promise<THREE.Texture | null> => {
      const cleaned = cleanTextureUrl(url);
      if (!cleaned) return Promise.resolve(null);
      return new Promise((resolve) => {
        const texLoader = new THREE.TextureLoader();
        texLoader.crossOrigin = 'anonymous';

        const proxied = getProxiedTextureUrl(cleaned);

        texLoader.load(
          proxied,
          (tex) => {
            tex.flipY = false;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            resolve(tex);
          },
          undefined,
          (err1) => {
            console.warn('[3D Viewer] Proxied texture load failed, trying direct...', err1);
            texLoader.load(
              cleaned,
              (directTex) => {
                directTex.flipY = false;
                directTex.colorSpace = THREE.SRGBColorSpace;
                directTex.magFilter = THREE.NearestFilter;
                directTex.minFilter = THREE.NearestFilter;
                directTex.generateMipmaps = false;
                resolve(directTex);
              },
              undefined,
              (err2) => {
                console.warn('[3D Viewer] Direct texture load failed:', err2);
                resolve(null);
              }
            );
          }
        );
      });
    };

    if (modelFile) {
      const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
      const modelUrl = `${prefix}/models/${modelFile}`;

      const loader = new GLTFLoader();

      Promise.all([
        new Promise<THREE.Group>((resolve, reject) => {
          loader.load(modelUrl, (gltf) => resolve(gltf.scene), undefined, reject);
        }),
        loadTexturePromise(textureUrl)
      ]).then(([model, loadedTexture]) => {
        if (isDisposed) return;

        // Auto-center and PRE-ZOOM scaling (2.35 fills the frame nicely for guns!)
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 2.35 / (maxDim || 1);
        model.scale.setScalar(targetScale);

        model.position.x = -center.x * targetScale;
        model.position.y = -center.y * targetScale;
        model.position.z = -center.z * targetScale;

        if (loadedTexture) {
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = new THREE.MeshStandardMaterial({
                map: loadedTexture,
                roughness: 0.35,
                metalness: 0.1,
                side: THREE.DoubleSide
              });
              (mesh.material as THREE.Material).needsUpdate = true;
            }
          });
        } else {
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x94a3b8,
                roughness: 0.4,
                metalness: 0.3,
              });
            }
          });
        }

        scene.add(model);
        setLoading(false);
      }).catch((loadErr) => {
        if (isDisposed) return;
        console.error('Failed to load 3D assets:', loadErr);
        setError('Could not load 3D model');
        setLoading(false);
      });
    }

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      if (newWidth > 0 && newHeight > 0) {
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      }
    });
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
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
