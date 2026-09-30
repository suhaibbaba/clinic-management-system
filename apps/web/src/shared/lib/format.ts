import { currencySymbol, formatWholeMoney } from "@clinic/shared";
import i18n from "@web/i18n";
import { clinicTimeZone } from "@web/shared/lib/clinic-zone";
import { minutesOf } from "@web/shared/lib/dates";

const dateLocale = (): string =>
  i18n.language.startsWith("en") ? "en-GB-u-ca-gregory-nu-latn" : "ar-SY-u-ca-gregory-nu-latn";

const stripBidiMarks = (value: string): string => value.replace(/[\u200e\u200f]/g, "");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const isolate = (value: string): string => `\u2066${value}\u2069`;

function partsOf(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-GB",
): Intl.DateTimeFormatPart[] {
  const dateOnly = DATE_ONLY.test(iso);

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: dateOnly ? "UTC" : clinicTimeZone(),
  }).formatToParts(new Date(dateOnly ? `${iso}T00:00:00Z` : iso));
}

export function dayMonthYear(iso: string): {
  readonly day: string;
  readonly month: string;
  readonly year: string;
} {
  const parts = partsOf(iso, { day: "numeric", month: "short", year: "numeric" }, "en-US");
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    stripBidiMarks(parts.find((part) => part.type === type)?.value ?? "");

  return { day: read("day"), month: read("month"), year: read("year") };
}

const dateText = (iso: string): string => {
  const { day, month, year } = dayMonthYear(iso);
  return `${day} ${month} ${year}`;
};

const timeText = (iso: string): string => formatMinute(minutesOf(iso));

export function formatMonth(month: string): string {
  const { month: name, year } = dayMonthYear(`${month}-01`);

  return isolate(`${name} ${year}`);
}

export function formatDate(iso: string): string {
  return isolate(dateText(iso));
}

export function formatTime(iso: string): string {
  return isolate(timeText(iso));
}

export function formatDateTime(iso: string): string {
  return isolate(`${dateText(iso)} · ${timeText(iso)}`);
}

export function formatPeriod(startsAt: string, endsAt: string): string {
  return dateText(startsAt) === dateText(endsAt)
    ? isolate(`${dateText(startsAt)} · ${timeText(startsAt)} – ${timeText(endsAt)}`)
    : isolate(
        `${dateText(startsAt)} · ${timeText(startsAt)} – ${dateText(endsAt)} · ${timeText(endsAt)}`,
      );
}

export function formatWeekday(iso: string): string {
  const weekday = partsOf(iso, { weekday: "long" }, dateLocale()).find(
    (part) => part.type === "weekday",
  );

  return stripBidiMarks(weekday?.value ?? "");
}

export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = Math.floor(minute % 60);
  const marker = i18n.t(hours < 12 ? "common.clock.am" : "common.clock.pm");

  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${marker}`;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

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

export function formatList(items: readonly string[]): string {
  return items.join(i18n.language.startsWith("en") ? ", " : "، ");
}

export function moneyText(amount: string, currency: string | undefined): string {
  return `\u2066${formatWholeMoney(amount)}\u00A0${currencySymbol(currency)}\u2069`;
}
