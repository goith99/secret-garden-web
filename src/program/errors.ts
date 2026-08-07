/**
 * The one error type that crosses out of the program layer, plus the classifier that produces
 * it. Kept in its own module so both transactions.ts and reveal.ts can throw it without
 * importing each other — and, because this module is pure (no React, no web3, no wallet
 * adapter), so `scripts/verify-tx-errors.mjs` can exercise the real classifier under plain Node.
 */
export type TxErrorKind = "rejected" | "insufficient" | "failed" | "network";

/** A transaction error already reduced to a player-facing category (never a raw RPC dump). */
export class TxError extends Error {
  readonly kind: TxErrorKind;
  constructor(kind: TxErrorKind, message: string) {
    super(message);
    this.name = "TxError";
    this.kind = kind;
  }
}


// ---- player-vocabulary error classification ------------------------------------------
/**
 * Every string a wallet error might hide its real reason in, lowercased and joined.
 *
 * Classifying on `e.message` alone misses the reason entirely for four real shapes:
 *
 *  - wallet-adapter wraps EVERY send failure in WalletSendTransactionError, but some wallets
 *    hand it an empty message and leave the real error on the wrapped `.error` cause;
 *  - that cause is not necessarily an Error. Solflare's iframe / web-provider adapters reject
 *    with the RAW payload the wallet posted back — a plain object (see @solflare-wallet/sdk
 *    `lib/esm/adapters/iframe.js`: `reject(data.error)`) or even a bare string. `String(obj)`
 *    is "[object Object]", so the reason has to be read field by field;
 *  - web3.js's SendTransactionError keeps the useful text in `transactionMessage` /
 *    `transactionLogs`, NOT in `message` (see its constructor: message is just
 *    "Simulation failed. \nMessage: …");
 *  - any of those can sit on the wrapper or on the cause.
 *
 * So collect from all of them. This is what lets an insufficient-funds failure be told apart
 * from a genuine chain mismatch when both arrive with an empty top-level message — and what
 * keeps an object-shaped user rejection from looking like "no information at all".
 */
function errorHaystack(e: unknown): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.length > 0) parts.push(v);
    else if (typeof v === "number") parts.push(String(v));
  };

  // Read whatever text ONE value carries, whichever shape it arrived in.
  const pushValue = (v: unknown) => {
    if (v == null) return;
    if (v instanceof Error) {
      push(v.message);
      return;
    }
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      push(o.message);
      push(o.reason);
      push(o.name);
      push(o.code);
      return;
    }
    push(typeof v === "string" ? v : String(v));
  };

  pushValue(e);
  // WalletError keeps the wrapped cause on `.error`.
  const cause = (e as { error?: unknown })?.error;
  pushValue(cause);

  // SendTransactionError fields, on the wrapper or on the cause.
  for (const src of [e, cause] as Array<
    { transactionMessage?: unknown; transactionLogs?: unknown } | null | undefined
  >) {
    push(src?.transactionMessage);
    if (Array.isArray(src?.transactionLogs)) push(src.transactionLogs.join("\n"));
  }

  return parts.join("\n").toLowerCase();
}

/**
 * The EIP-1193-style numeric reason code, from the wrapper OR the wrapped cause. Wallets put
 * `4001` ("user rejected the request") on the error they throw; wallet-adapter then re-wraps it,
 * leaving the code one level down where a top-level `e.code` read never sees it.
 */
function reasonCode(e: unknown): number | undefined {
  const own = (e as { code?: unknown })?.code;
  if (typeof own === "number") return own;
  const inner = (e as { error?: { code?: unknown } })?.error?.code;
  return typeof inner === "number" ? inner : undefined;
}

/**
 * Reduce ANY thrown wallet/RPC value to one of the four player-facing kinds. Used by every send
 * path; exported (rather than kept module-private in transactions.ts) so the verification script
 * can assert against the same function the browser runs. Components never call it — they see
 * `GardenActions` + `TxError`.
 */
