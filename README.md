# Secret Garden Protocol — Frontend

A cozy botanical night garden where you crossbreed flowers to win daily challenges.
Built on Solana Devnet with Arcium MPC for private genome breeding.

🌸 **Live**: https://gardenprotocol.xyz
📦 **Program repo**: https://github.com/goith99/secret-garden

## What it does

- Connect Phantom or Solflare wallet (Solana Devnet)
- Drag two starter flowers into the breeding pots
- Crossbreed via Arcium MPC — your flower's genome stays encrypted and private
- Daily competition rounds with hidden scoring — no one knows your score until reveal
- Top 3 winners revealed by MPC at round end
- Daily Winners panel showing finished-round results (backed by Supabase)
- Breeds-remaining indicator that enforces the per-round breeding limit
- Profile migration notice that guides you through `migrate_profile` when the
  on-chain profile schema changes
- Toast notifications for transaction and breeding status
- Operator panel for round management (visible only to the operator wallet)

## Stack

- React + Vite + TypeScript + Tailwind CSS
- Solana wallet adapter (Phantom + Solflare)
- Anchor 1.0.2 client (@anchor-lang/core)
- Arcium MPC (@arcium-hq/client) for encrypted breeding
- Program ID: `7eMfGCkXavfZeVrwRo3ZH63C7H6mZ6n1HZKJwGkZBddo` (Solana Devnet)

## Run locally

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # production build
npm run lint     # eslint
```

## How to try it (Devnet)

1. Install [Phantom](https://phantom.app) or Solflare wallet
2. Switch wallet network to **Devnet**
3. Get free devnet SOL at [faucet.solana.com](https://faucet.solana.com)
4. Open https://secret-garden-web-app.vercel.app
5. Connect wallet → drag two flowers into the pots → crossbreed!

## Privacy design

Flower genomes are encrypted via Arcium MXE (`Enc<Mxe, Genome>`) — the browser
never sees the raw genome. Competition scores are computed privately by MPC and
revealed only at round end. Anti-manipulation is enforced at the type level:
score fabrication is cryptographically impossible.

## Known limitations (devnet alpha)

- Flower visuals are SVG placeholders — pixel art assets coming later
- Trait names #8 and #9 not yet named

## License

MIT © 2026 goith99
