/**
 * Bracket-reveal PLANNING — pure, chain-free logic.
 *
 * A round's top 3 cannot be revealed in one MPC call past 14 entries (Arcium rejects a
 * `queue_computation` whose arguments reference 15+ distinct accounts with error 6202), so
 * the program reveals a round as a bracket: shards of <= MAX_SHARD_SIZE, then a final reveal
 * over the shard winners, and for rounds past one tier's reach a whole extra tier below that.
 *
 * The partition is the client's job — the program only VERIFIES it (strictly ascending shard
 * bounds, sizes summing to participant_count, every supplied entry inside its shard's range).
 * That verification is why this module exists separately from the transaction code: it is the
 * part that must be exactly right, and it is testable without a wallet or an RPC.
 *
 * Everything here mirrors programs/secret-garden/src/constants.rs. Changing a constant here
 * without changing it there produces a partition the program rejects.
 */
import { PublicKey } from "@solana/web3.js";

/** Entries per shard. One under the measured 14-account reveal ceiling (constants.rs). */
export const MAX_SHARD_SIZE = 13;

/** Winners taken from each shard — what makes the bracket exact under a strict total order. */
export const SHARD_WINNERS = 3;

/** Shards in the single tier (also the semifinal tier of a two-tier round). */
export const MAX_SHARDS = 4;

/** Tier-1 shards in a two-tier bracket. */
export const MAX_TIER1_SHARDS = 17;

/** Largest round one tier can reveal: 4 * 13. Past this the two-tier path is REQUIRED —
 *  `init_tier1_bracket` refuses a round at or under it, and `init_bracket` cannot fit one above. */
export const SINGLE_TIER_CAPACITY = MAX_SHARDS * MAX_SHARD_SIZE; // 52

/** Largest round the two-tier bracket can reveal: 17 * 13. */
export const TWO_TIER_CAPACITY = MAX_TIER1_SHARDS * MAX_SHARD_SIZE; // 221

/** `shard_index` reserved for the FINAL reveal's result record (shares the shardres namespace). */
export const FINAL_SHARD_INDEX = 255;

/** Which shape of bracket a round needs. Decided purely by entry count. */
export type RevealTier = "single" | "two";

/**
 * Compare two entry addresses the way the PROGRAM does — as raw `[u8; 32]`, byte by byte.
 *
 * NOT `a.toBase58() < b.toBase58()`. Base58 drops leading zero bytes, so a key beginning
 * 0x00 renders as a 43-character string (vs the usual 44) that sorts LAST as text while
 * sorting FIRST as bytes. Anchor's `Pubkey: Ord` is the byte order, so a base58-text sort
 * silently produces a partition the program rejects with `ShardEntriesOutOfRange` (6037) —
 * and only for the ~1-in-256 rounds that happen to contain such a key, which is why it
 * reads as an intermittent failure rather than a bug. Devnet round 19's first tier-1
 * boundary, `FNXjYaR1fbL9ryaHvRA24WurBuUdTY9NBRogEz5gfqj`, is exactly one of these.
 */
