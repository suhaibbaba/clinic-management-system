import { useCallback, useEffect, useState } from "react";

export interface VendorLocation {
  readonly pathname: string;
  readonly params: URLSearchParams;
  readonly navigate: (to: string, options?: { readonly replace?: boolean }) => void;
}

export function useLocation(): VendorLocation {
  const [href, setHref] = useState(() => window.location.href);

  useEffect(() => {
    const sync = (): void => setHref(window.location.href);

    window.addEventListener("popstate", sync);

    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate = useCallback((to: string, options?: { readonly replace?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }

    setHref(window.location.href);
  }, []);

  const url = new URL(href);

  return { pathname: url.pathname, params: url.searchParams, navigate };
}
