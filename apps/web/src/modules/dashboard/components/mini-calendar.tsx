import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Icon, Ltr, Widget } from "@clinic/ui";
import { toIsoDate, todayIso } from "@web/modules/appointments/lib/calendar-time";
import { useCalendar } from "@web/modules/appointments/queries";
import { cn } from "@clinic/ui/lib/cn";
import { MINI_CALENDAR_WEEKDAYS } from "@web/modules/dashboard/constants";

export function MiniCalendar(): JSX.Element {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const today = todayIso();
  const [month, setMonth] = useState(() => today.slice(0, 7));

  const feed = useCalendar({ date: `${month}-01`, range: "month" });

  const booked = useMemo(() => {
    const days = new Set<string>();

    for (const appointment of feed.data?.appointments ?? []) {
      days.add(toIsoDate(new Date(appointment.startsAt)));
    }

    return days;
  }, [feed.data]);

  const cells = useMemo(() => monthCells(month), [month]);

  const monthLabel = new Intl.DateTimeFormat(
    i18n.language.startsWith("en") ? "en-GB-u-ca-gregory-nu-latn" : "ar-SY-u-ca-gregory-nu-latn",
    { month: "long", year: "numeric" },
  ).format(new Date(`${month}-01T12:00:00Z`));

  return (
    <Widget data-testid="mini-calendar">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <b data-testid="mini-calendar-month" className="text-section font-bold">
          {monthLabel}
        </b>

        <div className="flex gap-1">
          <StepButton
            data-testid="mini-calendar-previous"
            label={t("dashboard.calendar.previous")}
            icon="chevron-start"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
          />
          <StepButton
            data-testid="mini-calendar-next"
            label={t("dashboard.calendar.next")}
            icon="chevron-end"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
          />
        </div>
      </div>

      <div data-testid="mini-calendar-grid" className="grid grid-cols-7 gap-[3px] text-center">
        {MINI_CALENDAR_WEEKDAYS.map((key) => (
          <b key={key} className="py-1 text-micro font-medium text-ink-muted">
            {t(`dashboard.calendar.weekday.${key}`)}
          </b>
        ))}

        {cells.map((cell, index) =>
          cell === null ? (
            <span key={`pad-${index}`} aria-hidden="true" className="py-1.5" />
          ) : (
            <Day
              key={cell}
              date={cell}
              isToday={cell === today}
              hasAppointments={booked.has(cell)}
              onOpen={() => void navigate(`/appointments?date=${cell}`)}
              label={t("dashboard.calendar.open")}
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
      data-testid={`mini-calendar-day-${date}`}
      onClick={onOpen}
      aria-label={`${label} ${date}`}
      aria-current={isToday ? "date" : undefined}
      className={cn(
        "pill-text inline-flex items-center relative cursor-pointer justify-center rounded-chip py-1.5 text-label font-medium",
        "min-h-(--control-h) lg:min-h-0",
        "transition-colors duration-150",
        isToday ? "today-wash text-ink-inverse" : "text-ink hover:bg-primary-100",
      )}
    >
      <Ltr>{Number(date.slice(8))}</Ltr>

      {hasAppointments && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0.5 start-1/2 size-1 -translate-x-1/2 rounded-pill rtl:translate-x-1/2",
            isToday ? "bg-ink-inverse" : "bg-success-500",
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
  "data-testid": testId,
}: {
  readonly label: string;
  readonly icon: "chevron-start" | "chevron-end";
  readonly onClick: () => void;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-(--control-h) cursor-pointer items-center justify-center lg:size-(--control-h-sm)",
        "rounded-chip border border-line bg-canvas text-ink-muted",
        "transition-colors duration-150 hover:border-primary-600 hover:text-primary-700",
      )}
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  );
}

function monthCells(month: string): readonly (string | null)[] {
  const [year = 0, index = 1] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const lead = first.getUTCDay();

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);

  for (let day = 1; day <= days; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [year = 0, index = 1] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, index - 1 + delta, 1));

  return shifted.toISOString().slice(0, 7);
}
