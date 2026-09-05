import { useSyncExternalStore } from 'react';

/**
 * Tailwind's `md`. Kept here as a number so the one component that has to know
 * the breakpoint in JavaScript agrees with the CSS that uses it everywhere else.
 */
export const MD_BREAKPOINT = 768;

/**
 * Subscribes to a media query.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the snapshot is
 * read during the first render, so a layout that depends on the query paints
 * correctly the first time instead of flashing the wrong shape and correcting
 * itself after the effect runs.
 *
 * Falls back to `false` where `matchMedia` does not exist — jsdom under test,
 * and any pre-render — which makes the desktop shape the default. That is the
 * right default: it is the one with the full set of columns.
 */
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
