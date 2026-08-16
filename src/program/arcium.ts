/**
 * The Arcium account set every queued computation needs.
 *
 * Lives in its own module because BOTH the player/operator transactions (transactions.ts)
 * and the bracket-reveal orchestration (reveal.ts) build queue instructions, and importing
 * it from one into the other would make the two files circular.
 */
import type { BN } from "@anchor-lang/core";
import {
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getClusterAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
} from "@arcium-hq/client";
import { PROGRAM_ID } from "./accounts";

/** Arcium cluster the circuits are deployed + finalized on (devnet). Constant, not read from
 *  env (getArciumEnv() is node-only); see tests/breeding.devnet.ts header (cluster 456). */
export const ARCIUM_CLUSTER_OFFSET = 456;

/** Read the first 4 little-endian bytes of a comp-def offset as a u32 (no Buffer). */
function u32FromLE(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}

/**
 * THE LIVE CIRCUIT NAMES — the single source of truth for this frontend.
 *
 * A comp-def account address is `sha256(circuit_name)[0..4]`. The Anchor instruction that
 * consumes it (`start_breeding`, `queue_score_entry`, `queue_shard_reveal`, …) keeps its own
 * name and discriminator across a circuit rename, and THE IDL DOES NOT CARRY CIRCUIT NAMES
 * AT ALL. So a stale name here type-checks, builds, passes every local test, and fails only
 * on-chain as ConstraintAddress (2012) on `comp_def_account`.
 *
 * That exact bug shipped three times on the dev deployment before this guard existed
 * (`breed` -> `breed_v2` -> `breed_v3`, and `reveal_top3_v3` -> `reveal_top3_v5`). Hence the
 * union type below: every call site is typed against it, so a superseded name is now a
 * COMPILE ERROR. Renaming a circuit means changing it HERE, once, and `tsc` finds the rest.
 *
 * WHY NOT VERIFY AGAINST THE CHAIN INSTEAD. A runtime "does this comp-def exist and is it
 * finalized" preflight looks appealing but would NOT have caught any of them: on shared
 * cluster 456 a superseded comp-def can never be closed (the on-chain close requires an EMPTY
 * execpool, and another MXE's expired computations have squatted it since 2026-08-02), so the
 * old registrations are ALL still present and finalized. Existence proves nothing. Nor does
 * the argument signature — `breed_v2` and `breed_v3` take identical arguments; the rename was
 * for the boundary math. Without the program's own `comp_def_offset(..)` constant, which is
 * exported nowhere, the client cannot tell them apart at runtime. Compile time is the only
 * place this is decidable, so that is where the guard lives.
 *
 * Keep in step with `comp_def_offset(..)` in the program's `lib.rs`. `npm run check:circuits`
 * diffs the two and fails if they drift.
 */
export const CIRCUITS = {
  /** start_breeding. `_v3`: rarity roll + rebalanced lift curve (production goes straight
   *  from the original `breed` to `_v3`, skipping `_v2` entirely). */
  breed: "breed_v3",
  /** queue_score_entry (lives in scoring.ts here, not transactions.ts). `_v2`: the
   *  synergy-multiplier scoring formula. */
  scoreEntry: "score_entry_v2",
  /** queue_private_hint. Never renamed. */
  privateHint: "private_hint",
  /** Every bracket reveal — shard, tier-1 shard, semifinal and final all reuse this one
   *  circuit, which is why the bracket added no new comp-def rent. `_v5`: rarity tiebreak
   *  (was `_v3`; `_v4` is a rejected Bitonic candidate and must not be reused). */
  revealTop3: "reveal_top3_v5",
} as const;

/** The only circuit names this frontend may reference. Anything else fails `tsc`. */
export type CircuitName = (typeof CIRCUITS)[keyof typeof CIRCUITS];

/**
 * Build the Arcium account set for a queued computation.
 *
 * `circuit` is the CIRCUIT name (see CIRCUITS above), not the Anchor instruction name.
 */
export function arciumAccountsFor(circuit: CircuitName, computationOffset: BN) {
  return {
    computationAccount: getComputationAccAddress(ARCIUM_CLUSTER_OFFSET, computationOffset),
    clusterAccount: getClusterAccAddress(ARCIUM_CLUSTER_OFFSET),
    mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    compDefAccount: getCompDefAccAddress(PROGRAM_ID, u32FromLE(getCompDefAccOffset(circuit))),
  };
}
