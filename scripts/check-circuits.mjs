#!/usr/bin/env node
/**
 * Fails if this frontend's CIRCUITS map has drifted from the program's `comp_def_offset(..)`
 * strings. The union type in src/program/arcium.ts makes a stale name a compile error at the
 * CALL SITES; this closes the remaining hole — a stale union itself, which nothing else can
 * catch, because the IDL carries no circuit names and a superseded comp-def stays registered
 * on-chain forever (cluster 456 cannot close them), so no runtime probe can tell them apart.
 *
 *   node scripts/check-circuits.mjs [path-to-program-lib.rs]
 *
 * Defaults to the sibling checkout. Skips (exit 0) with a clear notice if that path is absent,
 * so the check is useful locally without becoming a hard CI dependency on a second repo.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LIB_RS =
  process.argv[2] ??
  resolve(here, "../../secret-garden/programs/secret-garden/src/lib.rs");
const ARCIUM_TS = resolve(here, "../src/program/arcium.ts");

if (!existsSync(LIB_RS)) {
  console.log(`check:circuits — SKIPPED, program source not found at\n  ${LIB_RS}`);
  console.log("  (pass the path explicitly to run it: node scripts/check-circuits.mjs <lib.rs>)");
  process.exit(0);
}

const rust = readFileSync(LIB_RS, "utf8");
const onChain = new Set([...rust.matchAll(/comp_def_offset\("([^"]+)"\)/g)].map((m) => m[1]));

const ts = readFileSync(ARCIUM_TS, "utf8");
const block = ts.match(/export const CIRCUITS = \{([\s\S]*?)\} as const;/);
if (!block) {
  console.error("check:circuits — FAILED: could not find the CIRCUITS block in arcium.ts");
  process.exit(1);
}
const used = new Set([...block[1].matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]));

const stale = [...used].filter((c) => !onChain.has(c));

console.log(`program comp_def_offset(..) : ${[...onChain].sort().join(", ")}`);
console.log(`frontend CIRCUITS           : ${[...used].sort().join(", ")}`);

if (stale.length) {
  console.error(
    `\ncheck:circuits — FAILED\n` +
      `  These names are in the frontend's CIRCUITS but NOT in the program:\n` +
      stale.map((c) => `    ${c}`).join("\n") +
      `\n  A circuit was renamed and the frontend was not updated. Every transaction that\n` +
      `  uses one of these will fail on-chain with ConstraintAddress (2012) on\n` +
      `  comp_def_account. Fix src/program/arcium.ts -> CIRCUITS.\n`,
  );
  process.exit(1);
}
console.log("\ncheck:circuits — OK, every frontend circuit name exists in the program.");
