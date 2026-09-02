/**
 * Talking to the sync endpoint.
 *
 * The personal code never leaves the device. What travels is the SHA-256 of
 * the code with a fixed prefix, and that hash is the only thing the server
 * stores or indexes on — so a copy of the database gives up ledgers only to
 * someone who already guessed a code. That also means a forgotten code cannot
 * be recovered, which is the honest trade for having no accounts to sign into.
 */

import type { Ledger } from "../types.ts";
import { mergeLedgers, pruneLedger, sanitiseLedger } from "./merge.ts";

const CODE_PREFIX = "cashflow.space.v1:";

/** Ambiguous characters are left out so a code can be read aloud or copied. */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export const MIN_CODE_LENGTH = 8;

export function isUsableCode(code: string): boolean {
  return code.trim().length >= MIN_CODE_LENGTH;
}

/** A suggestion, in three readable groups: `k7pq-3mtv-9bxd`. */
export function generateSyncCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const characters = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);
  return [
    characters.slice(0, 4).join(""),
    characters.slice(4, 8).join(""),
    characters.slice(8, 12).join(""),
  ].join("-");
}

export async function spaceIdFor(code: string): Promise<string> {
  const encoded = new TextEncoder().encode(CODE_PREFIX + code.trim());
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class SyncError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SyncError";
    this.status = status;
  }
}

/**
 * Push the local ledger and take back the merged result.
 *
 * The merge runs on both sides. The server needs it to be the tie-breaker for
 * two devices syncing at once; the client repeats it so the screen updates
 * from a state it computed itself, and stays correct even if the response is
 * slow, partial, or arrives after another local edit.
 */
export async function syncLedger(
  code: string,
  ledger: Ledger,
  signal?: AbortSignal,
): Promise<Ledger> {
  const space = await spaceIdFor(code);
  const outgoing = pruneLedger(ledger);

  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ space, ledger: outgoing }),
    signal,
  });

  if (!response.ok) {
    throw new SyncError(`Sync failed with ${response.status}`, response.status);
  }

  const payload: unknown = await response.json();
  const remote = sanitiseLedger(
    typeof payload === "object" && payload !== null
      ? (payload as { ledger?: unknown }).ledger
      : null,
  );

  return pruneLedger(mergeLedgers(outgoing, remote));
}
