// ============================================================
// Secret Garden Protocol — 625 Hybrid Visual System
// 5 petal shapes × 5 palettes × 5 cores × 5 stems, composed as
// four layered SVG bands:
//
//   aura  →  stem & foliage  →  petal silhouette  →  core/stamen
//
// The on-chain `revealed_trait_mask` format is UNCHANGED — the same
// four bytes decode to the same four 0..4 values as before. Only the
// artwork each value selects has been redesigned.
//
// Usage: getHybridSVG(maskToClasses(revealedTraitMask))
// ============================================================

export interface HybridClasses {
  /** slot 1 — petal shape: Daisy, Lotus, Carnivorous, Geometric, Drooping */
  petal: number;
  /** slot 2 — palette: Bioluminescent, Volcanic Ash, Pastel Dream, Monochrome Void, Royal Gold */
  color: number;
  /** slot 3 — core/stamen: Fibonacci Seeds, Glowing Crystal, The Watcher, Toxic Spores, Holographic Node */
  leaf: number;
  /** slot 4 — stem & foliage: Thorny Vines, Monstera Leaves, Bonsai Trunk, Glass, Fungal Roots */
  stem: number;
}

// Extract visual classes from on-chain revealed_trait_mask (u32).
// DO NOT change this bit math — it mirrors the MPC circuit's packing.
export function maskToClasses(mask: number): HybridClasses {
  return {
    petal: (mask & 0xff) % 5,
    color: ((mask >> 8) & 0xff) % 5,
    leaf: ((mask >> 16) & 0xff) % 5,
    stem: ((mask >> 24) & 0xff) % 5,
  };
}

export const PETAL_SHAPE_NAMES = [
  "Daisy",
  "Lotus",
  "Carnivorous",
  "Geometric",
  "Drooping",
] as const;

export const PALETTE_NAMES = [
  "Bioluminescent",
  "Volcanic Ash",
  "Pastel Dream",
  "Monochrome Void",
  "Royal Gold",
] as const;

export const CORE_NAMES = [
  "Fibonacci Seeds",
  "Glowing Crystal",
  "The Watcher",
  "Toxic Spores",
  "Holographic Node",
] as const;

export const FOLIAGE_NAMES = [
  "Thorny Vines",
  "Monstera Leaves",
  "Bonsai Trunk",
  "Glass",
  "Fungal Roots",
] as const;

// Human-readable description for a hybrid, e.g.
// "Bioluminescent Daisy — Fibonacci Seeds core, Thorny Vines stem".
export function getHybridDescription(classes: HybridClasses): string {
  const { petal, color, leaf, stem } = classes;
  return (
    `${PALETTE_NAMES[color % 5]} ${PETAL_SHAPE_NAMES[petal % 5]} — ` +
    `${CORE_NAMES[leaf % 5]} core, ${FOLIAGE_NAMES[stem % 5]} stem`
  );
}

// Rarity label based on visual diversity (cosmetic only, not tied to score)
export function getHybridRarity(classes: HybridClasses): string {
  const diversity = new Set([classes.petal, classes.color, classes.leaf, classes.stem]).size;
  if (diversity === 4) return 'LEGENDARY';
  if (diversity === 3) return 'EPIC';
  if (diversity === 2) return 'RARE';
  return 'UNCOMMON';
}

/* ---------------------------------------------------------------------------
 * Palettes (slot 2). Every layer reads its colours from here, so a hybrid is
 * one coherent object rather than four independently-tinted parts.
 * ------------------------------------------------------------------------- */

interface HybridPaletteSpec {
  name: string;
  petal: string; // main petal fill
  petalDeep: string; // shaded / inner petal
  petalLight: string; // highlight
  outline: string; // edge + darkest structural colour
  core: string; // stamen base
  coreDeep: string; // stamen shading
  accent: string; // sparkle / pollen highlight
  stem: string; // stem body
  stemDeep: string; // thorns, bark, darker grain
  leaf: string; // foliage
  glow: string; // aura colour
  glowOpacity: number; // aura strength
}

