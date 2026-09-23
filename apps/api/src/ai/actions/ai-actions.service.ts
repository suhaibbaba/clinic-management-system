import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  addDays,
  AI_ACTION_BASE_TIER,
  AI_ACTION_CHECK,
  AI_ACTION_CHECKS,
  AI_ACTION_ERROR,
  AI_OUTBOUND_ERROR,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_RISK_TIER,
  AI_SCHEDULE_CONFLICT_CHOICE,
  AI_SCHEDULE_CONFLICT_CHOICES,
  AI_TOOL,
  AI_TOOL_ERROR,
  AI_ACTION_TOOLS,
  createDoctorExtraHoursSchema,
  adjustStockSchema,
  weeklyScheduleSchema,
  type DaySchedule,
  type TimeRange,
  type WeeklySchedule,
  canTransitionLabOrder,
  consumeStockSchema,
  LAB_ORDER_STATUS,
  MOVEMENT_TYPE,
  MOVEMENT_TYPES,
  purchaseStockSchema,
  type AdjustStockInput,
  type ConsumeStockInput,
  type MovementType,
  type PurchaseStockInput,
  AI_ACTIONS_SETTINGS_KEY,
  aiActionsSettings,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  AUDIT_ACTION,
  canTransitionAppointment,
  clinicScheduleSettings,
  DEFAULT_TIME_ZONE,
  GENDERS,
  instantFromLocal,
  localDate,
  LOOKUP_LIST,
  maxRiskTier,
  occupiesSlot,
  phoneSchema,
  toMinorUnits,
  wholeMoneySchema,
  type AiActionError,
  type AiActionResult,
  type AiActionsSettings,
  type AiActionSummary,
  type AiActionStepSummary,
  type AiActionTool,
  type AiProposal,
  type AiProposalKind,
  type AiProposalStatusEvent,
  type AiRiskTier,
  type AiScheduleConflictChoice,
  type AuditAction,
  type CalendarAppointment,
  type PatientView,
} from "@clinic/shared";
import { and, asc, eq, gte, isNull, lt, max, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { OutboundError, statusEvent, toProposal } from "@api/ai/outbound/proposals.service";
import {
  ActionDone,
  defineTool,
  ProposalResult,
  ToolRefusal,
  type AiTool,
  type ToolAuditTarget,
} from "@api/ai/tools/ai-tool";
import { AppointmentAccessService } from "@api/appointments/appointment-access.service";
import { APPOINTMENTS_ENTITY, AppointmentsService } from "@api/appointments/appointments.service";
import { AvailabilityService } from "@api/appointments/availability.service";
import { AuditSnapshotRegistry } from "@api/audit/audit-snapshot.registry";
import { AuditService } from "@api/audit/audit.service";
import { LedgerService } from "@api/billing/ledger.service";
import { PAYMENTS_ENTITY, PaymentsService } from "@api/billing/payments.service";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import type { Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import {
  aiAuditLog,
  aiProposals,
  appointments,
  clinics,
  labPayments,
  lookupOptions,
  patients,
  payments,
  stockMovements,
  visits,
} from "@api/database/schema";
import { DOCTORS_ENTITY, DoctorsService } from "@api/doctors/doctors.service";
import {
  STOCK_MOVEMENTS_ENTITY,
  StockMovementsService,
} from "@api/inventory/stock-movements.service";
import { InventoryItemsService } from "@api/inventory/inventory-items.service";
import { LabLedgerService } from "@api/labs/lab-ledger.service";
import { LAB_ORDERS_ENTITY, LabOrdersService } from "@api/labs/lab-orders.service";
import { LAB_PAYMENTS_ENTITY, LabPaymentsService } from "@api/labs/lab-payments.service";
import { LabsService } from "@api/labs/labs.service";
import { PATIENTS_ENTITY } from "@api/patients/patient-view";
import { PatientsService } from "@api/patients/patients.service";
import { PermissionsService } from "@api/permissions/permissions.service";
import {
  CLINIC_CLOSURES_ENTITY,
  ClinicClosuresService,
} from "@api/schedule/clinic-closures.service";
import {
  DOCTOR_TIME_OFF_ENTITY,
  DoctorTimeOffService,
} from "@api/schedule/doctor-time-off.service";
import { ScheduleConflictsService } from "@api/schedule/schedule-conflicts.service";
import {
  DOCTOR_EXTRA_HOURS_ENTITY,
  DoctorExtraHoursService,
} from "@api/schedule/doctor-extra-hours.service";
import { commitTogether, rehearse } from "@api/database/unit-of-work";
import { RouteToolRegistry, type RouteTool } from "@api/ai/tools/route-tools";

type ActionKind = Exclude<AiProposalKind, typeof AI_PROPOSAL_KIND.MESSAGE>;

/** What a `typed` card asks to be typed. In code: never in a row, and never in the model's context. */
export const TYPED_PHRASES: Record<ActionKind, string> = {
  [AI_PROPOSAL_KIND.APPOINTMENT_CREATE]: "تأكيد حجز الموعد",
  [AI_PROPOSAL_KIND.APPOINTMENT_UPDATE]: "تأكيد تعديل الموعد",
  [AI_PROPOSAL_KIND.APPOINTMENT_STATUS]: "تأكيد تغيير الحالة",
  [AI_PROPOSAL_KIND.APPOINTMENT_CANCEL]: "تأكيد إلغاء المواعيد",
  [AI_PROPOSAL_KIND.PATIENT_CREATE]: "تأكيد إضافة المريض",
  [AI_PROPOSAL_KIND.PATIENT_NOTE]: "تأكيد إضافة الملاحظة",
  [AI_PROPOSAL_KIND.PAYMENT_CREATE]: "تأكيد تسجيل الدفعة",
  [AI_PROPOSAL_KIND.TIME_OFF_CREATE]: "تأكيد إجازة الطبيب",
  [AI_PROPOSAL_KIND.CLOSURE_CREATE]: "تأكيد إغلاق العيادة",
  [AI_PROPOSAL_KIND.TIME_OFF_UPDATE]: "تأكيد تعديل الإجازة",
  [AI_PROPOSAL_KIND.TIME_OFF_DELETE]: "تأكيد حذف الإجازة",
  [AI_PROPOSAL_KIND.LAB_ORDER_STATUS]: "تأكيد تغيير حالة الطلبية",
  [AI_PROPOSAL_KIND.STOCK_MOVEMENT]: "تأكيد حركة المخزون",
  [AI_PROPOSAL_KIND.DOCTOR_SCHEDULE]: "تأكيد تعديل الدوام",
  [AI_PROPOSAL_KIND.PAYMENT_REVERSE]: "تأكيد عكس الدفعة",
  [AI_PROPOSAL_KIND.LAB_PAYMENT_CREATE]: "تأكيد دفعة المختبر",
  [AI_PROPOSAL_KIND.LAB_PAYMENT_REVERSE]: "تأكيد عكس دفعة المختبر",
  [AI_PROPOSAL_KIND.STOCK_REVERSE]: "تأكيد عكس الحركة",
  [AI_PROPOSAL_KIND.EXTRA_HOURS_CREATE]: "تأكيد الدوام الإضافي",
  [AI_PROPOSAL_KIND.PLAN]: "تأكيد الخطة",
  [AI_PROPOSAL_KIND.ROUTE_CALL]: "تأكيد الإجراء",
};

const DORMANT_AFTER_DAYS = 730;
const LARGE_CANCELLATION = 10;
const EXCEEDS_BALANCE_FACTOR = 3;
const NOTES_MAX_LENGTH = 2000;

/** The statuses the assistant may set, and the endpoint whose permission each borrows. */
const STATUS_CAPABILITY = {
  [APPOINTMENT_STATUS.CONFIRMED]: "appointments.confirm",
  [APPOINTMENT_STATUS.ARRIVED]: "appointments.arrived",
  [APPOINTMENT_STATUS.IN_PROGRESS]: "appointments.start",
  [APPOINTMENT_STATUS.COMPLETED]: "appointments.complete",
  [APPOINTMENT_STATUS.NO_SHOW]: "appointments.noShow",
} as const;
type SettableStatus = keyof typeof STATUS_CAPABILITY;
const SETTABLE_STATUSES = Object.keys(STATUS_CAPABILITY) as [SettableStatus, ...SettableStatus[]];

interface StatusPayload {
  readonly appointmentId: string;
  readonly status: SettableStatus;
}

/** Small and reversible run at once; the rest wait on a card. */
const AUTO_STATUSES: readonly SettableStatus[] = [
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.IN_PROGRESS,
  APPOINTMENT_STATUS.COMPLETED,
];

const acknowledgeSchema = z
  .array(z.enum(AI_ACTION_CHECKS))
  .optional()
  .describe(
    "Only after the user answered yes to a sanity_check you relayed: the check they answered.",
  );
const dateSchema = z.iso.date();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");

const periodFields = z.object({
  date_from: dateSchema,
  date_to: dateSchema,
  reason: z.string().trim().min(2).max(200),
  on_conflict: z
    .enum(AI_SCHEDULE_CONFLICT_CHOICES)
    .optional()
    .describe("Only after the user answered a schedule_conflict: what to do with them."),
});

const orderedDates = (args: { date_from: string; date_to: string }): boolean =>
  args.date_from <= args.date_to;
const pairedTimes = (args: { time_from?: string | undefined; time_to?: string | undefined }) =>
  (args.time_from === undefined) === (args.time_to === undefined);
const DATES_ORDERED = { path: ["date_to"], message: "Must not be before date_from" };
const TIMES_PAIRED = {
  path: ["time_to"],
  message: "Pass time_from and time_to together, or neither for whole days",
};
const partOfDay = { time_from: timeSchema.optional(), time_to: timeSchema.optional() };

const timeOffSchema = periodFields
  .extend({ doctor_id: z.uuid(), ...partOfDay })
  .refine(orderedDates, DATES_ORDERED)
  .refine(pairedTimes, TIMES_PAIRED);
const timeOffUpdateSchema = periodFields
  .extend({
    time_off_id: z.uuid(),
    reason: z.string().trim().min(2).max(200).optional(),
    ...partOfDay,
  })
  .refine(orderedDates, DATES_ORDERED)
  .refine(pairedTimes, TIMES_PAIRED);
const closureSchema = periodFields.refine(orderedDates, DATES_ORDERED);

/** The statuses the assistant may move a lab order to, and the endpoint each borrows. */
const LAB_STATUS_CAPABILITY = {
  [LAB_ORDER_STATUS.SENT]: "lab-orders.send",
  [LAB_ORDER_STATUS.READY]: "lab-orders.ready",
  [LAB_ORDER_STATUS.RECEIVED]: "lab-orders.receive",
  [LAB_ORDER_STATUS.FITTED]: "lab-orders.fit",
  [LAB_ORDER_STATUS.RETURNED]: "lab-orders.return",
  [LAB_ORDER_STATUS.CANCELLED]: "lab-orders.cancel",
} as const;
type SettableLabStatus = keyof typeof LAB_STATUS_CAPABILITY;
const SETTABLE_LAB_STATUSES = Object.keys(LAB_STATUS_CAPABILITY) as [
  SettableLabStatus,
  ...SettableLabStatus[],
];

const labStatusSchema = z
  .object({
    lab_order_id: z.uuid(),
    status: z.enum(SETTABLE_LAB_STATUSES),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .refine((args) => args.status !== LAB_ORDER_STATUS.RETURNED || args.reason !== undefined, {
    path: ["reason"],
    message: "A return must say why",
  });

const MOVEMENT_CAPABILITY: Record<MovementType, string> = {
  [MOVEMENT_TYPE.PURCHASE]: "inventory.purchase",
  [MOVEMENT_TYPE.CONSUME]: "inventory.consume",
  [MOVEMENT_TYPE.ADJUST]: "inventory.adjust",
};

const movementSchema = z.object({
  item_id: z.uuid(),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z
    .string()
    .describe("In the item's own unit, as a string. Negative only for an adjust that removes."),
  unit_price: z.string().optional().describe("A purchase's whole price per unit."),
  patient_id: z.uuid().optional().describe("A consume for one patient's treatment."),
  reason: z.string().trim().max(500).optional().describe("Required for an adjust."),
});

const scheduleSchema = z.object({
  doctor_id: z.uuid(),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6).describe("0 is Sunday, 6 is Saturday."),
        ranges: z
          .array(z.object({ start: timeSchema, end: timeSchema }))
          .max(6)
          .describe("The working hours that day; empty for a day off."),
      }),
    )
    .min(1)
    .max(7),
  acknowledge: acknowledgeSchema,
});

