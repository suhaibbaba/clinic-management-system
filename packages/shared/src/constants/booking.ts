import { INTERNATIONAL_PHONE_PATTERN } from "@shared/constants/phone";

// Zod-free on purpose: the public booking bundle has an 80 KB budget and the shared barrel pulls
// Zod in with it.

export const BOOKING_NAME_LENGTH = { min: 2, max: 160 } as const;

export function isBookingName(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.length >= BOOKING_NAME_LENGTH.min && trimmed.length <= BOOKING_NAME_LENGTH.max;
}

/** The number the page's picker composed: international, as the API requires. */
export const isBookingPhone = (value: string): boolean => INTERNATIONAL_PHONE_PATTERN.test(value);
