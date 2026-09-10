import { z } from 'zod';

import {
  BOOKING_NAME_LENGTH,
  BOOKING_PHONE_LENGTH,
  BOOKING_PHONE_PATTERN,
} from '@shared/constants/booking';
import { BOOKING_CONFIRMATION_MODE, BOOKING_CONFIRMATION_MODES } from '@shared/enums';
import { isoDateSchema, slotSchema } from '@shared/schemas/appointments';
import { personNameSchema } from '@shared/schemas/person-name';
import { timeOfDaySchema, uuidSchema } from '@shared/schemas/common';

export const bookingSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxDaysAhead: z.number().int().min(1).max(365).default(30),
  minHoursBefore: z.number().int().min(0).max(168).default(2),
  confirmationMode: z.enum(BOOKING_CONFIRMATION_MODES).default(BOOKING_CONFIRMATION_MODE.MANUAL),
  holdMinutes: z.number().int().min(2).max(120).default(15),
  maxActivePerPhone: z.number().int().min(1).max(20).default(3),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

/** Never throws: a malformed blob must read as "booking is off", not as a 500. */
export function bookingSettings(settings: unknown): BookingSettings {
  const raw =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)['booking']
      : undefined;

  const parsed = bookingSettingsSchema.safeParse(raw ?? {});

  return parsed.success
    ? parsed.data
    : {
        enabled: false,
        maxDaysAhead: 30,
        minHoursBefore: 2,
        confirmationMode: BOOKING_CONFIRMATION_MODE.MANUAL,
        holdMinutes: 15,
        maxActivePerPhone: 3,
      };
}

export const publicClinicSchema = z.object({
  name: personNameSchema,
  slug: z.string(),
  /** Long-lived signed URL, so the booking page draws the mark from cache on a repeat visit. */
  logoUrl: z.url().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  bookingEnabled: z.boolean(),
  confirmationMode: z.enum(BOOKING_CONFIRMATION_MODES),
  maxDaysAhead: z.number().int(),
});
export type PublicClinic = z.infer<typeof publicClinicSchema>;

// Not the internal `Doctor`: a stranger has no business with a user id, a weekly schedule or an
// appointment duration.
export const publicDoctorSchema = z.object({
  id: uuidSchema,
  name: personNameSchema,
  specialty: z.string(),
});
export type PublicDoctor = z.infer<typeof publicDoctorSchema>;

export const publicSlotsQuerySchema = z.object({
  doctorId: uuidSchema,
  date: isoDateSchema,
});
export type PublicSlotsQuery = z.infer<typeof publicSlotsQuerySchema>;

export const publicSlotsSchema = z.object({
  date: isoDateSchema,
  /** Only bookable ones — a stranger has no use for a greyed grid. */
  slots: z.array(slotSchema.omit({ available: true })),
  // The dated reasons only — "closed for Eid" is on the door, but a full diary tells a stranger how
  // busy the practice is.
  closedReason: z.enum(['clinic_closure', 'doctor_time_off']).nullable(),
  closedNote: z.string().nullable(),
});
export type PublicSlots = z.infer<typeof publicSlotsSchema>;

// Bounds and pattern come from `constants/booking`, which the Zod-free public page also uses — one
// definition, checked twice.
export const bookingPhoneSchema = z
  .string()
  .trim()
  .min(BOOKING_PHONE_LENGTH.min)
  .max(BOOKING_PHONE_LENGTH.max)
  .regex(BOOKING_PHONE_PATTERN, 'Expected a phone number');

export const createBookingSchema = z.object({
  fullName: z.string().trim().min(BOOKING_NAME_LENGTH.min).max(BOOKING_NAME_LENGTH.max),
  phone: bookingPhoneSchema,
  doctorId: uuidSchema,
  startsAt: z.iso.datetime(),
  reason: z.string().trim().max(300).nullish(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// No patient id, no name, and no field that differs between a phone the clinic knows and one it
// does not — which is what makes enumeration impossible. The `token` goes to the phone.
export const bookingReceiptSchema = z.object({
  /** Signed, opaque. Not a database id. */
  token: z.string(),
  status: z.enum(['pending_otp', 'pending_confirmation']),
  otpExpiresInSeconds: z.number().int().nullable(),
  holdExpiresAt: z.iso.datetime(),
});
export type BookingReceipt = z.infer<typeof bookingReceiptSchema>;

export const verifyOtpSchema = z.object({
  token: z.string().min(10),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Expected a six-digit code'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// Carries the appointment's own facts for whoever holds the token, but no file number, no balance
// and nothing clinical.
export const managedBookingSchema = z.object({
  status: z.string(),
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int(),
  doctorName: personNameSchema,
  clinicName: personNameSchema,
  clinicPhone: z.string().nullable(),
  canModify: z.boolean(),
});
export type ManagedBooking = z.infer<typeof managedBookingSchema>;

export const rescheduleBookingSchema = z.object({
  startsAt: z.iso.datetime(),
});
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const publicSlotTimeSchema = timeOfDaySchema;
