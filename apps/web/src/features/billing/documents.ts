import type { StatementQuery } from '@clinic/shared';

import { billingApi } from '@web/features/billing/api';

/**
 * Opening a printed document.
 *
 * These endpoints need the bearer token, so the browser cannot follow a plain
 * link to them: the PDF is fetched, wrapped in an object URL and handed to a
 * new tab, where the built-in viewer prints it.
 */
async function present(blob: Blob, filename: string, download: boolean): Promise<void> {
  const url = URL.createObjectURL(blob);

  if (download) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } else {
    window.open(url, '_blank', 'noopener');
  }

  // Long enough for the tab or the download to take hold of the blob; the URL
  // would otherwise leak for the life of the page.
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
