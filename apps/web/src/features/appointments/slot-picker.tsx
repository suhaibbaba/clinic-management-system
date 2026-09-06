import type { Availability } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui';
import { cn } from '@web/lib/cn';

export interface SlotPickerProps {
  readonly availability: Availability | undefined;
  readonly isLoading: boolean;
  /** Null until a doctor and a date are both chosen. */
  readonly ready: boolean;
  readonly value: string | null;
  readonly onChange: (startsAt: string) => void;
}

/**
 * The free times for a doctor on a day, straight from the availability
 * endpoint.
 *
 * Only real slots are offered: the list is computed from the doctor's hours
 * intersected with the clinic's, minus what is booked, so a time on screen is
 * a time the API will accept. Taken slots are still drawn, disabled — a grid
 * with a hole in it says "that one is gone", where a shorter list just says
 * "there are fewer".
 *
 * When there is nothing at all, the reason is named. A closed clinic, a
 * doctor's day off and a full diary are three different answers, and an empty
 * box says the same nothing for all three.
 */
export function SlotPicker({
  availability,
  isLoading,
  ready,
  value,
  onChange,
}: SlotPickerProps): JSX.Element {
  const { t } = useTranslation();

  if (!ready) {
    return <Hint icon="info">{t('appointments.slots.chooseDoctorAndDate')}</Hint>;
  }

  if (isLoading) {
    return <Hint icon="spinner">{t('common.loading')}</Hint>;
  }

  if (!availability || availability.slots.length === 0) {
    return (
      <Hint icon="calendar">{t(`appointments.slots.${availability?.closedReason ?? 'none'}`)}</Hint>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label={t('appointments.slots.label')}
        className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4"
      >
        {availability.slots.map((slot) => {
          const selected = slot.startsAt === value;

          return (
            <button
              key={slot.startsAt}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!slot.available}
              onClick={() => onChange(slot.startsAt)}
              dir="ltr"
              className={cn(
                'rounded-control border px-2 py-1.5 text-value tabular-nums',
                'transition-colors duration-150',
                slot.available
                  ? 'cursor-pointer border-line-strong text-ink hover:border-primary-500 hover:bg-primary-50'
                  : 'cursor-not-allowed border-line bg-inset text-ink-subtle line-through',
                selected &&
                  'border-primary-600 bg-primary-600 text-ink-inverse hover:bg-primary-700',
              )}
            >
              {slot.start}
            </button>
          );
        })}
      </div>

      {availability.closedReason === 'fully_booked' && (
        <p className="text-label text-warning-700">{t('appointments.slots.fully_booked')}</p>
      )}
    </div>
  );
}

function Hint({ icon, children }: { icon: 'info' | 'spinner' | 'calendar'; children: string }) {
  return (
    <p className="flex items-center gap-2 rounded-control bg-inset px-3 py-2.5 text-label text-ink-muted">
      <Icon name={icon} className={cn('size-4', icon === 'spinner' && 'animate-spin')} />
      {children}
    </p>
  );
}
