import type { PortalTreatment } from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { PortalDateBlock } from "@web/site/components/portal/portal-date-block";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import { PortalStatusPill } from "@web/site/components/portal/portal-status-pill";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { netPrice, treatmentTone } from "@web/site/lib/portal";
import { nameIn } from "@web/site/lib/text";

export function PortalTreatments({
  title,
  empty,
  treatments,
  format,
  icon = "tooth",
  action,
  paged = false,
  "data-testid": testId,
}: {
  readonly title: string;
  readonly empty: string;
  readonly treatments: readonly PortalTreatment[];
  readonly format: PortalFormat;
  readonly icon?: "tooth" | "history";
  readonly action?: ReactNode;
  readonly paged?: boolean;
  readonly "data-testid": string;
}): JSX.Element {
  const { language, t } = useSite();

  return (
    <PortalPanel
      title={title}
      empty={empty}
      icon={icon}
      action={action}
      paged={paged}
      data-testid={testId}
    >
      {treatments.map((item) => (
        <li
          key={item.id}
          data-testid={`${testId}-${item.id}`}
          className="flex items-center gap-4 py-3.5"
        >
          <PortalDateBlock iso={item.performedAt} parts={format.dateParts(item.performedAt)} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-value font-bold text-primary-900">{item.name}</span>
            <span className="flex flex-wrap items-center gap-2 text-label text-ink-muted">
              <span>{nameIn(item.doctor, language)}</span>
              {item.teeth.length > 0 && (
                <span
                  data-part="teeth"
                  className="pill-text inline-flex min-h-(--control-h-sm) items-center gap-1 rounded-chip border border-line px-2 text-meta text-primary-700"
                >
                  {t("portal.teeth", { teeth: item.teeth.join(" · ") })}
                </span>
              )}
            </span>
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <bdi className="text-value font-bold text-primary-900">
              {format.money(netPrice(item.price, item.discount))}
            </bdi>
            <PortalStatusPill tone={treatmentTone(item.status)}>
              {t(`portal.treatmentStatus.${item.status}`)}
            </PortalStatusPill>
          </span>
        </li>
      ))}
    </PortalPanel>
  );
}
