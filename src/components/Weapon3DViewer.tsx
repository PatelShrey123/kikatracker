import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

export function getProxiedTextureUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
    return url;
  }
  // images.weserv.nl provides global Cloudflare CDN with Access-Control-Allow-Origin: *
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
}

// Fallback Helper: Set UV coordinates for BoxGeometry faces (64x64 texture format)
function setBoxFaceUVs(
  geometry: THREE.BoxGeometry,
  uMin: number, vMin: number, uMax: number, vMax: number,
  textureWidth = 64, textureHeight = 64
) {
  const uvAttr = geometry.attributes.uv;
  const u1 = uMin / textureWidth;
  const v1 = 1 - (vMax / textureHeight);
  const u2 = uMax / textureWidth;
  const v2 = 1 - (vMin / textureHeight);

  for (let i = 0; i < uvAttr.count; i += 4) {
    uvAttr.setXY(i, u1, v2);
    uvAttr.setXY(i + 1, u2, v2);
    uvAttr.setXY(i + 2, u1, v1);
    uvAttr.setXY(i + 3, u2, v1);
  }
  uvAttr.needsUpdate = true;
}

function createKirka3pxCharacter(texture: THREE.Texture): THREE.Group {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const skinMatAlpha = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.05,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  const p = 0.06;

  // Head
  const headGeo = new THREE.BoxGeometry(8 * p, 8 * p, 8 * p);
  setBoxFaceUVs(headGeo, 8, 8, 16, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 10 * p, 0);
  group.add(headMesh);

  // Hat Layer
  const hatGeo = new THREE.BoxGeometry(8.8 * p, 8.8 * p, 8.8 * p);
  setBoxFaceUVs(hatGeo, 40, 8, 48, 16);
  const hatMesh = new THREE.Mesh(hatGeo, skinMatAlpha);
  hatMesh.position.set(0, 10 * p, 0);
  group.add(hatMesh);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(8 * p, 12 * p, 4 * p);
  setBoxFaceUVs(torsoGeo, 20, 20, 28, 32);
  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  torsoMesh.position.set(0, 0, 0);
  group.add(torsoMesh);

  // Arms (3px slim)
  const rightArmGeo = new THREE.BoxGeometry(3 * p, 12 * p, 4 * p);
  setBoxFaceUVs(rightArmGeo, 44, 20, 47, 32);
  const rightArmMesh = new THREE.Mesh(rightArmGeo, skinMat);
  rightArmMesh.position.set(-5.5 * p, 0, 0);
  group.add(rightArmMesh);

  const leftArmGeo = new THREE.BoxGeometry(3 * p, 12 * p, 4 * p);
  setBoxFaceUVs(leftArmGeo, 36, 52, 39, 64);
  const leftArmMesh = new THREE.Mesh(leftArmGeo, skinMat);
  leftArmMesh.position.set(5.5 * p, 0, 0);
  group.add(leftArmMesh);

  // Legs
  const rightLegGeo = new THREE.BoxGeometry(4 * p, 12 * p, 4 * p);
  setBoxFaceUVs(rightLegGeo, 4, 20, 8, 32);
  const rightLegMesh = new THREE.Mesh(rightLegGeo, skinMat);
  rightLegMesh.position.set(-2 * p, -12 * p, 0);
  group.add(rightLegMesh);

  const leftLegGeo = new THREE.BoxGeometry(4 * p, 12 * p, 4 * p);
  setBoxFaceUVs(leftLegGeo, 20, 52, 24, 64);
  const leftLegMesh = new THREE.Mesh(leftLegGeo, skinMat);
  leftLegMesh.position.set(2 * p, -12 * p, 0);
  group.add(leftLegMesh);

  return group;
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
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

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

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup - Pre-zoomed view so details fill the frame immediately!
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.12, isChar ? 1.9 : 1.75);

    // 3. Renderer setup
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

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = isAutoRotating;
    controls.autoRotateSpeed = 2.0;
    controls.minDistance = 0.6;
    controls.maxDistance = 5.0;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.minPolarAngle = Math.PI / 8;
    controlsRef.current = controls;

    // 5. Studio Lighting
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

    // Helper: Load texture with CORS proxy & fallback
    const loadTexturePromise = (url: string | null): Promise<THREE.Texture | null> => {
      if (!url) return Promise.resolve(null);
      return new Promise((resolve) => {
        const texLoader = new THREE.TextureLoader();
        texLoader.crossOrigin = 'anonymous';

        const proxied = getProxiedTextureUrl(url);

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
              url,
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

    // Load character (from Character.glb with Idle animation) OR weapon GLB
    if (isChar) {
      const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
      const charModelUrl = `${prefix}/models/Character.glb`;
      const loader = new GLTFLoader();

      Promise.all([
        new Promise<any>((resolve) => {
          loader.load(
            charModelUrl,
            (gltf) => resolve(gltf),
            undefined,
            (err) => {
              console.warn('Character.glb not found or failed, using procedural fallback:', err);
              resolve(null);
            }
          );
        }),
        loadTexturePromise(textureUrl)
      ]).then(([gltf, loadedTexture]) => {
        if (isDisposed) return;

        if (gltf && gltf.scene) {
          const charModel = gltf.scene;

          // Play Idle animation if available
          if (gltf.animations && gltf.animations.length > 0) {
            mixerRef.current = new THREE.AnimationMixer(charModel);
            const idleClip = gltf.animations.find((a: any) => a.name.toLowerCase() === 'idle') || gltf.animations[0];
            if (idleClip) {
              const action = mixerRef.current.clipAction(idleClip);
              action.play();
            }
          }

          // Pre-zoomed scaling
          const box = new THREE.Box3().setFromObject(charModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetScale = 2.4 / (maxDim || 1); // Pre-zoomed!
          charModel.scale.setScalar(targetScale);

          charModel.position.x = -center.x * targetScale;
          charModel.position.y = -center.y * targetScale;
          charModel.position.z = -center.z * targetScale;

          if (loadedTexture) {
            charModel.traverse((child: any) => {
              if (child.isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.material = new THREE.MeshStandardMaterial({
                  map: loadedTexture,
                  roughness: 0.4,
                  metalness: 0.05,
                  side: THREE.DoubleSide
                });
                (mesh.material as THREE.Material).needsUpdate = true;
              }
            });
          }

          scene.add(charModel);
        } else {
          // Procedural fallback model
          const charGroup = createKirka3pxCharacter(loadedTexture || new THREE.Texture());
          const box = new THREE.Box3().setFromObject(charGroup);
          const center = box.getCenter(new THREE.Vector3());
          charGroup.position.x = -center.x;
          charGroup.position.y = -center.y;
          charGroup.position.z = -center.z;
          charGroup.scale.setScalar(1.5);
          scene.add(charGroup);
        }

        setLoading(false);
      });
    } else if (modelFile) {
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

        // Auto-center and PRE-ZOOM scaling (2.35 fills the frame nicely!)
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 2.35 / (maxDim || 1); // Pre-zoomed for instant inspection!
        model.scale.setScalar(targetScale);

        model.position.x = -center.x * targetScale;
        model.position.y = -center.y * targetScale;
        model.position.z = -center.z * targetScale;

        // Apply dynamic skin texture
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
          // Default clean metallic finish
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

    // 7. Animation Loop with Clock for Skeletal Animations
    const clock = new THREE.Clock();
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. Resize Observer
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

    // Cleanup
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
      if (controlsRef.current) {
        controlsRef.current.autoRotate = next;
      }
      return next;
    });
  };

  const resetCamera = () => {
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
