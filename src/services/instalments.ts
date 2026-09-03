/**
 * How far along an instalment plan is.
 *
 * `repeatCount` already caps how many occurrences a limited-repeat entry
 * produces, and each occurrence already shows "5 of 12". What is missing is
 * the money version of the same fact: how much of the plan's total is left,
 * not just how many payments. That is answerable from the entry and its
 * payments alone — no occurrence expansion needed, since the count and the
 * per-instalment amount are already known from the entry itself.
 */

import type { Entry, Payment } from "../types.ts";

export interface InstalmentProgress {
  paidCount: number;
  totalCount: number;
  paidAmount: number;
  totalAmount: number;
  remainingAmount: number;
}

/**
 * `null` for anything that is not a limited-count repeat — a one-time bill
 * or an open-ended subscription has no "total" to measure progress against.
 */
export function instalmentProgress(
  entry: Entry,
  payments: Payment[],
): InstalmentProgress | null {
  if (entry.repeat === "none" || entry.repeatCount === null) return null;

  const settled = payments.filter(
    (payment) => payment.entryId === entry.id && !payment.deletedAt,
  );
  const paidAmount = settled.reduce((sum, payment) => sum + payment.amount, 0);
  const totalAmount = entry.amount * entry.repeatCount;

  return {
    paidCount: settled.length,
    totalCount: entry.repeatCount,
    paidAmount,
    totalAmount,
    remainingAmount: Math.max(0, totalAmount - paidAmount),
  };
}
