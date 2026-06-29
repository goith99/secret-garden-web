import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { useRoundHistory } from "../hooks/useRoundHistory";
import { shortGardener } from "../wallet/format";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RANK_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

/**
 * Daily Winners — the revealed top 3 of the current round, read from Supabase (written by the
 * operator after a reveal). Before any reveal (or when Supabase isn't configured) the list is
 * empty and a gentle "revealed after the round ends" note shows instead. Player vocabulary only.
 */
export function DailyWinners() {
  const { challenge } = useGame();
  const { winners } = useRoundHistory(challenge.roundId);

  return (
    <div className="gh-panel px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="gh-title text-[11px] text-garden-gold">Daily Winners</span>
        <Badge className="border-garden-lavender text-garden-lavender">
          {winners.length > 0 ? "Winners Revealed" : "Awaiting Reveal"}
        </Badge>
      </div>

      {winners.length === 0 ? (
        <p className="px-1 py-3 text-center font-pixel text-[9px] uppercase leading-relaxed tracking-wide text-garden-parch/40">
          Winners will be revealed after the round ends
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {winners.map((w) => (
            <li
              key={w.rank}
              className="flex items-center gap-2 rounded-md border border-garden-moss/60 bg-garden-deep/40 px-2 py-1.5"
            >
              <span className="text-lg" aria-hidden>
                {MEDAL[w.rank] ?? "🌸"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-pixel text-[11px] text-garden-cream">{w.flowerName}</p>
                <p className="font-pixel text-[9px] uppercase tracking-wide text-garden-parch/70">
                  {RANK_LABEL[w.rank] ?? `#${w.rank}`} · by {shortGardener(w.walletAddress)}
                </p>
              </div>
              <Badge className="border-garden-moss text-garden-parch" title="Generation">
                G{w.generation}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
