/**
 * Gregorian dates with Arabic labels (CLAUDE.md). `ar` alone would select the
 * Islamic calendar in some runtimes, so the Gregorian calendar is pinned
 * explicitly and Latin digits are kept for legibility in tables.
 */
const DATE_LOCALE = 'ar-SY-u-ca-gregory-nu-latn';

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
    new Date(iso).toLocaleString(DATE_LOCALE, {
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
    new Date(iso).toLocaleDateString(DATE_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
  );
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
