/**
 * The gate shown when no wallet is connected (Stage 6B). Per the locked design it shows
 * ONLY the game name, one botanical description line, and the two connect buttons — no
 * shelf, greenhouse, or journal. Player vocabulary only.
 */
import { useState } from "react";
import { PlayerButton } from "../components/PlayerButton";
import { useGardener } from "../wallet/useGardener";

type Pending = "phantom" | "solflare" | null;

export function DisconnectedScreen() {
  const { connectPhantom, connectSolflare, connecting } = useGardener();
  // Track which button was pressed so only that one shows the spinner during the handshake.
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
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mb-7 flex flex-col items-center gap-3">
          <span className="text-4xl" aria-hidden>
            🌿
          </span>
          <h1 className="font-pixel text-2xl uppercase tracking-[0.22em] text-garden-mint">
            Secret Garden
          </h1>
          <p className="max-w-xs font-body text-sm leading-relaxed text-garden-parch/80">
            A private greenhouse where your breeding strategy stays yours.
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
      </div>
    </main>
  );
}
