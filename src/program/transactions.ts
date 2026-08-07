/**
 * Stage 6D — the ONLY place real on-chain transactions are built and sent. Components never
 * import web3/anchor/arcium; they call the `useGardenActions()` hook, which exposes exactly
 * the player-scope instructions:
 *
 *   claim_starters     — a new player claims their 6 starter flowers (one-time).
 *   start_breeding     — queue an MPC breeding of two owned parents under chosen environment.
 *   submit_entry       — submit one Active flower to the Open competition round.
 *   queue_private_hint — ask which of the round's target traits one OWN flower satisfies.
 *   close_flower       — release one own Active hybrid, freeing a collection slot.
 *
 * Operator/authority instructions (open_round, queue_score_entry, the bracket reveal, cancel*)
 * are deliberately NOT exposed here — see useOperatorActions at the bottom of this file.
 *
 * SENDING: every tx goes through the wallet adapter's `sendTransaction` (sign-AND-send), so
 * the wallet keeps the network it was connected on (devnet). We never call signTransaction
 * alone — Solflare infers mainnet from a sign-only path. Confirmation is polled over HTTP
 * (getSignatureStatuses), matching the proven devnet pattern in tests/breeding.devnet.ts.
 *
 * ENCRYPTION NOTE (start_breeding): the IDL requires the environment to arrive ENCRYPTED —
 * env_pubkey + env_nonce + three 32-byte ciphertexts (light/water/soil). So the client must
 * perform the x25519 key-exchange + RescueCipher encryption against the live MXE public key,
 * exactly as tests/breeding.devnet.ts does. (This is the proven working path; the plaintext
 * route is not expressible against this IDL.) The UI selector indices (0..2) are mapped through
 * `DIAL_TO_BIAS` onto the 0..=255 bias scale the circuit expects BEFORE encryption — sending the
 * raw indices made the dials inert (see the comment at the encryption site).
 *
 * KEY LIFETIME (private_hint): breeding and hinting use the same x25519 + RescueCipher
 * primitives but with opposite key lifetimes. A breed result is PUBLIC, so its ephemeral key
 * is discarded as soon as the tx is built. A hint result is sealed BACK to the requester, so
 * its ephemeral private key is returned to the caller and must stay in memory (never storage,
 * never a server) until the result is fetched and decrypted — it is the only thing that can
 * open it. See queuePrivateHint / decryptHint below.
 */
import { useCallback, useMemo } from "react";
import { BN } from "@anchor-lang/core";
import type { AnchorProvider } from "@anchor-lang/core";
import { PublicKey, type Connection, type Transaction } from "@solana/web3.js";
import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  RescueCipher,
  x25519,
  deserializeLE,
  getMXEPublicKey,
} from "@arcium-hq/client";
import { useProgram, type SecretGardenProgram } from "./client";
import { arciumAccountsFor } from "./arcium";
import {
  inspectReveal,
  runBracketReveal,
  type ProgressFn,
  type RevealStatus,
} from "./reveal";
import { useNetworkGuard } from "../wallet/useNetworkGuard";
import {
  PROGRAM_ID,
  configPda,
  profilePda,
  flowerPda,
  roundPda,
  experimentPda,
  entryPda,
  hintPda,
  fetchFlower,
} from "./accounts";
import type { Environment, Flower } from "../types";
import { TxError, classifyError, type TxErrorKind } from "./errors";

// Re-exported so the many components that already import TxError from this module keep
// working; the class itself moved to ./errors so reveal.ts can throw it without a cycle.
export { TxError };
export type { TxErrorKind };

/**
 * Environment dial position (0..2, the index into the UI option list) -> the 0..=255 bias scale
 * the `breed` circuit expects. 128 is the circuit's documented neutral (it hard-codes 128 for
 * genes with no environmental affinity), so the middle dial position is exactly neutral and the
 * outer positions swing the full documented range: `bias / 4` yields +0 / +32 / +63.
 */
const DIAL_TO_BIAS = [0, 128, 255] as const;

const EXPERIMENT_STATUS_QUEUED = 0;
const EXPERIMENT_STATUS_COMPLETED = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- starter-claim funding pre-flight -------------------------------------------------
//
// First-time setup is TWO signed transactions that between them rent-exempt SEVEN accounts:
// one PlayerProfile (create_profile) and six FlowerRecords (claim_starters). A wallet that
// cannot cover all of it used to find out only AFTER signing — commonly after signing the
// FIRST transaction, which left the profile created and the starters unclaimed, i.e. exactly
// the half-set-up state the claim screen has to recover from. Devnet faucet grants are
// routinely smaller than the total, so this is not a rare edge.

