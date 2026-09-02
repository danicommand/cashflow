import { describe, expect, it } from "vitest";

import {
  WHEEL_MAX_DELAY_MS,
  WHEEL_STEP_MS,
  rollDuration,
  toOdometerSlots,
  wheelDelay,
} from "./odometer.ts";
import { formatMoney } from "./money.ts";

/** The two rightmost wheels, identified the way React keys them. */
function centsOf(slots: ReturnType<typeof toOdometerSlots>): string[] {
  return slots.filter((slot) => slot.key <= 1).map((slot) => `${slot.key}:${slot.char}`);
}

describe("toOdometerSlots", () => {
  it("keeps every character, in order", () => {
    const formatted = "R$ 1.234,56";
    expect(toOdometerSlots(formatted).map((slot) => slot.char).join("")).toBe(formatted);
  });

  it("marks digits as wheels and leaves everything else fixed", () => {
    const slots = toOdometerSlots("$1,234.56");
    const wheels = slots.filter((slot) => slot.digit !== null);
    const fixed = slots.filter((slot) => slot.digit === null);
    expect(wheels.map((slot) => slot.digit)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fixed.map((slot) => slot.char)).toEqual(["$", ",", "."]);
  });

  it("counts the digits to the right of each wheel", () => {
    const slots = toOdometerSlots("123");
    expect(slots.map((slot) => slot.digitsToTheRight)).toEqual([2, 1, 0]);
  });

  it("does not count fixed glyphs as digits", () => {
    const slots = toOdometerSlots("1.234");
    const wheels = slots.filter((slot) => slot.digit !== null);
    expect(wheels.map((slot) => slot.digitsToTheRight)).toEqual([3, 2, 1, 0]);
  });

  it("gives the cents the same identity even when the number gains a place", () => {
    // This is the whole point: 934,56 becoming 1.234,56 must leave the cents
    // wheels alone. Keyed from the left, every wheel would appear to change.
    expect(centsOf(toOdometerSlots("934,56"))).toEqual(centsOf(toOdometerSlots("1.234,56")));
  });

  it("handles an empty string", () => {
    expect(toOdometerSlots("")).toEqual([]);
  });

  it("survives a currency whose symbol trails and a non-breaking space", () => {
    const formatted = "1 234,56 €";
    const slots = toOdometerSlots(formatted);
    expect(slots.map((slot) => slot.char).join("")).toBe(formatted);
    expect(slots.filter((slot) => slot.digit !== null)).toHaveLength(6);
  });

  it("works on whatever Intl actually produces", () => {
    for (const [currency, language] of [
      ["USD", "en"],
      ["BRL", "pt"],
      ["EUR", "pt"],
      ["GBP", "en"],
    ] as const) {
      const formatted = formatMoney(123_456, currency, language);
      const slots = toOdometerSlots(formatted);
      expect(slots.map((slot) => slot.char).join("")).toBe(formatted);
      expect(slots.filter((slot) => slot.digit !== null)).toHaveLength(6);
    }
  });
});

describe("wheelDelay", () => {
  it("starts at the right and cascades left", () => {
    const slots = toOdometerSlots("123");
    const delays = slots.map(wheelDelay);
    expect(delays[2]).toBe(0);
    expect(delays[1]).toBe(WHEEL_STEP_MS);
    expect(delays[0]).toBe(WHEEL_STEP_MS * 2);
  });

  it("caps the cascade so a big number does not read as lag", () => {
    const slots = toOdometerSlots("9876543210987654321");
    for (const slot of slots) {
      expect(wheelDelay(slot)).toBeLessThanOrEqual(WHEEL_MAX_DELAY_MS);
    }
    expect(wheelDelay(slots[0])).toBe(WHEEL_MAX_DELAY_MS);
  });
});

describe("rollDuration", () => {
  it("covers the last wheel's travel, not just the first", () => {
    expect(rollDuration(toOdometerSlots("12"), 400)).toBe(WHEEL_STEP_MS + 400);
  });

  it("is just the travel when there is nothing to cascade", () => {
    expect(rollDuration(toOdometerSlots("7"), 400)).toBe(400);
  });
});
