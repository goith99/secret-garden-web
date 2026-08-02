/**
 * "Check Match" — the private-hint lifecycle for ONE of the player's own flowers.
 *
 *   idle → requesting (wallet + queue tx) → waiting (the garden works it out)
 *        → ready (per-trait checklist) | error
 *
 * PRIVACY. The answer is sealed on the way back to a single-use key that never leaves this
 * browser tab: it is generated at request time, held in a ref for exactly one request, and
 * wiped the moment the result is decrypted (or on unmount). It is never written to storage,
 * never sent anywhere, and no decrypted result is persisted — not to Supabase, not to the
 * URL, nowhere. Reload the page mid-request and the answer becomes unreadable by anyone,
 * which is the intended trade: nobody but the requesting player can ever open it.
 *
 * ONE REQUEST AT A TIME. On-chain there is exactly one HintResult account per wallet
 * (seeds = ["hint", player]), overwritten by every request. Two flowers checked at once
 * would therefore race for the same account and one would be left holding a key that can't
 * open what it finds. So this hook deliberately tracks a SINGLE active hint, keyed by flower
 * id, and refuses to start another while one is in flight — hence it is mounted once (by
 * GameProvider) rather than per card.
 *
 * STALENESS. A leftover result from an earlier request is still `ready` on-chain, so polling
 * for `ready` alone can return the previous answer. We snapshot `computedAt` before queuing
 * and only accept a result that is both ready AND newer, for the round we queued against.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { Challenge, Flower } from "../types";
import { GenomeStatus, RoundStatus } from "../types";
import { traitName } from "../lib/presentation";
import { TxError, type GardenActions, type HintResultAccount } from "../program/transactions";

/** How often to re-read the HintResult account while waiting for the garden to answer. */
const POLL_INTERVAL_MS = 2_000;
/**
 * How long to wait before giving up. NOTE: the shared devnet cluster has been observed
 * taking longer than this under load (tests/private-hint.devnet.ts allows 180s), so a busy
 * cluster can surface the timeout message even though the result eventually lands — a later
 * "Check Match" will then read it immediately. Raise this if that proves common in practice.
 */
const HINT_TIMEOUT_MS = 60_000;

const TIMEOUT_MESSAGE = "Couldn't check this flower's match right now. Try again.";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type HintPhase = "requesting" | "waiting" | "ready" | "error";

/** One target trait of the round, with whether this flower satisfies it. */
export interface HintTrait {
  name: string;
  matched: boolean;
}

/** The single hint currently being requested or shown. */
export interface HintView {
  /** The flower this hint belongs to — the card that renders it. */
  flowerId: string;
  phase: HintPhase;
  /** Every target trait of the round in order, matched or not (drives the checklist). */
  traits: HintTrait[];
  /** Names of the traits this flower satisfies. */
  matchedTraits: string[];
  /**
   * The score `score_entry` will actually assign this flower — NOT the raw trait fraction.
   * See `scoreOf` for why those are different numbers.
   */
  score: number;
  /** How many of the round's target traits this flower satisfies. */
  matchedCount: number;
  /** How many traits the round is asking for (score_entry's divisor). */
  targetCount: number;
  /** The generation component of `score`; 0 for a generation-1 flower. */
  generationBonus: number;
  /** Player-facing failure text (phase "error" only). */
  error: string | null;
}

/** A transient note tied to the card that raised it (so it can't appear under every card). */
export interface HintNotice {
  flowerId: string;
  message: string;
}

export interface PrivateHintApi {
  /** The one hint in flight or on screen, or null when nothing has been checked. */
  hint: HintView | null;
  /** True while a request is running — every other flower's button disables. */
  busy: boolean;
  /** Whether this flower can be checked right now (open round, own sealed bloom, idle). */
  canCheckMatch: (flower: Flower) => boolean;
  /** Start a hint request for one of the player's own flowers. */
  checkMatch: (flower: Flower) => void;
  /** Clear the result / error from the card. */
  dismissHint: () => void;
  /** Transient "Check cancelled." note after a declined wallet prompt, and whose card it is. */
  hintNotice: HintNotice | null;
}

/**
 * The competition score for a flower, byte-for-byte the same number `score_entry` computes
 * on-chain. Kept as a standalone function so it can be checked against the circuit directly.
 *
 * Mirrors encrypted-ixs/src/lib.rs `score_entry` EXACTLY:
 *
 *     let safe_count = if target_trait_count == 0 { 1 } else { target_trait_count };
 *     let base: u16   = (matched as u16 * 100) / (safe_count as u16);   // INTEGER division
 *     let bonus: u16  = if generation > 1 { (generation - 1) * 5 } else { 0 };
 *     let score       = if base + bonus > 100 { 100 } else { base + bonus };
 *
 * Two details that are easy to get wrong, and were both wrong here before:
 *
 *  1. TRUNCATION, not rounding. Rust's `/` on integers floors. The old code used
 *     Math.round, which disagreed at 2 of 3 traits — the circuit scores 66, the panel
 *     claimed 67. (2/3 is the only fraction where they diverge for counts 2..4.)
 *  2. THE GENERATION BONUS IS PART OF THE SCORE. The old code ignored it entirely, so a
 *     high-generation flower could read "0%" here and still be assigned the maximum 100
 *     on-chain — the bonus alone reaches the cap at generation 21.
 *
 * `generation` is FlowerRecord.generation, the same public field score_entry reads
 * (`ctx.accounts.flower_record.generation`), so no extra fetch is needed.
 *
 * Not emulated: the u16 overflow in `(generation - 1) * 5` past generation 13108. A
 * generation costs one confirmed breed, so that is unreachable.
 */