const reversalReason = z.string().trim().min(3).max(500);

const extraHoursSchema = z.object({
  doctor_id: z.uuid(),
  date: dateSchema,
  ranges: z
    .array(z.object({ start: timeSchema, end: timeSchema }))
    .min(1)
    .max(6)
    .describe("The hours worked that date on top of the weekly schedule."),
  reason: z.string().trim().min(2).max(200),
});

interface ExtraHoursPayload {
  readonly doctorId: string;
  readonly date: string;
  readonly ranges: readonly { start: string; end: string }[];
  readonly reason: string;
}

const PLAN_STEP_TOOLS = AI_ACTION_TOOLS.filter(
  (tool): tool is Exclude<AiActionTool, typeof AI_TOOL.PROPOSE_PLAN> =>
    tool !== AI_TOOL.PROPOSE_PLAN,
) as [Exclude<AiActionTool, "propose_plan">, ...Exclude<AiActionTool, "propose_plan">[]];

const MAX_PLAN_STEPS = 30;

const planSchema = z.object({
  steps: z
    .array(
      z.object({
        tool: z.enum(PLAN_STEP_TOOLS),
        args: z
          .record(z.string(), z.unknown())
          .describe("Exactly the arguments that tool takes on its own."),
      }),
    )
    .min(1)
    .max(MAX_PLAN_STEPS),
});

interface PlanPayload {
  readonly steps: readonly { readonly tool: string; readonly payload: unknown }[];
}

/** A step that failed on the click, carrying the step's own kind so the card says why. */
class PlanStepFailure extends Error {
  constructor(
    readonly kind: ActionKind,
    override readonly cause: unknown,
  ) {
    super(`Plan step ${kind} failed`);
    this.name = "PlanStepFailure";
  }
}

const labPaymentSchema = z.object({
  lab_id: z.uuid(),
  amount: z.number().int().min(1).max(99_999_999),
  method: z.string().trim().min(1).max(64).optional(),
  note: z.string().trim().max(500).optional(),
  acknowledge: acknowledgeSchema,
});

interface SchedulePayload {
  readonly doctorId: string;
  readonly weeklySchedule: WeeklySchedule;
}

interface ReversalPayload {
  readonly id: string;
  readonly reason: string;
}

interface LabPaymentPayload {
  readonly labId: string;
  readonly amount: string;
  readonly method: string;
  readonly note: string | null;
}

type MovementInput =
  | { readonly type: typeof MOVEMENT_TYPE.PURCHASE; readonly input: PurchaseStockInput }
  | { readonly type: typeof MOVEMENT_TYPE.CONSUME; readonly input: ConsumeStockInput }
  | { readonly type: typeof MOVEMENT_TYPE.ADJUST; readonly input: AdjustStockInput };

interface ConflictDecision {
  readonly onConflict: AiScheduleConflictChoice | null;
  readonly conflictIds: readonly string[];
}

interface TimeOffPayload extends ConflictDecision {
  readonly doctorId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
}

interface TimeOffUpdatePayload extends ConflictDecision {
  readonly timeOffId: string;
  readonly doctorId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string | null;
  /** Only a period that grew can have somebody new inside it. */
  readonly grew: boolean;
}

interface LabStatusPayload {
  readonly labOrderId: string;
  readonly status: SettableLabStatus;
  readonly reason: string | null;
}

interface ClosurePayload extends ConflictDecision {
  readonly startsOn: string;
  readonly endsOn: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string;
}

const statusSchema = z.object({
  appointment_id: z.uuid(),
  status: z.enum(SETTABLE_STATUSES),
  acknowledge: acknowledgeSchema,
});

/** A deterministic stop, told to the model as a result it relays — never retried around. */
class Stop {
  constructor(readonly forModel: Record<string, unknown>) {}
}

interface Draft<TPayload> {
  readonly payload: TPayload;
  readonly summary: AiActionSummary;
}

interface Executed {
  readonly result: AiActionResult | null;
  readonly audit: ToolAuditTarget;
}

interface ActionSpec<TSchema extends z.ZodType, TPayload> {
  /** An `AiActionTool`, or a generated route write's name. */
  readonly tool: string;
  /** Defaults to the hand-written tool's entry in `TOOL_GROUP`. */
  readonly group?: string;
  readonly kind: ActionKind;
  readonly description: string;
  readonly risk: AiRiskTier;
  /**
   * The endpoint this borrows its permission from; `capabilityFor` narrows it per call. Null only
   * for a plan, whose every step is checked against its own.
   */
  readonly capability: string | null;
  readonly capabilityFor?: (payload: NoInfer<TPayload>) => string;
  readonly schema: TSchema;
  prepare(actor: AuthenticatedUser, args: z.output<TSchema>): Promise<Draft<TPayload> | Stop>;
  /** Raises the tier for what this call turned out to touch. It can never lower one. */
  readonly escalate?: (payload: NoInfer<TPayload>, settings: AiActionsSettings) => AiRiskTier;
  execute(actor: AuthenticatedUser, payload: NoInfer<TPayload>): Promise<Executed>;
}

/** The same spec with its payload type erased, so the registry holds one list. */
interface Action {
  readonly tool: string;
  readonly kind: ActionKind;
  readonly risk: AiRiskTier;
  readonly schema: z.ZodType;
  capabilityFor(payload: unknown): string | null;
  escalate(payload: unknown, settings: AiActionsSettings): AiRiskTier;
  prepare(actor: AuthenticatedUser, args: unknown): Promise<Draft<unknown> | Stop>;
  execute(actor: AuthenticatedUser, payload: unknown): Promise<Executed>;
  asTool(service: AiActionsService): AiTool;
}

type ProposalRow = typeof aiProposals.$inferSelect;

// Every action the assistant can take, and the one path each takes whether it runs inside the tool
// call or on the card's button: the same domain service the screen calls, the same domain audit
// entry, and the same permission, asked again at the click.
@Injectable()
export class AiActionsService {
  private readonly logger = new Logger("Assistant");
  private actions: Action[] | undefined;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly appointments: AppointmentsService,
    private readonly access: AppointmentAccessService,
    private readonly availability: AvailabilityService,
    private readonly doctors: DoctorsService,
    private readonly patients: PatientsService,
    private readonly payments: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly timeOff: DoctorTimeOffService,
    private readonly closures: ClinicClosuresService,
    private readonly conflicts: ScheduleConflictsService,
    private readonly labOrders: LabOrdersService,
    private readonly stockItems: InventoryItemsService,
    private readonly movements: StockMovementsService,
    private readonly labs: LabsService,
    private readonly labPaymentsService: LabPaymentsService,
    private readonly labLedger: LabLedgerService,
    private readonly extraHours: DoctorExtraHoursService,
    private readonly routes: RouteToolRegistry,
    private readonly permissions: PermissionsService,
    private readonly auditSnapshots: AuditSnapshotRegistry,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  tools(): AiTool[] {
    return this.list().map((action) => action.asTool(this));
  }

