/**
 * Devnet RPC endpoints, in preference order, plus the probe used to pick one at startup.
 *
 * The app used to be pinned to the single public Solana node: if that endpoint was down or
 * rate-limiting, every read failed and the game showed "the garden is out of reach" with no
 * way through. This adds ONE verified fallback — deliberately not a load balancer.
 *
 * PUBLIC, KEYLESS ENDPOINTS ONLY. The Helius key is operator/server-side and must never enter
 * the browser bundle (see WalletProvider's header).
 *
 * Every candidate below was probed directly (2026-08-01) for: the devnet genesis hash, CORS
 * headers for a browser origin, and each RPC method this app actually calls. Endpoints that
 * looked plausible but FAILED that probe, so they are deliberately absent:
 *   - rpc.ankr.com/solana_devnet        → now requires an API key (-32000 Unauthorized)
 *   - solana-devnet.drpc.org            → Solana is paid-plan only (code 35)
 *   - endpoints.omniatech.io/…/devnet   → HTTP 521, down
 *   - solana-devnet.api.onfinality.io   → 429s getAccountInfo/getMultipleAccounts without a key
 *   - devnet.genesysgo.net, publicnode, extrnode, rpcpool → dead host or IP-blocked
 * Do not add an endpoint here without running the same probe against it.
 */

/**
 * Devnet's genesis hash. The probe compares against this so a fallback can NEVER silently
 * land the app on mainnet — a wrong-cluster connection would show an empty garden and, far
 * worse, build transactions against the wrong network.
 */
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export const DEVNET_ENDPOINTS: readonly string[] = [
  // Primary — the official public node. Full method support, generous limits, proper CORS.
  "https://api.devnet.solana.com",
  // Fallback — Tatum's public devnet gateway. Serves every read the PLAYER path needs
  // (getAccountInfo, getMultipleAccounts, getLatestBlockhash, getSignatureStatuses) and sends
  // CORS headers. Two known limits, accepted because this is only ever reached when the
  // primary is already failing: its free tier 429s under sustained use, and getProgramAccounts
  // is paid-only — which degrades ONLY the authority-gated operator panel
  // (useOperatorActions.fetchRoundEntries / queueRevealTop3), never a player's own garden.
  "https://solana-devnet.gateway.tatum.io",
];

/**
 * One JSON-RPC round trip asking the node which chain it is. Resolves true only for a node
 * that answers in time AND reports the devnet genesis hash. Any transport error, non-200,
 * JSON-RPC error or mismatched hash resolves false — never throws, so the caller can just
 * walk the list.
 */
export async function isHealthyDevnet(
  endpoint: string,
  timeoutMs = 4000,
): Promise<boolean> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }),
      signal: abort.signal,
    });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    const result = (body as { result?: unknown })?.result;
    return result === DEVNET_GENESIS_HASH;
  } catch {
    return false; // aborted, offline, CORS-blocked, or malformed response
  } finally {
    clearTimeout(timer);
  }
}

/**
 * First endpoint that passes the probe, tried IN ORDER so the primary always wins when it is
 * healthy. Returns null when every candidate fails — the caller then stays on the primary and
 * lets the existing "garden is out of reach" retry handle it, rather than parking the app on
 * an endpoint we know is broken.
 */
export async function pickDevnetEndpoint(
  endpoints: readonly string[] = DEVNET_ENDPOINTS,
  timeoutMs = 4000,
): Promise<string | null> {
  for (const endpoint of endpoints) {
    if (await isHealthyDevnet(endpoint, timeoutMs)) return endpoint;
  }
  return null;
}
