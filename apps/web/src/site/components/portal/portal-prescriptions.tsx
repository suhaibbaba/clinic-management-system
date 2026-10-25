import type { PortalPrescription } from "@clinic/shared";
import type { JSX } from "react";
import { PortalDateBlock } from "@web/site/components/portal/portal-date-block";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { regimenText } from "@web/site/lib/portal";
import { nameIn } from "@web/site/lib/text";

export function PortalPrescriptions({
  prescriptions,
  format,
}: {
  readonly prescriptions: readonly PortalPrescription[];
  readonly format: PortalFormat;
}): JSX.Element {
  const { language, t } = useSite();

  return (
    <PortalPanel
      title={t("portal.tabs.prescriptions")}
      empty={t("portal.empty.prescriptions")}
      icon="pill"
      paged
      grid="cards"
      data-testid="site-portal-prescriptions"
    >
      {prescriptions.map((prescription) => (
        <li
          key={prescription.id}
          data-testid={`site-portal-prescription-${prescription.id}`}
          className="flex flex-col gap-3 rounded-panel border border-line p-4"
        >
          <div className="flex items-center gap-3">
            <PortalDateBlock
              iso={prescription.createdAt}
              parts={format.dateParts(prescription.createdAt)}
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-value font-bold text-primary-900">
                {nameIn(prescription.doctor, language)}
              </span>
              <span className="text-label text-ink-muted">
                {t("portal.drugCount", { count: prescription.items.length })}
              </span>
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {prescription.items.map((item, position) => {
              const details = regimenText(item, t);

              return (
                <li key={position} data-part="drug" className="flex gap-2.5 py-2.5">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-pill bg-primary-600"
                  />
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <bdi className="text-value font-bold text-primary-900">{item.drug}</bdi>
                    {details && <bdi className="text-label text-ink-muted">{details}</bdi>}
                  </span>
                </li>
              );
            })}
          </ul>
          {prescription.notes && (
            <p className="text-label whitespace-pre-line text-ink-muted">{prescription.notes}</p>
          )}
        </li>
      ))}
    </PortalPanel>
  );
}
