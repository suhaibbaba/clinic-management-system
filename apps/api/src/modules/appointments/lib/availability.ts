import {
  type TimeRange,
  type ClinicClosure,
  type WeeklySchedule,
  type DoctorTimeOff,
} from "@clinic/shared";
import { type BusyInterval } from "@api/modules/appointments/lib/slots";
import { clinicClosures, doctorTimeOff } from "@api/database/schema";

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

export function toClinicClosure(row: typeof clinicClosures.$inferSelect): ClinicClosure {
  return {
    id: row.id,
    clinicId: row.clinicId,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    reason: row.reason,
    isAnnual: row.isAnnual,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDoctorTimeOff(row: typeof doctorTimeOff.$inferSelect): DoctorTimeOff {
  return {
    id: row.id,
    clinicId: row.clinicId,
    doctorId: row.doctorId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

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
