import { describe, expect, it } from "vitest";

import type { Budget, Entry, Occurrence } from "../types.ts";
import { budgetFor, monthBudgets } from "./budgets.ts";

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: "b1",
    category: "Food",
    limit: 50_000,
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function occurrence(
  overrides: Partial<Entry> & { amount?: number; paid?: boolean } = {},
): Occurrence {
  const { amount = 10_000, paid = false, ...entryFields } = overrides;
  const entry: Entry = {
    id: "e1",
    kind: "expense",
    description: "Bill",
    amount,
    dueDate: "2026-01-10",
    repeat: "none",
    repeatCount: null,
    category: "Food",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...entryFields,
  };
  return {
    key: `${entry.id}|2026-01-10`,
    entry,
    date: "2026-01-10",
    index: 0,
    amount,
    payment: paid
      ? {
          id: `${entry.id}|2026-01-10`,
          entryId: entry.id,
          occurrence: "2026-01-10",
          paidOn: "2026-01-10",
          amount,
          updatedAt: "2026-01-10T00:00:00.000Z",
          deletedAt: null,
        }
      : null,
    skipped: false,
  };
}

describe("budgetFor", () => {
  it("finds the live budget for a category", () => {
    expect(budgetFor([budget()], "Food")?.limit).toBe(50_000);
  });

  it("is null for a category with no budget", () => {
    expect(budgetFor([budget()], "Car")).toBeNull();
  });

  it("ignores a deleted budget", () => {
    expect(budgetFor([budget({ deletedAt: "2026-02-01T00:00:00.000Z" })], "Food")).toBeNull();
  });

  it("trims the category before matching", () => {
    expect(budgetFor([budget()], "  Food  ")?.limit).toBe(50_000);
  });
});

describe("monthBudgets", () => {
  it("counts every occurrence toward its category, settled or not", () => {
    // A budget is a plan for what will be spent, so an unpaid bill counts
    // just as much as a paid one — the money is committed either way.
    const occurrences = [
      occurrence({ id: "a", amount: 20_000, paid: true }),
      occurrence({ id: "b", amount: 15_000, paid: false }),
    ];
    const [result] = monthBudgets(occurrences, [budget()]);
    expect(result.spent).toBe(35_000);
  });

  it("computes the share against the limit", () => {
    const occurrences = [occurrence({ amount: 25_000 })];
    const [result] = monthBudgets(occurrences, [budget({ limit: 50_000 })]);
    expect(result.share).toBeCloseTo(0.5);
    expect(result.overBudget).toBe(false);
  });

  it("flags a category that has gone over its cap", () => {
    const occurrences = [occurrence({ amount: 60_000 })];
    const [result] = monthBudgets(occurrences, [budget({ limit: 50_000 })]);
    expect(result.share).toBeCloseTo(1.2);
    expect(result.overBudget).toBe(true);
  });

  it("reads zero spent as zero share, not a division by zero", () => {
    const [result] = monthBudgets([], [budget()]);
    expect(result.spent).toBe(0);
    expect(result.share).toBe(0);
    expect(result.overBudget).toBe(false);
  });

  it("still reports a budget with nothing spent against a zero-limit budget", () => {
    const occurrences = [occurrence({ amount: 100 })];
    const [result] = monthBudgets(occurrences, [budget({ limit: 0 })]);
    expect(result.overBudget).toBe(true);
    expect(result.share).toBe(1);
  });

  it("ignores a deleted budget entirely", () => {
    const occurrences = [occurrence({ amount: 10_000 })];
    expect(monthBudgets(occurrences, [budget({ deletedAt: "2026-02-01T00:00:00.000Z" })])).toEqual(
      [],
    );
  });

  it("orders the most over-budget category first", () => {
    const occurrences = [
      occurrence({ id: "a", amount: 40_000, category: "Food" }),
      occurrence({ id: "b", amount: 90_000, category: "Car" }),
    ];
    const budgets = [
      budget({ id: "food", category: "Food", limit: 50_000 }),
      budget({ id: "car", category: "Car", limit: 50_000 }),
    ];
    const results = monthBudgets(occurrences, budgets);
    expect(results.map((r) => r.category)).toEqual(["Car", "Food"]);
  });
});
