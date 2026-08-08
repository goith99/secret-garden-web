/**
 * Verifies the "Bring Back" (release_flower) path against the LIVE devnet program, using this
 * app's own query code — `fetchReleasableEntries` from src/program/accounts.ts — so the script
 * tests what the browser actually runs rather than a re-implementation of it.
 *
 * WHY THIS EXISTS: release_flower shipped in the 2026-08-08 deploy together with a tightened
 * start_breeding, whose parent guards went from `status != LOCKED` to `status == ACTIVE`. That
 * makes EVERY Submitted flower unbreedable on-chain (FlowerNotActive, 6011) — including one
 * whose round finished long ago, which the previous UI happily allowed into a pot. release_flower
 * is the only way back out, and only once the flower's round is Finalized.
 *
 * Read-only by default: it fetches state and SIMULATES, signing nothing. Simulation is the real
 * test here — every rule in this instruction is an account constraint, so a simulated success
 * proves the account list, PDA seeds and discriminator are all right.
 *
 *   node --import ./scripts/ts-imports.mjs scripts/verify-release-flower.mjs
 *
 * Pass --send to SIGN AND SEND a real release_flower for the chosen flower with the local
 * keypair (~/.config/solana/id.json, override with --keypair). This is irreversible: the entry
 * is spent one-shot and can never release again.
 *
 *   node --import ./scripts/ts-imports.mjs scripts/verify-release-flower.mjs --send --flower <pubkey>
 */
import * as anchor from "@anchor-lang/core";
import { readFileSync } from "fs";
import { homedir } from "os";
import { fetchReleasableEntries, entryPda, roundPda, configPda } from "../src/program/accounts.ts";

const { PublicKey, Connection, Keypair, Transaction } = anchor.web3;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const KEYPAIR = opt("keypair", `${homedir()}/.config/solana/id.json`);
const SEND = flag("send");

const idl = JSON.parse(
  readFileSync(new URL("../src/program/idl/secret_garden.json", import.meta.url)),
);
const signer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(KEYPAIR, "utf8"))),
);
const conn = new Connection(RPC, "confirmed");
const provider = new anchor.AnchorProvider(
  conn,
  {
    publicKey: signer.publicKey,
    signTransaction: async (t) => {
      t.partialSign(signer);
      return t;
    },
    signAllTransactions: async (ts) => ts.map((t) => (t.partialSign(signer), t)),
  },
  { commitment: "confirmed" },
);
const program = new anchor.Program(idl, provider);

const ROUND_STATUS = { 0: "Open", 1: "Closed", 2: "Finalized" };
const FLOWER_STATUS = { 0: "Active", 1: "Locked", 2: "Submitted" };
const ENTRY_STATUS = { 0: "Submitted", 1: "Released" };
const OWNER = signer.publicKey;

console.log(`rpc=${RPC}`);
console.log(`owner=${OWNER.toBase58()}  (${KEYPAIR})`);
console.log(`program=${program.programId.toBase58()}`);

// The deployed program must actually have the instruction the UI now calls. A stale local IDL
// would build a transaction with a discriminator no deployed handler answers to.
if (!idl.instructions.some((i) => i.name === "release_flower")) {
  console.log("FAIL  release_flower is missing from src/program/idl — refresh the IDL");
  process.exit(1);
}

const config = await program.account.gameConfig.fetch(configPda());
const currentRound = Number(config.currentRound.toString());
console.log(`currentRound=${currentRound} paused=${config.paused}\n`);

// ---- 1. the app's own query --------------------------------------------------------------
// This is the exact call useGardenData makes to decide which cards get a "Bring Back" button.
const releasable = await fetchReleasableEntries(program, OWNER, currentRound);
console.log(`fetchReleasableEntries → ${releasable.size} flower(s) this wallet can bring back`);
for (const [flowerId, e] of releasable) {
  console.log(`  ${flowerId}  from challenge #${e.roundId}`);
}
if (releasable.size === 0) {
  console.log("\nNothing to verify against for this wallet.");
  process.exit(0);
}

