import { z } from "zod";
import { USER_ROLES } from "@shared/enums";
import {
  DASHBOARD_KEY_NUMBERS,
  DASHBOARD_QUICK_ACTIONS,
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_WIDTHS,
  DASHBOARD_ZONES,
} from "@shared/constants/dashboard";
import { calendarAppointmentSchema } from "@shared/schemas/appointments";
import { moneySchema } from "@shared/schemas/money";
import { personNameSchema } from "@shared/schemas/person-name";

export const DASHBOARD_SCHEDULE_LIMIT = 20;

export const dashboardSummarySchema = z.object({
  date: z.string(),
  appointmentsToday: z.number().int().min(0).optional(),
  pendingBookings: z.number().int().min(0).optional(),
  overdueTotal: moneySchema.optional(),
  overduePatients: z.number().int().min(0).optional(),
  schedule: z.array(calendarAppointmentSchema).optional(),
  visitsToday: z.number().int().min(0).optional(),
  collectedToday: moneySchema.optional(),
  newPatientsToday: z.number().int().min(0).optional(),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const dashboardVisitSchema = z.object({
  id: z.uuid(),
  visitDate: z.iso.datetime(),
  patientId: z.uuid(),
  patientName: z.string(),
  fileNumber: z.string(),
  doctorName: personNameSchema,
  balance: moneySchema.optional(),
});

export type DashboardVisit = z.infer<typeof dashboardVisitSchema>;

export const dashboardVisitsSchema = z.object({
  items: z.array(dashboardVisitSchema),
  total: z.number().int().min(0),
});

export type DashboardVisits = z.infer<typeof dashboardVisitsSchema>;

export const dashboardCollectionsSchema = z.object({
  days: z.array(z.object({ date: z.string(), total: moneySchema })),
});

export type DashboardCollections = z.infer<typeof dashboardCollectionsSchema>;

export const dashboardWidgetPlacementSchema = z.object({
  id: z.enum(DASHBOARD_WIDGET_IDS),
  zone: z.enum(DASHBOARD_ZONES),
  width: z.enum(DASHBOARD_WIDTHS),
  visible: z.boolean(),
});

export type DashboardWidgetPlacement = z.infer<typeof dashboardWidgetPlacementSchema>;

export const dashboardLayoutSchema = z.object({
  widgets: z.array(dashboardWidgetPlacementSchema).max(DASHBOARD_WIDGET_IDS.length * 2),
  keyNumbers: z.array(z.enum(DASHBOARD_KEY_NUMBERS)).max(DASHBOARD_KEY_NUMBERS.length * 2),
  quickActions: z
    .array(z.enum(DASHBOARD_QUICK_ACTIONS))
    .max(DASHBOARD_QUICK_ACTIONS.length * 2)
    .optional(),
});

export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>;

export const dashboardRoleLayoutSchema = z.object({
  role: z.enum(USER_ROLES),
  layout: dashboardLayoutSchema,
  keyNumberOptions: z.array(z.enum(DASHBOARD_KEY_NUMBERS)),
  quickActionOptions: z.array(z.enum(DASHBOARD_QUICK_ACTIONS)),
  customized: z.boolean(),
  updatedAt: z.string().nullable(),
});

export type DashboardRoleLayout = z.infer<typeof dashboardRoleLayoutSchema>;

export const dashboardLayoutsSchema = z.object({
  roles: z.array(dashboardRoleLayoutSchema),
});

export type DashboardLayouts = z.infer<typeof dashboardLayoutsSchema>;

export const saveDashboardLayoutsSchema = z.object({
  layouts: z
    .array(z.object({ role: z.enum(USER_ROLES), layout: dashboardLayoutSchema }))
    .min(1)
    .max(USER_ROLES.length),
});

export type SaveDashboardLayoutsInput = z.infer<typeof saveDashboardLayoutsSchema>;
