import { INTERNATIONAL_PHONE_PATTERN } from "@shared/constants/phone";

export const BOOKING_NAME_LENGTH = { min: 2, max: 160 } as const;

export function isBookingName(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.length >= BOOKING_NAME_LENGTH.min && trimmed.length <= BOOKING_NAME_LENGTH.max;
}

export const isBookingPhone = (value: string): boolean => INTERNATIONAL_PHONE_PATTERN.test(value);
