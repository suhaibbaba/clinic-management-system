import type { PublicSlots } from '@clinic/shared';
import type { JSX } from 'react';

import { failureKey } from '@web/booking/api';
import type { DayChip } from '@web/booking/format';
import { t } from '@web/booking/i18n';
import { Alert, Button, Skeleton, cx } from '@web/booking/ui';
import type { AsyncState } from '@web/booking/use-async';

export type SlotOption = PublicSlots['slots'][number];

export function WhenStep({
  chips,
  week,
  date,
  onDate,
  selected,
  onSelect,
}: {
  readonly chips: readonly DayChip[];
  readonly week: AsyncState<readonly PublicSlots[]>;
  readonly date: string;
  readonly onDate: (date: string) => void;
  readonly selected: string | undefined;
  readonly onSelect: (slot: SlotOption) => void;
}): JSX.Element {
  const byDate = new Map((week.data ?? []).map((day) => [day.date, day]));
  const day = byDate.get(date);
  const slots = day?.slots ?? [];

  // A closure and an absence are on the door, so the patient gets the clinic's own words; a full
  // diary falls back to a plain "no times".
  const emptyMessage =
    day?.closedReason && day.closedNote
      ? t('when.closedFor', { reason: day.closedNote })
      : t('when.noSlots');

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={t('when.daysLabel')}>
        {/* Scrolls sideways: a week that wraps to two rows stops being a strip. */}
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {chips.map((chip) => {
            const known = byDate.has(chip.date);
            const closed = known && (byDate.get(chip.date)?.slots.length ?? 0) === 0;
            const active = chip.date === date;

            return (
              <li key={chip.date} className="shrink-0">
                <button
                  type="button"
                  disabled={closed}
                  aria-pressed={active}
                  aria-label={t('when.chooseDay', {
                    day: chip.label === 'today' || chip.label === 'tomorrow' ? '' : chip.label,
                  })}
                  onClick={() => onDate(chip.date)}
                  className={cx(
                    'flex min-h-[72px] w-16 cursor-pointer flex-col items-center justify-center gap-0.5',
                    'rounded-panel px-2 transition-colors duration-150',
                    active
                      ? 'bg-primary-600 text-ink-inverse'
                      : closed
                        ? 'cursor-not-allowed bg-inset text-ink-subtle line-through'
                        : 'border border-line bg-surface text-ink shadow-card hover:bg-row-hover',
                  )}
                >
                  <span className="text-label">
                    {chip.label === 'today' || chip.label === 'tomorrow'
                      ? t(`when.${chip.label}`)
                      : chip.label}
                  </span>
                  <span className="text-field font-medium tabular-nums">{chip.dayNumber}</span>
                  <span className="text-[11px] opacity-80">{chip.monthLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label={t('when.slotsLabel')}>
        {week.loading ? (
          <ul className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <li key={index}>
                <Skeleton className="h-12 rounded-control" />
              </li>
            ))}
          </ul>
        ) : week.error ? (
          <div className="flex flex-col gap-3">
            <Alert>{t(failureKey(week.error))}</Alert>
            <Button variant="secondary" onClick={week.reload}>
              {t('common.retry')}
            </Button>
          </div>
        ) : slots.length === 0 ? (
          <Alert tone="info">{emptyMessage}</Alert>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const active = slot.startsAt === selected;

              return (
                <li key={slot.startsAt}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={t('when.chooseSlot', { time: slot.start })}
                    onClick={() => onSelect(slot)}
                    dir="ltr"
                    className={cx(
                      'min-h-12 w-full cursor-pointer rounded-control text-field font-medium tabular-nums',
                      'transition-colors duration-150',
                      active
                        ? 'bg-primary-600 text-ink-inverse'
                        : 'border border-line bg-surface text-ink shadow-card hover:bg-row-hover',
                    )}
                  >
                    {slot.start}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
