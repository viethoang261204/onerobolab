import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The admin console calls the API same-origin in development; Vite forwards
// /api and /health to the local API (pnpm dev:api or pnpm dev:api:memory).
// ROBOVERSE_API_PROXY still works (old name).
const API_TARGET = process.env.ONEROBOLAB_API_PROXY ?? process.env.ROBOVERSE_API_PROXY ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/health': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    // The 3D stack is split into its own chunk via React.lazy (see App.tsx).
    chunkSizeWarningLimit: 1200,
  },
});
