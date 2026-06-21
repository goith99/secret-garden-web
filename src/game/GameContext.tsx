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
  type Environment,
  type EnvironmentKind,
  type Flower,
  type JournalEntry,
  type MobileTab,
  type PotId,
  ExperimentStatus,
  FlowerStatus,
  GenomeStatus,
} from "../types";
import { MOCK_FLOWERS, MOCK_JOURNAL, MOCK_CHALLENGE, MOCK_WINNERS } from "../mocks/data";

interface GameContextValue {
  shelf: Flower[];
  potA: Flower | null;
  potB: Flower | null;
  selectedFlowerId: string | null;
  environment: Environment;
  phase: BreedPhaseKey;
  phaseLabel: string;
  bothPotsFilled: boolean;
  isCycling: boolean; // mid mocked-cycle (Confirm..Growing) — button shows a spinner & disables
  journal: JournalEntry[];
  challenge: typeof MOCK_CHALLENGE;
  winners: typeof MOCK_WINNERS;
  activeTab: MobileTab;

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
  /** DEV-only demo: jump to the "Bloom Failed" state to exercise that label. */
  simulateFailure: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// Phases the player drives explicitly / via the timed cycle. The two "resting" phases
// (NeedTwo / Ready) are DERIVED from the pots, never stored — so no state-syncing effect.
type ActivePhase = "Confirm" | "Waiting" | "Growing" | "BloomReady" | "Failed";

export function GameProvider({ children }: { children: ReactNode }) {
  const [shelf, setShelf] = useState<Flower[]>(MOCK_FLOWERS);
  const [potA, setPotA] = useState<Flower | null>(null);
  const [potB, setPotB] = useState<Flower | null>(null);
  const [selectedFlowerId, setSelectedFlowerId] = useState<string | null>(null);
  const [environment, setEnv] = useState<Environment>({ light: 1, water: 1, soil: 1 });
  const [activePhase, setActivePhase] = useState<ActivePhase | null>(null); // null = at rest
  const [journal, setJournal] = useState<JournalEntry[]>(MOCK_JOURNAL);
  const [activeTab, setActiveTab] = useState<MobileTab>("garden");

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

  // MOCKED timed cycle. Real flow (sign tx → queue → MPC → callback) is Stage 6D.
  const startCrossbreed = useCallback(() => {
    if (!bothPotsFilled || activePhase) return;
    clearTimers();
    setActivePhase("Confirm");
    timers.current.push(window.setTimeout(() => setActivePhase("Waiting"), 1100));
    timers.current.push(window.setTimeout(() => setActivePhase("Growing"), 2500));
    timers.current.push(window.setTimeout(() => setActivePhase("BloomReady"), 4300));
  }, [bothPotsFilled, activePhase, clearTimers]);

  const collectBloom = useCallback(() => {
    if (activePhase !== "BloomReady" || !potA || !potB) return;
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
  }, [activePhase, potA, potB]);

  const resetAfterFailure = useCallback(() => {
    clearTimers();
    setActivePhase(null);
  }, [clearTimers]);

  const simulateFailure = useCallback(() => {
    clearTimers();
    setActivePhase("Failed");
  }, [clearTimers]);

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
      journal,
      challenge: MOCK_CHALLENGE,
      winners: MOCK_WINNERS,
      activeTab,
      setActiveTab,
      selectFlower,
      placeInPot,
      autoPlace,
      clearPot,
      setEnvironment,
      startCrossbreed,
      collectBloom,
      resetAfterFailure,
      simulateFailure,
    }),
    [
      shelf, potA, potB, selectedFlowerId, environment, phase, bothPotsFilled, isCycling,
      journal, activeTab, selectFlower, placeInPot, autoPlace, clearPot, setEnvironment,
      startCrossbreed, collectBloom, resetAfterFailure, simulateFailure,
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
