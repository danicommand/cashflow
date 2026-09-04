/**
 * The whole data model. Two record types, both synced, both soft-deleted.
 *
 * `Entry` is the *rule* — "rent, 1200, due on the 5th, every month". It is
 * written once and never duplicated per month.
 *
 * `Payment` is the *fact* — "the rent occurrence dated 2026-09-05 was paid on
 * the 4th, and 1180 actually left the account". Keeping the two apart is what
 * lets a recurring bill stay a single row while every month still remembers
 * its own state.
 */

export type EntryKind = "expense" | "income";

export type Repeat = "none" | "weekly" | "monthly" | "yearly";

/** Fields every synced record carries, so one merge routine handles both. */
export interface SyncedRecord {
  id: string;
  /** ISO timestamp of the last local change. Drives last-write-wins merges. */
  updatedAt: string;
  /** ISO timestamp; set instead of removing the row, so deletes propagate. */
  deletedAt?: string | null;
}

export interface Entry extends SyncedRecord {
  kind: EntryKind;
  description: string;
  /** Integer minor units (cents). Never a float. */
  amount: number;
  /** First occurrence, `YYYY-MM-DD`. */
  dueDate: string;
  repeat: Repeat;
  /**
   * How many occurrences in total, counting the first. `null` means it runs
   * forever — a salary or a subscription. A number is an instalment plan.
   */
  repeatCount: number | null;
  category: string;
  note: string;
  createdAt: string;
}

export interface Payment extends SyncedRecord {
  entryId: string;
  /** Which occurrence was settled, `YYYY-MM-DD`. */
  occurrence: string;
  /** When it was actually settled, `YYYY-MM-DD`. */
  paidOn: string;
  /** What actually moved, in cents. May differ from the entry's amount. */
  amount: number;
}

/**
 * A monthly spending cap for one category. Matched to `Entry.category` by
 * exact string, the same way category chips and the "Where it goes"
 * breakdown already do — there is no separate category table to keep in
 * sync with it.
 */
export interface Budget extends SyncedRecord {
  category: string;
  /** Cents per month. */
  limit: number;
}

/**
 * "This one instance doesn't happen" — a subscription paused for a month, a
 * bill waived, a one-off that turned out not to apply. Deliberately its own
 * record rather than a zero-amount `Payment`: no money moved, so it must
 * never be counted as paid, and it needs its own identity to be undone,
 * which a payment of 0 would blur into "settled for nothing."
 */
export interface Skip extends SyncedRecord {
  entryId: string;
  /** Which occurrence is skipped, `YYYY-MM-DD`. */
  occurrence: string;
}

/** Everything the app owns, and the unit that gets synced. */
export interface Ledger {
  entries: Entry[];
  payments: Payment[];
  budgets: Budget[];
  skips: Skip[];
}

export type Language = "en" | "pt";

export type CurrencyCode = "USD" | "BRL" | "EUR" | "GBP";

export type ThemePreference = "system" | "light" | "dark";

export const DASHBOARD_PRIORITIES = [
  "leftToPay",
  "balance",
  "overdue",
  "dueLater",
  "received",
] as const;

export type DashboardPriority = (typeof DASHBOARD_PRIORITIES)[number];

export interface Settings {
  language: Language;
  currency: CurrencyCode;
  theme: ThemePreference;
  /** The personal sync code. Empty means sync is off. */
  syncCode: string;
  /** The metric promoted to the large dashboard figure. */
  dashboardPriority: DashboardPriority;
}

/** One dated instance of an entry, produced on the fly for a given month. */
export interface Occurrence {
  /** Stable across renders and unique: `entryId|YYYY-MM-DD`. */
  key: string;
  entry: Entry;
  date: string;
  /** 0 for the first occurrence, 1 for the next, and so on. */
  index: number;
  /** What is owed or expected for this instance, in cents. */
  amount: number;
  /** The settlement, when there is one. */
  payment: Payment | null;
  /** True when this instance was deliberately skipped rather than paid. */
  skipped: boolean;
}
