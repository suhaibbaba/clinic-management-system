import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  Inject,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import { clinicTimeZone } from "@api/common/database/clinic-time-zone";
import {
  addDays,
  APPOINTMENT_OPEN_STATUSES,
  APPOINTMENT_STATUS,
  APPOINTMENT_TIMING_ERROR,
  APPOINTMENT_TYPE,
  appointmentTimingError,
  canTransitionAppointment,
  instantFromLocal,
  localDate,
  LOOKUP_LIST,
  occupiesSlot,
  type AppointmentStatus,
  type AppointmentTimingError,
  type CalendarAppointment,
  type CalendarFeed,
  type CalendarQuery,
  type CreateAppointmentInput,
  type ListAppointmentsQuery,
  type Paginated,
  type UpdateAppointmentInput,
  type Visit,
} from "@clinic/shared";
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { AppointmentAccessService } from "@api/modules/appointments/services/appointment-access.service";
import { toClinicClosure, toDoctorTimeOff } from "@api/common/lib/schedule-rows";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  appointments,
  clinicClosures,
  doctors,
  doctorTimeOff,
  patients,
  users,
  visits,
} from "@api/database/schema";
import { PatientAccessService } from "@api/modules/patients/services/patient-access.service";
import { PatientRegistrationService } from "@api/modules/patients/services/patient-registration.service";
import { toVisit } from "@api/common/lib/visits";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { EXCLUSION_VIOLATION, DEADLOCK } from "@api/common/constants/postgres-errors";
import { APPOINTMENTS_ENTITY } from "@api/common/constants/audit-entities";
import {
  toAppointment,
  toCalendarAppointment,
  AppointmentRow,
  calendarRangeStart,
  calendarRangeEnd,
  hasSqlState,
} from "@api/modules/appointments/lib/appointments";

