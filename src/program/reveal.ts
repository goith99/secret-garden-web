/**
 * Bracket-reveal ORCHESTRATION — the whole reveal sequence, driven from one operator click.
 *
 * The reveal is no longer a single instruction. `queue_reveal_top3` is retired from the
 * operational flow: it is rejected by Arcium past 14 entries (error 6202), which made a full
 * round permanently unrevealable. Every round now goes through the bracket instead, and the
 * shape depends only on how many entries there are:
 *
 *   <= 13   one shard. The shard's ranking IS the round's ranking, so the final reveal is
 *           skipped and apply_bracket_result(0) reads the shard winners directly. 1 MPC call.
 *   14..52  a single tier of shards + a final reveal over their winners.
 *   53..221 a tier-1 of up to 17 shards, whose winners are promoted into the ordinary
 *           single-tier bracket as semifinals, then the same final + apply.
 *
 * WHY IT IS ORCHESTRATED HERE AND NOT STEP-BY-STEP IN THE UI: the sequence is long (a 53-entry
 * round is 16 signatures across 8 MPC calls) but it is entirely mechanical — every step's input
 * is the previous step's on-chain output. Asking an operator to drive it by hand is how a round
 * gets left half-revealed. So one button runs the lot, and the only thing the operator does is
 * approve each transaction.
 *
 * RESUMABILITY. Every step is recorded on-chain — BracketState.shards_collected /
 * final_queued / applied, Tier1State.shard_done / promoted, and the per-shard result PDAs'
 * `ready` flag — so a run that is interrupted (closed tab, declined popup, dead RPC) is
 * resumed by simply re-deriving what is already done and skipping it. Nothing is kept in
 * browser storage; the chain is the only progress record.
 *
 * PACING. Shard reveals are queued back-to-back with no gap between them. Measured on devnet
 * cluster 456 (scripts/mempool-rate-probe.mjs in the backend repo): 20 reveal-weight
 * computations fired as fast as the RPC accepted them were all accepted, no
 * MaxParallelismReached (6103) and no HeapFull (6602). So the operator signs straight through
 * and the MPC calls run concurrently, instead of waiting ~40s per shard in series.
 */
import { BN } from "@anchor-lang/core";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import type { SecretGardenProgram } from "./client";
import { TxError } from "./errors";
import { arciumAccountsFor, CIRCUITS } from "./arcium";
import { supabase } from "../lib/supabase";
import { saveRoundResults } from "../hooks/useRoundHistory";
import {
  bracketPda,
  configPda,
  roundPda,
  semiResultPda,
  shardResultPda,
  tier1Pda,
} from "./accounts";
import {
  FINAL_SHARD_INDEX,
  MAX_SHARDS,
  MAX_TIER1_SHARDS,
  TWO_TIER_CAPACITY,
  BracketPlanError,
  compareEntryKeys,
  describePlan,
  planBracket,
  signatureCount,
  sortEntriesByteWise,
  type BracketPlan,
  type RevealTier,
} from "./bracket";

const ROUND_STATUS_CLOSED = 1;
const ROUND_STATUS_FINALIZED = 2;

/** How often a pending reveal result is re-read. */
const RESULT_POLL_MS = 3_000;

/** How long a batch of queued reveals may take before the run gives up. Cluster 456 lands a
 *  reveal in well under a minute; this is a stuck-not-slow threshold, not a typical wait. */
const RESULT_TIMEOUT_MS = 420_000;

/**
 * On RESUME, how long to let a result that is already queued-but-not-ready land before
 * assuming its computation is dead and re-queueing it.
 *
 * A result PDA that exists with `ready = false` is genuinely ambiguous: it is either an MPC
 * call still in flight (the operator reopened the panel seconds after closing it) or the
 * wreckage of one that never came back (the callback failed verification, which leaves
 * `ready` false forever). Waiting forever hangs on the second case; re-queueing immediately
 * wastes an MPC call and a signature on the first. A bounded grace beats both.
 */
const RESUME_GRACE_MS = 90_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Explicit compute ceiling for a reveal queue, replacing an implicit default that is too close
 * for comfort.
 *
 * Solana grants 200,000 CU per instruction when a transaction carries no ComputeBudget
 * instruction, and every reveal queue below is a single-instruction transaction — so they have
 * all been running against a 200,000 ceiling. A 13-entry `queue_shard_reveal` was measured at
 * 158,914 CU on devnet (5 samples, 146k-159k). That is 20% headroom on a path where running
 * out means a failed approval mid-reveal, and it shrinks as MAX_SHARD_SIZE-worth of entry
 * accounts get more expensive to load.
 *
 * 250,000 restores a ~57% margin over the measured worst case. It costs ~40 bytes (the
 * ComputeBudget program key plus the instruction), which these transactions can afford: the
 * largest of them, a 13-entry shard queue, goes from 1111 to 1151 bytes against the 1232-byte
 * limit. (The scoring batches in ./scoring deliberately do NOT carry one — there the same 40
 * bytes is exactly what does not fit.)
 *
 * Requesting a limit does not spend it: unused CU is not charged, and no compute-unit PRICE is
 * set anywhere in this app, so there is no priority fee to inflate.
 */
