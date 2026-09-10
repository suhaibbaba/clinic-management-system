import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  APPOINTMENT_RELEASED_STATUSES,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  localWeekday,
  minutesFromLocalMidnight,
  type Availability,
  type AvailabilityQuery,
  type ClinicClosure,
  type DoctorTimeOff,
  type Slot,
  type TimeRange,
  type WeeklySchedule,
} from '@clinic/shared';
import { and, eq, gt, gte, lt, lte, ne, notInArray, or, sql } from 'drizzle-orm';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DATABASE, type Database } from '@api/database/database.module';
import {
  appointments,
  clinicClosures,
  clinics,
  doctors,
  doctorTimeOff,
} from '@api/database/schema';
import { computeDaySlots, toTimeOfDay, type BusyInterval } from '@api/appointments/slots';

const DEFAULT_STEP_MINUTES = 15;

const MINUTES_PER_DAY = 24 * 60;

export interface DayAvailabilityContext {
  readonly timeZone: string;
  readonly clinicRanges: readonly TimeRange[];
  readonly doctorRanges: readonly TimeRange[];
  readonly closure: ClinicClosure | null;
  /** The doctor's absences that touch this day, clipped to it. */
  readonly timeOff: readonly BusyInterval[];
  readonly timeOffReason: string | null;
  readonly busy: readonly BusyInterval[];
  readonly durationMinutes: number;
}

const rangesFor = (schedule: WeeklySchedule, weekday: number): readonly TimeRange[] =>
  schedule.find((day) => day.weekday === weekday)?.ranges ?? [];

