import { useGame } from "../game/GameContext";
import { AppHeader } from "../components/AppHeader";
import { MigrationNotice } from "../components/MigrationNotice";
import { HybridCollection } from "../components/HybridCollection";
import { Greenhouse } from "../components/Greenhouse";
import { JournalPanel } from "../components/JournalPanel";
import { Footer } from "../components/Footer";

/**
 * Desktop: one screen, NO page scroll. Three columns — Hybrid Collection (left, scrolls
 * internally) · Greenhouse with the starters planted inside (center, focal) · info panel
 * (right: Today's Request, Daily Winners, Hybrid Journal).
 */
export function DesktopLayout() {
  const { selectFlower } = useGame();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <MigrationNotice />
      <main className="grid min-h-0 flex-1 grid-cols-[clamp(260px,22vw,320px)_1fr_clamp(280px,24vw,360px)] gap-3 p-3">
        {/* LEFT — Hybrid Collection (bred flowers only; starters live in the greenhouse) */}
        <aside className="gh-panel flex min-h-0 flex-col p-3">
          {/* Desktop primarily drags; tap also selects so a pot can be tapped to place. */}
          <HybridCollection onActivate={(f) => selectFlower(f.id)} variant="desktop" />
          {/* shrink-0 + top divider: a crisp bottom boundary for the panel, so no partial
              card row can bleed past the footer. */}
          <p className="mt-2 shrink-0 border-t border-garden-moss/40 pt-2 text-center font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40">
            drag a bloom into a pot
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
      <Footer />
    </div>
  );
}
