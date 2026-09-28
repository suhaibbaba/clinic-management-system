import { waitingList } from "@api/database/schema";
import { minutesFromLocalMidnight, localDate, type WaitingListEntry } from "@clinic/shared";
import { toOptionalPersonName } from "@api/common/person-name";

export type WaitingListRow = typeof waitingList.$inferSelect;

export function timeIn(timeZone: string, at: Date): string {
  const minutes = minutesFromLocalMidnight(at, localDate(at, timeZone), timeZone);
  const hours = Math.floor(minutes / 60);

  return `${String(hours).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
}

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
