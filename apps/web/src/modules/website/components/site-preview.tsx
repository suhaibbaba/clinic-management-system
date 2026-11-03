import {
  readSiteEditorMessage,
  SITE_PREVIEW_MESSAGE,
  type PublicSite,
  type SiteEditorMessage,
  type SitePreviewEdit,
} from "@clinic/shared";
import { useEffect, useRef, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@clinic/ui/lib/cn";
import { SITE_PREVIEW_SRC } from "@web/modules/website/constants";

export function SitePreview({
  site,
  edit,
  mobile,
  path,
  onEditorMessage,
}: {
  readonly site: PublicSite;
  readonly edit?: SitePreviewEdit;
  readonly mobile: boolean;
  readonly path: string;
  readonly onEditorMessage?: (message: SiteEditorMessage) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ site, edit, onEditorMessage });

  latest.current = { site, edit, onEditorMessage };

  useEffect(() => {
    const send = (): void =>
      frame.current?.contentWindow?.postMessage(
        { type: SITE_PREVIEW_MESSAGE.SITE, site: latest.current.site, edit: latest.current.edit },
        window.location.origin,
      );

    const receive = (event: MessageEvent): void => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow
      ) {
        return;
      }

      if ((event.data as { type?: unknown } | null)?.type === SITE_PREVIEW_MESSAGE.READY) {
        send();
        return;
      }

      const message = readSiteEditorMessage(event.data);

      if (message) {
        latest.current.onEditorMessage?.(message);
      }
    };

    window.addEventListener("message", receive);

    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage(
      { type: SITE_PREVIEW_MESSAGE.SITE, site, edit },
      window.location.origin,
    );
  }, [site, edit]);

  return (
    <div
      data-testid="site-preview"
      className={cn(
        "mx-auto h-full w-full overflow-hidden bg-surface",
        mobile && "max-w-[390px] rounded-card border border-line shadow-float",
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