export const REVEAL_CU_LIMIT = 250_000;

/** `tx` with an explicit compute-unit ceiling prepended. Does not mutate the input.
 *  Exported so scripts/verify-score-batching.mjs can size the REAL transaction. */
export function withComputeUnitLimit(tx: Transaction, units: number): Transaction {
  const out = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units }));
  tx.instructions.forEach((ix) => out.add(ix));
  return out;
}

/** Crypto-strong random bytes in the browser (no node `crypto`). */
function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** A fresh 64-bit Arcium computation offset. */
const freshOffset = () => new BN(Array.from(randomBytes(8)));

/** Everything the sequence needs from the calling hook: a program, the signing authority,
 *  and the same send-and-confirm choke point the rest of the operator surface uses. */
export interface RevealContext {
  program: SecretGardenProgram;
  authority: PublicKey;
  submit: (tx: Transaction) => Promise<string>;
  /**
   * Signs a UTF-8 message, resolving to a base64 signature — used once at the end of the
   * sequence to authorise the Supabase results mirror. Null when the wallet cannot sign
   * messages, which costs the mirror and nothing else.
   */
  signMessage?: ((message: string) => Promise<string>) | null;
}

/** One tick of the progress indicator. `step` counts SIGNATURES already confirmed. */
export interface RevealProgress {
  step: number;
  totalSteps: number;
  /** What is happening right now, e.g. "Revealing shard 2 of 5…". */
  label: string;
}

export type ProgressFn = (progress: RevealProgress) => void;

/** What `inspectReveal` found on-chain — drives the panel's summary and resume prompt. */
export interface RevealStatus {
  roundId: number;
  entryCount: number;
  tier: RevealTier;
  /** Shard sizes of the first tier (tier-1 shards for a two-tier round). */
  sizes: number[];
  /** Expected semifinal sizes; empty for a single-tier round. */
  semifinalSizes: number[];
  /** One-line plan description for the operator. */
  summary: string;
  /** True when this round's winners are already on-chain — nothing left to do. */
  revealed: boolean;
  /** True when part of the sequence has already run and pressing the button resumes it. */
  inProgress: boolean;
  /** Plain-English lines describing what is already on-chain. */
  done: string[];
  /** Wallet approvals a from-scratch run would need. */
  totalSignatures: number;
  /** Wallet approvals still outstanding. */
  remainingSignatures: number;
  /** True when a partition is already pinned on-chain that disagrees with the canonical one,
   *  so the run will re-pin it and redo that tier's reveals. */
  repin: boolean;
  /** Non-null when the round cannot be revealed at all yet (not closed, not fully scored…). */
  blocked: string | null;
}

// ---- shared reads ---------------------------------------------------------------------

/** Every CompetitionEntry address of a round, in the program's canonical byte-wise order. */
async function fetchSortedEntryKeys(
  program: SecretGardenProgram,
  round: PublicKey,
): Promise<{ keys: PublicKey[]; unscored: number; flowers: Map<string, PublicKey> }> {
  const accs = await program.account.competitionEntry.all([
    { memcmp: { offset: 8, bytes: round.toBase58() } },
  ]);
  return {
    keys: sortEntriesByteWise(accs.map((a) => a.publicKey)),
    unscored: accs.filter((a) => !a.account.scored).length,
    // `reveal_top3_v5` ranks on `score * 8 + rarity`; the program reads each rarity from the
    // FlowerRecord the entry itself recorded, so every QUEUE call passes the flowers as a
    // second run of remaining accounts.
    flowers: new Map(accs.map((a) => [a.publicKey.toBase58(), a.account.flowerRecord])),
  };
}

/** Read a batch of reveal-result records at once (missing accounts come back null). */
async function fetchResults(program: SecretGardenProgram, pdas: PublicKey[]) {
  if (pdas.length === 0) return [];
  return program.account.revealTop3V3Result.fetchMultiple(pdas);
}

/** True once the computation's callback has written a usable result. */
function resultReady(res: { ready: boolean; errorCode: number } | null): boolean {
  return !!res && res.ready && res.errorCode === 0;
}