export function compareEntryKeys(a: PublicKey, b: PublicKey): number {
  const x = a.toBytes();
  const y = b.toBytes();
  for (let i = 0; i < 32; i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

/** A copy of `keys` in the program's canonical ascending order. Does not mutate the input. */
export function sortEntriesByteWise(keys: PublicKey[]): PublicKey[] {
  return [...keys].sort(compareEntryKeys);
}

/**
 * Split `n` items into the fewest shards of at most `max`, balanced as evenly as possible —
 * the same arithmetic `promote_tier1` performs on-chain (`n.div_ceil(max)`, then `base =
 * n / count` with the first `n % count` shards taking one extra).
 *
 * Balanced rather than greedy-full matters: 53 entries become [11,11,11,10,10], not
 * [13,13,13,13,1]. A trailing 1-entry shard is legal but wasteful — it spends a whole MPC
 * call to rank a single flower.
 */
export function planShardSizes(n: number, max: number = MAX_SHARD_SIZE): number[] {
  if (n <= 0) return [];
  const count = Math.max(1, Math.ceil(n / max));
  const base = Math.floor(n / count);
  const extra = n % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** How many winners a tier-1 layout produces: every shard yields `min(3, size)` of them. */
export function expectedTier1Winners(sizes: number[]): number {
  return sizes.reduce((sum, s) => sum + Math.min(SHARD_WINNERS, s), 0);
}

/** One shard of the plan: its entries in canonical order, plus the bound the program pins. */
export interface ShardPlan {
  /** The shard's entry addresses, ascending by raw pubkey bytes. */
  entries: PublicKey[];
  /** The shard's FIRST entry — recorded on-chain as `shard_bounds[k]`. */
  bound: PublicKey;
}

/** The full client-side plan for revealing one round. */
export interface BracketPlan {
  tier: RevealTier;
  entryCount: number;
  /** Tier-1 shards for a two-tier round; the only tier of shards otherwise. */
  shards: ShardPlan[];
  /** `shards.map(s => s.entries.length)`, the `shard_sizes` argument. */
  sizes: number[];
  /**
   * False only for a single-shard round: that shard's ranking IS the round's ranking, so the
   * final reveal is skipped and `apply_bracket_result(0)` reads the shard winners directly.
   */
  finalReveal: boolean;
  /**
   * Semifinal sizes a two-tier round is expected to promote into — derived here exactly as
   * `promote_tier1` derives them on-chain, so the UI can quote a signature count up front.
   * The authoritative sizes are whatever `promote_tier1` actually writes into BracketState.
   */
  semifinalSizes: number[];
}

/** Thrown when a round cannot be revealed by any bracket shape (too many entries). */
export class BracketPlanError extends Error {}

/**
 * Partition a round's entries into the bracket the program will accept.
 *
 * `entries` may arrive in any order — it is sorted here, so callers cannot forget to. The
 * count alone selects the shape: <= 13 is one shard (one MPC call, no final), <= 52 is a
 * single tier of shards plus a final, and above that a tier of up to 17 shards whose winners
 * are promoted into the ordinary single-tier bracket as semifinals.
 */
export function planBracket(entries: PublicKey[]): BracketPlan {
  const sorted = sortEntriesByteWise(entries);
  const n = sorted.length;
  if (n === 0) throw new BracketPlanError("this round has no entries to reveal");
  if (n > TWO_TIER_CAPACITY) {
    throw new BracketPlanError(
      `${n} entries is past the bracket's ${TWO_TIER_CAPACITY}-entry ceiling`,
    );
  }

  const tier: RevealTier = n > SINGLE_TIER_CAPACITY ? "two" : "single";
  const sizes = planShardSizes(n, MAX_SHARD_SIZE);
  const limit = tier === "two" ? MAX_TIER1_SHARDS : MAX_SHARDS;
  if (sizes.length > limit) {
    // Unreachable given the ceiling above; kept so a constant edited out of step with the
    // program breaks here rather than as a rejected transaction.
    throw new BracketPlanError(`${n} entries needs ${sizes.length} shards, past the ${limit} allowed`);
  }

  const shards: ShardPlan[] = [];
  let cursor = 0;
  for (const size of sizes) {
    const chunk = sorted.slice(cursor, cursor + size);
    shards.push({ entries: chunk, bound: chunk[0] });
    cursor += size;
  }

  return {
    tier,
    entryCount: n,
    shards,
    sizes,
    // A two-tier round always ends in a final reveal; a single tier skips it only when the
    // whole round fitted in one shard.
    finalReveal: tier === "two" || shards.length > 1,
    semifinalSizes:
      tier === "two" ? planShardSizes(expectedTier1Winners(sizes), MAX_SHARD_SIZE) : [],
  };
}

/**
 * Wallet approvals a full from-scratch run of `plan` needs. Every on-chain step is one
 * signature; the MPC waits in between are free. Quoted to the operator before they start,
 * because "17 shards" means 17 popups and that should not be a surprise.
 */
export function signatureCount(plan: BracketPlan): number {
  const shards = plan.shards.length;
  if (plan.tier === "single") {
    // init_bracket + (queue + collect) per shard + optional final queue + apply
    return 1 + 2 * shards + (plan.finalReveal ? 1 : 0) + 1;
  }
  // init_tier1 + (queue + collect) per tier-1 shard + promote
  //            + (queue + collect) per semifinal + final queue + apply
  return 1 + 2 * shards + 1 + 2 * plan.semifinalSizes.length + 1 + 1;
}

/** One-line human summary of the plan, for the operator panel. */
export function describePlan(plan: BracketPlan): string {
  const sizes = `[${plan.sizes.join(", ")}]`;
  if (plan.tier === "single") {
    return plan.shards.length === 1
      ? `${plan.entryCount} entries fit one shard ${sizes} — a single reveal, no final round.`
      : `${plan.entryCount} entries → ${plan.shards.length} shards ${sizes} → final reveal.`;
  }
  return (
    `${plan.entryCount} entries → ${plan.shards.length} tier-1 shards ${sizes}` +
    ` → ${plan.semifinalSizes.length} semifinals [${plan.semifinalSizes.join(", ")}] → final reveal.`
  );
}
