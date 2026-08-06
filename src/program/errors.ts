/**
 * The one error type that crosses out of the program layer. Kept in its own module so both
 * transactions.ts and reveal.ts can throw it without importing each other.
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
