import type { PublicSlots } from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { failureKey } from "@web/booking/api";
import { dayTitle, formatTime, weekTitle, type DayChip } from "@web/booking/format";
import { bookingLocale, t } from "@web/booking/i18n";
import { GLYPH } from "@web/booking/constants";
import { Alert, Button, Glyph, Skeleton, cx } from "@web/booking/ui";
import type { AsyncState } from "@web/booking/use-async";

export type SlotOption = PublicSlots["slots"][number];

const NOON = 12;

const isMorning = (slot: SlotOption): boolean => Number(slot.start.split(":")[0]) < NOON;

const slotCount = (count: number): string =>
  t(`when.count.${new Intl.PluralRules(bookingLocale().language).select(count)}`, { count });

function WeekArrow({
  direction,
  disabled,
  onClick,
}: {
  readonly direction: "previous" | "next";
  readonly disabled: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={`when-week-${direction}`}
      aria-label={t(`when.${direction}Week`)}
      {...(disabled && { "aria-disabled": true })}
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
      className={cx(
        "inline-flex size-(--control-h) shrink-0 items-center justify-center rounded-pill border border-line bg-surface text-primary-700 shadow-pill transition-colors duration-200",
        disabled
          ? "cursor-not-allowed opacity-35"
          : "cursor-pointer hover:border-primary-300 hover:bg-primary-50",
      )}
    >
      <Glyph
        path={GLYPH.chevron}
        className={direction === "previous" ? "ltr:-scale-x-100" : "rtl:-scale-x-100"}
      />
    </button>
  );
}

function DayCard({
  chip,
  count,
  active,
  onPick,
}: {
  readonly chip: DayChip;
  readonly count: number | undefined;
  readonly active: boolean;
  readonly onPick: () => void;
}): JSX.Element {
  const closed = count === 0;
  const relative = chip.label === "today" || chip.label === "tomorrow";

  return (
    <button
      type="button"
      data-testid={`when-day-${chip.date}`}
      {...(closed && { "aria-disabled": true })}
      aria-pressed={active}
      aria-label={t("when.chooseDay", { day: dayTitle(chip.date) })}
      onClick={() => {
        if (!closed) {
          onPick();
        }
      }}
      className={cx(
        "flex h-full w-full flex-col items-center gap-1 rounded-card border px-1 pt-2.5 pb-2 text-center",
        "transition-[background-color,border-color,color,box-shadow,translate] duration-200",
        active
          ? "-translate-y-0.5 border-primary-600 bg-primary-600 text-ink-inverse shadow-nav-active"
          : closed
            ? "cursor-not-allowed border-dashed border-line bg-sunken/60 text-ink-faint"
            : "cursor-pointer border-line bg-surface text-ink shadow-pill hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card",
      )}
    >
      <span
        className={cx(
          "text-micro font-medium",
          active
            ? "text-ink-inverse/85"
            : relative && !closed
              ? "text-primary-600"
              : "text-ink-muted",
          closed && "text-ink-faint",
        )}
      >
        {relative ? t(`when.${chip.label}`) : chip.weekday}
      </span>
      <span className="text-title font-bold tabular-nums">{chip.dayNumber}</span>
      <span
        className={cx(
          "min-h-4 text-micro",
          active ? "text-ink-inverse/90" : closed ? "text-ink-faint" : "text-success-700",
        )}
      >
        {count === undefined ? "" : closed ? t("when.closed") : slotCount(count)}
      </span>
    </button>
  );
}

