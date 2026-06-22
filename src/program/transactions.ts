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
export type TxErrorKind = "rejected" | "insufficient" | "failed";

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

// ---- the Arcium account set start_breeding needs (matches breeding.devnet.ts) --------
function arciumAccountsFor(computationOffset: BN) {
  return {
    computationAccount: getComputationAccAddress(ARCIUM_CLUSTER_OFFSET, computationOffset),
    clusterAccount: getClusterAccAddress(ARCIUM_CLUSTER_OFFSET),
    mxeAccount: getMXEAccAddress(PROGRAM_ID),
    mempoolAccount: getMempoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(ARCIUM_CLUSTER_OFFSET),
    compDefAccount: getCompDefAccAddress(PROGRAM_ID, u32FromLE(getCompDefAccOffset("breed"))),
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

  const ready = !!program && !!publicKey;

  const send = useCallback<SendFn>(
    (tx, conn) => sendTransaction(tx, conn),
    [sendTransaction],
  );

  const claimStarters = useCallback(async (): Promise<string> => {
    if (!program || !publicKey) throw new TxError("failed", "wallet not connected");
    const owner = publicKey;
    const tx = await program.methods
      .claimStarters()
      .accountsPartial({
        owner,
        config: configPda(),
        profile: profilePda(owner),
        flower0: flowerPda(owner, 0),
        flower1: flowerPda(owner, 1),
        flower2: flowerPda(owner, 2),
        flower3: flowerPda(owner, 3),
        flower4: flowerPda(owner, 4),
        flower5: flowerPda(owner, 5),
      })
      .transaction();
    return sendAndConfirm(send, connection, tx);
  }, [program, publicKey, connection, send]);

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
          ...arciumAccountsFor(offset),
        })
        .transaction();

      const signature = await sendAndConfirm(send, connection, tx);
      return { experiment, signature, offspringIndex: profile.nextFlowerIndex };
    },
    [program, publicKey, connection, send],
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
      const round = roundPda(roundId);
      const tx = await program.methods
        .submitEntry()
        .accountsPartial({
          player,
          config: configPda(),
          profile: profilePda(player),
          round,
          flowerRecord: new PublicKey(flowerRecord),
          entry: entryPda(round, player),
        })
        .transaction();
      return sendAndConfirm(send, connection, tx);
    },
    [program, publicKey, connection, send],
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
      pollBreeding,
      fetchFlower: fetchFlowerRecord,
    }),
    [ready, claimStarters, startBreeding, submitEntry, pollBreeding, fetchFlowerRecord],
  );
}
