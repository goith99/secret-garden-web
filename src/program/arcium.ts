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
 * `circuit` selects the comp-def: "breed" (start_breeding), "score_entry_v2"
 * (queue_score_entry), "private_hint" (queue_private_hint) or "reveal_top3_v3" (every
 * bracket reveal — shard, tier-1 shard, semifinal and final all reuse that one circuit,
 * which is why the bracket added no new comp-def rent).
 *
 * NOTE the "_v2" on scoring: the circuit was renamed when the synergy-multiplier formula
 * shipped, because its comp def had to be re-registered at a fresh offset (the old one
 * cannot be closed while foreign expired computations occupy shared cluster 456's execpool).
 */
export function arciumAccountsFor(circuit: string, computationOffset: BN) {
  return {
    computationAccount: getComputationAccAddress(ARCIUM_CLUSTER_OFFSET, computationOffset),
    clusterAccount: getClusterAccAddress(ARCIUM_CLUSTER_OFFSET),
    mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    compDefAccount: getCompDefAccAddress(PROGRAM_ID, u32FromLE(getCompDefAccOffset(circuit))),
  };
}
