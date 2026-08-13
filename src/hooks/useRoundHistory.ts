/**
 * Finished-round results for the Daily Winners panel.
 *
 * READS use the anon key and are plain public data. The single WRITE (`saveRoundResults`) goes
 * through the set-round-results edge function: the browser holds no key that can write these
 * tables, and the function re-derives every stored value from the chain rather than trusting
 * anything sent to it. Previously only the operator CLI could publish results, which is why a
 * reveal driven from the Operator Panel left Daily Winners empty.
 *
 * When Supabase is not configured (`supabase === null`) every read returns empty data and
 * never throws — the panel then shows its "winners will be revealed" fallback.
 */
import { useEffect, useState } from "react";
import { invokeErrorMessage, supabase } from "../lib/supabase";

/** One winner row (round_winners table), mapped to camelCase for the UI. */
export interface RoundWinner {
  rank: number; // 1 | 2 | 3
  walletAddress: string;
  flowerName: string;
  generation: number;
}

/** A finished round's summary (round_results table), mapped to camelCase for the UI. */
export interface RoundResults {
  roundNumber: number;
  targetTraits: number[];
  totalEntrants: number;
  completedAt: string;
}

// Raw row shapes as stored in Supabase (snake_case columns the operator writes).
interface DbRoundWinner {
  rank: number;
  wallet_address: string;
  flower_name: string;
  generation: number;
}
interface DbRoundResults {
  round_number: number;
  target_traits: string; // JSON-encoded number[]
  total_entrants: number;
  completed_at: string;
}

/** Top-3 winners for a round, ordered by rank. Empty when unconfigured or none recorded yet. */
export async function fetchLatestWinners(roundNumber: number): Promise<RoundWinner[]> {
  if (!supabase || roundNumber <= 0) return [];
  const { data, error } = await supabase
    .from("round_winners")
    .select("rank, wallet_address, flower_name, generation")
    .eq("round_number", roundNumber)
    .order("rank", { ascending: true })
    .limit(3)
    .overrideTypes<DbRoundWinner[], { merge: false }>();
  if (error || !data) return [];
  return data.map((w) => ({
    rank: w.rank,
    walletAddress: w.wallet_address,
    flowerName: w.flower_name,
    generation: w.generation,
  }));
}

/**
 * The most recent completed round's Top 3 — i.e. the highest `round_number` that exists in
 * `round_winners`, regardless of which round is currently open. This is what Daily Winners shows:
 * even during a fresh, unrevealed round the previous round's results stay on screen. Returns a
 * `roundNumber` of 0 with empty winners when Supabase is unconfigured or no round has been saved.
 */
export async function fetchLatestRoundWinners(): Promise<{
  roundNumber: number;
  winners: RoundWinner[];
}> {
  if (!supabase) return { roundNumber: 0, winners: [] };
  const { data, error } = await supabase
    .from("round_winners")
    .select("round_number")
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<{ round_number: number }, { merge: false }>();
  if (error || !data) return { roundNumber: 0, winners: [] };
  const winners = await fetchLatestWinners(data.round_number);
  return { roundNumber: data.round_number, winners };
}

/** A round's stored summary (target traits, entrant count). Null when unconfigured or absent. */
export async function fetchRoundResults(roundNumber: number): Promise<RoundResults | null> {
  if (!supabase || roundNumber <= 0) return null;
  const { data, error } = await supabase
    .from("round_results")
    .select("round_number, target_traits, total_entrants, completed_at")
    .eq("round_number", roundNumber)
    .maybeSingle()
    .overrideTypes<DbRoundResults, { merge: false }>();
  if (error || !data) return null;
  let targetTraits: number[] = [];
  try {
    const parsed: unknown = JSON.parse(data.target_traits);
    if (Array.isArray(parsed)) targetTraits = parsed.filter((t): t is number => typeof t === "number");
  } catch {
    /* malformed JSON → no traits, not an error */
  }
  return {
    roundNumber: data.round_number,
    targetTraits,
    totalEntrants: data.total_entrants,
    completedAt: data.completed_at,
  };
}

