/**
 * The month's arithmetic — the number people actually open the app for:
 * "how much is still left to pay?"
 *
 * Every total is in cents, so nothing here can drift the way summing floats
 * does. `paid` uses the amount that actually moved, not the amount that was
 * billed, because paying 1180 on a 1200 bill should leave the month 20 better
 * off rather than silently rounding to the plan.
 */

import type { Entry, Occurrence, Payment } from "../types.ts";

export interface MonthSummary {
  /** Everything billed this month, settled or not. */
  expenseTotal: number;
  /** What actually left the account, using real paid amounts. */
  paidTotal: number;
  /** Still owed: the billed amount of every unsettled expense. */
  remainingTotal: number;
  /** The slice of `remainingTotal` whose date has already passed. */
  overdueTotal: number;
  /** The slice of `remainingTotal` still ahead of today. */
  dueLaterTotal: number;
  incomeTotal: number;
  receivedTotal: number;
  incomeRemaining: number;
  /** Income minus expenses if everything lands as planned. */
  netExpected: number;
  /** What has actually happened so far: received minus paid. */
  netActual: number;
  counts: {
    expenses: number;
    expensesPaid: number;
    incomes: number;
    incomesReceived: number;
  };
}

const EMPTY: MonthSummary = {
  expenseTotal: 0,
  paidTotal: 0,
  remainingTotal: 0,
  overdueTotal: 0,
  dueLaterTotal: 0,
  incomeTotal: 0,
  receivedTotal: 0,
  incomeRemaining: 0,
  netExpected: 0,
  netActual: 0,
  counts: { expenses: 0, expensesPaid: 0, incomes: 0, incomesReceived: 0 },
};

/**
 * `today` decides only what counts as overdue. Pass the real today even when
 * looking at another month: a past month is then entirely overdue and a future
 * month entirely "due later", which is what both actually mean.
 */
export function summarise(occurrences: Occurrence[], today: string): MonthSummary {
  const summary: MonthSummary = { ...EMPTY, counts: { ...EMPTY.counts } };

  for (const occurrence of occurrences) {
    // A skipped occurrence is not owed and not received — it is not part of
    // this cycle at all, the same as if the entry had no occurrence here.
    // It still exists for a caller that wants to *show* it (as "skipped",
    // distinct from paid), just not for any of these totals.
    if (occurrence.skipped) continue;
    const settled = occurrence.payment;
    if (occurrence.entry.kind === "expense") {
      summary.expenseTotal += occurrence.amount;
      summary.counts.expenses += 1;
      if (settled) {
        summary.paidTotal += settled.amount;
        summary.counts.expensesPaid += 1;
      } else {
        summary.remainingTotal += occurrence.amount;
        if (occurrence.date < today) summary.overdueTotal += occurrence.amount;
        else summary.dueLaterTotal += occurrence.amount;
      }
    } else {
      summary.incomeTotal += occurrence.amount;
      summary.counts.incomes += 1;
      if (settled) {
        summary.receivedTotal += settled.amount;
        summary.counts.incomesReceived += 1;
      } else {
        summary.incomeRemaining += occurrence.amount;
      }
    }
  }

  summary.netExpected = summary.incomeTotal - summary.expenseTotal;
  summary.netActual = summary.receivedTotal - summary.paidTotal;
  return summary;
}

/** 0-1, how much of the month's bills are settled. Empty months read as done. */
export function paidProgress(summary: MonthSummary): number {
  if (summary.expenseTotal <= 0) return 1;
  const settled = summary.expenseTotal - summary.remainingTotal;
  return Math.min(1, Math.max(0, settled / summary.expenseTotal));
}

export interface DayTotals {
  expense: number;
  income: number;
  unpaidExpense: number;
  count: number;
}

/** Per-day rollup keyed by `YYYY-MM-DD`, for marking up the calendar grid. */
export function totalsByDay(occurrences: Occurrence[]): Map<string, DayTotals> {
  const byDay = new Map<string, DayTotals>();
  for (const occurrence of occurrences) {
    if (occurrence.skipped) continue;
    const totals = byDay.get(occurrence.date) ?? {
      expense: 0,
      income: 0,
      unpaidExpense: 0,
      count: 0,
    };
    totals.count += 1;
    if (occurrence.entry.kind === "expense") {
      totals.expense += occurrence.amount;
      if (!occurrence.payment) totals.unpaidExpense += occurrence.amount;
    } else {
      totals.income += occurrence.amount;
    }
    byDay.set(occurrence.date, totals);
  }
  return byDay;
}

export interface CategoryTotal {
  category: string;
  total: number;
  paid: number;
  share: number;
}

/** Expense breakdown by category, biggest first. */
export function totalsByCategory(occurrences: Occurrence[]): CategoryTotal[] {
  const byCategory = new Map<string, { total: number; paid: number }>();
  let grandTotal = 0;

  for (const occurrence of occurrences) {
    if (occurrence.entry.kind !== "expense") continue;
    if (occurrence.skipped) continue;
    const key = occurrence.entry.category.trim() || "";
    const bucket = byCategory.get(key) ?? { total: 0, paid: 0 };
    bucket.total += occurrence.amount;
    if (occurrence.payment) bucket.paid += occurrence.payment.amount;
    byCategory.set(key, bucket);
    grandTotal += occurrence.amount;
  }

  return [...byCategory.entries()]
    .map(([category, bucket]) => ({
      category,
      total: bucket.total,
      paid: bucket.paid,
      share: grandTotal > 0 ? bucket.total / grandTotal : 0,
    }))
    .toSorted((a, b) => b.total - a.total);
}

/**
 * The running cash balance: every settled payment ever made, income minus
 * expense, up to and including `throughDate` — regardless of which month its
 * bill was due in.
 *
 * This is deliberately not derived from a month's occurrences. A month view
 * only shows the bills *due* in that month, but money moves on the day it was
 * actually paid, which can land in a different month (a bill due August 30,
 * settled September 2, spends September's cash, not August's). Keying off
 * `payment.paidOn` instead of the occurrence's due date is what makes this a
 * real running balance rather than the same per-month total renamed.
 *
 * `paidOn` is a plain string, so the comparison is exact only when both sides
 * are `YYYY-MM-DD` — which every date in this app already is.
 */
export function runningBalance(
  entries: Entry[],
  payments: Payment[],
  throughDate: string,
): number {
  const kindOf = new Map<string, Entry["kind"]>();
  for (const entry of entries) {
    if (!entry.deletedAt) kindOf.set(entry.id, entry.kind);
  }

  let total = 0;
  for (const payment of payments) {
    if (payment.deletedAt) continue;
    if (payment.paidOn > throughDate) continue;
    const kind = kindOf.get(payment.entryId);
    // A payment whose entry is gone is not counted — the same rule
    // `pruneLedger` uses when it drops those payments outright.
    if (!kind) continue;
    total += kind === "income" ? payment.amount : -payment.amount;
  }
  return total;
}
