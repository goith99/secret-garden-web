/**
 * Round metadata — the operator's off-chain decorations for a round: an optional display
 * name ("Weekend Fun 1st Edition") and the greenhouse background theme. NEITHER exists
 * on-chain: the round itself is authoritative on Solana and this table only dresses it up,
 * so a missing row, a missing table, or an unconfigured Supabase all degrade to the plain
 * classic-night round the app has always shown.
 *
 * Reads go through the public anon key like the Daily Winners history (see useRoundHistory).
 * The single write goes through the set-round-metadata edge function, which is the only thing
 * holding a key that can write the table — see saveRoundMetadata.
 */
import { useEffect, useState } from "react";
import { invokeErrorMessage, supabase } from "../lib/supabase";

/** The background presets an operator can pick from. Cosmetic, frontend-rendered only. */
export const GARDEN_BACKGROUNDS = [
  { value: "classic", label: "Classic Night" },
  { value: "event", label: "Festival Night" },
] as const;

export type GardenBackground = (typeof GARDEN_BACKGROUNDS)[number]["value"];

/** What every round gets when it has no stored row (or Supabase is unavailable). */
export const DEFAULT_BACKGROUND: GardenBackground = "classic";

export interface RoundMetadata {
  /** "" when the round was opened without a name — never null, so the UI can just test it. */
  name: string;
  background: GardenBackground;
}

const NO_METADATA: RoundMetadata = { name: "", background: DEFAULT_BACKGROUND };

/** Row shape as stored in Supabase (snake_case, nullable name). */
interface DbRoundMetadata {
  round_number: number;
  name: string | null;
  background: string | null;
}

/** An unknown/legacy background string falls back to classic rather than breaking the scene. */
function asBackground(value: string | null): GardenBackground {
  return GARDEN_BACKGROUNDS.some((b) => b.value === value)
    ? (value as GardenBackground)
    : DEFAULT_BACKGROUND;
}

/** A round's stored name + background. Defaults when unconfigured, absent, or on error. */
export async function fetchRoundMetadata(roundNumber: number): Promise<RoundMetadata> {
  if (!supabase || roundNumber <= 0) return NO_METADATA;
  const { data, error } = await supabase
    .from("round_metadata")
    .select("round_number, name, background")
    .eq("round_number", roundNumber)
    .maybeSingle()
    .overrideTypes<DbRoundMetadata, { merge: false }>();
  if (error || !data) return NO_METADATA;
  return { name: data.name?.trim() ?? "", background: asBackground(data.background) };
}

/**
 * The exact string the operator wallet signs to authorise a write. Binding the payload (not
 * just the round number) means a captured signature cannot be replayed with a different name
 * or background, and the timestamp bounds how long it can be replayed at all.
 *
 * MUST stay in lockstep with roundMetadataMessage() in
 * supabase/functions/set-round-metadata/index.ts, which rebuilds this from the fields it is
 * about to store and verifies the signature against it.
 */
export function roundMetadataMessage(
  roundNumber: number,
  name: string,
  background: GardenBackground,
  timestamp: number,
): string {
  return `secret-garden:open-round:${roundNumber}:${background}:${name}:${timestamp}`;
}

/** The connected wallet, narrowed to what a metadata write needs (see useGardener). */
export interface RoundMetadataSigner {
  address: string | null;
  /** Signs a UTF-8 message, resolving to a base64 signature. Null when unsupported. */
  signMessage: ((message: string) => Promise<string>) | null;
}

/**
 * Records the operator's cosmetic choices for a freshly opened round, keyed by round number
 * (upsert, so re-running against the same round corrects it rather than duplicating).
 *
 * The browser cannot write round_metadata: the table has no anon write policy. Instead the
 * wallet signs roundMetadataMessage() and the set-round-metadata edge function verifies that
 * signature, checks the wallet against the on-chain GameConfig authority/operators, and does
 * the write with the service role key. Throws on any failure so the caller can report it
 * separately from the on-chain open, which has already succeeded by the time we get here.
 */
export async function saveRoundMetadata(
  roundNumber: number,
  name: string,
  background: GardenBackground,
  signer: RoundMetadataSigner,
): Promise<void> {
  const trimmed = name.trim();
  // Nothing chosen → nothing worth a wallet prompt; an unnamed classic round is the default
  // the read path already returns for a missing row.
  if (!trimmed && background === DEFAULT_BACKGROUND) return;
  if (roundNumber <= 0) throw new Error("no round number to attach the name to");
  if (!supabase) throw new Error("Supabase is not configured in this build.");
  if (!signer.address || !signer.signMessage) {
    throw new Error("This wallet cannot sign messages, so the write could not be authorised.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signer.signMessage(
    roundMetadataMessage(roundNumber, trimmed, background, timestamp),
  );

  const { error } = await supabase.functions.invoke("set-round-metadata", {
    body: {
      round_number: roundNumber,
      name: trimmed,
      background,
      timestamp,
      wallet: signer.address,
      signature,
    },
  });
  if (error) throw new Error(await invokeErrorMessage(error));
}

/**
 * The active round's name + background, refetched whenever the round advances. Renders as an
 * unnamed classic round until the row arrives (and forever, if it never does), which is why
 * there is no `loading` flag — there is nothing a caller could usefully do with one.
 */
export function useRoundMetadata(roundNumber: number): RoundMetadata {
  const [metadata, setMetadata] = useState<RoundMetadata>(NO_METADATA);

  useEffect(() => {
    let cancelled = false;
    void fetchRoundMetadata(roundNumber).then((result) => {
      if (!cancelled) setMetadata(result);
    });
    return () => {
      cancelled = true;
    };
  }, [roundNumber]);

  return metadata;
}