/** Where players are told to top up. Same faucet the docs page and README already name. */
export const DEVNET_FAUCET_URL = "https://faucet.solana.com";

/** Base fee per signature, in lamports. Measured against devnet (getFeeForMessage) — the
 *  app sets no compute-unit price, so there is no priority fee on top. */
const LAMPORTS_PER_SIGNATURE = 5_000;

/** FlowerRecords `claim_starters` rent-exempts. Fixed by the instruction itself, which takes
 *  exactly six flower accounts (flower0..flower5) — not read from GameConfig.starter_count. */
const STARTER_FLOWER_COUNT = 6;

/**
 * Head-room added to the computed minimum, in lamports (0.002 SOL).
 *
 * The rent figures are exact and the base fee is fixed, so this is NOT covering the arithmetic
 * — it is covering the gap between "can pay" and "can pay and still act". Without it a wallet
 * funded to the exact lamport would pass the check, complete setup, and land on a balance of
 * zero, unable to afford the very next signature (a breed, a submit) and with no rent left to
 * reclaim. It also absorbs a fee-schedule change between this check and the second signature.
 */
const FUNDING_MARGIN_LAMPORTS = 2_000_000;

/** What first-time setup costs, and whether the connected wallet can cover it. */
export interface StarterFunds {
  /** Rent + fees + margin, in lamports — the number the player must have. */
  requiredLamports: number;
  /** The wallet's balance at the moment of the check. */
  balanceLamports: number;
  /** False when the wallet cannot cover `requiredLamports`. */
  sufficient: boolean;
  /** True when the profile already exists, so only claim_starters is left to pay for. */
  claimOnly: boolean;
}

const solStr = (lamports: number): string =>
  (lamports / 1_000_000_000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");

/** The player-facing sentence for a wallet that cannot cover setup. Exact amounts, both sides. */
export function insufficientStarterFundsMessage(funds: StarterFunds): string {
  return (
    `You need at least ${solStr(funds.requiredLamports)} SOL to start your garden — ` +
    `you currently have ${solStr(funds.balanceLamports)} SOL. ` +
    `Get free devnet SOL from ${DEVNET_FAUCET_URL.replace("https://", "")} and try again.`
  );
}

/**
 * Rent-exemption minimum for one account of each kind, memoised for the lifetime of the tab.
 * Sizes come from the IDL (`program.account.X.size`, verified equal to the live on-chain
 * lengths: PlayerProfile 73 B, FlowerRecord 528 B) rather than being hard-coded, so a layout
 * change flows through without anyone remembering to update a constant here.
 */
let rentCache: { profile: number; flower: number } | null = null;

async function rentMinimums(
  program: SecretGardenProgram,
  connection: Connection,
): Promise<{ profile: number; flower: number }> {
  if (rentCache) return rentCache;
  const [profile, flower] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(program.account.playerProfile.size),
    connection.getMinimumBalanceForRentExemption(program.account.flowerRecord.size),
  ]);
  rentCache = { profile, flower };
  return rentCache;
}

/** Crypto-strong random bytes in the browser (no node `crypto`). */
function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

// ---- send + confirm over HTTP (wallet sign-AND-send) ---------------------------------
type SendFn = (tx: Transaction, connection: Connection) => Promise<string>;

async function confirmSignature(
  connection: Connection,
  signature: string,
  timeoutMs = 90_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const st = (await connection.getSignatureStatuses([signature])).value[0];
    if (st) {
      if (st.err) {
        throw classifyError(new Error(`on-chain failure: ${JSON.stringify(st.err)}`));
      }
      if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") {
        return;
      }
    }
    await sleep(1000);
  }
  throw new TxError("failed", "confirmation timed out");
}

async function sendAndConfirm(
  send: SendFn,
  connection: Connection,
  tx: Transaction,
): Promise<string> {
  try {
    const signature = await send(tx, connection);
    await confirmSignature(connection, signature);
    return signature;
  } catch (e) {
    throw classifyError(e);
  }
}

// ---- experiment polling (for the breeding "Waiting in Greenhouse" state) -------------
export type ExperimentOutcome = "completed" | "failed" | "timeout";

/**
 * Poll an Experiment account until it leaves the Queued state. Returns "completed" when the
 * MPC callback lands (status 2), "failed" on any other terminal status, "timeout" if it
 * never resolves within `timeoutMs`. Defaults: every 5s, give up after 10 minutes.
 */
export async function pollExperiment(
  program: SecretGardenProgram,
  experiment: PublicKey,
  { intervalMs = 5_000, timeoutMs = 600_000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<ExperimentOutcome> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const exp = await program.account.experiment.fetchNullable(experiment);
    if (exp) {
      if (exp.status === EXPERIMENT_STATUS_COMPLETED) return "completed";
      if (exp.status !== EXPERIMENT_STATUS_QUEUED) return "failed";
    }
    await sleep(intervalMs);
  }
  return "timeout";
}

