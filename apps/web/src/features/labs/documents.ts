import type { StatementQuery } from '@clinic/shared';

import { labOrdersApi, labsApi } from '@web/features/labs/api';

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
