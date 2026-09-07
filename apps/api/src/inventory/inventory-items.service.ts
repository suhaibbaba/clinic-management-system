import { ConflictException, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  type CreateInventoryItemInput,
  type InventoryItem,
  type InventoryItemRow,
  type ItemBatches,
  type ListInventoryItemsQuery,
  type Paginated,
  type UpdateInventoryItemInput,
} from '@clinic/shared';
import { and, asc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';

import { AuditSnapshotRegistry } from '@api/audit/audit-snapshot.registry';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { toLimitOffset, toPaginated } from '@api/common/database/pagination';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { inventoryItems, suppliers } from '@api/database/schema';
import { isLowStock, normalise, StockService, type ItemStock } from '@api/inventory/stock.service';
import { SuppliersService } from '@api/inventory/suppliers.service';

type ItemRow = typeof inventoryItems.$inferSelect;

export const INVENTORY_ITEMS_ENTITY = 'inventory_items';

/**
 * The cupboard's contents.
 *
 * An item row is half stored and half computed: the name, category, unit and
 * reorder level are columns somebody edits, and the quantity, the expiry dates
 * and the three flags come from the ledger every time they are read. Nothing
 * here can be typed into except the target — which is the whole point of the
 * ledger pattern (CLAUDE.md).
 */
@Injectable()
export class InventoryItemsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scope: ClinicScopeService,
    private readonly stock: StockService,
    private readonly suppliersService: SuppliersService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
  ) {}

  onModuleInit(): void {
    this.auditSnapshots.register(INVENTORY_ITEMS_ENTITY, async (id, clinicId) => {
      const [row] = await this.db
        .select()
        .from(inventoryItems)
        .where(this.scope.where(inventoryItems, clinicId, eq(inventoryItems.id, id)))
        .limit(1);

      return row ? { ...toInventoryItem(row) } : null;
    });
  }

  /**
   * The items screen.
   *
   * The `low` and `expiring` filters are applied **after** the stock is
   * computed rather than in SQL: both depend on numbers that do not exist in
   * any column, and re-deriving them in a `where` clause would be the same
   * rule written twice. The cost is that a filtered page is a page of the
   * matching rows out of that page — which is why the filters raise the page
   * size rather than paginating a filtered set, and why the alerts endpoint
   * exists for the case where somebody wants the whole list of what is low.
   */
  async list(
    actor: AuthenticatedUser,
    query: ListInventoryItemsQuery,
  ): Promise<Paginated<InventoryItemRow>> {
    const filters: (SQL | undefined)[] = [];

    if (!query.includeInactive) {
      filters.push(eq(inventoryItems.isActive, true));
    }
    if (query.category) {
      filters.push(eq(inventoryItems.category, query.category));
    }
    if (query.supplierId) {
      filters.push(eq(inventoryItems.defaultSupplierId, query.supplierId));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      filters.push(sql`${inventoryItems.nameAr} ilike ${pattern}`);
    }

    const where = this.scope.where(inventoryItems, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);

    const [rows, [totals]] = await Promise.all([
      this.db
        .select({ item: inventoryItems, supplierName: suppliers.name })
        .from(inventoryItems)
        .leftJoin(suppliers, eq(suppliers.id, inventoryItems.defaultSupplierId))
        .where(where)
        .orderBy(asc(inventoryItems.nameAr))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(inventoryItems)
        .where(where),
    ]);

    const items = await this.decorate(
      actor.clinicId,
      rows.map((row) => ({ ...row.item, supplierName: row.supplierName })),
    );

    const filtered = items.filter(
      (item) =>
        (!query.low || item.isLow) && (!query.expiring || item.isExpiring || item.isExpired),
    );

    // The total counts what the database matched; a stock filter narrows the
    // page in front of you and says so by returning fewer rows than the total.
    return toPaginated(
      filtered,
      query.low || query.expiring ? filtered.length : (totals?.value ?? 0),
      query,
    );
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<InventoryItemRow> {
    const row = await this.requireRow(actor.clinicId, id);
    const [supplier] = row.defaultSupplierId
      ? await this.db
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(eq(suppliers.id, row.defaultSupplierId))
          .limit(1)
      : [];

    const [item] = await this.decorate(actor.clinicId, [
      { ...row, supplierName: supplier?.name ?? null },
    ]);

    /* istanbul ignore next -- decorate returns one row per row it is given. */
    if (!item) {
      throw new Error('Failed to load the item');
    }

    return item;
  }

  /** The batch breakdown behind one item — derived, never stored. */
  async batches(actor: AuthenticatedUser, id: string): Promise<ItemBatches> {
    await this.requireRow(actor.clinicId, id);

    const warningDays = await this.stock.expiryWarningDays(actor.clinicId);
    const stock = await this.stock.forItem(actor.clinicId, id, warningDays);

    return {
      itemId: id,
      quantity: stock.quantity,
      unbatched: stock.unbatched,
      batches: stock.batches,
    };
  }

  async create(actor: AuthenticatedUser, input: CreateInventoryItemInput): Promise<InventoryItem> {
    await this.assertNameIsFree(actor.clinicId, input.nameAr);

    if (input.defaultSupplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.defaultSupplierId);
    }

    const [row] = await this.db
      .insert(inventoryItems)
      .values({
        clinicId: actor.clinicId,
        nameAr: input.nameAr,
        category: input.category,
        unit: input.unit,
        minQuantity: input.minQuantity ?? '0',
        defaultSupplierId: input.defaultSupplierId ?? null,
        notes: input.notes ?? null,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    /* istanbul ignore next -- insert ... returning always yields a row. */
    if (!row) {
      throw new Error('Failed to create the item');
    }

    return toInventoryItem(row);
  }

  /**
   * The unit is not here, and that is deliberate: the update schema omits it,
   * because changing it would reinterpret every movement already recorded.
   */
  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateInventoryItemInput,
  ): Promise<InventoryItem> {
    await this.requireRow(actor.clinicId, id);

    if (input.nameAr) {
      await this.assertNameIsFree(actor.clinicId, input.nameAr, id);
    }
    if (input.defaultSupplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.defaultSupplierId);
    }

    const [row] = await this.db
      .update(inventoryItems)
      .set({
        ...(input.nameAr !== undefined && { nameAr: input.nameAr }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.minQuantity !== undefined && { minQuantity: input.minQuantity }),
        ...(input.defaultSupplierId !== undefined && {
          defaultSupplierId: input.defaultSupplierId ?? null,
        }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(this.scope.where(inventoryItems, actor.clinicId, eq(inventoryItems.id, id)))
      .returning();

    /* istanbul ignore next -- the row was just read under the same scope. */
    if (!row) {
      throw new Error('Failed to update the item');
    }

    return toInventoryItem(row);
  }

  /** Soft delete. The ledger behind it is untouched and still adds up. */
  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(inventoryItems)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(inventoryItems, actor.clinicId, eq(inventoryItems.id, id)));
  }

  /** Used by the movements service, which must not accept an item from elsewhere. */
  async requireRow(clinicId: string, id: string): Promise<ItemRow> {
    return this.scope.findOneOrFail<ItemRow>(inventoryItems, clinicId, id);
  }

  /** Rows plus everything the ledger says about them. Used by every read here. */
  async decorate(
    clinicId: string,
    rows: readonly (ItemRow & { supplierName: string | null })[],
    warningDaysOverride?: number,
  ): Promise<InventoryItemRow[]> {
    if (rows.length === 0) {
      return [];
    }

    const warningDays = warningDaysOverride ?? (await this.stock.expiryWarningDays(clinicId));
    const stock = await this.stock.forItems(
      clinicId,
      rows.map((row) => row.id),
      warningDays,
    );

    return rows.map((row) => toItemRow(row, row.supplierName, stock.get(row.id)));
  }

  private async assertNameIsFree(clinicId: string, name: string, exceptId?: string): Promise<void> {
    const [clash] = await this.db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.clinicId, clinicId),
          isNull(inventoryItems.deletedAt),
          sql`lower(${inventoryItems.nameAr}) = lower(${name})`,
          exceptId ? ne(inventoryItems.id, exceptId) : undefined,
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException('An item with this name already exists');
    }
  }
}

export function toInventoryItem(row: ItemRow): InventoryItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    nameAr: row.nameAr,
    category: row.category,
    unit: row.unit,
    // `numeric` comes back with its scale attached (`5.000`); a reorder level
    // reads as a level, not as a measurement taken to the milligram.
    minQuantity: normalise(row.minQuantity),
    defaultSupplierId: row.defaultSupplierId,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toItemRow(
  row: ItemRow,
  supplierName: string | null,
  stock: ItemStock | undefined,
): InventoryItemRow {
  const quantity = stock?.quantity ?? '0';

  return {
    ...toInventoryItem(row),
    quantity,
    supplierName,
    isLow: isLowStock(quantity, row.minQuantity),
    isExpiring: stock?.isExpiring ?? false,
    isExpired: stock?.isExpired ?? false,
    nearestExpiry: stock?.nearestExpiry ?? null,
  };
}
