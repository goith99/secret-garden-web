import type { DragEvent, MouseEvent } from "react";
import type { Flower } from "../types";
import { FlowerStatus } from "../types";
import { useGame } from "../game/GameContext";
import { FlowerSprite } from "./FlowerSprite";
import { Badge } from "./Badge";
import { flowerLabel, genomeLabel, rarity as rarityStyle } from "../mocks/presentation";

/**
 * A flower on the shelf. Supports BOTH interaction models from the design doc:
 *  - Desktop: native HTML5 drag (carries the flower id) into a Parent Pot.
 *  - Mobile/touch: tap → `onActivate` (parent decides: select, or auto-place + switch tab).
 *
 * The "SUBMIT TO CHALLENGE" button (Stage 6D) submits this flower to the active competition
 * round. It's a block sibling under the card button — never nested inside it — shown only when
 * `showSubmit` is set (hybrids only; starters can't be entered). It's enabled only when a round
 * is Open and the flower is still Active; otherwise it's disabled with a "No open challenge
 * right now" tooltip. A flower already entered shows an "Entered" badge instead.
 */
export function FlowerCard({
  flower,
  selected,
  onActivate,
  showSubmit,
}: {
  flower: Flower;
  selected: boolean;
  onActivate: (flower: Flower) => void;
  /** Show the "SUBMIT TO CHALLENGE" control. Hybrids only — starters are never submittable. */
  showSubmit: boolean;
}) {
  const { canSubmit, submitFlower, submittingId, profileNeedsMigration } = useGame();
  const r = rarityStyle(flower.rarity);

  const onDragStart = (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData("text/plain", flower.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const submitted = flower.status === FlowerStatus.Submitted;
  const submitting = submittingId === flower.id;
  const goEnabled = canSubmit(flower);

  const onGo = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // don't also trigger the card's select/place
    submitFlower(flower);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
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

      {showSubmit &&
        (submitted ? (
          <span
            className="rounded-md border border-garden-gold/70 bg-garden-deep/80 px-2 py-1 text-center font-pixel text-[9px] uppercase tracking-wide text-garden-gold"
            title="Already entered in the challenge"
          >
            Entered
          </span>
        ) : (
          <button
            type="button"
            onClick={onGo}
            disabled={!goEnabled || submitting}
            title={
              goEnabled
                ? "Enter this flower in the challenge"
                : profileNeedsMigration
                  ? "Update your garden first (see notice above)"
                  : "No open challenge right now"
            }
            className={`w-full rounded-md border px-2 py-1 font-pixel text-[9px] uppercase tracking-wide transition
              focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
              ${goEnabled && !submitting
                ? "border-garden-cyan bg-garden-cyan/20 text-garden-cyan hover:bg-garden-cyan/35"
                : "cursor-not-allowed border-garden-moss/50 bg-garden-deep/60 text-garden-parch/40"}`}
          >
            {submitting ? "…" : "Submit to Challenge"}
          </button>
        ))}
    </div>
  );
}
