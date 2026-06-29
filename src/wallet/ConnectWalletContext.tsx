/**
 * App-level "connect wallet" prompt. Any component that needs a connected wallet for an action
 * (the Hybrid Pot's breed, a flower's Submit to Challenge, …) calls `requestConnect()` while
 * disconnected to surface the ConnectWalletModal — the game itself stays visible behind it.
 *
 * The modal closes itself as soon as a wallet connects; per spec we do NOT auto-retry the
 * action — the player just clicks again now that they're connected.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ConnectWalletModal } from "../components/ConnectWalletModal";
import { useGardener } from "./useGardener";

interface ConnectWalletValue {
  /** Open the connect prompt (no-op once a wallet is already connected). */
  requestConnect: () => void;
}

const ConnectWalletCtx = createContext<ConnectWalletValue | null>(null);

export function ConnectWalletProvider({ children }: { children: ReactNode }) {
  const { connected } = useGardener();
  const [open, setOpen] = useState(false);

  // Auto-close once connected — reacting to the wallet (an external system) flipping to
  // connected, which this rule explicitly allows; the analyzer can't see that across the
  // boundary, so it's scoped-disabled (same pattern as App / GameContext).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (connected && open) setOpen(false);
  }, [connected, open]);

  const requestConnect = useCallback(() => {
    if (!connected) setOpen(true);
  }, [connected]);

  return (
    <ConnectWalletCtx.Provider value={{ requestConnect }}>
      {children}
      {open && <ConnectWalletModal onClose={() => setOpen(false)} />}
    </ConnectWalletCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConnectWallet(): ConnectWalletValue {
  const ctx = useContext(ConnectWalletCtx);
  if (!ctx) throw new Error("useConnectWallet must be used within <ConnectWalletProvider>");
  return ctx;
}
