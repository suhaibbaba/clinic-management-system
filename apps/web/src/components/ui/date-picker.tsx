import { format, isValid, parse } from 'date-fns';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@web/components/ui/button';
import { Calendar, dateLocale } from '@web/components/ui/calendar';
import { Icon } from '@web/components/ui/icon';
import { openOnArrowDown, usePickerOpen } from '@web/components/ui/picker-open';
import { PopoverSheet } from '@web/components/ui/popover-sheet';
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
  /** ISO `yyyy-MM-dd`, or an empty string for no date. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly hasError?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * A date field: type it, or pick it from a calendar.
 *
 * It replaces `<input type="date">`, which looked foreign in every browser,
 * put its picker button on the wrong side in Arabic, could not be themed, and
 * showed `mm/dd/yyyy` to an Arabic-speaking clinic because the format follows
 * the *browser's* locale rather than the app's.
 *
 * Typing is not a fallback, it is the fast path: someone entering a date of
 * birth types it far quicker than they can page back through sixty years of
 * months. The text is only committed when it parses to a real date, so a
 * half-typed `12/0` leaves the value alone rather than clearing it, and
 * `31/02` is rejected rather than rolling into March.
 */
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
    <PopoverSheet
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
            // Clicking the field shows the calendar beside it — the obvious
            // thing to try, and what this looked broken without. It does not
            // take the focus with it, so the caret stays where it was put and
            // typing, which is the fast path for a date of birth, carries on
            // uninterrupted. Focus alone still opens nothing.
            {...picker.opens(false)}
            onKeyDown={openOnArrowDown(picker.show)}
            className={cn(
              // The value is Latin — `08/09/2026`, `14:30` — so the field is
              // `dir="ltr"` and keeps its digits and separators in order. Its
              // *alignment*, though, belongs to the page: aligned by the
              // element's own direction it sat on the left of an Arabic form
              // while every other field's value sat on the right, and a column
              // of fields with one of them wandering off is the thing people
              // report as "the date looks broken".
              'block h-11 w-full rounded-control border bg-surface lg:h-10',
              // Physical rather than logical, and deliberately so: the field
              // itself is `dir="ltr"`, so `ps`/`pe` on it would resolve
              // against *its* direction and reserve the icon's room on the
              // wrong side of an Arabic form. The `rtl:`/`ltr:` variants ask
              // the page instead, which is what the icon's `end-0` follows.
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
              // At the inline end, like the range picker's and like the
              // chevron on every select — and a full 44px wide, because it is
              // the only way into the calendar with a thumb.
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
    </PopoverSheet>
  );
}
