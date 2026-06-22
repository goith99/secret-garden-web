/**
 * Connected-but-not-ready states for Stage 6C, all in player vocabulary (no "loading",
 * "RPC", "error"). Shown by the connected app while real on-chain data is fetched, when a
 * fetch fails, or when a connected wallet has no garden yet.
 */
import type { ReactNode } from "react";
import { PlayerButton } from "../components/PlayerButton";

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">{children}</div>
    </main>
  );
}

/** While the garden's on-chain data is being read. */
export function GardenLoading() {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden
          className="h-7 w-7 animate-spin rounded-full border-2 border-garden-moss border-t-garden-mint"
        />
        <p className="font-pixel text-sm uppercase tracking-[0.18em] text-garden-mint">
          Tending your garden…
        </p>
      </div>
    </Centered>
  );
}

/** A connected wallet that has never claimed starters (no PlayerProfile on-chain). */
export function GardenEmpty({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-4">
        <span className="text-4xl" aria-hidden>
          🌱
        </span>
        <h2 className="font-pixel text-lg uppercase tracking-[0.18em] text-garden-mint">
          Your garden is empty
        </h2>
        <p className="font-body text-sm leading-relaxed text-garden-parch/80">
          Claim your starter flowers to begin. Planting opens in the next update —
          check back once your starters are sown.
        </p>
        <div className="w-44">
          <PlayerButton variant="muted" onClick={onRefresh}>
            Check again
          </PlayerButton>
        </div>
      </div>
    </Centered>
  );
}

/** A fetch failed — offer a retry instead of crashing. */
export function GardenError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-4">
        <span className="text-4xl" aria-hidden>
          🥀
        </span>
        <h2 className="font-pixel text-base uppercase tracking-[0.16em] text-garden-rose">
          The garden is out of reach
        </h2>
        <p className="font-body text-sm leading-relaxed text-garden-parch/80">{message}</p>
        <div className="w-44">
          <PlayerButton variant="action" onClick={onRetry}>
            Try again
          </PlayerButton>
        </div>
      </div>
    </Centered>
  );
}
