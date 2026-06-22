import type { DragEvent } from "react";
import type { Flower } from "../types";
import { useGame } from "../game/GameContext";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { isHybrid } from "../program/accounts";
import { FlowerSprite } from "./FlowerSprite";
import { speciesOf } from "../mocks/presentation";

/**
 * The 6 starter flowers, planted in a single row growing from the greenhouse floor. These are
 * the breeding source flowers, so they stay fully interactive even though they sit in the
 * scene rather than a panel:
 *   - Desktop: HTML5 drag carries the flower id into a Parent Pot (same payload FlowerCard
 *     uses); a tap selects it so a pot can then be tapped to place it.
 *   - Mobile: a tap auto-places into the first empty pot.
 * A starter already sitting in a pot leaves a dashed "empty plot" outline in its spot until
 * it's removed. No rarity badge / submit control here — starters are never competition entries.
 */
export function StarterGarden() {
  const { shelf, potA, potB, selectedFlowerId, selectFlower, autoPlace } = useGame();
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const starters = shelf.filter((f) => !isHybrid(f));
  const inPot = new Set([potA?.id, potB?.id].filter(Boolean) as string[]);

  const onDragStart = (e: DragEvent<HTMLButtonElement>, f: Flower) => {
    e.dataTransfer.setData("text/plain", f.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const onActivate = (f: Flower) => {
    if (isMobile) autoPlace(f);
    else selectFlower(f.id);
  };

  return (
    <div className="gh-scroll pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-around gap-1 overflow-x-auto px-2 pb-3 md:px-5 md:pb-4">
      {starters.map((f) => {
        const planted = inPot.has(f.id);
        const selected = selectedFlowerId === f.id;
        const name = speciesOf(f.visualSpeciesId).name;
        return (
          <div key={f.id} className="flex w-[6rem] shrink-0 flex-col items-center gap-1">
            {planted ? (
              // dashed "empty plot" left behind while this starter is in a pot
              <div
                className="flex h-[72px] w-[72px] items-center justify-center rounded-xl border border-dashed border-garden-moss/70"
                aria-hidden
              >
                <span className="font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40">
                  potted
                </span>
              </div>
            ) : (
              <button
                type="button"
                draggable
                onDragStart={(e) => onDragStart(e, f)}
                onClick={() => onActivate(f)}
                aria-pressed={selected}
                aria-label={`Plant ${name} in a pot`}
                className={`pointer-events-auto rounded-xl p-1 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan
                  ${selected ? "ring-2 ring-garden-gold/70" : ""}`}
              >
                <FlowerSprite flower={f} size="lg" sway />
              </button>
            )}
            <span
              className={`line-clamp-2 w-full break-words text-center font-pixel text-xs leading-tight tracking-tight
                ${planted ? "text-garden-parch/30" : "text-garden-cream/85"}`}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
