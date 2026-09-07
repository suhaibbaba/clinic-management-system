import type { StatementQuery } from '@clinic/shared';

import { labOrdersApi, labsApi } from '@web/features/labs/api';

/**
 * Opening a printed lab document.
 *
 * These endpoints need the bearer token, so the browser cannot follow a plain
 * link: the PDF is fetched, wrapped in an object URL and handed to a new tab,
 * where the built-in viewer prints it. Same approach as the receipts — see
 * `features/billing/documents.ts`.
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

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The order sheet: printed, put in the box, and sent with the model. */
export async function openLabOrderSheet(orderId: string): Promise<void> {
  await present(await labOrdersApi.sheetPdf(orderId), `lab-order-${orderId}.pdf`, false);
}

export async function downloadLabStatement(
  labId: string,
  labName: string,
  query: StatementQuery,
): Promise<void> {
  await present(await labsApi.statementPdf(labId, query), `lab-statement-${labName}.pdf`, true);
}
