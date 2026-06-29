/**
 * Anchor program client (Stage 6C — READ ONLY). Builds a `Program<SecretGarden>` bound to
 * the connected wallet and the devnet RPC. Everything Anchor/program-shaped lives under
 * src/program/ so UI never imports program types — components consume the mapped UI types
 * via the useGardenData hook.
 *
 * No transactions are sent in 6C: the provider's wallet is only used to satisfy Anchor's
 * constructor; all calls here are account reads. Stage 6D adds signing/transactions.
 */
import { AnchorProvider, Program } from "@anchor-lang/core";
import { useConnection, useAnchorWallet, type AnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import idl from "./idl/secret_garden.json";
import type { SecretGarden } from "./idl/secret_garden";

export type SecretGardenProgram = Program<SecretGarden>;

/**
 * A signer that can never sign — used only to satisfy AnchorProvider's constructor when no
 * wallet is connected. The program is then read-only (public account reads work; any signing
 * path throws). This lets disconnected visitors see public data (rounds, winners) while the
 * game stays fully visible. Transactions still require a real connected wallet (see
 * useGardenActions, which gates on `publicKey`).
 */
const READ_ONLY_WALLET: AnchorWallet = {
  publicKey: PublicKey.default,
  signTransaction: () => Promise.reject(new Error("read-only: connect a wallet to sign")),
  signAllTransactions: () => Promise.reject(new Error("read-only: connect a wallet to sign")),
};

/**
 * Returns an initialised program client. When a wallet is connected it is bound to that
 * wallet (signing-capable); when none is connected it falls back to a READ-ONLY client so
 * public on-chain data still loads for disconnected visitors. Recreated only when the
 * connection or wallet identity changes (stable across renders otherwise).
 */
export function useProgram(): SecretGardenProgram | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    const provider = new AnchorProvider(connection, wallet ?? READ_ONLY_WALLET, {
      commitment: "confirmed",
    });
    return new Program(idl as SecretGarden, provider);
  }, [connection, wallet]);
}
