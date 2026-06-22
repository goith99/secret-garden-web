import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
// nodePolyfills supplies the `Buffer`/`global`/`process` shims that @solana/web3.js, Anchor
// and @arcium-hq/client expect at runtime in the browser. Stage 6D adds Arcium, whose PDA
// derivation and RescueCipher paths use Buffer internally; only globals are polyfilled.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
})
