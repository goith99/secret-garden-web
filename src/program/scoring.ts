/**
 * SCORING ORCHESTRATION — every unscored entry of a round, in as few wallet approvals as
 * Solana's transaction size allows.
 *
 * `queue_score_entry` is an ordinary Anchor instruction, so several of them fit in ONE
 * transaction under ONE signature. Nothing on-chain changed to allow this; the program has
 * always accepted it, the client simply used to send them one at a time (N entries = N
 * popups, which is 221 popups at the bracket's ceiling).
 *
 * WHY FOUR PER TRANSACTION. Measured, not guessed. The instruction takes 16 accounts, of which
 * 13 are shared by every call in a round (config, round, the Arcium infra, the programs) and
 * only 3 are per-entry: `entry`, `flower_record`, `computation_account`. So each extra
 * instruction costs exactly 131 bytes — 3 x 32 for the new keys plus 35 for the compiled
 * instruction (1 program index + 1 + 16 account indexes + 1 + 16 bytes of data).
 *
 * THE BUDGET IS NOT 1232 BYTES. IT IS 1180. The wallet prepends its own priority-fee
 * instructions to whatever we hand it, and they are not free:
 *
 *     k    we build   wallet adds   on the wire
 *     3      943 B       +52 B        995 B
 *     4     1074 B       +52 B       1126 B   <- fits, 106 bytes spare
 *     5     1205 B       +52 B       1257 B   <- OVERFLOWS the 1232-byte packet
 *
 * That +52 is the ComputeBudget program key (32 B, a new account in the message) plus a
 * `setComputeUnitPrice` and a `setComputeUnitLimit` instruction (20 B together). It is not
 * hypothetical: round 45's reveal, sent from a build whose source contains no ComputeBudget
 * reference at all, landed on-chain carrying `setComputeUnitPrice=100000` and
 * `setComputeUnitLimit=200000`. The wallet put them there.
 *
 * k=5 therefore works only when nothing injects — a keypair signer, a script, a wallet with
 * priority fees switched off — and fails in the ordinary browser path this module exists to
 * serve. 4 is the largest size that survives the injection, with room to spare if a wallet
 * ever adds a third instruction.
 *
 * COMPUTE. We attach no ComputeBudget instruction ourselves, deliberately. Two reasons: it
 * would be duplicated by (or duplicate) the wallet's own, and when nothing injects, the
 * runtime's implicit grant of 200,000 CU per instruction already covers us — 800,000 for a
 * 4-instruction batch against a measured 4 x 130,271 = 521,084 worst case. The live 5-batch on
 * round 45 consumed 587,034 of 1,000,000 (117,407/instruction), so the real figure is
 * comfortably under the worst case, and batching adds no per-instruction overhead: the single
 * -instruction transaction alongside it consumed 117,969.
 *
 * ALL-OR-NOTHING, AND WHAT IS DONE ABOUT IT. A batch reverts as a unit, so one ineligible
 * entry would otherwise strand the four beside it. Two defences, in this order:
 *
 *  1. Every batch re-reads its own entries from the chain immediately before it is built and
 *     drops anything already scored or already in flight. `fetchRoundEntries`' snapshot in the
 *     panel is never trusted for this — it can be minutes old, and the callback that flips
 *     `scored` lands on its own schedule.
 *  2. If a batch reverts anyway (a race, or an entry that changed under us), it is split in
 *     half and each half retried — recursively, down to single entries. The good entries in a
 *     poisoned batch always land, and a single entry that fails on its own is recorded while
 *     the run CONTINUES; it never blocks the rest of the round.
 *
 *     This is a recovery path, NOT a cheaper one. Halving a batch of k around one bad entry
 *     costs up to k + ceil(log2 k) approvals — for k=4, five: the batch, both halves, and both
 *     singles of the bad half. That is one MORE than sending the four separately would have
 *     been. The trade is deliberate: the common case pays 1 approval for 4 entries, and the
 *     pathological case pays one extra rather than stranding three good entries.
 *
 * The split only ever fires on an on-chain/build failure. A declined popup, a wrong network or
 * an empty wallet aborts the whole run immediately — retrying those would just re-prompt, and
 * halving a batch the operator cancelled would double the prompts they are trying to escape.
 */