/**
 * The exact string an operator wallet signs to publish a round's results.
 *
 * Deliberately covers ONLY the round number and a timestamp: unlike round metadata, none of the
 * stored values travel in the request at all, so there is nothing else to bind. The edge
 * function re-reads the winners from the chain, which is what makes a leaked operator key
 * unable to publish a false podium.
 *
 * MUST stay in lockstep with roundResultsMessage() in
 * supabase/functions/set-round-results/index.ts, which rebuilds this to verify the signature.
 */
export function roundResultsMessage(roundNumber: number, timestamp: number): string {
  return `secret-garden:set-round-results:${roundNumber}:${timestamp}`;
}

/** The connected wallet, narrowed to what publishing results needs (see useGardener). */
export interface RoundResultsSigner {
  address: string | null;
  /** Signs a UTF-8 message, resolving to a base64 signature. Null when unsupported. */
  signMessage: ((message: string) => Promise<string>) | null;
}

/** What the edge function reports back after a successful publish. */
export interface SavedRoundResults {
  roundNumber: number;
  totalEntrants: number;
  winners: RoundWinner[];
}

/**
 * Publishes a revealed round's results so the Daily Winners panel can show them.
 *
 * Idempotent by design: the function refuses (409) a round that is already published rather
 * than rewriting a podium, so calling this twice is safe and the second call is reported as
 * `alreadyPublished` instead of an error.
 *
 * Throws on any real failure. Callers should treat that as non-fatal — by the time this runs
 * the winners are already final ON-CHAIN, and the chain is authoritative; this table is a
 * convenience mirror that can always be re-published later.
 */
export async function saveRoundResults(
  roundNumber: number,
  signer: RoundResultsSigner,
): Promise<{ saved: SavedRoundResults | null; alreadyPublished: boolean }> {
  if (roundNumber <= 0) throw new Error("no round number to publish results for");
  if (!supabase) throw new Error("Supabase is not configured in this build.");
  if (!signer.address || !signer.signMessage) {
    throw new Error("This wallet cannot sign messages, so the write could not be authorised.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signer.signMessage(roundResultsMessage(roundNumber, timestamp));

  const { data, error } = await supabase.functions.invoke("set-round-results", {
    body: { round_number: roundNumber, timestamp, wallet: signer.address, signature },
  });

  if (error) {
    const message = await invokeErrorMessage(error);
    // Already published is a success for our purposes: the podium is on the board.
    if (/already published/i.test(message)) return { saved: null, alreadyPublished: true };
    throw new Error(message);
  }

  const body = data as {
    round_number: number;
    total_entrants: number;
    winners: { rank: number; wallet_address: string; flower_name: string; generation: number }[];
  };
  return {
    saved: {
      roundNumber: body.round_number,
      totalEntrants: body.total_entrants,
      winners: body.winners.map((w) => ({
        rank: w.rank,
        walletAddress: w.wallet_address,
        flowerName: w.flower_name,
        generation: w.generation,
      })),
    },
    alreadyPublished: false,
  };
}

/**
 * Live Daily-Winners data: the most recent completed round's Top 3. `refreshKey` is a value that
 * changes when the active round advances (pass `challenge.roundId`) so newly-revealed results get
 * picked up; the query itself always targets the highest round present, not the active one.
 *
 * Returns empty winners with `roundNumber: 0` when Supabase isn't configured or no reveal has been
 * saved yet. `loading` is true only while the initial/refetch request is in flight.
 */
export function useLatestWinners(refreshKey: number): {
  winners: RoundWinner[];
  roundNumber: number;
  loading: boolean;
} {
  const [winners, setWinners] = useState<RoundWinner[]>([]);
  const [roundNumber, setRoundNumber] = useState(0);
  const [loading, setLoading] = useState(supabase !== null);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchLatestRoundWinners().then((result) => {
      if (cancelled) return;
      setWinners(result.winners);
      setRoundNumber(result.roundNumber);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { winners, roundNumber, loading };
}
