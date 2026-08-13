/**
 * LIVE bracket reveal against devnet, driving the REAL `runBracketReveal` from
 * src/program/reveal.ts — the same orchestration the Operator Panel runs, including the
 * newly added explicit compute-unit limit on every reveal queue.
 *
 * Same substitution as scripts/live-score-round.mjs: `submit` signs with the operator's local
 * keypair and sends over HTTP instead of opening a wallet popup. Planning, partitioning,
 * resumability and the queue/collect sequencing are production code.
 *
 * After the reveal it writes the round's results to Supabase — `round_results` plus one
 * `round_winners` row per rank — because that write lives in the BACKEND operator tooling
 * (scripts/operator.ts saveResultsToSupabase), not in the frontend, so a reveal driven from
 * here would otherwise leave the Daily Winners panel showing the previous round.
 *
 * It does NOT pay prizes: the treasury key is deliberately not available here.
 *
 * NOT part of the app. Deliberately kept as a script: it signs real transactions.
 *
 *   set -a; source ../secret-garden/.env; set +a
 *   node --import ./scripts/ts-imports.mjs scripts/live-reveal-round.mjs <roundId>
 */
import * as anchor from "@anchor-lang/core";
import { readFileSync } from "fs";
import { homedir } from "os";
import { runBracketReveal, inspectReveal } from "../src/program/reveal.ts";
import { classifyError } from "../src/program/errors.ts";
import { roundPda } from "../src/program/accounts.ts";

const { Keypair, Connection, PublicKey } = anchor.web3;

const ROUND_ID = Number(process.argv[2]);
if (!Number.isInteger(ROUND_ID) || ROUND_ID <= 0) {
  console.error("usage: live-reveal-round.mjs <roundId>");
  process.exit(1);
}
const RPC = process.env.HELIUS_RPC_URL;
if (!RPC) {
  console.error("HELIUS_RPC_URL not set");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const operator = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
);
const conn = new Connection(RPC, "confirmed");
const publicConn = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = {
  publicKey: operator.publicKey,
  signTransaction: async (t) => t,
  signAllTransactions: async (t) => t,
};
const idl = JSON.parse(
  readFileSync(new URL("../src/program/idl/secret_garden.json", import.meta.url)),
);
const program = new anchor.Program(
  idl,
  new anchor.AnchorProvider(publicConn, wallet, { commitment: "confirmed" }),
);

const signatures = [];
async function submit(tx) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const bh = await conn.getLatestBlockhash({ commitment: "confirmed" });
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = operator.publicKey;
      tx.signatures = [];
      tx.sign(operator);
      const raw = tx.serialize();
      console.log(`    → ${tx.instructions.length}-instruction tx (${raw.length} bytes)`);
      const sig = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        const st = (await conn.getSignatureStatuses([sig])).value[0];
        if (st?.err) throw new Error(`on-chain failure: ${JSON.stringify(st.err)}`);
        if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") {
          signatures.push({ sig, ixs: tx.instructions.length, bytes: raw.length });
          console.log(`    ✓ ${sig}`);
          return sig;
        }
        await sleep(1000);
      }
      throw new Error("confirmation timed out");
    } catch (e) {
      if (attempt < 5 && /blockhash not found|block height exceeded/i.test(String(e.message))) {
        await sleep(1500);
        continue;
      }
      throw classifyError(e);
    }
  }
}

const ctx = { program, authority: operator.publicKey, submit };
const round = roundPda(ROUND_ID);

const plan = await inspectReveal(ctx, ROUND_ID);
console.log(`\n=== round ${ROUND_ID} reveal plan ===`);
console.log(`  entries      : ${plan.entryCount}`);
console.log(`  tier         : ${plan.tier}`);
console.log(`  shard sizes  : [${plan.sizes.join(", ")}]`);
console.log(`  summary      : ${plan.summary}`);
console.log(`  approvals    : ${plan.totalSignatures} (${plan.remainingSignatures} remaining)`);
if (plan.blocked) {
  console.error(`  BLOCKED: ${plan.blocked}`);
  process.exit(1);
}
if (plan.revealed) {
  console.log(`  already revealed — nothing to do`);
}

