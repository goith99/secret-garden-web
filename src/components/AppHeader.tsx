import { useGame } from "../game/GameContext";
import { Badge } from "./Badge";
import { roundStatusLabel } from "../mocks/presentation";

/** Slim brand bar. Kept short so the desktop main view fits one screen without scrolling. */
export function AppHeader({ compact = false }: { compact?: boolean }) {
  const { challenge } = useGame();
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-garden-moss/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🌿
        </span>
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
        {/* Placeholder for a future "Connect Wallet" entry point (Stage 6B). */}
        <span className="hidden font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40 sm:inline">
          guest gardener
        </span>
      </div>
    </header>
  );
}
