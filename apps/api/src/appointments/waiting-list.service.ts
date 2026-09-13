import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  APPOINTMENT_TYPE,
  canTransitionWaitingListEntry,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  localDate,
  minutesFromLocalMidnight,
  NOTIFICATION_TEMPLATE,
  WAITING_LIST_PRIORITY,
  WAITING_LIST_PRIORITY_RANK,
  WAITING_LIST_SOURCE,
  WAITING_LIST_STATUS,
  type CreateUrgentRequestInput,
  type CreateWaitingListEntryInput,
  type DeclineWaitingListEntryInput,
  type ListWaitingListQuery,
  type Paginated,
  type PromoteWaitingListEntryInput,
  type UpdateWaitingListEntryInput,
  type WaitingListEntry,
  type WaitingListStatus,
} from '@clinic/shared';
import { asc, eq, isNull, sql, type SQL } from 'drizzle-orm';

import { AppointmentsService } from '@api/appointments/appointments.service';
import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { notificationName, toOptionalPersonName, toPersonName } from '@api/common/person-name';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinics, doctors, patients, users, waitingList } from '@api/database/schema';
import { NotificationsService } from '@api/notifications/notifications.service';
import { PatientAccessService } from '@api/patients/patient-access.service';
import { PatientRegistrationService } from '@api/patients/patient-registration.service';

type WaitingListRow = typeof waitingList.$inferSelect;

export const WAITING_LIST_ENTITY = 'waiting_list';