if (!plan.revealed) {
  console.log(`\n=== running ===`);
  await runBracketReveal(ctx, ROUND_ID, (p) =>
    console.log(`  [${p.step}/${p.totalSteps}] ${p.label}`),
  );
}

const r = await program.account.competitionRound.fetch(round);
console.log(`\n=== result ===`);
console.log(`  scoringRevealed: ${r.scoringRevealed}`);

console.log(`\n=== observed compute units ===`);
for (const { sig, ixs, bytes } of signatures) {
  let tx = null;
  for (let k = 0; k < 20 && !tx; k++) {
    tx = await conn.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    if (!tx) await sleep(1500);
  }
  const logs = tx?.meta?.logMessages ?? [];
  const requested = logs.some((l) => /ComputeBudget/.test(l));
  console.log(`  ${ixs} ix, ${bytes} B — consumed ${tx?.meta?.computeUnitsConsumed}${requested ? " (explicit CU limit present)" : ""}`);
  logs
    .filter((l) => /consumed \d+ of \d+/.test(l))
    .forEach((l) => console.log(`      ${l.replace(/^Program \S+ /, "")}`));
}

// ---- winners + Supabase --------------------------------------------------------------
const entries = await program.account.competitionEntry.all([
  { memcmp: { offset: 8, bytes: round.toBase58() } },
]);
const byEntry = new Map(entries.map((e) => [e.publicKey.toBase58(), e]));
const SPECIES_NAMES = [
  "Sunpetal Marigold", "Tideglass Bluebell", "Duskwisp Lavender",
  "Emberfern Rose", "Mossheart Mint", "Moonsilk Lily",
];
const flowerName = (v, i) =>
  v === 255 ? `Hybrid #${i}` : (SPECIES_NAMES[v] ?? `Flower #${i}`);
/** Shown for a winner whose FlowerRecord was closed after the round — see operator.ts. */
const CLOSED_FLOWER_NAME = "Retired Bloom";

const winnerRows = [];
console.log(`\n=== winners ===`);
for (const [i, entryPk] of [r.top1, r.top2, r.top3].entries()) {
  if (entryPk.equals(PublicKey.default)) continue;
  const e = byEntry.get(entryPk.toBase58());
  if (!e) {
    console.log(`  rank ${i + 1}: entry ${entryPk.toBase58()} not found among round entries`);
    continue;
  }
  // fetchNullable, NOT fetch: fetch() throws on a closed account, and an owner may close a
  // winning flower after the round to reclaim its rent. Same fallback operator.ts and the
  // set-round-results edge function use, so every writer stores the same value.
  const flower = await program.account.flowerRecord.fetchNullable(e.account.flowerRecord);
  const row = {
    round_number: ROUND_ID,
    rank: i + 1,
    wallet_address: e.account.player.toBase58(),
    flower_name: flower
      ? flowerName(flower.visualSpeciesId, flower.flowerIndex)
      : CLOSED_FLOWER_NAME,
    generation: flower ? flower.generation : 0,
  };
  winnerRows.push(row);
  console.log(`  rank ${row.rank}: ${row.wallet_address}  (${row.flower_name}, gen ${row.generation})`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.log(`\n⚠ SUPABASE_URL/SUPABASE_SERVICE_KEY not set — results NOT saved.`);
} else {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);
  const targetTraits = Array.from(r.targetTraits).slice(0, r.targetTraitCount);
  const resErr = (
    await supabase.from("round_results").insert({
      round_number: ROUND_ID,
      target_traits: JSON.stringify(targetTraits),
      total_entrants: r.participantCount,
      completed_at: new Date().toISOString(),
    })
  ).error;
  const winErr = winnerRows.length
    ? (await supabase.from("round_winners").insert(winnerRows)).error
    : null;
  if (resErr || winErr) console.log(`\n⚠ Supabase write error: ${(resErr ?? winErr).message}`);
  else console.log(`\n✓ Results saved to Supabase (round_results + ${winnerRows.length} round_winners).`);
}

console.log(`\nPRIZES NOT PAID — pay 0.5 SOL from the treasury to each wallet above.`);
process.exit(0);
