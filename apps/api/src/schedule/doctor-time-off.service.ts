import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  timeOffCancellationReason,
  type CreateDoctorTimeOffInput,
  type DoctorTimeOff,
  type DoctorTimeOffResult,
  type ListDoctorTimeOffQuery,
  type Paginated,
  type ScheduleConflictOptions,
  type UpdateDoctorTimeOffInput,
} from '@clinic/shared';
import { and, asc, count, eq, gt, lt, type SQL } from 'drizzle-orm';

import { AppointmentAccessService } from '@api/appointments/appointment-access.service';
import { toDoctorTimeOff } from '@api/appointments/availability.service';
import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors, doctorTimeOff } from '@api/database/schema';
import { ScheduleConflictsService } from '@api/schedule/schedule-conflicts.service';

type TimeOffRow = typeof doctorTimeOff.$inferSelect;

export const DOCTOR_TIME_OFF_ENTITY = 'doctor_time_off';

/**
 * One doctor's absences — a conference afternoon, a week away, a morning at
 * the hospital.
 *
 * Ownership follows the ROLES.md core matrix line for doctors and schedules:
 * admin manages anyone's, a doctor manages their own, and everyone else reads.
 * That is the same "own calendar" rule appointments already use, so it is
 * `AppointmentAccessService` rather than a second copy of it here.
 */
@Injectable()
export class DoctorTimeOffService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly access: AppointmentAccessService,
    private readonly conflicts: ScheduleConflictsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(DOCTOR_TIME_OFF_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(doctorTimeOff)
        .where(this.scope.where(doctorTimeOff, clinicId, eq(doctorTimeOff.id, id)))
        .limit(1);

      return row ? { ...toDoctorTimeOff(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    doctorId: string,
    query: ListDoctorTimeOffQuery,
  ): Promise<Paginated<DoctorTimeOff>> {
    await this.requireDoctor(actor.clinicId, doctorId);

    const filters: (SQL | undefined)[] = [eq(doctorTimeOff.doctorId, doctorId)];

    // Overlap, not containment: an absence that started last week and runs
    // into the window is one the window's reader needs to see.
    if (query.from) {
      filters.push(gt(doctorTimeOff.endsAt, new Date(query.from)));
    }
    if (query.to) {
      filters.push(lt(doctorTimeOff.startsAt, new Date(query.to)));
    }

    const where = this.scope.where(doctorTimeOff, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(doctorTimeOff)
        .where(where)
        .orderBy(asc(doctorTimeOff.startsAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(doctorTimeOff).where(where),
    ]);

    return toPaginated(rows.map(toDoctorTimeOff), totals?.value ?? 0, query);
  }

  /** Every absence overlapping an instant window — what the calendar hatches. */
  async inRange(
    clinicId: string,
    from: Date,
    to: Date,
    doctorId?: string,
  ): Promise<DoctorTimeOff[]> {
    const rows = await this.db
      .select()
      .from(doctorTimeOff)
      .where(
        this.scope.where(
          doctorTimeOff,
          clinicId,
          and(
            doctorId ? eq(doctorTimeOff.doctorId, doctorId) : undefined,
            lt(doctorTimeOff.startsAt, to),
            gt(doctorTimeOff.endsAt, from),
          ),
        ),
      )
      .orderBy(asc(doctorTimeOff.startsAt));

    return rows.map(toDoctorTimeOff);
  }

  async create(
    actor: AuthenticatedUser,
    doctorId: string,
    input: CreateDoctorTimeOffInput,
    options: ScheduleConflictOptions,
  ): Promise<DoctorTimeOffResult> {
    await this.requireDoctor(actor.clinicId, doctorId);
    await this.access.requireOwnCalendar(actor, doctorId);

    const window = { from: new Date(input.startsAt), to: new Date(input.endsAt) };
    const conflicting = await this.conflicts.assertClear(actor.clinicId, window, options, doctorId);

    const [created] = await this.db
      .insert(doctorTimeOff)
      .values({
        clinicId: actor.clinicId,
        doctorId,
        startsAt: window.from,
        endsAt: window.to,
        reason: input.reason,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!created) {
      throw new Error('Failed to create the time off');
    }

    const cancelled = options.cancelAppointments
      ? await this.conflicts.cancelAll(actor, conflicting, timeOffCancellationReason(created.id))
      : 0;

    return { item: toDoctorTimeOff(created), cancelledAppointments: cancelled };
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateDoctorTimeOffInput,
    options: ScheduleConflictOptions,
  ): Promise<DoctorTimeOffResult> {
    const existing = await this.scope.findOneOrFail<TimeOffRow>(doctorTimeOff, actor.clinicId, id);

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    const from = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const to = input.endsAt ? new Date(input.endsAt) : existing.endsAt;

    if (from >= to) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    // Only a widened window can strand anything new.
    const grew = from < existing.startsAt || to > existing.endsAt;
    const conflicting = grew
      ? await this.conflicts.assertClear(actor.clinicId, { from, to }, options, existing.doctorId)
      : [];

    await this.db
      .update(doctorTimeOff)
      .set({
        startsAt: from,
        endsAt: to,
        ...(input.reason !== undefined && { reason: input.reason }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(doctorTimeOff, actor.clinicId, eq(doctorTimeOff.id, id)));

    const cancelled = options.cancelAppointments
      ? await this.conflicts.cancelAll(actor, conflicting, timeOffCancellationReason(id))
      : 0;

    const updated = await this.scope.findOneOrFail<TimeOffRow>(doctorTimeOff, actor.clinicId, id);

    return { item: toDoctorTimeOff(updated), cancelledAppointments: cancelled };
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.scope.findOneOrFail<TimeOffRow>(doctorTimeOff, actor.clinicId, id);

    await this.access.requireOwnCalendar(actor, existing.doctorId);

    await this.db
      .update(doctorTimeOff)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(doctorTimeOff, actor.clinicId, eq(doctorTimeOff.id, id)));
  }

  /** 404 for a doctor from another clinic, exactly as for one that does not exist. */
  private async requireDoctor(clinicId: string, doctorId: string): Promise<void> {
    await this.scope.findOneOrFail(doctors, clinicId, doctorId);
  }
}
