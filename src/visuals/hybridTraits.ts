/**
 * Stage 3C payoff: a hybrid's appearance is derived from its on-chain `revealed_trait_mask`
 * (a u32 the MPC produced), NOT from random/mock data. The mask packs four 0..4 "visual
 * class" slots, one per byte. This module decodes the mask and provides the colour palettes;
 * the actual SVG shape variants live in FlowerSprite. Pure presentation — no program types.
 *
 * Packing (must match the circuit / program comment in secret-garden):
 *   petal = mask        & 0xff
 *   color = (mask >> 8)  & 0xff
 *   leaf  = (mask >> 16) & 0xff
 *   stem  = (mask >> 24) & 0xff
 * Each value is 0..4 on-chain; we defensively `% VARIANT_COUNT` so a malformed mask can
 * never index out of range.
 */

export const HYBRID_VARIANT_COUNT = 5;

export interface TraitClasses {
  petal: number; // 0..4 → petal-cluster shape
  color: number; // 0..4 → palette
  leaf: number; // 0..4 → leaf shape
  stem: number; // 0..4 → stem shape
}

export function decodeTraitMask(mask: number): TraitClasses {
  const m = mask >>> 0; // treat as unsigned u32
  return {
    petal: (m & 0xff) % HYBRID_VARIANT_COUNT,
    color: ((m >>> 8) & 0xff) % HYBRID_VARIANT_COUNT,
    leaf: ((m >>> 16) & 0xff) % HYBRID_VARIANT_COUNT,
    stem: ((m >>> 24) & 0xff) % HYBRID_VARIANT_COUNT,
  };
}

export interface HybridPalette {
  name: string;
  petal: string;
  center: string;
  leaf: string;
}

/**
 * Five palettes drawn from the game's existing botanical colours (see presentation.ts
 * SPECIES). color class → palette: warm / cool / neutral / vivid / muted.
 */
export const HYBRID_PALETTES: HybridPalette[] = [
  { name: "Warm Ember", petal: "#e69ab0", center: "#b65574", leaf: "#4f9266" }, // 0 warm (rose)
  { name: "Cool Tide", petal: "#6cc7cf", center: "#2e7d86", leaf: "#3f8a7c" }, // 1 cool (bluebell)
  { name: "Soft Neutral", petal: "#f5efda", center: "#cbb98a", leaf: "#4f9266" }, // 2 neutral (lily)
  { name: "Vivid Gold", petal: "#e6c25c", center: "#b8862f", leaf: "#4f9266" }, // 3 vivid (marigold)
  { name: "Muted Dusk", petal: "#c1aef0", center: "#7d63bd", leaf: "#5a6f7d" }, // 4 muted (lavender)
];

export function paletteFor(colorClass: number): HybridPalette {
  return HYBRID_PALETTES[colorClass % HYBRID_PALETTES.length];
}
