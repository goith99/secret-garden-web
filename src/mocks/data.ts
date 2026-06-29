/**
 * MOCK DATA — Stage 6A only. Hand-authored values that mirror real on-chain account
 * shapes (see src/types.ts). In Stage 6C this whole module is replaced by a decode layer
 * that reads the program's accounts; components never learn the difference because they
 * depend on the TYPES, not on this file.
 *
 * Nothing here is real. No wallet, no RPC, no anchor.
 */
import {
  FlowerStatus,
  GenomeStatus,
  RoundStatus,
  ExperimentStatus,
  type Flower,
  type Challenge,
  type JournalEntry,
  type DailyWinner,
} from "../types";

const NOW = Math.floor(Date.now() / 1000);
const MOCK_OWNER = "8L9SoH5Kw4DLw32vUQY4H3PMgkRL9mm9MLDT5z2QEbTd";

function flower(
  flowerIndex: number,
  visualSpeciesId: number,
  generation: number,
  rarity: number,
  stability: number,
  genomeStatus: Flower["genomeStatus"] = GenomeStatus.Encrypted,
): Flower {
  return {
    id: `mock-flower-${flowerIndex}`,
    owner: MOCK_OWNER,
    flowerIndex,
    visualSpeciesId,
    generation,
    rarity,
    stability,
    revealedTraitMask: 0,
    genomeStatus,
    status: FlowerStatus.Active,
    parentA: null,
    parentB: null,
    createdAt: NOW - flowerIndex * 3600,
  };
}

/** ~10 placeholder flowers for the Flower Shelf: 6 starters + 4 hybrids. */
export const MOCK_FLOWERS: Flower[] = [
  flower(0, 0, 0, 0, 60, GenomeStatus.Revealed),
  flower(1, 1, 0, 0, 58, GenomeStatus.Revealed),
  flower(2, 2, 0, 1, 64, GenomeStatus.Revealed),
  flower(3, 3, 0, 0, 55, GenomeStatus.Revealed),
  flower(4, 4, 0, 1, 70, GenomeStatus.Revealed),
  flower(5, 5, 0, 0, 52, GenomeStatus.Revealed),
  flower(6, 255, 1, 2, 41, GenomeStatus.Encrypted),
  flower(7, 255, 2, 3, 38, GenomeStatus.Encrypted),
  flower(8, 255, 1, 2, 44, GenomeStatus.Encrypted),
  flower(9, 255, 3, 4, 29, GenomeStatus.Encrypted),
];

/**
 * The 6 starter flowers only (no hybrids). Used to populate the greenhouse for a DISCONNECTED
 * visitor so the night garden shows its starters normally while the Hybrid Collection stays
 * empty (it filters to hybrids). These are visual placeholders — real starters arrive on chain
 * once a wallet connects and claims them.
 */
export const MOCK_STARTERS: Flower[] = MOCK_FLOWERS.slice(0, 6);

/** Active daily challenge (CompetitionRound shape). targetTraits = trait ids 0..7. */
export const MOCK_CHALLENGE: Challenge = {
  roundId: 7,
  status: RoundStatus.Open,
  startTime: NOW - 3600 * 5,
  endTime: NOW + 3600 * 19,
  maxParticipants: 128,
  participantCount: 41,
  targetTraits: [0, 2, 7],
  targetTraitCount: 3,
  scoringRevealed: false,
  scoredCount: 0,
};

/** Hybrid Journal: past crossbreeds (Experiment + result shape). */
export const MOCK_JOURNAL: JournalEntry[] = [
  { id: "exp-204", createdAt: NOW - 3600 * 2, parentASpecies: 0, parentBSpecies: 2, status: ExperimentStatus.Completed, result: { species: 255, generation: 1, rarity: 2 } },
  { id: "exp-203", createdAt: NOW - 3600 * 6, parentASpecies: 1, parentBSpecies: 4, status: ExperimentStatus.Completed, result: { species: 255, generation: 1, rarity: 3 } },
  { id: "exp-202", createdAt: NOW - 3600 * 9, parentASpecies: 255, parentBSpecies: 2, status: ExperimentStatus.Completed, result: { species: 255, generation: 2, rarity: 4 } },
  { id: "exp-201", createdAt: NOW - 3600 * 13, parentASpecies: 3, parentBSpecies: 5, status: ExperimentStatus.Failed, result: null },
  { id: "exp-200", createdAt: NOW - 3600 * 20, parentASpecies: 0, parentBSpecies: 1, status: ExperimentStatus.Completed, result: { species: 255, generation: 1, rarity: 1 } },
  { id: "exp-199", createdAt: NOW - 3600 * 26, parentASpecies: 4, parentBSpecies: 5, status: ExperimentStatus.Completed, result: { species: 255, generation: 1, rarity: 2 } },
  { id: "exp-198", createdAt: NOW - 3600 * 31, parentASpecies: 2, parentBSpecies: 3, status: ExperimentStatus.Completed, result: { species: 255, generation: 1, rarity: 0 } },
];

/** Yesterday's revealed winners (from a finalized round's top1/top2/top3). */
export const MOCK_WINNERS: DailyWinner[] = [
  { rank: 1, flowerLabel: "Hybrid #214", playerShort: "8L9S…73w", rarity: 4, species: 255 },
  { rank: 2, flowerLabel: "Hybrid #198", playerShort: "BDYh…3Bw", rarity: 3, species: 255 },
  { rank: 3, flowerLabel: "Hybrid #205", playerShort: "Arc7…fdE", rarity: 3, species: 255 },
];

/** Environment dial option labels (Light / Water / Soil). */
export const ENVIRONMENT_OPTIONS = {
  light: ["Soft", "Bright", "Golden"],
  water: ["Misted", "Steady", "Soaked"],
  soil: ["Sandy", "Loam", "Rich"],
} as const;
