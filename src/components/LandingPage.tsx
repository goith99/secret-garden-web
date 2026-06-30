import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NightGardenScene } from "./NightGardenScene";

/**
 * Public marketing page at "/". Same night-garden aesthetic as the game (shared NightGardenScene
 * backdrop + the garden palette/fonts from tailwind.config.js), but it carries NONE of the game's
 * wallet/provider machinery — it's a plain scrollable page whose only job is to explain the game
 * and route players into /app. Hero + "what is" + "how it works" stay in casual player language;
 * the Arcium/MPC detail lives only in the "Privacy under the hood" section, per spec.
 *
 * Polish pass: calm, slow CSS animations (see the `sg-*` rules in index.css) stand in for
 * screenshots, hero pollen particles drift in the background, and each section fades/slides in on
 * scroll via IntersectionObserver. Everything is CSS-driven and degrades gracefully under
 * prefers-reduced-motion (the global rule in index.css neutralises the keyframes; the reveal hook
 * shows content immediately).
 *
 * Responsive: a single centered column (max-w) that reads cleanly down to 375px — every grid
 * collapses to one column on small screens and type scales up at the `sm`/`md` breakpoints.
 */

const FEATURES = [
  {
    key: "breed",
    title: "Breed",
    body: "Cross your flowers to grow rare hybrids with hidden traits",
  },
  {
    key: "compete",
    title: "Compete",
    body: "Submit your best bloom to the daily challenge",
  },
  {
    key: "privacy",
    title: "Privacy",
    body: "Your strategy stays secret until winners are revealed",
  },
] as const;

const STEPS = [
  { n: 1, title: "Set up your garden", body: "Claim 6 starter flowers" },
  { n: 2, title: "Breed hybrids", body: "Cross two flowers, traits stay hidden" },
  {
    n: 3,
    title: "Enter the challenge",
    body: "Submit your best bloom, wait for reveal",
  },
];

const BUILT_WITH = ["Solana", "Arcium", "Anchor", "React", "Supabase"];

type RoadmapStatus = "NOW" | "NEXT" | "FUTURE";

const ROADMAP: { status: RoadmapStatus; title: string; body: string }[] = [
  {
    status: "NOW",
    title: "Devnet Greenhouse",
    body: "Breed, compete, and climb the daily challenge — fully live on Solana Devnet with real Arcium-powered privacy.",
  },
  {
    status: "NEXT",
    title: "Casual Mode",
    body: "Quick matches for players who just want to breed and chill — no deadline pressure, no challenge stakes, just pure crossbreeding fun.",
  },
  {
    status: "NEXT",
    title: "Achievements & Streaks",
    body: "Daily login rewards, breeding streaks, and collector badges for your rarest blooms.",
  },
  {
    status: "NEXT",
    title: "Seasonal Events",
    body: "Limited-time traits, special community challenges, and collaborative breeding events with the Arcium community.",
  },
  {
    status: "FUTURE",
    title: "Mainnet Garden",
    body: "Taking Secret Garden to Solana Mainnet, with real stakes and real rewards for the best gardeners.",
  },
  {
    status: "FUTURE",
    title: "Flower Marketplace",
    body: "Trade your rarest hybrids with other gardeners.",
  },
];

// NOW = solid/bright accent, NEXT = outlined, FUTURE = muted — progression reads at a glance.
const BADGE_STYLES: Record<RoadmapStatus, string> = {
  NOW: "border-garden-mint bg-garden-mint text-garden-deep",
  NEXT: "border-garden-cyan text-garden-cyan",
  FUTURE: "border-garden-moss/60 text-garden-parch/45",
};

// A few softly glowing pollen motes for the hero backdrop. Hand-tuned positions/speeds so the
// handful drift independently; kept to 7 to stay light on mobile.
const PARTICLES = [
  { left: "10%", size: 5, dur: 16, delay: 0 },
  { left: "23%", size: 3, dur: 22, delay: 4 },
  { left: "39%", size: 4, dur: 18, delay: 8 },
  { left: "55%", size: 6, dur: 21, delay: 2 },
  { left: "69%", size: 3, dur: 24, delay: 10 },
  { left: "82%", size: 4, dur: 17, delay: 6 },
  { left: "92%", size: 5, dur: 20, delay: 13 },
];

