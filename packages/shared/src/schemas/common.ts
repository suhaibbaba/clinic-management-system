import { z } from "zod";
import { INTERNATIONAL_PHONE_PATTERN, normalizePhone } from "@shared/constants/phone";

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

// Stored international, always: a local number means nothing without its country, and a clinic's
// country is the picker's default, not the API's to guess. `00…`, spacing and a trunk 0 after a
// known code are normalised first.
export const phoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine(
    (value) => value.startsWith("+") || value.startsWith("00"),
    "Expected an international number starting with + or 00",
  )
  .transform((value) => normalizePhone(value))
  .refine(
    (value) => INTERNATIONAL_PHONE_PATTERN.test(value),
    "Expected a + and between 7 and 15 digits",
  );

/** The same rule where the field may be left empty — an optional contact number. */
export const optionalPhoneSchema = phoneSchema.nullish();

/** 24-hour clock time, zero padded so plain string comparison orders correctly. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a HH:MM 24-hour time");

/** A working interval within one day. Breaks are the gaps between ranges. */
export const timeRangeSchema = z
  .object({ start: timeOfDaySchema, end: timeOfDaySchema })
  .refine((range) => range.start < range.end, {
    message: "start must be earlier than end",
    path: ["end"],
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
    "Each weekday may appear at most once",
  );
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;

export const settingsSchema = z.record(z.string(), z.unknown());
