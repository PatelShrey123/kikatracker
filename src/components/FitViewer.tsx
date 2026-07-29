import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Search, Layers, Plus, Sparkles } from 'lucide-react';
import type { UserProfile } from '../utils/api';

interface FitViewerProps {
  profile: UserProfile;
  publicItems: any[];
  allItemData: any[];
  fallbackRenders: Record<string, any>;
}

// UV Pixel maps on a standard 64x64 Minecraft skin layout
const MAPPINGS = {
  head: {
    right: [0, 8, 8, 8],
    left: [16, 8, 8, 8],
    top: [8, 0, 8, 8],
    bottom: [16, 0, 8, 8],
    front: [8, 8, 8, 8],
    back: [24, 8, 8, 8]
  },
  headOverlay: {
    right: [32, 8, 8, 8],
    left: [48, 8, 8, 8],
    top: [40, 0, 8, 8],
    bottom: [48, 0, 8, 8],
    front: [40, 8, 8, 8],
    back: [56, 8, 8, 8]
  },
  torso: {
    right: [16, 20, 4, 12],
    left: [28, 20, 4, 12],
    top: [20, 16, 8, 4],
    bottom: [28, 16, 8, 4],
    front: [20, 20, 8, 12],
    back: [32, 20, 8, 12]
  },
  torsoOverlay: {
    right: [16, 36, 4, 12],
    left: [28, 36, 4, 12],
    top: [20, 32, 8, 4],
    bottom: [28, 32, 8, 4],
    front: [20, 36, 8, 12],
    back: [32, 36, 8, 12]
  },
  rightArm: {
    right: [40, 20, 4, 12],
    left: [48, 20, 4, 12],
    top: [44, 16, 4, 4],
    bottom: [48, 16, 4, 4],
    front: [44, 20, 4, 12],
    back: [52, 20, 4, 12]
  },
  rightArmOverlay: {
    right: [40, 36, 4, 12],
    left: [48, 36, 4, 12],
    top: [44, 32, 4, 4],
    bottom: [48, 32, 4, 4],
    front: [44, 36, 4, 12],
    back: [52, 36, 4, 12]
  },
  leftArm: {
    right: [32, 52, 4, 12],
    left: [40, 52, 4, 12],
    top: [36, 48, 4, 4],
    bottom: [40, 48, 4, 4],
    front: [36, 52, 4, 12],
    back: [44, 52, 4, 12]
  },
  leftArmOverlay: {
    right: [48, 52, 4, 12],
    left: [56, 52, 4, 12],
    top: [52, 48, 4, 4],
    bottom: [56, 48, 4, 4],
    front: [52, 52, 4, 12],
    back: [60, 52, 4, 12]
  },
  rightLeg: {
    right: [0, 20, 4, 12],
    left: [8, 20, 4, 12],
    top: [4, 16, 4, 4],
    bottom: [8, 16, 4, 4],
    front: [4, 20, 4, 12],
    back: [12, 20, 4, 12]
  },
  rightLegOverlay: {
    right: [0, 36, 4, 12],
    left: [8, 36, 4, 12],
    top: [4, 32, 4, 4],
    bottom: [8, 32, 4, 4],
    front: [4, 36, 4, 12],
    back: [12, 36, 4, 12]
  },
  leftLeg: {
    right: [16, 52, 4, 12],
    left: [24, 52, 4, 12],
    top: [20, 48, 4, 4],
    bottom: [24, 48, 4, 4],
    front: [20, 52, 4, 12],
    back: [28, 52, 4, 12]
  },
  leftLegOverlay: {
    right: [0, 48, 4, 12],
    left: [8, 48, 4, 12],
    top: [4, 48, 4, 4],
    bottom: [8, 48, 4, 4],
    front: [4, 48, 4, 12],
    back: [12, 48, 4, 12]
  }
};

