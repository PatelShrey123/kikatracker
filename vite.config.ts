import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import path from 'path';

// `vite dev` does not run the functions in api/, so /api/changelog would 404 locally and the
// pending-changes panel could never be seen while developing. This mounts the real handler as
// dev middleware, so local behaviour matches production.
function apiDevServer() {
  return {
    name: 'api-dev-server',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/api/changelog', async (req: any, res: any) => {
        try {
          const mod = await server.ssrLoadModule('/api/changelog.js');
          await mod.default(req, {
            setHeader: (k: string, v: string) => res.setHeader(k, v),
            status(code: number) { res.statusCode = code; return this; },
            json: (body: unknown) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); },
            end: () => res.end(),
          });
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message ?? 'dev handler failed' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.KIRKA_API_KEY || '';
  // the dev middleware runs api/changelog.js in-process, which reads this from process.env
  if (env.HUB_PRICES_SHEET_URL) process.env.HUB_PRICES_SHEET_URL = env.HUB_PRICES_SHEET_URL;

  return {
    base: (process.env.VERCEL || process.env.NODE_ENV === 'development') ? '/' : './',
    plugins: [react(), tailwindcss(), apiDevServer()],
    resolve: {
      alias: {
        three: path.resolve(__dirname, 'node_modules/skinview3d/node_modules/three')
      }
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
