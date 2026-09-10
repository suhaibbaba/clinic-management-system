import { ConflictException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  LAB_ORDER_BILLABLE_STATUSES,
  LAB_ORDER_AWAITING_STATUSES,
  type CreateLabInput,
  type Lab,
  type LabSummary,
  type ListLabsQuery,
  type Paginated,
  type UpdateLabInput,
} from '@clinic/shared';
import { and, asc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { labs } from '@api/database/schema';

type LabRow = typeof labs.$inferSelect;

export const LABS_ENTITY = 'labs';

// Never hard-deleted: its orders and payments are financial history. `is_active` keeps a lab out of
// the pickers with its record and balance intact.
@Injectable()
export class LabsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(LABS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(labs)
        .where(this.scope.where(labs, clinicId, eq(labs.id, id)))
        .limit(1);

      return row ? { ...toLab(row) } : null;
    });
  }

  // Both numbers are computed, in one query per page rather than one per lab: a dozen labs should
  // not be twenty-five round trips.
  async list(actor: AuthenticatedUser, query: ListLabsQuery): Promise<Paginated<LabSummary>> {
    const filters: (SQL | undefined)[] = [];

    if (!query.includeInactive) {
      filters.push(eq(labs.isActive, true));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(sql`${labs.name} ilike ${pattern}`);
    }

    const where = this.scope.where(labs, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db.select().from(labs).where(where).orderBy(asc(labs.name)).limit(limit).offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(labs)
        .where(where),
    ]);

    const summaries = await this.summarise(
      actor.clinicId,
      rows.map((row) => row.id),
    );

    return toPaginated(
      rows.map((row) => ({
        ...toLab(row),
        ...(summaries.get(row.id) ?? { balance: '0.00', openOrders: 0 }),
      })),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<LabSummary> {
    const row = await this.requireRow(actor.clinicId, id);
    const summary = await this.summarise(actor.clinicId, [id]);

    return { ...toLab(row), ...(summary.get(id) ?? { balance: '0.00', openOrders: 0 }) };
  }

  async create(actor: AuthenticatedUser, input: CreateLabInput): Promise<Lab> {
    await this.assertNameIsFree(actor.clinicId, input.name);

    const [row] = await this.db
      .insert(labs)
      .values({
        clinicId: actor.clinicId,
        name: input.name,
        phone: input.phone ?? null,
        address: input.address ?? null,
        contactPerson: input.contactPerson ?? null,
        notes: input.notes ?? null,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create the lab');
    }

    return toLab(row);
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateLabInput): Promise<Lab> {
    await this.requireRow(actor.clinicId, id);

    if (input.name) {
      await this.assertNameIsFree(actor.clinicId, input.name, id);
    }

    const [row] = await this.db
      .update(labs)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone ?? null }),
        ...(input.address !== undefined && { address: input.address ?? null }),
        ...(input.contactPerson !== undefined && { contactPerson: input.contactPerson ?? null }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(labs, actor.clinicId, eq(labs.id, id)))
      .returning();

    /* istanbul ignore next -- the row was just read under the same scope. */
    if (!row) {
      throw new Error('Failed to update the lab');
    }

    return toLab(row);
  }

  /** Soft delete. The orders and the ledger stay exactly as they were. */
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(labs)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(labs, actor.clinicId, eq(labs.id, id)));
  }

  /** Used by the orders service, which must not accept a lab from elsewhere. */
  async requireRow(clinicId: string, id: string): Promise<LabRow> {
    return this.scope.findOneOrFail<LabRow>(labs, clinicId, id);
  }

  // The SQL reads `LAB_ORDER_BILLABLE_STATUSES` rather than restating the rule. A `returned` order
  // is in that list on purpose — the lab did the work.
  private async summarise(
    clinicId: string,
    labIds: readonly string[],
  ): Promise<Map<string, { balance: string; openOrders: number }>> {
    if (labIds.length === 0) {
      return new Map();
    }

    const ids = sql.join(
      labIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const billable = sql.join(
      LAB_ORDER_BILLABLE_STATUSES.map((status) => sql`${status}`),
      sql`, `,
    );
    const awaiting = sql.join(
      LAB_ORDER_AWAITING_STATUSES.map((status) => sql`${status}`),
      sql`, `,
    );

    const rows = await this.db.execute<{
      lab_id: string;
      balance: string;
      open_orders: number;
    }>(sql`
      with scoped as (select unnest(array[${ids}]) as lab_id)
      select
        s.lab_id::text as lab_id,
        (
          coalesce((
            select sum(price) from lab_orders
            where clinic_id = ${clinicId} and lab_id = s.lab_id and deleted_at is null
              and status in (${billable})
          ), 0)
          - coalesce((
            select sum(amount) from lab_payments
            where clinic_id = ${clinicId} and lab_id = s.lab_id and deleted_at is null
          ), 0)
        )::text as balance,
        (
          select count(*)::int from lab_orders
          where clinic_id = ${clinicId} and lab_id = s.lab_id and deleted_at is null
            and status in (${awaiting})
        ) as open_orders
      from scoped s
    `);

    return new Map(
      [...rows].map((row) => [
        row.lab_id,
        { balance: normalise(row.balance), openOrders: Number(row.open_orders) },
      ]),
    );
  }

  // Two labs with one name is a data-entry mistake: a statement addressed to one of two identical
  // names is unusable.
  private async assertNameIsFree(clinicId: string, name: string, exceptId?: string): Promise<void> {
    const [clash] = await this.db
      .select({ id: labs.id })
      .from(labs)
      .where(
        and(
          eq(labs.clinicId, clinicId),
          isNull(labs.deletedAt),
          sql`lower(${labs.name}) = lower(${name})`,
          exceptId ? ne(labs.id, exceptId) : undefined,
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException('A lab with this name already exists');
    }
  }
}

export function toLab(row: LabRow): Lab {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    phone: row.phone,
    address: row.address,
    contactPerson: row.contactPerson,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Postgres returns `numeric` unpadded; money is always two decimals here. */
function normalise(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');

  return `${whole}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}
