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

export async function fetchPlayerProfile(
  program: SecretGardenProgram,
  owner: PublicKey,
): Promise<GardenProfile | null> {
  const acc = await program.account.playerProfile.fetchNullable(profilePda(owner));
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

/** A hybrid (sealed genome) is one breeding result; build the Hybrid Journal from them. */
export function isHybrid(f: Flower): boolean {
  return f.genomeStatus === GenomeStatus.Encrypted || f.visualSpeciesId === 255;
}