import { BN } from "@anchor-lang/core";
import {
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import type { SecretGardenProgram } from "./client";
import { TxError } from "./errors";
import { arciumAccountsFor } from "./arcium";
import { roundPda } from "./accounts";

/**
 * `queue_score_entry` instructions per transaction. See the byte table in the module header —
 * 4 is the largest that still fits once the wallet has prepended its priority-fee
 * instructions, with 106 bytes to spare.
 *
 * Raising this to 5 is the tempting mistake: it measures fine (1205 B) and it works under any
 * signer that does not inject, which includes every script and test harness. It overflows at
 * 1257 B in a real browser. If you raise it anyway, the overflow surfaces inside the WALLET,
 * after the popup — not as web3.js's local "Transaction too large" — so the split path may see
 * an unreadable wallet error and classify it as a cancellation rather than retrying.
 */
export const SCORE_BATCH_SIZE = 4;

/**
 * Consecutive single-entry failures tolerated before the run gives up.
 *
 * An entry-specific problem stops at one entry. A SYSTEMIC one — the game paused, the wallet
 * not an operator, the round reopened — fails every entry identically, and without this the
 * split path would patiently walk the whole round asking for one doomed approval per entry.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Wallet approvals a from-scratch run over `unscored` entries needs, absent any splits. */
export function scoreTransactionCount(unscored: number): number {
  return Math.ceil(Math.max(0, unscored) / SCORE_BATCH_SIZE);
}

/** Everything the run needs from the calling hook — same shape as RevealContext. */
export interface ScoringContext {
  program: SecretGardenProgram;
  authority: PublicKey;
  submit: (tx: Transaction) => Promise<string>;
}

/** One tick of the progress indicator. `step` counts CONFIRMED transactions, not entries. */
export interface ScoreProgress {
  step: number;
  totalSteps: number;
  /** What is happening right now, e.g. "Scoring batch 3 of 9 (5 entries)…". */
  label: string;
}

export type ScoreProgressFn = (progress: ScoreProgress) => void;

/** What a run actually achieved. Reported to the operator verbatim — never rounded up. */
export interface ScoreOutcome {
  /** Entries whose scoring computation this run queued. */
  queued: number;
  /** Entries that a fresh pre-batch read found already scored or already in flight. */
  skipped: number;
  /** Entries that failed on their own, with the reason. The run continued past each. */
  failed: { entry: string; reason: string }[];
  /** Wallet approvals actually spent, including any the split path added. */
  transactions: number;
}

/** An entry that a fresh read says can be queued right now, with the accounts to do it. */
interface Queueable {
  entry: PublicKey;
  round: PublicKey;
  flowerRecord: PublicKey;
}

/** Crypto-strong random bytes in the browser (no node `crypto`). */
function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** A fresh 64-bit Arcium computation offset. */
const freshOffset = () => new BN(Array.from(randomBytes(8)));

/**
 * Re-read `keys` and keep only the entries that can be queued RIGHT NOW.
 *
 * Both on-chain guards are mirrored here — `!entry.scored` (GAP 1) and `!entry.score_queued`
 * (Stage 5A) — because either one failing reverts the whole batch. The second matters more
 * than it looks: an entry queued seconds ago is not scored yet but also cannot be re-queued
 * until `cancel_stuck_score` times it out, so a naive `!scored` filter (which is all the
 * one-at-a-time path ever needed) would poison a batch with an entry that is merely busy.
 *
 * `round` and `flower_record` are taken from the account itself rather than from anything the
 * UI is holding — the same rule the single-entry path followed.
 */
async function readQueueable(
  program: SecretGardenProgram,
  keys: PublicKey[],
): Promise<Queueable[]> {
  if (keys.length === 0) return [];
  const accs = await program.account.competitionEntry.fetchMultiple(keys);
  const out: Queueable[] = [];
  accs.forEach((acc, i) => {
    if (!acc || acc.scored || acc.scoreQueued) return;
    out.push({ entry: keys[i], round: acc.round, flowerRecord: acc.flowerRecord });
  });
  return out;
}

/** The `queue_score_entry` instruction for one entry, with a fresh computation offset. */
async function scoreInstruction(
  ctx: ScoringContext,
  q: Queueable,
): Promise<TransactionInstruction> {
  const offset = freshOffset();
  return ctx.program.methods
    .queueScoreEntry(offset)
    .accountsPartial({
      authority: ctx.authority,
      round: q.round,
      entry: q.entry,
      flowerRecord: q.flowerRecord,
      ...arciumAccountsFor("score_entry_v2", offset),
    })
    .instruction();
}

/** Progress bookkeeping. `totalSteps` grows when a split turns one transaction into two. */
interface Progress {
  say: (label: string) => void;
  signed: (label: string) => void;
  /** Record that the plan now needs `n` more transactions than it did. */
  widen: (n: number) => void;
}

function makeProgress(total: number, emit: ScoreProgressFn): Progress {
  let step = 0;
  let totalSteps = total;
  const say = (label: string) => emit({ step, totalSteps, label });
  return {
    say,
    signed: (label: string) => {
      step += 1;
      say(label);
    },
    widen: (n: number) => {
      totalSteps += n;
    },
  };
}

/**
 * Queue one batch, splitting and retrying on an on-chain failure.
 *
 * Takes entry KEYS rather than built instructions on purpose: every level of the recursion
 * re-reads them, so a retry after a failure sees the state the failure created rather than
 * rebuilding from the stale view that caused it.
 */
async function runBatch(
  ctx: ScoringContext,
  keys: PublicKey[],
  progress: Progress,
  outcome: ScoreOutcome,
  state: { consecutiveFailures: number },
): Promise<void> {
  // (1) Fresh read, immediately before building. Anything already scored or in flight is
  // dropped here rather than reverting the batch on-chain.
  const batch = await readQueueable(ctx.program, keys);
  if (batch.length === 0) return;

  const ixs = await Promise.all(batch.map((q) => scoreInstruction(ctx, q)));
  const tx = new Transaction();
  ixs.forEach((ix) => tx.add(ix));

  try {
    await ctx.submit(tx);
    outcome.queued += batch.length;
    outcome.transactions += 1;
    state.consecutiveFailures = 0;
    progress.signed(
      `Queued ${batch.length} entr${batch.length === 1 ? "y" : "ies"} for scoring.`,
    );
    return;
  } catch (e) {
    const err = e instanceof TxError ? e : new TxError("failed", String(e));

    // (2a) Not an on-chain failure — the operator declined, the wallet is on the wrong
    // network, or there is no SOL. Splitting would only multiply the prompts. Abort.
    if (err.kind !== "failed") throw err;

    outcome.transactions += 1;

    // (2b) A single entry that fails on its own is recorded, and the run moves on.
    if (batch.length === 1) {
      state.consecutiveFailures += 1;
      outcome.failed.push({ entry: batch[0].entry.toBase58(), reason: err.message });
      progress.signed(`One entry could not be scored — continuing.`);
      if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new TxError(
          "failed",
          `${state.consecutiveFailures} entries in a row failed to queue — stopping rather ` +
            `than asking for an approval per entry. Last reason: ${err.message}`,
        );
      }
      return;
    }

    // (2c) Halve and retry. One transaction became two, so the plan grows by one.
    const mid = Math.ceil(batch.length / 2);
    const half = batch.map((q) => q.entry);
    progress.widen(1);
    progress.say(`A batch of ${batch.length} was rejected — retrying in two halves…`);
    await runBatch(ctx, half.slice(0, mid), progress, outcome, state);
    await runBatch(ctx, half.slice(mid), progress, outcome, state);
  }
}

