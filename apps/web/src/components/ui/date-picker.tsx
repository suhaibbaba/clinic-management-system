import { format, isValid, parse } from 'date-fns';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@web/components/ui/button';
import { Calendar, dateLocale } from '@web/components/ui/calendar';
import { Icon } from '@web/components/ui/icon';
import { openOnArrowDown, usePickerOpen } from '@web/components/ui/picker-open';
import { Popover } from '@web/components/ui/popover';
import { cn } from '@web/lib/cn';

/** The wire format everywhere: what the API takes and returns. */
const ISO = 'yyyy-MM-dd';
/** What a person types and reads. Gregorian, Latin digits, day first. */
const TYPED = 'dd/MM/yyyy';

export const toIsoDate = (date: Date): string => format(date, ISO);

/** Parses the display format back to a date, rejecting `31/02/2026`. */
export function parseTypedDate(value: string): Date | null {
  const parsed = parse(value, TYPED, new Date());

  return isValid(parsed) && format(parsed, TYPED) === value ? parsed : null;
}

export function fromIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, ISO, new Date());
  return isValid(parsed) ? parsed : undefined;
}

export interface DatePickerProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly hasError?: boolean | undefined;
  readonly className?: string | undefined;
}

// Replaces `<input type="date">`, which showed `mm/dd/yyyy` to an Arabic clinic. Text commits only
// when it parses, so `12/0` leaves the value alone and `31/02` is refused.
export function DatePicker({
  id,
  value,
  onChange,
  label,
  disabled = false,
  hasError = false,
  className,
}: DatePickerProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const picker = usePickerOpen();
  const selected = fromIsoDate(value);
  const [typed, setTyped] = useState(() => (selected ? format(selected, TYPED) : ''));

  // The field follows the value when it changes from outside — a reset button,
  // a form reset — without fighting what is being typed inside it.
  const display = selected ? format(selected, TYPED) : '';
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setTyped(display);
  }

  const commit = (text: string): void => {
    setTyped(text);

    if (text.trim() === '') {
      onChange('');
      return;
    }

    const parsed = parseTypedDate(text);
    if (parsed) {
      onChange(toIsoDate(parsed));
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
            placeholder={t('common.placeholders.date')}
            value={typed}
            onChange={(event) => commit(event.target.value)}
            // Clicking shows the calendar without taking focus, so the caret stays where it was put
            // and typing carries on. Focus alone opens nothing.
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
            aria-label={t('common.openCalendar')}
            // Asked for outright, so this one does take the focus: the
            // keyboard lands in the calendar rather than behind it.
            {...picker.opens(true)}
            className={cn(
              // A full 44px wide: it is the only way into the calendar with a thumb.
              'absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center',
              'text-ink-subtle transition-colors duration-150 hover:text-ink',
              'disabled:cursor-not-allowed',
            )}
          >
            <Icon name="calendar" />
          </button>
        </div>
      }
    >
      <Calendar
        mode="single"
        {...(selected && { selected, defaultMonth: selected })}
        onSelect={(date: Date | undefined) => {
          if (date) {
            onChange(toIsoDate(date));
            picker.onOpenChange(false);
          }
        }}
      />

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="x" />}
          onClick={() => {
            onChange('');
            picker.onOpenChange(false);
          }}
        >
          {t('common.clear')}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          icon={<Icon name="calendar" />}
          onClick={() => {
            onChange(toIsoDate(new Date()));
            picker.onOpenChange(false);
          }}
        >
          {t('common.today')}
        </Button>
      </div>

      {/* Announces the current selection to a screen reader on open. */}
      <p className="sr-only">
        {selected ? format(selected, 'PPP', { locale: dateLocale(i18n.language) }) : ''}
      </p>
    </Popover>
  );
}
