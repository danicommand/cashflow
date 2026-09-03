import { describe, expect, it } from "vitest";

import type { Entry, Payment } from "../types.ts";
import { spendHistory } from "./trend.ts";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "rent",
    kind: "expense",
    description: "Rent",
    amount: 120_000,
    dueDate: "2026-01-05",
    repeat: "monthly",
    repeatCount: null,
    category: "",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function payment(occurrence: string, overrides: Partial<Payment> = {}): Payment {
  return {
    id: `rent|${occurrence}`,
    entryId: "rent",
    occurrence,
    paidOn: occurrence,
    amount: 120_000,
    updatedAt: `${occurrence}T00:00:00.000Z`,
    deletedAt: null,
    ...overrides,
  };
}

describe("spendHistory", () => {
  it("returns the requested number of months, oldest first", () => {
    const history = spendHistory([entry()], [], [], "2026-04", "2026-04-15", 3);
    expect(history.map((point) => point.month)).toEqual(["2026-02", "2026-03", "2026-04"]);
  });

  it("crosses a year boundary", () => {
    const history = spendHistory([entry()], [], [], "2026-02", "2026-02-10", 4);
    expect(history.map((point) => point.month)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("reports what was actually paid each month, not what was billed", () => {
    const payments = [payment("2026-01-05"), payment("2026-02-05", { amount: 100_000 })];
    const history = spendHistory([entry()], payments, [], "2026-03", "2026-03-15", 3);
    expect(history).toEqual([
      { month: "2026-01", paidTotal: 120_000 },
      { month: "2026-02", paidTotal: 100_000 },
      { month: "2026-03", paidTotal: 0 },
    ]);
  });

  it("returns zero for a month with nothing settled", () => {
    const history = spendHistory([entry()], [], [], "2026-01", "2026-01-10", 1);
    expect(history).toEqual([{ month: "2026-01", paidTotal: 0 }]);
  });

  it("ignores unsettled occurrences and income", () => {
    const entries = [entry(), entry({ id: "salary", kind: "income", amount: 300_000 })];
    const payments = [payment("2026-01-05", { entryId: "salary", id: "salary|2026-01-05" })];
    const history = spendHistory(entries, payments, [], "2026-01", "2026-01-10", 1);
    // Rent went unpaid; the settled record belongs to income, not an expense.
    expect(history).toEqual([{ month: "2026-01", paidTotal: 0 }]);
  });
});
