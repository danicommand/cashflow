import { describe, expect, it } from "vitest";

import type { Ledger } from "../types.ts";
import {
  addEntry,
  blankDraft,
  deleteEntry,
  draftFrom,
  knownCategories,
  settleOccurrence,
  unsettleOccurrence,
  updateEntry,
  type EntryDraft,
} from "./ledger.ts";
import { occurrencesInMonth } from "./occurrences.ts";
import { liveLedger } from "./merge.ts";

const NOW = new Date("2026-01-10T12:00:00.000Z");

function draft(overrides: Partial<EntryDraft> = {}): EntryDraft {
  return {
    ...blankDraft("expense", "2026-01-05"),
    description: "Rent",
    amount: 120_000,
    ...overrides,
  };
}

const EMPTY: Ledger = { entries: [], payments: [] };

describe("addEntry", () => {
  it("stores the entry with matching timestamps", () => {
    const ledger = addEntry(EMPTY, draft(), NOW);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0].createdAt).toBe(NOW.toISOString());
    expect(ledger.entries[0].updatedAt).toBe(NOW.toISOString());
    expect(ledger.entries[0].deletedAt).toBeNull();
  });

  it("trims the text fields", () => {
    const ledger = addEntry(EMPTY, draft({ description: "  Rent  ", category: " Home " }), NOW);
    expect(ledger.entries[0].description).toBe("Rent");
    expect(ledger.entries[0].category).toBe("Home");
  });

  it("does not mutate the ledger it was given", () => {
    const before: Ledger = { entries: [], payments: [] };
    addEntry(before, draft(), NOW);
    expect(before.entries).toHaveLength(0);
  });

  it("gives every entry its own id", () => {
    const ledger = addEntry(addEntry(EMPTY, draft(), NOW), draft(), NOW);
    expect(ledger.entries[0].id).not.toBe(ledger.entries[1].id);
  });
});

describe("updateEntry", () => {
  it("moves the timestamp forward so the change can win a merge", () => {
    const created = addEntry(EMPTY, draft(), NOW);
    const later = new Date("2026-02-01T00:00:00.000Z");
    const updated = updateEntry(
      created,
      created.entries[0].id,
      draft({ amount: 130_000 }),
      later,
    );
    expect(updated.entries[0].amount).toBe(130_000);
    expect(updated.entries[0].updatedAt).toBe(later.toISOString());
    expect(updated.entries[0].createdAt).toBe(NOW.toISOString());
  });

  it("drops a repeat count when the entry stops repeating", () => {
    const created = addEntry(EMPTY, draft({ repeat: "monthly", repeatCount: 6 }), NOW);
    const updated = updateEntry(
      created,
      created.entries[0].id,
      draft({ repeat: "none", repeatCount: 6 }),
      NOW,
    );
    expect(updated.entries[0].repeatCount).toBeNull();
  });
});

describe("deleteEntry", () => {
  it("tombstones the entry and everything recorded against it", () => {
    let ledger = addEntry(EMPTY, draft(), NOW);
    const id = ledger.entries[0].id;
    ledger = settleOccurrence(ledger, id, "2026-01-05", 120_000, "2026-01-05", NOW);
    ledger = deleteEntry(ledger, id, NOW);

    expect(ledger.entries[0].deletedAt).toBe(NOW.toISOString());
    expect(ledger.payments[0].deletedAt).toBe(NOW.toISOString());
    expect(liveLedger(ledger).entries).toHaveLength(0);
  });

  it("leaves other entries alone", () => {
    let ledger = addEntry(EMPTY, draft({ description: "Rent" }), NOW);
    ledger = addEntry(ledger, draft({ description: "Power" }), NOW);
    ledger = deleteEntry(ledger, ledger.entries[0].id, NOW);
    expect(liveLedger(ledger).entries.map((entry) => entry.description)).toEqual(["Power"]);
  });
});

