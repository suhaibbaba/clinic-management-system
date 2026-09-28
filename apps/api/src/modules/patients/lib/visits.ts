import { visits } from "@api/database/schema";
import { type Visit } from "@clinic/shared";

export type VisitRow = typeof visits.$inferSelect;

export function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    visitDate: row.visitDate.toISOString(),
    complaint: row.complaint,
    examination: row.examination,
    diagnosis: row.diagnosis,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
