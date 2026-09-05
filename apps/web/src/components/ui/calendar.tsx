import { format } from 'date-fns';
import { ar, enGB, type Locale } from 'date-fns/locale';
import type { JSX } from 'react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { useTranslation } from 'react-i18next';

import { cn } from '@web/lib/cn';

/** The date-fns locale matching the UI language. */
export function dateLocale(language: string): Locale {
  return language.split('-')[0] === 'ar' ? ar : enGB;
}

/**
 * The month grid, styled with the app's own tokens.
 *
 * ── Latin digits, Arabic words ────────────────────────────────────────────
 *
 * The clinic writes Gregorian dates with Western digits — that is what a file
 * number, a phone number and a printed receipt all use here, and a calendar
 * that switched to ٠١٢ would be the only place in the app that did. Month and
 * weekday *names* are Arabic.
 *
 * The formatters are given explicitly rather than left to the library: the
 * default day formatter is a locale-aware number format, which is exactly the
 * thing that would quietly start rendering Arabic-Indic digits on a locale
 * data update. `String(getDate())` cannot.
 *
 * `CalendarProps` is `DayPickerProps` as-is rather than an `Omit` of it: the
 * props are a discriminated union on `mode`, and omitting keys collapses the
 * union, taking `selected` and `onSelect` with it. The four props this
 * component owns are spread *after* the caller's, which is what enforces them.
 */
export type CalendarProps = DayPickerProps;

export function Calendar(props: CalendarProps): JSX.Element {
  const { i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const isRtl = i18n.language.split('-')[0] === 'ar';

  return (
    <DayPicker
      showOutsideDays
      {...props}
      locale={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      formatters={{
        formatDay: (date: Date) => String(date.getDate()),
        formatWeekdayName: (date: Date) => format(date, 'EEEEEE', { locale }),
        formatCaption: (date: Date) => `${format(date, 'LLLL', { locale })} ${date.getFullYear()}`,
        formatYearDropdown: (date: Date) => String(date.getFullYear()),
      }}
      classNames={{
        root: 'text-value text-ink',
        months: 'relative',
        month: 'w-full',
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'text-value font-semibold text-ink',
        nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between',
        button_previous: cn(
          'inline-flex size-8 cursor-pointer items-center justify-center rounded-control',
          'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
          'disabled:cursor-not-allowed disabled:opacity-40',
        ),
        button_next: cn(
          'inline-flex size-8 cursor-pointer items-center justify-center rounded-control',
          'text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
          'disabled:cursor-not-allowed disabled:opacity-40',
        ),
        chevron: 'size-4 fill-current',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-10 pt-2 pb-1 text-label font-medium text-ink-subtle',
        week: 'flex w-full',
        day: 'p-0.5',
        day_button: cn(
          'inline-flex size-9 cursor-pointer items-center justify-center rounded-control',
          'text-value tabular-nums transition-colors duration-150',
          'hover:bg-inset',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
        ),
        selected:
          '[&_button]:bg-primary-600 [&_button]:text-ink-inverse [&_button]:hover:bg-primary-700',
        today: '[&_button]:font-semibold [&_button]:text-primary-700',
        outside: '[&_button]:text-ink-subtle',
        disabled:
          '[&_button]:cursor-not-allowed [&_button]:opacity-40 [&_button]:hover:bg-transparent',
        range_start: '[&_button]:bg-primary-600 [&_button]:text-ink-inverse',
        range_end: '[&_button]:bg-primary-600 [&_button]:text-ink-inverse',
        range_middle: 'bg-selected [&_button]:bg-transparent [&_button]:text-ink',
        hidden: 'invisible',
      }}
    />
  );
}
