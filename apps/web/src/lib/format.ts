import i18n from '@web/i18n';

import { clinicTimeZone } from '@web/lib/clinic-zone';

/**
 * Gregorian dates, in the reader's language (CLAUDE.md).
 *
 * Two things are pinned rather than left to the locale, in both languages: the
 * **Gregorian calendar**, because `ar` alone selects the Islamic one in some
 * runtimes and a clinic's appointment book is Gregorian; and **Latin digits**,
 * because a column of ٠٨/٠٥/٢٠٢٦ is unreadable next to file numbers and money,
 * which are Latin whatever the interface says.
 *
 * What does follow the language is everything else — the order of the parts,
 * and the month and weekday names anywhere they are spelled out.
 */
const dateLocale = (): string =>
  i18n.language.startsWith('en') ? 'en-GB-u-ca-gregory-nu-latn' : 'ar-SY-u-ca-gregory-nu-latn';

/**
 * The Arabic locale interleaves RIGHT-TO-LEFT MARKs between the parts of a
 * date: `08\u200f/05\u200f/2026`. Those marks survive into the DOM and reorder
 * the number even inside an LTR box, so `08/05/2026` renders as `082026/05/`.
 *
 * Since these dates are already pinned to the Gregorian calendar and Latin
 * digits, the marks buy nothing and are stripped. Rendering stays correct in
 * both directions, and the string is copy-pasteable.
 */
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

/**
 * A wall-clock time in the **clinic's** zone, as Latin digits on a 24-hour
 * clock.
 *
 * Not `toLocaleTimeString`: the Arabic locale renders "09:00 ص", and that
 * marker is Arabic text — dropped into the `<Ltr>` island every time in this
 * app lives in, the bidi algorithm reorders the whole string and the period
 * comes out shuffled. A 24-hour clock needs no marker, which is also how the
 * calendar, the time picker and the API all express a time.
 */
export function formatClinicTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: clinicTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** The clinic-zone date for an instant, `dd/MM/yyyy`. */
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

/**
 * A period between two instants, in the clinic's zone.
 *
 * A period inside one day is the day and its two times — "11/09/2026 09:30 -
 * 12:00" — because repeating the date is noise on the case this app has most
 * of. All Latin, all 24-hour, so the whole string sits inside one `<Ltr>`.
 */
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

/**
 * Money for display: the amount exactly as the API sent it, plus the clinic's
 * currency code.
 *
 * No `Intl.NumberFormat`: the value is a `numeric(10,2)` string and must never
 * pass through a float, and an Arabic locale would rewrite the digits and wrap
 * them in bidi marks. Render it inside `dir="ltr"` so a minus sign stays on the
 * left where it belongs.
 */
export function formatMoney(amount: string, currency?: string): string {
  return currency ? `${amount} ${currency}` : amount;
}

/**
 * Joins names for display — "أحمد، ليلى، سامر" or "Ahmad, Layla, Samer".
 *
 * The separator is punctuation, and Arabic's is not the Latin comma: writing
 * `join(', ')` in an Arabic sentence is the same class of mistake as writing
 * the words themselves in the wrong script, only quieter.
 */
export function formatList(items: readonly string[]): string {
  return items.join(i18n.language.startsWith('en') ? ', ' : '، ');
}
