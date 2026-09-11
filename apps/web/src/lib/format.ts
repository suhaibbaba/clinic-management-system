import i18n from '@web/i18n';

import { clinicTimeZone } from '@web/lib/clinic-zone';

// Two things are pinned in both languages: the Gregorian calendar, since `ar` selects the Islamic
// one in some runtimes, and Latin digits.
const dateLocale = (): string =>
  i18n.language.startsWith('en') ? 'en-GB-u-ca-gregory-nu-latn' : 'ar-SY-u-ca-gregory-nu-latn';

// The Arabic locale interleaves RTL marks between the parts of a date; they survive into the DOM
// and render `08/05/2026` as `082026/05/`.
const stripBidiMarks = (value: string): string => value.replace(/[\u200e\u200f]/g, '');

export function formatDateTime(iso: string): string {
  return stripBidiMarks(
    new Date(iso).toLocaleString(dateLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  );
}

export function formatDate(iso: string): string {
  return stripBidiMarks(
    new Date(iso).toLocaleDateString(dateLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
  );
}

// Not `toLocaleTimeString`: the Arabic locale renders "09:00 ص", and that Arabic marker reorders
// the whole string inside an `<Ltr>` island.
// The day named and the date in figures, kept apart: the figures are an `<Ltr>` island at the call
// site, and a single joined string would let bidi drag the slashes to the wrong end.
export function dayAndDate(iso: string): { readonly weekday: string; readonly date: string } {
  const at = new Date(iso);

  return {
    weekday: stripBidiMarks(at.toLocaleDateString(dateLocale(), { weekday: 'long' })),
    date: stripBidiMarks(
      at.toLocaleDateString(dateLocale(), { year: '2-digit', month: '2-digit', day: '2-digit' }),
    ),
  };
}

export function formatClinicTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: clinicTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function formatClinicDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: clinicTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${read('day')}/${read('month')}/${read('year')}`;
}

// A period inside one day is the date and its two times: repeating the date is noise on the case
// this app has most of.
export function formatClinicPeriod(startsAt: string, endsAt: string): string {
  const from = formatClinicDate(startsAt);
  const to = formatClinicDate(endsAt);
  const times = `${formatClinicTime(startsAt)} - ${formatClinicTime(endsAt)}`;

  return from === to
    ? `${from} ${times}`
    : `${from} ${formatClinicTime(startsAt)} - ${to} ${formatClinicTime(endsAt)}`;
}

/** `<input type="date">` value → an inclusive ISO instant for the API. */
export function startOfDayIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

/** `<input type="date">` value → an exclusive ISO upper bound for the API. */
export function endOfNextDayIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

// The separator is punctuation, and Arabic's is not the Latin comma — `join(', ')` in an Arabic
// sentence is the same mistake as the wrong script, only quieter.
export function formatList(items: readonly string[]): string {
  return items.join(i18n.language.startsWith('en') ? ', ' : '، ');
}
