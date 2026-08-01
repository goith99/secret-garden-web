/**
 * The single home for wallet-adapter wiring (Stage 6B). All blockchain plumbing lives
 * here so UI components never import wallet-adapter directly — Stage 6C will add the RPC
 * connection / data-fetching providers around the same tree without touching components.
 *
 * Network is pinned to Solana DEVNET. The app's RPC endpoint is a PUBLIC devnet node (the
 * Helius key is server-side only and must never enter the browser bundle) — see
 * rpcEndpoints.ts for the list and the fallback probe. Each adapter that accepts a `network`
 * option is ALSO pinned so it submits to devnet — but not every wallet exposes one (see
 * below), so a send-time network guard (useNetworkGuard) backstops the wallets that can't
 * be pinned.
 */
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  WalletAdapterNetwork,
  type WalletError,
} from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEVNET_ENDPOINTS, pickDevnetEndpoint } from "./rpcEndpoints";

// Devnet-only game. DEVNET_ENDPOINTS[0] is https://api.devnet.solana.com, the same node
// clusterApiUrl(Devnet) resolves to — now the head of a list with one verified fallback.
const NETWORK = WalletAdapterNetwork.Devnet;

export function AppWalletProvider({ children }: { children: ReactNode }) {
  // Start on the primary and probe in the BACKGROUND rather than blocking first paint: the
  // primary is healthy the overwhelming majority of the time, and a startup gate would cost
  // every player a round trip to save the rare one. If the probe finds the primary down, the
  // swap re-creates the Connection, which re-creates the Anchor program, which makes
  // useGardenData re-run its load automatically — no extra plumbing needed.
  const [endpoint, setEndpoint] = useState<string>(DEVNET_ENDPOINTS[0]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const healthy = await pickDevnetEndpoint();
      // null = every candidate failed. Stay put and let the existing "garden is out of reach"
      // retry handle it rather than parking on a node already known to be broken. Equal to the
      // primary = the normal path: it answered, so there is nothing to switch.
      if (cancelled || healthy === null || healthy === DEVNET_ENDPOINTS[0]) return;
      console.warn(
        `[garden] devnet RPC ${DEVNET_ENDPOINTS[0]} unhealthy, falling back to ${healthy}`,
      );
      setEndpoint(healthy);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Adapters are instantiated once.
  //
  // Solflare's constructor accepts a `network`, so we pin it to devnet — it then submits to
  // devnet and never trips the network guard.
  //
  // PhantomWalletAdapter's constructor takes NO network option (verified in
  // node_modules/@solana/wallet-adapter-phantom): Phantom submits via its own provider on
  // whatever cluster the user selected in the extension, which the dApp cannot override. We
  // therefore leave it as-is and rely on the send-time network guard (useNetworkGuard) to
  // detect a wrong-network submission and prompt the player to switch to Devnet. Any future
  // adapter that DOES accept `{ network }` should be pinned here like Solflare.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: NETWORK }),
    ],
    [],
  );

  // Expected, non-fatal cases (user closed the popup, extension not installed, no wallet
  // selected) surface here instead of throwing into React. Logged, not shown to players.
  const onError = useCallback((err: WalletError) => {
    console.warn(`[wallet] ${err.name}: ${err.message}`);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