const PALETTES: readonly HybridPaletteSpec[] = [
  {
    // 0 — Bioluminescent: cyan / neon green / deep blue, glow-in-the-dark
    name: "Bioluminescent",
    petal: "#2FD9D2", petalDeep: "#0E5C8A", petalLight: "#9BFFE8", outline: "#062338",
    core: "#7CFF6B", coreDeep: "#0E7A4A", accent: "#D3FF8A",
    stem: "#128C7E", stemDeep: "#0B4F5E", leaf: "#1FBF8F",
    glow: "#5FFFE0", glowOpacity: 0.55,
  },
  {
    // 1 — Volcanic Ash: crimson / orange / charcoal, cooling lava
    name: "Volcanic Ash",
    petal: "#D93A26", petalDeep: "#6E1810", petalLight: "#FF9A3C", outline: "#1E1614",
    core: "#FF8A2B", coreDeep: "#8C3A08", accent: "#FFD08A",
    stem: "#3B322D", stemDeep: "#1E1614", leaf: "#5A4A3F",
    glow: "#FF7A29", glowOpacity: 0.45,
  },
  {
    // 2 — Pastel Dream: baby pink / mint / lilac, soft and cozy
    name: "Pastel Dream",
    petal: "#F7C0DA", petalDeep: "#D68FB6", petalLight: "#FFF1F8", outline: "#8C6A85",
    core: "#CDBDF0", coreDeep: "#9C86D6", accent: "#FFFFFF",
    stem: "#7FCFAA", stemDeep: "#54A585", leaf: "#B6EBD3",
    glow: "#FFE3F1", glowOpacity: 0.5,
  },
  {
    // 3 — Monochrome Void: black / white / grey only, rare and mysterious
    name: "Monochrome Void",
    petal: "#CFCFCF", petalDeep: "#6E6E6E", petalLight: "#FFFFFF", outline: "#0A0A0A",
    core: "#F2F2F2", coreDeep: "#3A3A3A", accent: "#FFFFFF",
    stem: "#4A4A4A", stemDeep: "#161616", leaf: "#7A7A7A",
    glow: "#FFFFFF", glowOpacity: 0.32,
  },
  {
    // 4 — Royal Gold: gold / white / deep purple, status
    name: "Royal Gold",
    petal: "#EFC65C", petalDeep: "#B8862F", petalLight: "#FFF6DC", outline: "#2A1350",
    core: "#F7E3A8", coreDeep: "#4B2380", accent: "#FFFFFF",
    stem: "#5B3A9B", stemDeep: "#2A1350", leaf: "#7A55C4",
    glow: "#FFE9A8", glowOpacity: 0.5,
  },
];

/* ---------------------------------------------------------------------------
 * Geometry helpers. The bloom is centred at (32, 34) inside a 64×90 viewBox;
 * the stem runs from y≈50 down to the base at y≈88.
 * ------------------------------------------------------------------------- */

const CX = 32;
const CY = 34;

const r2 = (n: number): string => (Math.round(n * 100) / 100).toString();

/** point on an ellipse centred at (cx, cy), `k` scales the radii */
function ellipsePoint(cx: number, cy: number, rx: number, ry: number, angDeg: number, k: number): string {
  const a = (angDeg * Math.PI) / 180;
  return `${r2(cx + rx * k * Math.cos(a))},${r2(cy + ry * k * Math.sin(a))}`;
}

/** `count` copies of `shape` rotated evenly around the bloom's local origin */
function radial(count: number, offsetDeg: number, shape: (angle: number, index: number) => string): string {
  let out = "";
  for (let i = 0; i < count; i++) out += shape(offsetDeg + (360 / count) * i, i);
  return out;
}

/** regular polygon point list, first vertex pointing up */
function polygon(sides: number, radius: number, rotDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((rotDeg - 90 + (360 / sides) * i) * Math.PI) / 180;
    pts.push(`${r2(radius * Math.cos(a))},${r2(radius * Math.sin(a))}`);
  }
  return pts.join(" ");
}

/* ---------------------------------------------------------------------------
 * Slot 1 — PETAL SHAPE. Each builder draws in local coordinates around the
 * bloom origin; the caller wraps them in translate(32 34).
 * ------------------------------------------------------------------------- */

