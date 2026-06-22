import type { Flower } from "../types";
import { useGame } from "../game/GameContext";
import { isHybrid } from "../program/accounts";
import { FlowerShelf } from "./FlowerShelf";
import { Badge } from "./Badge";

/**
 * The left-panel flower list, split into two stacked sections (shared by the desktop column
 * and the mobile "Flowers" tab):
 *
 *   STARTER SHELF — the player's starter flowers (never submittable). On desktop this stays
 *     fixed at the top (no scroll); the 6 starters always fit.
 *   HYBRID COLLECTION — every bred hybrid, with a "N BLOOMS" count badge and a
 *     "SUBMIT TO CHALLENGE" button per card. On desktop this is the scrollable region.
 *
 * On mobile (`variant="mobile"`) both sections sit in natural flow and the surrounding tab
 * scrolls them together. Starters vs. hybrids are split with the same rule the journal uses
 * (`isHybrid`: a 255 species / sealed-or-revealed genome), so it's correct on real chain data
 * and the standalone mocks alike.
 */
export function FlowerSections({
  onActivate,
  variant,
}: {
  onActivate: (flower: Flower) => void;
  variant: "desktop" | "mobile";
}) {
  const { shelf } = useGame();
  const starters = shelf.filter((f) => !isHybrid(f));
  const hybrids = shelf.filter(isHybrid);
  const desktop = variant === "desktop";

  return (
    <div className={`flex min-h-0 flex-col ${desktop ? "flex-1" : ""}`}>
      {/* SECTION A — STARTER SHELF (fixed, no scroll) */}
      <div className="shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="gh-title text-[11px] text-garden-cyan">Starter Shelf</span>
          <Badge className="border-garden-moss text-garden-parch/70">{starters.length}</Badge>
        </div>
        <FlowerShelf flowers={starters} onActivate={onActivate} showSubmit={false} />
      </div>

      {/* divider — horizontal rule in the game's border colour */}
      <hr className="my-3 shrink-0 border-garden-moss/50" />

      {/* SECTION B — HYBRID COLLECTION (scrollable on desktop) */}
      <div className={`flex min-h-0 flex-col ${desktop ? "flex-1" : ""}`}>
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <span className="gh-title text-[11px] text-garden-gold">Hybrid Collection</span>
          <Badge className="border-garden-gold/60 text-garden-gold">
            {hybrids.length} {hybrids.length === 1 ? "Bloom" : "Blooms"}
          </Badge>
        </div>
        <div className={desktop ? "gh-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pb-1 pr-1" : ""}>
          {hybrids.length === 0 ? (
            <p className="px-1 py-4 text-center font-pixel text-[9px] uppercase leading-relaxed tracking-wide text-garden-parch/40">
              No blooms yet — cross two flowers to grow one.
            </p>
          ) : (
            <FlowerShelf flowers={hybrids} onActivate={onActivate} showSubmit />
          )}
        </div>
      </div>
    </div>
  );
}
