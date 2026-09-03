import { describe, expect, it } from "vitest";

import type { Entry, Payment } from "../types.ts";
import { instalmentProgress } from "./instalments.ts";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "loan",
    kind: "expense",
    description: "Laptop",
    amount: 120_000,
    dueDate: "2026-01-05",
    repeat: "monthly",
    repeatCount: 12,
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
    id: `loan|${occurrence}`,
    entryId: "loan",
    occurrence,
    paidOn: occurrence,
    amount: 120_000,
    updatedAt: `${occurrence}T00:00:00.000Z`,
    deletedAt: null,
    ...overrides,
  };
}

describe("instalmentProgress", () => {
  it("is null for a one-time entry", () => {
    expect(instalmentProgress(entry({ repeat: "none", repeatCount: null }), [])).toBeNull();
  });

  it("is null for an open-ended repeat with no total to measure against", () => {
    expect(instalmentProgress(entry({ repeatCount: null }), [])).toBeNull();
  });

  it("reads zero paid as the starting state", () => {
    const progress = instalmentProgress(entry(), []);
    expect(progress).toEqual({
      paidCount: 0,
      totalCount: 12,
      paidAmount: 0,
      totalAmount: 1_440_000,
      remainingAmount: 1_440_000,
    });
  });

  it("counts settled payments toward the plan", () => {
    const payments = [payment("2026-01-05"), payment("2026-02-05")];
    const progress = instalmentProgress(entry(), payments);
    expect(progress?.paidCount).toBe(2);
    expect(progress?.paidAmount).toBe(240_000);
    expect(progress?.remainingAmount).toBe(1_200_000);
  });

  it("uses what actually moved, not the planned amount, for a partial payment", () => {
    const payments = [payment("2026-01-05", { amount: 100_000 })];
    const progress = instalmentProgress(entry(), payments);
    expect(progress?.paidAmount).toBe(100_000);
    expect(progress?.remainingAmount).toBe(1_340_000);
  });

  it("never reports a negative remaining amount, even if overpaid", () => {
    const payments = Array.from({ length: 12 }, (_, index) =>
      payment(`2026-${String(index + 1).padStart(2, "0")}-05`, { amount: 200_000 }),
    );
    const progress = instalmentProgress(entry(), payments);
    expect(progress?.remainingAmount).toBe(0);
  });

  it("ignores payments belonging to a different entry", () => {
    const payments = [payment("2026-01-05", { entryId: "other" })];
    expect(instalmentProgress(entry(), payments)?.paidCount).toBe(0);
  });

  it("ignores a deleted (unsettled) payment", () => {
    const payments = [payment("2026-01-05", { deletedAt: "2026-01-06T00:00:00.000Z" })];
    expect(instalmentProgress(entry(), payments)?.paidCount).toBe(0);
  });
});
