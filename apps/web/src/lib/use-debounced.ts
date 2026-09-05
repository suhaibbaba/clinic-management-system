import { useEffect, useState } from 'react';

/**
 * Trails a fast-changing value by `delay` milliseconds.
 *
 * Used to keep a search box from firing a request per keystroke: the input
 * stays instant, the query waits until typing pauses.
 */
export function useDebounced<TValue>(value: TValue, delay = 300): TValue {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
