import { ParentPot } from "./ParentPot";
import { HybridPot } from "./HybridPot";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { GreenhouseScene } from "./GreenhouseScene";
import { StarterGarden } from "./StarterGarden";
import { useGame } from "../game/GameContext";

/**
 * The Greenhouse — the central play area, now staged as a cozy greenhouse interior:
 *
 *   greenhouse scene (back)  →  starter flowers planted on the floor  →  the pot row floating
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
    <div className="flex h-full flex-col gap-3">
      {/* The greenhouse interior: animated scene + planted starters + floating pots. */}
      <div className="relative min-h-[400px] flex-1 overflow-hidden rounded-xl border border-garden-moss/70 bg-garden-deep/40 shadow-panel">
        <GreenhouseScene />
        <StarterGarden />

        {/* Pot row — floats above the scene with a soft drop shadow. The layer ignores
            pointer events so starters behind it stay draggable; the pots opt back in. */}
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-3">
          <div className="pointer-events-auto flex items-end justify-center gap-2 [filter:drop-shadow(0_16px_18px_rgba(0,0,0,0.45))] md:gap-4 xl:gap-6">
            <ParentPot pot="A" label="Parent A" />
            <HybridPot />
            <ParentPot pot="B" label="Parent B" />
          </div>
        </div>
      </div>

      {/* Control dials */}
      <div className="gh-panel px-3 py-3">
        <span className="gh-title mb-2 block text-[10px] text-garden-mint/80">Greenhouse Controls</span>
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
