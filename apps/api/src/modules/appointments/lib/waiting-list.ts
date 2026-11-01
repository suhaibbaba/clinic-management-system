import { waitingList } from "@api/database/schema";
import { type LocalizedText, type WaitingListEntry } from "@clinic/shared";

export type WaitingListRow = typeof waitingList.$inferSelect;

export interface WaitingListJoinedRow {
  readonly entry: WaitingListRow;
  readonly patientName: string;
  readonly patientPhone: string;
  readonly doctorName: LocalizedText | null;
}

export function toWaitingListEntry(row: WaitingListJoinedRow): WaitingListEntry {
  return {
    id: row.entry.id,
    clinicId: row.entry.clinicId,
    patientId: row.entry.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    doctorId: row.entry.doctorId,
    doctorName: row.doctorName,
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
