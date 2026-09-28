import { isStandalone } from "@web/shared/hooks/use-install-prompt";

const UPDATE_CHECK_MS = 30 * 60 * 1000;

const STANDALONE_RESUME_CHECK_MS = 60 * 1000;

let registration: ServiceWorkerRegistration | undefined;
let updating = false;
const listeners = new Set<() => void>();

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

export async function checkForUpdate(): Promise<void> {
  try {
    await registration?.update();
  } catch {}
}

export function watchRegistration(registered: ServiceWorkerRegistration): void {
  registration = registered;

  registered.addEventListener("updatefound", () => {
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