const PETAL_SHAPES: ReadonlyArray<(p: HybridPaletteSpec, uid: string) => string> = [
  // 0 — Daisy: two rings of round-tipped petals, classic and cozy
  (p, uid) =>
    radial(
      12,
      0,
      (a) =>
        `<ellipse cx="0" cy="-15" rx="4.4" ry="12.5" fill="url(#${uid}-pet)" stroke="${p.outline}" stroke-opacity="0.3" stroke-width="0.5" transform="rotate(${r2(a)})"/>`,
    ) +
    radial(
      10,
      18,
      (a) =>
        `<ellipse cx="0" cy="-11" rx="3.4" ry="9" fill="${p.petalLight}" fill-opacity="0.85" stroke="${p.outline}" stroke-opacity="0.2" stroke-width="0.4" transform="rotate(${r2(a)})"/>`,
    ) +
    `<circle r="9" fill="${p.petalDeep}" fill-opacity="0.75"/>`,

  // 1 — Lotus: three layers of pointed petals, zen / elegant
  (p, uid) => {
    const lobe = "M0,0 C -7,-9 -6.5,-19 0,-27 C 6.5,-19 7,-9 0,0 Z";
    return (
      radial(
        8,
        0,
        (a) =>
          `<path d="${lobe}" fill="${p.petalDeep}" stroke="${p.outline}" stroke-opacity="0.3" stroke-width="0.5" transform="rotate(${r2(a)})"/>`,
      ) +
      radial(
        8,
        22.5,
        (a) =>
          `<path d="${lobe}" fill="url(#${uid}-pet)" stroke="${p.outline}" stroke-opacity="0.25" stroke-width="0.5" transform="rotate(${r2(a)}) scale(0.74)"/>`,
      ) +
      radial(
        5,
        36,
        (a) =>
          `<path d="${lobe}" fill="${p.petalLight}" fill-opacity="0.9" transform="rotate(${r2(a)}) scale(0.44)"/>`,
      )
    );
  },

  // 2 — Carnivorous: two toothed lobes hinged on an open mouth, Venus-flytrap-like
  (p, uid) => {
    // interlocking fangs along the mouth line — the shape's signature read
    const teeth = (baseY: number, tipY: number, startX: number, count: number): string => {
      let out = "";
      for (let i = 0; i < count; i++) {
        const x = startX + i * 4.4;
        out += `<path d="M${r2(x - 1.7)},${baseY} L${r2(x + 1.7)},${baseY} L${r2(x)},${tipY} Z" fill="${p.petalLight}" stroke="${p.outline}" stroke-opacity="0.4" stroke-width="0.35"/>`;
      }
      return out;
    };
    // small spikes around the outer rim of a lobe
    const spikes = (cy: number, ry: number, from: number, to: number, count: number): string => {
      const step = (to - from) / (count - 1);
      let out = "";
      for (let i = 0; i < count; i++) {
        const ang = from + step * i;
        const half = step * 0.34;
        out +=
          `<path d="M${ellipsePoint(0, cy, 18, ry, ang - half, 0.95)} ` +
          `L${ellipsePoint(0, cy, 18, ry, ang, 1.16)} ` +
          `L${ellipsePoint(0, cy, 18, ry, ang + half, 0.95)} Z" fill="${p.petalDeep}"/>`;
      }
      return out;
    };
    return (
      `<ellipse rx="18.5" ry="5" fill="${p.outline}" fill-opacity="0.9"/>` +
      teeth(-3.2, 3, -15.4, 8) +
      teeth(3.2, -3, -13.2, 7) +
      spikes(-2, 20, 196, 344, 8) +
      spikes(2, 16, 16, 164, 8) +
      `<path d="M-18,-2 A 18,20 0 0 1 18,-2 Z" fill="url(#${uid}-pet)" stroke="${p.outline}" stroke-opacity="0.5" stroke-width="0.7"/>` +
      `<path d="M-18,2 A 18,16 0 0 0 18,2 Z" fill="url(#${uid}-pet)" stroke="${p.outline}" stroke-opacity="0.5" stroke-width="0.7"/>` +
      `<path d="M-12,-2 A 12,13 0 0 1 12,-2 Z" fill="${p.petalDeep}" fill-opacity="0.65"/>` +
      `<path d="M-12,2 A 12,10 0 0 0 12,2 Z" fill="${p.petalDeep}" fill-opacity="0.65"/>` +
      // trigger hairs on the inner face of each lobe
      `<path d="M-7,-4 v-4 M0,-5 v-4.5 M7,-4 v-4 M-6,4 v3.4 M6,4 v3.4" stroke="${p.accent}" stroke-opacity="0.55" stroke-width="0.5"/>`
    );
  },

  // 3 — Geometric: rigid polygon petals, hard edges, Web3-coded
  (p, uid) =>
    radial(
      6,
      0,
      (a) =>
        `<path d="M0,-7 L8,-25 L-8,-25 Z" fill="url(#${uid}-pet)" stroke="${p.outline}" stroke-opacity="0.55" stroke-width="0.8" stroke-linejoin="miter" transform="rotate(${r2(a)})"/>`,
    ) +
    radial(
      6,
      30,
      (a) =>
        `<path d="M0,-6 L5,-17 L-5,-17 Z" fill="${p.petalDeep}" stroke="${p.outline}" stroke-opacity="0.45" stroke-width="0.6" stroke-linejoin="miter" transform="rotate(${r2(a)})"/>`,
    ) +
    `<polygon points="${polygon(6, 13, 0)}" fill="none" stroke="${p.petalLight}" stroke-opacity="0.8" stroke-width="0.9"/>` +
    `<polygon points="${polygon(6, 9, 30)}" fill="${p.petalDeep}" fill-opacity="0.55" stroke="${p.petalLight}" stroke-opacity="0.5" stroke-width="0.6"/>`,

  // 4 — Drooping: hanging bell-shaped blooms, bluebell-like
  (p, uid) => {
    const bell =
      `<path d="M-11,-18 C -15,-8 -14,4 -9,8 C -3,12 3,12 9,8 C 14,4 15,-8 11,-18 Z" fill="url(#${uid}-pet)" stroke="${p.outline}" stroke-opacity="0.35" stroke-width="0.6"/>` +
      `<path d="M-6,-16 C -9,-7 -8,3 -5,7 C -1,9.5 1,9.5 5,7 C 8,3 9,-7 6,-16 Z" fill="${p.petalDeep}" fill-opacity="0.45"/>` +
      `<path d="M-9,7.5 l2.2,5 l3,-3.6 Z" fill="${p.petal}" stroke="${p.outline}" stroke-opacity="0.3" stroke-width="0.4"/>` +
      `<path d="M-2.4,10.6 l2.4,5 l2.4,-5 Z" fill="${p.petal}" stroke="${p.outline}" stroke-opacity="0.3" stroke-width="0.4"/>` +
      `<path d="M3.8,8.9 l3,3.6 l2.2,-5 Z" fill="${p.petal}" stroke="${p.outline}" stroke-opacity="0.3" stroke-width="0.4"/>`;
    return (
      `<path d="M0,-30 C 0,-25 -1,-21 0,-18" fill="none" stroke="${p.stem}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M0,-28 C -9,-27 -14,-22 -15,-16" fill="none" stroke="${p.stem}" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="M0,-28 C 9,-27 14,-22 15,-16" fill="none" stroke="${p.stem}" stroke-width="1.2" stroke-linecap="round"/>` +
      `<g transform="translate(-15 -6) scale(0.55)">${bell}</g>` +
      `<g transform="translate(15 -6) scale(0.55)">${bell}</g>` +
      bell
    );
  },
];