  async settings(clinicId: string): Promise<AiActionsSettings> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return aiActionsSettings(row?.settings);
  }

  // Merged in place under its own key, so an edit here cannot overwrite what sits beside it.
  async updateSettings(
    actor: AuthenticatedUser,
    input: AiActionsSettings,
  ): Promise<AiActionsSettings> {
    await this.db
      .update(clinics)
      .set({
        settings: sql`${clinics.settings} || jsonb_build_object(${AI_ACTIONS_SETTINGS_KEY}::text, ${JSON.stringify(input)}::jsonb)`,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(and(eq(clinics.id, actor.clinicId), isNull(clinics.deletedAt)));

    return this.settings(actor.clinicId);
  }

  /** The strictest of the code's tier, the clinic's floor, and what this call touched. */
  static resolveTier(
    code: AiRiskTier,
    clinicFloor: AiRiskTier | undefined,
    escalated: AiRiskTier,
  ): AiRiskTier {
    return maxRiskTier(code, clinicFloor ?? AI_RISK_TIER.AUTO, escalated);
  }

  async get(actor: AuthenticatedUser, id: string): Promise<AiProposal> {
    return toProposal(await this.requireOwn(actor, id));
  }

  async cancel(actor: AuthenticatedUser, id: string): Promise<AiProposalStatusEvent> {
    await this.requireOwn(actor, id);

    const [updated] = await this.db
      .update(aiProposals)
      .set({ status: AI_PROPOSAL_STATUS.CANCELLED, updatedAt: new Date(), updatedBy: actor.id })
      .where(and(eq(aiProposals.id, id), eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT)))
      .returning();

    if (!updated) {
      throw new OutboundError(AI_OUTBOUND_ERROR.NOT_PENDING, HttpStatus.CONFLICT);
    }

    return statusEvent(updated);
  }

  /**
   * The card's button. Everything is checked again at the click — author, status, expiry, the
   * clinic's switch, the permission, the tier and the phrase — then the claim flips `draft` to
   * `sending`, which is what stops a second click from running it twice.
   */
  async confirm(
    actor: AuthenticatedUser,
    id: string,
    typedPhrase: string | undefined,
  ): Promise<AiProposalStatusEvent> {
    const { row, action } = await this.claim(actor, id, typedPhrase);
    const started = Date.now();
    let executed: Executed | undefined;
    let failure: AiActionError | undefined;

    try {
      executed = await action.execute(actor, row.payload);
    } catch (error) {
      failure = domainFailure(action.kind, error);

      if (failure === AI_ACTION_ERROR.FAILED) {
        this.logger.error(`Action ${action.tool} failed: ${String(error)}`);
      }
    }

    await this.db.insert(aiAuditLog).values({
      clinicId: actor.clinicId,
      userId: actor.id,
      conversationId: row.conversationId,
      toolName: action.tool,
      argsJson: { proposal_id: row.id },
      outcome: failure ?? "ok",
      resultSize: 0,
      durationMs: Date.now() - started,
      proposalId: row.id,
      ...(executed && { entity: executed.audit.entity, entityId: executed.audit.entityId }),
    });

    const [done] = await this.db
      .update(aiProposals)
      .set({
        status: failure ? AI_PROPOSAL_STATUS.FAILED : AI_PROPOSAL_STATUS.DONE,
        errorCode: failure ?? null,
        resultEntity: executed?.result?.entity ?? null,
        resultId: executed?.result?.id ?? null,
        resultPatientId: executed?.result?.patientId ?? null,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(aiProposals.id, row.id))
      .returning();

    if (!done) {
      throw new Error(`Proposal ${row.id} vanished while running`);
    }

    return statusEvent(done);
  }

  /** Runs one action as the tool call, for the tier that needs nobody's click. */
  async runTool(
    action: Action,
    actor: AuthenticatedUser,
    conversationId: string,
    draft: Draft<unknown>,
  ): Promise<ActionDone | ProposalResult> {
    const settings = await this.settings(actor.clinicId);
    const tier = AiActionsService.resolveTier(
      action.risk,
      minTierFor(settings, action.tool),
      action.escalate(draft.payload, settings),
    );

    if (tier === AI_RISK_TIER.AUTO) {
      const executed = await action.execute(actor, draft.payload);

      return new ActionDone(
        { status: "done", kind: action.kind, result: executed.result },
        executed.audit,
      );
    }

    const proposal = await this.draft(actor, conversationId, action, draft, tier);

    // The id and the tier, never the summary: the person confirming reads it on the card, and the
    // model is not to narrate an action as done.
    return new ProposalResult(proposal, {
      proposal_id: proposal.id,
      kind: proposal.kind,
      status: "awaiting_user_confirmation",
      tier,
    });
  }

  async assertEnabled(actor: AuthenticatedUser, action: Action): Promise<void> {
    if (isDisabled(await this.settings(actor.clinicId), action.tool)) {
      throw new ToolRefusal(AI_TOOL_ERROR.DISABLED);
    }
  }

  async assertAllowed(actor: AuthenticatedUser, capability: string | null): Promise<void> {
    if (capability && !(await this.permissions.allows(actor.clinicId, actor.role, capability))) {
      throw new ForbiddenException();
    }
  }

  private async draft(
    actor: AuthenticatedUser,
    conversationId: string,
    action: Action,
    draft: Draft<unknown>,
    tier: AiRiskTier,
  ): Promise<AiProposal> {
    const ttl = this.config.get("AI_PROPOSAL_TTL_MINUTES", { infer: true });

    const [row] = await this.db
      .insert(aiProposals)
      .values({
        clinicId: actor.clinicId,
        userId: actor.id,
        conversationId,
        kind: action.kind,
        trigger: AI_OUTBOUND_TRIGGER.COMMAND,
        payload: draft.payload as Record<string, unknown>,
        tier,
        typedPhrase: tier === AI_RISK_TIER.TYPED ? TYPED_PHRASES[action.kind] : null,
        resolvedSummary: draft.summary,
        expiresAt: new Date(Date.now() + ttl * 60_000),
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record the proposal");
    }

    return toProposal(row);
  }

  private async claim(
    actor: AuthenticatedUser,
    id: string,
    typedPhrase: string | undefined,
  ): Promise<{ row: ProposalRow; action: Action }> {
    const settings = await this.settings(actor.clinicId);

    const claimed = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(aiProposals)
        .where(this.ownedBy(actor, id))
        .for("update");

      if (!row) {
        throw new NotFoundException("Resource not found");
      }

      const action = this.actionForRow(row);

      if (!action) {
        throw new NotFoundException("Resource not found");
      }

      if (row.status === AI_PROPOSAL_STATUS.EXPIRED) {
        throw new OutboundError(AI_OUTBOUND_ERROR.EXPIRED, HttpStatus.CONFLICT);
      }

      if (row.status !== AI_PROPOSAL_STATUS.DRAFT) {
        throw new OutboundError(AI_OUTBOUND_ERROR.NOT_PENDING, HttpStatus.CONFLICT);
      }

      if (row.expiresAt.getTime() <= Date.now()) {
        return { expired: true } as const;
      }

      if (isDisabled(settings, action.tool)) {
        throw new ActionRefusal(AI_ACTION_ERROR.DISABLED, HttpStatus.FORBIDDEN);
      }

      // The matrix may have changed since the draft; the one in force at the click decides.
      const capability = action.capabilityFor(row.payload);

      if (capability && !(await this.permissions.allows(actor.clinicId, actor.role, capability))) {
        throw new ActionRefusal(AI_ACTION_ERROR.NOT_PERMITTED, HttpStatus.FORBIDDEN);
      }

      const tier = AiActionsService.resolveTier(
        row.tier ?? action.risk,
        minTierFor(settings, action.tool),
        action.escalate(row.payload, settings),
      );

      // Raised since the draft: recorded, so the card re-reads it and asks for the phrase.
      if (tier !== row.tier) {
        await tx
          .update(aiProposals)
          .set({
            tier,
            typedPhrase: tier === AI_RISK_TIER.TYPED ? TYPED_PHRASES[action.kind] : null,
            updatedAt: new Date(),
          })
          .where(eq(aiProposals.id, id));
      }

      // Exact, bar surrounding whitespace: a phrase that forgives typos is a button with extra steps.
      if (tier === AI_RISK_TIER.TYPED && typedPhrase?.trim() !== TYPED_PHRASES[action.kind]) {
        return { mismatch: true } as const;
      }

      const [taken] = await tx
        .update(aiProposals)
        .set({ status: AI_PROPOSAL_STATUS.SENDING, updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(aiProposals.id, id))
        .returning();

      if (!taken) {
        throw new NotFoundException("Resource not found");
      }

      return { row: taken, action } as const;
    });

    if ("mismatch" in claimed) {
      throw new ActionRefusal(AI_ACTION_ERROR.PHRASE_MISMATCH, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    if ("expired" in claimed) {
      await this.db
        .update(aiProposals)
        .set({ status: AI_PROPOSAL_STATUS.EXPIRED, updatedAt: new Date() })
        .where(and(eq(aiProposals.id, id), eq(aiProposals.status, AI_PROPOSAL_STATUS.DRAFT)));

      throw new OutboundError(AI_OUTBOUND_ERROR.EXPIRED, HttpStatus.CONFLICT);
    }

    return { row: claimed.row, action: claimed.action };
  }

  private async requireOwn(actor: AuthenticatedUser, id: string): Promise<ProposalRow> {
    const [row] = await this.db.select().from(aiProposals).where(this.ownedBy(actor, id)).limit(1);

    if (!row) {
      // Somebody else's action is a 404, like somebody else's conversation.
      throw new NotFoundException("Resource not found");
    }

    return row;
  }

  // The author's own: an action is confirmed by the person who asked for it, nobody else.
  private ownedBy(actor: AuthenticatedUser, id: string) {
    return and(
      eq(aiProposals.id, id),
      eq(aiProposals.clinicId, actor.clinicId),
      eq(aiProposals.userId, actor.id),
      ne(aiProposals.kind, AI_PROPOSAL_KIND.MESSAGE),
    );
  }

  private list(): Action[] {
    this.actions ??= [...this.build(), ...this.routeActions()];

    return this.actions;
  }

  private build(): Action[] {
    return [
      defineAction<typeof statusSchema, StatusPayload>({
        tool: AI_TOOL.SET_APPOINTMENT_STATUS,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_STATUS,
        description:
          "Move one appointment along: arrived, in_progress (started), completed — these run at " +
          "once and you say what was done — or confirmed / no_show, which wait on a card the user " +
          "confirms. Takes an appointment id from get_appointments.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.SET_APPOINTMENT_STATUS],
        capability: STATUS_CAPABILITY[APPOINTMENT_STATUS.ARRIVED],
        capabilityFor: (payload) => STATUS_CAPABILITY[payload.status],
        schema: statusSchema,
        prepare: async (actor, args) => {
          const appointment = await this.appointments.findOne(actor, args.appointment_id);

          if (!canTransitionAppointment(appointment.status, args.status)) {
            return new Stop({
              status: "not_possible",
              current_status: appointment.status,
              requested_status: args.status,
            });
          }

          const stop = await this.dormant(actor, appointment.patientId, args.acknowledge);

          return (
            stop ?? {
              payload: { appointmentId: appointment.id, status: args.status },
              summary: { ...appointmentSummary(appointment), status: args.status },
            }
          );
        },
        escalate: (payload) =>
          AUTO_STATUSES.includes(payload.status) ? AI_RISK_TIER.AUTO : AI_RISK_TIER.CONFIRM,
        execute: async (actor, payload) => {
          const appointment = await this.audited(
            actor,
            APPOINTMENTS_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.appointmentId,
            () => this.appointments.changeStatus(actor, payload.appointmentId, payload.status),
          );

          return appointmentResult(appointment);
        },
      }),

      defineAction({
        tool: AI_TOOL.ADD_PATIENT_NOTE,
        kind: AI_PROPOSAL_KIND.PATIENT_NOTE,
        description:
          "Append a short note to a patient's file. It is added after what is there; nothing is " +
          "edited or removed. Takes a patient id from search_patients.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.ADD_PATIENT_NOTE],
        capability: "patients.update",
        schema: z.object({
          patient_id: z.uuid(),
          note: z.string().trim().min(2).max(500),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const patient = await this.patients.findOne(actor, args.patient_id);
          const stop = await this.dormant(actor, patient.id, args.acknowledge);

          return (
            stop ?? {
              payload: { patientId: patient.id, note: args.note },
              summary: { patient: patientSummary(patient), note: args.note },
            }
          );
        },
        execute: async (actor, payload) => {
          const [row] = await this.db
            .select({ notes: patients.notes })
            .from(patients)
            .where(and(eq(patients.id, payload.patientId), eq(patients.clinicId, actor.clinicId)))
            .limit(1);

          const notes = row?.notes ? `${row.notes}\n${payload.note}` : payload.note;

          if (notes.length > NOTES_MAX_LENGTH) {
            throw new BadRequestException("The patient's notes are full");
          }

          await this.audited(actor, PATIENTS_ENTITY, AUDIT_ACTION.UPDATE, payload.patientId, () =>
            this.patients.update(actor, payload.patientId, { notes }),
          );

          return {
            result: { entity: "patient", id: payload.patientId, patientId: payload.patientId },
            audit: { entity: PATIENTS_ENTITY, entityId: payload.patientId },
          };
        },
      }),

      defineAction({
        tool: AI_TOOL.CREATE_APPOINTMENT,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_CREATE,
        description:
          "Book an appointment for a patient with a doctor at a local date and time (HH:MM). " +
          "The slot is checked first: slot_taken or slot_unavailable means ask the user for " +
          "another time — never try to force it. Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.CREATE_APPOINTMENT],
        capability: "appointments.create",
        schema: z.object({
          patient_id: z.uuid(),
          doctor_id: z.uuid(),
          date: dateSchema,
          time: timeSchema,
          duration_minutes: z.number().int().min(5).max(480).optional(),
          reason: z.string().trim().max(500).optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const [patient, doctor] = await Promise.all([
            this.patients.findOne(actor, args.patient_id),
            this.doctors.findOne(actor, args.doctor_id),
          ]);

          await this.access.requireOwnCalendar(actor, doctor.id);

          const slot = await this.slot(actor, {
            doctorId: doctor.id,
            date: args.date,
            time: args.time,
            durationMinutes: args.duration_minutes,
          });

          if (slot instanceof Stop) {
            return slot;
          }

          const stop = await this.dormant(actor, patient.id, args.acknowledge);

          return (
            stop ?? {
              payload: {
                patientId: patient.id,
                doctorId: doctor.id,
                startsAt: slot.startsAt,
                durationMinutes: slot.durationMinutes,
                reason: args.reason ?? null,
              },
              summary: {
                patient: patientSummary(patient),
                doctor: { id: doctor.id, name: doctor.user.name },
                startsAt: slot.startsAt,
                durationMinutes: slot.durationMinutes,
                ...(args.reason && { reason: args.reason }),
              },
            }
          );
        },
        execute: async (actor, payload) => {
          const appointment = await this.audited(
            actor,
            APPOINTMENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () =>
              this.appointments.create(actor, {
                patientId: payload.patientId,
                doctorId: payload.doctorId,
                startsAt: payload.startsAt,
                durationMinutes: payload.durationMinutes,
                type: APPOINTMENT_TYPE.CHECKUP,
                reason: payload.reason,
              }),
          );

          return appointmentResult(appointment);
        },
      }),

      defineAction({
        tool: AI_TOOL.RESCHEDULE_APPOINTMENT,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_UPDATE,
        description:
          "Move one appointment to another local date and time (HH:MM), optionally to another " +
          "doctor. Checked like a new booking; waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.RESCHEDULE_APPOINTMENT],
        capability: "appointments.update",
        schema: z.object({
          appointment_id: z.uuid(),
          date: dateSchema,
          time: timeSchema,
          doctor_id: z.uuid().optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const appointment = await this.appointments.findOne(actor, args.appointment_id);

          if (
            !occupiesSlot(appointment.status) ||
            appointment.status === APPOINTMENT_STATUS.COMPLETED
          ) {
            return new Stop({ status: "not_possible", current_status: appointment.status });
          }

          const doctor = await this.doctors.findOne(actor, args.doctor_id ?? appointment.doctorId);

          await this.access.requireOwnCalendar(actor, appointment.doctorId);
          await this.access.requireOwnCalendar(actor, doctor.id);

          const slot = await this.slot(actor, {
            doctorId: doctor.id,
            date: args.date,
            time: args.time,
            durationMinutes: appointment.durationMinutes,
            excludeAppointmentId: appointment.id,
          });

          if (slot instanceof Stop) {
            return slot;
          }

          const stop = await this.dormant(actor, appointment.patientId, args.acknowledge);

          return (
            stop ?? {
              payload: {
                appointmentId: appointment.id,
                doctorId: doctor.id,
                startsAt: slot.startsAt,
              },
              summary: {
                ...appointmentSummary(appointment),
                doctor: { id: doctor.id, name: doctor.user.name },
                startsAt: slot.startsAt,
                previousStartsAt: appointment.startsAt,
              },
            }
          );
        },
        execute: async (actor, payload) => {
          const appointment = await this.audited(
            actor,
            APPOINTMENTS_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.appointmentId,
            () =>
              this.appointments.update(actor, payload.appointmentId, {
                doctorId: payload.doctorId,
                startsAt: payload.startsAt,
              }),
          );

          return appointmentResult(appointment);
        },
      }),

      defineAction({
        tool: AI_TOOL.CANCEL_APPOINTMENTS,
        kind: AI_PROPOSAL_KIND.APPOINTMENT_CANCEL,
        description:
          "Cancel one or more appointments by id, with the reason the user gave — ask for one " +
          "if they did not. Waits on a card the user confirms; several at once, or one with a " +
          "visit, need a typed confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.CANCEL_APPOINTMENTS],
        capability: "appointments.cancel",
        schema: z.object({
          appointment_ids: z
            .array(z.uuid())
            .min(1)
            .max(50)
            .refine((ids) => new Set(ids).size === ids.length, "Each id once"),
          reason: z.string().trim().min(3).max(500),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const targets = await Promise.all(
            args.appointment_ids.map((id) => this.appointments.findOne(actor, id)),
          );

          for (const target of targets) {
            await this.access.requireOwnCalendar(actor, target.doctorId);
          }

          const stuck = targets.filter(
            (target) => !canTransitionAppointment(target.status, APPOINTMENT_STATUS.CANCELLED),
          );

          if (stuck.length > 0) {
            return new Stop({
              status: "not_possible",
              appointments: stuck.map((target) => ({ id: target.id, status: target.status })),
            });
          }

          const acknowledged = args.acknowledge ?? [];

          if (
            !acknowledged.includes(AI_ACTION_CHECK.LARGE_CANCELLATION) &&
            (targets.length > LARGE_CANCELLATION || (await this.coversWholeDay(actor, targets)))
          ) {
            return sanityCheck(AI_ACTION_CHECK.LARGE_CANCELLATION, {
              count: targets.length,
              doctors: [
                ...new Map(targets.map((target) => [target.doctorId, target.doctorName])).values(),
              ],
            });
          }

          return {
            payload: {
              appointmentIds: targets.map((target) => target.id),
              reason: args.reason,
              linkedVisit: targets.some((target) => target.visitId !== null),
            },
            summary: {
              reason: args.reason,
              appointments: targets.map((target) => ({
                id: target.id,
                startsAt: target.startsAt,
                patientName: target.patientName,
                patientFileNumber: target.patientFileNumber,
                doctorName: target.doctorName,
              })),
            },
          };
        },
        escalate: (payload, settings) =>
          payload.appointmentIds.length > settings.cancelTypedAbove || payload.linkedVisit
            ? AI_RISK_TIER.TYPED
            : AI_RISK_TIER.AUTO,
        execute: async (actor, payload) => {
          let last: CalendarAppointment | undefined;

          for (const id of payload.appointmentIds) {
            last = await this.audited(actor, APPOINTMENTS_ENTITY, AUDIT_ACTION.UPDATE, id, () =>
              this.appointments.changeStatus(
                actor,
                id,
                APPOINTMENT_STATUS.CANCELLED,
                payload.reason,
              ),
            );
          }

          if (!last) {
            throw new BadRequestException("Nothing to cancel");
          }

          // One link only makes sense for one appointment; several are listed on the card.
          return payload.appointmentIds.length === 1
            ? appointmentResult(last)
            : { result: null, audit: { entity: APPOINTMENTS_ENTITY, entityId: last.id } };
        },
      }),

      defineAction<typeof timeOffSchema, TimeOffPayload>({
        tool: AI_TOOL.ADD_DOCTOR_TIME_OFF,
        kind: AI_PROPOSAL_KIND.TIME_OFF_CREATE,
        description:
          "Give a doctor time off: whole days from date_from to date_to (local, inclusive), or " +
          "part of a day with time_from and time_to (HH:MM). Takes a doctor_id from " +
          "find_doctors. Appointments inside the period come back as schedule_conflict: ask " +
          "the user whether to cancel them (each patient is notified), keep them, or change the " +
          "period, then call again with on_conflict. Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.ADD_DOCTOR_TIME_OFF],
        capability: "doctor-time-off.create",
        schema: timeOffSchema,
        prepare: async (actor, args) => {
          const doctor = await this.doctors.findOne(actor, args.doctor_id);

          await this.access.requireOwnCalendar(actor, doctor.id);

          const window = await this.period(actor.clinicId, args);

          if (window instanceof Stop) {
            return window;
          }

          const conflicts = await this.periodConflicts(actor, window, args.on_conflict, doctor.id);

          if (conflicts instanceof Stop) {
            return conflicts;
          }

          return {
            payload: {
              doctorId: doctor.id,
              startsAt: window.from.toISOString(),
              endsAt: window.to.toISOString(),
              reason: args.reason,
              onConflict: args.on_conflict ?? null,
              conflictIds: conflicts.map((appointment) => appointment.id),
            },
            summary: {
              doctor: { id: doctor.id, name: doctor.user.name },
              startsAt: window.from.toISOString(),
              endsAt: window.to.toISOString(),
              reason: args.reason,
              ...conflictSummary(conflicts, args.on_conflict),
            },
          };
        },
        escalate: escalateConflict,
        execute: async (actor, payload) => {
          const window = { from: new Date(payload.startsAt), to: new Date(payload.endsAt) };

          await this.assertNoNewConflicts(actor, window, payload.conflictIds, payload.doctorId);

          const created = await this.audited(
            actor,
            DOCTOR_TIME_OFF_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            async () =>
              (
                await this.timeOff.create(
                  actor,
                  payload.doctorId,
                  { startsAt: payload.startsAt, endsAt: payload.endsAt, reason: payload.reason },
                  conflictOptions(payload),
                )
              ).item,
          );

          return { result: null, audit: { entity: DOCTOR_TIME_OFF_ENTITY, entityId: created.id } };
        },
      }),

      defineAction<typeof closureSchema, ClosurePayload>({
        tool: AI_TOOL.ADD_CLINIC_CLOSURE,
        kind: AI_PROPOSAL_KIND.CLOSURE_CREATE,
        description:
          "Close the whole clinic for whole days, date_from to date_to (local, inclusive) — a " +
          "holiday, not one doctor's absence. Appointments inside it come back as " +
          "schedule_conflict: ask the user whether to cancel them (each patient is notified), " +
          "keep them, or change the dates, then call again with on_conflict. Waits on a card " +
          "the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.ADD_CLINIC_CLOSURE],
        capability: "clinic-closures.create",
        schema: closureSchema,
        prepare: async (actor, args) => {
          const window = await this.period(actor.clinicId, args);

          if (window instanceof Stop) {
            return window;
          }

          const conflicts = await this.periodConflicts(actor, window, args.on_conflict);

          if (conflicts instanceof Stop) {
            return conflicts;
          }

          return {
            payload: {
              startsOn: args.date_from,
              endsOn: args.date_to,
              startsAt: window.from.toISOString(),
              endsAt: window.to.toISOString(),
              reason: args.reason,
              onConflict: args.on_conflict ?? null,
              conflictIds: conflicts.map((appointment) => appointment.id),
            },
            summary: {
              startsOn: args.date_from,
              endsOn: args.date_to,
              reason: args.reason,
              ...conflictSummary(conflicts, args.on_conflict),
            },
          };
        },
        escalate: escalateConflict,
        execute: async (actor, payload) => {
          const window = { from: new Date(payload.startsAt), to: new Date(payload.endsAt) };

          await this.assertNoNewConflicts(actor, window, payload.conflictIds);

          const created = await this.audited(
            actor,
            CLINIC_CLOSURES_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            async () =>
              (
                await this.closures.create(
                  actor,
                  {
                    startsOn: payload.startsOn,
                    endsOn: payload.endsOn,
                    reason: payload.reason,
                    isAnnual: false,
                  },
                  conflictOptions(payload),
                )
              ).item,
          );

          return { result: null, audit: { entity: CLINIC_CLOSURES_ENTITY, entityId: created.id } };
        },
      }),

      defineAction<typeof timeOffUpdateSchema, TimeOffUpdatePayload>({
        tool: AI_TOOL.UPDATE_DOCTOR_TIME_OFF,
        kind: AI_PROPOSAL_KIND.TIME_OFF_UPDATE,
        description:
          "Change a doctor's time off to a new period — pass the whole new period, as for " +
          "add_doctor_time_off. Takes a time_off_id from get_doctor_time_off. A period that " +
          "grows over appointments comes back as schedule_conflict, answered with on_conflict. " +
          "Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.UPDATE_DOCTOR_TIME_OFF],
        capability: "doctor-time-off.update",
        schema: timeOffUpdateSchema,
        prepare: async (actor, args) => {
          const existing = await this.timeOff.findOne(actor, args.time_off_id);

          await this.access.requireOwnCalendar(actor, existing.doctorId);

          const window = await this.period(actor.clinicId, args);

          if (window instanceof Stop) {
            return window;
          }

          const grew =
            window.from < new Date(existing.startsAt) || window.to > new Date(existing.endsAt);
          const conflicts = grew
            ? await this.periodConflicts(actor, window, args.on_conflict, existing.doctorId)
            : [];

          if (conflicts instanceof Stop) {
            return conflicts;
          }

          const doctor = await this.doctors.findOne(actor, existing.doctorId);

          return {
            payload: {
              timeOffId: existing.id,
              doctorId: existing.doctorId,
              startsAt: window.from.toISOString(),
              endsAt: window.to.toISOString(),
              reason: args.reason ?? null,
              grew,
              onConflict: args.on_conflict ?? null,
              conflictIds: conflicts.map((appointment) => appointment.id),
            },
            summary: {
              doctor: { id: doctor.id, name: doctor.user.name },
              previousStartsAt: existing.startsAt,
              previousEndsAt: existing.endsAt,
              startsAt: window.from.toISOString(),
              endsAt: window.to.toISOString(),
              reason: args.reason ?? existing.reason,
              ...conflictSummary(conflicts, args.on_conflict),
            },
          };
        },
        escalate: escalateConflict,
        execute: async (actor, payload) => {
          if (payload.grew) {
            await this.assertNoNewConflicts(
              actor,
              { from: new Date(payload.startsAt), to: new Date(payload.endsAt) },
              payload.conflictIds,
              payload.doctorId,
            );
          }

          const updated = await this.audited(
            actor,
            DOCTOR_TIME_OFF_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.timeOffId,
            async () =>
              (
                await this.timeOff.update(
                  actor,
                  payload.timeOffId,
                  {
                    startsAt: payload.startsAt,
                    endsAt: payload.endsAt,
                    ...(payload.reason !== null && { reason: payload.reason }),
                  },
                  conflictOptions(payload),
                )
              ).item,
          );

          return { result: null, audit: { entity: DOCTOR_TIME_OFF_ENTITY, entityId: updated.id } };
        },
      }),

      defineAction({
        tool: AI_TOOL.DELETE_DOCTOR_TIME_OFF,
        kind: AI_PROPOSAL_KIND.TIME_OFF_DELETE,
        description:
          "Remove a doctor's time off, so the period is bookable again. Takes a time_off_id " +
          "from get_doctor_time_off. Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.DELETE_DOCTOR_TIME_OFF],
        capability: "doctor-time-off.remove",
        schema: z.object({ time_off_id: z.uuid() }),
        prepare: async (actor, args) => {
          const existing = await this.timeOff.findOne(actor, args.time_off_id);

          await this.access.requireOwnCalendar(actor, existing.doctorId);

          const doctor = await this.doctors.findOne(actor, existing.doctorId);

          return {
            payload: { timeOffId: existing.id },
            summary: {
              doctor: { id: doctor.id, name: doctor.user.name },
              startsAt: existing.startsAt,
              endsAt: existing.endsAt,
              reason: existing.reason,
            },
          };
        },
        execute: async (actor, payload) => {
          await this.audited(
            actor,
            DOCTOR_TIME_OFF_ENTITY,
            AUDIT_ACTION.DELETE,
            payload.timeOffId,
            async () => {
              await this.timeOff.softDelete(actor, payload.timeOffId);

              return { id: payload.timeOffId };
            },
          );

          return {
            result: null,
            audit: { entity: DOCTOR_TIME_OFF_ENTITY, entityId: payload.timeOffId },
          };
        },
      }),

      defineAction<typeof labStatusSchema, LabStatusPayload>({
        tool: AI_TOOL.SET_LAB_ORDER_STATUS,
        kind: AI_PROPOSAL_KIND.LAB_ORDER_STATUS,
        description:
          "Move a lab order along: sent (out to the lab), ready (the lab finished), received " +
          "(back at the clinic), fitted (in the patient's mouth), returned (sent back, with the " +
          "reason) or cancelled. Takes a lab_order_id from find_lab_orders. Waits on a card " +
          "the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.SET_LAB_ORDER_STATUS],
        capability: "lab-orders.list",
        capabilityFor: (payload) => LAB_STATUS_CAPABILITY[payload.status],
        schema: labStatusSchema,
        prepare: async (actor, args) => {
          const order = await this.labOrders.findOne(actor, args.lab_order_id);

          if (!canTransitionLabOrder(order.status, args.status)) {
            return new Stop({ status: "not_possible", current_status: order.status });
          }

          return {
            payload: { labOrderId: order.id, status: args.status, reason: args.reason ?? null },
            summary: {
              patient: {
                id: order.patientId,
                fullName: order.patientName,
                fileNumber: order.patientFileNumber,
              },
              labOrder: {
                id: order.id,
                labName: order.labName,
                workTypeName: order.workTypeName,
                status: order.status,
              },
              labStatus: args.status,
              ...(args.reason && { reason: args.reason }),
            },
          };
        },
        execute: async (actor, payload) => {
          const order = await this.audited(
            actor,
            LAB_ORDERS_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.labOrderId,
            () =>
              this.labOrders.changeStatus(
                actor,
                payload.labOrderId,
                payload.status,
                payload.reason ?? undefined,
              ),
          );

          return { result: null, audit: { entity: LAB_ORDERS_ENTITY, entityId: order.id } };
        },
      }),

      defineAction<typeof movementSchema, MovementInput>({
        tool: AI_TOOL.RECORD_STOCK_MOVEMENT,
        kind: AI_PROPOSAL_KIND.STOCK_MOVEMENT,
        description:
          "Record stock coming in (purchase), used (consume) or counted (adjust, a signed " +
          "correction with its reason). Takes an item_id from find_stock_items. The quantity " +
          "on hand is never set directly: it is the sum of these. Waits on a card the user " +
          "confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.RECORD_STOCK_MOVEMENT],
        capability: "inventory.list",
        capabilityFor: (payload) => MOVEMENT_CAPABILITY[payload.type],
        schema: movementSchema,
        prepare: async (actor, args) => {
          const item = await this.stockItems.findOne(actor, args.item_id);
          const movement = parseMovement(args);

          if (movement instanceof Stop) {
            return movement;
          }

          const patient =
            movement.type === MOVEMENT_TYPE.CONSUME && movement.input.patientId
              ? await this.patients.findOne(actor, movement.input.patientId)
              : null;

          return {
            payload: movement,
            summary: {
              stockItem: { id: item.id, name: item.nameAr, unit: item.unit },
              movementType: movement.type,
              quantity: movement.input.quantity,
              ...(movement.type === MOVEMENT_TYPE.PURCHASE &&
                movement.input.unitPrice && { amount: movement.input.unitPrice }),
              ...(patient && { patient: patientSummary(patient) }),
              ...(movement.input.reason && { reason: movement.input.reason }),
            },
          };
        },
        execute: async (actor, payload) => {
          const created = await this.audited(
            actor,
            STOCK_MOVEMENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () => {
              switch (payload.type) {
                case MOVEMENT_TYPE.PURCHASE:
                  return this.movements.purchase(actor, payload.input);
                case MOVEMENT_TYPE.CONSUME:
                  return this.movements.consume(actor, payload.input);
                case MOVEMENT_TYPE.ADJUST:
                  return this.movements.adjust(actor, payload.input);
              }
            },
          );

          return { result: null, audit: { entity: STOCK_MOVEMENTS_ENTITY, entityId: created.id } };
        },
      }),

      defineAction<typeof scheduleSchema, SchedulePayload>({
        tool: AI_TOOL.SET_DOCTOR_SCHEDULE,
        kind: AI_PROPOSAL_KIND.DOCTOR_SCHEDULE,
        description:
          "Change a doctor's weekly working hours. Pass only the weekdays that change, each " +
          "with its full new hours (empty for a day off); the others stay as they are — read " +
          "them from find_doctors. Appointments left outside the new hours come back as a " +
          "sanity_check. For one day or a few days away, use add_doctor_time_off instead. " +
          "Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.SET_DOCTOR_SCHEDULE],
        capability: "doctors.updateSchedule",
        schema: scheduleSchema,
        prepare: async (actor, args) => {
          const doctor = await this.doctors.findOne(actor, args.doctor_id);
          const changed = new Map(args.days.map((day) => [day.weekday, day.ranges]));
          const next = weeklyScheduleSchema.safeParse(
            [
              ...doctor.weeklySchedule.filter((day) => !changed.has(day.weekday)),
              ...[...changed].map(([weekday, ranges]) => ({ weekday, ranges })),
            ].sort((a, b) => a.weekday - b.weekday),
          );

          if (!next.success) {
            return new Stop({
              status: "invalid_arguments",
              details: next.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`,
              ),
            });
          }

          const outside = await this.outsideHours(actor, doctor.id, next.data, [...changed.keys()]);

          if (
            outside.length > 0 &&
            !(args.acknowledge ?? []).includes(AI_ACTION_CHECK.OUTSIDE_SCHEDULE)
          ) {
            return sanityCheck(AI_ACTION_CHECK.OUTSIDE_SCHEDULE, {
              appointments: outside.map((appointment) => ({
                id: appointment.id,
                startsAt: appointment.startsAt,
                patientName: appointment.patientName,
              })),
              note:
                "They stay booked outside the new hours; nothing cancels them. Ask whether " +
                "that is right, or whether they should be moved or cancelled first.",
            });
          }

          return {
            payload: { doctorId: doctor.id, weeklySchedule: next.data },
            summary: {
              doctor: { id: doctor.id, name: doctor.user.name },
              scheduleChanges: [...changed.keys()]
                .sort((a, b) => a - b)
                .map((weekday) => ({
                  weekday,
                  before: rangesOn(doctor.weeklySchedule, weekday),
                  after: rangesOn(next.data, weekday),
                })),
              ...(outside.length > 0 && {
                outsideHours: true,
                appointments: outside.map((appointment) => ({
                  id: appointment.id,
                  startsAt: appointment.startsAt,
                  patientName: appointment.patientName,
                  patientFileNumber: appointment.patientFileNumber,
                  doctorName: appointment.doctorName,
                })),
              }),
            },
          };
        },
        execute: async (actor, payload) => {
          await this.audited(actor, DOCTORS_ENTITY, AUDIT_ACTION.UPDATE, payload.doctorId, () =>
            this.doctors.updateSchedule(actor, payload.doctorId, {
              weeklySchedule: payload.weeklySchedule,
            }),
          );

          return { result: null, audit: { entity: DOCTORS_ENTITY, entityId: payload.doctorId } };
        },
      }),

      defineAction<
        z.ZodObject<{ payment_id: z.ZodUUID; reason: typeof reversalReason }>,
        ReversalPayload
      >({
        tool: AI_TOOL.REVERSE_PAYMENT,
        kind: AI_PROPOSAL_KIND.PAYMENT_REVERSE,
        description:
          "Reverse a patient's payment recorded by mistake: a new negative entry cancels it, " +
          "and the original stays on the record. Takes a payment_id from find_payments and the " +
          "reason the user gave. Always needs a typed confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.REVERSE_PAYMENT],
        capability: "payments.reverse",
        schema: z.object({ payment_id: z.uuid(), reason: reversalReason }),
        prepare: async (actor, args) => {
          const payment = await this.payments.findOne(actor, args.payment_id);
          const [row] = await this.db
            .select({ reversesId: payments.reversesId, reversedAt: payments.reversedAt })
            .from(payments)
            .where(and(eq(payments.id, payment.id), eq(payments.clinicId, actor.clinicId)));
          const stop = irreversible(row);

          if (stop) {
            return stop;
          }

          const patient = await this.patients.findOne(actor, payment.patientId);

          return {
            payload: { id: payment.id, reason: args.reason },
            summary: {
              patient: patientSummary(patient),
              amount: payment.amount,
              method: payment.method,
              recordedAt: payment.createdAt,
              reason: args.reason,
            },
          };
        },
        execute: async (actor, payload) => {
          await this.audited(actor, PAYMENTS_ENTITY, AUDIT_ACTION.UPDATE, payload.id, async () => {
            await this.payments.reverse(actor, payload.id, { reason: payload.reason });

            return { id: payload.id };
          });

          return { result: null, audit: { entity: PAYMENTS_ENTITY, entityId: payload.id } };
        },
      }),

      defineAction<typeof labPaymentSchema, LabPaymentPayload>({
        tool: AI_TOOL.RECORD_LAB_PAYMENT,
        kind: AI_PROPOSAL_KIND.LAB_PAYMENT_CREATE,
        description:
          "Record money the clinic paid a lab, as a whole amount, with the payment method's " +
          "code (omit it for the clinic's first method). Takes a lab_id from find_labs. Waits " +
          "on a card the user confirms; a large one needs a typed confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.RECORD_LAB_PAYMENT],
        capability: "lab-payments.create",
        schema: labPaymentSchema,
        prepare: async (actor, args) => {
          const lab = await this.labs.findOne(actor, args.lab_id);
          const methods = await this.paymentMethods(actor.clinicId);
          const method = args.method ?? methods[0];

          if (!method || !methods.includes(method)) {
            return new Stop({ status: "unknown_method", methods });
          }

          const amount = wholeMoneySchema.parse(String(args.amount));
          const { balance } = await this.labLedger.balanceFor(actor.clinicId, lab.id);

          if (
            !(args.acknowledge ?? []).includes(AI_ACTION_CHECK.EXCEEDS_BALANCE) &&
            toMinorUnits(amount) > EXCEEDS_BALANCE_FACTOR * Math.max(toMinorUnits(balance), 0)
          ) {
            return sanityCheck(AI_ACTION_CHECK.EXCEEDS_BALANCE, { amount, balance });
          }

          return {
            payload: { labId: lab.id, amount, method, note: args.note ?? null },
            summary: {
              lab: { id: lab.id, name: lab.name },
              amount,
              method,
              ...(args.note && { note: args.note }),
            },
          };
        },
        escalate: (payload, settings) =>
          toMinorUnits(payload.amount) >= settings.paymentTypedAbove * 100
            ? AI_RISK_TIER.TYPED
            : AI_RISK_TIER.AUTO,
        execute: async (actor, payload) => {
          const payment = await this.audited(
            actor,
            LAB_PAYMENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () => this.labPaymentsService.create(actor, payload),
          );

          return { result: null, audit: { entity: LAB_PAYMENTS_ENTITY, entityId: payment.id } };
        },
      }),

      defineAction<
        z.ZodObject<{ lab_payment_id: z.ZodUUID; reason: typeof reversalReason }>,
        ReversalPayload
      >({
        tool: AI_TOOL.REVERSE_LAB_PAYMENT,
        kind: AI_PROPOSAL_KIND.LAB_PAYMENT_REVERSE,
        description:
          "Reverse a payment to a lab recorded by mistake: a new negative entry cancels it. " +
          "Takes a lab_payment_id from get_lab_payments and the reason the user gave. Always " +
          "needs a typed confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.REVERSE_LAB_PAYMENT],
        capability: "lab-payments.reverse",
        schema: z.object({ lab_payment_id: z.uuid(), reason: reversalReason }),
        prepare: async (actor, args) => {
          const [row] = await this.db
            .select()
            .from(labPayments)
            .where(
              and(
                eq(labPayments.id, args.lab_payment_id),
                eq(labPayments.clinicId, actor.clinicId),
                isNull(labPayments.deletedAt),
              ),
            );

          if (!row) {
            throw new NotFoundException("Resource not found");
          }

          const stop = irreversible(row);

          if (stop) {
            return stop;
          }

          const lab = await this.labs.findOne(actor, row.labId);

          return {
            payload: { id: row.id, reason: args.reason },
            summary: {
              lab: { id: lab.id, name: lab.name },
              amount: row.amount,
              method: row.method,
              recordedAt: row.createdAt.toISOString(),
              reason: args.reason,
            },
          };
        },
        execute: async (actor, payload) => {
          await this.audited(
            actor,
            LAB_PAYMENTS_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.id,
            async () => {
              await this.labPaymentsService.reverse(actor, payload.id, { reason: payload.reason });

              return { id: payload.id };
            },
          );

          return { result: null, audit: { entity: LAB_PAYMENTS_ENTITY, entityId: payload.id } };
        },
      }),

      defineAction<
        z.ZodObject<{ movement_id: z.ZodUUID; reason: typeof reversalReason }>,
        ReversalPayload
      >({
        tool: AI_TOOL.REVERSE_STOCK_MOVEMENT,
        kind: AI_PROPOSAL_KIND.STOCK_REVERSE,
        description:
          "Reverse a stock movement recorded by mistake: a new opposite entry cancels it. " +
          "Takes a movement_id from get_stock_movements and the reason the user gave. A count " +
          "that was merely off is an adjust, not a reversal. Always needs a typed confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.REVERSE_STOCK_MOVEMENT],
        capability: "inventory.reverse",
        schema: z.object({ movement_id: z.uuid(), reason: reversalReason }),
        prepare: async (actor, args) => {
          const [row] = await this.db
            .select()
            .from(stockMovements)
            .where(
              and(
                eq(stockMovements.id, args.movement_id),
                eq(stockMovements.clinicId, actor.clinicId),
              ),
            );

          if (!row) {
            throw new NotFoundException("Resource not found");
          }

          const stop = irreversible(row);

          if (stop) {
            return stop;
          }

          const item = await this.stockItems.findOne(actor, row.itemId);

          return {
            payload: { id: row.id, reason: args.reason },
            summary: {
              stockItem: { id: item.id, name: item.nameAr, unit: item.unit },
              movementType: row.type,
              quantity: row.quantity,
              recordedAt: row.createdAt.toISOString(),
              reason: args.reason,
            },
          };
        },
        execute: async (actor, payload) => {
          await this.audited(
            actor,
            STOCK_MOVEMENTS_ENTITY,
            AUDIT_ACTION.UPDATE,
            payload.id,
            async () => {
              await this.movements.reverse(actor, payload.id, { reason: payload.reason });

              return { id: payload.id };
            },
          );

          return { result: null, audit: { entity: STOCK_MOVEMENTS_ENTITY, entityId: payload.id } };
        },
      }),

      defineAction<typeof extraHoursSchema, ExtraHoursPayload>({
        tool: AI_TOOL.ADD_DOCTOR_EXTRA_HOURS,
        kind: AI_PROPOSAL_KIND.EXTRA_HOURS_CREATE,
        description:
          "Record that a doctor works on one date beyond their weekly schedule — covering for a " +
          "colleague, an extra clinic day — with the hours (HH:MM) and why. Those hours become " +
          "bookable. For a permanent change use set_doctor_schedule. Waits on a card the user " +
          "confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.ADD_DOCTOR_EXTRA_HOURS],
        capability: "doctor-extra-hours.create",
        schema: extraHoursSchema,
        prepare: async (actor, args) => {
          const doctor = await this.doctors.findOne(actor, args.doctor_id);

          await this.access.requireOwnCalendar(actor, doctor.id);

          const input = createDoctorExtraHoursSchema.safeParse({
            date: args.date,
            ranges: args.ranges,
            reason: args.reason,
          });

          if (!input.success) {
            return new Stop({
              status: "invalid_arguments",
              details: input.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`,
              ),
            });
          }

          return {
            payload: {
              doctorId: doctor.id,
              date: input.data.date,
              ranges: input.data.ranges,
              reason: input.data.reason,
            },
            summary: {
              doctor: { id: doctor.id, name: doctor.user.name },
              extraHours: { date: input.data.date, ranges: input.data.ranges },
              reason: input.data.reason,
            },
          };
        },
        execute: async (actor, payload) => {
          const created = await this.audited(
            actor,
            DOCTOR_EXTRA_HOURS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () =>
              this.extraHours.create(actor, payload.doctorId, {
                date: payload.date,
                ranges: [...payload.ranges],
                reason: payload.reason,
              }),
          );

          return {
            result: null,
            audit: { entity: DOCTOR_EXTRA_HOURS_ENTITY, entityId: created.id },
          };
        },
      }),

      defineAction<typeof planSchema, PlanPayload>({
        tool: AI_TOOL.PROPOSE_PLAN,
        kind: AI_PROPOSAL_KIND.PLAN,
        description:
          "Carry out several changes as one plan the user confirms once — the way to do " +
          "anything that takes more than one change. Each step is any other action tool with " +
          "exactly the arguments it takes alone, in the order they must happen. The whole plan " +
          "is rehearsed against the real records first, each step seeing the ones before it, " +
          "then thrown away: a step that would fail comes back with its index and why — and, " +
          "for a time that is taken, the free times as they would be after the earlier steps — " +
          "so you fix the plan and call again. On the card it runs all or nothing.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.PROPOSE_PLAN],
        capability: null,
        schema: planSchema,
        prepare: (actor, args) => this.rehearsePlan(actor, args.steps),
        escalate: (payload, settings) =>
          maxRiskTier(
            ...payload.steps.map((step) => {
              const action = this.actionFor(step.tool);

              return AiActionsService.resolveTier(
                action.risk,
                minTierFor(settings, action.tool),
                action.escalate(step.payload, settings),
              );
            }),
          ),
        execute: async (actor, payload) => {
          const settings = await this.settings(actor.clinicId);
          let last: Executed | undefined;

          await commitTogether(this.db, async () => {
            for (const step of payload.steps) {
              const action = this.actionFor(step.tool);

              try {
                if (isDisabled(settings, action.tool)) {
                  throw new ForbiddenException();
                }

                await this.assertAllowed(actor, action.capabilityFor(step.payload));
                last = await action.execute(actor, step.payload);
              } catch (error) {
                throw new PlanStepFailure(action.kind, error);
              }
            }
          });

          if (!last) {
            throw new BadRequestException("An empty plan");
          }

          return { result: null, audit: last.audit };
        },
      }),

      defineAction({
        tool: AI_TOOL.CREATE_PATIENT,
        kind: AI_PROPOSAL_KIND.PATIENT_CREATE,
        description:
          "Register a new patient with the name and phone the user gave. A phone another " +
          "patient already has comes back as possible_duplicate with their file number: ask " +
          "whether it is the same person. Waits on a card the user confirms.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.CREATE_PATIENT],
        capability: "patients.create",
        schema: z.object({
          full_name: z.string().trim().min(2).max(160),
          phone: phoneSchema,
          date_of_birth: dateSchema.optional(),
          gender: z.enum(GENDERS).optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const existing = await this.samePhone(actor, args.phone);

          if (
            existing.length > 0 &&
            !(args.acknowledge ?? []).includes(AI_ACTION_CHECK.POSSIBLE_DUPLICATE)
          ) {
            return sanityCheck(AI_ACTION_CHECK.POSSIBLE_DUPLICATE, {
              existing: existing.map((row) => ({
                fileNumber: row.fileNumber,
                fullName: row.fullName,
              })),
            });
          }

          return {
            payload: {
              fullName: args.full_name,
              phone: args.phone,
              dateOfBirth: args.date_of_birth ?? null,
              gender: args.gender ?? null,
            },
            summary: {
              newPatient: {
                fullName: args.full_name,
                phone: args.phone,
                dateOfBirth: args.date_of_birth ?? null,
              },
            },
          };
        },
        execute: async (actor, payload) => {
          const patient = await this.audited(
            actor,
            PATIENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () => this.patients.create(actor, payload),
          );

          return {
            result: { entity: "patient", id: patient.id, patientId: patient.id },
            audit: { entity: PATIENTS_ENTITY, entityId: patient.id },
          };
        },
      }),

      defineAction({
        tool: AI_TOOL.RECORD_PAYMENT,
        kind: AI_PROPOSAL_KIND.PAYMENT_CREATE,
        description:
          "Record money a patient paid, as a whole amount in the clinic's currency, with the " +
          "payment method's code (omit it for the clinic's first method). A payment never edits " +
          "one already recorded. Waits on a card the user confirms; a large one needs a typed " +
          "confirmation.",
        risk: AI_ACTION_BASE_TIER[AI_TOOL.RECORD_PAYMENT],
        capability: "payments.create",
        schema: z.object({
          patient_id: z.uuid(),
          amount: z.number().int().min(1).max(99_999_999),
          method: z.string().trim().min(1).max(64).optional(),
          note: z.string().trim().max(500).optional(),
          acknowledge: acknowledgeSchema,
        }),
        prepare: async (actor, args) => {
          const patient = await this.patients.findOne(actor, args.patient_id);
          const methods = await this.paymentMethods(actor.clinicId);
          const method = args.method ?? methods[0];

          if (!method || !methods.includes(method)) {
            return new Stop({ status: "unknown_method", methods });
          }

          const amount = wholeMoneySchema.parse(String(args.amount));
          const acknowledged = args.acknowledge ?? [];
          const { balance } = await this.ledger.balanceFor(actor.clinicId, patient.id);

          if (
            !acknowledged.includes(AI_ACTION_CHECK.EXCEEDS_BALANCE) &&
            toMinorUnits(amount) > EXCEEDS_BALANCE_FACTOR * Math.max(toMinorUnits(balance), 0)
          ) {
            return sanityCheck(AI_ACTION_CHECK.EXCEEDS_BALANCE, { amount, balance });
          }

          const stop = await this.dormant(actor, patient.id, acknowledged);

          return (
            stop ?? {
              payload: { patientId: patient.id, amount, method, note: args.note ?? null },
              summary: {
                patient: patientSummary(patient),
                amount,
                method,
                ...(args.note && { note: args.note }),
              },
            }
          );
        },
        escalate: (payload, settings) =>
          toMinorUnits(payload.amount) >= settings.paymentTypedAbove * 100
            ? AI_RISK_TIER.TYPED
            : AI_RISK_TIER.AUTO,
        execute: async (actor, payload) => {
          const payment = await this.audited(
            actor,
            PAYMENTS_ENTITY,
            AUDIT_ACTION.CREATE,
            undefined,
            () => this.payments.create(actor, payload),
          );

          return {
            result: { entity: "payment", id: payment.id, patientId: payload.patientId },
            audit: { entity: PAYMENTS_ENTITY, entityId: payment.id },
          };
        },
      }),
    ];
  }

  // What the audit interceptor does around a screen's request, done here because the assistant
  // calls the service directly: snapshot before, snapshot after, one entry with both.
  private async audited<TResult extends { id: string }>(
    actor: AuthenticatedUser,
    entity: string,
    action: AuditAction,
    knownId: string | undefined,
    run: () => Promise<TResult>,
  ): Promise<TResult> {
    const loader = this.auditSnapshots.get(entity);
    const before = loader && knownId ? await loader(knownId, actor.clinicId) : null;
    const result = await run();
    const after = loader ? await loader(result.id, actor.clinicId) : null;

    await this.audit.record({
      clinicId: actor.clinicId,
      userId: actor.id,
      action,
      entity,
      entityId: result.id,
      oldValue: before,
      newValue: after,
    });

    return result;
  }

  // `AvailabilityService` decides; this only reads its answer for the one minute asked about.
  private async slot(
    actor: AuthenticatedUser,
    query: {
      doctorId: string;
      date: string;
      time: string;
      durationMinutes: number | undefined;
      excludeAppointmentId?: string;
    },
  ): Promise<{ startsAt: string; durationMinutes: number } | Stop> {
    const day = await this.availability.forDay(actor.clinicId, {
      doctorId: query.doctorId,
      date: query.date,
      ...(query.durationMinutes !== undefined && { durationMinutes: query.durationMinutes }),
      ...(query.excludeAppointmentId && { excludeAppointmentId: query.excludeAppointmentId }),
    });
    const slot = day.slots.find((candidate) => candidate.start === query.time);

    if (slot?.available) {
      return { startsAt: slot.startsAt, durationMinutes: day.durationMinutes };
    }

    const blockers = slot ? await this.blockers(actor, query.doctorId, slot, query) : [];

    if (blockers.length > 0) {
      return new Stop({ status: "slot_taken", blockers });
    }

    return new Stop({
      status: "slot_unavailable",
      closed_reason: day.closedReason ?? "outside_hours",
      closed_note: day.closedNote,
    });
  }

  private async blockers(
    actor: AuthenticatedUser,
    doctorId: string,
    slot: { startsAt: string; end: string; start: string },
    query: { excludeAppointmentId?: string },
  ): Promise<{ startsAt: string; patientName: string; patientFileNumber: string }[]> {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(
      startsAt.getTime() + (minutes(slot.end) - minutes(slot.start)) * 60_000,
    );

    const rows = await this.db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        patientName: patients.fullName,
        patientFileNumber: patients.fileNumber,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(
        and(
          eq(appointments.clinicId, actor.clinicId),
          eq(appointments.doctorId, doctorId),
          isNull(appointments.deletedAt),
          lt(appointments.startsAt, endsAt),
          sql`${appointments.startsAt} + make_interval(mins => ${appointments.durationMinutes}) > ${startsAt.toISOString()}::timestamptz`,
        ),
      );

    return rows
      .filter((row) => occupiesSlot(row.status) && row.id !== query.excludeAppointmentId)
      .map((row) => ({
        startsAt: row.startsAt.toISOString(),
        patientName: row.patientName,
        patientFileNumber: row.patientFileNumber,
      }));
  }

  // "The whole day": every appointment the clinic still has on one of the dates targeted.
  private async coversWholeDay(
    actor: AuthenticatedUser,
    targets: readonly CalendarAppointment[],
  ): Promise<boolean> {
    if (targets.length < 2) {
      return false;
    }

    const timeZone = await this.timeZone(actor.clinicId);
    const days = new Set(targets.map((target) => localDate(new Date(target.startsAt), timeZone)));
    const ids = new Set(targets.map((target) => target.id));

    for (const day of days) {
      const rows = await this.db
        .select({ id: appointments.id, status: appointments.status })
        .from(appointments)
        .where(
          and(
            eq(appointments.clinicId, actor.clinicId),
            isNull(appointments.deletedAt),
            gte(appointments.startsAt, instantFromLocal(day, 0, timeZone)),
            lt(appointments.startsAt, instantFromLocal(addDays(day, 1), 0, timeZone)),
          ),
        );
      const live = rows.filter((row) => occupiesSlot(row.status));

      if (live.length >= 2 && live.every((row) => ids.has(row.id))) {
        return true;
      }
    }

    return false;
  }

  // Whole days run to midnight after `date_to`, the same window a closure's inclusive `endsOn` has.
  private async period(
    clinicId: string,
    args: {
      date_from: string;
      date_to: string;
      time_from?: string | undefined;
      time_to?: string | undefined;
    },
  ): Promise<{ from: Date; to: Date } | Stop> {
    const zone = await this.timeZone(clinicId);
    const from = instantFromLocal(
      args.date_from,
      args.time_from ? minutes(args.time_from) : 0,
      zone,
    );
    const to = args.time_to
      ? instantFromLocal(args.date_to, minutes(args.time_to), zone)
      : instantFromLocal(addDays(args.date_to, 1), 0, zone);

    return from < to
      ? { from, to }
      : new Stop({ status: "not_possible", reason: "ends_before_start" });
  }

  /** Who is booked inside the period; a question for the user until they have said what to do. */
  private async periodConflicts(
    actor: AuthenticatedUser,
    window: { from: Date; to: Date },
    choice: AiScheduleConflictChoice | undefined,
    doctorId?: string,
  ): Promise<CalendarAppointment[] | Stop> {
    const found = await this.conflicts.findConflicts(actor.clinicId, window, doctorId);

    if (found.length > 0 && !choice) {
      return new Stop({
        status: "schedule_conflict",
        appointments: found.map((appointment) => ({
          id: appointment.id,
          startsAt: appointment.startsAt,
          patientName: appointment.patientName,
        })),
        instruction:
          "Stop and ask the user whether to cancel these appointments (each patient is " +
          "notified), keep them, or change the period. Call again with on_conflict only after " +
          "they answer.",
      });
    }

    return Promise.all(
      found.map((appointment) => this.appointments.findOne(actor, appointment.id)),
    );
  }

  // The card listed who would be affected; somebody booked since then was never shown to anybody.
  private async assertNoNewConflicts(
    actor: AuthenticatedUser,
    window: { from: Date; to: Date },
    known: readonly string[],
    doctorId?: string,
  ): Promise<void> {
    const current = await this.conflicts.findConflicts(actor.clinicId, window, doctorId);

    if (current.some((appointment) => !known.includes(appointment.id))) {
      throw new ConflictException("Appointments were booked into the period since the draft");
    }
  }

  // A route's write, drafted and confirmed like every hand-written action: validated by the
  // route's own schemas, summarised with names, and run through its handler on the click.
  private routeActions(): Action[] {
    return this.routes
      .list()
      .filter((route) => route.risk !== null)
      .map((route) =>
        defineAction<z.ZodObject, RoutePayload>({
          tool: route.name,
          group: route.group,
          kind: AI_PROPOSAL_KIND.ROUTE_CALL,
          description: route.description,
          risk: route.risk ?? AI_RISK_TIER.CONFIRM,
          capability: route.capability,
          schema: route.schema,
          prepare: async (actor, args) => {
            try {
              route.parse(args);
            } catch (error) {
              if (error instanceof z.ZodError) {
                return new Stop({
                  status: "invalid_arguments",
                  details: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
                });
              }
              throw error;
            }

            return {
              payload: { tool: route.name, args },
              summary: await this.routeSummary(actor, route, args),
            };
          },
          execute: async (actor, payload) => {
            const result = await route.invoke(actor, payload.args);

            return {
              result: null,
              audit: { entity: route.name, entityId: idOf(result) ?? route.name },
            };
          },
        }),
      );
  }

  // Names for the ids a person recognises; every other field as sent, so the card hides nothing.
  private async routeSummary(
    actor: AuthenticatedUser,
    route: RouteTool,
    args: Record<string, unknown>,
  ): Promise<AiActionSummary> {
    const patientId = typeof args["patientId"] === "string" ? args["patientId"] : null;
    const doctorId = typeof args["doctorId"] === "string" ? args["doctorId"] : null;
    const [patient, doctor] = await Promise.all([
      patientId ? this.patients.findOne(actor, patientId) : null,
      doctorId ? this.doctors.findOne(actor, doctorId) : null,
    ]);
    const shown = new Set([...(patient ? ["patientId"] : []), ...(doctor ? ["doctorId"] : [])]);

    return {
      ...(patient && { patient: patientSummary(patient) }),
      ...(doctor && { doctor: { id: doctor.id, name: doctor.user.name } }),
      route: {
        tool: route.name,
        capability: route.capability,
        fields: Object.entries(args)
          .filter(([name, value]) => !shown.has(name) && value !== undefined && value !== null)
          .map(([name, value]) => ({
            name,
            value: (typeof value === "string" ? value : JSON.stringify(value)).slice(0, 300),
          })),
      },
    };
  }

  /** A route call is found by the tool it carries: every one of them shares its kind. */
  private actionForRow(row: ProposalRow): Action | undefined {
    if (row.kind === AI_PROPOSAL_KIND.ROUTE_CALL) {
      const tool = (row.payload as Partial<RoutePayload> | null)?.tool;

      return this.list().find((candidate) => candidate.tool === tool);
    }

    return this.list().find((candidate) => candidate.kind === row.kind);
  }

  private actionFor(tool: string): Action {
    const action = this.list().find((candidate) => candidate.tool === tool);

    if (!action) {
      throw new NotFoundException("Resource not found");
    }

    return action;
  }

  /**
   * Every step prepared and run through its real service, in order, inside one transaction that
   * is then rolled back: a later step sees what the earlier ones did, and nothing is kept.
   */
  private async rehearsePlan(
    actor: AuthenticatedUser,
    steps: z.output<typeof planSchema>["steps"],
  ): Promise<Draft<PlanPayload> | Stop> {
    const settings = await this.settings(actor.clinicId);

    return rehearse(this.db, async () => {
      const planned: { tool: string; payload: unknown; summary: AiActionSummary }[] = [];

      for (const [index, step] of steps.entries()) {
        const action = this.actionFor(step.tool);
        const at = { step: index, tool: step.tool };

        if (isDisabled(settings, action.tool)) {
          return new Stop({ status: "disabled", ...at });
        }

        const args = action.schema.safeParse(step.args);

        if (!args.success) {
          return new Stop({
            status: "invalid_arguments",
            ...at,
            details: args.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
          });
        }

        try {
          const draft = await action.prepare(actor, args.data);

          if (draft instanceof Stop) {
            return new Stop({
              ...draft.forModel,
              ...at,
              ...(await this.freeTimesAfter(actor, draft, step.args)),
            });
          }

          const capability = action.capabilityFor(draft.payload);

          if (
            capability &&
            !(await this.permissions.allows(actor.clinicId, actor.role, capability))
          ) {
            return new Stop({ status: "not_permitted", ...at });
          }

          await action.execute(actor, draft.payload);
          planned.push({ tool: action.tool, payload: draft.payload, summary: draft.summary });
        } catch (error) {
          return new Stop({
            status: "step_failed",
            ...at,
            error: domainFailure(action.kind, error),
          });
        }
      }

      return {
        payload: { steps: planned.map(({ tool, payload }) => ({ tool, payload })) },
        summary: {
          steps: planned.map(({ tool, summary }) => ({
            kind: this.actionFor(tool).kind,
            summary: withoutSteps(summary),
          })),
        },
      };
    });
  }

  // For a booking step whose time is taken: what the doctor has free that day once the steps
  // before it have happened — computed inside the same rehearsal, so it counts them.
  private async freeTimesAfter(
    actor: AuthenticatedUser,
    stop: Stop,
    args: Record<string, unknown>,
  ): Promise<{ free_after_earlier_steps?: string[] }> {
    const status = stop.forModel["status"];

    if (
      (status !== "slot_taken" && status !== "slot_unavailable") ||
      typeof args["date"] !== "string"
    ) {
      return {};
    }

    const appointment =
      typeof args["appointment_id"] === "string"
        ? await this.appointments.findOne(actor, args["appointment_id"])
        : null;
    const doctorId =
      typeof args["doctor_id"] === "string" ? args["doctor_id"] : appointment?.doctorId;

    if (!doctorId) {
      return {};
    }

    const day = await this.availability.forDay(actor.clinicId, {
      doctorId,
      date: args["date"],
      ...(appointment && {
        durationMinutes: appointment.durationMinutes,
        excludeAppointmentId: appointment.id,
      }),
    });
    const wanted = typeof args["time"] === "string" ? minutes(args["time"]) : 0;

    return {
      free_after_earlier_steps: day.slots
        .filter((slot) => slot.available)
        .sort((a, b) => Math.abs(minutes(a.start) - wanted) - Math.abs(minutes(b.start) - wanted))
        .slice(0, 8)
        .map((slot) => slot.start)
        .sort(),
    };
  }

  /** Booked appointments from now on, on the changed weekdays, that no longer fit the hours. */
  private async outsideHours(
    actor: AuthenticatedUser,
    doctorId: string,
    schedule: WeeklySchedule,
    weekdays: readonly number[],
  ): Promise<CalendarAppointment[]> {
    const zone = await this.timeZone(actor.clinicId);
    const rows = await this.db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, actor.clinicId),
          eq(appointments.doctorId, doctorId),
          isNull(appointments.deletedAt),
          gte(appointments.startsAt, new Date()),
        ),
      )
      .orderBy(asc(appointments.startsAt));

    const outside = rows.filter((row) => {
      if (!occupiesSlot(row.status)) {
        return false;
      }

      const { weekday, minute } = clockIn(zone, row.startsAt);

      return (
        weekdays.includes(weekday) &&
        !rangesOn(schedule, weekday).some(
          (range) =>
            minutes(range.start) <= minute && minute + row.durationMinutes <= minutes(range.end),
        )
      );
    });

    return Promise.all(
      outside
        .slice(0, LARGE_CANCELLATION * 5)
        .map((row) => this.appointments.findOne(actor, row.id)),
    );
  }

  /** Somebody not seen in two years is as likely a namesake as the person meant. */
  private async dormant(
    actor: AuthenticatedUser,
    patientId: string,
    acknowledged: readonly string[] | undefined,
  ): Promise<Stop | null> {
    if ((acknowledged ?? []).includes(AI_ACTION_CHECK.DORMANT_PATIENT)) {
      return null;
    }

    const [row] = await this.db
      .select({ lastVisitAt: max(visits.visitDate) })
      .from(visits)
      .where(
        and(
          eq(visits.clinicId, actor.clinicId),
          eq(visits.patientId, patientId),
          isNull(visits.deletedAt),
        ),
      );

    const last = row?.lastVisitAt;

    if (!last || Date.now() - last.getTime() <= DORMANT_AFTER_DAYS * 86_400_000) {
      return null;
    }

    return sanityCheck(AI_ACTION_CHECK.DORMANT_PATIENT, { last_visit_at: last.toISOString() });
  }

  private async samePhone(
    actor: AuthenticatedUser,
    phone: string,
  ): Promise<{ fileNumber: string; fullName: string }[]> {
    const digits = phone.replaceAll(/\D/g, "");

    return this.db
      .select({ fileNumber: patients.fileNumber, fullName: patients.fullName })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, actor.clinicId),
          isNull(patients.deletedAt),
          sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') = ${digits}`,
        ),
      )
      .limit(5);
  }

  private async paymentMethods(clinicId: string): Promise<string[]> {
    const rows = await this.db
      .select({ code: lookupOptions.code })
      .from(lookupOptions)
      .where(
        and(
          eq(lookupOptions.clinicId, clinicId),
          eq(lookupOptions.listKey, LOOKUP_LIST.PAYMENT_METHOD),
          eq(lookupOptions.isActive, true),
          isNull(lookupOptions.deletedAt),
        ),
      )
      .orderBy(asc(lookupOptions.sortOrder));

    return rows.map((row) => row.code);
  }

  private async timeZone(clinicId: string): Promise<string> {
    const [row] = await this.db
      .select({ settings: clinics.settings })
      .from(clinics)
      .where(eq(clinics.id, clinicId))
      .limit(1);

    return clinicScheduleSettings(row?.settings).timezone || DEFAULT_TIME_ZONE;
  }
}

/** A refusal at the click, answered with a status and the code the card writes the Arabic for. */
export class ActionRefusal extends Error {
  constructor(
    readonly code: AiActionError,
    readonly status: HttpStatus,
  ) {
    super(code);
    this.name = "ActionRefusal";
  }
}

// Type-erases one spec, and turns it into the tool the model calls. The payload is only ever one
// this spec's own `prepare` wrote, so the cast back is to what went in.
function defineAction<TSchema extends z.ZodType, TPayload>(
  spec: ActionSpec<TSchema, TPayload>,
): Action {
  const action: Action = {
    tool: spec.tool,
    kind: spec.kind,
    risk: spec.risk,
    schema: spec.schema,
    capabilityFor: (payload) => spec.capabilityFor?.(payload as TPayload) ?? spec.capability,
    prepare: (actor, args) => spec.prepare(actor, args as z.output<TSchema>),
    escalate: (payload, settings) =>
      spec.escalate?.(payload as TPayload, settings) ?? AI_RISK_TIER.AUTO,
    execute: (actor, payload) => spec.execute(actor, payload as TPayload),
    asTool: (service) =>
      defineTool({
        name: spec.tool,
        ...(spec.group && { group: spec.group }),
        description: spec.description,
        capability: spec.capability,
        risk: spec.risk,
        schema: spec.schema,
        run: async (actor, args, context) => {
          await service.assertEnabled(actor, action);

          const draft = await spec.prepare(actor, args);

          if (draft instanceof Stop) {
            return draft.forModel;
          }

          await service.assertAllowed(actor, action.capabilityFor(draft.payload));

          return service.runTool(action, actor, context.conversationId, draft);
        },
      }),
  };

  return action;
}

function sanityCheck(check: string, details: Record<string, unknown>): Stop {
  return new Stop({
    status: "sanity_check",
    check,
    ...details,
    instruction:
      "Stop and ask the user. Call again with acknowledge only if they answer that it is right.",
  });
}

const SCHEDULE_KINDS: readonly ActionKind[] = [
  AI_PROPOSAL_KIND.TIME_OFF_CREATE,
  AI_PROPOSAL_KIND.TIME_OFF_UPDATE,
  AI_PROPOSAL_KIND.CLOSURE_CREATE,
];

function domainFailure(kind: ActionKind, error: unknown): AiActionError {
  if (error instanceof PlanStepFailure) {
    return domainFailure(error.kind, error.cause);
  }

  if (error instanceof ConflictException) {
    if (SCHEDULE_KINDS.includes(kind)) {
      return AI_ACTION_ERROR.SCHEDULE_CONFLICT;
    }

    return kind === AI_PROPOSAL_KIND.PATIENT_CREATE
      ? AI_ACTION_ERROR.DUPLICATE
      : AI_ACTION_ERROR.SLOT_TAKEN;
  }

  if (error instanceof NotFoundException) {
    return AI_ACTION_ERROR.NOT_FOUND;
  }

  if (error instanceof ForbiddenException) {
    return AI_ACTION_ERROR.NOT_PERMITTED;
  }

  if (error instanceof BadRequestException) {
    return AI_ACTION_ERROR.INVALID_TRANSITION;
  }

  return AI_ACTION_ERROR.FAILED;
}

// Cancelling booked patients is not undone by anybody, so it asks for the phrase.
const escalateConflict = (payload: ConflictDecision): AiRiskTier =>
  payload.onConflict === AI_SCHEDULE_CONFLICT_CHOICE.CANCEL && payload.conflictIds.length > 0
    ? AI_RISK_TIER.TYPED
    : AI_RISK_TIER.AUTO;

const conflictOptions = (payload: ConflictDecision) => ({
  force: payload.conflictIds.length > 0,
  cancelAppointments: payload.onConflict === AI_SCHEDULE_CONFLICT_CHOICE.CANCEL,
});

const conflictSummary = (
  conflicts: readonly CalendarAppointment[],
  choice: AiScheduleConflictChoice | undefined,
): Pick<AiActionSummary, "onConflict" | "appointments"> =>
  conflicts.length > 0 && choice
    ? {
        onConflict: choice,
        appointments: conflicts.map((appointment) => ({
          id: appointment.id,
          startsAt: appointment.startsAt,
          patientName: appointment.patientName,
          patientFileNumber: appointment.patientFileNumber,
          doctorName: appointment.doctorName,
        })),
      }
    : {};

// Through the endpoint's own schema, so the card never shows a movement the screen would refuse.
function parseMovement(args: z.output<typeof movementSchema>): MovementInput | Stop {
  const base = { itemId: args.item_id, quantity: args.quantity, reason: args.reason ?? null };
  const parsed = (() => {
    switch (args.type) {
      case MOVEMENT_TYPE.PURCHASE: {
        const result = purchaseStockSchema.safeParse({
          ...base,
          ...(args.unit_price !== undefined && { unitPrice: args.unit_price }),
        });

        return result.success ? { type: args.type, input: result.data } : result.error;
      }
      case MOVEMENT_TYPE.CONSUME: {
        const result = consumeStockSchema.safeParse({
          ...base,
          patientId: args.patient_id ?? null,
        });

        return result.success ? { type: args.type, input: result.data } : result.error;
      }
      case MOVEMENT_TYPE.ADJUST: {
        const result = adjustStockSchema.safeParse({ ...base, reason: args.reason });

        return result.success ? { type: args.type, input: result.data } : result.error;
      }
    }
  })();

  return parsed instanceof z.ZodError
    ? new Stop({
        status: "invalid_arguments",
        details: parsed.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      })
    : parsed;
}

/** A reversing entry, or one already reversed, is where the ledger stops. */
function irreversible(
  row: { reversesId: string | null; reversedAt: Date | null } | undefined,
): Stop | null {
  if (!row) {
    throw new NotFoundException("Resource not found");
  }

  if (row.reversesId !== null) {
    return new Stop({ status: "not_possible", reason: "is_a_reversal" });
  }

  return row.reversedAt === null
    ? null
    : new Stop({ status: "not_possible", reason: "already_reversed" });
}

interface RoutePayload {
  readonly tool: string;
  readonly args: Record<string, unknown>;
}

// The clinic's switches and floors are kept per hand-written action; a generated one has none yet.
const isDisabled = (settings: AiActionsSettings, tool: string): boolean =>
  (settings.disabled as readonly string[]).includes(tool);

const minTierFor = (settings: AiActionsSettings, tool: string): AiRiskTier | undefined =>
  (settings.minTier as Partial<Record<string, AiRiskTier>>)[tool];

function idOf(result: unknown): string | undefined {
  const own = (result as { id?: unknown } | null)?.id;
  const item = (result as { item?: { id?: unknown } } | null)?.item?.id;

  return typeof own === "string" ? own : typeof item === "string" ? item : undefined;
}

const withoutSteps = ({ steps: _steps, ...summary }: AiActionSummary): AiActionStepSummary =>
  summary;

const rangesOn = (schedule: readonly DaySchedule[], weekday: number): TimeRange[] =>
  schedule.find((day) => day.weekday === weekday)?.ranges ?? [];

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// The clinic's weekday and minute of the day, as `DaySchedule` counts them.
function clockIn(timeZone: string, instant: Date): { weekday: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: WEEKDAY_INDEX[read("weekday")] ?? 0,
    minute: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

const patientSummary = (patient: PatientView) => ({
  id: patient.id,
  fullName: patient.fullName,
  fileNumber: patient.fileNumber,
});

const appointmentSummary = (appointment: CalendarAppointment): AiActionSummary => ({
  patient: {
    id: appointment.patientId,
    fullName: appointment.patientName,
    fileNumber: appointment.patientFileNumber,
  },
  doctor: { id: appointment.doctorId, name: appointment.doctorName },
  startsAt: appointment.startsAt,
  durationMinutes: appointment.durationMinutes,
});

const appointmentResult = (appointment: CalendarAppointment): Executed => ({
  result: { entity: "appointment", id: appointment.id, patientId: appointment.patientId },
  audit: { entity: APPOINTMENTS_ENTITY, entityId: appointment.id },
});

const minutes = (time: string): number => {
  const [hours = 0, mins = 0] = time.split(":").map(Number);

  return hours * 60 + mins;
};
