import { afterEach, describe, expect, it, vi } from "vitest";

import { haptic, runViewTransition } from "./interactions.ts";

afterEach(() => vi.restoreAllMocks());

describe("interaction enhancements", () => {
  it("runs the update directly when view transitions are unavailable", () => {
    const update = vi.fn();
    runViewTransition(update);
    expect(update).toHaveBeenCalledOnce();
  });

  it("uses the browser transition when available", () => {
    const update = vi.fn();
    const start = vi.fn((callback: () => void) => callback());
    Object.defineProperty(document, "startViewTransition", { value: start, configurable: true });
    runViewTransition(update);
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });

  it("uses short, distinct haptic patterns when supported", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    haptic("success");
    haptic("delete");
    expect(vibrate).toHaveBeenNthCalledWith(1, 12);
    expect(vibrate).toHaveBeenNthCalledWith(2, [8, 28, 8]);
  });
});
