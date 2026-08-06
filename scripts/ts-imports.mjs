/**
 * Lets plain `node` scripts import this app's `src/**.ts` modules directly, so a verification
 * script tests the SAME code the browser runs rather than a copy of it.
 *
 * Node already strips TypeScript types on its own; what it will not do is guess the two things
 * a bundler fills in, both of which this app's source relies on:
 *
 *   1. extensionless relative imports — `./errors` must resolve to `./errors.ts`;
 *   2. JSON imports without an import attribute — `import idl from "./idl/x.json"` needs
 *      `with { type: "json" }` under Node's rules, and the app does not write one.
 *
 * Load it before the script: `node --import ./scripts/ts-imports.mjs scripts/whatever.mjs`
 * (it must be a separate file — static imports are resolved before a script's own code runs).
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SHIM = new URL("../src/shims/anchorCoreWithDefault.js", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    // The SAME alias vite.config.ts applies, to the same shim, for the same reasons: the CJS
    // entry does not expose `BN` as a named ESM export (so `import { BN }` fails under Node's
    // interop), while the browser entry that does has no default export (which @arcium-hq/
    // client's ESM build requires). Exact match only, or the shim's own deep import into the
    // browser build would be rewritten back onto itself. See src/shims/anchorCoreWithDefault.js.
    if (specifier === "@anchor-lang/core") {
      return nextResolve(SHIM, context);
    }
    // JSON needs an explicit import attribute in Node; the app's bundler does not. The
    // attribute has to be attached to the RESULT — passing it in the context is ignored.
    if (specifier.endsWith(".json")) {
      return { ...nextResolve(specifier, context), importAttributes: { type: "json" } };
    }
    // `./errors` -> `./errors.ts`, when that file exists.
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z]+$/i.test(specifier)) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
