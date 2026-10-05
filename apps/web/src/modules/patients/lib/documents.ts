import { patientsApi } from "@web/modules/patients/api";
import type { DocumentSource } from "@web/shared/lib/document-source";

export const prescriptionSource = (
  prescriptionId: string,
  fileNumber: string | undefined,
  recipient: string | null | undefined,
  maySend: boolean,
): DocumentSource => ({
  load: () => patientsApi.prescriptionPdf(prescriptionId),
  filename: `prescription-${fileNumber ?? prescriptionId.slice(0, 8)}.pdf`,
  recipient,
  send: maySend ? (to) => patientsApi.sendPrescription(prescriptionId, to) : undefined,
});

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
