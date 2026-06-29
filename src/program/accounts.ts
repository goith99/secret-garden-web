/**
 * On-chain account reads + mapping to the UI types in src/types.ts (Stage 6C, read-only).
 *
 * PDAs are derived exactly as the program defines them (constants.rs seeds):
 *   config  = ["config"]
 *   profile = ["profile", owner]
 *   flower  = ["flower", owner, u32_le(index)]
 *   round   = ["round", u64_le(round_id)]
 *
 * Anchor decodes accounts with camelCase fields, BN for 64-bit ints and PublicKey for
 * pubkeys; the mappers below flatten those into the plain UI shapes components already use,
 * so no program/BN/PublicKey type ever reaches a component.
 */
import { BN, type IdlAccounts } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import type { SecretGardenProgram } from "./client";
import type { SecretGarden } from "./idl/secret_garden";
import idl from "./idl/secret_garden.json";
import {
  type Challenge,
  type Flower,
  type GenomeStatusCode,
  type FlowerStatusCode,
  type RoundStatusCode,
  GenomeStatus,
} from "../types";

export const PROGRAM_ID = new PublicKey(idl.address);
const DEFAULT_PUBKEY = PublicKey.default.toBase58(); // "111…111" — used for empty parents

/**
 * Current PlayerProfile account size: 8-byte discriminator + 65-byte struct (Stage 5D layout,
 * which appended `breeds_this_round` (u8) + `last_breed_round` (u32) = 5 bytes). A profile
 * created BEFORE that upgrade is exactly 5 bytes shorter (68), so Anchor's borsh decode would
 * RangeError trying to read the two missing fields — see fetchPlayerProfile / decodeLegacyProfile.
 */
export const PROFILE_ACCOUNT_LEN = 8 + 65;

type RawFlower = IdlAccounts<SecretGarden>["flowerRecord"];
type RawProfile = IdlAccounts<SecretGarden>["playerProfile"];
type RawConfig = IdlAccounts<SecretGarden>["gameConfig"];
type RawRound = IdlAccounts<SecretGarden>["competitionRound"];

/** Flattened GameConfig for the UI (no BN/PublicKey leakage). */
export interface GardenConfig {
  authority: string;
  paused: boolean;
  currentRound: number;
  starterCount: number;
}

/** Flattened PlayerProfile for the UI. */
export interface GardenProfile {
  owner: string;
  starterClaimed: boolean;
  totalFlowers: number;
  totalCrosses: number;
  nextFlowerIndex: number;
  totalExperiments: number;
  createdAt: number;
  /** `start_breeding` attempts used in the round identified by `lastBreedRound`. */
  breedsThisRound: number;
  /** The round the player last bred in; when it differs from the live round, breedsThisRound is stale. */
  lastBreedRound: number;
  /**
   * True when this is a pre-Stage-5D (68-byte) account that must be migrated before it can be
   * written by breed/submit. Drives the in-game "update your garden" notice (no auto-migration).
   */
  needsMigration: boolean;
}

// ---- seed helpers (Uint8Array, no Buffer dependency) ---------------------------------
const te = new TextEncoder();
function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
function u64le(n: number): Uint8Array {
  return Uint8Array.from(new BN(n).toArray("le", 8));
}

// ---- PDA derivation -------------------------------------------------------------------
export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([te.encode("config")], PROGRAM_ID)[0];
}
export function profilePda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [te.encode("profile"), owner.toBytes()],
    PROGRAM_ID,
  )[0];
}
export function flowerPda(owner: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [te.encode("flower"), owner.toBytes(), u32le(index)],
    PROGRAM_ID,
  )[0];
}
export function roundPda(roundId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [te.encode("round"), u64le(roundId)],
    PROGRAM_ID,
  )[0];
}
export function experimentPda(owner: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [te.encode("experiment"), owner.toBytes(), u32le(index)],
    PROGRAM_ID,
  )[0];
}
export function entryPda(round: PublicKey, player: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [te.encode("entry"), round.toBytes(), player.toBytes()],
    PROGRAM_ID,
  )[0];
}

