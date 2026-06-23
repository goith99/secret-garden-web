import { useEffect, useRef, useState } from "react";
import { AppWalletProvider } from "./wallet/WalletProvider";
import { useGardener } from "./wallet/useGardener";
import { GameProvider } from "./game/GameContext";
import { useGardenData, NO_ACTIVE_ROUND } from "./hooks/useGardenData";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { DesktopLayout } from "./layouts/DesktopLayout";
import { MobileLayout } from "./layouts/MobileLayout";
import { DisconnectedScreen } from "./screens/DisconnectedScreen";
import { GardenEmpty, GardenError, GardenLoading } from "./screens/GardenStates";
import { HowToPlayModal } from "./components/HowToPlayModal";

/**
 * Root. Stage 6C: behind the Stage 6B wallet gate, real on-chain devnet data drives the
 * game. The connected app reads the player's garden (config, profile, flowers, round) and
 * feeds the mapped UI data into <GameProvider>; the existing layouts/components are
 * unchanged — they consume it through useGame(). Transactions are still mocked (Stage 6D).
 */
function GameView() {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}

function ConnectedApp() {
  const { flowers, journal, activeRound, playerProfile, gameConfig, loading, error, refetch } =
    useGardenData();

  // First load (no data yet) shows the tending state; a background refresh keeps the game up.
  if (loading && !playerProfile) return <GardenLoading />;
  // The full-screen "out of reach" state is ONLY for an initial load failure (no garden yet).
  // A failed background refetch after a transaction keeps the game on screen and is retried
  // quietly (see GameContext bloom toast) — it must never blow away the player's session.
  if (error && !playerProfile) return <GardenError message={error} onRetry={refetch} />;
  if (!playerProfile) return <GardenEmpty onRefresh={refetch} />;

  return (
    <GameProvider
      initial={{
        flowers,
        journal,
        challenge: activeRound ?? NO_ACTIVE_ROUND,
        winners: [], // revealed winners arrive with scoring (not yet on devnet) — see notes
        authority: gameConfig?.authority ?? null, // gates the hidden operator panel
      }}
      onRefetch={refetch}
    >
      <GameView />
    </GameProvider>
  );
}

function Gate() {
  const { connected } = useGardener();
  // Show the How to Play guide once per wallet connection — every false→true transition
  // (a fresh connect, or a disconnect + reconnect). No localStorage by design (per spec).
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const prevConnected = useRef(false);
  useEffect(() => {
    // Reacting to an external system (the wallet) flipping to connected — set the flag once
    // on the rising edge, then record the level for the next comparison.
    if (connected && !prevConnected.current) setShowHowToPlay(true);
    prevConnected.current = connected;
  }, [connected]);

  return (
    <>
      {connected ? <ConnectedApp /> : <DisconnectedScreen />}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </>
  );
}

export default function App() {
  return (
    <AppWalletProvider>
      <Gate />
    </AppWalletProvider>
  );
}
