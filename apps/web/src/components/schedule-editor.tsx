import type { DaySchedule, WeeklySchedule } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Icon, Switch, TimePicker } from '@web/components/ui';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const DEFAULT_RANGE = { start: '09:00', end: '17:00' } as const;

export interface ScheduleEditorProps {
  value: WeeklySchedule;
  onChange: (value: WeeklySchedule) => void;
  disabled?: boolean | undefined;
}

/**
 * Per-day working hours: a day is "off" when it has no intervals, which is the
 * same thing the API and the later slot computation mean by it. Breaks are the
 * gaps between intervals rather than a separate concept.
 *
 * Shared by the doctor schedule and the clinic opening hours.
 */
export function ScheduleEditor({
  value,
  onChange,
  disabled = false,
}: ScheduleEditorProps): JSX.Element {
  const { t } = useTranslation();

  const dayFor = (weekday: number): DaySchedule =>
    value.find((day) => day.weekday === weekday) ?? { weekday, ranges: [] };

  const replaceDay = (next: DaySchedule): void => {
    const others = value.filter((day) => day.weekday !== next.weekday);
    onChange([...others, next].sort((a, b) => a.weekday - b.weekday));
  };

  return (
    <div className="flex flex-col gap-2">
      {WEEKDAYS.map((weekday) => {
        const day = dayFor(weekday);
        const isWorking = day.ranges.length > 0;

        return (
          <div
            key={weekday}
            className="rounded-panel bg-canvas p-3"
            data-testid={`schedule-day-${weekday}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={isWorking}
                  disabled={disabled}
                  label={t(`schedule.weekday.${weekday}`)}
                  onCheckedChange={(checked) =>
                    replaceDay({ weekday, ranges: checked ? [{ ...DEFAULT_RANGE }] : [] })
                  }
                />
                <span className="text-value font-medium text-ink">
                  {t(`schedule.weekday.${weekday}`)}
                </span>
              </div>

              <span className="text-label text-ink-muted">
                {isWorking ? t('schedule.working') : t('schedule.off')}
              </span>
            </div>

            {isWorking && (
              <div className="mt-3 flex flex-col gap-2">
                {day.ranges.map((range, index) => (
                  // Intervals have no id; their position is their identity.
                  <div key={`${weekday}-${index}`} className="flex flex-wrap items-center gap-2">
                    <label className="text-label text-ink-muted">
                      {t('schedule.from')}
                      <TimePicker
                        id={`${weekday}-${index}-start`}
                        label={t('schedule.from')}
                        className="ms-2 inline-block w-32"
                        disabled={disabled}
                        value={range.start}
                        onChange={(value) =>
                          replaceDay({
                            weekday,
                            ranges: day.ranges.map((item, position) =>
                              position === index ? { ...item, start: value } : item,
                            ),
                          })
                        }
                      />
                    </label>

                    <label className="text-label text-ink-muted">
                      {t('schedule.to')}
                      <TimePicker
                        id={`${weekday}-${index}-end`}
                        label={t('schedule.to')}
                        className="ms-2 inline-block w-32"
                        disabled={disabled}
                        value={range.end}
                        onChange={(value) =>
                          replaceDay({
                            weekday,
                            ranges: day.ranges.map((item, position) =>
                              position === index ? { ...item, end: value } : item,
                            ),
                          })
                        }
                      />
                    </label>

                    {!disabled && day.ranges.length > 1 && (
                      <Button
                        icon={<Icon name="trash" />}
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          replaceDay({
                            weekday,
                            ranges: day.ranges.filter((_, position) => position !== index),
                          })
                        }
                      >
                        {t('schedule.removeRange')}
                      </Button>
                    )}
                  </div>
                ))}

                {!disabled && (
                  <div>
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
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
