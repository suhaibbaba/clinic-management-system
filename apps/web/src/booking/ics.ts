import type { ManagedBooking } from "@clinic/shared";
import { bookingName } from "@web/booking/format";

const stamp = (at: Date): string =>
  `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(
    at.getUTCHours(),
  )}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`;

const pad = (value: number): string => String(value).padStart(2, "0");

const escape = (value: string): string =>
  value.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");

export function appointmentIcs(booking: ManagedBooking): string {
  const start = new Date(booking.startsAt);
  const end = new Date(start.getTime() + booking.durationMinutes * 60_000);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//clinic//booking//AR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-${escape(bookingName(booking.clinicName))}@clinic`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${bookingName(booking.clinicName)} — ${bookingName(booking.doctorName)}`)}`,
    ...(booking.clinicPhone ? [`DESCRIPTION:${escape(booking.clinicPhone)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(bookingName(booking.clinicName))}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(booking: ManagedBooking, fileName = "appointment.ics"): void {
  const blob = new Blob([appointmentIcs(booking)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
