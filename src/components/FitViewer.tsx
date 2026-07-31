import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Search, Layers, Plus, Sparkles } from 'lucide-react';
import type { UserProfile } from '../utils/api';

interface FitViewerProps {
  profile: UserProfile;
  publicItems: any[];
  allItemData: any[];
  fallbackRenders: Record<string, any>;
}

// UV Pixel maps on a standard 64x64 Minecraft skin layout
// Coordinates: [x, y, width, height] in skin pixels
const STEVE_MAPPINGS = {
  head:        { right:[0,8,8,8],   left:[16,8,8,8],  top:[8,0,8,8],    bottom:[16,0,8,8],  front:[8,8,8,8],   back:[24,8,8,8]  },
  headOverlay: { right:[32,8,8,8],  left:[48,8,8,8],  top:[40,0,8,8],   bottom:[48,0,8,8],  front:[40,8,8,8],  back:[56,8,8,8]  },
  torso:       { right:[16,20,4,12],left:[28,20,4,12],top:[20,16,8,4],  bottom:[28,16,8,4], front:[20,20,8,12],back:[32,20,8,12]},
  torsoOL:     { right:[16,36,4,12],left:[28,36,4,12],top:[20,32,8,4],  bottom:[28,32,8,4], front:[20,36,8,12],back:[32,36,8,12]},
  // Steve arms: 4 wide
  rightArm:    { right:[40,20,4,12],left:[48,20,4,12],top:[44,16,4,4],  bottom:[48,16,4,4], front:[44,20,4,12],back:[52,20,4,12]},
  rightArmOL:  { right:[40,36,4,12],left:[48,36,4,12],top:[44,32,4,4],  bottom:[48,32,4,4], front:[44,36,4,12],back:[52,36,4,12]},
  leftArm:     { right:[32,52,4,12],left:[40,52,4,12],top:[36,48,4,4],  bottom:[40,48,4,4], front:[36,52,4,12],back:[44,52,4,12]},
  leftArmOL:   { right:[48,52,4,12],left:[56,52,4,12],top:[52,48,4,4],  bottom:[56,48,4,4], front:[52,52,4,12],back:[60,52,4,12]},
  rightLeg:    { right:[0,20,4,12], left:[8,20,4,12],  top:[4,16,4,4],   bottom:[8,16,4,4],  front:[4,20,4,12], back:[12,20,4,12]},
  rightLegOL:  { right:[0,36,4,12], left:[8,36,4,12],  top:[4,32,4,4],   bottom:[8,32,4,4],  front:[4,36,4,12], back:[12,36,4,12]},
  leftLeg:     { right:[16,52,4,12],left:[24,52,4,12], top:[20,48,4,4],  bottom:[24,48,4,4], front:[20,52,4,12],back:[28,52,4,12]},
  leftLegOL:   { right:[0,48,4,12], left:[8,48,4,12],  top:[4,48,4,4],   bottom:[8,48,4,4],  front:[4,48,4,12], back:[12,48,4,12]},
};

// Alex/Slim arms: 3 wide (different UV coords)
const ALEX_ARM_MAPPINGS = {
  rightArm:   { right:[40,20,4,12],left:[46,20,4,12],top:[44,16,3,4],  bottom:[47,16,3,4], front:[44,20,3,12],back:[51,20,3,12]},
  rightArmOL: { right:[40,36,4,12],left:[46,36,4,12],top:[44,32,3,4],  bottom:[47,32,3,4], front:[44,36,3,12],back:[51,36,3,12]},
  leftArm:    { right:[32,52,4,12],left:[38,52,4,12],top:[36,48,3,4],  bottom:[39,48,3,4], front:[36,52,3,12],back:[43,52,3,12]},
  leftArmOL:  { right:[48,52,4,12],left:[54,52,4,12],top:[52,48,3,4],  bottom:[55,48,3,4], front:[52,52,3,12],back:[59,52,3,12]},
};

