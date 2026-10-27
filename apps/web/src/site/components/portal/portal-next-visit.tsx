import type { PortalAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";
import { PortalDateBlock } from "@web/site/components/portal/portal-date-block";
import { PortalStatusPill } from "@web/site/components/portal/portal-status-pill";
import { SiteIcon } from "@web/site/components/site-icon";
import { SiteLink } from "@web/site/components/site-link";
import { useBookable } from "@web/site/hooks/use-bookable";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { appointmentTone } from "@web/site/lib/portal";
import { nameIn } from "@web/site/lib/text";
import { SITE_PATH } from "@web/site/route";

export function PortalNextVisit({
  appointment,
  format,
  compact = false,
}: {
  readonly appointment: PortalAppointment | undefined;
  readonly format: PortalFormat;
  readonly compact?: boolean;
}): JSX.Element {
  const { language, t } = useSite();
  const bookable = useBookable();

  return (
    <section
      data-testid="site-portal-next"
      className={cx(
        "flex flex-col gap-4 rounded-card border border-line bg-surface shadow-card",
        compact ? "p-4" : "p-6",
      )}
    >
      {appointment ? (
        <>
          <h3 className="flex items-center gap-2 text-heading font-bold text-primary-900">
            <SiteIcon name="calendar-clock" className="size-5 text-primary-600" />
            {t("portal.nextVisitTitle")}
          </h3>
          <div className="flex items-center gap-4">
            <PortalDateBlock
              iso={appointment.startsAt}
              parts={format.dateParts(appointment.startsAt)}
            />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <bdi className="text-title font-bold text-primary-900">
                {format.time(appointment.startsAt)}
              </bdi>
              <span className="text-label text-ink-muted">
                {format.weekday(appointment.startsAt)} · {nameIn(appointment.doctor, language)}
              </span>
            </span>
            <PortalStatusPill tone={appointmentTone(appointment.status)}>
              {t(`portal.appointmentStatus.${appointment.status}`)}
            </PortalStatusPill>
          </div>
        </>
      ) : (
        <div
          className={cx(
            "flex items-center gap-3",
            compact ? "flex-wrap" : "flex-col py-4 text-center",
          )}
        >
          <span
            aria-hidden
            className={cx(
              "inline-flex shrink-0 items-center justify-center rounded-pill bg-primary-50 text-primary-600",
              compact ? "size-10" : "mb-1 size-14",
            )}
          >
            <SiteIcon name="calendar-plus" className={compact ? "size-5" : "size-7"} />
          </span>
          <div className={cx("flex flex-col", compact ? "min-w-0 flex-1" : "items-center gap-2")}>
            <h3 className="text-heading font-bold text-primary-900">{t("portal.noUpcoming")}</h3>
            <p className="text-label text-ink-muted">{t("portal.noUpcomingHint")}</p>
          </div>
          {bookable && (
            <SiteLink
              to={SITE_PATH.BOOKING}
              data-testid="site-portal-book"
              className="pill-text inline-flex min-h-(--control-h) items-center gap-2 rounded-pill bg-primary-600 px-6 text-label font-medium text-ink-inverse shadow-nav-active transition-colors hover:bg-primary-700"
            >
              <SiteIcon name="calendar" />
              {t("portal.bookNow")}
            </SiteLink>
          )}
        </div>
      )}
    </section>
  );
}
