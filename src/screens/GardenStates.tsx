/**
 * Connected-but-not-ready states for Stage 6C, all in player vocabulary (no "loading",
 * "RPC", "error"). Shown by the connected app while real on-chain data is fetched, when a
 * fetch fails, or when a connected wallet has no garden yet.
 */
import { useState, type ReactNode } from "react";
import { PlayerButton } from "../components/PlayerButton";
import { useToast } from "../components/Toast";
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

/** Button labels for the two setup steps; idle label depends on whether only the claim is left. */
const STEP_LABEL = {
  creating: "Setting up your garden… (1 of 2)",
  claiming: "Claiming your flowers… (2 of 2)",
} as const;

/**
 * A connected wallet with no garden yet (no PlayerProfile, or one without starters). Setup is
 * TWO confirmed transactions — create_profile (1 of 2) then claim_starters (2 of 2) — so the
 * button reports which step it's on. If the profile gets created but the claim is declined, the
 * retry only re-runs the claim (the profile already exists on-chain). Success raises a toast and
 * refetches so the garden loads with the six new flowers.
 */
export function GardenEmpty({ onRefresh }: { onRefresh: () => void }) {
  const { createProfile, claimStarters, ready } = useGardenActions();
  const toast = useToast();
  const [busy, setBusy] = useState<"idle" | "creating" | "claiming">("idle");
  // Once the profile exists (step 1 done), a retry should skip straight to claiming.
  const [claimOnly, setClaimOnly] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const onSetup = async () => {
    setProblem(null);
    // Track the step in a local — state updates aren't visible to this closure after an await.
    let step: "create" | "claim" = claimOnly ? "claim" : "create";
    try {
      if (!claimOnly) {
        setBusy("creating");
        await createProfile();
      }
      step = "claim";
      setBusy("claiming");
      await claimStarters();
      toast.success(
        claimOnly
          ? "6 starter flowers claimed! Start breeding. 🌺"
          : "Welcome to Secret Garden! 🌸 Your 6 starter flowers are ready.",
      );
      onRefresh(); // reload real data — the garden now has 6 starters
    } catch (e) {
      const kind = e instanceof TxError ? e.kind : "failed";
      if (kind === "rejected") {
        if (step === "create") {
          setProblem("Setup cancelled. Tap to try again.");
        } else if (claimOnly) {
          // A claim-only retry that's declined again: re-enable, no error (their choice).
          setProblem(null);
        } else {
          // Profile created, claim declined → retry should claim only.
          setClaimOnly(true);
          setProblem("Your garden is ready but flowers couldn't be claimed. Tap to claim them.");
        }
      } else if (kind === "insufficient") {
        setProblem("Your garden needs a little more SOL to grow. Add funds and try again.");
      } else if (kind === "network") {
        setProblem(e instanceof TxError ? e.message : "Something went wrong. Check your connection and try again.");
      } else if (claimOnly) {
        toast.error("Couldn't claim flowers. Try again.");
      } else {
        setProblem("Something went wrong. Check your connection and try again.");
      }
    } finally {
      setBusy("idle");
    }
  };

  const label =
    busy !== "idle"
      ? STEP_LABEL[busy]
      : claimOnly
        ? "Claim Your Flowers"
        : "Claim Your Starter Flowers";

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
        <div className="w-64">
          <PlayerButton
            variant="action"
            busy={busy !== "idle"}
            disabled={busy !== "idle" || !ready}
            onClick={onSetup}
          >
            {label}
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
