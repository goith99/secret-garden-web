/**
 * Optional Supabase client for read-only public round history (Daily Winners). The anon key is
 * safe to ship in the browser; writes happen server-side from the operator script with the
 * service key. When the env vars are absent (e.g. local dev without a Supabase project) the
 * client is `null` and every caller degrades to empty data — no crash, no error surfaced.
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
