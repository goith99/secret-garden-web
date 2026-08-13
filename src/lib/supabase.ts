/**
 * Optional Supabase client for public round data (Daily Winners, round metadata). The anon key
 * is safe to ship in the browser: it can only READ. Every write goes through an edge function
 * that verifies an operator signature and holds the service key server-side — see
 * supabase/functions/set-round-metadata and set-round-results. When the env vars are absent
 * (e.g. local dev without a Supabase project) the client is `null` and every caller degrades to
 * empty data — no crash, no error surfaced.
 */
import { createClient } from "@supabase/supabase-js";

// `import.meta.env` is injected by Vite and is UNDEFINED under plain Node, which is a real
// runtime here: scripts/verify-bracket-plan.mjs imports the reveal module, and the reveal
// module reaches this one. Optional chaining keeps that path working — a non-Vite caller
// simply gets `supabase === null`, the same degraded mode as an unconfigured build.
const env = import.meta.env ?? {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

/**
 * Pulls a readable message out of a functions.invoke() error, whose body holds the real one.
 * Shared by every edge-function caller: invoke() reports a bare "non-2xx status code" and
 * hides the reason the function actually gave, which is the only useful part for an operator.
 */
export async function invokeErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      /* non-JSON error body → fall through to the generic message */
    }
  }
  return error instanceof Error ? error.message : String(error);
}
