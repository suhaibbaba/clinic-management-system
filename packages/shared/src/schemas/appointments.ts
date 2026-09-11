import { z } from 'zod';

import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPE,
  WAITING_LIST_PRIORITIES,
  WAITING_LIST_PRIORITY,
} from '@shared/enums';
import { clinicClosureSchema, doctorTimeOffSchema } from '@shared/schemas/closures';
import { paginationQuerySchema, timeOfDaySchema, uuidSchema } from '@shared/schemas/common';
import { personNameSchema } from '@shared/schemas/person-name';
import { lookupCodeSchema } from '@shared/schemas/lookups';

/** `YYYY-MM-DD`, the wire format for a calendar day everywhere in the app. */
export const isoDateSchema = z.iso.date();

export const durationMinutesSchema = z.number().int().min(5).max(480);

export const appointmentSchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  patientId: uuidSchema,
  doctorId: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: durationMinutesSchema,
  /** Computed, never stored: `startsAt` plus the duration. */
  endsAt: z.iso.datetime(),
  type: lookupCodeSchema,
  status: z.enum(APPOINTMENT_STATUSES),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  visitId: uuidSchema.nullable(),
  cancelledReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

// Carries no clinical field, which is what lets a receptionist read the same feed as a doctor
// (ROLES.md).
export const calendarAppointmentSchema = appointmentSchema.extend({
  patientName: z.string(),
  patientPhone: z.string(),
  patientFileNumber: z.string(),
  doctorName: personNameSchema,
  // `created_by IS NULL` on the patient — public booking attributes the record to nobody, so this
  // is a fact rather than a flag.
  patientUnverified: z.boolean(),
});
export type CalendarAppointment = z.infer<typeof calendarAppointmentSchema>;

const appointmentWritableFields = {
  doctorId: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: durationMinutesSchema,
  type: lookupCodeSchema,
  reason: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(2000).nullish(),
};

export const createAppointmentSchema = z.object({
  ...appointmentWritableFields,
  patientId: uuidSchema,
  durationMinutes: durationMinutesSchema.optional(),
  type: lookupCodeSchema.default(APPOINTMENT_TYPE.CHECKUP),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// Status is not here: it moves only through the transition endpoints, so the state machine has one
// door.
export const updateAppointmentSchema = z
  .object(appointmentWritableFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/** Cancelling states a reason; every other transition carries no body. */
export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const listAppointmentsQuerySchema = paginationQuerySchema.extend({
  patientId: uuidSchema.optional(),
  doctorId: uuidSchema.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  /** Inclusive day bounds, in the clinic's own local dates. */
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

export const calendarQuerySchema = z.object({
  /** Any date inside the range; the API snaps a week to its Sunday and a month to its first. */
  date: isoDateSchema,
  range: z.enum(['day', 'week', 'month']).default('day'),
  doctorId: uuidSchema.optional(),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarFeedSchema = z.object({
  /** Inclusive first day and exclusive last day, as local dates. */
  from: isoDateSchema,
  to: isoDateSchema,
  appointments: z.array(calendarAppointmentSchema),
  // In the same response as the appointments, so the grid never paints a normal Tuesday and then
  // shades it.
  closures: z.array(clinicClosureSchema),
  timeOff: z.array(doctorTimeOffSchema),
});
export type CalendarFeed = z.infer<typeof calendarFeedSchema>;

export const availabilityQuerySchema = z.object({
  doctorId: uuidSchema,
  date: isoDateSchema,
  durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  /** Its own block is ignored, so an edit that keeps the same time still sees that time as free. */
  excludeAppointmentId: uuidSchema.optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const slotSchema = z.object({
  /** Local wall-clock start, `HH:MM`. */
  start: timeOfDaySchema,
  end: timeOfDaySchema,
  /** Absolute instant, for booking without re-deriving the timezone. */
  startsAt: z.iso.datetime(),
  available: z.boolean(),
});
export type Slot = z.infer<typeof slotSchema>;

export const availabilitySchema = z.object({
  doctorId: uuidSchema,
  date: isoDateSchema,
  durationMinutes: durationMinutesSchema,
  // A closed day and a fully booked one are both an empty array; the caller has to tell the patient
  // which.
  closedReason: z
    .enum([
      'clinic_closed',
      'clinic_closure',
      'doctor_off',
      'doctor_time_off',
      'fully_booked',
      'day_over',
    ])
    .nullable(),
  // The closure's own words rather than a translated category, so the calendar and the closure
  // cannot disagree.
  closedNote: z.string().nullable(),
  slots: z.array(slotSchema),
});
export type Availability = z.infer<typeof availabilitySchema>;

export const waitingListEntrySchema = z.object({
  id: uuidSchema,
  clinicId: uuidSchema,
  patientId: uuidSchema,
  patientName: z.string(),
  patientPhone: z.string(),
  /** Null when the patient will take any doctor. */
  doctorId: uuidSchema.nullable(),
  doctorName: personNameSchema.nullable(),
  reason: z.string().nullable(),
  priority: z.enum(WAITING_LIST_PRIORITIES),
  resolvedAt: z.iso.datetime().nullable(),
  appointmentId: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WaitingListEntry = z.infer<typeof waitingListEntrySchema>;

export const createWaitingListEntrySchema = z.object({
  patientId: uuidSchema,
  doctorId: uuidSchema.nullish(),
  reason: z.string().trim().max(500).nullish(),
  priority: z.enum(WAITING_LIST_PRIORITIES).default(WAITING_LIST_PRIORITY.NORMAL),
});
export type CreateWaitingListEntryInput = z.infer<typeof createWaitingListEntrySchema>;

export const updateWaitingListEntrySchema = z
  .object({
    doctorId: uuidSchema.nullish(),
    reason: z.string().trim().max(500).nullish(),
    priority: z.enum(WAITING_LIST_PRIORITIES),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export type UpdateWaitingListEntryInput = z.infer<typeof updateWaitingListEntrySchema>;

export const listWaitingListQuerySchema = paginationQuerySchema.extend({
  /** Unresolved only by default: the panel is a queue, not a history. */
  includeResolved: z.coerce.boolean().default(false),
  doctorId: uuidSchema.optional(),
});
export type ListWaitingListQuery = z.infer<typeof listWaitingListQuerySchema>;

export const promoteWaitingListEntrySchema = z.object({
  doctorId: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: durationMinutesSchema.optional(),
  type: lookupCodeSchema.optional(),
});
export type PromoteWaitingListEntryInput = z.infer<typeof promoteWaitingListEntrySchema>;
