import { Inject, Injectable } from "@nestjs/common";
import {
  AI_TOOL,
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUSES,
  addDays,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  instantFromLocal,
  localDate,
  type CalendarAppointment,
  type InventoryItemRow,
  type LabOrderRow,
  type PatientView,
} from "@clinic/shared";
import { and, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { AppointmentsService } from "@api/appointments/appointments.service";
import { LedgerService } from "@api/billing/ledger.service";
import { OverdueService } from "@api/billing/overdue.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DATABASE, type Database } from "@api/database/database.module";
import { clinics, visits } from "@api/database/schema";
import { InventoryReportsService } from "@api/inventory/inventory-reports.service";
import { LabOrdersService } from "@api/labs/lab-orders.service";
import { PatientAccessService } from "@api/patients/patient-access.service";
import { PatientsService } from "@api/patients/patients.service";
import { TimelineService } from "@api/patients/timeline.service";
import { PermissionsService } from "@api/permissions/permissions.service";
import { capped, defineTool, maskPhone, TOOL_ROW_LIMIT, type AiTool } from "@api/ai/tools/ai-tool";

// The capability each tool borrows from the endpoint that already answers the same question. A
// clinic that takes `billing.list` off its receptionists takes it off the assistant with it.
const CAPABILITY = {
  PATIENT_TIMELINE: "timeline.list",
  PATIENT_BALANCE: "patient-billing.balance",
  OVERDUE: "billing.list",
  LAB_ORDERS_OVERDUE: "lab-orders.overdue",
  INVENTORY_ALERTS: "inventory.alerts",
} as const;

const dateSchema = z.iso.date();

const PERIOD = ["today", "this_week", "this_month", "last_month"] as const;
type Period = (typeof PERIOD)[number];

@Injectable()
export class AiToolsService {
  private tools: AiTool[] | undefined;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly appointments: AppointmentsService,
    private readonly patients: PatientsService,
    private readonly timeline: TimelineService,
    private readonly ledger: LedgerService,
    private readonly overdue: OverdueService,
    private readonly labOrders: LabOrdersService,
    private readonly inventory: InventoryReportsService,
    private readonly permissions: PermissionsService,
  ) {}

  list(): AiTool[] {
    this.tools ??= this.build();

    return this.tools;
  }

  private build(): AiTool[] {
    return [
      defineTool({
        name: AI_TOOL.GET_APPOINTMENTS,
        description:
          "List the clinic's appointments between two dates, newest first, optionally narrowed " +
          "to one status. Dates are the clinic's own local dates and both ends are inclusive.",
        capability: null,
        schema: z.object({
          date_from: dateSchema,
          date_to: dateSchema,
          status: z.enum(APPOINTMENT_STATUSES).optional(),
        }),
        run: async (actor, args) => {
          const page = await this.appointments.list(actor, {
            page: 1,
            limit: TOOL_ROW_LIMIT,
            from: args.date_from,
            to: args.date_to,
            ...(args.status && { status: args.status }),
          });

          return capped(page.items.map(toAppointmentSummary), page.total);
        },
      }),

      defineTool({
        name: AI_TOOL.SEARCH_PATIENTS,
        description:
          "Find patients by name, file number or phone. Returns the file number, the name, a " +
          "masked phone and the date of the last visit. Use it to turn a name into a patient id.",
        capability: null,
        schema: z.object({ query: z.string().trim().min(2).max(120) }),
        run: async (actor, args) => {
          const page = await this.patients.list(actor, {
            page: 1,
            limit: TOOL_ROW_LIMIT,
            search: args.query,
          });

          const lastVisits = await this.lastVisits(actor, page.items);

          return capped(
            page.items.map((patient) => ({
              id: patient.id,
              fileNumber: patient.fileNumber,
              fullName: patient.fullName,
              phone: maskPhone(patient.phone),
              lastVisitAt: lastVisits.get(patient.id) ?? null,
            })),
            page.total,
          );
        },
      }),

      defineTool({
        name: AI_TOOL.GET_PATIENT_SUMMARY,
        description:
          "One patient's record: their details, their recent history — visits, treatments, " +
          "appointments, payments — and their balance. Takes a patient id from search_patients.",
        capability: CAPABILITY.PATIENT_TIMELINE,
        schema: z.object({ patient_id: z.uuid() }),
        run: async (actor, args) => {
          const [patient, history] = await Promise.all([
            this.patients.findOne(actor, args.patient_id),
            this.timeline.list(actor, args.patient_id, { page: 1, limit: TOOL_ROW_LIMIT }),
          ]);

          return {
            patient: toPatientSummary(patient),
            // Absent rather than null where the role may not read it: a null is still an answer
            // about somebody's debt (ROLES.md field rules).
            ...((await this.allows(actor, CAPABILITY.PATIENT_BALANCE)) && {
              balance: await this.ledger.balanceFor(actor.clinicId, args.patient_id),
            }),
            history: capped(history.items, history.total),
          };
        },
      }),

      defineTool({
        name: AI_TOOL.GET_DAILY_STATS,
        description:
          "Counts of appointments between two dates: how many in total, how many were completed, " +
          "cancelled or marked a no-show. Use it for attendance questions, not for lists.",
        capability: null,
        schema: z.object({ date_from: dateSchema, date_to: dateSchema }),
        run: async (actor, args) => {
          const range = { from: args.date_from, to: args.date_to };
          const [total, completed, cancelled, noShow] = await Promise.all([
            this.countAppointments(actor, range),
            this.countAppointments(actor, range, APPOINTMENT_STATUS.COMPLETED),
            this.countAppointments(actor, range, APPOINTMENT_STATUS.CANCELLED),
            this.countAppointments(actor, range, APPOINTMENT_STATUS.NO_SHOW),
          ]);

          return { ...range, total, completed, cancelled, noShow };
        },
      }),

      defineTool({
        name: AI_TOOL.GET_FINANCIAL_SUMMARY,
        description:
          "The clinic's money over a period: what was charged, what was collected, what is " +
          "outstanding, and the patients who owe the most.",
        capability: CAPABILITY.OVERDUE,
        schema: z.object({ period: z.enum(PERIOD) }),
        run: async (actor, args) => {
          const { from, to, timeZone } = await this.resolvePeriod(actor.clinicId, args.period);

          const [totals, outstanding, debtors] = await Promise.all([
            this.ledger.totalsBetween(
              actor.clinicId,
              instantFromLocal(from, 0, timeZone),
              instantFromLocal(to, 0, timeZone),
            ),
            this.overdue.total(actor.clinicId),
            this.overdue.list(actor.clinicId, { page: 1, limit: 5 }),
          ]);

          return {
            period: args.period,
            from,
            // The range is half-open inside, so the day the caller sees is the last one counted.
            to: addDays(to, -1),
            ...totals,
            outstandingTotal: outstanding.total,
            outstandingPatients: outstanding.patients,
            topDebtors: debtors.items.map((debtor) => ({
              patientId: debtor.patientId,
              fullName: debtor.fullName,
              balance: debtor.balance,
              daysSinceLastPayment: debtor.daysSinceLastPayment,
            })),
          };
        },
      }),

      defineTool({
        name: AI_TOOL.GET_OVERDUE_LAB_ORDERS,
        description:
          "Lab orders that are past the date the lab promised them and are not back yet, the " +
          "most overdue first.",
        capability: CAPABILITY.LAB_ORDERS_OVERDUE,
        schema: z.object({}),
        run: async (actor) => {
          const orders = await this.labOrders.overdue(actor, TOOL_ROW_LIMIT + 1);

          return capped(orders.map(toLabOrderSummary));
        },
      }),

      defineTool({
        name: AI_TOOL.GET_LOW_STOCK_ITEMS,
        description:
          "Stock items at or below their minimum quantity, the most urgent first. Use it for " +
          "what needs ordering.",
        capability: CAPABILITY.INVENTORY_ALERTS,
        schema: z.object({}),
        run: async (actor) => {
          const alerts = await this.inventory.alerts(actor);

          return capped(alerts.low.map(toStockSummary));
        },
      }),
    ];
  }

  private allows(actor: AuthenticatedUser, capability: string): Promise<boolean> {
    return this.permissions.allows(actor.clinicId, actor.role, capability);
  }

  private async countAppointments(
    actor: AuthenticatedUser,
    range: { from: string; to: string },
    status?: (typeof APPOINTMENT_STATUSES)[number],
  ): Promise<number> {
    // `limit: 1` — only the total is wanted, and the list returns it either way.
    const page = await this.appointments.list(actor, {
      page: 1,
      limit: 1,
      ...range,
      ...(status && { status }),
    });

    return page.total;
  }

  // A visit date is clinical, so a receptionist's search does not carry one — the timeline they
  // are served has the same hole in it (ROLES.md).
  private async lastVisits(
    actor: AuthenticatedUser,
    patients: readonly PatientView[],
  ): Promise<Map<string, string>> {
    if (patients.length === 0 || !PatientAccessService.seesClinicalData(actor.role)) {
      return new Map();
    }

    const rows = await this.db
      .select({ patientId: visits.patientId, lastVisitAt: max(visits.visitDate) })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, actor.clinicId),
          isNull(visits.deletedAt),
          inArray(
            visits.patientId,
            patients.map((patient) => patient.id),
          ),
        ),
      )
      .groupBy(visits.patientId);

    return new Map(
      rows.flatMap((row) =>
        row.lastVisitAt ? [[row.patientId, row.lastVisitAt.toISOString()]] : [],
      ),
    );
  }

  // Resolved server-side against the clinic's own calendar: a model doing date arithmetic is a
  // financial figure for the wrong month. `to` is exclusive.
  private async resolvePeriod(
    clinicId: string,
    period: Period,
  ): Promise<{ from: string; to: string; timeZone: string }> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    const timeZone = clinicScheduleSettings(row?.settings).timezone || DEFAULT_TIME_ZONE;
    const today = localDate(new Date(), timeZone);
    const [year = 0, month = 1, day = 1] = today.split("-").map(Number);
    const firstOfMonth = `${pad(year, 4)}-${pad(month, 2)}-01`;

    switch (period) {
      case "today":
        return { from: today, to: addDays(today, 1), timeZone };
      case "this_week": {
        // Sunday, as `DaySchedule.weekday` counts it.
        const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

        return { from: addDays(today, -weekday), to: addDays(today, 1), timeZone };
      }
      case "this_month":
        return { from: firstOfMonth, to: addDays(today, 1), timeZone };
      case "last_month": {
        const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

        return {
          from: `${pad(previous.year, 4)}-${pad(previous.month, 2)}-01`,
          to: firstOfMonth,
          timeZone,
        };
      }
    }
  }
}

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

