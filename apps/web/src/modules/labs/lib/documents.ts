import type { StatementQuery } from "@clinic/shared";
import { labOrdersApi, labsApi } from "@web/modules/labs/api";
import type { DocumentSource } from "@web/shared/lib/document-source";

export const labOrderSource = (
  orderId: string,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => labOrdersApi.sheetPdf(orderId),
  filename: `lab-order-${orderId}.pdf`,
  recipient,
  send: maySend ? (to) => labOrdersApi.sendSheet(orderId, to) : undefined,
});

export const labStatementSource = (
  labId: string,
  labName: string,
  query: StatementQuery,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => labsApi.statementPdf(labId, query),
  filename: `lab-statement-${labName}.pdf`,
  recipient,
  send: maySend ? (to) => labsApi.sendStatement(labId, query, to) : undefined,
});
