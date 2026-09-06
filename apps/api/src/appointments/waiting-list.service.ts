import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  APPOINTMENT_TYPE,
  WAITING_LIST_PRIORITY_RANK,
  type CreateWaitingListEntryInput,
  type ListWaitingListQuery,
  type Paginated,
  type PromoteWaitingListEntryInput,
  type UpdateWaitingListEntryInput,
  type WaitingListEntry,
} from '@clinic/shared';
import { asc, eq, isNull, sql, type SQL } from 'drizzle-orm';

import { AppointmentsService } from '@api/appointments/appointments.service';
import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { doctors, patients, users, waitingList } from '@api/database/schema';
import { PatientAccessService } from '@api/patients/patient-access.service';

type WaitingListRow = typeof waitingList.$inferSelect;

export const WAITING_LIST_ENTITY = 'waiting_list';

/**
 * Walk-ins and callers waiting for a slot that does not exist yet.
 *
 * It is a queue, not a history: the panel reads unresolved entries, ordered by
 * priority and then by how long someone has been waiting, which is the order a
 * front desk actually calls people in.
 *
 * Promotion goes through `AppointmentsService.create`, so a promoted entry is
 * subject to the same overlap constraint as any other booking — a slot that
 * was taken while the patient waited is refused with a 409 rather than
 * double-booked.
 */
@Injectable()
export class WaitingListService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly appointments: AppointmentsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(WAITING_LIST_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(waitingList)
        .where(this.scope.where(waitingList, clinicId, eq(waitingList.id, id)))
        .limit(1);

      return row
        ? {
            patientId: row.patientId,
            doctorId: row.doctorId,
            reason: row.reason,
            priority: row.priority,
            resolvedAt: row.resolvedAt?.toISOString() ?? null,
            appointmentId: row.appointmentId,
          }
        : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListWaitingListQuery,
  ): Promise<Paginated<WaitingListEntry>> {
    const filters: (SQL | undefined)[] = [];

    if (!query.includeResolved) {
      filters.push(isNull(waitingList.resolvedAt));
    }
    if (query.doctorId) {
      filters.push(eq(waitingList.doctorId, query.doctorId));
    }

    const where = this.scope.where(waitingList, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.entrySelect()
        .where(where)
        // Urgent first, then longest waiting. The rank is data in
        // `@clinic/shared` so the panel and this query cannot disagree.
        .orderBy(
          sql`case ${waitingList.priority}
                when 'urgent' then ${WAITING_LIST_PRIORITY_RANK.urgent}
                when 'high' then ${WAITING_LIST_PRIORITY_RANK.high}
                else ${WAITING_LIST_PRIORITY_RANK.normal}
              end`,
          asc(waitingList.createdAt),
        )
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(waitingList)
        .where(where),
    ]);

    return toPaginated(rows.map(toWaitingListEntry), totals?.value ?? 0, query);
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateWaitingListEntryInput,
  ): Promise<WaitingListEntry> {
    await this.patientAccess.requirePatientId(actor, input.patientId);

    if (input.doctorId) {
      await this.requireDoctor(actor, input.doctorId);
    }

    const [row] = await this.db
      .insert(waitingList)
      .values({
        clinicId: actor.clinicId,
        patientId: input.patientId,
        doctorId: input.doctorId ?? null,
        reason: input.reason ?? null,
        priority: input.priority,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning({ id: waitingList.id });

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create the waiting list entry');
    }

    return this.findOne(actor, row.id);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateWaitingListEntryInput,
  ): Promise<WaitingListEntry> {
    const existing = await this.scope.findOneOrFail<WaitingListRow>(
      waitingList,
      actor.clinicId,
      id,
    );

    if (existing.resolvedAt) {
      throw new BadRequestException('This entry has already been resolved');
    }

    if (input.doctorId) {
      await this.requireDoctor(actor, input.doctorId);
    }

    await this.db
      .update(waitingList)
      .set({
        ...(input.doctorId !== undefined && { doctorId: input.doctorId ?? null }),
        ...(input.reason !== undefined && { reason: input.reason ?? null }),
        ...(input.priority !== undefined && { priority: input.priority }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)));

    return this.findOne(actor, id);
  }

  /**
   * Books the waiting patient into a slot and closes the entry.
   *
   * The appointment is created through the appointments service rather than
   * inserted here, so a slot taken while the patient waited is refused by the
   * same exclusion constraint with the same 409 — and the entry stays open,
   * which is the correct outcome: they are still waiting.
   */
  async promote(
    actor: AuthenticatedUser,
    id: string,
    input: PromoteWaitingListEntryInput,
  ): Promise<WaitingListEntry> {
    const existing = await this.scope.findOneOrFail<WaitingListRow>(
      waitingList,
      actor.clinicId,
      id,
    );

    if (existing.resolvedAt) {
      throw new BadRequestException('This entry has already been resolved');
    }

    const appointment = await this.appointments.create(actor, {
      patientId: existing.patientId,
      doctorId: input.doctorId,
      startsAt: input.startsAt,
      type: input.type ?? APPOINTMENT_TYPE.CHECKUP,
      reason: existing.reason,
      ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
    });

    await this.db
      .update(waitingList)
      .set({
        appointmentId: appointment.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)));

    return this.findOne(actor, id);
  }

  /** Closes an entry without booking it — the patient gave up or was seen. */
  async resolve(actor: AuthenticatedUser, id: string): Promise<WaitingListEntry> {
    const existing = await this.scope.findOneOrFail<WaitingListRow>(
      waitingList,
      actor.clinicId,
      id,
    );

    if (existing.resolvedAt) {
      throw new BadRequestException('This entry has already been resolved');
    }

    await this.db
      .update(waitingList)
      .set({ resolvedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)));

    return this.findOne(actor, id);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<WaitingListRow>(waitingList, actor.clinicId, id);

    await this.db
      .update(waitingList)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)));
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<WaitingListEntry> {
    await this.scope.findOneOrFail<WaitingListRow>(waitingList, actor.clinicId, id);

    const [row] = await this.entrySelect()
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)))
      .limit(1);

    /* istanbul ignore next -- the row was just loaded. */
    if (!row) {
      throw new BadRequestException('Waiting list entry not found');
    }

    return toWaitingListEntry(row);
  }

  /** The panel draws names, so every read joins them once here. */
  private entrySelect() {
    return this.db
      .select({
        entry: waitingList,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        doctorName: users.name,
      })
      .from(waitingList)
      .innerJoin(patients, eq(patients.id, waitingList.patientId))
      .leftJoin(doctors, eq(doctors.id, waitingList.doctorId))
      .leftJoin(users, eq(users.id, doctors.userId));
  }

  private async requireDoctor(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, actor.clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new BadRequestException('Doctor not found in this clinic');
    }
  }
}

interface WaitingListJoinedRow {
  readonly entry: WaitingListRow;
  readonly patientName: string;
  readonly patientPhone: string;
  readonly doctorName: string | null;
}

export function toWaitingListEntry(row: WaitingListJoinedRow): WaitingListEntry {
  return {
    id: row.entry.id,
    clinicId: row.entry.clinicId,
    patientId: row.entry.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    doctorId: row.entry.doctorId,
    doctorName: row.doctorName,
    reason: row.entry.reason,
    priority: row.entry.priority,
    resolvedAt: row.entry.resolvedAt?.toISOString() ?? null,
    appointmentId: row.entry.appointmentId,
    createdAt: row.entry.createdAt.toISOString(),
    updatedAt: row.entry.updatedAt.toISOString(),
  };
}
