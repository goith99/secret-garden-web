import { ParentPot } from "./ParentPot";
import { HybridPot } from "./HybridPot";
import { EnvironmentSelector } from "./EnvironmentSelector";
import { NightGardenScene } from "./NightGardenScene";
import { StarterGarden } from "./StarterGarden";
import { useEffect, useRef } from "react";
import { useGame, MAX_BREEDS_PER_ROUND } from "../game/GameContext";
import { useToast } from "./Toast";
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
/**
 * Dwell time for the breeds-remaining toast, deliberately longer than the 4s default the
 * transaction toasts use. This one is a status figure the player has to read and hold
 * ("3 of 5"), not a confirmation they already expected, so it earns the extra seconds.
 * Passed per toast — see ToastApi — so it does not retime anything else.
 */
const BREEDS_TOAST_MS = 6000;

export function Greenhouse() {
  const { breedError, bloomToast, retryRefresh, breedsRemaining, challenge } = useGame();

  // Cosmetic backdrop the operator picked for this round. Defaults to the classic night
  // garden until (or unless) Supabase says otherwise, so the scene never waits on a fetch.
  const { background } = useRoundMetadata(challenge.roundId);

  // Breeds remaining surfaces as a TOAST, not as a line in the column.
  //
  // It used to be a `shrink-0` <p> between the scene and the controls strip. That put a
  // ~14px permanent row into a `h-full` flex column whose only flexible child (the scene)
  // has a hard `min-h-[200px]` floor — so once the viewport got short the column could no
  // longer absorb it, overflowed, and the scene's clipped starter row collided with the
  // text. Worse, the row appeared and disappeared with the count, so the layout shifted
  // under the player mid-session. A fixed-position toast takes zero layout space and
  // cannot collide with anything.
  //
  // Reuses the existing <Toast> system (bottom-center, z-[70], ✕ to close) rather than
  // adding a second notification mechanism.
  const toast = useToast();
  // Previous value, so the toast fires on a real CHANGE rather than on every re-render.
  // `null` until the first observation, which is what lets a page load that is ALREADY
  // under the cap announce itself once.
  const prevRemaining = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRemaining.current;
    prevRemaining.current = breedsRemaining;

    // Quiet at a full cap. `breedsRemaining` also defaults to the cap while the profile is
    // still loading (and for a disconnected/standalone wallet), so this doubles as the
    // guard against announcing a placeholder.
    if (breedsRemaining >= MAX_BREEDS_PER_ROUND) return;
    // Unchanged since the last observation — nothing happened worth interrupting for.
    if (prev !== null && prev === breedsRemaining) return;

    // Gold/⚠️ once they're gone, matching the amber the old line turned; mint/🌱 while
    // counting down, which is informational rather than a problem.
    if (breedsRemaining <= 0) toast.error("No breeds remaining this round", BREEDS_TOAST_MS);
    else
      toast.success(
        `${breedsRemaining} of ${MAX_BREEDS_PER_ROUND} breeds remaining this round`,
        BREEDS_TOAST_MS,
      );
  }, [breedsRemaining, toast]);

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
