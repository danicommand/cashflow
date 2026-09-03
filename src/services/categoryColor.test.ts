import { describe, expect, it } from "vitest";

import { categoryColorIndex } from "./categoryColor.ts";

describe("categoryColorIndex", () => {
  it("is stable for the same name", () => {
    expect(categoryColorIndex("Food")).toBe(categoryColorIndex("Food"));
  });

  it("gives an uncategorised entry the neutral slot", () => {
    expect(categoryColorIndex("")).toBe(0);
    expect(categoryColorIndex("   ")).toBe(0);
  });

  it("is not sensitive to surrounding whitespace", () => {
    expect(categoryColorIndex("Food")).toBe(categoryColorIndex("  Food  "));
  });

  it("stays within the palette bounds", () => {
    for (const name of ["Food", "Car", "Home", "Health", "Bills", "Travel", "Gifts", "Other"]) {
      const index = categoryColorIndex(name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });

  it("spreads a realistic set of category names across more than one slot", () => {
    // Not a hard guarantee for arbitrary input, but real categories should
    // not all collapse onto the same colour, which would defeat the point.
    const names = ["Food", "Car", "Home", "Health", "Bills", "Travel", "Gifts", "Subscriptions"];
    const indexes = new Set(names.map(categoryColorIndex));
    expect(indexes.size).toBeGreaterThan(1);
  });
});
