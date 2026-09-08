import { z } from 'zod';

import { paginationQuerySchema, uuidSchema } from '@shared/schemas/common';

/**
 * When the clinic is shut and when a doctor is away.
 *
 * Two tables rather than one, because the two answer different questions and
 * are edited by different people. A **clinic closure** is a whole day or a run
 * of whole days — Eid, a public holiday, the week the surgery is being
 * refitted — and it applies to everybody; nobody closes a practice from 14:00
 * to 18:00 and books the morning. **Doctor time off** is one person's, and it
 * is very often part of a day: an afternoon at a conference, a morning at the
 * hospital. Forcing both into one table would mean either a closure carrying
 * times nobody sets or time off carrying a doctor id that is usually null,
 * and the availability rules would then have to guess which kind a row is.
 *
 * Both are subtracted from availability by `AvailabilityService`, which is the
 * one place that decides whether a minute is bookable — the internal calendar
 * and the public booking page ask the same service (CLAUDE.md decision 6).
 */

/* -------------------------------------------------------------------------- */
/* Clinic closures                                                             */
/* -------------------------------------------------------------------------- */

export const clinicClosureSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  /** Inclusive first closed day, as a local calendar date. */
  startsOn: z.iso.date(),
  /** Inclusive last closed day. A one-day closure repeats the start. */
  endsOn: z.iso.date(),
  reason: z.string(),
  /**
   * Repeats on the same calendar day every year.
   *
   * For the fixed-date holidays a clinic would otherwise re-enter each
   * January — a national day, a new year. Movable feasts are not annual in
   * this sense and are entered per year, which is honest: their Gregorian
   * dates genuinely differ, and a checkbox claiming otherwise would close the
   * clinic on the wrong day.
   */
  isAnnual: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ClinicClosure = z.infer<typeof clinicClosureSchema>;

const closureWritableFields = {
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  reason: z.string().trim().min(2).max(200),
  isAnnual: z.boolean(),
};

/**
 * Ordered ends, checked here rather than in the service: a range that finishes
 * before it starts is a malformed request, not a business rule.
 */
const orderedDays = <T extends { startsOn?: string | undefined; endsOn?: string | undefined }>(
  input: T,
): boolean =>
  input.startsOn === undefined || input.endsOn === undefined || input.startsOn <= input.endsOn;

export const createClinicClosureSchema = z
  .object({
    ...closureWritableFields,
    isAnnual: z.boolean().default(false),
  })
  .refine(orderedDays, { message: 'endsOn must not be before startsOn', path: ['endsOn'] });
export type CreateClinicClosureInput = z.infer<typeof createClinicClosureSchema>;

