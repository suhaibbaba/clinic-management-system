import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<TData> {
  readonly data?: TData | undefined;
  readonly error?: unknown;
  readonly loading: boolean;
  /** Runs the loader again — the "try again" button, and the slot refresh. */
  readonly reload: () => void;
}

/**
 * One request, tied to a few values.
 *
 * TanStack Query does this and a great deal more — caching, retries, window
 * focus revalidation — none of which this page wants: it makes at most four
 * requests in its whole life, and a *cached* slot list is precisely the wrong
 * thing to show someone about to book one. Twenty lines instead of 13 KB.
 *
 * The stale-response guard is the part that earns its keep. Change the day
 * twice quickly and two requests are in flight; without `ignore` the slower
 * one lands last and paints the wrong day's times over the right ones.
 */
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
    // `load` is deliberately not a dependency: the caller passes a fresh arrow
    // function every render, so depending on it would re-fetch forever. What
    // the request actually varies with is `deps`, which the caller names.
  }, [...deps, enabled, nonce]);

  return { ...state, reload };
}
