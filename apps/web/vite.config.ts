/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

/**
 * The version, inlined into the bundle.
 *
 * A browser cannot be told this later — there is no runtime configuration in a
 * static SPA — so it is baked in here and the settings screen reads the
 * constant. `VITE_APP_VERSION` is what the deploy passes in as a build arg;
 * the git fallback is for `pnpm dev`, where there is a checkout to ask.
 *
 * Inside the Docker build there is neither: `.git` is excluded from the build
 * context, which is exactly why the deploy passes the answer in rather than
 * letting the image guess. `0.0.0-dev` is then the honest answer, and it looks
 * like one.
 */
function appVersion(): string {
  const passedIn = process.env['VITE_APP_VERSION'];

  if (passedIn) {
    return passedIn;
  }

  try {
    const manifest = fileURLToPath(new URL('../../package.json', import.meta.url));
    const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string };
    const [major, minor] = version.split('.');
    const count = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return `${major}.${minor}.${count}`;
  } catch {
    return '0.0.0-dev';
  }
}

/** Same-origin `/api` in dev and in preview; nginx does it in production. */
function apiProxy(): Record<
  string,
  { target: string; changeOrigin: boolean; rewrite: (path: string) => string }
> {
  return {
    // Keeping the API same-origin is what lets the httpOnly refresh cookie
    // work without CORS credentials.
    '/api': {
      target: process.env['API_PROXY_TARGET'] ?? 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
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
    proxy: apiProxy(),
  },

  /*
   * `vite preview` serves the built bundle, and the end-to-end smoke run in CI
   * drives *that* rather than the dev server: a dev overlay hides exactly the
   * failures the run is looking for, and what ships is the build. It needs the
   * same same-origin `/api`, or every screen it opens is a login page.
   */
  preview: {
    host: true,
    port: 4173,
    proxy: apiProxy(),
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
      /*
       * `packages/shared` is declarations and nothing else.
       *
       * It is imported through one barrel, so every screen that wants
       * `bookingRequestSchema` gets the inventory, labs and billing schemas
       * with it — and a Zod schema is a *call*, which Rollup cannot prove is
       * free of side effects and therefore cannot drop. The whole package
       * landed in the chunk the two entries share, and the public booking
       * page paid for the dashboard's ledger types.
       *
       * Saying out loud what is already true — these modules define values and
       * touch nothing — lets the unused ones go. It is scoped to that package:
       * a blanket `moduleSideEffects: false` would also lie about polyfills.
       */
      treeshake: {
        moduleSideEffects: (id) => !id.includes(sharedSrcDir),
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
