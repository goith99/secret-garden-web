import { useGame } from "../game/GameContext";

/**
 * The Hybrid Pot — visual focal point of the greenhouse. It is purely a reflection of the
 * (mocked) crossbreed phase: empty seedbed → growing sprout → mystery bloom → wilt on
 * failure. No data of its own. Real offspring rendering arrives with real results (6D).
 */
export function HybridPot() {
  const { phase, isCycling } = useGame();

  const growing = isCycling;
  const bloomed = phase === "BloomReady";
  const failed = phase === "Failed";

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="gh-title text-[11px] text-garden-gold">Hybrid Pot</span>
      <div
        className={`relative flex h-32 w-32 items-end justify-center rounded-3xl border-2 transition md:h-40 md:w-40 xl:h-48 xl:w-48
          ${bloomed ? "border-garden-gold bg-garden-gold/10" : failed ? "border-garden-rose bg-garden-rose/10" : "border-garden-moss bg-garden-deep/50"}`}
      >
        {/* halo */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-3xl transition
            ${bloomed ? "shadow-[0_0_50px_rgba(230,194,92,0.5)]" : growing ? "shadow-[0_0_34px_rgba(108,199,207,0.35)]" : ""}`}
        />
        {/* pot vessel */}
        <div className="absolute bottom-2 h-12 w-24 rounded-b-3xl rounded-t-md bg-gradient-to-b from-garden-moss to-garden-green shadow-pot md:h-14 md:w-28 xl:w-32" />

        <div className="relative z-10 mb-5 flex flex-col items-center">
          {failed ? (
            <span className="text-4xl" aria-hidden>
              🥀
            </span>
          ) : bloomed ? (
            <span className="animate-rise text-5xl drop-shadow-[0_0_10px_rgba(230,194,92,0.7)]" aria-hidden>
              🌸
            </span>
          ) : growing ? (
            <div className="flex flex-col items-center">
              <span className="animate-pulseSoft text-3xl" aria-hidden>
                🌱
              </span>
              <span className="mt-2 h-1.5 w-1.5 animate-pulseSoft rounded-full bg-garden-cyan" />
            </div>
          ) : (
            <span className="font-pixel text-[10px] uppercase tracking-wide text-garden-parch/50">
              seedbed
            </span>
          )}
        </div>
      </div>
      <span
        className={`font-pixel text-[10px] uppercase tracking-wide
          ${bloomed ? "text-garden-gold" : failed ? "text-garden-rose" : "text-garden-cyan/80"}`}
      >
        {bloomed ? "A bloom appears…" : failed ? "It withered" : growing ? "Something stirs…" : "Awaiting a cross"}
      </span>
    </div>
  );
}
