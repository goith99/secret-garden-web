/**
 * Non-blocking "your wallet may not be on Devnet" strip.
 *
 * This is the gentle half of the network guard. The BLOCKING half — SwitchNetworkScreen — takes
 * over the whole page once a transaction has proven the wallet is on the wrong cluster. This
 * banner covers the two states where we have reason to warn but no proof worth stopping the
 * game for:
 *
 *   chainMismatch          the connected account declares its chains and devnet isn't among
 *                          them, so the adapter will refuse the send before a popup opens.
 *                          Proof, but pre-transaction — nothing has failed yet, so we warn
 *                          rather than block.
 *   suspectedWrongNetwork  a wrong network was reported earlier for this wallet and the player
 *                          pressed "Check Again". That button only re-confirms the APP can
 *                          reach devnet; it proves nothing about the wallet, so the warning
 *                          stays up until they switch wallets or a send finally succeeds.
 *
 * Deliberately NOT shown to every Phantom user as a standing "we can't tell" notice: `chains`
 * reports what an account SUPPORTS, not which cluster it is on, so most wallets look fine here
 * whatever their setting. A banner that is usually wrong is a banner players learn to ignore —
 * and this one needs to be believed on the day it is right.
 *
 * Dismissible per mount. Same dark botanical vocabulary as the toasts and the error boundary.
 */
import { useState } from "react";
import { useNetworkGuard } from "../wallet/useNetworkGuard";

export function NetworkBanner() {
  const { wrongNetwork, chainMismatch, suspectedWrongNetwork, walletName } = useNetworkGuard();
  const [dismissed, setDismissed] = useState(false);

  // SwitchNetworkScreen already owns the screen in this case — never stack a banner on it.
  if (wrongNetwork) return null;
  if (dismissed) return null;
  if (!chainMismatch && !suspectedWrongNetwork) return null;

  // Proof reads as a statement; a lingering suspicion reads as a maybe.
  const message = chainMismatch
    ? "Your wallet isn't on Devnet — transactions will fail until you switch."
    : "Your wallet may not be on Devnet — transactions could fail or land on the wrong network.";

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-2"
    >
      <div
        className="pointer-events-auto flex w-full max-w-2xl items-start gap-2 rounded-lg border
          border-garden-gold/70 bg-garden-deep/95 px-3 py-2 shadow-lg animate-rise"
      >
        <span aria-hidden className="mt-0.5 text-sm leading-none">
          🧭
        </span>
        <p className="flex-1 font-body text-xs leading-snug text-garden-gold">
          {message}{" "}
          <span className="text-garden-parch/70">
            {walletName
              ? `Switch ${walletName} to Devnet and try again.`
              : "Switch your wallet to Devnet and try again."}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss network warning"
          className="shrink-0 font-pixel text-xs text-garden-gold/70 transition hover:text-garden-gold
            focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
