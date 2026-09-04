/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

/** Inotify does not reliably cross a Docker bind mount; poll when asked to. */
const usePolling = process.env['CHOKIDAR_USEPOLLING'] === 'true';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolve the workspace package to its TypeScript source so that editing
    // packages/shared hot-reloads the app without a separate build step.
    alias: { '@clinic/shared': sharedSrc },
  },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling, interval: 300 },
    proxy: {
      // Same-origin API path in every environment: Vite proxies it in dev,
      // nginx proxies it in production.
      '/api': {
        target: process.env['API_PROXY_TARGET'] ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
