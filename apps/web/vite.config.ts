/// <reference types="vitest/config" />
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { apiProxy } from "./vite/dev-proxy.ts";

const sharedSrc = fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url));
const sharedSrcDir = fileURLToPath(new URL("../../packages/shared/src", import.meta.url));
const uiSrc = fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url));
const uiSrcDir = fileURLToPath(new URL("../../packages/ui/src", import.meta.url));
const appSrc = fileURLToPath(new URL("./src", import.meta.url));

/** Inotify does not reliably cross a Docker bind mount; poll when asked to. */
const usePolling = process.env["CHOKIDAR_USEPOLLING"] === "true";

// nginx does this in production; without the same rewrite `/book/abu-obeid` 404s in `pnpm dev`.
// `/booking/…` matches only `/booking/manage/…` — anything wider swallowed `/booking/pending`.
function bookingEntry(): Plugin {
  const rewrite = (server: { middlewares: Connect.Server }): void => {
    server.middlewares.use((request, _response, next) => {
      const path = (request.url ?? "").split("?")[0] ?? "";

      if (/^\/book(\/|$)|^\/booking\/manage(\/|$)/.test(path)) {
        request.url = "/booking.html";
      }

      next();
    });
  };

  return {
    name: "clinic-booking-entry",
    configureServer: rewrite,
    // And the preview server: checking the built bundle is what `vite preview` is for, and without
    // this the public page silently served the staff app's shell instead.
    configurePreviewServer: rewrite,
  };
}

// The logo is fetched from object storage on a different origin, so the TLS handshake would
// otherwise start only once the bundle has run. Injected rather than written into the HTML, so a
// deployment without the variable gets no tag at all instead of an empty one.
function storagePreconnect(): Plugin {
  return {
    name: "clinic-storage-preconnect",
    transformIndexHtml() {
      const origin = process.env["VITE_STORAGE_ORIGIN"];

      return origin
        ? [
            {
              tag: "link",
              attrs: { rel: "preconnect", href: origin, crossorigin: "" },
              injectTo: "head" as const,
            },
            {
              tag: "link",
              attrs: { rel: "dns-prefetch", href: origin },
              injectTo: "head" as const,
            },
          ]
        : [];
    },
  };
}

// The shell only: never `/api`. This is a medical record on shared clinic hardware, and a cached
// response outlives the logout and the role change that should have ended it.
function pwa(): Plugin[] {
  return VitePWA({
    // The manifest is per clinic and served by the API; `index.html` links it directly.
    manifest: false,
    registerType: "prompt",
    injectRegister: null,
    workbox: {
      globPatterns: ["**/*.{js,css,html,woff2,svg,ico,png}"],
      navigateFallback: "/index.html",
      // The API answers for itself, and the public booking page is nginx's own entry.
      navigateFallbackDenylist: [/^\/api\//, /^\/book(\/|$)/, /^\/booking\/manage(\/|$)/],
      // Nothing is cached at runtime, so nothing medical can be. Precache is the whole strategy.
      runtimeCaching: [],
      cleanupOutdatedCaches: true,
    },
    devOptions: { enabled: false },
  });
}

// A static SPA has no runtime configuration, so the version is baked in. Inside Docker there is no
// `.git`, which is why the deploy passes it in.
function appVersion(): string {
  const passedIn = process.env["VITE_APP_VERSION"];

  if (passedIn) {
    return passedIn;
  }

  try {
    const manifest = fileURLToPath(new URL("../../package.json", import.meta.url));
    const { version } = JSON.parse(readFileSync(manifest, "utf8")) as { version: string };
    const [major, minor] = version.split(".");
    const count = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return `${major}.${minor}.${count}`;
  } catch {
    return "0.0.0-dev";
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [react(), tailwindcss(), bookingEntry(), storagePreconnect(), pwa()],
  resolve: {
    // An array, because the UI package needs its bare specifier and its subpaths resolved
    // differently, and the bare one has to be tried first.
    alias: [
      { find: "@web", replacement: appSrc },
      // The shared package is compiled from source here, so its own alias has
      // to resolve in this context too.
      { find: "@shared", replacement: sharedSrcDir },
      { find: "@test", replacement: fileURLToPath(new URL("./test", import.meta.url)) },
      { find: "@clinic/shared", replacement: sharedSrc },
      { find: /^@clinic\/ui$/, replacement: uiSrc },
      { find: /^@clinic\/ui\//, replacement: `${uiSrcDir}/` },
      { find: "@ui", replacement: uiSrcDir },
    ],
  },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling, interval: 300 },
    proxy: apiProxy(),
  },

  // Looking at the built bundle rather than the dev server is how a screenshot for a pull request
  // is taken — a dev overlay hides what it is meant to show — and it needs the same `/api` origin.
  preview: {
    host: true,
    port: 4173,
    proxy: apiProxy(),
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      // Two entries, two bundles: the public booking page has its own JavaScript budget and must
      // never grow a dependency because the dashboard did.
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        booking: fileURLToPath(new URL("./booking.html", import.meta.url)),
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
          name: "app",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./test/setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: "dev-proxy",
          environment: "node",
          globals: true,
          include: ["vite/**/*.test.ts"],
        },
      },
    ],
  },
});
