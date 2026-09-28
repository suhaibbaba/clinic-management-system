import { medicalHistories } from "@api/database/schema";
import { type MedicalHistory } from "@clinic/shared";

export type MedicalHistoryRow = typeof medicalHistories.$inferSelect;

export function toMedicalHistory(row: MedicalHistoryRow): MedicalHistory {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    chronicConditions: row.chronicConditions,
    allergies: row.allergies,
    currentMedications: row.currentMedications,
    isPregnant: row.isPregnant,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function emptyHistory(clinicId: string, patientId: string): MedicalHistory {
  const now = new Date().toISOString();

  return {
    id: "00000000-0000-4000-8000-000000000000",
    clinicId,
    patientId,
    chronicConditions: [],
    allergies: [],
    currentMedications: [],
    isPregnant: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}