/**
 * The live MXE public key, retried until the cluster answers (it can lag right after a
 * deploy). EVERY encrypted flow derives its shared secret against THIS key — both the
 * outbound direction (start_breeding encrypting the environment) and the inbound one
 * (private_hint decrypting a result sealed to the player), which is why it lives here
 * rather than inside a single action. Mirrors the retry loop in tests/*.devnet.ts.
 */
async function fetchMxePublicKey(provider: AnchorProvider): Promise<Uint8Array> {
  let mxePublicKey: Uint8Array | null = null;
  for (let i = 0; i < 30 && !mxePublicKey; i++) {
    try {
      mxePublicKey = await getMXEPublicKey(provider, PROGRAM_ID);
    } catch {
      /* MXE key not ready yet */
    }
    if (!mxePublicKey) await sleep(1000);
  }
  if (!mxePublicKey) throw new TxError("failed", "greenhouse not ready (no MXE key)");
  return mxePublicKey;
}

export interface StartBreedingResult {
  experiment: PublicKey;
  signature: string;
  /** Flower index the offspring will occupy once the MPC callback lands (for a follow-up read). */
  offspringIndex: number;
}

/**
 * The player's HintResult account, flattened (no BN/PublicKey leakage, same rule as
 * src/program/accounts.ts mappers). `ciphertext` + `nonce` are the two fields decryptHint
 * needs; everything else lets the caller tell a fresh result from a stale one.
 */
export interface HintResultAccount {
  /** False until the computation's callback writes a fresh sealed result. */
  ready: boolean;
  /** The round the hint was computed against — a hint from an older round is stale. */
  roundId: number;
  /** Meaningful low-bit count of the decrypted mask (the round's target_trait_count). */
  targetTraitCount: number;
  /** The sealed result (32 bytes) — meaningless until `ready`, and only the requesting key opens it. */
  ciphertext: number[];
  /** The OUTPUT nonce assigned by the cluster; this is what decrypt must use. */
  nonce: number[];
  /** Unix seconds the result was computed; advances on every overwrite. */
  computedAt: number;
}

export interface QueueHintResult {
  /**
   * The ephemeral x25519 PRIVATE key the result is sealed to. Unlike start_breeding (whose
   * result is public, so its key is thrown away immediately), this key is the ONLY thing that
   * can open the hint — the caller must hold it until it has decrypted, then drop it.
   */
  hintPriv: Uint8Array;
  signature: string;
  /** The round this request was queued against (compare with HintResultAccount.roundId). */
  roundId: number;
}

export interface GardenActions {
  /** True once a wallet + program are connected and transactions can be sent. */
  ready: boolean;
  /**
   * What first-time setup will cost and whether this wallet can cover it. Reads live rent
   * minimums and the wallet's CURRENT balance every call — never cached across calls — so a
   * player who tops up and presses retry is re-measured rather than judged on a stale result.
   */
  checkStarterFunds: () => Promise<StarterFunds>;
  /**
   * Create the PlayerProfile PDA (step 1 of first-time setup). Idempotent: resolves immediately
   * if the profile already exists, so a retry after a partial setup only does what's left.
   * Refuses to build a transaction at all when the wallet cannot fund the whole of setup.
   */
  createProfile: () => Promise<void>;
  claimStarters: () => Promise<string>;
  startBreeding: (args: {
    flowerAIndex: number;
    flowerBIndex: number;
    environment: Environment;
  }) => Promise<StartBreedingResult>;
  submitEntry: (args: { roundId: number; flowerRecord: string }) => Promise<string>;
  /**
   * Grow a pre-Stage-5D (68-byte) PlayerProfile to the current layout. Player-initiated ONLY
   * (the in-game "update your garden" notice) — never fired automatically, so there is no
   * surprise wallet popup. Idempotent on-chain (a no-op success if already current).
   */
  migrateProfile: () => Promise<string>;
  pollBreeding: (experiment: PublicKey) => Promise<ExperimentOutcome>;
  /** Read one of the connected wallet's FlowerRecords by index (e.g. a new offspring). */
  fetchFlower: (index: number) => Promise<Flower | null>;
  /**
   * Release one of the player's own hybrids: deletes the record, returns what it cost to keep
   * on-chain, and frees a collection slot. Only ever succeeds for a flower that is the
   * caller's, still Active (not mid-cross, not entered in a challenge), and not a starter.
   */
  closeFlower: (flowerRecord: PublicKey) => Promise<string>;
  /**
   * Ask for a private hint on one of the player's OWN flowers: which of the open round's
   * target traits it satisfies. Returns the ephemeral private key the answer is sealed to —
   * the caller MUST keep it alive until it reads and decrypts the result (see QueueHintResult).
   */
  queuePrivateHint: (flowerRecord: PublicKey) => Promise<QueueHintResult>;
  /** Read a player's HintResult account. Null when they've never requested a hint. */
  fetchHintResult: (player: PublicKey) => Promise<HintResultAccount | null>;
  /** Open a sealed hint with the key from queuePrivateHint. Returns the raw trait bitmask. */
  decryptHint: (
    hintPriv: Uint8Array,
    hintResult: Pick<HintResultAccount, "ciphertext" | "nonce">,
  ) => Promise<number>;
}