export function scoreOf(
  matchedCount: number,
  targetTraitCount: number,
  generation: number,
): number {
  const safeCount = targetTraitCount === 0 ? 1 : targetTraitCount;
  const base = Math.floor((matchedCount * 100) / safeCount);
  const bonus = generation > 1 ? (generation - 1) * 5 : 0;
  return Math.min(100, base + bonus);
}

/**
 * Decode the sealed byte into the round's target traits, and score it. Bit i corresponds to
 * target_traits[i]; bits at or above target_trait_count are always clear.
 *
 * The MATCH COUNT is taken over the result's own `target_trait_count`, because that is the
 * divisor score_entry uses. The trait NAMES are listed only for ids we actually hold, so a
 * round that rolled over underneath us can never index past the array — the two loops are
 * separate for that reason.
 */
function decodeBitmask(
  bitmask: number,
  targetTraits: number[],
  targetTraitCount: number,
  generation: number,
): {
  traits: HintTrait[];
  matchedTraits: string[];
  score: number;
  matchedCount: number;
  generationBonus: number;
} {
  let matchedCount = 0;
  for (let i = 0; i < targetTraitCount; i++) {
    if (((bitmask >>> i) & 1) === 1) matchedCount++;
  }

  const named = Math.min(targetTraitCount, targetTraits.length);
  const traits: HintTrait[] = [];
  for (let i = 0; i < named; i++) {
    traits.push({
      name: traitName(targetTraits[i]),
      matched: ((bitmask >>> i) & 1) === 1,
    });
  }

  const matchedTraits = traits.filter((t) => t.matched).map((t) => t.name);
  return {
    traits,
    matchedTraits,
    score: scoreOf(matchedCount, targetTraitCount, generation),
    matchedCount,
    generationBonus: generation > 1 ? (generation - 1) * 5 : 0,
  };
}

