import type { PortalAccount, PortalAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { PortalFamilySwitch } from "@web/site/components/portal/portal-family-switch";
import { SiteIcon } from "@web/site/components/site-icon";
import { ToothGlyph } from "@web/site/components/tooth-glyph";
import type { PortalFormat } from "@web/site/hooks/use-portal-format";
import { useSite } from "@web/site/hooks/use-site";
import { partOfDay } from "@web/site/lib/portal";

export function PortalWelcome({
  account,
  patientId,
  next,
  format,
  onPick,
}: {
  readonly account: PortalAccount;
  readonly patientId: string | undefined;
  readonly next: PortalAppointment | undefined;
  readonly format: PortalFormat;
  readonly onPick: (patientId: string) => void;
}): JSX.Element {
  const { t } = useSite();
  const now = new Date();
  const today = now.toISOString();
  const period = partOfDay(now, account.timeZone);
  const patient = account.patients.find((entry) => entry.id === patientId);

  return (
    <section
      data-testid="site-portal-welcome"
      aria-labelledby="portal-greeting"
      className="relative flex min-h-40 items-center overflow-hidden rounded-card border border-line px-6 py-6 shadow-card banner-wash sm:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-0 hidden w-2/5 items-center justify-center sm:flex"
      >
        <span className="absolute size-44 rounded-pill bg-surface/55" />
        <span className="absolute -translate-x-16 -translate-y-14 size-12 rounded-pill bg-primary-200/50" />
        <span className="absolute translate-x-20 translate-y-14 size-6 rounded-pill bg-success-300/60" />
        <ToothGlyph strokeWidth={1.25} className="relative size-24 fill-surface text-primary-600" />
      </div>

      <div className="relative flex min-w-0 flex-col gap-1.5">
        <h1
          id="portal-greeting"
          data-testid="site-portal-greeting"
          className="flex flex-wrap items-center gap-2.5 text-title font-medium text-primary-900"
        >
          <span>
            {t(`portal.greeting.${period}`)} <span className="font-bold">{patient?.firstName}</span>
          </span>
          <SiteIcon
            name={period === "morning" ? "sun" : "moon"}
            className="size-6 text-warning-500"
          />
        </h1>
        <p className="text-value text-banner-ink">
          {format.weekday(today)} · {format.date(today)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {account.patients.length > 1 && (
            <PortalFamilySwitch patients={account.patients} patientId={patientId} onPick={onPick} />
          )}
          <span
            data-testid="site-portal-next-hint"
            className="pill-text inline-flex min-h-(--control-h-sm) items-center gap-2 rounded-pill border border-primary-600/20 bg-surface/75 px-3 text-label font-medium text-primary-700"
          >
            <SiteIcon name="calendar" className="size-4" />
            {next
              ? t("portal.nextVisit", { date: format.dateTime(next.startsAt) })
              : t("portal.noUpcoming")}
          </span>
        </div>
      </div>
    </section>
  );
}
