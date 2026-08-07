/**
 * Hidden OPERATOR panel — internal authority tooling, NOT part of the player surface.
 *
 * It is mounted only by <AppHeader> when the connected wallet equals GameConfig.authority,
 * so this component assumes it is already authorized. It drives the authority-only actions
 * (close_round, queue_score_entry, the bracket reveal, finalize_round, open_round) through
 * useOperatorActions(), refetching the shared garden data after each so the read-only status
 * reflects the new chain state.
 *
 * "Reveal Winners" is no longer one instruction. It runs the whole bracket sequence — see
 * src/program/reveal.ts — which is several signatures and several MPC calls, so it is the one
 * action with its own progress readout and its own resume path.
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
  type OperatorActions,
} from "../program/transactions";
import type { RevealProgress, RevealStatus } from "../program/reveal";
import {
  SCORE_BATCH_SIZE,
  scoreTransactionCount,
  type ScoreProgress,
} from "../program/scoring";
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
  const [scoreProgress, setScoreProgress] = useState<ScoreProgress | null>(null);
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
  const isFinalized = challenge.status === RoundStatus.Finalized && roundId > 0;

  const total = entries?.length ?? challenge.participantCount;
  const scoredN = entries
    ? entries.filter((e) => e.scored).length
    : challenge.scoredCount;
  const unscoredN = entries
    ? entries.filter((e) => !e.scored).length
    : Math.max(0, total - scoredN);
  const allScored = total > 0 && scoredN >= total;

  /**
   * Finalize is ONE-WAY: there is no un-finalize instruction, and queue_score_entry requires
   * status == Closed. Finalizing a round that still has unscored entries therefore forfeits
   * their scores for good — and an entry that can never be scored can never be revealed.
   *
   * The REVEAL is no longer lost this way: init_bracket accepts a FINALIZED round precisely
   * so a fully-scored round that was finalized too early can still be rescued (devnet round
   * 11 was). The guard below stays strict anyway — "recoverable" is not "fine", and the
   * operator should still reveal before finalizing.
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

  /**
   * Scoring is batched — five entries per transaction — so progress is reported per
   * TRANSACTION, the same unit the reveal reports in. See src/program/scoring.ts.
   *
   * The outcome is reported literally rather than as a flat "all entries scored": a run can
   * legitimately queue fewer than it set out to (entries already in flight are skipped, a
   * failing entry is recorded and stepped over), and an operator who is about to press
   * Finalize needs to know that before it becomes irreversible.
   */
  const onScoreEntries = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setScoreProgress(null);
    try {
      const outcome = await operator.scoreEntries(roundId, setScoreProgress);
      if (outcome.queued === 0 && outcome.failed.length === 0) {
        setMessage("All entries are already scored or being scored. Ready to reveal.");
        return;
      }
      const parts = [
        `Queued ${outcome.queued} entr${outcome.queued === 1 ? "y" : "ies"} in ` +
          `${outcome.transactions} transaction${outcome.transactions === 1 ? "" : "s"}.`,
      ];
      if (outcome.skipped > 0) {
        parts.push(`${outcome.skipped} were already scored or in flight.`);
      }
      if (outcome.failed.length > 0) {
        setError(
          `${outcome.failed.length} entr${outcome.failed.length === 1 ? "y" : "ies"} could not be ` +
            `queued: ${outcome.failed[0].reason}. Press Score Entries again to retry just those.`,
        );
      }
      await afterAction(parts.join(" "));
    } catch (e) {
      setError(errText(e));
      // A run that aborts part-way has still queued whatever landed before it stopped, so the
      // Scored counter must be re-read — otherwise the panel keeps showing the pre-run figure
      // and the operator cannot tell how much of the round is actually done.
      await loadEntries();
    } finally {
      setScoreProgress(null);
      setBusy(false);
    }
  }, [operator, afterAction, loadEntries, roundId]);

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
                  ? `Queues scoring for ${unscoredN} unscored entr${unscoredN === 1 ? "y" : "ies"}, ` +
                    `batched ${SCORE_BATCH_SIZE} per transaction. You will need to approve ` +
                    `${scoreTransactionCount(unscoredN)} transaction${scoreTransactionCount(unscoredN) === 1 ? "" : "s"}.`
                  : "All entries are scored."
              }
              hintTone="warn"
              buttonLabel={scoreProgress ? "Scoring…" : "Score Entries"}
              disabled={busy || !isClosed || total === 0 || allScored}
              onClick={onScoreEntries}
            >
              {scoreProgress && (
                <StepProgress
                  progress={scoreProgress}
                  ariaLabel="Scoring progress"
                  note="Keep this panel open — each batch needs one wallet approval."
                />
              )}
            </OperatorAction>
            <RevealWinnersAction
              operator={operator}
              roundId={roundId}
              // Finalized-but-unrevealed is deliberately allowed: init_bracket accepts a
              // FINALIZED round precisely so one that was finalized before its reveal is
              // rescuable rather than stuck with its winners lost.
              eligible={(isClosed || isFinalized) && allScored && !challenge.scoringRevealed}
              revealed={challenge.scoringRevealed}
              panelBusy={busy}
              setPanelBusy={setBusy}
              onFinished={afterAction}
              onError={setError}
              clearMessages={() => {
                setError(null);
                setMessage(null);
              }}
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

