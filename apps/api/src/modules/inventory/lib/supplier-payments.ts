import { supplierPayments } from "@api/database/schema";
import { type SupplierPayment } from "@clinic/shared";

export type SupplierPaymentRow = typeof supplierPayments.$inferSelect;

export function toSupplierPayment(row: SupplierPaymentRow): SupplierPayment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    supplierId: row.supplierId,
    movementId: row.movementId,
    amount: row.amount,
    method: row.method,
    note: row.note,
    reversesId: row.reversesId,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    paidBy: row.paidBy,
    createdAt: row.createdAt.toISOString(),
  };
}
