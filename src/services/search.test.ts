import { describe, expect, it } from "vitest";

import type { Entry } from "../types.ts";
import { searchEntries } from "./search.ts";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    kind: "expense",
    description: "Rent",
    amount: 120_000,
    dueDate: "2026-01-05",
    repeat: "none",
    repeatCount: null,
    category: "Home",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("searchEntries", () => {
  it("matches a substring of the description, case-insensitively", () => {
    const entries = [entry({ description: "Netflix subscription" })];
    expect(searchEntries(entries, "NETFLIX")).toHaveLength(1);
    expect(searchEntries(entries, "flix sub")).toHaveLength(1);
  });

  it("matches the category too", () => {
    const entries = [entry({ description: "Rent", category: "Housing" })];
    expect(searchEntries(entries, "housing")).toHaveLength(1);
  });

  it("ignores accents on both sides of the match", () => {
    const entries = [entry({ description: "Café bill" })];
    expect(searchEntries(entries, "cafe")).toHaveLength(1);
    expect(searchEntries(entries, "café")).toHaveLength(1);
  });

  it("returns nothing for an empty query rather than everything", () => {
    const entries = [entry(), entry({ id: "e2" })];
    expect(searchEntries(entries, "")).toEqual([]);
    expect(searchEntries(entries, "   ")).toEqual([]);
  });

  it("ignores a deleted entry", () => {
    const entries = [entry({ deletedAt: "2026-02-01T00:00:00.000Z" })];
    expect(searchEntries(entries, "rent")).toEqual([]);
  });

  it("ranks a description match ahead of a category-only match", () => {
    const entries = [
      entry({ id: "cat-only", description: "Power", category: "Water utilities" }),
      entry({ id: "desc-match", description: "Water bill", category: "Home" }),
    ];
    const results = searchEntries(entries, "water");
    expect(results.map((r) => r.entry.id)).toEqual(["desc-match", "cat-only"]);
  });

  it("caps the result count", () => {
    const entries = Array.from({ length: 50 }, (_, index) =>
      entry({ id: `e${index}`, description: `Bill ${index}` }),
    );
    expect(searchEntries(entries, "bill", 10)).toHaveLength(10);
  });

  it("sends a one-time entry to its own month", () => {
    const entries = [entry({ repeat: "none", dueDate: "2026-03-15" })];
    expect(searchEntries(entries, "rent")[0].month).toBe("2026-03");
  });

  it("sends a repeating entry to the current month, where it has an occurrence", () => {
    const entries = [entry({ repeat: "monthly", dueDate: "2020-01-05" })];
    const result = searchEntries(entries, "rent")[0];
    expect(result.month).not.toBe("2020-01");
  });
});