/** Load a round's Tier1State. Returns "stale" when the account exists but no longer decodes
 *  (a layout change), which is recoverable only by closing and re-pinning it. */
async function loadTier1(program: SecretGardenProgram, tier1: PublicKey) {
  try {
    return await program.account.tier1State.fetchNullable(tier1);
  } catch {
    const info = await program.provider.connection.getAccountInfo(tier1);
    return info ? ("stale" as const) : null;
  }
}

/** Does the partition already pinned on-chain match the one we just computed? */
function partitionMatches(
  onChain: { shardCount: number; shardSizes: number[]; shardBounds: PublicKey[] } | null,
  plan: BracketPlan,
): boolean {
  if (!onChain) return false;
  if (onChain.shardCount !== plan.shards.length) return false;
  return plan.shards.every(
    (s, i) => s.entries.length === onChain.shardSizes[i] && s.bound.equals(onChain.shardBounds[i]),
  );
}

// ---- inspection (resumability) --------------------------------------------------------

/**
 * Read-only: what would pressing "Reveal Winners" do right now?
 *
 * Called when the operator panel opens, so an interrupted sequence announces itself instead
 * of silently restarting from scratch when the button is pressed.
 */
export async function inspectReveal(
  ctx: RevealContext,
  roundId: number,
): Promise<RevealStatus> {
  const { program } = ctx;
  const round = roundPda(roundId);
  const r = await program.account.competitionRound.fetch(round);

  const base: RevealStatus = {
    roundId,
    entryCount: r.participantCount,
    tier: "single",
    sizes: [],
    semifinalSizes: [],
    summary: "",
    revealed: r.scoringRevealed,
    inProgress: false,
    done: [],
    totalSignatures: 0,
    remainingSignatures: 0,
    repin: false,
    blocked: null,
  };

  if (r.scoringRevealed) return { ...base, summary: "This round's winners are already revealed." };
  if (r.status !== ROUND_STATUS_CLOSED && r.status !== ROUND_STATUS_FINALIZED) {
    return { ...base, blocked: "The round must be closed before it can be revealed." };
  }
  if (r.participantCount === 0) {
    return { ...base, blocked: "This round has no entries — there is nothing to reveal." };
  }
  if (r.scoredCount !== r.participantCount) {
    return {
      ...base,
      blocked: `${r.participantCount - r.scoredCount} of ${r.participantCount} entries are still unscored.`,
    };
  }
  if (r.participantCount > TWO_TIER_CAPACITY) {
    return {
      ...base,
      blocked: `${r.participantCount} entries is past the bracket's ${TWO_TIER_CAPACITY}-entry ceiling.`,
    };
  }

  const { keys, unscored, flowers } = await fetchSortedEntryKeys(program, round);
  flowerByEntry = flowers;
  if (keys.length !== r.participantCount) {
    return {
      ...base,
      blocked: `Found ${keys.length} entry accounts but the round counts ${r.participantCount}.`,
    };
  }
  if (unscored > 0) {
    return { ...base, blocked: `${unscored} entries are still unscored.` };
  }

  let plan: BracketPlan;
  try {
    plan = planBracket(keys);
  } catch (e) {
    return { ...base, blocked: e instanceof BracketPlanError ? e.message : String(e) };
  }

  const total = signatureCount(plan);
  const survey = await surveyProgress(program, round, plan);
  return {
    ...base,
    tier: plan.tier,
    sizes: plan.sizes,
    semifinalSizes: plan.semifinalSizes,
    summary: describePlan(plan),
    totalSignatures: total,
    done: survey.done,
    repin: survey.repin,
    inProgress: survey.signed > 0 || survey.repin,
    remainingSignatures: Math.max(1, total - survey.signed),
  };
}

/**
 * How much of `plan` is already on-chain: how many signatures' worth of work is done, in
 * plain English, and whether a partition is pinned that disagrees with the canonical one.
 *
 * Shared by `inspectReveal` (which turns it into the resume prompt) and `runBracketReveal`
 * (which seeds its progress counter with it, so a resumed run's bar reflects the ROUND's
 * progress rather than restarting at zero). One implementation, so the two can never quote
 * different numbers for the same round.
 */
