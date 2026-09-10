import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<TData> {
  readonly data?: TData | undefined;
  readonly error?: unknown;
  readonly loading: boolean;
  readonly reload: () => void;
}

// Not TanStack Query: four requests in this page's life, and a cached slot list is the wrong thing
// to show. The `ignore` guard stops a slow response painting the wrong day's times.
export function useAsync<TData>(
  load: () => Promise<TData>,
  deps: readonly unknown[],
  enabled = true,
): AsyncState<TData> {
  const [state, setState] = useState<{ data?: TData; error?: unknown; loading: boolean }>({
    loading: enabled,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false });
      return;
    }

    let ignore = false;
    setState({ loading: true });

    load()
      .then((data) => {
        if (!ignore) {
          setState({ data, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setState({ error, loading: false });
        }
      });

    return () => {
      ignore = true;
    };
    // `load` is deliberately not a dependency: the caller passes a fresh arrow every render, so
    // depending on it would re-fetch forever.
  }, [...deps, enabled, nonce]);

  return { ...state, reload };
}
