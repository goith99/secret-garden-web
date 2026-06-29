import type { ReactElement } from "react";
import type { Flower } from "../types";
import { GenomeStatus } from "../types";
import { speciesOf, rarity as rarityStyle, type SpeciesSkin } from "../mocks/presentation";
import {
  decodeTraitMask,
  paletteFor,
  type HybridPalette,
} from "../visuals/hybridTraits";
import {
  getHybridSVG,
  maskToClasses,
  getHybridDescription,
} from "../visuals/hybridSvg";

/**
 * PLACEHOLDER SPRITES. Pure-SVG flowers standing in for future pixel-art assets.
 *
 * Each species now has a DISTINCT silhouette (not just a recolour): the outer <svg>
 * wrapper, sizing and colours are shared, and the per-species shape is chosen from the
 * SPECIES_SHAPE lookup below. Adding a species = add one small shape function + one map
 * entry; no call sites change (props are unchanged: flower / size / sway).
 *
 * TODO (future stage): replace these vector placeholders with real pixel-art sprites once
 * an image-generation API key is configured. See the Stage 6A discovery notes — these are
 * deliberately lightweight (inline SVG paths, no image downloads) until then.
 */
export type SpriteSize = "sm" | "md" | "lg";

const PX: Record<SpriteSize, number> = { sm: 44, md: 64, lg: 92 };

// shared thin outline that gives the flat shapes a little definition
const EDGE = "rgba(0,0,0,0.18)";

interface ShapeProps {
  skin: SpeciesSkin;
  accent: string; // rarity dot colour
  gradId: string; // gradient id (used by the hybrid blend)
}

/* ---------------------------------------------------------------------------
 * Per-species silhouettes. Each draws inside the 64×64 viewBox, bloom around
 * (32, ~26) with the stem running down toward y≈56. Kept tiny + self-contained.
 * ------------------------------------------------------------------------- */

// Marigold — tight cluster of overlapping rounded petals (8 circles) + short stem.
function MarigoldShape({ skin, accent }: ShapeProps): ReactElement {
  return (
    <>
      <rect x="30.5" y="32" width="3" height="22" rx="1.5" fill={skin.leaf} />
      <g transform="translate(32 24)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <circle key={a} cx="0" cy="-9" r="5.5" fill={skin.petal} stroke={EDGE} strokeWidth="0.6" transform={`rotate(${a})`} />
        ))}
        <circle r="7.5" fill={skin.center} stroke={EDGE} strokeWidth="0.6" />
        <circle r="3" fill={accent} />
      </g>
    </>
  );
}

// Lavender — vertical spike with rounded blooms clustered up its length, tapering to a point.
function LavenderShape({ skin }: ShapeProps): ReactElement {
  const buds = [
    { x: 32, y: 13, r: 2.2 },
    { x: 29.5, y: 17, r: 2.8 }, { x: 34.5, y: 17, r: 2.8 },
    { x: 29, y: 22, r: 3.2 }, { x: 35, y: 22, r: 3.2 },
    { x: 28.5, y: 27, r: 3.5 }, { x: 35.5, y: 27, r: 3.5 },
    { x: 29, y: 32, r: 3.4 }, { x: 35, y: 32, r: 3.4 },
  ];
  return (
    <>
      <rect x="31" y="16" width="2.5" height="40" rx="1.25" fill={skin.leaf} />
      <ellipse cx="27" cy="48" rx="5" ry="2.2" fill={skin.leaf} transform="rotate(-25 27 48)" />
      <ellipse cx="37" cy="50" rx="5" ry="2.2" fill={skin.leaf} transform="rotate(25 37 50)" />
      {buds.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={skin.petal} stroke={EDGE} strokeWidth="0.5" />
      ))}
    </>
  );
}

// Bluebell — single drooping bell on a curved stem, with small flared points at the rim.
function BluebellShape({ skin }: ShapeProps): ReactElement {
  return (
    <>
      <path d="M30,12 C 30,20 33,23 37,25" fill="none" stroke={skin.leaf} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="26" cy="20" rx="4.5" ry="2" fill={skin.leaf} transform="rotate(-30 26 20)" />
      <path
        d="M37,24 C 31,27 30,37 32,42 C 33,44 43,44 44,42 C 46,37 45,27 39,24 Z"
        fill={skin.petal}
        stroke={EDGE}
        strokeWidth="0.6"
      />
      <path d="M31.5,42 l1.8,3.6 l2,-3.2 Z" fill={skin.petal} stroke={EDGE} strokeWidth="0.5" />
      <path d="M36.5,43 l1.8,3.8 l1.8,-3.4 Z" fill={skin.petal} stroke={EDGE} strokeWidth="0.5" />
      <path d="M41,42 l1.7,3.4 l1.8,-3.1 Z" fill={skin.petal} stroke={EDGE} strokeWidth="0.5" />
      <circle cx="38" cy="25" r="2" fill={skin.center} />
    </>
  );
}