async function surveyProgress(
  program: SecretGardenProgram,
  round: PublicKey,
  plan: BracketPlan,
): Promise<{ signed: number; done: string[]; repin: boolean }> {
  const done: string[] = [];
  let signed = 0;
  let repin = false;

  if (plan.tier === "single") {
    const bracket = await program.account.bracketState.fetchNullable(bracketPda(round));
    const matches = partitionMatches(bracket, plan);
    if (bracket && !matches) repin = true;
    if (bracket && matches) {
      signed += 1;
      done.push(`Partition pinned: ${plan.shards.length} shard(s) [${plan.sizes.join(", ")}].`);

      const results = await fetchResults(
        program,
        plan.shards.map((_, k) => shardResultPda(round, k)),
      );
      const revealed = results.filter(resultReady).length;
      const collected = plan.shards.filter((_, k) => (bracket.shardsCollected & (1 << k)) !== 0).length;
      signed += revealed + collected;
      if (revealed > 0) done.push(`${revealed} of ${plan.shards.length} shard(s) revealed.`);
      if (collected > 0) done.push(`${collected} of ${plan.shards.length} shard winner set(s) collected.`);
      if (bracket.finalQueued) {
        signed += 1;
        done.push("Final reveal queued.");
      }
    }
  } else {
    const loaded = await loadTier1(program, tier1Pda(round));
    const t1 = loaded === "stale" ? null : loaded;
    const tier1Ok = t1 !== null && partitionMatches(t1, plan);
    if (loaded === "stale" || (t1 !== null && !tier1Ok)) repin = true;

    if (t1 !== null && tier1Ok) {
      signed += 1;
      done.push(`Tier-1 partition pinned: ${plan.shards.length} shards [${plan.sizes.join(", ")}].`);

      const results = await fetchResults(
        program,
        plan.shards.map((_, k) => shardResultPda(round, k)),
      );
      const revealed = results.filter(resultReady).length;
      const collected = plan.shards.filter((_, k) => t1.shardDone[k] !== 0).length;
      signed += revealed + collected;
      if (revealed > 0) done.push(`${revealed} of ${plan.shards.length} tier-1 shards revealed.`);
      if (collected > 0) done.push(`${collected} of ${plan.shards.length} tier-1 shards collected.`);

      if (t1.promoted !== 0) {
        signed += 1;
        const bracket = await program.account.bracketState.fetchNullable(bracketPda(round));
        if (bracket) {
          const semis = bracket.shardCount;
          done.push(`Promoted to ${semis} semifinal(s) [${bracket.shardSizes.slice(0, semis).join(", ")}].`);
          const semiResults = await fetchResults(
            program,
            Array.from({ length: semis }, (_, k) => semiResultPda(round, k)),
          );
          const semiRevealed = semiResults.filter(resultReady).length;
          const semiCollected = Array.from({ length: semis }).filter(
            (_, k) => (bracket.shardsCollected & (1 << k)) !== 0,
          ).length;
          signed += semiRevealed + semiCollected;
          if (semiRevealed > 0) done.push(`${semiRevealed} of ${semis} semifinals revealed.`);
          if (semiCollected > 0) done.push(`${semiCollected} of ${semis} semifinals collected.`);
          if (bracket.finalQueued) {
            signed += 1;
            done.push("Final reveal queued.");
          }
        }
      }
    }
  }

  return { signed, done, repin };
}

// ---- one tier of shards ---------------------------------------------------------------

/**
 * The three tiers of the bracket — single-tier shards, tier-1 shards and semifinals — are the
 * same shape: reveal every shard, then collect every shard's winners. Only the instructions
 * and the "already collected" bit differ, so they share one driver.
 */
interface TierSpec {
  count: number;
  /** Singular noun for progress text, e.g. "shard". */
  noun: string;
  resultPda: (k: number) => PublicKey;
  /** Send the queue instruction for shard k (one signature). */
  queue: (k: number) => Promise<void>;
  /** Has shard k's winner set already been collected? */
  collected: (k: number) => Promise<boolean>;
  /** Send the collect instruction for shard k (one signature). */
  collect: (k: number) => Promise<void>;
}

/** Progress bookkeeping shared by the whole run: a label now, a step count as work lands. */
interface Progress {
  /** Report what is happening, without advancing the counter. */
  say: (label: string) => void;
  /** Record one confirmed signature and report. */
  signed: (label: string) => void;
}

function makeProgress(total: number, emit: ProgressFn, alreadyDone = 0): Progress {
  let step = alreadyDone;
  const say = (label: string) => emit({ step, totalSteps: total, label });
  return {
    say,
    signed: (label: string) => {
      step += 1;
      say(label);
    },
  };
}

/** Poll a set of result PDAs until every one is ready, reporting each landing. */
async function awaitResults(
  program: SecretGardenProgram,
  pdas: PublicKey[],
  timeoutMs: number,
  onCount: (ready: number, total: number) => void,
): Promise<number> {
  if (pdas.length === 0) return 0;
  const deadline = Date.now() + timeoutMs;
  let ready = 0;
  onCount(0, pdas.length);
  while (Date.now() < deadline) {
    const results = await fetchResults(program, pdas);
    const n = results.filter(resultReady).length;
    if (n !== ready) {
      ready = n;
      onCount(ready, pdas.length);
    }
    if (ready === pdas.length) return ready;
    await sleep(RESULT_POLL_MS);
  }
  return ready;
}

