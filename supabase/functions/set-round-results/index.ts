/**
 * set-round-results — the ONLY writer of public.round_results and public.round_winners.
 *
 * Sibling of set-round-metadata, with one decisive difference. Metadata is cosmetic, so
 * signing over the payload is enough: the worst a bad payload does is name a round oddly.
 * These tables are the game's PUBLISHED RESULT, so a signed-but-false payload from a leaked
 * operator key would be a lie about who won. Therefore:
 *
 *   THE REQUEST BODY CARRIES NO DATA. Only a round number, a timestamp, a wallet and a
 *   signature. Every value written is re-derived from the chain.
 *
 * The chain of custody:
 *
 *   1. the signature covers "secret-garden:set-round-results:<round>:<ts>", rebuilt here;
 *   2. the timestamp inside that message must be within MAX_AGE_SECONDS, bounding replay;
 *   3. the wallet must equal GameConfig.authority or one of its active operators, read LIVE
 *      from the chain — the same account the on-chain program checks, so revoking an
 *      operator on-chain revokes them here with no redeploy;
 *   4. the round account is DERIVED from the signed round number (`[b"round", round_id_le]`),
 *      never supplied by the caller, and its own `round_id` must match;
 *   5. every fetched account must be OWNED BY THE PROGRAM. set-round-metadata can skip this
 *      because its one account is a constant PDA; here the entry/flower addresses come from
 *      account data, so ownership is what makes the discriminator meaningful — any program
 *      can write eight bytes that look like Anchor's;
 *   6. the round must already be `scoring_revealed` on-chain. Until then there is no result.
 *
 * Deploy:  supabase functions deploy set-round-results
 * Env:     SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
 *          SOLANA_RPC_URL is optional (defaults to public devnet).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
// Pinned to match set-round-metadata: v2 reshuffled these exports, and this is
// signature-verification code.
import { ed25519 } from "https://esm.sh/@noble/curves@1.9.7/ed25519";
import { sha256 } from "https://esm.sh/@noble/hashes@1.8.0/sha256";

/** The deployed program. Every account read here must be owned by it. */
const PROGRAM_ID = "7eMfGCkXavfZeVrwRo3ZH63C7H6mZ6n1HZKJwGkZBddo";

/** Program 7eMfGCk… `[b"config"]` PDA. Constant because the program id and seed are constant.
 *  Same value set-round-metadata already pins; re-derived from [b"config"] to confirm. */
const CONFIG_PDA = "35pB3aMQWjh1v2SDQAYvN5aAuNCvkRcaduM27sgnkw17";

/** Anchor 8-byte account discriminators — proof we decoded the account we meant to. */
const GAME_CONFIG_DISCRIMINATOR = [45, 146, 146, 33, 170, 69, 96, 133];
const COMPETITION_ROUND_DISCRIMINATOR = [236, 99, 59, 254, 35, 143, 142, 20];
const COMPETITION_ENTRY_DISCRIMINATOR = [56, 249, 157, 19, 217, 29, 102, 199];
const FLOWER_RECORD_DISCRIMINATOR = [161, 2, 180, 142, 45, 204, 60, 240];

/**
 * GameConfig layout after the discriminator: authority[32] paused[1] current_round[8]
 * starter_count[1] version[1] bump[1] operators[3 * 32] operator_count[1] = 149 bytes.
 */
const AUTHORITY_OFFSET = 8;
const OPERATORS_OFFSET = 52;
const OPERATOR_COUNT_OFFSET = 148;
const GAME_CONFIG_MIN_LEN = 149;

/**
 * CompetitionRound layout (borsh, no padding): disc[8] round_id[8] status[1] start_time[8]
 * end_time[8] max_participants[2] participant_count[2] authority[32] bump[1] target_traits[4]
 * target_trait_count[1] top1[32] top2[32] top3[32] scoring_revealed[1] scored_count[2] = 174.
 */
const ROUND_ID_OFFSET = 8;
const ROUND_PARTICIPANT_COUNT_OFFSET = 35;
const ROUND_TARGET_TRAITS_OFFSET = 70;
const ROUND_TARGET_TRAIT_COUNT_OFFSET = 74;
const ROUND_TOP1_OFFSET = 75;
const ROUND_SCORING_REVEALED_OFFSET = 171;
const ROUND_MIN_LEN = 174;

