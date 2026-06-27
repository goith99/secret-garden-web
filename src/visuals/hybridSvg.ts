// ============================================================
// Secret Garden Protocol — 625 Hybrid Visual System
// Auto-generated: 5 petal × 5 color × 5 leaf × 5 stem
// Usage: getHybridSVG(maskToClasses(revealedTraitMask))
// ============================================================

export interface HybridClasses {
  petal: number; // 0-4: Cluster, Star, Bell, Spiral, Wide
  color: number; // 0-4: Crimson, Golden, Teal, Violet, Pearl
  leaf:  number; // 0-4: Oval, Lance, Serrated, Round, Compound
  stem:  number; // 0-4: Straight, Curved, Branched, Winding, Stout
}

// Extract visual classes from on-chain revealed_trait_mask (u32)
export function maskToClasses(mask: number): HybridClasses {
  return {
    petal: (mask & 0xff) % 5,
    color: ((mask >> 8) & 0xff) % 5,
    leaf:  ((mask >> 16) & 0xff) % 5,
    stem:  ((mask >> 24) & 0xff) % 5,
  };
}

// Human-readable description for a hybrid
export function getHybridDescription(classes: HybridClasses): string {
  const petalNames  = ['Cluster', 'Star', 'Bell', 'Spiral', 'Wide'];
  const colorNames  = ['Crimson', 'Golden', 'Teal', 'Violet', 'Pearl'];
  const leafNames   = ['Oval', 'Lance', 'Serrated', 'Round', 'Compound'];
  const stemNames   = ['Straight', 'Curved', 'Branched', 'Winding', 'Stout'];
  const { petal, color, leaf, stem } = classes;
  return `${colorNames[color]} ${petalNames[petal]} — ${leafNames[leaf]} leaf, ${stemNames[stem]} stem`;
}

// Rarity label based on visual diversity (cosmetic only, not tied to score)
export function getHybridRarity(classes: HybridClasses): string {
  const diversity = new Set([classes.petal, classes.color, classes.leaf, classes.stem]).size;
  if (diversity === 4) return 'LEGENDARY';
  if (diversity === 3) return 'EPIC';
  if (diversity === 2) return 'RARE';
  return 'UNCOMMON';
}

