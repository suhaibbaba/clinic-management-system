import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isRefetching,
  SKELETON_DELAY_MS,
  SKELETON_MIN_VISIBLE_MS,
  useDelayedLoading,
} from '@web/lib/use-delayed-loading';

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('paints nothing while a response arrives inside the delay', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);

    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(SKELETON_MIN_VISIBLE_MS * 2);
    });

    expect(result.current).toBe(false);
  });

  it('shows the skeleton once loading outlasts the delay', () => {
    const { result } = renderHook(() => useDelayedLoading(true));

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });

    expect(result.current).toBe(true);
  });

  it('holds a shown skeleton for its minimum, then drops it', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });
    expect(result.current).toBe(true);

    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(SKELETON_MIN_VISIBLE_MS - 1);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('drops it immediately when the minimum has already elapsed', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS + SKELETON_MIN_VISIBLE_MS);
    });

    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe(false);
  });
});

describe('isRefetching', () => {
  it('is a refetch only where data is already on screen', () => {
    expect(isRefetching({ isPending: true, isFetching: true })).toBe(false);
    expect(isRefetching({ isPending: false, isFetching: true })).toBe(true);
    expect(isRefetching({ isPending: false, isFetching: false })).toBe(false);
  });
});
