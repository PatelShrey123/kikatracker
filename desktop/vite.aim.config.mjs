import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Builds only the aim trainer, with relative paths so Electron can load it from disk.
export default defineConfig({
  root,
  base: './',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.join(root, 'desktop/app'),
    emptyOutDir: true,
    rollupOptions: { input: path.join(root, 'aim.html') },
  },
});
