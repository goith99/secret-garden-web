# Secret Garden Protocol — Frontend

A cozy 2D pixel-art botanical greenhouse where you crossbreed flowers to win daily
challenges. This is the player-facing client for the Secret Garden Protocol Solana
program (a separate repo).

> **Stage 6A — static UI foundation, MOCK DATA ONLY.**
> No wallet connection, no RPC, no Anchor/web3.js. Every flower, challenge, journal entry
> and the crossbreed flow is mocked. Wiring to the chain comes in Stages 6B–6D.

## Run it

```bash
npm install
npm run dev      # → http://localhost:5173  (Vite prints the URL)
npm run build    # production build into dist/
npm run preview  # serve the production build
npm run lint     # eslint
```

## What works in this stage

- **Desktop** (≥768px): one screen, no page scroll — three columns: Flower Shelf (left,
  scrolls internally) · Greenhouse (center, focal) · Hybrid Journal + Daily Winners
  (right, scrolls internally).
- **Mobile** (<768px): a dedicated tabbed layout (Flowers · Garden · Journal), Garden
  default. Tapping a flower in **Flowers** auto-places it into an empty Parent Pot and
  jumps to **Garden**.
- **Place parents**: desktop = native HTML5 drag from the shelf into a Parent Pot;
  touch = tap-to-select then tap a pot (and the mobile auto-place above).
- **Light / Water / Soil** dials (three options each).
- **Crossbreed CTA** cycles through the *mocked* player-facing states on a timer:
  `Select Two Flowers → Crossbreed → Confirm in Wallet → Waiting in Greenhouse →
  Growing → Bloom Ready`. Collecting a Bloom adds a hybrid to the shelf + a journal entry.
  (A dev-only "demo: fail" affordance exercises `Bloom Failed. Try again.`)

## Architecture (built so the data SOURCE can be swapped without touching components)

```
src/
  types.ts                 # UI types mirroring the program IDL accounts (camelCase)
  mocks/
    data.ts                # the only mock-data module (replaced by a decode layer in 6C)
    presentation.ts        # numeric code → player label/colour (species, rarity, traits…)
  game/GameContext.tsx     # all UI state (pots, selection, tabs, mocked breed phases)
  hooks/useMediaQuery.ts
  components/              # FlowerSprite, FlowerCard, ParentPot, HybridPot, PlayerButton,
                          # CrossbreedButton, EnvironmentSelector, CurrentRequest,
                          # Greenhouse, FlowerShelf, JournalPanel, DailyWinners, Badge…
  layouts/                # DesktopLayout, MobileLayout, MobileTabBar
```

## Player vocabulary

The UI never shows developer terms (no MXE / MPC / PDA / ciphertext / callback / etc.).
Only approved labels are used (see `src/mocks/presentation.ts` and `BreedPhase` in
`src/types.ts`).

## Known limitations (intentional for Stage 6A)

- Flower sprites are pure-SVG placeholders (no real pixel-art assets exist yet).
- The crossbreed phase machine is mocked (timers), not real on-chain state.
- No persistence — refreshing resets to the mock data.
