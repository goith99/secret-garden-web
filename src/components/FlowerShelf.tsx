import type { Flower } from "../types";
import { useGame } from "../game/GameContext";
import { FlowerCard } from "./FlowerCard";

/**
 * A 2-column grid of flower cards. The caller supplies the exact `flowers` to render (the
 * Starter Shelf and Hybrid Collection sections each pass their own subset) and whether those
 * cards carry a "SUBMIT TO CHALLENGE" control (`showSubmit` — hybrids only). `onActivate`
 * decides what a tap does (desktop: select; mobile: auto-place + switch tab). Flowers already
 * sitting in a pot are dimmed with an "in a pot" overlay.
 */
export function FlowerShelf({
  flowers,
  onActivate,
  showSubmit,
  gridClassName = "grid-cols-2",
}: {
  flowers: Flower[];
  onActivate: (flower: Flower) => void;
  showSubmit: boolean;
  gridClassName?: string;
}) {
  const { selectedFlowerId, potA, potB } = useGame();
  const inPot = new Set([potA?.id, potB?.id].filter(Boolean) as string[]);

  return (
    <div className={`grid content-start gap-2 ${gridClassName}`}>
      {flowers.map((f) => (
        // min-w-0 lets each grid item shrink to its track (default min-width:auto would
        // keep it at content size and overflow the column).
        <div key={f.id} className={`relative flex min-w-0 ${inPot.has(f.id) ? "opacity-45" : ""}`}>
          <FlowerCard
            flower={f}
            selected={selectedFlowerId === f.id}
            onActivate={onActivate}
            showSubmit={showSubmit}
          />
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
