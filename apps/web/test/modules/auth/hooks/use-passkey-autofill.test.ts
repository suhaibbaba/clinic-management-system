import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PASSKEY_AUTOFILL_REFRESH_MS,
  PASSKEY_AUTOFILL_RETRY_MS,
} from "@web/modules/auth/constants";
import { usePasskeyAutofill } from "@web/modules/auth/hooks/use-passkey-autofill";

const browser = vi.hoisted(() => ({
  supportsAutofill: vi.fn<() => Promise<boolean>>(),
  cancelCeremony: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthnAutofill: browser.supportsAutofill,
  WebAuthnAbortService: { cancelCeremony: browser.cancelCeremony },
}));

const failure = (name: string): Error => Object.assign(new Error(name), { name });

const settle = (): Promise<void> => act(async () => {});

describe("usePasskeyAutofill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    browser.supportsAutofill.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("offers the passkey as soon as the page opens", async () => {
    const signIn = vi.fn(() => new Promise<void>(() => {}));

    renderHook(() => usePasskeyAutofill(signIn, vi.fn(), false));
    await settle();

    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on a browser without passkey autofill", async () => {
    browser.supportsAutofill.mockResolvedValue(false);
    const signIn = vi.fn(() => new Promise<void>(() => {}));

    renderHook(() => usePasskeyAutofill(signIn, vi.fn(), false));
    await settle();

    expect(signIn).not.toHaveBeenCalled();
  });

  it("asks again before the server's challenge expires", async () => {
    const signIn = vi.fn(() => new Promise<void>(() => {}));

    renderHook(() => usePasskeyAutofill(signIn, vi.fn(), false));
    await settle();
    await act(async () => vi.advanceTimersByTimeAsync(PASSKEY_AUTOFILL_REFRESH_MS));

    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it("ignores an aborted request, which is the button or a refresh taking over", async () => {
    const onError = vi.fn();
    const signIn = vi.fn(() => Promise.reject(failure("AbortError")));

    renderHook(() => usePasskeyAutofill(signIn, onError, false));
    await settle();

    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a failure and tries again after a pause, not in a loop", async () => {
    const onError = vi.fn();
    const signIn = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(() => new Promise<void>(() => {}));

    renderHook(() => usePasskeyAutofill(signIn, onError, false));
    await settle();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(PASSKEY_AUTOFILL_RETRY_MS));

    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it("waits while the passkey button runs its own sign-in", async () => {
    const signIn = vi.fn(() => new Promise<void>(() => {}));

    renderHook(() => usePasskeyAutofill(signIn, vi.fn(), true));
    await settle();

    expect(signIn).not.toHaveBeenCalled();
  });

  it("cancels the waiting request when the page closes", async () => {
    const { unmount } = renderHook(() =>
      usePasskeyAutofill(() => new Promise<void>(() => {}), vi.fn(), false),
    );
    await settle();

    unmount();

    expect(browser.cancelCeremony).toHaveBeenCalled();
  });
});