// ---- mappers --------------------------------------------------------------------------
function mapConfig(c: RawConfig): GardenConfig {
  return {
    authority: c.authority.toBase58(),
    paused: c.paused,
    currentRound: Number(c.currentRound.toString()),
    starterCount: c.starterCount,
  };
}

function mapProfile(p: RawProfile): GardenProfile {
  return {
    owner: p.owner.toBase58(),
    starterClaimed: p.starterClaimed,
    totalFlowers: p.totalFlowers,
    totalCrosses: p.totalCrosses,
    nextFlowerIndex: p.nextFlowerIndex,
    totalExperiments: p.totalExperiments,
    createdAt: p.createdAt.toNumber(),
    breedsThisRound: p.breedsThisRound,
    lastBreedRound: p.lastBreedRound,
    needsMigration: false, // current layout
  };
}

function mapFlower(pda: PublicKey, f: RawFlower): Flower {
  const parentA = f.parentA.toBase58();
  const parentB = f.parentB.toBase58();
  return {
    id: pda.toBase58(),
    owner: f.owner.toBase58(),
    flowerIndex: f.flowerIndex,
    visualSpeciesId: f.visualSpeciesId,
    generation: f.generation,
    rarity: f.rarity,
    stability: f.stability,
    revealedTraitMask: f.revealedTraitMask >>> 0,
    genomeStatus: f.genomeStatus as GenomeStatusCode,
    status: f.status as FlowerStatusCode,
    parentA: parentA === DEFAULT_PUBKEY ? null : parentA,
    parentB: parentB === DEFAULT_PUBKEY ? null : parentB,
    createdAt: f.createdAt.toNumber(),
  };
}

function mapRound(r: RawRound): Challenge {
  return {
    roundId: Number(r.roundId.toString()),
    status: r.status as RoundStatusCode,
    startTime: r.startTime.toNumber(),
    endTime: r.endTime.toNumber(),
    maxParticipants: r.maxParticipants,
    participantCount: r.participantCount,
    targetTraits: Array.from(r.targetTraits).slice(0, r.targetTraitCount),
    targetTraitCount: r.targetTraitCount,
    scoringRevealed: r.scoringRevealed,
    scoredCount: r.scoredCount,
  };
}

// ---- fetchers (all return null on a missing account, never throw for that case) -------
export async function fetchGameConfig(
  program: SecretGardenProgram,
): Promise<GardenConfig | null> {
  const acc = await program.account.gameConfig.fetchNullable(configPda());
  return acc ? mapConfig(acc) : null;
}

/**
 * Decode a pre-Stage-5D (68-byte) PlayerProfile straight from raw bytes. The old layout has no
 * `breeds_this_round` / `last_breed_round`, so Anchor would RangeError reading past the buffer.
 * We read the fields the UI needs by fixed offset and default the two missing ones to 0 (a
 * background migrate_profile grows such accounts to the current layout — see useGardenActions).
 *
 * Old struct (after the 8-byte discriminator): owner[32] starter_claimed[1] total_flowers(u16)
 * total_crosses(u16) daily_attempts[1] final_submissions[1] created_at(i64)
 * active_experiment_count(u32) total_experiments(u32) next_flower_index(u32) bump[1] = 60 bytes.
 */
function decodeLegacyProfile(data: Uint8Array): GardenProfile {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    owner: new PublicKey(data.subarray(8, 40)).toBase58(),
    starterClaimed: data[40] !== 0,
    totalFlowers: dv.getUint16(41, true),
    totalCrosses: dv.getUint16(43, true),
    // daily_attempts (45) + final_submissions (46) are not surfaced in the UI.
    createdAt: Number(dv.getBigInt64(47, true)),
    // active_experiment_count (55..59) is not surfaced in the UI.
    totalExperiments: dv.getUint32(59, true),
    nextFlowerIndex: dv.getUint32(63, true),
    // bump (67). The two Stage-5D fields don't exist yet → default to 0.
    breedsThisRound: 0,
    lastBreedRound: 0,
    needsMigration: true, // pre-5D account — must be migrated before breed/submit can write it
  };
}

