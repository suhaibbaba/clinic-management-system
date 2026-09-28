import { useCallback, useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = "installed" | "available" | "manual" | "unavailable";

export const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  ("standalone" in navigator && navigator.standalone === true);

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
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
