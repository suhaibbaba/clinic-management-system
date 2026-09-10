import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@web/components/ui/icon';
import { openOnArrowDown, usePickerOpen } from '@web/components/ui/picker-open';
import { Popover } from '@web/components/ui/popover';
import { cn } from '@web/lib/cn';

/** `HH:mm`, 24-hour, Latin digits — the same shape the API stores. */
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidTime = (value: string): boolean => TIME.test(value);

/** Quarter hours because that is how a clinic books; offering 09:07 invites a diary nobody can read. */
export function timeSlots(from = '00:00', to = '23:45', stepMinutes = 15): readonly string[] {
  const minutes = (value: string): number => {
    const [h = '0', m = '0'] = value.split(':');
    return Number(h) * 60 + Number(m);
  };

  const start = minutes(from);
  const end = minutes(to);
  const slots: string[] = [];

  for (let at = start; at <= end; at += stepMinutes) {
    const h = String(Math.floor(at / 60)).padStart(2, '0');
    const m = String(at % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }

  return slots;
}

export interface TimePickerProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  /** Bounds the list — a clinic's opening hours, once appointments land. */
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  readonly stepMinutes?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly hasError?: boolean | undefined;
  readonly className?: string | undefined;
}

// Bounded by `min`/`max` so it can follow the clinic's hours, with typing left open for a visit
// recorded after hours. A native `<select>` of 96 rows is a full-screen wheel.
export function TimePicker({
  id,
  value,
  onChange,
  label,
  min,
  max,
  stepMinutes = 15,
  disabled = false,
  hasError = false,
  className,
}: TimePickerProps): JSX.Element {
  const { t } = useTranslation();
  const picker = usePickerOpen();
  const [typed, setTyped] = useState(value);

  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setTyped(value);
  }

  const slots = timeSlots(min ?? '00:00', max ?? '23:45', stepMinutes);

  const commit = (text: string): void => {
    setTyped(text);

    if (text.trim() === '') {
      onChange('');
      return;
    }

    if (isValidTime(text)) {
      onChange(text);
    }
  };

  return (
    <Popover
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      anchor={
        <div className={cn('relative', className)}>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={hasError || undefined}
            placeholder={t('common.placeholders.time')}
            value={typed}
            onChange={(event) => commit(event.target.value)}
            // Clicking shows the list without taking focus, so a time can still be typed over the
            // top. Focus alone opens nothing.
            {...picker.opens(false)}
            onKeyDown={openOnArrowDown(picker.show)}
            className={cn(
              // The value is Latin so the field is `dir="ltr"`, but its alignment belongs to the
              // page — by its own direction it sat on the left of an Arabic form.
              'block h-11 w-full rounded-control border bg-surface lg:h-9',
              // Physical deliberately: the field is `dir="ltr"`, so `ps`/`pe` would reserve the
              // icon's room on the wrong side of an Arabic form.
              'page-rtl:pl-11 page-rtl:pr-3.5 page-rtl:text-right',
              'page-ltr:pl-3.5 page-ltr:pr-11 page-ltr:text-left',
              'text-field text-ink tabular-nums placeholder:text-ink-subtle',
              'transition-[border-color,box-shadow] duration-150',
              'focus:border-primary-500',
              'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle',
              // The same border as every other field in the form: this one
              // used to be a step darker, which read as a different control.
              hasError ? 'border-danger-500' : 'border-line',
            )}
          />

          <button
            type="button"
            disabled={disabled}
            aria-label={t('common.openTimes')}
            // Asked for outright, so the keyboard lands in the list.
            {...picker.opens(true)}
            className={cn(
              'absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center',
              'text-ink-subtle transition-colors duration-150 hover:text-ink',
              'disabled:cursor-not-allowed',
            )}
          >
            <Icon name="clock" />
          </button>
        </div>
      }
    >
      <ul aria-label={label} className="max-h-64 w-full min-w-40 overflow-y-auto md:max-h-72">
        {slots.map((slot) => (
          <li key={slot}>
            <button
              type="button"
              onClick={() => {
                onChange(slot);
                picker.onOpenChange(false);
              }}
              aria-current={slot === value || undefined}
              dir="ltr"
              className={cn(
                'flex w-full cursor-pointer items-center justify-between rounded-control px-3 py-2',
                'text-start text-value tabular-nums transition-colors duration-150',
                slot === value ? 'bg-primary-600 text-ink-inverse' : 'text-ink hover:bg-inset',
              )}
            >
              {slot}
              {slot === value && <Icon name="check" className="size-4" />}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
