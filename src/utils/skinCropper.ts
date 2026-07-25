/**
 * Client-side canvas helper to crop a player's character skin texture (Minecraft format)
 * and extract their head/face (flat 2D), overlaying the accessory layer if present.
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
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(textureUrl);
        return;
      }

      // Disable image smoothing to preserve sharp retro pixel block edges!
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
