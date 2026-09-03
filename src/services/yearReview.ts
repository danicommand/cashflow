/**
 * The year, at the same grain the trend chart uses for a month — just twelve
 * of them instead of six, and summed rather than kept as separate points.
 *
 * No new arithmetic: this calls the same `occurrencesInMonth` → `summarise`
 * pipeline the month view and the trend chart already run, twelve times, and
 * folds the results together. There is nothing about a year that is not
 * already knowable from its twelve months.
 */

import type { Entry, Payment, Skip } from "../types.ts";
import { occurrencesInMonth } from "./occurrences.ts";
import { summarise, totalsByCategory } from "./summary.ts";

export interface YearReview {
  year: number;
  paidTotal: number;
  receivedTotal: number;
  net: number;
  /** Twelve points, January first, for a small month-by-month chart. */
  monthlyPaid: number[];
  topCategory: { category: string; total: number } | null;
}

export function yearSummary(
  entries: Entry[],
  payments: Payment[],
  skips: Skip[],
  year: number,
  today: string,
): YearReview {
  let paidTotal = 0;
  let receivedTotal = 0;
  const monthlyPaid: number[] = [];
  const categoryTotals = new Map<string, number>();

  for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
    const month = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const occurrences = occurrencesInMonth(entries, payments, skips, month);
    const monthSummary = summarise(occurrences, today);

    paidTotal += monthSummary.paidTotal;
    receivedTotal += monthSummary.receivedTotal;
    monthlyPaid.push(monthSummary.paidTotal);

    // `.paid`, not `.total` — the category breakdown otherwise counts an
    // unpaid bill's full billed amount every month it recurs, which would
    // make an entirely unpaid subscription "the biggest category of the
    // year" ahead of everything a person actually spent money on.
    for (const bucket of totalsByCategory(occurrences)) {
      const previous = categoryTotals.get(bucket.category) ?? 0;
      categoryTotals.set(bucket.category, previous + bucket.paid);
    }
  }

  let topCategory: YearReview["topCategory"] = null;
  for (const [category, total] of categoryTotals) {
    // Blank means uncategorised, and zero means nothing was actually paid in
    // it — a category with no real spending is not "the biggest" of anything.
    if (!category || total <= 0) continue;
    if (!topCategory || total > topCategory.total) topCategory = { category, total };
  }

  return {
    year,
    paidTotal,
    receivedTotal,
    net: receivedTotal - paidTotal,
    monthlyPaid,
    topCategory,
  };
}