/* ---------------------------------------------------------------------------
 * Slot 3 — CORE / STAMEN. Drawn last, centred on the bloom origin.
 * ------------------------------------------------------------------------- */

const CORES: ReadonlyArray<(p: HybridPaletteSpec, uid: string) => string> = [
  // 0 — Fibonacci Seeds: golden-angle spiral of seeds, sunflower-like
  (p) => {
    let seeds = "";
    for (let i = 0; i < 42; i++) {
      const a = (i * 137.507 * Math.PI) / 180;
      const rad = 1.32 * Math.sqrt(i);
      seeds += `<circle cx="${r2(rad * Math.cos(a))}" cy="${r2(rad * Math.sin(a))}" r="${r2(0.6 + i * 0.022)}" fill="${i % 3 === 0 ? p.accent : p.core}" fill-opacity="${i % 3 === 0 ? "0.95" : "0.8"}"/>`;
    }
    return `<circle r="9.2" fill="${p.coreDeep}" stroke="${p.outline}" stroke-opacity="0.35" stroke-width="0.6"/>${seeds}`;
  },

  // 1 — Glowing Crystal: faceted gem with a soft bloom of light
  (p, uid) =>
    `<circle r="13" fill="url(#${uid}-halo)"/>` +
    `<path d="M0,-10 L6.5,-2.5 L4,9 L-4,9 L-6.5,-2.5 Z" fill="${p.core}" stroke="${p.outline}" stroke-opacity="0.4" stroke-width="0.6" stroke-linejoin="miter"/>` +
    `<path d="M0,-10 L-6.5,-2.5 L-4,9 L0,6 Z" fill="${p.petalLight}" fill-opacity="0.75"/>` +
    `<path d="M0,-10 L0,6 M-6.5,-2.5 L6.5,-2.5" stroke="${p.accent}" stroke-opacity="0.55" stroke-width="0.5"/>` +
    `<path d="M0,-13.5 l1,2.5 l2.5,1 l-2.5,1 l-1,2.5 l-1,-2.5 l-2.5,-1 l2.5,-1 Z" fill="${p.accent}" fill-opacity="0.9"/>`,

  // 2 — The Watcher: a mystical eye at the centre
  (p) =>
    `<path d="M-11,0 C -6,-7.5 6,-7.5 11,0 C 6,7.5 -6,7.5 -11,0 Z" fill="${p.petalLight}" stroke="${p.outline}" stroke-opacity="0.7" stroke-width="0.8"/>` +
    `<circle r="4.6" fill="${p.core}" stroke="${p.coreDeep}" stroke-width="0.8"/>` +
    `<circle r="2.1" fill="${p.outline}"/>` +
    `<circle cx="-1.6" cy="-1.6" r="1.1" fill="${p.petalLight}" fill-opacity="0.95"/>` +
    `<path d="M-11,0 C -6,-7.5 6,-7.5 11,0" fill="none" stroke="${p.outline}" stroke-opacity="0.5" stroke-width="1.2"/>` +
    radial(
      3,
      -90,
      (a) =>
        `<line x1="0" y1="-8" x2="0" y2="-11.5" stroke="${p.accent}" stroke-opacity="0.6" stroke-width="0.6" transform="rotate(${r2(a + 90)})"/>`,
    ),

  // 3 — Toxic Spores: bubble-like pollen clusters
  (p) => {
    const bubbles: Array<[number, number, number]> = [
      [0, 0, 4.4], [-5.5, -3.2, 3.2], [5.2, -3.8, 2.8], [3.8, 4.6, 3.4],
      [-4.2, 5, 2.6], [-8.4, 1.8, 2], [8, 2.4, 2.2], [0.6, -7.6, 2.4], [-1.4, 8.6, 1.8],
    ];
    return bubbles
      .map(
        ([x, y, r]) =>
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.core}" fill-opacity="0.6" stroke="${p.accent}" stroke-opacity="0.8" stroke-width="0.6"/>` +
          `<circle cx="${r2(x - r * 0.35)}" cy="${r2(y - r * 0.4)}" r="${r2(r * 0.28)}" fill="${p.petalLight}" fill-opacity="0.9"/>`,
      )
      .join("");
  },

  // 4 — Holographic Node: cybernetic network hub
  (p) => {
    const outer = polygon(6, 9.5, 0);
    return (
      `<polygon points="${outer}" fill="none" stroke="${p.accent}" stroke-opacity="0.45" stroke-width="0.6" stroke-dasharray="1.6 1.4"/>` +
      radial(
        6,
        -90,
        (a) =>
          `<line x1="0" y1="0" x2="0" y2="-9.5" stroke="${p.core}" stroke-opacity="0.7" stroke-width="0.7" transform="rotate(${r2(a + 90)})"/>` +
          `<circle cx="0" cy="-9.5" r="1.7" fill="${p.core}" stroke="${p.coreDeep}" stroke-width="0.5" transform="rotate(${r2(a + 90)})"/>`,
      ) +
      `<polygon points="${polygon(6, 5, 0)}" fill="${p.coreDeep}" stroke="${p.accent}" stroke-opacity="0.9" stroke-width="0.8" stroke-linejoin="miter"/>` +
      `<circle r="1.8" fill="${p.accent}"/>`
    );
  },
];

