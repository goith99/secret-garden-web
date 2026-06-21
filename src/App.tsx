import { GameProvider } from "./game/GameContext";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { DesktopLayout } from "./layouts/DesktopLayout";
import { MobileLayout } from "./layouts/MobileLayout";

/**
 * Root. Chooses a dedicated layout per viewport (mobile is its own tree, not a squeezed
 * desktop). All UI state lives in <GameProvider>. Stage 6A: mock data only — no wallet,
 * no RPC, no anchor.
 */
export default function App() {
  // Below 1024px (phones + portrait tablets) we render the dedicated mobile tabbed
  // layout; the three-column desktop needs ≥lg width to fit one screen without scroll.
  const isMobile = useMediaQuery("(max-width: 1023px)");

  return (
    <GameProvider>{isMobile ? <MobileLayout /> : <DesktopLayout />}</GameProvider>
  );
}
