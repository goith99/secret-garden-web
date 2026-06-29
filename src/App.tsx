import { useEffect, useRef, useState } from "react";
import { AppWalletProvider } from "./wallet/WalletProvider";
import { NetworkGuardProvider, useNetworkGuard } from "./wallet/useNetworkGuard";
import { ConnectWalletProvider } from "./wallet/ConnectWalletContext";
import { useGardener } from "./wallet/useGardener";
import { SwitchNetworkScreen } from "./screens/SwitchNetworkScreen";
import { GameProvider, type GardenInitial } from "./game/GameContext";
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

/**
 * The garden. ALWAYS renders the 3-column game. The loading / error / claim full-screen states
 * apply ONLY to a connected wallet whose own garden is being fetched — a disconnected visitor
 * skips every gate and always sees the layout (public round data + the starter flowers), so a
 * failed public read can never replace the game with the "out of reach" error.
 */
function GardenApp() {
  const { connected } = useGardener();
  const { flowers, journal, activeRound, playerProfile, gameConfig, loading, error, refetch, profileNeedsMigration } =
    useGardenData();

  // NOTE: a pre-5D (68-byte) profile is read safely (fetchPlayerProfile decodes the old layout
  // and defaults the new fields). We NEVER auto-migrate — `profileNeedsMigration` drives an
  // in-game "update your garden" notice; the player chooses when to run the one-time migrate.

  // Connected-only gates. Gated strictly on `connected` so a disconnected visitor never hits
  // them, regardless of how the public read resolves.
  if (connected) {
    // First load (no garden yet) shows the tending state; a background refresh keeps it up.
    if (loading && !playerProfile) return <GardenLoading />;
    // ONLY a connected wallet whose own garden genuinely failed to load (no profile after the
    // fetch) sees this. A failed background refetch keeps the game on screen (see bloom toast).
    if (error && !playerProfile) return <GardenError message={error} onRetry={refetch} />;
    if (!playerProfile) return <GardenEmpty onRefresh={refetch} />;
  }

  const initial: GardenInitial =
    connected && playerProfile
      ? {
          flowers,
          journal,
          challenge: activeRound ?? NO_ACTIVE_ROUND,
          winners: [], // revealed winners arrive with scoring (not yet on devnet) — see notes
          authority: gameConfig?.authority ?? null, // gates the hidden operator panel
          breedsThisRound: playerProfile.breedsThisRound,
          lastBreedRound: playerProfile.lastBreedRound,
          profileNeedsMigration,
        }
      : {
          // Disconnected: visual starters in the garden, empty collection, public round info.
          // No `onRefetch`, so breeding stays inert — the Hybrid Pot raises the connect prompt.
          flowers: MOCK_STARTERS,
          journal: [],
          challenge: activeRound ?? NO_ACTIVE_ROUND,
          winners: [],
          authority: null,
        };

  return (
    <GameProvider initial={initial} onRefetch={connected ? refetch : undefined}>
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

  // The wrong-network screen is a connected-only takeover; everyone else gets the game.
  const view = connected && wrongNetwork ? <SwitchNetworkScreen /> : <GardenApp />;

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
