import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.KIRKA_API_KEY || '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060';

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
            'ApiKey': apiKey
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
