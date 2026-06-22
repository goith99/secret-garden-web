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

const INSUFFICIENT_SOL_MSG =
  "Your garden needs a little more SOL to grow. Add funds and try again.";

/**
 * Real on-chain data injected by the connected app (Stage 6C). When omitted (e.g. tests),
 * the provider falls back to the Stage 6A mock data so it still works standalone.
 */
export interface GardenInitial {
  flowers: Flower[];
  journal: JournalEntry[];
  challenge: Challenge;
  winners: DailyWinner[];
}

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
  /** Player-vocabulary breeding problem (e.g. low SOL) shown under the crossbreed CTA. */
  breedError: string | null;
  journal: JournalEntry[];
  challenge: Challenge;
  winners: DailyWinner[];
  activeTab: MobileTab;
  /** Flower currently being submitted to the round (GO button) — spinner/disable, or null. */
  submittingId: string | null;

  setActiveTab: (t: MobileTab) => void;
  selectFlower: (id: string) => void;
  placeInPot: (pot: PotId, flower: Flower) => void;
  /** Mobile "tap a flower" → drop into the first empty pot. Returns the pot used, or null. */
  autoPlace: (flower: Flower) => PotId | null;
  clearPot: (pot: PotId) => void;
  setEnvironment: (kind: EnvironmentKind, optionIndex: number) => void;
  startCrossbreed: () => void;
  collectBloom: () => void;
  resetAfterFailure: () => void;
  /** Whether a flower may be entered into the active round right now (GO enabled). */
  canSubmit: (flower: Flower) => boolean;
  /** Submit a flower to the active round (GO). Optimistic, then refetch confirms. */
  submitFlower: (flower: Flower) => void;
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
  /** Reload real on-chain data (Stage 6D). When provided, breeding/submit use the real path. */
  onRefetch?: () => void;
}) {
  const actions = useGardenActions();
  const [shelf, setShelf] = useState<Flower[]>(initial?.flowers ?? MOCK_FLOWERS);
  const [potA, setPotA] = useState<Flower | null>(null);
  const [potB, setPotB] = useState<Flower | null>(null);
  const [selectedFlowerId, setSelectedFlowerId] = useState<string | null>(null);
  const [environment, setEnv] = useState<Environment>({ light: 1, water: 1, soil: 1 });
  const [activePhase, setActivePhase] = useState<ActivePhase | null>(null); // null = at rest
  const [breedError, setBreedError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>(initial?.journal ?? MOCK_JOURNAL);
  const [activeTab, setActiveTab] = useState<MobileTab>("garden");

  // Real on-chain challenge/winners (read-only in 6C); fall back to mocks when standalone.
  const challenge = initial?.challenge ?? MOCK_CHALLENGE;
  const winners = initial?.winners ?? MOCK_WINNERS;

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
    clearTimers();
    setBreedError(null);

    if (!onRefetch) {
      // Standalone demo: keep the original mocked cycle so the UI still animates.
      setActivePhase("Confirm");
      timers.current.push(window.setTimeout(() => setActivePhase("Waiting"), 1100));
      timers.current.push(window.setTimeout(() => setActivePhase("Growing"), 2500));
      timers.current.push(window.setTimeout(() => setActivePhase("BloomReady"), 4300));
      return;
    }

    const parentA = potA;
    const parentB = potB;
    setActivePhase("Confirm");
    void (async () => {
      try {
        const { experiment } = await actions.startBreeding({
          flowerAIndex: parentA.flowerIndex,
          flowerBIndex: parentB.flowerIndex,
          environment,
        });
        setActivePhase("Waiting"); // tx confirmed; the MPC is now running
        const outcome = await actions.pollBreeding(experiment);
        setActivePhase(outcome === "completed" ? "BloomReady" : "Failed");
      } catch (e) {
        if (e instanceof TxError && e.kind === "rejected") {
          setActivePhase(null); // wallet declined — silently return to Ready
        } else {
          if (e instanceof TxError && e.kind === "insufficient") {
            setBreedError(INSUFFICIENT_SOL_MSG);
          }
          setActivePhase("Failed");
        }
      }
    })();
  }, [bothPotsFilled, activePhase, potA, potB, environment, actions, onRefetch, clearTimers]);

  const collectBloom = useCallback(() => {
    if (activePhase !== "BloomReady" || !potA || !potB) return;
    // Real mode: the hybrid is already on-chain — refetch to load it, then reset the pots.
    if (onRefetch) {
      onRefetch();
      setPotA(null);
      setPotB(null);
      setActivePhase(null);
      setBreedError(null);
      return;
    }
    const generation = Math.max(potA.generation, potB.generation) + 1;
    const idx = nextIndex.current++;
    const rarity = ((potA.rarity + potB.rarity) % 4) + 1;
    const createdAt = Math.floor(Date.now() / 1000);
    const newborn: Flower = {
      id: `mock-flower-${idx}`,
      owner: potA.owner,
      flowerIndex: idx,
      visualSpeciesId: 255,
      generation,
      rarity,
      stability: 50,
      revealedTraitMask: 0,
      genomeStatus: GenomeStatus.Encrypted,
      status: FlowerStatus.Active,
      parentA: potA.id,
      parentB: potB.id,
      createdAt,
    };
    const entry: JournalEntry = {
      id: `exp-${idx}`,
      createdAt,
      parentASpecies: potA.visualSpeciesId,
      parentBSpecies: potB.visualSpeciesId,
      status: ExperimentStatus.Completed,
      result: { species: 255, generation, rarity },
    };
    setShelf((s) => [newborn, ...s]);
    setJournal((j) => [entry, ...j]);
    setPotA(null);
    setPotB(null);
    setActivePhase(null);
  }, [activePhase, potA, potB, onRefetch]);

  const resetAfterFailure = useCallback(() => {
    clearTimers();
    setActivePhase(null);
    setBreedError(null);
  }, [clearTimers]);

  const simulateFailure = useCallback(() => {
    clearTimers();
    setActivePhase("Failed");
  }, [clearTimers]);

  // GO (submit_entry): only when a real round is Open AND this flower is still Active.
  const canSubmit = useCallback(
    (flower: Flower): boolean =>
      !!onRefetch &&
      challenge.roundId > 0 &&
      challenge.status === RoundStatus.Open &&
      flower.status === FlowerStatus.Active &&
      submittingId === null,
    [onRefetch, challenge.roundId, challenge.status, submittingId],
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
          onRefetch();
        } catch {
          // Wallet declined or tx failed: leave the flower Active (no error surfaced here —
          // the GO button simply stays available for another try).
        } finally {
          setSubmittingId(null);
        }
      })();
    },
    [onRefetch, canSubmit, actions, challenge.roundId],
  );

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
      breedError,
      journal,
      challenge,
      winners,
      activeTab,
      submittingId,
      setActiveTab,
      selectFlower,
      placeInPot,
      autoPlace,
      clearPot,
      setEnvironment,
      startCrossbreed,
      collectBloom,
      resetAfterFailure,
      canSubmit,
      submitFlower,
      simulateFailure,
    }),
    [
      shelf, potA, potB, selectedFlowerId, environment, phase, bothPotsFilled, isCycling,
      breedError, journal, challenge, winners, activeTab, submittingId, selectFlower, placeInPot,
      autoPlace, clearPot, setEnvironment, startCrossbreed, collectBloom, resetAfterFailure,
      canSubmit, submitFlower, simulateFailure,
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