/** CompetitionEntry: disc[8] round[32] player[32] flower_record[32] … (score fields at 114). */
const ENTRY_PLAYER_OFFSET = 40;
const ENTRY_FLOWER_RECORD_OFFSET = 72;
const ENTRY_MIN_LEN = 104; // enough to read player + flower_record

/** FlowerRecord: disc[8] owner[32] flower_index[4] visual_species_id[1] generation[2] … */
const FLOWER_INDEX_OFFSET = 40;
const FLOWER_VISUAL_SPECIES_OFFSET = 44;
const FLOWER_GENERATION_OFFSET = 45;
const FLOWER_MIN_LEN = 47; // enough to read flower_index + species + generation

/** How long a signed message stays usable. Matches set-round-metadata. */
const MAX_AGE_SECONDS = 300;
/** Tolerance for a client clock running ahead of ours. */
const MAX_SKEW_SECONDS = 60;

/** The all-zero pubkey. top2/top3 hold this when a round had fewer than 3 entrants. */
const DEFAULT_PUBKEY = "11111111111111111111111111111111";

/** Player-facing flower names — mirrors the frontend species map and operator.ts. */
const SPECIES_NAMES = [
  "Sunpetal Marigold",
  "Tideglass Bluebell",
  "Duskwisp Lavender",
  "Emberfern Rose",
  "Mossheart Mint",
  "Moonsilk Lily",
];

/**
 * Shown when a winner's FlowerRecord no longer exists. Owners may close a flower after the
 * round (reclaiming its rent), which deletes the only source of its species and generation —
 * observed on 2 of 47 winner slots on devnet. The wallet and rank are still fully known, and
 * those are what the podium is actually about, so the winner is recorded rather than dropped.
 */
const CLOSED_FLOWER_NAME = "Retired Bloom";

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

/** Minimal base58 decode — only ever fed wallet/program addresses, so no library is warranted. */
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

/**
 * Minimal base58 encode. Leading zero BYTES become leading '1' characters and are excluded
 * from the numeric conversion — otherwise the all-zero key (which is exactly what top2/top3
 * hold when a round had fewer than 3 entrants) encodes to 33 characters instead of 32 and
 * never matches DEFAULT_PUBKEY.
 */
function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
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

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Little-endian u64, the seed encoding `open_round` uses for the round PDA. */
function u64le(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
}

const readU16LE = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8);
const readU32LE = (d: Uint8Array, o: number) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
const readU64LE = (d: Uint8Array, o: number) =>
  new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(o, true);
const readPubkey = (d: Uint8Array, o: number) => base58Encode(d.subarray(o, o + 32));

const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");

/** A 32-byte value is a valid PDA only if it is NOT a point on the ed25519 curve. */
function isOnCurve(bytes: Uint8Array): boolean {
  try {
    ed25519.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Solana's findProgramAddress. Used to derive the round account from the SIGNED round number,
 * so no account address is ever taken from the request body.
 */
function findProgramAddress(seeds: Uint8Array[], programId: Uint8Array): string {
  for (let bump = 255; bump >= 0; bump--) {
    const hash = sha256(concatBytes([...seeds, Uint8Array.from([bump]), programId, PDA_MARKER]));
    if (!isOnCurve(hash)) return base58Encode(hash);
  }
  throw new Error("no off-curve bump found");
}

/** The exact string the operator wallet signs.
 *  MUST stay in lockstep with roundResultsMessage() in src/hooks/useRoundHistory.ts. */
function roundResultsMessage(roundNumber: number, timestamp: number): string {
  return `secret-garden:set-round-results:${roundNumber}:${timestamp}`;
}

// ---------------------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------------------

const rpcUrl = () => Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com";

/**
 * The requested round genuinely does not exist: the RPC ANSWERED, and its answer was "no
 * account at that address". Retrying can never help, so this becomes a 404.
 */
class AccountNotFoundError extends Error {}

/**
 * The round exists but cannot be published as it stands (not revealed yet, no entries, no
 * winners recorded). Retrying will not help either, but the resource is real — a 409.
 */
class RoundStateError extends Error {}

/**
 * Every OTHER failure — a network error, a non-2xx, a JSON-RPC error object, a malformed
 * response — means we could not learn the chain's state, not that the state is bad. Those
 * propagate as ordinary Errors and become a 503, where retrying is the right advice.
 *
 * That is the whole distinction: `rpc()` THROWS when the node failed to answer, and RETURNS
 * when it answered. A returned `value` of null is therefore a definitive absence, and is the
 * only thing this module treats as "not found".
 */
async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? "RPC error");
  return payload.result;
}

