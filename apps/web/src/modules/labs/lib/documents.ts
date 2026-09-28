import { presentBlob } from "@web/shared/lib/download";
import type { StatementQuery } from "@clinic/shared";
import { labOrdersApi, labsApi } from "@web/modules/labs/api";

export async function openLabOrderSheet(orderId: string): Promise<void> {
  await presentBlob(await labOrdersApi.sheetPdf(orderId), `lab-order-${orderId}.pdf`, false);
}

export async function downloadLabStatement(
  labId: string,
  labName: string,
  query: StatementQuery,
): Promise<void> {
  await presentBlob(await labsApi.statementPdf(labId, query), `lab-statement-${labName}.pdf`, true);
}