/**
 * The bracket reveal, as one button.
 *
 * Behind it is the longest sequence in the game — up to 17 tier-1 shard reveals, a promotion,
 * semifinals, a final reveal and the apply, each its own wallet approval and each waiting on
 * an MPC callback in between. Two things follow from that, and both are the whole point of
 * this component:
 *
 *  1. The operator has to be told what they are signing up for BEFORE the first popup ("53
 *     entries → 5 tier-1 shards → 2 semifinals → final. 16 approvals."), and shown steady
 *     progress during, or a long run is indistinguishable from a hung one.
 *  2. An interrupted run must resume. The panel asks the chain what is already done the
 *     moment it opens, so a closed tab mid-sequence costs nothing but the reopen.
 */
function RevealWinnersAction({
  operator,
  roundId,
  eligible,
  revealed,
  panelBusy,
  setPanelBusy,
  onFinished,
  onError,
  clearMessages,
}: {
  operator: OperatorActions;
  roundId: number;
  /** True when the round is closed (or finalized), fully scored and not yet revealed. */
  eligible: boolean;
  revealed: boolean;
  panelBusy: boolean;
  setPanelBusy: (busy: boolean) => void;
  onFinished: (message: string) => Promise<void>;
  onError: (message: string | null) => void;
  clearMessages: () => void;
}) {
  const [status, setStatus] = useState<RevealStatus | null>(null);
  const [progress, setProgress] = useState<RevealProgress | null>(null);
  const [running, setRunning] = useState(false);

  // Ask the chain what is already done. A failure here is not worth shouting about — the
  // button still works, it just loses its plan summary — so it degrades to no status.
  const refresh = useCallback(async () => {
    if (!eligible || roundId <= 0) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await operator.inspectReveal(roundId));
    } catch {
      setStatus(null);
    }
  }, [operator, roundId, eligible]);

  // Runs on open and whenever the round changes — this IS the resume detection.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const run = useCallback(async () => {
    setPanelBusy(true);
    setRunning(true);
    setProgress(null);
    clearMessages();
    try {
      await operator.revealWinners(roundId, setProgress);
      await onFinished("Winners revealed!");
    } catch (e) {
      onError(errText(e));
    } finally {
      setRunning(false);
      setPanelBusy(false);
      setProgress(null);
      void refresh();
    }
  }, [operator, roundId, setPanelBusy, clearMessages, onFinished, onError, refresh]);

  const resuming = !!status?.inProgress;
  const blocked = status?.blocked ?? null;
  const approvals = status?.remainingSignatures ?? 0;

  const hint = revealed
    ? "This round's winners are already revealed."
    : blocked
      ? blocked
      : status
        ? `${status.summary} ${approvals} wallet approval${approvals === 1 ? "" : "s"}${resuming ? " left" : ""}.`
        : "Reveals the top 3 through the bracket once every entry is scored.";

  return (
    <div className="rounded-lg border border-garden-moss/50 bg-black/20 p-3">
      <div className="font-pixel text-[11px] uppercase tracking-wide text-garden-mint">
        Reveal Winners
      </div>
      <p
        className={`mt-1 text-[11px] leading-snug ${blocked ? "text-garden-gold/80" : "text-garden-parch/50"}`}
      >
        {hint}
      </p>

      {/* Resume prompt: what the chain says is already done. Only shown when there IS
          something to resume, so an ordinary first run stays a single uncluttered button. */}
      {resuming && !running && (
        <div className="mt-2 rounded-md border border-garden-gold/40 bg-garden-gold/5 px-2.5 py-2">
          <p className="font-pixel text-[9px] uppercase tracking-wide text-garden-gold">
            Reveal already part-way through
          </p>
          <ul className="mt-1 list-disc pl-4 text-[10px] leading-snug text-garden-parch/60">
            {status?.done.map((line) => <li key={line}>{line}</li>)}
            {status?.repin && (
              <li className="text-garden-gold/80">
                The pinned partition does not match this round's entries — it will be re-pinned
                and that tier revealed again.
              </li>
            )}
          </ul>
          <p className="mt-1 text-[10px] leading-snug text-garden-parch/40">
            Resuming picks up from here; nothing already done is repeated.
          </p>
        </div>
      )}

      {running && (
        <StepProgress
          progress={progress}
          ariaLabel="Reveal progress"
          note="Keep this panel open — each step needs a wallet approval, and the encrypted computations take a moment to come back."
        />
      )}

      <button
        type="button"
        disabled={panelBusy || running || !eligible || !!blocked}
        onClick={run}
        className="mt-2 w-full rounded-md border border-garden-cyan/60 bg-garden-cyan/10 px-3 py-1.5 font-pixel text-[10px] uppercase tracking-wide text-garden-cyan transition hover:bg-garden-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running ? "Revealing…" : resuming ? "Resume Reveal" : "Reveal Winners"}
      </button>
    </div>
  );
}

