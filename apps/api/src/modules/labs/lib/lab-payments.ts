import { labPayments } from "@api/database/schema";
import { type LabPayment } from "@clinic/shared";

export type PaymentRow = typeof labPayments.$inferSelect;

export function toLabPayment(row: PaymentRow): LabPayment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    labId: row.labId,
    amount: row.amount,
    method: row.method,
    note: row.note,
    reversesId: row.reversesId,
    paidBy: row.paidBy,
    createdAt: row.createdAt.toISOString(),
  };
}
