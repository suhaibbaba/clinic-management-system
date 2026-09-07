import { ConflictException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  type CreateSupplierInput,
  type ListSuppliersQuery,
  type Paginated,
  type Supplier,
  type SupplierSummary,
  type UpdateSupplierInput,
} from '@clinic/shared';
import { and, asc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { suppliers } from '@api/database/schema';

type SupplierRow = typeof suppliers.$inferSelect;

export const SUPPLIERS_ENTITY = 'suppliers';

/**
 * Who the clinic buys from.
 *
 * The same shape as the labs directory, and for the same reasons: never hard
 * deleted, because purchases point here and a statement whose counterparty has
 * vanished is unreadable; `is_active` as the everyday switch that keeps a
 * supplier out of the pickers without touching their history.
 */
@Injectable()
export class SuppliersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(SUPPLIERS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(suppliers)
        .where(this.scope.where(suppliers, clinicId, eq(suppliers.id, id)))
        .limit(1);

      return row ? { ...toSupplier(row) } : null;
    });
  }

  async list(
    actor: AuthenticatedUser,
    query: ListSuppliersQuery,
  ): Promise<Paginated<SupplierSummary>> {
    const filters: (SQL | undefined)[] = [];

    if (!query.includeInactive) {
      filters.push(eq(suppliers.isActive, true));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(sql`(${suppliers.name} ilike ${pattern}
        or coalesce(${suppliers.contactPerson}, '') ilike ${pattern})`);
    }

    const where = this.scope.where(suppliers, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(suppliers)
        .where(where)
        .orderBy(asc(suppliers.name))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(suppliers)
        .where(where),
    ]);

    const summaries = await this.summarise(
      actor.clinicId,
      rows.map((row) => row.id),
    );

    return toPaginated(
      rows.map((row) => ({
        ...toSupplier(row),
        ...(summaries.get(row.id) ?? { purchased: '0.00', itemCount: 0 }),
      })),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<SupplierSummary> {
    const row = await this.requireRow(actor.clinicId, id);
    const summary = await this.summarise(actor.clinicId, [id]);

    return { ...toSupplier(row), ...(summary.get(id) ?? { purchased: '0.00', itemCount: 0 }) };
  }

  async create(actor: AuthenticatedUser, input: CreateSupplierInput): Promise<Supplier> {
    await this.assertNameIsFree(actor.clinicId, input.name);

    const [row] = await this.db
      .insert(suppliers)
      .values({
        clinicId: actor.clinicId,
        name: input.name,
        phone: input.phone ?? null,
        contactPerson: input.contactPerson ?? null,
        notes: input.notes ?? null,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create the supplier');
    }

    return toSupplier(row);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateSupplierInput,
  ): Promise<Supplier> {
    await this.requireRow(actor.clinicId, id);

    if (input.name) {
      await this.assertNameIsFree(actor.clinicId, input.name, id);
    }

    const [row] = await this.db
      .update(suppliers)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone ?? null }),
        ...(input.contactPerson !== undefined && { contactPerson: input.contactPerson ?? null }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(suppliers, actor.clinicId, eq(suppliers.id, id)))
      .returning();

    /* istanbul ignore next -- the row was just read under the same scope. */
    if (!row) {
      throw new Error('Failed to update the supplier');
    }

    return toSupplier(row);
  }

  /** Soft delete. Purchases already recorded against them stay as they are. */
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(suppliers)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(suppliers, actor.clinicId, eq(suppliers.id, id)));
  }

  /** Used by the items and movements services, which must not take one from elsewhere. */
  async requireRow(clinicId: string, id: string): Promise<SupplierRow> {
    return this.scope.findOneOrFail<SupplierRow>(suppliers, clinicId, id);
  }

  /**
   * What has been spent with each supplier, and how many items name them.
   *
   * The total is over purchase movements only — a consumption has no supplier
   * — and it multiplies quantity by unit price in SQL, in `numeric`, so it
   * never passes through a float. A purchase recorded without a price
   * contributes nothing rather than zero-ing the line: the clinic bought it,
   * they just did not type what it cost.
   */
  private async summarise(
    clinicId: string,
    supplierIds: readonly string[],
  ): Promise<Map<string, { purchased: string; itemCount: number }>> {
    if (supplierIds.length === 0) {
      return new Map();
    }

    const ids = sql.join(
      supplierIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    const rows = await this.db.execute<{
      supplier_id: string;
      purchased: string;
      item_count: number;
    }>(sql`
      with scoped as (select unnest(array[${ids}]) as supplier_id)
      select
        s.supplier_id::text as supplier_id,
        coalesce((
          select sum(quantity * unit_price) from stock_movements
          where clinic_id = ${clinicId} and supplier_id = s.supplier_id
            and type = 'purchase' and unit_price is not null
        ), 0)::text as purchased,
        (
          select count(*)::int from inventory_items
          where clinic_id = ${clinicId} and default_supplier_id = s.supplier_id
            and deleted_at is null
        ) as item_count
      from scoped s
    `);

    return new Map(
      [...rows].map((row) => [
        row.supplier_id,
        { purchased: toMoneyString(row.purchased), itemCount: Number(row.item_count) },
      ]),
    );
  }

  private async assertNameIsFree(clinicId: string, name: string, exceptId?: string): Promise<void> {
    const [clash] = await this.db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.clinicId, clinicId),
          isNull(suppliers.deletedAt),
          sql`lower(${suppliers.name}) = lower(${name})`,
          exceptId ? ne(suppliers.id, exceptId) : undefined,
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException('A supplier with this name already exists');
    }
  }
}

export function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    phone: row.phone,
    contactPerson: row.contactPerson,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Postgres returns `numeric` unpadded, and `quantity * unit_price` comes back
 * with five decimals — three from the quantity, two from the price. Money is
 * two, and the extra digits are an artefact of the multiplication rather than
 * fractions of a piastre anyone owes.
 */
export function toMoneyString(value: string): string {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const thousandths = Math.round(Number(`0.${fraction || '0'}`) * 100);
  const carried = Number(whole) + Math.floor(thousandths / 100);

  return `${negative ? '-' : ''}${carried}.${String(thousandths % 100).padStart(2, '0')}`;
}