/**
 * Live progress for a multi-transaction operator run. Deliberately plain: a phase label, a
 * step count and a bar. The point is only to distinguish "still working" from "stuck".
 *
 * Shared by the reveal and by scoring because both count the same unit — WALLET APPROVALS,
 * not entries or shards — and an operator watching two different bars that mean two different
 * things is exactly how a long run gets abandoned half way. `totalSteps` may grow mid-run
 * (scoring widens it when a batch splits), so the bar is clamped rather than assumed monotonic.
 */
function StepProgress({
  progress,
  ariaLabel,
  note,
}: {
  progress: { step: number; totalSteps: number; label: string } | null;
  ariaLabel: string;
  note: string;
}) {
  return (
    <div className="mt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="animate-pulseSoft font-body text-[11px] text-garden-cyan">
          {progress?.label ?? "Starting…"}
        </span>
        {progress && progress.totalSteps > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-garden-parch/40">
            {progress.step}/{progress.totalSteps}
          </span>
        )}
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/40"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress?.totalSteps ?? 0}
        aria-valuenow={progress?.step ?? 0}
        aria-label={ariaLabel}
      >
        <div
          className="h-full rounded-full bg-garden-cyan transition-[width] duration-500"
          style={{
            width:
              progress && progress.totalSteps > 0
                ? `${Math.min(100, (progress.step / progress.totalSteps) * 100)}%`
                : "6%",
          }}
        />
      </div>
      <p className="mt-1 text-[10px] leading-snug text-garden-parch/40">{note}</p>
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
