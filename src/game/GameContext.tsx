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
// The one web3 type the context touches: close_flower identifies its target by account
// address, and a Flower's `id` IS that address (see accounts.ts mapFlower). Same narrow
// exception the hint flow makes in usePrivateHint.
import { PublicKey } from "@solana/web3.js";
import { MOCK_FLOWERS, MOCK_JOURNAL, MOCK_CHALLENGE, MOCK_WINNERS } from "../mocks/data";
import { useGardenActions, TxError } from "../program/transactions";
import { usePrivateHint, type HintNotice, type HintView } from "../hooks/usePrivateHint";
import { useGardener } from "../wallet/useGardener";
import { useToast } from "../components/Toast";

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
  /**
   * True when this wallet has already submitted an entry in the current round. On-chain a wallet
   * can hold at most one entry per round, so every flower's "Submit to Challenge" must disable
   * once this is true. Resets when a new round opens. See useGardenData.hasEnteredCurrentRound.
   */
  hasEnteredCurrentRound?: boolean;
  /**
   * The FlowerRecord id this wallet entered in the CURRENTLY OPEN round, or null. Scopes the
   * breeding lock to the live round — see useGardenData.currentRoundEntryFlowerId.
   */
  currentRoundEntryFlowerId?: string | null;
  /** True when the connected wallet's profile is pre-5D and must be migrated before breed/submit. */
  profileNeedsMigration?: boolean;
  /**
   * PlayerProfile.total_flowers — starters INCLUDED. The collection cap counts hybrids only,
   * so the UI subtracts STARTER_COUNT exactly as the program's check_collection_cap does.
   */
  totalFlowers?: number;
}

/** Per-round breeding cap enforced on-chain (MAX_BREEDS_PER_ROUND). */
export const MAX_BREEDS_PER_ROUND = 5;

/** Hybrid collection cap enforced on-chain (FLOWER_COLLECTION_CAP). Starters don't count. */
export const FLOWER_COLLECTION_CAP = 20;

/**
 * The permanent starter flowers every player claims once (STARTER_COUNT). They are never
 * deletable and never count toward the collection cap, so the live hybrid count is
 * `total_flowers - STARTER_COUNT` — the same subtraction the program performs. Deliberately
 * the constant, not GameConfig.starter_count: the on-chain cap check uses the constant too,
 * so mirroring it keeps the UI's count and the program's verdict from ever disagreeing.
 */
