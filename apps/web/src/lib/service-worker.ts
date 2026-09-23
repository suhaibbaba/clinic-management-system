/**
 * The worker precaches the shell and nothing else — never `/api`. A cached medical response would
 * outlive the logout and the role change that should have ended it, on hardware a clinic shares.
 */

import { isStandalone } from "@web/lib/use-install-prompt";

// A clinic leaves the app open all day, and the browser only re-checks the worker on a real
// navigation — which never comes. Without this poll a deploy reaches that tab tomorrow.
const UPDATE_CHECK_MS = 30 * 60 * 1000;

// A home-screen app is resumed from memory rather than navigated to, so reopening it is the launch.
const STANDALONE_RESUME_CHECK_MS = 60 * 1000;

let registration: ServiceWorkerRegistration | undefined;
let updating = false;
const listeners = new Set<() => void>();

/** Whether a newer build is installing; the worker reloads the page once it takes over. */
export function isUpdating(): boolean {
  return updating;
}

export function subscribeUpdating(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setUpdating(next: boolean): void {
  if (updating !== next) {
    updating = next;
    listeners.forEach((listener) => listener());
  }
}

/** Asks the server for a newer worker. Never throws: offline is the offline bar's to say. */
export async function checkForUpdate(): Promise<void> {
  try {
    await registration?.update();
  } catch {
    // Unreachable server; the next check tries again.
  }
}

export function watchRegistration(registered: ServiceWorkerRegistration): void {
  registration = registered;

  registered.addEventListener("updatefound", () => {
    // The first install has nothing to replace, so there is nothing to announce.
    if (navigator.serviceWorker.controller) {
      setUpdating(true);
      registered.installing?.addEventListener("statechange", (event) => {
        if ((event.target as ServiceWorker).state === "redundant") {
          setUpdating(false);
        }
      });
    }
  });

  let lastCheck = Date.now();

  const check = (): void => {
    lastCheck = Date.now();
    void checkForUpdate();
  };

  check();
  setInterval(check, UPDATE_CHECK_MS);

  document.addEventListener("visibilitychange", () => {
    const due = isStandalone() ? STANDALONE_RESUME_CHECK_MS : UPDATE_CHECK_MS;

    if (document.visibilityState === "visible" && Date.now() - lastCheck >= due) {
      check();
    }
  });
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW: (_url, registered) => {
        if (registered) {
          watchRegistration(registered);
        }
      },
    });
  });
}
