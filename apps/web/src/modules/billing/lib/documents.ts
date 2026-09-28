import { presentBlob } from "@web/shared/lib/download";
import type { StatementQuery } from "@clinic/shared";
import { billingApi } from "@web/modules/billing/api";

export async function openReceipt(paymentId: string): Promise<void> {
  await presentBlob(await billingApi.receiptPdf(paymentId), `receipt-${paymentId}.pdf`, false);
}

export async function downloadStatement(
  patientId: string,
  fileNumber: string,
  query: StatementQuery,
): Promise<void> {
  await presentBlob(
    await billingApi.statementPdf(patientId, query),
    `statement-${fileNumber}.pdf`,
    true,
  );
}