/* ---------------------------------------------------------------------------
 * Slot 4 — STEM & FOLIAGE. Absolute coordinates: stem top ≈ y50, base ≈ y88.
 * ------------------------------------------------------------------------- */

/** one monstera leaf: body with evenodd fenestrations, plus a midrib */
function monsteraLeaf(x: number, y: number, rot: number, scale: number, p: HybridPaletteSpec): string {
  const body = "M0,0 C 7,-12 21,-14 27,-5 C 22,6 7,11 0,0 Z";
  const holes =
    "M9,-4.6 a2.6,1.7 0 1,0 5.2,0 a2.6,1.7 0 1,0 -5.2,0 Z" +
    "M17.4,-5.4 a2.2,1.4 0 1,0 4.4,0 a2.2,1.4 0 1,0 -4.4,0 Z" +
    "M10.6,1.8 a2.4,1.5 0 1,0 4.8,0 a2.4,1.5 0 1,0 -4.8,0 Z" +
    "M18.6,0.8 a1.9,1.2 0 1,0 3.8,0 a1.9,1.2 0 1,0 -3.8,0 Z";
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">` +
    `<path d="${body}${holes}" fill="${p.leaf}" fill-rule="evenodd" stroke="${p.stemDeep}" stroke-opacity="0.45" stroke-width="0.5"/>` +
    `<path d="M0,0 C 9,-3.4 18,-4.4 26,-4.6" fill="none" stroke="${p.stemDeep}" stroke-opacity="0.5" stroke-width="0.8"/>` +
    `</g>`
  );
}

