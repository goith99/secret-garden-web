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

/**
 * Wallet-standard chain id for devnet. Hard-coded rather than imported from
 * @solana/wallet-standard-chains: that package is only present transitively, and this is a
 * frozen protocol string (CAIP-2 style), not a version-sensitive API.
 */
const DEVNET_CHAIN = "solana:devnet";

/**
 * The chains the connected account declares, or null when we cannot tell.
 *
 * Phantom and friends register as Standard Wallets, so wallet-adapter discards the legacy
 * adapter this app constructs and wraps the standard wallet instead (see
 * useStandardWalletAdapters — it even console.warns that the manual adapter can be removed).
 * StandardWalletAdapter exposes the underlying wallet publicly, which is how we can read the
 * account's declared chains at all.
 *
 * Duck-typed on purpose: a legacy (non-standard) adapter has no `.wallet`, and we must return
 * null — "unknown" — rather than guess, so the caller never warns on missing evidence.
 */
function readAccountChains(adapter: unknown): readonly string[] | null {
  const standardWallet = (
    adapter as {
      wallet?: { accounts?: readonly { chains?: readonly string[] }[] };
    } | null
  )?.wallet;
  const accounts = standardWallet?.accounts;
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  const chains = accounts.flatMap((a) => (Array.isArray(a?.chains) ? a.chains : []));
  return chains.length > 0 ? chains : null;
}

export interface NetworkGuard {
  /** True once a transaction revealed the wallet is on the wrong network. Gates the game UI. */
  wrongNetwork: boolean;
  /** True while "Check Again" is confirming the app can still reach devnet. */
  checking: boolean;
  /** Connected wallet's display name (e.g. "Phantom"), for per-wallet switch instructions. */
  walletName: string | null;
  /**
   * PRE-transaction proof that this wallet cannot send on devnet: the connected account
   * declares its chains and devnet is not among them, so the adapter would refuse the send
   * before a popup ever opens. Only ever true on positive evidence — a wallet that declares
   * devnet (or declares nothing) leaves this false, because `chains` is what the account
   * SUPPORTS, not which cluster it is currently pointed at.
   */
  chainMismatch: boolean;
  /**
   * A wrong network was reported at least once for this wallet. Latches until the wallet
   * changes, so it survives "Check Again" — that button clears the blocking screen without
   * proving anything about the wallet, and the player deserves a standing reminder before
   * they spend another approval.
   */
  suspectedWrongNetwork: boolean;
  /** Called by the send path when a transaction fails in a way that indicates wrong network. */
  reportWrongNetwork: () => void;
  /** Re-check + clear the block so the player can retry their action. */
  checkAgain: () => void;
}

const NOOP: NetworkGuard = {
  wrongNetwork: false,
  checking: false,
  walletName: null,
  chainMismatch: false,
  suspectedWrongNetwork: false,
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
  const [suspectedWrongNetwork, setSuspected] = useState(false);

  // Cheap enough to derive every render, and deriving it means an account swap inside the same
  // wallet is picked up without a subscription to standard:events.
  const chains = readAccountChains(wallet?.adapter ?? null);
  const chainMismatch = chains !== null && !chains.includes(DEVNET_CHAIN);

  // A fresh wallet (connect / switch / disconnect) starts unjudged — reacting to the wallet
  // (an external system) changing identity, which this rule explicitly allows.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWrongNetwork(false);
    setSuspected(false);
  }, [address]);

  const reportWrongNetwork = useCallback(() => {
    setWrongNetwork(true);
    setSuspected(true); // stays set after "Check Again" clears the blocking screen
  }, []);

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
    () => ({
      wrongNetwork,
      checking,
      walletName,
      chainMismatch,
      suspectedWrongNetwork,
      reportWrongNetwork,
      checkAgain,
    }),
    [
      wrongNetwork,
      checking,
      walletName,
      chainMismatch,
      suspectedWrongNetwork,
      reportWrongNetwork,
      checkAgain,
    ],
  );

  return (
    <NetworkGuardContext.Provider value={value}>{children}</NetworkGuardContext.Provider>
  );
}
