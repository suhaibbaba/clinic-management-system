/**
 * What a booking form accepts, without Zod.
 *
 * These are the same rules the booking DTO enforces — `schemas/booking.ts`
 * builds its `fullName` and `phone` checks out of the constants below, so
 * there is one definition, not two that drift.
 *
 * They live in their own Zod-free module for one reason: the public booking
 * page is a separate bundle with an 80 KB gzip budget, and importing anything
 * from `@clinic/shared`'s barrel pulls Zod in with it — about 45 KB gzipped of
 * schema machinery, on a page opened from a WhatsApp link over mobile data,
 * to check that a name is two characters long. The API still validates every
 * field with the real schema; that is the boundary. This is what lets the form
 * say so *before* the round trip without paying for it.
 */

export const BOOKING_NAME_LENGTH = { min: 2, max: 160 } as const;

export const BOOKING_PHONE_LENGTH = { min: 6, max: 32 } as const;

/**
 * Local numbers, loosely: a leading `+` or digit, then digits, spaces and
 * dashes. Deliberately permissive — rejecting a real number is worse than
 * accepting a fake one, which the OTP catches anyway.
 */
export const BOOKING_PHONE_PATTERN = /^[+\d][\d\s-]*$/;

export function isBookingName(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.length >= BOOKING_NAME_LENGTH.min && trimmed.length <= BOOKING_NAME_LENGTH.max;
}

export function isBookingPhone(value: string): boolean {
  const trimmed = value.trim();

  return (
    trimmed.length >= BOOKING_PHONE_LENGTH.min &&
    trimmed.length <= BOOKING_PHONE_LENGTH.max &&
    BOOKING_PHONE_PATTERN.test(trimmed)
  );
}
