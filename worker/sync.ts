/**
 * The sync endpoint.
 *
 * One row per space, holding the whole ledger as JSON. A personal ledger is a
 * few tens of kilobytes at most, so a blob costs one read and one write per
 * sync where a relational schema would cost a query per table plus a
 * reconciliation pass — and the merge has to run over the full set anyway.
 *
 * The server knows nothing about who is syncing. It receives a hash, not a
 * code, and stores exactly what it is given under that hash.
 */

import { mergeLedgers, pruneLedger, sanitiseLedger } from "../src/services/merge.ts";
import type { Ledger } from "../src/types.ts";

export interface SyncEnv {
  DB: D1Database;
}

/** A space id is a SHA-256 in hex and nothing else. */
const SPACE_ID = /^[0-9a-f]{64}$/;

/** Refuse oversized requests before parsing rather than after. */
export const MAX_BODY_BYTES = 600_000;

/** What one space is allowed to occupy once merged. */
export const MAX_SPACE_BYTES = 400_000;

/** Hard caps so a single space cannot be grown without bound. */
export const MAX_ENTRIES = 5_000;
export const MAX_PAYMENTS = 40_000;
export const MAX_BUDGETS = 500;

/** Spaces untouched for this long are dropped; nothing is syncing to them. */
export const SPACE_TTL_DAYS = 400;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The ledger is personal and always freshly merged; nothing in front of
      // the Worker should hold a copy of it.
      "cache-control": "no-store",
    },
  });
}

function tooMany(ledger: Ledger): boolean {
  return (
    ledger.entries.length > MAX_ENTRIES ||
    ledger.payments.length > MAX_PAYMENTS ||
    ledger.budgets.length > MAX_BUDGETS
  );
}

export async function handleSync(
  request: Request,
  env: SyncEnv,
  now: Date = new Date(),
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "too_large" }, 413);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "too_large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const space =
    typeof body === "object" && body !== null ? (body as { space?: unknown }).space : null;
  if (typeof space !== "string" || !SPACE_ID.test(space)) {
    return json({ error: "bad_space" }, 400);
  }

  const incoming = sanitiseLedger((body as { ledger?: unknown }).ledger);
  if (tooMany(incoming)) {
    return json({ error: "too_many_records" }, 413);
  }

  const stored = await readSpace(env, space);
  const merged = pruneLedger(mergeLedgers(stored, incoming), now);
  if (tooMany(merged)) {
    return json({ error: "too_many_records" }, 413);
  }

  const serialised = JSON.stringify(merged);
  if (serialised.length > MAX_SPACE_BYTES) {
    return json({ error: "too_large" }, 413);
  }

  const updatedAt = now.toISOString();
  await env.DB.prepare(
    "INSERT INTO spaces (id, data, updated_at, bytes) VALUES (?, ?, ?, ?)" +
      " ON CONFLICT(id) DO UPDATE SET data = excluded.data," +
      " updated_at = excluded.updated_at, bytes = excluded.bytes",
  )
    .bind(space, serialised, updatedAt, serialised.length)
    .run();

  return json({ ledger: merged, updatedAt });
}

async function readSpace(env: SyncEnv, space: string): Promise<Ledger> {
  const row = await env.DB.prepare("SELECT data FROM spaces WHERE id = ?")
    .bind(space)
    .first<{ data: string }>();
  if (!row) return { entries: [], payments: [], budgets: [] };
  try {
    return sanitiseLedger(JSON.parse(row.data));
  } catch {
    // A row that will not parse is unusable either way. Treating it as empty
    // lets the device that is syncing rebuild it from its own copy rather than
    // wedging every future sync on a permanent 500.
    return { entries: [], payments: [], budgets: [] };
  }
}

/**
 * Drop spaces nothing has touched in over a year.
 *
 * A blob keyed by a passphrase has no owner to delete it, so without this the
 * table only grows — every mistyped code leaves a row behind forever. Called
 * on a small fraction of requests, which is enough to keep pace with a table
 * that gains rows at human speed.
 */
export async function evictStaleSpaces(env: SyncEnv, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SPACE_TTL_DAYS * 86_400_000).toISOString();
  const result = await env.DB.prepare("DELETE FROM spaces WHERE updated_at < ?")
    .bind(cutoff)
    .run();
  return result.meta?.changes ?? 0;
}

/** Roughly one sweep per hundred syncs, decided per request. */
export function shouldEvict(sample: number = Math.random()): boolean {
  return sample < 0.01;
}
