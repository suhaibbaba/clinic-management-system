import type { PortalAttachment } from "@clinic/shared";
import { useState, type JSX } from "react";
import { Alert } from "@web/booking/ui";
import { portalApi, siteFailureKey } from "@web/site/api";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import { SiteIcon } from "@web/site/components/site-icon";
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
        data-testid="site-portal-files"
      >
        {files.map((file) => (
          <li key={file.id} data-testid={`site-portal-file-${file.id}`} className="py-1">
            <button
              type="button"
              aria-busy={opening === file.id}
              onClick={() => void open(file)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-panel px-2 py-2 text-start hover:bg-primary-50"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-600">
                <SiteIcon
                  name={file.mime.startsWith("image/") ? "eye" : "send"}
                  className="size-5"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <bdi className="truncate text-value font-bold text-primary-900">
                  {file.filename}
                </bdi>
                <span className="text-label text-ink-muted">
                  {format.date(file.createdAt)}
                  {file.tooth !== null && ` · ${t("portal.teeth", { teeth: file.tooth })}`}
                </span>
              </span>
              <span className="text-label font-medium text-primary-700">{t("portal.open")}</span>
            </button>
          </li>
        ))}
      </PortalPanel>
    </div>
  );
}
