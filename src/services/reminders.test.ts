import { describe, expect, it } from "vitest";

import type { Entry, Occurrence } from "../types.ts";
import { reminderKey, remindersDue } from "./reminders.ts";

function bill(id: string, date: string): Occurrence {
  const entry: Entry = {
    id,
    kind: "expense",
    description: id,
    amount: 100_00,
    dueDate: date,
    repeat: "none",
    repeatCount: null,
    category: "",
    note: "",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
  };
  return { key: `${id}|${date}`, entry, date, index: 0, amount: 100_00, payment: null, skipped: false };
}

describe("reminders", () => {
  it("includes overdue bills and bills inside the lead window", () => {
    const items = [bill("late", "2026-09-01"), bill("soon", "2026-09-06"), bill("later", "2026-09-08")];
    expect(remindersDue(items, "2026-09-04", 3).map((item) => item.entry.id)).toEqual([
      "late",
      "soon",
    ]);
  });

  it("creates a once-per-day key for each occurrence", () => {
    expect(reminderKey(bill("rent", "2026-09-05"), "2026-09-04")).toBe(
      "cashflow.reminder.2026-09-04.rent|2026-09-05",
    );
  });
});
