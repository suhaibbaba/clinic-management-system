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

/**
 * Appointment length, in minutes.
 *
 * Bounded rather than free: five minutes is shorter than it takes to seat a
 * patient, and eight hours is a working day, so anything outside that is a
 * typo the calendar would render as an unreadable block.
 */
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
  /** Set once the appointment is turned into a visit; links the two records. */
  visitId: uuidSchema.nullable(),
  cancelledReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

/**
 * An appointment with the two names a calendar has to draw.
 *
 * Denormalised on read rather than fetched per block: a week view holds a
 * hundred appointments, and a hundred follow-up requests for a patient's name
 * is what makes a calendar feel slow.
 *
 * It carries **no** clinical field, which is what lets a receptionist read the
 * same feed as a doctor (ROLES.md: their responses never include diagnoses,
 * visit notes or medical history).
 */
export const calendarAppointmentSchema = appointmentSchema.extend({
  patientName: z.string(),
  patientPhone: z.string(),
  patientFileNumber: z.string(),
  doctorName: personNameSchema,
  /**
   * The patient record was created by the public booking page, not by anyone
   * at the desk — nobody has seen their ID yet.
   *
   * It is `created_by IS NULL` on the patient, which is a fact rather than a
   * flag someone has to remember to set: public booking attributes the record
   * to nobody on purpose, because attributing it to a member of staff would be
   * a lie in the audit trail. Reception needs it to know whose data still has
   * to be completed on arrival.
   */
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
  /** Falls back to the doctor's own configured appointment length. */
  durationMinutes: durationMinutesSchema.optional(),
  /** Most bookings are a check-up; the form defaults to it. */
  type: lookupCodeSchema.default(APPOINTMENT_TYPE.CHECKUP),
  /**
   * Omitted by reception, whose booking *is* the confirmation. Public booking
   * will pass `requested` instead, which is why it is settable at all.
   */
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

/**
 * Rescheduling and editing. Status is **not** here: it moves only through the
 * transition endpoints, so the state machine has exactly one door.
 */
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

/**
 * A day or a week of the calendar.
 *
 * `doctorId` omitted means the whole clinic, which is the receptionist's view;
 * a doctor's own calendar is the same endpoint with their id, so there is one
 * range query rather than three.
 */
export const calendarQuerySchema = z.object({
  /** Any date inside the range; the API snaps a week to its Sunday. */
  date: isoDateSchema,
  range: z.enum(['day', 'week']).default('day'),
  doctorId: uuidSchema.optional(),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarFeedSchema = z.object({
  /** Inclusive first day and exclusive last day, as local dates. */
  from: isoDateSchema,
  to: isoDateSchema,
  appointments: z.array(calendarAppointmentSchema),
  /**
   * Everything in the range that makes a slot unbookable but is not an
   * appointment.
   *
   * In the same response rather than fetched alongside it, because a calendar
   * that draws its blocks before it knows which days are shut renders a normal
   * Tuesday for a moment and then shades it — and reception books into the
   * flicker. One request, one paint.
   *
   * Days are expanded to the range the caller asked for, so the grid never has
   * to intersect a closure that started three weeks ago with the week it is
   * drawing.
   */
  closures: z.array(clinicClosureSchema),
  timeOff: z.array(doctorTimeOffSchema),
});
export type CalendarFeed = z.infer<typeof calendarFeedSchema>;

export const availabilityQuerySchema = z.object({
  doctorId: uuidSchema,
  date: isoDateSchema,
  /** Defaults to the doctor's configured appointment length. */
  durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  /**
   * The appointment being rescheduled. Its own block is ignored, so an edit
   * that keeps the same time still sees that time as free.
   */
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
  /**
   * Why there are no slots, when there are none. A closed day and a fully
   * booked one look identical in an empty array, and they are different
   * answers to "can you fit me in?" — and so are a clinic closure, which is
   * dated and applies to everybody, and one doctor being away, where another
   * doctor may still have room.
   */
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
  /**
   * The reason text of whatever shut the day, when something did.
   *
   * The closure's own words — "عيد الفطر", "conference" — rather than a
   * translated category: a clinic writes the reason it wants patients and
   * reception to read, and inventing a second one here would mean the calendar
   * and the closure disagreed about why the door is locked.
   */
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
  /** Set when the entry becomes an appointment, or is dismissed. */
  resolvedAt: z.iso.datetime().nullable(),
  /** The appointment it was promoted into, when it was. */
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

/** Turning a waiting patient into a booking. The slot comes from availability. */
export const promoteWaitingListEntrySchema = z.object({
  doctorId: uuidSchema,
  startsAt: z.iso.datetime(),
  durationMinutes: durationMinutesSchema.optional(),
  type: lookupCodeSchema.optional(),
});
export type PromoteWaitingListEntryInput = z.infer<typeof promoteWaitingListEntrySchema>;
