import { beforeEach, describe, expect, it } from "vitest";

import { clearLock, hasLock, setLock, verifyLock } from "./lock.ts";

beforeEach(() => {
  window.localStorage.clear();
});

describe("hasLock", () => {
  it("is false with nothing set", () => {
    expect(hasLock()).toBe(false);
  });

  it("is true once a PIN is set", async () => {
    await setLock("1234");
    expect(hasLock()).toBe(true);
  });

  it("is false again after clearing", async () => {
    await setLock("1234");
    clearLock();
    expect(hasLock()).toBe(false);
  });
});

describe("verifyLock", () => {
  it("accepts anything when no PIN is set — there is nothing to check against", async () => {
    expect(await verifyLock("0000")).toBe(true);
  });

  it("accepts the correct PIN", async () => {
    await setLock("4821");
    expect(await verifyLock("4821")).toBe(true);
  });

  it("rejects the wrong PIN", async () => {
    await setLock("4821");
    expect(await verifyLock("0000")).toBe(false);
  });

  it("is exact, not a prefix match", async () => {
    await setLock("4821");
    expect(await verifyLock("48210")).toBe(false);
    expect(await verifyLock("482")).toBe(false);
  });

  it("never stores the PIN itself in localStorage", async () => {
    await setLock("482199");
    const raw = window.localStorage.getItem("cashflow.lock.v1") ?? "";
    expect(raw).not.toContain("482199");
  });

  it("verifies against a freshly changed PIN, not the old one", async () => {
    await setLock("1111");
    await setLock("2222");
    expect(await verifyLock("1111")).toBe(false);
    expect(await verifyLock("2222")).toBe(true);
  });
});

describe("a corrupted lock record", () => {
  it("is treated as no lock rather than throwing", async () => {
    window.localStorage.setItem("cashflow.lock.v1", "{ not json");
    expect(hasLock()).toBe(false);
    expect(await verifyLock("anything")).toBe(true);
  });
});
