/**
 * Expanding entries into dated occurrences.
 *
 * A recurring bill is stored once. The month you are looking at decides which
 * instances of it exist, and they are computed rather than stored — so editing
 * "rent" changes every month at once, and no background job has to roll the
 * ledger forward when a month ticks over.
 *
 * The expansion is bounded by arithmetic, never by looping forward from the
 * start date: a bill that began in 2015 costs the same to draw as one that
 * began last week.
 */

import type { Entry, Occurrence, Payment, Skip } from "../types.ts";
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  firstDayOfMonth,
  monthKey,
  monthsBetween,
  parseMonthKey,
  toIso,
} from "./dates.ts";

export function isLive<T extends { deletedAt?: string | null }>(record: T): boolean {
  return !record.deletedAt;
}

/** `entryId|YYYY-MM-DD` — the identity of a single instance. */
export function occurrenceKey(entryId: string, date: string): string {
  return `${entryId}|${date}`;
}

/**
 * Index payments so occurrence lookup is a map hit rather than a scan. When two
 * payments somehow claim the same occurrence, the most recently updated wins,
 * which is the same rule the sync merge uses.
 */
export function indexPayments(payments: Payment[]): Map<string, Payment> {
  const index = new Map<string, Payment>();
  for (const payment of payments) {
    if (!isLive(payment)) continue;
    const key = occurrenceKey(payment.entryId, payment.occurrence);
    const existing = index.get(key);
    if (!existing || payment.updatedAt > existing.updatedAt) index.set(key, payment);
  }
  return index;
}

/** Same idea as `indexPayments`, for the deliberately-skipped set. */
export function indexSkips(skips: Skip[]): Set<string> {
  const live = new Set<string>();
  for (const skip of skips) {
    if (isLive(skip)) live.add(skip.id);
  }
  return live;
}

function withinCount(entry: Entry, index: number): boolean {
  if (index < 0) return false;
  if (entry.repeatCount === null) return true;
  return index < entry.repeatCount;
}

/** Every instance of one entry that lands inside `YYYY-MM`. */
function datesForEntryInMonth(entry: Entry, month: string): { date: string; index: number }[] {
  const entryMonth = monthKey(entry.dueDate);

  if (entry.repeat === "none") {
    return entryMonth === month ? [{ date: entry.dueDate, index: 0 }] : [];
  }

  if (entry.repeat === "monthly") {
    const index = monthsBetween(entryMonth, month);
    if (!withinCount(entry, index)) return [];
    return [{ date: addMonths(entry.dueDate, index), index }];
  }

  if (entry.repeat === "yearly") {
    const gap = monthsBetween(entryMonth, month);
    if (gap % 12 !== 0) return [];
    const index = gap / 12;
    if (!withinCount(entry, index)) return [];
    return [{ date: addMonths(entry.dueDate, index * 12), index }];
  }

  // Weekly does not line up with month boundaries, so walk the month's days.
  // At most 31 iterations, and only for entries that started early enough.
  const { year, month: monthNumber } = parseMonthKey(month);
  const total = daysInMonth(year, monthNumber);
  const dates: { date: string; index: number }[] = [];
  for (let day = 1; day <= total; day += 1) {
    const date = toIso(year, monthNumber, day);
    const offset = daysBetween(entry.dueDate, date);
    if (offset < 0 || offset % 7 !== 0) continue;
    const index = offset / 7;
    if (!withinCount(entry, index)) continue;
    dates.push({ date, index });
  }
  return dates;
}

function buildOccurrence(
  entry: Entry,
  date: string,
  index: number,
  paymentIndex: Map<string, Payment>,
  skipIndex: Set<string>,
): Occurrence {
  const key = occurrenceKey(entry.id, date);
  return {
    key,
    entry,
    date,
    index,
    amount: entry.amount,
    payment: paymentIndex.get(key) ?? null,
    skipped: skipIndex.has(key),
  };
}

/** Every occurrence in `YYYY-MM`, sorted by date then description. */
export function occurrencesInMonth(
  entries: Entry[],
  payments: Payment[],
  skips: Skip[],
  month: string,
): Occurrence[] {
  const paymentIndex = indexPayments(payments);
  const skipIndex = indexSkips(skips);
  const occurrences: Occurrence[] = [];
  for (const entry of entries) {
    if (!isLive(entry)) continue;
    for (const { date, index } of datesForEntryInMonth(entry, month)) {
      occurrences.push(buildOccurrence(entry, date, index, paymentIndex, skipIndex));
    }
  }
  return sortOccurrences(occurrences);
}

/** Every occurrence between two dates, both ends included. */
export function occurrencesInRange(
  entries: Entry[],
  payments: Payment[],
  skips: Skip[],
  from: string,
  to: string,
): Occurrence[] {
  if (from > to) return [];
  const months: string[] = [];
  let cursor = monthKey(from);
  const lastMonth = monthKey(to);
  // Guard against a runaway range; five years of months is far more than any
  // view asks for and keeps a bad input from spinning.
  for (let step = 0; step <= 60 && cursor <= lastMonth; step += 1) {
    months.push(cursor);
    cursor = monthKey(addMonths(firstDayOfMonth(cursor), 1));
  }

  const paymentIndex = indexPayments(payments);
  const skipIndex = indexSkips(skips);
  const occurrences: Occurrence[] = [];
  for (const entry of entries) {
    if (!isLive(entry)) continue;
    for (const month of months) {
      for (const { date, index } of datesForEntryInMonth(entry, month)) {
        if (date < from || date > to) continue;
        occurrences.push(buildOccurrence(entry, date, index, paymentIndex, skipIndex));
      }
    }
  }
  return sortOccurrences(occurrences);
}

/** Unsettled, unskipped expenses from `today` forward, nearest first. */
export function upcomingExpenses(
  entries: Entry[],
  payments: Payment[],
  skips: Skip[],
  today: string,
  days: number,
): Occurrence[] {
  return occurrencesInRange(entries, payments, skips, today, addDays(today, days)).filter(
    (occurrence) => occurrence.entry.kind === "expense" && !occurrence.payment && !occurrence.skipped,
  );
}

/** Unsettled, unskipped expenses whose date has already passed, oldest first. */
export function overdueExpenses(
  entries: Entry[],
  payments: Payment[],
  skips: Skip[],
  today: string,
  lookbackDays = 365,
): Occurrence[] {
  const from = addDays(today, -lookbackDays);
  return occurrencesInRange(entries, payments, skips, from, addDays(today, -1)).filter(
    (occurrence) => occurrence.entry.kind === "expense" && !occurrence.payment && !occurrence.skipped,
  );
}

export function sortOccurrences(occurrences: Occurrence[]): Occurrence[] {
  return occurrences.toSorted((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.entry.description.localeCompare(b.entry.description);
  });
}

/** Group occurrences by their date, in date order, for a day-by-day list. */
export function groupByDate(occurrences: Occurrence[]): { date: string; items: Occurrence[] }[] {
  const groups = new Map<string, Occurrence[]>();
  for (const occurrence of sortOccurrences(occurrences)) {
    const bucket = groups.get(occurrence.date);
    if (bucket) bucket.push(occurrence);
    else groups.set(occurrence.date, [occurrence]);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
}
