import { z } from 'zod';

import { BOOKING_CONFIRMATION_MODE, BOOKING_CONFIRMATION_MODES } from '@shared/enums';
import { isoDateSchema, slotSchema } from '@shared/schemas/appointments';
import { timeOfDaySchema, uuidSchema } from '@shared/schemas/common';

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Public booking rules, in `clinics.settings.booking`.
 *
 * The window is two numbers rather than one: `maxDaysAhead` stops a stranger
 * filling the diary for next year, and `minHoursBefore` stops a booking landing
 * ten minutes before it starts, which reception has no chance to see.
 */
export const bookingSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxDaysAhead: z.number().int().min(1).max(365).default(30),
  minHoursBefore: z.number().int().min(0).max(168).default(2),
  confirmationMode: z.enum(BOOKING_CONFIRMATION_MODES).default(BOOKING_CONFIRMATION_MODE.MANUAL),
  /**
   * How long an unconfirmed booking keeps its slot. Long enough to read an SMS,
   * short enough that a walk-away does not hold a Tuesday morning all week.
   */
  holdMinutes: z.number().int().min(2).max(120).default(15),
  /** Active unconfirmed bookings one phone number may hold at once. */
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

/* -------------------------------------------------------------------------- */
/* Public reads                                                                */
/* -------------------------------------------------------------------------- */

/** The clinic as a stranger sees it: enough to book, and nothing more. */
export const publicClinicSchema = z.object({
  name: z.string(),
  slug: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  bookingEnabled: z.boolean(),
  confirmationMode: z.enum(BOOKING_CONFIRMATION_MODES),
  maxDaysAhead: z.number().int(),
});
export type PublicClinic = z.infer<typeof publicClinicSchema>;

/**
 * A doctor on the booking page: a name and a specialty.
 *
 * Not the internal `Doctor` — that carries a user id, a weekly schedule and an
 * appointment duration, none of which a stranger needs and all of which is
 * information about how the clinic runs.
 */
export const publicDoctorSchema = z.object({
  id: uuidSchema,
  name: z.string(),
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
});
export type PublicSlots = z.infer<typeof publicSlotsSchema>;

/* -------------------------------------------------------------------------- */
/* Booking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Local phone numbers, loosely. Deliberately permissive: rejecting a real
 * number is worse than accepting a fake one, which the OTP catches anyway.
 */
export const bookingPhoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(32)
  .regex(/^[+\d][\d\s-]*$/, 'Expected a phone number');

export const createBookingSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: bookingPhoneSchema,
  doctorId: uuidSchema,
  startsAt: z.iso.datetime(),
  reason: z.string().trim().max(300).nullish(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * What a booking answers with.
 *
 * There is **no patient id, no file number and no name** in here, and there is
 * no field that differs between a phone the clinic already knows and one it has
 * never seen — that is what makes enumeration impossible rather than merely
 * awkward. The `token` is an opaque signed handle; it is the only way back to
 * the booking, and it goes to the phone, not into this response's meaning.
 */
export const bookingReceiptSchema = z.object({
  /** Signed, opaque. Not a database id. */
  token: z.string(),
  status: z.enum(['pending_otp', 'pending_confirmation']),
  /** Present in OTP mode, so the page knows how long to wait. */
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

/**
 * A booking as its own holder sees it, through the signed link.
 *
 * Carries the appointment's own facts and the clinic's, because whoever holds
 * this token was sent it on the phone that made the booking. It still carries
 * no file number, no balance and nothing clinical.
 */
export const managedBookingSchema = z.object({
  status: z.string(),
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int(),
  doctorName: z.string(),
  clinicName: z.string(),
  clinicPhone: z.string().nullable(),
  /** Whether the window still allows changing it. */
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

/** Slot times the public page renders, kept as `HH:MM` for a picker. */
export const publicSlotTimeSchema = timeOfDaySchema;
