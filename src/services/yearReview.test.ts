import { describe, expect, it } from "vitest";

import type { Entry, Payment } from "../types.ts";
import { yearSummary } from "./yearReview.ts";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "rent",
    kind: "expense",
    description: "Rent",
    amount: 120_000,
    dueDate: "2026-01-05",
    repeat: "monthly",
    repeatCount: null,
    category: "Home",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function payment(entryId: string, occurrence: string, amount: number): Payment {
  return {
    id: `${entryId}|${occurrence}`,
    entryId,
    occurrence,
    paidOn: occurrence,
    amount,
    updatedAt: `${occurrence}T00:00:00.000Z`,
    deletedAt: null,
  };
}

describe("yearSummary", () => {
  it("is all zero for a year with nothing settled", () => {
    const summary = yearSummary([entry()], [], 2026, "2026-06-15");
    expect(summary.paidTotal).toBe(0);
    expect(summary.receivedTotal).toBe(0);
    expect(summary.net).toBe(0);
    expect(summary.topCategory).toBeNull();
  });

  it("returns twelve monthly points, January first", () => {
    const summary = yearSummary([entry()], [], 2026, "2026-06-15");
    expect(summary.monthlyPaid).toHaveLength(12);
  });

  it("sums what was paid across the whole year", () => {
    const payments = [
      payment("rent", "2026-01-05", 120_000),
      payment("rent", "2026-02-05", 120_000),
      payment("rent", "2026-06-05", 120_000),
    ];
    const summary = yearSummary([entry()], payments, 2026, "2026-06-15");
    expect(summary.paidTotal).toBe(360_000);
    expect(summary.monthlyPaid[0]).toBe(120_000);
    expect(summary.monthlyPaid[5]).toBe(120_000);
    expect(summary.monthlyPaid[2]).toBe(0);
  });

  it("does not leak a payment from a neighbouring year", () => {
    const payments = [
      payment("rent", "2025-12-05", 120_000),
      payment("rent", "2027-01-05", 120_000),
    ];
    const summary = yearSummary([entry()], payments, 2026, "2026-06-15");
    expect(summary.paidTotal).toBe(0);
  });

  it("nets income against expenses for the year", () => {
    const entries = [
      entry({ id: "rent" }),
      entry({ id: "salary", kind: "income", amount: 350_000 }),
    ];
    const payments = [
      payment("rent", "2026-01-05", 120_000),
      payment("salary", "2026-01-05", 350_000),
    ];
    const summary = yearSummary(entries, payments, 2026, "2026-06-15");
    expect(summary.receivedTotal).toBe(350_000);
    expect(summary.net).toBe(230_000);
  });

  it("finds the biggest category across the year, income excluded", () => {
    const entries = [
      entry({ id: "rent", category: "Home" }),
      entry({ id: "car", category: "Car", amount: 30_000 }),
      entry({ id: "salary", kind: "income", category: "Pay", amount: 500_000 }),
    ];
    const payments = [
      payment("rent", "2026-01-05", 120_000),
      payment("car", "2026-01-05", 30_000),
      payment("salary", "2026-01-05", 500_000),
    ];
    const summary = yearSummary(entries, payments, 2026, "2026-06-15");
    expect(summary.topCategory).toEqual({ category: "Home", total: 120_000 });
  });

  it("ignores an uncategorised bucket when picking the top category", () => {
    const entries = [entry({ id: "rent", category: "" }), entry({ id: "car", category: "Car" })];
    const payments = [
      payment("rent", "2026-01-05", 500_000),
      payment("car", "2026-01-05", 10_000),
    ];
    const summary = yearSummary(entries, payments, 2026, "2026-06-15");
    expect(summary.topCategory?.category).toBe("Car");
  });
});
