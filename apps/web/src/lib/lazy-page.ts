import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOADED = "lazy-page-reloaded";

// A page's code missing is a stale tab, not a bug: a deploy (or the dev server re-bundling) replaced
// the files it was built against. One reload fetches the current ones; a second failure is real
// and goes to the error boundary.
/** `lazy()` that recovers from a chunk that no longer loads by reloading the page once. */
export function lazyPage<TProps extends object>(
  load: () => Promise<{ default: ComponentType<TProps> }>,
): LazyExoticComponent<ComponentType<TProps>> {
  return lazy(async () => {
    try {
      const module = await load();
      forget();
      return module;
    } catch (error) {
      if (!alreadyReloaded()) {
        remember();
        window.location.reload();
        // Never settles: the page is going away.
        return new Promise<never>(() => undefined);
      }

      throw error;
    }
  });
}

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOADED) !== null;
  } catch {
    return true;
  }
}

function remember(): void {
  try {
    sessionStorage.setItem(RELOADED, "1");
  } catch {
    // Storage blocked: the boundary shows the reload button instead.
  }
}

function forget(): void {
  try {
    sessionStorage.removeItem(RELOADED);
  } catch {
    // Nothing to forget.
  }
}
