import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import {
  SkinViewer,
  IdleAnimation,
  WalkingAnimation,
  RunningAnimation,
  FlyingAnimation,
} from 'skinview3d';
import {
  Paintbrush,
  Eraser,
  Pipette,
  PaintBucket,
  RotateCcw,
  RotateCw,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Sun,
  Moon,
  Flame,
  Snowflake,
  Contrast,
  Image as ImageIcon,
  Grid,
  Sliders,
  Move,
} from 'lucide-react';

const SKIN_WIDTH = 64;
const SKIN_HEIGHT = 64;

// Default color palette presets
const PRESET_COLORS = [
  '#000000', '#ffffff', '#7f7f7f', '#c3c3c3',
  '#d4af37', '#fcd34d', '#ea580c', '#ef4444',
  '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4',
  '#10b981', '#84cc16', '#eab308', '#78350f',
  // Skin tone palette
  '#ffd1b3', '#fcd5b4', '#e0ac69', '#c68642',
  '#8d5524', '#4a2912', '#2a1607', '#1a0b02',
];

// Preset Kirka & Minecraft Skins for instant loading
const SKIN_PRESETS = [
  {
    name: 'Alex (3px Slim)',
    type: 'slim' as const,
    url: 'https://textures.minecraft.net/texture/a355648ca1524387d85ea751d382db6705574c83ff1c830a6e3001ad28a49c6d',
  },
  {
    name: 'Steve (4px Classic)',
    type: 'default' as const,
    url: 'https://textures.minecraft.net/texture/c9c35b80a4a6b2453e9c40212f4625b0458df4d989c92257d76a74db5390',
  },
  {
    name: 'Kirka Gingerman',
    type: 'slim' as const,
    url: 'https://kirka.io/assets/img/texture.74c78eb8.webp',
  },
  {
    name: 'Kirka Solitude',
    type: 'slim' as const,
    url: 'https://kirka.io/assets/img/texture.3c1c1d8a.webp',
  },
  {
    name: 'Kirka Fun',
    type: 'slim' as const,
    url: 'https://kirka.io/assets/img/texture.02854200.webp',
  },
];

type ToolType = 'brush' | 'eraser' | 'picker' | 'bucket';
type ModelType = 'default' | 'slim'; // Steve = default, Alex/Kirka = slim
type AnimationType = 'none' | 'idle' | 'walk' | 'run' | 'fly';
type BodyPartName = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

/**
 * Checks whether pixel (x, y) belongs to a specific body part & layer in 64x64 Minecraft UV space.
 */
function isPixelInPart(
  x: number,
  y: number,
  part: BodyPartName,
  layer: 'inner' | 'outer',
  isSlim: boolean
): boolean {
  if (layer === 'inner') {
    switch (part) {
      case 'head':
        return x >= 0 && x < 32 && y >= 0 && y < 16;
      case 'torso':
        return x >= 16 && x < 40 && y >= 16 && y < 32;
      case 'rightArm':
        return x >= 40 && x < (isSlim ? 54 : 56) && y >= 16 && y < 32;
      case 'leftArm':
        return x >= 32 && x < (isSlim ? 46 : 48) && y >= 48 && y < 64;
      case 'rightLeg':
        return x >= 0 && x < 16 && y >= 16 && y < 32;
      case 'leftLeg':
        return x >= 16 && x < 32 && y >= 48 && y < 64;
    }
  } else {
    // Outer Overlay Layer
    switch (part) {
      case 'head': // Hat
        return x >= 32 && x < 64 && y >= 0 && y < 16;
      case 'torso': // Jacket
        return x >= 16 && x < 40 && y >= 32 && y < 48;
      case 'rightArm': // Right Sleeve
        return x >= 40 && x < (isSlim ? 54 : 56) && y >= 32 && y < 48;
      case 'leftArm': // Left Sleeve
        return x >= 48 && x < (isSlim ? 62 : 64) && y >= 48 && y < 64;
      case 'rightLeg': // Right Pant
        return x >= 0 && x < 16 && y >= 32 && y < 48;
      case 'leftLeg': // Left Pant
        return x >= 0 && x < 16 && y >= 48 && y < 64;
    }
  }
  return false;
}

/**
 * Generates an exact Minecraft voxel quad pixel grid (LineSegments) for a 3D box.
 */