/**
 * Reveal + collect every shard of one tier, skipping whatever the chain says is already done.
 *
 * `forceRequeue` is set when the partition was just re-pinned: any result computed under the
 * OLD partition ranked a different set of entries, so it must not be trusted even though its
 * `ready` flag is set.
 */
async function runTier(
  ctx: RevealContext,
  spec: TierSpec,
  progress: Progress,
  forceRequeue: boolean,
): Promise<void> {
  const { program } = ctx;
  const indices = Array.from({ length: spec.count }, (_, k) => k);
  const pdas = indices.map(spec.resultPda);
  const existing = await fetchResults(program, pdas);

  // Split the shards three ways: already revealed (nothing to do), queued-but-not-ready
  // (possibly still in flight — see RESUME_GRACE_MS), and never queued.
  let needQueue = indices.filter((k) => forceRequeue || !resultReady(existing[k]));
  if (!forceRequeue) {
    const inFlight = needQueue.filter((k) => existing[k] !== null);
    if (inFlight.length > 0) {
      progress.say(
        `Checking ${inFlight.length} ${spec.noun}${inFlight.length === 1 ? "" : "s"} already in flight…`,
      );
      await awaitResults(program, inFlight.map(spec.resultPda), RESUME_GRACE_MS, () => {});
      const settled = await fetchResults(program, pdas);
      needQueue = indices.filter((k) => !resultReady(settled[k]));
    }
  }

  // Queue back-to-back — no pacing, per the devnet mempool-rate probe.
  for (let i = 0; i < needQueue.length; i++) {
    const k = needQueue[i];
    progress.say(`Revealing ${spec.noun} ${i + 1} of ${needQueue.length}… (approve in wallet)`);
    await spec.queue(k);
    progress.signed(`Queued ${spec.noun} ${i + 1} of ${needQueue.length}.`);
  }

  if (needQueue.length > 0) {
    const landed = await awaitResults(
      program,
      needQueue.map(spec.resultPda),
      RESULT_TIMEOUT_MS,
      (ready, total) =>
        progress.say(`Computing ${spec.noun} results — ${ready} of ${total} back…`),
    );
    if (landed < needQueue.length) {
      throw new TxError(
        "failed",
        `Only ${landed} of ${needQueue.length} ${spec.noun} results came back in time. ` +
          `Nothing is lost — press Resume to pick up where this left off.`,
      );
    }
  }

  for (let i = 0; i < spec.count; i++) {
    if (await spec.collected(i)) continue;
    progress.say(`Collecting ${spec.noun} ${i + 1} of ${spec.count}… (approve in wallet)`);
    await spec.collect(i);
    progress.signed(`Collected ${spec.noun} ${i + 1} of ${spec.count}.`);
  }
}

// ---- the run --------------------------------------------------------------------------

const metas = (keys: PublicKey[]) =>
  keys.map((pubkey) => ({ pubkey, isWritable: false, isSigner: false }));

/** entry pubkey -> its FlowerRecord, refreshed at the start of each reveal run. */
let flowerByEntry = new Map<string, PublicKey>();

/**
 * remaining-accounts for the four QUEUE instructions: the entries, then their FlowerRecords
 * in the SAME order. The collect_* instructions are UNCHANGED and must keep plain `metas` —
 * they still expect exactly n accounts and will fail WrongEntryCount with 2n.
 */
const metasWithFlowers = (keys: PublicKey[]) => [
  ...metas(keys),
  ...metas(
    keys.map((k) => {
      const f = flowerByEntry.get(k.toBase58());
      if (!f) throw new Error(`no FlowerRecord known for entry ${k.toBase58()}`);
      return f;
    }),
  ),
];

/**
 * Run the whole reveal for `roundId`, from wherever it currently stands to `scoring_revealed`.
 *
 * Safe to call on a round that is already part-way through, and safe to call on one that is
 * already finished (it returns immediately). Every step is idempotent against the chain state
 * it reads first, so a failed or declined signature only costs a retry, never the round.
 */
