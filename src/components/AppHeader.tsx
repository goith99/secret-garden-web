import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { GardenerMenu } from "./GardenerMenu";
import { roundStatusLabel } from "../mocks/presentation";

/** Slim brand bar. Kept short so the desktop main view fits one screen without scrolling. */
export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { challenge } = useGame();
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-garden-moss/60 px-3 py-2">
      <div className="flex items-center gap-2">
        {/* 5-petal flower mark — matches public/favicon.svg */}
        <svg className="h-5 w-5" viewBox="0 0 32 32" fill="none" aria-hidden>
          <g transform="translate(16 16)">
            <ellipse cx="0" cy="-8" rx="4.5" ry="8" fill="#D4A017" transform="rotate(0)" />
            <ellipse cx="0" cy="-8" rx="4.5" ry="8" fill="#D4A017" transform="rotate(72)" />
            <ellipse cx="0" cy="-8" rx="4.5" ry="8" fill="#D4A017" transform="rotate(144)" />
            <ellipse cx="0" cy="-8" rx="4.5" ry="8" fill="#D4A017" transform="rotate(216)" />
            <ellipse cx="0" cy="-8" rx="4.5" ry="8" fill="#D4A017" transform="rotate(288)" />
            <circle r="4.5" fill="#8B6914" />
          </g>
        </svg>
        <div className="leading-tight">
          <h1 className="font-pixel text-sm uppercase tracking-[0.2em] text-garden-mint">Secret Garden</h1>
          {!compact && (
            <p className="font-pixel text-[9px] uppercase tracking-[0.25em] text-garden-cyan/70">
              Cozy Crossbreeding Greenhouse
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="border-garden-gold/70 bg-garden-gold/10 text-garden-gold">
          {roundStatusLabel(challenge.status)}
        </Badge>
        {/* Stage 6B: real connected gardener identity + leave action. */}
        <GardenerMenu />
      </div>
    </header>
  );
}