interface FetchedAccount {
  owner: string;
  data: Uint8Array;
}

/**
 * `null` ONLY for a clean "this address holds no account" — that is what getAccountInfo and
 * getMultipleAccounts return for an address that has never been used. A present-but-unreadable
 * account is a different thing entirely and throws, so it cannot be mistaken for absence.
 */
function decodeAccount(value: any): FetchedAccount | null {
  if (value === null || value === undefined) return null;
  if (!value.data?.[0]) throw new Error("account present but its data could not be read");
  return { owner: value.owner, data: base64Decode(value.data[0]) };
}

async function getAccount(pubkey: string): Promise<FetchedAccount | null> {
  const result = await rpc("getAccountInfo", [pubkey, { encoding: "base64", commitment: "confirmed" }]);
  // A well-formed reply always carries `value`, even when that value is null. Its absence
  // means the node answered with something we do not understand — not that the account is
  // missing — so it must not be reported as "not found".
  if (!result || !("value" in result)) throw new Error("malformed getAccountInfo response");
  return decodeAccount(result.value);
}

async function getAccounts(pubkeys: string[]): Promise<(FetchedAccount | null)[]> {
  if (pubkeys.length === 0) return [];
  const result = await rpc("getMultipleAccounts", [pubkeys, { encoding: "base64", commitment: "confirmed" }]);
  if (!result || !Array.isArray(result.value)) throw new Error("malformed getMultipleAccounts response");
  if (result.value.length !== pubkeys.length) throw new Error("getMultipleAccounts returned the wrong count");
  return result.value.map(decodeAccount);
}

/**
 * Assert an account is the program's and carries the expected Anchor discriminator.
 * Ownership is the load-bearing half: any program can write a matching discriminator.
 */
function assertProgramAccount(
  account: FetchedAccount | null,
  discriminator: number[],
  minLen: number,
  label: string,
): Uint8Array {
  if (!account) throw new AccountNotFoundError(`${label} account not found`);
  if (account.owner !== PROGRAM_ID) throw new Error(`${label} is not owned by the program`);
  if (account.data.length < minLen) throw new Error(`${label} account too small`);
  if (!sameBytes(account.data.subarray(0, 8), new Uint8Array(discriminator))) {
    throw new Error(`${label} has the wrong account discriminator`);
  }
  return account.data;
}

/** GameConfig.authority + its active operators, as raw 32-byte keys read live from the chain. */
async function fetchAuthorizedWallets(): Promise<Uint8Array[]> {
  const account = await getAccount(CONFIG_PDA);
  const data = assertProgramAccount(account, GAME_CONFIG_DISCRIMINATOR, GAME_CONFIG_MIN_LEN, "GameConfig");

  const wallets = [data.subarray(AUTHORITY_OFFSET, AUTHORITY_OFFSET + 32)];
  const operatorCount = Math.min(data[OPERATOR_COUNT_OFFSET], 3);
  for (let i = 0; i < operatorCount; i++) {
    const start = OPERATORS_OFFSET + i * 32;
    wallets.push(data.subarray(start, start + 32));
  }
  return wallets;
}

interface WinnerRow {
  round_number: number;
  rank: number;
  wallet_address: string;
  flower_name: string;
  generation: number;
}

interface DerivedResults {
  targetTraits: number[];
  totalEntrants: number;
  winners: WinnerRow[];
}

/**
 * Read the round and its podium straight from the chain. `roundNumber` is the SIGNED value;
 * the round account is derived from it, so nothing here originates with the caller.
 */
