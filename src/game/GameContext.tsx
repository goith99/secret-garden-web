/**
 * Single source of UI state for Stage 6A (React context + useState only — no external
 * store, per scope). Holds the two parent pots, mobile selection/tab, environment dials,
 * the mocked crossbreed phase machine, and the journal.
 *
 * IMPORTANT: the crossbreed phase transitions here are MOCKED for demonstration. Clicking
 * "Crossbreed" runs a timed walk through the approved player-facing labels
 * (Confirm in Wallet → Waiting in Greenhouse → Growing → Bloom Ready). There is no real
 * wallet, signing, or computation — that is Stage 6D. Clearly fake.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BreedPhase,
  type BreedPhaseKey,
  type Challenge,
  type DailyWinner,
  type Environment,
  type EnvironmentKind,
  type Flower,
  type JournalEntry,
  type MobileTab,
  type PotId,
  ExperimentStatus,
  FlowerStatus,
  GenomeStatus,
  RoundStatus,
} from "../types";
import { MOCK_FLOWERS, MOCK_JOURNAL, MOCK_CHALLENGE, MOCK_WINNERS } from "../mocks/data";
import { useGardenActions, TxError } from "../program/transactions";
import { useGardener } from "../wallet/useGardener";

const INSUFFICIENT_SOL_MSG =
  "Your garden needs a little more SOL to grow. Add funds and try again.";

const BLOOM_REFRESH_TOAST = "Your bloom is safe — tap to refresh your garden";

/** Build a mock offspring from two parents (standalone/demo mode — no chain). */
function makeMockNewborn(a: Flower, b: Flower, idx: number): Flower {
  return {
    id: `mock-flower-${idx}`,
    owner: a.owner,
    flowerIndex: idx,
    visualSpeciesId: 255,
    generation: Math.max(a.generation, b.generation) + 1,
    rarity: ((a.rarity + b.rarity) % 4) + 1,
    stability: 50,
    revealedTraitMask: 0,
    genomeStatus: GenomeStatus.Encrypted,
    status: FlowerStatus.Active,
    parentA: a.id,
    parentB: b.id,
    createdAt: Math.floor(Date.now() / 1000),
  };
}

/**
 * Real on-chain data injected by the connected app (Stage 6C). When omitted (e.g. tests),
 * the provider falls back to the Stage 6A mock data so it still works standalone.
 */
export interface GardenInitial {
  flowers: Flower[];
  journal: JournalEntry[];
  challenge: Challenge;
  winners: DailyWinner[];
  /** GameConfig.authority (program operator). Drives the hidden operator panel gate. */
  authority?: string | null;
  /** Breeding attempts used this round + the round they counted toward (from PlayerProfile). */
  breedsThisRound?: number;
  lastBreedRound?: number;
  /** True when the connected wallet's profile is pre-5D and must be migrated before breed/submit. */
  profileNeedsMigration?: boolean;
}

/** Per-round breeding cap enforced on-chain (MAX_BREEDS_PER_ROUND). */
export const MAX_BREEDS_PER_ROUND = 5;

interface GameContextValue {
  shelf: Flower[];
  potA: Flower | null;
  potB: Flower | null;
  selectedFlowerId: string | null;
  environment: Environment;
  phase: BreedPhaseKey;
  phaseLabel: string;
  bothPotsFilled: boolean;
  isCycling: boolean; // mid breeding cycle (Confirm..Growing) — button shows a spinner & disables
  /** The freshly-bloomed offspring shown inside the Hybrid Pot at BloomReady (null otherwise). */
  newBloom: Flower | null;
  /** True when a competition round is currently Open (drives the bloom's submit button). */
  roundOpen: boolean;
  /** How many crosses the player can still start this round (5 when standalone/no profile). */
  breedsRemaining: number;
  /** Player-vocabulary breeding problem (e.g. low SOL) shown under the crossbreed CTA. */
  breedError: string | null;
  journal: JournalEntry[];
  challenge: Challenge;
  winners: DailyWinner[];
  activeTab: MobileTab;
  /** Flower currently being submitted to the round (GO button) — spinner/disable, or null. */
  submittingId: string | null;
  /** Inline toast shown when the post-bloom refetch keeps failing (chain has the bloom). */
  bloomToast: string | null;
  /** GameConfig.authority (or null). The operator panel renders only when this === wallet. */
  authority: string | null;
  /** True when the player's profile must be migrated (one-time) before they can breed or submit. */
  profileNeedsMigration: boolean;
  /** True while the one-time migrate transaction is in flight (notice shows a spinner). */
  migrating: boolean;
  /** Player taps the "update your garden" notice → run the one-time migrate, then refresh. */
  migrateProfile: () => void;
  /** Reload on-chain garden data (operator panel uses it after each authority action). */
  refetchGarden: () => Promise<boolean>;

