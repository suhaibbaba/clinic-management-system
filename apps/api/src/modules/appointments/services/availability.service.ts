import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  addDays,
  APPOINTMENT_RELEASED_STATUSES,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  localWeekday,
  minutesFromLocalMidnight,
  USER_ROLE,
  type Availability,
  type AvailabilityQuery,
  type ClinicClosure,
  type Slot,
  type TimeRange,
} from "@clinic/shared";
import { and, eq, gt, gte, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  appointments,
  clinicClosures,
  clinics,
  doctorExtraHours,
  doctors,
  doctorTimeOff,
  users,
} from "@api/database/schema";
import {
  computeDaySlots,
  toTimeOfDay,
  type BusyInterval,
} from "@api/modules/appointments/lib/slots";
import { DEFAULT_STEP_MINUTES, MINUTES_PER_DAY } from "@api/modules/appointments/constants";
import {
  DayAvailabilityContext,
  rangesFor,
  mergeRanges,
} from "@api/modules/appointments/lib/availability";
import { toClinicClosure } from "@api/common/lib/schedule-rows";

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
        role: users.role,
      })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId))
      .where(this.scope.where(doctors, clinicId, eq(doctors.id, query.doctorId)))
      .limit(1);

    if (!doctor) {
      throw new BadRequestException("Doctor not found in this clinic");
    }

    const [clinic] = await this.db
      .select({ workingHours: clinics.workingHours, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    if (!clinic) {
      throw new BadRequestException("Clinic not found");
    }

    const settings = clinicScheduleSettings(clinic.settings);
    const timeZone = settings.timezone || DEFAULT_TIME_ZONE;
    const weekday = localWeekday(query.date, timeZone);

    const [closure, absences, extra] = await Promise.all([
      this.closureOn(clinicId, query.date),
      this.timeOffOn(clinicId, query.doctorId, query.date, timeZone),
      this.extraHoursOn(clinicId, query.doctorId, query.date),
    ]);

    const clinicRanges = rangesFor(clinic.workingHours, weekday);
    const onCall = doctor.role === USER_ROLE.VISITING_DOCTOR && doctor.weeklySchedule.length === 0;

    return {
      timeZone,
      clinicRanges: mergeRanges([...clinicRanges, ...extra]),
      doctorRanges: mergeRanges([
        ...(onCall ? clinicRanges : rangesFor(doctor.weeklySchedule, weekday)),
        ...extra,
      ]),
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

  async extraHoursOn(clinicId: string, doctorId: string, isoDate: string): Promise<TimeRange[]> {
    const rows = await this.db
      .select({ ranges: doctorExtraHours.ranges })
      .from(doctorExtraHours)
      .where(
        this.scope.where(
          doctorExtraHours,
          clinicId,
          and(eq(doctorExtraHours.doctorId, doctorId), eq(doctorExtraHours.date, isoDate)),
        ),
      );

    return rows.flatMap((row) => row.ranges);
  }

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
            lt(doctorTimeOff.startsAt, dayEnd),
            gt(doctorTimeOff.endsAt, dayStart),
          ),
        ),
      )
      .orderBy(doctorTimeOff.startsAt);
  }

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
    reason: Availability["closedReason"],
    context: DayAvailabilityContext,
  ): string | null {
    if (reason === "clinic_closure") {
      return context.closure?.reason ?? null;
    }

    return reason === "doctor_time_off" ? context.timeOffReason : null;
  }

  private pastCutoff(isoDate: string, timeZone: string): number | undefined {
    const minutes = minutesFromLocalMidnight(new Date(), isoDate, timeZone);

    if (minutes <= 0) {
      return undefined;
    }

    if (minutes >= MINUTES_PER_DAY) {
      return Number.POSITIVE_INFINITY;
    }

    return minutes;
  }
}
