import { useEffect, useState, type DragEvent, type MouseEvent } from "react";
import type { Flower } from "../types";
import { FlowerStatus, GenomeStatus } from "../types";
import { useGame } from "../game/GameContext";
import { FlowerSprite } from "./FlowerSprite";
import { Badge } from "./Badge";
import { HintPanel } from "./HintPanel";
import { flowerLabel, genomeLabel, rarity as rarityStyle } from "../lib/presentation";

/**
 * A flower on the shelf. Supports BOTH interaction models from the design doc:
 *  - Desktop: native HTML5 drag (carries the flower id) into a Parent Pot.
 *  - Mobile/touch: tap → `onActivate` (parent decides: select, or auto-place + switch tab).
 *
 * The "SUBMIT TO CHALLENGE" button (Stage 6D) submits this flower to the active competition
 * round. It's a block sibling under the card button — never nested inside it — shown only when
 * `showSubmit` is set (hybrids only; starters can't be entered). It's enabled only when a round
 * is Open and the flower is still Active; otherwise it's disabled with a "No open challenge
 * right now" tooltip. A flower already entered shows an "Entered" badge instead.
 *
 * "CHECK MATCH" sits above it and answers the question the player actually has before
 * submitting: does this bloom fit the current challenge? The result is private to this
 * player's own flower — see usePrivateHint — so it renders here on their own card and is
 * never fetched for anyone else's. Starters are excluded (their genome is all zeroes by
 * design, so a check would tell them nothing).
 */