/**
 * Hook exposing the three player transactions bound to the connected wallet. All web3/anchor/
 * arcium handling stays inside this module — components only see `GardenActions` + `TxError`.
 */
export function useGardenActions(): GardenActions {
  const program = useProgram();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { reportWrongNetwork } = useNetworkGuard();

  const ready = !!program && !!publicKey;

  const send = useCallback<SendFn>(
    (tx, conn) => sendTransaction(tx, conn),
    [sendTransaction],
  );

  // Single send choke point: a "network" failure tells the guard the wallet is on the wrong
  // cluster (so the app can swap to the Switch-to-Devnet screen) before the error propagates.
  const submit = useCallback(
    async (tx: Transaction): Promise<string> => {
      try {
        return await sendAndConfirm(send, connection, tx);
      } catch (e) {
        if (e instanceof TxError && e.kind === "network") reportWrongNetwork();
        throw e;
      }
    },
    [send, connection, reportWrongNetwork],
  );

  // Grow a pre-5D PlayerProfile to the current layout. Called ONLY when the player taps the
  // in-game "update your garden" notice — never automatically — so the wallet popup is always
  // something the player explicitly asked for. Idempotent on-chain (Ok even if already current).
  const migrateProfile = useCallback(async (): Promise<string> => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    const tx = await program.methods
      .migrateProfile()
      .accountsPartial({ owner: publicKey, profile: profilePda(publicKey) })
      .transaction();
    return submit(tx);
  }, [program, publicKey, submit]);

  /**
   * Pre-flight: can this wallet actually pay for setup? Costed from live rent minimums for
   * the exact account sizes, plus one base fee per signature, plus a margin.
   *
   * The requirement depends on what is left to do. A brand-new wallet pays for the profile AND
   * six flowers across two signatures; a wallet that already got past step 1 pays only for the
   * six flowers and one signature, so it is not held to a number it no longer owes.
   *
   * Deliberately re-reads the balance on every call. The retry path exists precisely so a
   * player can top up and try again — caching this would tell them they are still broke.
   */
  const checkStarterFunds = useCallback(async (): Promise<StarterFunds> => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    const profileExists =
      (await program.account.playerProfile.fetchNullable(profilePda(publicKey))) !== null;
    const rent = await rentMinimums(program, connection);
    const signatures = profileExists ? 1 : 2;
    const requiredLamports =
      (profileExists ? 0 : rent.profile) +
      STARTER_FLOWER_COUNT * rent.flower +
      signatures * LAMPORTS_PER_SIGNATURE +
      FUNDING_MARGIN_LAMPORTS;
    const balanceLamports = await connection.getBalance(publicKey);
    return {
      requiredLamports,
      balanceLamports,
      sufficient: balanceLamports >= requiredLamports,
      claimOnly: profileExists,
    };
  }, [program, publicKey, connection]);

  /**
   * Throws before anything is built or signed when the wallet cannot fund setup. Both signing
   * entry points call this, so the guard cannot be skipped by whichever one the UI reaches
   * first — the whole point is that no popup opens on a wallet that will fail partway.
   */
  const requireStarterFunds = useCallback(async (): Promise<void> => {
    const funds = await checkStarterFunds();
    if (!funds.sufficient) {
      throw new TxError("insufficient", insufficientStarterFundsMessage(funds));
    }
  }, [checkStarterFunds]);

  // Step 1 of first-time setup: create the PlayerProfile PDA. Idempotent — if it already
  // exists (e.g. the player got past step 1 but cancelled the claim), this resolves without a
  // transaction so a retry only does the claim. Exposed so the UI can show a 2-step progress.
  const createProfile = useCallback(async (): Promise<void> => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    const owner = publicKey;
    const profile = profilePda(owner);
    const existing = await program.account.playerProfile.fetchNullable(profile);
    if (existing) return; // already set up — nothing to sign
    // Gate on the FULL cost, not just this transaction's. Affording create_profile but not
    // claim_starters is the trap: it succeeds, takes the rent, and strands the wallet
    // half-set-up with less SOL than before.
    await requireStarterFunds();
    const tx = await program.methods
      .createProfile()
      .accountsPartial({ owner, config: configPda(), profile })
      .transaction();
    await submit(tx);
  }, [program, publicKey, submit, requireStarterFunds]);

  const claimStarters = useCallback(async (): Promise<string> => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    const owner = publicKey;
    const profile = profilePda(owner);

    // Same gate as createProfile. Reached on its own on the claim-only retry path, where the
    // profile already exists and the requirement drops to six flowers plus one signature.
    await requireStarterFunds();

    // claim_starters takes `profile` as `mut` (NOT `init`) — the program requires the
    // PlayerProfile PDA to already exist. A brand-new wallet has none, so create it first in
    // a SEPARATE, confirmed transaction: the account must be on-chain before claim_starters
    // can reference it (a single combined tx would still see an uninitialised profile). If
    // the profile already exists (created earlier but starters not yet claimed), skip this.
    const existing = await program.account.playerProfile.fetchNullable(profile);
    if (!existing) {
      const createTx = await program.methods
        .createProfile()
        .accountsPartial({ owner, config: configPda(), profile })
        .transaction();
      await submit(createTx);
    }

    const tx = await program.methods
      .claimStarters()
      .accountsPartial({
        owner,
        config: configPda(),
        profile,
        flower0: flowerPda(owner, 0),
        flower1: flowerPda(owner, 1),
        flower2: flowerPda(owner, 2),
        flower3: flowerPda(owner, 3),
        flower4: flowerPda(owner, 4),
        flower5: flowerPda(owner, 5),
      })
      .transaction();
    return submit(tx);
  }, [program, publicKey, submit, requireStarterFunds]);

  const startBreeding = useCallback(
    async ({
      flowerAIndex,
      flowerBIndex,
      environment,
    }: {
      flowerAIndex: number;
      flowerBIndex: number;
      environment: Environment;
    }): Promise<StartBreedingResult> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const player = publicKey;
      const provider = program.provider as AnchorProvider;

      // x25519 key-exchange against the live MXE public key, then RescueCipher the env.
      const mxePublicKey = await fetchMxePublicKey(provider);

      const privKey = x25519.utils.randomSecretKey();
      const pubKey = x25519.getPublicKey(privKey);
      const cipher = new RescueCipher(x25519.getSharedSecret(privKey, mxePublicKey));

      const nonce = randomBytes(16);
      // The circuit's `pick()` takes an environment bias on a 0..=255 scale (it computes
      // `bias / 4`, giving 0..=63, and passes a literal 128 for genes with no environmental
      // affinity). `Environment.light/water/soil` are UI option INDICES (0..2), so sending them
      // raw made `bias / 4` truncate to 0 for every dial position — the dials had literally no
      // effect on inheritance, while the non-environmental genes got the +32 from that 128.
      // Map each dial position onto the scale the circuit documents. The repo's own tests
      // already send 0..255 values (e.g. [40, 120, 200]); only this client was out of contract.
      const ct = cipher.encrypt(
        [
          BigInt(DIAL_TO_BIAS[environment.light] ?? 128),
          BigInt(DIAL_TO_BIAS[environment.water] ?? 128),
          BigInt(DIAL_TO_BIAS[environment.soil] ?? 128),
        ],
        nonce,
      );

      // Derive the offspring + experiment PDAs from the CURRENT on-chain counters (never the
      // possibly-stale UI copy), and a random 64-bit computation offset (per the test).
      const profile = await program.account.playerProfile.fetchNullable(profilePda(player));
      if (!profile) throw new TxError("failed", "no garden profile");
      const experiment = experimentPda(player, profile.totalExperiments);
      const offspring = flowerPda(player, profile.nextFlowerIndex);
      const offset = new BN(Array.from(randomBytes(8)));

      const tx = await program.methods
        .startBreeding(
          offset,
          Array.from(pubKey),
          new BN(deserializeLE(nonce).toString()),
          Array.from(ct[0]),
          Array.from(ct[1]),
          Array.from(ct[2]),
        )
        .accountsPartial({
          player,
          profile: profilePda(player),
          flowerA: flowerPda(player, flowerAIndex),
          flowerB: flowerPda(player, flowerBIndex),
          experiment,
          offspring,
          ...arciumAccountsFor("breed", offset),
        })
        .transaction();

      const signature = await submit(tx);
      return { experiment, signature, offspringIndex: profile.nextFlowerIndex };
    },
    [program, publicKey, submit],
  );

  const submitEntry = useCallback(
    async ({
      roundId,
      flowerRecord,
    }: {
      roundId: number;
      flowerRecord: string;
    }): Promise<string> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const player = publicKey;
      const profile = profilePda(player);

      // NOTE: a pre-5D profile must be migrated FIRST (it can't be loaded as a typed account),
      // but that is now an explicit, player-initiated step — the UI disables Submit until the
      // "update your garden" notice is actioned, so we never silently migrate here.

      const round = roundPda(roundId);
      const tx = await program.methods
        .submitEntry()
        .accountsPartial({
          player,
          config: configPda(),
          profile,
          round,
          flowerRecord: new PublicKey(flowerRecord),
          entry: entryPda(round, player),
        })
        .transaction();
      return submit(tx);
    },
    [program, publicKey, submit],
  );

  // Release a hybrid back to the wild: close_flower deletes the FlowerRecord, refunds what it
  // cost to keep on-chain to the owner in the same transaction, and decrements total_flowers
  // so a collection slot opens up. Every rule is an on-chain account constraint (own flower,
  // Active, non-starter, game not paused) — the UI mirrors them only to avoid offering a
  // button that would certainly fail, never as the real check.
  const closeFlower = useCallback(
    async (flowerRecord: PublicKey): Promise<string> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const owner = publicKey;
      const tx = await program.methods
        .closeFlower()
        .accountsPartial({
          owner,
          config: configPda(),
          profile: profilePda(owner),
          flower: flowerRecord,
        })
        .transaction();
      return submit(tx);
    },
    [program, publicKey, submit],
  );

  // ---- private hint -------------------------------------------------------------------
  // Same x25519 + RescueCipher primitives as startBreeding, but the key lifetime is the
  // opposite: breeding seals nothing back to the player (the offspring is public), so it
  // discards its key the moment the tx is built. A hint IS sealed back — to a key only this
  // browser session ever held — so the private key is handed to the caller instead. Nobody
  // else, operator and cluster included, can open the result.
  const queuePrivateHint = useCallback(
    async (flowerRecord: PublicKey): Promise<QueueHintResult> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const player = publicKey;

      // The round PDA is seeded by round_id, which Anchor can't resolve on its own; read the
      // live counter rather than trusting the UI's copy (same rule as openRound/startBreeding).
      const config = await program.account.gameConfig.fetch(configPda());
      const roundId = Number(config.currentRound.toString());
      if (roundId <= 0) throw new TxError("failed", "no open challenge to check against");

      // Fresh, single-use sealing keypair. `hintNonce` is the nonce we ASK the cluster to seal
      // under; the nonce the result is actually decrypted with comes back on-chain in
      // HintResult.nonce, so this one is deliberately not kept.
      const hintPriv = x25519.utils.randomSecretKey();
      const hintPub = x25519.getPublicKey(hintPriv);
      const hintNonce = randomBytes(16);
      const offset = new BN(Array.from(randomBytes(8)));

      const tx = await program.methods
        .queuePrivateHint(
          offset,
          Array.from(hintPub),
          new BN(deserializeLE(hintNonce).toString()),
        )
        .accountsPartial({
          player,
          round: roundPda(roundId),
          flower: flowerRecord,
          hintResult: hintPda(player),
          ...arciumAccountsFor("private_hint", offset),
        })
        .transaction();

      const signature = await submit(tx);
      return { hintPriv, signature, roundId };
    },
    [program, publicKey, submit],
  );

  // One HintResult per wallet (seeds = ["hint", player]); fetchNullable because a player who
  // has never asked for a hint simply has no account yet — that is not an error.
  const fetchHintResult = useCallback(
    async (player: PublicKey): Promise<HintResultAccount | null> => {
      if (!program) return null;
      const acc = await program.account.hintResult.fetchNullable(hintPda(player));
      if (!acc) return null;
      return {
        ready: acc.ready,
        roundId: Number(acc.roundId.toString()),
        targetTraitCount: acc.targetTraitCount,
        ciphertext: Array.from(acc.ciphertext),
        nonce: Array.from(acc.nonce),
        computedAt: acc.computedAt.toNumber(),
      };
    },
    [program],
  );

  // Unseal the result. TWO details here are easy to get wrong and were pinned down against
  // the live cluster (tests/private-hint.devnet.ts):
  //   1. the shared secret is derived against the MXE public key — NOT HintResult.encryptionKey,
  //      which is only our own pubkey echoed back as an identifier of who it was sealed for;
  //   2. the nonce is the OUTPUT nonce stored on-chain — NOT the one we sent at queue time.
  // The plaintext is a single byte: bit i is set when target_traits[i] is satisfied.
  const decryptHint = useCallback(
    async (
      hintPriv: Uint8Array,
      hintResult: Pick<HintResultAccount, "ciphertext" | "nonce">,
    ): Promise<number> => {
      if (!program) throw new TxError("failed", "wallet not connected");
      const mxePublicKey = await fetchMxePublicKey(program.provider as AnchorProvider);
      const cipher = new RescueCipher(x25519.getSharedSecret(hintPriv, mxePublicKey));
      const plaintext = cipher.decrypt(
        [hintResult.ciphertext],
        Uint8Array.from(hintResult.nonce),
      );
      return Number(plaintext[0]);
    },
    [program],
  );

  const pollBreeding = useCallback(
    (experiment: PublicKey) => {
      if (!program) return Promise.resolve<ExperimentOutcome>("failed");
      return pollExperiment(program, experiment);
    },
    [program],
  );

  const fetchFlowerRecord = useCallback(
    (index: number): Promise<Flower | null> => {
      if (!program || !publicKey) return Promise.resolve(null);
      return fetchFlower(program, publicKey, index);
    },
    [program, publicKey],
  );

  return useMemo(
    () => ({
      ready,
      checkStarterFunds,
      createProfile,
      claimStarters,
      startBreeding,
      submitEntry,
      migrateProfile,
      pollBreeding,
      fetchFlower: fetchFlowerRecord,
      closeFlower,
      queuePrivateHint,
      fetchHintResult,
      decryptHint,
    }),
    [ready, checkStarterFunds, createProfile, claimStarters, startBreeding, submitEntry, migrateProfile, pollBreeding, fetchFlowerRecord, closeFlower, queuePrivateHint, fetchHintResult, decryptHint],
  );
}

