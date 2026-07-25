import type { MouseEvent } from "react";
import type { HintView } from "../hooks/usePrivateHint";

/**
 * The "Check Match" result for ONE of the player's own flowers: how much of the current
 * challenge it satisfies, trait by trait.
 *
 *   ┌─────────────────────────┐
 *   │  Match: 33%             │
 *   │  ✓ Mutant               │
 *   │  ✗ Full Bloom           │
 *   │  ✗ Tall                 │
 *   └─────────────────────────┘
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
  // A full match earns gold, a partial one mint, none the muted parchment — the same
  // "better result reads warmer" logic the rarity tiers use.
  const tone =
    hint.percentage === 100
      ? "text-garden-gold"
      : hint.percentage > 0
        ? "text-garden-mint"
        : "text-garden-parch/60";

  const dismiss = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // don't also select/place the card underneath
    onDismiss();
  };

  return (
    <div className="animate-rise rounded-md border border-garden-moss/70 bg-garden-deep/80 p-2 shadow-panel">
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className={`font-pixel text-[10px] uppercase tracking-wide ${tone}`}>
          Match: {hint.percentage}%
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
