/**
 * Normalizes corrupted or prefixed texture URLs from API (e.g. 'https://kirka.iodata:image/png;base64,...')
 */
export function normalizeTextureUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  const dataIdx = trimmed.indexOf('data:image/');
  if (dataIdx !== -1) {
    return trimmed.substring(dataIdx);
  }
  return trimmed;
}

/**
 * Client-side canvas helper to crop a player's character skin texture (Minecraft format)
 * and extract their head/face (flat 2D), overlaying the accessory layer if present.
 */
export function cropMinecraftHead(textureUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const cleanUrl = normalizeTextureUrl(textureUrl);
    if (!cleanUrl) {
      resolve('');
      return;
    }

    const img = new Image();

    // Data URLs and blobs should NOT have crossOrigin set (triggers errors in some browsers)
    if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
      img.src = cleanUrl;
    } else {
      // For remote URLs, proxy through images.weserv.nl with CORS
      img.crossOrigin = 'anonymous';
      img.src = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
    }

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(cleanUrl.startsWith('data:') ? cleanUrl : '');
        return;
      }

      // Disable image smoothing to preserve sharp retro pixel block edges
      ctx.imageSmoothingEnabled = false;

      // Handle custom high-res textures by calculating scale multiplier
      const scale = img.width / 64;

      // 1. Draw base head layer (Front face: 8, 8, 8, 8)
      ctx.drawImage(
        img,
        8 * scale,
        8 * scale,
        8 * scale,
        8 * scale,
        0,
        0,
        64,
        64
      );

      // 2. Draw overlay hat accessory layer (Front face: 40, 8, 8, 8)
      ctx.drawImage(
        img,
        40 * scale,
        8 * scale,
        8 * scale,
        8 * scale,
        0,
        0,
        64,
        64
      );

      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        // Fallback if canvas is tainted
        resolve('');
      }
    };

    img.onerror = () => {
      // Fallback: if weserv proxy failed, try loading directly
      if (!cleanUrl.startsWith('data:') && !cleanUrl.startsWith('blob:')) {
        const directImg = new Image();
        directImg.crossOrigin = 'anonymous';
        directImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(''); return; }
            ctx.imageSmoothingEnabled = false;
            const scale = directImg.width / 64;
            ctx.drawImage(directImg, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
            ctx.drawImage(directImg, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
            resolve(canvas.toDataURL('image/png'));
          } catch {
            resolve('');
          }
        };
        directImg.onerror = () => resolve('');
        directImg.src = cleanUrl;
      } else {
        resolve('');
      }
    };
  });
}

/**
 * Client-side canvas helper to crop and assemble a full 2D front body character render
 * (Minecraft 3px Slim format) directly in the browser from any 64x64 or 128x128 texture.
 */
export function cropMinecraftBody(textureUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const cleanUrl = normalizeTextureUrl(textureUrl);
    if (!cleanUrl) {
      resolve('');
      return;
    }

    const img = new Image();
    if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:')) {
      img.src = cleanUrl;
    } else {
      img.crossOrigin = 'anonymous';
      img.src = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
    }

    const drawBodyOnCanvas = (sourceImage: HTMLImageElement): string => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.imageSmoothingEnabled = false;
      const s = sourceImage.width / 64;
      const outScale = 8; // 16x32 -> 128x256
      const isOld = sourceImage.height === (32 * s);

      // Helper to draw a body part
      const drawPart = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, mirror = false) => {
        if (mirror) {
          ctx.save();
          ctx.translate((dx + sw) * outScale, dy * outScale);
          ctx.scale(-1, 1);
          ctx.drawImage(sourceImage, sx * s, sy * s, sw * s, sh * s, 0, 0, sw * outScale, sh * outScale);
          ctx.restore();
        } else {
          ctx.drawImage(sourceImage, sx * s, sy * s, sw * s, sh * s, dx * outScale, dy * outScale, sw * outScale, sh * outScale);
        }
      };

      // Base body
      drawPart(8, 8, 8, 8, 4, 0);         // Head
      drawPart(20, 20, 8, 12, 4, 8);      // Torso
      drawPart(44, 20, 3, 12, 1, 8);      // Right Arm (Slim 3px)
      if (isOld) {
        drawPart(44, 20, 3, 12, 12, 8, true); // Left Arm (mirrored)
      } else {
        drawPart(36, 52, 3, 12, 12, 8);   // Left Arm
      }
      drawPart(4, 20, 4, 12, 4, 20);      // Right Leg
      if (isOld) {
        drawPart(4, 20, 4, 12, 8, 20, true);  // Left Leg (mirrored)
      } else {
        drawPart(20, 52, 4, 12, 8, 20);    // Left Leg
      }

      // Overlays
      drawPart(40, 8, 8, 8, 4, 0);        // Hat
      if (!isOld) {
        drawPart(20, 36, 8, 12, 4, 8);    // Jacket
        drawPart(44, 36, 3, 12, 1, 8);    // Right Arm Sleeve
        drawPart(52, 52, 3, 12, 12, 8);   // Left Arm Sleeve
        drawPart(4, 36, 4, 12, 4, 20);    // Right Leg Pants
        drawPart(4, 52, 4, 12, 8, 20);    // Left Leg Pants
      }

      try {
        return canvas.toDataURL('image/png');
      } catch {
        return '';
      }
    };

    img.onload = () => {
      const res = drawBodyOnCanvas(img);
      resolve(res);
    };

    img.onerror = () => {
      if (!cleanUrl.startsWith('data:') && !cleanUrl.startsWith('blob:')) {
        const directImg = new Image();
        directImg.crossOrigin = 'anonymous';
        directImg.onload = () => resolve(drawBodyOnCanvas(directImg));
        directImg.onerror = () => resolve('');
        directImg.src = cleanUrl;
      } else {
        resolve('');
      }
    };
  });
}

