/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const sharedSrcDir = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));
const appSrc = fileURLToPath(new URL('./src', import.meta.url));

/** Inotify does not reliably cross a Docker bind mount; poll when asked to. */
const usePolling = process.env['CHOKIDAR_USEPOLLING'] === 'true';

/**
 * `/book/…` serves the booking entry in development.
 *
 * nginx does this in production (see docker/nginx.conf). Without the same
 * rewrite here, `/book/al-nour` in `pnpm dev` would 404 and the only way to
 * see the page would be `/booking.html`, which is not the URL anyone is ever
 * sent — so the thing under test would not be the thing that ships.
 *
 * `/booking/…` is matched only at `/booking/manage/…`, the path the API writes
 * into the confirmation SMS. Anything wider swallows the dashboard's own
 * routes: `/booking/pending` briefly rendered the public page, which then read
 * "pending" as a clinic name and told reception the clinic did not exist.
 */
function bookingEntryDevServer(): Plugin {
  return {
    name: 'clinic-booking-entry',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const path = (request.url ?? '').split('?')[0] ?? '';

        if (/^\/book(\/|$)|^\/booking\/manage(\/|$)/.test(path)) {
          request.url = '/booking.html';
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), bookingEntryDevServer()],
  resolve: {
    alias: {
      // Mirrors the `paths` mappings in tsconfig.json.
      '@web': appSrc,
      // The shared package is compiled from source here, so its own alias has
      // to resolve in this context too.
      '@shared': sharedSrcDir,
      '@test': fileURLToPath(new URL('./test', import.meta.url)),
      '@clinic/shared': sharedSrc,
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling, interval: 300 },
    proxy: {
      // Same-origin API path in every environment: Vite proxies it in dev,
      // nginx proxies it in production. Keeping it same-origin is what lets the
      // httpOnly refresh cookie work without CORS credentials.
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
    rollupOptions: {
      /*
       * Two entries, two bundles.
       *
       * They share nothing but the CSS tokens and the logo, which is the whole
       * point: the public booking page has its own JavaScript budget (checked
       * in CI by `scripts/check-booking-bundle.mjs`) and must never grow a
       * dependency because the dashboard did.
       */
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        booking: fileURLToPath(new URL('./booking.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
