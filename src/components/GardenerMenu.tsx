/**
 * Connected-state identity chip for the header. Shows the shortened gardener name and a
 * small dropdown whose only action is to leave (disconnect). Replaces the Stage 6A
 * "guest gardener" placeholder. Player vocabulary only — no "wallet"/"disconnect" jargon.
 */
import { useEffect, useRef, useState } from "react";
import { useGardener } from "../wallet/useGardener";

export function GardenerMenu() {
  const { shortName, disconnect } = useGardener();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  if (!shortName) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-garden-moss/60 bg-garden-deep/40 px-2 py-1 font-pixel text-[9px] uppercase tracking-wide text-garden-parch/80 transition hover:border-garden-mint/60 hover:text-garden-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan"
      >
        <span aria-hidden>🌱</span>
        <span>Gardener {shortName}</span>
        <span aria-hidden className="text-garden-parch/50">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-garden-moss/60 bg-garden-green/95 p-1 shadow-panel backdrop-blur"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
            className="w-full rounded px-2 py-1.5 text-left font-pixel text-[9px] uppercase tracking-wide text-garden-rose/90 transition hover:bg-garden-rose/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-rose"
          >
            Leave Garden
          </button>
        </div>
      )}
    </div>
  );
}
