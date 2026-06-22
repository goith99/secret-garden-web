import { useGame } from "../game/GameContext";
import { AppHeader } from "../components/AppHeader";
import { FlowerSections } from "../components/FlowerSections";
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
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader compact />

      <main className="gh-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "flowers" && (
          <FlowerSections
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
