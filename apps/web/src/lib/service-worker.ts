/**
 * The worker precaches the shell and nothing else — never `/api`. A cached medical response would
 * outlive the logout and the role change that should have ended it, on hardware a clinic shares.
 */
const listeners = new Set<() => void>();

let waiting = false;
let apply: (() => Promise<void>) | null = null;

function announce(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  void import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        waiting = true;
        apply = () => updateSW(true);
        announce();
      },
    });
  });
}

// `useSyncExternalStore` over a module store, because the worker announces itself long after the
// tree has mounted and from outside React entirely.
export function subscribeToUpdate(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export const updateWaiting = (): boolean => waiting;

/** Activates the waiting worker; it reloads the page itself once it has taken over. */
export const applyUpdate = async (): Promise<void> => apply?.();
