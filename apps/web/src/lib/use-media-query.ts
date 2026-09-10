import { useSyncExternalStore } from 'react';

// Kept as a number so the one component that needs the breakpoint in JavaScript agrees with the
// CSS.
export const MD_BREAKPOINT = 768;

// `useSyncExternalStore` reads its snapshot during the first render, so a layout paints correctly
// instead of flashing the wrong shape. Falls back to the desktop shape.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => undefined;
      }

      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

/** True below Tailwind's `md` — where the table becomes a stack of cards. */
export const useIsMobile = (): boolean => useMediaQuery(`(max-width: ${MD_BREAKPOINT - 1}px)`);
