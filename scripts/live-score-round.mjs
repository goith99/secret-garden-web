/**
 * LIVE run of the batched scorer against devnet, driving the REAL `runScoring` from
 * src/program/scoring.ts — the same module the Operator Panel runs in the browser.
 *
 * The only substitution is the signer: `submit` signs with the operator's local keypair and
 * sends over HTTP instead of opening a wallet popup, which is exactly what the panel's
 * `sendAndConfirm` choke point does once the wallet has signed. Everything the batching design
 * depends on — instruction building, the pre-batch fresh read, the 5-per-transaction packing,
 * the split-retry — is production code.
 *
 * It records every signature it sends, then reads the CONSUMED COMPUTE UNITS back off-chain,
 * because the whole design rests on a claim about compute that had only ever been inferred.
 *
 * NOT part of the app. Deliberately kept as a script: it signs real transactions.
 *
 *   set -a; source ../secret-garden/.env; set +a
 *   node --import ./scripts/ts-imports.mjs scripts/live-score-round.mjs <roundId>
 */
import * as anchor from "@anchor-lang/core";
import { readFileSync } from "fs";
import { homedir } from "os";
import { runScoring, SCORE_BATCH_SIZE, scoreTransactionCount } from "../src/program/scoring.ts";
import { classifyError } from "../src/program/errors.ts";
import { roundPda } from "../src/program/accounts.ts";

const { Keypair, Connection, PublicKey } = anchor.web3;

const ROUND_ID = Number(process.argv[2]);
if (!Number.isInteger(ROUND_ID) || ROUND_ID <= 0) {
  console.error("usage: live-score-round.mjs <roundId>");
  process.exit(1);
}

const RPC = process.env.HELIUS_RPC_URL;
if (!RPC) {
  console.error("HELIUS_RPC_URL not set — `set -a; source ../secret-garden/.env; set +a`");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const operator = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
);
// Transactions go through Helius; getProgramAccounts (used by `.all()`) does not, on the free
// tier — the same split scripts/operator.ts uses.
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
// Reads go over the public RPC (getProgramAccounts); sends go over Helius via `submit`.
const program = new anchor.Program(
  idl,
  new anchor.AnchorProvider(publicConn, wallet, { commitment: "confirmed" }),
);

/** HTTP send + confirm, matching the proven devnet pattern (this Helius endpoint has no WS). */
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
      console.log(`    → sending ${tx.instructions.length}-instruction tx (${raw.length} bytes)`);
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
      const err = classifyError(e);
      // A blockhash that aged out between build and send is a transport hiccup, not a revert.
      if (attempt < 5 && /blockhash not found|block height exceeded/i.test(String(e.message))) {
        await sleep(1500);
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

const round = roundPda(ROUND_ID);
const before = await program.account.competitionRound.fetch(round);
const entriesBefore = await program.account.competitionEntry.all([
  { memcmp: { offset: 8, bytes: round.toBase58() } },
]);
const unscored = entriesBefore.filter((e) => !e.account.scored && !e.account.scoreQueued).length;

console.log(`\n=== round ${ROUND_ID} ===`);
console.log(`  status        : ${["OPEN", "CLOSED", "FINALIZED"][before.status]}`);
console.log(`  entries       : ${before.participantCount}`);
console.log(`  scored        : ${before.scoredCount}`);
console.log(`  queueable now : ${unscored}`);
console.log(`  batch size    : ${SCORE_BATCH_SIZE}`);
console.log(`  PREDICTION    : ${scoreTransactionCount(unscored)} transaction(s)\n`);

const t0 = Date.now();
const outcome = await runScoring({ program, authority: operator.publicKey, submit }, ROUND_ID, (p) =>
  console.log(`  [${p.step}/${p.totalSteps}] ${p.label}`),
);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n=== outcome (${elapsed}s) ===`);
console.log(`  queued       : ${outcome.queued}`);
console.log(`  skipped      : ${outcome.skipped}`);
console.log(`  failed       : ${outcome.failed.length}`);
outcome.failed.forEach((f) => console.log(`     ${f.entry}: ${f.reason}`));
console.log(`  transactions : ${outcome.transactions}`);

// ---- the number the whole design rested on -------------------------------------------
console.log(`\n=== observed compute units ===`);
for (const { sig, ixs, bytes } of signatures) {
  let tx = null;
  for (let k = 0; k < 20 && !tx; k++) {
    tx = await conn.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
    if (!tx) await sleep(1500);
  }
  const consumed = tx?.meta?.computeUnitsConsumed;
  const granted = 200_000 * ixs;
  const perIx = consumed ? Math.round(consumed / ixs) : null;
  console.log(
    `  ${ixs} ix, ${bytes} B — consumed ${consumed} of ${granted} granted ` +
      `(${perIx}/ix, ${consumed ? ((consumed / granted) * 100).toFixed(1) : "?"}% of budget)`,
  );
  const line = (tx?.meta?.logMessages ?? []).filter((l) => /consumed \d+ of \d+/.test(l));
  line.forEach((l) => console.log(`      ${l.replace(/^Program \S+ /, "")}`));
}

// ---- wait for the MPC callbacks ------------------------------------------------------
console.log(`\n=== waiting for scoring callbacks ===`);
const deadline = Date.now() + 420_000;
let last = -1;
while (Date.now() < deadline) {
  const r = await program.account.competitionRound.fetch(round);
  if (r.scoredCount !== last) {
    last = r.scoredCount;
    console.log(`  scored ${r.scoredCount}/${r.participantCount}`);
  }
  if (r.scoredCount === r.participantCount) {
    console.log(`\n✓ every entry of round ${ROUND_ID} is scored.`);
    process.exit(0);
  }
  await sleep(4000);
}
console.log(`\n✗ timed out with ${last}/${before.participantCount} scored.`);
process.exit(1);
