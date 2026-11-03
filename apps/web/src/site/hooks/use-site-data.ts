import {
  readSitePreviewMessage,
  SITE_PREVIEW_MESSAGE,
  type PublicSite,
  type SitePreviewEdit,
} from "@clinic/shared";
import { useCallback, useEffect, useState } from "react";
import { siteApi } from "@web/site/api";
import type { SiteSource } from "@web/site/route";

export interface SiteData {
  readonly site: PublicSite | undefined;
  readonly edit: SitePreviewEdit | null;
  readonly error: unknown;
  readonly loading: boolean;
  readonly reload: () => void;
}

export function useSiteData(route: SiteSource): SiteData {
  const [site, setSite] = useState<PublicSite>();
  const [edit, setEdit] = useState<SitePreviewEdit | null>(null);
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    if (route.kind !== "preview") {
      return;
    }

    const receive = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin || event.source !== window.parent) {
        return;
      }

      const payload = readSitePreviewMessage(event.data);

      if (payload) {
        setSite(payload.site);
        setEdit(payload.edit);
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

  return { site, edit, error, loading: site === undefined && error === undefined, reload };
}
