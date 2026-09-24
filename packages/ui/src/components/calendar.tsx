import { addMonths, addYears, format, setMonth, setYear, startOfMonth } from "date-fns";
import { ar, enGB, type Locale } from "date-fns/locale";
import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import {
  DayPicker,
  type DayButtonProps,
  type DayPickerProps,
  type Modifiers,
} from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";

export function dateLocale(language: string): Locale {
  return language.split("-")[0] === "ar" ? ar : enGB;
}

/** A date of birth: the years have to reach back past any living patient. */
const FIRST_YEAR = 1900;

type CalendarView = "days" | "months" | "years";

interface DayState {
  /** The cell's fill: a range band runs edge to edge, which the inset button cannot draw. */
  readonly cell?: string;
  readonly button: string;
}

const DAY_STATES = {
  plain: { button: "text-ink hover:bg-inset" },
  muted: { button: "text-ink-faint" },
  // Today is green wherever it is, so the chosen date and today never look alike: outlined on its
  // own, filled when it is also the choice — where a dot under the number used to carry it.
  today: { button: "border-[1.5px] border-success-600 text-success-800 hover:bg-success-50" },
  selected: { button: "bg-primary-600 text-ink-inverse hover:bg-primary-700" },
  // A darker green than the outline: white on the brighter ones falls short of 4.5:1 at this size.
  todaySelected: {
    button: cn(
      "bg-linear-to-br from-success-700 to-success-900 text-ink-inverse",
      "hover:from-success-800 hover:to-success-900",
    ),
  },
  rangeMiddle: { cell: "bg-selected", button: "text-ink hover:bg-primary-200" },
} satisfies Record<string, DayState>;

// Inside a range the band is the fill and today cannot be green, so it keeps a green dot instead.
const TODAY_DOT = cn(
  "after:absolute after:inset-x-0 after:bottom-1 after:mx-auto",
  'after:size-1 after:rounded-pill after:content-[""]',
);

/** Logical, so the start of a range is rounded on the side the reader comes from, in both scripts. */
function rangeRounding(isStart: boolean, isEnd: boolean): string {
  if (isStart === isEnd) {
    return "rounded-control";
  }

  return isStart ? "rounded-s-control" : "rounded-e-control";
}

function dayInk(modifiers: Modifiers): string {
  const isToday = modifiers["today"] === true;

  if (modifiers["disabled"] === true) {
    return cn(DAY_STATES.muted.button, "rounded-control");
  }

  if (modifiers["range_middle"] === true) {
    return cn(DAY_STATES.rangeMiddle.button, isToday && cn(TODAY_DOT, "after:bg-success-600"));
  }

  if (modifiers["selected"] === true) {
    return cn(
      isToday ? DAY_STATES.todaySelected.button : DAY_STATES.selected.button,
      rangeRounding(modifiers["range_start"] === true, modifiers["range_end"] === true),
    );
  }

  if (isToday) {
    return cn(DAY_STATES.today.button, "rounded-control");
  }

  return cn(
    modifiers["outside"] === true ? DAY_STATES.muted.button : DAY_STATES.plain.button,
    "rounded-control",
  );
}

function CalendarDayButton({ day, modifiers, className, ...props }: DayButtonProps): JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const isFocused = modifiers["focused"] === true;

  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused]);

  return (
    <button
      ref={ref}
      data-part="day-cell"
      data-testid={`calendar-day-${format(day.date, "yyyy-MM-dd")}`}
      {...props}
      className={cn(className, dayInk(modifiers))}
    />
  );
}

const NAV_BUTTON = cn(
  "inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center rounded-control",
  "text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink",
  "disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent",
);

const CAPTION_BUTTON = cn(
  "inline-flex h-(--control-h-sm) cursor-pointer items-center gap-2 rounded-control px-3",
  "text-value font-medium text-ink transition-colors duration-150 hover:bg-inset",
);

// A pill at the field's own height: a year or a month is a choice in a list, not a cell of the
// month's grid, so it reads as a row of buttons with room around each value.
const PERIOD_CELL = cn(
  "inline-flex h-(--control-h) w-full cursor-pointer items-center justify-center rounded-pill",
  "text-value tabular-nums transition-colors duration-150",
);

