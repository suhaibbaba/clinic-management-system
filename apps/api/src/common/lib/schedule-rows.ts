import { clinicClosures, doctorTimeOff } from "@api/database/schema";
import type { ClinicClosure, DoctorTimeOff } from "@clinic/shared";

export function toClinicClosure(row: typeof clinicClosures.$inferSelect): ClinicClosure {
  return {
    id: row.id,
    clinicId: row.clinicId,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    reason: row.reason,
    isAnnual: row.isAnnual,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDoctorTimeOff(row: typeof doctorTimeOff.$inferSelect): DoctorTimeOff {
  return {
    id: row.id,
    clinicId: row.clinicId,
    doctorId: row.doctorId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
