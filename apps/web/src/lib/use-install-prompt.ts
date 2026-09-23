import { useCallback, useEffect, useState } from "react";

/** Not in the DOM library: Chromium ships it, no standard defines it. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  /** Running from a home screen already. */
  | "installed"
  /** Chromium offered the prompt, so it can be raised on a click. */
  | "available"
  /** Safari installs only through the share sheet, and exposes no event for it. */
  | "manual"
  /** A desktop browser with nothing to offer, or a tab that has not been offered it. */
  | "unavailable";

/** True when the app runs from a home screen rather than a browser tab. */
export const isStandalone = (): boolean =>
  // An embedded webview may implement neither; not installed is the safe answer.
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  // iOS never adopted `display-mode`, and reports this on `navigator` instead.
  ("standalone" in navigator && navigator.standalone === true);

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac; a touch point is what separates the two.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function useInstallPrompt(): {
  readonly state: InstallState;
  readonly install: () => Promise<void>;
} {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const offered = (raised: Event): void => {
      // Without this Chromium shows its own bar as well, and the page says the same thing twice.
      raised.preventDefault();
      setEvent(raised as InstallPromptEvent);
    };

    const done = (): void => {
      setEvent(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", offered);
    window.addEventListener("appinstalled", done);

    return () => {
      window.removeEventListener("beforeinstallprompt", offered);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const install = useCallback(async (): Promise<void> => {
    if (!event) {
      return;
    }

    await event.prompt();
    await event.userChoice;
    // One prompt per event: the browser hands over a fresh one if it is still installable.
    setEvent(null);
  }, [event]);

  const state: InstallState = installed
    ? "installed"
    : event
      ? "available"
      : isIos()
        ? "manual"
        : "unavailable";

  return { state, install };
}
