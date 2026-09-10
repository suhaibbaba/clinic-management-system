import { useEffect, useState } from 'react';

export function useDebounced<TValue>(value: TValue, delay = 300): TValue {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
