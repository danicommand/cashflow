/**
 * Every change the app makes to the ledger.
 *
 * All of it is pure: each function takes a ledger and returns a new one, and
 * every write stamps `updatedAt`, because that timestamp is what the sync
 * merge arbitrates on. Mutating a record in place would leave two devices
 * unable to tell which version is newer.
 */

import type { Entry, EntryKind, Ledger, Payment, Repeat } from "../types.ts";
import { occurrenceKey } from "./occurrences.ts";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface EntryDraft {
  kind: EntryKind;
  description: string;
  amount: number;
  dueDate: string;
  repeat: Repeat;
  repeatCount: number | null;
  category: string;
  note: string;
}

export function blankDraft(kind: EntryKind, dueDate: string): EntryDraft {
  return {
    kind,
    description: "",
    amount: 0,
    dueDate,
    repeat: kind === "income" ? "monthly" : "none",
    repeatCount: null,
    category: "",
    note: "",
  };
}

export function draftFrom(entry: Entry): EntryDraft {
  return {
    kind: entry.kind,
    description: entry.description,
    amount: entry.amount,
    dueDate: entry.dueDate,
    repeat: entry.repeat,
    repeatCount: entry.repeatCount,
    category: entry.category,
    note: entry.note,
  };
}

function normalise(draft: EntryDraft): EntryDraft {
  return {
    ...draft,
    description: draft.description.trim(),
    category: draft.category.trim(),
    note: draft.note.trim(),
    // A repeat count only means something for a repeating entry, and letting a
    // stale count survive a switch back to "one time" would silently cap a
    // later switch back to monthly.
    repeatCount: draft.repeat === "none" ? null : draft.repeatCount,
  };
}

export function addEntry(ledger: Ledger, draft: EntryDraft, now = new Date()): Ledger {
  const stamp = now.toISOString();
  const entry: Entry = {
    id: newId(),
    ...normalise(draft),
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  return { ...ledger, entries: [...ledger.entries, entry] };
}

export function updateEntry(
  ledger: Ledger,
  entryId: string,
  draft: EntryDraft,
  now = new Date(),
): Ledger {
  const stamp = now.toISOString();
  return {
    ...ledger,
    entries: ledger.entries.map((entry) =>
      entry.id === entryId ? { ...entry, ...normalise(draft), updatedAt: stamp } : entry,
    ),
  };
}

/**
 * Soft-delete an entry and everything recorded against it. The payments have
 * to be tombstoned too: leaving them behind would let a device that still has
 * the entry re-attach a settled state to a bill that no longer exists.
 */
export function deleteEntry(ledger: Ledger, entryId: string, now = new Date()): Ledger {
  const stamp = now.toISOString();
  return {
    entries: ledger.entries.map((entry) =>
      entry.id === entryId ? { ...entry, deletedAt: stamp, updatedAt: stamp } : entry,
    ),
    payments: ledger.payments.map((payment) =>
      payment.entryId === entryId && !payment.deletedAt
        ? { ...payment, deletedAt: stamp, updatedAt: stamp }
        : payment,
    ),
  };
}

/**
 * Record a settlement for one occurrence, replacing any earlier one.
 *
 * The payment id is derived from the entry and the occurrence rather than
 * random, so two devices ticking off the same bill while offline produce the
 * same record and the merge resolves it to one payment instead of two.
 */
export function settleOccurrence(
  ledger: Ledger,
  entryId: string,
  occurrence: string,
  amount: number,
  paidOn: string,
  now = new Date(),
): Ledger {
  const stamp = now.toISOString();
  const id = occurrenceKey(entryId, occurrence);
  const existing = ledger.payments.find((payment) => payment.id === id);

  const payment: Payment = {
    id,
    entryId,
    occurrence,
    paidOn,
    amount,
    updatedAt: stamp,
    deletedAt: null,
  };

  return {
    ...ledger,
    payments: existing
      ? ledger.payments.map((current) => (current.id === id ? payment : current))
      : [...ledger.payments, payment],
  };
}

/** Undo a settlement, putting the occurrence back into what is still owed. */
export function unsettleOccurrence(
  ledger: Ledger,
  entryId: string,
  occurrence: string,
  now = new Date(),
): Ledger {
  const stamp = now.toISOString();
  const id = occurrenceKey(entryId, occurrence);
  return {
    ...ledger,
    payments: ledger.payments.map((payment) =>
      payment.id === id ? { ...payment, deletedAt: stamp, updatedAt: stamp } : payment,
    ),
  };
}

/** Existing category names, for the suggestion list on the form. */
export function knownCategories(ledger: Ledger): string[] {
  const seen = new Set<string>();
  for (const entry of ledger.entries) {
    if (entry.deletedAt) continue;
    const category = entry.category.trim();
    if (category) seen.add(category);
  }
  return [...seen].toSorted((a, b) => a.localeCompare(b));
}
