import { ParentPot } from "./ParentPot";
import { HybridPot } from "./HybridPot";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { NightGardenScene } from "./NightGardenScene";
import { StarterGarden } from "./StarterGarden";
import { useGame } from "../game/GameContext";

/**
 * The Greenhouse — the central play area, staged as a cozy night-garden scene:
 *
 *   night garden (back)  →  starter flowers growing from the grass  →  the pot row floating
 *   above the scene  (Parent A · Hybrid Pot · Parent B)
 *
 * The pot layer is pointer-events-none with the pots re-enabled, so drags on the planted
 * starters behind/around them still register. Today's Request moved to the right info panel,
 * so the center is purely the scene + breeding controls. The Light/Water/Soil dials sit in a
 * framed control strip below the scene. Transient breeding messages surface as fixed toasts so
 * they never grow the column height.
 */
export function Greenhouse() {
  const { breedError, bloomToast, retryRefresh } = useGame();

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* The night garden: animated scene + planted starters + floating pots. A small min-h
          keeps the scene readable, but flex-1 lets it shrink so the controls strip below
          always stays fully visible at 100% zoom (1366×768) — no scroll, no cut-off. */}
      <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-xl border border-garden-moss/70 bg-garden-deep/40 shadow-panel">
        <NightGardenScene />
        <StarterGarden />

        {/* Pot row — floats in the UPPER half of the scene, clearly above the starter row in
            the lower half (no overlap at any zoom). The layer ignores pointer events so
            starters below it stay draggable; the pots opt back in. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-1/2 items-center justify-center px-3">
          <div className="pointer-events-auto flex items-end justify-center gap-2 [filter:drop-shadow(0_16px_18px_rgba(0,0,0,0.45))] md:gap-4 xl:gap-6">
            <ParentPot pot="A" label="Parent A" />
            <HybridPot />
            <ParentPot pot="B" label="Parent B" />
          </div>
        </div>
      </div>

      {/* Control dials — shrink-0 so the strip is never the element that gets clipped. */}
      <div className="gh-panel shrink-0 px-3 py-2">
        <span className="gh-title mb-1.5 block text-[10px] text-garden-mint/80">Greenhouse Controls</span>
        <EnvironmentSelector />
      </div>

      {breedError && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <p className="max-w-xs rounded-lg border border-garden-rose/70 bg-garden-deep/95 px-3 py-2 text-center font-body text-xs leading-snug text-garden-rose shadow-lg">
            {breedError}
          </p>
        </div>
      )}

      {bloomToast && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={retryRefresh}
            className="max-w-xs rounded-lg border border-garden-gold/70 bg-garden-deep/95 px-3 py-2 text-center font-body text-xs leading-snug text-garden-gold shadow-lg hover:bg-garden-deep"
          >
            {bloomToast}
          </button>
        </div>
      )}
    </div>
  );
}
