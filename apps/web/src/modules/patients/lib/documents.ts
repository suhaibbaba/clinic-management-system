import { patientsApi } from "@web/modules/patients/api";
import type { DocumentSource } from "@web/shared/lib/document-source";

export const treatmentPlanSource = (
  patientId: string,
  fileNumber: string | undefined,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => patientsApi.treatmentPlanPdf(patientId),
  filename: `treatment-plan-${fileNumber ?? patientId}.pdf`,
  recipient,
  send: maySend ? (to) => patientsApi.sendTreatmentPlan(patientId, to) : undefined,
});
