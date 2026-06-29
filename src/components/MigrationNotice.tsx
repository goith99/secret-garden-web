import { useState } from "react";
import { useGame } from "../game/GameContext";

/**
 * Dismissable notice bar shown below the header when the connected wallet's profile is a pre-5D
 * account that must be migrated (one-time) before it can breed or submit. Tapping the bar runs
 * the migrate_profile transaction — the ONLY place it's triggered, so the wallet popup is always
 * something the player explicitly asked for. On success the garden refetches, the profile reads
 * as current, and this notice disappears; on reject it stays so the player can retry later.
 */
export function MigrationNotice() {
  const { profileNeedsMigration, migrating, migrateProfile } = useGame();
  const [dismissed, setDismissed] = useState(false);

  if (!profileNeedsMigration || dismissed) return null;

  return (
    <div className="shrink-0 border-b border-garden-gold/40 bg-garden-gold/10 px-3 py-2">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <span aria-hidden className="text-base leading-none">
          🪴
        </span>
        <button
          type="button"
          onClick={migrateProfile}
          disabled={migrating}
          className="flex-1 text-left font-body text-xs leading-snug text-garden-gold transition disabled:cursor-progress hover:text-garden-cream"
        >
          {migrating ? (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border-2 border-garden-gold/40 border-t-garden-gold"
              />
              Updating your garden…
            </span>
          ) : (
            <>
              Your garden needs a quick update before you can breed or submit.{" "}
              <span className="font-pixel uppercase tracking-wide underline">Tap here to update</span>{" "}
              (one-time, takes ~5 seconds)
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 font-pixel text-sm text-garden-gold/60 transition hover:text-garden-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
