import { CHART_TYPE, type CalendarAppointment, type ChartType } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, Ltr, PersonName } from '@web/components/ui';
import { minutesOf, toTimeLabel } from '@web/features/appointments/calendar-time';
import { useSession } from '@web/features/auth/session';
import { dayAndDate } from '@web/lib/format';

export interface WelcomeBannerProps {
  readonly date: string | undefined;
  readonly schedule: readonly CalendarAppointment[];
}

// The greeting is read once a morning and then ignored, which is the point: it is the one part of
// the page that says whose day this is before the numbers say what is in it.
export function WelcomeBanner({ date, schedule }: WelcomeBannerProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();

  const bounds = dayBounds(schedule);
  const today = date === undefined ? null : dayAndDate(date);

  return (
    <section className="relative flex min-h-[158px] items-center overflow-hidden rounded-card border border-line px-[30px] py-[26px] shadow-card banner-wash">
      <BannerArt chartTypes={user?.clinic.chartTypes ?? []} />

      <div className="relative z-10 min-w-0">
        <h1 className="flex items-center gap-2.5 text-display font-medium text-primary-900">
          {user ? (
            <>
              {t(`dashboard.greeting.${partOfDay()}`)}
              {/* Separate from the greeting so the name is one `<PersonName>` rather than an
                  interpolation that would need a per-language ternary. */}
              <PersonName name={user.name} />
              {/* The reference's ☀️, after the name as it draws it. In the locale files because a
                  clinic that wants no emoji in its greeting should be able to empty the string. */}
              <span aria-hidden="true">{t(`dashboard.greetingMark.${partOfDay()}`)}</span>
            </>
          ) : (
            t('dashboard.title')
          )}
        </h1>

        <p className="mt-[5px] flex flex-wrap items-center gap-1.5 text-value text-banner-ink">
          {today === null ? (
            t('dashboard.subtitle')
          ) : (
            <>
              <span>{today.weekday}</span>
              <Ltr>{today.date}</Ltr>
            </>
          )}
        </p>

        {bounds && (
          <p className="mt-[13px] inline-flex items-center gap-[7px] rounded-pill border border-primary-600/20 bg-surface/75 px-[13px] py-1.5 text-meta font-medium text-primary-700 backdrop-blur-[6px]">
            <Icon name="clock" className="size-3.5 shrink-0" />
            <span>
              {t('dashboard.firstAppointment')} <Ltr>{bounds.first}</Ltr>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('dashboard.lastAppointment')} <Ltr>{bounds.last}</Ltr>
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

// The clinic's wall clock, not the reader's: a receptionist in another timezone is still greeted by
// the hour the clinic is keeping. Noon is the turn, which is where Arabic puts it.
function partOfDay(): 'morning' | 'evening' {
  return minutesOf(new Date().toISOString()) < 12 * 60 ? 'morning' : 'evening';
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

// The reference's dental glyph, drawn only where the clinic charts teeth. Specialty-specific
// drawing is data here as it is for the chart itself (architecture decision 1), so an orthopedic
// clinic gets the abstract field alone rather than somebody else's molar.
function SpecialtyGlyph({
  chartTypes,
}: {
  readonly chartTypes: readonly ChartType[];
}): JSX.Element | null {
  if (!chartTypes.includes(CHART_TYPE.TOOTH_FDI)) {
    return null;
  }

  return (
    <>
      <g filter="url(#banner-soft)">
        <path
          d="M218 26c-22 0-30 13-44 13-16 0-27 14-27 32 0 29 14 43 19 71 3 18 7 34 19 34 14 0 8-38 31-38s17 38 31 38c12 0 16-16 19-34 5-28 19-42 19-71 0-18-11-32-27-32-14 0-19-13-40-13Z"
          fill="url(#banner-tooth)"
          stroke="currentColor"
          className="text-primary-600"
          strokeWidth="6"
        />
      </g>

      <path
        d="M186 64c11-11 53-13 66 0"
        stroke="currentColor"
        className="text-success-500"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M196 47c4-5 12-8 19-7"
        stroke="currentColor"
        className="text-success-300"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

// The circles, the dotted field, the sparkles and the leaves are every clinic's; the glyph over
// them is the specialty's.
function BannerArt({ chartTypes }: { readonly chartTypes: readonly ChartType[] }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 end-0 w-[46%] opacity-100 max-[900px]:opacity-35 max-[760px]:hidden"
    >
      <svg
        viewBox="0 0 440 170"
        preserveAspectRatio="xMidYMid slice"
        className="block size-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="banner-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" className="text-primary-600" />
          </pattern>
          <linearGradient id="banner-tooth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" className="text-surface" />
            <stop offset="1" stopColor="currentColor" className="text-success-50" />
          </linearGradient>
          <filter id="banner-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="8"
              stdDeviation="10"
              floodColor="currentColor"
              floodOpacity=".22"
              className="text-primary-600"
            />
          </filter>
        </defs>

        <g className="text-success-500" fill="currentColor">
          <circle cx="110" cy="100" r="130" opacity=".10" />
          <path d="M318 40 322 52 334 56 322 60 318 72 314 60 302 56 314 52Z" opacity=".95" />
          <path d="M128 26 130 33 137 35 130 37 128 44 126 37 119 35 126 33Z" opacity=".8" />
          <path d="M430 170c-36-5-56-22-63-48 27 2 53 19 63 48Z" opacity=".4" />
          <circle cx="60" cy="140" r="5" opacity=".45" />
        </g>

        <g className="text-primary-600" fill="currentColor">
          <circle cx="340" cy="10" r="100" opacity=".08" />
          <path d="M352 96 355 104 363 107 355 110 352 118 349 110 341 107 349 104Z" opacity=".7" />
          <path
            d="M160 118 161.5 122 166 123.5 161.5 125 160 129 158.5 125 154 123.5 158.5 122Z"
            opacity=".55"
          />
          <path d="M400 170c-24-4-38-15-44-32 19 1 37 13 44 32Z" opacity=".3" />
          <circle cx="80" cy="152" r="3" opacity=".35" />
        </g>

        <circle
          cx="255"
          cy="85"
          r="66"
          fill="none"
          stroke="currentColor"
          className="text-success-500"
          strokeWidth="2"
          opacity=".35"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />

        <rect x="20" y="14" width="90" height="60" fill="url(#banner-dots)" opacity=".12" />

        <SpecialtyGlyph chartTypes={chartTypes} />
      </svg>
    </div>
  );
}
