/**
 * Verifies SCORE-ENTRY BATCHING against the real modules the browser runs.
 *
 * Batching `queue_score_entry` is a bet on one number: five instructions fit a legacy
 * transaction and six do not. That bet is invisible until it fails, and it fails in the worst
 * possible place — the operator's wallet, mid-round, on a round that is already closed. So it
 * is asserted here, on transactions built by `runScoring` itself rather than by a copy of it.
 *
 * `runScoring`'s two dependencies are stubbed and nothing else: the account reads (so the test
 * can dictate which entries are scored, in flight, or fresh) and `submit` (so transactions are
 * MEASURED instead of sent). The instruction building, the batching, the pre-batch re-read and
 * the split-retry are the production code paths.
 *
 * Sections:
 *   1. Sizes         — 5 per transaction fits; 6 would not (the constant is at the real edge).
 *   2. Shape         — 16 accounts per instruction, exactly 3 of them per-entry, no
 *                      ComputeBudget instruction (which is what makes k=5 fit).
 *   3. Batching      — N entries produce ceil(N/5) transactions and queue every entry once.
 *   4. Fresh read    — already-scored and in-flight entries are dropped before a batch is built.
 *   5. Split-retry   — a reverting batch is halved down to the bad entry; the other four land.
 *   6. Abort rules   — a declined popup aborts; it does NOT split into more popups.
 *   7. Reveal budget — queue_shard_reveal still fits with its new compute-unit limit.
 *
 * Read-only: no wallet, no RPC, no transactions. Run:
 *   node --import ./scripts/ts-imports.mjs scripts/verify-score-batching.mjs
 */
import * as anchor from "@anchor-lang/core";
import { readFileSync } from "fs";
import {
  runScoring,
  scoreTransactionCount,
  SCORE_BATCH_SIZE,
} from "../src/program/scoring.ts";
import { REVEAL_CU_LIMIT, withComputeUnitLimit } from "../src/program/reveal.ts";
import { arciumAccountsFor } from "../src/program/arcium.ts";
import { TxError } from "../src/program/errors.ts";

const { PublicKey, Keypair, Transaction, Connection, ComputeBudgetProgram } = anchor.web3;

/** Solana's hard packet limit. The whole point of the exercise. */
const PACKET_LIMIT = 1232;
/** Compute units the runtime grants per instruction when no ComputeBudget ix is present. */
const DEFAULT_CU_PER_IX = 200_000;
/** Worst `queue_score_entry` seen across 32 devnet samples (typical 113k). */
const MEASURED_SCORE_CU = 130_271;

let failures = 0;
let checks = 0;
function check(ok, label, detail = "") {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---- a real Program, an unreal network ------------------------------------------------
const idl = JSON.parse(readFileSync(new URL("../src/program/idl/secret_garden.json", import.meta.url)));
const authority = Keypair.generate();
// No request is ever made: only `.instruction()` is called, which is offline. Same read-only
// wallet stub scripts/verify-bracket-plan.mjs uses.
const provider = new anchor.AnchorProvider(
  new Connection("http://127.0.0.1:8899", "confirmed"),
  {
    publicKey: authority.publicKey,
    signTransaction: async (t) => t,
    signAllTransactions: async (t) => t,
  },
  { commitment: "confirmed" },
);
const realProgram = new anchor.Program(idl, provider);

/** A synthetic round of `n` entries, all fresh unless overridden. */
function makeEntries(n, overrides = {}) {
  const round = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), Buffer.alloc(8)],
    new PublicKey(idl.address),
  )[0];
  return Array.from({ length: n }, (_, i) => ({
    publicKey: Keypair.generate().publicKey,
    account: {
      round,
      flowerRecord: Keypair.generate().publicKey,
      scored: overrides.scored?.includes(i) ?? false,
      scoreQueued: overrides.queued?.includes(i) ?? false,
    },
  }));
}

/**
 * The real `program`, with ONLY its two account reads replaced. Everything `runScoring`
 * actually exercises — `methods.queueScoreEntry(...).accountsPartial(...).instruction()` —
 * stays the genuine Anchor builder, so the account list under test is the IDL's.
 */
