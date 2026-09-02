import { describe, expect, it } from "vitest";

import type { Entry, Ledger, Payment } from "../types.ts";
import {
  emptyLedger,
  liveLedger,
  mergeLedgers,
  mergeRecords,
  pruneLedger,
  sanitiseLedger,
} from "./merge.ts";

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

describe("mergeRecords", () => {
  it("keeps records that exist on only one side", () => {
    const merged = mergeRecords([entry({ id: "a" })], [entry({ id: "b" })]);
    expect(merged.map((record) => record.id).toSorted()).toEqual(["a", "b"]);
  });

  it("keeps the more recent version of a record", () => {
    const older = entry({ description: "Old", updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = entry({ description: "New", updatedAt: "2026-02-01T00:00:00.000Z" });
    expect(mergeRecords([older], [newer])[0].description).toBe("New");
    expect(mergeRecords([newer], [older])[0].description).toBe("New");
  });

  it("lets a later delete win over an earlier edit", () => {
    const edited = entry({ description: "Edited", updatedAt: "2026-01-01T00:00:00.000Z" });
    const deleted = entry({
      updatedAt: "2026-01-02T00:00:00.000Z",
      deletedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mergeRecords([edited], [deleted])[0].deletedAt).toBeTruthy();
  });

  it("lets an edit win over an earlier delete, so an undo can be synced", () => {
    const deleted = entry({
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: "2026-01-01T00:00:00.000Z",
    });
    const restored = entry({ updatedAt: "2026-01-05T00:00:00.000Z", deletedAt: null });
    expect(mergeRecords([deleted], [restored])[0].deletedAt).toBeNull();
  });

  it("breaks an exact timestamp tie in favour of the delete", () => {
    const stamp = "2026-01-03T00:00:00.000Z";
    const edited = entry({ description: "Edited", updatedAt: stamp });
    const deleted = entry({ updatedAt: stamp, deletedAt: stamp });
    expect(mergeRecords([edited], [deleted])[0].deletedAt).toBe(stamp);
    expect(mergeRecords([deleted], [edited])[0].deletedAt).toBe(stamp);
  });

  it("is symmetric, so both devices reach the same state", () => {
    const left = [entry({ id: "a" }), entry({ id: "b", updatedAt: "2026-03-01T00:00:00.000Z" })];
    const right = [entry({ id: "b" }), entry({ id: "c" })];
    const forwards = mergeRecords(left, right)
      .map((record) => `${record.id}:${record.updatedAt}`)
      .toSorted();
    const backwards = mergeRecords(right, left)
      .map((record) => `${record.id}:${record.updatedAt}`)
      .toSorted();
    expect(forwards).toEqual(backwards);
  });

  it("is idempotent", () => {
    const records = [entry({ id: "a" }), entry({ id: "b" })];
    expect(mergeRecords(records, records)).toHaveLength(2);
  });
});

describe("mergeLedgers", () => {
  it("merges both collections at once", () => {
    const local: Ledger = { entries: [entry({ id: "a" })], payments: [] };
    const remote: Ledger = { entries: [], payments: [payment({ entryId: "a", id: "p1" })] };
    const merged = mergeLedgers(local, remote);
    expect(merged.entries).toHaveLength(1);
    expect(merged.payments).toHaveLength(1);
  });

  it("resolves the same bill ticked off on two devices to one payment", () => {
    // The payment id is derived from the entry and the occurrence, so two
    // offline devices produce the same id rather than two rival records.
    const phone: Ledger = {
      entries: [entry()],
      payments: [payment({ amount: 120_000, updatedAt: "2026-01-05T09:00:00.000Z" })],
    };
    const laptop: Ledger = {
      entries: [entry()],
      payments: [payment({ amount: 118_000, updatedAt: "2026-01-05T10:00:00.000Z" })],
    };
    const merged = mergeLedgers(phone, laptop);
    expect(merged.payments).toHaveLength(1);
    expect(merged.payments[0].amount).toBe(118_000);
  });
});

describe("pruneLedger", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("keeps a recent tombstone so the delete still propagates", () => {
    const recent = entry({
      deletedAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z",
    });
    expect(pruneLedger({ entries: [recent], payments: [] }, now).entries).toHaveLength(1);
  });

  it("drops a tombstone every device has long since seen", () => {
    const ancient = entry({
      deletedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(pruneLedger({ entries: [ancient], payments: [] }, now).entries).toHaveLength(0);
  });

  it("drops payments whose entry is gone for good", () => {
    const ledger: Ledger = {
      entries: [
        entry({ deletedAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" }),
      ],
      payments: [payment()],
    };
    expect(pruneLedger(ledger, now).payments).toHaveLength(0);
  });

  it("keeps payments belonging to a live entry", () => {
    const ledger: Ledger = { entries: [entry()], payments: [payment()] };
    expect(pruneLedger(ledger, now).payments).toHaveLength(1);
  });
});

describe("liveLedger", () => {
  it("hides tombstones from the interface", () => {
    const ledger: Ledger = {
      entries: [entry({ id: "a" }), entry({ id: "b", deletedAt: "2026-01-02T00:00:00.000Z" })],
      payments: [payment({ deletedAt: "2026-01-02T00:00:00.000Z" })],
    };
    const live = liveLedger(ledger);
    expect(live.entries.map((record) => record.id)).toEqual(["a"]);
    expect(live.payments).toEqual([]);
  });
});

describe("sanitiseLedger", () => {
  it("returns an empty ledger for junk", () => {
    expect(sanitiseLedger(null)).toEqual(emptyLedger());
    expect(sanitiseLedger("nope")).toEqual(emptyLedger());
    expect(sanitiseLedger(42)).toEqual(emptyLedger());
  });

  it("drops malformed rows and keeps the good ones", () => {
    const result = sanitiseLedger({
      entries: [entry({ id: "good" }), { description: "no id" }, null, 7],
      payments: [payment({ id: "p", entryId: "good" }), { id: "orphan" }],
    });
    expect(result.entries.map((record) => record.id)).toEqual(["good"]);
    expect(result.payments.map((record) => record.id)).toEqual(["p"]);
  });

  it("forces amounts to whole cents", () => {
    const result = sanitiseLedger({ entries: [{ ...entry(), amount: 12.7 }], payments: [] });
    expect(result.entries[0].amount).toBe(13);
  });

  it("falls back to a safe value for an unknown repeat or kind", () => {
    const result = sanitiseLedger({
      entries: [{ ...entry(), kind: "gift", repeat: "hourly" }],
      payments: [],
    });
    expect(result.entries[0].kind).toBe("expense");
    expect(result.entries[0].repeat).toBe("none");
  });

  it("caps long text so one row cannot blow up the payload", () => {
    const result = sanitiseLedger({
      entries: [{ ...entry(), description: "x".repeat(10_000) }],
      payments: [],
    });
    expect(result.entries[0].description.length).toBeLessThanOrEqual(200);
  });
});
