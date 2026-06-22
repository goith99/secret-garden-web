/**
 * The greenhouse interior backdrop — pure CSS + inline SVG, no image assets, no canvas.
 * Painted strictly as decoration: the whole layer is `aria-hidden` and `pointer-events-none`
 * so it never intercepts drags meant for the planted starters or the pots floating above it.
 *
 * Layers, back to front:
 *   1. ambient sunlight — a warm radial glow from above (light through the glass roof)
 *   2. glass side walls  — semi-transparent teal panels with a mullioned window grid
 *   3. trailing vines    — a few static dark-green leaf sprigs in the corners (depth)
 *   4. tiled floor       — a subtle pixel checker in two stone-green tones along the bottom
 *   5. dust motes        — 4 tiny pollen specks drifting slowly upward (CSS keyframes)
 *
 * All motion is CSS-keyframe based and is neutralised by the global prefers-reduced-motion
 * rule in index.css.
 */

function GlassWall({ side }: { side: "left" | "right" }) {
  return (
    <div
      className={`absolute inset-y-0 w-10 md:w-14 xl:w-16 ${side === "left" ? "left-0" : "right-0"}`}
      style={{
        background:
          side === "left"
            ? "linear-gradient(90deg, rgba(46,90,62,0.55), rgba(108,199,207,0.05))"
            : "linear-gradient(270deg, rgba(46,90,62,0.55), rgba(108,199,207,0.05))",
        // mullioned panes: thin dark grid lines over the tinted glass
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(8,18,12,0.45) 0 2px, transparent 2px 52px)," +
          "repeating-linear-gradient(90deg, rgba(8,18,12,0.4) 0 2px, transparent 2px 44px)",
      }}
    />
  );
}

/** A small trailing vine with a few leaves; mirrored/positioned by the caller via className. */
function Vine({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 60 120"
      className={className}
      fill="none"
      stroke="#1c3a26"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M12 0 C 20 26 8 40 16 62 C 22 80 12 96 20 120" />
      {[14, 40, 66, 92].map((y, i) => (
        <g key={y} fill="#234a30" stroke="none">
          <ellipse
            cx={i % 2 === 0 ? 4 : 30}
            cy={y}
            rx="11"
            ry="5"
            transform={`rotate(${i % 2 === 0 ? -28 : 28} ${i % 2 === 0 ? 4 : 30} ${y})`}
          />
        </g>
      ))}
    </svg>
  );
}

const MOTES = [
  { left: "22%", bottom: "26%", size: 5, anim: "animate-driftA", delay: "0s" },
  { left: "47%", bottom: "20%", size: 4, anim: "animate-driftB", delay: "3s" },
  { left: "68%", bottom: "30%", size: 6, anim: "animate-driftC", delay: "1.5s" },
  { left: "82%", bottom: "22%", size: 4, anim: "animate-driftA", delay: "5s" },
];

export function GreenhouseScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 1 — ambient sunlight from the glass roof */}
      <div
        className="absolute inset-x-0 top-0 h-2/3"
        style={{
          background:
            "radial-gradient(70% 90% at 50% -15%, rgba(245,239,218,0.20), rgba(230,194,92,0.07) 42%, transparent 72%)",
        }}
      />

      {/* 2 — glass side walls */}
      <GlassWall side="left" />
      <GlassWall side="right" />

      {/* 3 — trailing vines for depth (top corners) */}
      <Vine className="absolute -left-1 top-0 h-28 w-12 opacity-70 md:h-36" />
      <Vine className="absolute -right-1 top-0 h-24 w-12 -scale-x-100 opacity-60 md:h-32" />

      {/* 4 — tiled stone floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/4"
        style={{
          backgroundColor: "#16301f",
          backgroundImage:
            "repeating-conic-gradient(#1d3c27 0% 25%, #16301f 0% 50%)," +
            "linear-gradient(180deg, rgba(245,239,218,0.06), transparent 30%)",
          backgroundSize: "44px 44px, 100% 100%",
        }}
      />
      {/* floor lip — a lighter edge where the floor meets the room */}
      <div className="absolute inset-x-0 bottom-1/4 h-px bg-garden-mint/25" />

      {/* 5 — drifting dust / pollen motes */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className={`absolute rounded-full bg-garden-cream ${m.anim}`}
          style={{
            left: m.left,
            bottom: m.bottom,
            width: m.size,
            height: m.size,
            animationDelay: m.delay,
            filter: "blur(0.4px)",
          }}
        />
      ))}
    </div>
  );
}
