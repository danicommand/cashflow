import { describe, expect, it } from "vitest";

import type { Entry, Ledger, Occurrence } from "../types.ts";
import { toggleOccurrenceDirect } from "./occurrenceToggle.ts";

const entry: Entry = {
  id: "rent",
  kind: "expense",
  description: "Rent",
  amount: 120_00,
  dueDate: "2026-09-05",
  repeat: "none",
  repeatCount: null,
  category: "Home",
  note: "",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  deletedAt: null,
};

const ledger: Ledger = { entries: [entry], payments: [], budgets: [], skips: [] };
const occurrence: Occurrence = {
  key: "rent|2026-09-05",
  entry,
  date: "2026-09-05",
  index: 0,
  amount: 120_00,
  payment: null,
  skipped: false,
};

describe("toggleOccurrenceDirect", () => {
  it("marks an open occurrence paid immediately at its full amount", () => {
    const updated = toggleOccurrenceDirect(ledger, occurrence, "2026-09-04");
    expect(updated.payments).toHaveLength(1);
    expect(updated.payments[0]).toMatchObject({
      entryId: "rent",
      occurrence: "2026-09-05",
      amount: 120_00,
      paidOn: "2026-09-04",
    });
  });

  it("marks an already-paid occurrence unpaid", () => {
    const paid = toggleOccurrenceDirect(ledger, occurrence, "2026-09-04");
    const paidOccurrence = { ...occurrence, payment: paid.payments[0] };
    expect(toggleOccurrenceDirect(paid, paidOccurrence, "2026-09-04").payments[0].deletedAt).not.toBeNull();
  });
});