  setActiveTab: (t: MobileTab) => void;
  selectFlower: (id: string) => void;
  placeInPot: (pot: PotId, flower: Flower) => void;
  /** Mobile "tap a flower" → drop into the first empty pot. Returns the pot used, or null. */
  autoPlace: (flower: Flower) => PotId | null;
  clearPot: (pot: PotId) => void;
  setEnvironment: (kind: EnvironmentKind, optionIndex: number) => void;
  startCrossbreed: () => void;
  /** "SAVE TO COLLECTION" — keep the new bloom without entering it, then refresh the garden. */
  collectBloom: () => void;
  /** "SUBMIT TO CHALLENGE" — enter the new bloom in the open round, then save + refresh. */
  submitBloom: () => void;
  resetAfterFailure: () => void;
  /** Whether a flower may be entered into the active round right now (GO enabled). */
  canSubmit: (flower: Flower) => boolean;
  /** Submit a flower to the active round (GO). Optimistic, then refetch confirms. */
  submitFlower: (flower: Flower) => void;
  /** Retry the garden refresh from the bloom toast; clears the toast on success. */
  retryRefresh: () => void;
  /** DEV-only demo: jump to the "Bloom Failed" state to exercise that label. */
  simulateFailure: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// Phases the player drives explicitly / via the timed cycle. The two "resting" phases
// (NeedTwo / Ready) are DERIVED from the pots, never stored — so no state-syncing effect.
type ActivePhase = "Confirm" | "Waiting" | "Growing" | "BloomReady" | "Failed";

export function GameProvider({
  children,
  initial,
  onRefetch,
}: {
  children: ReactNode;
  initial?: GardenInitial;
  /**
   * Reload real on-chain data (Stage 6D). When provided, breeding/submit use the real path.
   * Resolves true on success / false on a failed fetch, so the post-bloom refresh can retry
   * quietly instead of surfacing the full-screen error.
   */
  onRefetch?: () => Promise<boolean>;
}) {
  const actions = useGardenActions();
  const { connected, address } = useGardener();
  // Guards setState in the async breeding/refetch flows from running after unmount (avoids
  // an unhandled-rejection / "set state on unmounted" race when polling + refetch overlap).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [shelf, setShelf] = useState<Flower[]>(initial?.flowers ?? MOCK_FLOWERS);
  const [potA, setPotA] = useState<Flower | null>(null);
  const [potB, setPotB] = useState<Flower | null>(null);
  const [selectedFlowerId, setSelectedFlowerId] = useState<string | null>(null);
  const [environment, setEnv] = useState<Environment>({ light: 1, water: 1, soil: 1 });
  const [activePhase, setActivePhase] = useState<ActivePhase | null>(null); // null = at rest
  const [breedError, setBreedError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [bloomToast, setBloomToast] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [newBloom, setNewBloom] = useState<Flower | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>(initial?.journal ?? MOCK_JOURNAL);
  const [activeTab, setActiveTab] = useState<MobileTab>("garden");

  // Real on-chain challenge/winners (read-only in 6C); fall back to mocks when standalone.
  const challenge = initial?.challenge ?? MOCK_CHALLENGE;
  const winners = initial?.winners ?? MOCK_WINNERS;
  const roundOpen = challenge.roundId > 0 && challenge.status === RoundStatus.Open;
  const authority = initial?.authority ?? null;

  // Breeds remaining this round. The on-chain counter is stale once the round advances:
  // it only applies when the player last bred in the CURRENT round; otherwise the cap is
  // full again. No profile (standalone/disconnected) → full cap, so the hint stays quiet.
  const breedsThisRound = initial?.breedsThisRound ?? 0;
  const lastBreedRound = initial?.lastBreedRound ?? 0;
  const breedsRemaining =
    lastBreedRound === challenge.roundId
      ? Math.max(0, MAX_BREEDS_PER_ROUND - breedsThisRound)
      : MAX_BREEDS_PER_ROUND;

  // A pre-5D profile must be migrated (one-time) before it can be written by breed/submit. We
  // never migrate silently — this drives the in-game notice and disables breed/submit until done.
  const profileNeedsMigration = initial?.profileNeedsMigration ?? false;
  const refetchGarden = useCallback(
    (): Promise<boolean> => (onRefetch ? onRefetch() : Promise.resolve(false)),
    [onRefetch],
  );

  // Adopt freshly-refetched chain data: useGardenData hands us new array identities only when
  // a reload actually produced new flowers/journal, so this re-syncs the shelf after a
  // claim / breeding / submit without clobbering the UI on every render.
  const realFlowers = initial?.flowers;
  const realJournal = initial?.journal;
  useEffect(() => {
    // External (chain) data flowing into local state — see useGardenData for the same pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (realFlowers) setShelf(realFlowers);
    if (realJournal) setJournal(realJournal);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [realFlowers, realJournal]);

  const timers = useRef<number[]>([]);
  const nextIndex = useRef<number>(10); // continues the mock flowerIndex sequence
  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]); // clear pending timers on unmount

  // Reset breeding state whenever the wallet changes or disconnects (and on first mount), so
  // every wallet session starts with a clean Hybrid Pot — never a stale "BLOOM FAILED" from a
  // previously rejected breed under a different wallet. Reacting to the wallet (an external
  // system), so the set-state-in-effect rule is scoped-disabled (same pattern as useGardenData).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setActivePhase(null); // breeding phase → idle (pot renders SEEDBED / AWAITING A CROSS)
    setPotA(null); // clear Parent A
    setPotB(null); // clear Parent B
    setNewBloom(null); // drop any finished/failed bloom
    setBreedError(null); // clear any pending breed error
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [address, connected]);