/**
 * Score every unscored entry of `roundId`, in batches, reporting each transaction through
 * `onProgress`.
 *
 * Safe to re-run: the pre-batch read skips whatever is already scored or in flight, so a run
 * interrupted half way (closed tab, declined popup) is resumed by pressing the button again.
 * Nothing is kept in browser storage — the chain is the only progress record, exactly as in
 * the bracket reveal.
 */
export async function runScoring(
  ctx: ScoringContext,
  roundId: number,
  onProgress: ScoreProgressFn,
): Promise<ScoreOutcome> {
  const { program } = ctx;
  const round = roundPda(roundId);

  // The authoritative list, read now — not the panel's cached copy.
  const accs = await program.account.competitionEntry.all([
    { memcmp: { offset: 8, bytes: round.toBase58() } },
  ]);
  const todo = accs
    .filter((a) => !a.account.scored && !a.account.scoreQueued)
    .map((a) => a.publicKey);

  const outcome: ScoreOutcome = { queued: 0, skipped: 0, failed: [], transactions: 0 };
  if (todo.length === 0) return outcome;

  const planned = scoreTransactionCount(todo.length);
  const progress = makeProgress(planned, onProgress);
  const state = { consecutiveFailures: 0 };

  for (let i = 0; i < todo.length; i += SCORE_BATCH_SIZE) {
    const slice = todo.slice(i, i + SCORE_BATCH_SIZE);
    const batchNo = Math.floor(i / SCORE_BATCH_SIZE) + 1;
    progress.say(
      `Scoring batch ${batchNo} of ${planned} (${slice.length} entr${slice.length === 1 ? "y" : "ies"})… (approve in wallet)`,
    );
    await runBatch(ctx, slice, progress, outcome, state);
  }

  // Whatever the fresh reads dropped along the way. Reported, never hidden: an operator who
  // asked to score 13 and sees "queued 11" is owed the other two.
  outcome.skipped = Math.max(0, todo.length - outcome.queued - outcome.failed.length);
  return outcome;
}
