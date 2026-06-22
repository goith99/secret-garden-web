import { CurrentRequest } from "./CurrentRequest";
import { ParentPot } from "./ParentPot";
import { HybridPot } from "./HybridPot";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { useGame } from "../game/GameContext";

/**
 * The Greenhouse — the central play area: the current request, the two parent pots flanking
 * the focal Hybrid Pot (which IS the crossbreed button now, Stage 6D), and the Light/Water/
 * Soil dials. There is no bottom CTA anymore — that removed the laptop viewport overflow.
 * Transient breeding messages (low-SOL, post-bloom refresh) surface as fixed toasts so they
 * never grow the column height.
 */
export function Greenhouse() {
  const { breedError, bloomToast, retryRefresh } = useGame();

  return (
    <div className="flex h-full flex-col gap-3">
      <CurrentRequest />

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex items-end justify-center gap-2 md:gap-4 xl:gap-6">
          <ParentPot pot="A" label="Parent A" />
          <HybridPot />
          <ParentPot pot="B" label="Parent B" />
        </div>
      </div>

      <div className="gh-panel px-3 py-3">
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
