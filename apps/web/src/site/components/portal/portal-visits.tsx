import type { PortalVisit } from "@clinic/shared";
import type { JSX } from "react";
import { PortalPanel } from "@web/site/components/portal/portal-panel";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { nameIn } from "@web/site/lib/text";

export function PortalVisits({
  visits,
  format,
}: {
  readonly visits: readonly PortalVisit[];
  readonly format: PortalFormat;
}): JSX.Element {
  const { language, languages, t } = useSite();

  return (
    <PortalPanel
      title={t("portal.visits")}
      empty={t("portal.empty.visits")}
      icon="stethoscope"
      paged
      data-testid="site-portal-visits"
    >
      {visits.map((visit) => (
        <li
          key={visit.id}
          data-testid={`site-portal-visit-${visit.id}`}
          className="flex flex-col gap-1 py-3"
        >
          <span className="text-label text-ink-muted">
            {format.date(visit.visitDate)} · {nameIn(visit.doctor, language, languages)}
          </span>
          {visit.complaint && (
            <span className="text-value text-ink">
              <span className="font-bold text-primary-900">{t("portal.complaint")}: </span>
              {visit.complaint}
            </span>
          )}
          {visit.diagnosis && (
            <span className="text-value text-ink">
              <span className="font-bold text-primary-900">{t("portal.diagnosis")}: </span>
              {visit.diagnosis}
            </span>
          )}
        </li>
      ))}
    </PortalPanel>
  );
}
