import { useGame } from "../game/GameContext";
import { AppHeader } from "../components/AppHeader";
import { FlowerShelf } from "../components/FlowerShelf";
import { Greenhouse } from "../components/Greenhouse";
import { JournalPanel } from "../components/JournalPanel";
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
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="gh-title text-[11px] text-garden-cyan">Flower Shelf</span>
              <span className="font-pixel text-[9px] uppercase tracking-wide text-garden-parch/50">
                tap to plant
              </span>
            </div>
            <FlowerShelf
              gridClassName="grid-cols-3"
              onActivate={(f) => {
                // auto-place into the first empty pot, then reveal the Garden
                autoPlace(f);
                setActiveTab("garden");
              }}
            />
          </div>
        )}

        {activeTab === "garden" && <Greenhouse />}

        {activeTab === "journal" && <JournalPanel />}
      </main>

      <MobileTabBar />
    </div>
  );
}
