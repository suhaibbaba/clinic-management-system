import { addMonths, addYears, format, setMonth, setYear, startOfMonth } from 'date-fns';
import { ar, enGB, type Locale } from 'date-fns/locale';
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import {
  DayPicker,
  type DayButtonProps,
  type DayPickerProps,
  type Modifiers,
} from 'react-day-picker';
import { useTranslation } from 'react-i18next';

import { Icon } from '@ui/components/icon';
import { Ltr } from '@ui/components/ltr';
import { cn } from '@ui/lib/cn';

export function dateLocale(language: string): Locale {
  return language.split('-')[0] === 'ar' ? ar : enGB;
}

/** A date of birth: the years have to reach back past any living patient. */
const FIRST_YEAR = 1900;
const YEARS_PER_PAGE = 12;

export type CalendarView = 'days' | 'months' | 'years';

interface DayState {
  /** The cell's fill: a range band runs edge to edge, which the inset button cannot draw. */
  readonly cell?: string;
  readonly button: string;
}

const DAY_STATES = {
  plain: { button: 'text-ink hover:bg-inset' },
  muted: { button: 'text-ink-faint' },
  today: { button: 'border-[1.5px] border-primary-600 text-primary-700 hover:bg-primary-50' },
  selected: { button: 'bg-primary-600 text-ink-inverse hover:bg-primary-700' },
  rangeMiddle: { cell: 'bg-selected', button: 'text-ink hover:bg-primary-200' },
} satisfies Record<string, DayState>;

// Today keeps its identity under a fill it cannot outline: a dot below the number, in whichever ink
// is already readable on that fill.
const TODAY_DOT = cn(
  'after:absolute after:inset-x-0 after:bottom-1 after:mx-auto',
  'after:size-1 after:rounded-pill after:content-[""]',
);

/** Logical, so the start of a range is rounded on the side the reader comes from, in both scripts. */
function rangeRounding(isStart: boolean, isEnd: boolean): string {
  if (isStart === isEnd) {
    return 'rounded-control';
  }

  return isStart ? 'rounded-s-control' : 'rounded-e-control';
}

function dayInk(modifiers: Modifiers): string {
  const isToday = modifiers['today'] === true;

  if (modifiers['disabled'] === true) {
    return cn(DAY_STATES.muted.button, 'rounded-control');
  }

  if (modifiers['range_middle'] === true) {
    return cn(DAY_STATES.rangeMiddle.button, isToday && cn(TODAY_DOT, 'after:bg-primary-600'));
  }

  if (modifiers['selected'] === true) {
    return cn(
      DAY_STATES.selected.button,
      rangeRounding(modifiers['range_start'] === true, modifiers['range_end'] === true),
      isToday && cn(TODAY_DOT, 'after:bg-surface'),
    );
  }

  if (isToday) {
    return cn(DAY_STATES.today.button, 'rounded-control');
  }

  return cn(
    modifiers['outside'] === true ? DAY_STATES.muted.button : DAY_STATES.plain.button,
    'rounded-control',
  );
}

function CalendarDayButton({
  day: _day,
  modifiers,
  className,
  ...props
}: DayButtonProps): JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const isFocused = modifiers['focused'] === true;

  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused]);

  return (
    <button
      ref={ref}
      data-part="day-cell"
      {...props}
      className={cn(className, dayInk(modifiers))}
    />
  );
}

const NAV_BUTTON = cn(
  'inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center rounded-control',
  'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
  'disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent',
);

const CAPTION_BUTTON = cn(
  'inline-flex h-(--control-h-sm) cursor-pointer items-center gap-2 rounded-control px-3',
  'text-value font-medium text-ink transition-colors duration-150 hover:bg-inset',
);

const PERIOD_CELL = cn(
  'relative inline-flex min-h-(--control-h) w-full cursor-pointer items-center justify-center',
  'text-value tabular-nums transition-colors duration-150',
  'disabled:cursor-not-allowed lg:min-h-0 lg:h-(--control-h-sm)',
);