// Rose — layered overlapping petal curls with a central multi-loop spiral + a leaf.
const ROSE_LOBE = "M0,0 C 5,-2 7,-7 3,-11 C 0,-14 -5,-12 -5,-7 C -5,-3 -3,-1 0,0 Z";
function RoseShape({ skin, accent }: ShapeProps): ReactElement {
  return (
    <>
      <rect x="30.5" y="34" width="3" height="22" rx="1.5" fill={skin.leaf} />
      <ellipse cx="40" cy="44" rx="6" ry="3" fill={skin.leaf} transform="rotate(28 40 44)" />
      <g transform="translate(32 26)">
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={`o${a}`} d={ROSE_LOBE} fill={skin.petal} stroke={EDGE} strokeWidth="0.6" transform={`rotate(${a})`} />
        ))}
        {[36, 108, 180, 252, 324].map((a) => (
          <path key={`i${a}`} d={ROSE_LOBE} fill={skin.petal} stroke={EDGE} strokeWidth="0.5" transform={`rotate(${a}) scale(0.6)`} />
        ))}
        {/* central multi-loop spiral coil (the rose's signature, not simple circles) */}
        <path d="M0,3 C 3,3 3,-2 0,-2 C -4,-2 -4,4 1,4 C 6,4 6,-4 -2,-5" fill="none" stroke={skin.center} strokeWidth="1.6" strokeLinecap="round" />
        <circle r="1.6" fill={accent} />
      </g>
    </>
  );
}

// Mint — leafy cluster (leaves read first) with tiny flower buds at the top.
function MintShape({ skin }: ShapeProps): ReactElement {
  const leaves = [
    { cx: 24, cy: 46, rot: -45 }, { cx: 40, cy: 46, rot: 45 },
    { cx: 25, cy: 38, rot: -40 }, { cx: 39, cy: 38, rot: 40 },
    { cx: 26, cy: 30, rot: -35 }, { cx: 38, cy: 30, rot: 35 },
  ];
  const buds = [{ x: 32, y: 18 }, { x: 29, y: 21 }, { x: 35, y: 21 }, { x: 32, y: 23 }];
  return (
    <>
      <rect x="31" y="22" width="2.5" height="34" rx="1.25" fill={skin.leaf} />
      {leaves.map((l, i) => (
        <ellipse key={i} cx={l.cx} cy={l.cy} rx="7" ry="3.2" fill={skin.leaf} stroke={EDGE} strokeWidth="0.5" transform={`rotate(${l.rot} ${l.cx} ${l.cy})`} />
      ))}
      {buds.map((b, i) => (
        <circle key={`b${i}`} cx={b.x} cy={b.y} r="2" fill={skin.petal} stroke={EDGE} strokeWidth="0.4" />
      ))}
    </>
  );
}

// Lily — star of long pointed petals radiating from a small center, with stamens.
const LILY_PETAL = "M0,0 C 2.6,-7 4,-12 0,-21 C -4,-12 -2.6,-7 0,0 Z";
function LilyShape({ skin, accent }: ShapeProps): ReactElement {
  return (
    <>
      <rect x="30.5" y="32" width="3" height="24" rx="1.5" fill={skin.leaf} />
      <ellipse cx="40" cy="46" rx="6" ry="3" fill={skin.leaf} transform="rotate(28 40 46)" />
      <g transform="translate(32 26)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path key={a} d={LILY_PETAL} fill={skin.petal} stroke={EDGE} strokeWidth="0.6" transform={`rotate(${a})`} />
        ))}
        <circle r="3.2" fill={skin.center} />
        {[-18, 0, 18].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <line x1="0" y1="0" x2="0" y2="-7" stroke={accent} strokeWidth="0.9" />
            <circle cx="0" cy="-7.5" r="1.2" fill={accent} />
          </g>
        ))}
      </g>
    </>
  );
}

// Hybrid (255) — an "unknown" blend: the generic radial bloom with a two-tone gradient.
function HybridShape({ skin, accent, gradId }: ShapeProps): ReactElement {
  return (
    <>
      <rect x="30.5" y="34" width="3" height="24" rx="1.5" fill={skin.leaf} />
      <ellipse cx="40" cy="46" rx="7" ry="4" fill={skin.leaf} opacity="0.9" transform="rotate(28 40 46)" />
      <g transform="translate(32 26)">
        {[0, 60, 120, 180, 240, 300].map((a, i) => (
          <ellipse
            key={a}
            rx="8"
            ry="13"
            cx="0"
            cy="-11"
            fill={`url(#${gradId})`}
            stroke={EDGE}
            strokeWidth="0.6"
            transform={`rotate(${a}) ${i % 2 === 1 ? "scale(0.92)" : ""}`}
          />
        ))}
        <circle r="6.5" fill={skin.center} stroke={EDGE} strokeWidth="0.6" />
        <circle r="2.4" fill={accent} />
      </g>
    </>
  );
}

