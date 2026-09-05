import { z } from 'zod';

import { TIMELINE_ENTRY_TYPES } from '@shared/enums';
import { paginationQuerySchema } from '@shared/schemas/common';

/**
 * One merged, reverse-chronological stream over everything attached to a
 * patient (CLAUDE.md: "…all appear in one timeline").
 *
 * Which entry types a caller receives is decided by role, not by the query:
 * a receptionist sees only the financial and appointment entries
 * (ROLES.md patients matrix).
 */
export const timelineEntrySchema = z.object({
  id: z.uuid(),
  type: z.enum(TIMELINE_ENTRY_TYPES),
  occurredAt: z.iso.datetime(),
  /** Short, already-resolved label; never a translated string. */
  title: z.string(),
  /** Entry-specific payload, shaped by `type`. */
  detail: z.record(z.string(), z.unknown()),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

export const listTimelineQuerySchema = paginationQuerySchema.extend({
  type: z.enum(TIMELINE_ENTRY_TYPES).optional(),
});
export type ListTimelineQuery = z.infer<typeof listTimelineQuerySchema>;
