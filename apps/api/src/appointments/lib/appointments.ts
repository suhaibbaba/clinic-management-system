import { appointments } from "@api/database/schema";
import {
  type CalendarQuery,
  addDays,
  type Appointment,
  type CalendarAppointment,
} from "@clinic/shared";
import { toPersonName } from "@api/common/person-name";

export type AppointmentRow = typeof appointments.$inferSelect;

export function hasSqlState(error: unknown, state: string): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === state
    ) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

export function calendarRangeStart(isoDate: string, range: CalendarQuery["range"]): string {
  if (range === "week") {
    return startOfWeek(isoDate);
  }

  return range === "month" ? `${isoDate.slice(0, 7)}-01` : isoDate;
}

export function calendarRangeEnd(from: string, range: CalendarQuery["range"]): string {
  if (range !== "month") {
    return addDays(from, range === "week" ? 7 : 1);
  }

  const [year = 0, month = 1] = from.split("-").map(Number);

  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

export function startOfWeek(isoDate: string): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));

  return addDays(isoDate, -at.getUTCDay());
}

export function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    doctorId: row.doctorId,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    endsAt: new Date(row.startsAt.getTime() + row.durationMinutes * 60_000).toISOString(),
    type: row.type,
    status: row.status,
    reason: row.reason,
    notes: row.notes,
    visitId: row.visitId,
    cancelledReason: row.cancelledReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CalendarRow {
  readonly appointment: AppointmentRow;
  readonly patientName: string;
  readonly patientFirstName: string;
  readonly patientLastName: string;
  readonly patientPhone: string;
  readonly patientFileNumber: string;
  readonly patientUnverified: boolean;
  readonly doctorNameAr: string;
  readonly doctorNameEn: string;
}

export function toCalendarAppointment(row: CalendarRow): CalendarAppointment {
  return {
    ...toAppointment(row.appointment),
    patientName: row.patientName,
    patientFirstName: row.patientFirstName,
    patientLastName: row.patientLastName,
    patientPhone: row.patientPhone,
    patientFileNumber: row.patientFileNumber,
    patientUnverified: row.patientUnverified,
    doctorName: toPersonName(row.doctorNameAr, row.doctorNameEn),
  };
}
