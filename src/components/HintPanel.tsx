import type { MouseEvent } from "react";
import type { HintView } from "../hooks/usePrivateHint";

/**
 * The "Check Match" result for ONE of the player's own flowers: the score this challenge
 * will actually award it, and the traits behind that number.
 *
 *   ┌────────────────────────────────────────┐
 *   │  66%                                   │
 *   │  2 of 3 traits · +20 for age           │
 *   │  ✓ Mutant                              │
 *   │  ✓ Full Bloom                          │
 *   │  ✗ Tall                                │
 *   └────────────────────────────────────────┘
 *
 * The headline number is the SCORE the challenge will award (see `scoreOf`), not the raw
 * trait fraction — those are different numbers, because age AMPLIFIES matched traits: a
 * flower earns `floor(matched / total * 70)` for its traits plus up to
 * `floor(matched / total * 30)` more for its generation. Age is a multiplier on real
 * matches, never a substitute for them, so a flower matching NOTHING scores zero at any
 * generation, and only a clean sweep reaches 100 (matching every trait at generation >= 16).
 * The line underneath says where the number came from, so the fraction and the percentage
 * never look like they disagree.
 *
 * Styled to the game's dark botanical palette (deep bed, moss border, gold/mint for a match,
 * dimmed parchment for a miss) rather than a generic score card. Player vocabulary only —
 * this is a gardener reading their own flower, so nothing about how the answer was computed
 * or sealed appears anywhere on screen.
 *
 * Rendered inline on the owning flower's card, never for another player's flower, and the
 * result is not stored anywhere: dismiss it (or reload) and it is gone.
 */
export function HintPanel({ hint, onDismiss }: { hint: HintView; onDismiss: () => void }) {
  // A top score earns gold, anything above zero mint, none the muted parchment — the same
  // "better result reads warmer" logic the rarity tiers use.
  const tone =
    hint.score === 100
      ? "text-garden-gold"
      : hint.score > 0
        ? "text-garden-mint"
        : "text-garden-parch/60";

  const dismiss = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // don't also select/place the card underneath
    onDismiss();
  };

  return (
    <div className="animate-rise rounded-md border border-garden-moss/70 bg-garden-deep/80 p-2 shadow-panel">
      <div className="mb-0.5 flex items-center justify-between gap-1">
        <span className={`font-pixel text-[10px] uppercase tracking-wide ${tone}`}>
          {/* Spoken with context — the bare number has a visible panel around it to explain
              itself, a screen reader reaching this span alone does not. */}
          <span className="sr-only">Challenge score: </span>
          {hint.score}%
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide match result"
          className="rounded px-1 font-pixel text-[10px] leading-none text-garden-parch/50 transition
            hover:text-garden-cream focus:outline-none focus-visible:ring-1 focus-visible:ring-garden-cyan"
        >
          ✕
        </button>
      </div>
      {/* Where the score came from, so a partial match scoring below its trait fraction
          does not read as a mistake. */}
      <p className="mb-1 font-body text-[10px] leading-tight text-garden-parch/55">
        {hint.matchedCount} of {hint.targetCount} traits
        {hint.generationBonus > 0 && <> · +{hint.generationBonus} for age</>}
        {/* No "capped" marker: under the synergy formula 100 is unreachable without a clean
            sweep, so a score of 100 and a partial trait line can never co-occur. The highest
            a partial match reaches is 74 (3 of 4 traits at generation >= 16). */}
      </p>
      <ul className="flex flex-col gap-0.5">
        {hint.traits.map((t) => (
          <li
            key={t.name}
            className={`flex items-start gap-1 font-body text-[10px] leading-tight ${
              t.matched ? "text-garden-mint" : "text-garden-parch/45"
            }`}
          >
            <span aria-hidden="true" className="shrink-0">
              {t.matched ? "✓" : "✗"}
            </span>
            <span className="min-w-0 break-words">{t.name}</span>
            {/* Spoken as "matched"/"not matched" so the tick isn't the only cue. */}
            <span className="sr-only">{t.matched ? "matched" : "not matched"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