// The only place that decides whether a minute is bookable. Subtracted in the order `closedReason`
// reports: closures, clinic hours, the doctor's schedule, then time off and bookings.
@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  async forDay(clinicId: string, query: AvailabilityQuery): Promise<Availability> {
    const context = await this.loadContext(clinicId, query);

    const computation = computeDaySlots({
      clinicRanges: context.clinicRanges,
      doctorRanges: context.doctorRanges,
      isClosed: context.closure !== null,
      timeOff: context.timeOff,
      busy: context.busy,
      durationMinutes: context.durationMinutes,
      stepMinutes: DEFAULT_STEP_MINUTES,
      // Today's mornings are gone; a future date has no floor at all.
      notBeforeMinute: this.pastCutoff(query.date, context.timeZone),
    });

    const slots: Slot[] = computation.slots.map((slot) => ({
      start: toTimeOfDay(slot.startMinute),
      end: toTimeOfDay(slot.endMinute),
      startsAt: instantFromLocal(query.date, slot.startMinute, context.timeZone).toISOString(),
      available: slot.available,
    }));

    return {
      doctorId: query.doctorId,
      date: query.date,
      durationMinutes: context.durationMinutes,
      closedReason: computation.closedReason,
      closedNote: this.closedNote(computation.closedReason, context),
      slots,
    };
  }

  async loadContext(clinicId: string, query: AvailabilityQuery): Promise<DayAvailabilityContext> {
    const [doctor] = await this.db
      .select({
        weeklySchedule: doctors.weeklySchedule,
        defaultDuration: doctors.defaultAppointmentDurationMinutes,
      })
      .from(doctors)
      .where(this.scope.where(doctors, clinicId, eq(doctors.id, query.doctorId)))
      .limit(1);

    if (!doctor) {
      throw new BadRequestException('Doctor not found in this clinic');
    }

    const [clinic] = await this.db
      .select({ workingHours: clinics.workingHours, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    /* istanbul ignore next -- the caller's clinic always exists. */
    if (!clinic) {
      throw new BadRequestException('Clinic not found');
    }

    const settings = clinicScheduleSettings(clinic.settings);
    const timeZone = settings.timezone || DEFAULT_TIME_ZONE;
    const weekday = localWeekday(query.date, timeZone);

    const [closure, absences] = await Promise.all([
      this.closureOn(clinicId, query.date),
      this.timeOffOn(clinicId, query.doctorId, query.date, timeZone),
    ]);

    return {
      timeZone,
      clinicRanges: rangesFor(clinic.workingHours, weekday),
      doctorRanges: rangesFor(doctor.weeklySchedule, weekday),
      closure,
      timeOff: absences.map((row) => ({
        startMinute: minutesFromLocalMidnight(row.startsAt, query.date, timeZone),
        endMinute: minutesFromLocalMidnight(row.endsAt, query.date, timeZone),
      })),
      timeOffReason: absences[0]?.reason ?? null,
      busy: await this.busyIntervals(clinicId, query, timeZone),
      durationMinutes: query.durationMinutes ?? doctor.defaultDuration,
    };
  }

  // Both ends inclusive — a closure names the last day shut, not the day it reopens. An annual one
  // matches day and month, hence `to_char`; only single-year ranges may be annual.
  async closureOn(clinicId: string, isoDate: string): Promise<ClinicClosure | null> {
    const dayMonth = isoDate.slice(5);

    const [row] = await this.db
      .select()
      .from(clinicClosures)
      .where(
        this.scope.where(
          clinicClosures,
          clinicId,
          or(
            and(lte(clinicClosures.startsOn, isoDate), gte(clinicClosures.endsOn, isoDate)),
            and(
              eq(clinicClosures.isAnnual, true),
              lte(sql`to_char(${clinicClosures.startsOn}, 'MM-DD')`, dayMonth),
              gte(sql`to_char(${clinicClosures.endsOn}, 'MM-DD')`, dayMonth),
            ),
          ),
        ),
      )
      .limit(1);

    return row ? toClinicClosure(row) : null;
  }

  // Unclipped: an absence from yesterday evening lands on negative minutes, one running into
  // tomorrow past 1440, and the interval arithmetic wants that.
  async timeOffOn(
    clinicId: string,
    doctorId: string,
    isoDate: string,
    timeZone: string,
  ): Promise<(typeof doctorTimeOff.$inferSelect)[]> {
    const dayStart = instantFromLocal(isoDate, 0, timeZone);
    const dayEnd = instantFromLocal(addDays(isoDate, 1), 0, timeZone);

    return this.db
      .select()
      .from(doctorTimeOff)
      .where(
        this.scope.where(
          doctorTimeOff,
          clinicId,
          and(
            eq(doctorTimeOff.doctorId, doctorId),
            // Half-open overlap, the same `[)` the appointments use.
            lt(doctorTimeOff.startsAt, dayEnd),
            gt(doctorTimeOff.endsAt, dayStart),
          ),
        ),
      )
      .orderBy(doctorTimeOff.startsAt);
  }

  // Excludes exactly the statuses the exclusion constraint does, so an offered slot is one the
  // insert accepts. Widened a day each side to keep the predicate on the indexed `starts_at`.
  private async busyIntervals(
    clinicId: string,
    query: AvailabilityQuery,
    timeZone: string,
  ): Promise<BusyInterval[]> {
    const windowStart = instantFromLocal(addDays(query.date, -1), 0, timeZone);
    const windowEnd = instantFromLocal(addDays(query.date, 2), 0, timeZone);

    const rows = await this.db
      .select({ startsAt: appointments.startsAt, duration: appointments.durationMinutes })
      .from(appointments)
      .where(
        this.scope.where(
          appointments,
          clinicId,
          and(
            eq(appointments.doctorId, query.doctorId),
            gte(appointments.startsAt, windowStart),
            lt(appointments.startsAt, windowEnd),
            notInArray(appointments.status, [...APPOINTMENT_RELEASED_STATUSES]),
            // Rescheduling must not collide with the appointment being moved.
            query.excludeAppointmentId
              ? ne(appointments.id, query.excludeAppointmentId)
              : undefined,
          ),
        ),
      );

    return rows.map((row) => {
      const startMinute = minutesFromLocalMidnight(row.startsAt, query.date, timeZone);

      return { startMinute, endMinute: startMinute + row.duration };
    });
  }

  private closedNote(
    reason: Availability['closedReason'],
    context: DayAvailabilityContext,
  ): string | null {
    if (reason === 'clinic_closure') {
      return context.closure?.reason ?? null;
    }

    return reason === 'doctor_time_off' ? context.timeOffReason : null;
  }

  // A past slot is shown but not bookable, so reception sees that the morning existed rather than a
  // day that looks closed.
  private pastCutoff(isoDate: string, timeZone: string): number | undefined {
    const minutes = minutesFromLocalMidnight(new Date(), isoDate, timeZone);

    if (minutes <= 0) {
      return undefined;
    }

    if (minutes >= MINUTES_PER_DAY) {
      // The day is over. Every slot is shown and none is bookable, which is
      // the honest rendering of yesterday.
      return Number.POSITIVE_INFINITY;
    }

    return minutes;
  }
}

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
