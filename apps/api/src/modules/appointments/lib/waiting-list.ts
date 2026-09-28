import { waitingList } from "@api/database/schema";
import { type WaitingListEntry } from "@clinic/shared";
import { toOptionalPersonName } from "@api/common/person-name";

export type WaitingListRow = typeof waitingList.$inferSelect;

export interface WaitingListJoinedRow {
  readonly entry: WaitingListRow;
  readonly patientName: string;
  readonly patientPhone: string;
  readonly doctorNameAr: string | null;
  readonly doctorNameEn: string | null;
}

export function toWaitingListEntry(row: WaitingListJoinedRow): WaitingListEntry {
  return {
    id: row.entry.id,
    clinicId: row.entry.clinicId,
    patientId: row.entry.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    doctorId: row.entry.doctorId,
    doctorName: toOptionalPersonName(row.doctorNameAr, row.doctorNameEn),
    reason: row.entry.reason,
    priority: row.entry.priority,
    source: row.entry.source,
    status: row.entry.status,
    declinedReason: row.entry.declinedReason,
    resolvedAt: row.entry.resolvedAt?.toISOString() ?? null,
    appointmentId: row.entry.appointmentId,
    createdAt: row.entry.createdAt.toISOString(),
    updatedAt: row.entry.updatedAt.toISOString(),
  };
}
