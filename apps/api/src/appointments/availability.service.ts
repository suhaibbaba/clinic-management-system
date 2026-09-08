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
import { appointments, clinicClosures, clinics, doctors, doctorTimeOff } from '@api/database/schema';
import { computeDaySlots, toTimeOfDay, type BusyInterval } from '@api/appointments/slots';

/** How far apart slot starts are offered when a clinic has not said otherwise. */
const DEFAULT_STEP_MINUTES = 15;

const MINUTES_PER_DAY = 24 * 60;

/**
 * What the pure slot module needs, once it has been loaded.
 *
 * Named so the loading and the arithmetic stay visibly separate: everything
 * below the load is `computeDaySlots`, which public booking will call with the
 * same shape from an anonymous endpoint.
 */
export interface DayAvailabilityContext {
  readonly timeZone: string;
  readonly clinicRanges: readonly TimeRange[];
  readonly doctorRanges: readonly TimeRange[];
  /** The dated closure covering this day, if one does. */
  readonly closure: ClinicClosure | null;
  /** The doctor's absences that touch this day, clipped to it. */
  readonly timeOff: readonly BusyInterval[];
  /** The first absence's reason, for the "why is this shut?" line. */
  readonly timeOffReason: string | null;
  readonly busy: readonly BusyInterval[];
  readonly durationMinutes: number;
}

const rangesFor = (schedule: WeeklySchedule, weekday: number): readonly TimeRange[] =>
  schedule.find((day) => day.weekday === weekday)?.ranges ?? [];

/**
 * Free slots for one doctor on one day.
 *
 * **This is the only place that decides whether a minute is bookable.** The
 * internal calendar, the booking form's slot picker and the anonymous public
 * booking page all arrive here, so a day the calendar shades is a day booking
 * refuses, without either of them holding a second copy of the rule.
 *
 * Four things are subtracted from the day, in this order, and the order is
 * what the answer's `closedReason` reports:
 *
 *  1. **Clinic closures** (`clinic_closures`) — a dated whole-day shutdown.
 *     It outranks everything, including a weekday the clinic normally opens.
 *  2. **Clinic working hours** for that weekday. No ranges means closed.
 *  3. **The doctor's weekly schedule**, intersected with the clinic's: a
 *     doctor who starts at 08:00 in a clinic that opens at 09:00 starts at
 *     09:00, and the front door settles it.
 *  4. **Doctor time off** (`doctor_time_off`), whole days and partial hours
 *     alike, plus the appointments already booked.
 *
 * The answer is never stored (CLAUDE.md architecture decision 6).
 *
 * Every method takes a **clinic id**, not a caller. Reading availability is
 * open to every role — reception books, a doctor checks their own day, a
 * technician looking at the calendar sees the same thing — and it is also what
 * the anonymous public booking page asks for, which has no caller at all.
 * Nothing here is medical or financial, so there is nothing for an identity to
 * gate; the clinic is the only scope that matters.
 */
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

  /**
   * Everything the pure computation needs, in one place.
   *
   * Exposed so the appointments service can reuse it to answer "is this exact
   * time bookable?" without a second copy of the loading logic, and so the
   * public booking module can call it from an anonymous endpoint.
   */
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

  /**
   * The closure covering one local date, if any.
   *
   * Both ends inclusive — a closure names the last day the clinic is shut, not
   * the day it reopens, because that is how a notice on the door reads and
   * getting it wrong by a day is the mistake nobody notices until someone
   * turns up.
   *
   * An annual closure matches on day and month whatever the year, which is why
   * the comparison is on `to_char(...)` rather than on the dates themselves.
   * Only single-year ranges may be annual (the service refuses the rest), so
   * there is no year-crossing case to reason about here.
   */
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

  /**
   * One doctor's absences overlapping a local day.
   *
   * The window is the day itself, and the rows come back unclipped: the caller
   * converts them to minutes from that day's midnight, which lands an absence
   * that started yesterday evening on a negative start and one running into
   * tomorrow past 1440. The slot arithmetic compares intervals, so both are
   * correct without a clamp — and clamping here would lose the fact that the
   * absence continues.
   */
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

  /**
   * The doctor's booked time on that day, in local minutes.
   *
   * Cancelled and missed appointments are excluded by exactly the list the
   * database's exclusion constraint excludes, so the slot a patient is offered
   * is the slot the insert will accept.
   *
   * The window is widened by a day on each side before converting to minutes,
   * because an appointment that starts the previous evening can still be
   * running at 00:30 — and because the range predicate has to be on the
   * indexed `starts_at` column to use `appointments_doctor_starts_idx`.
   */
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

  /** The clinic's own words for why a day is shut, when they exist. */
  private closedNote(
    reason: Availability['closedReason'],
    context: DayAvailabilityContext,
  ): string | null {
    if (reason === 'clinic_closure') {
      return context.closure?.reason ?? null;
    }

    return reason === 'doctor_time_off' ? context.timeOffReason : null;
  }

  /**
   * Where "already past" falls on that date, or undefined for a future one.
   *
   * A slot in the past is offered but not bookable, so reception can see that
   * the morning existed rather than staring at a day that looks closed.
   */
  private pastCutoff(isoDate: string, timeZone: string): number | undefined {
    const minutes = minutesFromLocalMidnight(new Date(), isoDate, timeZone);

    if (minutes <= 0) {
      // The whole day is still ahead.
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

/** Row → wire shape. Shared with the closures service, which is where it lives. */
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