export const FitViewer: React.FC<FitViewerProps> = ({
  profile,
  publicItems,
  allItemData,
  fallbackRenders
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Slot selections
  const [selectedBody, setSelectedBody] = useState<any>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<any>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<any>(null);
  const [selectedMelee, setSelectedMelee] = useState<any>(null);

  // Active Dropdowns state
  const [activeDropdown, setActiveDropdown] = useState<'body' | 'primary' | 'secondary' | 'melee' | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Three.js instances refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playerGroupRef = useRef<THREE.Group | null>(null);
  const rightArmRef = useRef<THREE.Mesh | null>(null);
  const leftArmRef = useRef<THREE.Mesh | null>(null);

  // Drag interaction states
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  // Pre-grouped catalog filters
  const catalog = useMemo(() => {
    const bodies = publicItems.filter(i => i.type === 'BODY_SKIN');
    const primaries = publicItems.filter(i => i.type === 'WEAPON_SKIN' && i.parent?.type === 'WEAPON_1');
    const secondaries = publicItems.filter(i => i.type === 'WEAPON_SKIN' && i.parent?.type === 'WEAPON_2');
    const melees = publicItems.filter(i => i.type === 'WEAPON_SKIN' && i.parent?.type === 'WEAPON_3');

    return { bodies, primaries, secondaries, melees };
  }, [publicItems]);

  // Resolve texture URL helper
  const getTextureUrl = (bodySkin: any) => {
    if (!bodySkin) return '';
    if (bodySkin.textureUrl) return bodySkin.textureUrl;
    
    // Look up in allItemData
    const nameKey = bodySkin.name.toLowerCase();
    const matched = allItemData.find(
      (i) => i.name.toLowerCase() === nameKey && i.type === 'BODY_SKIN'
    );
    return matched ? matched.textureUrl : '';
  };

  // Helper to resolve skin image render URL
  const getItemRenderUrl = (item: any) => {
    if (!item) return null;
    if (item.renderUrl) return item.renderUrl;

    const cleanName = item.name.replace(/^_+/, '');
    const nameKey = cleanName.toLowerCase();
    const fallback = fallbackRenders[nameKey];
    if (fallback && fallback.renderurl) return fallback.renderurl;

    if (item.parent?.name) {
      const comboKey = `${cleanName.toLowerCase()} ${item.parent.name.toLowerCase()}`;
      const comboFallback = fallbackRenders[comboKey];
      if (comboFallback && comboFallback.renderurl) return comboFallback.renderurl;
    }
    return null;
  };

  // 1. Initialize slots with profile's currently equipped skins on load
  useEffect(() => {
    if (profile) {
      if (profile.activeBodySkin) {
        setSelectedBody(profile.activeBodySkin);
      } else {
        // Use default mock body skin if none equipped
        setSelectedBody(catalog.bodies[0] || null);
      }

      if (profile.activeWeapon1Skin) {
        setSelectedPrimary(profile.activeWeapon1Skin);
      } else {
        setSelectedPrimary(catalog.primaries[0] || null);
      }

      // Default secondary and melee selections if not directly on profile
      setSelectedSecondary(catalog.secondaries[0] || null);
      setSelectedMelee(catalog.melees[0] || null);
    }
  }, [profile, catalog]);

  // 2. Setup Three.js Scene and Renderer
  useEffect(() => {
    if (!containerRef.current) return;

    // Dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null; // transparent to use CSS backdrops

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, 25);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.25);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    // Main Player Group
    const playerGroup = new THREE.Group();
    scene.add(playerGroup);
    playerGroupRef.current = playerGroup;

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Subtle breathing idle animations
      const time = clock.getElapsedTime();
      const group = playerGroupRef.current;
      if (group) {
        // Player bobbing
        group.position.y = Math.sin(time * 2) * 0.12 - 2.8;
        
        // Auto slow spin when not dragging
        if (!isDragging.current) {
          group.rotation.y += 0.005;
        }
      }

      // Sync weapon with breathing bobbing
      if (rightArmRef.current && leftArmRef.current) {
        // Subtle arm movements
        rightArmRef.current.rotation.z = Math.sin(time * 2) * 0.02 - 0.05;
        leftArmRef.current.rotation.z = -Math.sin(time * 2) * 0.02 + 0.05;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // 3. Rebuild 3D Model when Selected Body Skin or Equipped Weapon changes
  useEffect(() => {
    const scene = sceneRef.current;
    const group = playerGroupRef.current;
    if (!scene || !group) return;

    // Clear previous model contents in the player group
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    rightArmRef.current = null;
    leftArmRef.current = null;

    // Default skin texture (Steve fallback)
    const fallbackTexture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnNtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGV4dD0iQWRvYmUgWE1QIENvcmUgNS4zLWMwMTEgNjYuMTQ1NjYxLCAyMDEyLzAyLzA2LTE0OjU2OjI3ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpydGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9jccontainment.org/xap/1.0/sType/ResourceRef#\"IHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjBFODAxMTc0MDcyMDY4MTE4MDgzRkNDNkRDMTAzOTdFIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkM2ODNBNDA0REYyMzExRTJCRDFDODRCQUJDNEYzNjU4IiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkM2ODNBNDAzREYyMzExRTJCRDFDODRCQUJDNEYzNjU4IiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzYgKFdpbmRvd3MpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RUE2RTAxN0I1MzlFRTFGMTk3OTFDMTRGN0MxOTgzRDkiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MEU4MDExNzQwNzIwNjgxMTgwODNGQ0M2REMxMDM5N0UiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnNtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InciPz5512BfAAACbklEQVR42uxdy2sCMRQebx9VfFTwUfFR8VHFV/FRxUfFRxUfVXwVPFR8VPFRxVfxUcVHxUcVHxV8VPFR8d/v1EwhaTsz2bS7Nf1gIFwSwvnl/M45t7m5S8PhkBYWFqilpSXK5/OpQCDAti2VSlF7eztFo9HU399Pzc3NFIsB5HI5am1tpa6uLurnL7z88/n39+Xg4KCrp6cnwN/r9Qaor68vQK2trdTa2jquEydD63j5Z/Ovs7vDwsLC8/j5W7oD4Q7u7+8LpZJp4H9nfwQ99q332A/D4XCIv0PqgO7g8vKyUCqbBv6X/k7Q49h6j+MwHA6H9Pv1fQAOw+FwSGoH6E1dXV0oQ3oFvX6/P0APaA5Q/tQC3UGpVCoU2gH6F4A5AP0LwByA/gVgDkD/AjAHoH8BmAPQvwDMAehfAOUAwCE4DIejvwC6u7sLhZYyqX8BmAPQvwDMAehfAOUAwCE4DIejv4CHh4dCoaxMAnD/AjAHoH8BmAPQvwDKAYBDcBgOR3+BDw8PhUJZ6Qfg/gVgDkD/AjAHoH8BlAMAh+AwHI7+Ah4eHgqFsjIJwP0LwByA/gVgDkD/AigHAA7BYTgc/QU+PDwUCmWlH4D7F4A5AP0LwByA/gUoDwCH4TCc/8g4gK8oHA4HgD88Ph4Kh/z8qA6A/wD4D4D/APgPgP8A+A+A/wD4D4D/APjPI3gH8C04/4HzHxn/gfMfGf8B8P9T+wD5D4D/APgPgP8A+A+A/wD4D4D/APhPBgDwHwD/AfAfAP8B8B8A/wF4vwDDAAEASB5VqV876zUAAAAASUVORK5CYII=';

    const textureUrl = getTextureUrl(selectedBody) || fallbackTexture;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = textureUrl;

    img.onload = () => {
      const isLegacy = img.height === img.width / 2;

      // Extract canvas textures for each face of the body parts
      const extractFace = (x: number, y: number, w: number, h: number) => {
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = w * 8; // upscale for crisp retro pixel scaling
        faceCanvas.height = h * 8;
        const ctx = faceCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const scale = img.width / 64;
          ctx.drawImage(img, x * scale, y * scale, w * scale, h * scale, 0, 0, faceCanvas.width, faceCanvas.height);
        }
        const texture = new THREE.CanvasTexture(faceCanvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        return new THREE.MeshLambertMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
      };

      const getMaterials = (mapping: any) => [
        extractFace(mapping.right[0], mapping.right[1], mapping.right[2], mapping.right[3]), // +X
        extractFace(mapping.left[0], mapping.left[1], mapping.left[2], mapping.left[3]),   // -X
        extractFace(mapping.top[0], mapping.top[1], mapping.top[2], mapping.top[3]),       // +Y
        extractFace(mapping.bottom[0], mapping.bottom[1], mapping.bottom[2], mapping.bottom[3]), // -Y
        extractFace(mapping.front[0], mapping.front[1], mapping.front[2], mapping.front[3]), // +Z
        extractFace(mapping.back[0], mapping.back[1], mapping.back[2], mapping.back[3])    // -Z
      ];

      // 1. HEAD (8x8x8)
      const headGeo = new THREE.BoxGeometry(8, 8, 8);
      const headMats = getMaterials(MAPPINGS.head);
      const head = new THREE.Mesh(headGeo, headMats);
      head.position.set(0, 10, 0);
      group.add(head);

      // HEAD OVERLAY (slightly larger)
      const headOverlayGeo = new THREE.BoxGeometry(8.5, 8.5, 8.5);
      const headOverlayMats = getMaterials(MAPPINGS.headOverlay);
      const headOverlay = new THREE.Mesh(headOverlayGeo, headOverlayMats);
      head.add(headOverlay); // nested inside head so it rotates with it

      // 2. TORSO (8x12x4)
      const torsoGeo = new THREE.BoxGeometry(8, 12, 4);
      const torsoMats = getMaterials(MAPPINGS.torso);
      const torso = new THREE.Mesh(torsoGeo, torsoMats);
      torso.position.set(0, 0, 0);
      group.add(torso);

      // TORSO OVERLAY
      if (!isLegacy) {
        const torsoOverlayGeo = new THREE.BoxGeometry(8.5, 12.5, 4.5);
        const torsoOverlayMats = getMaterials(MAPPINGS.torsoOverlay);
        const torsoOverlay = new THREE.Mesh(torsoOverlayGeo, torsoOverlayMats);
        torso.add(torsoOverlay);
      }

      // 3. RIGHT ARM (4x12x4) - Pivot at top corner
      const armGeo = new THREE.BoxGeometry(4, 12, 4);
      // Shift origin to top of arm for natural joint rotations
      armGeo.translate(0, -6, 0); 
      const rightArmMats = getMaterials(MAPPINGS.rightArm);
      const rightArm = new THREE.Mesh(armGeo, rightArmMats);
      rightArm.position.set(6, 6, 0); // attached at top-right of torso
      group.add(rightArm);
      rightArmRef.current = rightArm;

      if (!isLegacy) {
        const rightArmOverlayGeo = new THREE.BoxGeometry(4.5, 12.5, 4.5);
        rightArmOverlayGeo.translate(0, -6.25, 0);
        const rightArmOverlay = new THREE.Mesh(rightArmOverlayGeo, getMaterials(MAPPINGS.rightArmOverlay));
        rightArm.add(rightArmOverlay);
      }

      // 4. LEFT ARM (4x12x4)
      const leftArmGeo = new THREE.BoxGeometry(4, 12, 4);
      leftArmGeo.translate(0, -6, 0);
      const leftArmMats = getMaterials(isLegacy ? MAPPINGS.rightArm : MAPPINGS.leftArm);
      const leftArm = new THREE.Mesh(leftArmGeo, leftArmMats);
      leftArm.position.set(-6, 6, 0);
      group.add(leftArm);
      leftArmRef.current = leftArm;

      if (!isLegacy) {
        const leftArmOverlayGeo = new THREE.BoxGeometry(4.5, 12.5, 4.5);
        leftArmOverlayGeo.translate(0, -6.25, 0);
        const leftArmOverlay = new THREE.Mesh(leftArmOverlayGeo, getMaterials(MAPPINGS.leftArmOverlay));
        leftArm.add(leftArmOverlay);
      }

      // 5. RIGHT LEG (4x12x4)
      const legGeo = new THREE.BoxGeometry(4, 12, 4);
      legGeo.translate(0, -6, 0);
      const rightLeg = new THREE.Mesh(legGeo, getMaterials(MAPPINGS.rightLeg));
      rightLeg.position.set(2, -6, 0);
      group.add(rightLeg);

      if (!isLegacy) {
        const rightLegOverlayGeo = new THREE.BoxGeometry(4.5, 12.5, 4.5);
        rightLegOverlayGeo.translate(0, -6.25, 0);
        const rightLegOverlay = new THREE.Mesh(rightLegOverlayGeo, getMaterials(MAPPINGS.rightLegOverlay));
        rightLeg.add(rightLegOverlay);
      }

      // 6. LEFT LEG (4x12x4)
      const leftLegGeo = new THREE.BoxGeometry(4, 12, 4);
      leftLegGeo.translate(0, -6, 0);
      const leftLeg = new THREE.Mesh(leftLegGeo, getMaterials(isLegacy ? MAPPINGS.rightLeg : MAPPINGS.leftLeg));
      leftLeg.position.set(-2, -6, 0);
      group.add(leftLeg);

      if (!isLegacy) {
        const leftLegOverlayGeo = new THREE.BoxGeometry(4.5, 12.5, 4.5);
        leftLegOverlayGeo.translate(0, -6.25, 0);
        const leftLegOverlay = new THREE.Mesh(leftLegOverlayGeo, getMaterials(MAPPINGS.leftLegOverlay));
        leftLeg.add(leftLegOverlay);
      }

      // 7. WEAPON IN HAND (2D Plane Sprite in 3D Space)
      const activeWeapon = selectedPrimary;
      if (activeWeapon) {
        const renderUrl = getItemRenderUrl(activeWeapon);
        if (renderUrl) {
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin('anonymous');
          loader.load(
            renderUrl,
            (weaponTex) => {
              weaponTex.magFilter = THREE.NearestFilter;
              weaponTex.minFilter = THREE.NearestFilter;

              const weaponGeo = new THREE.PlaneGeometry(11, 5.5);
              const weaponMat = new THREE.MeshBasicMaterial({
                map: weaponTex,
                transparent: true,
                side: THREE.DoubleSide
              });
              const weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);

              // Position weapon relative to Right Arm bottom joint
              rightArm.add(weaponMesh);
              
              const weaponType = activeWeapon.parent?.type || 'WEAPON_1';

              if (weaponType === 'WEAPON_1') {
                // Rifle hold pose: Both arms raised forward
                rightArm.rotation.set(-Math.PI / 3, -Math.PI / 8, 0);
                leftArm.rotation.set(-Math.PI / 3.5, Math.PI / 6, 0);
                
                weaponMesh.position.set(-1, -7, 3);
                weaponMesh.rotation.set(0, Math.PI / 2.2, -Math.PI / 10);
              } else if (weaponType === 'WEAPON_2') {
                // Pistol pose: One arm straight forward
                rightArm.rotation.set(-Math.PI / 2, 0, 0);
                leftArm.rotation.set(0, 0, 0);
                
                weaponMesh.position.set(0.5, -7.5, 2.5);
                weaponMesh.rotation.set(0, Math.PI / 2, 0);
              } else {
                // Melee knife pose: Arm raised slightly, knife held ready
                rightArm.rotation.set(-Math.PI / 3.5, 0, 0);
                leftArm.rotation.set(0, 0, 0);
                
                weaponMesh.position.set(0.5, -7.5, 2);
                weaponMesh.rotation.set(0, Math.PI / 2, -Math.PI / 4);
              }
            },
            undefined,
            (err) => console.warn('Failed to load weapon texture in FitViewer:', err)
          );
        }
      }
    };

    img.onerror = () => {
      console.error('Failed to load character body texture in FitViewer:', textureUrl);
    };
  }, [selectedBody, selectedPrimary, allItemData]);

  // Mouse Interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const group = playerGroupRef.current;
    if (!isDragging.current || !group) return;
    
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    group.rotation.y += deltaX * 0.012;
    group.rotation.x += deltaY * 0.006;
    group.rotation.x = Math.max(-0.4, Math.min(0.4, group.rotation.x));

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.z += e.deltaY * 0.015;
    camera.position.z = Math.max(10, Math.min(38, camera.position.z));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const group = playerGroupRef.current;
    if (!isDragging.current || !group || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.current.y;

    group.rotation.y += deltaX * 0.015;
    group.rotation.x += deltaY * 0.008;
    group.rotation.x = Math.max(-0.4, Math.min(0.4, group.rotation.x));

    previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  // Handle dropdown selections
  const handleSelectSkin = (slot: 'body' | 'primary' | 'secondary' | 'melee', item: any) => {
    if (slot === 'body') setSelectedBody(item);
    if (slot === 'primary') setSelectedPrimary(item);
    if (slot === 'secondary') setSelectedSecondary(item);
    if (slot === 'melee') setSelectedMelee(item);
    setActiveDropdown(null);
    setSearchFilter('');
  };

  // Get current dropdown list contents
  const dropdownList = useMemo(() => {
    if (!activeDropdown) return [];
    let items: any[] = [];
    if (activeDropdown === 'body') items = catalog.bodies;
    if (activeDropdown === 'primary') items = catalog.primaries;
    if (activeDropdown === 'secondary') items = catalog.secondaries;
    if (activeDropdown === 'melee') items = catalog.melees;

    return items.filter(i => i.name.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [activeDropdown, catalog, searchFilter]);

  return (
    <div className="bg-[#0b0c13] border border-obsidian-border rounded-3xl p-6 space-y-6 relative overflow-hidden select-none">
      {/* Visual background glow */}
      <div className="absolute -left-16 -top-16 w-80 h-80 bg-gold-primary/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Header Level bar */}
      <div className="flex justify-between items-center pb-4 border-b border-white/5 select-text">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-5 h-5 text-gold-primary animate-pulse" />
          <div className="flex items-center space-x-2">
            <span className="bg-gold-primary/10 border border-gold-primary/30 text-gold-bright text-xs font-mono px-2 py-0.5 rounded font-black">
              {profile.level}
            </span>
            <span className="text-base font-black text-white uppercase tracking-wider">{profile.name}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">3D Fit Showroom</span>
      </div>

      {/* 3D Viewport Area */}
      <div className="relative w-full h-[420px] bg-gradient-to-b from-[#08090f] to-[#0d0f17] border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
        {/* Subtle grid background layer */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* THREE.js Container */}
        <div 
          ref={containerRef} 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
          className="w-full h-full cursor-grab active:cursor-grabbing" 
        />

        {/* Orbit indicator hint overlay */}
        <div className="absolute bottom-3 left-4 text-[9px] font-mono text-slate-600 bg-[#040509]/60 px-3 py-1.5 rounded-lg border border-white/5 pointer-events-none select-none uppercase tracking-wider">
          Drag to Rotate • Scroll to Zoom
        </div>

        {/* Selected Body Skin name indicator */}
        {selectedBody && (
          <div className="absolute top-3 left-4 text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-indigo-400 font-bold uppercase tracking-wider">
            Outfit: {selectedBody.name}
          </div>
        )}
      </div>

      {/* Selection Cards (Slots) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        
        {/* Slot 1: Character Outfit */}
        <div className="relative">
          <div
            onClick={() => setActiveDropdown(activeDropdown === 'body' ? null : 'body')}
            className={`cursor-pointer bg-[#090A0F] border hover:border-indigo-500/30 rounded-xl p-4 transition-all flex flex-col justify-between h-[110px] group ${activeDropdown === 'body' ? 'border-indigo-500/40 bg-indigo-500/[0.02]' : 'border-white/5'}`}
          >
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Character Outfit</span>
            {selectedBody ? (
              <div className="flex-grow flex flex-col justify-center">
                <span className="text-xs font-black text-white group-hover:text-indigo-400 truncate uppercase tracking-wide block">{selectedBody.name}</span>
                <span className="text-[8px] font-mono text-indigo-400 uppercase tracking-wider block mt-1">Change Outfit</span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 font-bold flex items-center space-x-1"><Plus className="w-3.5 h-3.5" /> <span>Equip Outfit</span></span>
            )}
          </div>
        </div>

        {/* Slot 2: Primary Weapon */}
        <div className="relative">
          <div
            onClick={() => setActiveDropdown(activeDropdown === 'primary' ? null : 'primary')}
            className={`cursor-pointer bg-[#090A0F] border hover:border-gold-primary/30 rounded-xl p-4 transition-all flex flex-col justify-between h-[110px] group ${activeDropdown === 'primary' ? 'border-gold-primary/40 bg-gold-primary/[0.02]' : 'border-white/5'}`}
          >
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Primary Weapon</span>
            {selectedPrimary ? (
              <div className="flex-grow flex flex-col justify-center">
                <span className="text-xs font-black text-white group-hover:text-gold-bright truncate uppercase tracking-wide block">{selectedPrimary.name}</span>
                <span className="text-[8px] font-mono text-gold-bright uppercase tracking-wider block mt-1">{selectedPrimary.parent?.name || 'WEAPON'} Skin</span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 font-bold flex items-center space-x-1"><Plus className="w-3.5 h-3.5" /> <span>Equip Weapon</span></span>
            )}
          </div>
        </div>

        {/* Slot 3: Secondary Weapon */}
        <div className="relative">
          <div
            onClick={() => setActiveDropdown(activeDropdown === 'secondary' ? null : 'secondary')}
            className={`cursor-pointer bg-[#090A0F] border hover:border-gold-primary/30 rounded-xl p-4 transition-all flex flex-col justify-between h-[110px] group ${activeDropdown === 'secondary' ? 'border-gold-primary/40 bg-gold-primary/[0.02]' : 'border-white/5'}`}
          >
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Secondary Weapon</span>
            {selectedSecondary ? (
              <div className="flex-grow flex flex-col justify-center">
                <span className="text-xs font-black text-white group-hover:text-gold-bright truncate uppercase tracking-wide block">{selectedSecondary.name}</span>
                <span className="text-[8px] font-mono text-gold-bright uppercase tracking-wider block mt-1">{selectedSecondary.parent?.name || 'WEAPON'} Skin</span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 font-bold flex items-center space-x-1"><Plus className="w-3.5 h-3.5" /> <span>Equip Sidearm</span></span>
            )}
          </div>
        </div>

        {/* Slot 4: Melee Weapon */}
        <div className="relative">
          <div
            onClick={() => setActiveDropdown(activeDropdown === 'melee' ? null : 'melee')}
            className={`cursor-pointer bg-[#090A0F] border hover:border-gold-primary/30 rounded-xl p-4 transition-all flex flex-col justify-between h-[110px] group ${activeDropdown === 'melee' ? 'border-gold-primary/40 bg-gold-primary/[0.02]' : 'border-white/5'}`}
          >
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Melee Knife</span>
            {selectedMelee ? (
              <div className="flex-grow flex flex-col justify-center">
                <span className="text-xs font-black text-white group-hover:text-gold-bright truncate uppercase tracking-wide block">{selectedMelee.name}</span>
                <span className="text-[8px] font-mono text-gold-bright uppercase tracking-wider block mt-1">{selectedMelee.parent?.name || 'WEAPON'} Skin</span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 font-bold flex items-center space-x-1"><Plus className="w-3.5 h-3.5" /> <span>Equip Knife</span></span>
            )}
          </div>
        </div>

        {/* SEARCH DROP-DOWN overlay */}
        {activeDropdown && (
          <div className="absolute left-0 right-0 bottom-[125px] bg-[#0b0c13] border border-obsidian-border rounded-2xl p-4 shadow-2xl z-30 space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2 select-text">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">Search Slot Catalog</span>
              <button 
                onClick={() => { setActiveDropdown(null); setSearchFilter(''); }} 
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300 uppercase font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <div className="relative select-text">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type skin name to filter..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-[#040509] border border-white/5 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/25 transition-all"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
              {dropdownList.map((item) => {
                const renderUrl = getItemRenderUrl(item);
                const isOutfit = item.type === 'BODY_SKIN';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSkin(activeDropdown, item)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02] cursor-pointer group text-slate-300 hover:text-white"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="w-7 h-7 rounded border border-white/5 bg-[#040509] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {renderUrl ? (
                          <img src={renderUrl} alt={item.name} className="w-5 h-5 object-contain" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-slate-600 opacity-40" />
                        )}
                      </div>
                      <span className="font-bold truncate uppercase tracking-wider">{item.name}</span>
                      {!isOutfit && item.parent?.name && (
                        <span className="text-[9px] text-slate-500 font-medium">({item.parent.name})</span>
                      )}
                    </div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-gold-bright transition-colors select-none">Equip</span>
                  </div>
                );
              })}

              {dropdownList.length === 0 && (
                <div className="text-center py-8 text-slate-600 text-xs italic select-none">No matching catalog items found</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
