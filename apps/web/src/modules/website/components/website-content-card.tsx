import type { WebsiteEditor } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge, Icon } from "@clinic/ui";
import { WEBSITE_EDITOR_PATH } from "@web/shared/constants/layout";
import { formatDateTime } from "@web/shared/lib/format";
import { OpenSiteLink } from "@web/modules/website/components/open-site-link";

export function WebsiteContentCard({ editor }: { readonly editor: WebsiteEditor }): JSX.Element {
  const { t } = useTranslation();
  const { publishedAt, unpublished } = editor;

  return (
    <section
      data-testid="website-content"
      aria-labelledby="website-content-title"
      className="flex max-w-(--form-max) flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="website-content-title" className="text-section font-medium text-ink">
          {t("website.content.title")}
        </h2>
        <p className="text-label text-ink-muted">{t("website.content.hint")}</p>
      </div>

      <div data-part="status" className="flex flex-wrap items-center gap-2">
        <Badge tone={publishedAt ? "success" : "neutral"} data-testid="website-content-state">
          {t(publishedAt ? "website.status.live" : "website.status.draft")}
        </Badge>
        {unpublished && publishedAt && (
          <Badge tone="warning" data-testid="website-content-unpublished">
            {t("website.status.unpublished")}
          </Badge>
        )}
        {publishedAt && (
          <span data-part="published-at" className="text-label text-ink-muted">
            {t("website.status.publishedAt", { at: formatDateTime(publishedAt) })}
          </span>
        )}
      </div>

      <div data-part="actions" className="flex flex-wrap items-center gap-2">
        <Link
          to={WEBSITE_EDITOR_PATH}
          target="_blank"
          rel="noreferrer"
          data-testid="website-content-edit"
          className="pill-text inline-flex h-(--control-h) items-center gap-2 rounded-control bg-primary-600 px-3.5 text-label font-medium text-ink-inverse hover:bg-primary-700 active:bg-primary-800"
        >
          <Icon name="edit" />
          {t("website.content.edit")}
        </Link>
        {publishedAt && (
          <OpenSiteLink
            data-testid="website-content-open"
            href={`/site/${editor.site.clinic.slug}`}
          />
        )}
      </div>
    </section>
  );
}
