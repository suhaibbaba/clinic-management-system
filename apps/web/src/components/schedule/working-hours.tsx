import type { DaySchedule, TimeRange, WeeklySchedule } from '@clinic/shared';
import * as Accordion from '@radix-ui/react-accordion';
import { useMemo, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Icon, Ltr, Switch, TimePicker } from '@web/components/ui';
import {
  DEFAULT_RANGE,
  daySummary,
  rangesFor,
  rangesOutsideBounds,
  WEEKDAYS_FROM_SATURDAY,
  withDay,
} from '@web/components/schedule/week';
import { cn } from '@web/lib/cn';

export interface WorkingHoursProps {
  readonly value: WeeklySchedule;
  readonly onChange: (value: WeeklySchedule) => void;
  readonly disabled?: boolean | undefined;
  /**
   * The hours this schedule has to fit inside — the clinic's, when the caller
   * is a doctor's page. A range outside them is flagged on its own row rather
   * than refused, so somebody moving a shift in two steps is not blocked
   * halfway through the first one.
   */
  readonly within?: WeeklySchedule | undefined;
  /** Names the bounds in the warning: "outside the clinic's hours". */
  readonly withinLabel?: string | undefined;
  /** Distinguishes the field ids when two of these are on one page. */
  readonly idPrefix?: string | undefined;
}

/**
 * A week of working hours, one row per day.
 *
 * **One component for the clinic's opening hours and for a doctor's own
 * schedule.** They are the same shape (`WeeklySchedule`) and the same question,
 * and the two editors that existed before agreed on everything except which
 * bugs they had.
 *
 * Collapsed, a day is its summary: `09:00 - 17:00`, `مغلق`, or both halves of a
 * split shift. That is the thing anybody opening this screen came to check, and
 * it used to take seven expanded panels of time pickers to read. Expanded, a
 * day is a toggle, its intervals, and a way to copy them to the rest of the
 * week — because a clinic almost always works the same hours five days running
 * and typing them five times is how the fifth one ends up different.
 *
 * **Split shifts are intervals, not a "break".** A day is a list of ranges and
 * the gaps between them are the breaks, which is what the slot computation
 * already means by it — so 09:00–13:00 and 16:00–20:00 needs no new concept.
 *
 * The week starts on **Saturday**, which is where it starts in the region these
 * clinics are in. The weekday *numbers* are unchanged (0 = Sunday, matching
 * `Date#getDay` and the API); only the order they are drawn in moved.
 */
