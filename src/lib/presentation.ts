/**
 * Presentation maps: turn the on-chain numeric codes (visualSpeciesId, rarity, status…)
 * into player-facing labels and sprite colours. Kept separate from the raw types so the
 * decode layer is swappable in Stage 6C. ALL strings here are player vocabulary — no
 * developer terms (no MXE / MPC / PDA / ciphertext / callback / etc.).
 */
import {
  FlowerStatus,
  GenomeStatus,
  RoundStatus,
  ExperimentStatus,
  type FlowerStatusCode,
  type GenomeStatusCode,
  type RoundStatusCode,
  type ExperimentStatusCode,
} from "../types";

export interface SpeciesSkin {
  name: string;
  petal: string; // sprite petal colour
  center: string; // sprite center colour
  leaf: string; // sprite leaf colour
  hybrid?: boolean;
}

/** visualSpeciesId → skin. 0..5 are the starter species; 255 is a generated hybrid. */
export const SPECIES: Record<number, SpeciesSkin> = {
  0: { name: "Sunpetal Marigold", petal: "#e6c25c", center: "#b8862f", leaf: "#4f9266" },
  1: { name: "Tideglass Bluebell", petal: "#6cc7cf", center: "#2e7d86", leaf: "#4f9266" },
  2: { name: "Duskwisp Lavender", petal: "#c1aef0", center: "#7d63bd", leaf: "#4f9266" },
  3: { name: "Emberfern Rose", petal: "#e69ab0", center: "#b65574", leaf: "#4f9266" },
  4: { name: "Mossheart Mint", petal: "#8fd6a6", center: "#3f8a5c", leaf: "#3f8a5c" },
  5: { name: "Moonsilk Lily", petal: "#f5efda", center: "#cbb98a", leaf: "#4f9266" },
  255: { name: "Unknown Hybrid", petal: "#c1aef0", center: "#e6c25c", leaf: "#6cc7cf", hybrid: true },
};

export function speciesOf(id: number): SpeciesSkin {
  return SPECIES[id] ?? SPECIES[255];
}

/** Trait ids stored in CompetitionRound.target_traits (u8). Mock trait vocabulary. */
export const TRAIT_NAMES: string[] = [
  "Glowing Petals", // 0
  "Twin Bloom", // 1
  "Star Shape", // 2
  "Sweet Fragrance", // 3
  "Tall Stem", // 4
  "Frost Tips", // 5
  "Veined Leaves", // 6
  "Nectar Rich", // 7
];

export function traitName(id: number): string {
  return TRAIT_NAMES[id] ?? `Trait #${id}`;
}

export interface RarityStyle {
  label: string;
  text: string; // tailwind text colour class
  ring: string; // tailwind ring/border colour class
  dot: string; // hex for sprite accents
}

/** rarity (u8 0..4) → tier. */
export const RARITY: RarityStyle[] = [
  { label: "Common", text: "text-garden-parch", ring: "border-garden-moss", dot: "#9fb6a4" },
  { label: "Uncommon", text: "text-garden-mint", ring: "border-garden-leaf", dot: "#8fd6a6" },
  { label: "Rare", text: "text-garden-cyan", ring: "border-garden-cyan", dot: "#6cc7cf" },
  { label: "Epic", text: "text-garden-lavender", ring: "border-garden-lavender", dot: "#c1aef0" },
  { label: "Legendary", text: "text-garden-gold", ring: "border-garden-gold", dot: "#e6c25c" },
];

export function rarity(r: number): RarityStyle {
  return RARITY[Math.max(0, Math.min(RARITY.length - 1, r))];
}

export function genomeLabel(code: GenomeStatusCode): string {
  switch (code) {
    case GenomeStatus.Encrypted:
      return "Sealed Bloom";
    case GenomeStatus.Revealed:
      return "Revealed Bloom";
    case GenomeStatus.Starter:
      return "Garden Starter";
    default:
      return "Budding";
  }
}

export function flowerStatusLabel(code: FlowerStatusCode): string {
  switch (code) {
    case FlowerStatus.Breeding:
      return "In the Greenhouse";
    case FlowerStatus.Submitted:
      return "Entered in Challenge";
    default:
      return "Resting on the Shelf";
  }
}

export function roundStatusLabel(code: RoundStatusCode): string {
  switch (code) {
    case RoundStatus.Closed:
      return "Judging Flowers";
    case RoundStatus.Finalized:
      return "Winners Revealed";
    default:
      return "Challenge Open";
  }
}

export function experimentStatusLabel(code: ExperimentStatusCode): string {
  switch (code) {
    case ExperimentStatus.Completed:
      return "Bloomed";
    case ExperimentStatus.Failed:
      return "Bloom Failed";
    default:
      return "Growing";
  }
}

export function flowerLabel(species: number, flowerIndex: number): string {
  const isHybrid = species === 255;
  return `${isHybrid ? "Hybrid" : speciesOf(species).name} #${flowerIndex}`;
}
