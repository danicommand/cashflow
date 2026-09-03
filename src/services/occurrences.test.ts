import { describe, expect, it } from "vitest";

import type { Entry, Payment, Skip } from "../types.ts";
import {
  groupByDate,
  indexSkips,
  occurrencesInMonth,
  occurrencesInRange,
  overdueExpenses,
  upcomingExpenses,
} from "./occurrences.ts";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    kind: "expense",
    description: "Rent",
    amount: 120_000,
    dueDate: "2026-01-05",
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

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "e1|2026-01-05",
    entryId: "e1",
    occurrence: "2026-01-05",
    paidOn: "2026-01-04",
    amount: 120_000,
    updatedAt: "2026-01-04T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function skip(overrides: Partial<Skip> = {}): Skip {
  return {
    id: "e1|2026-01-05",
    entryId: "e1",
    occurrence: "2026-01-05",
    updatedAt: "2026-01-04T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("one-off entries", () => {
  it("appears only in its own month", () => {
    const entries = [entry()];
    expect(occurrencesInMonth(entries, [], [], "2026-01")).toHaveLength(1);
    expect(occurrencesInMonth(entries, [], [], "2026-02")).toHaveLength(0);
    expect(occurrencesInMonth(entries, [], [], "2025-12")).toHaveLength(0);
  });
});

describe("monthly entries", () => {
  it("appears in every later month", () => {
    const entries = [entry({ repeat: "monthly" })];
    expect(occurrencesInMonth(entries, [], [], "2026-01")[0]?.date).toBe("2026-01-05");
    expect(occurrencesInMonth(entries, [], [], "2026-07")[0]?.date).toBe("2026-07-05");
    expect(occurrencesInMonth(entries, [], [], "2028-03")[0]?.date).toBe("2028-03-05");
  });

  it("never appears before it starts", () => {
    const entries = [entry({ repeat: "monthly" })];
    expect(occurrencesInMonth(entries, [], [], "2025-12")).toHaveLength(0);
  });

  it("lands on the last day of a short month", () => {
    const entries = [entry({ dueDate: "2026-01-31", repeat: "monthly" })];
    expect(occurrencesInMonth(entries, [], [], "2026-02")[0]?.date).toBe("2026-02-28");
    expect(occurrencesInMonth(entries, [], [], "2026-03")[0]?.date).toBe("2026-03-31");
  });

  it("stops after the instalment count runs out", () => {
    const entries = [entry({ repeat: "monthly", repeatCount: 3 })];
    expect(occurrencesInMonth(entries, [], [], "2026-03")).toHaveLength(1);
    expect(occurrencesInMonth(entries, [], [], "2026-04")).toHaveLength(0);
  });

  it("numbers the instalments from zero", () => {
    const entries = [entry({ repeat: "monthly", repeatCount: 12 })];
    expect(occurrencesInMonth(entries, [], [], "2026-01")[0]?.index).toBe(0);
    expect(occurrencesInMonth(entries, [], [], "2026-04")[0]?.index).toBe(3);
  });
});

describe("weekly entries", () => {
  it("lands every seven days across a month boundary", () => {
    const entries = [entry({ dueDate: "2026-01-29", repeat: "weekly" })];
    const january = occurrencesInMonth(entries, [], [], "2026-01").map((item) => item.date);
    const february = occurrencesInMonth(entries, [], [], "2026-02").map((item) => item.date);
    expect(january).toEqual(["2026-01-29"]);
    expect(february).toEqual(["2026-02-05", "2026-02-12", "2026-02-19", "2026-02-26"]);
  });

  it("respects the repeat count", () => {
    const entries = [entry({ dueDate: "2026-01-01", repeat: "weekly", repeatCount: 3 })];
    expect(occurrencesInMonth(entries, [], [], "2026-01").map((item) => item.date)).toEqual([
      "2026-01-01",
      "2026-01-08",
      "2026-01-15",
    ]);
  });
});

describe("yearly entries", () => {
  it("only appears in the anniversary month", () => {
    const entries = [entry({ dueDate: "2026-03-10", repeat: "yearly" })];
    expect(occurrencesInMonth(entries, [], [], "2027-03")[0]?.date).toBe("2027-03-10");
    expect(occurrencesInMonth(entries, [], [], "2027-04")).toHaveLength(0);
  });
});

describe("payments", () => {
  it("attaches a payment to its occurrence and nothing else", () => {
    const entries = [entry({ repeat: "monthly" })];
    const january = occurrencesInMonth(entries, [payment()], [], "2026-01");
    const february = occurrencesInMonth(entries, [payment()], [], "2026-02");
    expect(january[0]?.payment?.amount).toBe(120_000);
    expect(february[0]?.payment).toBeNull();
  });

  it("ignores a deleted payment", () => {
    const entries = [entry()];
    const deleted = [payment({ deletedAt: "2026-01-06T00:00:00.000Z" })];
    expect(occurrencesInMonth(entries, deleted, [], "2026-01")[0]?.payment).toBeNull();
  });

  it("keeps the most recently updated of two payments for one occurrence", () => {
    const entries = [entry()];
    const payments = [
      payment({ id: "a", amount: 100, updatedAt: "2026-01-04T00:00:00.000Z" }),
      payment({ id: "b", amount: 900, updatedAt: "2026-01-05T00:00:00.000Z" }),
    ];
    expect(occurrencesInMonth(entries, payments, [], "2026-01")[0]?.payment?.amount).toBe(900);
  });
});

