import { BadRequestException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  addDays,
  clinicScheduleSettings,
  closureCancellationReason,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  type ClinicClosure,
  type ClinicClosureResult,
  type CreateClinicClosureInput,
  type ListClinicClosuresQuery,
  type Paginated,
  type ScheduleConflictOptions,
  type UpdateClinicClosureInput,
} from '@clinic/shared';
import { and, asc, count, eq, gte, lte, type SQL } from 'drizzle-orm';

import { toClinicClosure } from '@api/appointments/availability.service';
import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { clinicClosures, clinics } from '@api/database/schema';
import { ScheduleConflictsService } from '@api/schedule/schedule-conflicts.service';

type ClosureRow = typeof clinicClosures.$inferSelect;

export const CLINIC_CLOSURES_ENTITY = 'clinic_closures';

// Read by every role, written by admin. The rule that makes it more than a list is in
// `ScheduleConflictsService`: a closure over a booked day is refused first.
@Injectable()
export class ClinicClosuresService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly conflicts: ScheduleConflictsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(CLINIC_CLOSURES_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(clinicClosures)
        .where(this.scope.where(clinicClosures, clinicId, eq(clinicClosures.id, id)))
        .limit(1);

      return row ? { ...toClinicClosure(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListClinicClosuresQuery,
  ): Promise<Paginated<ClinicClosure>> {
    const filters: (SQL | undefined)[] = [];

    // Inclusive both ends, so a closure straddling the window still shows.
    if (query.from) {
      filters.push(gte(clinicClosures.endsOn, query.from));
    }
    if (query.to) {
      filters.push(lte(clinicClosures.startsOn, query.to));
    }

    const where = this.scope.where(clinicClosures, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(clinicClosures)
        .where(where)
        .orderBy(asc(clinicClosures.startsOn))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(clinicClosures).where(where),
    ]);

    return toPaginated(rows.map(toClinicClosure), totals?.value ?? 0, query);
  }

  async inRange(clinicId: string, from: string, to: string): Promise<ClinicClosure[]> {
    const rows = await this.db
      .select()
      .from(clinicClosures)
      .where(
        this.scope.where(
          clinicClosures,
          clinicId,
          and(lte(clinicClosures.startsOn, to), gte(clinicClosures.endsOn, from)),
        ),
      )
      .orderBy(asc(clinicClosures.startsOn));

    return rows.map(toClinicClosure);
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateClinicClosureInput,
    options: ScheduleConflictOptions,
  ): Promise<ClinicClosureResult> {
    assertAnnualFitsOneYear(input.startsOn, input.endsOn, input.isAnnual);

    const window = await this.windowFor(actor.clinicId, input.startsOn, input.endsOn);
    const conflicting = await this.conflicts.assertClear(actor.clinicId, window, options);

    const [created] = await this.db
      .insert(clinicClosures)
      .values({
        clinicId: actor.clinicId,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        reason: input.reason,
        isAnnual: input.isAnnual,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!created) {
      throw new Error('Failed to create the closure');
    }

    const cancelled = options.cancelAppointments
      ? await this.conflicts.cancelAll(actor, conflicting, closureCancellationReason(created.id))
      : 0;

    return { item: toClinicClosure(created), cancelledAppointments: cancelled };
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateClinicClosureInput,
    options: ScheduleConflictOptions,
  ): Promise<ClinicClosureResult> {
    const existing = await this.scope.findOneOrFail<ClosureRow>(clinicClosures, actor.clinicId, id);

    const startsOn = input.startsOn ?? existing.startsOn;
    const endsOn = input.endsOn ?? existing.endsOn;
    const isAnnual = input.isAnnual ?? existing.isAnnual;

    if (startsOn > endsOn) {
      throw new BadRequestException('endsOn must not be before startsOn');
    }

    assertAnnualFitsOneYear(startsOn, endsOn, isAnnual);

    // Only the days the closure is *gaining* need checking: a day it already
    // covered has no live appointment left to strand.
    const grew = startsOn < existing.startsOn || endsOn > existing.endsOn;
    const conflicting = grew
      ? await this.conflicts.assertClear(
          actor.clinicId,
          await this.windowFor(actor.clinicId, startsOn, endsOn),
          options,
        )
      : [];

    await this.db
      .update(clinicClosures)
      .set({
        startsOn,
        endsOn,
        ...(input.reason !== undefined && { reason: input.reason }),
        isAnnual,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(clinicClosures, actor.clinicId, eq(clinicClosures.id, id)));

    const cancelled = options.cancelAppointments
      ? await this.conflicts.cancelAll(actor, conflicting, closureCancellationReason(id))
      : 0;

    const updated = await this.scope.findOneOrFail<ClosureRow>(clinicClosures, actor.clinicId, id);

    return { item: toClinicClosure(updated), cancelledAppointments: cancelled };
  }

  // The appointments a closure cancelled stay cancelled — the patients were told, and quietly
  // reinstating them would be worse.
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.scope.findOneOrFail<ClosureRow>(clinicClosures, actor.clinicId, id);

    await this.db
      .update(clinicClosures)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(clinicClosures, actor.clinicId, eq(clinicClosures.id, id)));
  }

  // `endsOn` is inclusive, so the window runs to midnight of the day after: a 16:00 appointment on
  // the last closed day is inside it.
  private async windowFor(
    clinicId: string,
    startsOn: string,
    endsOn: string,
  ): Promise<{ from: Date; to: Date }> {
    const zone = await this.timeZone(clinicId);

    return {
      from: instantFromLocal(startsOn, 0, zone),
      to: instantFromLocal(addDays(endsOn, 1), 0, zone),
    };
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

// An annual closure must sit inside one year: a range crossing new year has no meaning as a
// repeating rule, and the day/month match cannot express it.
function assertAnnualFitsOneYear(startsOn: string, endsOn: string, isAnnual: boolean): void {
  if (isAnnual && startsOn.slice(0, 4) !== endsOn.slice(0, 4)) {
    throw new BadRequestException('An annual closure must start and end in the same year');
  }
}