export const updateClinicClosureSchema = z
  .object(closureWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')
  .refine(orderedDays, { message: 'endsOn must not be before startsOn', path: ['endsOn'] });
export type UpdateClinicClosureInput = z.infer<typeof updateClinicClosureSchema>;

export const listClinicClosuresQuerySchema = paginationQuerySchema.extend({
  /** Inclusive window, both ends optional. Defaults to everything. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type ListClinicClosuresQuery = z.infer<typeof listClinicClosuresQuerySchema>;

/* -------------------------------------------------------------------------- */
/* Doctor time off                                                             */
/* -------------------------------------------------------------------------- */

export const doctorTimeOffSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  doctorId: uuidSchema,
  /**
   * Absolute instants, half-open `[startsAt, endsAt)` — the same convention as
   * an appointment's own block, so the overlap test is one comparison rather
   * than a special case per shape.
   *
   * Whole days are expressed as local midnight to local midnight. There is no
   * `is_all_day` flag: it would be a second, redundant statement of what the
   * two instants already say, and the two could disagree.
   */
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type DoctorTimeOff = z.infer<typeof doctorTimeOffSchema>;

const timeOffWritableFields = {
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  reason: z.string().trim().min(2).max(200),
};

const orderedInstants = <T extends { startsAt?: string | undefined; endsAt?: string | undefined }>(
  input: T,
): boolean =>
  input.startsAt === undefined || input.endsAt === undefined || input.startsAt < input.endsAt;

export const createDoctorTimeOffSchema = z
  .object(timeOffWritableFields)
  .refine(orderedInstants, { message: 'endsAt must be after startsAt', path: ['endsAt'] });
export type CreateDoctorTimeOffInput = z.infer<typeof createDoctorTimeOffSchema>;

export const updateDoctorTimeOffSchema = z
  .object(timeOffWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided')
  .refine(orderedInstants, { message: 'endsAt must be after startsAt', path: ['endsAt'] });
export type UpdateDoctorTimeOffInput = z.infer<typeof updateDoctorTimeOffSchema>;

export const listDoctorTimeOffQuerySchema = paginationQuerySchema.extend({
  /** Half-open instant window; rows overlapping it are returned. */
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export type ListDoctorTimeOffQuery = z.infer<typeof listDoctorTimeOffQuerySchema>;

/* -------------------------------------------------------------------------- */
/* The conflict flow                                                           */
/* -------------------------------------------------------------------------- */

/**
 * What the caller has to decide before a closure or a time off is written.
 *
 * Both flags default to false, and the pair is deliberately two questions
 * rather than one: "shut the clinic anyway" and "cancel the appointments that
 * were in it" are separate decisions, and the second is not reversible in the
 * way the first is. A closure created with `force` and without
 * `cancelAppointments` leaves the appointments standing — reception rings
 * round and moves them by hand, which is what a practice usually does for
 * three patients it knows by name.
 */
export const scheduleConflictOptionsSchema = z.object({
  /** Write the row even though appointments fall inside it. */
  force: z.stringbool().default(false),
  /** Also cancel those appointments, notifying each patient. */
  cancelAppointments: z.stringbool().default(false),
});
export type ScheduleConflictOptions = z.infer<typeof scheduleConflictOptionsSchema>;

/** One appointment standing in the way, with the two names a dialog shows. */
export const conflictingAppointmentSchema = z.object({
  id: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  patientName: z.string(),
  patientPhone: z.string(),
  doctorId: uuidSchema,
});
export type ConflictingAppointment = z.infer<typeof conflictingAppointmentSchema>;

/**
 * The 409 body.
 *
 * `error` is `schedule_conflict`, which is what the web app matches on: Nest's
 * exception shape is `{ statusCode, message, error }` and Arabic wording is
 * resolved on the front end by code, never by a backend string (CLAUDE.md).
 */
export const SCHEDULE_CONFLICT_ERROR = 'schedule_conflict';

export const scheduleConflictSchema = z.object({
  statusCode: z.literal(409),
  error: z.literal(SCHEDULE_CONFLICT_ERROR),
  message: z.string(),
  appointments: z.array(conflictingAppointmentSchema),
});
export type ScheduleConflict = z.infer<typeof scheduleConflictSchema>;

/** Returned once a closure or time off is written, so the UI can report both. */
export const closureResultSchema = <TItem extends z.ZodTypeAny>(item: TItem) =>
  z.object({
    item,
    /** How many appointments were cancelled as part of the write. */
    cancelledAppointments: z.number().int().min(0),
  });

export const clinicClosureResultSchema = closureResultSchema(clinicClosureSchema);
export type ClinicClosureResult = z.infer<typeof clinicClosureResultSchema>;

export const doctorTimeOffResultSchema = closureResultSchema(doctorTimeOffSchema);
export type DoctorTimeOffResult = z.infer<typeof doctorTimeOffResultSchema>;

/**
 * The cancellation reason written onto every appointment a closure swept away.
 *
 * A code with the closure's own id in it rather than a sentence: the reason
 * column is read back by the UI and rendered in the reader's language, and it
 * has to say *which* closure did this — "the clinic was closed" is not
 * something reception can act on three weeks later.
 */
export const CLOSURE_CANCELLATION_PREFIX = 'closure:';
export const TIME_OFF_CANCELLATION_PREFIX = 'time_off:';

export const closureCancellationReason = (closureId: string): string =>
  `${CLOSURE_CANCELLATION_PREFIX}${closureId}`;

export const timeOffCancellationReason = (timeOffId: string): string =>
  `${TIME_OFF_CANCELLATION_PREFIX}${timeOffId}`;
