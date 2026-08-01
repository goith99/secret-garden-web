/**
 * Last-resort catch for an unhandled render throw. Without this, any component that throws
 * while rendering unmounts the WHOLE React tree and the player is left staring at a blank
 * white page with no way back.
 *
 * Deliberately self-contained: the fallback below uses a plain <button> and literal Tailwind
 * classes rather than importing PlayerButton or the toast system. A fallback that can itself
 * throw is worse than no fallback at all — React gives up and blanks the page if an error
 * boundary's own render fails — so this file imports nothing from the app.
 *
 * Player vocabulary only. The real error and component stack go to the console for debugging;
 * a raw message or stack trace is never shown to the player.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  /** Render-phase: flip to the fallback. Must stay pure — logging happens in didCatch. */
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The only place the raw error surfaces. Keep it here, not in the UI.
    console.error("[garden] render crash:", error, info.componentStack);
  }

  /**
   * Clear the error AND reload. For an unknown render crash we can't know what state went bad,
   * so re-mounting the same tree would very likely throw straight back into the fallback; a
   * full reload rebuilds every provider (wallet, connection, toasts) from scratch. The
   * setState is what keeps the button honest if the reload is slow to take effect.
   */
  private handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-garden-deep px-4 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <span className="text-4xl" aria-hidden>
            🥀
          </span>
          <h1 className="font-pixel text-base uppercase tracking-[0.16em] text-garden-rose">
            Something went wrong in your garden.
          </h1>
          <p className="font-body text-sm leading-relaxed text-garden-parch/80">
            Nothing on-chain was lost — your flowers are safe. Give it another try.
          </p>
          <div className="w-44">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-garden-cyan
                bg-garden-cyan/15 px-4 py-3 font-pixel text-sm uppercase tracking-[0.12em] text-garden-cyan
                transition hover:bg-garden-cyan/25 focus:outline-none focus-visible:ring-2
                focus-visible:ring-garden-cyan"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }
}
