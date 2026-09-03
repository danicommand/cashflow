import { describe, expect, it } from "vitest";

import type { Entry, Payment } from "../types.ts";
import { toCsv } from "./csv.ts";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    kind: "expense",
    description: "Rent",
    amount: 120_000,
    dueDate: "2026-01-05",
    repeat: "monthly",
    repeatCount: null,
    category: "Home",
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
    paidOn: "2026-01-05",
    amount: 120_000,
    updatedAt: "2026-01-05T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("toCsv", () => {
  it("writes the header row even with nothing settled", () => {
    expect(toCsv([], [])).toBe("Date,Description,Category,Type,Amount");
  });

  it("writes an expense as a negative amount and income as positive", () => {
    const entries = [
      entry({ id: "rent" }),
      entry({ id: "salary", kind: "income", description: "Salary", category: "Home" }),
    ];
    const payments = [
      payment({ entryId: "rent", amount: 120_000 }),
      payment({
        id: "salary|2026-01-05",
        entryId: "salary",
        amount: 350_000,
        paidOn: "2026-01-06",
      }),
    ];
    const csv = toCsv(entries, payments);
    expect(csv).toContain("2026-01-05,Rent,Home,expense,-1200.00");
    expect(csv).toContain("2026-01-06,Salary,Home,income,3500.00");
  });

  it("sorts rows chronologically by when they were actually paid", () => {
    const entries = [entry()];
    const payments = [
      payment({ id: "later", paidOn: "2026-03-01" }),
      payment({ id: "earlier", paidOn: "2026-01-01" }),
    ];
    const lines = toCsv(entries, payments).split("\r\n");
    expect(lines[1]).toContain("2026-01-01");
    expect(lines[2]).toContain("2026-03-01");
  });

  it("quotes a description containing a comma", () => {
    const entries = [entry({ description: "Gift, for mom" })];
    const csv = toCsv(entries, [payment()]);
    expect(csv).toContain('"Gift, for mom"');
  });

  it("doubles an internal quote and wraps the field", () => {
    const entries = [entry({ description: 'The "good" one' })];
    const csv = toCsv(entries, [payment()]);
    expect(csv).toContain('"The ""good"" one"');
  });

  it("leaves a plain field unquoted", () => {
    const entries = [entry({ description: "Rent" })];
    const csv = toCsv(entries, [payment()]);
    expect(csv.split("\r\n")[1].startsWith("2026-01-05,Rent,")).toBe(true);
  });

  it("skips a deleted payment", () => {
    const entries = [entry()];
    const payments = [payment({ deletedAt: "2026-01-06T00:00:00.000Z" })];
    expect(toCsv(entries, payments)).toBe("Date,Description,Category,Type,Amount");
  });

  it("skips a payment whose entry no longer exists", () => {
    const entries = [entry({ deletedAt: "2026-01-06T00:00:00.000Z" })];
    expect(toCsv(entries, [payment()])).toBe("Date,Description,Category,Type,Amount");
  });

  it("renders whole cents without a thousands separator, for spreadsheet parsing", () => {
    const entries = [entry()];
    const payments = [payment({ amount: 1_234_567 })];
    expect(toCsv(entries, payments)).toContain("-12345.67");
  });
});
