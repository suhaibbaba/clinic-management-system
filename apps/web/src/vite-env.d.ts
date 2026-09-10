/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path or origin of the API. Defaults to the same-origin `/api` proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// A constant rather than an `import.meta.env` entry: it is not configuration but a fact about this
// bundle, fixed when it was built.
declare const __APP_VERSION__: string;
