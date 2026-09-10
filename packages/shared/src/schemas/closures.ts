import { z } from 'zod';

import { paginationQuerySchema, uuidSchema } from '@shared/schemas/common';

// A clinic closure is whole days for everybody; doctor time off is one person's and often part of a
// day. Both are subtracted by `AvailabilityService`, the only place that decides.

export const clinicClosureSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  /** Inclusive first closed day, as a local calendar date. */
  startsOn: z.iso.date(),
  /** Inclusive last closed day. A one-day closure repeats the start. */
  endsOn: z.iso.date(),
  reason: z.string(),
  // Fixed-date holidays only — a movable feast falls on a different Gregorian day each year and is
  // entered per year.
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

// Checked here rather than in the service: a range that finishes before it starts is a malformed
// request, not a business rule.
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

export const doctorTimeOffSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  doctorId: uuidSchema,
  // Half-open `[startsAt, endsAt)` like an appointment's block, whole days as local midnight to
  // midnight — no `is_all_day` flag to disagree with them.
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

// Two questions, not one: `force` writes it anyway, `cancelAppointments` cancels them — and only
// the first is reversible.
export const scheduleConflictOptionsSchema = z.object({
  /** Write the row even though appointments fall inside it. */
  force: z.stringbool().default(false),
  /** Also cancel those appointments, notifying each patient. */
  cancelAppointments: z.stringbool().default(false),
});
export type ScheduleConflictOptions = z.infer<typeof scheduleConflictOptionsSchema>;

export const conflictingAppointmentSchema = z.object({
  id: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  patientName: z.string(),
  patientPhone: z.string(),
  doctorId: uuidSchema,
});
export type ConflictingAppointment = z.infer<typeof conflictingAppointmentSchema>;

// `error` is `schedule_conflict`, which is what the web app matches on — Arabic wording is resolved
// on the front end by code.
export const SCHEDULE_CONFLICT_ERROR = 'schedule_conflict';

export const scheduleConflictSchema = z.object({
  statusCode: z.literal(409),
  error: z.literal(SCHEDULE_CONFLICT_ERROR),
  message: z.string(),
  appointments: z.array(conflictingAppointmentSchema),
});
export type ScheduleConflict = z.infer<typeof scheduleConflictSchema>;

export const closureResultSchema = <TItem extends z.ZodTypeAny>(item: TItem) =>
  z.object({
    item,
    cancelledAppointments: z.number().int().min(0),
  });

export const clinicClosureResultSchema = closureResultSchema(clinicClosureSchema);
export type ClinicClosureResult = z.infer<typeof clinicClosureResultSchema>;

export const doctorTimeOffResultSchema = closureResultSchema(doctorTimeOffSchema);
export type DoctorTimeOffResult = z.infer<typeof doctorTimeOffResultSchema>;

// A code carrying the closure's own id, not a sentence: the UI renders it in the reader's language
// and has to say which closure did this.
export const CLOSURE_CANCELLATION_PREFIX = 'closure:';
export const TIME_OFF_CANCELLATION_PREFIX = 'time_off:';

export const closureCancellationReason = (closureId: string): string =>
  `${CLOSURE_CANCELLATION_PREFIX}${closureId}`;

export const timeOffCancellationReason = (timeOffId: string): string =>
  `${TIME_OFF_CANCELLATION_PREFIX}${timeOffId}`;