function stubProgram(entries) {
  const byKey = new Map(entries.map((e) => [e.publicKey.toBase58(), e]));
  return new Proxy(realProgram, {
    get(target, prop, recv) {
      if (prop === "account") {
        return {
          competitionEntry: {
            all: async () => entries.filter((e) => byKey.has(e.publicKey.toBase58())),
            fetchMultiple: async (keys) =>
              keys.map((k) => byKey.get(k.toBase58())?.account ?? null),
          },
        };
      }
      return Reflect.get(target, prop, recv);
    },
  });
}

/** The real `queue_score_entry` instruction for one synthetic entry. */
async function scoreIx(e) {
  const offset = new anchor.BN(Array.from(crypto.getRandomValues(new Uint8Array(8))));
  return realProgram.methods
    .queueScoreEntry(offset)
    .accountsPartial({
      authority: authority.publicKey,
      round: e.account.round,
      entry: e.publicKey,
      flowerRecord: e.account.flowerRecord,
      ...arciumAccountsFor("score_entry_v2", offset),
    })
    .instruction();
}

/** Serialize exactly as the wire would: the wallet fills feePayer + blockhash, same widths. */
function wireSize(tx) {
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = "11111111111111111111111111111111";
  try {
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
  } catch (e) {
    const m = /Transaction too large: (\d+)/.exec(String(e.message));
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  }
}

/** Run `runScoring` over `entries`, capturing every transaction it tries to send. */
async function capture(entries, { fail } = {}) {
  const sent = [];
  const ctx = {
    program: stubProgram(entries),
    authority: authority.publicKey,
    submit: async (tx) => {
      const record = { tx, size: wireSize(tx), ixs: tx.instructions };
      sent.push(record);
      const verdict = fail?.(record, sent.length);
      if (verdict) throw verdict;
      // Success: reflect it in the stub, exactly as the chain would.
      for (const ix of tx.instructions) {
        const entryKey = ix.keys[3].pubkey.toBase58();
        const e = entries.find((x) => x.publicKey.toBase58() === entryKey);
        if (e) e.account.scoreQueued = true;
      }
      return "sig";
    },
  };
  const progress = [];
  const outcome = await runScoring(ctx, 1, (p) => progress.push({ ...p }));
  return { sent, outcome, progress };
}

/**
 * What a browser wallet prepends to whatever we hand it. Copied from the instructions that
 * actually landed on-chain in round 45's reveal (`setComputeUnitPrice=100000`,
 * `setComputeUnitLimit=200000`) from a build whose source has no ComputeBudget reference.
 *
 * Sizing against the bare transaction is the bug this constant exists to prevent: k=5 measures
 * 1205 B and passes every offline check, then overflows at 1257 B in a real browser.
 */
const walletInjection = () => [
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
];

