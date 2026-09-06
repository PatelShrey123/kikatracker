import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCcw, Download, Loader2 } from 'lucide-react';
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

// Authentic James skin fallback data URI ensuring 0ms immediate character appearance
const STARTER_JAMES_SKIN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAADL0lEQVR4nO1bUZKDIAz1FH5wAHs7DgZ0tJ0eq3dwJ07TYbMgQUBxZWfeVEhAeIYQidtJKbs1KKVmgDFmHsdxAVxjfUge6r8U5nlmoeMQAJOapuk7QbzGSa7JT0+AMWaZ0P1+X54sAK6hDstr8tMTMFpmrbVeYJt7SN4IkCe3AK2118ThNyQ/PQHq6k5QfSYJTxMnCNd0G/TJqydAWfs4PDn03q59voS8CgKmaZofj8cvQB0OsqRcCMHGMAxR+hx08DRwQGC66MCgDp1aSXksAblJ6HAw1IvbT6qknGuqpdCtDRDXbEl5KR/A/jMrJooRXt/3f+RQFzJxbL8mP5wAFeHEYNKAnE6QOyHaPisB6rOPY+e+fR5N2icPtXfJD7cASRrSgVP0fd8BfDcOtQ8hNDFuu2IEyI0DbASoZgFzlUtAKfU9yMDOUss2XPVr+r4+6P3s9wlXf1EEmM9+jo1TyzhAG/YAU/UxnvDJowjQWn9fY5HJlDIOiL4e4wBT9elbpau/KAKM1SHeOKUMg7BjBgRGhTH6dMJIkh1MUXk0ASPpMLWMA3JFfnhYmqIPv8/ncwGG067ok03ANE2/Okwt27E+1UNZij7g9XotcN3/dAQYywIOIWC8+hK4k5ec1DJ6ZZ8TjNGnDpI6Qdwxkpyg+hxr29tIanltW0vVxzwEWoirvxYIqUgL0IVC4VL1nPuzCZDkJYKemm45jHC1w7rQKe3hByKCHD+XIOB2uznRCBAXsQBR0xIQiRmYWAJy6GcnYCATjik3AmSzgM5lvjHru4Q/SPIBIuATOD4Cdbj+xKdfJQGCSZBvUjH6VRAgNljI+/3+1uP15Qh4f1C1BcjEgCNkAZcnYKh9CcgMFhDy6Fwn+m8IEBu2QR92J0AkDiCU59vaflcChgQTbASoZgHzqZaA2BD62ihxqMrJ/1dzHqAKfF/Ayf9XQ4DO/H2BL3NEEx/VEGAyf19g5wnX8v9FCRARLz+5k6vc5OehBAgLudPr3PR3I0AW3AZFBE6/BOTGlw1E7u8LqBP05f93+68xyYjccn5fYOf/ccJbtsFdCTAVBkK7EqALhMKh/H8uAn4A8VgjPoKxteQAAAAASUVORK5CYII=';

/**
 * Creates a Three.js BoxGeometry with custom UV mapping configured for 64x64 Minecraft/Kirka skins.
 */
function createSkinBox(
  w: number,
  h: number,
  d: number,
  ox: number,
  oy: number,
  texW = 64,
  texH = 64
): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uvs = geo.getAttribute('uv') as THREE.BufferAttribute;
  const faces = [
    [ox, oy + d, d, h],             // +X Right
    [ox + d + w, oy + d, d, h],     // -X Left
    [ox + d, oy, w, d],             // +Y Top
    [ox + d + w, oy, w, d],         // -Y Bottom
    [ox + d, oy + d, w, h],         // +Z Front
    [ox + 2 * d + w, oy + d, w, h]  // -Z Back
  ];
  for (let f = 0; f < 6; f++) {
    const [fx, fy, fw, fh] = faces[f];
    const u0 = fx / texW;
    const u1 = (fx + fw) / texW;
    const v0 = 1.0 - (fy + fh) / texH;
    const v1 = 1.0 - fy / texH;
    const idx = f * 4;
    uvs.setXY(idx, u0, v1);
    uvs.setXY(idx + 1, u1, v1);
    uvs.setXY(idx + 2, u0, v0);
    uvs.setXY(idx + 3, u1, v0);
  }
  uvs.needsUpdate = true;
  return geo;
}

