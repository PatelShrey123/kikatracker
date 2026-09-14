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
