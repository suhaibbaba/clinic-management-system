import { z } from 'zod';

import { calendarAppointmentSchema } from '@shared/schemas/appointments';
import { moneySchema } from '@shared/schemas/money';

export const DASHBOARD_SCHEDULE_LIMIT = 20;

// One request, because a dashboard landing in four waves flickers. Fields are optional and shaped
// by role — absent rather than zero, since zero claims nothing is owed.
export const dashboardSummarySchema = z.object({
  /** The clinic's local date the figures were computed for, `YYYY-MM-DD`. */
  date: z.string(),
  /** Appointments today. A doctor's own; everyone else's, the clinic's. */
  appointmentsToday: z.number().int().min(0),
  /** Online bookings nobody has answered. Front desk only. */
  pendingBookings: z.number().int().min(0).optional(),
  overdueTotal: moneySchema.optional(),
  overduePatients: z.number().int().min(0).optional(),
  schedule: z.array(calendarAppointmentSchema),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
