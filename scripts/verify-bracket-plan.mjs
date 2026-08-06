/**
 * Verifies the client-side bracket planner AND the reveal-status inspection against REAL
 * devnet history.
 *
 * The partition is the one part of the reveal the client owns: the program only checks it
 * (strictly ascending shard bounds, sizes summing to participant_count, every supplied entry
 * inside its shard's recorded range). A partition the program rejects fails the whole reveal,
 * and the failure mode is data-dependent — so the only convincing test is to re-derive the
 * partition for rounds that were ALREADY revealed on-chain and check we produce, byte for
 * byte, the layout the program accepted.
 *
 * It also proves the test is sensitive to the sort bug it exists to catch: for every round
 * that contains a pubkey with a leading zero byte (43-character base58), it re-runs the plan
 * with a base58-TEXT sort and asserts the result differs from what the chain accepted.
 *
 * Section 2 then runs the operator panel's own `inspectReveal()` — the function that decides
 * whether a reveal can start and how much of it is already done — over the same rounds, and
 * checks its verdict against what the chain independently says about each one.
 *
 * Read-only: no wallet, no signing, no transactions. The RevealContext's `submit` is a stub
 * that throws, so a regression that made inspection try to sign would fail loudly here.
 *
 * Run: node scripts/verify-bracket-plan.mjs
 *      SOLANA_RPC_URL=https://… node scripts/verify-bracket-plan.mjs
 *
 * NOTE: needs an RPC that serves getProgramAccounts (the public devnet endpoint does, with
 * rate-limit retries; Alchemy's free tier refuses it).
 */
import * as anchor from "@anchor-lang/core";
import { readFileSync } from "fs";
import {
  planBracket,
  planShardSizes,
  expectedTier1Winners,
  signatureCount,
  describePlan,
  MAX_SHARD_SIZE,
} from "../src/program/bracket.ts";
import { inspectReveal } from "../src/program/reveal.ts";

const { PublicKey } = anchor.web3;
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const idl = JSON.parse(readFileSync(new URL("../src/program/idl/secret_garden.json", import.meta.url)));
const conn = new anchor.web3.Connection(RPC, "confirmed");
const readOnlyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async (t) => t,
  signAllTransactions: async (t) => t,
};
const provider = new anchor.AnchorProvider(conn, readOnlyWallet, { commitment: "confirmed" });
const program = new anchor.Program(idl, provider);
const PID = program.programId;

const te = new TextEncoder();
const u64le = (n) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), true);
  return b;
};
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, PID)[0];
const configPda = () => pda([te.encode("config")]);
const roundPda = (id) => pda([te.encode("round"), u64le(id)]);
const bracketPda = (r) => pda([te.encode("bracket"), r.toBytes()]);
const tier1Pda = (r) => pda([te.encode("tier1"), r.toBytes()]);

let checks = 0;
let failures = 0;
const ok = (cond, label) => {
  checks += 1;
  if (!cond) {
    failures += 1;
    console.log(`      FAIL  ${label}`);
  }
  return cond;
};

console.log(`bracket planner verification against ${RPC}`);
console.log(`program ${PID.toBase58()}\n`);

const config = await program.account.gameConfig.fetch(configPda());
const currentRound = Number(config.currentRound.toString());

