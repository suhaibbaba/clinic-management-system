import type { CalendarAppointment } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { BannerIcon, Icon, Ltr, PersonName } from "@clinic/ui";
import { minutesOf, toTimeLabel } from "@web/shared/lib/dates";
import { useSession } from "@web/shared/providers/session";
import { dayAndDate } from "@web/shared/lib/format";

export interface WelcomeBannerProps {
  readonly date: string | undefined;
  readonly schedule: readonly CalendarAppointment[];
}

export function WelcomeBanner({ date, schedule }: WelcomeBannerProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();

  const bounds = dayBounds(schedule);
  const today = date === undefined ? null : dayAndDate(date);

  return (
    <section
      data-testid="welcome-banner"
      className="relative flex min-h-[158px] items-center overflow-hidden rounded-card border border-line px-[30px] py-[26px] shadow-card banner-wash"
    >
      <div className="pointer-events-none absolute inset-y-0 end-0 w-[46%] opacity-100 max-[900px]:opacity-35 max-[760px]:hidden">
        <BannerIcon chartTypes={user?.clinic.chartTypes ?? []} />
      </div>

      <div className="relative z-10 min-w-0">
        <h1
          data-testid="welcome-banner-greeting"
          className="flex items-center gap-2.5 text-title font-medium text-primary-900"
        >
          {user ? (
            <>
              {t(`dashboard.greeting.${partOfDay()}`)}
              <PersonName name={user.name} />
              <span aria-hidden="true">{t(`dashboard.greetingMark.${partOfDay()}`)}</span>
            </>
          ) : (
            t("dashboard.title")
          )}
        </h1>

        <p
          data-testid="welcome-banner-date"
          className="mt-[5px] flex flex-wrap items-center gap-1.5 text-value text-banner-ink"
        >
          {today === null ? (
            t("dashboard.subtitle")
          ) : (
            <>
              <span>{today.weekday}</span>
              <Ltr>{today.date}</Ltr>
            </>
          )}
        </p>

        {bounds && (
          <p
            data-testid="welcome-banner-hours"
            className="pill-text inline-flex items-center mt-[13px] h-(--control-h-sm) gap-2 rounded-pill border border-primary-600/20 bg-surface/75 px-3 text-label font-medium text-primary-700 backdrop-blur-[6px]"
          >
            <Icon name="clock" className="size-3.5 shrink-0" />
            <span>
              {t("dashboard.firstAppointment")} <Ltr>{bounds.first}</Ltr>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t("dashboard.lastAppointment")} <Ltr>{bounds.last}</Ltr>
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function partOfDay(): "morning" | "evening" {
  return minutesOf(new Date().toISOString()) < 12 * 60 ? "morning" : "evening";
}

function dayBounds(
  schedule: readonly CalendarAppointment[],
): { readonly first: string; readonly last: string } | null {
  if (schedule.length === 0) {
    return null;
  }

  const times = schedule
    .map((appointment) => minutesOf(appointment.startsAt))
    .sort((a, b) => a - b);

  return { first: toTimeLabel(times[0]!), last: toTimeLabel(times.at(-1)!) };
}
