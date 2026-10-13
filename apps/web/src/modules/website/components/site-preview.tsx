import { SITE_PREVIEW_MESSAGE, type PublicSite } from "@clinic/shared";
import { useEffect, useRef, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@clinic/ui/lib/cn";
import { SITE_PREVIEW_SRC } from "@web/modules/website/constants";

export function SitePreview({
  site,
  mobile,
  path,
}: {
  readonly site: PublicSite;
  readonly mobile: boolean;
  readonly path: string;
}): JSX.Element {
  const { t } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(site);

  latest.current = site;

  useEffect(() => {
    const send = (): void =>
      frame.current?.contentWindow?.postMessage(
        { type: SITE_PREVIEW_MESSAGE.SITE, site: latest.current },
        window.location.origin,
      );

    const onReady = (event: MessageEvent): void => {
      if (
        event.origin === window.location.origin &&
        event.source === frame.current?.contentWindow &&
        (event.data as { type?: unknown } | null)?.type === SITE_PREVIEW_MESSAGE.READY
      ) {
        send();
      }
    };

    window.addEventListener("message", onReady);

    return () => window.removeEventListener("message", onReady);
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: SITE_PREVIEW_MESSAGE.SITE, site },
      window.location.origin,
    );
  }, [site]);

  return (
    <div
      data-testid="site-preview"
      className={cn(
        "mx-auto h-full w-full overflow-hidden rounded-card border border-line bg-surface shadow-card",
        mobile && "max-w-[390px]",
      )}
    >
      <iframe
        ref={frame}
        title={t("website.preview.title")}
        src={`${SITE_PREVIEW_SRC}${path}`}
        data-testid="site-preview-frame"
        className="block h-full w-full border-0"
      />
    </div>
  );
}
