import type { Flower } from "../types";
import { speciesOf, rarity as rarityStyle } from "../mocks/presentation";

/**
 * PLACEHOLDER SPRITE. A pure-SVG flower standing in for a future pixel-art asset
 * (no real sprite sheets exist yet). Reused by the Flower Shelf and the Parent/Hybrid
 * Pots. Petal/center colours come from the species skin; hybrids (visualSpeciesId 255)
 * blend two palette colours. Lightweight — inline SVG, no image download.
 */
export type SpriteSize = "sm" | "md" | "lg";

const PX: Record<SpriteSize, number> = { sm: 44, md: 64, lg: 92 };

export function FlowerSprite({
  flower,
  size = "md",
  sway = false,
}: {
  flower: Flower;
  size?: SpriteSize;
  sway?: boolean;
}) {
  const skin = speciesOf(flower.visualSpeciesId);
  const isHybrid = !!skin.hybrid;
  const px = PX[size];
  const gradId = `pet-${flower.id}`;
  const accent = rarityStyle(flower.rarity).dot;

  // six petals evenly spaced around the bloom center
  const petals = [0, 60, 120, 180, 240, 300];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      role="img"
      aria-label={isHybrid ? "Hybrid flower" : skin.name}
      className={sway ? "animate-sway origin-bottom" : "origin-bottom"}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={skin.petal} />
          <stop offset="100%" stopColor={isHybrid ? skin.center : skin.petal} />
        </linearGradient>
      </defs>

      {/* stem + leaf */}
      <rect x="30.5" y="34" width="3" height="24" rx="1.5" fill={skin.leaf} />
      <ellipse cx="40" cy="46" rx="7" ry="4" fill={skin.leaf} opacity="0.9" transform="rotate(28 40 46)" />

      {/* petals */}
      <g transform="translate(32 26)">
        {petals.map((deg, i) => (
          <ellipse
            key={deg}
            rx="8"
            ry="13"
            cx="0"
            cy="-11"
            fill={`url(#${gradId})`}
            stroke="rgba(0,0,0,0.18)"
            strokeWidth="0.6"
            transform={`rotate(${deg}) ${isHybrid && i % 2 === 1 ? "scale(0.92)" : ""}`}
          />
        ))}
        {/* bloom center */}
        <circle r="6.5" fill={skin.center} stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
        <circle r="2.4" fill={accent} />
      </g>
    </svg>
  );
}