export const FitViewer3D: React.FC<FitViewer3DProps> = ({
  characterTextureUrl,
  characterName = 'Character',
  primaryWeaponType = 'SCAR',
  primaryTextureUrl,
  primarySkinName = 'Default',
  className = 'w-full h-full min-h-[460px]',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const playerGroupRef = useRef<THREE.Group | null>(null);
  const headMeshRef = useRef<THREE.Group | null>(null);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 460;

    let isDisposed = false;
    let animId: number | null = null;
    materialsRef.current = [];

    let renderer: THREE.WebGLRenderer;
    try {
      // 1. Native High-Performance WebGLRenderer
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x183c88, 1); // Kirka royal blue backdrop
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch (glErr) {
      console.error('[FitViewer3D] WebGL init failed:', glErr);
      setHasError(true);
      return;
    }

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
    camera.position.set(0, 4, 52);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 15;
    controls.maxDistance = 120;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // 3. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(15, 25, 30);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.3);
    fillLight.position.set(-20, -5, 10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.1);
    rimLight.position.set(0, 20, -25);
    scene.add(rimLight);

    // Soft drop shadow under player's feet
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
      scene.add(shadowMesh);
    }

    // 4. Pure Three.js Voxel Character Rig
    const playerGroup = new THREE.Group();
    playerGroupRef.current = playerGroup;

    // Materials: opaque for inner body, alphaTest transparent for outer overlay
    const innerMat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.FrontSide,
    });
    const outerMat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    materialsRef.current = [innerMat, outerMat];

    // --- LIMBS CREATION (Slim Kirka Model: 3px arms) ---
    // A. Head Group (Pivot at bottom of neck: y = 6)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 6, 0);
    const headInner = new THREE.Mesh(createSkinBox(8, 8, 8, 0, 0), innerMat);
    headInner.position.set(0, 4, 0);
    const headOuter = new THREE.Mesh(createSkinBox(8.6, 8.6, 8.6, 32, 0), outerMat);
    headOuter.position.set(0, 4, 0);
    headGroup.add(headInner, headOuter);
    headMeshRef.current = headGroup;

    // B. Torso (Center at y = 0)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0, 0);
    const torsoInner = new THREE.Mesh(createSkinBox(8, 12, 4, 16, 16), innerMat);
    const torsoOuter = new THREE.Mesh(createSkinBox(8.5, 12.5, 4.5, 16, 32), outerMat);
    torsoGroup.add(torsoInner, torsoOuter);

    // C. Right Arm (Slim 3x12x4, pivot at shoulder: x = -5.5, y = 6)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(-5.5, 6, 0);
    const rightArmInner = new THREE.Mesh(createSkinBox(3, 12, 4, 40, 16), innerMat);
    rightArmInner.position.set(0, -6, 0);
    const rightArmOuter = new THREE.Mesh(createSkinBox(3.5, 12.5, 4.5, 40, 32), outerMat);
    rightArmOuter.position.set(0, -6, 0);
    rightArmGroup.add(rightArmInner, rightArmOuter);

    // D. Left Arm (Slim 3x12x4, pivot at shoulder: x = 5.5, y = 6)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(5.5, 6, 0);
    const leftArmInner = new THREE.Mesh(createSkinBox(3, 12, 4, 32, 48), innerMat);
    leftArmInner.position.set(0, -6, 0);
    const leftArmOuter = new THREE.Mesh(createSkinBox(3.5, 12.5, 4.5, 48, 48), outerMat);
    leftArmOuter.position.set(0, -6, 0);
    leftArmGroup.add(leftArmInner, leftArmOuter);

    // E. Right Leg (4x12x4, pivot at hip: x = -2, y = -6)
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(-2, -6, 0);
    const rightLegInner = new THREE.Mesh(createSkinBox(4, 12, 4, 0, 16), innerMat);
    rightLegInner.position.set(0, -6, 0);
    const rightLegOuter = new THREE.Mesh(createSkinBox(4.5, 12.5, 4.5, 0, 32), outerMat);
    rightLegOuter.position.set(0, -6, 0);
    rightLegGroup.add(rightLegInner, rightLegOuter);

    // F. Left Leg (4x12x4, pivot at hip: x = 2, y = -6)
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(2, -6, 0);
    const leftLegInner = new THREE.Mesh(createSkinBox(4, 12, 4, 16, 48), innerMat);
    leftLegInner.position.set(0, -6, 0);
    const leftLegOuter = new THREE.Mesh(createSkinBox(4.5, 12.5, 4.5, 0, 48), outerMat);
    leftLegOuter.position.set(0, -6, 0);
    leftLegGroup.add(leftLegInner, leftLegOuter);

    // Authentic Kirka Gun-Holding Pose (Matching in-game inventory loadout)
    playerGroup.rotation.y = 0.32;
    headGroup.rotation.set(0.08, -0.16, 0);
    rightArmGroup.rotation.set(-0.55, -0.15, 0.62);
    leftArmGroup.rotation.set(-0.72, 0.32, -0.72);
    rightLegGroup.rotation.set(-0.12, 0.1, -0.08);
    leftLegGroup.rotation.set(0.08, -0.05, 0.04);

    playerGroup.add(headGroup, torsoGroup, rightArmGroup, leftArmGroup, rightLegGroup, leftLegGroup);
    playerGroup.position.set(0, -2, 0);
    scene.add(playerGroup);

    // Texture Loader with immediate James fallback
    const cleanedCharTex = cleanTextureUrl(characterTextureUrl);
    const targetCharUrl = cleanedCharTex ? getProxiedTextureUrl(cleanedCharTex) : STARTER_JAMES_SKIN;

    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = 'anonymous';

    const applyTextureToMats = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      innerMat.map = tex;
      outerMat.map = tex;
      innerMat.needsUpdate = true;
      outerMat.needsUpdate = true;
    };

    texLoader.load(
      targetCharUrl,
      (tex) => {
        if (isDisposed) return;
        applyTextureToMats(tex);
      },
      undefined,
      () => {
        if (isDisposed) return;
        texLoader.load(STARTER_JAMES_SKIN, (fTex) => {
          if (isDisposed) return;
          applyTextureToMats(fTex);
        });
      }
    );

    // 5. Load & Attach 3D Primary Weapon Model
    const normalizedWeapon = (primaryWeaponType || 'SCAR').trim().toUpperCase().replace(/^_+/, '');
    const modelFile = WEAPON_MODEL_MAP[normalizedWeapon] || 'SCAR.glb';

    const attachWeapon = (gltfGroup: THREE.Group) => {
      if (isDisposed) return;
      if (weaponMeshRef.current) {
        playerGroup.remove(weaponMeshRef.current);
        weaponMeshRef.current = null;
      }

      const gunClone = gltfGroup.clone(true);

      // Proportionally scale weapon to voxel character proportions
      const box = new THREE.Box3().setFromObject(gunClone);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetScale = 18.5 / maxDim;
      gunClone.scale.setScalar(targetScale);

      // Sits directly cradled in both hands across the chest
      gunClone.position.set(-0.3, -0.45, 6.9);
      gunClone.rotation.set(-0.25, 0.42, -0.58);

      // Apply weapon skin texture if provided
      const cleanedGunTex = cleanTextureUrl(primaryTextureUrl);
      if (cleanedGunTex) {
        const proxiedTexUrl = getProxiedTextureUrl(cleanedGunTex);
        const gunLoader = new THREE.TextureLoader();
        gunLoader.crossOrigin = 'anonymous';
        gunLoader.load(
          proxiedTexUrl,
          (tex) => {
            if (isDisposed) return;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
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
          },
          undefined,
          (texErr) => {
            console.warn('[FitViewer3D] Gun texture load fallback:', texErr);
          }
        );
      }

      playerGroup.add(gunClone);
      weaponMeshRef.current = gunClone;
      setLoading(false);
    };

    if (gltfModelCache.has(modelFile)) {
      attachWeapon(gltfModelCache.get(modelFile)!);
    } else {
      const loader = new GLTFLoader();
      const prefix = window.location.pathname.startsWith('/kikatracker') ? '/kikatracker' : '';
      const primaryPath = `${prefix}/models/${modelFile}`;
      const fallbackPath = `/models/${modelFile}`;

      loader.load(
        primaryPath,
        (gltf) => {
          if (isDisposed) return;
          gltfModelCache.set(modelFile, gltf.scene);
          attachWeapon(gltf.scene);
        },
        undefined,
        () => {
          loader.load(
            fallbackPath,
            (fallbackGltf) => {
              if (isDisposed) return;
              gltfModelCache.set(modelFile, fallbackGltf.scene);
              attachWeapon(fallbackGltf.scene);
            },
            undefined,
            (err) => {
              console.warn(`[FitViewer3D] Could not load model for ${modelFile}:`, err);
              if (!isDisposed) setLoading(false);
            }
          );
        }
      );
    }

    // 6. Smooth 60 FPS Render Loop
    const animate = () => {
      if (isDisposed) return;
      animId = requestAnimationFrame(animate);

      // Subtle breathing motion for showcase realism
      const t = Date.now() * 0.002;
      if (headMeshRef.current) {
        headMeshRef.current.rotation.y = -0.18 + Math.sin(t) * 0.03;
        headMeshRef.current.rotation.x = 0.08 + Math.cos(t * 0.8) * 0.015;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container || isDisposed) return;
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
      if (animId !== null) cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      controlsRef.current = null;
      playerGroupRef.current = null;
      headMeshRef.current = null;
      weaponMeshRef.current = null;
    };
  }, [characterTextureUrl, primaryWeaponType, primaryTextureUrl]);

  const handleExportSnapshot = () => {
    if (!rendererRef.current) return;
    try {
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `kirka_fit_${characterName.replace(/\s+/g, '_')}_${primarySkinName.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[FitViewer3D] Snapshot failed:', err);
    }
  };

  const handleResetView = () => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.object.position.set(0, 4, 52);
    controlsRef.current.update();
  };

  if (hasError) {
    return (
      <div className={`relative rounded-2xl overflow-hidden border border-red-500/30 bg-[#0e162a] flex items-center justify-center p-6 text-center ${className}`}>
        <div className="space-y-2">
          <p className="text-sm font-bold text-red-400">WebGL 3D Viewport Offline</p>
          <p className="text-xs text-slate-400">Please enable hardware acceleration or refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-indigo-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-[#183c88] ${className}`}>
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Camera and Snapshot controls (Top Right) */}
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
            Equipping Loadout in 3D...
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
