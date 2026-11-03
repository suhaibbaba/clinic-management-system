import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@clinic/ui";
import { openOutsideApp } from "@web/shared/lib/open-outside-app";

export function OpenSiteLink({
  href,
  "data-testid": testId,
}: {
  readonly href: string;
  readonly "data-testid": string;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(event) => {
        if (openOutsideApp(event.currentTarget.href)) {
          event.preventDefault();
        }
      }}
      data-testid={testId}
      className="pill-text inline-flex h-(--control-h) items-center gap-2 rounded-control border border-line bg-surface px-3.5 text-label font-medium text-ink hover:border-primary-600 hover:text-primary-700"
    >
      <Icon name="globe" />
      {t("website.open")}
    </a>
  );
}
