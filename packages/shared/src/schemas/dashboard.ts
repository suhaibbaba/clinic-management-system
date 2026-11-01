import { z } from "zod";
import { calendarAppointmentSchema } from "@shared/schemas/appointments";
import { moneySchema } from "@shared/schemas/money";

export const DASHBOARD_SCHEDULE_LIMIT = 20;

export const dashboardSummarySchema = z.object({
  date: z.string(),
  appointmentsToday: z.number().int().min(0).optional(),
  pendingBookings: z.number().int().min(0).optional(),
  overdueTotal: moneySchema.optional(),
  overduePatients: z.number().int().min(0).optional(),
  schedule: z.array(calendarAppointmentSchema).optional(),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
