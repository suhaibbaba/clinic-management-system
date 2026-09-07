import { z } from 'zod';

import { calendarAppointmentSchema } from '@shared/schemas/appointments';
import { moneySchema } from '@shared/schemas/money';

/** How many of today's appointments the landing page lists before "see all". */
export const DASHBOARD_SCHEDULE_LIMIT = 20;

/**
 * Everything the landing page draws, in one response.
 *
 * One request rather than three: the three cards and the day's list are read
 * together, always, and a dashboard that lands in four waves is a dashboard
 * that flickers. It is also the only place in the app where a *clinic-wide*
 * overdue total exists — the overdue list paginates, and summing one page of
 * it would be a wrong number on a financial screen.
 *
 * Fields are optional because the response is shaped by role, the way every
 * other response in this system is (ROLES.md step 5): a technician's dashboard
 * carries no financial figure at all, and a doctor's carries no online-booking
 * queue, because neither appears in their row of the matrix. Absent rather
 * than zero — a zero is a claim that there is nothing owed, which is not the
 * same as "this is none of your business".
 */
export const dashboardSummarySchema = z.object({
  /** The clinic's local date the figures were computed for, `YYYY-MM-DD`. */
  date: z.string(),
  /** Appointments today. A doctor's own; everyone else's, the clinic's. */
  appointmentsToday: z.number().int().min(0),
  /** Online bookings nobody has answered. Front desk only. */
  pendingBookings: z.number().int().min(0).optional(),
  /** Patients past the clinic's overdue window, and what they owe in total. */
  overdueTotal: moneySchema.optional(),
  overduePatients: z.number().int().min(0).optional(),
  /** Today's list, earliest first — the same rows the calendar draws. */
  schedule: z.array(calendarAppointmentSchema),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
