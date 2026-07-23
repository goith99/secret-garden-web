/**
 * UI data model for Secret Garden Protocol.
 *
 * These shapes intentionally MIRROR the on-chain accounts in the program IDL
 * (secret_garden.json: FlowerRecord, CompetitionRound, Experiment, ...) using camelCase
 * field names and the same numeric status codes. Stage 6C will replace the mock data
 * SOURCE (src/mocks/*) with decoded on-chain accounts without changing these types or
 * any component props. Nothing here imports web3/anchor — that is Stage 6B+.
 *
 * Numeric code → player-facing label/colour mapping lives in src/lib/presentation.ts.
 */

// --- numeric status codes (mirror the program's constants.rs; confirmed against IDL u8s) ---
export const GenomeStatus = {
  Starter: 0, // GENOME_STATUS_STARTER — claimed starter, plaintext/known genome
  Encrypted: 1, // GENOME_STATUS_ENCRYPTED — bred hybrid, sealed genome
  Revealed: 2,
} as const;
export type GenomeStatusCode = (typeof GenomeStatus)[keyof typeof GenomeStatus];

export const FlowerStatus = {
  Active: 0, // FLOWER_STATUS_ACTIVE
  Breeding: 1,
  Submitted: 2,
} as const;
export type FlowerStatusCode = (typeof FlowerStatus)[keyof typeof FlowerStatus];

export const RoundStatus = {
  Open: 0,
  Closed: 1, // judging
  Finalized: 2, // winners revealed
} as const;
export type RoundStatusCode = (typeof RoundStatus)[keyof typeof RoundStatus];

export const ExperimentStatus = {
  Queued: 0,
  Failed: 1,
  Completed: 2, // EXPERIMENT_STATUS_COMPLETED
} as const;
export type ExperimentStatusCode = (typeof ExperimentStatus)[keyof typeof ExperimentStatus];

/** Mirror of FlowerRecord. `id` stands in for the account address (a PDA string in 6C). */
export interface Flower {
  id: string;
  owner: string;
  flowerIndex: number; // u32
  visualSpeciesId: number; // u8 — 0..5 = starters, 255 = hybrid
  generation: number; // u16
  rarity: number; // u8 — 0..4 rarity tier
  stability: number; // u8 — 0..100
  revealedTraitMask: number; // u32 bitmask of revealed trait slots
  genomeStatus: GenomeStatusCode;
  status: FlowerStatusCode;
  parentA: string | null; // pubkey | none
  parentB: string | null;
  createdAt: number; // unix seconds (i64 on-chain)
}

/** Mirror of CompetitionRound — the "Daily Challenge" the player breeds toward. */
export interface Challenge {
  roundId: number; // u64
  status: RoundStatusCode;
  startTime: number;
  endTime: number;
  maxParticipants: number; // u16
  participantCount: number; // u16
  targetTraits: number[]; // u8[4] — trait ids the judges reward
  targetTraitCount: number; // u8
  scoringRevealed: boolean;
  scoredCount: number;
}

/** Derived from Experiment (+ its result FlowerRecord) for the Hybrid Journal list. */
export interface JournalEntry {
  id: string;
  createdAt: number;
  parentASpecies: number; // visualSpeciesId of parent A
  parentBSpecies: number;
  status: ExperimentStatusCode;
  result: {
    species: number; // visualSpeciesId of the offspring (255 hybrid)
    generation: number;
    rarity: number;
  } | null; // null while still growing / on failure
}

/** Derived from CompetitionRound.top1/top2/top3 for the Daily Winners summary. */
export interface DailyWinner {
  rank: 1 | 2 | 3;
  flowerLabel: string; // e.g. "Hybrid #214"
  playerShort: string; // shortened wallet, e.g. "8L9S…73w"
  rarity: number;
  species: number;
}

/** Environment dials the player sets before crossbreeding (Light / Water / Soil). */
export type EnvironmentKind = "light" | "water" | "soil";
export interface Environment {
  light: number; // index into the option list (0..2)
  water: number;
  soil: number;
}

/**
 * Player-facing crossbreed flow. The string values are the EXACT approved labels — no
 * developer terms ever surface. The transition logic is MOCKED in Stage 6A
 * (src/game/useGameState.ts); real transitions arrive in Stage 6D.
 */
export const BreedPhase = {
  NeedTwo: "Select Two Flowers",
  Ready: "Crossbreed",
  Confirm: "Confirm in Wallet",
  Waiting: "Waiting in Greenhouse",
  Growing: "Growing",
  BloomReady: "Bloom Ready",
  Failed: "Bloom Failed. Try again.",
} as const;
export type BreedPhaseKey = keyof typeof BreedPhase;

export type PotId = "A" | "B";
export type MobileTab = "flowers" | "garden" | "journal";
