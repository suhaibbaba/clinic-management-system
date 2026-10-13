import { useCallback, useEffect, useState } from "react";

interface Location {
  readonly pathname: string;
  readonly params: URLSearchParams;
}

const read = (): Location => ({
  pathname: window.location.pathname,
  params: new URLSearchParams(window.location.search),
});

export interface SiteLocation extends Location {
  readonly navigate: (to: string) => void;
  readonly setParams: (changes: Record<string, string | null>) => void;
}

export function useSiteLocation(): SiteLocation {
  const [location, setLocation] = useState(read);

  useEffect(() => {
    const sync = (): void => setLocation(read());

    window.addEventListener("popstate", sync);

    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    setLocation(read());
    window.scrollTo({ top: 0 });
  }, []);

  const setParams = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    const query = next.toString();

    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    setLocation(read());
  }, []);

  return { ...location, navigate, setParams };
}