const toAppointmentSummary = (appointment: CalendarAppointment) => ({
  id: appointment.id,
  patientId: appointment.patientId,
  patientName: appointment.patientName,
  patientFileNumber: appointment.patientFileNumber,
  doctorName: appointment.doctorName,
  startsAt: appointment.startsAt,
  durationMinutes: appointment.durationMinutes,
  type: appointment.type,
  status: appointment.status,
  reason: appointment.reason,
});

// Whatever the role's own view carries and nothing more: the clinical view has the notes, the
// public one does not, and neither is reshaped here.
const toPatientSummary = (patient: PatientView) => ({
  ...patient,
  phone: maskPhone(patient.phone),
  ...("emergencyContactPhone" in patient &&
    patient.emergencyContactPhone !== null && {
      emergencyContactPhone: maskPhone(patient.emergencyContactPhone),
    }),
});

const toLabOrderSummary = (order: LabOrderRow) => ({
  id: order.id,
  patientName: order.patientName,
  labName: order.labName,
  workTypeName: order.workTypeName,
  status: order.status,
  expectedAt: order.expectedAt,
  teeth: order.teeth,
});

const toStockSummary = (item: InventoryItemRow) => ({
  id: item.id,
  name: item.nameAr,
  unit: item.unit,
  quantity: item.quantity,
  minQuantity: item.minQuantity,
  supplierName: item.supplierName,
});