export async function runBracketReveal(
  ctx: RevealContext,
  roundId: number,
  onProgress: ProgressFn,
): Promise<void> {
  const { program, authority, submit } = ctx;
  const round = roundPda(roundId);
  const config = configPda();

  const r = await program.account.competitionRound.fetch(round);
  if (r.scoringRevealed) {
    onProgress({ step: 1, totalSteps: 1, label: "Already revealed." });
    return;
  }
  if (r.status !== ROUND_STATUS_CLOSED && r.status !== ROUND_STATUS_FINALIZED) {
    throw new TxError("failed", "The round must be closed before it can be revealed.");
  }
  if (r.scoredCount !== r.participantCount) {
    throw new TxError(
      "failed",
      `${r.participantCount - r.scoredCount} entries are still unscored — score them first.`,
    );
  }

  const { keys, unscored, flowers } = await fetchSortedEntryKeys(program, round);
  flowerByEntry = flowers;
  if (keys.length !== r.participantCount) {
    throw new TxError(
      "failed",
      `Found ${keys.length} entry accounts but the round counts ${r.participantCount}. ` +
        `Reload the panel and try again.`,
    );
  }
  if (unscored > 0) throw new TxError("failed", `${unscored} entries are still unscored.`);

  let plan: BracketPlan;
  try {
    plan = planBracket(keys);
  } catch (e) {
    throw new TxError("failed", e instanceof BracketPlanError ? e.message : String(e));
  }

  // Seed the counter with what is already on-chain, so a RESUMED run's bar continues from
  // where the round actually stands instead of restarting at zero and appearing to go
  // backwards against the "4 approvals left" the resume prompt just quoted.
  const survey = await surveyProgress(program, round, plan);
  const progress = makeProgress(signatureCount(plan), onProgress, survey.signed);
  progress.say(describePlan(plan));

  const bracket = bracketPda(round);
  const tier1 = tier1Pda(round);

  if (plan.tier === "two") {
    await runTwoTier(ctx, { round, config, bracket, tier1, plan }, progress);
  } else {
    await runSingleTier(ctx, { round, config, bracket, plan }, progress);
  }

  // ---- FINAL reveal + apply. Identical for both tiers: by this point BracketState holds the
  // finalists either way, so the two-tier path rejoins the proven single-tier code here.
  const single = plan.shards.length === 1 && plan.tier === "single";
  const finalIndex = single ? 0 : FINAL_SHARD_INDEX;
  const finalResult = shardResultPda(round, finalIndex);

  if (!single) {
    const b = await program.account.bracketState.fetch(bracket);
    if (!b.finalQueued) {
      // The program checks the supplied finalists against BracketState.finalists and requires
      // them ascending, so they are re-sorted here — collection order is rank order, not
      // pubkey order.
      const finalists = [...b.finalists.slice(0, b.finalistCount)].sort(compareEntryKeys);
      progress.say(`Final reveal over ${finalists.length} finalists… (approve in wallet)`);
      const offset = freshOffset();
      await submit(
        withComputeUnitLimit(
          await program.methods
            .queueShardReveal(offset, FINAL_SHARD_INDEX)
            .accountsPartial({
              authority,
              config,
              round,
              bracket,
              result: finalResult,
              ...arciumAccountsFor(CIRCUITS.revealTop3, offset),
            })
            .remainingAccounts(metasWithFlowers(finalists))
            .transaction(),
          REVEAL_CU_LIMIT,
        ),
      );
      progress.signed("Final reveal queued.");
    }

    const landed = await awaitResults(program, [finalResult], RESULT_TIMEOUT_MS, () =>
      progress.say("Computing the final ranking…"),
    );
    if (landed === 0) {
      throw new TxError(
        "failed",
        "The final reveal did not come back in time. Press Resume to pick it up.",
      );
    }
  }

  progress.say("Writing the winners on-chain… (approve in wallet)");
  await submit(
    await program.methods
      .applyBracketResult(finalIndex)
      .accountsPartial({ authority, config, round, bracket, result: finalResult })
      .transaction(),
  );
  progress.signed("Winners revealed.");

  // The round is now finished on-chain, which is what actually matters. Everything below is
  // the off-chain mirror for the Daily Winners panel.
  await mirrorResultsToSupabase(ctx, roundId, progress);
}

/**
 * Publish the just-revealed winners to Supabase so the Daily Winners panel shows them.
 *
 * DELIBERATELY NON-FATAL. By the time this runs `apply_bracket_result` has confirmed and the
 * podium is final on-chain; the chain is the authority and this table is a convenience mirror.
 * A Supabase outage, a declined signature prompt, or an unconfigured build must not make a
 * successful reveal report failure to the operator — so every path here resolves, and the
 * outcome is reported through the progress line instead.
 *
 * The write goes through the set-round-results edge function, which re-derives the winners
 * from the chain rather than trusting anything sent to it. This function therefore sends only
 * the round number, a timestamp and a signature; there is no result data to forge. That is the
 * whole reason the previous anon-key writer was removed: it could only have worked if the
 * tables granted INSERT to `anon`, which would have made them writable by any visitor.
 */