describe("deleted entries", () => {
  it("produces no occurrences", () => {
    const entries = [entry({ repeat: "monthly", deletedAt: "2026-02-01T00:00:00.000Z" })];
    expect(occurrencesInMonth(entries, [], [], "2026-03")).toHaveLength(0);
  });
});

describe("occurrencesInRange", () => {
  it("includes both ends and excludes what falls outside", () => {
    const entries = [entry({ dueDate: "2026-01-05", repeat: "monthly" })];
    const dates = occurrencesInRange(entries, [], [], "2026-01-05", "2026-03-05").map(
      (item) => item.date,
    );
    expect(dates).toEqual(["2026-01-05", "2026-02-05", "2026-03-05"]);
  });

  it("returns nothing when the range is inverted", () => {
    expect(occurrencesInRange([entry()], [], [], "2026-03-01", "2026-01-01")).toEqual([]);
  });
});

describe("upcoming and overdue", () => {
  const entries = [
    entry({ id: "a", dueDate: "2026-01-02", description: "Late" }),
    entry({ id: "b", dueDate: "2026-01-10", description: "Soon" }),
    entry({ id: "c", dueDate: "2026-03-10", description: "Far" }),
    entry({ id: "d", dueDate: "2026-01-09", description: "Salary", kind: "income" }),
  ];

  it("lists unpaid bills ahead, ignoring income", () => {
    const found = upcomingExpenses(entries, [], [], "2026-01-05", 30).map(
      (item) => item.entry.description,
    );
    expect(found).toEqual(["Soon"]);
  });

  it("lists unpaid bills already past", () => {
    const found = overdueExpenses(entries, [], [], "2026-01-05").map(
      (item) => item.entry.description,
    );
    expect(found).toEqual(["Late"]);
  });

  it("drops a bill once it is settled", () => {
    const settled = [payment({ id: "a|2026-01-02", entryId: "a", occurrence: "2026-01-02" })];
    expect(overdueExpenses(entries, settled, [], "2026-01-05")).toHaveLength(0);
  });
});

describe("skips", () => {
  it("flags the matching occurrence and nothing else", () => {
    const entries = [entry({ repeat: "monthly" })];
    const january = occurrencesInMonth(entries, [], [skip()], "2026-01");
    const february = occurrencesInMonth(entries, [], [skip()], "2026-02");
    expect(january[0]?.skipped).toBe(true);
    expect(february[0]?.skipped).toBe(false);
  });

  it("ignores a deleted skip", () => {
    const entries = [entry()];
    const deleted = [skip({ deletedAt: "2026-01-06T00:00:00.000Z" })];
    expect(occurrencesInMonth(entries, [], deleted, "2026-01")[0]?.skipped).toBe(false);
  });

  it("excludes a skipped occurrence from upcoming and overdue", () => {
    const entries = [
      entry({ id: "a", dueDate: "2026-01-02", description: "Late" }),
      entry({ id: "b", dueDate: "2026-01-10", description: "Soon" }),
    ];
    const skips = [
      skip({ id: "a|2026-01-02", entryId: "a", occurrence: "2026-01-02" }),
      skip({ id: "b|2026-01-10", entryId: "b", occurrence: "2026-01-10" }),
    ];
    expect(overdueExpenses(entries, [], skips, "2026-01-05")).toHaveLength(0);
    expect(upcomingExpenses(entries, [], skips, "2026-01-05", 30)).toHaveLength(0);
  });

  it("indexSkips only keeps live skip ids", () => {
    const index = indexSkips([skip(), skip({ id: "a|2026-01-06", deletedAt: "x" })]);
    expect(index.has("e1|2026-01-05")).toBe(true);
    expect(index.has("a|2026-01-06")).toBe(false);
  });
});

describe("groupByDate", () => {
  it("buckets occurrences by day in date order", () => {
    const entries = [
      entry({ id: "a", dueDate: "2026-01-10", description: "B" }),
      entry({ id: "b", dueDate: "2026-01-05", description: "A" }),
      entry({ id: "c", dueDate: "2026-01-05", description: "C" }),
    ];
    const groups = groupByDate(occurrencesInMonth(entries, [], [], "2026-01"));
    expect(groups.map((group) => group.date)).toEqual(["2026-01-05", "2026-01-10"]);
    expect(groups[0].items.map((item) => item.entry.description)).toEqual(["A", "C"]);
  });
});