async function deriveResultsFromChain(roundNumber: number): Promise<DerivedResults> {
  const programId = base58Decode(PROGRAM_ID);
  const roundPda = findProgramAddress(
    [new TextEncoder().encode("round"), u64le(roundNumber)],
    programId,
  );

  const roundAccount = await getAccount(roundPda);
  if (!roundAccount) {
    // The RPC answered and there is nothing at the round's derived address. The round never
    // existed; no amount of retrying will conjure it.
    throw new AccountNotFoundError(`round ${roundNumber} does not exist on-chain`);
  }
  const round = assertProgramAccount(
    roundAccount,
    COMPETITION_ROUND_DISCRIMINATOR,
    ROUND_MIN_LEN,
    "CompetitionRound",
  );

  // The account derived from the signed number must also SAY it is that round. Belt and
  // braces against a seed-encoding mistake here silently pointing at the wrong round.
  const onChainRoundId = readU64LE(round, ROUND_ID_OFFSET);
  if (onChainRoundId !== BigInt(roundNumber)) {
    throw new RoundStateError(`round account holds round_id ${onChainRoundId}, expected ${roundNumber}`);
  }
  if (round[ROUND_SCORING_REVEALED_OFFSET] !== 1) {
    throw new RoundStateError("this round's winners are not revealed on-chain yet");
  }

  const totalEntrants = readU16LE(round, ROUND_PARTICIPANT_COUNT_OFFSET);
  if (totalEntrants === 0) throw new RoundStateError("this round had no entries");

  const traitCount = Math.min(round[ROUND_TARGET_TRAIT_COUNT_OFFSET], 4);
  const targetTraits = Array.from(
    round.subarray(ROUND_TARGET_TRAITS_OFFSET, ROUND_TARGET_TRAITS_OFFSET + traitCount),
  );

  // top1/top2/top3 sit 32 bytes apart. A round with fewer than 3 entrants leaves the unused
  // slots at the default pubkey — those are skipped, so ranks may stop short of 3.
  const topKeys: { rank: number; pubkey: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const pubkey = readPubkey(round, ROUND_TOP1_OFFSET + i * 32);
    if (pubkey !== DEFAULT_PUBKEY) topKeys.push({ rank: i + 1, pubkey });
  }
  if (topKeys.length === 0) throw new RoundStateError("this round has no winners recorded on-chain");

  // Two batched round-trips rather than six: entries, then their flowers.
  const entryAccounts = await getAccounts(topKeys.map((t) => t.pubkey));
  const entries = entryAccounts.map((account, i) => {
    // A winner's entry account going missing is a state problem with a round that DOES exist,
    // not a missing round — so it is a 409, not the 404 the round itself would raise.
    if (!account) {
      throw new RoundStateError(
        `the entry account for rank ${topKeys[i].rank} no longer exists, so this round cannot be published`,
      );
    }
    return assertProgramAccount(
      account,
      COMPETITION_ENTRY_DISCRIMINATOR,
      ENTRY_MIN_LEN,
      `CompetitionEntry for rank ${topKeys[i].rank}`,
    );
  });

  const flowerPubkeys = entries.map((e) => readPubkey(e, ENTRY_FLOWER_RECORD_OFFSET));
  const flowerAccounts = await getAccounts(flowerPubkeys);

  const winners: WinnerRow[] = topKeys.map((top, i) => {
    const walletAddress = readPubkey(entries[i], ENTRY_PLAYER_OFFSET);
    const flower = flowerAccounts[i];

    // A closed flower is expected, not an error — see CLOSED_FLOWER_NAME. Anything else about
    // the account being wrong (foreign owner, bad discriminator) still throws.
    if (!flower) {
      return {
        round_number: roundNumber,
        rank: top.rank,
        wallet_address: walletAddress,
        flower_name: CLOSED_FLOWER_NAME,
        generation: 0,
      };
    }
    const data = assertProgramAccount(
      flower,
      FLOWER_RECORD_DISCRIMINATOR,
      FLOWER_MIN_LEN,
      `FlowerRecord for rank ${top.rank}`,
    );
    const speciesId = data[FLOWER_VISUAL_SPECIES_OFFSET];
    const flowerIndex = readU32LE(data, FLOWER_INDEX_OFFSET);
    const flowerName =
      speciesId === 255
        ? `Hybrid #${flowerIndex}`
        : (SPECIES_NAMES[speciesId] ?? `Flower #${flowerIndex}`);

    return {
      round_number: roundNumber,
      rank: top.rank,
      wallet_address: walletAddress,
      flower_name: flowerName,
      generation: readU16LE(data, FLOWER_GENERATION_OFFSET),
    };
  });

  return { targetTraits, totalEntrants, winners };
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
  const timestamp = Number(body.timestamp);
  const wallet = String(body.wallet ?? "");
  const signature = String(body.signature ?? "");

  // ---- shape ----
  if (!Number.isInteger(roundNumber) || roundNumber <= 0) {
    return json({ error: "round_number must be a positive integer" }, 400);
  }
  if (!Number.isFinite(timestamp)) return json({ error: "timestamp is required" }, 400);
  if (!wallet || !signature) return json({ error: "wallet and signature are required" }, 400);

  // ---- freshness (bounds replay of a captured signature) ----
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now + MAX_SKEW_SECONDS) return json({ error: "signature timestamp is in the future" }, 403);
  if (now - timestamp > MAX_AGE_SECONDS) return json({ error: "signature has expired" }, 403);

  // ---- signature over the message rebuilt from the round we are about to publish ----
  let walletKey: Uint8Array;
  let verified = false;
  try {
    walletKey = base58Decode(wallet);
    if (walletKey.length !== 32) throw new Error("wallet is not a 32-byte key");
    const message = new TextEncoder().encode(roundResultsMessage(roundNumber, timestamp));
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ---- idempotency: a published round is never rewritten ----
  // Checked before the chain reads so a repeat call costs one cheap query. The insert below
  // is still the real guard (it races safely on the primary key); this is the friendly path.
  const existing = await admin
    .from("round_results")
    .select("round_number")
    .eq("round_number", roundNumber)
    .maybeSingle();
  if (existing.error) return json({ error: existing.error.message }, 500);
  if (existing.data) {
    return json({ error: `round ${roundNumber} results are already published`, already_published: true }, 409);
  }

  // ---- re-derive every stored value from the chain ----
  let derived: DerivedResults;
  try {
    derived = await deriveResultsFromChain(roundNumber);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Typed rather than pattern-matched on the message: the three cases mean genuinely
    // different things to a caller deciding whether to retry.
    //   404 — the RPC answered, the round is not there. Retrying never helps.
    //   409 — the round is real but not publishable as it stands. Retrying never helps.
    //   503 — we could not read the chain at all. Retrying is exactly right.
    if (e instanceof AccountNotFoundError) return json({ error: message }, 404);
    if (e instanceof RoundStateError) return json({ error: message }, 409);
    return json({ error: message }, 503);
  }

  // ---- write (service role bypasses RLS; the tables have no write policy by design) ----
  const resultsInsert = await admin.from("round_results").insert({
    round_number: roundNumber,
    target_traits: JSON.stringify(derived.targetTraits),
    total_entrants: derived.totalEntrants,
    completed_at: new Date().toISOString(),
  });
  if (resultsInsert.error) {
    // 23505 = unique_violation: another call won the race between the check above and here.
    const status = resultsInsert.error.code === "23505" ? 409 : 500;
    return json({ error: resultsInsert.error.message }, status);
  }

  const winnersInsert = await admin.from("round_winners").insert(derived.winners);
  if (winnersInsert.error) {
    // Compensate: a summary row with no podium would render as a round with no winners.
    // The round stays unpublished and the operator can retry cleanly.
    await admin.from("round_results").delete().eq("round_number", roundNumber);
    return json({ error: winnersInsert.error.message }, 500);
  }

  return json(
    {
      ok: true,
      round_number: roundNumber,
      total_entrants: derived.totalEntrants,
      target_traits: derived.targetTraits,
      winners: derived.winners.map((w) => ({
        rank: w.rank,
        wallet_address: w.wallet_address,
        flower_name: w.flower_name,
        generation: w.generation,
      })),
    },
    200,
  );
});
