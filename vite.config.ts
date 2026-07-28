import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: (process.env.VERCEL || process.env.NODE_ENV === 'development') ? '/' : './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.kirka.io',
        changeOrigin: true,
        secure: false,
        headers: {
          'ApiKey': 'fa0b8b9e49d8d22ac5708e51ab6fbb3f4225618d781548011325e4b4254584ee'
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
})
