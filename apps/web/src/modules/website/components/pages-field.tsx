import { canDisablePage, SITE_PAGE_KIND, type SitePageKind } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { InfoTip, Switch } from "@clinic/ui";

export function PagesField({
  pages,
  bookingAvailable,
  onChange,
}: {
  readonly pages: readonly { readonly kind: SitePageKind; readonly enabled: boolean }[];
  readonly bookingAvailable: boolean;
  readonly onChange: (kind: SitePageKind, enabled: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <ul data-testid="pages-field" className="flex flex-col divide-y divide-line">
      {pages.map((page) => {
        const blockedBooking = page.kind === SITE_PAGE_KIND.BOOKING && !bookingAvailable;

        return (
          <li
            key={page.kind}
            data-testid={`pages-field-${page.kind}`}
            className="flex items-center gap-2 py-2"
          >
            <Switch
              data-testid={`pages-field-${page.kind}-switch`}
              checked={page.enabled && !blockedBooking}
              aria-disabled={!canDisablePage(page.kind) || blockedBooking}
              label={t(`website.preview.pages.${page.kind}`)}
              onCheckedChange={(enabled) => onChange(page.kind, enabled)}
            />
            {blockedBooking && (
              <InfoTip data-testid="pages-field-booking-off" label={t("common.moreInfo")}>
                {t("website.editor.bookingOff")}
              </InfoTip>
            )}
          </li>
        );
      })}
    </ul>
  );
}