/** Small label above each section — keeps the botanical pixel-cap styling used across the game. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="gh-title mb-3 text-center text-[11px] text-garden-mint/90 sm:text-xs">
      {children}
    </p>
  );
}

/**
 * Fades + slides its children up the first time they scroll into view. Falls back to "visible
 * immediately" under prefers-reduced-motion or when IntersectionObserver is unavailable, so content
 * is never stuck hidden.
 */
function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out motion-reduce:transition-none ${
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Slowly breathing five-petal flower silhouette for the hero — replaces a static logo/screenshot. */
function HeroFlower() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="sg-breathe mb-5 h-16 w-16 drop-shadow-[0_0_14px_rgba(193,174,240,0.45)] sm:h-20 sm:w-20"
      role="img"
      aria-label="Secret Garden flower"
    >
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="50"
          cy="30"
          rx="11"
          ry="20"
          transform={`rotate(${angle} 50 50)`}
          fill="#c1aef0"
          opacity="0.85"
        />
      ))}
      <circle cx="50" cy="50" r="9" fill="#e6c25c" />
    </svg>
  );
}

/** Hero pollen layer — purely decorative, sits behind the hero content. */
function HeroParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="sg-pollen absolute bottom-0 rounded-full bg-garden-gold shadow-[0_0_6px_2px_rgba(230,194,92,0.35)]"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** The animated visual at the top of each feature card (in place of a static icon/screenshot). */
function FeatureVisual({ kind }: { kind: (typeof FEATURES)[number]["key"] }) {
  if (kind === "breed") {
    return (
      <div className="flex h-12 items-center justify-center gap-1.5" aria-hidden>
        <span className="sg-merge-left h-3.5 w-3.5 rounded-full bg-garden-mint shadow-[0_0_8px_rgba(143,214,166,0.6)]" />
        <span className="sg-merge-core h-2.5 w-2.5 rounded-full bg-garden-gold shadow-[0_0_8px_rgba(230,194,92,0.7)]" />
        <span className="sg-merge-right h-3.5 w-3.5 rounded-full bg-garden-lavender shadow-[0_0_8px_rgba(193,174,240,0.6)]" />
      </div>
    );
  }
  if (kind === "compete") {
    return (
      <div className="flex h-12 items-center justify-center" aria-hidden>
        <span className="sg-trophy-glow text-4xl">🏆</span>
      </div>
    );
  }
  return (
    <div className="flex h-12 items-center justify-center" aria-hidden>
      <span className="sg-shimmer inline-flex h-11 w-11 items-center justify-center rounded-lg border border-garden-cyan/40 bg-garden-deep/50 text-2xl">
        🔒
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  return (
    <span
      className={`w-fit rounded-full border px-3 py-1 font-pixel text-[10px] uppercase tracking-[0.18em] ${BADGE_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-garden-cream">
      {/* Fixed night-garden backdrop so it stays put (a free, CSS-only parallax) while the page
          scrolls past it. */}
      <div className="fixed inset-0 -z-10">
        <NightGardenScene />
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-5 py-14 sm:gap-28 sm:px-8 sm:py-20">
        {/* ---------- HERO ---------- */}
        <section className="relative flex flex-col items-center overflow-hidden text-center">
          <HeroParticles />
          <div className="relative z-10 flex flex-col items-center">
            <HeroFlower />
            <h1 className="font-pixel text-4xl font-bold uppercase leading-none tracking-[0.12em] text-garden-cream drop-shadow-[0_2px_0_rgba(0,0,0,0.4)] sm:text-6xl md:text-7xl">
              Secret Garden
            </h1>
            <p className="gh-title mt-4 text-[11px] text-garden-gold sm:mt-5 sm:text-sm">
              Cozy Crossbreeding Greenhouse
            </p>
            <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-garden-parch/90 sm:max-w-lg sm:text-base">
              Breed rare flowers, hide your strategy, win the challenge.
            </p>
            <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
              <Link
                to="/app"
                className="rounded-lg border border-garden-cyan bg-garden-cyan/20 px-8 py-3 font-pixel text-sm uppercase tracking-[0.18em] text-garden-cyan transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-garden-cyan/35 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-garden-cyan"
              >
                Play Now
              </Link>
              <Link
                to="/docs"
                className="font-pixel text-xs uppercase tracking-[0.18em] text-garden-parch/70 underline-offset-4 transition hover:text-garden-mint hover:underline"
              >
                View Docs
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- WHAT IS SECRET GARDEN? ---------- */}
        <Reveal>
          <section>
            <SectionLabel>What is Secret Garden?</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="gh-panel flex flex-col items-center gap-3 p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-garden-mint/70 hover:shadow-[0_0_20px_rgba(143,214,166,0.25)]"
                >
                  <FeatureVisual kind={f.key} />
                  <h3 className="font-pixel text-sm uppercase tracking-[0.14em] text-garden-mint">
                    {f.title}
                  </h3>
                  <p className="font-body text-sm leading-relaxed text-garden-parch/85">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ---------- HOW IT WORKS ---------- */}
        <Reveal>
          <section>
            <SectionLabel>How it works</SectionLabel>
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="gh-panel flex flex-col items-center gap-3 p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-garden-mint/70 hover:shadow-[0_0_20px_rgba(143,214,166,0.25)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-garden-gold/70 bg-garden-deep/70 font-pixel text-base text-garden-gold">
                    {s.n}
                  </span>
                  <h3 className="font-pixel text-[13px] uppercase tracking-[0.12em] text-garden-cream">
                    {s.title}
                  </h3>
                  <p className="font-body text-sm leading-relaxed text-garden-parch/85">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        {/* ---------- PRIVACY UNDER THE HOOD (developer / Arcium audience) ---------- */}
        <Reveal>
          <section className="gh-panel flex flex-col items-center gap-5 px-6 py-10 text-center sm:px-12">
            <span className="rounded-md border border-garden-lavender/60 bg-garden-lavender/10 px-3 py-1 font-pixel text-[11px] uppercase tracking-[0.22em] text-garden-lavender">
              Arcium
            </span>
            <h2 className="font-pixel text-lg uppercase tracking-[0.14em] text-garden-lavender sm:text-2xl">
              Powered by Arcium MPC
            </h2>
            <p className="max-w-2xl font-body text-sm leading-relaxed text-garden-parch/90 sm:text-base">
              Every flower&apos;s genome is encrypted and scored with Arcium multi-party
              computation. Trait data is split across an MPC network and the challenge scores are
              computed on the encrypted values directly — so no one ever sees your raw traits,
              not even the operator running the round. Your strategy stays sealed until the
              winners are revealed.
            </p>
            <a
              href="https://arcium.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-xs uppercase tracking-[0.16em] text-garden-cyan underline-offset-4 transition hover:underline"
            >
              Learn more at arcium.com
            </a>
          </section>
        </Reveal>

        {/* ---------- ROADMAP ---------- */}
        <Reveal>
          <section>
            <SectionLabel>Roadmap</SectionLabel>
            <p className="-mt-1 mb-6 text-center font-body text-sm text-garden-parch/75 sm:text-base">
              Where Secret Garden is headed
            </p>
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {ROADMAP.map((item) => (
                <li
                  key={item.title}
                  className="gh-panel flex flex-col gap-3 p-6 transition duration-300 hover:-translate-y-1 hover:border-garden-gold/60 hover:shadow-[0_0_18px_rgba(230,194,92,0.2)]"
                >
                  <StatusBadge status={item.status} />
                  <h3 className="font-pixel text-sm uppercase tracking-[0.1em] text-garden-cream">
                    {item.title}
                  </h3>
                  <p className="font-body text-sm leading-relaxed text-garden-parch/85">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        {/* ---------- BUILT WITH ---------- */}
        <Reveal>
          <section>
            <SectionLabel>Built with</SectionLabel>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {BUILT_WITH.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-garden-moss/70 bg-garden-green/50 px-4 py-1.5 font-pixel text-[11px] uppercase tracking-[0.16em] text-garden-parch shadow-panel"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>
        </Reveal>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-garden-moss/40 bg-garden-deep/50">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-5 py-6 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
          <p className="font-body text-xs text-garden-parch/70">
            © 2026 Secret Garden Protocol · Powered by Arcium
          </p>
          <nav className="flex items-center gap-5 font-pixel text-[11px] uppercase tracking-[0.14em] text-garden-parch/70">
            <a
              href="https://github.com/goith99/secret-garden"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-garden-mint"
            >
              GitHub
            </a>
            <a
              href="https://x.com/0x_goith"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-garden-mint"
            >
              Twitter
            </a>
            <Link to="/app" className="transition hover:text-garden-cyan">
              Live App
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
