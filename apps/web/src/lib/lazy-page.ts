import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOADED = "lazy-page-reloaded";

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
  } catch {}
}

function forget(): void {
  try {
    sessionStorage.removeItem(RELOADED);
  } catch {}
}
