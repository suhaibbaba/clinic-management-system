import type { PortalTreatment } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { netPrice } from "@web/site/lib/portal";
import { nameIn } from "@web/site/lib/text";

export function PortalTreatments({
  title,
  empty,
  treatments,
  format,
  "data-testid": testId,
}: {
  readonly title: string;
  readonly empty: string;
  readonly treatments: readonly PortalTreatment[];
  readonly format: PortalFormat;
  readonly "data-testid": string;
}): JSX.Element {
  const { language, t } = useSite();

  return (
    <PortalPanel title={title} empty={empty} data-testid={testId}>
      {treatments.map((item) => (
        <li
          key={item.id}
          data-testid={`${testId}-${item.id}`}
          className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-value font-bold text-primary-900">{item.name}</span>
            <span className="text-label text-ink-muted">
              {format.date(item.performedAt)} · {nameIn(item.doctor, language)}
            </span>
            {item.teeth.length > 0 && (
              <span className="text-label text-ink-muted">
                {t("portal.teeth", { teeth: item.teeth.join(" · ") })}
              </span>
            )}
          </span>
          <span className="flex flex-col items-end gap-1">
            <span
              className={cx(
                "pill-text rounded-pill px-3 py-1 text-meta font-medium",
                item.status === "done"
                  ? "bg-success-50 text-success-800"
                  : item.status === "cancelled"
                    ? "bg-neutral-100 text-ink-muted"
                    : "bg-warning-50 text-warning-800",
              )}
            >
              {t(`portal.treatmentStatus.${item.status}`)}
            </span>
            <bdi className="text-value font-bold text-primary-900">
              {format.money(netPrice(item.price, item.discount))}
            </bdi>
          </span>
        </li>
      ))}
    </PortalPanel>
  );
}
