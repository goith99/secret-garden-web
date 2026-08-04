/**
 * set-round-metadata — the ONLY writer of public.round_metadata.
 *
 * The table has no insert/update policy, so the anon key every browser ships cannot touch it.
 * This function holds the service role key (server-side only, injected by Supabase) and writes
 * on the caller's behalf after proving the caller is a program operator:
 *
 *   1. the body carries the exact fields that were signed, plus wallet + base64 signature;
 *   2. the message is rebuilt server-side from those fields — a tampered name or background
 *      changes the message and the signature stops verifying;
 *   3. the timestamp inside the message must be within MAX_AGE_SECONDS, which bounds replay;
 *   4. the wallet must equal GameConfig.authority or one of its active operators, read LIVE
 *      from the chain — the same account the on-chain program itself checks, so revoking an
 *      operator on-chain revokes them here with no redeploy.
 *
 * Deploy:  supabase functions deploy set-round-metadata
 * Env:     SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
 *          SOLANA_RPC_URL is optional (defaults to public devnet).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
// Pinned: v2 reshuffled these exports, and this is signature-verification code.
import { ed25519 } from "https://esm.sh/@noble/curves@1.9.7/ed25519";

/** Program 7eMfGCk… `[b"config"]` PDA. Constant because the program id and seed are constant. */
const CONFIG_PDA = "35pB3aMQWjh1v2SDQAYvN5aAuNCvkRcaduM27sgnkw17";

/** Anchor's 8-byte discriminator for GameConfig — proof we decoded the account we meant to. */
const GAME_CONFIG_DISCRIMINATOR = [45, 146, 146, 33, 170, 69, 96, 133];

/**
 * GameConfig layout after the discriminator: authority[32] paused[1] current_round[8]
 * starter_count[1] version[1] bump[1] operators[3 * 32] operator_count[1] = 149 bytes.
 */
const AUTHORITY_OFFSET = 8;
const OPERATORS_OFFSET = 52;
const OPERATOR_COUNT_OFFSET = 148;
const GAME_CONFIG_MIN_LEN = 149;

/** How long a signed message stays usable. Short enough to bound replay, long enough to
 *  cover a wallet approval prompt plus the open_round confirmation that precedes it. */
const MAX_AGE_SECONDS = 300;
/** Tolerance for a client clock running ahead of ours. */
const MAX_SKEW_SECONDS = 60;

const BACKGROUNDS = ["classic", "event"];
const NAME_MAX = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Minimal base58 decode — only ever fed a wallet address, so no library is warranted. */
function base58Decode(input: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of input) {
    const value = B58.indexOf(ch);
    if (value < 0) throw new Error("invalid base58 character");
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Every leading '1' is a leading zero byte.
  for (const ch of input) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

function base64Decode(input: string): Uint8Array {
  const binary = atob(input);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The exact string the operator wallet signs.
 * MUST stay in lockstep with roundMetadataMessage() in src/hooks/useRoundMetadata.ts.
 */
function roundMetadataMessage(
  roundNumber: number,
  name: string,
  background: string,
  timestamp: number,
): string {
  return `secret-garden:open-round:${roundNumber}:${background}:${name}:${timestamp}`;
}

/** GameConfig.authority + its active operators, as raw 32-byte keys read live from the chain. */
async function fetchAuthorizedWallets(): Promise<Uint8Array[]> {
  const rpcUrl = Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com";
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [CONFIG_PDA, { encoding: "base64", commitment: "confirmed" }],
    }),
  });
  if (!response.ok) throw new Error(`RPC ${response.status}`);

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? "RPC error");
  const encoded = payload.result?.value?.data?.[0];
  if (!encoded) throw new Error("GameConfig account not found");

  const data = base64Decode(encoded);
  if (data.length < GAME_CONFIG_MIN_LEN) throw new Error("GameConfig account too small");
  if (!sameBytes(data.subarray(0, 8), new Uint8Array(GAME_CONFIG_DISCRIMINATOR))) {
    throw new Error("not a GameConfig account");
  }

  const wallets = [data.subarray(AUTHORITY_OFFSET, AUTHORITY_OFFSET + 32)];
  const operatorCount = Math.min(data[OPERATOR_COUNT_OFFSET], 3);
  for (let i = 0; i < operatorCount; i++) {
    const start = OPERATORS_OFFSET + i * 32;
    wallets.push(data.subarray(start, start + 32));
  }
  return wallets;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const roundNumber = Number(body.round_number);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const background = String(body.background ?? "");
  const timestamp = Number(body.timestamp);
  const wallet = String(body.wallet ?? "");
  const signature = String(body.signature ?? "");

  // ---- shape ----
  if (!Number.isInteger(roundNumber) || roundNumber <= 0) {
    return json({ error: "round_number must be a positive integer" }, 400);
  }
  if (!BACKGROUNDS.includes(background)) return json({ error: "unknown background" }, 400);
  if (name.length > NAME_MAX) return json({ error: `name exceeds ${NAME_MAX} characters` }, 400);
  if (!Number.isFinite(timestamp)) return json({ error: "timestamp is required" }, 400);
  if (!wallet || !signature) return json({ error: "wallet and signature are required" }, 400);

  // ---- freshness (bounds replay of a captured signature) ----
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now + MAX_SKEW_SECONDS) return json({ error: "signature timestamp is in the future" }, 403);
  if (now - timestamp > MAX_AGE_SECONDS) return json({ error: "signature has expired" }, 403);

  // ---- signature over the message rebuilt from the fields we are about to store ----
  let walletKey: Uint8Array;
  let verified = false;
  try {
    walletKey = base58Decode(wallet);
    if (walletKey.length !== 32) throw new Error("wallet is not a 32-byte key");
    const message = new TextEncoder().encode(
      roundMetadataMessage(roundNumber, name, background, timestamp),
    );
    verified = ed25519.verify(base64Decode(signature), message, walletKey);
  } catch {
    return json({ error: "malformed wallet or signature" }, 400);
  }
  if (!verified) return json({ error: "signature does not match the request" }, 403);

  // ---- authority check against the live on-chain GameConfig ----
  let authorized: Uint8Array[];
  try {
    authorized = await fetchAuthorizedWallets();
  } catch (e) {
    // Cannot prove the caller is an operator → refuse rather than write. 503, not 403: the
    // caller may well be authorized, we just could not check right now.
    return json({ error: `could not read GameConfig: ${e instanceof Error ? e.message : e}` }, 503);
  }
  if (!authorized.some((key) => sameBytes(key, walletKey))) {
    return json({ error: "wallet is not a program operator" }, 403);
  }

  // ---- write (service role bypasses RLS; the table has no write policy by design) ----
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { error } = await admin
    .from("round_metadata")
    .upsert({ round_number: roundNumber, name: name || null, background }, { onConflict: "round_number" });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, round_number: roundNumber }, 200);
});
