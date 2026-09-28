import { prescriptions } from "@api/database/schema";
import { type Prescription } from "@clinic/shared";

export type PrescriptionRow = typeof prescriptions.$inferSelect;

export function toPrescription(row: PrescriptionRow): Prescription {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    visitId: row.visitId,
    doctorId: row.doctorId,
    items: row.items,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