  const bothPotsFilled = potA !== null && potB !== null;
  // Derived phase: an active phase if one is running, else the resting phase from the pots.
  const phase: BreedPhaseKey = activePhase ?? (bothPotsFilled ? "Ready" : "NeedTwo");
  const isCycling = activePhase === "Confirm" || activePhase === "Waiting" || activePhase === "Growing";

  const selectFlower = useCallback((id: string) => {
    setSelectedFlowerId((cur) => (cur === id ? null : id));
  }, []);

  const placeInPot = useCallback((pot: PotId, flower: Flower) => {
    // A flower can't occupy both pots; if it's in the other pot, vacate that one.
    if (pot === "A") {
      setPotB((b) => (b?.id === flower.id ? null : b));
      setPotA(flower);
    } else {
      setPotA((a) => (a?.id === flower.id ? null : a));
      setPotB(flower);
    }
    setSelectedFlowerId(null);
  }, []);

  const autoPlace = useCallback(
    (flower: Flower): PotId | null => {
      if (potA === null || potA.id === flower.id) {
        placeInPot("A", flower);
        return "A";
      }
      if (potB === null || potB.id === flower.id) {
        placeInPot("B", flower);
        return "B";
      }
      // Both pots full: select so the player can tap a pot to swap.
      setSelectedFlowerId(flower.id);
      return null;
    },
    [potA, potB, placeInPot],
  );

  const clearPot = useCallback(
    (pot: PotId) => {
      // Don't yank a flower mid-cycle or while a bloom is waiting to be collected.
      if (activePhase && activePhase !== "Failed") return;
      if (pot === "A") setPotA(null);
      else setPotB(null);
    },
    [activePhase],
  );

  const setEnvironment = useCallback((kind: EnvironmentKind, optionIndex: number) => {
    setEnv((e) => ({ ...e, [kind]: optionIndex }));
  }, []);