console.log("\n=== 1. transaction size at the batch boundary (as the WALLET sends it) ===");
{
  const sizes = {};
  const injected = {};
  for (let k = 1; k <= 7; k++) {
    const entries = makeEntries(k);
    const ixs = [];
    for (const e of entries) ixs.push(await scoreIx(e));
    const bare = new Transaction();
    ixs.forEach((ix) => bare.add(ix));
    sizes[k] = wireSize(bare);
    const inj = new Transaction();
    walletInjection().forEach((c) => inj.add(c));
    ixs.forEach((ix) => inj.add(ix));
    injected[k] = wireSize(inj);
  }
  console.log(
    "  on the wire:",
    Object.entries(injected).map(([k, v]) => `k=${k}:${v}B`).join("  "),
  );
  check(
    injected[SCORE_BATCH_SIZE] <= PACKET_LIMIT,
    `k=${SCORE_BATCH_SIZE} fits WITH wallet injection`,
    `${injected[SCORE_BATCH_SIZE]} <= ${PACKET_LIMIT}`,
  );
  check(
    injected[SCORE_BATCH_SIZE + 1] > PACKET_LIMIT,
    `k=${SCORE_BATCH_SIZE + 1} would overflow WITH wallet injection`,
    `${injected[SCORE_BATCH_SIZE + 1]} > ${PACKET_LIMIT}`,
  );
  check(
    injected[SCORE_BATCH_SIZE] - sizes[SCORE_BATCH_SIZE] === 52,
    "wallet injection costs 52 bytes",
    `${injected[SCORE_BATCH_SIZE] - sizes[SCORE_BATCH_SIZE]} B`,
  );
  console.log(
    "  as we build it:",
    Object.entries(sizes).map(([k, v]) => `k=${k}:${v}B`).join("  "),
  );
  check(SCORE_BATCH_SIZE === 4, `SCORE_BATCH_SIZE is 4`, `is ${SCORE_BATCH_SIZE}`);
  // The per-instruction cost the module header claims.
  const delta = sizes[3] - sizes[2];
  check(delta === 131, "each extra instruction costs 131 bytes", `${delta} B`);
  // The trap this file exists to keep shut: k=5 passes a bare-size check and fails live.
  check(
    sizes[5] <= PACKET_LIMIT && injected[5] > PACKET_LIMIT,
    "k=5 is the trap — fits bare, overflows on the wire",
    `bare ${sizes[5]} B, wire ${injected[5]} B`,
  );
  // We must not add our own compute budget: it would duplicate the wallet's.
  check(
    !(await scoreIx(makeEntries(1)[0])).programId.equals(ComputeBudgetProgram.programId),
    "we build no ComputeBudget instruction of our own",
  );
  const granted = DEFAULT_CU_PER_IX * SCORE_BATCH_SIZE;
  check(
    granted >= MEASURED_SCORE_CU * SCORE_BATCH_SIZE,
    "implicit CU grant covers a full batch when nothing injects",
    `${granted} vs ${MEASURED_SCORE_CU * SCORE_BATCH_SIZE} worst case`,
  );
}

console.log("\n=== 2. instruction shape ===");
{
  const { sent } = await capture(makeEntries(SCORE_BATCH_SIZE));
  const [batch] = sent;
  check(
    batch.ixs.length === SCORE_BATCH_SIZE,
    `one transaction carries ${SCORE_BATCH_SIZE} instructions`,
    `${batch.ixs.length}`,
  );
  check(
    batch.ixs.every((ix) => ix.keys.length === 16),
    "every instruction takes 16 accounts",
    [...new Set(batch.ixs.map((ix) => ix.keys.length))].join(","),
  );
  check(
    batch.ixs.every((ix) => ix.data.length === 16),
    "instruction data is 16 bytes (8 disc + 8 offset)",
  );
  // Which account slots actually differ between two instructions of the same batch?
  const differing = batch.ixs[0].keys
    .map((k, i) => (k.pubkey.equals(batch.ixs[1].keys[i].pubkey) ? null : i))
    .filter((i) => i !== null);
  check(
    differing.length === 3 && differing.join(",") === "3,4,9",
    "exactly 3 per-entry accounts: entry(3), flower_record(4), computation_account(9)",
    `differing slots [${differing.join(",")}]`,
  );
  check(
    !batch.ixs.some((ix) => ix.programId.equals(ComputeBudgetProgram.programId)),
    "no ComputeBudget instruction is attached",
  );
  const granted = DEFAULT_CU_PER_IX * batch.ixs.length;
  check(
    granted >= MEASURED_SCORE_CU * batch.ixs.length,
    "implicit CU grant covers the measured worst case",
    `${granted} granted vs ${MEASURED_SCORE_CU * batch.ixs.length} needed`,
  );
  // Every computation offset must be distinct, or two instructions collide on one PDA.
  const offsets = new Set(batch.ixs.map((ix) => ix.keys[9].pubkey.toBase58()));
  check(
    offsets.size === SCORE_BATCH_SIZE,
    "each instruction gets its own computation account",
  );
}

console.log("\n=== 3. batching arithmetic ===");
for (const n of [1, 4, 5, 6, 13, 22, 50, 221]) {
  const entries = makeEntries(n);
  const { sent, outcome } = await capture(entries);
  const expected = Math.ceil(n / SCORE_BATCH_SIZE);
  const queuedKeys = new Set(
    sent.flatMap((s) => s.ixs.map((ix) => ix.keys[3].pubkey.toBase58())),
  );
  const oversize = sent.filter((s) => s.size > PACKET_LIMIT).length;
  check(
    sent.length === expected && outcome.transactions === expected,
    `${String(n).padStart(3)} entries -> ${expected} transaction(s)`,
    `sent ${sent.length}, outcome ${outcome.transactions}, was ${n} before`,
  );
  check(queuedKeys.size === n && outcome.queued === n, `    all ${n} entries queued exactly once`);
  check(oversize === 0, `    no transaction exceeds ${PACKET_LIMIT} B`, `max ${Math.max(...sent.map((s) => s.size))} B`);
  check(scoreTransactionCount(n) === expected, `    scoreTransactionCount(${n}) === ${expected}`);
}

