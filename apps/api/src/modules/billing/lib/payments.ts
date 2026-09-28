import { payments, clinicCounters } from "@api/database/schema";
import { type DatabaseExecutor } from "@api/database/database.module";
import { sql, eq } from "drizzle-orm";
import { LedgerService } from "@api/modules/billing/services/ledger.service";
import { toMinorUnits, PAYMENT_ERROR, type Payment } from "@clinic/shared";
import { ConflictException } from "@nestjs/common";

export type PaymentRow = typeof payments.$inferSelect;

export async function assertWithinBalance(
  tx: DatabaseExecutor,
  clinicId: string,
  patientId: string,
  amount: string,
): Promise<void> {
  const [row] = await tx.execute<{ balance: string }>(
    sql`select ${LedgerService.balanceOf(clinicId, patientId)}::text as balance`,
  );

  if (toMinorUnits(amount) > toMinorUnits(row?.balance ?? "0")) {
    throw new ConflictException(PAYMENT_ERROR.EXCEEDS_BALANCE);
  }
}

export async function nextReceiptNumber(tx: DatabaseExecutor, clinicId: string): Promise<number> {
  await tx
    .insert(clinicCounters)
    .values({ clinicId })
    .onConflictDoNothing({ target: clinicCounters.clinicId });

  const [row] = await tx
    .update(clinicCounters)
    .set({ nextReceiptNumber: sql`${clinicCounters.nextReceiptNumber} + 1`, updatedAt: new Date() })
    .where(eq(clinicCounters.clinicId, clinicId))
    .returning({ next: clinicCounters.nextReceiptNumber });

  if (!row) {
    throw new Error("Failed to allocate a receipt number");
  }

  return row.next - 1;
}

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    amount: row.amount,
    method: row.method,
    note: row.note,
    receiptNumber: row.receiptNumber,
    reversesId: row.reversesId,
    receivedBy: row.receivedBy,
    createdAt: row.createdAt.toISOString(),
  };
}
