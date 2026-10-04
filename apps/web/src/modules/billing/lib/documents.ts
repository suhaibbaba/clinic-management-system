import type { StatementQuery } from "@clinic/shared";
import { billingApi } from "@web/modules/billing/api";
import type { DocumentSource } from "@web/shared/lib/document-source";
import { presentBlob } from "@web/shared/lib/download";

export async function openReceipt(paymentId: string): Promise<void> {
  await presentBlob(await billingApi.receiptPdf(paymentId), `receipt-${paymentId}.pdf`, false);
}

export const receiptSource = (
  paymentId: string,
  receiptNumber: number | null,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => billingApi.receiptPdf(paymentId),
  filename: `receipt-${receiptNumber ?? paymentId}.pdf`,
  recipient,
  send: maySend ? (to) => billingApi.sendReceipt(paymentId, to) : undefined,
});

export const statementSource = (
  patientId: string,
  query: StatementQuery,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => billingApi.statementPdf(patientId, query),
  filename: `statement-${patientId}.pdf`,
  recipient,
  send: maySend ? (to) => billingApi.sendStatement(patientId, query, to) : undefined,
});