// ---- 2. cross-check the query against raw chain state -------------------------------------
// Two layers are being checked, and they are deliberately different:
//
//   fetchReleasableEntries  answers "which ENTRIES can still be spent" — round Finalized and
//                           entry unspent. It does not read FlowerRecords: the caller already
//                           holds them, and holds a fresher copy than the chain does right
//                           after a bring-back (the optimistic override would fight a re-read).
//   releasableRoundOf (UI)  adds the FLOWER's own rules on top — Submitted, and a hybrid.
//
// So a returned entry whose flower is Active or gone is correct at this layer and simply never
// reaches a button. Both layers are asserted separately below.
console.log("\n--- cross-check: every entry this wallet holds ---");
let queryFailures = 0;
const uiOffers = new Map(); // what the CARD would show: flowerId -> roundId
for (let id = 1; id <= currentRound; id++) {
  const entry = await program.account.competitionEntry.fetchNullable(
    entryPda(roundPda(id), OWNER),
  );
  if (!entry) continue;
  const round = await program.account.competitionRound.fetch(roundPda(id));
  const flowerId = entry.flowerRecord.toBase58();
  const flower = await program.account.flowerRecord.fetchNullable(entry.flowerRecord);
  // The entry-level constraints, restated independently of the code under test.
  const entryReleasable = round.status === 2 && entry.status === 0;
  const offered = releasable.has(flowerId);
  const verdict = offered === entryReleasable ? "ok  " : "FAIL";
  if (offered !== entryReleasable) queryFailures++;
  // What the UI does with it once the flower's own status is taken into account.
  const uiShows = offered && flower?.status === 2 && flower?.genomeStatus === 1;
  if (uiShows) uiOffers.set(flowerId, id);
  console.log(
    `  ${verdict} round #${id} ${ROUND_STATUS[round.status]} entry=${ENTRY_STATUS[entry.status]} ` +
      `flower=${flowerId.slice(0, 8)}…:${flower ? FLOWER_STATUS[flower.status] : "gone"} ` +
      `→ entry releasable=${entryReleasable}, card shows Bring Back=${uiShows}`,
  );
}
console.log(
  queryFailures === 0
    ? `  query matches chain state; ${uiOffers.size} card(s) would show Bring Back`
    : `  ${queryFailures} MISMATCH(ES)`,
);

// ---- 3. pick the flower to act on ---------------------------------------------------------
// Default to one the CARD would actually offer — i.e. apply the same flower-level rules
// releasableRoundOf applies, not just the entry-level ones.
const chosenId = opt("flower", [...uiOffers.keys()][0]);
const chosen = releasable.get(chosenId);
if (!chosen) {
  console.log(`\n--flower ${chosenId} is not releasable for this wallet`);
  process.exit(1);
}
const flowerKey = new PublicKey(chosenId);
const round = roundPda(chosen.roundId);
const entry = entryPda(round, OWNER);
const before = await program.account.flowerRecord.fetch(flowerKey);
console.log(
  `\ntarget: Hybrid #${before.flowerIndex} ${chosenId}\n` +
    `  round #${chosen.roundId}  flower.status=${FLOWER_STATUS[before.status]}  ` +
    `entry=${entry.toBase58()}`,
);

const buildRelease = (accounts) =>
  program.methods.releaseFlower().accountsPartial(accounts).transaction();

const RELEASE_ACCOUNTS = {
  owner: OWNER,
  config: configPda(),
  round,
  entry,
  flower: flowerKey,
};