export function classifyError(e: unknown): TxError {
  if (e instanceof TxError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : "";
  // Read the reason code from the wrapper AND the cause — wallets put 4001 on the inner error.
  const code = reasonCode(e);
  // The wrapped cause, if any. Its mere PRESENCE is what tells a real (but unreadable) send
  // failure apart from the adapter's argument-free chain-mismatch throw — see below.
  const cause = (e as { error?: unknown })?.error;
  // Match against the wrapper AND its cause, not just the top-level message.
  const lower = errorHaystack(e);
  // Prefer the top-level message for display/logging; fall back to the cause when it is empty
  // so an unwrapped-only reason is not reported as a blank error.
  const detail = msg || (e as { error?: { message?: string } })?.error?.message || "";

  // ORDER MATTERS, and the order is: bare-chain-mismatch -> insufficient -> network -> rejected.
  //
  // The rejection test is the broadest — it ends in a name-based "we could read nothing at all"
  // fallback, and wallet-adapter wraps EVERY send failure in WalletSendTransactionError. Run it
  // first and it swallows everything as "the user cancelled" — which it did, for both
  // wrong-network (fixed earlier) and insufficient-funds (fixed here). Anything that classifies
  // on message CONTENT has to be tested before it. Insufficient goes ahead of network because the empty-top-level-message
  // variant is otherwise indistinguishable from a chain mismatch until the cause is unwrapped.

  // The standard wallet adapter throws a BARE WalletSendTransactionError — no message, no
  // wrapped cause — from exactly one place: the pre-send check that the connected account
  // supports the chain the app asked for (@solana/wallet-standard-wallet-adapter-base,
  // adapter.ts, `if (!account.chains.includes(chain)) throw new WalletSendTransactionError()`).
  // That IS the wallet telling us it is not on devnet. Its message-carrying sibling wraps a
  // real underlying send error and is handled further down.
  // `cause == null` (not `!lower`) is the guard that matters. That throw passes NO arguments, so
  // the error has neither a message nor a cause; every other throw on the send path passes
  // `(error?.message, error)` and therefore always has a cause, even when both are unreadable.
  //
  // Testing `!lower` instead was the bug behind "cancelling in the wallet shows Switch to
  // Devnet": Solflare rejects with a plain object rather than an Error, `error?.message` is
  // undefined, and the old haystack could not read an object — so a user cancellation arrived
  // here with an empty message AND an empty haystack, was declared a chain mismatch, and tripped
  // reportWrongNetwork() into taking over the screen.
  if (name === "WalletSendTransactionError" && !msg && cause == null) {
    return new TxError("network", "Make sure your wallet is set to Devnet and try again.");
  }
  // Not enough SOL to pay fees / rent for the new accounts. MUST be tested before the
  // rejection branch below: that branch matches on the error NAME alone, and wallet-adapter
  // wraps every send failure in WalletSendTransactionError — so it used to swallow every
  // insufficient-funds failure as "the user cancelled", leaving this branch unreachable on
  // the player path. First-time setup needs ~0.0288 SOL (profile + six starter FlowerRecords),
  // so this is the single most likely genuine failure for a new wallet.
  if (
    lower.includes("insufficient") ||
    lower.includes("debit an account but found no record of a prior credit") ||
    lower.includes("attempt to debit")
  ) {
    return new TxError("insufficient", detail);
  }
  // Wrong network: a devnet tx submitted to another cluster (common with wallets the dApp
  // can't pin to devnet, e.g. Phantom) can't find the devnet blockhash or the program account.
  // Flag it so the network guard can take over the screen and prompt a switch to Devnet.
  if (
    lower.includes("blockhash not found") ||
    lower.includes("blockhashnotfound") ||
    lower.includes("program that does not exist") ||
    lower.includes("programaccountnotfound") ||
    lower.includes("invalid program for execution")
  ) {
    return new TxError("network", "Make sure your wallet is set to Devnet and try again.");
  }
  // Wallet popup closed / user declined — treat as a cancel (the caller shows a gentle
  // "cancelled" note and NOTHING blocking). Phantom reports "User rejected …"; Solflare
  // "Transaction cancelled", a bare 4001, or an object carrying either.
  if (
    code === 4001 ||
    // The sign-only path wraps in WalletSignTransactionError, and on that path a decline is
    // overwhelmingly what goes wrong.
    name.includes("WalletSignTransaction") ||
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("user cancel") ||
    lower.includes("rejected the request") ||
    lower.includes("declined") ||
    lower.includes("transaction cancelled") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    return new TxError("rejected", detail);
  }
  // A wrapped send failure that said NOTHING we can read (no message, no readable cause). We
  // cannot name a fault, and the far most common content-free wallet error is the player
  // dismissing the popup — so call it a cancel, which is quiet and non-blocking, rather than a
  // failure. Deliberately narrower than the old rule, which matched the WalletSendTransactionError
  // NAME alone: wallet-adapter wraps EVERY send failure in it, so a genuine, fully-described
  // on-chain failure was also being reported to the player as "you cancelled".
  if (name.includes("WalletSendTransaction") && !lower) {
    return new TxError("rejected", detail);
  }
  return new TxError("failed", detail);
}
