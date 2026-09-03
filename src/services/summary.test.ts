import { describe, expect, it } from "vitest";

import type { Entry, Occurrence, Payment } from "../types.ts";
import { paidProgress, runningBalance, summarise, totalsByCategory, totalsByDay } from "./summary.ts";

function ledgerEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    kind: "expense",
    description: "Bill",
    amount: 10_000,
    dueDate: "2026-01-10",
    repeat: "none",
    repeatCount: null,
    category: "",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function ledgerPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "e1|2026-01-10",
    entryId: "e1",
    occurrence: "2026-01-10",
    paidOn: "2026-01-10",
    amount: 10_000,
    updatedAt: "2026-01-10T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

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

describe("runningBalance", () => {
  it("is zero with nothing settled", () => {
    expect(runningBalance([ledgerEntry()], [], "2026-01-31")).toBe(0);
  });

  it("carries a surplus from one month into the next", () => {
    // This is the whole point: a balance that only looked at one month's
    // occurrences would forget August's leftover the moment September opens.
    const entries = [
      ledgerEntry({ id: "salary", kind: "income" }),
      ledgerEntry({ id: "rent" }),
    ];
    const payments = [
      ledgerPayment({ id: "p1", entryId: "salary", paidOn: "2026-08-05", amount: 300_000 }),
      ledgerPayment({ id: "p2", entryId: "rent", paidOn: "2026-08-05", amount: 120_000 }),
    ];
    expect(runningBalance(entries, payments, "2026-08-31")).toBe(180_000);
    // September has no payments of its own yet; the surplus is still there.
    expect(runningBalance(entries, payments, "2026-09-30")).toBe(180_000);
  });

  it("keys off when money actually moved, not the bill's due date", () => {
    // A bill due August 30 but paid September 2 spends September's cash.
    const entries = [ledgerEntry({ id: "power", dueDate: "2026-08-30" })];
    const payments = [
      ledgerPayment({ id: "p1", entryId: "power", occurrence: "2026-08-30", paidOn: "2026-09-02", amount: 8_000 }),
    ];
    expect(runningBalance(entries, payments, "2026-08-31")).toBe(0);
    expect(runningBalance(entries, payments, "2026-09-30")).toBe(-8_000);
  });

  it("includes a payment made exactly on the cutoff date, not just before it", () => {
    const entries = [ledgerEntry({ id: "power" })];
    const payments = [ledgerPayment({ entryId: "power", paidOn: "2026-01-15", amount: 5_000 })];
    expect(runningBalance(entries, payments, "2026-01-14")).toBe(0);
    expect(runningBalance(entries, payments, "2026-01-15")).toBe(-5_000);
  });

  it("ignores a deleted payment", () => {
    const entries = [ledgerEntry({ id: "power" })];
    const payments = [
      ledgerPayment({ entryId: "power", amount: 5_000, deletedAt: "2026-01-11T00:00:00.000Z" }),
    ];
    expect(runningBalance(entries, payments, "2026-01-31")).toBe(0);
  });

  it("ignores a payment left behind by a deleted entry", () => {
    const entries = [ledgerEntry({ id: "power", deletedAt: "2026-01-11T00:00:00.000Z" })];
    const payments = [ledgerPayment({ entryId: "power", amount: 5_000 })];
    expect(runningBalance(entries, payments, "2026-01-31")).toBe(0);
  });

  it("nets several incomes and expenses across different months", () => {
    const entries = [
      ledgerEntry({ id: "salary", kind: "income" }),
      ledgerEntry({ id: "rent" }),
      ledgerEntry({ id: "power" }),
    ];
    const payments = [
      ledgerPayment({ id: "p1", entryId: "salary", paidOn: "2026-08-05", amount: 300_000 }),
      ledgerPayment({ id: "p2", entryId: "rent", paidOn: "2026-08-06", amount: 120_000 }),
      ledgerPayment({ id: "p3", entryId: "salary", paidOn: "2026-09-05", amount: 300_000 }),
      ledgerPayment({ id: "p4", entryId: "rent", paidOn: "2026-09-06", amount: 120_000 }),
      ledgerPayment({ id: "p5", entryId: "power", paidOn: "2026-09-10", amount: 15_000 }),
    ];
    expect(runningBalance(entries, payments, "2026-08-31")).toBe(180_000);
    expect(runningBalance(entries, payments, "2026-09-30")).toBe(180_000 + 300_000 - 120_000 - 15_000);
  });
});
