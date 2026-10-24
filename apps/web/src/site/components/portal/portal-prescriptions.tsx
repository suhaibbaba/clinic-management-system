import type { PortalPrescription } from "@clinic/shared";
import type { JSX } from "react";
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
      data-testid="site-portal-prescriptions"
    >
      {prescriptions.map((prescription) => (
        <li
          key={prescription.id}
          data-testid={`site-portal-prescription-${prescription.id}`}
          className="flex flex-col gap-2 py-3"
        >
          <span className="text-label text-ink-muted">
            {format.date(prescription.createdAt)} · {nameIn(prescription.doctor, language)}
          </span>
          <ul className="flex flex-col gap-1.5">
            {prescription.items.map((item, position) => {
              const details = regimenText(item, t);

              return (
                <li
                  key={position}
                  className="flex flex-col rounded-panel bg-primary-50/60 px-3 py-2"
                >
                  <bdi className="text-value font-bold text-primary-900">{item.drug}</bdi>
                  {details && <span className="text-label text-ink-muted">{details}</span>}
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
