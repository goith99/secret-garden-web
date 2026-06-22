/**
 * Connected-but-not-ready states for Stage 6C, all in player vocabulary (no "loading",
 * "RPC", "error"). Shown by the connected app while real on-chain data is fetched, when a
 * fetch fails, or when a connected wallet has no garden yet.
 */
import { useState, type ReactNode } from "react";
import { PlayerButton } from "../components/PlayerButton";
import { useGardenActions, TxError } from "../program/transactions";

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

/**
 * A connected wallet that has never claimed starters (no PlayerProfile on-chain). The
 * "Claim Your Starter Flowers" button sends the real claim_starters transaction (Stage 6D)
 * and, on success, refetches so the garden loads with the six new flowers.
 */
export function GardenEmpty({ onRefresh }: { onRefresh: () => void }) {
  const { claimStarters, ready } = useGardenActions();
  const [claiming, setClaiming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const onClaim = async () => {
    setProblem(null);
    setClaiming(true);
    try {
      await claimStarters();
      onRefresh(); // reload real data — the garden now has 6 starters
    } catch (e) {
      // Wallet declined → silently return; on-chain/funds problems → a player-vocabulary line.
      if (e instanceof TxError) {
        if (e.kind === "insufficient") {
          setProblem(
            "Your garden needs a little more SOL to grow. Add funds and try again.",
          );
        } else if (e.kind !== "rejected") {
          setProblem("Something went wrong. Try again.");
        }
      } else {
        setProblem("Something went wrong. Try again.");
      }
    } finally {
      setClaiming(false);
    }
  };

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
          Claim your six starter flowers to begin growing and crossbreeding.
        </p>
        <div className="w-56">
          <PlayerButton
            variant="action"
            busy={claiming}
            disabled={claiming || !ready}
            onClick={onClaim}
          >
            Claim Your Starter Flowers
          </PlayerButton>
        </div>
        {problem && (
          <p className="font-body text-sm leading-relaxed text-garden-rose">{problem}</p>
        )}
        <button
          type="button"
          onClick={onRefresh}
          className="font-pixel text-[10px] uppercase tracking-wide text-garden-parch/60 hover:text-garden-mint"
        >
          Check again
        </button>
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
