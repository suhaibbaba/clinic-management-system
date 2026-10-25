import type { DaySchedule, PersonName, SiteLanguage, SiteText } from "@clinic/shared";
import { clockTime } from "@shared/time/zone";

export const pick = (text: SiteText, language: SiteLanguage): string =>
  (language === "en" ? text.en : text.ar) || text.ar;

export const orDefault = (text: SiteText, language: SiteLanguage, fallback: string): string =>
  pick(text, language) || fallback;

export const nameIn = (name: PersonName, language: SiteLanguage): string =>
  (language === "en" ? name.en : name.ar) || name.ar;

export const isSiteLanguage = (value: string | null): value is SiteLanguage =>
  value === "ar" || value === "en";

export interface HoursRow {
  readonly days: readonly number[];
  readonly ranges: DaySchedule["ranges"];
}

const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

const sameRanges = (a: DaySchedule["ranges"], b: DaySchedule["ranges"]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function groupHours(schedule: readonly DaySchedule[]): HoursRow[] {
  const rows: { days: number[]; ranges: DaySchedule["ranges"] }[] = [];

  for (const weekday of WEEK_ORDER) {
    const ranges = schedule.find((day) => day.weekday === weekday)?.ranges ?? [];
    const last = rows.at(-1);

    if (last && sameRanges(last.ranges, ranges)) {
      last.days.push(weekday);
    } else {
      rows.push({ days: [weekday], ranges });
    }
  }

  return rows;
}

const SUNDAY = Date.UTC(2024, 0, 7);

export function weekdayName(weekday: number, language: SiteLanguage): string {
  return new Intl.DateTimeFormat(language, { weekday: "long", timeZone: "UTC" }).format(
    new Date(SUNDAY + weekday * 86_400_000),
  );
}

export function timeLabel(time: string): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);

  return clockTime(hours * 60 + minutes);
}

export interface HoursSummary {
  readonly from: number;
  readonly to: number;
  readonly opens: string;
  readonly closes: string;
}

export function hoursSummary(schedule: readonly DaySchedule[]): HoursSummary | null {
  const open = WEEK_ORDER.filter((weekday) =>
    schedule.some((day) => day.weekday === weekday && day.ranges.length > 0),
  );
  const ranges = schedule.flatMap((day) => day.ranges);
  const first = open[0];
  const last = open.at(-1);

  if (first === undefined || last === undefined || ranges.length === 0) {
    return null;
  }

  return {
    from: first,
    to: last,
    opens: ranges.map((range) => range.start).sort()[0] ?? "",
    closes:
      ranges
        .map((range) => range.end)
        .sort()
        .at(-1) ?? "",
  };
}

export const mapsLink = (latitude: number, longitude: number): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

export const mapsSearchLink = (query: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const mapEmbed = (
  pin: { readonly lat: number; readonly lng: number } | null,
  address: string | null,
  span: number,
): string | null => {
  if (pin) {
    const box = [pin.lng - span, pin.lat - span, pin.lng + span, pin.lat + span].join("%2C");

    return `https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik&marker=${pin.lat}%2C${pin.lng}`;
  }

  return address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`
    : null;
};

export function titleLines(title: string): readonly [string, string] {
  const [lead = "", ...rest] = title.split(/\r?\n/).map((line) => line.trim());

  return [lead, rest.filter(Boolean).join(" ")];
}