export function FlowerCard({
  flower,
  selected,
  onActivate,
  showSubmit,
}: {
  flower: Flower;
  selected: boolean;
  onActivate: (flower: Flower) => void;
  /** Show the "SUBMIT TO CHALLENGE" control. Hybrids only — starters are never submittable. */
  showSubmit: boolean;
}) {
  const {
    canSubmit,
    submitFlower,
    submittingId,
    profileNeedsMigration,
    roundOpen,
    hasEnteredCurrentRound,
    hint,
    hintBusy,
    hintNotice,
    canCheckMatch,
    checkMatch,
    dismissHint,
    canRelease,
    releaseFlower,
    releasingId,
    releaseNotice,
  } = useGame();
  const r = rarityStyle(flower.rarity);
  // First click arms the release, second within ARM_MS sends it — a deliberate second step
  // for an irreversible action, without a modal interrupting the garden.
  const [armed, setArmed] = useState(false);

  const submitted = flower.status === FlowerStatus.Submitted;
  // The player already entered THIS round (one entry per round) — every other flower's submit
  // is locked out until the next round opens. `roundOpen` keeps this quiet between rounds.
  const enteredAnother = hasEnteredCurrentRound && roundOpen && !submitted;
  // Entered in the OPEN round → locked out of breeding until next round (the program rejects it).
  // Status resets to Active when a new round opens, so this clears itself then.
  const locked = submitted && roundOpen;
  const submitting = submittingId === flower.id;
  const goEnabled = canSubmit(flower);

  // Check Match. Only sealed blooms qualify — a starter's genome is all zeroes, so there is
  // nothing to check. The hint state is single-slot per wallet (one HintResult account), so
  // `myHint` is only this card's when the ids agree, and every other card's button is
  // disabled while one request runs.
  const canCheck = showSubmit && flower.genomeStatus !== GenomeStatus.Starter;
  const myHint = hint && hint.flowerId === flower.id ? hint : null;
  const checking = myHint?.phase === "requesting" || myHint?.phase === "waiting";
  const checkEnabled = canCheckMatch(flower);

  const onCheckMatch = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // don't also trigger the card's select/place
    checkMatch(flower);
  };

  // Release. Only ever offered for a flower the program would actually accept: the player's
  // own sealed bloom that is still Active. A flower mid-cross or entered in the challenge is
  // refused on-chain, so the control is simply absent rather than a button that fails —
  // the card's existing "in this round's challenge" note already explains that case.
  const releaseEligible =
    showSubmit && flower.status === FlowerStatus.Active && flower.genomeStatus === GenomeStatus.Encrypted;
  const releasing = releasingId === flower.id;
  const releaseEnabled = canRelease(flower);

  // Disarm if the player thinks better of it (or walks away) rather than leaving a card
  // primed to delete on the next stray tap.
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  const onRelease = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // don't also trigger the card's select/place
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    releaseFlower(flower);
  };

  const onDragStart = (e: DragEvent<HTMLButtonElement>) => {
    if (locked) {
      e.preventDefault(); // a locked flower can't be dragged to a pot
      return;
    }
    e.dataTransfer.setData("text/plain", flower.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const onActivateCard = () => {
    if (locked) return; // tap does nothing — the tooltip below explains why
    onActivate(flower);
  };

  const onGo = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // don't also trigger the card's select/place
    submitFlower(flower);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <button
        type="button"
        draggable={!locked}
        onDragStart={onDragStart}
        onClick={onActivateCard}
        aria-pressed={selected}
        className={`group flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border bg-garden-deep/50 p-2 transition
          hover:-translate-y-0.5 hover:border-garden-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
          ${selected ? "border-garden-gold ring-2 ring-garden-gold/60" : "border-garden-moss/70"}`}
      >
        {/* Mute the sprite only (not the whole card) when locked out of this round's breeding. */}
        <span className={locked ? "opacity-75 transition-opacity" : "transition-opacity"}>
          <FlowerSprite flower={flower} size="md" sway />
        </span>
        {/* Name wraps to ≤2 lines (centered, hyphen-safe) — never clipped mid-word. The
            nowrap `truncate` here previously forced each card's min-content to the full
            single-line name, overflowing the grid track. */}
        <span className="line-clamp-2 w-full break-words text-center font-pixel text-[11px] leading-tight text-garden-cream">
          {flowerLabel(flower.visualSpeciesId, flower.flowerIndex)}
        </span>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Badge className={`${r.text} ${r.ring}`}>{r.label}</Badge>
          <Badge className="border-garden-moss text-garden-parch" title="Generation">
            G{flower.generation}
          </Badge>
        </div>
        <span className="font-pixel text-[9px] uppercase tracking-wide text-garden-cyan/80">
          {genomeLabel(flower.genomeStatus)}
        </span>
      </button>

      {canCheck &&
        (myHint && myHint.phase === "ready" ? (
          <HintPanel hint={myHint} onDismiss={dismissHint} />
        ) : (
          <>
            <button
              type="button"
              onClick={onCheckMatch}
              disabled={!checkEnabled || checking}
              title={
                checking
                  ? "Checking this flower against the challenge…"
                  : checkEnabled
                    ? "See which of this challenge's traits this flower has"
                    : !roundOpen
                      ? "No open challenge to check against"
                      : hintBusy
                        ? "Checking another flower — one at a time"
                        : "Can't check this flower right now"
              }
              className={`w-full rounded-md border px-2 py-1 font-pixel text-[9px] uppercase tracking-wide transition
                focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
                ${checkEnabled && !checking
                  ? "border-garden-lavender/70 bg-garden-lavender/15 text-garden-lavender hover:bg-garden-lavender/30"
                  : "cursor-not-allowed border-garden-moss/50 bg-garden-deep/60 text-garden-parch/40"}`}
            >
              {checking ? (
                <span className="animate-pulseSoft">Checking…</span>
              ) : (
                "Check Match"
              )}
            </button>
            {myHint?.phase === "error" && myHint.error && (
              <span className="px-1 text-center font-body text-[9px] leading-tight text-garden-rose/80">
                {myHint.error}
              </span>
            )}
            {/* Carries its own flower id, so a declined check notes itself on the card the
                player actually clicked rather than under every card at once. */}
            {hintNotice?.flowerId === flower.id && (
              <span className="px-1 text-center font-body text-[9px] leading-tight text-garden-parch/50">
                {hintNotice.message}
              </span>
            )}
          </>
        ))}

      {showSubmit &&
        (submitted ? (
          <>
            <span
              className="rounded-md border border-garden-gold/70 bg-garden-deep/80 px-2 py-1 text-center font-pixel text-[9px] uppercase tracking-wide text-garden-gold"
              title="Already entered in the challenge"
            >
              Entered
            </span>
            {locked && (
              <span className="px-1 text-center font-body text-[9px] leading-tight text-garden-parch/50">
                In this round&apos;s challenge — available next round
              </span>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onGo}
              disabled={!goEnabled || submitting}
              title={
                goEnabled
                  ? "Enter this flower in the challenge"
                  : enteredAnother
                    ? "You've already entered a flower in this round"
                    : profileNeedsMigration
                      ? "Update your garden first (see notice above)"
                      : "No open challenge right now"
              }
              className={`w-full rounded-md border px-2 py-1 font-pixel text-[9px] uppercase tracking-wide transition
                focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
                ${goEnabled && !submitting
                  ? "border-garden-cyan bg-garden-cyan/20 text-garden-cyan hover:bg-garden-cyan/35"
                  : "cursor-not-allowed border-garden-moss/50 bg-garden-deep/60 text-garden-parch/40"}`}
            >
              {submitting ? "…" : "Submit to Challenge"}
            </button>
            {enteredAnother && (
              <span className="px-1 text-center font-body text-[9px] leading-tight text-garden-parch/50">
                Already entered this round
              </span>
            )}
          </>
        ))}

      {releaseEligible && (
        <>
          <button
            type="button"
            onClick={onRelease}
            disabled={!releaseEnabled || releasing}
            title={
              releasing
                ? "Releasing this flower…"
                : armed
                  ? "Tap again to release this flower for good"
                  : releaseEnabled
                    ? "Let this flower go and free a collection slot"
                    : "Releasing another flower — one at a time"
            }
            className={`w-full rounded-md border px-2 py-1 font-pixel text-[9px] uppercase tracking-wide transition
              focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
              ${!releaseEnabled || releasing
                ? "cursor-not-allowed border-garden-moss/40 bg-garden-deep/50 text-garden-parch/30"
                : armed
                  ? "border-garden-gold bg-garden-gold/20 text-garden-gold hover:bg-garden-gold/35"
                  : "border-garden-moss/60 bg-transparent text-garden-parch/45 hover:border-garden-gold/60 hover:text-garden-gold/80"}`}
          >
            {releasing ? "Releasing…" : armed ? "Confirm release?" : "Release"}
          </button>
          {armed && !releasing && (
            <span className="px-1 text-center font-body text-[9px] leading-tight text-garden-parch/50">
              This bloom won&apos;t come back
            </span>
          )}
          {releaseNotice?.flowerId === flower.id && (
            <span className="px-1 text-center font-body text-[9px] leading-tight text-garden-parch/50">
              {releaseNotice.message}
            </span>
          )}
        </>
      )}
    </div>
  );
}