interface CalendarHeaderProps {
  readonly label: ReactNode;
  readonly zoomOut: { readonly label: string; readonly onClick: () => void } | null;
  /** Absent where the page scrolls instead of stepping, as the years do. */
  readonly previous?: CalendarStep | undefined;
  readonly next?: CalendarStep | undefined;
}

interface CalendarStep {
  readonly label: string;
  readonly onClick: () => void;
  readonly can: boolean;
}

/** Holds the arrow's place, so the caption stays centred without one. */
const NAV_SPACER = <span aria-hidden="true" className="size-(--control-h-sm) shrink-0" />;

function CalendarHeader({ label, zoomOut, previous, next }: CalendarHeaderProps): JSX.Element {
  return (
    <div
      data-part="calendar-header"
      data-testid="calendar-header"
      className="flex h-(--control-h-sm) items-center justify-between gap-2"
    >
      {previous ? (
        <button
          type="button"
          data-part="calendar-previous"
          data-testid="calendar-previous"
          aria-label={previous.label}
          disabled={!previous.can}
          onClick={previous.onClick}
          className={NAV_BUTTON}
        >
          <Icon name="chevron-start" className="size-4" />
        </button>
      ) : (
        NAV_SPACER
      )}

      {zoomOut ? (
        <button
          type="button"
          data-part="calendar-caption"
          data-testid="calendar-caption"
          aria-label={zoomOut.label}
          onClick={zoomOut.onClick}
          className={CAPTION_BUTTON}
        >
          {label}
          <Icon name="chevron-down" className="size-4 text-ink-subtle" />
        </button>
      ) : (
        <span
          data-part="calendar-caption"
          data-testid="calendar-caption"
          className="text-value font-medium text-ink"
        >
          {label}
        </span>
      )}

      {next ? (
        <button
          type="button"
          data-part="calendar-next"
          data-testid="calendar-next"
          aria-label={next.label}
          disabled={!next.can}
          onClick={next.onClick}
          className={NAV_BUTTON}
        >
          <Icon name="chevron-end" className="size-4" />
        </button>
      ) : (
        NAV_SPACER
      )}
    </div>
  );
}

interface PeriodOption {
  readonly key: number;
  readonly label: string;
  readonly isSelected: boolean;
  readonly isCurrent: boolean;
}

/** The same inks as a day: chosen is filled, this year or month is green like today. */
function periodInk(option: PeriodOption): string {
  if (option.isSelected) {
    return cn(
      option.isCurrent ? DAY_STATES.todaySelected.button : DAY_STATES.selected.button,
      "font-medium",
    );
  }

  return option.isCurrent ? DAY_STATES.today.button : DAY_STATES.plain.button;
}

interface PeriodGridProps {
  readonly label: string;
  readonly columns: 3 | 4;
  readonly options: readonly PeriodOption[];
  readonly onPick: (key: number) => void;
  /** Scrolls instead of paging, opened on the chosen option. */
  readonly scrolls?: boolean | undefined;
}

