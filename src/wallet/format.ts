/**
 * Player-facing address formatting. A wallet address is never shown raw or labelled with
 * developer terms — it appears as a shortened "gardener name" (e.g. "8L9S…bTd"). Keeping
 * this here (not in a component) means Stage 6C can reuse the exact same shortening for
 * on-chain owner labels without duplicating the rule.
 */

/** Shorten a base58 address to "first4…last3" using the codebase's ellipsis convention. */
export function shortGardener(address: string): string {
  if (address.length <= 9) return address;
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}
