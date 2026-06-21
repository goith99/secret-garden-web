import type { Flower } from "../types";
import { useGame } from "../game/GameContext";
import { FlowerCard } from "./FlowerCard";

/**
 * The Flower Shelf: the player's flowers as draggable/tappable cards. Used by both the
 * desktop left column and the mobile "Flowers" tab; the parent supplies `onActivate` to
 * decide what a tap does (select vs. auto-place-and-switch-tab) and the grid density.
 */
export function FlowerShelf({
  onActivate,
  gridClassName = "grid-cols-2",
}: {
  onActivate: (flower: Flower) => void;
  gridClassName?: string;
}) {
  const { shelf, selectedFlowerId, potA, potB } = useGame();
  const inPot = new Set([potA?.id, potB?.id].filter(Boolean) as string[]);

  return (
    <div className={`grid content-start gap-2 ${gridClassName}`}>
      {shelf.map((f) => (
        // min-w-0 lets each grid item shrink to its track (default min-width:auto would
        // keep it at content size and overflow the column).
        <div key={f.id} className={`relative flex min-w-0 ${inPot.has(f.id) ? "opacity-45" : ""}`}>
          <FlowerCard flower={f} selected={selectedFlowerId === f.id} onActivate={onActivate} />
          {inPot.has(f.id) && (
            <span className="pointer-events-none absolute inset-x-0 top-1 text-center font-pixel text-[9px] uppercase tracking-wide text-garden-gold">
              in a pot
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
