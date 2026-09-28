import { type PerformedProcedureStatus, PERFORMED_PROCEDURE_STATUS } from "@clinic/shared";

export const BILLABLE_STATUSES: readonly PerformedProcedureStatus[] = [
  PERFORMED_PROCEDURE_STATUS.IN_PROGRESS,
  PERFORMED_PROCEDURE_STATUS.DONE,
];
