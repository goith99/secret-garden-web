import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { rarity as rarityStyle } from "../mocks/presentation";

const MEDAL: Record<1 | 2 | 3, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Daily Winners summary — the revealed top 3 from the last finished challenge. */
export function DailyWinners() {
  const { winners } = useGame();

  return (
    <div className="gh-panel px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="gh-title text-[11px] text-garden-gold">Daily Winners</span>
        <Badge className="border-garden-lavender text-garden-lavender">Winners Revealed</Badge>
      </div>
      <ul className="flex flex-col gap-1.5">
        {winners.map((w) => {
          const r = rarityStyle(w.rarity);
          return (
            <li
              key={w.rank}
              className="flex items-center gap-2 rounded-md border border-garden-moss/60 bg-garden-deep/40 px-2 py-1.5"
            >
              <span className="text-lg" aria-hidden>
                {MEDAL[w.rank]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-pixel text-[11px] text-garden-cream">{w.flowerLabel}</p>
                <p className="font-pixel text-[9px] uppercase tracking-wide text-garden-parch/70">
                  by {w.playerShort}
                </p>
              </div>
              <Badge className={`${r.text} ${r.ring}`}>{r.label}</Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
