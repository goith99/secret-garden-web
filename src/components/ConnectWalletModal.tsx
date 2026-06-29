/**
 * Connect-wallet prompt shown when a disconnected visitor tries to do something that needs a
 * wallet (breed in the Hybrid Pot, submit a flower to the challenge, …). The game stays fully
 * visible behind it — this is a gentle gate, not the old full-screen wall. Botanical theme,
 * player vocabulary only. Dismiss with the ✕ or by clicking the backdrop; it also closes
 * itself once a wallet connects (see ConnectWalletProvider), after which the player simply
 * clicks their action again.
 */
import { useState } from "react";
import { PlayerButton } from "./PlayerButton";
import { useGardener } from "../wallet/useGardener";

type Pending = "phantom" | "solflare" | null;

export function ConnectWalletModal({ onClose }: { onClose: () => void }) {
  const { connectPhantom, connectSolflare, connecting } = useGardener();
  const [pending, setPending] = useState<Pending>(null);

  const handlePhantom = () => {
    setPending("phantom");
    connectPhantom();
  };
  const handleSolflare = () => {
    setPending("solflare");
    connectSolflare();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Connect your wallet"
    >
      {/* Backdrop — click to dismiss. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />

      {/* Modal card */}
      <div className="gh-panel relative z-10 w-full max-w-sm rounded-2xl border-2 border-garden-moss/70 bg-garden-deep/95 p-6 text-center shadow-panel">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 font-pixel text-sm text-garden-parch/60 transition hover:text-garden-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan"
        >
          ✕
        </button>

        <div className="mb-5 flex flex-col items-center gap-2">
          <span className="text-3xl" aria-hidden>
            🌿
          </span>
          <h2 className="font-pixel text-lg uppercase tracking-[0.16em] text-garden-mint">
            Connect Your Wallet
          </h2>
          <p className="max-w-xs font-body text-sm leading-relaxed text-garden-parch/80">
            To breed flowers and join the challenge, connect your wallet first.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <PlayerButton
            variant="primary"
            onClick={handlePhantom}
            busy={connecting && pending === "phantom"}
            disabled={connecting}
          >
            Connect Phantom
          </PlayerButton>
          <PlayerButton
            variant="action"
            onClick={handleSolflare}
            busy={connecting && pending === "solflare"}
            disabled={connecting}
          >
            Connect Solflare
          </PlayerButton>
        </div>

        <p className="mt-5 font-pixel text-[9px] uppercase tracking-wide text-garden-parch/40">
          Running on Solana Devnet — no real money needed
        </p>
      </div>
    </div>
  );
}
