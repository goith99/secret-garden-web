import { Link } from "react-router-dom";
import { NightGardenScene } from "./NightGardenScene";

/**
 * Documentation route at "/docs". A single scrollable page in the same night-garden aesthetic as
 * the landing page (shared NightGardenScene backdrop + the garden palette/fonts). Carries NONE of
 * the game's wallet/provider machinery — it's a plain content page split into two halves:
 * "For Players" (casual how-to + FAQ) and "For Developers" (architecture, Arcium, program IDs).
 *
 * Responsive: a single centered column (max-w) that reads cleanly down to 375px. The TOC is plain
 * in-page anchor links; FAQ items are native <details> so there's no new dependency.
 */

/** Small section eyebrow — mirrors the SectionLabel styling used on the landing page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="gh-title mb-2 text-[11px] text-garden-mint/90 sm:text-xs">{children}</p>
  );
}

/** Inline code chip for program IDs, account names, and technical terms. */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-garden-moss/60 bg-garden-deep/70 px-1.5 py-0.5 font-pixel text-[0.85em] text-garden-cyan">
      {children}
    </code>
  );
}

/** A titled card holding a numbered list of steps. */
function StepList({
  title,
  steps,
  note,
}: {
  title: string;
  steps: React.ReactNode[];
  note?: React.ReactNode;
}) {
  return (
    <div className="gh-panel p-6 sm:p-7">
      <h3 className="font-pixel text-base uppercase tracking-[0.12em] text-garden-cream sm:text-lg">
        {title}
      </h3>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 font-body text-sm leading-relaxed text-garden-parch/90">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-garden-gold/70 bg-garden-deep/70 font-pixel text-xs text-garden-gold">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      {note && (
        <p className="mt-4 rounded-lg border border-garden-lavender/40 bg-garden-lavender/10 px-4 py-2.5 font-body text-xs leading-relaxed text-garden-lavender">
          {note}
        </p>
      )}
    </div>
  );
}

/** Collapsible FAQ entry using native <details> — open by default for readability. */
function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group gh-panel overflow-hidden" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-pixel text-[13px] uppercase tracking-[0.08em] text-garden-mint transition hover:text-garden-cream">
        <span>{q}</span>
        <span className="flex-none font-body text-garden-parch/60 transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <p className="border-t border-garden-moss/40 px-5 py-4 font-body text-sm leading-relaxed text-garden-parch/90">
        {a}
      </p>
    </details>
  );
}

const TOC = [
  { href: "#getting-started", label: "Getting Started" },
  { href: "#how-to-breed", label: "How to Breed" },
  { href: "#how-to-enter", label: "How to Enter Challenge" },
  { href: "#faq", label: "FAQ" },
  { href: "#architecture", label: "Architecture" },
  { href: "#arcium", label: "Arcium Integration" },
  { href: "#program", label: "Program ID & Accounts" },
];

const CORE_ACCOUNTS = [
  { name: "GameConfig", desc: "global settings, authority, operators" },
  { name: "PlayerProfile", desc: "per-wallet stats, breeding limits" },
  { name: "FlowerRecord", desc: "individual flower data, encrypted genome" },
  { name: "CompetitionRound", desc: "daily challenge round state" },
  { name: "CompetitionEntry", desc: "per-wallet submission per round" },
];

