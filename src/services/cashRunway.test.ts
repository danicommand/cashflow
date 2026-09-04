import { describe, expect, it } from "vitest";

import type { Entry, Occurrence, Payment } from "../types.ts";
import { cashRunway } from "./cashRunway.ts";

function item(id: string, date: string, kind: "expense" | "income", amount: number): Occurrence {
  const entry: Entry = {
    id,
    kind,
    description: id,
    amount,
    dueDate: date,
    repeat: "none",
    repeatCount: null,
    category: "",
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  };
  return { key: `${id}|${date}`, entry, date, index: 0, amount, payment: null, skipped: false };
}

describe("cashRunway", () => {
  it("projects income and expenses from the carried balance in date order", () => {
    const result = cashRunway(
      500_00,
      [item("rent", "2026-09-05", "expense", 300_00), item("pay", "2026-09-10", "income", 600_00)],
    );
    expect(result.points.map((point) => [point.date, point.balance])).toEqual([
      ["start", 500_00],
      ["2026-09-05", 200_00],
      ["2026-09-10", 800_00],
    ]);
    expect(result.lowest).toBe(200_00);
  });

  it("uses the real settled amount and ignores skipped items", () => {
    const paid: Payment = {
      id: "rent|2026-09-05",
      entryId: "rent",
      occurrence: "2026-09-05",
      paidOn: "2026-09-04",
      amount: 250_00,
      updatedAt: "2026-09-04T00:00:00.000Z",
      deletedAt: null,
    };
    const settled = { ...item("rent", "2026-09-05", "expense", 300_00), payment: paid };
    const skipped = { ...item("gym", "2026-09-06", "expense", 100_00), skipped: true };
    expect(cashRunway(500_00, [settled, skipped]).points.at(-1)?.balance).toBe(250_00);
  });
});