export const STARTER_COUNT = 6;

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
  /**
   * True when the player has already submitted an entry in the current round. While true, every
   * "Submit to Challenge" control is disabled (one entry per wallet per round on-chain).
   */
  hasEnteredCurrentRound: boolean;
  /**
   * True for the ONE flower this wallet has entered in the currently open round — the only
   * flower that is actually breed-locked right now. False for a flower entered in a PAST round:
   * that flower's `status` is still Submitted (nothing on-chain clears it), but the program
   * lets it breed, so the UI must not.
   */
  isEnteredInCurrentRound: (flower: Flower) => boolean;
  /** How many crosses the player can still start this round (5 when standalone/no profile). */
  breedsRemaining: number;
  // ---- hybrid collection cap (starters excluded, mirroring the on-chain accounting) ----
  /** Live hybrids the player holds — `total_flowers - STARTER_COUNT`, floored at 0. */
  hybridCount: number;
  /** The cap those hybrids are counted against (FLOWER_COLLECTION_CAP). */
  collectionCap: number;
  /** True once the collection is full: breeding is blocked until a flower is released. */
  collectionFull: boolean;
  /** The flower currently being released (spinner/disable on its card), or null. */
  releasingId: string | null;
  /** Whether this flower may be released right now (own, Active, sealed bloom — not a starter). */
  canRelease: (flower: Flower) => boolean;
  /** Release a hybrid, freeing a slot. Refetches so the card and the counter both update. */
  releaseFlower: (flower: Flower) => void;
  /** Transient "Release cancelled." note, scoped to the card that raised it. */
  releaseNotice: { flowerId: string; message: string } | null;
  /** Player-vocabulary breeding problem (e.g. low SOL) shown under the crossbreed CTA. */
  breedError: string | null;
  /** Transient "Breeding cancelled." note under the pot after a declined breed (auto-hides). */
  breedNotice: string | null;
  /** Transient pot-area note when an Entered (current-round) flower reaches a pot (auto-hides). */
  dropBlockedNotice: string | null;
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
  /** Notice message after a declined/failed update (cancelled / failed); null otherwise. */
  migrateError: string | null;
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
  /** "SAVE TO COLLECTION" — the only post-breed action; banks the bloom, then refreshes. */
  collectBloom: () => void;
  resetAfterFailure: () => void;
  /** Whether a flower may be entered into the active round right now (GO enabled). */
  canSubmit: (flower: Flower) => boolean;
  /** Submit a flower to the active round (GO). Optimistic, then refetch confirms. */
  submitFlower: (flower: Flower) => void;
  /** Retry the garden refresh from the bloom toast; clears the toast on success. */
  retryRefresh: () => void;
  // ---- "Check Match" (private hint) — one at a time, one HintResult account per wallet ----
  /** The hint being requested or shown, or null. Rendered ONLY on its own flower's card. */
  hint: HintView | null;
  /** True while a hint request is running (every other flower's button disables). */
  hintBusy: boolean;
  /** Transient "Check cancelled." note after a declined wallet prompt (scoped to its card). */
  hintNotice: HintNotice | null;
  /** Whether this flower can be checked right now (open round, own sealed bloom, idle). */
  canCheckMatch: (flower: Flower) => boolean;
  /** Ask which of the round's target traits this flower satisfies. */
  checkMatch: (flower: Flower) => void;
  /** Clear the hint result/error from the card. */
  dismissHint: () => void;
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
  const toast = useToast();
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
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [releaseNotice, setReleaseNotice] = useState<{ flowerId: string; message: string } | null>(
    null,
  );
  const [bloomToast, setBloomToast] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [breedNotice, setBreedNotice] = useState<string | null>(null);
  // Transient pot-area note shown if an Entered (this-round) flower somehow reaches a pot.
  const [dropBlockedNotice, setDropBlockedNotice] = useState<string | null>(null);
  const [newBloom, setNewBloom] = useState<Flower | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>(initial?.journal ?? MOCK_JOURNAL);
  const [activeTab, setActiveTab] = useState<MobileTab>("garden");

  // Real on-chain challenge/winners (read-only in 6C); fall back to mocks when standalone.
  const challenge = initial?.challenge ?? MOCK_CHALLENGE;
  const winners = initial?.winners ?? MOCK_WINNERS;
  const roundOpen = challenge.roundId > 0 && challenge.status === RoundStatus.Open;
  // One entry per wallet per round on-chain — once entered, every Submit control is disabled.
  const hasEnteredCurrentRound = initial?.hasEnteredCurrentRound ?? false;
  const currentRoundEntryFlowerId = initial?.currentRoundEntryFlowerId ?? null;
  const authority = initial?.authority ?? null;

  /**
   * The flower this session just entered, held only until the refetch reports it back as
   * `currentRoundEntryFlowerId`. Closes the window between "submit_entry confirmed" and "the
   * new entry has been read back", during which the breed lock would otherwise not yet apply.
   * Cleared on any round change so it can never outlive the round it belongs to.
   */
  const [justEnteredFlowerId, setJustEnteredFlowerId] = useState<string | null>(null);
  useEffect(() => {
    // Reacting to the round advancing (external state): a stale optimistic id must not leak
    // into the next round, where it would re-create the very "locked forever" bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJustEnteredFlowerId(null);
  }, [challenge.roundId]);

  /**
   * Is THIS flower the one entered in the currently open round?
   *
   * This replaces the old `flower.status === Submitted` test for every BREEDING decision. That
   * test was wrong because `status` is a one-way flag: submit_entry writes Submitted and no
   * instruction ever writes it back (close_round / finalize_round don't even take FlowerRecord
   * accounts), so it means "was entered in SOME round, ever" — it never expires. Combined with
   * `roundOpen`, which asks about the CURRENT round and knows nothing about the flower, a
   * flower entered once was re-locked the moment any later round opened, forever.
   *
   * The live round's CompetitionEntry is the authoritative answer: its PDA is seeded by
   * [round, player], so it exists only for the round it belongs to and names exactly one
   * flower. When the round advances, the new round's entry PDA doesn't exist yet, so this goes
   * false on its own — which is what the old code only ASSUMED the on-chain status would do.
   *
   * Standalone/demo mode has no entry to read, so it falls back to the flower's own status
   * (the mock cycle sets Submitted itself and there is only ever one round).
   */
  const isEnteredInCurrentRound = useCallback(
    (flower: Flower): boolean => {
      if (!roundOpen) return false; // nothing is entered in a round that isn't open
      if (!onRefetch) return flower.status === FlowerStatus.Submitted; // mock mode
      const entered = currentRoundEntryFlowerId ?? justEnteredFlowerId;
      return entered !== null && flower.id === entered;
    },
    [roundOpen, onRefetch, currentRoundEntryFlowerId, justEnteredFlowerId],
  );

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

  // Live hybrid count, derived the same way the program does it (total_flowers minus the
  // permanent starters). Standalone/demo has no profile → 0, so the cap UI stays quiet.
  const hybridCount = Math.max(0, (initial?.totalFlowers ?? STARTER_COUNT) - STARTER_COUNT);
  const collectionFull = hybridCount >= FLOWER_COLLECTION_CAP;
  const refetchGarden = useCallback(
    (): Promise<boolean> => (onRefetch ? onRefetch() : Promise.resolve(false)),
    [onRefetch],
  );

  // "Check Match" lives here rather than in the card because a wallet has exactly ONE
  // HintResult account on-chain: a single owner of that state keeps two cards from racing
  // for it. The sealing key stays inside the hook (a ref) and never reaches the UI.
  const {
    hint,
    busy: hintBusy,
    canCheckMatch,
    checkMatch,
    dismissHint,
    hintNotice,
  } = usePrivateHint(actions, challenge, address ?? null, !!onRefetch);

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

  // The "Breeding cancelled." note under the pot is transient — auto-hide it after 3s.
  useEffect(() => {
    if (!breedNotice) return;
    const t = window.setTimeout(() => setBreedNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [breedNotice]);

  // The "this flower is in the current challenge" note auto-hides after 2s.
  useEffect(() => {
    if (!dropBlockedNotice) return;
    const t = window.setTimeout(() => setDropBlockedNotice(null), 2000);
    return () => window.clearTimeout(t);
  }, [dropBlockedNotice]);

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
    setBreedNotice(null); // clear the transient "cancelled" note
    setDropBlockedNotice(null); // clear the transient "in the challenge" note
    setMigrateError(null); // clear any update-notice error
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [address, connected]);

  const bothPotsFilled = potA !== null && potB !== null;
  // Derived phase: an active phase if one is running, else the resting phase from the pots.
  const phase: BreedPhaseKey = activePhase ?? (bothPotsFilled ? "Ready" : "NeedTwo");
  const isCycling = activePhase === "Confirm" || activePhase === "Waiting" || activePhase === "Growing";

  const selectFlower = useCallback((id: string) => {
    setSelectedFlowerId((cur) => (cur === id ? null : id));
  }, []);

  const placeInPot = useCallback(
    (pot: PotId, flower: Flower) => {
      // The flower entered in the CURRENTLY OPEN round is held back from breeding: breeding
      // locks its parents mid-cross and the round still has to score it. Note this is a
      // deliberate UI choice, NOT a program constraint — StartBreeding only rejects
      // `status == LOCKED` (lib.rs:2290/2297), so the program would happily accept it.
      // A flower entered in a PAST round is NOT held back, even though its status is still
      // Submitted forever: that round is done with it. The card blocks drag/tap up front;
      // this guards any path that slips through (e.g. a stray drop).
      if (isEnteredInCurrentRound(flower)) {
        setDropBlockedNotice("This flower is in the current challenge");
        return;
      }
      // A flower can't occupy both pots; if it's in the other pot, vacate that one.
      if (pot === "A") {
        setPotB((b) => (b?.id === flower.id ? null : b));
        setPotA(flower);
      } else {
        setPotA((a) => (a?.id === flower.id ? null : a));
        setPotB(flower);
      }
      setSelectedFlowerId(null);
    },
    [isEnteredInCurrentRound],
  );

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
    // Real mode only: never build a breed tx when the per-round cap is spent, the collection
    // is full (the program would reject it with CollectionFull), OR the profile still needs
    // its one-time migration. The Hybrid Pot shows the matching message in each case.
    if (onRefetch && (breedsRemaining <= 0 || collectionFull || profileNeedsMigration)) return;
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
    setBreedNotice(null);
    setActivePhase("Confirm"); // "Waiting for approval…" until the wallet signs
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
          setBreedError(
            outcome === "timeout"
              ? "Bloom Failed. The garden timed out. Try again."
              : "Something went wrong during breeding. Try again.",
          );
          setActivePhase("Failed");
        }
      } catch (e) {
        if (!mounted.current) return;
        if (e instanceof TxError && e.kind === "rejected") {
          // Declined: empty both pots back to "Drop a flower" (a half-placed hybrid otherwise
          // lingers) and show a fading "Breeding cancelled." note.
          setActivePhase(null);
          setPotA(null);
          setPotB(null);
          setBreedNotice("Breeding cancelled.");
        } else {
          if (e instanceof TxError && e.kind === "insufficient") {
            setBreedError(INSUFFICIENT_SOL_MSG);
          } else if (e instanceof TxError && e.kind === "network") {
            setBreedError(e.message);
          } else {
            setBreedError("Something went wrong during breeding. Try again.");
          }
          setActivePhase("Failed");
        }
      }
    })();
  }, [bothPotsFilled, activePhase, potA, potB, environment, actions, onRefetch, clearTimers, breedsRemaining, collectionFull, profileNeedsMigration]);

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

  // Standalone/demo collect: move the mock bloom onto the shelf (+ journal entry). It always
  // lands Active — a saved bloom is entered in a challenge later, from its card.
  const mockCollect = useCallback(() => {
    const bloom = newBloom;
    if (!bloom || !potA || !potB) return;
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
  }, [newBloom, potA, potB]);

  // "SAVE TO COLLECTION" — the one and only thing a fresh bloom does.
  const collectBloom = useCallback(() => {
    if (activePhase !== "BloomReady") return;
    if (onRefetch) resetAndRefetch();
    else mockCollect();
  }, [activePhase, onRefetch, resetAndRefetch, mockCollect]);

  // NOTE: there is deliberately no "submit the bloom straight from the pot" action. A fresh
  // bloom is only ever saved; entering it in a round happens afterwards from its card on the
  // shelf, through `submitFlower` below — one submit path, not two.

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

  // GO (submit_entry): only when a real round is Open, this flower is still Active, the player
  // hasn't ALREADY entered this round (one entry per wallet per round — the program rejects a
  // second), AND the profile is current (a pre-5D profile must be migrated first).
  const canSubmit = useCallback(
    (flower: Flower): boolean =>
      !!onRefetch &&
      !profileNeedsMigration &&
      !hasEnteredCurrentRound &&
      challenge.roundId > 0 &&
      challenge.status === RoundStatus.Open &&
      flower.status === FlowerStatus.Active &&
      submittingId === null,
    [onRefetch, profileNeedsMigration, hasEnteredCurrentRound, challenge.roundId, challenge.status, submittingId],
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
          // ...and optimistically own the round's entry slot too, so the breed lock applies to
          // this flower IMMEDIATELY. `currentRoundEntryFlowerId` only arrives with the refetch
          // below, and the flower's own status can't stand in for it (it never expires — that
          // is the whole bug this predicate exists to avoid).
          setJustEnteredFlowerId(flower.id);
          void onRefetch();
        } catch (e) {
          // Leave the flower Active so the GO button stays available. A decline is not a failure
          // — say so calmly; only a real failure gets the warning toast.
          if (e instanceof TxError && e.kind === "rejected") {
            toast.info("Transaction cancelled.");
          } else {
            toast.error("Couldn't submit to challenge. Try again.");
          }
        } finally {
          if (mounted.current) setSubmittingId(null);
        }
      })();
    },
    [onRefetch, canSubmit, actions, challenge.roundId, toast],
  );

  // ---- release a hybrid (close_flower) --------------------------------------------------
  // The on-chain constraints are the real gate; these mirror them so the UI never offers a
  // button whose transaction is certain to be rejected:
  //   Active     — a flower mid-cross (Breeding) or entered in a challenge (Submitted) is
  //                refused with FlowerNotActive;
  //   Encrypted  — starters are permanent (StarterNotDeletable), and it is that permanence
  //                that keeps `total_flowers - STARTER_COUNT` an honest hybrid count.
  const canRelease = useCallback(
    (flower: Flower): boolean =>
      !!onRefetch &&
      releasingId === null &&
      flower.status === FlowerStatus.Active &&
      flower.genomeStatus === GenomeStatus.Encrypted,
    [onRefetch, releasingId],
  );

  const releaseFlower = useCallback(
    (flower: Flower) => {
      if (!onRefetch || !canRelease(flower)) return;
      setReleasingId(flower.id);
      setReleaseNotice(null);
      void (async () => {
        try {
          await actions.closeFlower(new PublicKey(flower.id));
          // Gone on-chain: drop it from the shelf immediately (and from either pot, so a
          // released flower can't sit in a pot that would now breed with a dead record),
          // then refetch so total_flowers — and the slot counter — come from chain.
          setShelf((s) => s.filter((f) => f.id !== flower.id));
          setPotA((a) => (a?.id === flower.id ? null : a));
          setPotB((b) => (b?.id === flower.id ? null : b));
          void onRefetch();
          if (mounted.current) toast.success("Flower released. Slot freed.");
        } catch (e) {
          if (!mounted.current) return;
          // Declined → the same transient, self-clearing note the other actions use.
          if (e instanceof TxError && e.kind === "rejected") {
            setReleaseNotice({ flowerId: flower.id, message: "Release cancelled." });
          } else {
            toast.error("Couldn't release this flower. Try again.");
          }
        } finally {
          if (mounted.current) setReleasingId(null);
        }
      })();
    },
    [onRefetch, canRelease, actions, toast],
  );

  // The "Release cancelled." note is transient, like the pot's "Breeding cancelled." note.
  useEffect(() => {
    if (!releaseNotice) return;
    const t = window.setTimeout(() => setReleaseNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [releaseNotice]);

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
    setMigrateError(null);
    void (async () => {
      try {
        await actions.migrateProfile();
        if (!mounted.current) return;
        await onRefetch(); // profile reads as current → notice clears, breed/submit re-enable
        if (mounted.current) toast.success("Your garden is up to date! 🌱");
      } catch (e) {
        // Notice stays visible (profileNeedsMigration is still true) with a fitting message.
        if (!mounted.current) return;
        setMigrateError(
          e instanceof TxError && e.kind === "rejected"
            ? "Update cancelled. Tap to try again."
            : "Update failed. Check your connection and try again.",
        );
      } finally {
        if (mounted.current) setMigrating(false);
      }
    })();
  }, [onRefetch, migrating, profileNeedsMigration, actions, toast]);

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
      hasEnteredCurrentRound,
      isEnteredInCurrentRound,
      breedsRemaining,
      breedError,
      breedNotice,
      dropBlockedNotice,
      journal,
      challenge,
      winners,
      activeTab,
      submittingId,
      bloomToast,
      authority,
      profileNeedsMigration,
      migrating,
      migrateError,
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
      resetAfterFailure,
      canSubmit,
      submitFlower,
      retryRefresh,
      simulateFailure,
      hint,
      hintBusy,
      hintNotice,
      canCheckMatch,
      checkMatch,
      dismissHint,
      hybridCount,
      collectionCap: FLOWER_COLLECTION_CAP,
      collectionFull,
      releasingId,
      canRelease,
      releaseFlower,
      releaseNotice,
    }),
    [
      hint, hintBusy, hintNotice, canCheckMatch, checkMatch, dismissHint,
      hybridCount, collectionFull, releasingId, canRelease, releaseFlower, releaseNotice,
      shelf, potA, potB, selectedFlowerId, environment, phase, bothPotsFilled, isCycling,
      newBloom, roundOpen, hasEnteredCurrentRound, isEnteredInCurrentRound, breedsRemaining, breedError, breedNotice, dropBlockedNotice, journal, challenge, winners, activeTab, submittingId,
      bloomToast, authority, profileNeedsMigration, migrating, migrateError, migrateProfile, refetchGarden,
      selectFlower, placeInPot, autoPlace, clearPot,
      setEnvironment, startCrossbreed, collectBloom, resetAfterFailure, canSubmit,
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
