import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Entry, Ledger, Payment } from "../src/types.ts";
import { MAX_SPACE_BYTES, evictStaleSpaces, handleSync, shouldEvict } from "./sync.ts";
import type { SyncEnv } from "./sync.ts";

const SPACE = "a".repeat(64);
const OTHER_SPACE = "b".repeat(64);

interface Row {
  data: string;
  updated_at: string;
}

/**
 * A stand-in for D1 that understands only the three statements this module
 * issues. Anything else is a mistake worth failing loudly on rather than
 * silently returning nothing.
 */
function fakeDatabase(seed: Record<string, Row> = {}) {
  const rows = new Map<string, Row>(Object.entries(seed));

  const db = {
    rows,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (!query.startsWith("SELECT")) {
                throw new Error(`first() on unexpected query: ${query}`);
              }
              const row = rows.get(String(values[0]));
              return (row ?? null) as T | null;
            },
            async run() {
              if (query.startsWith("INSERT")) {
                rows.set(String(values[0]), {
                  data: String(values[1]),
                  updated_at: String(values[2]),
                });
                return { meta: { changes: 1 } };
              }
              if (query.startsWith("DELETE")) {
                const cutoff = String(values[0]);
                const stale: string[] = [];
                rows.forEach((row, id) => {
                  if (row.updated_at < cutoff) stale.push(id);
                });
                for (const id of stale) rows.delete(id);
                return { meta: { changes: stale.length } };
              }
              throw new Error(`run() on unexpected query: ${query}`);
            },
          };
        },
      };
    },
  };

  return db as unknown as SyncEnv["DB"] & { rows: Map<string, Row> };
}

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

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function ledgerFrom(response: Response): Promise<Ledger> {
  const payload = (await response.json()) as { ledger: Ledger };
  return payload.ledger;
}

const NOW = new Date("2026-02-01T00:00:00.000Z");

