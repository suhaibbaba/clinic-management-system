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
  onUrgent,
}: {
  readonly chips: readonly DayChip[];
  readonly week: AsyncState<readonly PublicSlots[]>;
  readonly date: string;
  readonly onDate: (date: string) => void;
  readonly selected: string | undefined;
  readonly onSelect: (slot: SlotOption) => void;
  // The way out when the diary cannot help — offered loudly when the day is empty, quietly when it
  // is not. Absent while rescheduling: they already have an appointment.
  readonly onUrgent?: (() => void) | undefined;
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
                    // The three lines are `pill-text` each, so the `gap` is the whole of the
                    // space between them rather than three type-scale line-heights.
                    'flex min-h-[72px] w-16 cursor-pointer flex-col items-center justify-center gap-2',
                    // Three lines, so not a single-line pill — but the same six states a field
                    // and a chip draw: bordered, primary-tinted when chosen, solid when shut.
                    'rounded-panel border-[1.5px] px-2 transition-colors duration-150',
                    active
                      ? 'border-primary-600 bg-primary-100 text-primary-700'
                      : closed
                        ? 'cursor-not-allowed border-transparent bg-inset text-ink-faint line-through'
                        : 'border-line-strong bg-surface text-ink hover:border-neutral-400',
                  )}
                >
                  <span className="pill-text inline-flex items-center text-label">
                    {chip.label === 'today' || chip.label === 'tomorrow'
                      ? t(`when.${chip.label}`)
                      : chip.label}
                  </span>
                  <span className="pill-text inline-flex items-center text-field font-medium tabular-nums">
                    {chip.dayNumber}
                  </span>
                  <span className="pill-text inline-flex items-center text-micro opacity-80">
                    {chip.monthLabel}
                  </span>
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
                <Skeleton className="h-(--control-h) rounded-control" />
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
          <div className="flex flex-col gap-3">
            <Alert tone="info">{emptyMessage}</Alert>
            {onUrgent && (
              <Button variant="secondary" full onClick={onUrgent}>
                {t('urgent.cta')}
              </Button>
            )}
          </div>
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
                      'min-h-(--control-h) w-full cursor-pointer rounded-control text-field font-medium',
                      'tabular-nums transition-colors duration-150',
                      active
                        ? 'border-[1.5px] border-primary-600 bg-primary-100 text-primary-700'
                        : 'border-[1.5px] border-line-strong bg-surface text-ink hover:border-neutral-400',
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

      {/* Small and always there: somebody whose pain will not wait until Tuesday should not have to
          find an empty day first. */}
      {onUrgent && (
        <button
          type="button"
          onClick={onUrgent}
          // 18px of link on the one control somebody in pain reaches for. The padding grows the
          // target; `-my-*` keeps the row where the layout put it.
          className="-my-3 cursor-pointer self-center px-3 py-3 text-label text-primary-700 underline underline-offset-4"
        >
          {t('urgent.link')}
        </button>
      )}
    </div>
  );
}
