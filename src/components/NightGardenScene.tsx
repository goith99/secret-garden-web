/**
 * The night-garden backdrop — pure CSS + inline SVG, no image assets, no canvas. A calm,
 * magical outdoor garden after dark. The whole layer is `aria-hidden` and `pointer-events-none`
 * so it never intercepts drags meant for the planted starters or the pots floating above it.
 *
 * Layers, back to front:
 *   1. sky → ground gradient   — deep blue-green night fading into dark garden soil
 *   2. stars                   — a scattering of cream specks twinkling in the upper sky
 *   3. moon                    — a soft cream disc, top-right, with a faint warm halo
 *   4. side bushes             — very dark rounded shrub silhouettes for depth
 *   5. grass blades            — short dark-green blades along the very bottom edge
 *   6. ground fog              — a faint blurred teal strip hugging the ground
 *   7. fireflies               — a few glowing yellow-green motes wandering slowly
 *
 * All motion is CSS-keyframe based and is neutralised by the global prefers-reduced-motion
 * rule in index.css.
 */

const STARS = [
  { left: "8%", top: "10%", size: 2, dur: "3.2s", delay: "0s" },
  { left: "18%", top: "22%", size: 3, dur: "4.1s", delay: "1.1s" },
  { left: "27%", top: "8%", size: 2, dur: "2.8s", delay: "0.5s" },
  { left: "39%", top: "17%", size: 2, dur: "3.6s", delay: "1.8s" },
  { left: "52%", top: "11%", size: 3, dur: "4.4s", delay: "0.3s" },
  { left: "61%", top: "24%", size: 2, dur: "3.0s", delay: "2.2s" },
  { left: "73%", top: "9%", size: 2, dur: "3.9s", delay: "0.9s" },
  { left: "84%", top: "20%", size: 3, dur: "2.6s", delay: "1.4s" },
  { left: "91%", top: "13%", size: 2, dur: "4.2s", delay: "0.2s" },
  { left: "46%", top: "27%", size: 2, dur: "3.4s", delay: "2.6s" },
  { left: "14%", top: "31%", size: 2, dur: "3.7s", delay: "0.7s" },
];

const FIREFLIES = [
  { left: "24%", bottom: "30%", anim: "animate-firefly", delay: "0s" },
  { left: "58%", bottom: "24%", anim: "animate-fireflyB", delay: "2.5s" },
  { left: "78%", bottom: "33%", anim: "animate-firefly", delay: "4s" },
];

// Short grass blades scattered along the bottom edge (x within a 240-wide viewBox).
const BLADES = Array.from({ length: 26 }, (_, i) => {
  const x = 4 + i * 9.1;
  const h = 8 + ((i * 37) % 8); // 8..15 deterministic "random" heights
  const shade = ["#0d3318", "#0a2510", "#14401f"][i % 3];
  return { x, h, shade, w: 1.4 + (i % 3) * 0.3 };
});

function Bush({ side }: { side: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={`absolute bottom-0 h-16 w-24 md:h-20 md:w-32 ${side === "left" ? "-left-2" : "-right-2 -scale-x-100"}`}
      aria-hidden
    >
      <path
        d="M0 80 C 4 46 24 40 36 46 C 40 28 70 28 74 48 C 92 40 116 50 110 80 Z"
        fill="#08200f"
      />
      <path
        d="M12 80 C 16 58 36 54 46 60 C 56 52 78 56 80 66 C 96 60 108 66 104 80 Z"
        fill="#0a2912"
        opacity="0.85"
      />
    </svg>
  );
}

export function NightGardenScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 1 — sky fading down into dark garden ground */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #0a1628 0%, #0d2818 42%, #0d3318 66%, #0a2510 100%)",
        }}
      />

      {/* 2 — twinkling stars (upper sky only) */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="animate-twinkle absolute rounded-full bg-garden-cream"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDuration: s.dur,
            animationDelay: s.delay,
          }}
        />
      ))}

      {/* 3 — moon with a soft warm halo */}
      <div
        className="absolute right-6 top-4 h-9 w-9 rounded-full md:h-11 md:w-11"
        style={{
          background: "#f5f0e0",
          boxShadow:
            "0 0 22px 6px rgba(245,240,224,0.22), 0 0 60px 18px rgba(230,194,92,0.10)",
        }}
      />

      {/* 4 — side bush silhouettes */}
      <Bush side="left" />
      <Bush side="right" />

      {/* 6 — ground fog (under the blades; layered before grass so blades read in front) */}
      <div
        className="absolute inset-x-0 bottom-1 h-6 opacity-10 blur-md"
        style={{ background: "linear-gradient(180deg, transparent, #bfeef0 70%)" }}
      />

      {/* 5 — grass blades along the bottom */}
      <svg
        viewBox="0 0 240 16"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-4 w-full"
        aria-hidden
      >
        {BLADES.map((b, i) => (
          <line
            key={i}
            x1={b.x}
            y1="16"
            x2={b.x}
            y2={16 - b.h}
            stroke={b.shade}
            strokeWidth={b.w}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* 7 — fireflies drifting with a glowing pulse */}
      {FIREFLIES.map((f, i) => (
        <span
          key={i}
          className={`absolute h-[3px] w-[3px] rounded-full ${f.anim}`}
          style={{
            left: f.left,
            bottom: f.bottom,
            backgroundColor: "#e8f06a",
            boxShadow: "0 0 6px 2px rgba(216,232,90,0.7)",
            animationDelay: f.delay,
          }}
        />
      ))}
    </div>
  );
}
