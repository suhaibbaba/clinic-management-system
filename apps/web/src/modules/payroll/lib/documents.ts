import type { SettlementQuery } from "@clinic/shared";
import { payrollApi } from "@web/modules/payroll/api";
import type { DocumentSource } from "@web/shared/lib/document-source";

export const payrollSource = (month: string, maySend: boolean): DocumentSource => ({
  load: () => payrollApi.monthPdf(month),
  filename: `payroll-${month}.pdf`,
  recipient: null,
  send: maySend ? (to) => payrollApi.sendMonth(month, to) : undefined,
});

export const settlementSource = (
  doctorId: string,
  query: SettlementQuery,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => payrollApi.settlementPdf(doctorId, query),
  filename: `settlement-${query.from}-${query.to}.pdf`,
  recipient,
  send: maySend ? (to) => payrollApi.sendSettlement(doctorId, query, to) : undefined,
});

export const payoutSource = (doctorId: string, payoutId: string): DocumentSource => ({
  load: () => payrollApi.payoutPdf(doctorId, payoutId),
  filename: `payout-${payoutId.slice(0, 8)}.pdf`,
});