function createBoxGridLines(
  w: number,
  h: number,
  d: number,
  nx: number,
  ny: number,
  nz: number,
  color: number = 0x475569,
  opacity: number = 0.4
): THREE.LineSegments {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const vertices: number[] = [];

  // Front & Back faces
  for (let i = 0; i <= nx; i++) {
    const x = -hw + (i * w) / nx;
    vertices.push(x, -hh, hd, x, hh, hd);
    vertices.push(x, -hh, -hd, x, hh, -hd);
  }
  for (let j = 0; j <= ny; j++) {
    const y = -hh + (j * h) / ny;
    vertices.push(-hw, y, hd, hw, y, hd);
    vertices.push(-hw, y, -hd, hw, y, -hd);
  }

  // Left & Right faces
  for (let m = 0; m <= nz; m++) {
    const z = -hd + (m * d) / nz;
    vertices.push(-hw, -hh, z, -hw, hh, z);
    vertices.push(hw, -hh, z, hw, hh, z);
  }
  for (let j = 0; j <= ny; j++) {
    const y = -hh + (j * h) / ny;
    vertices.push(-hw, y, -hd, -hw, y, hd);
    vertices.push(hw, y, -hd, hw, y, hd);
  }

  // Top & Bottom faces
  for (let i = 0; i <= nx; i++) {
    const x = -hw + (i * w) / nx;
    vertices.push(x, hh, -hd, x, hh, hd);
    vertices.push(x, -hh, -hd, x, -hh, hd);
  }
  for (let m = 0; m <= nz; m++) {
    const z = -hd + (m * d) / nz;
    vertices.push(-hw, hh, z, hw, hh, z);
    vertices.push(-hw, -hh, z, hw, -hh, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'skinGridLines';
  return lines;
}

/**
 * Attaches exact 1x1 quad pixel grids to all 6 character limbs.
 */
function attachGridsToSkin(viewer: SkinViewer, isSlim: boolean) {
  const skin = viewer.playerObject.skin;
  if (!skin) return;

  const armW = isSlim ? 3 : 4;

  const cleanChildren = (obj: any) => {
    if (!obj || !obj.children) return;
    for (let i = obj.children.length - 1; i >= 0; i--) {
      const child = obj.children[i];
      if (child.name === 'skinGridLines' || child.name === 'skinGhostBox') {
        obj.remove(child);
      }
    }
  };

  // 1. Head (8x8x8 inner, 9x9x9 outer)
  cleanChildren(skin.head.innerLayer);
  (skin.head.innerLayer as any).add(createBoxGridLines(8.02, 8.02, 8.02, 8, 8, 8, 0x475569, 0.4));

  cleanChildren(skin.head.outerLayer);
  (skin.head.outerLayer as any).add(createBoxGridLines(9.02, 9.02, 9.02, 8, 8, 8, 0x38bdf8, 0.6));

  // 2. Torso (8x12x4 inner, 8.5x12.5x4.5 outer)
  cleanChildren(skin.body.innerLayer);
  (skin.body.innerLayer as any).add(createBoxGridLines(8.02, 12.02, 4.02, 8, 12, 4, 0x475569, 0.4));

  cleanChildren(skin.body.outerLayer);
  (skin.body.outerLayer as any).add(createBoxGridLines(8.52, 12.52, 4.52, 8, 12, 4, 0x38bdf8, 0.6));

  // 3. Right Arm (inner scaled armW,12,4, outer scaled armW+0.5,12.5,4.5)
  cleanChildren(skin.rightArm.innerLayer);
  (skin.rightArm.innerLayer as any).add(createBoxGridLines(1.01, 1.01, 1.01, armW, 12, 4, 0x475569, 0.4));

  cleanChildren(skin.rightArm.outerLayer);
  (skin.rightArm.outerLayer as any).add(createBoxGridLines(1.01, 1.01, 1.01, armW, 12, 4, 0x38bdf8, 0.6));

  // 4. Left Arm
  cleanChildren(skin.leftArm.innerLayer);
  (skin.leftArm.innerLayer as any).add(createBoxGridLines(1.01, 1.01, 1.01, armW, 12, 4, 0x475569, 0.4));

  cleanChildren(skin.leftArm.outerLayer);
  (skin.leftArm.outerLayer as any).add(createBoxGridLines(1.01, 1.01, 1.01, armW, 12, 4, 0x38bdf8, 0.6));

  // 5. Right Leg (4x12x4 inner, 4.5x12.5x4.5 outer)
  cleanChildren(skin.rightLeg.innerLayer);
  (skin.rightLeg.innerLayer as any).add(createBoxGridLines(4.02, 12.02, 4.02, 4, 12, 4, 0x475569, 0.4));

  cleanChildren(skin.rightLeg.outerLayer);
  (skin.rightLeg.outerLayer as any).add(createBoxGridLines(4.52, 12.52, 4.52, 4, 12, 4, 0x38bdf8, 0.6));

  // 6. Left Leg
  cleanChildren(skin.leftLeg.innerLayer);
  (skin.leftLeg.innerLayer as any).add(createBoxGridLines(4.02, 12.02, 4.02, 4, 12, 4, 0x475569, 0.4));

  cleanChildren(skin.leftLeg.outerLayer);
  (skin.leftLeg.outerLayer as any).add(createBoxGridLines(4.52, 12.52, 4.52, 4, 12, 4, 0x38bdf8, 0.6));
}

export const SkinEditor: React.FC = () => {
  // 3D Canvas Refs
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const skinViewerRef = useRef<SkinViewer | null>(null);

  // 2D Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Editor State
  const [modelType, setModelType] = useState<ModelType>('slim');
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [activeColor, setActiveColor] = useState<string>('#d4af37');
  const [recentColors, setRecentColors] = useState<string[]>([
    '#d4af37', '#ea580c', '#3b82f6', '#10b981', '#ffffff', '#0e1017'
  ]);
  const [zoomLevel, setZoomLevel] = useState<number>(10);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number } | null>(null);

  // 3D Direct Painting Mode: 'paint' (draw on model) vs 'orbit' (rotate view)
  const [interactionMode, setInteractionMode] = useState<'paint' | 'orbit'>('paint');

  // Skindex-Style Layer Selection: 'Body' vs 'Outer layer'
  const [innerLayerVisible, setInnerLayerVisible] = useState(true);
  const [outerLayerVisible, setOuterLayerVisible] = useState(true);

  // Skindex-Style Interactive Body Part Schematic Diagram
  const [partsVisibility, setPartsVisibility] = useState<Record<BodyPartName, boolean>>({
    head: true,
    torso: true,
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
  });

  // 3D Animation & Viewport State
  const [activeAnimation, setActiveAnimation] = useState<AnimationType>('none');
  const [bgType, setBgType] = useState<'studio' | 'light' | 'checker' | 'dark' | 'custom'>('studio');
  const [customBgImage, setCustomBgImage] = useState<string | null>(null);

  // Undo / Redo History Stack
  const historyStack = useRef<ImageData[]>([]);
  const historyIndex = useRef<number>(-1);
  const isPainting2D = useRef<boolean>(false);
  const isPainting3D = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Apply Layer & Body Part Visibility in 3D Viewport
  const applyLayerVisibility = useCallback(() => {
    if (!skinViewerRef.current) return;
    const player = skinViewerRef.current.playerObject;
    if (!player) return;
    player.visible = true;
    const skin = player.skin;
    if (!skin) return;
    skin.visible = true;

    // Inner Layer (Body)
    skin.head.innerLayer.visible = innerLayerVisible && partsVisibility.head;
    skin.body.innerLayer.visible = innerLayerVisible && partsVisibility.torso;
    skin.leftArm.innerLayer.visible = innerLayerVisible && partsVisibility.leftArm;
    skin.rightArm.innerLayer.visible = innerLayerVisible && partsVisibility.rightArm;
    skin.leftLeg.innerLayer.visible = innerLayerVisible && partsVisibility.leftLeg;
    skin.rightLeg.innerLayer.visible = innerLayerVisible && partsVisibility.rightLeg;

    // Outer Layer (Overlay / Armor / Hat / Jacket)
    skin.head.outerLayer.visible = outerLayerVisible && partsVisibility.head;
    skin.body.outerLayer.visible = outerLayerVisible && partsVisibility.torso;
    skin.leftArm.outerLayer.visible = outerLayerVisible && partsVisibility.leftArm;
    skin.rightArm.outerLayer.visible = outerLayerVisible && partsVisibility.rightArm;
    skin.leftLeg.outerLayer.visible = outerLayerVisible && partsVisibility.leftLeg;
    skin.rightLeg.outerLayer.visible = outerLayerVisible && partsVisibility.rightLeg;
  }, [innerLayerVisible, outerLayerVisible, partsVisibility]);

  // Sync 2D Canvas changes to 3D Viewport in REAL TIME (60 FPS)
  const syncTo3D = useCallback(() => {
    if (!skinViewerRef.current || !canvasRef.current) return;
    const viewer = skinViewerRef.current;
    viewer.playerObject.visible = true;
    viewer.playerObject.skin.visible = true;
    viewer.loadSkin(canvasRef.current, { model: modelType, makeVisible: true });
    applyLayerVisibility();
  }, [modelType, applyLayerVisibility]);

  // --------------------------------------------------------------------------
  // 1. INITIALIZE 3D SKIN VIEWER (skinview3d)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!viewerContainerRef.current || !canvasRef.current) return;

    const width = viewerContainerRef.current.clientWidth || 340;
    const height = viewerContainerRef.current.clientHeight || 440;

    const viewer = new SkinViewer({
      canvas: document.createElement('canvas'),
      width,
      height,
    });

    viewer.width = width;
    viewer.height = height;
    viewer.controls.enablePan = true;
    viewer.controls.enableZoom = true;
    viewer.controls.enableRotate = true;

    // Append canvas to container with full dimensions
    viewer.canvas.style.width = '100%';
    viewer.canvas.style.height = '100%';
    viewer.canvas.style.display = 'block';

    viewerContainerRef.current.appendChild(viewer.canvas);
    skinViewerRef.current = viewer;

    viewer.playerObject.visible = true;
    viewer.playerObject.skin.visible = true;
    if (canvasRef.current) {
      viewer.loadSkin(canvasRef.current, { model: modelType, makeVisible: true });
    }
    viewer.resetCameraPose();
    attachGridsToSkin(viewer, modelType === 'slim');
    applyLayerVisibility();

    const handleResize = () => {
      if (!viewerContainerRef.current || !skinViewerRef.current) return;
      const w = viewerContainerRef.current.clientWidth;
      const h = viewerContainerRef.current.clientHeight;
      skinViewerRef.current.width = w;
      skinViewerRef.current.height = h;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      viewer.dispose();
      if (viewer.canvas && viewer.canvas.parentNode) {
        viewer.canvas.parentNode.removeChild(viewer.canvas);
      }
    };
  }, []);

  // Update Animation
  useEffect(() => {
    if (!skinViewerRef.current) return;
    const viewer = skinViewerRef.current;

    switch (activeAnimation) {
      case 'idle':
        viewer.animation = new IdleAnimation();
        break;
      case 'walk':
        viewer.animation = new WalkingAnimation();
        break;
      case 'run':
        viewer.animation = new RunningAnimation();
        break;
      case 'fly':
        viewer.animation = new FlyingAnimation();
        break;
      default:
        viewer.animation = null;
        viewer.playerObject.skin.resetJoints();
        viewer.playerObject.rotation.set(0, 0, 0);
        break;
    }
  }, [activeAnimation]);

  // Update Model Type (Steve 4px vs Alex 3px)
  useEffect(() => {
    if (!skinViewerRef.current) return;
    skinViewerRef.current.playerObject.skin.modelType = modelType;
    if (canvasRef.current) {
      skinViewerRef.current.loadSkin(canvasRef.current, { model: modelType, makeVisible: true });
    }
    skinViewerRef.current.playerObject.visible = true;
    skinViewerRef.current.playerObject.skin.visible = true;
    attachGridsToSkin(skinViewerRef.current, modelType === 'slim');
    applyLayerVisibility();
  }, [modelType, applyLayerVisibility]);

  // Update Layer & Body Part Visibility in 3D Viewport
  useEffect(() => {
    applyLayerVisibility();
  }, [applyLayerVisibility]);

  // Toggle 3D Voxel Grid Lines visibility
  useEffect(() => {
    if (!skinViewerRef.current) return;
    const skin = skinViewerRef.current.playerObject.skin;
    if (!skin) return;

    skin.traverse((child) => {
      if (child.name === 'skinGridLines') {
        child.visible = showGrid;
      }
    });
  }, [showGrid]);

  // --------------------------------------------------------------------------
  // 2. UNDO / REDO HISTORY ENGINE
  // --------------------------------------------------------------------------
  const saveToHistory = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, SKIN_WIDTH, SKIN_HEIGHT);
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1);
    historyStack.current.push(imgData);

    if (historyStack.current.length > 30) {
      historyStack.current.shift();
    }

    historyIndex.current = historyStack.current.length - 1;
    setCanUndo(historyIndex.current > 0);
    setCanRedo(false);
  }, []);

  const handleUndo = () => {
    if (historyIndex.current <= 0 || !canvasRef.current) return;
    historyIndex.current -= 1;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.putImageData(historyStack.current[historyIndex.current], 0, 0);
    syncTo3D();
    setCanUndo(historyIndex.current > 0);
    setCanRedo(true);
  };

  const handleRedo = () => {
    if (historyIndex.current >= historyStack.current.length - 1 || !canvasRef.current) return;
    historyIndex.current += 1;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.putImageData(historyStack.current[historyIndex.current], 0, 0);
    syncTo3D();
    setCanUndo(true);
    setCanRedo(historyIndex.current < historyStack.current.length - 1);
  };

  // Keyboard Shortcuts for Undo (Ctrl+Z) & Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  // --------------------------------------------------------------------------
  // 3. LOAD DEFAULT SKIN ON CANVAS
  // --------------------------------------------------------------------------
  const loadSkinFromUrl = useCallback(async (url: string, targetModel: ModelType = 'slim') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    try {
      let proxiedUrl = url;
      if (url.includes('textures.minecraft.net') || url.includes('kirka.io')) {
        proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      }

      const loadedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          const directImg = new Image();
          directImg.crossOrigin = 'anonymous';
          directImg.onload = () => resolve(directImg);
          directImg.onerror = reject;
          directImg.src = url;
        };
        img.src = proxiedUrl;
      });

      ctx.clearRect(0, 0, SKIN_WIDTH, SKIN_HEIGHT);
      ctx.drawImage(loadedImg, 0, 0, SKIN_WIDTH, SKIN_HEIGHT);
      setModelType(targetModel);
      syncTo3D();
      saveToHistory();
      showToast(`Loaded ${targetModel === 'slim' ? 'Alex 3px' : 'Steve 4px'} skin`);
    } catch {
      showToast('Could not load skin preset from network. Current skin preserved.');
    }
  }, [syncTo3D, saveToHistory]);

  const createProceduralStarterSkin = (targetModel: ModelType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, SKIN_WIDTH, SKIN_HEIGHT);

    // 1. HEAD
    ctx.fillStyle = '#e0ac69'; // Skin tone
    ctx.fillRect(8, 8, 8, 8); // Head Front
    ctx.fillRect(0, 8, 8, 8); // Head Right
    ctx.fillRect(16, 8, 8, 8); // Head Left
    ctx.fillRect(24, 8, 8, 8); // Head Back
    ctx.fillStyle = '#78350f'; // Brown Hair
    ctx.fillRect(8, 0, 8, 8); // Head Top
    ctx.fillRect(8, 8, 8, 3); // Hair Bangs
    ctx.fillRect(0, 8, 8, 4); // Hair Right
    ctx.fillRect(16, 8, 8, 4); // Hair Left
    ctx.fillRect(24, 8, 8, 8); // Hair Back
    ctx.fillStyle = '#e0ac69'; // Head Bottom
    ctx.fillRect(16, 0, 8, 8);

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(9, 12, 2, 1);
    ctx.fillRect(13, 12, 2, 1);
    ctx.fillStyle = '#2563eb'; // Blue iris
    ctx.fillRect(10, 12, 1, 1);
    ctx.fillRect(13, 12, 1, 1);

    // 2. TORSO (Gold Esports Jersey)
    ctx.fillStyle = '#d4af37'; // Gold
    ctx.fillRect(20, 20, 8, 12); // Torso Front
    ctx.fillRect(32, 20, 8, 12); // Torso Back
    ctx.fillRect(16, 20, 4, 12); // Torso Right
    ctx.fillRect(28, 20, 4, 12); // Torso Left
    ctx.fillRect(20, 16, 8, 4); // Torso Top
    ctx.fillRect(28, 16, 8, 4); // Torso Bottom
    // Torso Details
    ctx.fillStyle = '#0f172a'; // Obsidian collar & belt
    ctx.fillRect(22, 20, 4, 2);
    ctx.fillRect(20, 30, 8, 2);

    // 3. RIGHT ARM
    const armW = targetModel === 'slim' ? 3 : 4;
    ctx.fillStyle = '#d4af37'; // Sleeve top
    ctx.fillRect(40, 16, armW * 2 + 8, 4);
    ctx.fillRect(40, 20, armW * 2 + 8, 6);
    ctx.fillStyle = '#e0ac69'; // Skin hand
    ctx.fillRect(40, 26, armW * 2 + 8, 6);

    // 4. LEFT ARM
    ctx.fillStyle = '#d4af37'; // Sleeve top
    ctx.fillRect(32, 48, armW * 2 + 8, 4);
    ctx.fillRect(32, 52, armW * 2 + 8, 6);
    ctx.fillStyle = '#e0ac69'; // Skin hand
    ctx.fillRect(32, 58, armW * 2 + 8, 6);

    // 5. RIGHT LEG (Obsidian Pants)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 16, 16, 12);
    ctx.fillStyle = '#1e293b'; // Shoes
    ctx.fillRect(0, 28, 16, 4);

    // 6. LEFT LEG (Obsidian Pants)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 48, 16, 12);
    ctx.fillStyle = '#1e293b'; // Shoes
    ctx.fillRect(16, 60, 16, 4);

    // 7. OUTER LAYER (Hat & Jacket Overlay)
    // Hat: 3D hair bangs & sideburns overlay
    ctx.fillStyle = '#92400e';
    ctx.fillRect(40, 8, 8, 3); // Hat Front bangs
    ctx.fillRect(32, 8, 8, 5); // Hat Right side hair
    ctx.fillRect(48, 8, 8, 5); // Hat Left side hair
    ctx.fillRect(56, 8, 8, 8); // Hat Back hair
    ctx.fillRect(40, 0, 8, 8); // Hat Top hair
    // Jacket: Collar & pocket details
    ctx.fillStyle = '#b45309';
    ctx.fillRect(20, 36, 8, 2); // Jacket collar
    ctx.fillRect(20, 44, 3, 2); // Left pocket
    ctx.fillRect(25, 44, 3, 2); // Right pocket

    setModelType(targetModel);
    syncTo3D();
    saveToHistory();
  };

  useEffect(() => {
    createProceduralStarterSkin('slim');
  }, []);

  // --------------------------------------------------------------------------
  // 4. PAINTING ON 2D TEXTURE CANVAS
  // --------------------------------------------------------------------------
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x < 0 || x >= SKIN_WIDTH || y < 0 || y >= SKIN_HEIGHT) return null;
    return { x, y };
  };

  const applyToolAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    if (activeTool === 'picker') {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      if (pixel[3] > 0) {
        const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2])
          .toString(16)
          .slice(1)}`;
        setActiveColor(hex);
        setActiveTool('brush');
        showToast(`Picked color: ${hex.toUpperCase()}`);
      }
      return;
    }

    if (activeTool === 'bucket') {
      floodFill(x, y, activeColor);
      syncTo3D();
      return;
    }

    const size = brushSize;
    if (activeTool === 'eraser') {
      ctx.clearRect(x, y, size, size);
    } else {
      ctx.fillStyle = activeColor;
      ctx.fillRect(x, y, size, size);

      if (!recentColors.includes(activeColor)) {
        setRecentColors((prev) => [activeColor, ...prev.slice(0, 7)]);
      }
    }

    syncTo3D();
  };

  // Flood Fill (Paint Bucket)
  const floodFill = (startX: number, startY: number, fillColorHex: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, SKIN_WIDTH, SKIN_HEIGHT);
    const data = imgData.data;

    const startIndex = (startY * SKIN_WIDTH + startX) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];

    const fillR = parseInt(fillColorHex.slice(1, 3), 16);
    const fillG = parseInt(fillColorHex.slice(3, 5), 16);
    const fillB = parseInt(fillColorHex.slice(5, 7), 16);
    const fillA = 255;

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) {
      return;
    }

    const matchColor = (idx: number) => {
      return (
        data[idx] === targetR &&
        data[idx + 1] === targetG &&
        data[idx + 2] === targetB &&
        data[idx + 3] === targetA
      );
    };

    const queue: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(SKIN_WIDTH * SKIN_HEIGHT);

    while (queue.length > 0) {
      const [curX, curY] = queue.pop()!;
      const pos = curY * SKIN_WIDTH + curX;
      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      if (!matchColor(idx)) continue;

      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;

      if (curX > 0) queue.push([curX - 1, curY]);
      if (curX < SKIN_WIDTH - 1) queue.push([curX + 1, curY]);
      if (curY > 0) queue.push([curX, curY - 1]);
      if (curY < SKIN_HEIGHT - 1) queue.push([curX, curY + 1]);
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const handle2DMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPainting2D.current = true;
    const coords = getCanvasCoordinates(e);
    if (coords) {
      applyToolAt(coords.x, coords.y);
    }
  };

  const handle2DMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setHoverPixel(coords);

    if (isPainting2D.current && coords && activeTool !== 'bucket' && activeTool !== 'picker') {
      applyToolAt(coords.x, coords.y);
    }
  };

  const handle2DMouseUp = () => {
    if (isPainting2D.current) {
      isPainting2D.current = false;
      saveToHistory();
    }
  };

  // --------------------------------------------------------------------------
  // 5. DIRECT 3D MODEL PAINTING (RAYCASTING UV COORDINATES)
  // --------------------------------------------------------------------------
  const getVisibleSkinMeshes = () => {
    if (!skinViewerRef.current) return [];
    const skin = skinViewerRef.current.playerObject.skin;
    if (!skin) return [];

    const meshes: THREE.Object3D[] = [];
    const parts = [
      { name: 'head', obj: skin.head },
      { name: 'torso', obj: skin.body },
      { name: 'leftArm', obj: skin.leftArm },
      { name: 'rightArm', obj: skin.rightArm },
      { name: 'leftLeg', obj: skin.leftLeg },
      { name: 'rightLeg', obj: skin.rightLeg },
    ] as const;

    parts.forEach(({ name, obj }) => {
      if (partsVisibility[name]) {
        if (outerLayerVisible && obj.outerLayer.visible) {
          meshes.push(obj.outerLayer as any);
        }
        if (innerLayerVisible && obj.innerLayer.visible) {
          meshes.push(obj.innerLayer as any);
        }
      }
    });

    return meshes;
  };

  const paintOn3DAtPointer = (clientX: number, clientY: number): boolean => {
    const viewer = skinViewerRef.current;
    if (!viewer) return false;

    const rect = viewer.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), viewer.camera as any);

    const targetMeshes = getVisibleSkinMeshes();
    const intersects = raycaster.intersectObjects(targetMeshes, false);

    if (intersects.length > 0 && intersects[0].uv) {
      const uv = intersects[0].uv;
      const px = Math.floor(uv.x * SKIN_WIDTH);
      const py = Math.floor((1.0 - uv.y) * SKIN_HEIGHT);

      if (px >= 0 && px < SKIN_WIDTH && py >= 0 && py < SKIN_HEIGHT) {
        applyToolAt(px, py);
        return true;
      }
    }
    return false;
  };

  const handle3DPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only left-click paints (button === 0). Right-click or middle-click always rotates/pans!
    if (e.button !== 0) return;

    if (interactionMode === 'paint') {
      const hit = paintOn3DAtPointer(e.clientX, e.clientY);
      if (hit) {
        isPainting3D.current = true;
        if (skinViewerRef.current) {
          // Disable orbit controls while painting on mesh
          skinViewerRef.current.controls.enabled = false;
        }
      }
    }
  };

  const handle3DPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPainting3D.current && interactionMode === 'paint') {
      paintOn3DAtPointer(e.clientX, e.clientY);
    }
  };

  const handle3DPointerUp = () => {
    if (isPainting3D.current) {
      isPainting3D.current = false;
      saveToHistory();
    }
    if (skinViewerRef.current) {
      skinViewerRef.current.controls.enabled = true;
    }
  };

  // --------------------------------------------------------------------------
  // 6. SCOPED FX & SHADING FILTERS (AFFECTS ONLY VISIBLE PARTS & LAYERS)
  // --------------------------------------------------------------------------
  const applyFilter = (filterType: 'warm' | 'cold' | 'bright' | 'shade' | 'contrast' | 'noise') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, SKIN_WIDTH, SKIN_HEIGHT);
    const d = imgData.data;
    const isSlim = modelType === 'slim';

    const partNames: BodyPartName[] = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

    for (let py = 0; py < SKIN_HEIGHT; py++) {
      for (let px = 0; px < SKIN_WIDTH; px++) {
        const i = (py * SKIN_WIDTH + px) * 4;

        // Skip fully transparent pixels
        if (d[i + 3] === 0) continue;

        // Check if this pixel belongs to an actively VISIBLE body part & active layer
        let isAllowed = false;
        for (const p of partNames) {
          if (partsVisibility[p]) {
            if (innerLayerVisible && isPixelInPart(px, py, p, 'inner', isSlim)) {
              isAllowed = true;
              break;
            }
            if (outerLayerVisible && isPixelInPart(px, py, p, 'outer', isSlim)) {
              isAllowed = true;
              break;
            }
          }
        }

        // If part or layer is hidden, do NOT modify this pixel!
        if (!isAllowed) continue;

        let r = d[i];
        let g = d[i + 1];
        let b = d[i + 2];

        switch (filterType) {
          case 'warm':
            r = Math.min(255, r + 14);
            g = Math.min(255, g + 6);
            b = Math.max(0, b - 10);
            break;
          case 'cold':
            r = Math.max(0, r - 10);
            g = Math.min(255, g + 4);
            b = Math.min(255, b + 16);
            break;
          case 'bright':
            r = Math.min(255, r + 20);
            g = Math.min(255, g + 20);
            b = Math.min(255, b + 20);
            break;
          case 'shade':
            r = Math.max(0, r - 20);
            g = Math.max(0, g - 20);
            b = Math.max(0, b - 20);
            break;
          case 'contrast':
            r = r < 128 ? Math.max(0, r - 12) : Math.min(255, r + 12);
            g = g < 128 ? Math.max(0, g - 12) : Math.min(255, g + 12);
            b = b < 128 ? Math.max(0, b - 12) : Math.min(255, b + 12);
            break;
          case 'noise': {
            const delta = Math.floor((Math.random() - 0.5) * 24);
            r = Math.max(0, Math.min(255, r + delta));
            g = Math.max(0, Math.min(255, g + delta));
            b = Math.max(0, Math.min(255, b + delta));
            break;
          }
        }

        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    syncTo3D();
    saveToHistory();
    showToast(`Applied ${filterType.toUpperCase()} to selected parts!`);
  };

  // --------------------------------------------------------------------------
  // 7. BACKGROUND UPLOAD & IMPORT/EXPORT
  // --------------------------------------------------------------------------
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCustomBgImage(result);
      setBgType('custom');
      showToast('Custom photo pinned behind character!');
    };
    reader.readAsDataURL(file);
  };

  const handleSkinUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      loadSkinFromUrl(result, modelType);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadSkin = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `kirka_skin_${modelType}_${Date.now()}.png`;
    a.click();
    showToast('Skin downloaded successfully!');
  };

  const handleResetCamera = () => {
    if (!skinViewerRef.current) return;
    skinViewerRef.current.resetCameraPose();
    skinViewerRef.current.controls.target.set(0, 0, 0);
    skinViewerRef.current.controls.update();
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col pt-1 pb-12 px-3 sm:px-6 max-w-[1600px] mx-auto select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-gold-primary/95 text-black font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center space-x-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-obsidian-border/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white">
              SKIN STUDIO
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gold-primary/20 border border-gold-primary/40 text-gold-bright font-bold uppercase">
              3D & 2D Redactor
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Paint directly on the 3D model, customize individual limbs, apply precision shading filters, and download.
          </p>
        </div>

        {/* Action Buttons: Presets, Import, Download */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            onChange={(e) => {
              const preset = SKIN_PRESETS.find((p) => p.name === e.target.value);
              if (preset) loadSkinFromUrl(preset.url, preset.type);
            }}
            className="bg-obsidian-card/80 border border-white/10 hover:border-gold-primary/40 text-xs font-mono text-slate-300 rounded-xl px-3 py-2 outline-none cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>
              🎨 Load Preset Skin...
            </option>
            {SKIN_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-xs font-mono text-slate-200 cursor-pointer transition-all active:scale-95">
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import Skin</span>
            <input
              type="file"
              accept="image/png"
              className="hidden"
              onChange={handleSkinUpload}
            />
          </label>

          <button
            onClick={handleDownloadSkin}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-gold-primary to-amber-500 text-black font-bold text-xs font-mono shadow-[0_0_15px_rgba(212,175,55,0.25)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export 64x64 PNG</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left = 3D Viewport & Controls, Right = 2D Pixel Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN: 3D VIEWPORT WITH DIRECT 3D PAINTING (5 cols) */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          {/* 3D Viewport Box with Direct Painting Pointer Handlers */}
          <div
            onPointerDown={handle3DPointerDown}
            onPointerMove={handle3DPointerMove}
            onPointerUp={handle3DPointerUp}
            className={`relative w-full h-[440px] rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center transition-all ${
              interactionMode === 'paint' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            } ${
              bgType === 'studio'
                ? 'bg-gradient-to-b from-[#2b3245] via-[#1d2230] to-[#141722]'
                : bgType === 'light'
                ? 'bg-gradient-to-b from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1]'
                : bgType === 'checker'
                ? 'bg-[#1e293b] bg-[linear-gradient(45deg,#334155_25%,transparent_25%),linear-gradient(-45deg,#334155_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#334155_75%),linear-gradient(-45deg,transparent_75%,#334155_75%)] [background-size:16px_16px] [background-position:0_0,0_8px,8px_-8px,-8px_0px]'
                : bgType === 'dark'
                ? 'bg-[#0f141f]'
                : 'bg-cover bg-center'
            }`}
            style={
              bgType === 'custom' && customBgImage
                ? { backgroundImage: `url(${customBgImage})` }
                : undefined
            }
          >
            {/* SkinViewer Canvas */}
            <div ref={viewerContainerRef} className="w-full h-full" />

            {/* Top Left: 3D Paint vs Orbit Mode Toggle */}
            <div className="absolute top-3 left-3 z-10 flex items-center space-x-1.5 bg-black/70 backdrop-blur-md p-1 rounded-xl border border-white/10 text-[10px] font-mono">
              <button
                onClick={() => setInteractionMode('paint')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  interactionMode === 'paint'
                    ? 'bg-gold-primary text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Paintbrush className="w-3 h-3" />
                <span>Paint on 3D</span>
              </button>
              <button
                onClick={() => setInteractionMode('orbit')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  interactionMode === 'orbit'
                    ? 'bg-indigo-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Move className="w-3 h-3" />
                <span>Rotate View</span>
              </button>
            </div>

            {/* Top Right: Reset Camera Button */}
            <div className="absolute top-3 right-3 z-10 flex items-center space-x-1.5">
              <button
                onClick={handleResetCamera}
                title="Reset Camera View"
                className="flex items-center space-x-1 px-2 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer backdrop-blur-md text-[10px] font-mono"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset View</span>
              </button>
            </div>

            {/* Bottom Floating Hint */}
            <div className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[9px] font-mono text-slate-400">
              {interactionMode === 'paint'
                ? 'Left-click on character to paint • Right-click to rotate'
                : 'Click and drag to rotate character in 360°'}
            </div>
          </div>

          {/* Skindex-Style Body Part Diagram & Layer Selector (Image 2 Match) */}
          <div className="bg-obsidian-card/70 p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Body Part Schematic Diagram */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                Click Limbs to Hide / Show
              </span>

              {/* Schematic Humanoid Figure */}
              <div className="flex flex-col items-center space-y-1">
                {/* Head */}
                <button
                  onClick={() => setPartsVisibility((p) => ({ ...p, head: !p.head }))}
                  title="Toggle Head"
                  className={`w-9 h-9 rounded border-2 transition-all cursor-pointer ${
                    partsVisibility.head
                      ? 'bg-amber-500/30 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                      : 'bg-transparent border-slate-600/50 text-slate-600'
                  }`}
                />

                {/* Arms and Torso row */}
                <div className="flex items-center space-x-1">
                  {/* Right Arm */}
                  <button
                    onClick={() => setPartsVisibility((p) => ({ ...p, rightArm: !p.rightArm }))}
                    title="Toggle Right Arm"
                    className={`w-4 h-12 rounded border-2 transition-all cursor-pointer ${
                      partsVisibility.rightArm
                        ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'bg-transparent border-slate-600/50'
                    }`}
                  />

                  {/* Torso */}
                  <button
                    onClick={() => setPartsVisibility((p) => ({ ...p, torso: !p.torso }))}
                    title="Toggle Torso (Body)"
                    className={`w-9 h-12 rounded border-2 transition-all cursor-pointer ${
                      partsVisibility.torso
                        ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'bg-transparent border-slate-600/50'
                    }`}
                  />

                  {/* Left Arm */}
                  <button
                    onClick={() => setPartsVisibility((p) => ({ ...p, leftArm: !p.leftArm }))}
                    title="Toggle Left Arm"
                    className={`w-4 h-12 rounded border-2 transition-all cursor-pointer ${
                      partsVisibility.leftArm
                        ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'bg-transparent border-slate-600/50'
                    }`}
                  />
                </div>

                {/* Legs row */}
                <div className="flex items-center space-x-1">
                  {/* Right Leg */}
                  <button
                    onClick={() => setPartsVisibility((p) => ({ ...p, rightLeg: !p.rightLeg }))}
                    title="Toggle Right Leg"
                    className={`w-4.5 h-12 rounded border-2 transition-all cursor-pointer ${
                      partsVisibility.rightLeg
                        ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'bg-transparent border-slate-600/50'
                    }`}
                  />

                  {/* Left Leg */}
                  <button
                    onClick={() => setPartsVisibility((p) => ({ ...p, leftLeg: !p.leftLeg }))}
                    title="Toggle Left Leg"
                    className={`w-4.5 h-12 rounded border-2 transition-all cursor-pointer ${
                      partsVisibility.leftLeg
                        ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'bg-transparent border-slate-600/50'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Right: Skindex-Style Layer Buttons & Model Selector */}
            <div className="flex flex-col space-y-3 w-full md:w-auto">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Painting Layer
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      if (innerLayerVisible && !outerLayerVisible) {
                        setInnerLayerVisible(false);
                        setOuterLayerVisible(true);
                        showToast('Viewing Outer Layer only');
                      } else {
                        setInnerLayerVisible((v) => !v);
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      innerLayerVisible
                        ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-md shadow-orange-950/40'
                        : 'bg-white/5 border border-white/10 text-slate-500 line-through hover:text-slate-300'
                    }`}
                  >
                    <span>Body</span>
                    {innerLayerVisible && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                  <button
                    onClick={() => {
                      if (outerLayerVisible && !innerLayerVisible) {
                        setOuterLayerVisible(false);
                        setInnerLayerVisible(true);
                        showToast('Viewing Body Layer only');
                      } else {
                        setOuterLayerVisible((v) => !v);
                      }
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      outerLayerVisible
                        ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-md shadow-orange-950/40'
                        : 'bg-white/5 border border-white/10 text-slate-500 line-through hover:text-slate-300'
                    }`}
                  >
                    <span>Outer layer</span>
                    {outerLayerVisible && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1.5 text-center">
                  {innerLayerVisible && outerLayerVisible
                    ? 'Both Body + Outer Layer visible'
                    : innerLayerVisible
                    ? 'Body Layer only'
                    : 'Outer Layer only (3D Grid active)'}
                </div>
              </div>

              {/* Model Arms Selector: Steve (4px) vs Alex (3px) */}
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Character Model
                </span>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as ModelType)}
                  className="w-full bg-black/50 border border-white/10 hover:border-gold-primary/40 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none cursor-pointer"
                >
                  <option value="slim">Alex / Kirka (Slim 3px)</option>
                  <option value="default">Steve / Standard (Classic 4px)</option>
                </select>
              </div>

              {/* Animation Poses */}
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Animation Pose
                </span>
                <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[11px] font-mono">
                  {(['none', 'idle', 'walk', 'run'] as AnimationType[]).map((anim) => (
                    <button
                      key={anim}
                      onClick={() => setActiveAnimation(anim)}
                      className={`py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                        activeAnimation === anim
                          ? 'bg-indigo-500/30 border border-indigo-500/50 text-indigo-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {anim === 'none' ? 'Pose' : anim}
                    </button>
                  ))}
                </div>
              </div>

              {/* Viewport Backdrop Switcher */}
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Viewport Backdrop
                </span>
                <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[11px] font-mono mb-2">
                  {[
                    { id: 'studio', label: 'Studio' },
                    { id: 'light', label: 'Light' },
                    { id: 'checker', label: 'Grid' },
                    { id: 'dark', label: 'Dark' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setBgType(bg.id as any)}
                      className={`py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                        bgType === bg.id
                          ? 'bg-gold-primary text-black shadow-[0_0_8px_rgba(212,175,55,0.3)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center justify-center space-x-1.5 text-xs font-mono text-gold-bright bg-gold-primary/10 border border-gold-primary/20 px-3 py-2 rounded-xl cursor-pointer hover:bg-gold-primary/20 transition-all">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{customBgImage && bgType === 'custom' ? 'Change Custom BG' : 'Pin Custom BG Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBgUpload}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: 2D PIXEL REDACTOR & SCOPED FILTERS (7 cols) */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          {/* Top Control Bar: Tools, Undo/Redo, Zoom, Grid */}
          <div className="bg-obsidian-card/80 p-3 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
            {/* Primary Drawing Tools */}
            <div className="flex items-center space-x-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setActiveTool('brush')}
                title="Pencil / Pixel Brush"
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeTool === 'brush'
                    ? 'bg-gold-primary text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Paintbrush className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTool('eraser')}
                title="Eraser (Clear Pixels)"
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeTool === 'eraser'
                    ? 'bg-gold-primary text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eraser className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTool('picker')}
                title="Color Picker / Eyedropper"
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeTool === 'picker'
                    ? 'bg-gold-primary text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Pipette className="w-4 h-4" />
              </button>

              <button
                onClick={() => setActiveTool('bucket')}
                title="Paint Bucket (Flood Fill)"
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeTool === 'bucket'
                    ? 'bg-gold-primary text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PaintBucket className="w-4 h-4" />
              </button>

              <button
                onClick={() => setBrushSize((s) => (s === 1 ? 2 : 1))}
                title={`Brush Size: ${brushSize}px`}
                className="px-2 py-1 text-xs font-mono font-bold bg-white/5 hover:bg-white/10 rounded-lg text-slate-300"
              >
                {brushSize}px
              </button>
            </div>

            {/* Undo / Redo */}
            <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-25 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-25 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom & Grid Controls */}
            <div className="flex items-center space-x-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(4, z - 2))}
                title="Zoom Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-300 font-bold">
                {zoomLevel}x
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(18, z + 2))}
                title="Zoom In"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowGrid((g) => !g)}
                title={showGrid ? 'Hide Pixel Grid' : 'Show Pixel Grid'}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  showGrid ? 'bg-gold-primary/20 text-gold-bright' : 'text-slate-400'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scoped FX & Shading Filters Toolbar (Only Affects Selected Limbs & Layer!) */}
          <div className="bg-obsidian-card/70 p-3 rounded-2xl border border-white/10 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-[11px] font-mono font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-gold-bright" />
                <span>Filters (Affects Only Selected Limbs & Layer):</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">
                Active: {innerLayerVisible && outerLayerVisible ? 'BODY + OUTER' : innerLayerVisible ? 'BODY ONLY' : 'OUTER ONLY'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => applyFilter('warm')}
                title="Warm Golden/Red Hue shift on selected parts"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Warm</span>
              </button>

              <button
                onClick={() => applyFilter('cold')}
                title="Cool Cyan/Blue Hue shift on selected parts"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span>Cold</span>
              </button>

              <button
                onClick={() => applyFilter('bright')}
                title="Brighten selected parts"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Brighten</span>
              </button>

              <button
                onClick={() => applyFilter('shade')}
                title="Darken / Shade selected parts"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-600/30 hover:bg-slate-600/50 border border-slate-500/50 text-slate-200 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Shade</span>
              </button>

              <button
                onClick={() => applyFilter('contrast')}
                title="Enhance contrast on selected parts"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Contrast className="w-3.5 h-3.5" />
                <span>Contrast</span>
              </button>

              <button
                onClick={() => applyFilter('noise')}
                title="Authentic Minecraft pixel noise texturing"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Dither Noise</span>
              </button>
            </div>
          </div>

          {/* Color Palette & Color Bar */}
          <div className="bg-obsidian-card/60 p-3 rounded-2xl border border-white/5 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label
                  className="w-8 h-8 rounded-xl border border-white/20 cursor-pointer shadow-md flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: activeColor }}
                >
                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    className="opacity-0 absolute inset-0 cursor-pointer"
                  />
                </label>
                <div>
                  <span className="text-xs font-mono font-bold text-white block">
                    {activeColor.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase">
                    Active Color
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {recentColors.map((color, i) => (
                  <button
                    key={`${color}-${i}`}
                    onClick={() => setActiveColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-5 h-5 rounded-lg border transition-transform cursor-pointer ${
                      activeColor.toLowerCase() === color.toLowerCase()
                        ? 'scale-115 border-gold-primary shadow-sm'
                        : 'border-white/10 hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-4.5 h-4.5 rounded-md border transition-transform cursor-pointer ${
                    activeColor.toLowerCase() === c.toLowerCase()
                      ? 'scale-125 border-gold-primary ring-1 ring-gold-primary'
                      : 'border-white/10 hover:scale-110'
                  }`}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* 2D 64x64 Texture Canvas Viewport with Pan & Zoom */}
          <div
            ref={canvasContainerRef}
            className="relative w-full h-[380px] overflow-auto rounded-2xl bg-[#090b11] border border-white/10 flex items-center justify-center p-6 shadow-inner no-scrollbar"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #0e111a 25%, transparent 25%), linear-gradient(-45deg, #0e111a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0e111a 75%), linear-gradient(-45deg, transparent 75%, #0e111a 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            }}
          >
            <div
              className="relative shadow-2xl transition-all"
              style={{
                width: `${SKIN_WIDTH * zoomLevel}px`,
                height: `${SKIN_HEIGHT * zoomLevel}px`,
              }}
            >
              <canvas
                ref={canvasRef}
                width={SKIN_WIDTH}
                height={SKIN_HEIGHT}
                onMouseDown={handle2DMouseDown}
                onMouseMove={handle2DMouseMove}
                onMouseUp={handle2DMouseUp}
                onMouseLeave={handle2DMouseUp}
                className="w-full h-full [image-rendering:pixelated] cursor-crosshair border border-white/20 rounded shadow-2xl"
              />

              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none rounded opacity-30"
                  style={{
                    backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                    backgroundSize: `${zoomLevel}px ${zoomLevel}px`,
                  }}
                />
              )}

              {hoverPixel && (
                <div
                  className="absolute pointer-events-none border border-gold-bright bg-gold-primary/30"
                  style={{
                    left: `${hoverPixel.x * zoomLevel}px`,
                    top: `${hoverPixel.y * zoomLevel}px`,
                    width: `${zoomLevel * brushSize}px`,
                    height: `${zoomLevel * brushSize}px`,
                  }}
                />
              )}
            </div>

            <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 text-[10px] font-mono text-slate-400">
              {hoverPixel ? `X: ${hoverPixel.x}, Y: ${hoverPixel.y}` : 'Draw on 2D texture or 3D model'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
