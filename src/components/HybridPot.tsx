import type { KeyboardEvent } from "react";
import type { Flower } from "../types";
import { FlowerStatus, GenomeStatus } from "../types";
import { useGame } from "../game/GameContext";
import { FlowerSprite } from "./FlowerSprite";

/**
 * The Hybrid Pot — the focal point AND the crossbreed action (Stage 6D). Clicking the pot
 * drives the breeding state machine, EXCEPT at BloomReady: there the new flower is shown
 * growing inside the pot and the player chooses what to do with it via two buttons below.
 *
 * States:
 *   - both pots empty        → "SEEDBED" / "AWAITING A CROSS"        (inert)
 *   - one pot filled         → "SEEDBED" / "SELECT ANOTHER FLOWER"   (inert)
 *   - both filled, idle      → "CROSSBREED" ✦, gold glow + pulse     (click → startCrossbreed)
 *   - confirming / growing   → "GROWING…", rotating sparkle + glow   (inert)
 *   - bloom ready            → 🌸 the new bloom + Submit / Save buttons (buttons drive it)
 *   - bloom failed           → 🥀 "BLOOM FAILED" / "TRY AGAIN"        (click → resetAfterFailure)
 */

// Shown if the offspring read missed (non-fatal) — a generic sealed bloom placeholder.
const BLOOM_PLACEHOLDER: Flower = {
  id: "new-bloom",
  owner: "",
  flowerIndex: 0,
  visualSpeciesId: 255,
  generation: 1,
  rarity: 1,
  stability: 50,
  revealedTraitMask: 0,
  genomeStatus: GenomeStatus.Encrypted,
  status: FlowerStatus.Active,
  parentA: null,
  parentB: null,
  createdAt: 0,
};

export function HybridPot() {
  const {
    phase,
    isCycling,
    potA,
    potB,
    startCrossbreed,
    collectBloom,
    submitBloom,
    resetAfterFailure,
    newBloom,
    roundOpen,
    submittingId,
  } = useGame();

  const ready = phase === "Ready"; // both pots filled, idle — armed to cross
  const growing = isCycling;
  const bloomed = phase === "BloomReady";
  const failed = phase === "Failed";
  const oneFilled = (potA === null) !== (potB === null); // exactly one pot has a flower
  const submitting = submittingId !== null;

  // The pot is clickable to start a cross or to clear a failure — never at BloomReady, where
  // the buttons below own the action.
  const onActivate = ready ? startCrossbreed : failed ? resetAfterFailure : null;
  const interactive = onActivate !== null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate?.();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="gh-title text-[11px] text-garden-gold">Hybrid Pot</span>
      <div
        onClick={interactive ? () => onActivate?.() : undefined}
        onKeyDown={onKeyDown}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          ready
            ? "Crossbreed the two flowers"
            : failed
              ? "Bloom failed — try again"
              : bloomed
                ? "Your new bloom is ready"
                : undefined
        }
        className={`relative flex h-32 w-32 items-end justify-center rounded-3xl border-2 outline-none transition md:h-40 md:w-40 xl:h-48 xl:w-48
          focus-visible:ring-2 focus-visible:ring-garden-cyan
          ${interactive ? "cursor-pointer" : ""}
          ${ready ? "animate-pulseSoft border-garden-gold bg-garden-gold/15 hover:bg-garden-gold/25" : ""}
          ${bloomed ? "border-garden-gold bg-garden-gold/10" : ""}
          ${failed ? "border-garden-rose bg-garden-rose/10 hover:bg-garden-rose/15" : ""}
          ${!ready && !bloomed && !failed ? "border-garden-moss bg-garden-deep/50" : ""}`}
      >
        {/* halo */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-3xl transition
            ${bloomed ? "shadow-[0_0_50px_rgba(230,194,92,0.5)]" : ready ? "shadow-[0_0_40px_rgba(230,194,92,0.4)]" : growing ? "animate-pulseSoft shadow-[0_0_34px_rgba(108,199,207,0.4)]" : ""}`}
        />
        {/* pot vessel */}
        <div className="absolute bottom-2 h-12 w-24 rounded-b-3xl rounded-t-md bg-gradient-to-b from-garden-moss to-garden-green shadow-pot md:h-14 md:w-28 xl:w-32" />

        <div className="relative z-10 mb-5 flex flex-col items-center text-center">
          {failed ? (
            <>
              <span className="text-4xl" aria-hidden>
                🥀
              </span>
              <span className="mt-1 font-pixel text-[11px] uppercase tracking-wide text-garden-rose">
                Bloom failed
              </span>
              <span className="font-pixel text-[9px] uppercase tracking-wide text-garden-rose/70">
                Try again
              </span>
            </>
          ) : bloomed ? (
            <div className="-mb-1 flex animate-rise flex-col items-center">
              <FlowerSprite flower={newBloom ?? BLOOM_PLACEHOLDER} size="lg" sway />
              <span className="mt-1 font-pixel text-[10px] uppercase tracking-wide text-garden-gold">
                New bloom
              </span>
            </div>
          ) : growing ? (
            <>
              <span className="animate-spin text-3xl drop-shadow-[0_0_8px_rgba(108,199,207,0.6)]" aria-hidden>
                ✦
              </span>
              <span className="mt-2 font-pixel text-[10px] uppercase tracking-wide text-garden-cyan">
                Growing…
              </span>
            </>
          ) : ready ? (
            <>
              <span className="text-2xl drop-shadow-[0_0_8px_rgba(230,194,92,0.6)]" aria-hidden>
                ✦
              </span>
              <span className="mt-1 font-pixel text-[12px] uppercase tracking-[0.14em] text-garden-gold">
                Crossbreed
              </span>
            </>
          ) : (
            <>
              <span className="font-pixel text-[10px] uppercase tracking-wide text-garden-parch/50">
                Seedbed
              </span>
              <span className="mt-1 font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40">
                {oneFilled ? "Select another flower" : "Awaiting a cross"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* BloomReady actions — Submit (if a round is open) + Save. Player vocabulary only. */}
      {bloomed && (
        <div className="flex w-full max-w-[15rem] flex-col items-center gap-2">
          {roundOpen ? (
            <button
              type="button"
              onClick={submitBloom}
              disabled={submitting}
              className={`w-full rounded-md border px-3 py-1.5 font-pixel text-[10px] uppercase tracking-wide transition
                focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
                ${submitting
                  ? "cursor-not-allowed border-garden-moss/50 bg-garden-deep/60 text-garden-parch/40"
                  : "border-garden-gold bg-garden-gold/20 text-garden-gold hover:bg-garden-gold/35"}`}
            >
              {submitting ? "…" : "Submit to Challenge"}
            </button>
          ) : (
            <p className="font-pixel text-[9px] uppercase tracking-wide text-garden-parch/50">
              No open challenge right now
            </p>
          )}
          <button
            type="button"
            onClick={collectBloom}
            disabled={submitting}
            className={`w-full rounded-md border px-3 py-1.5 font-pixel text-[10px] uppercase tracking-wide transition
              focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
              ${submitting
                ? "cursor-not-allowed border-garden-moss/50 bg-garden-deep/60 text-garden-parch/40"
                : "border-garden-cyan bg-garden-cyan/15 text-garden-cyan hover:bg-garden-cyan/30"}`}
          >
            Save to Collection
          </button>
        </div>
      )}
    </div>
  );
}
