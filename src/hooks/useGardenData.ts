/**
 * The single entry point UI uses for real on-chain data (Stage 6C, read-only). It fetches
 * GameConfig, PlayerProfile, the player's FlowerRecords and the active CompetitionRound,
 * maps them to the existing UI types, derives the Hybrid Journal from bred flowers, and
 * exposes loading / error / refetch. Re-runs automatically when the wallet address changes.
 *
 * New players (no PlayerProfile yet) are NOT an error: playerProfile is returned as null so
 * the UI can show the "claim your starters" empty state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "../program/client";
import {
  fetchActiveRound,
  fetchFlowerRecords,
  fetchGameConfig,
  fetchPlayerProfile,
  isHybrid,
  type GardenConfig,
  type GardenProfile,
} from "../program/accounts";
import { useGardener } from "../wallet/useGardener";
import {
  ExperimentStatus,
  RoundStatus,
  type Challenge,
  type Flower,
  type JournalEntry,
} from "../types";

export interface GardenData {
  gameConfig: GardenConfig | null;
  playerProfile: GardenProfile | null;
  flowers: Flower[];
  activeRound: Challenge | null;
  journal: JournalEntry[];
  loading: boolean;
  error: string | null;
  /** Reload on-chain data. Resolves true on success, false if the fetch failed. */
  refetch: () => Promise<boolean>;
}

/** Neutral challenge used when no round is currently open, so the greenhouse still renders. */
export const NO_ACTIVE_ROUND: Challenge = {
  roundId: 0,
  status: RoundStatus.Open,
  startTime: 0,
  endTime: 0,
  maxParticipants: 0,
  participantCount: 0,
  targetTraits: [],
  targetTraitCount: 0,
  scoringRevealed: false,
  scoredCount: 0,
};

type DataState = Omit<GardenData, "refetch">;

const EMPTY: DataState = {
  gameConfig: null,
  playerProfile: null,
  flowers: [],
  activeRound: null,
  journal: [],
  loading: true,
  error: null,
};

/** Build the Hybrid Journal from bred flowers, resolving each parent's species by PDA. */
function buildJournal(flowers: Flower[]): JournalEntry[] {
  const byId = new Map(flowers.map((f) => [f.id, f] as const));
  const speciesOfParent = (id: string | null): number =>
    id ? (byId.get(id)?.visualSpeciesId ?? 255) : 255;

  return flowers
    .filter(isHybrid)
    .map<JournalEntry>((f) => ({
      id: f.id,
      createdAt: f.createdAt,
      parentASpecies: speciesOfParent(f.parentA),
      parentBSpecies: speciesOfParent(f.parentB),
      status: ExperimentStatus.Completed, // the flower exists → its breeding completed
      result: {
        species: f.visualSpeciesId,
        generation: f.generation,
        rarity: f.rarity,
      },
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function useGardenData(): GardenData {
  const program = useProgram();
  const { address } = useGardener();
  const [state, setState] = useState<DataState>(EMPTY);
  // Monotonic request id guards against a slow fetch resolving after the wallet changed.
  const reqId = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    // No program yet: leave the initial loading state in place (no sync setState in the
    // effect — see the post-await setStates below).
    if (!program) return false;
    const my = ++reqId.current;

    // Disconnected visitor: load PUBLIC data only (config + active round) so the game stays
    // visible with real round info. No wallet → no profile/flowers/journal.
    if (!address) {
      try {
        const gameConfig = await fetchGameConfig(program);
        const activeRound = gameConfig
          ? await fetchActiveRound(program, gameConfig.currentRound)
          : null;
        if (my !== reqId.current) return false;
        setState({
          gameConfig,
          playerProfile: null,
          flowers: [],
          activeRound,
          journal: [],
          loading: false,
          error: null,
        });
        return true;
      } catch (e) {
        if (my !== reqId.current) return false;
        console.error("[garden] public data load failed:", e);
        setState((s) => ({ ...s, loading: false }));
        return false;
      }
    }

    try {
      const owner = new PublicKey(address);
      const gameConfig = await fetchGameConfig(program);
      const playerProfile = await fetchPlayerProfile(program, owner);
      if (my !== reqId.current) return false; // a newer load started

      if (!playerProfile) {
        // New player — not an error.
        setState({
          gameConfig,
          playerProfile: null,
          flowers: [],
          activeRound: null,
          journal: [],
          loading: false,
          error: null,
        });
        return true;
      }

      const flowers = await fetchFlowerRecords(
        program,
        owner,
        playerProfile.nextFlowerIndex,
      );
      const activeRound = gameConfig
        ? await fetchActiveRound(program, gameConfig.currentRound)
        : null;
      if (my !== reqId.current) return false;

      setState({
        gameConfig,
        playerProfile,
        flowers,
        activeRound,
        journal: buildJournal(flowers),
        loading: false,
        error: null,
      });
      return true;
    } catch (e) {
      if (my !== reqId.current) return false;
      console.error("[garden] data load failed:", e);
      // NOTE: `error` here only drives the full-screen "out of reach" state on the INITIAL
      // load (App gates it on a missing playerProfile). A failed BACKGROUND refetch (after a
      // transaction) keeps the last-known garden on screen; callers use the returned `false`
      // to retry quietly instead. Existing data is preserved below.
      setState((s) => ({
        ...s,
        loading: false,
        error: "We couldn't reach your garden. Check your connection and try again.",
      }));
      return false;
    }
  }, [program, address]);

  useEffect(() => {
    // load() performs awaited on-chain reads and only calls setState AFTER they resolve —
    // i.e. an async callback reacting to external (chain) state, which this rule explicitly
    // allows. The analyzer can't see across the await boundary, so it's scoped-disabled.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { ...state, refetch: load };
}
