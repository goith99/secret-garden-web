import { ParentPot } from "./ParentPot";
import { HybridPot } from "./HybridPot";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { NightGardenScene } from "./NightGardenScene";
import { StarterGarden } from "./StarterGarden";
import { useGame } from "../game/GameContext";
import { useRoundMetadata } from "../hooks/useRoundMetadata";

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
  const { breedError, bloomToast, retryRefresh, breedsRemaining, challenge } = useGame();

  // Cosmetic backdrop the operator picked for this round. Defaults to the classic night
  // garden until (or unless) Supabase says otherwise, so the scene never waits on a fetch.
  const { background } = useRoundMetadata(challenge.roundId);

  // Informational only: stays quiet at a full cap (5), counts down as breeds are spent, and
  // turns to a gentle amber warning once they're gone. Player vocabulary — no on-chain terms.
  const showBreedsLeft = breedsRemaining < 5;
  const breedsSpent = breedsRemaining <= 0;

  return (
    // Desktop (lg+, matching App's 1024px layout switch) keeps the no-page-scroll contract:
    // h-full, and the scene shrinks so the controls strip is always visible. Mobile CANNOT
    // honour that — a phone has no room for the pot row PLUS the BloomReady action — so there
    // the column takes AT LEAST the viewport and is free to grow past it, letting MobileLayout's
    // already-scrollable <main> carry the overflow. Without this the BloomReady button
    // ("Save to Collection") was laid out below the fold of a clipped, unscrollable box and
    // could not be reached at all.
    <div className="flex min-h-full flex-col gap-2 lg:h-full lg:min-h-0">
      {/* The night garden: animated scene + planted starters + floating pots. A small min-h
          keeps the scene readable, but flex-1 lets it shrink so the controls strip below
          always stays fully visible at 100% zoom (1366×768) — no scroll, no cut-off.

          `overflow-x-clip` (NOT overflow-hidden): the pot row is three fixed-width pots and can
          still be a few px wider than a narrow phone. Clipping only the X axis keeps that from
          becoming a page-wide horizontal scroll, while leaving overflow-y visible — `hidden` or
          `auto` on one axis forces the other to `auto` and would re-clip the BloomReady buttons. */}
      <div className="relative flex min-h-[200px] flex-1 flex-col overflow-x-clip rounded-xl border border-garden-moss/70 bg-garden-deep/40 shadow-panel">
        {/* Backdrop only. It owns the rounded clip that used to live on the box itself — the box
            must NOT clip, or a play layer taller than the scene is silently cut off (see above).
            The scene is absolutely positioned, so it never contributes to the box's height. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
          <NightGardenScene theme={background} />
        </div>

        {/* Foreground play layer: pots in a top band, starters in a bottom band. A flex column
            with justify-between keeps the two bands apart at ANY scene height, so filled /
            BloomReady pots never collide with the starter row (the old absolute top-half + bottom
            layers overlapped at 1366×768). IN FLOW (not absolute) so its content is what sets the
            scene's minimum height: a taller pot column grows the box instead of overflowing it.
            The layer passes pointer events through to the scene; the pots and starters opt back in. */}
        <div className="pointer-events-none relative z-10 flex flex-1 flex-col justify-between gap-2 px-1 py-2 md:px-3">
          {/* Pot row (top band) — fixed min-height so it always reserves space. */}
          <div className="flex min-h-[7rem] shrink-0 items-end justify-center">
            <div className="pointer-events-auto flex items-end justify-center gap-1 [filter:drop-shadow(0_16px_18px_rgba(0,0,0,0.45))] md:gap-4 xl:gap-6">
              <ParentPot pot="A" label="Parent A" />
              <HybridPot />
              <ParentPot pot="B" label="Parent B" />
            </div>
          </div>

          {/* Starter flowers (bottom band) */}
          <StarterGarden />
        </div>
      </div>

      {/* Breeds remaining this round — small, informational, below the pot area. */}
      {showBreedsLeft && (
        <p
          className={`shrink-0 text-center font-pixel text-[9px] uppercase tracking-wide ${
            breedsSpent ? "text-garden-gold" : "text-garden-parch/40"
          }`}
        >
          {breedsSpent
            ? "No breeds remaining this round"
            : `${breedsRemaining} of 5 breeds remaining this round`}
        </p>
      )}

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