// A queue, not a history. Promotion goes through `AppointmentsService.create`, so a slot taken
// while the patient waited is refused with a 409.
@Injectable()
export class WaitingListService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly patientAccess: PatientAccessService,
    private readonly registration: PatientRegistrationService,
    private readonly appointments: AppointmentsService,
    private readonly notifications: NotificationsService,
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
            source: row.source,
            status: row.status,
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
    if (query.source) {
      filters.push(eq(waitingList.source, query.source));
    }
    if (query.status) {
      filters.push(eq(waitingList.status, query.status));
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
    if (input.patientId) {
      await this.patientAccess.requirePatientId(actor, input.patientId);
    }

    if (input.doctorId) {
      await this.requireDoctor(actor, input.doctorId);
    }

    const [row] = await this.registration.withPatient(actor, input, (executor, patientId) =>
      executor
        .insert(waitingList)
        .values({
          clinicId: actor.clinicId,
          patientId,
          doctorId: input.doctorId ?? null,
          reason: input.reason ?? null,
          priority: input.priority,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning({ id: waitingList.id }),
    );

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

  /** Rang back, nothing decided yet. The one step that leaves the entry in the queue. */
  async markContacted(actor: AuthenticatedUser, id: string): Promise<WaitingListEntry> {
    await this.requireTransition(actor, id, WAITING_LIST_STATUS.CONTACTED);

    await this.db
      .update(waitingList)
      .set({
        status: WAITING_LIST_STATUS.CONTACTED,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)));

    return this.findOne(actor, id);
  }

  async promote(
    actor: AuthenticatedUser,
    id: string,
    input: PromoteWaitingListEntryInput,
  ): Promise<WaitingListEntry> {
    const existing = await this.requireTransition(actor, id, WAITING_LIST_STATUS.SCHEDULED);

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
        status: WAITING_LIST_STATUS.SCHEDULED,
        appointmentId: appointment.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)));

    const entry = await this.findOne(actor, id);

    if (input.notify) {
      const timeZone = await this.timeZone(actor.clinicId);
      const startsAt = new Date(appointment.startsAt);

      await this.notify(actor.clinicId, entry, NOTIFICATION_TEMPLATE.URGENT_SCHEDULED, {
        doctor: notificationName(appointment.doctorName),
        date: localDate(startsAt, timeZone),
        time: timeIn(timeZone, startsAt),
      });
    }

    return entry;
  }

  /** Closing without a booking. The reason is what the patient was told, so it is recorded. */
  async decline(
    actor: AuthenticatedUser,
    id: string,
    input: DeclineWaitingListEntryInput,
  ): Promise<WaitingListEntry> {
    await this.requireTransition(actor, id, WAITING_LIST_STATUS.DECLINED);

    await this.db
      .update(waitingList)
      .set({
        status: WAITING_LIST_STATUS.DECLINED,
        declinedReason: input.reason,
        resolvedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(waitingList, actor.clinicId, eq(waitingList.id, id)));

    const entry = await this.findOne(actor, id);

    if (input.notify) {
      await this.notify(actor.clinicId, entry, NOTIFICATION_TEMPLATE.URGENT_DECLINED, {
        reason: input.reason,
      });
    }

    return entry;
  }

  // The public page's way out of a day with no times on it. Nothing is held and no slot is named:
  // it is a request for a phone call, and the reply says exactly that.
  async createUrgentRequest(
    clinicId: string,
    patientId: string,
    input: CreateUrgentRequestInput,
  ): Promise<void> {
    if (input.doctorId) {
      await this.requireClinicDoctor(clinicId, input.doctorId);
    }

    await this.db.insert(waitingList).values({
      clinicId,
      patientId,
      doctorId: input.doctorId ?? null,
      reason: input.complaint,
      priority: WAITING_LIST_PRIORITY.URGENT,
      source: WAITING_LIST_SOURCE.ONLINE,
      status: WAITING_LIST_STATUS.PENDING,
      // No `created_by`: nobody on staff made this row, and naming one would be
      // a lie in the audit trail.
    });
  }

  /** How many strangers are waiting on a call back — the badge on the queue. */
  async openUrgentCount(clinicId: string, phone?: string): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(waitingList)
      .innerJoin(patients, eq(patients.id, waitingList.patientId))
      .where(
        this.scope.where(
          waitingList,
          clinicId,
          eq(waitingList.source, WAITING_LIST_SOURCE.ONLINE),
          isNull(waitingList.resolvedAt),
          phone === undefined
            ? undefined
            : sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${phone}`,
        ),
      );

    return row?.value ?? 0;
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

  private entrySelect() {
    return this.db
      .select({
        entry: waitingList,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        doctorNameAr: users.nameAr,
        doctorNameEn: users.nameEn,
      })
      .from(waitingList)
      .innerJoin(patients, eq(patients.id, waitingList.patientId))
      .leftJoin(doctors, eq(doctors.id, waitingList.doctorId))
      .leftJoin(users, eq(users.id, doctors.userId));
  }

  private async requireDoctor(actor: AuthenticatedUser, doctorId: string): Promise<void> {
    await this.requireClinicDoctor(actor.clinicId, doctorId);
  }

  private async requireClinicDoctor(clinicId: string, doctorId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: doctors.id })
      .from(doctors)
      .where(this.scope.where(doctors, clinicId, eq(doctors.id, doctorId)))
      .limit(1);

    if (!row) {
      throw new BadRequestException('Doctor not found in this clinic');
    }
  }

  // The transition table is the only test, as it is for an appointment: a closed entry cannot be
  // rung back, scheduled twice, or declined after it was booked.
  private async requireTransition(
    actor: AuthenticatedUser,
    id: string,
    next: WaitingListStatus,
  ): Promise<WaitingListRow> {
    const existing = await this.scope.findOneOrFail<WaitingListRow>(
      waitingList,
      actor.clinicId,
      id,
    );

    if (!canTransitionWaitingListEntry(existing.status, next)) {
      throw new BadRequestException(`A queue entry cannot go from ${existing.status} to ${next}`);
    }

    return existing;
  }

  private async notify(
    clinicId: string,
    entry: WaitingListEntry,
    template: (typeof NOTIFICATION_TEMPLATE)[keyof typeof NOTIFICATION_TEMPLATE],
    vars: Record<string, string>,
  ): Promise<void> {
    const [row] = await this.db
      .select({ nameAr: clinics.nameAr, nameEn: clinics.nameEn })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    await this.notifications.send({
      clinicId,
      to: entry.patientPhone,
      template,
      vars: {
        clinic: row ? notificationName(toPersonName(row.nameAr, row.nameEn)) : '',
        ...vars,
      },
    });
  }

  private async timeZone(clinicId: string): Promise<string> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return clinicScheduleSettings(row?.settings ?? {}).timezone || DEFAULT_TIME_ZONE;
  }
}

function timeIn(timeZone: string, at: Date): string {
  const minutes = minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone);
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;
}

interface WaitingListJoinedRow {
  readonly entry: WaitingListRow;
  readonly patientName: string;
  readonly patientPhone: string;
  readonly doctorNameAr: string | null;
  readonly doctorNameEn: string | null;
}

export function toWaitingListEntry(row: WaitingListJoinedRow): WaitingListEntry {
  return {
    id: row.entry.id,
    clinicId: row.entry.clinicId,
    patientId: row.entry.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    doctorId: row.entry.doctorId,
    doctorName: toOptionalPersonName(row.doctorNameAr, row.doctorNameEn),
    reason: row.entry.reason,
    priority: row.entry.priority,
    source: row.entry.source,
    status: row.entry.status,
    declinedReason: row.entry.declinedReason,
    resolvedAt: row.entry.resolvedAt?.toISOString() ?? null,
    appointmentId: row.entry.appointmentId,
    createdAt: row.entry.createdAt.toISOString(),
    updatedAt: row.entry.updatedAt.toISOString(),
  };
}
