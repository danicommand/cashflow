import { beforeEach, describe, expect, it } from "vitest";

import type { Entry, Ledger } from "../types.ts";
import {
  buildBackup,
  clearLedger,
  loadLedger,
  loadSettings,
  readBackup,
  saveLedger,
  saveSettings,
} from "./storage.ts";

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

const LEDGER: Ledger = { entries: [entry()], payments: [], budgets: [] };

beforeEach(() => {
  window.localStorage.clear();
});

describe("ledger persistence", () => {
  it("round-trips a ledger", () => {
    expect(saveLedger(LEDGER)).toBe("saved");
    expect(loadLedger()).toEqual(LEDGER);
  });

  it("starts empty", () => {
    expect(loadLedger()).toEqual({ entries: [], payments: [], budgets: [] });
  });

  it("survives a corrupted store rather than throwing", () => {
    window.localStorage.setItem("cashflow.ledger.v1", "{ not json");
    expect(loadLedger()).toEqual({ entries: [], payments: [], budgets: [] });
  });

  it("drops rows that no longer match the shape", () => {
    window.localStorage.setItem(
      "cashflow.ledger.v1",
      JSON.stringify({ entries: [entry(), { junk: true }], payments: "nope" }),
    );
    const loaded = loadLedger();
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.payments).toEqual([]);
  });

  it("refuses a ledger too large to store instead of half-writing it", () => {
    const huge: Ledger = {
      entries: Array.from({ length: 20_000 }, (_, index) =>
        entry({ id: `e${index}`, note: "x".repeat(120) }),
      ),
      payments: [],
      budgets: [],
    };
    expect(saveLedger(huge)).toBe("too-large");
  });

  it("clears the ledger without touching the settings", () => {
    saveLedger(LEDGER);
    saveSettings({ language: "pt", currency: "BRL", theme: "dark", syncCode: "abcdefgh" });
    clearLedger();
    expect(loadLedger().entries).toHaveLength(0);
    expect(loadSettings().language).toBe("pt");
  });
});

describe("settings persistence", () => {
  it("round-trips settings", () => {
    const settings = {
      language: "pt",
      currency: "BRL",
      theme: "dark",
      syncCode: "abcdefgh",
    } as const;
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("falls back to safe values for anything unrecognised", () => {
    window.localStorage.setItem(
      "cashflow.settings.v1",
      JSON.stringify({ language: "fr", currency: "XBT", theme: "neon", syncCode: 5 }),
    );
    expect(loadSettings()).toEqual({
      language: "en",
      currency: "USD",
      theme: "system",
      syncCode: "",
    });
  });
});

describe("backups", () => {
  it("writes a labelled file that reads back as the same ledger", () => {
    const backup = buildBackup(LEDGER);
    expect(backup.app).toBe("cashflow");
    expect(readBackup(JSON.stringify(backup))).toEqual(LEDGER);
  });

  it("also accepts a bare ledger", () => {
    expect(readBackup(JSON.stringify(LEDGER))).toEqual(LEDGER);
  });

  it("rejects a file that is not a ledger at all", () => {
    expect(readBackup("not json")).toBeNull();
    expect(readBackup(JSON.stringify({ some: "other file" }))).toBeNull();
  });

  it("accepts an empty but well-formed ledger", () => {
    expect(readBackup(JSON.stringify({ entries: [], payments: [] }))).toEqual({
      entries: [],
      payments: [],
      budgets: [],
    });
  });
});
