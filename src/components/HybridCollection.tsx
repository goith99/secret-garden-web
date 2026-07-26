import type { Flower } from "../types";
import { useGame } from "../game/GameContext";
import { useGardener } from "../wallet/useGardener";
import { isHybrid } from "../program/accounts";
import { FlowerShelf } from "./FlowerShelf";
import { Badge } from "./Badge";

/**
 * The left panel (desktop) / "Flowers" tab (mobile): the player's bred hybrids only. Starters
 * now live planted inside the greenhouse scene, so this list carries no starters and no
 * starter-only chrome — just hybrid cards, each with a "SUBMIT TO CHALLENGE" button. The grid
 * scrolls internally on desktop; on mobile it flows with the surrounding tab. Hybrids are
 * picked with the same `isHybrid` rule the journal uses (255 species / sealed-or-revealed
 * genome), so it's correct on real chain data and the standalone mocks alike.
 */
export function HybridCollection({
  onActivate,
  variant,
}: {
  onActivate: (flower: Flower) => void;
  variant: "desktop" | "mobile";
}) {
  const { shelf, hybridCount, collectionCap, collectionFull } = useGame();
  const { connected } = useGardener();
  const hybrids = shelf.filter(isHybrid);
  const desktop = variant === "desktop";

  return (
    <div className={`flex min-h-0 flex-col ${desktop ? "flex-1" : ""}`}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className="gh-title text-[11px] text-garden-gold">Hybrid Collection</span>
        <Badge className="border-garden-gold/60 text-garden-gold">
          {hybrids.length} {hybrids.length === 1 ? "Bloom" : "Blooms"}
        </Badge>
      </div>
      {/* Slot usage. The count comes from the profile (the same figure the greenhouse checks
          before a cross), so it stays honest even if a card hasn't been refetched yet.
          A collection grown BEFORE the limit existed can sit above it — say so plainly
          rather than render a puzzling "24 of 20". Releasing still works, and each release
          brings the count down until crossing is possible again. */}
      {connected && (
        <div className="mb-2 shrink-0">
          <p
            className={`font-pixel text-[9px] uppercase tracking-wide ${
              collectionFull ? "text-garden-gold" : "text-garden-parch/50"
            }`}
          >
            {hybridCount > collectionCap
              ? `${hybridCount} blooms — over the ${collectionCap} slot limit`
              : `${hybridCount} of ${collectionCap} slots used`}
          </p>
          {collectionFull && (
            <p className="mt-1 font-body text-[10px] leading-snug text-garden-gold">
              Your collection is full — release a flower to breed again.
            </p>
          )}
        </div>
      )}
      <div className={desktop ? "gh-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pb-1 pr-1" : ""}>
        {!connected ? (
          <p className="px-1 py-6 text-center font-pixel text-[9px] uppercase leading-relaxed tracking-wide text-garden-parch/40">
            Connect your wallet to see your collection
          </p>
        ) : hybrids.length === 0 ? (
          <p className="px-1 py-6 text-center font-pixel text-[9px] uppercase leading-relaxed tracking-wide text-garden-parch/40">
            No blooms yet — cross two flowers in the greenhouse to grow one.
          </p>
        ) : (
          <FlowerShelf flowers={hybrids} onActivate={onActivate} showSubmit />
        )}
      </div>
    </div>
  );
}
