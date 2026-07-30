import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.KIRKA_API_KEY;

  // The API key is only needed for the local dev proxy.
  // In production (Vercel), the serverless function in api/proxy.js
  // reads the key from process.env at runtime — no key needed at build time.
  if (!apiKey && mode === 'development') {
    console.warn('WARNING: KIRKA_API_KEY is not set in .env — dev proxy will not work without it.');
  }

  return {
    base: (process.env.VERCEL || process.env.NODE_ENV === 'development') ? '/' : './',
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: 'https://api.kirka.io',
          changeOrigin: true,
          secure: false,
          headers: {
            // Only inject ApiKey header if key is available (dev mode)
            ...(apiKey ? { 'ApiKey': apiKey } : {})
          }
        },
        '/trade-api': {
          target: 'https://kirka.lukeskywalk.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/trade-api/, '')
        }
      }
    }
  };
})
