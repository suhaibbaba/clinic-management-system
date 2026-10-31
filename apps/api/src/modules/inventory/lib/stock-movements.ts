import { alias } from "drizzle-orm/pg-core";
import { stockMovements, users } from "@api/database/schema";
import { type StockMovement } from "@clinic/shared";
import { normalise } from "@api/modules/inventory/lib/stock";

export type MovementRow = typeof stockMovements.$inferSelect;

export const doctorUsers = alias(users, "doctor_users");

export function withoutCost<T extends { unitPrice?: string | null | undefined }>(
  movement: T,
  seesCosts: boolean,
): T {
  if (seesCosts) {
    return movement;
  }

  const { unitPrice: _, ...rest } = movement;
  return rest as T;
}

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
    doctorId: row.doctorId,
    performedProcedureId: row.performedProcedureId,
    reason: row.reason,
    reversesId: row.reversesId,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