@Injectable()
export class AppointmentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly registration: PatientRegistrationService,
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

  async list(
    actor: AuthenticatedUser,
    query: ListAppointmentsQuery,
  ): Promise<Paginated<CalendarAppointment>> {
    const filters: (SQL | undefined)[] = [
      await this.access.readableFilter(actor, appointments.doctorId),
    ];

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

    const timeZone = await clinicTimeZone(this.db, actor.clinicId);

    if (query.from) {
      filters.push(gte(appointments.startsAt, instantFromLocal(query.from, 0, timeZone)));
    }
    if (query.to) {
      filters.push(lt(appointments.startsAt, instantFromLocal(addDays(query.to, 1), 0, timeZone)));
    }
    if (query.overdue) {
      filters.push(
        inArray(appointments.status, [...APPOINTMENT_OPEN_STATUSES]),
        lt(appointments.startsAt, instantFromLocal(localDate(new Date(), timeZone), 0, timeZone)),
      );
    }

    const where = this.scope.where(appointments, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.calendarSelect()
        .where(where)
        .orderBy(query.overdue ? desc(appointments.startsAt) : asc(appointments.startsAt))
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
    await this.scope.findOneOrFail<AppointmentRow>(appointments, actor.clinicId, id);

    const [row] = await this.calendarSelect()
      .where(
        this.scope.where(
          appointments,
          actor.clinicId,
          eq(appointments.id, id),
          await this.access.readableFilter(actor, appointments.doctorId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Resource not found");
    }

    return toCalendarAppointment(row);
  }

  async calendar(actor: AuthenticatedUser, query: CalendarQuery): Promise<CalendarFeed> {
    const timeZone = await clinicTimeZone(this.db, actor.clinicId);
    const from = query.to ? query.date : calendarRangeStart(query.date, query.range);
    const to = query.to ? addDays(query.to, 1) : calendarRangeEnd(from, query.range);
    const fromInstant = instantFromLocal(from, 0, timeZone);
    const toInstant = instantFromLocal(to, 0, timeZone);

    const [rows, closures, absences] = await Promise.all([
      this.calendarSelect()
        .where(
          this.scope.where(
            appointments,
            actor.clinicId,
            and(
              gte(appointments.startsAt, fromInstant),
              lt(appointments.startsAt, toInstant),
              query.doctorId ? eq(appointments.doctorId, query.doctorId) : undefined,
              await this.access.readableFilter(actor, appointments.doctorId),
            ),
          ),
        )
        .orderBy(asc(appointments.startsAt)),

      this.db
        .select()
        .from(clinicClosures)
        .where(
          this.scope.where(
            clinicClosures,
            actor.clinicId,
            and(lte(clinicClosures.startsOn, addDays(to, -1)), gte(clinicClosures.endsOn, from)),
          ),
        )
        .orderBy(asc(clinicClosures.startsOn)),

      this.db
        .select()
        .from(doctorTimeOff)
        .where(
          this.scope.where(
            doctorTimeOff,
            actor.clinicId,
            and(
              query.doctorId ? eq(doctorTimeOff.doctorId, query.doctorId) : undefined,
              lt(doctorTimeOff.startsAt, toInstant),
              gt(doctorTimeOff.endsAt, fromInstant),
            ),
          ),
        )
        .orderBy(asc(doctorTimeOff.startsAt)),
    ]);

    return {
      from,
      to,
      appointments: rows.map(toCalendarAppointment),
      closures: closures.map(toClinicClosure),
      timeOff: absences.map(toDoctorTimeOff),
    };
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateAppointmentInput,
  ): Promise<CalendarAppointment> {
    await this.lookups.assertOptionalCode(actor.clinicId, LOOKUP_LIST.APPOINTMENT_TYPE, input.type);

    if (input.patientId) {
      await this.patientAccess.requirePatientId(actor, input.patientId);
    }

    await this.access.requireOwnCalendar(actor, input.doctorId);
    await this.requireNotBeforeToday(actor.clinicId, new Date(input.startsAt));

    const duration = input.durationMinutes ?? (await this.defaultDuration(actor, input.doctorId));

    const row = await this.insert(() =>
      this.registration.withPatient(actor, input, (executor, patientId) =>
        executor
          .insert(appointments)
          .values({
            clinicId: actor.clinicId,
            patientId,
            doctorId: input.doctorId,
            startsAt: new Date(input.startsAt),
            durationMinutes: duration,
            type: input.type ?? APPOINTMENT_TYPE.CHECKUP,
            status: input.status ?? APPOINTMENT_STATUS.CONFIRMED,
            reason: input.reason ?? null,
            notes: input.notes ?? null,
            createdBy: actor.id,
            updatedBy: actor.id,
          })
          .returning(),
      ),
    );

    return this.findOne(actor, row.id);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<CalendarAppointment> {
    await this.lookups.assertOptionalCode(actor.clinicId, LOOKUP_LIST.APPOINTMENT_TYPE, input.type);

    const existing = await this.scope.findOneOrFail<AppointmentRow>(
      appointments,
      actor.clinicId,
      id,
    );

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    if (input.doctorId) {
      await this.access.requireOwnCalendar(actor, input.doctorId);
    }

    if (!occupiesSlot(existing.status) || existing.status === APPOINTMENT_STATUS.COMPLETED) {
      throw new BadRequestException("This appointment is closed and can no longer be moved");
    }

    if (
      input.startsAt !== undefined &&
      new Date(input.startsAt).getTime() !== existing.startsAt.getTime()
    ) {
      await this.requireNotBeforeToday(actor.clinicId, new Date(input.startsAt));
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
      throw new BadRequestException("A cancellation must state a reason");
    }

    const timingError = await this.timingError(actor.clinicId, existing.startsAt, next);

    if (timingError) {
      throw new BadRequestException(timingError);
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

  private async requireNotBeforeToday(clinicId: string, startsAt: Date): Promise<void> {
    const timeZone = await clinicTimeZone(this.db, clinicId);

    if (localDate(startsAt, timeZone) < localDate(new Date(), timeZone)) {
      throw new BadRequestException(APPOINTMENT_TIMING_ERROR.DAY_PASSED);
    }
  }

  async timingError(
    clinicId: string,
    startsAt: Date,
    next: AppointmentStatus,
  ): Promise<AppointmentTimingError | null> {
    const timeZone = await clinicTimeZone(this.db, clinicId);
    const now = new Date();

    return appointmentTimingError(next, {
      day: localDate(startsAt, timeZone),
      today: localDate(now, timeZone),
      startsAt,
      now,
    });
  }

  async convertToVisit(actor: AuthenticatedUser, id: string): Promise<Visit> {
    const existing = await this.scope.findOneOrFail<AppointmentRow>(
      appointments,
      actor.clinicId,
      id,
    );

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    if (existing.visitId) {
      throw new BadRequestException("This appointment already has a visit");
    }

    if (
      existing.status !== APPOINTMENT_STATUS.ARRIVED &&
      existing.status !== APPOINTMENT_STATUS.IN_PROGRESS
    ) {
      throw new BadRequestException("Mark the patient as arrived before opening a visit");
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

      if (!visit) {
        throw new Error("Failed to create the visit");
      }

      await tx
        .update(appointments)
        .set({
          visitId: visit.id,
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

  private async insert(write: () => Promise<AppointmentRow[]>): Promise<AppointmentRow> {
    let rows: AppointmentRow[];

    try {
      rows = await this.writeOnce(write);
    } catch (error) {
      if (hasSqlState(error, EXCLUSION_VIOLATION)) {
        throw new ConflictException("That time is already booked for this doctor");
      }

      throw error;
    }

    const row = rows[0];

    if (!row) {
      throw new Error("Failed to write the appointment");
    }

    return row;
  }

  private async writeOnce(write: () => Promise<AppointmentRow[]>): Promise<AppointmentRow[]> {
    try {
      return await write();
    } catch (error) {
      if (!hasSqlState(error, DEADLOCK)) {
        throw error;
      }

      return write();
    }
  }

  private calendarSelect() {
    return this.db
      .select({
        appointment: appointments,
        patientName: patients.fullName,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        patientPhone: patients.phone,
        patientFileNumber: patients.fileNumber,
        patientUnverified: sql<boolean>`${patients.createdBy} is null`,
        doctorNameAr: users.nameAr,
        doctorNameEn: users.nameEn,
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
      throw new BadRequestException("Doctor not found in this clinic");
    }

    return row.duration;
  }

  async localToday(clinicId: string): Promise<string> {
    return localDate(new Date(), await clinicTimeZone(this.db, clinicId));
  }
}
