import { stockMovements } from "@api/database/schema";
import { type StockMovement } from "@clinic/shared";
import { normalise } from "@api/modules/inventory/lib/stock";

export type MovementRow = typeof stockMovements.$inferSelect;

export function toMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    clinicId: row.clinicId,
    itemId: row.itemId,
    type: row.type,
    quantity: normalise(row.quantity),
    unitPrice: row.unitPrice,
    expiryDate: row.expiryDate,
    batchNo: row.batchNo,
    supplierId: row.supplierId,
    patientId: row.patientId,
    performedProcedureId: row.performedProcedureId,
    reason: row.reason,
    reversesId: row.reversesId,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
