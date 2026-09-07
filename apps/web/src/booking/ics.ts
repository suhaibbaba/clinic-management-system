import type { ManagedBooking } from '@clinic/shared';

/**
 * "Add to calendar", without a calendar provider.
 *
 * An `.ics` file is the one thing every phone understands: iOS opens it in
 * Calendar, Android in whatever the user has, and nothing is sent anywhere. A
 * Google Calendar link would work on exactly one of those and would tell
 * Google when a named person has a dental appointment.
 *
 * Times are written in UTC (`…Z`), which is the only form that cannot be
 * misread — a floating local time would land an hour out for anyone whose
 * phone is not on the clinic's zone.
 */

const stamp = (at: Date): string =>
  `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}T${pad(
    at.getUTCHours(),
  )}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`;

const pad = (value: number): string => String(value).padStart(2, '0');

/** Commas, semicolons and newlines are structural in an ICS line. */
const escape = (value: string): string =>
  value.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, '\\n');

export function appointmentIcs(booking: ManagedBooking): string {
  const start = new Date(booking.startsAt);
  const end = new Date(start.getTime() + booking.durationMinutes * 60_000);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//clinic//booking//AR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    // Stable per appointment instant, so re-downloading updates the same event
    // rather than adding a second one.
    `UID:${stamp(start)}-${escape(booking.clinicName)}@clinic`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`${booking.clinicName} — ${booking.doctorName}`)}`,
    ...(booking.clinicPhone ? [`DESCRIPTION:${escape(booking.clinicPhone)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(booking.clinicName)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    // CRLF and a trailing newline: RFC 5545, and Outlook is strict about it.
  ].join('\r\n');
}

/** Hands the file to the browser and cleans up after itself. */
export function downloadIcs(booking: ManagedBooking, fileName = 'appointment.ics'): void {
  const blob = new Blob([appointmentIcs(booking)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();

  // Revoked on the next tick: Safari has not finished reading the blob when
  // `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
