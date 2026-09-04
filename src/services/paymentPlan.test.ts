import { describe, expect, it } from "vitest";

import type { BillPriority, Entry, Occurrence } from "../types.ts";
import {
  filterOpenExpenses,
  priorityOf,
  safeToSpend,
  calendarPressure,
  sortOpenExpenses,
} from "./paymentPlan.ts";

function occurrence(
  id: string,
  date: string,
  amount: number,
  priority?: BillPriority,
): Occurrence {
  const entry: Entry = {
    id,
    kind: "expense",
    description: id,
    amount,
    dueDate: date,
    repeat: "none",
    repeatCount: null,
    category: "",
    note: "",
    priority,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  };
  return { key: `${id}|${date}`, entry, date, index: 0, amount, payment: null, skipped: false };
}

describe("payment planning", () => {
  const items = [
    occurrence("future-essential", "2026-09-10", 200_00, "essential"),
    occurrence("overdue-flexible", "2026-09-01", 500_00, "flexible"),
    occurrence("today-important", "2026-09-04", 300_00, "important"),
  ];

  it("treats entries from older versions as important", () => {
    expect(priorityOf(items[2].entry)).toBe("important");
    expect(priorityOf({ ...items[2].entry, priority: undefined })).toBe("important");
  });

  it("smart-sorts overdue first, then priority and date", () => {
    expect(sortOpenExpenses(items, "smart", "2026-09-04").map((item) => item.entry.id)).toEqual([
      "overdue-flexible",
      "future-essential",
      "today-important",
    ]);
  });

  it("supports date, amount, and priority sorting", () => {
    expect(sortOpenExpenses(items, "date", "2026-09-04").map((item) => item.entry.id)).toEqual([
      "overdue-flexible",
      "today-important",
      "future-essential",
    ]);
    expect(sortOpenExpenses(items, "amount", "2026-09-04")[0].entry.id).toBe("overdue-flexible");
    expect(sortOpenExpenses(items, "priority", "2026-09-04")[0].entry.id).toBe("future-essential");
  });

  it("filters overdue, essential, and upcoming bills", () => {
    expect(filterOpenExpenses(items, "overdue", "2026-09-04").map((item) => item.entry.id)).toEqual([
      "overdue-flexible",
    ]);
    expect(filterOpenExpenses(items, "essential", "2026-09-04").map((item) => item.entry.id)).toEqual([
      "future-essential",
    ]);
    expect(filterOpenExpenses(items, "upcoming", "2026-09-04").map((item) => item.entry.id)).toEqual([
      "future-essential",
      "today-important",
    ]);
  });

  it("subtracts only open essential bills from the settled balance", () => {
    expect(safeToSpend(1_000_00, items)).toBe(800_00);
  });

  it("gives essential and overdue dates the strongest calendar pressure", () => {
    expect(calendarPressure([items[0]], "2026-09-04")).toBe(3);
    expect(calendarPressure([items[1]], "2026-09-04")).toBe(3);
    expect(calendarPressure([items[2]], "2026-09-04")).toBe(2);
  });
});
