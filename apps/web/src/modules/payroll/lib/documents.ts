import { payrollApi } from "@web/modules/payroll/api";
import type { DocumentSource } from "@web/shared/lib/document-source";

export const payrollSource = (month: string, maySend: boolean): DocumentSource => ({
  load: () => payrollApi.monthPdf(month),
  filename: `payroll-${month}.pdf`,
  recipient: null,
  send: maySend ? (to) => payrollApi.sendMonth(month, to) : undefined,
});
