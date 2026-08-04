/**
 * Hidden OPERATOR panel — internal authority tooling, NOT part of the player surface.
 *
 * It is mounted only by <AppHeader> when the connected wallet equals GameConfig.authority,
 * so this component assumes it is already authorized. It drives the five authority-only
 * instructions (close_round, queue_score_entry, queue_reveal_top3, finalize_round,
 * open_round) through useOperatorActions(), refetching the shared garden data after each so
 * the read-only status reflects the new chain state.
 *
 * The actions are laid out in the order they must actually be run — Close, Score, Reveal,
 * Finalize, Open — because open_round refuses to run until the previous round is Finalized.
 *
 * Technical vocabulary is fine here (round, entry, score, reveal) — operators are not the
 * cozy-greenhouse audience the rest of the UI is written for.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useGame } from "../game/GameContext";
import { RoundStatus } from "../types";
import {
  TxError,
  useOperatorActions,
  type OperatorEntry,
} from "../program/transactions";
import {
  DEFAULT_BACKGROUND,
  GARDEN_BACKGROUNDS,
  saveRoundMetadata,
  type GardenBackground,
} from "../hooks/useRoundMetadata";
import { useGardener } from "../wallet/useGardener";

/** Matches the round_metadata_name_len table constraint, and what the UI can show. */
const NAME_MAX = 60;

const STATUS_LABEL: Record<number, string> = {
  [RoundStatus.Open]: "Open",
  [RoundStatus.Closed]: "Closing",
  [RoundStatus.Finalized]: "Finalized",
};

