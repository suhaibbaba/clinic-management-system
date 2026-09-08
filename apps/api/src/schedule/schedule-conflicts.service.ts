import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_RELEASED_STATUSES,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
  NOTIFICATION_TEMPLATE,
  SCHEDULE_CONFLICT_ERROR,
  type ConflictingAppointment,
  type ScheduleConflictOptions,
} from '@clinic/shared';
import { and, asc, eq, lt, notInArray, sql } from 'drizzle-orm';

import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { appointments, clinics, patients } from '@api/database/schema';
import { NotificationsService } from '@api/notifications/notifications.service';

/**
 * Shutting the door on appointments that are already in the diary.
 *
 * A closure or a period of time off is written by somebody looking at a
 * calendar they are not currently reading — "we're shut for Eid" is typed in
 * settings, and the three people booked that Tuesday are not on that screen.
 * Writing it silently would leave three patients turning up to a locked door,
 * and refusing it outright would make a closure impossible to record at all.
 *
 * So: the first attempt **fails** with 409 and the list of who is affected, and
 * the caller comes back having decided. Two decisions, not one —
 *
 *  - `force` writes the closure anyway;
 *  - `cancelAppointments` also cancels those appointments and tells each
 *    patient, through the clinic's own `booking_cancelled` template.
 *
 * They are separate because a practice with three patients it knows by name
 * usually rings round and moves them by hand, and a cancellation that went out
 * automatically cannot be taken back.
 *
 * Every cancelled appointment's reason points at the row that cancelled it
 * (`closure:<id>` / `time_off:<id>`), so three weeks later the calendar can
 * still say which closure swept it away rather than "the clinic was closed".
 */
@Injectable()
export class ScheduleConflictsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * The appointments a window would strand.
   *
   * Every status that still occupies a slot, not only `confirmed`: a patient
   * who has already arrived and one whose booking is still `requested` are
   * both in the way, and the exclusion constraint counts them both. Cancelled
   * and missed ones released their slot long ago.
   *
   * `doctorId` narrows it to one doctor for a period of time off; a clinic
   * closure passes nothing and gets everybody.
   */
  async findConflicts(
    clinicId: string,
    window: { from: Date; to: Date },
    doctorId?: string,
  ): Promise<ConflictingAppointment[]> {
    const rows = await this.db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        durationMinutes: appointments.durationMinutes,
        doctorId: appointments.doctorId,
        patientName: patients.fullName,
        patientPhone: patients.phone,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(
        this.scope.where(
          appointments,
          clinicId,
          and(
            doctorId ? eq(appointments.doctorId, doctorId) : undefined,
            notInArray(appointments.status, [...APPOINTMENT_RELEASED_STATUSES]),
            // Half-open `[from, to)` against the appointment's own block, whose
            // end is `starts_at + duration` and is never a stored column.
            //
            // Written as one `sql` fragment rather than through `gt`: the left
            // side is an expression, so drizzle has no column to infer the
            // bound parameter's type from — hence the explicit ISO string and
            // the cast, without which the driver is handed a bare `Date` it
            // has no type for and the whole query fails at bind time.
            lt(appointments.startsAt, window.to),
            sql`${appointments.startsAt} + make_interval(mins => ${appointments.durationMinutes}) > ${window.from.toISOString()}::timestamptz`,
          ),
        ),
      )
      .orderBy(asc(appointments.startsAt));

    return rows.map((row) => ({
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      durationMinutes: row.durationMinutes,
      doctorId: row.doctorId,
      patientName: row.patientName,
      patientPhone: row.patientPhone,
    }));
  }

  /**
   * Refuses the write unless the caller has already seen the conflicts.
   *
   * The 409 body carries the list itself rather than a count, because the
   * dialog that follows names the patients — "there are 3 appointments in this
   * period" with no way to see which three is a question nobody can answer.
   */
  async assertClear(
    clinicId: string,
    window: { from: Date; to: Date },
    options: ScheduleConflictOptions,
    doctorId?: string,
  ): Promise<ConflictingAppointment[]> {
    const conflicts = await this.findConflicts(clinicId, window, doctorId);

    if (conflicts.length > 0 && !options.force) {
      throw new ConflictException({
        statusCode: 409,
        error: SCHEDULE_CONFLICT_ERROR,
        message: 'Appointments fall inside this period',
        appointments: conflicts,
      });
    }

    return conflicts;
  }

  /**
   * Cancels the listed appointments and tells each patient.
   *
   * The cancellation goes through a plain update rather than the appointments
   * service's state machine on purpose: this is not somebody moving one
   * appointment along its lifecycle, it is a closure ending all of them at
   * once, and `arrived → cancelled` is a legal transition anyway. What matters
   * is that the reason names the row responsible.
   *
   * A notification that fails does not fail the closure — `NotificationsService`
   * swallows gateway errors by design, and a clinic that cannot reach its SMS
   * provider still needs its holiday recorded.
   */
  async cancelAll(
    actor: AuthenticatedUser,
    conflicts: readonly ConflictingAppointment[],
    reason: string,
  ): Promise<number> {
    if (conflicts.length === 0) {
      return 0;
    }

    const [clinic] = await this.db
      .select({ nameAr: clinics.nameAr, nameEn: clinics.nameEn, settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, actor.clinicId))
      .limit(1);

    /* istanbul ignore next -- the caller's own clinic always exists. */
    const settings = clinicScheduleSettings(clinic?.settings);
    const zone = settings.timezone || DEFAULT_TIME_ZONE;

    for (const conflict of conflicts) {
      await this.db
        .update(appointments)
        .set({
          status: APPOINTMENT_STATUS.CANCELLED,
          cancelledReason: reason,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(this.scope.where(appointments, actor.clinicId, eq(appointments.id, conflict.id)));

      const startsAt = new Date(conflict.startsAt);

      await this.notifications.send({
        clinicId: actor.clinicId,
        to: conflict.patientPhone,
        template: NOTIFICATION_TEMPLATE.BOOKING_CANCELLED,
        appointmentId: conflict.id,
        vars: {
          // The patient's message is the clinic's Arabic name: a WhatsApp text
          // is not a screen with a language toggle on it.
          clinic: clinic?.nameAr ?? '',
          date: localDate(startsAt, zone),
          time: timeIn(zone, startsAt),
        },
      });
    }

    return conflicts.length;
  }
}

/** `14:30` in the clinic's own zone, Latin digits. */
function timeIn(timeZone: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}
