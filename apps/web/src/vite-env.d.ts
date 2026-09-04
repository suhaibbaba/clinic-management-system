/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path or origin of the API. Defaults to the same-origin `/api` proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
