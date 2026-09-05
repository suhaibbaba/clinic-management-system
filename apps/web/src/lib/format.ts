/**
 * Gregorian dates with Arabic labels (CLAUDE.md). `ar` alone would select the
 * Islamic calendar in some runtimes, so the Gregorian calendar is pinned
 * explicitly and Latin digits are kept for legibility in tables.
 */
const DATE_LOCALE = 'ar-SY-u-ca-gregory-nu-latn';

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DATE_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
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
