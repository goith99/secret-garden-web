import { useState, type KeyboardEvent } from "react";
import type { Flower } from "../types";
import { FlowerStatus, GenomeStatus } from "../types";
import { useGame } from "../game/GameContext";
import { useGardener } from "../wallet/useGardener";
import { useConnectWallet } from "../wallet/ConnectWalletContext";
import { FlowerSprite } from "./FlowerSprite";

const BREEDS_SPENT_MSG =
  "You've used all your breeds for this round. Come back next round!";

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
    breedsRemaining,
    breedNotice,
    submittingId,
    profileNeedsMigration,
  } = useGame();
  const { connected } = useGardener();
  const { requestConnect } = useConnectWallet();
  // Inline "no breeds left" note, shown when an exhausted player clicks to cross.
  const [showSpentMsg, setShowSpentMsg] = useState(false);

  const ready = phase === "Ready"; // both pots filled, idle — armed to cross
  const confirming = phase === "Confirm"; // awaiting the wallet approval
  const growing = isCycling && !confirming; // signed & running (Waiting / Growing)
  const bloomed = phase === "BloomReady";
  const failed = phase === "Failed";
  const oneFilled = (potA === null) !== (potB === null); // exactly one pot has a flower
  const submitting = submittingId !== null;
  const exhausted = breedsRemaining <= 0; // per-round breed cap spent (connected/real mode)
  const needsUpdate = connected && profileNeedsMigration; // one-time migrate pending
  // The gold "Crossbreed" affordance only when a connected player can actually cross now.
  const armed = ready && connected && !exhausted && !needsUpdate;

  // What a click does, by state. Disconnected → prompt to connect (the game stays visible);
  // update pending → disabled (the notice bar drives it); exhausted → show the "come back next
  // round" note; otherwise cross / clear a failure.
  const onActivate = () => {
    if (!connected) {
      requestConnect();
      return;
    }
    if (needsUpdate) return; // disabled — the "update your garden" notice handles migration
    if (ready) {
      if (exhausted) {
        setShowSpentMsg(true);
        return;
      }
      startCrossbreed();
    } else if (failed) {
      resetAfterFailure();
    }
  };
  // Clickable whenever a click has a meaning: connect prompt, arm/cross, exhausted note, or
  // clearing a failure. Never while an update is pending (notice drives it) or at BloomReady.
  const interactive = !bloomed && (!connected || (!needsUpdate && (ready || failed)));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="gh-title text-[11px] text-garden-gold">Hybrid Pot</span>
      <div
        onClick={interactive ? onActivate : undefined}
        onKeyDown={onKeyDown}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        title={needsUpdate ? "Update your garden first (see notice above)" : undefined}
        aria-label={
          !connected
            ? "Connect your wallet to start breeding"
            : needsUpdate
              ? "Update your garden first (see notice above)"
              : armed
                ? "Crossbreed the two flowers"
                : ready && exhausted
                  ? "No breeds remaining this round"
                  : failed
                    ? "Bloom failed — try again"
                    : bloomed
                      ? "Your new bloom is ready"
                      : undefined
        }
        className={`relative flex h-32 w-32 items-end justify-center rounded-3xl border-2 outline-none transition md:h-40 md:w-40 xl:h-48 xl:w-48
          focus-visible:ring-2 focus-visible:ring-garden-cyan
          ${interactive ? "cursor-pointer" : ""}
          ${armed ? "animate-pulseSoft border-garden-gold bg-garden-gold/15 hover:bg-garden-gold/25" : ""}
          ${bloomed ? "border-garden-gold bg-garden-gold/10" : ""}
          ${failed ? "border-garden-rose bg-garden-rose/10 hover:bg-garden-rose/15" : ""}
          ${!armed && !bloomed && !failed ? "border-garden-moss bg-garden-deep/50" : ""}`}
      >
        {/* halo */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-3xl transition
            ${bloomed ? "shadow-[0_0_50px_rgba(230,194,92,0.5)]" : armed ? "shadow-[0_0_40px_rgba(230,194,92,0.4)]" : (growing || confirming) ? "animate-pulseSoft shadow-[0_0_34px_rgba(108,199,207,0.4)]" : ""}`}
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
          ) : confirming ? (
            <span className="max-w-[7rem] animate-pulseSoft font-pixel text-[10px] uppercase leading-tight tracking-wide text-garden-cyan">
              Waiting for approval…
            </span>
          ) : growing ? (
            <>
              <span className="animate-spin text-3xl drop-shadow-[0_0_8px_rgba(108,199,207,0.6)]" aria-hidden>
                ✦
              </span>
              <span className="mt-2 font-pixel text-[10px] uppercase tracking-wide text-garden-cyan">
                Growing…
              </span>
            </>
          ) : !connected ? (
            <>
              <span className="text-2xl" aria-hidden>
                🌱
              </span>
              <span className="mt-1 max-w-[7rem] font-pixel text-[10px] uppercase leading-tight tracking-wide text-garden-mint/80">
                Connect wallet to start breeding
              </span>
            </>
          ) : needsUpdate ? (
            <>
              <span className="text-2xl" aria-hidden>
                🪴
              </span>
              <span className="mt-1 max-w-[7rem] font-pixel text-[10px] uppercase leading-tight tracking-wide text-garden-gold/80">
                Update garden first
              </span>
            </>
          ) : armed ? (
            <>
              <span className="text-2xl drop-shadow-[0_0_8px_rgba(230,194,92,0.6)]" aria-hidden>
                ✦
              </span>
              <span className="mt-1 font-pixel text-[12px] uppercase tracking-[0.14em] text-garden-gold">
                Crossbreed
              </span>
            </>
          ) : ready && exhausted ? (
            <>
              <span className="font-pixel text-[10px] uppercase tracking-wide text-garden-gold/80">
                No breeds left
              </span>
              <span className="mt-1 font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40">
                Come back next round
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

      {/* "You've used all your breeds…" — shown when an exhausted player clicks to cross. */}
      {showSpentMsg && exhausted && ready && (
        <p className="max-w-[15rem] text-center font-body text-xs leading-snug text-garden-gold">
          {BREEDS_SPENT_MSG}
        </p>
      )}

      {/* Transient "Breeding cancelled." note after a declined breed (auto-hides after 3s). */}
      {breedNotice && (
        <p className="max-w-[15rem] text-center font-body text-xs leading-snug text-garden-parch/70">
          {breedNotice}
        </p>
      )}

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