// ======================================================================================
// OPERATOR / AUTHORITY instructions (internal tool, not part of the player surface).
//
// These are gated in the UI to the wallet that equals GameConfig.authority. Account
// derivation mirrors tests/scoring.devnet.ts exactly (proven on devnet cluster 456): the
// minimal accountsPartial set below is what Anchor cannot resolve from IDL seeds; config,
// sign_pda_account, pool/clock accounts, system_program and arcium_program self-resolve.
// ======================================================================================

/** One CompetitionEntry for the operator panel (read model — no PublicKey/BN leakage). */
export interface OperatorEntry {
  /** The CompetitionEntry account address (used as the queue_score_entry target). */
  pubkey: string;
  player: string;
  flowerRecord: string;
  scored: boolean;
}

/** What open_round produced: its signature plus the round number it actually opened. */
export interface OpenedRound {
  signature: string;
  /** currentRound + 1, derived from the live config read — NOT from the UI's copy. */
  roundId: number;
}

export interface OperatorActions {
  /** True once a wallet + program are connected and operator transactions can be sent. */
  ready: boolean;
  /** open_round — opens round (currentRound + 1). Reads the live config for the counter. */
  openRound: () => Promise<OpenedRound>;
  /** close_round — stops new entries on the given round. */
  closeRound: (roundId: number) => Promise<string>;
  /** finalize_round — Closed -> Finalized, which is what lets the NEXT round open. */
  finalizeRound: (roundId: number) => Promise<string>;
  /** queue_score_entry for ONE entry (separate wallet approval each). */
  queueScoreEntry: (entryPubkey: string) => Promise<string>;
  /**
   * Read-only: what revealing this round would involve, and how much of it the chain says is
   * already done. Called when the panel opens so an interrupted sequence can be resumed.
   */
  inspectReveal: (roundId: number) => Promise<RevealStatus>;
  /**
   * Run the FULL bracket reveal for a round — partition, shard reveals, collection, promotion
   * and semifinals for a large round, the final reveal, and apply_bracket_result — reporting
   * each phase through `onProgress`. Resumes automatically from whatever is already on-chain.
   *
   * This replaces `queue_reveal_top3`, which Arcium rejects past 14 entries (error 6202) and
   * which is no longer part of the operational flow.
   */
  revealWinners: (roundId: number, onProgress: ProgressFn) => Promise<void>;
  /** Fetch all CompetitionEntry accounts for a round (memcmp on the `round` field). */
  fetchRoundEntries: (roundId: number) => Promise<OperatorEntry[]>;
}

