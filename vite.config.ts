import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
// nodePolyfills supplies the `Buffer`/`global`/`process` shims that @solana/web3.js, Anchor
// and @arcium-hq/client expect at runtime in the browser. Stage 6D adds Arcium, whose PDA
// derivation and RescueCipher paths use Buffer internally; only globals are polyfilled.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  resolve: {
    // @arcium-hq/client 0.14.1 default-imports @anchor-lang/core, whose BROWSER entry exports
    // only named bindings — the build fails without a default. Route the bare specifier through
    // a shim that adds one. See src/shims/anchorCoreWithDefault.js for the full reasoning.
    //
    // The array + REGEX form matters: a plain string alias is a PREFIX match, which would also
    // rewrite the shim's own "@anchor-lang/core/dist/browser/index.js" import and recurse
    // forever. `/^@anchor-lang\/core$/` matches the bare specifier and nothing deeper.
    alias: [
      {
        find: /^@anchor-lang\/core$/,
        replacement: fileURLToPath(
          new URL('./src/shims/anchorCoreWithDefault.js', import.meta.url),
        ),
      },
    ],
  },
})
