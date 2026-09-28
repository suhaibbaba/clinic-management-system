import { specialties } from "@api/database/schema";
import { type Specialty } from "@clinic/shared";

export function toSpecialty(row: typeof specialties.$inferSelect): Specialty {
  return {
    id: row.id,
    clinicId: row.clinicId,
    code: row.code,
    name: row.name,
    chartType: row.chartType,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