export function WorkingHours({
  value,
  onChange,
  disabled = false,
  within,
  withinLabel,
  idPrefix = 'hours',
}: WorkingHoursProps): JSX.Element {
  const { t } = useTranslation();

  const replaceDay = (next: DaySchedule): void => onChange(withDay(value, next));

  /** Which days have a range poking outside the bounds, if there are bounds. */
  const outside = useMemo(() => {
    if (!within) {
      return new Set<number>();
    }

    return new Set(
      WEEKDAYS_FROM_SATURDAY.filter(
        (weekday) =>
          rangesOutsideBounds(rangesFor(value, weekday), rangesFor(within, weekday)).length > 0,
      ),
    );
  }, [value, within]);

  return (
    <Accordion.Root
      type="multiple"
      // Uncontrolled: which panels are open is a reading position, not state
      // anything else depends on, and the days people expand are the days they
      // are editing.
      className="flex flex-col gap-2"
    >
      {WEEKDAYS_FROM_SATURDAY.map((weekday) => {
        const day = { weekday, ranges: rangesFor(value, weekday) };
        const isWorking = day.ranges.length > 0;
        const weekdayName = t(`schedule.weekday.${weekday}`);

        return (
          <Accordion.Item
            key={weekday}
            value={String(weekday)}
            data-testid={`hours-day-${weekday}`}
            className="overflow-hidden rounded-panel bg-canvas"
          >
            <Accordion.Header>
              <Accordion.Trigger
                className={cn(
                  // 44px: this is the control that opens a day, and on a phone
                  // it is the only one.
                  'flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3 py-2',
                  'text-start transition-colors duration-150 hover:bg-inset',
                  'group',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon
                    name="chevron-down"
                    className="shrink-0 text-ink-subtle transition-transform duration-150 group-data-[state=open]:rotate-180"
                  />
                  <span className="truncate text-value font-medium text-ink">{weekdayName}</span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {outside.has(weekday) && (
                    // `Icon` is decorative by design, so the warning's words
                    // live on the element around it.
                    <span
                      className="flex text-warning-700"
                      aria-label={t('schedule.outsideBounds', { bounds: withinLabel ?? '' })}
                    >
                      <Icon name="alert" />
                    </span>
                  )}
                  <Badge tone={isWorking ? 'success' : 'neutral'}>
                    {/*
                      An LTR island, because the summary is Latin digits joined
                      by neutral characters: without it the bidi algorithm hands
                      the hyphens and the middot to the Arabic paragraph and
                      "09:00 - 13:00 · 16:00 - 20:00" renders back to front, as
                      "20:00 - 16:00 · 13:00 - 09:00". The word for closed is
                      Arabic and needs no island.
                    */}
                    {isWorking ? (
                      <Ltr className="tabular-nums">{daySummary(day.ranges, '')}</Ltr>
                    ) : (
                      t('schedule.closed')
                    )}
                  </Badge>
                </span>
              </Accordion.Trigger>
            </Accordion.Header>

            <Accordion.Content className="overflow-hidden">
              <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
                <Switch
                  checked={isWorking}
                  disabled={disabled}
                  label={weekdayName}
                  onCheckedChange={(checked) =>
                    replaceDay({ weekday, ranges: checked ? [{ ...DEFAULT_RANGE }] : [] })
                  }
                />

                {isWorking && (
                  <>
                    {day.ranges.map((range, index) => (
                      // Intervals have no id; their position is their identity.
                      <RangeRow
                        key={`${weekday}-${index}`}
                        idPrefix={idPrefix}
                        weekday={weekday}
                        index={index}
                        range={range}
                        disabled={disabled}
                        removable={day.ranges.length > 1}
                        onChange={(next) =>
                          replaceDay({
                            weekday,
                            ranges: day.ranges.map((item, position) =>
                              position === index ? next : item,
                            ),
                          })
                        }
                        onRemove={() =>
                          replaceDay({
                            weekday,
                            ranges: day.ranges.filter((_, position) => position !== index),
                          })
                        }
                      />
                    ))}

                    {outside.has(weekday) && withinLabel !== undefined && (
                      <p className="text-label text-warning-700">
                        {t('schedule.outsideBounds', { bounds: withinLabel })}
                      </p>
                    )}

                    {!disabled && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          icon={<Icon name="plus" />}
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            replaceDay({ weekday, ranges: [...day.ranges, { ...DEFAULT_RANGE }] })
                          }
                        >
                          {t('schedule.addRange')}
                        </Button>

                        <Button
                          icon={<Icon name="copy" />}
                          size="sm"
                          variant="ghost"
                          onClick={() => onChange(copyToOtherDays(value, day))}
                        >
                          {t('schedule.copyToOthers')}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}

interface RangeRowProps {
  readonly idPrefix: string;
  readonly weekday: number;
  readonly index: number;
  readonly range: TimeRange;
  readonly disabled: boolean;
  readonly removable: boolean;
  readonly onChange: (range: TimeRange) => void;
  readonly onRemove: () => void;
}

function RangeRow({
  idPrefix,
  weekday,
  index,
  range,
  disabled,
  removable,
  onChange,
  onRemove,
}: RangeRowProps): JSX.Element {
  const { t } = useTranslation();
  const id = `${idPrefix}-${weekday}-${index}`;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-label text-ink-muted" htmlFor={`${id}-start`}>
        {t('schedule.from')}
        <TimePicker
          id={`${id}-start`}
          label={t('schedule.from')}
          className="w-32"
          disabled={disabled}
          value={range.start}
          onChange={(start) => onChange({ ...range, start })}
        />
      </label>

      <label className="flex flex-col gap-1 text-label text-ink-muted" htmlFor={`${id}-end`}>
        {t('schedule.to')}
        <TimePicker
          id={`${id}-end`}
          label={t('schedule.to')}
          className="w-32"
          disabled={disabled}
          // The end cannot precede the start, so the list starts there — the
          // schema refuses an inverted range and this stops it being offered.
          min={range.start}
          value={range.end}
          onChange={(end) => onChange({ ...range, end })}
        />
      </label>

      {!disabled && removable && (
        <Button icon={<Icon name="trash" />} size="sm" variant="ghost" onClick={onRemove}>
          {t('schedule.removeRange')}
        </Button>
      )}
    </div>
  );
}

/**
 * This day's intervals onto every **other working day**.
 *
 * Days that are off stay off: "the same hours Saturday to Wednesday" is the
 * thing people mean, and opening two days that were deliberately shut is a
 * change nobody asked for and would have to undo one by one.
 */
function copyToOtherDays(week: WeeklySchedule, source: DaySchedule): WeeklySchedule {
  return WEEKDAYS_FROM_SATURDAY.reduce<WeeklySchedule>((week_, weekday) => {
    const existing = rangesFor(week_, weekday);

    if (weekday === source.weekday || existing.length === 0) {
      return week_;
    }

    return withDay(week_, { weekday, ranges: source.ranges.map((range) => ({ ...range })) });
  }, week);
}
