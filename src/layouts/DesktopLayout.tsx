import { useGame } from "../game/GameContext";
import { AppHeader } from "../components/AppHeader";
import { FlowerShelf } from "../components/FlowerShelf";
import { Greenhouse } from "../components/Greenhouse";
import { JournalPanel } from "../components/JournalPanel";
import { Badge } from "../components/Badge";

/**
 * Desktop: one screen, NO page scroll. Three columns — Flower Shelf (left, scrolls
 * internally) · Greenhouse (center, focal) · Journal (right, scrolls internally).
 */
export function DesktopLayout() {
  const { shelf, selectFlower } = useGame();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <main className="grid min-h-0 flex-1 grid-cols-[clamp(260px,22vw,320px)_1fr_clamp(280px,24vw,360px)] gap-3 p-3">
        {/* LEFT — Flower Shelf */}
        <aside className="gh-panel flex min-h-0 flex-col p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="gh-title text-[11px] text-garden-cyan">Flower Shelf</span>
            <Badge className="border-garden-moss text-garden-parch/70">{shelf.length}</Badge>
          </div>
          <div className="gh-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            {/* Desktop primarily drags; tap also selects so a pot can be tapped to place. */}
            <FlowerShelf onActivate={(f) => selectFlower(f.id)} gridClassName="grid-cols-2" />
          </div>
          <p className="mt-2 text-center font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40">
            drag a flower into a pot
          </p>
        </aside>

        {/* CENTER — Greenhouse (min-w-0 so the pot row never forces grid overflow) */}
        <section className="min-h-0 min-w-0">
          <Greenhouse />
        </section>

        {/* RIGHT — Journal + Daily Winners */}
        <aside className="min-h-0">
          <JournalPanel />
        </aside>
      </main>
    </div>
  );
}
