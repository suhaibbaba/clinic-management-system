import { labWorkTypes } from "@api/database/schema";
import { type LabWorkType } from "@clinic/shared";

export type WorkTypeRow = typeof labWorkTypes.$inferSelect;

export function toWorkType(row: WorkTypeRow): LabWorkType {
  return {
    id: row.id,
    labId: row.labId,
    name: row.name,
    defaultPrice: row.defaultPrice,
    isActive: row.isActive,
  };
}