/** species id → silhouette. Unknown ids fall back to the hybrid bloom. */
const SPECIES_SHAPE: Record<number, (p: ShapeProps) => ReactElement> = {
  0: MarigoldShape,
  1: BluebellShape,
  2: LavenderShape,
  3: RoseShape,
  4: MintShape,
  5: LilyShape,
  255: HybridShape,
};

/* ===========================================================================
 * Stage 3C: PARAMETRIC HYBRID. A hybrid (visualSpeciesId === 255) is drawn by
 * composing one of 5 stem + 5 leaf + 5 petal variants, each selected by a 0..4
 * class decoded from the on-chain revealed_trait_mask, coloured by a palette
 * picked by the color class. The four classes are independent, so the same
 * hybrid always renders the same flower (deterministic from chain data).
 * ========================================================================= */

// --- 5 stem variants (coloured by palette.leaf) ---
const STEMS: Array<(p: { color: string }) => ReactElement> = [
  ({ color }) => <rect x="30.5" y="30" width="3" height="26" rx="1.5" fill={color} />,
  ({ color }) => (
    <path d="M32,30 C 26,40 28,50 30,56" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
  ),
  ({ color }) => (
    <path d="M32,30 C 38,40 36,50 34,56" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
  ),
  ({ color }) => <rect x="29.5" y="30" width="5" height="26" rx="2.5" fill={color} />,
  ({ color }) => (
    <>
      <rect x="31" y="42" width="2.5" height="14" rx="1.25" fill={color} />
      <path d="M32,43 C 28,38 27,34 28,31" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32,43 C 36,38 37,34 36,31" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
];

// --- 5 leaf variants (coloured by palette.leaf) ---
const LEAF: Array<(p: { color: string }) => ReactElement> = [
  ({ color }) => (
    <>
      <ellipse cx="24" cy="48" rx="5" ry="2.2" fill={color} transform="rotate(-25 24 48)" />
      <ellipse cx="40" cy="48" rx="5" ry="2.2" fill={color} transform="rotate(25 40 48)" />
    </>
  ),
  ({ color }) => (
    <>
      <ellipse cx="25" cy="42" rx="6" ry="2.6" fill={color} transform="rotate(-22 25 42)" />
      <ellipse cx="39" cy="42" rx="6" ry="2.6" fill={color} transform="rotate(22 39 42)" />
    </>
  ),
  ({ color }) => (
    <>
      <ellipse cx="39" cy="36" rx="6" ry="2.6" fill={color} transform="rotate(28 39 36)" />
      <ellipse cx="25" cy="50" rx="5" ry="2.2" fill={color} transform="rotate(-26 25 50)" />
    </>
  ),
  ({ color }) => (
    <>
      <ellipse cx="23" cy="46" rx="7.5" ry="3.4" fill={color} transform="rotate(-20 23 46)" />
      <ellipse cx="41" cy="46" rx="7.5" ry="3.4" fill={color} transform="rotate(20 41 46)" />
    </>
  ),
  ({ color }) => (
    <>
      <ellipse cx="24" cy="50" rx="4.5" ry="2" fill={color} transform="rotate(-28 24 50)" />
      <ellipse cx="40" cy="50" rx="4.5" ry="2" fill={color} transform="rotate(28 40 50)" />
      <ellipse cx="40" cy="40" rx="4.5" ry="2" fill={color} transform="rotate(30 40 40)" />
    </>
  ),
];

interface PetalProps {
  palette: HybridPalette;
  accent: string;
  gradId: string;
}

// --- 5 petal-cluster variants (drawn around the bloom centre at translate(32 26)) ---
const PETALS: Array<(p: PetalProps) => ReactElement> = [
  // 0 — round radial cluster (8 rounded petals)
  ({ palette, accent }) => (
    <g transform="translate(32 26)">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <circle key={a} cx="0" cy="-9" r="5.5" fill={palette.petal} stroke={EDGE} strokeWidth="0.6" transform={`rotate(${a})`} />
      ))}
      <circle r="7.5" fill={palette.center} stroke={EDGE} strokeWidth="0.6" />
      <circle r="3" fill={accent} />
    </g>
  ),
  // 1 — pointed star (6 lily-like petals)
  ({ palette, accent }) => (
    <g transform="translate(32 26)">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d={LILY_PETAL} fill={palette.petal} stroke={EDGE} strokeWidth="0.6" transform={`rotate(${a})`} />
      ))}
      <circle r="3.4" fill={palette.center} />
      <circle r="1.6" fill={accent} />
    </g>
  ),
  // 2 — broad two-tone ellipses (6, gradient blend)
  ({ palette, accent, gradId }) => (
    <g transform="translate(32 26)">
      {[0, 60, 120, 180, 240, 300].map((a, i) => (
        <ellipse
          key={a}
          rx="8"
          ry="13"
          cx="0"
          cy="-11"
          fill={`url(#${gradId})`}
          stroke={EDGE}
          strokeWidth="0.6"
          transform={`rotate(${a}) ${i % 2 === 1 ? "scale(0.92)" : ""}`}
        />
      ))}
      <circle r="6.5" fill={palette.center} stroke={EDGE} strokeWidth="0.6" />
      <circle r="2.4" fill={accent} />
    </g>
  ),
  // 3 — layered rose lobes (5 outer + 5 inner)
  ({ palette, accent }) => (
    <g transform="translate(32 26)">
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={`o${a}`} d={ROSE_LOBE} fill={palette.petal} stroke={EDGE} strokeWidth="0.6" transform={`rotate(${a})`} />
      ))}
      {[36, 108, 180, 252, 324].map((a) => (
        <path key={`i${a}`} d={ROSE_LOBE} fill={palette.center} stroke={EDGE} strokeWidth="0.5" transform={`rotate(${a}) scale(0.6)`} />
      ))}
      <circle r="1.8" fill={accent} />
    </g>
  ),
  // 4 — spiky (12 thin triangular petals)
  ({ palette, accent }) => (
    <g transform="translate(32 26)">
      {Array.from({ length: 12 }, (_, i) => i * 30).map((a) => (
        <path key={a} d="M0,-6 L1.8,-15 L-1.8,-15 Z" fill={palette.petal} stroke={EDGE} strokeWidth="0.4" transform={`rotate(${a})`} />
      ))}
      <circle r="5" fill={palette.center} stroke={EDGE} strokeWidth="0.6" />
      <circle r="2" fill={accent} />
    </g>
  ),
];

