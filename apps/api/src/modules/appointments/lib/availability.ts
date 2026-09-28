import { type TimeRange, type ClinicClosure, type WeeklySchedule } from "@clinic/shared";
import { type BusyInterval } from "@api/modules/appointments/lib/slots";

export interface DayAvailabilityContext {
  readonly timeZone: string;
  readonly clinicRanges: readonly TimeRange[];
  readonly doctorRanges: readonly TimeRange[];
  readonly closure: ClinicClosure | null;
  readonly timeOff: readonly BusyInterval[];
  readonly timeOffReason: string | null;
  readonly busy: readonly BusyInterval[];
  readonly durationMinutes: number;
}

export const rangesFor = (schedule: WeeklySchedule, weekday: number): readonly TimeRange[] =>
  schedule.find((day) => day.weekday === weekday)?.ranges ?? [];

export function mergeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  const merged: TimeRange[] = [];

  for (const range of sorted) {
    const last = merged.at(-1);

    if (last && range.start <= last.end) {
      merged[merged.length - 1] = {
        start: last.start,
        end: range.end > last.end ? range.end : last.end,
      };
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}