/** Simulate a transaction and report the program error code, if any. */
async function simulate(label, tx) {
  tx.feePayer = OWNER;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const sim = await conn.simulateTransaction(tx);
  const err = sim.value.err;
  const logs = sim.value.logs ?? [];
  const custom = err && JSON.stringify(err).match(/"Custom":(\d+)/)?.[1];
  const named = logs.find((l) => l.includes("Error Code:"))?.match(/Error Code: (\w+)/)?.[1];
  const why = custom ? `${named ?? "?"} (${custom})` : JSON.stringify(err);
  console.log(`  ${label}: ${err ? `rejected — ${why}` : "ACCEPTED"}`);
  return { ok: !err, code: custom ? Number(custom) : null, named, logs };
}

console.log("\n--- simulations against the deployed program ---");
const happy = await simulate("release (finalized round)", await buildRelease(RELEASE_ACCOUNTS));

// Negative control: the SAME flower against the live round's entry PDA. Proves the finalized
// gate is real and that the UI is right to show nothing while a round is in progress.
if (currentRound !== chosen.roundId) {
  const liveRound = roundPda(currentRound);
  await simulate(
    `release against live round #${currentRound}`,
    await buildRelease({
      ...RELEASE_ACCOUNTS,
      round: liveRound,
      entry: entryPda(liveRound, OWNER),
    }),
  );
}

// Negative control: the reason "Bring Back" exists at all. close_flower requires Active, so a
// Submitted flower cannot even be deleted — it is genuinely stuck until released.
const closeBefore = await simulate(
  "close_flower while Submitted",
  await program.methods
    .closeFlower()
    .accountsPartial({
      owner: OWNER,
      config: configPda(),
      profile: PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("profile"), OWNER.toBytes()],
        program.programId,
      )[0],
      flower: flowerKey,
    })
    .transaction(),
);

if (!happy.ok) {
  console.log("\nFAIL  release_flower was rejected in simulation — not sending.");
  process.exit(1);
}
console.log(
  `\nrelease_flower SIMULATES CLEAN; close_flower on the same (Submitted) flower is refused` +
    `${closeBefore.named ? ` with ${closeBefore.named}` : ""} — which is the stuck state this fixes.`,
);

// ---- 4. optionally send it for real -------------------------------------------------------
if (!SEND) {
  console.log("\n(dry run — pass --send to sign and send for real)");
  process.exit(0);
}

console.log("\n--- SENDING release_flower for real ---");
const tx = await buildRelease(RELEASE_ACCOUNTS);
const sig = await provider.sendAndConfirm(tx, [signer], { commitment: "confirmed" });
console.log(`  signature: ${sig}`);
console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);

// ---- 5. read the chain back ---------------------------------------------------------------
const after = await program.account.flowerRecord.fetch(flowerKey);
const entryAfter = await program.account.competitionEntry.fetch(entry);
console.log("\n--- after ---");
console.log(
  `  flower.status: ${FLOWER_STATUS[before.status]} → ${FLOWER_STATUS[after.status]}` +
    `${after.status === 0 ? "  (breedable, closeable, submittable again)" : "  UNEXPECTED"}`,
);
console.log(
  `  entry.status:  ${ENTRY_STATUS[entryAfter.status]}` +
    `${entryAfter.status === 1 ? "  (spent — release is one-shot)" : "  UNEXPECTED"}`,
);

// The UI's own query must now stop offering this flower — that is what makes the button vanish.
const releasableAfter = await fetchReleasableEntries(program, OWNER, currentRound);
console.log(
  `  fetchReleasableEntries: ${releasable.size} → ${releasableAfter.size}` +
    `${releasableAfter.has(chosenId) ? "  FAIL (still offered)" : "  (this flower no longer offered)"}`,
);

// And the actions the flower was locked out of must now simulate clean.
console.log("\n--- the flower is usable again (simulated, nothing sent) ---");
await simulate(
  "close_flower now",
  await program.methods
    .closeFlower()
    .accountsPartial({
      owner: OWNER,
      config: configPda(),
      profile: PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("profile"), OWNER.toBytes()],
        program.programId,
      )[0],
      flower: flowerKey,
    })
    .transaction(),
);
await simulate("release again (must be refused)", await buildRelease(RELEASE_ACCOUNTS));
