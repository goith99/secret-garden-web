/**
 * "How to Play" onboarding modal — shown once per wallet connection (App watches the
 * connected transition false→true). No persistence: per spec it appears EVERY time a wallet
 * connects, so there is deliberately no localStorage here.
 *
 * A single scrollable page of sections, dark botanical theme. Dismissed only via the ✕ or
 * the START GROWING button — a backdrop click is intentionally inert so the player can't
 * lose the guide by mis-clicking. Fades in (~200ms). Readable down to 375px width.
 */
import type { ReactNode } from "react";
import { PlayerButton } from "./PlayerButton";

function Section({
  icon,
  title,
  last = false,
  children,
}: {
  icon: string;
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`py-4 ${last ? "" : "border-b border-garden-moss/40"}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-garden-gold">
        <span aria-hidden>{icon}</span>
        <span>{title}</span>
      </h3>
      <div className="mt-2 text-sm leading-relaxed text-garden-parch/80">{children}</div>
    </section>
  );
}

export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex animate-fadeIn items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play Secret Garden"
    >
      <div className="relative w-full max-w-[480px] rounded-xl border border-garden-moss/70 bg-garden-deep shadow-panel">
        {/* Close (✕) — top-right. Backdrop clicks do NOT dismiss (no overlay handler). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close how to play"
          className="absolute right-3 top-3 z-10 rounded-md px-2 py-1 text-lg leading-none text-garden-parch/60 transition hover:text-garden-parch"
        >
          ✕
        </button>

        <div className="gh-scroll max-h-[80vh] overflow-y-auto px-6 py-6">
          <Section icon="🌸" title="Welcome to Secret Garden">
            <p>A private greenhouse where your breeding strategy stays yours.</p>
          </Section>

          <Section icon="🌿" title="How to Crossbreed">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Drag two flowers from your Starter Shelf into the pots</li>
              <li>
                Set your conditions:{" "}
                <span className="text-garden-mint">Light · Water · Soil</span>
              </li>
              <li>Click the Hybrid Pot to start</li>
              <li>Approve in your wallet</li>
              <li>Wait ~10 seconds for your bloom to appear</li>
            </ol>
          </Section>

          <Section icon="🏆" title="Enter the Challenge">
            <p>
              Each day has a new challenge with secret target traits. Submit your best
              hybrid to compete.
            </p>
            <p className="mt-2">
              Scores are calculated in secret — no one sees the results until the operator
              reveals the Top 3 winners.
            </p>
          </Section>

          <Section icon="🔒" title="Your Strategy Stays Private">
            <p>
              Powered by Arcium MPC. Your flower's genome is fully encrypted — even we
              can't see your breeding strategy.
            </p>
          </Section>

          <Section icon="⚠️" title="This is Devnet Alpha" last>
            <p>Running on Solana Devnet. No real money involved.</p>
            <p className="mt-2">
              Bugs and rough edges expected — feedback is welcome!
            </p>
          </Section>

          {/* Dismiss — same primary look as the in-game crossbreed CTA. */}
          <div className="pt-4">
            <PlayerButton variant="primary" onClick={onClose}>
              Start Growing
            </PlayerButton>
          </div>
        </div>
      </div>
    </div>
  );
}
