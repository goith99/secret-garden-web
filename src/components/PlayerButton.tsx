import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "action" | "pending" | "success" | "danger" | "muted";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "border-garden-gold bg-garden-gold/15 text-garden-gold hover:bg-garden-gold/25",
  action: "border-garden-cyan bg-garden-cyan/15 text-garden-cyan hover:bg-garden-cyan/25",
  pending: "border-garden-moss bg-garden-green/60 text-garden-mint cursor-progress",
  success:
    "border-garden-gold bg-garden-gold/25 text-garden-gold shadow-[0_0_24px_rgba(230,194,92,0.45)] hover:bg-garden-gold/35",
  danger: "border-garden-rose bg-garden-rose/15 text-garden-rose hover:bg-garden-rose/25",
  muted: "border-garden-moss/60 bg-garden-deep/40 text-garden-parch/50",
};

/** Reusable game button with the locked pixel styling. Used for the crossbreed CTA and
 *  other player-facing actions so state-based labels share one look. */
export function PlayerButton({
  variant = "primary",
  children,
  busy = false,
  className = "",
  ...rest
}: {
  variant?: ButtonVariant;
  children: ReactNode;
  busy?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-pixel
        text-sm uppercase tracking-[0.12em] transition disabled:cursor-not-allowed
        focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan ${VARIANT[variant]} ${className}`}
    >
      {busy && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-garden-mint/40 border-t-garden-mint"
        />
      )}
      {children}
    </button>
  );
}
