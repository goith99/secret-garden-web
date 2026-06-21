import { useGame } from "../game/GameContext";
import type { MobileTab } from "../types";

const TABS: { id: MobileTab; label: string; icon: string }[] = [
  { id: "flowers", label: "Flowers", icon: "🌼" },
  { id: "garden", label: "Garden", icon: "🪴" },
  { id: "journal", label: "Journal", icon: "📖" },
];

/** Bottom tab bar for the mobile layout (Flowers · Garden · Journal). */
export function MobileTabBar() {
  const { activeTab, setActiveTab, phase, isCycling } = useGame();
  const gardenAlert = isCycling || phase === "BloomReady";

  return (
    <nav className="flex shrink-0 border-t border-garden-moss/60 bg-garden-green/70">
      {TABS.map((t) => {
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 font-pixel text-[10px] uppercase tracking-wide transition
              ${active ? "text-garden-gold" : "text-garden-parch/60"}`}
          >
            <span className="text-lg" aria-hidden>
              {t.icon}
            </span>
            {t.label}
            {t.id === "garden" && gardenAlert && (
              <span className="absolute right-[28%] top-1 h-2 w-2 animate-pulseSoft rounded-full bg-garden-gold" />
            )}
            {active && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-garden-gold" />}
          </button>
        );
      })}
    </nav>
  );
}
