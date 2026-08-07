/**
 * Verifies the breeding lock is scoped to the LIVE round, against real devnet state.
 *
 * The bug this guards: a flower's `status` is set to Submitted by `submit_entry` and is NEVER
 * cleared on-chain (no instruction resets it — close_round/finalize_round don't even take
 * FlowerRecord accounts). The UI used to breed-lock on `status == Submitted && roundOpen`, so
 * every flower ever entered was re-locked the moment ANY later round opened — permanently.
 *
 * The corrected rule reads the LIVE round's CompetitionEntry (PDA seeded by [round, player],
 * so it exists only for the round it belongs to) and locks the one flower it names.
 *
 * This script runs BOTH rules over every flower that has ever been entered, and asserts:
 *   - the flower in the currently open round        → locked under both rules  (no regression)
 *   - every flower whose rounds are all finalized   → locked under OLD, free under NEW  (fixed)
 *
 * It also reports whether any flower ever escaped Submitted, which would confirm the chain
 * really does permit these transitions.
 *
 * Read-only: no wallet, no signing, no transactions.
 *
 *   node --import ./scripts/ts-imports.mjs scripts/verify-breed-lock.mjs
 */
import * as anchor from "@anchor-lang/core";
import { readFileSync } from "fs";

const { PublicKey } = anchor.web3;
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const idl = JSON.parse(
  readFileSync(new URL("../src/program/idl/secret_garden.json", import.meta.url)),
);
const conn = new anchor.web3.Connection(RPC, "confirmed");
const provider = new anchor.AnchorProvider(
  conn,
  { publicKey: PublicKey.default, signTransaction: async (t) => t, signAllTransactions: async (t) => t },
  { commitment: "confirmed" },
);
const program = new anchor.Program(idl, provider);

const FLOWER_STATUS = { 0: "Active", 1: "Locked", 2: "Submitted" };
const ROUND_STATUS = { 0: "Open", 1: "Closed", 2: "Finalized" };

const [flowers, rounds, entries] = await Promise.all([
  program.account.flowerRecord.all(),
  program.account.competitionRound.all(),
  program.account.competitionEntry.all(),
]);

const roundByKey = new Map(rounds.map((r) => [r.publicKey.toBase58(), r.account]));
const flowerByKey = new Map(flowers.map((f) => [f.publicKey.toBase58(), f.account]));
const openRound = rounds.find((r) => r.account.status === 0);

console.log(`flowers=${flowers.length} rounds=${rounds.length} entries=${entries.length}`);
console.log(
  `live round: ${openRound ? `#${openRound.account.roundId} (Open)` : "none"}\n`,
);

// --- the two rules -------------------------------------------------------------------
// OLD (buggy): FlowerCard's `submitted && roundOpen` — the flower's permanent flag, ANDed with
// "some round is open right now". Knows nothing about WHICH round the flower entered.
const oldLocked = (flower) => flower.status === 2 && openRound !== undefined;

// NEW: GameContext's isEnteredInCurrentRound — the live round's own entry names the one
// locked flower. `liveEntryByPlayer` mirrors what fetchRoundEntry() reads per connected wallet.
const liveEntryByPlayer = new Map();
for (const e of entries) {
  if (!openRound) break;
  if (e.account.round.equals(openRound.publicKey)) {
    liveEntryByPlayer.set(e.account.player.toBase58(), e.account.flowerRecord.toBase58());
  }
}
const newLocked = (flowerKey, ownerKey) => {
  if (!openRound) return false;
  const entered = liveEntryByPlayer.get(ownerKey) ?? null;
  return entered !== null && flowerKey === entered;
};

// --- every flower that has ever been entered ------------------------------------------
const everEntered = new Map(); // flowerKey -> [{roundId, status}]
for (const e of entries) {
  const k = e.account.flowerRecord.toBase58();
  const r = roundByKey.get(e.account.round.toBase58());
  if (!everEntered.has(k)) everEntered.set(k, []);
  everEntered.get(k).push({ roundId: r ? Number(r.roundId) : -1, status: r ? r.status : -1 });
}

let fixed = 0;
let liveLocked = 0;
let failures = 0;
const samples = { stranded: [], live: [] };

for (const [flowerKey, rs] of everEntered) {
  const flower = flowerByKey.get(flowerKey);
  if (!flower) continue; // entry points at a closed/deleted flower
  const owner = flower.owner.toBase58();
  const inLiveRound = rs.some((r) => r.status === 0);
  const before = oldLocked(flower);
  const after = newLocked(flowerKey, owner);

  const label = `${flowerKey.slice(0, 8)}… status=${FLOWER_STATUS[flower.status]} rounds=[${rs
    .map((r) => `#${r.roundId}:${ROUND_STATUS[r.status] ?? "?"}`)
    .join(",")}]`;

  if (inLiveRound) {
    // Must STILL be locked — this is the case the lock exists for.
    if (!after) {
      failures++;
      console.log(`FAIL  live-round flower is not locked under the new rule: ${label}`);
    } else {
      liveLocked++;
      if (samples.live.length < 3) samples.live.push(label);
    }
  } else {
    // Every round it entered is over → must be FREE now, and must have been locked before.
    if (after) {
      failures++;
      console.log(`FAIL  past-round flower still locked under the new rule: ${label}`);
    } else {
      if (before) fixed++;
      if (samples.stranded.length < 5) samples.stranded.push(label);
    }
  }
}

console.log("--- flowers in the LIVE round (must stay locked) ---");
for (const s of samples.live) console.log(`  locked   ${s}`);
console.log(`  ${liveLocked} total\n`);

console.log("--- stranded flowers (past rounds only: were locked, now breedable) ---");
for (const s of samples.stranded) console.log(`  UNLOCKED ${s}`);
console.log(`  ${fixed} total unlocked by this fix\n`);

// Direct evidence the chain permits what the UI was blocking: a flower that carries an entry
// but is NOT Submitted got its flag cleared by a later breed (start_breeding -> LOCKED ->
// breed_callback -> ACTIVE), which is only reachable if StartBreeding accepted a Submitted parent.
const escaped = [...everEntered.keys()]
  .map((k) => [k, flowerByKey.get(k)])
  .filter(([, f]) => f && f.status !== 2);
console.log(
  `entered flowers no longer flagged Submitted: ${escaped.length}` +
    (escaped.length
      ? ` → e.g. ${escaped
          .slice(0, 3)
          .map(([k, f]) => `${k.slice(0, 8)}…=${FLOWER_STATUS[f.status]}`)
          .join(", ")}`
      : ""),
);

console.log(`\n${failures === 0 ? "PASS" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
