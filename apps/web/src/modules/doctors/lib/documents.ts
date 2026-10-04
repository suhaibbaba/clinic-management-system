import type { SettlementQuery } from "@clinic/shared";
import { doctorsApi } from "@web/modules/doctors/api";
import type { DocumentSource } from "@web/shared/lib/document-source";

export const settlementSource = (
  doctorId: string,
  query: SettlementQuery,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => doctorsApi.settlementPdf(doctorId, query),
  filename: `settlement-${query.from}-${query.to}.pdf`,
  recipient,
  send: maySend ? (to) => doctorsApi.sendSettlement(doctorId, query, to) : undefined,
});
