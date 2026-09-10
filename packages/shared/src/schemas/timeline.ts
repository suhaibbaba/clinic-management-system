import { z } from 'zod';

import { TIMELINE_ENTRY_TYPES } from '@shared/enums';
import { paginationQuerySchema } from '@shared/schemas/common';

// Which entry types a caller receives is decided by role, not by the query — a receptionist sees
// only financial and appointment entries.
export const timelineEntrySchema = z.object({
  id: z.uuid(),
  type: z.enum(TIMELINE_ENTRY_TYPES),
  occurredAt: z.iso.datetime(),
  /** Short, already-resolved label; never a translated string. */
  title: z.string(),
  detail: z.record(z.string(), z.unknown()),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

export const listTimelineQuerySchema = paginationQuerySchema.extend({
  type: z.enum(TIMELINE_ENTRY_TYPES).optional(),
});
export type ListTimelineQuery = z.infer<typeof listTimelineQuerySchema>;