export function FlowerSprite({
  flower,
  size = "md",
  sway = false,
}: {
  flower: Flower;
  size?: SpriteSize;
  sway?: boolean;
}) {
  const px = PX[size];
  const gradId = `pet-${flower.id}`;
  const accent = rarityStyle(flower.rarity).dot;
  const isHybrid = flower.visualSpeciesId === 255;

  // Revealed hybrid: the encrypted genome has unsealed at least one trait slot, so we
  // render the deterministic 625-combination artwork from the on-chain revealed_trait_mask
  // (one of 5 petal × 5 color × 5 leaf × 5 stem). The SVG string is produced by the shared
  // hybrid visual system and injected on a px-sized div, matching the other sprite footprints.
  if (flower.genomeStatus === GenomeStatus.Encrypted && flower.revealedTraitMask !== 0) {
    const classes = maskToClasses(flower.revealedTraitMask);
    return (
      // The injected SVG (getHybridSVG) carries a viewBox but no width/height, so it would
      // otherwise default to the browser's replaced-element size (~300×150) and overflow the
      // pot. Force it to fill this px-sized box and clip anything past it.
      <div
        role="img"
        aria-label={getHybridDescription(classes)}
        className={`overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${
          sway ? "animate-sway origin-bottom" : "origin-bottom"
        }`}
        style={{ width: px, height: px }}
        dangerouslySetInnerHTML={{ __html: getHybridSVG(classes) }}
      />
    );
  }

  // Hybrid: compose stem/leaf/petals from the on-chain mask classes (Stage 3C).
  // With revealed_trait_mask === 0 (genome still fully sealed) this is the placeholder bloom.
  if (isHybrid) {
    const classes = decodeTraitMask(flower.revealedTraitMask);
    const palette = paletteFor(classes.color);
    const Stem = STEMS[classes.stem];
    const Leaf = LEAF[classes.leaf];
    const Petals = PETALS[classes.petal];
    return (
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`Hybrid flower (${palette.name})`}
        className={sway ? "animate-sway origin-bottom" : "origin-bottom"}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.petal} />
            <stop offset="100%" stopColor={palette.center} />
          </linearGradient>
        </defs>
        <Stem color={palette.leaf} />
        <Leaf color={palette.leaf} />
        <Petals palette={palette} accent={accent} gradId={gradId} />
      </svg>
    );
  }

  // Starter: fixed per-species silhouette (unchanged from Stage 6A).
  const skin = speciesOf(flower.visualSpeciesId);
  const Shape = SPECIES_SHAPE[flower.visualSpeciesId] ?? HybridShape;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      role="img"
      aria-label={skin.name}
      className={sway ? "animate-sway origin-bottom" : "origin-bottom"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={skin.petal} />
          <stop offset="100%" stopColor={skin.petal} />
        </linearGradient>
      </defs>
      <Shape skin={skin} accent={accent} gradId={gradId} />
    </svg>
  );
}
