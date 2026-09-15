import { z } from 'zod';

import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPE,
  WAITING_LIST_PRIORITIES,
  WAITING_LIST_PRIORITY,
  WAITING_LIST_SOURCES,
  WAITING_LIST_STATUSES,
} from '@shared/enums';
import { clinicClosureSchema, doctorTimeOffSchema } from '@shared/schemas/closures';
import { paginationQuerySchema, timeOfDaySchema, uuidSchema } from '@shared/schemas/common';
import {
  hasExactlyOnePatient,
  patientRefFields,
  PATIENT_REF_MESSAGE,
} from '@shared/schemas/patients';
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

// `newPatient` registers and books in one request, because the alternative is reception leaving a
// half-filled form to go and create a patient. Both write inside one transaction.
export const createAppointmentSchema = z
  .object({
    ...appointmentWritableFields,
    ...patientRefFields,
    durationMinutes: durationMinutesSchema.optional(),
    type: lookupCodeSchema.default(APPOINTMENT_TYPE.CHECKUP),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
  })
  .refine(hasExactlyOnePatient, PATIENT_REF_MESSAGE);
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

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
  /** The complaint, in the patient's own words when it arrived online. */
  reason: z.string().nullable(),
  priority: z.enum(WAITING_LIST_PRIORITIES),
  source: z.enum(WAITING_LIST_SOURCES),
  status: z.enum(WAITING_LIST_STATUSES),
  declinedReason: z.string().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  appointmentId: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WaitingListEntry = z.infer<typeof waitingListEntrySchema>;

export const createWaitingListEntrySchema = z
  .object({
    ...patientRefFields,
    doctorId: uuidSchema.nullish(),
    reason: z.string().trim().max(500).nullish(),
    priority: z.enum(WAITING_LIST_PRIORITIES).default(WAITING_LIST_PRIORITY.NORMAL),
  })
  .refine(hasExactlyOnePatient, PATIENT_REF_MESSAGE);
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
  source: z.enum(WAITING_LIST_SOURCES).optional(),
  status: z.enum(WAITING_LIST_STATUSES).optional(),
});
export type ListWaitingListQuery = z.infer<typeof listWaitingListQuerySchema>;

// Booking goes through the ordinary appointment path, so a slot taken while the patient waited is
// the same 409 reception would have got typing it in, and the entry stays open.
export const promoteWaitingListEntrySchema = z.object({
  doctorId: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: durationMinutesSchema.optional(),
  type: lookupCodeSchema.optional(),
  /** Tells the patient the time they were given; off for a walk-in already at the desk. */
  notify: z.boolean().default(false),
});
export type PromoteWaitingListEntryInput = z.infer<typeof promoteWaitingListEntrySchema>;

/** Closing the entry without a booking. The reason is the patient's answer, so it is required. */
export const declineWaitingListEntrySchema = z.object({
  reason: z.string().trim().min(3).max(500),
  notify: z.boolean().default(false),
});
export type DeclineWaitingListEntryInput = z.infer<typeof declineWaitingListEntrySchema>;