interface CalendarHeaderProps {
  readonly label: ReactNode;
  readonly zoomOut: { readonly label: string; readonly onClick: () => void } | null;
  readonly previous: {
    readonly label: string;
    readonly onClick: () => void;
    readonly can: boolean;
  };
  readonly next: { readonly label: string; readonly onClick: () => void; readonly can: boolean };
}

function CalendarHeader({ label, zoomOut, previous, next }: CalendarHeaderProps): JSX.Element {
  return (
    <div
      data-part="calendar-header"
      className="flex h-(--control-h-sm) items-center justify-between gap-2"
    >
      <button
        type="button"
        data-part="calendar-previous"
        aria-label={previous.label}
        disabled={!previous.can}
        onClick={previous.onClick}
        className={NAV_BUTTON}
      >
        <Icon name="chevron-start" className="size-4" />
      </button>

      {zoomOut ? (
        <button
          type="button"
          data-part="calendar-caption"
          aria-label={zoomOut.label}
          onClick={zoomOut.onClick}
          className={CAPTION_BUTTON}
        >
          {label}
          <Icon name="chevron-down" className="size-4 text-ink-subtle" />
        </button>
      ) : (
        <span data-part="calendar-caption" className="text-value font-medium text-ink">
          {label}
        </span>
      )}

      <button
        type="button"
        data-part="calendar-next"
        aria-label={next.label}
        disabled={!next.can}
        onClick={next.onClick}
        className={NAV_BUTTON}
      >
        <Icon name="chevron-end" className="size-4" />
      </button>
    </div>
  );
}

interface PeriodOption {
  readonly key: number;
  readonly label: string;
  readonly isSelected: boolean;
  readonly isCurrent: boolean;
  readonly isOutside: boolean;
  readonly isDisabled: boolean;
}

/** The same states as a day, in the same order — a month or a year is a cell of the same grid. */
function periodInk(option: PeriodOption): string {
  if (option.isDisabled) {
    return DAY_STATES.muted.button;
  }

  if (option.isSelected) {
    return cn(DAY_STATES.selected.button, option.isCurrent && cn(TODAY_DOT, 'after:bg-surface'));
  }

  if (option.isCurrent) {
    return DAY_STATES.today.button;
  }

  return option.isOutside ? DAY_STATES.muted.button : DAY_STATES.plain.button;
}

interface PeriodGridProps {
  readonly label: string;
  readonly columns: 3 | 4;
  readonly options: readonly PeriodOption[];
  readonly onPick: (key: number) => void;
}

