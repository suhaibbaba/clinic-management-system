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

// The first attempt fails with 409 and who is affected; the caller returns having decided. Two
// flags, because a practice rings three patients by hand and a cancellation cannot be undone.
@Injectable()
export class ScheduleConflictsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  // Every status that still occupies a slot, not only `confirmed` — the same set the exclusion
  // constraint counts.
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
            // One `sql` fragment, not `gt`: the left side is an expression, so drizzle cannot infer
            // the parameter type and the driver fails at bind time.
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

  /** The 409 body carries the list itself, not a count: the dialog that follows names the patients. */
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

  // A plain update rather than the state machine: one closure ends all of them at once, and the
  // reason names the row responsible. A failed notification does not fail the closure.
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

function timeIn(timeZone: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}
