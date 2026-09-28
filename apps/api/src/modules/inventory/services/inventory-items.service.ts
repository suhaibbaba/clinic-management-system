import { ConflictException, Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  LOOKUP_LIST,
  type CreateInventoryItemInput,
  type InventoryItem,
  type InventoryItemRow,
  type ItemBatches,
  type ListInventoryItemsQuery,
  type Paginated,
  type UpdateInventoryItemInput,
} from "@clinic/shared";
import { and, asc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { AuditSnapshotRegistry } from "@api/modules/audit/services/audit-snapshot.registry";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { toLimitOffset, toPaginated } from "@api/common/database/pagination";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { inventoryItems, suppliers } from "@api/database/schema";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { LookupsService } from "@api/modules/lookups/services/lookups.service";
import { INVENTORY_ITEMS_ENTITY } from "@api/modules/inventory/constants";
import { toInventoryItem, ItemRow, toItemRow } from "@api/modules/inventory/lib/inventory-items";

@Injectable()
export class InventoryItemsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly lookups: LookupsService,
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
      filters.push(sql`${inventoryItems.name} ilike ${pattern}`);
    }

    const where = this.scope.where(inventoryItems, actor.clinicId, ...filters);
    const { limit, offset } = toLimitOffset(query);
    const filtersOnStock = Boolean(query.low || query.expiring);

    const select = this.db
      .select({ item: inventoryItems, supplierName: suppliers.name })
      .from(inventoryItems)
      .leftJoin(
        suppliers,
        and(eq(suppliers.id, inventoryItems.defaultSupplierId), isNull(suppliers.deletedAt)),
      )
      .where(where)
      .orderBy(asc(inventoryItems.name))
      .$dynamic();

    if (filtersOnStock) {
      const items = await this.decorate(
        actor.clinicId,
        (await select).map((row) => ({ ...row.item, supplierName: row.supplierName })),
      );
      const filtered = items.filter(
        (item) =>
          (!query.low || item.isLow) && (!query.expiring || item.isExpiring || item.isExpired),
      );

      return toPaginated(filtered.slice(offset, offset + limit), filtered.length, query);
    }

    const [rows, [totals]] = await Promise.all([
      select.limit(limit).offset(offset),
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(inventoryItems)
        .where(where),
    ]);

    const items = await this.decorate(
      actor.clinicId,
      rows.map((row) => ({ ...row.item, supplierName: row.supplierName })),
    );

    return toPaginated(items, totals?.value ?? 0, query);
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<InventoryItemRow> {
    const row = await this.requireRow(actor.clinicId, id);
    const [supplier] = row.defaultSupplierId
      ? await this.db
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(and(eq(suppliers.id, row.defaultSupplierId), isNull(suppliers.deletedAt)))
          .limit(1)
      : [];

    const [item] = await this.decorate(actor.clinicId, [
      { ...row, supplierName: supplier?.name ?? null },
    ]);

    if (!item) {
      throw new Error("Failed to load the item");
    }

    return item;
  }

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
    await this.assertNameIsFree(actor.clinicId, input.name);
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.ITEM_CATEGORY, input.category);
    await this.lookups.assertCode(actor.clinicId, LOOKUP_LIST.ITEM_UNIT, input.unit);

    if (input.defaultSupplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.defaultSupplierId);
    }

    const [row] = await this.db
      .insert(inventoryItems)
      .values({
        clinicId: actor.clinicId,
        name: input.name,
        category: input.category,
        unit: input.unit,
        minQuantity: input.minQuantity ?? "0",
        defaultSupplierId: input.defaultSupplierId ?? null,
        notes: input.notes ?? null,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create the item");
    }

    return toInventoryItem(row);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateInventoryItemInput,
  ): Promise<InventoryItem> {
    await this.requireRow(actor.clinicId, id);

    if (input.name) {
      await this.assertNameIsFree(actor.clinicId, input.name, id);
    }
    await this.lookups.assertOptionalCode(
      actor.clinicId,
      LOOKUP_LIST.ITEM_CATEGORY,
      input.category,
    );
    if (input.defaultSupplierId) {
      await this.suppliersService.requireRow(actor.clinicId, input.defaultSupplierId);
    }

    const [row] = await this.db
      .update(inventoryItems)
      .set({
        ...(input.name !== undefined && { name: input.name }),
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

    if (!row) {
      throw new Error("Failed to update the item");
    }

    return toInventoryItem(row);
  }

  async softDelete(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.requireRow(actor.clinicId, id);

    await this.db
      .update(inventoryItems)
      .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id })
      .where(this.scope.where(inventoryItems, actor.clinicId, eq(inventoryItems.id, id)));
  }

  async requireRow(clinicId: string, id: string): Promise<ItemRow> {
    return this.scope.findOneOrFail<ItemRow>(inventoryItems, clinicId, id);
  }

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
          sql`lower(${inventoryItems.name}) = lower(${name})`,
          exceptId ? ne(inventoryItems.id, exceptId) : undefined,
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException("An item with this name already exists");
    }
  }
}
