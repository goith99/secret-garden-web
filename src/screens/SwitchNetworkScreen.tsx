/**
 * Shown (instead of the game) when a transaction reveals the connected wallet is on the wrong
 * network — see useNetworkGuard. Player vocabulary only: it names "Devnet" because the player
 * must find that exact toggle in their wallet, but never "RPC", "cluster" or "endpoint".
 */
import { PlayerButton } from "../components/PlayerButton";
import { useNetworkGuard } from "../wallet/useNetworkGuard";

/** Per-wallet steps to reach the Devnet toggle, picked from the connected wallet's name. */
function instructionsFor(walletName: string | null): string {
  const name = (walletName ?? "").toLowerCase();
  if (name.includes("phantom")) {
    return "Open Phantom → Settings → Developer Settings → Testnet Mode, then choose Devnet.";
  }
  if (name.includes("solflare")) {
    return "Open Solflare → Settings → Network → Devnet.";
  }
  return "Open your wallet settings and switch the network to Devnet.";
}

export function SwitchNetworkScreen() {
  const { walletName, checking, checkAgain } = useNetworkGuard();

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-4xl" aria-hidden>
            🧭
          </span>
          <h2 className="font-pixel text-lg uppercase tracking-[0.18em] text-garden-mint">
            Switch to Devnet
          </h2>
          <p className="font-body text-sm leading-relaxed text-garden-parch/80">
            Secret Garden runs on Solana Devnet. Please switch your wallet to Devnet to play.
          </p>
          <p className="font-body text-sm leading-relaxed text-garden-parch/70">
            {instructionsFor(walletName)}
          </p>
          <div className="w-44">
            <PlayerButton
              variant="action"
              busy={checking}
              disabled={checking}
              onClick={checkAgain}
            >
              Check Again
            </PlayerButton>
          </div>
        </div>
      </div>
    </main>
  );
}
