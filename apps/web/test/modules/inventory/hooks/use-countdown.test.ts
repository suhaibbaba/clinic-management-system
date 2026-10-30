import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "@web/modules/inventory/hooks/use-countdown";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down once a second while running and stops at zero", () => {
    const { result } = renderHook(() => useCountdown(3, true));

    expect(result.current).toBe(3);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(2);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(0);
  });

  it("starts over each time it runs again", () => {
    const { result, rerender } = renderHook(({ running }) => useCountdown(10, running), {
      initialProps: { running: true },
    });

    act(() => vi.advanceTimersByTime(4000));
    expect(result.current).toBe(6);
    rerender({ running: false });
    expect(result.current).toBe(10);
    rerender({ running: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(9);
  });
});
