import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { roundStatusLabel, traitName } from "../lib/presentation";
import { useRoundMetadata } from "../hooks/useRoundMetadata";
import { RoundStatus, type RoundStatusCode } from "../types";

/**
 * The countdown slot. STATUS WINS OVER THE CLOCK: a round that is closed or finalized is no
 * longer counting down, so reporting time is misleading. Previously this consulted only
 * `endTime`, which meant any expired round read "closing" forever — including a finalized one
 * whose winners were already revealed, and indefinitely so whenever the next round had not yet
 * been opened (the panel keeps showing `config.currentRound`, which stays on the finished round).
 */
function timeLabel(endTime: number, status: RoundStatusCode): string {
  if (status === RoundStatus.Finalized) return "ended";
  if (status === RoundStatus.Closed) return "judging";
  const secs = endTime - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "closing";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/** "Current Request" — the active challenge's target traits the player breeds toward. */
export function CurrentRequest() {
  const { challenge } = useGame();
  const { name: roundName } = useRoundMetadata(challenge.roundId);
  const traits = challenge.targetTraits.slice(0, challenge.targetTraitCount);
  // Tooltip for the round line. Carries the WHOLE label, not just the name, so a hover over a
  // truncated line reads back exactly what was cut — including the round number. Undefined for
  // an unnamed round: "Round 50" cannot truncate at any width this panel reaches, so a tooltip
  // there would only echo the text it sits on.
  const roundLabel = roundName ? `Round ${challenge.roundId} · ${roundName}` : undefined;

  return (
    <div className="gh-panel px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="gh-title text-[11px] text-garden-gold">Today&apos;s Request</span>
        <Badge className="border-garden-cyan text-garden-cyan">{roundStatusLabel(challenge.status)}</Badge>
      </div>
      <p className="mb-2 font-body text-xs text-garden-parch">
        Grow a bloom the judges adore — match as many wanted traits as you can.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {traits.map((t) => (
          <Badge key={t} className="border-garden-gold/70 bg-garden-gold/10 text-garden-gold">
            ✦ {traitName(t)}
          </Badge>
        ))}
      </div>
      {/* Round line. The operator's round name is free-form text from Supabase (no length cap —
          see useRoundMetadata), and this panel sits in a ~256-336px column, so the name MUST be
          allowed to lose a fight for space without dragging the counts with it.

          `flex-wrap` + `gap-x-3` is what makes that safe, and both halves are load-bearing:
          the gap guarantees separation on the shared line (justify-between distributes only
          the space that is LEFT OVER, which is zero exactly when the name is long enough to
          collide — the old bug), and the wrap gives a long name the whole row to itself, where
          it truncates against the panel edge instead of against "0 entrants".

          Entrants + countdown are ONE flex item, not two, so they always travel together and
          keep their own gap; previously they were separate items and ran into each other on the
          same no-free-space path ("0 ENTRANTS23H 59M LEFT"). */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-pixel text-[10px] uppercase tracking-wide text-garden-cyan/80">
        {/* min-w-0 lets the flex item shrink below its content width (without it `truncate` has
            nothing to truncate to); max-w-full caps it at the panel when it is alone on a line. */}
        <span className="min-w-0 max-w-full truncate" title={roundLabel}>
          Round {challenge.roundId}
          {roundName && <span className="text-garden-gold/90"> · {roundName}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span>{challenge.participantCount} entrants</span>
          <span>{timeLabel(challenge.endTime, challenge.status)}</span>
        </span>
      </div>
    </div>
  );
}
