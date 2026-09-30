import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import path from 'path';

// `vite dev` does not run the functions in api/, so those routes 404 locally and the features
// behind them cannot be exercised while developing. This mounts the real handlers as dev
// middleware so local behaviour matches production.
//
// Only /api/changelog was mounted before, which meant /api/prices 404'd on every page load in
// dev and the price list silently fell back to the committed JSON — so the sheet, and anything
// layered on it, could never be tested locally.
const DEV_API_ROUTES = ['changelog', 'prices', 'bot-stats', 'chat'];

function apiDevServer() {
  return {
    name: 'api-dev-server',
    apply: 'serve' as const,
    configureServer(server: any) {
      for (const route of DEV_API_ROUTES) {
        server.middlewares.use(`/api/${route}`, async (req: any, res: any) => {
          try {
            const mod = await server.ssrLoadModule(`/api/${route}.js`);
            await mod.default(req, {
              setHeader: (k: string, v: string) => res.setHeader(k, v),
              status(code: number) { res.statusCode = code; return this; },
              json: (body: unknown) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); },
              // Vercel's response object has send(); this shim did not, so any handler using it
              // threw and was reported as an upstream failure. Kept in step with the real thing.
              send: (body: unknown) => { res.end(typeof body === 'string' ? body : JSON.stringify(body)); },
              end: () => res.end(),
            });
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message ?? 'dev handler failed' }));
          }
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.KIRKA_API_KEY || '';
  // the dev middleware runs api/changelog.js in-process, which reads this from process.env
  if (env.HUB_PRICES_SHEET_URL) process.env.HUB_PRICES_SHEET_URL = env.HUB_PRICES_SHEET_URL;
  // api/chat.js reads these; they are deliberately not VITE_-prefixed so they never reach the client
  if (env.CHAT_SUPABASE_URL) process.env.CHAT_SUPABASE_URL = env.CHAT_SUPABASE_URL;
  if (env.CHAT_SUPABASE_ANON_KEY) process.env.CHAT_SUPABASE_ANON_KEY = env.CHAT_SUPABASE_ANON_KEY;

  return {
    base: (process.env.VERCEL || process.env.NODE_ENV === 'development') ? '/' : './',
    plugins: [react(), tailwindcss(), apiDevServer()],
    resolve: {
      alias: {
        three: path.resolve(__dirname, 'node_modules/skinview3d/node_modules/three')
      }
    },
    optimizeDeps: {
      include: [
        'three',
        'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/controls/OrbitControls.js',
        'skinview3d',
      ],
    },
    server: {
      proxy: {
        '/api2': {
          target: 'https://api2.kirka.io',
          changeOrigin: true,
          secure: false,
          headers: {
            'ApiKey': apiKey
          },
          rewrite: (path) => path.replace(/^\/api2/, '/api')
        },
        '/api': {
          target: 'https://api.kirka.io',
          changeOrigin: true,
          secure: false,
          headers: {
            'ApiKey': apiKey
          }
        },
        '/trade-api': {
          target: 'https://kirka.lukeskywalk.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/trade-api/, '')
        },
        '/kirka-assets': {
          target: 'https://kirka.io',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/kirka-assets/, '')
        }
      }
    }
  };
})