describe("handleSync", () => {
  it("rejects anything but POST", async () => {
    const response = await handleSync(
      new Request("https://example.com/api/sync"),
      { DB: fakeDatabase() },
      NOW,
    );
    assert.equal(response.status, 405);
  });

  it("rejects a body that is not JSON", async () => {
    const response = await handleSync(post("{{{"), { DB: fakeDatabase() }, NOW);
    assert.equal(response.status, 400);
  });

  it("rejects a space id that is not a hash", async () => {
    for (const space of ["", "short", "../etc", "A".repeat(64), "a".repeat(63)]) {
      const response = await handleSync(
        post({ space, ledger: { entries: [], payments: [] } }),
        { DB: fakeDatabase() },
        NOW,
      );
      assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(space)}`);
    }
  });

  it("rejects an oversized body before parsing it", async () => {
    const response = await handleSync(
      post({ space: SPACE }, { "content-length": String(10_000_000) }),
      { DB: fakeDatabase() },
      NOW,
    );
    assert.equal(response.status, 413);
  });

  it("stores a ledger and gives it straight back", async () => {
    const db = fakeDatabase();
    const response = await handleSync(
      post({ space: SPACE, ledger: { entries: [entry()], payments: [payment()] } }),
      { DB: db },
      NOW,
    );

    assert.equal(response.status, 200);
    const ledger = await ledgerFrom(response);
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.payments.length, 1);
    assert.ok(db.rows.has(SPACE));
  });

  it("never caches a response", async () => {
    const response = await handleSync(
      post({ space: SPACE, ledger: { entries: [], payments: [] } }),
      { DB: fakeDatabase() },
      NOW,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("merges a second device into the first", async () => {
    const db = fakeDatabase();
    await handleSync(
      post({ space: SPACE, ledger: { entries: [entry({ id: "a" })], payments: [] } }),
      { DB: db },
      NOW,
    );
    const response = await handleSync(
      post({ space: SPACE, ledger: { entries: [entry({ id: "b" })], payments: [] } }),
      { DB: db },
      NOW,
    );

    const ledger = await ledgerFrom(response);
    assert.deepEqual(
      ledger.entries.map((record) => record.id).toSorted(),
      ["a", "b"],
    );
  });

  it("returns what the other device wrote, even when this one sends nothing", async () => {
    const db = fakeDatabase();
    await handleSync(
      post({ space: SPACE, ledger: { entries: [entry()], payments: [] } }),
      { DB: db },
      NOW,
    );
    const response = await handleSync(
      post({ space: SPACE, ledger: { entries: [], payments: [] } }),
      { DB: db },
      NOW,
    );

    assert.equal((await ledgerFrom(response)).entries.length, 1);
  });

  it("lets the newer version of a record win", async () => {
    const db = fakeDatabase();
    await handleSync(
      post({
        space: SPACE,
        ledger: { entries: [entry({ description: "Old" })], payments: [] },
      }),
      { DB: db },
      NOW,
    );
    const response = await handleSync(
      post({
        space: SPACE,
        ledger: {
          entries: [entry({ description: "New", updatedAt: "2026-01-20T00:00:00.000Z" })],
          payments: [],
        },
      }),
      { DB: db },
      NOW,
    );

    assert.equal((await ledgerFrom(response)).entries[0].description, "New");
  });

  it("keeps spaces apart", async () => {
    const db = fakeDatabase();
    await handleSync(
      post({ space: SPACE, ledger: { entries: [entry()], payments: [] } }),
      { DB: db },
      NOW,
    );
    const response = await handleSync(
      post({ space: OTHER_SPACE, ledger: { entries: [], payments: [] } }),
      { DB: db },
      NOW,
    );

    assert.equal((await ledgerFrom(response)).entries.length, 0);
  });

  it("drops junk rows instead of failing the whole request", async () => {
    const response = await handleSync(
      post({
        space: SPACE,
        ledger: { entries: [entry(), { nope: true }, null], payments: "not an array" },
      }),
      { DB: fakeDatabase() },
      NOW,
    );

    assert.equal(response.status, 200);
    const ledger = await ledgerFrom(response);
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.payments.length, 0);
  });

  it("rebuilds from the client when the stored row is unreadable", async () => {
    const db = fakeDatabase({
      [SPACE]: { data: "not json at all", updated_at: "2026-01-01T00:00:00.000Z" },
    });
    const response = await handleSync(
      post({ space: SPACE, ledger: { entries: [entry()], payments: [] } }),
      { DB: db },
      NOW,
    );

    assert.equal(response.status, 200);
    assert.equal((await ledgerFrom(response)).entries.length, 1);
  });

  it("refuses to grow a space past its ceiling", async () => {
    const entries = Array.from({ length: 4_000 }, (_, index) =>
      entry({ id: `e${index}`, note: "x".repeat(180) }),
    );
    const body = JSON.stringify({ space: SPACE, ledger: { entries, payments: [] } });
    assert.ok(body.length > MAX_SPACE_BYTES, "fixture should exceed the ceiling");

    const response = await handleSync(post(body), { DB: fakeDatabase() }, NOW);
    assert.equal(response.status, 413);
  });

  it("forgets a tombstone once every device has had time to see it", async () => {
    const db = fakeDatabase();
    const longAgo = "2025-01-01T00:00:00.000Z";
    const response = await handleSync(
      post({
        space: SPACE,
        ledger: {
          entries: [entry({ deletedAt: longAgo, updatedAt: longAgo })],
          payments: [],
        },
      }),
      { DB: db },
      NOW,
    );

    assert.equal((await ledgerFrom(response)).entries.length, 0);
  });
});

describe("evictStaleSpaces", () => {
  it("removes spaces nothing has touched in over a year", async () => {
    const db = fakeDatabase({
      [SPACE]: { data: "{}", updated_at: "2026-01-15T00:00:00.000Z" },
      [OTHER_SPACE]: { data: "{}", updated_at: "2023-01-01T00:00:00.000Z" },
    });

    const removed = await evictStaleSpaces({ DB: db }, NOW);
    assert.equal(removed, 1);
    assert.ok(db.rows.has(SPACE));
    assert.ok(!db.rows.has(OTHER_SPACE));
  });
});

describe("shouldEvict", () => {
  it("samples in rarely and never on most requests", () => {
    assert.equal(shouldEvict(0), true);
    assert.equal(shouldEvict(0.005), true);
    assert.equal(shouldEvict(0.5), false);
    assert.equal(shouldEvict(0.99), false);
  });
});
