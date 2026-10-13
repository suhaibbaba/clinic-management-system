import { SITE_PREVIEW_MESSAGE, type PublicSite } from "@clinic/shared";
import { useCallback, useEffect, useState } from "react";
import { siteApi } from "@web/site/api";
import type { SiteSource } from "@web/site/route";

export interface SiteData {
  readonly site: PublicSite | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly reload: () => void;
}

const isPreviewMessage = (data: unknown): data is { type: string; site: PublicSite } =>
  typeof data === "object" &&
  data !== null &&
  (data as { type?: unknown }).type === SITE_PREVIEW_MESSAGE.SITE &&
  typeof (data as { site?: unknown }).site === "object";

export function useSiteData(route: SiteSource): SiteData {
  const [site, setSite] = useState<PublicSite>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    if (route.kind !== "preview") {
      return;
    }

    const receive = (event: MessageEvent): void => {
      if (event.origin === window.location.origin && isPreviewMessage(event.data)) {
        setSite(event.data.site);
      }
    };

    window.addEventListener("message", receive);
    window.parent.postMessage({ type: SITE_PREVIEW_MESSAGE.READY }, window.location.origin);

    return () => window.removeEventListener("message", receive);
  }, [route.kind]);

  useEffect(() => {
    if (route.kind === "preview") {
      return;
    }

    let cancelled = false;
    setError(undefined);

    void (route.kind === "slug" ? siteApi.bySlug(route.slug) : siteApi.byHost())
      .then((next) => {
        if (!cancelled) {
          setSite(next);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setError(failure);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [route, attempt]);

  return { site, error, loading: site === undefined && error === undefined, reload };
}
