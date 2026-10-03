import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRememberMe } from "@web/modules/auth/hooks/use-remember-me";

describe("useRememberMe", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("remembers by default, so nobody is signed out for not answering", () => {
    const { result } = renderHook(() => useRememberMe());

    expect(result.current[0]).toBe(true);
  });

  it("keeps a declined choice for the next sign-in on this browser", () => {
    const first = renderHook(() => useRememberMe());

    act(() => first.result.current[1](false));

    expect(first.result.current[0]).toBe(false);
    first.unmount();

    expect(renderHook(() => useRememberMe()).result.current[0]).toBe(false);
  });

  it("falls back to remembering when the stored value is not one it wrote", () => {
    localStorage.setItem("clinic.rememberMe", "maybe");

    expect(renderHook(() => useRememberMe()).result.current[0]).toBe(true);
  });
});
