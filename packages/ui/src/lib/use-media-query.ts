import { useSyncExternalStore } from "react";

export const MD_BREAKPOINT = 768;
export const RAIL_BREAKPOINT = 1025;

// `useSyncExternalStore` reads its snapshot during the first render, so a layout paints correctly
// instead of flashing the wrong shape. Falls back to the desktop shape.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => undefined;
      }

      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () =>
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

/** True below Tailwind's `md` — where the table becomes a stack of cards. */
export const useIsMobile = (): boolean => useMediaQuery(`(max-width: ${MD_BREAKPOINT - 1}px)`);

/** True below the `rail` breakpoint, where the header's menu button and a drawer replace the rail. */
// The exact negation of CSS's `rail:`, so a zoomed page at 1024.5px cannot fall between the two.
export const useIsCompactLayout = (): boolean =>
  useMediaQuery(`not all and (min-width: ${RAIL_BREAKPOINT}px)`);
