import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { roundStatusLabel, traitName } from "../lib/presentation";

function hoursLeft(endTime: number): string {
  const secs = endTime - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "closing";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/** "Current Request" — the active challenge's target traits the player breeds toward. */
export function CurrentRequest() {
  const { challenge } = useGame();
  const traits = challenge.targetTraits.slice(0, challenge.targetTraitCount);

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
      <div className="mt-2.5 flex items-center justify-between font-pixel text-[10px] uppercase tracking-wide text-garden-cyan/80">
        <span>Round {challenge.roundId}</span>
        <span>{challenge.participantCount} entrants</span>
        <span>{hoursLeft(challenge.endTime)}</span>
      </div>
    </div>
  );
}