/**
 * Hook exposing the five authority-only instructions plus the entry read the score/reveal
 * flow needs. All web3/anchor/arcium handling stays inside this module, exactly like the
 * player surface above. UI must only render this when the wallet equals GameConfig.authority.
 */
export function useOperatorActions(): OperatorActions {
  const program = useProgram();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { reportWrongNetwork } = useNetworkGuard();

  const ready = !!program && !!publicKey;

  const send = useCallback<SendFn>(
    (tx, conn) => sendTransaction(tx, conn),
    [sendTransaction],
  );

  // Same wrong-network choke point as the player surface (see useGardenActions.submit).
  const submit = useCallback(
    async (tx: Transaction): Promise<string> => {
      try {
        return await sendAndConfirm(send, connection, tx);
      } catch (e) {
        if (e instanceof TxError && e.kind === "network") reportWrongNetwork();
        throw e;
      }
    },
    [send, connection, reportWrongNetwork],
  );

  const fetchRoundEntries = useCallback(
    async (roundId: number): Promise<OperatorEntry[]> => {
      if (!program) return [];
      const round = roundPda(roundId);
      const accs = await program.account.competitionEntry.all([
        { memcmp: { offset: 8, bytes: round.toBase58() } },
      ]);
      return accs.map((a) => ({
        pubkey: a.publicKey.toBase58(),
        player: a.account.player.toBase58(),
        flowerRecord: a.account.flowerRecord.toBase58(),
        scored: a.account.scored,
      }));
    },
    [program],
  );

  const openRound = useCallback(async (): Promise<OpenedRound> => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    // Read the live config counter (never the possibly-stale UI copy) to derive the PDAs.
    const config = await program.account.gameConfig.fetch(configPda());
    const current = Number(config.currentRound.toString());
    const tx = await program.methods
      .openRound()
      .accountsPartial({
        authority: publicKey,
        config: configPda(),
        previousRound: current > 0 ? roundPda(current) : null,
        round: roundPda(current + 1),
      })
      .transaction();
    // The caller needs the new number to key off-chain round metadata; hand back the one the
    // PDAs were derived from so the two can never disagree.
    return { signature: await submit(tx), roundId: current + 1 };
  }, [program, publicKey, submit]);

  const closeRound = useCallback(
    async (roundId: number): Promise<string> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const tx = await program.methods
        .closeRound()
        .accountsPartial({ authority: publicKey, round: roundPda(roundId) })
        .transaction();
      return submit(tx);
    },
    [program, publicKey, submit],
  );

  /**
   * Closed -> Finalized. open_round refuses to run while the previous round is still Closed,
   * so without this every round dead-ends and the game cannot advance.
   *
   * ONE-WAY. There is no un-finalize instruction, and queue_score_entry requires
   * status == Closed — so finalizing a round that still has unscored entries forfeits their
   * scores permanently. (The reveal itself survives: the bracket accepts a FINALIZED round
   * so a fully-scored one can still be rescued.) The chain itself only checks
   * `status == Closed` (finalize_round.rs); the ordering guard lives in the UI, see
   * OperatorPanel's `canFinalize`.
   */
  const finalizeRound = useCallback(
    async (roundId: number): Promise<string> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const tx = await program.methods
        .finalizeRound()
        .accountsPartial({ authority: publicKey, round: roundPda(roundId) })
        .transaction();
      return submit(tx);
    },
    [program, publicKey, submit],
  );

  const queueScoreEntry = useCallback(
    async (entryPubkey: string): Promise<string> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const entry = new PublicKey(entryPubkey);
      // The entry carries its own round + flower_record; read them rather than trust the UI.
      const acc = await program.account.competitionEntry.fetch(entry);
      const offset = new BN(Array.from(randomBytes(8)));
      const tx = await program.methods
        .queueScoreEntry(offset)
        .accountsPartial({
          authority: publicKey,
          round: acc.round,
          entry,
          flowerRecord: acc.flowerRecord,
          ...arciumAccountsFor("score_entry_v2", offset),
        })
        .transaction();
      return submit(tx);
    },
    [program, publicKey, submit],
  );

  // The bracket reveal is a multi-step sequence rather than one instruction, so it lives in
  // its own module (./reveal). Both entry points below just bind it to the connected wallet
  // and the same send-and-confirm choke point every other operator action uses.
  const revealContext = useCallback(() => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    return { program, authority: publicKey, submit };
  }, [program, publicKey, submit]);

  const inspectRoundReveal = useCallback(
    (roundId: number): Promise<RevealStatus> => inspectReveal(revealContext(), roundId),
    [revealContext],
  );

  const revealWinners = useCallback(
    (roundId: number, onProgress: ProgressFn): Promise<void> =>
      runBracketReveal(revealContext(), roundId, onProgress),
    [revealContext],
  );

  return useMemo(
    () => ({
      ready,
      openRound,
      closeRound,
      finalizeRound,
      queueScoreEntry,
      inspectReveal: inspectRoundReveal,
      revealWinners,
      fetchRoundEntries,
    }),
    [
      ready,
      openRound,
      closeRound,
      finalizeRound,
      queueScoreEntry,
      inspectRoundReveal,
      revealWinners,
      fetchRoundEntries,
    ],
  );
}
