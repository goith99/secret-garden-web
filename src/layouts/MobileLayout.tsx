import { useGame } from "../game/GameContext";
import { AppHeader } from "../components/AppHeader";
import { MigrationNotice } from "../components/MigrationNotice";
import { HybridCollection } from "../components/HybridCollection";
import { Greenhouse } from "../components/Greenhouse";
import { JournalPanel } from "../components/JournalPanel";
import { Footer } from "../components/Footer";
import { MobileTabBar } from "./MobileTabBar";

/**
 * Mobile: a dedicated tabbed layout (NOT a squeezed desktop view). Garden is the default
 * tab. Tapping a flower in the Flowers tab auto-places it into an empty Parent Pot and
 * jumps to the Garden tab — a core UX requirement, implemented here on mock data.
 */
export function MobileLayout() {
  const { activeTab, autoPlace, setActiveTab } = useGame();

  return (
    // `h-screen` (100vh) on a phone is the viewport WITHOUT the browser chrome subtracted, so
    // the shell was taller than what you can actually see: the footer, the tab bar and anything
    // at the bottom of a tab sat below the fold with nothing to scroll. `dvh` tracks the real
    // visible height; `h-screen` stays as the fallback for engines without it.
    <div className="flex h-screen flex-col overflow-hidden supports-[height:100dvh]:h-dvh">
      <AppHeader compact />
      <MigrationNotice />

      <main className="gh-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "flowers" && (
          <HybridCollection
            variant="mobile"
            onActivate={(f) => {
              // auto-place into the first empty pot, then reveal the Garden
              autoPlace(f);
              setActiveTab("garden");
            }}
          />
        )}

        {activeTab === "garden" && <Greenhouse />}

        {activeTab === "journal" && <JournalPanel />}
      </main>

      <Footer />
      <MobileTabBar />
    </div>
  );
}
