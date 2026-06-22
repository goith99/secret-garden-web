import { useGame } from "../game/GameContext";
import { PlayerButton, type ButtonVariant } from "./PlayerButton";
import type { BreedPhaseKey } from "../types";

/**
 * The crossbreed CTA. Its label is the current (mocked) phase — always an approved
 * player-facing string (never a developer term). Clicks:
 *   Ready      → start the mocked cycle
 *   BloomReady → collect the bloom (adds a journal entry, resets the pots)
 *   Failed     → try again
 * The Confirm/Waiting/Growing phases are inert (busy spinner) while the timer runs.
 */
const VARIANT_FOR: Record<BreedPhaseKey, ButtonVariant> = {
  NeedTwo: "muted",
  Ready: "primary",
  Confirm: "pending",
  Waiting: "pending",
  Growing: "pending",
  BloomReady: "success",
  Failed: "danger",
};

export function CrossbreedButton() {
  const { phase, phaseLabel, isCycling, breedError, startCrossbreed, collectBloom, resetAfterFailure, simulateFailure } =
    useGame();

  const onClick = () => {
    if (phase === "Ready") startCrossbreed();
    else if (phase === "BloomReady") collectBloom();
    else if (phase === "Failed") resetAfterFailure();
  };

  const disabled = phase === "NeedTwo" || isCycling;

  return (
    <div className="flex flex-col gap-1">
      <PlayerButton variant={VARIANT_FOR[phase]} busy={isCycling} disabled={disabled} onClick={onClick}>
        {phaseLabel}
      </PlayerButton>
      {breedError && (
        <p className="text-center font-body text-xs leading-snug text-garden-rose">{breedError}</p>
      )}
      {/* DEV-ONLY demo affordance to exercise the "Bloom Failed" label; stripped from prod. */}
      {import.meta.env.DEV && isCycling && (
        <button
          type="button"
          onClick={simulateFailure}
          className="self-end font-pixel text-[9px] uppercase tracking-wide text-garden-rose/60 hover:text-garden-rose"
        >
          ↺ demo: fail
        </button>
      )}
    </div>
  );
}
