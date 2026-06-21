/** @type {import('tailwindcss').Config} */
export default {
  // Content scanning (PurgeCSS in Tailwind v3): the production build only emits classes
  // actually referenced in these files. Verified by the small CSS bundle in `vite build`.
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Locked palette: deep green, cream, cyan, lavender, gold — cozy botanical, not Web3.
        garden: {
          deep: "#13251a", // darkest backdrop
          green: "#1f3d2b",
          moss: "#2e5a3e",
          leaf: "#4f9266",
          mint: "#8fd6a6",
          cream: "#f5efda",
          parch: "#e7dcc0", // dimmer cream
          cyan: "#6cc7cf",
          lavender: "#c1aef0",
          gold: "#e6c25c",
          rose: "#e69ab0", // accent for failure/heat
        },
      },
      fontFamily: {
        // "pixel" is a lightweight monospace stack standing in for a real pixel-art webfont
        // (a heavy webfont is intentionally NOT loaded at this stage). PLACEHOLDER.
        pixel: ['"Courier New"', "ui-monospace", "Menlo", "Consolas", "monospace"],
        body: ['"Trebuchet MS"', "Verdana", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pot: "inset 0 6px 14px rgba(0,0,0,0.35), 0 4px 0 rgba(0,0,0,0.25)",
        panel: "0 2px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      keyframes: {
        sway: {
          "0%,100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        rise: {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        sway: "sway 3.5s ease-in-out infinite",
        rise: "rise 0.35s ease-out",
        pulseSoft: "pulseSoft 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
