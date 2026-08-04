/**
 * The ONLY wallet hook components use. It wraps wallet-adapter's `useWallet` and exposes a
 * small, player-vocabulary surface (a "gardener") — no adapter types leak out, so Stage 6C
 * can grow this (balance, profile PDA, on-chain reads) without changing call sites.
 *
 * Connect uses `select(name)`: because <WalletProvider autoConnect> is enabled, selecting a
 * wallet triggers the connection automatically — no manual `connect()` dance needed.
 */
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { SolflareWalletName } from "@solana/wallet-adapter-solflare";
import { useCallback, useMemo } from "react";
import { shortGardener } from "./format";

export interface Gardener {
  /** True once a wallet is connected and an address is available. */
  connected: boolean;
  /** True while a connection handshake is in flight. */
  connecting: boolean;
  /** Full base58 address, or null when disconnected. (Not shown raw in the UI.) */
  address: string | null;
  /** Shortened gardener name for display, e.g. "8L9S…bTd", or null when disconnected. */
  shortName: string | null;
  connectPhantom: () => void;
  connectSolflare: () => void;
  disconnect: () => void;
  /**
   * Signs a UTF-8 message with the connected wallet and returns a base64 signature — an
   * off-chain proof of wallet ownership, costing no SOL and touching no transaction. Null
   * when disconnected or when the wallet has no signMessage support. Bytes in and out stay
   * inside this hook so call sites keep dealing in plain strings.
   */
  signMessage: ((message: string) => Promise<string>) | null;
}

export function useGardener(): Gardener {
  const {
    publicKey,
    connected,
    connecting,
    select,
    disconnect,
    signMessage: adapterSignMessage,
  } = useWallet();

  const address = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);
  const shortName = useMemo(
    () => (address ? shortGardener(address) : null),
    [address],
  );

  const connectPhantom = useCallback(() => select(PhantomWalletName), [select]);
  const connectSolflare = useCallback(
    () => select(SolflareWalletName),
    [select],
  );
  const leave = useCallback(() => {
    void disconnect();
  }, [disconnect]);

  const signMessage = useMemo(() => {
    if (!adapterSignMessage) return null;
    return async (message: string): Promise<string> => {
      const signature = await adapterSignMessage(new TextEncoder().encode(message));
      return btoa(String.fromCharCode(...signature));
    };
  }, [adapterSignMessage]);

  return {
    connected,
    connecting,
    address,
    shortName,
    connectPhantom,
    connectSolflare,
    disconnect: leave,
    signMessage,
  };
}
