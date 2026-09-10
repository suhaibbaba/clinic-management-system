/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { apiProxy } from './vite/dev-proxy.ts';

const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const sharedSrcDir = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));
const appSrc = fileURLToPath(new URL('./src', import.meta.url));

/** Inotify does not reliably cross a Docker bind mount; poll when asked to. */
const usePolling = process.env['CHOKIDAR_USEPOLLING'] === 'true';

// nginx does this in production; without the same rewrite `/book/al-nour` 404s in `pnpm dev`.
// `/booking/…` matches only `/booking/manage/…` — anything wider swallowed `/booking/pending`.
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

// A static SPA has no runtime configuration, so the version is baked in. Inside Docker there is no
// `.git`, which is why the deploy passes it in.
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

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [react(), tailwindcss(), bookingEntryDevServer()],
  resolve: {
    alias: {
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

  // CI's smoke run drives the built bundle rather than the dev server — a dev overlay hides exactly
  // the failures it looks for — and it needs the same same-origin `/api`.
  preview: {
    host: true,
    port: 4173,
    proxy: apiProxy(),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // Two entries, two bundles: the public booking page has its own JavaScript budget and must
      // never grow a dependency because the dashboard did.
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        booking: fileURLToPath(new URL('./booking.html', import.meta.url)),
      },
      // A Zod schema is a call Rollup cannot prove side-effect-free, so the shared barrel landed in
      // the shared chunk. Scoped to that package — a blanket flag would lie about polyfills.
      treeshake: {
        moduleSideEffects: (id) => !id.includes(sharedSrcDir),
      },
    },
  },
  // Two suites, two environments: the app's render into jsdom, the dev proxy's start a real server
  // and a real target and want Node.
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'dev-proxy',
          environment: 'node',
          globals: true,
          include: ['vite/**/*.test.ts'],
        },
      },
    ],
  },
});
