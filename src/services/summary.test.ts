import { describe, expect, it } from "vitest";

import type { Entry, Occurrence, Payment } from "../types.ts";
import { paidProgress, summarise, totalsByCategory, totalsByDay } from "./summary.ts";

function occurrence(
  overrides: Partial<Entry> & { date?: string; paid?: Partial<Payment> | null } = {},
): Occurrence {
  const { date = "2026-01-10", paid = null, ...entryFields } = overrides;
  const entry: Entry = {
    id: "e1",
    kind: "expense",
    description: "Bill",
    amount: 10_000,
    dueDate: date,
    repeat: "none",
    repeatCount: null,
    category: "",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...entryFields,
  };
  return {
    key: `${entry.id}|${date}`,
    entry,
    date,
    index: 0,
    amount: entry.amount,
    payment: paid
      ? {
          id: `${entry.id}|${date}`,
          entryId: entry.id,
          occurrence: date,
          paidOn: date,
          amount: entry.amount,
          updatedAt: "2026-01-10T00:00:00.000Z",
          deletedAt: null,
          ...paid,
        }
      : null,
  };
}

describe("summarise", () => {
  it("is all zeroes for an empty month", () => {
    const summary = summarise([], "2026-01-15");
    expect(summary.expenseTotal).toBe(0);
    expect(summary.remainingTotal).toBe(0);
    expect(summary.netActual).toBe(0);
  });

  it("splits what is billed into paid and still owed", () => {
    const summary = summarise(
      [
        occurrence({ id: "a", amount: 10_000, paid: {} }),
        occurrence({ id: "b", amount: 25_000 }),
      ],
      "2026-01-15",
    );
    expect(summary.expenseTotal).toBe(35_000);
    expect(summary.paidTotal).toBe(10_000);
    expect(summary.remainingTotal).toBe(25_000);
  });

  it("counts what actually moved, not what was planned", () => {
    // A 1200 bill settled for 1180 leaves the month 20 better off. Using the
    // billed amount here would quietly hide every discount and every overpay.
    const summary = summarise(
      [occurrence({ amount: 120_000, paid: { amount: 118_000 } })],
      "2026-01-15",
    );
    expect(summary.expenseTotal).toBe(120_000);
    expect(summary.paidTotal).toBe(118_000);
    expect(summary.remainingTotal).toBe(0);
  });

  it("separates what is late from what is still ahead", () => {
    const summary = summarise(
      [
        occurrence({ id: "a", date: "2026-01-05", amount: 5_000 }),
        occurrence({ id: "b", date: "2026-01-25", amount: 7_000 }),
      ],
      "2026-01-15",
    );
    expect(summary.overdueTotal).toBe(5_000);
    expect(summary.dueLaterTotal).toBe(7_000);
    expect(summary.overdueTotal + summary.dueLaterTotal).toBe(summary.remainingTotal);
  });

  it("does not call a settled bill overdue", () => {
    const summary = summarise(
      [occurrence({ date: "2026-01-05", paid: {} })],
      "2026-01-15",
    );
    expect(summary.overdueTotal).toBe(0);
  });

  it("never treats income as something to pay", () => {
    const summary = summarise(
      [
        occurrence({ id: "a", kind: "income", amount: 300_000, date: "2026-01-05" }),
        occurrence({ id: "b", amount: 100_000 }),
      ],
      "2026-01-15",
    );
    expect(summary.remainingTotal).toBe(100_000);
    expect(summary.incomeTotal).toBe(300_000);
    expect(summary.incomeRemaining).toBe(300_000);
  });

  it("reports both the planned and the realised balance", () => {
    const summary = summarise(
      [
        occurrence({ id: "a", kind: "income", amount: 300_000, paid: { amount: 300_000 } }),
        occurrence({ id: "b", amount: 100_000, paid: { amount: 100_000 } }),
        occurrence({ id: "c", amount: 50_000 }),
      ],
      "2026-01-15",
    );
    expect(summary.netExpected).toBe(150_000);
    expect(summary.netActual).toBe(200_000);
  });

  it("counts how many of each kind are settled", () => {
    const summary = summarise(
      [
        occurrence({ id: "a", paid: {} }),
        occurrence({ id: "b" }),
        occurrence({ id: "c", kind: "income", paid: {} }),
      ],
      "2026-01-15",
    );
    expect(summary.counts).toEqual({
      expenses: 2,
      expensesPaid: 1,
      incomes: 1,
      incomesReceived: 1,
    });
  });
});

describe("paidProgress", () => {
  it("reads an empty month as done rather than as zero progress", () => {
    expect(paidProgress(summarise([], "2026-01-15"))).toBe(1);
  });

  it("tracks the share of the month that is settled", () => {
    const summary = summarise(
      [occurrence({ id: "a", amount: 7_500, paid: {} }), occurrence({ id: "b", amount: 2_500 })],
      "2026-01-15",
    );
    expect(paidProgress(summary)).toBeCloseTo(0.75);
  });
});

describe("totalsByDay", () => {
  it("keeps unpaid apart from settled on the same day", () => {
    const byDay = totalsByDay([
      occurrence({ id: "a", date: "2026-01-05", amount: 3_000 }),
      occurrence({ id: "b", date: "2026-01-05", amount: 2_000, paid: {} }),
      occurrence({ id: "c", date: "2026-01-05", amount: 9_000, kind: "income" }),
    ]);
    const day = byDay.get("2026-01-05");
    expect(day).toEqual({ expense: 5_000, income: 9_000, unpaidExpense: 3_000, count: 3 });
  });
});

describe("totalsByCategory", () => {
  it("ranks categories by size and gives each its share", () => {
    const buckets = totalsByCategory([
      occurrence({ id: "a", category: "Home", amount: 60_000 }),
      occurrence({ id: "b", category: "Car", amount: 30_000 }),
      occurrence({ id: "c", category: "Home", amount: 10_000 }),
    ]);
    expect(buckets.map((bucket) => bucket.category)).toEqual(["Home", "Car"]);
    expect(buckets[0].total).toBe(70_000);
    expect(buckets[0].share).toBeCloseTo(0.7);
  });

  it("leaves income out of the breakdown", () => {
    const buckets = totalsByCategory([
      occurrence({ id: "a", category: "Pay", amount: 500_000, kind: "income" }),
    ]);
    expect(buckets).toEqual([]);
  });
});
