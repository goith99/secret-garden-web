/**
 * Verifies the wallet-error classifier against the error SHAPES real wallets actually throw,
 * using the app's own `classifyError` (see scripts/ts-imports.mjs — this runs the same code the
 * browser runs, not a copy).
 *
 * The case that matters most is "solflare-object-rejection": wallet-adapter wraps every send
 * failure in WalletSendTransactionError, and Solflare's iframe/web adapters reject with the raw
 * payload the wallet posted — a plain object, not an Error. With `error?.message` undefined,
 * a user cancellation used to arrive with an empty message and an unreadable cause, get
 * classified "network", and trip the full-screen Switch-to-Devnet takeover.
 *
 *   node --import ./scripts/ts-imports.mjs scripts/verify-tx-errors.mjs
 */
import { WalletSendTransactionError, WalletSignTransactionError } from "@solana/wallet-adapter-base";
import { classifyError } from "../src/program/errors.ts";

/** Exactly how the standard wallet adapter re-wraps a failed send: `(error?.message, error)`. */
const wrapSend = (inner) => new WalletSendTransactionError(inner?.message, inner);

const CASES = [
  // ---- user rejection, in each shape a wallet delivers it -----------------------------
  ["solflare-object-rejection", wrapSend({ code: 4001, message: "User rejected the request." }), "rejected"],
  ["solflare-object-no-message", wrapSend({ code: 4001 }), "rejected"],
  ["solflare-opaque-object", wrapSend({}), "rejected"],
  ["solflare-string-rejection", wrapSend("Transaction cancelled"), "rejected"],
  ["phantom-error-rejection", wrapSend(new Error("User rejected the request.")), "rejected"],
  ["sign-path-decline", new WalletSignTransactionError("User rejected the request."), "rejected"],
  ["bare-4001-unwrapped", Object.assign(new Error(""), { code: 4001 }), "rejected"],

  // ---- genuine wrong network ----------------------------------------------------------
  // The adapter's pre-send chain check: `throw new WalletSendTransactionError()`, no arguments.
  ["adapter-chain-mismatch", new WalletSendTransactionError(), "network"],
  ["devnet-blockhash-on-mainnet", wrapSend(new Error("Blockhash not found")), "network"],
  ["program-missing-on-cluster", wrapSend(new Error("Attempt to load a program that does not exist")), "network"],

  // ---- other real failures, which must NOT read as a cancellation ---------------------
  ["insufficient-funds", wrapSend(new Error("Attempt to debit an account but found no record of a prior credit.")), "insufficient"],
  ["insufficient-on-cause-only", wrapSend({ message: "Transfer: insufficient lamports" }), "insufficient"],
  ["on-chain-program-error", wrapSend(new Error("custom program error: 0x1771")), "failed"],
  ["wallet-disconnected", wrapSend("Wallet disconnected"), "failed"],
];

let failures = 0;
for (const [label, error, expected] of CASES) {
  const actual = classifyError(error).kind;
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(28)} expected=${expected.padEnd(12)} actual=${actual}`);
}

console.log(`\n${CASES.length - failures}/${CASES.length} passed`);
process.exit(failures === 0 ? 0 : 1);
