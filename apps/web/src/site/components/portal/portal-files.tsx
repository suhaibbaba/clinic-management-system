import type { PortalAttachment } from "@clinic/shared";
import { useState, type JSX } from "react";
import { Alert } from "@web/booking/ui";
import { portalApi, siteFailureKey } from "@web/site/api";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteImage } from "@web/site/components/site-image";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";

export function PortalFiles({
  patientId,
  files,
  format,
}: {
  readonly patientId: string;
  readonly files: readonly PortalAttachment[];
  readonly format: PortalFormat;
}): JSX.Element {
  const { t } = useSite();
  const [opening, setOpening] = useState<string>();
  const [failure, setFailure] = useState<string>();

  const open = async (file: PortalAttachment): Promise<void> => {
    const tab = window.open("about:blank", "_blank");

    setOpening(file.id);
    setFailure(undefined);

    try {
      const link = await portalApi.fileLink(patientId, file.id);

      if (tab) {
        tab.opener = null;
        tab.location.href = link.url;
      } else {
        window.location.assign(link.url);
      }
    } catch (error) {
      tab?.close();
      setFailure(t(siteFailureKey(error)));
    } finally {
      setOpening(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {failure && <Alert>{failure}</Alert>}
      <PortalPanel
        title={t("portal.tabs.files")}
        empty={t("portal.empty.files")}
        icon="files"
        paged
        grid="tiles"
        data-testid="site-portal-files"
      >
        {files.map((file) => (
          <li key={file.id} data-testid={`site-portal-file-${file.id}`} className="flex">
            <button
              type="button"
              aria-busy={opening === file.id}
              onClick={() => void open(file)}
              className="flex w-full cursor-pointer flex-col overflow-hidden rounded-panel border border-line text-start transition-colors hover:border-primary-300 aria-busy:opacity-60"
            >
              <span aria-hidden data-part="preview" className="relative block h-32 bg-canvas">
                {file.previewUrl ? (
                  <SiteImage
                    src={file.previewUrl}
                    layer
                    wash={false}
                    fallback={
                      <span className="inline-flex size-14 items-center justify-center rounded-pill bg-surface text-primary-600 shadow-pill">
                        <SiteIcon
                          name={file.mime.startsWith("image/") ? "eye" : "files"}
                          className="size-7"
                        />
                      </span>
                    }
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex size-14 items-center justify-center rounded-pill bg-surface text-primary-600 shadow-pill">
                      <SiteIcon
                        name={file.mime.startsWith("image/") ? "eye" : "files"}
                        className="size-7"
                      />
                    </span>
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-1.5 p-3.5">
                <bdi className="block truncate text-value font-bold text-primary-900">
                  {file.filename}
                </bdi>
                <span className="flex flex-wrap items-center gap-2 text-label text-ink-muted">
                  <span>{format.date(file.createdAt)}</span>
                  {file.tooth !== null && (
                    <span className="pill-text inline-flex min-h-(--control-h-sm) items-center rounded-chip border border-line px-2 text-meta text-primary-700">
                      {t("portal.teeth", { teeth: file.tooth })}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </PortalPanel>
    </div>
  );
}