const FOLIAGE: ReadonlyArray<(p: HybridPaletteSpec, uid: string) => string> = [
  // 0 — Thorny Vines: sharp thorns alternating along a wiry stem
  (p) => {
    const thorns: Array<[number, number, number]> = [
      [30.6, 58, -1], [31.5, 65, 1], [32.9, 72, -1], [33.1, 79, 1], [32.4, 85, -1],
    ];
    return (
      `<path d="M32,50 C 29.8,60 34,72 32.6,88" fill="none" stroke="${p.stem}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<path d="M32,52 C 30.4,60 33.6,72 32.4,86" fill="none" stroke="${p.stemDeep}" stroke-opacity="0.45" stroke-width="0.9"/>` +
      thorns
        .map(
          ([tx, ty, dir]) =>
            `<path d="M${tx},${ty} l${r2(dir * 6)},${-3.4} l${r2(-dir * 1.6)},4.4 Z" fill="${p.stemDeep}"/>`,
        )
        .join("") +
      `<path d="M33,68 C 40,66 44,62 43,57" fill="none" stroke="${p.stem}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<path d="M43,57 a2.6,2.6 0 1,1 -2.6,2.6" fill="none" stroke="${p.stem}" stroke-width="1.2" stroke-linecap="round"/>` +
      `<ellipse cx="22" cy="76" rx="6" ry="2.6" fill="${p.leaf}" transform="rotate(-24 22 76)"/>` +
      `<ellipse cx="42" cy="80" rx="5.4" ry="2.4" fill="${p.leaf}" transform="rotate(22 42 80)"/>`
    );
  },

  // 1 — Monstera Leaves: two wide fenestrated leaves off a straight stem
  (p) =>
    `<path d="M32,50 C 31.2,64 32.8,76 32,88" fill="none" stroke="${p.stem}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M32,62 C 27,62 22,63 18,65" fill="none" stroke="${p.stem}" stroke-width="1.4"/>` +
    `<path d="M32,72 C 37,72 42,73 46,75" fill="none" stroke="${p.stem}" stroke-width="1.4"/>` +
    monsteraLeaf(18, 65, 168, 0.78, p) +
    monsteraLeaf(46, 75, 12, 0.68, p),

  // 2 — Bonsai Trunk: gnarled woody trunk with bark grain and a side branch
  (p) =>
    `<path d="M25.5,88 C 24.5,80 29,75 27,68 C 25.4,62 29,55 30.6,50 L36,50.6 C 33.6,56 30.6,62 32.6,68.6 C 34.8,76 32.4,81 34.8,88 Z" fill="${p.stem}" stroke="${p.stemDeep}" stroke-opacity="0.6" stroke-width="0.7"/>` +
    `<path d="M22,88 C 24,84 24.5,82 25.5,80 M42,88 C 38,84 36,83 34.6,80" fill="none" stroke="${p.stem}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M29,86 C 28,79 31,74 29.6,68 C 28.4,62 31,56 32.4,52" fill="none" stroke="${p.stemDeep}" stroke-opacity="0.55" stroke-width="0.8"/>` +
    `<path d="M32.6,84 C 32,78 33.4,74 32.6,70" fill="none" stroke="${p.stemDeep}" stroke-opacity="0.35" stroke-width="0.6"/>` +
    `<ellipse cx="30.4" cy="71" rx="1.6" ry="2.2" fill="${p.stemDeep}" fill-opacity="0.7"/>` +
    `<path d="M28,66 C 23,64 20,61 19,57" fill="none" stroke="${p.stem}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<ellipse cx="17" cy="55" rx="7" ry="3.4" fill="${p.leaf}"/>` +
    `<ellipse cx="20" cy="60.5" rx="5" ry="2.4" fill="${p.leaf}" fill-opacity="0.85"/>`,

  // 3 — Glass: see-through tube with refraction highlights
  (p, uid) =>
    `<path d="M28.8,50 C 28.2,64 29.8,76 28.8,88 L35.2,88 C 34.2,76 35.8,64 35.2,50 Z" fill="url(#${uid}-glass)" stroke="${p.petalLight}" stroke-opacity="0.55" stroke-width="0.7"/>` +
    `<path d="M30.6,53 C 30.2,64 31.2,76 30.6,86" fill="none" stroke="${p.petalLight}" stroke-opacity="0.7" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M33.6,56 C 33.4,64 34,72 33.6,82" fill="none" stroke="${p.petalLight}" stroke-opacity="0.3" stroke-width="0.7"/>` +
    `<path d="M29.2,62 L34.8,61 M29.4,71 L35,70 M28.9,80 L34.9,79" stroke="${p.stem}" stroke-opacity="0.5" stroke-width="0.6"/>` +
    `<ellipse cx="32" cy="88" rx="7.6" ry="2.4" fill="${p.stem}" fill-opacity="0.35"/>` +
    `<path d="M24,72 C 27,70 29,69 30,68" fill="none" stroke="${p.leaf}" stroke-opacity="0.75" stroke-width="1.2"/>` +
    `<ellipse cx="22" cy="72" rx="5.4" ry="2.4" fill="${p.leaf}" fill-opacity="0.75" transform="rotate(-20 22 72)"/>` +
    `<ellipse cx="42" cy="78" rx="5" ry="2.2" fill="${p.leaf}" fill-opacity="0.75" transform="rotate(20 42 78)"/>`,

  // 4 — Fungal Roots: mycelium threads and small mushrooms at the base
  (p) => {
    const cap = (x: number, y: number, w: number, h: number): string =>
      `<rect x="${r2(x - w * 0.22)}" y="${r2(y)}" width="${r2(w * 0.44)}" height="${r2(h * 1.5)}" rx="${r2(w * 0.22)}" fill="${p.petalLight}" fill-opacity="0.85"/>` +
      `<path d="M${r2(x - w)},${r2(y + 1)} C ${r2(x - w)},${r2(y - h)} ${r2(x + w)},${r2(y - h)} ${r2(x + w)},${r2(y + 1)} Z" fill="${p.core}" stroke="${p.coreDeep}" stroke-opacity="0.6" stroke-width="0.5"/>` +
      `<circle cx="${r2(x - w * 0.35)}" cy="${r2(y - h * 0.4)}" r="0.7" fill="${p.accent}" fill-opacity="0.9"/>` +
      `<circle cx="${r2(x + w * 0.3)}" cy="${r2(y - h * 0.5)}" r="0.55" fill="${p.accent}" fill-opacity="0.9"/>`;
    const threads = [
      "M32,79 C 26,81 21,84 16,86", "M32,79 C 38,81 43,84 48,86",
      "M32,79 C 29,83 27.5,86 26,88.5", "M32,79 C 35,83 36.5,86 38,88.5",
      "M32,79 C 24,80 19,81 14,81.5", "M32,79 C 40,80 45,81 50,81.5",
    ]
      .map((d) => `<path d="${d}" fill="none" stroke="${p.leaf}" stroke-opacity="0.75" stroke-width="1"/>`)
      .join("");
    const hairs = [
      "M21,83 l-2.4,-2", "M43,83 l2.4,-2", "M18,86 l-1.6,2.2", "M46,86 l1.6,2.2",
    ]
      .map((d) => `<path d="${d}" fill="none" stroke="${p.leaf}" stroke-opacity="0.5" stroke-width="0.6"/>`)
      .join("");
    return (
      `<path d="M32,50 C 31,62 33,72 32,80" fill="none" stroke="${p.stem}" stroke-width="2.6" stroke-linecap="round"/>` +
      threads +
      hairs +
      `<circle cx="32" cy="79.5" r="2.6" fill="${p.stemDeep}" fill-opacity="0.7"/>` +
      cap(20, 82, 4.6, 3.6) +
      cap(44, 84, 3.8, 3) +
      cap(27, 86.5, 3, 2.4)
    );
  },
];

