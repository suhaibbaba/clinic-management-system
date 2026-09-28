import { performedProcedures, chartMarks } from "@api/database/schema";
import { type ChartMark, type PerformedProcedure } from "@clinic/shared";

export type ProcedureRow = typeof performedProcedures.$inferSelect;

export type ChartMarkRow = typeof chartMarks.$inferSelect;

export function toChartMark(row: ChartMarkRow): ChartMark {
  return {
    id: row.id,
    clinicId: row.clinicId,
    performedProcedureId: row.performedProcedureId,
    chartType: row.chartType as ChartMark["chartType"],
    location: row.location,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProcedure(row: ProcedureRow, marks: ChartMark[] = []): PerformedProcedure {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    visitId: row.visitId,
    doctorId: row.doctorId,
    procedureId: row.procedureId,
    price: row.price,
    discount: row.discount,
    discountReason: row.discountReason,
    status: row.status,
    planItemId: row.planItemId,
    performedAt: row.performedAt.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    chartMarks: marks,
  };
}