  // Real breeding (Stage 6D): sign start_breeding → queue → poll the experiment account until
  // the MPC callback lands. Phases map to the approved player labels:
  //   Confirm  (Confirm in Wallet)  — awaiting wallet approval + tx confirmation
  //   Waiting  (Waiting in Greenhouse) — queued, polling the experiment every 5s (≤10 min)
  //   BloomReady — experiment Completed; collect refetches to reveal the hybrid
  //   Failed   (Bloom Failed. Try again.) — failed / timed out on-chain
  // When `onRefetch` is absent (standalone/demo with mocks) it walks a short timed cycle.
  const startCrossbreed = useCallback(() => {
    if (!bothPotsFilled || activePhase || !potA || !potB) return;
    // Real mode only: never build a breed tx when the per-round cap is spent OR the profile
    // still needs its one-time migration (the Hybrid Pot shows the matching message instead).
    if (onRefetch && (breedsRemaining <= 0 || profileNeedsMigration)) return;
    clearTimers();
    setBreedError(null);
    setNewBloom(null);

    if (!onRefetch) {
      // Standalone demo: keep the original mocked cycle so the UI still animates. The mock
      // offspring is built up front so it can be shown inside the pot at BloomReady.
      const newborn = makeMockNewborn(potA, potB, nextIndex.current++);
      setActivePhase("Confirm");
      timers.current.push(window.setTimeout(() => setActivePhase("Waiting"), 1100));
      timers.current.push(window.setTimeout(() => setActivePhase("Growing"), 2500));
      timers.current.push(
        window.setTimeout(() => {
          setNewBloom(newborn);
          setActivePhase("BloomReady");
        }, 4300),
      );
      return;
    }

    const parentA = potA;
    const parentB = potB;
    setActivePhase("Confirm");
    void (async () => {
      try {
        const { experiment, offspringIndex } = await actions.startBreeding({
          flowerAIndex: parentA.flowerIndex,
          flowerBIndex: parentB.flowerIndex,
          environment,
        });
        if (!mounted.current) return;
        setActivePhase("Waiting"); // tx confirmed; the MPC is now running
        const outcome = await actions.pollBreeding(experiment);
        if (!mounted.current) return;
        if (outcome === "completed") {
          // Read the offspring so it can be shown inside the pot. A read miss is non-fatal —
          // the pot falls back to a generic bloom and the flower still appears after refresh.
          const bloom = await actions.fetchFlower(offspringIndex).catch(() => null);
          if (!mounted.current) return;
          setNewBloom(bloom);
          setActivePhase("BloomReady");
        } else {
          setActivePhase("Failed");
        }
      } catch (e) {
        if (!mounted.current) return;
        if (e instanceof TxError && e.kind === "rejected") {
          setActivePhase(null); // wallet declined — silently return to Ready
        } else {
          if (e instanceof TxError && e.kind === "insufficient") {
            setBreedError(INSUFFICIENT_SOL_MSG);
          } else if (e instanceof TxError && e.kind === "network") {
            setBreedError(e.message);
          }
          setActivePhase("Failed");
        }
      }
    })();
  }, [bothPotsFilled, activePhase, potA, potB, environment, actions, onRefetch, clearTimers, breedsRemaining, profileNeedsMigration]);