export async function fetchPlayerProfile(
  program: SecretGardenProgram,
  owner: PublicKey,
): Promise<GardenProfile | null> {
  const pda = profilePda(owner);
  const info = await program.provider.connection.getAccountInfo(pda);
  if (!info) return null; // no profile yet — a new player (not an error)
  // Pre-5D accounts are 5 bytes short; decode the old layout by hand so Anchor never RangeErrors.
  if (info.data.length < PROFILE_ACCOUNT_LEN) {
    return decodeLegacyProfile(Uint8Array.from(info.data));
  }
  const acc = await program.account.playerProfile.fetchNullable(pda);
  return acc ? mapProfile(acc) : null;
}

/**
 * Reads every FlowerRecord this wallet has ever created by deriving PDAs for index
 * 0..upToIndex (profile.nextFlowerIndex) and dropping any that don't exist (reclaimed /
 * never minted). Uses fetchMultiple (batched getMultipleAccounts) — robust on public RPC.
 */
export async function fetchFlowerRecords(
  program: SecretGardenProgram,
  owner: PublicKey,
  upToIndex: number,
): Promise<Flower[]> {
  if (upToIndex <= 0) return [];
  const pdas = Array.from({ length: upToIndex }, (_, i) => flowerPda(owner, i));
  const out: Flower[] = [];
  const CHUNK = 100; // getMultipleAccounts limit
  for (let i = 0; i < pdas.length; i += CHUNK) {
    const slice = pdas.slice(i, i + CHUNK);
    const accs = await program.account.flowerRecord.fetchMultiple(slice);
    accs.forEach((acc, j) => {
      if (acc) out.push(mapFlower(slice[j], acc));
    });
  }
  return out;
}

/** Read a single FlowerRecord by owner + index (e.g. a freshly-bred offspring). */
export async function fetchFlower(
  program: SecretGardenProgram,
  owner: PublicKey,
  index: number,
): Promise<Flower | null> {
  const pda = flowerPda(owner, index);
  const acc = await program.account.flowerRecord.fetchNullable(pda);
  return acc ? mapFlower(pda, acc) : null;
}

export async function fetchActiveRound(
  program: SecretGardenProgram,
  currentRound: number,
): Promise<Challenge | null> {
  if (currentRound <= 0) return null; // no round has been opened yet
  const acc = await program.account.competitionRound.fetchNullable(
    roundPda(currentRound),
  );
  return acc ? mapRound(acc) : null;
}

/**
 * Whether this wallet has ALREADY submitted an entry in the given round. The CompetitionEntry
 * PDA is seeded by [round, player] (see entryPda / the submit_entry seeds in the IDL), so a
 * single wallet can hold at most one entry per round — its mere existence means "entered".
 * Returns false when no round is open (roundId ≤ 0) or the entry account doesn't exist yet,
 * so a fresh round (new round_id → new, non-existent PDA) reads as not-entered automatically.
 */
export async function fetchHasEnteredRound(
  program: SecretGardenProgram,
  owner: PublicKey,
  roundId: number,
): Promise<boolean> {
  if (roundId <= 0) return false; // no round open → nothing to enter
  const entry = entryPda(roundPda(roundId), owner);
  const acc = await program.account.competitionEntry.fetchNullable(entry);
  return acc !== null;
}

/** A hybrid (sealed genome) is one breeding result; build the Hybrid Journal from them. */
export function isHybrid(f: Flower): boolean {
  return f.genomeStatus === GenomeStatus.Encrypted || f.visualSpeciesId === 255;
}
