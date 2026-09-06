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
  type Slot,
  type TimeRange,
  type WeeklySchedule,
} from '@clinic/shared';
import { and, eq, gte, lt, ne, notInArray } from 'drizzle-orm';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { appointments, clinics, doctors } from '@api/database/schema';
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
  readonly isHoliday: boolean;
  readonly busy: readonly BusyInterval[];
  readonly durationMinutes: number;
}

const rangesFor = (schedule: WeeklySchedule, weekday: number): readonly TimeRange[] =>
  schedule.find((day) => day.weekday === weekday)?.ranges ?? [];

/**
 * Free slots for one doctor on one day.
 *
 * The answer is computed from the doctor's weekly schedule, the clinic's
 * opening hours and its holidays, minus the appointments already booked — and
 * is never stored (CLAUDE.md architecture decision 6).
 *
 * Reading is open to every role: reception books, a doctor checks their own
 * day, and a technician looking at the calendar sees the same thing. Nothing
 * here is medical or financial.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
  ) {}

  async forDay(actor: AuthenticatedUser, query: AvailabilityQuery): Promise<Availability> {
    const context = await this.loadContext(actor, query);

    const computation = computeDaySlots({
      clinicRanges: context.clinicRanges,
      doctorRanges: context.doctorRanges,
      isHoliday: context.isHoliday,
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
      slots,
    };
  }

  /**
   * Everything the pure computation needs, in one place.
   *
   * Exposed so the appointments service can reuse it to answer "is this exact
   * time bookable?" without a second copy of the loading logic — and so public
   * booking can later call it with a clinic id instead of an actor.
   */
  async loadContext(
    actor: AuthenticatedUser,
    query: AvailabilityQuery,
  ): Promise<DayAvailabilityContext> {
    const [doctor] = await this.db
      .select({
        weeklySchedule: doctors.weeklySchedule,
        defaultDuration: doctors.defaultAppointmentDurationMinutes,
      })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, query.doctorId)))
      .limit(1);

    if (!doctor) {
      throw new BadRequestException('Doctor not found in this clinic');
    }

    const [clinic] = await this.db
      .select({ workingHours: clinics.workingHours, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, actor.clinicId))
      .limit(1);

    /* istanbul ignore next -- the caller's clinic always exists. */
    if (!clinic) {
      throw new BadRequestException('Clinic not found');
    }

    const settings = clinicScheduleSettings(clinic.settings);
    const timeZone = settings.timezone || DEFAULT_TIME_ZONE;
    const weekday = localWeekday(query.date, timeZone);

    return {
      timeZone,
      clinicRanges: rangesFor(clinic.workingHours, weekday),
      doctorRanges: rangesFor(doctor.weeklySchedule, weekday),
      isHoliday: settings.holidays.includes(query.date),
      busy: await this.busyIntervals(actor, query, timeZone),
      durationMinutes: query.durationMinutes ?? doctor.defaultDuration,
    };
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
    actor: AuthenticatedUser,
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
          actor.clinicId,
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
