import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFabVisible } from "./useFabVisible.ts";

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

beforeEach(() => {
  vi.useFakeTimers();
  scrollTo(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useFabVisible", () => {
  it("starts visible", () => {
    const { result } = renderHook(() => useFabVisible());
    expect(result.current).toBe(true);
  });

  it("hides once the page has scrolled down past the top", () => {
    const { result } = renderHook(() => useFabVisible());
    act(() => {
      scrollTo(100);
      scrollTo(300);
    });
    expect(result.current).toBe(false);
  });

  it("never hides near the top of the page, where there is nothing to clear", () => {
    const { result } = renderHook(() => useFabVisible());
    act(() => {
      scrollTo(40);
      scrollTo(60);
    });
    expect(result.current).toBe(true);
  });

  it("comes back the moment the scroll direction reverses", () => {
    const { result } = renderHook(() => useFabVisible());
    act(() => {
      scrollTo(100);
      scrollTo(400);
    });
    expect(result.current).toBe(false);

    act(() => {
      scrollTo(380);
    });
    expect(result.current).toBe(true);
  });

  it("comes back on its own once scrolling stops", () => {
    const { result } = renderHook(() => useFabVisible());
    act(() => {
      scrollTo(100);
      scrollTo(400);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(true);
  });

  it("ignores a jitter too small to count as a direction", () => {
    const { result } = renderHook(() => useFabVisible());
    act(() => {
      scrollTo(100);
      scrollTo(400);
    });
    expect(result.current).toBe(false);

    act(() => {
      scrollTo(401);
    });
    // One pixel of drift is not "scrolling up" and should not flip the state.
    expect(result.current).toBe(false);
  });

  it("stops listening after unmount", () => {
    const { unmount } = renderHook(() => useFabVisible());
    const addSpy = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