console.log("\n=== 4. fresh pre-batch read filters ineligible entries ===");
{
  // 13 entries: 3 already scored, 2 with a computation in flight. 8 are genuinely queueable.
  const entries = makeEntries(13, { scored: [0, 1, 2], queued: [3, 4] });
  const { sent, outcome } = await capture(entries);
  check(outcome.queued === 8, "only the 8 eligible entries were queued", `queued ${outcome.queued}`);
  check(sent.length === 2, "8 eligible -> 2 transactions", `${sent.length}`);
  const touched = new Set(sent.flatMap((s) => s.ixs.map((ix) => ix.keys[3].pubkey.toBase58())));
  const ineligible = entries.slice(0, 5).map((e) => e.publicKey.toBase58());
  check(
    ineligible.every((k) => !touched.has(k)),
    "no scored or in-flight entry appears in any instruction",
  );
}
{
  // The state that changes AFTER the initial listing but BEFORE the batch is built — the
  // exact race the pre-batch re-read exists for.
  const entries = makeEntries(SCORE_BATCH_SIZE);
  let flipped = false;
  const byKey = new Map(entries.map((e) => [e.publicKey.toBase58(), e]));
  const racing = new Proxy(stubProgram(entries), {
    get(t, p, r) {
      if (p === "account") {
        return {
          competitionEntry: {
            all: async () => entries,
            fetchMultiple: async (keys) => {
              if (!flipped) {
                // Someone else scored entry 2 in the gap.
                entries[2].account.scored = true;
                flipped = true;
              }
              return keys.map((k) => byKey.get(k.toBase58())?.account ?? null);
            },
          },
        };
      }
      return Reflect.get(t, p, r);
    },
  });
  const sent = [];
  const outcome = await runScoring(
    { program: racing, authority: authority.publicKey, submit: async (tx) => (sent.push(tx), "sig") },
    1,
    () => {},
  );
  check(
    sent.length === 1 && sent[0].instructions.length === SCORE_BATCH_SIZE - 1,
    "an entry scored between listing and batching is dropped, not sent",
    `${sent[0]?.instructions.length} instructions`,
  );
  check(outcome.skipped === 1, "the dropped entry is reported as skipped", `skipped ${outcome.skipped}`);
}

console.log("\n=== 5. split-retry isolates a bad entry ===");
{
  const entries = makeEntries(SCORE_BATCH_SIZE);
  const bad = entries[SCORE_BATCH_SIZE - 2].publicKey.toBase58();
  // Any transaction containing the bad entry reverts, exactly as the chain would revert it.
  const fail = (record) =>
    record.ixs.some((ix) => ix.keys[3].pubkey.toBase58() === bad)
      ? new TxError("failed", "custom program error: 0x1778")
      : null;
  const { sent, outcome } = await capture(entries, { fail });
  const landed = new Set(
    sent
      .filter((s) => !s.ixs.some((ix) => ix.keys[3].pubkey.toBase58() === bad))
      .flatMap((s) => s.ixs.map((ix) => ix.keys[3].pubkey.toBase58())),
  );
  const good = SCORE_BATCH_SIZE - 1;
  check(outcome.queued === good, `the ${good} good entries still got queued`, `queued ${outcome.queued}`);
  check(landed.size === good && !landed.has(bad), "the bad entry is excluded from every landed tx");
  check(
    outcome.failed.length === 1 && outcome.failed[0].entry === bad,
    "the bad entry is reported individually",
    JSON.stringify(outcome.failed.map((f) => f.reason)),
  );
  // Splitting is a RECOVERY path, not a cheaper one: halving around one bad entry costs up to
  // k + ceil(log2 k) approvals, which for k=4 is 5 — one more than sending them individually.
  const bound = SCORE_BATCH_SIZE + Math.ceil(Math.log2(SCORE_BATCH_SIZE));
  check(
    sent.length <= bound,
    `splitting stays within the k + ceil(log2 k) = ${bound} approval bound`,
    `${sent.length} approvals for ${SCORE_BATCH_SIZE} entries`,
  );
  // The halving is real: 5 -> 3 + 2 -> ... down to a single entry.
  const sizesTried = sent.map((s) => s.ixs.length);
  check(sizesTried.includes(1), "recursion reaches a single-entry transaction", `tried ${sizesTried.join(",")}`);
}
{
  // A systemic failure (paused game, wrong signer) fails EVERY entry identically. Without the
  // consecutive-failure brake the split path would patiently walk all 50 asking for one
  // doomed approval each.
  let thrown = null;
  let attempts = 0;
  try {
    await capture(makeEntries(50), {
      fail: () => {
        attempts += 1;
        return new TxError("failed", "custom program error: 0x1773 (GamePaused)");
      },
    });
  } catch (e) {
    thrown = e;
  }
  check(thrown instanceof TxError, "a systemic failure aborts the run", thrown?.message?.slice(0, 60));
  check(attempts < 20, "it gives up early instead of asking 50 times", `${attempts} approvals attempted`);
}

