import { useState, type DragEvent } from "react";
import type { Flower, PotId } from "../types";
import { useGame } from "../game/GameContext";
import { FlowerSprite } from "./FlowerSprite";
import { flowerLabel } from "../mocks/presentation";

/**
 * A Parent Pot accepts a flower via two routes:
 *  - Desktop drag: onDrop reads the dragged flower id and places it.
 *  - Touch tap: if a flower is currently selected (mobile tap-to-select), tapping an
 *    empty/filled pot places it. Tapping a filled pot with nothing selected clears it.
 */
export function ParentPot({ pot, label }: { pot: PotId; label: string }) {
  const { shelf, potA, potB, selectedFlowerId, placeInPot, clearPot, isCycling } = useGame();
  const flower: Flower | null = pot === "A" ? potA : potB;
  const [dragOver, setDragOver] = useState(false);

  const findFlower = (id: string) => shelf.find((f) => f.id === id) ?? null;

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (isCycling) return;
    const id = e.dataTransfer.getData("text/plain");
    const f = findFlower(id);
    if (f) placeInPot(pot, f);
  };

  const onTap = () => {
    if (isCycling) return;
    if (selectedFlowerId) {
      const f = findFlower(selectedFlowerId);
      if (f) placeInPot(pot, f);
      return;
    }
    if (flower) clearPot(pot); // tap a filled pot (nothing selected) to empty it
  };

  const armed = !!selectedFlowerId; // a flower is waiting to be placed

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onClick={onTap}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isCycling) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label={flower ? `${label}: ${flowerLabel(flower.visualSpeciesId, flower.flowerIndex)}` : `${label}: empty`}
        className={`relative flex h-24 w-24 items-end justify-center rounded-2xl border-2 border-dashed transition
          md:h-28 md:w-28 xl:h-32 xl:w-32
          ${dragOver ? "border-garden-gold bg-garden-gold/10 scale-105" : "border-garden-moss bg-garden-deep/40"}
          ${armed && !flower ? "border-garden-cyan animate-pulseSoft" : ""}`}
      >
        {/* label pinned to the top INSIDE the pot box */}
        <span className="pointer-events-none absolute inset-x-0 top-1.5 z-10 gh-title text-center text-[11px] text-garden-cyan">
          {label}
        </span>
        {/* pot vessel */}
        <div className="absolute bottom-1 h-9 w-16 rounded-b-2xl rounded-t-md bg-gradient-to-b from-garden-moss to-garden-green shadow-pot md:h-10 md:w-20 xl:w-24" />
        {flower ? (
          <div className="relative z-10 -mb-1 animate-rise">
            <FlowerSprite flower={flower} size="lg" sway />
          </div>
        ) : (
          <span className="relative z-10 mb-4 px-2 text-center font-pixel text-[10px] uppercase leading-tight tracking-wide text-garden-parch/60">
            {/* desktop drags, mobile (<768px) taps — show the matching verb, single line */}
            <span className="md:hidden">Tap to place</span>
            <span className="hidden md:inline">Drop a flower</span>
          </span>
        )}
        {flower && !isCycling && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearPot(pot);
            }}
            aria-label={`Remove flower from ${label}`}
            className="absolute right-1 top-1 z-20 h-6 w-6 rounded-full border border-garden-moss bg-garden-deep/80 font-pixel text-xs text-garden-rose hover:border-garden-rose"
          >
            ×
          </button>
        )}
      </div>
      {flower && (
        <span className="max-w-[8rem] truncate font-pixel text-[10px] text-garden-cream">
          {flowerLabel(flower.visualSpeciesId, flower.flowerIndex)}
        </span>
      )}
    </div>
  );
}
