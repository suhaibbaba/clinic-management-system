import type { StatementQuery } from "@clinic/shared";
import { billingApi } from "@web/modules/billing/api";

async function present(blob: Blob, filename: string, download: boolean): Promise<void> {
  const url = URL.createObjectURL(blob);

  if (download) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  } else {
    window.open(url, "_blank", "noopener");
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openReceipt(paymentId: string): Promise<void> {
  await present(await billingApi.receiptPdf(paymentId), `receipt-${paymentId}.pdf`, false);
}

export async function downloadStatement(
  patientId: string,
  fileNumber: string,
  query: StatementQuery,
): Promise<void> {
  await present(
    await billingApi.statementPdf(patientId, query),
    `statement-${fileNumber}.pdf`,
    true,
  );
}