export function DocsPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-garden-cream">
      {/* Fixed night-garden backdrop so it stays put while the page scrolls. */}
      <div className="fixed inset-0 -z-10">
        <NightGardenScene />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-5 py-12 sm:gap-20 sm:px-8 sm:py-16">
        {/* ---------- TOP NAV ---------- */}
        <nav className="flex items-center justify-between">
          <Link
            to="/"
            className="font-pixel text-xs uppercase tracking-[0.16em] text-garden-parch/70 underline-offset-4 transition hover:text-garden-mint hover:underline"
          >
            ← Back to Secret Garden
          </Link>
          <Link
            to="/app"
            className="font-pixel text-xs uppercase tracking-[0.16em] text-garden-cyan underline-offset-4 transition hover:underline"
          >
            Play Now →
          </Link>
        </nav>

        {/* ---------- HEADER + TOC ---------- */}
        <header className="flex flex-col items-center text-center">
          <h1 className="font-pixel text-3xl font-bold uppercase tracking-[0.12em] text-garden-cream drop-shadow-[0_2px_0_rgba(0,0,0,0.4)] sm:text-5xl">
            Documentation
          </h1>
          <p className="gh-title mt-3 text-[11px] text-garden-gold sm:text-sm">
            Player guide &amp; developer reference
          </p>

          <nav
            aria-label="Table of contents"
            className="mt-7 flex flex-wrap justify-center gap-2.5"
          >
            {TOC.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full border border-garden-moss/70 bg-garden-green/50 px-3.5 py-1.5 font-pixel text-[10px] uppercase tracking-[0.12em] text-garden-parch shadow-panel transition hover:border-garden-mint/70 hover:text-garden-mint sm:text-[11px]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>

        {/* ================= FOR PLAYERS ================= */}
        <section className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-garden-moss/40" />
            <h2 className="font-pixel text-lg uppercase tracking-[0.18em] text-garden-mint sm:text-2xl">
              For Players
            </h2>
            <span className="h-px flex-1 bg-garden-moss/40" />
          </div>

          {/* --- Getting Started --- */}
          <div id="getting-started" className="scroll-mt-8">
            <SectionLabel>Getting Started</SectionLabel>
            <StepList
              title="Getting Started"
              steps={[
                <>Install a Solana wallet (<strong className="text-garden-cream">Phantom</strong> or <strong className="text-garden-cream">Solflare</strong>)</>,
                <>Switch your wallet network to <strong className="text-garden-cream">Devnet</strong></>,
                <>Get free Devnet SOL from a faucet (e.g. <Code>faucet.solana.com</Code>)</>,
                <>Visit the game and connect your wallet</>,
                <>Claim your <strong className="text-garden-cream">6 starter flowers</strong></>,
              ]}
            />
          </div>

          {/* --- How to Breed --- */}
          <div id="how-to-breed" className="scroll-mt-8">
            <SectionLabel>How to Breed</SectionLabel>
            <StepList
              title="How to Breed"
              steps={[
                <>Drag two flowers into <strong className="text-garden-cream">Parent A</strong> and <strong className="text-garden-cream">Parent B</strong> slots in the Hybrid Pot</>,
                <>Adjust <strong className="text-garden-cream">Greenhouse Controls</strong> (Light, Water, Soil) to influence the cross</>,
                <>Confirm the transaction in your wallet</>,
                <>Wait for the cross to complete (a few seconds, powered by Arcium MPC)</>,
                <>Your new hybrid flower appears — choose to <strong className="text-garden-cream">Save to Collection</strong> or <strong className="text-garden-cream">Submit to Challenge</strong></>,
              ]}
              note={<>You get <strong>5 breeding attempts</strong> per round.</>}
            />
          </div>

          {/* --- How to Enter Challenge --- */}
          <div id="how-to-enter" className="scroll-mt-8">
            <SectionLabel>How to Enter Challenge</SectionLabel>
            <StepList
              title="How to Enter Challenge"
              steps={[
                <>Check <strong className="text-garden-cream">Today&apos;s Request</strong> — see which traits judges are looking for</>,
                <>Breed a flower matching as many wanted traits as possible</>,
                <>Click <strong className="text-garden-cream">SUBMIT TO CHALLENGE</strong> on your best hybrid</>,
                <>Only one entry per wallet per round</>,
                <>Winners are revealed after the round closes</>,
              ]}
            />
          </div>

          {/* --- FAQ --- */}
          <div id="faq" className="scroll-mt-8">
            <SectionLabel>FAQ</SectionLabel>
            <div className="flex flex-col gap-3">
              <Faq
                q="Is this real money / mainnet?"
                a={<>Secret Garden currently runs on <strong className="text-garden-cream">Solana Devnet</strong> — no real funds involved.</>}
              />
              <Faq
                q="Why can't I see other players' flower traits?"
                a={<>Genome data is encrypted using Arcium MPC. Even the game operator cannot see raw trait values.</>}
              />
              <Faq
                q="I already entered this round, why is Submit disabled?"
                a={<>Each wallet can only submit <strong className="text-garden-cream">one entry per round</strong>.</>}
              />
              <Faq
                q="My wallet popup didn't appear, what do I do?"
                a={<>Make sure your wallet is set to <strong className="text-garden-cream">Devnet</strong> network, not Mainnet.</>}
              />
            </div>
          </div>
        </section>

        {/* ================= FOR DEVELOPERS ================= */}
        <section className="flex flex-col gap-8">
          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-garden-moss/40" />
            <h2 className="font-pixel text-lg uppercase tracking-[0.18em] text-garden-lavender sm:text-2xl">
              For Developers
            </h2>
            <span className="h-px flex-1 bg-garden-moss/40" />
          </div>

          {/* --- Architecture Overview --- */}
          <div id="architecture" className="scroll-mt-8">
            <SectionLabel>Architecture Overview</SectionLabel>
            <div className="gh-panel flex flex-col gap-5 p-6 sm:p-7">
              <p className="font-body text-sm leading-relaxed text-garden-parch/90">
                Secret Garden is a full-stack Solana program built with <strong className="text-garden-cream">Anchor</strong>, integrated with <strong className="text-garden-cream">Arcium</strong> for encrypted multi-party computation (MPC).
              </p>

              <div>
                <p className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-mint">Stack</p>
                <ul className="mt-2 flex flex-col gap-1.5 font-body text-sm leading-relaxed text-garden-parch/90">
                  <li><strong className="text-garden-cream">On-chain:</strong> Anchor program (Rust) on Solana Devnet</li>
                  <li><strong className="text-garden-cream">Privacy layer:</strong> Arcium MPC for encrypted genome storage and scoring</li>
                  <li><strong className="text-garden-cream">Frontend:</strong> React + TypeScript, deployed on Vercel</li>
                  <li><strong className="text-garden-cream">Off-chain history:</strong> Supabase (round results, winners)</li>
                </ul>
              </div>

              <div>
                <p className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-mint">Core accounts</p>
                <ul className="mt-2 flex flex-col gap-2 font-body text-sm leading-relaxed text-garden-parch/90">
                  {CORE_ACCOUNTS.map((acc) => (
                    <li key={acc.name} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                      <Code>{acc.name}</Code>
                      <span className="text-garden-parch/80">— {acc.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* --- Arcium Integration --- */}
          <div id="arcium" className="scroll-mt-8">
            <SectionLabel>Arcium Integration</SectionLabel>
            <div className="gh-panel flex flex-col gap-5 p-6 sm:p-7">
              <p className="font-body text-sm leading-relaxed text-garden-parch/90">
                Flower genomes are stored as <Code>Enc&lt;Mxe, Genome&gt;</Code> — encrypted state that only Arcium&apos;s MPC network can compute over, never decrypted on-chain or visible to the operator.
              </p>

              <div>
                <p className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-lavender">Two MPC circuits power the game</p>
                <ul className="mt-2 flex flex-col gap-2 font-body text-sm leading-relaxed text-garden-parch/90">
                  <li>
                    <Code>score_entry</Code> — computes a hidden score for each submitted flower by matching its revealed traits against the round&apos;s target traits
                  </li>
                  <li>
                    <Code>reveal_top3</Code> — determines the top 3 winners by comparing encrypted scores, without exposing any player&apos;s individual score
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-lavender">Computation flow</p>
                <p className="mt-2 font-body text-sm leading-relaxed text-garden-parch/90">
                  <Code>queue_computation</Code> → Arcium MPC nodes compute → callback writes result on-chain.
                </p>
              </div>
            </div>
          </div>

          {/* --- Program ID & Accounts --- */}
          <div id="program" className="scroll-mt-8">
            <SectionLabel>Program ID &amp; Accounts</SectionLabel>
            <div className="gh-panel flex flex-col gap-4 p-6 sm:p-7">
              <dl className="flex flex-col gap-3 font-body text-sm text-garden-parch/90">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-mint sm:w-32 sm:flex-none">Program ID</dt>
                  <dd className="min-w-0 break-all"><Code>7eMfGCkXavfZeVrwRo3ZH63C7H6mZ6n1HZKJwGkZBddo</Code></dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-mint sm:w-32 sm:flex-none">Network</dt>
                  <dd><Code>Solana Devnet</Code></dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-mint sm:w-32 sm:flex-none">Cluster Offset</dt>
                  <dd><Code>456</Code></dd>
                </div>
              </dl>

              <div className="border-t border-garden-moss/40 pt-4">
                <p className="font-pixel text-xs uppercase tracking-[0.12em] text-garden-mint">Repos</p>
                <ul className="mt-2 flex flex-col gap-2 font-body text-sm">
                  <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                    <span className="text-garden-parch/80">Backend:</span>
                    <a
                      href="https://github.com/goith99/secret-garden"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel text-[0.85em] text-garden-cyan underline-offset-4 transition hover:underline"
                    >
                      github.com/goith99/secret-garden
                    </a>
                  </li>
                  <li className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                    <span className="text-garden-parch/80">Frontend:</span>
                    <a
                      href="https://github.com/goith99/secret-garden-web"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel text-[0.85em] text-garden-cyan underline-offset-4 transition hover:underline"
                    >
                      github.com/goith99/secret-garden-web
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- BOTTOM NAV ---------- */}
        <div className="flex flex-col items-center gap-4 border-t border-garden-moss/40 pt-10 sm:flex-row sm:justify-between">
          <Link
            to="/"
            className="font-pixel text-xs uppercase tracking-[0.16em] text-garden-parch/70 underline-offset-4 transition hover:text-garden-mint hover:underline"
          >
            ← Back to Secret Garden
          </Link>
          <Link
            to="/app"
            className="rounded-lg border border-garden-cyan bg-garden-cyan/20 px-7 py-3 font-pixel text-sm uppercase tracking-[0.18em] text-garden-cyan transition hover:-translate-y-0.5 hover:bg-garden-cyan/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan"
          >
            Play Now
          </Link>
        </div>
      </main>
    </div>
  );
}