async function mirrorResultsToSupabase(
  ctx: RevealContext,
  roundId: number,
  progress: Progress,
): Promise<void> {
  if (!supabase) return; // build has no Supabase configured — nothing to mirror to
  if (!ctx.signMessage) {
    progress.say("Winners revealed. (This wallet cannot sign, so the results board was not updated.)");
    return;
  }

  progress.say("Publishing the results board… (approve in wallet)");
  try {
    const { alreadyPublished } = await saveRoundResults(roundId, {
      address: ctx.authority.toBase58(),
      signMessage: ctx.signMessage,
    });
    progress.say(
      alreadyPublished
        ? "Winners revealed. Results board was already published."
        : "Winners revealed and published to the results board.",
    );
  } catch (e) {
    // Worth surfacing, not worth failing: the operator can re-publish later.
    progress.say(
      `Winners revealed. The results board could not be updated (${
        e instanceof Error ? e.message : String(e)
      }) — the winners are safe on-chain.`,
    );
  }
}

// ---- single tier ----------------------------------------------------------------------

async function runSingleTier(
  ctx: RevealContext,
  refs: { round: PublicKey; config: PublicKey; bracket: PublicKey; plan: BracketPlan },
  progress: Progress,
): Promise<void> {
  const { program, authority, submit } = ctx;
  const { round, config, bracket, plan } = refs;

  const existing = await program.account.bracketState.fetchNullable(bracket);
  const matches = partitionMatches(existing, plan);
  const repin = !!existing && !matches;

  if (!matches) {
    // init_bracket is `init_if_needed` and rewrites every field, so a bracket pinned from a
    // bad ordering is cleanly reset without closing anything.
    progress.say(
      repin
        ? "Re-pinning the shard partition… (approve in wallet)"
        : "Pinning the shard partition… (approve in wallet)",
    );
    const sizes = padNumbers(plan.sizes, MAX_SHARDS);
    const bounds = padKeys(plan.shards.map((s) => s.bound), MAX_SHARDS);
    await submit(
      await program.methods
        .initBracket(sizes, bounds, plan.shards.length)
        .accountsPartial({ authority, config, round, bracket })
        .transaction(),
    );
    progress.signed(`Partition pinned: ${plan.shards.length} shard(s).`);
  }

  await runTier(
    ctx,
    {
      count: plan.shards.length,
      noun: "shard",
      resultPda: (k) => shardResultPda(round, k),
      queue: async (k) => {
        const offset = freshOffset();
        await submit(
          withComputeUnitLimit(
            await program.methods
              .queueShardReveal(offset, k)
              .accountsPartial({
                authority,
                config,
                round,
                bracket,
                result: shardResultPda(round, k),
                ...arciumAccountsFor(CIRCUITS.revealTop3, offset),
              })
              .remainingAccounts(metasWithFlowers(plan.shards[k].entries))
              .transaction(),
            REVEAL_CU_LIMIT,
          ),
        );
      },
      collected: async (k) => {
        const b = await program.account.bracketState.fetch(bracket);
        return (b.shardsCollected & (1 << k)) !== 0;
      },
      collect: async (k) => {
        await submit(
          await program.methods
            .collectShardWinners(k)
            .accountsPartial({ authority, config, round, bracket, result: shardResultPda(round, k) })
            .remainingAccounts(metas(plan.shards[k].entries))
            .transaction(),
        );
      },
    },
    progress,
    repin,
  );
}

// ---- two tiers ------------------------------------------------------------------------

