import { z } from "zod";
import { INTERNATIONAL_PHONE_PATTERN, normalizePhone } from "@shared/constants/phone";

export const uuidSchema = z.uuid();

export const VALIDATION_CODE = {
  YEAR_OUT_OF_RANGE: "year_out_of_range",
  DATE_IN_FUTURE: "date_in_future",
  DATE_IN_PAST: "date_in_past",
} as const;

export const EARLIEST_YEAR = 1900;

export const LATEST_YEAR = 2100;

export const calendarDateSchema = z.iso.date().refine((value) => {
  const year = Number(value.slice(0, 4));

  return year >= EARLIEST_YEAR && year <= LATEST_YEAR;
}, VALIDATION_CODE.YEAR_OUT_OF_RANGE);

export const idParamSchema = z.object({ id: uuidSchema });
export type IdParam = z.infer<typeof idParamSchema>;

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

export const optionalPhoneSchema = phoneSchema.nullish();

export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a HH:MM 24-hour time");

export const timeRangeSchema = z
  .object({ start: timeOfDaySchema, end: timeOfDaySchema })
  .refine((range) => range.start < range.end, {
    message: "start must be earlier than end",
    path: ["end"],
  });
export type TimeRange = z.infer<typeof timeRangeSchema>;

export const weekdaySchema = z.number().int().min(0).max(6);

export const dayScheduleSchema = z.object({
  weekday: weekdaySchema,
  ranges: z.array(timeRangeSchema).max(6),
});
export type DaySchedule = z.infer<typeof dayScheduleSchema>;

export const weeklyScheduleSchema = z
  .array(dayScheduleSchema)
  .max(7)
  .refine(
    (days) => new Set(days.map((day) => day.weekday)).size === days.length,
    "Each weekday may appear at most once",
  );
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;

export const settingsSchema = z.record(z.string(), z.unknown());
