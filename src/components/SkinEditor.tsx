import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Maximize2,
  Sparkles,
  Sun,
  Moon,
  Flame,
  Snowflake,
  Contrast,
  Image as ImageIcon,
  Grid,
  Sliders,
} from 'lucide-react';

// Standard 64x64 Minecraft / Kirka Skin Texture Dimensions
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
];

type ToolType = 'brush' | 'eraser' | 'picker' | 'bucket';
type ModelType = 'default' | 'slim'; // Steve = default, Alex/Kirka = slim
type AnimationType = 'none' | 'idle' | 'walk' | 'run' | 'fly';

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

  // Layer & Body Part Visibility
  const [innerLayerVisible, setInnerLayerVisible] = useState(true);
  const [outerLayerVisible, setOuterLayerVisible] = useState(true);
  const [partsVisibility, setPartsVisibility] = useState({
    head: true,
    torso: true,
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
  });

  // 3D Animation & Viewport State
  const [activeAnimation, setActiveAnimation] = useState<AnimationType>('idle');
  const [bgType, setBgType] = useState<'esports' | 'grid' | 'black' | 'custom'>('esports');
  const [customBgImage, setCustomBgImage] = useState<string | null>(null);

  // Undo / Redo History Stack (holds ImageData objects)
  const historyStack = useRef<ImageData[]>([]);
  const historyIndex = useRef<number>(-1);
  const isPainting = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // --------------------------------------------------------------------------
  // 1. INITIALIZE 3D SKIN VIEWER (skinview3d)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!viewerContainerRef.current) return;

    const width = viewerContainerRef.current.clientWidth || 320;
    const height = viewerContainerRef.current.clientHeight || 420;

    const viewer = new SkinViewer({
      canvas: document.createElement('canvas'),
      width,
      height,
    });

    viewer.width = width;
    viewer.height = height;
    viewer.camera.position.set(0, 0, 70);
    viewer.controls.enablePan = true;
    viewer.controls.enableZoom = true;
    viewer.controls.enableRotate = true;

    viewerContainerRef.current.appendChild(viewer.canvas);
    skinViewerRef.current = viewer;

    // Default Animation
    const anim = new IdleAnimation();
    viewer.animation = anim;

    // Handle Window Resize
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

  // Update Animation when changed
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
        viewer.playerObject.rotation.set(0, 0, 0);
        break;
    }
  }, [activeAnimation]);

  // Update Model Type (Steve 4px vs Alex 3px)
  useEffect(() => {
    if (!skinViewerRef.current) return;
    skinViewerRef.current.loadSkin(canvasRef.current?.toDataURL() || '', {
      model: modelType,
    });
  }, [modelType]);

  // Update Layer & Body Part Visibility in 3D Viewport
  useEffect(() => {
    if (!skinViewerRef.current) return;
    const skin = skinViewerRef.current.playerObject.skin;
    if (!skin) return;

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

  // Sync 2D Canvas changes to 3D Viewport
  const syncTo3D = useCallback(() => {
    if (!canvasRef.current || !skinViewerRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    skinViewerRef.current.loadSkin(dataUrl, { model: modelType });
  }, [modelType]);

  // --------------------------------------------------------------------------
  // 2. UNDO / REDO HISTORY ENGINE
  // --------------------------------------------------------------------------
  const saveToHistory = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, SKIN_WIDTH, SKIN_HEIGHT);

    // Truncate any redo branch
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1);
    historyStack.current.push(imgData);

    // Limit history stack size to 30 steps
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
  // 3. LOAD DEFAULT STARTER SKIN ON CANVAS
  // --------------------------------------------------------------------------
  const loadSkinFromUrl = useCallback(async (url: string, targetModel: ModelType = 'slim') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      // Use KirkaHub CORS proxy for remote domains
      let proxiedUrl = url;
      if (url.includes('textures.minecraft.net') || url.includes('kirka.io')) {
        proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      }

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => {
          // Fallback direct attempt if proxy fails
          const directImg = new Image();
          directImg.crossOrigin = 'anonymous';
          directImg.onload = () => {
            img.src = directImg.src;
            resolve();
          };
          directImg.onerror = reject;
          directImg.src = url;
        };
        img.src = proxiedUrl;
      });

      ctx.clearRect(0, 0, SKIN_WIDTH, SKIN_HEIGHT);
      ctx.drawImage(img, 0, 0, SKIN_WIDTH, SKIN_HEIGHT);
      setModelType(targetModel);
      syncTo3D();
      saveToHistory();
      showToast(`Loaded ${targetModel === 'slim' ? 'Alex 3px' : 'Steve 4px'} skin`);
    } catch {
      // Procedural fallback dummy skin if offline
      createProceduralStarterSkin(targetModel);
    }
  }, [syncTo3D, saveToHistory]);

  const createProceduralStarterSkin = (targetModel: ModelType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, SKIN_WIDTH, SKIN_HEIGHT);

    // Procedural simple dummy character
    ctx.fillStyle = '#e0ac69'; // Skin
    ctx.fillRect(8, 8, 8, 8); // Head Front
    ctx.fillRect(0, 8, 8, 8); // Head Right
    ctx.fillRect(16, 8, 8, 8); // Head Left
    ctx.fillRect(8, 0, 8, 8); // Head Top

    ctx.fillStyle = '#2563eb'; // Blue Shirt
    ctx.fillRect(20, 20, 8, 12); // Torso Front
    ctx.fillRect(16, 20, 4, 12); // Torso Right
    ctx.fillRect(28, 20, 4, 12); // Torso Left

    ctx.fillStyle = '#1e3a8a'; // Blue Pants
    ctx.fillRect(4, 20, 4, 12); // Right Leg
    ctx.fillRect(20, 52, 4, 12); // Left Leg

    ctx.fillStyle = '#d4af37'; // Gold Highlights
    ctx.fillRect(22, 22, 4, 2);

    setModelType(targetModel);
    syncTo3D();
    saveToHistory();
  };

  useEffect(() => {
    loadSkinFromUrl(SKIN_PRESETS[0].url, 'slim');
  }, []);

  // --------------------------------------------------------------------------
  // 4. PAINTING & DRAWING LOGIC (2D Canvas)
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
        showToast(`Selected color: ${hex.toUpperCase()}`);
      }
      return;
    }

    if (activeTool === 'bucket') {
      floodFill(x, y, activeColor);
      syncTo3D();
      return;
    }

    // Brush or Eraser
    const size = brushSize;
    if (activeTool === 'eraser') {
      ctx.clearRect(x, y, size, size);
    } else {
      ctx.fillStyle = activeColor;
      ctx.fillRect(x, y, size, size);

      // Record in recent colors
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

    // Convert Fill Hex to RGBA
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPainting.current = true;
    const coords = getCanvasCoordinates(e);
    if (coords) {
      applyToolAt(coords.x, coords.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setHoverPixel(coords);

    if (isPainting.current && coords && activeTool !== 'bucket' && activeTool !== 'picker') {
      applyToolAt(coords.x, coords.y);
    }
  };

  const handleMouseUp = () => {
    if (isPainting.current) {
      isPainting.current = false;
      saveToHistory();
    }
  };

  // --------------------------------------------------------------------------
  // 5. BGMW'S SPECIAL FX & SHADING FILTERS (Discord Feature Requests)
  // --------------------------------------------------------------------------
  const applyFilter = (filterType: 'warm' | 'cold' | 'bright' | 'shade' | 'contrast' | 'noise') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, SKIN_WIDTH, SKIN_HEIGHT);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      // Only process visible pixels (ignore transparent areas)
      if (d[i + 3] === 0) continue;

      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      switch (filterType) {
        case 'warm':
          // Warm Golden/Red boost, slight blue reduction
          r = Math.min(255, r + 14);
          g = Math.min(255, g + 6);
          b = Math.max(0, b - 10);
          break;
        case 'cold':
          // Cool Cyan/Blue boost, slight red reduction
          r = Math.max(0, r - 10);
          g = Math.min(255, g + 4);
          b = Math.min(255, b + 16);
          break;
        case 'bright':
          // Brighten (+12%)
          r = Math.min(255, r + 20);
          g = Math.min(255, g + 20);
          b = Math.min(255, b + 20);
          break;
        case 'shade':
          // Darken / Manual Shading (-12%)
          r = Math.max(0, r - 20);
          g = Math.max(0, g - 20);
          b = Math.max(0, b - 20);
          break;
        case 'contrast':
          // S-Curve Contrast adjustment
          r = r < 128 ? Math.max(0, r - 12) : Math.min(255, r + 12);
          g = g < 128 ? Math.max(0, g - 12) : Math.min(255, g + 12);
          b = b < 128 ? Math.max(0, b - 12) : Math.min(255, b + 12);
          break;
        case 'noise': {
          // Subtle authentic Minecraft pixel texturing noise (-12 to +12)
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

    ctx.putImageData(imgData, 0, 0);
    syncTo3D();
    saveToHistory();
    showToast(`Applied ${filterType.toUpperCase()} filter`);
  };

  // --------------------------------------------------------------------------
  // 6. CUSTOM PHOTO BACKGROUND UPLOAD (Discord Feature Request)
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

  // --------------------------------------------------------------------------
  // 7. IMPORT & EXPORT SKIN
  // --------------------------------------------------------------------------
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
    skinViewerRef.current.camera.position.set(0, 0, 70);
    skinViewerRef.current.controls.reset();
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
            Create, paint, shade, and customize Minecraft & Kirka character skins with studio lighting.
          </p>
        </div>

        {/* Action Buttons: Presets, Import, Download */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector Dropdown */}
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

          {/* Upload Button */}
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

          {/* Download Button */}
          <button
            onClick={handleDownloadSkin}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-gold-primary to-amber-500 text-black font-bold text-xs font-mono shadow-[0_0_15px_rgba(212,175,55,0.25)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export 64x64 PNG</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left = 3D Viewport, Right = 2D Pixel Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN: 3D VIEWPORT & POSE CONTROLS (5 cols on lg) */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          {/* 3D Viewport Box */}
          <div
            className={`relative w-full h-[420px] rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center transition-all ${
              bgType === 'esports'
                ? 'bg-gradient-to-b from-[#0c0e17] via-[#07090e] to-[#040508]'
                : bgType === 'black'
                ? 'bg-black'
                : bgType === 'grid'
                ? 'bg-[#07090e] bg-[radial-gradient(#1f293d_1px,transparent_1px)] [background-size:16px_16px]'
                : 'bg-cover bg-center'
            }`}
            style={
              bgType === 'custom' && customBgImage
                ? { backgroundImage: `url(${customBgImage})` }
                : undefined
            }
          >
            {/* Mounting point for SkinViewer canvas */}
            <div ref={viewerContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Model Type Badge (Steve vs Alex) */}
            <div className="absolute top-3 left-3 z-10 flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-primary animate-pulse" />
              <span className="font-bold text-white uppercase">
                {modelType === 'slim' ? 'Alex (3px Slim)' : 'Steve (4px Classic)'}
              </span>
            </div>

            {/* Camera Reset & Zoom Controls Overlay */}
            <div className="absolute top-3 right-3 z-10 flex items-center space-x-1.5">
              <button
                onClick={handleResetCamera}
                title="Reset Camera View"
                className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer backdrop-blur-md"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom Floating Hint */}
            <div className="absolute bottom-3 left-3 z-10 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[9px] font-mono text-slate-400">
              Drag to rotate • Scroll to zoom • Right-click to pan
            </div>
          </div>

          {/* Model Switch & Animation Toolbar */}
          <div className="grid grid-cols-2 gap-2 bg-obsidian-card/60 p-3 rounded-2xl border border-white/5">
            {/* Model Arms Selector: Steve (4px) vs Alex (3px) */}
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                Model Template
              </label>
              <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setModelType('slim')}
                  className={`py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                    modelType === 'slim'
                      ? 'bg-gold-primary/20 border border-gold-primary/50 text-gold-bright'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Alex (3px)
                </button>
                <button
                  onClick={() => setModelType('default')}
                  className={`py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                    modelType === 'default'
                      ? 'bg-gold-primary/20 border border-gold-primary/50 text-gold-bright'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Steve (4px)
                </button>
              </div>
            </div>

            {/* 3D Posing & Animations */}
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                Character Pose
              </label>
              <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[11px] font-mono">
                {(['none', 'idle', 'walk', 'run'] as AnimationType[]).map((anim) => (
                  <button
                    key={anim}
                    onClick={() => setActiveAnimation(anim)}
                    className={`py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                      activeAnimation === anim
                        ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {anim === 'none' ? 'Pose' : anim}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Background Customizer (Bgmw's Request: Pin Photo in Redactor) */}
          <div className="bg-obsidian-card/60 p-3 rounded-2xl border border-white/5 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Viewport Background
              </span>
              <label className="flex items-center space-x-1 text-[10px] font-mono text-gold-bright bg-gold-primary/10 border border-gold-primary/20 px-2 py-0.5 rounded-lg cursor-pointer hover:bg-gold-primary/20 transition-all">
                <ImageIcon className="w-3 h-3" />
                <span>Pin Photo on BG</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBgUpload}
                />
              </label>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
              <button
                onClick={() => setBgType('esports')}
                className={`py-1 rounded-lg border transition-all cursor-pointer ${
                  bgType === 'esports'
                    ? 'border-gold-primary/50 text-gold-bright bg-gold-primary/10'
                    : 'border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Esports
              </button>
              <button
                onClick={() => setBgType('black')}
                className={`py-1 rounded-lg border transition-all cursor-pointer ${
                  bgType === 'black'
                    ? 'border-gold-primary/50 text-gold-bright bg-gold-primary/10'
                    : 'border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Pure Black
              </button>
              <button
                onClick={() => setBgType('grid')}
                className={`py-1 rounded-lg border transition-all cursor-pointer ${
                  bgType === 'grid'
                    ? 'border-gold-primary/50 text-gold-bright bg-gold-primary/10'
                    : 'border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setBgType('custom')}
                disabled={!customBgImage}
                className={`py-1 rounded-lg border transition-all cursor-pointer ${
                  bgType === 'custom'
                    ? 'border-gold-primary/50 text-gold-bright bg-gold-primary/10'
                    : 'border-white/5 text-slate-400 hover:text-white disabled:opacity-30'
                }`}
              >
                Photo
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: 2D PIXEL REDACTOR & CREATIVE TOOLSET (7 cols on lg) */}
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

              {/* Brush Size Toggle (1px vs 2px) */}
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

          {/* Bgmw's Color Effects & Shading Filters Toolbar */}
          <div className="bg-obsidian-card/60 p-2.5 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-gold-bright" />
              <span>Skin FX & Shading:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Warm Filter */}
              <button
                onClick={() => applyFilter('warm')}
                title="Make colors warmer (gold/red shift)"
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Flame className="w-3 h-3" />
                <span>Warm</span>
              </button>

              {/* Cold Filter */}
              <button
                onClick={() => applyFilter('cold')}
                title="Make colors cooler (cyan/blue shift)"
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Snowflake className="w-3 h-3" />
                <span>Cold</span>
              </button>

              {/* Brighten */}
              <button
                onClick={() => applyFilter('bright')}
                title="Brighten all pixels"
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Sun className="w-3 h-3" />
                <span>Bright</span>
              </button>

              {/* Shade / Darken */}
              <button
                onClick={() => applyFilter('shade')}
                title="Darken / Shade pixels"
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/40 text-slate-200 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Moon className="w-3 h-3" />
                <span>Shade</span>
              </button>

              {/* Contrast */}
              <button
                onClick={() => applyFilter('contrast')}
                title="Enhance contrast"
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Contrast className="w-3 h-3" />
                <span>Contrast</span>
              </button>

              {/* Noise Texture */}
              <button
                onClick={() => applyFilter('noise')}
                title="Authentic Minecraft pixel noise texturing"
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold cursor-pointer transition-all"
              >
                <Sliders className="w-3 h-3" />
                <span>Dither Noise</span>
              </button>
            </div>
          </div>

          {/* Layer & Limb Visibility Toggles (Inner/Outer + Limbs) */}
          <div className="bg-obsidian-card/60 p-2.5 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            {/* Layers */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Layers:
              </span>
              <button
                onClick={() => setInnerLayerVisible((v) => !v)}
                className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                  innerLayerVisible
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/5 border-white/5 text-slate-500 line-through'
                }`}
              >
                Inner Body
              </button>
              <button
                onClick={() => setOuterLayerVisible((v) => !v)}
                className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                  outerLayerVisible
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/5 border-white/5 text-slate-500 line-through'
                }`}
              >
                Outer Overlay
              </button>
            </div>

            {/* Individual Limbs */}
            <div className="flex items-center space-x-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Limbs:
              </span>
              {(['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const).map(
                (part) => {
                  const isVis = partsVisibility[part];
                  return (
                    <button
                      key={part}
                      onClick={() =>
                        setPartsVisibility((prev) => ({ ...prev, [part]: !prev[part] }))
                      }
                      title={`Toggle ${part}`}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer uppercase ${
                        isVis
                          ? 'bg-white/10 border-white/20 text-slate-200'
                          : 'bg-red-500/10 border-red-500/30 text-red-400 line-through'
                      }`}
                    >
                      {part.replace('left', 'L.').replace('right', 'R.').slice(0, 5)}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Color Palette & Current Color Bar */}
          <div className="bg-obsidian-card/60 p-3 rounded-2xl border border-white/5 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Active Color Swatch + Color Picker Input */}
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

              {/* Recent Swatches */}
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

            {/* Presets Grid */}
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

          {/* 2D 64x64 Texture Canvas Viewport with Scrollable Container */}
          <div
            ref={canvasContainerRef}
            className="relative w-full h-[400px] overflow-auto rounded-2xl bg-[#090b11] border border-white/10 flex items-center justify-center p-6 shadow-inner no-scrollbar"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #0e111a 25%, transparent 25%), linear-gradient(-45deg, #0e111a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0e111a 75%), linear-gradient(-45deg, transparent 75%, #0e111a 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            }}
          >
            {/* Real 64x64 Canvas with Smooth Zoom Scaling */}
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
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-full [image-rendering:pixelated] cursor-crosshair border border-white/20 rounded shadow-2xl"
              />

              {/* Grid Lines Overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none rounded opacity-30"
                  style={{
                    backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                    backgroundSize: `${zoomLevel}px ${zoomLevel}px`,
                  }}
                />
              )}

              {/* Hover Pixel Indicator */}
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

            {/* UV Map Guidelines Overlay Legend */}
            <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 text-[10px] font-mono text-slate-400">
              {hoverPixel ? `X: ${hoverPixel.x}, Y: ${hoverPixel.y}` : 'Hover over canvas to paint'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