  // Real mode: the hybrid is already on-chain. Reset to idle immediately so the player can
  // keep playing, then refetch to reveal it. A refetch failure NEVER tears down the game
  // (see App's error gate) — retry quietly up to 3x, then show a small inline toast.
  const resetAndRefetch = useCallback(() => {
    if (!onRefetch) return;
    setPotA(null);
    setPotB(null);
    setActivePhase(null);
    setNewBloom(null);
    setBreedError(null);
    setBloomToast(null);
    void (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        let ok = false;
        try {
          ok = await onRefetch();
        } catch {
          /* keep ok = false and retry */
        }
        if (!mounted.current) return;
        if (ok) return; // bloom is now on the shelf
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
      }
      if (mounted.current) setBloomToast(BLOOM_REFRESH_TOAST);
    })();
  }, [onRefetch]);

  // Standalone/demo collect: move the mock bloom onto the shelf (+ journal entry). When
  // `submitted` is set it lands already entered in the challenge.
  const mockCollect = useCallback(
    (submitted: boolean) => {
      if (!newBloom || !potA || !potB) return;
      const bloom = submitted ? { ...newBloom, status: FlowerStatus.Submitted } : newBloom;
      const entry: JournalEntry = {
        id: `exp-${bloom.flowerIndex}`,
        createdAt: bloom.createdAt,
        parentASpecies: potA.visualSpeciesId,
        parentBSpecies: potB.visualSpeciesId,
        status: ExperimentStatus.Completed,
        result: {
          species: bloom.visualSpeciesId,
          generation: bloom.generation,
          rarity: bloom.rarity,
        },
      };
      setShelf((s) => [bloom, ...s]);
      setJournal((j) => [entry, ...j]);
      setPotA(null);
      setPotB(null);
      setActivePhase(null);
      setNewBloom(null);
    },
    [newBloom, potA, potB],
  );

  // "SAVE TO COLLECTION" — keep the bloom without entering it.
  const collectBloom = useCallback(() => {
    if (activePhase !== "BloomReady") return;
    if (onRefetch) resetAndRefetch();
    else mockCollect(false);
  }, [activePhase, onRefetch, resetAndRefetch, mockCollect]);

  // "SUBMIT TO CHALLENGE" — enter the bloom in the open round, then save + refresh.
  const submitBloom = useCallback(() => {
    if (activePhase !== "BloomReady" || !newBloom) return;
    if (!onRefetch) {
      mockCollect(true);
      return;
    }
    const bloom = newBloom;
    setSubmittingId(bloom.id);
    void (async () => {
      try {
        await actions.submitEntry({ roundId: challenge.roundId, flowerRecord: bloom.id });
        if (!mounted.current) return;
        resetAndRefetch(); // entered on-chain; now save + refresh as usual
      } catch {
        // Wallet declined or tx failed: stay at BloomReady so the player can retry or save.
      } finally {
        if (mounted.current) setSubmittingId(null);
      }
    })();
  }, [activePhase, newBloom, onRefetch, actions, challenge.roundId, resetAndRefetch, mockCollect]);

  const resetAfterFailure = useCallback(() => {
    clearTimers();
    setActivePhase(null);
    setNewBloom(null);
    setBreedError(null);
  }, [clearTimers]);

  const simulateFailure = useCallback(() => {
    clearTimers();
    setActivePhase("Failed");
  }, [clearTimers]);

  // GO (submit_entry): only when a real round is Open, this flower is still Active, AND the
  // profile is current (a pre-5D profile must be migrated first — see migrateProfile).
  const canSubmit = useCallback(
    (flower: Flower): boolean =>
      !!onRefetch &&
      !profileNeedsMigration &&
      challenge.roundId > 0 &&
      challenge.status === RoundStatus.Open &&
      flower.status === FlowerStatus.Active &&
      submittingId === null,
    [onRefetch, profileNeedsMigration, challenge.roundId, challenge.status, submittingId],
  );

  const submitFlower = useCallback(
    (flower: Flower) => {
      if (!onRefetch || !canSubmit(flower)) return;
      setSubmittingId(flower.id);
      void (async () => {
        try {
          await actions.submitEntry({ roundId: challenge.roundId, flowerRecord: flower.id });
          // Optimistically reflect the submission, then refetch to confirm against chain.
          setShelf((s) =>
            s.map((f) =>
              f.id === flower.id ? { ...f, status: FlowerStatus.Submitted } : f,
            ),
          );
          void onRefetch();
        } catch {
          // Wallet declined or tx failed: leave the flower Active (no error surfaced here —
          // the GO button simply stays available for another try).
        } finally {
          if (mounted.current) setSubmittingId(null);
        }
      })();
    },
    [onRefetch, canSubmit, actions, challenge.roundId],
  );

  // Bloom toast tap: try the refresh again; clear the toast once the garden reloads.
  const retryRefresh = useCallback(() => {
    if (!onRefetch) return;
    void (async () => {
      let ok = false;
      try {
        ok = await onRefetch();
      } catch {
        /* leave ok = false; toast stays until a successful refresh */
      }
      if (mounted.current && ok) setBloomToast(null);
    })();
  }, [onRefetch]);

  // "Update your garden" notice tap → run the one-time migrate_profile, then refetch so the
  // profile reads as current and the notice clears + breed/submit re-enable. A rejected/failed
  // migrate leaves profileNeedsMigration true, so the notice stays and the player can retry.
  const migrateProfile = useCallback(() => {
    if (!onRefetch || migrating || !profileNeedsMigration) return;
    setMigrating(true);
    void (async () => {
      try {
        await actions.migrateProfile();
        if (!mounted.current) return;
        await onRefetch();
      } catch {
        /* declined or failed — notice stays visible so the player can try again later */
      } finally {
        if (mounted.current) setMigrating(false);
      }
    })();
  }, [onRefetch, migrating, profileNeedsMigration, actions]);

  const value = useMemo<GameContextValue>(
    () => ({
      shelf,
      potA,
      potB,
      selectedFlowerId,
      environment,
      phase,
      phaseLabel: BreedPhase[phase],
      bothPotsFilled,
      isCycling,
      newBloom,
      roundOpen,
      breedsRemaining,
      breedError,
      journal,
      challenge,
      winners,
      activeTab,
      submittingId,
      bloomToast,
      authority,
      profileNeedsMigration,
      migrating,
      migrateProfile,
      refetchGarden,
      setActiveTab,
      selectFlower,
      placeInPot,
      autoPlace,
      clearPot,
      setEnvironment,
      startCrossbreed,
      collectBloom,
      submitBloom,
      resetAfterFailure,
      canSubmit,
      submitFlower,
      retryRefresh,
      simulateFailure,
    }),
    [
      shelf, potA, potB, selectedFlowerId, environment, phase, bothPotsFilled, isCycling,
      newBloom, roundOpen, breedsRemaining, breedError, journal, challenge, winners, activeTab, submittingId,
      bloomToast, authority, profileNeedsMigration, migrating, migrateProfile, refetchGarden,
      selectFlower, placeInPot, autoPlace, clearPot,
      setEnvironment, startCrossbreed, collectBloom, submitBloom, resetAfterFailure, canSubmit,
      submitFlower, retryRefresh, simulateFailure,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within <GameProvider>");
  return ctx;
}