export const FitViewer: React.FC<FitViewerProps> = ({
  profile,
  publicItems,
  allItemData,
  fallbackRenders
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedBody, setSelectedBody] = useState<any>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<any>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<any>(null);
  const [selectedMelee, setSelectedMelee] = useState<any>(null);
  const [activeDropdown, setActiveDropdown] = useState<'body' | 'primary' | 'secondary' | 'melee' | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const playerGroupRef = useRef<THREE.Group | null>(null);

  const catalog = useMemo(() => ({
    bodies:     publicItems.filter(i => i.type === 'BODY_SKIN'),
    primaries:  publicItems.filter(i => i.type === 'WEAPON_SKIN' && i.parent?.type === 'WEAPON_1'),
    secondaries:publicItems.filter(i => i.type === 'WEAPON_SKIN' && i.parent?.type === 'WEAPON_2'),
    melees:     publicItems.filter(i => i.type === 'WEAPON_SKIN' && i.parent?.type === 'WEAPON_3'),
  }), [publicItems]);

  const getProxiedImageUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('http://localhost') || url.includes(window.location.host)) return url;
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
  };

  const getTextureUrl = (bodySkin: any) => {
    if (!bodySkin) return '';
    let raw = bodySkin.textureUrl;
    if (!raw) {
      const matched = allItemData.find(i => i.name.toLowerCase() === bodySkin.name.toLowerCase() && i.type === 'BODY_SKIN');
      raw = matched?.textureUrl || '';
    }
    if (!raw) return '';
    if (raw.includes('data:image/')) return raw.substring(raw.indexOf('data:image/'));
    return raw;
  };

  const getItemRenderUrl = (item: any) => {
    if (!item) return null;
    let url = item.renderUrl;
    if (!url) {
      const cleanName = item.name.replace(/^_+/, '');
      const fb = fallbackRenders[cleanName.toLowerCase()];
      if (fb?.renderurl) url = fb.renderurl;
      else if (item.parent?.name) {
        const fb2 = fallbackRenders[`${cleanName.toLowerCase()} ${item.parent.name.toLowerCase()}`];
        if (fb2?.renderurl) url = fb2.renderurl;
      }
    }
    return url ? getProxiedImageUrl(url) : null;
  };

  const getWeaponTextureUrl = (item: any) => {
    if (!item) return null;
    let url = item.textureUrl;
    if (!url) {
      const matched = allItemData.find(i => i.name.toLowerCase() === item.name.toLowerCase() && i.type === 'WEAPON_SKIN');
      url = matched?.textureUrl || null;
    }
    return url ? getProxiedImageUrl(url) : null;
  };

  const getWeaponGlbPath = (item: any): string | null => {
    if (!item) return null;
    const nameStr = `${item.name} ${item.parent?.name || ''}`.toLowerCase();

    if (nameStr.includes('scar')) return '/models/KirkaWeapons/SCAR.glb';
    if (nameStr.includes('lar')) return '/models/KirkaWeapons/LAR.glb';
    if (nameStr.includes('ar-9') || nameStr.includes('ar9')) return '/models/KirkaWeapons/AR-9.glb';
    if (nameStr.includes('m60')) return '/models/KirkaWeapons/M60.glb';
    if (nameStr.includes('mac-10') || nameStr.includes('mac10')) return '/models/KirkaWeapons/MAC-10.glb';
    if (nameStr.includes('bayonet')) return '/models/KirkaWeapons/Bayonet.glb';
    if (nameStr.includes('shark')) return '/models/KirkaWeapons/Shark.glb';
    if (nameStr.includes('vita')) return '/models/KirkaWeapons/VITA.glb';
    if (nameStr.includes('weatie')) return '/models/KirkaWeapons/Weatie.glb';

    if (item.type === 'WEAPON_SKIN' && item.parent?.type === 'WEAPON_3') return '/models/KirkaWeapons/Bayonet.glb';
    return '/models/KirkaWeapons/SCAR.glb';
  };

  useEffect(() => {
    if (!profile) return;
    setSelectedBody(profile.activeBodySkin || catalog.bodies[0] || null);
    setSelectedPrimary(profile.activeWeapon1Skin || catalog.primaries[0] || null);
    setSelectedSecondary(catalog.secondaries[0] || null);
    setSelectedMelee(catalog.melees[0] || null);
  }, [profile, catalog]);

  // ── Three.js Scene Setup ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const W = 360, H = 480;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Narrow FOV = flat orthographic-like look, no perspective distortion
    const camera = new THREE.PerspectiveCamera(16, W / H, 0.1, 500);
    // Character: head top at y=32, feet at y=0, center at y=16
    camera.position.set(0, 16, 130);
    camera.lookAt(0, 16, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // ── Bright, clean directional shading matching official renders ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(15, 35, 25);
    scene.add(dirLight);

    const playerGroup = new THREE.Group();
    scene.add(playerGroup);
    playerGroupRef.current = playerGroup;

    // Exact Y rotation matching the official Kirka player dashboard angle
    playerGroup.rotation.y = -0.25;

    let animId: number;
    const animate = () => { animId = requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();

    return () => { cancelAnimationFrame(animId); renderer.dispose(); };
  }, []);

  // ── Rebuild Model ─────────────────────────────────────────────────────
  useEffect(() => {
    const group = playerGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) group.remove(group.children[0]);

    const textureUrl = getTextureUrl(selectedBody);
    if (!textureUrl) return;

    let cleanUrl = textureUrl.trim();
    if (cleanUrl.includes('data:image/')) cleanUrl = cleanUrl.substring(cleanUrl.indexOf('data:image/'));
    else if (!cleanUrl.startsWith('data:')) cleanUrl = getProxiedImageUrl(cleanUrl);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = cleanUrl;

    img.onload = () => {
      // Detect Alex/slim model by checking alpha at arm corner pixel
      const checkCanvas = document.createElement('canvas');
      checkCanvas.width = img.width; checkCanvas.height = img.height;
      const checkCtx = checkCanvas.getContext('2d')!;
      checkCtx.drawImage(img, 0, 0);
      const scale = img.width / 64;
      const px = checkCtx.getImageData(Math.round(54 * scale), Math.round(20 * scale), 1, 1).data;
      const isSlim = px[3] === 0; // transparent = Alex slim model
      const isLegacy = img.height === img.width / 2;

      const armWidth = isSlim ? 3 : 4;
      const armMaps = isSlim ? { ...STEVE_MAPPINGS, ...ALEX_ARM_MAPPINGS } : STEVE_MAPPINGS;

      // UV face extractor (MeshLambertMaterial for clean 3D diffuse shading!)
      const extractFace = (x: number, y: number, w: number, h: number) => {
        const fc = document.createElement('canvas');
        fc.width = w * 8; fc.height = h * 8;
        const ctx = fc.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x * scale, y * scale, w * scale, h * scale, 0, 0, fc.width, fc.height);
        const tex = new THREE.CanvasTexture(fc);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        return new THREE.MeshLambertMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      };

      const mats = (m: any) => [
        extractFace(m.right[0],  m.right[1],  m.right[2],  m.right[3]),
        extractFace(m.left[0],   m.left[1],   m.left[2],   m.left[3]),
        extractFace(m.top[0],    m.top[1],    m.top[2],    m.top[3]),
        extractFace(m.bottom[0], m.bottom[1], m.bottom[2], m.bottom[3]),
        extractFace(m.front[0],  m.front[1],  m.front[2],  m.front[3]),
        extractFace(m.back[0],   m.back[1],   m.back[2],   m.back[3]),
      ];

      // HEAD: 8x8x8, center at y=28 (rotated slightly to face viewer)
      const head = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), mats(STEVE_MAPPINGS.head));
      head.position.set(0, 28, 0);
      head.rotation.y = 0.2;
      group.add(head);

      const headOL = new THREE.Mesh(new THREE.BoxGeometry(8.5, 8.5, 8.5), mats(STEVE_MAPPINGS.headOverlay));
      head.add(headOL);

      // TORSO: 8x12x4, center at y=18
      const torso = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 4), mats(STEVE_MAPPINGS.torso));
      torso.position.set(0, 18, 0);
      group.add(torso);

      if (!isLegacy) {
        torso.add(new THREE.Mesh(new THREE.BoxGeometry(8.5, 12.5, 4.5), mats(STEVE_MAPPINGS.torsoOL)));
      }

      // RIGHT ARM: pivot at shoulder (6, 24, 0)
      const rArmGeo = new THREE.BoxGeometry(armWidth, 12, 4);
      rArmGeo.translate(0, -6, 0);
      const rightArm = new THREE.Mesh(rArmGeo, mats(armMaps.rightArm));
      rightArm.position.set(6 - (isSlim ? 0.5 : 0), 24, 0);
      // Correct inward rotation meeting the gun handle/grip across chest
      rightArm.rotation.set(-0.95, 0.5, -0.4);
      group.add(rightArm);

      if (!isLegacy) {
        const rArmOLGeo = new THREE.BoxGeometry(armWidth + 0.5, 12.5, 4.5);
        rArmOLGeo.translate(0, -6.25, 0);
        rightArm.add(new THREE.Mesh(rArmOLGeo, mats(armMaps.rightArmOL)));
      }

      // LEFT ARM: pivot at shoulder (-6, 24, 0)
      const lArmGeo = new THREE.BoxGeometry(armWidth, 12, 4);
      lArmGeo.translate(0, -6, 0);
      const leftArm = new THREE.Mesh(lArmGeo, mats(isLegacy ? armMaps.rightArm : armMaps.leftArm));
      leftArm.position.set(-6 + (isSlim ? 0.5 : 0), 24, 0);
      // Correct inward rotation supporting the gun barrel
      leftArm.rotation.set(-0.85, -0.6, 0.4);
      group.add(leftArm);

      if (!isLegacy) {
        const lArmOLGeo = new THREE.BoxGeometry(armWidth + 0.5, 12.5, 4.5);
        lArmOLGeo.translate(0, -6.25, 0);
        leftArm.add(new THREE.Mesh(lArmOLGeo, mats(armMaps.leftArmOL)));
      }

      // RIGHT LEG: pivot at hip (1.5, 12, 0.5) - stepped outward and angled (left side of screen)
      const rLegGeo = new THREE.BoxGeometry(4, 12, 4);
      rLegGeo.translate(0, -6, 0);
      const rightLeg = new THREE.Mesh(rLegGeo, mats(STEVE_MAPPINGS.rightLeg));
      rightLeg.position.set(1.5, 12, 0.5);
      rightLeg.rotation.set(0.08, 0.08, 0.14);
      group.add(rightLeg);

      if (!isLegacy) {
        const rLegOLGeo = new THREE.BoxGeometry(4.5, 12.5, 4.5);
        rLegOLGeo.translate(0, -6.25, 0);
        rightLeg.add(new THREE.Mesh(rLegOLGeo, mats(STEVE_MAPPINGS.rightLegOL)));
      }

      // LEFT LEG: pivot at hip (-2.0, 12, -0.5) - supporting straight leg (right side of screen)
      const lLegGeo = new THREE.BoxGeometry(4, 12, 4);
      lLegGeo.translate(0, -6, 0);
      const leftLeg = new THREE.Mesh(lLegGeo, mats(isLegacy ? STEVE_MAPPINGS.rightLeg : STEVE_MAPPINGS.leftLeg));
      leftLeg.position.set(-2.0, 12, -0.5);
      leftLeg.rotation.set(-0.05, -0.05, -0.02);
      group.add(leftLeg);

      if (!isLegacy) {
        const lLegOLGeo = new THREE.BoxGeometry(4.5, 12.5, 4.5);
        lLegOLGeo.translate(0, -6.25, 0);
        leftLeg.add(new THREE.Mesh(lLegOLGeo, mats(STEVE_MAPPINGS.leftLegOL)));
      }

      // ── 3D WEAPON GLB MODEL ATTACHMENT ──────────────────────────────
      const activeWeapon = selectedPrimary || selectedSecondary || selectedMelee;
      if (activeWeapon) {
        const glbPath = getWeaponGlbPath(activeWeapon);
        const textureUrl = getWeaponTextureUrl(activeWeapon);

        if (glbPath) {
          const gltfLoader = new GLTFLoader();
          gltfLoader.load(
            glbPath,
            (gltf) => {
              const model = gltf.scene;

              const setupMaterials = (skinTex: THREE.Texture | null) => {
                model.traverse((child) => {
                  if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const originalMat = mesh.material as any;
                    
                    if (originalMat) {
                      mesh.material = new THREE.MeshLambertMaterial({
                        color: originalMat.color || new THREE.Color(0xffffff),
                        map: skinTex || originalMat.map || null,
                        transparent: true,
                        side: THREE.DoubleSide
                      });
                    }
                  }
                });
              };

              // Apply actual seamless skin texture sheet (textureUrl) to 3D GLB weapon model
              if (textureUrl) {
                const texLoader = new THREE.TextureLoader();
                texLoader.setCrossOrigin('anonymous');
                texLoader.load(textureUrl, (skinTex) => {
                  skinTex.magFilter = THREE.NearestFilter;
                  skinTex.minFilter = THREE.NearestFilter;
                  skinTex.generateMipmaps = false;
                  setupMaterials(skinTex);
                }, undefined, () => setupMaterials(null));
              } else {
                setupMaterials(null);
              }

              // Adjust scaling, positioning, and rotation based on weapon type to hold it realistically
              const weaponName = activeWeapon.parent?.name || activeWeapon.name || '';
              const weaponType = activeWeapon.parent?.type || activeWeapon.type || '';
              
              // Wrap inside a parent group to center and scale uniformly
              const wrapper = new THREE.Group();
              wrapper.add(model);

              // Center geometry relative to the wrapper pivot
              const box = new THREE.Box3().setFromObject(model);
              const center = new THREE.Vector3();
              box.getCenter(center);
              model.position.sub(center);

              const size = new THREE.Vector3();
              box.getSize(size);
              const currentWidth = size.x || 1.0;

              // Size to absolute physical dimensions in scene units
              let targetWidth = 13.5;
              if (weaponName.toLowerCase().includes('bayonet') || weaponName.toLowerCase().includes('tomahawk') || weaponName.toLowerCase().includes('knife')) {
                targetWidth = 9.0;
              } else if (weaponType === 'WEAPON_2' || weaponName.toLowerCase().includes('revolver') || weaponName.toLowerCase().includes('pistol')) {
                targetWidth = 10.0;
              }

              const scaleFactor = targetWidth / currentWidth;
              wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);

              // Position right in front of chest/hands level
              let posX = -0.4;
              let posY = 17.8; // held close to chest, matching the reference pose!
              let posZ = 2.4;  // shifted back closer to chest so hands overlay IN FRONT of the gun!
              let rotX = 0.1;
              let rotY = -0.05;
              let rotZ = -0.26; // correct tilt matching the reference screenshot!

              // Melee / Knife positioning
              if (weaponName.toLowerCase().includes('bayonet') || weaponName.toLowerCase().includes('tomahawk') || weaponName.toLowerCase().includes('knife')) {
                posY = 17.2;
                posZ = 2.6;
                rotZ = -0.55; 
              }
              // Pistol / Revolver positioning
              else if (weaponType === 'WEAPON_2' || weaponName.toLowerCase().includes('revolver') || weaponName.toLowerCase().includes('pistol')) {
                posX = 0.0;
                posY = 17.2;
                posZ = 2.6;
                rotZ = -0.15;
              }

              wrapper.position.set(posX, posY, posZ);
              wrapper.rotation.set(rotX, rotY, rotZ);

              group.add(wrapper);
            },
            undefined,
            (err) => console.warn('GLB load failed:', err)
          );
        }
      }
    };

    img.onerror = () => console.warn('Skin texture failed to load:', cleanUrl);
  }, [selectedBody, selectedPrimary, selectedSecondary, selectedMelee, allItemData]);

  const handleSelectSkin = (slot: 'body' | 'primary' | 'secondary' | 'melee', item: any) => {
    if (slot === 'body') setSelectedBody(item);
    if (slot === 'primary')   { setSelectedPrimary(item);   setSelectedSecondary(null); setSelectedMelee(null); }
    if (slot === 'secondary') { setSelectedSecondary(item); setSelectedPrimary(null);   setSelectedMelee(null); }
    if (slot === 'melee')     { setSelectedMelee(item);     setSelectedPrimary(null);   setSelectedSecondary(null); }
    setActiveDropdown(null);
    setSearchFilter('');
  };

  const dropdownList = useMemo(() => {
    if (!activeDropdown) return [];
    const items = activeDropdown === 'body' ? catalog.bodies
      : activeDropdown === 'primary' ? catalog.primaries
      : activeDropdown === 'secondary' ? catalog.secondaries
      : catalog.melees;
    return items.filter(i => i.name.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [activeDropdown, catalog, searchFilter]);

  return (
    <div className="bg-[#0b0c13] border border-obsidian-border rounded-3xl p-6 space-y-6 relative overflow-hidden select-none">
      <div className="absolute -left-16 -top-16 w-80 h-80 bg-gold-primary/5 rounded-full filter blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-white/5 select-text">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-5 h-5 text-gold-primary animate-pulse" />
          <div className="flex items-center space-x-2">
            <span className="bg-gold-primary/10 border border-gold-primary/30 text-gold-bright text-xs font-mono px-2 py-0.5 rounded font-black">{profile.level}</span>
            <span className="text-base font-black text-white uppercase tracking-wider">{profile.name}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">3D Fit Showroom</span>
      </div>

      {/* 3D Viewport - Premium Dark Gradient card matching the official dark dashboard theme! */}
      <div className="w-[360px] h-[480px] mx-auto bg-gradient-to-b from-[#141622] to-[#08090d] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center">
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black/25 rounded-full filter blur-md pointer-events-none" />
        <div ref={containerRef} className="w-full h-full pointer-events-none" />
        {selectedBody && (
          <div className="absolute top-3 left-4 text-[10px] font-mono bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg text-white font-bold uppercase tracking-wider">
            Outfit: {selectedBody.name}
          </div>
        )}
      </div>

      {/* Slot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {(['body','primary','secondary','melee'] as const).map((slot) => {
          const selected = slot === 'body' ? selectedBody : slot === 'primary' ? selectedPrimary : slot === 'secondary' ? selectedSecondary : selectedMelee;
          const label = slot === 'body' ? 'Character Outfit' : slot === 'primary' ? 'Primary Weapon' : slot === 'secondary' ? 'Secondary Weapon' : 'Melee Knife';
          const accent = slot === 'body' ? 'indigo' : 'gold';
          return (
            <div key={slot} className="relative">
              <div
                onClick={() => setActiveDropdown(activeDropdown === slot ? null : slot)}
                className={`cursor-pointer bg-[#090A0F] border rounded-xl p-4 transition-all flex flex-col justify-between h-[110px] group
                  ${activeDropdown === slot
                    ? accent === 'indigo' ? 'border-indigo-500/40' : 'border-gold-primary/40'
                    : 'border-white/5 hover:border-white/10'}`}
              >
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{label}</span>
                {selected ? (
                  <div>
                    <span className={`text-xs font-black text-white truncate uppercase tracking-wide block ${accent === 'indigo' ? 'group-hover:text-indigo-400' : 'group-hover:text-gold-bright'}`}>{selected.name}</span>
                    <span className={`text-[8px] font-mono uppercase tracking-wider block mt-1 ${accent === 'indigo' ? 'text-indigo-400' : 'text-gold-bright'}`}>
                      {slot === 'body' ? 'Change Outfit' : `${selected.parent?.name || 'WEAPON'} Skin`}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-600 font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Equip</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Dropdown */}
        {activeDropdown && (
          <div className="absolute left-0 right-0 bottom-[125px] bg-[#0b0c13] border border-obsidian-border rounded-2xl p-4 shadow-2xl z-30 space-y-3">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-black">Select Skin</span>
              <button onClick={() => { setActiveDropdown(null); setSearchFilter(''); }} className="text-[10px] font-mono text-slate-500 hover:text-white uppercase font-bold cursor-pointer">Close</button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text" placeholder="Filter by name..." value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full bg-[#040509] border border-white/5 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500/25 transition-all"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1 text-xs font-mono">
              {dropdownList.map(item => (
                <div key={item.id} onClick={() => handleSelectSkin(activeDropdown, item)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer group text-slate-300 hover:text-white"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <div className="w-7 h-7 rounded border border-white/5 bg-[#040509] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {getItemRenderUrl(item)
                        ? <img src={getItemRenderUrl(item)!} alt={item.name} className="w-5 h-5 object-contain" />
                        : <Layers className="w-3.5 h-3.5 text-slate-600 opacity-40" />}
                    </div>
                    <span className="font-bold truncate uppercase tracking-wider">{item.name}</span>
                    {item.parent?.name && <span className="text-[9px] text-slate-500">({item.parent.name})</span>}
                  </div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-gold-bright">Equip</span>
                </div>
              ))}
              {dropdownList.length === 0 && <div className="text-center py-8 text-slate-600 italic">No items found</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
