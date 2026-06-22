/**
 * The single home for wallet-adapter wiring (Stage 6B). All blockchain plumbing lives
 * here so UI components never import wallet-adapter directly — Stage 6C will add the RPC
 * connection / data-fetching providers around the same tree without touching components.
 *
 * Network is pinned to Solana DEVNET explicitly so Phantom/Solflare never reach for
 * mainnet. The RPC endpoint is the PUBLIC devnet node — the Helius key is server-side
 * only and must never enter the browser bundle. Stage 6C will move this to an env var.
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

  // Adapters are instantiated once. Solflare is told the network so its in-wallet UX
  // defaults to devnet; Phantom follows the ConnectionProvider endpoint.
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
