/**
 * The single home for wallet-adapter wiring (Stage 6B). All blockchain plumbing lives
 * here so UI components never import wallet-adapter directly — Stage 6C will add the RPC
 * connection / data-fetching providers around the same tree without touching components.
 *
 * Network is pinned to Solana DEVNET. The app's own RPC endpoint is the PUBLIC devnet node
 * (the Helius key is server-side only and must never enter the browser bundle; Stage 6C will
 * move this to an env var). Each adapter that accepts a `network` option is ALSO pinned so it
 * submits to devnet — but not every wallet exposes one (see below), so a send-time network
 * guard (useNetworkGuard) backstops the wallets that can't be pinned.
 */
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  WalletAdapterNetwork,
  type WalletError,
} from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { useCallback, useMemo, type ReactNode } from "react";

// Devnet-only game. clusterApiUrl(Devnet) resolves to https://api.devnet.solana.com.
const NETWORK = WalletAdapterNetwork.Devnet;

export function AppWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);

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
