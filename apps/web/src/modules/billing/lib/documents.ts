import { presentBlob, printBlob } from "@web/shared/lib/download";
import type { StatementQuery } from "@clinic/shared";
import { billingApi } from "@web/modules/billing/api";

export async function openReceipt(paymentId: string): Promise<void> {
  await presentBlob(await billingApi.receiptPdf(paymentId), `receipt-${paymentId}.pdf`, false);
}

export async function printStatement(patientId: string, query: StatementQuery): Promise<void> {
  await printBlob(await billingApi.statementPdf(patientId, query));
}
