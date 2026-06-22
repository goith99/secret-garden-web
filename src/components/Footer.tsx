/**
 * Minimal site footer — full width, below the main layout (NOT inside any column). One row
 * on desktop (copyright · "Powered by Arcium" · social links) that collapses to a centered
 * stack on mobile. It sits in normal flow as a shrink-0 row at the bottom of each layout's
 * flex column, so it pins to the bottom of the viewport without floating fixed. Icons are
 * inline SVG (no icon library) to keep the bundle lean.
 *
 * The `lg` breakpoint (1024px) matches the JS layout switch in App (mobile < 1024), so the
 * row/stack flip lines up exactly with which layout is mounted.
 */

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.62 8.21 11.18.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.71-4.04-1.59-4.04-1.59-.55-1.37-1.34-1.74-1.34-1.74-1.09-.74.08-.72.08-.72 1.21.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.84 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.21.96-.26 1.98-.39 3-.4 1.02.01 2.04.14 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.66 1.66.24 2.88.12 3.18.77.83 1.24 1.88 1.24 3.17 0 4.54-2.81 5.54-5.49 5.83.43.36.81 1.09.81 2.2 0 1.59-.01 2.87-.01 3.26 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-garden-moss/50 bg-black/20 px-6 py-3">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 text-xs text-garden-parch/50 lg:flex-row lg:justify-between">
        {/* Left — copyright */}
        <span>© 2026 Secret Garden Protocol</span>

        {/* Center — Powered by Arcium (purple accent on hover) */}
        <a
          href="https://arcium.com"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-garden-lavender"
        >
          Powered by Arcium
        </a>

        {/* Right — social links */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/goith99/secret-garden"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="transition-colors hover:text-garden-cyan"
          >
            <GitHubIcon />
          </a>
          <a
            href="https://x.com/0x_goith"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter) profile"
            className="transition-colors hover:text-garden-cyan"
          >
            <XIcon />
          </a>
        </div>
      </div>
    </footer>
  );
}