// Generate SVG string for any of 625 hybrid combinations
export function getHybridSVG(classes: HybridClasses): string {
  const p = classes.petal % 5;
  const c = classes.color % 5;
  const l = classes.leaf  % 5;
  const s = classes.stem  % 5;

  // Color palettes
  const PRIMARIES   = ['#E8427A','#E8A030','#40C8B0','#8060D0','#F0EAD0'];
  const SECONDARIES = ['#B02050','#C07010','#208870','#503090','#C8B890'];
  const CENTERS     = ['#6A0030','#7A4000','#084840','#200850','#806040'];
  const ACCENTS     = ['#FF80B0','#FFD060','#80FFE0','#C0A0FF','#FFFFF0'];
  const STEM_COLS   = ['#2d6e3a','#1a5c2a','#3a7a2a','#2a6430','#1e5428'];
  const LEAF_COLS   = ['#2d7a40','#1a6830','#3a8230','#246438','#1e5c2c'];

  const pr = PRIMARIES[c];
  const se = SECONDARIES[c];
  const ce = CENTERS[c];
  const ac = ACCENTS[c];
  const sc = STEM_COLS[s];
  const lc = LEAF_COLS[l];

  // ── PETALS ──────────────────────────────────────────────
  const PETALS = [
    // 0: Cluster (Marigold-style) — dense overlapping rounds
    `<g transform="translate(32,38)">
      <circle cx="0" cy="-14" r="9" fill="${pr}"/><circle cx="10" cy="-10" r="9" fill="${pr}"/>
      <circle cx="14" cy="0" r="9" fill="${pr}"/><circle cx="10" cy="10" r="9" fill="${pr}"/>
      <circle cx="0" cy="14" r="9" fill="${pr}"/><circle cx="-10" cy="10" r="9" fill="${pr}"/>
      <circle cx="-14" cy="0" r="9" fill="${pr}"/><circle cx="-10" cy="-10" r="9" fill="${pr}"/>
      <circle cx="0" cy="-9" r="7" fill="${se}"/><circle cx="6" cy="-6" r="7" fill="${se}"/>
      <circle cx="9" cy="0" r="7" fill="${se}"/><circle cx="6" cy="6" r="7" fill="${se}"/>
      <circle cx="0" cy="9" r="7" fill="${se}"/><circle cx="-6" cy="6" r="7" fill="${se}"/>
      <circle cx="-9" cy="0" r="7" fill="${se}"/><circle cx="-6" cy="-6" r="7" fill="${se}"/>
      <circle r="8" fill="${ce}"/><circle r="4" fill="${ac}" opacity="0.6"/>
    </g>`,
    // 1: Star (Lily-style) — pointed radiating petals
    `<g transform="translate(32,38)">
      <ellipse cx="0" cy="-18" rx="5" ry="16" fill="${pr}"/>
      <ellipse cx="0" cy="-18" rx="5" ry="16" fill="${pr}" transform="rotate(60)"/>
      <ellipse cx="0" cy="-18" rx="5" ry="16" fill="${pr}" transform="rotate(120)"/>
      <ellipse cx="0" cy="-18" rx="5" ry="16" fill="${pr}" transform="rotate(180)"/>
      <ellipse cx="0" cy="-18" rx="5" ry="16" fill="${pr}" transform="rotate(240)"/>
      <ellipse cx="0" cy="-18" rx="5" ry="16" fill="${pr}" transform="rotate(300)"/>
      <circle r="7" fill="${ce}"/><circle r="3" fill="${ac}" opacity="0.7"/>
    </g>`,
    // 2: Bell (Bluebell-style) — drooping bells
    `<g transform="translate(32,38)">
      <path d="M-6,-8 Q-14,4 -10,18 Q0,24 10,18 Q14,4 6,-8 Z" fill="${pr}"/>
      <path d="M-4,-6 Q-10,4 -7,16 Q0,20 7,16 Q10,4 4,-6 Z" fill="${se}"/>
      <path d="M-8,16 L0,22 L8,16" stroke="${ce}" stroke-width="2" fill="none"/>
      <circle cx="0" cy="-12" r="5" fill="${pr}"/>
      <circle cx="-11" cy="-8" r="4" fill="${pr}" opacity="0.8"/>
      <circle cx="11" cy="-8" r="4" fill="${pr}" opacity="0.8"/>
      <circle cx="-8" cy="-18" r="3" fill="${se}" opacity="0.7"/>
      <circle cx="8" cy="-18" r="3" fill="${se}" opacity="0.7"/>
    </g>`,
    // 3: Spiral (Rose-style) — layered overlapping ellipses
    `<g transform="translate(32,38)">
      <ellipse cx="0" cy="-16" rx="8" ry="14" fill="${pr}"/>
      <ellipse cx="0" cy="-16" rx="8" ry="14" fill="${pr}" transform="rotate(72)"/>
      <ellipse cx="0" cy="-16" rx="8" ry="14" fill="${pr}" transform="rotate(144)"/>
      <ellipse cx="0" cy="-16" rx="8" ry="14" fill="${pr}" transform="rotate(216)"/>
      <ellipse cx="0" cy="-16" rx="8" ry="14" fill="${pr}" transform="rotate(288)"/>
      <ellipse cx="0" cy="-10" rx="6" ry="10" fill="${se}"/>
      <ellipse cx="0" cy="-10" rx="6" ry="10" fill="${se}" transform="rotate(72)"/>
      <ellipse cx="0" cy="-10" rx="6" ry="10" fill="${se}" transform="rotate(144)"/>
      <ellipse cx="0" cy="-10" rx="6" ry="10" fill="${se}" transform="rotate(216)"/>
      <ellipse cx="0" cy="-10" rx="6" ry="10" fill="${se}" transform="rotate(288)"/>
      <circle r="9" fill="${ce}"/><circle r="5" fill="${se}"/><circle r="2" fill="${ac}"/>
    </g>`,
    // 4: Wide (Tiger Lily-style) — broad curved petals with stamens
    `<g transform="translate(32,38)">
      <path d="M0,0 L-8,-22 Q-2,-16 0,-8 Q2,-16 8,-22 Z" fill="${pr}"/>
      <path d="M0,0 L-8,-22 Q-2,-16 0,-8 Q2,-16 8,-22 Z" fill="${pr}" transform="rotate(72)"/>
      <path d="M0,0 L-8,-22 Q-2,-16 0,-8 Q2,-16 8,-22 Z" fill="${pr}" transform="rotate(144)"/>
      <path d="M0,0 L-8,-22 Q-2,-16 0,-8 Q2,-16 8,-22 Z" fill="${pr}" transform="rotate(216)"/>
      <path d="M0,0 L-8,-22 Q-2,-16 0,-8 Q2,-16 8,-22 Z" fill="${pr}" transform="rotate(288)"/>
      <circle r="8" fill="${ce}"/>
      <line x1="0" y1="-4" x2="0" y2="-13" stroke="${ac}" stroke-width="1.5"/>
      <line x1="0" y1="-4" x2="-7" y2="-10" stroke="${ac}" stroke-width="1.5" transform="rotate(72)"/>
      <line x1="0" y1="-4" x2="-7" y2="-10" stroke="${ac}" stroke-width="1.5" transform="rotate(144)"/>
      <circle cx="0" cy="-13" r="2" fill="${ac}"/>
    </g>`,
  ];

  // ── LEAVES ──────────────────────────────────────────────
  const LEAVES = [
    // 0: Oval — simple paired ovals
    `<ellipse cx="22" cy="70" rx="10" ry="6" fill="${lc}" transform="rotate(-30 22 70)"/>
     <ellipse cx="42" cy="72" rx="10" ry="6" fill="${lc}" transform="rotate(30 42 72)"/>`,
    // 1: Lance — long pointed leaves
    `<path d="M32 68 Q14 62 16 54 Q24 64 32 68" fill="${lc}"/>
     <path d="M32 68 Q50 62 48 54 Q40 64 32 68" fill="${lc}"/>`,
    // 2: Serrated — jagged edge leaves
    `<path d="M32 72 Q22 68 18 62 Q22 64 24 60 Q26 64 28 60 Q30 64 32 72" fill="${lc}"/>
     <path d="M32 72 Q42 68 46 62 Q42 64 40 60 Q38 64 36 60 Q34 64 32 72" fill="${lc}"/>`,
    // 3: Round — wide rounded leaves
    `<ellipse cx="18" cy="68" rx="14" ry="9" fill="${lc}" transform="rotate(-20 18 68)"/>
     <ellipse cx="46" cy="68" rx="14" ry="9" fill="${lc}" transform="rotate(20 46 68)"/>`,
    // 4: Compound — multiple small leaflets
    `<path d="M32 74 Q20 70 16 64" stroke="${lc}" stroke-width="2" fill="none"/>
     <path d="M32 74 Q44 70 48 64" stroke="${lc}" stroke-width="2" fill="none"/>
     <path d="M32 74 Q18 68 16 60" stroke="${lc}" stroke-width="2" fill="none"/>
     <path d="M32 74 Q46 68 48 60" stroke="${lc}" stroke-width="2" fill="none"/>
     <circle cx="16" cy="64" r="4" fill="${lc}"/><circle cx="48" cy="64" r="4" fill="${lc}"/>
     <circle cx="15" cy="59" r="3" fill="${lc}"/><circle cx="49" cy="59" r="3" fill="${lc}"/>`,
  ];

  // ── STEMS ────────────────────────────────────────────────
  const STEMS = [
    // 0: Straight — single upright
    `<rect x="30" y="56" width="4" height="28" rx="2" fill="${sc}"/>`,
    // 1: Curved — gentle arc
    `<path d="M32 84 Q28 70 32 56" stroke="${sc}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    // 2: Branched — Y-shape
    `<rect x="30" y="68" width="4" height="16" rx="2" fill="${sc}"/>
     <path d="M32 68 Q24 62 20 56" stroke="${sc}" stroke-width="3" fill="none" stroke-linecap="round"/>
     <path d="M32 68 Q40 62 44 56" stroke="${sc}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    // 3: Winding — S-curve
    `<path d="M32 84 Q26 76 32 68 Q38 60 32 52" stroke="${sc}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    // 4: Stout — thick short
    `<rect x="28" y="64" width="8" height="20" rx="4" fill="${sc}"/>`,
  ];

  return `<svg viewBox="0 0 64 90" xmlns="http://www.w3.org/2000/svg">
  ${PETALS[p]}
  ${LEAVES[l]}
  ${STEMS[s]}
</svg>`;
}
