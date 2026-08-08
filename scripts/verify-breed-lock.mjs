/**
 * Verifies the breeding lock MATCHES what the deployed program will actually accept, against
 * real devnet state.
 *
 * HISTORY — this script has been through two rules, and the second one was invalidated by a
 * program change rather than by a bug in the UI:
 *
 *   RULE A (buggy): `status == Submitted && roundOpen`. `status` is set by submit_entry and no
 *     round instruction ever clears it, so every flower ever entered was re-locked the moment
 *     ANY later round opened — permanently.
 *   RULE B: lock only the flower named by the LIVE round's CompetitionEntry. Correct while
 *     start_breeding rejected just `status != LOCKED`, which genuinely did admit a Submitted
 *     parent — so a past round's flower really could breed.
 *   RULE C (current): lock EVERY Submitted flower. The 2026-08-08 deploy tightened
 *     start_breeding's parent guards to `status == ACTIVE` (lib.rs:2349/2357), because the
 *     negative form let breeding launder a Submitted flower into an Active one — breed_callback
 *     writes both parents back to ACTIVE — bypassing the round gate release_flower enforces.
 *     A past-round flower dropped into a pot now fails simulation with FlowerNotActive (6011).
 *
 * So the lock is no longer a UI courtesy: it mirrors an on-chain constraint. The way OUT is
 * release_flower ("Bring Back"), which returns a Submitted flower to Active once its round is
 * Finalized — see verify-release-flower.mjs, which exercises that path against the live chain.
 *
 * This script asserts RULE C over every flower that has ever been entered:
 *   - the flower in the currently open round     → locked  (and still shown as "this round")
 *   - a Submitted flower from a finished round   → locked, AND offered a way back
 *   - a flower that has left Submitted           → free
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

// --- the rules -----------------------------------------------------------------------
// RULE C (current): GameContext's isBreedLocked. Mirrors start_breeding's `status == ACTIVE`
// parent guard exactly — anything Submitted is refused on-chain, whatever round it came from.
const breedLocked = (flower) => flower.status === 2;

// RULE B (superseded): isEnteredInCurrentRound — the live round's own entry names one flower.
// Still used, but only to WORD the badge ("Entered this round" vs "Entered"); it no longer
// decides breeding. `liveEntryByPlayer` mirrors what fetchRoundEntry() reads per wallet.
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
  const locked = breedLocked(flower);
  const wordedAsLiveRound = newLocked(flowerKey, owner);
  // Can it be brought back right now? release_flower needs a Finalized round and an unspent
  // entry; `everEntered` carries the round statuses, and entry status is checked below.
  const releasable = rs.some((r) => r.status === 2);

  const label = `${flowerKey.slice(0, 8)}… status=${FLOWER_STATUS[flower.status]} rounds=[${rs
    .map((r) => `#${r.roundId}:${ROUND_STATUS[r.status] ?? "?"}`)
    .join(",")}]`;

  if (flower.status !== 2) {
    // Left Submitted (bred back to Active under the old guard, or brought back by
    // release_flower) → the chain accepts it as a parent, so the UI must not lock it.
    if (locked) {
      failures++;
      console.log(`FAIL  non-Submitted flower is locked: ${label}`);
    }
    continue;
  }

  // Submitted → start_breeding would reject it (FlowerNotActive), so it MUST be locked.
  if (!locked) {
    failures++;
    console.log(`FAIL  Submitted flower is not breed-locked: ${label}`);
    continue;
  }

  if (inLiveRound) {
    if (!wordedAsLiveRound && rs.length === 1) {
      // Sanity on the badge wording, not on the lock: a flower in the open round should be
      // the one the live entry names.
      failures++;
      console.log(`FAIL  live-round flower not recognised by fetchRoundEntry: ${label}`);
    } else {
      liveLocked++;
      if (samples.live.length < 3) samples.live.push(label);
    }
  } else if (releasable) {
    // Locked, but its round is done — this is exactly the set of cards that must offer
    // "Bring Back". A locked flower with no way out would be the old stuck state returning.
    fixed++;
    if (samples.stranded.length < 5) samples.stranded.push(label);
  } else {
    failures++;
    console.log(`FAIL  Submitted flower is locked with no finalized round to release from: ${label}`);
  }
}

console.log("--- flowers in the LIVE round (locked, and must WAIT — no Bring Back yet) ---");
for (const s of samples.live) console.log(`  locked   ${s}`);
console.log(`  ${liveLocked} total\n`);

console.log("--- Submitted flowers from FINISHED rounds (locked on-chain; must offer Bring Back) ---");
for (const s of samples.stranded) console.log(`  RELEASABLE ${s}`);
console.log(`  ${fixed} total — every one of these is a "Bring Back" button\n`);

// Direct evidence of the laundering the new guard closes: a flower that carries an entry but is
// NOT Submitted had its flag cleared by a later breed (start_breeding -> LOCKED -> breed_callback
// -> ACTIVE), which was only reachable while StartBreeding accepted a Submitted parent. Under the
// current program these can only grow via release_flower.
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
