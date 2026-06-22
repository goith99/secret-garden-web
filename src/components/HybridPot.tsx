import type { KeyboardEvent } from "react";
import { useGame } from "../game/GameContext";

/**
 * The Hybrid Pot — the focal point AND the crossbreed action (Stage 6D). There is no longer
 * a separate bottom button: clicking the pot itself drives the breeding state machine.
 *
 * States:
 *   - both pots empty        → "SEEDBED" / "AWAITING A CROSS"        (inert)
 *   - one pot filled         → "SEEDBED" / "SELECT ANOTHER FLOWER"   (inert)
 *   - both filled, idle      → "CROSSBREED" ✦, gold glow + pulse     (click → startCrossbreed)
 *   - confirming / growing   → "GROWING…", rotating sparkle + glow   (inert)
 *   - bloom ready            → 🌸 "BLOOM READY", gold glow           (click → collectBloom)
 *   - bloom failed           → 🥀 "BLOOM FAILED" / "TRY AGAIN"        (click → resetAfterFailure)
 */
export function HybridPot() {
  const {
    phase,
    isCycling,
    potA,
    potB,
    startCrossbreed,
    collectBloom,
    resetAfterFailure,
  } = useGame();

  const ready = phase === "Ready"; // both pots filled, idle — armed to cross
  const growing = isCycling;
  const bloomed = phase === "BloomReady";
  const failed = phase === "Failed";
  const oneFilled = (potA === null) !== (potB === null); // exactly one pot has a flower

  // The pot is clickable in exactly three states; pick the matching handler.
  const onActivate = ready ? startCrossbreed : bloomed ? collectBloom : failed ? resetAfterFailure : null;
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
            : bloomed
              ? "Collect the bloom"
              : failed
                ? "Bloom failed — try again"
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
            <>
              <span className="animate-rise text-5xl drop-shadow-[0_0_10px_rgba(230,194,92,0.7)]" aria-hidden>
                🌸
              </span>
              <span className="mt-1 font-pixel text-[11px] uppercase tracking-wide text-garden-gold">
                Bloom ready
              </span>
            </>
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
    </div>
  );
}