async function runTwoTier(
  ctx: RevealContext,
  refs: {
    round: PublicKey;
    config: PublicKey;
    bracket: PublicKey;
    tier1: PublicKey;
    plan: BracketPlan;
  },
  progress: Progress,
): Promise<void> {
  const { program, authority, submit } = ctx;
  const { round, config, bracket, tier1, plan } = refs;

  const existing = await loadTier1(program, tier1);
  const stale = existing === "stale";
  const decoded = existing === "stale" ? null : existing;
  const matches = partitionMatches(decoded, plan);
  // A promoted tier 1 is finished and its winners are already in BracketState — never disturb
  // it, even if the pinned partition looks unfamiliar.
  const promoted = !!decoded && decoded.promoted !== 0;
  const repin = !promoted && (stale || (!!decoded && !matches));

  if (repin && (stale || decoded)) {
    // init_tier1_bracket is `init`, NOT `init_if_needed` — pinning is a one-shot act, so
    // re-pinning has to be an explicit close first.
    progress.say("Clearing the stale tier-1 partition… (approve in wallet)");
    await submit(
      await program.methods
        .closeTier1Bracket()
        .accountsPartial({ authority, config, round, tier1 })
        .transaction(),
    );
  }

  if (!decoded || repin) {
    progress.say("Pinning the tier-1 partition… (approve in wallet)");
    const sizes = padNumbers(plan.sizes, MAX_TIER1_SHARDS);
    const bounds = padKeys(plan.shards.map((s) => s.bound), MAX_TIER1_SHARDS);
    await submit(
      await program.methods
        .initTier1Bracket(sizes, bounds, plan.shards.length)
        .accountsPartial({ authority, config, round, tier1 })
        .transaction(),
    );
    progress.signed(`Tier-1 partition pinned: ${plan.shards.length} shards.`);
  }

  if (!promoted) {
    await runTier(
      ctx,
      {
        count: plan.shards.length,
        noun: "tier-1 shard",
        resultPda: (k) => shardResultPda(round, k),
        queue: async (k) => {
          const offset = freshOffset();
          await submit(
            withComputeUnitLimit(
              await program.methods
                .queueTier1ShardReveal(offset, k)
                .accountsPartial({
                  authority,
                  config,
                  round,
                  tier1,
                  result: shardResultPda(round, k),
                  ...arciumAccountsFor(CIRCUITS.revealTop3, offset),
                })
                .remainingAccounts(metasWithFlowers(plan.shards[k].entries))
                .transaction(),
              REVEAL_CU_LIMIT,
            ),
          );
        },
        collected: async (k) => {
          const t = await program.account.tier1State.fetch(tier1);
          return t.shardDone[k] !== 0;
        },
        collect: async (k) => {
          await submit(
            await program.methods
              .collectTier1Winners(k)
              .accountsPartial({
                authority,
                config,
                round,
                tier1,
                result: shardResultPda(round, k),
              })
              .remainingAccounts(metas(plan.shards[k].entries))
              .transaction(),
          );
        },
      },
      progress,
      repin,
    );

    progress.say("Promoting tier-1 winners to the semifinals… (approve in wallet)");
    await submit(
      await program.methods
        .promoteTier1()
        .accountsPartial({ authority, config, round, tier1, bracket })
        .transaction(),
    );
    progress.signed("Tier-1 winners promoted.");
  }

  // From here the semifinal tier IS an ordinary BracketState — promote_tier1 computed and
  // wrote its partition on-chain, so the sizes below are read, never guessed.
  const t1 = await program.account.tier1State.fetch(tier1);
  const b = await program.account.bracketState.fetch(bracket);
  const semis = b.shardCount;
  const winners = t1.winners.slice(0, t1.winnerCount);
  const sliceFor = (k: number) => {
    const start = b.shardSizes.slice(0, k).reduce((a, s) => a + s, 0);
    return winners.slice(start, start + b.shardSizes[k]);
  };

  await runTier(
    ctx,
    {
      count: semis,
      noun: "semifinal",
      resultPda: (k) => semiResultPda(round, k),
      queue: async (k) => {
        const offset = freshOffset();
        await submit(
          withComputeUnitLimit(
            await program.methods
              .queueSemifinalReveal(offset, k)
              .accountsPartial({
                authority,
                config,
                round,
                tier1,
                bracket,
                result: semiResultPda(round, k),
                ...arciumAccountsFor(CIRCUITS.revealTop3, offset),
              })
              .remainingAccounts(metasWithFlowers(sliceFor(k)))
              .transaction(),
            REVEAL_CU_LIMIT,
          ),
        );
      },
      collected: async (k) => {
        const cur = await program.account.bracketState.fetch(bracket);
        return (cur.shardsCollected & (1 << k)) !== 0;
      },
      // No entry accounts: the slice is Tier1State.winners[start..], already on-chain.
      collect: async (k) => {
        await submit(
          await program.methods
            .collectSemifinalWinners(k)
            .accountsPartial({
              authority,
              config,
              round,
              tier1,
              bracket,
              result: semiResultPda(round, k),
            })
            .transaction(),
        );
      },
    },
    progress,
    false,
  );
}

// ---- fixed-width instruction arguments -------------------------------------------------
// init_bracket / init_tier1_bracket take FIXED-LENGTH arrays and require every unused slot to
// be zeroed, so the layout is unambiguous on-chain.

function padNumbers(values: number[], width: number): number[] {
  const out = new Array<number>(width).fill(0);
  values.forEach((v, i) => (out[i] = v));
  return out;
}

function padKeys(values: PublicKey[], width: number): PublicKey[] {
  const out = new Array<PublicKey>(width).fill(PublicKey.default);
  values.forEach((v, i) => (out[i] = v));
  return out;
}
