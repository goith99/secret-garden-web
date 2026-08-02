/**
 * Interop shim for @arcium-hq/client >= 0.11 in a browser bundle.
 *
 * WHY THIS EXISTS
 * ---------------
 * @arcium-hq/client 0.14.1's ESM build opens with:
 *
 *     import anchor__default, { BorshCoder, ... } from '@anchor-lang/core';
 *     ...
 *     const { BN } = anchor__default;          // top level, runs at module init
 *
 * That default import is a CJS-interop artifact of Arcium's own rollup build: it works
 * against @anchor-lang/core's CJS entry (where interop synthesises a default), but the
 * package's BROWSER entry — dist/browser/index.js, the one a bundler picks — has only NAMED
 * exports and no default. Rolldown therefore fails the build with:
 *
 *     [MISSING_EXPORT] "default" is not exported by @anchor-lang/core/dist/browser/index.js
 *
 * Suppressing the error is NOT an option: `const { BN } = anchor__default` is at column 0, so
 * it destructures at import time and would throw "Cannot destructure property 'BN' of
 * undefined" the moment the module loads — a blank app rather than a failed build.
 *
 * WHAT IT DOES
 * ------------
 * Re-exports the browser build unchanged and adds the namespace as the default export, which
 * is exactly what the CJS interop would have produced. `BN` is a genuine named export of that
 * build (`export { default as BN } from 'bn.js'`), so Arcium's destructure resolves to the
 * same BN our own code imports — one BN class, no duplicate-instance hazards.
 *
 * Wired up as an EXACT-match alias in vite.config.ts (a regex, not a prefix string, so the
 * deep import below is not itself rewritten into an infinite loop).
 *
 * This is a bundler-only shim. TypeScript still resolves "@anchor-lang/core" to the real
 * package and its real types — the alias never affects typechecking. Kept as .js deliberately:
 * dist/browser/ ships no .d.ts, so a .ts shim would need a fake declaration for no benefit.
 *
 * REMOVE THIS when @arcium-hq/client ships a browser-safe build (no default import of
 * @anchor-lang/core), or when @anchor-lang/core's browser entry gains a default export.
 */
import * as anchorCore from "@anchor-lang/core/dist/browser/index.js";

export * from "@anchor-lang/core/dist/browser/index.js";
export default anchorCore;