function SlotGroup({
  title,
  icon,
  slots,
  selected,
  onSelect,
}: {
  readonly title: string;
  readonly icon: string;
  readonly slots: readonly SlotOption[];
  readonly selected: string | undefined;
  readonly onSelect: (slot: SlotOption) => void;
}): JSX.Element | null {
  if (slots.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-label font-medium text-ink-muted">
        <span className="inline-flex size-7 items-center justify-center rounded-pill bg-primary-50 text-primary-600">
          <Glyph path={icon} />
        </span>
        {title}
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((slot) => {
          const active = slot.startsAt === selected;

          return (
            <li key={slot.startsAt}>
              <button
                type="button"
                data-testid={`when-slot-${slot.start}`}
                aria-pressed={active}
                aria-label={t("when.chooseSlot", { time: formatTime(slot.startsAt) })}
                onClick={() => onSelect(slot)}
                dir="ltr"
                className={cx(
                  "inline-flex min-h-(--control-h) w-full cursor-pointer items-center justify-center rounded-control border px-1 text-value font-medium whitespace-nowrap tabular-nums",
                  "transition-[background-color,border-color,color,box-shadow,scale] duration-200 active:scale-95",
                  active
                    ? "border-primary-600 bg-primary-600 text-ink-inverse shadow-nav-active"
                    : "border-line-strong bg-surface text-ink hover:border-primary-600 hover:bg-primary-50 hover:text-primary-800",
                )}
              >
                {formatTime(slot.startsAt)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WhenStep({
  chips,
  week,
  date,
  onDate,
  canPrevious,
  canNext,
  onWeek,
  selected,
  onSelect,
  onUrgent,
  header,
}: {
  readonly chips: readonly DayChip[];
  readonly week: AsyncState<readonly PublicSlots[]>;
  readonly date: string;
  readonly onDate: (date: string) => void;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly onWeek: (step: 1 | -1) => void;
  readonly selected: string | undefined;
  readonly onSelect: (slot: SlotOption) => void;
  readonly onUrgent?: (() => void) | undefined;
  readonly header?: ReactNode;
}): JSX.Element {
  const byDate = new Map((week.data ?? []).map((day) => [day.date, day]));
  const day = byDate.get(date);
  const slots = day?.slots ?? [];
  const first = chips[0];
  const last = chips.at(-1);

  const emptyMessage =
    day?.closedReason && day.closedNote
      ? t("when.closedFor", { reason: day.closedNote })
      : t("when.noSlots");

  return (
    <div data-testid="when-step" className="flex min-w-0 flex-col gap-5">
      {header}

      <section
        data-testid="when-step-days"
        aria-label={t("when.daysLabel")}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-3">
          <WeekArrow direction="previous" disabled={!canPrevious} onClick={() => onWeek(-1)} />
          {first && last && (
            <p
              data-testid="when-week"
              aria-live="polite"
              className="text-center text-section font-bold text-primary-900"
            >
              {weekTitle(first.date, last.date)}
            </p>
          )}
          <WeekArrow direction="next" disabled={!canNext} onClick={() => onWeek(1)} />
        </div>

        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-7 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <li key={chip.date} className="w-[4.5rem] shrink-0 snap-start sm:w-auto">
              {week.loading ? (
                <Skeleton className="h-[5.5rem] rounded-card" />
              ) : (
                <DayCard
                  chip={chip}
                  count={byDate.get(chip.date)?.slots.length}
                  active={chip.date === date}
                  onPick={() => onDate(chip.date)}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section
        data-testid="when-step-slots"
        aria-label={t("when.slotsLabel")}
        className="flex flex-col gap-5 rounded-card bg-sunken/60 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-heading font-bold text-ink">{dayTitle(date)}</p>
          {!week.loading && slots.length > 0 && (
            <p className="text-label text-success-700">{slotCount(slots.length)}</p>
          )}
        </div>

        {week.loading ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <li key={index}>
                <Skeleton className="h-(--control-h) rounded-control" />
              </li>
            ))}
          </ul>
        ) : week.error ? (
          <div className="flex flex-col gap-3">
            <Alert>{t(failureKey(week.error))}</Alert>
            <Button variant="secondary" data-testid="when-step-retry" onClick={week.reload}>
              {t("common.retry")}
            </Button>
          </div>
        ) : slots.length === 0 ? (
          <Alert tone="info" data-testid="when-step-empty">
            {emptyMessage}
          </Alert>
        ) : (
          <>
            <SlotGroup
              title={t("when.morning")}
              icon={GLYPH.sun}
              slots={slots.filter(isMorning)}
              selected={selected}
              onSelect={onSelect}
            />
            <SlotGroup
              title={t("when.evening")}
              icon={GLYPH.moon}
              slots={slots.filter((slot) => !isMorning(slot))}
              selected={selected}
              onSelect={onSelect}
            />
          </>
        )}
      </section>

      {onUrgent && (
        <div
          data-testid="when-step-urgent-row"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card border border-warning-100 bg-warning-50 px-4 py-3"
        >
          <p className="text-label text-warning-800">{t("when.urgentPrompt")}</p>
          <button
            type="button"
            data-testid="when-step-urgent"
            onClick={onUrgent}
            className="inline-flex cursor-pointer items-center gap-1 text-label font-bold text-warning-800 underline-offset-4 transition-colors duration-200 hover:underline"
          >
            {t("urgent.link")}
            <Glyph path={GLYPH.chevron} className="size-3.5 rtl:-scale-x-100" />
          </button>
        </div>
      )}
    </div>
  );
}