let covered = 0;
/** Rounds where a base58-text sort would have produced a partition the program rejects. */
let divergentRounds = 0;
for (let id = 1; id <= currentRound; id++) {
  const round = roundPda(id);
  const r = await program.account.competitionRound.fetchNullable(round);
  if (!r) continue;

  const bracket = await program.account.bracketState.fetchNullable(bracketPda(round));
  let tier1 = null;
  try {
    tier1 = await program.account.tier1State.fetchNullable(tier1Pda(round));
  } catch {
    tier1 = null; // stale layout — nothing to compare against
  }
  // Only rounds the program actually accepted a partition for are evidence.
  if (!bracket && !tier1) continue;

  const accs = await program.account.competitionEntry.all([
    { memcmp: { offset: 8, bytes: round.toBase58() } },
  ]);
  const keys = accs.map((a) => a.publicKey);
  if (keys.length !== r.participantCount) {
    console.log(`round ${id}: skipped — ${keys.length} entry accounts vs participantCount ${r.participantCount}`);
    continue;
  }

  covered += 1;
  const plan = planBracket(keys);
  const twoTier = !!tier1;
  const onChain = twoTier ? tier1 : bracket;
  const label = twoTier ? "tier-1" : "shard";

  console.log(`round ${id}: ${r.participantCount} entries, ${twoTier ? "TWO-TIER" : "single-tier"}`);
  console.log(`  plan     ${describePlan(plan)}`);
  console.log(`  approvals ${signatureCount(plan)}`);

  ok(plan.tier === (twoTier ? "two" : "single"), `tier: planned ${plan.tier}, chain ran ${twoTier ? "two" : "single"}`);
  ok(
    plan.shards.length === onChain.shardCount,
    `${label} count: planned ${plan.shards.length}, on-chain ${onChain.shardCount}`,
  );

  const chainSizes = Array.from(onChain.shardSizes.slice(0, onChain.shardCount));
  ok(
    JSON.stringify(plan.sizes) === JSON.stringify(chainSizes),
    `${label} sizes: planned [${plan.sizes}], on-chain [${chainSizes}]`,
  );

  const chainBounds = onChain.shardBounds.slice(0, onChain.shardCount);
  const boundsMatch = plan.shards.every((s, i) => s.bound.equals(chainBounds[i]));
  ok(boundsMatch, `${label} bounds differ from the accepted partition`);
  if (boundsMatch) console.log(`  bounds   match all ${chainBounds.length} on-chain values`);

  // Two-tier: the semifinal sizes we quote up front must equal what promote_tier1 computed.
  if (twoTier && tier1.promoted !== 0 && bracket) {
    const chainSemis = Array.from(bracket.shardSizes.slice(0, bracket.shardCount));
    ok(
      JSON.stringify(plan.semifinalSizes) === JSON.stringify(chainSemis),
      `semifinal sizes: planned [${plan.semifinalSizes}], on-chain [${chainSemis}]`,
    );
    ok(
      expectedTier1Winners(plan.sizes) === tier1.winnerCount,
      `tier-1 winners: predicted ${expectedTier1Winners(plan.sizes)}, on-chain ${tier1.winnerCount}`,
    );
    console.log(`  semis    [${chainSemis}] from ${tier1.winnerCount} tier-1 winners — matches`);
  }

  // Sensitivity: would a base58-TEXT sort have produced this same partition?
  //
  // Reported per round, asserted only over the corpus (see `divergentRounds` below). A short
  // (43-character) key is what makes divergence POSSIBLE, not certain: base58 renders small
  // values in 43 digits, and whether that reorders anything depends on the leading digit —
  // a key starting "1…" sorts first either way, so round 13 legitimately coincides. What
  // must hold is that at least one round in the history diverges, or this whole verification
  // would pass just as happily against the buggy text sort.
  const shortKeys = keys.filter((k) => k.toBase58().length < 44);
  const textSorted = [...keys].sort((a, b) =>
    a.toBase58() < b.toBase58() ? -1 : a.toBase58() > b.toBase58() ? 1 : 0,
  );
  const textSizes = planShardSizes(textSorted.length, MAX_SHARD_SIZE);
  const textBounds = [];
  let cursor = 0;
  for (const s of textSizes) {
    textBounds.push(textSorted[cursor]);
    cursor += s;
  }
  const diverges = !textBounds.every((b, i) => i < chainBounds.length && b.equals(chainBounds[i]));
  if (diverges) {
    divergentRounds += 1;
    console.log(
      `  bug-check base58-text sort WOULD have been rejected here` +
        (shortKeys.length ? ` (short key ${shortKeys[0].toBase58()})` : ""),
    );
  } else {
    console.log(`  bug-check base58-text sort happens to coincide on this round`);
  }
  console.log("");
}

// The corpus must actually be able to catch the sort bug, or every check above would pass
// against a base58-text sort too and this script would be proving nothing.
ok(
  divergentRounds > 0,
  "no round in this history distinguishes a byte-wise sort from a base58-text one",
);
console.log(
  `${divergentRounds} of ${covered} rounds diverge under a base58-text sort` +
    ` (those are the ones the byte-wise sort is required for)\n`,
);

// A couple of pure arithmetic invariants, independent of chain history.
ok(JSON.stringify(planShardSizes(53, 13)) === JSON.stringify([11, 11, 11, 10, 10]), "planShardSizes(53)");
ok(JSON.stringify(planShardSizes(13, 13)) === JSON.stringify([13]), "planShardSizes(13)");
ok(JSON.stringify(planShardSizes(14, 13)) === JSON.stringify([7, 7]), "planShardSizes(14)");
ok(JSON.stringify(planShardSizes(221, 13)) === JSON.stringify(Array(17).fill(13)), "planShardSizes(221)");
ok(planShardSizes(52, 13).length === 4, "52 entries stay inside the single tier");

// ---- section 2: what the operator panel would say about each round --------------------
console.log(`\n--- reveal-status inspection (what the panel shows when it opens) ---\n`);

const ctx = {
  program,
  authority: PublicKey.default,
  submit: () => {
    throw new Error("inspectReveal must never send a transaction");
  },
};

for (let id = 1; id <= currentRound; id++) {
  const round = roundPda(id);
  const r = await program.account.competitionRound.fetchNullable(round);
  if (!r) continue;

  const s = await inspectReveal(ctx, id);
  const verdict = s.revealed
    ? "already revealed"
    : s.blocked
      ? `blocked — ${s.blocked}`
      : `${s.remainingSignatures}/${s.totalSignatures} approvals left${s.inProgress ? ", RESUMABLE" : ""}`;
  console.log(`round ${id}: ${verdict}`);
  if (!s.revealed && !s.blocked) console.log(`  ${s.summary}`);
  for (const line of s.done) console.log(`  done: ${line}`);

  // The panel's verdict must agree with what the chain says, independently derived.
  if (r.scoringRevealed) {
    ok(s.revealed && !s.blocked, `round ${id}: revealed round must report revealed`);
  } else if (r.participantCount === 0 || r.status === 0 || r.scoredCount !== r.participantCount) {
    // No entries, still open, or not fully scored — all must be refused with a reason.
    ok(!!s.blocked, `round ${id}: unrevealable round must be blocked with a reason`);
  } else {
    ok(!s.blocked, `round ${id}: ready round must not be blocked (${s.blocked})`);
    ok(
      s.sizes.reduce((a, b) => a + b, 0) === r.participantCount,
      `round ${id}: planned shards must cover all ${r.participantCount} entries`,
    );
    ok(s.remainingSignatures > 0, `round ${id}: an unrevealed round must have work left`);
  }
}

console.log(`\n${checks - failures}/${checks} checks passed across ${covered} on-chain round(s)`);
if (failures > 0) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
