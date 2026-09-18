import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInstallPrompt } from "@web/lib/use-install-prompt";

function raiseOffer() {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };

  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted" as const });
  act(() => void window.dispatchEvent(event));

  return event;
}

const agent = (value: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(value);

describe("useInstallPrompt", () => {
  it("offers nothing until the browser says it can install", () => {
    agent("Mozilla/5.0 (X11; Linux) Chrome/140");

    expect(renderHook(() => useInstallPrompt()).result.current.state).toBe("unavailable");
  });

  it("turns the browser’s offer into one the page can raise", async () => {
    agent("Mozilla/5.0 (X11; Linux) Chrome/140");
    const { result } = renderHook(() => useInstallPrompt());

    const event = raiseOffer();
    expect(result.current.state).toBe("available");

    await act(() => result.current.install());
    expect(event.prompt).toHaveBeenCalled();
    // The browser hands over a fresh event if it is still installable; this one is spent.
    expect(result.current.state).toBe("unavailable");
  });

  // Chromium shows its own bar as well unless the event is claimed.
  it("claims the event so the page is not saying it twice", () => {
    agent("Mozilla/5.0 (X11; Linux) Chrome/140");
    renderHook(() => useInstallPrompt());

    const event = raiseOffer();
    expect(event.defaultPrevented).toBe(true);
  });

  // Safari fires no event at all, so the recipe is the only thing to offer.
  it("falls back to instructions on iOS", () => {
    agent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");

    expect(renderHook(() => useInstallPrompt()).result.current.state).toBe("manual");
  });

  it("says nothing to offer once it is running from a home screen", () => {
    agent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1");
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);

    expect(renderHook(() => useInstallPrompt()).result.current.state).toBe("installed");
  });
});
