/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path or origin of the API. Defaults to the same-origin `/api` proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * The deployed build's version, inlined by `vite.config.ts` — see `appVersion`
 * there. A constant rather than an `import.meta.env` entry because it is not
 * configuration: it is a fact about this bundle, fixed the moment it was built.
 */
declare const __APP_VERSION__: string;