function errText(e: unknown): string {
  if (e instanceof TxError) {
    if (e.kind === "rejected") return "Transaction cancelled in wallet.";
    if (e.kind === "insufficient") return "Not enough SOL to pay transaction fees.";
    if (e.kind === "network") return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

export function OperatorPanel({ onClose }: { onClose: () => void }) {
  const { challenge, refetchGarden } = useGame();
  const operator = useOperatorActions();
  // Same connected wallet the panel is gated on; used here to sign the off-chain proof that
  // authorises the round-metadata write.
  const { address, signMessage } = useGardener();

  const [entries, setEntries] = useState<OperatorEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cosmetic, off-chain extras for the NEXT round — written to Supabase after open_round
  // confirms. Both are optional: a blank name and the default background are valid.
  const [roundName, setRoundName] = useState("");
  const [background, setBackground] = useState<GardenBackground>(DEFAULT_BACKGROUND);

  const roundId = challenge.roundId;
  const isOpen = challenge.status === RoundStatus.Open && roundId > 0;
  const isClosed = challenge.status === RoundStatus.Closed;

  const total = entries?.length ?? challenge.participantCount;
  const scoredN = entries
    ? entries.filter((e) => e.scored).length
    : challenge.scoredCount;
  const unscoredN = entries
    ? entries.filter((e) => !e.scored).length
    : Math.max(0, total - scoredN);
  const allScored = total > 0 && scoredN >= total;

  /**
   * Finalize is ONE-WAY: there is no un-finalize instruction, and both queue_score_entry and
   * queue_reveal_top3 require status == Closed. Finalizing a round that still has unscored
   * entries or an unrevealed top 3 therefore destroys them for good.
   *
   * The chain is deliberately looser than this — finalize_round.rs checks only
   * `status == Closed`. We do NOT mirror that literally, because a mis-click would silently
   * cost real players their results. But the guard is skipped entirely for an empty round:
   * with no entries there is nothing to score or reveal (and `allScored` is false by
   * definition when `total === 0`), so gating on it would strand every 0-entrant round
   * exactly as the missing button did.
   */
  const canFinalize = isClosed && (total === 0 || (allScored && challenge.scoringRevealed));

  const loadEntries = useCallback(async () => {
    if (roundId <= 0) {
      setEntries([]);
      return;
    }
    try {
      setEntries(await operator.fetchRoundEntries(roundId));
    } catch (e) {
      setError(errText(e));
    }
  }, [operator, roundId]);

  // Load the round's entries once when the panel opens (and whenever the round changes).
  // loadEntries only setStates after awaited chain reads — an async callback reacting to
  // external (chain) state, the same pattern useGardenData uses; scoped-disable the rule.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEntries();
  }, [loadEntries]);

  const afterAction = useCallback(
    async (msg: string) => {
      setMessage(msg);
      await refetchGarden();
      await loadEntries();
    },
    [refetchGarden, loadEntries],
  );

  const onOpenRound = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { roundId: openedId } = await operator.openRound();

      // The round is live on-chain from here on. Saving its name/background is decoration on
      // top of that — it needs a SECOND wallet approval (a free message signature, not a
      // transaction) to prove operator ownership to the edge function. Declining that prompt,
      // or any failure past it, is reported as a warning; never as a failed open.
      let saveWarning: string | null = null;
      try {
        await saveRoundMetadata(openedId, roundName, background, { address, signMessage });
      } catch (e) {
        saveWarning = `Round ${openedId} is open, but its name and background were not saved: ${errText(e)}`;
      }

      setRoundName("");
      setBackground(DEFAULT_BACKGROUND);
      await afterAction(`Round ${openedId} is now open!`);
      if (saveWarning) setError(saveWarning);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [operator, afterAction, roundName, background, address, signMessage]);

  const onCloseRound = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await operator.closeRound(roundId);
      await afterAction("Round closed. Ready to score.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [operator, afterAction, roundId]);

  const onScoreEntries = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const all = await operator.fetchRoundEntries(roundId);
      const todo = all.filter((e) => !e.scored);
      if (todo.length === 0) {
        setMessage("All entries are already scored. Ready to reveal.");
        return;
      }
      for (let i = 0; i < todo.length; i++) {
        setMessage(`Scoring entry ${i + 1} of ${todo.length}...`);
        await operator.queueScoreEntry(todo[i].pubkey);
      }
      await afterAction("All entries scored. Ready to reveal.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [operator, afterAction, roundId]);

  const onRevealWinners = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await operator.queueRevealTop3(roundId);
      await afterAction("Winners revealed!");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [operator, afterAction, roundId]);

  const onFinalizeRound = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await operator.finalizeRound(roundId);
      await afterAction(`Round ${roundId} finalized. You can open the next round now.`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }, [operator, afterAction, roundId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Garden Operator Panel"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-garden-cyan/40 bg-garden-deep shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-garden-moss/60 px-4 py-3">
          <h2 className="font-pixel text-sm uppercase tracking-[0.2em] text-garden-cyan">
            ⚙ Garden Operator Panel
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close operator panel"
            className="rounded px-2 text-garden-parch/60 transition hover:text-garden-parch"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-4 py-4">
          {/* Read-only status */}
          <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-garden-moss/50 bg-black/20 p-3 font-mono text-xs text-garden-parch/80">
            <dt className="text-garden-parch/50">Round</dt>
            <dd className="text-right">{roundId > 0 ? `#${roundId}` : "—"}</dd>
            <dt className="text-garden-parch/50">Status</dt>
            <dd className="text-right">{STATUS_LABEL[challenge.status] ?? challenge.status}</dd>
            <dt className="text-garden-parch/50">Entries</dt>
            <dd className="text-right">{total}</dd>
            <dt className="text-garden-parch/50">Scored</dt>
            <dd className="text-right">
              {scoredN} / {total}
            </dd>
            <dt className="text-garden-parch/50">Top 3 revealed</dt>
            <dd className="text-right">{challenge.scoringRevealed ? "Yes" : "No"}</dd>
          </dl>

          {/* Actions */}
          <div className="grid gap-3">
            <OperatorAction
              title="Close Round"
              hint="Closing will stop new entries. Continue?"
              hintTone="warn"
              buttonLabel="Close Round"
              disabled={busy || !isOpen}
              onClick={onCloseRound}
            />
            <OperatorAction
              title="Score Entries"
              hint={
                unscoredN > 0
                  ? `Queues scoring for ${unscoredN} unscored entr${unscoredN === 1 ? "y" : "ies"}. You will need to approve ${unscoredN} transaction${unscoredN === 1 ? "" : "s"}.`
                  : "All entries are scored."
              }
              hintTone="warn"
              buttonLabel="Score Entries"
              disabled={busy || !isClosed || total === 0 || allScored}
              onClick={onScoreEntries}
            />
            <OperatorAction
              title="Reveal Winners"
              hint="Queues the top-3 reveal once every entry is scored."
              buttonLabel="Reveal Winners"
              disabled={busy || !isClosed || !allScored || challenge.scoringRevealed}
              onClick={onRevealWinners}
            />
            <OperatorAction
              title="Finalize Round"
              hint={
                total === 0
                  ? "Finalizes the round so a new one can be opened. This round had no entries, so there is nothing to score or reveal."
                  : canFinalize
                    ? "Finalizes the round so a new one can be opened."
                    : "Finalizes the round so a new one can be opened. Score every entry and reveal the winners first — finalizing cannot be undone, and it locks out scoring and the reveal for good."
              }
              hintTone={canFinalize ? "normal" : "warn"}
              buttonLabel="Finalize Round"
              disabled={busy || !canFinalize}
              onClick={onFinalizeRound}
            />
            <OperatorAction
              title="Open New Round"
              hint={`A new round will open (round #${roundId + 1}) with random target traits.`}
              buttonLabel="Open Round"
              disabled={busy || isOpen}
              onClick={onOpenRound}
            >
              {/* Optional off-chain trimmings. Both are cosmetic: leaving them untouched
                  opens an ordinary, unnamed classic-night round. */}
              <label className="mt-2.5 block">
                <span className="font-pixel text-[9px] uppercase tracking-wide text-garden-parch/50">
                  Round name (optional)
                </span>
                <input
                  type="text"
                  value={roundName}
                  maxLength={NAME_MAX}
                  disabled={busy || isOpen}
                  onChange={(e) => setRoundName(e.target.value)}
                  placeholder="e.g. Weekend Fun 1st Edition"
                  className="mt-1 w-full rounded-md border border-garden-moss/60 bg-black/30 px-2 py-1.5 font-body text-xs text-garden-parch placeholder:text-garden-parch/25 focus:border-garden-cyan/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                />
              </label>
              <label className="mt-2 block">
                <span className="font-pixel text-[9px] uppercase tracking-wide text-garden-parch/50">
                  Garden background
                </span>
                <select
                  value={background}
                  disabled={busy || isOpen}
                  onChange={(e) => setBackground(e.target.value as GardenBackground)}
                  className="mt-1 w-full rounded-md border border-garden-moss/60 bg-black/30 px-2 py-1.5 font-body text-xs text-garden-parch focus:border-garden-cyan/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {GARDEN_BACKGROUNDS.map((b) => (
                    <option key={b.value} value={b.value} className="bg-garden-deep">
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              {/* Only a filled-in choice triggers the signature, so only then is it worth
                  warning about a second wallet prompt. */}
              {(roundName.trim() !== "" || background !== DEFAULT_BACKGROUND) && (
                <p className="mt-1.5 text-[10px] leading-snug text-garden-parch/40">
                  Saving these asks for one extra wallet signature after the round opens — a
                  free message, not a transaction.
                </p>
              )}
            </OperatorAction>
          </div>

          {/* Live message / error */}
          {message && (
            <p className="mt-4 rounded-lg border border-garden-cyan/40 bg-garden-cyan/10 px-3 py-2 text-xs text-garden-cyan">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-2 rounded-lg border border-garden-rose/50 bg-garden-rose/10 px-3 py-2 text-xs text-garden-rose">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function OperatorAction({
  title,
  hint,
  hintTone = "normal",
  buttonLabel,
  disabled,
  onClick,
  children,
}: {
  title: string;
  hint: string;
  hintTone?: "normal" | "warn";
  buttonLabel: string;
  disabled: boolean;
  onClick: () => void;
  /** Optional inputs the action reads, rendered between the hint and the button. */
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-garden-moss/50 bg-black/20 p-3">
      <div className="font-pixel text-[11px] uppercase tracking-wide text-garden-mint">
        {title}
      </div>
      <p
        className={`mt-1 text-[11px] leading-snug ${hintTone === "warn" ? "text-garden-gold/80" : "text-garden-parch/50"}`}
      >
        {hint}
      </p>
      {children}
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-2 w-full rounded-md border border-garden-cyan/60 bg-garden-cyan/10 px-3 py-1.5 font-pixel text-[10px] uppercase tracking-wide text-garden-cyan transition hover:bg-garden-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
