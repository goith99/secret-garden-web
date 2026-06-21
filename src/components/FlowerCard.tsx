import type { DragEvent } from "react";
import type { Flower } from "../types";
import { FlowerSprite } from "./FlowerSprite";
import { Badge } from "./Badge";
import { flowerLabel, genomeLabel, rarity as rarityStyle } from "../mocks/presentation";

/**
 * A flower on the shelf. Supports BOTH interaction models from the design doc:
 *  - Desktop: native HTML5 drag (carries the flower id) into a Parent Pot.
 *  - Mobile/touch: tap → `onActivate` (parent decides: select, or auto-place + switch tab).
 */
export function FlowerCard({
  flower,
  selected,
  onActivate,
}: {
  flower: Flower;
  selected: boolean;
  onActivate: (flower: Flower) => void;
}) {
  const r = rarityStyle(flower.rarity);

  const onDragStart = (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData("text/plain", flower.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={() => onActivate(flower)}
      aria-pressed={selected}
      className={`group flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border bg-garden-deep/50 p-2 transition
        hover:-translate-y-0.5 hover:border-garden-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
        ${selected ? "border-garden-gold ring-2 ring-garden-gold/60" : "border-garden-moss/70"}`}
    >
      <FlowerSprite flower={flower} size="md" sway />
      {/* Name wraps to ≤2 lines (centered, hyphen-safe) — never clipped mid-word. The
          nowrap `truncate` here previously forced each card's min-content to the full
          single-line name, overflowing the grid track. */}
      <span className="line-clamp-2 w-full break-words text-center font-pixel text-[11px] leading-tight text-garden-cream">
        {flowerLabel(flower.visualSpeciesId, flower.flowerIndex)}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Badge className={`${r.text} ${r.ring}`}>{r.label}</Badge>
        <Badge className="border-garden-moss text-garden-parch" title="Generation">
          G{flower.generation}
        </Badge>
      </div>
      <span className="font-pixel text-[9px] uppercase tracking-wide text-garden-cyan/80">
        {genomeLabel(flower.genomeStatus)}
      </span>
    </button>
  );
}
