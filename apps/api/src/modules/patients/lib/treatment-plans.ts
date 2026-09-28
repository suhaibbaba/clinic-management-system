import { treatmentPlans, treatmentPlanItems } from "@api/database/schema";
import { type TreatmentPlanItem, type TreatmentPlan } from "@clinic/shared";

export type PlanRow = typeof treatmentPlans.$inferSelect;

export type PlanItemRow = typeof treatmentPlanItems.$inferSelect;

export function toPlanItem(row: PlanItemRow): TreatmentPlanItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    treatmentPlanId: row.treatmentPlanId,
    procedureId: row.procedureId,
    performerDoctorId: row.performerDoctorId,
    estimatedPrice: row.estimatedPrice,
    sortOrder: row.sortOrder,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPlan(row: PlanRow, items: TreatmentPlanItem[] = []): TreatmentPlan {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    title: row.title,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items,
  };
}
