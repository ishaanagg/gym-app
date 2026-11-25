/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Google OAuth web client id for Drive backup. Optional; Drive sync is hidden if unset. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
