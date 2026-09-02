/**
 * Merging two copies of the ledger.
 *
 * Shared by the browser and the Worker on purpose — both sides run the same
 * function over the same inputs, so a sync round trip cannot produce a state
 * one side would not have produced itself.
 *
 * The rule is last-write-wins per record, by `updatedAt`. Deletes are
 * tombstones rather than removals, because a device that has been offline for
 * a week would otherwise re-upload everything it never saw deleted and quietly
 * resurrect it.
 */

import type { Entry, Ledger, Payment, SyncedRecord } from "../types.ts";

/** How long a tombstone is kept before it is dropped for good. */
export const TOMBSTONE_DAYS = 90;

export function mergeRecords<T extends SyncedRecord>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  for (const record of [...local, ...remote]) {
    const existing = merged.get(record.id);
    if (!existing) {
      merged.set(record.id, record);
      continue;
    }
    // Ties go to the delete: a record deleted and edited in the same
    // millisecond on two devices should stay deleted rather than flicker back
    // depending on which side happened to sync first.
    if (record.updatedAt > existing.updatedAt) merged.set(record.id, record);
    else if (record.updatedAt === existing.updatedAt && record.deletedAt && !existing.deletedAt) {
      merged.set(record.id, record);
    }
  }
  return [...merged.values()];
}

export function mergeLedgers(local: Ledger, remote: Ledger): Ledger {
  return {
    entries: mergeRecords<Entry>(local.entries, remote.entries),
    payments: mergeRecords<Payment>(local.payments, remote.payments),
  };
}

/**
 * Drop tombstones that every device has had ample time to see, and payments
 * orphaned by an entry that is gone for good. Without this the ledger only
 * ever grows, and it is the same blob on every sync.
 */
export function pruneLedger(ledger: Ledger, now: Date = new Date()): Ledger {
  const cutoff = new Date(now.getTime() - TOMBSTONE_DAYS * 86_400_000).toISOString();

  const entries = ledger.entries.filter(
    (entry) => !entry.deletedAt || entry.deletedAt > cutoff,
  );
  const liveEntryIds = new Set(entries.map((entry) => entry.id));

  const payments = ledger.payments.filter((payment) => {
    if (!liveEntryIds.has(payment.entryId)) return false;
    return !payment.deletedAt || payment.deletedAt > cutoff;
  });

  return { entries, payments };
}

export function emptyLedger(): Ledger {
  return { entries: [], payments: [] };
}

/** Records a person would actually see — tombstones filtered out. */
export function liveLedger(ledger: Ledger): Ledger {
  return {
    entries: ledger.entries.filter((entry) => !entry.deletedAt),
    payments: ledger.payments.filter((payment) => !payment.deletedAt),
  };
}

function isRecordShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Accept a ledger from somewhere untrusted — an import file, or the sync
 * endpoint's request body. Anything malformed is dropped rather than rejecting
 * the whole payload, so one bad row cannot lock a person out of their data.
 */
export function sanitiseLedger(value: unknown): Ledger {
  if (!isRecordShape(value)) return emptyLedger();
  const rawEntries = Array.isArray(value.entries) ? value.entries : [];
  const rawPayments = Array.isArray(value.payments) ? value.payments : [];

  const entries: Entry[] = [];
  for (const candidate of rawEntries) {
    const entry = sanitiseEntry(candidate);
    if (entry) entries.push(entry);
  }

  const payments: Payment[] = [];
  for (const candidate of rawPayments) {
    const payment = sanitisePayment(candidate);
    if (payment) payments.push(payment);
  }

  return { entries, payments };
}

const MAX_TEXT = 200;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT) : fallback;
}

function cents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value);
}

function timestamp(value: unknown): string {
  return typeof value === "string" && value ? value.slice(0, 40) : new Date(0).toISOString();
}

function sanitiseEntry(value: unknown): Entry | null {
  if (!isRecordShape(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  const kind = value.kind === "income" ? "income" : "expense";
  const repeat =
    value.repeat === "weekly" || value.repeat === "monthly" || value.repeat === "yearly"
      ? value.repeat
      : "none";
  const repeatCount =
    typeof value.repeatCount === "number" && Number.isFinite(value.repeatCount)
      ? Math.max(1, Math.round(value.repeatCount))
      : null;

  return {
    id: value.id.slice(0, 64),
    kind,
    description: text(value.description),
    amount: cents(value.amount),
    dueDate: text(value.dueDate, "1970-01-01").slice(0, 10),
    repeat,
    repeatCount,
    category: text(value.category),
    note: text(value.note),
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt.slice(0, 40) : null,
  };
}

function sanitisePayment(value: unknown): Payment | null {
  if (!isRecordShape(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.entryId !== "string" || !value.entryId) return null;

  return {
    id: value.id.slice(0, 140),
    entryId: value.entryId.slice(0, 64),
    occurrence: text(value.occurrence, "1970-01-01").slice(0, 10),
    paidOn: text(value.paidOn, "1970-01-01").slice(0, 10),
    amount: cents(value.amount),
    updatedAt: timestamp(value.updatedAt),
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt.slice(0, 40) : null,
  };
}
