/**
 * Stage 6D — the ONLY place real on-chain transactions are built and sent. Components never
 * import web3/anchor/arcium; they call the `useGardenActions()` hook, which exposes exactly
 * the three player-scope instructions:
 *
 *   claim_starters  — a new player claims their 6 starter flowers (one-time).
 *   start_breeding  — queue an MPC breeding of two owned parents under chosen environment.
 *   submit_entry    — submit one Active flower to the Open competition round.
 *
 * Operator/authority instructions (open_round, queue_score_entry, reveal_top3, cancel*) are
 * deliberately NOT exposed here.
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
 * route is not expressible against this IDL.) The selector indices 0..2 are the values
 * encrypted; the circuit interprets them server-side.
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
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getClusterAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
} from "@arcium-hq/client";
import { useProgram, type SecretGardenProgram } from "./client";
import { useNetworkGuard } from "../wallet/useNetworkGuard";
import {
  PROGRAM_ID,
  configPda,
  profilePda,
  flowerPda,
  roundPda,
  experimentPda,
  entryPda,
  fetchFlower,
} from "./accounts";
import type { Environment, Flower } from "../types";

// Arcium cluster the breed circuit is deployed + finalized on (devnet). Constant, not read
// from env (getArciumEnv() is node-only); see tests/breeding.devnet.ts header (cluster 456).
const ARCIUM_CLUSTER_OFFSET = 456;

const EXPERIMENT_STATUS_QUEUED = 0;
const EXPERIMENT_STATUS_COMPLETED = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Crypto-strong random bytes in the browser (no node `crypto`). */
function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Read the first 4 little-endian bytes of a comp-def offset as a u32 (no Buffer). */
function u32FromLE(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}

// ---- player-vocabulary error classification ------------------------------------------
export type TxErrorKind = "rejected" | "insufficient" | "failed" | "network";

/** A transaction error already reduced to a player-facing category (never a raw RPC dump). */
export class TxError extends Error {
  readonly kind: TxErrorKind;
  constructor(kind: TxErrorKind, message: string) {
    super(message);
    this.name = "TxError";
    this.kind = kind;
  }
}

function classifyError(e: unknown): TxError {
  if (e instanceof TxError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : "";
  const code = (e as { code?: number })?.code;
  const lower = msg.toLowerCase();

  // Wallet popup closed / user declined — treat as a no-op cancel (caller shows nothing).
  if (
    code === 4001 ||
    name.includes("WalletSignTransaction") ||
    name.includes("WalletSendTransaction") ||
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    return new TxError("rejected", msg);
  }
  // Wrong network: a devnet tx submitted to another cluster (common with wallets the dApp
  // can't pin to devnet, e.g. Phantom) can't find the devnet blockhash or the program account.
  // Flag it so the network guard can take over the screen and prompt a switch to Devnet.
  if (
    lower.includes("blockhash not found") ||
    lower.includes("blockhashnotfound") ||
    lower.includes("program that does not exist") ||
    lower.includes("programaccountnotfound") ||
    lower.includes("invalid program for execution")
  ) {
    return new TxError("network", "Make sure your wallet is set to Devnet and try again.");
  }
  // Not enough SOL to pay fees / rent for the new accounts.
  if (
    lower.includes("insufficient") ||
    lower.includes("debit an account but found no record of a prior credit") ||
    lower.includes("attempt to debit")
  ) {
    return new TxError("insufficient", msg);
  }
  return new TxError("failed", msg);
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

// ---- the Arcium account set a queued computation needs (matches *.devnet.ts) ----------
// `circuit` selects the comp-def: "breed" (start_breeding), "score_entry" (queue_score_entry)
// or "reveal_top3" (queue_reveal_top3) — the exact strings proven in tests/scoring.devnet.ts.
function arciumAccountsFor(circuit: string, computationOffset: BN) {
  return {
    computationAccount: getComputationAccAddress(ARCIUM_CLUSTER_OFFSET, computationOffset),
    clusterAccount: getClusterAccAddress(ARCIUM_CLUSTER_OFFSET),
    mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    compDefAccount: getCompDefAccAddress(PROGRAM_ID, u32FromLE(getCompDefAccOffset(circuit))),
  };
}

export interface StartBreedingResult {
  experiment: PublicKey;
  signature: string;
  /** Flower index the offspring will occupy once the MPC callback lands (for a follow-up read). */
  offspringIndex: number;
}

export interface GardenActions {
  /** True once a wallet + program are connected and transactions can be sent. */
  ready: boolean;
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

  const claimStarters = useCallback(async (): Promise<string> => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    const owner = publicKey;
    const profile = profilePda(owner);

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
  }, [program, publicKey, submit]);

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

      const privKey = x25519.utils.randomSecretKey();
      const pubKey = x25519.getPublicKey(privKey);
      const cipher = new RescueCipher(x25519.getSharedSecret(privKey, mxePublicKey));

      const nonce = randomBytes(16);
      const ct = cipher.encrypt(
        [BigInt(environment.light), BigInt(environment.water), BigInt(environment.soil)],
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
      claimStarters,
      startBreeding,
      submitEntry,
      migrateProfile,
      pollBreeding,
      fetchFlower: fetchFlowerRecord,
    }),
    [ready, claimStarters, startBreeding, submitEntry, migrateProfile, pollBreeding, fetchFlowerRecord],
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

export interface OperatorActions {
  /** True once a wallet + program are connected and operator transactions can be sent. */
  ready: boolean;
  /** open_round — opens round (currentRound + 1). Reads the live config for the counter. */
  openRound: () => Promise<string>;
  /** close_round — stops new entries on the given round. */
  closeRound: (roundId: number) => Promise<string>;
  /** queue_score_entry for ONE entry (separate wallet approval each). */
  queueScoreEntry: (entryPubkey: string) => Promise<string>;
  /** queue_reveal_top3 for the round, passing every entry as a remaining account. */
  queueRevealTop3: (roundId: number) => Promise<string>;
  /** Fetch all CompetitionEntry accounts for a round (memcmp on the `round` field). */
  fetchRoundEntries: (roundId: number) => Promise<OperatorEntry[]>;
}

/**
 * Hook exposing the four authority-only instructions plus the entry read the score/reveal
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

  const openRound = useCallback(async (): Promise<string> => {
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
    return submit(tx);
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
          ...arciumAccountsFor("score_entry", offset),
        })
        .transaction();
      return submit(tx);
    },
    [program, publicKey, submit],
  );

  const queueRevealTop3 = useCallback(
    async (roundId: number): Promise<string> => {
      if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
      const round = roundPda(roundId);
      const entries = await program.account.competitionEntry.all([
        { memcmp: { offset: 8, bytes: round.toBase58() } },
      ]);
      const offset = new BN(Array.from(randomBytes(8)));
      const tx = await program.methods
        .queueRevealTop3(offset)
        .accountsPartial({
          authority: publicKey,
          round,
          ...arciumAccountsFor("reveal_top3", offset),
        })
        .remainingAccounts(
          entries.map((e) => ({
            pubkey: e.publicKey,
            isWritable: false,
            isSigner: false,
          })),
        )
        .transaction();
      return submit(tx);
    },
    [program, publicKey, submit],
  );

  return useMemo(
    () => ({
      ready,
      openRound,
      closeRound,
      queueScoreEntry,
      queueRevealTop3,
      fetchRoundEntries,
    }),
    [ready, openRound, closeRound, queueScoreEntry, queueRevealTop3, fetchRoundEntries],
  );
}
