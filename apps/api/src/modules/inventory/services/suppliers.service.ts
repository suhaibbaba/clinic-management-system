import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import { PermissionsService } from "@api/modules/permissions/services/permissions.service";
import {
  AUDIT_ACTION,
  RULE,
  STOCK_ERROR,
  addMoney,
  toMinorUnits,
  type CreateSupplierInput,
  type ListSuppliersQuery,
  type Paginated,
  type Supplier,
  type SupplierSummary,
  type UpdateSupplierInput,
} from "@clinic/shared";
import { and, eq, isNull, ne, or, sql, type SQL, desc } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { arabicNameSearch } from "@api/common/database/arabic-search";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { supplierOpeningBalances, suppliers } from "@api/database/schema";
import { AuditService } from "@api/modules/audit/services/audit.service";
import {
  SUPPLIER_OPENING_BALANCES_ENTITY,
  SUPPLIERS_ENTITY,
} from "@api/common/constants/audit-entities";
import {
  EMPTY_ACCOUNT,
  visibleAccount,
  toSupplier,
  SupplierAccount,
  SupplierRow,
  toAccount,
} from "@api/modules/inventory/lib/suppliers";
import { negate } from "@api/common/lib/money";

@Injectable()
export class SuppliersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
  ) {}

  seesCosts(actor: AuthenticatedUser): Promise<boolean> {
    return this.permissions.can(actor, RULE.INVENTORY_COSTS);
  }

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
    const byName = query.search ? arabicNameSearch(suppliers.normalizedName, query.search) : null;

    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(
        or(byName?.match, sql`coalesce(${suppliers.contactPerson}, '') ilike ${pattern}`),
      );
    }

    const where = this.scope.where(suppliers, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(suppliers)
        .where(where)
        .orderBy(...(byName ? [byName.rank, byName.closeness] : []), desc(suppliers.createdAt))
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

    const seesCosts = await this.seesCosts(actor);

    return toPaginated(
      rows.map((row) => ({
        ...toSupplier(row),
        ...visibleAccount(summaries.get(row.id) ?? EMPTY_ACCOUNT, seesCosts),
      })),
      totals?.value ?? 0,
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<SupplierSummary> {
    const row = await this.requireRow(actor.clinicId, id);
    const summary = await this.summarise(actor.clinicId, [id]);

    return {
      ...toSupplier(row),
      ...visibleAccount(summary.get(id) ?? EMPTY_ACCOUNT, await this.seesCosts(actor)),
    };
  }

  async assertSeesCosts(actor: AuthenticatedUser): Promise<void> {
    if (!(await this.seesCosts(actor))) {
      throw new ForbiddenException("Supplier accounts are not available to this role");
    }
  }

  async create(actor: AuthenticatedUser, input: CreateSupplierInput): Promise<Supplier> {
    await this.assertNameIsFree(actor.clinicId, input.name);

    if (input.openingBalance !== undefined) {
      await this.assertSeesCosts(actor);
    }

    return this.db.transaction(async (tx) => {
      const [row] = await tx
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

      if (!row) {
        throw new Error("Failed to create the supplier");
      }

      if (input.openingBalance !== undefined) {
        await this.setOpeningBalance(tx, actor, row.id, input.openingBalance);
      }

      return toSupplier(row);
    });
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateSupplierInput,
  ): Promise<Supplier> {
    await this.requireRow(actor.clinicId, id);

    if (input.openingBalance !== undefined) {
      await this.assertSeesCosts(actor);
    }

    if (input.name) {
      await this.assertNameIsFree(actor.clinicId, input.name, id);
    }

    return this.db.transaction(async (tx) => {
      const [row] = await tx
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

      if (!row) {
        throw new Error("Failed to update the supplier");
      }

      if (input.openingBalance !== undefined) {
        await this.setOpeningBalance(tx, actor, id, input.openingBalance);
      }

      return toSupplier(row);
    });
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    const account = (await this.summarise(actor.clinicId, [id])).get(id) ?? EMPTY_ACCOUNT;

    if (toMinorUnits(account.balance) !== 0) {
      throw new ConflictException(STOCK_ERROR.SUPPLIER_HAS_BALANCE);
    }

    await this.db
      .update(suppliers)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(suppliers, actor.clinicId, eq(suppliers.id, id)));
  }

  async requireRow(clinicId: string, id: string): Promise<SupplierRow> {
    return this.scope.findOneOrFail<SupplierRow>(suppliers, clinicId, id);
  }

  private async setOpeningBalance(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    supplierId: string,
    amount: string,
  ): Promise<void> {
    const standing = await tx
      .select()
      .from(supplierOpeningBalances)
      .where(
        and(
          eq(supplierOpeningBalances.clinicId, actor.clinicId),
          eq(supplierOpeningBalances.supplierId, supplierId),
          isNull(supplierOpeningBalances.reversesId),
          isNull(supplierOpeningBalances.reversedAt),
          isNull(supplierOpeningBalances.deletedAt),
        ),
      )
      .for("update");

    const current = standing.reduce((sum, row) => addMoney(sum, row.amount), "0.00");

    if (toMinorUnits(current) === toMinorUnits(amount)) {
      return;
    }

    const stamp = { createdBy: actor.id, updatedBy: actor.id };

    for (const row of standing) {
      await tx
        .update(supplierOpeningBalances)
        .set({ reversedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(supplierOpeningBalances.id, row.id));

      await tx.insert(supplierOpeningBalances).values({
        clinicId: actor.clinicId,
        supplierId,
        amount: negate(row.amount),
        reversesId: row.id,
        ...stamp,
      });
    }

    if (toMinorUnits(amount) !== 0) {
      await tx
        .insert(supplierOpeningBalances)
        .values({ clinicId: actor.clinicId, supplierId, amount, ...stamp });
    }

    await this.audit.record(
      {
        clinicId: actor.clinicId,
        userId: actor.id,
        action: AUDIT_ACTION.UPDATE,
        entity: SUPPLIER_OPENING_BALANCES_ENTITY,
        entityId: supplierId,
        oldValue: { openingBalance: current },
        newValue: { openingBalance: amount },
      },
      tx,
    );
  }

  private async summarise(
    clinicId: string,
    supplierIds: readonly string[],
  ): Promise<Map<string, SupplierAccount>> {
    if (supplierIds.length === 0) {
      return new Map();
    }

    const ids = sql.join(
      supplierIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

    const rows = await this.db.execute<{
      supplier_id: string;
      opening: string;
      purchased: string;
      paid: string;
      last_purchase_at: Date | string | null;
    }>(sql`
      with scoped as (select unnest(array[${ids}]) as supplier_id)
      select
        s.supplier_id::text as supplier_id,
        coalesce((
          select sum(amount) from supplier_opening_balances
          where clinic_id = ${clinicId} and supplier_id = s.supplier_id and deleted_at is null
        ), 0)::text as opening,
        coalesce((
          select round(sum(quantity * unit_price), 2) from stock_movements
          where clinic_id = ${clinicId} and supplier_id = s.supplier_id
            and type = 'purchase' and unit_price is not null
        ), 0)::text as purchased,
        coalesce((
          select sum(amount) from supplier_payments
          where clinic_id = ${clinicId} and supplier_id = s.supplier_id and deleted_at is null
        ), 0)::text as paid,
        (
          select max(created_at) from stock_movements
          where clinic_id = ${clinicId} and supplier_id = s.supplier_id
            and type = 'purchase' and reverses_id is null and reversed_at is null
        ) as last_purchase_at
      from scoped s
    `);

    return new Map(
      [...rows].map((row) => [
        row.supplier_id,
        toAccount(row.opening, row.purchased, row.paid, row.last_purchase_at),
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
      throw new ConflictException("A supplier with this name already exists");
    }
  }
}
