import { performedProcedures, treatmentPlans } from "@api/database/schema";
import {
  PERFORMED_PROCEDURE_STATUS,
  type TreatmentPlan,
  type TreatmentPlanSummary,
} from "@clinic/shared";
import { sql } from "drizzle-orm";

export type PlanRow = typeof treatmentPlans.$inferSelect;

export type PlanSummaryRow = TreatmentPlanSummary;

export const EMPTY_PLAN_SUMMARY: TreatmentPlanSummary = {
  total: "0.00",
  done: "0.00",
  remaining: "0.00",
  treatments: 0,
  completed: 0,
};

const net = sql`${performedProcedures.price} - ${performedProcedures.discount}`;
const live = sql`${performedProcedures.status} <> ${PERFORMED_PROCEDURE_STATUS.CANCELLED}`;
const done = sql`${performedProcedures.status} = ${PERFORMED_PROCEDURE_STATUS.DONE}`;

export const planSummaryColumns = {
  total: sql<string>`coalesce(sum(${net}) filter (where ${live}), 0)::numeric(10,2)::text`,
  done: sql<string>`coalesce(sum(${net}) filter (where ${done}), 0)::numeric(10,2)::text`,
  remaining: sql<string>`coalesce(sum(${net}) filter (where ${live} and not (${done})), 0)::numeric(10,2)::text`,
  treatments: sql<number>`(count(*) filter (where ${live}))::int`,
  completed: sql<number>`(count(*) filter (where ${done}))::int`,
};

export function toPlan(row: PlanRow, summary: TreatmentPlanSummary): TreatmentPlan {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    title: row.title,
    status: row.status,
    notes: row.notes,
    summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
