import { describe, expect, it } from "vitest";

import { centsToInput, formatMoney, parseMoney, splitInstalments } from "./money.ts";

describe("parseMoney", () => {
  it("reads plain numbers as whole currency units", () => {
    expect(parseMoney("12")).toBe(1_200);
    expect(parseMoney("1200")).toBe(120_000);
  });

  it("reads a dot decimal", () => {
    expect(parseMoney("12.5")).toBe(1_250);
    expect(parseMoney("12.34")).toBe(1_234);
  });

  it("reads a comma decimal", () => {
    expect(parseMoney("12,34")).toBe(1_234);
    expect(parseMoney("0,99")).toBe(99);
  });

  it("reads both grouping conventions for the same amount", () => {
    // The same money, typed by a Brazilian and by an American.
    expect(parseMoney("1.234,56")).toBe(123_456);
    expect(parseMoney("1,234.56")).toBe(123_456);
  });

  it("treats a three-digit group as grouping, not decimals", () => {
    expect(parseMoney("1,234")).toBe(123_400);
    expect(parseMoney("1.234")).toBe(123_400);
  });

  it("ignores currency symbols and spaces", () => {
    expect(parseMoney("R$ 1.500,00")).toBe(150_000);
    expect(parseMoney("$1,500.00")).toBe(150_000);
    expect(parseMoney(" 42 ")).toBe(4_200);
  });

  it("returns null when there is nothing to read", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("   ")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("R$")).toBeNull();
  });

  it("keeps a negative sign", () => {
    expect(parseMoney("-12.50")).toBe(-1_250);
  });

  it("never produces a fractional cent", () => {
    expect(Number.isInteger(parseMoney("0.1") ?? 0)).toBe(true);
    expect(parseMoney("0.1")).toBe(10);
  });
});

describe("centsToInput", () => {
  it("round-trips through parseMoney", () => {
    for (const cents of [0, 1, 99, 100, 123_456, 999_999_99]) {
      expect(parseMoney(centsToInput(cents))).toBe(cents);
    }
  });
});

describe("formatMoney", () => {
  it("uses the currency and the language", () => {
    const usd = formatMoney(123_456, "USD", "en");
    expect(usd).toContain("1,234.56");
    const brl = formatMoney(123_456, "BRL", "pt");
    expect(brl).toContain("1.234,56");
  });

  it("shows cents even when they are zero", () => {
    expect(formatMoney(100_000, "USD", "en")).toContain("1,000.00");
  });
});

describe("splitInstalments", () => {
  it("adds back up to the original total", () => {
    for (const [total, count] of [
      [10_000, 3],
      [99_999, 7],
      [1, 4],
    ] as const) {
      const parts = splitInstalments(total, count);
      expect(parts).toHaveLength(count);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    }
  });

  it("puts the odd cents on the first instalment", () => {
    expect(splitInstalments(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
  });

  it("returns the whole total for a single instalment", () => {
    expect(splitInstalments(5_000, 1)).toEqual([5_000]);
  });
});
