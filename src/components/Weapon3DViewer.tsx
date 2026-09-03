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

// Map 6 BoxGeometry faces to specific [x1, y1, x2, y2] coordinates on a 64x64 texture
function mapBoxUVs(
  geo: THREE.BoxGeometry,
  right: [number, number, number, number],
  left: [number, number, number, number],
  top: [number, number, number, number],
  bottom: [number, number, number, number],
  front: [number, number, number, number],
  back: [number, number, number, number]
) {
  const uv = geo.attributes.uv;
  const faces = [right, left, top, bottom, front, back];
  faces.forEach(([x1, y1, x2, y2], f) => {
    const uMin = x1 / 64;
    const uMax = (x2 + 1) / 64;
    const vMin = 1 - ((y2 + 1) / 64);
    const vMax = 1 - (y1 / 64);
    const off = f * 4;
    uv.setXY(off + 0, uMin, vMax);
    uv.setXY(off + 1, uMax, vMax);
    uv.setXY(off + 2, uMin, vMin);
    uv.setXY(off + 3, uMax, vMin);
  });
  uv.needsUpdate = true;
}

// Build authentic 3px Kirka Character Model adhering 100% to Gecko's 3px UV Template
function createGecko3pxCharacter(texture: THREE.Texture): THREE.Group {
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

  const p = 0.06; // unit scale per pixel

  // 1. HEAD (8x8x8)
  const headGeo = new THREE.BoxGeometry(8 * p, 8 * p, 8 * p);
  mapBoxUVs(
    headGeo,
    [0, 8, 7, 15],   // Right
    [16, 8, 23, 15], // Left
    [8, 0, 15, 7],   // Top
    [16, 0, 23, 7],  // Bottom
    [8, 8, 15, 15],  // Front
    [24, 8, 31, 15]  // Back
  );
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 10 * p, 0);
  group.add(headMesh);

  // HAT (Outer Layer 8.6x8.6x8.6)
  const hatGeo = new THREE.BoxGeometry(8.6 * p, 8.6 * p, 8.6 * p);
  mapBoxUVs(
    hatGeo,
    [32, 8, 39, 15], // Right
    [48, 8, 55, 15], // Left
    [40, 0, 47, 7],  // Top
    [48, 0, 55, 7],  // Bottom
    [40, 8, 47, 15], // Front
    [56, 8, 63, 15]  // Back
  );
  const hatMesh = new THREE.Mesh(hatGeo, skinMatAlpha);
  hatMesh.position.set(0, 10 * p, 0);
  group.add(hatMesh);

  // 2. TORSO (8x12x4)
  const torsoGeo = new THREE.BoxGeometry(8 * p, 12 * p, 4 * p);
  mapBoxUVs(
    torsoGeo,
    [16, 20, 19, 31], // Right
    [28, 20, 31, 31], // Left
    [20, 16, 27, 19], // Top
    [28, 16, 35, 19], // Bottom
    [20, 20, 27, 31], // Front
    [32, 20, 39, 31]  // Back
  );
  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  torsoMesh.position.set(0, 0, 0);
  group.add(torsoMesh);

  // JACKET (Outer Layer 8.6x12.6x4.6)
  const jacketGeo = new THREE.BoxGeometry(8.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(
    jacketGeo,
    [16, 36, 19, 47], // Right
    [28, 36, 31, 47], // Left
    [20, 32, 27, 35], // Top
    [28, 32, 35, 35], // Bottom
    [20, 36, 27, 47], // Front
    [32, 36, 39, 47]  // Back
  );
  const jacketMesh = new THREE.Mesh(jacketGeo, skinMatAlpha);
  jacketMesh.position.set(0, 0, 0);
  group.add(jacketMesh);

  // 3. RIGHT ARM (3x12x4 - Authentic 3px Slim!)
  const rightArmGeo = new THREE.BoxGeometry(3 * p, 12 * p, 4 * p);
  mapBoxUVs(
    rightArmGeo,
    [40, 20, 43, 31], // Right
    [47, 20, 50, 31], // Left
    [44, 16, 46, 19], // Top
    [47, 16, 49, 19], // Bottom
    [44, 20, 46, 31], // Front
    [51, 20, 53, 31]  // Back
  );
  const rightArmMesh = new THREE.Mesh(rightArmGeo, skinMat);
  rightArmMesh.position.set(-5.5 * p, 0, 0);
  group.add(rightArmMesh);

  // RIGHT SLEEVE (Outer Layer 3.6x12.6x4.6)
  const rightSleeveGeo = new THREE.BoxGeometry(3.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(
    rightSleeveGeo,
    [40, 36, 43, 47], // Right
    [47, 36, 50, 47], // Left
    [44, 32, 46, 35], // Top
    [47, 32, 49, 35], // Bottom
    [44, 36, 46, 47], // Front
    [51, 36, 53, 47]  // Back
  );
  const rightSleeveMesh = new THREE.Mesh(rightSleeveGeo, skinMatAlpha);
  rightSleeveMesh.position.set(-5.5 * p, 0, 0);
  group.add(rightSleeveMesh);

  // 4. LEFT ARM (3x12x4 - Authentic 3px Slim!)
  const leftArmGeo = new THREE.BoxGeometry(3 * p, 12 * p, 4 * p);
  mapBoxUVs(
    leftArmGeo,
    [32, 52, 35, 63], // Right
    [39, 52, 42, 63], // Left
    [36, 48, 38, 51], // Top
    [39, 48, 41, 51], // Bottom
    [36, 52, 38, 63], // Front
    [43, 52, 45, 63]  // Back
  );
  const leftArmMesh = new THREE.Mesh(leftArmGeo, skinMat);
  leftArmMesh.position.set(5.5 * p, 0, 0);
  group.add(leftArmMesh);

  // LEFT SLEEVE (Outer Layer 3.6x12.6x4.6)
  const leftSleeveGeo = new THREE.BoxGeometry(3.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(
    leftSleeveGeo,
    [48, 52, 51, 63], // Right
    [55, 52, 58, 63], // Left
    [52, 48, 54, 51], // Top
    [55, 48, 57, 51], // Bottom
    [52, 52, 54, 63], // Front
    [59, 52, 61, 63]  // Back
  );
  const leftSleeveMesh = new THREE.Mesh(leftSleeveGeo, skinMatAlpha);
  leftSleeveMesh.position.set(5.5 * p, 0, 0);
  group.add(leftSleeveMesh);

  // 5. RIGHT LEG (4x12x4)
  const rightLegGeo = new THREE.BoxGeometry(4 * p, 12 * p, 4 * p);
  mapBoxUVs(
    rightLegGeo,
    [0, 20, 3, 31],   // Right
    [8, 20, 11, 31],  // Left
    [4, 16, 7, 19],   // Top
    [8, 16, 11, 19],  // Bottom
    [4, 20, 7, 31],   // Front
    [12, 20, 15, 31]  // Back
  );
  const rightLegMesh = new THREE.Mesh(rightLegGeo, skinMat);
  rightLegMesh.position.set(-2 * p, -12 * p, 0);
  group.add(rightLegMesh);

  // RIGHT PANT (Outer Layer 4.6x12.6x4.6)
  const rightPantGeo = new THREE.BoxGeometry(4.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(
    rightPantGeo,
    [0, 36, 3, 47],   // Right
    [8, 36, 11, 47],  // Left
    [4, 32, 7, 35],   // Top
    [8, 32, 11, 35],  // Bottom
    [4, 36, 7, 47],   // Front
    [12, 36, 15, 47]  // Back
  );
  const rightPantMesh = new THREE.Mesh(rightPantGeo, skinMatAlpha);
  rightPantMesh.position.set(-2 * p, -12 * p, 0);
  group.add(rightPantMesh);

  // 6. LEFT LEG (4x12x4)
  const leftLegGeo = new THREE.BoxGeometry(4 * p, 12 * p, 4 * p);
  mapBoxUVs(
    leftLegGeo,
    [16, 52, 19, 63], // Right
    [24, 52, 27, 63], // Left
    [20, 48, 23, 51], // Top
    [24, 48, 27, 51], // Bottom
    [20, 52, 23, 63], // Front
    [28, 52, 31, 63]  // Back
  );
  const leftLegMesh = new THREE.Mesh(leftLegGeo, skinMat);
  leftLegMesh.position.set(2 * p, -12 * p, 0);
  group.add(leftLegMesh);

  // LEFT PANT (Outer Layer 4.6x12.6x4.6)
  const leftPantGeo = new THREE.BoxGeometry(4.6 * p, 12.6 * p, 4.6 * p);
  mapBoxUVs(
    leftPantGeo,
    [0, 52, 3, 63],   // Right
    [8, 52, 11, 63],  // Left
    [4, 48, 7, 51],   // Top
    [8, 48, 11, 51],  // Bottom
    [4, 52, 7, 63],   // Front
    [12, 52, 15, 63]  // Back
  );
  const leftPantMesh = new THREE.Mesh(leftPantGeo, skinMatAlpha);
  leftPantMesh.position.set(2 * p, -12 * p, 0);
  group.add(leftPantMesh);

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

    // 2. Camera setup - Perfectly framed for character vs weapon!
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, isChar ? -0.1 : 0.1, isChar ? 2.3 : 1.75);

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
    controls.maxDistance = 6.0;
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

    // Helper: Load texture with CORS proxy & data URI support
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

    // Load authentic Gecko 3px Character OR weapon GLB
    if (isChar) {
      loadTexturePromise(textureUrl).then((loadedTexture) => {
        if (isDisposed) return;

        const charGroup = createGecko3pxCharacter(loadedTexture || new THREE.Texture());
        
        // Auto center
        const box = new THREE.Box3().setFromObject(charGroup);
        const center = box.getCenter(new THREE.Vector3());
        charGroup.position.x = -center.x;
        charGroup.position.y = -center.y;
        charGroup.position.z = -center.z;
        charGroup.scale.setScalar(1.15); // Perfectly scaled so entire body fits cleanly!

        scene.add(charGroup);
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

        // Auto-center and PRE-ZOOM scaling (2.35 fills the frame nicely for guns!)
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

    // 7. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
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
