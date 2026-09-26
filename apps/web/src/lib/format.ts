import { currencySymbol, formatWholeMoney } from "@clinic/shared";
import { to12Hour } from "@clinic/ui";
import i18n from "@web/i18n";
import { clinicTimeZone } from "@web/lib/clinic-zone";

// Two things are pinned in both languages: the Gregorian calendar, since `ar` selects the Islamic
// one in some runtimes, and Latin digits.
const dateLocale = (): string =>
  i18n.language.startsWith("en") ? "en-GB-u-ca-gregory-nu-latn" : "ar-SY-u-ca-gregory-nu-latn";

// The Arabic locale interleaves RTL marks between the parts of a date; they survive into the DOM
const stripBidiMarks = (value: string): string => value.replace(/[\u200e\u200f]/g, "");

export function formatDateTime(iso: string): string {
  return stripBidiMarks(
    new Date(iso).toLocaleString(dateLocale(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
}

export function formatDate(iso: string): string {
  return stripBidiMarks(
    new Date(iso).toLocaleDateString(dateLocale(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
  );
}

export function dayAndDate(iso: string): { readonly weekday: string; readonly date: string } {
  const at = new Date(iso);

  return {
    weekday: stripBidiMarks(at.toLocaleDateString(dateLocale(), { weekday: "long" })),
    date: stripBidiMarks(
      at.toLocaleDateString(dateLocale(), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    ),
  };
}

// English in both languages: the region's Arabics name the months differently.
/** A date block's parts in the clinic's zone: the day number, the month's short name, the year. */
export function dayMonthYear(iso: string): {
  readonly day: string;
  readonly month: string;
  readonly year: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: clinicTimeZone(),
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    stripBidiMarks(parts.find((part) => part.type === type)?.value ?? "");

  return { day: read("day"), month: read("month"), year: read("year") };
}

/** `16 May 2026`, isolated: inside an Arabic sentence "1 Sep" would otherwise read "Sep 1". */
export function shortDate(iso: string): string {
  const { day, month, year } = dayMonthYear(iso);
  return `\u2066${day} ${month} ${year}\u2069`;
}

export function formatClinicTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: clinicTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** `26 Sep 2026 · 9:30 AM` in the clinic's zone: AM/PM in Latin in either language. */
export function visitMoment(iso: string): string {
  return `${shortDate(iso)} · ${to12Hour(formatClinicTime(iso))}`;
}

export function formatClinicDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: clinicTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${read("day")}/${read("month")}/${read("year")}`;
}

export function formatClinicPeriod(startsAt: string, endsAt: string): string {
  const from = formatClinicDate(startsAt);
  const to = formatClinicDate(endsAt);
  const times = `${formatClinicTime(startsAt)} - ${formatClinicTime(endsAt)}`;

  return from === to
    ? `${from} ${times}`
    : `${from} ${formatClinicTime(startsAt)} - ${to} ${formatClinicTime(endsAt)}`;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

// Relative, because what a conversation is worth is "this morning" rather than a timestamp. Past a
// week it becomes a date: "٣٤ يوم" is a distance nobody can place on a calendar.
export function formatRelativeTime(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const days = Math.floor(elapsed / DAY);

  if (days >= 7) {
    return formatDate(iso);
  }

  const relative = new Intl.RelativeTimeFormat(dateLocale(), { numeric: "auto" });

  if (days >= 1) {
    return stripBidiMarks(relative.format(-days, "day"));
  }

  const hours = Math.floor(elapsed / HOUR);

  if (hours >= 1) {
    return stripBidiMarks(relative.format(-hours, "hour"));
  }

  return stripBidiMarks(relative.format(-Math.max(0, Math.floor(elapsed / MINUTE)), "minute"));
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
  return items.join(i18n.language.startsWith("en") ? ", " : "، ");
}

export function moneyText(amount: string, currency: string | undefined): string {
  return `\u2066${formatWholeMoney(amount)}\u00A0${currencySymbol(currency)}\u2069`;
}
