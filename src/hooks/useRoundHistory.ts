/**
 * Reads finished-round results from Supabase for the Daily Winners panel. The operator script
 * writes these rows after a reveal (see secret-garden/scripts/operator.ts). Everything here is
 * READ-ONLY public data via the anon key.
 *
 * When Supabase is not configured (`supabase === null`) every function returns empty data and
 * never throws — the panel then shows its "winners will be revealed" fallback.
 */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
