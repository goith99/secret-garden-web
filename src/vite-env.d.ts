/// <reference types="vite/client" />

/** Typed access to the Supabase env vars so `import.meta.env.*` isn't `any`. Both are optional:
 *  when unset, the Supabase client is null and the app degrades gracefully (see src/lib/supabase.ts). */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