console.log("\n=== 6. non-chain failures abort instead of splitting ===");
for (const kind of ["rejected", "network", "insufficient"]) {
  let attempts = 0;
  let thrown = null;
  try {
    await capture(makeEntries(SCORE_BATCH_SIZE), {
      fail: () => {
        attempts += 1;
        return new TxError(kind, `simulated ${kind}`);
      },
    });
  } catch (e) {
    thrown = e;
  }
  check(
    thrown instanceof TxError && thrown.kind === kind && attempts === 1,
    `"${kind}" aborts after ONE prompt (no split)`,
    `${attempts} prompt(s)`,
  );
}

console.log("\n=== 7. reveal queue still fits with its compute-unit limit ===");
{
  const round = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), Buffer.alloc(8)],
    new PublicKey(idl.address),
  )[0];
  const bracket = PublicKey.findProgramAddressSync(
    [Buffer.from("bracket"), round.toBuffer()],
    new PublicKey(idl.address),
  )[0];
  const result = PublicKey.findProgramAddressSync(
    [Buffer.from("shardres"), round.toBuffer(), Buffer.from([0])],
    new PublicKey(idl.address),
  )[0];
  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    new PublicKey(idl.address),
  )[0];
  const offset = new anchor.BN(Array.from(crypto.getRandomValues(new Uint8Array(8))));
  // MAX_SHARD_SIZE entries — the largest shard the planner can produce.
  const entries = Array.from({ length: 13 }, () => ({
    pubkey: Keypair.generate().publicKey,
    isWritable: false,
    isSigner: false,
  }));
  const bare = await realProgram.methods
    .queueShardReveal(offset, 0)
    .accountsPartial({
      authority: authority.publicKey,
      config,
      round,
      bracket,
      result,
      ...arciumAccountsFor("reveal_top3_v3", offset),
    })
    .remainingAccounts(entries)
    .transaction();
  const before = wireSize(bare);
  const after = wireSize(withComputeUnitLimit(bare, REVEAL_CU_LIMIT));
  check(after <= PACKET_LIMIT, `13-entry shard queue still fits`, `${before} -> ${after} B (limit ${PACKET_LIMIT})`);
  check(REVEAL_CU_LIMIT > 158_914, "the limit exceeds the measured 158,914 CU worst case", `${REVEAL_CU_LIMIT}`);
  check(
    withComputeUnitLimit(bare, REVEAL_CU_LIMIT).instructions[0].programId.equals(
      ComputeBudgetProgram.programId,
    ),
    "the compute-unit limit is the FIRST instruction",
  );
  check(bare.instructions.length === 1, "withComputeUnitLimit does not mutate its input");
}

console.log(
  `\n${failures === 0 ? "PASS" : "FAIL"} — ${checks - failures}/${checks} checks passed\n`,
);
process.exit(failures === 0 ? 0 : 1);
