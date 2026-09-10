import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useClinicLogo } from '@web/lib/use-clinic-logo';

const CLINIC = '11111111-1111-4111-8111-111111111111';
const URL_ONE = 'https://storage.example/signed/logo-one.png';
const URL_TWO = 'https://storage.example/signed/logo-two.png';

describe('useClinicLogo', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('has nothing to draw on a first visit', () => {
    const { result } = renderHook(() => useClinicLogo(CLINIC, undefined));

    expect(result.current).toBeNull();
  });

  // The whole point: on the second visit the rail is branded before the response lands.
  it('draws the last URL this browser saw while the response is in flight', async () => {
    const first = renderHook(({ live }) => useClinicLogo(CLINIC, live), {
      initialProps: { live: URL_ONE as string | null | undefined },
    });

    await waitFor(() => expect(first.result.current).toBe(URL_ONE));
    first.unmount();

    const second = renderHook(() => useClinicLogo(CLINIC, undefined));

    await waitFor(() => expect(second.result.current).toBe(URL_ONE));
  });

  it('lets the response overrule the cache, and remembers the new one', async () => {
    renderHook(() => useClinicLogo(CLINIC, URL_ONE));

    const next = renderHook(() => useClinicLogo(CLINIC, URL_TWO));
    expect(next.result.current).toBe(URL_TWO);
    next.unmount();

    const later = renderHook(() => useClinicLogo(CLINIC, undefined));
    await waitFor(() => expect(later.result.current).toBe(URL_TWO));
  });

  // A clinic that removed its logo must not keep seeing it from its own browser.
  it('clears a remembered URL when the clinic no longer has one', async () => {
    renderHook(() => useClinicLogo(CLINIC, URL_ONE));
    renderHook(() => useClinicLogo(CLINIC, null));

    const later = renderHook(() => useClinicLogo(CLINIC, undefined));

    await waitFor(() => expect(later.result.current).toBeNull());
  });

  it("keeps one clinic's mark out of another's", async () => {
    renderHook(() => useClinicLogo(CLINIC, URL_ONE));

    const other = renderHook(() =>
      useClinicLogo('22222222-2222-4222-8222-222222222222', undefined),
    );

    await waitFor(() => expect(other.result.current).toBeNull());
  });
});