export function usePrivateHint(
  actions: GardenActions,
  challenge: Challenge,
  /** The connected wallet, or null. A hint is only ever requested for one's OWN flowers. */
  playerAddress: string | null,
  /** False in standalone/demo mode (no chain) — the button stays hidden. */
  onChain: boolean,
): PrivateHintApi {
  const [hint, setHint] = useState<HintView | null>(null);
  const [hintNotice, setHintNotice] = useState<HintNotice | null>(null);

  /**
   * The single-use sealing key for the request in flight. A ref, not state: it must never
   * cause a render, never be captured in a closure that outlives the request, and never be
   * serialised. Wiped in `clearKey` as soon as the result is open (or the request dies).
   */
  const hintPrivRef = useRef<Uint8Array | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  /**
   * Bumped for every request AND whenever the wallet or round changes underneath one. An
   * in-flight request compares it before touching state, so a result that arrives after the
   * player switched wallet / the round rolled over is dropped instead of rendered against
   * the wrong round's traits.
   */
  const requestIdRef = useRef(0);

  const clearKey = useCallback(() => {
    // Zero the bytes before dropping the reference so the key doesn't linger in a reachable
    // buffer any longer than the request that needed it.
    hintPrivRef.current?.fill(0);
    hintPrivRef.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Unmount (tab switch, disconnect, navigation) destroys the key with the component.
      hintPrivRef.current?.fill(0);
      hintPrivRef.current = null;
    };
  }, []);

  // A hint belongs to one wallet and one round. When either changes, drop what's on screen
  // rather than let a previous player's (or round's) checklist linger on a card — and
  // abandon any request in flight so the button doesn't stay stuck on "Checking…".
  useEffect(() => {
    requestIdRef.current += 1;
    busyRef.current = false;
    hintPrivRef.current?.fill(0);
    hintPrivRef.current = null;
    /* eslint-disable react-hooks/set-state-in-effect */
    setHint(null);
    setHintNotice(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [playerAddress, challenge.roundId]);

  // The "Check cancelled." note is transient, like the pot's "Breeding cancelled." note.
  useEffect(() => {
    if (!hintNotice) return;
    const t = window.setTimeout(() => setHintNotice(null), 3000);
    return () => window.clearTimeout(t);
  }, [hintNotice]);

  const roundOpen =
    challenge.roundId > 0 && challenge.status === RoundStatus.Open && challenge.targetTraitCount > 0;

  const canCheckMatch = useCallback(
    (flower: Flower): boolean =>
      onChain &&
      actions.ready &&
      roundOpen &&
      !busyRef.current &&
      // Starters carry an all-zero genome by design, so a hint on one says nothing.
      flower.genomeStatus !== GenomeStatus.Starter &&
      // Belt-and-braces: only ever the connected wallet's own flowers.
      (playerAddress === null || flower.owner === playerAddress),
    [onChain, actions.ready, roundOpen, playerAddress],
  );

  const dismissHint = useCallback(() => {
    if (busyRef.current) return; // don't drop a request that's still running
    setHint(null);
  }, []);

  const checkMatch = useCallback(
    (flower: Flower) => {
      if (!canCheckMatch(flower) || !playerAddress) return;
      const requestId = ++requestIdRef.current;
      busyRef.current = true;
      setHintNotice(null);
      setHint({
        flowerId: flower.id,
        phase: "requesting",
        traits: [],
        matchedTraits: [],
        score: 0,
        matchedCount: 0,
        targetCount: 0,
        generationBonus: 0,
        error: null,
      });

      /** Still the request the UI is waiting on? False once superseded, unmounted, or reset. */
      const isCurrent = () => mounted.current && requestIdRef.current === requestId;
      /** Give up the key + the busy lock; only this request's own state may be touched after. */
      const release = () => {
        clearKey();
        if (requestIdRef.current === requestId) busyRef.current = false;
      };

      const fail = (message: string) => {
        release();
        if (!isCurrent()) return;
        setHint({
          flowerId: flower.id,
          phase: "error",
          traits: [],
          matchedTraits: [],
          score: 0,
          matchedCount: 0,
          targetCount: 0,
          generationBonus: 0,
          error: message,
        });
      };

      void (async () => {
        const player = new PublicKey(playerAddress);
        try {
          // Snapshot the previous result so a leftover `ready` can't be mistaken for ours.
          const previous = await actions.fetchHintResult(player).catch(() => null);
          const previousComputedAt = previous?.computedAt ?? 0;

          const { hintPriv, roundId } = await actions.queuePrivateHint(
            new PublicKey(flower.id),
          );
          // Hold the key for exactly as long as it takes to read the answer back.
          hintPrivRef.current = hintPriv;
          if (!isCurrent()) {
            release();
            return;
          }
          setHint((h) => (h && h.flowerId === flower.id ? { ...h, phase: "waiting" } : h));

          // Poll the one HintResult account until OUR result lands: ready, newer than the
          // snapshot, and computed against the round we queued against.
          const deadline = Date.now() + HINT_TIMEOUT_MS;
          let result: HintResultAccount | null = null;
          while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            if (!isCurrent()) {
              release();
              return;
            }
            const acc = await actions.fetchHintResult(player).catch(() => null);
            if (acc && acc.ready && acc.computedAt > previousComputedAt && acc.roundId === roundId) {
              result = acc;
              break;
            }
          }
          if (!result) {
            fail(TIMEOUT_MESSAGE);
            return;
          }

          const key = hintPrivRef.current;
          if (!key) {
            fail(TIMEOUT_MESSAGE); // key was wiped mid-flight — nothing can open the result now
            return;
          }
          const bitmask = await actions.decryptHint(key, result);
          // The answer is open; the key has served its only purpose.
          release();
          if (!isCurrent()) return;

          // `flower.generation` is FlowerRecord.generation — the same value score_entry is
          // handed on-chain, so the score below is the one the round will actually assign.
          const decoded = decodeBitmask(
            bitmask,
            challenge.targetTraits,
            result.targetTraitCount,
            flower.generation,
          );
          setHint({
            flowerId: flower.id,
            phase: "ready",
            traits: decoded.traits,
            matchedTraits: decoded.matchedTraits,
            score: decoded.score,
            matchedCount: decoded.matchedCount,
            targetCount: result.targetTraitCount,
            generationBonus: decoded.generationBonus,
            error: null,
          });
        } catch (e) {
          // Declined in the wallet: no failure state, just the same transient "cancelled"
          // note the breeding flow uses — the card returns to its normal button.
          if (e instanceof TxError && e.kind === "rejected") {
            release();
            if (!isCurrent()) return;
            setHint(null);
            setHintNotice({ flowerId: flower.id, message: "Check cancelled." });
            return;
          }
          fail(
            e instanceof TxError && e.kind === "network" ? e.message : TIMEOUT_MESSAGE,
          );
        }
      })();
    },
    [canCheckMatch, playerAddress, actions, challenge.targetTraits, clearKey],
  );

  return {
    hint,
    busy: hint?.phase === "requesting" || hint?.phase === "waiting",
    canCheckMatch,
    checkMatch,
    dismissHint,
    hintNotice,
  };
}
