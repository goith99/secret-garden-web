import { useEffect, useRef, useState } from "react";
import { AppWalletProvider } from "./wallet/WalletProvider";
import { NetworkGuardProvider, useNetworkGuard } from "./wallet/useNetworkGuard";
import { ConnectWalletProvider } from "./wallet/ConnectWalletContext";
import { useGardener } from "./wallet/useGardener";
import { SwitchNetworkScreen } from "./screens/SwitchNetworkScreen";
import { GameProvider } from "./game/GameContext";
import { useGardenData, NO_ACTIVE_ROUND } from "./hooks/useGardenData";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { DesktopLayout } from "./layouts/DesktopLayout";
import { MobileLayout } from "./layouts/MobileLayout";
import { GardenEmpty, GardenError, GardenLoading } from "./screens/GardenStates";
import { HowToPlayModal } from "./components/HowToPlayModal";
import { MOCK_STARTERS } from "./mocks/data";

/**
 * Root. The 3-column game is ALWAYS visible — connected or not. A disconnected visitor sees the
 * night garden, the starter flowers, and public round info; the actions that need a wallet (the
 * Hybrid Pot's breed, a flower's Submit to Challenge) raise the ConnectWalletModal instead of
 * blocking the whole screen. Once connected, real on-chain devnet data drives the player's own
 * garden (config, profile, flowers, round) and the real transactions take over.
 */
function GameView() {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}

/** Connected player: their real garden, with the loading / error / claim gates intact. */
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
        breedsThisRound: playerProfile.breedsThisRound,
        lastBreedRound: playerProfile.lastBreedRound,
      }}
      onRefetch={refetch}
    >
      <GameView />
    </GameProvider>
  );
}

/**
 * Disconnected visitor: the same layout, fed PUBLIC round data plus visual starter flowers.
 * No `onRefetch`, so breeding stays inert — the Hybrid Pot raises the connect prompt instead.
 */
function DisconnectedApp() {
  const { activeRound } = useGardenData();

  return (
    <GameProvider
      initial={{
        flowers: MOCK_STARTERS,
        journal: [],
        challenge: activeRound ?? NO_ACTIVE_ROUND,
        winners: [], // revealed winners arrive with scoring (not yet on devnet)
        authority: null,
      }}
    >
      <GameView />
    </GameProvider>
  );
}

function Gate() {
  const { connected } = useGardener();
  // Once a transaction reveals the wallet is on the wrong network, the game is replaced by the
  // Switch-to-Devnet screen until the player switches and presses Check Again (see the guard).
  const { wrongNetwork } = useNetworkGuard();
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

  let view;
  if (!connected) view = <DisconnectedApp />;
  else if (wrongNetwork) view = <SwitchNetworkScreen />;
  else view = <ConnectedApp />;

  return (
    <>
      {view}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </>
  );
}

export default function App() {
  return (
    <AppWalletProvider>
      <NetworkGuardProvider>
        <ConnectWalletProvider>
          <Gate />
        </ConnectWalletProvider>
      </NetworkGuardProvider>
    </AppWalletProvider>
  );
}
