import { z } from 'zod';

/** Every entity id in the system is a UUID. */
export const uuidSchema = z.uuid();

/** `:id` route parameter. */
export const idParamSchema = z.object({ id: uuidSchema });
export type IdParam = z.infer<typeof idParamSchema>;

/**
 * Pagination for every list endpoint (CLAUDE.md). Query params arrive as
 * strings, hence the coercion.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Envelope returned by every list endpoint. */
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

/**
 * Reused for clinic opening hours and for a doctor's weekly schedule. Slot
 * availability is always computed from this minus existing appointments —
 * free slots are never stored (CLAUDE.md architecture decision 6).
 */
export const weeklyScheduleSchema = z
  .array(dayScheduleSchema)
  .max(7)
  .refine(
    (days) => new Set(days.map((day) => day.weekday)).size === days.length,
    'Each weekday may appear at most once',
  );
export type WeeklySchedule = z.infer<typeof weeklyScheduleSchema>;

/** Free-form per-clinic configuration; typed as modules start using keys. */
export const settingsSchema = z.record(z.string(), z.unknown());
