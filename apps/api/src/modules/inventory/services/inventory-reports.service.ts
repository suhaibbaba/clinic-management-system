import { Inject, Injectable } from "@nestjs/common";
import {
  MOVEMENT_TYPE,
  type InventoryAlerts,
  type ShoppingList,
  type StatementRangeQuery,
  type SupplierStatement,
} from "@clinic/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  inventoryItems,
  stockMovements,
  supplierOpeningBalances,
  supplierPayments,
  suppliers,
} from "@api/database/schema";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { byUrgency, byExpiry, toShoppingLine } from "@api/modules/inventory/lib/inventory-reports";
import {
  byOccurrence,
  ledgerStatement,
  openingLine,
  paymentLine,
  purchaseLine,
  SupplierLedgerLine,
} from "@api/modules/inventory/lib/supplier-ledger";

@Injectable()
export class InventoryReportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly items: InventoryItemsService,
    private readonly stock: StockService,
    private readonly suppliersService: SuppliersService,
  ) {}

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

  async supplierStatement(
    actor: AuthenticatedUser,
    supplierId: string,
    query: StatementRangeQuery,
  ): Promise<SupplierStatement> {
    const supplier = await this.suppliersService.requireRow(actor.clinicId, supplierId);

    await this.suppliersService.assertSeesCosts(actor);

    const [openingRows, purchaseRows, paymentRows] = await Promise.all([
      this.db
        .select()
        .from(supplierOpeningBalances)
        .where(
          and(
            eq(supplierOpeningBalances.clinicId, actor.clinicId),
            eq(supplierOpeningBalances.supplierId, supplierId),
            isNull(supplierOpeningBalances.deletedAt),
          ),
        ),
      this.db
        .select({
          movement: stockMovements,
          itemName: inventoryItems.name,
          unit: inventoryItems.unit,
        })
        .from(stockMovements)
        .innerJoin(inventoryItems, eq(inventoryItems.id, stockMovements.itemId))
        .where(
          and(
            eq(stockMovements.clinicId, actor.clinicId),
            eq(stockMovements.supplierId, supplierId),
            eq(stockMovements.type, MOVEMENT_TYPE.PURCHASE),
          ),
        ),
      this.db
        .select()
        .from(supplierPayments)
        .where(
          and(
            eq(supplierPayments.clinicId, actor.clinicId),
            eq(supplierPayments.supplierId, supplierId),
            isNull(supplierPayments.deletedAt),
          ),
        ),
    ]);

    const lines: SupplierLedgerLine[] = [
      ...openingRows.map((row) => openingLine(row)),
      ...purchaseRows.map(({ movement, itemName, unit }) => purchaseLine(movement, itemName, unit)),
      ...paymentRows.map((row) => paymentLine(row)),
    ].sort(byOccurrence);

    return ledgerStatement(
      { id: supplierId, name: supplier.name },
      lines,
      query.from ? new Date(query.from) : null,
      query.to ? new Date(query.to) : null,
    );
  }

  private async activeItems(
    clinicId: string,
  ): Promise<(typeof inventoryItems.$inferSelect & { supplierName: string | null })[]> {
    const rows = await this.db
      .select({ item: inventoryItems, supplierName: suppliers.name })
      .from(inventoryItems)
      .leftJoin(
        suppliers,
        and(eq(suppliers.id, inventoryItems.defaultSupplierId), isNull(suppliers.deletedAt)),
      )
      .where(
        and(
          eq(inventoryItems.clinicId, clinicId),
          isNull(inventoryItems.deletedAt),
          eq(inventoryItems.isActive, true),
        ),
      )
      .orderBy(asc(inventoryItems.name));

    return rows.map((row) => ({ ...row.item, supplierName: row.supplierName }));
  }
}
