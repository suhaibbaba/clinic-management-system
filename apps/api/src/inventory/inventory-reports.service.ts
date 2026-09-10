import { Inject, Injectable } from '@nestjs/common';
import {
  MOVEMENT_TYPE,
  compareQuantity,
  formatMinorUnits,
  formatThousandths,
  subtractQuantity,
  toMinorUnits,
  toThousandths,
  type InventoryAlerts,
  type InventoryItemRow,
  type ShoppingList,
  type ShoppingListLine,
  type StatementRangeQuery,
  type SupplierStatement,
  type SupplierStatementLine,
} from '@clinic/shared';
import { and, asc, eq, gte, isNull, lt, type SQL } from 'drizzle-orm';

import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { DATABASE, type Database } from '@api/database/database.module';
import { inventoryItems, stockMovements, suppliers } from '@api/database/schema';
import { InventoryItemsService } from '@api/inventory/inventory-items.service';
import { StockService } from '@api/inventory/stock.service';
import { SuppliersService } from '@api/inventory/suppliers.service';

// All three read the same computed stock as the items screen: one definition of "low" and one of
// "expiring", in `StockService`.
@Injectable()
export class InventoryReportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly stock: StockService,
    private readonly suppliersService: SuppliersService,
  ) {}

  // Whole lists rather than a page: "5 items are low (of the first 20 checked)" is worse than no
  // alert. Active items only.
  async alerts(actor: AuthenticatedUser): Promise<InventoryAlerts> {
    const warningDays = await this.stock.expiryWarningDays(actor.clinicId);
    const rows = await this.activeItems(actor.clinicId);
    const decorated = await this.items.decorate(actor.clinicId, rows, warningDays);

    return {
      expiryWarningDays: warningDays,
      low: decorated.filter((item) => item.isLow).sort(byUrgency),
      expiring: decorated.filter((item) => item.isExpiring).sort(byExpiry),
      expired: decorated.filter((item) => item.isExpired).sort(byExpiry),
    };
  }

  async shoppingList(actor: AuthenticatedUser): Promise<ShoppingList> {
    const { low } = await this.alerts(actor);

    return {
      generatedAt: new Date().toISOString(),
      lines: low.map(toShoppingLine),
    };
  }

  // Purchases only, and a line with no price still appears — the clinic did buy it, and dropping
  // the line would hide the purchase as well.
  async supplierStatement(
    actor: AuthenticatedUser,
    supplierId: string,
    query: StatementRangeQuery,
  ): Promise<SupplierStatement> {
    const supplier = await this.suppliersService.requireRow(actor.clinicId, supplierId);

    const filters: (SQL | undefined)[] = [
      eq(stockMovements.clinicId, actor.clinicId),
      eq(stockMovements.supplierId, supplierId),
      eq(stockMovements.type, MOVEMENT_TYPE.PURCHASE),
    ];

    if (query.from) {
      filters.push(gte(stockMovements.createdAt, new Date(query.from)));
    }
    if (query.to) {
      filters.push(lt(stockMovements.createdAt, new Date(query.to)));
    }

    const rows = await this.db
      .select({
        movement: stockMovements,
        itemName: inventoryItems.nameAr,
        unit: inventoryItems.unit,
      })
      .from(stockMovements)
      .innerJoin(inventoryItems, eq(inventoryItems.id, stockMovements.itemId))
      .where(and(...filters))
      .orderBy(asc(stockMovements.createdAt));

    const lines: SupplierStatementLine[] = rows.map(({ movement, itemName, unit }) => ({
      movementId: movement.id,
      occurredAt: movement.createdAt.toISOString(),
      itemId: movement.itemId,
      itemName,
      unit,
      quantity: formatThousandths(toThousandths(movement.quantity)),
      unitPrice: movement.unitPrice,
      total: movement.unitPrice === null ? null : lineTotal(movement.quantity, movement.unitPrice),
      batchNo: movement.batchNo,
      // A returned delivery is a negative purchase against the same supplier.
      isReversal: movement.reversesId !== null,
    }));

    const total = lines.reduce(
      (sum, line) => sum + (line.total === null ? 0 : toMinorUnits(line.total)),
      0,
    );

    return {
      supplierId,
      supplierName: supplier.name,
      from: query.from ?? null,
      to: query.to ?? null,
      total: formatMinorUnits(total),
      lines,
    };
  }

  private async activeItems(
    clinicId: string,
  ): Promise<(typeof inventoryItems.$inferSelect & { supplierName: string | null })[]> {
    const rows = await this.db
      .select({ item: inventoryItems, supplierName: suppliers.name })
      .from(inventoryItems)
      .leftJoin(suppliers, eq(suppliers.id, inventoryItems.defaultSupplierId))
      .where(
        and(
          eq(inventoryItems.clinicId, clinicId),
          isNull(inventoryItems.deletedAt),
          eq(inventoryItems.isActive, true),
        ),
      )
      .orderBy(asc(inventoryItems.nameAr));

    return rows.map((row) => ({ ...row.item, supplierName: row.supplierName }));
  }
}

/** How short of its minimum an item is — the emptiest cupboard first. */
function byUrgency(left: InventoryItemRow, right: InventoryItemRow): number {
  const shortfall = (item: InventoryItemRow): number =>
    toThousandths(item.minQuantity) - toThousandths(item.quantity);

  return shortfall(right) - shortfall(left);
}

/** Soonest to go off first — that is the order somebody works through them. */
function byExpiry(left: InventoryItemRow, right: InventoryItemRow): number {
  return (left.nearestExpiry ?? '9999-12-31').localeCompare(right.nearestExpiry ?? '9999-12-31');
}

function toShoppingLine(item: InventoryItemRow): ShoppingListLine {
  const target = formatThousandths(toThousandths(item.minQuantity) * 2);
  const suggested = subtractQuantity(target, item.quantity);

  return {
    itemId: item.id,
    nameAr: item.nameAr,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    // A count below zero would otherwise suggest buying more than twice the minimum; the count is
    // what is wrong, and a shopping list is not the place to argue.
    suggested: compareQuantity(suggested, '0') > 0 ? suggested : '0',
    supplierName: item.supplierName,
  };
}

// Thousandths times cents is millionths, so it is rounded back to cents once at the end: 2.5 at
// 3.33 is 8.33, not 8.32.
function lineTotal(quantity: string, unitPrice: string): string {
  const millionths = toThousandths(quantity) * toMinorUnits(unitPrice);

  return formatMinorUnits(Math.round(millionths / 1000));
}