function PeriodGrid({
  label,
  columns,
  options,
  onPick,
  scrolls = false,
}: PeriodGridProps): JSX.Element {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = list.current;
    const chosen = container?.querySelector<HTMLElement>('[aria-current="true"]');

    // `scrollTop`, not `scrollIntoView`: that would scroll the dialog behind the popover too.
    if (scrolls && container && chosen) {
      container.scrollTop = chosen.offsetTop - (container.clientHeight - chosen.clientHeight) / 2;
    }
  }, [scrolls]);

  return (
    <div
      ref={list}
      data-part="calendar-periods"
      data-testid="calendar-periods"
      role="group"
      aria-label={label}
      className={cn(
        "relative mt-3 grid gap-x-2 gap-y-2.5",
        columns === 3 ? "grid-cols-3" : "grid-cols-4",
        scrolls && "scroll-lane max-h-60 overflow-y-auto overscroll-contain py-1 pe-2.5",
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          data-part="calendar-period"
          data-testid={`calendar-period-${String(option.key)}`}
          aria-current={option.isSelected ? "true" : undefined}
          onClick={() => onPick(option.key)}
          className={cn(PERIOD_CELL, periodInk(option))}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Calendar(props: DayPickerProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const isRtl = i18n.language.split("-")[0] === "ar";

  // Opens on the days, as every date picker does; the caption zooms out to months and years.
  const [view, setView] = useState<CalendarView>("days");
  const [month, goToMonth] = useState(() =>
    startOfMonth(props.month ?? props.defaultMonth ?? new Date()),
  );

  const shownOn = (props.month ?? props.defaultMonth)?.getTime();

  useEffect(() => {
    if (shownOn !== undefined) {
      goToMonth(startOfMonth(new Date(shownOn)));
    }
  }, [shownOn]);

  const lastYear = new Date().getFullYear() + 1;
  const year = month.getFullYear();

  const body =
    view === "days" ? (
      <DayPicker
        showOutsideDays
        {...props}
        month={month}
        onMonthChange={goToMonth}
        hideNavigation
        locale={locale}
        dir={isRtl ? "rtl" : "ltr"}
        components={{ DayButton: CalendarDayButton }}
        // Explicit formatters: the default is locale-aware and would render Arabic-Indic digits.
        formatters={{
          formatDay: (date: Date) => String(date.getDate()),
          formatWeekdayName: (date: Date) => format(date, "EEEEEE", { locale }),
        }}
        classNames={{
          root: "text-value text-ink",
          month: "w-full",
          month_caption: "hidden",
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday: "flex-1 pt-2 pb-1 text-micro font-medium text-ink-subtle",
          week: "flex w-full",
          day: "flex flex-1 justify-center p-0.5",
          day_button: cn(
            "relative inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center",
            "text-value tabular-nums transition-colors duration-150",
          ),
          // The ink is `dayInk`, one state at a time; the cell carries only the range's band.
          selected: "",
          today: "",
          outside: "",
          disabled: "",
          range_start: cn(DAY_STATES.rangeMiddle.cell, "rounded-s-chip"),
          range_end: cn(DAY_STATES.rangeMiddle.cell, "rounded-e-chip"),
          range_middle: DAY_STATES.rangeMiddle.cell,
          hidden: "invisible",
        }}
      />
    ) : view === "months" ? (
      <PeriodGrid
        label={t("common.calendar.chooseMonth")}
        columns={3}
        options={Array.from({ length: 12 }, (_, index) => ({
          key: index,
          label: format(setMonth(month, index), "LLL", { locale }),
          isSelected: month.getMonth() === index,
          isCurrent: new Date().getFullYear() === year && new Date().getMonth() === index,
        }))}
        onPick={(index) => {
          goToMonth(startOfMonth(setMonth(month, index)));
          setView("days");
        }}
      />
    ) : (
      <PeriodGrid
        label={t("common.calendar.chooseYear")}
        columns={4}
        scrolls
        options={Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, index) => {
          const value = FIRST_YEAR + index;

          return {
            key: value,
            label: String(value),
            isSelected: value === year,
            isCurrent: value === new Date().getFullYear(),
          };
        })}
        onPick={(value) => {
          goToMonth(startOfMonth(setYear(month, value)));
          setView("months");
        }}
      />
    );

  const header: CalendarHeaderProps =
    view === "days"
      ? {
          label: `${format(month, "LLLL", { locale })} ${year}`,
          zoomOut: { label: t("common.calendar.chooseMonth"), onClick: () => setView("months") },
          previous: {
            label: t("common.calendar.previousMonth"),
            onClick: () => goToMonth(addMonths(month, -1)),
            can: year > FIRST_YEAR || month.getMonth() > 0,
          },
          next: {
            label: t("common.calendar.nextMonth"),
            onClick: () => goToMonth(addMonths(month, 1)),
            can: year < lastYear || month.getMonth() < 11,
          },
        }
      : view === "months"
        ? {
            label: String(year),
            zoomOut: { label: t("common.calendar.chooseYear"), onClick: () => setView("years") },
            previous: {
              label: t("common.calendar.previousYear"),
              onClick: () => goToMonth(addYears(month, -1)),
              can: year > FIRST_YEAR,
            },
            next: {
              label: t("common.calendar.nextYear"),
              onClick: () => goToMonth(addYears(month, 1)),
              can: year < lastYear,
            },
          }
        : { label: t("common.calendar.chooseYear"), zoomOut: null };

  return (
    <div data-part="calendar" data-testid="calendar" className="w-70">
      <CalendarHeader {...header} />
      {body}
    </div>
  );
}
