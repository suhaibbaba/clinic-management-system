import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_TIME_ZONE,
  formatMinorUnits,
  formatThousandths,
  localDate,
  toMinorUnits,
  toThousandths,
  type MovementType,
} from "@clinic/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database, type DatabaseExecutor } from "@api/database/database.module";
import { inventoryItems, stockMovements } from "@api/database/schema";
import { type CostLayers } from "@api/modules/inventory/lib/costing";
import { type MovementRow } from "@api/modules/inventory/lib/stock-movements";

export interface LedgerEntry {
  readonly itemId: string;
  readonly type: MovementType;
  readonly quantity: number;
  readonly value: number;
  readonly unknown: number;
  readonly unitPrice?: string | null;
  readonly supplierId?: string | null;
  readonly patientId?: string | null;
  readonly doctorId?: string | null;
  readonly performedProcedureId?: string | null;
  readonly batchNo?: string | null;
  readonly expiryDate?: string | null;
  readonly reason?: string | null;
  readonly reasonCode?: string | null;
  readonly requestId?: string | null;
  readonly receiptLineId?: string | null;
  readonly occurredOn?: string;
}

@Injectable()
export class StockLedgerService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async lockItems(
    tx: DatabaseExecutor,
    clinicId: string,
    itemIds: readonly string[],
  ): Promise<void> {
    const ids = [...new Set(itemIds)].sort();

    if (ids.length === 0) {
      return;
    }

    const locked = await tx
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.clinicId, clinicId), inArray(inventoryItems.id, ids)))
      .orderBy(inventoryItems.id)
      .for("update");

    if (locked.length !== ids.length) {
      throw new NotFoundException("Resource not found");
    }
  }

  async layers(tx: DatabaseExecutor, clinicId: string, itemId: string): Promise<CostLayers> {
    const [row] = await tx
      .select({
        onHand: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text`,
        unknown: sql<string>`coalesce(sum(${stockMovements.unknownQuantity}), 0)::text`,
        knownValue: sql<string>`coalesce(sum(${stockMovements.value}), 0)::text`,
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.clinicId, clinicId), eq(stockMovements.itemId, itemId)));

    return {
      onHand: toThousandths(row?.onHand ?? "0"),
      unknown: toThousandths(row?.unknown ?? "0"),
      knownValue: toMinorUnits(row?.knownValue ?? "0"),
    };
  }

  async insert(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    entry: LedgerEntry,
  ): Promise<MovementRow> {
    const [row] = await tx
      .insert(stockMovements)
      .values({
        clinicId: actor.clinicId,
        itemId: entry.itemId,
        type: entry.type,
        quantity: formatThousandths(entry.quantity),
        value: formatMinorUnits(entry.value),
        unknownQuantity: formatThousandths(entry.unknown),
        unitPrice: entry.unitPrice ?? null,
        supplierId: entry.supplierId ?? null,
        patientId: entry.patientId ?? null,
        doctorId: entry.doctorId ?? null,
        performedProcedureId: entry.performedProcedureId ?? null,
        batchNo: entry.batchNo ?? null,
        expiryDate: entry.expiryDate ?? null,
        reason: entry.reason ?? null,
        reasonCode: entry.reasonCode ?? null,
        requestId: entry.requestId ?? null,
        receiptLineId: entry.receiptLineId ?? null,
        occurredOn: entry.occurredOn ?? localDate(new Date(), DEFAULT_TIME_ZONE),
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the movement");
    }

    return row;
  }

  async reverse(
    tx: DatabaseExecutor,
    actor: AuthenticatedUser,
    original: MovementRow,
    reason: string,
  ): Promise<MovementRow> {
    await tx
      .update(stockMovements)
      .set({ reversedAt: new Date() })
      .where(eq(stockMovements.id, original.id));

    const [row] = await tx
      .insert(stockMovements)
      .values({
        clinicId: original.clinicId,
        itemId: original.itemId,
        type: original.type,
        quantity: formatThousandths(-toThousandths(original.quantity)),
        value: formatMinorUnits(-toMinorUnits(original.value)),
        unknownQuantity: formatThousandths(-toThousandths(original.unknownQuantity)),
        unitPrice: original.unitPrice,
        batchNo: original.batchNo,
        expiryDate: original.expiryDate,
        supplierId: original.supplierId,
        patientId: original.patientId,
        doctorId: original.doctorId,
        performedProcedureId: original.performedProcedureId,
        receiptLineId: original.receiptLineId,
        reasonCode: original.reasonCode,
        reason,
        reversesId: original.id,
        createdBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to reverse the movement");
    }

    return row;
  }

  find(clinicId: string, id: string, tx: DatabaseExecutor = this.db) {
    return tx
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.id, id), eq(stockMovements.clinicId, clinicId)))
      .limit(1)
      .then(([row]) => row);
  }
}
