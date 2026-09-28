import { doctorExtraHours } from "@api/database/schema";
import { type DoctorExtraHours } from "@clinic/shared";

export type ExtraHoursRow = typeof doctorExtraHours.$inferSelect;

export function toDoctorExtraHours(row: ExtraHoursRow): DoctorExtraHours {
  return {
    id: row.id,
    clinicId: row.clinicId,
    doctorId: row.doctorId,
    date: row.date,
    ranges: row.ranges,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
