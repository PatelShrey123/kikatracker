/**
 * Client-side canvas helper to crop a player's character skin texture (Minecraft format)
 * and render a 3D isometric head block, overlaying accessory layers.
 */
export function cropMinecraftHead(textureUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (!textureUrl) {
      resolve('');
      return;
    }

    const img = new Image();
    // Allow cross-origin fetches if texture is hosted on external domain
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Calculate texture scale multiplier (e.g. for 64px or 128px high-res skins)
      const scale = img.width / 64;

      // Helper to generate flat 8x8 canvases for each face layer
      const getFaceCanvas = (x: number, y: number, ox: number, oy: number): HTMLCanvasElement => {
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 8;
        faceCanvas.height = 8;
        const faceCtx = faceCanvas.getContext('2d');
        if (faceCtx) {
          faceCtx.imageSmoothingEnabled = false;
          // 1. Draw base head layer
          faceCtx.drawImage(img, x * scale, y * scale, 8 * scale, 8 * scale, 0, 0, 8, 8);
          // 2. Draw overlay hat layer
          faceCtx.drawImage(img, ox * scale, oy * scale, 8 * scale, 8 * scale, 0, 0, 8, 8);
        }
        return faceCanvas;
      };

      // Helper to rotate the Top face counter-clockwise by 90 degrees
      const rotateCanvas90CCW = (src: HTMLCanvasElement): HTMLCanvasElement => {
        const dst = document.createElement('canvas');
        dst.width = 8;
        dst.height = 8;
        const dstCtx = dst.getContext('2d');
        if (dstCtx) {
          dstCtx.imageSmoothingEnabled = false;
          dstCtx.translate(0, 8);
          dstCtx.rotate(-Math.PI / 2);
          dstCtx.drawImage(src, 0, 0);
        }
        return dst;
      };

      // Extract 3 visible head faces for the front-left shallow isometric view
      const topFace = getFaceCanvas(8, 0, 40, 0);         // Head Top + Hat Top
      const frontFace = getFaceCanvas(8, 8, 40, 8);       // Head Front + Hat Front
      const leftSideFace = getFaceCanvas(16, 8, 48, 8);   // Head Left Side + Hat Left Side

      // Rotate top face 90 degrees CCW to align correctly in the front-left projection
      const rotatedTopFace = rotateCanvas90CCW(topFace);

      // Create main output canvas for 3D isometric stitching
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(textureUrl);
        return;
      }

      // Disable image smoothing to preserve sharp pixel edges
      ctx.imageSmoothingEnabled = false;

      // Center and scale parameters for front-left shallow isometric view
      const L = 46; // isometric edge length
      const centerX = 64;
      const centerY = 68; // shifted down slightly for shallow vertical compression

      // 1. Draw Left Face (sheared extending left - displaying the Head Front face)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.transform(-0.94, -0.34, 0, 0.94, 0, 0);
      // Flip horizontally so the front profile connects cleanly to the center seam
      ctx.scale(-1, 1);
      ctx.drawImage(frontFace, -L, 0, L, L);
      ctx.restore();

      // 2. Draw Right Face (sheared extending right - displaying the Head Left Side profile)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.transform(0.94, -0.34, 0, 0.94, 0, 0);
      ctx.drawImage(leftSideFace, 0, 0, L, L);
      ctx.restore();

      // 3. Draw Top Face (rhombus extending up - displaying the rotated Head Top cap layer)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.transform(0.94, -0.34, -0.94, -0.34, 0, 0);
      // Flip vertically to align with the front seam
      ctx.scale(1, -1);
      ctx.drawImage(rotatedTopFace, 0, -L, L, L);
      ctx.restore();

      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        // Fallback to original texture if canvas is tainted by CORS
        resolve(textureUrl);
      }
    };

    img.onerror = () => {
      resolve(textureUrl);
    };

    img.src = textureUrl;
  });
}
