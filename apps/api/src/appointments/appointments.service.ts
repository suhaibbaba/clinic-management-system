import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from '@nestjs/common';
import {
  addDays,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  canTransitionAppointment,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  occupiesSlot,
  type Appointment,
  type AppointmentStatus,
  type CalendarAppointment,
  type CalendarFeed,
  type CalendarQuery,
  type CreateAppointmentInput,
  type ListAppointmentsQuery,
  type Paginated,
  type UpdateAppointmentInput,
  type Visit,
} from '@clinic/shared';
import { and, asc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { AppointmentAccessService } from '@api/appointments/appointment-access.service';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { appointments, clinics, doctors, patients, users, visits } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';
import { toVisit } from '@api/patients/visits.service';

type AppointmentRow = typeof appointments.$inferSelect;

export const APPOINTMENTS_ENTITY = 'appointments';

/** Postgres raises this when an `EXCLUDE` constraint rejects a row. */
const EXCLUSION_VIOLATION = '23P01';

/**
 * Whether an error is the overlap constraint rejecting a row.
 *
 * Walked down the `cause` chain rather than read off the top: drizzle wraps
 * the driver's error in a `DrizzleQueryError`, so the SQLSTATE that decides
 * this is one or two levels below the error the service catches. Reading only
 * the top level made every double booking a 500 — the constraint was doing its
 * job and the API was reporting it as a bug in itself.
 */
function isOverlapConflict(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      (current as { code?: unknown }).code === EXCLUSION_VIOLATION
    ) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * The internal calendar.
 *
 * Two things about this service are worth reading before changing it.
 *
 * **Double booking is prevented by the database, not here.** There is no
 * "is the slot free?" query before an insert, because between such a query and
 * the insert another request can take the slot — the classic check-then-act
 * race, and one that a busy front desk with two people booking is very likely
 * to hit. The `appointments_no_overlap` exclusion constraint is what actually
 * holds; this service's job is to turn its 23P01 into a 409 with a message
 * reception can act on.
 *
 * **Status moves only through `changeStatus`.** `update` deliberately cannot
 * set a status, so the state machine in `@clinic/shared` has exactly one door
 * to guard rather than two.
 */
@Injectable()
export class AppointmentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly access: AppointmentAccessService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(APPOINTMENTS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(appointments)
        .where(this.scope.where(appointments, clinicId, eq(appointments.id, id)))
        .limit(1);

      return row ? { ...toAppointment(row) } : null;
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Reads                                                                   */
  /* ---------------------------------------------------------------------- */

  async list(
    actor: AuthenticatedUser,
    query: ListAppointmentsQuery,
  ): Promise<Paginated<CalendarAppointment>> {
    const filters: (SQL | undefined)[] = [];

    if (query.patientId) {
      await this.patientAccess.requirePatientId(actor, query.patientId);
      filters.push(eq(appointments.patientId, query.patientId));
    }
    if (query.doctorId) {
      filters.push(eq(appointments.doctorId, query.doctorId));
    }
    if (query.status) {
      filters.push(eq(appointments.status, query.status));
    }

    const timeZone = await this.timeZone(actor.clinicId);

    if (query.from) {
      filters.push(gte(appointments.startsAt, instantFromLocal(query.from, 0, timeZone)));
    }
    if (query.to) {
      // Inclusive day: everything before midnight at the end of `to`.
      filters.push(lt(appointments.startsAt, instantFromLocal(addDays(query.to, 1), 0, timeZone)));
    }

    const where = this.scope.where(appointments, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.calendarSelect()
        .where(where)
        .orderBy(asc(appointments.startsAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(appointments)
        .where(where),
    ]);

    return toPaginated(rows.map(toCalendarAppointment), totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<CalendarAppointment> {
    // Scoped first, so an id from another clinic is a 404 before anything else.
    await this.scope.findOneOrFail<AppointmentRow>(appointments, actor.clinicId, id);

    const [row] = await this.calendarSelect()
      .where(this.scope.where(appointments, actor.clinicId, eq(appointments.id, id)))
      .limit(1);

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new BadRequestException('Appointment not found');
    }

    return toCalendarAppointment(row);
  }

  /**
   * A day or a week of the calendar, in one range query.
   *
   * Not paginated: a calendar draws every block in view or it is lying, and a
   * week of one clinic is a few hundred rows at most. The range predicate is
   * on `starts_at`, which is the leading time column of
   * `appointments_doctor_starts_idx`.
   */
  async calendar(actor: AuthenticatedUser, query: CalendarQuery): Promise<CalendarFeed> {
    const timeZone = await this.timeZone(actor.clinicId);
    const from = query.range === 'week' ? startOfWeek(query.date) : query.date;
    const to = addDays(from, query.range === 'week' ? 7 : 1);

    const rows = await this.calendarSelect()
      .where(
        this.scope.where(
          appointments,
          actor.clinicId,
          and(
            gte(appointments.startsAt, instantFromLocal(from, 0, timeZone)),
            lt(appointments.startsAt, instantFromLocal(to, 0, timeZone)),
            query.doctorId ? eq(appointments.doctorId, query.doctorId) : undefined,
          ),
        ),
      )
      .orderBy(asc(appointments.startsAt));

    return { from, to, appointments: rows.map(toCalendarAppointment) };
  }

  /* ---------------------------------------------------------------------- */
  /* Writes                                                                  */
  /* ---------------------------------------------------------------------- */

  async create(
    actor: AuthenticatedUser,
    input: CreateAppointmentInput,
  ): Promise<CalendarAppointment> {
    await this.patientAccess.requirePatientId(actor, input.patientId);
    await this.access.requireOwnCalendar(actor, input.doctorId);

    const duration = input.durationMinutes ?? (await this.defaultDuration(actor, input.doctorId));

    const row = await this.insert(() =>
      this.db
        .insert(appointments)
        .values({
          clinicId: actor.clinicId,
          patientId: input.patientId,
          doctorId: input.doctorId,
          startsAt: new Date(input.startsAt),
          durationMinutes: duration,
          type: input.type ?? APPOINTMENT_TYPE.CHECKUP,
          // Reception booking *is* the confirmation; `requested` exists for
          // public booking, which has to be confirmed by a person or an OTP.
          status: input.status ?? APPOINTMENT_STATUS.CONFIRMED,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning(),
    );

    return this.findOne(actor, row.id);
  }

  /** Rescheduling and editing. Status is not settable here — see `changeStatus`. */
  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<CalendarAppointment> {
    const existing = await this.scope.findOneOrFail<AppointmentRow>(
      appointments,
      actor.clinicId,
      id,
    );

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    if (input.doctorId) {
      await this.access.requireOwnCalendar(actor, input.doctorId);
    }

    // Moving a finished appointment rewrites history rather than the diary.
    if (!occupiesSlot(existing.status) || existing.status === APPOINTMENT_STATUS.COMPLETED) {
      throw new BadRequestException('This appointment is closed and can no longer be moved');
    }

    await this.insert(() =>
      this.db
        .update(appointments)
        .set({
          ...(input.doctorId !== undefined && { doctorId: input.doctorId }),
          ...(input.startsAt !== undefined && { startsAt: new Date(input.startsAt) }),
          ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.reason !== undefined && { reason: input.reason ?? null }),
          ...(input.notes !== undefined && { notes: input.notes ?? null }),
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(this.scope.where(appointments, actor.clinicId, eq(appointments.id, id)))
        .returning(),
    );

    return this.findOne(actor, id);
  }

  /**
   * The one door into the state machine.
   *
   * Transitions come from `APPOINTMENT_STATUS_TRANSITIONS` in `@clinic/shared`
   * and nowhere else, so the rules are one table rather than seven endpoints
   * that each remember part of them (CLAUDE.md architecture decision 7).
   */
  async changeStatus(
    actor: AuthenticatedUser,
    id: string,
    next: AppointmentStatus,
    cancelledReason?: string,
  ): Promise<CalendarAppointment> {
    const existing = await this.scope.findOneOrFail<AppointmentRow>(
      appointments,
      actor.clinicId,
      id,
    );

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    if (!canTransitionAppointment(existing.status, next)) {
      throw new BadRequestException(`An appointment cannot go from ${existing.status} to ${next}`);
    }

    if (next === APPOINTMENT_STATUS.CANCELLED && !cancelledReason?.trim()) {
      throw new BadRequestException('A cancellation must state a reason');
    }

    await this.db
      .update(appointments)
      .set({
        status: next,
        ...(next === APPOINTMENT_STATUS.CANCELLED && { cancelledReason: cancelledReason ?? null }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(appointments, actor.clinicId, eq(appointments.id, id)));

    return this.findOne(actor, id);
  }

  /**
   * Arrived → the doctor's visit, in one click.
   *
   * Creates the visit and links both records: the appointment keeps the visit
   * id so the calendar can jump to it, and the visit carries the doctor and
   * patient the appointment was booked with. The appointment moves to
   * `in_progress`, which is what a patient in the chair is.
   *
   * Idempotent by refusal rather than by silence: a second call returns 400
   * rather than creating a second visit for one attendance.
   */
  async convertToVisit(actor: AuthenticatedUser, id: string): Promise<Visit> {
    const existing = await this.scope.findOneOrFail<AppointmentRow>(
      appointments,
      actor.clinicId,
      id,
    );

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    if (existing.visitId) {
      throw new BadRequestException('This appointment already has a visit');
    }

    if (
      existing.status !== APPOINTMENT_STATUS.ARRIVED &&
      existing.status !== APPOINTMENT_STATUS.IN_PROGRESS
    ) {
      throw new BadRequestException('Mark the patient as arrived before opening a visit');
    }

    return this.db.transaction(async (tx) => {
      const [visit] = await tx
        .insert(visits)
        .values({
          clinicId: actor.clinicId,
          patientId: existing.patientId,
          doctorId: existing.doctorId,
          visitDate: new Date(),
          complaint: existing.reason,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();

      /* istanbul ignore next -- insert ... returning always yields a row. */
      if (!visit) {
        throw new Error('Failed to create the visit');
      }

      await tx
        .update(appointments)
        .set({
          visitId: visit.id,
          // A patient who is being seen is in progress, whatever they were.
          status: canTransitionAppointment(existing.status, APPOINTMENT_STATUS.IN_PROGRESS)
            ? APPOINTMENT_STATUS.IN_PROGRESS
            : existing.status,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(this.scope.where(appointments, actor.clinicId, eq(appointments.id, id)));

      return toVisit(visit);
    });
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<AppointmentRow>(appointments, actor.clinicId, id);

    await this.db
      .update(appointments)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(appointments, actor.clinicId, eq(appointments.id, id)));
  }

  /* ---------------------------------------------------------------------- */
  /* Internals                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Runs a write that the overlap constraint may reject.
   *
   * The 23P01 is translated here rather than in a filter, because 409 with
   * "that time is already booked" is the only version of this a receptionist
   * can act on, and because everything else about the write is this service's.
   */
  private async insert(write: () => Promise<AppointmentRow[]>): Promise<AppointmentRow> {
    let rows: AppointmentRow[];

    try {
      rows = await write();
    } catch (error) {
      if (isOverlapConflict(error)) {
        throw new ConflictException('That time is already booked for this doctor');
      }

      throw error;
    }

    const row = rows[0];

    /* istanbul ignore next -- returning always yields the written row. */
    if (!row) {
      throw new Error('Failed to write the appointment');
    }

    return row;
  }

  /** One shape for every calendar read, so a block always has its two names. */
  private calendarSelect() {
    return this.db
      .select({
        appointment: appointments,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        patientFileNumber: patients.fileNumber,
        // A patient nobody on staff created came in through public booking.
        patientUnverified: sql<boolean>`${patients.createdBy} is null`,
        doctorName: users.name,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
      .innerJoin(users, eq(users.id, doctors.userId));
  }

  private async defaultDuration(actor: AuthenticatedUser, doctorId: string): Promise<number> {
    const [row] = await this.db
      .select({ duration: doctors.defaultAppointmentDurationMinutes })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new BadRequestException('Doctor not found in this clinic');
    }

    return row.duration;
  }

  private async timeZone(clinicId: string): Promise<string> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return clinicScheduleSettings(row?.settings).timezone || DEFAULT_TIME_ZONE;
  }
}

/** Sunday of the week a date falls in, matching `DaySchedule.weekday` 0 = Sunday. */
export function startOfWeek(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));

  return addDays(isoDate, -at.getUTCDay());
}

export function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    // Computed on read from the two columns that define it — there is no
    // stored end to fall out of step, in the table or in the constraint.
    endsAt: new Date(row.startsAt.getTime() + row.durationMinutes * 60_000).toISOString(),
    type: row.type,
    status: row.status,
    reason: row.reason,
    notes: row.notes,
    visitId: row.visitId,
    cancelledReason: row.cancelledReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface CalendarRow {
  readonly appointment: AppointmentRow;
  readonly patientName: string;
  readonly patientPhone: string;
  readonly patientFileNumber: string;
  readonly patientUnverified: boolean;
  readonly doctorName: string;
}

export function toCalendarAppointment(row: CalendarRow): CalendarAppointment {
  return {
    ...toAppointment(row.appointment),
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    patientFileNumber: row.patientFileNumber,
    patientUnverified: row.patientUnverified,
    doctorName: row.doctorName,
  };
}
