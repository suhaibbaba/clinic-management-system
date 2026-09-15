import { z } from 'zod';

export const uuidSchema = z.uuid();

export const idParamSchema = z.object({ id: uuidSchema });
export type IdParam = z.infer<typeof idParamSchema>;

/** Query params arrive as strings, hence the coercion. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function paginatedSchema<TItem extends z.ZodTypeAny>(item: TItem) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  });
}

export interface Paginated<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** E.164 caps a number at 15 digits; 7 is the shortest a national number gets. */
export const PHONE_DIGITS = { min: 7, max: 15 } as const;

const digitCount = (value: string): number => (value.match(/\d/g) ?? []).length;

/**
 * Loose on country, strict on substance: local formats vary by region, so this checks the shape and
 * how many digits are in it rather than a dialling plan. The shape alone let `------` through — the
 * separators were optional but the digits were not required.
 */
export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^\+?[\d\s-]+$/, 'Expected digits, optionally prefixed with +')
  .refine((value) => {
    const digits = digitCount(value);

    return digits >= PHONE_DIGITS.min && digits <= PHONE_DIGITS.max;
  }, `Expected between ${PHONE_DIGITS.min} and ${PHONE_DIGITS.max} digits`);

/** The same rule where the field may be left empty — an optional contact number. */
export const optionalPhoneSchema = phoneSchema.nullish();

/** 24-hour clock time, zero padded so plain string comparison orders correctly. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a HH:MM 24-hour time');

/** A working interval within one day. Breaks are the gaps between ranges. */
export const timeRangeSchema = z
  .object({ start: timeOfDaySchema, end: timeOfDaySchema })
  .refine((range) => range.start < range.end, {
    message: 'start must be earlier than end',
    path: ['end'],
  });
export type TimeRange = z.infer<typeof timeRangeSchema>;

/** 0 = Sunday … 6 = Saturday, matching JavaScript's `Date#getDay`. */
export const weekdaySchema = z.number().int().min(0).max(6);

export const dayScheduleSchema = z.object({
  weekday: weekdaySchema,
  /** Working intervals for that weekday. Empty means closed / not working. */
  ranges: z.array(timeRangeSchema).max(6),
});
export type DaySchedule = z.infer<typeof dayScheduleSchema>;

// Availability is always computed from this minus existing appointments — free slots are never
// stored.
export const weeklyScheduleSchema = z
  .array(dayScheduleSchema)
  .max(7)
  .refine(
    (days) => new Set(days.map((day) => day.weekday)).size === days.length,
    'Each weekday may appear at most once',
  );
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;

export const settingsSchema = z.record(z.string(), z.unknown());
