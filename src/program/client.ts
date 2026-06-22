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
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import idl from "./idl/secret_garden.json";
import type { SecretGarden } from "./idl/secret_garden";

export type SecretGardenProgram = Program<SecretGarden>;

/**
 * Returns an initialised program client, or null while no wallet is connected. Recreated
 * only when the connection or wallet identity changes (stable across renders otherwise).
 */
export function useProgram(): SecretGardenProgram | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(idl as SecretGarden, provider);
  }, [connection, wallet]);
}