describe("settleOccurrence", () => {
  it("marks exactly one occurrence of a repeating entry", () => {
    let ledger = addEntry(EMPTY, draft({ repeat: "monthly" }), NOW);
    const id = ledger.entries[0].id;
    ledger = settleOccurrence(ledger, id, "2026-01-05", 120_000, "2026-01-04", NOW);

    const january = occurrencesInMonth(ledger.entries, ledger.payments, "2026-01");
    const february = occurrencesInMonth(ledger.entries, ledger.payments, "2026-02");
    expect(january[0].payment?.paidOn).toBe("2026-01-04");
    expect(february[0].payment).toBeNull();
  });

  it("replaces an earlier settlement rather than adding a second", () => {
    let ledger = addEntry(EMPTY, draft(), NOW);
    const id = ledger.entries[0].id;
    ledger = settleOccurrence(ledger, id, "2026-01-05", 120_000, "2026-01-05", NOW);
    ledger = settleOccurrence(ledger, id, "2026-01-05", 118_000, "2026-01-06", NOW);
    expect(ledger.payments).toHaveLength(1);
    expect(ledger.payments[0].amount).toBe(118_000);
  });

  it("derives the payment id from the entry and the occurrence", () => {
    // Two offline devices must produce the same id, or the merge cannot tell
    // that they settled the same bill.
    let ledger = addEntry(EMPTY, draft(), NOW);
    const id = ledger.entries[0].id;
    ledger = settleOccurrence(ledger, id, "2026-01-05", 1, "2026-01-05", NOW);
    expect(ledger.payments[0].id).toBe(`${id}|2026-01-05`);
  });
});

describe("unsettleOccurrence", () => {
  it("puts the amount back into what is still owed", () => {
    let ledger = addEntry(EMPTY, draft(), NOW);
    const id = ledger.entries[0].id;
    ledger = settleOccurrence(ledger, id, "2026-01-05", 120_000, "2026-01-05", NOW);
    ledger = unsettleOccurrence(ledger, id, "2026-01-05", NOW);

    const january = occurrencesInMonth(ledger.entries, ledger.payments, "2026-01");
    expect(january[0].payment).toBeNull();
    // The row is kept as a tombstone so the undo reaches the other device.
    expect(ledger.payments).toHaveLength(1);
    expect(ledger.payments[0].deletedAt).toBe(NOW.toISOString());
  });

  it("can be settled again afterwards", () => {
    let ledger = addEntry(EMPTY, draft(), NOW);
    const id = ledger.entries[0].id;
    ledger = settleOccurrence(ledger, id, "2026-01-05", 120_000, "2026-01-05", NOW);
    ledger = unsettleOccurrence(ledger, id, "2026-01-05", NOW);
    ledger = settleOccurrence(ledger, id, "2026-01-05", 120_000, "2026-01-07", NOW);

    expect(ledger.payments).toHaveLength(1);
    expect(ledger.payments[0].deletedAt).toBeNull();
    expect(occurrencesInMonth(ledger.entries, ledger.payments, "2026-01")[0].payment).not.toBeNull();
  });
});

describe("knownCategories", () => {
  it("lists live categories once, sorted, ignoring blanks", () => {
    let ledger = addEntry(EMPTY, draft({ category: "Home" }), NOW);
    ledger = addEntry(ledger, draft({ category: "Car" }), NOW);
    ledger = addEntry(ledger, draft({ category: "Home" }), NOW);
    ledger = addEntry(ledger, draft({ category: "" }), NOW);
    expect(knownCategories(ledger)).toEqual(["Car", "Home"]);
  });

  it("forgets the category of a deleted entry", () => {
    let ledger = addEntry(EMPTY, draft({ category: "Gone" }), NOW);
    ledger = deleteEntry(ledger, ledger.entries[0].id, NOW);
    expect(knownCategories(ledger)).toEqual([]);
  });
});

describe("draftFrom", () => {
  it("round-trips an entry through the editor without changing it", () => {
    const ledger = addEntry(EMPTY, draft({ repeat: "monthly", repeatCount: 12 }), NOW);
    const entry = ledger.entries[0];
    const reopened = updateEntry(ledger, entry.id, draftFrom(entry), NOW);
    expect(reopened.entries[0]).toEqual(entry);
  });
});