function PeriodGrid({ label, columns, options, onPick }: PeriodGridProps): JSX.Element {
  return (
    <div
      data-part="calendar-periods"
      role="group"
      aria-label={label}
      className={cn('grid gap-1 pt-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-4')}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          data-part="calendar-period"
          disabled={option.isDisabled}
          aria-current={option.isSelected ? 'true' : undefined}
          onClick={() => onPick(option.key)}
          className={cn(PERIOD_CELL, periodInk(option), 'rounded-control')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// `CalendarProps` is not an `Omit` — that collapses the `mode` union.
export type CalendarProps = DayPickerProps & {
  /** `years` for a date of birth: 1998 is four pages away there and 340 clicks away in the days. */
  readonly startView?: CalendarView | undefined;
};

export function Calendar({ startView = 'days', ...props }: CalendarProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const isRtl = i18n.language.split('-')[0] === 'ar';

  const [view, setView] = useState<CalendarView>(startView);
  const [month, goToMonth] = useState(() =>
    startOfMonth(props.month ?? props.defaultMonth ?? new Date()),
  );

  const lastYear = new Date().getFullYear() + 1;
  const year = month.getFullYear();
  const decade = Math.floor(year / 10) * 10;

  const body =
    view === 'days' ? (
      <DayPicker
        showOutsideDays
        {...props}
        month={month}
        onMonthChange={goToMonth}
        hideNavigation
        locale={locale}
        dir={isRtl ? 'rtl' : 'ltr'}
        components={{ DayButton: CalendarDayButton }}
        // Explicit formatters: the default is locale-aware and would render Arabic-Indic digits.
        formatters={{
          formatDay: (date: Date) => String(date.getDate()),
          formatWeekdayName: (date: Date) => format(date, 'EEEEEE', { locale }),
        }}
        classNames={{
          root: 'text-value text-ink',
          month: 'w-full',
          month_caption: 'hidden',
          month_grid: 'w-full border-collapse',
          weekdays: 'flex',
          weekday: 'w-10 pt-2 pb-1 text-label font-medium text-ink-subtle',
          week: 'flex w-full',
          day: 'p-0.5',
          day_button: cn(
            'relative inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center',
            'text-value tabular-nums transition-colors duration-150',
          ),
          // The ink is `dayInk`, one state at a time; the cell carries only the range's band.
          selected: '',
          today: '',
          outside: '',
          disabled: '',
          range_start: cn(DAY_STATES.rangeMiddle.cell, 'rounded-s-chip'),
          range_end: cn(DAY_STATES.rangeMiddle.cell, 'rounded-e-chip'),
          range_middle: DAY_STATES.rangeMiddle.cell,
          hidden: 'invisible',
        }}
      />
    ) : view === 'months' ? (
      <PeriodGrid
        label={t('common.calendar.chooseMonth')}
        columns={3}
        options={Array.from({ length: 12 }, (_, index) => ({
          key: index,
          label: format(setMonth(month, index), 'LLL', { locale }),
          isSelected: month.getMonth() === index,
          isCurrent: new Date().getFullYear() === year && new Date().getMonth() === index,
          isOutside: false,
          isDisabled: false,
        }))}
        onPick={(index) => {
          goToMonth(startOfMonth(setMonth(month, index)));
          setView('days');
        }}
      />
    ) : (
      <PeriodGrid
        label={t('common.calendar.chooseYear')}
        columns={4}
        options={Array.from({ length: YEARS_PER_PAGE }, (_, index) => {
          const value = decade - 1 + index;

          return {
            key: value,
            label: String(value),
            isSelected: value === year,
            isCurrent: value === new Date().getFullYear(),
            isOutside: value < decade || value > decade + 9,
            isDisabled: value < FIRST_YEAR || value > lastYear,
          };
        })}
        onPick={(value) => {
          goToMonth(startOfMonth(setYear(month, value)));
          setView('months');
        }}
      />
    );

  const header: CalendarHeaderProps =
    view === 'days'
      ? {
          label: `${format(month, 'LLLL', { locale })} ${year}`,
          zoomOut: { label: t('common.calendar.chooseMonth'), onClick: () => setView('months') },
          previous: {
            label: t('common.calendar.previousMonth'),
            onClick: () => goToMonth(addMonths(month, -1)),
            can: year > FIRST_YEAR || month.getMonth() > 0,
          },
          next: {
            label: t('common.calendar.nextMonth'),
            onClick: () => goToMonth(addMonths(month, 1)),
            can: year < lastYear || month.getMonth() < 11,
          },
        }
      : view === 'months'
        ? {
            label: String(year),
            zoomOut: { label: t('common.calendar.chooseYear'), onClick: () => setView('years') },
            previous: {
              label: t('common.calendar.previousYear'),
              onClick: () => goToMonth(addYears(month, -1)),
              can: year > FIRST_YEAR,
            },
            next: {
              label: t('common.calendar.nextYear'),
              onClick: () => goToMonth(addYears(month, 1)),
              can: year < lastYear,
            },
          }
        : {
            label: <Ltr>{`${decade} – ${decade + 9}`}</Ltr>,
            zoomOut: null,
            previous: {
              label: t('common.calendar.previousYears'),
              onClick: () => goToMonth(setYear(month, Math.max(year - 10, FIRST_YEAR))),
              can: decade > FIRST_YEAR,
            },
            next: {
              label: t('common.calendar.nextYears'),
              onClick: () => goToMonth(setYear(month, Math.min(year + 10, lastYear))),
              can: decade + 10 <= lastYear,
            },
          };

  return (
    <div data-part="calendar" className="w-70">
      <CalendarHeader {...header} />
      {body}
    </div>
  );
}
