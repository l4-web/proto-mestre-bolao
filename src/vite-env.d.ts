/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API NestJS do módulo. RTK Query bate aqui; cookie de sessão vai junto. */
  readonly VITE_API_URL: string;
  /** Origem do master (auth-api, onde mora o login). "" = mesma origem (prod). */
  readonly VITE_MASTER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
