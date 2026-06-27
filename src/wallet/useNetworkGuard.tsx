/**
 * Wallet network guard (Stage 6D). Secret Garden runs on Solana Devnet and pins its OWN RPC
 * to devnet, but some wallets (notably Phantom/Backpack) submit transactions to whichever
 * network the user selected inside the extension — the dApp cannot force them. Because every
 * read goes through the app's devnet RPC, we cannot observe the wallet's selected cluster up
 * front; the wrong network only becomes visible when a transaction is submitted and fails
 * (e.g. the devnet blockhash / program account is unknown on mainnet).
 *
 * So this guard is TRIGGERED by the send path: `useGardenActions` / `useOperatorActions`
 * classify such failures as a "network" TxError and call `reportWrongNetwork()`. While the
 * flag is set, the app shows the "Switch to Devnet" screen instead of the game. "Check Again"
 * confirms the app can still reach devnet and clears the block so the player can retry; if the
 * next transaction is still on the wrong network, the send path simply re-flags it.
 *
 * Solflare is unaffected: it is pinned to devnet in WalletProvider, so its sends never trip
 * this guard.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "../program/client";
import { fetchGameConfig } from "../program/accounts";

export interface NetworkGuard {
  /** True once a transaction revealed the wallet is on the wrong network. Gates the game UI. */
  wrongNetwork: boolean;
  /** True while "Check Again" is confirming the app can still reach devnet. */
  checking: boolean;
  /** Connected wallet's display name (e.g. "Phantom"), for per-wallet switch instructions. */
  walletName: string | null;
  /** Called by the send path when a transaction fails in a way that indicates wrong network. */
  reportWrongNetwork: () => void;
  /** Re-check + clear the block so the player can retry their action. */
  checkAgain: () => void;
}

const NOOP: NetworkGuard = {
  wrongNetwork: false,
  checking: false,
  walletName: null,
  reportWrongNetwork: () => {},
  checkAgain: () => {},
};

const NetworkGuardContext = createContext<NetworkGuard>(NOOP);

// eslint-disable-next-line react-refresh/only-export-components
export function useNetworkGuard(): NetworkGuard {
  return useContext(NetworkGuardContext);
}

export function NetworkGuardProvider({ children }: { children: ReactNode }) {
  const program = useProgram();
  const { publicKey, wallet } = useWallet();
  const address = publicKey?.toBase58() ?? null;
  const walletName = wallet?.adapter.name ?? null;

  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [checking, setChecking] = useState(false);

  // A fresh wallet (connect / switch / disconnect) starts unjudged — reacting to the wallet
  // (an external system) changing identity, which this rule explicitly allows.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWrongNetwork(false);
  }, [address]);

  const reportWrongNetwork = useCallback(() => setWrongNetwork(true), []);

  const checkAgain = useCallback(() => {
    // We can't read the wallet's selected cluster directly, so this confirms the app can
    // still reach devnet, then clears the block so the player can retry. If the wallet is
    // still on the wrong network, the next send re-flags it.
    setChecking(true);
    void (async () => {
      try {
        if (program) await fetchGameConfig(program);
      } catch {
        // Couldn't reach devnet — leave the screen up; this is a reachability issue, not a
        // successful retry. The player can press Check Again once their connection recovers.
        setChecking(false);
        return;
      }
      setWrongNetwork(false);
      setChecking(false);
    })();
  }, [program]);

  const value = useMemo<NetworkGuard>(
    () => ({ wrongNetwork, checking, walletName, reportWrongNetwork, checkAgain }),
    [wrongNetwork, checking, walletName, reportWrongNetwork, checkAgain],
  );

  return (
    <NetworkGuardContext.Provider value={value}>{children}</NetworkGuardContext.Provider>
  );
}
