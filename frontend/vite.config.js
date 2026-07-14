import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Keep development at /, but place production assets in Laravel's public
  // directory so the API and SPA can share one cPanel domain.
  base: command === "build" ? "/app/" : "/",
  build: {
    outDir: "../backend/public/app",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
}))