/* -------------------------------------------------------------------------*/

// Generate the SVG string for any of the 625 hybrid combinations.
export function getHybridSVG(classes: HybridClasses): string {
  const p = classes.petal % 5;
  const c = classes.color % 5;
  const l = classes.leaf % 5;
  const s = classes.stem % 5;

  const pal = PALETTES[c];
  // Gradient/filter ids must not collide between two hybrids on the same page.
  // Keying them on the combination means identical hybrids share identical defs
  // (harmless) while different hybrids never reuse another's colours.
  const uid = `hy${p}${c}${l}${s}`;

  return `<svg viewBox="0 0 64 90" xmlns="http://www.w3.org/2000/svg">
<defs>
<radialGradient id="${uid}-aura"><stop offset="0%" stop-color="${pal.glow}" stop-opacity="${pal.glowOpacity}"/><stop offset="60%" stop-color="${pal.glow}" stop-opacity="${pal.glowOpacity * 0.35}"/><stop offset="100%" stop-color="${pal.glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="${uid}-pet" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0%" stop-color="${pal.petalLight}"/><stop offset="45%" stop-color="${pal.petal}"/><stop offset="100%" stop-color="${pal.petalDeep}"/></linearGradient>
<radialGradient id="${uid}-halo"><stop offset="0%" stop-color="${pal.accent}" stop-opacity="0.9"/><stop offset="45%" stop-color="${pal.core}" stop-opacity="0.45"/><stop offset="100%" stop-color="${pal.core}" stop-opacity="0"/></radialGradient>
<linearGradient id="${uid}-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${pal.petalLight}" stop-opacity="0.5"/><stop offset="45%" stop-color="${pal.stem}" stop-opacity="0.22"/><stop offset="100%" stop-color="${pal.petalLight}" stop-opacity="0.45"/></linearGradient>
</defs>
<circle cx="${CX}" cy="${CY}" r="30" fill="url(#${uid}-aura)"/>
${FOLIAGE[s](pal, uid)}
<g transform="translate(${CX} ${CY})">${PETAL_SHAPES[p](pal, uid)}</g>
<g transform="translate(${CX} ${CY})">${CORES[l](pal, uid)}</g>
</svg>`;
}
