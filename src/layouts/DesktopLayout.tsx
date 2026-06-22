import { useGame } from "../game/GameContext";
import { AppHeader } from "../components/AppHeader";
import { FlowerSections } from "../components/FlowerSections";
import { Greenhouse } from "../components/Greenhouse";
import { JournalPanel } from "../components/JournalPanel";

/**
 * Desktop: one screen, NO page scroll. Three columns — Flower list (left: a fixed Starter
 * Shelf over a scrollable Hybrid Collection) · Greenhouse (center, focal) · Journal (right,
 * scrolls internally).
 */
export function DesktopLayout() {
  const { selectFlower } = useGame();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <main className="grid min-h-0 flex-1 grid-cols-[clamp(260px,22vw,320px)_1fr_clamp(280px,24vw,360px)] gap-3 p-3">
        {/* LEFT — Starter Shelf (fixed) + Hybrid Collection (scrolls) */}
        <aside className="gh-panel flex min-h-0 flex-col p-3">
          {/* Desktop primarily drags; tap also selects so a pot can be tapped to place. */}
          <FlowerSections onActivate={(f) => selectFlower(f.id)} variant="desktop" />
          {/* shrink-0 + top divider: a crisp bottom boundary for the panel, so no partial
              card row can bleed past the footer. */}
          <p className="mt-2 shrink-0 border-t border-garden-moss/40 pt-2 text-center font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40">
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
