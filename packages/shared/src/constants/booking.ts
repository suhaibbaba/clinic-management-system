// Zod-free on purpose: the public booking bundle has an 80 KB budget and the shared barrel pulls
// Zod in with it.

export const BOOKING_NAME_LENGTH = { min: 2, max: 160 } as const;

export const BOOKING_PHONE_LENGTH = { min: 6, max: 32 } as const;

// Deliberately permissive — rejecting a real number is worse than accepting a fake one, which the
// OTP catches.
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
