/**
 * A short trailing window of a person's own spending history.
 *
 * The month view answers "how is this month going", but that question is
 * hard to judge in isolation — R$1,200 spent by the 10th means something
 * different if last month's total by then was R$800 than if it was R$1,500.
 * This gives the chart that comparison without asking anyone to click back
 * through the calendar by hand.
 */

import type { Entry, Payment, Skip } from "../types.ts";
import { shiftMonthKey } from "./dates.ts";
import { occurrencesInMonth } from "./occurrences.ts";
import { summarise } from "./summary.ts";

export interface MonthSpend {
  month: string;
  /** What actually left the account that month — real paid amounts, not the plan. */
  paidTotal: number;
}

/**
 * `count` months ending at and including `throughMonth`, oldest first — the
 * order a bar chart reads left to right.
 */
export function spendHistory(
  entries: Entry[],
  payments: Payment[],
  skips: Skip[],
  throughMonth: string,
  today: string,
  count: number,
): MonthSpend[] {
  const months: string[] = [];
  let cursor = throughMonth;
  for (let step = 0; step < count; step += 1) {
    months.unshift(cursor);
    cursor = shiftMonthKey(cursor, -1);
  }

  return months.map((month) => {
    const occurrences = occurrencesInMonth(entries, payments, skips, month);
    return { month, paidTotal: summarise(occurrences, today).paidTotal };
  });
}
