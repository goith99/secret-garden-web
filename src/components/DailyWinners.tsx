import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { useLatestWinners } from "../hooks/useRoundHistory";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
/** Prize per rank, hardcoded to match the current on-chain prize structure. */
const PRIZE_SOL: Record<number, number> = { 1: 5, 2: 3, 3: 2 };

/** Shorten a wallet to "first4…last4" for the winners list. */
function shortWallet(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Daily Winners — the Top 3 of the most recently completed round, read from Supabase (written by
 * the operator after a reveal). This intentionally shows the *latest finished* round's results,
 * so a fresh, not-yet-revealed round keeps the previous round's winners on screen rather than
 * flashing back to the fallback. Before any round has ever been saved (or when Supabase isn't
 * configured) the list is empty and a gentle "revealed after the round ends" note shows instead.
 */
export function DailyWinners() {
  const { challenge } = useGame();
  const { winners, roundNumber, loading } = useLatestWinners(challenge.roundId);
  const hasWinners = winners.length > 0;

  return (
    <div className="gh-panel px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="gh-title text-[11px] text-garden-gold">Daily Winners</span>
        <Badge className="border-garden-lavender text-garden-lavender">
          {hasWinners ? `Round ${roundNumber}` : "Awaiting Reveal"}
        </Badge>
      </div>

      {loading ? (
        <ul className="flex flex-col gap-1.5" aria-hidden>
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-garden-moss/40 bg-garden-deep/30 px-2 py-1.5"
            >
              <span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-garden-moss/40" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="block h-2.5 w-2/3 animate-pulse rounded bg-garden-moss/40" />
                <span className="block h-2 w-1/2 animate-pulse rounded bg-garden-moss/30" />
              </div>
              <span className="h-4 w-11 shrink-0 animate-pulse rounded bg-garden-moss/40" />
            </li>
          ))}
        </ul>
      ) : !hasWinners ? (
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
                  {shortWallet(w.walletAddress)}
                </p>
              </div>
              <Badge className="border-garden-gold text-garden-gold" title="Prize">
                {PRIZE_SOL[w.rank] ?? 0} SOL
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
