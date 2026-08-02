import type { MouseEvent } from "react";
import type { HintView } from "../hooks/usePrivateHint";

/**
 * The "Check Match" result for ONE of the player's own flowers: the score this challenge
 * will actually award it, and the traits behind that number.
 *
 *   ┌──────────────────────────────┐
 *   │  Score: 100                  │
 *   │  1 of 3 traits · +90 for age │
 *   │  ✓ Mutant                    │
 *   │  ✗ Full Bloom                │
 *   │  ✗ Tall                      │
 *   └──────────────────────────────┘
 *
 * The headline is the SCORE, not the trait fraction, because those are different numbers:
 * an older flower earns +5 per generation on top of its traits, which is why a flower can
 * read 1 of 3 traits and still score 100. Showing the fraction on its own line keeps that
 * from looking like a bug — the score is the number that decides the round, and the line
 * under it says where the score came from.
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
          Score: {hint.score}
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
      {/* Where the score came from. Without this, an old flower matching one trait and
          scoring 100 reads as a mistake. */}
      <p className="mb-1 font-body text-[10px] leading-tight text-garden-parch/55">
        {hint.matchedCount} of {hint.targetCount} traits
        {hint.generationBonus > 0 && <> · +{hint.generationBonus} for age</>}
        {/* Reached the 100 cap on age rather than a clean sweep — say so, otherwise the
            trait line and the score look like they disagree. */}
        {hint.score === 100 && hint.matchedCount < hint.targetCount && <> · maxed</>}
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
