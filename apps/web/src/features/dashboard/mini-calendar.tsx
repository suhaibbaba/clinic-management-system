import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Icon, Ltr, Widget } from '@web/components/ui';
import { toIsoDate, todayIso } from '@web/features/appointments/calendar-time';
import { useCalendar } from '@web/features/appointments/queries';
import { cn } from '@web/lib/cn';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// A month at a glance: which days have somebody booked, and a way into that day's calendar. The
// dots come from the calendar feed's own month range, so they cannot disagree with the calendar.
export function MiniCalendar(): JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();
  const [month, setMonth] = useState(() => today.slice(0, 7));

  const feed = useCalendar({ date: `${month}-01`, range: 'month' });

  const booked = useMemo(() => {
    const days = new Set<string>();

    for (const appointment of feed.data?.appointments ?? []) {
      days.add(toIsoDate(new Date(appointment.startsAt)));
    }

    return days;
  }, [feed.data]);

  const cells = useMemo(() => monthCells(month), [month]);

  const monthLabel = new Intl.DateTimeFormat(
    i18n.language.startsWith('en') ? 'en-GB-u-ca-gregory-nu-latn' : 'ar-SY-u-ca-gregory-nu-latn',
    { month: 'long', year: 'numeric' },
  ).format(new Date(`${month}-01T12:00:00Z`));

  return (
    <Widget>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <b className="text-section font-bold">{monthLabel}</b>

        <div className="flex gap-1">
          <StepButton
            label={t('dashboard.calendar.previous')}
            icon="chevron-start"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
          />
          <StepButton
            label={t('dashboard.calendar.next')}
            icon="chevron-end"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
          />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[3px] text-center">
        {WEEKDAY_KEYS.map((key) => (
          <b key={key} className="py-1 text-micro font-medium text-ink-muted">
            {t(`dashboard.calendar.weekday.${key}`)}
          </b>
        ))}

        {cells.map((cell, index) =>
          cell === null ? (
            // Blanks before the first and after the last: a key from the index is right here,
            // because the padding cells have no identity of their own.
            <span key={`pad-${index}`} aria-hidden="true" className="py-1.5" />
          ) : (
            <Day
              key={cell}
              date={cell}
              isToday={cell === today}
              hasAppointments={booked.has(cell)}
              onOpen={() => void navigate(`/appointments?date=${cell}`)}
              label={t('dashboard.calendar.open')}
            />
          ),
        )}
      </div>
    </Widget>
  );
}

function Day({
  date,
  isToday,
  hasAppointments,
  onOpen,
  label,
}: {
  readonly date: string;
  readonly isToday: boolean;
  readonly hasAppointments: boolean;
  readonly onOpen: () => void;
  readonly label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label} ${date}`}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'relative cursor-pointer rounded-chip py-1.5 text-label font-medium',
        'transition-colors duration-150',
        isToday ? 'today-wash text-ink-inverse' : 'text-ink hover:bg-primary-100',
      )}
    >
      <Ltr>{Number(date.slice(8))}</Ltr>

      {hasAppointments && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0.5 start-1/2 size-1 -translate-x-1/2 rounded-pill rtl:translate-x-1/2',
            isToday ? 'bg-ink-inverse' : 'bg-success-500',
          )}
        />
      )}
    </button>
  );
}

function StepButton({
  label,
  icon,
  onClick,
}: {
  readonly label: string;
  readonly icon: 'chevron-start' | 'chevron-end';
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        // 44px on touch, the reference's drawn 26 on a laptop.
        'inline-flex size-11 cursor-pointer items-center justify-center lg:size-[26px]',
        'rounded-chip border border-line bg-canvas text-ink-muted',
        'transition-colors duration-150 hover:border-primary-600 hover:text-primary-700',
      )}
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  );
}

/** Seven columns starting on Sunday, padded at both ends so every week is a full row. */
function monthCells(month: string): readonly (string | null)[] {
  const [year = 0, index = 1] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const lead = first.getUTCDay();

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);

  for (let day = 1; day <= days; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [year = 0, index = 1] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, index - 1 + delta, 1));

  return shifted.toISOString().slice(0, 7);
}
