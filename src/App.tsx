import { AppWalletProvider } from "./wallet/WalletProvider";
import { useGardener } from "./wallet/useGardener";
import { GameProvider } from "./game/GameContext";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { DesktopLayout } from "./layouts/DesktopLayout";
import { MobileLayout } from "./layouts/MobileLayout";
import { DisconnectedScreen } from "./screens/DisconnectedScreen";

/**
 * Root. Stage 6B: a real wallet connection gates the game. <AppWalletProvider> owns all
 * blockchain wiring; the gate shows the connect screen until a wallet is connected, then
 * the existing mock-data game (responsive layout + <GameProvider>) renders unchanged.
 * Stage 6C swaps the mock data SOURCE for on-chain reads behind the same gate.
 */
function Game() {
  // Below 1024px we render the dedicated mobile tabbed layout; the three-column desktop
  // needs ≥lg width to fit one screen without scroll.
  const isMobile = useMediaQuery("(max-width: 1023px)");
  return (
    <GameProvider>{isMobile ? <MobileLayout /> : <DesktopLayout />}</GameProvider>
  );
}

function Gate() {
  const { connected } = useGardener();
  return connected ? <Game /> : <DisconnectedScreen />;
}

export default function App() {
  return (
    <AppWalletProvider>
      <Gate />
    </AppWalletProvider>
  );
}
