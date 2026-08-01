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

/**
 * A connected wallet with no garden yet: either no PlayerProfile at all, or one whose
 * `starter_claimed` is still false. Setup is TWO confirmed transactions — create_profile
 * (1 of 2) then claim_starters (2 of 2) — so the button reports which step it's on.
 *
 * `profileExists` is the on-chain answer to "is step 1 already done": App reads it from the
 * profile account, so a player who confirmed create_profile and then declined (or closed the
 * tab on) claim_starters comes back to a screen that retries the CLAIM ONLY. Relying on local
 * state for that was the bug — a reload reset it, and re-running create_profile against an
 * existing PDA is pointless. Success raises a toast and refetches so the garden loads with the
 * six new flowers.
 */
export function GardenEmpty({
  onRefresh,
  profileExists = false,
}: {
  onRefresh: () => void;
  profileExists?: boolean;
}) {
  const { createProfile, claimStarters, ready } = useGardenActions();
  const toast = useToast();
  const [busy, setBusy] = useState<"idle" | "creating" | "claiming">("idle");
  // Step 1 done DURING this mount. Combined with the on-chain `profileExists` below rather
  // than seeded from it, so a refetch that flips `profileExists` can't be shadowed by a stale
  // useState initial value.
  const [profileMade, setProfileMade] = useState(false);
  const claimOnly = profileExists || profileMade;
  const [problem, setProblem] = useState<string | null>(null);
  // Starters are claimed and confirmed on-chain; we're only waiting for the read to catch up.
  // Without this, a refetch that still returns the pre-claim profile would put the claim button
  // back in front of the player, and a second claim_starters would fail on-chain.
  const [claimed, setClaimed] = useState(false);

  const onSetup = async () => {
    setProblem(null);
    // Track the step in a local — state updates aren't visible to this closure after an await.
    let step: "create" | "claim" = claimOnly ? "claim" : "create";
    try {
      if (!claimOnly) {
        setBusy("creating");
        await createProfile();
        setProfileMade(true); // step 1 confirmed — any retry from here is claim-only
      }
      step = "claim";
      setBusy("claiming");
      await claimStarters();
      setClaimed(true);
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
          // Nothing was created — a plain cancel. Button re-enables, no toast.
          setProblem("Setup cancelled. Tap to try again.");
        } else {
          // The profile is on-chain either way (we just made it, or it already was), so the
          // retry must be claim-only. setProfileMade is idempotent when profileExists is true.
          setProfileMade(true);
          setProblem("Your garden is ready, but the flowers weren't claimed. Tap to try again.");
        }
      } else if (kind === "insufficient") {
        setProblem("Your garden needs a little more SOL to grow. Add funds and try again.");
      } else if (kind === "network") {
        setProblem(e instanceof TxError ? e.message : "Something went wrong. Try again.");
      } else {
        // A genuine failure at either step (not a decline) — generic toast, per spec.
        if (step === "claim") setProfileMade(true);
        toast.error("Something went wrong. Try again.");
      }
    } finally {
      setBusy("idle");
    }
  };

  const label =
    busy === "creating"
      ? "Setting up your garden… (1 of 2)"
      : busy === "claiming"
        ? claimOnly
          ? "Claiming your flowers…"
          : "Claiming your flowers… (2 of 2)"
        : claimed
          ? "Growing your garden…"
          : "Claim Your Starter Flowers";

  return (
    <Centered>
      <div className="flex flex-col items-center gap-4">
        <span className="text-4xl" aria-hidden>
          🌱
        </span>
        <h2 className="font-pixel text-lg uppercase tracking-[0.18em] text-garden-mint">
          {claimed
            ? "Your flowers are planted"
            : claimOnly
              ? "Your garden is ready"
              : "Your garden is empty"}
        </h2>
        <p className="font-body text-sm leading-relaxed text-garden-parch/80">
          {claimed
            ? "All six starters are yours. Loading your garden…"
            : claimOnly
              ? "One step left — claim your six starter flowers to begin."
              : "Claim your six starter flowers to begin growing and crossbreeding."}
        </p>
        <div className="w-64">
          <PlayerButton
            variant="action"
            busy={busy !== "idle" || claimed}
            disabled={busy !== "idle" || claimed || !ready}
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
