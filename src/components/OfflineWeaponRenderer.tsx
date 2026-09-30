import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface QueueItem {
  name: string;
  cleanName: string;
  modelFile: string;
  textureDataUrl: string;
}

export const OfflineWeaponRenderer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>('Initializing...');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!containerRef.current) return;

      const width = 400;
      const height = 250;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(0, 0.1, 1.75);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;

      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);

      // Studio Lighting matching Weapon3DViewer
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

      const gltfLoader = new GLTFLoader();
      const texLoader = new THREE.TextureLoader();
      texLoader.crossOrigin = 'anonymous';

      const modelCache = new Map<string, THREE.Group>();

      const loadModel = (file: string): Promise<THREE.Group> => {
        if (modelCache.has(file)) {
          return Promise.resolve(modelCache.get(file)!.clone(true));
        }
        return new Promise((resolve, reject) => {
          gltfLoader.load(
            `/models/${file}`,
            (gltf) => {
              modelCache.set(file, gltf.scene);
              resolve(gltf.scene.clone(true));
            },
            undefined,
            reject
          );
        });
      };

      const loadTexture = (url: string): Promise<THREE.Texture | null> => {
        return new Promise((resolve) => {
          texLoader.load(
            url,
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
      };

      try {
        const res = await fetch('http://localhost:5174/queue');
        const queue: QueueItem[] = await res.json();

        for (let i = 0; i < queue.length; i++) {
          if (cancelled) break;
          const item = queue[i];
          setStatus(`Rendering [${i + 1}/${queue.length}]: ${item.name}`);

          try {
            const model = await loadModel(item.modelFile);
            const tex = await loadTexture(`http://localhost:5174/texture?name=${encodeURIComponent(item.cleanName)}`);

            model.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (tex) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    map: tex,
                    roughness: 0.35,
                    metalness: 0.1,
                    side: THREE.DoubleSide,
                  });
                }
              }
            });

            // Calculate bounding box and scale
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

            renderer.render(scene, camera);

            const pngDataUrl = renderer.domElement.toDataURL('image/png');
            scene.remove(pivot);

            await fetch('http://localhost:5174/save-render', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: item.name, dataUrl: pngDataUrl }),
            });
          } catch (itemErr) {
            console.error('Error rendering item:', item.name, itemErr);
          }
        }

        if (!cancelled) {
          setStatus('ALL COMPLETED!');
          await fetch('http://localhost:5174/done', { method: 'POST' });
        }
      } catch (err) {
        console.error('Offline renderer error:', err);
        setStatus('FAILED: ' + String(err));
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 20, background: '#111', color: '#fff', fontFamily: 'monospace' }}>
      <h2>Offline Weapon Renderer</h2>
      <div id="renderer-status" style={{ marginBottom: 10, color: '#38bdf8' }}>{status}</div>
      <div ref={containerRef} style={{ width: 400, height: 250, border: '1px solid #333' }} />
    </div>
  );
};
